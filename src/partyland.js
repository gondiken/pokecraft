// T48 (owner 2026-10-28, plans/T48-surprise-party.md): Jolly Jax's Surprise Party (TERRAINS.partyLand), the Picture World `doors` that
// replaced the Room of Doors. One big party room inside an enormous present: gift-paper walls with a ribbon band round the top, the open
// lid above, a long party table, piles of presents in the corners, the birthday cake on its plate at the far end, the party floor in the
// middle where the four party games are played, the Party Spinner on the east wall and the frame home by the entrance.
// Terrain as data and pure: needs only a world with W / D / data / ground / index / inBounds / get (the spec runs it on a stand-in in
// Node, like pirateland.js), and imports no live code. The live part is partylive.js.
//
// Coordinates: the room's inside is x 32..73, z 26..75 (the walls one block outside), floor top y 10 (you stand at 11), walls up to
// y 22, no ceiling. North (small z) is the cake, south the frame home, the party floor's middle is the Piñata Party's old rug middle
// (PINATA.ring: 56.5, 53.5), so pinata.js is not changed.
import { B, WOOL } from './blocks.js';
import { kit, flatLand, buildWayBack, placeBoss, placeCrew, pictureAim } from './picturelands.js';
import { PINATA } from './pinata.js';
import { GAMES, GAME_NAMES } from './spinner.js';

export const SIZE = 112;
export const FLOOR = 10;       // the top block of the floor; you stand at 11
export const WALL_TOP = 22;
export const ROOM = { x0: 32, x1: 73, z0: 26, z1: 75 };
export const C = { x: PINATA.ring.x, z: PINATA.ring.z };      // the middle of the party floor
export const SQUARE = { x0: 44, x1: 68, z0: 41, z1: 65 };     // the party floor (the games' sets are built inside it)
// the Party Spinner: a plate on the east wall (its middle, radius) and the pad in front of it
export const SPINNER = { x: 73.96, y: 15.4, z: 53.5, r: 2.6, pad: { x0: 69, x1: 70, z0: 52, z1: 54 }, stand: [70.0, 11, 53.5, -Math.PI / 2] };
export const TABLE = { x0: 34, x1: 36, z0: 38, z1: 66, y: 12 };
// the cake: a white plate in the floor, three tiers (7 x 7, 5 x 5, 3 x 3), eight candles round the middle tier, Jolly Jax on top
export const CAKE = { x: 56, z: 31, plate: 4, tiers: [{ r: 3, y0: 11, y1: 12 }, { r: 2, y0: 13, y1: 14 }, { r: 1, y0: 15, y1: 15 }],
  candles: [[-2, -2], [0, -2], [2, -2], [-2, 0], [2, 0], [-2, 2], [0, 2], [2, 2]], candleY: 15, stand: 15 };
export const PILES = [[ROOM.x0, ROOM.z0, 1, 1], [ROOM.x1, ROOM.z0, -1, 1], [ROOM.x0, ROOM.z1, 1, -1], [ROOM.x1, ROOM.z1, -1, -1]];
export const PRESENT_COLOURS = [WOOL.fire, WOOL.water, WOOL.grass, WOOL.electric, WOOL.pixie, WOOL.mind];
export const REST = [38.5, 11, 53.5, -Math.PI / 2];   // where you wake up after a lost battle: by the table, facing the party
export const FRAME = { x: 56, z: 75 };                 // the way back (an upright frame by the south wall)
// the party crashers (Jolly Jax's helpers): where they stand once they crash the party, and after which bow
export const CRASHERS = [{ i: 0, x: 50, z: 67, after: 1 }, { i: 1, x: 62, z: 67, after: 3 }];
// the guests in party hats (people who only talk): their spots, and where they gather for the cake
export const GUESTS = [
  { name: 'Party Polly', at: [38.5, 11, 44.5], yaw: Math.PI / 2, cake: [51.5, 11, 38.5], colors: { shirt: 0xff8ab0, pants: 0x3a4a8a, hair: 0x5a2a1a, skin: 0xf2c79a }, line: 'Happy party! Spin the Party Spinner and play!' },
  { name: 'Balloon Bo', at: [38.5, 11, 61.5], yaw: Math.PI / 2, cake: [54.5, 11, 39.5], colors: { shirt: 0x6ac8ff, pants: 0xffffff, hair: 0x2a1a10, skin: 0xc68a5a }, line: 'I blew up ALL the balloons. Puff puff!' },
  { name: 'Cupcake Cass', at: [66.5, 11, 32.5], yaw: -0.45, cake: [58.5, 11, 39.5], colors: { shirt: 0xffd23a, pants: 0xb05ae8, hair: 0xe8c03a, skin: 0xf2d0b0 }, line: 'Shh! The cake is a surprise too!' },
  { name: 'Streamer Sam', at: [45.5, 11, 71.5], yaw: Math.PI, cake: [61.5, 11, 38.5], colors: { shirt: 0x6ae86a, pants: 0x2a2a3a, hair: 0x1a1a1a, skin: 0xd8a070 }, line: 'Whack, catch, stack and pop! Four games, four golden bows!' },
];

/* ---------------------------------------- the four game sets (cells flipped with setLive) ---------------------------------------- */

const cellsIn = (x0, x1, z0, z1) => { const out = []; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) out.push([x, z]); return out; };
// The nine boxes of Jack Catch and Pop-Up Whack (3 x 3, two apart; numbered row by row from the far row) and the carpet round them.
const GRID = { xs: [54, 56, 58], zs: [49, 51, 53] };
export function boxesOf(zs = GRID.zs) {
  const out = [];
  let i = 0;
  for (const z of zs) for (const x of GRID.xs) out.push({ i: i++, cell: [x, FLOOR + 1, z], at: [x + 0.5, FLOOR + 2, z + 0.5] });
  return out;
}
// Every set: { pad (the gold start cells), stand (where Play! puts you), floor (cells of the floor to colour: [x, z, id]),
// up (blocks over the floor: [x, y, z, id]), ... } The floor's own block is PARTY_FLOOR and above it is air.
export function setsOf() {
  const R = PINATA.ring, rim = [], mid = [];
  for (let x = Math.floor(R.x - R.r); x <= Math.ceil(R.x + R.r); x++) for (let z = Math.floor(R.z - R.r); z <= Math.ceil(R.z + R.r); z++) {
    const d = Math.hypot(x + 0.5 - R.x, z + 0.5 - R.z);
    if (d <= R.r && d > R.r - 0.9) rim.push([x, z, WOOL.surprise]);
    else if (d <= 4.6 && d > 3.8) mid.push([x, z, WOOL.pixie]);
  }
  const pad = (x0, x1, z0, z1) => cellsIn(x0, x1, z0, z1).map(([x, z]) => [x, z, WOOL.treasure]);
  const centre = p => [(p[0][0] + p[p.length - 1][0] + 1) / 2, (p[0][1] + p[p.length - 1][1] + 1) / 2];
  const carpet = (z0, z1, skip) => cellsIn(52, 60, z0, z1).filter(([x, z]) => !skip.has(`${x},${z}`)).map(([x, z]) => [x, z, WOOL.surprise]);
  // Jack Catch: the boxes at the far side of a 9 x 9 carpet (the old Pop-Up Room's floor), the pad at its near side
  const cBoxes = boxesOf(GRID.zs), cSkip = new Set(cBoxes.map(b => `${b.cell[0]},${b.cell[2]}`));
  const cPad = pad(55, 57, 56, 57), cFloor = cellsIn(52, 60, 49, 57).filter(([x, z]) => !cSkip.has(`${x},${z}`)).map(([x, z]) => [x + 0.5, z + 0.5]);
  // Pop-Up Whack: the same nine boxes a little nearer, the pad in front
  const wBoxes = boxesOf([51, 53, 55]), wSkip = new Set(wBoxes.map(b => `${b.cell[0]},${b.cell[2]}`));
  // Gift Stack: the table (3 x 3, one high) with the box on it, the crane's post beside it
  const table = cellsIn(55, 57, 51, 53).map(([x, z]) => [x, FLOOR + 1, z, B.GIFT_WALL]);
  const sets = {
    pinata: { pad: pad(55, 57, 60, 61), floor: [...rim, ...mid], up: [], ring: { ...R } },
    catch: { pad: cPad, floor: carpet(49, 57, cSkip), up: cBoxes.map(b => [...b.cell, B.POP_BOX]), boxes: cBoxes, catchFloor: cFloor, start: centre(cPad), room: { x0: 52, x1: 60, z0: 49, z1: 57 } },
    stack: { pad: pad(55, 57, 59, 60), floor: cellsIn(53, 59, 49, 55).map(([x, z]) => [x, z, WOOL.surprise]), up: table, table: { x: 56.5, z: 52.5, y: FLOOR + 2 }, crane: { x: 61.5, z: 52.5 } },
    whack: { pad: pad(55, 57, 58, 59), floor: carpet(50, 56, wSkip), up: wBoxes.map(b => [...b.cell, B.POP_BOX]), boxes: wBoxes },
  };
  for (const id of GAMES) { const s = sets[id]; s.id = id; s.name = GAME_NAMES[id]; s.standAt = [...centre(s.pad), 0]; } // facing north (yaw 0 looks at -z)
  return sets;
}

/* ---------------------------------------- keys, bows, the old Room of Doors' bows ---------------------------------------- */

// bow i (1..4) = the golden bow of game i: 1 Piñata Party, 2 Jack Catch, 3 Gift Stack, 4 Pop-Up Whack (saved in `beaten` at once).
export const bowKey = i => `pw:doors:bow${i}`;
export const bowOf = game => GAMES.indexOf(game) + 1;
export const PARTY_MARK = 'pw:doors:party';   // in `beaten`: the bow keys mean the party's games (written the first time you visit the party)
export function bowState(game) {
  const bows = [1, 2, 3, 4].map(i => (game.beaten || []).includes(bowKey(i)));
  const n = bows.filter(Boolean).length;
  return { bows, n, need: 4, done: n >= 4 };
}
// The old Room of Doors gave bow1..3 for its three piñatas and bow4 for Jack Catch. A save from then keeps the same NUMBER of bows: they
// go to the games in the order Piñata Party, Jack Catch, Gift Stack, Pop-Up Whack, except that a won Jack Catch (old bow4) stays Jack
// Catch. Pure: (the bow numbers of an old save) -> the bow numbers in the party's meaning.
export function partyBows(old) {
  const had = new Set(old), n = [1, 2, 3, 4].filter(i => had.has(i)).length;
  const order = had.has(4) ? [2, 1, 3, 4] : [1, 2, 3, 4];
  return order.slice(0, n).sort((a, b) => a - b);
}
// The `beaten` list after the first visit to the party: old bows moved over (see partyBows) and the mark written. Pure.
// -> { beaten, changed }. A list that has the mark already is returned as it is.
export function migrateBows(beaten = []) {
  if (beaten.includes(PARTY_MARK)) return { beaten, changed: false };
  const old = [1, 2, 3, 4].filter(i => beaten.includes(bowKey(i)));
  const rest = beaten.filter(k => ![1, 2, 3, 4].some(i => k === bowKey(i)));
  return { beaten: [...rest, ...partyBows(old).map(bowKey), PARTY_MARK], changed: true };
}

/* ---------------------------------------- the terrain ---------------------------------------- */

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };

export function partyLand(world, def) {
  kit(world);
  const P = (x, y, z, id) => put(world, x, y, z, id);
  // a soft cloud outside the present, the party floor inside
  flatLand(world, { y: FLOOR, top: B.SWIRL_CLOUD, under: B.STONE, deep: B.STONE });
  for (let x = ROOM.x0; x <= ROOM.x1; x++) for (let z = ROOM.z0; z <= ROOM.z1; z++) P(x, FLOOR, z, B.PARTY_FLOOR);
  // the walls: gift paper, a stripe at y 13 and a ribbon band round the top (y 20-21)
  for (let x = ROOM.x0 - 1; x <= ROOM.x1 + 1; x++) for (let z = ROOM.z0 - 1; z <= ROOM.z1 + 1; z++) {
    if (x >= ROOM.x0 && x <= ROOM.x1 && z >= ROOM.z0 && z <= ROOM.z1) continue;
    P(x, FLOOR, z, B.GIFT_WALL);
    for (let y = FLOOR + 1; y <= WALL_TOP; y++) P(x, y, z, y === 13 || y === 20 || y === 21 ? WOOL.surprise : B.GIFT_WALL);
  }
  // the party floor's edge (a rim of wool in the floor, nothing to trip over)
  for (let x = SQUARE.x0; x <= SQUARE.x1; x++) for (const z of [SQUARE.z0, SQUARE.z1]) P(x, FLOOR, z, WOOL.pixie);
  for (let z = SQUARE.z0; z <= SQUARE.z1; z++) for (const x of [SQUARE.x0, SQUARE.x1]) P(x, FLOOR, z, WOOL.pixie);
  // the spinner's pad
  for (let x = SPINNER.pad.x0; x <= SPINNER.pad.x1; x++) for (let z = SPINNER.pad.z0; z <= SPINNER.pad.z1; z++) P(x, FLOOR, z, WOOL.treasure);
  // the long party table: a white cloth on legs (cups and plates are models, partyprops.js)
  for (let x = TABLE.x0; x <= TABLE.x1; x++) for (let z = TABLE.z0; z <= TABLE.z1; z++) {
    P(x, TABLE.y, z, WOOL.normal);
    if ((x === TABLE.x0 || x === TABLE.x1) && (z - TABLE.z0) % 4 === 0) P(x, TABLE.y - 1, z, B.PLANKS);
  }
  for (const x of [TABLE.x0, TABLE.x1]) P(x, TABLE.y - 1, TABLE.z1, B.PLANKS);
  // piles of presents in the corners: 3 high in the corner, 2 next to it, 1 round that
  PILES.forEach(([cx, cz, sx, sz], k) => {
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const h = 3 - Math.max(a, b);
      if (h <= 0) continue;
      for (let y = 0; y < h; y++) P(cx + sx * a, FLOOR + 1 + y, cz + sz * b, (a + b + y + k) % 5 === 0 ? B.GOLD_PRESENT : (a * 3 + b + y + k) % 3 === 1 ? PRESENT_COLOURS[(a + 2 * b + y + k) % PRESENT_COLOURS.length] : B.PRESENT);
    }
  });
  // the birthday cake on its plate
  for (let dx = -CAKE.plate; dx <= CAKE.plate; dx++) for (let dz = -CAKE.plate; dz <= CAKE.plate; dz++) P(CAKE.x + dx, FLOOR, CAKE.z + dz, WOOL.normal);
  for (const t of CAKE.tiers) for (let dx = -t.r; dx <= t.r; dx++) for (let dz = -t.r; dz <= t.r; dz++) for (let y = t.y0; y <= t.y1; y++) P(CAKE.x + dx, y, CAKE.z + dz, B.CAKE);
  for (const [dx, dz] of CAKE.candles) P(CAKE.x + dx, CAKE.candleY, CAKE.z + dz, WOOL.water); // the candles (their flames are lit with setLive)
  const boss = placeBoss(world, 'doors', { x: CAKE.x, y: CAKE.stand, z: CAKE.z, facing: [0, 1] }); // Jolly Jax pops out of the top of the cake
  // a lost battle rests you by the table, not on the cake
  world.rests.splice(world.rests.indexOf(boss.rest), 1);
  boss.rest = [...REST];
  world.rests.push([...REST]);
  // the way back: an upright frame by the south wall
  const door = buildWayBack(world, 'doors', { x: FRAME.x, y: FLOOR, z: FRAME.z, facing: [0, -1] });
  world.rests.splice(world.rests.indexOf(door.stand), 1); // (the only rest spot is the one by the table)
  // the party crashers wait outside the room until they crash the party (partylive.js moves them in)
  for (const c of CRASHERS) placeCrew(world, 'doors', c.i, { x: c.x, y: FLOOR, z: c.z, facing: [0, -1] });
  // the guests
  world.people = GUESTS.map(g => ({ name: g.name, title: `${g.name} · Surprise Party`, colors: g.colors, look: 'party', line: g.line, pos: [...g.at], heading: g.yaw, party: true }));
  // nooks: wild gift boxes sit by the walls and behind the table
  const nooks = [];
  for (const x of [38, 44, 66]) nooks.push({ kind: 'party', x, y: FLOOR + 1, z: ROOM.z1 }, { kind: 'party', x, y: FLOOR + 1, z: ROOM.z0 });
  for (const z of [36, 44, 62, 70]) nooks.push({ kind: 'party', x: ROOM.x1, y: FLOOR + 1, z });
  for (const z of [44, 58]) nooks.push({ kind: 'party', x: ROOM.x0, y: FLOOR + 1, z });
  world.nooks = nooks;
  // keeps: nobody builds at a party (the room, the cake, the walls)
  world.keeps.push({ name: 'party', protect: [{ x0: ROOM.x0 - 1, x1: ROOM.x1 + 1, y0: FLOOR, y1: WALL_TOP + 8, z0: ROOM.z0 - 1, z1: ROOM.z1 + 1 }], wallText: "It's a party! Play the games instead of building." });
  for (let x = 0; x < world.W; x++) for (let z = 0; z < world.D; z++) world.ground[x + z * world.W] = FLOOR;
  world.parts.push({ id: 'doors', live: 'doors', sets: setsOf(), spinner: SPINNER, cake: CAKE, square: SQUARE, crashers: CRASHERS, guests: GUESTS, room: ROOM });
  return world;
}

/* ---------------------------------------- the guide ---------------------------------------- */

const inSquare = p => p.x >= SQUARE.x0 && p.x < SQUARE.x1 + 1 && p.z >= SQUARE.z0 && p.z < SQUARE.z1 + 1;
// (world, p, game) => { x, z, text(arrow, metres) } | null: the game on the party floor, a party crasher, the Spinner, the cake, then the
// Picture World's own (the way back).
export function partyAim(world, p, game) {
  if (!world.parts?.some(q => q.id === 'doors')) return null;
  const live = game.gymLive?.of?.('part:doors'), bows = bowState(game), stars = game.stars || [];
  const g = live?.gm;
  if (g) {
    const s = setsOf()[g.game], at = s.standAt;
    if (inSquare(p)) return { x: at[0], z: at[1], text: () => `🎉 ${GAME_NAMES[g.game]} · round ${g.round} / 3` };
    return { x: at[0], z: at[1], text: (a, m) => `🎉 ${GAME_NAMES[g.game]} ${a} ${m}m` };
  }
  const crasher = live?.crasherHere?.();
  if (crasher) return { x: crasher.pos.x, z: crasher.pos.z, text: (a, m) => `⚔️ Party crasher ${crasher.name} ${a} ${m}m` };
  if (!bows.done) return { x: SPINNER.stand[0], z: SPINNER.stand[2], text: (a, m) => `🎡 Party Spinner ${a} ${m}m (🎀 ${bows.n} / 4)` };
  if (!stars.includes('doors')) return { x: CAKE.x + 0.5, z: CAKE.z + 5.5, text: (a, m) => `🎂 Jolly Jax on the cake ${a} ${m}m` };
  return pictureAim(world, p, { stars, via: 'doors' });
}
