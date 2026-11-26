// One ball for two players (owner 2026-11-26: football and basketball together in Playland). Pure, no imports, Node-runnable.
//
// Both browsers run the same ball physics (ballphysics.js Ball). Whoever touched the ball last OWNS it: their browser's ball is
// the truth and they send its state (at once on a touch, then a few times a second while it moves). The other browser rolls
// its own copy on between messages and takes every newer state. Touch it yourself and it is yours (`take`): so your own kick
// never waits for the internet. Two touches at the same moment: the leader's stands.
//   message: { q: ownership number, k: count within it, o: owner id, p: [x, y, z], v: [x, y, z], h: 1 held in hands, e?: 'out' | 'spot' }
export const SHARE = { moving: 0.4, resting: 2, gap: 0.1, smooth: 0.18, snap: 6 };

export class SharedBall {
  // ball: a ballphysics Ball; me / leader: player ids
  constructor(ball, me, leader) {
    this.ball = ball; this.me = me; this.leader = leader;
    this.q = 0; this.k = 0; this.seen = 0; this.owner = leader;
    this.held = false;
    this.t = 0; this.sentAt = -9; this.dirty = false; this.note = null;
    this.off = { x: 0, y: 0, z: 0 }; // where it is drawn minus where it is: a jump from a message is smoothed away
  }
  get mine() { return this.owner === this.me; }
  // I touched, kicked, picked up or put down the ball: it is mine from now. `note` rides on the next message ('out', 'spot').
  take(note = null) { this.q++; this.k = 0; this.seen = 0; this.owner = this.me; this.dirty = true; if (note) this.note = note; }
  // A new kick-off: both sides jump to the same ownership number, the leader owns the ball on its spot.
  kickOff(n) {
    this.q = n * 1000; this.k = 0; this.seen = 0; this.owner = this.leader; this.held = false; this.dirty = false; this.note = null;
    this.ball.reset(); this.off.x = this.off.y = this.off.z = 0;
  }
  tick(dt) {
    this.t += dt;
    const f = Math.exp(-dt / SHARE.smooth);
    this.off.x *= f; this.off.y *= f; this.off.z *= f;
  }
  // The message to send now, or null.
  outgoing() {
    if (!this.mine) return null;
    const since = this.t - this.sentAt, b = this.ball, moving = this.held || b.restFor < 0.3;
    if (!(this.dirty && since >= SHARE.gap) && since < (moving ? SHARE.moving : SHARE.resting)) return null;
    this.dirty = false; this.sentAt = this.t;
    const r = n => +n.toFixed(3), m = { q: this.q, k: ++this.k, o: this.me, p: [r(b.pos.x), r(b.pos.y), r(b.pos.z)], v: [r(b.vel.x), r(b.vel.y), r(b.vel.z)], h: this.held ? 1 : 0 };
    if (this.note) { m.e = this.note; this.note = null; }
    return m;
  }
  // A state from the other player. Returns false (old, or mine stands), else { owner changed, note }.
  apply(m) {
    if (!m || !Array.isArray(m.p) || !Array.isArray(m.v) || ![...m.p, ...m.v, m.q, m.k].every(Number.isFinite)) return false;
    if (m.q < this.q) return false;
    if (m.q === this.q) {
      if (m.o !== this.owner) { if (this.me === this.leader) { this.dirty = true; return false; } } // both touched at once: the leader's stands
      else if (this.mine || m.k <= this.seen) return false;
    }
    const b = this.ball, was = { x: b.pos.x + this.off.x, y: b.pos.y + this.off.y, z: b.pos.z + this.off.z };
    const changed = m.o !== this.owner || m.q !== this.q;
    this.q = m.q; this.seen = m.k; this.owner = m.o; this.held = !!m.h; this.dirty = false;
    b.pos.x = m.p[0]; b.pos.y = m.p[1]; b.pos.z = m.p[2];
    b.vel.x = m.v[0]; b.vel.y = m.v[1]; b.vel.z = m.v[2];
    b.restFor = 0;
    if (changed) b.kickedAt = b.time; // a fresh touch of theirs: mine waits a quarter second, like after my own
    const dx = was.x - b.pos.x, dy = was.y - b.pos.y, dz = was.z - b.pos.z;
    const far = Math.hypot(dx, dy, dz) > SHARE.snap || m.e;
    this.off.x = far ? 0 : dx; this.off.y = far ? 0 : dy; this.off.z = far ? 0 : dz;
    return { changed, note: m.e || null };
  }
}
