// T49: Shield Up! (the Castle, plans/T49-castle.md section 3), pure: no game imports (only kindhelp.js's kindHelp, itself pure), so it
// runs in Node. You stand on a Shield Stone; the castle's practice catapults lob squishy pumpkins and its archers shoot suction-cup
// arrows at you from twelve spots all round. Push the stick toward the danger (the shield points where the stick points; with no stick
// it points where you look), hold Jump to lift it over your head for a pumpkin falling from the sky. A throw is judged at the moment it
// arrives (a closed-form time) with the shield as it is in that frame: so the same presses give the same result at any frame rate.
// Never a fail: a pumpkin that gets through is only a soft "Splat! Yuck, sticky!", and a round that ends short of its number starts
// again (after two short rounds the shared kind help slows it down a tiny bit).
import { kindHelp } from './kindhelp.js';

const D = Math.PI / 180;
export const SIEGE = {
  stones: [[76.5, 11, 130.5], [84.5, 11, 130.5]], // the two stand points (two friends can play side by side)
  centre: [80.5, 130.5], ring: 18, launchY: 14.5,
  gate: [80.5, 27.5, 104.5],                     // spot 0: the catapult on the wall top over the gatehouse
  front: [10, 11, 0, 1, 2],                      // the castle side
  behind: [4, 5, 6, 7, 8],
  cover: 35 * D, perfect: 12 * D, chest: 1.2, skyHigh: 12, reach: 2.5, // reach: a stone's stand radius (you must stand on it)
  tell: { pumpkin: [1.0, 0.8, 0.6], arrow: [1.2, 1.0, 0.8], sky: [0.8, 0.8, 0.8], big: [1.0, 0.9, 0.8] }, // by round
  flight: { pumpkin: [1.5, 1.3, 1.05], arrow: 0.6, sky: 1.6 },
  lead: 2.5, end: 1.2,                           // the first arrival at least this long after the round starts; the result this long after the last
  rounds: [
    { n: 10, need: 8, front: true, kinds: { pumpkin: 10 }, pairs: 0, gap: 1.8, pairGap: 0 },
    { n: 12, need: 9, kinds: { pumpkin: 8, arrow: 4 }, pairs: 2, gap: 1.25, pairGap: 0.7, behind: 4 },
    { n: 14, need: 12, kinds: { pumpkin: 6, arrow: 4, sky: 2, big: 2 }, pairs: 3, gap: 1.05, pairGap: 0.5, behind: 3 },
  ],
  hard: { extra: 2, need: 1, tell: 0.85 },
  dt: 1 / 120,
};
export const SIEGE_ROUNDS = SIEGE.rounds.length;

// A small seeded random (no Math.random): the same seed gives the same throws on every device.
export function seeded(s) { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// Where spot k throws from: [x, y, z].
export function spotPos(k) {
  if (k === 0) return SIEGE.gate.slice();
  const a = k * 30 * D, [cx, cz] = SIEGE.centre;
  return [cx + Math.sin(a) * SIEGE.ring, SIEGE.launchY, cz - Math.cos(a) * SIEGE.ring];
}
// The cell a practice tower stands on (3 x 3 round it), for spots 1..11.
export const towerCell = k => { const p = spotPos(k); return [Math.floor(p[0]), Math.floor(p[2])]; };
// The direction from a stand point to spot k, as an angle atan2(dx, dz) (the same angle as a stick or view direction (x, z)).
export function dirTo(stand, k) { const p = spotPos(k); return Math.atan2(p[0] - stand[0], p[2] - stand[2]); }
export const angleOf = (x, z) => Math.atan2(x, z);
// Which stone a position stands on (index) or -1.
export function stoneAt(pos) {
  for (let i = 0; i < SIEGE.stones.length; i++) { const s = SIEGE.stones[i]; if (Math.hypot(pos.x - s[0], pos.z - s[2]) <= SIEGE.reach && Math.abs(pos.y - s[1]) < 1.5) return i; }
  return -1;
}

// The throws of round r (0-based) for one try: { throws: [{ i, at, k, kind, tell, flight }], need, n, end }. `help` = how many short tries of
// this round in a row (kindHelp: every throw's timing / (1 - ease), the cover x (1 + ease)), `hard` = a rematch (you hold the star). Pure: a seed and the same numbers give the same list.
export function siegePlan(seed, round, attempt = 0, { help = 0, hard = false } = {}) {
  const R = SIEGE.rounds[round], rnd = seeded(hashStr(`siege|${seed}|${round}|${attempt}`));
  const kh = kindHelp(help), slow = kh.slow, tellK = (hard ? SIEGE.hard.tell : 1) / slow;
  const n = R.n + (hard ? SIEGE.hard.extra : 0), need = R.need + (hard ? SIEGE.hard.need : 0);
  // the kinds, in a shuffled order
  const kinds = [];
  for (const [k, c] of Object.entries(R.kinds)) for (let i = 0; i < c; i++) kinds.push(k);
  while (kinds.length < n) kinds.push(rnd() < 0.5 ? 'pumpkin' : (R.kinds.arrow ? 'arrow' : 'pumpkin'));
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  // pair positions: i (>= 1) arrives just after i - 1; neither is a sky one
  const pairAt = new Set();
  for (let tries = 0; pairAt.size < R.pairs && tries < 200; tries++) {
    const i = 1 + Math.floor(rnd() * (n - 1));
    if (pairAt.has(i) || pairAt.has(i - 1) || pairAt.has(i + 1) || (R.behind && i % 3 === 1)) continue; // (a 'from behind' slot is never the second of a pair)
    pairAt.add(i);
  }
  for (const i of pairAt) for (const j of [i - 1, i]) if (kinds[j] === 'sky') { // swap the sky one with a plain pumpkin elsewhere
    const o = kinds.findIndex((k, x) => k === 'pumpkin' && !pairAt.has(x) && !pairAt.has(x + 1) && x !== i && x !== i - 1);
    if (o >= 0) [kinds[j], kinds[o]] = [kinds[o], kinds[j]];
  }
  // spots
  const pool = R.front ? SIEGE.front : Array.from({ length: 12 }, (_, k) => k);
  const spots = [];
  for (let i = 0; i < n; i++) {
    let k, tries = 0;
    const prev = spots[i - 1];
    do {
      k = pool[Math.floor(rnd() * pool.length)];
      if (R.behind && i % 3 === 1 && !SIEGE.behind.includes(k)) continue; // every third one from behind
      if (pairAt.has(i) && prev != null && Math.abs(wrap((k - prev) * 30 * D)) < 89 * D) continue; // a pair comes from sides >= 90 degrees apart
      if (k === prev) continue;
      break;
    } while (++tries < 400);
    spots.push(k);
  }
  // times: arrivals
  const throws = [];
  let at = SIEGE.lead / slow;
  for (let i = 0; i < n; i++) {
    const kind = kinds[i], pair = pairAt.has(i);
    if (i > 0) at += pair ? R.pairGap / slow : (R.gap * (1 + rnd() * 0.4)) / slow;
    if (i > 0 && (kind === 'sky' || kinds[i - 1] === 'sky')) at = Math.max(at, throws[i - 1].at + 0.6 / slow); // a sky one is never close to another arrival
    const flight = (kind === 'arrow' ? SIEGE.flight.arrow : kind === 'sky' ? SIEGE.flight.sky : SIEGE.flight.pumpkin[round]) / slow;
    const tell = SIEGE.tell[kind][round] * tellK;
    throws.push({ i, at, k: spots[i], kind, tell, flight, pair });
  }
  // a tell may not start before the round does: push everything later if needed
  const early = Math.min(...throws.map(t => t.at - t.flight - t.tell));
  if (early < 0.3) for (const t of throws) t.at += 0.3 - early;
  return { throws, need, n, end: throws[n - 1].at + SIEGE.end, round, help, hard, cover: SIEGE.cover * kh.more };
}

// The result of one throw arriving at a stand point with the shield at angle `ang` (atan2(x, z)) and `up` (held over the head).
// -> 'perfect' | 'block' | 'splat'.
export function judge(t, stand, ang, up, cover = SIEGE.cover) {
  if (t.kind === 'sky') return up ? 'block' : 'splat';
  if (up) return 'splat';
  const err = Math.abs(wrap(ang - dirTo(stand, t.k)));
  if (t.kind === 'big') return err <= SIEGE.perfect ? 'perfect' : 'splat';
  return err <= SIEGE.perfect ? 'perfect' : err <= cover ? 'block' : 'splat';
}

// Where a throw is at round time `time` for drawing: { phase: 'wait' | 'tell' | 'fly' | 'gone', u (0..1 of the phase), pos: [x, y, z] }.
export function throwAt(t, stand, time) {
  const launch = t.at - t.flight, tellAt = launch - t.tell;
  if (time < tellAt) return { phase: 'wait', u: 0, pos: null };
  const from = spotPos(t.k), to = [stand[0], stand[1] + SIEGE.chest, stand[2]];
  if (time < launch) return { phase: 'tell', u: (time - tellAt) / t.tell, pos: from };
  if (time > t.at) return { phase: 'gone', u: 1, pos: to };
  const u = (time - launch) / t.flight;
  if (t.kind === 'sky') { // straight down onto the stone from skyHigh above your head
    return { phase: 'fly', u, pos: [to[0], to[1] + SIEGE.skyHigh * (1 - u * u), to[2]] };
  }
  const apex = t.kind === 'arrow' ? 0.4 : 4;
  return { phase: 'fly', u, pos: [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u + 4 * apex * u * (1 - u), from[2] + (to[2] - from[2]) * u] };
}

// One round, stepped: update(dt, { ang, up }) -> events [{ type: 'tell' | 'launch' | 'hit', t, result? }, { type: 'done', won, blocks, need }].
// The input is held for the whole frame (the frame's own shield), the round clock is summed dt in fixed sub-steps.
export class SiegeRound {
  constructor(seed, round, attempt, stone, opts = {}) {
    this.plan = siegePlan(seed, round, attempt, opts);
    this.round = round; this.stone = stone; this.stand = SIEGE.stones[stone];
    this.time = 0; this.blocks = 0; this.perfects = 0; this.row = 0; this.splats = 0;
    this.results = []; this.done = false; this.won = false;
    this.told = new Set(); this.launched = new Set();
  }
  get need() { return this.plan.need; }
  get left() { return this.plan.n - this.results.length; }
  update(dt, input = { ang: 0, up: false }) {
    const ev = [];
    if (this.done) return ev;
    let rest = Math.max(0, dt);
    while (rest > 1e-9) {
      const h = Math.min(SIEGE.dt, rest); rest -= h;
      const t0 = this.time, t1 = this.time + h;
      for (const t of this.plan.throws) {
        const launch = t.at - t.flight, tellAt = launch - t.tell;
        if (!this.told.has(t.i) && tellAt <= t1) { this.told.add(t.i); ev.push({ type: 'tell', t }); }
        if (!this.launched.has(t.i) && launch <= t1) { this.launched.add(t.i); ev.push({ type: 'launch', t }); }
        if (t.at > t0 && t.at <= t1 && this.results[t.i] === undefined) {
          const r = judge(t, this.stand, input.ang, !!input.up, this.plan.cover);
          this.results[t.i] = r;
          if (r === 'splat') { this.splats++; this.row = 0; } else { this.blocks++; if (r === 'perfect') { this.perfects++; this.row++; } else this.row = 0; }
          ev.push({ type: 'hit', t, result: r, row: this.row });
        }
      }
      this.time = t1;
      if (this.time >= this.plan.end) {
        this.done = true; this.won = this.blocks >= this.plan.need;
        ev.push({ type: 'done', won: this.won, blocks: this.blocks, need: this.plan.need });
        break;
      }
    }
    return ev;
  }
  // the throws you can see now (tell or flying), for drawing and the pointers
  active() {
    const out = [];
    for (const t of this.plan.throws) { const a = throwAt(t, this.stand, this.time); if ((a.phase === 'tell' || a.phase === 'fly') && this.results[t.i] === undefined) out.push({ t, ...a }); }
    return out;
  }
}
