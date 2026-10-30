// T42: the Portal House checks that need no browser: a stand-in world for swirlLand, and a search over the House with swirl edges (each
// designed trick is a flight worked out with portalplay.js, the same code the live part uses). Used by tests/specs/portal.mjs (in the
// page, through /tests/portalcheck.mjs) and run by hand with `node tests/portalcheck.mjs`.
import { B, isSolid } from '../src/blocks.js';
import { swirlLand } from '../src/swirlland.js';
import { R, SWIRLS, ROOMS, doorTarget, exitTarget, swirlById, PORCH } from '../src/portalhouse.js';
import { PORTAL, exitSpeed, exitOf, centreAt, touches, flingFlight, flightDrop, headOf, boxHits, clearLine, ballRun, inCup, bridgeCells } from '../src/portalplay.js';

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
const losTo = (solid, eye, s, at) => { const c = at(s); return PORTAL.reach >= Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2])
  && clearLine(solid, eye, [c[0] + s.normal[0] * 0.4, c[1] + s.normal[1] * 0.4, c[2] + s.normal[2] * 0.4]); };
export const roomAt = c => ROOMS.find(r => c[0] > r.box.x0 && c[0] < r.box.x1 && c[2] > r.box.z0 && c[2] < r.box.z1 && c[1] >= r.box.bottom && c[1] <= r.box.top) ?? null;
const isOrangeEnd = s => s.kind === 'orange' || s.kind === 'peach';
// Where a door alcove leads.
export const doorTo = s => (s.exit ? exitTarget(s.room) : s.to ?? (s.door ? doorTarget(s.door) : null));
// A soft catch: resting on the cloud, or anywhere below the room's catch line (a pad in a pit floor with no swirl on it).
const caught = (g, room, c) => !!room && (g.cloud(...c) || c[1] < room.catchY);

// Does the Swirl Ball land in the Ball Room's cup with your teal swirl on `teal` and your orange swirl on `orange` (ids)?
const ballMemo = new WeakMap();
export function ballPresses(g, room, teal, orange) {
  if (!room?.ball) return false;
  if (!ballMemo.has(g)) ballMemo.set(g, new Map());
  const memo = ballMemo.get(g), k = `${room.n}|${teal}|${orange}`;
  if (!memo.has(k)) {
    const r = ballRun(g.solid, room.ball.mouth, { teal: teal ? swirlById(teal) : null, orange: orange ? swirlById(orange) : null });
    memo.set(k, r.rests && inCup(room.ball.cup, r.end));
  }
  return memo.get(k);
}

// Where can the player get from a cell? Breadth-first over (cell, where your teal swirl is, where your orange swirl is). Options:
//   tricks (default true): swirls work. place: you may put your swirls on pads. retap: your swirls can be moved in the air. orangeY / slideX: where the moving orange swirl
//   (centre y) / the sliding pad (centre x) is. placed0: your teal swirl starts on this slot. Returns { cells (Set of 'x,y,z'), exits
//   (Set of the door swirls walked into), has(cell), seen, parent }.
export function reachable(g, startCell, { tricks = true, retap = true, place = true, orangeY = null, slideX = null, placed0 = null, orange0 = null, limit = 300000, debug = false, stayIn = null, catches = true, slotOk = null, edges = false } = {}) {
  const { solid } = g;
  const seen = new Set(), queue = [], parent = new Map(), exits = new Set();
  const adj = new Map(), exitAt = new Map(); // edges: true records every move (from -> [to, by a fall into the cloud]) and which doors each state walks into
  const slotsOf = room => (slotOk ? room.slots.filter(slotOk) : room.slots); // slotOk: only these white pads count (the decoy checks)
  const sk = (c, t, o) => `${key(c)}|${t ?? '-'}|${o ?? '-'}`;
  // the blocks and stand cells with your swirls as they are: the Bridge Room's bridge of light is solid (no tricks: only its first stretch)
  const ctxMemo = new Map();
  const ctxOf = (room, teal, orange) => {
    if (!room?.bridge) return { S: solid, isNode: c => g.nodes.has(key(c)) };
    const k = `${tricks ? teal : '-'}|${tricks ? orange : '-'}`;
    if (!ctxMemo.has(k)) {
      const cells = new Set(bridgeCells(solid, room.bridge, tricks ? [teal && swirlById(teal), orange && swirlById(orange)] : []).map(key));
      const S = (x, y, z) => solid(x, y, z) || cells.has(`${x},${y},${z}`);
      ctxMemo.set(k, { S, cells, isNode: c => g.nodes.has(key(c)) || (cells.has(`${c[0]},${c[1] - 1},${c[2]}`) && !S(c[0], c[1], c[2]) && !S(c[0], c[1] + 1, c[2])) });
    }
    return ctxMemo.get(k);
  };
  const push = (c, teal, orange, from, fell = false) => { const k = sk(c, teal, orange); if (edges && from) { if (!adj.has(from)) adj.set(from, []); adj.get(from).push([k, fell]); } if (seen.has(k)) return; seen.add(k); parent.set(k, from); queue.push([c, teal, orange]); };
  const at = o => {
    if (!o.move) return o.centre;
    const axis = o.move.axis ?? 'y';
    if (axis === 'y' && orangeY != null) return [o.centre[0], orangeY, o.centre[2]];
    if (axis === 'x' && slideX != null) return [slideX, o.centre[1], o.centre[2]];
    return centreAt(o, 0);
  };
  const settle = (p, room, ctx) => { // where a flight that ends at p ends up: a stand cell, or the room's start (caught on the cloud)
    const r = run(ctx.S, p, 0, 0, { mode: 'walk', maxT: 6 }), c = cellOf(r.end);
    if (caught(g, room, c)) return catches ? { cell: cellOf(room.start), fell: true } : null;
    if (ctx.isNode(c)) return { cell: c };
    return null;
  };
  // the other end of the swirl you went into (your swirls may move while you fly: retap lists every choice)
  const others = (room, into, teal, orange) => {
    const out = [];
    if (isOrangeEnd(into)) { for (const T of retap ? [teal, ...slotsOf(room).filter(id => id !== teal)] : [teal]) if (T) out.push({ sw: swirlById(T), teal: T, orange }); }
    else if (room.peaches.length) { for (const O of retap ? [orange, ...room.peaches.filter(id => id !== orange)] : [orange]) if (O) out.push({ sw: swirlById(O), teal, orange: O }); }
    else { const fixed = room.oranges.map(swirlById); if (fixed.length) out.push({ sw: fixed[0], teal, orange }); }
    return out;
  };
  const activeOf = (room, teal, orange) => [...room.oranges.map(swirlById), ...(teal ? [swirlById(teal)] : []), ...(orange ? [swirlById(orange)] : [])];
  const trips = (room, teal, orange, exitSw, speed, depth, out) => { // out of exitSw at `speed`, following the swirls the flight runs into
    const ex = exitOf(exitSw, at(exitSw), speed), ctx = ctxOf(room, teal, orange);
    if (!ex.vel) { const s = settle(ex.pos, room, ctx); if (s) out.push({ ...s, teal, orange }); return; }
    if (depth > 6) return;
    const act = activeOf(room, teal, orange);
    const seek = q => { for (const o of act) if (o.id !== exitSw.id && touches(o, at(o), q, true)) return o; return null; };
    const f = flingFlight(ctx.S, ex.pos, ex.vel, PORTAL.flingG, seek);
    if (!f.hit) { const s = settle(f.end, room, ctx); if (s) out.push({ ...s, teal, orange }); return; }
    const drop = flightDrop(f, at(f.hit)[1], headOf(exitSw, speed));
    for (const o of others(room, f.hit, teal, orange)) trips(room, o.teal, o.orange, o.sw, exitSpeed(drop), depth + 1, out);
  };
  push(startCell, placed0, orange0, null);
  for (let qi = 0; qi < queue.length && queue.length < limit; qi++) {
    const [c, teal, orange] = queue[qi], room = roomAt(c);
    if (stayIn && room !== stayIn) continue; // (a cell outside the room is only recorded: where the doors lead)
    const from = sk(c, teal, orange);
    if (room && tricks && place) { // your swirls on the pads you can see (place: false = they stay where they are)
      for (const id of slotsOf(room)) if (id !== teal && losTo(solid, eyeOf(c), swirlById(id), at)) push(c, id, orange, from);
      for (const id of room.peaches) if (id !== orange && losTo(solid, eyeOf(c), swirlById(id), at)) push(c, teal, id, from);
    }
    const active = tricks && room ? activeOf(room, teal, orange) : [], ctx = ctxOf(room, teal, orange);
    const seek = q => { for (const s of active) if (touches(s, at(s), q, false)) return s; return null; };
    const start = [c[0] + 0.5, c[1], c[2] + 0.5];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const sp of [0.01, 2.2, 4.3, 6.2]) for (const mode of ['walk', 'jump']) {
      if (sp < 1 && mode === 'walk') continue;
      const r = run(ctx.S, start, dx * sp, dz * sp, { mode, seek });
      if (r.hit && room) { // into one end: out of the other
        const out = [], drop = Math.max(0, r.peak - r.end[1]);
        for (const o of others(room, r.hit, teal, orange).slice(0, 1)) trips(room, o.teal, o.orange, o.sw, exitSpeed(drop), 0, out);
        if (debug) console.log('event', key(c), teal, orange, r.hit.id, drop.toFixed(2), '->', out.map(o => `${key(o.cell)}|${o.teal}|${o.orange}`).join(' '));
        for (const o of out) push(o.cell, o.teal, o.orange, from, !!o.fell);
        continue;
      }
      if (!r.landed) continue;
      const cc = cellOf(r.end);
      if (caught(g, room, cc)) { if (catches) push(cellOf(room.start), teal, orange, from, true); } // caught: back to the start (catches: false = a fall is no way)
      else if (ctx.isNode(cc)) push(cc, teal, orange, from);
    }
    for (const s of SWIRLS) { // doors: the exit of a room, the way home, the Hall's doors
      if (s.kind !== 'door' || !s.alcove) continue;
      const q = [start[0] - s.normal[0] * 0.2, c[1], start[2] - s.normal[2] * 0.2];
      if (!touches(s, s.centre, q, false)) continue;
      if (s.needs === 'ball' && !(tricks && ballPresses(g, room, teal, orange))) continue; // shut until the ball is on the button
      if (s.needs === 'button') continue; // the Quick Room's door: open only for a moment (quickTime checks it)
      const to = doorTo(s);
      if (to) { exits.add(s.id); if (edges) { if (!exitAt.has(from)) exitAt.set(from, new Set()); exitAt.get(from).add(s.id); } push(cellOf(to), null, null, from); }
    }
    for (const s of SWIRLS) { // the warps: porch <-> hub
      if (s.kind !== 'warp' || !touches(s, s.centre, start, false)) continue;
      push(cellOf(s.to), null, null, from);
    }
  }
  const cells = new Set([...seen].map(k => k.split('|')[0]));
  return { seen, cells, exits, parent, adj, exitAt, has: c => cells.has(key(c)), size: seen.size };
}

// Owner 2026-10-29: "failure" must never be the way on. The places of a room (with your swirls as they are) from which neither its exit
// nor its way home to the Hall can be reached without a fall into the soft cloud: a fall may happen (a miss), but never be needed to go
// on. One search with edges (the search with the tricks, from the start, at one phase of a moving swirl), then backwards from the doors
// over the moves that are not a fall. Returns the cells ('x,y,z') of those places.
export function fallOnly(g, room, opts = {}) {
  const res = reachable(g, cellOf(room.start), { stayIn: room, edges: true, ...opts });
  const back = new Map();
  for (const [a, list] of res.adj) for (const [b, fell] of list) if (!fell) { if (!back.has(b)) back.set(b, []); back.get(b).push(a); }
  const good = new Set(), q = [];
  for (const [k, ids] of res.exitAt) if (ids.has(room.exit) || ids.has(room.hall)) { good.add(k); q.push(k); }
  for (let i = 0; i < q.length; i++) for (const a of back.get(q[i]) ?? []) if (!good.has(a)) { good.add(a); q.push(a); }
  const bad = new Set();
  for (const k of res.seen) { const c = k.split('|')[0]; if (!good.has(k) && roomAt(c.split(',').map(Number)) === room) bad.add(c); }
  return [...bad];
}

// The decoy pads (owner 2026-10-29): no way through one of them helps. For every room with decoys: with only the decoys as white pads the
// exit is never reached (at every phase of a moving swirl), and with your swirl on a decoy (each orange end) the exit is not reached
// either (swirls left where they are), and the Swirl Ball never gets onto the button through one.
export function decoyRows(g, rooms = ROOMS) {
  return rooms.filter(r => r.slots.some(id => swirlById(id).decoy)).map(room => {
    const c = cellOf(room.start), ph = PHASES[room.n], name = ph && Object.keys(ph)[0], values = ph ? ph[name] : [null];
    const decoys = room.slots.filter(id => swirlById(id).decoy), isDecoy = id => decoys.includes(id);
    if (room.button) { // the Quick Room: no decoy (set before the button, or tapped on the way) gets you to the door in time
      const t = quickTime(g, room, { pre: [null, ...decoys], slotOk: isDecoy });
      return { n: room.n, id: room.id, decoys, onlyDecoys: t <= room.button.open, pinned: decoys.filter(d => quickTime(g, room, { pre: [d], retap: false }) <= room.button.open), ball: [], time: t };
    }
    const onlyDecoys = values.some(v => exitReached(reachable(g, c, { stayIn: room, slotOk: isDecoy, ...(name ? { [name]: v } : {}) }), room));
    const pinned = [];
    for (const d of decoys) for (const o of [null, ...room.peaches]) for (const v of values) {
      if (exitReached(reachable(g, c, { stayIn: room, place: false, retap: false, placed0: d, orange0: o, ...(name ? { [name]: v } : {}) }), room)) pinned.push(`${d}+${o}@${v}`);
    }
    const ball = room.ball ? decoys.flatMap(d => [null, ...room.peaches].filter(o => ballPresses(g, room, d, o)).map(o => `${d}+${o}`)) : [];
    return { n: room.n, id: room.id, decoys, onlyDecoys, pinned, ball };
  });
}

// Decoys look like real choices: each one can be aimed at from somewhere you can walk to in its room. And none sends you round and round: with your blue
// swirl on a decoy and each orange end, a trip in (after falls of 0..16 blocks) never comes back into the same two swirls six times.
// Returns the problems ('id: not seen from the start', 'id+orange@fall: loops').
export function decoyProblems(g) {
  const bad = [], seenFrom = new Map();
  const at = s => (s.move ? centreAt(s, 0) : s.centre);
  for (const room of ROOMS) for (const d of room.slots.filter(id => swirlById(id).decoy)) {
    const teal = swirlById(d);
    const walk = seenFrom.get(room) ?? seenFrom.set(room, [...reachable(g, cellOf(room.start), { tricks: false, stayIn: room }).cells].map(k => k.split(',').map(Number)).filter(c => roomAt(c) === room)).get(room);
    if (!walk.some(c => losTo(g.solid, eyeOf(c), teal, at))) bad.push(`${d}: never seen`);
    for (const o of room.peaches.length ? room.peaches : room.oranges.slice(0, 1)) {
      const orange = swirlById(o), ends = [teal, orange], other = s => (s === teal ? orange : teal);
      for (const fall of [0, 3, 6, 10, 16]) {
        let out = teal, speed = exitSpeed(fall), n = 0;
        for (; n < 6; n++) {
          const ex = exitOf(out, at(out), speed), from = out;
          let hit = null, drop = 0;
          if (ex.vel) {
            const f = flingFlight(g.solid, ex.pos, ex.vel, PORTAL.flingG, q => ends.find(s => s !== from && touches(s, at(s), q, true)) ?? null);
            if (f.hit) { hit = f.hit; drop = flightDrop(f, at(f.hit)[1], headOf(from, speed)); }
            else { const r = run(g.solid, f.end, 0, 0, { mode: 'walk', maxT: 6, seek: q => ends.find(s => s !== from && touches(s, at(s), q, false)) ?? null }); hit = r.hit; drop = r.peak - r.end[1]; }
          } else { const r = run(g.solid, ex.pos, 0, 0, { mode: 'walk', maxT: 6, seek: q => ends.find(s => s !== from && touches(s, at(s), q, false)) ?? null }); hit = r.hit; drop = r.peak - r.end[1]; }
          if (!hit) break;
          out = other(hit); speed = exitSpeed(Math.max(0, drop));
        }
        if (n >= 6) bad.push(`${d}+${o}@${fall}: loops`);
      }
    }
  }
  return bad;
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
    if (caught(g, room, c)) { add(k, key(cellOf(room.start))); continue; } // resting below the catch line: puffed back to the start
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const sp of [0.01, 2.2, 4.3, 6.2]) for (const mode of ['walk', 'jump']) {
      if (sp < 1 && mode === 'walk') continue;
      const r = run(solid, start, dx * sp, dz * sp, { mode });
      const cc = cellOf(r.end);
      if (r.end[1] < 3 && !room) { sinks.add(k); continue; } // fell off the porch into the sea: the lift brings you back
      if (!r.landed) continue;
      if (caught(g, room, cc)) add(k, key(cellOf(room.start)));
      else if (g.nodes.has(key(cc))) add(k, key(cc));
    }
    for (const s of SWIRLS) {
      if (s.kind === 'door' && s.alcove && !s.needs) {
        const q = [start[0] - s.normal[0] * 0.2, c[1], start[2] - s.normal[2] * 0.2];
        if (touches(s, s.centre, q, false)) { const to = doorTo(s); if (to) add(k, key(cellOf(to))); }
      }
      if (s.kind === 'warp' && touches(s, s.centre, start, false)) sinks.add(k); // the Porch Swirl: to the hub, out of the House
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

// The Quick Room (room 9): the fewest seconds from stepping off the button to walking into its door (Infinity: never). pre: where your
// blue swirl may already be when you step on the button (null = nowhere); retap: you may tap a pad on the way (`tap` s each).
// A search over (stand cell, your blue swirl) with the runs' own times, like reachable() but timed (Dijkstra).
export function quickTime(g, room, { pre = [null], tricks = true, retap = true, slotOk = null, tap = 0.6 } = {}) {
  const { solid } = g, door = swirlById(room.exit), oranges = room.oranges.map(swirlById), slots = slotOk ? room.slots.filter(slotOk) : room.slots;
  const best = new Map(), heap = [];
  const push = (c, teal, t) => { const k = `${key(c)}|${teal ?? '-'}`; if ((best.get(k) ?? Infinity) <= t) return; best.set(k, t); heap.push([t, c, teal]); };
  for (const p of pre) push(cellOf(room.button.at), p, 0);
  let found = Infinity;
  while (heap.length) {
    let bi = 0;
    for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
    const [t, c, teal] = heap.splice(bi, 1)[0];
    if (t >= found || t > (best.get(`${key(c)}|${teal ?? '-'}`) ?? Infinity)) continue;
    const at = [c[0] + 0.5, c[1], c[2] + 0.5];
    if (touches(door, door.centre, [at[0] - door.normal[0] * 0.2, c[1], at[2] - door.normal[2] * 0.2], false)) { found = t; continue; }
    if (tricks && retap) for (const id of slots) if (id !== teal && losTo(solid, eyeOf(c), swirlById(id), s => s.centre)) push(c, id, t + tap);
    const active = tricks ? [...oranges, ...(teal ? [swirlById(teal)] : [])] : [];
    const seek = q => { for (const s of active) if (touches(s, s.centre, q, false)) return s; return null; };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const sp of [0.01, 2.2, 4.3, 6.2]) for (const mode of ['walk', 'jump']) {
      if (sp < 1 && mode === 'walk') continue;
      const r = run(solid, at, dx * sp, dz * sp, { mode, seek });
      if (r.hit) {
        const other = isOrangeEnd(r.hit) ? (teal ? swirlById(teal) : null) : oranges[0];
        if (!other) continue;
        const ex = exitOf(other, other.centre, exitSpeed(Math.max(0, r.peak - r.end[1])));
        let p = ex.pos, ft = 0;
        if (ex.vel) { const f = flingFlight(solid, ex.pos, ex.vel, PORTAL.flingG, null); p = f.end; ft = f.time; }
        const s = run(solid, p, 0, 0, { mode: 'walk', maxT: 6 }), cc = cellOf(s.end);
        if (g.nodes.has(key(cc))) push(cc, teal, t + r.t + ft + s.t);
        continue;
      }
      if (!r.landed) continue;
      const cc = cellOf(r.end);
      if (g.nodes.has(key(cc))) push(cc, teal, t + r.t);
    }
  }
  return found;
}

// Did the search walk into the room's exit door? (`res` = what reachable() returned.)
export const exitReached = (res, room) => res.exits.has(room.exit);

// Every room: the exit with the tricks (at the given phases of a moving swirl) and without any. Returns one row per room.
export const PHASES = { 3: { orangeY: [17.5, 19.5, 21.5, 23.5, 25.5, 27.5, 29.5, 31.5, 33.5, 35.5, 37.5] }, 6: { slideX: [145.5, 146.5, 147.5, 148.5, 149.5, 150.5, 151.5, 152.5, 153.5, 154.5, 155.5, 156.5] } };
export function roomRows(g, rooms = ROOMS) {
  return rooms.map(room => {
    const c = cellOf(room.start), ph = PHASES[room.n], name = ph && Object.keys(ph)[0], values = ph ? ph[name] : [null];
    const t0 = Date.now();
    if (room.button) { // the Quick Room: in time with your swirl set first; never on foot; not when the swirl is only tapped after the button
      const skilled = quickTime(g, room, { pre: [null, ...room.slots] }), naive = quickTime(g, room, { tricks: false }), late = quickTime(g, room, { pre: [null] });
      return { n: room.n, id: room.id, phase: 'time', values: [`${skilled.toFixed(2)}s/${naive.toFixed(2)}s/${late.toFixed(2)}s`], withTricks: [skilled <= room.button.open - 1], without: naive <= room.button.open + 1, noRetap: late <= room.button.open, ms: Date.now() - t0, skilled, naive, late };
    }
    const withTricks = values.map(v => exitReached(reachable(g, c, { stayIn: room, ...(name ? { [name]: v } : {}) }), room));
    const without = exitReached(reachable(g, c, { tricks: false, stayIn: room, ...(name ? { [name]: values[0] } : {}) }), room);
    const noRetap = exitReached(reachable(g, c, { retap: false, stayIn: room, ...(name ? { [name]: values[Math.floor(values.length / 2)] } : {}) }), room);
    return { n: room.n, id: room.id, phase: name, values, withTricks, without, noRetap, ms: Date.now() - t0 };
  });
}

if (process.argv[1] && process.argv[1].endsWith('portalcheck.mjs')) {
  const w = makeSwirl(), w4 = makeSwirl({ house: false });
  console.log('layout problems:', layoutProblems(w4, w));
  const g = houseGraph(w);
  console.log('stand cells:', g.nodes.size);
  const stuck = stuckCells(g);
  console.log('stuck:', stuck.length, stuck.slice(0, 12).join(' '));
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
  const rooms = only ? ROOMS.filter(x => only.includes(x.n)) : ROOMS;
  console.log('decoys:', ROOMS.map(r => r.slots.filter(id => swirlById(id).decoy).length).join(' '), '| problems:', decoyProblems(g).join(' ') || '-');
  for (const d of decoyRows(g, rooms)) console.log(`decoys room ${d.n}: ${d.decoys} | only decoys reach the exit ${d.onlyDecoys} | pinned ${d.pinned.join(' ') || '-'} | ball ${d.ball.join(' ') || '-'}`);
  for (const r of rooms) { const t0 = Date.now(), ph = PHASES[r.n], k = ph && Object.keys(ph)[0], bad = new Set((ph ? ph[k] : [null]).flatMap(v => fallOnly(g, r, k ? { [k]: v } : {}))); console.log(`room ${r.n} fall-only cells: ${bad.size} ${[...bad].slice(0, 8).join(' ')} (${Date.now() - t0} ms)`); }
  for (const r of roomRows(g, rooms)) console.log(`room ${r.n} ${r.id}: tricks ${r.values.map((v, i) => `${v ?? ''}:${r.withTricks[i]}`).join(' ')} | no tricks ${r.without} | no retap ${r.noRetap} (${r.ms} ms)`);
}
