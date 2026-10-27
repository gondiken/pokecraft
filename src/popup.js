// T44: the Pop-Up Room's rules (the Room of Doors, plans/T44.md section 3). Pure: no imports, no Math.random, Node-runnable.
//
// A 3 x 3 grid of pop-up boxes. Jacks spring out one at a time (later two at once); the child looks at one and presses Boop! before it
// ducks back. A round is 20 jacks, 10 boops win the golden bow. Some boxes only wobble (a cheeky box: nothing comes out, nothing bad).
// A plan is made from the seed and the attempt number only; every time is a closed form of the round clock.
import { seeded } from './shuffle.js';

export const POPUP = {
  boxes: 9,
  round: 20,          // jacks in a round
  need: 10,           // boops that win the bow
  lead: 1.5,          // seconds before the first jack
  upStart: 1.4, upEnd: 0.75, // how long a jack stays up: at the start / near the end
  gap: 0.5,           // between one pop and the next
  doubleFrom: 12,     // from the 12th jack on, every 4th pop is a double
  doubleEvery: 4,
  cheeky: 4,          // boxes that only wobble, spread through the round
  wobble: 0.9,        // how long a cheeky box wobbles
  rise: 0.12, duck: 0.15, // the spring out, the duck back; a boop counts for `grace` s after the duck starts
  grace: 0.15,
  help: [1, 1.25, 1.5],   // up-time multiplier by help level (0, 1, 2): after a round that was not enough
  hard: { up: 0.9, need: 12 }, // a rematch
};

export const needOf = (hard = false) => (hard ? POPUP.hard.need : POPUP.need);

// The plan of one round: [{ i, box, t0, up, wobble, double }] sorted by t0. `i` = the number of the jack (0-based, cheeky ones have i -1).
// Rules: never the same box twice in a row (a double's two boxes differ from each other and from the pop before); exactly `round` jacks.
export function popPlan(seed, attempt, { help = 0, hard = false } = {}) {
  const rnd = seeded(`${seed}|popup|${attempt}`);
  const mult = (POPUP.help[Math.min(2, help)] ?? 1) * (hard ? POPUP.hard.up : 1);
  const upAt = k => (POPUP.upStart + (POPUP.upEnd - POPUP.upStart) * (k / (POPUP.round - 1))) * mult;
  // where the cheeky boxes go: after jack slots chosen from the second half of each quarter of the round
  const cheekyAfter = new Set();
  for (let q = 0; q < POPUP.cheeky; q++) cheekyAfter.add(Math.floor((q * POPUP.round) / POPUP.cheeky + 1 + rnd() * (POPUP.round / POPUP.cheeky - 2)));
  const plan = [];
  let t = POPUP.lead, jack = 0, last = [], sinceDouble = 0;
  const free = avoid => { const l = Array.from({ length: POPUP.boxes }, (_, b) => b).filter(b => !avoid.includes(b)); return l[Math.floor(rnd() * l.length)]; };
  while (jack < POPUP.round) {
    const left = POPUP.round - jack;
    const isDouble = jack >= POPUP.doubleFrom && left >= 2 && (sinceDouble % POPUP.doubleEvery === POPUP.doubleEvery - 1);
    if (jack >= POPUP.doubleFrom) sinceDouble++;
    const up = upAt(jack);
    const a = free(last);
    plan.push({ i: jack, box: a, t0: t, up, wobble: false, double: isDouble });
    let used = [a];
    if (isDouble) { const b = free([...last, a]); plan.push({ i: jack + 1, box: b, t0: t, up, wobble: false, double: true }); used = [a, b]; }
    jack += used.length;
    last = used;
    t += up + POPUP.gap;
    if (cheekyAfter.has(jack) || (isDouble && cheekyAfter.has(jack - 1))) { // a cheeky box: wobbles, nothing comes out
      const w = free(last);
      plan.push({ i: -1, box: w, t0: t, up: POPUP.wobble, wobble: true, double: false });
      last = [w];
      t += POPUP.wobble + POPUP.gap;
    }
  }
  return plan;
}

// When the round is over (the last jack is down).
export const popEnd = plan => plan.reduce((m, p) => Math.max(m, p.t0 + p.up + POPUP.duck), 0);

// The boxes that are doing something at time t: [{ n (index in the plan), box, state: 'up' | 'wobble', rise: 0..1 }] (rise 1 = fully out,
// going down again at the end; a wobbling box has rise 0 and `shake` -1..1).
export function popAt(plan, t) {
  const out = [];
  plan.forEach((p, n) => {
    const k = t - p.t0;
    if (k < 0 || k > p.up + POPUP.duck) return;
    if (p.wobble) { out.push({ n, box: p.box, state: 'wobble', rise: 0, shake: Math.sin(k * 40) * Math.min(1, (p.up - k) / 0.2 + 0.2) }); return; }
    const rise = k < POPUP.rise ? k / POPUP.rise : k <= p.up ? 1 : Math.max(0, 1 - (k - p.up) / POPUP.duck);
    out.push({ n, box: p.box, state: 'up', rise });
  });
  return out;
}

// The index (in the plan) of the jack a boop on `box` at time t would hit, or -1: only while it is up, plus `grace` after it starts to duck.
// A cheeky box never counts. `done` = a Set of plan indices already booped.
export function boopOk(plan, t, box, done = null) {
  for (let n = 0; n < plan.length; n++) {
    const p = plan[n];
    if (p.wobble || p.box !== box || done?.has(n)) continue;
    if (t >= p.t0 && t <= p.t0 + p.up + POPUP.grace) return n;
  }
  return -1;
}
