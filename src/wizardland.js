// Wave 19 (plans/wave19-wizard-tower.md section 5), stage B: the Wizard's Tower as terrain data (realm `wizard`, 48 x 48, parent `swirl`).
// Node-runnable (needs only a world with W / D / data / ground / index / inBounds / get, like castleland.js; the spec runs it on a stand-in).
// A soft cloud floor at y 0 and one round-cornered tower of five painting rooms stacked up: you stand at `F + 1` on floor slab F, the air is
// F + 1 .. F + 7, the canvas is in the north wall (z 15) with a row of paint pots at its foot, a painter's mat in front, an easel at the side
// and the stairs to the next floor behind glass, with a door that opens when the picture is right (live, studiolive.js). `TOWER` is the one origin.
// The whole map is a keep (nothing can be built), glass walls go floor to ceiling and the slabs have holes only where the stairs come up, so
// pillaring or jumping never gets you up (tests/wizardcheck.mjs proves it with a walk graph).
import { B, WOOL } from './blocks.js';
import { kit, buildWayBack } from './picturelands.js';
import { FLOORS, floorKey, targetOf } from './wizardtower.js';
import { PAINTS } from './custom.js';

export const SIZE = 48;
export const TOWER = { x0: 15, z0: 15, x1: 32, z1: 32, floors: [1, 9, 17, 25], studio: 33, roof: 46, top: 47 }; // outer walls (inside x / z 16..31), slab y of floors 1-4, the studio's slab, the roof, the top cell
export const slabOf = n => (n <= 4 ? TOWER.floors[n - 1] : TOWER.studio);
export const AIR_HIGH = 7;                                  // floors 1-4: air F + 1 .. F + 7
export const MID = 24;                                      // the canvas and the mat are centred on x 24 (cells 23 | 24)
export const POTS = { z: 16, x0: 18, wash: 30 };           // paint pot i at x 18 + i (12 paints), the wash jar at x 30; y F + 1
export const MAT = { x0: 23, x1: 24, z0: 19, z1: 20 };     // the painter's mat (a rug mesh), 3.5 from the canvas
export const EASEL = { x: 20.5, z: 19.5, cell: [20, 19] }; // the easel stands here; a hidden prop under it keeps it solid
export const WIZARD_AT = { x: 24.5, z: 26.5 };              // the Wizard in the studio, facing north
export const REACH = 12;                                    // a painter's cast (more than a block's REACH: the 8 x 7 canvas from the mat)
const box = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });

// Floor n's things (all derived from TOWER and FLOORS): the canvas (x0 = left cell, y0 = bottom row, z = the wall's cell), pots, mat, easel,
// the stairs up (floors 1-4: odd on the east, even on the west) with their glass wall, door and the rail on the floor above.
export function layoutOf(n) {
  const F = slabOf(n), f = FLOORS[n - 1];
  const canvas = { x0: MID - f.w / 2, y0: F + 2, z: TOWER.z0, w: f.w, h: f.h };
  const pots = PAINTS.map((p, i) => ({ i, x: POTS.x0 + i, y: F + 1, z: POTS.z })).concat([{ i: -1, x: POTS.wash, y: F + 1, z: POTS.z }]); // -1 = the wash jar
  const out = { n, slab: F, canvas, pots, mat: { ...MAT, y: F }, easel: { x: EASEL.x, y: F + 1, z: EASEL.z, cell: EASEL.cell }, flight: null };
  if (n <= 4) {
    const east = n % 2 === 1, m = x => (east ? x : 47 - x);                  // west flights mirror the east ones
    const xs = [m(30), m(31)].sort((a, b) => a - b), wall = m(29);
    out.flight = {
      east, xs, wall,
      steps: Array.from({ length: 7 }, (_, k) => ({ x: xs, y: F + 1 + k, z: 29 - k })),             // step k: a block at y F + 1 + k, z 29 - k
      hole: box(xs[0], xs[1], F + 8, F + 8, 23, 29),                                                  // in the next floor's slab
      door: box(wall, wall, F + 1, F + 2, 30, 31),                                                    // the stairs door at the flight's foot (live)
      pane: box(xs[0], xs[1], F + 1, F + AIR_HIGH, 21, 21),                                           // closes the flight's north end
      glass: box(wall, wall, F + 1, F + AIR_HIGH, 21, 31),
      top: [xs[0], F + 9, 22],                                                                         // where the climb comes out (feet y F + 9, z 22)
      landing: [m(30) + (east ? -1.5 : 2.5), F + 1, 30.5],                                             // a spot in front of the door on the room's side
    };
  }
  return out;
}

export function wizardLand(world) {
  const { W, D } = world;
  kit(world);
  const put = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  const fill = (x0, x1, y0, y1, z0, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, id); };
  const { x0, x1, z0, z1 } = TOWER, S = B.WIZARD_STONE;
  // 1. a soft cloud floor under everything
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) { put(x, 0, z, B.SWIRL_CLOUD); world.ground[x + z * W] = 0; }
  // 2. the shell: walls y 1..45 (stone), the roof, the crystal on top
  for (let y = 1; y <= TOWER.roof - 1; y++) { fill(x0, x1, y, y, z0, z0, S); fill(x0, x1, y, y, z1, z1, S); fill(x0, x0, y, y, z0, z1, S); fill(x1, x1, y, y, z0, z1, S); }
  fill(x0, x1, TOWER.roof, TOWER.roof, z0, z1, S);
  fill(MID - 1, MID, TOWER.top, TOWER.top, MID - 1, MID, B.CRYSTAL);
  // 3. the slabs: planks, the stair holes cut where the flight below comes up
  const slabs = [...TOWER.floors, TOWER.studio];
  for (const F of slabs) fill(x0 + 1, x1 - 1, F, F, z0 + 1, z1 - 1, B.PLANKS);
  for (let n = 1; n <= 4; n++) { const h = layoutOf(n).flight.hole; fill(h.x0, h.x1, h.y0, h.y1, h.z0, h.z1, B.AIR); }
  // 4. each floor: the canvas with its frame, the pots, the mat, the easel's prop, the stairs, lamps, windows
  const studio = { floors: [], doors: [], canvases: [], pots: [], mats: [], easels: [] };
  for (let n = 1; n <= 5; n++) {
    const L = layoutOf(n), F = L.slab, f = FLOORS[n - 1], c = L.canvas;
    // the picture frame round the canvas, then the canvas itself: cream Canvas Wool (given squares already painted: they never change)
    fill(c.x0 - 1, c.x0 + c.w, c.y0 - 1, c.y0 + c.h, c.z, c.z, B.PICTURE_FRAME);
    const T = targetOf(f);
    for (let r = 0; r < c.h; r++) for (let q = 0; q < c.w; q++) {
      const t = T[r * c.w + q];
      put(c.x0 + q, c.y0 + c.h - 1 - r, c.z, t.kind === 'given' ? WOOL[PAINTS[t.paint].wool] : WOOL.custom);
    }
    for (const p of L.pots) put(p.x, p.y, p.z, p.i < 0 ? B.GLASS : WOOL[PAINTS[p.i].wool]);
    // (the painter's mat is a rug mesh drawn by studiolive.js: a wool block here would show as a pink patch on the ceiling of the floor below)
    put(EASEL.cell[0], F + 1, EASEL.cell[1], B.HOUSE_PROP);
    // lamps in the walls and 2 x 2 windows in the east and west walls
    for (const x of [17, 30]) put(x, F + (n <= 4 ? 5 : 8), z0, B.LAMP);
    for (const z of [19, 28]) for (const x of [x0, x1]) put(x, F + (n <= 4 ? 5 : 8), z, B.LAMP);
    if (n <= 4) for (const x of [x0, x1]) fill(x, x, F + 3, F + 4, 24, 25, B.GLASS);
    else {
      for (const x of [x0, x1]) fill(x, x, F + 6, F + 9, 19, 22, B.GLASS);
      for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) if (dx * dx + dy * dy <= 27) put(MID + dx, F + 8 + dy, z1, B.GLASS); // the big round window in the south wall
    }
    // the stairs behind glass, with the door (closed: Wizard Stone; studiolive.js opens it), a gold frame above it
    if (L.flight) {
      const fl = L.flight;
      for (const s of fl.steps) fill(s.x[0], s.x[1], s.y, s.y, s.z, s.z, B.STONE_BRICKS);
      fill(fl.glass.x0, fl.glass.x1, fl.glass.y0, fl.glass.y1, fl.glass.z0, fl.glass.z1, B.GLASS);
      fill(fl.pane.x0, fl.pane.x1, fl.pane.y0, fl.pane.y1, fl.pane.z0, fl.pane.z1, B.GLASS);
      fill(fl.door.x0, fl.door.x1, fl.door.y0, fl.door.y1, fl.door.z0, fl.door.z1, S);
      fill(fl.door.x0, fl.door.x1, fl.door.y1 + 1, fl.door.y1 + 1, fl.door.z0, fl.door.z1, B.PICTURE_FRAME);
      // the 1-high glass rail round the hole on the floor above (the climb comes out at its north end)
      const up = F + 9;
      fill(fl.wall, fl.wall, up, up, 23, 30, B.GLASS);
      fill(fl.xs[0], fl.xs[1], up, up, 30, 30, B.GLASS);
      const cells = [];
      for (let y = fl.door.y0; y <= fl.door.y1; y++) for (let z = fl.door.z0; z <= fl.door.z1; z++) cells.push([fl.wall, y, z]);
      studio.doors.push({ n, cells, key: floorKey(n), box: fl.door });
    }
    studio.floors.push(L);
    studio.canvases.push({ floor: n, ...c });
    studio.pots.push(...L.pots.map(p => ({ floor: n, ...p })));
    studio.mats.push({ floor: n, ...MAT, y: F });
    studio.easels.push({ floor: n, x: EASEL.x, y: F + 1, z: EASEL.z });
  }
  // 5. the Wizard (a guest person) in the studio, facing the canvas; the way back on the ground floor (south wall) and in the studio (east wall)
  world.people ??= [];
  world.people.push({ name: 'The Wizard', title: 'The Wizard · Tower', colors: { skin: 0xf2c9a0, hair: 0xf4f0ea, shirt: 0x6a3ab8, pants: 0x4a2a90 }, look: 'wizard', line: 'Paint my guardian! Almost ready for you!',
    pos: [WIZARD_AT.x, TOWER.studio + 1, WIZARD_AT.z], heading: Math.PI, wizard: true });
  buildWayBack(world, 'wizard', { x: MID, y: TOWER.floors[0], z: 31, facing: [0, -1] });
  buildWayBack(world, 'wizard-top', { x: 31, y: TOWER.studio, z: 26, facing: [-1, 0] });
  // 6. keeps (the whole map: nobody builds, riders stay out), rests, the live part and what it reads
  world.keeps.push({ name: 'studio', protect: [box(0, W - 1, 0, 47, 0, D - 1)], wallText: "This is the Wizard's studio. No building here!" });
  world.rests.push([WIZARD_AT.x, TOWER.studio + 1, WIZARD_AT.z - 3, Math.PI]); // 3 in front of him
  const start = world.arrivals.wizard;
  world.spawnAt = [start[0], start[1], start[2]]; // main.js findSpawn: the roof is above the arrival column, so the column's top block is no use
  world.realmBiome = () => 'wizard';
  world.parts.push({ id: 'studio', live: 'studio' });
  world.studio = studio;
  world.studio.wizard = { x: WIZARD_AT.x, y: TOWER.studio + 1, z: WIZARD_AT.z };
}

// The floor you are on from your height (1-5); 0 outside the tower.
export function floorAt(p) {
  if (p.x < TOWER.x0 || p.x > TOWER.x1 + 1 || p.z < TOWER.z0 || p.z > TOWER.z1 + 1 || p.y < 0) return 0;
  if (p.y >= TOWER.studio) return 5;
  let n = 1;
  for (let i = 0; i < 4; i++) if (p.y >= TOWER.floors[i]) n = i + 1;
  return n;
}

// The guide in the tower: this floor's mat while its picture is not done, else the stairs door, in the studio the Wizard.
export function wizardAim(world, p, game) {
  const n = floorAt(p) || 1, L = world.studio?.floors?.[n - 1];
  if (!L) return null;
  const done = game?.beaten?.includes(floorKey(n));
  if (!done) return { x: (MAT.x0 + MAT.x1 + 1) / 2, z: (MAT.z0 + MAT.z1 + 1) / 2, text: (a, m) => `${'🎨 Copy the picture!'} ${a} ${m}m` };
  if (n <= 4) { const d = L.flight.door; const x = L.flight.east ? d.x0 - 0.5 : d.x0 + 1.5; return { x, z: (d.z0 + d.z1 + 1) / 2, text: (a, m) => `Up the stairs! ${a} ${m}m` }; }
  const w = world.studio.wizard;
  return { x: w.x, z: w.z, text: (a, m) => `🧙 The Wizard ${a} ${m}m` };
}

// A painter's cast from `o` along `d` ({ x, y, z } each): what you point at on this floor (`L` = layoutOf(n)): a canvas square (its index, row by row
// from the top) or a paint pot (`i` = the paint, -1 = the wash jar), the nearer first, within `reach`. Pure (no Three.js), so Node proves it.
export function cast(L, o, d, reach = REACH) {
  let best = null;
  const c = L.canvas;
  if (d.z < -1e-9) { // the canvas: the plane in front of the wall's cells, facing +z
    const t = (c.z + 1 - o.z) / d.z;
    if (t > 0 && t <= reach) {
      const x = o.x + d.x * t, y = o.y + d.y * t;
      if (x >= c.x0 && x < c.x0 + c.w && y >= c.y0 && y < c.y0 + c.h) best = { kind: 'square', i: (c.h - 1 - Math.floor(y - c.y0)) * c.w + Math.floor(x - c.x0), t };
    }
  }
  for (const p of L.pots) { // a pot is the block [x, x + 1] x [y, y + 1] x [z, z + 1]: the slab method
    let t0 = 0, t1 = reach, ok = true;
    for (const [oo, dd, lo] of [[o.x, d.x, p.x], [o.y, d.y, p.y], [o.z, d.z, p.z]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > lo + 1) { ok = false; break; } continue; }
      let a = (lo - oo) / dd, b = (lo + 1 - oo) / dd;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && (!best || t0 < best.t)) best = { kind: 'pot', i: p.i, t: t0 };
  }
  return best;
}
