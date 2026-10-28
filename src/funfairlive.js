// T43: the live part of the Funfair (LIVE.fair, made by gymLive.reset for the part in world.parts): three skill games, each gives a
// golden ticket, and the roller coaster to Merry Mae's Star Stage that opens with the three tickets.
//   Bumper Cars   drive a car that slides and bounces (momentum) and bump the balloon off the BACK of six bumper bots' cars
//   Balloon Bounce  bounce on the trampoline (the block flag `trampoline`, player.js): hold Jump to go higher, let go to come down, pop six balloons
//   Gold Ring Ride  ride the carousel, push the stick in or out to change horses, hop for the high rings, catch all ten gold rings
//   Coaster       a Mover on PATHS.coaster (closed form) from the station to the stage; Slide! (PATHS.helix) takes you back down
// None of them is hold-and-let-go. Owner 2026-10-27 "harder games": each game has three rounds that get harder (fairgames.js:
// BumperGame / BounceGame / Seat, pure and in fixed steps or closed forms); a missed round (time up, a lap without enough points) simply
// starts again, and after two misses the game slows down a little: never a fail. The tickets are saved at once as `beaten` keys
// (pw:fair:ticket1..3); everything else (the round, pops, rings caught) is per trip and in memory. Every clock is the sum of the game's clamped
// frame dt and stands still in a battle, a question, a panel and the pause screen, so a slow device slows the fair like it slows you.
// `manual = true` + step(dt) lets a spec drive it by hand. Meshes are in fairprops.js (about 14 draw calls in the zone).
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { Mover, PATHS } from './mover.js';
import { sound } from './sound.js';
import {
  BumperGame, BUMPER_ROUNDS, BAYS, BOTS, ARENA, BALLOON_STICK, TRAMP, BounceGame, BOUNCE_ROUNDS, CAROUSEL, Seat, RING_ROUNDS, omegaOf, carouselAngleOf, spokeAngle,
  horseBob, onCarousel, STAGE, STATION, SLIDE, COASTER, makeCoaster, makeHelix, registerFairPaths,
} from './fairgames.js';
import { buildBumperFleet, buildCarousel, buildRings, buildAirBalloons, buildCoasterCar, buildFerrisWheel, buildSlide, buildConfetti } from './fairprops.js';
import { ticketState, ticketKey, TICKETS } from './funfair.js';
import { FUN } from './forfun.js';

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
    // the three games (rounds, pops, rings: in memory for the trip)
    this.newGames();
    this.drive = -1;                                  // the bay of the car you drive, or -1
    this.parked = BAYS.map(b => ({ x: b.x, z: b.z, yaw: b.yaw }));
    this.wob = BOTS.map(() => 0);
    this.wish = { x: 0, z: 0 }; this.spaceHeld = true; this.honkAt = -9; this.hitAt = -9;
    this.trampN = game.player?.trampN ?? 0;
    this.riding = false; this.spoke = 0; this.spin = 0; this.missedAt = -9;
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
  // (new games: a fresh trip, or harder ones after the star)
  newGames() {
    const hard = this.hard;
    this.bump = new BumperGame(hard); this.car = this.bump.car;
    this.bounce = new BounceGame(hard);
    this.seat = new Seat(hard);
    this.gamesHard = hard;
  }
  get popped() { return this.bump.popped; }
  get pops() { return this.bump.pops; }
  get awake() { return this.game.stars.includes('fair'); }
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  toast(m) { this.game.ui?.toast(m); }
  once(key, text) { if (this.told.has(key)) return; this.told.add(key); this.toast(text); }
  inZone(pos, margin = 0) { const a = this.part.area; return pos.x >= a.x0 - margin && pos.x <= a.x1 + 1 + margin && pos.z >= a.z0 - margin && pos.z <= a.z1 + 1 + margin; }

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
    if (this.drive < 0 && !this.riding) this.newGames(); // (the next tries are the harder rematch games)
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
  // Bumper Cars: the game steps the bots always (1/120 s sub-steps), your car and the round clock only while you drive.
  driveStep(dt) {
    const driving = this.drive >= 0, car = this.car;
    const parked = this.parked.filter((_, i) => i !== this.drive);
    const ev = this.bump.update(dt, { driving, wish: this.wish, parked, home: this.parked[Math.max(0, this.drive)] });
    for (const e of ev) {
      if (e.type === 'pop') this.popBalloon(e.i, e.n, e.need);
      else if (e.type === 'bump' && e.kind === 'side') { this.once('side', 'Boing! Get behind it!'); this.wob[e.i] = 1; }
      else if (e.type === 'hit') { if (this.clock - this.hitAt > 0.2) { this.hitAt = this.clock; sound.play('boing'); } if (e.kind === 'bot') this.wob[e.i] = 1; }
      else if (e.type === 'zoom') { sound.play('botzoom'); this.once('zoom', 'Zoom! It saw you coming. Follow it, and bump it when it gets tired!'); }
      else if (e.type === 'round') this.roundToast('bump', e.round);
      else if (e.type === 'again') this.againToast('bump', e);
      else if (e.type === 'done') this.gameDone(1, 'Bumper Cars');
      else if (e.type === 'exit' && this.drive >= 0) { this.getOut({ x: ARENA.x1 + 2.2, z: car.z }); } // out through the gate: the car stays just inside
    }
    for (let i = 0; i < this.wob.length; i++) this.wob[i] = Math.max(0, this.wob[i] - dt * 2);
    const p = this.game.player;
    if (p.carry === this.carObj) { const w = this.carObj.where(); p.pos.set(w.x, w.y, w.z); }
  }
  popBalloon(i, n = this.bump.pops, need = this.bump.need) {
    const b = this.bump.fleet.at(i), at = { x: b.x - b.hx * BALLOON_STICK.back, y: BALLOON_STICK.y, z: b.z - b.hz * BALLOON_STICK.back };
    this.confetti.userData.parts.burst(at.x, at.y, at.z, this.clock, 10);
    sound.play('balloonpop');
    this.toast(`🎈 Pop! ${n} / ${need}`);
  }
  // the words between rounds (all three games)
  roundToast(game, round) {
    sound.play('fairround');
    const words = {
      bump: ['', 'Round 2: Zoomers! They zoom off when they see you. Bump them when they get tired!', 'Round 3: Spinners turn to look at you! Line up behind and come in fast!'],
      bounce: ['', 'Round 2: Wobbly balloons! Star balloons only pop when you land on top of them!', 'Round 3: Combo! Pop one on every bounce: x2, x3! Get 30 points!'],
      ring: ['', 'Round 2: Faster! Hop for the high gold rings!', 'Round 3: Gold rush! Swap and hop quickly!'],
    }[game];
    this.toast(`🎉 ${words[round] || 'Next round!'}`);
  }
  againToast(game, e) {
    sound.play('fairagain');
    const n = e.round + 1, what = game === 'ring' ? `You got ${e.score} of ${e.need} points` : game === 'bounce' ? 'Time is up' : 'Time is up';
    this.toast(`${what}! Round ${n} again. You can do it!${e.help ? ' (A bit slower now.)' : ''}`);
  }
  gameDone(ticket, name) {
    if (!this.game.beaten.includes(ticketKey(ticket))) this.award(ticket);
    else { sound.play('fairround'); this.toast(`🎉 You beat all 3 rounds of ${name} again! ${FUN.tag}`); } // (owner 2026-10-28: no new ticket)
  }

  /* ---------------------------------------------- Balloon Bounce ---------------------------------------------- */
  // The round clock runs only while you are on (or above) the trampoline; a launch of the trampoline (player.trampN) is a landing.
  airStep(dt) {
    const p = this.game.player, T = TRAMP;
    const n = p.trampN ?? 0, landed = n !== this.trampN; this.trampN = n;
    const active = !p.carry && p.pos.y >= 11 && p.pos.x >= T.x0 - 0.5 && p.pos.x <= T.x1 + 1.5 && p.pos.z >= T.z0 - 0.5 && p.pos.z <= T.z1 + 1.5;
    if (active && p.onGround && this.world.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z)) === B.TRAMPOLINE) this.once('tramp', 'Hold Jump to bounce higher. Let go to come down. Pop all 5 balloons!');
    if (active && p.pos.y > 16) this.once('steer', 'Steer in the air!');
    const ev = this.bounce.update(dt, { pos: p.pos, vy: p.vel.y, landed, active });
    for (const e of ev) {
      if (e.type === 'pop') {
        this.confetti.userData.parts.burst(e.at.x, e.at.y, e.at.z, this.clock, e.gold ? 16 : 10);
        sound.play('balloonpop');
        if (e.scored) { if (e.mult > 1) sound.play('faircombo'); this.toast(`🎈 +${e.pts}${e.mult > 1 ? ` (combo x${e.mult}!)` : ''}  ⭐ ${Math.min(e.n, e.need)} / ${e.need}`); }
        else this.toast(`🎈 Pop! ${e.n} / ${e.need}`);
      } else if (e.type === 'boop') { sound.play('fairboop'); this.once('boop', 'Boop! Star balloons only pop when you land on top of them.'); }
      else if (e.type === 'chainEnd') this.once('chain', 'Combo over! Pop one on every bounce to keep it going.');
      else if (e.type === 'round') this.roundToast('bounce', e.round);
      else if (e.type === 'again') this.againToast('bounce', e);
      else if (e.type === 'done') this.gameDone(2, 'Balloon Bounce');
    }
  }

  /* ---------------------------------------------- Gold Ring Ride ---------------------------------------------- */
  boardCarousel() {
    const g = this.game, p = g.player, hard = this.hard;
    g.riding?.stop('quiet');
    const phi = carouselAngleOf(p.pos.x, p.pos.z);
    let best = 0, bd = 9;
    for (let k = 0; k < CAROUSEL.spokes; k++) { const d = Math.abs(wrap(spokeAngle(k, this.spin) - phi)); if (d < bd) { bd = d; best = k; } }
    this.spoke = best;
    this.seat.reset(this.spin, (best / CAROUSEL.spokes) * TAU, 2); // (the round stays; a new lap starts)
    this.seat.jumpHeld = !!p.keys?.Space;
    this.riding = true;
    p.carry = this.seatObj; p.vel.set(0, 0, 0);
    const w = this.seatObj.where(); p.pos.set(w.x, w.y, w.z);
    this.once('ride', 'Push the stick in or out to change horses. Jump for high rings! Catch enough points in one lap.');
  }
  getOff() {
    const p = this.game.player, at = this.seatObj.safe();
    this.riding = false;
    if (p.carry === this.seatObj) p.carry = null;
    p.pos.set(at.x, at.y, at.z); p.vel.set(0, 0, 0);
  }
  ringStep(dt) {
    const ev = this.seat.update(dt), parts = this.confetti.userData.parts, p = this.game.player, seat = this.seat;
    this.spin = seat.spin;
    const rings = RING_ROUNDS[ev.lap ? ev.lap.round : seat.round].rings;
    for (const c of ev.caught) {
      const r = rings[c.i], rad = CAROUSEL.lanes[r.lane], q = onCarousel(r.a, rad);
      parts.burst(q.x, r.high ? CAROUSEL.highY : CAROUSEL.ringY, q.z, this.clock, r.gold ? 10 : 5);
      sound.play('ringding');
      this.toast(`💍 +${c.pts}${r.gold ? ' gold!' : ''}  ${Math.min(c.score, c.need)} / ${c.need}`);
    }
    if (ev.missed.length && this.clock - this.missedAt > 8) { this.missedAt = this.clock; this.once('miss', 'Be in the ring\'s lane when it comes! Jump for the high ones.'); }
    if (ev.lap) {
      if (ev.lap.done) this.gameDone(3, 'the Gold Ring Ride');
      else if (ev.lap.won) this.roundToast('ring', ev.lap.next);
      else this.againToast('ring', { round: ev.lap.round, score: ev.lap.score, need: ev.lap.need, help: ev.lap.help });
    }
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
    if (!this.inZone(pl.pos)) { if (this.chipOn) { ui.setScore(null); this.chipOn = false; this.chipText = null; } return; }
    const st = ticketState(this.game);
    let text = `🎟️ ${st.n} / ${TICKETS}`, done = false;
    const T = TRAMP, onTramp = !pl.carry && pl.pos.x >= T.x0 - 1 && pl.pos.x <= T.x1 + 2 && pl.pos.z >= T.z0 - 1 && pl.pos.z <= T.z1 + 2;
    if (this.drive >= 0) { const g = this.bump; text = `🚗 Round ${g.round + 1}/3 · 🎈 ${g.pops} / ${g.need} · ⏱ ${Math.ceil(g.left)}`; }
    else if (this.riding) { const s = this.seat; text = `🎠 Round ${s.round + 1}/3 · 💍 ${s.score} / ${s.need} · lap ${Math.round(s.swept / TAU * 100)}%`; }
    else if (onTramp) { const g = this.bounce; text = g.scored ? `🎈 Round 3/3 · ⭐ ${g.score} / ${g.need} · x${g.mult} · ⏱ ${Math.ceil(g.left)}` : `🎈 Round ${g.round + 1}/3 · ${g.pops} / ${g.need} · ⏱ ${Math.ceil(g.left)}`; }
    else if (st.done) { text = 'Ride the coaster! 🎢'; done = true; }
    if (text !== this.chipText) { this.chipText = text; ui.setScore({ text, done }); } // (the DOM only on a change)
    this.chipOn = true;
  }
  /* ---------------------------------------------- every frame ---------------------------------------------- */
  update(dt) { if (!this.manual) this.step(dt); }
  step(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    if (!this.paused()) {
      this.clock += dt;
      if (this.gamesHard !== this.hard && this.drive < 0 && !this.riding) this.newGames();
      this.driveStep(dt);
      if (this.riding) this.ringStep(dt);
      else this.spin += omegaOf(this.seat.hard, this.seat.round, this.seat.help.slow) * dt; // (the carousel turns at the speed of your next round)
      this.rideStep(dt);
      this.gateStep();
      this.airStep(dt);
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
    const p = this.game.player, T = this.clock, fl = this.bump.fleet;
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
      const b = fl.at(i), tired = b.tired ? Math.sin(T * 9) * 0.06 : 0, wob = Math.sin(T * 32) * 0.14 * this.wob[i] + tired; // (a tired bot puffs and nods)
      fleet.car(6 + i, b.x, 11, b.z, b.yaw, wob);
      fleet.head(i, b.x, 11, b.z, b.yaw, wob);
      if (this.popped[i] || !fl.hasBalloon(i)) fleet.hideBalloon(i);
      else fleet.balloon(i, b.x - b.hx * 0.9, 12.1, b.z - b.hz * 0.9, (b.zooming ? 1.12 : 1) + 0.03 * Math.sin(T * 5 + i));
    });
    // the carousel, the rings, the trampoline balloons
    car.set(this.spin, (k, lane) => horseBob(k, lane, T));
    this.ringMesh.userData.parts.set(this.seat.rings, this.riding ? this.seat.caught : [], T);
    const bg = this.bounce, list = bg.spec.balloons;
    for (let i = 0; i < 8; i++) {
      if (i >= list.length || !bg.shown(i)) air.set(i, null, false, 0, list[i]);
      else air.set(i, bg.balloon(i), true, T * 0.3 + i, list[i]);
    }
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
      pops: this.bump.pops, popped: [...this.bump.popped], bump: { round: this.bump.round, need: this.bump.need, left: this.bump.left, misses: this.bump.misses, wins: this.bump.wins, slow: this.bump.help.slow },
      bounce: { round: this.bounce.round, need: this.bounce.need, got: this.bounce.got, score: this.bounce.score, pops: this.bounce.pops, mult: this.bounce.mult, left: this.bounce.left, misses: this.bounce.misses, wins: this.bounce.wins },
      airPops: this.bounce.pops, airPopped: [...this.bounce.popped],
      riding: this.riding, lane: this.seat.laneNow, laneTo: this.seat.to, spoke: this.spoke, rings: [...this.seat.caught], hop: this.seat.hopHeight,
      ring: { round: this.seat.round, score: this.seat.score, need: this.seat.need, misses: this.seat.misses, wins: this.seat.wins, omega: this.seat.omega, swept: this.seat.swept },
      coaster: this.coaster ? this.coaster.clock : null, slide: this.slide ? this.slide.clock : null, tickets: st.have, n: st.n, hard: this.hard, awake: this.awake,
      lit: { ...this.lit }, parked: this.parked.map(c => ({ ...c })), meshes: this.groups.length, told: [...this.told],
    };
  }
}
