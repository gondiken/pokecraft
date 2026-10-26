// T40a: the Giant House, the Wizard's kitchen seen by his pet mouse. Terrain as data (like dreamland.js / swirlland.js): 1 block = 3 cm
// of real house, so you (1.8 blocks) are as small as a mouse. A 192 x 192 room with no ceiling: an arrival with the way back, a
// toy train to the fan, a short shelf, a counter with a sink, a tap and a deep river groove, book stairs down to the table (the
// cat sleeps on them), a fort of sugar cubes round the giant cookie (the Boss stands on it) with a spoon seesaw beside it, a bench,
// a mouse hole and a keyhole (two secret ways) and twelve crumbs. T40a.5 (owner 2026-10-26: "more puzzles, less walking"): one way
// up with four puzzles (towel + wind-up fan, plug + tap, yarn + cat, marble + spoon); the puzzle things are models (houseprops.js)
// over hidden HOUSE_PROP cells. Imports only blocks.js and
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
export const SINK = { rim: { x: [24, 48], z: [8, 22], y: 30 }, basin: { x: [25, 47], z: [9, 21], y: [29, 30] }, sponge: { x: [25, 26], z: [9, 10], y: 29 },
  drain: [36, 28, 15], plug: { rim: [44, 31, 22], hole: [36, 29, 15] } }; // T40a.5: the plug lies on the rim (a hidden cell under its model) until you put it in the hole
export const TAP = { column: { x: [35, 37], z: [4, 5], y: [31, 37] }, arm: { x: 36, z: [6, 11], y: 37 }, spout: [36, 36, 11],
  handles: [[34, 32, 5], [38, 32, 5]], stream: { x: 36, z: 11, y: [31, 35] } };
export const GROOVE = { x: [48, 96], z: [14, 16], y: 30, floor: 27 };     // T40a.5: 4 deep (y 27..30); dry you are stuck in it (steps back up at the west end), wet you float;
  // it ends at x 96 so a wall stays between it and the cupboard room (x 98..) below the counter top
export const CLUTTER = [                                                 // fills the counter top beside the groove, so the groove is the way along
  { id: 'toaster', box: [52, 66, 4, 13, 31, 42] },
  { id: 'breadbin', box: [70, 92, 4, 13, 31, 40] },
  { id: 'dishrack', box: [50, 95, 17, 27, 31, 39] },
];
// T40a.5: a stack of cookbooks from the counter down to the table (where the spoon was): [z0, z1, top block y], 6 wide
export const BOOK_STAIRS = { x: [111, 116], steps: [[28, 30, 30], [31, 33, 29], [34, 36, 28], [37, 39, 27], [40, 43, 26]], colors: ['fire', 'water', 'grass', 'electric', 'mind'] };
export const SHELF = { x: [4, 19], z: [31, 50], y: [32, 33], walk: { x: [12, 19] }, steps: [[30, 32], [29, 31], [28, 30]] }; // matchbox steps: [z, block y], WOOL.fire (T40a.5: 20 long, was 94)
// T40a.5: the fan stands just past the shelf's end; a tea towel covers it and a wind-up key (on its box, 10 blocks away by the train
// stop) runs it for `time` seconds. key: the hidden cells under the box model.
export const FAN = { c: [11.5, 53.5], rings: [[5.5, 1, 'CHROME'], [4.5, 2, 'CHROME'], [3.5, 3, 'FAN_GRILL']], key: { cells: [[25, 1, 55], [26, 1, 55]], at: [26, 1, 55.5] },
  time: 12, lift: { id: 'fan', x: [9, 14], z: [51, 56], y: [4, 33] } };   // the lift is NOT in world.lifts until the fan runs (houselive.js)
export const TABLE = { x: [56, 135], z: [44, 83], y: [24, 25], legs: { x: [[57, 60], [131, 134]], z: [[45, 48], [79, 82]] } };
export const COOKIE = { c: [96, 64], r: 7.5, y: 26, boss: { x: 96, y: 26, z: 64, facing: [0, 1] } }; // placeBoss: Nibbles at (96.5, 27, 64.5), rest 3 south
// T40a.5: Nibbles' fort, a ring of sugar cubes (WOOL.paper) 4 high round the cookie; its back door (south) opens only from inside.
export const FORT = { c: [96, 64], r: [10.2, 11.7], y: [26, 29], door: { x: [95, 97], y: [26, 27], z: [74, 75] } };
// The spoon seesaw east of the fort (models in houseprops.js): stand in the bowl, roll the marble down the ruler from the book
// stack, it lands on the handle and flings you over the wall onto the cookie. spoon = the reel's middle on the table (bowl to +x).
export const SEESAW = { pivot: [116.5, 26, 64.5], bowl: [121.1, 26, 64.5], bowlR: 1.7, land: [101.5, 27, 66.5],
  stack: { x: [107, 110], z: [46, 50], top: 32 }, marble: [108.5, 33, 49.5], ruler: [[108.5, 33.25, 50.5], [110.5, 32.2, 63.6]], tip: [110.5, 31.3, 64.5], roll: 8 };
export const BENCH = { x: [56, 135], z: [86, 97], y: [13, 14], legs: { x: [[57, 59], [96, 98], [132, 134]], z: [[87, 89], [94, 96]] } };
// T40a.5: the cat (a model, houseprops.js) sleeps on the top of the book stairs: `cells` (hidden, x 111-116, z 28-36, from each step's
// stand up to y 34) block the way; the model lies along the stairs (head up by the counter, never over it: `tilt` follows the steps). Push the ball of yarn off the counter: it falls to `floor`, the cat jumps down after it, plays
// for `away` seconds and brings it back up.
export const CAT = { at: [114, 29.2, 36], tilt: -0.26, cells: { x: [111, 116], z: [28, 36], top: 34 }, away: 14,
  yarn: { cell: [119, 31, 25], at: [119.5, 31, 25.5], floor: [124.5, 1, 35.5] }, play: [125, 1, 40] }; // it plays on the floor clear of the books
export const RAMP = { x: [136, 163], z: [90, 94] };                      // step i (0..13): x 162-2i..163-2i, block y i+1 (GIANT_WOOD): up to the bench
// T40a.5: the train runs on the floor from the arrival to the fan (no more ramp and bench): S by the arrival, N by the wind-up key.
export const TRACK = {
  floor: [[26, 44, 173, 175], [25, 27, 59, 175]],                         // [x0, x1, z0, z1] of TRACK at y 0
  points: [[44.5, 1.5, 174.5], [30.5, 1.5, 174.5], [26.5, 1.5, 170.5], [26.5, 1.5, 59.5]],
  stops: { S: [40.5, 1.5, 174.5], N: [26.5, 1.5, 64.5] },                 // the rider's feet at the two stations
  remotes: { S: { body: [38, 43, 178, 179, 1], button: [40, 1, 178] }, N: { body: [29, 30, 62, 67, 1], button: [29, 1, 64] } }, // body WOOL.cyber
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
export const MOUSE_HOLE = { door: { x: 3, z: [114, 115], y: [1, 3] }, tunnel: { x: [1, 2], z: [48, 115] }, exit: { x: 3, z: [48, 49], y: [34, 36] } };
  // stand(z) = 1 + floor((115 - z) / 2): z 115 -> 1 ... z 48 -> 34 (= the shelf's stand). T40a.5: 34 further south (the shelf is shorter)
export const tunnelStand = z => 1 + Math.floor((MOUSE_HOLE.door.z[1] - z) / 2); // air from stand to stand + 3
export const SECRETS = [                                               // boxes the "no secret ways" BFS treats as walls
  { id: 'mousehole', box: [1, 3, 46, 116, 1, 38] },
  { id: 'keyhole', box: [98, 125, 6, 27, 1, 30] },                     // the whole cupboard room + the keyhole + the hatch (x to 125: the hatch is x 119..122)
];
export const CRUMBS = [ /* [x, y, z]: the crumb's own cell (solid below it); 12, ids c0..c11 by index, append-only */
  [30, 1, 166], [16, 1, 138], [90, 1, 130], [1, 10, 96], [1, 25, 66], [14, 34, 33], [16, 34, 45], [8, 31, 20], // T40a.5: c3-c5 moved with the tunnel and the shelf
  [104, 1, 20], [124, 1, 24], [64, 26, 78], [130, 26, 48] ];
// Nooks: { kind, at: [x, y, z] (the air cell the creature sits in), front: [fx, fz] (the open side), mat, roof? }. `hut` kinds get a
// small open-fronted shelter (a tipped cup, a leaf pile...), `crack` kinds are a notch in the baseboard, `open` kinds need no build.
export const NOOKS = [
  { kind: 'leaf', at: [35, 1, 151], front: [0, 1], hut: 'LEAVES' }, { kind: 'leaf', at: [151, 1, 121], front: [-1, 0], hut: 'LEAVES' }, { kind: 'leaf', at: [61, 1, 141], front: [0, -1], hut: 'LEAVES' },
  { kind: 'flower', at: [181, 4, 146], front: [0, 1], pot: 1 }, { kind: 'flower', at: [134, 32, 22], front: [0, 1], pot: 2 },
  { kind: 'cup', at: [71, 26, 53], front: [1, 0], hut: 'WOOL.paper' }, { kind: 'cup', at: [130, 31, 10], front: [0, 1], hut: 'WOOL.fire' }, { kind: 'cup', at: [8, 34, 44], front: [1, 0], hut: 'WOOL.paper' },
  { kind: 'thimble', at: [8, 34, 38], front: [1, 0], hut: 'CHROME' }, { kind: 'thimble', at: [70, 15, 94], front: [0, -1], hut: 'CHROME' }, // T40a.5: shelf nooks moved (shorter shelf, the bench is free)
  { kind: 'jar', at: [124, 15, 94], front: [0, -1], hut: 'GLASS' },
  { kind: 'slipper', at: [42, 1, 102], front: [0, 1], hut: 'WOOL.pixie' }, { kind: 'slipper', at: [48, 1, 104], front: [0, 1], hut: 'WOOL.pixie' },
  { kind: 'crack', at: [3, 1, 60], front: [1, 0] }, { kind: 'crack', at: [188, 1, 120], front: [-1, 0] }, { kind: 'crack', at: [100, 1, 3], front: [0, 1] }, { kind: 'crack', at: [60, 1, 188], front: [0, -1] },
  { kind: 'shadow', at: [70, 1, 92], front: [0, 1] }, { kind: 'shadow', at: [125, 1, 90], front: [0, 1] },
  { kind: 'can', at: [100, 1, 8], front: [0, 1] }, { kind: 'can', at: [124, 1, 22], front: [0, -1] },
  { kind: 'sugar', at: [126, 26, 50], front: [0, 1], hut: 'CHROME', roof: 'WOOL.paper' }, // T40a.5: moved clear of the seesaw
];
export const RESTS = [[12.5, 34, 40.5], [10.5, 31, 24.5], [130.5, 15, 87.5], [72.5, 15, 87.5], [70.5, 26, 70.5], [100.5, 1, 140.5], [100.5, 1, 20.5]];

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
  K('fan', 5, 18, 47, 61, 1, 34, HOUSE_TEXT), K('shelf', 4, 19, 28, 50, 26, 37, HOUSE_TEXT), K('counter', 4, 139, 4, 27, 26, 44, HOUSE_TEXT),
  K('cupboard', 96, 127, 4, 28, 1, 30, HOUSE_TEXT), K('books', 109, 118, 28, 44, 1, 36, 'Shh! Let the cat sleep.'), K('table', 56, 135, 44, 83, 24, 36, HOUSE_TEXT),
  K('bench', 56, 135, 84, 97, 13, 26, HOUSE_TEXT), K('ramp', 136, 165, 89, 95, 1, 17, HOUSE_TEXT), K('stationS', 24, 48, 171, 180, 0, 4, HOUSE_TEXT),
  K('stationN', 22, 31, 53, 70, 0, 4, HOUSE_TEXT), K('tunnel', 1, 3, 46, 116, 1, 38, HOUSE_TEXT), K('keyhole', 108, 112, 26, 28, 1, 3, HOUSE_TEXT),
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
  for (let z = md.tunnel.z[0]; z <= md.tunnel.z[1]; z++) { const s = tunnelStand(z); fill(md.tunnel.x[0], md.tunnel.x[1], s, s + 3, z, z, B.AIR); }
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
  put(...sk.drain, B.CHROME); put(...sk.plug.rim, B.HOUSE_PROP);         // the plughole, the plug (on the rim: a hidden cell under its model)
  fill(GROOVE.x[0], GROOVE.x[1], GROOVE.floor, GROOVE.y, GROOVE.z[0], GROOVE.z[1], B.AIR);
  fill(48, 48, 27, 28, GROOVE.z[0], GROOVE.z[1], B.CUPBOARD); fill(49, 49, 27, 27, GROOVE.z[0], GROOVE.z[1], B.CUPBOARD); // two steps back up to the sink
  for (const c of CLUTTER) {
    const [x0, x1, z0, z1, y0, y1] = c.box;
    const main = c.id === 'toaster' ? WOOL.fire : c.id === 'breadbin' ? B.GIANT_WOOD : B.CHROME;
    fill(x0, x1, y0, y1, z0, z1, main);
    if (c.id === 'toaster') fill(x0, x1, y1, y1, z0, z1, B.CHROME);
    if (c.id === 'dishrack') { // plates stand on edge in the rack: stripes of paper wool (a few blue ones from the seed)
      for (let x = x0 + 1; x <= x1 - 1; x += 3) { const id = rand() < 0.3 ? WOOL.water : WOOL.paper; fill(x, x + 1, y0 + 2, y1, z0, z1, id); }
    }
  }
  const bs = BOOK_STAIRS; // cookbooks standing on the floor, each a little lower, down to the table
  bs.steps.forEach(([z0, z1, top], i) => fill(bs.x[0], bs.x[1], 1, top, z0, z1, WOOL[bs.colors[i % bs.colors.length]]));
  for (const [z0, z1, top] of bs.steps) fill(bs.x[0], bs.x[1], top, top, z0, z1, B.GIANT_WOOD); // the top cover (paper-coloured book tops look like pages)
  for (let z = CAT.cells.z[0]; z <= CAT.cells.z[1]; z++) { // the sleeping cat's body: hidden cells on the top steps
    const step = bs.steps.find(([z0, z1]) => z >= z0 && z <= z1);
    fill(CAT.cells.x[0], CAT.cells.x[1], step[2] + 1, CAT.cells.top, z, z, B.HOUSE_PROP);
  }
  put(...CAT.yarn.cell, B.HOUSE_PROP); // the ball of yarn on the counter

  // 4. the shelf along the west wall, brackets under it and the matchbox steps down to the counter
  const sf = SHELF;
  fill(sf.x[0], sf.x[1], sf.y[0], sf.y[1], sf.z[0], sf.z[1], B.GIANT_WOOD);
  for (const z of [35, 45]) fill(4, 5, 28, 31, z, z, B.CHROME);
  for (const [z, y] of sf.steps) fill(sf.walk.x[0], sf.walk.x[1], 1, y, z, z, WOOL.fire);

  // 5. the fan: a stepped round housing, the grill on top, the switch beside it
  for (const [r, y, name] of FAN.rings) ring(FAN.c[0], FAN.c[1], r, y, B[name]);
  for (const [x, y, z] of FAN.key.cells) put(x, y, z, B.HOUSE_PROP); // the wind-up key's box (a model)

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
  const ft = FORT; // the sugar-cube fort round the cookie
  for (let x = ft.c[0] - 12; x <= ft.c[0] + 12; x++) for (let z = ft.c[1] - 12; z <= ft.c[1] + 12; z++) {
    const d = Math.hypot(x + 0.5 - ft.c[0], z + 0.5 - ft.c[1]);
    if (d >= ft.r[0] && d <= ft.r[1]) fill(x, x, ft.y[0], ft.y[1], z, z, WOOL.paper);
  }
  const ss = SEESAW.stack; // the book stack the marble waits on
  for (let x = ss.x[0]; x <= ss.x[1]; x++) fill(x, x, 26, ss.top, ss.z[0], ss.z[1], WOOL[['water', 'fire', 'grass', 'mind'][x - ss.x[0]]]);
  placeBoss(world, 'house', COOKIE.boss);

  // 7. the bench, the books up to the table, the sleeping cat, the train track on its seat
  const bn = BENCH;
  fill(bn.x[0], bn.x[1], bn.y[0], bn.y[1], bn.z[0], bn.z[1], B.GIANT_WOOD);
  for (const xr of bn.legs.x) for (const zr of bn.legs.z) fill(xr[0], xr[1], 1, bn.y[0] - 1, zr[0], zr[1], B.GIANT_WOOD);
  // 8. the ramp up to the bench, the track across the floor, the two remotes
  for (let i = 0; i <= 13; i++) {
    const x1 = 163 - 2 * i, x0 = x1 - 1;
    fill(x0, x1, 1, i + 1, RAMP.z[0], RAMP.z[1], B.GIANT_WOOD);
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
  world.house = { fan: FAN, track: TRACK, groove: GROOVE, sink: SINK, tap: TAP, cat: CAT, crumbs: CRUMBS, secrets: SECRETS, books: BOOK_STAIRS,
    fort: FORT, seesaw: SEESAW, shelf: SHELF, hatch: HATCH, canColumns: CAN_COLUMNS, boss: world.bosses[0], size: SIZE };
}

// The guide in the Giant House: { x, z, text(arrow, metres) }, by where you are (the first match wins). With the star won it
// is the way back (pictureAim). `game.gymLive.of('part:house')` says where the train is and whether the cat is awake.
// T40a.5: one way up, puzzle by puzzle; each step names what to do next (the live part says how far each puzzle is).
export function houseAim(world, p, game) {
  if (game?.stars?.includes('house')) return pictureAim(world, p, { stars: game.stars, via: game.realms?.via });
  const h = world.house, live = game?.gymLive?.of?.('part:house');
  const to = (x, z, text) => ({ x, z, text });
  const boss = h.boss.pos;
  const in2 = (x0, x1, z0, z1) => p.x >= x0 && p.x < x1 + 1 && p.z >= z0 && p.z < z1 + 1;
  const carry = game?.player?.carry;
  if (carry && live?.trainMover?.(carry)) return to(TRACK.stops.N[0], TRACK.stops.N[2], a => `🚂 Choo choo! Off to the fan ${a}`);
  if (carry && live?.capMover?.(carry)) return to(99.5, 15.5, a => `🧢 Float along the river ${a}`);
  if (carry && live?.flingMover?.(carry)) return to(boss[0], boss[2], () => '🥄 Wheee!');
  const tab = TABLE, ss = SEESAW, ft = FORT;
  if (p.y >= 25 && in2(tab.x[0], tab.x[1], tab.z[0], tab.z[1])) {
    if (Math.hypot(p.x - ft.c[0], p.z - ft.c[1]) < ft.r[0]) return to(boss[0], boss[2], (a, m) => `🍪 Nibbles! ${a} ${m}m`);
    const inBowl = Math.hypot(p.x - ss.bowl[0], p.z - ss.bowl[2]) <= ss.bowlR;
    if (live?.marbleRolling?.()) return inBowl ? to(boss[0], boss[2], () => '🥄 Stay in the spoon!') : to(ss.bowl[0], ss.bowl[2], (a, m) => `🥄 Quick! Into the spoon ${a} ${m}m`);
    return to(ss.stack.x[0] + 2, ss.stack.z[1] + 1.5, (a, m) => `🔵 Roll the marble, then jump in the spoon! ${a} ${m}m`);
  }
  if (p.y >= 28 && in2(BOOK_STAIRS.x[0], BOOK_STAIRS.x[1], 28, 43)) return to(113.5, 45, (a, m) => `📚 Down the books ${a} ${m}m`);
  if (p.y < 31 && p.y >= 26.5 && in2(GROOVE.x[0], GROOVE.x[1], GROOVE.z[0], GROOVE.z[1])) {
    if (!live?.wet?.()) return to(48.5, 15.5, (a, m) => `Back up the steps by the sink ${a} ${m}m`);
    return to(97.5, 15.5, (a, m) => `Along the river ${a} ${m}m`);
  }
  if (p.y >= 30.5 && in2(COUNTER.x[0], COUNTER.x[1], COUNTER.z[0], COUNTER.z[1])) {
    if (p.x >= 98) return live?.catAway?.() ? to(113.5, 32, (a, m) => `📚 Quick! Down the books ${a} ${m}m`) : to(CAT.yarn.at[0], CAT.yarn.at[2], (a, m) => `🧶 The cat is on the books. Push the yarn! ${a} ${m}m`);
    if (!live?.plugIn?.()) return to(SINK.plug.rim[0] + 0.5, SINK.plug.rim[2] + 0.5, (a, m) => `🔌 Put the plug in the sink ${a} ${m}m`);
    if (!live?.tapOn) return to(36.5, 6.5, (a, m) => `🚰 Turn on the tap ${a} ${m}m`);
    return to(50.5, 15.5, (a, m) => `🧢 Hop on the bottle cap! ${a} ${m}m`);
  }
  if (p.y >= 33 && in2(SHELF.x[0], SHELF.x[1], 28, SHELF.z[1])) return to(15.5, 29.5, (a, m) => `Along the shelf to the counter ${a} ${m}m`);
  if (in2(MOUSE_HOLE.tunnel.x[0], MOUSE_HOLE.tunnel.x[1], MOUSE_HOLE.tunnel.z[0], MOUSE_HOLE.tunnel.z[1]) && p.y > 1) return to(4.5, MOUSE_HOLE.exit.z[0] + 1, a => `Up the mouse tunnel ${a}`);
  if (in2(CUPBOARD_ROOM.x[0], CUPBOARD_ROOM.x[1], CUPBOARD_ROOM.z[0], CUPBOARD_ROOM.z[1]) && p.y < 30) return to(HATCH.x[0] + 4.5, HATCH.z[0] + 1, a => `Up the cans ${a}`);
  if (p.y > 1.5 && p.y < 34 && Math.hypot(p.x - FAN.c[0], p.z - FAN.c[1]) < 6.5) return live?.fanRunning?.() ? to(FAN.c[0], SHELF.z[1], a => `🌀 Ride the wind up ${a}`) : to(FAN.key.at[0], FAN.key.at[2], (a, m) => `🔑 Wind the key, then run back! ${a} ${m}m`);
  // on the floor: the train to the fan, then the towel and the key
  const dFan = Math.hypot(FAN.c[0] - p.x, FAN.c[1] - p.z);
  if (dFan < 30) {
    if (live?.towelOn) return to(FAN.c[0], FAN.c[1], (a, m) => `🧺 Pull the towel off the fan ${a} ${m}m`);
    if (live?.fanRunning?.()) return to(FAN.c[0], FAN.c[1], (a, m) => `🌀 Run into the wind! ${a} ${m}m`);
    return to(FAN.key.at[0], FAN.key.at[2], (a, m) => `🔑 Wind the key ${a} ${m}m`);
  }
  if (live?.trainAt?.() === 'N') return to(FAN.c[0], FAN.c[1], (a, m) => `To the fan ${a} ${m}m`); // the train is away: walk
  return to(40.5, 177.5, (a, m) => `🚂 Toy train! Press the remote ${a} ${m}m`);
}
