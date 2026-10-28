// T49: the live part of the Castle (LIVE.castle, made by gymLive.reset for the part in world.parts), plans/T49-castle.md. It wires the two
// pure challenges (siege.js: Shield Up!, joust.js: the Joust) to the player, the meshes (castleprops.js) and the world:
//  - Shield Up!: on a Shield Stone press Shield!: you stand your ground (a `carry` object: the stick points the shield, Jump lifts it);
//    pumpkins and arrows come from twelve spots; three rounds, each saved at once (pw:castle:shield1..3). Round 3 brings the drawbridge down.
//  - the hedge maze (the only way into the Tilt Yard): the guide only helps gently (castleAim reads mazeTime).
//  - the Joust: Mount! the castle's horse on its pad, Charge!, the stick steers the lance tip onto the gold star; three rounds of four
//    passes (pw:castle:lance1..3). Round 3 raises the keep's portcullis.
//  - the drawbridge, the portcullis and the squire gate are drawn with LiveCells (never an edit, never inside you): down / up when YOU won
//    them (or hold the star) or a friend in this play-together world did (castlegate.js, owner 2026-10-28: the gates are physical).
// Never a fail: a splat is only goo on the screen, a short round starts again (kind help after two). Clocks are summed frame dt and stand
// still in a battle / an ask / a panel / the pause. `manual` + step(dt, input) for tests; info() for tests.
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';
import { buildModel, animateModel, disposeModel } from './species.js';
import { SIEGE, SIEGE_ROUNDS, SiegeRound, stoneAt, dirTo, throwAt, spotPos } from './siege.js';
import { JOUST, JOUST_ROUNDS, JoustRound, gallopAt } from './joust.js';
import { castleState, shieldKey, lanceKey, TILT, KEEP, SQUIRE_GATE, YARD, BRIDGE, liveCells, castleAim } from './castleland.js';
import { inMaze, mazeExtras } from './hedgemaze.js';
import { fairHelp } from './fairgames.js';
import { buildThrows, buildStoneRings, buildCatapults, buildPracticeKnight, buildLance, buildHeldShield, buildDrawbridge, buildPortcullis, KNIGHT_SHIELD, buildHorseshoes, buildHedgeCritters, buildFountainSpray } from './castleprops.js';

export const CASTLE_RULES = { sync: 0.25, mountR: 2.6, horseY: 0.95, knightY: 0, shieldY: 1.6, shieldOff: 1.0, gooTime: 1.1, bridgeTime: 3, portTime: 2, squireR: 7, dtMax: 0.1, sayGap: 3 };
// The Joust's view (owner 2026-10-28: "it took me a while to even SEE what I was supposed to do"): during a pass the camera turns to
// Sir Splinter's shield and zooms so it stays big in the middle of the screen; he meets you `lead` blocks ahead (not beside you), so the
// view turns at most about 45 degrees. Only drawing: the rules (joust.js) and how the stick moves the tip are unchanged.
export const JOUST_VIEW = { lead: 5, shieldUp: 2.3, shieldIn: 0.9, shieldOn: 0.5, turn: 6, fov: 75, fovMin: 38, fill: 0.2, thrust: 0.35, lance: 4.2, call: 1.4 };
// The hedge maze's fun (owner 2026-10-28): horseshoes picked within `reach`, critters peek when you come within `peekR` (for `peekUp` s,
// then not again for `peekRest` s), the fountain's drops fly `spray` s.
export const MAZE_FUN = { reach: 1.3, peekR: 6, peekUp: 2.4, peekRest: 7, rise: 0.25, spray: 1.1, drops: 24 };
const WORDS = {
  stone: 'Push the stick toward the danger. The arrows show where it is!',
  rounds: ['Round 1: pumpkins from the castle! Turn your shield to them.', 'Round 2: from all sides! Watch the arrows round the middle of the screen.', 'Round 3: look up for sky pumpkins (hold Jump)! Big pumpkins need a perfect block.'],
  splat: 'Splat! Yuck, sticky! Turn your shield to the glow!',
  sky: 'Look up! Shield up! (Jump)',
  hero: 'Hero! Three perfect blocks!',
  joust: 'Steer your lance tip onto the gold star!',
  passes: ['Round 1: the star stands still. Aim and hold steady!', 'Round 2: the star slides round the shield. Follow it!', 'Round 3: the star slides fast, and it hops! Watch it wiggle.'],
  bullseye: 'Bullseye! Sir Splinter fell off!',
  clang: 'Clang! On the shield.',
  whoosh: 'Whoosh! Point your lance at the gold star!',
  bridge: 'Ta-ta-taa! The drawbridge is coming down!',
  port: 'The portcullis is up! Sir Clanksalot waits in the throne room.',
  maze: 'The hedge maze! The Tilt Yard is on the other side.',
};
const KIND_COLOUR = { pumpkin: 0xff8a1a, arrow: 0xffe14a, sky: 0xb48aff, big: 0xffd23a };
const CSS = c => `#${c.toString(16).padStart(6, '0')}`;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export class CastleLive {
  constructor(game, part) {
    this.game = game; this.part = part; this.world = game.world; this.scene = game.scene;
    this.cells = new LiveCells(this.world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;
    this.clock = 0; this.syncT = 0; this.told = new Set(); this.said = new Map(); this.mazeTime = 0;
    this.L = liveCells();
    this.seed = (this.world.seed ?? 1) >>> 0;
    // Shield Up!
    this.sg = null; this.stance = -1; this.sTries = [0, 0, 0]; this.sMiss = [0, 0, 0]; this.shieldIn = { ang: 0, up: false }; this.spaceWas = true; this.gooT = 9; this.gooAng = 0; this.lastResult = null;
    // the Joust
    this.jr = null; this.mounted = false; this.horse = { x: TILT.x0, dir: 1 }; this.ride = null; this.jTries = [0, 0, 0]; this.jMiss = [0, 0, 0];
    this.lanceIn = { su: 0, sv: 0, du: 0, dv: 0 }; this.tumbleT = 9; this.lastMeet = null; this.hits = []; this.hitsOf = null; this.callT = 0; this.lastCall = null;
    // the gates (null = not drawn yet; k = the animation 0 closed .. 1 open)
    this.drawn = { bridge: null, port: null, squire: null }; this.bridgeK = 0; this.portK = 0; this.announced = { bridge: false, port: false };
    this.stanceObj = this.makeStanceObj(); this.steedObj = this.makeSteedObj();
    this.groups = [];
    this.build();
    this.sync(true);
  }
  get hard() { return !!this.game.stars?.includes('castle'); }
  state() { return castleState(this.game); }
  shared() { return this.game.castleGates?.shared?.() ?? { bridge: false, port: false }; }
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  toast(m) { this.game.ui?.toast(m); }
  once(key, m) { if (this.told.has(key)) return; this.told.add(key); this.toast(m); }
  say(key, m, gap = CASTLE_RULES.sayGap) { const t = this.clock; if (t - (this.said.get(key) ?? -1e9) < gap) return; this.said.set(key, t); this.toast(m); }
  save() { this.game.save?.(); }
  addKey(k) { const g = this.game; if (!g.beaten.includes(k)) g.beaten.push(k); this.save(); }

  /* ---------------------------------------------- meshes ---------------------------------------------- */
  build() {
    const add = o => { this.groups.push(o); this.scene?.add(o); return o; };
    this.throws = add(buildThrows(16));
    this.rings = add(buildStoneRings(SIEGE.stones));
    this.cats = add(buildCatapults(12));
    this.knight = add(buildPracticeKnight());
    this.shieldRig = this.knight.userData.parts.shield; this.scene?.add(this.shieldRig);
    this.lance = add(buildLance()); this.lance.visible = false;
    this.held = add(buildHeldShield()); this.held.visible = false;
    this.bridgeMesh = add(buildDrawbridge(BRIDGE.x1 - BRIDGE.x0 + 1, BRIDGE.z1 - BRIDGE.z0 + 1));
    this.bridgeMesh.position.set(BRIDGE.hinge[0], BRIDGE.hinge[1], BRIDGE.hinge[2] + 0.3);
    this.portMesh = add(buildPortcullis(KEEP.door.x1 - KEEP.door.x0 + 1, KEEP.door.y1 - KEEP.door.y0 + 1));
    this.portMesh.position.set((KEEP.door.x0 + KEEP.door.x1 + 1) / 2, KEEP.door.y0, KEEP.door.z + 0.5);
    this.steed = null;
    try { this.steed = buildModel('gallantrot'); this.scene?.add(this.steed); } catch { this.steed = null; }
    this.fun = mazeExtras();
    this.shoes = add(buildHorseshoes(this.fun.treats.length)); this.critters = add(buildHedgeCritters(this.fun.peeks.length)); this.spray = add(buildFountainSpray(MAZE_FUN.drops));
    this.treatsGot = new Set(); this.peekT = this.fun.peeks.map(() => -99); // per trip: a new visit has the horseshoes back
    this.placeCatapults();
    this.drawKnight(); this.drawSteed();
  }
  dispose() {
    this.giveBack();
    this.game.ui?.setScore?.(null);
    this.game.ui?.setPointers?.(null);
    this.goo?.remove(); this.goo = null;
    this.callEl?.remove(); this.callEl = null;
    if (this.shieldRig) this.scene?.remove(this.shieldRig);
    for (const g of this.groups) { this.scene?.remove(g); g.userData.dispose?.(); }
    this.groups = [];
    this.setFov(JOUST_VIEW.fov);
    if (this.steed) { this.scene?.remove(this.steed); disposeModel(this.steed); this.steed = null; }
    if (this.game.rideShow === 'gallantrot') this.game.rideShow = null;
  }
  // puts the player down safely wherever a ride was holding them (a new world, a battle, a reload)
  giveBack() {
    const p = this.game.player;
    if (p?.carry && (p.carry === this.stanceObj || p.carry === this.steedObj)) {
      const at = p.carry.safe();
      p.carry = null; p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0);
    }
    this.stance = -1; this.sg = null; this.mounted = false; this.ride = null; this.jr = null;
    this.setFov(JOUST_VIEW.fov);
    if (this.game.rideShow === 'gallantrot') this.game.rideShow = null;
  }

  /* ---------------------------------------------- carry objects ---------------------------------------------- */
  makeStanceObj() {
    const me = this;
    const stand = () => SIEGE.stones[Math.max(0, me.stance)];
    return {
      where: () => { const s = stand(); return { x: s[0], y: s[1], z: s[2] }; },
      steer(wx, wz, analog, space) {
        const p = me.game.player;
        me.shieldIn.ang = analog > 0.4 ? Math.atan2(wx, wz) : Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw));
        me.shieldIn.up = !!space && me.running();
      },
      wantsLeave(space) { const fresh = !!space && !me.spaceWas; me.spaceWas = !!space; return fresh && !me.running(); },
      leave() { me.leaveStance(); },
      jumpWord: () => (me.running() ? 'Shield' : 'Off'),
      safe: () => { const s = stand(); return { x: s[0], y: s[1], z: s[2] + 3 }; },
    };
  }
  makeSteedObj() {
    const me = this;
    return {
      where: () => ({ x: me.horse.x, y: 11 + CASTLE_RULES.horseY, z: TILT.z }),
      steer(wx, wz, analog) {
        if (me.ride?.phase !== 'pass') { me.lanceIn.su = 0; me.lanceIn.sv = 0; return; }
        // the view is held along the lane: the stick's forward part moves the tip up, its sideways part sideways (right = +)
        const p = me.game.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
        me.lanceIn.sv = (wx * fx + wz * fz) * analog; me.lanceIn.su = (wx * rx + wz * rz) * analog;
      },
      look(dx, dy) { if (me.ride?.phase !== 'pass') return false; me.lanceIn.du += dx * JOUST.mouse; me.lanceIn.dv -= dy * JOUST.mouse; return true; },
      wantsLeave(space) { const fresh = !!space && !me.spaceWas; me.spaceWas = !!space; return fresh && me.ride?.phase === 'idle'; },
      leave() { me.getOff(); },
      jumpWord: () => (me.ride?.phase === 'idle' ? 'Off' : null),
      safe: () => ({ x: me.horse.x, y: 11, z: TILT.z - 2 }),
    };
  }
  running() { return !!this.sg && !this.sg.done; }

  /* ---------------------------------------------- the hooks of the live-part interface ---------------------------------------------- */
  near(p = this.game.player) {
    if (!p || this.game.inBattle || this.game.world !== this.world) return null;
    const st = this.state();
    if (this.stance >= 0) return this.running() ? 'Stop' : st.shield < SIEGE_ROUNDS ? 'Shield!' : null;
    if (this.mounted) return this.ride?.phase === 'idle' && !(this.jr?.done && st.lance >= JOUST_ROUNDS) ? 'Charge!' : null;
    if (p.carry) return null;
    if (stoneAt(p.pos) >= 0 && st.shield < SIEGE_ROUNDS) return 'Shield!';
    if (this.nearSteed(p.pos) && st.lance < JOUST_ROUNDS) return 'Mount!';
    return null;
  }
  use(p = this.game.player) {
    const w = this.near(p);
    if (!w) return false;
    if (w === 'Stop') { this.sg = null; this.toast('Stopped. Press Shield! to try again, or Jump to step off.'); return true; }
    if (w === 'Shield!') { if (this.stance < 0) this.enterStance(stoneAt(p.pos)); this.startRound(); return true; }
    if (w === 'Mount!') { this.mount(); return true; }
    if (w === 'Charge!') { this.charge(); return true; }
    return false;
  }
  aim(p) { return castleAim(this.world, p, this.game); }
  battleEnded(result, opts) {
    const pic = opts?.picture;
    if (pic?.id !== 'castle' || pic.crew != null || result !== 'won') return;
    const g = this.game; // a won battle with Sir Clanksalot clears the six rounds: a rematch plays them again (harder)
    for (let n = 1; n <= 3; n++) for (const k of [shieldKey(n), lanceKey(n)]) { const at = g.beaten.indexOf(k); if (at >= 0) g.beaten.splice(at, 1); }
    this.sMiss = [0, 0, 0]; this.jMiss = [0, 0, 0];
    this.save();
    this.sync(true);
  }

  /* ---------------------------------------------- Shield Up! ---------------------------------------------- */
  enterStance(i) {
    const g = this.game, p = g.player;
    if (i < 0) return;
    g.riding?.stop('quiet');
    this.stance = i; this.spaceWas = true;
    p.carry = this.stanceObj; p.vel.set(0, 0, 0);
    const w = this.stanceObj.where(); p.pos.set(w.x, w.y, w.z);
    p.lookAt?.({ x: 80.5, y: 14, z: 104 });
    this.once('stone', WORDS.stone);
  }
  leaveStance() {
    const p = this.game.player, at = this.stanceObj.safe();
    if (p.carry === this.stanceObj) { p.carry = null; p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0); }
    this.stance = -1; this.sg = null;
    this.game.ui?.setPointers?.(null);
  }
  startRound() {
    const st = this.state(), r = st.shield;
    if (r >= SIEGE_ROUNDS) { this.toast('You won Shield Up! The drawbridge is down.'); return; }
    this.sg = new SiegeRound(this.seed, r, this.sTries[r]++, Math.max(0, this.stance), { help: this.sMiss[r], hard: this.hard });
    this.perfectRow = 0;
    sound.play('trumpet');
    this.toast(`🛡️ ${WORDS.rounds[r]} Block ${this.sg.need} of ${this.sg.plan.n}!${fairHelp(this.sMiss[r]).on ? ' (A bit slower now.)' : ''}`);
  }
  stepSiege(dt) {
    const sg = this.sg;
    if (!sg || sg.done) return;
    const ev = sg.update(dt, this.shieldIn);
    for (const e of ev) {
      if (e.type === 'tell') { if (e.t.kind === 'sky') this.say('sky', WORDS.sky, 6); else if (e.t.kind !== 'arrow') sound.play('catapultcreak'); }
      else if (e.type === 'launch') sound.play(e.t.kind === 'arrow' ? 'bowtwang' : 'catapultthunk');
      else if (e.type === 'hit') {
        this.lastResult = e.result;
        if (e.result === 'splat') { sound.play('pumpkinsplat'); this.splatOn(e.t); this.say('splat', WORDS.splat); }
        else { sound.play('shieldclang'); if (e.row >= 3 && e.row % 3 === 0) this.toast(WORDS.hero); }
      } else if (e.type === 'done') this.roundDone(e);
    }
  }
  roundDone(e) {
    const r = this.sg.round;
    if (e.won) {
      this.sMiss[r] = 0;
      this.addKey(shieldKey(r + 1));
      sound.play('trumpet');
      const st = this.state();
      this.toast(`🛡️ Round ${r + 1} won! ${e.blocks} blocks. (🛡️ ${st.shield} / 3)`);
      if (st.shield >= SIEGE_ROUNDS) { this.toast(WORDS.bridge); sound.play('drawbridge'); this.sync(true); }
      else this.toast('Press Shield! for the next round.');
    } else {
      this.sMiss[r]++;
      this.toast(`So close! ${e.blocks} / ${e.need}. Press Shield! to try again.${fairHelp(this.sMiss[r]).on ? ' It will be a bit slower.' : ''}`);
    }
  }
  // the goo of a splat: orange and green blobs on the side of the screen it came from (owner 2026-10-28: never red)
  splatOn(t) {
    const p = this.game.player, stand = SIEGE.stones[Math.max(0, this.stance)];
    this.gooAng = t.kind === 'sky' ? 0 : this.relAngle(dirTo(stand, t.k), p);
    this.gooT = 0; this.gooUp = t.kind === 'sky';
  }
  relAngle(ang, p) { const view = Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw)); return -wrap(ang - view); } // + = to the right on screen
  drawGoo(dt) {
    if (typeof document === 'undefined') return;
    this.gooT += dt;
    const k = this.gooT / CASTLE_RULES.gooTime, on = k < 1;
    if (!this.goo && on) {
      const d = document.createElement('div');
      d.id = 'castle-goo';
      d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;overflow:hidden';
      const cols = ['#ff9a2a', '#8ad83a', '#ffb84a', '#6ac83a', '#ff8a1a', '#a8e05a'];
      for (let i = 0; i < 6; i++) { const b = document.createElement('div'); b.style.cssText = `position:absolute;border-radius:50%;background:${cols[i]};opacity:0.85;box-shadow:inset -6px -6px 0 rgba(0,0,0,0.12)`; d.appendChild(b); }
      document.body.appendChild(d); this.goo = d;
    }
    if (!this.goo) return;
    this.goo.style.display = on ? '' : 'none';
    if (!on) return;
    const a = this.gooUp ? 0 : this.gooAng, cx = 50 + Math.sin(a) * 38, cy = this.gooUp ? 8 : 50 - Math.cos(a) * 30;
    [...this.goo.children].forEach((b, i) => {
      const s = (6 + (i * 37) % 7) * (1 - 0.4 * k), ox = ((i * 53) % 11 - 5) * 1.6, oy = ((i * 29) % 9 - 4) * 1.6 + k * 6;
      b.style.width = `${s}vmin`; b.style.height = `${s * 0.85}vmin`; b.style.left = `calc(${cx + ox}% - ${s / 2}vmin)`; b.style.top = `calc(${cy + oy}% - ${s / 2}vmin)`; b.style.opacity = String(0.85 * (1 - k));
    });
  }

  /* ---------------------------------------------- the Joust ---------------------------------------------- */
  nearSteed(pos) { return Math.abs(pos.x - this.horse.x) < CASTLE_RULES.mountR && Math.abs(pos.z - TILT.z) < CASTLE_RULES.mountR && pos.y < 13; }
  mount() {
    const g = this.game, p = g.player;
    g.riding?.stop('quiet');
    this.mounted = true; this.ride = { phase: 'idle', tau: 0 }; this.spaceWas = true;
    p.carry = this.steedObj; p.vel.set(0, 0, 0);
    const w = this.steedObj.where(); p.pos.set(w.x, w.y, w.z);
    p.yaw = this.horse.dir > 0 ? -Math.PI / 2 : Math.PI / 2; p.pitch = -0.05;
    g.rideShow = 'gallantrot';
    this.once('joust', WORDS.joust);
    this.toast('Press Charge! to gallop at Sir Splinter.');
    if (!this.told.has('joustCall')) { this.told.add('joustCall'); this.callout('🎯 Hit the gold star!', 'Steer your lance tip (the white ring) onto it.', '#ffd84a', 3); }
  }
  getOff() {
    const p = this.game.player, at = this.steedObj.safe();
    if (p.carry === this.steedObj) { p.carry = null; p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0); }
    this.mounted = false; this.ride = null;
    if (this.game.rideShow === 'gallantrot') this.game.rideShow = null;
    this.setFov(JOUST_VIEW.fov);
  }
  charge() {
    const st = this.state();
    if (!this.mounted || this.ride?.phase !== 'idle') return;
    if (!this.jr || this.jr.done) {
      const r = Math.min(st.lance, JOUST_ROUNDS - 1);
      if (st.lance >= JOUST_ROUNDS) { this.toast('You won the Joust! The portcullis is up.'); return; }
      this.jr = new JoustRound(this.seed, r, this.jTries[r]++, { help: this.jMiss[r], hard: this.hard });
      this.toast(`🐴 ${WORDS.passes[r]} Get ${this.jr.need} points in 4 passes.${fairHelp(this.jMiss[r]).on ? ' (A bit easier now.)' : ''}`);
    }
    this.jr.charge();
    this.ride = { phase: 'pass', tau: 0, x0: this.horse.x };
    this.lanceIn = { su: 0, sv: 0, du: 0, dv: 0 };
    sound.play('trumpet');
    this.frameView(1); // the Charge! moment: the view snaps onto his shield
    this.callout('Charge!', this.jr.pass === 0 ? WORDS.joust : '', '#ffffff', 1.1);
  }
  laneX(s) { return Math.max(TILT.x0, Math.min(TILT.x1, this.ride.x0 + this.horse.dir * s)); }
  stepJoust(dt) {
    const ride = this.ride, jr = this.jr;
    if (!this.mounted || !ride || ride.phase === 'idle') return;
    const v = jr?.plan.gallop ?? JOUST.gallop[0];
    if (ride.phase === 'pass') {
      const ev = jr.update(dt, this.lanceIn);
      this.lanceIn.du = 0; this.lanceIn.dv = 0;
      ride.tau = jr.tau;
      for (const e of ev) {
        if (e.type === 'meet') {
          this.lastMeet = e;
          const off = this.hitWhere(jr, e.kind);
          if (e.kind === 'bullseye') { sound.play('lanceclang'); sound.play('trumpet'); this.tumbleT = 0; this.toast(`${WORDS.bullseye} +2`); this.callout('⭐ Bullseye! +2', 'Right on the star!', '#ffd84a'); }
          else if (e.kind === 'clang') { sound.play('lanceclang'); this.toast(`${WORDS.clang} +1`); this.callout('Clang! +1', `${off.word}. The star was ${off.fix}.`, '#e8eefc'); }
          else { sound.play('helmbonk'); this.say('whoosh', WORDS.whoosh, 0); this.callout('Whoosh!', `Missed: ${off.far}. The star was ${off.fix}.`, '#9fc8ff'); }
        } else if (e.type === 'passDone') ride.phase = 'return';
        else if (e.type === 'done') this.joustDone(e);
      }
    } else if (ride.phase === 'return') ride.tau += dt;
    else if (ride.phase === 'turn') { ride.tau += dt; if (ride.tau >= 1.2) { this.ride = { phase: 'idle', tau: 0 }; } }
    if (ride.phase === 'pass' || ride.phase === 'return') {
      const s = gallopAt(ride.tau, v), x = this.laneX(s);
      this.horse.x = x;
      if ((this.horse.dir > 0 && x >= TILT.x1) || (this.horse.dir < 0 && x <= TILT.x0)) {
        if (ride.phase === 'return') { this.horse.dir = -this.horse.dir; this.ride = { phase: 'turn', tau: 0 }; }
      }
    }
    // the camera: on his shield while you charge at him, along the lane after the meeting and on the way back
    if (this.ride && this.ride.phase !== 'idle' && this.game.player.carry === this.steedObj) this.frameView(Math.min(1, dt * JOUST_VIEW.turn));
  }
  // Where his shield is in the world (beside him, on your side of the tilt, a bit ahead of him).
  shieldPos(kp = this.knightPose()) { return new THREE.Vector3(kp.x + kp.dir * JOUST_VIEW.shieldOn, 11 + JOUST_VIEW.shieldUp, TILT.knightZ - JOUST_VIEW.shieldIn); }
  framing() { return !!(this.ride?.phase === 'pass' && this.jr && !this.jr.met); }
  // Turns the view k of the way to what it should look at (k = 1: at once).
  frameView(k) {
    const p = this.game.player, w = this.steedObj.where();
    p.pos.set(w.x, w.y, w.z);
    let yaw = this.horse.dir > 0 ? -Math.PI / 2 : Math.PI / 2, pitch = -0.05;
    if (this.framing()) {
      const s = this.shieldPos(), dx = s.x - w.x, dz = s.z - w.z, dy = s.y - (w.y + (p.eye ?? 1.62));
      yaw = Math.atan2(-dx, -dz); pitch = Math.atan2(dy, Math.hypot(dx, dz));
    }
    p.yaw += wrap(yaw - p.yaw) * k; p.pitch += (pitch - p.pitch) * k;
  }
  setFov(fov) { const cam = this.game.camera; if (cam && Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix?.(); } }
  // Where the last meeting hit, in words a child can use: { word: 'A bit too high', far: 'too high', fix: 'lower' }. On screen the
  // shield's u runs right to left (the tip moves the other way to the stick's left and right: the "reverse thinking" the owner liked).
  hitWhere(jr, kind) {
    const hit = jr.tipNow(), star = jr.starNow().at, sx = -(hit[0] - star[0]), sy = hit[1] - star[1];
    this.hits.push({ u: hit[0], v: hit[1], kind });
    const side = Math.abs(sx) >= Math.abs(sy), dirW = side ? (sx > 0 ? 'right' : 'left') : (sy > 0 ? 'high' : 'low');
    const fix = { right: 'more to the left', left: 'more to the right', high: 'lower', low: 'higher' }[dirW];
    return { word: side ? `A bit too far ${dirW}` : `A bit too ${dirW}`, far: side ? `too far ${dirW}` : `too ${dirW}`, fix, sx, sy };
  }
  // A big short word at the top middle of the screen (Charge!, Bullseye!, Clang!...), never over the shield.
  callout(big, small = '', colour = '#ffd84a', s = JOUST_VIEW.call) {
    this.lastCall = { big, small }; this.callT = s;
    if (typeof document === 'undefined') return;
    let el = this.callEl;
    if (!el) {
      el = this.callEl = document.createElement('div'); el.id = 'joust-call';
      el.style.cssText = 'position:fixed;left:0;right:0;top:61%;z-index:30;pointer-events:none;text-align:center;transition:opacity .25s;padding:0 16px';
      el.innerHTML = '<div style="font-family:\'Press Start 2P\',monospace;font-size:clamp(20px,5.5vw,42px);text-shadow:3px 3px 0 #2a1a50,0 0 18px rgba(0,0,0,.6)"></div><div style="font-size:clamp(15px,3vw,22px);margin-top:8px;color:#fff;text-shadow:2px 2px 0 #000"></div>';
      document.body.append(el);
    }
    el.children[0].textContent = big; el.children[0].style.color = colour; el.children[1].textContent = small; el.style.opacity = '1';
  }
  joustDone(e) {
    const r = this.jr.round;
    if (e.won) {
      this.jMiss[r] = 0;
      this.addKey(lanceKey(r + 1));
      const st = this.state();
      this.toast(`🐴 Round ${r + 1} won! ${e.points} points. (🐴 ${st.lance} / 3)`);
      if (st.lance >= JOUST_ROUNDS) { this.toast(WORDS.port); sound.play('drawbridge'); this.sync(true); }
    } else {
      this.jMiss[r]++;
      this.toast(`So close! ${e.points} / ${e.need} points. Press Charge! to try again.${fairHelp(this.jMiss[r]).on ? ' It will be a bit easier.' : ''}`);
    }
  }
  // Sir Splinter's place: his lane, coming at you during a pass, waiting at the far end otherwise.
  knightPose() {
    const ride = this.ride, jr = this.jr;
    if (ride?.phase === 'pass' && jr) {
      const T = jr.plan.meet, v = jr.plan.gallop, sMeet = gallopAt(T, v), far = this.horse.dir > 0 ? TILT.x1 : TILT.x0;
      const xMeet = this.laneX(sMeet) + this.horse.dir * JOUST_VIEW.lead, vk = Math.abs(far - xMeet) / T; // he meets you a bit ahead (the view)
      return { x: far - this.horse.dir * vk * ride.tau, dir: -this.horse.dir };
    }
    return { x: this.horse.dir > 0 ? TILT.x1 : TILT.x0, dir: -this.horse.dir };
  }

  /* ---------------------------------------------- the hedge maze's fun ---------------------------------------------- */
  stepMazeFun(p, dt) {
    const F = MAZE_FUN, G = 11, t = this.clock; // G here = the maze's floor (y 11: the grass is y 10, the hedges 11..13)
    // lucky horseshoes: +1 cube each, once per trip
    this.fun.treats.forEach((h, i) => {
      const o = this.shoes.userData.parts.list[i], got = this.treatsGot.has(i);
      o.visible = !got;
      if (got) return;
      o.position.set(h.x, G + 1.1 + 0.12 * Math.sin(t * 2.5 + i), h.z); o.rotation.y = t * 2 + i;
      if (!this.paused() && Math.hypot(p.pos.x - h.x, p.pos.z - h.z) < F.reach && p.pos.y < G + 2.5) {
        this.treatsGot.add(i); this.game.cubes += 1; sound.play('keyfound');
        this.toast(`🍀 A lucky horseshoe! +1 Capture Cube (${this.treatsGot.size} / ${this.fun.treats.length})`); this.game.ui?.renderHud?.();
      }
    });
    // hedge critters: pop up over a hedge post when you come near, giggle, look at you, duck again
    this.fun.peeks.forEach((c, i) => {
      const o = this.critters.userData.parts.list[i], d = Math.hypot(p.pos.x - c.x - 0.5, p.pos.z - c.z - 0.5), since = t - this.peekT[i];
      if (!this.paused() && d < F.peekR && since > F.peekUp + F.peekRest && inMaze(p.pos.x, p.pos.z)) { this.peekT[i] = t; sound.play('giftgiggle'); this.once('critter', '🌿 Hee hee! A hedge critter peeked at you!'); }
      const s = t - this.peekT[i], up = s < 0 ? 0 : s < F.rise ? s / F.rise : s < F.peekUp ? 1 : s < F.peekUp + F.rise ? 1 - (s - F.peekUp) / F.rise : 0;
      o.visible = up > 0.01;
      o.position.set(c.x + 0.5, G + 3 + 0.55 * up + 0.4, c.z + 0.5); // on the post's top (y 14), sunk into it when down
      o.rotation.y = Math.atan2(p.pos.x - c.x - 0.5, p.pos.z - c.z - 0.5); o.rotation.z = up * 0.15 * Math.sin(t * 9);
    });
    // the fountain's spray (closed form of the clock): drops in arcs from the spout, all round
    const D = this.spray.userData.parts.drops, M = new THREE.Matrix4(), f = this.fun.fountain;
    for (let k = 0; k < F.drops; k++) {
      const u = ((t / F.spray + k / F.drops) % 1), a = k * 2.399, r = 1.3 * u, y = G + 1.05 + 4.0 * u - 5.15 * u * u; // up from the spout, down into the pool
      M.makeTranslation(f.x + 0.5 + Math.cos(a) * r, y, f.z + 0.5 + Math.sin(a) * r); D.setMatrixAt(k, M);
    }
    D.instanceMatrix.needsUpdate = true;
  }

  /* ---------------------------------------------- the gates ---------------------------------------------- */
  sync(force = false) {
    const st = this.state(), sh = this.shared(), p = this.game.player;
    if (st.bridge && !this.announced.bridge) { this.announced.bridge = true; this.game.castleGates?.open('bridge'); }
    if (st.gate && !this.announced.port) { this.announced.port = true; this.game.castleGates?.open('port'); }
    const bridge = st.bridge || sh.bridge, port = st.gate || sh.port;
    const inYard = p && p.pos.x >= YARD.x0 && p.pos.x <= YARD.x1 + 1 && p.pos.z >= YARD.z0 && p.pos.z < SQUIRE_GATE.z0 && Math.abs(p.pos.x - (SQUIRE_GATE.x0 + 1)) < CASTLE_RULES.squireR;
    const squire = st.lance >= JOUST_ROUNDS || !!st.star || inYard;
    if (force || bridge !== this.drawn.bridge) {
      for (const c of this.L.deck) this.cells.want(...c, bridge ? B.PLANKS : B.AIR);
      for (const c of this.L.raised) this.cells.want(...c, bridge ? B.AIR : B.HOUSE_PROP);
      if (this.drawn.bridge === false && bridge && !force) sound.play('drawbridge');
      this.drawn.bridge = bridge;
    }
    if (force || port !== this.drawn.port) { for (const c of this.L.port) this.cells.want(...c, port ? B.AIR : B.HOUSE_PROP); this.drawn.port = port; }
    if (force || squire !== this.drawn.squire) { for (const c of this.L.squire) this.cells.want(...c, squire ? B.AIR : B.HEDGE); this.drawn.squire = squire; }
  }
  // Marks rounds as won (saved keys) for tests: shield s, lance l.
  winUpTo(s, l) {
    for (let n = 1; n <= s; n++) this.addKey(shieldKey(n));
    for (let n = 1; n <= l; n++) this.addKey(lanceKey(n));
    this.sync(true);
  }

  /* ---------------------------------------------- the frame ---------------------------------------------- */
  update(dt = 0) { if (!this.manual) this.step(dt); }
  step(dt, input = null) {
    const g = this.game, p = g.player;
    if (!p || g.world !== this.world) return;
    if (g.inBattle && (this.stance >= 0 || this.mounted)) this.giveBack();
    if (input?.shield) Object.assign(this.shieldIn, input.shield);
    if (input?.lance) Object.assign(this.lanceIn, input.lance);
    this.cells.flush();
    const step = Math.min(dt, CASTLE_RULES.dtMax);
    if (!this.paused()) {
      this.clock += step;
      this.stepSiege(step);
      this.stepJoust(step);
      if (inMaze(p.pos.x, p.pos.z)) { this.mazeTime += step; this.once('maze', WORDS.maze); } else if (p.pos.z < YARD.z1 + 1) this.mazeTime = 0;
    }
    this.syncT -= dt;
    if (this.syncT <= 0) { this.syncT = CASTLE_RULES.sync; this.sync(); }
    this.drawGoo(step);
    this.drawSiege(p);
    this.drawJoust(p, step);
    this.drawGates(step);
    this.stepMazeFun(p, step);
    this.refreshChip();
  }

  /* ---------------------------------------------- drawing ---------------------------------------------- */
  placeCatapults() {
    const P = this.cats.userData.parts, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3(1, 1, 1);
    this.catPose = [];
    for (let k = 0; k < 12; k++) {
      const s = spotPos(k), base = new THREE.Vector3(s[0], s[1] - 0.5, s[2]);
      const yaw = Math.atan2(SIEGE.centre[0] - s[0], SIEGE.centre[1] - s[2]); // face the field
      Q.setFromAxisAngle(Y, yaw);
      P.frames.setMatrixAt(k, M.compose(base, Q, S)); P.archers.setMatrixAt(k, M.compose(base, Q, S)); P.heads.setMatrixAt(k, M.compose(base, Q, S));
      this.catPose.push({ base, yaw });
    }
    for (const m of [P.frames, P.archers, P.heads]) m.instanceMatrix.needsUpdate = true;
    this.drawArms(new Map());
  }
  drawArms(active) { // the catapult arms: resting, pulled back in a throw's tell, flung forward at its launch
    const P = this.cats.userData.parts, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), S = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3();
    for (let k = 0; k < 12; k++) {
      const c = this.catPose[k], a = active.get(k);
      let pitch = 0.5; // resting, the bucket up behind
      if (a?.phase === 'tell') pitch = 0.5 - 0.9 * Math.min(1, a.u * 1.4);
      else if (a?.phase === 'fly') pitch = -0.4 + 1.6 * Math.min(1, a.u * 5);
      E.set(-pitch, c.yaw, 0); Q.setFromEuler(E);
      at.set(c.base.x, c.base.y + 0.4, c.base.z);
      P.arms.setMatrixAt(k, M.compose(at, Q, S)); P.buckets.setMatrixAt(k, M.compose(at, Q, S));
    }
    P.arms.instanceMatrix.needsUpdate = true; P.buckets.instanceMatrix.needsUpdate = true;
  }
  drawSiege(p) {
    const T = this.throws.userData.parts, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), Z = new THREE.Matrix4().makeScale(0, 0, 0);
    const list = this.sg && !this.sg.done ? this.sg.active() : [];
    let np = 0, na = 0;
    const active = new Map(), stand = SIEGE.stones[Math.max(0, this.stance)];
    for (const a of list) {
      active.set(a.t.k, a);
      if (a.phase !== 'fly' || !a.pos) continue;
      const pos = new THREE.Vector3(...a.pos);
      if (a.t.kind === 'arrow' && na < T.n) {
        const nx = throwAt(a.t, stand, this.sg.time + 0.02).pos || a.pos, dir = new THREE.Vector3(nx[0] - pos.x, nx[1] - pos.y, nx[2] - pos.z).normalize();
        Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); M.compose(pos, Q, S);
        T.arrows.setMatrixAt(na, M); T.cups.setMatrixAt(na, M); na++;
      } else if (np < T.n) {
        const sc = a.t.kind === 'big' ? 1.8 : 1; Q.set(0, 0, 0, 1); M.compose(pos, Q, new THREE.Vector3(sc, sc, sc));
        T.pumpkins.setMatrixAt(np, M); T.stems.setMatrixAt(np, M); np++;
      }
    }
    for (let i = np; i < T.n; i++) { T.pumpkins.setMatrixAt(i, Z); T.stems.setMatrixAt(i, Z); }
    for (let i = na; i < T.n; i++) { T.arrows.setMatrixAt(i, Z); T.cups.setMatrixAt(i, Z); }
    for (const m of [T.pumpkins, T.stems, T.arrows, T.cups]) m.instanceMatrix.needsUpdate = true;
    this.drawArms(active);
    // the lamp ring of the stone you stand on: the coming throws glow, the segment your shield faces is lighter
    const seg = this.rings.userData.parts.seg, col = new THREE.Color();
    for (let j = 0; j < SIEGE.stones.length; j++) for (let k = 0; k < 12; k++) {
      let c = 0x5a5a64;
      if (j === this.stance) {
        // segment k sits toward spot k (both from north, clockwise); a direction (sin ang, cos ang) is at theta = PI - ang from north
        const a = active.get(k), face = Math.round((((Math.PI - this.shieldIn.ang) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 6)) % 12;
        if (a) c = KIND_COLOUR[a.t.kind] ?? 0xff8a1a;
        else if (k === face) c = 0xd8dce6;
      }
      seg.setColorAt(j * 12 + k, col.setHex(c));
    }
    if (seg.instanceColor) seg.instanceColor.needsUpdate = true;
    // the pointers round the crosshair (the next three, where they are)
    if (this.stance >= 0 && list.length) {
      const next = list.slice().sort((a, b) => a.t.at - b.t.at).slice(0, 3);
      this.game.ui?.setPointers?.(next.map(a => ({ angle: a.t.kind === 'sky' ? 0 : this.relAngle(dirTo(stand, a.t.k), p), colour: CSS(KIND_COLOUR[a.t.kind] ?? 0xff8a1a), size: a.phase === 'fly' ? 1 : 0.4 })));
    } else this.game.ui?.setPointers?.(null);
    // the shield you hold (in front of the camera, turned toward where it points; overhead while Jump is held)
    const cam = this.game.camera, on = this.stance >= 0 && !!cam;
    this.held.visible = on;
    if (on) {
      const o = this.held, rel = this.relAngle(this.shieldIn.ang, p);
      o.position.copy(cam.position); o.quaternion.copy(cam.quaternion);
      if (this.shieldIn.up) { o.translateY(0.3); o.translateZ(-0.45); o.rotateX(-Math.PI / 2.4); }
      else { const r = Math.max(-1.2, Math.min(1.2, rel)); o.translateX(Math.sin(r) * 0.5); o.translateY(-0.3); o.translateZ(-0.75 * Math.cos(r) - 0.05); o.rotateY(-r); }
      o.scale.setScalar(0.38);
    }
  }
  drawSteed() {
    if (!this.steed) return;
    const p = this.game.player, riding = this.mounted;
    this.steed.position.set(this.horse.x, 11, TILT.z);
    this.steed.rotation.y = this.horse.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.steed.visible = !(riding && p?.carry === this.steedObj && this.firstPerson());
  }
  firstPerson() { return true; }
  drawKnight() {
    const kp = this.knightPose(), K = this.knight, parts = K.userData.parts;
    K.position.set(kp.x, 11, TILT.knightZ);
    K.rotation.y = kp.dir > 0 ? 0 : Math.PI; // faces +x when dir > 0
    // the tumble after a bullseye: he spins off his horse and pops back on
    const t = this.tumbleT;
    parts.body.rotation.z = t < 1.2 ? Math.sin(Math.min(1, t / 0.6) * Math.PI / 2) * 1.4 * (t < 0.9 ? 1 : (1.2 - t) / 0.3) : 0;
  }
  drawJoust(p, dt) {
    this.tumbleT += dt;
    this.drawSteed(); this.drawKnight();
    const jr = this.jr, K = this.knight.userData.parts, pass = !!(jr && this.ride?.phase === 'pass'), kp = this.knightPose();
    // his shield: beside him on your side, turned to face you, big (KNIGHT_SHIELD.scale); everything on it in the rules' units
    const S = this.shieldRig, sp = this.shieldPos(kp), cam = this.game.camera;
    S.position.copy(sp);
    const eye = p?.carry === this.steedObj ? p.eyePos.clone() : cam?.position ?? new THREE.Vector3(this.horse.x, 13.5, TILT.z); // (the camera follows the eye each frame)
    const wob = this.tumbleT < 1 ? Math.sin(this.tumbleT * 18) * 0.25 * (1 - this.tumbleT) : 0;
    S.rotation.set(0, Math.atan2(-(eye.z - sp.z), eye.x - sp.x), wob); // local +x (its face) toward you
    // the star and your aim dot (u + = the shield's local +z = the left of your screen, as before the view turned; v + = up)
    const star = pass ? jr.starNow() : { at: [0, 0], wiggle: false }, tip = pass ? jr.tipNow() : [0, 0];
    K.star.position.set(0.05, star.at[1], star.at[0]);
    K.star.rotation.x = star.wiggle ? Math.sin(this.clock * 40) * 0.4 : 0;
    K.ring.scale.setScalar(jr?.plan.r ?? JOUST.r[0]); // the bullseye ring: exactly the round's radius
    K.halo.scale.setScalar(1 + 0.18 * Math.sin(this.clock * 6));
    K.dot.visible = this.mounted && pass;
    K.dot.position.set(0.07, tip[1], tip[0]);
    if (this.hitsOf !== jr) { this.hitsOf = jr; this.hits = []; }
    K.marks.forEach((m, i) => {
      const h = this.hits[i];
      m.visible = !!h && h.kind !== 'whoosh' && this.mounted;
      if (h) { m.position.set(0.04, h.v, h.u); m.material.color.setHex(h.kind === 'bullseye' ? 0xffe680 : 0x4a4a58); m.scale.setScalar(h.kind === 'bullseye' ? 1.5 : 1); }
    });
    // the zoom: while you charge, the shield is about JOUST_VIEW.fill of the screen's height (never wider than the normal view)
    if (cam && this.mounted && p?.carry === this.steedObj) {
      const d = Math.max(1, eye.distanceTo(sp)), R = 0.8 * KNIGHT_SHIELD.scale;
      const want = this.framing() ? Math.max(JOUST_VIEW.fovMin, Math.min(JOUST_VIEW.fov, (2 * Math.atan(R / d) * 180 / Math.PI) / JOUST_VIEW.fill)) : JOUST_VIEW.fov;
      this.setFov(cam.fov + (want - cam.fov) * Math.min(1, dt * 4));
    }
    // your lance: from your right hand on his side toward the white ring; in the last moment before the meeting it thrusts onto it
    const on = this.mounted && !!cam;
    this.lance.visible = on;
    if (on) {
      const side = Math.sign(TILT.knightZ - TILT.z) || 1;
      const hand = new THREE.Vector3(this.horse.x - this.horse.dir * 0.2, 11 + CASTLE_RULES.horseY + 0.95, TILT.z + 0.6 * side); // below and beside the eye: out of view
      let aimAt;
      if (pass) { S.updateMatrixWorld(true); aimAt = K.dot.getWorldPosition(new THREE.Vector3()); }
      else aimAt = new THREE.Vector3(this.horse.x + this.horse.dir * 6, 11 + CASTLE_RULES.shieldY, TILT.z + 2 * side);
      this.lance.position.copy(hand);
      this.lance.lookAt(aimAt);
      this.lance.rotateY(Math.PI); // the lance points along its -z
      const left = pass ? jr.plan.meet - Math.min(jr.tau, jr.plan.meet) : 9, k = Math.max(0, Math.min(1, 1 - left / JOUST_VIEW.thrust));
      const len = Math.max(JOUST_VIEW.lance, JOUST_VIEW.lance + (hand.distanceTo(aimAt) - JOUST_VIEW.lance) * k * k * (jr?.met ? 0 : 1));
      this.lance.scale.set(1, 1, len / JOUST_VIEW.lance);
    }
    // the callout fades
    if (this.callT > 0) { this.callT -= dt; if (this.callT <= 0 && this.callEl) this.callEl.style.opacity = '0'; }
  }
  drawGates(dt) {
    const bridge = !!this.drawn.bridge, port = !!this.drawn.port;
    this.bridgeK += ((bridge ? 1 : 0) - this.bridgeK) * Math.min(1, dt / CASTLE_RULES.bridgeTime * 3);
    if (Math.abs((bridge ? 1 : 0) - this.bridgeK) < 0.002) this.bridgeK = bridge ? 1 : 0;
    const P = this.bridgeMesh.userData.parts;
    P.leaf.rotation.x = -(1 - this.bridgeK) * Math.PI / 2; // up = turned up against the gate
    for (const c of P.chains) { c.position.set(c.position.x, 2.5 * (1 - this.bridgeK) + 1.2, 1.2 + this.bridgeK * 1.2); c.rotation.x = 0.6 * this.bridgeK; }
    this.portK += ((port ? 1 : 0) - this.portK) * Math.min(1, dt / CASTLE_RULES.portTime * 3);
    this.portMesh.position.y = KEEP.door.y0 + this.portK * 4.6;
  }
  refreshChip() {
    const ui = this.game.ui;
    if (!ui?.setScore || this.game.world !== this.world) return;
    const st = this.state(), sg = this.sg, jr = this.jr;
    if (sg && !sg.done) { ui.setScore({ text: `🛡️ Round ${sg.round + 1} · ${sg.blocks} / ${sg.need} · ${sg.left} to come`, done: false }); return; }
    if (this.mounted && jr && !jr.done) { ui.setScore({ text: `🐴 Round ${jr.round + 1} · Pass ${Math.max(1, jr.pass + 1)} / 4 · ⭐ ${jr.points} / ${jr.need}`, done: false }); return; }
    const ready = st.done && !this.game.bosses?.crewAim?.(this.game.player.pos);
    ui.setScore({ text: ready && !st.star ? '🏰 The throne room is open!' : `🛡️ ${st.shield} / 3 · 🐴 ${st.lance} / 3`, done: !!(ready && !st.star) });
  }

  // For tests.
  info() {
    const sg = this.sg, jr = this.jr;
    return {
      stance: this.stance, running: this.running(), round: sg?.round ?? null, blocks: sg?.blocks ?? 0, need: sg?.need ?? 0, time: sg?.time ?? 0, done: sg?.done ?? null, won: sg?.won ?? null,
      shield: { ...this.shieldIn }, mounted: this.mounted, ride: this.ride?.phase ?? null, horse: { ...this.horse }, joust: jr ? { round: jr.round, pass: jr.pass, points: jr.points, need: jr.need, done: jr.done, won: jr.won, tau: jr.tau, results: jr.results.slice() } : null,
      drawn: { ...this.drawn }, mazeTime: this.mazeTime, treats: this.treatsGot.size, peeking: this.peekT.filter(x => this.clock - x < MAZE_FUN.peekUp).length, sMiss: this.sMiss.slice(), jMiss: this.jMiss.slice(), lastResult: this.lastResult, lastMeet: this.lastMeet ? { kind: this.lastMeet.kind, d: this.lastMeet.d } : null, gooT: this.gooT,
    };
  }
}
