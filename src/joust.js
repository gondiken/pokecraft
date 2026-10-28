// T49: the Joust (the Castle, plans/T49-castle.md section 4), pure: only kindhelp.js's kindHelp (itself pure), so it runs in Node.
// You ride the castle's horse down your lane; a wooden practice knight on a trolley comes the other way and you meet at a fixed time
// (`meet`). The stick moves your lance tip (u = sideways, v = up, in blocks, in the plane of his shield); the gallop bobs it (a closed
// form); a gold star sits on his shield (still, sliding, or sliding and hopping once late). At the meeting the tip's distance to the
// star decides: Bullseye! (2 points), Clang! on the shield (1), or Whoosh! (0, a bonk on your helmet, nothing more). Never a fail: a round
// is four passes; short of its number it simply starts again, and after two short rounds the shared kind help gives a tiny bit more time and a bigger star.
// The tip moves in fixed 1/120 s sub-steps with the frame's input held, so the same presses give the same result at any frame rate.
import { kindHelp } from './kindhelp.js';
import { seeded, hashStr } from './siege.js';

export const JOUST = {
  passes: 4,
  gallop: [8, 9, 10], accel: 1.0,                 // b/s on the lane, reached in `accel` s
  meet: [3.4, 3.0, 2.6],                          // s after Charge! you meet
  after: 1.6,                                     // s after the meeting the pass is over (the horse slows and turns)
  tipSpeed: 1.3, mouse: 0.006, drag: 0.01,        // stick: b/s at a full push; look input: blocks per pixel / per touch point
  lim: [1.0, 0.8],                                // |u|, |v| at most
  amp: [[0.05, 0.08], [0.08, 0.13], [0.10, 0.16]], // the gallop bob (u, v)
  spots: [[0.5, 0], [-0.5, 0], [0, 0.45], [0, -0.45]], // round 1: the star stands still at one of these (never the middle)
  ellipse: [0.55, 0.42], omega: [0, 2 * Math.PI / 3.2, 2 * Math.PI / 2.6],
  hop: 0.9, hopTell: 0.25,                                 // round 3: the star hops to the other side this long before the meeting
  r: [0.32, 0.28, 0.26], shield: 0.8,
  need: [6, 6, 7],
  hard: { meet: 0.9, need: 1, r: -0.03, gallop: 1 },
  dt: 1 / 120,
};
export const JOUST_ROUNDS = JOUST.need.length;

// The plan of one try of round r: per pass the star's spot (round 1) or phase, and the bob phases. Pure.
export function joustPlan(seed, round, attempt = 0, { help = 0, hard = false } = {}) {
  const rnd = seeded(hashStr(`joust|${seed}|${round}|${attempt}`)), kind = kindHelp(help); // the kind help: meeting time, star and hop warning x more, the slide x slow
  const passes = Array.from({ length: JOUST.passes }, () => ({ spot: JOUST.spots[Math.floor(rnd() * JOUST.spots.length)], phi: rnd() * Math.PI * 2, phiU: rnd() * Math.PI * 2, phiV: rnd() * 0.5 }));
  return {
    round, help, hard, passes,
    meet: JOUST.meet[round] * (hard ? JOUST.hard.meet : 1) * kind.more,
    r: (JOUST.r[round] + (hard ? JOUST.hard.r : 0)) * kind.more,
    need: JOUST.need[round] + (hard ? JOUST.hard.need : 0),
    gallop: JOUST.gallop[round] + (hard ? JOUST.hard.gallop : 0),
    hop: JOUST.hop * kind.more,
    slow: kind.slow,                         // the help slows the star's slide too
  };
}
// How far your horse has gone at pass time tau (blocks): accelerates for `accel` s, then gallops on.
export function gallopAt(tau, v, accel = JOUST.accel) { return tau <= accel ? v * tau * tau / (2 * accel) : v * (tau - accel / 2); }
// The gallop bob at tau: [u, v].
export function bobAt(plan, pass, tau) {
  const [au, av] = JOUST.amp[plan.round], p = plan.passes[pass];
  return [au * Math.sin(2 * Math.PI * 1.3 * tau + p.phiU), av * (Math.abs(Math.sin(2.4 * Math.PI * tau + p.phiV)) - 0.64)];
}
// Where the star is on his shield at tau: [u, v], and whether it is wiggling (the hop's tell).
export function starAt(plan, pass, tau) {
  const p = plan.passes[pass];
  if (plan.round === 0) return { at: p.spot.slice(), wiggle: false };
  const [a, b] = JOUST.ellipse, w = JOUST.omega[plan.round] * (plan.slow ?? 1);
  let phi = p.phi + w * tau, wiggle = false;
  if (plan.round >= 2) { const hopAt = plan.meet - plan.hop; if (tau >= hopAt) phi += Math.PI; else if (tau >= hopAt - JOUST.hopTell) wiggle = true; }
  return { at: [a * Math.cos(phi), b * Math.sin(phi)], wiggle };
}
// The result of a meeting: tip (without the bob) at the meeting time.
export function meetResult(plan, pass, tip) {
  const bob = bobAt(plan, pass, plan.meet), star = starAt(plan, pass, plan.meet).at;
  const d = Math.hypot(tip[0] + bob[0] - star[0], tip[1] + bob[1] - star[1]);
  return { d, kind: d <= plan.r ? 'bullseye' : d <= JOUST.shield ? 'clang' : 'whoosh', points: d <= plan.r ? 2 : d <= JOUST.shield ? 1 : 0 };
}

// One round, stepped. charge() starts the next pass; update(dt, { su, sv, du, dv }) (stick -1..1, look deltas in blocks this frame)
// -> events [{ type: 'meet', pass, kind, points, d }, { type: 'passDone', pass }, { type: 'done', won, points, need }].
export class JoustRound {
  constructor(seed, round, attempt, opts = {}) {
    this.plan = joustPlan(seed, round, attempt, opts);
    this.round = round; this.pass = -1; this.tau = 0; this.riding = false; this.tip = [0, 0];
    this.points = 0; this.results = []; this.done = false; this.won = false; this.met = false;
  }
  get need() { return this.plan.need; }
  charge() {
    if (this.riding || this.done || this.pass + 1 >= JOUST.passes) return false;
    this.pass++; this.tau = 0; this.riding = true; this.met = false; this.tip = [0, 0];
    return true;
  }
  update(dt, input = {}) {
    const ev = [];
    if (!this.riding) return ev;
    const su = input.su || 0, sv = input.sv || 0;
    if (!this.met) { // look input moves the tip at once (a mouse / a drag)
      this.tip[0] = Math.max(-JOUST.lim[0], Math.min(JOUST.lim[0], this.tip[0] + (input.du || 0)));
      this.tip[1] = Math.max(-JOUST.lim[1], Math.min(JOUST.lim[1], this.tip[1] + (input.dv || 0)));
    }
    let rest = Math.max(0, dt);
    while (rest > 1e-9 && this.riding) {
      const h = Math.min(JOUST.dt, rest); rest -= h;
      const t1 = this.tau + h;
      if (!this.met) {
        const step = Math.min(h, this.plan.meet - this.tau); // the tip stops moving exactly at the meeting
        this.tip[0] = Math.max(-JOUST.lim[0], Math.min(JOUST.lim[0], this.tip[0] + su * JOUST.tipSpeed * step));
        this.tip[1] = Math.max(-JOUST.lim[1], Math.min(JOUST.lim[1], this.tip[1] + sv * JOUST.tipSpeed * step));
        if (t1 >= this.plan.meet) {
          this.met = true;
          const r = meetResult(this.plan, this.pass, this.tip);
          this.points += r.points; this.results.push(r.kind);
          ev.push({ type: 'meet', pass: this.pass, ...r });
        }
      }
      this.tau = t1;
      if (this.met && this.tau >= this.plan.meet + JOUST.after) {
        this.riding = false;
        ev.push({ type: 'passDone', pass: this.pass });
        if (this.pass + 1 >= JOUST.passes) { this.done = true; this.won = this.points >= this.plan.need; ev.push({ type: 'done', won: this.won, points: this.points, need: this.plan.need }); }
      }
    }
    return ev;
  }
  // the tip with the bob, now (for the aim dot)
  tipNow() { const b = bobAt(this.plan, Math.max(0, this.pass), Math.min(this.tau, this.plan.meet)); return [this.tip[0] + b[0], this.tip[1] + b[1]]; }
  starNow() { return starAt(this.plan, Math.max(0, this.pass), Math.min(this.tau, this.plan.meet)); }
}
