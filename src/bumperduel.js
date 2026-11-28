// Bumper Cars for two friends in Playland's Funfair (owner 2026-11-28): a FriendGame (friendgames.js) on the Funfair's bumper
// arena (funfairlive.js `startDuel`). A balloon rides on the BACK of each friend's car; bump it from behind, closing fast (the same
// rule as the bots' balloons), to pop it; first to 3. The six bumper bots drive on as moving obstacles with no balloons.
// Each browser drives its OWN car and sends its state a few times a second (and at once after a bump); the friend's car is drawn
// from those states (bumperrules.js SeenCar) and is a solid moving car for mine. The bots are closed forms of one clock both share
// (the friend's clock is pulled to the leader's with a ping / pong). A pop is claimed by the bumper's browser and counted by the
// leader (DuelScore); the heartbeat carries the score, so a lost message heals. Nothing is saved; the golden tickets and your own
// Bumper Cars rounds are not touched.
import * as THREE from 'three';
import { FriendGame, addFriendGame } from './friendgames.js';
import { BAYS } from './fairgames.js';
import { DUEL_BUMP, DuelCar, SeenCar, DuelScore, botsAt, balloonOfCar, clockOffset } from './bumperrules.js';
import { sound } from './sound.js';

const COLOURS = [0x4aa8ff, 0x6ad86a]; // the leader's car and balloon (bay 1's colour), the friend's (bay 4's)

function buildBalloon(colour) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: colour, emissive: 0x303030 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mat);
  ball.scale.set(0.9, 1.1, 0.9); ball.position.y = 0.9 + 0.525;
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.9, 0.025), new THREE.MeshLambertMaterial({ color: 0xbbbbbb }));
  stick.position.y = 0.45;
  g.add(ball, stick);
  g.userData.bumperBalloon = true;
  g.userData.dispose = () => { ball.geometry.dispose(); mat.dispose(); stick.geometry.dispose(); stick.material.dispose(); };
  return g;
}

export class BumperDuel extends FriendGame {
  constructor(game, session) {
    super(game, session);
    this.manual = false; // tests set it and call step(dt) themselves
    this.result = undefined; this.pops = 0; this.claimN = 0;
  }
  get live() { return this.game.gymLive?.of('part:fair'); }
  get side() { return this.leader ? 0 : 1; }
  sideName(side) { return side === this.side ? this.myName : this.partnerName; }
  get T() { return this.car?.T ?? -DUEL_BUMP.count; }
  scoreLine() { const s = this.score.score; return `${this.sideName(0)} ${s[0]} · ${this.sideName(1)} ${s[1]}`; }

  setup() { return { bays: DUEL_BUMP.bays }; }
  start(data) {
    const live = this.live;
    if (!live) { this.finish('The bumper cars are not here!'); return; }
    const bays = Array.isArray(data?.bays) && data.bays.every(i => BAYS[i]) ? data.bays : DUEL_BUMP.bays;
    this.bays = [bays[this.side], bays[1 - this.side]];
    const mine = BAYS[this.bays[0]], theirs = BAYS[this.bays[1]];
    this.car = new DuelCar(mine);
    this.seen = new SeenCar(theirs.x, theirs.z, theirs.yaw);
    this.score = new DuelScore();
    this.wish = { x: 0, z: 0 }; this.steered = false; this.spaceHeld = true;
    this.stepAt = performance.now();
    this.sendT = 0; this.hitSendAt = -9; this.hitAt = -9; this.honkAt = -9; this.endT = null;
    this.claim = null; this.pingT = 0; this.bestRtt = Infinity; this.skew = 0; this.syncs = 0;
    this.counted = Math.max(0, Math.ceil(-this.T)); this.hits = 0; this.friendHits = 0;
    const me = this, p = this.game.player;
    this.carry = {
      where: () => ({ x: me.car.car.x, y: 11.45, z: me.car.car.z }),
      wantsLeave: () => false,
      leave() { if (p.carry === this) p.carry = null; },
      steer(wx, wz, analog, space) { me.wish = { x: wx * analog, z: wz * analog }; me.steered = true; if (space && !me.spaceHeld) me.honk(); me.spaceHeld = !!space; },
      safe: () => ({ x: me.car.car.x, y: 11, z: me.car.car.z }),
    };
    this.game.riding?.stop?.('quiet');
    if (p.carry && p.carry !== this.carry) p.carry.leave?.();
    p.carry = this.carry; p.vel.set(0, 0, 0);
    p.pos.set(mine.x, 11.45, mine.z); p.yaw = Math.PI / 2; p.pitch = -0.15; // (facing in: west)
    this.bots = botsAt(this.T);
    live.startDuel({
      carry: this.carry, bays: this.bays,
      me: () => ({ x: me.car.car.x, z: me.car.car.z, yaw: me.car.car.yaw, speed: me.car.car.speed }),
      friend: () => ({ ...me.seen.pos, yaw: me.seen.m.yaw }),
      bot: i => me.bots[i],
      near: () => 'Honk!',
      use: () => { me.honk(); return true; },
    });
    this.balloons = COLOURS.map(c => { const b = buildBalloon(c); this.game.scene?.add(b); return b; });
    this.toast(`🚗 Bumper Cars with ${this.partnerName}! Bump the balloon on the BACK of ${this.partnerName}'s car. First to ${DUEL_BUMP.to}!`);
    this.drawAll();
  }
  honk() { const t = performance.now(); if (t - this.honkAt < 250) return; this.honkAt = t; sound.play('honkhonk'); }

  /* ---- every frame (real seconds) ---- */
  update(dt) { if (!this.manual) this.step(dt); }
  step(dt) {
    if (!this.car) return;
    dt = Math.min(dt, 3);
    const wish = this.steered && this.result === undefined ? this.wish : { x: 0, z: 0 };
    this.steered = false;
    // the friend's clock eases to the leader's
    if (this.skew) { const k = Math.abs(this.skew) > DUEL_BUMP.skewSnap ? 1 : Math.min(1, dt * DUEL_BUMP.skewRate), d = this.skew * k; this.car.T += d; this.skew -= d; if (Math.abs(this.skew) < 1e-4) this.skew = 0; }
    const T0 = this.T, sc = this.score, other = 1 - this.side;
    const poppable = this.result === undefined && !sc.safe(T0) && !sc.hidden(other, T0);
    const parked = BAYS.map((b, i) => (this.bays.includes(i) ? null : this.live?.parked[i] ?? b)).filter(Boolean);
    const ev = this.car.step(dt, { wish, friend: this.seen, poppable, parked });
    this.stepAt = performance.now();
    this.bots = botsAt(this.T);
    let hit = false;
    for (const e of ev) {
      if (e.type === 'pop' && e.mover === 'friend') this.claimPop(e.T);
      else if (e.type === 'hit') { hit = true; if (e.kind === 'friend') this.friendHits++; this.hits++; }
    }
    const t = performance.now();
    if (hit && t - this.hitAt > 200) { this.hitAt = t; sound.play('boing'); }
    this.countdown();
    // my car's state to the friend
    this.sendT -= dt;
    if (this.sendT <= 0 || (hit && t - this.hitSendAt > DUEL_BUMP.sendHit * 1000)) { this.sendT = DUEL_BUMP.send; this.hitSendAt = t; this.say({ k: 'c', ...this.car.state() }); }
    if (!this.leader) { this.pingT -= dt; if (this.pingT <= 0) { this.pingT = this.syncs < 3 ? 0.5 : DUEL_BUMP.ping; this.say({ k: 'ping', a: t }); } }
    if (this.claim && t - this.claim.at > DUEL_BUMP.claimFor * 1000) this.claim = null;
    const p = this.game.player;
    if (p.carry === this.carry) { const w = this.carry.where(); p.pos.set(w.x, w.y, w.z); }
    this.drawAll();
    if (this.endT != null) {
      this.endT -= dt;
      if (this.endT <= 0) { this.endT = null; this.finish(this.result === this.side ? 'You won Bumper Cars! Good game!' : 'Good game! Try again?'); }
    }
  }
  countdown() {
    const n = Math.max(0, Math.ceil(-this.T)); // 3, 2, 1, then 0 = Go
    if (n >= this.counted) return;
    this.counted = n;
    if (n > 0) { sound.play('racebeep'); this.toast(`${n}...`); } else { sound.play('racego'); this.toast(`Go! Bump ${this.partnerName}'s balloon!`); }
  }

  /* ---- pops: the bumper claims, the leader counts ---- */
  claimPop(T) {
    if (this.result !== undefined) return;
    const t = performance.now();
    if (this.claim && this.claim.n === this.score.n && t - this.claim.at < DUEL_BUMP.claimFor * 1000) return; // (asked already)
    if (this.leader) { if (this.score.claim(this.side, T)) this.counted0(); return; }
    this.claim = { n: this.score.n, at: t };
    this.say({ k: 'claim', n: this.score.n, T });
  }
  counted0() { // leader: a pop was counted: both are told
    this.announce();
    this.say({ k: 'pop', st: this.score.state() });
    const w = this.score.winner;
    if (w != null) this.call(w);
  }
  announce() {
    const sc = this.score;
    if (sc.n === this.pops) return;
    this.pops = sc.n; this.claim = null;
    const by = sc.by, at = by === this.side ? this.seen.pos : { x: this.car.car.x, z: this.car.car.z }, yaw = by === this.side ? this.seen.m.yaw : this.car.car.yaw, b = balloonOfCar(at.x, at.z, yaw);
    this.live?.confetti?.userData.parts.burst(b.x, 13.4, b.z, this.live.clock, 12);
    sound.play('balloonpop');
    this.toast(by === this.side ? `🎈 Pop! You got ${this.partnerName}'s balloon! ${this.scoreLine()}` : `🎈 Pop! ${this.partnerName} got your balloon! ${this.scoreLine()}`);
  }
  call(win) { this.say({ k: 'over', win, st: this.score.state() }); this.show(win); }
  show(win) {
    if (this.result !== undefined) return;
    this.result = win; this.endT = DUEL_BUMP.cheer;
    if (win === this.side) sound.play('win');
    this.toast(`🏆 ${this.sideName(win)} wins Bumper Cars! ${this.scoreLine()}`);
  }
  message(p) {
    if (!this.car) return;
    if (p.k === 'c') this.seen.hear(p, (performance.now() - this.stepAt) / 1000);
    else if (p.k === 'claim' && this.leader) {
      if (p.n === this.score.n && this.score.claim(1 - this.side, this.T)) this.counted0(); // (the grace on the leader's clock)
      else this.say({ k: 'pop', st: this.score.state() }); // (not counted: the friend may claim again)
    } else if (p.k === 'pop' && !this.leader) {
      if (this.score.load(p.st)) this.announce();
      this.claim = null;
    } else if (p.k === 'ping' && this.leader) this.say({ k: 'pong', a: p.a, T: this.T });
    else if (p.k === 'pong' && !this.leader) {
      const t = performance.now(), rtt = (t - p.a) / 1000;
      if (!Number.isFinite(rtt) || !Number.isFinite(p.T) || rtt < 0 || rtt > 3) return;
      if (rtt <= this.bestRtt * 1.5 + 0.02) { this.bestRtt = Math.min(this.bestRtt, rtt); this.skew = clockOffset(p.a / 1000, p.T, t / 1000, this.T); this.syncs++; }
    } else if (p.k === 'over' && !this.leader) { if (this.score.load(p.st)) this.announce(); this.show(p.win === 0 || p.win === 1 ? p.win : null); }
  }
  beat() { return { st: this.score?.state(), win: this.result ?? null }; }
  farewell() { return this.leader && this.result !== undefined ? { k: 'over', win: this.result, st: this.score.state() } : null; }
  heard(d) {
    if (!this.score) return;
    if (this.score.load(d.st)) this.announce();
    if (d.win === 0 || d.win === 1) this.show(d.win);
  }

  /* ---- drawing: the balloons on the backs, the friend sitting in their car ---- */
  drawAll() {
    const sc = this.score, T = this.T, safe = sc.safe(T) && sc.n > 0, blink = safe && Math.floor(T * 6) % 2 === 0;
    const cars = [{ x: this.car.car.x, z: this.car.car.z, yaw: this.car.car.yaw }, { ...this.seen.pos, yaw: this.seen.m.yaw }]; // [mine, theirs]
    cars.forEach((c, k) => {
      const side = k === 0 ? this.side : 1 - this.side, b = this.balloons?.[side];
      if (!b) return;
      const b0 = balloonOfCar(c.x, c.z, c.yaw);
      b.position.set(b0.x, 12.1, b0.z);
      b.visible = !sc.hidden(side, T) && !blink;
    });
    const a = this.avatar();
    if (a?.model && this.seen.heard) { const s = this.seen.pos; a.model.position.x = s.x; a.model.position.z = s.z; a.model.rotation.y = this.seen.m.yaw; }
  }

  end() {
    const p = this.game.player, c = this.car?.car;
    this.live?.endDuel();
    if (p.carry === this.carry) p.carry = null;
    if (c && this.live) { // out beside the car, towards the middle of the arena
      const dx = 134.5 - c.x, dz = 153.5 - c.z, l = Math.hypot(dx, dz) || 1;
      p.pos.set(c.x + (dx / l) * 1.9, 11, c.z + (dz / l) * 1.9); p.vel.set(0, 0, 0);
    }
    for (const b of this.balloons || []) { this.game.scene?.remove(b); b.userData.dispose?.(); }
    this.balloons = [];
  }
  aim() {
    if (!this.car || this.result !== undefined || this.T < 0) return null;
    const s = this.seen.pos, b = balloonOfCar(s.x, s.z, this.seen.m.yaw), back = { x: s.x + (b.x - s.x) * 2.4, z: s.z + (b.z - s.z) * 2.4 };
    return { x: back.x, z: back.z, text: (a, m) => `🎈 Bump ${this.partnerName}'s back! ${a} ${m}m` };
  }
  chip() {
    if (!this.score) return null;
    const phase = this.result !== undefined ? `${this.sideName(this.result)} wins!` : this.T < 0 ? 'Get ready...' : `Bump their back! First to ${DUEL_BUMP.to}`;
    return { score: `🎈 ${this.scoreLine()}`, phase };
  }
  get noRide() { return 'No riding in Bumper Cars. Drive your car!'; }
  info() {
    const c = this.car?.car;
    return { T: this.T, score: this.score ? [...this.score.score] : null, n: this.score?.n, result: this.result === undefined ? 'none' : this.result, side: this.side, bays: this.bays,
      car: c ? { x: c.x, z: c.z, vx: c.vx, vz: c.vz, yaw: c.yaw } : null, seen: this.seen ? { ...this.seen.pos, yaw: this.seen.m.yaw, heard: this.seen.heard, age: this.seen.age } : null,
      bot0: this.bots?.[0] ? { x: this.bots[0].x, z: this.bots[0].z } : null, claim: !!this.claim, syncs: this.syncs, rtt: this.bestRtt, hits: this.hits, friendHits: this.friendHits,
      carried: this.game.player.carry === this.carry, duel: !!this.live?.duel, balloons: (this.balloons || []).map(b => b.visible) };
  }
}

const fair = game => game.gymLive?.of('part:fair');
addFriendGame({
  id: 'bumper', icon: '🚗', name: 'Bumper Cars', sub: `Pop the balloon on your friend's back. First to ${DUEL_BUMP.to}.`,
  place: 'playland', arrive: 'fair', where: 'the Funfair', // asked for anywhere else: a trip there and back (friendgames.js)
  ask: name => `${name} wants to play bumper cars with you! Bump the balloon on the back of their car. First to ${DUEL_BUMP.to} wins.`,
  shown: game => !!fair(game),
  whyNot: game => (fair(game)?.duel ? 'Finish your game first!' : ''),
  make: (game, s) => new BumperDuel(game, s),
});
