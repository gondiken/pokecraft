// T40c: the Race Track in Playland's `race` zone. Pure data and maths (imports only blocks.js and picturelands.js, so the spec runs it in Node):
// the track as pieces of a centreline, `makeTrack()` (where a lap is, flags, boost pads), Racer Rio's speed with the rubber
// band (`bossSpeed`, `raceRun` to simulate a race), the wild Racers' spawn table and `buildRaceTrack`, the part builder that
// Playland's PLAYLAND_PARTS.race calls (it writes only inside the race zone box). The live race is in racelive.js.
import { B, WOOL } from './blocks.js';
import { kit, placeBoss, placeCrew } from './picturelands.js'; // pure too (blocks.js and pictureworlds.js only)

// Race tunables. Rio's speed is a closed form of his track distance (see bossSpeed); lead = bossS - your progress.
// Owner 2026-10-26, "not a true race": a faster race (on the track you run at `pace` times a sprint, Rio is quicker to match), a
// narrower track (asphalt 3 wide + an edge line each side), thin boost strips, a hairpin, an S and a chicane, tyre walls outside the
// tight corners and a bridge over a pond; off the track (grass, the pond) you only walk.
export const RACE = {
  laps: 3, lane: 1, grid: -1.5,                   // Rio's lane; both start 1.5 behind the line
  count: 3, hold: 1.2,                            // countdown seconds; how far you may move before GO
  speed: { straight: 9.45, sweeper: 9.15, bridge: 9.45, corner: 7.55, chicane: 6.95, hairpin: 5.8, boost: 10.9 }, // owner 2026-10-26: 5% quicker, 3 laps
  band: { near: 1, slow: 0.03, min: 0.85, behind: 3, fast: 0.03, max: 1.12, ease: 0.04, final: 45, cap: [1, 0.9, 0.8] },
  boost: { dist: 6, speed: 16 },                  // a boost strip zooms you 6 blocks at 16 blocks/s
  pace: 1.35, offTrack: 4.3, fov: 82,                      // on foot on the track: 1.35 x a sprint (8.4); off it (grass, water): a walk at most
  leave: 40,                                      // further than this from the track ends the race
  parade: { speed: 5, lanes: [-1, 1] },
  half: 2.5,                                      // a player this close to the middle of the track is on it
  asphalt: 1.2, edge: 2.2,                        // cells this close to the middle are asphalt, then the edge (line, kerb or bridge plank)
};
export const TRACK_ORIGIN = { ox: 68, oz: 96 };  // local (u, v) -> world x = ox + u, z = oz - v
const H = Math.PI / 2;
// The centreline in local coordinates (cell middles, so 3 asphalt cells sit round it), in driving order from the start line.
// Arcs: centre c, radius r, angles a0 -> a1 (cw: clockwise, a turn to the right); `wall`: a tyre wall outside it.
export const TRACK = [
  { type: 'line', from: [28.5, 20.5], to: [58.5, 20.5], kind: 'straight' },
  { type: 'arc', c: [58.5, 34.5], r: 14, a0: -H, a1: 0, kind: 'sweeper' },
  { type: 'line', from: [72.5, 34.5], to: [72.5, 44.5], kind: 'bridge' },
  { type: 'arc', c: [67.5, 44.5], r: 5, a0: 0, a1: Math.PI, kind: 'hairpin', wall: true },
  { type: 'line', from: [62.5, 44.5], to: [62.5, 39.5], kind: 'straight' },
  { type: 'arc', c: [57.5, 39.5], r: 5, a0: 0, a1: -H, cw: true, kind: 'corner', wall: true },
  { type: 'line', from: [57.5, 34.5], to: [50.5, 34.5], kind: 'straight' },
  { type: 'arc', c: [50.5, 40.5], r: 6, a0: -H, a1: -Math.PI, cw: true, kind: 'corner', wall: true },
  { type: 'line', from: [44.5, 40.5], to: [44.5, 49.5], kind: 'straight' },
  { type: 'arc', c: [38.5, 49.5], r: 6, a0: 0, a1: H, kind: 'corner', wall: true },
  { type: 'line', from: [38.5, 55.5], to: [24.5, 55.5], kind: 'straight' },
  { type: 'arc', c: [24.5, 47.5], r: 8, a0: H, a1: Math.PI, kind: 'corner', wall: true },
  { type: 'line', from: [16.5, 47.5], to: [16.5, 44.5], kind: 'chicane' },
  { type: 'line', from: [16.5, 44.5], to: [20.5, 40.5], kind: 'chicane' },
  { type: 'line', from: [20.5, 40.5], to: [20.5, 36.5], kind: 'chicane' },
  { type: 'line', from: [20.5, 36.5], to: [16.5, 32.5], kind: 'chicane' },
  { type: 'line', from: [16.5, 32.5], to: [16.5, 28.5], kind: 'chicane' },
  { type: 'arc', c: [24.5, 28.5], r: 8, a0: Math.PI, a1: 1.5 * Math.PI, kind: 'corner', wall: true },
  { type: 'line', from: [24.5, 20.5], to: [28.5, 20.5], kind: 'straight' },
];
// Boost strips: one cell wide on the inside line before a turn (local cells u0..u1, v0..v1) and the driving direction (du, dv).
const PADS = [
  { u: [47, 52], v: [21, 21], dir: [1, 0] },
  { u: [71, 71], v: [36, 41], dir: [0, 1] },
  { u: [28, 33], v: [54, 54], dir: [-1, 0] },
];
// The pond under the bridge (local cells; water two deep, the bridge is the track itself)
export const POND = [{ u: [66, 69], v: [36, 43] }, { u: [76, 78], v: [35, 44] }];
export const GATE_AT = [{ id: 'G0', piece: 0, off: 0 }, { id: 'G1', piece: 6, off: 3.5 }, { id: 'G2', piece: 10, off: 5 }, { id: 'G3', piece: 14, off: 2 }];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TAU = 2 * Math.PI;

// The track, worked out in local coordinates and handed out in world coordinates (x = ox + u, z = oz - v).
export function makeTrack({ ox = TRACK_ORIGIN.ox, oz = TRACK_ORIGIN.oz, y = 10 } = {}) {
  let acc = 0;
  const pieces = TRACK.map((p, i) => {
    const len = p.type === 'arc' ? p.r * Math.abs(p.a1 - p.a0) : Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    const q = { ...p, i, s0: acc, len, sg: p.cw ? -1 : 1 };
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
    const th = p.a0 + p.sg * t / p.r, r = p.r - p.sg * lane; // the left lane is inside a left turn, outside a right one
    return { u: p.c[0] + r * Math.cos(th), v: p.c[1] + r * Math.sin(th), tu: -p.sg * Math.sin(th), tv: p.sg * Math.cos(th) };
  };
  const pieceAt = s => { for (let i = pieces.length - 1; i >= 0; i--) if (s >= pieces[i].s0) return pieces[i]; return pieces[0]; };
  const toWorld = (l, kind) => ({ x: ox + l.u, z: oz - l.v, heading: Math.atan2(l.tu, -l.tv), kind });
  const pads = PADS.map(p => {
    const cells = [];
    for (let u = p.u[0]; u <= p.u[1]; u++) for (let v = p.v[0]; v <= p.v[1]; v++) cells.push([ox + u, oz - 1 - v]);
    return { cells, dir: [p.dir[0], -p.dir[1]], first: [p.dir[0] < 0 ? p.u[1] : p.u[0], p.dir[1] < 0 ? p.v[1] : p.v[0]] };
  });
  const track = {
    L, pieces, pads, ox, oz, y,
    kindAt(s) {
      const m = wrap(s);
      for (const p of pads) if (m >= p.s0 && m < p.s0 + RACE.boost.dist) return 'boost';
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
          const span = Math.abs(p.a1 - p.a0), th = Math.atan2(pv - p.c[1], pu - p.c[0]);
          const delta = ((((th - p.a0) * p.sg) % TAU) + TAU) % TAU; // the angle walked along the arc's own direction
          t = delta <= span ? delta * p.r : (delta - span < TAU - delta ? p.len : 0);
        }
        const q = local(p, t, 0), d = Math.hypot(pu - q.u, pv - q.v);
        if (!best || d < best.d - 1e-9) best = { d, t, p, q };
      }
      const { q, p } = best;
      return { s: wrap(p.s0 + best.t), d: best.d, across: (pu - q.u) * -q.tv + (pv - q.v) * q.tu, piece: p.i };
    },
  };
  for (const p of pads) p.s0 = track.project(ox + p.first[0] + 0.5, oz - p.first[1] - 0.5).s; // where Rio speeds up
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

const LAMPS = [19, 20, 21]; // the start lamps hang over these rows of the start gantry (local v)
const gridAt = (track, lane, Y) => { const a = track.at(RACE.grid, lane); return [a.x, Y + 1, a.z]; };
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
  // 1. the pond under the bridge (water two deep), then the surface: asphalt, white edge lines on straights, kerbs on corners
  // and the chicane, planks along the bridge
  for (const q of POND) for (let u = q.u[0]; u <= q.u[1]; u++) for (let v = q.v[0]; v <= q.v[1]; v++) { put(u, v, 0, B.WATER); put(u, v, -1, B.WATER); }
  const edgeOf = { straight: B.TRACK_LINE, sweeper: B.TRACK_LINE, bridge: B.PLANKS };
  for (let u = 8; u <= 80; u++) for (let v = 6; v <= 63; v++) {
    const pr = track.project(ox + u + 0.5, oz - v - 0.5);
    if (pr.d <= RACE.asphalt) { put(u, v, 0, B.ASPHALT); put(u, v, -1, B.DIRT); }
    else if (pr.d <= RACE.edge) { put(u, v, 0, edgeOf[track.pieces[pr.piece].kind] ?? B.KERB); put(u, v, -1, B.DIRT); }
  }
  for (let u = 28; u <= 29; u++) for (let v = 18; v <= 22; v++) put(u, v, 0, B.CHECKER);
  for (const p of track.pads) for (const [x, z] of p.cells) world.data[world.index(x, Y, z)] = B.BOOST_PAD;
  // 2. tyre walls (1 high) just outside the tight corners (never on the track) and along the fence row v = 15 (a gap for the walk in)
  for (const p of track.pieces) if (p.wall) {
    for (let u = 8; u <= 80; u++) for (let v = 6; v <= 63; v++) {
      const du = u + 0.5 - p.c[0], dv = v + 0.5 - p.c[1], r = Math.hypot(du, dv);
      if (r < p.r + RACE.edge + 0.6 || r >= p.r + RACE.edge + 1.6) continue;
      const delta = ((((Math.atan2(dv, du) - p.a0) * p.sg) % TAU) + TAU) % TAU;
      if (delta <= Math.abs(p.a1 - p.a0) && track.project(ox + u + 0.5, oz - v - 0.5).d > RACE.edge + 0.5) put(u, v, 1, B.TYRE_WALL);
    }
  }
  for (let u = 10; u <= 78; u++) if (u < 40 || u > 48) put(u, 15, 1, B.TYRE_WALL);
  // 3. the grandstands: rows rising away from the track, the top block alternating racer and white wool
  for (const [u0, u1] of [[18, 38], [50, 70]]) for (let v = 6; v <= 13; v++) {
    const h = v >= 12 ? 1 : v >= 10 ? 2 : v >= 8 ? 3 : 4;
    for (let u = u0; u <= u1; u++) for (let k = 1; k <= h; k++) put(u, v, k, k === h && (v >> 1) % 2 === 0 ? RW : WW);
  }
  // 4. gantries over the start line (with three lamps) and the three flags: poles 3.5 either side of the middle, a beam between
  const loc = (s, lane) => { const a = track.at(s, lane); return [Math.floor(a.x - ox), Math.floor(oz - a.z)]; };
  const arch = (gate, lamps) => {
    const a = loc(gate.s, -3.5), b = loc(gate.s, 3.5), n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (const [u, v] of [a, b]) for (let k = 1; k <= 5; k++) put(u, v, k, WW);
    for (let i = 0; i <= n; i++) { const u = Math.round(a[0] + (b[0] - a[0]) * i / n), v = Math.round(a[1] + (b[1] - a[1]) * i / n); put(u, v, 6, (u + v) % 2 ? B.CHECKER : RW); }
    for (const [u, v] of lamps || []) put(u, v, 5, B.START_LIGHT);
  };
  arch(track.gates[0], LAMPS.map(v => [28, v]));
  for (const g of track.gates.slice(1)) arch(g);
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
    grid: { player: gridAt(track, -RACE.lane, Y), boss: gridAt(track, RACE.lane, Y), heading: Math.PI / 2, yaw: -Math.PI / 2 }, // both face +x
    lights: LAMPS.map(v => [ox + 28, Y + 5, oz - 1 - v]),
    pads: track.pads,
    box: { x0: ox + 8, x1: ox + 80, z0: oz - 64, z1: oz - 1 }, // the race area: the leave check and where the parade shows
  };
  world.parts.push(part);
  world.keeps.push({ name: 'Race Track', rideIn: true, wallText: "That's the race track! Keep it clear for racing.",
    protect: [{ x0: ox + 8, x1: ox + 80, y0: Y - 2, y1: Y + 12, z0: oz - 64, z1: oz - 7 }] }); // the track, stands and garage; not the walk-in rows
  return part;
}
