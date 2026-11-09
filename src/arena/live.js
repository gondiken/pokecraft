// Prototype 1: live action. You move with the stick, your creature faces the nearest monster by itself (tap one to pick it),
// the four move buttons use your moves, Dodge is a quick hop with a moment of safety. Monsters warn in red before they hit.
import { shapeOf, pushOut, len2, segBlocked, intentFor, inIntent, inPillar } from './core.js';

export const LIVE = {
  speed: 4.6, // walking, blocks a second
  dodge: { time: 0.2, speed: 15, safe: 0.32, cool: 0.75 },
  cool: { bolt: 0.65, volley: 1.6, burst: 3.2, dash: 2.0, heal: 9, buff: 9, cloud: 6, sleep: 7 },
  charge: 1.1, // a big blast charges while held; it goes by itself after this long
  shotSpeed: 15, shotRange: 13,
  foe: { speed: 1.9, tell: 0.95, every: [2.0, 2.9], keep: 3.2, dash: 16 },
};

export class LiveMode {
  constructor(a) {
    this.a = a;
    this.name = 'live';
    this.hint = 'Move with the stick (WASD), tap a move (1-4). Get out of the red!';
    this.cam = 'follow';
  }
  start() {
    const a = this.a;
    this.moves = a.you.c.moves.map(shapeOf);
    this.cd = [0, 0, 0, 0, 0]; // slot 0 = Dodge
    this.held = [false, false, false, false, false];
    this.charge = { slot: -1, t: 0 };
    this.shots = [];
    this.dodge = 0; this.dir = { x: 0, z: 1 }; this.dash = null;
    this.target = null;
    this.clouds = [];
    this.vel = { x: 0, z: 0 };
    a.foes.forEach((f, i) => { f.timer = 1.6 + i * 0.9; f.tell = null; f.charging = null; f.vel = { x: 0, z: 0 }; });
  }
  // ice: speed eases toward what you want (slowly); anywhere else it is what you want
  slide(v, tx, tz, dt) {
    if (!this.a.place.slide) { v.x = tx; v.z = tz; return; }
    const k = Math.min(1, dt * this.a.place.slide);
    v.x += (tx - v.x) * k; v.z += (tz - v.z) * k;
  }
  onSwap() { this.dash = null; this.charge = { slot: -1, t: 0 }; this.held = [false, false, false, false, false]; this.moves = this.a.you.c.moves.map(shapeOf); this.cd = this.cd.map((c, i) => (i ? 0 : c)); }
  // ---- input
  press(slot) {
    if (this.a.over) return;
    this.held[slot] = true;
    if (slot === 0) return this.tryDodge();
    const s = this.moves[slot - 1];
    if (!s || this.cd[slot] > 0) return;
    if (s.kind === 'burst') { this.charge = { slot, t: 0 }; return; }
    this.use(slot, 0);
  }
  release(slot) {
    this.held[slot] = false;
    if (this.charge.slot === slot) { this.use(slot, Math.min(1, this.charge.t / LIVE.charge)); this.charge = { slot: -1, t: 0 }; }
  }
  pointer(kind, p) { // a tap on a monster picks it
    if (kind !== 'down' || !p) return;
    let best = null, bd = 2.2;
    for (const f of this.a.foes) if (f.alive) { const d = len2(f.x - p.x, f.z - p.z); if (d < bd) { bd = d; best = f; } }
    if (best) this.target = best;
  }
  tryDodge() {
    if (this.cd[0] > 0 || this.dash) return;
    const { mx, mz } = this.a.input;
    let dx = mx, dz = mz;
    if (!dx && !dz) { dx = -Math.sin(this.a.you.heading); dz = -Math.cos(this.a.you.heading); } // no stick: hop back
    const d = Math.hypot(dx, dz);
    this.dash = { x: dx / d, z: dz / d, t: LIVE.dodge.time, speed: LIVE.dodge.speed, hits: null };
    this.a.you.safeT = LIVE.dodge.safe;
    this.cd[0] = LIVE.dodge.cool;
    this.a.sound('dodge');
  }
  aimAt() {
    const you = this.a.you;
    if (!this.target?.alive) {
      this.target = null;
      let bd = Infinity;
      for (const f of this.a.foes) if (f.alive) { const d = len2(f.x - you.x, f.z - you.z); if (d < bd) { bd = d; this.target = f; } }
    }
    return this.target;
  }
  use(slot, charge) {
    const a = this.a, you = a.you, s = this.moves[slot - 1], t = this.aimAt();
    const cool = LIVE.cool[s.kind];
    this.cd[slot] = cool; this.cdMax ??= []; this.cdMax[slot] = cool;
    let dx = Math.sin(you.heading), dz = Math.cos(you.heading);
    if (t) { const d = len2(t.x - you.x, t.z - you.z) || 1; dx = (t.x - you.x) / d; dz = (t.z - you.z) / d; }
    a.sound(`fx:${s.type}`);
    if (s.kind === 'bolt') this.fire(s, dx, dz, 1);
    else if (s.kind === 'volley') { for (let i = 0; i < 4; i++) this.fire(s, dx, dz, 1, i * 0.09, (i - 1.5) * 0.09); }
    else if (s.kind === 'burst') {
      const r = 2.2 + 1.6 * charge;
      a.fx.burst(s.type, you.x, you.z, r, 0.5, 0.7);
      for (const f of a.foes) if (f.alive && len2(f.x - you.x, f.z - you.z) < r + f.r * 0.5) a.hit(you, f, s.power, s.type, 0.55 + 0.6 * charge);
    } else if (s.kind === 'dash') {
      this.dash = { x: dx, z: dz, t: 0.28, speed: 17, hits: new Set(), s };
      you.safeT = 0.3;
      if (s.recoil) a.hurtSelf(0.06);
    } else if (s.kind === 'heal') a.heal(you, 0.35);
    else if (s.kind === 'buff') { if (s.stat === 'def') you.guardT = 8; else you.buffT = 8; a.say(s.stat === 'def' ? 'Tough for 8 s!' : 'Power up for 8 s!'); }
    else if (s.kind === 'cloud' || s.kind === 'sleep') {
      const x = t ? t.x : you.x + dx * 5, z = t ? t.z : you.z + dz * 5;
      const c = a.fx.cloud(s.type, x, z, 2.3, s.kind === 'sleep' ? 2.2 : 5);
      c.sleep = s.kind === 'sleep'; c.done = new Set();
      this.clouds.push(c);
    }
  }
  fire(s, dx, dz, mult, delay = 0, turn = 0) {
    const c = Math.cos(turn), sn = Math.sin(turn);
    this.shots.push({ s, x: this.a.you.x, z: this.a.you.z, dx: dx * c + dz * sn, dz: dz * c - dx * sn, left: LIVE.shotRange, delay, m: null, mult });
  }
  // ---- the fixed step
  step(dt) {
    const a = this.a, you = a.you;
    for (let i = 0; i < 5; i++) this.cd[i] = Math.max(0, this.cd[i] - dt);
    for (const f of [you, ...a.foes]) { f.safeT = Math.max(0, f.safeT - dt); f.buffT = Math.max(0, f.buffT - dt); f.guardT = Math.max(0, f.guardT - dt); f.slowT = Math.max(0, f.slowT - dt); f.sleepT = Math.max(0, f.sleepT - dt); }
    if (this.charge.slot > 0) { this.charge.t += dt; if (this.charge.t >= LIVE.charge) this.release(this.charge.slot); }
    // you
    if (this.dash) {
      const d = this.dash;
      you.x += d.x * d.speed * dt; you.z += d.z * d.speed * dt; d.t -= dt;
      if (d.hits) for (const f of a.foes) if (f.alive && !d.hits.has(f) && len2(f.x - you.x, f.z - you.z) < f.r + you.r + 0.2) { d.hits.add(f); a.hit(you, f, d.s.power, d.s.type); }
      if (pushOut(you) || d.t <= 0) { this.dash = null; if (this.a.place.slide) { this.vel.x = d.x * 7; this.vel.z = d.z * 7; } else this.vel.x = this.vel.z = 0; }
      you.moving = true;
    } else {
      const { mx, mz } = a.input, m = Math.min(1, Math.hypot(mx, mz));
      you.moving = m > 0.05;
      const sp = LIVE.speed * m * (this.charge.slot > 0 ? 0.55 : 1);
      const tx = you.moving ? mx / Math.hypot(mx, mz) * sp : 0, tz = you.moving ? mz / Math.hypot(mx, mz) * sp : 0;
      this.slide(this.vel, tx, tz, dt); // on the ice lake you keep sliding; elsewhere you stop at once
      you.x += this.vel.x * dt; you.z += this.vel.z * dt;
      if (you.moving) this.dir = { x: mx, z: mz };
      const wall = pushOut(you);
      if (wall) { const dot = this.vel.x * wall.nx + this.vel.z * wall.nz; if (dot < 0) { this.vel.x -= dot * wall.nx; this.vel.z -= dot * wall.nz; } }
    }
    const t = this.aimAt();
    if (t) you.heading = Math.atan2(t.x - you.x, t.z - you.z);
    else if (you.moving) you.heading = Math.atan2(this.dir.x, this.dir.z);
    // shots
    for (const sh of this.shots) {
      if (sh.delay > 0) { sh.delay -= dt; continue; }
      if (!sh.m) sh.m = a.fx.shot(sh.s.type, sh.x, sh.z);
      const step = LIVE.shotSpeed * dt;
      sh.x += sh.dx * step; sh.z += sh.dz * step; sh.left -= step;
      sh.m.position.set(sh.x, 0.8, sh.z); sh.m.rotation.y += dt * 9;
      if (inPillar(sh.x, sh.z, 0.1) || sh.left <= 0 || len2(sh.x, sh.z) > 11) sh.dead = true;
      for (const f of a.foes) if (!sh.dead && f.alive && len2(f.x - sh.x, f.z - sh.z) < f.r + 0.2) { sh.dead = true; a.hit(you, f, sh.s.power, sh.s.type, sh.mult); }
      if (sh.dead) a.fx.free(sh.m);
    }
    this.shots = this.shots.filter(s => !s.dead);
    // clouds slow or send monsters to sleep
    for (const c of this.clouds) for (const f of a.foes) {
      if (!f.alive || len2(f.x - c.x, f.z - c.z) > c.r) continue;
      if (c.sleep) { if (!c.done.has(f)) { c.done.add(f); f.sleepT = 2.6; f.tell && a.fx.untell(f.tell); f.tell = null; f.timer = 2.6 + 1; } }
      else f.slowT = Math.max(f.slowT, 0.2);
    }
    this.clouds = this.clouds.filter(c => c.t < c.time);
    // monsters
    for (const f of a.foes) if (f.alive) this.foeStep(f, dt);
  }
  foeStep(f, dt) {
    const a = this.a, you = a.you, F = LIVE.foe;
    if (f.sleepT > 0) { f.moving = false; return; }
    const slow = f.slowT > 0 ? 0.45 : 1;
    if (f.charging) { // a rush along its warned line
      const c = f.charging;
      const step = F.dash * dt;
      f.x += c.dx * step; f.z += c.dz * step; c.left -= step;
      if (!c.hit && you.safeT <= 0 && len2(you.x - f.x, you.z - f.z) < you.r + f.r) { c.hit = true; a.hit(f, you, a.foePower, f.type, slow); }
      if (pushOut(f) || c.left <= 0) f.charging = null;
      f.moving = true;
      return;
    }
    f.heading = Math.atan2(you.x - f.x, you.z - f.z);
    if (f.tell) { // standing still while the warning shows
      f.tell.left -= dt * slow;
      f.moving = false;
      if (f.tell.left <= 0) this.strike(f, slow);
      return;
    }
    // walk to its own distance from you, then circle a little
    const dx = you.x - f.x, dz = you.z - f.z, d = len2(dx, dz) || 1;
    const want = f.pattern === 'lob' ? 6 : f.pattern === 'stomp' ? 2.4 : 4.5;
    const go = d > want ? 1 : d < want - 1.5 ? -0.6 : 0;
    const side = (f.side2 ??= Math.random() < 0.5 ? 1 : -1) * 0.5;
    const vx = dx / d * go - dz / d * side, vz = dz / d * go + dx / d * side;
    const v = Math.hypot(vx, vz) || 1;
    this.slide(f.vel, vx / v * F.speed * slow, vz / v * F.speed * slow, dt);
    f.x += f.vel.x * dt; f.z += f.vel.z * dt;
    for (const o of a.foes) if (o !== f && o.alive) { const ox = f.x - o.x, oz = f.z - o.z, od = len2(ox, oz); if (od < 1.4 && od > 0.01) { f.x += ox / od * (1.4 - od) * 0.5; f.z += oz / od * (1.4 - od) * 0.5; } }
    pushOut(f);
    f.moving = true;
    f.timer -= dt * slow;
    if (f.timer <= 0) {
      const t = intentFor(f, you);
      f.tell = a.fx.tell(t); f.tell.left = F.tell;
      f.timer = (F.every[0] + Math.random() * (F.every[1] - F.every[0])) * (a.place.attack || 1); // on ice they slide about, so they strike more often
    }
  }
  strike(f, slow) {
    const a = this.a, you = a.you, t = f.tell.t;
    a.fx.untell(f.tell); f.tell = null;
    if (t.kind === 'line') { f.charging = { dx: t.dx, dz: t.dz, left: t.len + (a.place.slide ? 3 : 0), hit: false }; return; }
    a.fx.burst(f.type, t.x, t.z, t.r, 0.35, 0.6);
    a.sound('thud');
    if (you.safeT <= 0 && inIntent(t, you.x, you.z, you.r)) a.hit(f, you, a.foePower, f.type, slow);
  }
  // ---- the pad: Dodge + your four moves
  pad() {
    return [
      { label: 'Dodge', key: 'Space', cd: this.cd[0] / LIVE.dodge.cool, dim: this.cd[0] > 0 },
      ...[0, 1, 2, 3].map(i => {
        const s = this.moves[i];
        if (!s) return null;
        const c = this.cd[i + 1], max = this.cdMax?.[i + 1] || 1;
        return { move: s, key: String(i + 1), cd: c / max, dim: c > 0, on: this.charge.slot === i + 1, charge: this.charge.slot === i + 1 ? Math.min(1, this.charge.t / LIVE.charge) : 0 };
      }),
    ];
  }
  dispose() { for (const s of this.shots) this.a.fx.free(s.m); }
}

// For the bots (and the console): is a segment from you to f clear of pillars?
export const clearShot = (a, f) => !segBlocked(a.you.x, a.you.z, f.x, f.z, 0.1);
