// Chapter 3 A2 (owner 2026-11-11: "we could use all this space"): scribble bugs, pure (no imports), Node-runnable, 1/120 s sub-steps
// (60 and 20 fps give the same run). Little scribbles scuttle on the grey ground round each patch you have not cleared; walk into one
// and it pops into a puff of colour. A chase, not a fight:
//   - a bug notices you within `scare` and runs straight away from you, always a bit faster than you are moving (`faster`), so running
//     after it from behind never catches it (on foot, sprinting or riding);
//   - it lives in its patch's yard, a ring round the patch from `inner` to `outer` (never in the fight's ring, never far away). At the
//     yard's edge it can only run ALONG the edge: the part of its run that points out of the yard is lost. So a bug you come at from
//     straight behind the edge (from the patch's side when it is at the outer edge) has nowhere to go and is caught: corner it.
//   - `wiggle`: it zigzags a little while it runs (a scribble), the same for everyone (a closed form of its own clock).
// One look ("a little scribble running from me") and no words; the trick is the Mirror Palace's Gloomies' (corner them).
export const BUG = {
  n: 4,            // bugs round each patch you have not cleared
  scare: 5.5,      // it starts running when you are this close
  calm: 9,         // and stops once you are this far
  speed: 5.6,      // its least running speed (a walk is 4.3, a sprint 6.2)
  faster: 1.08,    // ... and always at least this much faster than you move
  inner: 9,        // its yard: from this far from the patch's middle (the fight starts at 6.5)
  outer: 18,       // ... to this far
  wiggle: 0.45,    // how much it zigzags (radians either way)
  catchR: 0.85,    // you pop it when your middle comes this close to its middle
  step: 1 / 120,
};

// a seeded spot round a patch (the same bugs every time)
export function bugsFor(patch, n = BUG.n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (patch.id * 1.7 + i / n * Math.PI * 2) % (Math.PI * 2), r = (BUG.inner + BUG.outer) / 2 + Math.sin(patch.id * 3 + i * 2.1) * 3;
    out.push({ id: `${patch.id}:${i}`, patch: patch.id, cx: patch.x + 0.5, cz: patch.z + 0.5, x: patch.x + 0.5 + Math.cos(a) * r, z: patch.z + 0.5 + Math.sin(a) * r, t: i * 0.7, run: 0, popped: false, vx: 0, vz: 0 });
  }
  return out;
}

// keeps (x, z) in the yard: on an edge, the outward part of a move is lost (pure)
export function yardStep(b, dx, dz) {
  let nx = b.x + dx, nz = b.z + dz;
  const rx = nx - b.cx, rz = nz - b.cz, r = Math.hypot(rx, rz) || 1e-6;
  if (r > BUG.outer) { nx = b.cx + rx / r * BUG.outer; nz = b.cz + rz / r * BUG.outer; }
  else if (r < BUG.inner) { nx = b.cx + rx / r * BUG.inner; nz = b.cz + rz / r * BUG.inner; }
  return [nx, nz];
}

export class BugField {
  // level: overrides of BUG for Easy / Hard (difficulty.js `bugs`; wobblelive.js hands in the current one every frame), {} = Normal
  constructor(bugs, level = null) { this.bugs = bugs; this.acc = 0; this.events = []; this.level = level; }
  // you: { x, z, speed } (speed = how fast you move now, blocks a second)
  step(dt, you) {
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= BUG.step) { this.acc -= BUG.step; this.tick(BUG.step, you); }
    const e = this.events; this.events = []; return e;
  }
  tick(h, you) {
    const B = this.level && Object.keys(this.level).length ? { ...BUG, ...this.level } : BUG;
    for (const b of this.bugs) {
      if (b.popped) continue;
      b.t += h;
      const dx = b.x - you.x, dz = b.z - you.z, d = Math.hypot(dx, dz);
      if (d < B.catchR) { b.popped = true; this.events.push({ kind: 'pop', bug: b }); continue; }
      if (d < B.scare) b.run = 1; else if (d > B.calm) b.run = 0;
      if (!b.run) { b.vx = b.vz = 0; continue; }
      const v = Math.max(B.speed, (you.speed || 0) * B.faster), w = Math.sin(b.t * 9) * B.wiggle;
      const ax = dx / (d || 1), az = dz / (d || 1), c = Math.cos(w), s = Math.sin(w);
      const mx = (ax * c - az * s) * v * h, mz = (az * c + ax * s) * v * h;
      const [nx, nz] = yardStep(b, mx, mz);
      b.vx = (nx - b.x) / h; b.vz = (nz - b.z) / h;
      b.x = nx; b.z = nz;
    }
  }
}
