// Bounce-Back for two (owner 2026-11-28, plans/friend-games-next.md section 2): the Mirror Palace's court with a friend in Copycat Cleo's place.
// PURE rules, Node-runnable, fixed 1/120 s sub-steps (60 and 20 frames a second play the same rally). It reuses bounceback.js's ball and mirror
// maths unchanged (advanceBall, hitDir, angle in = angle out, outMax); BounceRound and the single-player game are not touched.
//
// Like pong: each player defends their whole end. Your hand mirror slides on your rail and tilts by the way you look, exactly as in the
// single-player game; a ball that gets past your mirror is a point for the other. The side mirrors bounce as ever; both ends are open (no back
// mirror, no goal mouth) and there is no spinner. A serve comes from the middle toward the one who lost the last point. The ball starts at round
// 1's speed and gets a little faster every hit (DUEL_RULES.speedUp, up to speedCap: a long rally ends, a ball
// sent across fast outruns a mirror that only follows the ball with its eyes). First to 3.
//
// Coordinates: the court's own u (0..16 across, x = 20 + u) and v (0..30 along, z = 117.5 - v). Side 0 (the leader) stands at v 1.5 (the
// single-player rail), side 1 (the friend) at v 28.5 (Cleo's line). Each player sees the court from their own end: side 1's own view is the
// court turned half round (u -> 16 - u, v -> 30 - v), so its mirror's u, its tilt and its stick are in ITS OWN coordinates (m[1], tilt[1]) and
// both players get exactly the same rules ("my end is near").
//
// Two computers (bounceduel.js): each runs this court. A side is `decides[side]` on the computer of the player standing there: only that
// computer says whether its own mirror hit the ball (it sees its own mirror exactly, so the ball never goes through your mirror on your screen),
// and it says a miss. For the friend's side the court only GUESSES from the friend's last sent mirror ('guess': the ball bounces back at once,
// and the friend's real hit, a message, puts it right; or it rolls on past the line and waits, hidden, for their word).
import { COURT_RULES, advanceBall, hitDir } from './bounceback.js';

const R = COURT_RULES;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export const DUEL_RULES = {
  ball: R.rounds[0].ball, speedUp: 1.05, speedCap: 1.6, need: 3, ready: 2.5, pause: 1.4, serveV: R.l / 2, serveSpread: 4.5, maxDt: 1,
  lines: [R.mirrorV, R.l - R.mirrorV], outs: [R.r, R.l - R.r], // where each side's mirror stands, where a ball past it is out
  open: [-Infinity, Infinity], // advanceBall's "goal mouth": the whole back, so the far end never bounces
};
// A player's own u / v / direction <-> the court's (side 1 is the court turned half round)
export const courtU = (side, u) => (side ? R.w - u : u);
export const courtV = (side, v) => (side ? R.l - v : v);
export const toLocal = (side, b) => (side ? { u: R.w - b.u, v: R.l - b.v, du: -b.du, dv: -b.dv, s: b.s } : { ...b });
// the way you face, measured from looking straight down the court from your end (side 1 looks the other way: yaw pi)
export const facingOf = (side, yaw) => wrap(yaw - (side ? Math.PI : 0));
export const tiltOf = (side, yaw) => clamp(-facingOf(side, yaw), -R.tiltMax, R.tiltMax);
// the serve of point n toward side `to`: from the middle, across by a spread both computers work out the same
export function serveOf(n, to, s = DUEL_RULES.ball) {
  const k = Math.sin(n * 12.9898 + to * 78.233) * 43758.5453, f = k - Math.floor(k); // 0..1 from n alone
  const tu = R.w / 2 + (f * 2 - 1) * DUEL_RULES.serveSpread, tv = DUEL_RULES.lines[to];
  const dx = tu - R.w / 2, dy = tv - DUEL_RULES.serveV, d = Math.hypot(dx, dy);
  return { u: R.w / 2, v: DUEL_RULES.serveV, du: dx / d, dv: dy / d, s, cool: 0 };
}

export class DuelCourt {
  // decides: which sides this computer judges (Node: both); auto: the court keeps the score and serves by itself (Node bots; bounceduel.js
  // does it with messages instead)
  constructor({ ball = DUEL_RULES.ball, decides = [true, true], auto = false } = {}) {
    this.base = ball; this.decides = decides; this.auto = auto;
    this.m = [R.w / 2, R.w / 2]; this.tilt = [0, 0]; this.ball = null; this.phase = auto ? 'ready' : 'idle'; this.wait = auto ? DUEL_RULES.ready : 0;
    this.q = 0; this.own = -1; this.dead = -1; this.n = 0; this.score = [0, 0]; this.done = false; this.winner = null; this.to = 1;
    this.hits = 0; this.rally = 0; this.time = 0; this.acc = 0; this.in = [null, null];
  }
  // the hit width of a mirror (half), as in the single-player game
  get reach() { return R.half + R.r; }
  // Advance by dt (any frame: fixed sub-steps) with inputs [side 0, side 1]: { slide: -1..1 across in that player's own view, tilt: radians }
  // or null (that mirror stays as set by setMirror). Returns the events.
  update(dt, inputs = [null, null]) {
    const ev = [];
    if (this.done) return ev;
    this.acc += Math.min(dt, DUEL_RULES.maxDt);
    this.in = inputs;
    while (this.acc >= R.step - 1e-12 && !this.done) { this.acc -= R.step; this.step(R.step, ev); }
    return ev;
  }
  setMirror(side, u, tilt) {
    if (Number.isFinite(u)) this.m[side] = clamp(u, R.rail[0], R.rail[1]);
    if (Number.isFinite(tilt)) this.tilt[side] = clamp(tilt, -R.tiltMax, R.tiltMax);
  }
  step(h, ev) {
    this.time += h;
    for (const side of [0, 1]) {
      const inp = this.in[side];
      if (!inp) continue;
      this.m[side] = clamp(this.m[side] + clamp(inp.slide || 0, -1, 1) * R.slideSpeed * h, R.rail[0], R.rail[1]);
      this.tilt[side] = clamp(inp.tilt || 0, -R.tiltMax, R.tiltMax);
    }
    if (this.auto && (this.phase === 'ready' || this.phase === 'pause')) { this.wait -= h; if (this.wait <= 0) this.serve(this.n + 1, this.to, ev); return; }
    const b = this.ball;
    if (this.phase !== 'rally' || !b) return;
    const pv = b.v;
    for (const e of advanceBall(b, h, { mouth: DUEL_RULES.open, spin: null })) ev.push({ type: 'bounce', where: e });
    const L = DUEL_RULES.lines, O = DUEL_RULES.outs;
    if (b.dv < 0 && pv > L[0] && b.v <= L[0]) this.meet(0, ev);
    else if (b.dv > 0 && pv < L[1] && b.v >= L[1]) this.meet(1, ev);
    else if (b.dv < 0 && b.v <= O[0]) this.past(0, ev);
    else if (b.dv > 0 && b.v >= O[1]) this.past(1, ev);
  }
  // the ball reaches side's mirror line
  meet(side, ev) {
    const b = this.ball, mu = courtU(side, this.m[side]);
    if (Math.abs(b.u - mu) > this.reach) return; // past the mirror: it rolls on to the end
    const d = hitDir([side ? -b.du : b.du, side ? -b.dv : b.dv], this.tilt[side]);
    b.du = side ? -d[0] : d[0]; b.dv = side ? -d[1] : d[1];
    b.v = DUEL_RULES.lines[side] + (side ? -0.001 : 0.001);
    b.s = Math.min(b.s * DUEL_RULES.speedUp, this.base * DUEL_RULES.speedCap);
    if (this.decides[side]) { this.q++; this.own = side; this.hits++; this.rally++; ev.push({ type: 'hit', side, tilt: this.tilt[side], u: b.u }); }
    else ev.push({ type: 'guess', side, u: b.u });
  }
  // the ball got past side's mirror
  past(side, ev) {
    this.dead = this.q;
    if (!this.decides[side]) { this.phase = 'wait'; ev.push({ type: 'gone', side }); return; } // (their computer says)
    this.ball = null; this.phase = 'idle';
    ev.push({ type: 'miss', side, q: this.q });
    if (this.auto) this.point(1 - side, ev);
  }
  // a point for `side` (auto: the court's own score; bounceduel.js: the leader's word)
  point(side, ev = []) {
    this.ball = null; this.phase = 'idle'; this.score[side]++; this.to = 1 - side;
    ev.push({ type: 'point', side, score: [...this.score] });
    if (this.score[side] >= DUEL_RULES.need) { this.done = true; this.winner = side; ev.push({ type: 'done', winner: side, score: [...this.score] }); }
    else if (this.auto) { this.phase = 'pause'; this.wait = DUEL_RULES.pause; }
    return ev;
  }
  serve(n, to, ev = []) {
    this.n = n; this.to = to; this.q = n * 1000; this.own = -1; this.dead = -1; this.rally = 0;
    this.ball = serveOf(n, to, this.base); this.phase = 'rally';
    ev.push({ type: 'serve', n, to });
    return ev;
  }
  // The ball as it is now, for a message: [u, v, du, dv, s]
  stateOf() { const b = this.ball; return b ? [b.u, b.v, b.du, b.dv, b.s].map(x => +x.toFixed(4)) : null; }
  // A state from the computer of side `from` (the owner: it hit the ball last). True = taken.
  apply(m, from) {
    if (!m || !Array.isArray(m.b) || m.b.length !== 5 || !m.b.every(Number.isFinite) || !Number.isFinite(m.q) || this.decides[from] || this.done) return false;
    if (Math.floor(m.q / 1000) !== this.n) return false;       // another point's ball
    if (m.q <= this.dead) return false;                         // this ball already got past someone
    if (!(m.q > this.q || (m.q === this.q && this.own === from))) return false;
    const [u, v, du, dv, s] = m.b;
    this.ball = { u, v, du, dv, s, cool: 0 }; this.q = m.q; this.own = from; this.phase = 'rally';
    return true;
  }
  // For bots: where a ball coming at `side` will cross its line, in that side's own u, and in how long (walls only)
  arrival(side) {
    const b = this.ball;
    if (!b || this.phase !== 'rally' || (side ? b.dv <= 0 : b.dv >= 0)) return null;
    const c = { ...b }, L = DUEL_RULES.lines[side];
    let t = 0;
    for (let i = 0; i < 12000 && (side ? c.v < L : c.v > L); i++) { advanceBall(c, R.step, { mouth: DUEL_RULES.open, spin: null }); t += R.step; }
    return { u: side ? R.w - c.u : c.u, t, ball: c };
  }
  // For bots: where my return at `tilt` would cross the other line (their own u) if I hit `ball` now
  forecast(side, ball, tilt) {
    const c = { ...ball }, d = hitDir([side ? -c.du : c.du, side ? -c.dv : c.dv], tilt);
    c.du = side ? -d[0] : d[0]; c.dv = side ? -d[1] : d[1];
    const o = 1 - side, L = DUEL_RULES.lines[o];
    let t = 0;
    for (let i = 0; i < 12000 && (o ? c.v < L : c.v > L); i++) { advanceBall(c, R.step, { mouth: DUEL_RULES.open, spin: null }); t += R.step; }
    return { u: o ? R.w - c.u : c.u, t };
  }
}
