// Cube Planets (plans/cube-planets.md; realm `gravity`, the Swirl's old `secret5` frame). Terrain as data, Node-runnable (needs only a world
// with W / D / data / ground / index / inBounds / get, like castleland.js): little planets that are boxes of blocks floating in a dark-blue
// sky, each with a skin on all six faces (every face is a little world) and its edges in Planet Rock so you can see an edge coming.
// Gravity: gravity.js (downAt), read through world.gravityAt (player.js's frame branch).
//
// The planets are spread out flat (the world is 48 blocks tall, plan section 2):
//  - the Meadow Cube in the middle (you arrive on top, the way back stands there),
//  - east: the Orbikit Chase on three planets (the Crystal Cube, the Tree Cube, the Long Rock), Stargazer Stella on the last,
//  - west: the Moon Base, a wide flat planet a little moon circles over (the Moon Ride, three landing rings), Moon Mechanic Milo,
//  - north: the Planet Hop, a chain of small light planets you fly between from launch flowers, Captain Comet on the last,
//  - far north: the Great Cube (21 across), Professor Orbit on top (a second way back there).
// Between hub planets the ways are plain jumps face to face across a gap of 4 (HOPS). The games' rules are pure: orbits.js; cubelive.js
// wires them. Saved keys (in `beaten`): pw:gravity:tag1..3, pw:gravity:hop, pw:gravity:ring1..3 (gravityState).
import { B, WOOL, mulberry32 } from './blocks.js';
import { kit, buildWayBack, placeBoss, placeCrew } from './picturelands.js';
import { downAt, toLocal, upOf } from './gravity.js';

export const SIZE = 224;
// x, y, z = the lowest corner cell, n (a cube) or s = [nx, ny, nz] cells; g = its pull (x the main world's 28); reach = how far its field goes.
// role: hub / pup (the chase, `pup` = which round) / base (the Moon Ride) / hop (the Planet Hop, `hop` = its place in the chain) / great.
export const PLANETS = [
  { id: 'meadow', name: 'Meadow Cube', emoji: '🌼', x: 98, y: 14, z: 140, n: 13, g: 0.7, reach: 8, skin: 'meadow', role: 'hub' },
  { id: 'crystal', name: 'Crystal Cube', emoji: '💎', x: 115, y: 16, z: 142, n: 9, g: 0.7, reach: 8, skin: 'crystal', role: 'pup', pup: 0 },
  { id: 'tree', name: 'Tree Cube', emoji: '🌳', x: 113, y: 14, z: 155, n: 13, g: 0.7, reach: 8, skin: 'meadow', role: 'pup', pup: 1, trees: true },
  { id: 'long', name: 'Long Rock', emoji: '🪨', x: 130, y: 17, z: 158, s: [21, 7, 7], g: 0.7, reach: 8, skin: 'moon', role: 'pup', pup: 2 },
  { id: 'base', name: 'Moon Base', emoji: '🌙', x: 71, y: 14, z: 134, s: [23, 5, 23], g: 0.6, reach: 8, skin: 'moon', role: 'base' },
  { id: 'hop0', name: 'Flower Cube', emoji: '🌸', x: 100, y: 16, z: 127, n: 9, g: 0.45, reach: 8, skin: 'meadow', role: 'hop', hop: 0 },
  { id: 'hop1', name: 'Pebble', emoji: '🔵', x: 101, y: 21, z: 112, n: 7, g: 0.45, reach: 8, skin: 'crystal', role: 'hop', hop: 1 },
  { id: 'hop2', name: 'Far Pebble', emoji: '🟣', x: 84, y: 21, z: 114, n: 7, g: 0.45, reach: 8, skin: 'crystal', role: 'hop', hop: 2 },
  { id: 'hop3', name: 'Sky Pebble', emoji: '🟡', x: 85, y: 33, z: 108, n: 5, g: 0.45, reach: 8, skin: 'crystal', role: 'hop', hop: 3 },
  { id: 'hop4', name: 'Last Pebble', emoji: '🟢', x: 84, y: 18, z: 89, n: 7, g: 0.45, reach: 8, skin: 'meadow', role: 'hop', hop: 4 },
  { id: 'great', name: 'Great Cube', emoji: '🪐', x: 78, y: 8, z: 64, n: 21, g: 0.7, reach: 8, skin: 'great', role: 'great' },
];
export const P = Object.fromEntries(PLANETS.map((p, i) => [p.id, i]));
export const sizeOf = Pl => Pl.s ?? [Pl.n, Pl.n, Pl.n];
// The plain jumps between planets (each way): from planet `from`'s face [axis, sign] to planet `to`, across a gap of 4.
const pair = (a, b, axis, sign) => [{ from: P[a], to: P[b], axis, sign }, { from: P[b], to: P[a], axis, sign: -sign }];
export const HOPS = [
  ...pair('meadow', 'crystal', 0, 1), ...pair('crystal', 'tree', 2, 1), ...pair('tree', 'long', 0, 1),
  ...pair('meadow', 'base', 0, -1), ...pair('meadow', 'hop0', 2, -1), ...pair('hop4', 'great', 2, -1),
];
export const DOOR = { x: 104, z: 143, facing: [0, 1] }; // the way back on top of the Meadow Cube (you arrive 3 in front of it, looking south)
export const DOOR2 = { x: 95, z: 77, facing: [-1, 0] }; // a second way back on top of the Great Cube (beside Professor Orbit)
// The solid box of a planet in world units (x1 = its last block + 1), as gravity.js wants it.
export const boxOf = Pl => { const [nx, ny, nz] = sizeOf(Pl); return { id: Pl.id, x0: Pl.x, y0: Pl.y, z0: Pl.z, x1: Pl.x + nx, y1: Pl.y + ny, z1: Pl.z + nz, reach: Pl.reach, g: Pl.g }; };
export const BOXES = PLANETS.map(boxOf);
const LO = ['x0', 'y0', 'z0'], HI = ['x1', 'y1', 'z1'];
// The middle of a face (on the surface): [x, y, z].
export function faceCentre(i, axis, sign) {
  const b = BOXES[i], c = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
  c[axis] = sign > 0 ? b[HI[axis]] : b[LO[axis]];
  return c;
}
// The middle of the part of a hop's face that looks at the other planet (where to jump from): [x, y, z] on the surface.
export function hopSpot(h) {
  const c = faceCentre(h.from, h.axis, h.sign), a = BOXES[h.from], b = BOXES[h.to];
  for (const k of [0, 1, 2]) if (k !== h.axis) c[k] = (Math.max(a[LO[k]], b[LO[k]]) + Math.min(a[HI[k]], b[HI[k]])) / 2;
  return c;
}

/* ---------------------------------------------------------------- the saved keys */
export const tagKey = n => `pw:gravity:tag${n}`;
export const HOP_KEY = 'pw:gravity:hop';
export const ringKey = n => `pw:gravity:ring${n}`;
export const GRAVITY_KEYS = [tagKey(1), tagKey(2), tagKey(3), HOP_KEY, ringKey(1), ringKey(2), ringKey(3)];
// -> { tags, hop, rings, n, need, done, star }: own keys (the three tags may come in any order; the rings come in order).
export function gravityState(game) {
  const has = k => !!game?.beaten?.includes(k);
  const tag = [1, 2, 3].map(n => has(tagKey(n)));
  let rings = 0;
  while (rings < 3 && has(ringKey(rings + 1))) rings++;
  const tags = tag.filter(Boolean).length, hop = has(HOP_KEY), n = tags + (hop ? 1 : 0) + rings;
  return { tag, tags, hop, rings, n, need: 7, done: n === 7, star: !!game?.stars?.includes('gravity') };
}

/* ---------------------------------------------------------------- the games' places */
// The Orbikit Chase: the loop each pup runs (corner points on the surface; each two in a row lie on one face). A belt round a pole axis at
// a lane (the cells' middle on that axis), or the hexagon round a cube (a slanted ring through all six faces).
function belt(Pl, pole, lane, reverse = false) {
  const b = boxOf(Pl), [a, c] = [0, 1, 2].filter(k => k !== pole), pt = (va, vc) => { const p = [0, 0, 0]; p[pole] = lane; p[a] = va; p[c] = vc; return p; };
  const r = [pt(b[LO[a]], b[HI[c]]), pt(b[HI[a]], b[HI[c]]), pt(b[HI[a]], b[LO[c]]), pt(b[LO[a]], b[LO[c]])];
  return reverse ? r.reverse() : r;
}
function hexagon(Pl) {
  const b = boxOf(Pl), n = b.x1 - b.x0, h = n / 2, at = (u, v, w) => [b.x0 + u, b.y0 + v, b.z0 + w];
  return [at(n, h, 0), at(h, n, 0), at(0, n, h), at(0, h, n), at(h, 0, n), at(n, 0, h)]; // the plane x + y + z = 1.5 n cuts six edges in their middles
}
export const PUPS = [
  { planet: P.crystal, loop: belt(PLANETS[P.crystal], 2, 142 + 4.5), base: 4.6, boost: 7.0 },
  { planet: P.tree, loop: hexagon(PLANETS[P.tree]), base: 4.6, boost: 7.0 },
  { planet: P.long, loop: belt(PLANETS[P.long], 2, 158 + 3.5, true), base: 5.0, boost: 7.2 },
];
// The Planet Hop: one launch flower on each of hop0..hop3 (the cell of the pad in its skin, on the face [axis, sign]); Jump on it and it
// pushes you `push` along that face's up (player.js launchAt). `to` = the planet it is meant to reach. `solution` = how a good player
// does it (the tests' skilled robot): run-up mode (still / walk / sprint) and the way to run (world yaw, radians).
export const FLOWERS = [
  { planet: P.hop0, axis: 1, sign: 1, cell: [104, 24, 128], push: 12, to: P.hop1, solution: { mode: 'walk', dir: [0, -1] } },
  { planet: P.hop1, axis: 1, sign: 1, cell: [101, 27, 115], push: 12, to: P.hop2, solution: { mode: 'walk', dir: [-1, 0] } },
  { planet: P.hop2, axis: 1, sign: 1, cell: [87, 27, 114], push: 12, to: P.hop3, land: null, solution: { mode: 'still', dir: [0, -1] } },
  { planet: P.hop3, axis: 1, sign: -1, cell: [87, 33, 108], push: 12, to: P.hop4, solution: { mode: 'sprint', dir: [0, -1] } },
]
// Home flowers (blue): stand on one and you are puffed home to the Meadow Cube (cubelive.js). One on each pebble and on the Great Cube.
export const HOME_FLOWERS = [
  { planet: P.hop1, cell: [106, 27, 117] }, { planet: P.hop2, cell: [89, 27, 119] }, { planet: P.hop3, cell: [87, 37, 111] },
  { planet: P.hop4, cell: [85, 24, 94] }, { planet: P.great, cell: [82, 28, 81] },
];
// The Moon Ride: a little moon circles over the Moon Base on an ellipse (orbits.js moonAt); it stops for `stop` s at its slow end beside
// the base's east edge, low enough to hop on. Rings on the base's top (landing rings: land inside after a jump off the moon).
export const MOON = { base: P.base, cx: 82.5, cz: 145.5, rx: 8, rz: 5.5, phase0: 0, period: 16, e: 0.55, low: 2.6, high: 5, stop: 2.5, half: 1.25 };
export const RINGS = [ // (where a jump off the moon lands: from its slow part, its fast part, and its turn at the far end; orbits.js moonAt)
  { x: 86.0, z: 151.0, r: 1.6 },
  { x: 85.0, z: 139.0, r: 1.6 },
  { x: 74.5, z: 139.0, r: 1.6 },
]

/* ---------------------------------------------------------------- building */
const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
const SKINS = {
  meadow: { face: B.STAR_GRASS, edge: B.PLANET_ROCK },
  crystal: { face: B.ICE, edge: B.PLANET_ROCK },
  moon: { face: B.PLANET_ROCK, edge: B.COBBLE },
  great: { face: B.STAR_GRASS, edge: WOOL.gravity },
};
// Face cells: for a face [axis, sign], the in-face coordinates (u, v) along the other two axes (in order), 0..size-1; cell(u, v, out) = the
// world cell `out` blocks outside the surface (out 0 = the skin block itself, 1 = the first cell of air above it).
const others = axis => [0, 1, 2].filter(a => a !== axis);
export function faceCell(Pl, axis, sign, u, v, out = 0) {
  const c = [Pl.x, Pl.y, Pl.z], s = sizeOf(Pl), [a, b] = others(axis), w = [0, 0, 0];
  w[axis] = sign > 0 ? c[axis] + s[axis] - 1 + out : c[axis] - out;
  w[a] = c[a] + u; w[b] = c[b] + v;
  return w;
}
export const faceSize = (Pl, axis) => { const s = sizeOf(Pl), [a, b] = others(axis); return [s[a], s[b]]; };
export const FACES = [[1, 1], [1, -1], [0, 1], [0, -1], [2, 1], [2, -1]];
// Distance (in a face's u, v) from cell (u, v) to the pup's loop on that face (Infinity when the loop never crosses it).
function loopDist(Pl, axis, sign, u, v, loop) {
  if (!loop) return Infinity;
  const b = boxOf(Pl), plane = sign > 0 ? b[HI[axis]] : b[LO[axis]], [a, c] = others(axis), base = [Pl.x, Pl.y, Pl.z];
  let best = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length];
    if (Math.abs(p[axis] - plane) > 1e-9 || Math.abs(q[axis] - plane) > 1e-9) continue;
    const px = p[a] - base[a], py = p[c] - base[c], qx = q[a] - base[a], qy = q[c] - base[c], x = u + 0.5, y = v + 0.5;
    const dx = qx - px, dy = qy - py, L = dx * dx + dy * dy, k = L ? Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(x - px - k * dx, y - py - k * dy));
  }
  return best;
}

export function cubeLand(world, def) {
  kit(world);
  const { W, D } = world, rand = mulberry32((world.seed ^ 0xc0be) >>> 0);
  world.planets = BOXES.map(b => ({ ...b })); // (a copy: the live part may grow a planet's catch zone a little, the kind help)
  world.gravityAt = (p, prev, centre) => downAt(world.planets, p, prev, centre); // player.js: a world with gravityAt moves the player in a frame
  world.underground = () => false; // space is never a cave (under a planet is not dark)
  world.cubes = { planets: PLANETS, hops: HOPS, bumps: [], flowers: FLOWERS, homes: HOME_FLOWERS, pups: PUPS, moon: MOON, rings: RINGS };
  // 1. the planets: Planet Rock inside, the skin on every face, the edges and corners in the edge block
  for (const Pl of PLANETS) {
    const S = SKINS[Pl.skin], [nx, ny, nz] = sizeOf(Pl);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
      const onB = (i === 0 || i === nx - 1) + (j === 0 || j === ny - 1) + (k === 0 || k === nz - 1);
      put(world, Pl.x + i, Pl.y + j, Pl.z + k, onB >= 2 ? S.edge : onB === 1 ? S.face : B.PLANET_ROCK);
    }
  }
  // 2. the launch flowers' pads (gravity wool) and the home flowers' pads (crystal)
  const pads = new Map();
  for (const f of FLOWERS) { put(world, ...f.cell, WOOL.gravity); pads.set(f.cell.join(), f); }
  for (const h of HOME_FLOWERS) put(world, ...h.cell, B.CRYSTAL);
  // Jump on a launch flower: its push (only standing on its own face). Read by player.js's frame branch.
  world.launchAt = (pos, frame) => {
    const u = upOf(frame), f = pads.get([Math.floor(pos.x - u[0] * 0.05), Math.floor(pos.y - u[1] * 0.05), Math.floor(pos.z - u[2] * 0.05)].join());
    return f && u[f.axis] === f.sign ? f.push * (world.pushK ?? 1) : 0;
  };
  world.homeAt = (pos, frame) => {
    const u = upOf(frame), c = [Math.floor(pos.x - u[0] * 0.05), Math.floor(pos.y - u[1] * 0.05), Math.floor(pos.z - u[2] * 0.05)].join();
    return HOME_FLOWERS.find(h => h.cell.join() === c) ?? null;
  };
  // 3. the ways back (the Meadow Cube's top, the Great Cube's top), the Boss, the crew
  const M = PLANETS[P.meadow], G = PLANETS[P.great], top = Pl => Pl.y + sizeOf(Pl)[1] - 1;
  buildWayBack(world, 'gravity', { x: DOOR.x, y: top(M), z: DOOR.z, facing: DOOR.facing });
  const back2 = buildWayBack(world, 'gravity-great', { x: DOOR2.x, y: top(G), z: DOOR2.z, facing: DOOR2.facing });
  delete world.arrivals['gravity-great']; // (you never arrive there; it only takes you home)
  back2.key = 'gravity';
  placeBoss(world, 'gravity', { x: 88, y: top(G), z: 69, facing: [0, 1] });
  const crewAt = [[P.long, 140, 161, [0, 1]], [P.hop4, 88, 91, [0, 1]], [P.base, 92, 144, [-1, 0]]];
  crewAt.forEach(([pi, x, z, facing], i) => placeCrew(world, 'gravity', i, { x, y: top(PLANETS[pi]), z, facing }));
  const near = (w, pad) => world.keeps.some(k => k.protect.some(b => w[0] >= b.x0 - pad && w[0] <= b.x1 + pad && w[1] >= b.y0 - pad && w[1] <= b.y1 + pad && w[2] >= b.z0 - pad && w[2] <= b.z1 + pad));
  const people = [...(world.bosses || []).flatMap(b => [b.pos, ...b.crew.map(c => c.pos)])];
  const busy = w => people.some(p => Math.abs(p[0] - w[0] - 0.5) < 3 && Math.abs(p[2] - w[2] - 0.5) < 3 && Math.abs(p[1] - w[1]) < 3)
    || FLOWERS.some(f => Math.hypot(f.cell[0] - w[0], f.cell[1] - w[1] + 1, f.cell[2] - w[2]) < 3.5) || HOME_FLOWERS.some(f => Math.hypot(f.cell[0] - w[0], f.cell[1] - w[1] + 1, f.cell[2] - w[2]) < 2.5)
    || (Math.abs(w[1] - top(PLANETS[P.base]) - 1) < 2 && (RINGS.some(r => Math.hypot(r.x - w[0] - 0.5, r.z - w[2] - 0.5) < r.r + 2) || Math.hypot((w[0] + 0.5 - MOON.cx) / (MOON.rx + MOON.half + 1.5), (w[2] + 0.5 - MOON.cz) / (MOON.rz + MOON.half + 1.5)) < 1.25)); // (nothing under the moon's way)
  // 4. each face's little things, sticking out of it (from the realm's seed): never near an edge, never near each other, never at a door,
  // a person, a flower, a ring or on a pup's loop. The Tree Cube has a tree on every face (the Orbikit hides behind them).
  for (const [pi, Pl] of PLANETS.entries()) for (const [axis, sign] of FACES) {
    const [nu, nv] = faceSize(Pl, axis), loop = PUPS.find(q => q.planet === pi)?.loop, hopFace = HOPS.filter(h => h.from === pi && h.axis === axis && h.sign === sign);
    const taken = axis === 1 && sign === 1 ? [[Math.floor(nu / 2), Math.floor(nv / 2), 1]] : []; // the middle of a top face stays free (its rest spot)
    const room = (u, v, r) => taken.every(([tu, tv, tr]) => Math.max(Math.abs(tu - u), Math.abs(tv - v)) > r + tr + 1);
    const spot = (r, edge) => {
      if (nu < 2 * edge + 1 || nv < 2 * edge + 1) return null;
      for (let tries = 0; tries < 40; tries++) {
        const u = edge + Math.floor(rand() * (nu - 2 * edge)), v = edge + Math.floor(rand() * (nv - 2 * edge)), w = faceCell(Pl, axis, sign, u, v, 1);
        if (!room(u, v, r) || near(w, 3) || busy(w) || loopDist(Pl, axis, sign, u, v, loop) < r + 1.8) continue;
        if (hopFace.some(h => r >= 1 || Math.hypot(...[0, 1, 2].map(k => (k === axis ? 0 : w[k] + 0.5 - hopSpot(h)[k]))) < 4.5)) continue; // (nothing in the way of a plain jump between planets)
        taken.push([u, v, r]); return [u, v];
      }
      return null;
    };
    const cell = (u, v, out, id) => { const w = faceCell(Pl, axis, sign, u, v, out); put(world, w[0], w[1], w[2], id); };
    const bump = (u, v, kind) => world.cubes.bumps.push({ planet: pi, axis, sign, u, v, kind });
    const flat = (n, id) => { for (let k = 0; k < n; k++) { const s = spot(1, 2); if (s) for (let du = -1; du <= 1; du++) for (let dv = -1; dv <= 1; dv++) if (Math.abs(du) + Math.abs(dv) < 2) cell(s[0] + du, s[1] + dv, 0, id); } };
    const one = (n, id, kind) => { for (let k = 0; k < n; k++) { const s = spot(0, 2); if (s) { cell(s[0], s[1], 1, id); bump(s[0], s[1], kind); } } };
    const trees = n => {
      for (let k = 0; k < n; k++) { // little trees: a 2-high trunk, a leafy top; the leaves start 2 above the face (you walk under them)
        const s = spot(1, 3);
        if (!s) continue;
        cell(s[0], s[1], 1, B.LOG); cell(s[0], s[1], 2, B.LOG); cell(s[0], s[1], 3, B.LEAVES); cell(s[0], s[1], 4, B.LEAVES);
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cell(s[0] + du, s[1] + dv, 3, B.LEAVES);
        bump(s[0], s[1], 'tree');
      }
    };
    if (Pl.role === 'hop') { if (Pl.hop === 0 || (axis !== 1 || sign !== 1)) one(1, B.FLOWER_BUSH, 'flower'); continue; } // small planets: a flower here and there
    if (Pl.trees) { trees(2); one(1, B.FLOWER_BUSH, 'flower'); continue; }
    if (Pl.skin === 'meadow' || Pl.skin === 'great') { trees(Pl.role === 'great' ? 3 : 2); one(4, B.FLOWER_BUSH, 'flower'); one(1, B.PLANET_ROCK, 'rock'); }
    else if (Pl.skin === 'crystal') { one(2, B.CRYSTAL, 'crystal'); flat(1, B.STAR_GRASS); }
    else if (Pl.role === 'base' && axis === 1 && sign === 1) { flat(4, B.GRAVEL); one(3, B.GLOWCAP, 'glowcap'); } // the Moon Base's top: craters, glowcaps (never on a ring)
    else { flat(2, B.GRAVEL); one(2, B.PLANET_ROCK, 'rock'); one(1, B.GLOWCAP, 'glowcap'); }
  }
  // 5. rests on top of every planet (a lost battle), nooks (the wild Gravity creatures circle on top faces), the ground of every column
  const nooks = [];
  for (const [pi, Pl] of PLANETS.entries()) {
    const [nx, , nz] = sizeOf(Pl), t = top(Pl) + 1;
    if (Pl.role !== 'hop' || Pl.hop === 0) world.rests.push([Pl.x + Math.floor(nx / 2) + 0.5, t, Pl.z + Math.floor(nz / 2) + 0.5, 0]);
    if (!['hub', 'base', 'great', 'pup'].includes(Pl.role) || pi === P.long) continue;
    for (let i = 3; i < nx - 3; i += 3) for (let k = 3; k < nz - 3; k += 3) {
      const w = [Pl.x + i, t, Pl.z + k];
      if (world.get(...w) !== B.AIR || world.get(w[0], t + 1, w[2]) !== B.AIR || near(w, 2) || busy(w)) continue;
      if (Pl.role === 'pup' && loopDist(Pl, 1, 1, i, k, PUPS.find(q => q.planet === pi).loop) < 3) continue;
      if (Pl.role === 'base' && Math.hypot((w[0] + 0.5 - MOON.cx) / (MOON.rx + 2), (w[2] + 0.5 - MOON.cz) / (MOON.rz + 2)) < 1) continue; // (not under the moon)
      nooks.push({ kind: 'orbit', x: w[0], y: t, z: w[2], planet: pi });
    }
  }
  world.nooks = nooks;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    let g = 0;
    for (let y = 47; y > 0; y--) if (world.get(x, y, z) !== B.AIR) { g = y; break; }
    world.ground[x + z * W] = g;
  }
  // 6. no building and no riding anywhere here (plan 3.5): one keep round the whole sky
  world.keeps.push({ name: 'space', protect: [{ x0: 0, x1: W - 1, y0: 0, y1: 47, z0: 0, z1: D - 1 }],
    wallText: 'The little planets are too small to dig! Walk round them and hop.', rideText: 'No riding on the little planets! Walk and jump instead.' });
  world.parts.push({ id: 'gravity', live: 'gravity' });
  world.realmBiome = () => 'gravity';
  return world;
}

// Which planet a point belongs to (its field, or the nearest).
export const planetAt = (world, p, prev = null) => downAt(world.planets ?? BOXES, p, prev);

/* ---------------------------------------------------------------- the guide */
// The arrow is worked out in your own frame (the face you stand on), so "ahead" is ahead on that face: x / z of the answer = your position +
// the target's offset across the face. Order: the Orbikit Chase, the Planet Hop, the Moon Ride, the crew, Professor Orbit, the way back.
// Over another planet the arrow leads to the hop side that faces the next planet on the way (ROUTE).
const ROUTE = { // next planet on the way from `from` to `to`'s branch: the hub is the Meadow Cube
  [P.crystal]: { home: P.meadow, out: P.tree }, [P.tree]: { home: P.crystal, out: P.long }, [P.long]: { home: P.tree },
  [P.base]: { home: P.meadow }, [P.hop0]: { home: P.meadow }, [P.great]: { home: P.hop4 },
};
const BRANCH = { [P.crystal]: 'pup', [P.tree]: 'pup', [P.long]: 'pup', [P.base]: 'base', [P.hop0]: 'hop', [P.hop1]: 'hop', [P.hop2]: 'hop', [P.hop3]: 'hop', [P.hop4]: 'hop', [P.great]: 'great' };
// The planet you should walk to next to reach planet `goal` from planet `on` (connectors only), or null when there is no plain way.
export function nextPlanet(on, goal) {
  if (on === goal) return on;
  const seen = new Map([[on, null]]), q = [on];
  while (q.length) {
    const c = q.shift();
    for (const h of HOPS) if (h.from === c && !seen.has(h.to)) { seen.set(h.to, c); if (h.to === goal) { let s = goal; while (seen.get(s) !== on) s = seen.get(s); return s; } q.push(h.to); }
  }
  return null;
}
export function cubeAim(world, p, game) {
  if (!world.planets) return null;
  const pl = game?.player, fi = pl?.frameNo?.() ?? 0, live = game?.gymLive?.of?.('part:gravity');
  const gd = pl?.grav ?? downAt(world.planets, p, null);
  const pos3 = [p.x, p.y, p.z];
  const at = (w, text) => { const l = toLocal(fi, [w[0] - pos3[0], w[1] - pos3[1], w[2] - pos3[2]]); return { x: p.x + l[0], z: p.z + l[2], text }; };
  const centre = i => { const b = world.planets[i]; return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2]; };
  if (gd.soft) return at(centre(gd.planet), () => '🌌 Floating in space... the planet pulls you back!');
  const mine = live?.aim?.(p, at); // a game in progress says what to do (Tag the Orbikit, the next flower, the moon)
  if (mine) return mine;
  const st = gravityState(game), on = gd.planet, star = st.star;
  // where to go: the next unfinished game, then the crew, then the Professor; with the star, home
  const crewLeftList = (game?.bosses ? (world.bosses?.[0]?.crew || []).filter(c => !game.beaten?.includes(`pw:gravity:crew${c.i + 1}`)) : []);
  let goal = null, words = null;
  if (!star && st.tags < 3) { goal = PUPS.find((q, i) => !st.tag[i])?.planet ?? P.crystal; words = '🐱 Orbikit Chase'; }
  else if (!star && !st.hop) { goal = P.hop0; words = '🌸 Planet Hop'; }
  else if (!star && st.rings < 3) { goal = P.base; words = '🌙 Moon Ride'; }
  else if (!star && crewLeftList.length) { const c = crewLeftList[0], planetOf = [P.long, P.hop4, P.base][c.i]; if (on === planetOf) return at(c.pos, (a, m) => `⚔️ Battle ${['Stargazer Stella', 'Captain Comet', 'Moon Mechanic Milo'][c.i]} ${a} ${m}m`); goal = planetOf; words = '⚔️ A helper wants a battle'; }
  else if (!star) { if (on === P.great) { const b = world.bosses?.[0]; if (b && (gd.axis !== 1 || gd.sign !== 1)) return at(b.pos, (a, m) => `🪐 Walk round the edge to the top: Professor Orbit ${a} ${m}m`); if (b) return at(b.pos, (a, m) => `⭐ Professor Orbit ${a} ${m}m`); } goal = P.great; words = '⭐ Professor Orbit on the Great Cube'; }
  else {
    const d = world.doors?.find(x => world.planets.findIndex(b => x.surface[0][0] >= b.x0 - 1 && x.surface[0][0] <= b.x1 && x.surface[0][2] >= b.z0 - 1 && x.surface[0][2] <= b.z1) === on) ?? world.doors?.[0];
    if (d && (on === P.meadow || on === P.great)) {
      const s = d.surface[Math.floor(d.surface.length / 2)], w = [s[0] + 0.5, s[1], s[2] + 0.5];
      if (gd.axis !== 1 || gd.sign !== 1) return at(w, (a, m) => `🖼️ Over the edge to the top: the way back ${a} ${m}m`);
      if (Math.hypot(w[0] - p.x, w[2] - p.z) < 3) return { x: w[0], z: w[2], text: () => 'Way back: step in to go to the Swirl' };
      return at(w, (a, m) => `🖼️ Way back ${a} ${m}m`);
    }
    goal = P.meadow; words = '🖼️ Back to the Meadow Cube: the way back is there';
  }
  if (on === goal || (BRANCH[on] === 'hop' && BRANCH[goal] === 'hop' && on !== P.hop0)) return { text: () => `${words} is here!` }; // there (the live part's words come first when a game is going on)
  // the Planet Hop's pebbles have no plain way out: a home flower
  if (BRANCH[on] === 'hop' && on !== P.hop0) { const h = HOME_FLOWERS.find(f => f.planet === on); if (h) return at([h.cell[0] + 0.5, h.cell[1] + 1, h.cell[2] + 0.5], (a, m) => `💠 The blue flower takes you home ${a} ${m}m`); }
  if (on === P.great && goal !== P.great) { const h = HOME_FLOWERS.find(f => f.planet === on); if (h) return at([h.cell[0] + 0.5, h.cell[1] + 1, h.cell[2] + 0.5], (a, m) => `💠 The blue flower takes you home ${a} ${m}m`); }
  const target = goal === P.great && on !== P.hop4 ? P.hop0 : goal, next = nextPlanet(on, target === P.great && on === P.hop4 ? P.great : target);
  if (next == null || next === on) return null;
  return hopAim(world, p, gd, on, next, at, words);
}
function hopAim(world, p, gd, on, next, at, words) {
  const hop = HOPS.find(h => h.from === on && h.to === next), N = PLANETS[next];
  if (!hop) return null;
  if (gd.axis === hop.axis && gd.sign === hop.sign) {
    const b = world.planets[next];
    return at([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2], () => `${N.emoji} Jump! The ${N.name} pulls you in. (${words})`);
  }
  return at(hopSpot(hop), (a, m) => `${N.emoji} Walk over the edge to the side that faces the ${N.name} ${a} ${m}m`);
}
