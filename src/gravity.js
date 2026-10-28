// Cube Planets, step 0 (plans/cube-planets.md section 3): gravity on cube planets. Pure (no imports), Node-runnable.
//
// - A FRAME is one of the 24 quarter-turns of the block grid: local axis c points along world axis `axis[c]` with sign `sign[c]`.
//   Local y is "up on this face". Turning a point or a speed between local and world is a swap of numbers and a sign flip, so it is
//   exact (no rounding, ever). FRAMES[0] is upright (local = world).
// - downAt(planets, pos, prev): which planet pulls you and which way is down (one of 6 grid directions), with hysteresis so an edge
//   never flickers. Outside every field: a soft pull toward the nearest planet (`soft`).
// - stepFlight / flightAt / flightLand: the flight of a body with no stick input, in the same 1/120 s sub-steps and with the same sums
//   as the player (player.js frame branch), so a jump lands exactly where flightLand says, at any frame rate. Inside one field each
//   sub-step is an exact piece of the parabola; the field / face is checked at every sub-step.
// - frameWorld(world, frame): a view of a world in a frame's local cells (get / isSolid), so the player's usual box collision works
//   unchanged on a sideways face.
// Round planets later (section 3.6): downAt already returns a vector `down`; a round planet would be a new downAt and a non-grid
// player mode, nothing here would have to change for cubes.

export const GRAV = {
  hys: 0.4,          // a new down axis on the same planet must win by this much (blocks): no flicker on an edge
  hysPlanet: 0.4,    // the same between two planets' fields
  soft: 0.15,        // outside every field: this share of the nearest planet's pull
  catchAfter: 6,     // seconds outside every field before the catch puff takes you back to the last face you stood on
  base: 28,          // the main world's gravity (player.js: 28 * g)
  jump: 8.6, walk: 4.3, sprint: 6.2, // as everywhere
  air: 10,           // blocks/s^2: how fast the stick changes your speed in the air (with no stick you keep your speed)
  fall: 19,          // the fastest fall (as in player.js)
  step: 1 / 120,     // the fixed sub-step (60 and 20 frames a second give the same sub-steps)
  turn: 0.45,        // seconds: the camera eases to a new up
  bigTurn: 0.8,      // ... and more slowly when the new up is far from the screen's up
  bigAngle: 120,     // degrees
  mid: 0.9,          // the middle of the body above the feet (half the player's 1.8)
};

/* ---------------------------------------------------------------- the 24 frames */
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const parity = p => (p[0] === 0 ? (p[1] === 1 ? 1 : -1) : p[0] === 1 ? (p[1] === 2 ? 1 : -1) : (p[1] === 0 ? 1 : -1));
export const FRAMES = [];
for (const p of PERMS) for (let s = 0; s < 8; s++) {
  const sign = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
  if (parity(p) * sign[0] * sign[1] * sign[2] !== 1) continue; // a turn, never a mirror
  const m = new Array(9).fill(0); // row-major, world = m * local
  for (let c = 0; c < 3; c++) m[p[c] * 3 + c] = sign[c];
  FRAMES.push({ i: FRAMES.length, axis: [...p], sign, m });
}
const KEY = f => f.m.join();
const BY_KEY = new Map(FRAMES.map(f => [KEY(f), f.i]));

// world vector of a local one (out may be the same array as v)
export function toWorld(fi, v, out = [0, 0, 0]) {
  const f = FRAMES[fi], a = v[0], b = v[1], c = v[2], l = [a, b, c];
  for (let k = 0; k < 3; k++) out[f.axis[k]] = f.sign[k] > 0 ? l[k] : -l[k];
  return out;
}
export function toLocal(fi, v, out = [0, 0, 0]) {
  const f = FRAMES[fi], w = [v[0], v[1], v[2]];
  for (let k = 0; k < 3; k++) out[k] = f.sign[k] > 0 ? w[f.axis[k]] : -w[f.axis[k]];
  return out;
}
// The world up of a frame (local +y), and its down.
export const upOf = fi => { const f = FRAMES[fi], u = [0, 0, 0]; u[f.axis[1]] = f.sign[1]; return u; };
export const downOf = fi => upOf(fi).map(v => -v || 0);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// The frame you get from `fi` when down turns to `down` (a grid direction): the smallest turn (90 degrees about the edge you go over,
// or 180 degrees about the local x axis when down flips). Your yaw stays the same, so "forward" carries on over the edge.
export function turnTo(fi, down) {
  const d0 = downOf(fi);
  if (same(d0, down)) return fi;
  const f = FRAMES[fi], col = c => { const v = [0, 0, 0]; v[f.axis[c]] = f.sign[c]; return v; };
  let Q;
  if (dot(d0, down) < 0) { const k = col(0); Q = v => { const kv = dot(k, v); return [2 * k[0] * kv - v[0], 2 * k[1] * kv - v[1], 2 * k[2] * kv - v[2]]; }; }
  else { const k = cross(d0, down); Q = v => { const kv = dot(k, v), kx = cross(k, v); return [kx[0] + k[0] * kv, kx[1] + k[1] * kv, kx[2] + k[2] * kv]; }; }
  const m = new Array(9).fill(0);
  for (let c = 0; c < 3; c++) { const w = Q(col(c)); for (let r = 0; r < 3; r++) m[r * 3 + c] = w[r] || 0; }
  return BY_KEY.get(m.join());
}
// The usual frame for a down when nothing came before (a new world, a puff): upright on top, else the smallest turn from upright.
export const frameOf = down => turnTo(0, down);

/* ---------------------------------------------------------------- which way is down */
// A planet: { x0, y0, z0, x1, y1, z1 } = its solid box in world units (x1 = the last block + 1), reach = how far its field goes, g.
// DIRS: the 6 ways out of a box, in the order that wins a tie (top first).
const DIRS = [[1, 1], [1, -1], [0, 1], [0, -1], [2, 1], [2, -1]]; // [axis, sign]
const LO = ['x0', 'y0', 'z0'], HI = ['x1', 'y1', 'z1'];
const outOf = (P, p, axis, sign) => (sign > 0 ? p[axis] - P[HI[axis]] : P[LO[axis]] - p[axis]);
const P3 = p => (Array.isArray(p) ? p : [p.x, p.y, p.z]);
// How far a point is outside the box (the largest of the six; below 0 inside).
export function boxDist(P, p) { const q = P3(p); let d = -Infinity; for (const [a, s] of DIRS) d = Math.max(d, outOf(P, q, a, s)); return d; }

// -> { planet, axis, sign, down, field, soft, g, dist, hop }. `prev` = the last answer (hysteresis), or null. `centre` = the middle of
// the body (feet + up x GRAV.mid): which planet pulls you is decided by your middle (so in a hop your head never bumps the next planet
// before its pull wins), which side of it by your feet (so walking over an edge turns you round your feet). `hop`: another planet took
// over; the body then turns round its middle (centreOf / pivot).
export function downAt(planets, pos, prev = null, centre = null) {
  const p = P3(pos), c = centre ? P3(centre) : p;
  let best = -1, bestD = Infinity, prevD = Infinity;
  for (let i = 0; i < planets.length; i++) {
    const d = boxDist(planets[i], c);
    if (d < bestD) { bestD = d; best = i; }
    if (prev && i === prev.planet) prevD = d;
  }
  if (best < 0) return null;
  let i = best;
  if (prev && prev.planet >= 0 && prev.planet < planets.length && prev.planet !== best && prevD <= bestD + GRAV.hysPlanet) i = prev.planet;
  const P = planets[i], dist = i === best ? bestD : prevD, field = dist <= P.reach;
  const hop = !!prev && prev.planet !== i, q = hop ? c : p;
  let axis = 1, sign = 1, bo = -Infinity;
  for (const [a, s] of DIRS) { const o = outOf(P, q, a, s); if (o > bo) { bo = o; axis = a; sign = s; } }
  if (prev && !hop && (prev.axis !== axis || prev.sign !== sign) && outOf(P, q, prev.axis, prev.sign) >= bo - GRAV.hys) { axis = prev.axis; sign = prev.sign; }
  const down = [0, 0, 0]; down[axis] = -sign;
  return { planet: i, axis, sign, down, field, soft: !field, g: P.g * (field ? 1 : GRAV.soft), dist, hop };
}
// The middle of a body standing in frame fi with its feet at pos, and where its feet go when it turns round that middle into frame nf.
export const centreOf = (pos, fi) => { const p = P3(pos), u = upOf(fi); return [p[0] + u[0] * GRAV.mid, p[1] + u[1] * GRAV.mid, p[2] + u[2] * GRAV.mid]; };
export const pivot = (pos, fi, nf) => { const c = centreOf(pos, fi), u = upOf(nf); return [c[0] - u[0] * GRAV.mid, c[1] - u[1] * GRAV.mid, c[2] - u[2] * GRAV.mid]; };

/* ---------------------------------------------------------------- flights */
// A body: { pos: [x, y, z] world, vel: [x, y, z] world, frame, grav (the last downAt), ground }. One sub-step of a flight with no stick
// input: the same rules and sums as player.js's frame branch (the face changes first, then x, z, y moves in the local frame).
// Over an edge of the same planet the speed turns with you (your local speed is kept); into another planet's field the speed in the
// world is kept and the new pull bends it. Returns 'turn' when down changed this sub-step.
export function stepFlight(body, planets, h = GRAV.step) {
  const gd = downAt(planets, body.pos, body.grav, centreOf(body.pos, body.frame));
  let turned = false;
  if (!same(gd.down, downOf(body.frame))) {
    const nf = turnTo(body.frame, gd.down), np = gd.hop ? pivot(body.pos, body.frame, nf) : body.pos;
    if (!body.blocked?.(nf, np)) {
      const edge = body.grav && body.grav.planet === gd.planet && body.grav.field && gd.field;
      if (edge) toWorld(nf, toLocal(body.frame, body.vel), body.vel); // the speed turns with the frame
      if (np !== body.pos) { body.pos[0] = np[0]; body.pos[1] = np[1]; body.pos[2] = np[2]; }
      body.frame = nf; body.grav = gd; turned = true; body.ground = false;
    }
  } else body.grav = gd;
  const G = GRAV.base * body.grav.g;
  const lp = toLocal(body.frame, body.pos), lv = toLocal(body.frame, body.vel);
  lp[0] += lv[0] * h; lp[2] += lv[2] * h;
  const dy = lv[1] * h - 0.5 * G * h * h;
  lv[1] -= G * h;
  if (lv[1] < -GRAV.fall) lv[1] = -GRAV.fall;
  lp[1] += dy;
  toWorld(body.frame, lp, body.pos); toWorld(body.frame, lv, body.vel);
  return turned ? 'turn' : null;
}
const newBody = (p0, v0, opts) => {
  const pos = [...P3(p0)], vel = [...P3(v0)], grav = opts.grav ?? downAt(opts.planets, pos, null);
  return { pos, vel, grav, frame: opts.frame ?? frameOf(grav.down), ground: false };
};
// Where a flight is after t seconds (no blocks, no stick): { pos, vel, frame, grav }.
export function flightAt(p0, v0, planets, t, opts = {}) {
  const b = newBody(p0, v0, { ...opts, planets }), h = opts.h ?? GRAV.step, n = Math.round(t / h);
  for (let k = 0; k < n; k++) stepFlight(b, planets, h);
  return b;
}
// Where a flight lands: the first sub-step whose move would take the feet into its planet's box along down. The landing is the face
// itself (as player.js's moveAxis puts you there). -> { pos, frame, planet, t, steps, turns } or null (no landing within maxT).
export function flightLand(p0, v0, planets, opts = {}) {
  const b = newBody(p0, v0, { ...opts, planets }), h = opts.h ?? GRAV.step, max = Math.round((opts.maxT ?? 8) / h);
  let turns = 0;
  for (let k = 1; k <= max; k++) {
    const before = [...b.pos];
    if (stepFlight(b, planets, h)) turns++;
    const P = planets[b.grav.planet], o = outOf(P, b.pos, b.grav.axis, b.grav.sign), inFace = [0, 1, 2].every(a => a === b.grav.axis || (b.pos[a] > P[LO[a]] - 0.3 && b.pos[a] < P[HI[a]] + 0.3));
    if (o <= 0 && inFace) {
      b.pos[b.grav.axis] = b.grav.sign > 0 ? P[HI[b.grav.axis]] : P[LO[b.grav.axis]];
      return { pos: b.pos, frame: b.frame, planet: b.grav.planet, axis: b.grav.axis, sign: b.grav.sign, t: k * h, steps: k, turns, from: before };
    }
    opts.each?.(b); // (cubecheck.mjs: the body's box never meets a planet in the air)
  }
  return null;
}

/* ---------------------------------------------------------------- the world seen from a frame */
// Local cell (lx, ly, lz) covers [l, l + 1) on each local axis; it is world cell: sign > 0 ? l : -l - 1 on that frame's axis.
export function cellToWorld(fi, lx, ly, lz) {
  const f = FRAMES[fi], l = [lx, ly, lz], w = [0, 0, 0];
  for (let k = 0; k < 3; k++) w[f.axis[k]] = f.sign[k] > 0 ? l[k] : -l[k] - 1;
  return w;
}
// The view the player's collision code uses in a frame. `g` = the gravity factor of the pull right now.
export function frameWorld(world, fi) {
  const f = FRAMES[fi], A = f.axis, S = f.sign;
  const wc = (l, k) => (S[k] > 0 ? l : -l - 1);
  const W = (lx, ly, lz) => { const w = [0, 0, 0]; w[A[0]] = wc(lx, 0); w[A[1]] = wc(ly, 1); w[A[2]] = wc(lz, 2); return w; };
  return {
    frame: fi, world,
    get(x, y, z) { const w = W(x, y, z); return world.get(w[0], w[1], w[2]); },
    isSolid(x, y, z) { const w = W(x, y, z); return world.isSolid(w[0], w[1], w[2]); },
    fenced: () => false, fenceAt: () => null,
  };
}
