// Wild creatures roaming the world: spawning, wandering AI and targeting.
import * as THREE from 'three';
import { B } from './blocks.js';
import { WORLD_W, WORLD_D, WATER_LEVEL } from './world.js';
import { SPECIES, SPAWNS, makeCreature, buildModel, animateModel, disposeModel } from './species.js';

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
    model.userData.wild = this;
  }
  get species() { return SPECIES[this.data.species]; }
  face(target) { this.heading = Math.atan2(target.x - this.pos.x, target.z - this.pos.z); }
}

export class CreatureManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.spawnTimer = 0;
    this.notes = [];
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

  // Returns [species, when] where when is 'day', 'night' or undefined (any time).
  pickEntry(biome, night) {
    const table = SPAWNS[biome].filter(([, , when]) => !when || (when === 'night') === night);
    const total = table.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    for (const e of table) if ((r -= e[1]) < 0) return [e[0], e[2]];
    return [table[0][0], table[0][2]];
  }

  pickSpecies(biome, night) { return this.pickEntry(biome, night)[0]; }

  // Ground height a creature should stand at for column (x, z), or null if not walkable.
  groundY(x, z, sp) {
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 1 || zi < 1 || xi >= WORLD_W - 1 || zi >= WORLD_D - 1) return null;
    const s = this.world.surface(xi, zi);
    const airborne = sp.flies || sp.floats;
    if (s.id === B.WATER) return sp.swims || airborne ? WATER_LEVEL + 0.55 : null;
    // Only walk on natural ground (not trees, cacti, gyms or other buildings).
    if (!GROUND.has(s.id)) return airborne ? s.y + 1 : null;
    return s.y + 1;
  }

  trySpawn(center, spawnPoint, night) {
    const angle = Math.random() * Math.PI * 2;
    // Some close by (so a small place like a peak gets its own creatures), most a bit further out.
    const dist = Math.random() < 0.4 ? 9 + Math.random() * 8 : 14 + Math.random() * 22;
    const x = Math.floor(center.x + Math.cos(angle) * dist);
    const z = Math.floor(center.z + Math.sin(angle) * dist);
    if (x < 2 || z < 2 || x >= WORLD_W - 2 || z >= WORLD_D - 2) return;
    const biome = this.biomeAt(x, z);
    if (!biome) return;
    const [species, when] = this.pickEntry(biome, night);
    const sp = SPECIES[species];
    const y = this.groundY(x + 0.5, z + 0.5, sp);
    if (y === null) return;
    // Further from the spawn point = tougher creatures.
    const far = Math.hypot(x - spawnPoint.x, z - spawnPoint.z);
    const rare = sp.baseXp > 100 ? 3 : 0;
    const level = Math.min(40, Math.max(2, Math.floor(1 + far / 10 + rare + Math.random() * 3)));
    const model = buildModel(species);
    const wild = new Wild(makeCreature(species, level), model, new THREE.Vector3(x + 0.5, y, z + 0.5));
    wild.when = when;
    model.position.copy(wild.pos);
    this.scene.add(model);
    this.list.push(wild);
    this.onSpawn?.(wild);
  }

  remove(wild) {
    this.list = this.list.filter(w => w !== wild);
    this.scene.remove(wild.model);
    disposeModel(wild.model);
  }

  update(dt, playerPos, spawnPoint, night = false) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.6;
      if (this.list.length < MAX_WILD) this.trySpawn(playerPos, spawnPoint, night);
      // Creatures wander off: when far away, after a while, or (for day- or night-only ones) when
      // the time of day changes. Never right next to the player, so nobody vanishes in front of you.
      for (const w of this.list) {
        if (w.frozen) continue;
        const d = w.pos.distanceTo(playerPos);
        const wrongTime = w.when && (w.when === 'night') !== night;
        if (d > 60 || (d > 10 && (w.life <= 0 || wrongTime))) { this.remove(w); break; }
      }
    }
    for (const w of this.list) {
      this.updateOne(w, dt);
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
    if (w.frozen) {
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
      const gy = this.groundY(nx, nz, sp);
      if (gy !== null && (sp.flies || sp.floats || gy - w.pos.y <= 1.1)) { w.pos.x = nx; w.pos.z = nz; }
      else w.heading += Math.PI * (0.5 + Math.random());
    }
    let target = this.groundY(w.pos.x, w.pos.z, sp) ?? w.pos.y;
    if (sp.flies) target += 1.2 + Math.sin(w.t * 1.5) * 0.25;
    w.pos.y += (target - w.pos.y) * Math.min(1, dt * 10);
    w.model.position.copy(w.pos);
    w.model.rotation.y = w.heading;
    animateModel(w.model, w.t, w.mode === 'walk');
  }

  // Creature under the crosshair, if any, within maxDist.
  pick(origin, dir, maxDist) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObjects(this.list.map(w => w.model), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.wild) o = o.parent;
    return o ? { wild: o.userData.wild, dist: hits[0].distance } : null;
  }
}
