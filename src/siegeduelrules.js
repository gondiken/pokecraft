// Shield Up! for two (owner 2026-11-28): one friend throws with the Castle's catapults, the other blocks on a Shield Stone, then they
// swap. PURE rules, Node-runnable (siege.js's pure maths only: judge, dirTo, spotPos, the round's tells and flights), fixed 1/120 s
// sub-steps like SiegeRound, so 60 and 20 frames a second judge the same. siege.js and the single-player game are not touched.
//
// The defender stands on Shield Stone 1 exactly as in the single-player game (the stick points the shield, Jump holds it over your head);
// every throw is judged with the same rule and the same grace window (siege.js judge, SIEGE.grace). The thrower stands on the other stone
// and LOOKS at the catapult to throw from (the one nearest the middle of the view; looking high up = a sky pumpkin lobbed over the
// defender's head) and presses Throw!. A throw has the round-2 tell and flight of the single-player game (the arm pulls back, then it
// flies), and the next throw can come only `cool` s later, so mashing Throw! never beats a defender who watches. A block is a point for
// the defender, a splat a point for the thrower. Turn 1: the friend who was asked defends `throws` throws, turn 2 the other way round;
// level = one more throw each (turns 3 and 4); still level = a draw.
//
// Two computers (siegeduel.js): the THROWER's computer sends each throw (which catapult, which kind); the DEFENDER's computer starts its
// tell when the throw arrives (so the tell is always whole on the defender's screen, whatever the line), judges block or splat, and says
// so; the leader counts.
import { SIEGE, judge, dirTo, spotPos, throwAt } from './siege.js';

const RANK = { splat: 0, block: 1, perfect: 2 };
export const DUEL_SHIELD = {
  throws: 8, extra: 1, cool: 0.8, idle: 8, ready: 2.5, swap: 2.6, skyPitch: 0.6, round: 1,
  defStone: 0, throwStone: 1, dt: 1 / 120, maxDt: 1,
};
// The turns: who defends and how many throws. Turn 1 = the friend (side 1) defends.
export const turnOf = t => ({ t, def: t % 2 === 1 ? 1 : 0, n: t <= 2 ? DUEL_SHIELD.throws : DUEL_SHIELD.extra });
// A throw of kind 'pumpkin' | 'sky' from catapult k (0..11): its tell and flight are the single-player round 2's.
export function throwOf(i, k, kind) {
  const R = DUEL_SHIELD.round, sky = kind === 'sky';
  return { i, k, kind: sky ? 'sky' : 'pumpkin', tell: SIEGE.tell[sky ? 'sky' : 'pumpkin'][R], flight: sky ? SIEGE.flight.sky : SIEGE.flight.pumpkin[R] };
}
// Which catapult the thrower looks at, from its eye and view direction (forward = [x, y, z], unit): the spot nearest the middle of the
// view; looking high up (pitch over skyPitch) = a sky pumpkin (from the catapult nearest the way you face).
export function aimOf(eye, yaw, pitch) {
  const fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
  let best = 0, bestCos = -2;
  for (let k = 0; k < 12; k++) {
    const s = spotPos(k), dx = s[0] - eye[0], dy = (pitch > DUEL_SHIELD.skyPitch ? 0 : s[1] - eye[1]), dz = s[2] - eye[2], d = Math.hypot(dx, dy, dz) || 1;
    const c = pitch > DUEL_SHIELD.skyPitch ? (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / Math.hypot(dx, dz) : (dx * fx + dy * fy + dz * fz) / d;
    if (c > bestCos) { bestCos = c; best = k; }
  }
  return { k: best, kind: pitch > DUEL_SHIELD.skyPitch ? 'sky' : 'pumpkin' };
}

// One turn's throws on one computer, shaped like siege.js SiegeRound (castlelive.js draws it the same way: plan.throws, plan.cover, time,
// results, active()). decides = this computer's player defends (it judges); else it only draws the throws (the thrower's own view).
export class ShieldTurn {
  constructor({ t = 1, n = DUEL_SHIELD.throws, decides = true } = {}) {
    this.t = t; this.decides = decides; this.round = DUEL_SHIELD.round;
    this.stand = SIEGE.stones[DUEL_SHIELD.defStone];
    this.plan = { throws: [], n, need: 0, cover: SIEGE.cover };
    this.time = 0; this.acc = 0; this.results = []; this.best = new Map(); this.told = new Set(); this.launched = new Set(); this.done = false;
    this.blocks = 0; this.splats = 0;
  }
  get n() { return this.plan.n; }
  has(i) { return this.plan.throws.some(x => x.i === i); }
  // a throw comes in now (its tell starts now): false if it is already here or too many
  add(t) {
    if (!t || this.has(t.i) || t.i < 0 || t.i >= this.plan.n) return false;
    this.plan.throws.push({ ...t, at: this.time + t.tell + t.flight });
    return true;
  }
  update(dt, input = { ang: 0, up: false }) {
    const ev = [];
    this.acc += Math.min(Math.max(0, dt), DUEL_SHIELD.maxDt);
    while (this.acc >= DUEL_SHIELD.dt - 1e-12) {
      this.acc -= DUEL_SHIELD.dt;
      const t1 = this.time + DUEL_SHIELD.dt;
      for (const t of this.plan.throws) {
        const launch = t.at - t.flight, tellAt = launch - t.tell;
        if (!this.told.has(t.i) && tellAt <= t1) { this.told.add(t.i); ev.push({ type: 'tell', t }); }
        if (!this.launched.has(t.i) && launch <= t1) { this.launched.add(t.i); ev.push({ type: 'launch', t }); }
        if (!this.decides) { if (this.results[t.i] === undefined && t.at <= t1) { this.results[t.i] = 'gone'; ev.push({ type: 'arrive', t }); } continue; }
        if (this.results[t.i] === undefined && t1 > t.at - SIEGE.grace.before) {
          const now = judge(t, this.stand, input.ang, !!input.up, this.plan.cover), was = this.best.get(t.i);
          if (was === undefined || RANK[now] > RANK[was]) this.best.set(t.i, now);
        }
        if (this.results[t.i] === undefined && t.at + SIEGE.grace.after <= t1) {
          const r = this.best.get(t.i) ?? 'splat';
          this.results[t.i] = r;
          if (r === 'splat') this.splats++; else this.blocks++;
          ev.push({ type: 'hit', t, result: r });
        }
      }
      this.time = t1;
    }
    return ev;
  }
  // the throws you can see now (tell or flying)
  active() {
    const out = [];
    for (const t of this.plan.throws) { const a = throwAt(t, this.stand, this.time); if ((a.phase === 'tell' || a.phase === 'fly') && this.results[t.i] === undefined) out.push({ t, ...a }); }
    return out;
  }
}
// The thrower's cool-down: may it throw now (its own clock, `last` = when it threw last, null = never)?
export const canThrow = (now, last, thrown, n) => thrown < n && (last == null || now - last >= DUEL_SHIELD.cool - 1e-9);

// The leader's count: one point per throw, to the defender for a block, to the thrower for a splat. -> { score, winner }
export class ShieldScore {
  constructor() { this.score = [0, 0]; this.seen = new Set(); this.counted = {}; }
  // throw i of turn t (defender def) came out `result`: true = new
  add(t, i, result) {
    const key = `${t}:${i}`;
    if (this.seen.has(key) || !['block', 'perfect', 'splat'].includes(result)) return false;
    this.seen.add(key);
    const def = turnOf(t).def;
    this.score[result === 'splat' ? 1 - def : def]++;
    this.counted[t] = (this.counted[t] || 0) + 1;
    return true;
  }
  turnDone(t) { return (this.counted[t] || 0) >= turnOf(t).n; }
  // after turn t: 0 / 1 = won, 'draw', or null (play the next turn)
  after(t) {
    const [a, b] = this.score;
    if (t < 2 || t % 2 === 1) return null;
    if (a !== b) return a > b ? 0 : 1;
    return t >= 4 ? 'draw' : null;
  }
  load(score) { if (Array.isArray(score) && score.length === 2 && score.every(Number.isInteger)) this.score = [...score]; }
}
export { dirTo };
