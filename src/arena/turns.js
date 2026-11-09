// Prototypes 2 and 3 (owner 2026-11-09: "draw and flick ... there's no real aim", replaced):
//   AimMode (🎯): turn-based sharpshooting. The monsters never stop moving, so a shot has to go where a monster WILL be.
//     Touch the arena to aim (a crosshair under your finger), lift to fire; a 4 s clock runs once your finger is down.
//     Straight shots stop at pillars, lobs fly over them and land where you aimed; dead centre = Bullseye!
//     Then the monsters warn in red and you get a moment to hop out (tap a spot near you).
//   TimingMode (⏱️): the battle menu you know, but every attack and every block is a timing tap: stop the needle in the
//     bright zone, hit the beats, let go of a charge in the green, and tap Block as the ring closes on you.
import * as THREE from 'three';
import { shapeOf, pushOut, len2, intentFor, inIntent, inPillar, onFloor, segBlocked, R } from './core.js';

export const TURN = { cools: { heal: 3, buff: 3, cloud: 2, sleep: 3, burst: 1 } }; // turns before a move can be used again

// Glowing dots on the ground (an aim line) and a ring (where a lob lands). One instanced mesh.
class Dots {
  constructor(scene) {
    this.max = 160;
    this.mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.13, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), this.max);
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.visible = false;
    this.cross = new THREE.Group();
    for (const r of [0, Math.PI / 2]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.12).rotateX(-Math.PI / 2), this.ring.material);
      bar.rotation.y = r; this.cross.add(bar);
    }
    this.cross.visible = false;
    this.scene = scene; scene.add(this.mesh, this.ring, this.cross);
    this.m = new THREE.Matrix4();
  }
  line(points, color = 0xffffff, every = 0.35) {
    this.mesh.material.color.setHex(color);
    let n = 0, carry = 0;
    for (let i = 1; i < points.length && n < this.max; i++) {
      const a = points[i - 1], b = points[i], L = len2(b.x - a.x, b.z - a.z);
      let s = carry;
      while (s <= L && n < this.max) { const k = L ? s / L : 0; this.m.makeTranslation(a.x + (b.x - a.x) * k, 0.09, a.z + (b.z - a.z) * k); this.mesh.setMatrixAt(n++, this.m); s += every; }
      carry = s - L;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
  target(x, z, r, color = 0xffffff) {
    this.ring.visible = r > 0; this.ring.position.set(x, 0.1, z); this.ring.scale.setScalar(r); this.ring.material.color.setHex(color);
    this.cross.visible = true; this.cross.position.set(x, 0.11, z);
  }
  hide() { this.mesh.count = 0; this.ring.visible = false; this.cross.visible = false; }
  dispose() { this.scene.remove(this.mesh, this.ring, this.cross); }
}

function setCool(mode, slot, s) { mode.cool[slot - 1] = (TURN.cools[s.kind] || 0) + 1; }
function movePad(mode, dimAll, armed = -1) {
  return [0, 1, 2, 3].map(i => {
    const s = mode.moves[i];
    if (!s) return null;
    const c = mode.cool[i];
    return { move: s, key: String(i + 1), dim: dimAll || c > 0, cd: c > 0 ? Math.min(1, c / ((TURN.cools[s.kind] || 0) + 1)) : 0, turns: c, on: armed === i + 1 };
  });
}
// heal / power up / slow cloud / sleepy cloud, the same in both modes
function status(a, s, x, z) {
  const you = a.you;
  if (s.kind === 'heal') { a.heal(you, 0.4); return; }
  if (s.kind === 'buff') { you.buffTurns = 2; you.c.atkUp = 1.5; a.say('Power up for 2 turns!'); return; }
  const r = s.kind === 'cloud' ? 2.6 : 2.3;
  a.fx.cloud(s.type, x, z, r, 1.2);
  let n = 0;
  for (const f of a.foes) if (f.alive && len2(f.x - x, f.z - z) < r + f.r * 0.5) {
    n++;
    if (s.kind === 'cloud') f.slowTurns = 2;
    else { f.sleepTurns = 1; if (f.tell) { a.fx.untell(f.tell); f.tell = null; } }
  }
  a.say(n ? (s.kind === 'cloud' ? 'Slowed down!' : 'Fast asleep!') : 'Missed them!');
}

// ================================================================ 🎯 Aim

export const AIM = {
  clock: 4, // seconds to aim once your finger is down (the shot goes by itself after)
  shot: 12, // straight shots, blocks a second: far monsters need a lead
  lobTime: 0.95, lobR: 2.2, lobReach: 10,
  rush: 7.5, // how far a rush goes
  spread: 0.13, // a volley's three shots fan out
  bull: 0.65, bullMult: 1.5, // the crosshair within this of the monster's middle when the shot lands = Bullseye!
  hop: 3.2, dodge: 1.5, // hop this far, in this long, out of the red on the monsters' turn
  patrol: { r: [1.8, 3.2], speed: [1.6, 2.3] }, // monsters run round their patch the whole time (blocks a second)
};

export class AimMode {
  constructor(a) {
    this.a = a; this.name = 'aim'; this.cam = 'whole';
    this.hint = 'Pick a move. Touch to aim where the monster WILL be, lift to fire! Then hop out of the red.';
  }
  start() {
    const a = this.a;
    this.moves = a.you.c.moves.map(shapeOf);
    this.cool = [0, 0, 0, 0];
    this.dots = new Dots(a.scene);
    this.clock = 0; this.turn = 1; this.shots = [];
    this.anims = [];
    for (const [i, f] of a.foes.entries()) { // each monster runs round its own patch, never through a pillar
      const P = AIM.patrol;
      f.patrol = { cx: f.x, cz: f.z, r: P.r[0] + (P.r[1] - P.r[0]) * ((i * 0.37) % 1), w: 0, dir: i % 2 ? 1 : -1, ph: i * 1.7 };
      f.patrol.w = (P.speed[0] + (P.speed[1] - P.speed[0]) * ((i * 0.61) % 1)) / f.patrol.r;
      f.sleepTurns = 0; f.slowTurns = 0;
      this.patrolStep(f, 0);
    }
    a.you.buffTurns = 0;
    this.sel = this.firstHit();
    this.yourTurn();
  }
  firstHit() { const i = this.moves.findIndex((s, k) => s && s.power > 0 && this.cool[k] === 0); return i >= 0 ? i + 1 : 1; }
  yourTurn() {
    this.phase = 'you'; this.aiming = false;
    if (!this.moves[this.sel - 1] || this.cool[this.sel - 1] > 0) this.sel = this.firstHit();
    this.a.timer(null);
    this.a.say(`Turn ${this.turn}: aim!`);
  }
  // where a monster is: round its patch (the slow cloud halves its speed; asleep it stands still)
  patrolStep(f, dt) {
    const p = f.patrol;
    if (f.sleepTurns > 0) { f.moving = false; return; }
    p.ph += p.w * p.dir * dt * (f.slowTurns > 0 ? 0.5 : 1);
    const x = p.cx + Math.cos(p.ph) * p.r, z = p.cz + Math.sin(p.ph) * p.r;
    const o = { x, z, r: f.r };
    pushOut(o);
    f.heading = Math.atan2(o.x - f.x, o.z - f.z) || f.heading;
    f.x = o.x; f.z = o.z; f.moving = true;
  }
  // the bots and the console: where a monster will be in t seconds
  future(f, t) {
    const p = f.patrol;
    if (f.sleepTurns > 0) return { x: f.x, z: f.z };
    const ph = p.ph + p.w * p.dir * t * (f.slowTurns > 0 ? 0.5 : 1), o = { x: p.cx + Math.cos(ph) * p.r, z: p.cz + Math.sin(ph) * p.r, r: f.r };
    pushOut(o);
    return o;
  }
  press(slot) {
    if (this.a.over || slot === 0) return;
    if (this.phase !== 'you' || this.aiming) return;
    const s = this.moves[slot - 1];
    if (!s || this.cool[slot - 1] > 0) return;
    this.sel = slot;
    if (s.kind === 'heal' || s.kind === 'buff') { setCool(this, slot, s); this.a.sound(`fx:${s.type}`); status(this.a, s); this.endYourTurn(); return; }
    this.a.say(`${s.name}: ${{ bolt: 'aim and fire', volley: 'three shots', burst: 'lob it, BOOM where it lands', dash: 'rush to where you aim', cloud: 'lob a slow cloud', sleep: 'lob a sleepy cloud' }[s.kind]}`);
  }
  release() {}
  get lob() { return ['burst', 'cloud', 'sleep'].includes(this.moves[this.sel - 1]?.kind); }
  pointer(kind, p) {
    const a = this.a, you = a.you;
    if (a.over || !p) return;
    if (this.phase === 'dodge') { // hop out of the red: tap a spot near you
      if (kind !== 'down' || this.hopped) return;
      let dx = p.x - you.x, dz = p.z - you.z; const d = len2(dx, dz);
      if (d > AIM.hop) { dx *= AIM.hop / d; dz *= AIM.hop / d; }
      const to = { x: you.x + dx, z: you.z + dz, r: you.r };
      pushOut(to);
      if (segBlocked(you.x, you.z, to.x, to.z, 0.5)) return;
      this.hopped = true;
      const x0 = you.x, z0 = you.z;
      a.sound('dodge');
      this.anim(0.22, k => { you.x = x0 + (to.x - x0) * k; you.z = z0 + (to.z - z0) * k; you.lift = Math.sin(k * Math.PI) * 0.8; });
      return;
    }
    if (this.phase !== 'you') return;
    if (kind === 'down') { this.aiming = true; this.t0 = this.clock; this.cross = this.clamp(p); }
    else if (kind === 'move' && this.aiming) this.cross = this.clamp(p);
    else if (kind === 'up' && this.aiming) this.fire();
  }
  clamp(p) {
    const you = this.a.you, s = this.moves[this.sel - 1];
    const reach = this.lob ? AIM.lobReach : s.kind === 'dash' ? AIM.rush : 2 * R;
    let dx = p.x - you.x, dz = p.z - you.z; const d = len2(dx, dz);
    if (d > reach) { dx *= reach / d; dz *= reach / d; }
    return { x: you.x + dx, z: you.z + dz };
  }
  fire() {
    const a = this.a, you = a.you, s = this.moves[this.sel - 1], c = this.cross;
    this.aiming = false; this.dots.hide(); a.timer(null);
    const d = len2(c.x - you.x, c.z - you.z) || 1, dx = (c.x - you.x) / d, dz = (c.z - you.z) / d;
    setCool(this, this.sel, s);
    a.sound(`fx:${s.type}`);
    you.heading = Math.atan2(dx, dz);
    this.phase = 'fly';
    if (s.kind === 'bolt') this.shots.push(this.shot(s, dx, dz, 0));
    else if (s.kind === 'volley') for (const t of [-AIM.spread, 0, AIM.spread]) { const co = Math.cos(t), si = Math.sin(t); this.shots.push(this.shot(s, dx * co + dz * si, dz * co - dx * si, 0)); }
    else if (s.kind === 'dash') {
      if (s.recoil) a.hurtSelf(0.06);
      const hits = new Set(), x0 = you.x, z0 = you.z, L = Math.min(d, AIM.rush);
      you.moving = true;
      this.anim(L / 14, k => {
        const o = { x: x0 + dx * L * k, z: z0 + dz * L * k, r: you.r };
        if (inPillar(o.x, o.z, you.r * 0.8)) return;
        you.x = o.x; you.z = o.z;
        for (const f of a.foes) if (f.alive && !hits.has(f) && len2(f.x - you.x, f.z - you.z) < f.r + you.r) { hits.add(f); a.hit(you, f, s.power, s.type, a.youMult); }
        if (k >= 1) { pushOut(you); you.moving = false; }
      });
    } else this.shots.push({ s, lob: true, x0: you.x, z0: you.z, x: c.x, z: c.z, t: 0, m: a.fx.shot(s.type, you.x, you.z) });
  }
  shot(s, dx, dz, t) { return { s, x: this.a.you.x, z: this.a.you.z, dx, dz, left: 2 * R, cross: { ...this.cross }, t, m: this.a.fx.shot(s.type, this.a.you.x, this.a.you.z) }; }
  shotStep(sh, dt) {
    const a = this.a;
    if (sh.lob) {
      sh.t += dt;
      const k = Math.min(1, sh.t / AIM.lobTime);
      sh.m.position.set(sh.x0 + (sh.x - sh.x0) * k, 0.8 + Math.sin(k * Math.PI) * 3.2, sh.z0 + (sh.z - sh.z0) * k);
      if (k < 1) return;
      sh.dead = true; a.fx.free(sh.m);
      if (sh.s.kind !== 'burst') return status(a, sh.s, sh.x, sh.z);
      a.fx.burst(sh.s.type, sh.x, sh.z, AIM.lobR, 0.5, 0.7);
      let bull = false;
      for (const f of a.foes) {
        if (!f.alive) continue;
        const dd = len2(f.x - sh.x, f.z - sh.z);
        if (dd > AIM.lobR + f.r * 0.5) continue;
        const b = dd < AIM.bull;
        bull ||= b;
        a.hit(a.you, f, sh.s.power, sh.s.type, a.youMult * (b ? AIM.bullMult : 0.7));
      }
      if (bull) a.bullseye(sh.x, sh.z);
      return;
    }
    const step = AIM.shot * dt;
    sh.x += sh.dx * step; sh.z += sh.dz * step; sh.left -= step;
    sh.m.position.set(sh.x, 0.8, sh.z); sh.m.rotation.y += dt * 9;
    if (inPillar(sh.x, sh.z, 0.1) || sh.left <= 0 || len2(sh.x, sh.z) > R) { sh.dead = true; a.fx.free(sh.m); a.say('Missed!'); return; }
    for (const f of a.foes) {
      if (!f.alive || len2(f.x - sh.x, f.z - sh.z) > f.r + 0.2) continue;
      sh.dead = true; a.fx.free(sh.m);
      const b = len2(f.x - sh.cross.x, f.z - sh.cross.z) < AIM.bull; // you aimed right where it ended up
      a.hit(a.you, f, sh.s.power, sh.s.type, a.youMult * (b ? AIM.bullMult : 1));
      if (b) a.bullseye(f.x, f.z);
      return;
    }
  }
  endYourTurn() {
    const a = this.a;
    this.cool = this.cool.map(c => Math.max(0, c - 1));
    a.you.buffTurns = Math.max(0, a.you.buffTurns - 1);
    if (a.over) return;
    // the monsters warn where they hit, then you get a moment to hop away
    for (const f of a.foes) {
      if (!f.alive) continue;
      if (f.sleepTurns > 0) { f.sleepTurns--; continue; }
      f.tell = a.fx.tell(intentFor(f, a.you, { lineLen: 2 * R, stompReach: 6, stompR: 3.2, lobR: 2.0 }));
    }
    this.phase = 'dodge'; this.hopped = false; this.t0 = this.clock;
    a.say('Hop out of the red!');
  }
  strike() {
    const a = this.a;
    for (const f of a.foes) {
      if (!f.tell) continue;
      const t = f.tell.t;
      a.fx.untell(f.tell); f.tell = null;
      a.fx.burst(f.type, t.kind === 'line' ? f.x : t.x, t.kind === 'line' ? f.z : t.z, t.kind === 'line' ? 1.2 : t.r, 0.35, 0.55);
      if (inIntent(t, a.you.x, a.you.z, a.you.r)) a.hit(f, a.you, a.foePower, f.type, f.slowTurns > 0 ? 0.7 : 1);
      if (f.slowTurns > 0) f.slowTurns--;
    }
    a.sound('thud');
    this.turn++;
    this.phase = 'wait'; this.t0 = this.clock;
  }
  anim(time, fn) { this.anims.push({ t0: this.clock, time, fn }); }
  step(dt) {
    const a = this.a;
    this.clock += dt;
    for (const n of this.anims) { const k = Math.min(1, (this.clock - n.t0) / n.time); n.fn(k); n.done = k >= 1; }
    this.anims = this.anims.filter(n => !n.done);
    for (const f of a.foes) if (f.alive) this.patrolStep(f, dt);
    for (const sh of this.shots) this.shotStep(sh, dt);
    this.shots = this.shots.filter(s => !s.dead);
    if (this.phase === 'fly' && !this.shots.length && !this.anims.length && !a.over) this.endYourTurn();
    if (this.phase === 'dodge') {
      const k = (this.clock - this.t0) / AIM.dodge;
      a.timer(1 - k);
      if (k >= 1) { a.timer(null); this.strike(); }
    }
    if (this.phase === 'wait' && this.clock - this.t0 > 0.6 && !a.over) this.yourTurn();
    if (this.aiming) {
      const k = (this.clock - this.t0) / AIM.clock;
      a.timer(1 - k);
      const you = a.you, s = this.moves[this.sel - 1], col = a.typeHex(s.type);
      if (this.lob) { this.dots.line([], col); this.dots.target(this.cross.x, this.cross.z, s.kind === 'burst' ? AIM.lobR : 2.4, col); }
      else { this.dots.line(this.aimLine(), col); this.dots.target(this.cross.x, this.cross.z, 0, col); }
      if (k >= 1) { a.say('Time!'); this.fire(); }
    }
  }
  // the straight line from you toward the crosshair, up to a pillar or the wall
  aimLine() {
    const you = this.a.you, c = this.cross, d = len2(c.x - you.x, c.z - you.z) || 1;
    const dx = (c.x - you.x) / d, dz = (c.z - you.z) / d, pts = [{ x: you.x, z: you.z }];
    for (let s = 0.3; s < 2 * R; s += 0.3) {
      const x = you.x + dx * s, z = you.z + dz * s;
      pts.push({ x, z });
      if (inPillar(x, z, 0.1) || !onFloor(x, z, 0.2)) break;
    }
    return pts;
  }
  pad() {
    const you = this.phase === 'you' && !this.a.over && !this.aiming;
    return [{ label: this.phase === 'dodge' ? 'Hop!' : 'Aim', dim: true }, ...movePad(this, !you, this.sel)];
  }
  dispose() { this.dots?.dispose(); for (const s of this.shots) this.a.fx.free(s.m); }
}

// ================================================================ ⏱️ Timing

export const TIMING = {
  sweep: 1.15, // the needle goes across and back in this long
  zone: 0.24, perfect: 0.07, // the bright zone's width and its perfect middle (parts of the bar)
  weak: 0.4, good: 1, best: 1.6, // damage x
  beats: 4, beatGap: 0.52, beatTravel: 1.0, beatWin: 0.11, // the beats slide into the line
  charge: 1.5, green: [0.74, 0.9], // a charge fills in charge s; let go in the green (past it = fizzle)
  ring: 1.0, block: { perfect: 0.075, good: 0.17 }, // the ring closes on you in ring s; tap Block when it lands
};

export class TimingMode {
  constructor(a) {
    this.a = a; this.name = 'timing'; this.cam = 'whole';
    this.hint = 'Pick a move, then TAP at the right moment! When a monster attacks, tap as the ring closes.';
  }
  start() {
    const a = this.a;
    this.moves = a.you.c.moves.map(shapeOf);
    this.cool = [0, 0, 0, 0];
    this.clock = 0; this.turn = 1; this.anims = []; this.q = [];
    a.you.buffTurns = 0;
    for (const f of a.foes) { f.sleepTurns = 0; f.slowTurns = 0; }
    this.meterEl = document.getElementById('meter');
    this.ctx = this.meterEl.getContext('2d');
    this.ring = null;
    this.yourTurn();
  }
  yourTurn() { this.phase = 'pick'; this.meter = null; this.a.say(`Turn ${this.turn}: pick a move!`); }
  get target() {
    const a = this.a;
    if (!this.aimAt?.alive) this.aimAt = a.foes.filter(f => f.alive).sort((p, q) => p.hp - q.hp)[0];
    return this.aimAt;
  }
  pointer(kind, p) { // a tap on a monster picks it; any other tap is the Tap! button
    if (this.a.over) return;
    if (kind === 'down' && p && this.phase === 'pick') {
      const f = this.a.foes.find(f => f.alive && len2(f.x - p.x, f.z - p.z) < 1.8);
      if (f) { this.aimAt = f; this.a.say(`Target: ${this.a.nameOf(f)}`); return; }
    }
    if (kind === 'down') this.tapDown(); else if (kind === 'up') this.tapUp();
  }
  press(slot) {
    if (this.a.over) return;
    if (slot === 0) return this.tapDown();
    if (this.phase !== 'pick') return;
    const s = this.moves[slot - 1];
    if (!s || this.cool[slot - 1] > 0) return;
    setCool(this, slot, s);
    this.s = s;
    const kind = s.kind === 'volley' ? 'beats' : s.kind === 'burst' ? 'charge' : 'needle';
    this.meter = { kind, t0: this.clock, taps: [], held: false, done: false, phase0: (this.turn * 0.37) % 1 };
    this.phase = 'meter';
    this.a.say({ needle: 'Tap when the needle is in the bright part!', beats: 'Tap as each beat hits the line!', charge: 'Hold Tap!, let go in the green!' }[kind]);
  }
  release(slot) { if (slot === 0) this.tapUp(); }
  tapDown() {
    const m = this.meter, t = this.clock;
    if (this.phase === 'block' && this.ring && this.ring.tap == null) { this.ring.tap = t; return; }
    if (this.phase !== 'meter' || !m || m.done) return;
    if (m.kind === 'needle') { m.done = true; m.at = this.needle(t); this.later(0.35, () => this.attack(this.judgeNeedle(m.at))); }
    else if (m.kind === 'beats') m.taps.push(t);
    else if (m.kind === 'charge' && !m.held) { m.held = true; m.hold0 = t; }
  }
  tapUp() {
    const m = this.meter;
    if (this.phase !== 'meter' || !m || m.done || m.kind !== 'charge' || !m.held) return;
    m.done = true; m.at = Math.min(1.2, (this.clock - m.hold0) / TIMING.charge);
    this.later(0.3, () => this.attack(m.at >= TIMING.green[0] && m.at <= TIMING.green[1] ? (m.at > 0.8 && m.at < 0.86 ? 'best' : 'good') : 'weak'));
  }
  // the needle: 0..1..0 across the bar; the bright zone moves a little every turn
  needle(t) { const u = ((t - this.meter.t0) / TIMING.sweep) % 1; return u < 0.5 ? u * 2 : 2 - u * 2; }
  zone() { const c = 0.25 + 0.5 * this.meter.phase0; return [c - TIMING.zone / 2, c + TIMING.zone / 2, c]; }
  judgeNeedle(x) { const [z0, z1, c] = this.zone(); return Math.abs(x - c) < TIMING.perfect / 2 ? 'best' : x >= z0 && x <= z1 ? 'good' : 'weak'; }
  beatTime(i) { return this.meter.t0 + 0.6 + i * TIMING.beatGap + TIMING.beatTravel; } // when beat i reaches the line
  attack(q) {
    const a = this.a, s = this.s, you = a.you, f = this.target, mult = TIMING[q] * a.youMult;
    a.sound(`fx:${s.type}`);
    a.say({ best: 'Perfect!', good: 'Good!', weak: 'Weak...' }[q]);
    this.phase = 'act';
    if (s.kind === 'heal' || s.kind === 'buff') {
      if (q === 'weak') a.say('It fizzled...'); else status(a, s);
    } else if (s.kind === 'cloud' || s.kind === 'sleep') {
      if (q === 'weak') a.say('It missed!'); else status(a, s, f.x, f.z);
    } else if (s.kind === 'burst') {
      this.lunge(you, f);
      a.fx.burst(s.type, f.x, f.z, 3, 0.5, 0.7);
      for (const o of a.foes) if (o.alive) a.hit(you, o, s.power, s.type, mult * (o === f ? 1 : 0.6));
    } else {
      if (s.recoil) a.hurtSelf(0.06);
      this.lunge(you, f);
      a.hit(you, f, s.power, s.type, mult);
    }
    this.later(0.8, () => this.foesTurn());
  }
  beatsDone() {
    const m = this.meter;
    m.done = true;
    let good = 0;
    for (let i = 0; i < TIMING.beats; i++) { // each beat counts once, with the tap nearest to it
      const bt = this.beatTime(i);
      if (m.taps.some(t => Math.abs(t - bt) < TIMING.beatWin)) good++;
    }
    m.good = good;
    const extra = m.taps.length - good; // mashing: every tap that hit no beat cancels a good one
    good = Math.max(0, good - Math.max(0, extra - 1));
    const a = this.a, s = this.s, you = a.you, f = this.target;
    a.say(good ? `${good} hit${good > 1 ? 's' : ''}!` : 'All missed...');
    this.phase = 'act';
    for (let i = 0; i < good; i++) this.later(i * 0.15, () => { if (f.alive) { this.lunge(you, f); a.hit(you, f, s.power, s.type, a.youMult * 1.1); } });
    this.later(0.8 + good * 0.15, () => this.foesTurn());
  }
  foesTurn() {
    const a = this.a;
    if (a.over) return;
    this.cool = this.cool.map(c => Math.max(0, c - 1));
    a.you.buffTurns = Math.max(0, a.you.buffTurns - 1);
    this.order = a.foes.filter(f => f.alive);
    this.next(0);
  }
  next(i) {
    const a = this.a;
    if (a.over) return;
    if (i >= this.order.length) { this.turn++; return this.yourTurn(); }
    const f = this.order[i];
    if (!f.alive) return this.next(i + 1);
    if (f.sleepTurns > 0) { f.sleepTurns--; a.say(`${a.nameOf(f)} is asleep... zzz`); return this.later(0.7, () => this.next(i + 1)); }
    this.phase = 'block';
    this.ring = { f, t0: this.clock, tap: null, i };
    a.say(i === 0 && this.turn <= 2 ? 'Tap as the ring touches you!' : `${a.nameOf(f)} attacks!`);
  }
  blockLands() {
    const a = this.a, r = this.ring, land = r.t0 + TIMING.ring, f = r.f;
    const off = r.tap == null ? 9 : Math.abs(r.tap - land);
    const early = r.tap != null && r.tap < land - TIMING.block.good;
    const q = off <= TIMING.block.perfect ? 'perfect' : off <= TIMING.block.good ? 'good' : 'none';
    this.ring = null;
    this.lunge(f, a.you);
    if (q === 'perfect') { a.say('Blocked!'); a.sound('bump'); }
    else a.hit(f, a.you, a.foePower, f.type, (q === 'good' ? 0.4 : 1) * (f.slowTurns > 0 ? 0.7 : 1));
    if (q !== 'perfect' && early) a.say('Too early!');
    if (f.slowTurns > 0) f.slowTurns--;
    this.phase = 'busy';
    this.later(0.6, () => this.next(r.i + 1));
  }
  lunge(f, to) {
    const x0 = f.x, z0 = f.z, d = len2(to.x - x0, to.z - z0) || 1, L = Math.min(1.6, d - 1.6);
    f.heading = Math.atan2(to.x - x0, to.z - z0);
    this.anim(0.35, k => { const s = Math.sin(k * Math.PI) * L; f.x = x0 + (to.x - x0) / d * s; f.z = z0 + (to.z - z0) / d * s; });
  }
  later(sec, fn) { this.q.push({ at: this.clock + sec, fn }); }
  anim(time, fn) { this.anims.push({ t0: this.clock, time, fn }); }
  step(dt) {
    this.clock += dt;
    for (const n of this.anims) { const k = Math.min(1, (this.clock - n.t0) / n.time); n.fn(k); n.done = k >= 1; }
    this.anims = this.anims.filter(n => !n.done);
    const due = this.q.filter(e => e.at <= this.clock);
    this.q = this.q.filter(e => e.at > this.clock);
    for (const e of due) if (!this.a.over) e.fn();
    const m = this.meter;
    if (this.phase === 'meter' && m && !m.done) {
      if (m.kind === 'beats' && this.clock > this.beatTime(TIMING.beats - 1) + 0.3) this.beatsDone();
      if (m.kind === 'charge' && m.held && (this.clock - m.hold0) / TIMING.charge > 1.15) this.tapUp();
      if (m.kind === 'charge' && !m.held && this.clock - m.t0 > 6) { m.held = true; m.hold0 = this.clock; } // never stuck
    }
    if (this.phase === 'block' && this.ring && this.clock >= this.ring.t0 + TIMING.ring + TIMING.block.good) this.blockLands();
  }
  // drawn every frame: the meter (needle / beats / charge) and the closing ring round you
  frame() {
    const c = this.ctx, W = this.meterEl.width, H = this.meterEl.height, m = this.meter;
    const show = this.phase === 'meter' || (this.phase === 'act' && m) ;
    this.meterEl.classList.toggle('on', !!show);
    if (show) {
      c.clearRect(0, 0, W, H);
      const x0 = 30, x1 = W - 30, y = H / 2, bw = x1 - x0;
      c.fillStyle = '#000a'; c.fillRect(x0 - 10, y - 30, bw + 20, 60);
      if (m.kind === 'needle') {
        const [z0, z1, cc] = this.zone();
        c.fillStyle = '#ffd23a99'; c.fillRect(x0 + z0 * bw, y - 24, (z1 - z0) * bw, 48);
        c.fillStyle = '#fff'; c.fillRect(x0 + (cc - TIMING.perfect / 2) * bw, y - 24, TIMING.perfect * bw, 48);
        const at = m.done ? m.at : this.needle(this.clock);
        c.fillStyle = '#ff4a4a'; c.fillRect(x0 + at * bw - 4, y - 30, 8, 60);
      } else if (m.kind === 'beats') {
        const lx = x1 - 40;
        c.fillStyle = '#fff'; c.fillRect(lx - 3, y - 28, 6, 56);
        for (let i = 0; i < TIMING.beats; i++) {
          const bt = this.beatTime(i), k = 1 - (bt - this.clock) / TIMING.beatTravel;
          if (k < 0 || k > 1.25) continue;
          const hit = m.taps.some(t => Math.abs(t - bt) < TIMING.beatWin);
          c.fillStyle = hit ? '#6fe06f' : '#ffd23a';
          c.beginPath(); c.arc(x0 + k * (lx - x0), y, 14, 0, 7); c.fill();
        }
      } else {
        const k = m.done ? m.at : m.held ? (this.clock - m.hold0) / TIMING.charge : 0;
        c.fillStyle = '#6fe06f88'; c.fillRect(x0 + TIMING.green[0] * bw, y - 24, (TIMING.green[1] - TIMING.green[0]) * bw, 48);
        c.fillStyle = '#ff4a4a55'; c.fillRect(x0 + TIMING.green[1] * bw, y - 24, (1.2 - TIMING.green[1]) * bw / 1.2, 48);
        c.fillStyle = k > TIMING.green[1] ? '#ff4a4a' : '#fff'; c.fillRect(x0, y - 12, Math.min(1.2, k) / 1.2 * bw, 24);
      }
    }
    this.drawRing();
  }
  drawRing() {
    const a = this.a, r = this.ring;
    if (!r) { if (this.ringMesh) this.ringMesh.forEach(m => { m.visible = false; }); return; }
    if (!this.ringMesh) {
      const geo = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
      this.ringMesh = [0xff4a4a, 0xffffff].map(col => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false })); a.scene.add(m); return m; });
    }
    const k = Math.min(1.2, (this.clock - r.t0) / TIMING.ring), you = a.you, rr = you.r + 0.25;
    const [closing, target] = this.ringMesh;
    closing.visible = target.visible = true;
    closing.position.set(you.x, 0.12, you.z); closing.scale.setScalar(rr + (1 - k) * 4.5);
    target.position.set(you.x, 0.1, you.z); target.scale.setScalar(rr);
  }
  pad() {
    const tap = this.phase === 'meter' || this.phase === 'block';
    return [{ label: this.phase === 'block' ? 'Block!' : 'Tap!', key: 'Space', dim: !tap, on: tap }, ...movePad(this, this.phase !== 'pick' || this.a.over)];
  }
  dispose() { this.ringMesh?.forEach(m => this.a.scene.remove(m)); this.meterEl?.classList.remove('on'); }
}

export const turnsInfo = { R };
