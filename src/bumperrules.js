// Bumper Cars for two friends (owner 2026-11-28), the pure rules: Node-runnable, imports only fairgames.js (itself pure).
// Each friend drives their OWN car on their own computer (fairgames.js BumperCar, 1/120 s sub-steps); the six bumper bots keep
// driving their ellipses as moving obstacles WITHOUT balloons, as closed forms (botAt) of ONE clock `T` both computers share
// (T < 0 = the 3-2-1 count, Go at T = 0; the friend's clock is pulled to the leader's with ping / pong). The friend's car is
// seen from the states it sends a few times a second (SeenCar: carried on with its speed, errors eased away) and is a solid
// moving disc for MY car (each computer bounces only its own car). A balloon rides on each friend's car's BACK: bumping it from
// behind and closing fast (the same rule as the bots', fairgames.js bumpPops) pops it. The bumper's computer claims a pop, the
// leader's DuelScore counts it; after a pop neither car can be popped for `grace` seconds and the balloon comes back after `back`.
// A duel car's nose turns to where its driver STEERS (fairgames.js turns it to the way it moves), but only at `noseRate`, and a bump
// from the SIDE (a friend's or a bot's) spins it round (`spinK`): facing your friend protects your balloon, until a glancing bump
// spins you or they get round you faster than you can turn. Head-on and from behind never spin.
import { BUMPER, BAYS, BOTS, ARENA, botAt, bumpPops, BumperCar } from './fairgames.js';

const TAU = Math.PI * 2;
const wrapA = a => { a %= TAU; return a < -Math.PI ? a + TAU : a > Math.PI ? a - TAU : a; };
const NOSE_TURN = 8; // (as fast as fairgames.js BUMPER.turn)
export const DUEL_BUMP = {
  to: 3,              // pops to win
  count: 3,           // seconds of 3-2-1 before Go
  grace: 2.2,         // after a pop nobody can be popped for this long (shared clock)
  back: 1.6,          // ... and the popped balloon comes back after this long
  bays: [1, 4],       // the leader's bay, the friend's bay (BAYS: on the east rail, facing in)
  send: 0.2,          // seconds between my car's states (5 a second, like a position update)
  sendHit: 0.08,      // ... and at once after a bump (at most this often)
  stale: 0.6,         // a seen car stops being carried on with its speed after this long without news
  ease: 10,           // how fast a seen car's error is eased away (1/s)
  snap: 3,            // an error bigger than this jumps (a teleport, a reset)
  claimFor: 1,        // a claim not answered in this long may be made again
  cheer: 3.5,         // seconds of cheering after the result, then both get out
  ping: 2,            // the friend asks the leader's clock this often
  skewRate: 3,        // how fast the friend's clock is pulled to the leader's (1/s)
  skewSnap: 0.6,      // a clock further off than this jumps
  // Owner 2026-11-28 ("both players just turn front": facing each other was a stalemate). Measured with the spec's bots:
  noseRate: 2,        // a car's nose turns at most this fast to where you steer (rad/s; half a turn takes 1.6 s): you can be out-turned
  cone: 60,           // a pop: within this many degrees of the friend's back (the bots' own rule is 55)
  spinK: 1,           // a bump from the SIDE spins your car round (rad/s per block/s of push across your nose); head-on or from behind never
  spinDrag: 2,        // ... and the spin dies away (1/s)
  maxSubs: 360,       // sub-steps per frame at most (3 s: a very slow frame still moves the car in real time, as the friend sees it carried on)
};

// The six bots at the shared clock (frozen at their start places during the count). Same fields as fairgames.js botAt.
export const botsAt = T => BOTS.map((_, i) => botAt(i, Math.max(0, T)));
// A stand-in for BumperCar.step's `fleet`: the bots of the shared clock, none with a balloon.
export const sharedFleet = clock => ({ at: i => botAt(i, Math.max(0, clock.T)), hasBalloon: () => false });

// The friend's car as I see it: the last state they sent, carried on with its speed (and the drag) until it is `stale`, errors eased.
export class SeenCar {
  constructor(x = 0, z = 0, yaw = 0) { this.m = { x, z, vx: 0, vz: 0, yaw }; this.err = { x: 0, z: 0 }; this.age = 99; this.heard = false; this.skip = 0; }
  // { x, z, vx, vz, yaw }; `early` = seconds after my last step that it arrived: my next step's first `early` seconds were before it,
  // so it is not carried on through them (else a slow frame would show the friend's car AHEAD of where it really is)
  hear(s, early = 0) {
    if (![s?.x, s?.z, s?.vx, s?.vz, s?.yaw].every(Number.isFinite)) return false;
    const was = this.pos;
    this.m = { x: s.x, z: s.z, vx: s.vx, vz: s.vz, yaw: s.yaw };
    if (this.heard) { this.err.x = was.x - s.x; this.err.z = was.z - s.z; if (Math.hypot(this.err.x, this.err.z) > DUEL_BUMP.snap) this.err.x = this.err.z = 0; }
    this.heard = true; this.age = 0; this.skip = Math.max(0, Math.min(3, early || 0));
    return true;
  }
  advance(dt) {
    const m = this.m, A = ARENA, r = BUMPER.r;
    if (this.skip > 0) { const k = Math.min(this.skip, dt); this.skip -= k; dt -= k; if (dt <= 0) return; }
    this.age += dt;
    if (this.age > DUEL_BUMP.stale) { m.vx = 0; m.vz = 0; }
    const sp = Math.hypot(m.vx, m.vz);
    if (sp > 0) { const ns = Math.max(0, sp - BUMPER.drag * dt); m.vx *= ns / sp; m.vz *= ns / sp; }
    m.x = Math.min(A.x1 - r, Math.max(A.x0 + r, m.x + m.vx * dt));
    m.z = Math.min(A.z1 - r, Math.max(A.z0 + r, m.z + m.vz * dt));
    const k = Math.exp(-DUEL_BUMP.ease * dt);
    this.err.x *= k; this.err.z *= k;
  }
  get pos() { return { x: this.m.x + this.err.x, z: this.m.z + this.err.z }; }
  // a moving disc for BumperCar.step's `movers` (hx / hz = where its nose points: its back is the other way)
  disc(balloon) { const p = this.pos, m = this.m; return { id: 'friend', cone: Math.cos(DUEL_BUMP.cone * Math.PI / 180), x: p.x, z: p.z, vx: m.vx, vz: m.vz, hx: Math.sin(m.yaw), hz: Math.cos(m.yaw), yaw: m.yaw, balloon: !!balloon }; }
}

// My car in the duel: the car, the shared clock T and the fixed sub-steps. step(dt, { wish, friend: SeenCar | null, poppable })
// moves the clock by the whole dt (real time) and the car in sub-steps; returns BumperCar's events ('pop' with mover 'friend',
// 'hit' with kind 'bot' | 'car' | 'wall' | 'friend').
export class DuelCar {
  constructor(bay, T = -DUEL_BUMP.count) {
    this.bay = bay;
    this.car = new BumperCar(bay.x, bay.z, bay.yaw);
    this.T0 = T; this.k = 0; this.acc = 0; this.spin = 0; // T = T0 + k sub-steps + acc: the sub-steps fall on the same clock times at every frame rate
    this.fleet = sharedFleet(this);
  }
  get T() { return this.T0 + this.k * BUMPER.sub + this.acc; }
  set T(v) { this.T0 += v - this.T; } // (the friend's clock pulled to the leader's)
  get going() { return this.T >= 0; }
  step(dt, { wish = { x: 0, z: 0 }, friend = null, poppable = false, parked = [] } = {}) {
    const ev = [], h = BUMPER.sub;
    this.acc += dt;
    let n = Math.floor(this.acc / h + 1e-9);
    this.acc = Math.max(0, this.acc - n * h);
    if (n > DUEL_BUMP.maxSubs) { this.T0 += (n - DUEL_BUMP.maxSubs) * h; n = DUEL_BUMP.maxSubs; } // a very slow frame: the clock keeps real time, the car skips
    const acc = this.acc;
    this.acc = 0; // (during the sub-steps T is exactly the sub-step's time)
    for (let s = 0; s < n; s++) {
      this.k++;
      const t = this.T;
      friend?.advance(h);
      const go = t >= 0, sub = [];
      this.car.t += h;
      const yaw = this.car.yaw, vx0 = this.car.vx, vz0 = this.car.vz;
      this.car.step(h, { wish: go ? wish : { x: 0, z: 0 }, fleet: this.fleet, parked, home: this.bay, closed: true,
        movers: friend?.heard ? [friend.disc(poppable && go)] : [] }, sub);
      // the nose points where you steer (a bump never spins your car round: your balloon stays behind you until you turn)
      const m = go ? Math.hypot(wish.x, wish.z) : 0;
      if (m > 0.05) { const d = wrapA(Math.atan2(wish.x, wish.z) - yaw) * Math.min(1, NOSE_TURN * h), lim = DUEL_BUMP.noseRate * h; this.car.yaw = yaw + Math.max(-lim, Math.min(lim, d)); } else this.car.yaw = yaw;
      if (sub.some(e => e.type === 'hit' && (e.kind === 'friend' || e.kind === 'bot'))) { // a bump: its push across your nose spins you
        const dvx = this.car.vx - vx0, dvz = this.car.vz - vz0;
        this.spin += DUEL_BUMP.spinK * (Math.sin(yaw) * dvz - Math.cos(yaw) * dvx);
      }
      if (this.spin) { this.car.yaw += this.spin * h; this.spin *= Math.exp(-DUEL_BUMP.spinDrag * h); if (Math.abs(this.spin) < 0.01) this.spin = 0; }
      if (!go) { this.car.vx = 0; this.car.vz = 0; this.car.x = this.bay.x; this.car.z = this.bay.z; this.car.yaw = this.bay.yaw; } // waiting for Go
      for (const e of sub) { e.T = t; ev.push(e); }
    }
    this.acc = acc;
    return ev;
  }
  state() { const c = this.car; return { x: +c.x.toFixed(3), z: +c.z.toFixed(3), vx: +c.vx.toFixed(3), vz: +c.vz.toFixed(3), yaw: +c.yaw.toFixed(3) }; }
}

// Where the balloon on a car's back is (the stick's foot), as for the bots.
export const balloonOfCar = (x, z, yaw) => ({ x: x - Math.sin(yaw) * 0.9, z: z - Math.cos(yaw) * 0.9 });
// The pop rule between two friends' cars, as seen on the bumper's screen (fairgames.js bumpPops with the victim's nose).
export const popsFriend = (car, seen) => bumpPops(car, seen, Math.cos(DUEL_BUMP.cone * Math.PI / 180));

// The leader's score: side 0 = the leader, 1 = the friend. claim(by, T) counts a pop if the game is on and the grace is over.
export class DuelScore {
  constructor(to = DUEL_BUMP.to) { this.to = to; this.score = [0, 0]; this.n = 0; this.at = -1e9; this.by = null; }
  get winner() { return this.score[0] >= this.to ? 0 : this.score[1] >= this.to ? 1 : null; }
  safe(T) { return T < this.at + DUEL_BUMP.grace; }          // nobody can be popped now
  hidden(side, T) { return this.by === 1 - side && T < this.at + DUEL_BUMP.back; } // side's balloon is popped and not back yet
  claim(by, T) {
    if ((by !== 0 && by !== 1) || this.winner != null || T < 0 || this.safe(T)) return false;
    this.score[by]++; this.n++; this.at = T; this.by = by;
    return true;
  }
  state() { return { score: [...this.score], n: this.n, at: this.at, by: this.by }; }
  load(s) { // the leader's state (a newer one only): true when it changed
    if (!s || !Array.isArray(s.score) || !Number.isInteger(s.n) || s.n <= this.n) return false;
    this.score = s.score.map(v => Math.max(0, Math.min(this.to, v | 0)));
    this.n = s.n; this.at = Number.isFinite(s.at) ? s.at : this.at; this.by = s.by === 0 || s.by === 1 ? s.by : null;
    return true;
  }
}

// The friend's clock: offset from one ping / pong (sent at my clock `a`, answered with the leader's clock `T`, back at my `now`).
export const clockOffset = (a, T, now, mine) => T + (now - a) / 2 - mine;

// Simple drivers for the spec (and nothing else). A skilled driver comes round to a spot just behind the target car (led by its speed),
// then straight in at its back; a naive one rams straight at the car wherever it is. `o` = { x, z, vx, vz, yaw }.
// `memo` = {} kept by the caller: after a touch it backs off to get a run-up (a slow push never pops).
export function behindWish(car, o, back = 2.6, memo = {}) {
  const hx = Math.sin(o.yaw), hz = Math.cos(o.yaw), lead = Math.min(1, Math.hypot(o.x - car.x, o.z - car.z) / 7); // (where it will be when I get there)
  const px = o.x + (o.vx || 0) * lead, pz = o.z + (o.vz || 0) * lead;
  const gx = px - car.x, gz = pz - car.z, g = Math.hypot(gx, gz) || 1;
  const behind = (gx * hx + gz * hz) / g; // 1 = I am right behind it (it drives away from me)
  const near = Math.hypot(o.x - car.x, o.z - car.z);
  // the car glides: steer its SPEED towards the one wanted (a stick pushed against the slide), not its nose
  const steer = (dx, dz, sp = 6) => { const d = Math.hypot(dx, dz) || 1, wx = (dx / d) * sp - car.vx, wz = (dz / d) * sp - car.vz, l = Math.hypot(wx, wz) || 1; return { x: wx / l, z: wz / l }; };
  if (near < 1.9) memo.off = true;
  if (memo.off) { if (near > back + 1.8) memo.off = false; else return steer(car.x - o.x, car.z - o.z, 4); }
  if (behind > 0.8 && g < back + 2.5) return steer(gx, gz, 6.5);
  // round to the spot behind it, keeping clear of its nose
  let tx = px - hx * back, tz = pz - hz * back;
  if (behind < 0) { const sx = hz, sz = -hx, s = (car.x - px) * sx + (car.z - pz) * sz >= 0 ? 1 : -1; tx += sx * s * 2.5; tz += sz * s * 2.5; }
  const dx = tx - car.x, dz = tz - car.z, d = Math.hypot(dx, dz);
  return steer(dx, dz, Math.min(6, 1.5 + d * 1.2));
}
// A facer: always drives straight at the friend (its nose stays on them); `wob` = a child's small wobble (rad).
export const faceWish = (car, o, wob = 0) => { const w = ramWish(car, o), c = Math.cos(wob), s = Math.sin(wob); return { x: w.x * c - w.z * s, z: w.x * s + w.z * c }; };
// A skilled facer: drives at the friend but clips their front corner (a side bump spins them), then straight in at the back it shows.
export function clipWish(car, o, sd = 1) {
  const dx = o.x - car.x, dz = o.z - car.z, d = Math.hypot(dx, dz) || 1, hx = Math.sin(o.yaw), hz = Math.cos(o.yaw);
  if ((dx * hx + dz * hz) / d > 0.3) return { x: dx / d, z: dz / d };
  const off = d < 5 ? 1.3 : 0.6, tx = o.x + hz * sd * off, tz = o.z - hx * sd * off, ex = tx - car.x, ez = tz - car.z, l = Math.hypot(ex, ez) || 1;
  return { x: ex / l, z: ez / l };
}
export const ramWish = (car, o) => { const dx = o.x - car.x, dz = o.z - car.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d }; };

export const duelBays = () => DUEL_BUMP.bays.map(i => BAYS[i]);
