// T49: the Castle terrain checks that need no browser: a stand-in world for castleLand and the walk graph of housecheck.mjs (plus swimming:
// from water you can swim up and climb out onto a bank up to 3 higher). Used by tests/specs/castle.mjs (in Node and in the page) and run
// by hand with `node tests/castlecheck.mjs [seed]`.
import { B, isSolid } from '../src/blocks.js';
import { castleLand, SIZE, G, CASTLE, KEEP, YARD, TILT, FIELD, MOAT, COURTYARD, liveCells } from '../src/castleland.js';
import { SIEGE, throwAt, spotPos } from '../src/siege.js';
import { MAZE, mazeOf, inMaze, mazeExtras, mazeCells } from '../src/hedgemaze.js';
import { walkGraph, bfs } from './housecheck.mjs';

export const WORLD_H = 48;
export function standIn(seed, [W, D] = [SIZE, SIZE]) {
  const w = {
    W, D, seed, data: new Uint8Array(W * D * WORLD_H), ground: new Uint8Array(W * D),
    index: (x, y, z) => x + W * (z + D * y),
    inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < WORLD_H,
    get: (x, y, z) => (w.inBounds(x, y, z) ? w.data[x + W * (z + D * y)] : B.AIR),
    isSolid: (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 ? true : isSolid(w.get(x, y, z))),
  };
  return w;
}
export function makeCastle(seed) { const w = standIn(seed); castleLand(w, { id: 'castle', size: [SIZE, SIZE] }); return w; }
const keyOf = (x, y, z) => `${x},${y},${z}`;
const parse = k => k.split(',').map(Number);

// The walk graph with the live cells in a given state: bridge (down = deck solid, gate open), port (open), squire (the gate open).
export function graphOf(w, { bridge = false, port = false, squire = false, block = null } = {}) {
  const L = liveCells(), solidSet = new Set(), openSet = new Set();
  for (const c of L.deck) (bridge ? solidSet : openSet).add(keyOf(...c));
  for (const c of L.raised) (bridge ? openSet : solidSet).add(keyOf(...c));
  for (const c of L.port) (port ? openSet : solidSet).add(keyOf(...c));
  for (const c of L.squire) (squire ? openSet : solidSet).add(keyOf(...c));
  const g = walkGraph(w, { block: (x, y, z) => solidSet.has(keyOf(x, y, z)) || !!block?.(x, y, z), open: (x, y, z) => openSet.has(keyOf(x, y, z)) });
  g.edges = (x, y, z) => { // swimming: from water, up and out onto a bank 1-3 higher
    if (w.get(x, y, z) !== B.WATER && w.get(x, y - 1, z) !== B.WATER) return [];
    const out = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) for (let k = 1; k <= 3; k++) if (g.standOk(x + dx, y + k, z + dz) && !g.solid(x, y + k, z)) out.push([x + dx, y + k, z + dz]);
    return out;
  };
  return g;
}
const at = p => [Math.floor(p[0]), Math.round(p[1]), Math.floor(p[2])];

export function analyze(seed = 1) {
  const out = { problems: [], info: {} };
  const bad = m => out.problems.push(m);
  const w = makeCastle(seed), C = w.castle;
  const arrive = at(w.arrivals.castle), throneRest = at(w.bosses[0].rest);
  const inCastle = (x, z) => x > CASTLE.x0 + 1 && x < CASTLE.x1 - 1 && z > CASTLE.z0 + 1 && z < CASTLE.z1 - 1;
  const inYard = (x, z) => x >= YARD.x0 && x <= YARD.x1 && z >= YARD.z0 && z <= YARD.z1;
  const inKeep = (x, y, z) => x > KEEP.x0 && x < KEEP.x1 && z > KEEP.z0 && z < KEEP.z1;
  const some = (seen, f) => { for (const k of seen.keys()) { const [x, y, z] = parse(k); if (f(x, y, z)) return true; } return false; };
  // 1. drawbridge up: the castle stays shut, swimming the moat too
  const up = bfs(graphOf(w), [arrive]);
  if (some(up, (x, y, z) => inCastle(x, z))) bad('with the drawbridge up the castle can be reached');
  out.info.meadow = up.size;
  // 2. drawbridge down: the courtyard and the maze's entrance; the Tilt Yard only through the maze; not the throne room
  const down = bfs(graphOf(w, { bridge: true }), [arrive]);
  const court = some(down, (x, y, z) => x >= COURTYARD.x0 && x <= COURTYARD.x1 && z >= COURTYARD.z0 && z <= COURTYARD.z1 && y === G + 1);
  if (!court) bad('with the drawbridge down the courtyard cannot be reached');
  if (!some(down, (x, y, z) => inYard(x, z) && y === G + 1)) bad('the Tilt Yard cannot be reached through the maze');
  const noMaze = bfs(graphOf(w, { bridge: true, block: (x, y, z) => inMaze(x + 0.5, z + 0.5) }), [arrive]);
  if (some(noMaze, (x, y, z) => inYard(x, z))) bad('the Tilt Yard can be reached without the maze');
  if (down.has(keyOf(...throneRest)) || some(down, (x, y, z) => inKeep(x, y, z))) bad('the keep can be reached with the portcullis down');
  // 3. the squire gate opens the way back from the yard (and only from there it is a short cut); with the portcullis up: the throne room
  const all = bfs(graphOf(w, { bridge: true, port: true, squire: true }), [arrive]);
  if (!all.has(keyOf(...throneRest))) bad('the throne room cannot be reached with everything open');
  const wren = at(w.bosses[0].crew.find(c => c.i === 1).pos), pip = at(w.bosses[0].crew.find(c => c.i === 0).pos);
  if (!down.has(keyOf(...wren))) bad('Archer Wren on the gatehouse roof cannot be reached');
  if (!down.has(keyOf(...pip))) bad('Squire Pip in the Tilt Yard cannot be reached');
  for (const pad of TILT.pads) { const c = [pad[0] + 1, G + 1, pad[2] + 1]; if (!down.has(keyOf(...c))) bad(`the start pad at x ${pad[0]} cannot be reached`); }
  for (const s of SIEGE.stones) if (!up.has(keyOf(...at(s)))) bad(`the Shield Stone at x ${s[0]} cannot be reached`);
  // 4. nobody stuck: every place you can reach (everything open) leads back to a rest spot (reverse search)
  const g = graphOf(w, { bridge: true, port: true, squire: true }), rev = new Map();
  for (const k of all.keys()) { const c = parse(k); for (const n of [...g.neighbours(...c), ...g.edges(...c)]) { const nk = keyOf(...n); if (!rev.has(nk)) rev.set(nk, []); rev.get(nk).push(k); } }
  const home = new Set(w.rests.map(r => keyOf(...at(r)))), q = [...home].filter(k => all.has(k)), back = new Set(q);
  while (q.length) { const k = q.shift(); for (const p of rev.get(k) || []) if (!back.has(p)) { back.add(p); q.push(p); } }
  const stuck = [...all.keys()].filter(k => !back.has(k));
  if (stuck.length) bad(`${stuck.length} reachable places lead nowhere (e.g. ${stuck.slice(0, 3).join(' | ')})`);
  out.info.reach = all.size;
  // 5. the maze: the numbers of the plan, and the walk from its entrance to its exit
  const m = mazeOf();
  if (m.path < MAZE.minPath || m.path > MAZE.maxPath) bad(`the maze's shortest way is ${m.path} cells (want ${MAZE.minPath}-${MAZE.maxPath})`);
  if (m.deadEnds !== MAZE.deadEnds) bad(`the maze has ${m.deadEnds} dead ends (want ${MAZE.deadEnds})`);
  if (m.loopCount < 2) bad(`the maze has ${m.loopCount} loops (want 2+)`);
  if (m.reach !== MAZE.cols * MAZE.rows) bad('some maze cells cannot be reached');
  const ent = C.maze.entrance[1], ex = C.maze.exit[1], gm = graphOf(w, { bridge: true });
  const dist = new Map([[keyOf(ent[0] - 1, G + 1, ent[1]), 0]]), q2 = [[ent[0] - 1, G + 1, ent[1]]];
  while (q2.length) { const c = q2.shift(); for (const n of gm.neighbours(...c)) { const k = keyOf(...n); if (dist.has(k)) continue; dist.set(k, dist.get(keyOf(...c)) + 1); q2.push(n); } }
  const blocks = dist.get(keyOf(ex[0], G + 1, ex[1] - 1));
  if (!blocks || blocks < MAZE.minPath * MAZE.pitch - 6 || blocks > MAZE.maxPath * MAZE.pitch + 6) bad(`walking through the maze takes ${blocks} blocks`);
  // owner 2026-10-28: the maze's fun never changes the way: the shortest way goes through the fountain clearing; every horseshoe, the
  // gardener and the walk under every archway can be reached; nothing (the fountain's spout, an arch, a rose) lets you up onto the hedges
  if (!m.way.some(c => m.clear.includes(c))) bad('the shortest way through the maze misses the fountain clearing');
  const fx = mazeExtras();
  if (fx.treats.length !== MAZE.treats) bad(`${fx.treats.length} horseshoes (want ${MAZE.treats})`);
  for (const h of fx.treats) { if (!m.ends.includes(h.cell)) bad(`a horseshoe is not in a dead end (cell ${h.cell})`); if (!dist.has(keyOf(Math.floor(h.x), G + 1, Math.floor(h.z)))) bad(`the horseshoe at ${h.x},${h.z} cannot be reached`); }
  if (!dist.has(keyOf(fx.gardener.x, G + 1, fx.gardener.z))) bad('Gardener Gwen\'s spot cannot be reached');
  for (const row of mazeCells().arches) for (const [x, z] of row) if (!dist.has(keyOf(x, G + 1, z))) bad(`the way under the archway at ${x},${z} is blocked`);
  for (const k of all.keys()) { const [x, y, z] = parse(k); if (inMaze(x + 0.5, z + 0.5) && y > G + 2) { bad(`you can stand on top of the maze at ${k}`); break; } }
  out.info.maze = { cells: m.path, deadEnds: m.deadEnds, loops: m.loopCount, blocks, horseshoes: fx.treats.length, arches: mazeCells().arches.length, critters: fx.peeks.length };
  // 6. throws: every flight from every spot to both stones is clear (sampled every 0.02 s); the air over each stone is clear
  let blocked = 0;
  for (const stand of SIEGE.stones) for (let k = 0; k < 12; k++) for (const [kind, flight] of [['pumpkin', SIEGE.flight.pumpkin[0]], ['pumpkin', SIEGE.flight.pumpkin[2]], ['arrow', SIEGE.flight.arrow]]) {
    const t = { at: 10, k, kind, flight, tell: 1 };
    for (let time = 10 - flight + 0.02; time < 10; time += 0.02) { const p = throwAt(t, stand, time).pos; if (p && w.isSolid(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]))) { blocked++; break; } }
  }
  if (blocked) bad(`${blocked} throws hit a block on their way`);
  for (const s of SIEGE.stones) for (let y = G + 1; y < G + 1 + SIEGE.skyHigh + 3; y++) if (w.isSolid(Math.floor(s[0]), y, Math.floor(s[2]))) bad(`the sky over the stone at x ${s[0]} is not clear at y ${y}`);
  // 7. the tilt lanes are clear for a horse and its rider (3 high), the knight's lane too
  for (let x = Math.floor(TILT.x0); x <= Math.floor(TILT.x1); x++) for (const z of [Math.floor(TILT.z), Math.floor(TILT.knightZ)]) for (let y = G + 1; y <= G + 3; y++) if (w.isSolid(x, y, z)) { bad(`a lane is blocked at ${x},${y},${z}`); break; }
  // 8. keeps: the moat, the walls, the field and every tower; nooks never on sand, in the field or the keep
  const kept = (x, y, z) => w.keeps.some(k => k.protect.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1));
  for (const [x, z] of [[MOAT.x0, 60], [80, MOAT.z1], [CASTLE.x0, 60], [80, CASTLE.z0], [FIELD.x0 + 1, FIELD.z0 + 1]]) if (!kept(x, G, z)) bad(`${x},${z} is not in a keep`);
  for (const t of C.towers) if (!kept(t.cell[0], G + 2, t.cell[1])) bad(`tower ${t.k} is not in a keep`);
  for (const n of w.nooks) if (w.get(n.x, n.y - 1, n.z) === B.SAND || (n.x >= FIELD.x0 && n.x <= FIELD.x1 && n.z >= FIELD.z0 && n.z <= FIELD.z1) || inKeep(n.x, n.y, n.z) || !all.has(keyOf(n.x, n.y, n.z))) bad(`nook ${n.x},${n.z} is in a wrong place`);
  if (w.nooks.length < 12) bad(`only ${w.nooks.length} nooks`);
  // 9. block ids: old ones, 182 (hedge), 254 (knight wool)
  const ids = new Set();
  for (let i = 0; i < w.data.length; i++) ids.add(w.data[i]);
  out.info.ids = [...ids].sort((a, b) => a - b);
  const newIds = [...ids].filter(id => id >= 137 && ![144, 145, 146, 182, 254].includes(id) && !(id >= 140 && id <= 143) && !(id >= 204 && id <= 248));
  if (newIds.length) bad(`unexpected block ids ${newIds}`);
  return out;
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('castlecheck.mjs')) {
  const seed = Number(process.argv[2] || 1), t0 = Date.now(), r = analyze(seed);
  console.log(JSON.stringify(r.info), `${Date.now() - t0} ms`);
  console.log(r.problems.length ? r.problems.join('\n') : 'all good');
}
