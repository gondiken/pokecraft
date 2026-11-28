// The Joust for two (owner 2026-11-28): two friends on steeds ride at each other down the Tilt Yard's two lanes; each steers their lance
// tip onto the gold spot on the FRIEND's shield. PURE rules, Node-runnable (only joust.js's pure maths and siege.js's seeded random), fixed
// 1/120 s sub-steps like JoustRound, so 60 and 20 frames a second give the same pass. joust.js and the single-player game are not touched.
//
// A pass: Charge! comes for both at once (the leader's `go`); you meet at DUEL_JOUST.meet s. Your lance tip moves exactly as in the
// single-player Joust (the stick, a mouse / a drag, the gallop's bob, it stops moving at the meeting). The gold spot on each shield is a
// closed form of the pass (passes 1-2: it stands still at one of JOUST.spots, 3-4: it slides round the shield, 5 on: it slides faster),
// PLUS your own lean: your shield follows your lance a little (`lean` x your tip), so your friend has to lead a spot that wobbles as you
// aim, and you cannot hold your shield still while you aim. At the meeting a tip within `r` of the friend's spot is a Hit (a point);
// on the shield it is a Clang, past it a Whoosh (nothing). Both can hit in the same pass. First to `need` hits with more than the friend;
// level after `maxPasses` = a draw.
//
// Two computers (joustduel.js): the DEFENDER decides. Only my computer knows my own tip (so my lean) at my meeting exactly, so my
// computer judges the friend's lance against MY shield, from their tip at THEIR meeting (sent as a message). The leader counts.
import { JOUST, gallopAt, ellipseAt } from './joust.js';
import { seeded, hashStr } from './siege.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const DUEL_JOUST = {
  need: 3, maxPasses: 10, meet: 3.0, after: 2.6, ready: 2.5, rest: 1.6, len: 52, accel: JOUST.accel,
  r: 0.3, shield: JOUST.shield, lean: 0.25, levels: [0, 0, 1, 1, 2],   // pass n's level (the last for every later pass)
  tipSpeed: JOUST.tipSpeed, lim: JOUST.lim, mouse: JOUST.mouse, dt: 1 / 120, maxDt: 1,
};
// the gallop speed that brings both to the middle of the lane exactly at the meeting
export const gallopV = (D = DUEL_JOUST) => (D.len / 2) / (D.meet - D.accel / 2);
// how far a rider has gone at pass time tau (0 .. len)
export const rodeAt = tau => Math.min(DUEL_JOUST.len, gallopAt(Math.max(0, tau), gallopV(), DUEL_JOUST.accel));
export const levelOf = n => DUEL_JOUST.levels[Math.min(DUEL_JOUST.levels.length - 1, Math.max(0, n - 1))];
// which way side `side` rides in pass n (+1 = toward x1): the leader starts at the west end, the friend at the east end, then they turn
export const dirOf = (side, n) => ((n % 2 === 1) === (side === 0) ? 1 : -1);

// The plan of pass n (1, 2, ...) for a game seed: both shields' gold spots and both riders' bobs. The same on both computers.
export function passPlan(seed, n) {
  const rnd = seeded(hashStr(`jduel|${seed >>> 0}|${n}`)), level = levelOf(n);
  const spots = [0, 1].map(() => ({ spot: JOUST.spots[Math.floor(rnd() * JOUST.spots.length)], phi: rnd() * Math.PI * 2, dir: rnd() < 0.5 ? -1 : 1 }));
  const bobs = [0, 1].map(() => ({ phiU: rnd() * Math.PI * 2, phiV: rnd() * 0.5 }));
  return { n, level, w: JOUST.omega[level], amp: JOUST.amp[level], spots, bobs, meet: DUEL_JOUST.meet, r: DUEL_JOUST.r };
}
// The gallop bob of side's lance tip at tau: [u, v] (joust.js bobAt's sums)
export function bobOf(plan, side, tau) {
  const [au, av] = plan.amp, b = plan.bobs[side];
  return [au * Math.sin(2 * Math.PI * 1.3 * tau + b.phiU), av * (Math.abs(Math.sin(2.4 * Math.PI * tau + b.phiV)) - 0.64)];
}
// The gold spot on side's shield at tau, without the lean
export function spotBase(plan, side, tau) {
  const s = plan.spots[side];
  if (plan.level === 0) return s.spot.slice();
  return ellipseAt(s.phi + s.dir * plan.w * tau);
}
// ... and with side's own lean (its own tip, without the bob)
export function spotAt(plan, side, tau, tip = [0, 0]) {
  const b = spotBase(plan, side, tau), L = DUEL_JOUST.lean;
  return [b[0] + L * (tip?.[0] || 0), b[1] + L * (tip?.[1] || 0)];
}
// The result of side a's lance at the meeting against the other side's shield: a's tip (no bob) and the defender's own tip at ITS meeting.
export function lanceResult(plan, a, tipA, tipD) {
  const bob = bobOf(plan, a, plan.meet), spot = spotAt(plan, 1 - a, plan.meet, tipD);
  const d = Math.hypot(tipA[0] + bob[0] - spot[0], tipA[1] + bob[1] - spot[1]);
  return { d, kind: d <= plan.r ? 'hit' : d <= DUEL_JOUST.shield ? 'clang' : 'whoosh' };
}

// One side's pass on one computer: the lance tip, stepped like JoustRound. update(dt, { su, sv, du, dv }) -> [{ type: 'meet', tip }, { type: 'end' }]
export class Rider {
  constructor(plan, side, tau = 0) { this.plan = plan; this.side = side; this.tau = tau; this.tip = [0, 0]; this.met = tau >= plan.meet; this.ended = false; this.acc = 0; }
  update(dt, input = {}) {
    const ev = [], D = DUEL_JOUST;
    if (this.ended) return ev;
    if (!this.met) { // a mouse / a drag moves the tip at once
      this.tip[0] = clamp(this.tip[0] + (input.du || 0), -D.lim[0], D.lim[0]);
      this.tip[1] = clamp(this.tip[1] + (input.dv || 0), -D.lim[1], D.lim[1]);
    }
    const su = clamp(input.su || 0, -1, 1), sv = clamp(input.sv || 0, -1, 1);
    this.acc += Math.min(Math.max(0, dt), D.maxDt);
    while (this.acc >= D.dt - 1e-12 && !this.ended) {
      this.acc -= D.dt;
      const t1 = this.tau + D.dt;
      if (!this.met) {
        const h = Math.min(D.dt, this.plan.meet - this.tau);
        this.tip[0] = clamp(this.tip[0] + su * D.tipSpeed * h, -D.lim[0], D.lim[0]);
        this.tip[1] = clamp(this.tip[1] + sv * D.tipSpeed * h, -D.lim[1], D.lim[1]);
        if (t1 >= this.plan.meet - 1e-9) { this.met = true; ev.push({ type: 'meet', tip: this.tip.slice() }); }
      }
      this.tau = t1;
      if (this.met && this.tau >= this.plan.meet + D.after - 1e-9) { this.ended = true; ev.push({ type: 'end' }); }
    }
    return ev;
  }
  tipNow() { const b = bobOf(this.plan, this.side, Math.min(this.tau, this.plan.meet)); return [this.tip[0] + b[0], this.tip[1] + b[1]]; }
}

// The leader's count: per pass both lances' results; the winner. kinds[side] = what side's lance did.
export class JoustScore {
  constructor() { this.score = [0, 0]; this.passes = {}; this.n = 0; }
  // the results of pass n (both known): true = new
  add(n, kinds) {
    if (this.passes[n] || !Array.isArray(kinds) || kinds.length !== 2) return false;
    this.passes[n] = kinds.slice(); this.n = Math.max(this.n, n);
    for (const s of [0, 1]) if (kinds[s] === 'hit') this.score[s]++;
    return true;
  }
  // 0 / 1 = that side won, 'draw', or null (play on)
  get winner() {
    const [a, b] = this.score, D = DUEL_JOUST;
    if ((a >= D.need || b >= D.need) && a !== b) return a > b ? 0 : 1;
    if (this.n >= D.maxPasses) return a === b ? 'draw' : a > b ? 0 : 1;
    return null;
  }
  load(score, n) { if (Array.isArray(score) && score.length === 2 && score.every(Number.isInteger)) this.score = [...score]; if (Number.isInteger(n)) this.n = Math.max(this.n, n); }
}
