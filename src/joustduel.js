// The Joust for two (owner 2026-11-28): a game for two friends (friendgames.js) in the Castle's Tilt Yard. Both ride the castle's steeds
// down the two lanes at each other (the one who asked on the west lane, the friend on the practice knight's lane) and steer their lance tip
// onto the gold spot on the FRIEND's shield, with the single-player Joust's controls (the stick, a mouse or a drag; the view turns to the
// friend's shield while you charge). The rules are joustduelrules.js (pure): the spot stands still in passes 1-2, slides from pass 3 and
// slides faster from pass 5, and it wobbles with how its owner aims (your shield follows your lance a little). A tip on the spot at the
// meeting = a Hit (a point); first to 3 hits with more than the friend; level after 10 passes = a draw. Nothing is saved; the Castle's own
// keys (lance1..3) and gates are never touched. Sir Splinter, the castle's horse and the Castle's helpers step aside meanwhile.
//
// Sync: the leader's `go` starts each pass (both clocks start when it arrives: the meeting is at the same pass time on both screens, and
// each draws the friend from that shared clock, not from their late avatar). At its meeting each computer sends its tip (`tip`). The
// DEFENDER decides: only my computer knows my own tip (so where my spot was) exactly, so it judges the friend's lance against my shield;
// the friend's word comes as `res`, and the leader counts (`pass`: both results and the score). Lost messages are sent again until the
// pass is counted; the heartbeat carries the pass and the score. (Never a field `to`, `from` or `name`: multiplayer.js sendPlay sets them.)
import * as THREE from 'three';
import { FriendGame, addFriendGame } from './friendgames.js';
import { DUEL_JOUST, passPlan, spotAt, lanceResult, Rider, JoustScore, rodeAt, dirOf } from './joustduelrules.js';
import { TILT } from './castleland.js';
import { JOUST_VIEW, CASTLE_RULES } from './castlelive.js';
import { buildPracticeKnight, buildLance, KNIGHT_SHIELD } from './castleprops.js';
import { buildModel, animateModel, disposeModel } from './species.js';
import { sound } from './sound.js';

export const JDUEL_PLAY = { send: 0.1, nag: 4, resend: 0.5 };
const LANES = [TILT.z, TILT.knightZ]; // side 0's lane (the leader), side 1's (the friend)
const G1 = 11;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// where side's horse is in pass n at pass time tau (before pass 1: at its start)
export const horseX = (side, n, tau) => { const d = dirOf(side, Math.max(1, n)), x0 = d > 0 ? TILT.x0 : TILT.x1; return x0 + d * rodeAt(n < 1 ? 0 : tau); };
const castleOf = game => game.gymLive?.of('part:castle');
const hostChamp = game => (game.mp?.role === 'host' ? !!game.champion : !!game.mp?.hostAvatar?.champ);
export const NOT_CHAMP = game => (game.mp?.role === 'host' ? 'Become the Champion first, then you can play this together!' : `${game.mp?.hostAvatar?.name || 'Your friend'} must be the Champion first!`);

export class JoustDuel extends FriendGame {
  get live() { return castleOf(this.game); }
  get side() { return this.leader ? 0 : 1; }
  get other() { return 1 - this.side; }
  sideName(side) { return side === this.side ? this.myName : this.partnerName; }
  scoreLine() { const s = this.sc.score; return `${this.sideName(0)} ${s[0]} · ${this.sideName(1)} ${s[1]}`; }

  /* ---- the start and the end ---- */
  setup() { return { seed: (Math.random() * 1e9) >>> 0 }; }
  start(data) {
    const live = this.live;
    if (!live) { this.finish('The Castle is not here!'); return; }
    this.seed = Number.isFinite(data?.seed) ? data.seed >>> 0 : 7;
    this.sc = new JoustScore();
    this.n = 0; this.tau = 0; this.plan = null; this.rider = null; this.phase = 'ready'; this.readyT = DUEL_JOUST.ready; this.restT = 0;
    this.mine = {}; this.tips = {}; this.judged = {}; this.kinds = {}; this.shown = {}; this.plans = {};
    this.friendTip = [0, 0]; this.lanceIn = { su: 0, sv: 0, du: 0, dv: 0 }; this.input = null; this.spaceWas = true; this.nagAt = -99; this.t = 0; this.sendT = 0;
    this.done = false; this.hits = [0, 0]; this.sent = 0;
    const p = this.game.player;
    this.home = { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch }; // where I stood: back there at the end
    live.setDuel(this);
    this.hideCrew();
    this.build();
    this.steedObj = this.makeSteed();
    this.toHorse();
    this.toast(`🐴 Joust with ${this.partnerName}! Hit the gold spot on ${this.partnerName}'s shield. First to ${DUEL_JOUST.need} hits!`);
  }
  end() {
    const p = this.game.player, live = this.live;
    if (p && this.steedObj && p.carry === this.steedObj) { p.carry = null; p.pos.set(this.home.x, this.home.y, this.home.z); p.vel.set(0, 0, 0); p.yaw = this.home.yaw; p.pitch = this.home.pitch; }
    if (this.game.rideShow === 'gallantrot') this.game.rideShow = null;
    this.showCrew();
    for (const o of this.meshes || []) { o.parent?.remove(o); if (o.userData.dispose) o.userData.dispose(); else disposeModel(o); }
    this.meshes = [];
    const a = this.avatar(); if (a?.model?.userData?.parts) for (const l of a.model.userData.parts.legs) l.g.rotation.z = 0;
    if (live?.duel === this) live.setDuel(null);
  }
  hideCrew() {
    const n = this.game.npcs;
    this.crew = (n?.list || []).filter(c => c.kind === 'crew' && c.def?.boss === 'castle' && !c.away).map(c => ({ c, pos: [c.pos.x, c.pos.y, c.pos.z], heading: c.homeHeading ?? c.heading }));
    for (const { c } of this.crew) n.sendAway(c);
  }
  showCrew() {
    const n = this.game.npcs;
    for (const { c, pos, heading } of this.crew || []) if (n?.list.includes(c)) n.placeAt(c, pos, heading);
    this.crew = [];
  }
  build() {
    const scene = this.game.scene, add = o => { this.meshes.push(o); scene?.add(o); return o; };
    this.meshes = [];
    if (!scene) return; // (Node: no meshes)
    const k = buildPracticeKnight(); this.knightParts = k.userData.parts;
    this.shield = add(this.knightParts.shield);           // the friend's shield with its gold spot and my aim dot (the single-player look)
    this.meshes.push(k);                                  // (disposed with the rest; never added)
    this.lance = add(buildLance()); this.theirLance = add(buildLance());
    try { this.steed = add(buildModel('gallantrot')); } catch { this.steed = null; }
  }

  /* ---- my horse (a `carry`: the stick and the look steer the lance tip during a pass, Jump does not get off) ---- */
  makeSteed() {
    const me = this;
    return {
      where: () => ({ x: horseX(me.side, me.n, me.tau), y: G1 + CASTLE_RULES.horseY, z: LANES[me.side] }),
      steer(wx, wz, analog) {
        if (!me.riding()) { me.lanceIn.su = 0; me.lanceIn.sv = 0; return; }
        const p = me.game.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
        me.lanceIn.sv = (wx * fx + wz * fz) * analog; me.lanceIn.su = (wx * rx + wz * rz) * analog;
      },
      look(dx, dy) { if (!me.riding()) return false; me.lanceIn.du += dx * DUEL_JOUST.mouse; me.lanceIn.dv -= dy * DUEL_JOUST.mouse; return true; },
      wantsLeave(space) {
        const fresh = !!space && !me.spaceWas; me.spaceWas = !!space;
        if (fresh && me.t - me.nagAt > JDUEL_PLAY.nag) { me.nagAt = me.t; me.toast('To stop the game, press Stop in the pause menu.'); }
        return false;
      },
      leave() {},
      jumpWord: () => null,
      safe: () => ({ x: me.home.x, y: me.home.y, z: me.home.z }),
    };
  }
  riding() { return this.phase === 'pass' && !!this.rider && !this.rider.met; }
  toHorse() {
    const p = this.game.player;
    this.game.riding?.stop?.('quiet');
    if (p.carry && p.carry !== this.steedObj) p.carry.leave?.();
    p.carry = this.steedObj; p.vel.set(0, 0, 0); p.keys = {};
    const w = this.steedObj.where(); p.pos.set(w.x, w.y, w.z);
    p.yaw = dirOf(this.side, Math.max(1, this.n + (this.phase === 'pass' ? 0 : 1))) > 0 ? -Math.PI / 2 : Math.PI / 2; p.pitch = -0.05;
    this.game.rideShow = 'gallantrot';
  }

  /* ---- passes ---- */
  planOf(n) { return (this.plans[n] ||= passPlan(this.seed, n)); }
  goPass(n, tau = 0) {
    this.n = n; this.plan = this.planOf(n); this.rider = new Rider(this.plan, this.side, 0); this.tau = 0; this.phase = 'pass';
    this.lanceIn = { su: 0, sv: 0, du: 0, dv: 0 }; this.friendTip = [0, 0];
    sound.play('trumpet');
    this.live?.callout?.('Charge!', n === 1 ? `Hit the gold spot on ${this.partnerName}'s shield!` : n === 3 ? 'Now the gold spot slides!' : '', '#ffffff', 1.1);
    for (let left = Math.min(tau, DUEL_JOUST.meet + DUEL_JOUST.after - 0.05); left > 1e-9; left -= 1) this.ride(Math.min(1, left), { su: 0, sv: 0 }); // (a pass I heard of late: catch up)
  }
  // my pass clock and lance tip go on by dt
  ride(dt, inp) {
    const ev = this.rider.update(dt, inp);
    this.tau = this.rider.tau;
    for (const e of ev) {
      if (e.type === 'meet') this.met(e.tip);
      else if (e.type === 'end') { this.phase = 'rest'; this.restT = DUEL_JOUST.rest; }
    }
  }
  // my meeting: my tip is fixed; send it; judge the friend's lance if theirs is here
  met(tip) {
    const n = this.n;
    this.mine[n] = tip;
    this.say({ k: 'tip', n, u: +tip[0].toFixed(4), v: +tip[1].toFixed(4) });
    const see = lanceResult(this.plan, this.side, tip, this.friendTip); // what I see now (the friend's word decides)
    sound.play(see.kind === 'whoosh' ? 'helmbonk' : 'lanceclang');
    this.judge(n);
  }
  // the friend's lance against my shield in pass n (I decide: I know my own tip exactly)
  judge(n) {
    if (this.judged[n] || !this.mine[n] || !this.tips[n]) return;
    const kind = this.judged[n] = lanceResult(this.planOf(n), this.other, this.tips[n], this.mine[n]).kind;
    if (this.leader) this.setKind(n, this.other, kind);
    else this.say({ k: 'res', n, kind });
  }
  // Leader: what side's lance did in pass n
  setKind(n, side, kind) {
    const k = (this.kinds[n] ||= [null, null]);
    if (k[side]) return;
    k[side] = kind;
    if (k[0] && k[1] && this.sc.add(n, k)) { this.say({ k: 'pass', n, kinds: k, score: this.sc.score }); this.showPass(n, k); }
  }
  showPass(n, kinds) {
    if (this.shown[n]) return;
    this.shown[n] = true;
    const mine = kinds[this.side], theirs = kinds[this.other], W = { hit: 'Hit!', clang: 'Clang!', whoosh: 'Whoosh!' };
    if (mine === 'hit') this.hits[this.side]++; if (theirs === 'hit') this.hits[this.other]++;
    if (mine === 'hit') { sound.play('lanceclang'); sound.play('trumpet'); }
    const big = mine === 'hit' && theirs === 'hit' ? '🎯 Both hit!' : mine === 'hit' ? '🎯 Hit! +1' : theirs === 'hit' ? `${this.partnerName} hit you!` : mine === 'clang' ? 'Clang!' : 'Whoosh!';
    this.live?.callout?.(big, `${this.myName}: ${W[mine]} · ${this.partnerName}: ${W[theirs]}`, mine === 'hit' ? '#ffd84a' : '#e8eefc', 1.8);
    this.toast(`🐴 Pass ${n}: ${this.sideName(0)} ${W[kinds[0]]} · ${this.sideName(1)} ${W[kinds[1]]} · ${this.scoreLine()}`);
  }
  over(win) {
    if (this.done) return;
    this.done = true; this.phase = 'over';
    sound.play(win === this.side ? 'win' : 'trumpet');
    const s = this.sc.score;
    this.finish(win === 'draw' ? `🐴 A draw, ${s[0]} : ${s[1]}! Good game!` : `🐴 ${this.sideName(win)} wins ${s[win]} : ${s[1 - win]}! Good game!`);
  }

  /* ---- messages ---- */
  message(p) {
    if (!this.sc) return;
    if (p.k === 'm') { if (p.n === this.n && Number.isFinite(p.u) && Number.isFinite(p.v)) this.friendTip = [p.u, p.v]; }
    else if (p.k === 'tip') { if (Number.isInteger(p.n) && Number.isFinite(p.u) && Number.isFinite(p.v) && !this.tips[p.n]) { this.tips[p.n] = [p.u, p.v]; this.judge(p.n); } }
    else if (p.k === 'res' && this.leader) { if (Number.isInteger(p.n) && ['hit', 'clang', 'whoosh'].includes(p.kind)) this.setKind(p.n, this.side, p.kind); }
    else if (p.k === 'go' && !this.leader) { if (Number.isInteger(p.n) && p.n > this.n) this.goPass(p.n); }
    else if (p.k === 'pass' && !this.leader) { this.sc.load(p.score, p.n); if (Array.isArray(p.kinds)) { this.sc.passes[p.n] = p.kinds; this.showPass(p.n, p.kinds); } }
    else if (p.k === 'over' && !this.leader) { this.sc.load(p.score); this.over(p.win); }
  }
  beat() { const last = this.sc?.n; return { n: this.n, tau: this.phase === 'pass' ? this.tau : 0, ph: this.phase, score: this.sc?.score, last: last ? { n: last, kinds: this.sc.passes[last] } : null }; }
  farewell() { const win = this.sc?.winner; return this.leader && win != null ? { k: 'over', score: this.sc.score, win } : null; }
  heard(d) { // a lost go or pass result heals
    if (!this.sc || this.done) return;
    this.sc.load(d.score, d.last?.n);
    if (d.last && Array.isArray(d.last.kinds)) { this.sc.passes[d.last.n] ||= d.last.kinds; this.showPass(d.last.n, d.last.kinds); }
    if (Number.isInteger(d.n) && d.n > this.n) this.goPass(d.n, d.ph === 'pass' ? d.tau || 0 : DUEL_JOUST.meet + DUEL_JOUST.after);
  }
  tick() { // until a pass is counted: my tip again, and (the friend) my word on the leader's lance
    if (!this.sc || this.done) return;
    for (const n of Object.keys(this.mine).map(Number)) {
      if (this.sc.passes[n]) continue;
      const t = this.mine[n]; this.say({ k: 'tip', n, u: +t[0].toFixed(4), v: +t[1].toFixed(4) });
      if (!this.leader && this.judged[n]) this.say({ k: 'res', n, kind: this.judged[n] });
    }
  }

  /* ---- every frame (real seconds) ---- */
  update(dt) {
    const g = this.game, p = g.player;
    if (!this.sc || this.done) return;
    dt = Math.min(dt, DUEL_JOUST.maxDt);
    this.t += dt;
    if (p.carry !== this.steedObj && (g.place || 'main') === 'castle' && !g.realms?.busy && !g.inBattle) this.toHorse();
    if (this.phase === 'ready') {
      this.readyT -= dt;
      if (this.readyT <= 0 && this.leader) { this.say({ k: 'go', n: 1 }); this.goPass(1); }
    } else if (this.phase === 'pass') {
      this.ride(dt, this.input ?? this.lanceIn);
      this.lanceIn.du = 0; this.lanceIn.dv = 0;
      this.sendT -= dt;
      if (!this.rider.met && this.sendT <= 0) { this.sendT = JDUEL_PLAY.send; this.say({ k: 'm', n: this.n, u: +this.rider.tip[0].toFixed(3), v: +this.rider.tip[1].toFixed(3) }); }
    } else if (this.phase === 'rest' && this.leader) {
      this.restT -= dt;
      if (this.restT <= 0 && this.sc.passes[this.n]) {
        const win = this.sc.winner;
        if (win != null) { this.say({ k: 'over', score: this.sc.score, win }); this.over(win); return; }
        this.say({ k: 'go', n: this.n + 1 }); this.goPass(this.n + 1);
      }
    }
    if (p.carry === this.steedObj) { const w = this.steedObj.where(); p.pos.set(w.x, w.y, w.z); }
    this.frameView(Math.min(1, dt * JOUST_VIEW.turn));
    this.draw(dt);
  }
  // the friend's shield in the world (beside them on my side, a bit ahead), from the shared pass clock
  shieldPos() {
    const o = this.other, d = dirOf(o, Math.max(1, this.n)), x = horseX(o, this.n, this.tau), toward = Math.sign(LANES[this.side] - LANES[o]);
    return new THREE.Vector3(x + d * JOUST_VIEW.shieldOn, G1 + JOUST_VIEW.shieldUp, LANES[o] + toward * JOUST_VIEW.shieldIn);
  }
  frameView(k) {
    const p = this.game.player;
    if (p.carry !== this.steedObj) return;
    const w = this.steedObj.where(), n = Math.max(1, this.n + (this.phase === 'pass' ? 0 : 1));
    let yaw = dirOf(this.side, n) > 0 ? -Math.PI / 2 : Math.PI / 2, pitch = -0.05;
    if (this.riding()) {
      const s = this.shieldPos(), dx = s.x - w.x, dz = s.z - w.z, dy = s.y - (w.y + (p.eye ?? 1.62));
      yaw = Math.atan2(-dx, -dz); pitch = Math.atan2(dy, Math.hypot(dx, dz));
    } else if (this.phase !== 'pass') return; // (between passes: look round freely)
    p.yaw += wrap(yaw - p.yaw) * k; p.pitch += (pitch - p.pitch) * k;
  }
  draw(dt) {
    const g = this.game, cam = g.camera, p = g.player, o = this.other, n = this.n, tau = this.tau;
    if (!g.scene) return;
    const ox = horseX(o, n, tau), oz = LANES[o], od = dirOf(o, Math.max(1, n + (this.phase === 'pass' ? 0 : 1)));
    const moving = this.phase === 'pass' && tau < DUEL_JOUST.meet + DUEL_JOUST.after;
    // the friend: their steed, their avatar on it, their lance at me
    if (this.steed) { this.steed.position.set(ox, G1, oz); this.steed.rotation.y = od > 0 ? Math.PI / 2 : -Math.PI / 2; animateModel(this.steed, this.t, moving); }
    const a = this.avatar();
    if (a?.model) {
      a.model.position.set(ox, G1 + CASTLE_RULES.horseY, oz); a.model.rotation.set(0, od > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      const parts = a.model.userData.parts;
      if (parts) { parts.legs.forEach((l, i) => { l.g.rotation.x = 0; l.g.rotation.z = i % 2 ? 0.5 : -0.5; }); for (const ar of parts.arms) ar.g.rotation.x = 0; }
    }
    const sp = this.shieldPos(), S = this.shield, K = this.knightParts;
    if (S) {
      S.position.copy(sp);
      const eye = p.eyePos?.clone?.() ?? cam?.position ?? new THREE.Vector3(horseX(this.side, n, tau), 13.5, LANES[this.side]);
      S.rotation.set(0, Math.atan2(-(eye.z - sp.z), eye.x - sp.x), 0);
      const plan = this.plan ?? this.planOf(1), star = spotAt(plan, o, Math.min(tau, plan.meet + DUEL_JOUST.after), this.friendTip);
      K.star.position.set(0.05, star[1], star[0]);
      K.ring.scale.setScalar(DUEL_JOUST.r);
      K.halo.scale.setScalar(1 + 0.18 * Math.sin(this.t * 6));
      const pass = this.phase === 'pass' && this.rider, tip = pass ? this.rider.tipNow() : [0, 0];
      K.dot.visible = !!pass;
      K.dot.position.set(0.07, tip[1], tip[0]);
      for (const m of K.marks) m.visible = false;
      // the zoom: while I charge, the friend's shield stays about JOUST_VIEW.fill of the screen's height
      if (cam && p.carry === this.steedObj) {
        const d = Math.max(1, eye.distanceTo(sp)), R = 0.8 * KNIGHT_SHIELD.scale;
        const want = this.riding() ? Math.max(JOUST_VIEW.fovMin, Math.min(JOUST_VIEW.fov, (2 * Math.atan(R / d) * 180 / Math.PI) / JOUST_VIEW.fill)) : JOUST_VIEW.fov;
        this.live?.setFov(cam.fov + (want - cam.fov) * Math.min(1, dt * 4));
      }
      this.live?.crosshair?.(p.carry === this.steedObj);
      // my lance: from my right hand toward my aim dot; it thrusts in the last moment
      const mx = horseX(this.side, n, tau), md = dirOf(this.side, Math.max(1, n + (this.phase === 'pass' ? 0 : 1))), side = Math.sign(LANES[o] - LANES[this.side]);
      const hand = new THREE.Vector3(mx - md * 0.2, G1 + CASTLE_RULES.horseY + 0.95, LANES[this.side] + 0.6 * side);
      let aimAt;
      if (pass) { S.updateMatrixWorld(true); aimAt = K.dot.getWorldPosition(new THREE.Vector3()); } else aimAt = new THREE.Vector3(mx + md * 6, G1 + CASTLE_RULES.shieldY, LANES[this.side] + 2 * side);
      this.lance.position.copy(hand); this.lance.lookAt(aimAt); this.lance.rotateY(Math.PI);
      const left = pass ? plan.meet - Math.min(tau, plan.meet) : 9, kk = Math.max(0, Math.min(1, 1 - left / JOUST_VIEW.thrust));
      this.lance.scale.set(1, 1, Math.max(JOUST_VIEW.lance, JOUST_VIEW.lance + (hand.distanceTo(aimAt) - JOUST_VIEW.lance) * kk * kk * (this.rider?.met ? 0 : 1)) / JOUST_VIEW.lance);
      // their lance: from their hand toward me
      const th = new THREE.Vector3(ox - od * 0.2, G1 + CASTLE_RULES.horseY + 0.95, oz - 0.6 * side);
      this.theirLance.position.copy(th);
      this.theirLance.lookAt(new THREE.Vector3(mx + md * 0.5, G1 + JOUST_VIEW.shieldUp - 0.4, LANES[this.side] - side * JOUST_VIEW.shieldIn));
      this.theirLance.rotateY(Math.PI);
    }
  }

  /* ---- the rest of a FriendGame ---- */
  aim() { const s = this.shieldPos(); return { x: s.x, z: s.z, text: (a, m) => `🎯 Hit ${this.partnerName}'s gold spot! ${a} ${m}m` }; }
  chip() {
    if (!this.sc) return null;
    const phase = this.phase === 'ready' ? 'Get ready...' : `Pass ${Math.max(1, this.n)} · first to ${DUEL_JOUST.need} hits`;
    return { score: `🐴 ${this.scoreLine()}`, phase };
  }
  get noRide() { return 'You are on the castle horse!'; }
  info() {
    return { phase: this.phase, side: this.side, n: this.n, tau: this.tau, score: [...(this.sc?.score || [0, 0])], tip: this.rider ? this.rider.tip.slice() : null, met: !!this.rider?.met,
      mine: { ...this.mine }, tips: { ...this.tips }, judged: { ...this.judged }, passes: { ...(this.sc?.passes || {}) }, hits: this.hits?.slice(), onHorse: this.game.player.carry === this.steedObj,
      x: horseX(this.side, this.n, this.tau), friendX: horseX(this.other, this.n, this.tau), crewAway: (this.crew || []).length, meshes: (this.meshes || []).length };
  }
}

addFriendGame({
  id: 'joust', icon: '🐴', name: 'Joust', sub: `First to ${DUEL_JOUST.need} hits, in the Castle's Tilt Yard.`,
  place: 'castle', arrive: 'castle', where: 'the Castle', // asked for anywhere else: a trip there and back (friendgames.js)
  ask: name => `${name} wants to joust with you! Ride at each other and hit the gold spot on the other's shield. First to ${DUEL_JOUST.need} hits wins.`,
  shown: game => !!castleOf(game),
  whyNot: game => (!hostChamp(game) ? NOT_CHAMP(game) : castleOf(game)?.duel ? 'Finish your game first!' : ''),
  make: (game, s) => new JoustDuel(game, s),
});
