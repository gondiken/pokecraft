// T44: the Room of Doors (TERRAINS.doorsLand, plans/T44.md section 1). A toy-box hall with twelve doors round its walls, a Shuffle Stage in the
// middle, a Pop-Up Room behind the east gold door and the Big Gift behind the north one. Terrain as data and pure: needs only a world with
// W / D / data / ground / index / inBounds / get (the spec runs it on a stand-in in Node, like pirateland.js), and imports no live code.
//
// Coordinates: the hall is a square, interior x / z 40..72 (centre C = 56), floor top y 10 (you stand at 11), walls to y 22, no ceiling.
// A SIDE (south, east, north, west) has a direction out of the hall `o` and a direction along the wall `t`; its three slots sit at offsets
// -11, 0, +11 along it. In slot-local cells (u along the wall from the slot centre, v out of the hall: v 0 = the wall with the door, v 1..9 = the
// room, v 10 = its back wall), world = C + o * (17 + v) + t * (centre + u).
import { B, WOOL } from './blocks.js';
import { kit, flatLand, buildWayBack, placeBoss, placeCrew, pictureAim } from './picturelands.js';
import { hashStr, seeded } from './shuffle.js';

export const SIZE = 112;
export const FLOOR = 10;       // the top block of the floor; you stand at 11
export const WALL_TOP = 22;    // the walls are 12 high (y 11..22)
export const C = 56;           // the middle of the hall
export const SIDES = [
  { name: 'south', o: [0, 1], t: [1, 0] },
  { name: 'east', o: [1, 0], t: [0, -1] },
  { name: 'north', o: [0, -1], t: [-1, 0] },
  { name: 'west', o: [-1, 0], t: [0, 1] },
];
export const UC = [-11, 0, 11];
// The three fixed gold doors (slot numbers: south-west is 0, round the hall by side: south 0-2, east 3-5, north 6-8, west 9-11).
export const FIXED = { wrapping: 1, popup: 4, gift: 7 };
export const KINDS = ['slide', 'ballpit', 'confetti', 'springs', 'nested', 'shop', 'healer', 'trainer1', 'trainer2'];
export const GIFT_KINDS = ['ballpit', 'confetti', 'springs', 'nested'];   // the rooms with a gift chest: pw:doors:gift1..4 by kind
export const DOOR_COLOURS = [WOOL.fire, WOOL.water, WOOL.grass, WOOL.electric, WOOL.rock, WOOL.ice, WOOL.bug, WOOL.ghost, WOOL.mind, WOOL.metal, WOOL.toxic, WOOL.pixie];
export const ROOM = { w: 9, d: 9 };
export const STAGE = { x0: 48, x1: 64, z0: 44, z1: 48, origin: { x: 56.5, y: FLOOR + 2, z: 46.5 }, pad: { x0: 55, x1: 57, z0: 54, z1: 55 } };
export const BIG_GIFT = { chamber: { u0: -10, u1: 10, v0: 11, v1: 25 }, outer: { u0: -4, u1: 4, v0: 17, v1: 25, y0: 11, y1: 18 }, hollow: { u0: -3, u1: 3, v0: 18, v1: 24, y0: 11, y1: 16 },
  front: { u0: -2, u1: 2, y0: 11, y1: 15 }, boss: { u: 0, v: 21 } };
export const POPUP_ROOM = { cols: [-2, 0, 2], rows: [5, 7, 9], pad: { u0: -1, u1: 1, v0: 1, v1: 2 }, carpet: { u0: -3, u1: 3, v0: 4, v1: 9 } };
export const SLIDE = { stairsU: -4, stairsV: [1, 4], platform: { u0: -4, u1: -2, v0: 4, v1: 6, top: 14 }, centre: [0.5, 5.5], radius: 3.2, from: 165, sweep: 300, time: 2.2, standY: 15 };
export const PIT = { v0: 2, v1: 9, floorY: 9 };
export const COLOURS = [WOOL.fire, WOOL.water, WOOL.grass, WOOL.electric, WOOL.pixie, WOOL.mind];

/* ---------------------------------------- keys, bows, the gate ---------------------------------------- */

export const bowKey = i => `pw:doors:bow${i}`;                       // i = 1..4: three shuffle rounds and the Pop-Up Room
export const giftKey = kind => `pw:doors:gift${GIFT_KINDS.indexOf(kind) + 1}`;
export function bowState(game) {
  const bows = [1, 2, 3, 4].map(i => (game.beaten || []).includes(bowKey(i)));
  const n = bows.filter(Boolean).length;
  return { bows, n, need: 4, done: n >= 4 };
}

/* ---------------------------------------- the layout (pure) ---------------------------------------- */

// Which room is behind which door: a seeded shuffle of the nine surprise kinds over the nine free slots. [kind per slot 0..11].
export function doorLayout(seed) {
  const rnd = seeded(`doors|${seed}`);
  const kinds = [...KINDS];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const out = [];
  let n = 0;
  for (let k = 0; k < 12; k++) out.push(k === FIXED.wrapping ? 'wrapping' : k === FIXED.popup ? 'popup' : k === FIXED.gift ? 'gift' : kinds[n++]);
  return out;
}

// The cell of slot k at local (u, v): [x, z] (integers); and the middle of that cell as a point (uf, vf are cell coordinates: the cell u spans [u, u + 1)).
export const cellOf = (k, u, v) => { const s = SIDES[Math.floor(k / 3)], c = UC[k % 3]; return [C + s.o[0] * (17 + v) + s.t[0] * (c + u), C + s.o[1] * (17 + v) + s.t[1] * (c + u)]; };
export const pointOf = (k, uf, vf) => {
  const s = SIDES[Math.floor(k / 3)], c = UC[k % 3], out = [0, 0];
  for (let a = 0; a < 2; a++) out[a] = s.t[a] ? C + s.t[a] * (c + uf - 0.5) + 0.5 : C + s.o[a] * (17 + vf - 0.5) + 0.5;
  return out;
};
// The same for the hall's own wall (u from the hall's middle, v = 0 the wall plane, negative = inside the hall).
export const hallCell = (side, u, v) => { const s = SIDES[side]; return [C + s.o[0] * (17 + v) + s.t[0] * u, C + s.o[1] * (17 + v) + s.t[1] * u]; };
const boxOf = (cells, y0, y1) => ({ x0: Math.min(...cells.map(c => c[0])), x1: Math.max(...cells.map(c => c[0])), y0, y1, z0: Math.min(...cells.map(c => c[1])), z1: Math.max(...cells.map(c => c[1])) });
export const inBox = (b, x, y, z) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1;
const facingOf = k => SIDES[Math.floor(k / 3)].o.map(v => -v); // the way a person in room k looks: out of the room, into the hall

// Everything the builder and the live part need, from the seed only: [{ k, kind, gold, side, centre, door, inner, outer, ... }] and the extras.
export function doorsPlan(seed) {
  const kinds = doorLayout(seed);
  const rooms = kinds.map((kind, k) => {
    const gold = k === FIXED.wrapping || k === FIXED.popup || k === FIXED.gift;
    const cells = [], dy = [11, 12, 13, 14];
    for (let u = -1; u <= 1; u++) for (const y of dy) { const [x, z] = cellOf(k, u, 0); cells.push([x, y, z]); }
    const corners = [cellOf(k, -4, 1), cellOf(k, 4, 9)];
    const inner = boxOf(corners, 11, WALL_TOP);
    const walls = boxOf([cellOf(k, -5, 0), cellOf(k, 5, 10)], 10, WALL_TOP);
    return { k, kind, gold, side: Math.floor(k / 3), frame: gold ? WOOL.treasure : DOOR_COLOURS[k], door: { cells, block: gold ? B.GOLD_DOOR : B.GIFT_DOOR, centre: [...pointOf(k, 0.5, 0.5), 12.5], open: kind === 'wrapping' }, inner, walls };
  });
  const byKind = Object.fromEntries(rooms.map(r => [r.kind, r]));
  const plan = { seed, kinds, rooms, byKind };

  // --- the slide ---
  {
    const r = byKind.slide, k = r.k, S = SLIDE, pts = [];
    const N = 12; // the first two points stay level on the platform, then it winds down to the floor
    for (let i = 0; i < N; i++) {
      const a = ((S.from - (i / (N - 1)) * S.sweep) * Math.PI) / 180;
      const [x, z] = pointOf(k, S.centre[0] + S.radius * Math.cos(a), S.centre[1] + S.radius * Math.sin(a));
      pts.push([x, S.standY - (Math.max(0, i - 1) / (N - 2)) * (S.standY - 11), z]);
    }
    const stairs = [];
    for (let v = S.stairsV[0]; v <= S.stairsV[1]; v++) { const [x, z] = cellOf(k, S.stairsU, v); for (let y = 11; y <= 10 + v; y++) stairs.push([x, y, z]); } // one step up per cell
    const platform = [];
    const P = S.platform;
    for (let u = P.u0; u <= P.u1; u++) for (let v = P.v0; v <= P.v1; v++) { const [x, z] = cellOf(k, u, v); for (let y = 11; y <= P.top; y++) platform.push([x, y, z]); }
    // the gutter of the slide: a wool block under the path in every column its centre passes, never higher than the path anywhere the player box
    // (0.3 either side of the centre) touches that column
    const centre = new Set(), low = new Map(), segs = 240;
    for (let i = 0; i <= segs; i++) {
      const f = (i / segs) * (pts.length - 1), a = Math.min(pts.length - 2, Math.floor(f)), q = f - a;
      const x = pts[a][0] + (pts[a + 1][0] - pts[a][0]) * q, y = pts[a][1] + (pts[a + 1][1] - pts[a][1]) * q, z = pts[a][2] + (pts[a + 1][2] - pts[a][2]) * q;
      centre.add(`${Math.floor(x)},${Math.floor(z)}`);
      for (let bx = Math.floor(x - 0.3); bx <= Math.floor(x + 0.3); bx++) for (let bz = Math.floor(z - 0.3); bz <= Math.floor(z + 0.3); bz++) { const k2 = `${bx},${bz}`; low.set(k2, Math.min(low.get(k2) ?? 99, y)); }
    }
    const blocks = new Map();
    for (const k2 of centre) { const [bx, bz] = k2.split(',').map(Number); blocks.set(k2, [bx, Math.max(10, Math.floor(low.get(k2) - 0.03) - 1), bz]); }
    plan.slide = { k, stairs, platform, stand: [...pointOf(k, (P.u0 + P.u1 + 1) / 2, (P.v0 + P.v1 + 1) / 2), P.top + 1], path: pts, blocks: [...blocks.values()], time: S.time, box: boxOf(platform.map(c => [c[0], c[2]]), 11, 17) };
  }
  // --- the ball pit, the confetti room, the springs, the nested doors, the shop ---
  {
    const r = byKind.ballpit, cells = [];
    for (let u = -4; u <= 4; u++) for (let v = PIT.v0; v <= PIT.v1; v++) { const [x, z] = cellOf(r.k, u, v); cells.push([x, z]); }
    const [cx, cz] = cellOf(r.k, 0, 9);
    plan.pit = { k: r.k, cells, floorY: PIT.floorY, chest: [cx, 10, cz], box: boxOf(cells, 10, 12) };
  }
  { const r = byKind.confetti, [cx, cz] = cellOf(r.k, 0, 9); plan.confetti = { k: r.k, chest: [cx, 11, cz], centre: [...pointOf(r.k, 0.5, 5.5), 18] }; }
  {
    const r = byKind.springs, pads = [], ledge = [];
    for (let u = -4; u <= 4; u++) for (let v = 2; v <= 8; v++) { const [x, z] = cellOf(r.k, u, v); pads.push([x, 10, z]); }
    for (let u = -3; u <= 3; u++) { const [x, z] = cellOf(r.k, u, 9); ledge.push([x, 13, z]); }
    const [cx, cz] = cellOf(r.k, 0, 9);
    plan.springs = { k: r.k, pads, ledge, chest: [cx, 14, cz] };
  }
  {
    const r = byKind.nested, doors = [], walls = [];
    const defs = [{ v: 3, u0: -1, u1: 1, h: 3 }, { v: 5, u0: 0, u1: 1, h: 3 }, { v: 7, u0: 0, u1: 0, h: 2 }];
    for (const d of defs) {
      const cells = [];
      for (let u = -4; u <= 4; u++) for (let y = 11; y <= 16; y++) {
        const [x, z] = cellOf(r.k, u, d.v), hole = u >= d.u0 && u <= d.u1 && y <= 10 + d.h;
        if (hole) cells.push([x, y, z]); else walls.push([x, y, z]);
      }
      doors.push({ v: d.v, cells, block: B.GIFT_DOOR, centre: [...pointOf(r.k, (d.u0 + d.u1 + 1) / 2, d.v + 0.5), 12] });
    }
    const [cx, cz] = cellOf(r.k, 0, 8);
    plan.nested = { k: r.k, doors, walls, chest: [cx, 11, cz] };
  }
  {
    const r = byKind.shop, shelves = [], nooks = [], stacks = [];
    for (const u of [-4, 4]) for (let v = 2; v <= 8; v++) { const [x, z] = cellOf(r.k, u, v); shelves.push([x, 11, z, COLOURS[(v + (u > 0 ? 2 : 0)) % COLOURS.length]]); }
    for (const u of [-4, 4]) for (const v of [3, 7]) { const [x, z] = cellOf(r.k, u, v); nooks.push({ kind: 'shop', x, y: 12, z }); }
    for (const [u, v, n] of [[-4, 5, 2], [4, 5, 3], [0, 9, 2], [-2, 9, 1], [2, 9, 3]]) { const [x, z] = cellOf(r.k, u, v); for (let i = 0; i < n; i++) stacks.push([x, 11 + (u === -4 || u === 4 ? 1 : 0) + i, z, COLOURS[(u + v + i + 8) % COLOURS.length]]); }
    plan.shop = { k: r.k, shelves, nooks, stacks };
  }
  // --- the hall: the Shuffle Stage, the watch pad, nooks ---
  plan.stage = { ...STAGE };
  const nooks = [];
  for (let side = 0; side < 4; side++) for (const u of [-6, 6]) { const [x, z] = hallCell(side, u, -1); nooks.push({ kind: 'hall', x, y: 11, z }); }
  nooks.push({ kind: 'stage', x: STAGE.x0 - 2, y: 11, z: 46 }, { kind: 'stage', x: STAGE.x1 + 2, y: 11, z: 46 });
  plan.nooks = [...nooks, ...plan.shop.nooks];
  // --- the Pop-Up Room ---
  {
    const k = FIXED.popup, boxes = [];
    let i = 0;
    for (const v of POPUP_ROOM.rows) for (const u of POPUP_ROOM.cols) { const [x, z] = cellOf(k, u, v); boxes.push({ i: i++, u, v, cell: [x, 11, z], at: [x + 0.5, 12, z + 0.5] }); }
    const padCells = [];
    for (let u = POPUP_ROOM.pad.u0; u <= POPUP_ROOM.pad.u1; u++) for (let v = POPUP_ROOM.pad.v0; v <= POPUP_ROOM.pad.v1; v++) { const [x, z] = cellOf(k, u, v); padCells.push([x, z]); }
    plan.popup = { k, boxes, pad: { cells: padCells, box: boxOf(padCells, 10, 13), centre: pointOf(k, 0.5, 1.5) }, room: rooms[k].inner };
  }
  // --- the Big Gift ---
  {
    const k = FIXED.gift, G = BIG_GIFT, ribbons = [[], [], [], []];
    const surface = [];
    const O = G.outer, H = G.hollow;
    for (let u = O.u0; u <= O.u1; u++) for (let v = O.v0; v <= O.v1; v++) for (let y = O.y0; y <= O.y1; y++) {
      const inside = u >= H.u0 && u <= H.u1 && v >= H.v0 && v <= H.v1 && y >= H.y0 && y <= H.y1;
      if (inside) continue;
      const [x, z] = cellOf(k, u, v);
      const face = u === O.u0 || u === O.u1 || v === O.v0 || v === O.v1 || y === O.y1, opening = v === O.v0 && u >= G.front.u0 && u <= G.front.u1 && y >= G.front.y0 && y <= G.front.y1;
      const cell = [x, y, z];
      if (face) {
        if (y === 16) ribbons[0].push(cell);
        else if (y === 12 && !opening) ribbons[1].push(cell);
        else if (y === O.y1 && v === 21) ribbons[2].push(cell);
        else if (y === O.y1 && u === 0) ribbons[3].push(cell);
      }
      surface.push({ cell, opening });
    }
    const front = surface.filter(s => s.opening).map(s => s.cell);
    const [bx, bz] = cellOf(k, G.boss.u, G.boss.v);
    plan.gift = { k, box: boxOf([cellOf(k, O.u0, O.v0), cellOf(k, O.u1, O.v1)], O.y0, O.y1), surface: surface.map(s => s.cell), front, ribbons, bow: [...pointOf(k, 0.5, 21.5), O.y1 + 1], stand: [bx, FLOOR, bz],
      chamber: boxOf([cellOf(k, G.chamber.u0 - 1, G.chamber.v0 - 1), cellOf(k, G.chamber.u1 + 1, G.chamber.v1 + 1)], 10, WALL_TOP), bossAt: [bx + 0.5, bz + 0.5] };
  }
  // --- the chests and their rooms, in one list ---
  plan.chests = GIFT_KINDS.map(kind => ({ kind, key: giftKey(kind), cell: plan[{ ballpit: 'pit', confetti: 'confetti', springs: 'springs', nested: 'nested' }[kind]].chest, room: byKind[kind].k }));
  return plan;
}

/* ---------------------------------------- the terrain ---------------------------------------- */

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };

export function doorsLand(world, def) {
  kit(world);
  const seed = world.seed ?? 1;
  const plan = doorsPlan(seed);
  world.doorsPlan = plan;
  // the floor: a soft cloud outside, the party floor in the hall and in every room
  flatLand(world, { y: FLOOR, top: B.SWIRL_CLOUD, under: B.STONE, deep: B.STONE });
  const P = (x, y, z, id) => put(world, x, y, z, id);
  for (let x = C - 16; x <= C + 16; x++) for (let z = C - 16; z <= C + 16; z++) P(x, FLOOR, z, B.PARTY_FLOOR);
  // the hall walls (v = 0 plane, with the corners), 12 high
  for (let side = 0; side < 4; side++) for (let u = -17; u <= 17; u++) { const [x, z] = hallCell(side, u, 0); for (let y = 11; y <= WALL_TOP; y++) P(x, y, z, B.GIFT_WALL); }
  // every room: floor, side walls, back wall, the doorway and its frame
  for (const r of plan.rooms) {
    const k = r.k;
    for (let u = -4; u <= 4; u++) for (let v = 1; v <= 9; v++) { const [x, z] = cellOf(k, u, v); P(x, FLOOR, z, B.PARTY_FLOOR); }
    for (let v = 0; v <= 10; v++) for (const u of [-5, 5]) { const [x, z] = cellOf(k, u, v); for (let y = 11; y <= WALL_TOP; y++) P(x, y, z, B.GIFT_WALL); }
    for (let u = -5; u <= 5; u++) { const [x, z] = cellOf(k, u, 10); for (let y = 11; y <= WALL_TOP; y++) P(x, y, z, B.GIFT_WALL); }
    for (let u = -2; u <= 2; u++) for (let y = 11; y <= 15; y++) { // the frame: two posts and a lintel of one wool colour
      if (Math.abs(u) === 2 || y === 15) { const [x, z] = cellOf(k, u, 0); P(x, y, z, r.frame); }
    }
    for (const [x, y, z] of r.door.cells) P(x, y, z, r.door.open ? B.AIR : r.door.block);
  }
  // the Big Gift room's chamber walls (before the stripes, so they get them too)
  {
    const k = FIXED.gift, G = BIG_GIFT;
    for (let u = G.chamber.u0; u <= G.chamber.u1; u++) for (let v = G.chamber.v0; v <= G.chamber.v1; v++) { const [x, z] = cellOf(k, u, v); P(x, FLOOR, z, B.PARTY_FLOOR); }
    for (let v = 10; v <= G.chamber.v1 + 1; v++) for (const u of [G.chamber.u0 - 1, G.chamber.u1 + 1]) { const [x, z] = cellOf(k, u, v); for (let y = 11; y <= WALL_TOP; y++) P(x, y, z, B.GIFT_WALL); }
    for (let u = G.chamber.u0 - 1; u <= G.chamber.u1 + 1; u++) for (const v of [10, G.chamber.v1 + 1]) { const [x, z] = cellOf(k, u, v); for (let y = 11; y <= WALL_TOP; y++) P(x, y, z, B.GIFT_WALL); }
    for (let u = -2; u <= 2; u++) for (let y = 11; y <= 15; y++) { const [x, z] = cellOf(k, u, 10); P(x, y, z, B.AIR); } // the opening from the vestibule into the chamber
  }
  // the stripes of wool round the walls (y 13 and 20)
  for (let x = 20; x < 100; x++) for (let z = 5; z < 100; z++) for (const y of [13, 20]) if (world.get(x, y, z) === B.GIFT_WALL) P(x, y, z, WOOL.surprise);

  // --- the rooms' insides ---
  const R = plan;
  { // the slide
    const s = R.slide;
    for (const [x, y, z] of [...s.stairs, ...s.platform]) P(x, y, z, WOOL.surprise);
    for (const [x, y, z] of s.blocks) P(x, y, z, WOOL.surprise);
    // the stairs get a pale top row so you can see the way up
  }
  { // the ball pit: the floor sinks by one and becomes the pit; the chest sits in the corner of the pit
    const p = R.pit;
    for (const [x, z] of p.cells) { P(x, p.floorY, z, B.BALL_PIT); P(x, FLOOR, z, B.AIR); }
    P(p.chest[0], p.chest[1], p.chest[2], B.CHEST);
  }
  P(...R.confetti.chest, B.CHEST);
  { const s = R.springs; for (const [x, y, z] of s.pads) P(x, y, z, B.SPRING); for (const [x, y, z] of s.ledge) P(x, y, z, B.PARTY_FLOOR); P(...s.chest, B.CHEST); }
  { // the nested doors: a wall across the room with a hole, the door in the hole
    const n = R.nested;
    for (const [x, y, z] of n.walls) P(x, y, z, B.GIFT_WALL);
    for (const d of n.doors) for (const [x, y, z] of d.cells) P(x, y, z, d.block);
    P(...n.chest, B.CHEST);
  }
  { const s = R.shop; for (const [x, y, z, id] of [...s.shelves, ...s.stacks]) P(x, y, z, id); }
  // people: Healer Stella (the Dream's healer visits), the two trainers
  {
    const h = R.byKind.healer, [hx, hz] = pointOf(h.k, 0.5, 6.5), f = facingOf(h.k);
    world.healer = [hx, 11, hz, Math.atan2(f[0], f[1])];
  }

  // --- the Shuffle Stage (one block high, a wool rim) and the watch pad you stand on to play ---
  for (let x = STAGE.x0; x <= STAGE.x1; x++) for (let z = STAGE.z0; z <= STAGE.z1; z++) P(x, 11, z, x === STAGE.x0 || x === STAGE.x1 || z === STAGE.z1 ? WOOL.surprise : B.PARTY_FLOOR);
  for (let x = STAGE.pad.x0; x <= STAGE.pad.x1; x++) for (let z = STAGE.pad.z0; z <= STAGE.pad.z1; z++) P(x, FLOOR, z, WOOL.surprise);

  // --- the Wrapping Room: the way back (a picture frame on its back wall), the arrival ---
  {
    const k = FIXED.wrapping, [x, z] = cellOf(k, 0, 9), f = facingOf(k);
    buildWayBack(world, 'doors', { x, y: FLOOR, z, facing: f });
  }

  // --- the Pop-Up Room: a carpet stage, the grid of boxes, the pad ---
  {
    const k = FIXED.popup, pu = R.popup, C0 = POPUP_ROOM.carpet;
    for (let u = C0.u0; u <= C0.u1; u++) for (let v = C0.v0; v <= C0.v1; v++) { const [x, z] = cellOf(k, u, v); P(x, FLOOR, z, WOOL.surprise); }
    for (const [x, z] of pu.pad.cells) P(x, FLOOR, z, WOOL.surprise);
    for (const b of pu.boxes) P(...b.cell, B.POP_BOX);
  }

  // --- the Big Gift room: the chamber, the opening in the vestibule's back wall, the box, the Boss ---
  {
    const k = FIXED.gift, g = R.gift;
    for (const [x, y, z] of g.surface) P(x, y, z, B.GIFT_WALL);
    g.ribbons.forEach(list => { for (const [x, y, z] of list) P(x, y, z, B.RIBBON); });
    placeBoss(world, 'doors', { x: g.stand[0], y: FLOOR, z: g.stand[2], facing: facingOf(k) });
  }

  // --- the crew behind two surprise doors ---
  {
    const f = k => facingOf(k);
    ['trainer1', 'trainer2'].forEach((kind, i) => {
      const k = R.byKind[kind].k, [x, z] = cellOf(k, 0, 6);
      placeCrew(world, 'doors', i, { x, y: FLOOR, z, facing: f(k) });
    });
  }

  // --- bookkeeping: nooks, keeps, rests, the live part ---
  world.nooks = R.nooks.map(n => ({ ...n }));
  const keep = (name, box, wallText = 'The Room of Doors is wrapped tight. Open the doors instead!') => world.keeps.push({ name, protect: [box], wallText });
  for (const r of R.rooms) keep(`room-${r.k}`, { ...r.walls, y0: 9, y1: WALL_TOP + 2 }); // (y 9 = the ball pit's floor)
  keep('chamber', { ...R.gift.chamber, y1: WALL_TOP + 2 });
  for (let side = 0; side < 4; side++) { const [a, b] = [hallCell(side, -17, 0), hallCell(side, 17, 0)]; keep(`hall-wall-${side}`, { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: 10, y1: WALL_TOP + 2, z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) }); }
  keep('stage', { x0: STAGE.x0 - 1, x1: STAGE.x1 + 1, y0: 10, y1: 18, z0: STAGE.z0 - 1, z1: STAGE.z1 + 1 }, 'The Shuffle Stage is part of the show. Play it instead!');
  keep('watch-pad', { x0: STAGE.pad.x0, x1: STAGE.pad.x1, y0: 10, y1: 14, z0: STAGE.pad.z0, z1: STAGE.pad.z1 });
  for (let x = 0; x < world.W; x++) for (let z = 0; z < world.D; z++) world.ground[x + z * world.W] = FLOOR;
  const po = SIDES[1].o; // the Pop-Up pad faces into the room (the boxes); player yaw faces (-sin, -cos)
  world.rests.push([R.popup.pad.centre[0], 11, R.popup.pad.centre[1], Math.atan2(-po[0], -po[1])]);
  const stagePad = [(STAGE.pad.x0 + STAGE.pad.x1 + 1) / 2, 11, STAGE.pad.z0 + 0.5, 0]; // the watch pad (facing north, the stage): a rest too
  world.rests.push(stagePad);
  world.parts.push({ id: 'doors', live: 'doors', plan: R, stage: R.stage, popup: R.popup, gift: R.gift, slide: R.slide, pit: R.pit, chests: R.chests, rooms: R.rooms });
  return world;
}

/* ---------------------------------------- the guide ---------------------------------------- */

// (world, p, game) => { x, z, text(arrow, metres) } | null: the next missing bow, then the Big Gift, then the Picture World's own (Boss, way back).
export function doorsAim(world, p, game) {
  const plan = world.doorsPlan;
  if (!plan) return null;
  const bows = bowState(game), stars = game.stars || [];
  const room = plan.rooms.find(r => inBox({ ...r.inner, y0: 10, y1: 30 }, Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)));
  if (room && !room.gold) return { x: room.door.centre[0], z: room.door.centre[1], text: (a, m) => `🚪 Back to the hall ${a} ${m}m` };
  const pad = STAGE.pad, popPad = plan.popup.pad.centre;
  if (room?.k === FIXED.popup && !bows.bows[3]) return { x: popPad[0], z: popPad[1], text: (a, m) => `🤡 Pop-Up pad ${a} ${m}m` };
  if (!bows.bows[0] || !bows.bows[1] || !bows.bows[2]) return { x: (pad.x0 + pad.x1 + 1) / 2, z: (pad.z0 + pad.z1 + 1) / 2, text: (a, m) => `🎀 Shuffle Stage ${a} ${m}m (bows ${bows.n} / 4)` };
  if (!bows.bows[3]) { const d = plan.rooms[FIXED.popup].door.centre; return { x: d[0], z: d[1], text: (a, m) => `🤡 Pop-Up Room (golden door) ${a} ${m}m (bows ${bows.n} / 4)` }; }
  if (!stars.includes('doors')) { const b = plan.gift.bossAt; return { x: b[0], z: b[1], text: (a, m) => `🎁 Big Gift ${a} ${m}m` }; }
  return pictureAim(world, p, { stars, via: 'doors' });
}
