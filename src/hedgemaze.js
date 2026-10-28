// T49: the Castle's hedge maze (owner 2026-10-28: "a real hedge maze, middle difficulty: a few dead ends and loops, through in a couple of
// minutes, no hidden switches"), pure: a grid of cells (3-wide paths, 1-thick hedges) made by a seeded depth-first carve plus a few
// knocked-out hedges for loops. The same maze in every world (a fixed seed), so the terrain check can pin its numbers.
// Owner 2026-10-28 ("ok, maybe a little too easy; more fun and a tiny bit harder"): a new seed with a longer way and more dead ends, a
// fountain clearing in the middle (2 x 2 cells with no hedges between them; the shortest way goes through it), hedge archways, lucky
// horseshoes in four dead ends (a cube each, once per trip: castlelive.js) and hedge critters that peek over the hedges. No switches, nothing
// that blocks a way: the arches are only over gaps, the fountain only in the clearing's middle.
import { seeded } from './siege.js';

export const MAZE = {
  x0: 102, z0: 52, cols: 6, rows: 11, pitch: 4,  // the box x 102..126, z 52..96 (hedge lines at x0 + 4i, z0 + 4j)
  entrance: { side: 'west', j: 9 },               // from the courtyard
  exit: { side: 'north', i: 2 },                  // into the Tilt Yard
  seed: 483, loops: 2,                            // see mazeOf: `seed` is chosen so the numbers below hold (the spec checks them; it was 14 / 4)
  clearing: { i: 2, j: 4 },                       // the fountain clearing: cells (2..3, 4..5), its middle post (x 114, z 72) is the fountain
  height: 3,                                      // hedges y 11..13: too high to jump, too high to see over
  minPath: 24, maxPath: 32,                       // the shortest way through, in cells (4 blocks each): a middle band (it was 18-26, the way 22)
  deadEnds: 11,                                   // dead ends of this maze (the spec checks it stays the same; it was 8)
  treats: 4, peeks: 4, arches: 4,                 // lucky horseshoes (the furthest dead ends), hedge critters, archways inside (plus the doors)
  hintAfter: 45, compassAfter: 90,                // s inside before the guide gives a tip, then an arrow to the way out (as the crow flies)
};
const N = MAZE.cols * MAZE.rows, id = (i, j) => i + j * MAZE.cols;

// The maze as data: open[c] = Set of neighbour cell ids joined to c. Pure, cached.
let cache = null;
export function mazeOf(seed = MAZE.seed, loops = MAZE.loops) {
  if (cache && cache.seed === seed && cache.loops === loops) return cache;
  const rnd = seeded(0x4d415a45 ^ seed), open = Array.from({ length: N }, () => new Set());
  const nb = c => { const i = c % MAZE.cols, j = Math.floor(c / MAZE.cols), out = []; if (i > 0) out.push(c - 1); if (i < MAZE.cols - 1) out.push(c + 1); if (j > 0) out.push(c - MAZE.cols); if (j < MAZE.rows - 1) out.push(c + MAZE.cols); return out; };
  const seen = new Set([0]), stack = [0];
  while (stack.length) {
    const c = stack[stack.length - 1], next = nb(c).filter(n => !seen.has(n));
    if (!next.length) { stack.pop(); continue; }
    const n = next[Math.floor(rnd() * next.length)];
    open[c].add(n); open[n].add(c); seen.add(n); stack.push(n);
  }
  // the fountain clearing: its four cells all joined
  const cl = MAZE.clearing, ca = id(cl.i, cl.j), clear = [ca, ca + 1, ca + MAZE.cols, ca + MAZE.cols + 1];
  for (const [a, b] of [[0, 1], [2, 3], [0, 2], [1, 3]]) { open[clear[a]].add(clear[b]); open[clear[b]].add(clear[a]); }
  // loops: knock out hedges between cells that are not joined yet, away from the edges of the maze
  let made = 0;
  for (let tries = 0; made < loops && tries < 500; tries++) {
    const c = Math.floor(rnd() * N), list = nb(c).filter(n => !open[c].has(n));
    if (!list.length) continue;
    const n = list[Math.floor(rnd() * list.length)];
    open[c].add(n); open[n].add(c); made++;
  }
  const start = id(0, MAZE.entrance.j), end = id(MAZE.exit.i, 0);
  // the shortest path (cells), dead ends (cells with one way out; the entrance and the exit count their door), loops (extra joins)
  const dist = new Map([[start, 0]]), q = [start], from = new Map();
  while (q.length) { const c = q.shift(); for (const n of open[c]) if (!dist.has(n)) { dist.set(n, dist.get(c) + 1); from.set(n, c); q.push(n); } }
  const way = []; for (let c = end; c !== undefined; c = from.get(c)) way.unshift(c);
  const ways = c => open[c].size + (c === start || c === end ? 1 : 0);
  const ends = Array.from({ length: N }, (_, c) => c).filter(c => ways(c) === 1);
  const joins = open.reduce((a, s) => a + s.size, 0) / 2;
  // the lucky horseshoes: in the dead ends furthest from the entrance (ties: the lower cell id), at least 3 cells apart
  const treats = [], cellIJ = c => [c % MAZE.cols, Math.floor(c / MAZE.cols)];
  for (const c of ends.slice().sort((a, b) => dist.get(b) - dist.get(a) || a - b)) {
    if (treats.length >= MAZE.treats || c === start || c === end) continue;
    const [i, j] = cellIJ(c);
    if (treats.every(t => { const [ti, tj] = cellIJ(t); return Math.abs(ti - i) + Math.abs(tj - j) >= 3; })) treats.push(c);
  }
  cache = { seed, loops, open, start, end, path: (dist.get(end) ?? Infinity) + 1, reach: dist.size, deadEnds: ends.length, ends, loopCount: joins - (N - 1), way, clear, treats };
  return cache;
}
// The world cells of the maze: { hedge: [[x, z]], gaps: { entrance: [[x, z]...], exit: [...] } } (hedge columns, y 11..13).
export function mazeCells(seed = MAZE.seed) {
  const m = mazeOf(seed), { x0, z0, cols, rows, pitch } = MAZE, W = cols * pitch + 1, Dp = rows * pitch + 1;
  const hedge = new Set();
  for (let dx = 0; dx < W; dx++) for (let dz = 0; dz < Dp; dz++) if (dx % pitch === 0 || dz % pitch === 0) hedge.add(`${x0 + dx},${z0 + dz}`);
  const gap = (x, z) => hedge.delete(`${x},${z}`);
  for (let c = 0; c < N; c++) for (const n of m.open[c]) {
    if (n < c) continue;
    const i = c % cols, j = Math.floor(c / cols), ni = n % cols;
    if (ni !== i) { const x = x0 + (i + 1) * pitch; for (let k = 1; k < pitch; k++) gap(x, z0 + j * pitch + k); } // east wall of c
    else { const z = z0 + (j + 1) * pitch; for (let k = 1; k < pitch; k++) gap(x0 + i * pitch + k, z); }       // south wall of c
  }
  const C = MAZE.clearing; gap(x0 + (C.i + 1) * pitch, z0 + (C.j + 1) * pitch); // the clearing's middle post: the fountain stands there
  // archways: hedge over a gap (y 13, you walk under): both doors and a few gaps inside picked by a fixed rule (never in the clearing)
  const arches = [], inClear = c => m.clear.includes(c), gaps = [];
  for (let c = 0; c < N; c++) for (const n of [...m.open[c]].sort((a, b) => a - b)) if (n > c && !inClear(c) && !inClear(n)) gaps.push([c, n]);
  for (let t = 1; t <= MAZE.arches; t++) {
    const [c, n] = gaps[Math.floor(t * gaps.length / (MAZE.arches + 1))];
    const i = c % cols, j = Math.floor(c / cols), row = [];
    if (n === c + 1) { const x = x0 + (i + 1) * pitch; for (let k = 1; k < pitch; k++) row.push([x, z0 + j * pitch + k]); }
    else { const z = z0 + (j + 1) * pitch; for (let k = 1; k < pitch; k++) row.push([x0 + i * pitch + k, z]); }
    arches.push(row);
  }
  const entrance = [], exit = [];
  for (let k = 1; k < pitch; k++) { entrance.push([x0, z0 + MAZE.entrance.j * pitch + k]); exit.push([x0 + MAZE.exit.i * pitch + k, z0]); }
  for (const [x, z] of [...entrance, ...exit]) gap(x, z);
  arches.push(entrance, exit);
  return { hedge: [...hedge].map(s => s.split(',').map(Number)), entrance, exit, arches, box: { x0, x1: x0 + W - 1, z0, z1: z0 + Dp - 1 } };
}
// The middle of a cell in the world (x, z), the fountain, the gardener, the horseshoes and the critters (posts on top of the hedges).
export const cellMid = c => [MAZE.x0 + (c % MAZE.cols) * MAZE.pitch + 2.5, MAZE.z0 + Math.floor(c / MAZE.cols) * MAZE.pitch + 2.5];
export const FOUNTAIN = { x: MAZE.x0 + (MAZE.clearing.i + 1) * MAZE.pitch, z: MAZE.z0 + (MAZE.clearing.j + 1) * MAZE.pitch };
export const GARDENER = { name: 'Gardener Gwen', x: FOUNTAIN.x - 3, z: FOUNTAIN.z - 3, colors: { shirt: 0x5a9a3a, pants: 0x6a4a2a, hair: 0xc86a2a, skin: 0xf2d0b0 }, line: 'Hello! My fountain is the middle of the maze. Lucky horseshoes hide in the dead ends!' };
export function mazeExtras() {
  const m = mazeOf(), { x0, z0, cols, rows, pitch } = MAZE;
  const treats = m.treats.map(c => { const [x, z] = cellMid(c); return { cell: c, x, z }; });
  // critters: inner hedge posts by a fixed rule (not the fountain post), facing into the maze
  const peeks = [];
  for (let j = 1; j < rows && peeks.length < MAZE.peeks; j += 3) for (let i = 1; i < cols && peeks.length < MAZE.peeks; i++) {
    const x = x0 + i * pitch, z = z0 + j * pitch;
    if ((i * 5 + j * 3) % 4 !== 1 || (x === FOUNTAIN.x && z === FOUNTAIN.z)) continue;
    peeks.push({ x, z, i: peeks.length });
  }
  return { treats, peeks, fountain: FOUNTAIN, gardener: GARDENER };
}
export const inMaze = (x, z) => x >= MAZE.x0 + 0.5 && x <= MAZE.x0 + MAZE.cols * MAZE.pitch + 0.5 && z >= MAZE.z0 + 0.5 && z <= MAZE.z0 + MAZE.rows * MAZE.pitch + 0.5;
