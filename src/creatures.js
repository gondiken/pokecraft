// Wild creatures roaming the world: spawning, wandering AI and targeting.
import * as THREE from 'three';
import { B } from './blocks.js';
import { WORLD_W, WORLD_D, WATER_LEVEL } from './world.js';
import { SPECIES, SPAWNS, makeCreature, buildModel, animateModel, disposeModel } from './species.js';

const MAX_WILD = 16;

export class Wild {
  constructor(data, model, pos) {
    this.data = data;
    this.model = model;
    this.pos = pos;
    this.heading = Math.random() * Math.PI * 2;
    this.mode = 'idle';
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
    const s = this.world.surface(x, z);
    if (s.id === B.WATER) return 'water';
    if (s.id === B.SAND) return 'beach';
    if (s.id === B.STONE || s.y >= 24) return 'mountain';
    if (s.id !== B.GRASS) return null;
    return this.world.forestAt(x, z) ? 'forest' : 'plains';
  }

  pickSpecies(biome) {
    const table = SPAWNS[biome];
    const total = table.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    for (const [id, w] of table) if ((r -= w) < 0) return id;
    return table[0][0];
  }

  // Ground height a creature should stand at for column (x, z), or null if not walkable.
  groundY(x, z, sp) {
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 1 || zi < 1 || xi >= WORLD_W - 1 || zi >= WORLD_D - 1) return null;
    const s = this.world.surface(xi, zi);
    if (s.id === B.LEAVES || s.id === B.LOG) return sp.flies ? s.y + 1 : null;
    if (s.id === B.WATER) return sp.swims || sp.flies ? WATER_LEVEL + 0.55 : null;
    return s.y + 1;
  }

  trySpawn(center, spawnPoint) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 22;
    const x = Math.floor(center.x + Math.cos(angle) * dist);
    const z = Math.floor(center.z + Math.sin(angle) * dist);
    if (x < 2 || z < 2 || x >= WORLD_W - 2 || z >= WORLD_D - 2) return;
    const biome = this.biomeAt(x, z);
    if (!biome) return;
    const species = this.pickSpecies(biome);
    const sp = SPECIES[species];
    const y = this.groundY(x + 0.5, z + 0.5, sp);
    if (y === null) return;
    // Further from the spawn point = tougher creatures.
    const far = Math.hypot(x - spawnPoint.x, z - spawnPoint.z);
    const rare = sp.baseXp > 100 ? 3 : 0;
    const level = Math.min(40, Math.max(2, Math.floor(2 + far / 16 + rare + Math.random() * 2)));
    const model = buildModel(species);
    const wild = new Wild(makeCreature(species, level), model, new THREE.Vector3(x + 0.5, y, z + 0.5));
    model.position.copy(wild.pos);
    this.scene.add(model);
    this.list.push(wild);
  }

  remove(wild) {
    this.list = this.list.filter(w => w !== wild);
    this.scene.remove(wild.model);
    disposeModel(wild.model);
  }

  update(dt, playerPos, spawnPoint) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.6;
      if (this.list.length < MAX_WILD) this.trySpawn(playerPos, spawnPoint);
      for (const w of this.list) {
        if (!w.frozen && w.pos.distanceTo(playerPos) > 60) { this.remove(w); break; }
      }
    }
    for (const w of this.list) this.updateOne(w, dt);
  }

  updateOne(w, dt) {
    w.t += dt;
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
      if (gy !== null && (sp.flies || gy - w.pos.y <= 1.1)) { w.pos.x = nx; w.pos.z = nz; }
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
