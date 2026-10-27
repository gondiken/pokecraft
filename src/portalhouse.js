// T42: the Portal House, in the north-east sky of the Swirl (plans/T42.md). Data + builder, Node-runnable like swirlland.js: it needs only
// a world with W / D / data / ground / index / inBounds / get (the spec runs it on a stand-in too).
//
// The House is the home of the Portal creatures. Its rooms float apart in the sky and are joined only by swirls:
//   Porch (round deck) -> Hall of Swirls (5 doors) -> room 1 Gap Room (aim far), room 2 Fling Room (jump from the right height),
//   room 3 Clock Room (wait for the right moment), room 4 Skip Hall (re-aim while you fly) -> the Study (Grandpa Arch, the Boss).
// Everything is fixed blocks (nobody can break or build there); a swirl is a record (portalplay.js) plus, for most of them, a solid slab
// of blocks behind the disc (PO_PANEL = a white pad for YOUR swirl, PO_RIM = an orange swirl). A door swirl is a doorway into a small
// alcove (air + a back plate): the live part draws its vortex. All rooms are "pit rooms": a soft Swirl Cloud floor catches every fall.
//
// Heights (top block y): street (porch, Hall, room 1) 12; room 1 pit 2; room 2 pit 4; room 3 pit 6; room 4 platforms 37 over a floor at
// 27; the Study 28. Room 4 sits above the street so the House looks stacked, like a real house.
import { B } from './blocks.js';
import { kit, buildWayBack, placeBoss, placeCrew } from './picturelands.js'; // buildWayBack is not used; kit / placeBoss / placeCrew are
import { PORTAL, roomKey } from './portalplay.js';

export const R = { x0: 92, x1: 159, y0: 1, y1: 47, z0: 0, z1: 35 }; // the House's volume in the Swirl (160 x 160 x 48): all air before
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
// A ceiling swirl on the roof's bottom layer y = `ceil` (cells x[0]..x[1], z[0]..z[1]).
function ceiling(id, room, kind, colour, x, z, ceil, extra = {}) {
  const cells = [];
  for (let a = x[0]; a <= x[1]; a++) for (let c = z[0]; c <= z[1]; c++) cells.push([a, ceil, c]);
  return { id, room, kind, colour, face: 'ceiling', normal: [0, -1, 0], centre: [(x[0] + x[1] + 1) / 2, ceil, (z[0] + z[1] + 1) / 2], w: x[1] - x[0] + 1, h: z[1] - z[0] + 1, cells, ...extra };
}

/* ---------- the places ---------- */
export const HUB = { x: [50, 52], z: [72, 74], top: 20, front: [51.5, 21, 76.8, PI] }; // the Hub Swirl on the hub deck (a mesh, no blocks)
export const PORCH = { c: [99, 24], r: 5.5, top: 12, arrive: [102.5, 13, 24.5, -PI / 2], posts: [[94, 21], [94, 27]] };
export const HOUSE_LIFT = { id: 'house', x: [92, 93], z: [23, 24], y: [1, 14] }; // from the cloud sea up to the porch
export const HALL = { box: { x0: 104, x1: 120, z0: 16, z1: 32 }, top: 12, roof: 19, entrance: { x: 104, z: [23, 25], y: [13, 15] }, kit: [111.5, 13, 24.5, -PI / 2], healer: [117.5, 13, 28.5, PI] };
export const DOOR_X = [[106, 107], [109, 110], [112, 113], [115, 116], [118, 119]]; // the Hall's five doors on its north wall (rooms 1-4 and the Study)
// Where you come out in the Hall when you go back through a room's Hall swirl: in front of its own door.
export const hallFront = n => [DOOR_X[n - 1][0] + 1, 13, 19.0, PI];

export const ROOM_BOXES = {
  gap: { x0: 124, x1: 152, z0: 19, z1: 32, bottom: 1, top: 23 },
  fling: { x0: 140, x1: 158, z0: 1, z1: 16, bottom: 1, top: 37 },
  clock: { x0: 96, x1: 109, z0: 1, z1: 12, bottom: 1, top: 45 },
  skip: { x0: 100, x1: 154, z0: 22, z1: 32, bottom: 26, top: 47 },
  study: { x0: 122, x1: 136, z0: 2, z1: 14, bottom: 23, top: 44 },
};
export const STUDY = { top: 30, boss: { x: 129, y: 30, z: 11, facing: [0, -1] }, start: [130.0, 31, 5.0, PI] };

// Platforms: [x0, x1, z0, z1, top, taper = 1] (a 2-thick slab: the top block and one under it, then a short taper).
export const PLATFORMS = {
  gap: [[125, 130, 20, 31, 12], [137, 141, 20, 23, 12], [143, 147, 29, 31, 12], [148, 151, 21, 28, 17]],
  fling: [[156, 157, 2, 7, 20], [154, 155, 2, 7, 13], [152, 153, 2, 7, 8], [142, 151, 8, 14, 8], [141, 145, 8, 14, 21]],
  clock: [[99, 103, 2, 3, 24], [99, 103, 4, 8, 14], [104, 108, 5, 9, 19, 0], [104, 108, 5, 9, 27, 0]], // the two landing ledges have no taper: a flat underside; too low an orange swirl just sends you back to your own pad
  skip: [[101, 105, 23, 31, 34], [113, 117, 23, 31, 34], [125, 129, 23, 31, 34], [137, 141, 23, 31, 34], [149, 153, 23, 31, 34]],
  study: [[123, 135, 3, 13, 30]],
};

const PIT_X = [[106, 112], [118, 124], [130, 136], [142, 148]]; // room 4's four pits (each with an orange swirl in its floor)
const PAD_X = [[114, 116], [126, 128], [138, 140], [150, 152]]; // and its four white pads, on the platform after each pit

// ---- all swirls ----
const gh = n => ({ to: hallFront(n), home: true }); // a swirl back to the Hall (the little house sign)
export const SWIRLS = [
  // the Hub Swirl on the hub deck and the Porch Swirl: warps (no slab)
  floor('hub', 'hub', 'warp', 'violet', HUB.x, HUB.z, HUB.top, { slab: false, to: PORCH.arrive }),
  floor('porch', 'porch', 'warp', 'violet', [96, 98], [26, 28], PORCH.top, { slab: false, to: HUB.front }),
  // the Hall: five doors, a pink pair to learn "in one, out the other"
  ...DOOR_X.map((lat, i) => wall(`hall.d${i + 1}`, 'hall', 'door', 'gold', 'z', 17, +1, lat, [13, 15], { door: i + 1, alcove: true })),
  wall('hall.pinkA', 'hall', 'pair', 'pink', 'z', 32, -1, [107, 108], [13, 15], { pair: 'hall.pinkB' }),
  wall('hall.pinkB', 'hall', 'pair', 'pink', 'z', 32, -1, [116, 117], [13, 15], { pair: 'hall.pinkA' }),
  // room 1: the Gap Room (aim far)
  wall('gap.o', 1, 'orange', 'orange', 'x', 125, +1, [25, 26], [13, 15]),
  floor('gap.p1', 1, 'slot', 'teal', [138, 140], [20, 22], 12),
  floor('gap.p2', 1, 'slot', 'teal', [144, 146], [29, 31], 12),
  ceiling('gap.p3', 1, 'slot', 'teal', [149, 151], [23, 25], 22),
  wall('gap.home', 1, 'door', 'gold', 'z', 32, -1, [127, 128], [13, 15], { alcove: true, ...gh(1) }),
  wall('gap.exit', 1, 'door', 'gold', 'x', 152, -1, [24, 25], [18, 20], { alcove: true, exit: true }),
  // room 2: the Fling Room (from how high?)
  floor('fling.o', 2, 'orange', 'orange', [152, 157], [8, 14], 4),
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
  ...PIT_X.map((x, i) => floor(`skip.o${i + 1}`, 4, 'orange', 'orange', x, [24, 30], 27)),
  ...PAD_X.map((x, i) => floor(`skip.p${i + 1}`, 4, 'slot', 'teal', x, [26, 28], 34, i < 3 ? { lean: { dir: [1, 0], deg: 25 } } : { soft: true })),
  wall('skip.home', 4, 'door', 'gold', 'x', 101, +1, [27, 28], [35, 37], { alcove: true, ...gh(4) }),
  wall('skip.exit', 4, 'door', 'gold', 'x', 154, -1, [27, 28], [35, 37], { alcove: true, exit: true }),
  // the Study
  wall('study.home', 5, 'door', 'gold', 'z', 3, +1, [129, 130], [31, 33], { alcove: true, to: [DOOR_X[4][0] + 1, 13, 19.0, PI], home: true }),
];
export const swirlById = id => SWIRLS.find(s => s.id === id);

// ---- rooms ----
// start: where a door puts you ([x, y, z, yaw]); exit: the swirl that counts the room as done; catch: falling below `y` inside `box` puts you back at the start.
export const ROOMS = [
  { n: 1, id: 'gap', name: 'Gap Room', box: ROOM_BOXES.gap, start: [127.5, 13, 25.5, -PI / 2], hall: 'gap.home', exit: 'gap.exit', catchY: 3.4, wand: false,
    rule: 'Put your swirl across the gap, then walk into the orange one!', sparks: [[139.5, 14.6, 21.5], [145.5, 14.6, 30.5], [149.5, 19.6, 24.5]], slots: ['gap.p1', 'gap.p2', 'gap.p3'], oranges: ['gap.o'] },
  { n: 2, id: 'fling', name: 'Fling Room', box: ROOM_BOXES.fling, start: [156.5, 21, 4.5, PI], hall: 'fling.home', exit: 'fling.exit', catchY: 5.4, wand: false,
    rule: 'Speedy in, speedy out! Jump from higher to fly further.', sparks: [[149.5, 10.8, 11], [146.3, 10.8, 11], [142.8, 10.8, 11]], slots: ['fling.low', 'fling.high'], oranges: ['fling.o'] },
  { n: 3, id: 'clock', name: 'Clock Room', box: ROOM_BOXES.clock, start: [101.5, 25, 3.0, PI], hall: 'clock.home', exit: 'clock.exit', catchY: 7.4, wand: false,
    rule: 'The orange swirl goes up and down. Jump in while it goes up!', sparks: [[106.0, 21.6, 7.0], [106.0, 29.4, 7.0]], slots: ['clock.p'], oranges: ['clock.o'] },
  { n: 4, id: 'skip', name: 'Skip Hall', box: ROOM_BOXES.skip, start: [103.0, 35, 27.5, -PI / 2], hall: 'skip.home', exit: 'skip.exit', catchY: 28.4, wand: false,
    rule: 'Quick! While you fly, tap the next white pad!', hintLoop: 'Tap the next white pad while you fly!', sparks: [[118.3, 38.0, 27.5], [130.3, 38.0, 27.5], [142.3, 38.0, 27.5]], // where the arcs from pads 1-3 peak
    slots: ['skip.p1', 'skip.p2', 'skip.p3', 'skip.p4'], oranges: ['skip.o1', 'skip.o2', 'skip.o3', 'skip.o4'] },
];
export const STUDY_ROOM = { n: 5, id: 'study', name: 'Study', box: ROOM_BOXES.study, start: STUDY.start, hall: 'study.home' };

// What the five hall doors lead to, by door number: [room start].
export const doorTarget = n => (n <= 4 ? ROOMS[n - 1].start : STUDY.start);

// The calm parts (wild Portal creatures live there): xz boxes.
export const CALM = [{ x0: 92, x1: 104, z0: 18, z1: 30 }, { x0: 105, x1: 119, z0: 17, z1: 31 }, { x0: 123, x1: 135, z0: 3, z1: 13 }];

// Every part's volume (for the keeps and the layout rules): { id, box, calm? }. Boxes include the back plates of the door alcoves.
export const PARTS = [
  { id: 'porch', box: { x0: 92, x1: 104, y0: 1, y1: 18, z0: 18, z1: 30 } },
  { id: 'hall', box: { x0: 104, x1: 120, y0: 6, y1: 20, z0: 15, z1: 32 } },
  { id: 'gap', box: { x0: 124, x1: 153, y0: 1, y1: 23, z0: 19, z1: 33 } },
  { id: 'fling', box: { x0: 139, x1: 159, y0: 1, y1: 37, z0: 0, z1: 16 } },
  { id: 'clock', box: { x0: 96, x1: 110, y0: 1, y1: 45, z0: 0, z1: 12 } },
  { id: 'skip', box: { x0: 99, x1: 155, y0: 26, y1: 47, z0: 22, z1: 32 } },
  { id: 'study', box: { x0: 122, x1: 136, y0: 23, y1: 44, z0: 1, z1: 14 } },
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
    fill(x0 - 0, x1, roofBottom + 1, roofBottom + 1, z0, z1, B.PO_ROOF);
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

  /* 1. the porch, with two lamp posts, and the lift from the cloud sea */
  round(PORCH.c[0], PORCH.c[1], PORCH.r, PORCH.top);
  for (const [x, z] of PORCH.posts) { put(x, PORCH.top + 1, z, B.SWIRL_STONE); put(x, PORCH.top + 2, z, B.SWIRL_STONE); put(x, PORCH.top + 3, z, B.LAMP); }

  /* 2. the Hall of Swirls */
  const H = HALL.box;
  shell({ x0: H.x0, x1: H.x1, z0: H.z0, z1: H.z1, floorTop: HALL.top, roofBottom: HALL.roof, taper: 5 });
  fill(HALL.entrance.x, HALL.entrance.x, HALL.entrance.y[0], HALL.entrance.y[1], HALL.entrance.z[0], HALL.entrance.z[1], B.AIR); // the open front door
  for (const [x0, x1, y0, y1, z0, z1] of [[120, 120, 14, 17, 19, 20], [120, 120, 14, 17, 28, 29], [111, 113, 14, 17, 32, 32]]) fill(x0, x1, y0, y1, z0, z1, B.GLASS); // windows: the Gap Room, the Hall's south side
  /* 3. the rooms */
  const G = ROOM_BOXES.gap, F = ROOM_BOXES.fling, C = ROOM_BOXES.clock, S = ROOM_BOXES.skip, T = ROOM_BOXES.study;
  shell({ x0: G.x0, x1: G.x1, z0: G.z0, z1: G.z1, floorTop: 2, roofBottom: 22, floorId: B.SWIRL_CLOUD });
  shell({ x0: F.x0, x1: F.x1, z0: F.z0, z1: F.z1, floorTop: 4, roofBottom: 36, floorId: B.SWIRL_CLOUD });
  shell({ x0: C.x0, x1: C.x1, z0: C.z0, z1: C.z1, floorTop: 6, roofBottom: 44, floorId: B.SWIRL_CLOUD });
  shell({ x0: S.x0, x1: S.x1, z0: S.z0, z1: S.z1, floorTop: 27, roofBottom: 46, floorId: B.SWIRL_CLOUD });
  shell({ x0: T.x0, x1: T.x1, z0: T.z0, z1: T.z1, floorTop: STUDY.top, roofBottom: 43, taper: 6 });
  // glass windows: the Gap Room looks at the Hall, the Study looks at the Wizard's tower (far to the south)
  fill(124, 124, 14, 16, 22, 23, B.GLASS);
  fill(128, 130, 33, 35, 14, 14, B.GLASS);
  for (const k of ['gap', 'fling', 'clock', 'skip', 'study']) for (const [x0, x1, z0, z1, top, taper = 1] of PLATFORMS[k]) slab(x0, x1, z0, z1, top, B.PO_FLOOR, taper);

  /* 4. the swirls: slabs (white pads, orange swirls), alcoves (doors) */
  for (const s of SWIRLS) {
    if (s.kind === 'slot') for (const [x, y, z] of s.cells) put(x, y, z, B.PO_PANEL);
    else if ((s.kind === 'orange' || s.kind === 'pair') && !s.move) for (const [x, y, z] of s.cells) put(x, y, z, B.PO_RIM);
    else if (s.alcove) { // doorway cells: the Hall's doors 2-5 start shut (PO_SHUT, opened with setLive); a back plate behind every doorway
      for (const [x, y, z] of s.cells) put(x, y, z, s.room === 'hall' && s.door > 1 ? B.PO_SHUT : B.AIR);
      const [nx, , nz] = s.normal;
      for (const [x, y, z] of s.cells) put(x - nx, y, z - nz, B.PO_WALL);
    }
  }
  // the orange rail of room 3: two glowing strips either side of the sliding swirl
  fill(96, 96, 15, 41, 5, 5, B.PO_RAIL); fill(96, 96, 15, 41, 8, 8, B.PO_RAIL);
  /* 5. the door at the Study, the Boss, the crew */
  kit(world);
  const boss = placeBoss(world, 'portal', STUDY.boss);
  placeCrew(world, 'portal', 0, { x: 111, y: 12, z: 24, facing: [-1, 0] }); // Keeper Kit in the Hall
  placeCrew(world, 'portal', 1, { x: 151, y: 34, z: 24, facing: [0, 1] }); // Keeper Juno at the end of the Skip Hall
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
  for (let x = 107; x <= 117; x += 2) for (let z = 21; z <= 29; z += 2) nooks.push({ x, y: HALL.top + 1, z });
  for (let x = 124; x <= 134; x += 2) for (let z = 7; z <= 12; z += 2) if (Math.hypot(x + 0.5 - (STUDY.boss.x + 0.5), z + 0.5 - (STUDY.boss.z + 0.5)) > 3.5) nooks.push({ x, y: STUDY.top + 1, z });
  world.nooks = nooks;
  world.realmBiome = (x, z) => (CALM.some(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) ? 'portal' : 'swirl');

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
