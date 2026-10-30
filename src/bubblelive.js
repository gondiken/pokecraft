// The live part of the Bubble Well (LIVE.bubble, made by gymLive.reset for the part in world.parts), plans/bubble-well.md and its
// "Redesign 2026-10-29 (natural rules)" (owner: "Those rules should be natural to the game"; "I don't want more instructions"). It wires
// the pure rules (bubbles.js) to the player, the meshes (bubbleprops.js) and the world. Every rule is one a child already expects:
//  - The wand: walk up to a soap pot and the wand dips (its ring gets a shiny soap film). One dip = one bubble: Blow! (the big button, E,
//    a click, a tap on the screen; one press) and the bubble comes out just in front of you. A dry wand only puffs air (the big button says
//    Puff!), which pushes light things: bubbles, a duckling in its bubble. A jump shakes the film off the wand.
//  - The Fizz Ledges: the bubble waits a moment, then floats up, drifting with the fizz streams you can see. Hop on and it carries you up
//    (lean with the stick to steer it a little); it wobbles, then pops. Hop off onto the next ledge in time (Jump = Bounce). A fall puts
//    you back on the ledge you blew from. Up on the plateau = pw:bubble:stairs; then the first fizz lift runs. (Owner 2026-10-30: "I did
//    climb ... did I complete it?" It only counted a landing whose middle was over a box of the plateau, so hopping off onto its very edge
//    (your middle still over the cliff) never counted. Now the first time you stand at the plateau's height or higher it counts, by any
//    route; in a rematch (you hold the star, the lifts run) only a bubble up from a ledge does. An old save with later progress gets it.)
//  - The ducklings: Blow! round a sleeping one (a wet wand: the garden has soap pots), then puffs of air push it (an arrow on the floor
//    shows how far it glides). Home in the nest = pw:bubble:duck1..3. Once all three are home, Blow! by the nest sends one back to play.
//  - The Chimney Ride: Ride! by the big golden bubble; every tap (Jump, the big button, a tap on the screen) is a puff up; the stick steers;
//    fly through the gold rings (a bar of soap floats over each: the checkpoints). From inside, the bubble is only a faint rim (owner:
//    "overly bright"). Owner 2026-10-30: a little longer (the stack over the rim); the light of the rings dimmed a little; the top =
//    pw:bubble:chimney and puts you on Captain Suds' balcony, facing him (no long walk round the rim).
//  - Captain Suds' shields (owner 2026-10-30: they must explain themselves): Captain Suds sits sealed in a big bubble (the dome) that
//    boings you back; trails of little bubbles run into it from his five shield bubbles (owner 2026-10-30: two more). The first rests low
//    on the balcony right in front of him: walk into it and it boings you back, jump onto it and it pops. Each pop pops one of the dome's
//    skins (one per shield); the last bursts it. The other four bob high: ride your own bubble up from the soap pot under each and drop
//    onto it (pw:bubble:shield1..5). Popped ones come back later just for fun (the dome stays gone).
// Never a fail: a pop or a fall only puts you back a little, the kind help comes after misses (kindhelp.js through bubbleHelp). Clocks
// are summed frame dt and stand still in a battle / an ask / a panel / the pause. Bubbles are meshes, never blocks, never saved or sent.
// Words: only a word on the big button and one very short line the first time. `manual` + step(dt, input) and info() for tests.
import * as THREE from 'three';
import { B } from './blocks.js';
import { sound } from './sound.js';
import { buildModel, animateModel, disposeModel } from './species.js';
import { FUN } from './forfun.js';
import { BUBBLE, BubbleField, Duckling, DUCK, Ride, RIDE, SHIELD_RULES, gustAt, glideOf, dripAt, gapOf, barsOf, landsOn, shieldAt, stomp, clearOf, shieldSize, shieldSway } from './bubbles.js';
import { bubbleState, bubbleAim, ledgeAt, inClimb, stairsKey, duckKey, chimneyKey, shieldKey, BUBBLE_KEYS, CHIMNEY, GARDEN_RULES, ISLANDS, NEST, SHIELDS, DOME, LIFTS, DRIPS, WINDS, SOAP_POTS, MESA, RIM, THORNS, CURRENTS, GUSTS, inChimney } from './bubbleland.js';
import { buildBubbles, buildGhost, buildWand, buildDrips, buildStreams, drawStreams, buildThorns, buildNest, buildChimney, buildBigBubble, buildRideBubble, buildSign, buildShields, buildDome, buildArrow, buildPots, buildPuff, hideAll } from './bubbleprops.js';

// dtMax: the longest frame step; dip: how near a soap pot (and how near its floor) the wand dips; fall: how far below your ledge a fall
// from a bubble puts you back; restOut: seconds resting at the chimney's bottom before you hop out; rideR: how near the chimney's big
// bubble Ride! shows; reach: how far the big button looks for a door in front of you; settle: seconds after landing on a bubble before
// the stick leans it (a child still holding W from the hop stays on); nestR: how near the nest Blow! sends a homed duckling back to play;
// funBack: seconds after a popped shield (all of them popped) before it floats back just for fun; puffTime: how long a puff's wisps fly;
// boing: seconds a boing (a shield or the dome pushing you back) lasts, its little hop (blocks a second) and how long before the next one
// sounds; giggle: seconds Captain Suds giggles in his bubble after you bump it or talk to him; burstTime: the dome's burst.
export const BUBBLE_RULES = { dtMax: 0.1, sayGap: 3, sync: 0.25, dip: 1.0, fall: 2.5, restOut: 4, rideR: 2.8, reach: 5.5, settle: 0.4, nestR: 3.2, funBack: 6, puffTime: 0.45, boing: 0.18, boingHop: 3.2, boingGap: 0.5, giggle: 1.6, burstTime: 0.8 };
const WORDS = { // (owner 2026-10-29: "I don't want more instructions": one short line the first time, then nothing but the button's word)
  ride: 'Tap Jump to float up!',
  stairs: '🫧 Up the Fizz Ledges!',
  duckHome: (n, k) => `🦆 Home! (${k} / 3)`,
  allHome: '🦆 All the ducklings are home!',
  again: n => `🦆 Again! ${FUN.tag}`,
  chimney: '🫧 Up the chimney!',
  shieldHit: k => `🫧 Pop! (${k} / ${SHIELDS.length})`,
  allShields: "🫧 Pop! Captain Suds' bubble burst! Captain Suds is ready!",
  funShield: `🫧 Pop! ${FUN.tag}`,
  soap: (k, n) => `🧼 +1 Capture Cube (${k} / ${n})`,
  // the one line, in his own words (lore, not a rule list), the first time his bubble boings you (and when you talk to him: pictureboss.js)
  sealed: 'Captain Suds: (from inside his bubble) Hee hee! Nobody can pop my bubbles! ...unless they land on top. Oops!',
};
const DOOR_IDS = new Set([B.WAY_BACK, B.PICTURE_FRAME]);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const RIDE_LOOK = { wait: 1.35 }; // the waiting ride bubble's drawn radius (blocks)
const CLIMB_WINDS = WINDS;
const NS = SHIELDS.length, DOME_K = NS; // (wob / burst: one per shield, then the dome's)
const nines = n => new Array(n).fill(9);

export class BubbleLive {
  constructor(game, part) {
    this.game = game; this.part = part; this.world = game.world; this.scene = game.scene;
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;
    this.clock = 0; this.syncT = 0; this.told = new Set(); this.said = new Map();
    this.field = new BubbleField({ hard: this.hard });
    this.wet = false; this.wasGround = false; this.shook = 9; this.puffT = 9; this.puffAt = null;
    this.stood = null; this.left = null; this.stick = { wx: 0, wz: 0, analog: 0 }; this.spaceWas = true;
    this.ledge = null; this.fromBubble = false; this.prevFeet = null; this.stairMiss = [0, 0, 0, 0]; this.blown = null; this.fromRim = false; this.stomped = false;
    this.ducks = ISLANDS.map(i => new Duckling(GARDEN_RULES, i, { hard: this.hard })); this.duckMiss = [0, 0, 0]; this.duckFun = [false, false, false]; this.gardenT = 0;
    this.ride = null; this.rideMiss = 0; this.rideIn = { sx: 0, sz: 0 }; this.restT = 0; this.rideOut = false; this.starsGot = new Set();
    this.shieldMiss = 0; this.burst = nines(NS); this.courtT = 0;
    this.boing = null; this.boingGap = 9; this.wob = nines(NS + 1); this.giggleT = 9; this.domeBurst = 9; this.boings = 0; // (wob: the shields' and the dome's last boing)
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
  save() { this.game.save?.(); }
  addKey(k) { const g = this.game; if (!g.beaten.includes(k)) g.beaten.push(k); this.save(); }

  /* ---------------------------------------------- meshes ---------------------------------------------- */
  build() {
    const add = o => { this.groups.push(o); this.scene?.add(o); return o; };
    this.bubbles = add(buildBubbles(BUBBLE.max));
    this.ghost = add(buildGhost(BUBBLE.r));
    this.wand = add(buildWand());
    this.puffs = add(buildPuff(7));
    this.pots = add(buildPots(SOAP_POTS));
    this.drips = add(buildDrips(DRIPS.length));
    this.thorns = add(buildThorns(THORNS, MESA.top + 1));
    this.nest = add(buildNest(NEST, MESA.top + 1));
    this.chim = add(buildChimney(CHIMNEY, gapOf));
    this.rideBubble = add(buildRideBubble(RIDE.R));
    this.rideSign = add(buildSign('Ride!'));
    this.shields = add(buildShields(SHIELDS));
    this.dome = add(buildDome(DOME, SHIELDS.length));
    const c = CURRENTS[0], steady = CLIMB_WINDS.filter(w => !w.period);
    this.streams = add(buildStreams([
      ...steady.map(w => ({ ...w, n: w.id === 'rim' ? 50 : w.id === 'rim2' ? 30 : 40, colour: 0xffffff })),
      { x0: c.x0, x1: c.x1 - 1, y0: MESA.top + 1, y1: MESA.top + 1, z0: c.z0, z1: c.z1 - 1, vx: 0, vy: 0, vz: c.vz, n: 48, colour: 0xbfefff },
      ...LIFTS.map(l => ({ x0: l.x[0], x1: l.x[1], y0: l.y[0], y1: l.y[1], z0: l.z[0], z1: l.z[1], vx: 0, vy: 3, vz: 0, n: 40 })),
    ]));
    this.streamOn = [...steady.map(() => true), true, ...LIFTS.map(() => false)];
    this.gustWinds = [...CLIMB_WINDS.filter(w => w.period), ...GUSTS.map(g => ({ x0: g.x0, x1: g.x1 - 1, y0: MESA.top + 1, y1: MESA.top + 1.6, z0: g.z0, z1: g.z1 - 1, vx: g.vx, vy: 0, vz: g.vz, period: g.period, on: g.on, warn: g.warn, phase: g.phase, garden: true }))];
    this.gusts = add(buildStreams(this.gustWinds.map(g => ({ ...g, n: 60, colour: 0xe8fbff })), 0.09));
    this.arrow = add(buildArrow());
    this.duckModels = this.ducks.map(() => { try { const m = buildModel('squeaklet'); m.scale.setScalar(0.8); this.scene?.add(m); return m; } catch { return null; } });
    this.duckBubbles = this.ducks.map(() => add(buildBigBubble(0.62)));
    try { this.rideDuck = buildModel('squeaklet'); this.rideDuck.scale.setScalar(1.25); this.scene?.add(this.rideDuck); } catch { this.rideDuck = null; }
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
    this.stood = null; this.ride = null; this.rideOut = false; this.boing = null;
  }
  ledgeSafe() { const l = this.ledge; return l ? { x: l.x, y: l.y, z: l.z } : { x: 80.5, y: 5, z: 131.5 }; }

  /* ---------------------------------------------- carry objects ---------------------------------------------- */
  makeStandObj() {
    const me = this;
    return {
      where: () => { const b = me.stood; return b ? { x: b.x, y: b.y + BUBBLE.r, z: b.z } : me.ledgeSafe(); },
      steer(wx, wz, analog) { me.stick = { wx, wz, analog }; },
      wantsLeave(space) { const fresh = !!space && !me.spaceWas; me.spaceWas = !!space; return fresh || !me.stood; },
      leave() { me.leaveBubble(!!me.stood); },
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
  onGround(p) { return !!p.onGround && !p.carry; }
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
      if (!best || dist < best.dist) best = { i, d, dist, word: d.state === 'float' ? 'Puff!' : this.wet ? 'Blow!' : 'Puff!' };
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
  near(p = this.game.player) {
    if (!p || this.game.inBattle || this.game.world !== this.world) return null;
    if (this.ride && p.carry === this.rideObj) return 'Puff!';
    if (p.carry && p.carry !== this.standObj) return null;
    if (this.doorAhead(p.eyePos, p.forward)) return null;
    if (this.nearRide(p)) return 'Ride!';
    const d = this.duckAhead(p);
    if (d) return d.word;
    if (this.nestAgain(p)) return 'Blow!';
    return this.wet ? 'Blow!' : 'Puff!';
  }
  use(p = this.game.player) {
    const w = this.near(p);
    if (!w) return false;
    if (w === 'Puff!' && this.ride) { this.puff(); return true; }
    if (w === 'Ride!') { this.startRide(); return true; }
    const d = this.duckAhead(p);
    if (d && d.word === w) { this.duckUse(p, d); return true; }
    if (this.nestAgain(p)) { this.duckAgain(p); return true; }
    if (this.wet) this.blow(p); else this.airPuff(p);
    return true;
  }
  // a tap on the screen (iPad): a puff while you ride, else the same as the big button
  tap(origin, dir) {
    const p = this.game.player;
    if (!p || this.paused() || this.game.world !== this.world) return false;
    if (this.ride && p.carry === this.rideObj) { this.puff(); return true; }
    if (p.carry && p.carry !== this.standObj) return false;
    if (this.doorAhead(origin, dir)) return false;
    return this.use(p);
  }
  aim(p) { return bubbleAim(this.world, p, this.game); }
  // Talking to Captain Suds while he is sealed in his bubble: he giggles in there (his words come from his gate in pictureboss.js).
  talk(npc) {
    if (npc?.kind === 'boss' && npc.def?.id === 'bubble' && this.domeUp()) this.giggleT = 0;
    return false;
  }
  battleEnded(result, opts) {
    const pic = opts?.picture;
    if (pic?.id !== 'bubble' || pic.crew != null || result !== 'won') return;
    const g = this.game; // a won battle with Captain Suds clears the climb: a rematch is a new climb (harder)
    for (const k of BUBBLE_KEYS()) { const at = g.beaten.indexOf(k); if (at >= 0) g.beaten.splice(at, 1); }
    this.stairMiss = [0, 0, 0, 0]; this.duckMiss = [0, 0, 0]; this.rideMiss = 0; this.shieldMiss = 0; this.duckFun = [false, false, false];
    this.burst = nines(NS); this.domeBurst = 9; this.nearDome = false; this.wob = nines(NS + 1);
    for (const d of this.ducks) d.backHome();
    this.save();
    this.sync(true);
  }

  /* ---------------------------------------------- the wand and your bubbles ---------------------------------------------- */
  // The wand dips while your feet are on the floor by a soap pot; a jump (any leaving of the ground) shakes the film off.
  stepWand(p) {
    const ground = this.onGround(p);
    if (ground) {
      const pot = SOAP_POTS.find(([x, y, z]) => Math.hypot(p.pos.x - x, p.pos.z - z) < BUBBLE_RULES.dip && Math.abs(p.pos.y - y) < 0.6);
      if (pot && !this.wet) { this.wet = true; sound.play('soapfill'); }
    } else if (this.wasGround && this.wet) { this.wet = false; this.shook = 0; }
    this.wasGround = ground;
  }
  // Blow! through the wet wand: a bubble just in front of you. -> true if a bubble came out.
  blow(p = this.game.player) {
    this.wet = false;
    const r = this.field.blow({ x: p.pos.x, y: p.pos.y, z: p.pos.z }, this.flatLook(p), (x, y, z) => this.world.isSolid(x, y, z));
    if (!r.ok) { sound.play('soappop'); this.shook = 0; return false; } // no room in front: it pops on the wall at once
    if (r.popped && r.popped === this.stood) this.dropOff();
    sound.play('wandblow');
    this.blown = r.b; this.stomped = false;
    return true;
  }
  // A dry wand: a puff of air that pushes bubbles (and a duckling in front, see duckUse) the way you face.
  airPuff(p = this.game.player) {
    const look = this.flatLook(p);
    this.field.puff({ x: p.pos.x, y: p.pos.y, z: p.pos.z }, look, this.stood);
    this.puffT = 0; this.puffAt = { x: p.eyePos.x, y: p.eyePos.y - 0.3, z: p.eyePos.z, dx: look.x, dz: look.z };
    sound.play('duckpuff');
    return true;
  }
  land(b) {
    const p = this.game.player;
    this.stood = b; this.field.standOn(b); this.left = null;
    this.spaceWas = !!p.keys?.Space; this.stick = { wx: 0, wz: 0, analog: 0 };
    p.carry = this.standObj; p.vel.set(0, 0, 0);
    sound.play('bubbleland');
  }
  // off the bubble you stand on: a bounce (jump = true)
  leaveBubble(jump) {
    const p = this.game.player, b = this.stood;
    if (p.carry === this.standObj) p.carry = null;
    if (b && p.collides?.(p.pos)) p.pos.set(b.x, p.pos.y, b.z); // (never inside a wall the bubble was rubbing)
    if (b) { b.sx = 0; b.sz = 0; }
    p.onGround = false;
    p.vel.y = jump ? Math.sqrt(2 * 28 * (this.world.gravity ?? 1) * BUBBLE.bounce) : 0;
    this.left = b; // (it can still catch you from above, never from inside)
    this.stood = null; this.fromBubble = true;
    if (jump) sound.play('boing');
  }
  dropOff() { // the bubble under you popped
    const p = this.game.player;
    if (p.carry === this.standObj) { const b = this.stood; p.carry = null; if (b && p.collides?.(p.pos)) p.pos.set(b.x, p.pos.y, b.z); p.vel.set(0, 0, 0); p.onGround = false; }
    this.stood = null; this.fromBubble = true;
  }
  // on a bubble: the stick leans it (after a moment); if it carries you into a wall, it pops
  stepStand() {
    const p = this.game.player, b = this.stood;
    if (!b || p.carry !== this.standObj) return;
    const s = this.stick, on = b.standT >= BUBBLE_RULES.settle;
    b.sx = on ? s.wx * (s.analog || 0) : 0; b.sz = on ? s.wz * (s.analog || 0) : 0;
    const w = this.standObj.where();
    if (p.collides?.(new THREE.Vector3(w.x, w.y, w.z))) { this.field.pop(b); sound.play('soappop'); this.dropOff(); }
  }
  // landing on a bubble (bubbles.js landsOn): the feet came down through its top (any frame rate), or they are in its top part
  checkLanding() {
    const p = this.game.player, feet = p.pos.y, prev = this.prevFeet ?? feet;
    if (p.carry || this.game.riding?.on || p.onGround) return;
    for (const b of this.field.list) if (landsOn(b, { x: p.pos.x, z: p.pos.z, feet, prev, vy: p.vel.y, inside: b !== this.left })) { this.land(b); return; }
  }
  // standing on the ground: the ledge you are on; after a fall from a bubble, the climb's top or back to your ledge
  checkGround() {
    const p = this.game.player;
    if (p.carry || !p.onGround) return;
    const x = p.pos.x, y = p.pos.y, z = p.pos.z, st = this.state(), up = y >= MESA.top + 0.9;
    if (this.fromBubble) {
      this.fromBubble = false;
      if (up && this.ledge && this.ledge.y < MESA.top) { // up from a ledge on a bubble: anywhere on the plateau, its very edge too
        if (!st.stairs) this.stairsDone(); else if (y < MESA.top + 1.5) this.toast(`${WORDS.stairs} ${FUN.tag}`);
      } else if (this.ledge && y < this.ledge.y - 0.4) {
        const k = ledgeAt(this.ledge.x, this.ledge.y, this.ledge.z);
        if (k != null) this.stairMiss[k]++;
        if (y < this.ledge.y - BUBBLE_RULES.fall) { this.fallBack(); return; }
      }
      if (this.fromRim && !this.stomped && Math.abs(y - (RIM.y + 1)) < 0.6) this.shieldMiss++; // a ride from the rim that popped no shield
      this.fromRim = false;
    }
    if (up && !this.state().stairs && !st.star) this.stairsDone(); // the first time up there, by any route (only the climb gets you there)
    this.ledge = { x, y, z };
  }
  fallBack() {
    const p = this.game.player, l = this.ledge;
    p.pos.set(l.x, l.y, l.z); p.vel.set(0, 0, 0);
    sound.play('soappop');
    if (this.fromRim && !this.stomped) this.shieldMiss++;
    this.fromRim = false;
  }
  stairsDone() {
    this.addKey(stairsKey);
    this.stairMiss = [0, 0, 0, 0];
    sound.play('fizzstar');
    this.toast(WORDS.stairs);
    this.sync(true);
  }

  /* ---------------------------------------------- the ducklings ---------------------------------------------- */
  duckUse(p, a) {
    const d = a.d, look = this.flatLook(p);
    if (d.state === 'sleep' || d.state === 'waddle') {
      if (this.wet) { this.wet = false; d.blow(this.gardenT); sound.play('wandblow'); return; }
      this.airPuff(p); return; // a dry wand only ruffles its feathers
    }
    this.wet = false; // (a wet wand's bubble just joins the duckling's: the same push)
    this.puffT = 0; this.puffAt = { x: p.eyePos.x, y: p.eyePos.y - 0.3, z: p.eyePos.z, dx: look.x, dz: look.z };
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
      for (const e of d.step(step)) {
        if (e.type === 'pop' || e.type === 'wake') { this.duckMiss[i]++; sound.play('soappop'); }
        else if (e.type === 'home') {
          this.duckMiss[i] = 0;
          if (this.duckFun[i]) { this.duckFun[i] = false; sound.play('duckhome'); this.toast(`🦆 Home! ${FUN.tag}`); continue; }
          this.addKey(duckKey(i + 1));
          sound.play('duckhome');
          const k = this.state().ducks;
          this.toast(k >= 3 ? WORDS.allHome : WORDS.duckHome(i + 1, k));
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
      if (e.type === 'pop') { this.rideMiss++; sound.play('soappop'); }
      else if (e.type === 'star') {
        sound.play('fizzstar');
        if (!this.starsGot.has(e.k)) { this.starsGot.add(e.k); this.game.cubes += 1; this.game.ui?.renderHud?.(); this.toast(WORDS.soap(e.k, CHIMNEY.stars.length - 1)); } // (a bar of soap: never a star)
      } else if (e.type === 'top') this.chimneyDone();
    }
    if (this.ride && this.ride.resting() && this.ride.star === 0) { this.restT += step; if (this.restT >= BUBBLE_RULES.restOut) this.rideOut = true; }
    else this.restT = 0;
  }
  chimneyDone() {
    const p = this.game.player, [lx, lz] = CHIMNEY.landing, again = this.state().chimney;
    this.addKey(chimneyKey);
    this.rideMiss = 0;
    if (p.carry === this.rideObj) p.carry = null;
    p.pos.set(lx, RIM.y + 1, lz); p.vel.set(0, 0, 0);
    p.lookAt?.({ x: DOME.x, y: RIM.y + 2.2, z: DOME.z }); // (owner 2026-10-30: you step out right by Captain Suds, looking at him)
    this.ride = null; this.rideOut = false; this.ledge = { x: lx, y: RIM.y + 1, z: lz };
    sound.play('fizzstar');
    this.toast(again ? `${WORDS.chimney} ${FUN.tag}` : WORDS.chimney);
    this.sync(true);
  }

  /* ---------------------------------------------- Captain Suds' shields and his bubble ---------------------------------------------- */
  // Is shield k up? (not popped yet; or, all of them popped, back again just for fun a while after its last pop)
  shieldUp(k, st = this.state()) { return !st.shield[k] ? this.burst[k] > 0.5 : st.shields >= NS && this.burst[k] > BUBBLE_RULES.funBack; }
  shieldNow(k) {
    const s = SHIELDS[k], c = shieldAt(s, this.courtT, shieldSway(this.shieldMiss, this.hard)), r = shieldSize(s, this.shieldMiss, this.hard);
    if (s.low) c.y += s.r - r; // the low one sits in the foam: bigger (the kind help) or smaller (a rematch), its top stays a jump high
    return { c, r };
  }
  // Captain Suds' bubble: up while any shield is (one skin per shield); its outer radius is the outermost skin left.
  domeUp(st = this.state()) { return st.shields < SHIELDS.length; }
  domeR(st = this.state()) { const k = st.shield.findIndex(s => !s); return k < 0 ? 0 : DOME.r - k * DOME.skin; }
  // A boing: a shield (k) or the dome (k = DOME_K) pushes you straight out to where you stand clear of it (c, r), then on a little way, with a
  // hop and a boing sound (owner 2026-10-30: "side bumps visibly boing you off"). up: you came down onto it (its shoulder, or the dome's top).
  boingOff(k, c, r, hit) {
    const p = this.game.player, [nx, nz] = hit.bump, d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
    const out = Math.max(d, hit.up ? r + SHIELD_RULES.body + 0.02 : clearOf(c, r, p.pos.y));
    const at = new THREE.Vector3(c.x + nx * out, p.pos.y, c.z + nz * out);
    if (!p.collides?.(at)) { p.pos.x = at.x; p.pos.z = at.z; }
    if (hit.up || p.onGround) { p.vel.y = Math.max(p.vel.y, hit.up ? BUBBLE_RULES.boingHop * 1.6 : BUBBLE_RULES.boingHop); p.onGround = false; }
    this.boing = { nx, nz, t: 0 };
    this.wob[k] = 0;
    if (this.boingGap >= BUBBLE_RULES.boingGap) { sound.play('boing'); this.boingGap = 0; this.boings++; if (k < NS && hit.up) this.shieldMiss++; }
  }
  stepShields(step) {
    const p = this.game.player, st = this.state();
    if (p.carry === this.standObj && this.stood && this.ledge && Math.abs(this.ledge.y - (RIM.y + 1)) < 0.6) this.fromRim = true; // a ride from the rim
    this.boingGap += step;
    if (this.boing) { // the boing carries you on outward a moment
      const b = this.boing; b.t += step;
      const at = new THREE.Vector3(p.pos.x + b.nx * SHIELD_RULES.push * step, p.pos.y, p.pos.z + b.nz * SHIELD_RULES.push * step);
      if (!p.carry && !p.collides?.(at)) { p.pos.x = at.x; p.pos.z = at.z; }
      if (b.t >= BUBBLE_RULES.boing) this.boing = null;
    }
    for (let k = 0; k < SHIELDS.length; k++) {
      if (!this.shieldUp(k, st)) continue;
      const { c, r } = this.shieldNow(k);
      if (p.carry === this.standObj && this.stood) { // your bubble bumps off a shield (it is much bigger)
        const b = this.stood, d = Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z);
        if (d < r + BUBBLE.r) { const h = Math.hypot(b.x - c.x, b.z - c.z) || 1; b.vx += (b.x - c.x) / h * 1.5; b.vz += (b.z - c.z) / h * 1.5; }
        continue;
      }
      if (p.carry) continue;
      const hit = stomp(c, r, { x: p.pos.x, z: p.pos.z, feet: p.pos.y, prev: this.prevFeet ?? p.pos.y, vy: p.vel.y });
      if (hit === 'pop') this.popShield(k, st);
      else if (hit?.bump) this.boingOff(k, c, r, hit);
    }
    this.stepDome(step, st);
  }
  // Captain Suds' bubble: nobody gets in (it boings you back, a bubble you ride pops on it); he giggles when you come close.
  stepDome(step, st) {
    const p = this.game.player;
    this.giggleT += step; this.domeBurst += step;
    if (!this.domeUp(st)) return;
    const c = { x: DOME.x, y: DOME.y, z: DOME.z }, r = this.domeR(st), d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
    if (p.carry === this.standObj && this.stood) {
      const b = this.stood;
      if (Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z) < r + BUBBLE.r) { this.field.pop(b); sound.play('soappop'); this.dropOff(); this.wob[DOME_K] = 0; }
      return;
    }
    if (p.carry) return;
    const near = d < r + 2.2 && Math.abs(p.pos.y - (RIM.y + 1)) < 3;
    if (near && !this.nearDome) { this.giggleT = 0; this.once('sealed', WORDS.sealed); }
    this.nearDome = near || (this.nearDome && d < r + 4);
    const hit = stomp(c, r, { x: p.pos.x, z: p.pos.z, feet: p.pos.y, prev: this.prevFeet ?? p.pos.y, vy: p.vel.y });
    if (hit === 'pop') this.boingOff(DOME_K, c, r, { bump: d > 1e-6 ? [(p.pos.x - c.x) / d, (p.pos.z - c.z) / d] : [0, 1], up: true }); // (his bubble never pops from a stomp: his shields hold it)
    else if (hit?.bump) { this.boingOff(DOME_K, c, r, hit); this.giggleT = 0; }
  }
  popShield(k, st) {
    const p = this.game.player;
    this.burst[k] = 0; this.stomped = true; this.shieldMiss = 0; this.boing = null;
    p.vel.y = SHIELD_RULES.rise; p.onGround = false;
    sound.play('shieldburst');
    if (st.shield[k]) { this.toast(WORDS.funShield); return; }
    this.addKey(shieldKey(k + 1));
    const n = this.state().shields;
    this.wob[DOME_K] = 0; this.giggleT = 0;
    if (n >= SHIELDS.length) { this.domeBurst = 0; sound.play('shieldburst'); }
    this.toast(n >= SHIELDS.length ? WORDS.allShields : WORDS.shieldHit(n));
  }

  /* ---------------------------------------------- the lifts ---------------------------------------------- */
  sync(force = false) {
    let st = this.state();
    // (owner 2026-10-30: a climb that was never counted) an old save with later progress (a duckling, the chimney, a shield) but no climb
    // key climbed it for sure (the lifts never ran for it): it gets the key, once. Never with the star (a rematch climbs again).
    if (!st.stairs && !st.star && (st.ducks || st.chimney || st.shields)) { this.game.beaten.push(stairsKey); st = this.state(); } // (kept by the next save)
    const lifts = (this.world.lifts ??= []);
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
      this.clock += step; this.gardenT += step; this.courtT += step; this.puffT += step; this.shook += step;
      const l = this.ledge ? ledgeAt(this.ledge.x, this.ledge.y, this.ledge.z) : null;
      this.field.help = l != null && inClimb(p.pos.x, p.pos.y, p.pos.z) ? this.stairMiss[l] : 0; this.field.hard = this.hard;
      this.stepWand(p);
      for (const e of this.field.step(step, { solid: (x, y, z) => this.world.isSolid(x, y, z), winds: CLIMB_WINDS, drips: DRIPS })) {
        if (e.type === 'pop') { sound.play('soappop'); if (e.b === this.stood) this.dropOff(); }
      }
      this.stepStand();
      this.checkLanding();
      this.checkGround();
      this.stepShields(step);
      this.stepDucks(step);
      this.stepRide(step);
      for (let k = 0; k < NS; k++) this.burst[k] += step;
      for (let k = 0; k <= NS; k++) this.wob[k] += step;
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
    // your bubbles: a slow wobble, a fast one the last moment before they pop
    const BP = this.bubbles.userData.parts;
    hideAll(BP.film); hideAll(BP.shine);
    let i = 0;
    for (const b of this.field.list) {
      const wob = b.age > this.field.life - BUBBLE.warn ? 0.12 * Math.sin(t * 40) : 0.03 * Math.sin(t * 3 + b.id);
      S.set(BUBBLE.r * (1 + wob), BUBBLE.r * (1 - wob), BUBBLE.r * (1 + wob)); P.set(b.x, b.y, b.z);
      M.compose(P, Q, S); BP.film.setMatrixAt(i, M); BP.shine.setMatrixAt(i, M); i++;
    }
    BP.film.instanceMatrix.needsUpdate = true; BP.shine.instanceMatrix.needsUpdate = true;
    BP.film.material.uniforms.uTime.value = t;
    // the ghost bubble: where a wet wand's bubble comes out (only with soap on the wand and your feet on the floor)
    const showGhost = !!cam && this.wet && !this.ride && this.onGround(p) && !this.duckAhead(p) && !this.nearRide(p) && !this.nestAgain(p) && !this.doorAhead(p.eyePos, p.forward);
    const spot = showGhost ? this.field.spot(p.pos, this.flatLook(p), (x, y, z) => this.world.isSolid(x, y, z)) : null;
    this.ghost.visible = !!spot;
    if (spot) { const gp = this.ghost.userData.parts; this.ghost.position.set(spot.x, spot.y, spot.z); gp.ring.material.color.setHex(0x7dffa0); gp.ring.material.opacity = 0.6; gp.ball.material.opacity = 0.1; }
    // the wand in your hand: a shiny soap film in its ring while wet, an empty ring while dry
    this.wand.visible = !!cam && !this.ride;
    if (this.wand.visible) {
      const o = this.wand; o.position.copy(cam.position); o.quaternion.copy(cam.quaternion); o.translateX(0.32); o.translateY(-0.26); o.translateZ(-0.6); o.rotateZ(0.35); o.rotateX(-0.2);
      const WP = o.userData.parts; WP.film.visible = this.wet || this.shook < 0.12; WP.film.scale.setScalar(this.wet ? 1 + 0.05 * Math.sin(t * 5) : 1.4);
      WP.film.material.opacity = 0.5 + 0.12 * Math.sin(t * 4);
    }
    // a puff of air: a few wisps fly out of the wand and fade
    const PW = this.puffs.userData.parts, pa = this.puffAt, pt = this.puffT / BUBBLE_RULES.puffTime;
    if (pa && pt < 1) {
      for (let k = 0; k < PW.n; k++) {
        const s = 0.4 + 2.2 * pt * (0.7 + 0.1 * k), side = (k - 3) * 0.12 * (0.3 + pt);
        P.set(pa.x + pa.dx * s - pa.dz * side, pa.y + 0.08 * Math.sin(k * 1.7) + 0.2 * pt, pa.z + pa.dz * s + pa.dx * side); S.setScalar(0.6 + 1.4 * pt);
        PW.wisps.setMatrixAt(k, M.compose(P, Q, S));
      }
      PW.wisps.material.opacity = 0.7 * (1 - pt); PW.wisps.instanceMatrix.needsUpdate = true;
    } else hideAll(PW.wisps);
    // the soap pots' little bubbles bob
    this.pots.userData.parts.pots.forEach((pot, k) => pot.bubs.forEach((b, j) => { b.position.y = 0.7 + 0.08 * Math.sin(t * 2 + k + j * 2); b.material.uniforms.uTime.value = t; }));
    // drips and shadows
    const DP = this.drips.userData.parts;
    DRIPS.forEach((d, k) => {
      const y = dripAt(d, this.field.clock, this.field.drip);
      DP.drops.setMatrixAt(k, y === null ? M.makeScale(0, 0, 0) : M.makeTranslation(d.x, y, d.z));
      const near = y === null ? 0.5 : 0.6 + 0.6 * (1 - (y - d.bottom) / (d.top - d.bottom));
      DP.shadows.setMatrixAt(k, M.compose(P.set(d.x, d.bottom + 0.02, d.z), Q, S.set(near, 1, near)));
    });
    DP.drops.instanceMatrix.needsUpdate = true; DP.shadows.instanceMatrix.needsUpdate = true;
    // streams: the steady winds, the garden's current, the lifts (only while on); the gusts (only while they gather or blow)
    const on = this.streamOn.slice(); on[on.length - 2] = !!this.liftsOn[0]; on[on.length - 1] = !!this.liftsOn[1];
    drawStreams(this.streams, t, on);
    drawStreams(this.gusts, t * 1.6, this.gustWinds.map(gw => gustAt(gw, gw.garden ? this.gardenT : this.field.clock) > 0));
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
    this.arrow.visible = !!da && da.d.state === 'float';
    if (this.arrow.visible) {
      const look = this.flatLook(p), len = Math.min(9, glideOf(da.dist, da.d.friction));
      this.arrow.position.set(da.d.x, MESA.top + 1.06, da.d.z); this.arrow.rotation.set(0, -Math.atan2(look.z, look.x), 0); this.arrow.scale.set(len, 1, 1);
    }
    // the chimney: the gaps (drawn wider with the kind help; the next one pulses with a beam of light), a turning plate, the fans, the bar, the stars
    const CP = this.chim.userData.parts, rt = this.ride ? this.ride.t : t, gapK = (this.ride?.gap ?? RIDE.gap) / RIDE.gap, nextK = this.ride ? CHIMNEY.plates.findIndex(q => this.ride.y < q.y + 1) : 0;
    CP.plates.forEach((pl, k) => {
      const pulse = k === nextK ? 1 + 0.08 * Math.sin(t * 6) : 1;
      pl.g.rotation.y = -pl.spin * rt;
      pl.glowRing.scale.set(gapK * pulse, gapK * pulse, 1); pl.halo.scale.set(gapK * pulse, gapK * pulse, 1);
      pl.beam.visible = k === nextK; pl.halo.material.opacity = k === nextK ? 0.22 + 0.08 * Math.sin(t * 6) : 0.12; // (owner 2026-10-30: a little dimmer)
    });
    CP.fans.forEach((f, k) => { f.rotation.z = t * (6 + k); });
    CP.bars.forEach((b, k) => { const bar = barsOf(CHIMNEY)[k]; b.rotation.y = -(this.ride ? this.ride.barAngle(this.ride.t, k) : t * RIDE.bar * (bar.speed ?? 1) + (bar.a0 || 0)); });
    // the bars of soap over the rings (the ride's checkpoints): they turn slowly and bob; one you floated past goes pale
    CP.soaps.forEach((s, k) => {
      const pl = CHIMNEY.plates[k - 1], at = CHIMNEY.stars[k];
      if (pl?.spin) { const g = gapOf(CHIMNEY, pl, rt); s.position.x = g.x; s.position.z = g.z; }
      s.position.y = at.y + 0.08 * Math.sin(t * 2 + k); s.rotation.y = t * 1.2 + k; s.visible = k > 0;
      s.userData.parts.bar.material.color.setHex(this.ride && this.ride.star >= k ? 0xfff0f8 : 0xff9ad0);
      for (const b of s.userData.parts.bubbles) b.material.uniforms.uTime.value = t;
    });
    // the ride bubble: waiting (big, golden, a little duck on its seat, the "Ride!" sign over it) or carrying you. From inside it is only
    // a faint soap rim (owner 2026-10-29: "once I'm in the bubble, it became overly bright ... I have no idea what I'm seeing").
    const rb = this.rideBubble, r = this.ride, RP = rb.userData.parts;
    rb.visible = !r || r.popT === null;
    const big = RIDE_LOOK.wait / RIDE.R, bob = 0.12 * Math.sin(t * 1.8);
    if (r) { rb.position.set(r.x, r.y, r.z); rb.scale.setScalar(1.6); }
    else { rb.position.set(CHIMNEY.x, CHIMNEY.floor + RIDE_LOOK.wait + 0.1 + bob, CHIMNEY.z); rb.scale.setScalar(big * (1 + 0.04 * Math.sin(t * 3))); }
    const inside = !!r && p.carry === this.rideObj;
    RP.film.material.uniforms.uTime.value = t * 2; RP.film.material.uniforms.uAlpha.value = inside ? 0.22 : 0.8;
    for (const o of [RP.glow, RP.gold, RP.sparks, RP.band, RP.seat, RP.shine]) o.visible = !inside;
    RP.glow.material.opacity = 0.25 + 0.12 * Math.sin(t * 3); RP.gold.material.opacity = 0.22 + 0.06 * Math.sin(t * 3);
    RP.sparks.rotation.y = t * 0.9; RP.sparks.children.forEach((m, k) => m.scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(t * 3 + k))));
    this.rideSign.visible = !r;
    this.rideSign.position.set(CHIMNEY.x, CHIMNEY.floor + RIDE_LOOK.wait * 2 + 1.0 + bob, CHIMNEY.z);
    if (this.rideDuck) {
      this.rideDuck.visible = !r;
      if (!r) { this.rideDuck.position.set(rb.position.x, rb.position.y - RIDE_LOOK.wait * 0.62, rb.position.z); this.rideDuck.rotation.set(0, Math.PI / 2 + 0.4 * Math.sin(t * 0.8), 0); animateModel(this.rideDuck, t, false); }
    }
    // the shields: bobbing on the breeze; a boing squashes one for a moment; a burst grows and fades for half a second; popped ones
    // float back later just for fun
    const squash = w => (w < 0.5 ? 0.16 * Math.sin(w * 25) * (1 - w / 0.5) : 0);
    this.shields.userData.parts.list.forEach((s, k) => {
      const up = this.shieldUp(k, st), b = this.burst[k], { c, r: rr } = this.shieldNow(k), q = squash(this.wob[k]);
      s.g.visible = up || b < 0.5;
      s.g.position.set(c.x, c.y, c.z);
      const sc = up ? rr / SHIELDS[k].r * (1 + 0.02 * Math.sin(t * 2 + k)) : 1 + b * 1.2;
      s.g.scale.set(sc * (1 + q), sc * (1 - q), sc * (1 + q));
      s.ring.rotation.z = t * (0.4 + k * 0.2);
      s.g.children[0].material.uniforms.uTime.value = t;
      s.g.children[0].material.uniforms.uAlpha.value = up ? 0.9 : Math.max(0, 1 - b * 2);
    });
    // Captain Suds' bubble: one skin per shield still up; it wobbles when it boings you; trails of little bubbles run into it from every
    // shield still up; the last pop bursts it (it grows and fades)
    const OP = this.dome.userData.parts, domeOn = this.domeUp(st), bt = this.domeBurst / BUBBLE_RULES.burstTime, dq = squash(this.wob[DOME_K]) * 0.5;
    OP.skins.forEach((sk, k) => {
      const on = domeOn ? !st.shield[k] : bt < 1;
      sk.g.visible = on;
      if (!on) return;
      const grow = domeOn ? 1 + 0.012 * Math.sin(t * 1.7 + k) : 1 + 0.5 * bt;
      sk.g.scale.set(grow * (1 + dq), grow * (1 - dq), grow * (1 + dq));
      sk.film.material.uniforms.uTime.value = t * 0.8 + k;
      sk.film.material.uniforms.uAlpha.value = domeOn ? 0.75 : 0.75 * (1 - bt);
      sk.band.material.opacity = domeOn ? 0.7 : 0.7 * (1 - bt);
      sk.band.rotation.z = t * (0.15 + 0.07 * k);
    });
    OP.shine.visible = domeOn;
    hideAll(OP.trail);
    if (domeOn) {
      const R0 = this.domeR(st);
      for (let k = 0; k < SHIELDS.length; k++) {
        if (st.shield[k] || !this.shieldUp(k, st)) continue;
        const { c } = this.shieldNow(k), dx = c.x - DOME.x, dy = c.y - DOME.y, dz = c.z - DOME.z, l = Math.hypot(dx, dy, dz) || 1;
        const ex = DOME.x + dx / l * R0, ey = DOME.y + dy / l * R0, ez = DOME.z + dz / l * R0, rr = this.shieldNow(k).r;
        const sx = c.x - dx / l * rr, sy = c.y - dy / l * rr, sz = c.z - dz / l * rr;
        for (let i = 0; i < OP.per; i++) {
          const u = (t * 0.45 + i / OP.per) % 1, arc = Math.sin(u * Math.PI) * 0.7;
          P.set(sx + (ex - sx) * u, sy + (ey - sy) * u + arc, sz + (ez - sz) * u); S.setScalar(0.7 + 0.5 * Math.sin(u * Math.PI));
          OP.trail.setMatrixAt(k * OP.per + i, M.compose(P, Q, S));
        }
      }
      OP.trail.instanceMatrix.needsUpdate = true;
    }
    // Captain Suds giggles in his bubble (a little hop) when you come close, bump it or talk to him, and hops for joy when it bursts
    const boss = this.game.npcs?.list?.find?.(n => n.kind === 'boss' && n.def?.id === 'bubble');
    if (boss?.model && !this.game.inBattle) {
      const jig = this.giggleT < BUBBLE_RULES.giggle ? Math.abs(Math.sin(this.giggleT * 9)) * 0.3 * (1 - this.giggleT / BUBBLE_RULES.giggle) : 0;
      if (jig > 0 || this.jigged) boss.model.position.y = boss.pos.y + jig;
      this.jigged = jig > 0;
    }
  }
  refreshChip() {
    const ui = this.game.ui;
    if (!ui?.setScore || this.game.world !== this.world) return;
    const st = this.state();
    if (this.ride) { ui.setScore({ text: `🧼 ${this.ride.star} / ${CHIMNEY.stars.length - 1}`, done: false }); return; } // (bars of soap: owner 2026-10-30, no stars here)
    const ready = st.ready && !this.game.bosses?.crewAim?.(this.game.player.pos);
    if (ready && !st.star) { ui.setScore({ text: '🫧 Captain Suds is ready!', done: true }); return; }
    // (owner 2026-10-30: "What is 'ledge'?": the climb is "Climb", a word a child knows)
    ui.setScore({ text: `🫧 Climb ${st.stairs ? '✓' : '○'} · 🦆 ${st.ducks} / 3 · Chimney ${st.chimney ? '✓' : '○'} · 🛡️ ${st.shields} / ${NS}`, done: false });
  }

  // For tests.
  info() {
    const r = this.ride;
    return {
      wet: this.wet, bubbles: this.field.list.map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, stand: b.stand, age: b.age, standT: b.standT })),
      stood: this.stood?.id ?? null, ledge: this.ledge ? { ...this.ledge } : null, stairMiss: this.stairMiss.slice(), fromBubble: this.fromBubble,
      ducks: this.ducks.map(d => ({ state: d.state, x: d.x, z: d.z, vx: d.vx, vz: d.vz, left: d.left })), duckMiss: this.duckMiss.slice(),
      ride: r ? { x: r.x, y: r.y, z: r.z, star: r.star, done: r.done, pops: r.pops, popT: r.popT, t: r.t } : null, rideMiss: this.rideMiss,
      shieldMiss: this.shieldMiss, shields: SHIELDS.map((s, k) => ({ up: this.shieldUp(k), ...this.shieldNow(k) })), courtT: this.courtT, dome: { up: this.domeUp(), r: this.domeR(), skins: this.dome.userData.parts.skins.filter(s => s.g.visible).length }, boings: this.boings, lifts: this.liftsOn.slice(), state: this.state(),
    };
  }
}
export { inChimney };
