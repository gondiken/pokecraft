// T45: Trace!, the Sketchbook's skill game (pure, no imports, Node-runnable). A giant pencil draws a line while you keep your eye on its
// tip: the line grows while your view ray passes within the ring at the tip, and waits when it does not (never a fail: on the
// Eraser Hill the pencil is chased by Rubber the Eraser, who rubs the line back to the last star dot if he catches the tip).
// Everything is a function of dt-summed state, so 60 and 20 steps a second draw the same line (spec F).
export const TRACE = {
  straight: { speed: 1.6, ring: 1.5 },          // blocks / s, ring radius (blocks, at the tip)
  curl: { speed: 2.0, ring: 1.25 },
  race: { speed: 2.4, top: 3.4, gain: 0.25, ring: 1.15, eraser: [2.0, 2.2, 2.4], eraserWin: 0.1, eraserCap: 2.8, eraserDelay: 2.5, star: 8 },
  grace: 0.25,        // off the ring for less than this still counts as on (little hand wobbles)
  near: 1.5, far: 24, // the tip only counts when it is 1.5-24 blocks in front of the camera
  touch: 1.25,        // ring x1.25 on touch devices
  neat: 0.8,          // on-fraction for "Neat line!"
  wait: 3,            // after 3 s off: "Look at the pencil tip!" and the tip glows
  step: 0.5,          // cells of a line are sampled every half block
  dtMax: 0.1,
};

// def = { pts: [[x, y, z], ...], kind } -> a line you can ask for a place at any distance along it.
// pts: the line's middle in world x / z, y = the block row of the ink cells (you stand at y + 1). cells: the 2-wide ink cells in order
// of s ({ x, y, z, s }, each cell once, first come first kept); stars: star dots every TRACE.race.star blocks (race lines only).
export function lineOf(def) {
  const pts = def.pts, cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const len = cum[cum.length - 1];
  const seg = s => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; return i; };
  const at = s => {
    s = Math.max(0, Math.min(len, s));
    const i = seg(s), a = pts[i - 1], b = pts[i], k = cum[i] === cum[i - 1] ? 0 : (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  const dirAt = s => { // the heading in x / z (unit)
    const a = at(Math.max(0, s - 0.25)), b = at(Math.min(len, s + 0.25)), dx = b[0] - a[0], dz = b[2] - a[2], m = Math.hypot(dx, dz) || 1;
    return [dx / m, dz / m];
  };
  const cells = [], seen = new Map(); // xz -> rows already used there (a spiral stair passes over the same x / z 8 rows higher)
  for (let s = 0; s <= len + 1e-9; s += TRACE.step) {
    const p = at(s), [tx, tz] = dirAt(s), y = Math.round(p[1]);
    for (const w of [-0.5, 0.5]) {
      const x = Math.floor(p[0] - tz * w), z = Math.floor(p[2] + tx * w), key = x + ',' + z, rows = seen.get(key) ?? [];
      if (rows.some(r => Math.abs(r - y) <= 3)) continue;
      rows.push(y); seen.set(key, rows);
      cells.push({ x, y, z, s });
    }
  }
  const stars = [];
  if (def.kind === 'race') for (let s = TRACE.race.star; s < len - 2; s += TRACE.race.star) stars.push(s);
  return { pts, len, at, dirAt, cells, stars, kind: def.kind };
}

// How far the tip is from where you look: the distance from the tip to the view ray, or Infinity when the tip is too near, too far or behind.
export function aimDist(eye, dir, tip) {
  const vx = tip[0] - eye[0], vy = tip[1] - eye[1], vz = tip[2] - eye[2];
  const t = vx * dir[0] + vy * dir[1] + vz * dir[2];
  if (t < TRACE.near || t > TRACE.far) return Infinity;
  return Math.hypot(vx - dir[0] * t, vy - dir[1] * t, vz - dir[2] * t);
}

export const newTrace = (kind, k = 0) => ({ kind, k, s: 0, on: false, offFor: 0, onTime: 0, time: 0, speed: TRACE[kind].speed, eraser: 0, wait: null, rubbed: 0, done: false, off: Infinity });

// Advance a trace by dt (clamped to 0.1 s). eye / dir / tip are [x, y, z]; the tip tracks st.s on `line`.
export function traceStep(st, dt, { eye, dir, touch = false }, line, kind = st.kind, wins = 0) {
  if (st.done) return st;
  const cfg = TRACE[kind], d = Math.min(Math.max(dt, 0), TRACE.dtMax);
  const tip = line.at(st.s);
  st.off = aimDist(eye, dir, tip);
  const inRing = st.off <= cfg.ring * (touch ? TRACE.touch : 1);
  st.offFor = inRing ? 0 : st.offFor + d;
  st.on = inRing || st.offFor < TRACE.grace;
  st.time += d;
  if (st.on) {
    st.onTime += d;
    if (kind === 'race') st.speed = Math.min(cfg.top, st.speed + cfg.gain * d);
    st.s += st.speed * d;
    if (kind === 'race' && st.wait === null) st.wait = cfg.eraserDelay; // the first ink starts the eraser's count-down
  } else st.speed = cfg.speed;
  if (kind === 'race' && st.wait !== null) {
    if (st.wait > 0) st.wait -= d;
    else {
      st.eraser += Math.min(cfg.eraserCap, cfg.eraser[Math.min(st.k, cfg.eraser.length - 1)] + cfg.eraserWin * wins) * d;
      if (st.eraser >= st.s - 1 && st.s > 0) { // caught the tip: rub back to the last star dot
        st.s = line.stars.filter(x => x <= st.s).pop() ?? 0;
        st.eraser = 0; st.rubbed++; st.wait = cfg.eraserDelay; st.speed = cfg.speed;
      }
    }
  }
  if (st.s >= line.len) { st.s = line.len; st.done = true; }
  return st;
}
export const neatFraction = st => (st.time > 0 ? st.onTime / st.time : 1);
