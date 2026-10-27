// T45: the Sketchbook terrain checks that need no browser: a stand-in world for doodleLand and a walk graph (the housecheck.mjs one)
// with the drawn lines as extra solid cells. Used by tests/specs/doodle.mjs (in the page, through /tests/doodlecheck.mjs) and run by hand
// with `node tests/doodlecheck.mjs [seed]`.
import { B, isSolid } from '../src/blocks.js';
import { doodleLand, doodleLines, PAGES, TOWER, SIZE, LINES } from '../src/doodleland.js';
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
export function makeDoodle(seed) {
  const w = standIn(seed);
  doodleLand(w, { id: 'doodle', size: [SIZE, SIZE] });
  return w;
}
const rectGap = (a, b) => Math.max(0, a.x0 - b.x1 - 1, b.x0 - a.x1 - 1, a.z0 - b.z1 - 1, b.z0 - a.z1 - 1);
const keyOf = (x, y, z) => `${x},${y},${z}`;
const inBox = (b, x, y, z) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1;

// The walk graph with lines 1..k drawn (their ink cells solid).
export function graphWith(w, k) {
  const ink = new Set();
  for (const l of w.doodle.lines.slice(0, k)) for (const c of l.line.cells) ink.add(keyOf(c.x, c.y, c.z));
  return walkGraph(w, { block: (x, y, z) => ink.has(keyOf(x, y, z)) });
}

export function analyze(seed) {
  const out = { problems: [], info: {} };
  const bad = m => out.problems.push(m);
  const t0 = Date.now();
  const w = makeDoodle(seed);
  out.info.ms = Date.now() - t0;
  const D = w.doodle, lines = D.lines;
  // pages: gaps of at least 6 between any two (no sprint jump reaches across: the T36.5 reach is 4 flat)
  const ids = Object.keys(PAGES);
  let minGap = 99;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const g = rectGap(PAGES[ids[i]], PAGES[ids[j]]); minGap = Math.min(minGap, g); if (g < 6) bad(`pages ${ids[i]} and ${ids[j]} are only ${g} apart`); }
  out.info.minGap = minGap;
  // every page top is grass at its top row and every page is inside the map
  for (const [id, p] of Object.entries(PAGES)) { if (w.get(Math.floor((p.x0 + p.x1) / 2), p.top, p.z0 + 2) !== B.GRASS && w.get(Math.floor((p.x0 + p.x1) / 2), p.top, p.z0 + 2) === B.AIR) bad(`page ${id} has no top`); if (p.x0 < 3 || p.z0 < 3 || p.x1 > SIZE - 4 || p.z1 > SIZE - 4) bad(`page ${id} is not inside the map`); }
  // every line: cells in order, each at most 1 above the one before (and the same two-wide strip), free air 3 high where there is no page, a start on its page, an end on the next
  out.info.lines = [];
  for (const l of lines) {
    const cs = l.line.cells;
    let maxUp = 0, maxDown = 0, blocked = 0;
    for (let i = 1; i < cs.length; i++) { const dy = cs[i].y - cs[i - 1].y; maxUp = Math.max(maxUp, dy); maxDown = Math.min(maxDown, dy); }
    for (const c of cs) for (let k = 1; k <= 3; k++) if (w.get(c.x, c.y + k, c.z) !== B.AIR) blocked++;
    const first = cs[0], last = cs[cs.length - 1];
    const startOn = w.get(first.x, first.y, first.z) !== B.AIR, endOn = w.get(last.x, last.y, last.z) !== B.AIR;
    out.info.lines.push({ n: l.n, kind: l.kind, len: Math.round(l.line.len * 10) / 10, cells: cs.length, maxUp, stars: l.line.stars.length });
    if (maxUp > 1) bad(`line ${l.n} climbs ${maxUp} at once`);
    if (maxDown < -2) bad(`line ${l.n} drops ${maxDown} at once`);
    if (blocked) bad(`line ${l.n} has ${blocked} blocked cells above it`);
    if (!startOn) bad(`line ${l.n} does not start on a page`);
    if (!endOn) bad(`line ${l.n} does not end on a page`);
    if (l.padCells.length < 4) bad(`line ${l.n} has only ${l.padCells.length} pad cells`);
    if (l.kind === 'race' && l.line.stars.length < 1) bad(`race line ${l.n} has no star dots`);
  }
  // reachability: from the arrival, with lines 1..k drawn you reach pad k + 1 and not the next one; the Desk only after all eight
  const arr = w.arrivals.doodle, start = [Math.floor(arr[0]), Math.floor(arr[1]), Math.floor(arr[2])];
  const boss = w.bosses[0].rest, bossCell = [Math.floor(boss[0]), Math.floor(boss[1]), Math.floor(boss[2])];
  const deck = [TOWER.cx, TOWER.deckY + 1, TOWER.cz];
  out.info.reach = [];
  for (let k = 0; k <= lines.length; k++) {
    const g = graphWith(w, k), seen = bfs(g, [start]);
    const pad = n => { const p = D.pads[n - 1]; return seen.has(keyOf(Math.floor(p.stand[0]), p.stand[1], Math.floor(p.stand[2]))); };
    const bossIn = seen.has(keyOf(...bossCell));
    out.info.reach.push([k, seen.size, bossIn]);
    if (k < lines.length && !pad(k + 1)) bad(`with ${k} lines drawn pad ${k + 1} cannot be reached`);
    if (k + 2 <= lines.length && pad(k + 2)) bad(`with ${k} lines drawn pad ${k + 2} is reachable without line ${k + 1}`);
    if (k < lines.length && bossIn) bad(`with ${k} lines drawn the Boss can be reached`);
    if (k === lines.length && !bossIn) bad('with all lines drawn the Boss cannot be reached');
    if (k === 5 && !seen.has(keyOf(...deck))) bad('the spiral stair does not end on the tower deck');
    if (k === 4 && seen.has(keyOf(...deck))) bad('the tower deck is reachable without the stair');
  }
  // nobody is stuck: every rest spot is a stand cell and reachable once everything is drawn
  const all = bfs(graphWith(w, lines.length), [start]);
  for (const r of w.rests) { const c = [Math.floor(r[0]), Math.floor(r[1]), Math.floor(r[2])]; if (!all.has(keyOf(...c))) bad(`rest spot ${c} cannot be reached`); }
  // keeps cover every pad, every line cell and both doors and the Boss stand
  const covered = (x, y, z) => w.keeps.some(k => k.protect.some(b => inBox(b, x, y, z)));
  for (const p of D.pads) for (const c of p.cells) if (!covered(...c)) bad(`pad ${p.n} is not in a keep`);
  for (const l of lines) for (const c of l.line.cells) if (!covered(c.x, c.y, c.z)) { bad(`line ${l.n} cell ${c.x},${c.y},${c.z} is not in a keep`); break; }
  for (const d of w.doors) if (!d.surface.every(c => covered(...c))) bad('a way back is not in a keep');
  if (!covered(...w.bosses[0].pos.map(Math.floor).map((v, i) => (i === 1 ? v - 1 : v)))) bad('the Boss stand is not in a keep');
  out.info.doors = w.doors.length; out.info.crew = w.bosses[0].crew.length;
  // the Doodle realm keeps nothing in the way: the arrival is air, the people are on grass
  for (const c of w.bosses[0].crew) if (w.get(Math.floor(c.pos[0]), Math.floor(c.pos[1]) - 1, Math.floor(c.pos[2])) === B.AIR) bad('a crew person floats');
  void LINES;
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('doodlecheck.mjs')) {
  const seed = Number(process.argv[2] ?? 1);
  const r = analyze(seed);
  console.log(JSON.stringify(r.info));
  console.log(r.problems.length ? r.problems.join('\n') : 'no problems');
  process.exit(r.problems.length ? 1 : 0);
}
