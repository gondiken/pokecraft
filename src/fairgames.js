// T43: the rules of the Funfair's three games, the roller coaster and the slide. Pure maths, no imports (the spec runs it in Node).
// Every moving thing is a closed form of a clock or a fixed 1/120 s sub-step simulation, so 60 fps and 1-2 fps give the same results
// (like ballphysics.js). No Math.random: everything is a hash of an index. Coordinates are world coordinates of Playland
// (ground top y 10, you stand at y 11). The layout (blocks) is in funfair.js; this file owns the numbers both of them use.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = a => { a %= TAU; return a < -Math.PI ? a + TAU : a > Math.PI ? a - TAU : a; }; // an angle difference in (-pi, pi]

export const G = 10; // the ground top: floor blocks are at y 10

/* ============================== 1. Bumper Cars (ticket 1) ============================== */

// The arena: floor cells x 121..147, z 143..163 (the rails are the cells just outside: x 120 / 148, z 142 / 164). The gap in the
// east rail (z 151..155) is the way out: a car that drives through it gets you out.
export const ARENA = { x0: 121, x1: 148, z0: 143, z1: 164, cx: 134.5, cz: 153.5, gap: [151, 156] };
export const BUMPER = {
  r: 0.85,                // a car is a disc of this radius
  accel: 9, top: 6.5, hardTop: 7, drag: 1.5,
  wall: 0.65,             // how much of its speed a car keeps when it bounces off a rail
  carE: 0.65,             // ... off a parked car
  botE: 0.8,              // ... off a bumper bot's car (a moving wall)
  contact: 1.7,           // centre distance of a touch (two radii)
  behind: Math.cos(55 * Math.PI / 180), // a pop: the angle between the bot's back and the direction to you is below 55 degrees
  toward: 2,              // ... and you move at least this fast towards it
  sub: 1 / 120, maxSubs: 12,
  pops: 6,                // balloons for the ticket
  turn: 8,                // how fast the nose turns towards the way the car moves (drawn only)
};
// Six cars wait along the east rail (bays: x, z, nose yaw = facing west); three north of the gap, three south of it.
export const BAYS = [[146.3, 145.2], [146.3, 147.7], [146.3, 150.2], [146.3, 157.3], [146.3, 159.8], [146.3, 162.3]].map(([x, z]) => ({ x, z, yaw: -Math.PI / 2 }));
// The bumper bots drive closed ellipses round the arena's middle (clockwise inside, anti-clockwise outside); a bump never changes their path.
export const BOTS = [
  { a: 6, b: 3, speed: 3.4, hardAdd: 0.4, dir: 1, phase: 0 },
  { a: 6, b: 3, speed: 3.4, hardAdd: 0.4, dir: 1, phase: 1 / 3 },
  { a: 6, b: 3, speed: 3.4, hardAdd: 0.4, dir: 1, phase: 2 / 3 },
  { a: 11, b: 7.5, speed: 4.0, hardAdd: 0.8, dir: -1, phase: 1 / 6 },
  { a: 11, b: 7.5, speed: 4.0, hardAdd: 0.8, dir: -1, phase: 1 / 2 },
  { a: 11, b: 7.5, speed: 4.0, hardAdd: 0.8, dir: -1, phase: 5 / 6 },
];
export const BOT_COLORS = [0xff5a6a, 0x4aa8ff, 0xffd23a, 0x6ad86a, 0xc88aff, 0xff9a3a];
const tables = {};
function table(a, b) { // arc length of the ellipse x = a cos q, z = b sin q, 720 samples
  const key = `${a}x${b}`;
  if (tables[key]) return tables[key];
  const N = 720, s = [0];
  let px = a, pz = 0;
  for (let i = 1; i <= N; i++) { const q = (i / N) * TAU, x = a * Math.cos(q), z = b * Math.sin(q); s.push(s[i - 1] + Math.hypot(x - px, z - pz)); px = x; pz = z; }
  return (tables[key] = { a, b, N, s, len: s[N] });
}
function angleAt(tab, d) { // the ellipse parameter at arc length d (0 .. len)
  let lo = 0, hi = tab.N;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tab.s[mid] <= d) lo = mid; else hi = mid; }
  const k = (d - tab.s[lo]) / (tab.s[hi] - tab.s[lo] || 1);
  return ((lo + k) / tab.N) * TAU;
}
// Bot i at time t (seconds of the fair's clock): position, velocity, unit heading and the yaw to draw it with (mesh rotation.y).
export function botAt(i, t, hard = false, arena = ARENA) {
  const B = BOTS[i], tab = table(B.a, B.b), speed = B.speed + (hard ? B.hardAdd : 0);
  const d = (((B.phase * tab.len + B.dir * speed * t) % tab.len) + tab.len) % tab.len;
  const q = angleAt(tab, d);
  let tx = -B.a * Math.sin(q), tz = B.b * Math.cos(q);
  const l = Math.hypot(tx, tz);
  tx = (tx / l) * B.dir; tz = (tz / l) * B.dir;
  return { x: arena.cx + B.a * Math.cos(q), z: arena.cz + B.b * Math.sin(q), vx: tx * speed, vz: tz * speed, hx: tx, hz: tz, yaw: Math.atan2(tx, tz), i };
}
// Where the balloon of bot i is (on a stick at its back).
export const BALLOON_STICK = { back: 0.9, y: 11 + 2.5 };
export const balloonOfBot = bot => ({ x: bot.x - bot.hx * BALLOON_STICK.back, y: BALLOON_STICK.y, z: bot.z - bot.hz * BALLOON_STICK.back });

// Does a touch pop the bot's balloon? Only from behind (within 55 degrees of its back) and at speed.
export function bumpPops(car, bot) {
  const dx = car.x - bot.x, dz = car.z - bot.z, d = Math.hypot(dx, dz);
  if (d >= BUMPER.contact || d < 1e-6) return false;
  const behind = -(dx * bot.hx + dz * bot.hz) / d;       // cos of the angle between the bot's backwards direction and the way to you
  const toward = -(car.vx * dx + car.vz * dz) / d;       // your speed towards the bot
  return behind >= BUMPER.behind && toward >= BUMPER.toward;
}

// A bumper car (2D disc physics in 1/120 s sub-steps). `ctx` = { wish: { x, z } (0..1 stick, world directions), hard, popped: [bool x6],
// parked: [{ x, z }] (other cars, solid), home: { x, z } (where to go back to if it ever goes wrong) }. update() returns the events.
export class BumperCar {
  constructor(x = ARENA.cx, z = ARENA.cz, yaw = 0) { this.reset(x, z, yaw); this.t = 0; this.acc = 0; this.subs = 0; }
  reset(x, z, yaw = this.yaw) { this.x = x; this.z = z; this.vx = 0; this.vz = 0; this.yaw = yaw; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  update(dt, ctx) {
    this.acc += dt;
    const ev = [], h = BUMPER.sub;
    let n = 0;
    while (this.acc >= h && n < BUMPER.maxSubs) { this.acc -= h; n++; this.t += h; this.step(h, ctx, ev); }
    if (this.acc > h * BUMPER.maxSubs) this.acc = 0; // a very slow frame: never catch up
    return ev;
  }
  step(h, ctx, ev) {
    const A = ARENA, r = BUMPER.r, top = ctx.hard ? BUMPER.hardTop : BUMPER.top, w = ctx.wish || { x: 0, z: 0 };
    const m = Math.hypot(w.x, w.z);
    if (m > 0.05) { const k = Math.min(1, m) * BUMPER.accel * h / m; this.vx += w.x * k; this.vz += w.z * k; }
    let sp = Math.hypot(this.vx, this.vz);
    if (sp > 0) { const ns = Math.max(0, sp - BUMPER.drag * h); this.vx *= ns / sp; this.vz *= ns / sp; sp = ns; }
    if (sp > top) { this.vx *= top / sp; this.vz *= top / sp; }
    this.x += this.vx * h; this.z += this.vz * h;
    if (sp > 0.5) { const want = Math.atan2(this.vx, this.vz); this.yaw += wrap(want - this.yaw) * Math.min(1, BUMPER.turn * h); }
    // the bumper bots (moving walls): a pop from behind, else a bounce
    for (let i = 0; i < BOTS.length; i++) {
      const bot = botAt(i, this.t, ctx.hard), dx = this.x - bot.x, dz = this.z - bot.z, d = Math.hypot(dx, dz);
      if (d >= BUMPER.contact) continue;
      if (!ctx.popped?.[i] && bumpPops(this, bot)) ev.push({ type: 'pop', i });
      else if (!ctx.popped?.[i]) ev.push({ type: 'bump', kind: 'side', i });
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
      const vn = (this.vx - bot.vx) * nx + (this.vz - bot.vz) * nz;
      if (vn < 0) { this.vx -= (1 + BUMPER.botE) * vn * nx; this.vz -= (1 + BUMPER.botE) * vn * nz; if (-vn > 1.5) ev.push({ type: 'hit', kind: 'bot', i, speed: -vn }); }
      this.x = bot.x + nx * BUMPER.contact; this.z = bot.z + nz * BUMPER.contact;
    }
    // parked cars (solid, they do not move)
    for (const o of ctx.parked || []) {
      const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz);
      if (d >= BUMPER.contact) continue;
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0, vn = this.vx * nx + this.vz * nz;
      if (vn < 0) { this.vx -= (1 + BUMPER.carE) * vn * nx; this.vz -= (1 + BUMPER.carE) * vn * nz; if (-vn > 1.5) ev.push({ type: 'hit', kind: 'car', speed: -vn }); }
      this.x = o.x + nx * BUMPER.contact; this.z = o.z + nz * BUMPER.contact;
    }
    // the rails last, so a car is never left inside one
    const bounce = (axis, side, edge) => {
      const v = axis === 'x' ? this.vx : this.vz;
      if ((side < 0 && v < 0) || (side > 0 && v > 0)) {
        if (Math.abs(v) > 1.5) ev.push({ type: 'hit', kind: 'wall', speed: Math.abs(v) });
        if (axis === 'x') this.vx = -v * BUMPER.wall; else this.vz = -v * BUMPER.wall;
      }
      if (axis === 'x') this.x = edge; else this.z = edge;
    };
    if (this.x < A.x0 + r) bounce('x', -1, A.x0 + r);
    if (this.z < A.z0 + r) bounce('z', -1, A.z0 + r);
    if (this.z > A.z1 - r) bounce('z', 1, A.z1 - r);
    if (this.x > A.x1 - r) {
      const inGap = this.z > A.gap[0] + r * 0.5 && this.z < A.gap[1] - r * 0.5;
      if (inGap) { if (this.x > A.x1 + 0.3) ev.push({ type: 'exit' }); }
      else bounce('x', 1, A.x1 - r);
    }
    if (!Number.isFinite(this.x + this.z + this.vx + this.vz) || this.x < A.x0 - 1 || this.z < A.z0 - 1 || this.z > A.z1 + 1 || this.x > A.x1 + 4) {
      this.reset(ctx.home?.x ?? A.cx, ctx.home?.z ?? A.cz); // never stuck, never lost
      ev.push({ type: 'reset' });
    }
  }
}
// A simple chaser the spec (and nothing else) uses: aim at the spot just behind bot i, a little ahead of where it goes.
export function chaseWish(car, bot, lead = 0.55) {
  const tx = bot.x - bot.hx * 1.25 + bot.vx * lead * 0.3, tz = bot.z - bot.hz * 1.25 + bot.vz * lead * 0.3;
  const dx = tx - car.x, dz = tz - car.z, d = Math.hypot(dx, dz) || 1;
  // when close, aim straight at the bot's back so the touch counts; when far, go to the spot behind it
  const gx = bot.x - car.x, gz = bot.z - car.z, g = Math.hypot(gx, gz) || 1;
  const mix = clamp((3.2 - g) / 1.6, 0, 1);
  const wx = (dx / d) * (1 - mix) + (gx / g) * mix, wz = (dz / d) * (1 - mix) + (gz / g) * mix, l = Math.hypot(wx, wz) || 1;
  return { x: wx / l, z: wz / l };
}

/* ============================== 2. Balloon Bounce (ticket 2) ============================== */

// The trampoline: x 188..207, z 146..161 (cells), mat top y 11. The block flag `trampoline` (blocks.js, read in player.js) does the
// bouncing; nextBounce() is the same rule for the spec. Hold Jump on the way down to go higher, let go to come down step by step.
export const TRAMP = { x0: 188, x1: 207, z0: 146, z1: 161, top: 11, min: 2, max: 13, step: 2, drop: 1.5, r: 0.7, pops: 6, hardPops: 8 };
export function nextBounce(h, space, flag = TRAMP) {
  const nh = clamp(h + (space ? flag.step : -flag.drop), flag.min, flag.max);
  return { h: nh, vy: Math.sqrt(2 * 28 * nh) }; // gravity 28 (Playland: world.gravity 1)
}
// Balloons: height above the mat, the middle of the small circle each drifts on, its radius and period. All circles lie inside the
// trampoline's air column shrunk by 2 (x 190..205, z 148..159), so you can always land back on the mat. The top two are gold.
export const BALLOONS = [
  { h: 3, c: [194, 151], r: 1.5, period: 8 },
  { h: 4, c: [202, 157], r: 2.0, period: 9.5 },
  { h: 6, c: [196, 157], r: 1.2, period: 7.5 },
  { h: 8, c: [201, 151], r: 2.5, period: 10 },
  { h: 10, c: [198, 154], r: 2.0, period: 8.5, gold: true },
  { h: 12, c: [198, 154], r: 1.2, period: 11, gold: true },
];
export const BALLOONS_HARD = [...BALLOONS, { h: 9, c: [194, 157], r: 1.8, period: 8 }, { h: 12, c: [202, 151], r: 1.5, period: 9.5, gold: true }];
export const balloonList = hard => (hard ? BALLOONS_HARD : BALLOONS);
export const BALLOON_COLORS = [0xff5a6a, 0x4aa8ff, 0xffd23a, 0x6ad86a, 0xffd700, 0xffd700, 0xc88aff, 0xffd700];
// Balloon i at time t: it drifts on its circle and bobs 0.3 (hard: periods x 0.7).
export function balloonAt(i, t, hard = false) {
  const b = balloonList(hard)[i], per = b.period * (hard ? 0.7 : 1), q = (i * 1.7) + (TAU * t) / per;
  return { x: b.c[0] + Math.cos(q) * b.r, y: TRAMP.top + b.h + 0.3 * Math.sin((TAU * t) / (per * 0.7) + i), z: b.c[1] + Math.sin(q) * b.r, gold: !!b.gold };
}
// The player's box (0.6 x 1.8, feet at pos) against the balloon sphere.
export function touchesBalloon(pos, b, r = TRAMP.r) {
  const cx = clamp(b.x, pos.x - 0.3, pos.x + 0.3), cy = clamp(b.y, pos.y, pos.y + 1.8), cz = clamp(b.z, pos.z - 0.3, pos.z + 0.3);
  return Math.hypot(b.x - cx, b.y - cy, b.z - cz) < r;
}

/* ============================== 3. Gold Ring Ride (ticket 3) ============================== */

// The carousel turns anti-clockwise seen from above (x = cx + r cos a, z = cz - r sin a, a grows). 24 horses in 8 spokes of three lanes.
export const CAROUSEL = {
  c: [166.5, 153.5], deck: 11, seatY: 12, deckR: 9.5, reach: 2,
  lanes: [4.5, 6.5, 8.5], spokes: 8, omega: 0.45, hardOmega: 0.52, bob: 0.35,
  laneTime: 0.25, push: 0.5, release: 0.3, hopTime: 0.6, hopH: 1.3,
  window: 0.09, highMin: 0.7, ringY: 13.4, highY: 15.3, ringR: 0.4,
};
// Ten gold rings hang at fixed angles (they do not turn, you turn past them); lanes never repeat in a row, `high` ones need a hop.
// The angles are 0.63 rad apart (1.4 s), so there is time for a lane change (or two) in between.
export const RINGS = [
  { a: 0.20, lane: 1 }, { a: 0.83, lane: 2, high: true }, { a: 1.46, lane: 0 }, { a: 2.09, lane: 1, high: true }, { a: 2.71, lane: 2 },
  { a: 3.34, lane: 0 }, { a: 3.97, lane: 2, high: true }, { a: 4.60, lane: 1 }, { a: 5.23, lane: 0, high: true }, { a: 5.86, lane: 2 },
];
// A rematch: twelve rings, 0.52 rad apart (one second on the faster carousel), five of them high.
export const RINGS_HARD = Array.from({ length: 12 }, (_, k) => ({ a: 0.2 + k * (TAU / 12), lane: [1, 2, 0, 1, 2, 0, 2, 1, 0, 2, 0, 2][k], ...([1, 3, 6, 8, 10].includes(k) ? { high: true } : {}) }));
export const ringList = hard => (hard ? RINGS_HARD : RINGS);
// Silver rings (just for fun: a sparkle and a note, no count).
export const SILVER = [{ a: 0.55, lane: 2 }, { a: 1.2, lane: 1 }, { a: 1.9, lane: 2 }, { a: 2.55, lane: 0 }, { a: 3.2, lane: 2 }, { a: 3.9, lane: 1 }, { a: 4.55, lane: 0 }, { a: 5.2, lane: 2 }, { a: 5.8, lane: 1 }];
export const omegaOf = hard => (hard ? CAROUSEL.hardOmega : CAROUSEL.omega);
export const carouselAngle = (clock, hard = false) => clock * omegaOf(hard);
export const spokeAngle = (k, clock, hard = false) => (k / CAROUSEL.spokes) * TAU + carouselAngle(clock, hard);
export const onCarousel = (angle, radius) => ({ x: CAROUSEL.c[0] + radius * Math.cos(angle), z: CAROUSEL.c[1] - radius * Math.sin(angle) });
export const carouselAngleOf = (x, z) => Math.atan2(-(z - CAROUSEL.c[1]), x - CAROUSEL.c[0]);
// A horse's bob (each a different phase; the spec and the mesh agree).
export const horseBob = (k, lane, clock) => CAROUSEL.bob * 0.5 * (1 + Math.sin(clock * 2.1 + k * 1.3 + lane * 0.9));

// The rider on the carousel: the lane (0..2), the hop and the rings caught. `angle0` = the angle of the spoke you got on at, minus
// the carousel angle at that moment, so your angle is always angle0 + carouselAngle(clock). update() returns the rings caught.
export class Seat {
  constructor(hard = false, caught = []) { this.hard = hard; this.caught = caught.slice(); this.silver = []; this.reset(0, 0, 2); }
  reset(clock, angle0, lane = 2) { this.clock = clock; this.angle0 = angle0; this.lane = lane; this.from = lane; this.to = lane; this.laneT = 1; this.latch = false; this.hopT = -1; this.jumpHeld = true; this.prev = this.angle(); }
  angle() { return this.angle0 + carouselAngle(this.clock, this.hard); }
  get radius() { const k = clamp(this.laneT, 0, 1), L = CAROUSEL.lanes; return L[this.from] + (L[this.to] - L[this.from]) * k * k * (3 - 2 * k); }
  get laneNow() { return this.laneT >= 0.5 ? this.to : this.from; }
  get hopHeight() { if (this.hopT < 0) return 0; const u = this.hopT / CAROUSEL.hopTime; return CAROUSEL.hopH * 4 * u * (1 - u); }
  // radial: the stick projected on the way out of the middle (-1..1); space: the Jump key
  steer(radial, space) {
    if (Math.abs(radial) >= CAROUSEL.push && !this.latch && this.laneT >= 1) {
      const nl = clamp(this.to + (radial > 0 ? 1 : -1), 0, 2);
      if (nl !== this.to) { this.from = this.to; this.to = nl; this.laneT = 0; }
      this.latch = true;
    }
    if (Math.abs(radial) < CAROUSEL.release) this.latch = false;
    if (space && !this.jumpHeld && this.hopT < 0) this.hopT = 0;
    this.jumpHeld = !!space;
  }
  update(dt) {
    this.clock += dt;
    if (this.laneT < 1) { this.laneT = Math.min(1, this.laneT + dt / CAROUSEL.laneTime); if (this.laneT >= 1) this.from = this.to; }
    if (this.hopT >= 0) { this.hopT += dt; if (this.hopT >= CAROUSEL.hopTime) this.hopT = -1; }
    const a0 = this.prev, a1 = this.angle(), caught = [], missed = [];
    const swept = ring => { // did the swept angle [a0, a1] touch the window round the ring's angle (mod 2 pi)?
      const lo = a0 - CAROUSEL.window, hi = a1 + CAROUSEL.window, k = Math.round((((lo + hi) / 2) - ring.a) / TAU), a = ring.a + k * TAU;
      return a >= lo && a <= hi;
    };
    ringList(this.hard).forEach((ring, i) => {
      if (this.caught.includes(i) || !swept(ring)) return;
      if (this.laneNow === ring.lane && (!ring.high || this.hopHeight >= CAROUSEL.highMin)) { this.caught.push(i); caught.push({ i, silver: false }); }
      else missed.push(i);
    });
    SILVER.forEach((ring, i) => {
      if (this.silver.includes(i) || !swept(ring) || this.laneNow !== ring.lane) return;
      this.silver.push(i); caught.push({ i, silver: true });
    });
    this.prev = a1;
    return { caught, missed };
  }
  get done() { return this.caught.length >= ringList(this.hard).length; }
  // where the rider stands now
  where() {
    const a = this.angle(), r = this.radius, p = onCarousel(a, r);
    return { x: p.x, y: CAROUSEL.seatY + this.hopHeight, z: p.z, yaw: a }; // (the way it turns: forward = (-sin a, -cos a) is the player's yaw a)
  }
}

/* ============================== 4. The roller coaster and the slide ============================== */

// The coaster: you stand at the station (166.5, 12, 173.5), go up the lift hill to the west end (chain, 2.5 b/s), swoop down the big
// drop, along z 208, over a camel hump, round a banked turn north at x 212 and climb gently to the east edge of the Star Stage.
export const STAGE = { x0: 196, x1: 206, z0: 196, z1: 206, top: 23, stand: 24, legs: [[199, 199], [203, 199], [199, 203], [203, 203]], end: [206.5, 24, 201.5] };
export const STATION = { x0: 160, x1: 172, z0: 170, z1: 176, y: 11, car: [166.5, 12, 173.5] };
export const COASTER = {
  points: [
    [166.5, 12, 173.5], [160, 12.4, 173.5], [150, 15, 173.5], [138, 20.5, 173.5], [128, 27, 173.5], [121, 33, 174.5], [118.6, 34, 178.5],   // station, the lift hill
    [119.4, 33, 184.5], [124, 28.5, 192], [131, 21.5, 199], [140, 15.5, 204.5], [150, 13, 208],                                        // the big drop
    [162, 13.2, 209], [172, 14.5, 209], [180, 17.5, 209], [188, 14, 209], [198, 13.6, 210.2],                                          // the long curve and the camel hump
    [207, 14.2, 211.8], [212.6, 16.2, 208.2], [214, 19, 204], [212.2, 21.6, 201.8], [209.6, 23.3, 201.5], [206.5, 24, 201.5],             // the banked turn north and the climb
  ],
  step: 0.25, lift: 2.4, v0: 3, drop: 24, vMin: 4, yTop: 34, brake: 3.5,
};
// Centripetal Catmull-Rom through the control points (Barry-Goldman), sampled evenly (every `step` blocks of track).
function catmull(points, per = 40) {
  const P = [points[0], ...points, points[points.length - 1]].map(p => p.slice()), out = [];
  const tj = (ti, a, b) => ti + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), 0.5);
  const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  for (let i = 1; i + 2 < P.length; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    if (Math.hypot(p1[0] - p2[0], p1[2] - p2[2], p1[1] - p2[1]) < 1e-6) continue;
    const t0 = 0, t1 = tj(t0, p0, p1) + 1e-6, t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
    for (let s = 0; s < per; s++) {
      const t = t1 + ((t2 - t1) * s) / per;
      const A1 = lerp3(p0, p1, (t - t0) / (t1 - t0)), A2 = lerp3(p1, p2, (t - t1) / (t2 - t1)), A3 = lerp3(p2, p3, (t - t2) / (t3 - t2 || 1));
      const B1 = lerp3(A1, A2, (t - t0) / (t2 - t0)), B2 = lerp3(A2, A3, (t - t1) / (t3 - t1 || 1));
      out.push(lerp3(B1, B2, (t - t1) / (t2 - t1)));
    }
  }
  out.push(P[P.length - 2].slice());
  return out;
}
// A path { time, loop, at(t) -> { x, y, z, yaw } } plus the samples (for the blocks) and the speed table.
export function makeCoaster(spec = COASTER) {
  const dense = catmull(spec.points, 60), pts = [dense[0]], steps = spec.step;
  let carry = 0; // resample at an even spacing by walking along the dense polyline
  for (let i = 1; i < dense.length; i++) {
    let a = dense[i - 1], b = dense[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    while (carry + seg >= steps) {
      const k = (steps - carry) / seg;
      a = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      pts.push(a); seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); carry = 0;
    }
    carry += seg;
  }
  const last = dense[dense.length - 1];
  if (Math.hypot(pts[pts.length - 1][0] - last[0], pts[pts.length - 1][1] - last[1], pts[pts.length - 1][2] - last[2]) > 0.05) pts.push(last);
  const n = pts.length, s = pts.map((_, i) => i * steps);
  s[n - 1] = (n - 2) * steps + Math.hypot(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1], pts[n - 1][2] - pts[n - 2][2]);
  const L = s[n - 1];
  // the arc length at which the lift hill ends: the top point (the control point `liftEnd`)
  const topIdx = pts.reduce((best, p, i) => (p[1] > pts[best][1] ? i : best), 0);
  const v = pts.map((p, i) => {
    let sp = i <= topIdx ? spec.lift : Math.max(spec.vMin, Math.sqrt(spec.v0 * spec.v0 + spec.drop * Math.max(0, pts[topIdx][1] - p[1])));
    sp = Math.min(sp, spec.brake + (L - s[i]) * 0.85); // the last blocks: slowing down to roll onto the stage
    return Math.max(sp, 1.5);
  });
  const t = [0];
  for (let i = 1; i < n; i++) t.push(t[i - 1] + (s[i] - s[i - 1]) / ((v[i] + v[i - 1]) / 2));
  const time = t[n - 1];
  const at = tt => {
    const q = clamp(tt, 0, time);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= q) lo = mid; else hi = mid; }
    const k = (q - t[lo]) / (t[hi] - t[lo] || 1), a = pts[lo], b = pts[hi];
    const dx = b[0] - a[0], dz = b[2] - a[2];
    return { x: a[0] + dx * k, y: a[1] + (b[1] - a[1]) * k, z: a[2] + dz * k, yaw: Math.atan2(-dx, -dz), v: v[lo] + (v[hi] - v[lo]) * k };
  };
  return { time, loop: false, length: L, samples: pts, speeds: v, times: t, topIdx, at };
}

// The slide: from the Star Stage's north-west corner a short run out over the edge, then a helix (2.5 turns) down to the ground (the
// player's feet; about 6.6 s). The helix is centred well away from the stage so nothing is in the way, and turns away from it.
export const SLIDE = { c: [192.3, 192.3], radius: 4.2, a0: Math.PI / 4, turns: 2.5, from: [197.5, 24, 197.5], to: [189.33, 11, 189.33], lead: 0.6, time: 6.6, dir: -1 };
export function makeHelix(S = SLIDE) {
  const { c, radius, a0, turns, from, to, lead, time, dir } = S;
  const start = [c[0] + radius * Math.cos(a0), from[1], c[1] + radius * Math.sin(a0)];
  const at = t => {
    const tt = clamp(t, 0, time);
    if (tt < lead) { // the run out over the deck's edge
      const u = tt / lead;
      return { x: from[0] + (start[0] - from[0]) * u, y: from[1], z: from[2] + (start[2] - from[2]) * u, yaw: Math.atan2(-(start[0] - from[0]), -(start[2] - from[2])) };
    }
    const u = (tt - lead) / (time - lead), k = u < 0.08 ? (u * u) / 0.16 : u - 0.04, f = clamp(k / 0.96, 0, 1); // a short start, then even
    const a = a0 + dir * turns * TAU * f, ahead = a + dir * 0.05;
    const x = c[0] + radius * Math.cos(a), z = c[1] + radius * Math.sin(a);
    return { x, y: from[1] + (to[1] - from[1]) * f, z, yaw: Math.atan2(-(c[0] + radius * Math.cos(ahead) - x), -(c[1] + radius * Math.sin(ahead) - z)) };
  };
  return { time, loop: false, at, a0 };
}
// Ready-made Mover path kinds (mover.js has an open registry; funfairlive.js adds these with registerFairPaths so this file needs no imports).
export const fairPaths = {
  // a point turning with the carousel (an `always` Mover on it carries a thing round at one radius)
  carousel: ({ angle0 = 0, radius = CAROUSEL.lanes[2], y = CAROUSEL.seatY, hard = false } = {}) => ({ time: Infinity, loop: true, at: t => { const a = angle0 + carouselAngle(t, hard), p = onCarousel(a, radius); return { x: p.x, y, z: p.z, yaw: a }; } }),
  coaster: ({ spec } = {}) => makeCoaster(spec || COASTER),
  helix: spec => makeHelix(spec || {}),
};
export function registerFairPaths(PATHS) { Object.assign(PATHS, fairPaths); return PATHS; }
