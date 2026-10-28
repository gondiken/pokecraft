// The shared kind help (src/kindhelp.js, owner 2026-10-28: "only ever so slightly easier each time something goes wrong"), pure, in Node:
// the rule itself (zero before `after`, growing by `step`, capped at `max`, never going back down) and that every game's levers move by
// at most that much: after any number of misses no game is more than KIND_HELP.max easier, and changing KIND_HELP changes every game.
import { KIND_HELP, KindHelp, KIND, kindHelp } from '../../src/kindhelp.js';
import { BumperGame, BounceGame, Seat } from '../../src/fairgames.js';
import { siegePlan } from '../../src/siege.js';
import { joustPlan } from '../../src/joust.js';
import { pinataPlan } from '../../src/pinata.js';
import { catchPlan } from '../../src/jackcatch.js';
import { stackPlan } from '../../src/giftstack.js';
import { whackPlan } from '../../src/popupwhack.js';
import { bossSpeed, makeTrack } from '../../src/racetrack.js';

export default async function ({ t }) {
  const { after, step, max } = KIND_HELP;
  const ease = m => kindHelp(m).ease, M = Array.from({ length: 30 }, (_, m) => m);
  t.ok(after >= 1 && step > 0 && step <= 0.05 && max > 0 && max <= 0.15, `the numbers are gentle: after ${after} misses, ${step} a miss, at most ${max}`);
  t.ok(M.filter(m => m < after).every(m => ease(m) === 0 && !kindHelp(m).on), `no help before ${after} misses`);
  t.ok(M.every(m => m === 0 || ease(m) >= ease(m - 1)) && M.every(m => ease(m) <= max + 1e-12) && Math.abs(ease(99) - max) < 1e-12, 'it only grows, and never past max');
  t.ok(Math.abs(ease(after) - step) < 1e-12 && Math.abs(ease(after + 1) - 2 * step) < 1e-12, `${step} at ${after} misses, ${2 * step} at ${after + 1}`);
  t.ok(ease(6) <= 0.12, `after 6 misses only ${(ease(6) * 100).toFixed(0)} % easier`);
  t.ok(M.every(m => { const k = kindHelp(m); return Math.abs(k.slow - (1 - k.ease)) < 1e-12 && Math.abs(k.more - (1 + k.ease)) < 1e-12; }), 'slow = 1 - ease, more = 1 + ease');
  t.ok(ease(-3) === 0 && ease('x') === 0 && ease(2.9) === ease(2), 'junk misses count as none (and a fraction as the whole misses below it)');
  t.ok(new KindHelp({ after: 1, step: 0.5, max: 0.6 }).ease(3) === 0.6 && KIND.p === KIND_HELP, 'another set of numbers works the same way, and the shared one reads KIND_HELP');

  // every game, after 0 / 2 / 4 / 6 / 20 misses: how much easier (as a share), never more than max
  const track = makeTrack();
  const games = {
    race: m => 1 - bossSpeed(50, 0, m, track) / bossSpeed(50, 0, 0, track),
    bumper: m => { const g = new BumperGame(false); g.misses = m; g.start(1); const h = new BumperGame(false); h.start(1); return Math.max(1 - g.fleet.bots[3].speed / h.fleet.bots[3].speed, g.time / h.time - 1); },
    bounce: m => { const g = new BounceGame(false); g.misses = m; g.start(1); const h = new BounceGame(false); h.start(1); return Math.max(1 - g.speed / h.speed, g.time / h.time - 1); },
    ring: m => { const s = new Seat(false); s.round = 1; const w0 = s.omega; s.misses = m; return 1 - s.omega / w0; },
    pinata: m => { const a = pinataPlan(4, 2, 0, { help: m }), b = pinataPlan(4, 2, 0); return Math.max(a.period / b.period - 1, 1 - a.speed / b.speed, 1 - a.zip[0] / b.zip[0], (b.hp - a.hp) / b.hp); },
    jacks: m => {
      const boxes = [0, 1, 2].map(i => ({ at: [50 + i * 3, 11, 50] })), floor = []; for (let x = 45; x < 62; x++) for (let z = 52; z < 62; z++) floor.push([x + 0.5, z + 0.5]);
      const a = catchPlan(4, 0, { help: m, boxes, floor, start: [53, 57] }), b = catchPlan(4, 0, { boxes, floor, start: [53, 57] });
      return a.launches[0].flight / b.launches[0].flight - 1;
    },
    stack: m => stackPlan(4, 2, 0, { slow: kindHelp(m).slow }).period / stackPlan(4, 2, 0).period - 1,
    whack: m => { const a = whackPlan(4, 2, 0, { help: kindHelp(m) }), b = whackPlan(4, 2, 0); return Math.max(a.up / b.up - 1, a.time / b.time - 1); },
    siege: m => { const a = siegePlan(4, 2, 0, { help: m }), b = siegePlan(4, 2, 0); return Math.max(a.throws[0].flight / b.throws[0].flight - 1, a.cover / b.cover - 1); },
    joust: m => { const a = joustPlan(4, 2, 0, { help: m }), b = joustPlan(4, 2, 0); return Math.max(a.meet / b.meet - 1, a.r / b.r - 1, a.hop / b.hop - 1, 1 - a.slow); },
  };
  const rows = Object.entries(games).map(([n, f]) => [n, [0, 2, 4, 6, 20].map(m => f(m))]);
  console.log('  ease after 0 / 2 / 4 / 6 / 20 misses:', rows.map(([n, e]) => `${n} ${e.map(x => (x * 100).toFixed(1)).join('/')} %`).join(', '));
  // (a period / time made longer by 1 / (1 - e) is up to e / (1 - e): 11.1 % at e = 0.10, still "about 10 %")
  t.ok(rows.every(([, e]) => e[0] < 1e-9 && e.every(x => x <= max / (1 - max) + 1e-9) && e[3] > 0 && e[1] <= e[2] + 1e-12 && e[2] <= e[3] + 1e-12),
    `every game: no help at first, a little more after 2 / 4 / 6 misses, never more than about ${(max * 100).toFixed(0)} % (${rows.map(([n, e]) => `${n} ${(e[4] * 100).toFixed(1)}`).join(', ')} %)`);
  // one change of the numbers changes every game
  const keep = { ...KIND_HELP };
  KIND_HELP.max = 0.2; KIND_HELP.step = 0.1;
  const big = Object.entries(games).map(([n, f]) => [n, f(6)]);
  Object.assign(KIND_HELP, keep);
  t.ok(big.every(([n, x]) => x > rows.find(r => r[0] === n)[1][3] + 1e-9), 'raising KIND_HELP.max makes every game easier at once (and nothing else is needed)');
}
