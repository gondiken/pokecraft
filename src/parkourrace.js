// The Parkour race: a game for two friends (friendgames.js; owner 2026-11-28, plans/friend-games-next.md section 1). Both race the
// Obstacle Course (gym 30, the main world) against each other: both puff onto the start platform, 3-2-1-Go, first to the finish
// flag wins. Each runs on their own screen: at Go the course starts over on both (its clock at 0, crumbles whole, no flags), so the
// blink blocks, zap tiles and pushers are in the same state for both; a fall sends you back to your own last flag, as always.
// Each browser times its OWN run from its own Go and sends it; the leader judges (parkourrules.js RaceJudge, like the kart race).
// The friend is seen as their avatar (avatars are never solid). The course's trainers and leader step aside (no battles in a game
// for two; E never picks a person). Allowed before anyone holds the Sneaker Badge. Nothing is saved.
import { FriendGame, addFriendGame } from './friendgames.js';
import { PARKOUR, RaceJudge, startSpots, standing } from './parkourrules.js';
import { fmtTime } from './houserun.js';
import { sound } from './sound.js';

const courseOf = game => game.gymLive?.of('parkour');
const LAST = 3; // the finish flag (obstaclecourse.js FLAGS: start, two landings, the finish)

export class ParkourRace extends FriendGame {
  get side() { return this.leader ? 0 : 1; }
  sideName(side) { return side === this.side ? this.myName : this.partnerName; }
  start() {
    const c = this.c = courseOf(this.game);
    this.phase = 'count'; this.countT = 0; this.beeped = 0; this.sendT = 0; this.endT = null; this.result = undefined;
    this.times = [null, null]; this.theirFlag = 0; this.judge = this.leader ? new RaceJudge() : null; this.spot = null;
    if (!c) { this.finish('The Obstacle Course is not here!'); return; }
    // both onto the start platform, side by side (from anywhere in the main world: a puff there)
    const p = this.game.player, sp = this.spot = startSpots(c.gym)[this.side];
    this.game.riding?.stop?.('quiet');
    p.carry?.leave?.();
    p.pos.set(sp[0], sp[1], sp[2]); p.vel.set(0, 0, 0); p.yaw = sp[3]; p.pitch = 0;
    c.startRace({ onFlag: k => this.flag(k), onFinish: t => this.crossed(t), onLeave: () => this.left() });
    sound.play('boing');
    this.toast(`🏃 A Parkour race with ${this.partnerName}! First to the top flag wins. Wait for GO!`);
  }
  flag(k) { if (k < LAST) this.toast(`🚩 Flag ${k}! Keep going!`); }
  // My run reached the finish flag after t seconds.
  crossed(t) {
    if (this.phase !== 'race' || this.times[this.side] != null) return;
    this.times[this.side] = t;
    this.judge?.set(0, t);
    this.say({ k: 'fin', t });
    sound.play('lapbell');
    this.toast(`🏁 You made it to the top in ${fmtTime(t)}!`);
  }
  // I walked out of the Obstacle Course: the race is over (not once my own run is done).
  left() {
    if (this.times[this.side] != null || this.result !== undefined) return;
    this.s.send({ type: 'stop', why: 'stopped' }); // the friend hears "Dad stopped the game."
    this.finish('You left the Obstacle Course, so the race is over.');
  }
  call(win) {
    this.say({ k: 'over', win, times: this.times });
    this.show(win, this.times);
  }
  show(win, times) {
    if (this.result !== undefined) return;
    this.result = win; this.endT = PARKOUR.done; this.phase = 'done';
    if (Array.isArray(times)) this.times = times.map(t => (Number.isFinite(t) ? t : null));
    if (win === this.side) sound.play('win');
    const [a, b] = this.times, gap = a != null && b != null ? ` by ${Math.abs(a - b).toFixed(1)} s` : '';
    this.toast(win == null ? "🏁 A dead heat! You're both so fast!" : `🏁 ${this.sideName(win)} wins the Parkour race${gap}! 🏆`);
  }
  message(p) {
    if (p.k === 'p') {
      if (Number.isInteger(p.f) && p.f >= 0 && p.f <= LAST) this.theirFlag = Math.max(this.theirFlag, p.f);
      if ('t' in p) this.theirTime(p.t); // (a lost `fin` heals)
    } else if (p.k === 'fin') this.theirTime(p.t);
    else if (p.k === 'over' && !this.leader) this.show(p.win === 0 || p.win === 1 ? p.win : null, p.times);
  }
  theirTime(t) {
    if (!Number.isFinite(t) || t <= 0 || this.times[1 - this.side] != null) return;
    this.times[1 - this.side] = t; this.theirFlag = LAST;
    this.judge?.set(1, t);
  }
  beat() { return this.result !== undefined ? { win: this.result, times: this.times } : {}; }
  farewell() { return this.leader && this.result !== undefined ? { k: 'over', win: this.result, times: this.times } : null; }
  heard(d) { if ('win' in d && !this.leader) this.show(d.win === 0 || d.win === 1 ? d.win : null, d.times); }
  update(dt) {
    const c = this.c;
    if (!c?.race) return;
    if (this.endT != null) { // the result is out: a moment to cheer, then the game is over
      this.endT -= dt;
      if (this.endT <= 0) this.finish(this.result == null ? 'Good race!' : this.result === this.side ? 'You won the Parkour race! Good game!' : 'Good race! Try again?');
      return;
    }
    if (this.phase === 'count') {
      this.countT += dt;
      for (let i = this.beeped; i < PARKOUR.count; i++) {
        if (this.countT < i) break;
        this.beeped = i + 1;
        sound.play('racebeep');
        this.toast(String(PARKOUR.count - i));
      }
      if (this.countT >= PARKOUR.count) { // Go!
        this.phase = 'race';
        c.goRace();
        sound.play('racego');
        this.toast('GO! 🏃');
      }
      return;
    }
    this.sendT -= dt;
    if (this.sendT <= 0) { this.sendT = PARKOUR.send; const mine = this.times[this.side]; this.say(mine != null ? { k: 'p', f: LAST, t: mine } : { k: 'p', f: c.reached }); }
    if (this.judge) { const w = this.judge.step(dt, c.clock); if (w !== undefined) this.call(w); }
  }
  // 3-2-1: you wait on your spot (a jump is fine).
  fence(pos, before, vel) {
    if (this.phase !== 'count' || !this.spot) return;
    pos.x = this.spot[0]; pos.z = this.spot[2]; vel.x = vel.z = 0;
  }
  end() { this.c?.endRace(); }
  // The guide arrow: the next flag up (the finish last).
  aim() {
    const c = this.c;
    if (!c || this.times[this.side] != null || this.result !== undefined) return null;
    const k = Math.min(LAST, c.reached + 1), cp = c.gym.checkpoints[k];
    return { x: cp.stand[0], z: cp.stand[2], text: (arrow, m) => (k === LAST ? `🏁 To the top flag! ${arrow} ${m}m` : `🚩 Flag ${k}! ${arrow} ${m}m`) };
  }
  chip() {
    const c = this.c;
    if (!c) return null;
    const mine = this.times[this.side], theirs = this.times[1 - this.side];
    const phase = this.result !== undefined ? (this.result == null ? 'A dead heat!' : `${this.sideName(this.result)} wins!`)
      : this.phase === 'count' ? `Get ready... ${Math.min(PARKOUR.count, Math.max(1, PARKOUR.count - Math.floor(this.countT)))}`
        : mine != null ? `Finished! ${fmtTime(mine)}`
          : `🚩 ${c.reached}/${LAST} · ${standing(c.reached, this.theirFlag, mine, theirs)}`;
    return { score: `🏃 Parkour race with ${this.partnerName}`, phase };
  }
  get noRide() { return 'No riding in a Parkour race. Run and jump!'; }
  info() {
    const c = this.c;
    return { phase: this.phase, countT: this.countT, times: [...this.times], theirFlag: this.theirFlag, flag: c?.reached ?? null, clock: c?.clock ?? null,
      race: !!c?.race, result: this.result === undefined ? 'none' : this.result, side: this.side, falls: c?.falls ?? 0 };
  }
}

addFriendGame({
  id: 'parkour', icon: '🏃', name: 'Parkour race', sub: 'Up the Obstacle Course. First to the top wins!',
  place: 'main', where: 'the Obstacle Course', // asked for in a realm (the host a Champion): home to the main world and back (friendgames.js)
  ask: name => `${name} wants a Parkour race! First to the top of the Obstacle Course wins.`,
  shown: game => (game.place || 'main') === 'main' && !!courseOf(game),
  whyNot: () => '',
  make: (game, s) => new ParkourRace(game, s),
});
