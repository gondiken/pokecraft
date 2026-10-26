// T40b: the live parts of the Pirate Seas (LIVE.pirate in gymlive.js, made for the world.parts entry `seas`): the cannons you fire
// yourself from island to island, the ropes you swing on, the big treasure chest, smoke and coin puffs. Everything is per player and
// in memory (never saved or sent). A flight or a swing is a Mover (mover.js) on a closed-form path: the cannon is an `arc`, the rope
// is `PATHS.swing` (registered here, pure code in pirateland.js). The clock only runs while the game is playing (not paused, not in a
// battle), so a pause or a battle freezes a flight.
// Owner 2026-10-26, "some dexterity": the island cannons swing (fire when the dots of the landing preview turn gold), the rope keeps
// swinging until you press Let go!, and three rowboats must be sunk with the ship's deck cannons before Captain Squawk battles
// (the pure rules are in pirateland.js: AIM, cannonShot, LETGO, letGo, ropeDrop, ROWBOATS, deckShot, boatHit). A miss is a splash.
// Owner, later the same day ("way too easy"): the rope and the swivel cannons are held and let go (gymLive holds / release, like
// Kick!): hold Swing! to hang on, let go to drop; hold Fire! and the shot goes further (then nearer again), let go to fire. The boats
// row fast figure-eights; the dots turn gold only for the short moment a let-go would hit (aim ahead, let go on gold).
// `steady = true` (tests) gives the old rides: every cannon on target, every rope straight across.
// Meshes: cannon barrels, cannon wheels, ropes, a pool of puffs, the preview dots, the deck cannon ball, boat hulls and sails:
// 8 draw calls, all with userData.pirate, removed in dispose().
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { Mover, PATHS, makePath } from './mover.js';
import { swingPath, sweepAngle, cannonShot, AIM, letGo, LETGO, ropeDrop, ROWBOATS, boatKey, boatState, boatAt, deckShot, deckStand, boatHit, power } from './pirateland.js';
import { SHIP } from './pirateship.js';
import { sound } from './sound.js';

PATHS.swing = ({ rope, from, loop }) => swingPath(rope, from, loop);

export const PIRATE = { padReach: 1.5, ropeReach: 1.6, kick: 0.2, puffLife: 0.6 };
const PUFFS = 16, DOTS = 16;

export class PirateLive {
  constructor(game, part) {
    this.game = game;
    this.world = game.world;
    this.data = this.world.pirate;
    this.cells = new LiveCells(this.world, () => game.player);
    this.clock = 0; this.chestClock = 0;
    this.mover = null; this.carrying = null; // 'c1' | 'r2' ...
    this.kickAt = -9; this.kickId = null;
    this.swing = null; this.hang = this.data.ropes.map(() => 0); // 0 = hangs towards end a, 1 = towards end b (eased)
    this.told = new Set(); // one-time hints, per trip
    this.chest = null;     // 'open' | 'closed' as drawn
    this.wasWater = false; this.splashAt = -9;
    this.puffs = Array.from({ length: PUFFS }, () => ({ t0: -9, x: 0, y: 0, z: 0, gold: false }));
    this.nextPuff = 0;
    this.steady = false;   // tests: the old rides (no swinging cannons, ropes go straight across)
    this.aimT = {}; this.misses = {}; // per island cannon: its own aim clock, misses in a row (it swings slower after a miss)
    this.ball = null;      // a deck cannon ball in the air: { path, t, to, gi }
    this.held = null;      // the big button / E / the mouse held down: { kind: 'rope' } or { kind: 'deck', g, t0 }
    this.boatT = 0; this.sinking = {}; this.reloadAt = -9;
    this.preview = null;   // what the dots show: { spec, gold }
    this.meshes = [];
    this.build();
  }

  /* ---------- meshes ---------- */
  mark(m) { m.userData.pirate = true; m.frustumCulled = false; this.game.scene.add(m); this.meshes.push(m); return m; }
  build() {
    const cannons = this.data.cannons.map(c => ({ id: c.id, x: c.carriage[0] + 0.5, y: c.padTop + 1.0, z: c.carriage[1] + 0.5, dir: c.dir }));
    for (const [x, z, side] of SHIP.decor) cannons.push({ id: `decor-${x}-${z}`, x: x + 0.5, y: SHIP.deck + 1.8, z: z + 0.5, dir: side > 0 ? 0 : Math.PI });
    for (const [x, z] of SHIP.swivels) cannons.push({ id: `swivel-${x}`, x: x + 0.5, y: SHIP.deck + 2.25, z: z + 0.5, dir: Math.PI, swivel: true }); // on the rail, smaller
    this.guns = cannons;
    const barrelGeo = new THREE.BoxGeometry(0.46, 0.46, 1.5); barrelGeo.translate(0, 0, 0.5);
    this.barrels = this.mark(new THREE.InstancedMesh(barrelGeo, new THREE.MeshLambertMaterial({ color: 0x2c2e36 }), cannons.length));
    const wheelGeo = new THREE.BoxGeometry(0.16, 0.8, 0.8);
    this.wheels = this.mark(new THREE.InstancedMesh(wheelGeo, new THREE.MeshLambertMaterial({ color: 0x6a4020 }), cannons.length * 2));
    const ropeGeo = new THREE.BoxGeometry(0.12, 1, 0.12); ropeGeo.translate(0, -0.5, 0);
    this.ropes = this.mark(new THREE.InstancedMesh(ropeGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), this.data.ropes.length));
    const tex = (() => { // a soft round puff
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 2, 16, 16, 15);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.6, 'rgba(255,255,255,0.8)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(c);
    })();
    this.puffMesh = this.mark(new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }), PUFFS));
    this.puffMesh.renderOrder = 5;
    this.puffMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.dots = this.mark(new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }), DOTS));
    this.dots.setColorAt(0, WHITE);
    this.ballMesh = this.mark(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: 0x24262c })));
    this.ballMesh.visible = false;
    const n = ROWBOATS.boats.length;
    this.hulls = this.mark(new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.55, 2.8), new THREE.MeshLambertMaterial({ color: 0x8a5428 }), n));
    const sailGeo = new THREE.BoxGeometry(0.08, 1.3, 1.1); sailGeo.translate(0, 0.95, 0);
    this.sails = this.mark(new THREE.InstancedMesh(sailGeo, new THREE.MeshLambertMaterial({ color: 0xf6efe0 }), n));
    this.data.ropes.forEach((r, i) => this.ropes.setColorAt(i, ROPE));
    cannons.forEach((c, i) => this.placeGun(i, 0));
    this.drawDots(); this.drawBoats();
    this.updateRopes(0);
    this.drawPuffs();
  }
  dummy = new THREE.Object3D();
  placeGun(i, back, dir = this.guns[i].dir) {
    const c = this.guns[i], d = this.dummy;
    c.aim = dir;
    d.position.set(c.x - Math.sin(dir) * back, c.y + 0.1, c.z - Math.cos(dir) * back);
    d.rotation.set(c.swivel ? -0.12 : -0.42, dir, 0, 'YXZ');
    d.scale.setScalar(c.swivel ? 0.75 : 1);
    d.updateMatrix();
    this.barrels.setMatrixAt(i, d.matrix);
    for (const s of [-1, 1]) {
      d.position.set(c.x + Math.cos(dir) * 0.38 * s, c.y - 0.2, c.z - Math.sin(dir) * 0.38 * s);
      d.rotation.set(0, dir, 0);
      d.scale.setScalar(c.swivel ? 0.5 : 1); // a swivel cannon's mount
      d.updateMatrix();
      this.wheels.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), d.matrix);
    }
    this.barrels.instanceMatrix.needsUpdate = true; this.wheels.instanceMatrix.needsUpdate = true;
  }
  // a rope from its anchor to `end` ([x, y, z])
  placeRope(i, a, end) {
    const d = this.dummy, v = new THREE.Vector3(end[0] - a[0], end[1] - a[1], end[2] - a[2]), len = v.length() || 0.01;
    d.position.set(a[0], a[1], a[2]);
    d.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), v.clone().divideScalar(len));
    d.scale.set(1, len, 1);
    d.updateMatrix();
    this.ropes.setMatrixAt(i, d.matrix);
    this.ropes.instanceMatrix.needsUpdate = true;
  }
  updateRopes(dt) {
    const p = this.game.player;
    this.data.ropes.forEach((r, i) => {
      const on = this.swing?.i === i;
      this.ropes.setColorAt(i, on && this.swing.path.loop && letGo(this.swing.path, this.mover?.clock ?? 0) === 'far' ? GOLD : ROPE); // gold: let go now!
      if (on) { this.placeRope(i, r.anchor, [p.pos.x, p.pos.y + 1.6, p.pos.z]); return; }
      const da = Math.hypot(p.pos.x - r.a.pos[0], p.pos.z - r.a.pos[2]), db = Math.hypot(p.pos.x - r.b.pos[0], p.pos.z - r.b.pos[2]);
      const want = da <= db ? 0 : 1;
      this.hang[i] += Math.sign(want - this.hang[i]) * Math.min(Math.abs(want - this.hang[i]), dt / 0.6);
      const k = this.hang[i], mx = (r.a.pos[0] + r.b.pos[0]) / 2, mz = (r.a.pos[2] + r.b.pos[2]) / 2;
      // idle: the rope's end hangs beside the stand it is nearer to, at hand height, swinging gently
      const ex = r.a.pos[0] + (r.b.pos[0] - r.a.pos[0]) * k, ez = r.a.pos[2] + (r.b.pos[2] - r.a.pos[2]) * k;
      const toward = [(mx - ex) * 0.12, (mz - ez) * 0.12], sway = Math.sin(this.clock * 1.7 + i) * 0.12;
      this.placeRope(i, r.anchor, [ex + toward[0] + sway, r.feet + 1.4, ez + toward[1]]);
    });
    if (this.ropes.instanceColor) this.ropes.instanceColor.needsUpdate = true;
  }

  /* ---------- puffs ---------- */
  puff(x, y, z, gold = false, n = 1) {
    for (let k = 0; k < n; k++) {
      const q = this.puffs[this.nextPuff++ % PUFFS];
      q.t0 = this.clock; q.x = x + (k ? (k % 3 - 1) * 0.3 : 0); q.y = y + (k ? (k % 2) * 0.2 : 0); q.z = z + (k ? ((k >> 1) % 3 - 1) * 0.3 : 0); q.gold = gold;
    }
  }
  drawPuffs() {
    const d = this.dummy, cam = this.game.camera;
    this.puffs.forEach((q, i) => {
      const k = (this.clock - q.t0) / PIRATE.puffLife;
      if (k < 0 || k > 1) { d.scale.set(0, 0, 0); d.position.set(0, -50, 0); } else {
        d.position.set(q.x, q.y + k * (q.gold ? 1.6 : 0.8), q.z);
        d.scale.setScalar((q.gold ? 0.35 : 0.5 + k * 1.1) * Math.sin(Math.min(1, k * 1.2) * Math.PI * (q.gold ? 0.5 : 0.7) + 0.3));
      }
      d.quaternion.copy(cam.quaternion);
      d.updateMatrix();
      this.puffMesh.setMatrixAt(i, d.matrix);
      this.puffMesh.setColorAt(i, q.gold ? GOLD : SMOKE);
    });
    this.puffMesh.instanceMatrix.needsUpdate = true;
    if (this.puffMesh.instanceColor) this.puffMesh.instanceColor.needsUpdate = true;
  }

  /* ---------- the gadget you stand at ---------- */
  get busy() { return !!this.carrying; }
  gadget() {
    const p = this.game.player;
    if (!p || p.carry || this.game.inBattle) return null;
    let best = null;
    const test = (kind, id, x, z, y, reach, extra) => {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d <= reach && Math.abs(p.pos.y - y) < 0.7 && p.onGround && (!best || d < best.d)) best = { kind, id, d, ...extra };
    };
    for (const c of this.data.cannons) test('cannon', c.id, c.pad[0] + 0.5, c.pad[1] + 0.5, c.S[1], PIRATE.padReach, { c });
    for (const r of this.data.ropes) {
      test('rope', r.id, r.a.pos[0], r.a.pos[2], r.feet, PIRATE.ropeReach, { r, from: 'a' });
      test('rope', r.id, r.b.pos[0], r.b.pos[2], r.feet, PIRATE.ropeReach, { r, from: 'b' });
    }
    for (const at of ROWBOATS.cannons) { // stand on the step behind a swivel cannon
      const gi = this.guns.findIndex(g => g.id === `swivel-${at[0]}`), [x, y, z] = deckStand(at);
      test('deck', `deck-${at[0]}`, x, z, y, PIRATE.padReach, { at, gi });
    }
    return best;
  }
  // the island cannon's barrel angle beside its target right now
  offOf(c) { return this.steady ? 0 : sweepAngle(this.aimT[c.id] ?? 0, c); }
  // what firing now would do: { spec, hit } for an island cannon, { spec, hit (a boat index or -1), shot } for a deck cannon
  // (deck: `hit` = the boat the ball would hit if you let go now: where it will be when the ball comes down)
  shotNow(g) {
    if (g.kind === 'cannon') return cannonShot(this.world, g.c, this.offOf(g.c));
    const shot = deckShot(g.at, this.game.player.yaw, this.power());
    return { spec: shot.spec, hit: boatHit(this.game, shot.to, this.boatT + shot.spec.time), shot };
  }
  power() { return this.held?.kind === 'deck' ? power(this.clock - this.held.t0) : 0; }
  // the short word for the big action button / E prompt (gymLive.near)
  near() {
    if (!this.game.playing?.()) return null;
    if (this.swing?.path.loop) return 'Let go!';
    const g = this.gadget();
    return g ? (g.kind === 'rope' ? 'Swing!' : 'Fire!') : null;
  }
  // the big button presses and lets go (touch.js), E and the mouse too (main.js): a rope or a swivel cannon, or while held
  holds() {
    if (!this.game.playing?.()) return false;
    if (this.held?.kind === 'deck') return true;
    if (this.swing) return false; // swinging: the word is Let go! (letting go of the held button, or a fresh tap / E, drops you)
    const g = this.gadget();
    return !!g && (g.kind === 'deck' || (g.kind === 'rope' && !this.steady));
  }
  use() {
    if (!this.game.playing?.()) return false;
    if (this.held) return true; // a key repeat while held
    if (this.swing?.path.loop) { this.letGo(); return true; } // (a press without a hold, e.g. the hold was lost)
    const g = this.gadget();
    if (!g) return false;
    if (g.kind === 'cannon') this.fire(g.c);
    else if (g.kind === 'deck') { if (!this.ball && this.clock - this.reloadAt >= ROWBOATS.reload) this.held = { kind: 'deck', g, t0: this.clock }; }
    else { this.swingOn(g.r, g.from); if (!this.steady) this.held = { kind: 'rope' }; }
    return true;
  }
  // let go of the button: drop off the rope, or fire the swivel cannon
  release() {
    const h = this.held;
    if (!h) return false;
    if (h.kind === 'deck') this.shoot(h.g);
    this.held = null;
    if (h.kind === 'rope' && this.swing) this.letGo();
    return true;
  }
  // a click / tap on the gadget's own blocks, or on the chest
  hit(block) {
    const w = this.world, chest = w.starChest;
    if (chest && block.x === chest[0] && block.y === chest[1] && block.z === chest[2]) {
      this.game.ui.toast(this.game.stars.includes('pirate') ? 'Only gold coins left. Squawk!' : 'Squawk! Beat the Captain first!');
      return true;
    }
    if (block.id === B.CANNON_PAD || block.id === B.ROPE_POST || block.id === B.TARGET) return this.use();
    return false;
  }
  prompt(block) {
    const chest = this.world.starChest;
    if (chest && block.x === chest[0] && block.y === chest[1] && block.z === chest[2]) return `Captain Squawk's treasure chest · ${this.chest === 'open' ? 'empty' : 'locked'}`;
    return null;
  }

  fire(c) {
    const p = this.game.player, off = this.offOf(c), { spec, hit } = cannonShot(this.world, c, off);
    this.game.riding?.stop('quiet');
    const path = makePath(spec);
    p.yaw = path.at(0.2).yaw; p.pitch = Math.max(p.pitch, -0.2);
    sound.play('cannonboom');
    const gi = this.guns.findIndex(g => g.id === c.id), dir = c.dir + off;
    this.kickAt = this.clock; this.kickId = gi;
    this.puff(this.guns[gi].x + Math.sin(dir) * 1.6, this.guns[gi].y + 0.5, this.guns[gi].z + Math.cos(dir) * 1.6, false, 3);
    if (!c.home && !this.steady) this.misses[c.id] = hit ? 0 : Math.min(AIM.slower.length - 1, (this.misses[c.id] ?? 0) + 1);
    this.mover = new Mover({ path, run: 'ride', canLeave: false, onEnd: () => this.landed(c.id, spec.to, false, !hit) });
    this.carrying = c.id;
    this.mover.board(p);
  }
  swingOn(r, from) {
    const p = this.game.player, loop = !this.steady;
    this.game.riding?.stop('quiet');
    const path = makePath({ kind: 'swing', rope: { a: r.a.pos, b: r.b.pos }, from, loop });
    sound.play('whoosh');
    this.swing = { i: this.data.ropes.indexOf(r), r, from, path };
    this.mover = new Mover({ path, run: 'ride', canLeave: false, onEnd: () => { this.swing = null; this.landed(r.id, from === 'a' ? r.b.pos : r.a.pos, true); } });
    this.carrying = r.id;
    this.mover.board(p);
    if (loop) this.hint('letgo', 'Hold on! Let go when the rope is gold.');
  }
  // Let go of a swinging rope: a short hop onto the far stand, back onto your own, or a splash into the sea under the rope
  letGo() {
    const s = this.swing, p = this.game.player;
    if (!s || !this.mover) return;
    const how = letGo(s.path, this.mover.clock), far = s.from === 'a' ? s.r.b : s.r.a, back = s.from === 'a' ? s.r.a : s.r.b;
    const to = how === 'far' ? far.pos : how === 'back' ? back.pos : ropeDrop(this.world, s.r, [p.pos.x, p.pos.z]) ?? back.pos;
    this.mover.leave(false);
    this.swing = null;
    if (this.held?.kind === 'rope') this.held = null;
    const from = [p.pos.x, p.pos.y, p.pos.z], dist = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const path = makePath({ kind: 'arc', from, to: [...to], height: 0.4, time: LETGO.hop + dist / 20 });
    this.mover = new Mover({ path, run: 'ride', canLeave: false, onEnd: () => this.landed(s.r.id, to, true) });
    this.mover.board(p);
  }
  landed(id, at, rope = false, missed = false) {
    this.carrying = null; this.mover = null;
    if (!rope && !missed) { this.puff(at[0], at[1] + 0.3, at[2], false, 3); sound.play('place'); }
  }
  // a deck cannon: a ball at the rowboats (it does not carry you)
  shoot(g) {
    if (this.ball || this.clock - this.reloadAt < ROWBOATS.reload) return;
    const { shot } = this.shotNow(g); // (with the power of the hold: call it before `held` is cleared)
    sound.play('cannonboom');
    this.kickAt = this.clock; this.kickId = g.gi; this.reloadAt = this.clock;
    this.puff(shot.spec.from[0], shot.spec.from[1], shot.spec.from[2], false, 3);
    this.ball = { path: makePath(shot.spec), t: 0, to: shot.to, gi: g.gi };
  }
  ballLands() {
    const b = this.ball, game = this.game;
    this.ball = null; this.ballMesh.visible = false;
    const i = boatHit(game, b.to, this.boatT);
    this.puff(b.to[0], 13.3, b.to[2], i >= 0, i >= 0 ? 8 : 2);
    sound.play('seasplash');
    if (i < 0) return;
    game.beaten.push(boatKey(i)); game.save?.();
    this.sinking[i] = this.boatT;
    const { sunk, need, done } = boatState(game);
    sound.play(done ? 'win' : 'keyfound');
    game.ui.toast(done ? `🚣 ${sunk} / ${need}! Now battle the Captain!` : `🚣 ${sunk} / ${need}`);
  }
  // after a won Captain battle his crew rows new boats out: a rematch needs them sunk again (like the Ball Stadium's goals)
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.picture?.id !== 'pirate' || opts.picture.crew != null) return;
    const g = this.game;
    ROWBOATS.boats.forEach((_, i) => { const k = g.beaten.indexOf(boatKey(i)); if (k >= 0) g.beaten.splice(k, 1); });
    this.sinking = {};
  }

  /* ---------- the preview dots, the boats ---------- */
  drawDots() {
    const d = this.dummy, pv = this.preview, path = pv && makePath(pv.spec);
    for (let i = 0; i < DOTS; i++) {
      if (!path) { d.position.set(0, -50, 0); d.scale.set(0, 0, 0); } else {
        const last = i === DOTS - 1, w = path.at(path.time * (0.15 + (0.85 * i) / (DOTS - 1)));
        if (last) { d.position.set(w.x, Math.max(w.y, 13) + 0.06, w.z); d.scale.set(6, 0.3, 6); } // a flat marker where you (or the ball) will land
        else { d.position.set(w.x, w.y + (pv.ball ? 0 : 0.9), w.z); d.scale.setScalar(1); }
      }
      d.rotation.set(0, 0, 0); d.updateMatrix();
      this.dots.setMatrixAt(i, d.matrix); this.dots.setColorAt(i, pv?.gold ? GOLD : WHITE);
    }
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
  }
  drawBoats() {
    const d = this.dummy, g = this.game;
    ROWBOATS.boats.forEach((_, i) => {
      const gone = g.beaten?.includes(boatKey(i)), since = this.sinking[i] != null ? this.boatT - this.sinking[i] : Infinity;
      const b = boatAt(i, gone ? this.sinking[i] ?? 0 : this.boatT), k = Math.min(1, since / ROWBOATS.sink);
      if (gone && k >= 1) { d.position.set(0, -50, 0); d.scale.set(0, 0, 0); } else {
        d.position.set(b.x, 13.05 + Math.sin(this.boatT * 2 + i) * 0.06 - (gone ? k * 1.6 : 0), b.z);
        d.rotation.set(gone ? k * 0.9 : Math.sin(this.boatT * 1.6 + i) * 0.05, b.yaw, 0, 'YXZ'); d.scale.set(1, 1, 1);
      }
      d.updateMatrix();
      this.hulls.setMatrixAt(i, d.matrix); this.sails.setMatrixAt(i, d.matrix);
    });
    this.hulls.instanceMatrix.needsUpdate = true; this.sails.instanceMatrix.needsUpdate = true;
  }

  /* ---------- the clock ---------- */
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    const run = !!g.playing?.() && !g.inBattle;
    if (run) {
      this.clock += dt; this.boatT += dt;
      if (this.mover) this.mover.update(dt);
      for (const c of this.data.cannons) this.aimT[c.id] = (this.aimT[c.id] ?? 0) + dt * AIM.slower[this.misses[c.id] ?? 0];
      if (this.swing?.path.loop && this.mover && this.mover.clock >= LETGO.swings * 2 * this.swing.path.time) this.letGo(); // nobody pressed: back where you started
      if (this.ball) {
        this.ball.t += dt;
        if (this.ball.t >= this.ball.path.time) this.ballLands();
        else { const w = this.ball.path.at(this.ball.t); this.ballMesh.position.set(w.x, w.y, w.z); this.ballMesh.visible = true; }
      }
    }
    // the barrels: island cannons swing, a deck cannon turns your way while you stand at it
    const gad = run && !this.carrying ? this.gadget() : null;
    this.guns.forEach((c, i) => {
      if (i === this.kickId) return;
      const can = this.data.cannons.find(q => q.id === c.id);
      const dir = can ? can.dir + this.offOf(can) : gad?.kind === 'deck' && gad.gi === i ? deckShot(gad.at, p.yaw).a : c.dir;
      if (Math.abs(dir - (c.aim ?? c.dir)) > 1e-4) this.placeGun(i, 0, dir);
    });
    // the dots: where you would land (or where the ball would), gold when it is a hit
    if (this.held?.kind === 'deck' && gad?.kind !== 'deck') this.held = null; // walked off the step while holding
    this.preview = null;
    if (gad && gad.kind === 'cannon') {
      const s = this.shotNow(gad);
      this.preview = { spec: s.spec, gold: s.hit, ball: false };
      if (!gad.c.home && !this.steady) this.hint('aim', 'Fire when the dots are gold!');
    } else if (gad?.kind === 'deck') { // the dots only while Fire! is held (they show how far it goes)
      if (this.held) { const s = this.shotNow(gad); this.preview = { spec: s.spec, gold: s.hit >= 0, ball: true }; }
      if (!boatState(g).done) this.hint('deck', 'Hold Fire! Let go when the dots are gold.');
    }
    this.drawDots(); this.drawBoats();
    // the barrel kicks back after a shot
    if (this.kickId != null) {
      const k = (this.clock - this.kickAt) / PIRATE.kick, dir = this.guns[this.kickId].aim;
      if (k >= 1) { this.placeGun(this.kickId, 0, dir); this.kickId = null; } else this.placeGun(this.kickId, 0.35 * Math.sin(Math.PI * k), dir);
    }
    this.updateRopes(run ? dt : 0);
    this.drawPuffs();
    // the sea: a splash and a hint, a rope ladder hint
    const wet = !p.carry && p.inWater;
    if (wet && !this.wasWater && this.clock - this.splashAt > 1) {
      this.splashAt = this.clock; sound.play('seasplash');
      this.puff(p.pos.x, 13.4, p.pos.z, false, 2);
      this.hint('splash', 'Splash! Swim to a beach or a rope ladder. Jump to climb out.');
    }
    this.wasWater = wet;
    if (!p.carry && this.world.liftAt?.(p.pos)) this.hint('ladder', 'A rope ladder! Up you go.');
    if (this.gadget()?.kind === 'rope') this.hint('rope', 'Swing across! Stand at the post and press Swing!');
    // the chest, drawn from your stars every 0.25 s
    this.chestClock += dt;
    if (this.chestClock >= 0.25) { this.chestClock = 0; this.syncChest(); }
    this.cells.flush();
  }
  hint(key, text) {
    if (this.told.has(key)) return;
    this.told.add(key);
    this.game.ui.toast(text);
  }
  syncChest() {
    const w = this.world, c = w.starChest;
    if (!c) return;
    const open = this.game.stars.includes('pirate');
    if (open && this.chest === 'closed') { // the star "came out of the chest"
      this.puff(c[0] + 0.5, c[1] + 1.2, c[2] + 0.5, true, 12);
      sound.play('keyfound');
    }
    this.chest = open ? 'open' : 'closed';
    this.cells.want(c[0], c[1], c[2], open ? B.BIG_CHEST_OPEN : B.BIG_CHEST);
  }
  info() {
    return { carrying: this.carrying, t: this.mover ? this.mover.clock : 0, chest: this.chest, clock: this.clock, meshes: this.meshes.length, told: [...this.told],
      swinging: !!this.swing, ball: !!this.ball, held: this.held?.kind ?? null, power: this.power(), boatT: this.boatT, preview: this.preview && { gold: this.preview.gold, to: this.preview.spec.to }, misses: { ...this.misses } };
  }

  dispose() {
    if (this.mover) this.mover.leave(false);
    this.mover = null; this.carrying = null; this.swing = null; this.ball = null; this.held = null;
    for (const m of this.meshes) { this.game.scene.remove(m); m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); }
    this.meshes = [];
  }
}
const GOLD = new THREE.Color(1, 0.84, 0.25), SMOKE = new THREE.Color(0.85, 0.85, 0.88), WHITE = new THREE.Color(1, 1, 1), ROPE = new THREE.Color(0xb48a50);
