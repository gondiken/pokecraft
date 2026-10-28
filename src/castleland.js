// T49: the Castle (realm `castle`, plans/T49-castle.md), a Picture World behind the Swirl's peach frame (the old `secret3`). Terrain as
// data, Node-runnable (needs only a world with W / D / data / ground / index / inBounds / get, like doodleland.js): a meadow with the Shield
// Stones and twelve practice towers, a moat, the castle walls with a gatehouse and the drawbridge (drawn per player / per world with
// setLive: air in the world data), a courtyard, a garden, the hedge maze (the only way into the Tilt Yard), the Tilt Yard with its two
// lanes, and the keep with the throne room behind a portcullis (setLive too). The challenges' rules are pure: siege.js (Shield Up!) and
// joust.js (the Joust); castlelive.js wires them.
import { B, WOOL } from './blocks.js';
import { kit, buildWayBack, placeBoss, placeCrew, pictureAim } from './picturelands.js';
import { SIEGE, SIEGE_ROUNDS, spotPos, towerCell } from './siege.js';
import { JOUST_ROUNDS } from './joust.js';
import { MAZE, mazeCells, inMaze, mazeOf, mazeExtras } from './hedgemaze.js';

export const SIZE = 160;
export const G = 10; // the ground's top block; people stand at y 11
export const CASTLE = { x0: 32, x1: 128, z0: 20, z1: 104, top: 25 };             // the walls' outer faces (2 thick), y 11..25
export const MOAT = { x0: 27, x1: 133, z0: 15, z1: 109 };                       // water y 8..9 round the walls
export const TOWERS = [[32, 20], [120, 20], [32, 96], [120, 96]];              // 9 x 9 corner towers (their low corner), y 11..29
export const GATEHOUSE = { x0: 72, x1: 88, z0: 98, z1: 104, top: 22, tunnel: { x0: 78, x1: 82, y0: 11, y1: 15 } };
export const BRIDGE = { x0: 78, x1: 82, y: 10, z0: 105, z1: 109, gate: { x0: 78, x1: 82, y0: 11, y1: 15, z: 104 }, hinge: [80.5, 10.5, 104.5] };
export const STAIRS = { x0: 89, x1: 100, z0: 101, z1: 102 };                    // up the inside of the south wall to the gatehouse roof (x 100: y 11 .. x 89: y 22)
export const COURTYARD = { x0: 61, x1: 101, z0: 53, z1: 102 };
export const GARDEN = { x0: 34, x1: 60, z0: 51, z1: 102 };
export const KEEP = { x0: 44, x1: 60, z0: 22, z1: 50, floor2: 18, roof: 28, door: { x0: 50, x1: 54, y0: 11, y1: 15, z: 50 }, stair: { x0: 45, x1: 47, z: 48 }, throne: [51, 53, 23, 25] };
export const YARD = { x0: 61, x1: 126, z0: 22, z1: 50, sand: [62, 117, 26, 46] };
export const HEDGE_ROW = { x0: 61, x1: 101, z0: 51, z1: 52 };                   // between the courtyard and the Tilt Yard (3 high)
export const SQUIRE_GATE = { x0: 63, x1: 64, y0: 11, y1: 13, z0: 51, z1: 52 }; // opens from the Tilt Yard's side (and for good with the lance won)
// The Tilt Yard's lanes along x: yours (centre z 32.5) and the practice knight's (z 40.5), the tilt barrier between (z 36).
export const TILT = { x0: 64.5, x1: 116.5, z: 32.5, knightZ: 38.5, barrier: { x0: 66, x1: 116, z: 36 }, pads: [[63, 65, 31, 33], [115, 117, 31, 33]], len: 52 };
export const FIELD = { x0: 58, x1: 103, z0: 110, z1: 150 };                     // the practice field (a keep)
export const ARRIVAL = { x: 80, z: 156 };                                       // the way back frame (you arrive 3 in front of it, looking north)
export const HERALD = { name: 'Herald Hugo', x: 84, z: 151, facing: [0, -1], colors: { shirt: 0x3a5ad8, pants: 0xf0c84a, hair: 0x8a5a2a, skin: 0xf2d0b0 }, look: 'squire' };

// The saved keys (in `beaten`): a round won of each challenge, and what is drawn from them.
export const shieldKey = n => `pw:castle:shield${n}`;
export const lanceKey = n => `pw:castle:lance${n}`;
export const CASTLE_NEED = SIEGE_ROUNDS + JOUST_ROUNDS;
// -> { shield, lance, n, need, done, bridge (the drawbridge is down for you), gate (the portcullis is up for you) }. Own keys or the star;
// the live part adds what friends opened (the shared gate state, castlelive.js).
export function castleState(game) {
  const has = k => !!game?.beaten?.includes(k);
  let shield = 0, lance = 0;
  while (shield < SIEGE_ROUNDS && has(shieldKey(shield + 1))) shield++;
  while (lance < JOUST_ROUNDS && has(lanceKey(lance + 1))) lance++;
  const star = !!game?.stars?.includes('castle');
  return { shield, lance, n: shield + lance, need: CASTLE_NEED, done: shield >= SIEGE_ROUNDS && lance >= JOUST_ROUNDS, bridge: shield >= SIEGE_ROUNDS || star, gate: lance >= JOUST_ROUNDS || star, star };
}

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
const fill = (world, x0, x1, y0, y1, z0, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(world, x, y, z, id); };
const box = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

// The cells the live part draws with setLive: the drawbridge's deck (down) and the raised drawbridge in the gate (up), the portcullis, the squire gate.
export function liveCells() {
  const deck = [], raised = [], port = [], squire = [];
  for (let x = BRIDGE.x0; x <= BRIDGE.x1; x++) for (let z = BRIDGE.z0; z <= BRIDGE.z1; z++) deck.push([x, BRIDGE.y, z]);
  for (let x = BRIDGE.gate.x0; x <= BRIDGE.gate.x1; x++) for (let y = BRIDGE.gate.y0; y <= BRIDGE.gate.y1; y++) raised.push([x, y, BRIDGE.gate.z]);
  const d = KEEP.door;
  for (let x = d.x0; x <= d.x1; x++) for (let y = d.y0; y <= d.y1; y++) port.push([x, y, d.z]);
  for (let x = SQUIRE_GATE.x0; x <= SQUIRE_GATE.x1; x++) for (let y = SQUIRE_GATE.y0; y <= SQUIRE_GATE.y1; y++) for (let z = SQUIRE_GATE.z0; z <= SQUIRE_GATE.z1; z++) squire.push([x, y, z]);
  return { deck, raised, port, squire };
}

// Where the guide points (TERRAIN_AIMS.castleLand; the live part's aim runs first and asks this). Gentle in the maze: words only, then a
// tip, then an arrow to the way out as the crow flies (never a path through it).
export function castleAim(world, p, game) {
  const st = castleState(game), live = game?.gymLive?.of?.('part:castle'), shared = live?.shared?.() ?? { bridge: false, port: false };
  const bridge = st.bridge || shared.bridge, port = st.gate || shared.port;
  const inside = inR({ x0: CASTLE.x0, x1: CASTLE.x1, z0: CASTLE.z0, z1: CASTLE.z1 }, p.x, p.z);
  if (inMaze(p.x, p.z) && st.lance < JOUST_ROUNDS) {
    const t = live?.mazeTime ?? 0, ex = MAZE.x0 + MAZE.exit.i * MAZE.pitch + 2.5, ez = MAZE.z0 - 1;
    if (t >= MAZE.compassAfter) return { x: ex, z: ez, text: (a, m) => `🌿 The way out is that way ${a} ${m}m` };
    if (t >= MAZE.hintAfter) return { text: () => '🌿 Tip: keep one hand on the hedge and follow it!' };
    return { text: () => '🌿 The hedge maze! Find the way out to the Tilt Yard.' };
  }
  if (st.shield < SIEGE_ROUNDS && !bridge) {
    const s = SIEGE.stones[0];
    return { x: s[0], z: s[2], text: (a, m) => `🛡️ Shield Stone: block the pumpkins ${a} ${m}m` };
  }
  if (st.lance < JOUST_ROUNDS) {
    if (!inside) return { x: 80.5, z: 100.5, text: (a, m) => `🏰 Over the drawbridge ${a} ${m}m` };
    if (p.z > YARD.z1 + 2 && !inMaze(p.x, p.z)) return { x: MAZE.x0 - 0.5, z: MAZE.z0 + MAZE.entrance.j * MAZE.pitch + 2.5, text: (a, m) => `🌿 The hedge maze leads to the Tilt Yard ${a} ${m}m` };
    const pad = TILT.pads[0];
    return { x: (pad[0] + pad[1]) / 2 + 0.5, z: (pad[2] + pad[3]) / 2 + 0.5, text: (a, m) => `🐴 Tilt Yard: joust! ${a} ${m}m` };
  }
  if (st.shield < SIEGE_ROUNDS) { const s = SIEGE.stones[0]; return { x: s[0], z: s[2], text: (a, m) => `🛡️ Shield Up! is not won yet ${a} ${m}m` }; }
  if (!port) return null;
  if (game?.stars?.includes('castle')) return null; // the base: the way back
  if (!inside) return { x: 80.5, z: 100.5, text: (a, m) => `🏰 Into the castle ${a} ${m}m` };
  return null; // the base: the crew, then the Boss in the throne room
}

export function castleLand(world, def) {
  kit(world);
  const { W, D } = world;
  // 1. the meadow
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    for (let y = 0; y <= G; y++) put(world, x, y, z, y === G ? B.GRASS : y >= G - 3 ? B.DIRT : B.STONE);
    world.ground[x + z * W] = G;
  }
  const keeps = [], keep = (name, b, wallText, extra = {}) => keeps.push({ name, protect: [b], wallText, ...extra });
  // 2. the moat (round the walls)
  for (let x = MOAT.x0; x <= MOAT.x1; x++) for (let z = MOAT.z0; z <= MOAT.z1; z++) {
    if (x >= CASTLE.x0 && x <= CASTLE.x1 && z >= CASTLE.z0 && z <= CASTLE.z1) continue;
    put(world, x, G, z, B.AIR); put(world, x, G - 1, z, B.WATER); put(world, x, G - 2, z, B.WATER); put(world, x, G - 3, z, B.STONE);
    world.ground[x + z * W] = G - 1;
  }
  // 3. the walls (2 thick, y 11..25) with crenels on the outer edge, the corner towers with wool roofs
  for (let x = CASTLE.x0; x <= CASTLE.x1; x++) for (let z = CASTLE.z0; z <= CASTLE.z1; z++) {
    const edge = Math.min(x - CASTLE.x0, CASTLE.x1 - x, z - CASTLE.z0, CASTLE.z1 - z);
    if (edge > 1) continue;
    fill(world, x, x, G + 1, CASTLE.top, z, z, B.STONE_BRICKS);
    put(world, x, G, z, B.STONE_BRICKS);
    if (edge === 0 && (x + z) % 2 === 0) put(world, x, CASTLE.top + 1, z, B.STONE_BRICKS);
  }
  for (const [tx, tz] of TOWERS) {
    fill(world, tx, tx + 8, G, 29, tz, tz + 8, B.STONE_BRICKS);
    for (let x = tx; x <= tx + 8; x++) for (let z = tz; z <= tz + 8; z++) if ((x === tx || x === tx + 8 || z === tz || z === tz + 8) && (x + z) % 2 === 0) put(world, x, 30, z, B.STONE_BRICKS);
    for (let k = 0; k < 4; k++) fill(world, tx + 1 + k, tx + 7 - k, 31 + k, 31 + k, tz + 1 + k, tz + 7 - k, WOOL.knight); // the roof
    keep('tower', box(tx, tx + 8, G, 40, tz, tz + 8), 'A castle tower. Knights do not knock down towers!');
  }
  // 4. the gatehouse (solid, a tunnel through it), its roof walkway with crenels to the meadow; the stairs up to it
  const GH = GATEHOUSE;
  fill(world, GH.x0, GH.x1, G, GH.top, GH.z0, GH.z1, B.STONE_BRICKS);
  fill(world, GH.tunnel.x0, GH.tunnel.x1, GH.tunnel.y0, GH.tunnel.y1, GH.z0, GH.z1, B.AIR);
  for (let x = GH.x0; x <= GH.x1; x++) if (x % 2 === 0) put(world, x, GH.top + 1, GH.z1, B.STONE_BRICKS);
  for (let i = 0; i <= STAIRS.x1 - STAIRS.x0; i++) { const x = STAIRS.x1 - i; fill(world, x, x, G + 1, G + 1 + i, STAIRS.z0, STAIRS.z1, B.STONE_BRICKS); }
  // 5. the courtyard (gravel), a well, three stall canopies, banners on the walls
  for (let x = COURTYARD.x0; x <= COURTYARD.x1; x++) for (let z = COURTYARD.z0; z <= COURTYARD.z1; z++) if (world.get(x, G + 1, z) === B.AIR) put(world, x, G, z, B.GRAVEL);
  for (let x = 66; x <= 70; x++) for (let z = 88; z <= 92; z++) { const ring = x === 66 || x === 70 || z === 88 || z === 92; put(world, x, G + 1, z, ring ? B.COBBLE : B.AIR); if (!ring) put(world, x, G, z, B.WATER); }
  for (const [x0, c] of [[74, WOOL.fire], [82, WOOL.water], [90, WOOL.light]]) { // stalls: four posts and a striped canopy
    for (const [dx, dz] of [[0, 0], [3, 0], [0, 2], [3, 2]]) fill(world, x0 + dx, x0 + dx, G + 1, G + 2, 58 + dz, 58 + dz, B.PLANKS);
    for (let x = x0; x <= x0 + 3; x++) for (let z = 58; z <= 60; z++) put(world, x, G + 3, z, (x + z) % 2 ? c : WOOL.paper);
  }
  for (const x of [64, 70, 106, 114]) fill(world, x, x, 18, 22, CASTLE.z1 - 2, CASTLE.z1 - 2, WOOL.knight); // banners on the inner face of the south wall
  // 6. the garden: flower beds and three topiary knights (hedge), benches
  for (let x = GARDEN.x0; x <= GARDEN.x1; x++) for (let z = GARDEN.z0; z <= GARDEN.z1; z++) if (world.get(x, G + 1, z) === B.AIR && (x * 7 + z * 3) % 13 === 0) put(world, x, G + 1, z, B.FLOWER_BUSH);
  for (const [x, z] of [[40, 64], [52, 76], [40, 90]]) { // a topiary knight on a horse: a body, a head, a lance
    fill(world, x - 1, x + 1, G + 1, G + 2, z - 2, z + 2, B.HEDGE); fill(world, x, x, G + 3, G + 4, z - 1, z - 1, B.HEDGE); fill(world, x, x, G + 3, G + 3, z + 1, z + 3, B.HEDGE);
    keep('topiary', box(x - 1, x + 1, G + 1, G + 4, z - 2, z + 3), 'A hedge knight! The gardener spent all summer on it.');
  }
  for (const [x, z] of [[46, 58], [56, 96]]) { put(world, x, G + 1, z, B.PLANKS); put(world, x + 1, G + 1, z, B.PLANKS); }
  // 7. the keep: walls y 11..27, a Great Hall, a wide stair to the throne room (y 18), the throne, a roof with crenels
  const K = KEEP;
  for (let x = K.x0; x <= K.x1; x++) for (let z = K.z0; z <= K.z1; z++) {
    const wall = x === K.x0 || x === K.x1 || z === K.z0 || z === K.z1;
    put(world, x, G, z, B.STONE_BRICKS);
    if (wall) { fill(world, x, x, G + 1, K.roof - 1, z, z, B.STONE_BRICKS); if ((x + z) % 2 === 0) put(world, x, K.roof + 1, z, B.STONE_BRICKS); }
    put(world, x, K.roof, z, B.STONE_BRICKS);
    if (!wall && !(x >= K.stair.x0 && x <= K.stair.x1 && z >= K.stair.z - 6 && z <= K.z1 - 1)) put(world, x, K.floor2, z, B.PLANKS);
  }
  for (let i = 0; i <= 7; i++) fill(world, K.stair.x0, K.stair.x1, G + 1, G + 1 + i, K.stair.z - i, K.stair.z - i, B.STONE_BRICKS); // 8 steps up to y 18
  fill(world, K.door.x0, K.door.x1, K.door.y0, K.door.y1, K.door.z, K.door.z, B.AIR); // the doorway (the portcullis is setLive)
  for (let x = K.x0 + 2; x < K.x1; x += 4) for (const z of [K.z0, K.z1]) if (!(z === K.z1 && x >= K.door.x0 - 1 && x <= K.door.x1 + 1)) fill(world, x, x, 21, 23, z, z, B.GLASS);
  for (let z = K.z0 + 3; z < K.z1; z += 4) for (const x of [K.x0, K.x1]) fill(world, x, x, 21, 23, z, z, B.GLASS);
  const [tx0, tx1, tz0, tz1] = K.throne;
  fill(world, tx0, tx1, K.floor2 + 1, K.floor2 + 1, tz0, tz1, WOOL.treasure);          // the seat
  fill(world, tx0, tx1, K.floor2 + 2, K.floor2 + 4, tz0, tz0, WOOL.treasure);          // its back
  put(world, tx0, K.floor2 + 2, tz1, WOOL.knight); put(world, tx1, K.floor2 + 2, tz1, WOOL.knight); // the arms
  for (let z = tz1 + 2; z <= K.z1 - 3; z++) for (let x = tx0; x <= tx1; x++) if (world.get(x, K.floor2, z) === B.PLANKS) put(world, x, K.floor2, z, WOOL.fire); // a red carpet
  keep('throne', box(tx0, tx1, K.floor2, K.floor2 + 4, tz0, tz1), 'The empty throne. It waits for the Wizard.');
  // 8. the hedge row between the courtyard and the Tilt Yard, the hedge maze
  fill(world, HEDGE_ROW.x0, HEDGE_ROW.x1, G + 1, G + MAZE.height, HEDGE_ROW.z0, HEDGE_ROW.z1, B.HEDGE);
  const mc = mazeCells();
  for (let x = mc.box.x0; x <= mc.box.x1; x++) for (let z = mc.box.z0; z <= mc.box.z1; z++) if (world.get(x, G + 1, z) === B.AIR) put(world, x, G, z, B.GRASS);
  for (const [x, z] of mc.hedge) if (world.get(x, G + 1, z) === B.AIR) fill(world, x, x, G + 1, G + MAZE.height, z, z, B.HEDGE);
  // owner 2026-10-28: archways over some gaps (hedge on top, a rose bush in the middle), the fountain in the middle clearing (a low
  // cobble spout in a sunken pool: never high enough to climb onto the hedges from), Gardener Gwen beside it
  for (const row of mc.arches) { for (const [x, z] of row) put(world, x, G + MAZE.height, z, B.HEDGE); const [mx, mz] = row[1]; put(world, mx, G + MAZE.height + 1, mz, B.FLOWER_BUSH); }
  const mx = mazeExtras(), F = mx.fountain;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(world, F.x + dx, G, F.z + dz, dx || dz ? B.WATER : B.COBBLE);
  put(world, F.x, G + 1, F.z, B.COBBLE); // the spout (its spray is drawn by the live part)
  // 9. the Tilt Yard: sand, the tilt barrier, the start pads, bleachers
  const [sx0, sx1, sz0, sz1] = YARD.sand;
  for (let x = sx0; x <= sx1; x++) for (let z = sz0; z <= sz1; z++) if (world.get(x, G + 1, z) === B.AIR) put(world, x, G, z, B.SAND);
  for (let x = TILT.barrier.x0; x <= TILT.barrier.x1; x++) put(world, x, G + 1, TILT.barrier.z, (x >> 1) % 2 ? WOOL.fire : WOOL.paper);
  for (const [x0, x1, z0, z1] of TILT.pads) fill(world, x0, x1, G, G, z0, z1, WOOL.knight);
  for (let x = 72; x <= 110; x++) for (let k = 0; k < 3; k++) { fill(world, x, x, G + 1, G + 1 + k, 44 + k, 44 + k, B.PLANKS); if (x % 3 === 0) put(world, x, G + 2 + k, 44 + k, WOOL.knight); }
  keep('yard', box(YARD.x0, YARD.x1, G, 47, YARD.z0, YARD.z1), 'The Tilt Yard is for jousting. No building here!');
  // 10. the practice field: two Shield Stones (cobble crosses), twelve practice towers (spot 0 is the gatehouse roof)
  for (const [x, , z] of SIEGE.stones) { const cx = Math.floor(x), cz = Math.floor(z); for (let d = -2; d <= 2; d++) { put(world, cx + d, G, cz, B.COBBLE); put(world, cx, G, cz + d, B.COBBLE); } }
  const towers = [];
  for (let k = 1; k < 12; k++) { const [cx, cz] = towerCell(k); fill(world, cx - 1, cx + 1, G + 1, G + 3, cz - 1, cz + 1, B.PLANKS); towers.push({ k, cell: [cx, cz], launch: spotPos(k) }); }
  // 11. meadow decor: a few trees and flowers outside the keeps
  const tree = (x, z) => { for (let k = 1; k <= 4; k++) put(world, x, G + k, z, B.LOG); for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 3; dy <= 5; dy++) if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 4) <= 3 && !(dx === 0 && dz === 0 && dy < 5)) put(world, x + dx, G + dy, z + dz, B.LEAVES); };
  for (const [x, z] of [[14, 130], [22, 146], [140, 128], [148, 146], [12, 60], [148, 64], [40, 140], [122, 142], [10, 18], [150, 20]]) tree(x, z);
  for (let x = 4; x < W - 4; x++) for (let z = 112; z < D - 4; z++) if (!inR(FIELD, x, z) && world.get(x, G + 1, z) === B.AIR && world.get(x, G, z) === B.GRASS && (x * 11 + z * 5) % 23 === 0) put(world, x, G + 1, z, B.FLOWER_BUSH);
  // 12. keeps (riders are fenced out of the castle: no rideIn)
  keep('castle', box(MOAT.x0 - 1, MOAT.x1 + 1, 0, 47, MOAT.z0 - 1, MOAT.z1), 'This is the Castle! Knights do not knock down walls.', { rideText: 'Hop off! Inside the castle you ride the castle horse.' });
  keep('field', box(FIELD.x0, FIELD.x1, 0, 47, FIELD.z0, FIELD.z1), 'This is the practice field. No building here, or the pumpkins could not reach you!');
  // 13. the way back, the Boss, the crew, the herald
  buildWayBack(world, 'castle', { x: ARRIVAL.x, y: G, z: ARRIVAL.z, facing: [0, -1] });
  placeBoss(world, 'castle', { x: 52, y: KEEP.floor2, z: 28, facing: [0, 1] });
  placeCrew(world, 'castle', 0, { x: 63, y: G, z: 25, facing: [1, 1] });           // Squire Pip in the Tilt Yard's corner (away from the pad: the big button there says Mount!)
  placeCrew(world, 'castle', 1, { x: 85, y: GH.top, z: 101, facing: [0, -1] });    // Archer Wren on the gatehouse roof
  world.people ??= [];
  world.people.push({ name: mx.gardener.name, title: `${mx.gardener.name} · Castle`, colors: mx.gardener.colors, line: mx.gardener.line, pos: [mx.gardener.x + 0.5, G + 1, mx.gardener.z + 0.5], heading: Math.atan2(F.x - mx.gardener.x - 0.5, F.z - mx.gardener.z - 0.5) });
  world.people.push({ name: HERALD.name, title: `${HERALD.name} · Castle`, colors: HERALD.colors, look: HERALD.look, line: 'Block the pumpkins on the Shield Stone and the drawbridge comes down!', pos: [HERALD.x + 0.5, G + 1, HERALD.z + 0.5], heading: Math.atan2(HERALD.facing[0], HERALD.facing[1]) });
  // 14. nooks (where the wild Knights stand guard), rests, the part
  const nooks = [];
  for (const [x, z] of [[38, 56], [46, 70], [56, 84], [38, 100], [50, 98], [58, 62], [36, 80], [48, 88], // the garden
    [64, 56], [98, 56], [64, 98], [96, 70], // the courtyard
    [20, 120], [140, 118], [30, 150], [130, 152], [10, 100], [150, 96]]) if (world.get(x, G + 1, z) === B.AIR && world.get(x, G + 2, z) === B.AIR) nooks.push({ kind: 'post', x, y: G + 1, z });
  world.nooks = nooks;
  for (const r of [[80.5, G + 1, 138.5, Math.PI], [80.5, G + 1, 94.5, Math.PI], [66.5, G + 1, 30.5, 0]]) world.rests.push(r);
  for (const k of keeps) world.keeps.push(k);
  world.castle = { castle: CASTLE, moat: MOAT, gatehouse: GH, bridge: BRIDGE, keep: KEEP, yard: YARD, tilt: TILT, maze: mc, mazeData: mazeOf(), mazeExtras: mx, field: FIELD, towers, stones: SIEGE.stones, live: liveCells(), squireGate: SQUIRE_GATE, stairs: STAIRS };
  world.realmBiome = (x, z) => (x >= CASTLE.x0 && x <= CASTLE.x1 && z >= CASTLE.z0 && z <= CASTLE.z1 ? 'castle' : 'castleMeadow');
  world.parts.push({ id: 'castle', live: 'castle', area: box(0, W - 1, 0, 47, 0, D - 1) });
}

export { pictureAim };
