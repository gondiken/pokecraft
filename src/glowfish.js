// T41: the glowfish of the Sunken City, pure (no imports, Node-runnable). The skill game is "Glowfish Catch": swim in 3D, hold Catch! to
// coil and let go to lunge with a net. Three kinds of fish need three tricks (plans/T41.md):
//   shy     Jar Market: sits in a clay jar; bump the jar, it wobbles, the fish shoots out in a straight line, rests, swims home.
//   darter  Arch Gardens: flees faster than you swim in zigzags; in open water it is never caught; cornered in a dead end it trembles.
//   school  Temple Steps: 8 fish in a ball that breathes (tight, spread); one lunge catches everyone inside the net.
// Shy fish and the school are closed forms of the part's own clock (no state, no Math.random: hashes of the fish index). The darter
// reacts to you, so it is stepped in fixed 1/120 s sub-steps (the part does that), which gives the same result at 60 and 20 frames a second.

export const FISH = {
  carry: 8,                                   // the net holds up to 8 (plan: 6; 8 so one lunge can take a whole tight school)
  net: { r: 1.0, ahead: 1.2 },                // the net's sphere, its centre this far in front of the eyes
  // owner 2026-10-28 ("I caught all of them in 90 seconds"): every kind gets away better: a shy fish shoots out faster and further and
  // hides again sooner, a darter notices you from further, is quicker and trembles in a dead end for less time, the school breathes faster
  lunge: { min: 1.5, max: 4, hold: 0.9, time: 0.25, rest: 1.0 }, // length 1.5..4 by how long you held; it takes 0.25 s
  step: 1 / 120,
  shy: { wobble: 0.5, speed: 8, run: 5, drift: 1.6, stay: 2.2, back: 0.6, turn: 0.55 }, // out for stay s after the wobble, then home in back s
  darter: { sense: 9, flee: 11.5, wander: 0.9, stuck: 1.6, flip: 0.35, zig: 0.6, bolt: 1.0, boltSpeed: 13, leash: 7, look: 0.9, dirs: 16, progress: 0.3 },
  school: { n: 8, rMin: 0.6, rMax: 2.4, cycle: 2.2, first: 4.5, drift: 40 },
};
export const PER_DISTRICT = 4, DISTRICTS_N = 3, LIGHTS = PER_DISTRICT * DISTRICTS_N;
export const KINDS = ['shy', 'darter', 'school'];  // district 0, 1, 2
export const lightKey = n => `pw:atlantis:light${n}`;   // n = 1..12 (district d: 4d+1 .. 4d+4)
export const LIGHT_KEY = /^pw:atlantis:light(\d+)$/;

// The saved lights: { lit: [n0, n1, n2], total, done } from the `beaten` list (strings).
export function lightState(game) {
  const b = new Set(game?.beaten ?? []), lit = [0, 0, 0];
  for (let d = 0; d < DISTRICTS_N; d++) for (let k = 1; k <= PER_DISTRICT; k++) if (b.has(lightKey(d * PER_DISTRICT + k))) lit[d]++;
  const total = lit[0] + lit[1] + lit[2];
  return { lit, total, done: total >= LIGHTS };
}
// The first light numbers of district d still missing (n of them).
export function nextLights(game, d, n) {
  const b = new Set(game?.beaten ?? []), out = [];
  for (let k = 1; k <= PER_DISTRICT && out.length < n; k++) if (!b.has(lightKey(d * PER_DISTRICT + k))) out.push(lightKey(d * PER_DISTRICT + k));
  return out;
}
// How many lights n fish of a kind pour: 1 each, but two school fish make one.
export const lightsFor = (kind, n) => (kind === 'school' ? Math.floor(n / 2) : n);
export const fishFor = (kind, lights) => (kind === 'school' ? lights * 2 : lights);
// Fish already poured away (gone) in a district with `lit` lights: the first ones by index. Owner 2026-10-28: with all LIGHTS lit
// (`done`) they all swim back and the catch goes on just for fun (a pour then only makes its lantern sparkle; nothing new is saved).
export const goneCount = (kind, lit, done = false) => (done ? 0 : fishFor(kind, lit));
// The bulbs a for-fun pour of n fish makes sparkle (at least one, at most a lantern's).
export const funLights = (kind, n) => Math.min(PER_DISTRICT, Math.max(1, lightsFor(kind, n)));

// A small hash in 0..1 of two integers (a fish index and a purpose).
export function hash(a, b = 0) {
  let h = Math.imul(a + 1, 374761393) ^ Math.imul(b + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ------------------------------ the net ------------------------------ */

// How far a lunge goes after `held` seconds of coiling.
export const lungeLength = held => FISH.lunge.min + (FISH.lunge.max - FISH.lunge.min) * Math.min(1, Math.max(0, held) / FISH.lunge.hold);
// The net's centre: `ahead` in front of the eyes along the (unit) look.
export const netCentre = (eye, look) => [eye[0] + look[0] * FISH.net.ahead, eye[1] + look[1] * FISH.net.ahead, eye[2] + look[2] * FISH.net.ahead];
// Is a fish at `pos` inside the net round `centre`?
export const inNet = (centre, pos) => dist3(centre, pos) <= FISH.net.r;

/* ------------------------------ shy fish (closed form) ------------------------------ */

// A jar fish at clock t that popped at t0 (null = still in its jar) flying along the unit horizontal `dir`.
// -> { state: 'home' | 'wobble' | 'out' | 'back', pos: [x, y, z], catchable }. Home = the fish peeking over the jar.
export function shyAt(home, t, pop) {
  const S = FISH.shy;
  if (!pop) return { state: 'home', pos: home, catchable: false };
  const u = t - pop.t0;
  if (u < 0) return { state: 'home', pos: home, catchable: false };
  if (u < S.wobble) return { state: 'wobble', pos: home, catchable: false };
  const w = u - S.wobble, tr = S.run / S.speed;
  const s = w <= tr ? S.speed * w : S.run + S.drift * Math.min(w - tr, S.stay - tr);
  const at = k => [home[0] + pop.dir[0] * k, home[1] + pop.dir[1] * k, home[2] + pop.dir[2] * k];
  if (w < S.stay) return { state: 'out', pos: at(s), catchable: true };
  const b = (w - S.stay) / S.back;
  if (b < 1) { const e = 1 - b, far = S.run + S.drift * (S.stay - tr); return { state: 'back', pos: at(far * e * e), catchable: true }; }
  return { state: 'home', pos: home, catchable: false, over: true };
}
// The direction a popped fish shoots (unit, with a little upward): away from `from`, turned by this fish's fixed turn, then turned on
// in 30 degree steps until the whole way (run + drift) is open water. `open(x, y, z)` says whether a point is free.
export function popDir(home, from, index, open) {
  const S = FISH.shy;
  let ax = home[0] - from[0], az = home[2] - from[2];
  const l = Math.hypot(ax, az) || 1;
  ax /= l; az /= l;
  const base = Math.atan2(ax, az) + (hash(index, 1) - 0.5) * 2 * S.turn;
  const len = S.run + S.drift * (S.stay - S.run / S.speed);
  for (let k = 0; k < 12; k++) {
    const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
    const dir = [Math.sin(a) * 0.96, 0.28, Math.cos(a) * 0.96];
    let ok = true;
    for (let s = 0.5; s <= len && ok; s += 0.5) if (!open(home[0] + dir[0] * s, home[1] + dir[1] * s, home[2] + dir[2] * s)) ok = false;
    if (ok) return dir;
  }
  return [0, 1, 0]; // shut in: straight up
}

/* ------------------------------ the school (closed form) ------------------------------ */

// Fish i of a school at clock t. spec = { a: [x, z], b: [x, z], y(z) -> height of the water over the steps }.
// The centre drifts between a and b; the ball breathes between rMin and rMax (slower in the first cycle: spec.first).
export function schoolCentre(spec, t) {
  const f = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / FISH.school.drift);
  const x = spec.a[0] + (spec.b[0] - spec.a[0]) * f, z = spec.a[1] + (spec.b[1] - spec.a[1]) * f;
  return [x, spec.y(z), z];
}
export function schoolRadius(t) {
  const S = FISH.school, u = t < S.first ? t / S.first : (t - S.first) / S.cycle; // the first breath is slower (and the next starts where it ended)
  return S.rMin + (S.rMax - S.rMin) * (0.5 - 0.5 * Math.cos(2 * Math.PI * u));
}
// A fixed unit offset for fish i of n (a spread on a sphere, from the golden angle).
export function schoolOffset(i, n = FISH.school.n) {
  const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.399963;
  return [Math.cos(a) * r, y * 0.8, Math.sin(a) * r];
}
export function schoolFish(spec, t, i) {
  const c = schoolCentre(spec, t), r = schoolRadius(t), o = schoolOffset(i), a = 0.35 * t, ca = Math.cos(a), sa = Math.sin(a);
  const w = 0.07 * Math.sin(t * 2.1 + i * 1.7); // each fish wobbles a little
  const pos = [c[0] + (o[0] * ca - o[2] * sa) * r + w, c[1] + o[1] * r, c[2] + (o[0] * sa + o[2] * ca) * r - w];
  if (spec.floor) pos[1] = Math.max(pos[1], spec.floor(pos[0], pos[2]) + 1.3);
  return pos;
}

/* ------------------------------ the darter (stepped) ------------------------------ */

// A darter in the plane y = this.y. open(x, y, z) says whether a point is free water. step() is called with the fixed FISH.step.
export class Darter {
  constructor(spec) {
    this.id = spec.id; this.index = spec.index ?? 0;
    this.home = [spec.home[0], spec.home[1]];
    this.pos = [spec.at?.[0] ?? spec.home[0], spec.at?.[1] ?? spec.home[1]];
    this.y = spec.y;
    this.dir = [1, 0];
    this.state = 'wander';          // 'wander' | 'flee' | 'stuck' | 'bolt'
    this.t = 0; this.stuckT = 0; this.boltT = 0; this.flip = 1; this.flipT = 0; this.turnT = 0; this.wanderDir = [1, 0];
    this.speed = 0;
  }
  get pos3() { return [this.pos[0], this.y, this.pos[1]]; }
  // Back home and calm (a fish poured for fun swims back to its own dead end).
  goHome() { this.pos = [this.home[0], this.home[1]]; this.state = 'wander'; this.stuckT = 0; this.boltT = 0; this.turnT = 0; this.speed = 0; }
  get catchable() { return true; }
  free(open, x, z) { return open(x, this.y, z) && open(x, this.y + 1, z); }
  // Is the way along unit c open for `len` blocks?
  clear(open, c, len = FISH.darter.look) {
    for (let s = 0.3; s <= len + 1e-6; s += 0.3) if (!this.free(open, this.pos[0] + c[0] * s, this.pos[1] + c[1] * s)) return false;
    return true;
  }
  move(open, c, speed, h) {
    const nx = this.pos[0] + c[0] * speed * h, nz = this.pos[1] + c[1] * speed * h;
    if (this.free(open, nx, nz)) { this.pos[0] = nx; this.pos[1] = nz; this.dir = c; this.speed = speed; return true; }
    this.speed = 0;
    return false;
  }
  // One sub-step. pl = the player's centre [x, y, z].
  step(h, pl, open) {
    const D = FISH.darter, dx = this.pos[0] - pl[0], dz = this.pos[1] - pl[2], dy = this.y - pl[1];
    const d = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dz) || 1;
    const away = [dx / flat, dz / flat];
    this.t += h;
    const scared = d < D.sense || (this.state !== 'wander' && d < D.sense + 1);
    if (this.state === 'bolt') {
      this.boltT -= h;
      if (this.boltT <= 0) this.state = scared ? 'flee' : 'wander';
      else { if (!this.move(open, this.dir, D.boltSpeed, h)) this.boltT = 0; return; }
    }
    if (!scared) { // wandering: a new heading every 2 s (a hash of the fish and the time), back towards home when far
      if (this.state !== 'wander') { this.state = 'wander'; this.stuckT = 0; }
      this.turnT -= h;
      if (this.turnT <= 0) {
        this.turnT = 2;
        const far = Math.hypot(this.pos[0] - this.home[0], this.pos[1] - this.home[1]) > D.leash;
        const a = far ? Math.atan2(this.home[0] - this.pos[0], this.home[1] - this.pos[1]) : hash(this.index, Math.floor(this.t / 2)) * Math.PI * 2;
        this.wanderDir = [Math.sin(a), Math.cos(a)];
      }
      if (!this.clear(open, this.wanderDir, 0.6) || !this.move(open, this.wanderDir, D.wander, h)) this.turnT = 0;
      return;
    }
    // scared: zigzag away from the player
    this.flipT -= h;
    if (this.flipT <= 0) { this.flip = -this.flip; this.flipT = D.flip; }
    const ca = Math.cos(D.zig * this.flip), sa = Math.sin(D.zig * this.flip);
    const want = [away[0] * ca - away[1] * sa, away[0] * sa + away[1] * ca];
    let best = null, bestScore = -9;
    for (let k = 0; k < D.dirs; k++) {
      const a = (k / D.dirs) * Math.PI * 2, c = [Math.sin(a), Math.cos(a)];
      if (c[0] * away[0] + c[1] * away[1] < D.progress) continue; // it must get away from you: a wall in the way of that traps it (a dead end)
      if (!this.clear(open, c)) continue;
      const score = c[0] * want[0] + c[1] * want[1];
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (best) { this.state = 'flee'; this.stuckT = 0; this.move(open, best, D.flee, h); return; }
    // nowhere to go: trembling (a dead end)
    if (this.state !== 'stuck') { this.state = 'stuck'; this.stuckT = 0; }
    this.speed = 0;
    this.stuckT += h;
    if (this.stuckT >= D.stuck) { // after FISH.darter.stuck s it bolts past you along the way that gets it furthest from you
      let pick = null, far = -1;
      for (let k = 0; k < D.dirs; k++) {
        const a = (k / D.dirs) * Math.PI * 2, c = [Math.sin(a), Math.cos(a)];
        if (!this.clear(open, c)) continue;
        const dd = Math.hypot(this.pos[0] + c[0] * 3 - pl[0], this.pos[1] + c[1] * 3 - pl[2]);
        if (dd > far) { far = dd; pick = c; }
      }
      this.stuckT = 0;
      if (pick) { this.state = 'bolt'; this.boltT = D.bolt; this.dir = pick; }
    }
  }
}
