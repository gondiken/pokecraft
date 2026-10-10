// Voxel world: terrain generation, block storage and chunked meshing.
import * as THREE from 'three';
import { B, BLOCKS, WOOL, TILE_COUNT, isOccluder, isSolid } from './blocks.js';
import { GYMS } from './gyms.js';

export const WORLD_W = 192;
export const WORLD_D = 192;
export const WORLD_H = 48;
export const CHUNK = 16;
export const WATER_LEVEL = 12;

function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, z, seed, octaves = 4) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// Each face: direction, brightness, kind, and 4 corners as [x, y, z, u, v].
const FACES = [
  { dir: [-1, 0, 0], shade: 0.62, kind: 'side', corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], shade: 0.62, kind: 'side', corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.32, kind: 'bottom', corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], shade: 1.0, kind: 'top', corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], shade: 0.45, kind: 'side', corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], shade: 0.45, kind: 'side', corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];

function newBuffers() { return { pos: [], uv: [], col: [], idx: [] }; }

export class World {
  constructor(seed, scene, materials) {
    this.seed = seed;
    this.scene = scene;
    this.materials = materials;
    this.data = new Uint8Array(WORLD_W * WORLD_D * WORLD_H);
    this.edits = new Map();
    this.dirty = new Set();
    this.meshes = new Map();
    this.gyms = [];
  }

  index(x, y, z) { return x + WORLD_W * (z + WORLD_D * y); }

  inBounds(x, y, z) {
    return x >= 0 && z >= 0 && y >= 0 && x < WORLD_W && z < WORLD_D && y < WORLD_H;
  }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return B.AIR;
    return this.data[this.index(x, y, z)];
  }

  // Collision query; the world edges and floor act as walls.
  isSolid(x, y, z) {
    if (x < 0 || z < 0 || x >= WORLD_W || z >= WORLD_D || y < 0) return true;
    return isSolid(this.get(x, y, z));
  }

  set(x, y, z, id, record = true) {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    this.data[i] = id;
    if (!record) return;
    this.edits.set(i, id);
    const cx = x >> 4, cz = z >> 4;
    this.dirty.add(`${cx},${cz}`);
    if ((x & 15) === 0) this.dirty.add(`${cx - 1},${cz}`);
    if ((x & 15) === 15) this.dirty.add(`${cx + 1},${cz}`);
    if ((z & 15) === 0) this.dirty.add(`${cx},${cz - 1}`);
    if ((z & 15) === 15) this.dirty.add(`${cx},${cz + 1}`);
  }

  terrainHeight(x, z) {
    const n = fbm(x / 56, z / 56, this.seed, 4);
    const m = fbm(x / 24 + 500, z / 24 + 500, this.seed + 7, 3);
    return Math.floor(4 + n * 21 + Math.max(0, m - 0.55) * 34);
  }

  forestAt(x, z) { return fbm(x / 36, z / 36, this.seed + 33, 2) > 0.56; }

  generate() {
    for (let x = 0; x < WORLD_W; x++) {
      for (let z = 0; z < WORLD_D; z++) {
        const h = Math.min(this.terrainHeight(x, z), WORLD_H - 10);
        const beach = h <= WATER_LEVEL + 1;
        const rocky = h >= 25;
        const snowy = h >= 29;
        for (let y = 0; y <= Math.max(h, WATER_LEVEL); y++) {
          let id;
          if (y > h) id = B.WATER;
          else if (y === h) id = beach ? B.SAND : snowy ? B.SNOW : rocky ? B.STONE : B.GRASS;
          else if (y > h - 4) id = beach ? B.SAND : rocky ? B.STONE : B.DIRT;
          else id = B.STONE;
          this.data[this.index(x, y, z)] = id;
        }
      }
    }
    // Trees
    for (let x = 3; x < WORLD_W - 3; x++) {
      for (let z = 3; z < WORLD_D - 3; z++) {
        const chance = this.forestAt(x, z) ? 0.05 : 0.004;
        if (hash2(x, z, this.seed + 99) >= chance) continue;
        const s = this.surface(x, z);
        if (s.id !== B.GRASS) continue;
        this.placeTree(x, s.y + 1, z);
      }
    }
    this.placeGyms();
  }

  // Gyms sit on a spiral around the middle of the map, each one further out than the last.
  placeGyms() {
    const cx = WORLD_W / 2, cz = WORLD_D / 2;
    const offset = hash2(1, 2, this.seed) * Math.PI * 2;
    this.gyms = GYMS.map((def, i) => {
      const angle = offset + i * 2.4;
      const r = 20 + i * 9;
      const x = Math.round(cx + Math.cos(angle) * r);
      const z = Math.round(cz + Math.sin(angle) * r);
      // The door faces the middle of the map, along whichever axis is closer.
      const dx = cx - x, dz = cz - z;
      const front = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      const floor = Math.max(WATER_LEVEL + 1, Math.min(this.terrainHeight(x, z), 26));
      this.buildGym(x, floor, z, front, def.type);
      const at = d => [x + front[0] * d + 0.5, z + front[1] * d + 0.5];
      const [lx, lz] = at(-4), [tx, tz] = at(1);
      return {
        def, x, z, y: floor + 1, front,
        leaderPos: [lx, floor + 1, lz], trainerPos: [tx + front[1] * 2, floor + 1, tz + front[0] * 2],
      };
    });
  }

  buildGym(x0, fy, z0, front, type) {
    const R = 6; // half-size of the building
    const wool = WOOL[type];
    // Clear nearby trees so nothing hangs over the building or blocks the door.
    for (let dx = -R - 5; dx <= R + 5; dx++) {
      for (let dz = -R - 5; dz <= R + 5; dz++) {
        for (let y = 1; y < WORLD_H; y++) {
          const id = this.get(x0 + dx, y, z0 + dz);
          if (id === B.LOG || id === B.LEAVES) this.set(x0 + dx, y, z0 + dz, B.AIR, false);
        }
      }
    }
    // Slope the surrounding ground towards the gym so it is never buried in a hill or stuck on a cliff.
    const M = R + 9;
    for (let dx = -M; dx <= M; dx++) {
      for (let dz = -M; dz <= M; dz++) {
        const x = x0 + dx, z = z0 + dz;
        const slope = Math.max(Math.abs(dx), Math.abs(dz)) - (R + 2);
        if (slope <= 0 || !this.inBounds(x, 0, z)) continue;
        const s = this.surface(x, z);
        const top = fy + slope, bottom = fy - slope;
        if (s.y > top) {
          for (let y = top + 1; y <= s.y; y++) this.set(x, y, z, B.AIR, false);
          if (isSolid(this.get(x, top, z))) this.set(x, top, z, top >= 29 ? B.SNOW : B.GRASS, false);
        } else if (s.y < bottom && s.id !== B.WATER) {
          for (let y = s.y; y < bottom; y++) this.set(x, y, z, B.DIRT, false);
          this.set(x, bottom, z, B.GRASS, false);
        }
      }
    }
    for (let dx = -R - 2; dx <= R + 2; dx++) {
      for (let dz = -R - 2; dz <= R + 2; dz++) {
        const x = x0 + dx, z = z0 + dz;
        if (!this.inBounds(x, 0, z)) continue;
        // Solid foundation and a cleared space above.
        for (let y = 1; y < fy; y++) if (!isSolid(this.get(x, y, z))) this.set(x, y, z, B.STONE, false);
        for (let y = fy + 1; y < WORLD_H; y++) this.set(x, y, z, B.AIR, false);
        const inside = Math.abs(dx) <= R && Math.abs(dz) <= R;
        if (!inside) { this.set(x, fy, z, B.GRASS, false); continue; }
        const edge = Math.abs(dx) === R || Math.abs(dz) === R;
        const corner = Math.abs(dx) === R && Math.abs(dz) === R;
        // Carpet runs from the door to the leader.
        const along = front[0] ? dz : dx;
        this.set(x, fy, z, !edge && along === 0 ? wool : B.PLANKS, false);
        if (edge) for (let y = fy + 1; y <= fy + 5; y++) this.set(x, y, z, corner ? B.COBBLE : B.BRICK, false);
        // Stepped roof in the gym's colour.
        this.set(x, fy + 6, z, wool, false);
        if (Math.abs(dx) <= R - 2 && Math.abs(dz) <= R - 2) this.set(x, fy + 7, z, wool, false);
      }
    }
    // Doorway (3 wide, 3 tall) with a cobble path leading out.
    for (let s = -1; s <= 1; s++) {
      for (let d = R; d <= R + 2; d++) {
        const x = x0 + front[0] * d + (front[0] ? 0 : s);
        const z = z0 + front[1] * d + (front[1] ? 0 : s);
        if (d === R) for (let y = fy + 1; y <= fy + 3; y++) this.set(x, y, z, B.AIR, false);
        if (d > R) this.set(x, fy, z, B.COBBLE, false);
      }
    }
    // Pillars of the gym's colour beside the door.
    for (const s of [-2, 2]) {
      const x = x0 + front[0] * (R + 1) + (front[0] ? 0 : s);
      const z = z0 + front[1] * (R + 1) + (front[1] ? 0 : s);
      for (let y = fy + 1; y <= fy + 3; y++) this.set(x, y, z, wool, false);
    }
  }

  // The gym whose building contains (x, z), if any.
  gymAt(x, z) {
    return this.gyms.find(g => Math.abs(x - g.x - 0.5) <= 6.5 && Math.abs(z - g.z - 0.5) <= 6.5) || null;
  }

  placeTree(x, y, z) {
    const trunk = 4 + Math.floor(hash2(x, z, this.seed + 5) * 2);
    const top = y + trunk - 1;
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy >= 0 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const corner = Math.abs(dx) === r && Math.abs(dz) === r;
          if (corner && (dy === 1 || hash2(x + dx * 7, z + dz * 13 + dy, this.seed) < 0.5)) continue;
          if (this.get(x + dx, top + dy, z + dz) === B.AIR) this.set(x + dx, top + dy, z + dz, B.LEAVES, false);
        }
      }
    }
    for (let i = 0; i < trunk; i++) this.set(x, y + i, z, B.LOG, false);
  }

  applyEdits(edits) {
    for (const [i, id] of edits) {
      this.data[i] = id;
      this.edits.set(i, id);
    }
  }

  // Topmost non-air block in a column.
  surface(x, z) {
    for (let y = WORLD_H - 1; y >= 0; y--) {
      const id = this.get(x, y, z);
      if (id !== B.AIR) return { y, id };
    }
    return { y: -1, id: B.AIR };
  }

  buildAll() {
    for (let cx = 0; cx < WORLD_W / CHUNK; cx++)
      for (let cz = 0; cz < WORLD_D / CHUNK; cz++) this.buildChunk(cx, cz);
    this.dirty.clear();
  }

  updateDirty() {
    for (const key of this.dirty) {
      const [cx, cz] = key.split(',').map(Number);
      if (cx >= 0 && cz >= 0 && cx < WORLD_W / CHUNK && cz < WORLD_D / CHUNK) this.buildChunk(cx, cz);
    }
    this.dirty.clear();
  }

  addFace(buf, x, y, z, face, tile, topScale = 1) {
    const ndx = buf.pos.length / 3;
    const s = face.shade;
    for (const [cx, cy, cz, u, v] of face.corners) {
      buf.pos.push(x + cx, y + (cy ? topScale : 0), z + cz);
      buf.uv.push((tile + (u ? 0.999 : 0.001)) / TILE_COUNT, v);
      buf.col.push(s, s, s);
    }
    buf.idx.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
  }

  buildChunk(cx, cz) {
    const solid = newBuffers();
    const water = newBuffers();
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    for (let y = 0; y < WORLD_H; y++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        for (let x = x0; x < x0 + CHUNK; x++) {
          const id = this.get(x, y, z);
          if (id === B.AIR) continue;
          if (id === B.WATER) {
            const surfaceTop = this.get(x, y + 1, z) !== B.WATER;
            for (const f of FACES) {
              const n = this.get(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
              if (n !== B.AIR) continue;
              if (f.kind === 'bottom') continue;
              this.addFace(water, x, y, z, f, BLOCKS[id].side, surfaceTop ? 0.88 : 1);
            }
            continue;
          }
          const def = BLOCKS[id];
          for (const f of FACES) {
            if (y === 0 && f.kind === 'bottom') continue;
            const n = this.get(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
            if (isOccluder(n)) continue;
            const tile = f.kind === 'top' ? def.top : f.kind === 'bottom' ? def.bottom : def.side;
            this.addFace(solid, x, y, z, f, tile);
          }
        }
      }
    }
    const key = `${cx},${cz}`;
    const old = this.meshes.get(key);
    if (old) {
      for (const m of old) { this.scene.remove(m); m.geometry.dispose(); }
    }
    const meshes = [];
    for (const [buf, mat] of [[solid, this.materials.solid], [water, this.materials.water]]) {
      if (!buf.idx.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
      geo.setIndex(buf.idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      if (mat === this.materials.water) mesh.renderOrder = 1;
      this.scene.add(mesh);
      meshes.push(mesh);
    }
    this.meshes.set(key, meshes);
  }

  dispose() {
    for (const list of this.meshes.values()) {
      for (const m of list) { this.scene.remove(m); m.geometry.dispose(); }
    }
    this.meshes.clear();
  }
}

// Voxel traversal (Amanatides & Woo). Returns the first solid block hit.
export function raycastVoxel(world, origin, dir, maxDist) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
  const tDeltaX = stepX ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = stepY ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = stepZ ? Math.abs(1 / dir.z) : Infinity;
  let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : stepX < 0 ? (origin.x - x) * tDeltaX : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : stepY < 0 ? (origin.y - y) * tDeltaY : Infinity;
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : stepZ < 0 ? (origin.z - z) * tDeltaZ : Infinity;
  let t = 0;
  let normal = [0, 0, 0];
  while (t <= maxDist) {
    const id = world.get(x, y, z);
    if (isSolid(id)) return { x, y, z, normal, t, id };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; normal = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; normal = [0, -stepY, 0];
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal = [0, 0, -stepZ];
    }
  }
  return null;
}
