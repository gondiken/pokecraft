// T40a: the Giant House checks that need no browser: a stand-in world for houseLand (like the dream spec's), and a walk graph
// (BFS over stand cells with the gadget edges). Used by tests/specs/tiny.mjs (in the page, through /tests/housecheck.mjs) and run
// by hand with `node tests/housecheck.mjs [seed]`.
import { B, BLOCKS, isSolid } from '../src/blocks.js';
import { houseLand, SIZE, COUNTER, CAN_COLUMNS, CAN_STAND, CUPBOARD_ROOM, HATCH, SHELF, FAN, TRACK, CAT, SECRETS, MOUSE_HOLE, CRUMBS, SEESAW, FORT, SINK, GROOVE } from '../src/giantland.js';

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
// (a fall; the landing is the first stand cell below). `opts.block(x, y, z)` marks cells as walls (the secrets), `opts.open(x, y, z)`
// as air (the cat's cells while it is away, the fort's back door), `opts.edges` adds edges. Returns { seen: Set of 'x,y,z', stand(x, y, z) }.
export function walkGraph(w, opts = {}) {
  const solid = (x, y, z) => (w.isSolid(x, y, z) && !opts.open?.(x, y, z)) || !!opts.block?.(x, y, z);
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
  // gadget edges (T40a.5: the train to the fan, the fan's wind, the cap on the wet river, the spoon's fling)
  const lift = FAN.lift;
  const edgeFan = (x, y, z) => (y === 4 && x >= lift.x[0] && x <= lift.x[1] && z >= lift.z[0] && z <= lift.z[1] ? [[x, SHELF.y[1] + 1, SHELF.z[1]]] : []);
  const sBtn = TRACK.remotes.S.button, nBtn = TRACK.remotes.N.button;
  const stopS = TRACK.stops.S.map(Math.floor), stopN = TRACK.stops.N.map(Math.floor);
  const cellS = [stopS[0], 1, stopS[2]], cellN = [stopN[0], 1, stopN[2]];
  const near = (x, y, z, b, d) => Math.hypot(x + 0.5 - b[0] - 0.5, z + 0.5 - b[2] - 0.5) <= d && Math.abs(y - b[1]) <= 3;
  const edgeTrain = (x, y, z) => { const o = []; if (near(x, y, z, sBtn, 4.5)) o.push(cellN); if (near(x, y, z, nBtn, 4.5)) o.push(cellS); return o; };
  const inGroove = (x, z) => z >= GROOVE.z[0] && z <= GROOVE.z[1] && x >= GROOVE.x[0] && x <= GROOVE.x[1];
  const edgeCap = (x, y, z) => { // the cap boards in the wet groove's west end (you swim to it from the counter) and leaves you on the counter east
    const o = [];
    if (y >= GROOVE.floor && y <= 31 && inGroove(x, z) && x <= 52) o.push([99, 31, 15]);
    if (y === 31 && x >= 47 && x <= 50 && z >= GROOVE.z[0] - 1 && z <= GROOVE.z[1] + 1) o.push([99, 31, 15]); // stepping off the rim into the water
    return o;
  };
  const ss = SEESAW, landCell = [Math.floor(ss.land[0]), ss.land[1], Math.floor(ss.land[2])];
  const edgeFling = (x, y, z) => (y === 26 && Math.hypot(x + 0.5 - ss.bowl[0], z + 0.5 - ss.bowl[2]) <= ss.bowlR ? [landCell] : []);
  const catCell = (x, y, z) => x >= CAT.cells.x[0] && x <= CAT.cells.x[1] && z >= CAT.cells.z[0] && z <= CAT.cells.z[1] && y <= CAT.cells.top && y >= 29;
  const door = FORT.door, doorCell = (x, y, z) => x >= door.x[0] && x <= door.x[1] && z >= door.z[0] && z <= door.z[1] && y >= door.y[0] && y <= door.y[1];
  const allEdges = (x, y, z) => [...edgeFan(x, y, z), ...edgeTrain(x, y, z), ...edgeCap(x, y, z), ...edgeFling(x, y, z)];
  const catAway = (x, y, z) => catCell(x, y, z) && w.get(x, y, z) === B.HOUSE_PROP;
  const g = walkGraph(w, { edges: allEdges, open: (x, y, z) => catAway(x, y, z) || doorCell(x, y, z) });
  const seen = bfs(g, [start]);
  out.info.cells = seen.size;
  const reachAny = (seenSet, x, y, z, d) => { for (const k of seenSet.keys()) { const [cx, cy, cz] = parse(k); if (Math.hypot(cx + 0.5 - x, cz + 0.5 - z) <= d && Math.abs(cy - y) <= 4) return true; } return false; };
  // the Boss rest, crumbs (within 4), nooks (within 7), controls (within 4.5), the way back
  const bossKey = keyOf(Math.floor(boss.rest[0]), boss.rest[1], Math.floor(boss.rest[2]));
  if (!seen.has(bossKey)) bad('boss rest not reached with every puzzle solved');
  CRUMBS.forEach((c, i) => { if (!reachAny(seen, c[0] + 0.5, c[1], c[2] + 0.5, 4)) bad(`crumb ${i} not reached`); });
  for (const n of w.nooks) if (!reachAny(seen, n.x + 0.5, n.y, n.z + 0.5, 7)) bad(`nook ${n.kind} ${n.x},${n.y},${n.z} too far from any stand cell`);
  const controls = [];
  for (let x = 0; x < w.W; x++) for (let z = 0; z < w.D; z++) for (let y = 0; y < 40; y++) { const id = w.get(x, y, z); if (id === B.REMOTE_BUTTON || id === B.TAP_HANDLE) controls.push([x, y, z, id]); }
  for (const c of [...FAN.key.cells, SINK.plug.rim, CAT.yarn.cell]) controls.push([...c, B.HOUSE_PROP]);
  controls.push([ss.stack.x[0] + 1, 26, ss.stack.z[1] + 1, 0]); // beside the marble's stack (Roll! is a near word: within 3 of it)
  out.info.controls = controls.length;
  for (const [x, y, z] of controls) if (!reachAny(seen, x + 0.5, y, z + 0.5, 4.5)) bad(`control ${x},${y},${z} not reachable`);
  if (!seen.has(keyOf(Math.floor(w.arrivals.house[0]), w.arrivals.house[1], Math.floor(w.arrivals.house[2])))) bad('way back stand');
  // 4. every puzzle is needed (secrets closed): the Boss is reached with all four, and not with any one left out
  const closedSecrets = (x, y, z) => SECRETS.some(s => inBox(s.box, x, y, z));
  const route = (label, { fan = true, cap = true, cat = true, fling = true, secrets = false }) => {
    const ed = (x, y, z) => [...edgeTrain(x, y, z), ...(fan ? edgeFan(x, y, z) : []), ...(cap ? edgeCap(x, y, z) : []), ...(fling ? edgeFling(x, y, z) : [])];
    const gg = walkGraph(w, { block: secrets ? null : closedSecrets, edges: ed, open: cat ? catAway : null });
    const ok = bfs(gg, [start]).has(bossKey);
    out.info[label] = ok;
    return ok;
  };
  if (!route('all4', {})) bad('the Boss is not reached with the four puzzles and the secrets closed');
  if (route('noFan', { fan: false })) bad('the Boss is reached without the fan');
  if (route('noCap', { cap: false })) bad('the Boss is reached without the water (the dry groove is a way?)');
  if (route('noCat', { cat: false })) bad('the Boss is reached past the sleeping cat');
  if (route('noFling', { fling: false })) bad('the Boss is reached without the spoon (a way into the fort?)');
  if (!route('mouseNoFan', { fan: false, secrets: true })) bad('the mouse hole does not skip the fan');
  // 5. the secret ways
  { const gg = walkGraph(w, { block: (x, y, z) => !inBox([1, 3, MOUSE_HOLE.tunnel.z[0] - 2, MOUSE_HOLE.tunnel.z[1] + 1, 1, 38], x, y, z) });
    const sn = bfs(gg, [[3, 1, MOUSE_HOLE.door.z[0]]]);
    out.info.mouseHole = sn.has(keyOf(3, 34, MOUSE_HOLE.exit.z[0])) || sn.has(keyOf(3, 34, MOUSE_HOLE.exit.z[1]));
    if (!out.info.mouseHole) bad('mouse hole does not lead to the shelf'); }
  { // only the room and the counter top above it exist: from the keyhole to the counter top (no shelf, no fan, no books)
    const gg = walkGraph(w, { block: (x, y, z) => !(inBox([CUPBOARD_ROOM.x[0], CUPBOARD_ROOM.x[1], 6, 27, 1, 30], x, y, z) || (y >= 31 && x >= 98 && x <= 125 && z >= 4 && z <= 27)) });
    const sn = bfs(gg, [[110, 1, 26]]);
    out.info.keyhole = sn.has(keyOf(HATCH.x[1] + 1, 31, 6)) && sn.has(keyOf(HATCH.x[1] + 1, 31, 7));
    if (!out.info.keyhole) bad('keyhole does not lead to the counter'); }
  // 3b. nobody stuck: every reached cell gets back to the arrival (reverse edges; the cat away, the back door open from inside)
  { const back = new Map();
    for (const k of seen.keys()) { const c = parse(k); for (const n of [...g.neighbours(...c), ...allEdges(...c)]) { const nk = keyOf(...n); if (!back.has(nk)) back.set(nk, []); back.get(nk).push(k); } }
    const ok = new Set([keyOf(...start)]), q = [keyOf(...start)];
    while (q.length) { const k = q.shift(); for (const p of back.get(k) || []) if (!ok.has(p)) { ok.add(p); q.push(p); } }
    const stuck = [...seen.keys()].filter(k => !ok.has(k));
    out.info.stuck = stuck.length;
    if (stuck.length) bad(`${stuck.length} cells cannot get back to the arrival, e.g. ${stuck.slice(0, 5).join(' | ')}`); }
  // 4b. the dry groove: in it you cannot get out at the east end, only back up the steps by the sink
  { const gg = walkGraph(w, { block: closedSecrets }); // (the keyhole is a way round from the floor, on purpose)
    const sn = bfs(gg, [[70, GROOVE.floor, 15]]);
    out.info.dryStuckEast = !sn.has(keyOf(99, 31, 15));
    out.info.dryBack = sn.has(keyOf(47, 29, 15));
    if (!out.info.dryStuckEast) bad('the dry groove leads east');
    if (!out.info.dryBack) bad('no way back out of the dry groove'); }
  // 4c. the fort: closed from outside (the door is sugar), open from inside
  { const inFort = (x, z) => Math.hypot(x + 0.5 - FORT.c[0], z + 0.5 - FORT.c[1]) < FORT.r[0];
    for (let x = door.x[0]; x <= door.x[1]; x++) for (let z = door.z[0]; z <= door.z[1]; z++) for (let y = door.y[0]; y <= door.y[1]; y++) if (!w.isSolid(x, y, z)) bad(`fort door ${x},${y},${z} not built`);
    if (!inFort(Math.floor(landCell[0]), Math.floor(landCell[2]))) bad('the fling lands outside the fort'); }
  // the cat cells are hidden props over the top steps; the yarn and the plug too
  { let n = 0; for (let x = CAT.cells.x[0]; x <= CAT.cells.x[1]; x++) for (let z = CAT.cells.z[0]; z <= CAT.cells.z[1]; z++) for (let y = 29; y <= CAT.cells.top; y++) if (w.get(x, y, z) === B.HOUSE_PROP) n++;
    out.info.catCells = n;
    if (n < 100) bad(`only ${n} cat cells`);
    if (w.get(...SINK.plug.rim) !== B.HOUSE_PROP || w.get(...CAT.yarn.cell) !== B.HOUSE_PROP || FAN.key.cells.some(c => w.get(...c) !== B.HOUSE_PROP)) bad('plug / yarn / key cells'); }
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
