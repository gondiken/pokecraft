// Model players for Bounce-Back for two (src/bounceduelrules.js), Node and page. A bot gets the court and its side every frame and returns that
// frame's input in its OWN view ({ slide, tilt }, held for the whole frame, like a real player). `playDuel` runs a whole game at `fps`.
//   node tests/bounceduelbots.mjs     prints a table (who beats whom, at 60 and 20 frames a second)
import { DuelCourt, DUEL_RULES } from '../src/bounceduelrules.js';
import { COURT_RULES } from '../src/bounceback.js';

const R = COURT_RULES;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const deg = d => d * Math.PI / 180;
const lcg = seed => { let a = seed >>> 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };
const toLocalBall = (b, side) => (side ? { u: R.w - b.u, v: R.l - b.v, du: -b.du, dv: -b.dv, s: b.s } : b);
const toward = (u, m, dt) => clamp((u - m) / (DUEL_RULES.slide * dt), -1, 1);

export const DUEL_BOTS = {
  // the "naive kid": never moves, never tilts
  still: () => () => ({ slide: 0, tilt: 0 }),
  // slides under every ball, never tilts: a flat mirror sends it straight back keeping its sideways way
  tracker: () => (c, side, dt) => { const a = c.arrival(side); return { slide: a ? toward(a.u, c.m[side], dt) : toward(8, c.m[side], dt), tilt: 0 }; },
  // a child who reads the ball but sees where it will cross `lag` s late (a tracker with a child's reaction), never tilts
  late: (lag = 0.35) => { const mem = []; return (c, side, dt) => {
    const a = c.arrival(side); mem.push([c.time, a ? a.u : null]); while (mem.length > 2 && mem[1][0] <= c.time - lag) mem.shift();
    const u = mem[0][1]; return { slide: u == null ? toward(8, c.m[side], dt) : toward(u, c.m[side], dt), tilt: 0 };
  }; },
  // a child on a tablet: guesses where the ball will cross its line by its straight path now (the side mirrors' bounces not
  // foreseen, so it corrects after each bounce), sees it `lag` s late, and half the time tilts a little either way as the ball comes
  // (10 to 25 degrees, like the single-player game's first-timer)
  child: (seed = 1, lag = 0.3) => { const mem = [], rnd = lcg(seed); let rally = -1, tilt = 0; return (c, side, dt) => {
    const b = c.ball && c.phase === 'rally' ? toLocalBall(c.ball, side) : null;
    let u = null;
    if (b && b.dv < 0) {
      const t = (b.v - DUEL_RULES.lines[0]) / (-b.dv * b.s); u = clamp(b.u + b.du * b.s * t, R.rail[0], R.rail[1]);
      const key = c.n * 1000 + c.rally; if (t < 0.8 && rally !== key) { rally = key; tilt = rnd() < 0.5 ? (rnd() < 0.5 ? -1 : 1) * deg(10 + rnd() * 15) : 0; }
    }
    mem.push([c.time, u]); while (mem.length > 2 && mem[1][0] <= c.time - lag) mem.shift();
    const g = mem[0][1]; return { slide: g == null ? 0 : toward(g, c.m[side], dt), tilt: b ? tilt : 0 };
  }; },
  // a child: follows the ball with its eyes (where it IS, seen `lag` s late, not where it will cross its line), never tilts
  kid: (lag = 0.4) => { const mem = []; return (c, side, dt) => {
    const b = c.ball, u = b ? (side ? R.w - b.u : b.u) : 8; mem.push([c.time, u]); while (mem.length > 2 && mem[1][0] <= c.time - lag) mem.shift();
    return { slide: toward(mem[0][1], c.m[side], dt), tilt: 0 };
  }; },
  // gives the point away on purpose (tests): slides to the end of the rail away from where the ball will cross
  dodge: () => (c, side, dt) => { const a = c.arrival(side); return { slide: a ? toward(a.u < 8 ? R.rail[1] : R.rail[0], c.m[side], dt) : 0, tilt: 0 }; },
  // skilled: slides under the ball and, just before it arrives, tilts to send it as far as it can from where the other mirror stands
  angler: () => (c, side, dt) => {
    const a = c.arrival(side), out = { slide: 0, tilt: c.tilt[side] };
    if (!a) return { slide: toward(8, c.m[side], dt), tilt: 0 };
    out.slide = toward(a.u, c.m[side], dt);
    if (a.t < 0.6) {
      const them = c.m[1 - side]; let best = null;
      for (let d = -40; d <= 40; d += 2) {
        const f = c.forecast(side, a.ball, deg(d)), gap = Math.abs(f.u - them) - DUEL_RULES.slide * f.t, score = gap - Math.abs(d) * 0.01;
        if (!best || score > best.score) best = { score, t: deg(d) };
      }
      out.tilt = best.t;
    }
    return out;
  },
};
// A whole game on one court that judges both sides (Node). bots = [side 0's, side 1's]; budget in game seconds.
export function playDuel(bots, { fps = 60, budget = 300, ball } = {}) {
  const c = new DuelCourt({ auto: true, ball }), dt = 1 / fps, ev = [];
  let t = 0;
  while (!c.done && t < budget) { for (const e of c.update(dt, [bots[0](c, 0, dt), bots[1](c, 1, dt)])) ev.push(e); t += dt; }
  return { done: c.done, winner: c.winner, score: [...c.score], hits: c.hits, time: +t.toFixed(2), events: ev, court: c };
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  for (const fps of [60, 20]) for (const [a, b] of [['still', 'tracker'], ['tracker', 'still'], ['angler', 'kid'], ['kid', 'angler'], ['angler', 'tracker'], ['tracker', 'tracker'], ['kid', 'kid'], ['tracker', 'kid'], ['child', 'child'], ['angler', 'child'], ['still', 'child']]) {
    const r = playDuel([DUEL_BOTS[a](), DUEL_BOTS[b]()], { fps });
    console.log(`${fps} fps  ${a.padEnd(8)} vs ${b.padEnd(8)}  ${r.score.join(' : ')}  hits ${r.hits}  ${r.time} s${r.done ? '' : ' (time up)'}`);
  }
  console.log('ball', DUEL_RULES.ball);
}
