// T35: the terrain of the Dream realm (TERRAINS.dreamLand in realms.js): a cloud sea with floating islands, hanging trees,
// giant everyday things and Bounce Blocks that link the islands. Everything is data (ISLES, LINKS, GIANTS) and a small loop:
// seeded noise only makes edges, small heights and plants, so every island and every link is always where the table says.
// It only needs a world with W, D, seed, data, ground, inBounds(), index(), get() (tests use a stand-in in Node).
import { B, WOOL, mulberry32 } from './blocks.js';

// One island: offsets from the map centre, nominal radius, top height, kind. `outer` islands are left out of a map smaller than 256.
export const ISLES = [
  { id: 'home', dx: 0, dz: 0, r: 20, top: 20, kind: 'home' },              // arrive, Wake Stone, candy trees
  { id: 'meadow', dx: 42, dz: -19, r: 22, top: 16, kind: 'checker', giants: [['pencil', -9, -7], ['blocks', 6, -9], ['duck', -7, 7], ['spoon', 3, 5]] },
  { id: 'hop1', dx: -8, dz: 32, r: 9, top: 24, kind: 'candy' },
  { id: 'hop2', dx: -26, dz: 44, r: 9, top: 18, kind: 'hanging' },
  { id: 'gym', dx: -48, dz: 62, r: 15, top: 12, kind: 'gym' },             // the Upside-Down House floats above it
  { id: 'pebble', dx: 22, dz: 24, r: 8, top: 11, kind: 'candy' },          // low: has a sea pad
  { id: 'lowmeadow', dx: 68, dz: 6, r: 9, top: 10, kind: 'checker' },      // low: has a sea pad
  { id: 'upsy', dx: -32, dz: -8, r: 10, top: 28, kind: 'hanging' },
  { id: 'tall', dx: -28, dz: -30, r: 8, top: 33, kind: 'crystal' },        // the highest: a view over everything
  { id: 'outerE', dx: 65, dz: -50, r: 12, top: 22, kind: 'candy', outer: true },
  { id: 'outerW', dx: -41, dz: -48, r: 10, top: 23, kind: 'hanging', outer: true },
  { id: 'outerS', dx: 78, dz: 28, r: 10, top: 13, kind: 'checker', outer: true }, // low: has a sea pad
  { id: 'lowW', dx: -46, dz: 34, r: 7, top: 12, kind: 'candy' },           // low: has a sea pad
  { id: 'lowNW', dx: -55, dz: -62, r: 7, top: 13, kind: 'candy', outer: true }, // low: has a sea pad
  { id: 'lowNE', dx: 80, dz: -66, r: 7, top: 13, kind: 'candy', outer: true },  // low: has a sea pad
];
// Which islands a Bounce Block pair connects (a pad on each island, facing the other).
export const LINKS = [
  ['home', 'meadow'], ['home', 'hop1'], ['home', 'pebble'], ['home', 'upsy'], ['meadow', 'lowmeadow'], ['meadow', 'outerE'],
  ['hop1', 'hop2'], ['hop2', 'gym'], ['upsy', 'tall'], ['tall', 'outerW'], ['lowmeadow', 'outerS'],
  ['hop2', 'lowW'], ['outerW', 'lowNW'], ['outerE', 'lowNE'],
];
export const LOW_TOP = 13;     // islands at most this high also get a pad on the cloud sea beside them
export const PAD_UP = 16;      // the column above a pad stays clear this high
export const SEA_PAD_FROM = 3; // a sea pad's middle is r + this from its island's middle

// Giant everyday things as boxes: [dx, dy, dz, w, h, d, block] from the corner at the placed spot.
export const GIANTS = {
  pencil: [[0, 0, 0, 2, 1, 2, WOOL.pixie], [0, 1, 0, 2, 1, 2, WOOL.metal], [0, 2, 0, 2, 9, 2, WOOL.electric], [0, 11, 0, 2, 2, 2, WOOL.bone], [0, 13, 0, 1, 1, 1, WOOL.cyber]],
  blocks: [[0, 0, 0, 3, 3, 3, WOOL.fire], [1, 3, 0, 3, 3, 3, WOOL.water], [0, 6, 1, 3, 3, 3, WOOL.grass]],
  duck: [[0, 0, 0, 6, 3, 4, WOOL.electric], [3, 3, 0, 3, 3, 4, WOOL.electric], [0, 3, 1, 2, 1, 2, WOOL.electric], [6, 3, 1, 1, 1, 2, WOOL.fire],
    [5, 4, -1, 1, 1, 1, WOOL.cyber], [5, 4, 4, 1, 1, 1, WOOL.cyber]],
  spoon: [[0, 0, 0, 9, 1, 1, WOOL.metal], [9, 0, -1, 3, 1, 3, WOOL.metal], [10, 1, -1, 1, 1, 3, WOOL.metal], [11, 1, -1, 1, 1, 3, WOOL.metal]],
};

// Small value noise of its own (world.js imports realms.js, which imports this file: no import back).
function hash(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed), c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// The islands this map has: placed from the map centre (the realm's `arrive`).
export function isleList(def, W, D) {
  const [cx, cz] = def.arrive;
  return ISLES.filter(i => !(i.outer && Math.min(W, D) < 256)).map(i => ({ ...i, x: cx + i.dx, z: cz + i.dz }));
}

export function dreamLand(world, def) {
  const { W, D, seed } = world;
  const [cx, cz] = def.arrive;
  const put = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  const groundAt = (x, z) => world.ground[x + z * W];
  const list = isleList(def, W, D);
  const byId = Object.fromEntries(list.map(i => [i.id, i]));
  const bottom = new Int16Array(W * D).fill(-1); // lowest block of every island column

  // 1. The cloud sea: soft, so a fall is never hard. Sea columns have ground 0.
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) { put(x, 0, z, B.CLOUD); world.ground[x + z * W] = 0; }

  // 2. The islands: a noisy round edge (+-1), top within +-1 of `top`, tapering to a point underneath, two layers of sky wool.
  const columns = new Map(); // id -> [[x, z], ...] of the top
  list.forEach((isle, n) => {
    const cols = [];
    const R = isle.r + 3;
    for (let x = Math.max(1, isle.x - R); x <= Math.min(W - 2, isle.x + R); x++) {
      for (let z = Math.max(1, isle.z - R); z <= Math.min(D - 2, isle.z + R); z++) {
        const dx = x - isle.x, dz = z - isle.z, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
        const e = isle.r + (noise(Math.cos(a) * 2.2 + n * 13, Math.sin(a) * 2.2 + n * 7, seed + 5) - 0.5) * 2;
        if (d > e) continue;
        const k = 1 - d / e;
        const hn = noise(x / 7 + n * 31, z / 7, seed + 11 + n);
        const h = isle.top + (hn > 0.8 ? 1 : hn < 0.2 ? -1 : 0);
        const depth = 2 + Math.round(k * 12);
        const y0 = Math.max(1, h - depth);
        let topBlock;
        if (isle.kind === 'checker') topBlock = ((x >> 1) + (z >> 1)) & 1 ? WOOL.dream : WOOL.paper;
        else {
          const pn = noise(x / 5 + 50, z / 5 + 50, seed + 9);
          topBlock = pn > 0.82 ? WOOL.pixie : pn < 0.12 ? WOOL.mind : B.DREAM_GRASS;
        }
        for (let y = y0; y <= h; y++) put(x, y, z, y === h ? topBlock : y >= h - 2 ? WOOL.sky : B.CLOUD);
        world.ground[x + z * W] = h;
        bottom[x + z * W] = y0;
        cols.push([x, z]);
      }
    }
    columns.set(isle.id, cols);
  });

  // 3. Bounce pads: a 3x3 on each island of a link, 4 cells in from its middle towards the other island, flat at the
  // pad's own height, with the column above it clear. Low islands also get one on the sea beside them.
  const pads = [];
  const clearAbove = (x, y, z, up) => { for (let yy = y + 1; yy <= y + up; yy++) put(x, yy, z, B.AIR); };
  const makePad = (px, pz, y) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const x = px + dx, z = pz + dz, g = groundAt(x, z);
      for (let yy = Math.max(1, g + 1); yy < y; yy++) if (world.get(x, yy, z) === B.AIR) put(x, yy, z, WOOL.sky);
      put(x, y, z, B.BOUNCE);
      clearAbove(x, y, z, PAD_UP);
      world.ground[x + z * W] = y;
      pads.push([x, y, z]);
    }
    return [px, y, pz];
  };
  const links = LINKS.filter(([a, b]) => byId[a] && byId[b]).map(([a, b]) => {
    const A = byId[a], Bi = byId[b], dist = Math.hypot(Bi.x - A.x, Bi.z - A.z);
    const padOf = (P, Q) => {
      const ux = (Q.x - P.x) / dist, uz = (Q.z - P.z) / dist;
      const px = Math.round(P.x + ux * (P.r - 4)), pz = Math.round(P.z + uz * (P.r - 4));
      return makePad(px, pz, groundAt(px, pz));
    };
    const pa = padOf(A, Bi), pb = padOf(Bi, A);
    return [a, b, pa, pb];
  });
  const seaPads = [];
  for (const isle of list) {
    if (isle.top > LOW_TOP) continue;
    // the side towards the home island if it is free sea, else the nearest free direction round the island
    const home = byId.home, base = Math.atan2(home.z - isle.z, home.x - isle.x);
    for (let k = 0; k < 24; k++) {
      const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12), dist = isle.r + SEA_PAD_FROM + 1;
      const px = Math.round(isle.x + Math.cos(a) * dist), pz = Math.round(isle.z + Math.sin(a) * dist);
      if (px < 4 || pz < 4 || px > W - 5 || pz > D - 5) continue;
      let free = true;
      for (let dx = -3; dx <= 3 && free; dx++) for (let dz = -3; dz <= 3; dz++) if (groundAt(px + dx, pz + dz) > 0) { free = false; break; }
      if (!free) continue;
      seaPads.push(makePad(px, pz, 0));
      break;
    }
  }

  // 4. Plants and decorations. Reserved boxes (giants, pads, the arrival, the Wake Stone, the gym's house) keep trees away.
  const reserved = [];
  const isReserved = (x, z, m = 0) => reserved.some(b => x >= b[0] - m && x <= b[1] + m && z >= b[2] - m && z <= b[3] + m);
  const home = byId.home, arriveX = home.x, arriveZ = home.z;
  reserved.push([arriveX - 6, arriveX + 8, arriveZ - 4, arriveZ + 4]);
  for (const [x, , z] of pads) reserved.push([x, x, z, z]);
  const gymIsle = byId.gym;
  if (gymIsle) reserved.push([gymIsle.x - 9, gymIsle.x + 9, gymIsle.z - 9, gymIsle.z + 9]);

  // Giants: normal blocks standing on a flattened spot (they can be broken, so a child can knock them over).
  const placeGiant = (name, ox, oz) => {
    const boxes = GIANTS[name];
    let w = 0, d = 0, base = 0;
    for (const [dx, , dz, bw, , bd] of boxes) { w = Math.max(w, dx + bw); d = Math.max(d, dz + bd); }
    for (let x = ox - 1; x < ox + w + 1; x++) for (let z = oz - 1; z < oz + d + 1; z++) base = Math.max(base, groundAt(x, z));
    for (let x = ox - 1; x < ox + w + 1; x++) for (let z = oz - 1; z < oz + d + 1; z++) {
      const g = groundAt(x, z);
      for (let y = g + 1; y <= base; y++) put(x, y, z, WOOL.paper);
      for (let y = base + 1; y <= base + 16; y++) put(x, y, z, B.AIR);
      world.ground[x + z * W] = base;
    }
    for (const [dx, dy, dz, bw, bh, bd, id] of boxes) {
      for (let a = 0; a < bw; a++) for (let b = 0; b < bh; b++) for (let c = 0; c < bd; c++) put(ox + dx + a, base + 1 + dy + b, oz + dz + c, id);
    }
    reserved.push([ox - 2, ox + w + 1, oz - 2, oz + d + 1]);
  };
  for (const isle of list) for (const [name, gx, gz] of isle.giants || []) placeGiant(name, isle.x + gx, isle.z + gz);

  // The Wake Stone: 5 blocks east of where you arrive, with two lamps beside it.
  const wx = arriveX + 5, wz = arriveZ, wy = groundAt(wx, wz) + 1;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = wy; y < wy + 4; y++) put(wx + dx, y, wz + dz, B.AIR);
  put(wx, wy, wz, B.WAKE_STONE);
  for (const lz of [wz - 2, wz + 2]) put(wx, groundAt(wx, lz) + 1, lz, B.LAMP);
  world.wake = [wx, wy, wz];

  const rand = mulberry32(seed ^ 0x35d);
  list.forEach((isle, n) => {
    if (isle.kind === 'gym') return; // the house floats above it; the island stays tidy
    const cols = columns.get(isle.id);
    const trees = isle.kind === 'checker' ? 0 : 0.012, bits = isle.kind === 'tall' ? 0.05 : 0.035;
    for (const [x, z] of cols) {
      if (isReserved(x, z, 1)) continue;
      if (Math.hypot(x - isle.x, z - isle.z) > isle.r - 1.5) continue;
      const g = groundAt(x, z), y = g + 1;
      if (world.get(x, g, z) === B.AIR || world.get(x, y, z) !== B.AIR) continue;
      const r = hash(x, z, seed + 9 + n);
      if (r < trees) { // a candy tree: a light trunk and a ball of pixie and light wool
        const t = 3 + Math.floor(r * 300);
        for (let i = 0; i < t; i++) put(x, y + i, z, WOOL.paper);
        for (let a = -2; a <= 2; a++) for (let b = -1; b <= 2; b++) for (let c = -2; c <= 2; c++) {
          if (a * a + (b - 0.5) ** 2 + c * c <= 5.5 && world.get(x + a, y + t + b, z + c) === B.AIR) put(x + a, y + t + b, z + c, (a + b + c) & 1 ? WOOL.pixie : WOOL.light);
        }
      } else if (r < trees + bits * 0.6) put(x, y, z, B.CRYSTAL);
      else if (r < trees + bits) put(x, y, z, B.GLOWCAP);
    }
    // Trees that hang under the island: a trunk going down and a ball of wool at the end.
    const many = isle.kind === 'hanging' ? 6 + Math.floor(rand() * 5) : Math.floor(rand() * 4);
    for (let i = 0; i < many; i++) {
      const a = rand() * Math.PI * 2, d = rand() * isle.r * 0.5;
      const x = Math.round(isle.x + Math.cos(a) * d), z = Math.round(isle.z + Math.sin(a) * d), yb = bottom[x + z * W];
      if (yb < 0) continue;
      const len = Math.min(3 + Math.floor(rand() * 3), yb - 5);
      if (len < 2) continue;
      for (let y = yb - 1; y >= yb - len; y--) put(x, y, z, B.LOG);
      const ball = [WOOL.pixie, WOOL.light, WOOL.sky][i % 3], cy = yb - len - 1;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 2 && world.get(x + dx, cy + dy, z + dz) === B.AIR) put(x + dx, cy + dy, z + dz, ball);
      }
    }
  });

  world.isles = {
    list: list.map(({ id, x, z, r, top, kind }) => ({ id, x, z, r, top, kind })),
    links, seaPads, home: 'home', gym: 'gym',
  };
}
