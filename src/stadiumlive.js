// T40d: the live part of Playland's Ball Stadium (LIVE.stadium, made by gymLive.reset for the part in world.parts).
// Two balls (a football on the pitch, a basketball on the court) that are this player's own meshes (never blocks, never saved or
// sent: every player kicks their own ball), two goalkeepers walking on the football's clock, goals (saved at once as `beaten`
// keys pw:stadium:goal1..3), baskets (a few bonus cubes), the words, and the guide arrow. The physics are in ballphysics.js.
import * as THREE from 'three';
import { Ball, BALL, BALL_COURT, touchKick, canBoot, boot, aimShot, shotTo, keeperAt } from './ballphysics.js';
import { goalOf, basketCross, inBox, goalState, goalKey, GOALS, BALL_R, SHOT, shootable } from './stadium.js';
import { buildPerson } from './npc.js';
import { disposeModel } from './species.js';
import { sound } from './sound.js';

export const LIVE_RULES = { sleepDist: 60, goalPause: 1.5, outPause: 0.8, highY: 12.5, highFor: 1, bonusMax: 3, saveGap: 4, soundGap: 0.15 };

const ICO = (() => { // the 12 directions of a football's black patches
  const f = (1 + Math.sqrt(5)) / 2, out = [];
  for (const a of [-1, 1]) for (const b of [-f, f]) out.push([0, a, b], [a, b, 0], [b, 0, a]);
  return out.map(v => new THREE.Vector3(...v).normalize());
})();

function footballMesh() {
  const geo = new THREE.SphereGeometry(BALL_R, 20, 14), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const black = ICO.some(d => d.dot(v) > 0.945) ? 0.08 : 1;
    col.set([black, black, black], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
function basketballMesh() {
  const geo = new THREE.SphereGeometry(BALL_R, 24, 16), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const seam = Math.abs(v.x) < 0.07 || Math.abs(v.y) < 0.07 || Math.abs(Math.abs(v.z) - 0.7) < 0.06;
    col.set(seam ? [0.06, 0.04, 0.03] : [0.94, 0.48, 0.16], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

export class StadiumLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    const solid = (x, y, z) => this.game.world.isSolid(x, y, z);
    this.foot = new Ball(solid, part.ballSpot, BALL);
    this.hoop = new Ball(solid, part.courtSpot, BALL_COURT);
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.bonus = 0;           // cubes from baskets this trip
    this.goalAt = null;       // foot.time of the goal being celebrated
    this.outAt = { foot: null, hoop: null };
    this.told = false;
    this.lastSave = -99; this.lastSound = -99;
    this.hoopPrevY = this.hoop.pos.y;
    this.keeperPos = part.keepers.map(k => keeperAt(k, 0));
    this.parts = []; // everything added to the scene, removed in dispose()
    const scene = game.scene ?? game.world?.scene;
    this.scene = scene;
    this.meshes = { foot: footballMesh(), hoop: basketballMesh() };
    this.shadows = { foot: this.shadow(), hoop: this.shadow() };
    this.last = { foot: [...part.ballSpot], hoop: [...part.courtSpot] };
    for (const m of [...Object.values(this.meshes), ...Object.values(this.shadows)]) { m.userData.ball = true; this.parts.push(m); scene?.add(m); }
    this.keepers = part.keepers.map((k, i) => {
      const m = buildPerson(k.colors, { look: 'sport' });
      for (const a of m.userData.parts.arms) { // big orange gloves
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.32), new THREE.MeshLambertMaterial({ color: 0xff8a28 }));
        g.position.set(0, -0.66, 0); a.g.add(g);
      }
      m.userData.keeper = i;
      m.rotation.y = k.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.parts.push(m); scene?.add(m);
      return m;
    });
    this.t = 0;
    this.drawAll();
  }

  shadow() {
    return new THREE.Mesh(new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  }

  dispose() {
    for (const o of this.parts) {
      this.scene?.remove(o);
      o.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
    }
    this.parts = [];
  }

  /* ---- helpers ---- */
  get hard() { return this.game.stars.includes('stadium'); }
  toast(m) { this.game.ui.toast(m); }
  frozen() { const g = this.game; return !!(g.inBattle || g.ui.asking || g.ui.panelOpen || !this.playing()); }
  playerBox(p = this.game.player) {
    return { x: p.pos.x, y: p.pos.y, z: p.pos.z, vx: p.vel.x, vz: p.vel.z, yaw: p.yaw, halfW: 0.3, height: 1.8 };
  }
  keeperBoxes(t) { return this.part.keepers.map((k, i) => { const b = keeperAt(k, t, this.hard).box; b.id = i; return b; }); }

  /* ---- every frame ---- */
  update(dt) {
    if (this.frozen()) { this.drawAll(); return; }
    const g = this.game, part = this.part, pl = this.playerBox();
    this.t += dt;
    for (const key of ['foot', 'hoop']) {
      const b = this[key];
      const far = Math.hypot(b.pos.x - pl.x, b.pos.z - pl.z) > LIVE_RULES.sleepDist;
      if (far && b.restFor > 0.2) continue; // a ball at rest far away costs nothing
      if (key === 'hoop') this.hoopPrevY = b.pos.y;
      if (touchKick(b, pl) === 'kick') this.noise(b, 'ballkick');
      b.update(dt, key === 'foot' ? t => this.keeperBoxes(t) : undefined);
      for (const ev of b.events) {
        if (ev.kind === 'keeper' && key === 'foot') this.saved(ev, b);
        else if (ev.speed > 3) this.noise(b, 'ballkick');
      }
    }
    // the keepers
    part.keepers.forEach((k, i) => { this.keeperPos[i] = keeperAt(k, this.foot.time, this.hard); });
    // a goal
    if (this.goalAt == null) {
      const k = goalOf(part, this.foot.pos);
      if (k >= 0) this.goal();
    } else if (this.foot.time - this.goalAt > LIVE_RULES.goalPause) {
      this.foot.reset(); this.goalAt = null; sound.play('whistle');
    }
    // the ball left the pitch or the court, or sits on a roof
    this.checkOut('foot', part.pitchBox);
    this.checkOut('hoop', part.courtBox);
    // a basket
    if (basketCross(part, this.hoopPrevY, this.hoop.pos)) this.basket();
    if (!this.told && inBox(part.area, { x: pl.x, y: pl.y, z: pl.z })) {
      this.told = true;
      this.toast(`The Ball Stadium! Run into the ball, or ${document.body.classList.contains('touch') ? 'tap Kick!' : 'press E to kick!'}`);
    }
    this.drawAll();
  }

  noise(b, name) {
    if (this.t - this.lastSound < LIVE_RULES.soundGap) return;
    this.lastSound = this.t;
    sound.play(name);
  }

  saved(ev, b) {
    const k = this.part.keepers[ev.obs?.id ?? -1];
    if (!k || ev.axis !== 'x' || Math.abs(ev.old) < 2 || (k.side < 0 ? ev.old > 0 : ev.old < 0)) return; // only a ball coming at his goal
    this.noise(b, 'ballkick');
    if (b.time - this.lastSave < LIVE_RULES.saveGap) return;
    this.lastSave = b.time;
    this.toast(`Saved by ${k.name}! Try again!`);
  }

  goal() {
    const g = this.game;
    this.goalAt = this.foot.time;
    sound.play('goalcheer');
    const { n: before, need } = goalState(g);
    let n = before;
    if (before < need) {
      const key = [1, 2, 3].map(goalKey).find(k => !g.beaten.includes(k));
      if (key) { g.beaten.push(key); n++; g.save?.(); }
    }
    if (before >= need) this.toast('GOAL! What a shot!');
    else if (n >= need) this.toast(`GOAL! ⚽ ${need} of ${need}! Captain Kickley wants to battle you!`);
    else this.toast(`GOAL! ⚽ ${n} of ${need}`);
  }

  checkOut(key, box) {
    const b = this[key], p = b.pos;
    const out = p.x < box.x0 || p.x > box.x1 || p.z < box.z0 || p.z > box.z1 || (b.onGround && b.restFor >= LIVE_RULES.highFor && p.y > LIVE_RULES.highY);
    if (key === 'foot' && this.goalAt != null) { this.outAt.foot = null; return; }
    if (!out) { this.outAt[key] = null; return; }
    if (this.outAt[key] == null) { this.outAt[key] = b.time; if (key === 'foot') this.toast('Out! The ball goes back to the middle.'); else this.toast('Out! The ball goes back to the middle of the court.'); return; }
    if (b.time - this.outAt[key] > LIVE_RULES.outPause) { b.reset(); this.outAt[key] = null; }
  }

  basket() {
    const g = this.game;
    sound.play('netswish');
    if (this.bonus < LIVE_RULES.bonusMax) {
      this.bonus++; g.cubes++; g.ui.renderHud?.();
      this.toast('Swish! 🏀 +1 Capture Cube');
    } else this.toast('Swish! 🏀');
  }

  /* ---- Kick! and Shoot! (gymLive near / use hooks) ---- */
  nearest(p) {
    const pl = this.playerBox(p), c = [];
    if (canBoot(this.foot, pl)) c.push(['foot', 'Kick!']);
    if (canBoot(this.hoop, pl)) c.push(['hoop', 'Shoot!']);
    if (!c.length) return null;
    const d = k => Math.hypot(this[k].pos.x - pl.x, this[k].pos.z - pl.z);
    c.sort((a, b) => d(a[0]) - d(b[0]));
    return { key: c[0][0], word: c[0][1], pl };
  }
  near(p) { return this.frozen() ? null : this.nearest(p)?.word ?? null; }
  use(p) {
    if (this.frozen()) return false;
    const n = this.nearest(p);
    if (!n) return false;
    const f = [-Math.sin(n.pl.yaw), -Math.cos(n.pl.yaw)];
    if (n.key === 'foot') boot(this.foot, aimShot(this.foot.pos, f, this.part.goals.map(g => ({ x: g.line, z: g.mid[1], hw: (g.z[1] - g.z[0]) / 2 }))));
    else boot(this.hoop, this.shoot(f));
    this.noise(this[n.key], 'ballkick');
    return true;
  }
  // The velocity of a Shoot!: the hoop you face (1.5..15 away), else the nearer one in front, else a lob forward.
  shoot(f) {
    const b = this.hoop, p = b.pos;
    const hs = this.part.hoops.map(h => { const dx = h.hole[0] - p.x, dz = h.hole[1] - p.z, d = Math.hypot(dx, dz); return { h, d, dot: d > 1e-6 ? (f[0] * dx + f[1] * dz) / d : 1 }; })
      .filter(o => o.d >= SHOT.min && o.d <= SHOT.max && shootable(o.h, p));
    const pick = hs.filter(o => o.dot > 0.5).sort((a, b2) => b2.dot - a.dot)[0] ?? hs.filter(o => o.dot > 0).sort((a, b2) => a.d - b2.d)[0];
    if (!pick) return { x: f[0] * 6, y: 9, z: f[1] * 6 };
    return shotTo(p, { x: pick.h.hole[0], y: pick.h.rimMid, z: pick.h.hole[1] }, b.opts.g, 2, b.opts.h, { d: SHOT.rim, y: pick.h.rimMid + SHOT.clear }).v;
  }

  /* ---- the Captain: the generic Boss `gate` keeps the battle shut; only the button word is ours ---- */
  talkPrompt(npc) {
    if (npc.kind === 'boss' && npc.def?.id === 'stadium' && !goalState(this.game).done) return { verb: 'talk', action: 'Talk' };
    return null;
  }
  // A won Boss battle (the star, or a rematch): the next match starts at 0 goals. A lost one keeps the goals.
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.picture?.id !== 'stadium' || opts.picture.crew != null) return;
    const g = this.game;
    for (let i = 1; i <= 3; i++) { const k = g.beaten.indexOf(goalKey(i)); if (k >= 0) g.beaten.splice(k, 1); }
  }

  /* ---- the guide ---- */
  aim(p) {
    const { part } = this, st = goalState(this.game);
    if (!inBox(part.area, { x: p.x, y: 1, z: p.z }) || st.done) return null;
    if (this.hard && st.n === 0) return null; // a rematch has not started: the base points at the way back
    const f = this.foot.pos, d = Math.hypot(f.x - p.x, f.z - p.z);
    const label = `(${st.n} / ${st.need})`;
    if (d > 8) return { x: f.x, z: f.z, text: (a, m) => `⚽ Kick the ball into a goal! ${label} ${a} ${m}m` };
    const goals = [...part.goals].sort((a, b) => Math.hypot(a.mid[0] - p.x, a.mid[1] - p.z) - Math.hypot(b.mid[0] - p.x, b.mid[1] - p.z));
    const g = goals[0];
    return { x: g.mid[0], z: g.mid[1], text: (a, m) => `⚽ Kick it into the goal! ${label} ${a} ${m}m` };
  }

  /* ---- drawing ---- */
  drawAll() {
    const q = new THREE.Quaternion(), axis = new THREE.Vector3();
    for (const key of ['foot', 'hoop']) {
      const b = this[key], m = this.meshes[key], l = this.last[key];
      m.position.set(b.pos.x, b.pos.y, b.pos.z);
      const dx = b.pos.x - l[0], dz = b.pos.z - l[2], len = Math.hypot(dx, dz);
      if (len > 1e-5 && len < 3) { axis.set(dz, 0, -dx).normalize(); q.setFromAxisAngle(axis, len / BALL_R); m.quaternion.premultiply(q); }
      l[0] = b.pos.x; l[2] = b.pos.z;
      // a shadow on the first solid top under the ball
      let y = Math.floor(b.pos.y - BALL_R);
      const w = this.game.world;
      while (y > 0 && !w.isSolid(Math.floor(b.pos.x), y, Math.floor(b.pos.z))) y--;
      const h = Math.max(0, b.pos.y - BALL_R - (y + 1)), s = this.shadows[key];
      s.position.set(b.pos.x, y + 1.02, b.pos.z);
      s.scale.setScalar(1 / (1 + 0.15 * h));
    }
    this.keepers.forEach((m, i) => {
      const k = this.keeperPos[i];
      m.position.set(k.x, this.part.keepers[i].y, k.z);
      const moving = Math.abs(k.vz) > 0.3;
      m.rotation.y = this.part.keepers[i].side < 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const l of m.userData.parts.legs) l.g.rotation.x = moving ? Math.sin(this.t * 7 + l.phase) * 0.5 : 0;
      for (const a of m.userData.parts.arms) a.g.rotation.x = moving ? Math.sin(this.t * 7 + a.phase) * 0.25 : -0.3;
    });
  }
}

export { GOALS };
