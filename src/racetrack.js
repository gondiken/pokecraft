// T40c: the Race Track in Playland's `race` zone. Pure data and maths (imports only blocks.js and picturelands.js, so the spec runs it in Node):
// the track as pieces of a centreline, `makeTrack()` (where a lap is, flags, boost pads), Racer Rio's speed with the rubber
// band (`bossSpeed`, `raceRun` to simulate a race), the wild Racers' spawn table and `buildRaceTrack`, the part builder that
// Playland's PLAYLAND_PARTS.race calls (it writes only inside the race zone box). The live race is in racelive.js.
import { B, WOOL } from './blocks.js';
import { kit, placeBoss, placeCrew } from './picturelands.js'; // pure too (blocks.js and pictureworlds.js only)

// Race tunables. Rio's speed is a closed form of his track distance (see bossSpeed); lead = bossS - your progress.
export const RACE = {
  laps: 2, lane: 1.5, grid: -1.5,                 // Rio's lane; both start 1.5 behind the line
  count: 3, hold: 1.2,                            // countdown seconds; how far you may move before GO
  speed: { straight: 6.0, corner: 5.0, chicane: 4.4, boost: 7.6 },
  band: { near: 1, slow: 0.08, min: 0.55, behind: 3, fast: 0.03, max: 1.12, ease: 0.06, final: 45, cap: [0.75, 0.5, 0.35] },
  boost: { dist: 5, speed: 14 },                  // a boost pad zooms you 5 blocks at 14 blocks/s
  leave: 40,                                      // further than this from the track ends the race
  parade: { speed: 5, lanes: [-1.5, 1.5] },
  half: 3.5,                                      // half the width of the track
};
export const TRACK_ORIGIN = { ox: 68, oz: 96 };  // local (u, v) -> world x = ox + u, z = oz - v
const R = 8;
// The centreline in local coordinates, in driving order from the start line. Arcs run counter-clockwise (angle grows) in (u, v).
export const TRACK = [
  { type: 'line', from: [28, 22], to: [64, 22], kind: 'straight' },
  { type: 'arc', c: [64, 30], a0: -Math.PI / 2, a1: 0, kind: 'corner' },
  { type: 'line', from: [72, 30], to: [72, 46], kind: 'straight' },
  { type: 'arc', c: [64, 46], a0: 0, a1: Math.PI / 2, kind: 'corner' },
  { type: 'line', from: [64, 54], to: [54, 54], kind: 'straight' },
  { type: 'line', from: [54, 54], to: [48, 48], kind: 'chicane' },
  { type: 'line', from: [48, 48], to: [40, 48], kind: 'chicane' },
  { type: 'line', from: [40, 48], to: [34, 54], kind: 'chicane' },
  { type: 'line', from: [34, 54], to: [24, 54], kind: 'straight' },
  { type: 'arc', c: [24, 46], a0: Math.PI / 2, a1: Math.PI, kind: 'corner' },
  { type: 'line', from: [16, 46], to: [16, 30], kind: 'straight' },
  { type: 'arc', c: [24, 30], a0: Math.PI, a1: Math.PI * 1.5, kind: 'corner' },
  { type: 'line', from: [24, 22], to: [28, 22], kind: 'straight' },
];
// Boost pads: local cells (u0..u1, v0..v1), the driving direction in local (du, dv) and the lap distance where Rio speeds up.
const PADS = [
  { u: [36, 39], v: [21, 23], dir: [1, 0], s0: 8 },
  { u: [71, 73], v: [32, 35], dir: [0, 1], s0: 50.6 },
  { u: [15, 17], v: [31, 34], dir: [0, -1], s0: 146.7 },
];
export const GATE_AT = [{ id: 'G0', piece: 0, off: 0 }, { id: 'G1', piece: 2, off: 8 }, { id: 'G2', piece: 4, off: 5 }, { id: 'G3', piece: 10, off: 8 }];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// The track, worked out in local coordinates and handed out in world coordinates (x = ox + u, z = oz - v).
export function makeTrack({ ox = TRACK_ORIGIN.ox, oz = TRACK_ORIGIN.oz, y = 10 } = {}) {
  let acc = 0;
  const pieces = TRACK.map((p, i) => {
    const len = p.type === 'arc' ? R * (p.a1 - p.a0) : Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    const q = { ...p, i, s0: acc, len };
    if (p.type === 'line') q.dir = [(p.to[0] - p.from[0]) / len, (p.to[1] - p.from[1]) / len];
    acc += len;
    return q;
  });
  const L = acc;
  const wrap = s => ((s % L) + L) % L;
  // local point on the piece at distance t along it, its unit tangent and lane `lane` to the left: { u, v, tu, tv }
  const local = (p, t, lane) => {
    if (p.type === 'line') {
      const [tu, tv] = p.dir;
      return { u: p.from[0] + tu * t - tv * lane, v: p.from[1] + tv * t + tu * lane, tu, tv };
    }
    const th = p.a0 + t / R, r = R - lane;
    return { u: p.c[0] + r * Math.cos(th), v: p.c[1] + r * Math.sin(th), tu: -Math.sin(th), tv: Math.cos(th) };
  };
  const pieceAt = s => { for (let i = pieces.length - 1; i >= 0; i--) if (s >= pieces[i].s0) return pieces[i]; return pieces[0]; };
  const toWorld = (l, kind) => ({ x: ox + l.u, z: oz - l.v, heading: Math.atan2(l.tu, -l.tv), kind });
  const pads = PADS.map(p => {
    const cells = [];
    for (let u = p.u[0]; u <= p.u[1]; u++) for (let v = p.v[0]; v <= p.v[1]; v++) cells.push([ox + u, oz - 1 - v]);
    return { cells, dir: [p.dir[0], -p.dir[1]], s0: p.s0 };
  });
  const track = {
    L, pieces, pads, ox, oz, y,
    kindAt(s) {
      const m = wrap(s);
      for (const p of pads) if (m >= p.s0 && m < p.s0 + 6) return 'boost';
      return pieceAt(m).kind;
    },
    // world position, heading (npc.js: 0 faces +z, PI / 2 faces +x) and kind at distance s along the lap, `lane` blocks to the left
    at(s, lane = 0) {
      const m = wrap(s), p = pieceAt(m);
      return toWorld(local(p, m - p.s0, lane), track.kindAt(m));
    },
    // the nearest centreline point to a world position: { s (0..L), d (distance), across (lane offset, left +), piece }
    project(x, z) {
      const pu = x - ox, pv = oz - z;
      let best = null;
      for (const p of pieces) {
        let t;
        if (p.type === 'line') t = clamp((pu - p.from[0]) * p.dir[0] + (pv - p.from[1]) * p.dir[1], 0, p.len);
        else {
          const span = p.a1 - p.a0, th = Math.atan2(pv - p.c[1], pu - p.c[0]);
          const delta = (((th - p.a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          t = delta <= span ? delta * R : (delta - span < 2 * Math.PI - delta ? p.len : 0);
        }
        const q = local(p, t, 0), d = Math.hypot(pu - q.u, pv - q.v);
        if (!best || d < best.d - 1e-9) best = { d, t, p, q };
      }
      const { q, p } = best;
      return { s: wrap(p.s0 + best.t), d: best.d, across: (pu - q.u) * -q.tv + (pv - q.v) * q.tu, piece: p.i };
    },
  };
  // the start line and the three flags, as lines across the track (6 blocks either side of the middle) and the way forward
  track.gates = GATE_AT.map(g => {
    const s = pieces[g.piece].s0 + g.off, mid = track.at(s, 0), a = track.at(s, -6), b = track.at(s, 6);
    return { id: g.id, s, x: mid.x, z: mid.z, heading: mid.heading, a: [a.x, a.z], b: [b.x, b.z], dir: [Math.sin(mid.heading), Math.cos(mid.heading)] };
  });
  return track;
}

// Rio's speed at track distance bossS when he leads by `lead` blocks (bossS - your progress) after `losses` lost races.
// Ahead of you he slows down, far behind he speeds up a little, every lost race makes him gentler, and he waves to the crowd at the end.
export function bossSpeed(bossS, lead, losses, track) {
  const b = RACE.band, end = RACE.laps * track.L;
  let f = 1;
  if (lead > b.near) f = Math.max(b.min, 1 - b.slow * (lead - b.near));          // ahead: slows down
  else if (lead < -b.behind) f = Math.min(b.max, 1 + b.fast * (-lead - b.behind)); // far behind: a little faster
  f *= 1 - b.ease * Math.min(losses, 3);                                          // gentler after every lost race
  if (bossS > end - b.final && (losses > 0 || lead > 0)) f = Math.min(f, b.cap[Math.min(losses, 2)]); // waves to the crowd
  return RACE.speed[track.kindAt(bossS)] * f;
}

// A whole race with a runner at a constant speed `v` along the centreline (no boosts): { winner: 'you' | 'rio', margin (blocks) }.
export function raceRun(v, losses, dt = 1 / 30, track = makeTrack()) {
  const end = RACE.laps * track.L;
  let me = RACE.grid, rio = RACE.grid;
  for (let i = 0; i < 100000; i++) {
    me += v * dt;
    rio += bossSpeed(rio, rio - me, losses, track) * dt;
    if (me >= end || rio >= end) return me >= end ? { winner: 'you', margin: rio < end ? end - rio : 0 } : { winner: 'rio', margin: end - me };
  }
  return { winner: 'none', margin: 0 };
}

// Wild Racers (only in Playland's race zone).
export const RACER_SPAWNS = [['vroomlet', 1.2], ['zipskate', 1.2], ['pitpig', 1.2], ['wheelie', 0.8], ['vroomster', 0.12], ['blastskate', 0.12], ['karthog', 0.1]];
// The track blocks wild creatures may stand on (grass is Playland's own).
export const RACE_WALK = [B.GRASS, B.ASPHALT, B.TRACK_LINE, B.KERB, B.CHECKER, B.BOOST_PAD];

/* ------------------------------ the builder ------------------------------ */

// Writes the Race Track into world.data, only inside zone.box. Y = the flat land top; throws if it is not what the base made.
export function buildRaceTrack(world, zone) {
  const { ox, oz } = TRACK_ORIGIN, Y = 10, box = zone.box;
  const track = makeTrack({ ox, oz, y: Y });
  if (world.ground[Math.floor((box.x0 + box.x1) / 2) + Math.floor((box.z0 + box.z1) / 2) * world.W] !== Y) throw new Error('Race Track: the land is not at y 10');
  // put(u, v, dy, id): the cell of local (u, v) at height Y + dy
  const put = (u, v, dy, id) => {
    const x = ox + u, z = oz - 1 - v, y = Y + dy;
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) throw new Error(`Race Track: cell ${x}, ${z} is outside the race zone`);
    world.data[world.index(x, y, z)] = id;
  };
  const RW = WOOL.racer, WW = WOOL.paper; // racer wool (orange) and white (paper wool)
  // 1. the surface: asphalt, kerbs on corners and the chicane, white edge lines on straights
  for (let u = 8; u <= 80; u++) for (let v = 6; v <= 63; v++) {
    const pr = track.project(ox + u + 0.5, oz - v - 0.5);
    if (pr.d <= 2.5) put(u, v, 0, B.ASPHALT);
    else if (pr.d <= RACE.half) put(u, v, 0, track.pieces[pr.piece].kind === 'straight' ? B.TRACK_LINE : B.KERB);
  }
  for (let u = 28; u <= 29; u++) for (let v = 19; v <= 25; v++) put(u, v, 0, B.CHECKER);
  for (const p of track.pads) for (const [x, z] of p.cells) world.data[world.index(x, Y, z)] = B.BOOST_PAD;
  // 2. tyre walls (1 high) outside each corner arc and along the fence row v = 15 (a gap for the walk in)
  for (const p of track.pieces) if (p.type === 'arc') {
    for (let u = 8; u <= 80; u++) for (let v = 6; v <= 63; v++) {
      const du = u + 0.5 - p.c[0], dv = v + 0.5 - p.c[1], r = Math.hypot(du, dv);
      if (r < 12.5 || r >= 13.5) continue;
      const delta = (((Math.atan2(dv, du) - p.a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (delta <= p.a1 - p.a0) put(u, v, 1, B.TYRE_WALL);
    }
  }
  for (let u = 10; u <= 78; u++) if (u < 40 || u > 48) put(u, 15, 1, B.TYRE_WALL);
  // 3. the grandstands: rows rising away from the track, the top block alternating racer and white wool
  for (const [u0, u1] of [[18, 38], [50, 70]]) for (let v = 6; v <= 13; v++) {
    const h = v >= 12 ? 1 : v >= 10 ? 2 : v >= 8 ? 3 : 4;
    for (let u = u0; u <= u1; u++) for (let k = 1; k <= h; k++) put(u, v, k, k === h && (v >> 1) % 2 === 0 ? RW : WW);
  }
  // 4. gantries: the start gantry (with three lamps) and the three flag arches
  const arch = (poles, beam, lamps) => {
    for (const [u, v] of poles) for (let k = 1; k <= 5; k++) put(u, v, k, WW);
    for (const [u, v] of beam) put(u, v, 6, (u + v) % 2 ? B.CHECKER : RW);
    for (const [u, v] of lamps || []) put(u, v, 5, B.START_LIGHT);
  };
  const row = (u0, v0, u1, v1) => { const out = []; for (let u = u0; u <= u1; u++) for (let v = v0; v <= v1; v++) out.push([u, v]); return out; };
  arch([[28, 17], [28, 27]], row(28, 17, 28, 27), [[28, 21], [28, 22], [28, 23]]);
  arch([[67, 38], [77, 38]], row(67, 38, 77, 38));
  arch([[59, 49], [59, 59]], row(59, 49, 59, 59));
  arch([[11, 38], [21, 38]], row(11, 38, 21, 38));
  // 5. the pit garage: white walls 3 high, a racer-wool roof, open on the +u side, a chequer floor and two tyre stacks inside
  for (let u = 28; u <= 38; u++) for (let v = 32; v <= 38; v++) {
    const wall = u === 28 || v === 32 || v === 38 || (u === 38 && (v < 33 || v > 37));
    if (wall) for (let k = 1; k <= 3; k++) put(u, v, k, WW);
    else put(u, v, 0, B.CHECKER);
    put(u, v, 4, RW);
  }
  for (const [u, v] of [[30, 34], [30, 36]]) { put(u, v, 1, B.TYRE_WALL); put(u, v, 2, B.TYRE_WALL); }
  // 6. festival bunting: white poles with a racer-wool flag on the fence row
  for (let u = 10; u <= 78; u += 4) if (u < 40 || u > 48) { for (let k = 2; k <= 4; k++) put(u, 15, k, WW); put(u, 15, 5, RW); }
  // 7. Racer Rio on his stand in the infield (he faces the hub), his two Pit Crew helpers outside the garage, the live part and the keep
  kit(world);
  placeBoss(world, 'race', { x: ox + 25, y: Y, z: oz - 1 - 28, facing: [0, 1] });
  placeCrew(world, 'race', 0, { x: ox + 40, y: Y, z: oz - 1 - 33, facing: [1, 0] });
  placeCrew(world, 'race', 1, { x: ox + 40, y: Y, z: oz - 1 - 36, facing: [1, 0] });
  const part = {
    id: 'race', live: 'race', track, y: Y,
    grid: { player: [ox + 26.5, Y + 1, oz - 20.5], boss: [ox + 26.5, Y + 1, oz - 23.5], heading: Math.PI / 2, yaw: -Math.PI / 2 }, // both face +x
    lights: [21, 22, 23].map(v => [ox + 28, Y + 5, oz - 1 - v]),
    pads: track.pads,
    box: { x0: ox + 8, x1: ox + 80, z0: oz - 64, z1: oz - 1 }, // the race area: the leave check and where the parade shows
  };
  world.parts.push(part);
  world.keeps.push({ name: 'Race Track', rideIn: true, wallText: "That's the race track! Keep it clear for racing.",
    protect: [{ x0: ox + 8, x1: ox + 80, y0: Y - 2, y1: Y + 12, z0: oz - 64, z1: oz - 7 }] }); // the track, stands and garage; not the walk-in rows
  return part;
}
