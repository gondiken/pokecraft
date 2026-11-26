// Tag for two (owner 2026-11-26), the rules. Pure, no imports, Node-runnable.
// One player is IT and runs a little faster; touching the other makes THEM it, and the new one counts to three before they may
// run (no tag-backs). After TAG.time seconds whoever was IT for less time wins. The leader's TagRound is the truth; the other
// side mirrors it from `state()` and runs its own clock between messages.
export const TAG = {
  time: 120,        // seconds of play
  freeze: 3,        // the new IT counts to three (cannot walk)
  reach: 1.3, tall: 2.2, // a touch: this close side to side, this close in height
  tap: 3,           // looking at / tapping them counts this close
  radius: 28,       // the play area round the place it began
  boost: 1.1,       // IT runs this much faster, so a chase always ends
  fenceToast: 3,
};

export const touching = (a, b, reach = TAG.reach) => Math.hypot(a.x - b.x, a.z - b.z) <= reach && Math.abs(a.y - b.y) < TAG.tall;
export const clock = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export class TagRound {
  // ids = [leader, other]; `it` starts as IT (and counts to three first)
  constructor(ids, it = ids[0]) {
    this.ids = [...ids];
    this.it = it;
    this.t = 0;
    this.frozen = TAG.freeze;
    this.itTime = { [ids[0]]: 0, [ids[1]]: 0 };
    this.tags = 0;
    this.over = false;
  }
  other(id) { return this.ids[0] === id ? this.ids[1] : this.ids[0]; }
  get left() { return Math.max(0, TAG.time - this.t); }
  step(dt) {
    if (this.over || !(dt > 0)) return;
    const d = Math.min(dt, TAG.time - this.t);
    this.t += d;
    const thaw = Math.min(this.frozen, d);
    this.frozen -= thaw;
    this.itTime[this.it] += d - thaw; // counting to three is not chasing
    if (this.t >= TAG.time - 1e-9) this.over = true;
  }
  canTag(who) { return !this.over && who === this.it && this.frozen <= 0; }
  // `by` touched the other one: they are IT now. False when it does not count.
  tagged(by) {
    if (!this.canTag(by)) return false;
    this.it = this.other(by);
    this.frozen = TAG.freeze;
    this.tags++;
    return true;
  }
  // The one who was IT for less time; null = a draw (within half a second).
  winner() {
    const [a, b] = this.ids, d = this.itTime[a] - this.itTime[b];
    return Math.abs(d) < 0.5 ? null : d < 0 ? a : b;
  }
  state() { return { it: this.it, t: +this.t.toFixed(2), frozen: +this.frozen.toFixed(2), itTime: { ...this.itTime }, tags: this.tags, over: this.over }; }
  // The other side takes the leader's state (never an older one).
  load(st) {
    if (!st || st.tags < this.tags || (st.tags === this.tags && st.t < this.t - 2 && !st.over)) return false;
    this.it = st.it; this.t = st.t; this.frozen = st.frozen; this.tags = st.tags; this.over = !!st.over;
    for (const id of this.ids) if (Number.isFinite(st.itTime?.[id])) this.itTime[id] = st.itTime[id];
    return true;
  }
}
