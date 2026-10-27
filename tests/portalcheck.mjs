// T42: the Portal House checks that need no browser: a stand-in world for swirlLand, and a search over the House with swirl edges (each
// designed trick is a flight worked out with portalplay.js, the same code the live part uses). Used by tests/specs/portal.mjs (in the
// page, through /tests/portalcheck.mjs) and run by hand with `node tests/portalcheck.mjs`.
import { B, isSolid } from '../src/blocks.js';
import { swirlLand } from '../src/swirlland.js';
import { R, SWIRLS, ROOMS, STUDY_ROOM, doorTarget, hallFront, swirlById, PORCH, HUB } from '../src/portalhouse.js';
import { PORTAL, exitSpeed, exitOf, centreAt, touches, flingFlight, boxHits, clearLine } from '../src/portalplay.js';

export const WORLD_H = 48;
export const SIZE = [160, 160];
// A world with just what the builder needs.
export function standIn([W, D] = SIZE) {
  const w = {
    W, D, data: new Uint8Array(W * D * WORLD_H), ground: new Uint8Array(W * D),
    index: (x, y, z) => x + W * (z + D * y),
    inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < WORLD_H,
    get: (x, y, z) => (w.inBounds(x, y, z) ? w.data[x + W * (z + D * y)] : B.AIR),
    isSolid: (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 ? true : isSolid(w.get(x, y, z))),
  };
  return w;
}
// The Swirl: with the House (version 5) or without it (version 4).
export function makeSwirl({ house = true } = {}) {
  const w = standIn();
  swirlLand(w, { id: 'swirl', size: SIZE }, { house });
  return w;
}

// ---- the physics of the player, simplified: a box that walks, jumps and falls (Player.update's numbers) ----
export const JUMP = { v: 8.6, g: 28, vmax: 19, walk: 4.3, run: 6.2 };
const cellOf = p => [Math.floor(p[0]), Math.floor(p[1] + 0.001), Math.floor(p[2])];
const key = c => c.join(',');

// One run of the player box from `start` (feet) with horizontal velocity (vx, vz): mode 'walk' (on the ground until the edge, then a fall),
// 'jump' (a jump at the start). `seek(pos)` may name a swirl touched (the run ends there). Returns { end, landed, peak, hit, t }.
export function run(solid, start, vx, vz, { mode = 'walk', seek = null, maxT = 5, dt = 1 / 60 } = {}) {
  let p = [...start], vy = mode === 'jump' ? JUMP.v : 0, t = 0, peak = p[1], air = mode === 'jump';
  const first = seek ? seek(p) : null;
  while (t < maxT) {
    t += dt;
    for (const [a, v] of [[0, vx], [2, vz]]) { const q = [...p]; q[a] += v * dt; if (!boxHits(solid, q)) p = q; }
    vy = Math.max(vy - JUMP.g * dt, -JUMP.vmax);
    const q = [p[0], p[1] + vy * dt, p[2]];
    if (boxHits(solid, q)) {
      if (vy < 0) {
        p = [p[0], Math.floor(q[1]) + 1, p[2]]; vy = 0;
        if (air) return { end: p, landed: true, peak, hit: null, t };
      } else vy = 0;
    } else { p = q; if (vy < -0.5) air = true; }
    peak = Math.max(peak, p[1]);
    if (seek) { const h = seek(p); if (h && h !== first) return { end: p, landed: false, peak, hit: h, t }; }
    if (!air && t >= 0.3 && mode === 'walk') return { end: p, landed: true, peak, hit: null, t };
  }
  return { end: p, landed: false, peak, hit: null, t };
}

// The graph over the House: stand cells (air at y and y + 1, solid below, the soft cloud counts as a stand cell but is a catch).
export function houseGraph(w) {
  const solid = (x, y, z) => w.isSolid(x, y, z);
  const standOk = (x, y, z) => y >= 1 && !solid(x, y, z) && !solid(x, y + 1, z) && solid(x, y - 1, z);
  const cloud = (x, y, z) => w.get(x, y - 1, z) === B.SWIRL_CLOUD;
  const nodes = new Map();
  for (let x = R.x0; x <= R.x1; x++) for (let z = R.z0; z <= R.z1; z++) for (let y = R.y0 + 1; y <= R.y1 - 1; y++) if (standOk(x, y, z) && !cloud(x, y, z)) nodes.set(key([x, y, z]), [x, y, z]);
  return { w, solid, standOk, cloud, nodes };
}

const eyeOf = c => [c[0] + 0.5, c[1] + 1.62, c[2] + 0.5];
const losTo = (solid, eye, s) => PORTAL.reach >= Math.hypot(s.centre[0] - eye[0], s.centre[1] - eye[1], s.centre[2] - eye[2])
  && clearLine(solid, eye, [s.centre[0] + s.normal[0] * 0.4, s.centre[1] + s.normal[1] * 0.4, s.centre[2] + s.normal[2] * 0.4]);
export const roomAt = c => ROOMS.find(r => c[0] > r.box.x0 && c[0] < r.box.x1 && c[2] > r.box.z0 && c[2] < r.box.z1 && c[1] >= r.box.bottom && c[1] <= r.box.top) ?? null;

// Where can the player get from a cell? Breadth-first over (cell, where your swirl is). Options:
//   tricks (default true): swirls work. retap: your swirl can be moved in the air. orangeY: where the moving orange swirl is (centre y).
//   placed0: your swirl starts on this slot. Returns { cells (Set of 'x,y,z'), has(cell), seen, parent }.
export function reachable(g, startCell, { tricks = true, retap = true, orangeY = null, placed0 = null, limit = 300000, debug = false, stayIn = null } = {}) {
  const { solid } = g;
  const seen = new Set(), queue = [], parent = new Map();
  const push = (c, placed, from) => { const k = `${key(c)}|${placed ?? '-'}`; if (seen.has(k)) return; seen.add(k); parent.set(k, from); queue.push([c, placed]); };
  const orangeAt = o => (o.move && orangeY != null ? [o.centre[0], orangeY, o.centre[2]] : centreAt(o, 0));
  const settle = (p, room) => { // where a flight that ends at p ends up: a stand cell, or the room's start (caught on the cloud)
    const r = run(solid, p, 0, 0, { mode: 'walk', maxT: 6 }), c = cellOf(r.end);
    if (g.nodes.has(key(c))) return { cell: c };
    if (g.cloud(...c) && room) return { cell: cellOf(room.start) };
    return null;
  };
  const trips = (room, placed, exitSw, speed, depth, out) => { // out of exitSw at `speed`, following the swirls the flight runs into
    const ex = exitOf(exitSw, orangeAt(exitSw), speed);
    if (!ex.vel) { const s = settle(ex.pos, room); if (s) out.push({ ...s, placed }); return; }
    if (depth > 6) return;
    const oranges = room.oranges.map(swirlById), yoursSw = placed && swirlById(placed);
    const seek = q => { for (const o of [...oranges, ...(yoursSw ? [yoursSw] : [])]) if (o.id !== exitSw.id && touches(o, orangeAt(o), q, true)) return o; return null; };
    const f = flingFlight(solid, ex.pos, ex.vel, PORTAL.flingG, seek);
    if (!f.hit) { const s = settle(f.end, room); if (s) out.push({ ...s, placed }); return; }
    const drop = Math.max(0, f.peak - f.hit.centre[1]);
    if (f.hit.kind === 'orange') {
      for (const P of retap ? [placed, ...room.slots.filter(id => id !== placed)] : [placed]) if (P) trips(room, P, swirlById(P), exitSpeed(drop), depth + 1, out);
    } else trips(room, placed, oranges[0], exitSpeed(drop), depth + 1, out);
  };
  push(startCell, placed0, null);
  for (let qi = 0; qi < queue.length && queue.length < limit; qi++) {
    const [c, placed] = queue[qi], room = roomAt(c);
    if (stayIn && room !== stayIn) continue; // (a cell outside the room is only recorded: where the doors lead)
    const from = `${key(c)}|${placed ?? '-'}`;
    if (room && tricks) for (const id of room.slots) if (id !== placed && losTo(solid, eyeOf(c), swirlById(id))) push(c, id, from); // your swirl on a white pad
    const oranges = room ? room.oranges.map(swirlById) : [], yoursSw = placed ? swirlById(placed) : null;
    const active = tricks && room ? [...oranges, ...(yoursSw ? [yoursSw] : [])] : [];
    const seek = q => { for (const s of active) if (touches(s, orangeAt(s), q, false)) return s; return null; };
    const start = [c[0] + 0.5, c[1], c[2] + 0.5];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const sp of [0.01, 2.2, 4.3, 6.2]) for (const mode of ['walk', 'jump']) {
      if (sp < 1 && mode === 'walk') continue;
      const r = run(solid, start, dx * sp, dz * sp, { mode, seek });
      if (r.hit && room) { // into an orange swirl (or onto your own pad)
        const out = [], drop = Math.max(0, r.peak - r.end[1]);
        if (r.hit.kind === 'orange') { if (placed) trips(room, placed, swirlById(placed), exitSpeed(drop), 0, out); } else trips(room, placed, oranges[0], exitSpeed(drop), 0, out);
        if (debug) console.log('event', key(c), placed, r.hit.id, drop.toFixed(2), '->', out.map(o => key(o.cell) + '|' + o.placed).join(' '));
        for (const o of out) push(o.cell, o.placed, from);
        continue;
      }
      if (!r.landed) continue;
      const cc = cellOf(r.end);
      if (g.nodes.has(key(cc))) push(cc, placed, from);
      else if (g.cloud(...cc) && room) push(cellOf(room.start), placed, from); // caught: back to the start
    }
    for (const s of SWIRLS) { // doors: the exit of a room, the way home, the Hall's doors (when open: `openDoors`)
      if (s.kind !== 'door' || !s.alcove) continue;
      const q = [start[0] - s.normal[0] * 0.2, c[1], start[2] - s.normal[2] * 0.2];
      if (!touches(s, s.centre, q, false)) continue;
      const to = s.exit ? (s.room < 4 ? ROOMS[s.room].start : hallFront(5)) : s.to ?? (s.door ? doorTarget(s.door) : null);
      if (to) push(cellOf(to), null, from);
    }
    for (const s of SWIRLS) { // the warps: porch <-> hub
      if (s.kind !== 'warp' || !touches(s, s.centre, start, false)) continue;
      push(cellOf(s.to), null, from);
    }
  }
  const cells = new Set([...seen].map(k => k.split('|')[0]));
  return { seen, cells, parent, has: c => cells.has(key(c)), size: seen.size };
}

// ---- the layout rules (no browser): returns a list of problems ----
export function layoutProblems(w4, w5) {
  const bad = [];
  const inR = (x, y, z) => x >= R.x0 && x <= R.x1 && y >= R.y0 && y <= R.y1 && z >= R.z0 && z <= R.z1;
  // outside the House's volume every cell and every column height is the version 4 Swirl; inside, the version 4 Swirl was only air
  for (let i = 0; i < w5.data.length; i++) {
    if (w5.data[i] === w4.data[i]) continue;
    const x = i % w5.W, z = Math.floor(i / w5.W) % w5.D, y = Math.floor(i / (w5.W * w5.D));
    if (!inR(x, y, z)) { bad.push(`cell ${x},${y},${z} changed outside the House`); if (bad.length > 5) return bad; }
    else if (w4.data[i] !== B.AIR) { bad.push(`cell ${x},${y},${z} was not air`); if (bad.length > 5) return bad; }
  }
  for (let x = 0; x < w5.W; x++) for (let z = 0; z < w5.D; z++) if (!(x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1) && w4.ground[x + z * w5.W] !== w5.ground[x + z * w5.W]) bad.push(`ground ${x},${z}`);
  return bad;
}

// Nobody is stuck: every stand cell of the House has a way out without any trick (walking, jumping, falling into the soft cloud floor,
// the doors, the warps) to a stand cell of the porch / the Hall, or off the porch into the sea (where the lift is). Returns the stuck cells.
export function stuckCells(g) {
  const { solid } = g, fwd = new Map(), sinks = new Set();
  const add = (a, b) => { if (!fwd.has(a)) fwd.set(a, []); fwd.get(a).push(b); };
  for (const [k, c] of g.nodes) {
    const room = roomAt(c), start = [c[0] + 0.5, c[1], c[2] + 0.5];
    if (Math.hypot(c[0] + 0.5 - PORCH.c[0], c[2] + 0.5 - PORCH.c[1]) < 6 && c[1] === PORCH.top + 1) sinks.add(k);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const sp of [0.01, 2.2, 4.3, 6.2]) for (const mode of ['walk', 'jump']) {
      if (sp < 1 && mode === 'walk') continue;
      const r = run(solid, start, dx * sp, dz * sp, { mode });
      const cc = cellOf(r.end);
      if (r.end[1] < 3 && !room) { sinks.add(k); continue; } // fell off the porch into the sea: the lift brings you back
      if (!r.landed) continue;
      if (g.nodes.has(key(cc))) add(k, key(cc));
      else if (g.cloud(...cc) && room) add(k, key(cellOf(room.start)));
    }
    for (const s of SWIRLS) {
      if (s.kind === 'door' && s.alcove) {
        const q = [start[0] - s.normal[0] * 0.2, c[1], start[2] - s.normal[2] * 0.2];
        if (touches(s, s.centre, q, false)) { const to = s.exit ? (s.room < 4 ? ROOMS[s.room].start : hallFront(5)) : s.to ?? (s.door ? doorTarget(s.door) : null); if (to) add(k, key(cellOf(to))); }
      }
      if (s.kind === 'warp' && touches(s, s.centre, start, false)) sinks.add(k); // the Porch Swirl takes you to the hub: out of the House
    }
  }
  const back = new Map();
  for (const [a, list] of fwd) for (const b of list) { if (!back.has(b)) back.set(b, []); back.get(b).push(a); }
  const ok = new Set(sinks), q = [...sinks];
  for (let i = 0; i < q.length; i++) for (const a of back.get(q[i]) ?? []) if (!ok.has(a)) { ok.add(a); q.push(a); }
  return [...g.nodes.keys()].filter(k => !ok.has(k));
}

// Where one trip lands: out of `exitSw` (its middle at `centre`) after a fall of `drop` blocks into its partner. { cell (the stand cell), fling, end }.
export function landing(g, exitSw, centre, drop) {
  const ex = exitOf(exitSw, centre, exitSpeed(drop));
  if (!ex.vel) return { cell: cellOf(run(g.solid, ex.pos, 0, 0, { mode: 'walk' }).end), fling: false, end: ex.pos };
  const f = flingFlight(g.solid, ex.pos, ex.vel, PORTAL.flingG, null);
  const r = run(g.solid, f.end, 0, 0, { mode: 'walk' });
  return { cell: cellOf(r.end), fling: true, end: f.end, onCloud: g.cloud(...cellOf(r.end)) };
}

// Can the player stand in front of room's exit swirl (the cell set `cells` holds a cell that touches it)?
export function exitReached(cells, room) {
  const ex = swirlById(room.exit);
  return [...cells].some(k => { const [x, y, z] = k.split(',').map(Number); return touches(ex, ex.centre, [x + 0.5 - ex.normal[0] * 0.2, y, z + 0.5 - ex.normal[2] * 0.2], false); });
}

if (process.argv[1] && process.argv[1].endsWith('portalcheck.mjs')) {
  const w = makeSwirl(), w4 = makeSwirl({ house: false });
  console.log('layout problems:', layoutProblems(w4, w));
  const g = houseGraph(w);
  console.log('stand cells:', g.nodes.size);
  const stuck = stuckCells(g);
  console.log('stuck:', stuck.length, stuck.slice(0, 12).join(' '));
  for (const room of ROOMS) {
    const c = cellOf(room.start);
    const phases = room.n === 3 ? [17.5, 19.5, 21.5, 23.5, 25.5, 27.5, 29.5, 31.5, 33.5, 35.5, 37.5] : [null];
    for (const [name, opts] of [['tricks', {}], ['no tricks', { tricks: false }]]) {
      for (const orangeY of name === 'tricks' ? phases : [null]) {
        const t0 = Date.now();
        const r = reachable(g, c, { ...opts, orangeY, stayIn: room });
        console.log(`room ${room.n} ${name}${orangeY != null ? ` orange at ${orangeY}` : ''}: exit reachable ${exitReached(r.cells, room)} (${r.cells.size} cells, ${Date.now() - t0} ms)`);
      }
    }
  }
}
