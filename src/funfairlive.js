// T43: the live part of the Funfair (LIVE.fair, made by gymLive.reset for the part in world.parts): three skill games, each gives a
// golden ticket, and the roller coaster to Merry Mae's Star Stage that opens with the three tickets.
//   Bumper Cars   drive a car that slides and bounces (momentum) and bump the balloon off the BACK of six bumper bots' cars
//   Balloon Bounce  bounce on the trampoline (the block flag `trampoline`, player.js): hold Jump to go higher, let go to come down, pop six balloons
//   Gold Ring Ride  ride the carousel, push the stick in or out to change horses, hop for the high rings, catch all ten gold rings
//   Coaster       a Mover on PATHS.coaster (closed form) from the station to the stage; Slide! (PATHS.helix) takes you back down
// None of them is hold-and-let-go, none can be failed (no timers, no lives); the tickets are saved at once as `beaten` keys
// (pw:fair:ticket1..3); everything else (pops, rings caught) is per trip and in memory. Every clock is the sum of the game's clamped
// frame dt and stands still in a battle, a question, a panel and the pause screen, so a slow device slows the fair like it slows you.
// `manual = true` + step(dt) lets a spec drive it by hand. Meshes are in fairprops.js (about 14 draw calls in the zone).
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { Mover, PATHS } from './mover.js';
import { sound } from './sound.js';
import {
  BumperCar, BAYS, BOTS, ARENA, botAt, BUMPER, balloonOfBot, TRAMP, balloonList, balloonAt, touchesBalloon, CAROUSEL, Seat, ringList, SILVER, omegaOf, carouselAngle, carouselAngleOf, spokeAngle,
  horseBob, onCarousel, STAGE, STATION, SLIDE, COASTER, makeCoaster, makeHelix, registerFairPaths,
} from './fairgames.js';
import { buildBumperFleet, buildCarousel, buildRings, buildAirBalloons, buildCoasterCar, buildFerrisWheel, buildSlide, buildConfetti } from './fairprops.js';
import { ticketState, ticketKey, TICKETS } from './funfair.js';

registerFairPaths(PATHS);
export const FAIR_RULES = { sleepDist: 60, syncEvery: 0.25, tuneEvery: 9, regrow: 3.5, reach: 2.2, deckReach: 2, coasterReach: 3.2, slideReach: 2.4, camEase: 0.6, wheelTurn: 60, gateOpenFor: 8 };
const TAU = Math.PI * 2;
const wrap = a => { a %= TAU; return a < -Math.PI ? a + TAU : a > Math.PI ? a - TAU : a; };
const inRect = (b, x, z) => x >= b.x0 && x < b.x1 + 1 && z >= b.z0 && z < b.z1 + 1;

export class FairLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    this.world = game.world;
    this.scene = game.scene ?? null;
    this.cells = new LiveCells(this.world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;                                          // tests set it and call step(dt) themselves
    this.clock = 0; this.syncT = 0; this.tuneT = FAIR_RULES.tuneEvery;
    this.told = new Set();
    // Bumper Cars
    this.car = new BumperCar();
    this.drive = -1;                                  // the bay of the car you drive, or -1
    this.parked = BAYS.map(b => ({ x: b.x, z: b.z, yaw: b.yaw }));
    this.popped = BOTS.map(() => false); this.pops = 0; this.wob = BOTS.map(() => 0);
    this.wish = { x: 0, z: 0 }; this.spaceHeld = true; this.honkAt = -9; this.hitAt = -9; this.regrowAt = null;
    // Balloon Bounce
    this.airPopped = []; this.airPops = 0; this.airRegrowAt = null;
    // Gold Ring Ride
    this.seat = new Seat(this.hard); this.riding = false; this.spoke = 0; this.missedAt = -9;
    // the coaster and the slide
    this.coaster = null; this.slide = null;
    this.coasterPath = makeCoaster(COASTER);
    this.lit = { board: null, lights: -1 };
    this.gateOpen = false;
    this.carObj = this.makeCarObj(); this.seatObj = this.makeSeatObj();
    this.groups = [];
    this.build();
  }

  get hard() { return this.game.stars.includes('fair'); }
  get awake() { return this.game.stars.includes('fair'); }
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  toast(m) { this.game.ui?.toast(m); }
  once(key, text) { if (this.told.has(key)) return; this.told.add(key); this.toast(text); }
  inZone(pos, margin = 0) { const a = this.part.area; return pos.x >= a.x0 - margin && pos.x <= a.x1 + 1 + margin && pos.z >= a.z0 - margin && pos.z <= a.z1 + 1 + margin; }
  get botT() { return this.drive >= 0 ? this.car.t : this.clock; } // (while you drive, the bots follow the car's own sub-step clock)

  /* ---------------------------------------------- meshes ---------------------------------------------- */
  build() {
    const add = o => { this.groups.push(o); this.scene?.add(o); return o; };
    this.fleet = add(buildBumperFleet());
    this.carouselMesh = add(buildCarousel());
    this.ringMesh = add(buildRings());
    this.airMesh = add(buildAirBalloons());
    this.coasterCar = add(buildCoasterCar());
    this.wheelMesh = add(buildFerrisWheel(this.part.wheel));
    this.slideMesh = add(buildSlide());
    this.confetti = add(buildConfetti());
    this.draw(true);
  }
  dispose() {
    this.game.ui?.setScore?.(null);
    this.giveBack();
    for (const g of this.groups) { this.scene?.remove(g); g.userData.dispose?.(); }
    this.groups = [];
  }
  // puts the player down safely wherever a ride was carrying them (a new world, a reload)
  giveBack() {
    const p = this.game.player;
    if (p?.carry && (p.carry === this.carObj || p.carry === this.seatObj || p.carry === this.coaster || p.carry === this.slide)) {
      const at = p.carry.safe?.() ?? { x: p.pos.x, y: p.pos.y, z: p.pos.z };
      p.carry = null; p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0);
    }
    this.drive = -1; this.riding = false; this.coaster = null; this.slide = null;
  }

  /* ---------------------------------------------- the rides that carry you ---------------------------------------------- */
  // Rider objects the player's `carry` accepts (player.js): where(), wantsLeave(), leave(), steer(wx, wz, analog, space), safe().
  makeCarObj() {
    const me = this;
    return {
      where: () => ({ x: me.car.x, y: 11.45, z: me.car.z, yaw: me.car.yaw }),
      wantsLeave: () => false,
      leave() { const p = me.game.player; if (p?.carry === this) p.carry = null; },
      steer(wx, wz, analog, space) { me.wish = { x: wx * analog, z: wz * analog }; if (space && !me.spaceHeld) me.honk(); me.spaceHeld = !!space; },
      safe: () => ({ x: me.parked[Math.max(0, me.drive)].x, y: 11, z: me.parked[Math.max(0, me.drive)].z + 1.8 }),
    };
  }
  makeSeatObj() {
    const me = this;
    return {
      where() { const w = me.seat.where(); w.y += horseBob(me.spoke, me.seat.laneNow, me.clock); return w; },
      wantsLeave: () => false,
      leave() { const p = me.game.player; if (p?.carry === this) p.carry = null; },
      steer(wx, wz, analog, space) {
        const p = me.game.player, c = CAROUSEL.c, dx = p.pos.x - c[0], dz = p.pos.z - c[1], d = Math.hypot(dx, dz) || 1;
        me.seat.steer((wx * dx + wz * dz) / d * analog, space);
      },
      safe: () => { const w = me.seat.where(), c = CAROUSEL.c, a = me.seat.angle(), r = Math.max(2.5, me.seat.radius - 1.4), q = onCarousel(a, r); return { x: q.x, y: CAROUSEL.seatY, z: q.z }; },
    };
  }

  /* ---------------------------------------------- the hooks of the live-part interface ---------------------------------------------- */
  // The word for the big action button.
  near(p = this.game.player) {
    if (!p || !this.playing() || this.game.inBattle) return null;
    if (this.drive >= 0) return 'Get out';
    if (this.riding) return 'Get off';
    if (p.carry) return null;
    if (!this.inZone(p.pos)) return null;
    if (p.onGround) {
      if (this.parkedNear(p) >= 0) return 'Drive!';
      if (this.deckNear(p)) return 'Ride!';
      if (this.coasterNear(p)) return 'Ride!';
      if (this.slideNear(p)) return 'Slide!';
    }
    return null;
  }
  parkedNear(p) {
    if (Math.abs(p.pos.y - 11) > 1.2) return -1;
    let best = -1, bd = FAIR_RULES.reach;
    this.parked.forEach((c, i) => { const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z); if (d <= bd) { bd = d; best = i; } });
    return best;
  }
  deckNear(p) {
    const c = CAROUSEL.c, d = Math.hypot(p.pos.x - c[0], p.pos.z - c[1]);
    return p.pos.y < 13.5 && p.pos.y > 10.5 && d <= CAROUSEL.deckR + FAIR_RULES.deckReach && d >= CAROUSEL.deckR - 3;
  }
  coasterNear(p) { const s = STATION.car; return Math.abs(p.pos.y - s[1]) < 1.3 && Math.hypot(p.pos.x - s[0], p.pos.z - s[2]) <= FAIR_RULES.coasterReach; }
  slideNear(p) { const s = SLIDE.from; return Math.abs(p.pos.y - s[1]) < 1.3 && Math.hypot(p.pos.x - s[0], p.pos.z - s[2]) <= FAIR_RULES.slideReach; }

  use(p = this.game.player) {
    if (!p || !this.playing() || this.game.inBattle) return false;
    if (this.drive >= 0) { this.getOut(); return true; }
    if (this.riding) { this.getOff(); return true; }
    const w = this.near(p);
    if (!w) return false;
    if (w === 'Drive!') { this.boardCar(this.parkedNear(p)); return true; }
    if (w === 'Slide!') { this.takeSlide(); return true; }
    if (this.deckNear(p) && !this.coasterNear(p)) { this.boardCarousel(); return true; }
    this.boardCoaster();
    return true;
  }
  holds() { return false; }

  talk(npc) {
    if (npc.kind === 'guest' && npc.name === 'Ticket Tess') {
      const st = ticketState(this.game);
      this.toast(`${npc.name}: ${npc.def?.line ?? 'Hello!'} (🎟️ ${st.n} / ${TICKETS})`);
      return true;
    }
    return false;
  }
  talkPrompt(npc) {
    if (npc.kind === 'guest' && npc.name === 'Ticket Tess') return { verb: 'talk', action: 'Talk' };
    if (npc.kind === 'boss' && npc.def?.id === 'fair' && !ticketState(this.game).done) return { verb: 'talk', action: 'Talk' };
    return null;
  }
  // A won Boss battle (the star, or a rematch): the tickets are used up, so a rematch means playing the games again (harder).
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.picture?.id !== 'fair' || opts.picture.crew != null) return;
    const g = this.game;
    for (let i = 1; i <= TICKETS; i++) { const k = g.beaten.indexOf(ticketKey(i)); if (k >= 0) g.beaten.splice(k, 1); }
    this.popped.fill(false); this.pops = 0; this.airPopped = []; this.airPops = 0; this.seat.caught = []; this.seat.silver = [];
    this.seat.hard = this.hard;
    g.save?.();
  }

  /* ---------------------------------------------- the guide ---------------------------------------------- */
  aim(p) {
    if (!this.inZone(p, 2)) return null; // (p is a position { x, y, z }, as the realm guide passes it)
    const st = ticketState(this.game), onStage = p.y > 18 && inRect(STAGE, p.x, p.z), carry = this.game.player?.carry;
    if (carry && (carry === this.coaster || carry === this.slide)) return { x: STAGE.end[0], z: STAGE.end[2], text: () => 'Wheee! 🎢' };
    if (onStage) {
      const b = this.game.npcs?.list.find(n => n.kind === 'boss' && n.def?.id === 'fair');
      if (st.done || !this.game.stars.includes('fair')) return b ? { x: b.pos.x, z: b.pos.z, text: (a, m) => `⭐ Battle Merry Mae! ${a} ${m}m` } : null;
      return { x: SLIDE.from[0], z: SLIDE.from[2], text: (a, m) => `🛝 Slide! back down ${a} ${m}m` };
    }
    if (st.done) return { x: STATION.car[0], z: STATION.car[2], text: (a, m) => `🎢 Ride the roller coaster! ${a} ${m}m` };
    const games = [
      { i: 0, x: ARENA.cx + 10, z: ARENA.cz, text: (a, m) => `🚗 Bumper Cars: press Drive! ${a} ${m}m` },
      { i: 1, x: (TRAMP.x0 + TRAMP.x1) / 2, z: (TRAMP.z0 + TRAMP.z1) / 2, text: (a, m) => `🎈 Balloon Bounce: hold Jump! ${a} ${m}m` },
      { i: 2, x: CAROUSEL.c[0], z: CAROUSEL.c[1], text: (a, m) => `🎠 Gold Ring Ride ${a} ${m}m` },
    ].filter(g => !st.have[g.i]).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    return games[0] ? { x: games[0].x, z: games[0].z, text: games[0].text } : null;
  }

  /* ---------------------------------------------- tickets ---------------------------------------------- */
  award(i) {
    const g = this.game;
    if (g.beaten.includes(ticketKey(i))) return;
    g.beaten.push(ticketKey(i));
    g.save?.();
    sound.play('ticketprize');
    const st = ticketState(g), at = g.player.pos;
    this.confetti.userData.parts.burst(at.x, at.y + 1.6, at.z, this.clock, 14);
    this.toast(st.done ? 'Golden ticket! 🎟️ 3 / 3. All aboard the roller coaster!' : `Golden ticket! 🎟️ ${st.n} / ${TICKETS}`);
    this.syncBlocks(true);
  }

  /* ---------------------------------------------- Bumper Cars ---------------------------------------------- */
  boardCar(i) {
    const g = this.game, p = g.player;
    if (i < 0) return;
    g.riding?.stop('quiet');
    this.drive = i;
    this.car.reset(this.parked[i].x, this.parked[i].z, this.parked[i].yaw);
    this.car.t = this.clock; this.car.acc = 0;
    this.wish = { x: 0, z: 0 }; this.spaceHeld = !!p.keys?.Space;
    p.carry = this.carObj; p.vel.set(0, 0, 0);
    const w = this.carObj.where(); p.pos.set(w.x, w.y, w.z);
    this.once('drive', 'Bump the balloon on the BACK of a car!');
  }
  getOut(spot) {
    const p = this.game.player, i = this.drive, c = this.car;
    if (i < 0) return;
    this.parked[i] = { x: Math.min(c.x, ARENA.x1 - 1), z: c.z, yaw: c.yaw };
    this.drive = -1;
    if (p.carry === this.carObj) p.carry = null;
    // beside the car, towards the middle of the arena (or out of the gate)
    const A = ARENA;
    let ox = A.cx - c.x, oz = A.cz - c.z; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
    const x = spot?.x ?? c.x + ox * 1.9, z = spot?.z ?? c.z + oz * 1.9;
    p.pos.set(x, 11, z); p.vel.set(0, 0, 0);
  }
  honk() { if (this.clock - this.honkAt < 0.25) return; this.honkAt = this.clock; sound.play('honkhonk'); }
  driveStep(dt) {
    const hard = this.hard, car = this.car;
    const parked = this.parked.filter((_, i) => i !== this.drive);
    const ev = car.update(dt, { wish: this.wish, hard, popped: this.popped, parked, home: this.parked[this.drive] });
    for (const e of ev) {
      if (e.type === 'pop') this.popBalloon(e.i);
      else if (e.type === 'bump' && e.kind === 'side') { this.once('side', 'Boing! Get behind it!'); this.wob[e.i] = 1; }
      else if (e.type === 'hit') { if (this.clock - this.hitAt > 0.2) { this.hitAt = this.clock; sound.play('boing'); } if (e.kind === 'bot') this.wob[e.i] = 1; }
      else if (e.type === 'exit') { this.getOut({ x: ARENA.x1 + 2.2, z: this.car.z }); break; } // out through the gate: the car stays just inside
    }
    for (let i = 0; i < this.wob.length; i++) this.wob[i] = Math.max(0, this.wob[i] - dt * 2);
    const p = this.game.player;
    if (p.carry === this.carObj) { const w = this.carObj.where(); p.pos.set(w.x, w.y, w.z); }
  }
  popBalloon(i) {
    if (this.popped[i]) return;
    this.popped[i] = true; this.pops++;
    const b = botAt(i, this.botT, this.hard), at = balloonOfBot(b);
    this.confetti.userData.parts.burst(at.x, at.y, at.z, this.clock, 10);
    sound.play('balloonpop');
    const done = this.popped.every(Boolean);
    this.toast(`🎈 Pop! ${this.popped.filter(Boolean).length} / ${BUMPER.pops}`);
    if (done) {
      this.regrowAt = this.clock + FAIR_RULES.regrow;
      this.award(1);
    }
  }

  /* ---------------------------------------------- Balloon Bounce ---------------------------------------------- */
  airStep() {
    const p = this.game.player, hard = this.hard, list = balloonList(hard);
    if (p.carry) return;
    if (p.onGround && this.world.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z)) === B.TRAMPOLINE) this.once('tramp', 'Hold Jump to bounce higher. Let go to come down.');
    if (p.pos.y > 16 && inRect({ x0: TRAMP.x0, x1: TRAMP.x1, z0: TRAMP.z0, z1: TRAMP.z1 }, p.pos.x, p.pos.z)) this.once('steer', 'Steer in the air!');
    if (p.pos.x < TRAMP.x0 - 3 || p.pos.x > TRAMP.x1 + 4 || p.pos.z < TRAMP.z0 - 3 || p.pos.z > TRAMP.z1 + 4 || p.pos.y < 11.5) return;
    list.forEach((_, i) => {
      if (this.airPopped[i]) return;
      const b = balloonAt(i, this.clock, hard);
      if (!touchesBalloon(p.pos, b)) return;
      this.airPopped[i] = true; this.airPops++;
      this.confetti.userData.parts.burst(b.x, b.y, b.z, this.clock, 10);
      sound.play('balloonpop');
      const need = hard ? TRAMP.hardPops : TRAMP.pops, n = this.airPopped.filter(Boolean).length;
      this.toast(`🎈 Pop! ${Math.min(n, need)} / ${need}`);
      if (n >= need) { this.airRegrowAt = this.clock + FAIR_RULES.regrow; this.award(2); }
    });
  }

  /* ---------------------------------------------- Gold Ring Ride ---------------------------------------------- */
  boardCarousel() {
    const g = this.game, p = g.player, hard = this.hard;
    g.riding?.stop('quiet');
    const phi = carouselAngleOf(p.pos.x, p.pos.z);
    let best = 0, bd = 9;
    for (let k = 0; k < CAROUSEL.spokes; k++) { const d = Math.abs(wrap(spokeAngle(k, this.clock, hard) - phi)); if (d < bd) { bd = d; best = k; } }
    this.spoke = best;
    this.seat.hard = hard;
    this.seat.reset(this.clock, (best / CAROUSEL.spokes) * TAU, 2);
    this.seat.jumpHeld = !!p.keys?.Space;
    this.riding = true;
    p.carry = this.seatObj; p.vel.set(0, 0, 0);
    const w = this.seatObj.where(); p.pos.set(w.x, w.y, w.z);
    this.once('ride', 'Push the stick in or out to change horses. Jump for high rings!');
  }
  getOff() {
    const p = this.game.player, at = this.seatObj.safe();
    this.riding = false;
    if (p.carry === this.seatObj) p.carry = null;
    p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0);
  }
  ringStep(dt) {
    const hard = this.hard, ev = this.seat.update(dt), parts = this.confetti.userData.parts;
    const need = ringList(hard).length, p = this.game.player;
    for (const c of ev.caught) {
      const r = c.silver ? SILVER[c.i] : ringList(hard)[c.i], rad = CAROUSEL.lanes[r.lane], q = onCarousel(r.a, rad);
      parts.burst(q.x, (r.high && !c.silver ? CAROUSEL.highY : CAROUSEL.ringY), q.z, this.clock, c.silver ? 4 : 8);
      sound.play('ringding');
      if (!c.silver) this.toast(`💍 ${Math.min(this.seat.caught.length, need)} / ${need}`);
    }
    if (ev.missed.length && this.clock - this.missedAt > 8) { this.missedAt = this.clock; this.once('miss', 'It comes round again!'); }
    if (this.seat.done) this.award(3);
    if (p.carry === this.seatObj) { const w = this.seatObj.where(); p.pos.set(w.x, w.y, w.z); }
  }

  /* ---------------------------------------------- the roller coaster and the slide ---------------------------------------------- */
  boardCoaster() {
    const g = this.game, p = g.player, st = ticketState(g);
    if (!st.done) { this.toast(`Win 3 golden tickets first! 🎟️ ${st.n} / ${TICKETS}`); return; }
    g.riding?.stop('quiet');
    sound.play('coasterclack');
    this.toast('All aboard! Hold on tight!');
    const m = new Mover({ path: this.coasterPath, run: 'ride', canLeave: false, onEnd: () => { this.coaster = null; this.toast('Merry Mae is waiting on the Star Stage!'); } });
    m.safe = () => ({ x: STATION.car[0], y: STATION.car[1], z: STATION.car[2] + 2.2 });
    this.coaster = m; this.clackAt = 0;
    m.board(p);
  }
  takeSlide() {
    const g = this.game, p = g.player;
    g.riding?.stop('quiet');
    this.toast('Wheee! 🛝');
    const path = makeHelix();
    const m = new Mover({ path, run: 'ride', canLeave: false, onEnd: () => { this.slide = null; this.toast('Back on the ground! Play again, or go back to the Swirl.'); } });
    m.safe = () => ({ x: SLIDE.to[0], y: SLIDE.to[1], z: SLIDE.to[2] });
    this.slide = m;
    m.board(p);
  }
  rideStep(dt) {
    const p = this.game.player;
    if (this.coaster) {
      const m = this.coaster;
      m.update(dt);
      if (this.coaster) { // (still riding) the lift hill clicks; the camera turns gently the way the car goes
        const w = m.where(), top = this.coasterPath.times[this.coasterPath.topIdx];
        if (m.clock < top && m.clock - this.clackAt >= 0.35) { this.clackAt = m.clock; sound.play('coasterclack'); }
        p.yaw += wrap(w.yaw - p.yaw) * Math.min(1, FAIR_RULES.camEase * dt);
      }
    }
    if (this.slide) { this.slide.update(dt); if (this.slide) { const w = this.slide.where(); p.yaw += wrap(w.yaw - p.yaw) * Math.min(1, 1.5 * dt); } }
  }

  // The shutter across the track at the station's west end is open only while the car goes through (it keeps walkers off the rails).
  gateStep() {
    const open = !!this.coaster && this.coaster.clock < FAIR_RULES.gateOpenFor;
    if (open === this.gateOpen) return;
    this.gateOpen = open;
    for (const [x, y, z] of this.part.coaster.gate) this.cells.want(x, y, z, open ? B.AIR : B.CANDY_STRIPE);
  }

  /* ---------------------------------------------- the board, the lights and the score chip ---------------------------------------------- */
  syncBlocks(force = false) {
    const st = ticketState(this.game), part = this.part;
    const board = st.have.join();
    if (force || board !== this.lit.board) {
      this.lit.board = board;
      part.board.forEach((s, k) => { for (let x = s.x0; x <= s.x1; x++) for (let y = s.y0; y <= s.y1; y++) this.cells.want(x, y, s.z, st.have[k] ? B.LAMP : B.MARQUEE); });
    }
    const lights = part.coaster.lights, on = this.awake ? lights.length : Math.ceil((lights.length * st.n) / TICKETS);
    if (force || on !== this.lit.lights) {
      this.lit.lights = on;
      lights.forEach(([x, y, z], i) => this.cells.want(x, y, z, i < on ? B.LAMP : B.MARQUEE));
    }
  }
  chip(pl) {
    const ui = this.game.ui;
    if (!ui?.setScore) return;
    if (!this.inZone(pl.pos)) { if (this.chipOn) { ui.setScore(null); this.chipOn = false; } return; }
    const st = ticketState(this.game), hard = this.hard;
    let text = `🎟️ ${st.n} / ${TICKETS}`, done = false;
    if (this.drive >= 0 && !st.have[0]) text = `🚗 ${this.popped.filter(Boolean).length} / ${BUMPER.pops}`;
    else if (this.riding && !st.have[2]) text = `💍 ${this.seat.caught.length} / ${ringList(hard).length}`;
    else if (!pl.carry && inRect({ x0: TRAMP.x0 - 1, x1: TRAMP.x1 + 1, z0: TRAMP.z0 - 1, z1: TRAMP.z1 + 1 }, pl.pos.x, pl.pos.z) && !st.have[1]) text = `🎈 ${this.airPopped.filter(Boolean).length} / ${hard ? TRAMP.hardPops : TRAMP.pops}`;
    else if (st.done) { text = 'Ride the coaster! 🎢'; done = true; }
    ui.setScore({ text, done });
    this.chipOn = true;
  }

  /* ---------------------------------------------- every frame ---------------------------------------------- */
  update(dt) { if (!this.manual) this.step(dt); }
  step(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    if (!this.paused()) {
      this.clock += dt;
      this.seat.hard = this.hard;
      if (this.drive >= 0) this.driveStep(dt);
      if (this.riding) this.ringStep(dt);
      this.rideStep(dt);
      this.gateStep();
      this.airStep();
      if (this.regrowAt != null && this.clock >= this.regrowAt) { this.regrowAt = null; this.popped.fill(false); this.pops = 0; }
      if (this.airRegrowAt != null && this.clock >= this.airRegrowAt) { this.airRegrowAt = null; this.airPopped = []; this.airPops = 0; }
      this.syncT += dt;
      if (this.syncT >= FAIR_RULES.syncEvery) { this.syncT = 0; this.syncBlocks(); }
      if (this.awake && this.inZone(p.pos)) { this.tuneT += dt; if (this.tuneT >= FAIR_RULES.tuneEvery) { this.tuneT = 0; sound.play('fairtune'); } }
      this.firstTime(p);
    }
    this.chip(p);
    this.draw();
    this.cells.flush();
  }
  firstTime(p) {
    if (!this.inZone(p.pos, 6)) return;
    this.once('hello', 'The Funfair! Win 3 golden tickets at the games. 🎟️');
  }

  /* ---------------------------------------------- drawing ---------------------------------------------- */
  draw(first = false) {
    const p = this.game.player, hard = this.hard, T = this.clock, bt = this.botT;
    const far = !!p && !this.inZone(p.pos, FAIR_RULES.sleepDist);
    const fleet = this.fleet.userData.parts, air = this.airMesh.userData.parts, car = this.carouselMesh.userData.parts;
    for (const o of [this.fleet, this.ringMesh, this.airMesh, this.coasterCar, this.slideMesh, this.confetti]) o.visible = !far;
    car.horses.visible = !far;
    // bumper cars: the six bays (your car moves), the bots' cars and heads and balloons
    for (let i = 0; i < BAYS.length; i++) {
      if (i === this.drive) fleet.car(i, this.car.x, 11, this.car.z, this.car.yaw, Math.sin(T * 40) * Math.min(0.06, this.car.speed * 0.01));
      else fleet.car(i, this.parked[i].x, 11, this.parked[i].z, this.parked[i].yaw);
    }
    BOTS.forEach((_, i) => {
      const b = botAt(i, bt, hard), wob = Math.sin(T * 32) * 0.14 * this.wob[i];
      fleet.car(6 + i, b.x, 11, b.z, b.yaw, wob);
      fleet.head(i, b.x, 11, b.z, b.yaw, wob);
      if (this.popped[i]) fleet.hideBalloon(i);
      else fleet.balloon(i, b.x - b.hx * 0.9, 12.1, b.z - b.hz * 0.9, 1 + 0.03 * Math.sin(T * 5 + i));
    });
    // the carousel, the rings, the trampoline balloons
    car.set(carouselAngle(T, hard), (k, lane) => horseBob(k, lane, T));
    this.ringMesh.userData.parts.set(this.seat.caught, this.seat.silver, T, hard);
    balloonList(true).forEach((_, i) => {
      if (i >= balloonList(hard).length || this.airPopped[i]) air.set(i, null, false);
      else air.set(i, balloonAt(i, T, hard), true, T * 0.3 + i);
    });
    // the coaster car (at the station, or wherever the ride is), the Ferris wheel, the confetti
    const cc = this.coasterCar, w = this.coaster ? this.coaster.where() : this.coasterPath.at(0);
    const ahead = this.coaster ? this.coasterPath.at(Math.min(this.coasterPath.time, this.coaster.clock + 0.15)) : this.coasterPath.at(0.4);
    const run = Math.hypot(ahead.x - w.x, ahead.z - w.z) || 1e-6, pitch = Math.atan2(ahead.y - w.y, run);
    cc.position.set(w.x, w.y, w.z);
    cc.rotation.set(-pitch, w.yaw + Math.PI, 0, 'YXZ');
    cc.rotation.order = 'YXZ';
    this.wheelMesh.userData.parts.set((T * TAU) / FAIR_RULES.wheelTurn, this.awake);
    const cam = this.game.camera;
    if (cam) this.confetti.userData.parts.update(T, cam);
  }

  /* ---------------------------------------------- for tests ---------------------------------------------- */
  info() {
    const st = ticketState(this.game);
    return {
      clock: this.clock, drive: this.drive, car: { x: this.car.x, z: this.car.z, vx: this.car.vx, vz: this.car.vz, speed: this.car.speed, t: this.car.t },
      pops: this.popped.filter(Boolean).length, popped: [...this.popped], airPops: this.airPopped.filter(Boolean).length, airPopped: [...this.airPopped],
      riding: this.riding, lane: this.seat.laneNow, laneTo: this.seat.to, spoke: this.spoke, rings: [...this.seat.caught], silver: [...this.seat.silver], hop: this.seat.hopHeight,
      coaster: this.coaster ? this.coaster.clock : null, slide: this.slide ? this.slide.clock : null, tickets: st.have, n: st.n, hard: this.hard, awake: this.awake,
      lit: { ...this.lit }, parked: this.parked.map(c => ({ ...c })), meshes: this.groups.length, told: [...this.told],
    };
  }
}
