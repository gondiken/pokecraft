// T42: the physics and rules of the Portal House's swirls, pure (no imports but mover.js, no three.js, no game: Node-runnable, so the
// spec and tests/portalcheck.mjs can use it without a browser). The live part (portalhouselive.js) only calls these.
//
// A swirl (a record made by portalhouse.js) is a disc you walk or fall into:
//   { id, room, kind: 'slot' | 'peach' | 'orange' | 'door' | 'warp' | 'pair', colour, face: 'wall' | 'floor' | 'ceiling',
//     normal: [nx, ny, nz] (the way you come out), centre: [x, y, z] (the middle of the front face), w, h (the disc: a wall swirl is w wide
//     and h tall; a floor or ceiling one is w along x and h along z), cells (the solid slab behind it), lean?: { dir: [dx, dz], deg },
//     soft?: true (you always come out gently), pair?: id (a pink pair), to?: [x, y, z, yaw] (a warp),
//     move?: { axis: 'x' | 'y' | 'z', from, to, period } (it slides to and fro with the room clock; the old form { y0, y1, period } is the y axis) }
// "In one, out the other": your teal swirl (on a white pad, kind 'slot') and the orange end are joined. The orange end is the room's
// fixed orange swirl(s), or (rooms 5-8, owner 2026-10-27) YOUR orange swirl, which sticks only on a peach pad (kind 'peach'): the pad
// decides the colour, so there is still one tap and no colour switch. Speedy in, speedy out: the speed you come out with is how far
// you fell (PORTAL.keep * sqrt(drop), at most PORTAL.maxSpeed); from PORTAL.step up you are flung out of the other swirl along a
// closed-form path (PATHS.fling), the same at 60 and 20 frames a second. Out of a ceiling swirl you keep your speed (`headOf`): round
// and round between a floor and a ceiling swirl you go faster and faster (the Loop Room).
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
  misses: 2,                         // after this many soft catches in one room (one trip) the room's tip shows
};
export const PLAYER = { hw: PORTAL.hw, ph: PORTAL.ph };
export const BALL = { hw: 0.25, ph: 0.5, every: 3, rest: 0.6 }; // the Swirl Ball (the Ball Room): its box, one from the pipe every 3 s

export const exitSpeed = drop => Math.min(PORTAL.maxSpeed, PORTAL.keep * Math.sqrt(Math.max(0, drop)));
// The fall a speed is worth (exitSpeed's other way round).
export const dropOf = speed => (Math.min(speed, PORTAL.maxSpeed) / PORTAL.keep) ** 2;
// Out of a ceiling swirl you keep your speed: the flight starts with this much fall already in it (0 for every other face, so the
// rooms with floor and wall swirls fly exactly as before).
export const headOf = (sw, speed) => (sw.face === 'ceiling' && !sw.soft && speed >= PORTAL.step ? dropOf(speed) : 0);
const frac = u => u - Math.floor(u);
// 0 -> 1 -> 0 over one period, starting at 0 and going up
export const triangle = (clock, period) => { const f = frac(clock / period); return f < 0.5 ? f * 2 : 2 - f * 2; };
const AX = { x: 0, y: 1, z: 2 };
const moveOf = m => (m.y0 != null ? { axis: 'y', from: m.y0, to: m.y1, period: m.period, phase: m.phase ?? 0 } : { phase: 0, ...m });

// The middle of the swirl's front face now (a moving swirl or pad slides along its rail with the room clock).
export function centreAt(sw, clock = 0) {
  if (!sw.move) return sw.centre;
  const m = moveOf(sw.move), c = [...sw.centre];
  c[AX[m.axis]] = m.from + (m.to - m.from) * triangle(clock + m.phase, m.period);
  return c;
}
// Is it going up (towards `to`) at that clock?
export const rising = (sw, clock) => !!sw.move && frac((clock + moveOf(sw.move).phase) / sw.move.period) < 0.5;

// Does a box (feet / bottom at pos, PLAYER unless given) touch the swirl whose front face has its middle at c? `loose` is the wider test
// for a flight (a fast fling moves 0.3 blocks between two samples).
export function touches(sw, c, pos, loose = false, box = PLAYER) {
  const { hw, ph } = box, T = loose ? PORTAL.loose : PORTAL.touch;
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
// Where a box comes out of swirl `sw` (middle c) at `speed`: { pos (feet), yaw (null = keep yours), vel (null = it just steps out) }.
// The player comes out of a wall swirl with the feet at the bottom of the disc; the ball (any other box) out of its middle.
export function exitOf(sw, c, speed = 0, box = PLAYER) {
  const fling = speed >= PORTAL.step && !sw.soft;
  const [nx, ny, nz] = sw.normal;
  if (sw.face === 'wall') {
    const y = box === PLAYER ? c[1] - sw.h / 2 + 0.02 : c[1] - box.ph / 2;
    const out = box === PLAYER ? 0.8 : box.hw + 0.3;
    const pos = [c[0] + nx * out, y, c[2] + nz * out];
    return { pos, yaw: Math.atan2(-nx, -nz), vel: fling ? [nx * speed, 0, nz * speed] : null };
  }
  if (sw.face === 'floor') {
    const pos = [c[0], c[1] + 0.02, c[2]];
    if (!fling) return { pos, yaw: null, vel: null };
    const lean = sw.lean ? (sw.lean.deg * Math.PI) / 180 : 0, d = sw.lean?.dir ?? [0, 0];
    const dir = norm([d[0] * Math.sin(lean), Math.cos(lean), d[1] * Math.sin(lean)]);
    return { pos, yaw: null, vel: dir.map(a => a * speed) };
  }
  return { pos: [c[0], c[1] - box.ph - 0.02, c[2]], yaw: null, vel: fling ? [0, -speed, 0] : null }; // out of a ceiling: you drop
}

/* ---------- the fling ---------- */
export const flingPoint = (p0, v, g, t) => [p0[0] + v[0] * t, p0[1] + v[1] * t - (g * t * t) / 2, p0[2] + v[2] * t];
// A closed-form Mover path: from, v, g, time (seconds), yaw (the player's yaw is not turned by a fling: pass the one to keep)
PATHS.fling = ({ from, v, g = PORTAL.flingG, time, yaw = 0 }) => ({
  time, loop: false,
  at(t) { const k = Math.min(Math.max(t, 0), time), p = flingPoint(from, v, g, k); return { x: p[0], y: p[1], z: p[2], yaw }; },
});

export function boxHits(solid, p, box = PLAYER) {
  const { hw, ph } = box;
  const x0 = Math.floor(p[0] - hw), x1 = Math.floor(p[0] + hw), z0 = Math.floor(p[2] - hw), z1 = Math.floor(p[2] + hw);
  for (let y = Math.floor(p[1]); y <= Math.floor(p[1] + ph); y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (solid(x, y, z)) return true;
  return false;
}

// How far a fling goes: the box is checked every PORTAL.sample s against the blocks. `seek(pos, t)` may name a swirl the flight runs
// into (the flight ends there). Returns { time, end: [x, y, z], hit: swirl | null, blocked: boolean, peak (the highest feet y),
// vEnd: [vx, vy, vz], speedEnd }. A fling never goes through a block: it ends at the last free sample.
export function flingFlight(solid, p0, v, g = PORTAL.flingG, seek = null, maxT = 8, box = PLAYER) {
  const step = PORTAL.sample;
  let last = 0, hit = null, blocked = false;
  for (let i = 0; i * step <= maxT; i++) {
    const t = i * step, p = flingPoint(p0, v, g, t);
    if (p[1] < 0.3 || boxHits(solid, p, box)) { blocked = true; break; }
    last = t;
    if (i > 0 && seek) { const sw = seek(p, t); if (sw) { hit = sw; break; } }
  }
  const end = flingPoint(p0, v, g, last), vEnd = [v[0], v[1] - g * last, v[2]];
  const peak = v[1] > 0 && v[1] / g < last ? p0[1] + (v[1] * v[1]) / (2 * g) : Math.max(p0[1], end[1]); // the highest feet y of the flight
  return { time: last, end, hit, blocked, peak, vEnd, speedEnd: Math.hypot(...vEnd) };
}
// The fall a flight that ran into swirl `hit` is worth: from its highest point down to the swirl, plus what it carried out of a ceiling.
export const flightDrop = (f, hitCentreY, head = 0) => Math.max(0, f.peak - hitCentreY) + head;

/* ---------- aiming ---------- */
// The slot you aim at: the pad nearest the crosshair inside a cone (degrees; a big pad counts a little wider), within reach, with a clear
// line from the eye. slots = [{ id, centre, normal, w, h, face }] (a moving pad: pass `at(s)` for its middle now); solid(x, y, z) for the
// line; skip = ids not to count (the pads your swirls are on already). Returns { slot, angle } or null.
export function slotAimed(eye, dir, slots, cone, solid, skip = null, at = s => s.centre) {
  const skipped = skip == null ? [] : Array.isArray(skip) ? skip : [skip];
  let best = null;
  for (const s of slots) {
    if (skipped.includes(s.id)) continue;
    const c = at(s), v = [c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]], dist = Math.hypot(...v);
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

/* ---------- the Swirl Ball ---------- */
// The ball's way, one piece at a time (the live part asks for the next piece when the ball gets to the end of this one, with the
// swirls as they are then; the spec and portalcheck run the same pieces): a piece is a flight under PORTAL.flingG from p0 with v.
// `swirls(t)` lists the swirls the ball may run into. Returns { p0, v, time, end, hit, peak } like flingFlight.
export const ballPiece = (solid, p0, v, swirls, head = 0) => {
  const seek = q => { for (const s of swirls) if (touches(s, s.centre, q, true, BALL)) return s; return null; };
  return { p0, v, head, ...flingFlight(solid, p0, v, PORTAL.flingG, seek, 8, BALL) };
};
// Does the ball rest (something solid just under it)?
export const ballRests = (solid, p) => boxHits(solid, [p[0], p[1] - 0.06, p[2]], { hw: BALL.hw - 0.05, ph: 0.01 });
// The first piece: out of the pipe's mouth (the ball's bottom at `mouth`), straight down. The swirls count only when both ends are there.
export const ballStart = (solid, mouth, pair) => ballPiece(solid, [...mouth], [0, 0, 0], pair.teal && pair.orange ? [pair.teal, pair.orange] : []);
// The piece after `piece` (with the swirls `pair` = { teal, orange } as they are now), or null when the ball rests. Out of a swirl it
// flies like you do; a flight that bumps into a wall drops straight down from there.
export function ballNext(solid, piece, pair) {
  const ends = pair.teal && pair.orange ? [pair.teal, pair.orange] : [];
  if (piece.hit) {
    const into = piece.hit, out = into === pair.teal ? pair.orange : into === pair.orange ? pair.teal : null;
    if (!out) return ballPiece(solid, piece.end, [0, Math.min(0, piece.vEnd[1]), 0], []);
    const speed = exitSpeed(flightDrop(piece, into.centre[1], piece.head));
    const ex = exitOf(out, out.centre, speed, BALL);
    return ballPiece(solid, ex.pos, ex.vel ?? [out.normal[0] * 2, out.normal[1] * 2, out.normal[2] * 2], ends.filter(s => s !== out), headOf(out, speed));
  }
  if (ballRests(solid, piece.end)) return null;
  return ballPiece(solid, piece.end, [0, Math.min(0, piece.vEnd[1]), 0], ends);
}
// A whole ball run from the pipe: the list of pieces and where it stops. Used by tests/portalcheck.mjs (which placements press the
// button) and the spec; the live part asks for the same pieces one by one.
export function ballRun(solid, mouth, pair) {
  const pieces = [ballStart(solid, mouth, pair)];
  for (let k = 0; k < 10; k++) { const next = ballNext(solid, pieces.at(-1), pair); if (!next) break; pieces.push(next); }
  const last = pieces.at(-1);
  return { pieces, end: last.end, rests: ballRests(solid, last.end) };
}
export const inCup = (cup, p) => p[0] >= cup.x0 && p[0] <= cup.x1 + 1 && p[1] >= cup.y0 && p[1] <= cup.y1 && p[2] >= cup.z0 && p[2] <= cup.z1 + 1;

/* ---------- progress ---------- */
export const roomKey = n => `pw:portal:room${n}`; // saved in `beaten`, n = 1..8 (rooms 1-4 kept their keys when the House grew to eight)
export const ROOMS_NEED = 8;
export function roomState(game) {
  const done = Array.from({ length: ROOMS_NEED }, (_, i) => game.beaten.includes(roomKey(i + 1)));
  const n = done.filter(Boolean).length;
  return { done, n, need: ROOMS_NEED, ready: n >= ROOMS_NEED };
}
