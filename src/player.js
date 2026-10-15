// First-person player: movement, gravity, swimming and AABB collision.
import * as THREE from 'three';
import { B } from './blocks.js';

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
    return false;
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

    const water = this.inWater;
    let speed = (k.ShiftLeft || k.ShiftRight || stickSprint ? 6.2 : 4.3) * analog;
    if (water) speed *= 0.55;
    this.vel.x = wx * speed;
    this.vel.z = wz * speed;

    if (water) {
      this.vel.y = Math.max(this.vel.y - 9 * dt, -2.5);
      if (k.Space) this.vel.y = Math.min(this.vel.y + 22 * dt, 3.4);
      // Swimming into a bank with jump held: a push big enough to climb out onto a bank
      // 1 block above the water (not 2), like Minecraft.
      if (k.Space && this.hitWall && len > 0) this.vel.y = Math.max(this.vel.y, 10);
    } else {
      this.vel.y = Math.max(this.vel.y - 28 * dt, -19);
      if (k.Space && this.onGround) this.vel.y = 8.6;
    }

    this.onGround = false;
    this.hitWall = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);
  }
}
