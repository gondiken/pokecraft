// Voxel world: terrain generation, block storage and chunked meshing.
import * as THREE from 'three';
import { B, BLOCKS, TILE_COUNT, TREASURE, isOccluder, isSolid } from './blocks.js';
import { GYMS, LEGACY_EXTRA_GYMS } from './gyms.js';
import { carveCaves, carveBigCaves } from './caves.js';
import { installGymPlacement } from './gymplace.js';
import { generateRealm } from './realms.js'; // T31

export const WORLD_W = 288; // the map since T17 (array stride of every World the game makes)
export const WORLD_D = 288;
export const OLD_W = 224, OLD_D = 224; // the map before T17: generated exactly as before, never changes
export const MID_X = 112, MID_Z = 112; // the old middle: the start search, gym doors and the title fly-over use it
const NO_SIZE = [192, 192]; // saves from before the map grew don't record their size
export const WORLD_H = 48;
const CHUNK = 16;
export const WATER_LEVEL = 12;

// Block edits are stored by index, which depends on the map size. Converts edits saved with a
// different map size (terrain is the same at the same x, y, z, so they land in the same places).
export function convertEdits(edits, size = NO_SIZE) {
  const [w, d] = size;
  if (w === WORLD_W && d === WORLD_D) return edits;
  const out = [];
  for (const [i, id] of edits) {
    const x = i % w, z = Math.floor(i / w) % d, y = Math.floor(i / (w * d));
    if (x < WORLD_W && z < WORLD_D && y < WORLD_H) out.push([x + WORLD_W * (z + WORLD_D * y), id]);
  }
  return out;
}

export function hash2(x, z, seed) {
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
export const FACES = [
  { dir: [-1, 0, 0], shade: 0.62, kind: 'side', corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], shade: 0.62, kind: 'side', corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.32, kind: 'bottom', corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], shade: 1.0, kind: 'top', corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], shade: 0.45, kind: 'side', corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], shade: 0.45, kind: 'side', corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];

// Trees and other plants, cleared away where gyms are built.
export const PLANTS = new Set([B.LOG, B.LEAVES, B.PINE_LOG, B.PINE_LEAVES, B.CACTUS, B.FLOWER_BUSH, B.CRYSTAL]);

// The top block and the blocks just under it, for each biome.
export function groundOf(biome, h) {
  return {
    peak: [B.SNOW, B.STONE], snow: [B.SNOW, B.STONE], mountain: [B.STONE, B.STONE],
    beach: [B.SAND, B.SAND], swamp: [B.MUD, B.DIRT], taiga: [h <= WATER_LEVEL + 1 ? B.GRAVEL : B.SNOW, B.DIRT],
    desert: [B.SAND, B.SANDSTONE],
  }[biome] || [B.GRASS, B.DIRT];
}

function newBuffers() { return { pos: [], uv: [], col: [], idx: [] }; }

// Block light: glowing blocks (lamps, crystals, glowcaps) light the cells around them. Each chunk
// stamps the glow blocks within 4 blocks of it into this buffer (24 x 48 x 24), reused every build.
const LIGHT_R = 4, LIGHT_N = CHUNK + LIGHT_R * 2;
const lightBuf = new Float32Array(LIGHT_N * WORLD_H * LIGHT_N);
const GLOWS = new Uint8Array(256);
// `noLight` blocks (T19 lasers) are drawn bright at night but do not light the cells around them.
for (const id of Object.keys(BLOCKS)) if (BLOCKS[id].glow && !BLOCKS[id].noLight) GLOWS[id] = 1;
const OCCLUDERS = new Uint8Array(256);
for (let id = 1; id < 256; id++) OCCLUDERS[id] = isOccluder(id) ? 1 : 0;

export class World {
  // size: [W, D]. The game's world is WORLD_W x WORLD_D; generate() also makes the old 224 x 224 map in its own
  // World (T17), and tests may ask for one directly.
  constructor(seed, scene, materials, [W, D] = [WORLD_W, WORLD_D], realm = null) {
    this.seed = seed;
    this.realm = realm; // T31: a realm def (realms.js), or null for the main world
    this.scene = scene;
    this.materials = materials;
    this.W = W;
    this.D = D;
    this.data = new Uint8Array(W * D * WORLD_H);
    this.edits = new Map();
    this.dirty = new Set();
    this.meshes = new Map();
    this.gyms = [];
    this.tower = null;
    this.ground = new Uint8Array(W * D); // natural ground height of each column
    this.top = new Uint8Array(W * D); // highest block that blocks the sky (see computeTop)
    this.topReady = false;
    this.litCol = new Uint8Array(W * D); // 1 under gym and tower roofs: always bright
    this.caves = null;
    this.litRooms = []; // boxes that are always bright (cave gym rooms): { x0, x1, z0, z1, y0, y1 }
  }

  index(x, y, z) { return x + this.W * (z + this.D * y); }

  inBounds(x, y, z) {
    return x >= 0 && z >= 0 && y >= 0 && x < this.W && z < this.D && y < WORLD_H;
  }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return B.AIR;
    return this.data[this.index(x, y, z)];
  }

  // Collision query; the world edges and floor act as walls.
  isSolid(x, y, z) {
    if (x < 0 || z < 0 || x >= this.W || z >= this.D || y < 0) return true;
    return isSolid(this.get(x, y, z));
  }

  set(x, y, z, id, record = true) {
    if (!this.inBounds(x, y, z)) return;
    if (this.guardOld && x < OLD_W && z < OLD_D) throw new Error(`T17: write into the old area at ${x},${y},${z}`);
    const i = this.index(x, y, z);
    const old = this.data[i];
    this.data[i] = id;
    if (this.topReady) this.updateTop(x, y, z, id);
    if (!record) return;
    this.edits.set(i, id);
    this.markDirty(x, z, old, id);
    this.onEdit?.(x, y, z, old, id); // T22: the home manager listens here
  }

  // Changes a block for this player only (T19 doors and lasers): redrawn, but never an edit, never saved or sent.
  setLive(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z), old = this.data[i];
    if (old === id) return;
    this.data[i] = id;
    if (this.topReady) this.updateTop(x, y, z, id);
    this.markDirty(x, z, old, id);
  }

  // Marks the chunks that must be redrawn when (x, z) changes from block `old` to `id`.
  markDirty(x, z, old, id) {
    const cx = x >> 4, cz = z >> 4;
    // Glowing blocks light up to 4 blocks around them, so the chunks near them change too.
    if (GLOWS[old] || GLOWS[id]) {
      for (let a = (x - LIGHT_R) >> 4; a <= (x + LIGHT_R) >> 4; a++) {
        for (let b = (z - LIGHT_R) >> 4; b <= (z + LIGHT_R) >> 4; b++) this.dirty.add(`${a},${b}`);
      }
    }
    this.dirty.add(`${cx},${cz}`);
    if ((x & 15) === 0) this.dirty.add(`${cx - 1},${cz}`);
    if ((x & 15) === 15) this.dirty.add(`${cx + 1},${cz}`);
    if ((z & 15) === 0) this.dirty.add(`${cx},${cz - 1}`);
    if ((z & 15) === 15) this.dirty.add(`${cx},${cz + 1}`);
  }

  // Highest sky-blocking block of every column (leaves, glass and water let light through).
  computeTop() {
    const { data, top } = this;
    const layer = this.W * this.D;
    for (let c = 0; c < layer; c++) {
      let y = WORLD_H - 1;
      while (y > 0 && !OCCLUDERS[data[c + layer * y]]) y--;
      top[c] = y;
    }
    this.topReady = true;
  }

  updateTop(x, y, z, id) {
    const c = x + z * this.W;
    if (OCCLUDERS[id]) { if (y > this.top[c]) this.top[c] = y; return; }
    if (y !== this.top[c]) return;
    const layer = this.W * this.D;
    let t = y - 1;
    while (t > 0 && !OCCLUDERS[this.data[c + layer * t]]) t--;
    this.top[c] = t;
  }

  // How much daylight reaches a cell (0.06..1): full under open sky, dimmer the deeper it is
  // below the natural ground and under cover. Houses above the natural ground stay bright.
  skyAt(x, y, z) {
    if (x < 0 || z < 0 || x >= this.W || z >= this.D) return 1;
    if (!this.topReady) this.computeTop();
    const c = x + z * this.W;
    if (y > this.top[c] || this.litCol[c]) return 1;
    for (const r of this.litRooms) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && y >= r.y0 && y <= r.y1) return 1;
    const d = this.ground[c] - y;
    return d <= 0 ? 1 : Math.max(0.06, 1 - 0.2 * d);
  }

  // Is this position (feet) inside a lit cave gym room?
  inLitRoom(pos) {
    const x = Math.floor(pos.x), y = Math.floor(pos.y + 1.6), z = Math.floor(pos.z);
    return this.litRooms.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && y >= r.y0 && y <= r.y1);
  }

  // Is this position (a player's or creature's feet) in the dark, under cover and below ground?
  underground(pos) { return this.skyAt(Math.floor(pos.x), Math.floor(pos.y + 1.6), Math.floor(pos.z)) < 0.5; }

  terrainHeight(x, z) {
    const n = fbm(x / 56, z / 56, this.seed, 4);
    const m = fbm(x / 24 + 500, z / 24 + 500, this.seed + 7, 3);
    return Math.floor(4 + n * 21 + Math.max(0, m - 0.55) * 34);
  }

  forestAt(x, z) { return fbm(x / 36, z / 36, this.seed + 33, 2) > 0.56; }

  // Height thresholds for mountains, snow and peaks, from this map's own heights, so every map
  // gets some high places (flat maps have lower peaks). Never below the usual hill height.
  highGround() {
    if (this.high) return this.high;
    const hs = [];
    // pinned to the old 224 x 224 area (T17), or the biomes of old worlds would shift
    for (let x = 2; x < OLD_W; x += 4) for (let z = 2; z < OLD_D; z += 4) hs.push(Math.min(this.terrainHeight(x, z), WORLD_H - 10));
    hs.sort((a, b) => a - b);
    const at = share => hs[Math.floor(hs.length * (1 - share))];
    const peak = Math.max(19, at(0.03));
    const snow = Math.min(peak - 1, Math.max(18, at(0.05)));
    const mountain = Math.min(snow - 1, Math.max(17, at(0.11)));
    this.high = { peak, snow, mountain };
    return this.high;
  }

  // Climate: how warm and how wet a place is (0..1). Together with height they pick the biome.
  warmth(x, z) { return fbm(x / 55 + 300, z / 55 + 300, this.seed + 55, 3); }
  wetness(x, z) { return fbm(x / 50 + 700, z / 50 + 700, this.seed + 77, 3); }

  // The biome at (x, z), from the natural terrain (player building doesn't change it):
  // peak, snow, mountain, beach, swamp, taiga (snowy pine forest), desert, forest, meadow or plains.
  biome(x, z) {
    if (this.realm) return this.realm.biome; // T31
    const h = Math.min(this.terrainHeight(x, z), WORLD_H - 10);
    // The highest ground of this map: about 3% peaks, 2% snow and 6% mountains.
    const high = this.highGround();
    if (h >= high.peak) return 'peak';
    if (h >= high.snow) return 'snow';
    if (h >= high.mountain) return 'mountain';
    const warm = this.warmth(x, z), wet = this.wetness(x, z);
    if (warm < 0.37) return 'taiga';
    if (wet > 0.58 && h <= WATER_LEVEL + 3) return 'swamp';
    if (h <= WATER_LEVEL + 1) return 'beach';
    if (warm > 0.57 && wet < 0.48) return 'desert';
    if (this.forestAt(x, z)) return 'forest';
    if (fbm(x / 30 + 900, z / 30 + 900, this.seed + 91, 2) > 0.58) return 'meadow';
    return 'plains';
  }

  // One terrain column: ground height, the blocks from the bottom up to the ground (or the water), its biome.
  fillColumn(x, z) {
    const h = Math.min(this.terrainHeight(x, z), WORLD_H - 10);
    this.ground[x + z * this.W] = h;
    const biome = this.biome(x, z);
    const [top, under] = groundOf(biome, h);
    // Gravel patches on mountainsides.
    const gravel = biome === 'mountain' && fbm(x / 9, z / 9, this.seed + 21, 2) > 0.66;
    for (let y = 0; y <= Math.max(h, WATER_LEVEL); y++) {
      let id;
      if (y > h) id = biome === 'taiga' && y === WATER_LEVEL ? B.ICE : B.WATER; // frozen lakes
      else if (y === h) id = gravel ? B.GRAVEL : top;
      else if (y > h - 4) id = under;
      else {
        // Ore hidden in the rock: dig (or look at cliffs) to find it.
        const r = hash2(x * 7 + y, z * 13 - y * 3, this.seed + 404);
        id = r < 0.004 ? B.GOLD_ORE : r < 0.02 ? B.COAL_ORE : B.STONE;
      }
      this.data[this.index(x, y, z)] = id;
    }
    return biome;
  }

  // Plants at one column: trees, pines, cacti, flower bushes and star crystals, depending on the biome.
  // wide = false: no trees or pines (their crowns reach 2 columns sideways; used next to the old map's edge).
  plantAt(x, z, biome, wide = true) {
    const r = hash2(x, z, this.seed + 99);
    const s = this.surface(x, z);
    const y = s.y + 1;
    if (biome === 'desert') {
      if (r < 0.012 && s.id === B.SAND) for (let i = 0; i < 1 + Math.floor(r * 250); i++) this.set(x, y + i, z, B.CACTUS, false);
    } else if (biome === 'taiga') {
      if (wide && r < 0.04 && s.id === B.SNOW) this.placePine(x, y, z);
    } else if (biome === 'peak') {
      if (r < 0.02 && s.id === B.SNOW) for (let i = 0; i < 1 + Math.floor(r * 100); i++) this.set(x, y + i, z, B.CRYSTAL, false);
    } else if (biome === 'swamp') {
      if (wide && r < 0.025 && s.id === B.MUD) this.placeTree(x, y, z);
    } else if (s.id === B.GRASS) {
      const chance = biome === 'forest' ? 0.05 : biome === 'meadow' ? 0.002 : 0.004;
      if (r < chance) { if (wide) this.placeTree(x, y, z); }
      else if (biome === 'meadow' ? r > 0.93 : r > 0.997) this.set(x, y, z, B.FLOWER_BUSH, false);
    }
  }

  // The game's world: the old 224 x 224 map is generated exactly as before in its own World and copied in,
  // then the new land (east and south of it) gets terrain, plants and the slot gyms. Nothing old can move.
  generate(opts = {}) {
    if (this.realm) return generateRealm(this); // T31: a realm has its own terrain; the main path below is untouched
    if (this.W === OLD_W && this.D === OLD_D) return this.generateArea(opts); // the old map itself (tests)
    const old = new World(this.seed, null, null, [OLD_W, OLD_D]);
    old.generateArea(opts);
    this.adoptOld(old);
    this.guardOld = true; // set() throws if anything writes into the old area from here on
    try {
      this.generateNewLand();
      if (opts.slotGyms !== false) this.placeSlotGyms();
      if (opts.treasure !== false) this.placeTreasure(true);
    } finally { this.guardOld = false; }
    this.gyms.sort((a, b) => GYMS.indexOf(a.def) - GYMS.indexOf(b.def));
  }

  // Copies a finished old-size World into this (bigger) one, row by row, and takes over its bookkeeping.
  adoptOld(old) {
    const { W } = this;
    for (let y = 0; y < WORLD_H; y++) {
      for (let z = 0; z < OLD_D; z++) this.data.set(old.data.subarray(OLD_W * (z + OLD_D * y), OLD_W * (z + OLD_D * y + 1)), this.index(0, y, z));
    }
    for (let z = 0; z < OLD_D; z++) {
      this.ground.set(old.ground.subarray(z * OLD_W, (z + 1) * OLD_W), z * W);
      this.litCol.set(old.litCol.subarray(z * OLD_W, (z + 1) * OLD_W), z * W);
    }
    const remap = i => (i % OLD_W) + Math.floor(i / OLD_W) * W;
    if (old.caves) {
      old.caves.opened = new Set([...old.caves.opened].map(remap));
      if (old.caves.marks) old.caves.marks = new Set([...old.caves.marks].map(remap));
    }
    for (const k of ['caves', 'gyms', 'tower', 'litRooms', 'newGymBoxes', 'high', 'extraSpots', 'caveSpots', 'newSpots']) this[k] = old[k];
  }

  // Terrain and plants for every column outside the old area, from the same noise and the same rules (biome()
  // keeps using the old area's height thresholds). Writes only outside the old area. No caves here.
  generateNewLand() {
    const { W, D } = this;
    const biomes = new Array(W * D);
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) if (x >= OLD_W || z >= OLD_D) biomes[x + z * W] = this.fillColumn(x, z);
    for (let x = 3; x < W - 3; x++) {
      for (let z = 3; z < D - 3; z++) {
        if (x < OLD_W && z < OLD_D) continue;
        // Crowns are 2 wide: trunks start 2 columns past the seam, so a tree never reaches into the old map.
        this.plantAt(x, z, biomes[x + z * W], !(x < OLD_W + 2 && z < OLD_D + 2));
      }
    }
  }

  // caves: the old caves; bigCaves: the second, bigger cave layer; caveGyms: gyms that live in caves (tests only).
  // newGyms: the T10 gyms (19+); off only for tests that compare with the world before them.
  // treasure: the T20 treasure blocks (they only ever replace stone, so counted as stone the world is the old one).
  // Generates a World of the old size (224 x 224) in full; the game's world calls it on its old-size twin.
  generateArea({ caves = true, bigCaves = caves, caveGyms = true, newGyms = true, treasure = true } = {}) {
    const { W, D } = this;
    const biomes = new Array(W * D);
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) biomes[x + z * W] = this.fillColumn(x, z);
    // Caves under the hills (before the plants, so trees only grow where there is still ground).
    const solid = caves ? this.data.slice() : null;
    this.caves = caves ? carveCaves(this) : null;
    // Gyms 17+ get their spots from the terrain alone; no cave may be under (or open into) them.
    if (caves) for (const [x, z] of this.extraGymSpots().slice(0, LEGACY_EXTRA_GYMS)) this.fillCavesNear(solid, x, z, 18);
    if (caves && bigCaves) carveBigCaves(this);
    this.litRooms = [];
    this.newGymBoxes = [];
    // T10: no cave may be under (or open into) the new surface gyms (before the cave rooms, so it never touches them).
    // The Cloud Gym floats high above the caves, so they stay as they are under it.
    const newSpots = newGyms ? this.newGymSpots() : [];
    if (caves) for (const sp of newSpots) if (sp.place === 'surface') this.fillNewGymCaves(solid, sp.x, sp.z, 18);
    if (caveGyms) this.carveGymRooms(solid, newSpots);
    const carved = caves ? this.data.slice() : null;
    // Plants: trees, pines, cacti, flower bushes and star crystals, depending on the biome.
    for (let x = 3; x < W - 3; x++) {
      for (let z = 3; z < D - 3; z++) this.plantAt(x, z, biomes[x + z * W]);
    }
    this.placeGyms();
    this.placeTower();
    this.placeExtraGyms();
    if (caveGyms) this.placeCaveGyms();
    if (newGyms) this.placeNewGyms(caveGyms);
    this.gyms.sort((a, b) => GYMS.indexOf(a.def) - GYMS.indexOf(b.def));
    if (caves) this.fillCavesNearStart(solid, carved);
    if (treasure) this.placeTreasure();
  }

  // T20: Sunstone, Ruby and Sapphire, rare, in place of natural stone at least 4 blocks under the ground: more often
  // in cave walls (next to air), now and then deep in the rock (8+ down). Never inside a gym's protected box, so it
  // can always be mined. Runs last, from the seed only. newLandOnly: the 288 world's pass (the old area has its own).
  placeTreasure(newLandOnly = false) {
    const { W, D, data, seed } = this;
    const layer = W * D;
    for (let x = 1; x < W - 1; x++) {
      for (let z = 1; z < D - 1; z++) {
        if (newLandOnly && x < OLD_W && z < OLD_D) continue;
        const g = this.ground[x + z * W];
        for (let y = 1; y <= g - 4; y++) {
          const i = this.index(x, y, z);
          if (data[i] !== B.STONE) continue;
          const r = hash2(x * 31 + y * 7, z * 17 - y * 11, seed + 2020);
          if (r >= 0.015) continue;
          const wall = data[i - 1] === B.AIR || data[i + 1] === B.AIR || data[i - W] === B.AIR || data[i + W] === B.AIR
            || data[i - layer] === B.AIR || data[i + layer] === B.AIR;
          if (!(wall || (y <= g - 8 && r < 0.0012)) || this.protectedAt(x, y, z)) continue;
          data[i] = TREASURE[Math.floor(hash2(x + y, z - y * 3, seed + 2021) * 3)];
        }
      }
    }
  }

  // Where a new player starts (same search as findSpawn in main.js): the first grass going outwards
  // from the middle. Plants, gyms and the tower cover grass, so it is only known once they are in.
  startColumn() {
    const cx = MID_X, cz = MID_Z; // pinned: the old middle (T17)
    for (let r = 0; r < 60; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (this.surface(cx + dx, cz + dz).id === B.GRASS) return [cx + dx, cz + dz];
        }
      }
    }
    return [cx, cz];
  }

  // No caves under the start: undo what the carving changed within 10 blocks of it (solid = the
  // world before carving, carved = right after; anything changed since, like a gym, stays).
  fillCavesNearStart(solid, carved) {
    const [sx, sz] = this.startColumn();
    this.fillCavesNear(solid, sx, sz, 10, carved);
  }

  // Undoes the caves within R blocks (a square) of (x0, z0). With `carved` (the world right after
  // carving), cells changed since then stay; without it everything in the box goes back to solid.
  fillCavesNear(solid, x0, z0, R, carved = null) {
    for (let x = Math.max(0, x0 - R); x <= Math.min(this.W - 1, x0 + R); x++) {
      for (let z = Math.max(0, z0 - R); z <= Math.min(this.D - 1, z0 + R); z++) {
        for (let y = 0; y < WORLD_H; y++) {
          const i = this.index(x, y, z);
          if (carved ? solid[i] !== carved[i] && this.data[i] === carved[i] : true) this.data[i] = solid[i];
        }
        this.caves.opened.delete(x + z * this.W);
      }
    }
    const far = ([x, , z]) => Math.max(Math.abs(x - x0), Math.abs(z - z0)) > R;
    const c = this.caves;
    c.floors = c.floors.filter(far);
    c.crystals = c.crystals.filter(far);
    c.chests = c.chests.filter(far);
    c.entrances = c.entrances.filter(([x, z]) => Math.max(Math.abs(x - x0), Math.abs(z - z0)) > R);
  }

  // A tall, pointy snowy-forest tree.
  placePine(x, y, z) {
    const trunk = 5 + Math.floor(hash2(x, z, this.seed + 6) * 3);
    for (let i = 0; i < trunk; i++) this.set(x, y + i, z, B.PINE_LOG, false);
    const top = y + trunk;
    this.set(x, top, z, B.PINE_LEAVES, false);
    for (let dy = -4; dy < 0; dy++) {
      const r = dy <= -3 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if ((dx || dz) && Math.abs(dx) + Math.abs(dz) <= r + (r === 2 ? 1 : 0) && this.get(x + dx, top + dy, z + dz) === B.AIR) {
            this.set(x + dx, top + dy, z + dz, B.PINE_LEAVES, false);
          }
        }
      }
    }
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

  // Edits that would change a protected gym cell are dropped, so an old save with a hole dug into a gym gets
  // its gym back (T17), and a host's world sent to a guest is cleaned the same way.
  applyEdits(edits) {
    this.topReady = false;
    const { W, D } = this;
    for (const [i, id] of edits) {
      if (!this.editAllowed(i % W, Math.floor(i / (W * D)), Math.floor(i / W) % D, id)) continue;
      this.data[i] = id;
      this.edits.set(i, id);
    }
  }

  // The gym (or the tower) whose protected box holds this cell, or null. Every gym object has `protect` boxes.
  protectedAt(x, y, z) {
    const inside = g => g.protect?.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1);
    for (const g of this.gyms) if (inside(g)) return g;
    return this.tower && inside(this.tower) ? this.tower : null;
  }

  // T27: is this cell inside any gym's or the tower's protected box? Riders can't go in (the box list is fixed after generate()).
  fenced(x, y, z) {
    const boxes = this.fenceBoxes ??= [...this.gyms, this.tower].flatMap(g => g?.protect || []);
    for (const b of boxes) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1) return true;
    return false;
  }

  // May this cell become `id`? One rule for the player, touch, visitors and saved edits. Opening a chest is not
  // breaking it (cave chests; T23's key chests).
  editAllowed(x, y, z, id) {
    return !this.protectedAt(x, y, z) || (this.get(x, y, z) === B.CHEST && id === B.CHEST_OPEN);
  }

  // Hides the chunks past the fog (they are fog-coloured there anyway): fewer draw calls on the big map.
  cull(pos, far) {
    const r = (far + 12) ** 2;
    for (const [key, list] of this.meshes) {
      const comma = key.indexOf(',');
      const dx = Number(key.slice(0, comma)) * CHUNK + CHUNK / 2 - pos.x, dz = Number(key.slice(comma + 1)) * CHUNK + CHUNK / 2 - pos.z;
      const vis = dx * dx + dz * dz < r;
      for (const m of list) m.visible = vis;
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
    this.computeTop();
    for (let cx = 0; cx < this.W / CHUNK; cx++)
      for (let cz = 0; cz < this.D / CHUNK; cz++) this.buildChunk(cx, cz);
    this.dirty.clear();
  }

  updateDirty() {
    for (const key of this.dirty) {
      const [cx, cz] = key.split(',').map(Number);
      if (cx >= 0 && cz >= 0 && cx < this.W / CHUNK && cz < this.D / CHUNK) this.buildChunk(cx, cz);
    }
    this.dirty.clear();
  }

  // sky and blk: the light in the cell the face looks into, packed as r = shade x sky, g = shade x block light.
  addFace(buf, x, y, z, face, tile, topScale = 1, sky = 1, blk = 1) {
    const ndx = buf.pos.length / 3;
    const s = face.shade, r = s * sky, g = s * blk;
    for (const [cx, cy, cz, u, v] of face.corners) {
      buf.pos.push(x + cx, y + (cy ? topScale : 0), z + cz);
      buf.uv.push((tile + (u ? 0.999 : 0.001)) / TILE_COUNT, v);
      buf.col.push(r, g, s);
    }
    buf.idx.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
  }

  // Fills lightBuf with the block light of every glow block within 4 blocks of the chunk at (x0, z0).
  stampLight(x0, z0) {
    lightBuf.fill(0);
    const { data } = this;
    for (let y = 0; y < WORLD_H; y++) {
      for (let z = Math.max(0, z0 - LIGHT_R); z < Math.min(this.D, z0 + CHUNK + LIGHT_R); z++) {
        const row = this.W * (z + this.D * y);
        for (let x = Math.max(0, x0 - LIGHT_R); x < Math.min(this.W, x0 + CHUNK + LIGHT_R); x++) {
          if (!GLOWS[data[row + x]]) continue;
          for (let dy = -LIGHT_R; dy <= LIGHT_R; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= WORLD_H) continue;
            const ry = LIGHT_R - Math.abs(dy);
            for (let dz = -ry; dz <= ry; dz++) {
              const lz = z + dz - z0 + LIGHT_R;
              if (lz < 0 || lz >= LIGHT_N) continue;
              const rx = ry - Math.abs(dz);
              for (let dx = -rx; dx <= rx; dx++) {
                const lx = x + dx - x0 + LIGHT_R;
                if (lx < 0 || lx >= LIGHT_N) continue;
                const v = 0.9 - 0.18 * (Math.abs(dx) + Math.abs(dy) + Math.abs(dz));
                const li = (yy * LIGHT_N + lz) * LIGHT_N + lx;
                if (v > lightBuf[li]) lightBuf[li] = v;
              }
            }
          }
        }
      }
    }
  }

  lightAt(x, y, z, x0, z0) {
    if (y < 0 || y >= WORLD_H) return 0;
    const lx = x - x0 + LIGHT_R, lz = z - z0 + LIGHT_R;
    if (lx < 0 || lz < 0 || lx >= LIGHT_N || lz >= LIGHT_N) return 0;
    return lightBuf[(y * LIGHT_N + lz) * LIGHT_N + lx];
  }

  buildChunk(cx, cz) {
    const solid = newBuffers();
    const water = newBuffers();
    const glow = newBuffers(); // blocks that light up at night
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    this.stampLight(x0, z0);
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
              this.addFace(water, x, y, z, f, BLOCKS[id].side, surfaceTop ? 0.88 : 1, this.skyAt(x + f.dir[0], y + f.dir[1], z + f.dir[2]), this.lightAt(x + f.dir[0], y + f.dir[1], z + f.dir[2], x0, z0));
            }
            continue;
          }
          const def = BLOCKS[id];
          for (const f of FACES) {
            if (y === 0 && f.kind === 'bottom') continue;
            const n = this.get(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
            if (isOccluder(n)) continue;
            const tile = f.kind === 'top' ? def.top : f.kind === 'bottom' ? def.bottom : def.side;
            if (id === B.FIREPLACE) this.hasFire = true; // T22: main.js flickers the fire only in worlds that have one
            if (def.glow) this.addFace(glow, x, y, z, f, tile);
            else {
              const nx = x + f.dir[0], ny = y + f.dir[1], nz = z + f.dir[2];
              this.addFace(solid, x, y, z, f, tile, 1, this.skyAt(nx, ny, nz), this.lightAt(nx, ny, nz, x0, z0));
            }
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
    for (const [buf, mat] of [[solid, this.materials.solid], [water, this.materials.water], [glow, this.materials.glow]]) {
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

installGymPlacement(World);

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
