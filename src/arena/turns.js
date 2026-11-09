// Prototypes 2 and 3: turn-based with skill. Time stands still while you think; once you start drawing or pulling,
// a short clock runs (when it ends, your move goes by itself). Monsters show in red where they will hit on their turn.
//   DrawMode: draw where to walk, then pick a move and draw its path (a shot curves round a pillar, a rush runs your line).
//   FlickMode: pick a power, pull back from your creature and let go: it bounces round the arena like a pinball.
import * as THREE from 'three';
import { shapeOf, pushOut, len2, intentFor, inIntent, inPillar, onFloor, R, segBlocked } from './core.js';

export const TURN = {
  foeMove: 2.6, // how far a monster walks on its turn (blocks)
  tellLine: 9,
  cools: { heal: 3, buff: 3, cloud: 2, sleep: 3, burst: 1 }, // turns before the move can be used again
};
export const DRAW = { walkInk: 5, walkTime: 3, aimTime: 2.5, ink: { bolt: 16, volley: 16, dash: 7.5, burst: 9, cloud: 9, sleep: 9 }, startNear: 1.8, shotSpeed: 14, walkSpeed: 7 };
export const FLICK = { pullMax: 4.5, speed: 21, time: 3, drag: 5.5, damp: 0.35, wall: 0.85, foeBounce: 0.75, startNear: 2.2, stop: 0.45 };

// ---------------------------------------------------------------- what both share: phases, the clock, the monsters' turn

class TurnBase {
  constructor(a) {
    this.a = a; this.cam = 'whole';
    this.q = []; this.clock = 0;
  }
  start() {
    const a = this.a;
    this.cool = [0, 0, 0, 0];
    this.moves = a.you.c.moves.map(shapeOf);
    for (const f of [a.you, ...a.foes]) { f.sleepTurns = 0; f.slowTurns = 0; f.buffTurns = 0; }
    this.turn = 1;
    this.newIntents();
    this.yourTurn();
    this.dots = new Dots(a.scene);
  }
  later(sec, fn) { this.q.push({ at: this.clock + sec, fn }); }
  stepClock(dt) {
    this.clock += dt;
    const due = this.q.filter(e => e.at <= this.clock);
    this.q = this.q.filter(e => e.at > this.clock);
    for (const e of due) if (!this.a.over) e.fn();
  }
  newIntents() {
    const a = this.a;
    for (const f of a.foes) {
      if (f.tell) a.fx.untell(f.tell);
      f.tell = null;
      if (!f.alive || f.sleepTurns > 0) continue;
      f.heading = Math.atan2(a.you.x - f.x, a.you.z - f.z);
      f.tell = a.fx.tell(intentFor(f, a.you, this.intentOpts || { lineLen: TURN.tellLine }));
    }
  }
  yourTurn() {
    const a = this.a;
    a.you.c.atkUp = a.you.buffTurns > 0 ? 1.5 : 1;
    this.phase = 'you';
    this.onYourTurn();
  }
  endYourTurn() {
    const a = this.a;
    this.phase = 'busy';
    this.cool = this.cool.map(c => Math.max(0, c - 1));
    a.you.buffTurns = Math.max(0, a.you.buffTurns - 1);
    this.later(0.45, () => this.foesAct(0));
  }
  foesAct(i) {
    const a = this.a, list = a.foes;
    if (i >= list.length) return this.later(0.1, () => this.foesWalk());
    const f = list[i];
    if (!f.alive) return this.foesAct(i + 1);
    if (f.sleepTurns > 0) { f.sleepTurns--; a.say(`${a.nameOf(f)} is asleep... zzz`); return this.later(0.5, () => this.foesAct(i + 1)); }
    const t = f.tell?.t;
    if (f.tell) { a.fx.untell(f.tell); f.tell = null; }
    if (t) {
      if (t.kind === 'line') this.lunge(f, t);
      a.fx.burst(f.type, t.kind === 'line' ? t.x + t.dx * t.len * 0.5 : t.x, t.kind === 'line' ? t.z + t.dz * t.len * 0.5 : t.z, t.kind === 'line' ? t.len * 0.5 : t.r, 0.4, 0.55);
      a.sound('thud');
      if (inIntent(t, a.you.x, a.you.z, a.you.r)) a.hit(f, a.you, a.foePower, f.type, f.slowTurns > 0 ? 0.7 : 1);
    }
    this.later(0.55, () => this.foesAct(i + 1));
  }
  lunge(f, t) { // a quick rush and back, just to show it
    const x0 = f.x, z0 = f.z, L = Math.min(t.len, 3);
    this.anim(0.3, k => { const s = Math.sin(k * Math.PI) * L; f.x = x0 + t.dx * s; f.z = z0 + t.dz * s; });
  }
  foesWalk() {
    const a = this.a, you = a.you;
    for (const f of a.foes) {
      if (!f.alive) continue;
      const slow = f.slowTurns > 0;
      if (f.slowTurns > 0) f.slowTurns--;
      if (f.sleepTurns > 0) continue;
      const dx = you.x - f.x, dz = you.z - f.z, d = len2(dx, dz) || 1;
      const want = f.pattern === 'lob' ? 6 : f.pattern === 'stomp' ? 2.4 : 4.5;
      const go = Math.max(-1.5, Math.min(d - want, TURN.foeMove * (slow ? 0.45 : 1)));
      const side = (f.side2 ??= Math.random() < 0.5 ? 1 : -1) * (slow ? 0.3 : 1.0);
      const tx = { x: f.x + dx / d * go - dz / d * side, z: f.z + dz / d * go + dx / d * side, r: f.r };
      pushOut(tx);
      for (const o of a.foes) if (o !== f && o.alive && len2(tx.x - o.x, tx.z - o.z) < 1.5) { tx.x = f.x; tx.z = f.z; }
      const x0 = f.x, z0 = f.z;
      f.moving = true;
      this.anim(0.5, k => { f.x = x0 + (tx.x - x0) * k; f.z = z0 + (tx.z - z0) * k; f.heading = Math.atan2(you.x - f.x, you.z - f.z); if (k >= 1) f.moving = false; });
    }
    this.later(0.6, () => { this.turn++; this.newIntents(); this.yourTurn(); });
  }
  // a little tween on the clock (so tests can run it at any speed)
  anim(time, fn) { const t0 = this.clock; this.anims = this.anims || []; this.anims.push({ t0, time, fn }); }
  stepAnims() {
    for (const n of this.anims || []) { const k = Math.min(1, (this.clock - n.t0) / n.time); n.fn(k); n.done = k >= 1; }
    this.anims = (this.anims || []).filter(n => !n.done);
  }
  // shared: heal / power up / slow cloud / sleepy cloud
  status(s, x, z) {
    const a = this.a, you = a.you;
    if (s.kind === 'heal') a.heal(you, 0.4);
    else if (s.kind === 'buff') { you.buffTurns = 2; you.c.atkUp = 1.5; a.say('Power up for 2 turns!'); }
    else if (s.kind === 'cloud') {
      a.fx.cloud(s.type, x, z, 2.6, 1.2);
      let n = 0; for (const f of a.foes) if (f.alive && len2(f.x - x, f.z - z) < 2.6 + f.r * 0.5) { f.slowTurns = 2; n++; }
      a.say(n ? 'Slowed down!' : 'Missed them!');
    } else if (s.kind === 'sleep') {
      a.fx.cloud(s.type, x, z, 2.3, 1.2);
      let n = 0;
      for (const f of a.foes) if (f.alive && len2(f.x - x, f.z - z) < 2.3 + f.r * 0.5) { f.sleepTurns = 1; n++; if (f.tell) { a.fx.untell(f.tell); f.tell = null; } }
      a.say(n ? 'Fast asleep!' : 'Missed them!');
    }
  }
  setCool(slot, s) { this.cool[slot - 1] = (TURN.cools[s.kind] || 0) + 1; }
  movePad(dimAll, armed = -1) {
    return [0, 1, 2, 3].map(i => {
      const s = this.moves[i];
      if (!s) return null;
      return { move: s, key: String(i + 1), dim: dimAll || this.cool[i] > 0, cd: this.cool[i] > 0 ? Math.min(1, this.cool[i] / ((TURN.cools[s.kind] || 0) + 1)) : 0, turns: this.cool[i], on: armed === i + 1 };
    });
  }
  dispose() { this.dots?.dispose(); }
}

// Glowing dots on the ground: a drawn path or an aim line. One instanced mesh.
class Dots {
  constructor(scene) {
    this.max = 160;
    this.mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.13, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), this.max);
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    this.ring.visible = false;
    this.scene = scene; scene.add(this.mesh, this.ring);
    this.m = new THREE.Matrix4();
  }
  show(points, color = 0xffffff, every = 0.35) {
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
  target(x, z, r, color = 0xffffff) { this.ring.visible = r > 0; this.ring.position.set(x, 0.1, z); this.ring.scale.setScalar(r); this.ring.material.color.setHex(color); }
  hide() { this.mesh.count = 0; this.ring.visible = false; }
  dispose() { this.scene.remove(this.mesh, this.ring); }
}

const pathLen = pts => pts.reduce((s, p, i) => i ? s + len2(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0, 0);
// The point a distance d along a path.
function along(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = len2(b.x - a.x, b.z - a.z);
    if (d <= L) { const k = L ? d / L : 0; return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: (b.x - a.x) / (L || 1), dz: (b.z - a.z) / (L || 1) }; }
    d -= L;
  }
  const b = pts[pts.length - 1], a = pts[pts.length - 2] || b, L = len2(b.x - a.x, b.z - a.z) || 1;
  return { x: b.x, z: b.z, dx: (b.x - a.x) / L, dz: (b.z - a.z) / L, end: true };
}

// ---------------------------------------------------------------- Draw the move

export class DrawMode extends TurnBase {
  constructor(a) {
    super(a);
    this.name = 'draw';
    this.hint = 'Draw where to walk (out of the red!), then pick a move and draw it.';
  }
  onYourTurn() { this.step2 = 'walk'; this.path = null; this.sel = 0; this.a.timer(null); this.a.say(`Turn ${this.turn}: draw where to walk`); }
  pointer(kind, p) {
    if (this.phase !== 'you' || this.a.over) return;
    const a = this.a, you = a.you;
    if (kind === 'down' && p && (this.step2 === 'walk' || this.step2 === 'aim')) {
      if (len2(p.x - you.x, p.z - you.z) > DRAW.startNear) { a.say('Start on your creature!'); return; }
      this.path = [{ x: you.x, z: you.z }];
      this.t0 = this.clock;
      this.limit = this.step2 === 'walk' ? DRAW.walkInk : DRAW.ink[this.moves[this.sel - 1].kind];
      this.drawing = true;
    } else if (kind === 'move' && this.drawing && p) this.extend(p);
    else if (kind === 'up' && this.drawing) this.finish();
  }
  extend(p) {
    const last = this.path[this.path.length - 1];
    let dx = p.x - last.x, dz = p.z - last.z, d = len2(dx, dz);
    if (d < 0.2) return;
    const left = this.limit - pathLen(this.path);
    if (left <= 0.05) return;
    if (d > left) { dx *= left / d; dz *= left / d; d = left; }
    const n = Math.ceil(d / 0.2);
    const lob = this.step2 === 'aim' && ['burst', 'cloud', 'sleep'].includes(this.moves[this.sel - 1].kind);
    for (let i = 1; i <= n; i++) { // a line can't go through a pillar or off the floor (a lob flies over pillars)
      const q = { x: last.x + dx * i / n, z: last.z + dz * i / n };
      if (!onFloor(q.x, q.z, this.step2 === 'walk' ? 0.6 : 0.1)) break;
      if (!lob && inPillar(q.x, q.z, this.step2 === 'walk' ? 0.6 : 0.15)) break;
      this.path.push(q);
    }
  }
  finish() {
    this.drawing = false;
    const a = this.a, pts = this.path;
    this.dots.hide(); a.timer(null);
    if (this.step2 === 'walk') {
      if (pts.length < 2 || pathLen(pts) < 0.3) return this.pickStep();
      this.walkAlong(pts, () => this.pickStep());
      return;
    }
    const s = this.moves[this.sel - 1];
    if (pts.length < 2 || pathLen(pts) < 0.5) { a.say('Draw a longer line!'); this.path = null; return; }
    this.phase = 'busy';
    this.setCool(this.sel, s);
    a.sound(`fx:${s.type}`);
    const done = () => this.later(0.3, () => this.endYourTurn());
    if (s.kind === 'bolt') this.shoot(s, pts, 1, done);
    else if (s.kind === 'volley') { for (let i = 0; i < 3; i++) this.later(i * 0.16, () => this.shoot(s, pts, 1, i === 2 ? done : null)); }
    else if (s.kind === 'dash') { if (s.recoil) a.hurtSelf(0.06); this.walkAlong(pts, done, s); }
    else this.lob(s, pts[pts.length - 1], done);
  }
  pickStep() { this.step2 = 'pick'; this.a.say('Pick a move!'); }
  press(slot) {
    if (this.phase !== 'you' || this.a.over) return;
    if (slot === 0) { // Stay (walk step) / Back (aim step)
      if (this.step2 === 'walk' && !this.drawing) this.pickStep();
      else if (this.step2 === 'aim' && !this.drawing) { this.step2 = 'pick'; this.sel = 0; }
      return;
    }
    const s = this.moves[slot - 1];
    if (!s || this.cool[slot - 1] > 0 || this.drawing) return;
    if (this.step2 === 'walk') this.pickStep();
    if (s.kind === 'heal' || s.kind === 'buff') { this.setCool(slot, s); this.status(s); this.endYourTurn(); return; }
    this.sel = slot; this.step2 = 'aim';
    this.a.say(['cloud', 'sleep', 'burst'].includes(s.kind) ? 'Draw to where it lands!' : s.kind === 'dash' ? 'Draw your rush!' : 'Draw your shot!');
  }
  release() {}
  walkAlong(pts, done, rush) {
    const a = this.a, you = a.you, L = pathLen(pts), time = L / (rush ? 11 : DRAW.walkSpeed);
    const hits = new Set();
    this.phase = 'busy';
    you.moving = true;
    this.anim(time, k => {
      const q = along(pts, L * k);
      you.x = q.x; you.z = q.z; you.heading = Math.atan2(q.dx, q.dz);
      if (rush) for (const f of a.foes) if (f.alive && !hits.has(f) && len2(f.x - you.x, f.z - you.z) < f.r + you.r) { hits.add(f); a.hit(you, f, rush.power, rush.type, a.youMult); }
      if (k >= 1) { you.moving = false; pushOut(you); if (!rush) this.phase = 'you'; done(); }
    });
  }
  shoot(s, pts, mult, done) {
    const a = this.a, L = pathLen(pts), m = a.fx.shot(s.type, pts[0].x, pts[0].z);
    let over = false;
    this.anim(L / DRAW.shotSpeed, k => {
      if (over) return;
      const q = along(pts, L * k);
      m.position.set(q.x, 0.8, q.z); m.rotation.y += 0.3;
      for (const f of a.foes) if (f.alive && len2(f.x - q.x, f.z - q.z) < f.r + 0.25) { over = true; a.hit(a.you, f, s.power, s.type, mult * a.youMult); break; }
      if (over || k >= 1) { a.fx.free(m); over = true; if (done) done(); }
    });
  }
  lob(s, end, done) {
    const a = this.a, you = a.you, m = a.fx.shot(s.type, you.x, you.z), x0 = you.x, z0 = you.z;
    this.anim(0.55, k => {
      m.position.set(x0 + (end.x - x0) * k, 0.8 + Math.sin(k * Math.PI) * 3, z0 + (end.z - z0) * k);
      if (k < 1) return;
      a.fx.free(m);
      if (s.kind === 'burst') {
        a.fx.burst(s.type, end.x, end.z, 2.6, 0.5, 0.7);
        for (const f of a.foes) if (f.alive && len2(f.x - end.x, f.z - end.z) < 2.6 + f.r * 0.5) a.hit(you, f, s.power, s.type, 0.8 * a.youMult);
      } else this.status(s, end.x, end.z);
      done();
    });
  }
  step(dt) {
    this.stepClock(dt);
    this.stepAnims();
    if (this.drawing) {
      const time = this.step2 === 'walk' ? DRAW.walkTime : DRAW.aimTime, k = (this.clock - this.t0) / time;
      this.a.timer(1 - k);
      if (k >= 1) { this.a.say('Time!'); this.finish(); return; }
      const s = this.step2 === 'aim' && this.moves[this.sel - 1];
      const col = this.step2 === 'walk' ? 0xffffff : this.a.typeHex(s.type);
      this.dots.show(this.path, col);
      const e = this.path[this.path.length - 1];
      this.dots.target(e.x, e.z, s && ['burst', 'cloud', 'sleep'].includes(s.kind) ? (s.kind === 'burst' ? 2.6 : s.kind === 'cloud' ? 2.6 : 2.3) : 0, col);
    }
  }
  pad() {
    const you = this.phase === 'you' && !this.a.over;
    const zero = this.step2 === 'walk' ? 'Stay' : this.step2 === 'aim' ? 'Back' : '–';
    return [{ label: zero, key: 'Space', dim: !you || this.drawing || this.step2 === 'pick' }, ...this.movePad(!you || this.drawing, this.sel)];
  }
}

// One fixed step of a flick: drag, walls and pillars bounce you, monsters bounce you and get nudged. Returns true once you stop.
export function rollPhysics(you, foes, r, dt, on = {}) {
  r.t += dt;
  const sp = len2(r.vx, r.vz);
  const ns = Math.max(0, sp - FLICK.drag * dt) * (1 - FLICK.damp * dt);
  if (sp > 0) { r.vx *= ns / sp; r.vz *= ns / sp; }
  you.x += r.vx * dt; you.z += r.vz * dt;
  const wall = pushOut(you);
  if (wall) {
    const dot = r.vx * wall.nx + r.vz * wall.nz;
    if (dot < 0) { r.vx = (r.vx - 2 * dot * wall.nx) * FLICK.wall; r.vz = (r.vz - 2 * dot * wall.nz) * FLICK.wall; on.wall?.(); }
  }
  for (const f of foes) {
    if (!f.alive) continue;
    const dx = you.x - f.x, dz = you.z - f.z, d = len2(dx, dz), min = you.r + f.r;
    if (d >= min || d < 1e-6) continue;
    const nx = dx / d, nz = dz / d;
    you.x = f.x + nx * min; you.z = f.z + nz * min;
    const dot = r.vx * nx + r.vz * nz;
    if (dot < 0) { r.vx = (r.vx - 2 * dot * nx) * FLICK.foeBounce; r.vz = (r.vz - 2 * dot * nz) * FLICK.foeBounce; }
    f.x -= nx * 0.35; f.z -= nz * 0.35; pushOut(f);
    if ((r.last.get(f) ?? -9) > r.t - 0.35) continue;
    r.last.set(f, r.t);
    on.foe?.(f);
  }
  return len2(r.vx, r.vz) < FLICK.stop;
}

// ---------------------------------------------------------------- Flick and bounce

export class FlickMode extends TurnBase {
  constructor(a) {
    super(a);
    this.name = 'flick';
    // a flick always moves you, so a monster aiming at where you stand would never hit: they guard areas instead
    this.intentOpts = { lineLen: 18, stompAlways: true, stompR: 3.2, lobR: 2.4 };
    this.hint = 'Pull back from your creature and let go! Don\'t stop in the red!';
  }
  onYourTurn() {
    this.aiming = false;
    if (!this.armed || this.cool[this.armed - 1] > 0) this.armed = this.firstHit();
    this.a.timer(null);
    this.a.say(`Turn ${this.turn}: pull back and let go!`);
  }
  firstHit() {
    const i = this.moves.findIndex((s, k) => s && s.power > 0 && this.cool[k] === 0);
    return i >= 0 ? i + 1 : 1;
  }
  press(slot) {
    if (this.phase !== 'you' || this.a.over || slot === 0) return;
    const s = this.moves[slot - 1];
    if (!s || this.cool[slot - 1] > 0) return;
    this.armed = slot;
    this.a.say(`${s.name}: ${this.powerWords(s)}`);
  }
  release() {}
  powerWords(s) {
    return { bolt: 'a strong bump', volley: 'two hits each bump', burst: 'BOOM at the first monster', dash: 'flies extra fast', heal: 'heals at each wall bounce', buff: 'power up for 2 turns', cloud: 'slows monsters where you stop', sleep: 'the first monster you hit falls asleep' }[s.kind];
  }
  pointer(kind, p) {
    if (this.phase !== 'you' || this.a.over) return;
    const you = this.a.you;
    if (kind === 'down' && p) {
      if (len2(p.x - you.x, p.z - you.z) > FLICK.startNear) { this.a.say('Touch your creature, pull back and let go!'); return; }
      this.aiming = true; this.t0 = this.clock; this.pull = { x: 0, z: 0 };
    } else if (kind === 'move' && this.aiming && p) {
      let dx = you.x - p.x, dz = you.z - p.z; const d = len2(dx, dz);
      if (d > FLICK.pullMax) { dx *= FLICK.pullMax / d; dz *= FLICK.pullMax / d; }
      this.pull = { x: dx, z: dz };
    } else if (kind === 'up' && this.aiming) this.go();
  }
  go() {
    const a = this.a, you = a.you;
    this.aiming = false; this.dots.hide(); this.band?.hide(); a.timer(null);
    const p = len2(this.pull.x, this.pull.z);
    if (p < 0.6) { a.say('Pull back further!'); return; }
    const s = this.moves[this.armed - 1];
    let speed = FLICK.speed * p / FLICK.pullMax;
    if (s.kind === 'dash') { speed *= 1.35; if (s.recoil) a.hurtSelf(0.06); }
    if (s.kind === 'buff') { you.buffTurns = 2; you.c.atkUp = 1.5; a.say('Power up!'); }
    this.setCool(this.armed, s);
    this.roll = { vx: this.pull.x / p * speed, vz: this.pull.z / p * speed, s, boom: false, slept: false, heals: 0, last: new Map(), t: 0 };
    this.phase = 'busy';
    a.sound(`fx:${s.type}`);
  }
  rollStep(dt) {
    const a = this.a, you = a.you, r = this.roll, s = r.s;
    const stopped = rollPhysics(you, a.foes, r, dt, {
      wall: () => { a.sound('bump'); if (s.kind === 'heal' && r.heals < 4) { r.heals++; a.heal(you, 0.07); } },
      foe: f => this.contact(f, s, r),
    });
    you.moving = !stopped;
    if (len2(r.vx, r.vz) > 0.5) you.heading = Math.atan2(r.vx, r.vz);
    if (stopped) {
      this.roll = null;
      if (s.kind === 'cloud') this.status(s, you.x, you.z);
      this.endYourTurn();
    }
  }
  // A dry run of a flick on copies (nothing moves, nobody is hurt): which monsters it bumps, and where you stop.
  // The aim line shows only the start; this is for the bots and the console.
  simulate(dirX, dirZ, power01) {
    const a = this.a, s = this.moves[this.armed - 1];
    let speed = FLICK.speed * power01;
    if (s.kind === 'dash') speed *= 1.35;
    const you = { x: a.you.x, z: a.you.z, r: a.you.r };
    const foes = a.foes.map(f => ({ x: f.x, z: f.z, r: f.r, alive: f.alive, id: f }));
    const r = { vx: dirX * speed, vz: dirZ * speed, last: new Map(), t: 0 };
    const hits = [];
    for (let i = 0; i < 120 * 12; i++) if (rollPhysics(you, foes, r, 1 / 120, { foe: f => hits.push(f.id) })) break;
    return { hits, x: you.x, z: you.z };
  }
  contact(f, s, r) {
    const a = this.a, you = a.you, m = a.youMult;
    if (s.kind === 'bolt' || s.kind === 'dash') a.hit(you, f, s.power, s.type, m);
    else if (s.kind === 'volley') { a.hit(you, f, s.power, s.type, m); this.later(0.12, () => f.alive && a.hit(you, f, s.power, s.type, m)); }
    else if (s.kind === 'burst') {
      if (r.boom) return a.hit(you, f, s.power, s.type, 0.3 * m);
      r.boom = true;
      a.fx.burst(s.type, f.x, f.z, 2.6, 0.5, 0.7);
      for (const o of a.foes) if (o.alive && len2(o.x - f.x, o.z - f.z) < 2.6 + o.r * 0.5) a.hit(you, o, s.power, s.type, 0.9 * m);
    } else {
      a.hit(you, f, 30, a.you.type, m); // a plain bump; the power is what counts
      if (s.kind === 'sleep' && !r.slept) { r.slept = true; f.sleepTurns = 1; if (f.tell) { a.fx.untell(f.tell); f.tell = null; } a.say('Fast asleep!'); }
    }
  }
  // where the flick goes until its first bounce (a pool game's aim line: the rest is up to you)
  aimLine() {
    const you = this.a.you, p = len2(this.pull.x, this.pull.z);
    if (p < 0.3) return [{ x: you.x, z: you.z }];
    const dx = this.pull.x / p, dz = this.pull.z / p, pts = [{ x: you.x, z: you.z }];
    const reach = 3 + 9 * p / FLICK.pullMax;
    for (let s = 0.3; s <= reach; s += 0.3) {
      const x = you.x + dx * s, z = you.z + dz * s;
      if (!onFloor(x, z, you.r) || inPillar(x, z, you.r) || this.a.foes.some(f => f.alive && len2(f.x - x, f.z - z) < f.r + you.r)) { pts.push({ x, z }); break; }
      pts.push({ x, z });
    }
    return pts;
  }
  step(dt) {
    this.stepClock(dt);
    this.stepAnims();
    if (this.roll) this.rollStep(dt);
    if (this.aiming) {
      const k = (this.clock - this.t0) / FLICK.time;
      this.a.timer(1 - k);
      // the pull band (white, from your creature to your finger) and the start of the flight (the move's colour)
      const you = this.a.you, band = [{ x: you.x, z: you.z }, { x: you.x - this.pull.x, z: you.z - this.pull.z }];
      this.dots.show(this.aimLine(), this.a.typeHex(this.moves[this.armed - 1].type), 0.3);
      this.band ??= new Dots(this.a.scene);
      this.band.show(band, 0xffffff, 0.22);
      if (k >= 1) { this.a.say('Time!'); this.go(); }
    }
  }
  dispose() { super.dispose(); this.band?.dispose(); }
  pad() {
    const you = this.phase === 'you' && !this.a.over && !this.aiming;
    return [{ label: '–', dim: true }, ...this.movePad(!you, this.armed)];
  }
}

export const turnsInfo = { R, segBlocked };
