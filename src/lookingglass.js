// Wave 18: the Looking-Glass Rooms, the Mirror Palace's east wing (plans/wave18-mirror.md 4.2). PURE rules (imports only bounceback.js's mirrorHelp, which
// imports kindhelp.js), Node-runnable. You walk on your side of a glass wall; your silver twin walks on the other side and copies every step you take
// (the mirror image: you go toward the glass, it goes toward the glass). It is blocked by the things on its side, and you are not: then you get OUT OF
// STEP, which is the trick of the last room. A pad pair glows when you stand on yours and the twin stands on its own at the same moment for 0.5 s;
// all pairs of a room glowing = the room is won. Ink puddles (the Scribble's ink), bonk balls and a mop (things on closed-form paths of the room's own
// clock) puff BOTH of you back to the last glowing pair.
//
// Room-local coordinates on each side: u = distance from the glass (0..18), v = along the room (0..16). Equal u / v on the two sides are exact mirror images.
// The twin's moves are fed by Player.stepHook: after every walk sub-step the real displacement of the player in u / v comes here (tick), so it moves on exactly
// the same sub-steps at 60 and 20 frames a second.
import { mirrorHelp } from './bounceback.js';

export const TWIN_RULES = { half: 0.3, width: 18, depth: 16, padR: 0.7, padTime: 0.5, ballR: 0.9, mopThick: 0.45, grace: 0.8, rooms: 3 };
export const HARD = { twin: { balls: 1.15, mop: 1.15, puddle: 1.1 } }; // a rematch (you hold the star)
export const pathHit = (x0, y0, x1, y1, px, py, r) => { // does the segment pass within r of the point?
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
  return Math.hypot(x0 + dx * t - px, y0 + dy * t - py) < r;
};
const tri = x => { const y = ((x % 1) + 1) % 1; return y < 0.5 ? 2 * y : 2 - 2 * y; };
export const ballU = (lane, bt) => 1 + 16 * tri((bt + lane.phase) / lane.period); // a bonk ball rolls to and fro along u 1..17
export const mopAngle = (mop, mt) => 1 + mop.rate * mt;

export class TwinRoom {
  // data = one TWIN_ROOMS entry; opts { help: misses in a row, hard, phase (where the balls and the mop start, s: a different one each try), blocked(u, v) -> true if the TWIN's body can't be there (a world-based test for the page) }
  constructor(data, { help = 0, hard = false, blocked = null, phase = 0 } = {}) {
    const k = mirrorHelp(help), H = hard ? HARD.twin : { balls: 1, mop: 1, puddle: 1 };
    this.data = data; this.k = k; this.hard = !!hard; this.padR = TWIN_RULES.padR * k.pad;
    this.ballK = k.balls / H.balls; this.mopK = k.mop / H.mop; this.puddleK = k.puddle * H.puddle;
    this.blockedFn = blocked;
    this.started = false; this.won = false; this.t = 0; this.bt = phase; this.mt = phase; this.grace = 0; this.misses = 0;
    this.you = { u: 0, v: 0 }; this.twin = { u: 0, v: 0 }; this.ckp = null;
    this.lit = data.pads.map(() => false); this.padT = data.pads.map(() => 0);
  }
  clone() { const c = Object.create(TwinRoom.prototype); Object.assign(c, this); c.you = { ...this.you }; c.twin = { ...this.twin }; c.ckp = this.ckp && { you: [...this.ckp.you], its: [...this.ckp.its] }; c.lit = [...this.lit]; c.padT = [...this.padT]; return c; }
  // is a point on `side` inside a wall of the room or one of its dressers?
  blockedAt(side, u, v) {
    const R = TWIN_RULES;
    if (side === 'its' && this.blockedFn) return this.blockedFn(u, v); // (the page: the real blocks and doors)
    if (u < 0 || u > R.width || v < 0 || v > R.depth) return true;
    for (const d of this.data.dressers) if (d.side === side && u >= d.u[0] && u <= d.u[1] + 1 && v >= d.v && v <= d.v + 1) return true;
    return false;
  }
  fits(side, u, v) { const h = TWIN_RULES.half; return !(this.blockedAt(side, u - h, v - h) || this.blockedAt(side, u + h, v - h) || this.blockedAt(side, u - h, v + h) || this.blockedAt(side, u + h, v + h)); }
  // the twin is started as your mirror image (or the nearest free spot)
  place(u, v) {
    if (this.fits('its', u, v)) { this.twin.u = u; this.twin.v = v; return; }
    for (let r = 0.25; r < 6; r += 0.25) for (let a = 0; a < 16; a++) { const nu = u + Math.cos(a / 16 * Math.PI * 2) * r, nv = v + Math.sin(a / 16 * Math.PI * 2) * r; if (this.fits('its', nu, nv)) { this.twin.u = nu; this.twin.v = nv; return; } }
  }
  begin(you) {
    this.started = true; this.you = { u: you.u, v: you.v }; this.place(you.u, you.v);
    this.ckp = { you: [you.u, you.v], its: [this.twin.u, this.twin.v] };
  }
  moveTwin(du, dv) { // axis by axis (the player's own rule), in pieces so a fast step cannot jump a dresser
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(du), Math.abs(dv)) / 0.1)), a = du / n, b = dv / n, t = this.twin;
    for (let i = 0; i < n; i++) { if (this.fits('its', t.u + a, t.v)) t.u += a; if (this.fits('its', t.u, t.v + b)) t.v += b; }
  }
  ballsAt() { return this.data.balls.map(l => ({ side: l.side, v: l.v, u: ballU(l, this.bt) })); }
  mopAt() { const m = this.data.mop; if (!m) return null; const a = mopAngle(m, this.mt); return { side: m.side, u: m.u, v: m.v, a, tipU: m.u + Math.cos(a) * m.len, tipV: m.v + Math.sin(a) * m.len }; }
  // One sub-step of h seconds: you are now at `you` (u, v) after moving (du, dv) in room coordinates. Returns the events: glow / won / puff { why, side, you, its }.
  tick(h, you, du = 0, dv = 0) {
    const ev = [], R = TWIN_RULES, D = this.data;
    if (!this.started) return ev;
    this.you.u = you.u; this.you.v = you.v;
    this.t += h; this.bt += h * this.ballK; this.mt += h * this.mopK; this.grace = Math.max(0, this.grace - h);
    this.moveTwin(du, dv);
    if (this.won) return ev;
    // pads: both of you on a pair for padTime in a row
    D.pads.forEach((p, i) => {
      if (this.lit[i]) return;
      const on = Math.hypot(you.u - p.you[0], you.v - p.you[1]) <= this.padR && Math.hypot(this.twin.u - p.its[0], this.twin.v - p.its[1]) <= this.padR;
      this.padT[i] = on ? this.padT[i] + h : 0;
      if (this.padT[i] >= R.padTime) { this.lit[i] = true; this.ckp = { you: [...p.you], its: [...p.its] }; ev.push({ type: 'glow', i }); }
    });
    if (this.lit.every(Boolean)) { this.won = true; ev.push({ type: 'won' }); return ev; }
    // things in the way: one touch puffs both of you back to the last glowing pair
    if (this.grace <= 0) {
      let why = null, side = null;
      const ent = s => (s === 'you' ? you : this.twin), body = R.half;
      for (const p of D.puddles) { const e = ent(p.side); if (Math.hypot(e.u - p.u, e.v - p.v) < p.r * this.puddleK + 0.1) { why = 'plop'; side = p.side; break; } }
      if (!why) for (const b of this.ballsAt()) { const e = ent(b.side); if (Math.hypot(e.u - b.u, e.v - b.v) < R.ballR + body) { why = 'bonk'; side = b.side; break; } }
      const m = !why && this.mopAt();
      if (m) { const e = ent(m.side); if (pathHit(m.u, m.v, m.tipU, m.tipV, e.u, e.v, R.mopThick + body)) { why = 'bonk'; side = m.side; } }
      if (why) {
        this.misses++; this.grace = R.grace;
        this.twin.u = this.ckp.its[0]; this.twin.v = this.ckp.its[1];
        ev.push({ type: 'puff', why, side, you: [...this.ckp.you], its: [...this.ckp.its] });
      }
    }
    return ev;
  }
}
export { mirrorHelp };
