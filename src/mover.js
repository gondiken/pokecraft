// T40: a ride that carries the player along a closed-form path (a toy train, a bottle cap on a river, a cannon arc, later a carousel).
// No imports. A path is { time, loop, at(t) -> { x, y, z, yaw } } with t in seconds (clamped to [0, time], or wrapped when `loop`).
// Positions are feet positions (you stand at y). yaw faces along the way (player yaw: forward = (-sin yaw, -cos yaw)).
// The registry is open: a Picture World may add its own kind (e.g. a rope swing) to PATHS.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const PATHS = {
  // through [[x, y, z], ...] at `speed` blocks per second; loop = on from the last point back to the first
  line: ({ points, speed, loop = false }) => {
    const pts = loop ? [...points, points[0]] : points, segs = [];
    let total = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      segs.push({ a, b, len, at: total }); total += len;
    }
    const time = total / speed;
    return {
      time, loop,
      at(t) {
        const d = (loop ? ((t % time) + time) % time : clamp(t, 0, time)) * speed;
        const s = segs.find(q => d <= q.at + q.len) ?? segs[segs.length - 1];
        const k = s.len ? clamp((d - s.at) / s.len, 0, 1) : 0;
        return { x: s.a[0] + (s.b[0] - s.a[0]) * k, y: s.a[1] + (s.b[1] - s.a[1]) * k, z: s.a[2] + (s.b[2] - s.a[2]) * k, yaw: Math.atan2(-(s.b[0] - s.a[0]), -(s.b[2] - s.a[2])) };
      },
    };
  },
  // a jump from `from` to `to`, the top `height` above the higher end, over `time` seconds
  arc: ({ from, to, height, time }) => {
    const top = Math.max(from[1], to[1]) + height, yaw = Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
    const up = Math.sqrt(top - from[1]), down = Math.sqrt(top - to[1]), peak = up / (up + down) || 0.5; // the fraction of the time at the apex
    return {
      time, loop: false,
      at(t) {
        const k = clamp(t / time, 0, 1);
        const y = k <= peak ? top - (top - from[1]) * ((peak - k) / peak) ** 2 : top - (top - to[1]) * ((k - peak) / (1 - peak)) ** 2;
        return { x: from[0] + (to[0] - from[0]) * k, y, z: from[2] + (to[2] - from[2]) * k, yaw };
      },
    };
  },
};
export const makePath = spec => PATHS[spec.kind](spec);

export class Mover {
  // run: 'ride' = the clock runs only while someone rides, from 0 at boarding (bottle cap, cannon);
  //      'always' = the clock always runs (a toy train on its loop; you board when it is within `reach`).
  // canLeave false: Space never throws you off (a cannon arc, a roller coaster): the ride ends at the end of its path.
  constructor({ path, seat = [0, 0, 0], mesh = null, run = 'ride', reach = 2.5, canLeave = true, onEnd = null }) {
    Object.assign(this, { path, seat, mesh, run, reach, canLeave, onEnd });
    this.clock = 0;
    this.rider = null;
    this.spaceHeld = false;
  }
  // the rider's feet: the path point plus the seat turned by the path's yaw
  where() {
    const w = this.path.at(this.clock), c = Math.cos(w.yaw), s = Math.sin(w.yaw), [sx, sy, sz] = this.seat;
    return { x: w.x + sx * c + sz * s, y: w.y + sy, z: w.z - sx * s + sz * c, yaw: w.yaw };
  }
  near(pos) { const w = this.where(); return Math.hypot(w.x - pos.x, w.z - pos.z); }
  board(player) {
    this.rider = player; player.carry = this; player.vel.set(0, 0, 0);
    if (this.run === 'ride') this.clock = 0;
    this.spaceHeld = !!player.keys?.Space; // a held jump key does not throw you off at once: leaving needs a fresh press
    this.update(0);
  }
  // Called by Player.update while carried: true when the player pressed Space freshly (and may leave).
  wantsLeave(space) {
    const fresh = !!space && !this.spaceHeld;
    this.spaceHeld = !!space;
    return this.canLeave && fresh;
  }
  leave(jump) {
    const r = this.rider;
    if (!r) return;
    r.carry = null;
    if (jump && this.canLeave) r.vel.y = 8.6;
    this.rider = null;
  }
  update(dt) {
    if (this.run === 'always' || this.rider) this.clock += dt;
    if (this.run === 'ride' && !this.path.loop && this.clock > this.path.time) { // past the end: the rider is put at the end
      this.clock = this.path.time;
      const r = this.rider, w = this.where();
      if (r) { r.pos.set(w.x, w.y, w.z); this.leave(false); }
      this.onEnd?.();
      this.clock = 0;
    }
    const w = this.where();
    if (this.rider) this.rider.pos.set(w.x, w.y, w.z);
    if (this.mesh) { this.mesh.position.set(w.x, w.y, w.z); this.mesh.rotation.y = w.yaw; }
  }
}
