// Shield Up! for two: model players (pure, Node and page), like castlebots.mjs. A player is { defend, throw }:
//   defend(turn, dt) -> { ang, up }         (turn = the defender's ShieldTurn, as castlebots' SIEGE_BOTS read a SiegeRound)
//   throw(view) -> null | { k, kind }       (view = { time, shield: the defender's shield as this computer last heard it, thrown, can })
//   node tests/siegeduelbots.mjs   prints a table
import { DUEL_SHIELD, ShieldTurn, ShieldScore, turnOf, throwOf, canThrow, dirTo } from '../src/siegeduelrules.js';
import { SIEGE } from '../src/siege.js';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const STAND = SIEGE.stones[DUEL_SHIELD.defStone];
// the defender's side of a player: points at the earliest throw it has seen for `react` s; turns at most `turn` rad/s (Infinity = at once)
const watcher = (react, turn = Infinity, upLate = 0) => {
  let ang = 0;
  return (g, dt) => {
    const seen = g.plan.throws.filter(t => g.results[t.i] === undefined && g.time >= t.at - t.flight - t.tell + react).sort((a, b) => a.at - b.at);
    const t = seen[0];
    if (!t) return { ang, up: false };
    if (t.kind === 'sky') return { ang, up: g.time >= t.at - t.flight - t.tell + react + upLate };
    const want = dirTo(STAND, t.k), d = wrap(want - ang), m = turn * dt;
    ang = Math.abs(d) <= m ? want : wrap(ang + Math.sign(d) * m);
    return { ang, up: false };
  };
};
const rng = seed => { let a = seed >>> 0; return () => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return (a >>> 8) / 16777216; }; };
export const DEFENDERS = {
  skilled: () => watcher(0.35),
  kid: () => watcher(0.55, 3.2, 0.3),                         // sees it a bit late, turns the stick at a child's speed
  still: () => () => ({ ang: 0, up: false }),
  spinner: () => { let a = 0; return (g, dt) => { a += 2 * Math.PI * dt; return { ang: wrap(a), up: false }; }; },
  jumpy: () => () => ({ ang: 0, up: true }),
};
export const THROWERS = {
  // sends them from opposite sides in turn as fast as it may (the shield must swing right round each time), a sky one now and then
  skilled: () => { let k = 1; return v => {
    if (!v.can) return null;
    if (v.thrown === 3) return { k, kind: 'sky' };
    k = (k + 6 + (v.thrown % 3 === 2 ? 3 : 0)) % 12;
    return { k, kind: 'pumpkin' };
  }; },
  spam: (seed = 3) => { const r = rng(seed); return v => (v.can ? { k: Math.floor(r() * 12), kind: r() < 0.2 ? 'sky' : 'pumpkin' } : null); }, // as fast as it may, anywhere
  same: () => v => (v.can ? { k: 0, kind: 'pumpkin' } : null),                                                                              // always the gate
  lazy: () => () => null,                                                                                                                    // never presses: the game throws for it
};
export const player = (d, th) => ({ defend: DEFENDERS[d](), throw: THROWERS[th]() });

// A whole game on one clock; throws reach the defender `lag` s late and the thrower sees the shield `lag` s late.
// -> { winner, score, turns, results }
export function playShieldDuel([p0, p1], { fps = 60, lag = 0 } = {}) {
  const score = new ShieldScore(), dt = 1 / fps, players = [p0, p1], results = [];
  let winner = null, t = 0;
  for (t = 1; winner == null; t++) {
    const { def, n } = turnOf(t), th = 1 - def, g = new ShieldTurn({ t, n, decides: true });
    const shieldHist = [], inbox = [];
    let clock = 0, last = null, thrown = 0, idle = 0, guard = 0;
    while (!score.turnDone(t) && guard++ < 200000) {
      clock += dt;
      // the thrower
      let seen = { ang: 0, up: false };
      for (let i = shieldHist.length - 1; i >= 0; i--) if (shieldHist[i].t <= clock - lag + 1e-9) { seen = shieldHist[i].s; break; }
      const can = canThrow(clock, last, thrown, n);
      let w = players[th].throw({ time: clock, shield: seen, thrown, can });
      idle = can ? idle + dt : 0;
      if (!w && can && idle >= DUEL_SHIELD.idle) w = { k: 0, kind: 'pumpkin' }; // (siegeduel.js throws for a thrower who waits too long)
      if (w && can) { inbox.push({ at: clock + lag, t: throwOf(thrown, w.k, w.kind) }); thrown++; last = clock; idle = 0; }
      // the defender
      while (inbox.length && inbox[0].at <= clock + 1e-9) g.add(inbox.shift().t);
      const inp = players[def].defend(g, dt);
      for (const e of g.update(dt, inp)) if (e.type === 'hit') { score.add(t, e.t.i, e.result); results.push(`${t}:${e.result}`); }
      shieldHist.push({ t: clock, s: { ang: inp.ang, up: !!inp.up } });
    }
    winner = score.after(t);
  }
  return { winner, score: score.score.slice(), turns: t - 1, results };
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('siegeduelbots.mjs')) {
  const combos = [['skilled', 'skilled'], ['kid', 'skilled'], ['kid', 'spam'], ['kid', 'same'], ['kid', 'lazy'], ['skilled', 'spam'], ['still', 'spam'], ['spinner', 'spam'], ['jumpy', 'spam'], ['still', 'skilled']];
  for (const fps of [60, 20]) for (const a of combos) {
    const row = combos.map(b => { const r = playShieldDuel([player(...a), player(...b)], { fps, lag: 0.2 }); return `${b.join('/')} ${r.score.join(':')}${r.winner === 'draw' ? ' draw' : ''}`; });
    console.log(`@${fps} ${a.join('/').padEnd(16)} vs: ${row.join(' | ')}`);
  }
}
