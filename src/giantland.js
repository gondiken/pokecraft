// T40a: the Giant House, the Wizard's kitchen seen by his pet mouse. Terrain as data (like dreamland.js / swirlland.js): 1 block = 3 cm
// of real house, so you (1.8 blocks) are as small as a mouse. A 192 x 192 room with no ceiling: an arrival with the way back, a
// counter with a sink, a tap and a river groove, a shelf, a fan, a table with a giant cookie (the Boss stands on it), a bench with a
// sleeping cat, a toy train track, a mouse hole and a keyhole (two secret ways) and twelve crumbs. Imports only blocks.js and
// picturelands.js (never three, species.js or sneak.js: houselive.js uses those), and needs only a world with
// W / D / seed / data / ground / index / inBounds / get, so the spec runs it on a stand-in in Node.
import { B, WOOL, mulberry32 } from './blocks.js';
import { kit, buildWayBack, placeBoss, pictureAim } from './picturelands.js';

export const SIZE = [192, 192];
export const WALL = { t: 4, top: 47 };                 // x/z 0..3 and 188..191 solid WALLPAPER y 1..47; baseboard WOOL.paper on the inner face y 1..2
export const FLOOR = { y: 0, square: 4 };              // HOUSE_FLOOR / HOUSE_FLOOR_DARK checker of 4 x 4 squares at y 0 (TRACK cells replace it)
export const ARRIVE = { door: { x: 24, y: 0, z: 184, facing: [0, -1] } }; // buildWayBack(world, 'house', ...): you arrive at (24.5, 1, 181.5) facing north
export const COUNTER = { x: [4, 139], z: [4, 27], top: 30 };              // CUPBOARD solid y 1..30
export const CUPBOARD_ROOM = { x: [98, 125], z: [6, 25], y: [1, 28] };    // air inside the counter (the keyhole way)
export const KEYHOLE = { x: 110, z: [26, 27], y: [1, 2], frame: [[109, 1, 27], [109, 2, 27], [109, 3, 27], [111, 1, 27], [111, 2, 27], [111, 3, 27], [110, 3, 27]] };
export const HATCH = { x: [113, 124], z: [6, 7], y: [29, 30] };           // a long hole in the roof of the cupboard room: the cans climb up through it (T40a: 12 x 2 so you can jump while you climb; under the roof stand 24 is the most that can jump on)
export const SINK = { rim: { x: [24, 48], z: [8, 22], y: 30 }, basin: { x: [25, 47], z: [9, 21], y: [29, 30] }, sponge: { x: [25, 26], z: [9, 10], y: 29 } };
export const TAP = { column: { x: [35, 37], z: [4, 5], y: [31, 37] }, arm: { x: 36, z: [6, 11], y: 37 }, spout: [36, 36, 11],
  handles: [[34, 32, 5], [38, 32, 5]], stream: { x: 36, z: 11, y: [31, 35] } };
export const GROOVE = { x: [48, 97], z: [14, 16], y: 30 };                // air cut into the counter top (dry: walk in it; wet: 1 deep water)
export const CLUTTER = [                                                 // fills the counter top beside the groove, so the groove is the way along
  { id: 'toaster', box: [52, 66, 4, 13, 31, 42] },
  { id: 'breadbin', box: [70, 92, 4, 13, 31, 40] },
  { id: 'dishrack', box: [50, 95, 17, 27, 31, 39] },
];
export const SPOON = { x: [112, 114], steps: [[28, 30, 30], [31, 33, 29], [34, 36, 28], [37, 39, 27], [40, 43, 26]], bowl: { x: [111, 115], z: [40, 43] }, handle: { z: [22, 27], y: 31 } };
export const SHELF = { x: [4, 19], z: [31, 124], y: [32, 33], walk: { x: [12, 19] }, steps: [[30, 32], [29, 31], [28, 30]] }; // matchbox steps: [z, block y], WOOL.fire
export const FAN = { c: [11.5, 127.5], rings: [[5.5, 1, 'CHROME'], [4.5, 2, 'CHROME'], [3.5, 3, 'FAN_GRILL']], switch: [[11, 1, 134], [12, 1, 134]],
  lift: { id: 'fan', x: [9, 14], z: [125, 130], y: [4, 33] } };          // the lift is NOT in world.lifts until the fan is on (houselive.js)
export const TABLE = { x: [56, 135], z: [44, 83], y: [24, 25], legs: { x: [[57, 60], [131, 134]], z: [[45, 48], [79, 82]] } };
export const COOKIE = { c: [96, 64], r: 7.5, y: 26, boss: { x: 96, y: 26, z: 64, facing: [0, 1] } }; // placeBoss: Nibbles at (96.5, 27, 64.5), rest 3 south
export const BENCH = { x: [56, 135], z: [86, 97], y: [13, 14], legs: { x: [[57, 59], [96, 98], [132, 134]], z: [[87, 89], [94, 96]] } };
export const BOOKS = { x: [58, 69], z: [86, 88], from: 15, bridge: { x: [58, 60], z: [84, 85], y: 25 }, colors: ['fire', 'water', 'grass', 'electric', 'mind'] };
  // block column at x = 69 - k (k 0..10) up to block y 15 + k (stand 16 + k); x 58 = the landing (block y 25)
export const CAT = { body: [80, 95, 89, 97, 15, 20], head: [92, 97, 90, 96, 15, 22], ears: [[93, 94, 90, 91, 23], [93, 94, 95, 96, 23]],
  eyes: [[97, 20, 91], [97, 20, 92], [97, 20, 94], [97, 20, 95]], nose: [97, 18, 93], muzzle: [97, 97, 92, 94, 17, 18],
  tailRest: [74, 79, 96, 97, 15, 15], tailUp: [[78, 79, 86, 88, 15, 16], [78, 79, 89, 95, 15, 15]], // tailUp = set with LiveCells while awake
  ear: [97.5, 93.5], strip: { x: [70, 135], z: [86, 88], y: 15 } };
export const RAMP = { x: [136, 163], z: [90, 94], track: [91, 93] };     // step i (0..13): x 162-2i..163-2i, block y i+1 (GIANT_WOOD below, TRACK on top)
export const TRACK = {
  floor: [[30, 172, 173, 175], [169, 171, 92, 175], [164, 171, 91, 93]],  // [x0, x1, z0, z1] of TRACK at y 0
  bench: [100, 135, 91, 93],                                              // TRACK replaces the bench seat's top layer (y 14)
  points: [[30, 1.5, 174.5], [166, 1.5, 174.5], [170.5, 1.5, 170], [170.5, 1.5, 97], [166, 1.5, 92.5], [164, 2.2, 92.5], [137, 15.7, 92.5], [100, 15.7, 92.5]], // T40a: the ramp line runs 0.2 above the steps' edges so the 0.6-wide rider never clips the next step
  stops: { S: [40.5, 1.5, 174.5], N: [116.5, 15.7, 92.5] },               // the rider's feet at the two stations
  remotes: { S: { body: [38, 43, 178, 179, 1], button: [40, 1, 178] }, N: { body: [114, 119, 95, 96, 15], button: [116, 15, 95] } }, // body WOOL.cyber
};
// The bottle cap's two lines along the groove (feet heights; the last point is on dry counter, or over the sink's water).
export const CAP_LINES = { east: [[50.5, 31, 15.5], [96.5, 31, 15.5], [99.5, 31, 15.5]], west: [[96.5, 31, 15.5], [50.5, 31, 15.5], [47.5, 31, 15.5]] };
// Arc lengths along TRACK.points (the whole polyline), the two stops on it, and the points of the ride from stop S to stop N.
export function trackInfo() {
  const pts = TRACK.points, cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const arcOf = p => {
    let best = 0, bd = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len2 = dx * dx + dy * dy + dz * dz;
      const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / len2));
      const d = Math.hypot(a[0] + dx * k - p[0], a[1] + dy * k - p[1], a[2] + dz * k - p[2]);
      if (d < bd) { bd = d; best = cum[i - 1] + Math.sqrt(len2) * k; }
    }
    return best;
  };
  const sOf = { S: arcOf(TRACK.stops.S), N: arcOf(TRACK.stops.N) };
  const mid = pts.filter((_, i) => cum[i] > sOf.S && cum[i] < sOf.N);
  return { cum, total: cum[cum.length - 1], sOf, toN: [TRACK.stops.S, ...mid, TRACK.stops.N] };
}
export const MOUSE_HOLE = { door: { x: 3, z: [148, 149], y: [1, 3] }, tunnel: { x: [1, 2], z: [82, 149] }, exit: { x: 3, z: [82, 83], y: [34, 36] } };
  // stand(z) = 1 + floor((149 - z) / 2): z 149 -> 1 ... z 82 -> 34 (= the shelf's stand); air from stand to stand + 3
export const SECRETS = [                                               // boxes the "no secret ways" BFS treats as walls
  { id: 'mousehole', box: [1, 3, 80, 150, 1, 38] },
  { id: 'keyhole', box: [98, 125, 6, 27, 1, 30] },                     // the whole cupboard room + the keyhole + the hatch (x to 125: the hatch is x 119..122)
];
export const CRUMBS = [ /* [x, y, z]: the crumb's own cell (solid below it); 12, ids c0..c11 by index, append-only */
  [30, 1, 166], [16, 1, 138], [90, 1, 130], [1, 10, 130], [1, 25, 100], [8, 34, 95], [16, 34, 45], [8, 31, 20],
  [104, 1, 20], [124, 1, 24], [64, 26, 78], [130, 26, 48] ];
// Nooks: { kind, at: [x, y, z] (the air cell the creature sits in), front: [fx, fz] (the open side), mat, roof? }. `hut` kinds get a
// small open-fronted shelter (a tipped cup, a leaf pile...), `crack` kinds are a notch in the baseboard, `open` kinds need no build.
export const NOOKS = [
  { kind: 'leaf', at: [35, 1, 151], front: [0, 1], hut: 'LEAVES' }, { kind: 'leaf', at: [151, 1, 121], front: [-1, 0], hut: 'LEAVES' }, { kind: 'leaf', at: [61, 1, 141], front: [0, -1], hut: 'LEAVES' },
  { kind: 'flower', at: [181, 4, 146], front: [0, 1], pot: 1 }, { kind: 'flower', at: [134, 32, 22], front: [0, 1], pot: 2 },
  { kind: 'cup', at: [71, 26, 53], front: [1, 0], hut: 'WOOL.paper' }, { kind: 'cup', at: [130, 31, 10], front: [0, 1], hut: 'WOOL.fire' }, { kind: 'cup', at: [8, 34, 64], front: [1, 0], hut: 'WOOL.paper' },
  { kind: 'thimble', at: [8, 34, 51], front: [1, 0], hut: 'CHROME' }, { kind: 'thimble', at: [8, 34, 110], front: [1, 0], hut: 'CHROME' },
  { kind: 'jar', at: [7, 34, 72], front: [1, 0], hut: 'GLASS' },
  { kind: 'slipper', at: [42, 1, 102], front: [0, 1], hut: 'WOOL.pixie' }, { kind: 'slipper', at: [48, 1, 104], front: [0, 1], hut: 'WOOL.pixie' },
  { kind: 'crack', at: [3, 1, 60], front: [1, 0] }, { kind: 'crack', at: [188, 1, 120], front: [-1, 0] }, { kind: 'crack', at: [100, 1, 3], front: [0, 1] }, { kind: 'crack', at: [60, 1, 188], front: [0, -1] },
  { kind: 'shadow', at: [70, 1, 92], front: [0, 1] }, { kind: 'shadow', at: [125, 1, 90], front: [0, 1] },
  { kind: 'can', at: [100, 1, 8], front: [0, 1] }, { kind: 'can', at: [124, 1, 22], front: [0, -1] },
  { kind: 'sugar', at: [118, 26, 60], front: [0, 1], hut: 'CHROME', roof: 'WOOL.paper' },
];
export const RESTS = [[12.5, 34, 100.5], [10.5, 31, 24.5], [130.5, 15, 87.5], [72.5, 15, 87.5], [70.5, 26, 70.5], [100.5, 1, 140.5], [100.5, 1, 20.5]];

// The stair of cans in the cupboard room: 2-wide columns along the south wall (west), the west wall (north), the north wall (east),
// then up through the hatch. Column i has its top at stand CAN_STAND(i); never more than 1 up per column, about 1 up per 2 columns.
export const CAN_COLUMNS = (() => {
  const cols = [];
  for (let x = 110; x >= 100; x--) cols.push([[x, 24], [x, 25]]);
  for (let z = 25; z >= 8; z--) cols.push([[98, z], [99, z]]);
  for (let x = 98; x < HATCH.x[0]; x++) cols.push([[x, 6], [x, 7]]);
  for (let x = HATCH.x[0]; x <= HATCH.x[1]; x++) cols.push([[x, 6], [x, 7]]);
  return cols;
})();
const UNDER = CAN_COLUMNS.length - (HATCH.x[1] - HATCH.x[0] + 1); // the columns under the roof: up to stand 24 (the roof is at y 29: a jump needs room)
export const CAN_STAND = i => (i < UNDER ? 1 + Math.floor(i * 23 / (UNDER - 1)) : 25 + Math.floor((i - UNDER) / 2));

// Keep boxes: nobody can build or break there (riders are fenced out too). { x0, x1, y0, y1, z0, z1 } inclusive.
const K = (name, x0, x1, z0, z1, y0, y1, wallText) => ({ name, protect: [{ x0, x1, y0, y1, z0, z1 }], wallText });
const HOUSE_TEXT = "It's the Wizard's house. Everything is too big to change!";
export const KEEPS = [
  K('fan', 5, 18, 121, 135, 1, 34, HOUSE_TEXT), K('shelf', 4, 19, 28, 124, 26, 37, HOUSE_TEXT), K('counter', 4, 139, 4, 27, 26, 44, HOUSE_TEXT),
  K('cupboard', 96, 127, 4, 28, 1, 30, HOUSE_TEXT), K('spoon', 110, 116, 28, 47, 24, 31, HOUSE_TEXT), K('table', 56, 135, 44, 83, 24, 30, HOUSE_TEXT),
  K('bench', 56, 135, 84, 97, 13, 26, 'Shh! Let the cat sleep.'), K('ramp', 136, 165, 89, 95, 1, 17, HOUSE_TEXT), K('stationS', 28, 48, 171, 180, 0, 4, HOUSE_TEXT),
  K('tunnel', 1, 3, 80, 150, 1, 38, HOUSE_TEXT), K('keyhole', 108, 112, 26, 28, 1, 3, HOUSE_TEXT),
];

export function houseLand(world, def) {
  kit(world);
  const { W, D } = world;
  const rand = mulberry32((world.seed ^ 0x40a) >>> 0);
  const put = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  const fill = (x0, x1, y0, y1, z0, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, id); };
  const ring = (cx, cz, r, y, id) => { for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r) put(x, y, z, id); };
  const blk = name => (name.startsWith('WOOL.') ? WOOL[name.slice(5)] : B[name]);

  // 1. the floor (a checker of 4 x 4 squares; a few scuffs from the seed) and the walls with their baseboards
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) put(x, 0, z, ((x >> 2) + (z >> 2)) & 1 ? B.HOUSE_FLOOR_DARK : B.HOUSE_FLOOR);
  for (let k = 0; k < 14; k++) { const x = 8 + Math.floor(rand() * 172), z = 8 + Math.floor(rand() * 172); put(x, 0, z, ((x >> 2) + (z >> 2)) & 1 ? B.HOUSE_FLOOR : B.HOUSE_FLOOR_DARK); }
  fill(0, 3, 1, WALL.top, 0, D - 1, B.WALLPAPER); fill(W - 4, W - 1, 1, WALL.top, 0, D - 1, B.WALLPAPER);
  fill(0, W - 1, 1, WALL.top, 0, 3, B.WALLPAPER); fill(0, W - 1, 1, WALL.top, D - 4, D - 1, B.WALLPAPER);
  fill(3, 3, 1, 2, 3, D - 4, WOOL.paper); fill(W - 4, W - 4, 1, 2, 3, D - 4, WOOL.paper);
  fill(3, W - 4, 1, 2, 3, 3, WOOL.paper); fill(3, W - 4, 1, 2, D - 4, D - 4, WOOL.paper);

  // 2. the mouse hole in the west wall, the tunnel up inside it and its exit onto the shelf
  const md = MOUSE_HOLE;
  fill(md.door.x, md.door.x, md.door.y[0], md.door.y[1], md.door.z[0], md.door.z[1], B.AIR);
  for (let z = md.tunnel.z[0]; z <= md.tunnel.z[1]; z++) { const s = 1 + Math.floor((149 - z) / 2); fill(md.tunnel.x[0], md.tunnel.x[1], s, s + 3, z, z, B.AIR); }
  fill(md.exit.x, md.exit.x, md.exit.y[0], md.exit.y[1], md.exit.z[0], md.exit.z[1], B.AIR);

  // 3. the counter: cupboard body, the room inside with the keyhole, the cans and the hatch, the sink, the tap, the river groove,
  //    the clutter on both sides of it, the spoon
  fill(COUNTER.x[0], COUNTER.x[1], 1, COUNTER.top, COUNTER.z[0], COUNTER.z[1], B.CUPBOARD);
  const R = CUPBOARD_ROOM;
  fill(R.x[0], R.x[1], R.y[0], R.y[1], R.z[0], R.z[1], B.AIR);
  fill(KEYHOLE.x, KEYHOLE.x, KEYHOLE.y[0], KEYHOLE.y[1], KEYHOLE.z[0], KEYHOLE.z[1], B.AIR);
  for (const [x, y, z] of KEYHOLE.frame) put(x, y, z, B.KEYHOLE);
  fill(HATCH.x[0], HATCH.x[1], HATCH.y[0], HATCH.y[1], HATCH.z[0], HATCH.z[1], B.AIR);
  const cans = [WOOL.metal, WOOL.fire, WOOL.electric];
  CAN_COLUMNS.forEach((cells, i) => { const top = CAN_STAND(i) - 1; for (const [x, z] of cells) fill(x, x, 1, top, z, z, cans[Math.floor(i / 4) % 3]); });
  const sk = SINK;
  fill(sk.basin.x[0], sk.basin.x[1], sk.basin.y[0], sk.basin.y[1], sk.basin.z[0], sk.basin.z[1], B.AIR);
  fill(sk.sponge.x[0], sk.sponge.x[1], sk.sponge.y, sk.sponge.y, sk.sponge.z[0], sk.sponge.z[1], WOOL.electric);
  fill(TAP.column.x[0], TAP.column.x[1], TAP.column.y[0], TAP.column.y[1], TAP.column.z[0], TAP.column.z[1], B.CHROME);
  fill(TAP.arm.x, TAP.arm.x, TAP.arm.y, TAP.arm.y, TAP.arm.z[0], TAP.arm.z[1], B.CHROME);
  put(...TAP.spout, B.CHROME);
  for (const [x, y, z] of TAP.handles) put(x, y, z, B.TAP_HANDLE);
  fill(GROOVE.x[0], GROOVE.x[1], GROOVE.y, GROOVE.y, GROOVE.z[0], GROOVE.z[1], B.AIR);
  for (const c of CLUTTER) {
    const [x0, x1, z0, z1, y0, y1] = c.box;
    const main = c.id === 'toaster' ? WOOL.fire : c.id === 'breadbin' ? B.GIANT_WOOD : B.CHROME;
    fill(x0, x1, y0, y1, z0, z1, main);
    if (c.id === 'toaster') fill(x0, x1, y1, y1, z0, z1, B.CHROME);
    if (c.id === 'dishrack') { // plates stand on edge in the rack: stripes of paper wool (a few blue ones from the seed)
      for (let x = x0 + 1; x <= x1 - 1; x += 3) { const id = rand() < 0.3 ? WOOL.water : WOOL.paper; fill(x, x + 1, y0 + 2, y1, z0, z1, id); }
    }
  }
  const sp = SPOON;
  fill(sp.x[0], sp.x[1], sp.handle.y, sp.handle.y, sp.handle.z[0], sp.handle.z[1], B.CHROME);
  for (const [z0, z1, top] of sp.steps) fill(sp.x[0], sp.x[1], top, top, z0, z1, B.CHROME);
  fill(sp.bowl.x[0], sp.bowl.x[1], 26, 26, sp.bowl.z[0], sp.bowl.z[1], B.CHROME);

  // 4. the shelf along the west wall, brackets under it and the matchbox steps down to the counter
  const sf = SHELF;
  fill(sf.x[0], sf.x[1], sf.y[0], sf.y[1], sf.z[0], sf.z[1], B.GIANT_WOOD);
  for (const z of [35, 55, 75, 95, 115]) fill(4, 5, 28, 31, z, z, B.CHROME);
  for (const [z, y] of sf.steps) fill(sf.walk.x[0], sf.walk.x[1], 1, y, z, z, WOOL.fire);

  // 5. the fan: a stepped round housing, the grill on top, the switch beside it
  for (const [r, y, name] of FAN.rings) ring(FAN.c[0], FAN.c[1], r, y, B[name]);
  for (const [x, y, z] of FAN.switch) put(x, y, z, B.FAN_SWITCH);

  // 6. the table with its legs, the giant cookie (Nibbles' stand in its middle), sugar cubes
  const tb = TABLE;
  fill(tb.x[0], tb.x[1], tb.y[0], tb.y[1], tb.z[0], tb.z[1], B.GIANT_WOOD);
  for (const xr of tb.legs.x) for (const zr of tb.legs.z) fill(xr[0], xr[1], 1, tb.y[0] - 1, zr[0], zr[1], B.GIANT_WOOD);
  for (let x = 80; x <= 112; x++) for (let z = 48; z <= 80; z++) {
    const d = Math.hypot(x - COOKIE.c[0], z - COOKIE.c[1]);
    if (d > COOKIE.r) continue;
    const bite = z < COOKIE.c[1] && d > 5 && Math.abs(x - COOKIE.c[0]) <= 4; // a bite out of the north side
    if (!bite) put(x, COOKIE.y, z, B.COOKIE);
  }
  fill(110, 112, 26, 28, 72, 74, WOOL.paper);
  placeBoss(world, 'house', COOKIE.boss);

  // 7. the bench, the books up to the table, the sleeping cat, the train track on its seat
  const bn = BENCH;
  fill(bn.x[0], bn.x[1], bn.y[0], bn.y[1], bn.z[0], bn.z[1], B.GIANT_WOOD);
  for (const xr of bn.legs.x) for (const zr of bn.legs.z) fill(xr[0], xr[1], 1, bn.y[0] - 1, zr[0], zr[1], B.GIANT_WOOD);
  for (let k = 0; k <= 10; k++) fill(69 - k, 69 - k, BOOKS.from, BOOKS.from + k, BOOKS.z[0], BOOKS.z[1], WOOL[BOOKS.colors[k % BOOKS.colors.length]]);
  fill(58, 58, BOOKS.from, 25, BOOKS.z[0], BOOKS.z[1], WOOL.mind);
  fill(BOOKS.bridge.x[0], BOOKS.bridge.x[1], BOOKS.bridge.y, BOOKS.bridge.y, BOOKS.bridge.z[0], BOOKS.bridge.z[1], B.GIANT_WOOD);
  const c = CAT;
  fill(c.body[0], c.body[1], c.body[4], c.body[5], c.body[2], c.body[3], B.CAT_FUR);
  for (const x of [c.body[0], c.body[1]]) for (const z of [c.body[2], c.body[3]]) put(x, c.body[5], z, B.AIR); // trimmed corners
  fill(c.head[0], c.head[1], c.head[4], c.head[5], c.head[2], c.head[3], B.CAT_FUR);
  for (const [x0, x1, z0, z1, y] of c.ears) { fill(x0, x0, y, y, z0, z1, B.CAT_FUR); fill(x1, x1, y, y, z0, z1, WOOL.pixie); }
  for (const [x, y, z] of c.eyes) put(x, y, z, B.CAT_EYE);
  fill(c.muzzle[0], c.muzzle[1], c.muzzle[4], c.muzzle[5], c.muzzle[2], c.muzzle[3], WOOL.paper);
  put(...c.nose, WOOL.pixie);
  fill(c.tailRest[0], c.tailRest[1], c.tailRest[4], c.tailRest[5], c.tailRest[2], c.tailRest[3], B.CAT_FUR);
  const tb2 = TRACK.bench;
  fill(tb2[0], tb2[1], 14, 14, tb2[2], tb2[3], B.TRACK);

  // 8. the ramp up to the bench, the track across the floor, the two remotes
  for (let i = 0; i <= 13; i++) {
    const x1 = 163 - 2 * i, x0 = x1 - 1;
    fill(x0, x1, 1, i + 1, RAMP.z[0], RAMP.z[1], B.GIANT_WOOD);
    fill(x0, x1, i + 1, i + 1, RAMP.track[0], RAMP.track[1], B.TRACK);
  }
  for (const [x0, x1, z0, z1] of TRACK.floor) fill(x0, x1, 0, 0, z0, z1, B.TRACK);
  for (const r of Object.values(TRACK.remotes)) { const [x0, x1, z0, z1, y] = r.body; fill(x0, x1, y, y, z0, z1, WOOL.cyber); put(...r.button, B.REMOTE_BUTTON); }

  // 9. the nooks (small shelters with an open front), the flower pots, the crumbs
  const nooks = [];
  for (const n of NOOKS) {
    const [x, y, z] = n.at, [fx, fz] = n.front, sx = Math.abs(fz), sz = Math.abs(fx);
    nooks.push({ kind: n.kind, x, y, z });
    if (n.kind === 'crack') { put(x, y, z, B.AIR); continue; }
    if (n.pot === 1) { // a flowerpot by the east wall: rock sides 2 high, dirt on top, a tall stem with a crown of leaves
      fill(178, 184, 1, 2, 140, 146, WOOL.rock); fill(178, 184, 3, 3, 140, 146, B.DIRT);
      for (const [dx, dz] of [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1]]) put(x + dx, y, z + dz, B.FLOWER_BUSH);
      fill(181, 181, 4, 16, 142, 142, B.LOG); fill(179, 183, 15, 17, 140, 144, B.LEAVES); fill(181, 181, 15, 16, 142, 142, B.LOG);
      continue;
    }
    if (n.pot === 2) { // a small pot on the counter
      fill(132, 136, 31, 31, 18, 22, WOOL.rock); fill(133, 135, 31, 31, 19, 21, B.DIRT);
      for (const [dx, dz] of [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1]]) put(x + dx, y, z + dz, B.FLOWER_BUSH);
      fill(134, 134, 32, 37, 19, 19, B.LOG); fill(132, 136, 36, 38, 17, 21, B.LEAVES); fill(134, 134, 36, 37, 19, 19, B.LOG);
      put(x, y, z, B.AIR);
      continue;
    }
    if (!n.hut) continue;
    const mat = blk(n.hut), roof = blk(n.roof ?? n.hut);
    for (let d = -1; d <= 1; d++) for (let s = -1; s <= 1; s++) {
      const hx = x + fx * d + sx * s, hz = z + fz * d + sz * s;
      const back = d === -1, side = s !== 0 && d >= 0;
      if (back || side) fill(hx, hx, y, y + 1, hz, hz, mat);
      if (d >= -1 && (back || d >= 0)) put(hx, y + 2, hz, roof);
    }
    put(x, y, z, B.AIR); put(x, y + 1, z, B.AIR); put(x + fx, y, z + fz, B.AIR); put(x + fx, y + 1, z + fz, B.AIR);
  }
  CRUMBS.forEach(([x, y, z]) => put(x, y, z, B.CRUMB));

  // 10. the way back (the frame at the arrival)
  buildWayBack(world, 'house', ARRIVE.door);

  // 11. bookkeeping: ground = the highest solid cell of each column; lifts (the fan adds its own), nooks, rests, keeps, the live part
  const solid = id => id !== B.AIR && id !== B.WATER;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    let g = 0;
    for (let y = WALL.top; y > 0; y--) if (solid(world.data[world.index(x, y, z)])) { g = y; break; }
    world.ground[x + z * W] = g;
  }
  world.lifts = [];
  world.nooks = nooks;
  world.rests.push(...RESTS);
  world.keeps.push(...KEEPS.map(k => ({ ...k, protect: k.protect.map(b => ({ ...b })) })));
  world.parts.push({ id: 'house', live: 'house' });
  world.house = { fan: FAN, track: TRACK, groove: GROOVE, sink: SINK, tap: TAP, cat: CAT, crumbs: CRUMBS, secrets: SECRETS, spoon: SPOON, books: BOOKS,
    shelf: SHELF, hatch: HATCH, canColumns: CAN_COLUMNS, boss: world.bosses[0], size: SIZE };
}

// The guide in the Giant House: { x, z, text(arrow, metres) }, by where you are (the first match wins). With the star won it
// is the way back (pictureAim). `game.gymLive.of('part:house')` says where the train is and whether the cat is awake.
export function houseAim(world, p, game) {
  if (game?.stars?.includes('house')) return pictureAim(world, p, { stars: game.stars, via: game.realms?.via });
  const h = world.house, live = game?.gymLive?.of?.('part:house');
  const to = (x, z, text) => ({ x, z, text });
  const boss = h.boss.pos;
  const in2 = (x0, x1, z0, z1) => p.x >= x0 && p.x < x1 + 1 && p.z >= z0 && p.z < z1 + 1;
  const carry = game?.player?.carry;
  if (carry && live?.trainMover?.(carry)) return to(TRACK.stops.N[0], TRACK.stops.N[2], a => `🚂 Choo choo! Off to the table ${a}`);
  if (carry && live?.capMover?.(carry)) return to(99.5, 15.5, a => `🧢 Float along the river ${a}`);
  const tab = TABLE, bn = BENCH;
  if (p.y >= 25 && in2(tab.x[0], tab.x[1], tab.z[0], tab.z[1])) return to(boss[0], boss[2], (a, m) => `🍪 Nibbles on the cookie ${a} ${m}m`);
  if (p.y >= 30.5 && in2(COUNTER.x[0], COUNTER.x[1], COUNTER.z[0], COUNTER.z[1]) && p.x >= 98) return to(113.5, 28.5, (a, m) => `🥄 Down the spoon to the table ${a} ${m}m`);
  if (p.y < 31 && p.y >= 29.5 && in2(GROOVE.x[0], GROOVE.x[1], GROOVE.z[0], GROOVE.z[1])) return to(97.5, 15.5, (a, m) => `Along the river ${a} ${m}m`);
  if (p.y >= 30.5 && in2(COUNTER.x[0], COUNTER.x[1], COUNTER.z[0], COUNTER.z[1])) return to(50.5, 15.5, (a, m) => `🚰 Turn on the tap and float! ${a} ${m}m`);
  if (p.y >= 33 && in2(SHELF.x[0], SHELF.x[1], 28, 124)) return to(15.5, 29.5, (a, m) => `Along the shelf to the counter ${a} ${m}m`);
  if (in2(1, 2, 82, 149) && p.y > 1) return to(4.5, 83, a => `Up the mouse tunnel ${a}`);
  if (in2(CUPBOARD_ROOM.x[0], CUPBOARD_ROOM.x[1], CUPBOARD_ROOM.z[0], CUPBOARD_ROOM.z[1]) && p.y < 30) return to(HATCH.x[0] + 4.5, HATCH.z[0] + 1, a => `Up the cans ${a}`);
  if (p.y >= 13 && in2(bn.x[0], bn.x[1], bn.z[0], bn.z[1])) {
    if (p.x < 80) return to(69.5, 87.5, (a, m) => `📚 Up the books to the table ${a} ${m}m`);
    if (live?.catAwake?.()) return to(76, 87.5, () => '💤 Shh... wait for the cat to sleep');
    return to(76, 87.5, a => `🐈 Tiptoe past the cat! Walk, don't run ${a}`);
  }
  if (p.y > 1.5 && in2(RAMP.x[0], RAMP.x[1] + 2, RAMP.z[0], RAMP.z[1])) return to(TRACK.stops.N[0], TRACK.stops.N[2], (a, m) => `Up the toy ramp ${a} ${m}m`);
  // on the floor: the toy train is the big hit; the ramp when the train is away and the ramp is nearer
  const S = TRACK.stops.S, atS = live?.trainAt?.() !== 'N';
  const dRamp = Math.hypot(164 - p.x, 92 - p.z), dRemote = Math.hypot(40 - p.x, 178 - p.z);
  if (atS || dRemote < dRamp) return to(40.5, 177.5, (a, m) => `🚂 Toy train! Press the remote ${a} ${m}m`);
  return to(164.5, 92.5, (a, m) => `Up the toy ramp ${a} ${m}m`);
}
