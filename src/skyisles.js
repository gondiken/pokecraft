// Chapter 3 step D (plans/chapter3-abilities-build.md, ?preview only): THE FLOATING ISLES, the Fly place in Bumpy Hills. Pure,
// Node-runnable (wayland.js builds it; tests/waysbots.mjs plays it with the real Player).
//   A chain of cloud islands climbs into the sky over a pit of the Scribble's ink. Flying rises only `RIDE.sky.cap` 6 over what is right
//   under you, so over the ink you sink: take off from an island's edge at your highest, go straight, and you reach the next one (2 higher)
//   if the gap is short enough. Fly straight on from where you land (still rising) and you sink into the ink mist: a puff back onto the
//   last island you stood on. The fourth island drifts toward you and away (go when it is close); the fifth, with the chest, bobs up and
//   down (go when it is low). Clouds give no grip (blocks.js `noGrip`): a creature that climbs cannot climb their sides.
// Island cells move in whole blocks (closed form of the summed clock); whoever stands on one moves with it.
import { B } from './blocks.js';

export const ISLES = {
  pit: { x0: 80, x1: 121, z0: 82, z1: 128 }, // the ink pit (the shore is the flat ground south of z1)
  ink: 5,          // the ink's block (you would stand at ink + 1)
  mist: 12.6,      // over the pit, feet below this = in the ink mist: a puff (the sky cap over the ink is ink + 1 + 6 = 12)
  thick: 2,        // an island's cloud is this many blocks thick
  start: [100.5, 11, 131.5, 0], // the shore (x, y, z, yaw): where a puff takes you before you stood on an island
  // each island: centre x / z, radius (cells within r + 0.3 of the middle), S = the height you stand at, and how it moves:
  // drift: [dx, dz, amp, period] (it slides along (dx, dz) by round(amp * sin)), bob: [amp, period] (it rises 0..amp blocks and back)
  list: [
    { x: 100, z: 120, r: 2, S: 13 },
    { x: 100, z: 109, r: 2, S: 15 },
    { x: 89, z: 109, r: 2, S: 17 },
    { x: 89, z: 95, r: 2, S: 19, drift: [0, -1, 2.6, 6] }, // (gap 9 + its drift: 6..12; reachable only when it has come 2-3 closer)
    { x: 101, z: 95, r: 2.6, S: 21, bob: [3, 5.4], chest: true }, // (east of the drifting one: gap about 6, reachable only while it is all the way down)
  ],
};
// the gaps they are built for (edge to edge, along the way you fly): a straight flight from the cap at sink 4 / speed 7.5 reaches a
// landing (6 - rise) / (4 / 7.5) = 7.5 blocks away for a rise of 2.

// An island's offset at time t: [dx, dy, dz] in whole blocks.
export function isleOffset(i, t) {
  const q = ISLES.list[i];
  if (q.drift) { const [dx, dz, a, p] = q.drift, k = Math.round(a * Math.sin(2 * Math.PI * t / p)); return [dx * k, 0, dz * k]; }
  if (q.bob) { const [a, p] = q.bob, k = Math.round(a * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / p))); return [0, k, 0]; }
  return [0, 0, 0];
}
// every offset an island can have (its moves are whole blocks)
export function isleSpan(i) {
  const q = ISLES.list[i];
  if (q.drift) { const [dx, dz, a] = q.drift, n = Math.round(a); return Array.from({ length: 2 * n + 1 }, (_, k) => [dx * (k - n), 0, dz * (k - n)]); }
  if (q.bob) return Array.from({ length: q.bob[0] + 1 }, (_, k) => [0, k, 0]);
  return [[0, 0, 0]];
}
// An island's cells at an offset: [[x, y, z, id]]
export function isleCells(i, off = [0, 0, 0]) {
  const q = ISLES.list[i], out = [], R = Math.ceil(q.r);
  for (let x = q.x - R; x <= q.x + R; x++) for (let z = q.z - R; z <= q.z + R; z++) {
    if (Math.hypot(x - q.x, z - q.z) > q.r + 0.3) continue;
    for (let k = 1; k <= ISLES.thick; k++) out.push([x + off[0], q.S - k + off[1], z + off[2], B.CLOUD]);
  }
  if (q.chest) out.push([q.x + off[0], q.S + off[1], q.z + off[2], B.CHEST]);
  return out;
}
export const overPit = (x, z) => x >= ISLES.pit.x0 && x < ISLES.pit.x1 + 1 && z >= ISLES.pit.z0 && z < ISLES.pit.z1 + 1;
// the island under a position (its index) or -1: standing on it (feet within 0.2 of its top), over one of its cells
export function isleUnder(pos, offs) {
  for (let i = 0; i < ISLES.list.length; i++) {
    const q = ISLES.list[i], o = offs[i];
    if (Math.abs(pos.y - (q.S + o[1])) > 0.2) continue;
    if (Math.hypot(pos.x - 0.5 - q.x - o[0], pos.z - 0.5 - q.z - o[2]) <= q.r + 0.75) return i;
  }
  return -1;
}

// the island you are over (it is the floor under you: above its top, within the fly cap), or -1. Reaching one counts even while flying.
export function isleOver(pos, offs) {
  for (let i = 0; i < ISLES.list.length; i++) {
    const q = ISLES.list[i], o = offs[i];
    if (!o) continue;
    const top = q.S + o[1];
    if (pos.y < top - 0.05 || pos.y > top + 6.3) continue;
    if (Math.hypot(Math.floor(pos.x) - q.x - o[0], Math.floor(pos.z) - q.z - o[2]) <= q.r + 0.3) return i;
  }
  return -1;
}

// The blocks (wayland.js waysLand, after the ground): the pit and its ink. The islands are drawn by IsleRun (they move).
export function buildIsles(world, put) {
  const P = ISLES.pit;
  for (let x = P.x0; x <= P.x1; x++) for (let z = P.z0; z <= P.z1; z++) {
    for (let y = ISLES.ink + 1; y <= 30; y++) put(x, y, z, 0);
    put(x, ISLES.ink, z, B.DO_INK);
  }
}

// The rules after the player moved (the live part each frame, the bots in Node). set(x, y, z, id) changes a block (world.setLive in the
// game). -> events [{ kind: 'puff' | 'landed', isle }]
export class IsleRun {
  constructor(set) {
    this.set = set; this.t = 0; this.offs = ISLES.list.map(() => null); this.last = -1; this.best = -1;
  }
  place(t = this.t, p = null) {
    const ev = [];
    ISLES.list.forEach((q, i) => {
      const o = isleOffset(i, t), was = this.offs[i];
      if (was && was[0] === o[0] && was[1] === o[1] && was[2] === o[2]) return;
      const on = p && was && isleUnder(p.pos, this.offs) === i;
      if (on) { p.pos.x += o[0] - was[0]; p.pos.y += o[1] - was[1]; p.pos.z += o[2] - was[2]; if (o[1] > was[1]) p.vel.y = Math.max(p.vel.y, 0); }
      if (was) for (const [x, y, z] of isleCells(i, was)) this.set(x, y, z, 0);
      else for (const o2 of isleSpan(i)) for (const [x, y, z] of isleCells(i, o2)) this.set(x, y, z, 0); // (first time: wherever it could have been)
      for (const [x, y, z, id] of isleCells(i, o)) this.set(x, y, z, id);
      this.offs[i] = o;
    });
    return ev;
  }
  step(p, dt) {
    this.t += dt;
    const ev = this.place(this.t, p);
    const pos = p.pos;
    if (!overPit(pos.x, pos.z)) { if (p.onGround && pos.z > ISLES.pit.z1) this.last = -1; return ev; }
    const i = isleOver(pos, this.offs);
    if (i >= 0 && i !== this.last) { this.last = i; this.best = Math.max(this.best, i); ev.push({ kind: 'landed', isle: i }); }
    if (pos.y < ISLES.mist) { // the ink mist: back onto the last island you stood on (or the shore)
      const to = this.last >= 0 ? this.standOn(this.last) : ISLES.start;
      pos.set(to[0], to[1], to[2]); p.vel.set(0, 0, 0);
      ev.push({ kind: 'puff', yaw: to[3], isle: this.last });
    }
    return ev;
  }
  standOn(i) { const q = ISLES.list[i], o = this.offs[i] ?? [0, 0, 0]; return [q.x + o[0] + 0.5, q.S + o[1] + 0.01, q.z + o[2] + 0.5, null]; }
  won() { return this.best === ISLES.list.length - 1; }
}
