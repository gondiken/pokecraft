// T40d: the live part of Playland's Ball Stadium (LIVE.stadium, made by gymLive.reset for the part in world.parts).
// Two balls (a football on the pitch, a basketball on the court) that are this player's own meshes (never blocks, never saved or
// sent: every player kicks their own ball), two goalkeepers walking on the football's clock, goals (saved at once as `beaten`
// keys pw:stadium:goal1..5), baskets (a few bonus cubes), the words, and the guide arrow. The physics are in ballphysics.js.
// Owner 2026-10-26, "a real skill": Kick! and Shoot! are held and let go (gymLive `press` / `release`): the kick's power is how
// long you hold (a ring fills round the ball; green = a hard low drive, past it = over the bar), the shot is good when you let go at
// the top of the jump that Shoot! starts (the ball glows then). Keepers dive at a shot; every goal or basket makes the next harder.
import * as THREE from 'three';
import { Ball, BALL, BALL_COURT, touchKick, canBoot, boot, shotTo, keeperAt, diveAt, DIVE, HOLD, kickZone, kickPower, shotWindow, shotMiss } from './ballphysics.js';
import { goalOf, basketCross, inBox, goalState, goalKey, basketKey, GOALS, SCORE_IDS, stageOf, BALL_R, SHOT, shootable, STADIUM } from './stadium.js';
import { buildPerson } from './npc.js';
import { bossOf } from './pictureboss.js';
import { disposeModel } from './species.js';
import { sound } from './sound.js';
import { kindHelp } from './kindhelp.js';

const KEEPER_REACH = 2.9; // a keeper stays 0.4 inside each post (the walk's own reach, KEEPER.A)
export const LIVE_RULES = { clearOut: 1.2, sleepDist: 60, goalPause: 1.5, outPause: 0.8, highY: 12.5, highFor: 1, bonusMax: 3, saveGap: 4, soundGap: 0.15 };

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
    this.misses = { foot: 0, hoop: 0 }; // kicks put back without a goal / shots that did not go in, in a row (the kind help, kindhelp.js)
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
    // owner 2026-10-26: Defender Dee on the pitch, Blocker Bo on the court (plain people, never blocks; local like the balls)
    const person = def => { const m = buildPerson(def.colors, { look: 'sport' }); this.parts.push(m); scene?.add(m); return m; };
    this.dee = { x: part.ballSpot[0], z: part.ballSpot[2] + 3, rest: 0, told: -99, moving: false, mesh: person(STADIUM.defender) };
    this.bo = { x: part.courtSpot[0] + 2, z: part.courtSpot[2], jump: 0, told: -99, moving: false, mesh: person(STADIUM.blocker) };
    this.held = null;        // a Kick! or Shoot! being held: { key, t0, apex?, d? }
    this.dives = part.keepers.map(() => null);
    this.clearedAt = null;   // Dee kicked it out (foot.time)
    this.touched = false;    // you touched the football since it was last put on the centre spot (then Dee chases it)
    this.wild = false;       // the football was over-hit: it can't score until somebody touches it again
    this.overAt = null;
    this.ring = this.chargeRing(); // the power ring round the football (only shown while Kick! is held)
    this.rivals = true; // Dee and Bo play (tests switch them off to check the plain ball rules)
    this.t = 0;
    this.drawAll();
  }

  chargeRing() {
    const flat = g => g.rotateX(-Math.PI / 2), mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
    const back = new THREE.Mesh(flat(new THREE.RingGeometry(0.6, 0.8, 48)), mat(0x000000, 0.35));
    const fill = new THREE.Mesh(flat(new THREE.RingGeometry(0.6, 0.8, 48, 1)), mat(0xffffff, 0.9));
    const zone = new THREE.Mesh(flat(new THREE.RingGeometry(0.83, 0.95, 48, 1)), mat(0x40e060, 0.9));
    const g = new THREE.Group(); g.add(back, fill, zone); g.visible = false; g.userData.charge = true;
    this.parts.push(g); this.scene?.add(g);
    return { g, fill, zone };
  }

  shadow() {
    return new THREE.Mesh(new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  }

  dispose() {
    this.game.ui?.setScore?.(null);
    for (const o of this.parts) {
      this.scene?.remove(o);
      o.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
    }
    this.parts = [];
  }

  /* ---- helpers ---- */
  get hard() { return this.game.stars.includes('stadium'); }
  get goalsIn() { const st = goalState(this.game); return stageOf(st.n, st.need); }   // how hard the next goal / basket is (0..2): goals and baskets already in make it harder
  get basketsIn() { const st = goalState(this.game); return stageOf(st.b, st.bneed); }
  // The shared kind help (owner 2026-10-28: only ever so slightly easier after a few misses in a row): football = Dee and the keepers'
  // dives x slow and the green of the power ring x more round its middle; basketball = the good moment of a shot x more.
  helpOf(key) { return kindHelp(this.misses[key]); }
  zoneNow() { const [lo, hi] = kickZone(this.goalsIn, this.hard), m = (lo + hi) / 2, h = ((hi - lo) / 2) * this.helpOf('foot').more; return [m - h, m + h]; }
  windowNow(d) { return shotWindow(this.basketsIn, d, this.hard) * this.helpOf('hoop').more; }
  toast(m) { this.game.ui.toast(m); }
  frozen() { const g = this.game; return !!(g.inBattle || g.ui.asking || g.ui.panelOpen || !this.playing()); }
  playerBox(p = this.game.player) {
    return { x: p.pos.x, y: p.pos.y, z: p.pos.z, vx: p.vel.x, vz: p.vel.z, yaw: p.yaw, halfW: 0.3, height: 1.8 };
  }
  keeperAt(i, t) { return diveAt(this.part.keepers[i], t, this.hard, this.dives[i]); }
  keeperBoxes(t) { return this.part.keepers.map((k, i) => { const b = this.keeperAt(i, t).box; b.id = i; return b; }); }

  /* ---- every frame ---- */
  update(dt) {
    if (this.frozen()) { this.held = null; this.drawAll(); return; }
    const g = this.game, part = this.part, pl = this.playerBox();
    this.t += dt;
    this.updateHold(pl);
    for (const key of ['foot', 'hoop']) {
      const b = this[key];
      if (this.held?.key === 'hoop' && key === 'hoop') { this.carry(b); continue; } // the basketball is in your hands
      const far = Math.hypot(b.pos.x - pl.x, b.pos.z - pl.z) > LIVE_RULES.sleepDist;
      if (far && b.restFor > 0.2) continue; // a ball at rest far away costs nothing
      if (key === 'hoop') this.hoopPrevY = b.pos.y;
      if (touchKick(b, pl) === 'kick') { this.noise(b, 'ballkick'); if (key === 'foot') { this.wild = false; this.touched = true; } }
      b.update(dt, key === 'foot' ? t => this.keeperBoxes(t) : () => [this.blockerBox()]);
      for (const ev of b.events) {
        if (ev.kind === 'keeper' && key === 'foot') this.saved(ev, b);
        else if (ev.kind === 'keeper' && key === 'hoop') this.blocked(b);
        else if (ev.speed > 3) this.noise(b, 'ballkick');
      }
    }
    this.moveDefender(dt);
    this.moveBlocker(dt);
    // the keepers: walk their sine, dive at a shot
    this.dive();
    part.keepers.forEach((k, i) => { this.keeperPos[i] = this.keeperAt(i, this.foot.time); });
    // a goal (an over-hit ball goes over the bar instead)
    if (this.overAt != null) {
      if (this.foot.time - this.overAt > LIVE_RULES.outPause) { this.foot.reset(); this.misses.foot++; this.overAt = null; this.wild = false; this.touched = false; this.clearedAt = null; }
    } else if (this.goalAt == null) {
      if (this.wild && part.goals.some(gl => (gl.side < 0 ? this.foot.pos.x < gl.line - BALL_R : this.foot.pos.x > gl.line + BALL_R))) {
        this.overAt = this.foot.time; this.toast('Too much power! It flew over the bar. Let go sooner!');
      } else if (goalOf(part, this.foot.pos) >= 0) this.goal();
    } else if (this.foot.time - this.goalAt > LIVE_RULES.goalPause) {
      this.foot.reset(); this.goalAt = null; this.touched = false; this.clearedAt = null; sound.play('whistle');
    }
    // the ball left the pitch or the court, or sits on a roof
    this.checkOut('foot', part.pitchBox);
    this.checkOut('hoop', part.courtBox);
    // a basket
    if (basketCross(part, this.hoopPrevY, this.hoop.pos)) this.basket();
    this.showScore(pl);
    if (!this.told && inBox(part.area, { x: pl.x, y: pl.y, z: pl.z })) {
      this.told = true;
      this.toast(`The Ball Stadium! Run into the ball, or hold ${document.body.classList.contains('touch') ? 'Kick!' : 'E'} and let go to kick!`);
    }
    this.drawAll();
  }

  // On the pitch or the court: the goals and baskets for the Captain in the top corner (owner 2026-10-26). After a won Boss battle
  // the keys are cleared, so it reads 0/5 again (every battle needs a new 5 + 5).
  scoreText() {
    const st = goalState(this.game);
    return { text: `⚽ ${Math.min(st.n, st.need)}/${st.need} · 🏀 ${Math.min(st.b, st.bneed)}/${st.bneed}${st.done ? ` · ${this.next(st)}` : ''}`, done: st.ready };
  }
  // What comes after the goals and baskets: the helpers not beaten yet (owner 2026-10-27), then the Captain.
  next(st) { return st.crew.length ? `Battle ${st.crew.map(i => bossOf('stadium').crew[i].name.split(' ').at(-1)).join(' and ')}!` : 'Battle the Captain!'; }
  showScore(pl) {
    const on = b => pl.x > b.x0 && pl.x < b.x1 && pl.z > b.z0 && pl.z < b.z1;
    const show = on(this.part.pitchBox) || on(this.part.courtBox);
    if (show || this.scoreOn) this.game.ui.setScore?.(show ? this.scoreText() : null); // (T43: only clear what this part set; the Funfair has a chip of its own)
    this.scoreOn = show;
  }

  noise(b, name) {
    if (this.t - this.lastSound < LIVE_RULES.soundGap) return;
    this.lastSound = this.t;
    sound.play(name);
  }

  /* ---- Defender Dee: once you touch the football he runs at it, anywhere on the pitch, and kicks it out over the nearer sideline ---- */
  // (owner 2026-10-26: "he should go after the ball from the beginning"). An untouched ball on the centre spot he leaves alone.
  moveDefender(dt) {
    const D = STADIUM.defender, d = this.dee, b = this.foot, home = this.part.ballSpot, box = this.part.pitchBox;
    if (!this.rivals) { d.x = home[0]; d.z = home[2] + 3; d.moving = false; return; }
    const chase = this.touched && this.goalAt == null && this.outAt.foot == null && this.overAt == null && d.rest <= 0;
    if (d.rest > 0) d.rest -= dt;
    const tx = chase ? b.pos.x : home[0], tz = chase ? b.pos.z : home[2] + 3;
    const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz), step = (D.speed[Math.min(2, this.goalsIn)] + (this.hard ? D.hardAdd : 0)) * this.helpOf('foot').slow * dt;
    d.moving = dist > 0.2 && d.rest <= 0;
    if (d.moving) { const k = Math.min(1, step / dist); d.x += dx * k; d.z += dz * k; d.yaw = Math.atan2(dx, dz); }
    if (!chase || dist > D.reach || b.pos.y > home[1] + 1.2) return;
    const mid = (box.z0 + box.z1) / 2, side = b.pos.z < mid ? -1 : b.pos.z > mid ? 1 : (this.game.player.pos.z < mid ? 1 : -1); // away from the middle (or from you)
    boot(b, { x: (home[0] - b.pos.x) * 0.08, y: D.up, z: side * D.kick });
    d.rest = D.rest;
    this.clearedAt = b.time; // up into the stands: out a moment later, whatever it bounces off
    this.wild = false;
    this.noise(b, 'ballkick');
    if (this.t - d.told > 6) { d.told = this.t; this.toast(`${D.name} kicked it out! Keep it away from him!`); }
  }

  /* ---- Blocker Bo: guards the basketball between it and the hoop, and jumps ---- */
  moveBlocker(dt) {
    const K = STADIUM.blocker, o = this.bo, p = this.hoop.pos, box = this.part.courtBox;
    const h = [...this.part.hoops].sort((a, c) => Math.hypot(a.hole[0] - p.x, a.hole[1] - p.z) - Math.hypot(c.hole[0] - p.x, c.hole[1] - p.z))[0];
    let hx = h.hole[0] - p.x, hz = h.hole[1] - p.z;
    const hl = Math.hypot(hx, hz) || 1, g = Math.min(K.guard, hl * 0.5);
    const tx = Math.min(box.x1 - 1, Math.max(box.x0 + 1, p.x + hx / hl * g)), tz = Math.min(box.z1 - 1, Math.max(box.z0 + 1, p.z + hz / hl * g));
    const dx = tx - o.x, dz = tz - o.z, dist = Math.hypot(dx, dz), step = K.speed * dt;
    o.moving = dist > 0.2;
    if (o.moving) { const k = Math.min(1, step / dist); o.x += dx * k; o.z += dz * k; }
    o.yaw = Math.atan2(p.x - o.x, p.z - o.z);
    const P = this.hard ? K.hardPeriod : K.period, ph = (this.t % P) / P;
    o.jump = ph < 0.45 ? K.up * Math.sin(Math.PI * ph / 0.45) : 0;
  }
  blockerBox() {
    const K = STADIUM.blocker, o = this.bo, y = this.part.courtSpot[1] - BALL_R - 0.001 + o.jump + (this.rivals ? 0 : 99);
    return { x0: o.x - K.half, x1: o.x + K.half, y0: y, y1: y + K.height, z0: o.z - K.half, z1: o.z + K.half, v: { x: 0, y: 0, z: 0 }, id: 'bo' };
  }
  blocked(b) {
    this.noise(b, 'ballkick');
    if (this.t - this.bo.told > 4) { this.bo.told = this.t; this.toast(`Blocked by ${STADIUM.blocker.name}! Shoot when he lands.`); }
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
    this.goalAt = this.foot.time; this.misses.foot = 0;
    sound.play('goalcheer');
    const { n: before, need } = goalState(g);
    let n = before;
    if (before < need) {
      const key = SCORE_IDS.map(goalKey).find(k => !g.beaten.includes(k));
      if (key) { g.beaten.push(key); n++; g.save?.(); }
    }
    if (before >= need) this.toast('GOAL! What a shot!');
    else if (goalState(g).done) this.toast(`GOAL! ⚽ ${need} of ${need}! ${this.wants(goalState(g))}`);
    else if (n >= need) this.toast(`GOAL! ⚽ ${need} of ${need}! Now ${goalState(g).bneed} baskets on the court.`);
    else this.toast(`GOAL! ⚽ ${n} of ${need}`);
  }

  checkOut(key, box) {
    const b = this[key], p = b.pos;
    const cleared = key === 'foot' && this.clearedAt != null && b.time - this.clearedAt > LIVE_RULES.clearOut;
    const out = cleared || p.x < box.x0 || p.x > box.x1 || p.z < box.z0 || p.z > box.z1 || (b.onGround && b.restFor >= LIVE_RULES.highFor && p.y > LIVE_RULES.highY);
    if (key === 'foot' && this.goalAt != null) { this.outAt.foot = null; return; }
    if (!out) { this.outAt[key] = null; return; }
    if (this.outAt[key] == null) { this.outAt[key] = b.time; if (key === 'foot' && !cleared) this.toast('Out! The ball goes back to the middle.'); else this.toast('Out! The ball goes back to the middle of the court.'); return; }
    if (b.time - this.outAt[key] > LIVE_RULES.outPause) { b.reset(); this.outAt[key] = null; if (key === 'foot') { if (this.touched) this.misses.foot++; this.touched = false; this.clearedAt = null; } }
  }

  wants(st) { return st.ready ? 'Captain Kickley wants to battle you!' : `Now ${this.next(st).replace('Battle', 'battle')}`; }

  basket() {
    const g = this.game;
    sound.play('netswish'); this.misses.hoop = 0;
    const st = goalState(g); // owner 2026-10-26: the captain wants baskets too (saved at once, like goals)
    let counted = '';
    if (st.b < st.bneed) {
      const key = SCORE_IDS.map(basketKey).find(k => !g.beaten.includes(k));
      if (key) { g.beaten.push(key); g.save?.(); const now = goalState(g); counted = now.done ? ` ${now.bneed} of ${now.bneed}! ${this.wants(now)}` : ` ${now.b} of ${now.bneed}`; }
    }
    if (this.bonus < LIVE_RULES.bonusMax) {
      this.bonus++; g.cubes++; g.ui.renderHud?.();
      this.toast(`Swish! 🏀${counted} +1 Capture Cube`);
    } else this.toast(`Swish! 🏀${counted}`);
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
  near(p) { return this.frozen() ? null : this.held ? (this.held.key === 'foot' ? 'Kick!' : 'Shoot!') : this.nearest(p)?.word ?? null; }
  holds(p) { return !this.frozen() && (!!this.held || !!this.nearest(p)); } // the big button presses and lets go here (touch.js)
  use(p) { return this.press(p); }
  // Kick! / Shoot! pressed: the hold starts (a Shoot! jumps you). Nothing flies until it is let go (release) or held too long.
  press(p) {
    if (this.frozen()) return false;
    if (this.held) return true; // a key repeat
    const n = this.nearest(p);
    if (!n) return false;
    this.held = { key: n.key, t0: this.t };
    if (n.key === 'foot') this.touched = true; // Dee starts running at it
    const told = this.game.toldOnce, hint = n.key === 'foot' ? 'kickring' : 'shootjump';
    if (told && !told.has(hint)) { told.add(hint); this.toast(n.key === 'foot' ? 'Let go when the ring is green! Too long and it flies over the bar.' : 'Let go at the top of your jump, when the ball shines!'); }
    if (n.key === 'hoop') {
      const pl = this.game.player, g = 28 * (this.game.world.gravity ?? 1);
      if (pl.onGround) { pl.vel.y = HOLD.hoop.jump; pl.onGround = false; }
      this.held.apex = this.t + Math.max(-1, pl.vel.y / g); // the top of the jump
      this.carry(this.hoop);
    }
    return true;
  }
  // Let go: the kick or the shot.
  release(p = this.game.player) {
    const h = this.held;
    if (!h) return false;
    this.held = null;
    if (this.frozen()) return true;
    const pl = this.playerBox(p), f = [-Math.sin(pl.yaw), -Math.cos(pl.yaw)];
    if (h.key === 'foot') {
      if (!canBoot(this.foot, pl)) return true; // it rolled away while you held
      const v = kickPower(Math.min(HOLD.foot.max, this.t - h.t0) / HOLD.foot.fill, this.foot.pos, f, this.zoneNow(), this.part.goals.map(gl => ({ x: gl.line })));
      boot(this.foot, v);
      this.wild = v.kind === 'over';
      this.lastKick = v.kind;
    } else {
      const err = this.t - h.apex, d = this.hoopDist(f);
      const miss = d == null ? 0 : shotMiss(err, this.windowNow(d));
      this.misses.hoop++; // (a basket sets it back to 0)
      boot(this.hoop, this.shoot(f, miss));
      this.lastShot = { err, miss };
    }
    this.noise(this[h.key], 'ballkick');
    return true;
  }
  // While held: Kick! lets go by itself when held far too long; Shoot! when you land again.
  updateHold(pl) {
    const h = this.held;
    if (!h) return;
    if (h.key === 'foot' && this.t - h.t0 >= HOLD.foot.max) this.release();
    else if (h.key === 'hoop' && this.game.player.onGround && this.t > h.apex + HOLD.hoop.late) this.release();
  }
  // The held basketball sits above your head, a little in front.
  carry(b) {
    const p = this.game.player, f = [-Math.sin(p.yaw), -Math.cos(p.yaw)];
    b.pos.x = p.pos.x + f[0] * 0.35; b.pos.y = p.pos.y + 2.05; b.pos.z = p.pos.z + f[1] * 0.35;
    b.vel.x = b.vel.y = b.vel.z = 0; b.restFor = 0; b.onGround = false;
  }
  // The hoop a Shoot! goes for: the one you face (3.6..15 away), else the nearer one in front; null = a lob forward.
  pickHoop(f) {
    const p = this.hoop.pos;
    const hs = this.part.hoops.map(h => { const dx = h.hole[0] - p.x, dz = h.hole[1] - p.z, d = Math.hypot(dx, dz); return { h, d, dot: d > 1e-6 ? (f[0] * dx + f[1] * dz) / d : 1 }; })
      .filter(o => o.d >= SHOT.min && o.d <= SHOT.max && shootable(o.h, p));
    return hs.filter(o => o.dot > 0.5).sort((a, b2) => b2.dot - a.dot)[0] ?? hs.filter(o => o.dot > 0).sort((a, b2) => a.d - b2.d)[0] ?? null;
  }
  hoopDist(f) { return this.pickHoop(f)?.d ?? null; }
  // The velocity of a Shoot!: at the hole, or `miss` blocks short (< 0) or long (> 0) of it and a bit to the side.
  shoot(f, miss = 0) {
    const b = this.hoop, p = b.pos, pick = this.pickHoop(f);
    if (!pick) return { x: f[0] * 6, y: 9, z: f[1] * 6 };
    const ux = (pick.h.hole[0] - p.x) / pick.d, uz = (pick.h.hole[1] - p.z) / pick.d, side = Math.abs(miss) * HOLD.hoop.side;
    const target = { x: pick.h.hole[0] + ux * miss - uz * side, y: pick.h.rimMid, z: pick.h.hole[1] + uz * miss + ux * side };
    return shotTo(p, target, b.opts.g, 2, b.opts.h, { d: SHOT.rim, y: pick.h.rimMid + SHOT.clear }).v;
  }
  // A shot is coming at a keeper's goal: he dives to where it will cross the line (a new dive when the ball's line changes).
  dive() {
    const b = this.foot, t = b.time, hv = Math.hypot(b.vel.x, b.vel.z);
    this.part.keepers.forEach((k, i) => {
      const toward = k.side < 0 ? b.vel.x < 0 && b.pos.x > k.x : b.vel.x > 0 && b.pos.x < k.x;
      if (!toward || hv < DIVE.min || Math.abs(k.x - b.pos.x) > DIVE.reach || this.goalAt != null) return;
      const zc = b.pos.z + b.vel.z * (k.x - b.pos.x) / b.vel.x;
      if (Math.abs(zc - k.c) > 5.5) return;
      const z1 = Math.max(k.c - KEEPER_REACH, Math.min(k.c + KEEPER_REACH, zc)), old = this.dives[i];
      if (old && t < old.until && Math.abs(old.z1 - z1) < DIVE.again) return;
      const t0 = t + DIVE.react;
      this.dives[i] = { t0, z0: this.keeperAt(i, t0).z, z1, speed: (DIVE.speed[Math.min(2, this.goalsIn)] + (this.hard ? DIVE.hard : 0)) * this.helpOf('foot').slow, until: t0 + DIVE.hold };
    });
  }

  /* ---- the Captain: the generic Boss `gate` keeps the battle shut; only the button word is ours ---- */
  talkPrompt(npc) {
    if (npc.kind === 'boss' && npc.def?.id === 'stadium' && !goalState(this.game).ready) return { verb: 'talk', action: 'Talk' };
    return null;
  }
  // A won Boss battle (the star, or a rematch): the next match starts at 0 goals. A lost one keeps the goals.
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.picture?.id !== 'stadium' || opts.picture.crew != null) return;
    const g = this.game;
    for (const i of SCORE_IDS) for (const key of [goalKey(i), basketKey(i)]) { const k = g.beaten.indexOf(key); if (k >= 0) g.beaten.splice(k, 1); }
  }

  /* ---- the guide ---- */
  aim(p) {
    const { part } = this, st = goalState(this.game);
    if (!inBox(part.area, { x: p.x, y: 1, z: p.z }) || st.ready) return null;
    if (st.done) { // the goals and baskets are in: now the helpers (owner 2026-10-27)
      const crew = this.game.npcs.list.filter(n => n.kind === 'crew' && n.def?.boss === 'stadium' && st.crew.includes(n.def.index));
      const c = crew.sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z))[0];
      return c ? { x: c.pos.x, z: c.pos.z, text: (a, m) => `Battle ${c.name}! ${a} ${m}m` } : null;
    }
    if (this.hard && st.n === 0 && st.b === 0) return null; // a rematch has not started: the base points at the way back
    if (st.n >= st.need) { // the goals are in: now the baskets
      const h = this.hoop.pos, bl = `(${st.b} / ${st.bneed})`;
      return { x: h.x, z: h.z, text: (a, m) => `🏀 Shoot baskets on the court! ${bl} ${a} ${m}m` };
    }
    const f = this.foot.pos, d = Math.hypot(f.x - p.x, f.z - p.z);
    const label = `(${st.n} / ${st.need})`;
    if (d > 8) return { x: f.x, z: f.z, text: (a, m) => `⚽ Kick the ball into a goal! ${label} ${a} ${m}m` };
    const goals = [...part.goals].sort((a, b) => Math.hypot(a.mid[0] - p.x, a.mid[1] - p.z) - Math.hypot(b.mid[0] - p.x, b.mid[1] - p.z));
    const g = goals[0];
    return { x: g.mid[0], z: g.mid[1], text: (a, m) => `⚽ Kick it into the goal! ${label} ${a} ${m}m` };
  }

  /* ---- drawing ---- */
  // The power ring round the football while Kick! is held; the basketball glows at the top of a Shoot! jump.
  drawHold() {
    const h = this.held, r = this.ring;
    r.g.visible = h?.key === 'foot';
    if (r.g.visible) {
      const b = this.foot, p = Math.min(HOLD.foot.max, this.t - h.t0) / HOLD.foot.fill, [lo, hi] = this.zoneNow();
      r.g.position.set(b.pos.x, b.pos.y - BALL_R + 0.04, b.pos.z);
      r.fill.geometry.setDrawRange(0, 6 * Math.round(48 * Math.min(1, p)));
      r.fill.material.color.setHex(p < lo ? 0xffffff : p <= hi ? 0x40e060 : 0xff4a3a);
      r.zone.geometry.setDrawRange(6 * Math.round(48 * lo), 6 * Math.round(48 * (hi - lo)));
    }
    let glow = 0;
    if (h?.key === 'hoop') { const d = this.hoopDist([-Math.sin(this.game.player.yaw), -Math.cos(this.game.player.yaw)]); if (d != null && Math.abs(this.t - h.apex) <= this.windowNow(d)) glow = 0.55; }
    this.meshes.hoop.material.emissive.setRGB(glow, glow, glow * 0.4);
  }
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
    this.drawHold();
    for (const o of [this.dee, this.bo]) { // the defender and the blocker
      const m = o.mesh, floor = o === this.dee ? this.part.ballSpot[1] - BALL_R - 0.001 : this.part.courtSpot[1] - BALL_R - 0.001;
      m.position.set(o.x, floor + (o.jump || 0), o.z);
      if (o.yaw != null) m.rotation.y = o.yaw;
      for (const l of m.userData.parts.legs) l.g.rotation.x = o.moving ? Math.sin(this.t * 8 + l.phase) * 0.6 : 0;
      for (const a of m.userData.parts.arms) a.g.rotation.x = o === this.bo ? (o.jump > 0.1 ? -2.6 : -0.4) : o.moving ? Math.sin(this.t * 8 + a.phase) * 0.4 : 0;
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
