// T45: the Sketchbook terrain checks that need no browser: a stand-in world for doodleLand and a walk graph (the housecheck.mjs one)
// with the drawn lines as extra solid cells. Used by tests/specs/doodle.mjs (in the page, through /tests/doodlecheck.mjs) and run by hand
// with `node tests/doodlecheck.mjs [seed]`.
import { B, isSolid } from '../src/blocks.js';
import { doodleLand, doodleLines, PAGES, TOWER, SIZE, LINES, courseOf } from '../src/doodleland.js';
import { DRAW, newDraw, drawStep, pointAt, beeAt, rubberSpeed } from '../src/tracing.js';
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

/* ---- Draw! played by a model player (no browser): the player walks along the drawn line at walking speed, never closer than 1.2
   behind the pencil, and faces where a bot wants the line to go (owner 2026-10-29: the pencil draws the way you face). Bots:
   skilled  faces the next point of the course's route (through the stars, round the blots), waits for a gap when a bee is coming;
   careless faces the next page all the time;
   nostar   the route without its star dots;
   idle     never walks;
   lazy     walks, but stands still from 1 s to `lazy` s (default 5) and then plays like skilled;
   rush     the skilled route, but never waits for a bee. ---- */
export const WALK = 4.3;
// A model player for one try (st = tracing.newDraw): input(st, dt) -> the drawStep input (feet on the drawn line, the view toward the
// bot's point); after(st, t) reads the step's events (a setback puts the player back at the star). Used by simCourse and by the spec,
// which feeds the same input to the real live part.
export class DrawBot {
  constructor(course, { bot = 'skilled', lazy = 5, route = null } = {}) {
    this.c = course; this.bot = bot; this.lazy = lazy; this.t = 0;
    this.goal = [(course.target[0] + course.target[1] + 1) / 2, (course.target[2] + course.target[3] + 1) / 2];
    let pts = route ?? course.route;
    if (bot === 'nostar') pts = pts.filter(p => !course.stars.some(sd => Math.hypot(sd.x - p[0], sd.z - p[1]) < 0.6));
    this.pts = pts; this.wp = 0; this.sp = 0;
    this.log = { backs: [], stars: 0, starAt: [], nibbles: 0, waits: 0, blocked: {} };
  }
  feet(st) { const q = pointAt(st, this.sp); let row = st.pts[0].row; for (const p of st.pts) { if (p.s > this.sp + 1e-9) break; row = p.row; } return [q[0], row + 1, q[2]]; }
  input(st, dt) {
    const c = this.c, tip = st.tip, pts = this.pts;
    const passed = q => { const dx = q[0] - tip.x, dz = q[1] - tip.z, d = Math.hypot(dx, dz); return d < 1.6 || (d < 4 && dx * Math.cos(tip.h) + dz * Math.sin(tip.h) < 0); }; // reached, or just behind the pencil
    while (this.wp < pts.length - 1 && passed(pts[this.wp])) this.wp++;
    const P = this.bot === 'careless' ? this.goal : pts[this.wp];
    let walk = this.bot !== 'idle' && !(this.bot === 'lazy' && this.t > 1 && this.t < this.lazy);
    if (walk && this.bot !== 'careless' && this.bot !== 'rush' && c.bees.length) { // a gap in the bees: stop when one would meet the pencil soon and would not meet it standing
      // the pencil goes at about walking speed toward the bot's point (the leash), or stands still
      // (standing still it goes on until it is DRAW.leash ahead of you)
      const f0 = this.feet(st), room = Math.max(0, DRAW.leash - Math.hypot(tip.x - f0[0], tip.z - f0[2]));
      const ux = P[0] - tip.x, uz = P[1] - tip.z, um = Math.hypot(ux, uz) || 1, v = c.speed;
      const fut = (tau, move) => { const d = move ? v * tau : Math.min(c.speed * tau, room); return [tip.x + ux / um * d, tip.z + uz / um * d]; };
      const hit = (move, H) => c.bees.some(b => { for (let tau = 0; tau <= H; tau += 0.05) { const [bx, bz] = beeAt(b, st.clock + tau), [fx, fz] = fut(tau, move); if (Math.hypot(bx - fx, bz - fz) < DRAW.beeR + 0.6) return true; } return false; });
      if (hit(true, 1.5) && !hit(false, 0.8)) { walk = false; this.log.waits++; }
    }
    if (walk) this.sp += Math.min(WALK * dt, Math.max(0, st.s - 1.2 - this.sp));
    let f = this.feet(st);
    if (this.sp > st.s + 0.5) f = [f[0], f[1] - 3, f[2]]; // the line under you went: you fall
    // face the bot's point (owner 2026-10-29: the pencil draws the way you face; where you look up or down does not matter)
    const eye = [f[0], f[1] + 1.62, f[2]], at = [P[0], tip.row + 1, P[1]], d = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], m = Math.hypot(...d) || 1;
    this.t += dt;
    return { eye, dir: d.map(v => v / m), player: f };
  }
  after(st) {
    const log = this.log, pts = this.pts;
    for (const e of st.events) {
      if (e.kind === 'back') { // back at the star: go on from the waypoint after the nearest one
        log.backs.push([e.reason, +this.t.toFixed(2)]); this.sp = st.ckpt.s;
        let k = 0; pts.forEach((p, i) => { if (Math.hypot(p[0] - st.tip.x, p[1] - st.tip.z) < Math.hypot(pts[k][0] - st.tip.x, pts[k][1] - st.tip.z)) k = i; });
        this.wp = Math.min(pts.length - 1, k + 1);
      }
      if (e.kind === 'star') { log.stars++; log.starAt.push([e.i, +st.s.toFixed(1), +this.t.toFixed(2)]); }
      if (e.kind === 'nibble') log.nibbles++;
    }
    if (st.blocked) log.blocked[st.blocked] = (log.blocked[st.blocked] || 0) + 1;
  }
}
export function simCourse(course, { hz = 60, bot = 'skilled', maxT = 60, wins = 0, lazy = 5, route = null, clock = 0 } = {}) {
  const st = newDraw(course, wins), dt = 1 / hz, B0 = new DrawBot(course, { bot, lazy, route });
  st.clock = clock; // where the bees are when you press Draw! (the live part's own clock)
  while (!st.done && B0.t < maxT) { drawStep(st, dt, B0.input(st, dt)); B0.after(st); }
  return { done: st.done, t: +B0.t.toFixed(2), setbacks: st.setbacks, nibbles: st.nibbles, ink: +st.ink.toFixed(1), s: +st.s.toFixed(1), ...B0.log, st };
}
// Owner 2026-10-28 ("it again got stuck near an edge"): a wobbly kid. Follows the route roughly (the look point drifts up to `amp`
// blocks to the side), walks 1.8 behind the pencil and, with `look`, every other 1.2 s looks down at their own line where they walk.
// -> the longest time the pencil stood stuck at something that is not an ink blot (an edge, a page, a wall).
export function wobblyKid(course, { amp = 3, seed = 0, look = true, hz = 60, maxT = 90 } = {}) {
  const c = course, st = newDraw(c, 0), dt = 1 / hz, pts = c.route, goal = [(c.target[0] + c.target[1] + 1) / 2, (c.target[2] + c.target[3] + 1) / 2];
  let sp = 0, wp = 0, t = 0, cur = 0, longest = 0, where = null;
  while (!st.done && t < maxT) {
    const tip = st.tip;
    const passed = q => { const dx = q[0] - tip.x, dz = q[1] - tip.z, d = Math.hypot(dx, dz); return d < 2.5 || (d < 5 && dx * Math.cos(tip.h) + dz * Math.sin(tip.h) < 0); };
    while (wp < pts.length - 1 && passed(pts[wp])) wp++;
    const P = wp >= pts.length - 2 ? goal : pts[wp];
    sp += Math.min(WALK * dt, Math.max(0, st.s - 1.8 - sp));
    const f = pointAt(st, sp); let row = st.pts[0].row; for (const p of st.pts) { if (p.s > sp + 1e-9) break; row = p.row; }
    const feet = [f[0], row + 1, f[2]], ux = P[0] - tip.x, uz = P[1] - tip.z, um = Math.hypot(ux, uz) || 1, far = Math.max(3, Math.min(um, 7));
    const wob = amp * Math.sin(t * 1.3 + seed) + amp * 0.5 * Math.sin(t * 3.1 + seed * 2);
    let at = [tip.x + (ux / um) * far - (uz / um) * wob, tip.row + 1, tip.z + (uz / um) * far + (ux / um) * wob];
    if (look && Math.floor(t / 1.2) % 2 === 1) { const a = pointAt(st, Math.min(st.s, sp + 2.2)); at = [a[0], a[1] + 1, a[2]]; }
    const eye = [feet[0], feet[1] + 1.62, feet[2]], d = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], m = Math.hypot(...d);
    drawStep(st, dt, { eye, dir: d.map(v => v / m), player: feet });
    for (const e of st.events) if (e.kind === 'back') sp = st.ckpt.s;
    if (st.blocked && st.blocked !== 'blot') { cur += dt; if (cur > longest) { longest = cur; where = [+st.tip.x.toFixed(1), +st.tip.z.toFixed(1), st.tip.row, st.blocked]; } } else cur = 0;
    t += dt;
  }
  return { done: st.done, t, longest, where };
}
// Owner 2026-10-29 ("I simply moved forward the way I was facing and it continued leftward"): a kid who just walks the way they face.
// They face `yaw0` (radians off the course's start heading), turn by `turnBy` at `turnAt` s, and walk on their line 1.8 behind the
// pencil, looking down at it (pitch does not matter). No blots, bees, stars or Rubber, ink to spare; the wind only with `wind`.
// -> the line's points with the time they were drawn and the facing then.
export function faceWalk(course, { yaw0 = 0, turnAt = null, turnBy = 0, wind = false, hz = 60, T = 6, pitch = -0.5 } = {}) {
  const c = { ...course, ink: 999, rubber: 0, blots: [], bees: [], stars: [], wind: wind ? course.wind : null }, st = newDraw(c, 0), dt = 1 / hz;
  const h0 = Math.atan2(c.dir[1], c.dir[0]), out = [];
  let sp = 0, t = 0, seen = 0;
  while (t < T - 1e-9 && !st.done) {
    const yaw = h0 + yaw0 + (turnAt != null && t >= turnAt ? turnBy : 0);
    sp += Math.min(WALK * dt, Math.max(0, st.s - 1.8 - sp));
    const f = pointAt(st, sp); let row = st.pts[0].row; for (const p of st.pts) { if (p.s > sp + 1e-9) break; row = p.row; }
    const feet = [f[0], row + 1, f[2]], cp = Math.cos(pitch);
    drawStep(st, dt, { eye: [feet[0], feet[1] + 1.62, feet[2]], dir: [Math.cos(yaw) * cp, Math.sin(pitch), Math.sin(yaw) * cp], player: feet });
    t += dt;
    for (; seen < st.pts.length; seen++) out.push({ x: st.pts[seen].x, z: st.pts[seen].z, t, face: yaw });
  }
  return { pts: out, st };
}
// How straight a stretch of the line is and which way it goes: the chord's heading and the furthest point off the chord.
export function stretch(pts, t0, t1) {
  const ps = pts.filter(p => p.t >= t0 && p.t <= t1), a = ps[0], b = ps[ps.length - 1];
  const h = Math.atan2(b.z - a.z, b.x - a.x), len = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
  return { h, len, off: Math.max(...ps.map(p => Math.abs((p.x - a.x) * nx + (p.z - a.z) * nz))), face: b.face };
}
const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// The owner's case as checks: walking straight the way you face draws a straight line that way (also when you started facing a bit
// off the pencil, at 60 and 20 fps, looking level or down); turning your facing turns the line within a second or so.
export function faceChecks(seed = 1) {
  const out = { problems: [], info: {} }, bad = m => out.problems.push(m);
  const w = makeDoodle(seed), solid = solidOf(w), c = courseOf(7, solid);
  for (const hz of [60, 20]) for (const yaw0 of [0, 0.5, -0.5]) for (const pitch of [0, -0.6]) {
    const r = faceWalk(c, { yaw0, hz, pitch }), s = stretch(r.pts, 3, 6), err = angle(s.h, s.face);
    if (err > 0.03 || s.off > 0.25) bad(`facing ${yaw0} rad off the pencil (${hz} fps, pitch ${pitch}): the line goes ${err.toFixed(3)} rad off the way you face, ${s.off.toFixed(2)} off straight`);
    if (hz === 60 && pitch === 0) out.info[`straight${yaw0}`] = [+err.toFixed(3), +s.off.toFixed(2), +s.len.toFixed(1)];
  }
  for (const turnBy of [0.8, -0.8]) {
    const r = faceWalk(c, { turnAt: 2.5, turnBy, T: 7 }), s = stretch(r.pts, 4, 7), err = angle(s.h, s.face);
    const late = r.pts.find(p => p.t > 2.5 && angle(Math.atan2(p.z - r.pts[Math.max(0, r.pts.indexOf(p) - 2)].z, p.x - r.pts[Math.max(0, r.pts.indexOf(p) - 2)].x), p.face) < 0.1);
    const lag = late ? late.t - 2.5 : 99;
    out.info[`turn${turnBy}`] = [+err.toFixed(3), +lag.toFixed(2)];
    if (err > 0.03 || s.off > 0.25) bad(`after turning ${turnBy} rad the line does not go the new way you face (${err.toFixed(3)} rad, ${s.off.toFixed(2)} off straight)`);
    if (lag > 1.2) bad(`after turning ${turnBy} rad the pencil took ${lag.toFixed(2)} s to follow`);
    if (lag < 0.2) bad(`after turning ${turnBy} rad the pencil snapped round in ${lag.toFixed(2)} s (twitchy)`);
  }
  // the wind still pushes (line 6): walking straight, the line drifts a little downwind (turn into it), never wildly
  { const c6 = courseOf(6, solid), r = faceWalk(c6, { wind: true, T: 8 }), s = stretch(r.pts, 3, 8), err = angle(s.h, s.face);
    out.info.wind = +err.toFixed(3);
    if (err < 0.02 || err > 0.25) bad(`in the wind the line drifts ${err.toFixed(3)} rad off the way you face (want a little, 0.02-0.25)`); }
  return out;
}
export { pointAt };
export const solidOf = w => (x, y, z) => w.isSolid(x, y, z) && w.get(x, y, z) !== B.DO_INK;

// Draw! checks for every line (spec F): the skilled player wins each line cleanly at 60 and 20 frames a second (about the same time);
// a careless one (straight at the next page) does not win lines 2-8 cleanly; Rubber catches a player who stops on lines 6-8 (and the
// line is still drawn after; on line 7 the bees may nibble the waiting pencil dry first); a bee nibbles a player who walks on without looking (line 4); without the star dots lines 5-8 are not won
// cleanly; Rubber is faster per rematch win and never as fast as walking; the course data sits in the gaps.
export function drawChecks(seed = 1) {
  const out = { problems: [], rows: [] }, bad = m => out.problems.push(m);
  const w = makeDoodle(seed), solid = solidOf(w);
  const t0 = Date.now();
  for (let n = 1; n <= 8; n++) {
    const c = courseOf(n, solid), row = { n };
    const sk = [60, 20].map(hz => simCourse(c, { hz }));
    row.skilled = sk.map(r => `${r.t}s`).join('/');
    // ... also when the bees are elsewhere at Draw! (the live part's clock): never a setback, at most one nibble (none on line 4)
    for (const clock of c.bees.length ? [0, 1.3, 2.9, 4.4] : [0]) for (const hz of [60, 20]) {
      const r = clock ? simCourse(c, { hz, clock }) : sk[hz === 60 ? 0 : 1];
      if (!r.done || r.setbacks || r.nibbles > (n === 4 ? 0 : 1)) bad(`line ${n}: the skilled player at ${hz} fps (bees at ${clock} s): done ${r.done}, ${r.setbacks} setbacks ${JSON.stringify(r.backs)}, ${r.nibbles} nibbles`);
      if (c.bees.length) row.waits = (row.waits || 0) + r.waits;
    }
    if (Math.abs(sk[0].t - sk[1].t) > 0.3) bad(`line ${n}: 60 and 20 fps differ: ${sk[0].t} / ${sk[1].t} s`);
    if (sk[0].stars < c.stars.length) bad(`line ${n}: the route misses a star (${sk[0].stars} of ${c.stars.length})`);
    const care = simCourse(c, { bot: 'careless', maxT: 30 });
    row.careless = care.done ? `done ${care.t}s, ${care.setbacks} back` : `not done (${Object.keys(care.blocked).join() || care.backs.map(b => b[0]).slice(0, 3).join()})`;
    if (n >= 2 && care.done && care.setbacks === 0 && care.nibbles === 0) bad(`line ${n}: drawing straight at the page wins cleanly (${care.t} s)`);
    if (n === 1 && !care.done) bad('line 1 (the easy first line): looking at the dotted strip does not land the line there (owner 2026-10-28: the pencil glides along a page edge onto it)');
    if (n >= 6) { const ns = simCourse(c, { bot: 'nostar', maxT: 30 }); row.nostar = ns.done ? `done, ${ns.setbacks} back` : 'not done'; if (ns.done && !ns.setbacks && !ns.nibbles) bad(`line ${n}: won cleanly without its stars`); }
    if (c.rubber) {
      const lazy = simCourse(c, { bot: 'lazy', lazy: 6, maxT: 40 }), idle = simCourse(c, { bot: 'idle', maxT: 10 });
      row.lazy = `${lazy.done ? 'done' : 'not done'} ${lazy.t}s ${lazy.backs.map(b => b[0]).join()}`;
      if (!lazy.setbacks || !lazy.done || (n !== 7 && !lazy.backs.some(b => b[0] === 'caught'))) bad(`line ${n}: a player who stops for 5 s: ${JSON.stringify(lazy.backs)} done ${lazy.done}`);
      if (idle.backs.some(b => b[0] === 'caught') || idle.done) bad(`line ${n}: Rubber caught a player who never left the pad`);
      const r0 = rubberSpeed(c, 0), r1 = rubberSpeed(c, 1), r9 = rubberSpeed(c, 99);
      if (!(r1 > r0 && r9 <= DRAW.rubberCap && r9 < WALK)) bad(`line ${n}: Rubber's speed by wins ${r0} ${r1} ${r9}`);
      row.rubber = [r0, r1, r9].map(v => +v.toFixed(2)).join('/');
    }
    if (c.bees.length) { let nib = 0; for (const clock of [0, 1.3, 2.9, 4.4, 6.1]) nib += simCourse(c, { bot: 'rush', clock, maxT: 60 }).nibbles; row.rush = `${nib} nibbles in 5 tries`; if (!nib) bad(`line ${n}: the bees never nibble a player who walks on without waiting`); }
    if (n >= 2) { const total = c.route.reduce((a, p, i) => a + Math.hypot(p[0] - (i ? c.route[i - 1][0] : c.start[0]), p[1] - (i ? c.route[i - 1][1] : c.start[1])), 0); if (total <= c.ink) bad(`line ${n}: the ink (${c.ink}) reaches without a star (${total.toFixed(0)})`); }
    // a wobbly kid who also looks down at their own line never has the pencil stuck at an edge, a page or a wall for long (owner 2026-10-28)
    if (!c.tower) { let worst = 0; for (const amp of [1.5, 3]) for (const seed of [0, 2]) for (const look of [false, true]) for (const hz of look && seed === 0 ? [60, 20] : [60]) { const r = wobblyKid(c, { amp, seed, look, hz }); if (r.longest > worst) { worst = r.longest; row.stuckAt = r.where; } }
      row.wobbly = +worst.toFixed(2); if (worst > 2) bad(`line ${n}: a wobbly kid had the pencil stuck at an edge for ${worst.toFixed(1)} s`); }
    // the course sits in the gaps: stars, blots and bees inside the roam box, not on another page, not on the pad or the next page
    const other = (x, z) => c.fence.some(r => x >= r[0] - 1 && x <= r[1] + 2 && z >= r[2] - 1 && z <= r[3] + 2);
    const inR = (r, x, z) => x >= r[0] && x < r[1] + 1 && z >= r[2] && z < r[3] + 1;
    for (const sd of c.stars) if (other(sd.x, sd.z) || !inR(c.roam, sd.x, sd.z)) bad(`line ${n}: a star at ${sd.x},${sd.z} is not in the gap`);
    for (const b of c.blots) if (Math.hypot(b.x - c.start[0], b.z - c.start[1]) < b.r + 3 || inR(c.target, b.x, b.z)) bad(`line ${n}: a blot sits on the pad or the page`);
    for (const b of c.bees) if (!inR(c.roam, ...b.a) || !inR(c.roam, ...b.b)) bad(`line ${n}: a bee flies out of the gap`);
    out.rows.push(row);
  }
  { const f = faceChecks(seed); out.problems.push(...f.problems); out.face = f.info; }
  // the gaps are keeps: nobody builds a bridge there (every column next to no page is in a gap box), no page column is in one
  const gaps = w.keeps.filter(k => k.name === 'gap'), inGap = (x, y, z) => gaps.some(k => k.protect.some(b => inBox(b, x, y, z)));
  for (const [x, z] of [[100, 136], [114, 98], [98, 30], [60, 50], [80, 56], [84, 80], [57, 80]]) if (!inGap(x, 20, z)) bad(`the gap at ${x},${z} is not a keep`);
  for (const p of Object.values(PAGES)) if (inGap(Math.floor((p.x0 + p.x1) / 2), p.top + 1, Math.floor((p.z0 + p.z1) / 2))) bad('a page is in a gap keep');
  out.ms = Date.now() - t0;
  return out;
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('doodlecheck.mjs')) {
  const seed = Number(process.argv[2] ?? 1);
  const r = analyze(seed);
  console.log(JSON.stringify(r.info));
  const d = drawChecks(seed);
  for (const row of d.rows) console.log(JSON.stringify(row));
  console.log(`face ${JSON.stringify(d.face)}`);
  console.log(`draw checks ${d.ms} ms`);
  r.problems.push(...d.problems);
  console.log(r.problems.length ? r.problems.join('\n') : 'no problems');
  process.exit(r.problems.length ? 1 : 0);
}
