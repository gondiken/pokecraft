// T40d: the ball of Playland's Ball Stadium. Pure maths, no imports (the spec runs it in Node).
// The ball is drawn as a sphere but collides as an axis-aligned CUBE of half-size r against the voxel grid: axis-separated moves
// (x, z, y) like Player.moveAxis, in fixed 1/120 s sub-steps. Stable, never tunnels (a sub-step is at most 0.2 blocks), never
// stuck in a corner, and the same total time gives the same path at 60 fps and at 1 fps. The world is only a solid(x, y, z)
// function (integer cells). The ball never moves the player.

export const BALL = {
  r: 0.4, g: 20, h: 1 / 120, maxSteps: 12,
  eGround: 0.55, eWall: 0.6, rest: 1.2, roll: 2.5, air: 0.1, maxSpeed: 24, wallStop: 0.3,
};
// The court ball bounces more, rolls on a little further and has no air drag, so a Shoot! arc is exactly the one shotTo works out.
export const BALL_COURT = { ...BALL, eGround: 0.72, roll: 3, air: 0 };

const EPS = 0.001;
const hyp = Math.hypot;

export class Ball {
  // solid(x, y, z) -> bool for integer cells; spot = [x, y, z] (the ball centre when reset); opts = BALL or BALL_COURT
  constructor(solid, spot, opts = BALL) {
    this.solid = solid;
    this.spot = [...spot];
    this.opts = opts;
    this.pos = { x: spot[0], y: spot[1], z: spot[2] };
    this.vel = { x: 0, y: 0, z: 0 };
    this.onGround = false;
    this.acc = 0;
    this.time = 0;       // summed sub-steps: the stadium clock
    this.restFor = 0;    // seconds at rest on the ground
    this.kickedAt = -9;
    this.obs = [];       // the obstacle boxes of the current sub-step
    this.events = [];    // collision events of the last update(): { axis, speed, kind? }
  }

  reset(spot = this.spot) {
    this.pos.x = spot[0]; this.pos.y = spot[1]; this.pos.z = spot[2];
    this.vel.x = this.vel.y = this.vel.z = 0;
    this.restFor = 0;
    this.onGround = false;
  }

  // 0 = free, 1 = a solid cell, 2 = an obstacle (a keeper) -> this.hitObs
  hit(x, y, z) {
    const r = this.opts.r, s = this.solid;
    for (let cx = Math.floor(x - r); cx <= Math.floor(x + r - 1e-6); cx++)
      for (let cy = Math.floor(y - r); cy <= Math.floor(y + r - 1e-6); cy++)
        for (let cz = Math.floor(z - r); cz <= Math.floor(z + r - 1e-6); cz++) if (s(cx, cy, cz)) return 1;
    for (const o of this.obs) {
      if (x + r > o.x0 && x - r < o.x1 && y + r > o.y0 && y - r < o.y1 && z + r > o.z0 && z - r < o.z1) { this.hitObs = o; return 2; }
    }
    return 0;
  }
  overlaps(x, y, z) { return this.hit(x, y, z) !== 0; }

  // Move along one axis by d. Returns a bounce event or null.
  moveAxis(axis, d) {
    if (d === 0) return null;
    const o = this.opts, r = o.r, p = this.pos, v = this.vel;
    const nx = axis === 'x' ? p.x + d : p.x, ny = axis === 'y' ? p.y + d : p.y, nz = axis === 'z' ? p.z + d : p.z;
    const kind = this.hit(nx, ny, nz);
    if (!kind) { p[axis] += d; return null; }
    const old = v[axis], next = p[axis] + d;
    if (kind === 1) {
      p[axis] = d > 0 ? Math.floor(next + r) - r - EPS : Math.floor(next - r) + 1 + r + EPS;
      if (axis === 'y' && d < 0) { v.y = -old * o.eGround; if (Math.abs(v.y) < o.rest) v.y = 0; } else { v[axis] = -old * o.eWall; if (Math.abs(v[axis]) < o.wallStop) v[axis] = 0; }
      return { axis, speed: Math.abs(old), old };
    }
    const ob = this.hitObs, lo = axis + '0', hi = axis + '1';
    p[axis] = d > 0 ? ob[lo] - r - EPS : ob[hi] + r + EPS;
    const ov = ob.v?.[axis] ?? 0;
    v[axis] = ov + (ov - old) * o.eWall;
    return { axis, speed: Math.abs(old - ov), old, kind: 'keeper', obs: ob };
  }

  // One sub-step of h seconds with the obstacles of this moment.
  step(h, obstacles = []) {
    const o = this.opts, v = this.vel, p = this.pos;
    this.obs = obstacles;
    if (this.overlaps(p.x, p.y, p.z)) this.unstick();
    v.y -= o.g * h;
    for (const axis of ['x', 'z', 'y']) {
      const ev = this.moveAxis(axis, v[axis] * h);
      if (ev) this.events.push(ev);
    }
    this.onGround = this.overlaps(p.x, p.y - 0.02, p.z);
    if (this.onGround && v.y <= 0) {
      const s = hyp(v.x, v.z);
      if (s > 0) { const s2 = Math.max(0, s - o.roll * h), k = s2 / s; v.x *= k; v.z *= k; }
    }
    if (!this.onGround) { const k = 1 - o.air * h; v.x *= k; v.y *= k; v.z *= k; } // air drag (on the ground only the rolling slow-down)
    if (this.onGround && hyp(v.x, v.z) < 0.05 && Math.abs(v.y) < 0.5) this.restFor += h; else this.restFor = 0;
  }

  // The ball box is inside a block or a keeper (a keeper walked into a ball at rest, a live block): move it out, else reset.
  unstick() {
    const p = this.pos;
    if (this.hit(p.x, p.y, p.z) === 2) { // out of a keeper: along his moving axis (z) first, then x, then up
      const ob = this.hitObs, r = this.opts.r;
      const tries = [['z', p.z < (ob.z0 + ob.z1) / 2 ? ob.z0 - r - EPS : ob.z1 + r + EPS], ['x', p.x < (ob.x0 + ob.x1) / 2 ? ob.x0 - r - EPS : ob.x1 + r + EPS]];
      for (const [axis, val] of tries) {
        const was = p[axis]; p[axis] = val;
        if (!this.overlaps(p.x, p.y, p.z)) return;
        p[axis] = was;
      }
    }
    const y = p.y;
    for (const up of [1, 2]) { p.y = y + up; if (!this.overlaps(p.x, p.y, p.z)) return; }
    p.y = y;
    this.reset();
  }

  // Advance dt seconds. obstaclesAt(time) -> [{ x0, x1, y0, y1, z0, z1, v: { x, y, z } }] for the sub-step's own time.
  update(dt, obstaclesAt = () => []) {
    const o = this.opts, p = this.pos, v = this.vel;
    this.events = [];
    if (![p.x, p.y, p.z, v.x, v.y, v.z, dt].every(Number.isFinite)) { this.reset(); this.acc = 0; return; }
    this.acc += dt;
    let n = 0;
    while (this.acc >= o.h - 1e-9 && n < o.maxSteps) {
      this.step(o.h, obstaclesAt(this.time));
      this.time += o.h; this.acc -= o.h; n++;
    }
    if (this.acc > o.maxSteps * o.h) this.acc = 0; // a long stall: drop the rest
    else if (this.acc < 0) this.acc = 0;
  }

  speed() { return hyp(this.vel.x, this.vel.y, this.vel.z); }
}

/* ---- The player and the ball ---- */
// pl = { x, y, z, vx, vz, yaw, halfW: 0.3, height: 1.8 } (feet position). The ball never moves the player.
const facing = pl => [-Math.sin(pl.yaw), -Math.cos(pl.yaw)];

// Once per frame before ball.update. Returns 'kick' | 'nudge' | null.
export function touchKick(ball, pl, now = ball.time) {
  const r = ball.opts.r, p = ball.pos;
  if (now - ball.kickedAt < 0.25) return null;
  const dx = p.x - pl.x, dz = p.z - pl.z, hw = (pl.halfW ?? 0.3) + r + 0.05;
  if (Math.abs(dx) >= hw || Math.abs(dz) >= hw || p.y - r >= pl.y + (pl.height ?? 1.8) || p.y + r <= pl.y) return null;
  const dist = hyp(dx, dz) || 1e-6, d = [dx / dist, dz / dist];
  const s = hyp(pl.vx, pl.vz), f = facing(pl);
  if (s >= 0.5) {
    const dir = f[0] * d[0] + f[1] * d[1] > 0.3 ? f : d;
    const speed = Math.min(10.5, Math.max(3, 1.7 * s));
    ball.vel.x = dir[0] * speed; ball.vel.z = dir[1] * speed; ball.vel.y = Math.max(ball.vel.y, 1.2);
    const nx = pl.x + dir[0] * (0.3 + r + 0.06), nz = pl.z + dir[1] * (0.3 + r + 0.06);
    ball.obs = [];
    if (!ball.overlaps(nx, p.y, nz)) { p.x = nx; p.z = nz; }
    ball.kickedAt = now; ball.restFor = 0;
    return 'kick';
  }
  const towards = -(ball.vel.x * d[0] + ball.vel.z * d[1]); // moving towards the player?
  if (towards > 0) {
    const dot = ball.vel.x * d[0] + ball.vel.z * d[1];
    ball.vel.x = (ball.vel.x - 2 * dot * d[0]) * 0.5; ball.vel.z = (ball.vel.z - 2 * dot * d[1]) * 0.5;
    const nx = pl.x + d[0] * (0.3 + r + 0.06), nz = pl.z + d[1] * (0.3 + r + 0.06);
    ball.obs = [];
    if (!ball.overlaps(nx, p.y, nz)) { p.x = nx; p.z = nz; }
    ball.kickedAt = now;
    return 'nudge';
  }
  return null;
}

// Is the ball close enough in front of the player for Kick! / Shoot!?
export function canBoot(ball, pl) {
  const p = ball.pos, dx = p.x - pl.x, dz = p.z - pl.z, dist = hyp(dx, dz);
  if (Math.abs(p.y - (pl.y + 0.4)) > 1.5) return false;
  if (dist <= 1.0) return true;
  if (dist > 2.3) return false;
  const f = facing(pl);
  return (f[0] * dx + f[1] * dz) / dist >= 0.5;
}

export function boot(ball, v) {
  const m = hyp(v.x, v.y, v.z), k = m > ball.opts.maxSpeed ? ball.opts.maxSpeed / m : 1;
  ball.vel.x = v.x * k; ball.vel.y = v.y * k; ball.vel.z = v.z * k;
  ball.kickedAt = ball.time; ball.restFor = 0;
}

// Kick!: a low drive of 13 blocks/s along the facing, bent towards a goal mouth when you face one within 25 degrees.
// mouths: [{ x, z, hw }] (the middle of each goal's opening and its half width). Returns a velocity.
export const AIM = { speed: 13, up: 3, cone: 25 * Math.PI / 180, reach: 28, post: 1 };
export function aimShot(pos, f, mouths = []) {
  let dir = f, best = Infinity;
  for (const m of mouths) {
    const lim = Math.max(0, m.hw - AIM.post), tz = Math.min(m.z + lim, Math.max(m.z - lim, pos.z));
    const dx = m.x - pos.x, dz = tz - pos.z, dist = hyp(dx, dz);
    if (dist > AIM.reach || dist < 0.5) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (f[0] * dx + f[1] * dz) / dist)));
    if (ang <= AIM.cone && ang < best) { best = ang; dir = [dx / dist, dz / dist]; }
  }
  return { x: dir[0] * AIM.speed, y: AIM.up, z: dir[1] * AIM.speed };
}

// Shoot!: the arc from `from` to `target` that is falling at least `slope` times faster than it moves sideways at the end,
// so it drops cleanly through a 2 x 2 hole. `over` = { d, y }: the arc must also be at least y high when it is still d
// sideways from the target (to clear a rim that sticks out round the hole): the flight time grows until it is.
// Returns { v: velocity, T: flight time, peak }.
export function shotTo(from, target, g = 20, slope = 2, h = BALL.h, over = null) {
  const dx = target.x - from.x, dz = target.z - from.z, d = hyp(dx, dz), dy = target.y - from.y;
  let T = Math.sqrt(2 * Math.max(0.01, dy + slope * d) / g), vh, vy;
  for (let i = 0; i < 80; i++, T += 0.05) {
    vh = d / T; vy = dy / T + g * T / 2 + g * h / 2; // + g h / 2: the sub-steps lose g h t / 2 of height, this pays it back
    if (!over || d <= over.d) break;
    const tc = (d - over.d) / vh;
    if (from.y + vy * tc - g * tc * tc / 2 >= over.y) break;
  }
  const k = d > 1e-6 ? vh / d : 0;
  return { v: { x: dx * k, y: vy, z: dz * k }, T, peak: from.y + (vy > 0 ? vy * vy / (2 * g) : 0) };
}

/* ---- The keepers (closed form of the stadium clock) ---- */
export const KEEPER = { A: 3.0, P: 4.2, hardA: 3.2, hardP: 3.4, halfX: 0.35, halfZ: 0.7, height: 1.9 }; // owner 2026-10-26: faster keepers
// k = { x, c, phase, y } (x just in front of the goal line, c = the middle of the goal, y = feet). Returns the position, velocity and box.
export function keeperAt(k, t, hard = false) {
  const A = hard ? KEEPER.hardA : KEEPER.A, P = hard ? KEEPER.hardP : KEEPER.P, w = 2 * Math.PI / P;
  const z = k.c + A * Math.sin(w * t + k.phase), vz = A * w * Math.cos(w * t + k.phase), y = k.y ?? 11;
  return {
    x: k.x, z, vz,
    box: { x0: k.x - KEEPER.halfX, x1: k.x + KEEPER.halfX, y0: y, y1: y + KEEPER.height, z0: z - KEEPER.halfZ, z1: z + KEEPER.halfZ, v: { x: 0, y: 0, z: vz } },
  };
}
