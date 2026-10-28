// T48 (plans/T48-surprise-party.md): Pop-Up Whack, a party game of Jolly Jax's Surprise Party. Pure, no imports, Node-runnable.
//
// Nine pop-up boxes in a 3 x 3 on the party floor. A box shakes, then a jack pops up out of it for a short moment, one or two at a time.
// Whack! (the party stick: E, a click, the big button, or a tap on the jack) a jack before it hides: 1 point, a gold jack 2. A pie jack
// holds a cream pie: do NOT whack it (a splat: cream on the screen, a point off). A whack at nothing spins the stick round for a moment,
// so whacking all the time does not work. Rounds need 8 / 11 / 14 points in 30 s, and the jacks stay up shorter each round. A missed
// round simply starts again; after two misses the jacks stay up longer and there is more time (fairHelp, passed in as `help`).
//
// Reflexes with a "do not hit that one" rule. The pops are a plan from a hash of seed | round | attempt (no Math.random) and every jack
// is a closed form of the round clock, so a replay of the same presses is the same game at 60 and 20 frames a second.
// Boxes are numbered 0..8 row by row; the "Mirror!" twist pops a jack from the box opposite (8 - i) the one that shook.

export const WHACK = {
  time: 30,
  need: [8, 11, 14],
  up: [1.3, 1.1, 0.9],        // seconds a jack stays up, per round
  gap: [1.15, 0.95, 0.8],     // seconds between pops
  doubles: [0, 0.25, 0.4],     // the share of pops that bring a second jack at once (another box)
  pies: [0.14, 0.2, 0.26],     // the share of jacks that hold a pie
  goldEvery: [5, 8],           // a gold jack every 5-8 jacks
  shake: 0.45,                 // a box shakes this long before its jack pops
  rise: 0.12,                  // (looks) up and down this fast
  head: 1.1,                   // the jack's head is this far over the box's top when up
  reach: 10,                   // the stick reaches this far (it is a party game: you can whack any box from the pad)
  cone: 7, close: 0.45,        // degrees off the jack's head (or within `close` blocks of the ray) still hit it
  cool: { hit: 0.15, miss: 1.1 },
  pieCost: 1,
  mirror: 0.45,                // "Mirror!": this share of pops come out of the opposite box
  speedy: { up: 0.8, gap: 0.72 },
  hard: { up: 0.9, need: 2 },
};

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
function seeded(key) {
  let a = hashStr(String(key)) | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// One try of round `round` (1..3). help = fairHelp(misses) ({ slow, extra }); twist = null | 'dark' | 'mirror' | 'speedy'.
// -> { pops: [{ n, box, shook, t0, up, kind: 'jack' | 'gold' | 'pie' }], time, need, ... }
export function whackPlan(seed, round, attempt, { twist = null, hard = false, help = { slow: 1, extra: 0 } } = {}) {
  const r = Math.min(3, Math.max(1, round | 0)) - 1, rnd = seeded(`whack|${seed}|${round}|${attempt}`);
  const H = hard ? WHACK.hard : { up: 1, need: 0 }, S = twist === 'speedy' ? WHACK.speedy : { up: 1, gap: 1 };
  const up = (WHACK.up[r] * H.up * S.up) / Math.max(0.3, help.slow ?? 1), gap = WHACK.gap[r] * S.gap;
  const time = WHACK.time + (help.extra || 0), pops = [];
  let t = 1.0, n = 0, jacks = 0, last = -1, nextGold = WHACK.goldEvery[0] + Math.floor(rnd() * (WHACK.goldEvery[1] - WHACK.goldEvery[0] + 1));
  const busyAt = (box, t0) => pops.some(p => p.box === box && t0 < p.t0 + p.up + 0.3 && t0 + up + 0.3 > p.t0);
  const pick = (avoid) => { let b = 0; for (let k = 0; k < 30; k++) { b = Math.floor(rnd() * 9); if (!avoid.includes(b)) break; } return b; };
  while (t + WHACK.shake < time - 0.5) {
    const two = rnd() < WHACK.doubles[r], used = [last];
    for (let k = 0; k < (two ? 2 : 1); k++) {
      let box = pick(used);
      for (let tries = 0; tries < 9 && busyAt(box, t); tries++) box = (box + 1) % 9;
      used.push(box);
      jacks++;
      let kind = rnd() < WHACK.pies[r] && jacks > 2 ? 'pie' : 'jack';
      if (kind === 'jack' && jacks >= nextGold) { kind = 'gold'; nextGold = jacks + WHACK.goldEvery[0] + Math.floor(rnd() * (WHACK.goldEvery[1] - WHACK.goldEvery[0] + 1)); }
      const shook = twist === 'mirror' && rnd() < WHACK.mirror ? 8 - box : box;
      pops.push({ n: n++, box, shook, t0: t + WHACK.shake + k * 0.15, up, kind });
      last = box;
    }
    t += gap * (two ? 1.35 : 1) * (0.85 + rnd() * 0.3);
  }
  const need = WHACK.need[r] + H.need;
  return { seed, round: r + 1, attempt, twist, hard: !!hard, pops, time, need, up, most: pops.reduce((s, p) => s + (p.kind === 'gold' ? 2 : p.kind === 'jack' ? 1 : 0), 0) };
}

export function newWhack(plan) { return { plan, score: 0, hits: new Set(), splats: 0, whiffs: 0, ready: 0, log: [], over: null }; }

// How far up the jack of pop p is at t (0 = in its box, 1 = all the way up; null = not out / already whacked).
export function riseOf(st, p, t) {
  if (st.hits.has(p.n)) return null;
  const u = t - p.t0;
  if (u < 0 || u > p.up) return null;
  const R = WHACK.rise;
  return Math.min(1, u / R, (p.up - u) / R);
}
// The box that shakes at t (a jack is coming; for the looks): [box indexes].
export const shaking = (st, t) => st.plan.pops.filter(p => t >= p.t0 - WHACK.shake && t < p.t0).map(p => p.shook);
// The jacks that are up at t: [{ p, rise }].
export function upAt(st, t) { const out = []; for (const p of st.plan.pops) { const r = riseOf(st, p, t); if (r != null) out.push({ p, rise: r }); } return out; }
// The head of an up jack: boxes[i].at = the middle of the box's top, [x, y, z].
export const headOf = (boxes, p, rise = 1) => { const a = boxes[p.box].at; return { x: a[0], y: a[1] + WHACK.head * rise, z: a[2] }; };

// Which up jack a stick swung from `eye` along `dir` would meet (the one nearest the ray), or null.
export function aimed(st, t, boxes, eye, dir) {
  const dl = Math.hypot(dir.x, dir.y, dir.z) || 1, ux = dir.x / dl, uy = dir.y / dl, uz = dir.z / dl;
  let best = null;
  for (const { p, rise } of upAt(st, t)) {
    const h = headOf(boxes, p, Math.max(0.5, rise)), dx = h.x - eye.x, dy = h.y - eye.y, dz = h.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d > WHACK.reach) continue;
    const along = dx * ux + dy * uy + dz * uz;
    if (along <= 0) continue;
    const off = Math.sqrt(Math.max(0, d * d - along * along)), ang = (Math.atan2(off, along) * 180) / Math.PI;
    if (ang > WHACK.cone && off > WHACK.close) continue;
    if (!best || off < best.off) best = { p, off };
  }
  return best?.p ?? null;
}

// Whack! at t. -> { swung: false } while the stick comes back, else { swung: true, hit, pie, gold, points }.
export function whackAt(st, t, boxes, eye, dir) {
  if (st.over || t < st.ready - 1e-9) return { swung: false };
  const p = aimed(st, t, boxes, eye, dir);
  if (!p) { st.whiffs++; st.ready = t + WHACK.cool.miss; st.log.push({ t, hit: false }); return { swung: true, hit: false }; }
  st.hits.add(p.n);
  st.ready = t + WHACK.cool.hit;
  if (p.kind === 'pie') { st.splats++; st.score = Math.max(0, st.score - WHACK.pieCost); st.log.push({ t, n: p.n, pie: true }); return { swung: true, hit: true, pie: true, points: -WHACK.pieCost, n: p.n }; }
  const pts = p.kind === 'gold' ? 2 : 1;
  st.score += pts;
  st.log.push({ t, n: p.n, pts });
  if (st.score >= st.plan.need) st.over = 'won';
  return { swung: true, hit: true, gold: p.kind === 'gold', points: pts, n: p.n, won: st.over === 'won' };
}
// The round clock ran out?
export function whackTimeUp(st, t) { if (!st.over && t >= st.plan.time) st.over = st.score >= st.plan.need ? 'won' : 'missed'; return st.over; }
