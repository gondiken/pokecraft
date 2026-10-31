// Wave 19 stage B: the Wizard's Tower checks that need no browser: the floors as data, the painting rules with bots (a naive kid must fail, a skilled
// one must win), the terrain on a stand-in world (walk graph: no way up with the stairs doors closed, exactly floors 1..k + 1 with doors 1..k open),
// the painter's cast from the mat, and the bridge's star rules. Used by tests/specs/wizard.mjs (in Node and in the page through /tests/wizardcheck.mjs)
// and run by hand with `node tests/wizardcheck.mjs`.
import { B, BLOCKS, WOOL, isSolid } from '../src/blocks.js';
import { PAINTS } from '../src/custom.js';
import { FLOORS, targetOf, checkCanvas, startCells, squaresToPaint, groupCount, palette, finishedCells, floorKey, wizardTeam, WIZARD_TEAM, HINT, towerOpen, towerStand, towerAim } from '../src/wizardtower.js';
import { wizardLand, wizardAim, layoutOf, cast, slabOf, floorAt, TOWER, SIZE, REACH, MAT, POTS } from '../src/wizardland.js';
import { walkGraph, bfs } from './housecheck.mjs';

export const WORLD_H = 48;
export function standIn(seed = 1, [W, D] = [SIZE, SIZE]) {
  const w = {
    W, D, seed, data: new Uint8Array(W * D * WORLD_H), ground: new Uint8Array(W * D),
    index: (x, y, z) => x + W * (z + D * y),
    inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < WORLD_H,
    get: (x, y, z) => (w.inBounds(x, y, z) ? w.data[x + W * (z + D * y)] : B.AIR),
    isSolid: (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 ? true : isSolid(w.get(x, y, z))),
  };
  return w;
}
export function makeTower(seed = 1) { const w = standIn(seed); wizardLand(w, { id: 'wizard', size: [SIZE, SIZE] }); return w; }

/* ---- the painting rules with bots ---- */
// A seeded random (mulberry32): the bots never use Math.random.
export function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// One tap on a pot (-1 = wash jar .. 11) or a square: the game's own rules (studiolive.js does the same on the live canvas).
export function tapPot(st, i) { st.brush = i; }
export function tapSquare(st, floor, i) {
  if (st.brush === null || st.brush === undefined) return false;
  if (targetOf(floor)[i].kind === 'given') return false;
  st.cells[i] = st.brush; // the wash jar's -1 puts the square back to blank canvas
  return true;
}
export const newState = floor => ({ cells: startCells(floor), brush: null, taps: 0 });
// The naive kid: taps anything, at random.
export function naive(floor, seed, taps = 600) {
  const r = rng(seed), st = newState(floor);
  for (let k = 0; k < taps; k++) {
    st.taps++;
    if (r() < 0.5) tapPot(st, Math.floor(r() * (PAINTS.length + 1)) - 1); else tapSquare(st, floor, Math.floor(r() * st.cells.length));
    if (checkCanvas(floor, st.cells).done) return { done: true, taps: st.taps };
  }
  return { done: false, taps: st.taps };
}
// Paints every square one colour (the "obvious shortcut").
export function oneColour(floor, paint, taps = 600) {
  const st = newState(floor);
  tapPot(st, paint);
  for (let k = 0; k < taps; k++) { tapSquare(st, floor, k % st.cells.length); if (checkCanvas(floor, st.cells).done) return { done: true }; }
  return { done: false };
}
// The skilled kid: reads the picture, dips each paint once, paints its squares. Free groups get random paints (seeded). -> taps used.
export function skilled(floor, seed = 1) {
  const r = rng(seed), T = targetOf(floor), st = newState(floor), pick = [];
  for (let g = 0; g < groupCount(floor); g++) pick[g] = Math.floor(r() * PAINTS.length);
  const want = T.map(t => (t.kind === 'paint' ? t.paint : t.kind === 'group' ? pick[t.group] : -2));
  const byPaint = new Map();
  want.forEach((p, i) => { if (p >= 0 && T[i].kind !== 'given') (byPaint.get(p) ?? byPaint.set(p, []).get(p)).push(i); });
  for (const [p, list] of byPaint) { tapPot(st, p); st.taps++; for (const i of list) { tapSquare(st, floor, i); st.taps++; } }
  return { done: checkCanvas(floor, st.cells).done, taps: st.taps, paints: byPaint.size, squares: squaresToPaint(floor), cells: st.cells };
}

/* ---- the walk graph with the stairs doors in a given state ---- */
const keyOf = (x, y, z) => `${x},${y},${z}`;
const parse = k => k.split(',').map(Number);
// doorsOpen = 0 (all shut) .. 4 (all open): door n is open when n <= doorsOpen. Jumps: up 1, or across up to 3 at the same level or lower.
export function graphOf(w, doorsOpen = 0) {
  const openCells = new Set();
  for (const d of w.studio.doors) if (d.n <= doorsOpen) for (const c of d.cells) openCells.add(keyOf(...c));
  const g = walkGraph(w, { open: (x, y, z) => openCells.has(keyOf(x, y, z)) });
  g.edges = (x, y, z) => {
    const out = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = 2; d <= 4; d++) {
      const tx = x + dx * d, tz = z + dz * d;
      let clear = true;
      for (let k = 1; k < d; k++) if (g.solid(x + dx * k, y, z + dz * k) || g.solid(x + dx * k, y + 1, z + dz * k) || g.solid(x + dx * k, y + 2, z + dz * k)) clear = false;
      if (!clear) continue;
      if (g.standOk(tx, y, tz)) out.push([tx, y, tz]);
      if (g.standOk(tx, y + 1, tz) && !g.solid(tx, y + 2, tz) && !g.solid(x, y + 2, z)) out.push([tx, y + 1, tz]); // a jump up 1 (1.25) and across
    }
    return out;
  };
  return g;
}
const at = p => [Math.floor(p[0]), Math.round(p[1]), Math.floor(p[2])];
export const EYE = 1.62; // Player.eye

// A segment from the eye to a point is not blocked by a solid cell (except the cell the point is in).
function clearLine(w, o, p, skip) {
  const n = Math.ceil(Math.hypot(p.x - o.x, p.y - o.y, p.z - o.z) / 0.04);
  for (let k = 1; k < n; k++) {
    const x = o.x + (p.x - o.x) * k / n, y = o.y + (p.y - o.y) * k / n, z = o.z + (p.z - o.z) * k / n;
    const c = [Math.floor(x), Math.floor(y), Math.floor(z)];
    if (skip && c[0] === skip[0] && c[1] === skip[1] && c[2] === skip[2]) continue;
    if (w.isSolid(...c)) return false;
  }
  return true;
}
const norm = (a, b) => { const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, l = Math.hypot(d.x, d.y, d.z); return { x: d.x / l, y: d.y / l, z: d.z / l }; };

// Everything about the data and the terrain that needs no browser.
export function analyze(seed = 1) {
  const out = { problems: [], info: {} };
  const bad = m => out.problems.push(m);
  // 1. the floors as data
  const expect = [12, 26, 14, 24, 34];
  FLOORS.forEach((f, k) => {
    if (f.n !== k + 1 || f.rows.length !== f.h || f.rows.some(r => r.length !== f.w)) bad(`floor ${f.n}: size`);
    const T = targetOf(f);
    if (T.some(t => t.kind === 'bad')) bad(`floor ${f.n}: an unknown code`);
    if (f.mirror) { // an exact mirror: a given (capital) on one side = the same paint (small) on the other; blanks and free groups mirror too
      f.rows.forEach((row, r) => { for (let c = 0; c < f.w; c++) {
        const a = row[c], b = row[f.w - 1 - c];
        const okc = a === '.' || (a >= '1' && a <= '9') ? a === b : a >= 'A' && a <= 'Z' ? b === a.toLowerCase() : b === a.toUpperCase();
        if (!okc) bad(`floor ${f.n}: row ${r} col ${c} is not a mirror (${a} / ${b})`);
      } });
    }
    if (squaresToPaint(f) !== expect[k]) bad(`floor ${f.n}: ${squaresToPaint(f)} squares to paint, not ${expect[k]}`);
    if (!checkCanvas(f, finishedCells(f)).done) bad(`floor ${f.n}: its finished picture is not done`);
    if (checkCanvas(f, startCells(f)).done) bad(`floor ${f.n}: a blank canvas is done`);
    if (f.palette && (groupCount(f) !== 3 || !palette(f, finishedCells(f, [1, 2, 3])))) bad(`floor ${f.n}: palette`);
    if (!f.palette && palette(f, finishedCells(f))) bad(`floor ${f.n}: a palette without the flag`);
  });
  out.info.squares = FLOORS.map(squaresToPaint).join();
  // 2. the checker on one floor: the target is done, one square changed is not done and is wrong, free groups with two paints are not done
  for (const f of FLOORS) {
    const T = targetOf(f), fin = finishedCells(f, [3, 4, 5]);
    const one = T.findIndex(t => t.kind === 'paint');
    if (one >= 0) { const c = [...fin]; c[one] = (c[one] + 1) % PAINTS.length; const r = checkCanvas(f, c); if (r.done || !r.wrong.includes(one)) bad(`floor ${f.n}: a changed square is not wrong`); }
    const blank = T.findIndex(t => t.kind === 'blank');
    if (blank >= 0) { const c = [...fin]; c[blank] = 0; const r = checkCanvas(f, c); if (r.done || !r.wrong.includes(blank)) bad(`floor ${f.n}: a painted blank square is not wrong`); }
    const members = T.map((t, i) => (t.kind === 'group' && t.group === 0 ? i : -1)).filter(i => i >= 0);
    if (members.length > 2) {
      const c = [...fin]; c[members[0]] = 9; const r = checkCanvas(f, c);
      if (r.done || r.wrong.join() !== String(members[0]) || r.groups[0] !== null) bad(`floor ${f.n}: the minority of a group is not the one listed (${r.wrong})`);
      const c2 = [...fin]; for (const i of members) c2[i] = 7; if (!checkCanvas(f, c2).done) bad(`floor ${f.n}: any one paint should do for a group`);
      const c3 = [...startCells(f)]; c3[members[0]] = 5; const r3 = checkCanvas(f, c3); if (r3.wrong.length) bad(`floor ${f.n}: a group still being painted is wrong`);
    }
    const empty = checkCanvas(f, startCells(f)); if (empty.wrong.length) bad(`floor ${f.n}: empty squares are never wrong`);
  }
  // 3. bots: the naive kid never finishes floors 2-5 (floor 1 in under 1 % of 200 seeds), one colour never, the skilled kid always
  let finished1 = 0;
  const naiveDone = [0, 0, 0, 0, 0];
  for (let s = 1; s <= 200; s++) FLOORS.forEach((f, k) => { if (naive(f, s * 7919 + k).done) naiveDone[k]++; });
  finished1 = naiveDone[0];
  out.info.naive = naiveDone.join();
  if (finished1 > 2 || naiveDone.slice(1).some(n => n > 0)) bad(`the naive bot finished floors: ${naiveDone.join()}`);
  for (const f of FLOORS) for (let p = 0; p < PAINTS.length; p++) if (oneColour(f, p).done) bad(`one colour finishes floor ${f.n}`);
  const taps = [];
  for (const f of FLOORS) {
    for (let s = 1; s <= 30; s++) {
      const r = skilled(f, s);
      if (!r.done) bad(`the skilled bot fails floor ${f.n} (seed ${s})`);
      else if (r.taps !== r.squares + r.paints) bad(`floor ${f.n}: ${r.taps} taps, not ${r.squares + r.paints}`);
      if (s === 1) taps.push(r.taps);
    }
  }
  out.info.skilledTaps = taps.join();
  // 4. the Wizard's team
  if (JSON.stringify(wizardTeam(0)) !== JSON.stringify(WIZARD_TEAM.map(m => ({ ...m })))) bad('wizardTeam(0)');
  if (wizardTeam(2)[0].level !== 92 || wizardTeam(99).some(m => m.level > 100) || wizardTeam(99)[5].level !== 100) bad('wizardTeam levels');

  // 5. the terrain
  const t0 = Date.now();
  const w = makeTower(seed), w2 = makeTower(seed);
  out.info.ms = Date.now() - t0;
  if (w.data.some((v, i) => v !== w2.data[i])) bad('terrain is not deterministic');
  const known = [...new Set(w.data)].filter(id => id !== 0 && !BLOCKS[id]);
  if (known.length) bad(`unknown block ids ${known.join(',')}`);
  if (w.data.some((v, i) => v && Math.floor(i / (SIZE * SIZE)) > 47)) bad('block above y 47');
  const S = w.studio;
  if (S.floors.length !== 5 || S.doors.length !== 4 || S.canvases.length !== 5) bad('studio data');
  // the canvas squares: Canvas Wool, the given squares already painted; pots are the paints' own wool; doors shut
  FLOORS.forEach((f, k) => {
    const c = S.canvases[k], T = targetOf(f);
    for (let r = 0; r < c.h; r++) for (let q = 0; q < c.w; q++) {
      const t = T[r * c.w + q], id = w.get(c.x0 + q, c.y0 + c.h - 1 - r, c.z);
      const want = t.kind === 'given' ? WOOL[PAINTS[t.paint].wool] : WOOL.custom;
      if (id !== want) bad(`floor ${f.n}: square ${r * c.w + q} is ${id}, not ${want}`);
    }
    for (const p of S.pots.filter(p => p.floor === f.n)) if (w.get(p.x, p.y, p.z) !== (p.i < 0 ? B.GLASS : WOOL[PAINTS[p.i].wool])) bad(`floor ${f.n}: pot ${p.i}`);
    for (const d of S.doors.filter(d => d.n === f.n)) for (const [x, y, z] of d.cells) if (w.get(x, y, z) !== B.WIZARD_STONE) bad(`floor ${f.n}: its door is not shut`);
    if (c.x0 + c.w - 1 > 27 || c.x0 < 20) bad(`floor ${f.n}: the canvas is off the middle`);
  });
  // standable places: arrival, the Wizard, every rest, the spawn, each floor's mat and the cells in front of every pot
  const g0 = graphOf(w, 0);
  const stand = (name, p) => { const c = at(p); if (!g0.standOk(...c)) bad(`${name} is not standable ${c}`); return c; };
  const arrive = stand('arrival', w.arrivals.wizard), top = stand('the studio way back', w.arrivals['wizard-top']);
  stand('spawnAt', w.spawnAt);
  for (const r of w.rests) stand('a rest spot', r);
  stand('the Wizard', [S.wizard.x, S.wizard.y, S.wizard.z]);
  const mapKeep = w.keeps.find(k => k.name === 'studio');
  if (!mapKeep || JSON.stringify(mapKeep.protect[0]) !== JSON.stringify({ x0: 0, x1: SIZE - 1, y0: 0, y1: 47, z0: 0, z1: SIZE - 1 })) bad('the keep does not cover the map');
  if (w.doors.length !== 2 || w.door !== w.doors[0]) bad('ways back');
  for (const d of w.doors) for (const [x, y, z] of d.surface) if (w.get(x, y, z) !== B.WAY_BACK) bad('way back surface');
  // 6. no way up: with every stairs door shut only floor 1 is reachable; with doors 1..k open exactly floors 1..k + 1
  const floorsReached = k => { const seen = bfs(graphOf(w, k), [arrive]), fl = new Set(); for (const key of seen.keys()) { const [x, y, z] = parse(key); fl.add(floorAt({ x: x + 0.5, y, z: z + 0.5 })); } return { seen, floors: [...fl].sort().join() }; };
  for (let k = 0; k <= 4; k++) {
    const r = floorsReached(k), want = Array.from({ length: k + 1 }, (_, i) => i + 1).join();
    if (r.floors !== want) bad(`with ${k} doors open the floors reached are ${r.floors}, not ${want}`);
    out.info[`open${k}`] = r.seen.size;
    if (k === 0) { let maxY = 0; for (const key of r.seen.keys()) maxY = Math.max(maxY, parse(key)[1]); if (maxY > TOWER.floors[0] + 2) bad(`with the doors shut you can stand at y ${maxY}`); }
  }
  // every floor's mat, canvas, pots, the stairs door, and the studio way back are reachable once the way is open
  const all = bfs(graphOf(w, 4), [arrive]);
  for (const L of S.floors) {
    const m = at([(MAT.x0 + MAT.x1 + 1) / 2, L.slab + 1, MAT.z0 + 0.5]);
    if (!all.has(keyOf(...m))) bad(`floor ${L.n}: the mat is not reachable`);
    if (L.flight) { const lp = at(L.flight.landing); if (!all.has(keyOf(...lp))) bad(`floor ${L.n}: the stairs door is not reachable (${lp})`); }
  }
  if (!all.has(keyOf(...top))) bad('the studio way back is not reachable');
  if (!all.has(keyOf(...at([S.wizard.x, S.wizard.y, S.wizard.z + 2])))) bad('the Wizard is not reachable');
  // 7. the painter's cast: from every mat cell, every square's centre and every pot is hit, with a clear line and inside the reach
  for (const L of S.floors) {
    const c = L.canvas;
    for (const mx of [MAT.x0 + 0.5, MAT.x1 + 0.5]) for (const mz of [MAT.z0 + 0.5, MAT.z1 + 0.5]) {
      const o = { x: mx, y: L.slab + 1 + EYE, z: mz };
      for (let i = 0; i < c.w * c.h; i++) {
        const p = { x: c.x0 + (i % c.w) + 0.5, y: c.y0 + (c.h - 1 - Math.floor(i / c.w)) + 0.5, z: c.z + 1 };
        const h = cast(L, o, norm(o, p));
        if (!h || h.kind !== 'square' || h.i !== i) bad(`floor ${L.n}: from the mat (${mx}, ${mz}) square ${i} gives ${JSON.stringify(h)}`);
        else if (!clearLine(w, o, p, null)) bad(`floor ${L.n}: the line to square ${i} is blocked`);
      }
      for (const pot of L.pots) {
        const p = { x: pot.x + 0.5, y: pot.y + 0.75, z: pot.z + 1 };
        const h = cast(L, o, norm(o, p));
        if (!h || h.kind !== 'pot' || h.i !== pot.i) bad(`floor ${L.n}: from the mat (${mx}, ${mz}) pot ${pot.i} gives ${JSON.stringify(h)}`);
        else if (!clearLine(w, o, p, [pot.x, pot.y, pot.z])) bad(`floor ${L.n}: the line to pot ${pot.i} is blocked`);
      }
      const away = cast(L, o, { x: 0, y: 0.2, z: 1 }); if (away) bad('a cast away from the canvas hit something');
    }
    // out of reach: far from the canvas nothing is hit
    const far = cast(L, { x: 24, y: L.slab + 1 + EYE, z: 15 + REACH + 2 }, { x: 0, y: 0, z: -1 }); if (far) bad(`floor ${L.n}: a cast beyond the reach hit ${far.kind}`);
  }
  // 8. the stairs: no flight comes out under another's hole (odd floors east, even floors west), the glass goes floor to ceiling
  for (const L of S.floors.filter(l => l.flight)) {
    const fl = L.flight;
    if (fl.east !== (L.n % 2 === 1)) bad(`floor ${L.n}: wrong side`);
    for (let y = fl.glass.y0; y <= fl.glass.y1; y++) for (let z = fl.glass.z0; z <= fl.glass.z1; z++) {
      const id = w.get(fl.wall, y, z), dc = z >= fl.door.z0 && y <= fl.door.y1 + 1; // the door and its gold frame
      if (!dc && id !== B.GLASS) bad(`floor ${L.n}: glass wall hole at y ${y} z ${z}`);
    }
    for (let y = fl.pane.y0; y <= fl.pane.y1; y++) for (const x of fl.xs) if (w.get(x, y, 21) !== B.GLASS) bad(`floor ${L.n}: glass pane hole`);
    for (const s of fl.steps) for (const x of s.x) if (!w.isSolid(x, s.y, s.z)) bad(`floor ${L.n}: a step is missing`);
    const next = S.floors[L.n];
    for (let z = 23; z <= 29; z++) for (const x of fl.xs) if (w.isSolid(x, fl.hole.y0, z)) bad(`floor ${L.n + 1}: the stair hole is closed`);
    if (next.flight && next.flight.east === fl.east) bad(`floor ${L.n}: the flight above is on the same side`);
  }
  return out;
}

/* ---- the star bridge's rules (the shipped closed state is checked in a fresh process by the spec's `closed` and `bridge` parts) ---- */
export async function bridgeRules() {
  const pw = await import('../src/pictureworlds.js');
  const out = { problems: [] };
  const bad = m => out.problems.push(m);
  const need = pw.bridgeNeed().map(w => w.id);
  if (need.length !== pw.BRIDGE_WORLDS.filter(w => !w.removed).length) bad(`bridgeNeed ${need.length}`);
  if (pw.bridgeDone([])) bad('bridgeDone with no stars');
  if (!pw.bridgeDone(need)) bad('bridgeDone with every needed star');
  if (pw.bridgeDone(need.slice(1))) bad('bridgeDone one star short');
  if (!pw.bridgeDone([...need, 'nonsense'])) bad('junk ids matter');
  const game = { stars: [], studio: { ally: true } };
  if (!towerOpen(game)) bad('an ally keeps the door open');
  if (towerOpen({ stars: need.slice(1) })) bad('the tower is open one star short');
  if (!towerOpen({ stars: need })) bad('the tower is shut with every needed star');
  out.need = need.length;
  return out;
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const r = analyze(Number(process.argv[2]) || 1);
  const b = await bridgeRules();
  console.log(JSON.stringify(r.info));
  console.log(r.problems.length || b.problems.length ? `PROBLEMS:\n  ${[...r.problems, ...b.problems].join('\n  ')}` : 'ok: no problems');
  process.exit(r.problems.length || b.problems.length ? 1 : 0);
}
