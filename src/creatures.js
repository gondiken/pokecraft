// Wild creatures roaming the world: spawning, wandering AI and targeting.
import * as THREE from 'three';
import { B, BLOCKS, isSolid } from './blocks.js';
import { WORLD_H, WATER_LEVEL } from './world.js';
import { SPECIES, SPAWNS, makeCreature, buildModel, animateModel, disposeModel } from './species.js';
import { condOf, condOk, goldenHour, isEvening, TOGETHER_RANGE, HOME_RANGE } from './spawnrules.js';
import { Disguise } from './disguise.js';
import { sound } from './sound.js';

const MAX_WILD = 16;
const SING_RANGE = 18;
const NOTE_HEAD = new THREE.BoxGeometry(0.18, 0.14, 0.04);
const NOTE_STEM = new THREE.BoxGeometry(0.04, 0.34, 0.04).translate(0.07, 0.17, 0);
const GROUND = new Set([B.GRASS, B.DIRT, B.SAND, B.STONE, B.SNOW, B.COBBLE, B.ICE, B.GRAVEL, B.MUD, B.SANDSTONE]);

/* ==== T36 parkour ==== */
// A gait owns a creature's movement instead of the wander walk (species field `gait`). 'hopaway' (Parkour): it sits
// still until you come near, then hops a few blocks away from you; after `tiredAfter` hops (or when it is cornered) it is
// out of breath for `tired` seconds, and then you can walk into it to battle. Hops are closed form (time based).
// notice/noticeUp: how close (blocks, sideways / up and down) you must be; hops: distances tried (3 then 2); time/arc: one
// hop's seconds and height; up/down: the most it climbs / drops (never off a cliff); leap: how far a creature on a perch
// may jump down, to the natural ground; leash: how far from where it spawned; angles: degrees off straight away tried in order.
export const GAITS = {
  hopaway: { notice: 6, noticeUp: 8, hops: [3, 2], time: 0.45, arc: 0.9, pause: 0.35, tiredAfter: 3, tired: 8,
    up: 1, down: 2, leap: 8, leash: 14, angles: [0, 35, -35, 70, -70, 110, -110], bump: true },
};
// A perch is a spot that stands this much above the natural ground (treetops, roofs, pillars; never hills).
const PERCH_UP = 3;
const TIRED_RANGE = 12;
/* ==== end of T36 parkour ==== */
/* ==== T37 ninja ==== */
// 'blink' (Ninja): it stands still and watches you. Come at it FAST (sprinting, riding: the distance to you shrinks by
// more than `fast` blocks a second) within `notice` and it vanishes in a puff of smoke and pops up `dists` blocks away
// (on a free spot at most `up` higher / `down` lower: never in water, a gym, a wall or off a cliff). Walk up slowly and
// it lets you come: walk into it to battle. After `tiredAfter` blinks (or when it has nowhere to go) it is out of breath
// for `tired` seconds. `gone`: seconds it stays invisible; `teleport`: a faster "approach" is a teleport, not you running.
// Everything is closed form and uses no Math.random (the spot comes from fixed angles), so tests can replay it.
Object.assign(GAITS, {
  blink: { notice: 8, noticeUp: 6, fast: 5.2, teleport: 15, dists: [6, 5, 7, 4], gone: 0.45, pause: 0.6, tiredAfter: 3, tired: 10,
    up: 2, down: 3, leash: 16, angles: [0, 40, -40, 80, -80, 120, -120], bump: true },
});
const PUFF_TIME = 0.6, PUFF_N = 7;
const PUFF_GEO = new THREE.BoxGeometry(0.28, 0.28, 0.28);
/* ==== end of T37 ninja ==== */

export class Wild {
  constructor(data, model, pos) {
    this.data = data;
    this.model = model;
    this.pos = pos;
    this.heading = Math.random() * Math.PI * 2;
    this.mode = 'idle';
    this.life = 60 + Math.random() * 60; // seconds before it wanders off (see CreatureManager.update)
    this.timer = Math.random() * 2;
    this.t = Math.random() * 10;
    this.frozen = false;
    this.disguise = null; // Camo creatures wear one until they are hit (see CreatureManager.spawnAt)
    this.popT = -1;
    this.home = { x: pos.x, z: pos.z }; // T36: where it spawned (the gait leash)
    this.hop = null; this.hops = 0; this.tired = 0; this.pause = 0; this.touching = false; // T36 gait state
    model.userData.wild = this;
  }
  get species() { return SPECIES[this.data.species]; }
  // Camo creatures never walk, not even after they pop out.
  get still() { return !!this.species.disguise; }
  // Drops the disguise and pops out of it. Returns the block's name, or null if there was no disguise.
  reveal() {
    const d = this.disguise;
    if (!d) return null;
    const name = BLOCKS[d.block].name;
    d.dispose();
    this.disguise = null;
    const root = this.model.userData.parts.root;
    root.visible = true;
    root.scale.setScalar(0.3);
    this.popT = 0;
    sound.play('popout');
    return name;
  }
  face(target) { this.heading = Math.atan2(target.x - this.pos.x, target.z - this.pos.z); }
}

export class CreatureManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.spawnTimer = 0;
    this.levelBonus = 0; // wild creatures get stronger after 16 badges (or the Champion title)
    this.notes = [];
    this.weather = null; // set by main.js: boosts spawn weights (see weights)
    this.env = null; // set by main.js: { time: () => game.time, friends: () => [positions of other players] }
    this.viewer = null; // the player's position, for blinks
    this.onBump = null; // main.js: the player walked into a disguised creature
    this.onTired = null; // main.js (T36): a Parkour creature is out of breath: walk into it
    this.onBlink = null; this.puffs = []; // T37: a Ninja creature blinked away (main.js: a tip); its smoke puffs
    this.raycaster = new THREE.Raycaster();
  }

  setWorld(world) {
    this.clear();
    this.world = world;
  }

  clear() {
    for (const w of [...this.list]) this.remove(w);
    this.clearPuffs(); // T37
  }

  // T31: a realm has its own spawn tables (world.realm.spawns); the main world uses SPAWNS.
  table(biome) { return this.world?.realm?.spawns[biome] ?? SPAWNS[biome] ?? []; }

  biomeAt(x, z) {
    if (this.world.realm) return this.world.realm.biome; // T31
    if (this.world.surface(x, z).id === B.WATER) return 'water';
    return this.world.biome(x, z);
  }

  // Turns the old boolean `night` argument into a context.
  static asCtx(x) { return typeof x === 'object' && x ? x : { night: !!x }; }

  // What spawn conditions look at: time of day, the golden hour, other players close by.
  context(playerPos, night = false, under = false) {
    const env = this.env;
    return {
      night, under,
      golden: under || !env ? null : goldenHour(env.time()),
      evening: !!env && isEvening(env.time()),
      homes: !env?.homes ? [] : env.homes().filter(h => Math.hypot(h.x - playerPos.x, h.z - playerPos.z) <= HOME_RANGE),
      friendsNear: !!env && env.friends().some(p => Math.hypot(p.x - playerPos.x, p.z - playerPos.z) <= TOGETHER_RANGE),
      // T36: a function (the search only runs when the 'high' condition is rolled); none underground, in a realm or without env
      perch: under || !env || this.world?.realm ? null : () => this.perchNear(playerPos),
    };
  }

  count(cond) { return this.list.filter(w => w.when === cond).length; }

  // Spawn table entries with their weights, after the weather's boosts: [[entry, weight], ...].
  // Conditions with a `share` (dawn, dusk, together) are not here: pickEntry draws them separately.
  weights(biome, ctx) {
    ctx = CreatureManager.asCtx(ctx);
    const wx = this.weather;
    return this.table(biome).filter(([, , when]) => condOk(when, ctx) && !condOf(when)?.share)
      .map(e => [e, e[1] * (wx ? wx.boost(biome, SPECIES[e[0]].type) : 1)]);
  }

  pickFrom(table) {
    const total = table.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    for (const [e, w] of table) if ((r -= w) < 0) return [e[0], e[2]];
    return [table[0][0][0], table[0][0][2]];
  }

  // Returns [species, when] where when is a condition name ('day', 'night', 'dawn', ...) or undefined (any time).
  pickEntry(biome, ctx) {
    ctx = CreatureManager.asCtx(ctx);
    const wx = this.weather;
    const done = new Set();
    for (const e of this.table(biome)) {
      const cond = e[2];
      const def = condOf(cond);
      if (!def?.share || done.has(cond)) continue;
      done.add(cond);
      if (!condOk(cond, ctx) || this.count(cond) >= (def.max ?? Infinity)) continue;
      const share = typeof def.share === 'function' ? def.share(ctx, cond.split(':')[1]) : def.share;
      if (Math.random() >= share) continue;
      const table = this.table(biome).filter(x => x[2] === cond).map(x => [x, x[1] * (wx ? wx.boost(biome, SPECIES[x[0]].type) : 1)]);
      return this.pickFrom(table);
    }
    return this.pickFrom(this.weights(biome, ctx));
  }

  pickSpecies(biome, ctx) { return this.pickEntry(biome, ctx)[0]; }

  // Ground height a creature should stand at for column (x, z), or null if not walkable.
  groundY(x, z, sp) {
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 1 || zi < 1 || xi >= this.world.W - 1 || zi >= this.world.D - 1) return null;
    const s = this.world.surface(xi, zi);
    const airborne = sp.flies || sp.floats;
    if (s.id === B.WATER) return sp.swims || airborne ? WATER_LEVEL + 0.55 : null;
    if (sp.waterOnly) return null; // fish stay in the water
    // Only walk on natural ground (not trees, cacti, gyms or other buildings).
    if (!(this.world.walk ?? GROUND).has(s.id)) return airborne ? s.y + 1 : null;
    return s.y + 1;
  }

  trySpawn(center, spawnPoint, night) {
    const ctx = CreatureManager.asCtx(night);
    const angle = Math.random() * Math.PI * 2;
    // Some close by (so a small place like a peak gets its own creatures), most a bit further out.
    const dist = Math.random() < 0.4 ? 9 + Math.random() * 8 : 14 + Math.random() * 22;
    const x = Math.floor(center.x + Math.cos(angle) * dist);
    const z = Math.floor(center.z + Math.sin(angle) * dist);
    if (x < 2 || z < 2 || x >= this.world.W - 2 || z >= this.world.D - 2) return;
    const biome = this.biomeAt(x, z);
    if (!biome) return;
    const [species, when] = this.pickEntry(biome, ctx);
    // A condition with a `place` (near a home) says where the creature appears.
    if (this.spawnPlaced(species, when, ctx, spawnPoint)) return;
    const sp = SPECIES[species];
    const y = this.groundY(x + 0.5, z + 0.5, sp);
    if (y === null) return;
    this.spawnAt(species, x, y, z, { when, level: this.wildLevel(x, z, spawnPoint, sp) });
  }

  // A condition with a `place` (a home visitor) says where the creature appears. Returns true when `when` has a place
  // (spawned or not), so the caller does not look for a spot of its own. Used by trySpawn and trySpawnCave (T22).
  spawnPlaced(species, when, ctx, spawnPoint) {
    const place = condOf(when)?.place;
    if (!place) return false;
    const at = place(ctx, when.split(':')[1]);
    if (at) this.spawnAt(species, at.x, at.y, at.z, { when, indoor: !condOf(when).outdoor, level: this.wildLevel(at.x, at.z, spawnPoint, SPECIES[species]) });
    return true;
  }

  // Further from the spawn point = tougher creatures (extra: cave creatures get +3).
  wildLevel(x, z, spawnPoint, sp, extra = 0) {
    const far = Math.hypot(x - spawnPoint.x, z - spawnPoint.z);
    const rare = sp.baseXp > 100 ? 3 : 0;
    return Math.min(40 + this.levelBonus, Math.max(2, Math.floor(1 + far / 10 + rare + Math.random() * 3) + this.levelBonus + (this.world?.realm?.levelBonus ?? 0)) + extra); // T35: a realm may toughen its wild creatures
  }

  // Puts a creature at the world cell (x, y, z) (y = the standing height, an integer for Camo creatures).
  // Camo creatures (species.disguise) are dressed as the local block: no spawn (null) if there is no room
  // for it or the block is not around. Never changes the world. Returns the Wild, or null.
  spawnAt(species, x, y, z, { when, cave = false, indoor = false, level = 5 } = {}) {
    const d = SPECIES[species].disguise;
    const size = d ? d.size || 1 : 0;
    let block = null;
    if (d) {
      x = Math.floor(x); y = Math.round(y); z = Math.floor(z);
      if (!Disguise.fits(this.world, x, y, z, size, size)) return null;
      block = Disguise.pick(this.world, x, y, z, d.blocks);
      if (block === null) return null;
    }
    const model = buildModel(species);
    const pos = d ? new THREE.Vector3(x + size / 2, y, z + size / 2) : new THREE.Vector3(x + 0.5, y, z + 0.5);
    const wild = new Wild(makeCreature(species, level), model, pos);
    wild.when = when;
    if (cave) wild.cave = true;
    if (indoor) wild.indoor = true; // T22: a home visitor walks on the floor like a cave creature, under any roof
    if (d) {
      wild.heading = 0;
      wild.size = size;
      wild.disguise = new Disguise(this.world, block, { w: size });
      wild.disguise.setLight(x, y, z);
      model.add(wild.disguise.group);
      model.userData.parts.root.visible = false;
    }
    model.position.copy(pos);
    this.scene.add(model);
    this.list.push(wild);
    this.onSpawn?.(wild);
    return wild;
  }

  /* ==== T36 parkour ==== */
  // A perch at column (x, z): { x, y, z } = the air cell to stand in, or null. Something stands on the land (3+ above the
  // natural ground: treetops, tall cacti, roofs, pillars; hills never count); ground blocks only count when the player
  // built them (a gym builder's slopes and frozen lakes do not); never water, a gym or tower, or a realm.
  isPerch(x, z) {
    const world = this.world;
    if (!world || world.realm || x < 1 || z < 1 || x >= world.W - 1 || z >= world.D - 1) return null;
    const s = world.surface(x, z);
    if (s.y < 0 || s.id === B.WATER || !isSolid(s.id)) return null;
    if (s.y - world.ground[x + z * world.W] < PERCH_UP) return null;
    if (GROUND.has(s.id) && !world.edits.has(world.index(x, s.y, z))) return null;
    if (s.y + 2 >= WORLD_H || world.fenced(x, s.y + 1, z)) return null;
    return { x, y: s.y + 1, z };
  }

  // Up to 16 random columns 8-24 blocks from the player (close enough to see, not in your face): the first perch, or null.
  perchNear(pos) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 16;
      const at = this.isPerch(Math.floor(pos.x + Math.cos(a) * d), Math.floor(pos.z + Math.sin(a) * d));
      if (at) return at;
    }
    return null;
  }
  /* ==== end of T36 parkour ==== */

  // Cave creatures: a standing place underground near the player (air with floor below and room above).
  trySpawnCave(center, spawnPoint, night = false) {
    const world = this.world;
    const angle = Math.random() * Math.PI * 2, dist = 5 + Math.random() * 13;
    const ctx = CreatureManager.asCtx(night);
    const [species, when] = this.pickEntry('cave', ctx);
    if (this.spawnPlaced(species, when, ctx, spawnPoint)) return; // a home visitor (T22): appears in its home
    const x = Math.floor(center.x + Math.cos(angle) * dist), z = Math.floor(center.z + Math.sin(angle) * dist);
    if (x < 2 || z < 2 || x >= this.world.W - 2 || z >= this.world.D - 2) return;
    const y0 = Math.floor(center.y) + Math.floor(Math.random() * 11) - 5;
    const ground = world.ground[x + z * world.W];
    for (let y = Math.min(y0 + 4, WORLD_H - 3); y >= Math.max(1, y0 - 6); y--) {
      if (world.get(x, y, z) !== B.AIR || world.get(x, y + 1, z) !== B.AIR) continue;
      const below = world.get(x, y - 1, z);
      if (below === B.AIR || below === B.WATER || !isSolid(below)) continue;
      if (world.skyAt(x, y, z) >= 0.5 || y >= ground - 2) continue;
      const sp = SPECIES[species];
      if (sp.waterOnly) return;
      this.spawnAt(species, x, y, z, { when, cave: true, level: this.wildLevel(x, z, spawnPoint, sp, 3) });
      return;
    }
  }

  // Where a cave creature may stand at (x, z), near height fromY: { y, ceiling } or null.
  // underOnly = false (home visitors): a floor under the open sky or a roof is fine too.
  caveGroundY(x, z, fromY, underOnly = true) {
    const world = this.world;
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 1 || zi < 1 || xi >= this.world.W - 1 || zi >= this.world.D - 1) return null;
    const ground = world.ground[xi + zi * world.W];
    for (let y = Math.floor(fromY) + 1; y >= Math.floor(fromY) - 3; y--) {
      if (!isSolid(world.get(xi, y - 1, zi)) || world.get(xi, y, zi) !== B.AIR || isSolid(world.get(xi, y + 1, zi))) continue;
      if (underOnly && y >= ground - 1) return null;
      let ceiling = y + 6;
      for (let k = 1; k <= 6; k++) if (isSolid(world.get(xi, y + k, zi))) { ceiling = y + k; break; }
      return { y, ceiling };
    }
    return null;
  }

  remove(wild) {
    this.list = this.list.filter(w => w !== wild);
    wild.disguise?.dispose(); // first: disposeModel would free the world's shared block material
    this.scene.remove(wild.model);
    disposeModel(wild.model);
  }

  update(dt, playerPos, spawnPoint, night = false, under = this.world.underground(playerPos) || this.world.inLitRoom(playerPos)) {
    this.viewer = playerPos;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.6;
      const ctx = this.context(playerPos, night, under);
      if (this.list.length < MAX_WILD) {
        if (under) for (let i = 0; i < 4; i++) this.trySpawnCave(playerPos, spawnPoint, ctx);
        else this.trySpawn(playerPos, spawnPoint, ctx);
      }
      // Creatures wander off: when far away, after a while, or (for day- or night-only ones) when
      // the time of day changes. Never right next to the player, so nobody vanishes in front of you.
      for (const w of this.list) {
        if (w.frozen) continue;
        const d = w.pos.distanceTo(playerPos);
        const wrongTime = !condOk(w.when, ctx) || (!w.indoor && !!w.cave !== under);
        if (d > 60 || (d > 10 && (w.life <= 0 || wrongTime))) { this.remove(w); break; }
      }
    }
    for (const w of [...this.list]) {
      this.updateOne(w, dt);
      // Walking into a disguised creature finds it (otherwise you could walk through a "block").
      if (w.disguise && !w.frozen && this.onBump) {
        const half = w.size / 2 + 0.4, dy = playerPos.y - w.pos.y;
        if (Math.abs(playerPos.x - w.pos.x) < half && Math.abs(playerPos.z - w.pos.z) < half && dy >= 0 && dy < w.size + 1) this.onBump(w);
      }
      // T36: a gait creature (Parkour) starts a battle when you START touching it, so a fled battle does not restart at once.
      else if (GAITS[w.species.gait]?.bump && !w.frozen && this.onBump) {
        const dy = playerPos.y - w.pos.y;
        const touching = Math.abs(playerPos.x - w.pos.x) < 0.9 && Math.abs(playerPos.z - w.pos.z) < 0.9 && dy >= -1 && dy < 1.5;
        const start = touching && !w.touching;
        w.touching = touching;
        if (start) this.onBump(w);
      }
      // Sound-type creatures sing now and then, so you can hear them before you see them.
      if (w.species.type === 'sound' && !w.frozen && (w.songTimer = (w.songTimer ?? Math.random() * 3) - dt) <= 0) {
        w.songTimer = 5 + Math.random() * 4;
        const d = w.pos.distanceTo(playerPos);
        if (d < SING_RANGE) {
          this.showNotes(w);
          this.onSing?.(w, Math.min(1, 1 - 0.4 * (d - 6) / (SING_RANGE - 6))); // full volume up close
        }
      }
    }
    this.updateNotes(dt);
    this.updatePuffs(dt); // T37
  }

  // Little glowing music notes that float up from a singing creature.
  showNotes(w) {
    for (let i = 0; i < 3; i++) {
      const note = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: [0x4fd8c4, 0xffd84a, 0xff8ac8][i], transparent: true });
      note.add(new THREE.Mesh(NOTE_HEAD, mat), new THREE.Mesh(NOTE_STEM, mat));
      note.position.set(w.pos.x + (i - 1) * 0.35, w.pos.y + 1.2, w.pos.z);
      this.scene.add(note);
      this.notes.push({ note, mat, t: -i * 0.25, x: (i - 1) * 0.35 });
    }
  }

  updateNotes(dt) {
    for (const n of this.notes) {
      n.t += dt;
      const k = Math.max(0, n.t) / 2;
      n.note.position.y += dt * 0.7;
      n.note.position.x += Math.sin(n.t * 5) * dt * 0.4;
      n.note.lookAt(n.note.position.x, n.note.position.y, n.note.position.z + 1);
      n.note.visible = n.t >= 0;
      n.mat.opacity = 1 - k;
    }
    for (const n of this.notes.filter(n => n.t >= 2)) {
      this.scene.remove(n.note);
      n.mat.dispose();
    }
    this.notes = this.notes.filter(n => n.t < 2);
  }

  updateOne(w, dt) {
    w.t += dt;
    w.life -= dt;
    const sp = w.species;
    if (w.popT >= 0) { // the little pop when a Camo creature jumps out of its disguise
      w.popT += dt;
      const k = Math.min(1, w.popT / 0.3);
      w.model.userData.parts.root.scale.setScalar(k < 0.7 ? 0.3 + (1.1 - 0.3) * (k / 0.7) : 1.1 - 0.1 * ((k - 0.7) / 0.3));
      if (k >= 1) w.popT = -1;
    }
    if (w.disguise) { // a block: only blinks
      w.disguise.update(dt, this.viewer);
      w.model.rotation.y = 0;
      return;
    }
    if (w.frozen || w.still) { // battling, or a Camo creature idling in place
      animateModel(w.model, w.t, false);
      w.model.rotation.y = w.heading;
      if (sp.gait) w.model.scale.set(1, 1, 1); // T36: no panting in a battle
      if (w.blink) this.endBlink(w); // T37: never stuck invisible
      return;
    }
    if (sp.gait) return this.updateGait(w, dt); // T36
    w.timer -= dt;
    if (w.timer <= 0) {
      if (w.mode === 'walk') { w.mode = 'idle'; w.timer = 1 + Math.random() * 3; }
      else { w.mode = 'walk'; w.heading = Math.random() * Math.PI * 2; w.timer = 1 + Math.random() * 3; }
    }
    if (w.mode === 'walk') {
      const speed = sp.flies ? 2.2 : 1.3;
      const nx = w.pos.x + Math.sin(w.heading) * speed * dt;
      const nz = w.pos.z + Math.cos(w.heading) * speed * dt;
      const floor = w.cave || w.indoor;
      const cave = floor ? this.caveGroundY(nx, nz, w.pos.y, !w.indoor) : null;
      const gy = floor ? cave && cave.y : this.groundY(nx, nz, sp);
      if (gy !== null && (sp.flies || sp.floats || gy - w.pos.y <= 1.1)) { w.pos.x = nx; w.pos.z = nz; }
      else w.heading += Math.PI * (0.5 + Math.random());
    }
    let target;
    if (w.cave || w.indoor) {
      const here = this.caveGroundY(w.pos.x, w.pos.z, w.pos.y, !w.indoor);
      target = here ? here.y : w.pos.y;
      if (here && (sp.flies || sp.floats)) target = Math.min(here.y + 1.2, here.ceiling - 1);
      if (here && sp.flies) target += Math.sin(w.t * 1.5) * 0.15;
    } else {
      target = this.groundY(w.pos.x, w.pos.z, sp) ?? w.pos.y;
      if (sp.flies) target += 1.2 + Math.sin(w.t * 1.5) * 0.25;
    }
    w.pos.y += (target - w.pos.y) * Math.min(1, dt * 10);
    w.model.position.copy(w.pos);
    w.model.rotation.y = w.heading;
    animateModel(w.model, w.t, w.mode === 'walk');
  }

  /* ==== T36 parkour ==== */
  // Where a hop from the cell (x0, y0, z0) to the column (cx, cz) lands: the standing y, or null. Never into water, at most
  // g.up up and g.down down; a creature on a perch may also drop up to g.leap, but only onto the natural ground.
  hopLanding(g, x0, y0, z0, cx, cz, perched) {
    const world = this.world;
    if (cx < 1 || cz < 1 || cx >= world.W - 1 || cz >= world.D - 1) return null;
    const lowest = y0 - (perched ? g.leap : g.down);
    for (let y = y0 + g.up; y >= Math.max(1, lowest); y--) {
      const here = world.get(cx, y, cz), below = world.get(cx, y - 1, cz);
      if (here === B.WATER || below === B.WATER) return null; // never into water
      if (here !== B.AIR || world.get(cx, y + 1, cz) !== B.AIR || !isSolid(below)) continue;
      if (y0 - y > g.down && y - 1 > world.ground[cx + cz * world.W]) return null; // a long drop: only down to the natural ground
      if (world.fenced(cx, y, cz)) return null;
      // the arc is free: the 1-2 columns between start and landing have room
      for (const f of [1 / 3, 2 / 3]) {
        const mx = Math.floor(x0 + (cx + 0.5 - x0) * f), mz = Math.floor(z0 + (cz + 0.5 - z0) * f);
        if ((mx === Math.floor(x0) && mz === Math.floor(z0)) || (mx === cx && mz === cz)) continue;
        const top = Math.max(y0, y);
        if (world.get(mx, top + 1, mz) !== B.AIR || world.get(mx, top + 2, mz) !== B.AIR) return null;
      }
      return y;
    }
    return null;
  }

  // The hop away from the player: { x, y, z } (cell centre) or null when cornered.
  chooseHop(w, g, p) {
    const x0 = Math.floor(w.pos.x), z0 = Math.floor(w.pos.z), y0 = Math.round(w.pos.y);
    let ax = w.pos.x - p.x, az = w.pos.z - p.z;
    const len = Math.hypot(ax, az);
    if (len < 0.01) { ax = Math.sin(w.heading); az = Math.cos(w.heading); } else { ax /= len; az /= len; }
    const here = Math.hypot(p.x - w.pos.x, p.z - w.pos.z);
    const perched = !!this.isPerch(x0, z0);
    for (const deg of g.angles) {
      const r = deg * Math.PI / 180, dx = ax * Math.cos(r) - az * Math.sin(r), dz = ax * Math.sin(r) + az * Math.cos(r);
      for (const dist of g.hops) {
        const cx = Math.floor(w.pos.x + dx * dist), cz = Math.floor(w.pos.z + dz * dist);
        if (cx === x0 && cz === z0) continue;
        if (Math.hypot(cx + 0.5 - w.home.x, cz + 0.5 - w.home.z) > g.leash) continue;
        if (Math.hypot(p.x - (cx + 0.5), p.z - (cz + 0.5)) < here) continue; // never towards you
        const y = this.hopLanding(g, w.pos.x, y0, w.pos.z, cx, cz, perched);
        if (y !== null) return { x: cx + 0.5, y, z: cz + 0.5 };
      }
    }
    return null;
  }

  // A creature with a gait (species.gait): it stands on leaves, roofs and pillars, so it uses no ground lookups.
  updateGait(w, dt) {
    if (w.species.gait === 'blink') return this.updateBlink(w, dt); // T37
    const g = GAITS[w.species.gait], p = this.viewer, model = w.model;
    let moving = false, panting = false;
    const dx = p ? p.x - w.pos.x : 0, dz = p ? p.z - w.pos.z : 0, dist = Math.hypot(dx, dz);
    if (w.hop) { // the hop is closed form: any dt lands exactly on the cell
      const h = w.hop;
      h.t += dt;
      const k = Math.min(1, h.t / g.time), arc = g.arc + Math.max(0, h.to.y - h.from.y);
      w.pos.set(h.from.x + (h.to.x - h.from.x) * k, h.from.y + (h.to.y - h.from.y) * k + 4 * arc * k * (1 - k), h.from.z + (h.to.z - h.from.z) * k);
      moving = true;
      if (k >= 1) {
        w.pos.set(h.to.x, h.to.y, h.to.z);
        w.hop = null;
        w.pause = g.pause;
        if (++w.hops >= g.tiredAfter) this.getTired(w, g, dist);
      }
    } else if (w.tired > 0) {
      w.tired -= dt;
      panting = true;
      if (w.tired <= 0) { w.tired = 0; w.hops = 0; panting = false; }
    } else if (p) {
      w.pause = Math.max(0, w.pause - dt);
      const near = dist <= g.notice && Math.abs(p.y - w.pos.y) <= g.noticeUp;
      if (near) {
        const want = Math.atan2(dx, dz);
        if (w.pause > 0) w.heading = want; // it looks back at you between hops
        else {
          const to = this.chooseHop(w, g, p);
          if (!to) this.getTired(w, g, dist); // cornered: it gives up
          else {
            w.hop = { from: w.pos.clone(), to, t: 0 };
            w.heading = Math.atan2(to.x - w.pos.x, to.z - w.pos.z);
          }
        }
      } else if (dist < g.notice * 3) { // idle: slowly turns to look at you
        let d = Math.atan2(dx, dz) - w.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        w.heading += Math.sign(d) * Math.min(Math.abs(d), dt * 2);
      }
    }
    if (panting) {
      const s = Math.abs(Math.sin(w.t * 10));
      model.scale.set(1 + 0.03 * s, 1 - 0.06 * s, 1 + 0.03 * s);
    } else if (model.scale.x !== 1 || model.scale.y !== 1) model.scale.set(1, 1, 1);
    model.position.copy(w.pos);
    model.rotation.y = w.heading;
    animateModel(model, w.t, moving);
  }

  getTired(w, g, dist) {
    w.tired = g.tired;
    w.hop = null;
    if (dist <= TIRED_RANGE) this.onTired?.(w);
  }
  /* ==== end of T36 parkour ==== */

  /* ==== T37 ninja ==== */
  // Where a blink to the column (cx, cz) lands, from standing height y0: the standing y, or null. Air for the body and the
  // head, something solid to stand on, no water, no gym, at most g.up higher and g.down lower (so never off a cliff).
  blinkLanding(g, y0, cx, cz) {
    const world = this.world;
    if (cx < 1 || cz < 1 || cx >= world.W - 1 || cz >= world.D - 1) return null;
    for (let y = Math.min(y0 + g.up, WORLD_H - 3); y >= Math.max(1, y0 - g.down); y--) {
      const here = world.get(cx, y, cz), below = world.get(cx, y - 1, cz);
      if (here === B.WATER || below === B.WATER) return null;
      if (here !== B.AIR || world.get(cx, y + 1, cz) !== B.AIR || !isSolid(below)) continue;
      return world.fenced(cx, y, cz) ? null : y;
    }
    return null;
  }

  // The spot it blinks to: { x, y, z } (a cell centre) away from the player, or null when there is none. Fixed angles
  // and distances; every other blink tries the angles mirrored, so it zigzags instead of running in a line.
  chooseBlink(w, g, p) {
    const x0 = Math.floor(w.pos.x), z0 = Math.floor(w.pos.z), y0 = Math.round(w.pos.y);
    let ax = w.pos.x - p.x, az = w.pos.z - p.z;
    const len = Math.hypot(ax, az);
    if (len < 0.01) { ax = Math.sin(w.heading); az = Math.cos(w.heading); } else { ax /= len; az /= len; }
    const here = Math.hypot(p.x - w.pos.x, p.z - w.pos.z), flip = w.hops % 2 ? -1 : 1;
    for (const deg of g.angles) {
      const r = flip * deg * Math.PI / 180, dx = ax * Math.cos(r) - az * Math.sin(r), dz = ax * Math.sin(r) + az * Math.cos(r);
      for (const dist of g.dists) {
        const cx = Math.floor(w.pos.x + dx * dist), cz = Math.floor(w.pos.z + dz * dist);
        if (cx === x0 && cz === z0) continue;
        if (Math.hypot(cx + 0.5 - w.home.x, cz + 0.5 - w.home.z) > g.leash) continue;
        if (Math.hypot(p.x - (cx + 0.5), p.z - (cz + 0.5)) < here + 1) continue; // always further from you
        const y = this.blinkLanding(g, y0, cx, cz);
        if (y !== null) return { x: cx + 0.5, y, z: cz + 0.5 };
      }
    }
    return null;
  }

  // The Ninja walk. w.closing = how fast you are coming closer (blocks / s; a jump of more than g.teleport is ignored).
  updateBlink(w, dt) {
    const g = GAITS.blink, p = this.viewer, model = w.model;
    const dx = p ? p.x - w.pos.x : 0, dz = p ? p.z - w.pos.z : 0, dist = Math.hypot(dx, dz);
    let closing = 0;
    if (p && w.lastDist != null && dt > 0) closing = (w.lastDist - dist) / dt;
    if (closing > g.teleport) closing = 0;
    w.lastDist = p ? dist : null;
    w.closing = closing;
    let panting = false;
    if (w.blink) { // gone in the smoke: it shows up again after g.gone seconds
      w.blink.t += dt;
      if (w.blink.t >= g.gone) {
        this.endBlink(w);
        w.pause = g.pause;
        if (++w.hops >= g.tiredAfter) this.getTired(w, g, dist);
      }
    } else if (w.tired > 0) {
      w.tired -= dt;
      panting = true;
      if (w.tired <= 0) { w.tired = 0; w.hops = 0; panting = false; }
    } else if (p) {
      w.pause = Math.max(0, w.pause - dt);
      const near = dist <= g.notice && Math.abs(p.y - w.pos.y) <= g.noticeUp;
      if (near && closing >= g.fast && w.pause <= 0) {
        const to = this.chooseBlink(w, g, p);
        if (!to) this.getTired(w, g, dist); // nowhere to go: it gives up
        else {
          this.puff(w.pos);
          w.blink = { t: 0, from: w.pos.clone() };
          w.pos.set(to.x, to.y, to.z);
          w.lastDist = Math.hypot(p.x - w.pos.x, p.z - w.pos.z);
          model.visible = false;
          this.onBlink?.(w);
        }
      }
      if (dist < g.notice * 3) { // it turns to watch you
        let d = Math.atan2(dx, dz) - w.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        w.heading += Math.sign(d) * Math.min(Math.abs(d), dt * 3);
      }
    }
    if (panting) {
      const s = Math.abs(Math.sin(w.t * 10));
      model.scale.set(1 + 0.03 * s, 1 - 0.06 * s, 1 + 0.03 * s);
    } else if (model.scale.x !== 1 || model.scale.y !== 1) model.scale.set(1, 1, 1);
    model.position.copy(w.pos);
    model.rotation.y = w.heading;
    animateModel(model, w.t, false);
  }

  // Back from the smoke: visible again at its new spot, with a puff, facing the player.
  endBlink(w) {
    w.blink = null;
    w.model.visible = true;
    if (this.viewer) w.heading = Math.atan2(this.viewer.x - w.pos.x, this.viewer.z - w.pos.z);
    this.puff(w.pos);
  }

  // A small puff of smoke: PUFF_N grey cubes that swell, drift up and fade in PUFF_TIME s (closed form, no random).
  puff(at) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xd8d4e4, transparent: true, depthWrite: false });
    const g = new THREE.Group();
    for (let i = 0; i < PUFF_N; i++) g.add(new THREE.Mesh(PUFF_GEO, mat));
    g.position.set(at.x, at.y, at.z);
    this.scene.add(g);
    this.puffs.push({ g, mat, t: 0 });
    if (this.viewer && Math.hypot(this.viewer.x - at.x, this.viewer.z - at.z) < 20) sound.play('smokepuff');
  }

  updatePuffs(dt) {
    for (const f of this.puffs) {
      f.t += dt;
      const k = Math.min(1, f.t / PUFF_TIME);
      f.g.children.forEach((c, i) => {
        const a = (i / PUFF_N) * Math.PI * 2, r = 0.15 + 0.55 * k;
        c.position.set(Math.cos(a) * r, 0.2 + (i % 3) * 0.25 + 0.5 * k, Math.sin(a) * r);
        c.scale.setScalar(0.6 + 1.2 * k);
      });
      f.mat.opacity = 0.9 * (1 - k);
    }
    for (const f of this.puffs.filter(f => f.t >= PUFF_TIME)) { this.scene.remove(f.g); f.mat.dispose(); }
    this.puffs = this.puffs.filter(f => f.t < PUFF_TIME);
  }

  clearPuffs() {
    for (const f of this.puffs) { this.scene.remove(f.g); f.mat.dispose(); }
    this.puffs = [];
  }
  /* ==== end of T37 ninja ==== */

  // Creature under the crosshair, if any, within maxDist.
  pick(origin, dir, maxDist) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    // Raycasts ignore `visible`, so skip hidden parts (a disguised creature's real model, closed-eye sets).
    const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const hits = this.raycaster.intersectObjects(this.list.map(w => w.model), true).filter(h => shown(h.object));
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.wild) o = o.parent;
    return o ? { wild: o.userData.wild, dist: hits[0].distance } : null;
  }
}
