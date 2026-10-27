// T42: the physics and rules of the Portal House's swirls, pure (no imports but mover.js, no three.js, no game: Node-runnable, so the
// spec and tests/portalcheck.mjs can use it without a browser). The live part (portalhouselive.js) only calls these.
//
// A swirl (a record made by portalhouse.js) is a disc you walk or fall into:
//   { id, room, kind: 'slot' | 'orange' | 'door' | 'warp' | 'pair', colour, face: 'wall' | 'floor' | 'ceiling',
//     normal: [nx, ny, nz] (the way you come out), centre: [x, y, z] (the middle of the front face), w, h (the disc: a wall swirl is w wide
//     and h tall; a floor or ceiling one is w along x and h along z), cells (the solid slab behind it), lean?: { dir: [dx, dz], deg },
//     soft?: true (you always come out gently), pair?: id (a pink pair), to?: [x, y, z, yaw] (a warp), move?: { y0, y1, period } }
// "In one, out the other": your swirl (a slot with your swirl on it) and the room's orange swirls are joined. Speedy in, speedy out:
// the speed you come out with is how far you fell (PORTAL.keep * sqrt(drop), at most PORTAL.maxSpeed); from PORTAL.step up you are
// flung out of the other swirl along a closed-form path (PATHS.fling), the same at 60 and 20 frames a second.
import { PATHS } from './mover.js';

export const PORTAL = {
  reach: 32, cone: 8, coneAir: 20,   // how far you can aim a tap, and how wide the help cone is (degrees: on the ground, flying)
  step: 5,                           // below this speed you just step out; at or above it you are flung
  keep: 3.2, maxSpeed: 15,           // speed = keep * sqrt(drop in blocks), capped
  flingG: 14,                        // half the normal gravity: you float a little after a swirl
  ignore: 0.4,                       // seconds a swirl you came out of is ignored
  loops: 4,                          // trips through the same pair without touching ground before the loop stops
  sample: 0.02,                      // the fling is checked against the blocks every 0.02 s
  touch: 0.12, loose: 0.55,          // how close to a wall swirl's face you must be (walking / flying)
  hw: 0.3, ph: 1.8,                  // the player's box
};

export const exitSpeed = drop => Math.min(PORTAL.maxSpeed, PORTAL.keep * Math.sqrt(Math.max(0, drop)));
const frac = u => u - Math.floor(u);
// 0 -> 1 -> 0 over one period, starting at 0 and going up
export const triangle = (clock, period) => { const f = frac(clock / period); return f < 0.5 ? f * 2 : 2 - f * 2; };

// The middle of the swirl's front face now (a moving swirl slides up and down its rail).
export function centreAt(sw, clock = 0) {
  if (!sw.move) return sw.centre;
  const { y0, y1, period } = sw.move;
  return [sw.centre[0], y0 + (y1 - y0) * triangle(clock, period), sw.centre[2]];
}
// Is it going up at that clock?
export const rising = (sw, clock) => !!sw.move && frac(clock / sw.move.period) < 0.5;

// Does the player's box (feet at pos) touch the swirl whose front face has its middle at c? `loose` is the wider test for a
// flight (a fast fling moves 0.3 blocks between two samples).
export function touches(sw, c, pos, loose = false) {
  const { hw, ph } = PORTAL, T = loose ? PORTAL.loose : PORTAL.touch;
  if (sw.face === 'wall') {
    const [nx, , nz] = sw.normal;
    const d = nx ? (nx > 0 ? (pos[0] - hw) - c[0] : c[0] - (pos[0] + hw)) : (nz > 0 ? (pos[2] - hw) - c[2] : c[2] - (pos[2] + hw));
    if (d > T || d < -1.3) return false; // -1.3: a door alcove is one block deep (a slow frame can put you at its back)
    const lat = nx ? pos[2] - c[2] : pos[0] - c[0];
    if (Math.abs(lat) > sw.w / 2 + hw * 0.5) return false;
    return pos[1] + ph > c[1] - sw.h / 2 + 0.1 && pos[1] < c[1] + sw.h / 2 - 0.1;
  }
  if (Math.abs(pos[0] - c[0]) > sw.w / 2 + 0.15 || Math.abs(pos[2] - c[2]) > sw.h / 2 + 0.15) return false;
  if (sw.face === 'floor') return pos[1] >= c[1] - 0.2 && pos[1] <= c[1] + (loose ? 0.7 : 0.15);
  const head = pos[1] + ph; // a ceiling swirl: your head touches it
  return head >= c[1] - T && head <= c[1] + 0.2;
}

const norm = v => { const l = Math.hypot(...v) || 1; return v.map(a => a / l); };
// Where you come out of swirl `sw` (middle c) at `speed`: { pos (feet), yaw (null = keep yours), vel (null = you just step out) }.
export function exitOf(sw, c, speed = 0) {
  const fling = speed >= PORTAL.step && !sw.soft;
  const [nx, ny, nz] = sw.normal;
  if (sw.face === 'wall') {
    const pos = [c[0] + nx * 0.8, c[1] - sw.h / 2 + 0.02, c[2] + nz * 0.8];
    return { pos, yaw: Math.atan2(-nx, -nz), vel: fling ? [nx * speed, 0, nz * speed] : null };
  }
  if (sw.face === 'floor') {
    const pos = [c[0], c[1] + 0.02, c[2]];
    if (!fling) return { pos, yaw: null, vel: null };
    const lean = sw.lean ? (sw.lean.deg * Math.PI) / 180 : 0, d = sw.lean?.dir ?? [0, 0];
    const dir = norm([d[0] * Math.sin(lean), Math.cos(lean), d[1] * Math.sin(lean)]);
    return { pos, yaw: null, vel: dir.map(a => a * speed) };
  }
  return { pos: [c[0], c[1] - PORTAL.ph - 0.02, c[2]], yaw: null, vel: fling ? [0, -speed, 0] : null }; // out of a ceiling: you drop
}

/* ---------- the fling ---------- */
export const flingPoint = (p0, v, g, t) => [p0[0] + v[0] * t, p0[1] + v[1] * t - (g * t * t) / 2, p0[2] + v[2] * t];
// A closed-form Mover path: from, v, g, time (seconds), yaw (the player's yaw is not turned by a fling: pass the one to keep)
PATHS.fling = ({ from, v, g = PORTAL.flingG, time, yaw = 0 }) => ({
  time, loop: false,
  at(t) { const k = Math.min(Math.max(t, 0), time), p = flingPoint(from, v, g, k); return { x: p[0], y: p[1], z: p[2], yaw }; },
});

export function boxHits(solid, p) {
  const { hw, ph } = PORTAL;
  const x0 = Math.floor(p[0] - hw), x1 = Math.floor(p[0] + hw), z0 = Math.floor(p[2] - hw), z1 = Math.floor(p[2] + hw);
  for (let y = Math.floor(p[1]); y <= Math.floor(p[1] + ph); y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (solid(x, y, z)) return true;
  return false;
}

// How far a fling goes: the player's box is checked every PORTAL.sample s against the blocks. `seek(pos, t)` may name a swirl the
// flight runs into (the flight ends there). Returns { time, end: [x, y, z], hit: swirl | null, blocked: boolean, peak (the highest
// feet y), vEnd: [vx, vy, vz], speedEnd }. A fling never goes through a block: it ends at the last free sample.
export function flingFlight(solid, p0, v, g = PORTAL.flingG, seek = null, maxT = 8) {
  const step = PORTAL.sample;
  let last = 0, hit = null, blocked = false;
  for (let i = 0; i * step <= maxT; i++) {
    const t = i * step, p = flingPoint(p0, v, g, t);
    if (p[1] < 0.3 || boxHits(solid, p)) { blocked = true; break; }
    last = t;
    if (i > 0 && seek) { const sw = seek(p, t); if (sw) { hit = sw; break; } }
  }
  const end = flingPoint(p0, v, g, last), vEnd = [v[0], v[1] - g * last, v[2]];
  const peak = v[1] > 0 && v[1] / g < last ? p0[1] + (v[1] * v[1]) / (2 * g) : Math.max(p0[1], end[1]); // the highest feet y of the flight
  return { time: last, end, hit, blocked, peak, vEnd, speedEnd: Math.hypot(...vEnd) };
}

/* ---------- aiming ---------- */
// The slot you aim at: the white pad nearest the crosshair inside a cone (degrees; a big pad counts a little wider), within reach,
// with a clear line from the eye. slots = [{ id, centre, normal, w, h, face }]; solid(x, y, z) for the line. Returns { slot, angle } or null.
export function slotAimed(eye, dir, slots, cone, solid, skip = null) {
  let best = null;
  for (const s of slots) {
    if (s.id === skip) continue;
    const c = s.centre, v = [c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]], dist = Math.hypot(...v);
    if (dist > PORTAL.reach || dist < 0.5) continue;
    const dot = (v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / dist;
    const angle = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
    const wide = (Math.atan2(Math.max(s.w, s.h) / 2, dist) * 180) / Math.PI; // a big pad is easier to hit
    if (angle > cone + wide) continue;
    if (solid && !clearLine(solid, eye, [c[0] + s.normal[0] * 0.4, c[1] + s.normal[1] * 0.4, c[2] + s.normal[2] * 0.4])) continue;
    if (!best || angle - wide < best.angle - best.wide) best = { slot: s, angle, wide };
  }
  return best;
}
export function clearLine(solid, a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], n = Math.ceil(Math.hypot(...d) / 0.25);
  for (let i = 1; i < n; i++) { const k = i / n; if (solid(Math.floor(a[0] + d[0] * k), Math.floor(a[1] + d[1] * k), Math.floor(a[2] + d[2] * k))) return false; }
  return true;
}

/* ---------- progress ---------- */
export const roomKey = n => `pw:portal:room${n}`; // saved in `beaten`, n = 1..4
export const ROOMS_NEED = 4;
export function roomState(game) {
  const done = Array.from({ length: ROOMS_NEED }, (_, i) => game.beaten.includes(roomKey(i + 1)));
  const n = done.filter(Boolean).length;
  return { done, n, need: ROOMS_NEED, ready: n >= ROOMS_NEED };
}
