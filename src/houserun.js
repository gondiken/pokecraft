// The House Run (owner 2026-10-30: "time trials sound good. Though each room is too small to have this become meaningful"): one timed
// run through all ten rooms of the Portal House in a row, Hall -> room 1 -> ... -> room 10 -> back in the Hall. Pure (no imports, no
// three.js): the live part (portalhouselive.js) owns the plate, the board and the chip and only calls this.
//
// Easy to understand: step on the gold plate in the Hall, 3-2-1 Go!, through door 1, and every room's exit already leads to the next
// room; the clock stops when room 10's exit puts you back in the Hall. Hard to master: the medals (`RUN.medals`) come from the House's
// own physics: tests/portalcheck.mjs `runTimes` finds a skilled player's fastest way through every room (about 41 s), a careful one
// that aims slowly and never sprints takes about 75 s, a slow one that also misses once a room about 150 s. Gold needs the fast tricks.
// Open to everyone at any time (a first-timer can run too; it is just slow); it never gates anything and gives no star.
// The clock is summed frame time and only runs while the game is playing (not paused, no panel); a battle or leaving the House stops
// the run quietly (nothing saved); a fall onto the soft cloud keeps the clock running (that is the cost of a miss).
// Records (save field `records`, generic for later time trials of other worlds): { '<world>:<trial>': { best, splits, bests, medal, paid } }.
export const RUN = {
  key: 'portal:run',
  rooms: 10,
  count: 3,                                                       // the countdown on the plate (seconds)
  medals: [['gold', 60], ['silver', 90], ['bronze', 180]],        // a total at or under these seconds
  cubes: 5,                                                       // Capture Cubes for the first gold (once)
};
export const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const RANK = { gold: 3, silver: 2, bronze: 1 };

export const medalOf = t => (RUN.medals.find(([, s]) => t <= s) ?? [null])[0];
export const betterMedal = (a, b) => ((RANK[a] ?? 0) >= (RANK[b] ?? 0) ? a ?? b ?? null : b);
// 83.42 -> '1:23.4', 9.05 -> '9.0' (tenths, rounded down so the board never shows a time you did not make)
export function fmtTime(t) {
  if (!Number.isFinite(t) || t < 0) return '-';
  const d = Math.floor(t * 10 + 1e-6), m = Math.floor(d / 600), s = (d % 600) / 10;
  return m ? `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}` : s.toFixed(1);
}

// ---- records (the save field) ----
const KEY = /^[a-z0-9]{1,16}:[a-z0-9_-]{1,24}$/;
const time = v => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 36000 ? v : null);
const times = (a, n) => (Array.isArray(a) && a.length <= n ? a.map(v => time(v)) : []);
export function cleanRecord(r) {
  if (!r || typeof r !== 'object') return null;
  const best = time(r.best);
  if (best == null) return null;
  const splits = times(r.splits, 30), bests = times(r.bests, 30);
  return { best, splits, bests, medal: RANK[r.medal] ? r.medal : null, paid: r.paid === true };
}
export function loadRecords(saved) {
  const out = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
  for (const [k, r] of Object.entries(saved)) { if (!KEY.test(k)) continue; const c = cleanRecord(r); if (c) out[k] = c; }
  return out;
}
// A finished run into the records -> { record, newBest, medal, firstGold, splitBests (rooms whose split is a new best) }.
export function recordRun(records, key, total, splits) {
  const old = records[key] ?? null, medal = medalOf(total);
  const newBest = !old || total < old.best;
  const bests = splits.map((s, i) => (old?.bests?.[i] != null ? Math.min(old.bests[i], s) : s));
  const splitBests = splits.map((s, i) => old?.bests?.[i] != null && s < old.bests[i]).map((b, i) => (b ? i + 1 : 0)).filter(Boolean);
  const firstGold = medal === 'gold' && !old?.paid;
  const record = {
    best: newBest ? total : old.best,
    splits: newBest ? [...splits] : old.splits,
    bests,
    medal: betterMedal(old?.medal ?? null, medal),
    paid: !!old?.paid || medal === 'gold',
  };
  records[key] = record;
  return { record, newBest, medal, firstGold, splitBests };
}

// ---- one run ----
// state: 'idle' | 'count' (on the plate) | 'run'. tick(dt) -> 'count' | 'go' | null (events for the chip and the sounds).
export class RunClock {
  constructor(rooms = RUN.rooms) { this.rooms = rooms; this.reset(); }
  reset() { this.state = 'idle'; this.left = 0; this.t = 0; this.next = 1; this.splits = []; this.mark = 0; this.shown = 0; }
  get running() { return this.state === 'run'; }
  get counting() { return this.state === 'count'; }
  arm() { if (this.state !== 'idle') return false; this.state = 'count'; this.left = RUN.count; this.shown = RUN.count; return true; }
  disarm() { if (this.state === 'count') this.reset(); }
  tick(dt) {
    if (this.state === 'count') {
      this.left -= dt;
      if (this.left <= 1e-9) { const over = Math.max(0, -this.left); this.state = 'run'; this.t = over; this.mark = 0; this.next = 1; return 'go'; }
      const n = Math.max(1, Math.ceil(this.left - 1e-9));
      if (n !== this.shown) { this.shown = n; return 'count'; }
      return null;
    }
    if (this.state === 'run') this.t += dt;
    return null;
  }
  // Room n's exit was walked into: its split. -> the split, or null (not the room the run is at: the run stops).
  done(n) {
    if (this.state !== 'run' || n !== this.next) return null;
    const s = this.t - this.mark;
    this.splits.push(s); this.mark = this.t; this.next++;
    return s;
  }
  get finished() { return this.state === 'run' && this.next > this.rooms; }
  stop() { const was = this.state; this.reset(); return was; }
}
