// Owner 2026-11-23 ("the Sketchbook seems like lagging in the tablet"): the pencil look (caves.js skDraw) is worked out for every pixel,
// so on a tablet the screen's pixel count is what costs. A heavy look (today only the Sketchbook: game.sketch.on) draws fewer pixels:
// it starts at a lower pixel ratio and, while the frame rate stays low, steps down a little more (and back up when it is fast again).
// Every other world keeps exactly the old ratio (min(devicePixelRatio, 1.5 on touch / 2)). Pure: main.js applies what it says.
export const RES = {
  cap: { touch: 1.5, desk: 2 },       // the old ratios (every light world)
  heavy: { touch: 1, desk: 1.5 },     // where a heavy look starts
  min: 0.6,                           // never blurrier than this
  step: 0.85,                         // one step down (or up: / step)
  slowFps: 38, slowFor: 1.2,          // under slowFps for slowFor s = one step down
  fastFps: 56, fastFor: 5,            // over fastFps for fastFor s = one step back up (never above the heavy start)
};

export class Resolution {
  constructor() { this.scale = 1; this.slow = 0; this.fast = 0; this.heavy = false; }
  // The pixel ratio to use now.
  ratio(dpr, touch) {
    const d = dpr || 1;
    if (!this.heavy) return Math.min(d, touch ? RES.cap.touch : RES.cap.desk);
    const start = Math.min(d, touch ? RES.heavy.touch : RES.heavy.desk);
    return Math.max(Math.min(RES.min, start), +(start * this.scale).toFixed(3));
  }
  // A new world: heavy or not; the steps start again.
  setHeavy(on) { const was = this.heavy; this.heavy = !!on; this.scale = 1; this.slow = 0; this.fast = 0; return was !== this.heavy; }
  // Every frame (dt in s). True when the ratio should change. Long frames (a tab switch, loading) are not counted.
  tick(dt, dpr, touch) {
    if (!this.heavy || !(dt > 0) || dt > 0.5) return false;
    const fps = 1 / dt, before = this.ratio(dpr, touch);
    if (fps < RES.slowFps) { this.slow += dt; this.fast = 0; } else if (fps > RES.fastFps) { this.fast += dt; this.slow = 0; } else { this.slow = Math.max(0, this.slow - dt); this.fast = Math.max(0, this.fast - dt); }
    if (this.slow >= RES.slowFor) { this.slow = 0; this.scale *= RES.step; }
    if (this.fast >= RES.fastFor) { this.fast = 0; this.scale = Math.min(1, this.scale / RES.step); }
    const start = Math.min(dpr || 1, touch ? RES.heavy.touch : RES.heavy.desk);
    this.scale = Math.max(RES.min / start, this.scale);
    return this.ratio(dpr, touch) !== before;
  }
  info(dpr, touch) { return { heavy: this.heavy, scale: this.scale, ratio: this.ratio(dpr, touch) }; }
}
