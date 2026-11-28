// The Joust for two: model players (pure, Node and page), like castlebots.mjs. A bot is (rider, plan, side, view) -> { su, sv } for one frame;
// view.friendTip = the friend's lance tip as this computer last heard it (a delay = the line), view.dt = the frame.
//   node tests/joustduelbots.mjs   prints a table
import { DUEL_JOUST, passPlan, spotAt, bobOf, lanceResult, Rider, JoustScore } from '../src/joustduelrules.js';

const clamp1 = x => Math.max(-1, Math.min(1, x));
const toward = (tip, want, k = 4) => { const step = DUEL_JOUST.tipSpeed / 60; return { su: clamp1((want[0] - tip[0]) / step / k), sv: clamp1((want[1] - tip[1]) / step / k) }; };
export const JDUEL_BOTS = {
  // leads the friend's spot to where it will be at the meeting (with the lean from the friend's tip it sees) and corrects for its own bob
  skilled: () => (r, plan, side, view) => {
    const spot = spotAt(plan, 1 - side, plan.meet, view.friendTip), bob = bobOf(plan, side, plan.meet);
    return toward(r.tip, [spot[0] - bob[0], spot[1] - bob[1]]);
  },
  // a child: aims at where the friend's spot IS (seen `late` s late), not where it will be; ignores the bob
  kid: (late = 0.3) => (r, plan, side, view) => toward(r.tip, spotAt(plan, 1 - side, Math.max(0, r.tau - late), view.friendTip)),
  still: () => () => ({ su: 0, sv: 0 }),
  random: (seed = 1) => { let a = seed >>> 0; const nx = () => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return (a >>> 8) / 16777216; }; return () => ({ su: nx() * 2 - 1, sv: nx() * 2 - 1 }); },
  // mashes the stick from one side to the other every frame
  masher: () => { let k = 0; return () => { k++; return { su: k % 2 ? 1 : -1, sv: (k >> 1) % 2 ? 1 : -1 }; }; },
};

// A whole game between two bots on one clock; the friend's tips reach each bot `lag` s late. -> { winner, score, passes, kinds }
export function playJoustDuel([b0, b1], { fps = 60, seed = 7, lag = 0 } = {}) {
  const score = new JoustScore(), dt = 1 / fps, kinds = [];
  const bots = [b0, b1];
  for (let n = 1; score.winner == null && n <= DUEL_JOUST.maxPasses; n++) {
    const plan = passPlan(seed, n), riders = [new Rider(plan, 0), new Rider(plan, 1)], hist = [[], []], meets = [null, null];
    let t = 0;
    while (!(riders[0].ended && riders[1].ended)) {
      t += dt;
      for (const s of [0, 1]) {
        const h = hist[1 - s]; let seen = [0, 0];
        for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t - lag + 1e-9) { seen = h[i].tip; break; }
        const ev = riders[s].update(dt, bots[s](riders[s], plan, s, { friendTip: seen, dt }));
        for (const e of ev) if (e.type === 'meet') meets[s] = e.tip;
      }
      for (const s of [0, 1]) hist[s].push({ t, tip: riders[s].tip.slice() });
    }
    const k = [lanceResult(plan, 0, meets[0], meets[1]).kind, lanceResult(plan, 1, meets[1], meets[0]).kind];
    kinds.push(k.join('/'));
    score.add(n, k);
  }
  return { winner: score.winner, score: score.score.slice(), passes: score.n, kinds };
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('joustduelbots.mjs')) {
  const names = Object.keys(JDUEL_BOTS);
  for (const fps of [60, 20]) for (const a of names) {
    const row = names.map(b => { let w = 0, l = 0, d = 0; for (let seed = 1; seed <= 20; seed++) { const r = playJoustDuel([JDUEL_BOTS[a](), JDUEL_BOTS[b]()], { fps, seed, lag: 0.2 }); if (r.winner === 0) w++; else if (r.winner === 1) l++; else d++; } return `${b} ${w}-${l}-${d}`; });
    console.log(`@${fps} ${a.padEnd(8)} vs: ${row.join(' | ')}`);
  }
}
