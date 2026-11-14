// Chapter 3 step D (plans/chapter3-abilities-build.md, ?preview only): THE SLUICE GATE, the Swim place in Bumpy Hills. Pure,
// Node-runnable (wayland.js builds it; tests/waysbots.mjs plays it with the real Player).
//   A pond; from its floor a channel runs on under a glass roof (you see daylight, you can walk on the glass), full of water, to a gate
//   and the grotto behind it with the chest. Stand on the gold plate on the pond's bank: the gate opens, and the moment you step off it
//   starts to lower (row by row, top first). Swim creatures dive and swim fast under water (player.js: creature mode, `be` + the water
//   ride); everyone else paddles slowly (anyone can go under). Kelp in the middle of each stretch slows you right down; bubble jets along
//   the outside push you on: the straight line is the slow one. Fliers stay over water (a flier cannot go under), and the roof is glass.
// The gate opens again for you while you are in the grotto (the way back out).
import { B } from './blocks.js';

export const SLUICE = {
  pond: { x0: 124, x1: 132, z0: 82, z1: 90, floor: 5, top: 9 },  // water y floor + 1 .. top (you float at top + 1)
  plate: { x: 128, z: 93, r: 0.9 },                              // on the bank south of the pond (stand on the ground at y 11)
  // the channel: boxes of water cells (x0..x1, z0..z1, y 6..8) under a glass roof (y 9 and 10)
  legs: [{ x0: 133, x1: 148, z0: 83, z1: 89 }, { x0: 142, x1: 148, z0: 90, z1: 99 }],
  y0: 6, y1: 8,
  gate: { x0: 142, x1: 148, z: 100 },                            // the gate's cells (y0..y1), closing top row first
  grotto: { x0: 141, x1: 149, z0: 101, z1: 104, floor: 5, water: 7, roof: 11 },
  ledge: { x0: 148, x1: 149, z0: 103, z1: 104 },                 // a dry ledge in the grotto (top y 8) with the chest on it
  kelp: [{ x0: 135, x1: 146, z0: 85, z1: 87 }, { x0: 143, x1: 146, z0: 91, z1: 98 }], // slows you (x `drag`)
  jets: [{ x0: 133, x1: 141, z0: 88, z1: 89, v: [3.2, 0] }, { x0: 147, x1: 148, z0: 84, z1: 99, v: [0, 3.2] }], // push you (blocks a second)
  drag: 0.35,
  shut: 5.6,       // seconds from stepping off the plate until the bottom row is shut (bots: a skilled swimmer 3.5, straight through the kelp 7.2, no Swim 8.3+)
  rows: 0.7,       // the rows above shut this much earlier each (you see it lowering)
};
const inBox = (b, x, z) => x >= b.x0 && x < b.x1 + 1 && z >= b.z0 && z < b.z1 + 1;
const inY = y => y >= SLUICE.y0 - 0.5 && y < SLUICE.y1 + 1.2;
// the channel's own rules for the player physics (world.flowAt / world.dragAt in Wobbleland): the jets' push and the kelp's drag
export function sluiceFlow(pos) {
  for (const j of SLUICE.jets) if (inBox(j, pos.x, pos.z) && inY(pos.y)) return { x: j.v[0], y: 0, z: j.v[1] };
  return null;
}
export function sluiceDrag(pos) {
  for (const k of SLUICE.kelp) if (inBox(k, pos.x, pos.z) && inY(pos.y)) return SLUICE.drag;
  return 1;
}
export const inGrotto = pos => inBox(SLUICE.grotto, pos.x, pos.z) && pos.y > SLUICE.grotto.floor;
export const onPlate = pos => Math.hypot(pos.x - SLUICE.plate.x - 0.5, pos.z - SLUICE.plate.z - 0.5) < SLUICE.plate.r && Math.abs(pos.y - 11) < 0.3;
// how many rows are shut `since` seconds after you stepped off (0..3; top row first)
export function rowsShut(since) {
  const S = SLUICE, n = S.y1 - S.y0 + 1;
  let k = 0;
  for (let r = 0; r < n; r++) if (since >= S.shut - (n - 1 - r) * S.rows) k++;
  return k;
}
export function gateCells(shut) { // the solid cells for that many rows shut
  const S = SLUICE, out = [];
  for (let r = 0; r < shut; r++) for (let x = S.gate.x0; x <= S.gate.x1; x++) out.push([x, S.y1 - r, S.gate.z]);
  return out;
}

// The blocks (wayland.js waysLand, after the ground).
export function buildSluice(world, put) {
  const S = SLUICE, P = S.pond, G = S.grotto;
  const roofed = (x, z) => { for (let y = S.y0; y <= S.y1; y++) put(x, y, z, B.WATER); put(x, S.y0 - 1, z, B.SAND); put(x, S.y1 + 1, z, B.GLASS); put(x, S.y1 + 2, z, B.GLASS); };
  // the channel's walls (stone) first, then the water and the glass
  for (const L of [...S.legs, { x0: S.gate.x0, x1: S.gate.x1, z0: S.gate.z, z1: S.gate.z }]) for (let x = L.x0 - 1; x <= L.x1 + 1; x++) for (let z = L.z0 - 1; z <= L.z1 + 1; z++) for (let y = S.y0 - 1; y <= S.y1 + 2; y++) put(x, y, z, B.STONE_BRICKS);
  for (const L of [...S.legs, { x0: S.gate.x0, x1: S.gate.x1, z0: S.gate.z, z1: S.gate.z }]) for (let x = L.x0; x <= L.x1; x++) for (let z = L.z0; z <= L.z1; z++) roofed(x, z);
  // the pond (after the channel's walls: its east side opens into the channel's mouth)
  for (let x = P.x0; x <= P.x1; x++) for (let z = P.z0; z <= P.z1; z++) {
    put(x, P.floor, z, B.SAND);
    for (let y = P.floor + 1; y <= 30; y++) put(x, y, z, y <= P.top ? B.WATER : 0);
  }
  // the grotto: walls, a glass roof, water, the ledge and its chest
  for (let x = G.x0 - 1; x <= G.x1 + 1; x++) for (let z = G.z0 - 1; z <= G.z1 + 1; z++) for (let y = G.floor; y <= G.roof; y++) {
    const wall = x < G.x0 || x > G.x1 || z < G.z0 || z > G.z1;
    put(x, y, z, wall ? B.STONE_BRICKS : y === G.floor ? B.SAND : y === G.roof ? B.GLASS : y <= G.water ? B.WATER : 0);
  }
  for (let x = S.gate.x0; x <= S.gate.x1; x++) for (let y = S.y0; y <= S.y1; y++) put(x, y, G.z0 - 1, B.WATER); // (the gate's wall is the gate)
  for (let x = S.ledge.x0; x <= S.ledge.x1; x++) for (let z = S.ledge.z0; z <= S.ledge.z1; z++) for (let y = G.floor; y <= 8; y++) put(x, y, z, B.STONE_BRICKS);
  put(S.ledge.x1, 9, S.ledge.z1, B.CHEST);
  world.sluice = SLUICE;
}

// The rules after the player moved. set(x, y, z, id) changes a block (LiveCells in the game: never shut on the player). -> events
// [{ kind: 'open' | 'shutting' | 'shut' | 'through' }]
export class SluiceRun {
  constructor(set) { this.set = set; this.t = 0; this.off = null; this.shown = -1; this.through = false; this.wasOn = false; }
  step(p, dt) {
    this.t += dt;
    const ev = [], on = onPlate(p.pos), inside = inGrotto(p.pos);
    if (on) { if (!this.wasOn) ev.push({ kind: 'open' }); this.off = null; }
    else if (this.wasOn) { this.off = this.t; ev.push({ kind: 'shutting' }); }
    this.wasOn = on;
    let shut = this.off == null ? (on ? 0 : 3) : rowsShut(this.t - this.off);
    if (inside) shut = 0; // (the way back out)
    if (shut !== this.shown) {
      for (const [x, y, z] of gateCells(3)) this.set(x, y, z, B.WATER);
      for (const [x, y, z] of gateCells(shut)) this.set(x, y, z, B.STONE_BRICKS);
      if (shut === 3 && this.shown >= 0 && this.shown < 3) ev.push({ kind: 'shut' });
      this.shown = shut;
    }
    if (inside && !this.through) { this.through = true; ev.push({ kind: 'through' }); }
    return ev;
  }
  get since() { return this.off == null ? null : this.t - this.off; }
}
