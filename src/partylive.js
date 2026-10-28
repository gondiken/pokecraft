// T48 (owner 2026-10-28, plans/T48-surprise-party.md): the live part of Jolly Jax's Surprise Party (LIVE.doors). The Party Spinner on the
// wall picks a party game; the party floor builds the game's set (cells flipped with LiveCells / setLive, never edits); each game has three
// rounds that get harder, round 2 and 3 with a party surprise (a twist); three rounds won = the game's golden bow (a `beaten` key, saved
// at once). Jolly Jax's helpers crash the party after the 1st and the 3rd bow; with four bows the cake's candles light, the guests
// gather, everybody shouts SURPRISE! and Jolly Jax bursts out of the top of the cake for the star battle.
//
// Everything is per player and in memory except the bows (and the crew keys pictureboss.js writes). Clocks are summed frame dt (frozen in
// a battle, a question, a panel and the pause screen); every game is a closed form of its round clock (pinata.js, jackcatch.js,
// giftstack.js, popupwhack.js, spinner.js), so 60 and 20 frames a second agree. One press each (Spin! / Stop! / Play! / Whack! / Drop!):
// E, a click, the big button, or a tap on the screen (gymLive.tap). `manual` + `step(dt)` and `info()` are for tests.
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';
import { PINATA, newRun, pinataAt, timeUp, hashStr } from './pinata.js';
import { CATCH, newCatch, stepCatch, inAir, slowed, jacksLeft } from './jackcatch.js';
import { pinataRound, catchRound, whackRuns } from './partyrounds.js';
import { STACK, stackPlan, newStack, craneAt, drop, loaded } from './giftstack.js';
import { WHACK, whackPlan, newWhack, upAt, headOf, whackAt, whackTimeUp, shaking } from './popupwhack.js';
import { SPIN, GAMES, GAME_NAMES, newSpin, spinAngle, spinDone, restAngle, sliceAt, twistOf } from './spinner.js';
import { kindHelp } from './kindhelp.js';
import { bowKey, bowOf, bowState, migrateBows, CAKE, CRASHERS, GUESTS, SQUARE, SPINNER, TABLE, ROOM, FLOOR, C } from './partyland.js';
import * as PP from './partyprops.js';

export const PARTY = {
  build: 2.0,          // seconds for a game's set to whoosh up out of the party floor (and `clear` to go back)
  clear: 1.5,
  landed: 0.9,         // the Spinner shows where it stopped this long before the game comes
  sweets: 2,           // party sweets (Capture Cubes) when it lands on a game you won already: once till the next game is won
  rest: { won: 1.8, missed: 1.6, pinataWon: 2.6, pinataNap: 2.0 },
  stickSwing: 0.28, splat: 1.6,
  clearR: 17,          // while a game runs no wild gift box stays this close to the party floor's middle
  dark: 0.3,           // "Lights out!": the light goes down to this
  candle: 0.2,         // the finale: a candle lights every 0.2 s, then SURPRISE!
  surprise: 1.9, rise: 0.8,
  confetti: 160,
};
const HOW = {
  pinata: 'Whack the piñata when it swings AT you!',
  catch: 'Run under the jacks to catch them. Dodge the pies!',
  stack: 'Press Drop! when the present is right over the stack!',
  whack: 'Whack the jacks when they pop up. Not the ones with a pie!',
};
const ICON = { pinata: '🪅', catch: '🤡', stack: '🎁', whack: '🔨' };
const SILLY = [
  { id: 'duck', say: 'Quack! A rubber duck fell out too!', sound: 'sillyhonk' },
  { id: 'bubbles', say: 'Bubbles fell out too! Pop pop pop!', sound: 'popout' },
  { id: 'sock', say: 'Boing! A sock on a spring fell out too!', sound: 'boing' },
  { id: 'cloud', say: 'A little cloud fell out too! Puff!', sound: 'smokepuff' },
];
const PRESENT_COLOURS = [0xe8384a, 0x3a8ce8, 0x6ae86a, 0xffd23a, 0xb05ae8, 0xff8ab0, 0x3ac8e8, 0xff8a1a];
const SHADOW_DARK = new THREE.Color(0.08, 0.05, 0.12), RING_PINK = new THREE.Color(1, 0.35, 0.6), RING_GOLD = new THREE.Color(1, 0.82, 0.2);
const JACK_PLAIN = new THREE.Color(1, 1, 1), JACK_GOLD = new THREE.Color(1.5, 1.2, 0.35);
const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const candleCells = () => CAKE.candles.map(([dx, dz]) => [CAKE.x + dx, CAKE.candleY + 1, CAKE.z + dz]);

export class PartyLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    this.world = game.world;
    this.sets = part.sets;
    this.cells = new LiveCells(game.world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;                                          // tests set it and call step(dt) themselves
    this.clock = 0; this.syncAcc = 1; this.chipAcc = 1; this.clearAcc = 0;
    this.seed = hashStr(`${game.playerId ?? 'p'}|${game.world.seed ?? 1}`);
    // an old Room of Doors save: its bows become the party's (the same number of bows; partyland.js partyBows)
    const m = migrateBows(game.beaten || []);
    if (m.changed && Array.isArray(game.beaten)) { const old = game.beaten.some(k => /^pw:doors:bow/.test(k)); game.beaten.splice(0, game.beaten.length, ...m.beaten); this.needSave = old; }
    this.sp = { phase: 'idle', spin: null, n: 0, a: (3 * Math.PI) / 4, t: 0, slice: null, tick: -1, tickT: 0 };
    this.gm = null;
    this.played = Object.fromEntries(GAMES.map(g => [g, 0]));
    this.misses = Object.fromEntries(GAMES.map(g => [g, [0, 0, 0, 0]]));
    this.attempts = Object.fromEntries(GAMES.map(g => [g, [0, 0, 0, 0]]));
    this.sweetsReady = true;
    this.first = true; this.crashed = new Set(); this.finale = null; this.faceKey = null;
    this.dim = 1; this.burst = null; this.savedNooks = null;
    this.meshes = []; this.groups = []; this.geos = []; this.mats = [];
    this.order = Object.fromEntries(GAMES.map(g => [g, this.setCells(g)]));
    this.buildMeshes();
  }

  /* ---------------------------------- small helpers ---------------------------------- */
  toast(m) { this.game.ui?.toast(m); }
  once(id, m) { if (this.game.toldOnce?.has(id)) return; this.game.toldOnce?.add(id); this.toast(m); }
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  pos() { return this.game.player.pos; }
  hard() { return (this.game.stars || []).includes('doors'); }  // a rematch party: you hold the star
  bows() { return bowState(this.game); }
  eye() { const e = this.game.player.eyePos; return { x: e.x, y: e.y, z: e.z }; }
  look() { const f = this.game.player.forward; return { x: f.x, y: f.y, z: f.z }; }
  inRoom(p = this.pos()) { return p.x >= ROOM.x0 - 1 && p.x < ROOM.x1 + 2 && p.z >= ROOM.z0 - 1 && p.z < ROOM.z1 + 2; }
  onSquare(p = this.pos()) { return p.x >= SQUARE.x0 && p.x < SQUARE.x1 + 1 && p.z >= SQUARE.z0 && p.z < SQUARE.z1 + 1 && p.y > 10 && p.y < 15; }
  onPad(p, cells) { const xs = cells.map(c => c[0]), zs = cells.map(c => c[1]); return p.x >= Math.min(...xs) - 0.3 && p.x < Math.max(...xs) + 1.3 && p.z >= Math.min(...zs) - 0.3 && p.z < Math.max(...zs) + 1.3 && Math.abs(p.y - 11) < 1.5; }
  onSpinnerPad(p = this.pos()) { const d = SPINNER.pad; return p.x >= d.x0 - 0.4 && p.x < d.x1 + 1.4 && p.z >= d.z0 - 0.4 && p.z < d.z1 + 1.4 && Math.abs(p.y - 11) < 1.5; }
  crasherHere() {
    const list = this.game.npcs?.list || [];
    return list.find(n => n.kind === 'crew' && n.def?.boss === 'doors' && !n.away && !(this.game.beaten || []).includes(`pw:doors:crew${n.def.index + 1}`)) ?? null;
  }
  bossNpc() { return (this.game.npcs?.list || []).find(n => n.kind === 'boss' && n.def?.id === 'doors') ?? null; }

  // A set's cells in the order they whoosh up (from the middle out): [{ x, y, z, id, base, d }].
  setCells(game) {
    const s = this.sets[game], out = [];
    for (const [x, z, id] of [...s.floor, ...s.pad]) out.push({ x, y: FLOOR, z, id, base: B.PARTY_FLOOR });
    for (const [x, y, z, id] of s.up) out.push({ x, y, z, id, base: B.AIR });
    for (const c of out) c.d = Math.hypot(c.x + 0.5 - C.x, c.z + 0.5 - C.z);
    return out.sort((a, b) => a.d - b.d);
  }
  // Flip the set of the running game up (k 0..1 of the way) or back down.
  buildStep(k, up) {
    const list = this.order[this.gm.game], far = list.length ? list[list.length - 1].d + 0.01 : 1;
    for (const c of list) {
      const due = up ? c.d <= k * far : c.d >= (1 - k) * far;
      if (due) this.cells.want(c.x, c.y, c.z, up ? c.id : c.base);
    }
  }

  /* ---------------------------------- meshes ---------------------------------- */
  buildMeshes() {
    const scene = this.game.scene;
    if (!scene || typeof document === 'undefined') return;
    const lam = () => { const m = new THREE.MeshLambertMaterial({ vertexColors: true }); this.mats.push(m); return m; };
    const add = (mesh, geo) => { scene.add(mesh); this.meshes.push(mesh); if (geo) this.geos.push(geo); return mesh; };
    const group = g => { scene.add(g); this.groups.push(g); return g; };
    const inst = (geo, mat, n) => { const m = add(new THREE.InstancedMesh(geo, mat, n), geo); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; return m; };
    // the room
    this.spinner = group(PP.buildSpinner(SPINNER.r)); this.spinner.position.set(SPINNER.x, SPINNER.y, SPINNER.z);
    const W = 19.5;
    this.bunting = group(PP.buildBunting([
      [[ROOM.x0, W, ROOM.z0 + 4], [ROOM.x1 + 1, W, ROOM.z1 - 4]], [[ROOM.x1 + 1, W, ROOM.z0 + 4], [ROOM.x0, W, ROOM.z1 - 4]],
      [[ROOM.x0, W, 40.5], [ROOM.x1 + 1, W, 40.5]], [[ROOM.x0, W, 66.5], [ROOM.x1 + 1, W, 66.5]], [[56.5, W, ROOM.z0], [56.5, W, ROOM.z1 + 1]],
    ]));
    this.balloonSpots = [[SQUARE.x0 + 0.5, 11, SQUARE.z0 + 0.5], [SQUARE.x1 + 0.5, 11, SQUARE.z0 + 0.5], [SQUARE.x0 + 0.5, 11, SQUARE.z1 + 0.5], [SQUARE.x1 + 0.5, 11, SQUARE.z1 + 0.5],
      [TABLE.x0 + 1.5, TABLE.y + 1, TABLE.z0 + 0.5], [TABLE.x0 + 1.5, TABLE.y + 1, TABLE.z1 + 0.5], [CAKE.x - 4.5, 11, CAKE.z + 4.5], [CAKE.x + 5.5, 11, CAKE.z + 4.5], [52.5, 11, 73.5], [60.5, 11, 73.5]];
    this.balloons = group(PP.buildBalloons(this.balloonSpots));
    this.tableware = group(PP.buildTableware({ ...TABLE, y: TABLE.y + 1 })); // (on the cloth: the top of the table blocks)
    this.cakeDeco = group(PP.buildCakeDeco(CAKE));
    // the Piñata Party: two piñatas at most (each with a rope and balloons), the party stick, the bow, the silly surprise
    this.pinataGeos = Object.fromEntries(Object.entries(PP.PINATAS).map(([id, b]) => [id, PP.merged(b)]));
    for (const g of Object.values(this.pinataGeos)) this.geos.push(g);
    this.pinataLit = lam(); this.pinataGlow = new THREE.MeshBasicMaterial({ vertexColors: true }); this.mats.push(this.pinataGlow);
    const rg = new THREE.BoxGeometry(0.05, 1, 0.05); rg.translate(0, 0.5, 0); this.geos.push(rg);
    const rm = new THREE.MeshLambertMaterial({ color: 0xfff0d0 }); this.mats.push(rm);
    const blg = PP.merged(PP.balloonBoxes()); this.geos.push(blg);
    const blm = lam();
    this.pin = [0, 1].map(() => ({ body: add(new THREE.Mesh(this.pinataGeos.llama, this.pinataLit)), rope: add(new THREE.Mesh(rg, rm)), balloons: add(new THREE.Mesh(blg, blm)) }));
    for (const q of this.pin) q.body.visible = q.rope.visible = q.balloons.visible = false;
    const sg0 = PP.merged(PP.stickBoxes());
    this.stick = add(new THREE.Mesh(sg0, lam()), sg0); this.stick.visible = false;
    const bg = PP.merged(PP.bowBoxes(1));
    this.bow = add(new THREE.Mesh(bg, lam()), bg); this.bow.visible = false;
    this.propGeos = Object.fromEntries(Object.entries(PP.SILLY_BOXES).map(([id, b]) => [id, PP.merged(b)]));
    for (const g of Object.values(this.propGeos)) this.geos.push(g);
    this.prop = add(new THREE.Mesh(this.propGeos.duck, lam())); this.prop.visible = false;
    // shadows and rings on the floor
    const shg = new THREE.CircleGeometry(0.55, 18); shg.rotateX(-Math.PI / 2);
    const shm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }); this.mats.push(shm);
    this.shadows = inst(shg, shm, 10);
    const rng = new THREE.RingGeometry(0.62, 0.9, 24); rng.rotateX(-Math.PI / 2);
    const rngm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }); this.mats.push(rngm);
    this.rings = inst(rng, rngm, 8);
    for (let i = 0; i < 10; i++) this.shadows.setColorAt(i, SHADOW_DARK);
    for (let i = 0; i < 8; i++) this.rings.setColorAt(i, RING_PINK);
    // Jack Catch and Pop-Up Whack: jacks, noses (they glow in the dark), pies, lids that jiggle on a box about to pop
    const jg = PP.merged(PP.jackBoxes()), jng = PP.merged(PP.jackBoxes({ nose: false })), ng = PP.merged(PP.noseBoxes()), pg = PP.merged(PP.pieBoxes());
    this.jacks = inst(jg, lam(), 9);
    this.wjacks = inst(jng, lam(), 9);
    const noseMat = new THREE.MeshBasicMaterial({ vertexColors: true }); this.mats.push(noseMat);
    this.noses = inst(ng, noseMat, 9);
    this.pies = inst(pg, lam(), 9);
    for (let i = 0; i < 9; i++) { this.jacks.setColorAt(i, JACK_PLAIN); this.wjacks.setColorAt(i, JACK_PLAIN); }
    const lg = new THREE.BoxGeometry(0.98, 0.14, 0.98), lm = new THREE.MeshLambertMaterial({ color: 0xe8384a }); this.mats.push(lm);
    this.lids = inst(lg, lm, 9);
    // the cream on the screen after a splat
    const spg = new THREE.CircleGeometry(1, 20);
    const spm = new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0, depthTest: false, depthWrite: false }); this.mats.push(spm);
    this.cream = add(new THREE.Mesh(spg, spm), spg); this.cream.visible = false; this.cream.renderOrder = 999;
    // Gift Stack: the crane and the presents (the stack, the one on the hook, the falling one, the bits that fell off)
    const st = this.sets.stack;
    this.crane = group(PP.buildCrane({ reach: st.crane.x - st.table.x + STACK.amp + 1.6, top: 10.5 })); this.crane.position.set(st.crane.x, FLOOR + 1, st.crane.z); this.crane.visible = false;
    const prg = PP.merged(PP.presentBoxes());
    this.presents = inst(prg, lam(), 48);
    // confetti
    this.confetti = group(PP.buildConfetti(PARTY.confetti));
    this.tmp = new THREE.Object3D(); this.tmpV = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0);
  }

  dispose() {
    this.game.ui?.setScore?.(null);
    this.unslow();
    this.restoreNooks();
    this.game.lightsDim = 1;
    for (const m of this.meshes) { m.parent?.remove(m); m.dispose?.(); }
    for (const g of this.groups) { g.parent?.remove(g); g.userData.dispose?.(); }
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.meshes = []; this.groups = []; this.geos = []; this.mats = [];
  }

  /* ---------------------------------- the hooks of the live-part interface ---------------------------------- */
  prompt(block) {
    if (block.id === B.POP_BOX || block.id === B.POP_BOX_OPEN) return this.gm?.phase === 'run' ? null : 'A pop-up box';
    return null;
  }
  hit(block) {
    if ((block.id === B.POP_BOX || block.id === B.POP_BOX_OPEN) && this.gm) { if (this.gm.phase === 'run' && this.gm.game === 'whack') { this.whackNow(this.eye(), this.look()); } return true; }
    if (block.id === B.CAKE) { const st = this.bows(); this.toast(st.done ? 'The candles are lit! Jolly Jax is on the cake.' : `The birthday cake! Win the golden bows to light its candles. (🎀 ${st.n} / 4)`); return true; }
    return false;
  }
  // A tap on the screen (main.js tapAt, before it looks for blocks): while a piñata swings or jacks pop, the stick swings that way;
  // during Gift Stack a tap anywhere drops the present.
  tap(origin, dir) {
    const g = this.gm;
    if (this.paused() || !g || g.phase !== 'run' || !this.onSquare()) return false;
    if (g.game === 'pinata' || g.game === 'whack') { this.whackNow({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z }); return true; }
    if (g.game === 'stack') { this.dropNow(); return true; }
    return false;
  }
  // The word on the big button (null = nothing here).
  near(p) {
    if (this.paused()) return null;
    const pos = p.pos ?? p, g = this.gm;
    if (g) {
      // owner 2026-10-28: "I couldn't do anything with the piñata": Play! works anywhere in the party room (it whooshes you to the start)
      if (g.phase === 'ready') return this.inRoom(pos) ? (this.misses[g.game][g.round] ? 'Again!' : 'Play!') : null;
      if (!this.onSquare(pos)) return null;
      if (g.phase !== 'run') return null;
      if (g.game === 'pinata' || g.game === 'whack') return 'Whack!';
      if (g.game === 'stack') return loaded(g.run.st, g.run.t) ? 'Drop!' : null;
      return null;
    }
    if (!this.onSpinnerPad(pos) || this.bows().done) return null;
    if (this.sp.phase === 'idle') return 'Spin!';
    if (this.sp.phase === 'spin') return 'Stop!';
    return null;
  }
  use(p) {
    const w = this.near(p);
    if (!w) return false;
    if (w === 'Spin!') return this.startSpin();
    if (w === 'Stop!') return this.stopSpin();
    if (w === 'Play!' || w === 'Again!') { this.toStart(); return this.beginRound(); }
    if (w === 'Whack!') { this.whackNow(this.eye(), this.look()); return true; }
    if (w === 'Drop!') return this.dropNow();
    return false;
  }

  /* ---------------------------------- the Party Spinner ---------------------------------- */
  startSpin() {
    const s = this.sp;
    if (s.phase !== 'idle' || this.gm) return false;
    s.spin = newSpin(s.a, this.clock, this.seed, s.n++);
    s.phase = 'spin';
    sound.play('spintick');
    this.once('party-spin', 'Press Stop! when the game you want is under the arrow!');
    return true;
  }
  stopSpin() {
    const s = this.sp;
    if (s.phase !== 'spin') return false;
    s.spin.stop = this.clock;
    s.phase = 'slow';
    return true;
  }
  stepSpinner(dt) {
    const s = this.sp;
    if (s.phase === 'spin' && this.clock - s.spin.press >= SPIN.auto) this.stopSpin();
    if (s.phase === 'spin' || s.phase === 'slow') {
      const k = sliceAt(spinAngle(s.spin, this.clock));
      s.tickT += dt;
      if (k !== s.tick && s.tickT > 0.07) { s.tick = k; s.tickT = 0; sound.play('spintick'); }
      if (s.phase === 'slow' && spinDone(s.spin, this.clock)) {
        s.a = restAngle(s.spin); s.slice = sliceAt(s.a); s.phase = 'show'; s.t = 0;
        sound.play('rightdoor');
      }
    } else if (s.phase === 'show') {
      s.t += dt;
      if (s.t >= PARTY.landed) { s.phase = 'idle'; this.land(s.slice); }
    }
  }
  wheelAngle() { const s = this.sp; return s.spin && (s.phase === 'spin' || s.phase === 'slow') ? spinAngle(s.spin, this.clock) : s.a; }
  land(k) {
    const game = GAMES[k], st = this.bows(), name = GAME_NAMES[game];
    if (st.done) return;
    if (st.bows[k]) {
      if (this.sweetsReady) {
        this.sweetsReady = false;
        this.game.cubes += PARTY.sweets; this.game.ui?.renderHud?.();
        sound.play('cube');
        this.toast(`Party sweets! +${PARTY.sweets} Capture Cubes. You won ${name} already: spin again!`);
      } else this.toast(`You won ${name} already. Spin again!`);
      return;
    }
    this.startGame(game);
  }

  /* ---------------------------------- a party game: build, rounds, the bow ---------------------------------- */
  startGame(game) {
    this.gm = { game, round: 1, phase: 'build', t: 0, twist: null, twistRound: 0, run: null, n: this.played[game]++ };
    this.misses[game] = [0, 0, 0, 0];
    sound.play('doorwhoosh');
    this.toast(`Surprise! It's ${GAME_NAMES[game]}! ${ICON[game]}`);
    // owner 2026-10-28: "I don't know how this works": say it big, once per game, with what to do
    this.game.ui?.celebrate?.(`${ICON[game]} ${GAME_NAMES[game]}!`, `${HOW[game]} Win 3 rounds for a golden bow. Press Play!`, 4500);
    this.doBurst([C.x, 12, C.z], 0.8);
    return true;
  }
  roundReady() {
    const g = this.gm;
    g.phase = 'ready'; g.t = 0; g.run = null;
    if (g.twistRound !== g.round) {
      g.twistRound = g.round;
      g.twist = twistOf(g.game, g.round, this.seed, g.n);
      if (g.twist) { // a party popper goes off, and Jolly Jax says what changed
        sound.play('balloonpop'); setTimeout(() => sound.play('giftgiggle'), 200);
        this.doBurst([C.x, 13, C.z], 0.7);
        this.toast(`🤡 Jolly Jax: ${g.twist.say}`);
      }
    }
    this.once(`party-how-${g.game}`, HOW[g.game]);
    this.toast(`${ICON[g.game]} ${GAME_NAMES[g.game]}: round ${g.round} of 3. Press Play!`);
  }
  // Play! from anywhere in the room: a puff, and you stand on the game's gold pad, facing the game
  toStart() {
    const g = this.gm, p = this.game.player, set = g && this.sets[g.game];
    if (!set || this.onPad(p.pos, set.pad)) return;
    const [x, z, yaw] = set.standAt;
    this.game.creatures?.puff?.({ x: p.pos.x, y: p.pos.y, z: p.pos.z }, { color: 0xffd0f0 });
    p.pos.set(x, FLOOR + 1, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0;
  }
  beginRound() {
    const g = this.gm;
    if (!g || g.phase !== 'ready') return false;
    const game = g.game, round = g.round, misses = this.misses[game][round], attempt = this.attempts[game][round]++, hard = this.hard(), twist = g.twist?.id ?? null, set = this.sets[game];
    if (game === 'pinata') g.run = { runs: pinataRound(this.seed, round, attempt, { help: misses, hard, twist }).map(newRun), t: 0, swingT: 9, popped: new Map(), silly: 0 };
    else if (game === 'catch') {
      const plan = catchRound(this.seed, round, attempt, { help: misses, hard, twist, boxes: set.boxes, floor: set.catchFloor, start: set.start });
      g.run = { run: newCatch(plan), t: 0, splatT: 9, open: new Map() };
      if (plan.cap) this.game.player.speedCap = plan.cap;
    } else if (game === 'stack') g.run = { st: newStack(stackPlan(this.seed, round, attempt, { twist, hard, slow: kindHelp(misses).slow })), t: 0, falls: [], endAt: null };
    else g.run = { st: newWhack(whackPlan(this.seed, round, attempt, { twist, hard, help: kindHelp(misses) })), t: 0, swingT: 9, splatT: 9 };
    g.phase = 'run'; g.t = 0;
    sound.play('doorwhoosh');
    if (game === 'pinata') this.toast(`${PINATA.rounds[round - 1].name}! ⏱ ${g.run.runs[0].plan.time} s`);
    this.hideNooks(); this.clearWilds();
    return true;
  }
  // You walked off the party floor in the middle of a round: it waits (not a miss).
  stopRound() {
    const g = this.gm;
    this.unslow(); this.restoreNooks();
    this.toast('The game waits for you on the party floor!');
    this.roundReadyQuiet(g);
    this.syncBoxes();
  }
  roundReadyQuiet(g) { g.phase = 'ready'; g.t = 0; g.run = null; }
  roundWon() {
    const g = this.gm;
    g.phase = 'won'; g.t = 0;
    this.unslow(); this.restoreNooks();
    this.cheer();
    sound.play('fairround');
    if (g.round < 3) this.toast(`Yay! Round ${g.round} won! Next: round ${g.round + 1}.`);
  }
  roundMissed(text) {
    const g = this.gm;
    const n = ++this.misses[g.game][g.round];
    g.phase = 'missed'; g.t = 0;
    this.unslow(); this.restoreNooks();
    sound.play('sillyhonk');
    const help = kindHelp(n).on; // (every party game has the same shared kind help now)
    this.toast(text + (help ? ' It will be a bit slower now.' : ''));
  }
  gameWon() {
    const g = this.gm, gm = this.game, k = bowKey(bowOf(g.game));
    if (!gm.beaten.includes(k)) gm.beaten.push(k);
    gm.save?.();
    const st = this.bows();
    sound.play('rightdoor');
    this.toast(`🎀 A golden bow for ${GAME_NAMES[g.game]}! (${st.n} / 4)`);
    this.doBurst([C.x, 14, C.z], 1.2);
    this.cheer();
    g.phase = 'clear'; g.t = 0;
    this.sweetsReady = true;
    this.sync();
  }
  stepGame(dt) {
    const g = this.gm;
    if (!g) return;
    g.t += dt;
    if (g.phase === 'build') { this.buildStep(Math.min(1, g.t / PARTY.build), true); if (g.t >= PARTY.build) this.roundReady(); }
    else if (g.phase === 'run') {
      if (!this.onSquare()) { this.stopRound(); return; }
      const out = this[`step_${g.game}`](dt);
      if (out === 'won') this.roundWon();
      else if (out) this.roundMissed(out);
    } else if (g.phase === 'won' || g.phase === 'missed') {
      if (g.game === 'catch' && g.run && g.run.splatT < 9) g.run.splatT += dt;
      const rest = g.game === 'pinata' ? (g.phase === 'won' ? PARTY.rest.pinataWon : PARTY.rest.pinataNap) : PARTY.rest[g.phase];
      if (g.t >= rest) {
        if (g.phase === 'missed') this.roundReady();
        else if (g.round >= 3) this.gameWon();
        else { g.round++; this.roundReady(); }
      }
    } else if (g.phase === 'clear') {
      this.buildStep(Math.min(1, g.t / PARTY.clear), false);
      if (g.t >= PARTY.clear) { this.gm = null; this.syncBoxes(); }
    }
  }

  /* ---------------------------------- the Piñata Party ---------------------------------- */
  whackNow(eye, dir) {
    const g = this.gm;
    if (!g || g.phase !== 'run') return false;
    if (g.game === 'whack') return this.whackJack(eye, dir);
    if (g.game !== 'pinata') return false;
    const r = g.run, res = whackRuns(r.runs, r.t, eye, dir);
    if (!res.swung) return false;
    r.swingT = 0;
    if (!res.hit) { sound.play('doorwhoosh'); this.once('party-whoosh', 'Whoosh! Too soon. Wait for it to swing close.'); return true; }
    if (res.big) {
      sound.play('pinatawhack');
      const left = r.runs[res.run].hp;
      if (!res.burst) this.toast(left === 1 ? 'CRACK! 1 more!' : `CRACK! ${left} more!`);
      const p = pinataAt(r.runs[res.run], res.tau);
      this.doBurst([p.x, p.y, p.z], 0.25);
    } else { sound.play('boop'); this.once('party-bonk', 'Bonk! Whack it when it swings AT you, low down.'); }
    if (res.dodge) this.toast('It dodged!');
    return true;
  }
  step_pinata(dt) {
    const r = this.gm.run;
    r.t += dt;
    if (r.swingT < 9) r.swingT += dt;
    r.runs.forEach((run, i) => { if (run.done && !r.popped.has(i) && r.t >= run.burstAt) this.popPinata(i); });
    if (r.runs.every((_, i) => r.popped.has(i))) return 'won';
    if (r.runs.some(run => !run.done) && (timeUp(r.runs[0], r.t) || r.t >= r.runs[0].plan.time)) return 'The piñata went up for a nap. Again? It will swing slower.';
    return null;
  }
  popPinata(i) {
    const r = this.gm.run, run = r.runs[i], at = pinataAt(run, run.burstAt);
    r.popped.set(i, { at, t: r.t });
    r.silly = hashStr(`silly|${this.seed}|${run.plan.round}|${run.plan.attempt}|${i}`) % SILLY.length;
    sound.play('candyrain');
    const s = SILLY[r.silly];
    setTimeout(() => sound.play(s.sound), 450);
    this.toast('Pop! Candy!');
    if (r.runs.length === 1 || r.popped.size === r.runs.length) setTimeout(() => this.toast(s.say), 900);
    this.doBurst([at.x, at.y, at.z], 1.2);
  }

  /* ---------------------------------- Jack Catch ---------------------------------- */
  step_catch(dt) {
    const c = this.gm.run, p = this.game.player;
    c.t += dt;
    let end = null;
    for (const e of stepCatch(c.run, c.t, p.pos, p.vel)) {
      const l = c.run.plan.launches.find(q => q.n === e.n);
      if (e.type === 'launch') { c.open.set(l.box, c.t); sound.play(l.kind === 'pie' ? 'sillyhonk' : 'jackpop'); }
      else if (e.type === 'catch') { sound.play('jackcatch'); if (e.gold) this.toast('Gold jack! +2'); }
      else if (e.type === 'miss') sound.play('popout');
      else if (e.type === 'splat') { sound.play('piesplat'); c.splatT = 0; this.toast('Splat! A cream pie! Sticky shoes...'); }
      else if (e.type === 'end') end = e;
    }
    if (c.splatT < 9) c.splatT += dt;
    if (end) { this.syncBoxes(); return end.won ? 'won' : `You caught ${end.score}! Again? They will fly slower.`; }
    const cap = slowed(c.run, c.t) ? CATCH.pies.cap : c.run.plan.cap;
    if (cap != null) p.speedCap = cap; else this.unslow();
    this.syncBoxes();
    return null;
  }
  unslow() { const p = this.game.player; if (p && (p.speedCap === CATCH.pies.cap || p.speedCap === 3.6)) p.speedCap = null; }

  /* ---------------------------------- Gift Stack ---------------------------------- */
  dropNow() {
    const g = this.gm;
    if (!g || g.phase !== 'run' || g.game !== 'stack') return false;
    const r = g.run, st = r.st, n = st.placed, res = drop(st, r.t);
    if (!res.dropped) return false;
    const y0 = this.stackTop(n);
    r.falls.push({ at: res.at, size: { w: res.piece?.w ?? st.size.w, d: res.piece?.d ?? st.size.d }, piece: res.piece, y: y0, t0: r.t, colour: PRESENT_COLOURS[n % PRESENT_COLOURS.length], cut: res.cut, miss: res.miss, perfect: res.perfect, from: this.hookY(n) - 0.2 - STACK.height / 2 });
    if (res.perfect) { sound.play('ringding'); this.toast(st.perfects === 1 ? 'Perfect! It keeps its size!' : 'Perfect!'); }
    else if (res.miss) sound.play('sillyhonk');
    else sound.play('boop');
    if (res.won || res.miss) r.endAt = r.t + STACK.fall + 0.5;
    return true;
  }
  stackTop(n) { return this.sets.stack.table.y + n * STACK.height; } // the top of the n-th present (0 = the table)
  hookY(n) { return this.stackTop(n) + 2.2; }
  step_stack(dt) {
    const r = this.gm.run;
    r.t += dt;
    if (r.endAt != null && r.t >= r.endAt) return r.st.over === 'won' ? 'won' : 'Whoops, the stack fell over! Again?';
    return null;
  }

  /* ---------------------------------- Pop-Up Whack ---------------------------------- */
  whackJack(eye, dir) {
    const r = this.gm.run, res = whackAt(r.st, r.t, this.sets.whack.boxes, eye, dir);
    if (!res.swung) return false;
    r.swingT = 0;
    if (!res.hit) { sound.play('doorwhoosh'); this.once('party-whiff', 'Whoosh! Wait for a jack to pop up, then whack it.'); }
    else if (res.pie) { sound.play('piesplat'); r.splatT = 0; this.toast('Splat! That jack had a pie! -1'); }
    else { sound.play(res.gold ? 'jackcatch' : 'pinatawhack'); if (res.gold) this.toast('Gold jack! +2'); }
    return true;
  }
  step_whack(dt) {
    const r = this.gm.run;
    r.t += dt;
    if (r.swingT < 9) r.swingT += dt;
    if (r.splatT < 9) r.splatT += dt;
    this.syncBoxes();
    const over = r.st.over ?? whackTimeUp(r.st, r.t);
    if (over === 'won') return 'won';
    if (over) return `You got ${r.st.score}! Again?`;
    return null;
  }
  // The pop-up boxes' lids: open while a jack flies out (Jack Catch) or is up (Pop-Up Whack); closed boxes stay while the set is up.
  syncBoxes() {
    const g = this.gm;
    for (const id of ['catch', 'whack']) {
      if (g?.game !== id || (g.phase !== 'run' && g.phase !== 'ready' && g.phase !== 'won' && g.phase !== 'missed')) continue;
      const set = this.sets[id], open = new Set();
      if (g.phase === 'run' && g.run) {
        if (id === 'catch') for (const [box, at] of g.run.open) { if (g.run.t - at < 0.4) open.add(box); }
        else for (const { p } of upAt(g.run.st, g.run.t)) open.add(p.box);
      }
      for (const b of set.boxes) this.cells.want(...b.cell, open.has(b.i) ? B.POP_BOX_OPEN : B.POP_BOX);
    }
  }

  /* ---------------------------------- wild gift boxes stay away from a game ---------------------------------- */
  hideNooks() { if (this.savedNooks || !this.world.nooks) return; this.savedNooks = this.world.nooks; this.world.nooks = this.savedNooks.filter(n => !this.nearGame(n)); }
  restoreNooks() { if (this.savedNooks) { if (this.world === this.game.world) this.world.nooks = this.savedNooks; this.savedNooks = null; } }
  nearGame(q) { return Math.hypot(q.x - C.x, q.z - C.z) < PARTY.clearR; }
  clearWilds() {
    const cm = this.game.creatures;
    if (!cm?.list) return;
    for (const w of [...cm.list]) if (!w.frozen && this.nearGame(w.pos)) cm.remove(w);
  }

  /* ---------------------------------- people: the guests, the party crashers, Jolly Jax; the candles ---------------------------------- */
  cheer() {
    let n = 0;
    for (const p of this.game.npcs?.list || []) if (p.kind === 'guest' && p.def?.party && !p.away) { p.cheer = 1.8; n++; }
    if (n) { sound.play('partyyay'); this.toast('Yay!'); }
  }
  sync() {
    const g = this.game, st = this.bows(), list = g.npcs?.list || [], first = this.first;
    this.first = false;
    if (!list.length) { this.first = true; return; } // (the people are made after the live part; try again next time)
    // the party crashers: Ribbon Rosa after the 1st bow, Confetti Kit after the 3rd; a helper beaten on an earlier visit stays away
    for (const c of CRASHERS) {
      const npc = list.find(n => n.kind === 'crew' && n.def?.boss === 'doors' && n.def.index === c.i);
      if (!npc) continue;
      const beaten = (g.beaten || []).includes(`pw:doors:crew${c.i + 1}`);
      const want = st.n >= c.after && (!beaten || this.crashed.has(c.i));
      if (want && npc.away) {
        g.npcs.placeAt(npc, [c.x + 0.5, FLOOR + 1, c.z + 0.5], Math.PI);
        this.crashed.add(c.i);
        if (!first) { npc.model.scale.setScalar(0.3); npc.popT = 0; sound.play('jackpop'); this.doBurst([c.x + 0.5, 12.5, c.z + 0.5], 0.5); this.toast(`Surprise! A party crasher! ${npc.name} wants a battle!`); }
      } else if (!want && !npc.away && !g.inBattle) g.npcs.sendAway(npc);
    }
    // Jolly Jax: on the cake once the four bows are won (bursting out of it if that happened just now)
    const boss = this.bossNpc();
    if (boss) {
      if (st.done && boss.away) {
        g.npcs.placeAt(boss, [CAKE.x + 0.5, CAKE.stand + 1, CAKE.z + 0.5], 0);
        if (!first) this.finale = { t: 0, said: false, rose: false };
      } else if (!st.done && !boss.away && !g.inBattle) { g.npcs.sendAway(boss); this.finale = null; }
    }
    // the candles (lit one by one in the finale)
    if (!this.finale) for (const [x, y, z] of candleCells()) this.cells.want(x, y, z, st.done ? B.CANDLE : B.AIR);
    // the guests: by the table and the presents, round the cake for the finale
    for (const p of list) {
      if (p.kind !== 'guest' || !p.def?.party) continue;
      const def = GUESTS.find(q => q.name === p.name);
      if (!def) continue;
      const at = st.done ? def.cake : def.at, key = at.join();
      if (p.partyAt === key) continue;
      p.partyAt = key;
      g.npcs.placeAt(p, at, st.done ? Math.atan2(CAKE.x + 0.5 - at[0], CAKE.z + 0.5 - at[2]) : def.yaw);
    }
    // the Spinner's face shows the won games with a bow
    const fk = st.bows.join();
    if (fk !== this.faceKey) { this.faceKey = fk; this.spinner?.userData.redraw(st.bows); }
  }
  stepFinale(dt) {
    const f = this.finale;
    if (!f) return;
    f.t += dt;
    const lit = Math.floor(f.t / PARTY.candle);
    candleCells().forEach(([x, y, z], i) => this.cells.want(x, y, z, i < lit ? B.CANDLE : B.AIR));
    const boss = this.bossNpc();
    if (f.t >= PARTY.surprise && !f.said) {
      f.said = true;
      sound.play('candyrain'); setTimeout(() => sound.play('jackpop'), 300);
      this.toast('🎉 SURPRISE! 🎉');
      this.doBurst([CAKE.x + 0.5, 18, CAKE.z + 0.5], 1.6);
      this.cheer();
    }
    if (boss?.model) { // he rises out of the top of the cake
      const k = ease((f.t - PARTY.surprise) / PARTY.rise);
      boss.model.position.y = boss.pos.y - 4 + 4 * k;
      boss.model.visible = f.t >= PARTY.surprise;
    }
    if (f.t >= PARTY.surprise + PARTY.rise + 0.4) {
      if (boss?.model) { boss.model.position.y = boss.pos.y; boss.model.visible = true; }
      this.toast('🤡 Jolly Jax: SURPRISE! This party is for YOU! Come and battle me for the star!');
      this.finale = null;
    }
  }

  /* ---------------------------------- the clock ---------------------------------- */
  update(dt) {
    this.cells.flush();
    if (this.needSave) { this.needSave = false; this.game.save?.(); }
    if ((this.syncAcc += dt) >= 0.25) { this.syncAcc = 0; this.sync(); }
    if (!this.manual && !this.paused()) this.step(dt);
    this.draw(dt);
  }
  step(dt) {
    this.clock += dt;
    this.stepSpinner(dt);
    this.stepGame(dt);
    this.stepFinale(dt);
    if (this.burst) { this.burst.age += dt; if (this.burst.age > 3.4) this.burst = null; }
    const g = this.gm, dark = g?.twist?.id === 'dark' && (g.phase === 'run' || g.phase === 'ready');
    this.dim += ((dark ? PARTY.dark : 1) - this.dim) * Math.min(1, dt * 3);
    if (Math.abs(this.dim - 1) < 0.002) this.dim = 1;
    this.game.lightsDim = this.dim;
    if (g?.phase === 'run' && (this.clearAcc += dt) >= 0.5) { this.clearAcc = 0; this.clearWilds(); }
    this.cells.flush();
    if ((this.chipAcc += dt) >= 0.2) { this.chipAcc = 0; this.chip(); }
  }
  chip() {
    const ui = this.game.ui;
    if (!ui?.setScore) return;
    const st = this.bows(), g = this.gm;
    let s = null;
    if (!this.inRoom()) s = null;
    else if (g?.phase === 'run') {
      const R = `${ICON[g.game]} ${g.round}/3 · `, r = g.run;
      if (g.game === 'pinata') { const hp = r.runs.reduce((a, q) => a + q.plan.hp, 0), left = r.runs.reduce((a, q) => a + q.hp, 0); s = { text: `${R}CRACKs ${hp - left} / ${hp} · ⏱ ${Math.max(0, Math.ceil(r.runs[0].plan.time - r.t))}`, done: false }; }
      else if (g.game === 'catch') s = { text: `${R}${r.run.score} / ${r.run.plan.need} · ${jacksLeft(r.run)} left`, done: false };
      else if (g.game === 'stack') s = { text: `${R}${r.st.placed} / ${r.st.plan.need} presents`, done: false };
      else s = { text: `${R}${r.st.score} / ${r.st.plan.need} · ⏱ ${Math.max(0, Math.ceil(r.st.plan.time - r.t))}`, done: false };
    } else if (g) s = { text: `${ICON[g.game]} ${GAME_NAMES[g.game]} · round ${g.round} / 3${g.phase === 'ready' ? ' · Press Play!' : ''} · 🎀 ${st.n} / 4`, done: false };
    else if (st.done) s = { text: (this.game.stars || []).includes('doors') ? 'Jolly Jax is on the cake!' : 'Battle Jolly Jax on the cake!', done: true };
    else s = { text: `🎀 ${st.n} / 4 golden bows · Spin the Party Spinner!`, done: false };
    ui.setScore(s);
  }

  /* ---------------------------------- drawing ---------------------------------- */
  doBurst(at, scale = 1) { this.burst = { x: at[0] ?? at.x, y: at[1] ?? at.y, z: at[2] ?? at.z, age: 0, scale }; }
  draw() {
    if (!this.spinner) return;
    this.spinner.userData.setAngle(this.wheelAngle());
    const bulbs = this.spinner.userData.parts.bulbs; // the rim lights chase while it spins
    if (bulbs.material) bulbs.material.color.setScalar(this.sp.phase === 'idle' ? 0.9 : 0.7 + 0.3 * Math.abs(Math.sin(this.clock * 12)));
    this.balloons.userData.update(this.clock);
    let nShadow = 0, nRing = 0;
    const o = this.tmp;
    const shadow = (x, z, size) => { if (nShadow >= 10) return; o.position.set(x, 11.03, z); o.rotation.set(0, 0, 0); o.scale.setScalar(Math.max(0.05, size)); o.updateMatrix(); this.shadows.setMatrixAt(nShadow++, o.matrix); };
    const ring = (x, z, size, col) => { if (nRing >= 8) return; o.position.set(x, 11.05, z); o.rotation.set(0, this.clock * 2, 0); o.scale.setScalar(size); o.updateMatrix(); this.rings.setMatrixAt(nRing, o.matrix); this.rings.setColorAt(nRing, col); nRing++; };
    this.drawPinatas(shadow);
    this.drawStick();
    this.drawCatch(shadow, ring);
    this.drawStack();
    this.drawWhack();
    this.shadows.count = nShadow; this.rings.count = nRing;
    this.shadows.instanceMatrix.needsUpdate = this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    this.drawCream();
    this.drawConfetti();
  }
  drawPinatas(shadow) {
    const g = this.gm, on = g?.game === 'pinata' && g.run && (g.phase === 'run' || g.phase === 'won' || g.phase === 'missed');
    const waiting = g?.game === 'pinata' && (g.phase === 'ready' || g.phase === 'build');
    this.bow.visible = false; this.prop.visible = false;
    this.pin.forEach((q, i) => {
      let pos = null, top = null, run = null;
      if (on && g.run.runs[i]) {
        run = g.run.runs[i];
        const popped = g.run.popped.get(i);
        if (popped && g.run.t >= popped.t) { q.body.visible = q.rope.visible = q.balloons.visible = false; if (g.phase === 'won' && i === 0) this.drawBurst(popped.at, g.t); return; }
        const t = g.phase === 'run' ? g.run.t : Math.min(g.run.t, run.plan.time), qq = pinataAt(run, t), up = g.phase === 'missed' ? ease(g.t / PARTY.rest.pinataNap) * 7 : 0;
        pos = { x: qq.x, y: qq.y + up, z: qq.z }; top = { x: qq.top.x, y: PINATA.low + PINATA.rope + up, z: qq.top.z };
        q.body.geometry = this.pinataGeos[run.plan.id];
      } else if (waiting && i === 0) { // waiting for Play!: the next piñata hangs high over the middle of the rug and turns gently
        const sway = Math.sin(this.clock * 1.3) * 0.5;
        top = { x: PINATA.ring.x, y: PINATA.low + PINATA.rope + 2.5, z: PINATA.ring.z };
        pos = { x: PINATA.ring.x + sway, y: top.y - PINATA.rope + 0.03, z: PINATA.ring.z };
        q.body.geometry = this.pinataGeos[PINATA.rounds[g.round - 1].id];
      }
      q.body.visible = q.rope.visible = q.balloons.visible = !!pos;
      if (!pos) return;
      q.body.material = this.dim < 0.8 ? this.pinataGlow : this.pinataLit; // "Lights out!": the piñata glows
      const dx = pos.x - top.x, dy = pos.y + 0.7 - top.y, dz = pos.z - top.z;
      q.balloons.position.set(top.x, top.y, top.z); q.balloons.rotation.y = Math.sin(this.clock * 0.7 + i) * 0.3;
      const lastHit = run?.log?.length ? run.log[run.log.length - 1] : null, since = lastHit?.hit && g.phase === 'run' ? g.run.t - lastHit.tau : 9;
      const wob = since >= 0 && since < 0.4 ? Math.sin(since * 40) * 0.25 * (1 - since / 0.4) : 0;
      q.body.position.set(pos.x, pos.y, pos.z);
      q.body.rotation.set(Math.atan2(dz, -dy) * 0.6 + wob, this.clock * 0.6, -Math.atan2(dx, -dy) * 0.6);
      const dmg = run ? 1 - run.hp / run.plan.hp : 0;
      q.body.scale.set(1 + dmg * 0.12, 1 - dmg * 0.18, 1 + dmg * 0.12);
      q.body.updateMatrix(); this.tmpV.set(0, 0.6, 0).applyMatrix4(q.body.matrix);
      const kx = this.tmpV.x - top.x, ky = this.tmpV.y - top.y, kz = this.tmpV.z - top.z, len = Math.hypot(kx, ky, kz) || 1;
      q.rope.position.set(top.x, top.y, top.z);
      this.tmpV.set(kx / len, ky / len, kz / len); q.rope.quaternion.setFromUnitVectors(this.up, this.tmpV);
      q.rope.scale.set(1, len, 1);
      shadow(pos.x, pos.z, 1.3 - Math.min(0.8, (pos.y - PINATA.low) * 0.3));
    });
  }
  // The bow drops out of the candy and flies to you; the silly surprise falls to the floor.
  drawBurst(b, k) {
    const r = this.gm.run;
    this.prop.visible = true;
    this.prop.geometry = this.propGeos[SILLY[r.silly].id];
    const fall = Math.min(1, k / 0.7), py = b.y + (11.05 - b.y) * fall * fall;
    this.prop.position.set(b.x + 0.8, py, b.z); this.prop.scale.setScalar(Math.max(0.01, Math.min(1, k * 3))); this.prop.rotation.set(0, k * 2, 0);
    if (this.gm.round < 3) return; // the golden bow only for the third piñata (the game's bow)
    const fly = ease(Math.max(0, (k - 0.5) / 1.0)), eye = this.eye();
    this.bow.visible = k < 1.5;
    this.bow.position.set(b.x + (eye.x - b.x) * fly, b.y + (eye.y - b.y) * fly + Math.sin(Math.PI * fly) * 1.2, b.z + (eye.z - b.z) * fly);
    this.bow.scale.setScalar(1 + 0.5 * fly); this.bow.rotation.set(0, k * 3, 0);
  }
  // The party stick in your hand (the Piñata Party and Pop-Up Whack): it rests to the right and swings across when you whack.
  drawStick() {
    const g = this.gm, cam = this.game.camera;
    const on = g?.phase === 'run' && (g.game === 'pinata' || g.game === 'whack') && this.onSquare() && cam;
    this.stick.visible = !!on;
    if (!on) return;
    const k = Math.min(1, g.run.swingT / PARTY.stickSwing), arc = k < 1 ? Math.sin(k * Math.PI) : 0, o = this.tmp;
    o.position.copy(cam.position); o.quaternion.copy(cam.quaternion);
    o.translateX(0.3 - arc * 0.4); o.translateY(-0.26 + arc * 0.08); o.translateZ(-0.6);
    o.rotateY(0.45 + arc * 1.0); o.rotateX(0.85 - arc * 0.7);
    this.stick.position.copy(o.position); this.stick.quaternion.copy(o.quaternion); this.stick.scale.setScalar(0.32);
  }
  drawCatch(shadow, ring) {
    const g = this.gm, o = this.tmp;
    let nj = 0, np = 0;
    if (g?.game === 'catch' && g.phase === 'run' && g.run) {
      const c = g.run, helpRing = kindHelp(c.run.plan.help).on;
      for (const { l, q, to } of inAir(c.run, c.t)) {
        const spin = (c.t - l.t0) * 7 + l.n;
        if (l.kind === 'pie') {
          if (np >= 9) continue;
          o.position.set(q.x, q.y, q.z); o.rotation.set(Math.sin(spin) * 0.3, spin * 0.5, 0); o.scale.setScalar(1); o.updateMatrix();
          this.pies.setMatrixAt(np++, o.matrix);
          ring(to[0], to[1], 0.9 + 0.3 * Math.sin(this.clock * 9), RING_PINK);
        } else {
          if (nj >= 9) continue;
          o.position.set(q.x, q.y, q.z); o.rotation.set(spin * 0.6, spin, 0); o.scale.setScalar(l.kind === 'gold' ? 1.1 : 1); o.updateMatrix();
          this.jacks.setMatrixAt(nj, o.matrix); this.jacks.setColorAt(nj, l.kind === 'gold' ? JACK_GOLD : JACK_PLAIN); nj++;
          shadow(q.x, q.z, 0.35 + 0.65 * q.s);
          if (helpRing) ring(to[0], to[1], 0.8, RING_GOLD);
        }
      }
    }
    this.piesN = np;
    this.jacks.count = nj;
    this.jacks.instanceMatrix.needsUpdate = true;
    if (this.jacks.instanceColor) this.jacks.instanceColor.needsUpdate = true;
  }
  drawWhack() {
    const g = this.gm, o = this.tmp;
    let n = 0, nl = 0, np = this.piesN || 0;
    if (g?.game === 'whack' && g.phase === 'run' && g.run) {
      const st = g.run.st, t = g.run.t, boxes = this.sets.whack.boxes;
      for (const { p, rise } of upAt(st, t)) {
        if (n >= 9) break;
        const h = headOf(boxes, p, rise), face = Math.atan2(this.pos().x - h.x, this.pos().z - h.z);
        o.position.set(h.x, h.y - 0.33, h.z); o.rotation.set(0, face, Math.sin(t * 9 + p.n) * 0.08); o.scale.setScalar(p.kind === 'gold' ? 1.1 : 1); o.updateMatrix();
        this.wjacks.setMatrixAt(n, o.matrix); this.wjacks.setColorAt(n, p.kind === 'gold' ? JACK_GOLD : JACK_PLAIN); this.noses.setMatrixAt(n, o.matrix); n++;
        if (p.kind === 'pie' && np < 9) { // the pie it holds out in front
          o.position.set(h.x + Math.sin(face) * 0.55, h.y - 0.25, h.z + Math.cos(face) * 0.55); o.rotation.set(0.3, face, 0); o.scale.setScalar(0.8); o.updateMatrix();
          this.pies.setMatrixAt(np++, o.matrix);
        }
      }
      for (const b of shaking(st, t)) { // the lid of a box about to pop jiggles
        if (nl >= 9) break;
        const a = boxes[b].at;
        o.position.set(a[0] + Math.sin(t * 50 + b) * 0.06, a[1] + 0.08 + Math.abs(Math.sin(t * 30 + b)) * 0.14, a[2]); o.rotation.set(Math.sin(t * 40) * 0.08, 0, Math.cos(t * 37) * 0.08); o.scale.setScalar(1); o.updateMatrix();
        this.lids.setMatrixAt(nl++, o.matrix);
      }
    }
    this.wjacks.count = n; this.noses.count = n; this.lids.count = nl; this.pies.count = np;
    for (const m of [this.wjacks, this.noses, this.lids, this.pies]) m.instanceMatrix.needsUpdate = true;
    if (this.wjacks.instanceColor) this.wjacks.instanceColor.needsUpdate = true;
  }
  drawStack() {
    const g = this.gm, on = g?.game === 'stack' && (g.phase === 'ready' || g.phase === 'run' || g.phase === 'won' || g.phase === 'missed');
    this.crane.visible = !!on;
    let n = 0;
    const o = this.tmp, T = this.sets.stack.table, put = (x, y, z, w, h, d, colour, rx = 0, rz = 0) => {
      if (n >= 48) return;
      o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.scale.set(w, h, d); o.updateMatrix();
      this.presents.setMatrixAt(n, o.matrix); this.presents.setColorAt(n, new THREE.Color(colour)); n++;
    };
    if (on) {
      const r = g.run, st = r?.st, t = r ? r.t : this.clock, h = st ? craneAt(st.plan, t) : { x: Math.sin(this.clock) * 2, z: 0 };
      const H = STACK.height, crane = this.sets.stack.crane;
      // the stack
      (st?.pieces || []).forEach((p, i) => {
        const f = r.falls.find(q => q.piece === p);
        if (f && t - f.t0 < STACK.fall) return; // still falling
        put(T.x + p.x, this.stackTop(i) + H / 2, T.z + p.z, p.w, H, p.d, PRESENT_COLOURS[i % PRESENT_COLOURS.length]);
      });
      // falling presents and the bits cut off (they tumble to the floor and lie there)
      for (const f of r?.falls || []) {
        const k = Math.min(1, (t - f.t0) / STACK.fall);
        if (k < 1 && !f.miss) put(T.x + f.at.x, f.from - (f.from - f.y - H / 2) * k * k, T.z + f.at.z, f.size.w, H, f.size.d, f.colour);
        for (const [j, c] of (f.miss ? [{ x: f.at.x, z: f.at.z, w: f.size.w, d: f.size.d }] : f.cut).entries()) {
          const u = t - f.t0, side = Math.sign(c.x - (f.piece?.x ?? 0)) || (j % 2 ? 1 : -1), drop = Math.min(1, u / (STACK.fall + 0.5));
          const y = f.from - (f.from - (11 + H / 2)) * drop * drop;
          put(T.x + c.x + side * drop * 1.2, y, T.z + c.z, c.w, H, c.d, f.colour, 0, side * drop * 1.3);
        }
      }
      // the present on the hook, and the crane's trolley and cable over it
      const ready = st ? loaded(st, t) : true, hy = this.hookY(st?.placed ?? 0), size = st?.size ?? { w: STACK.start, d: STACK.start };
      if (ready && !st?.over) put(T.x + h.x, hy - 0.2 - H / 2, T.z + h.z, size.w, H, size.d, PRESENT_COLOURS[(st?.placed ?? 0) % PRESENT_COLOURS.length]);
      const P = this.crane.userData.parts, armY = FLOOR + 1 + P.top - 0.3;
      P.trolley.position.set(T.x + h.x - crane.x, 0, T.z + h.z - crane.z);
      P.cable.scale.y = Math.max(0.1, armY - hy);
      P.hook.position.set(0, hy - (FLOOR + 1), 0);
    }
    this.presents.count = n;
    this.presents.instanceMatrix.needsUpdate = true;
    if (this.presents.instanceColor) this.presents.instanceColor.needsUpdate = true;
  }
  drawCream() {
    const g = this.gm, cam = this.game.camera, k = g?.run?.splatT ?? 9;
    const on = cam && k < PARTY.splat && (g.game === 'catch' || g.game === 'whack');
    this.cream.visible = !!on;
    if (!on) return;
    const o = this.tmp;
    o.position.copy(cam.position); o.quaternion.copy(cam.quaternion); o.translateZ(-0.5); o.translateX(0.06); o.translateY(0.03);
    this.cream.position.copy(o.position); this.cream.quaternion.copy(o.quaternion);
    this.cream.scale.setScalar(0.18 + 0.05 * Math.min(1, k * 8));
    this.cream.material.opacity = 0.85 * (1 - ease(k / PARTY.splat));
  }
  drawConfetti() {
    const b = this.burst, cam = this.game.camera, mesh = this.confetti.userData.parts.mesh;
    if (!b || !cam) { mesh.count = 0; return; }
    const o = this.tmp, a = b.age, N = PARTY.confetti, fade = a > 2.6 ? Math.max(0, 1 - (a - 2.6) / 0.8) : 1;
    mesh.count = N;
    for (let i = 0; i < N; i++) {
      const q = PP.confettiAt(b, i);
      o.position.set(q.x, q.y, q.z); o.quaternion.copy(cam.quaternion); o.rotateZ(a * 6 + i); o.scale.setScalar(Math.max(0.01, fade)); o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------------------------------- after a Boss battle, tests ---------------------------------- */
  // A won Boss battle uses the four bows up (a rematch is a new party, a bit harder).
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.picture?.id !== 'doors' || opts.picture.crew != null) return;
    const g = this.game;
    for (let i = 1; i <= 4; i++) { const k = g.beaten.indexOf(bowKey(i)); if (k >= 0) g.beaten.splice(k, 1); }
    for (const id of GAMES) { this.attempts[id] = [0, 0, 0, 0]; this.misses[id] = [0, 0, 0, 0]; }
    this.sweetsReady = true;
    setTimeout(() => this.sync(), 0);
  }
  info() {
    const g = this.gm, r = g?.run;
    const run = g?.game === 'pinata' ? r?.runs?.[0] : null;
    return {
      clock: this.clock, bows: this.bows(), spinner: { phase: this.sp.phase, slice: this.sp.slice, n: this.sp.n, angle: this.wheelAngle() },
      game: g && { game: g.game, round: g.round, phase: g.phase, twist: g.twist?.id ?? null, t: g.t, misses: [...this.misses[g.game]] },
      pinata: run && { runs: r.runs.length, hp: r.runs.map(q => q.hp), need: r.runs.map(q => q.plan.hp), hits: r.runs.reduce((a, q) => a + q.hits, 0), big: r.runs.reduce((a, q) => a + q.big, 0), t: r.t },
      catch: g?.game === 'catch' && r ? { score: r.run.score, need: r.run.plan.need, splats: r.run.splats, left: jacksLeft(r.run) } : null,
      stack: g?.game === 'stack' && r ? { placed: r.st.placed, need: r.st.plan.need, perfects: r.st.perfects, width: r.st.size.w, over: r.st.over } : null,
      whack: g?.game === 'whack' && r ? { score: r.st.score, need: r.st.plan.need, splats: r.st.splats, whiffs: r.st.whiffs } : null,
      finale: !!this.finale, dim: this.dim, crashed: [...this.crashed],
    };
  }
}
