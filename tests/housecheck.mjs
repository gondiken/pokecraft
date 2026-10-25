// T40a: the Giant House checks that need no browser: a stand-in world for houseLand (like the dream spec's), and a walk graph
// (BFS over stand cells with the gadget edges). Used by tests/specs/tiny.mjs (in the page, through /tests/housecheck.mjs) and run
// by hand with `node tests/housecheck.mjs [seed]`.
import { B, BLOCKS, isSolid } from '../src/blocks.js';
import { houseLand, SIZE, COUNTER, CAN_COLUMNS, CAN_STAND, CUPBOARD_ROOM, HATCH, SHELF, FAN, TRACK, CAT, SECRETS, MOUSE_HOLE, CRUMBS } from '../src/giantland.js';

export const WORLD_H = 48;
// A world with just what the builder needs (W, D, seed, data, ground, index, inBounds, get).
export function standIn(seed, [W, D] = SIZE) {
  const w = {
    W, D, seed, data: new Uint8Array(W * D * WORLD_H), ground: new Uint8Array(W * D),
    index: (x, y, z) => x + W * (z + D * y),
    inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < WORLD_H,
    get: (x, y, z) => (w.inBounds(x, y, z) ? w.data[x + W * (z + D * y)] : B.AIR),
    isSolid: (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 ? true : isSolid(w.get(x, y, z))),
  };
  return w;
}
export function makeHouse(seed) {
  const w = standIn(seed);
  houseLand(w, { id: 'house', size: SIZE });
  return w;
}

// Stand cells: air at y and y + 1, solid below. Walking graph: 4-neighbours at the same level, up 1 (air at start y + 2), down any height
// (a fall; the landing is the first stand cell below). `opts.block(x, y, z)` marks cells as walls (the secrets), `opts.lift` and
// `opts.extra` add edges. Returns { seen: Set of 'x,y,z', stand(x, y, z) }.
export function walkGraph(w, opts = {}) {
  const solid = (x, y, z) => w.isSolid(x, y, z) || !!opts.block?.(x, y, z);
  const standOk = (x, y, z) => y >= 1 && !solid(x, y, z) && !solid(x, y + 1, z) && solid(x, y - 1, z);
  const landing = (x, y, z) => { for (let yy = y; yy >= 1; yy--) { if (solid(x, yy - 1, z)) return solid(x, yy, z) || solid(x, yy + 1, z) ? -1 : yy; } return -1; };
  const key = (x, y, z) => `${x},${y},${z}`;
  const neighbours = (x, y, z) => {
    const out = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= w.W || nz >= w.D) continue;
      if (standOk(nx, y, nz)) { out.push([nx, y, nz]); continue; }       // same level
      if (standOk(nx, y + 1, nz) && !solid(x, y + 2, z)) { out.push([nx, y + 1, nz]); continue; } // up 1
      if (!solid(nx, y, nz) && !solid(nx, y + 1, nz)) { const l = landing(nx, y - 1, nz); if (l > 0 && standOk(nx, l, nz)) out.push([nx, l, nz]); } // a fall
    }
    return out;
  };
  const edges = opts.edges ?? (() => []);
  return { solid, standOk, neighbours, key, edges, w };
}

export function bfs(g, starts) {
  const seen = new Map(); // key -> parent key
  const q = [];
  for (const s of starts) { const k = g.key(...s); seen.set(k, null); q.push(s); }
  while (q.length) {
    const c = q.shift();
    for (const n of [...g.neighbours(...c), ...g.edges(...c)]) {
      const k = g.key(...n);
      if (seen.has(k)) continue;
      seen.set(k, g.key(...c));
      q.push(n);
    }
  }
  return seen;
}


// ---- the analysis (pure; the spec calls it in the page for three seeds) ----
const inBox = (b, x, y, z) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && y >= b[4] && y <= b[5];
const keyOf = (x, y, z) => `${x},${y},${z}`;
const parse = k => k.split(',').map(Number);

export function analyze(seed) {
  const out = { problems: [], info: {} };
  const bad = m => out.problems.push(m);
  const t0 = Date.now();
  const w = makeHouse(seed), ms = Date.now() - t0;
  out.info.ms = ms;
  const w2 = makeHouse(seed);
  let same = true;
  for (let i = 0; i < w.data.length; i++) if (w.data[i] !== w2.data[i]) { same = false; break; }
  if (!same) bad('not deterministic');
  // only known block ids, nothing above y 47
  const used = new Set(w.data);
  const known = [...used].filter(id => id !== 0 && !(id in BLOCKS_IDS));
  if (known.length) bad(`unknown block ids ${known.join(',')}`);
  const arrive = w.arrivals.house, start = [Math.floor(arrive[0]), arrive[1], Math.floor(arrive[2])];
  if (!w.isSolid(start[0], start[1] - 1, start[2]) || w.isSolid(start[0], start[1], start[2]) || w.isSolid(start[0], start[1] + 1, start[2])) bad('arrival not standable');
  const boss = w.bosses[0];
  if (w.get(Math.floor(boss.pos[0]), boss.pos[1] - 1, Math.floor(boss.pos[2])) !== B.BOSS_STAND) bad('boss not on BOSS_STAND');
  for (const r of w.rests) if (!(w.isSolid(Math.floor(r[0]), r[1] - 1, Math.floor(r[2])) && !w.isSolid(Math.floor(r[0]), r[1], Math.floor(r[2])) && !w.isSolid(Math.floor(r[0]), r[1] + 1, Math.floor(r[2])))) bad(`rest ${r.slice(0, 3)} not standable`);
  // gadget edges
  const lift = FAN.lift;
  const edgeFan = (x, y, z) => (y === 4 && x >= lift.x[0] && x <= lift.x[1] && z >= lift.z[0] && z <= lift.z[1] ? [[x, SHELF.y[1] + 1, SHELF.z[1]]] : []);
  const sBtn = TRACK.remotes.S.button, nBtn = TRACK.remotes.N.button;
  const stopS = TRACK.stops.S.map(Math.floor), stopN = TRACK.stops.N.map(Math.floor);
  const cellS = [stopS[0], 1, stopS[2]], cellN = [stopN[0], 15, stopN[2]];
  const near = (x, y, z, b, d) => Math.hypot(x + 0.5 - b[0] - 0.5, z + 0.5 - b[2] - 0.5) <= d && Math.abs(y - b[1]) <= 3;
  const edgeTrain = (x, y, z) => { const o = []; if (near(x, y, z, sBtn, 4.5)) o.push(cellN); if (near(x, y, z, nBtn, 4.5)) o.push(cellS); return o; };
  const edgeCap = (x, y, z) => { const o = []; if (y === 30 && z >= 14 && z <= 16 && x >= 49 && x <= 51) o.push([99, 31, 15]); if (y === 30 && z >= 14 && z <= 16 && x >= 96 && x <= 97) o.push([47, 29, 15]); return o; };
  const allEdges = (x, y, z) => [...edgeFan(x, y, z), ...edgeTrain(x, y, z), ...edgeCap(x, y, z)];
  const g = walkGraph(w, { edges: allEdges });
  const seen = bfs(g, [start]);
  out.info.cells = seen.size;
  const reach = (seenSet, x, y, z, d = 1.2) => { for (const k of seenSet.keys()) { const [cx, cy, cz] = parse(k); if (Math.abs(cx + 0.5 - x) <= d && Math.abs(cz + 0.5 - z) <= d && Math.abs(cy - y) <= 3) return true; } return false; };
  const reachAny = (seenSet, x, y, z, d) => { for (const k of seenSet.keys()) { const [cx, cy, cz] = parse(k); if (Math.hypot(cx + 0.5 - x, cz + 0.5 - z) <= d && Math.abs(cy - y) <= 4) return true; } return false; };
  // the Boss rest, crumbs (within 4), nooks (within 7), controls (within 4.5), the way back
  if (!seen.has(keyOf(Math.floor(boss.rest[0]), boss.rest[1], Math.floor(boss.rest[2])))) bad('boss rest not reached');
  CRUMBS.forEach((c, i) => { if (!reachAny(seen, c[0] + 0.5, c[1], c[2] + 0.5, 4)) bad(`crumb ${i} not reached`); });
  for (const n of w.nooks) if (!reachAny(seen, n.x + 0.5, n.y, n.z + 0.5, 7)) bad(`nook ${n.kind} ${n.x},${n.y},${n.z} too far from any stand cell`);
  const controls = [];
  for (let x = 0; x < w.W; x++) for (let z = 0; z < w.D; z++) for (let y = 0; y < 40; y++) { const id = w.get(x, y, z); if (id === B.FAN_SWITCH || id === B.REMOTE_BUTTON || id === B.TAP_HANDLE) controls.push([x, y, z, id]); }
  out.info.controls = controls.length;
  for (const [x, y, z] of controls) if (!reachAny(seen, x + 0.5, y, z + 0.5, 4.5)) bad(`control ${x},${y},${z} not reachable`);
  if (!seen.has(keyOf(Math.floor(w.arrivals.house[0]), w.arrivals.house[1], Math.floor(w.arrivals.house[2])))) bad('way back stand');
  // 4. the boss by each route with the other ways closed
  const bossKey = keyOf(Math.floor(boss.rest[0]), boss.rest[1], Math.floor(boss.rest[2]));
  const closedSecrets = (x, y, z) => SECRETS.some(s => inBox(s.box, x, y, z));
  const benchBox = [56, 135, 84, 97, 13, 26], rampBox = [136, 165, 89, 95, 1, 17];
  const route = (label, o) => {
    const gg = walkGraph(w, { block: o.block, edges: o.edges ?? (() => []) });
    const sn = bfs(gg, [start]);
    out.info[label] = sn.has(bossKey);
    if (!sn.has(bossKey)) bad(`boss not reached: ${label}`);
    return sn;
  };
  route('walkRamp', { block: closedSecrets });
  route('fan', { block: (x, y, z) => closedSecrets(x, y, z) || inBox(benchBox, x, y, z), edges: edgeFan });
  route('train', { block: (x, y, z) => closedSecrets(x, y, z) || (inBox(rampBox, x, y, z) && !(x >= 136 && x <= 137 && false)), edges: edgeTrain });
  // 5. the secret ways
  { const gg = walkGraph(w, { block: (x, y, z) => !inBox([1, 3, 80, 150, 1, 38], x, y, z) });
    const sn = bfs(gg, [[3, 1, 148]]);
    out.info.mouseHole = sn.has(keyOf(3, 34, 82)) || sn.has(keyOf(3, 34, 83));
    if (!out.info.mouseHole) bad('mouse hole does not lead to the shelf'); }
  { // only the room and the counter top above it exist: from the keyhole to the counter top (no shelf, no fan, no spoon)
    const gg = walkGraph(w, { block: (x, y, z) => !(inBox([CUPBOARD_ROOM.x[0], CUPBOARD_ROOM.x[1], 6, 27, 1, 30], x, y, z) || (y >= 31 && x >= 98 && x <= 125 && z >= 4 && z <= 27)) });
    const sn = bfs(gg, [[110, 1, 26]]);
    out.info.keyhole = sn.has(keyOf(HATCH.x[1] + 1, 31, 6)) && sn.has(keyOf(HATCH.x[1] + 1, 31, 7));
    if (!out.info.keyhole) bad('keyhole does not lead to the counter'); }
  // 3b. nobody stuck: every reached cell gets back to the arrival (reverse edges)
  { const back = new Map();
    for (const k of seen.keys()) { const c = parse(k); for (const n of [...g.neighbours(...c), ...allEdges(...c)]) { const nk = keyOf(...n); if (!back.has(nk)) back.set(nk, []); back.get(nk).push(k); } }
    const ok = new Set([keyOf(...start)]), q = [keyOf(...start)];
    while (q.length) { const k = q.shift(); for (const p of back.get(k) || []) if (!ok.has(p)) { ok.add(p); q.push(p); } }
    const stuck = [...seen.keys()].filter(k => !ok.has(k));
    out.info.stuck = stuck.length;
    if (stuck.length) bad(`${stuck.length} cells cannot get back to the arrival, e.g. ${stuck.slice(0, 5).join(' | ')}`); }
  // 4b. the cat's tail: open strip with the tail cells AIR, closed with them solid
  { const tails = CAT.tailUp;
    for (const [x0, x1, z0, z1, y0, y1] of tails) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) if (w.get(x, y, z) !== B.AIR) bad(`tail cell ${x},${y},${z} is not air`);
    const fromN = [[cellN[0], 15, cellN[2]]];
    const open = bfs(walkGraph(w, { block: closedSecrets }), fromN);
    const closed = bfs(walkGraph(w, { block: (x, y, z) => closedSecrets(x, y, z) || tails.some(([x0, x1, z0, z1, y0, y1]) => inBox([x0, x1, z0, z1, y0, y1], x, y, z)) }), fromN); // the secret ways go round the cat on purpose
    const books = keyOf(70, 15, 87);
    out.info.stripOpen = open.has(books); out.info.stripClosed = !closed.has(books);
    if (!open.has(books)) bad('strip not open with the tail down');
    if (closed.has(books)) bad('strip not closed with the tail up (another way round the cat?)'); }
  // nooks: an air cell with solid below
  if (w.nooks.length !== 22) bad(`${w.nooks.length} nooks`);
  for (const n of w.nooks) if (w.isSolid(n.x, n.y, n.z) || !w.isSolid(n.x, n.y - 1, n.z)) bad(`nook ${n.kind} ${n.x},${n.y},${n.z} not an air cell on something solid`);
  if (w.lifts.length) bad('lifts not empty at the start');
  if (!w.parts.some(p => p.id === 'house' && p.live === 'house')) bad('no house part');
  // keeps: every control and way cell lies in a keep; the open floor does not
  const keep = (x, y, z) => w.keeps.some(k => k.protect.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1));
  for (const [x, y, z] of controls) if (!keep(x, y, z)) bad(`control ${x},${y},${z} not in a keep`);
  if (keep(100, 1, 140)) bad('the open floor is a keep');
  return { out, w, g, seen, start, controls };
}
const BLOCKS_IDS = Object.fromEntries(Object.keys(BLOCKS).map(k => [k, 1]));

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('housecheck.mjs')) {
  const seed = Number(process.argv[2] ?? 1);
  const { out } = analyze(seed);
  console.log(JSON.stringify(out.info));
  console.log(out.problems.length ? out.problems.join('\n') : 'no problems');
}
