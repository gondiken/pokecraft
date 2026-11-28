// Bounce-Back for two (owner 2026-11-28, plans/friend-games-next.md section 2): a game for two friends (friendgames.js) on the Mirror Palace's
// court. The friend takes Copycat Cleo's place at the far end with their own hand mirror; first to 3. The rules are bounceduelrules.js
// (`DuelCourt`, pure): each defends their whole end, the mirror slides on your rail and tilts the way you look, exactly as in the
// single-player game; both ends are open, no spinner. Each player sees the court from their own end (the far end's view, stick and tilt
// are the court turned half round), so both feel "my end is near".
//
// Sync (one ball on two computers):
//  - Both computers run the same court between messages. The ball's OWNER is whoever's mirror hit it last; its computer sends the ball's
//    state at once on the hit and every DUEL_PLAY.send s while it flies (a lost message heals).
//  - The DEFENDER decides. Only my own computer says whether MY mirror hit the ball: it sees my mirror exactly where I put it, so on my
//    screen the ball never goes through my mirror (and never bounces off a mirror I had already moved away). A hit makes it mine (the
//    ownership number `q` goes up); a miss is a point for the other side, which I claim. For the friend's mirror my court only guesses from
//    their last sent place (DUEL_PLAY.mirror s apart): it bounces back at once, and their real hit puts it right (a small glide, `off`).
//  - The LEADER counts: its own miss is a point at once; the friend's miss comes as `claim` (repeated until the point comes) -> `point`,
//    then after a pause `serve` toward the one who lost the point. The heartbeat carries the serve number, the side and the score, so a lost
//    point or serve heals within a second.
// Messages (`say`): m (my mirror: u, t in my own view), ball (q, b = [u, v, du, dv, s]), claim (n, q), point (by, score, n), serve (n, side =
// who it goes to, score), over (win, score). (Never a field `to`, `from` or `name`: multiplayer.js sendPlay puts its own there.) Nothing is saved; the Mirror Palace's own keys (court1..3) are never touched.
import { FriendGame, addFriendGame } from './friendgames.js';
import { DuelCourt, DUEL_RULES, courtU, tiltOf, facingOf } from './bounceduelrules.js';
import { COURT_RULES } from './bounceback.js';
import { MatchScore } from './matchrules.js';
import { G } from './mirrorland.js';
import { VIEW } from './mirrorlive.js';
import * as P from './mirrorprops.js';
import { disposeModel } from './species.js';
import { sound } from './sound.js';

export const DUEL_PLAY = { send: 0.4, mirror: 0.2, smooth: 0.15, snap: 4, pause: 1.6, nag: 4, drawRate: 10 };
const R = COURT_RULES;
const CX = 20, CZ = 117.5, G1 = G + 1; // the court: x = 20 + u, z = 117.5 - v (mirrorlive.js)
const courtXZ = (u, v) => [CX + u, CZ - v];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// where each side stands when the game is over (in front of the court, by the plate)
const AFTER = [[27.5, 120.6], [25.0, 120.6]];

export class BounceDuel extends FriendGame {
  get live() { return this.game.gymLive.of('part:mirror'); }
  get side() { return this.leader ? 0 : 1; }
  get other() { return 1 - this.side; }
  sideName(side) { return side === this.side ? this.myName : this.partnerName; }
  scoreLine() { const s = this.sc.score; return `${this.sideName(0)} ${s[0]} · ${this.sideName(1)} ${s[1]}`; }

  /* ---- the start and the end ---- */
  setup() { return { first: 1 }; } // the first serve goes to the friend who was asked
  start(data) {
    const live = this.live;
    if (!live) { this.finish('The Mirror Palace is not here!'); return; }
    this.court = new DuelCourt({ decides: this.side ? [false, true] : [true, false] });
    this.sc = new MatchScore(DUEL_RULES.need);
    this.phase = 'ready'; this.readyT = DUEL_RULES.ready; this.pointT = 0; this.to = data?.first === 0 ? 0 : 1;
    this.claim = null; this.slideIn = 0; this.input = null; this.spaceWas = true; this.nagAt = -99; this.t = 0;
    this.sendT = 0; this.mirrorT = 0; this.off = { u: 0, v: 0 }; this.theirs = { u: R.w / 2, t: 0 }; this.hits = 0; this.guesses = 0; this.applied = 0;
    live.setDuel(this);
    this.hideCrew();
    this.build();
    this.stance = this.makeStance();
    this.toStance();
    this.toast(`🏓 Bounce-Back with ${this.partnerName}! First to ${DUEL_RULES.need}. Keep the ball out of your end!`);
  }
  end() {
    const p = this.game.player;
    if (p && this.stance && p.carry === this.stance) {
      const [x, z] = AFTER[this.side];
      p.carry = null; p.pos.set(x, G1, z); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0;
    }
    this.showCrew();
    for (const o of this.meshes || []) { o.parent?.remove(o); if (o.userData.dispose) o.userData.dispose(); else disposeModel(o); }
    this.meshes = [];
    const live = this.live;
    if (live?.duel === this) live.setDuel(null);
  }
  // Copycat Cleo, Glazier Gwen and Lamplighter Lux step aside while two friends play
  hideCrew() {
    const n = this.game.npcs;
    this.crew = (n?.list || []).filter(c => c.kind === 'crew' && c.def?.boss === 'mirror' && !c.away).map(c => ({ c, pos: [c.pos.x, c.pos.y, c.pos.z], heading: c.homeHeading ?? c.heading }));
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
    this.ballMesh = add(P.buildShineBall(0.35)); this.ballMesh.visible = false;
    this.hand = add(P.buildHandMirror(0.45)); this.hand.visible = false;           // mine, in front of my eyes
    this.theirMirror = add(P.buildHandMirror(0.8)); this.theirMirror.scale.set(1.15, 0.62, 1); // theirs, at their end
    this.farRail = add(P.buildRail(R.rail[1] - R.rail[0] + 1.6)); this.farRail.position.set(CX + R.rail[0] - 0.8, G1, CZ - DUEL_RULES.lines[1]);
    this.drawU = R.w / 2;
  }

  /* ---- my stance at my end (a `carry`: the stick slides the mirror, the way I look tilts it, Jump does not step off) ---- */
  makeStance() {
    const me = this;
    return {
      where: () => { const [x, z] = courtXZ(courtU(me.side, me.court.m[me.side]), DUEL_RULES.lines[me.side]); return { x, y: G1, z }; },
      steer(wx, wz, analog) { const p = me.game.player, c = Math.cos(p.yaw), s = Math.sin(p.yaw); me.slideIn = clamp((wx * c - wz * s) * analog, -1, 1); },
      look(dx, dy) {
        const p = me.game.player, f = facingOf(me.side, p.yaw - dx * 0.0022);
        p.yaw = (me.side ? Math.PI : 0) + clamp(f, -VIEW.yaw, VIEW.yaw);
        p.pitch = clamp(p.pitch - dy * 0.0022, VIEW.pitchMin, VIEW.pitchMax);
        return true;
      },
      wantsLeave(space) {
        const fresh = !!space && !me.spaceWas; me.spaceWas = !!space;
        if (fresh && me.t - me.nagAt > DUEL_PLAY.nag) { me.nagAt = me.t; me.toast('To stop the game, press Stop in the pause menu.'); }
        return false;
      },
      leave() {},
      jumpWord: () => null,
      safe: () => { const [x, z] = AFTER[me.side]; return { x, y: G1, z }; },
    };
  }
  toStance() {
    const p = this.game.player;
    this.game.riding?.stop?.('quiet');
    p.carry = this.stance; p.vel.set(0, 0, 0); p.keys = {};
    const w = this.stance.where(); p.pos.set(w.x, w.y, w.z);
    p.yaw = this.side ? Math.PI : 0; p.pitch = -0.2;
  }

  /* ---- points and serves ---- */
  // Leader: a point for `by`.
  point(by) {
    this.sc.add(by);
    this.say({ k: 'point', by, score: this.sc.score, n: this.court.n });
    this.showPoint(by);
  }
  showPoint(by) {
    const c = this.court;
    c.ball = null; c.phase = 'idle';
    this.phase = 'point'; this.pointT = DUEL_PLAY.pause; this.claim = null; this.to = 1 - by;
    sound.play(by === this.side ? 'mirrorpoint' : 'cleopoint');
    this.toast(`🏓 Point to ${this.sideName(by)}! ${this.scoreLine()}`);
  }
  serve(n, to) {
    this.court.serve(n, to);
    this.phase = 'play'; this.to = to; this.claim = null; this.off.u = this.off.v = 0; this.sendT = 0;
    sound.play('shineping');
    if (n === 1) this.toast('Go!');
  }
  over(win) {
    if (this.done) return;
    this.done = true;
    sound.play(win === this.side ? 'win' : 'trumpet');
    this.finish(`🏓 ${this.sideName(win)} wins ${this.sc.score[win]} : ${this.sc.score[1 - win]}! Good game!`);
  }

  /* ---- messages ---- */
  message(p) {
    const c = this.court;
    if (!c) return;
    if (p.k === 'm') { c.setMirror(this.other, p.u, p.t); this.theirs = { u: c.m[this.other], t: c.tilt[this.other] }; }
    else if (p.k === 'ball') {
      if (this.phase !== 'play') return;
      const was = c.ball && { u: c.ball.u + this.off.u, v: c.ball.v + this.off.v };
      if (!c.apply({ q: p.q, b: p.b }, this.other)) return;
      this.applied++;
      const du = was ? was.u - c.ball.u : 0, dv = was ? was.v - c.ball.v : 0, far = Math.hypot(du, dv) > DUEL_PLAY.snap;
      this.off.u = far ? 0 : du; this.off.v = far ? 0 : dv;
      this.claim = null;
    } else if (p.k === 'claim' && this.leader) {
      if (this.phase === 'play' && p.n === c.n) this.point(this.side); // the friend's ball got past their mirror: my point
    } else if (p.k === 'point' && !this.leader) {
      this.sc.load(p.score);
      if (this.phase !== 'point' && p.n === c.n) this.showPoint(p.by);
    } else if (p.k === 'serve' && !this.leader) {
      this.sc.load(p.score);
      if (p.n > c.n && (p.side === 0 || p.side === 1)) this.serve(p.n, p.side);
    } else if (p.k === 'over' && !this.leader) {
      this.sc.load(p.score);
      this.over(p.win);
    }
  }
  beat() { return { n: this.court?.n ?? 0, side: this.to, score: this.sc?.score, ph: this.phase }; }
  farewell() { const win = this.sc?.winner; return this.leader && win != null ? { k: 'over', score: this.sc.score, win } : null; }
  heard(d) { // a lost point or serve heals
    const c = this.court;
    if (!c) return;
    this.sc.load(d.score);
    if (Number.isInteger(d.n) && d.n > c.n && (d.side === 0 || d.side === 1)) this.serve(d.n, d.side);
    else if (d.ph === 'point' && this.phase === 'play' && d.n === c.n) { c.ball = null; c.phase = 'idle'; this.phase = 'point'; this.claim = null; }
  }
  tick() { if (this.claim && !this.leader && this.phase === 'play') this.say({ k: 'claim', n: this.claim.n, q: this.claim.q }); }

  /* ---- every frame (real seconds) ---- */
  update(dt) {
    const c = this.court, g = this.game, p = g.player;
    if (!c || this.done) return;
    dt = Math.min(dt, DUEL_RULES.maxDt);
    this.t += dt;
    if (p.carry !== this.stance && (g.place || 'main') === 'mirror' && !g.realms?.busy && !g.inBattle) this.toStance(); // (put back on my end, whatever took me off)
    if (this.phase === 'ready') {
      this.readyT -= dt;
      if (this.readyT <= 0 && this.leader) { this.say({ k: 'serve', n: 1, side: this.to, score: this.sc.score }); this.serve(1, this.to); }
    } else if (this.phase === 'point' && this.leader) {
      this.pointT -= dt;
      if (this.pointT <= 0) {
        const win = this.sc.winner;
        if (win != null) { this.say({ k: 'over', score: this.sc.score, win }); this.over(win); return; }
        const n = c.n + 1;
        this.say({ k: 'serve', n, side: this.to, score: this.sc.score });
        this.serve(n, this.to);
      }
    }
    const mine = this.input ?? { slide: this.slideIn, tilt: tiltOf(this.side, p.yaw) };
    const ev = c.update(dt, this.side ? [null, mine] : [mine, null]);
    for (const e of ev) {
      if (e.type === 'hit') { this.hits++; sound.play('shineping'); this.sendBall(); }
      else if (e.type === 'guess') { this.guesses++; sound.play('shineping'); }
      else if (e.type === 'bounce') sound.play('shineping');
      else if (e.type === 'miss' && this.phase === 'play') {
        if (this.leader) this.point(this.other);
        else { this.claim = { n: c.n, q: e.q }; this.say({ k: 'claim', n: c.n, q: e.q }); }
      }
    }
    this.mirrorT -= dt;
    if (this.mirrorT <= 0) { this.mirrorT = DUEL_PLAY.mirror; this.say({ k: 'm', u: +c.m[this.side].toFixed(3), t: +c.tilt[this.side].toFixed(3) }); }
    if (c.own === this.side && c.phase === 'rally') { this.sendT -= dt; if (this.sendT <= 0) this.sendBall(); }
    const f = Math.exp(-dt / DUEL_PLAY.smooth);
    this.off.u *= f; this.off.v *= f;
    this.draw(dt);
  }
  sendBall() {
    const b = this.court.stateOf();
    if (!b) return;
    this.sendT = DUEL_PLAY.send;
    this.say({ k: 'ball', q: this.court.q, b });
  }
  draw(dt) {
    const c = this.court, cam = this.game.camera, b = c.ball;
    this.ballMesh.visible = !!b && c.phase === 'rally';
    if (b) { const [x, z] = courtXZ(b.u + this.off.u, b.v + this.off.v); this.ballMesh.position.set(x, G1 + 0.55, z); }
    this.hand.visible = !!cam;
    if (cam) { const o = this.hand; o.position.copy(cam.position); o.quaternion.copy(cam.quaternion); o.translateX(0.42); o.translateY(-0.55); o.translateZ(-1.0); o.rotateX(-0.35); o.scale.setScalar(0.5); }
    // the friend's mirror at their end, the way they hold it (eased between their messages)
    const o = this.other, k = Math.min(1, dt * DUEL_PLAY.drawRate);
    this.drawU += (c.m[o] - this.drawU) * k;
    const [x, z] = courtXZ(courtU(o, this.drawU), DUEL_RULES.lines[o]);
    this.theirMirror.position.set(x, G1 + 0.62, z + (o ? 0.45 : -0.45));
    this.theirMirror.rotation.y = -c.tilt[o];
  }

  /* ---- the rest of a FriendGame ---- */
  aim() {
    const b = this.court?.ball, [x, z] = b ? courtXZ(b.u, b.v) : courtXZ(R.w / 2, R.l / 2);
    return { x, z, text: (a, m) => `🏓 Keep it out of your end! ${a} ${m}m` };
  }
  chip() {
    if (!this.sc) return null;
    const phase = this.phase === 'ready' ? 'Get ready...' : this.phase === 'point' ? 'Point!' : `First to ${DUEL_RULES.need} wins`;
    return { score: `🏓 ${this.scoreLine()}`, phase };
  }
  get noRide() { return 'No riding in Bounce-Back!'; }
  info() {
    const c = this.court;
    return { phase: this.phase, side: this.side, score: [...(this.sc?.score || [0, 0])], n: c?.n, q: c?.q, own: c?.own, courtPhase: c?.phase, ball: c?.ball && { ...c.ball },
      m: c && [...c.m], tilt: c && [...c.tilt], claim: !!this.claim, hits: this.hits, guesses: this.guesses, applied: this.applied, onStance: this.game.player.carry === this.stance,
      crewAway: (this.crew || []).length, meshes: (this.meshes || []).length, ballShown: !!this.ballMesh?.visible };
  }
}

const palace = game => game.gymLive?.of('part:mirror');
addFriendGame({
  id: 'bounce', icon: '🏓', name: 'Bounce-Back', sub: `First to ${DUEL_RULES.need}, on the Mirror Palace's court.`,
  place: 'mirror', arrive: 'mirror', where: 'the Mirror Palace', // asked for anywhere else: a trip there and back (friendgames.js)
  ask: name => `${name} wants to play Bounce-Back with you! Keep the shine ball out of your end. First to ${DUEL_RULES.need} wins.`,
  shown: game => !!palace(game),
  whyNot: game => (palace(game)?.duel ? 'Finish your game first!' : ''),
  make: (game, s) => new BounceDuel(game, s),
});
