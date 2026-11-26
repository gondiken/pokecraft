// Football and basketball for two friends in Playland's Ball Stadium (owner 2026-11-26), on the pitch and the court that are
// already there. A FriendGame (friendgames.js) that borrows the stadium's live part (stadiumlive.js `setMatch`): its ball,
// its Kick! / Shoot! holds, its drawing. While a match runs the keepers, Defender Dee and Blocker Bo step aside: you are your own
// keeper. ONE ball for both (sharedball.js): whoever touched it last owns it. The leader keeps the score; a goal or basket is
// called by the ball's owner and counted by the leader. Nothing is saved; the Captain's goals and baskets are not touched.
import * as THREE from 'three';
import { FriendGame, addFriendGame } from './friendgames.js';
import { SharedBall } from './sharedball.js';
import { MATCH, SPORTS, scorerOf, startSpot, MatchScore } from './matchrules.js';
import { touchKick, canBoot, boot, HOLD, kickZone, kickPower, shotWindow, shotMiss } from './ballphysics.js';
import { BALL_R } from './stadium.js';
import { sound } from './sound.js';

function sign(text, colour) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = colour; g.fillRect(8, 16, 496, 96);
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(8, 16, 496, 96);
  g.fillStyle = '#fff'; g.font = 'bold 60px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: 0.92 }));
  s.scale.set(6, 1.5, 1);
  s.renderOrder = 9;
  s.userData.matchSign = true;
  return s;
}

export class BallMatch extends FriendGame {
  constructor(game, session, sport) {
    super(game, session);
    this.sport = sport;
    this.key = sport.key;
    this.sc = new MatchScore(sport.to);
    this.phase = 'wait'; this.kickN = 0; this.has = 1;
    this.readyT = 0; this.goalT = 0; this.claim = null; this.outAt = null; this.wild = false; this.prevY = 0;
    this.signs = [];
  }
  get live() { return this.game.gymLive.of('part:stadium'); }
  get side() { return this.leader ? 0 : 1; }
  sideName(side) { return side === this.side ? this.myName : this.partnerName; }
  scoreLine() { const a = this.leader ? this.me : this.partner, s = this.sc.score; return `${this.nameOf(a)} ${s[0]} · ${this.nameOf(this.s.partner === a ? this.me : this.partner)} ${s[1]}`; }

  /* ---- the start, kick-offs, the end ---- */
  setup() { return { has: 1 }; }
  start(data) {
    const live = this.live;
    if (!live) { this.finish('The stadium is not here!'); return; }
    this.part = live.part;
    this.ball = live[this.key];
    this.box = this.sport.box(this.part);
    this.shared = new SharedBall(this.ball, this.me, this.leader ? this.me : this.partner);
    live.setMatch(this);
    const mine = scorerOf(0) === this.side ? 0 : 1; // the goal / hoop I score in
    for (const [i, text, colour] of [[mine, `${this.sport.icon} Score here!`, '#2a9a3a'], [1 - mine, `🛡️ Your ${this.sport.thing}`, '#2a5ad8']]) {
      const s = sign(text, colour), t = this.sport.target(this.part, i);
      s.position.set(t.x, t.y, t.z);
      if (this.key === 'foot') { s.scale.set(10, 2.5, 1); s.position.y += 0.6; } // the pitch is long: a sign you can read from the other half
      this.game.scene?.add(s); this.signs.push(s);
    }
    this.goalAt = this.sport.target(this.part, mine);
    this.toast(`${this.sport.name} with ${this.partnerName}! First to ${this.sport.to} wins. ${this.sport.icon} Score under the green sign!`);
    this.kickOff(1, data.has ?? 1);
  }
  // Both sides: everybody to their spot, the ball to its spot, a short "get ready".
  kickOff(n, has) {
    const live = this.live, p = this.game.player, sp = startSpot(this.sport, this.part, this.side, has);
    this.kickN = n; this.sc.n = n; this.has = has;
    live.held = null;
    this.ball.spot = [...this.sport.ballAt(this.part, has)];
    this.shared.kickOff(n);
    this.ball.spot = [...this.sport.centre(this.part)]; // an "out" goes back to the middle
    p.carry?.leave?.();
    p.pos.set(sp[0], sp[1], sp[2]); p.vel.set(0, 0, 0); p.yaw = sp[3]; p.pitch = 0;
    this.phase = 'ready'; this.readyT = MATCH.ready;
    this.claim = null; this.outAt = null; this.wild = false; this.prevY = this.ball.pos.y;
    this.toast(has === this.side ? 'Your ball! Get ready...' : `${this.partnerName}'s ball! Get ready...`);
  }
  // Leader: a goal for `side`.
  goal(side) {
    this.sc.add(side);
    this.say({ k: 'goal', by: side, score: this.sc.score, n: this.kickN });
    this.showGoal(side);
  }
  showGoal(side) {
    this.letGo(); // (a Kick! or Shoot! still held)
    this.phase = 'goal'; this.goalT = MATCH.goalPause; this.claim = null; this.scoredBy = side;
    sound.play(this.sport.cheer);
    this.toast(`${this.sport.shout} ${this.sideName(side)} scores! ${this.sport.icon} ${this.scoreLine()}`);
  }
  over(win) {
    if (win === this.side) sound.play('win');
    this.finish(`${this.sideName(win)} wins ${this.sc.score[win]} : ${this.sc.score[1 - win]}! 🏆 Good game!`);
  }
  end() {
    for (const s of this.signs) { s.parent?.remove(s); s.material.map.dispose(); s.material.dispose(); }
    this.signs = [];
    const live = this.live;
    if (live?.match === this) live.setMatch(null);
  }

  /* ---- messages ---- */
  message(p) {
    const sh = this.shared;
    if (!sh) return;
    if (p.k === 'ball') {
      if (this.phase !== 'play' && this.phase !== 'ready') return;
      const r = sh.apply(p.b);
      if (!r) return;
      if (r.changed) { this.claim = null; this.outAt = null; this.wild = false; if (this.live.held) this.live.held = null; }
      if (r.note === 'out') this.toast('Out! The ball is back in the middle.');
    } else if (p.k === 'claim' && this.leader) {
      if (this.phase === 'play' && p.q === sh.q && !sh.mine && (p.into === 0 || p.into === 1)) this.goal(scorerOf(p.into));
    } else if (p.k === 'goal' && !this.leader) {
      this.sc.load(p.score, p.n);
      this.showGoal(p.by);
    } else if (p.k === 'kick' && !this.leader) {
      this.sc.load(p.score, p.n);
      this.kickOff(p.n, p.has);
    } else if (p.k === 'over' && !this.leader) {
      this.sc.load(p.score);
      this.over(p.win);
    }
  }
  beat() { return { n: this.kickN, has: this.has, score: this.sc.score, ph: this.phase }; }
  heard(d) { // a lost kick-off or goal heals
    if (!this.shared) return;
    this.sc.load(d.score);
    if (Number.isInteger(d.n) && d.n > this.kickN) this.kickOff(d.n, d.has);
  }
  tick() {
    const c = this.claim;
    if (c && !this.leader && this.phase === 'play') this.say({ k: 'claim', q: c.q, into: c.into });
  }

  /* ---- real-time clocks (every frame, also while the stadium's own clock stands still) ---- */
  update(dt) {
    if (!this.shared) return;
    if (this.phase === 'ready') {
      this.readyT -= dt;
      if (this.readyT <= 0) { this.phase = 'play'; sound.play('whistle'); this.toast('Go!'); }
    } else if (this.phase === 'goal' && this.leader) {
      this.goalT -= dt;
      if (this.goalT > 0) return;
      const win = this.sc.winner;
      if (win != null) { this.say({ k: 'over', score: this.sc.score, win }); this.over(win); return; }
      const n = this.kickN + 1, has = 1 - this.scoredBy;
      this.say({ k: 'kick', n, has, score: this.sc.score });
      this.kickOff(n, has);
    }
  }

  /* ---- the ball (StadiumLive.update hands its frame over while a match runs) ---- */
  frame(dt) {
    const live = this.live, ball = this.ball, sh = this.shared;
    if (!sh) return;
    if (live.frozen()) { if (live.held) this.letGo(); live.drawAll(); this.draw(); return; }
    live.t += dt;
    sh.tick(dt);
    const pl = live.playerBox();
    if (this.phase === 'play') {
      this.updateHold();
      if (live.held?.key === 'hoop') live.carry(ball);                     // the basketball is in my hands
      else if (sh.held && !sh.mine) this.inTheirHands();                    // or in theirs
      else {
        this.prevY = ball.pos.y;
        const touch = touchKick(ball, pl);
        if (touch) { sh.take(); this.wild = false; this.outAt = null; if (touch === 'kick') live.noise(ball, 'ballkick'); }
        ball.update(dt);
        for (const ev of ball.events) if (ev.speed > 3) live.noise(ball, 'ballkick');
        if (sh.mine) this.referee();
      }
      const m = sh.outgoing();
      if (m) this.say({ k: 'ball', b: m });
    } else if (this.phase === 'goal') ball.update(dt);
    live.drawAll();
    this.draw();
  }
  // The owner's eyes: a goal or a basket, over the bar, out.
  referee() {
    const live = this.live, ball = this.ball, sh = this.shared, part = this.part, p = ball.pos, b = this.box;
    if (this.claim) { if (live.t - this.claim.at > MATCH.claimFor) this.claim = null; return; }
    const over = this.wild && part.goals.some(gl => (gl.side < 0 ? p.x < gl.line - BALL_R : p.x > gl.line + BALL_R));
    if (!over) {
      const i = this.sport.scored(part, ball, this.prevY);
      if (i >= 0) {
        if (this.leader) this.goal(scorerOf(i));
        else { this.claim = { q: sh.q, into: i, at: live.t }; this.say({ k: 'claim', q: sh.q, into: i }); }
        return;
      }
    }
    const out = over || p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.z1 || (ball.onGround && ball.restFor >= MATCH.highFor && p.y > MATCH.highY);
    if (!out) { this.outAt = null; return; }
    if (this.outAt == null) { this.outAt = live.t; this.toast(over ? 'Too much power! It flew over the bar.' : 'Out! The ball goes back to the middle.'); return; }
    if (live.t - this.outAt < MATCH.outPause) return;
    ball.reset(); sh.take('out');
    this.outAt = null; this.wild = false;
  }
  inTheirHands() {
    const a = this.avatar(), b = this.ball;
    if (!a) return;
    b.pos.x = a.pos.x; b.pos.y = a.pos.y + 2.05; b.pos.z = a.pos.z;
    b.vel.x = b.vel.y = b.vel.z = 0; b.restFor = 0; b.onGround = false;
  }
  draw() {
    const m = this.live.meshes[this.key], o = this.shared.off;
    m.position.x += o.x; m.position.y += o.y; m.position.z += o.z;
  }

  /* ---- Kick! and Shoot!, held and let go like in the stadium's own game (the first, easiest stage; no helpers) ---- */
  can(pl) { const sh = this.shared; return this.phase === 'play' && !this.claim && !(sh.held && !sh.mine) && canBoot(this.ball, pl); }
  near(p) { const live = this.live; return live.frozen() ? null : live.held || this.can(live.playerBox(p)) ? this.sport.word : null; }
  holds(p) { const live = this.live; return !live.frozen() && (!!live.held || this.can(live.playerBox(p))); }
  press(p) {
    const live = this.live, sh = this.shared;
    if (live.frozen()) return false;
    if (live.held) return true; // a key repeat
    if (!this.can(live.playerBox(p))) return false;
    live.held = { key: this.key, t0: live.t };
    const told = this.game.toldOnce, hint = this.key === 'foot' ? 'kickring' : 'shootjump';
    if (told && !told.has(hint)) { told.add(hint); this.toast(this.key === 'foot' ? 'Let go when the ring is green! Too long and it flies over the bar.' : 'Let go at the top of your jump, when the ball shines!'); }
    if (this.key === 'hoop') {
      const pl = this.game.player, g = 28 * (this.game.world.gravity ?? 1);
      if (pl.onGround) { pl.vel.y = HOLD.hoop.jump; pl.onGround = false; }
      live.held.apex = live.t + Math.max(-1, pl.vel.y / g);
      sh.held = true; sh.take();
      live.carry(this.ball);
    }
    return true;
  }
  release(p = this.game.player) {
    const live = this.live, sh = this.shared, h = live.held, ball = this.ball;
    if (!h) return false;
    if (live.frozen() || this.phase !== 'play') { this.letGo(); return true; }
    live.held = null;
    const pl = live.playerBox(p), f = [-Math.sin(pl.yaw), -Math.cos(pl.yaw)];
    if (this.key === 'foot') {
      if (!canBoot(ball, pl)) return true; // it rolled away, or they got it
      const v = kickPower(Math.min(HOLD.foot.max, live.t - h.t0) / HOLD.foot.fill, ball.pos, f, live.zoneNow(), this.part.goals.map(gl => ({ x: gl.line })));
      boot(ball, v);
      this.wild = v.kind === 'over';
    } else {
      const err = live.t - h.apex, d = live.hoopDist(f);
      boot(ball, live.shoot(f, d == null ? 0 : shotMiss(err, live.windowNow(d))));
      sh.held = false;
    }
    sh.take();
    this.outAt = null;
    live.noise(ball, 'ballkick');
    return true;
  }
  // A hold that ends without a kick or a shot (a question opened, a goal was called): the basketball just drops.
  letGo() {
    const live = this.live, sh = this.shared;
    if (!live.held) return;
    live.held = null;
    if (this.key === 'hoop' && sh.mine && sh.held) { sh.held = false; sh.take(); }
  }
  updateHold() {
    const live = this.live, h = live.held;
    if (!h) return;
    if (this.key === 'foot' && live.t - h.t0 >= HOLD.foot.max) this.release();
    else if (this.key === 'hoop' && this.game.player.onGround && live.t > h.apex + HOLD.hoop.late) this.release();
  }
  // The stadium's own tables at their first stage: the widest green, the longest good moment.
  zoneNow() { return kickZone(0, false); }
  windowNow(d) { return shotWindow(0, d, false); }

  /* ---- the rest of a FriendGame ---- */
  // Nobody walks at "get ready", nobody leaves the pitch / the court.
  fence(pos, before, vel) {
    if (!this.shared) return;
    if (this.phase === 'ready') { pos.x = before.x; pos.z = before.z; vel.x = vel.z = 0; return; }
    const b = this.box, m = MATCH.edge;
    if (pos.x < b.x0 + m || pos.x > b.x1 - m) { pos.x = before.x; vel.x = 0; }
    if (pos.z < b.z0 + m || pos.z > b.z1 - m) { pos.z = before.z; vel.z = 0; }
  }
  aim() {
    const t = this.goalAt;
    return t ? { x: t.x, z: t.z, text: (a, m) => `${this.sport.icon} Score there! ${a} ${m}m` } : null;
  }
  chip() {
    const phase = this.phase === 'ready' ? 'Get ready...' : this.phase === 'goal' ? this.sport.shout : `First to ${this.sport.to} wins`;
    return { score: `${this.sport.icon} ${this.scoreLine()}`, phase };
  }
  get noRide() { return 'No riding in a match!'; }
  info() {
    const sh = this.shared, b = this.ball;
    return { sport: this.sport.name, phase: this.phase, score: [...this.sc.score], kickN: this.kickN, has: this.has, side: this.side, wild: this.wild, claim: !!this.claim,
      ball: b ? { x: b.pos.x, y: b.pos.y, z: b.pos.z, vx: b.vel.x, vy: b.vel.y, vz: b.vel.z } : null, q: sh?.q, mine: sh?.mine, held: sh?.held, signs: this.signs.length };
  }
}

const stadium = game => game.gymLive?.of('part:stadium');
for (const id of ['football', 'hoops']) {
  const sport = SPORTS[id];
  addFriendGame({
    id, icon: sport.icon, name: sport.name, sub: `First to ${sport.to}, in the Ball Stadium.`,
    ask: name => `${name} wants to play ${sport.name.toLowerCase()} with you! First to ${sport.to} wins.`,
    shown: game => !!stadium(game),
    whyNot: game => (stadium(game)?.match ? 'Finish your match first!' : ''),
    make: (game, s) => new BallMatch(game, s, sport),
  });
}
