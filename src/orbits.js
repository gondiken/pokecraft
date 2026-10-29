// Cube Planets' three skill games, the pure rules (plans/cube-planets.md section 4). No three.js, no game: Node-runnable. cubelive.js wires
// them to the player, the meshes and the saved keys; tests/cubebots.mjs plays them with the real Player at 60 and 20 frames a second.
//
// Owner 2026-10-29: "Easy to understand, hard to master". Each game is one look and one line:
//  - Orbikit Chase: "Too fast to chase! Wait round a corner on its sparkly trail." The Orbikit (a little comet cheetah) runs a fixed loop of
//    faces round its planet. Behind you it sprints away (faster than you can run); in front of you on its own face it sees you and turns
//    back. Only round a corner (an edge hides you) does it run into you: tag! Mastery = reading its loop on a surface that wraps round.
//  - Planet Hop: "Jump on a flower to fly. Land on the next pebble!" A flower pushes you hard along your up; the pull of the planets bends
//    the flight. Where you run from and how fast (stand, walk, run) decides where you come down. Too fast and the Sky Pebble catches you,
//    too slow and you fall back. (The flights are player.js's own sums: nothing here but the help.)
//  - Moon Ride: "Ride the moon. Jump off into the ring!" You keep the moon's speed when you jump off, so you must jump BEFORE you are over
//    the ring. The moon is slow by its stop and fast on the far side.
// Never a fail (a miss just tries again), the kind help only through kindhelp.js (gravityHelp), a harder rematch (HARD).
import { kindHelp } from './kindhelp.js';

export const STEP = 1 / 120; // the fixed sub-step of every clock here (60 and 20 frames a second give the same sub-steps)
export const HARD = { pup: 1.15, moon: 1.15, pad: -0.5 }; // a rematch (you hold the star): the Orbikit and the moon x1.15, pebbles catch a bit less

// The kind help (owner 2026-10-28: only kindhelp.js, only gently): e = kindHelp(misses).ease.
//   Orbikit Chase  a miss = it saw you and ran back   tag reach x (1 + e), its sprint x (1 - e) (still faster than you: chasing never works)
//   Planet Hop     a miss = a flight that did not      the next pebble's pull reaches e x PAD_SCALE blocks further (gravity.js `pad`)
//                  land on the next pebble
//   Moon Ride      a miss = a jump that missed the     the moon x (1 - e), the ring x (1 + e)
//                  ring
export const PAD_SCALE = 8;
export function gravityHelp(misses) {
  const k = kindHelp(misses);
  return { ...k, tag: k.more, sprint: k.slow, pad: k.ease * PAD_SCALE, moon: k.slow, ring: k.more };
}

/* ================================================================ the Orbikit Chase */
export const PUP = {
  tagR: 1.3,       // touching: the Orbikit within this of your body (feet to head)
  button: 2.3,     // Tag! (the big button) reaches this far
  see: 6.5,        // it sees you on its own face, in front of it, this close (and nothing in between)
  cone: 0.35,      // ... within this of straight ahead (the cosine: about 70 degrees each side)
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
function bodyDist(q, feet, up, h = 1.8) {
  const w = sub(q, feet), k = Math.max(0, Math.min(h, dot(w, up)));
  return len(sub(w, up.map(v => v * k)));
}

// One round of the chase on one planet. opts: { base, boost, help (misses), hard, start (s), seen: (from, to) => boolean (line of sight) }.
export class PupRun {
  constructor(loop, box, opts = {}) {
    this.L = loopOf(loop, box); this.box = box;
    const h = gravityHelp(opts.help ?? 0), hard = opts.hard ? HARD.pup : 1;
    this.base = (opts.base ?? 4.6) * hard; this.boost = (opts.boost ?? 7.0) * hard * h.sprint; this.tagR = PUP.tagR * h.tag; this.button = PUP.button * h.tag;
    this.s = opts.start ?? 0; this.dir = 1; this.time = 0; this.acc = 0; this.coolT = 0; this.fleeT = 0; this.speed = this.base;
    this.seen = opts.seen ?? (() => true);
    this.tagged = false; this.spots = 0; this.running = false;
  }
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
      if (d <= this.tagR || (pressed && d <= this.button)) { this.tagged = true; ev.push({ type: 'tag', d }); return; }
      const head = pl.feet.map((v, k) => v + pl.up[k] * 0.9), to = sub(head, mid), dist = len(to), fwd = this.heading();
      const sameFace = pl.face && pl.face[0] === a.seg.face[0] && pl.face[1] === a.seg.face[1];
      const front = dist > 1e-9 && dot(to, fwd) / dist > PUP.cone;
      if (sameFace && front && dist < PUP.see && this.coolT <= 0 && this.seen(mid, head)) {
        this.dir = -this.dir; this.coolT = PUP.cool; this.fleeT = PUP.flee; this.spots++;
        ev.push({ type: 'spotted' });
      }
      const chased = !front && dist < PUP.chase;
      const want = chased || this.fleeT > 0 ? this.boost : this.base;
      if (want > this.speed && this.speed <= this.base) ev.push({ type: 'sprint' });
      this.speed = want;
      this.running = true;
    } else { this.speed = this.base; }
    if (this.running) this.s = ((this.s + this.dir * this.speed * h) % this.L.total + this.L.total) % this.L.total;
  }
}

/* ================================================================ the Moon Ride */
// moon = cubeland.js MOON plus { top } (the base's top surface y). u = the ride clock (s). speed = the help / hard factor.
// -> { pos: [x, y, z] (the middle of the moon's top, where you stand), vel, phi, stopped }
export function moonAt(M, u, speed = 1) {
  const T = M.period / speed, w = (2 * Math.PI) / T, cyc = T + M.stop, v = ((u % cyc) + cyc) % cyc;
  let phi = M.phase0, dphi = 0;
  const stopped = v < M.stop;
  if (!stopped) { const tau = v - M.stop; phi = M.phase0 + w * tau - M.e * Math.sin(w * tau); dphi = w * (1 - M.e * Math.cos(w * tau)); } // slow by the stop, fast across
  const c = Math.cos(phi), s = Math.sin(phi), k = phi - M.phase0, H = M.high - M.low;
  const pos = [M.cx + M.rx * c, M.top + M.low + H * (1 - Math.cos(k)) / 2, M.cz + M.rz * s];
  const vel = [-M.rx * s * dphi, H * Math.sin(k) / 2 * dphi, M.rz * c * dphi];
  return { pos, vel, phi, stopped, cycle: cyc, left: stopped ? M.stop - v : 0 };
}
// Jumping off: your speed is the moon's plus the jump along up (+y on the Moon Base's top).
export const jumpOff = (vel, jump) => [vel[0], vel[1] + jump, vel[2]];
// A landing in a ring (on the Moon Base's top): within r of its middle.
export const ringHit = (ring, pos, k = 1) => Math.hypot(pos[0] - ring.x, pos[2] - ring.z) <= ring.r * k;
