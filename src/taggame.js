// Tag for two (owner 2026-11-26): the live part (rules in tagrules.js, the asking and the heartbeat in friendgames.js).
// The one who is IT sees a touch on their own screen and says so; the leader's round decides and tells both.
import * as THREE from 'three';
import { FriendGame, addFriendGame } from './friendgames.js';
import { TAG, TagRound, touching, clock } from './tagrules.js';
import { sound } from './sound.js';

function itSign() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e8362a'; g.fillRect(14, 6, 100, 52);
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(14, 6, 100, 52);
  g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('IT!', 64, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(1.1, 0.55, 1);
  s.position.y = 2.95;
  s.renderOrder = 11;
  s.userData.tagIt = true;
  return s;
}

export class TagGame extends FriendGame {
  setup() {
    const p = this.game.player.pos, a = this.avatar()?.pos ?? p;
    return { center: [(p.x + a.x) / 2, (p.z + a.z) / 2], it: this.me };
  }
  start(data) {
    this.center = data.center;
    this.round = new TagRound(this.leader ? [this.me, this.partner] : [this.partner, this.me], data.it);
    this.seen = 0; this.claim = null; this.fenceAt = 0; this.sign = null; this.count = 4;
    this.toast(this.round.it === this.me ? `You are IT! Count to ${TAG.freeze}, then catch ${this.partnerName}!` : `Run! ${this.partnerName} is IT!`);
    sound.play('whistle');
  }
  get iAmIt() { return this.round.it === this.me; }
  announce() { // somebody was just tagged
    this.seen = this.round.tags; this.claim = null; this.count = 4;
    this.toast(this.iAmIt ? `Tagged! You are IT now. Count to ${TAG.freeze}!` : `Tag! ${this.partnerName} is IT now. Run!`);
    sound.play(this.iAmIt ? 'boing' : 'keyfound');
  }
  over() {
    const r = this.round, w = r.winner(), sec = id => `${Math.round(r.itTime[id])} s`;
    this.toast(`Time's up! ${this.nameOf(r.ids[0])} was IT for ${sec(r.ids[0])}, ${this.nameOf(r.ids[1])} for ${sec(r.ids[1])}.`);
    if (w === this.me) sound.play('win');
    this.finish(w == null ? "It's a draw! Good game!" : `${this.nameOf(w)} wins! 🏆 Good game!`);
  }
  // I touched them (on my screen): the leader's round says whether it counts.
  touch() {
    const r = this.round;
    const c = this.claim, t = performance.now();
    if (!r.canTag(this.me) || (c?.n === r.tags && (!c.no || t - c.at < 400))) return; // (asked already; after a "no" ask again, but not every frame)
    if (this.leader) { if (r.tagged(this.me)) { this.announce(); this.say({ k: 'state', st: r.state() }); } return; }
    this.claim = { n: r.tags, at: t, no: false };
    this.say({ k: 'tag', n: r.tags });
  }
  message(p) {
    const r = this.round;
    if (p.k === 'tag' && this.leader) {
      if (p.n === r.tags && r.tagged(this.partner)) this.announce();
      this.say({ k: 'state', st: r.state() });
    } else if (p.k === 'state' && !this.leader) {
      if (this.claim && p.st?.tags === this.claim.n) this.claim.no = true; // the leader's round was not ready (still counting there): the next touch asks again
      this.heard(p.st);
    }
  }
  beat() { return this.round.state(); }
  farewell() { return this.leader ? { k: 'state', st: this.round.state() } : null; }
  heard(st) {
    const r = this.round;
    if (!r.load(st)) return;
    if (r.tags !== this.seen) this.announce();
    if (r.over) this.over();
  }
  tick() {
    const c = this.claim;
    if (!c || this.leader) return;
    if (c.n !== this.round.tags || c.no || performance.now() - c.at > 2000) { this.claim = null; return; } // answered, or lost: touch again
    this.say({ k: 'tag', n: c.n });
  }
  update(dt) {
    const g = this.game, r = this.round, a = this.avatar();
    r.step(dt);
    if (r.over) { if (this.leader) { this.say({ k: 'state', st: r.state() }); this.over(); } return; }
    if (a && a.here !== false && r.canTag(this.me) && touching(g.player.pos, a.pos)) this.touch();
    g.player.speedK = this.iAmIt && r.frozen <= 0 ? TAG.boost : 1;
    if (this.iAmIt && r.frozen > 0) { // count to three out loud
      const n = Math.ceil(r.frozen);
      if (n < this.count) { this.count = n; sound.play('racebeep'); }
    } else if (this.count !== 0) { this.count = 0; if (this.iAmIt) { sound.play('racego'); this.toast(`Go! Catch ${this.partnerName}!`); } }
    // the IT! sign over their head
    const want = a && r.it === this.partner;
    if (want && !this.sign) { this.sign = itSign(); this.signOn = a; a.model.add(this.sign); }
    else if (!want && this.sign) this.dropSign();
  }
  dropSign() {
    if (!this.sign) return;
    this.signOn?.model.remove(this.sign);
    this.sign.material.map.dispose(); this.sign.material.dispose();
    this.sign = null; this.signOn = null;
  }
  end() {
    this.dropSign();
    if (this.game.player) this.game.player.speedK = 1;
  }
  // The new IT stands still while counting; nobody leaves the play area.
  fence(pos, before, vel) {
    const r = this.round;
    if (this.iAmIt && r.frozen > 0 && !r.over) { pos.x = before.x; pos.z = before.z; vel.x = vel.z = 0; return; }
    const c = this.center, out = q => (q.x - c[0]) ** 2 + (q.z - c[1]) ** 2 > TAG.radius ** 2;
    if (!out(pos) || out(before)) return;
    pos.copy(before);
    vel.x = vel.z = 0;
    const t = performance.now();
    if (t - this.fenceAt > TAG.fenceToast * 1000) { this.fenceAt = t; this.toast("That's the edge of the play area!"); }
  }
  // Owner 2026-11-28: the catcher's arrow points at the runner (the play area is big). The runner keeps the usual arrow.
  aim() {
    const r = this.round, a = this.avatar(), pn = this.partnerName;
    if (!this.iAmIt || r.over || !a || a.here === false) return null;
    return { x: a.pos.x, z: a.pos.z, text: (arrow, m) => (r.frozen > 0 ? `🏃 Count to ${TAG.freeze}! ${pn} is ${arrow} ${m}m away` : `🏃 Catch ${pn}! ${arrow} ${m}m`) };
  }
  chip() {
    const r = this.round, pn = this.partnerName, sec = id => `${Math.round(r.itTime[id])}s`;
    const phase = this.iAmIt ? (r.frozen > 0 ? `You are IT! Count: ${Math.ceil(r.frozen)}` : `You are IT! Catch ${pn}!`) : (r.frozen > 0 ? `${pn} is IT! Run! (${Math.ceil(r.frozen)})` : `${pn} is IT! Run!`);
    return { score: `Tag · ${clock(r.left)} · IT for: ${this.nameOf(r.ids[0])} ${sec(r.ids[0])} · ${this.nameOf(r.ids[1])} ${sec(r.ids[1])}`, phase, hot: this.iAmIt };
  }
  tag(avatar) {
    if (this.inReach(avatar)) this.touch();
    return true;
  }
  inReach(avatar) { return this.round.canTag(this.me) && touching(this.game.player.pos, avatar.pos, TAG.tap); }
  prompt(avatar, how) { return this.inReach(avatar) ? `${avatar.name} · ${how} to tag!` : `Tag with ${avatar.name}`; }
  action(avatar) { return this.inReach(avatar) ? 'Tag!' : ''; }
  get noRide() { return 'No riding in tag. Run!'; }
  get usesFriend() { return true; }
  info() { return { ...this.round.state(), left: this.round.left, center: this.center, me: this.me, sign: !!this.sign }; }
}

addFriendGame({
  id: 'tag', icon: '🏃', name: 'Tag', sub: 'Catch me if you can!',
  ask: name => `${name} wants to play tag! ${name} is IT first.`,
  whyNot: game => (game.world.gravityAt ? 'Not on the Cube Planets!' : game.being?.can?.() ? 'Not in this land!' : ''),
  make: (game, s) => new TagGame(game, s),
});
