// Wild creatures roaming the world: spawning, wandering AI and targeting.
import * as THREE from 'three';
import { B, BLOCKS, isSolid } from './blocks.js';
import { WORLD_W, WORLD_D, WORLD_H, WATER_LEVEL } from './world.js';
import { SPECIES, SPAWNS, makeCreature, buildModel, animateModel, disposeModel } from './species.js';
import { condOf, condOk, goldenHour, isEvening, TOGETHER_RANGE, HOME_RANGE } from './spawnrules.js';
import { Disguise } from './disguise.js';
import { sound } from './sound.js';

const MAX_WILD = 16;
const SING_RANGE = 18;
const NOTE_HEAD = new THREE.BoxGeometry(0.18, 0.14, 0.04);
const NOTE_STEM = new THREE.BoxGeometry(0.04, 0.34, 0.04).translate(0.07, 0.17, 0);
const GROUND = new Set([B.GRASS, B.DIRT, B.SAND, B.STONE, B.SNOW, B.COBBLE, B.ICE, B.GRAVEL, B.MUD, B.SANDSTONE]);

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
    this.raycaster = new THREE.Raycaster();
  }

  setWorld(world) {
    this.clear();
    this.world = world;
  }

  clear() {
    for (const w of [...this.list]) this.remove(w);
  }

  biomeAt(x, z) {
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
      homes: under || !env?.homes ? [] : env.homes().filter(h => Math.hypot(h.x - playerPos.x, h.z - playerPos.z) <= HOME_RANGE),
      friendsNear: !!env && env.friends().some(p => Math.hypot(p.x - playerPos.x, p.z - playerPos.z) <= TOGETHER_RANGE),
    };
  }

  count(cond) { return this.list.filter(w => w.when === cond).length; }

  // Spawn table entries with their weights, after the weather's boosts: [[entry, weight], ...].
  // Conditions with a `share` (dawn, dusk, together) are not here: pickEntry draws them separately.
  weights(biome, ctx) {
    ctx = CreatureManager.asCtx(ctx);
    const wx = this.weather;
    return SPAWNS[biome].filter(([, , when]) => condOk(when, ctx) && !condOf(when)?.share)
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
    for (const e of SPAWNS[biome]) {
      const cond = e[2];
      const def = condOf(cond);
      if (!def?.share || done.has(cond)) continue;
      done.add(cond);
      if (!condOk(cond, ctx) || this.count(cond) >= (def.max ?? Infinity)) continue;
      const share = typeof def.share === 'function' ? def.share(ctx, cond.split(':')[1]) : def.share;
      if (Math.random() >= share) continue;
      const table = SPAWNS[biome].filter(x => x[2] === cond).map(x => [x, x[1] * (wx ? wx.boost(biome, SPECIES[x[0]].type) : 1)]);
      return this.pickFrom(table);
    }
    return this.pickFrom(this.weights(biome, ctx));
  }

  pickSpecies(biome, ctx) { return this.pickEntry(biome, ctx)[0]; }

  // Ground height a creature should stand at for column (x, z), or null if not walkable.
  groundY(x, z, sp) {
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 1 || zi < 1 || xi >= WORLD_W - 1 || zi >= WORLD_D - 1) return null;
    const s = this.world.surface(xi, zi);
    const airborne = sp.flies || sp.floats;
    if (s.id === B.WATER) return sp.swims || airborne ? WATER_LEVEL + 0.55 : null;
    if (sp.waterOnly) return null; // fish stay in the water
    // Only walk on natural ground (not trees, cacti, gyms or other buildings).
    if (!GROUND.has(s.id)) return airborne ? s.y + 1 : null;
    return s.y + 1;
  }

  trySpawn(center, spawnPoint, night) {
    const ctx = CreatureManager.asCtx(night);
    const angle = Math.random() * Math.PI * 2;
    // Some close by (so a small place like a peak gets its own creatures), most a bit further out.
    const dist = Math.random() < 0.4 ? 9 + Math.random() * 8 : 14 + Math.random() * 22;
    const x = Math.floor(center.x + Math.cos(angle) * dist);
    const z = Math.floor(center.z + Math.sin(angle) * dist);
    if (x < 2 || z < 2 || x >= WORLD_W - 2 || z >= WORLD_D - 2) return;
    const biome = this.biomeAt(x, z);
    if (!biome) return;
    const [species, when] = this.pickEntry(biome, ctx);
    // A condition with a `place` (near a home) says where the creature appears.
    const place = condOf(when)?.place;
    if (place) {
      const at = place(ctx, when.split(':')[1]);
      if (at) this.spawnAt(species, at.x, at.y, at.z, { when, level: this.wildLevel(at.x, at.z, spawnPoint, SPECIES[species]) });
      return;
    }
    const sp = SPECIES[species];
    const y = this.groundY(x + 0.5, z + 0.5, sp);
    if (y === null) return;
    this.spawnAt(species, x, y, z, { when, level: this.wildLevel(x, z, spawnPoint, sp) });
  }

  // Further from the spawn point = tougher creatures (extra: cave creatures get +3).
  wildLevel(x, z, spawnPoint, sp, extra = 0) {
    const far = Math.hypot(x - spawnPoint.x, z - spawnPoint.z);
    const rare = sp.baseXp > 100 ? 3 : 0;
    return Math.min(40 + this.levelBonus, Math.max(2, Math.floor(1 + far / 10 + rare + Math.random() * 3) + this.levelBonus) + extra);
  }

  // Puts a creature at the world cell (x, y, z) (y = the standing height, an integer for Camo creatures).
  // Camo creatures (species.disguise) are dressed as the local block: no spawn (null) if there is no room
  // for it or the block is not around. Never changes the world. Returns the Wild, or null.
  spawnAt(species, x, y, z, { when, cave = false, level = 5 } = {}) {
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

  // Cave creatures: a standing place underground near the player (air with floor below and room above).
  trySpawnCave(center, spawnPoint, night = false) {
    const world = this.world;
    const angle = Math.random() * Math.PI * 2, dist = 5 + Math.random() * 13;
    const x = Math.floor(center.x + Math.cos(angle) * dist), z = Math.floor(center.z + Math.sin(angle) * dist);
    if (x < 2 || z < 2 || x >= WORLD_W - 2 || z >= WORLD_D - 2) return;
    const y0 = Math.floor(center.y) + Math.floor(Math.random() * 11) - 5;
    const ground = world.ground[x + z * WORLD_W];
    for (let y = Math.min(y0 + 4, WORLD_H - 3); y >= Math.max(1, y0 - 6); y--) {
      if (world.get(x, y, z) !== B.AIR || world.get(x, y + 1, z) !== B.AIR) continue;
      const below = world.get(x, y - 1, z);
      if (below === B.AIR || below === B.WATER || !isSolid(below)) continue;
      if (world.skyAt(x, y, z) >= 0.5 || y >= ground - 2) continue;
      const [species, when] = this.pickEntry('cave', CreatureManager.asCtx(night));
      const sp = SPECIES[species];
      if (sp.waterOnly) return;
      this.spawnAt(species, x, y, z, { when, cave: true, level: this.wildLevel(x, z, spawnPoint, sp, 3) });
      return;
    }
  }

  // Where a cave creature may stand at (x, z), near height fromY: { y, ceiling } or null.
  caveGroundY(x, z, fromY) {
    const world = this.world;
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 1 || zi < 1 || xi >= WORLD_W - 1 || zi >= WORLD_D - 1) return null;
    const ground = world.ground[xi + zi * WORLD_W];
    for (let y = Math.floor(fromY) + 1; y >= Math.floor(fromY) - 3; y--) {
      if (!isSolid(world.get(xi, y - 1, zi)) || world.get(xi, y, zi) !== B.AIR || isSolid(world.get(xi, y + 1, zi))) continue;
      if (y >= ground - 1) return null;
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
        const wrongTime = !condOk(w.when, ctx) || !!w.cave !== under;
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
      return;
    }
    w.timer -= dt;
    if (w.timer <= 0) {
      if (w.mode === 'walk') { w.mode = 'idle'; w.timer = 1 + Math.random() * 3; }
      else { w.mode = 'walk'; w.heading = Math.random() * Math.PI * 2; w.timer = 1 + Math.random() * 3; }
    }
    if (w.mode === 'walk') {
      const speed = sp.flies ? 2.2 : 1.3;
      const nx = w.pos.x + Math.sin(w.heading) * speed * dt;
      const nz = w.pos.z + Math.cos(w.heading) * speed * dt;
      const cave = w.cave ? this.caveGroundY(nx, nz, w.pos.y) : null;
      const gy = w.cave ? cave && cave.y : this.groundY(nx, nz, sp);
      if (gy !== null && (sp.flies || sp.floats || gy - w.pos.y <= 1.1)) { w.pos.x = nx; w.pos.z = nz; }
      else w.heading += Math.PI * (0.5 + Math.random());
    }
    let target;
    if (w.cave) {
      const here = this.caveGroundY(w.pos.x, w.pos.z, w.pos.y);
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
