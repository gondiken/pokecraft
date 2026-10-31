// Wave 18: Bounce-Back, the Mirror Palace's west wing (plans/wave18-mirror.md 4.1). PURE rules (imports only kindhelp.js), Node-runnable, fixed 1/120 s
// sub-steps so 60 and 20 frames a second play the same rally. You slide a hand mirror along your end of a mirror court and tilt it (the way you look);
// the shine ball bounces off it the way light does (angle in = angle out about the mirror's face), off the side mirrors the same way, and Copycat
// Cleo at the far end copies you: she stands where you stand, so a straight return goes straight back to her. Angle it away from where you stand,
// or bank it off a side mirror, into the goal mouth. First to 3; if Cleo gets 3 first the round starts again (a miss, for the kind help).
//
// Court-local coordinates: u across (0..16, east), v along (0 = your end, 30 = the back mirror). Your mirror sits at v 1.5 on a rail (u 0.8..15.2).
import { kindHelp } from './kindhelp.js';

const rad = d => d * Math.PI / 180;
export const COURT_RULES = {
  w: 16, l: 30, r: 0.35, mirrorV: 1.5, half: 0.8, slideSpeed: 5.5, rail: [0.8, 15.2], tiltMax: rad(40), outMax: rad(70),
  speedUp: 1.03, speedCap: 1.3, cleoV: 28.5, cleoHalf: 0.9, copyLag: 0.3, copyRate: 9, mouth: [4, 12], need: 3, pause: 1.1, step: 1 / 120,
  spinner: { u: 8, v: 15, half: 1.5, rate: 0.5, thick: 0.12 }, spinCool: 0.15,
  // per round: ball speed, how soon before her line Cleo reads the ball (react, s), how fast she slides then (slide, blocks/s), how far from you her returns land (jitter)
  rounds: [
    { name: 'Hello, Cleo!', ball: 6.0, react: 0.6, slide: 2.0, jitter: 0.9, spinner: false },
    { name: 'Cleo is quick!', ball: 7.2, react: 1.0, slide: 3.2, jitter: 1.6, spinner: false },
    { name: 'The spinner!', ball: 8.2, react: 1.2, slide: 3.8, jitter: 2.0, spinner: true },
  ],
};
export const HARD = { court: { ball: 1.1, react: 0.2, slide: 1.15 } }; // a rematch (you hold the star)
// The kind help mapped onto this game's levers (one mapping, kindHelp(misses) underneath). Re-exported by lookingglass.js and spotlight.js, which add their own.
export const mirrorHelp = misses => {
  const k = kindHelp(misses);
  return { ...k, ball: k.slow, cleoReact: k.slow, cleoSlide: k.slow, mouth: k.more, balls: k.slow, mop: k.slow, pad: k.more, puddle: k.slow, gloomy: k.slow, hold: k.slow, spot: k.more };
};

const mulberry = a => () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// perfect reflection of a direction d = [du, dv] about a unit normal n
export const reflect = (d, n) => { const k = 2 * (d[0] * n[0] + d[1] * n[1]); return [d[0] - k * n[0], d[1] - k * n[1]]; };
// the mirror's face normal for a tilt (+ = leaning toward +u): straight up the court when 0
export const normalOf = tilt => [Math.sin(tilt), Math.cos(tilt)];
// what a ball with unit direction d (heading toward you) does at your mirror: the reflection, the outgoing angle held within outMax of straight
export function hitDir(d, tilt) {
  const n = normalOf(tilt);
  let out = (d[0] * n[0] + d[1] * n[1]) < 0 ? reflect(d, n) : reflect(d, [0, 1]);
  const phi = clamp(Math.atan2(out[0], out[1]), -COURT_RULES.outMax, COURT_RULES.outMax);
  return [Math.sin(phi), Math.cos(phi)];
}
// where a ball heading up the court (dv > 0) from (u, v) would cross v = line if only the two side mirrors were there (the unfolded path); Cleo reads the ball this way
export function wallCross(b, line = COURT_RULES.cleoV) {
  const { w, r } = COURT_RULES;
  if (!(b.dv > 1e-6)) return null;
  const t = (line - b.v) / (b.dv * b.s), lo = r, W = w - 2 * r, x = b.u + b.du * b.s * t - lo, y = ((x % (2 * W)) + 2 * W) % (2 * W);
  return { t, u: lo + (y <= W ? y : 2 * W - y) };
}
// one sub-step of a ball against the walls, the back mirror (not the goal mouth) and the spinner. ctx = { mouth: [u0, u1], spin: angle | null }; returns events
export function advanceBall(b, dt, ctx) {
  const { w, l, r, spinner: SP } = COURT_RULES, ev = [];
  b.u += b.du * b.s * dt; b.v += b.dv * b.s * dt;
  if (b.u < r) { b.u = 2 * r - b.u; b.du = -b.du; ev.push('wall'); } else if (b.u > w - r) { b.u = 2 * (w - r) - b.u; b.du = -b.du; ev.push('wall'); }
  if (b.dv > 0 && b.v > l - r && b.v < l && !(b.u >= ctx.mouth[0] && b.u <= ctx.mouth[1])) { b.v = 2 * (l - r) - b.v; b.dv = -b.dv; ev.push('wall'); }
  b.cool = Math.max(0, (b.cool || 0) - dt);
  if (ctx.spin != null && !b.cool) {
    const hx = Math.cos(ctx.spin) * SP.half, hy = Math.sin(ctx.spin) * SP.half, ax = SP.u - hx, ay = SP.v - hy, ex = 2 * hx, ey = 2 * hy;
    const t = clamp(((b.u - ax) * ex + (b.v - ay) * ey) / (ex * ex + ey * ey), 0, 1), px = ax + ex * t, py = ay + ey * t;
    let dx = b.u - px, dy = b.v - py, d = Math.hypot(dx, dy);
    if (d < r + SP.thick) {
      if (d < 1e-6) { dx = -Math.sin(ctx.spin); dy = Math.cos(ctx.spin); d = 1; }
      const n = [dx / d, dy / d];
      if (b.du * n[0] + b.dv * n[1] < 0) { const o = reflect([b.du, b.dv], n); b.du = o[0]; b.dv = o[1]; }
      b.u = px + n[0] * (r + SP.thick + 0.02); b.v = py + n[1] * (r + SP.thick + 0.02); b.cool = COURT_RULES.spinCool; ev.push('spin');
    }
  }
  return ev;
}

export class BounceRound {
  // seed: the world's seed, round 0..2, attempt: how many tries so far (a different serve each time), opts { help: misses in a row, hard }
  constructor(seed, round, attempt = 0, { help = 0, hard = false } = {}) {
    const R = COURT_RULES, p = R.rounds[round];
    this.round = round; this.plan = p; this.hard = !!hard; this.k = mirrorHelp(help); this.rand = mulberry((seed * 2654435761 + round * 7919 + attempt * 104729 + 17) >>> 0);
    const H = hard ? HARD.court : { ball: 1, react: 0, slide: 1 };
    this.base = p.ball * H.ball * this.k.ball;
    this.react = (p.react + H.react) * this.k.cleoReact; this.slide = p.slide * H.slide * this.k.cleoSlide;
    this.mouthHalf = (R.mouth[1] - R.mouth[0]) / 2 * this.k.mouth; this.mouth = [8 - this.mouthHalf, 8 + this.mouthHalf];
    this.m = 8; this.tilt = 0; this.cu = 8; this.time = 0; this.acc = 0; this.hist = [[0, 8]];
    this.you = 0; this.cleo = 0; this.done = false; this.won = false; this.ball = null; this.pause = 0.8; this.phase = 'pause'; this.spin = p.spinner ? 0 : null; this.rallies = 0; this.hits = 0; this.dizzy = 0;
    this.last = null; // the last predicted crossing Cleo read (for the dizzy spin)
  }
  ctx() { return { mouth: this.mouth, spin: this.spin }; }
  // Advance by dt (any frame length: runs fixed sub-steps) with the input { slide: -1..1 (the stick across), tilt: radians (+ = leaning toward +u) }. Returns the events.
  update(dt, input = {}) {
    const R = COURT_RULES, ev = [];
    if (this.done) return ev;
    this.acc += dt;
    this.in = input;
    while (this.acc >= R.step - 1e-12 && !this.done) { this.acc -= R.step; this.step(R.step, ev); }
    return ev;
  }
  step(h, ev) {
    const R = COURT_RULES, inp = this.in || {};
    this.time += h;
    this.m = clamp(this.m + clamp(inp.slide || 0, -1, 1) * R.slideSpeed * h, R.rail[0], R.rail[1]);
    this.tilt = clamp(inp.tilt || 0, -R.tiltMax, R.tiltMax);
    this.hist.push([this.time, this.m]);
    while (this.hist.length > 2 && this.hist[1][0] <= this.time - R.copyLag) this.hist.shift();
    if (this.spin != null) this.spin += R.spinner.rate * h;
    // Cleo: copies where you were `copyLag` ago; once the ball is within `react` s of her line she slides to where it will cross
    const b = this.ball, lagU = this.hist[0][1];
    let target = lagU, rate = R.copyRate;
    if (b) { const wc = wallCross(b); if (wc && wc.t <= this.react && b.v < R.cleoV) { target = wc.u; rate = this.slide; if (this.last != null && Math.abs(wc.u - this.last) > 2.2 && this.spin != null) { this.dizzy = 1.2; ev.push({ type: 'dizzy' }); } this.last = wc.u; } else this.last = null; }
    this.cu = clamp(this.cu + clamp(target - this.cu, -rate * h, rate * h), R.cleoHalf, R.w - R.cleoHalf);
    this.dizzy = Math.max(0, this.dizzy - h);
    if (this.phase === 'pause') { this.pause -= h; if (this.pause <= 0) this.serve(ev); return; }
    const pv = b.v;
    for (const e of advanceBall(b, h, this.ctx())) ev.push({ type: e === 'spin' ? 'spin' : 'bounce', where: e });
    // your mirror: the ball crossing v = mirrorV on its way down within reach of your mirror
    if (b.dv < 0 && pv > R.mirrorV && b.v <= R.mirrorV && Math.abs(b.u - this.m) <= R.half + R.r) {
      const d = hitDir([b.du, b.dv], this.tilt);
      b.du = d[0]; b.dv = d[1]; b.v = R.mirrorV + 0.001; b.s = Math.min(b.s * R.speedUp, this.base * R.speedCap); this.hits++;
      ev.push({ type: 'hit', tilt: this.tilt, angle: Math.atan2(d[0], d[1]), u: b.u });
    } else if (b.v <= R.r) { this.point('cleo', ev); return; }
    // Cleo's mirror: the ball crossing her line on its way up
    if (b.dv > 0 && pv < R.cleoV && b.v >= R.cleoV && Math.abs(b.u - this.cu) <= R.cleoHalf + R.r) {
      const tu = clamp(this.m + (this.rand() * 2 - 1) * this.plan.jitter, 1.5, R.w - 1.5), dx = tu - b.u, dy = R.mirrorV - R.cleoV, d = Math.hypot(dx, dy);
      b.du = dx / d; b.dv = dy / d; b.v = R.cleoV - 0.001; b.s = Math.min(b.s * R.speedUp, this.base * R.speedCap); this.rallies++;
      ev.push({ type: 'cleohit', u: b.u });
    } else if (b.v >= R.l) this.point('you', ev);
  }
  serve(ev) {
    const R = COURT_RULES, tu = clamp(this.m + (this.rand() * 2 - 1) * this.plan.jitter, 1.5, R.w - 1.5), dx = tu - this.cu, dy = R.mirrorV - (R.cleoV - 0.6), d = Math.hypot(dx, dy);
    this.ball = { u: this.cu, v: R.cleoV - 0.6, du: dx / d, dv: dy / d, s: this.base, cool: 0 }; this.phase = 'rally'; this.last = null;
    ev.push({ type: 'serve' });
  }
  point(who, ev) {
    const R = COURT_RULES;
    if (who === 'you') this.you++; else this.cleo++;
    this.ball = null; this.phase = 'pause'; this.pause = R.pause;
    ev.push({ type: 'point', who, you: this.you, cleo: this.cleo });
    if (this.you >= R.need || this.cleo >= R.need) { this.done = true; this.won = this.you >= R.need; ev.push({ type: 'done', won: this.won, you: this.you, cleo: this.cleo }); }
  }
  // For the bots: a copy of the ball after `hit` at tilt `tilt`, run (without Cleo) until it crosses her line or the back wall: -> { u, t, uBack, inMouth }
  forecast(ball, tilt, { hit = true, spin = this.spin } = {}) {
    const R = COURT_RULES, b = { ...ball, cool: ball.cool || 0 }, ctx = { mouth: this.mouth, spin }, spinRate = R.spinner.rate;
    if (hit) { const d = hitDir([b.du, b.dv], tilt); b.du = d[0]; b.dv = d[1]; b.s = Math.min(b.s * R.speedUp, this.base * R.speedCap); }
    let t = 0, cross = null, tc = 0;
    for (let i = 0; i < 4000 && b.v < R.l + 0.01 && b.v > R.r; i++) {
      const pv = b.v;
      advanceBall(b, R.step, ctx); if (ctx.spin != null) ctx.spin += spinRate * R.step; t += R.step;
      if (!cross && b.dv > 0 && pv < R.cleoV && b.v >= R.cleoV) { cross = b.u; tc = t; }
      if (b.dv < 0 && b.v < R.cleoV - 3) break;
    }
    return { u: cross, t: tc, uBack: b.u, inMouth: b.u >= this.mouth[0] && b.u <= this.mouth[1] && b.v >= R.l - 0.01 };
  }
  // where a ball coming down will cross your mirror's line (stepping through walls and the spinner): { u, t, ball }
  arrival() {
    const R = COURT_RULES, b = this.ball;
    if (!b || b.dv >= 0) return null;
    const c = { ...b }, ctx = { mouth: this.mouth, spin: this.spin };
    let t = 0;
    for (let i = 0; i < 6000 && c.v > R.mirrorV; i++) { advanceBall(c, R.step, ctx); if (ctx.spin != null) ctx.spin += R.spinner.rate * R.step; t += R.step; }
    return { u: c.u, t, ball: c, spin: ctx.spin };
  }
}
export const COURT_ROUNDS = COURT_RULES.rounds.length;
