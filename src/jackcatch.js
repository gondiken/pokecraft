// T44 rework (owner 2026-10-27, plans/T44.md "Rework"): Jack Catch in the Pop-Up Room. Pure, no game imports, Node-runnable.
//
// Jacks-in-the-box spring out of the nine pop-up boxes and fly in high arcs across the room. Run under one (its shadow on the floor
// shows where it will land) and it lands in your arms: +1 (a gold jack +2). Some boxes throw a cream pie instead: it flies at the spot
// where you stood when it was thrown, with a pink ring on the floor, so keep moving: a pie on you is a SPLAT and sticky shoes for a
// moment (never a loss). 16 jacks a round, 12 points win the fourth bow. It gets harder as the round goes on: shorter flights,
// landings further apart, two jacks at once (pick one!), more pies.
//
// A round is a plan from a hash of seed | attempt (no Math.random): every launch is a closed form of the round clock. A pie's target is
// the only thing that depends on you (where you stood at its launch), and `stepCatch` takes it from the position it is given.
import { seeded } from './pinata.js';
import { kindHelp } from './kindhelp.js';

export const CATCH = {
  jacks: 16, need: 12, goldWorth: 2, goldEvery: [4, 7],     // a gold jack every 4-7 jacks
  flight: [1.8, 1.15],              // seconds in the air, first jack -> last
  gap: [1.6, 1.0],                  // seconds between launches
  jump: [3.5, 7.5],                 // the most a landing is from the one before (blocks), first -> last
  near: 1.6,                        // and at least this far
  apex: [2.8, 3.8],                 // how high over the box a jack flies
  doublesFrom: 6, doubleEvery: 2,   // from the 6th jack on, every 2nd launch throws two (they land at least `doubleGap` apart)
  doubleGap: 3.2,
  pies: { from: 2, share: 0.35, flight: 1.15, apex: 2.2, slow: 1.6, cap: 2.0, r: 1.0, lead: 0.6 },  // `share` of the launches from the 3rd on also throw a pie,
                                    // aimed where you will be in `lead` s if you keep running the same way (so change your way!)
  catchR: 0.95, catchFrom: 0.75,    // you catch a jack within this of your middle, in the last quarter of its flight
  land: 11.35,                      // the height a jack lands at (feet 11)
  // the kind help after misses is the shared one (kindhelp.js, owner 2026-10-28): flights and gaps x more, landing jumps and pie share x slow
  hard: { need: 14, flight: 0.9, pies: 1.2 },
};
export const needOf = (hard = false) => (hard ? CATCH.hard.need : CATCH.need);
const lerp = (a, b, k) => a + (b - a) * k;

// One round. `boxes` = [{ at: [x, y, z] }] (the top middle of each box), `floor` = [[x, z]] the middles of the free floor cells,
// `start` = [x, z] (the pad). -> { launches: [{ n, kind: 'jack' | 'gold' | 'pie', box, t0, flight, apex, from, to }], need, end, ... }
export function catchPlan(seed, attempt, { help = 0, hard = false, boxes, floor, start }) {
  const K = kindHelp(help), H = { flight: K.more, gap: K.more, pies: K.slow, jump: K.slow }, X = hard ? CATCH.hard : { need: CATCH.need, flight: 1, pies: 1 };
  const rnd = seeded(`jacks|${seed}|${attempt}`);
  const pick = list => list[Math.floor(rnd() * list.length) % list.length];
  const launches = [];
  let t = 1.2, last = start, lastBox = -1, nextGold = CATCH.goldEvery[0] + Math.floor(rnd() * (CATCH.goldEvery[1] - CATCH.goldEvery[0] + 1));
  const boxFor = avoid => { let b; for (let k = 0; k < 20; k++) { b = Math.floor(rnd() * boxes.length); if (b !== lastBox && !avoid.includes(b)) break; } return b; };
  const spotFor = (from, prog, away = null) => {
    const far = CATCH.jump[0] + (CATCH.jump[1] - CATCH.jump[0]) * prog;
    const max = far * H.jump;
    let ok = floor.filter(([x, z]) => { const d = Math.hypot(x - from[0], z - from[1]); return d >= CATCH.near && d <= max && (!away || Math.hypot(x - away[0], z - away[1]) >= CATCH.doubleGap); });
    if (!ok.length) ok = floor.filter(([x, z]) => !away || Math.hypot(x - away[0], z - away[1]) >= CATCH.doubleGap);
    if (!ok.length) ok = floor;
    const [x, z] = pick(ok);
    return [x + (rnd() - 0.5) * 0.5, z + (rnd() - 0.5) * 0.5];
  };
  let jack = 0, n = 0, launch = 0;
  while (jack < CATCH.jacks) {
    const prog = jack / (CATCH.jacks - 1);
    const flight = lerp(CATCH.flight[0], CATCH.flight[1], prog) * H.flight * X.flight;
    const two = jack + 1 >= CATCH.doublesFrom && launch % CATCH.doubleEvery === 0 && jack + 1 < CATCH.jacks;
    const used = [];
    for (let k = 0; k < (two ? 2 : 1); k++) {
      const box = boxFor(used); used.push(box);
      const gold = jack + 1 === nextGold;
      if (gold) nextGold += CATCH.goldEvery[0] + Math.floor(rnd() * (CATCH.goldEvery[1] - CATCH.goldEvery[0] + 1));
      const to = spotFor(k === 0 ? last : last, prog, k === 1 ? launches[launches.length - 1].to : null);
      launches.push({ n: n++, kind: gold ? 'gold' : 'jack', box, t0: t, flight: flight * (gold ? 1.1 : 1), apex: lerp(CATCH.apex[0], CATCH.apex[1], rnd()) * (gold ? 1.25 : 1), from: boxes[box].at, to });
      if (k === 0) last = to;
      jack++;
    }
    lastBox = used[used.length - 1];
    // a pie now and then, a moment after the jack (it is aimed at you when it flies)
    const P = CATCH.pies;
    if (launch >= P.from && rnd() < P.share * H.pies * X.pies) {
      const box = boxFor(used);
      launches.push({ n: n++, kind: 'pie', box, t0: t + 0.35 + rnd() * 0.4, flight: P.flight * Math.min(1.25, H.flight) , apex: P.apex, from: boxes[box].at, to: null });
    }
    launch++;
    t += lerp(CATCH.gap[0], CATCH.gap[1], prog) * H.gap * (two ? 1.2 : 1);
  }
  launches.sort((a, b) => a.t0 - b.t0 || a.n - b.n);
  const end = Math.max(...launches.map(l => l.t0 + l.flight)) + 0.6;
  const jacks = launches.filter(l => l.kind !== 'pie');
  const box = { x0: Math.min(...floor.map(f => f[0])), x1: Math.max(...floor.map(f => f[0])), z0: Math.min(...floor.map(f => f[1])), z1: Math.max(...floor.map(f => f[1])) };
  return { seed, attempt, help: Math.max(0, help | 0), hard: !!hard, launches, end, box, need: X.need, most: jacks.reduce((s, l) => s + (l.kind === 'gold' ? CATCH.goldWorth : 1), 0), jacks: jacks.length };
}

// Where a launch is at `t` (null before it starts or after it lands): { x, y, z, s } (s = 0..1 of the flight). `to` = the target (pies: from the run).
export function flyAt(l, t, to = l.to) {
  if (!to) return null;
  const s = (t - l.t0) / l.flight;
  if (s < 0 || s > 1) return null;
  const [x0, y0, z0] = l.from, y1 = l.kind === 'pie' ? CATCH.land + 0.6 : CATCH.land;
  return { x: lerp(x0, to[0], s), y: y0 + (y1 - y0) * s + 4 * l.apex * s * (1 - s), z: lerp(z0, to[1], s), s };
}
// Does a body at `pos` (feet) hold this point? (a jack in your arms, a pie on your head)
export const touches = (q, pos, r = CATCH.catchR) => !!q && Math.hypot(q.x - pos.x, q.z - pos.z) <= r && q.y >= pos.y - 0.2 && q.y <= pos.y + 2.3;

export function newCatch(plan) { return { plan, t: 0, score: 0, caught: new Set(), missed: new Set(), splats: 0, pieTo: new Map(), done: new Set(), slowUntil: -1, over: false }; }

// Move the round clock from run.t to t (the player stood at `pos` for that bit: feet { x, y, z }, moving at `vel`). -> the events: launch / catch / miss / splat / end.
export function stepCatch(run, t, pos, vel = null) {
  const out = [], t0 = run.t, plan = run.plan;
  if (run.over) return out;
  for (const l of plan.launches) {
    if (run.done.has(l.n)) continue;
    const end = l.t0 + l.flight;
    if (l.t0 > t) continue;
    if (l.kind === 'pie' && !run.pieTo.has(l.n)) {
      const L = CATCH.pies.lead, b = plan.box, cl = (v, a, c) => Math.min(c, Math.max(a, v));
      run.pieTo.set(l.n, [cl(pos.x + (vel?.x || 0) * L, b.x0, b.x1), cl(pos.z + (vel?.z || 0) * L, b.z0, b.z1)]);
      out.push({ type: 'launch', n: l.n, kind: l.kind });
    }
    else if (l.kind !== 'pie' && l.t0 > t0) out.push({ type: 'launch', n: l.n, kind: l.kind });
    const to = l.kind === 'pie' ? run.pieTo.get(l.n) : l.to;
    if (l.kind === 'pie') {
      if (end <= t) { // it lands: on you?
        run.done.add(l.n);
        const q = flyAt(l, end - 1e-6, to);
        if (touches(q, pos, CATCH.pies.r)) { run.splats++; run.slowUntil = end + CATCH.pies.slow; out.push({ type: 'splat', n: l.n }); } else out.push({ type: 'plop', n: l.n });
      }
      continue;
    }
    // a jack: sample the bit of its flight inside (t0, t] (the last quarter only), 1/60 s apart
    const a = Math.max(t0, l.t0 + l.flight * CATCH.catchFrom), b = Math.min(t, end);
    let got = false;
    if (b >= a) for (let k = 0, n = Math.max(1, Math.ceil((b - a) * 60)); k <= n && !got; k++) if (touches(flyAt(l, a + ((b - a) * k) / n, to), pos)) got = true;
    if (got) { run.done.add(l.n); run.caught.add(l.n); const w = l.kind === 'gold' ? CATCH.goldWorth : 1; run.score += w; out.push({ type: 'catch', n: l.n, gold: l.kind === 'gold', worth: w }); }
    else if (end <= t) { run.done.add(l.n); run.missed.add(l.n); out.push({ type: 'miss', n: l.n }); }
  }
  run.t = t;
  if (t >= plan.end) { run.over = true; out.push({ type: 'end', won: run.score >= plan.need, score: run.score }); }
  return out;
}
// The flights in the air now (for the meshes): [{ l, q, to }].
export function inAir(run, t) {
  const out = [];
  for (const l of run.plan.launches) {
    if (run.done.has(l.n) || l.t0 > t) continue;
    const to = l.kind === 'pie' ? run.pieTo.get(l.n) : l.to, q = flyAt(l, t, to);
    if (q) out.push({ l, q, to });
  }
  return out;
}
export const slowed = (run, t) => t < run.slowUntil;
// How many jacks are still to come (not caught, not missed).
export const jacksLeft = run => run.plan.launches.filter(l => l.kind !== 'pie' && !run.done.has(l.n)).length;
