// Cube Planets' three skill games, the pure rules (plans/cube-planets.md, "Redesign 2026-10-29"). No three.js, no game: Node-runnable.
// cubelive.js wires them to the player, the meshes and the saved keys; tests/cubebots.mjs plays them with the real Player at 60 and 20 fps.
//
// Owner 2026-10-29: "Easy to understand, hard to master", and every rule must be natural space physics a child expects, with a reason in
// the world (Professor Orbit's little-planet observatory), needing no rule text:
//  - Orbikit Chase: the Professor's pet comet cheetahs got loose. An Orbikit runs round and round its planet (its sparkly trail shows
//    where); it is faster than you, and it runs away from what it sees. Round a corner it cannot see you: wait there and it runs into you.
//    Three planets, easy -> medium -> harder (PUPS in cubeland.js carry each round's numbers).
//    Owner 2026-10-30 ("I have no idea how I won ... it would either randomly get tagged or randomly see me"): the old rule turned it the
//    instant it came over the edge and saw you, so only a child standing within about 1 block of the edge won; 1.5 blocks back it saw you
//    and turned while nearly touching you (and it also "heard" you from any side within 2.2). Now there is ONE readable rule: when it first
//    sees you it shows a "!" (cubelive.js). Seen from afar it turns and runs (`spotted`). Seen up close on its own lane (`surprise`
//    ahead, `lane` to the side: it comes round the corner right at you) it is too surprised to stop: it skids into you (`bump`) and is
//    tagged. Running after it from behind only makes it sprint (it is faster than you); nothing else notices you.
//  - Planet Hop: spring flowers grow on the pebbles. Stand on one and it squashes; jump and it flings you up (a spring). Your run-up
//    (stand, walk, run) and its direction carry on into the flight (the flights are player.js's own sums; nothing here but the help).
//  - Moon Ferry: the Professor's three telescope lenses fell onto far little rocks, too far to jump to. A little moon circles past on an
//    ellipse (ferryAt: a real orbit, slow at its far end, fast near the little sun), never stopping. Hop on as it passes, ride, jump off:
//    you keep the moon's speed, so you must let go BEFORE you are next to the rock (like a sling). Too late and you sail past.
// Never a fail (a miss just tries again), the kind help only through kindhelp.js (gravityHelp), a harder rematch (HARD).
import { kindHelp } from './kindhelp.js';

export const STEP = 1 / 120; // the fixed sub-step of every clock here (60 and 20 frames a second give the same sub-steps)
export const HARD = { pup: 1.15, moon: 1.15, pad: -0.5 }; // a rematch (you hold the star): the Orbikits and the moon x1.15, pebbles and lens rocks catch a bit less

// The kind help (owner 2026-10-28: only kindhelp.js, only gently): e = kindHelp(misses).ease.
//   Orbikit Chase  a miss = it saw you and ran back   tag reach x (1 + e), its sprint x (1 - e) (still faster than you: chasing never works)
//   Planet Hop     a miss = a flight that did not      the next pebble's pull reaches e x PAD_SCALE blocks further (gravity.js `pad`)
//                  land on the next pebble
//   Moon Ferry     a miss = a jump off the moon that   the moon x (1 - e), the lens rock's pull reaches e x PAD_SCALE further
//                  did not reach a lens rock
export const PAD_SCALE = 8;
export function gravityHelp(misses) {
  const k = kindHelp(misses);
  return { ...k, tag: k.more, sprint: k.slow, pad: k.ease * PAD_SCALE, moon: k.slow, lens: k.ease * PAD_SCALE };
}

/* ================================================================ the Orbikit Chase */
export const PUP = {
  tagR: 1.1,       // touching: the Orbikit within this of your body (feet to head)
  button: 1.6,     // Tag! (the big button) reaches this far
  see: 6.5,        // it sees you on its own face, in front of it, this close (and nothing in between)
  cone: 0.35,      // ... within this of straight ahead (the cosine: about 70 degrees each side)
  surprise: 2.8,   // seen this close ahead (it came round a corner or past a tree right at you) ... (each round may have its own: PUPS)
  lane: 1.0,       // ... and this close to its way, to the side: it cannot stop and skids into you (a tag)
  bump: 0.9,       // the skid lasts at most this long (it slows from its trot to a stop); step away and it turns and runs after all
  chase: 5,        // behind it (or beside) on its planet this close: it sprints
  flee: 1.0,       // after it saw you it sprints away this long
  cool: 1.5,       // and does not turn again this soon
  sit: 0.6,        // how high its middle is over the face
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = v => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// The face a loop segment lies on: [axis, sign, plane] (both ends on the same plane of the box) given the planet box.
function faceOf(p, q, box) {
  const LO = [box.x0, box.y0, box.z0], HI = [box.x1, box.y1, box.z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(p[a] - HI[a]) < 1e-9 && Math.abs(q[a] - HI[a]) < 1e-9) return [a, 1];
    if (Math.abs(p[a] - LO[a]) < 1e-9 && Math.abs(q[a] - LO[a]) < 1e-9) return [a, -1];
  }
  return [1, 1];
}
// A loop: { pts, segs: [{ a, b, len, at (start s), dir (unit), face: [axis, sign], up }], total }
export function loopOf(pts, box) {
  const segs = [];
  let at = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], d = sub(b, a), L = len(d), face = faceOf(a, b, box), up = [0, 0, 0];
    up[face[0]] = face[1];
    segs.push({ a, b, len: L, at, dir: d.map(v => v / L), face, up });
    at += L;
  }
  return { pts, segs, total: at };
}
// Where on the loop at arc length s: { pos (on the surface), seg, up, dir }.
export function loopAt(L, s) {
  const t = ((s % L.total) + L.total) % L.total;
  let seg = L.segs[L.segs.length - 1];
  for (const g of L.segs) if (t < g.at + g.len) { seg = g; break; }
  const k = t - seg.at;
  return { pos: [seg.a[0] + seg.dir[0] * k, seg.a[1] + seg.dir[1] * k, seg.a[2] + seg.dir[2] * k], seg, up: seg.up, dir: seg.dir };
}
// The closest arc length on the loop to a point (for the tests' robots and the help dots).
export function loopNearest(L, p) {
  let best = 0, bd = Infinity;
  for (const g of L.segs) {
    const w = sub(p, g.a), k = Math.max(0, Math.min(g.len, dot(w, g.dir))), q = [g.a[0] + g.dir[0] * k, g.a[1] + g.dir[1] * k, g.a[2] + g.dir[2] * k], d = len(sub(p, q));
    if (d < bd) { bd = d; best = g.at + k; }
  }
  return { s: best, d: bd };
}
// Distance from a point to the segment feet..head (the player's body).
export function bodyDist(q, feet, up, h = 1.8) {
  const w = sub(q, feet), k = Math.max(0, Math.min(h, dot(w, up)));
  return len(sub(w, up.map(v => v * k)));
}

// One round of the chase on one planet. opts: { base, boost, help (misses), hard, start (s), seen: (from, to) => boolean (line of sight) }.
export class PupRun {
  constructor(loop, box, opts = {}) {
    this.L = loopOf(loop, box); this.box = box;
    const h = gravityHelp(opts.help ?? 0), hard = opts.hard ? HARD.pup : 1;
    this.base = (opts.base ?? 4.6) * hard; this.boost = (opts.boost ?? 7.0) * hard * h.sprint; this.tagR0 = opts.tagR ?? PUP.tagR; this.tagR = this.tagR0 * h.tag; this.button = PUP.button * h.tag;
    this.see = opts.see ?? PUP.see; // (each round's own numbers: cubeland.js PUPS)
    this.surprise0 = opts.surprise ?? PUP.surprise; this.surprise = this.surprise0 * h.tag; this.lane = PUP.lane * h.tag; this.bumpT = 0;
    this.flip = opts.flip ?? 0; this.flipT = this.flip; // the playful one: it turns back by itself every `flip` s (0 = never); watch it before you hide
    this.s = opts.start ?? 0; this.dir = 1; this.time = 0; this.acc = 0; this.coolT = 0; this.fleeT = 0; this.speed = this.base;
    this.seen = opts.seen ?? (() => true);
    this.tagged = false; this.spots = 0; this.running = false;
  }
  // the kind help (cubelive.js, after a miss): its sprint and every reach
  help(boost, tag) { this.boost = boost; this.tagR = this.tagR0 * tag; this.button = PUP.button * tag; this.surprise = this.surprise0 * tag; this.lane = PUP.lane * tag; }
  get skidding() { return this.bumpT > 0; }
  get at() { return loopAt(this.L, this.s); }
  // where it heads (its running direction, unit)
  heading() { const a = this.at; return a.dir.map(v => v * this.dir); }
  // the player: { feet [x,y,z], up [x,y,z], planet, face: [axis, sign], press (Tag! pressed this frame) }; planet = the pup's planet index
  // in the caller's numbering (`mine` = the player is on this pup's planet). -> events [{ type: 'tag' | 'spotted' | 'sprint' }]
  update(dt, pl) {
    const ev = [];
    if (this.tagged) return ev;
    this.acc += dt;
    let pressed = !!pl?.press;
    while (this.acc >= STEP - 1e-12) {
      this.acc -= STEP;
      this.stepOnce(STEP, pl, ev, pressed);
      pressed = false;
      if (this.tagged) break;
    }
    return ev;
  }
  stepOnce(h, pl, ev, pressed) {
    this.time += h; this.coolT = Math.max(0, this.coolT - h); this.fleeT = Math.max(0, this.fleeT - h);
    const a = this.at, mid = a.pos.map((v, k) => v + a.up[k] * PUP.sit);
    if (pl?.mine) {
      const d = bodyDist(mid, pl.feet, pl.up);
      if (d <= this.tagR || (pressed && d <= this.button)) { this.tagged = true; ev.push({ type: 'tag', d, skid: this.bumpT > 0 }); return; }
      if (this.bumpT > 0) { // skidding into you: it slows from its trot to a stop; you stepped out of its way = it turns and runs after all
        this.bumpT -= h;
        this.speed = this.base * Math.max(0, this.bumpT / PUP.bump);
        if (this.bumpT <= 0) { this.bumpT = 0; this.dir = -this.dir; this.coolT = PUP.cool; this.fleeT = PUP.flee; this.spots++; ev.push({ type: 'spotted', late: true }); }
        else { this.s = ((this.s + this.dir * this.speed * h) % this.L.total + this.L.total) % this.L.total; return; }
      }
      const head = pl.feet.map((v, k) => v + pl.up[k] * 0.9), to = sub(head, mid), dist = len(to), fwd = this.heading();
      const sameFace = pl.face && pl.face[0] === a.seg.face[0] && pl.face[1] === a.seg.face[1];
      const ahead = dot(to, fwd), front = dist > 1e-9 && ahead / dist > PUP.cone;
      if (sameFace && front && dist < this.see && this.coolT <= 0 && this.seen(mid, head)) {
        const side = sub(to, fwd.map(v => v * ahead)), across = Math.hypot(...side.map((v, k) => v - a.up[k] * dot(side, a.up)));
        if (ahead <= this.surprise && across <= this.lane) { // too close to stop: it skids into you
          this.bumpT = PUP.bump; this.coolT = PUP.cool;
          ev.push({ type: 'surprised' });
          this.s = ((this.s + this.dir * this.speed * h) % this.L.total + this.L.total) % this.L.total;
          return;
        }
        this.dir = -this.dir; this.coolT = PUP.cool; this.fleeT = PUP.flee; this.spots++;
        ev.push({ type: 'spotted' });
      }
      const chased = !front && dist < PUP.chase;
      // the playful one turns back by itself now and then, but never toward you when you are close (chasing must never work)
      if (this.flip > 0 && (this.flipT -= h) <= 0) { this.flipT += this.flip; if (this.fleeT <= 0 && dist > 8) { this.dir = -this.dir; ev.push({ type: 'flip' }); } }
      const want = chased || this.fleeT > 0 ? this.boost : this.base;
      if (want > this.speed && this.speed <= this.base) ev.push({ type: 'sprint', chased: chased && this.fleeT <= 0 });
      this.speed = want;
      this.running = true;
    } else { this.speed = this.base; this.bumpT = 0; }
    if (this.running) this.s = ((this.s + this.dir * this.speed * h) % this.L.total + this.L.total) % this.L.total;
  }
}

/* ================================================================ the Moon Ferry */
// A real orbit (Kepler): the moon goes round an ellipse whose one focus is the little sun; equal areas in equal times, so it is slow at
// its far end (where you hop on, beside the Saucer Dock) and fast as it swings round the sun. M = cubeland.js MOON:
// { cx, cz (the ellipse's middle), a (half its length, along x), e, period (s), y (the moon's top, where you stand), sx (+1: the slow
// far end is at +x) }. phase = how far round (0..1, the mean anomaly / 2 pi); k = a speed factor (the kind help, the rematch).
// -> { pos: [x, y, z] (the middle of the moon's top), vel: [x, y, z] (blocks/s), E (eccentric anomaly), speed }
export function solveKepler(Mean, e) { let E = Mean; for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - Mean) / (1 - e * Math.cos(E)); return E; } // (Newton, 12 fixed steps: the same everywhere)
export function ferryAt(M, phase, k = 1) {
  const n = (2 * Math.PI / M.period) * k, Mean = 2 * Math.PI * phase, e = M.e, E = solveKepler(Mean, e);
  const b = M.a * Math.sqrt(1 - e * e), dE = n / (1 - e * Math.cos(E)), sx = M.sx ?? 1;
  const pos = [M.cx - sx * M.a * Math.cos(E), M.y, M.cz + b * Math.sin(E)];
  const vel = [sx * M.a * Math.sin(E) * dE, 0, b * Math.cos(E) * dE];
  return { pos, vel, E, speed: Math.hypot(vel[0], vel[2]) };
}
// The little sun: the focus the moon goes round (near its fast end).
export const sunOf = M => [M.cx - (M.sx ?? 1) * M.a * M.e, M.y, M.cz];
// Jumping off: your speed is the moon's plus the jump along up (+y: you ride on the moon's top).
export const jumpOff = (vel, jump) => [vel[0], vel[1] + jump, vel[2]];
