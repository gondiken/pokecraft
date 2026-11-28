// Shield Up! for two (owner 2026-11-28): a game for two friends (friendgames.js) on the Castle's practice field. One friend throws, the
// other blocks on a Shield Stone exactly as in the single-player Shield Up! (the stick points the shield, Jump holds it over your head);
// then they swap. The thrower stands on the other stone, LOOKS at a catapult and presses Throw! (looking high up = a sky pumpkin); the
// catapult tells and throws with the single-player round 2's times, and the next throw can come only DUEL_SHIELD.cool s later. A block is a
// point for the defender, a splat a point for the thrower; 5 throws each way, level = one more each, still level = a draw. The rules are
// siegeduelrules.js (pure); castlelive.js draws the throws, the catapult arms, the lamp ring, the arrows round the crosshair and the goo
// from siegeView() (its `setDuel` hook). Nothing is saved; the Castle's own keys (shield1..3) and gates are never touched.
//
// Sync: the THROWER's computer sends each throw (`th`: turn, number, catapult, kind; sent again until it is counted); the DEFENDER's
// computer starts its tell when it arrives (always whole on the defender's screen), judges block or splat with siege.js's rule and grace
// window, and says so (`res`, sent again until counted); the LEADER counts (`score`) and starts each turn (`turn`). The defender sends
// where its shield points (`s`) so the thrower sees it. The heartbeat carries the turn and the score. (Never a field `to`, `from` or
// `name`: multiplayer.js sendPlay sets them.)
import * as THREE from 'three';
import { FriendGame, addFriendGame } from './friendgames.js';
import { DUEL_SHIELD, ShieldTurn, ShieldScore, turnOf, throwOf, aimOf, canThrow } from './siegeduelrules.js';
import { SIEGE, spotPos } from './siege.js';
import { buildHeldShield } from './castleprops.js';
import { NOT_CHAMP } from './joustduel.js';
import { disposeModel } from './species.js';
import { sound } from './sound.js';

export const SDUEL_PLAY = { send: 0.1, resend: 0.5, nag: 4 };
const castleOf = game => game.gymLive?.of('part:castle');
const hostChamp = game => (game.mp?.role === 'host' ? !!game.champion : !!game.mp?.hostAvatar?.champ);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const DEF = SIEGE.stones[DUEL_SHIELD.defStone], THR = SIEGE.stones[DUEL_SHIELD.throwStone];

export class ShieldDuel extends FriendGame {
  get live() { return castleOf(this.game); }
  get side() { return this.leader ? 0 : 1; }
  get other() { return 1 - this.side; }
  sideName(side) { return side === this.side ? this.myName : this.partnerName; }
  scoreLine() { const s = this.sc.score; return `${this.sideName(0)} ${s[0]} · ${this.sideName(1)} ${s[1]}`; }

  /* ---- the start and the end ---- */
  setup() { return {}; } // (turn 1: the friend who was asked blocks first)
  start() {
    const live = this.live;
    if (!live) { this.finish('The Castle is not here!'); return; }
    this.sc = new ShieldScore();
    this.t = 0; this.role = null; this.turn = null; this.phase = 'ready'; this.readyT = DUEL_SHIELD.ready; this.swapT = 0;
    this.shieldIn = { ang: 0, up: false }; this.stickYaw = null; this.input = null; this.theirShield = { ang: 0, up: false };
    this.clock = 0; this.last = null; this.thrown = 0; this.idle = 0; this.sendT = 0; this.spaceWas = true; this.nagAt = -99; this.rt = 0;
    this.pendTh = {}; this.pendRes = {}; this.shown = new Set(); this.told = new Set(); this.done = false; this.counts = { block: 0, splat: 0 };
    const p = this.game.player;
    this.home = { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch };
    live.setDuel(this);
    this.hideCrew();
    this.build();
    this.defObj = this.makeDefender(); this.thrObj = this.makeThrower();
    this.toStone(this.side === turnOf(1).def ? 'def' : 'throw');
    this.toast(`🛡️ Shield Up! with ${this.partnerName}! One throws, one blocks, then swap. Most points wins!`);
  }
  end() {
    const p = this.game.player, live = this.live;
    if (p && (p.carry === this.defObj || p.carry === this.thrObj)) { p.carry = null; p.pos.set(this.home.x, this.home.y, this.home.z); p.vel.set(0, 0, 0); p.yaw = this.home.yaw; p.pitch = this.home.pitch; }
    this.showCrew();
    for (const o of this.meshes || []) { o.parent?.remove(o); if (o.userData.dispose) o.userData.dispose(); else disposeModel(o); }
    this.meshes = [];
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
    if (!scene) return;
    this.theirHeld = add(buildHeldShield()); this.theirHeld.scale.setScalar(1.3);
    // the thrower's aim: a gold arrow over the catapult you look at (a purple one over the defender for a sky pumpkin)
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23a, depthTest: false, transparent: true });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 12), mat); cone.rotation.x = Math.PI; cone.renderOrder = 997; g.add(cone);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 6, 24), mat); ring.rotation.x = Math.PI / 2; ring.position.y = -1.4; ring.renderOrder = 997; g.add(ring);
    g.userData.dispose = () => { cone.geometry.dispose(); ring.geometry.dispose(); mat.dispose(); };
    this.marker = add(g); this.markerMat = mat;
  }

  /* ---- the two stances (`carry`s): the defender's is the single-player stance; the thrower stands and looks ---- */
  makeDefender() {
    const me = this;
    return {
      where: () => ({ x: DEF[0], y: DEF[1], z: DEF[2] }),
      steer(wx, wz, analog, space) {
        const p = me.game.player;
        if (analog > 0.2) { me.shieldIn.ang = Math.atan2(wx, wz); me.stickYaw = p.yaw; }
        else if (me.stickYaw == null || Math.abs(wrap(p.yaw - me.stickYaw)) > 0.08) { me.stickYaw = null; me.shieldIn.ang = Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw)); }
        me.shieldIn.up = !!space;
      },
      wantsLeave: space => me.nag(space),
      leave() {},
      jumpWord: () => 'Shield',
      safe: () => ({ x: me.home.x, y: me.home.y, z: me.home.z }),
    };
  }
  makeThrower() {
    const me = this;
    return {
      where: () => ({ x: THR[0], y: THR[1], z: THR[2] }),
      steer() {},
      wantsLeave: space => me.nag(space),
      leave() {},
      jumpWord: () => null,
      safe: () => ({ x: me.home.x, y: me.home.y, z: me.home.z }),
    };
  }
  nag(space) {
    const fresh = !!space && !this.spaceWas; this.spaceWas = !!space;
    if (fresh && this.role === 'throw' && this.rt - this.nagAt > SDUEL_PLAY.nag) { this.nagAt = this.rt; this.toast('To stop the game, press Stop in the pause menu.'); }
    return false;
  }
  toStone(role) {
    const p = this.game.player, obj = role === 'def' ? this.defObj : this.thrObj;
    this.game.riding?.stop?.('quiet');
    if (p.carry && p.carry !== obj) p.carry.leave?.();
    p.carry = obj; p.vel.set(0, 0, 0); p.keys = {};
    const w = obj.where(); p.pos.set(w.x, w.y, w.z);
    p.lookAt?.(role === 'def' ? { x: 80.5, y: 14, z: 104 } : { x: DEF[0], y: DEF[1] + 1.2, z: DEF[2] - 8 });
    this.spaceWas = true; this.stickYaw = null; this.shieldIn = { ang: 0, up: false };
  }

  /* ---- turns ---- */
  startTurn(t) {
    const { def, n } = turnOf(t);
    this.t = t; this.role = def === this.side ? 'def' : 'throw'; this.phase = 'turn';
    this.turn = new ShieldTurn({ t, n, decides: this.role === 'def' });
    this.clock = 0; this.last = null; this.thrown = 0; this.idle = 0; this.pendTh = {};
    this.toStone(this.role);
    sound.play('trumpet');
    const extra = t > 2 ? ' One more each!' : '';
    if (this.role === 'def') this.toast(`🛡️ Block ${this.partnerName}'s pumpkins! Point your shield at them.${extra}`);
    else this.toast(`🎯 Your turn to throw! Look at a catapult and press Throw! Look up high for a sky pumpkin.${extra}`);
  }
  canThrow() { return this.role === 'throw' && this.phase === 'turn' && canThrow(this.clock, this.last, this.thrown, this.turn.n); }
  // the thrower's Throw!: from the catapult w.k, a 'pumpkin' or a 'sky' one
  throwNow(w) {
    if (!this.canThrow() || !w) return false;
    const th = throwOf(this.thrown, w.k, w.kind);
    this.turn.add(th);
    const msg = { k: 'th', t: this.t, i: th.i, c: th.k, kind: th.kind };
    this.pendTh[th.i] = msg; this.say(msg);
    this.thrown++; this.last = this.clock; this.idle = 0;
    sound.play('catapultcreak');
    return true;
  }
  aimNow() { const p = this.game.player; return aimOf([p.pos.x, p.pos.y + (p.eye ?? 1.62), p.pos.z], p.yaw, p.pitch); }
  // Leader: throw i of turn t came out r
  count(t, i, r) {
    (this.lastR ||= {})[`${t}:${i}`] ??= r;
    if (!this.sc.add(t, i, r)) { this.say({ k: 'score', t, i, r, score: this.sc.score }); return; } // (said again: the last word was lost)
    this.say({ k: 'score', t, i, r, score: this.sc.score });
    this.show(t, i, r);
    if (this.sc.turnDone(t) && t === this.t) { this.phase = 'swap'; this.swapT = DUEL_SHIELD.swap; }
  }
  show(t, i, r) {
    const key = `${t}:${i}`;
    if (this.shown.has(key)) return;
    this.shown.add(key);
    delete this.pendTh[i]; delete this.pendRes[key];
    const def = turnOf(t).def, block = r !== 'splat';
    this.counts[block ? 'block' : 'splat']++;
    if (def === this.side) { if (block) sound.play('shieldclang'); }
    else { sound.play(block ? 'shieldclang' : 'pumpkinsplat'); this.toast(block ? `🛡️ ${this.partnerName} blocked it! +1 for ${this.partnerName}` : '🎃 Splat! +1 for you!'); }
    if (def === this.side && !block && !this.told.has('splat')) { this.told.add('splat'); this.toast(`🎃 Splat! +1 for ${this.partnerName}. Put the blue shield on the arrow!`); }
  }
  over(win) {
    if (this.done) return;
    this.done = true; this.phase = 'over';
    sound.play(win === this.side ? 'win' : 'trumpet');
    const s = this.sc.score;
    this.finish(win === 'draw' ? `🛡️ A draw, ${s[0]} : ${s[1]}! Good game!` : `🛡️ ${this.sideName(win)} wins ${s[win]} : ${s[1 - win]}! Good game!`);
  }

  /* ---- messages ---- */
  message(p) {
    if (!this.sc) return;
    if (p.k === 's') { if (Number.isFinite(p.a)) this.theirShield = { ang: p.a, up: !!p.up }; }
    else if (p.k === 'th') { if (this.leader && this.sc.seen.has(`${p.t}:${p.i}`)) { this.say({ k: 'score', t: p.t, i: p.i, r: this.lastR?.[`${p.t}:${p.i}`], score: this.sc.score }); return; } if (p.t === this.t && this.role === 'def' && Number.isInteger(p.i) && Number.isInteger(p.c) && p.c >= 0 && p.c < 12) this.turn.add(throwOf(p.i, p.c, p.kind)); }
    else if (p.k === 'res' && this.leader) { if (Number.isInteger(p.t) && Number.isInteger(p.i)) this.count(p.t, p.i, p.r); }
    else if (p.k === 'score' && !this.leader) { this.sc.load(p.score); this.sc.seen.add(`${p.t}:${p.i}`); this.show(p.t, p.i, p.r); }
    else if (p.k === 'turn' && !this.leader) { if (Number.isInteger(p.t) && p.t > this.t) { this.sc.load(p.score); this.startTurn(p.t); } }
    else if (p.k === 'over' && !this.leader) { this.sc.load(p.score); this.over(p.win); }
  }
  beat() { return { t: this.t, score: this.sc?.score, ph: this.phase }; }
  farewell() { return this.leader && this.result != null ? { k: 'over', score: this.sc.score, win: this.result } : null; }
  heard(d) {
    if (!this.sc || this.done) return;
    this.sc.load(d.score);
    if (Number.isInteger(d.t) && d.t > this.t) this.startTurn(d.t);
  }
  tick() { // until counted: my throws again (thrower), my word again (defender)
    if (!this.sc || this.done) return;
    for (const m of Object.values(this.pendTh)) this.say(m);
    for (const m of Object.values(this.pendRes)) this.say(m);
  }

  /* ---- every frame (real seconds) ---- */
  update(dt) {
    const g = this.game, p = g.player;
    if (!this.sc || this.done) return;
    dt = Math.min(dt, DUEL_SHIELD.maxDt);
    this.rt += dt;
    const want = this.role === 'throw' ? this.thrObj : this.defObj;
    if (this.role && p.carry !== want && (g.place || 'main') === 'castle' && !g.realms?.busy && !g.inBattle) this.toStone(this.role);
    if (this.phase === 'ready') {
      this.readyT -= dt;
      if (this.readyT <= 0 && this.leader) { this.say({ k: 'turn', t: 1, score: this.sc.score }); this.startTurn(1); }
    } else if (this.phase === 'swap' && this.leader) {
      this.swapT -= dt;
      if (this.swapT <= 0) {
        const win = this.sc.after(this.t);
        if (win != null) { this.result = win; this.say({ k: 'over', score: this.sc.score, win }); this.over(win); return; }
        this.say({ k: 'turn', t: this.t + 1, score: this.sc.score }); this.startTurn(this.t + 1);
      }
    }
    if (this.turn) {
      this.clock += dt;
      if (this.role === 'def') {
        const inp = this.input ?? this.shieldIn;
        for (const e of this.turn.update(dt, inp)) {
          if (e.type === 'tell') { if (e.t.kind === 'sky' && !this.told.has('sky')) { this.told.add('sky'); this.toast('Sky pumpkin! Hold Jump!'); } else if (e.t.kind !== 'sky') sound.play('catapultcreak'); }
          else if (e.type === 'launch') sound.play('catapultthunk');
          else if (e.type === 'hit') {
            if (e.result === 'splat') { sound.play('pumpkinsplat'); this.live?.splatOn?.(e.t); }
            if (this.leader) this.count(this.t, e.t.i, e.result);
            else { const m = { k: 'res', t: this.t, i: e.t.i, r: e.result }; this.pendRes[`${this.t}:${e.t.i}`] = m; this.say(m); }
          }
        }
        this.sendT -= dt;
        if (this.sendT <= 0) { this.sendT = SDUEL_PLAY.send; this.say({ k: 's', a: +inp.ang.toFixed(3), up: !!inp.up }); }
      } else {
        for (const e of this.turn.update(dt)) if (e.type === 'launch') sound.play('catapultthunk');
        if (this.canThrow()) {
          this.idle += dt;
          if (this.idle >= DUEL_SHIELD.idle) { this.throwNow(this.aimNow()); this.toast(`Throw! ${this.partnerName} is waiting.`); }
        } else this.idle = 0;
      }
    }
    if (p.carry === want) { const w = want.where(); p.pos.set(w.x, w.y, w.z); }
    this.draw();
  }
  // castlelive.js draws the throws from this: the turn's throws, my stone (-1 = I throw: no shield, no arrows) and my shield
  siegeView() { return { sg: this.turn, stance: this.role === 'def' ? DUEL_SHIELD.defStone : -1, shieldIn: this.role === 'def' ? (this.input ?? this.shieldIn) : { ang: 0, up: false } }; }
  draw() {
    if (!this.game.scene || !this.marker) return;
    const throwing = this.role === 'throw' && this.phase === 'turn' && this.thrown < (this.turn?.n ?? 0);
    this.marker.visible = throwing;
    if (throwing) {
      const a = this.aimNow(), ready = this.canThrow(), s = a.kind === 'sky' ? [DEF[0], DEF[1] + 8, DEF[2]] : spotPos(a.k);
      this.marker.position.set(s[0], s[1] + 2.4 + 0.25 * Math.sin(this.rt * 5), s[2]);
      this.markerMat.color.setHex(a.kind === 'sky' ? 0xb48aff : 0xffd23a);
      this.markerMat.opacity = ready ? 1 : 0.35;
    }
    // the defender's shield, as they hold it (for the thrower)
    const show = this.role === 'throw';
    this.theirHeld.visible = show;
    if (show) {
      const sh = this.theirShield, o = this.theirHeld;
      if (sh.up) { o.position.set(DEF[0], DEF[1] + 2.3, DEF[2]); o.rotation.set(-Math.PI / 2, 0, 0); }
      else { o.position.set(DEF[0] + Math.sin(sh.ang) * 0.7, DEF[1] + 1.2, DEF[2] + Math.cos(sh.ang) * 0.7); o.rotation.set(0, sh.ang, 0); }
    }
  }

  /* ---- the rest of a FriendGame ---- */
  near() { return this.role === 'throw' && this.phase === 'turn' && this.thrown < (this.turn?.n ?? 0) ? 'Throw!' : null; }
  use() { if (this.near() !== 'Throw!') return false; if (!this.throwNow(this.aimNow())) sound.play('helmbonk'); return true; }
  aim() {
    if (this.role === 'throw') return { x: DEF[0], z: DEF[2], text: (a, m) => `🎯 Splat ${this.partnerName}! Look at a catapult ${a} ${m}m` };
    return { x: DEF[0], z: DEF[2], text: () => '🛡️ Block the pumpkins!' };
  }
  chip() {
    if (!this.sc) return null;
    const n = this.turn?.n ?? DUEL_SHIELD.throws;
    const phase = this.phase === 'ready' ? 'Get ready...' : this.phase === 'swap' ? 'Swap!' : this.role === 'def' ? `You block · ${this.turn.plan.throws.length} / ${n} thrown` : `You throw · ${this.thrown} / ${n}`;
    return { score: `🛡️ ${this.scoreLine()}`, phase };
  }
  get noRide() { return 'No riding in Shield Up!'; }
  info() {
    return { phase: this.phase, side: this.side, t: this.t, role: this.role, score: [...(this.sc?.score || [0, 0])], thrown: this.thrown, inTurn: this.turn ? this.turn.plan.throws.length : 0,
      results: this.turn ? this.turn.results.slice() : [], counts: { ...this.counts }, shield: { ...(this.input ?? this.shieldIn) }, theirShield: { ...this.theirShield },
      onStone: this.game.player.carry === (this.role === 'throw' ? this.thrObj : this.defObj), can: this.turn ? this.canThrow() : false, crewAway: (this.crew || []).length, meshes: (this.meshes || []).length };
  }
}

addFriendGame({
  id: 'shieldup', icon: '🛡️', name: 'Shield Up!', sub: 'Throw pumpkins, block pumpkins, then swap!',
  place: 'castle', arrive: 'castle', where: 'the Castle', // asked for anywhere else: a trip there and back (friendgames.js)
  ask: name => `${name} wants to play Shield Up! with you! One throws pumpkins, one blocks with the shield, then you swap.`,
  shown: game => !!castleOf(game),
  whyNot: game => (!hostChamp(game) ? NOT_CHAMP(game) : castleOf(game)?.duel ? 'Finish your game first!' : ''),
  make: (game, s) => new ShieldDuel(game, s),
});
