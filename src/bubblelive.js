// The live part of the Bubble Well (LIVE.bubble, made by gymLive.reset for the part in world.parts), plans/bubble-well.md (and its
// "Rework 2026-10-29": "Easy to understand, hard to master"). It wires the pure rules (bubbles.js) to the player, the meshes
// (bubbleprops.js) and the world:
//  - the Bubble Stairs: Blow! (the big button, E, a click, a tap on the screen; one press, never held) puts a bubble two blocks ahead of
//    your feet (a ghost bubble shows where). Only with your feet on something: in the air nothing happens (no pillar of bubbles under
//    you). It waits a moment, then floats up: hop on it (sooner = a little higher, later = a lot higher, too late = gone). Land on it and
//    it holds you (a `carry` object: walk about on its top, Jump = Bounce off it); it pops soon after. Two bubbles that touch both pop.
//    Six puffs of soap; soap flowers fill the wand. A fall from a bubble puts you back on the ledge you started from. Landing on the
//    plateau by the narrow shaft from a bubble = the Bubble Stairs (pw:bubble:stairs). Then the first fizz lift runs.
//  - the ducklings: Blow! round a sleeping one, then Puff! nudges it the way you look (an arrow on the floor shows how far it glides);
//    the bubble lasts a while, then the duckling wakes and waddles home to its island; a gust lane blows across the thorn pen now and
//    then. Home in the nest = pw:bubble:duck1..3 (saved at once). Once all three are home, Blow! by the nest sends one back to play again.
//  - the Chimney Ride: Ride! by the big golden bubble ("Ride!" sign); every tap (Jump, the big button, a tap on the screen) is a puff up;
//    the stick steers; fly through the gold rings. The top = pw:bubble:chimney (and the second fizz lift runs).
//  - Captain Suds' shields: a bank shot. Stand on the round's gold pad, Blow! sends a bubble flying flat the way you look (a dotted line
//    shows its way to the first bounce); it bounces off the pink soap cushion and pops the shield (pw:bubble:shield1..3). With all three
//    popped (and the crew beaten) Captain Suds battles. Then the rounds play again just for fun (forfun.js).
// Never a fail: a pop or a fall only puts you back a little, a miss starts the try again, the kind help comes after misses (kindhelp.js
// through bubbleHelp). Clocks are summed frame dt and stand still in a battle / an ask / a panel / the pause. Bubbles are meshes, never
// blocks, never saved or sent. `manual` + step(dt, input) for tests; info() for tests.
import * as THREE from 'three';
import { B } from './blocks.js';
import { sound } from './sound.js';
import { buildModel, animateModel, disposeModel } from './species.js';
import { kindHelp } from './kindhelp.js';
import { ForFun, FUN } from './forfun.js';
import { BUBBLE, BubbleField, Duckling, DUCK, Ride, RIDE, BANK, bankShot, aimLine, cushionsAt, gustAt, glideOf, dripAt, gapOf, landsOn, hopHeight } from './bubbles.js';
import { bubbleState, bubbleAim, stairsKey, duckKey, chimneyKey, shieldKey, BUBBLE_KEYS, CHIMNEY, GARDEN_RULES, ISLANDS, NEST, SHIELD, COURT, courtOf, LIFTS, DRIPS, VENT2, BREEZES, SOAP_FLOWERS, MESA, BENCH, RIM, STAIRS_TOP, THORNS, CURRENTS, GUSTS, inChimney, inStairs } from './bubbleland.js';
import { buildBubbles, buildGhost, buildWand, buildDrips, buildStreams, drawStreams, buildFlowers, buildThorns, buildNest, buildChimney, buildBigBubble, buildRideBubble, buildSign, buildShields, buildDots, drawDots, buildArrow, buildCushion, buildPad, hideAll } from './bubbleprops.js';

// dtMax: the longest frame step; flower: how near a soap flower fills your wand; fall: how far below your ledge a fall from a bubble
// puts you back; restOut: seconds resting at the chimney's bottom before you hop out; rideR: how near the chimney's big bubble Ride!
// shows; reach: how far the big button looks for a door in front of you (a way back is used, not blown at); off: how fast the stick
// walks you about on a bubble's top; settle: seconds after landing on a bubble before the stick walks you (a child still holding W from
// the hop stays on it); court: the rim's part where Blow! means the shield game (x0, x1, z0, z1); nestR: how near the nest Blow! sends a
// homed duckling back to play again (once all three are home).
export const BUBBLE_RULES = { dtMax: 0.1, sayGap: 3, sync: 0.25, flower: 1.1, fall: 2.5, restOut: 4, rideR: 2.8, reach: 5.5, off: 1.6, settle: 0.5, court: { x0: 64, x1: 98, z0: 22, z1: 38 }, nestR: 3.2 };
const WORDS = {
  wand: '🫧 Bubble Bee lends you a bubble wand! Blow a bubble ahead, hop on, hop again!',
  first: 'Hop on your bubble! (Let it float up a little first and it lifts you higher.)',
  air: 'Land first! You can only blow from the ground or from a bubble.',
  touch: 'Pop-pop! Two bubbles touched. Let one float up before you blow the next.',
  late: 'Too high! It floated away. Hop a little sooner.',
  land: 'On a bubble! It pops soon: blow the next one, let it float up a little, then Bounce on!',
  warn: 'Wobble! That bubble is about to pop!',
  back: 'Whoops! Back on the ledge. Try again!',
  soap: 'Soap! Your wand is full again.',
  noSoap: 'No soap left! Walk through a soap flower to fill your wand.',
  wall: 'No room there! Turn to an open side and blow.',
  stairs: '🫧 You climbed the Bubble Stairs! Wanda Wand is waiting. The fizz lift runs now.',
  duckBlow: 'Now Puff! it toward the nest. The arrow shows how far it glides: stand far for a little puff, close for a big one!',
  duckPop: n => `Pop! Duckling ${n} plopped back onto its island. Blow a new bubble round it!`,
  duckHurry: n => `Hurry! Duckling ${n}'s bubble is getting thin.`,
  duckWake: n => `Yawn! Duckling ${n}'s bubble popped and it woke up. It waddles home: blow a bubble round it again!`,
  duckHome: (n, k) => `🦆 Duckling ${n} is home! (🦆 ${k} / 3)`,
  allHome: '🦆 All the ducklings are home! Duckherd Daisy wants to say thank you.',
  again: n => `🦆 Duckling ${n} hops back to its island. Float it home again! ${FUN.tag}`,
  stream: 'Whee! The bubble stream carries it away. Puff it across, a little up the stream!',
  gust: 'Whoosh! A gust blows across the thorn pen now and then. Puff when it is calm!',
  ride: '🫧 Tap Jump to float up. Fly through the gold rings!',
  ridePop: 'Pop! Back to the last fizz star.',
  rideOut: 'You hopped out of the bubble.',
  chimney: '🫧 Up the chimney! Mate Fizz is on the rim. The second fizz lift runs now.',
  court: '🛡️ Stand on the gold pad and Blow!: bounce your bubble off the pink cushion into the shield!',
  pad: 'Stand on the glowing gold pad to blow at the shields!',
  slider: 'This cushion slides up and down. Blow when the dotted line bounces toward the shield!',
  shieldHit: k => `🛡️ Pop! A shield burst! (🛡️ ${k} / 3)`,
  shieldMiss: 'Boing! It missed. Try a slightly different angle!',
  shieldFence: 'Splat! The foam fence. Bounce it off the pink cushion!',
  allShields: 'All three shields popped! Captain Suds is ready to battle.',
  funShield: '🛡️ Pop! Right in!',
};
const DOOR_IDS = new Set([B.WAY_BACK, B.PICTURE_FRAME]);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const SHOT_Y = COURT.y + BANK.h;

export class BubbleLive {
  constructor(game, part) {
    this.game = game; this.part = part; this.world = game.world; this.scene = game.scene;
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;
    this.clock = 0; this.syncT = 0; this.told = new Set(); this.said = new Map();
    this.field = new BubbleField({ hard: this.hard });
    this.stood = null; this.left = null; this.off = { x: 0, z: 0 }; this.stick = { wx: 0, wz: 0, analog: 0 }; this.stepOff = false; this.spaceWas = true;
    this.ledge = null; this.fromBubble = false; this.prevFeet = null; this.stairMiss = [0, 0]; this.blown = null;
    this.ducks = ISLANDS.map(i => new Duckling(GARDEN_RULES, i, { hard: this.hard })); this.duckMiss = [0, 0, 0]; this.duckFun = [false, false, false]; this.gardenT = 0;
    this.ride = null; this.rideMiss = 0; this.rideIn = { sx: 0, sz: 0 }; this.restT = 0; this.rideOut = false; this.starsGot = new Set();
    this.shots = []; this.shotMiss = [0, 0, 0]; this.burst = [9, 9, 9]; this.courtT = 0; this.shieldFun = new ForFun(3);
    this.liftsOn = [null, null];
    this.standObj = this.makeStandObj(); this.rideObj = this.makeRideObj();
    this.groups = [];
    this.build();
    this.sync(true);
  }
  get hard() { return !!this.game.stars?.includes('bubble'); }
  state() { return bubbleState(this.game); }
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  toast(m) { this.game.ui?.toast(m); }
  once(key, m) { if (this.told.has(key)) return; this.told.add(key); this.toast(m); }
  say(key, m, gap = BUBBLE_RULES.sayGap) { const t = this.clock; if (t - (this.said.get(key) ?? -1e9) < gap) return; this.said.set(key, t); this.toast(m); }
  save() { this.game.save?.(); }
  addKey(k) { const g = this.game; if (!g.beaten.includes(k)) g.beaten.push(k); this.save(); }

  /* ---------------------------------------------- meshes ---------------------------------------------- */
  build() {
    const add = o => { this.groups.push(o); this.scene?.add(o); return o; };
    this.bubbles = add(buildBubbles(4));       // 0..1 your bubbles, 2..3 shot bubbles
    this.ghost = add(buildGhost(BUBBLE.r));
    this.wand = add(buildWand());
    this.drips = add(buildDrips(DRIPS.length));
    this.flowers = add(buildFlowers(SOAP_FLOWERS));
    this.thorns = add(buildThorns(THORNS, MESA.top + 1));
    this.nest = add(buildNest(NEST, MESA.top + 1));
    this.chim = add(buildChimney(CHIMNEY, gapOf));
    this.rideBubble = add(buildRideBubble(RIDE.R));
    this.rideSign = add(buildSign('Ride!'));
    this.shields = add(buildShields(SHIELD));
    const c = CURRENTS[0];
    this.streams = add(buildStreams([
      { ...VENT2, n: 18 },
      ...BREEZES.map((b, i) => ({ ...b, n: i ? 16 : 70, colour: 0xffffff })),
      { x0: c.x0, x1: c.x1 - 1, y0: MESA.top + 1, y1: MESA.top + 1, z0: c.z0, z1: c.z1 - 1, vx: 0, vy: 0, vz: c.vz, n: 48, colour: 0xbfefff },
      ...LIFTS.map(l => ({ x0: l.x[0], x1: l.x[1], y0: l.y[0], y1: l.y[1], z0: l.z[0], z1: l.z[1], vx: 0, vy: 3, vz: 0, n: 40 })),
    ]));
    this.gusts = add(buildStreams(GUSTS.map(g => ({ x0: g.x0, x1: g.x1 - 1, y0: MESA.top + 1, y1: MESA.top + 1.6, z0: g.z0, z1: g.z1 - 1, vx: g.vx, vy: 0, vz: g.vz, n: 60, colour: 0xe8fbff })), 0.09));
    this.arrow = add(buildArrow());
    this.aimDots = add(buildDots(48, 0xffffff, 0.07));
    this.cushions = COURT.rounds.map(r => [...r.cushions, ...(r.slider ? [r.slider.box] : [])].map(b => add(buildCushion(b, COURT.y))));
    this.pads = COURT.rounds.map(r => add(buildPad(r.pad.x, COURT.y, r.pad.z, BANK.pad)));
    this.duckModels = this.ducks.map(() => { try { const m = buildModel('squeaklet'); m.scale.setScalar(0.8); this.scene?.add(m); return m; } catch { return null; } });
    this.duckBubbles = this.ducks.map(() => add(buildBigBubble(0.62)));
    try { this.rideDuck = buildModel('squeaklet'); this.rideDuck.scale.setScalar(0.45); this.scene?.add(this.rideDuck); } catch { this.rideDuck = null; }
  }
  dispose() {
    this.giveBack();
    this.game.ui?.setScore?.(null);
    for (const g of this.groups) { this.scene?.remove(g); g.userData.dispose?.(); }
    this.groups = [];
    for (const m of [...this.duckModels, this.rideDuck]) if (m) { this.scene?.remove(m); disposeModel(m); }
    this.duckModels = []; this.rideDuck = null;
    const lifts = this.world.lifts;
    if (lifts) for (const l of LIFTS) { const i = lifts.indexOf(l); if (i >= 0) lifts.splice(i, 1); }
  }
  // puts the player down safely wherever a bubble was holding them (a new world, a battle, a reload)
  giveBack() {
    const p = this.game.player;
    if (p?.carry && (p.carry === this.standObj || p.carry === this.rideObj)) {
      const at = p.carry.safe();
      p.carry = null; p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0);
    }
    this.stood = null; this.ride = null; this.rideOut = false;
  }
  ledgeSafe() { const l = this.ledge; return l ? { x: l.x, y: l.y, z: l.z } : { x: 80.5, y: 5, z: 131.5 }; }

  /* ---------------------------------------------- carry objects ---------------------------------------------- */
  makeStandObj() {
    const me = this;
    return {
      where: () => { const b = me.stood; return b ? { x: b.x + me.off.x, y: b.y + BUBBLE.r, z: b.z + me.off.z } : me.ledgeSafe(); },
      steer(wx, wz, analog) { me.stick = { wx, wz, analog }; },
      wantsLeave(space) { const fresh = !!space && !me.spaceWas; me.spaceWas = !!space; return fresh || me.stepOff || !me.stood; },
      leave() { me.leaveBubble(!me.stepOff && !!me.stood); },
      jumpWord: () => 'Bounce',
      safe: () => me.ledgeSafe(),
    };
  }
  makeRideObj() {
    const me = this;
    return {
      where: () => { const r = me.ride; return r ? { x: r.x, y: r.y - 1.1, z: r.z } : me.doorOut(); },
      steer(wx, wz, analog, space) {
        me.rideIn = { sx: wx * analog, sz: wz * analog };
        if (space && !me.spaceWas) me.puff();
        me.spaceWas = !!space;
      },
      wantsLeave() { return me.rideOut || !me.ride; },
      leave() { me.endRide(); },
      jumpWord: () => 'Puff',
      safe: () => me.doorOut(),
    };
  }
  doorOut() { return { x: CHIMNEY.x + CHIMNEY.wall + 1.2, y: MESA.top + 1, z: CHIMNEY.z }; }

  /* ---------------------------------------------- the hooks of the live-part interface ---------------------------------------------- */
  // Is the view pointing at a way back (or its frame) close by? Then the big button is the door's, never Blow!.
  doorAhead(eye, dir) {
    for (let s = 0.2; s <= BUBBLE_RULES.reach; s += 0.2) {
      const id = this.world.get(Math.floor(eye.x + dir.x * s), Math.floor(eye.y + dir.y * s), Math.floor(eye.z + dir.z * s));
      if (DOOR_IDS.has(id)) return true;
      if (id !== B.AIR && id !== B.WATER) return false;
    }
    return false;
  }
  flatLook(p) { const f = p.forward, l = Math.hypot(f.x, f.z) || 1; return { x: f.x / l, z: f.z / l }; }
  // What your feet are on: 'bubble', 'ground' or null (in the air: Blow! does nothing there).
  footing(p) { return p.carry === this.standObj && this.stood ? 'bubble' : p.onGround && !p.carry ? 'ground' : null; }
  // The duckling the big button means: { i, d, word } or null.
  duckAhead(p) {
    if (p.pos.y < MESA.top + 0.5 || p.pos.y > MESA.top + 3) return null;
    const look = this.flatLook(p);
    let best = null;
    this.ducks.forEach((d, i) => {
      if (d.state === 'home') return;
      const dx = d.x - p.pos.x, dz = d.z - p.pos.z, dist = Math.hypot(dx, dz);
      const reach = d.state === 'float' ? DUCK.reach : DUCK.blowReach;
      if (dist > reach) return;
      const ang = dist < 0.4 ? 0 : Math.abs(wrap(Math.atan2(dz, dx) - Math.atan2(look.z, look.x)));
      if (ang > DUCK.cone) return;
      if (!best || dist < best.dist) best = { i, d, dist, word: d.state === 'float' ? 'Puff!' : 'Blow!' };
    });
    return best;
  }
  // Once all three ducklings are home: by the nest, Blow! sends the nearest one back to its island to play again.
  nestAgain(p) {
    if (this.state().ducks < 3 || p.pos.y < MESA.top + 0.5 || p.pos.y > MESA.top + 3) return false;
    return Math.hypot(p.pos.x - NEST.x, p.pos.z - NEST.z) < BUBBLE_RULES.nestR && this.ducks.some(d => d.state === 'home');
  }
  nearRide(p) {
    if (this.ride || p.pos.y < MESA.top + 0.5 || p.pos.y > MESA.top + 3) return false;
    return Math.hypot(p.pos.x - CHIMNEY.x, p.pos.z - CHIMNEY.z) < CHIMNEY.r + 0.2 || Math.hypot(p.pos.x - (CHIMNEY.x + CHIMNEY.wall + 1), p.pos.z - CHIMNEY.z) < BUBBLE_RULES.rideR;
  }
  // On the rim by Captain Suds' throne: Blow! is the shield game there.
  inCourt(p) { const c = BUBBLE_RULES.court; return p.pos.y >= RIM.y + 0.5 && p.pos.y < RIM.y + 3 && p.pos.x >= c.x0 && p.pos.x <= c.x1 && p.pos.z >= c.z0 && p.pos.z <= c.z1; }
  // The shield round to play: the first shield still up, or (all popped) the next one just for fun. -> 0..2
  round() { const st = this.state(), k = st.shield.findIndex(s => !s); return k >= 0 ? k : this.shieldFun.round(3); }
  onPad(p, k = this.round()) { const pad = COURT.rounds[k].pad; return Math.hypot(p.pos.x - pad.x, p.pos.z - pad.z) <= BANK.pad; }
  near(p = this.game.player) {
    if (!p || this.game.inBattle || this.game.world !== this.world) return null;
    if (this.ride && p.carry === this.rideObj) return 'Puff!';
    if (p.carry && p.carry !== this.standObj) return null;
    if (this.doorAhead(p.eyePos, p.forward)) return null;
    if (this.nearRide(p)) return 'Ride!';
    const d = this.duckAhead(p);
    if (d) return d.word;
    return 'Blow!';
  }
  use(p = this.game.player) {
    const w = this.near(p);
    if (!w) return false;
    if (w === 'Puff!' && this.ride) { this.puff(); return true; }
    if (w === 'Ride!') { this.startRide(); return true; }
    const d = this.duckAhead(p);
    if (d && d.word === w) { this.duckUse(p, d); return true; }
    this.blowAt(p);
    return true;
  }
  // a tap on the screen (iPad): a puff while you ride, else the same as the big button (the bubble goes where you face)
  tap(origin, dir) {
    const p = this.game.player;
    if (!p || this.paused() || this.game.world !== this.world) return false;
    if (this.ride && p.carry === this.rideObj) { this.puff(); return true; }
    if (p.carry && p.carry !== this.standObj) return false;
    if (this.doorAhead(origin, dir)) return false;
    return this.use(p);
  }
  aim(p) { return bubbleAim(this.world, p, this.game); }
  battleEnded(result, opts) {
    const pic = opts?.picture;
    if (pic?.id !== 'bubble' || pic.crew != null || result !== 'won') return;
    const g = this.game; // a won battle with Captain Suds clears the climb: a rematch is a new climb (harder)
    for (const k of BUBBLE_KEYS()) { const at = g.beaten.indexOf(k); if (at >= 0) g.beaten.splice(at, 1); }
    this.stairMiss = [0, 0]; this.duckMiss = [0, 0, 0]; this.rideMiss = 0; this.shotMiss = [0, 0, 0]; this.duckFun = [false, false, false];
    for (const d of this.ducks) d.backHome();
    this.save();
    this.sync(true);
  }

  /* ---------------------------------------------- the wand and your bubbles ---------------------------------------------- */
  // The big button's Blow! (not at a duckling): the shield game on the rim by the throne, else a bubble for the stairs; the nest's
  // play-again once all ducklings are home.
  blowAt(p) {
    if (this.nestAgain(p)) { this.duckAgain(p); return true; }
    if (this.inCourt(p)) return this.shoot(p);
    return this.blow(p);
  }
  // Blow! a bubble two blocks ahead of your feet (only with your feet on something). -> true if a bubble came out.
  blow(p = this.game.player) {
    const foot = this.footing(p);
    const r = this.field.blow({ x: p.pos.x, y: p.pos.y, z: p.pos.z }, this.flatLook(p), (x, y, z) => this.world.isSolid(x, y, z), foot);
    if (!r.ok) {
      if (r.why === 'air') this.say('air', WORDS.air, 2);
      else if (r.why === 'soap') this.say('nosoap', WORDS.noSoap);
      else if (r.why === 'touch') { sound.play('soappop'); this.say('touch', WORDS.touch, 2); }
      else this.say('wall', WORDS.wall, 2);
      return false;
    }
    if (r.popped === this.stood && r.popped) this.dropOff();
    sound.play('wandblow');
    this.blown = r.b; this.blownLate = false;
    if (!this.told.has('first') && foot === 'ground') { this.told.add('first'); this.toast(WORDS.first); }
    return true;
  }
  land(b) {
    const p = this.game.player;
    this.stood = b; this.field.standOn(b); this.left = null;
    const ox = p.pos.x - b.x, oz = p.pos.z - b.z, l = Math.hypot(ox, oz), m = Math.min(l, BUBBLE.onTop);
    this.off = l > 1e-6 ? { x: ox / l * m, z: oz / l * m } : { x: 0, z: 0 };
    this.stepOff = false; this.spaceWas = !!p.keys?.Space;
    p.carry = this.standObj; p.vel.set(0, 0, 0);
    sound.play('bubbleland');
    this.once('land', WORDS.land);
  }
  // off the bubble you stand on: a bounce (jump = true) or a step off the edge
  leaveBubble(jump) {
    const p = this.game.player, b = this.stood;
    if (p.carry === this.standObj) p.carry = null;
    if (b && p.collides?.(p.pos)) p.pos.set(b.x, p.pos.y, b.z); // (never inside a wall the bubble was rubbing)
    p.onGround = false;
    p.vel.y = jump ? Math.sqrt(2 * 28 * (this.world.gravity ?? 1) * BUBBLE.bounce) : 0;
    this.left = b; // (it can still catch you from above, never from inside: stepping off really steps off)
    this.stood = null; this.stepOff = false; this.fromBubble = true;
    if (jump) sound.play('boing');
  }
  dropOff() { // the bubble under you popped
    const p = this.game.player;
    if (p.carry === this.standObj) { const b = this.stood; p.carry = null; if (b && p.collides?.(p.pos)) p.pos.set(b.x, p.pos.y, b.z); p.vel.set(0, 0, 0); p.onGround = false; }
    this.stood = null; this.fromBubble = true;
  }
  stepStand(dt) {
    const p = this.game.player, b = this.stood;
    if (!b || p.carry !== this.standObj) return;
    if (b.standT < BUBBLE_RULES.settle) return; // just landed: the stick still held from the hop does not walk you off
    const s = this.stick, k = BUBBLE_RULES.off * dt * (s.analog || 0);
    const nx = this.off.x + s.wx * k, nz = this.off.z + s.wz * k;
    if (Math.hypot(nx, nz) > BUBBLE.onTop) { this.off = { x: nx, z: nz }; this.stepOff = true; } else this.off = { x: nx, z: nz };
  }
  // landing on a bubble (bubbles.js landsOn): the feet came down through its top (any frame rate), or they are in its top part (a hop
  // up into it), and you are over it
  checkLanding() {
    const p = this.game.player, feet = p.pos.y, prev = this.prevFeet ?? feet;
    if (p.carry || this.game.riding?.on || p.onGround) return;
    for (const b of this.field.list) if (landsOn(b, { x: p.pos.x, z: p.pos.z, feet, prev, vy: p.vel.y, inside: b !== this.left })) { this.land(b); return; }
  }
  // Can you still get onto a bubble whose middle is at `at` from where you stand now? (its top part no higher than a hop takes your feet)
  canReach(p, at) {
    const on = p.carry === this.standObj && !!this.stood;
    const h = hopHeight({ ground: p.onGround && !p.carry, onBubble: on, vy: p.vel.y, g: this.world.gravity ?? 1 });
    return at.y + BUBBLE.scoop <= p.pos.y + h;
  }
  // the bubble you just blew floated out of reach while you stood still: say so once in a while (the stairs' one timing word)
  checkLate(p) {
    const b = this.blown;
    if (!b || this.blownLate || !this.field.list.includes(b) || b.stand) return;
    if (!this.footing(p) || !inStairs(p.pos.x, p.pos.y, p.pos.z) || this.canReach(p, b)) return;
    this.blownLate = true; this.say('late', WORDS.late, 6);
  }
  // standing on the ground: the ledge you are on; after a fall from a bubble, the stairs' top or back to your ledge
  checkGround() {
    const p = this.game.player;
    if (p.carry || !p.onGround) return;
    const x = p.pos.x, y = p.pos.y, z = p.pos.z, st = this.state();
    if (this.fromBubble) {
      this.fromBubble = false;
      const fx = Math.floor(x), fz = Math.floor(z);
      if (!st.stairs && y >= MESA.top + 0.9 && fx >= STAIRS_TOP.x0 && fx <= STAIRS_TOP.x1 && fz >= STAIRS_TOP.z0 && fz <= BENCH.z1) { this.stairsDone(); }
      else if (this.ledge && y < this.ledge.y - 0.4) {
        const k = this.ledge.y < BENCH.top + 0.5 ? 0 : 1;
        if (this.ledge.y < MESA.top + 0.5) this.stairMiss[k]++;
        if (y < this.ledge.y - BUBBLE_RULES.fall) { this.fallBack(k); return; }
      }
    }
    this.ledge = { x, y, z };
  }
  fallBack(k) {
    const p = this.game.player, l = this.ledge;
    p.pos.set(l.x, l.y, l.z); p.vel.set(0, 0, 0);
    sound.play('soappop');
    this.say('back', `${WORDS.back}${kindHelp(this.stairMiss[k]).on ? ' (Your bubbles float up a bit slower now.)' : ''}`, 2);
  }
  stairsDone() {
    this.addKey(stairsKey);
    this.stairMiss = [0, 0];
    sound.play('fizzstar');
    this.toast(WORDS.stairs);
    this.sync(true);
  }
  stepFlowers(p) {
    for (const [x, y, z] of SOAP_FLOWERS) if (Math.hypot(p.pos.x - x, p.pos.z - z) < BUBBLE_RULES.flower && Math.abs(p.pos.y - y) < 1.5) {
      if (this.field.refill()) { sound.play('soapfill'); this.say('soap', WORDS.soap, 1); }
    }
  }

  /* ---------------------------------------------- the ducklings ---------------------------------------------- */
  duckUse(p, a) {
    const d = a.d, i = a.i;
    if (d.state === 'sleep' || d.state === 'waddle') { d.blow(this.gardenT); sound.play('wandblow'); this.once('duckBlow', WORDS.duckBlow); if (i === 2) this.once('gust', WORDS.gust); return; }
    const look = this.flatLook(p);
    if (d.puff(look.x, look.z, a.dist)) sound.play('duckpuff');
  }
  // all three are home: the nearest one in the nest hops back to its island, just for fun (no key, nothing saved)
  duckAgain(p) {
    let best = -1, bd = 1e9;
    this.ducks.forEach((d, i) => { if (d.state !== 'home') return; const dd = Math.hypot(p.pos.x - NEST.x - Math.cos(i * 2.1 + 0.5) * 0.55, p.pos.z - NEST.z - Math.sin(i * 2.1 + 0.5) * 0.55); if (dd < bd) { bd = dd; best = i; } });
    if (best < 0) return;
    this.duckFun[best] = true; this.ducks[best].backHome();
    sound.play('wandblow');
    this.toast(WORDS.again(best + 1));
  }
  stepDucks(step) {
    const st = this.state();
    this.ducks.forEach((d, i) => {
      if (st.duck[i] && d.state !== 'home' && !this.duckFun[i]) { d.state = 'home'; d.x = NEST.x; d.z = NEST.z; }
      if (!st.duck[i] && d.state === 'home') { d.backHome(); this.duckFun[i] = false; }
      d.help = this.duckMiss[i]; d.hard = this.hard;
      if (d.state === 'float' && CURRENTS.some(c => d.x >= c.x0 && d.x < c.x1 && d.z >= c.z0 && d.z < c.z1)) this.once('stream', WORDS.stream);
      for (const e of d.step(step)) {
        if (e.type === 'pop') { this.duckMiss[i]++; sound.play('soappop'); this.say(`duckpop${i}`, `${WORDS.duckPop(i + 1)}${kindHelp(this.duckMiss[i]).on ? ' (The wind is a bit gentler now.)' : ''}`, 1); }
        else if (e.type === 'hurry') this.say(`duckhurry${i}`, WORDS.duckHurry(i + 1), 4);
        else if (e.type === 'wake') { this.duckMiss[i]++; sound.play('soappop'); this.say(`duckwake${i}`, WORDS.duckWake(i + 1), 1); }
        else if (e.type === 'home') {
          this.duckMiss[i] = 0;
          if (this.duckFun[i]) { this.duckFun[i] = false; sound.play('duckhome'); this.toast(`🦆 Home again! ${FUN.tag}`); continue; }
          this.addKey(duckKey(i + 1));
          sound.play('duckhome');
          const k = this.state().ducks;
          this.toast(WORDS.duckHome(i + 1, k));
          if (k >= 3) this.toast(WORDS.allHome);
        }
      }
    });
  }

  /* ---------------------------------------------- the Chimney Ride ---------------------------------------------- */
  startRide() {
    const g = this.game, p = g.player;
    if (p.carry === this.standObj) this.dropOff();
    g.riding?.stop?.('quiet');
    this.ride = new Ride(CHIMNEY, { help: this.rideMiss, hard: this.hard });
    this.restT = 0; this.rideOut = false; this.spaceWas = !!p.keys?.Space; this.rideIn = { sx: 0, sz: 0 };
    p.carry = this.rideObj; p.vel.set(0, 0, 0);
    const w = this.rideObj.where(); p.pos.set(w.x, w.y, w.z);
    sound.play('wandblow');
    this.once('ride', WORDS.ride);
  }
  puff() {
    const r = this.ride, p = this.game.player;
    if (!r || r.done) return;
    const look = this.flatLook(p);
    if (r.tap(look.x, look.z)) { sound.play('chimneypuff'); this.restT = 0; }
  }
  endRide() {
    const p = this.game.player, at = this.doorOut();
    if (p.carry === this.rideObj) { p.carry = null; p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0); }
    this.ride = null; this.rideOut = false;
  }
  stepRide(step) {
    const r = this.ride;
    if (!r) return;
    r.help = this.rideMiss; r.hard = this.hard;
    for (const e of r.step(step, this.rideIn)) {
      if (e.type === 'pop') { this.rideMiss++; sound.play('soappop'); this.say('ridepop', `${WORDS.ridePop}${kindHelp(this.rideMiss).on ? ' (It sinks a bit slower now.)' : ''}`, 1); }
      else if (e.type === 'star') {
        sound.play('fizzstar');
        if (!this.starsGot.has(e.k)) { this.starsGot.add(e.k); this.game.cubes += 1; this.game.ui?.renderHud?.(); this.toast(`⭐ A fizz star! +1 Capture Cube (${e.k} / ${CHIMNEY.stars.length - 1})`); }
      } else if (e.type === 'top') this.chimneyDone();
    }
    if (this.ride && this.ride.resting() && this.ride.star === 0) { this.restT += step; if (this.restT >= BUBBLE_RULES.restOut) { this.rideOut = true; this.toast(WORDS.rideOut); } }
    else this.restT = 0;
  }
  chimneyDone() {
    const p = this.game.player, [lx, lz] = CHIMNEY.landing, again = this.state().chimney;
    this.addKey(chimneyKey);
    this.rideMiss = 0;
    if (p.carry === this.rideObj) p.carry = null;
    p.pos.set(lx, RIM.y + 1, lz); p.vel.set(0, 0, 0);
    this.ride = null; this.rideOut = false; this.ledge = { x: lx, y: RIM.y + 1, z: lz };
    sound.play('fizzstar');
    this.toast(again ? `🫧 Up the chimney again! ${FUN.tag}` : WORDS.chimney);
    if (!again) this.once('court', WORDS.court);
    this.sync(true);
  }

  /* ---------------------------------------------- Captain Suds' shields: bank shots ---------------------------------------------- */
  // Blow! on the rim by the throne: from the round's gold pad a shot bubble flies the way you look (bubbles.js bankShot).
  shoot(p) {
    const k = this.round();
    if (!this.onPad(p, k)) { this.say('pad', WORDS.pad, 2); return false; }
    if (this.shots.length >= 2) return false;
    const look = this.flatLook(p), from = { x: p.pos.x + look.x * BANK.from, z: p.pos.z + look.z * BANK.from };
    const s = bankShot(courtOf(k), from, look, { t0: this.courtT, help: this.shotMiss[k], hard: this.hard });
    this.shots.push({ k, s, t: 0, fun: this.state().shields >= 3 });
    sound.play('wandblow');
    this.once(`slider${k}`, COURT.rounds[k].slider ? WORDS.slider : WORDS.court);
    return true;
  }
  stepShots(step) {
    for (const sh of [...this.shots]) {
      sh.t += step;
      if (sh.t < sh.s.time) continue;
      this.shots.splice(this.shots.indexOf(sh), 1);
      if (sh.s.hit) {
        this.shotMiss[sh.k] = 0; this.burst[sh.k] = 0;
        sound.play('shieldburst');
        if (sh.fun) { this.shieldFun.won(sh.k, 3); this.toast(`${WORDS.funShield} ${FUN.tag}`); continue; }
        this.addKey(shieldKey(sh.k + 1));
        const n = this.state().shields;
        this.toast(WORDS.shieldHit(n));
        if (n >= 3) this.toast(WORDS.allShields);
      } else { this.shotMiss[sh.k]++; sound.play('soappop'); this.say('shotmiss', sh.s.end === 'guard' ? WORDS.shieldFence : WORDS.shieldMiss, 2); }
    }
  }

  /* ---------------------------------------------- the lifts ---------------------------------------------- */
  sync(force = false) {
    const st = this.state(), lifts = (this.world.lifts ??= []);
    [st.lift1, st.lift2].forEach((on, i) => {
      if (!force && on === this.liftsOn[i]) return;
      const l = LIFTS[i], at = lifts.indexOf(l);
      if (on && at < 0) lifts.push(l);
      if (!on && at >= 0) lifts.splice(at, 1);
      if (on && this.liftsOn[i] === false) sound.play('fizzlift');
      this.liftsOn[i] = on;
    });
  }
  // Marks stretches and shields as done (saved keys) for tests: { stairs, ducks: n, chimney, shields: n }.
  winUpTo({ stairs = false, ducks = 0, chimney = false, shields = 0 } = {}) {
    if (stairs) this.addKey(stairsKey);
    for (let n = 1; n <= ducks; n++) this.addKey(duckKey(n));
    if (chimney) this.addKey(chimneyKey);
    for (let n = 1; n <= shields; n++) this.addKey(shieldKey(n));
    this.sync(true);
  }

  /* ---------------------------------------------- the frame ---------------------------------------------- */
  update(dt = 0) { if (!this.manual) this.step(dt); }
  step(dt, input = null) {
    const g = this.game, p = g.player;
    if (!p || g.world !== this.world) return;
    if (g.inBattle && (this.stood || this.ride)) this.giveBack();
    if (input?.ride) this.rideIn = { sx: input.ride.sx || 0, sz: input.ride.sz || 0 };
    const step = Math.min(dt, BUBBLE_RULES.dtMax);
    if (!this.paused()) {
      this.clock += step; this.gardenT += step; this.courtT += step;
      this.once('wand', WORDS.wand);
      const st = this.state();
      this.field.help = this.stairMiss[this.ledge && this.ledge.y >= BENCH.top + 0.5 ? 1 : 0]; this.field.hard = this.hard;
      for (const e of this.field.step(step, { solid: (x, y, z) => this.world.isSolid(x, y, z), vents: [VENT2, ...BREEZES], drips: DRIPS })) {
        if (e.type === 'pop') { sound.play('soappop'); if (e.b === this.stood) this.dropOff(); }
        else if (e.type === 'warn' && e.b === this.stood) this.say('warn', WORDS.warn, 6);
      }
      this.stepStand(step);
      this.checkLanding();
      this.checkGround();
      this.checkLate(p);
      this.stepFlowers(p);
      this.stepDucks(step);
      this.stepRide(step);
      this.stepShots(step);
      for (let k = 0; k < 3; k++) this.burst[k] += step;
      if (!st.ready && st.done && this.inCourt(p)) this.once('court', WORDS.court);
    }
    this.prevFeet = p.pos.y;
    this.syncT -= dt;
    if (this.syncT <= 0) { this.syncT = BUBBLE_RULES.sync; this.sync(); }
    this.draw(p);
    this.refreshChip();
  }

  /* ---------------------------------------------- drawing ---------------------------------------------- */
  draw(p) {
    const t = this.clock, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
    const st = this.state(), cam = this.game.camera;
    // your bubbles (a wobble before a stood one pops) and the shot bubbles
    const BP = this.bubbles.userData.parts;
    hideAll(BP.film); hideAll(BP.shine);
    let i = 0;
    for (const b of this.field.list) {
      const wob = b.stand && b.standT > this.field.standLife - BUBBLE.warn ? 0.12 * Math.sin(t * 40) : 0.03 * Math.sin(t * 3 + b.id);
      S.set(BUBBLE.r * (1 + wob), BUBBLE.r * (1 - wob), BUBBLE.r * (1 + wob)); P.set(b.x, b.y, b.z);
      M.compose(P, Q, S); BP.film.setMatrixAt(i, M); BP.shine.setMatrixAt(i, M); i++;
    }
    i = 2;
    for (const sh of this.shots) { const q = sh.s.path(sh.t); S.setScalar(BANK.r * 1.6); P.set(q.x, SHOT_Y, q.z); M.compose(P, Q, S); BP.film.setMatrixAt(i, M); BP.shine.setMatrixAt(i, M); i++; }
    BP.film.instanceMatrix.needsUpdate = true; BP.shine.instanceMatrix.needsUpdate = true;
    BP.film.material.uniforms.uTime.value = t;
    // the ghost bubble: where Blow! puts your next bubble (green: you can blow now; grey: land first)
    const court = this.inCourt(p);
    const showGhost = !!cam && !this.ride && this.field.soap > 0 && !court && !(p.carry && p.carry !== this.standObj) && !this.duckAhead(p) && !this.nearRide(p) && !this.nestAgain(p) && !this.doorAhead(p.eyePos, p.forward);
    const spot = showGhost ? this.field.spot(p.pos, this.flatLook(p), (x, y, z) => this.world.isSolid(x, y, z)) : null;
    this.ghost.visible = !!spot;
    if (spot) {
      const ok = !!this.footing(p), gp = this.ghost.userData.parts;
      this.ghost.position.set(spot.x, spot.y, spot.z);
      gp.ring.material.color.setHex(ok ? 0x7dffa0 : 0xbbbbbb); gp.ring.material.opacity = ok ? 0.85 : 0.35; gp.ball.material.opacity = ok ? 0.14 : 0.06;
    }
    // the wand in your hand
    this.wand.visible = !!cam && !this.ride;
    if (this.wand.visible) { const o = this.wand; o.position.copy(cam.position); o.quaternion.copy(cam.quaternion); o.translateX(0.32); o.translateY(-0.26); o.translateZ(-0.6); o.rotateZ(0.35); o.rotateX(-0.2); }
    // drips and shadows
    const DP = this.drips.userData.parts;
    DRIPS.forEach((d, k) => {
      const y = dripAt(d, this.field.clock, this.field.drip);
      DP.drops.setMatrixAt(k, y === null ? M.makeScale(0, 0, 0) : M.makeTranslation(d.x, y, d.z));
      const near = y === null ? 0.5 : 0.6 + 0.6 * (1 - (y - d.bottom) / (d.top - d.bottom));
      DP.shadows.setMatrixAt(k, M.compose(P.set(d.x, d.bottom + 0.02, d.z), Q, S.set(near, 1, near)));
    });
    DP.drops.instanceMatrix.needsUpdate = true; DP.shadows.instanceMatrix.needsUpdate = true;
    // streams: the narrow shaft's wind, the current, the lifts (only while on); the gust lane (only while it gathers or blows)
    drawStreams(this.streams, t, [true, true, true, true, true, !!this.liftsOn[0], !!this.liftsOn[1]]);
    drawStreams(this.gusts, this.gardenT * 1.6, GUSTS.map(gg => gustAt(gg, this.gardenT) > 0));
    // the ducklings: asleep on their islands, floating in a bubble (it wobbles when it gets thin), waddling home, or home in the nest
    this.ducks.forEach((d, k) => {
      const m = this.duckModels[k], bub = this.duckBubbles[k], y0 = MESA.top + 1;
      bub.visible = d.state === 'float';
      if (!m) return;
      if (d.state === 'home') { const a = k * 2.1 + 0.5; m.position.set(NEST.x + Math.cos(a) * 0.55, y0 + 0.05, NEST.z + Math.sin(a) * 0.55); m.rotation.set(0, -a + Math.PI, 0); }
      else if (d.state === 'float') {
        const by = y0 + DUCK.float + 0.05 * Math.sin(t * 2 + k), thin = d.left < DUCK.hurry ? 0.06 * Math.sin(t * 18) : 0;
        bub.position.set(d.x, by, d.z); bub.scale.set(1 + thin, 1 - thin, 1 + thin);
        m.position.set(d.x, by - 0.28, d.z); m.rotation.set(0, Math.atan2(d.vx, d.vz) || m.rotation.y, 0);
      } else if (d.state === 'waddle') { m.position.set(d.x, y0 + 0.02, d.z); m.rotation.set(0, Math.atan2(d.island[0] - d.x, d.island[1] - d.z), 0.15 * Math.sin(t * 10)); }
      else { m.position.set(d.x, y0 + 0.02, d.z); m.rotation.set(0, k, 0.25 * Math.sin(t * 0.8 + k) * 0.3); } // asleep: a slow little rock
      animateModel(m, t + k, d.state === 'waddle');
      bub.children.forEach(c => { if (c.material?.uniforms) c.material.uniforms.uTime.value = t; });
    });
    // the Puff! arrow: which way and how far a puff sends the duckling in front of you
    const da = !this.ride && cam ? this.duckAhead(p) : null;
    this.arrow.visible = !!da && da.word === 'Puff!';
    if (this.arrow.visible) {
      const look = this.flatLook(p), len = Math.min(9, glideOf(da.dist, da.d.friction));
      this.arrow.position.set(da.d.x, MESA.top + 1.06, da.d.z); this.arrow.rotation.set(0, -Math.atan2(look.z, look.x), 0); this.arrow.scale.set(len, 1, 1);
    }
    // the chimney: the gaps (drawn wider with the kind help; the next one pulses with a beam of light), the fan, the bar, the stars
    const CP = this.chim.userData.parts, gapK = (this.ride?.gap ?? RIDE.gap) / RIDE.gap, nextK = this.ride ? CHIMNEY.plates.findIndex(q => this.ride.y < q.y + 1) : 0;
    CP.plates.forEach((pl, k) => {
      const pulse = k === nextK ? 1 + 0.08 * Math.sin(t * 6) : 1;
      pl.glowRing.scale.set(gapK * pulse, gapK * pulse, 1); pl.halo.scale.set(gapK * pulse, gapK * pulse, 1);
      pl.beam.visible = k === nextK; pl.halo.material.opacity = k === nextK ? 0.35 + 0.15 * Math.sin(t * 6) : 0.18;
    });
    CP.fan.rotation.z = t * 6;
    CP.bar.rotation.y = -(this.ride ? this.ride.barAngle() : t * RIDE.bar);
    CP.stars.forEach((s, k) => { s.rotation.y = t * 1.5 + k; s.visible = k > 0; s.material.color.setHex(this.ride && this.ride.star >= k ? 0xfff6c0 : 0xffd23a); });
    // the ride bubble: waiting (it pulses, a little duck sits on its seat, the "Ride!" sign bobs over it) or carrying you
    const rb = this.rideBubble, r = this.ride, RP = rb.userData.parts;
    rb.visible = !r || r.popT === null;
    if (r) { rb.position.set(r.x, r.y, r.z); rb.scale.setScalar(1); }
    else { rb.position.set(CHIMNEY.x, CHIMNEY.floor + RIDE.R + 0.05 * Math.sin(t * 2), CHIMNEY.z); rb.scale.setScalar(1 + 0.06 * Math.sin(t * 3)); }
    RP.film.material.uniforms.uTime.value = t * 2; RP.glow.material.opacity = r ? 0.1 : 0.16 + 0.1 * Math.sin(t * 3);
    this.rideSign.visible = !r;
    this.rideSign.position.set(CHIMNEY.x, CHIMNEY.floor + RIDE.R * 2 + 1.1 + 0.15 * Math.sin(t * 2.5), CHIMNEY.z);
    if (this.rideDuck) {
      this.rideDuck.visible = !r;
      if (!r) { this.rideDuck.position.set(rb.position.x, rb.position.y - RIDE.R * 0.6, rb.position.z); this.rideDuck.rotation.set(0, Math.PI / 2 + 0.3 * Math.sin(t), 0); animateModel(this.rideDuck, t, false); }
    }
    // the shields (a burst grows and fades for half a second)
    this.shields.userData.parts.list.forEach((s, k) => {
      const up = !st.shield[k], b = this.burst[k];
      s.g.visible = up || b < 0.5;
      if (!up && b < 0.5) s.g.scale.setScalar(1 + b * 1.2); else s.g.scale.setScalar(1 + 0.02 * Math.sin(t * 2 + k));
      s.ring.rotation.z = t * (0.4 + k * 0.2);
      s.g.children[0].material.uniforms.uTime.value = t;
      s.g.children[0].material.uniforms.uAlpha.value = up ? 0.8 + k * 0.1 : Math.max(0, 1 - b * 2);
    });
    // the shield game: only this round's cushions (the slider where it is now) and pad; the dotted aim line from the pad
    const k = this.round();
    this.cushions.forEach((list, j) => list.forEach((c, n) => {
      c.visible = j === k;
      const rd = COURT.rounds[j];
      if (rd.slider && n === rd.cushions.length) { const sb = cushionsAt(courtOf(j), this.courtT, this.shotMiss[j], this.hard).at(-1); c.position.set(sb.x0, COURT.y, sb.z0); } // (where bankShot has it)
    }));
    this.pads.forEach((pd, j) => { pd.visible = j === k; pd.scale.setScalar(j === k ? 1 + 0.06 * Math.sin(t * 4) : 1); });
    const aimOn = court && !!cam && this.onPad(p, k) && !(p.carry && p.carry !== this.standObj);
    if (aimOn) {
      const look = this.flatLook(p), from = { x: p.pos.x + look.x * BANK.from, z: p.pos.z + look.z * BANK.from };
      drawDots(this.aimDots, aimLine(courtOf(k), from, look, { t0: this.courtT, help: this.shotMiss[k], hard: this.hard }), SHOT_Y, 0.45, t * 0.9);
    }
    this.aimDots.visible = aimOn;
  }
  refreshChip() {
    const ui = this.game.ui;
    if (!ui?.setScore || this.game.world !== this.world) return;
    const st = this.state(), soap = '●'.repeat(this.field.soap) + '○'.repeat(BUBBLE.soap - this.field.soap);
    if (this.ride) { ui.setScore({ text: `🫧 Chimney · ⭐ ${this.ride.star} / ${CHIMNEY.stars.length - 1} · tap Jump to float up`, done: false }); return; }
    const ready = st.ready && !this.game.bosses?.crewAim?.(this.game.player.pos);
    if (ready && !st.star) { ui.setScore({ text: '🫧 Captain Suds is ready to battle!', done: true }); return; }
    ui.setScore({ text: `🫧 ${soap} · Stairs ${st.stairs ? '✓' : '○'} · 🦆 ${st.ducks} / 3 · Chimney ${st.chimney ? '✓' : '○'} · 🛡️ ${st.shields} / 3`, done: false });
  }

  // For tests.
  info() {
    const r = this.ride;
    return {
      soap: this.field.soap, bubbles: this.field.list.map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, stand: b.stand, age: b.age, standT: b.standT })),
      stood: this.stood?.id ?? null, ledge: this.ledge ? { ...this.ledge } : null, stairMiss: this.stairMiss.slice(), fromBubble: this.fromBubble,
      ducks: this.ducks.map(d => ({ state: d.state, x: d.x, z: d.z, vx: d.vx, vz: d.vz, left: d.left })), duckMiss: this.duckMiss.slice(),
      ride: r ? { x: r.x, y: r.y, z: r.z, star: r.star, done: r.done, pops: r.pops, popT: r.popT } : null, rideMiss: this.rideMiss,
      shots: this.shots.length, shotMiss: this.shotMiss.slice(), round: this.round(), courtT: this.courtT, lifts: this.liftsOn.slice(), state: this.state(),
    };
  }
}
export { inChimney };
