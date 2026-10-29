// Cube Planets: the terrain checks that need no browser. A stand-in world for cubeLand, then for each planet a walk graph over all six faces
// (walking over every edge, jumping onto a 1-block bump, dropping off anything), and the plain jumps between planets from gravity.js
// flightLand (the same sums as the player). Used by tests/specs/cube.mjs and run by hand with `node tests/cubecheck.mjs [seed]`.
import { B, WOOL, isSolid } from '../src/blocks.js';
import { cubeLand, SIZE, PLANETS, P, BOXES, HOPS, FACES, faceCell, faceSize, faceCentre, hopSpot, DOOR, FLOWERS, HOME_FLOWERS, LENSES, MOON, PUPS, sizeOf } from '../src/cubeland.js';
import { ferryAt } from '../src/orbits.js';
import { GRAV, flightLand, downAt, upOf, frameOf, toWorld } from '../src/gravity.js';

export const WORLD_H = 48;
export function standIn(seed, [W, D] = [SIZE, SIZE]) {
  const w = {
    W, D, seed, data: new Uint8Array(W * D * WORLD_H), ground: new Uint8Array(W * D),
    index: (x, y, z) => x + W * (z + D * y),
    inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < WORLD_H,
    get: (x, y, z) => (w.inBounds(x, y, z) ? w.data[x + W * (z + D * y)] : B.AIR),
    isSolid: (x, y, z) => isSolid(w.get(x, y, z)),
    fenced: () => false, fenceAt: () => null,
  };
  return w;
}
export function makeCubes(seed) { const w = standIn(seed); cubeLand(w, { id: 'gravity', size: [SIZE, SIZE] }); return w; }

// Every face cell of every planet: { key, planet, face, u, v, h (how many solid cells stick out above the skin), ok (2 cells of air
// above that to stand in) }. Neighbours: within a face a step to the next cell (up at most 1: a jump; down any), and over an edge to every
// face cell that shares the same skin block (an edge or a corner block belongs to 2 or 3 faces).
export function faceGraph(w) {
  const nodes = new Map(), bySurface = new Map();
  for (const [pi, Pl] of PLANETS.entries()) for (const [fi, [axis, sign]] of FACES.entries()) {
    const [nu, nv] = faceSize(Pl, axis);
    for (let u = 0; u < nu; u++) for (let v = 0; v < nv; v++) {
      let h = 0;
      while (h < 8 && isSolid(w.get(...faceCell(Pl, axis, sign, u, v, h + 1)))) h++;
      const ok = [1, 2].every(k => !isSolid(w.get(...faceCell(Pl, axis, sign, u, v, h + k))));
      const key = `${pi}:${fi}:${u}:${v}`, surf = faceCell(Pl, axis, sign, u, v, 0).join();
      nodes.set(key, { key, planet: pi, face: fi, axis, sign, u, v, h, ok, surf, nu, nv });
      if (!bySurface.has(surf)) bySurface.set(surf, []);
      bySurface.get(surf).push(key);
    }
  }
  const edges = n => {
    const out = [];
    if (!n.ok) return out;
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = n.u + du, v = n.v + dv;
      if (u < 0 || v < 0 || u >= n.nu || v >= n.nv) continue;
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
const boxHits = (Pl, { lo, hi }) => lo[0] < Pl.x1 - 1e-9 && hi[0] > Pl.x0 + 1e-9 && lo[1] < Pl.y1 - 1e-9 && hi[1] > Pl.y0 + 1e-9 && lo[2] < Pl.z1 - 1e-9 && hi[2] > Pl.z0 + 1e-9;
// The planet a jump straight up from face point `at` (on the surface) lands on, or -1.
export function jumpFrom(at, axis, sign, { side = [0, 0, 0], speed = GRAV.jump } = {}) {
  const down = [0, 0, 0]; down[axis] = -sign;
  const up = upOf(frameOf(down)), v0 = up.map((u, k) => u * speed + side[k]);
  const p0 = [...at]; p0[axis] += sign * 1e-3;
  let bump = false;
  const r = flightLand(p0, v0, BOXES, { maxT: 10, each: b => { if (BOXES.some(Pl => boxHits(Pl, bodyBox(b)))) bump = true; } });
  return r && !bump ? r.planet : bump ? 'bump' : -1;
}
// Which planets you reach from the Meadow Cube by walking and plain jumps (HOPS) only: the flowers' pebbles and the Great Cube must not be.
export function plainReach(from = P.meadow, more = []) {
  const seen = new Set([from]), q = [from], all = [...HOPS.map(h => [h.from, h.to]), ...more];
  while (q.length) { const c = q.shift(); for (const [a, b] of all) if (a === c && !seen.has(b)) { seen.add(b); q.push(b); } }
  return seen;
}

export function analyze(seed = 1) {
  const w = makeCubes(seed), problems = [], info = {};
  const { nodes, edges } = faceGraph(w);
  // 1. nobody stuck: from every cell you can stand on, every other standable cell of that planet's flat skin can be reached, and every
  // bump gets back down to the flat skin
  for (const [pi, Pl] of PLANETS.entries()) {
    const mine = [...nodes.values()].filter(n => n.planet === pi && n.ok);
    const flat = mine.filter(n => n.h === 0);
    const start = flat[0].key, seen = new Set([start]), q = [start];
    while (q.length) for (const k of edges(nodes.get(q.shift()))) if (!seen.has(k)) { seen.add(k); q.push(k); }
    const lost = flat.filter(n => !seen.has(n.key));
    if (lost.length) problems.push(`${Pl.id}: ${lost.length} flat cells cut off (${lost.slice(0, 3).map(n => n.key)})`);
    const stuck = mine.filter(n => { const s = new Set([n.key]), qq = [n.key]; while (qq.length) { const k = qq.shift(); if (seen.has(k)) return false; for (const m of edges(nodes.get(k))) if (!s.has(m)) { s.add(m); qq.push(m); } } return true; });
    if (stuck.length) problems.push(`${Pl.id}: ${stuck.length} cells you could not walk away from`);
    info[Pl.id] = { cells: mine.length, flat: flat.length, bumps: mine.length - flat.length };
  }
  // the arrival stands on the Meadow Cube's top
  const M = PLANETS[P.meadow], arr = w.arrivals.gravity, gd = downAt(BOXES, arr, null);
  if (gd.planet !== P.meadow || gd.axis !== 1 || gd.sign !== 1 || arr[1] !== M.y + sizeOf(M)[1]) problems.push(`the arrival is not on the Meadow Cube's top (${arr})`);
  for (let k = 0; k < 2; k++) if (isSolid(w.get(Math.floor(arr[0]), arr[1] + k, Math.floor(arr[2])))) problems.push('the arrival is inside a block');
  // 2. the plain jumps: from the middle of a hop face (and round it) a plain jump lands on the next planet; from every other face of every
  // planet a plain jump lands back on the same planet (so every planet needs exactly the ways it is meant to need)
  const hopOk = [];
  for (const h of HOPS) {
    const c = hopSpot(h), [a, b] = [0, 1, 2].filter(x => x !== h.axis);
    let hit = 0, n = 0;
    for (const da of [-1.5, 0, 1.5]) for (const db of [-1.5, 0, 1.5]) { const p = [...c]; p[a] += da; p[b] += db; n++; if (jumpFrom(p, h.axis, h.sign) === h.to) hit++; }
    hopOk.push(`${PLANETS[h.from].id}->${PLANETS[h.to].id} ${hit}/${n}`);
    if (hit !== n) problems.push(`a plain jump from the middle of the ${PLANETS[h.from].id} side lands on the ${PLANETS[h.to].id} only ${hit} of ${n} times`);
  }
  info.hops = hopOk;
  const extra = new Set();
  for (const [pi, Pl] of PLANETS.entries()) for (const [axis, sign] of FACES) {
    if (HOPS.some(h => h.from === pi && h.axis === axis && h.sign === sign)) continue;
    const c = faceCentre(pi, axis, sign), [a, b] = [0, 1, 2].filter(x => x !== axis), s = sizeOf(Pl);
    for (const fa of [-0.3, 0, 0.3]) for (const fb of [-0.3, 0, 0.3]) {
      const p = [...c]; p[a] = Math.floor(c[a] + fa * s[a]) + 0.5; p[b] = Math.floor(c[b] + fb * s[b]) + 0.5;
      const to = jumpFrom(p, axis, sign);
      if (typeof to === 'number' && to >= 0 && to !== pi) extra.add(`${pi}>${to}`); // another way (fine if it skips no flower: part 3)
      else if (to !== pi) problems.push(`a plain jump from ${Pl.id} [${axis},${sign}] at ${p.map(v => v.toFixed(1))} lands on ${to}`);
    }
  }
  info.extra = [...extra].map(e => e.split('>').map(i => PLANETS[i].id).join('>'));
  // 3. the Planet Hop is the only way to the pebbles and the Great Cube: walking and plain jumps from the Meadow Cube never get there
  const reach = plainReach(P.meadow, [...extra].map(e => e.split('>').map(Number)));
  info.plain = [...reach].map(i => PLANETS[i].id);
  for (const id of ['hop1', 'hop2', 'hop3', 'hop4', 'great', 'lens1', 'lens2', 'lens3']) if (reach.has(P[id])) problems.push(`${id} can be reached without the flowers / the moon`);
  // ... nor by a running jump off any edge of the Moon Dock's top toward a Lens Rock (the rocks are too far to jump to: you need the moon)
  const D = BOXES[P.base], lensHits = [];
  for (const L of LENSES) {
    const b = BOXES[L.planet], c = [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
    for (let k = 0; k <= 20; k++) for (const mode of [GRAV.walk, GRAV.sprint]) {
      // from a spot on the dock's rim nearest the rock, running at it and jumping at the very edge
      const x = Math.max(D.x0 + 0.31, Math.min(D.x1 - 0.31, c[0] + (k - 10) * 0.8)), z = Math.max(D.z0 + 0.31, Math.min(D.z1 - 0.31, c[1] + (k - 10) * 0.8));
      const d = [c[0] - x, c[1] - z], n = Math.hypot(...d), v = [d[0] / n * mode, GRAV.jump, d[1] / n * mode];
      const r = flightLand([x, D.y1 + 1e-3, z], v, BOXES, { maxT: 10 });
      if (r && r.planet === L.planet) lensHits.push(`${PLANETS[L.planet].id} from ${x.toFixed(1)},${z.toFixed(1)}`);
    }
  }
  if (lensHits.length) problems.push(`a Lens Rock can be reached by a running jump off the Moon Dock: ${lensHits.slice(0, 3).join('; ')}`);
  // 4. the blocks: only these ids, the new ones only 149, 183 and 249
  const ids = new Set();
  for (let i = 0; i < w.data.length; i++) ids.add(w.data[i]);
  info.ids = [...ids].sort((x, y) => x - y);
  const allowed = new Set([B.AIR, B.PLANET_ROCK, B.STAR_GRASS, B.ICE, B.COBBLE, B.GRAVEL, B.CRYSTAL, B.GLOWCAP, B.FLOWER_BUSH, B.LOG, B.LEAVES, B.PICTURE_FRAME, B.WAY_BACK, B.BOSS_STAND, WOOL.gravity]);
  const odd = info.ids.filter(i => !allowed.has(i));
  if (odd.length) problems.push(`unexpected blocks ${odd}`);
  // 5. the games' places: every flower's pad, every home flower, every ring with room to stand; the pups' loops free of bumps
  for (const f of [...FLOWERS, ...HOME_FLOWERS]) {
    const up = [0, 0, 0]; up[f.axis ?? 1] = f.sign ?? 1;
    const air = [1, 2].every(k => !isSolid(w.get(f.cell[0] + up[0] * k, f.cell[1] + up[1] * k, f.cell[2] + up[2] * k)));
    if (!isSolid(w.get(...f.cell)) || !air) problems.push(`a flower at ${f.cell} has no room`);
  }
  // the lenses lie on clear tops (the middle of each Lens Rock)
  for (const L of LENSES) if (isSolid(w.get(Math.floor(L.at[0]), L.at[1], Math.floor(L.at[2]))) || !isSolid(w.get(Math.floor(L.at[0]), L.at[1] - 1, Math.floor(L.at[2])))) problems.push(`the lens at ${L.at} has no clear top`);
  for (const q of PUPS) for (let i = 0; i < q.loop.length; i++) {
    const a = q.loop[i], b = q.loop[(i + 1) % q.loop.length];
    for (let k = 0.05; k < 1; k += 0.05) {
      const p = a.map((v, j) => v + (b[j] - v) * k), Pl = BOXES[q.planet], c = [(Pl.x0 + Pl.x1) / 2, (Pl.y0 + Pl.y1) / 2, (Pl.z0 + Pl.z1) / 2];
      const out = p.map((v, j) => v + Math.sign(v - c[j]) * (Math.abs(v - c[j]) > (Pl[['x1', 'y1', 'z1'][j]] - Pl[['x0', 'y0', 'z0'][j]]) / 2 - 1e-6 ? 0.5 : 0));
      if (isSolid(w.get(...out.map(Math.floor)))) { problems.push(`a bump on ${PLANETS[q.planet].id}'s Orbikit loop at ${out.map(v => v.toFixed(1))}`); break; }
    }
  }
  // the moon flies round its orbit without touching anything (its box: half across, `thick` under its top)
  for (let ph = 0; ph < 1; ph += 1 / 400) {
    const m = ferryAt(MOON, ph);
    let hit = false;
    for (const dx of [-MOON.half, 0, MOON.half]) for (const dz of [-MOON.half, 0, MOON.half]) for (const dy of [0.05, MOON.thick / 2, MOON.thick - 0.05]) if (isSolid(w.get(Math.floor(m.pos[0] + dx * 0.98), Math.floor(m.pos[1] - dy), Math.floor(m.pos[2] + dz * 0.98)))) hit = true;
    if (hit) { problems.push(`the moon hits a block at ${m.pos.map(v => v.toFixed(1))}`); break; }
  }
  // 6. keeps: the whole sky (no building, no riding), the doors; rests on the planets
  if (!w.keeps.some(k => k.name === 'space' && k.rideText) || !w.keeps.some(k => k.name === 'door-gravity')) problems.push('the keeps');
  if (w.rests.length < 8 || w.doors.length !== 2 || w.doors.some(d => d.key !== 'gravity')) problems.push('rests / doors');
  if (!w.bosses?.[0] || w.bosses[0].crew.length !== 3) problems.push('the Boss and the crew');
  if (w.nooks.length < 20) problems.push(`only ${w.nooks.length} nooks`);
  info.keeps = w.keeps.length; info.door = DOOR; info.nooks = w.nooks.length;
  return { problems, info, world: w };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('cubecheck.mjs')) {
  const r = analyze(Number(process.argv[2] ?? 1));
  console.log(JSON.stringify(r.info, null, 1));
  console.log(r.problems.length ? r.problems.join('\n') : 'all good');
}
