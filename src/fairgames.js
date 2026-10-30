// T43: the rules of the Funfair's three games, the roller coaster and the slide. Pure maths, only the shared kind help (kindhelp.js, itself
// pure), so the spec runs it in Node.
// Every moving thing is a closed form of a clock or a fixed 1/120 s sub-step simulation, so 60 fps and 1-2 fps give the same results
// (like ballphysics.js). No Math.random: everything is a hash of an index. Coordinates are world coordinates of Playland
// (ground top y 10, you stand at y 11). The layout (blocks) is in funfair.js; this file owns the numbers both of them use.
import { kindHelp } from './kindhelp.js';

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
      const bot = ctx.fleet ? ctx.fleet.at(i) : botAt(i, this.t, ctx.hard), dx = this.x - bot.x, dz = this.z - bot.z, d = Math.hypot(dx, dz);
      if (d >= BUMPER.contact) continue;
      const has = !ctx.popped?.[i] && (!ctx.fleet || ctx.fleet.hasBalloon(i)); // (a round's fleet: only the bots of this round carry a balloon)
      if (has && bumpPops(this, bot)) ev.push({ type: 'pop', i });
      else if (has) ev.push({ type: 'bump', kind: 'side', i });
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
// ---- Harder Bumper Cars (owner 2026-10-27: "the challenges should be fun, interesting and unique, need aim / dexterity / timing") ----
// Three rounds, each with a time limit that runs only while you drive (a missed round simply starts again, never a fail):
//   1 Warm-up   four bots (the three inner ones and one outer) carry a balloon, plain drivers: learn to get behind a car
//   2 Zoomers   five bots (the outer three, two inner) carry one; a zoomer NOTICES you coming up behind it and zooms off (faster than your car) for
//               1.1 s, then puffs along tired (40 % speed) for 1.8 s: chase, wait for the puff, then bump
//   3 Spinners  all six: the outer ones zoom, the inner ones SPIN their nose towards you when you come within 4 blocks (1.8 rad/s),
//               so a slow sneak never works: line up behind and come in fast (the last 2.3 blocks take 0.4 s at full speed)
// After two missed tries of the same round the shared kind help (kindhelp.js) slows the bots down a tiny bit and gives the round a bit more time.
export const BOT_TRICKS = {
  notice: 4.5, noticeCos: 0.2, noticeToward: 1,  // a zoomer notices a car within 4.5 that is behind it (within about 78 degrees of its back) and closing
  zoomAdd: 3.4, zoomTime: 1.1,                    // ... zooms off for 1.1 s (+3.4 b/s: faster than your car's top speed)
  tiredK: 0.4, tiredTime: 1.8, cool: 0.8,         // ... then puffs along at 40 % for 1.8 s (the moment!), then a short rest before it can notice again
  gap: 3,                                         // a bot keeps at least this far (along its loop) behind the one ahead
  spinR: 3.0, spinRate: 1.0, spinBack: 1.0,       // a spinner turns its nose to you within 3 blocks (rad/s), and back to the road when you are further
};
// kinds: 'plain' | 'zoom' | 'spin' carry a balloon this round, null drives on without one (a moving obstacle). Speeds in blocks a second.
export const BUMPER_ROUNDS = [
  // owner 2026-10-27 ("the requirement could increase"): 4, 5 and 6 balloons (it was 3, 3 and 6), a little more time for the first two
  { name: 'Warm-up', time: 55, kinds: ['plain', 'plain', 'plain', 'plain', null, null], speeds: [3.0, 3.0, 3.0, 3.4, 3.4, 3.4] },
  { name: 'Zoomers', time: 65, kinds: ['zoom', 'zoom', null, 'zoom', 'zoom', 'zoom'], speeds: [3.0, 3.0, 3.0, 4.2, 4.2, 4.2] },
  { name: 'Spinners', time: 75, kinds: ['zoom', 'zoom', 'zoom', 'spin', 'spin', 'spin'], speeds: [3.4, 3.4, 3.4, 3.6, 3.6, 3.6] },
];
export const HARD = { botAdd: 0.4, time: 5, bounceScore: 4, ringOmega: 0.07, ringNeed: 1, balloonPeriod: 0.75 }; // a rematch (you hold the star)
// The kind help of all three games is the shared one (kindhelp.js, owner 2026-10-28: only ever so slightly easier): misses -> { slow, more, on }.
// Bumper Cars: bots x slow, time x more; Balloon Bounce: balloons x slow, time x more; Gold Ring Ride: carousel x slow.

// The six bumper bots of a round: each drives its ellipse (arc length `s`, integrated in the 1/120 s sub-steps, so 60 and 20 frames a
// second give the same), with its own tricks. at(i) has the same fields as botAt (x, z, vx, vz, hx / hz = where its NOSE points, yaw).
export class BotFleet {
  constructor() {
    this.t = 0; this.slow = 1;
    this.bots = BOTS.map(B => ({ s: B.phase * table(B.a, B.b).len, face: 0, zoom: 0, tired: 0, cool: 0, kind: null, speed: B.speed }));
  }
  setRound(round, hard = false, slow = 1) {
    const R = BUMPER_ROUNDS[round];
    this.slow = slow;
    this.bots.forEach((b, i) => { b.kind = R.kinds[i]; b.speed = (R.speeds[i] + (hard ? HARD.botAdd : 0)) * slow; b.zoom = b.tired = b.cool = 0; });
  }
  hasBalloon(i) { return !!this.bots[i].kind; }
  speedOf(b) { return b.zoom > 0 ? b.speed + BOT_TRICKS.zoomAdd * this.slow : b.tired > 0 ? b.speed * BOT_TRICKS.tiredK : b.speed; }
  at(i, arena = ARENA) {
    const B = BOTS[i], b = this.bots[i], tab = table(B.a, B.b), sp = this.speedOf(b);
    const d = ((b.s % tab.len) + tab.len) % tab.len, q = angleAt(tab, d);
    let mx = -B.a * Math.sin(q), mz = B.b * Math.cos(q);
    const l = Math.hypot(mx, mz); mx = (mx / l) * B.dir; mz = (mz / l) * B.dir;
    const yaw = Math.atan2(mx, mz) + b.face, hx = Math.sin(yaw), hz = Math.cos(yaw);
    return { x: arena.cx + B.a * Math.cos(q), z: arena.cz + B.b * Math.sin(q), vx: mx * sp, vz: mz * sp, hx, hz, yaw, mx, mz, i, kind: b.kind, zooming: b.zoom > 0, tired: b.tired > 0, face: b.face };
  }
  // A bot never drives into the one ahead of it on its own loop (a zoomer catching up slows to the other's speed 3 blocks behind it).
  gapSpeed(i) {
    const B = BOTS[i], b = this.bots[i], len = table(B.a, B.b).len, sp = this.speedOf(b);
    let gap = Infinity, ahead = null;
    this.bots.forEach((o, j) => {
      if (j === i || BOTS[j].a !== B.a) return;
      const d = ((((o.s - b.s) * B.dir) % len) + len) % len;
      if (d < gap) { gap = d; ahead = o; }
    });
    if (!ahead || gap >= BOT_TRICKS.gap) return sp;
    return Math.min(sp, this.speedOf(ahead) * (gap < BOT_TRICKS.gap - 1 ? 0.8 : 1));
  }
  // one sub-step; `car` (or null) is your car. Returns events: { type: 'zoom', i }.
  step(h, car) {
    const T = BOT_TRICKS, ev = [];
    this.bots.forEach((b, i) => {
      if (b.zoom > 0) { b.zoom -= h; if (b.zoom <= 0) { b.zoom = 0; b.tired = T.tiredTime; } }
      else if (b.tired > 0) { b.tired -= h; if (b.tired <= 0) { b.tired = 0; b.cool = T.cool; } }
      else if (b.cool > 0) b.cool = Math.max(0, b.cool - h);
      if (car && (b.kind === 'zoom' || b.kind === 'spin')) {
        const p = this.at(i), dx = car.x - p.x, dz = car.z - p.z, d = Math.hypot(dx, dz) || 1e-6;
        if (b.kind === 'zoom' && !b.zoom && !b.tired && !b.cool && d < T.notice) {
          const behind = -(dx * p.hx + dz * p.hz) / d, toward = -(car.vx * dx + car.vz * dz) / d;
          if (behind >= T.noticeCos && toward >= T.noticeToward) { b.zoom = T.zoomTime; ev.push({ type: 'zoom', i }); }
        }
        if (b.kind === 'spin') {
          const want = d < T.spinR ? wrap(Math.atan2(dx, dz) - Math.atan2(p.mx, p.mz)) : 0, rate = (d < T.spinR ? T.spinRate : T.spinBack) * this.slow;
          b.face += clamp(wrap(want - b.face), -rate * h, rate * h);
        }
      } else if (b.face) b.face += clamp(-b.face, -T.spinBack * h, T.spinBack * h);
      b.s += BOTS[i].dir * this.gapSpeed(i) * h;
    });
    this.t += h;
    return ev;
  }
}

// The whole Bumper Cars game: your car, the fleet, the rounds. update(dt, { driving, wish, parked, home }) steps everything in 1/120 s
// sub-steps (the fleet always, your car and the round clock only while you drive) and returns the events: pop / bump / hit / exit /
// reset (the car), zoom (a bot), round (the next round starts), again (time is up: the round starts again), done (all three rounds).
export class BumperGame {
  constructor(hard = false) { this.hard = hard; this.fleet = new BotFleet(); this.car = new BumperCar(); this.acc = 0; this.misses = 0; this.wins = 0; this.start(0); }
  start(round) {
    const R = BUMPER_ROUNDS[round], help = kindHelp(this.misses);
    this.round = round; this.help = help;
    this.fleet.setRound(round, this.hard, help.slow);
    this.popped = BOTS.map(() => false);
    this.time = (R.time - (this.hard ? HARD.time : 0)) * help.more; this.left = this.time;
  }
  get need() { return this.fleet.bots.filter(b => b.kind).length; }
  get pops() { return this.popped.filter(Boolean).length; }
  get rounds() { return BUMPER_ROUNDS.length; }
  update(dt, { driving = false, wish = { x: 0, z: 0 }, parked = [], home } = {}) {
    this.acc += dt;
    const ev = [], h = BUMPER.sub;
    let n = 0;
    while (this.acc >= h && n < BUMPER.maxSubs) {
      this.acc -= h; n++;
      for (const e of this.fleet.step(h, driving ? this.car : null)) ev.push(e);
      if (!driving) continue;
      const sub = [];
      this.car.t += h;
      this.car.step(h, { wish, hard: this.hard, fleet: this.fleet, popped: this.popped, parked, home }, sub);
      for (const e of sub) { ev.push(e); if (e.type === 'pop') { this.popped[e.i] = true; e.n = this.pops; e.need = this.need; } if (e.type === 'exit') driving = false; }
      if (this.pops >= this.need) {
        this.misses = 0;
        if (this.round + 1 < this.rounds) { this.start(this.round + 1); ev.push({ type: 'round', round: this.round }); }
        else { this.wins++; this.start(0); ev.push({ type: 'done' }); }
      } else if ((this.left -= h) <= 0) {
        this.misses++; this.start(this.round);
        ev.push({ type: 'again', round: this.round, misses: this.misses, help: this.help.on });
      }
    }
    if (this.acc > h * BUMPER.maxSubs) this.acc = 0;
    return ev;
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

// A skilled driver for the spec (and nothing else): chase the target's back; a spinner that turns to face you within 2.6 blocks
// is not bumped head-on but left (back off to 5 blocks) and come at again. `memo` = {} kept by the caller.
export function skilledWish(memo, game) {
  const car = game.car, fl = game.fleet;
  if (memo.round !== game.round || memo.i == null || !fl.hasBalloon(memo.i) || game.popped[memo.i]) {
    memo.round = game.round; memo.i = null; memo.back = false;
    let bd = 1e9;
    fl.bots.forEach((b, i) => { if (!b.kind || game.popped[i]) return; const p = fl.at(i), d = Math.hypot(p.x - car.x, p.z - car.z); if (d < bd) { bd = d; memo.i = i; } });
    if (memo.i == null) return { x: 0, z: 0 };
  }
  const b = fl.at(memo.i), dx = b.x - car.x, dz = b.z - car.z, d = Math.hypot(dx, dz) || 1;
  if (b.kind !== 'spin') return chaseWish(car, b);
  const behind = -((car.x - b.x) * b.hx + (car.z - b.z) * b.hz) / d;
  if (memo.back) { if (d > 5) memo.back = false; return { x: -dx / d, z: -dz / d }; }
  if (d < 2.6 && behind < 0.5) { memo.back = true; return { x: -dx / d, z: -dz / d }; }
  return chaseWish(car, b);
}

/* ============================== 2. Balloon Bounce (ticket 2) ============================== */

// The trampoline: x 188..207, z 146..161 (cells), mat top y 11. The block flag `trampoline` (blocks.js, read in player.js) does the
// bouncing; nextBounce() is the same rule for the spec. Hold Jump on the way down to go higher, let go to come down step by step.
export const TRAMP = { x0: 188, x1: 207, z0: 146, z1: 161, top: 11, min: 2, max: 13, step: 2, drop: 1.5, r: 0.7, pops: 6, hardPops: 8 };
export function nextBounce(h, space, flag = TRAMP) {
  const nh = clamp(h + (space ? flag.step : -flag.drop), flag.min, flag.max);
  return { h: nh, vy: Math.sqrt(2 * 28 * nh) }; // gravity 28 (Playland: world.gravity 1)
}
// ---- Harder Balloon Bounce (owner 2026-10-27) ---- three rounds; each balloon floats on its own closed-form pattern (`move`):
//   circle   a small circle (r, period)                 eight  a figure of eight across the mat (ax, az)
//   zig      a zigzag from side to side (ax), quick       rise   a circle that also rises and sinks (dh)
// A `top` balloon (a target balloon) pops only when you come DOWN onto it (falling, your feet at its middle or higher); from below or the
// side it just boops away. A `gold` one is worth 3 points, a star one 2, the others 1.
//   1 Warm-up   5 balloons, slow circles 5-9 high (out of reach of a lazy bounce): pop all 5 in 60 s. Learn to hold Jump and steer.
//   2 Wobblers  2 figure-eights, 2 zigzags and 2 target balloons: pop all 6 in 70 s.
//   3 Combo     7 balloons that come back 2.5 s after a pop: 30 points in 60 s. Every pop in a row multiplies (x1, x2, x3): a pop on
//               every bounce keeps the combo; two bounces in a row without a pop end it.
// The round clock runs only while you are on the trampoline (or above it); a missed round starts again, with the kind help (kindhelp.js).
export const BOUNCE_ROUNDS = [
  { name: 'Warm-up', time: 60, need: 5, balloons: [
    { h: 5, c: [194, 151], r: 1.5, period: 9 }, { h: 6, c: [201, 157], r: 1.8, period: 10 }, { h: 7, c: [195, 157], r: 1.2, period: 8 },
    { h: 8, c: [201, 151], r: 2.0, period: 11 }, { h: 9, c: [198, 154], r: 1.5, period: 9, gold: true },
  ] },
  { name: 'Wobblers', time: 70, need: 6, balloons: [
    { h: 6, move: 'eight', c: [197.5, 154], ax: 5, az: 3, period: 9 }, { h: 9, move: 'eight', c: [197.5, 154], ax: 5.5, az: 3.5, period: 11, phase: 3 },
    { h: 7, move: 'zig', c: [197.5, 151], ax: 6, az: 1, period: 6 }, { h: 10, move: 'zig', c: [197.5, 157], ax: 6, az: 1, period: 7, phase: 2, gold: true },
    { h: 6, top: true, c: [193, 156], r: 1.5, period: 10 }, { h: 8, top: true, c: [202, 152], r: 1.8, period: 12, phase: 1 },
  ] },
  { name: 'Combo', time: 60, score: 30, respawn: 2.5, balloons: [
    { h: 4.5, c: [194, 151], r: 1.5, period: 9 }, { h: 5.5, move: 'zig', c: [197.5, 157], ax: 5.5, az: 1, period: 7 },
    { h: 7, top: true, c: [201, 151], r: 1.6, period: 10 }, { h: 8, move: 'eight', c: [197.5, 154], ax: 5, az: 3, period: 10 },
    { h: 9, move: 'rise', c: [195, 156], r: 1.5, dh: 2, period: 9, phase: 2 }, { h: 10, top: true, c: [201, 157], r: 1.4, period: 11, phase: 4 },
    { h: 11.5, c: [198, 154], r: 2.0, period: 12, gold: true },
  ] },
];
export const BOUNCE = { combo: 3, emptyBounces: 2, boop: 0.6, stomp: 0.25, points: { plain: 1, top: 2, gold: 3 } };
export const balloonList = (hard, round = 0) => BOUNCE_ROUNDS[round].balloons; // (`hard` changes speeds, not the list)
export const BALLOON_COLORS = [0xff5a6a, 0x4aa8ff, 0xffd23a, 0x6ad86a, 0xc88aff, 0xff9a3a, 0x4ae0d0, 0xff8ac8];
export const balloonColor = (b, i) => (b.gold ? 0xffd700 : b.top ? 0xf4f0ff : BALLOON_COLORS[i % BALLOON_COLORS.length]);
const tri = u => { const f = u - Math.floor(u); return f < 0.5 ? f * 4 - 1 : 3 - f * 4; }; // -1..1..-1
// Balloon b at time t (`speed` > 1 is quicker: a rematch, < 1 slower: the help). Centre { x, y, z }.
export function balloonPath(b, t, speed = 1) {
  const per = b.period / speed, q = (b.phase ?? 0) + (TAU * t) / per, [cx, cz] = b.c;
  let x, z, y = b.h;
  if (b.move === 'eight') { x = cx + b.ax * Math.sin(q); z = cz + b.az * Math.sin(2 * q); }
  else if (b.move === 'zig') { x = cx + b.ax * tri(q / TAU); z = cz + b.az * Math.sin(q * 2); }
  else { x = cx + Math.cos(q) * b.r; z = cz + Math.sin(q) * b.r; if (b.move === 'rise') y += b.dh * 0.5 * (1 - Math.cos(q)); }
  return { x, y: TRAMP.top + y + 0.3 * Math.sin((TAU * t) / (per * 0.7) + (b.phase ?? 0)), z, gold: !!b.gold, top: !!b.top };
}
// (the old name: balloon i of round 0)
export const balloonAt = (i, t, hard = false, round = 0) => balloonPath(BOUNCE_ROUNDS[round].balloons[i], t, hard ? 1 / HARD.balloonPeriod : 1);

// The whole Balloon Bounce game. update(dt, { pos (feet), vy, landed (a trampoline launch this step), active (on or above the mat) })
// -> events: pop { i, pts, mult }, boop { i } (a target balloon from below), chainEnd, round, again, done.
export class BounceGame {
  constructor(hard = false) { this.hard = hard; this.t = 0; this.misses = 0; this.wins = 0; this.start(0); }
  start(round) {
    const R = BOUNCE_ROUNDS[round], help = kindHelp(this.misses);
    this.round = round; this.help = help;
    this.speed = help.slow * (this.hard ? 1 / HARD.balloonPeriod : 1);
    this.popped = R.balloons.map(() => false); this.back = R.balloons.map(() => 0); this.boopAt = R.balloons.map(() => -9);
    this.time = (R.time - (this.hard ? HARD.time : 0)) * help.more; this.left = this.time;
    this.pops = 0; this.score = 0; this.chain = 0; this.empty = 0; this.airPops = 0; this.best = 0;
  }
  get spec() { return BOUNCE_ROUNDS[this.round]; }
  get scored() { return !!this.spec.score; }
  get need() { return this.spec.score ? this.spec.score + (this.hard ? HARD.bounceScore : 0) : this.spec.need; }
  get got() { return this.scored ? this.score : this.pops; }
  get mult() { return Math.min(BOUNCE.combo, this.chain + 1); }
  get rounds() { return BOUNCE_ROUNDS.length; }
  balloon(i) { return balloonPath(this.spec.balloons[i], this.t, this.speed); }
  shown(i) { return !this.popped[i]; }
  update(dt, { pos, vy = 0, landed = false, active = true } = {}) {
    this.t += dt;
    const ev = [], R = this.spec;
    if (R.respawn) this.popped.forEach((p, i) => { if (p && this.t >= this.back[i]) this.popped[i] = false; });
    const prev = this.prev; this.prev = pos ? { x: pos.x, y: pos.y, z: pos.z } : null;
    if (!active || !pos) return ev;
    // the way your box went since the last step, in pieces of at most 0.25 blocks (a fast fall at 20 frames a second never skips a balloon)
    const from = prev && Math.hypot(pos.x - prev.x, pos.y - prev.y, pos.z - prev.z) < 4 ? prev : pos;
    const steps = Math.max(1, Math.ceil(Math.hypot(pos.x - from.x, pos.y - from.y, pos.z - from.z) / 0.25));
    const touch = at => { for (let k = 1; k <= steps; k++) { const u = k / steps, q = { x: from.x + (pos.x - from.x) * u, y: from.y + (pos.y - from.y) * u, z: from.z + (pos.z - from.z) * u }; if (touchesBalloon(q, at)) return q; } return null; };
    R.balloons.forEach((b, i) => {
      if (this.popped[i]) return;
      const at = this.balloon(i), q = touch(at);
      if (!q) return;
      if (b.top && !(vy < 0 && q.y >= at.y - BOUNCE.stomp)) {
        if (this.t - this.boopAt[i] > BOUNCE.boop) { this.boopAt[i] = this.t; ev.push({ type: 'boop', i, at }); }
        return;
      }
      this.popped[i] = true; this.back[i] = this.t + (R.respawn ?? 0);
      this.chain++; this.best = Math.max(this.best, this.chain);
      const mult = Math.min(BOUNCE.combo, this.chain), pts = (b.gold ? BOUNCE.points.gold : b.top ? BOUNCE.points.top : BOUNCE.points.plain) * mult;
      this.pops++; this.airPops++; this.score += pts;
      ev.push({ type: 'pop', i, at, pts, mult, gold: !!b.gold, top: !!b.top, n: this.got, need: this.need, scored: this.scored });
    });
    if (landed) {
      if (this.airPops === 0) { this.empty++; if (this.empty >= BOUNCE.emptyBounces && this.chain) { this.chain = 0; ev.push({ type: 'chainEnd' }); } }
      else this.empty = 0;
      this.airPops = 0;
    }
    if (this.got >= this.need) {
      this.misses = 0;
      if (this.round + 1 < this.rounds) { this.start(this.round + 1); ev.push({ type: 'round', round: this.round }); }
      else { this.wins++; this.start(0); ev.push({ type: 'done' }); }
    } else if ((this.left -= dt) <= 0) {
      this.misses++; this.start(this.round);
      ev.push({ type: 'again', round: this.round, misses: this.misses, help: this.help.on });
    }
    return ev;
  }
}
// The player's box (0.6 x 1.8, feet at pos) against the balloon sphere.
export function touchesBalloon(pos, b, r = TRAMP.r) {
  const cx = clamp(b.x, pos.x - 0.3, pos.x + 0.3), cy = clamp(b.y, pos.y, pos.y + 1.8), cz = clamp(b.z, pos.z - 0.3, pos.z + 0.3);
  return Math.hypot(b.x - cx, b.y - cy, b.z - cz) < r;
}

// A skilled bouncer for the spec: pick the balloon that is nearest in time (gold ones first), ask for a bounce that reaches it (a star
// balloon: higher, so you come down on it) and steer to where it will be when your feet pass that height. P = { x, y, z, vy, h } (h:
// the last bounce height). Returns { wx, wz (a world direction, length = how hard the stick is pushed), space }.
export function bounceWish(game, P, walk = 4.3) {
  const R = game.spec; let best = -1, bc = 1e9;
  R.balloons.forEach((b, i) => {
    if (game.popped[i]) return;
    const at = game.balloon(i), c = Math.hypot(at.x - P.x, at.z - P.z) / walk + Math.abs((at.y - TRAMP.top) - P.h) * 0.5 - (b.gold ? 1 : 0);
    if (c < bc) { bc = c; best = i; }
  });
  if (best < 0) return { wx: 0, wz: 0, space: false };
  const b = R.balloons[best], hb = game.balloon(best).y - TRAMP.top;
  const space = P.h < (b.top ? hb + 1.2 : hb - 1.0) - 0.8;
  const meet = b.top ? hb : Math.max(0, Math.min(hb - 0.9, P.h));
  let tt = 0.3;
  if (P.vy > 0 || P.y > TRAMP.top + 0.05) { const dy = (P.y - TRAMP.top) - meet, disc = P.vy * P.vy + 56 * dy; tt = disc > 0 ? (P.vy + Math.sqrt(disc)) / 28 : 0.3; }
  const fut = balloonPath(b, game.t + tt, game.speed), dx = fut.x - P.x, dz = fut.z - P.z, d = Math.hypot(dx, dz);
  if (d < 0.2) return { wx: 0, wz: 0, space };
  const k = Math.min(1, d / (tt * walk + 0.05));
  return { wx: (dx / d) * k, wz: (dz / d) * k, space };
}

/* ============================== 3. Gold Ring Ride (ticket 3) ============================== */

// The carousel turns anti-clockwise seen from above (x = cx + r cos a, z = cz - r sin a, a grows). 24 horses in 8 spokes of three lanes.
export const CAROUSEL = {
  c: [166.5, 153.5], deck: 11, seatY: 12, deckR: 9.5, reach: 2,
  lanes: [4.5, 6.5, 8.5], spokes: 8, omega: 0.45, hardOmega: 0.52, bob: 0.35,
  laneTime: 0.25, push: 0.5, release: 0.3, hopTime: 0.6, hopH: 1.3,
  window: 0.09, highMin: 0.7, ringY: 13.4, highY: 15.3, ringR: 0.4,
};
// ---- Harder Gold Ring Ride (owner 2026-10-27) ---- rings hang at fixed angles (they do not turn, you turn past them): `lane` 0..2
// (inner, middle, outer), `high` ones only during a hop, `gold` ones are worth 3 points (all high ones and a few hard-to-reach low ones),
// silver ones 1. A round is ONE lap of the carousel: catch enough points before the lap is over, or the lap starts again (never a fail;
// after two missed laps of a round the carousel turns a tiny bit slower, kindhelp.js). Each round the carousel turns faster:
//   1 Warm-up       0.45 rad/s (a lap in 14 s), 8 low rings 1.75 s apart, the gold ones on the inner lane: 9 of 12 points
//   2 Hop and swap  0.55 rad/s (11.4 s), 10 rings 1.1 s apart, 4 high gold ones, jumps of two lanes: 13 of 18 points
//   3 Gold rush     0.65 rad/s (9.7 s), 12 rings in quick pairs (0.6 s), swaps and hops together, 6 gold: 19 of 24 points
// Staying in one lane, never hopping or pushing the stick at random never makes a round (the spec checks it).
const ringRound = (omega, need, rows) => ({ omega, need, rings: rows.map(([a, lane, high, gold]) => ({ a, lane, ...(high ? { high: true } : {}), ...(high || gold ? { gold: true } : {}) })) });
export const RING_ROUNDS = [
  { name: 'Warm-up', ...ringRound(0.45, 9, Array.from({ length: 8 }, (_, k) => [0.3 + k * (TAU / 8), [2, 1, 0, 1, 2, 1, 0, 1][k], false, k === 2 || k === 6])) },
  { name: 'Hop and swap', ...ringRound(0.55, 13, Array.from({ length: 10 }, (_, k) => [0.2 + k * (TAU / 10), [2, 0, 1, 2, 1, 0, 2, 1, 0, 1][k], [1, 4, 7, 9].includes(k)])) },
  { name: 'Gold rush', ...ringRound(0.65, 19, [[0.2, 1], [0.62, 2, true], [1.1, 1], [1.55, 0], [2.1, 1, true], [2.5, 2], [3.05, 0, false, true], [3.5, 1, true], [4.1, 2], [4.55, 1, true], [5.15, 0], [5.7, 2, true]]) },
];
export const RING_POINTS = { silver: 1, gold: 3 };
export const ringPoints = r => (r.gold ? RING_POINTS.gold : RING_POINTS.silver);
export const ringList = (hard, round = 0) => RING_ROUNDS[round].rings; // (`hard` changes the speed and the points needed, not the rings)
export const ringNeed = (round, hard = false) => RING_ROUNDS[round].need + (hard ? HARD.ringNeed : 0);
export const ringTotal = round => RING_ROUNDS[round].rings.reduce((n, r) => n + ringPoints(r), 0);
export const omegaOf = (hard, round = 0, slow = 1) => (RING_ROUNDS[round].omega + (hard ? HARD.ringOmega : 0)) * slow;
export const carouselAngle = (clock, hard = false) => clock * omegaOf(hard); // (the idle carousel: the live part integrates its own angle)
export const spokeAngle = (k, spin) => (k / CAROUSEL.spokes) * TAU + spin;
export const onCarousel = (angle, radius) => ({ x: CAROUSEL.c[0] + radius * Math.cos(angle), z: CAROUSEL.c[1] - radius * Math.sin(angle) });
export const carouselAngleOf = (x, z) => Math.atan2(-(z - CAROUSEL.c[1]), x - CAROUSEL.c[0]);
// A horse's bob (each a different phase; the spec and the mesh agree).
export const horseBob = (k, lane, clock) => CAROUSEL.bob * 0.5 * (1 + Math.sin(clock * 2.1 + k * 1.3 + lane * 0.9));

// The rider on the carousel: the lane (0..2), the hop, the round, the lap and its points. `spin` is the carousel's angle (integrated:
// its speed changes from round to round), `angle0` your spoke's angle on it, so your angle is angle0 + spin. update() returns
// { caught: [{ i, pts }], missed: [i], lap: null | { won, round, score, need, done } }.
export class Seat {
  constructor(hard = false) { this.hard = hard; this.round = 0; this.misses = 0; this.wins = 0; this.reset(0, 0, 2); }
  reset(spin, angle0, lane = 2) {
    this.spin = spin; this.angle0 = angle0; this.lane = lane; this.from = lane; this.to = lane; this.laneT = 1; this.latch = false; this.hopT = -1; this.jumpHeld = true;
    this.prev = this.angle(); this.startLap();
  }
  startLap() { this.caught = []; this.seen = []; this.swept = 0; this.score = 0; }
  get help() { return kindHelp(this.misses); }
  get omega() { return omegaOf(this.hard, this.round, this.help.slow); }
  get need() { return ringNeed(this.round, this.hard); }
  get rings() { return RING_ROUNDS[this.round].rings; }
  get rounds() { return RING_ROUNDS.length; }
  angle() { return this.angle0 + this.spin; }
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
    const w = this.omega;
    this.spin += w * dt; this.swept += w * dt;
    if (this.laneT < 1) { this.laneT = Math.min(1, this.laneT + dt / CAROUSEL.laneTime); if (this.laneT >= 1) this.from = this.to; }
    if (this.hopT >= 0) { this.hopT += dt; if (this.hopT >= CAROUSEL.hopTime) this.hopT = -1; }
    const a0 = this.prev, a1 = this.angle(), caught = [], missed = [];
    const swept = ring => { // did the swept angle [a0, a1] touch the window round the ring's angle (mod 2 pi)?
      const lo = a0 - CAROUSEL.window, hi = a1 + CAROUSEL.window, k = Math.round((((lo + hi) / 2) - ring.a) / TAU), a = ring.a + k * TAU;
      return a >= lo && a <= hi;
    };
    this.rings.forEach((ring, i) => {
      if (this.seen.includes(i) || !swept(ring)) return;
      if (this.laneNow === ring.lane && (!ring.high || this.hopHeight >= CAROUSEL.highMin)) {
        this.seen.push(i); this.caught.push(i); const pts = ringPoints(ring); this.score += pts; caught.push({ i, pts, gold: !!ring.gold, score: this.score, need: this.need });
      } else if (Math.abs(wrap(ring.a - a1)) > CAROUSEL.window) { this.seen.push(i); missed.push(i); } // (gone past it: missed for this lap)
    });
    this.prev = a1;
    let lap = null;
    if (this.swept >= TAU) {
      const won = this.score >= this.need, round = this.round, score = this.score, need = this.need;
      let done = false;
      if (won) { this.misses = 0; if (this.round + 1 < this.rounds) this.round++; else { this.wins++; this.round = 0; done = true; } }
      else this.misses++;
      this.startLap();
      lap = { won, round, score, need, done, next: this.round, help: this.help.on };
    }
    return { caught, missed, lap };
  }
  get lapLeft() { return Math.max(0, 1 - this.swept / TAU); }
  // where the rider stands now
  where() {
    const a = this.angle(), r = this.radius, p = onCarousel(a, r);
    return { x: p.x, y: CAROUSEL.seatY + this.hopHeight, z: p.z, yaw: a }; // (the way it turns: forward = (-sin a, -cos a) is the player's yaw a)
  }
}

// A skilled rider for the spec: be in the next ring's lane (one push at a time: `k` alternates so the stick comes back between pushes)
// and hop 0.18-0.32 s before a high ring. Returns { radial, space }.
export function ringWish(seat, k) {
  let best = -1, bd = 9;
  const a = seat.angle();
  seat.rings.forEach((r, i) => { if (seat.seen.includes(i)) return; let d = (r.a - a) % TAU; if (d < 0) d += TAU; if (d < bd) { bd = d; best = i; } });
  if (best < 0) return { radial: 0, space: false };
  const r = seat.rings[best], tt = bd / seat.omega;
  return { radial: seat.to !== r.lane && k % 2 === 0 ? (r.lane > seat.to ? 1 : -1) : 0, space: !!r.high && tt < 0.32 && tt > 0.18 };
}

/* ============================== 4. The roller coaster and the slide ============================== */

// The coaster: you stand at the station (166.5, 12, 173.5), go up the lift hill to the west end (chain, 2.5 b/s), swoop down the big
// drop, along z 208, over a camel hump, round a banked turn north at x 212 and climb gently to the east edge of the Sky Stage.
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

// The slide: from the Sky Stage's north-west corner a short run out over the edge, then a helix (2.5 turns) down to the ground (the
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
