// First-person player: movement, gravity, swimming and AABB collision.
import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.hitWall = false; // walked into a block sideways last frame
    this.keys = {};
    this.halfW = 0.3;
    this.height = 1.8;
    this.eye = 1.62;
    this.ride = null;       // T27: { kind, speed, ... } from riding.js while riding
    this.fenceHit = false;  // a rider bumped into a gym box
    this.capped = false;    // a sky rider hit the height cap
    this.landed = false;    // a gliding sky rider reached the floor
    this.onBounce = false;  // T35: standing on a Bounce Block (for the hint toast)
    this.bounced = false;   // T35: launched by a Bounce Block this frame (main.js plays 'boing')
    this._eye = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
  }

  // Shared vectors, refilled on every read: copy or clone them to keep a value.
  get eyePos() { return this._eye.set(this.pos.x, this.pos.y + this.eye, this.pos.z); }

  get forward() {
    const cp = Math.cos(this.pitch);
    return this._fwd.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.0022));
  }

  lookAt(target) {
    const e = this.eyePos;
    const dx = target.x - e.x, dy = target.y - e.y, dz = target.z - e.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  // Does the player's box at position p overlap any solid block?
  collides(p) {
    const hw = this.halfW;
    const x0 = Math.floor(p.x - hw), x1 = Math.floor(p.x + hw);
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + this.height);
    const z0 = Math.floor(p.z - hw), z1 = Math.floor(p.z + hw);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          if (this.world.isSolid(x, y, z)) return true;
          else if (this.ride && this.world.fenced(x, y, z)) { this.fenceHit = true; return true; }
    return false;
  }

  // T27: first solid block or water under the feet: { y: top of it, water }.
  floorBelow() {
    const x = Math.floor(this.pos.x), z = Math.floor(this.pos.z);
    for (let y = Math.floor(this.pos.y); y >= 0; y--) {
      const id = this.world.get(x, y, z);
      if (id === B.WATER) return { y: y + 1, water: true };
      if (this.world.isSolid(x, y, z)) return { y: y + 1, water: false };
    }
    return { y: 0, water: false };
  }

  // T27: top surface of the water column around the feet, or null.
  waterTop() {
    const x = Math.floor(this.pos.x), z = Math.floor(this.pos.z);
    let y = Math.floor(this.pos.y + 0.5);
    if (this.world.get(x, y, z) !== B.WATER) {
      y = Math.floor(this.pos.y - 0.3);
      if (this.world.get(x, y, z) !== B.WATER) return null;
    }
    for (let n = 0; n < 64 && this.world.get(x, y + 1, z) === B.WATER; n++) y++;
    return y + 1;
  }

  // T27: forced get-off: straight down to the floor, no fall damage exists.
  dropToFloor() {
    for (let i = 0; i < 120 && !this.onGround; i++) {
      this.moveAxis('y', -0.1);
      if (this.inWater) break;
    }
    this.vel.set(0, 0, 0);
  }

  // T27: sky riding. No gravity; Space up, Shift down; capped 6 blocks above the floor; gliding down to get off.
  fly(dt, wx, wz, len, analog) {
    const r = this.ride, k = this.keys;
    this.capped = false; this.landed = false;
    const fl = this.floorBelow();
    const cap = fl.y + r.cap;
    const up = k.Space ? 1 : 0, down = (k.ShiftLeft || k.ShiftRight) ? 1 : 0;
    if (r.landing) {
      this.vel.set(0, -r.glide, 0);
    } else {
      this.vel.x = wx * r.speed * analog;
      this.vel.z = wz * r.speed * analog;
      let vy = (up - down) * r.climb;
      if (this.pos.y >= cap) {
        if (up) this.capped = true;
        vy = Math.min(vy, this.pos.y > cap + 0.05 ? -r.sink : 0);
        if (this.pos.y > cap + 0.05) vy = -r.sink;
      } else if (this.pos.y + vy * dt > cap) {
        vy = (cap - this.pos.y) / dt;
        if (up) this.capped = true;
      }
      if (fl.water && this.pos.y + vy * dt < fl.y) vy = Math.max(vy, (fl.y - this.pos.y) / dt);
      this.vel.y = vy;
    }
    this.onGround = false;
    this.hitWall = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);
    if (r.landing && (this.onGround || (fl.water && this.pos.y <= fl.y + 0.001))) this.landed = true;
  }

  // Would a block at (x, y, z) overlap the player?
  overlapsBlock(x, y, z) {
    const p = this.pos, hw = this.halfW;
    return x + 1 > p.x - hw && x < p.x + hw &&
      y + 1 > p.y && y < p.y + this.height &&
      z + 1 > p.z - hw && z < p.z + hw;
  }

  moveAxis(axis, delta) {
    if (!delta) return;
    const next = this.pos.clone();
    next[axis] += delta;
    if (!this.collides(next)) { this.pos.copy(next); return; }
    const hw = this.halfW;
    if (axis === 'y') {
      if (delta < 0) { this.pos.y = Math.floor(next.y) + 1; this.onGround = true; }
      else this.pos.y = Math.floor(next.y + this.height) - this.height - 0.001;
      this.vel.y = 0;
    } else {
      this.pos[axis] = delta > 0
        ? Math.floor(next[axis] + hw) - hw - 0.001
        : Math.floor(next[axis] - hw) + 1 + hw + 0.001;
      this.vel[axis] = 0;
      this.hitWall = true;
    }
  }

  get inWater() {
    return this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.5), Math.floor(this.pos.z)) === B.WATER;
  }

  update(dt) {
    const k = this.keys;
    let f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    let s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    // Touch joystick: analog speed, and pushing it all the way sprints.
    let analog = 1, stickSprint = false;
    const j = this.joy;
    if (j && Math.hypot(j.x, j.y) > 0.15) {
      f = -j.y; s = j.x;
      analog = Math.min(1, Math.hypot(j.x, j.y));
      stickSprint = analog > 0.95;
    }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * f + cos * s;
    let wz = -cos * f - sin * s;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }

    const r = this.ride;
    if (r && r.kind === 'sky') return this.fly(dt, wx, wz, len, analog);

    const g = this.world.gravity ?? 1; // T35: a place's own gravity (the Dream realm: 0.5, moon jumps)
    const water = this.inWater;
    const sprint = k.ShiftLeft || k.ShiftRight || stickSprint;
    let speed = (sprint ? 6.2 : 4.3) * analog;
    let jump = 8.6;
    if (r && r.kind === 'land' && !water) { speed = (sprint ? r.sprint : r.speed) * analog; jump = r.jump; }
    if (water && !(r && r.kind === 'water')) speed *= 0.55;
    // T27: a water creature floats on top of the water; on land it is slow.
    const surf = r && r.kind === 'water' ? this.waterTop() : null;
    if (r && r.kind === 'water') {
      if (surf !== null) speed = (sprint ? r.sprint : r.speed) * analog;
      else speed *= r.landSlow;
    }
    this.vel.x = wx * speed;
    this.vel.z = wz * speed;

    if (surf !== null) {
      const target = surf - 0.25;
      this.vel.y = Math.max(-4, Math.min(4, (target - this.pos.y) * 8));
      if (k.Space && this.pos.y > target - 0.3) this.vel.y = r.jump;
    } else if (water) {
      this.vel.y = Math.max(this.vel.y - 9 * g * dt, -2.5);
      if (k.Space) this.vel.y = Math.min(this.vel.y + 22 * dt, 3.4);
      // Swimming into a bank with jump held: a push big enough to climb out onto a bank
      // 1 block above the water (not 2), like Minecraft.
      if (k.Space && this.hitWall && len > 0) this.vel.y = Math.max(this.vel.y, 10);
    } else if (this.world.liftAt?.(this.pos)) {
      this.vel.y = Math.min(Math.max(this.vel.y, -2) + 30 * dt, 6); // T38a: an upward river in the Swirl lifts you
    } else {
      this.vel.y = Math.max(this.vel.y - 28 * g * dt, -19);
      if (k.Space && this.onGround) this.vel.y = jump;
      // T35: jump on a Bounce Block to launch (not on landing, so walking over a pad never traps you in a loop)
      const under = this.onGround ? BLOCKS[this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.05), Math.floor(this.pos.z))] : null;
      this.onBounce = !!under?.bounce;
      if (under?.bounce && k.Space) { this.vel.y = Math.sqrt(2 * 28 * g * under.bounce); this.bounced = true; } // boing!
    }

    this.onGround = false;
    this.hitWall = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);
  }
}
