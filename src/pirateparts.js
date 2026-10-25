// T40b: the live parts of the Pirate Seas (LIVE.pirate in gymlive.js, made for the world.parts entry `seas`): the cannons you fire
// yourself from island to island, the ropes you swing on, the big treasure chest, smoke and coin puffs. Everything is per player and
// in memory (never saved or sent). A flight or a swing is a Mover (mover.js) on a closed-form path: the cannon is an `arc`, the rope
// is `PATHS.swing` (registered here, pure code in pirateland.js). The clock only runs while the game is playing (not paused, not in a
// battle), so a pause or a battle freezes a flight.
// Meshes: cannon barrels, cannon wheels, ropes and a pool of puffs: 4 draw calls, all with userData.pirate, removed in dispose().
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { Mover, PATHS, makePath } from './mover.js';
import { swingPath } from './pirateland.js';
import { SHIP } from './pirateship.js';
import { sound } from './sound.js';

PATHS.swing = ({ rope, from }) => swingPath(rope, from);

export const PIRATE = { padReach: 1.5, ropeReach: 1.6, kick: 0.2, puffLife: 0.6 };
const PUFFS = 16;

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
    this.meshes = [];
    this.build();
  }

  /* ---------- meshes ---------- */
  mark(m) { m.userData.pirate = true; m.frustumCulled = false; this.game.scene.add(m); this.meshes.push(m); return m; }
  build() {
    const cannons = this.data.cannons.map(c => ({ id: c.id, x: c.carriage[0] + 0.5, y: c.padTop + 1.0, z: c.carriage[1] + 0.5, dir: c.dir }));
    for (const [x, z, side] of SHIP.decor) cannons.push({ id: `decor-${x}-${z}`, x: x + 0.5, y: SHIP.deck + 1.8, z: z + 0.5, dir: side > 0 ? 0 : Math.PI });
    this.guns = cannons;
    const barrelGeo = new THREE.BoxGeometry(0.46, 0.46, 1.5); barrelGeo.translate(0, 0, 0.5);
    this.barrels = this.mark(new THREE.InstancedMesh(barrelGeo, new THREE.MeshLambertMaterial({ color: 0x2c2e36 }), cannons.length));
    const wheelGeo = new THREE.BoxGeometry(0.16, 0.8, 0.8);
    this.wheels = this.mark(new THREE.InstancedMesh(wheelGeo, new THREE.MeshLambertMaterial({ color: 0x6a4020 }), cannons.length * 2));
    const ropeGeo = new THREE.BoxGeometry(0.12, 1, 0.12); ropeGeo.translate(0, -0.5, 0);
    this.ropes = this.mark(new THREE.InstancedMesh(ropeGeo, new THREE.MeshLambertMaterial({ color: 0xb48a50 }), this.data.ropes.length));
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
    cannons.forEach((c, i) => this.placeGun(i, 0));
    this.updateRopes(0);
    this.drawPuffs();
  }
  dummy = new THREE.Object3D();
  placeGun(i, back) {
    const c = this.guns[i], d = this.dummy;
    d.position.set(c.x - Math.sin(c.dir) * back, c.y + 0.1, c.z - Math.cos(c.dir) * back);
    d.rotation.set(-0.42, c.dir, 0, 'YXZ');
    d.scale.set(1, 1, 1);
    d.updateMatrix();
    this.barrels.setMatrixAt(i, d.matrix);
    for (const s of [-1, 1]) {
      d.position.set(c.x + Math.cos(c.dir) * 0.38 * s, c.y - 0.2, c.z - Math.sin(c.dir) * 0.38 * s);
      d.rotation.set(0, c.dir, 0);
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
      if (this.swing?.i === i) { this.placeRope(i, r.anchor, [p.pos.x, p.pos.y + 1.6, p.pos.z]); return; }
      const da = Math.hypot(p.pos.x - r.a.pos[0], p.pos.z - r.a.pos[2]), db = Math.hypot(p.pos.x - r.b.pos[0], p.pos.z - r.b.pos[2]);
      const want = da <= db ? 0 : 1;
      this.hang[i] += Math.sign(want - this.hang[i]) * Math.min(Math.abs(want - this.hang[i]), dt / 0.6);
      const k = this.hang[i], mx = (r.a.pos[0] + r.b.pos[0]) / 2, mz = (r.a.pos[2] + r.b.pos[2]) / 2;
      // idle: the rope's end hangs beside the stand it is nearer to, at hand height, swinging gently
      const ex = r.a.pos[0] + (r.b.pos[0] - r.a.pos[0]) * k, ez = r.a.pos[2] + (r.b.pos[2] - r.a.pos[2]) * k;
      const toward = [(mx - ex) * 0.12, (mz - ez) * 0.12], sway = Math.sin(this.clock * 1.7 + i) * 0.12;
      this.placeRope(i, r.anchor, [ex + toward[0] + sway, r.feet + 1.4, ez + toward[1]]);
    });
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
    return best;
  }
  // the short word for the big action button / E prompt (gymLive.near)
  near() {
    if (!this.game.playing?.()) return null;
    const g = this.gadget();
    return g ? (g.kind === 'cannon' ? 'Fire!' : 'Swing!') : null;
  }
  use() {
    const g = this.gadget();
    if (!g || !this.game.playing?.()) return false;
    if (g.kind === 'cannon') this.fire(g.c); else this.swingOn(g.r, g.from);
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
    const p = this.game.player;
    this.game.riding?.stop('quiet');
    const path = makePath(c.spec);
    p.yaw = path.at(0.2).yaw; p.pitch = Math.max(p.pitch, -0.2);
    sound.play('cannonboom');
    const gi = this.guns.findIndex(g => g.id === c.id);
    this.kickAt = this.clock; this.kickId = gi;
    this.puff(this.guns[gi].x + Math.sin(c.dir) * 1.6, this.guns[gi].y + 0.5, this.guns[gi].z + Math.cos(c.dir) * 1.6, false, 3);
    this.mover = new Mover({ path, run: 'ride', canLeave: false, onEnd: () => this.landed(c.id, c.E) });
    this.carrying = c.id;
    this.mover.board(p);
  }
  swingOn(r, from) {
    const p = this.game.player;
    this.game.riding?.stop('quiet');
    const path = makePath({ kind: 'swing', rope: { a: r.a.pos, b: r.b.pos }, from });
    sound.play('whoosh');
    this.swing = { i: this.data.ropes.indexOf(r) };
    this.mover = new Mover({ path, run: 'ride', canLeave: false, onEnd: () => { this.swing = null; this.landed(r.id, from === 'a' ? r.b.pos : r.a.pos, true); } });
    this.carrying = r.id;
    this.mover.board(p);
  }
  landed(id, at, rope = false) {
    this.carrying = null; this.mover = null;
    if (!rope) { this.puff(at[0], at[1] + 0.3, at[2], false, 3); sound.play('place'); }
  }

  /* ---------- the clock ---------- */
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    const run = !!g.playing?.() && !g.inBattle;
    if (run) {
      this.clock += dt;
      if (this.mover) this.mover.update(dt);
    }
    // the barrel kicks back after a shot
    if (this.kickId != null) {
      const k = (this.clock - this.kickAt) / PIRATE.kick;
      if (k >= 1) { this.placeGun(this.kickId, 0); this.kickId = null; } else this.placeGun(this.kickId, 0.35 * Math.sin(Math.PI * k));
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
  info() { return { carrying: this.carrying, t: this.mover ? this.mover.clock : 0, chest: this.chest, clock: this.clock, meshes: this.meshes.length, told: [...this.told] }; }

  dispose() {
    if (this.mover) this.mover.leave(false);
    this.mover = null; this.carrying = null;
    for (const m of this.meshes) { this.game.scene.remove(m); m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); }
    this.meshes = [];
  }
}
const GOLD = new THREE.Color(1, 0.84, 0.25), SMOKE = new THREE.Color(0.85, 0.85, 0.88);
