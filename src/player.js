// First-person player: movement, gravity, swimming and AABB collision.
import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';
import { GRAV, FRAMES, toWorld, toLocal, upOf, downOf, turnTo, frameOf, frameWorld, centreOf, pivot } from './gravity.js'; // Cube Planets: the frame branch (only a world with gravityAt)

// T41: dive swimming (only in a world's `deepWater`, the Sunken City's crater): you swim where you look, up and down too; Jump kicks
// forward in a burst that glides out (closed form: the distance of a step is the exact integral, so 60 and 20 steps a second go the same).
export const DIVE = { speed: 3.2, sprint: 4.0, drift: -0.5, up: 3, kick: 7, kickTime: 0.8, kickGap: 0.5, lift: 5, sink: 5, coil: 0.4 };
export const kickSpeed = t => (t >= DIVE.kickTime ? 0 : DIVE.kick * (1 - t / DIVE.kickTime) ** 2);
// The distance a kick covers between t0 and t1.
export const kickDist = (t0, t1) => {
  const a = Math.min(DIVE.kickTime, Math.max(0, t0)), b = Math.min(DIVE.kickTime, Math.max(0, t1)), T = DIVE.kickTime;
  return DIVE.kick * T / 3 * ((1 - a / T) ** 3 - (1 - b / T) ** 3);
};

// Cube Planets: each frame's turn as a quaternion (the camera eases between them).
const FRAME_Q = FRAMES.map(({ m }) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1)));
const smooth = k => k * k * (3 - 2 * k);

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
    this.fenceHit = false;  // a rider bumped into a fenced box: false or its owner (a gym, the tower, a keep)
    this.capped = false;    // a sky rider hit the height cap
    this.landed = false;    // a gliding sky rider reached the floor
    this.onBounce = false;  // T35: standing on a Bounce Block (for the hint toast)
    this.bounced = false;   // T35: launched by a Bounce Block this frame (main.js plays 'boing')
    this.trampolined = false; this.trampH = 0; // T43: launched by a Funfair trampoline this frame (main.js plays 'boing'); the height of the last bounce
    this._eye = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this.diving = false;    // T41: dive swimming in a world's deepWater (the Sunken City): swim where you look, Jump kicks
    this.kick = null;       // T41: a kick in progress { x, y, z (unit), t }
    this.kickCool = 0;
    this.kicked = false;    // T41: a kick started this frame (the Atlantis part plays the sound)
    this.spaceWas = false;
    this.noSwim = false;    // T41: the net is lunging (atlantislive.js moves the player)
    this.held = 0;          // T41: set by the net (atlantislive.js) while Catch! is held: 0..1, slows the swim
  }

  // Shared vectors, refilled on every read: copy or clone them to keep a value.
  get eyePos() {
    if (this._fw) return this.frameEye(); // Cube Planets: the eye is "up" from the feet, up as the camera sees it
    return this._eye.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
  }

  get forward() {
    if (this._fw) return this.frameForward(); // Cube Planets: yaw and pitch are your own, on the face you stand on
    const cp = Math.cos(this.pitch);
    return this._fwd.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  look(dx, dy) {
    if (this.carry?.look?.(dx, dy)) return; // T49: a ride may take the look input (the joust's lance tip)
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.0022));
  }

  lookAt(target) {
    if (this._fw) return this.frameLookAt(target); // Cube Planets
    const e = this.eyePos;
    const dx = target.x - e.x, dy = target.y - e.y, dz = target.z - e.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  // Does the player's box at position p overlap any solid block?
  collides(p) {
    if (this._fw) return this.frameCollides(p); // Cube Planets: a world position, the box stands on your face
    const hw = this.halfW;
    const x0 = Math.floor(p.x - hw), x1 = Math.floor(p.x + hw);
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + this.height);
    const z0 = Math.floor(p.z - hw), z1 = Math.floor(p.z + hw);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          if (this.world.isSolid(x, y, z)) return true;
          else if (this.ride && this.world.fenced(x, y, z)) { this.fenceHit = this.world.fenceAt(x, y, z); return true; }
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

  // T41: one step of dive swimming. f / s = forward and sideways input (-1..1), analog = stick strength.
  dive(dt, f, s, analog, sprint) {
    if (this.noSwim) { this.vel.set(0, 0, 0); this.kick = null; this.kicked = false; return; } // the net is lunging: the part moves you
    const k = this.keys, fw = this.forward, fx = fw.x, fy = fw.y, fz = fw.z;
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let dx = fx * f + rx * s, dy = fy * f, dz = fz * f + rz * s;
    const len = Math.hypot(dx, dy, dz);
    if (len > 1) { dx /= len; dy /= len; dz /= len; }
    const slow = 1 - (1 - DIVE.coil) * Math.min(1, this.held || 0); // coiled for a lunge: slow
    const speed = (sprint ? DIVE.sprint : DIVE.speed) * (len > 0 ? analog : 0) * slow;
    let vx = dx * speed, vy = dy * speed, vz = dz * speed;
    this.kicked = false;
    this.kickCool = Math.max(0, this.kickCool - dt);
    const space = !!k.Space, press = space && !this.spaceWas;
    this.spaceWas = space;
    if (press && this.kickCool <= 0) { // a kick: a burst along the look that glides out
      this.kick = { x: fx, y: fy, z: fz, t: 0 };
      this.kickCool = DIVE.kickGap; this.kicked = true;
    }
    if (this.kick) {
      const K = this.kick, d = kickDist(K.t, K.t + dt) / dt;
      vx += K.x * d; vy += K.y * d; vz += K.z * d;
      K.t += dt;
      if (K.t >= DIVE.kickTime) this.kick = null;
    } else if (space && len === 0) vy = DIVE.up; // an old habit: holding Jump still swims up
    else if (len === 0) vy = DIVE.drift; // idle: a slow drift down
    const w = this.world;
    if (w.liftAt?.(this.pos)) vy = Math.min(6, vy + DIVE.lift); // bubble columns carry you up
    if (w.sinkAt?.(this.pos)) vy -= DIVE.sink; // the whirlpool pulls you down
    this.vel.set(vx, vy, vz);
    this.onGround = false;
    this.hitWall = false;
    this.moveAxis('x', vx * dt);
    this.moveAxis('z', vz * dt);
    this.moveAxis('y', vy * dt);
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
    if (this.world.gravityAt) return this.carry ? this.frameCarry(dt) : this.frameUpdate(dt); // Cube Planets: down is wherever your feet are (only a world with gravityAt)
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
      if (this.forceSprint && analog > 0.5) analog = 1; // a race: half a push is a full run
    }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * f + cos * s;
    let wz = -cos * f - sin * s;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }

    if (this.carry) { // T40: on a Mover (a toy train, a bottle cap, a cannon arc): it moves you, a fresh jump press gets you off
      this.carry.steer?.(wx, wz, len > 0 ? analog : 0, k.Space); // T43: a ride may read the stick and the Jump key (the bumper car, the carousel seat)
      const w = this.carry.where();
      this.pos.set(w.x, w.y, w.z); this.vel.set(0, 0, 0); this.onGround = true;
      if (this.carry.wantsLeave(k.Space)) this.carry.leave(true);
      return;
    }
    const r = this.ride;
    if (r && r.kind === 'sky') return this.fly(dt, wx, wz, len, analog);

    const g = this.world.gravity ?? 1; // T35: a place's own gravity (the Dream realm: 0.5, moon jumps)
    const water = this.inWater;
    this.diving = !!(water && !r && this.world.deepAt?.(this.pos)); // T41
    if (this.diving) return this.dive(dt, f, s, analog, stickSprint || k.ShiftLeft || k.ShiftRight);
    this.kick = null; this.spaceWas = !!k.Space;
    const sprint = k.ShiftLeft || k.ShiftRight || stickSprint || this.forceSprint;
    let speed = (sprint ? 6.2 : 4.3) * analog * (this.speedK ?? 1); // speedK: a race's pace on foot (racelive.js)
    let jump = 8.6;
    if (r && r.kind === 'land' && !water) { speed = (sprint ? r.sprint : r.speed) * analog; jump = r.jump; }
    if (water && !(r && r.kind === 'water')) speed *= 0.55;
    // T27: a water creature floats on top of the water; on land it is slow.
    const surf = r && r.kind === 'water' ? this.waterTop() : null;
    if (r && r.kind === 'water') {
      if (surf !== null) speed = (sprint ? r.sprint : r.speed) * analog;
      else speed *= r.landSlow;
    }
    if (this.speedCap != null) speed = Math.min(speed, this.speedCap); // off a race track: a walk at most
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
      if (this.world.liftAt?.(this.pos)) this.vel.y = Math.min(Math.max(this.vel.y, -2) + 30 * dt, 6); // T40b: a rope ladder's lift column also holds a swimmer (the Swirl's streams are never over water)
    } else if (this.world.liftAt?.(this.pos)) {
      this.vel.y = Math.min(Math.max(this.vel.y, -2) + 30 * dt, 6); // T38a: an upward river in the Swirl lifts you
    } else {
      this.vel.y = Math.max(this.vel.y - 28 * g * dt, -19);
      if (k.Space && this.onGround) this.vel.y = jump;
      // T35: jump on a Bounce Block to launch (not on landing, so walking over a pad never traps you in a loop)
      const under = this.onGround ? BLOCKS[this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.05), Math.floor(this.pos.z))] : null;
      this.onBounce = !!under?.bounce;
      if (under?.bounce && k.Space) { this.vel.y = Math.sqrt(2 * 28 * g * under.bounce); this.bounced = true; } // boing!
      // T43 (Funfair): every landing on a block with `trampoline` launches you again. Hold Jump to bounce higher (+step), let go to come down (-drop).
      if (this.onGround) {
        const tr = under?.trampoline;
        if (tr) { this.trampH = Math.min(tr.max, Math.max(tr.min, (this.trampH || 0) + (k.Space ? tr.step : -tr.drop))); this.vel.y = Math.sqrt(2 * 28 * g * this.trampH); this.trampolined = true; this.trampN = (this.trampN || 0) + 1; } // (trampN: T43 harder games count the bounces)
        else this.trampH = 0;
      }
    }

    this.onGround = false;
    this.hitWall = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);
  }

  /* ==== Gravity ==== */
  // Cube Planets (plans/cube-planets.md 3.2): the frame branch. Only a world with `gravityAt` (cubeland.js) comes here; everywhere else
  // the player moves exactly as before. The player keeps a FRAME (one of the 24 quarter-turns, gravity.js) whose local y is "up on this
  // face". pos and vel stay in WORLD units for the rest of the game (camera, creatures, saves, the way back); each fixed 1/120 s
  // sub-step turns them into the frame (exact: a swap of numbers and a sign flip), moves the usual box with the usual moveAxis against a
  // view of the world in that frame (frameWorld), and turns them back. yaw / pitch are your own on the face, so the stick always means
  // forward on the face you stand on. The camera's up (`_view`) eases to the frame's up over GRAV.turn (GRAV.bigTurn for a big turn).
  frameNo() { return this._fw ? this.frame : null; }
  viewQuat() { return this._fw ? this._view : null; }
  // A saved frame (realmPos's 6th value; missing or junk = upright). Only a world with gravityAt reads it.
  setFrame(n) {
    if (!this.world.gravityAt) return;
    const fi = Number.isInteger(n) && n >= 0 && n < FRAMES.length ? n : 0;
    this.frameInit(fi);
    const d = downOf(fi), axis = d.findIndex(v => v !== 0), gd = this.world.gravityAt(this.pos, null);
    this.grav = this.world.gravityAt(this.pos, { ...gd, axis, sign: -d[axis] }); // the saved down wins while it still fits (hysteresis)
  }
  frameInit(fi) {
    if (this._fOf !== this.world) { // a new world: the catch puff's first spot is the way back's stand (upright on top), until you stand somewhere
      const r = this.world.rests?.[0];
      this.lastFace = { pos: r ? new THREE.Vector3(r[0], r[1], r[2]) : this.pos.clone(), frame: 0 };
    }
    this.frame = fi; this._fw = true; this._fOf = this.world; this._views = [];
    this._view = FRAME_Q[fi].clone(); this._vFrom = FRAME_Q[fi].clone(); this._vTo = fi; this._vT = 1; this._vDur = GRAV.turn;
    this._fLast = this.pos.clone(); this._fAcc = 0; this.lostT = 0;
    this._lp ??= new THREE.Vector3(); this._lv ??= new THREE.Vector3();
  }
  viewOf(fi) { return (this._views[fi] ??= frameWorld(this._fOf, fi)); }
  // Runs `fn` with pos / vel / world swapped for the frame's local ones (moveAxis and collides then work unchanged), then swaps back.
  inFrame(fi, fn) {
    const w = this.world, wp = this.pos, wv = this.vel, lp = this._lp, lv = this._lv, a = [0, 0, 0];
    toLocal(fi, [wp.x, wp.y, wp.z], a); lp.set(a[0], a[1], a[2]);
    toLocal(fi, [wv.x, wv.y, wv.z], a); lv.set(a[0], a[1], a[2]);
    this.pos = lp; this.vel = lv; this.world = this.viewOf(fi); this._fw = false;
    try { return fn(lp, lv); } finally {
      this.pos = wp; this.vel = wv; this.world = w; this._fw = true;
      toWorld(fi, [lp.x, lp.y, lp.z], a); wp.set(a[0], a[1], a[2]);
      toWorld(fi, [lv.x, lv.y, lv.z], a); wv.set(a[0], a[1], a[2]);
    }
  }
  frameCollides(p) {
    const keep = this.pos.clone();
    const hit = this.inFrame(this.frame, lp => { const a = toLocal(this.frame, [p.x, p.y, p.z]); return this.collides(new THREE.Vector3(a[0], a[1], a[2])); });
    this.pos.copy(keep);
    return hit;
  }
  frameEye() { return this._eye.set(0, this.eye, 0).applyQuaternion(this._view).add(this.pos); }
  frameForward() {
    const cp = Math.cos(this.pitch);
    return this._fwd.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).applyQuaternion(this._view);
  }
  frameLookAt(target) {
    const e = this.eyePos, l = toLocal(this.frame, [target.x - e.x, target.y - e.y, target.z - e.z]);
    this.yaw = Math.atan2(-l[0], -l[2]);
    this.pitch = Math.atan2(l[1], Math.hypot(l[0], l[2]));
  }
  // The camera's up eases to frame `fi` (never a snap): 0.45 s, or 0.8 s when the new up is far from the screen's up.
  // (Owner 2026-10-29: a "steady camera" that dipped to the sky colour instead was tried and removed: "just a blink".)
  turnView(fi) {
    const cur = new THREE.Vector3(0, 1, 0).applyQuaternion(this._view), u = upOf(fi), to = new THREE.Vector3(u[0], u[1], u[2]);
    this._vFrom.copy(this._view); this._vTo = fi; this._vT = 0;
    this._vDur = cur.angleTo(to) > GRAV.bigAngle * Math.PI / 180 ? GRAV.bigTurn : GRAV.turn;
  }
  easeView(dt) {
    if (this._vT >= this._vDur) { this._view.copy(FRAME_Q[this._vTo]); return; }
    this._vT = Math.min(this._vDur, this._vT + dt);
    this._view.slerpQuaternions(this._vFrom, FRAME_Q[this._vTo], smooth(this._vT / this._vDur));
  }
  // A ride that carries you on Cube Planets (the Moon Ride's moon, cubelive.js): the usual carry rules, in the frame you stood in when you
  // got on (the camera keeps easing). Getting off, the ride sets your speed (the moon's) and onGround = false: you fly on in frameUpdate.
  frameCarry(dt) {
    if (!this._fw || this._fOf !== this.world) { const gd = this.world.gravityAt(this.pos, null); this.frameInit(frameOf(gd.down)); this.grav = gd; }
    const k = this.keys, j = this.joy;
    let f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), analog = 1;
    if (j && Math.hypot(j.x, j.y) > 0.15) { f = -j.y; s = j.x; analog = Math.min(1, Math.hypot(j.x, j.y)); }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * f + cos * s, wz = -cos * f - sin * s;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    this.carry.steer?.(wx, wz, len > 0 ? analog : 0, k.Space);
    const w = this.carry.where();
    this.pos.set(w.x, w.y, w.z); this.vel.set(0, 0, 0); this.onGround = true;
    if (this.carry.wantsLeave(k.Space)) this.carry.leave(true);
    this.easeView(dt);
    this._fLast.copy(this.pos); this._fAcc = 0; this.lostT = 0;
  }
  frameUpdate(dt) {
    const w = this.world;
    if (!this._fw || this._fOf !== w || this.pos.distanceTo(this._fLast) > 3) { // a new world, or the game moved you (a rest spot, a test): start from where you are
      const gd = w.gravityAt(this.pos, null);
      this.frameInit(frameOf(gd.down)); this.grav = gd;
    }
    const k = this.keys;
    let f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), analog = 1, stickSprint = false;
    const j = this.joy;
    if (j && Math.hypot(j.x, j.y) > 0.15) { f = -j.y; s = j.x; analog = Math.min(1, Math.hypot(j.x, j.y)); stickSprint = analog > 0.95; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * f + cos * s, wz = -cos * f - sin * s;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    const sprint = !!(k.ShiftLeft || k.ShiftRight || stickSprint);
    this.diving = false; this.onBounce = false;
    this._fAcc += dt;
    const n = Math.floor(this._fAcc / GRAV.step + 1e-6); // fixed sub-steps: 60 and 20 frames a second give the same ones
    this._fAcc -= n * GRAV.step;
    for (let i = 0; i < n; i++) this.frameStep(GRAV.step, wx, wz, len, analog, sprint);
    this.easeView(dt);
    this._fLast.copy(this.pos);
  }
  // One sub-step: the same rules and sums as gravity.js stepFlight (a flight with no stick lands where flightLand says).
  frameStep(h, wx, wz, len, analog, sprint) {
    const here = [this.pos.x, this.pos.y, this.pos.z];
    const gd = this.world.gravityAt(this.pos, this.grav, centreOf(here, this.frame)), d0 = downOf(this.frame);
    if (gd.down[0] !== d0[0] || gd.down[1] !== d0[1] || gd.down[2] !== d0[2]) {
      const nf = turnTo(this.frame, gd.down), np = gd.hop ? pivot(here, this.frame, nf) : here; // into another planet's pull you turn round your middle, over an edge round your feet
      this.pos.set(np[0], np[1], np[2]);
      const blocked = this.inFrame(nf, lp => this.collides(lp)); // never turn into a wall: try again next sub-step
      if (blocked) this.pos.set(here[0], here[1], here[2]);
      else {
        const edge = this.grav && this.grav.planet === gd.planet && this.grav.field && gd.field;
        if (edge) { const v = toWorld(nf, toLocal(this.frame, [this.vel.x, this.vel.y, this.vel.z])); this.vel.set(v[0], v[1], v[2]); } // over an edge your speed turns with you
        this.frame = nf; this.grav = gd; this.onGround = false;
        this.turnView(nf);
      }
    } else this.grav = gd;
    const G = GRAV.base * this.grav.g, push = this.onGround && this.keys.Space ? (this.world.launchAt?.(this.pos, this.frame) || 0) : 0; // Jump on a launch flower (cubeland.js): a big push
    this.inFrame(this.frame, (lp, lv) => {
      const speed = (sprint ? GRAV.sprint : GRAV.walk) * analog, tx = wx * speed, tz = wz * speed;
      if (this.onGround) { lv.x = tx; lv.z = tz; }
      else if (len > 0) { // in the air the stick steers gently; with no stick you keep your speed (a flight is a curve)
        const dx = tx - lv.x, dz = tz - lv.z, m = Math.hypot(dx, dz), a = GRAV.air * h;
        if (m <= a) { lv.x = tx; lv.z = tz; } else { lv.x += dx / m * a; lv.z += dz / m * a; }
      }
      if (push) { lv.y = push; this.launched = push; } // (cubelive.js plays the sound and counts the hop)
      else if (this.keys.Space && this.onGround) lv.y = GRAV.jump;
      const dy = lv.y * h - 0.5 * G * h * h;
      lv.y -= G * h;
      if (lv.y < -GRAV.fall) lv.y = -GRAV.fall;
      this.onGround = false; this.hitWall = false;
      this.moveAxis('x', lv.x * h);
      this.moveAxis('z', lv.z * h);
      this.moveAxis('y', dy);
    });
    if (this.onGround) { this.lastFace.pos.copy(this.pos); this.lastFace.frame = this.frame; this.lostT = 0; }
    else if (this.grav.soft) { this.lostT += h; if (this.lostT >= GRAV.catchAfter) this.catchPuff(); }
    else this.lostT = 0;
  }
  // Six seconds outside every planet's field: a puff takes you back to the last face you stood on (never a fail).
  catchPuff() {
    this.pos.copy(this.lastFace.pos); this.vel.set(0, 0, 0); this.onGround = false; this.lostT = 0;
    this.setFrame(this.lastFace.frame);
    this.caught = (this.caught || 0) + 1; // the live part (cubelive.js) says so and plays the puff
  }
}
