// T42: the Portal House, in the north-east sky of the Swirl (plans/T42.md, "Rooms rework (owner 2026-10-27)"). Data + builder,
// Node-runnable like swirlland.js: it needs only a world with W / D / data / ground / index / inBounds / get (the spec runs it on a stand-in).
//
// The House is the home of the Portal creatures. Its rooms float apart in the sky and are joined only by swirls:
//   Porch (round deck) -> Hall of Swirls (9 doors) -> eight swirl rooms, each teaching one idea, the later ones mixing two:
//     1 Gap Room (aim far)              2 Fling Room (jump from the right height)   3 Clock Room (wait for the moving orange swirl)
//     4 Skip Hall (re-aim while flying) 5 Pair Room (you make BOTH ends: peach pads) 6 Slider Room (your pad slides: step in on time)
//     7 Ball Room (send the Swirl Ball onto the button: point the orange end)      8 Loop Room (round and round, faster, then re-aim)
//   -> the Study (Grandpa Arch, the Boss), up on top of the porch.
// Everything is fixed blocks (nobody can break or build there); a swirl is a record (portalplay.js) plus, for most of them, a solid slab
// of blocks behind the disc (PO_PANEL = a white pad for YOUR teal swirl, PO_PEACH = a peach pad for YOUR orange swirl, PO_RIM = a fixed
// orange swirl). A door swirl is a doorway into a small alcove (air + a back plate): the live part draws its vortex. Every room is a
// "pit room": a soft Swirl Cloud floor catches every fall.
//
// Draw calls (owner 2026-10-27: the House cost 218 calls looking east from the hub): every House block is in the chunks x 80..159,
// z 0..31 (no House block at z 32 or more), the House's blocks never glow (no second mesh per chunk), and its people are drawn only
// while you are in their part (portalhouselive.js). Rooms are stacked (Ball under Loop, Fling under Slider, Study over the porch):
// a block more in a chunk costs nothing, a new chunk costs a draw call.
import { B } from './blocks.js';
import { kit, placeBoss, placeCrew } from './picturelands.js';
import { PORTAL, roomKey } from './portalplay.js';

export const R = { x0: 85, x1: 159, y0: 1, y1: 47, z0: 0, z1: 31 }; // the House's volume in the Swirl (160 x 160 x 48): all air before
export const WORLD_H = 48;
const PI = Math.PI;

/* ---------- swirl records ---------- */
// A wall swirl on the interior face `plane` of a wall along `axis` ('x': the wall is a plane x = const), `n` = the way you come out
// (+1 / -1), `lat` = the cell range along the other horizontal axis, `y` = the cell range in height.
function wall(id, room, kind, colour, axis, plane, n, lat, y, extra = {}) {
  const mid = (lat[0] + lat[1] + 1) / 2, wc = n > 0 ? plane - 1 : plane, cells = [];
  for (let l = lat[0]; l <= lat[1]; l++) for (let h = y[0]; h <= y[1]; h++) cells.push(axis === 'x' ? [wc, h, l] : [l, h, wc]);
  return { id, room, kind, colour, face: 'wall', axis, wallCell: wc, normal: axis === 'x' ? [n, 0, 0] : [0, 0, n], centre: axis === 'x' ? [plane, (y[0] + y[1] + 1) / 2, mid] : [mid, (y[0] + y[1] + 1) / 2, plane],
    w: lat[1] - lat[0] + 1, h: y[1] - y[0] + 1, cells, lat, yr: y, ...extra };
}
// A floor swirl on the top blocks `top` (y of the top block) of the cells x[0]..x[1], z[0]..z[1] (or no slab: `slab: false`).
function floor(id, room, kind, colour, x, z, top, extra = {}) {
  const cells = [];
  if (extra.slab !== false) for (let a = x[0]; a <= x[1]; a++) for (let c = z[0]; c <= z[1]; c++) cells.push([a, top, c]);
  return { id, room, kind, colour, face: 'floor', normal: [0, 1, 0], centre: [(x[0] + x[1] + 1) / 2, top + 1, (z[0] + z[1] + 1) / 2], w: x[1] - x[0] + 1, h: z[1] - z[0] + 1, cells, ...extra };
}
// A ceiling swirl on the roof's bottom layer y = `ceil` (cells x[0]..x[1], z[0]..z[1]; `slab: false` = a pad drawn as a mesh, no blocks).
function ceiling(id, room, kind, colour, x, z, ceil, extra = {}) {
  const cells = [];
  if (extra.slab !== false) for (let a = x[0]; a <= x[1]; a++) for (let c = z[0]; c <= z[1]; c++) cells.push([a, ceil, c]);
  return { id, room, kind, colour, face: 'ceiling', normal: [0, -1, 0], centre: [(x[0] + x[1] + 1) / 2, ceil, (z[0] + z[1] + 1) / 2], w: x[1] - x[0] + 1, h: z[1] - z[0] + 1, cells, ...extra };
}

/* ---------- the places ---------- */
export const HUB = { x: [50, 52], z: [72, 74], top: 20, front: [51.5, 21, 76.8, PI] }; // the Hub Swirl on the hub deck (a mesh, no blocks)
export const PORCH = { c: [99, 24], r: 5.5, top: 12, arrive: [102.5, 13, 24.5, -PI / 2], posts: [[94, 21], [94, 27]] };
export const HOUSE_LIFT = { id: 'house', x: [92, 93], z: [23, 24], y: [1, 14] }; // from the cloud sea up to the porch
export const HALL = { box: { x0: 104, x1: 120, z0: 15, z1: 31 }, top: 12, roof: 19, entrance: { x: 104, z: [23, 25], y: [13, 15] }, kit: [111.5, 13, 24.5, -PI / 2], healer: [112.5, 13, 29.5, 0] };
// The Hall's nine doors: five on its north wall (rooms 1-5), four on its east wall (rooms 6-8 and the Study).
export const DOOR_N = [[106, 107], [109, 110], [112, 113], [115, 116], [118, 119]];
export const DOOR_E = [[18, 19], [21, 22], [24, 25], [27, 28]];
export const DOORS = 9;
// Where you come out in the Hall when you go back through a room's Hall swirl: in front of its own door, facing into the Hall.
export const hallFront = n => (n <= 5 ? [DOOR_N[n - 1][0] + 1, 13, 18.0, PI] : [118.0, 13, DOOR_E[n - 6][0] + 1, PI / 2]);

// Room shells: x0..x1, z0..z1 (the walls), bottom..top (the whole shell: under the floor to the roof). floorTop / roofBottom: the floor
// layer (a cloud in the pit rooms) and the ceiling layer.
export const ROOM_BOXES = {
  gap: { x0: 124, x1: 152, z0: 17, z1: 30, bottom: 1, top: 23, floorTop: 2, roofBottom: 22 },
  fling: { x0: 140, x1: 158, z0: 1, z1: 14, bottom: 1, top: 37, floorTop: 4, roofBottom: 36 },
  clock: { x0: 96, x1: 109, z0: 1, z1: 11, bottom: 1, top: 45, floorTop: 6, roofBottom: 44 },
  skip: { x0: 100, x1: 154, z0: 20, z1: 30, bottom: 26, top: 47, floorTop: 27, roofBottom: 46 },
  pair: { x0: 86, x1: 93, z0: 1, z1: 11, bottom: 8, top: 27, floorTop: 9, roofBottom: 26 },
  slide: { x0: 140, x1: 158, z0: 1, z1: 13, bottom: 40, top: 47, floorTop: 41, roofBottom: 46 },
  ball: { x0: 113, x1: 136, z0: 1, z1: 11, bottom: 1, top: 20, floorTop: 3, roofBottom: 19 },
  loop: { x0: 113, x1: 135, z0: 1, z1: 13, bottom: 24, top: 47, floorTop: 25, roofBottom: 46 },
  study: { x0: 85, x1: 96, z0: 18, z1: 30, bottom: 25, top: 43, floorTop: 30, roofBottom: 42 },
};
export const STUDY = { top: 30, boss: { x: 90, y: 30, z: 27, facing: [0, -1] }, start: [91.0, 31, 21.0, PI] };

// Platforms: [x0, x1, z0, z1, top, taper = 1] (a 2-thick slab: the top block and one under it, then a short taper).
export const PLATFORMS = {
  gap: [[125, 130, 18, 29, 12], [137, 141, 18, 21, 12], [143, 147, 27, 29, 12], [148, 151, 19, 26, 17]],
  fling: [[156, 157, 2, 7, 20], [154, 155, 2, 7, 13], [152, 153, 2, 7, 8], [142, 151, 8, 13, 8], [141, 145, 8, 13, 21]],
  clock: [[99, 103, 2, 3, 24], [99, 103, 4, 8, 14], [104, 108, 5, 9, 19, 0], [104, 108, 5, 9, 27, 0]], // the two landing ledges have no taper: a flat underside; too low an orange swirl just sends you back to your own pad
  skip: [[101, 105, 21, 29, 34], [113, 117, 21, 29, 34], [125, 129, 21, 29, 34], [137, 141, 21, 29, 34], [149, 153, 21, 29, 34]],
  pair: [[87, 92, 2, 4, 14, 0], [87, 92, 8, 10, 20, 0]],               // the start ledge and the high shelf (6 up: no jump gets there)
  slide: [[141, 143, 2, 12, 42, 0], [149, 151, 2, 12, 42, 0]],          // the start ledge and the middle ledge (5 cells of cloud between)
  ball: [[114, 119, 2, 4, 10, 0], [121, 134, 5, 9, 12, 0]],             // the start ledge and the button shelf (2 up: only the ball gets there)
  loop: [[115, 119, 2, 4, 32, 0], [129, 134, 4, 10, 28, 0]],            // the start ledge beside the shaft and the exit ledge across the gap
  study: [],
};

const PIT_X = [[106, 112], [118, 124], [130, 136], [142, 148]]; // room 4's four pits (each with an orange swirl in its floor)
const PAD_X = [[114, 116], [126, 128], [138, 140], [150, 152]]; // and its four white pads, on the platform after each pit

// ---- all swirls ----
const gh = n => ({ to: hallFront(n), home: true }); // a swirl back to the Hall (the little house sign)
export const SWIRLS = [
  // the Hub Swirl on the hub deck and the Porch Swirl: warps (no slab)
  floor('hub', 'hub', 'warp', 'violet', HUB.x, HUB.z, HUB.top, { slab: false, to: PORCH.arrive }),
  floor('porch', 'porch', 'warp', 'violet', [96, 98], [26, 28], PORCH.top, { slab: false, to: HUB.front }),
  // the Hall: nine doors, a pink pair to learn "in one, out the other"
  ...DOOR_N.map((lat, i) => wall(`hall.d${i + 1}`, 'hall', 'door', 'gold', 'z', 16, +1, lat, [13, 15], { door: i + 1, alcove: true })),
  ...DOOR_E.map((lat, i) => wall(`hall.d${i + 6}`, 'hall', 'door', 'gold', 'x', 120, -1, lat, [13, 15], { door: i + 6, alcove: true })),
  wall('hall.pinkA', 'hall', 'pair', 'pink', 'z', 31, -1, [107, 108], [13, 15], { pair: 'hall.pinkB' }),
  wall('hall.pinkB', 'hall', 'pair', 'pink', 'z', 31, -1, [116, 117], [13, 15], { pair: 'hall.pinkA' }),
  // room 1: the Gap Room (aim far)
  wall('gap.o', 1, 'orange', 'orange', 'x', 125, +1, [23, 24], [13, 15]),
  floor('gap.p1', 1, 'slot', 'teal', [138, 140], [18, 20], 12),
  floor('gap.p2', 1, 'slot', 'teal', [144, 146], [27, 29], 12),
  ceiling('gap.p3', 1, 'slot', 'teal', [149, 151], [21, 23], 22),
  wall('gap.home', 1, 'door', 'gold', 'z', 30, -1, [127, 128], [13, 15], { alcove: true, ...gh(1) }),
  wall('gap.exit', 1, 'door', 'gold', 'x', 152, -1, [22, 23], [18, 20], { alcove: true, exit: true }),
  // room 2: the Fling Room (from how high?)
  floor('fling.o', 2, 'orange', 'orange', [152, 157], [8, 13], 4),
  wall('fling.low', 2, 'slot', 'teal', 'x', 158, -1, [10, 11], [18, 20]),
  wall('fling.high', 2, 'slot', 'teal', 'x', 158, -1, [10, 11], [30, 32]),
  wall('fling.home', 2, 'door', 'gold', 'z', 2, +1, [156, 157], [21, 23], { alcove: true, ...gh(2) }),
  wall('fling.exit', 2, 'door', 'gold', 'x', 141, +1, [10, 11], [22, 24], { alcove: true, exit: true }),
  // room 3: the Clock Room (wait for it): the orange swirl slides up and down its rail
  wall('clock.o', 3, 'orange', 'orange', 'x', 97, +1, [6, 7], [16, 18], { slab: false, move: { y0: 17.5, y1: 37.5, period: 5 } }),
  floor('clock.p', 3, 'slot', 'teal', [99, 103], [4, 8], 14),
  wall('clock.home', 3, 'door', 'gold', 'z', 2, +1, [100, 101], [25, 27], { alcove: true, ...gh(3) }),
  wall('clock.exit', 3, 'door', 'gold', 'x', 109, -1, [6, 7], [28, 30], { alcove: true, exit: true }),
  // room 4: the Skip Hall (quick, while you fly): four orange swirls in the pits, four white pads that lean forward
  ...PIT_X.map((x, i) => floor(`skip.o${i + 1}`, 4, 'orange', 'orange', x, [22, 28], 27)),
  ...PAD_X.map((x, i) => floor(`skip.p${i + 1}`, 4, 'slot', 'teal', x, [24, 26], 34, i < 3 ? { lean: { dir: [1, 0], deg: 25 } } : { soft: true })),
  wall('skip.home', 4, 'door', 'gold', 'x', 101, +1, [25, 26], [35, 37], { alcove: true, ...gh(4) }),
  wall('skip.exit', 4, 'door', 'gold', 'x', 154, -1, [25, 26], [35, 37], { alcove: true, exit: true }),
  // room 5: the Pair Room (both ends are yours): a white and a peach pad by the start, a peach pad in the pit, a white and a peach pad on the shelf
  wall('pair.w1', 5, 'slot', 'teal', 'x', 87, +1, [2, 3], [15, 17]),
  floor('pair.k1', 5, 'peach', 'orange', [88, 90], [5, 7], 9),
  floor('pair.w2', 5, 'slot', 'teal', [90, 92], [8, 10], 20, { soft: true }),
  wall('pair.k2', 5, 'peach', 'orange', 'x', 87, +1, [9, 10], [23, 25]), // high on the wall, so you see it from the start over the shelf's edge
  wall('pair.home', 5, 'door', 'gold', 'z', 2, +1, [90, 91], [15, 17], { alcove: true, ...gh(5) }),
  wall('pair.exit', 5, 'door', 'gold', 'z', 11, -1, [88, 89], [21, 23], { alcove: true, exit: true }),
  // room 6: the Slider Room (your pad slides along the ceiling): walk into the orange swirl when your pad is over the middle ledge
  wall('slide.o', 6, 'orange', 'orange', 'x', 141, +1, [6, 7], [43, 45]),
  ceiling('slide.p', 6, 'slot', 'teal', [145, 147], [6, 8], 46, { slab: false, move: { axis: 'x', from: 145.5, to: 156.5, period: 7 } }),
  wall('slide.home', 6, 'door', 'gold', 'z', 2, +1, [142, 143], [43, 45], { alcove: true, ...gh(6) }),
  wall('slide.exit', 6, 'door', 'gold', 'z', 2, +1, [149, 150], [43, 45], { alcove: true, exit: true }),
  // room 7: the Ball Room: the pipe drops a Swirl Ball onto the white pad under it; point your orange swirl at the button shelf
  floor('ball.w1', 7, 'slot', 'teal', [116, 118], [6, 8], 3),
  floor('ball.w2', 7, 'slot', 'teal', [125, 127], [2, 4], 3),
  wall('ball.k1', 7, 'peach', 'orange', 'x', 114, +1, [7, 8], [15, 17]),
  wall('ball.k2', 7, 'peach', 'orange', 'z', 11, -1, [126, 127], [15, 17]),
  wall('ball.home', 7, 'door', 'gold', 'z', 2, +1, [114, 115], [11, 13], { alcove: true, ...gh(7) }),
  wall('ball.exit', 7, 'door', 'gold', 'z', 2, +1, [117, 118], [11, 13], { alcove: true, exit: true, needs: 'ball' }),
  // room 8: the Loop Room: a peach pad in the shaft floor, a white pad in the ceiling over it (round and round, faster and faster),
  // a white pad on the west wall that throws you across the gap (only fast enough after one round)
  floor('loop.k', 8, 'peach', 'orange', [116, 118], [6, 8], 25),
  ceiling('loop.top', 8, 'slot', 'teal', [116, 118], [6, 8], 46),
  wall('loop.w', 8, 'slot', 'teal', 'x', 114, +1, [6, 7], [37, 39]),
  wall('loop.home', 8, 'door', 'gold', 'z', 2, +1, [118, 119], [33, 35], { alcove: true, ...gh(8) }),
  wall('loop.exit', 8, 'door', 'gold', 'x', 135, -1, [6, 7], [29, 31], { alcove: true, exit: true }),
  // the Study
  wall('study.home', 'study', 'door', 'gold', 'z', 19, +1, [90, 91], [31, 33], { alcove: true, to: hallFront(9), home: true }),
];
export const swirlById = id => SWIRLS.find(s => s.id === id);

// ---- rooms ----
// start: where a door puts you ([x, y, z, yaw]); exit: the swirl that counts the room as done; catch: resting below `catchY` inside the
// room puts you back at the start. slots: white pads (your teal swirl), peaches: peach pads (your orange swirl), oranges: fixed orange
// swirls. rule: said when you arrive; hint: after PORTAL.misses soft catches; hintLoop: when the loop stops (loopBack: back to the start).
export const ROOMS = [
  { n: 1, id: 'gap', name: 'Gap Room', idea: 'aim far', box: ROOM_BOXES.gap, start: [127.5, 13, 23.5, -PI / 2], hall: 'gap.home', exit: 'gap.exit', catchY: 3.4,
    rule: 'Put your swirl across the gap, then walk into the orange one!', hint: 'Tip: look at the far white pad up high and tap. Then walk into the orange swirl.',
    sparks: [[139.5, 14.6, 19.5], [145.5, 14.6, 28.5], [149.5, 19.6, 22.5]], slots: ['gap.p1', 'gap.p2', 'gap.p3'], peaches: [], oranges: ['gap.o'], first: 'gap.p3' },
  { n: 2, id: 'fling', name: 'Fling Room', idea: 'higher in, faster out', box: ROOM_BOXES.fling, start: [156.5, 21, 4.5, PI], hall: 'fling.home', exit: 'fling.exit', catchY: 5.4,
    rule: 'Speedy in, speedy out! Jump from higher to fly further.', hint: 'Tip: put your swirl on the HIGH pad and jump from the TOP ledge.',
    sparks: [[149.5, 10.8, 11], [146.3, 10.8, 11], [142.8, 10.8, 11]], slots: ['fling.low', 'fling.high'], peaches: [], oranges: ['fling.o'], first: 'fling.high' },
  { n: 3, id: 'clock', name: 'Clock Room', idea: 'wait for the right moment', box: ROOM_BOXES.clock, start: [101.5, 25, 3.0, PI], hall: 'clock.home', exit: 'clock.exit', catchY: 7.4,
    rule: 'The orange swirl goes up and down. Jump in while it goes up!', hint: 'Tip: jump in just as the orange swirl starts going up.',
    sparks: [[106.0, 21.6, 7.0], [106.0, 29.4, 7.0]], slots: ['clock.p'], peaches: [], oranges: ['clock.o'], first: 'clock.p' },
  { n: 4, id: 'skip', name: 'Skip Hall', idea: 're-aim while you fly', box: ROOM_BOXES.skip, start: [103.0, 35, 25.5, -PI / 2], hall: 'skip.home', exit: 'skip.exit', catchY: 28.4,
    rule: 'Quick! While you fly, tap the next white pad!', hint: 'Tip: look ahead while you fly and tap the next white pad.', hintLoop: 'Tap the next white pad while you fly!',
    sparks: [[118.3, 38.0, 25.5], [130.3, 38.0, 25.5], [142.3, 38.0, 25.5]], // where the arcs from pads 1-3 peak
    slots: ['skip.p1', 'skip.p2', 'skip.p3', 'skip.p4'], peaches: [], oranges: ['skip.o1', 'skip.o2', 'skip.o3', 'skip.o4'], first: 'skip.p1' },
  { n: 5, id: 'pair', name: 'Pair Room', idea: 'you make both ends', box: ROOM_BOXES.pair, start: [89.0, 15, 3.0, PI], hall: 'pair.home', exit: 'pair.exit', catchY: 10.4,
    rule: 'Peach pads take YOUR orange swirl! Put one swirl where you are and one where you want to go.', hint: 'Tip: one swirl down here by you, the other one up on the high shelf!',
    sparks: [[89.5, 12.5, 6.0], [91.5, 21.6, 9.0]], slots: ['pair.w1', 'pair.w2'], peaches: ['pair.k1', 'pair.k2'], oranges: [], first: 'pair.k2' },
  { n: 6, id: 'slide', name: 'Slider Room', idea: 'your pad moves: step in on time', box: ROOM_BOXES.slide, start: [142.5, 43, 7.0, PI / 2], hall: 'slide.home', exit: 'slide.exit', catchY: 42.4,
    rule: 'Your white pad slides along the ceiling! Walk into the orange swirl when it is over the middle ledge.', hint: 'Tip: watch your pad. Walk in just before it gets over the middle ledge!',
    sparks: [[150.5, 43.6, 9.5]], slots: ['slide.p'], peaches: [], oranges: ['slide.o'], first: 'slide.p' },
  { n: 7, id: 'ball', name: 'Ball Room', idea: 'things go through swirls too', box: ROOM_BOXES.ball, start: [116.5, 11, 3.0, PI], hall: 'ball.home', exit: 'ball.exit', catchY: 4.4,
    rule: 'The pipe drops Swirl Balls. Get a ball onto the button up on the shelf to open the door!', hint: 'Tip: your white pad under the pipe, your orange swirl facing the shelf.',
    ball: { mouth: [117.5, 17.0, 7.5], cup: { x0: 121, x1: 135, y0: 13, y1: 16, z0: 5, z1: 10 }, button: [128.5, 13, 7.5], pipe: { x: [116, 118], y: [17, 18], z: [6, 8] } },
    sparks: [[123.0, 13.6, 3.0]], slots: ['ball.w1', 'ball.w2'], peaches: ['ball.k1', 'ball.k2'], oranges: [], first: 'ball.w1' },
  { n: 8, id: 'loop', name: 'Loop Room', idea: 'out of a ceiling you keep your speed', box: ROOM_BOXES.loop, start: [117.0, 33, 3.0, PI], hall: 'loop.home', exit: 'loop.exit', catchY: 26.4, loopBack: true,
    rule: 'Out of a ceiling swirl you keep your speed! Go round once, then tap the wall pad while you fall.', hint: 'Tip: white pad on the ceiling first. Jump in, and while you fall out of the ceiling, tap the wall pad!',
    hintLoop: 'Now tap the white pad on the wall while you fall!',
    sparks: [[117.5, 37.0, 7.5], [124.0, 35.3, 6.5]], slots: ['loop.top', 'loop.w'], peaches: ['loop.k'], oranges: [], first: 'loop.k' },
];
export const STUDY_ROOM = { n: 'study', id: 'study', name: 'Study', box: ROOM_BOXES.study, start: STUDY.start, hall: 'study.home' };
export const LAST_ROOM = ROOMS.length;

// What the nine hall doors lead to, by door number: [room start] (door 9 is the Study).
export const doorTarget = n => (n <= LAST_ROOM ? ROOMS[n - 1].start : STUDY.start);
// Where a room's exit door takes you: the next room, after the last one the Hall in front of the Study door.
export const exitTarget = n => (n < LAST_ROOM ? ROOMS[n].start : hallFront(DOORS));

// The calm parts (wild Portal creatures live there): xz boxes.
export const CALM = [{ x0: 92, x1: 104, z0: 18, z1: 30 }, { x0: 105, x1: 119, z0: 16, z1: 30 }, { x0: 86, x1: 95, z0: 19, z1: 29 }];

// Every part's volume (for the keeps and the layout rules): { id, box }. Boxes include the back plates of the door alcoves.
const shellBox = (b, extra = {}) => ({ x0: b.x0, x1: b.x1, y0: b.bottom, y1: b.top, z0: b.z0, z1: b.z1, ...extra });
export const PARTS = [
  { id: 'porch', box: { x0: 92, x1: 104, y0: 1, y1: 18, z0: 18, z1: 30 } },
  { id: 'hall', box: { x0: 104, x1: 121, y0: 6, y1: 20, z0: 14, z1: 31 } },
  { id: 'gap', box: shellBox(ROOM_BOXES.gap, { x1: 153, z1: 31 }) },
  { id: 'fling', box: shellBox(ROOM_BOXES.fling, { x0: 139, z0: 0 }) },
  { id: 'clock', box: shellBox(ROOM_BOXES.clock, { z0: 0, x1: 110 }) },
  { id: 'skip', box: shellBox(ROOM_BOXES.skip, { x0: 99, x1: 155 }) },
  { id: 'pair', box: shellBox(ROOM_BOXES.pair, { z0: 0, z1: 12 }) },
  { id: 'slide', box: shellBox(ROOM_BOXES.slide, { z0: 0 }) },
  { id: 'ball', box: shellBox(ROOM_BOXES.ball, { z0: 0 }) },
  { id: 'loop', box: shellBox(ROOM_BOXES.loop, { z0: 0, x1: 136 }) },
  { id: 'study', box: shellBox(ROOM_BOXES.study, { z0: 17 }) },
];

/* ---------- the builder ---------- */
export function buildPortalHouse(world) {
  const { W, D } = world;
  const inR = (x, y, z) => x >= R.x0 && x <= R.x1 && y >= R.y0 && y <= R.y1 && z >= R.z0 && z <= R.z1;
  const put = (x, y, z, id) => { if (inR(x, y, z) && world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  const fill = (x0, x1, y0, y1, z0, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, id); };
  const setGround = (x, z, y) => { if (x >= 0 && z >= 0 && x < W && z < D) world.ground[x + z * W] = Math.max(world.ground[x + z * W], y); };

  // A hollow box: floor layer(s) y0..y0+1 (top = cloud / PO_FLOOR), walls, roof, an underside that tapers like the Swirl's decks.
  const shell = ({ x0, x1, z0, z1, floorTop, roofBottom, floorId = B.PO_FLOOR, taper = 0 }) => {
    fill(x0, x1, floorTop - 1, floorTop - 1, z0, z1, floorId === B.SWIRL_CLOUD ? B.SWIRL_CLOUD : B.PO_WALL);
    fill(x0, x1, floorTop, floorTop, z0, z1, floorId);
    for (let k = 1; k <= taper; k++) fill(x0 + k, x1 - k, floorTop - 1 - k, floorTop - 1 - k, z0 + k, z1 - k, B.SWIRL_STONE);
    for (let y = floorTop + 1; y < roofBottom; y++) {
      fill(x0, x1, y, y, z0, z0, B.PO_WALL); fill(x0, x1, y, y, z1, z1, B.PO_WALL);
      fill(x0, x0, y, y, z0, z1, B.PO_WALL); fill(x1, x1, y, y, z0, z1, B.PO_WALL);
    }
    fill(x0, x1, roofBottom, roofBottom, z0, z1, B.PO_WALL);
    fill(x0, x1, roofBottom + 1, roofBottom + 1, z0, z1, B.PO_ROOF);
  };
  // A floating slab (the top block and one under it) with a short taper.
  const slab = (x0, x1, z0, z1, top, id = B.PO_FLOOR, taper = 1) => {
    fill(x0, x1, top, top, z0, z1, id); fill(x0, x1, top - 1, top - 1, z0, z1, B.PO_WALL);
    for (let k = 1; k <= taper; k++) fill(x0 + k, x1 - k, top - 1 - k, top - 1 - k, z0 + k, z1 - k, B.SWIRL_STONE);
  };
  const round = (cx, cz, r, top, taper = 5) => {
    for (let k = 0; k < 2 + taper; k++) {
      const rr = k < 2 ? r : r * (1 - (k - 1) / (taper + 1));
      for (let x = Math.floor(cx - rr - 1); x <= Math.ceil(cx + rr + 1); x++) for (let z = Math.floor(cz - rr - 1); z <= Math.ceil(cz + rr + 1); z++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > rr) continue;
        put(x, top - k, z, k === 0 ? B.PO_FLOOR : k === 1 ? B.PO_WALL : B.SWIRL_STONE);
        if (k === 0) setGround(x, z, top);
      }
    }
  };

  /* 1. the porch, with two posts (their tops are rails: no House block glows, so no chunk gets a second mesh), and the lift from the cloud sea */
  round(PORCH.c[0], PORCH.c[1], PORCH.r, PORCH.top);
  for (const [x, z] of PORCH.posts) { put(x, PORCH.top + 1, z, B.SWIRL_STONE); put(x, PORCH.top + 2, z, B.SWIRL_STONE); put(x, PORCH.top + 3, z, B.PO_RAIL); }

  /* 2. the Hall of Swirls */
  const H = HALL.box;
  shell({ x0: H.x0, x1: H.x1, z0: H.z0, z1: H.z1, floorTop: HALL.top, roofBottom: HALL.roof, taper: 5 });
  fill(HALL.entrance.x, HALL.entrance.x, HALL.entrance.y[0], HALL.entrance.y[1], HALL.entrance.z[0], HALL.entrance.z[1], B.AIR); // the open front door
  fill(111, 113, 14, 17, 31, 31, B.GLASS); // a window on the Hall's south side, between the pink pair
  /* 3. the rooms (shells, platforms, windows) */
  const pit = { gap: 1, fling: 1, clock: 1, skip: 1, pair: 1, slide: 1, ball: 1, loop: 1 };
  for (const [k, b] of Object.entries(ROOM_BOXES)) shell({ ...b, floorId: pit[k] ? B.SWIRL_CLOUD : B.PO_FLOOR, taper: k === 'study' ? 4 : 0 });
  fill(124, 124, 14, 16, 20, 21, B.GLASS);   // the Gap Room looks at the Hall
  fill(89, 92, 33, 35, 30, 30, B.GLASS);     // the Study looks south, at the Wizard's tower
  fill(85, 85, 33, 35, 23, 25, B.GLASS);     // and west, at the hub
  fill(93, 93, 16, 18, 5, 6, B.GLASS);       // the Pair Room looks at the Clock Room
  fill(128, 131, 9, 11, 11, 11, B.GLASS);    // the Ball Room looks south (under the Gap Room)
  fill(122, 125, 39, 41, 13, 13, B.GLASS);   // the Loop Room too
  for (const k of Object.keys(PLATFORMS)) for (const [x0, x1, z0, z1, top, taper = 1] of PLATFORMS[k]) slab(x0, x1, z0, z1, top, B.PO_FLOOR, taper);

  /* 4. the swirls: slabs (white pads, peach pads, orange swirls), alcoves (doors) */
  for (const s of SWIRLS) {
    if (s.kind === 'slot') for (const [x, y, z] of s.cells) put(x, y, z, B.PO_PANEL);
    else if (s.kind === 'peach') for (const [x, y, z] of s.cells) put(x, y, z, B.PO_PEACH);
    else if ((s.kind === 'orange' || s.kind === 'pair') && !s.move) for (const [x, y, z] of s.cells) put(x, y, z, B.PO_RIM);
    else if (s.alcove) { // doorway cells: the Hall's doors 2-9 and the Ball Room's exit start shut (PO_SHUT, opened with setLive); a back plate behind every doorway
      const shut = (s.room === 'hall' && s.door > 1) || s.needs === 'ball';
      for (const [x, y, z] of s.cells) put(x, y, z, shut ? B.PO_SHUT : B.AIR);
      const [nx, , nz] = s.normal;
      for (const [x, y, z] of s.cells) put(x - nx, y, z - nz, B.PO_WALL);
    }
  }
  // the orange rail of room 3: two strips either side of the sliding swirl; the rails of room 6's sliding pad, on the ceiling
  fill(96, 96, 15, 41, 5, 5, B.PO_RAIL); fill(96, 96, 15, 41, 8, 8, B.PO_RAIL);
  fill(144, 157, 46, 46, 5, 5, B.PO_RAIL); fill(144, 157, 46, 46, 9, 9, B.PO_RAIL);
  // room 7: the pipe in the ceiling (a ring of wall round an open middle), a low rail at the far end of the button shelf
  const pipe = ROOMS[6].ball.pipe;
  for (let x = pipe.x[0]; x <= pipe.x[1]; x++) for (let z = pipe.z[0]; z <= pipe.z[1]; z++) for (let y = pipe.y[0]; y <= pipe.y[1]; y++) put(x, y, z, x === (pipe.x[0] + pipe.x[1]) / 2 && z === (pipe.z[0] + pipe.z[1]) / 2 ? B.AIR : B.PO_RAIL);
  /* 5. the Boss, the crew, the healer */
  kit(world);
  const boss = placeBoss(world, 'portal', STUDY.boss);
  placeCrew(world, 'portal', 0, { x: 111, y: 12, z: 24, facing: [-1, 0] }); // Keeper Kit in the Hall
  placeCrew(world, 'portal', 1, { x: 151, y: 34, z: 22, facing: [0, 1] }); // Keeper Juno at the end of the Skip Hall
  world.healer = [HALL.healer[0], HALL.healer[1], HALL.healer[2], HALL.healer[3]];
  if (!world.doors?.length) { if (world.door) world.doors = [world.door]; else delete world.doors; } // kit() made an empty `doors`: the Swirl's one door home stays its only way back

  /* 6. the lift, the keeps, the rests, the calm places */
  world.lifts = [...(world.lifts || []), HOUSE_LIFT];
  const hubKeep = { x0: HUB.x[0], x1: HUB.x[1], y0: HUB.top, y1: HUB.top + 3, z0: HUB.z[0], z1: HUB.z[1] };
  const keepText = "This is the Portal House. It's too magic to build on!";
  const keeps = PARTS.map(p => ({ name: `house-${p.id}`, protect: [p.box], wallText: keepText }));
  keeps.push({ name: 'house-hubswirl', protect: [hubKeep], wallText: 'The Hub Swirl is magic. You cannot build here!' });
  keeps.push({ name: 'house-lift', protect: [{ x0: HOUSE_LIFT.x[0], x1: HOUSE_LIFT.x[1], y0: 1, y1: 24, z0: HOUSE_LIFT.z[0], z1: HOUSE_LIFT.z[1] }], wallText: keepText });
  world.keeps.push(...keeps);
  world.fenceBoxes = null;
  const rests = [PORCH.arrive, ...ROOMS.map(r => r.start), STUDY.start];
  for (const r of rests) world.rests.push(r);

  // nooks: where wild Portal creatures may appear (the porch, the Hall and the Study floors; never on a swirl or in front of a door)
  const nooks = [];
  for (let x = 95; x <= 101; x += 2) for (let z = 20; z <= 28; z += 2) if (Math.hypot(x + 0.5 - PORCH.c[0], z + 0.5 - PORCH.c[1]) < 4.6 && !(x >= 96 && x <= 98 && z >= 26)) nooks.push({ x, y: PORCH.top + 1, z });
  for (let x = 107; x <= 117; x += 2) for (let z = 19; z <= 29; z += 2) nooks.push({ x, y: HALL.top + 1, z });
  for (let x = 87; x <= 94; x += 2) for (let z = 22; z <= 28; z += 2) if (Math.hypot(x + 0.5 - (STUDY.boss.x + 0.5), z + 0.5 - (STUDY.boss.z + 0.5)) > 3.5) nooks.push({ x, y: STUDY.top + 1, z });
  world.nooks = nooks;
  world.realmBiome = (x, z, y) => (CALM.some(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) && (y == null || y >= 8) ? 'portal' : 'swirl');

  const house = { R, swirls: SWIRLS, rooms: ROOMS, study: STUDY_ROOM, hub: HUB, porch: PORCH, hall: HALL, lift: HOUSE_LIFT, parts: PARTS, boss, calm: CALM, platforms: PLATFORMS };
  world.parts.push({ id: 'portalhouse', live: 'portalhouse', house });
  world.swirl.house = house;
  return house;
}

// The guide inside the House (and the first part of the way to it): { x, z, text(arrow, metres) } or null.
export function houseAim(world, p, game) {
  const h = world.swirl?.house;
  if (!h) return null;
  const inside = p.x >= R.x0 - 1 && p.x <= R.x1 + 1 && p.z >= R.z0 && p.z <= R.z1 + 1 && p.y >= 4;
  if (!inside) return null;
  const live = game?.gymLive?.of?.('part:portalhouse');
  const own = live?.aim?.(p);
  if (own) return own;
  return { x: PORCH.arrive[0], z: PORCH.arrive[2], text: (a, m) => `🌀 Portal House ${a} ${m}m` };
}
export { roomKey, PORTAL };
