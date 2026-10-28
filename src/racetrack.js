// T40c: the Race Track in Playland's `race` zone. Pure data and maths (imports only blocks.js, picturelands.js and kindhelp.js, so the spec runs it in Node):
// the track as pieces of a centreline, `makeTrack()` (where a lap is, its height, flags, boost pads), Racer Rio's speed with the rubber
// band (`bossSpeed`, `raceRun` to simulate a race), the wild Racers' spawn table and `buildRaceTrack`, the part builder that
// Playland's PLAYLAND_PARTS.race calls (it writes only inside the race zone box). The live race is in racelive.js, your kart in kart.js.
import { B, WOOL } from './blocks.js';
import { kit, placeBoss, placeCrew } from './picturelands.js'; // pure too (blocks.js and pictureworlds.js only)
import { kindHelp } from './kindhelp.js';

// Race tunables. Rio's speed is a closed form of his track distance (see bossSpeed); lead = bossS - your progress.
// Owner 2026-10-27 (Race Track v2): "the road is still too short ... think Hot Wheels ... there's not really any car mechanics":
// you drive your own kart (kart.js: it speeds up, needs braking before tight corners, kerbs and grass slow it to a walk,
// walls bounce it) on a lap more than twice as long: a snake of S-bends, a jump over the pond, the orange flyover with a big
// drop, a tunnel, a dip of hairpins and a chicane. The boost pads speed Rio up too, like you.
export const RACE = {
  laps: 3, lane: 1.5, grid: -2,                   // Rio's lane (left +; you start on -lane); both start 2 behind the line
  count: 3, hold: 1.2,                            // countdown seconds; how far you may move before GO
  // Rio's speed on each kind of piece (a kart's top speed on the road is 12, kart.js)
  speed: { straight: 11.6, tunnel: 11.6, snake: 10.8, kicker: 11, jump: 12.5, climb: 11, high: 11.4, drop: 13.5, corner: 9.4, hairpin: 7.8, chicane: 9 },
  band: { near: 4, slow: 0.01, min: 0.93, behind: 4, fast: 0.02, max: 1.08 }, // owner 2026-10-27: he waits for you only a little now (lost races: the shared kind help, kindhelp.js)
  boost: { dist: 6, speed: 16, fade: 12 },        // a boost strip: Rio drives `speed` along its 6 blocks, then slows back over `fade` blocks (yours: kart.js KART.boost)
  offTrack: 4.3, fov: 82,                         // on foot (not racing) off the track: a walk; the view widens at race speed
  leave: 40,                                      // further than this from the track ends the race
  parade: { speed: 6, lanes: [-1.5, 1.5] },
  half: 3.5,                                      // a player this close to the middle of the track is on it
  asphalt: 2.2, edge: 3.2, rail: 4.2,             // cells this close to the middle are road, then the edge (line or kerb), then the flyover's rails
  jumpUp: 3,                                      // Rio's arc over the pond (blocks above the straight line)
};
export const TRACK_ORIGIN = { ox: 8, oz: 96 };  // local (u, v) -> world x = ox + u, z = oz - v (the whole race zone: u 0..207, v 0..87)
const H = Math.PI / 2, D = Math.PI / 180;
// The lap as a chain of pieces from the start line (local, heading +u): ['line', length, kind, 0, { y: [from, to] }] or
// ['arc', radius, kind, degrees (+ left, - right), { wall, y }]. `y` = the road's height above the land (default: as the last piece
// ended); `wall`: tyre walls outside the corner. The 'close' straights get the lengths that close the loop (solveClose).
const CHAIN = [
  ['line', 30, 'straight'],                                                                     //  0 the start line, then the main straight
  ['arc', 12, 'snake', 40], ['arc', 12, 'snake', -80], ['arc', 12, 'snake', 80], ['arc', 12, 'snake', -40], // 1-4 the snake
  ['line', 8, 'straight'], ['line', 5, 'kicker', 0, { y: [0, 2] }], ['line', 7, 'jump', 0, { y: [2, 0] }], ['line', 16, 'straight'], // 5-8 the jump over the pond
  ['arc', 10, 'corner', 90, { wall: true }],                                                    //  9 north up the east side
  ['line', 6, 'straight'], ['line', 26, 'climb', 0, { y: [0, 6] }],                            // 10-11 up onto the orange flyover
  ['arc', 11, 'high', 90, { y: [6, 6] }], ['line', 18, 'high', 0, { y: [6, 6] }], ['line', 12, 'drop', 0, { y: [6, 0] }], // 12-14 the big drop
  ['line', 8, 'straight'], ['line', 28, 'tunnel'],                                              // 15-16 through the hill
  ['arc', 8, 'corner', 90, { wall: true }], ['line', 16, 'straight'], ['arc', 8, 'hairpin', -180, { wall: true }], ['line', 16, 'straight'], ['arc', 8, 'corner', 90, { wall: true }], // 17-21 the dip
  ['close-u'], ['arc', 11, 'corner', 90, { wall: true }],                                       // 22-23 west, then south down the west side
  ['close-v'], ['arc', 7, 'chicane', 25], ['arc', 7, 'chicane', -50], ['arc', 7, 'chicane', 25], ['close-v'], // 24-28
  ['arc', 9, 'corner', 90, { wall: true }], ['line', 30, 'straight'],                           // 29-30 back onto the main straight
];
const START = [70.5, 18.5];
export const HOT = new Set(['climb', 'high', 'drop']); // the orange flyover (rails both sides)
// Lay the chain out: TRACK pieces { type: 'line', from, to, kind, y } / { type: 'arc', c, r, a0, a1, cw, kind, wall, y }.
function layOut(close) {
  let [u, v] = START, a = 0, y = 0;
  const out = [];
  const line = (n, kind, ys) => { const to = [u + Math.cos(a) * n, v + Math.sin(a) * n]; out.push({ type: 'line', from: [u, v], to, kind, y: ys }); [u, v] = to; };
  for (const [type, x, kind, turn = 0, o = {}] of CHAIN) {
    if (type === 'close-u') { line(close.u, 'straight', [y, y]); continue; }
    if (type === 'close-v') { line(close.v / 2, 'straight', [y, y]); continue; }
    const ys = o.y ?? [y, y];
    if (type === 'line') line(x, kind, ys);
    else {
      const sg = Math.sign(turn), c = [u + x * Math.cos(a + sg * H), v + x * Math.sin(a + sg * H)], a0 = Math.atan2(v - c[1], u - c[0]), a1 = a0 + turn * D;
      out.push({ type, c, r: x, a0, a1, cw: sg < 0, kind, wall: !!o.wall, y: ys });
      u = c[0] + x * Math.cos(a1); v = c[1] + x * Math.sin(a1); a += turn * D;
    }
    y = ys[1];
  }
  return { out, end: [u, v] };
}
// close-u runs west (-u) and the two close-v halves run south (-v): with both 0 the lap ends `end`, so they make up the rest.
function solveClose() { const e = layOut({ u: 0, v: 0 }).end; return { u: e[0] - START[0], v: e[1] - START[1] }; }
export const CLOSE = solveClose();
export const TRACK = layOut(CLOSE).out;
// Boost strips: 6 blocks along piece `piece` from `off`, one cell wide on lane `lane` (left +: the inside of the next turn, 0 = the middle).
const PADS = [{ piece: 0, off: 18, lane: 1.5 }, { piece: 5, off: 1, lane: 0 }, { piece: 13, off: 5, lane: -1.5 }, { piece: 22, off: 3, lane: 1.5 }];
export const GATE_AT = [{ id: 'G0', piece: 0, off: 0 }, { id: 'G1', piece: 10, off: 3 }, { id: 'G2', piece: 15, off: 4 }, { id: 'G3', piece: 24, off: 3 }];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TAU = 2 * Math.PI;

// The track, worked out in local coordinates and handed out in world coordinates (x = ox + u, z = oz - v).
export function makeTrack({ ox = TRACK_ORIGIN.ox, oz = TRACK_ORIGIN.oz, y = 10 } = {}) {
  let acc = 0;
  const pieces = TRACK.map((p, i) => {
    const len = p.type === 'arc' ? p.r * Math.abs(p.a1 - p.a0) : Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    const q = { ...p, i, s0: acc, len, sg: p.cw ? -1 : 1, hot: HOT.has(p.kind) };
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
  // the road's height above the land at distance t along piece p (`air`: Rio's arc over the pond instead of the straight line)
  const height = (p, t, air = false) => { const k = clamp(t / p.len, 0, 1), h = p.y[0] + (p.y[1] - p.y[0]) * k; return air && p.kind === 'jump' ? h + 4 * RACE.jumpUp * k * (1 - k) : h; };
  const toWorld = (l, kind, h) => ({ x: ox + l.u, z: oz - l.v, heading: Math.atan2(l.tu, -l.tv), kind, y: h });
  const track = {
    L, pieces, ox, oz, y, pads: [],
    kindAt(s) {
      const m = wrap(s);
      for (const p of track.pads) if (m >= p.s0 && m < p.s0 + RACE.boost.dist) return 'boost';
      return pieceAt(m).kind;
    },
    // Rio's boost at distance s: 1 along a strip, then fading back to 0 over `fade` blocks after it (0 = no boost)
    boostAt(s) {
      const m = wrap(s), B0 = RACE.boost;
      for (const p of track.pads) {
        const d = ((m - p.s0) % L + L) % L;
        if (d < B0.dist) return 1;
        if (d < B0.dist + B0.fade) return 1 - (d - B0.dist) / B0.fade;
      }
      return 0;
    },
    // the height of the road above the land at s (Rio's kart follows it; over the pond an arc)
    yAt(s) { const m = wrap(s), p = pieceAt(m); return height(p, m - p.s0, true); },
    // world position, heading (npc.js: 0 faces +z, PI / 2 faces +x), kind and height at distance s along the lap, `lane` blocks to the left
    at(s, lane = 0) {
      const m = wrap(s), p = pieceAt(m);
      return toWorld(local(p, m - p.s0, lane), track.kindAt(m), height(p, m - p.s0, true));
    },
    // the nearest centreline point to a world position: { s (0..L), d (distance), across (lane offset, left +), piece, h (the road's height there) }
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
      return { s: wrap(p.s0 + best.t), d: best.d, across: (pu - q.u) * -q.tv + (pv - q.v) * q.tu, piece: p.i, h: height(p, best.t) };
    },
  };
  // the boost strips: the cells along the lane, where Rio's boost starts (s0) and the way along (dir, for a runner on foot: the nearer axis)
  track.pads = PADS.map(d => {
    const p = pieces[d.piece], s0 = p.s0 + d.off, cells = [], seen = new Set();
    for (let k = 0; k <= RACE.boost.dist * 2; k++) {
      const a = track.at(s0 + k / 2, d.lane), c = [Math.floor(a.x), Math.floor(a.z)], key = c.join();
      if (!seen.has(key)) { seen.add(key); cells.push(c); }
    }
    const mid = track.at(s0 + RACE.boost.dist / 2, 0), dx = Math.sin(mid.heading), dz = Math.cos(mid.heading);
    return { cells, s0, lane: d.lane, h: Math.round(track.yAt(s0)), dir: Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)] };
  });
  // the start line and the three flags, as lines across the track (6 blocks either side of the middle) and the way forward
  track.gates = GATE_AT.map(g => {
    const s = pieces[g.piece].s0 + g.off, mid = track.at(s, 0), a = track.at(s, -6), b = track.at(s, 6);
    return { id: g.id, s, x: mid.x, z: mid.z, heading: mid.heading, a: [a.x, a.z], b: [b.x, b.z], dir: [Math.sin(mid.heading), Math.cos(mid.heading)] };
  });
  return track;
}

// Rio's speed at track distance bossS when he leads by `lead` blocks (bossS - your progress) after `losses` lost races.
// Ahead of you he slows down, far behind he speeds up a little, and after a couple of lost races the shared kind help (kindhelp.js,
// owner 2026-10-28: only ever so slightly) makes him a tiny bit slower.
// A boost strip speeds him up like it speeds you up (owner 2026-10-27).
export function bossSpeed(bossS, lead, losses, track) {
  const b = RACE.band;
  let f = 1;
  if (lead > b.near) f = Math.max(b.min, 1 - b.slow * (lead - b.near));          // ahead: slows down
  else if (lead < -b.behind) f = Math.min(b.max, 1 + b.fast * (-lead - b.behind)); // far behind: a little faster
  f *= kindHelp(losses).slow;                                                     // the kind help after lost races
  const m = ((bossS % track.L) + track.L) % track.L, base = RACE.speed[track.pieces.find((p, i) => m >= p.s0 && (i === track.pieces.length - 1 || m < track.pieces[i + 1].s0)).kind];
  return (base + Math.max(0, RACE.boost.speed - base) * track.boostAt(bossS)) * f;
}

// A whole race with a runner at a constant speed `v` along the centreline (no boosts): { winner: 'you' | 'rio', margin (blocks) }.
export function raceRun(v, losses, dt = 1 / 30, track = makeTrack()) {
  const end = RACE.laps * track.L;
  let me = RACE.grid, rio = RACE.grid;
  for (let i = 0; i < 100000; i++) {
    me += (typeof v === 'function' ? v(me) : v) * dt;
    rio += bossSpeed(rio, rio - me, losses, track) * dt;
    if (me >= end || rio >= end) return me >= end ? { winner: 'you', margin: rio < end ? end - rio : 0 } : { winner: 'rio', margin: end - me };
  }
  return { winner: 'none', margin: 0 };
}

// Wild Racers (only in Playland's race zone). The 4th element: the rare ones come out once you beat Rio in a race (wildafter.js).
export const RACER_SPAWNS = [['vroomlet', 1.2], ['zipskate', 1.2], ['pitpig', 1.2], ['wheelie', 0.8], ['vroomster', 0.12, null, 'race'], ['blastskate', 0.12, null, 'race'], ['karthog', 0.1, null, 'race']];
// The track blocks wild creatures may stand on (grass is Playland's own).
export const RACE_WALK = [B.GRASS, B.ASPHALT, B.TRACK_LINE, B.KERB, B.CHECKER, B.BOOST_PAD];

/* ------------------------------ the builder ------------------------------ */

const EDGE = { straight: B.TRACK_LINE, tunnel: B.TRACK_LINE }; // other road kinds have red and white kerbs at the edge
export const GARAGE = { u0: 44, u1: 54, v0: 27, v1: 33 };      // the pit garage in the infield (open on the +u side)
export const RIO = { u: 62, v: 27 };                           // Rio's stand (he faces the walk in)
export const STANDS = [[36, 64], [76, 96]];                    // grandstands south of the main straight (u ranges), rows v 5..12
const gridAt = (track, lane, Y) => { const a = track.at(RACE.grid, lane); return [a.x, Y + 1, a.z]; };
// Writes the Race Track into world.data, only inside zone.box. Y = the flat land top; throws if it is not what the base made.
export function buildRaceTrack(world, zone) {
  const { ox, oz } = TRACK_ORIGIN, Y = 10, box = zone.box;
  const track = makeTrack({ ox, oz, y: Y });
  if (world.ground[Math.floor((box.x0 + box.x1) / 2) + Math.floor((box.z0 + box.z1) / 2) * world.W] !== Y) throw new Error('Race Track: the land is not at y 10');
  const U0 = box.x0 - ox, U1 = box.x1 - ox, V0 = oz - 1 - box.z1, V1 = oz - 1 - box.z0; // the zone in local cells
  // put(u, v, dy, id): the cell of local (u, v) at height Y + dy
  const put = (u, v, dy, id) => {
    const x = ox + u, z = oz - 1 - v, y = Y + dy;
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) throw new Error(`Race Track: cell ${x}, ${z} is outside the race zone`);
    world.data[world.index(x, y, z)] = id;
  };
  const RW = WOOL.racer, WW = WOOL.paper; // racer wool (orange) and white (paper wool)
  const proj = (u, v) => track.project(ox + u + 0.5, oz - v - 0.5);
  // 1. the road: asphalt with white lines on the straights and red and white kerbs elsewhere; the orange flyover (with rails and
  // posts under it), the jump ramp, the pond under the jump, the hill over the tunnel
  for (let u = U0; u <= U1; u++) for (let v = V0; v <= V1; v++) {
    const pr = proj(u, v), p = track.pieces[pr.piece], h = Math.round(pr.h);
    if (pr.d > 6) continue;
    if (p.kind === 'jump') { // the pond: water two deep under the gap and a sandy shore
      if (pr.d <= RACE.rail + 1) { put(u, v, 0, B.WATER); put(u, v, -1, B.WATER); } else put(u, v, 0, B.SAND);
      continue;
    }
    if (p.kind === 'tunnel' && pr.d <= 5.2 && pr.d > RACE.edge + 0.3) for (let k = 1; k <= 3; k++) put(u, v, k, B.DIRT);
    if (p.kind === 'tunnel' && pr.d <= 5.2) { put(u, v, 4, B.DIRT); put(u, v, 5, B.DIRT); put(u, v, 6, B.GRASS); }
    if (p.hot) {
      if (pr.d <= RACE.edge) put(u, v, h, B.HOT_TRACK);
      else if (pr.d <= RACE.rail) { for (let k = Math.max(1, h); k <= h + 1; k++) put(u, v, k, B.HOT_RAIL); }
      continue;
    }
    if (p.kind === 'kicker') { if (pr.d <= RACE.edge) for (let k = 0; k <= h; k++) put(u, v, k, B.KICKER); continue; }
    if (pr.d <= RACE.asphalt) { put(u, v, 0, B.ASPHALT); put(u, v, -1, B.DIRT); }
    else if (pr.d <= RACE.edge) { put(u, v, 0, EDGE[p.kind] ?? B.KERB); put(u, v, -1, B.DIRT); }
  }
  // posts under the flyover: every 6 blocks along it, under the middle
  for (const p of track.pieces) if (p.hot) for (let t = 3; t < p.len; t += 6) {
    const a = track.at(p.s0 + t, 0), u = Math.floor(a.x - ox), v = Math.floor(oz - a.z), h = Math.round(proj(u, v).h); // (the cell's own road height)
    for (let k = 1; k < h; k++) put(u, v, k, RW);
  }
  // lamps along the tunnel walls
  { const p = track.pieces.find(q => q.kind === 'tunnel'); for (let t = 3; t < p.len; t += 6) for (const lane of [-4.2, 4.2]) { const a = track.at(p.s0 + t, lane); put(Math.floor(a.x - ox), Math.floor(oz - a.z), 3, B.LAMP); } }
  // the chequered start line and the boost strips
  for (let lane = -3; lane <= 3; lane += 0.5) for (const ds of [0, 0.5]) { const a = track.at(ds, lane); const u = Math.floor(a.x - ox), v = Math.floor(oz - a.z); if (proj(u, v).d <= RACE.edge) put(u, v, 0, B.CHECKER); }
  for (const p of track.pads) for (const [x, z] of p.cells) world.data[world.index(x, Y + p.h, z)] = B.BOOST_PAD; // (on the flyover: at the road's height)
  // 2. tyre walls (1 high) just outside the corners marked `wall` (never on the track)
  for (const p of track.pieces) if (p.wall) {
    for (let u = U0; u <= U1; u++) for (let v = V0; v <= V1; v++) {
      const du = u + 0.5 - p.c[0], dv = v + 0.5 - p.c[1], r = Math.hypot(du, dv);
      if (r < p.r + RACE.edge + 0.6 || r >= p.r + RACE.edge + 1.6) continue; // the outside of a turn is away from its centre
      const delta = ((((Math.atan2(dv, du) - p.a0) * p.sg) % TAU) + TAU) % TAU;
      if (delta <= Math.abs(p.a1 - p.a0) && proj(u, v).d > RACE.edge + 0.5) put(u, v, 1, B.TYRE_WALL);
    }
  }
  // 3. the grandstands south of the main straight: rows rising away from the track, the top block alternating racer and white wool
  for (const [u0, u1] of STANDS) for (let v = 5; v <= 12; v++) {
    const h = v >= 11 ? 1 : v >= 9 ? 2 : v >= 7 ? 3 : 4;
    for (let u = u0; u <= u1; u++) for (let k = 1; k <= h; k++) put(u, v, k, k === h && (v >> 1) % 2 === 0 ? RW : WW);
  }
  // 4. gantries over the start line (with three lamps) and the three flags: poles 4.5 either side of the middle, a beam between
  const loc = (s, lane) => { const a = track.at(s, lane); return [Math.floor(a.x - ox), Math.floor(oz - a.z)]; };
  const arch = (gate, lamps) => {
    const a = loc(gate.s, -4.5), b = loc(gate.s, 4.5), n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (const [u, v] of [a, b]) for (let k = 1; k <= 5; k++) put(u, v, k, WW);
    for (let i = 0; i <= n; i++) { const u = Math.round(a[0] + (b[0] - a[0]) * i / n), v = Math.round(a[1] + (b[1] - a[1]) * i / n); put(u, v, 6, (u + v) % 2 ? B.CHECKER : RW); }
    for (const [u, v] of lamps || []) put(u, v, 5, B.START_LIGHT);
  };
  const lamps = [-1, 0, 1].map(lane => loc(track.gates[0].s, lane));
  arch(track.gates[0], lamps);
  for (const g of track.gates.slice(1)) arch(g);
  // 5. the pit garage: white walls 3 high, a racer-wool roof, open on the +u side, a chequer floor and two tyre stacks inside
  const G = GARAGE;
  for (let u = G.u0; u <= G.u1; u++) for (let v = G.v0; v <= G.v1; v++) {
    const wall = u === G.u0 || v === G.v0 || v === G.v1 || (u === G.u1 && (v < G.v0 + 1 || v > G.v1 - 1));
    if (wall) for (let k = 1; k <= 3; k++) put(u, v, k, WW);
    else put(u, v, 0, B.CHECKER);
    put(u, v, 4, RW);
  }
  for (const [u, v] of [[G.u0 + 2, G.v0 + 2], [G.u0 + 2, G.v1 - 2]]) { put(u, v, 1, B.TYRE_WALL); put(u, v, 2, B.TYRE_WALL); }
  // 6. festival bunting along the stands' back row
  for (const [u0, u1] of STANDS) for (let u = u0; u <= u1; u += 4) { for (let k = 5; k <= 6; k++) put(u, 5, k, WW); put(u, 5, 7, RW); }
  // 7. Racer Rio on his stand in the infield (he faces the walk in), his two Pit Crew helpers outside the garage, the live part and the keep
  kit(world);
  placeBoss(world, 'race', { x: ox + RIO.u, y: Y, z: oz - 1 - RIO.v, facing: [0, 1] });
  placeCrew(world, 'race', 0, { x: ox + G.u1 + 2, y: Y, z: oz - 1 - (G.v0 + 2), facing: [1, 0] });
  placeCrew(world, 'race', 1, { x: ox + G.u1 + 2, y: Y, z: oz - 1 - (G.v1 - 2), facing: [1, 0] });
  const part = {
    id: 'race', live: 'race', track, y: Y,
    grid: { player: gridAt(track, -RACE.lane, Y), boss: gridAt(track, RACE.lane, Y), heading: Math.PI / 2, yaw: -Math.PI / 2 }, // both face +x
    lights: lamps.map(([u, v]) => [ox + u, Y + 5, oz - 1 - v]),
    pads: track.pads,
    box: { x0: box.x0, x1: box.x1, z0: box.z0, z1: box.z1 }, // the race area: the leave check and where the parade shows
  };
  world.parts.push(part);
  world.keeps.push({ name: 'Race Track', rideIn: true, wallText: "That's the race track! Keep it clear for racing.",
    protect: [{ x0: box.x0, x1: box.x1, y0: Y - 2, y1: Y + 12, z0: box.z0, z1: oz - 1 - 4 }] }); // the track, stands and garage; not the walk-in rows (v 0..3)
  return part;
}
