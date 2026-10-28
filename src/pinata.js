// T44 rework (owner 2026-10-27, plans/T44.md "Rework"): the Piñata Party's rules. Pure, no imports, Node-runnable.
//
// A piñata hangs on a rope from a bunch of balloons that drift round the ring in the middle of the hall. It swings like a pendulum
// (low = in reach, at the ends of a swing it is up out of reach). You whack it with a party stick: one press, the stick swings the way
// you look. A whack that meets the piñata while it swings AT you is a big hit (CRACK! 2), any other hit is a small one (Bonk! 1), and
// every hit knocks it away the way you hit it, so it swings back at you half a swing later: a rhythm, like a tetherball, while the
// balloons drift (you follow them) and from the second piñata on it sometimes dodges sideways. Out of hits = it bursts: candy and a bow.
//
// Everything is a closed form of the round's own clock `t` (seconds since Play!): the balloons' path, the swing since the last hit
// (`segs`), so a replay with the same presses gives the same piñata at 60 and at 20 steps a second. The randomness (the path, its
// turn, the first swing, the dodges) comes from a hash of seed | round | attempt (| hit number): no Math.random.

export const PINATA = {
  ring: { x: 56.5, z: 53.5, r: 9 },     // the party rug in the middle of the party floor (partyland.js builds the room round it)
  rope: 4.6,                           // rope length
  low: 12.9,                           // the piñata's middle at the bottom of a swing (your eyes are at 12.6)
  maxOut: 0.92,                        // a swing never goes further out than this x the rope
  reach: 2.1,                          // the stick reaches this far (sideways, from your eyes)
  close: 0.9,                          // this close it is a hit whatever way you look
  cone: 50,                            // degrees either side of where you look
  band: [-1.45, 0.95],                 // the piñata's height against your eyes for a hit (below, above)
  window: [-0.04, 0.16], sample: 0.02, // the stick is in the air for a moment: a press counts for this bit before / after
  bigV: 1.5,                           // blocks a second towards you (or more) = a big hit ...
  bigLow: 0.4,                         // ... near the bottom of its swing (where it is fastest)
  dmg: { big: 1, small: 0 },          // only a CRACK cracks it; a Bonk just knocks it away
  cool: { hit: 0.45, miss: 2.0 },      // the stick swings back; a whiff spins you round (so whacking all the time does not work)
  minKick: 0.8,                        // a hit always sends it out at least this far
  dodgeTurn: 70,                       // degrees a dodge turns the knock
  zipTime: 0.6,                        // after a hit the balloons zip on along their path (the round's `zip` blocks) in this many seconds
  rounds: [
    { id: 'llama', name: 'Llama Piñata', hp: 5, period: 2.8, speed: 0.8, path: 'circle', size: [2.5, 2.5], amp: 2.3, wide: 0.6, hitAmp: 2.5, zip: [2.4, 3.6], dodge: 0, zipBack: 0, time: 40 },
    { id: 'star', name: 'Star Piñata', hp: 7, period: 2.35, speed: 1.4, path: 'eight', size: [4.2, 2.6], amp: 2.5, wide: 1.0, hitAmp: 2.8, zip: [2.8, 4.2], dodge: 0.25, zipBack: 0, time: 45 },
    { id: 'rocket', name: 'Rocket Piñata', hp: 9, period: 1.95, speed: 2.1, path: 'wander', size: [4.2, 3.8], amp: 2.7, wide: 1.4, hitAmp: 3.0, zip: [3.2, 5], dodge: 0.35, zipBack: 0.3, time: 55 },
  ],
  // the rubber band: after a miss (time up) the next try swings slower, the balloons drift slower and it needs a hit less; after two, more so
  help: [{ period: 1, speed: 1, hp: 0, zip: 1 }, { period: 1.2, speed: 0.7, hp: -1, zip: 0.75 }, { period: 1.4, speed: 0.45, hp: -2, zip: 0.5 }],
  hard: { hp: 2, period: 0.9, speed: 1.2, zip: 1.15 },   // a rematch (Jolly Jax beaten before)
};
export const helpOf = misses => Math.min(2, Math.max(0, misses | 0));

export function hashStr(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
export function seeded(key) {
  let a = hashStr(String(key)) | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// One try at piñata `round` (1..3): its numbers and the random parts of its path and first swing.
export function pinataPlan(seed, round, attempt, { help = 0, hard = false } = {}) {
  const R = PINATA.rounds[round - 1], H = PINATA.help[helpOf(help)], X = hard ? PINATA.hard : { hp: 0, period: 1, speed: 1, zip: 1 };
  const rnd = seeded(`pinata|${seed}|${round}|${attempt}`);
  const period = R.period * H.period * X.period, speed = R.speed * H.speed * X.speed;
  const turn = rnd() * Math.PI * 2, sign = rnd() < 0.5 ? -1 : 1;
  const ph = [0, 1, 2, 3].map(() => rnd() * Math.PI * 2);
  const [A, Bz] = R.size;
  // angular speeds that give about `speed` blocks a second along the path
  const w = R.path === 'circle' ? speed / A : R.path === 'eight' ? speed / Math.hypot(A, 2 * Bz) : speed / (0.75 * Math.hypot(A, Bz));
  const swingDir = rnd() * Math.PI * 2;
  return {
    seed, round, attempt, help: helpOf(help), hard: !!hard, id: R.id, name: R.name,
    hp: Math.max(3, R.hp + H.hp + X.hp), zip: R.zip.map(b => b * H.zip * X.zip), period, omega: (2 * Math.PI) / period, speed, time: R.time, dodge: R.dodge, zipBack: R.zipBack, hitAmp: R.hitAmp,
    path: { kind: R.path, A, B: Bz, w, turn, sign, ph },
    first: { dir: swingDir, amp: R.amp, wide: R.wide * (rnd() < 0.5 ? -1 : 1) },
  };
}

// Where the balloons (the top of the rope) are at path time `t`, and how fast they go then: { x, z, vx, vz }.
export function pathAt(plan, t) {
  const { kind, A, B, w, turn, sign, ph } = plan.path, c = PINATA.ring;
  let x, z, vx, vz;
  if (kind === 'circle') { const a = sign * w * t + ph[0]; x = A * Math.cos(a); z = A * Math.sin(a); vx = -A * sign * w * Math.sin(a); vz = A * sign * w * Math.cos(a); }
  else if (kind === 'eight') { const a = sign * w * t + ph[0]; x = A * Math.sin(a); z = B * Math.sin(2 * a); vx = A * sign * w * Math.cos(a); vz = 2 * B * sign * w * Math.cos(2 * a); }
  else { // wander: two waves on each axis that never line up, so it turns and doubles back now and then
    const f = [1, 1.73, 1.31, 2.17];
    x = A * (0.65 * Math.sin(f[0] * w * t + ph[0]) + 0.35 * Math.sin(f[1] * w * t + ph[1]));
    z = B * (0.65 * Math.sin(f[2] * w * t + ph[2]) + 0.35 * Math.sin(f[3] * w * t + ph[3]));
    vx = A * w * (0.65 * f[0] * Math.cos(f[0] * w * t + ph[0]) + 0.35 * f[1] * Math.cos(f[1] * w * t + ph[1]));
    vz = B * w * (0.65 * f[2] * Math.cos(f[2] * w * t + ph[2]) + 0.35 * f[3] * Math.cos(f[3] * w * t + ph[3]));
  }
  const cs = Math.cos(turn), sn = Math.sin(turn);
  return { x: c.x + x * cs - z * sn, z: c.z + x * sn + z * cs, vx: vx * cs - vz * sn, vz: vx * sn + vz * cs };
}

// A try in progress: the swing since the last hit is a segment { t0, o: [x, z], v: [x, z] } (offset from under the balloons and its speed then).
export function newRun(plan) {
  const f = plan.first, d = [Math.cos(f.dir), Math.sin(f.dir)], q = [-d[1], d[0]];
  // o(t) = o0 cos(wt) + v0 / w sin(wt): starts out to the side by `wide`, swinging along `dir` by `amp` (an ellipse)
  return { plan, zips: [], segs: [{ t0: 0, o: [q[0] * f.wide, q[1] * f.wide], v: [d[0] * f.amp * plan.omega, d[1] * f.amp * plan.omega] }], hp: plan.hp, hits: 0, big: 0, whiffs: 0, ready: 0, done: false, burstAt: null, log: [] };
}
// The balloons zip along their path after every hit (`zips`: { tau, s } = s seconds of path, eased in over PINATA.zipTime), so the
// piñata never comes back to the same spot: run to it. Path time u(t) = t + the zips so far; du/dt for the speed.
const zipEase = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k)), zipEase1 = k => (k <= 0 || k >= 1 ? 0 : 6 * k * (1 - k));
export function topAt(run, t) {
  const Z = PINATA.zipTime;
  let u = t, du = 1;
  for (const z of run.zips) { const k = (t - z.tau) / Z; if (k <= 0) continue; u += z.s * zipEase(k); du += (z.s * zipEase1(k)) / Z; }
  const q = pathAt(run.plan, u);
  return { x: q.x, z: q.z, vx: q.vx * du, vz: q.vz * du };
}
const segAt = (run, t) => { const s = run.segs; for (let i = s.length - 1; i > 0; i--) if (s[i].t0 <= t) return s[i]; return s[0]; };

// The piñata at `t`: { x, y, z, vx, vz (sideways speed, balloons included), ox, oz (its offset), top }.
export function pinataAt(run, t) {
  const plan = run.plan, w = plan.omega, s = segAt(run, t), u = Math.max(0, t - s.t0), c = Math.cos(w * u), sn = Math.sin(w * u);
  let ox = s.o[0] * c + (s.v[0] / w) * sn, oz = s.o[1] * c + (s.v[1] / w) * sn;
  let ovx = -s.o[0] * w * sn + s.v[0] * c, ovz = -s.o[1] * w * sn + s.v[1] * c;
  const L = PINATA.rope, max = L * PINATA.maxOut, r = Math.hypot(ox, oz);
  if (r > max) { const k = max / r; ox *= k; oz *= k; ovx *= k; ovz *= k; }
  const top = topAt(run, t), rr = Math.hypot(ox, oz);
  const y = PINATA.low + L - Math.sqrt(L * L - rr * rr);
  return { x: top.x + ox, y, z: top.z + oz, vx: top.vx + ovx, vz: top.vz + ovz, ox, oz, top };
}

// Would a stick swung at `t` from `eye` looking along `dir` (any length; only its sideways part counts) meet the piñata at `tau`?
export function inReach(p, eye, dir) {
  const dx = p.x - eye.x, dz = p.z - eye.z, dy = p.y - eye.y, dh = Math.hypot(dx, dz);
  if (dy < PINATA.band[0] || dy > PINATA.band[1] || dh > PINATA.reach) return false;
  if (dh <= PINATA.close) return true;
  const fl = Math.hypot(dir.x, dir.z);
  if (fl < 1e-6) return false;
  const cos = (dx * dir.x + dz * dir.z) / (dh * fl);
  return cos >= Math.cos((PINATA.cone * Math.PI) / 180);
}
// How fast the piñata comes towards the eye (blocks a second; < 0 = going away).
export function towards(p, eye) {
  const dx = eye.x - p.x, dz = eye.z - p.z, d = Math.hypot(dx, dz) || 1;
  return (p.vx * dx + p.vz * dz) / d;
}

// A press at `t`. Returns { swung: false } while the stick swings back, else { swung: true, hit, big, dmg, dodge, burst, tau } and changes the run.
export function whack(run, t, eye, dir) {
  if (run.done || t < run.ready - 1e-9) return { swung: false };
  const P = PINATA;
  let tau = null, p = null;
  for (let k = P.window[0]; k <= P.window[1] + 1e-9; k += P.sample) {
    const q = pinataAt(run, Math.max(0, t + k));
    if (inReach(q, eye, dir)) { tau = Math.max(0, t + k); p = q; break; }
  }
  if (tau == null) { run.whiffs++; run.ready = t + P.cool.miss; run.log.push({ t, hit: false }); return { swung: true, hit: false }; }
  const big = towards(p, eye) >= P.bigV && p.y <= P.low + P.bigLow, dmg = big ? P.dmg.big : P.dmg.small;
  run.hits++; if (big) run.big++;
  run.hp = Math.max(0, run.hp - dmg);
  run.ready = t + P.cool.hit;
  // the knock: the way you hit it (sideways), sometimes turned (it dodges), out to `hitAmp`
  const plan = run.plan, rnd = seeded(`knock|${plan.seed}|${plan.round}|${plan.attempt}|${run.hits}`);
  const dodge = rnd() < plan.dodge ? (rnd() < 0.5 ? -1 : 1) : 0;
  let a = Math.atan2(dir.z, dir.x) + (dodge * P.dodgeTurn * Math.PI) / 180;
  const o = [p.ox, p.oz], room = Math.max(P.minKick, Math.sqrt(Math.max(0, plan.hitAmp * plan.hitAmp - (o[0] * o[0] + o[1] * o[1]))));
  const v = [Math.cos(a) * room * plan.omega, Math.sin(a) * room * plan.omega];
  run.segs.push({ t0: tau, o, v });
  // the balloons zip on along their path (the third piñata may zip back)
  const zb = plan.zip[0] + rnd() * (plan.zip[1] - plan.zip[0]), back = rnd() < plan.zipBack ? -1 : 1;
  run.zips.push({ tau, s: (back * zb) / Math.max(0.2, plan.speed) });
  if (run.segs.length > 64) run.segs.splice(1, run.segs.length - 64); // (old swings are never looked at again)
  const burst = run.hp <= 0;
  if (burst) { run.done = true; run.burstAt = tau; }
  run.log.push({ t, tau, hit: true, big, dmg, dodge: !!dodge });
  return { swung: true, hit: true, big, dmg, dodge: !!dodge, burst, tau };
}
export const timeUp = (run, t) => !run.done && t >= run.plan.time;
