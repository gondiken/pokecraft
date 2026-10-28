// Cube Planets, step 0 (plans/cube-planets.md section 9: the gravity sandbox; realm `gravity`, the Swirl's old `secret5` frame).
// Terrain as data, Node-runnable (needs only a world with W / D / data / ground / index / inBounds / get, like castleland.js):
// three plain cube planets floating in a dark-blue sky, each with a skin on all six faces (every face is a little world), their
// edges in Planet Rock so you can see an edge coming. The way back stands on top of the Meadow Cube. Gravity: gravity.js (downAt),
// read through world.gravityAt (player.js's frame branch). No games, no type, no creatures, no Boss yet (steps 1-3).
//
// The planets are spread out flat (the world is 48 blocks tall, plan section 2). Hops are face to face across a gap of 4 blocks:
// a plain jump (8.6 up) from one planet's side takes your middle past the middle of the gap, where the other planet pulls harder.
import { B, mulberry32 } from './blocks.js';
import { kit, buildWayBack } from './picturelands.js';
import { downAt, toLocal } from './gravity.js';

export const SIZE = 224;
// x, y, z = the lowest corner cell, n = cells along each side; g = its pull (x the main world's 28); reach = how far its field goes.
export const PLANETS = [
  { id: 'meadow', name: 'Meadow Cube', emoji: '🌼', x: 98, y: 14, z: 140, n: 13, g: 0.7, reach: 8, skin: 'meadow' },
  { id: 'crystal', name: 'Crystal Cube', emoji: '💎', x: 115, y: 16, z: 142, n: 9, g: 0.6, reach: 8, skin: 'crystal' },
  { id: 'moon', name: 'Moon Cube', emoji: '🌙', x: 116, y: 12, z: 121, n: 17, g: 0.65, reach: 8, skin: 'moon' },
];
// The hops (each way): from planet `from`'s face [axis, sign] to planet `to`. The only ways between planets.
export const HOPS = [
  { from: 0, to: 1, axis: 0, sign: 1 },   // the Meadow Cube's east side -> the Crystal Cube's west side
  { from: 1, to: 0, axis: 0, sign: -1 },
  { from: 1, to: 2, axis: 2, sign: -1 },  // the Crystal Cube's north side -> the Moon Cube's south side
  { from: 2, to: 1, axis: 2, sign: 1 },
];
export const DOOR = { x: 104, z: 143, facing: [0, 1] }; // the way back on top of the Meadow Cube (you arrive 3 in front of it, looking south)
// The solid box of a planet in world units (x1 = its last block + 1), as gravity.js wants it.
export const boxOf = P => ({ id: P.id, x0: P.x, y0: P.y, z0: P.z, x1: P.x + P.n, y1: P.y + P.n, z1: P.z + P.n, reach: P.reach, g: P.g });
export const BOXES = PLANETS.map(boxOf);
// The middle of a face (on the surface): [x, y, z].
export function faceCentre(i, axis, sign) {
  const b = BOXES[i], c = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
  c[axis] = sign > 0 ? [b.x1, b.y1, b.z1][axis] : [b.x0, b.y0, b.z0][axis];
  return c;
}

// The middle of the part of a hop's face that looks at the other planet (where to jump from): [x, y, z] on the surface.
export function hopSpot(h) {
  const c = faceCentre(h.from, h.axis, h.sign), a = BOXES[h.from], b = BOXES[h.to], LO = ['x0', 'y0', 'z0'], HI = ['x1', 'y1', 'z1'];
  for (const k of [0, 1, 2]) if (k !== h.axis) c[k] = (Math.max(a[LO[k]], b[LO[k]]) + Math.min(a[HI[k]], b[HI[k]])) / 2;
  return c;
}

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
const SKINS = {
  meadow: { face: B.STAR_GRASS, edge: B.PLANET_ROCK },
  crystal: { face: B.ICE, edge: B.PLANET_ROCK },
  moon: { face: B.PLANET_ROCK, edge: B.COBBLE },
};
// Face cells: for a face [axis, sign], the in-face coordinates (u, v) along the other two axes, 0..n-1; cell(u, v, out) = the world
// cell `out` blocks outside the surface (out 0 = the skin block itself, 1 = the first cell of air above it).
const others = axis => [0, 1, 2].filter(a => a !== axis);
export function faceCell(P, axis, sign, u, v, out = 0) {
  const c = [P.x, P.y, P.z], [a, b] = others(axis), w = [0, 0, 0];
  w[axis] = sign > 0 ? c[axis] + P.n - 1 + out : c[axis] - out;
  w[a] = c[a] + u; w[b] = c[b] + v;
  return w;
}
export const FACES = [[1, 1], [1, -1], [0, 1], [0, -1], [2, 1], [2, -1]];

export function cubeLand(world, def) {
  kit(world);
  const { W, D } = world, rand = mulberry32((world.seed ^ 0xc0be) >>> 0);
  world.planets = BOXES;
  world.gravityAt = (p, prev, centre) => downAt(world.planets, p, prev, centre); // player.js: a world with gravityAt moves the player in a frame
  world.underground = () => false; // space is never a cave (under a planet is not dark)
  world.cubes = { planets: PLANETS, hops: HOPS, bumps: [] };
  // 1. the planets: Planet Rock inside, the skin on every face, the edges and corners in the edge block
  for (const P of PLANETS) {
    const S = SKINS[P.skin], m = P.n - 1;
    for (let i = 0; i < P.n; i++) for (let j = 0; j < P.n; j++) for (let k = 0; k < P.n; k++) {
      const onB = (i === 0 || i === m) + (j === 0 || j === m) + (k === 0 || k === m);
      put(world, P.x + i, P.y + j, P.z + k, onB >= 2 ? S.edge : onB === 1 ? S.face : B.PLANET_ROCK);
    }
  }
  // 2. the way back on top of the Meadow Cube
  const M = PLANETS[0];
  buildWayBack(world, 'gravity', { x: DOOR.x, y: M.y + M.n - 1, z: DOOR.z, facing: DOOR.facing });
  const near = (w, pad) => world.keeps.some(k => k.protect.some(b => w[0] >= b.x0 - pad && w[0] <= b.x1 + pad && w[1] >= b.y0 - pad && w[1] <= b.y1 + pad && w[2] >= b.z0 - pad && w[2] <= b.z1 + pad));
  // 3. each face's little things, sticking out of it (from the realm's seed): never near an edge, never near each other, never at the door
  for (const [pi, P] of PLANETS.entries()) for (const [axis, sign] of FACES) {
    const mid = Math.floor(P.n / 2), taken = axis === 1 && sign === 1 ? [[mid, mid, 1]] : []; // the middle of a top face stays free (its rest spot)
    const room = (u, v, r) => taken.every(([tu, tv, tr]) => Math.max(Math.abs(tu - u), Math.abs(tv - v)) > r + tr + 1);
    const spot = (r, edge) => {
      for (let tries = 0; tries < 40; tries++) {
        const u = edge + Math.floor(rand() * (P.n - 2 * edge)), v = edge + Math.floor(rand() * (P.n - 2 * edge));
        if (!room(u, v, r) || near(faceCell(P, axis, sign, u, v, 1), 3)) continue;
        taken.push([u, v, r]); return [u, v];
      }
      return null;
    };
    const cell = (u, v, out, id) => { const w = faceCell(P, axis, sign, u, v, out); put(world, w[0], w[1], w[2], id); };
    const bump = (u, v, kind) => world.cubes.bumps.push({ planet: pi, axis, sign, u, v, kind });
    const flat = (n, id) => { for (let k = 0; k < n; k++) { const s = spot(1, 2); if (s) for (let du = -1; du <= 1; du++) for (let dv = -1; dv <= 1; dv++) if (Math.abs(du) + Math.abs(dv) < 2) cell(s[0] + du, s[1] + dv, 0, id); } };
    const one = (n, id, kind) => { for (let k = 0; k < n; k++) { const s = spot(0, 2); if (s) { cell(s[0], s[1], 1, id); bump(s[0], s[1], kind); } } };
    if (P.skin === 'meadow') {
      for (let k = 0; k < 2; k++) { // little trees: a 2-high trunk, a leafy top; the leaves start 2 above the face (you walk under them)
        const s = spot(1, 3);
        if (!s) continue;
        cell(s[0], s[1], 1, B.LOG); cell(s[0], s[1], 2, B.LOG); cell(s[0], s[1], 3, B.LEAVES); cell(s[0], s[1], 4, B.LEAVES);
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cell(s[0] + du, s[1] + dv, 3, B.LEAVES);
        bump(s[0], s[1], 'tree');
      }
      one(4, B.FLOWER_BUSH, 'flower');
      one(1, B.PLANET_ROCK, 'rock');
    } else if (P.skin === 'crystal') {
      one(2, B.CRYSTAL, 'crystal');
      flat(1, B.STAR_GRASS);
    } else {
      flat(2, B.GRAVEL); // craters
      one(2, B.PLANET_ROCK, 'rock');
      one(1, B.GLOWCAP, 'glowcap');
    }
  }
  // 4. a rest on top of every planet (a lost battle, later), the ground of every column (the highest block)
  for (const P of PLANETS) world.rests.push([P.x + Math.floor(P.n / 2) + 0.5, P.y + P.n, P.z + Math.floor(P.n / 2) + 0.5, 0]);
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    let g = 0;
    for (let y = 47; y > 0; y--) if (world.get(x, y, z) !== B.AIR) { g = y; break; }
    world.ground[x + z * W] = g;
  }
  // 5. no building and no riding anywhere here (plan 3.5): one keep round the whole sky
  world.keeps.push({ name: 'space', protect: [{ x0: 0, x1: W - 1, y0: 0, y1: 47, z0: 0, z1: D - 1 }],
    wallText: 'The little planets are too small to dig! Walk round them and hop.', rideText: 'No riding on the little planets! Walk and jump instead.' });
  world.parts.push({ id: 'gravity', live: 'gravity' });
  return world;
}

// Which planet a point belongs to (its field, or the nearest).
export const planetAt = (world, p, prev = null) => downAt(world.planets ?? BOXES, p, prev);

// The guide (TERRAIN_AIMS): a little tour, Meadow -> Crystal -> Moon, then back to the way back. The arrow is worked out in your own
// frame (the face you stand on), so "ahead" is ahead on that face: x / z of the answer = your position + the target's offset across
// the face. The live part (cubelive.js) remembers which planets you stood on this visit.
const CHAIN = [0, 1, 2];
export function cubeAim(world, p, game) {
  if (!world.planets) return null;
  const pl = game?.player, fi = pl?.frameNo?.() ?? 0, live = game?.gymLive?.of?.('part:gravity');
  const gd = pl?.grav ?? downAt(world.planets, p, null);
  const visited = live?.visited ?? new Set();
  const at = (w, text) => { const l = toLocal(fi, [w[0] - p.x, w[1] - p.y, w[2] - p.z]); return { x: p.x + l[0], z: p.z + l[2], text }; };
  if (gd.soft) { const b = world.planets[gd.planet]; return at([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2], () => '🌌 Floating in space... the planet pulls you back!'); }
  const target = CHAIN.find(i => !visited.has(i));
  const on = gd.planet;
  if (target === undefined || target === on) {
    if (on === 0 && target === undefined) {
      const d = world.doors?.[0];
      if (!d) return null;
      const s = d.surface[Math.floor(d.surface.length / 2)], w = [s[0] + 0.5, s[1], s[2] + 0.5];
      if (gd.axis !== 1 || gd.sign !== 1) return at(w, (a, m) => `🖼️ Over the edge to the top: the way back ${a} ${m}m`);
      if (Math.hypot(w[0] - p.x, w[2] - p.z) < 3) return { x: w[0], z: w[2], text: () => 'Way back: step in to go to the Swirl' };
      return at(w, (a, m) => `🖼️ Way back ${a} ${m}m`);
    }
    if (target === undefined) { const step = on > 0 ? on - 1 : 1; return hopAim(world, p, gd, on, step, at, '🖼️ Back to the Meadow Cube: the way back is there.'); }
    const P = PLANETS[on];
    return { text: () => `${P.emoji} The ${P.name}! Walk all the way round it: every side is a little world.` };
  }
  const step = target > on ? on + 1 : on - 1;
  return hopAim(world, p, gd, on, step, at);
}
function hopAim(world, p, gd, on, next, at, note = '') {
  const hop = HOPS.find(h => h.from === on && h.to === next), N = PLANETS[next];
  if (!hop) return null;
  if (gd.axis === hop.axis && gd.sign === hop.sign) {
    const b = world.planets[next];
    return at([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2], () => `${N.emoji} Jump! The ${N.name} pulls you in.${note ? ' ' + note : ''}`);
  }
  return at(hopSpot(hop), (a, m) => `${N.emoji} Walk over the edge to the side that faces the ${N.name} ${a} ${m}m`);
}
