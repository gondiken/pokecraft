// The Bubble Well (realm `bubble`, plans/bubble-well.md), a Picture World behind the Swirl's pale blue frame (the old `secret4`): the
// Bubble Well. Terrain as data, Node-runnable (needs only a world with W / D / data / ground / index / inBounds / get, like castleland.js).
// One big climb inside a round well of fizzy soda walls (redesign 2026-10-29, "natural rules"): the foam floor with the way back, the Fizz
// Ledges (wide foam ledges up the plateau's cliff, a soap pot on each; ride a bubble from one to the next), the Duckling Garden on the
// plateau (islands, a current, thorny coral, a gust lane, the nest), the Geyser Chimney (a glass-sided tube up to the rim), the rim walk
// with Captain Suds' throne and his three shield bubbles bobbing on the breeze, and a second way back. Two fizz lifts (lift streams) carry
// you up once you did a stretch, so a finished climb is never done twice.
// The rules are pure (bubbles.js); bubblelive.js wires them. Every block here is fixed: the whole well is a keep (no building, no riding).
import { B, WOOL } from './blocks.js';
import { kit, buildWayBack, placeBoss, placeCrew, pictureAim } from './picturelands.js';
import { gapOf } from './bubbles.js';

export const SIZE = 160;
export const WELL = { x: 80, z: 80, r: 58, top: 44 };         // the round wall: cells whose middle is r or more from the middle, y 0..top
export const FLOOR = 4;                                        // the floor's top block (you stand at y 5)
export const MESA = { z1: 66, top: 18 };                       // the plateau: every cell with z <= z1 is solid up to y 18 (stand at 19)
// Redesign 2026-10-29 (owner: "the beginning was extremely hard because there was so little space"): the Fizz Ledges. Wide foam ledges
// stand out from the plateau's cliff at different heights and gaps; each has a soap pot. Dip, blow a bubble, hop on, it carries you up
// (and drifts with the fizz streams you can see), hop off onto the next ledge before it pops. One dip = one bubble, and a bubble never
// lifts you as much as 6 (bubbles.js rideUp), so every ledge is needed: the floor -> 1 (3 up, still air), 1 -> 2 (3 up, still air, turn
// east), 2 -> 3 (3 up, a fizz stream blows away from ledge 3: blow from the north corner), 3 -> the plateau (5 up: ride to the very end;
// along the cliff, drips from its edge and a gust now and then: blow right after one).
export const LEDGES = [
  { n: 1, x0: 99, x1: 102, z0: 74, z1: 77, top: 7, pot: [102.4, 74.6] },
  { n: 2, x0: 106, x1: 109, z0: 70, z1: 73, top: 10, pot: [109.4, 73.4] },
  { n: 3, x0: 113, x1: 116, z0: 68, z1: 71, top: 13, pot: [116.4, 71.4] },
];
export const CLIMB = { x0: 92, x1: 124, z0: 67, z1: 90 };       // the Fizz Ledges' part of the well (cells), floor to plateau
export const STAIRS_TOP = { x0: 100, x1: 124, z0: 50, z1: 66 }; // landing on the plateau here from a bubble = the climb done (pw:bubble:stairs)
// The soap pots (feet height y): the floor's by the first ledge, one on every ledge, the garden's by the islands, three on the balcony.
export const SOAP_POTS = [
  [100.5, FLOOR + 1, 82.5],
  ...LEDGES.map(l => [l.pot[0], l.top + 1, l.pot[1]]),
  [83.5, MESA.top + 1, 60.5], [67.5, MESA.top + 1, 56.5], [97.5, MESA.top + 1, 61.5],
  [74.5, 42, 34.5], [86.5, 42, 34.5], // the rim: one under each high shield's way (SHIELDS 2 and 3; the low first one needs none)
];
export const RIM_POTS = [null, ...SOAP_POTS.slice(-2)]; // (by shield: RIM_POTS[k] is the pot under shield k)
// Moving air you can see (streams of little bubbles): bubbles drift with it, you only while you ride one. period / on / warn: a gust.
export const WINDS = [
  { id: 'stream', x0: 110, x1: 112, y0: 11, y1: 13, z0: 67, z1: 77, vx: 0, vy: 0, vz: 1.2 },                                      // ledge 2 -> 3: away from the cliff
  { id: 'gust', x0: 109, x1: 121, y0: 14, y1: 23, z0: 67, z1: 72, vx: 0, vy: 0, vz: 1.5, period: 5, on: 1.0, warn: 0.9, phase: 0 }, // ledge 3: off the cliff now and then
  { id: 'rim', x0: 68, x1: 93, y0: 42, y1: 50, z0: 26, z1: 37, vx: 0, vy: 0, vz: -0.45 },                                         // the rim: a breeze toward the throne
];
export const DRIPS = [ // from spouts on the plateau's edge over ledge 3's way up: they pop a bubble under them
  { x: 113.6, z: 67.9, top: 18.4, bottom: 14, period: 2.4, phase: 0, speed: 6 },
  { x: 116.0, z: 67.9, top: 18.4, bottom: 14, period: 2.4, phase: 1.2, speed: 6 },
];
export const GARDEN = { x0: 62, x1: 99, z0: 38, z1: 63 };      // the Duckling Garden's rim (cells x0..x1-1, z0..z1-1 inside)
export const NEST = { x: 80.5, z: 42.5, r: 1.4 };
export const ISLANDS = [[80.5, 56.5], [65.5, 52.5], [94.5, 59.5]]; // duckling 1 (straight), 2 (over the current), 3 (through the thorns)
export const CURRENTS = [{ x0: 70, x1: 74, z0: 38, z1: 63, vx: 0, vz: 1.2 }]; // a stream of tiny bubbles flowing south
// A gusty gap between the thorn pen's two rows: calm, then a puff of little bubbles gathers (warn), then it blows south toward row A's
// thorns for a moment. Duckling 3 must cross it between two gusts (a quick, strong puff right after one). (Redesign: a little stronger.)
export const GUSTS = [{ x0: 88, x1: 92, z0: 50, z1: 54, vx: 0, vz: 2.0, period: 4.5, on: 1.1, warn: 0.8, phase: 0 }];
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
// The chimney: a tube of fizzy wall (inside radius 4.5) on the plateau up to the rim, a glass strip toward the well's middle, a door east.
// Redesign 2026-10-29 (owner: "this could be a little longer; it finishes in 10 seconds"): five gold rings on the way up (the first right
// over the start, the fourth turns slowly), two fans, the arm near the top. Owner 2026-10-30 ("you can make the chimney ride slightly
// longer as well"): the chimney now stands up out of the rim as a glass-fronted stack (to y 47, the top of the world) with one more
// stretch in it: a sixth gold ring that turns the other way, then a second, slower arm that turns the other way too. The same pieces,
// mirrored: gentle variety, not harder. A bar of soap floats over every ring (the ride's checkpoints).
export const CHIMNEY = {
  x: 46.5, z: 40.5, r: 4.5, wall: 5.8, floor: 19, top: 48.3, stack: 47, door: { a: 0, w: 0.4, y1: 23 }, window: { w: 0.5, y0: 22, y1: 46 },
  plates: [{ y: 22.6, a: 0, d: 0 }, { y: 25.9, a: Math.PI, d: 2.8 }, { y: 29.2, a: 0.2, d: 2.8 }, { y: 32.5, a: 0.4, d: 2.5, spin: 0.3 }, { y: 36.0, a: 2.4, d: 2.8 }, { y: 42.9, a: 4.0, d: 2.6, spin: -0.22 }],
  fans: [{ y0: 33.3, y1: 34.9, vx: Math.cos(2.0) * 0.8, vz: Math.sin(2.0) * 0.8 }, { y0: 37.6, y1: 38.8, vx: Math.cos(5.0) * 0.6, vz: Math.sin(5.0) * 0.6 }],
  bars: [{ y: 39.6, speed: 1 }, { y: 45.9, speed: -0.75, a0: 4.0 }],
};
CHIMNEY.fan = CHIMNEY.fans[0]; CHIMNEY.bar = CHIMNEY.bars[0];
CHIMNEY.stars = [{ x: CHIMNEY.x, y: CHIMNEY.floor + 1.0, z: CHIMNEY.z }, ...CHIMNEY.plates.map(p => ({ ...gapOf(CHIMNEY, { ...p, spin: 0 }), y: p.y + 1.6 }))];
CHIMNEY.window.a = Math.atan2(WELL.z - CHIMNEY.z, WELL.x - CHIMNEY.x);
CHIMNEY.landing = (() => { const rx = (CHIMNEY.x - WELL.x), rz = (CHIMNEY.z - WELL.z), l = Math.hypot(rx, rz); return [CHIMNEY.x + (-rz / l) * -7, CHIMNEY.z + (rx / l) * -7]; })();
export const RIM = { r0: 50, y: 41, balcony: { x0: 74, x1: 87, z0: 30, z1: 36 } }; // the rim walk (stand at 42): a ring r0..WELL.r and a balcony
export const BOSS_AT = { x: 80, z: 25 };
// Owner 2026-10-30: "I didn't understand what I was supposed to do with Captain Suds' shields. They didn't seem to be preventing him from
// battling, and I didn't get that I was supposed to jump on top of them." Now Captain Suds sits sealed inside a big bubble (DOME) over his
// throne: you can see him waving in there and you can't get in (it boings you back). Each shield bubble sends a trail of little bubbles
// into the dome; every popped shield pops one of the dome's three skins; the last one bursts it and he is free to battle.
// Shield 1 rests low on the balcony's foam right in front of him (a bubble on a soapy floor is a dome): walk into it and it boings you
// back, jump onto it and it pops. Shields 2 and 3 bob high on the breeze (too high for a jump from anything you stand on): a bubble from
// the soap pot under each carries you above it, hop off and drop onto its top.
export const DOME = { x: 80.5, y: 42.6, z: 25.5, r: 3.4, skin: 0.22 }; // its middle, its outer radius, the gap between its three skins
export const SHIELDS = [
  { x: 80.5, y: 41.75, z: 32.6, r: 1.3, ax: 0.35, ay: 0, az: 0.2, period: 6, phase: 0, low: true },
  { x: 74.5, y: 45.5, z: 31.0, r: 1.3, ax: 1.9, ay: 0.3, az: 0.7, period: 6.5, phase: 0 },
  { x: 86.5, y: 45.7, z: 31.0, r: 1.2, ax: 1.1, ay: 0.4, az: 1.7, period: 5, phase: 2 },
];
export const SHIELD = { x: 80.5, y: 45, z: 30.5, radii: SHIELDS.map(s => s.r) }; // (where the shields are, for the guide and the pictures)
export const LIFTS = [ // switched on by the live part (they are in world.lifts only while on): after the ledges, after the chimney
  { id: 'lift1', x: [124, 125], z: [67, 68], y: [5, 18] },
  { id: 'lift2', x: [109, 110], z: [40, 41], y: [19, 41] },
];
export const SOAP_FLOWERS = []; // (redesign 2026-10-29: the soap pots replaced them)
export const ARRIVAL = { x: 80, z: 134 };                      // the bottom way back (you arrive 3 in front of it, looking north)
export const RIM_DOOR = { x: 100, z: 27 };                     // the way back on the rim (facing south, onto the walk)
export const BEE = { name: 'Bubble Bee', x: 84, z: 130, facing: [-1, -1], colors: { shirt: 0xffd23a, pants: 0x3a3a4a, hair: 0x3a2a1a, skin: 0xf2d0b0 }, look: 'bubble' };

// The saved keys (in `beaten`) and what is drawn from them. (Redesign 2026-10-29: the keys and their names stay; `stairs` now means the
// Fizz Ledges and `shield1..3` a shield popped by a stomp: a saved key always still counts.)
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
export const inChimney = (x, y, z) => rChim(Math.floor(x), Math.floor(z)) < CHIMNEY.r && y >= CHIMNEY.floor - 0.5 && y < CHIMNEY.top + 1;
export const onRim = (x, z) => { const r = rWell(Math.floor(x), Math.floor(z)), b = RIM.balcony, fx = Math.floor(x), fz = Math.floor(z); return (r >= RIM.r0 && r < WELL.r) || (fx >= b.x0 && fx <= b.x1 && fz >= b.z0 && fz <= b.z1); };
export const inGarden = (x, z) => x >= GARDEN.x0 && x < GARDEN.x1 && z >= GARDEN.z0 && z < GARDEN.z1;
export const inClimb = (x, y, z) => x >= CLIMB.x0 && x <= CLIMB.x1 + 1 && z >= CLIMB.z0 && z <= CLIMB.z1 + 1 && y < MESA.top + 0.5;
// The ledge whose top you stand on (feet at y), or null: 0 = the floor, 1..3 the Fizz Ledges.
export const ledgeAt = (x, y, z) => {
  if (Math.abs(y - (FLOOR + 1)) < 0.3) return 0;
  const l = LEDGES.find(q => Math.abs(y - (q.top + 1)) < 0.3 && x >= q.x0 - 0.4 && x <= q.x1 + 1.4 && z >= q.z0 - 0.4 && z <= q.z1 + 1.4);
  return l ? l.n : null;
};

// Where the guide points (TERRAIN_AIMS.bubbleLand; the live part's aim runs first and asks this). One stretch at a time, short words.
export function bubbleAim(world, p, game) {
  const st = bubbleState(game);
  const word = (x, z, t) => ({ x, z, text: (a, m) => `${t} ${a} ${m}m` });
  const ride = game?.gymLive?.of?.('part:bubble')?.ride;
  if (ride) { // in the Chimney Ride: the next gold ring (or past the arm to the top)
    const p0 = CHIMNEY.plates.find(q => ride.y < q.y + 1);
    if (p0 && !CHIMNEY.bars.some(b => ride.y < b.y + 1 && b.y < p0.y)) { const g = gapOf(CHIMNEY, p0, ride.t); return { x: g.x, z: g.z, text: () => '🫧 Up through the gold ring!' }; }
    return { text: () => '🫧 Up to the top!' };
  }
  if (!st.stairs && !st.star && p.y < MESA.top + 0.5) {
    const l = LEDGES.find(q => q.top + 1 > p.y + 0.5);
    return l ? word(l.x0 + 2, l.z0 + 2, `🫧 Ledge ${l.n}`) : word(114, 64, '🫧 Up to the top!');
  }
  if (p.y < MESA.top + 0.5) { // down on the floor or a ledge: the fizz lift (on once you did the ledges)
    if (st.lift1) return word(LIFTS[0].x[0] + 1, LIFTS[0].z[0] + 1, '⬆️ The fizz lift');
    return word(100.5, 82.5, '🫧 The soap pot');
  }
  if (st.ducks < 3 && p.y < RIM.y) {
    const i = st.duck.findIndex(d => !d), live = game?.gymLive?.of?.('part:bubble'), dk = live?.ducks?.[i];
    const at = dk ? [dk.x, dk.z] : ISLANDS[i];
    return word(at[0], at[1], `🦆 Duckling ${i + 1}`);
  }
  if (!st.chimney && p.y < RIM.y) return word(CHIMNEY.x + CHIMNEY.r + 1, CHIMNEY.z, '🫧 The Chimney Ride');
  if (st.shields < 3 && !st.star) {
    if (p.y < RIM.y) return st.lift2 ? word(LIFTS[1].x[0] + 1, LIFTS[1].z[0] + 1, '⬆️ The fizz lift to the rim') : word(CHIMNEY.x + CHIMNEY.r + 1, CHIMNEY.z, '🫧 The Chimney Ride');
    const k = st.shield.findIndex(s => !s), s = SHIELDS[k];
    return word(s.x, s.z, k === 0 ? '🫧 Captain Suds' : '🫧 Shield bubble'); // (the low first shield is right in front of him)
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
  // 5. the Fizz Ledges: wide foam tops on fizzy pillars (bubble-wool stripes round their tops so each reads as a ledge from below)
  for (const l of LEDGES) {
    fill(world, l.x0, l.x1, FLOOR + 1, l.top - 1, l.z0, l.z1, B.FIZZ_WALL);
    fill(world, l.x0, l.x1, l.top, l.top, l.z0, l.z1, B.FOAM);
    for (let x = l.x0; x <= l.x1; x++) for (const z of [l.z0, l.z1]) put(world, x, l.top - 1, z, WOOL.bubble);
    for (let z = l.z0; z <= l.z1; z++) for (const x of [l.x0, l.x1]) put(world, x, l.top - 1, z, WOOL.bubble);
  }
  // the drips' spouts on the plateau's edge (bubble wool)
  for (const d of DRIPS) put(world, Math.floor(d.x), MESA.top, Math.floor(d.z) - 1, WOOL.bubble);
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
    for (let y = C.floor; y <= C.stack; y++) { // (owner 2026-10-30: up out of the rim as a stack, its top course foam)
      const door = angDiff(a, C.door.a) < C.door.w && y <= C.door.y1;
      const glass = angDiff(a, C.window.a) < C.window.w && y >= C.window.y0 && y <= C.window.y1;
      put(world, x, y, z, door ? B.AIR : glass ? B.GLASS : y === RIM.y || y === C.stack ? B.FOAM : B.FIZZ_WALL);
    }
  }
  // 9. the rim: Captain Suds' foam throne
  fill(world, BOSS_AT.x - 2, BOSS_AT.x + 2, RIM.y + 1, RIM.y + 1, BOSS_AT.z - 2, BOSS_AT.z - 2, B.FOAM);
  fill(world, BOSS_AT.x - 2, BOSS_AT.x + 2, RIM.y + 2, RIM.y + 3, BOSS_AT.z - 3, BOSS_AT.z - 3, B.FOAM);
  put(world, BOSS_AT.x - 2, RIM.y + 1, BOSS_AT.z - 1, B.FOAM); put(world, BOSS_AT.x + 2, RIM.y + 1, BOSS_AT.z - 1, B.FOAM);
  // 10. the fizz lifts' spouts (a ring of bubble wool round the bottom of each)
  for (const l of LIFTS) for (let x = l.x[0] - 1; x <= l.x[1] + 1; x++) for (let z = l.z[0] - 1; z <= l.z[1] + 1; z++) {
    if (x >= l.x[0] && x <= l.x[1] && z >= l.z[0] && z <= l.z[1]) { put(world, x, l.y[0] - 1, z, WOOL.bubble); continue; }
    if (world.get(x, l.y[0], z) === B.AIR && world.get(x, l.y[0] - 1, z) !== B.AIR) put(world, x, l.y[0] - 1, z, WOOL.bubble);
  }
  // 11. keeps: the whole well (no building, no riding), the ways back, the Boss
  const keeps = [{ name: 'well', protect: [box(0, W - 1, 0, 47, 0, D - 1)], wallText: 'This is the Bubble Well. Bubbles only, no building!', rideText: 'No riding in the well! Your bubbles are the ride.' }];
  buildWayBack(world, 'bubble', { x: ARRIVAL.x, y: FLOOR, z: ARRIVAL.z, facing: [0, -1] });
  buildWayBack(world, 'bubble-rim', { x: RIM_DOOR.x, y: RIM.y, z: RIM_DOOR.z, facing: [0, 1] });
  placeBoss(world, 'bubble', { x: BOSS_AT.x, y: RIM.y, z: BOSS_AT.z, facing: [0, 1] });
  placeCrew(world, 'bubble', 0, { x: 106, y: MESA.top, z: 57, facing: [1, 1] });                                  // Wanda Wand at the top of the ledges
  placeCrew(world, 'bubble', 1, { x: 77, y: MESA.top, z: 46, facing: [1, -1] });                                  // Duckherd Daisy by the nest
  placeCrew(world, 'bubble', 2, { x: Math.floor(C.landing[0]) - 2, y: RIM.y, z: Math.floor(C.landing[1]), facing: [1, 0] }); // Mate Fizz by the chimney's stack (where the ride lands you)
  world.people ??= [];
  world.people.push({ name: BEE.name, title: `${BEE.name} · Bubble Well`, colors: BEE.colors, look: BEE.look, line: 'Dip your wand in a soap pot, blow, hop on!', pos: [BEE.x + 0.5, FLOOR + 1, BEE.z + 0.5], heading: Math.atan2(BEE.facing[0], BEE.facing[1]) });
  // 12. nooks (where the wild Bubble creatures float), rests, the part
  const nooks = [];
  for (const [x, y, z] of [[66, FLOOR + 1, 122], [96, FLOOR + 1, 122], [58, FLOOR + 1, 100], [104, FLOOR + 1, 98], [60, FLOOR + 1, 76], [118, FLOOR + 1, 84],
    [52, G, 58], [118, G, 40], [58, G, 30], [100, G, 30], [36, G, 56], [124, G, 56], [57, RIM.y + 1, 32], [106, RIM.y + 1, 36], [130, RIM.y + 1, 80], [30, RIM.y + 1, 80]]) {
    if (world.get(x, y, z) === B.AIR && world.get(x, y + 1, z) === B.AIR && world.get(x, y - 1, z) !== B.AIR && rChim(x, z) >= C.wall) nooks.push({ kind: 'float', x, y, z });
  }
  world.nooks = nooks;
  for (const r of [[80.5, FLOOR + 1, 120.5, Math.PI], [100.5, FLOOR + 1, 85.5, 0], [104.5, G, 50.5, Math.PI], [C.landing[0], RIM.y + 1, C.landing[1], 0]]) world.rests.push(r);
  for (const k of keeps) world.keeps.push(k);
  world.lifts = [];
  world.bubble = { well: WELL, chimney: C, garden: GARDEN_RULES, ledges: LEDGES, pots: SOAP_POTS, shields: SHIELDS, lifts: LIFTS, drips: DRIPS, winds: WINDS };
  world.realmBiome = () => 'bubble';
  world.underground = () => false; // the well is open to the sky: never "dark down here"
  world.parts.push({ id: 'bubble', live: 'bubble', area: box(0, W - 1, 0, 47, 0, D - 1) });
}

export { pictureAim };
