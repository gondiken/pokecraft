// T40b: Captain Squawk's ship in the Pirate Seas, as data (SHIP) and one builder (buildShip). Bow west, stern east, anchored.
// It only needs a world with W / D / data / index / inBounds / get (the spec runs it on a stand-in in Node, like dreamland.js)
// and imports only blocks.js and picturelands.js.
import { B, WOOL } from './blocks.js';
import { kit, placeBoss, placeCrew } from './picturelands.js';

export const SHIP = {
  x0: 92, x1: 132, z0: 42, z1: 54, zc: 48,            // the hull box (the deck is z 42..54)
  keel: 6, deck: 18,                                    // lowest hull block, the deck block row (you stand at 19)
  // half-width (cells either side of z 48) of the hull by block row: keel 6-8, 9-11, 12-14, 15-17, deck 18
  halves: [[6, 8, 2], [9, 11, 3], [12, 14, 4], [15, 17, 5], [18, 18, 6]],
  bow: 7,                                               // the bow (x 92..99) narrows from 3 wide at x 92
  fore: { x0: 92, x1: 99, top: 20, stepX: 100, stepTop: 19 },                              // the forecastle and its one step
  quarter: { x0: 124, x1: 132, top: 21, steps: [[121, 19], [122, 20], [123, 21]], z0: 47, z1: 49 }, // the quarterdeck and its three steps
  masts: [{ x: 102, top: 33 }, { x: 114, top: 36 }],   // sails one cell east of each mast, z 44..52
  sailZ: [44, 52], sailFrom: 22, nest: { x: 114, y: 32 },
  pole: { x: 132, top: 30 },                            // the flagpole; the flag hangs west of its top (3 x 2)
  boss: [127, 21, 48], wheel: [129, 22, 48], chest: [131, 22, 48], lamps: [[132, 22, 43], [132, 22, 53]],
  target: { x: 108, z: 48 },                            // the TARGET (3 x 3) in the main deck, the C2 cannon lands in its middle
  crew: [118, 18, 45],                                  // First Mate Fin
  ladders: [{ x: 104 }, { x: 118 }],                    // rope ladders: a 3 wide buttress on both sides, a lift column in the water beside it
  gaps: [[103, 105], [117, 119]],                       // no railing here (and at the gangplank)
  gang: { x0: 111, x1: 113, z0: 55, z1: 59, tops: [17, 16, 15, 14, 13] },
  dock: { x0: 108, z0: 60, z1: 61, y: 13, post: 6 },
  decor: [[108, 53, 1], [122, 53, 1], [108, 43, -1], [122, 43, -1]], // decor cannons: x, z, side (+1 south, -1 north)
};

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };

// The hull's z range at (x, y) as [z0, z1], or null outside the hull.
export function hullRange(x, y) {
  if (x < SHIP.x0 || x > SHIP.x1) return null;
  const row = SHIP.halves.find(([a, b]) => y >= a && y <= b);
  if (!row) return null;
  let half = row[2];
  if (x < SHIP.x0 + SHIP.bow) half = Math.min(half, 1 + Math.round(((x - SHIP.x0) * 5) / (SHIP.bow - 1)));
  return [SHIP.zc - half, SHIP.zc + half];
}
// The y of the walking surface block of the deck column (x, z), or null.
export function deckTop(x, z) {
  const r = hullRange(x, SHIP.deck);
  if (!r || z < r[0] || z > r[1]) return null;
  const q = SHIP.quarter, f = SHIP.fore;
  if (x >= q.x0 && x <= q.x1) return q.top;
  const st = z >= q.z0 && z <= q.z1 && q.steps.find(([sx]) => sx === x);
  if (st) return st[1];
  if (x >= f.x0 && x <= f.x1) return f.top;
  if (x === f.stepX) return f.stepTop;
  return SHIP.deck;
}

// Builds the ship into `world` and returns its data: { box, keeps, lifts, rails, ... }. Also places the Boss's stand,
// Fin's spot (crew 3), the TARGET, the chest and the wheel.
export function buildShip(world, S = SHIP) {
  kit(world);
  const lifts = [], keeps = [];
  // hull: the shell is HULL (a WOOL.pirate stripe at row 16), the inside is solid PLANKS (no hold: no dark pockets)
  for (let x = S.x0; x <= S.x1; x++) for (let y = S.keel; y <= S.deck; y++) {
    const r = hullRange(x, y);
    if (!r) continue;
    const below = hullRange(x, y - 1);
    for (let z = r[0]; z <= r[1]; z++) {
      const edge = z === r[0] || z === r[1] || x === S.x0 || x === S.x1 || y === S.keel || !below || z < below[0] || z > below[1];
      let id = edge ? B.HULL : B.PLANKS;
      if (y === S.deck) id = B.DECK;
      else if (edge && y === 16) id = WOOL.pirate;
      put(world, x, y, z, id);
    }
  }
  // raised decks and steps: PLANKS under a DECK top
  for (let x = S.x0; x <= S.x1; x++) {
    const r = hullRange(x, S.deck);
    for (let z = r[0]; z <= r[1]; z++) {
      const top = deckTop(x, z);
      if (top > S.deck) { for (let y = S.deck + 1; y < top; y++) put(world, x, y, z, B.PLANKS); put(world, x, top, z, B.DECK); }
    }
  }
  // railing: HULL one row above the walking surface along the edge of the deck, except at the ladders (both sides) and the gangplank (south)
  const inFoot = (x, z) => { const r = hullRange(x, S.deck); return !!r && z >= r[0] && z <= r[1]; };
  const rails = [];
  for (let x = S.x0; x <= S.x1; x++) {
    const r = hullRange(x, S.deck);
    for (let z = r[0]; z <= r[1]; z++) {
      if (inFoot(x - 1, z) && inFoot(x + 1, z) && inFoot(x, z - 1) && inFoot(x, z + 1)) continue; // not on the edge
      if (S.gaps.some(([a, b]) => x >= a && x <= b && (z === r[0] || z === r[1]))) continue;
      if (z === r[1] && x >= S.gang.x0 && x <= S.gang.x1) continue;
      put(world, x, deckTop(x, z) + 1, z, B.HULL);
      rails.push([x, deckTop(x, z) + 1, z]);
    }
  }
  // masts, sails (white with a pirate-stripe every third row), yards, the crow's nest
  for (const m of S.masts) {
    for (let y = S.deck + 1; y <= m.top; y++) put(world, m.x, y, S.zc, B.LOG);
    for (let z = S.sailZ[0]; z <= S.sailZ[1]; z++) {
      put(world, m.x, m.top, z, B.LOG); // the yard
      for (let y = S.sailFrom; y < m.top; y++) put(world, m.x + 1, y, z, y % 3 === 0 ? WOOL.pirate : WOOL.normal);
    }
  }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) put(world, S.nest.x + dx, S.nest.y, S.zc + dz, B.PLANKS);
  // the flagpole and flag, the quarterdeck lamps, the wheel and the chest
  for (let y = S.quarter.top + 1; y <= S.pole.top; y++) put(world, S.pole.x, y, S.zc, B.LOG);
  for (let x = S.pole.x - 3; x < S.pole.x; x++) for (let y = S.pole.top - 1; y <= S.pole.top; y++) put(world, x, y, S.zc, B.PIRATE_FLAG);
  for (const [x, y, z] of S.lamps) put(world, x, y, z, B.LAMP);
  put(world, S.wheel[0], S.wheel[1], S.wheel[2], B.SHIP_WHEEL);
  put(world, S.chest[0], S.chest[1], S.chest[2], B.BIG_CHEST);
  world.starChest = [...S.chest];
  // the target on the main deck
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(world, S.target.x + dx, S.deck, S.target.z + dz, B.TARGET);
  // rope ladders: a 3 wide buttress from the hull face out to one cell beyond the deck edge, ROPE_LADDER blocks on the outside, and a
  // lift column in the water beside it (Player.update lifts a swimmer there until the feet are level with the deck)
  for (const l of S.ladders) for (const side of [-1, 1]) {
    const edge = side > 0 ? S.z1 + 1 : S.z0 - 1; // the outer cell of the buttress (z 55 south, z 41 north)
    for (let x = l.x - 1; x <= l.x + 1; x++) for (let y = 13; y <= S.deck; y++) {
      const r = hullRange(x, y);
      if (!r) continue;
      for (let z = side > 0 ? r[1] + 1 : edge; z <= (side > 0 ? edge : r[0] - 1); z++) put(world, x, y, z, z === edge ? B.ROPE_LADDER : B.HULL);
    }
    lifts.push({ id: `ladder-${l.x}-${side > 0 ? 's' : 'n'}`, x: [l.x - 1, l.x + 1], z: [edge + side, edge + side], y: [12, S.deck] });
  }
  // the gangplank (steps down to the dock, one block a step) and the dock (a pier with posts)
  const g = S.gang;
  for (let i = 0; i < g.tops.length; i++) for (let x = g.x0; x <= g.x1; x++) {
    const z = g.z0 + i;
    for (let y = 9; y < g.tops[i]; y++) put(world, x, y, z, B.PLANKS);
    put(world, x, g.tops[i], z, B.DECK);
  }
  keeps.push({ name: 'ship', protect: [{ x0: S.x0, x1: S.x1, y0: 0, y1: 47, z0: S.z0 - 2, z1: S.z1 + 2 }, { x0: g.x0, x1: g.x1, y0: 0, y1: 47, z0: g.z0, z1: g.z1 }],
    wallText: "Captain Squawk's ship is too strong to change!", rideText: 'Get off your creature to climb aboard!' });
  // the Boss on the quarterdeck, looking west down the ship; First Mate Fin on the main deck
  const boss = placeBoss(world, 'pirate', { x: S.boss[0], y: S.boss[1], z: S.boss[2], facing: [-1, 0] });
  placeCrew(world, 'pirate', 2, { x: S.crew[0], y: S.crew[1], z: S.crew[2], facing: [0, 1] });
  world.lifts = [...(world.lifts || []), ...lifts];
  world.keeps.push(...keeps);
  return { box: { x0: S.x0, x1: S.x1, z0: S.z0, z1: S.z1 }, lifts, rails, boss };
}

// The dock: planks at y 13 from x0 east along z0..z1 until the land (the first column where both rows have a surface of 13 or more),
// with log posts to the floor every `post` cells. `surf(x, z)` is the column's top block. Returns the x it stopped at.
export function buildDock(world, surf, D = SHIP.dock) {
  let x = D.x0;
  for (; x < world.W - 2; x++) {
    const rows = [];
    for (let z = D.z0; z <= D.z1; z++) rows.push(surf(x, z) >= D.y);
    if (rows.every(Boolean)) break;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]) continue;
      const z = D.z0 + i;
      put(world, x, D.y, z, B.PLANKS);
      if ((x - D.x0) % D.post === 0) for (let y = surf(x, z) + 1; y < D.y; y++) put(world, x, y, z, B.LOG);
    }
  }
  return x;
}
