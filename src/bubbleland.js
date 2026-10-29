// The Bubble Well (realm `bubble`, plans/bubble-well.md), a Picture World behind the Swirl's pale blue frame (the old `secret4`): the
// Bubble Well. Terrain as data, Node-runnable (needs only a world with W / D / data / ground / index / inBounds / get, like castleland.js).
// One big climb inside a round well of fizzy soda walls: the foam floor with the way back, the Bubble Stairs (a wide shaft up to the
// bench, a narrow shaft with drips and a side vent up to the plateau), the Duckling Garden on the plateau (islands, a current, thorny
// coral, a gust lane, the nest), the Geyser Chimney (a glass-sided tube up to the rim), the rim walk with Captain Suds' throne behind a
// foam fence, the soap cushions and gold pads of his shield game (bank shots), and a second way back. Two fizz lifts (lift streams) carry you up once you did a stretch, so a finished climb is never done twice.
// The rules are pure (bubbles.js); bubblelive.js wires them. Every block here is fixed: the whole well is a keep (no building, no riding).
import { B, WOOL } from './blocks.js';
import { kit, buildWayBack, placeBoss, placeCrew, pictureAim } from './picturelands.js';
import { gapOf, BANK } from './bubbles.js';

export const SIZE = 160;
export const WELL = { x: 80, z: 80, r: 58, top: 44 };         // the round wall: cells whose middle is r or more from the middle, y 0..top
export const FLOOR = 4;                                        // the floor's top block (you stand at y 5)
export const MESA = { z1: 66, top: 18 };                       // the plateau: every cell with z <= z1 is solid up to y 18 (stand at 19)
export const BENCH = { x0: 98, x1: 122, z0: 67, z1: 71, top: 10, roof: 15 }; // a step in the cliff: the top of shaft 1 (stand at 11); the plateau overhangs it from y 15 up, so the narrow shaft is the only way on
export const SHAFT1 = { x0: 100, x1: 108, z0: 72, z1: 77, arms: [99, 109] }; // the wide shaft: open air in front of the bench, two low arms
// Rework 2026-10-29: a low foam step in the wide shaft (stand at 7): the first bubble from the floor reaches it whenever you hop (the
// tutorial), and from it the bench is straight ahead but too close for a bubble: turn to the side, blow, hop, turn back (the first trick).
export const STEP1 = { x0: 103, x1: 105, z0: 72, z1: 73, top: 6 };
export const SHAFT2 = { x0: 110, x1: 114, z0: 60, z1: 71 };   // the narrow shaft: a notch cut into the plateau (and its overhang) from the bench up
export const STAIRS_TOP = { x0: 104, x1: 120, z0: 52, z1: 59 }; // landing on the plateau here from a bubble = the Bubble Stairs done
export const GARDEN = { x0: 62, x1: 99, z0: 38, z1: 63 };      // the Duckling Garden's rim (cells x0..x1-1, z0..z1-1 inside)
export const NEST = { x: 80.5, z: 42.5, r: 1.4 };
export const ISLANDS = [[80.5, 56.5], [65.5, 52.5], [94.5, 59.5]]; // duckling 1 (straight), 2 (over the current), 3 (through the thorns)
export const CURRENTS = [{ x0: 70, x1: 74, z0: 38, z1: 63, vx: 0, vz: 1.2 }]; // a stream of tiny bubbles flowing south
// Rework 2026-10-29: a gusty gap between the thorn pen's two rows: calm, then a puff of little bubbles gathers (warn), then it blows south
// toward row A's thorns for a moment. Duckling 3 must cross it between two gusts (a quick, strong puff right after one).
export const GUSTS = [{ x0: 88, x1: 92, z0: 50, z1: 54, vx: 0, vz: 1.8, period: 4.5, on: 1.0, warn: 0.8, phase: 0 }];
const thornRows = () => {
  const t = [];
  for (let z = 47; z <= 62; z += 1.5) t.push([83, z]);                                  // the pen's west fence
  for (const x of [84.5, 86, 87.5, 89, 90.5, 92, 96.5, 98]) t.push([x, 55]);           // row A: one gap at its east end (x 92..96.5)
  for (const x of [70, 71.5, 73, 74.5]) t.push([x, 61.5]);                              // where the current runs into the rim: don't let it carry you there
  for (const x of [87.5, 89, 90.5, 92, 93.5, 95, 96.5, 98]) t.push([x, 49]);           // row B: the gap at its west end (x 83..87.5)
  return t;
};
export const THORNS = thornRows();
export const GARDEN_RULES = { bounds: GARDEN, nest: NEST, currents: CURRENTS, gusts: GUSTS, thorns: THORNS };
// The chimney: a tube of fizzy wall (inside radius 4) on the plateau up to the rim, a glass strip toward the well's middle, a door east.
export const CHIMNEY = {
  x: 46.5, z: 40.5, r: 4, wall: 5.8, floor: 19, top: 41.8, door: { a: 0, w: 0.4, y1: 23 }, window: { w: 0.5, y0: 22, y1: 40 },
  plates: [{ y: 25, a: 0, d: 0 }, { y: 30, a: 2.8, d: 2.0 }, { y: 34.5, a: 4.6, d: 2.0 }], // (rework 2026-10-29: the first gold ring right over the start)
  fan: { y0: 35.4, y1: 37.2, vx: Math.cos(2.0) * 1.4, vz: Math.sin(2.0) * 1.4 }, bar: { y: 39.3 },
};
CHIMNEY.stars = [{ x: CHIMNEY.x, y: CHIMNEY.floor + 1.0, z: CHIMNEY.z }, ...CHIMNEY.plates.map(p => ({ ...gapOf(CHIMNEY, p), y: p.y + 1.6 }))];
CHIMNEY.window.a = Math.atan2(WELL.z - CHIMNEY.z, WELL.x - CHIMNEY.x);
CHIMNEY.landing = (() => { const rx = (CHIMNEY.x - WELL.x), rz = (CHIMNEY.z - WELL.z), l = Math.hypot(rx, rz); return [CHIMNEY.x + (-rz / l) * -7, CHIMNEY.z + (rx / l) * -7]; })();
export const RIM = { r0: 50, y: 41, balcony: { x0: 74, x1: 87, z0: 30, z1: 36 } }; // the rim walk (stand at 42): a ring r0..WELL.r and a balcony
export const BOSS_AT = { x: 80, z: 25 };
export const SHIELD = { x: 80.5, y: 44, z: 25.5, radii: [3.4, 2.9, 2.4] }; // Captain Suds' three shield bubbles (shield 1 is the outermost)
// Captain Suds' shields (rework 2026-10-29, owner: "I didn't understand the fizz vents"): a bank shot. A foam fence hides the throne from
// the balcony; stand on the round's gold pad, Blow! and your bubble flies flat the way you look, bounces off the pink soap cushion and
// pops the shield. Round 1 a cushion near you, round 2 one across the rim, round 3 a cushion that slides up and down (wait for it).
// The cushions are meshes (only the round you play has them); the fence is foam blocks (y 42..43). Boxes in world units (bubbles.js).
export const COURT = {
  y: RIM.y + 1, fence: { x0: 75, x1: 86, z0: 29, z1: 30 }, wall: { x: WELL.x, z: WELL.z, r: WELL.r },
  rounds: [
    { pad: { x: 80.5, z: 33.5 }, cushions: [{ x0: 94, x1: 95, z0: 24, z1: 31 }] },
    { pad: { x: 84.5, z: 34.5 }, cushions: [{ x0: 70, x1: 71, z0: 24, z1: 31 }] },
    { pad: { x: 86.5, z: 34.5 }, cushions: [], slider: { box: { x0: 92, x1: 93, z0: 27, z1: 29 }, dx: 0, dz: 4, period: 5 } },
  ],
};
// The shield's radius where the shots fly (BANK.h over the rim's floor), and round k's court for bankShot (k 0..2).
export const planeR = r => Math.sqrt(Math.max(0.01, r * r - (SHIELD.y - (COURT.y + BANK.h)) ** 2));
export const courtOf = k => { const r = COURT.rounds[k]; return { target: SHIELD, radius: planeR(SHIELD.radii[k]), guards: [COURT.fence], wall: COURT.wall, cushions: r.cushions, slider: r.slider, pad: r.pad }; };
export const LIFTS = [ // switched on by the live part (they are in world.lifts only while on): after the stairs, after the chimney
  { id: 'lift1', x: [124, 125], z: [67, 68], y: [5, 18] },
  { id: 'lift2', x: [109, 110], z: [40, 41], y: [19, 41] },
];
export const DRIPS = [ // in the narrow shaft, from spouts on its rim
  { x: 111.4, z: 66.5, top: 18.6, bottom: 11, period: 2.2, phase: 0, speed: 7 },   // (rework 2026-10-29: over the west half of the way up,
  { x: 111.4, z: 62.5, top: 18.6, bottom: 11, period: 2.2, phase: 1.1, speed: 7 }, //  where the side wind blows: blow on the east side and keep going)
];
export const VENT2 = { x0: 110, x1: 114, y0: 13, y1: 15, z0: 60, z1: 66, vx: -0.5, vy: 0, vz: 0 }; // the narrow shaft's side wind
// The fizzy breeze that blows out of the plateau's cliff over the bench: bubbles higher than the bench are blown away from the cliff, so
// the narrow shaft (sheltered) is the only way up to the plateau. You can see it: little bubbles streaming out.
export const BREEZES = [ // in front of the bench, and beside its two ends (the narrow shaft stays sheltered)
  { x0: 92, x1: 128, y0: 13, y1: 24, z0: 72, z1: 90, vx: 0, vy: 0, vz: 2.4 },
  { x0: 92, x1: 97, y0: 13, y1: 24, z0: 66, z1: 71, vx: -2.4, vy: 0, vz: 0 },
  { x0: 123, x1: 128, y0: 13, y1: 24, z0: 66, z1: 71, vx: 2.4, vy: 0, vz: 0 },
];
export const BREEZE = BREEZES[0];
export const SOAP_FLOWERS = [[104.5, 5, 80.5], [104.5, 7, 72.5], [88.5, 5, 126.5], [102.5, 11, 69.5], [118.5, 11, 69.5], [108.5, 19, 57.5], [84.5, 19, 64.5], [69.5, 42, 29.5], [91.5, 42, 29.5], [77.5, 42, 35.5], [54.5, 42, 30.5]];
export const ARRIVAL = { x: 80, z: 134 };                      // the bottom way back (you arrive 3 in front of it, looking north)
export const RIM_DOOR = { x: 100, z: 27 };                     // the way back on the rim (facing south, onto the walk)
export const BEE = { name: 'Bubble Bee', x: 84, z: 130, facing: [-1, -1], colors: { shirt: 0xffd23a, pants: 0x3a3a4a, hair: 0x3a2a1a, skin: 0xf2d0b0 }, look: 'bubble' };
export const LEVELS = [FLOOR + 1, BENCH.top + 1, MESA.top + 1, RIM.y + 1]; // the ledges you stand on: floor, bench, plateau, rim

// The saved keys (in `beaten`) and what is drawn from them.
export const stairsKey = 'pw:bubble:stairs';
export const duckKey = n => `pw:bubble:duck${n}`;
export const chimneyKey = 'pw:bubble:chimney';
export const shieldKey = n => `pw:bubble:shield${n}`;
export const BUBBLE_KEYS = () => [stairsKey, duckKey(1), duckKey(2), duckKey(3), chimneyKey, shieldKey(1), shieldKey(2), shieldKey(3)];
// -> { stairs, ducks (0..3), duck: [bool x3], chimney, shields (0..3), shield: [bool x3], n (stretch steps 0..5), need, done (the three
//      stretches), ready (and the shields), star, lift1, lift2 }
export function bubbleState(game) {
  const has = k => !!game?.beaten?.includes(k);
  const duck = [1, 2, 3].map(n => has(duckKey(n))), shield = [1, 2, 3].map(n => has(shieldKey(n)));
  const stairs = has(stairsKey), chimney = has(chimneyKey), star = !!game?.stars?.includes('bubble');
  const ducks = duck.filter(Boolean).length, shields = shield.filter(Boolean).length;
  const n = (stairs ? 1 : 0) + ducks + (chimney ? 1 : 0), done = n === 5;
  return { stairs, duck, ducks, chimney, shield, shields, n, need: 5, done, ready: done && shields === 3, star, lift1: stairs || star, lift2: chimney || star };
}

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
const fill = (world, x0, x1, y0, y1, z0, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(world, x, y, z, id); };
const box = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });
export const rWell = (x, z) => Math.hypot(x + 0.5 - WELL.x, z + 0.5 - WELL.z);
export const rChim = (x, z) => Math.hypot(x + 0.5 - CHIMNEY.x, z + 0.5 - CHIMNEY.z);
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export const inChimney = (x, y, z) => rChim(Math.floor(x), Math.floor(z)) < CHIMNEY.r && y >= CHIMNEY.floor - 0.5 && y < WELL.top + 3;
export const onRim = (x, z) => { const r = rWell(Math.floor(x), Math.floor(z)), b = RIM.balcony, fx = Math.floor(x), fz = Math.floor(z); return (r >= RIM.r0 && r < WELL.r) || (fx >= b.x0 && fx <= b.x1 && fz >= b.z0 && fz <= b.z1); };
export const inGarden = (x, z) => x >= GARDEN.x0 && x < GARDEN.x1 && z >= GARDEN.z0 && z < GARDEN.z1;
const inShaft2 = (x, z) => x >= SHAFT2.x0 && x <= SHAFT2.x1 && z >= SHAFT2.z0 && z <= SHAFT2.z1;

// Where the guide points (TERRAIN_AIMS.bubbleLand; the live part's aim runs first and asks this). One stretch at a time.
export function bubbleAim(world, p, game) {
  const st = bubbleState(game);
  const word = (x, z, t) => ({ x, z, text: (a, m) => `${t} ${a} ${m}m` });
  const ride = game?.gymLive?.of?.('part:bubble')?.ride;
  if (ride) { // in the Chimney Ride: the next gold ring (or past the arm to the top)
    const p0 = CHIMNEY.plates.find(q => ride.y < q.y + 1);
    if (p0) { const g = gapOf(CHIMNEY, p0); return { x: g.x, z: g.z, text: () => '🫧 Float under the gold ring, then puff up through it!' }; }
    return { text: () => '🫧 Wait for the arm to pass, then puff up to the top!' };
  }
  if (!st.stairs && !st.star) {
    if (p.y < STEP1.top + 0.5) return word(104.5, 74.5, '🫧 Bubble Stairs: blow a bubble ahead, hop on!');
    if (p.y < BENCH.top + 0.5) return word(104.5, 70.5, '🫧 Turn to the side, blow, hop, turn back: up to the bench!');
    if (p.y < MESA.top + 0.5) return word(112.5, 61.5, '🫧 Up the narrow shaft! Let each bubble float up a bit before you hop.');
  }
  if (p.y < MESA.top + 0.5) { // down on the floor or the bench: the fizz lift (on once you did the stairs)
    if (st.lift1) return word(LIFTS[0].x[0] + 1, LIFTS[0].z[0] + 1, '⬆️ The fizz lift');
    return word(104.5, 75.5, '🫧 Bubble Stairs');
  }
  if (st.ducks < 3 && p.y < RIM.y) {
    const i = st.duck.findIndex(d => !d), live = game?.gymLive?.of?.('part:bubble'), dk = live?.ducks?.[i];
    const at = dk ? [dk.x, dk.z] : ISLANDS[i];
    return word(at[0], at[1], dk?.state === 'float' ? `🦆 Puff duckling ${i + 1} to the nest!` : `🦆 Duckling ${i + 1}: blow a bubble round it!`);
  }
  if (!st.chimney && p.y < RIM.y) return word(CHIMNEY.x + CHIMNEY.r + 1, CHIMNEY.z, '🫧 The Chimney Ride: tap to puff up!');
  if (st.shields < 3 && !st.star) {
    if (p.y < RIM.y) return st.lift2 ? word(LIFTS[1].x[0] + 1, LIFTS[1].z[0] + 1, '⬆️ The fizz lift to the rim') : word(CHIMNEY.x + CHIMNEY.r + 1, CHIMNEY.z, '🫧 The Chimney Ride');
    const k = st.shield.findIndex(s => !s), pad = COURT.rounds[k].pad;
    return word(pad.x, pad.z, `🛡️ Stand on gold pad ${k + 1}, bounce a bubble off the pink cushion into the shield!`);
  }
  if (p.y < RIM.y && !game?.stars?.includes('bubble')) return st.lift2 ? word(LIFTS[1].x[0] + 1, LIFTS[1].z[0] + 1, '⬆️ The fizz lift to the rim') : null;
  return null; // the base: the crew, then Captain Suds, then the way back
}

export function bubbleLand(world, def) {
  kit(world);
  const { W, D } = world;
  // 1. the well: a round fizzy wall (and solid outside it) up to WELL.top, a foam floor inside
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const r = rWell(x, z);
    if (r >= WELL.r) { fill(world, x, x, 0, WELL.top, z, z, B.FIZZ_WALL); world.ground[x + z * W] = WELL.top; continue; }
    fill(world, x, x, 0, FLOOR - 1, z, z, B.FIZZ_WALL);
    put(world, x, FLOOR, z, B.FOAM);
    world.ground[x + z * W] = FLOOR;
    // 2. the plateau (north): solid fizz up to MESA.top, foam on top
    if (z <= MESA.z1) { fill(world, x, x, FLOOR, MESA.top - 1, z, z, B.FIZZ_WALL); put(world, x, MESA.top, z, B.FOAM); world.ground[x + z * W] = MESA.top; }
    // 3. the rim walk: a ring of foam at RIM.y, and the balcony by the throne (never over the chimney's inside)
    if ((onRim(x, z)) && rChim(x, z) >= CHIMNEY.r) put(world, x, RIM.y, z, B.FOAM);
  }
  // 4. a fizzy pool in the middle of the floor (soda water with a foam ring)
  for (let x = 66; x <= 94; x++) for (let z = 92; z <= 116; z++) {
    const d = Math.hypot((x - 80) / 14, (z - 104) / 12);
    if (d < 1) put(world, x, FLOOR, z, d > 0.86 ? B.FOAM : B.WATER);
  }
  // 5. the bench (the top of shaft 1) and the wide shaft's arms
  fill(world, BENCH.x0, BENCH.x1, FLOOR + 1, BENCH.top - 1, BENCH.z0, BENCH.z1, B.FIZZ_WALL);
  fill(world, BENCH.x0, BENCH.x1, BENCH.top, BENCH.top, BENCH.z0, BENCH.z1, B.FOAM);
  for (const x of SHAFT1.arms) fill(world, x, x, FLOOR + 1, BENCH.top, SHAFT1.z0, SHAFT1.z1, B.FIZZ_WALL);
  fill(world, BENCH.x0, BENCH.x1, BENCH.roof, MESA.top - 1, BENCH.z0, BENCH.z1, B.FIZZ_WALL); // the overhang over the bench
  fill(world, BENCH.x0, BENCH.x1, MESA.top, MESA.top, BENCH.z0, BENCH.z1, B.FOAM);
  for (let x = SHAFT1.x0; x <= SHAFT1.x1; x++) put(world, x, FLOOR, SHAFT1.z1 + 1, WOOL.bubble); // a start line in front of the shaft
  fill(world, STEP1.x0, STEP1.x1, FLOOR + 1, STEP1.top - 1, STEP1.z0, STEP1.z1, B.FIZZ_WALL); // the low foam step in the wide shaft
  fill(world, STEP1.x0, STEP1.x1, STEP1.top, STEP1.top, STEP1.z0, STEP1.z1, B.FOAM);
  // 6. the narrow shaft: a notch cut into the plateau from the bench level up; spouts on its rim for the drips
  fill(world, SHAFT2.x0, SHAFT2.x1, BENCH.top + 1, MESA.top, SHAFT2.z0, SHAFT2.z1, B.AIR);
  fill(world, SHAFT2.x0, SHAFT2.x1, BENCH.top, BENCH.top, SHAFT2.z0, SHAFT2.z1, B.FOAM);
  fill(world, SHAFT2.x1 + 1, SHAFT2.x1 + 1, VENT2.y0, VENT2.y1, VENT2.z0 + 2, VENT2.z0 + 4, WOOL.bubble); // the side vent's grate
  // 7. the Duckling Garden: a low foam rim (gaps to walk through), bubble-wool islands and the nest's ring
  const G = MESA.top + 1;
  for (let x = GARDEN.x0 - 1; x <= GARDEN.x1; x++) for (const z of [GARDEN.z0 - 1, GARDEN.z1]) if (Math.abs(x - 80) > 1) put(world, x, G, z, B.FOAM);
  for (let z = GARDEN.z0 - 1; z <= GARDEN.z1; z++) for (const x of [GARDEN.x0 - 1, GARDEN.x1]) if (Math.abs(z - 50) > 1) put(world, x, G, z, B.FOAM);
  for (const [ix, iz] of ISLANDS) fill(world, Math.floor(ix) - 1, Math.floor(ix) + 1, MESA.top, MESA.top, Math.floor(iz) - 1, Math.floor(iz) + 1, WOOL.bubble);
  for (let x = 77; x <= 84; x++) for (let z = 39; z <= 46; z++) { const d = Math.hypot(x + 0.5 - NEST.x, z + 0.5 - NEST.z); if (d > 1.5 && d < 2.6) put(world, x, MESA.top, z, WOOL.cozy); }
  for (const c of CURRENTS) for (let z = c.z0; z < c.z1; z += 3) for (let x = c.x0; x < c.x1; x++) if ((x + z) % 2 === 0) put(world, x, MESA.top, z, WOOL.water); // the current's stripes on the floor
  // 8. the chimney: a tube of fizzy wall, glass toward the well's middle, a door east; open at the top onto the rim
  const C = CHIMNEY;
  for (let x = Math.floor(C.x - C.wall - 1); x <= Math.ceil(C.x + C.wall + 1); x++) for (let z = Math.floor(C.z - C.wall - 1); z <= Math.ceil(C.z + C.wall + 1); z++) {
    const r = rChim(x, z), a = Math.atan2(z + 0.5 - C.z, x + 0.5 - C.x);
    if (r < C.r) { fill(world, x, x, C.floor, WELL.top + 3, z, z, B.AIR); continue; }
    if (r >= C.wall) continue;
    for (let y = C.floor; y <= RIM.y; y++) {
      const door = angDiff(a, C.door.a) < C.door.w && y <= C.door.y1;
      const glass = angDiff(a, C.window.a) < C.window.w && y >= C.window.y0 && y <= C.window.y1;
      put(world, x, y, z, door ? B.AIR : glass ? B.GLASS : y === RIM.y ? B.FOAM : B.FIZZ_WALL);
    }
  }
  // 9. the rim: Captain Suds' foam throne, the vents' grates
  fill(world, BOSS_AT.x - 2, BOSS_AT.x + 2, RIM.y + 1, RIM.y + 1, BOSS_AT.z - 2, BOSS_AT.z - 2, B.FOAM);
  fill(world, BOSS_AT.x - 2, BOSS_AT.x + 2, RIM.y + 2, RIM.y + 3, BOSS_AT.z - 3, BOSS_AT.z - 3, B.FOAM);
  put(world, BOSS_AT.x - 2, RIM.y + 1, BOSS_AT.z - 1, B.FOAM); put(world, BOSS_AT.x + 2, RIM.y + 1, BOSS_AT.z - 1, B.FOAM);
  const F = COURT.fence; // the foam fence that hides the throne from the balcony (a shot pops on it), and the gold pads' bubble-wool middles
  fill(world, F.x0, F.x1 - 1, RIM.y + 1, RIM.y + 2, F.z0, F.z1 - 1, B.FOAM);
  for (const r of COURT.rounds) put(world, Math.floor(r.pad.x), RIM.y, Math.floor(r.pad.z), WOOL.bubble);
  // 10. the fizz lifts' spouts (a ring of bubble wool round the bottom of each)
  for (const l of LIFTS) for (let x = l.x[0] - 1; x <= l.x[1] + 1; x++) for (let z = l.z[0] - 1; z <= l.z[1] + 1; z++) {
    if (x >= l.x[0] && x <= l.x[1] && z >= l.z[0] && z <= l.z[1]) { put(world, x, l.y[0] - 1, z, WOOL.bubble); continue; }
    if (world.get(x, l.y[0], z) === B.AIR && world.get(x, l.y[0] - 1, z) !== B.AIR && !(z >= BENCH.z0 && z <= BENCH.z1 && x <= BENCH.x1)) put(world, x, l.y[0] - 1, z, WOOL.bubble);
  }
  // 11. keeps: the whole well (no building, no riding), the ways back, the Boss
  const keeps = [{ name: 'well', protect: [box(0, W - 1, 0, 47, 0, D - 1)], wallText: 'This is the Bubble Well. Bubbles only, no building!', rideText: 'No riding in the well! Your bubbles are the ride.' }];
  buildWayBack(world, 'bubble', { x: ARRIVAL.x, y: FLOOR, z: ARRIVAL.z, facing: [0, -1] });
  buildWayBack(world, 'bubble-rim', { x: RIM_DOOR.x, y: RIM.y, z: RIM_DOOR.z, facing: [0, 1] });
  placeBoss(world, 'bubble', { x: BOSS_AT.x, y: RIM.y, z: BOSS_AT.z, facing: [0, 1] });
  placeCrew(world, 'bubble', 0, { x: 106, y: MESA.top, z: 57, facing: [1, 1] });                                  // Wanda Wand at the top of the stairs
  placeCrew(world, 'bubble', 1, { x: 77, y: MESA.top, z: 46, facing: [1, -1] });                                  // Duckherd Daisy by the nest
  placeCrew(world, 'bubble', 2, { x: Math.floor(C.landing[0]) + 2, y: RIM.y, z: Math.floor(C.landing[1]) - 1, facing: [-1, 0] }); // Mate Fizz by the chimney's top
  world.people ??= [];
  world.people.push({ name: BEE.name, title: `${BEE.name} · Bubble Well`, colors: BEE.colors, look: BEE.look, line: 'Hello! That wand blows a bubble just ahead of you. Blow, hop on, hop again! Let it float up a little and it lifts you higher.', pos: [BEE.x + 0.5, FLOOR + 1, BEE.z + 0.5], heading: Math.atan2(BEE.facing[0], BEE.facing[1]) });
  // 12. nooks (where the wild Bubble creatures float), rests, the part
  const nooks = [];
  for (const [x, y, z] of [[66, FLOOR + 1, 122], [96, FLOOR + 1, 122], [58, FLOOR + 1, 100], [104, FLOOR + 1, 98], [60, FLOOR + 1, 76], [118, FLOOR + 1, 84],
    [52, G, 58], [118, G, 40], [58, G, 30], [100, G, 30], [36, G, 56], [124, G, 56], [57, RIM.y + 1, 32], [106, RIM.y + 1, 36], [130, RIM.y + 1, 80], [30, RIM.y + 1, 80]]) {
    if (world.get(x, y, z) === B.AIR && world.get(x, y + 1, z) === B.AIR && world.get(x, y - 1, z) !== B.AIR && rChim(x, z) >= C.wall) nooks.push({ kind: 'float', x, y, z });
  }
  world.nooks = nooks;
  for (const r of [[80.5, FLOOR + 1, 120.5, Math.PI], [110.5, BENCH.top + 1, 69.5, Math.PI], [104.5, G, 50.5, Math.PI], [C.landing[0], RIM.y + 1, C.landing[1], 0]]) world.rests.push(r);
  for (const k of keeps) world.keeps.push(k);
  world.lifts = [];
  world.bubble = { well: WELL, chimney: C, garden: GARDEN_RULES, court: COURT, lifts: LIFTS, drips: DRIPS, vent2: VENT2, breezes: BREEZES, flowers: SOAP_FLOWERS };
  world.realmBiome = () => 'bubble';
  world.underground = () => false; // the well is open to the sky: never "dark down here"
  world.parts.push({ id: 'bubble', live: 'bubble', area: box(0, W - 1, 0, 47, 0, D - 1) });
}

export const inStairs = (x, y, z) => (x >= SHAFT1.x0 - 1 && x <= SHAFT1.x1 + 1 && z >= BENCH.z0 && z <= SHAFT1.z1 + 3 && y < MESA.top + 1) || (inShaft2(Math.floor(x), Math.floor(z)) && y < MESA.top + 1);
export { pictureAim };
