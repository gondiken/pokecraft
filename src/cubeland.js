// Cube Planets (plans/cube-planets.md, "Redesign 2026-10-29"; realm `gravity`, the Swirl's old `secret5` frame). Terrain as data,
// Node-runnable (needs only a world with W / D / data / ground / index / inBounds / get, like castleland.js): little planets that are
// boxes of blocks floating in a dark-blue sky, each with a skin on all six faces (every face is a little world) and its edges in Planet
// Rock so you can see an edge coming. Gravity: gravity.js (downAt), read through world.gravityAt (player.js's frame branch).
//
// The story (owner 2026-10-29: "better lore", shown by the scene and the helpers' words, never by rule text): this is Professor Orbit's
// little-planet observatory. His pet Orbikits got loose, spring flowers grow on his pebbles, and his telescope's three lenses fell onto
// far little rocks that only the moon ferry passes.
//  - the Meadow Cube in the middle (you arrive on top, the way back stands there),
//  - east: the Orbikit Chase on three planets (the Crystal Cube, the Tree Cube, the Long Rock), Stargazer Stella on the last,
//  - west: the Moon Dock, a wide flat planet a little moon circles over on a real orbit round a little sun (orbits.js ferryAt); three
//    Lens Rocks out in space south of it, too far to jump to (the Moon Ferry), Moon Mechanic Milo on the dock,
//  - north: the Planet Hop, a chain of small pebbles you fly between on spring flowers, Captain Comet on the last,
//  - far north: the Great Cube (21 across), Professor Orbit on top (a second way back there).
// Every planet pulls the same (GRAV.g; owner 2026-10-29: before it was 0.7 on the hub planets, 0.6 on the Moon Base and 0.45 on the
// pebbles, with no reason you could see). Between hub planets the ways are plain jumps face to face across a gap of 6 (HOPS). The games'
// rules are pure: orbits.js; cubelive.js wires them. Saved keys (in `beaten`): pw:gravity:tag1..3, pw:gravity:hop, pw:gravity:lens1..3
// (gravityState), and the redesign's mark pw:gravity:redesign1 (cubeReset).
import { B, WOOL, mulberry32 } from './blocks.js';
import { kit, buildWayBack, placeBoss, placeCrew } from './picturelands.js';
import { downAt, toLocal, upOf, GRAV } from './gravity.js';
import { sunOf } from './orbits.js';

export const SIZE = 224;
// x, y, z = the lowest corner cell, n (a cube) or s = [nx, ny, nz] cells; reach = how far its field goes (its pull is GRAV.g everywhere).
// role: hub / pup (the chase, `pup` = which round) / dock (the Moon Ferry) / lens (a Lens Rock, `lens` = which) / hop (the Planet Hop,
// `hop` = its place in the chain) / great.
const G = GRAV.g;
export const PLANETS = [
  { id: 'meadow', name: 'Meadow Cube', emoji: '🌼', x: 98, y: 14, z: 140, n: 13, g: G, reach: 8, skin: 'meadow', role: 'hub' },
  { id: 'crystal', name: 'Crystal Cube', emoji: '💎', x: 117, y: 16, z: 142, n: 9, g: G, reach: 8, skin: 'crystal', role: 'pup', pup: 0 },
  { id: 'tree', name: 'Tree Cube', emoji: '🌳', x: 115, y: 14, z: 157, n: 13, g: G, reach: 8, skin: 'meadow', role: 'pup', pup: 1, trees: true },
  { id: 'long', name: 'Long Rock', emoji: '🪨', x: 134, y: 17, z: 160, s: [21, 7, 7], g: G, reach: 8, skin: 'moon', role: 'pup', pup: 2 },
  { id: 'base', name: 'Moon Dock', emoji: '🌙', x: 59, y: 14, z: 135, s: [33, 5, 21], g: G, reach: 8, skin: 'moon', role: 'dock' },
  { id: 'hop0', name: 'Flower Cube', emoji: '🌸', x: 100, y: 16, z: 125, n: 9, g: G, reach: 8, skin: 'meadow', role: 'hop', hop: 0 },
  { id: 'hop1', name: 'Pebble', emoji: '🔵', x: 101, y: 21, z: 110, n: 7, g: G, reach: 8, skin: 'crystal', role: 'hop', hop: 1 },
  { id: 'hop2', name: 'Far Pebble', emoji: '🟣', x: 85, y: 20, z: 113, n: 7, g: G, reach: 8, skin: 'crystal', role: 'hop', hop: 2 },
  { id: 'hop3', name: 'Sky Pebble', emoji: '🟡', x: 86, y: 32, z: 107, n: 5, g: G, reach: 8, skin: 'crystal', role: 'hop', hop: 3 },
  { id: 'hop4', name: 'Last Pebble', emoji: '🟢', x: 85, y: 17, z: 88, n: 7, g: G, reach: 8, skin: 'meadow', role: 'hop', hop: 4 },
  { id: 'great', name: 'Great Cube', emoji: '🪐', x: 79, y: 7, z: 61, n: 21, g: G, reach: 8, skin: 'great', role: 'great' },
  { id: 'lens1', name: 'Lens Rock', emoji: '🔭', x: 76, y: 10, z: 174, n: 5, g: G, reach: 8, skin: 'crystal', role: 'lens', lens: 0 },
  { id: 'lens2', name: 'Lens Rock', emoji: '🔭', x: 60, y: 10, z: 172, n: 5, g: G, reach: 8, skin: 'crystal', role: 'lens', lens: 1 },
  { id: 'lens3', name: 'Lens Rock', emoji: '🔭', x: 36, y: 8, z: 150, n: 5, g: G, reach: 8, skin: 'crystal', role: 'lens', lens: 2 },
];
export const P = Object.fromEntries(PLANETS.map((p, i) => [p.id, i]));
export const sizeOf = Pl => Pl.s ?? [Pl.n, Pl.n, Pl.n];
// The plain jumps between planets (each way): from planet `from`'s face [axis, sign] to planet `to`, across a gap of 6.
const pair = (a, b, axis, sign) => [{ from: P[a], to: P[b], axis, sign }, { from: P[b], to: P[a], axis, sign: -sign }];
export const HOPS = [
  ...pair('meadow', 'crystal', 0, 1), ...pair('crystal', 'tree', 2, 1), ...pair('tree', 'long', 0, 1),
  ...pair('meadow', 'base', 0, -1), ...pair('meadow', 'hop0', 2, -1), ...pair('hop4', 'great', 2, -1),
];
export const DOOR = { x: 104, z: 143, facing: [0, 1] }; // the way back on top of the Meadow Cube (you arrive 3 in front of it, looking south)
export const DOOR2 = { x: 96, z: 74, facing: [-1, 0] }; // a second way back on top of the Great Cube (beside Professor Orbit)
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
export const lensKey = n => `pw:gravity:lens${n}`;
export const GRAVITY_KEYS = [tagKey(1), tagKey(2), tagKey(3), HOP_KEY, lensKey(1), lensKey(2), lensKey(3)];
// -> { tags, hop, lenses, n, need, done, star }: own keys (the tags and the lenses may come in any order).
export function gravityState(game) {
  const has = k => !!game?.beaten?.includes(k);
  const tag = [1, 2, 3].map(n => has(tagKey(n))), lens = [1, 2, 3].map(n => has(lensKey(n)));
  const tags = tag.filter(Boolean).length, lenses = lens.filter(Boolean).length, hop = has(HOP_KEY), n = tags + (hop ? 1 : 0) + lenses;
  return { tag, tags, hop, lens, lenses, n, need: 7, done: n === 7, star: !!game?.stars?.includes('gravity') };
}
// Owner 2026-10-29 "reset my progress in the gravity world": the redesign starts Cube Planets over ONCE. A save without the mark loses
// every pw:gravity:* key (games, crew), the gravity star and its Boss wins, then gets the mark; whatever is won after that is kept for
// ever. This is fine only because Cube Planets was preview-only (?preview) until now: no child's real progress is lost. Pure: changes
// `save` ({ beaten, stars, bossWins }) in place; -> true when something was reset. main.js runs it on load, cubelive.js when you arrive
// and whenever it saves a key (so a "Start this world over" that clears the mark never lets a later load wipe new progress).
export const REDESIGN_MARK = 'pw:gravity:redesign1';
export function cubeReset(save) {
  if (!save || !Array.isArray(save.beaten) || save.beaten.includes(REDESIGN_MARK)) return false;
  const old = save.beaten.filter(k => typeof k === 'string' && k.startsWith('pw:gravity:'));
  const star = Array.isArray(save.stars) && save.stars.includes('gravity'), wins = !!save.bossWins?.gravity;
  save.beaten = save.beaten.filter(k => !old.includes(k));
  save.beaten.push(REDESIGN_MARK);
  if (star) save.stars = save.stars.filter(s => s !== 'gravity');
  if (wins) delete save.bossWins.gravity;
  return old.length > 0 || star || wins;
}
// After the mark is gone (the generic "Start this world over" clears pw:gravity:*): put it back without resetting anything.
export function cubeMark(game) { if (Array.isArray(game?.beaten) && !game.beaten.includes(REDESIGN_MARK)) game.beaten.push(REDESIGN_MARK); }

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
// Each round's own numbers (owner 2026-10-29: "the first two were very easy and the last one was very hard"; now 1 easy, 2 medium,
// 3 harder but fair): base / boost = its trot and its sprint (blocks/s; you sprint at 6.2), see = how far it sees you on its own face,
// tagR = how close counts as a touch, flip = the last one is playful: it turns back by itself every so often (watch it, then hide).
export const PUPS = [
  { planet: P.crystal, loop: belt(PLANETS[P.crystal], 2, 142 + 4.5), base: 4.0, boost: 7.0, see: 5, tagR: 1.3 },
  { planet: P.tree, loop: hexagon(PLANETS[P.tree]), base: 4.4, boost: 7.0, see: 6, tagR: 1.35 },
  { planet: P.long, loop: belt(PLANETS[P.long], 2, 160 + 3.5, true), base: 4.6, boost: 7.1, see: 6, tagR: 1.15, flip: 7 },
];
// The Planet Hop: one spring flower on each of hop0..hop3 (the cell of the pad in its skin, on the face [axis, sign]); Jump on it and it
// flings you `push` along that face's up (player.js launchAt). `to` = the planet it is meant to reach. `solution` = how a good player
// does it (the tests' skilled robot): run-up mode (still / walk / sprint) and the way to run ([x, z] in the world).
export const SPRING = 12; // every spring flower pushes the same
export const FLOWERS = [
  { planet: P.hop0, axis: 1, sign: 1, cell: [104, 24, 126], push: SPRING, to: P.hop1, solution: { mode: 'walk', dir: [0, -1] } },
  { planet: P.hop1, axis: 1, sign: 1, cell: [101, 27, 113], push: SPRING, to: P.hop2, solution: { mode: 'walk', dir: [-1, 0] } },
  { planet: P.hop2, axis: 1, sign: 1, cell: [88, 26, 113], push: SPRING, to: P.hop3, solution: { mode: 'still', dir: [0, -1] } },
  { planet: P.hop3, axis: 1, sign: -1, cell: [88, 32, 107], push: SPRING, to: P.hop4, solution: { mode: 'sprint', dir: [0, -1] } },
];
// Home flowers (blue): stand on one and you are puffed home to the Meadow Cube (cubelive.js). On each pebble, each Lens Rock, the Great Cube.
export const HOME_FLOWERS = [
  { planet: P.hop1, cell: [106, 27, 115] }, { planet: P.hop2, cell: [90, 26, 118] }, { planet: P.hop3, cell: [88, 36, 110] },
  { planet: P.hop4, cell: [86, 23, 93] }, { planet: P.great, cell: [83, 27, 78] },
  { planet: P.lens1, cell: [77, 14, 175] }, { planet: P.lens2, cell: [61, 14, 173] }, { planet: P.lens3, cell: [37, 12, 151] },
];
// The Moon Ferry: a little moon goes round a little sun on a real orbit (orbits.js ferryAt) over the Moon Dock and out into space; slow at
// its far end (over the dock's east end, where you hop on), fast round the sun. It never stops. y = its top (where you stand), 1.6
// above the dock (a plain jump gets you on). sz -1: it runs round the south side, where the Lens Rocks float.
export const MOON = { dock: P.base, cx: 72, cz: 145.5, a: 18, e: 0.5, period: 24, y: 20.6, sx: 1, sz: -1, half: 1.25, thick: 1.2 };
export const SUN = sunOf(MOON);
// The lenses lie in the middle of each Lens Rock's top.
export const LENSES = PLANETS.map((Pl, i) => (Pl.role === 'lens' ? { planet: i, n: Pl.lens, at: [Pl.x + Pl.n / 2, Pl.y + Pl.n, Pl.z + Pl.n / 2] } : null)).filter(Boolean);

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

// How far a point (x, z) is from the moon's way (its ellipse), across: nothing stands under it.
const ORBIT = Array.from({ length: 360 }, (_, i) => { const E = i * Math.PI / 180, b = MOON.a * Math.sqrt(1 - MOON.e * MOON.e); return [MOON.cx - MOON.sx * MOON.a * Math.cos(E), MOON.cz + MOON.sz * b * Math.sin(E)]; });
export const orbitDist = (x, z) => Math.min(...ORBIT.map(([ox, oz]) => Math.hypot(ox - x, oz - z)));

export function cubeLand(world, def) {
  kit(world);
  const { W, D } = world, rand = mulberry32((world.seed ^ 0xc0be) >>> 0);
  world.planets = BOXES.map(b => ({ ...b })); // (a copy: the live part may grow a planet's catch zone a little, the kind help)
  world.gravityAt = (p, prev, centre) => downAt(world.planets, p, prev, centre); // player.js: a world with gravityAt moves the player in a frame
  world.underground = () => false; // space is never a cave (under a planet is not dark)
  world.cubes = { planets: PLANETS, hops: HOPS, bumps: [], flowers: FLOWERS, homes: HOME_FLOWERS, pups: PUPS, moon: MOON, sun: SUN, lenses: LENSES };
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
  const M = PLANETS[P.meadow], GC = PLANETS[P.great], top = Pl => Pl.y + sizeOf(Pl)[1] - 1;
  buildWayBack(world, 'gravity', { x: DOOR.x, y: top(M), z: DOOR.z, facing: DOOR.facing });
  const back2 = buildWayBack(world, 'gravity-great', { x: DOOR2.x, y: top(GC), z: DOOR2.z, facing: DOOR2.facing });
  delete world.arrivals['gravity-great']; // (you never arrive there; it only takes you home)
  back2.key = 'gravity';
  placeBoss(world, 'gravity', { x: 89, y: top(GC), z: 66, facing: [0, 1] });
  const crewAt = [[P.long, 144, 163, [0, 1]], [P.hop4, 89, 90, [0, 1]], [P.base, 84, 145, [1, 0]]]; // (Milo inside the moon's ellipse, never under its way)
  crewAt.forEach(([pi, x, z, facing], i) => placeCrew(world, 'gravity', i, { x, y: top(PLANETS[pi]), z, facing }));
  const near = (w, pad) => world.keeps.some(k => k.protect.some(b => w[0] >= b.x0 - pad && w[0] <= b.x1 + pad && w[1] >= b.y0 - pad && w[1] <= b.y1 + pad && w[2] >= b.z0 - pad && w[2] <= b.z1 + pad));
  const people = [...(world.bosses || []).flatMap(b => [b.pos, ...b.crew.map(c => c.pos)])];
  const busy = w => people.some(p => Math.abs(p[0] - w[0] - 0.5) < 3 && Math.abs(p[2] - w[2] - 0.5) < 3 && Math.abs(p[1] - w[1]) < 3)
    || FLOWERS.some(f => Math.hypot(f.cell[0] - w[0], f.cell[1] - w[1] + 1, f.cell[2] - w[2]) < 3.5) || HOME_FLOWERS.some(f => Math.hypot(f.cell[0] - w[0], f.cell[1] - w[1] + 1, f.cell[2] - w[2]) < 2.5)
    || (Math.abs(w[1] - top(PLANETS[P.base]) - 1) < 3 && orbitDist(w[0] + 0.5, w[2] + 0.5) < MOON.half * 1.5 + 1.5); // (nothing under the moon's way)
  // 4. each face's little things, sticking out of it (from the realm's seed): never near an edge, never near each other, never at a door,
  // a person, a flower, under the moon or on a pup's loop. The Tree Cube has a tree on every face (the Orbikit hides behind them).
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
    if (Pl.role === 'lens') continue; // a Lens Rock is bare: only its lens and its blue flower
    if (Pl.role === 'hop') { if (Pl.hop === 0 || (axis !== 1 || sign !== 1)) one(1, B.FLOWER_BUSH, 'flower'); continue; } // small planets: a flower here and there
    if (Pl.trees) { trees(2); one(1, B.FLOWER_BUSH, 'flower'); continue; }
    if (Pl.skin === 'meadow' || Pl.skin === 'great') { trees(Pl.role === 'great' ? 3 : 2); one(4, B.FLOWER_BUSH, 'flower'); one(1, B.PLANET_ROCK, 'rock'); }
    else if (Pl.skin === 'crystal') { one(2, B.CRYSTAL, 'crystal'); flat(1, B.STAR_GRASS); }
    else if (Pl.role === 'dock' && axis === 1 && sign === 1) { flat(4, B.GRAVEL); one(3, B.GLOWCAP, 'glowcap'); } // the Moon Dock's top: craters, glowcaps (never under the moon)
    else { flat(2, B.GRAVEL); one(2, B.PLANET_ROCK, 'rock'); one(1, B.GLOWCAP, 'glowcap'); }
  }
  // 5. rests on top of every planet (a lost battle), nooks (the wild Gravity creatures circle on top faces), the ground of every column
  const nooks = [];
  for (const [pi, Pl] of PLANETS.entries()) {
    const [nx, , nz] = sizeOf(Pl), t = top(Pl) + 1;
    if ((Pl.role !== 'hop' || Pl.hop === 0) && Pl.role !== 'lens') world.rests.push([Pl.x + Math.floor(nx / 2) + 0.5, t, Pl.z + Math.floor(nz / 2) + 0.5, 0]);
    if (!['hub', 'dock', 'great', 'pup'].includes(Pl.role) || pi === P.long) continue;
    for (let i = 3; i < nx - 3; i += 3) for (let k = 3; k < nz - 3; k += 3) {
      const w = [Pl.x + i, t, Pl.z + k];
      if (world.get(...w) !== B.AIR || world.get(w[0], t + 1, w[2]) !== B.AIR || near(w, 2) || busy(w)) continue;
      if (Pl.role === 'pup' && loopDist(Pl, 1, 1, i, k, PUPS.find(q => q.planet === pi).loop) < 3) continue;
      if (Pl.role === 'dock' && orbitDist(w[0] + 0.5, w[2] + 0.5) < 4) continue; // (not under the moon)
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
    wallText: 'The little planets are too small to dig!', rideText: 'No riding on the little planets!' });
  world.parts.push({ id: 'gravity', live: 'gravity' });
  world.realmBiome = () => 'gravity';
  return world;
}

// Which planet a point belongs to (its field, or the nearest).
export const planetAt = (world, p, prev = null) => downAt(world.planets ?? BOXES, p, prev);

/* ---------------------------------------------------------------- the guide */
// The arrow is worked out in your own frame (the face you stand on), so "ahead" is ahead on that face: x / z of the answer = your position +
// the target's offset across the face. Order: the Orbikit Chase, the Planet Hop, the Moon Ferry, the crew, Professor Orbit, the way back.
// Owner 2026-10-29 "too much instruction text": the guide only names where (an emoji, a name, the arrow); the scene says how.
// Over another planet the arrow leads to the hop side that faces the next planet on the way (ROUTE).
const ROUTE = { // next planet on the way from `from` to `to`'s branch: the hub is the Meadow Cube
  [P.crystal]: { home: P.meadow, out: P.tree }, [P.tree]: { home: P.crystal, out: P.long }, [P.long]: { home: P.tree },
  [P.base]: { home: P.meadow }, [P.hop0]: { home: P.meadow }, [P.great]: { home: P.hop4 },
};
const BRANCH = { [P.lens1]: 'lens', [P.lens2]: 'lens', [P.lens3]: 'lens', [P.crystal]: 'pup', [P.tree]: 'pup', [P.long]: 'pup', [P.base]: 'base', [P.hop0]: 'hop', [P.hop1]: 'hop', [P.hop2]: 'hop', [P.hop3]: 'hop', [P.hop4]: 'hop', [P.great]: 'great' };
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
  if (gd.soft) return at(centre(gd.planet), () => '🌌 Floating...');
  const mine = live?.aim?.(p, at); // a game in progress points at its own thing (the Orbikit's trail, the flower, the moon)
  if (mine) return mine;
  const st = gravityState(game), on = gd.planet, star = st.star;
  // where to go: the next unfinished game, then the crew, then the Professor; with the star, home
  const crewLeftList = (game?.bosses ? (world.bosses?.[0]?.crew || []).filter(c => !game.beaten?.includes(`pw:gravity:crew${c.i + 1}`)) : []);
  let goal = null, words = null;
  if (!star && st.tags < 3) { goal = PUPS.find((q, i) => !st.tag[i])?.planet ?? P.crystal; words = '🐱 Orbikits'; }
  else if (!star && !st.hop) { goal = P.hop0; words = '🌸 Spring flowers'; }
  else if (!star && st.lenses < 3) { goal = P.base; words = '🔭 Lenses'; }
  else if (!star && crewLeftList.length) { const c = crewLeftList[0], planetOf = [P.long, P.hop4, P.base][c.i]; if (on === planetOf) return at(c.pos, (a, m) => `⚔️ ${['Stargazer Stella', 'Captain Comet', 'Moon Mechanic Milo'][c.i]} ${a} ${m}m`); goal = planetOf; words = `⚔️ ${['Stargazer Stella', 'Captain Comet', 'Moon Mechanic Milo'][c.i]}`; }
  else if (!star) { if (on === P.great) { const b = world.bosses?.[0]; if (b) return at(b.pos, (a, m) => `⭐ Professor Orbit ${a} ${m}m`); } goal = P.great; words = '⭐ Professor Orbit'; }
  else {
    const d = world.doors?.find(x => world.planets.findIndex(b => x.surface[0][0] >= b.x0 - 1 && x.surface[0][0] <= b.x1 && x.surface[0][2] >= b.z0 - 1 && x.surface[0][2] <= b.z1) === on) ?? world.doors?.[0];
    if (d && (on === P.meadow || on === P.great)) {
      const s = d.surface[Math.floor(d.surface.length / 2)], w = [s[0] + 0.5, s[1], s[2] + 0.5];
            if (Math.hypot(w[0] - p.x, w[2] - p.z) < 3) return { x: w[0], z: w[2], text: () => '🖼️ Way back' };
      return at(w, (a, m) => `🖼️ Way back ${a} ${m}m`);
    }
    goal = P.meadow; words = '🖼️ Way back';
  }
  if (on === goal || (BRANCH[on] === 'hop' && BRANCH[goal] === 'hop' && on !== P.hop0)) return { text: () => words }; // there (the live part's words come first when a game is going on)
  // the pebbles and the Lens Rocks have no plain way out: a blue home flower
  const homeFlower = () => { const h = HOME_FLOWERS.find(f => f.planet === on); return h ? at([h.cell[0] + 0.5, h.cell[1] + 1, h.cell[2] + 0.5], (a, m) => `💠 Home ${a} ${m}m`) : null; };
  if ((BRANCH[on] === 'hop' && on !== P.hop0) || BRANCH[on] === 'lens' || (on === P.great && goal !== P.great)) return homeFlower();
  const target = goal === P.great && on !== P.hop4 ? P.hop0 : goal, next = nextPlanet(on, target === P.great && on === P.hop4 ? P.great : target);
  if (next == null || next === on) return null;
  return hopAim(world, p, gd, on, next, at, words);
}
function hopAim(world, p, gd, on, next, at, words) {
  const hop = HOPS.find(h => h.from === on && h.to === next), N = PLANETS[next];
  if (!hop) return null;
  if (gd.axis === hop.axis && gd.sign === hop.sign) {
    const b = world.planets[next];
    return at([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2], () => `${N.emoji} Jump!`);
  }
  return at(hopSpot(hop), (a, m) => `${N.emoji} ${N.name} ${a} ${m}m`);
}
