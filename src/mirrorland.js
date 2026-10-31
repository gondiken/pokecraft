// Wave 18: the Mirror Palace (realm `mirror`, plans/wave18-mirror.md), a Picture World behind the Swirl's lilac-and-gold frame (the 13th star).
// Terrain as data, Node-runnable (needs only a world with W / D / data / ground / index / inBounds / get, like castleland.js): a flat
// 160 x 160 map with a garden in the south, the palace behind it (a solid mass of white stone bricks with the rooms carved out, so every
// wall is as thick as it needs to be), the Hall of Funny Mirrors in the middle and three wings: Bounce-Back (west: a mirror court), the
// Looking-Glass Rooms (east: you on one side of a long glass wall, your twin on the other) and the Moonlit Gallery (north: a pool, two
// pillars, a sun mirror on a dais and a wall of Gloomies), then the Grand Mirror Hall with Duke Dazzle. Nothing here is a game rule: the
// three games are bounceback.js / lookingglass.js / spotlight.js (stage 3); this file holds where everything stands, the saved keys,
// `mirrorState` and the guide. No world block is ever changed by play: the doors between the twin rooms are `liveCells()` (air here).
// The whole map is a keep (no building): the palace keeps riders out, the garden lets them in.
import { B, WOOL } from './blocks.js';
import { kit, buildWayBack, placeBoss, placeCrew, pictureAim } from './picturelands.js';

export const SIZE = 160;
export const MIRROR_SIZE = SIZE;
export const G = 10; // the ground's top block; people stand at y 11
const box = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

// ---- where things are (cells, inclusive; u / v are each game's own local coordinates) ----
export const ARRIVAL = { x: 80, z: 156 };                         // the way back frame (you arrive 3 in front of it, looking north)
export const GARDEN = { x0: 4, x1: 155, z0: 136, z1: 159, fountain: [80, 146] };
export const PALACE = { x0: 4, x1: 155, z0: 12, z1: 135, top: 22, tall: 30, gate: { x0: 77, x1: 82, z0: 134, z1: 135, y0: 11, y1: 16 } };
export const FUNHALL = { x0: 60, x1: 99, z0: 113, z1: 134, doors: { W: { x: 60, z0: 120, z1: 123 }, E: { x: 99, z0: 120, z1: 123 }, N: { z: 113, x0: 77, x1: 82 } } };
// The six funny mirrors: x is the middle, z the wall they hang on's inner cell; `w` = how many panes wide, facing = the way the glass looks.
export const FUNNY = [
  { kind: 'tall', x: 64, z: 114, w: 3, facing: [0, 1] }, { kind: 'wide', x: 70, z: 114, w: 5, facing: [0, 1] },
  { kind: 'tiny', x: 89, z: 114, w: 3, facing: [0, 1] }, { kind: 'wobbly', x: 95, z: 114, w: 3, facing: [0, 1] },
  { kind: 'upside', x: 66, z: 133, w: 3, facing: [0, -1] }, { kind: 'twins', x: 93, z: 133, w: 5, facing: [0, -1] },
];
// Bounce-Back (west wing). The court is sealed by pane walls (3 high) and a foam wall at your end: nobody walks in, "Play!" is pressed from outside.
// Court-local u = x - 20 (0..16), v = 117.5 - z (0..30).
export const COURT = {
  wing: box(10, 53, 11, 22, 74, 132), box: { x0: 20, x1: 35, z0: 88, z1: 117 }, mouth: { x0: 24, x1: 31 }, // the goal mouth (u 4..12)
  walls: { x0: 19, x1: 36, back: 87, near: 118 }, net: { x0: 24, x1: 31, z0: 84, z1: 86 },
  plate: [27.5, 116.5], rail: { u0: 0.8, u1: 15.2, v: 1.5 }, cleoLine: 28.5, corridor: { x0: 37, x1: 59, z0: 120, z1: 123 },
};
// The Looking-Glass Rooms (east wing). Mirror plane x 128.5 (the glass is cell 128): your cell x <-> its cell 256 - x; room-local u = 128 - x on your side
// (distance from the glass) and x - 129 on the twin's, so equal u / v are exact mirror images. Rooms are 16 deep along z (v = z - z0), three of them.
export const TWIN = {
  wing: box(104, 151, 11, 22, 64, 134), yours: { x0: 110, x1: 127 }, its: { x0: 129, x1: 146 }, glass: 128, plane: 128.5,
  corridor: { x0: 100, x1: 109, z0: 120, z1: 123 },
  rooms: [{ n: 1, z0: 118 }, { n: 2, z0: 100 }, { n: 3, z0: 82 }],
  walls: [{ z0: 116, z1: 117 }, { z0: 98, z1: 99 }, { z0: 80, z1: 81 }], // the partitions after rooms 1, 2, 3 (the third leads to Glazier Gwen's room)
  doors: { yours: { x0: 112, x1: 114 }, its: { x0: 142, x1: 144 }, y0: 11, y1: 14 },
  lobby: { x0: 110, x1: 127, z0: 66, z1: 79 },
};
const TWIN_Z1 = 133; // the last row of the rooms (the wing's own wall is z 134..135)
export const twinX = u => TWIN.glass + 1 + u;  // continuous x of the twin's u
export const yourX = u => TWIN.glass - u;      // continuous x of your u
// Each room's things (room-local u, v; a first guess for stage 3's bots to tune): pairs of gold pads `you` / `its`, ink puddles, bonk-ball lanes
// (`side`, along u 1..17 at v, period s, phase s), the mop (room 3), dressers (blocks on a side, `u: [u0, u1]`, `v`, 2 high).
export const TWIN_ROOMS = [
  { n: 1, name: 'Hello, Twin!', start: [16.5, 3.5], pads: [{ you: [6, 12], its: [6, 12] }, { you: [3, 4], its: [3, 4] }],
    puddles: [{ side: 'its', u: 6, v: 7, r: 1.1 }, { side: 'its', u: 4, v: 2, r: 1.1 }], balls: [], mop: null, dressers: [] },
  { n: 2, name: 'Bonk Balls!', start: [15, 14], pads: [{ you: [12, 10], its: [12, 10] }, { you: [8, 4], its: [8, 4] }, { you: [4, 11], its: [4, 11] }],
    puddles: [], balls: [{ side: 'you', v: 6, period: 5, phase: 0 }, { side: 'its', v: 6, period: 5, phase: 2.5 }, { side: 'its', v: 11, period: 4, phase: 0 }], mop: null, dressers: [] },
  { n: 3, name: 'Out of Step!', start: [15, 14], pads: [{ you: [4, 13], its: [4, 9] }, { you: [10, 3], its: [10, 3] }],
    puddles: [], balls: [{ side: 'you', v: 8, period: 5, phase: 1 }], mop: { side: 'its', u: 12, v: 11, len: 3.5, rate: 0.7 },
    dressers: [{ side: 'its', u: [1, 8], v: 5 }] },
];
// The Moonlit Gallery (north). Walls 2 thick: x 56..57 / 102..103, z 52..53 / 107..108; the west strip (x 58..60) is the only way along it to
// the Grand Mirror Hall; the pool (x 62..101, z 54..99) has a low gold rail round it. The Gloomy wall is the back wall's face (z 54).
export const GALLERY = { x0: 56, x1: 103, z0: 52, z1: 108, in: { x0: 58, x1: 101, z0: 54, z1: 106 }, top: 30, strip: { x0: 58, x1: 60 }, pool: { x0: 62, x1: 101, z0: 54, z1: 99 }, rail: { x: 61, z: 100 },
  door: { x0: 77, x1: 82, z0: 107, z1: 108 }, back: { x: [58, 60], z0: 52, z1: 53 }, sun: { x: 102, y: 26, z: 104 } };
export const DAIS = { x: 80, z: 104, box: { x0: 78, x1: 82, z0: 102, z1: 106 }, y: G + 1 }; // one step up (stand y 12)
export const GLOOMY_WALL = { x0: 62, x1: 97, y0: 13, y1: 26, z: 53 };                       // wall cells (the face you see is z 54)
export const PILLARS = [{ x0: 68, x1: 70, z0: 62, z1: 64, y1: 26 }, { x0: 89, x1: 91, z0: 62, z1: 64, y1: 26 }];
export const PANES = [{ x: 57, z0: 58, z1: 80, y0: 12, y1: 20 }, { x: 102, z0: 58, z1: 80, y0: 12, y1: 20 }]; // beam-bouncing panels on the side walls
// The Grand Mirror Hall (Duke Dazzle). Its door is in the SW corner, above the gallery's west strip (x 58..60).
export const GRAND = { x0: 56, x1: 103, z0: 14, z1: 48, in: { x0: 58, x1: 101, z0: 16, z1: 46 }, door: { x0: 58, x1: 60, z0: 47, z1: 53 }, stage: { x0: 74, x1: 86, z0: 17, z1: 23 }, duke: [80, 19] };
export const RESTS = { funhall: [80, 124], court: [28, 124], twin: [118, 126], gallery: [74, 105], grand: [80, 42] };
export const CREW = [
  { name: 'Copycat Cleo', x: 34, z: 85, facing: [-1, 0], where: 'court' },   // by the goal, east of the net (seen from the wing's east strip)
  { name: 'Glazier Gwen', x: 118, z: 74, facing: [0, 1], where: 'twin' },    // in the room after room 3
  { name: 'Lamplighter Lux', x: 88, z: 105, facing: [0, -1], where: 'gallery' }, // by the dais
];

// ---- the saved keys (in `beaten`) and what is drawn from them ----
export const courtKey = n => `pw:mirror:court${n}`;
export const twinKey = n => `pw:mirror:twin${n}`;
export const beamKey = n => `pw:mirror:beam${n}`; // (not lightKey: Atlantis has that)
export const crewKey = i => `pw:mirror:crew${i + 1}`;
export const MIRROR_ROUNDS = 3, MIRROR_NEED = 9;
// -> { court, twin, beam, n, need: 9, done, star }: each a count of rounds won in a row from 1 (own keys; the star counts as all).
export function mirrorState(game) {
  const has = k => !!game?.beaten?.includes(k), star = !!game?.stars?.includes('mirror');
  const run = f => { let n = 0; while (n < MIRROR_ROUNDS && has(f(n + 1))) n++; return n; };
  const court = run(courtKey), twin = run(twinKey), beam = run(beamKey);
  return { court, twin, beam, n: court + twin + beam, need: MIRROR_NEED, done: court + twin + beam === MIRROR_NEED, star };
}

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
const fill = (world, x0, x1, y0, y1, z0, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(world, x, y, z, id); };
const checker = (x, z) => ((x >> 1) + (z >> 1)) % 2 === 0 ? WOOL.paper : WOOL.mirror; // the palace floor: big white and lilac tiles

// The cells the live part will draw (setLive) as closed doors: room n's exit, on your side and on the twin's (mirror images). Air in the world data.
export function liveCells() {
  const doors = TWIN.rooms.map((_, i) => {
    const w = TWIN.walls[i], mine = [], its = [];
    for (let z = w.z0; z <= w.z1; z++) for (let y = TWIN.doors.y0; y <= TWIN.doors.y1; y++) {
      for (let x = TWIN.doors.yours.x0; x <= TWIN.doors.yours.x1; x++) mine.push([x, y, z]);
      for (let x = TWIN.doors.its.x0; x <= TWIN.doors.its.x1; x++) its.push([x, y, z]);
    }
    return { n: i + 1, yours: mine, its };
  });
  return { doors };
}

// The guide (TERRAIN_AIMS.mirrorLand). Words only say where, never how. Once the three games are won it says nothing (the base then points at the
// helpers, Duke Dazzle and the way back).
export function mirrorAim(world, p, game) {
  const st = mirrorState(game);
  if (st.done || st.star) return null;
  const near = list => list.reduce((best, c) => (!best || Math.hypot(c.x - p.x, c.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? c : best), null);
  const pt = (x, z) => ({ x, z });
  const inCourtWing = inR(COURT.wing, p.x, p.z), inTwinWing = inR(TWIN.wing, p.x, p.z), inGallery = inR(GALLERY, p.x, p.z);
  const wings = [];
  if (st.court < MIRROR_ROUNDS) wings.push({ ...pt(FUNHALL.doors.W.x + 0.5, (FUNHALL.doors.W.z0 + FUNHALL.doors.W.z1 + 1) / 2), at: COURT.plate, here: inCourtWing, text: (a, m) => `🏓 Bounce-Back ${a} ${m}m` });
  if (st.twin < MIRROR_ROUNDS) {
    const room = TWIN_ROOMS[st.twin], z0 = TWIN.rooms[st.twin].z0, [su, sv] = room.start;
    wings.push({ ...pt(FUNHALL.doors.E.x + 0.5, (FUNHALL.doors.E.z0 + FUNHALL.doors.E.z1 + 1) / 2), at: pt(yourX(su), z0 + sv), here: inTwinWing, text: (a, m) => `👯 Looking-Glass Rooms ${a} ${m}m`, words: '👯 You and your twin: both on the gold pads!' });
  }
  if (st.beam < MIRROR_ROUNDS) wings.push({ ...pt((FUNHALL.doors.N.x0 + FUNHALL.doors.N.x1 + 1) / 2, FUNHALL.doors.N.z + 0.5), at: pt(DAIS.x + 0.5, DAIS.z + 0.5), here: inGallery, text: (a, m) => `🔦 Moonlit Gallery ${a} ${m}m` });
  if (!wings.length) return null;
  const here = wings.filter(c => c.here), w = near(here.length ? here : wings); // inside an unfinished wing: that wing
  if (w.here) {
    if (w.words && inR({ x0: TWIN.yours.x0, x1: TWIN.yours.x1, z0: TWIN.rooms[st.twin].z0, z1: TWIN.rooms[st.twin].z0 + 15 }, p.x, p.z)) return { text: () => w.words }; // in the room: no arrow to a pad
    const a = Array.isArray(w.at) ? pt(w.at[0], w.at[1]) : w.at;
    return { x: a.x, z: a.z, text: w.text };
  }
  return { x: w.x, z: w.z, text: w.text };
}

export function mirrorLand(world, def) {
  kit(world);
  const { W, D } = world;
  // 1. flat grass ground
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    for (let y = 0; y <= G; y++) put(world, x, y, z, y === G ? B.GRASS : y >= G - 3 ? B.DIRT : B.STONE);
    world.ground[x + z * W] = G;
  }
  const keeps = [], keep = (name, b, wallText, extra = {}) => keeps.push({ name, protect: [b], wallText, ...extra });
  const P = PALACE;
  // 2. the palace: a solid mass (y 11..22, 11..30 over the gallery and the Grand Hall) with a mirror-wool trim on top; rooms are carved out of it
  fill(world, P.x0, P.x1, G + 1, P.top, P.z0, P.z1, B.STONE_BRICKS);
  for (const r of [GALLERY, GRAND]) fill(world, r.x0, r.x1, P.top + 1, GALLERY.top, r.z0, r.z1, B.STONE_BRICKS);
  for (let x = P.x0; x <= P.x1; x++) for (let z = P.z0; z <= P.z1; z++) if (Math.min(x - P.x0, P.x1 - x, z - P.z0, P.z1 - z) === 0) put(world, x, P.top, z, WOOL.mirror); // the trim
  for (const r of [GALLERY, GRAND]) for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) if (Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z) === 0) put(world, x, GALLERY.top, z, WOOL.mirror);
  // windows of mirror panes along the garden front and the side walls (outside only; nothing behind them)
  for (let x = 10; x <= 150; x += 6) if (!(x >= 72 && x <= 88)) { fill(world, x, x + 1, 14, 17, P.z1, P.z1, B.MIRROR_PANE); fill(world, x - 1, x + 2, 13, 13, P.z1, P.z1, WOOL.mirror); }
  for (let z = 20; z <= 128; z += 8) { fill(world, P.x0, P.x0, 14, 17, z, z + 1, B.MIRROR_PANE); fill(world, P.x1, P.x1, 14, 17, z, z + 1, B.MIRROR_PANE); }
  // carve helper: air from y 11 up to `top`, a floor tile at G
  const carve = (x0, x1, z0, z1, top = P.top, floor = checker) => {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { put(world, x, G, z, floor(x, z)); fill(world, x, x, G + 1, top, z, z, B.AIR); }
  };
  const stoneFloor = () => B.STONE_BRICKS;
  // 3. the gate and the Hall of Funny Mirrors, the three doors out of it
  carve(P.gate.x0, P.gate.x1, P.gate.z0, P.gate.z1, P.gate.y1, stoneFloor);
  carve(FUNHALL.x0 + 1, FUNHALL.x1 - 1, FUNHALL.z0 + 1, FUNHALL.z1 - 1);
  carve(54, FUNHALL.x0, COURT.corridor.z0, COURT.corridor.z1, G + 5, stoneFloor); // (the corridor runs on inside the wing room, x 37..53)
  carve(FUNHALL.x1, TWIN.corridor.x1, TWIN.corridor.z0, TWIN.corridor.z1, G + 5, stoneFloor);
  const N = FUNHALL.doors.N; carve(N.x0, N.x1, GALLERY.door.z0, FUNHALL.z0, G + 5, stoneFloor); // the passage up to the gallery (z 107..113)
  // 4. Bounce-Back: the wing's big room, the court inside it
  const C = COURT;
  carve(C.wing.x0, C.wing.x1, C.wing.z0, C.wing.z1);
  const cw = C.walls;
  fill(world, cw.x0, cw.x0, G + 1, G + 3, cw.back, cw.near - 1, B.MIRROR_PANE); fill(world, cw.x1, cw.x1, G + 1, G + 3, cw.back, cw.near - 1, B.MIRROR_PANE); // the side mirrors
  for (let x = cw.x0; x <= cw.x1; x++) {
    if (x < C.mouth.x0 || x > C.mouth.x1) fill(world, x, x, G + 1, G + 3, cw.back, cw.back, B.MIRROR_PANE); // the back mirror, except the goal mouth
    fill(world, x, x, G + 1, G + 3, cw.near, cw.near, B.FOAM);                                              // your net: a soft foam wall
  }
  fill(world, C.net.x0, C.net.x1, G + 1, G + 3, C.net.z0, C.net.z1, WOOL.pixie);                              // the pink net behind the mouth
  for (let x = C.box.x0; x <= C.box.x1; x++) for (let z = C.box.z0; z <= C.box.z1; z++) put(world, x, G, z, (x + z) % 2 ? WOOL.paper : WOOL.mirror);
  for (let x = C.mouth.x0; x <= C.mouth.x1; x++) put(world, x, G + 4, cw.back, WOOL.fire); // a red arch over the goal mouth
  put(world, C.mouth.x0 - 1, G + 4, cw.back, WOOL.fire); put(world, C.mouth.x1 + 1, G + 4, cw.back, WOOL.fire);
  // 5. the Looking-Glass Rooms: the partitions, the glass wall, a mirror-image twin side
  const T = TWIN;
  carve(T.yours.x0, T.yours.x1, T.lobby.z0, TWIN_Z1, P.top); // your side, the whole length (z 66..133)
  carve(T.its.x0, T.its.x1, T.lobby.z0, TWIN_Z1, P.top);     // the twin's side (nobody can get there)
  for (const w of T.walls) for (let z = w.z0; z <= w.z1; z++) for (const s of [T.yours, T.its]) {
    for (let x = s.x0; x <= s.x1; x++) { fill(world, x, x, G + 1, P.top, z, z, B.STONE_BRICKS); put(world, x, G, z, B.STONE_BRICKS); }
    const d = s === T.yours ? T.doors.yours : T.doors.its; // the doorways (the live part closes them)
    for (let x = d.x0; x <= d.x1; x++) fill(world, x, x, T.doors.y0, T.doors.y1, z, z, B.AIR);
  }
  for (let z = T.lobby.z0; z <= TWIN_Z1; z++) { // the glass wall in a gold frame: the full length of the rooms and the lobby (glass y 11..16, gold above and below)
    put(world, T.glass, G, z, B.PICTURE_FRAME); fill(world, T.glass, T.glass, G + 1, G + 6, z, z, B.GLASS); put(world, T.glass, G + 7, z, B.PICTURE_FRAME);
  }
  for (const w of T.walls) for (let z = w.z0; z <= w.z1; z++) fill(world, T.glass, T.glass, G, G + 7, z, z, B.PICTURE_FRAME); // gold posts where the rooms meet
  for (const rm of TWIN_ROOMS) { // dressers (blocks): stop the twin or you
    for (const d of rm.dressers) {
      const z = T.rooms[rm.n - 1].z0 + d.v;
      for (let u = d.u[0]; u <= d.u[1]; u++) { const x = d.side === 'its' ? Math.floor(twinX(u)) : Math.floor(yourX(u)); fill(world, x, x, G + 1, G + 2, z, z, B.PLANKS); }
    }
  }
  for (const rm of TWIN_ROOMS) for (const [pu, pv, side] of rm.pads.flatMap(p => [[...p.you, 'you'], [...p.its, 'its']])) { // the pads' floor ring (gold; the glowing pad itself is a mesh)
    const x = Math.floor(side === 'its' ? twinX(pu) : yourX(pu)), z = T.rooms[rm.n - 1].z0 + Math.floor(pv);
    put(world, x, G, z, WOOL.treasure);
  }
  // 6. the Moonlit Gallery: the room, the west strip, the pool with its rail and two pillars, the Gloomy wall, the sun window, the dais, panes
  const Y = GALLERY, gi = Y.in;
  carve(gi.x0, gi.x1, gi.z0, gi.z1, Y.top);
  carve(Y.door.x0, Y.door.x1, Y.door.z0, Y.door.z1, G + 5, stoneFloor);
  const pl = Y.pool;
  for (let x = pl.x0; x <= pl.x1; x++) for (let z = pl.z0; z <= pl.z1; z++) { put(world, x, G - 1, z, B.STONE); put(world, x, G, z, B.WATER); }
  for (let z = pl.z0; z <= Y.rail.z; z++) { put(world, Y.rail.x, G + 1, z, B.PICTURE_FRAME); fill(world, Y.rail.x, Y.rail.x, G + 2, G + 3, z, z, B.HOUSE_PROP); }
  for (let x = Y.rail.x; x <= pl.x1; x++) { put(world, x, G + 1, Y.rail.z, B.PICTURE_FRAME); fill(world, x, x, G + 2, G + 3, Y.rail.z, Y.rail.z, B.HOUSE_PROP); }
  for (const p of PILLARS) { fill(world, p.x0, p.x1, G, p.y1, p.z0, p.z1, B.STONE_BRICKS); for (let x = p.x0; x <= p.x1; x++) for (let z = p.z0; z <= p.z1; z++) put(world, x, G, z, B.STONE_BRICKS); }
  fill(world, GLOOMY_WALL.x0, GLOOMY_WALL.x1, GLOOMY_WALL.y0, GLOOMY_WALL.y1, GLOOMY_WALL.z, GLOOMY_WALL.z, WOOL.paper); // the pale wall the Gloomies crawl on
  for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dy) + Math.abs(dz) < 2 || (dy === 0 && dz === 0)) fill(world, Y.sun.x, Y.sun.x + 1, Y.sun.y + dy, Y.sun.y + dy, Y.sun.z + dz, Y.sun.z + dz, B.GLASS); // a round window high in the east wall (a plus of glass)
  fill(world, DAIS.box.x0, DAIS.box.x1, DAIS.y, DAIS.y, DAIS.box.z0, DAIS.box.z1, WOOL.mirror);
  for (const pn of PANES) fill(world, pn.x, pn.x, pn.y0, pn.y1, pn.z0, pn.z1, B.MIRROR_PANE);
  // 7. the Grand Mirror Hall: the room, the wall of mirror panes behind the stage, the stage, the door in the corner
  const R = GRAND, ri = R.in;
  carve(ri.x0, ri.x1, ri.z0, ri.z1, GALLERY.top);
  carve(R.door.x0, R.door.x1, R.door.z0, R.door.z1, G + 5, stoneFloor); // the doorway: through the Hall's south wall, the gap and the gallery's back wall (z 47..53)
  fill(world, ri.x0 + 4, ri.x1 - 4, G + 1, P.top, R.z0 + 1, R.z0 + 1, B.MIRROR_PANE);                  // the wall of mirrors at z 15
  for (const x of [ri.x0, ri.x1]) fill(world, x, x, G + 1, P.top, ri.z0, ri.z1, B.MIRROR_PANE);
  fill(world, R.stage.x0, R.stage.x1, G + 1, G + 1, R.stage.z0, R.stage.z1, WOOL.treasure);
  for (let x = ri.x0 + 2; x <= ri.x1 - 2; x += 8) for (const z of [ri.z0 + 6, ri.z1 - 6]) fill(world, x, x, G + 1, G + 6, z, z, WOOL.mirror); // mirror-wool columns
  // 8. the garden: gravel paths, hedges, two topiaries (a cat and a crown), the fountain, flower beds
  for (let x = P.x0; x <= P.x1; x++) for (const z of [GARDEN.z1 - 1, GARDEN.z1]) fill(world, x, x, G + 1, G + 2, z, z, B.HEDGE);                      // the back hedge
  for (let z = GARDEN.z0; z <= GARDEN.z1; z++) for (const x of [P.x0, P.x0 + 1, P.x1 - 1, P.x1]) fill(world, x, x, G + 1, G + 2, z, z, B.HEDGE);       // the side hedges
  for (let x = 78; x <= 82; x++) for (let z = GARDEN.z0; z <= GARDEN.z1 - 6; z++) put(world, x, G, z, B.GRAVEL);
  for (let x = 10; x <= 150; x++) for (const z of [139, 140]) if ((x < 70 || x > 90) && !(x % 17 === 0 || x % 17 === 1)) fill(world, x, x, G + 1, G + 2, z, z, B.HEDGE); // two long hedges with gaps
  const [fx, fz] = GARDEN.fountain;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    const d = Math.hypot(dx, dz);
    if (d <= 3.2 && d > 2.2) fill(world, fx + dx, fx + dx, G, G + 1, fz + dz, fz + dz, B.COBBLE);
    else if (d <= 2.2) { put(world, fx + dx, G, fz + dz, B.WATER); put(world, fx + dx, G - 1, fz + dz, B.STONE); }
  }
  fill(world, fx, fx, G, G + 3, fz, fz, B.COBBLE);
  // topiaries: every column is at least 2 high (a 1-high step could be climbed), so nobody can walk up them
  const cat = (x, z) => { // a hedge cat sitting: a long body, a head with two ears, a curled tail
    fill(world, x - 2, x + 2, G + 1, G + 3, z - 1, z + 1, B.HEDGE); fill(world, x + 3, x + 4, G + 1, G + 4, z - 1, z + 1, B.HEDGE);
    put(world, x + 3, G + 5, z - 1, B.HEDGE); put(world, x + 3, G + 5, z + 1, B.HEDGE); put(world, x + 4, G + 5, z - 1, B.HEDGE); put(world, x + 4, G + 5, z + 1, B.HEDGE);
    fill(world, x - 3, x - 3, G + 1, G + 5, z, z, B.HEDGE); fill(world, x - 4, x - 4, G + 1, G + 2, z, z, B.HEDGE);
  };
  const crown = (x, z) => { // a hedge crown: a thick ring with three points
    fill(world, x - 2, x + 2, G + 1, G + 2, z - 1, z + 1, B.HEDGE); for (const dx of [-2, 0, 2]) fill(world, x + dx, x + dx, G + 3, G + 4, z, z, B.HEDGE);
  };
  cat(30, 148); crown(130, 148);
  // flower beds (a bush is a 1-high block you can step onto, so none stands next to a hedge, a topiary or the fountain: nobody climbs up a hedge)
  const hedgy = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (world.get(x + dx, G + 1, z + dz) !== B.AIR) return true; return false; };
  for (let x = 12; x < 150; x++) for (let z = 142; z <= 156; z++) if (world.get(x, G + 1, z) === B.AIR && world.get(x, G, z) === B.GRASS && (x * 7 + z * 3) % 19 === 0 && Math.abs(x - 80) > 6 && !hedgy(x, z)) put(world, x, G + 1, z, B.FLOWER_BUSH);
  // 9. funny mirrors: panes in a gold frame on the hall's north and south walls
  for (const f of FUNNY) {
    const wz = f.facing[1] > 0 ? FUNHALL.z0 : FUNHALL.z1, x0 = f.x - (f.w - 1) / 2, x1 = f.x + (f.w - 1) / 2;
    for (let x = x0 - 1; x <= x1 + 1; x++) for (let y = G + 1; y <= G + 6; y++) put(world, x, y, wz, x < x0 || x > x1 || y === G + 1 || y === G + 6 ? B.PICTURE_FRAME : B.MIRROR_PANE);
  }
  // 10. keeps: the palace keeps riders out, the garden lets them in; nobody builds anywhere
  keep('palace', box(0, W - 1, 0, 47, 0, GARDEN.z0 - 1), 'This is the Mirror Palace! Only mirrors here, no building.', { rideText: 'Hop off! Inside the palace you walk, so you can see yourself in every mirror.' });
  keep('garden', box(0, W - 1, 0, 47, GARDEN.z0, D - 1), 'This is the palace garden. The gardener says no building, please!', { rideIn: true });
  // 11. the way back, the Boss, the crew
  buildWayBack(world, 'mirror', { x: ARRIVAL.x, y: G, z: ARRIVAL.z, facing: [0, -1] });
  placeBoss(world, 'mirror', { x: GRAND.duke[0], y: G + 1, z: GRAND.duke[1], facing: [0, 1] });
  CREW.forEach((c, i) => placeCrew(world, 'mirror', i, { x: c.x, y: G, z: c.z, facing: c.facing }));
  // 12. nooks (where the wild Mirror creatures preen: in front of the funny mirrors and by the garden hedges), rests, the part
  const nooks = [];
  for (const f of FUNNY) nooks.push({ kind: 'preen', x: f.x, y: G + 1, z: f.z + 2 * f.facing[1] });
  for (const [x, z] of [[20, 143], [42, 152], [60, 144], [100, 144], [118, 152], [140, 143]]) nooks.push({ kind: 'preen', x, y: G + 1, z });
  world.nooks = nooks.filter(n => world.get(n.x, n.y, n.z) === B.AIR && world.get(n.x, n.y + 1, n.z) === B.AIR && world.get(n.x, n.y - 1, n.z) !== B.AIR);
  for (const [x, z] of Object.values(RESTS)) world.rests.push([x + 0.5, G + 1, z + 0.5, 0]);
  for (const k of keeps) world.keeps.push(k);
  world.mirror = { palace: PALACE, garden: GARDEN, funhall: FUNHALL, funny: FUNNY, court: COURT, twin: TWIN, rooms: TWIN_ROOMS, gallery: GALLERY, dais: DAIS, gloomyWall: GLOOMY_WALL, pillars: PILLARS, panes: PANES, grand: GRAND, rests: RESTS, live: liveCells(), crew: CREW };
  world.realmBiome = () => 'mirror';
  world.parts.push({ id: 'mirror', live: 'mirror', area: box(0, W - 1, 0, 47, 0, D - 1) });
}

export { pictureAim };
