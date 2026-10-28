// Cube Planets (step 0): the terrain checks that need no browser. A stand-in world for cubeLand, then for each planet a walk graph over
// all six faces (walking over every edge, jumping onto a 1-block bump, dropping off anything), and the hops between planets from
// gravity.js flightLand (the same sums as the player). Used by tests/specs/cube.mjs and run by hand with `node tests/cubecheck.mjs [seed]`.
import { B, isSolid } from '../src/blocks.js';
import { cubeLand, SIZE, PLANETS, BOXES, HOPS, FACES, faceCell, faceCentre, hopSpot, DOOR } from '../src/cubeland.js';
import { GRAV, flightLand, downAt, upOf, frameOf } from '../src/gravity.js';

export const WORLD_H = 48;
export function standIn(seed, [W, D] = [SIZE, SIZE]) {
  const w = {
    W, D, seed, data: new Uint8Array(W * D * WORLD_H), ground: new Uint8Array(W * D),
    index: (x, y, z) => x + W * (z + D * y),
    inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < WORLD_H,
    get: (x, y, z) => (w.inBounds(x, y, z) ? w.data[x + W * (z + D * y)] : B.AIR),
    isSolid: (x, y, z) => isSolid(w.get(x, y, z)),
  };
  return w;
}
export function makeCubes(seed) { const w = standIn(seed); cubeLand(w, { id: 'gravity', size: [SIZE, SIZE] }); return w; }

// Every face cell of every planet: { key, planet, face, u, v, h (how many solid cells stick out above the skin), ok (2 cells of air
// above that to stand in) }. Neighbours: within a face a step to the next cell (up at most 1: a jump; down any), and over an edge to every
// face cell that shares the same skin block (an edge or a corner block belongs to 2 or 3 faces).
export function faceGraph(w) {
  const nodes = new Map(), bySurface = new Map();
  for (const [pi, P] of PLANETS.entries()) for (const [fi, [axis, sign]] of FACES.entries()) for (let u = 0; u < P.n; u++) for (let v = 0; v < P.n; v++) {
    let h = 0;
    while (h < 8 && isSolid(w.get(...faceCell(P, axis, sign, u, v, h + 1)))) h++;
    const ok = [1, 2].every(k => !isSolid(w.get(...faceCell(P, axis, sign, u, v, h + k))));
    const key = `${pi}:${fi}:${u}:${v}`, surf = faceCell(P, axis, sign, u, v, 0).join();
    nodes.set(key, { key, planet: pi, face: fi, axis, sign, u, v, h, ok, surf });
    if (!bySurface.has(surf)) bySurface.set(surf, []);
    bySurface.get(surf).push(key);
  }
  const edges = n => {
    const out = [];
    if (!n.ok) return out;
    const P = PLANETS[n.planet];
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = n.u + du, v = n.v + dv;
      if (u < 0 || v < 0 || u >= P.n || v >= P.n) continue;
      const m = nodes.get(`${n.planet}:${n.face}:${u}:${v}`);
      if (m.ok && m.h <= n.h + 1) out.push(m.key);
    }
    if (n.h === 0) for (const k of bySurface.get(n.surf)) { const m = nodes.get(k); if (k !== n.key && m.ok && m.h === 0) out.push(k); } // over the edge
    return out;
  };
  return { nodes, edges };
}

// The player's box (1.8 along up, 0.6 across) in the world, and whether it overlaps a planet's solid box.
const bodyBox = b => { const u = upOf(b.frame), lo = [0, 1, 2].map(k => b.pos[k] - 0.3), hi = [0, 1, 2].map(k => b.pos[k] + 0.3); for (let k = 0; k < 3; k++) if (u[k]) { lo[k] = Math.min(b.pos[k], b.pos[k] + u[k] * 1.8); hi[k] = Math.max(b.pos[k], b.pos[k] + u[k] * 1.8); } return { lo, hi }; };
const boxHits = (P, { lo, hi }) => lo[0] < P.x1 - 1e-9 && hi[0] > P.x0 + 1e-9 && lo[1] < P.y1 - 1e-9 && hi[1] > P.y0 + 1e-9 && lo[2] < P.z1 - 1e-9 && hi[2] > P.z0 + 1e-9;
// The planet a jump straight up from face point `at` (on the surface) lands on, or -1.
export function jumpFrom(at, axis, sign, { side = [0, 0, 0] } = {}) {
  const down = [0, 0, 0]; down[axis] = -sign;
  const up = upOf(frameOf(down)), v0 = up.map((u, k) => u * GRAV.jump + side[k]);
  const p0 = [...at]; p0[axis] += sign * 1e-3;
  let bump = false;
  const r = flightLand(p0, v0, BOXES, { maxT: 10, each: b => { if (BOXES.some(P => boxHits(P, bodyBox(b)))) bump = true; } });
  return r && !bump ? r.planet : bump ? 'bump' : -1;
}

export function analyze(seed = 1) {
  const w = makeCubes(seed), problems = [], info = {};
  const { nodes, edges } = faceGraph(w);
  // 1. nobody stuck: from every cell you can stand on, every other standable cell of that planet's flat skin can be reached, and the
  // way back's arrival can be reached from every cell of the Meadow Cube
  for (const [pi, P] of PLANETS.entries()) {
    const mine = [...nodes.values()].filter(n => n.planet === pi && n.ok);
    const flat = mine.filter(n => n.h === 0);
    const start = flat[0].key, seen = new Set([start]), q = [start];
    while (q.length) for (const k of edges(nodes.get(q.shift()))) if (!seen.has(k)) { seen.add(k); q.push(k); }
    const lost = flat.filter(n => !seen.has(n.key));
    if (lost.length) problems.push(`${P.id}: ${lost.length} flat cells cut off (${lost.slice(0, 3).map(n => n.key)})`);
    // every cell (bumps too) gets back down to the flat skin
    const stuck = mine.filter(n => { const s = new Set([n.key]), qq = [n.key]; while (qq.length) { const k = qq.shift(); if (seen.has(k)) return false; for (const m of edges(nodes.get(k))) if (!s.has(m)) { s.add(m); qq.push(m); } } return true; });
    const downOk = mine.filter(n => n.h > 0).every(n => { const P2 = PLANETS[n.planet]; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([du, dv]) => { const m = nodes.get(`${n.planet}:${n.face}:${n.u + du}:${n.v + dv}`); return m && m.ok && m.h < n.h; }) || n.u === 0 || n.v === 0 || n.u === P2.n - 1 || n.v === P2.n - 1; });
    if (stuck.length || !downOk) problems.push(`${P.id}: ${stuck.length} cells you could not walk away from`);
    info[P.id] = { cells: mine.length, flat: flat.length, bumps: mine.length - flat.length };
  }
  // the arrival stands on the Meadow Cube's top
  const M = PLANETS[0], arr = w.arrivals.gravity, gd = downAt(BOXES, arr, null);
  if (gd.planet !== 0 || gd.axis !== 1 || gd.sign !== 1 || arr[1] !== M.y + M.n) problems.push(`the arrival is not on the Meadow Cube's top (${arr})`);
  for (let k = 0; k < 2; k++) if (isSolid(w.get(Math.floor(arr[0]), arr[1] + k, Math.floor(arr[2])))) problems.push('the arrival is inside a block');
  // 2. the hops: a plain jump from the middle of a hop face (and round it) lands on the next planet; from every other face of every
  // planet a plain jump lands back on the same planet (so every planet needs exactly the hops it is meant to need)
  const hopOk = [];
  for (const h of HOPS) {
    const c = hopSpot(h), [a, b] = [0, 1, 2].filter(x => x !== h.axis);
    let hit = 0, n = 0;
    for (const da of [-2, 0, 2]) for (const db of [-2, 0, 2]) { const p = [...c]; p[a] += da; p[b] += db; n++; if (jumpFrom(p, h.axis, h.sign) === h.to) hit++; }
    hopOk.push(`${PLANETS[h.from].id}->${PLANETS[h.to].id} ${hit}/${n}`);
    if (hit !== n) problems.push(`a plain jump from the middle of the ${PLANETS[h.from].id} side lands on the ${PLANETS[h.to].id} only ${hit} of ${n} times`);
  }
  info.hops = hopOk;
  for (const [pi, P] of PLANETS.entries()) for (const [axis, sign] of FACES) {
    if (HOPS.some(h => h.from === pi && h.axis === axis && h.sign === sign)) continue;
    const c = faceCentre(pi, axis, sign), [a, b] = [0, 1, 2].filter(x => x !== axis);
    for (const da of [-3, 0, 3]) for (const db of [-3, 0, 3]) { const p = [...c]; p[a] += da + 0.5; p[b] += db + 0.5; const to = jumpFrom(p, axis, sign); if (to !== pi) problems.push(`a plain jump from ${P.id} [${axis},${sign}] lands on ${to}`); }
  }
  // 3. the blocks: only these ids, the new ones only 183 and 249
  const ids = new Set();
  for (let i = 0; i < w.data.length; i++) ids.add(w.data[i]);
  info.ids = [...ids].sort((x, y) => x - y);
  const allowed = new Set([B.AIR, B.PLANET_ROCK, B.STAR_GRASS, B.ICE, B.COBBLE, B.GRAVEL, B.CRYSTAL, B.GLOWCAP, B.FLOWER_BUSH, B.LOG, B.LEAVES, B.PICTURE_FRAME, B.WAY_BACK]);
  const odd = info.ids.filter(i => !allowed.has(i));
  if (odd.length) problems.push(`unexpected blocks ${odd}`);
  // 4. keeps: the whole sky (no building, no riding), the door; rests on every planet top
  if (!w.keeps.some(k => k.name === 'space' && k.rideText) || !w.keeps.some(k => k.name === 'door-gravity')) problems.push('the keeps');
  if (w.rests.length < 4) problems.push('rests');
  info.keeps = w.keeps.length; info.door = DOOR;
  return { problems, info, world: w };
}

if (process.argv[1]?.endsWith('cubecheck.mjs')) {
  const r = analyze(Number(process.argv[2] ?? 1));
  console.log(JSON.stringify(r.info, null, 1));
  console.log(r.problems.length ? r.problems.join('\n') : 'all good');
}
