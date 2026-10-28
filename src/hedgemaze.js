// T49: the Castle's hedge maze (owner 2026-10-28: "a real hedge maze, middle difficulty: a few dead ends and loops, through in a couple of
// minutes, no hidden switches"), pure: a grid of cells (3-wide paths, 1-thick hedges) made by a seeded depth-first carve plus a few
// knocked-out hedges for loops. The same maze in every world (a fixed seed), so the terrain check can pin its numbers.
import { seeded } from './siege.js';

export const MAZE = {
  x0: 102, z0: 52, cols: 6, rows: 11, pitch: 4,  // the box x 102..126, z 52..96 (hedge lines at x0 + 4i, z0 + 4j)
  entrance: { side: 'west', j: 9 },               // from the courtyard
  exit: { side: 'north', i: 2 },                  // into the Tilt Yard
  seed: 14, loops: 4,                             // see mazeOf: `seed` is chosen so the numbers below hold (the spec checks them)
  height: 3,                                      // hedges y 11..13: too high to jump, too high to see over
  minPath: 18, maxPath: 26,                       // the shortest way through, in cells (4 blocks each): a middle band
  deadEnds: 8,                                    // dead ends of this maze (the spec checks it stays the same)
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
  const dist = new Map([[start, 0]]), q = [start];
  while (q.length) { const c = q.shift(); for (const n of open[c]) if (!dist.has(n)) { dist.set(n, dist.get(c) + 1); q.push(n); } }
  const ways = c => open[c].size + (c === start || c === end ? 1 : 0);
  const deadEnds = Array.from({ length: N }, (_, c) => c).filter(c => ways(c) === 1).length;
  const joins = open.reduce((a, s) => a + s.size, 0) / 2;
  cache = { seed, loops, open, start, end, path: (dist.get(end) ?? Infinity) + 1, reach: dist.size, deadEnds, loopCount: joins - (N - 1) };
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
  const entrance = [], exit = [];
  for (let k = 1; k < pitch; k++) { entrance.push([x0, z0 + MAZE.entrance.j * pitch + k]); exit.push([x0 + MAZE.exit.i * pitch + k, z0]); }
  for (const [x, z] of [...entrance, ...exit]) gap(x, z);
  return { hedge: [...hedge].map(s => s.split(',').map(Number)), entrance, exit, box: { x0, x1: x0 + W - 1, z0, z1: z0 + Dp - 1 } };
}
export const inMaze = (x, z) => x >= MAZE.x0 + 0.5 && x <= MAZE.x0 + MAZE.cols * MAZE.pitch + 0.5 && z >= MAZE.z0 + 0.5 && z <= MAZE.z0 + MAZE.rows * MAZE.pitch + 0.5;
