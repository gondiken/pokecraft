// T48 (plans/T48-surprise-party.md): the three rounds and the party surprises of the two old games, wrapped round their own rules.
// pinata.js and jackcatch.js are not changed: a round here is one of their plans (or two piñatas), with a few numbers changed after
// the plan is made. Pure, Node-runnable.
//
//   Piñata Party: round 1 the llama, 2 the star, 3 the rocket (pinataPlan's own rounds, its own help after a time-up).
//     "Two piñatas!" (round 3): a second, slower llama swings too, both must burst, 15 s more. "Wobbly rope!": it swings further.
//     "Lights out!": the room dims and the piñata glows (looks only).
//   Jack Catch: round 1 the first 10 jacks of a plan (6 points win), round 2 the first 13 (9), round 3 all 16 (12; a rematch 2 more).
//     "Double gold!": every third plain jack is gold. "Pie party!": more pies, and they fly slower (more warning).
//     "Sticky floor!": everything flies slower and you run slower (`sticky` speed cap).
import { PINATA, pinataPlan, pinataAt, inReach, whack } from './pinata.js';
import { CATCH, catchPlan } from './jackcatch.js';

export const ROUNDS = {
  pinata: { extra: 15, wobbly: 1.15 },
  catch: { jacks: [10, 13, 16], need: [6, 9, 12], hard: 2, goldEvery: 3, pieFlight: 1.3, sticky: { time: 1.15, flight: 1.2, cap: 3.6 } },
};

/* ---------------------------------------- the Piñata Party ---------------------------------------- */

// The piñatas of a round: [plan] or [plan, second plan] (the "Two piñatas!" twist).
export function pinataRound(seed, round, attempt, { help = 0, hard = false, twist = null } = {}) {
  const main = pinataPlan(seed, round, attempt, { help, hard });
  if (twist === 'wobbly') { main.first = { ...main.first, amp: main.first.amp * ROUNDS.pinata.wobbly }; main.hitAmp *= ROUNDS.pinata.wobbly; }
  if (twist !== 'two') return [main];
  const second = pinataPlan(`${seed}|two`, 1, attempt, { help: 2, hard });
  main.time += ROUNDS.pinata.extra; second.time = main.time;
  return [main, second];
}
// Would a press at t meet this piñata? (the same window pinata.js's whack looks in)
export function reaches(run, t, eye, dir) {
  if (run.done) return false;
  for (let k = PINATA.window[0]; k <= PINATA.window[1] + 1e-9; k += PINATA.sample) if (inReach(pinataAt(run, Math.max(0, t + k)), eye, dir)) return true;
  return false;
}
// One press with one or two piñatas out: the stick meets the first one in reach (else it is a whiff of the first one still swinging);
// the stick's rest time is shared.
export function whackRuns(runs, t, eye, dir) {
  const live = runs.filter(r => !r.done);
  if (!live.length) return { swung: false };
  const target = live.find(r => reaches(r, t, eye, dir)) ?? live[0];
  const res = whack(target, t, eye, dir);
  if (res.swung) for (const r of runs) if (r !== target) r.ready = Math.max(r.ready, target.ready);
  return { ...res, run: runs.indexOf(target), all: runs.every(r => r.done) };
}

/* ---------------------------------------- Jack Catch ---------------------------------------- */

// One round: a catchPlan cut to the round's jacks and need, with the twist on top. Same fields as catchPlan, plus round / twist / cap.
export function catchRound(seed, round, attempt, { help = 0, hard = false, twist = null, boxes, floor, start }) {
  const R = ROUNDS.catch, r = Math.min(3, Math.max(1, round | 0)) - 1;
  const plan = catchPlan(seed, attempt + 1000 * r, { help, hard, boxes, floor, start });
  // the round's jacks: the first R.jacks[r] jacks in the order they were made, and the pies thrown up to the last of them
  const jacks = plan.launches.filter(l => l.kind !== 'pie').sort((a, b) => a.n - b.n).slice(0, R.jacks[r]);
  const keep = new Set(jacks.map(l => l.n)), lastT = Math.max(...jacks.map(l => l.t0));
  let launches = plan.launches.filter(l => keep.has(l.n) || (l.kind === 'pie' && l.t0 <= lastT + 0.2)).map(l => ({ ...l }));
  if (twist === 'gold') { let k = 0; for (const l of launches.filter(q => q.kind !== 'pie').sort((a, b) => a.n - b.n)) if (l.kind === 'jack' && ++k % R.goldEvery === 0) { l.kind = 'gold'; l.flight *= 1.1; l.apex *= 1.25; } }
  if (twist === 'pies') {
    let n = Math.max(...plan.launches.map(l => l.n)) + 1;
    const adds = [];
    launches.filter(l => l.kind !== 'pie').sort((a, b) => a.t0 - b.t0).forEach((l, i) => {
      if (i < 2 || i % 3) return;
      if (launches.some(q => q.kind === 'pie' && Math.abs(q.t0 - l.t0) < 0.9)) return;
      adds.push({ n: n++, kind: 'pie', box: (l.box + 4) % boxes.length, t0: l.t0 + 0.5, flight: CATCH.pies.flight, apex: CATCH.pies.apex, from: boxes[(l.box + 4) % boxes.length].at, to: null });
    });
    launches.push(...adds);
    for (const l of launches) if (l.kind === 'pie') l.flight *= R.pieFlight;
  }
  if (twist === 'sticky') for (const l of launches) { l.t0 = 1.2 + (l.t0 - 1.2) * R.sticky.time; l.flight *= R.sticky.flight; }
  launches.sort((a, b) => a.t0 - b.t0 || a.n - b.n);
  const js = launches.filter(l => l.kind !== 'pie');
  return { ...plan, launches, round: r + 1, twist,
    end: Math.max(...launches.map(l => l.t0 + l.flight)) + 0.6,
    need: R.need[r] + (hard ? R.hard : 0),
    most: js.reduce((s, l) => s + (l.kind === 'gold' ? CATCH.goldWorth : 1), 0), jacks: js.length,
    cap: twist === 'sticky' ? R.sticky.cap : null };
}
