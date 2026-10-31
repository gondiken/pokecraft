// Wave 18: the live part of the Mirror Palace (LIVE.mirror, made by gymLive.reset for the part in world.parts), plans/wave18-mirror.md. It wires the three pure
// games to the player, the meshes (mirrorprops.js) and the world:
//  - Bounce-Back (bounceback.js): "Play!" on the plate in front of the court puts you on the rail (a `carry`: the stick slides you, the way you look tilts your hand mirror,
//    Jump steps off); three rounds against Copycat Cleo, each saved at once (pw:mirror:court1..3).
//  - the Looking-Glass Rooms (lookingglass.js): no button; stepping onto a room's start pad starts it. Your silver twin on the other side of the glass moves on every walk
//    sub-step you take (`player.stepHook`); pad pairs, ink puddles, bonk balls and the mop; each room won opens its doors (LiveCells) and is saved (pw:mirror:twin1..3).
//  - the Moonlit Gallery (spotlight.js): "Shine!" on the dais puts you at the sun mirror (a `carry`: your look turns the beam, which bounces off the shiny panes); keep the spot
//    on the Gloomies until they poof (pw:mirror:beam1..3).
//  - the Hall of Funny Mirrors: your reflection in tall / wide / tiny / wobbly / upside-down / two-of-you versions, drawn only close to each mirror, just for laughs.
// Owner rules (plans/wave18-mirror.md 1): a miss never fails (a round starts again, kind help after two), every game stays playable for fun once won (forfun.js, nothing new saved),
// clocks are summed dt in fixed sub-steps and stand still in a battle / an ask / a panel / the pause, a won Duke Dazzle battle clears the nine round keys (the crew's stay).
// `manual` + step(dt, input) and info() for tests; nothing is sent in play together (each player plays their own court, twin and Gloomies).
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';
import { disposeModel } from './species.js';
import { buildPerson } from './npc.js';
import { BounceRound, COURT_RULES, COURT_ROUNDS } from './bounceback.js';
import { TwinRoom, TWIN_RULES, ballU, mopAngle } from './lookingglass.js';
import { SpotRound, SPOT_RULES, SPOT_ROUNDS, BEAM, beamOf, dirOf } from './spotlight.js';
import { mirrorState, courtKey, twinKey, beamKey, mirrorAim, G, COURT, TWIN, TWIN_ROOMS, FUNNY, FUNHALL, DAIS, GALLERY, GLOOMY_WALL, liveCells, yourX, twinX } from './mirrorland.js';
import { kindHelp } from './kindhelp.js';
import { ForFun } from './forfun.js';
import * as P from './mirrorprops.js';

export const MIRROR_RULES = { dtMax: 0.1, sync: 0.25, plateAt: [27.5, 119.5], plateR: 3.5, startR: 0.9, sunR: [3.0, 2.8], funnyR: 6, wave: 1.4, shiverGap: 0.45, poofTime: 0.7, outTwin: 0.6, jumpCool: 0.35 };
const WORDS = {
  court: 'Bounce it past Cleo! She copies you.', twin: 'You and your twin: both on the gold pads!', beam: 'Shine on the Gloomies till they pop!',
  puff: ['Blub! Back to the last gold pad.', 'Bonk! Back to the last gold pad.'],
};
const OUTFIT = { shirt: 0x3b6fd8, pants: 0x2a2a3a, hair: 0x3a2a1a, skin: 0xe8b98a }; // (what the page draws you in, as the Cube Planets' steady camera does)
const rad = d => d * Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const CX = 20, CZ = 117.5, G1 = G + 1; // the court: x = 20 + u, z = 117.5 - v
const courtXZ = (u, v) => [CX + u, CZ - v];
export const VIS = { gloomy: 1.9, fovSun: 44, fovRail: 62, fov: 75, fovRate: 4 }; // what is drawn bigger / how the camera zooms (only drawing: the rules use the real sizes)
export const VIEW = { yaw: rad(55), pitchMin: rad(-35), pitchMax: rad(10), sunStart: 0.06 };

export class MirrorLive {
  constructor(game, part) {
    this.game = game; this.part = part; this.world = game.world; this.scene = game.scene;
    this.cells = new LiveCells(this.world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;
    this.clock = 0; this.syncT = 0; this.told = new Set(); this.said = new Map(); this.L = liveCells();
    this.seed = (this.world.seed ?? 1) >>> 0;
    // Bounce-Back
    this.br = null; this.rail = false; this.railM = 8; this.slideIn = 0; this.spaceWas = true; this.cFun = new ForFun(COURT_ROUNDS); this.cTries = [0, 0, 0]; this.cMiss = [0, 0, 0]; this.cleoDizzy = 0; this.cleoCheer = 0; this.cleoPout = 0;
    // the Looking-Glass Rooms
    this.room = null; this.roomN = 0; this.tTries = [0, 0, 0]; this.tMiss = [0, 0, 0]; this.tFun = new ForFun(TWIN_RULES.rooms); this.wave = 0; this.outT = 0; this.twinMoved = 0; this.drawnDoors = [null, null, null]; this.jumpCool = 0;
    // the Moonlit Gallery
    this.sr = null; this.shining = false; this.bFun = new ForFun(SPOT_ROUNDS); this.bTries = [0, 0, 0]; this.bMiss = [0, 0, 0]; this.stick = { yaw: 0, pitch: 0 }; this.shiverT = 0; this.poofs = []; this.lastSpot = null;
    this.railObj = this.makeRailObj(); this.sunObj = this.makeSunObj();
    this.groups = []; this.funny = [];
    this.beamWorld = { isSolid: (x, y, z) => this.world.isSolid(x, y, z), isPane: (x, y, z) => this.world.get(x, y, z) === B.MIRROR_PANE };
    this.build();
    this.sync(true);
  }
  get hard() { return !!this.game.stars?.includes('mirror'); }
  state() { return mirrorState(this.game); }
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  toast(m) { this.game.ui?.toast(m); }
  once(key, m) { if (this.told.has(key)) return; this.told.add(key); this.toast(m); }
  say(key, m, gap = 3) { const t = this.clock; if (t - (this.said.get(key) ?? -1e9) < gap) return; this.said.set(key, t); this.toast(m); }
  save() { this.game.save?.(); }
  addKey(k) { const g = this.game; if (!g.beaten.includes(k)) g.beaten.push(k); this.save(); }

  /* ---------------------------------------------- meshes ---------------------------------------------- */
  build() {
    const add = o => { this.groups.push(o); this.scene?.add(o); return o; };
    // Bounce-Back
    this.hand = add(P.buildHandMirror(0.45)); this.hand.visible = false;
    this.ball = add(P.buildShineBall(0.35)); this.ball.visible = false;
    this.cleoMirror = add(P.buildHandMirror(0.8)); this.cleoMirror.visible = false;
    this.cleo = add(buildPerson({ shirt: 0xff9ad8, pants: 0x4a4a6a, hair: 0x2a1a10, skin: 0xc68a5a })); this.cleo.visible = false;
    this.spinner = add(P.buildSpinner(COURT_RULES.spinner.half * 2)); this.spinner.visible = false;
    this.railMesh = add(P.buildRail(COURT_RULES.rail[1] - COURT_RULES.rail[0] + 1.6)); this.railMesh.position.set(CX + COURT_RULES.rail[0] - 0.8, G1, CZ - COURT_RULES.mirrorV);
    this.plate = add(P.buildPlate(1.0)); this.plate.position.set(MIRROR_RULES.plateAt[0], G1 + 0.03, MIRROR_RULES.plateAt[1]);
    // the Looking-Glass Rooms
    this.twin = add(P.buildTwin()); this.twin.visible = false; this.twin.userData.t = 0;
    this.pads = []; this.puddles = []; this.balls = []; this.mops = []; this.starts = [];
    TWIN_ROOMS.forEach((rm, i) => {
      const z0 = TWIN.rooms[i].z0;
      rm.pads.forEach((pr, j) => {
        const a = add(P.buildPad(0.7)), b = add(P.buildPad(0.7));
        a.position.set(yourX(pr.you[0]), G1 + 0.02, z0 + pr.you[1]); b.position.set(twinX(pr.its[0]), G1 + 0.02, z0 + pr.its[1]);
        b.userData.parts.mat.color.setHex(0xe8d890); this.pads.push({ n: i, j, you: a, its: b });
      });
      const st = add(P.buildPad(0.9)); st.position.set(yourX(rm.start[0]), G1 + 0.02, z0 + rm.start[1]); st.userData.parts.mat.color.setHex(0xfff2b0); this.starts.push(st);
      rm.puddles.forEach(pd => { const m = add(P.buildPuddle(pd.r)); this.puddles.push({ n: i, pd, m }); });
      rm.balls.forEach(bl => { const m = add(P.buildBonkBall(0.9)); this.balls.push({ n: i, bl, m }); });
      if (rm.mop) { const m = add(P.buildMop(rm.mop.len)); this.mops.push({ n: i, mop: rm.mop, m }); }
    });
    // the Moonlit Gallery
    this.sun = add(P.buildSunMirror()); this.sun.position.set(...SPOT_RULES.sun);
    this.sunShaft = add(P.buildShaft(0xfff4c0, 0.5)); this.shafts = [0, 1, 2].map(() => add(P.buildShaft(0xfff0b0, 0.22)));
    this.spotMesh = add(P.buildSpot(SPOT_RULES.spotR)); this.spotMesh.visible = false;
    this.glooms = add(P.buildGloomies(4)); this.poofMesh = add(P.buildPoofs(40));
    // the funny mirrors
    for (const f of FUNNY) {
      const al = add(P.buildAlcove(f.w, 5.2, 1.0)), wz = f.facing[1] > 0 ? FUNHALL.z0 + 1 : FUNHALL.z1;
      al.position.set(f.x + 0.5, G1, wz); al.rotation.y = f.facing[1] > 0 ? 0 : Math.PI;
      const mk = () => { const a = buildPerson(OUTFIT); a.userData.keepColour = true; al.add(a); a.visible = false; return a; };
      this.funny.push({ f, al, a: mk(), b: f.kind === 'twins' ? mk() : null, wz });
    }
    this.placeStarts();
  }
  placeStarts() { for (const s of this.starts) s.userData.parts.halo.material.opacity = 0.5; }
  dispose() {
    this.giveBack();
    this.game.ui?.setScore?.(null); this.game.ui?.setPointers?.(null);
    this.setFov(VIS.fov);
    for (const g of this.groups) { this.scene?.remove(g); if (g.userData.dispose) g.userData.dispose(); else disposeModel(g); }
    this.groups = [];
  }
  // puts the player down safely wherever a stance was holding them (a new world, a battle, a reload) and takes the twin's hook away
  giveBack() {
    const p = this.game.player;
    if (p?.carry && (p.carry === this.railObj || p.carry === this.sunObj)) { const at = p.carry.safe(); p.carry = null; p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0); }
    if (p && p.stepHook === this.hook) p.stepHook = null;
    this.rail = false; this.br = null; this.shining = false; this.sr = null; this.room = null; this.roomN = 0; this.zooming = true;
    for (const t of [this.twin, this.hand, this.ball, this.cleo, this.cleoMirror, this.spinner]) if (t) t.visible = false;
  }

  /* ---------------------------------------------- the stances ---------------------------------------------- */
  makeRailObj() {
    const me = this;
    return {
      where: () => ({ x: CX + me.railM, y: G1, z: CZ - COURT_RULES.mirrorV }),
      steer(wx, wz, analog, space) {
        const p = me.game.player, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
        me.slideIn = clamp((wx * c - wz * s) * analog, -1, 1); me.spaceNow = !!space; // across the court = the stick's sideways part
      },
      look(dx, dy) { const p = me.game.player; p.yaw = clamp(p.yaw - dx * 0.0022, -VIEW.yaw, VIEW.yaw); p.pitch = clamp(p.pitch - dy * 0.0022, VIEW.pitchMin, VIEW.pitchMax); return true; },
      wantsLeave(space) { const fresh = !!space && !me.spaceWas; me.spaceWas = !!space; return fresh; },
      leave() { me.leaveRail(); },
      jumpWord: () => 'Off',
      safe: () => ({ x: MIRROR_RULES.plateAt[0], y: G1, z: MIRROR_RULES.plateAt[1] + 1.2 }),
    };
  }
  makeSunObj() {
    const me = this;
    return {
      where: () => ({ x: DAIS.x + 0.5, y: DAIS.y + 1, z: DAIS.z + 1.5 }),
      steer(wx, wz, analog, space) { // the stick turns the beam too (iPad): across = yaw, forward = pitch
        const p = me.game.player, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
        me.stick.yaw = -clamp((wx * c - wz * s) * analog, -1, 1); me.stick.pitch = clamp((-wx * s - wz * c) * analog, -1, 1);
      },
      look(dx, dy) { const p = me.game.player; p.yaw = clamp(p.yaw - dx * 0.0022, -BEAM.yawMax, BEAM.yawMax); p.pitch = clamp(p.pitch - dy * 0.0022, BEAM.pitchMin, BEAM.pitchMax); return true; },
      wantsLeave(space) { const fresh = !!space && !me.spaceWas; me.spaceWas = !!space; return fresh; },
      leave() { me.leaveSun(); },
      jumpWord: () => 'Off',
      safe: () => ({ x: DAIS.x + 0.5, y: DAIS.y, z: DAIS.z + 3.5 }),
    };
  }

  /* ---------------------------------------------- the hooks of the live-part interface ---------------------------------------------- */
  near(p = this.game.player) {
    if (!p || this.game.inBattle || this.game.world !== this.world) return null;
    if (this.rail) return this.br && !this.br.done ? 'Stop' : 'Play!';
    if (this.shining) return this.sr && !this.sr.done ? 'Stop' : 'Shine!';
    if (p.carry) return null;
    const [px, pz] = MIRROR_RULES.plateAt;
    if (p.pos.y < 13.5 && p.pos.z > COURT.walls.near && Math.hypot(p.pos.x - px, p.pos.z - pz) < MIRROR_RULES.plateR) return 'Play!';
    if (p.pos.y < 13.5 && Math.abs(p.pos.x - (DAIS.x + 0.5)) < MIRROR_RULES.sunR[0] && Math.abs(p.pos.z - (DAIS.z + 0.5)) < MIRROR_RULES.sunR[1]) return 'Shine!';
    return null;
  }
  use(p = this.game.player) {
    const w = this.near(p);
    if (!w) return false;
    if (w === 'Stop') { if (this.rail) this.br = null; else this.sr = null; this.toast('Stopped. Press the button to try again, or Jump to step off.'); return true; }
    if (w === 'Play!') { if (!this.rail) this.enterRail(); this.startCourt(); return true; }
    if (w === 'Shine!') { if (!this.shining) this.enterSun(); this.startBeam(); return true; }
    return false;
  }
  aim(p) { return mirrorAim(this.world, p, this.game); }
  battleEnded(result, opts) {
    const pic = opts?.picture;
    if (pic?.id !== 'mirror' || pic.crew != null || result !== 'won') return;
    const g = this.game; // a won battle with Duke Dazzle clears the nine round keys (the crew's stay): a rematch plays the games again, harder
    for (let n = 1; n <= 3; n++) for (const k of [courtKey(n), twinKey(n), beamKey(n)]) { const at = g.beaten.indexOf(k); if (at >= 0) g.beaten.splice(at, 1); }
    this.cMiss = [0, 0, 0]; this.tMiss = [0, 0, 0]; this.bMiss = [0, 0, 0];
    this.save(); this.sync(true);
  }

  /* ---------------------------------------------- Bounce-Back ---------------------------------------------- */
  enterRail() {
    const g = this.game, p = g.player;
    g.riding?.stop('quiet');
    this.rail = true; this.spaceWas = true; this.railM = 8; this.slideIn = 0;
    p.carry = this.railObj; p.vel.set(0, 0, 0);
    const w = this.railObj.where(); p.pos.set(w.x, w.y, w.z); p.yaw = 0; p.pitch = -0.2;
    this.once('court', WORDS.court);
  }
  leaveRail() {
    const p = this.game.player, at = this.railObj.safe();
    if (p.carry === this.railObj) { p.carry = null; p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0); }
    this.rail = false; this.br = null; this.cleoPout = 1;
  }
  startCourt() {
    const st = this.state(), r = this.cFun.round(st.court);
    this.br = new BounceRound(this.seed, r, this.cTries[r]++, { help: this.cMiss[r], hard: this.hard }); this.br.m = this.railM;
    sound.play('trumpet');
    this.toast(`🏓${this.cFun.tag(st.court)} ${this.br.plan.name} First to 3!${kindHelp(this.cMiss[r]).on ? ' (A bit slower now.)' : ''}`);
  }
  stepCourt(dt) {
    const br = this.br, p = this.game.player;
    if (!br || br.done || !this.rail) return;
    const tilt = clamp(-p.yaw, -COURT_RULES.tiltMax, COURT_RULES.tiltMax);
    const ev = br.update(dt, { slide: this.input?.slide ?? this.slideIn, tilt: this.input?.tilt ?? tilt });
    this.railM = br.m;
    for (const e of ev) {
      if (e.type === 'hit' || e.type === 'cleohit') sound.play('shineping');
      else if (e.type === 'bounce' || e.type === 'spin') sound.play('shineping');
      else if (e.type === 'dizzy') this.cleoDizzy = 1.2;
      else if (e.type === 'point') {
        if (e.who === 'you') { sound.play('mirrorpoint'); this.cleoPout = 1.2; this.toast(`🏓 Point! ${e.you} – ${e.cleo}`); } else { sound.play('cleopoint'); this.cleoCheer = 1.2; this.toast(`Copy that! ${e.you} – ${e.cleo}`); }
      } else if (e.type === 'done') this.courtDone(e);
    }
  }
  courtDone(e) {
    const r = this.br.round, st = this.state();
    if (e.won && this.cFun.done(st.court)) { this.cMiss[r] = 0; this.cFun.won(r, COURT_ROUNDS); sound.play('trumpet'); this.toast(`🏓 Round ${r + 1} won again! Just for fun! Press Play! to play on.`); }
    else if (e.won) {
      this.cMiss[r] = 0; this.addKey(courtKey(r + 1)); sound.play('trumpet');
      const s2 = this.state();
      this.toast(`🏓 Round ${r + 1} won! (🏓 ${s2.court} / 3)`);
      this.toast(s2.court >= COURT_ROUNDS ? 'Bounce-Back is won! Copycat Cleo wants a battle.' : 'Press Play! for the next round.');
    } else { this.cMiss[r]++; this.toast(`Cleo won this one! Press Play! to try again.${kindHelp(this.cMiss[r]).on ? ' It will be a bit slower.' : ''}`); }
  }

  /* ---------------------------------------------- the Looking-Glass Rooms ---------------------------------------------- */
  roomAt(p) { for (let i = 0; i < 3; i++) { const z0 = TWIN.rooms[i].z0; if (p.pos.x >= TWIN.yours.x0 && p.pos.x < TWIN.yours.x1 + 1 && p.pos.z >= z0 && p.pos.z < z0 + 16 && p.pos.y < 14) return i + 1; } return 0; }
  twinBlocked(n) { const z0 = TWIN.rooms[n - 1].z0, w = this.world; return (u, v) => w.isSolid(Math.floor(twinX(u)), G1, Math.floor(z0 + v)); }
  startRoom(n) {
    const g = this.game, p = g.player, z0 = TWIN.rooms[n - 1].z0, data = TWIN_ROOMS[n - 1];
    g.riding?.stop('quiet');
    this.room = new TwinRoom(data, { help: this.tMiss[n - 1], hard: this.hard, blocked: this.twinBlocked(n), phase: this.tTries[n - 1]++ * 1.7 });
    this.roomN = n;
    this.room.begin({ u: 128 - p.pos.x, v: p.pos.z - z0 });
    p.stepHook = this.hook; this.wave = MIRROR_RULES.wave; this.twin.visible = true; this.outT = 0;
    sound.play('padglow');
    this.once('twin', WORDS.twin);
    this.toast(`👯${this.tFun.tag(this.state().twin)} ${data.name}${kindHelp(this.tMiss[n - 1]).on ? ' (A bit slower now.)' : ''}`);
  }
  endRoom() {
    const p = this.game.player;
    if (p && p.stepHook === this.hook) p.stepHook = null;
    this.room = null; this.roomN = 0; this.twin.visible = false;
  }
  // The player's walk sub-step (Player.stepHook): the real move (dx, dz) after it, the twin copies it mirrored (u = 128 - x, so du = -dx)
  hook = (dx, dz, h) => {
    const r = this.room, p = this.game.player;
    if (!r) return;
    const z0 = TWIN.rooms[this.roomN - 1].z0, you = { u: 128 - p.pos.x, v: p.pos.z - z0 };
    this.twinMoved = Math.abs(dx) + Math.abs(dz) > 1e-9 ? 1 : this.twinMoved;
    const ev = r.tick(h, you, -dx, dz);
    for (const e of ev) {
      if (e.type === 'glow') { sound.play('padglow'); this.toast(`👯 Pair ${e.i + 1} glows! (${r.lit.filter(Boolean).length} / ${r.lit.length})`); }
      else if (e.type === 'puff') {
        p.pos.set(128 - e.you[0], p.pos.y, z0 + e.you[1]); p.vel.set(0, 0, 0);
        sound.play(e.why === 'plop' ? 'twinplop' : 'twinbonk'); this.tMiss[this.roomN - 1]++;
        this.say('puff', e.why === 'plop' ? WORDS.puff[0] : WORDS.puff[1], 1.5);
      } else if (e.type === 'won') this.roomWon();
    }
  };
  roomWon() {
    const n = this.roomN, st = this.state(), had = this.game.beaten.includes(twinKey(n));
    this.tMiss[n - 1] = 0; sound.play('trumpet');
    if (had || this.tFun.done(st.twin)) { this.tFun.won(n - 1, TWIN_RULES.rooms); this.toast(`👯 Room ${n} done again! Just for fun!`); return; }
    this.addKey(twinKey(n)); this.sync(true);
    const s2 = this.state();
    this.toast(`👯 ${TWIN_ROOMS[n - 1].name} won! (👯 ${s2.twin} / 3)`);
    this.toast(s2.twin >= 3 ? 'The Looking-Glass Rooms are won! Glazier Gwen wants a battle.' : 'The door is open! On to the next room.');
  }
  stepTwin(dt, p) {
    this.jumpCool = Math.max(0, this.jumpCool - dt);
    const n = this.roomAt(p);
    if (this.room) {
      // walking back out of the room stops it (the twin waves bye)
      if (n !== this.roomN) { this.outT += dt; if (this.outT > MIRROR_RULES.outTwin) this.endRoom(); } else this.outT = 0;
    } else if (n && !p.carry) {
      const rm = TWIN_ROOMS[n - 1], z0 = TWIN.rooms[n - 1].z0, st = this.state();
      if (n <= st.twin + 1 && Math.hypot(p.pos.x - yourX(rm.start[0]), p.pos.z - (z0 + rm.start[1])) < MIRROR_RULES.startR) this.startRoom(n);
    }
  }

  /* ---------------------------------------------- the Moonlit Gallery ---------------------------------------------- */
  enterSun() {
    const g = this.game, p = g.player;
    g.riding?.stop('quiet');
    this.shining = true; this.spaceWas = true; this.stick = { yaw: 0, pitch: 0 };
    p.carry = this.sunObj; p.vel.set(0, 0, 0);
    const w = this.sunObj.where(); p.pos.set(w.x, w.y, w.z); p.yaw = 0; p.pitch = VIEW.sunStart;
    this.once('beam', WORDS.beam);
  }
  leaveSun() {
    const p = this.game.player, at = this.sunObj.safe();
    if (p.carry === this.sunObj) { p.carry = null; p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0); }
    this.shining = false; this.sr = null;
  }
  startBeam() {
    const st = this.state(), r = this.bFun.round(st.beam), p = this.game.player;
    this.sr = new SpotRound(this.seed, r, this.bTries[r]++, { help: this.bMiss[r], hard: this.hard, world: this.beamWorld }); this.sr.yaw = p.yaw; this.sr.pitch = p.pitch;
    sound.play('trumpet');
    this.toast(`🔦${this.bFun.tag(st.beam)} ${this.sr.plan.name} ${this.sr.alive().length} Gloomies!${kindHelp(this.bMiss[r]).on ? ' (A bit slower now.)' : ''}`);
  }
  stepBeam(dt) {
    const sr = this.sr, p = this.game.player;
    if (!sr || sr.done || !this.shining) return;
    if (this.stick.yaw || this.stick.pitch) { p.yaw = clamp(p.yaw + this.stick.yaw * SPOT_RULES.stick * dt, -BEAM.yawMax, BEAM.yawMax); p.pitch = clamp(p.pitch + this.stick.pitch * SPOT_RULES.stick * dt, BEAM.pitchMin, BEAM.pitchMax); }
    const ev = sr.update(dt, { yaw: this.input?.yaw ?? p.yaw, pitch: this.input?.pitch ?? p.pitch });
    this.shiverT -= dt;
    if (sr.alive().some(g => g.lit) && this.shiverT <= 0) { this.shiverT = MIRROR_RULES.shiverGap; sound.play('gloomyshiver'); }
    for (const e of ev) {
      if (e.type === 'poof') { sound.play('gloomypoof'); this.poof(e.x, e.y); }
      else if (e.type === 'done') this.beamDone(e);
    }
  }
  poof(x, y) { for (let i = 0; i < 8; i++) this.poofs.push({ x, y, a: i * 0.785 + this.clock, t: 0, s: 1.5 + (i % 3) * 0.6 }); if (this.poofs.length > 40) this.poofs.splice(0, this.poofs.length - 40); }
  beamDone(e) {
    const r = this.sr.round, st = this.state();
    if (e.won && this.bFun.done(st.beam)) { this.bMiss[r] = 0; this.bFun.won(r, SPOT_ROUNDS); sound.play('trumpet'); this.toast(`🔦 Round ${r + 1} won again! Just for fun! Press Shine! to play on.`); }
    else if (e.won) {
      this.bMiss[r] = 0; this.addKey(beamKey(r + 1)); sound.play('trumpet');
      const s2 = this.state();
      this.toast(`🔦 Round ${r + 1} won! (🔦 ${s2.beam} / 3)`);
      this.toast(s2.beam >= SPOT_ROUNDS ? 'No more Gloomies! Lamplighter Lux wants a battle.' : 'Press Shine! for the next round.');
    } else { this.bMiss[r]++; this.toast(`The Gloomies hid! Press Shine! to try again.${kindHelp(this.bMiss[r]).on ? ' It will be a bit slower.' : ''}`); }
  }

  /* ---------------------------------------------- the doors ---------------------------------------------- */
  sync(force = false) {
    const st = this.state();
    for (let i = 0; i < 3; i++) {
      const open = st.twin > i || st.star;
      if (!force && open === this.drawnDoors[i]) continue;
      const d = this.L.doors[i];
      for (const c of [...d.yours, ...d.its]) this.cells.want(c[0], c[1], c[2], open ? B.AIR : B.PLANKS);
      this.drawnDoors[i] = open;
    }
  }
  // Marks rounds as won (saved keys) for tests: court c, twin t, beam b.
  winUpTo(c, t, b) {
    for (let n = 1; n <= c; n++) this.addKey(courtKey(n));
    for (let n = 1; n <= t; n++) this.addKey(twinKey(n));
    for (let n = 1; n <= b; n++) this.addKey(beamKey(n));
    this.sync(true);
  }

  /* ---------------------------------------------- the frame ---------------------------------------------- */
  update(dt = 0) { if (!this.manual) this.step(dt); }
  step(dt, input = null) {
    const g = this.game, p = g.player;
    if (!p || g.world !== this.world) return;
    this.input = input;
    if (g.inBattle && (this.rail || this.shining || this.room)) this.giveBack();
    this.cells.flush();
    const step = Math.min(dt, MIRROR_RULES.dtMax);
    if (!this.paused()) {
      this.clock += step;
      this.stepCourt(step); this.stepBeam(step); this.stepTwin(step, p);
    }
    this.syncT -= dt;
    if (this.syncT <= 0) { this.syncT = MIRROR_RULES.sync; this.sync(); }
    this.zoom(step); this.drawCourt(p, step); this.drawTwin(p, step); this.drawGallery(p, step); this.drawFunny(p, step);
    this.refreshChip();
  }

  /* ---------------------------------------------- drawing ---------------------------------------------- */
  setFov(fov) { const cam = this.game.camera; if (cam && Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix?.(); } }
  zoom(dt) { // the sun mirror stance and the court zoom in a little (the Gloomies and Cleo are far away); out of them the camera goes back to the usual view and is left alone
    const cam = this.game.camera; if (!cam) return;
    const want = this.shining ? VIS.fovSun : this.rail ? VIS.fovRail : VIS.fov, on = this.shining || this.rail;
    if (!on && !this.zooming) return;
    this.zooming = true;
    const next = cam.fov + (want - cam.fov) * Math.min(1, dt * VIS.fovRate);
    this.setFov(Math.abs(next - want) < 0.05 ? want : next);
    if (!on && cam.fov === VIS.fov) this.zooming = false;
  }
  drawCourt(p, dt) {
    const br = this.br, cam = this.game.camera, on = this.rail && !!cam;
    // the plate pulses
    this.plate.userData.parts.ball.position.y = 0.2 + 0.08 * Math.sin(this.clock * 3);
    this.hand.visible = on;
    if (on) { const o = this.hand; o.position.copy(cam.position); o.quaternion.copy(cam.quaternion); o.translateX(0.42); o.translateY(-0.55); o.translateZ(-1.0); o.rotateX(-0.35); o.scale.setScalar(0.5); }
    const show = !!br && !br.done && this.rail;
    this.ball.visible = show && !!br.ball; this.cleo.visible = this.rail; this.cleoMirror.visible = this.rail; this.spinner.visible = this.rail && !!br?.plan.spinner && show;
    if (this.rail) {
      const cu = br ? br.cu : 8, [cx, cz] = courtXZ(cu, COURT_RULES.cleoV);
      this.cleoDizzy = Math.max(0, this.cleoDizzy - dt); this.cleoCheer = Math.max(0, this.cleoCheer - dt); this.cleoPout = Math.max(0, this.cleoPout - dt);
      this.cleo.position.set(cx, G1 + (this.cleoCheer > 0 ? Math.abs(Math.sin(this.clock * 12)) * 0.25 : 0), cz); this.cleo.rotation.y = this.cleoDizzy > 0 ? this.clock * 12 : 0;
      const arms = this.cleo.userData.parts.arms; arms.forEach(a => { a.g.rotation.x = -1.3 + (this.cleoCheer > 0 ? Math.sin(this.clock * 14) * 0.6 : 0); });
      this.cleoMirror.position.set(cx, G1 + 0.62, cz + 0.45); this.cleoMirror.rotation.y = 0; this.cleoMirror.scale.set(1.15, 0.62, 1);
      if (br) {
        if (br.ball) { const [bx, bz] = courtXZ(br.ball.u, br.ball.v); this.ball.position.set(bx, G1 + 0.55, bz); }
        if (br.spin != null) { const [sx, sz] = courtXZ(COURT_RULES.spinner.u, COURT_RULES.spinner.v); this.spinner.position.set(sx, G1, sz); this.spinner.rotation.y = -br.spin; }
      }
    }
  }
  drawTwin(p, dt) {
    const room = this.room, t = this.clock;
    // pads: lit from the room (or the saved keys when no room runs); the start pads pulse
    for (const pd of this.pads) {
      const active = room && this.roomN === pd.n + 1, lit = active ? !!room.lit[pd.j] : this.game.beaten.includes(twinKey(pd.n + 1)) || !!this.game.stars?.includes('mirror');
      for (const m of [pd.you, pd.its]) { const P_ = m.userData.parts; P_.halo.material.opacity = lit ? 0.85 : 0; P_.mat.emissive.setHex(lit ? 0x40a040 : 0x6a4a00); if (active) { const k = room.padT[pd.j] / TWIN_RULES.padTime; P_.ring.scale.setScalar(1 + (lit ? 0 : 0.25 * Math.min(1, k))); } }
    }
    this.starts.forEach((s, i) => { s.userData.parts.halo.material.opacity = 0.35 + 0.2 * Math.sin(t * 3 + i); });
    // the things: closed forms of the running room's own clock (or the live clock while idle)
    const act = n => room && this.roomN === n + 1 ? room : null;
    for (const { n, pd, m } of this.puddles) { const r = act(n); m.position.set(pd.side === 'its' ? twinX(pd.u) : yourX(pd.u), G1 + 0.03, TWIN.rooms[n].z0 + pd.v); m.scale.setScalar(r ? r.puddleK : 1); }
    for (const { n, bl, m } of this.balls) { const r = act(n), u = ballU(bl, r ? r.bt : t * 0.9); m.position.set(bl.side === 'its' ? twinX(u) : yourX(u), G1 + 0.9, TWIN.rooms[n].z0 + bl.v); m.rotation.z = -u * 1.4; }
    for (const { n, mop, m } of this.mops) { const r = act(n), a = mopAngle(mop, r ? r.mt : t * 0.7); m.position.set(mop.side === 'its' ? twinX(mop.u) : yourX(mop.u), G1, TWIN.rooms[n].z0 + mop.v); m.rotation.y = -a; }
    // the twin: it copies you (a mirror image) and hops when you jump
    this.twin.visible = !!room;
    if (room) {
      const z0 = TWIN.rooms[this.roomN - 1].z0, tw = room.twin;
      this.twin.position.set(twinX(tw.u), p.pos.y, z0 + tw.v);
      this.twin.rotation.y = Math.PI - p.yaw;
      const parts = this.twin.userData.parts, moving = this.twinMoved > 0 || Math.hypot(p.vel.x, p.vel.z) > 0.6; this.twinMoved = 0; this.twin.userData.t += dt;
      this.wave = Math.max(0, this.wave - dt);
      for (const l of parts.legs) l.g.rotation.x = moving ? Math.sin(this.twin.userData.t * 9 + l.phase) * 0.7 : 0;
      parts.arms.forEach((a, i) => { a.g.rotation.x = this.wave > 0 && i === 1 ? -2.6 + Math.sin(this.twin.userData.t * 14) * 0.4 : moving ? Math.sin(this.twin.userData.t * 9 + a.phase) * 0.6 : 0; });
    }
  }
  drawGallery(p, dt) {
    const S = SPOT_RULES, sr = this.sr, W = GLOOMY_WALL;
    // the sun mirror turns to send the beam where you look (or at the middle of the wall when nobody does)
    const yaw = this.shining ? (sr ? sr.yaw : p.yaw) : 0, pitch = this.shining ? (sr ? sr.pitch : p.pitch) : 0.06;
    const out = new THREE.Vector3(...dirOf(yaw, pitch)), inn = new THREE.Vector3(S.sun[0] - (GALLERY.sun.x + 1), S.sun[1] - GALLERY.sun.y, S.sun[2] - GALLERY.sun.z).normalize();
    const n = out.clone().sub(inn).normalize();
    this.sun.userData.parts.face.lookAt(new THREE.Vector3().copy(this.sun.position).add(n));
    P.setShaft(this.sunShaft, [GALLERY.sun.x + 1, GALLERY.sun.y, GALLERY.sun.z], S.sun, 0.55);
    // the beam's path (up to three straight parts) and the spot
    const beam = this.shining ? (sr ? sr.beam : beamOf(this.beamWorld, yaw, pitch)) : null, path = beam ? beam.path : [];
    this.shafts.forEach((sh, i) => { const a = path[i], b = path[i + 1]; if (a && b) P.setShaft(sh, a, b); else sh.userData.parts.m.visible = false; });
    const sp = this.shining ? (sr ? sr.spot : beam?.spot) : null;
    this.spotMesh.visible = !!sp;
    if (sp) { this.spotMesh.position.set(sp.x, sp.y, W.z + 1.05); this.spotMesh.scale.setScalar(this.sr ? this.sr.spotR / S.spotR : 1); }
    // the Gloomies: the round's crowd (or the next round's, drifting, while nobody plays); they squeak and shiver when lit
    const gm = this.glooms.userData.parts, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1), Z = new THREE.Matrix4().makeScale(0, 0, 0), st = this.state();
    let list;
    if (sr && !sr.done) list = sr.gloomies.filter(g => !g.gone).map(g => ({ x: g.x, y: g.y, lit: g.lit, sh: g.shiver / sr.hold, i: g.i }));
    else if (st.beam < SPOT_ROUNDS || this.bFun.done(st.beam) && sr && !sr.done) list = Array.from({ length: SPOT_RULES.rounds[Math.min(2, st.beam)].n }, (_, i) => ({ x: 66 + i * 9.5 + Math.sin(this.clock * 0.4 + i * 2) * 3, y: 20 + Math.sin(this.clock * 0.3 + i * 1.7) * 4, lit: false, sh: 0, i }));
    else list = [];
    const eyeAim = sp ? sp : { x: p.pos.x, y: 16 };
    for (let i = 0; i < gm.n; i++) {
      const g = list[i];
      if (!g) { gm.bodies.setMatrixAt(i, Z); gm.whites.setMatrixAt(i * 2, Z); gm.whites.setMatrixAt(i * 2 + 1, Z); gm.pupils.setMatrixAt(i * 2, Z); gm.pupils.setMatrixAt(i * 2 + 1, Z); for (let k = 0; k < 3; k++) gm.tufts.setMatrixAt(i * 3 + k, Z); continue; }
      const jit = g.lit ? Math.sin(this.clock * 55 + i) * 0.12 : 0, sc = VIS.gloomy * (1 + (g.lit ? 0.12 * Math.sin(this.clock * 40) : 0) - 0.3 * Math.min(1, g.sh)), x = g.x + jit, y = g.y, z = W.z + 0.5 * sc;
      M.compose(new THREE.Vector3(x, y, z), Q.identity(), new THREE.Vector3(sc, sc, sc)); gm.bodies.setMatrixAt(i, M);
      const dx = eyeAim.x - x, dy = eyeAim.y - y, d = Math.hypot(dx, dy) || 1;
      for (const [k, s] of [[0, -1], [1, 1]]) {
        M.compose(new THREE.Vector3(x + s * 0.22 * sc, y + 0.12 * sc, z + 0.46 * sc), Q.identity(), new THREE.Vector3(sc * (g.lit ? 1.3 : 1), sc * (g.lit ? 1.3 : 1), sc)); gm.whites.setMatrixAt(i * 2 + k, M);
        M.compose(new THREE.Vector3(x + s * 0.22 * sc + dx / d * 0.07, y + 0.12 * sc + dy / d * 0.07, z + 0.58 * sc), Q.identity(), S1); gm.pupils.setMatrixAt(i * 2 + k, M);
      }
      for (let k = 0; k < 3; k++) { Q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (k - 1) * 0.45); M.compose(new THREE.Vector3(x + (k - 1) * 0.2, y + 0.62 * sc, z + 0.05), Q, new THREE.Vector3(sc, sc, sc)); gm.tufts.setMatrixAt(i * 3 + k, M); }
    }
    for (const m of [gm.bodies, gm.whites, gm.pupils, gm.tufts]) m.instanceMatrix.needsUpdate = true;
    // poofs: little glints fly out and fade
    const pm = this.poofMesh.userData.parts.m;
    this.poofs = this.poofs.filter(f => (f.t += dt) < MIRROR_RULES.poofTime);
    for (let i = 0; i < pm.count; i++) {
      const f = this.poofs[i];
      if (!f) { pm.setMatrixAt(i, Z); continue; }
      const k = f.t / MIRROR_RULES.poofTime; M.compose(new THREE.Vector3(f.x + Math.cos(f.a) * f.s * k * 1.4, f.y + Math.sin(f.a) * f.s * k * 1.4 - 0.8 * k * k, W.z + 0.9), Q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), f.a + f.t * 8), new THREE.Vector3(1 - k, 1 - k, 1 - k)); pm.setMatrixAt(i, M);
    }
    pm.instanceMatrix.needsUpdate = true;
  }
  drawFunny(p, dt) {
    const t = this.clock;
    for (const fm of this.funny) {
      const { f, al } = fm, look = P.FUNNY_LOOKS[f.kind], plane = f.facing[1] > 0 ? FUNHALL.z0 + 1 : FUNHALL.z1;
      const dz = (p.pos.z - plane) * f.facing[1], lat = p.pos.x - (f.x + 0.5), near = dz > 0 && dz < MIRROR_RULES.funnyR && Math.abs(lat) < f.w / 2 + 3 && p.pos.y < 14 && !p.carry;
      fm.a.visible = near; if (fm.b) fm.b.visible = near;
      if (!near) continue;
      const half = f.w / 2 - 0.55, x = clamp(lat * (f.facing[1] > 0 ? 1 : -1), -half, half), sy = (look.wobble ? 1 - 0.35 * Math.sin(t * 3) : look.sy), sx = (look.wobble ? 1 + 0.45 * Math.sin(t * 3) : look.sx);
      const moving = Math.hypot(p.vel.x, p.vel.z) > 0.6, up = Math.max(0, p.pos.y - (G + 1));
      const place = (a, ox) => {
        a.position.set(clamp(x + ox, -half, half), look.flip ? 1.9 * sy : up * sy, 0.5);
        a.scale.set(sx * (look.twin ? 1 : 1), (look.flip ? -1 : 1) * sy, 0.5);
        a.rotation.y = -p.yaw - al.rotation.y + (f.facing[1] > 0 ? 0 : 0);
        const parts = a.userData.parts; a.userData.t = (a.userData.t || 0) + dt;
        for (const l of parts.legs) l.g.rotation.x = moving ? Math.sin(a.userData.t * 9 + l.phase) * 0.7 : 0;
        for (const ar of parts.arms) ar.g.rotation.x = moving ? Math.sin(a.userData.t * 9 + ar.phase) * 0.6 : 0;
      };
      place(fm.a, look.twin ? -0.8 : 0); if (fm.b) place(fm.b, 0.8);
    }
  }
  refreshChip() {
    const ui = this.game.ui;
    if (!ui?.setScore || this.game.world !== this.world) return;
    const st = this.state(), br = this.br, sr = this.sr, room = this.room;
    if (br && !br.done && this.rail) { ui.setScore({ text: `🏓 Round ${br.round + 1} · You ${br.you} – ${br.cleo} Cleo${this.cFun.done(st.court) ? ' · for fun' : ''}`, done: false }); return; }
    if (room && !room.won) { ui.setScore({ text: `👯 ${TWIN_ROOMS[this.roomN - 1].name} · pads ${room.lit.filter(Boolean).length} / ${room.lit.length}${this.tFun.done(st.twin) ? ' · for fun' : ''}`, done: false }); return; }
    if (sr && !sr.done && this.shining) { ui.setScore({ text: `🔦 Round ${sr.round + 1} · ${sr.alive().length} Gloomies left${this.bFun.done(st.beam) ? ' · for fun' : ''}`, done: false }); return; }
    const ready = st.done && !this.game.bosses?.crewAim?.(this.game.player.pos);
    ui.setScore({ text: ready && !st.star ? '🪞 The Grand Mirror Hall is open!' : `🏓 ${st.court} / 3 · 👯 ${st.twin} / 3 · 🔦 ${st.beam} / 3`, done: !!(ready && !st.star) });
  }

  // For tests.
  info() {
    const br = this.br, sr = this.sr, r = this.room;
    return {
      rail: this.rail, shining: this.shining, railM: this.railM, tilt: br?.tilt ?? 0,
      court: br ? { round: br.round, you: br.you, cleo: br.cleo, done: br.done, won: br.won, m: br.m, cu: br.cu, phase: br.phase, ball: br.ball && { ...br.ball }, hits: br.hits, rallies: br.rallies, time: br.time } : null,
      room: r ? { n: this.roomN, lit: r.lit.slice(), you: { ...r.you }, twin: { ...r.twin }, won: r.won, misses: r.misses, t: r.t } : null,
      beam: sr ? { round: sr.round, left: sr.alive().length, done: sr.done, won: sr.won, spot: sr.spot && { ...sr.spot }, time: sr.time, yaw: sr.yaw, pitch: sr.pitch, gloomies: sr.gloomies.map(g => ({ x: g.x, y: g.y, gone: g.gone, shiver: g.shiver, shade: g.shade, lit: g.lit })) } : null,
      doors: this.drawnDoors.slice(), cMiss: this.cMiss.slice(), tMiss: this.tMiss.slice(), bMiss: this.bMiss.slice(), hasHook: this.game.player?.stepHook === this.hook,
      funny: this.funny.map(f => f.a.visible),
    };
  }
}
