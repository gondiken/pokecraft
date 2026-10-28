// T49: model players for the Castle's two challenges (pure, Node and page), like doorsbots.mjs. Each returns { won, score, need } for a
// whole round played at `fps` frames a second (the input is decided once per frame, like a real player, and held for the frame).
//   node tests/castlebots.mjs   prints a table (calibration)
import { SiegeRound, SIEGE, dirTo, SIEGE_ROUNDS } from '../src/siege.js';
import { JoustRound, JOUST, starAt, bobAt, JOUST_ROUNDS } from '../src/joust.js';

// Shield Up! players: (round, time) -> { ang, up }
export const SIEGE_BOTS = {
  // reacts `react` s after a throw's tell starts: points the shield at the earliest one coming (Jump for a sky one)
  skilled: (react = 0.35) => (g) => {
    const seen = g.plan.throws.filter(t => g.results[t.i] === undefined && g.time >= t.at - t.flight - t.tell + react).sort((a, b) => a.at - b.at);
    const t = seen[0];
    if (!t) return { ang: g._ang ?? 0, up: false };
    if (t.kind === 'sky') return { ang: g._ang ?? 0, up: true };
    g._ang = dirTo(g.stand, t.k);
    return { ang: g._ang, up: false };
  },
  slow: () => SIEGE_BOTS.skilled(1.5),                                 // a child who turns late
  still: () => () => ({ ang: 0, up: false }),                         // looks at the castle and does nothing
  spinner: () => (g) => ({ ang: (g.time * 2 * Math.PI) % (2 * Math.PI), up: false }), // the stick round and round, once a second
  jumpy: () => () => ({ ang: 0, up: true }),                           // Jump held all the time
};
export function playSiege(bot, { seed = 7, round = 0, attempt = 0, fps = 60, help = 0, hard = false, stone = 0 } = {}) {
  const g = new SiegeRound(seed, round, attempt, stone, { help, hard });
  const dt = 1 / fps;
  let guard = 0;
  while (!g.done && guard++ < 100000) g.update(dt, bot(g));
  return { won: g.won, score: g.blocks, need: g.need, perfects: g.perfects, splats: g.splats };
}

// Joust players: (round) -> { su, sv } per frame.
export const JOUST_BOTS = {
  // steers the tip toward where the star will be at the meeting, as seen `delay` s ago, correcting for the bob it sees
  skilled: (delay = 0.25) => (g) => {
    const seenTau = Math.max(0, g.tau - delay), plan = g.plan, p = g.pass;
    const star = starAt(plan, p, Math.min(plan.meet, seenTau + (plan.meet - g.tau))).at; // where the star will be (if it does not hop after seenTau)
    const target = seenTau >= plan.meet - plan.hop - 0.05 || plan.round < 2 ? starAt(plan, p, plan.meet).at : star;
    const bob = bobAt(plan, p, plan.meet);
    const want = [target[0] - bob[0], target[1] - bob[1]];
    const step = JOUST.tipSpeed / 60;
    const du = want[0] - g.tip[0], dv = want[1] - g.tip[1];
    return { su: Math.max(-1, Math.min(1, du / step / 4)), sv: Math.max(-1, Math.min(1, dv / step / 4)) };
  },
  // aims at where the star IS (not where it will be), seen `delay` s late, and does not mind the bob
  sloppy: (delay = 0.4) => (g) => {
    const star = starAt(g.plan, g.pass, Math.max(0, g.tau - delay)).at, step = JOUST.tipSpeed / 60;
    return { su: Math.max(-1, Math.min(1, (star[0] - g.tip[0]) / step / 4)), sv: Math.max(-1, Math.min(1, (star[1] - g.tip[1]) / step / 4)) };
  },
  tracker: () => JOUST_BOTS.sloppy(0.25), // follows the star well, but does not lead it
  still: () => () => ({ su: 0, sv: 0 }),
  random: (seed = 1) => { let a = seed; return () => { a = (a * 1103515245 + 12345) >>> 0; const b = (a >>> 8) / 16777216; a = (a * 1103515245 + 12345) >>> 0; return { su: b * 2 - 1, sv: ((a >>> 8) / 16777216) * 2 - 1 }; }; },
  // starts moving only `late` s before the meeting
  late: (late = 1.0) => (g) => (g.tau < g.plan.meet - late ? { su: 0, sv: 0 } : JOUST_BOTS.skilled(0.25)(g)),
};
export function playJoust(bot, { seed = 7, round = 0, attempt = 0, fps = 60, help = 0, hard = false } = {}) {
  const g = new JoustRound(seed, round, attempt, { help, hard });
  const dt = 1 / fps;
  let guard = 0;
  while (!g.done && guard++ < 100000) { if (!g.riding) g.charge(); g.update(dt, bot(g)); }
  return { won: g.won, score: g.points, need: g.need, results: g.results.join() };
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('castlebots.mjs')) {
  for (const fps of [60, 20]) for (let r = 0; r < SIEGE_ROUNDS; r++) {
    const row = Object.keys(SIEGE_BOTS).flatMap(n => [0, 3].map(help => [n, help])).map(([n, help]) => { let w = 0, s = 0; for (let seed = 1; seed <= 20; seed++) { const x = playSiege(SIEGE_BOTS[n](), { seed, round: r, fps, help }); w += x.won; s += x.score; } return `${n}${help ? '+h' : ''} ${w}/20 (${(s / 20).toFixed(1)})`; });
    console.log(`siege r${r + 1} @${fps}: ${row.join(' | ')}`);
  }
  for (const fps of [60, 20]) for (let r = 0; r < JOUST_ROUNDS; r++) {
    const row = Object.keys(JOUST_BOTS).flatMap(n => [0, 3].map(help => [n, help])).map(([n, help]) => { let w = 0, s = 0; for (let seed = 1; seed <= 20; seed++) { const x = playJoust(JOUST_BOTS[n](), { seed, round: r, fps, help }); w += x.won; s += x.score; } return `${n}${help ? '+h' : ''} ${w}/20 (${(s / 20).toFixed(1)})`; });
    console.log(`joust r${r + 1} @${fps}: ${row.join(' | ')}`);
  }
}
