// A kart race for two friends on Playland's Race Track (owner 2026-11-26). A FriendGame (friendgames.js) on top of the track's
// live part (racelive.js `startDuel`): the same grid, lamps, flags and three laps, each friend in their own kart on their own
// screen, no Rio. Karts never bump each other. Each browser times its OWN race from its own GO, so a slow internet never costs a
// place: the smaller time wins, and the leader says so. Nothing is saved; Rio's race and its win are not touched.
import { FriendGame, addFriendGame } from './friendgames.js';
import { RACE } from './racetrack.js';
import { DUEL, decide } from './matchrules.js';
import { fmtTime } from './houserun.js';
import { sound } from './sound.js';

export class KartRace extends FriendGame {
  get race() { return this.game.gymLive.of('part:race'); }
  get side() { return this.leader ? 0 : 1; }
  sideName(side) { return side === this.side ? this.myName : this.partnerName; }
  start() {
    const r = this.race;
    this.times = [null, null]; this.theirP = RACE.grid; this.sendT = 0; this.graceT = null; this.endT = null; this.result = undefined;
    if (!r) { this.finish('The race track is not here!'); return; }
    r.startDuel({
      lane: this.leader ? 'player' : 'boss',
      friend: () => this.avatar(),
      progress: () => this.theirP,
      onFinish: t => this.crossed(t),
      onStop: () => this.game.friendGames.stop(),
    });
    this.toast(`A race with ${this.partnerName}! ${RACE.laps} laps. Wait for GO!`);
  }
  // My kart finished its last lap after t seconds.
  crossed(t) {
    this.times[this.side] = t;
    this.say({ k: 'fin', t });
    this.toast(`🏁 You finished in ${fmtTime(t)}!`);
    if (this.leader) this.judge();
  }
  // Leader: is the race decided?
  judge() {
    if (this.result !== undefined) return;
    const [mine, theirs] = this.times, clock = this.race?.clock ?? Infinity;
    if (mine != null && theirs != null) this.call(decide(mine, theirs));
    else if (theirs != null && clock >= theirs) this.call(1);               // their time has passed on my clock: I cannot beat it
    else if (mine != null && this.graceT == null) this.graceT = DUEL.grace; // their finish may still be on its way
  }
  call(win) {
    this.say({ k: 'over', win, times: this.times });
    this.show(win, this.times);
  }
  show(win, times) {
    if (this.result !== undefined) return;
    this.result = win; this.endT = DUEL.done;
    if (Array.isArray(times)) this.times = times.map(t => (Number.isFinite(t) ? t : null));
    if (win === this.side) sound.play('win');
    const [a, b] = this.times, gap = a != null && b != null ? ` by ${Math.abs(a - b).toFixed(1)} s` : '';
    this.toast(win == null ? "🏁 A dead heat! You're both so fast!" : `🏁 ${this.sideName(win)} wins the race${gap}! 🏆`);
  }
  message(p) {
    if (p.k === 'p') { if (Number.isFinite(p.P)) this.theirP = p.P; }
    else if (p.k === 'fin') {
      if (!Number.isFinite(p.t) || p.t <= 0) return;
      this.times[1 - this.side] = p.t;
      if (this.leader) this.judge();
    } else if (p.k === 'over' && !this.leader) this.show(p.win === 0 || p.win === 1 ? p.win : null, p.times);
  }
  beat() { return this.result !== undefined ? { win: this.result, times: this.times } : {}; }
  farewell() { return this.leader && this.result !== undefined ? { k: 'over', win: this.result, times: this.times } : null; }
  heard(d) { if ('win' in d) this.show(d.win, d.times); }
  update(dt) {
    const r = this.race;
    if (!r?.duel) return;
    if (this.endT != null) { // the result is out: a moment to cheer, then both get out
      this.endT -= dt;
      if (this.endT <= 0) this.finish(this.result == null ? 'Good race!' : this.result === this.side ? 'You won the race! Good game!' : 'Good race! Try again?');
      return;
    }
    if (r.state === 'race') {
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = DUEL.send; this.say({ k: 'p', P: +r.P.toFixed(1) }); }
    }
    if (!this.leader) return;
    if (this.graceT != null) { this.graceT -= dt; if (this.graceT <= 0) { this.graceT = null; this.call(decide(this.times[0], this.times[1])); return; } }
    if (this.times[1] != null) this.judge();
  }
  end() { this.race?.endDuel(); }
  chip() {
    const r = this.race;
    if (!r) return null;
    const mine = this.times[this.side];
    const phase = this.result !== undefined ? (this.result == null ? 'A dead heat!' : `${this.sideName(this.result)} wins!`)
      : mine != null ? `Finished! ${fmtTime(mine)}` : r.state === 'count' ? 'Get ready...' : `Lap ${Math.min(RACE.laps, r.lap + 1)}/${RACE.laps} · You're ${r.P >= r.bossS ? '1st' : '2nd'}!`;
    return { score: `🏁 Race with ${this.partnerName}`, phase };
  }
  get noRide() { return 'No riding in a race. Drive your kart!'; }
  info() { const r = this.race; return { times: [...this.times], theirP: this.theirP, result: this.result === undefined ? 'none' : this.result, state: r?.state, duel: !!r?.duel, side: this.side }; }
}

const track = game => game.gymLive?.of('part:race');
addFriendGame({
  id: 'race', icon: '🏁', name: 'Kart race', sub: `${RACE.laps} laps round the Race Track.`,
  place: 'playland', arrive: 'race', where: 'the Race Track', // asked for anywhere else: a trip there and back (friendgames.js)
  ask: name => `${name} wants to race you! ${RACE.laps} laps in karts.`,
  shown: game => !!track(game),
  whyNot: game => { const r = track(game); return r?.duel || r?.state === 'count' || r?.state === 'race' ? 'Finish your race first!' : ''; },
  make: (game, s) => new KartRace(game, s),
});
