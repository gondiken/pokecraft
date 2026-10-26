// T40b: the terrain of the Pirate Seas (TERRAINS.pirateLand in realms.js): open sea (water to y 12) with seven islands, Captain Squawk's
// ship, cannons that shoot you from island to island, ropes you swing on and rope ladders. Everything is data (ISLES, CANNONS, ROPES,
// WALKS) and a small loop: seeded noise only makes the sea floor, island edges and plants, so every gadget is always where the table says.
// It only needs a world with W / D / seed / data / ground / index / inBounds / get (the spec runs it on a stand-in in Node, like
// dreamland.js) and imports only blocks.js, mover.js, picturelands.js and pirateship.js. The pure paths (cannonSpec, swingPath), the
// challenges (owner 2026-10-26: swinging cannons, letting go of the rope, the rowboats), the guide (pirateAim) and the route finder
// live here too, so PirateLive (pirateparts.js) and the spec agree.
import { B, mulberry32 } from './blocks.js';
import { makePath } from './mover.js';
import { kit, buildWayBack, placeCrew, pictureAim } from './picturelands.js';
import { SHIP, buildShip, buildDock, deckTop } from './pirateship.js';

export const SEA = 12; // the top water block row (WATER_LEVEL): the surface is at 13
// One island. Beach islands: a flat plateau of radius P at `top` (grass, sand round its rim), then sand going down one block per 1.25 cells,
// on under the water. Stacks: a stone pillar (an exact disc) from the sea floor up, grass on top.
export const ISLES = [
  { id: 'start', name: 'Sandy Start', x: 112, z: 180, P: 12, top: 15, kind: 'beach' },
  { id: 'perch', name: 'Parrot Perch', x: 112, z: 136, P: 10, top: 16, kind: 'beach' },
  { id: 'crab', name: 'Crab Rock', x: 98, z: 120, R: 3.5, top: 16, kind: 'stack', ladder: [-1, 0] },
  { id: 'gull', name: 'Gull Rock', x: 108, z: 109, R: 3.5, top: 16, kind: 'stack', ladder: [1, 0] },
  { id: 'lookout', name: 'Lookout Isle', x: 104, z: 86, P: 10, top: 16, kind: 'beach' },
  { id: 'cove', name: "Captain's Cove", x: 150, z: 68, P: 9, top: 15, kind: 'beach' },
  { id: 'palm', name: 'Palm Key', x: 168, z: 150, P: 10, top: 14, kind: 'beach' },
];
// A cannon: you stand on `pad` (a CANNON_PAD block), the barrel is a mesh on a PLANKS carriage on the next cell towards the target; it
// lands you in the middle of `target` (a 5 x 5 patch with a TARGET 3 x 3 in the middle). `home` cannons go back to Sandy Start.
export const CANNONS = [
  { id: 'c1', from: 'start', pad: [112, 173], to: 'perch', target: [112, 140], name: 'Parrot Perch' },
  { id: 'c2', from: 'lookout', pad: [104, 80], to: 'ship', target: [108, 48], name: "Captain Squawk's ship" },
  { id: 'c3', from: 'cove', pad: [146, 72], to: 'start', target: [104, 180], name: 'Sandy Start', home: true },
  { id: 'c4', from: 'start', pad: [120, 180], to: 'palm', target: [165, 151], name: 'Palm Key' },
  { id: 'c5', from: 'palm', pad: [164, 155], to: 'start', target: [104, 180], name: 'Sandy Start', home: true },
  { id: 'c6', from: 'perch', pad: [118, 138], to: 'start', target: [104, 180], name: 'Sandy Start', home: true },
];
// A rope: two stand cells on tops of the same height; works both ways. [island, x, z]
export const ROPES = [
  { id: 'r1', a: ['perch', 106, 129], b: ['crab', 100, 122] },
  { id: 'r2', a: ['crab', 100, 118], b: ['gull', 106, 111] },
  { id: 'r3', a: ['gull', 108, 106], b: ['lookout', 106, 95] },
];
export const WALKS = [['ship', 'cove']]; // the gangplank and the dock, both ways
export const SWING = { lift: 1.5, maxSpan: 16, minFeet: 14, maxAnchor: 30 }; // a swing starts and ends 1.5 above its stand (it hops on, and drops softly)
export const SHORE = 1.25; // sand: one block down per 1.25 cells
export const LOOKOUT = { x: 112, z: 86 }; // the lookout tower on Lookout Isle (decor)

// Small value noise of its own (world.js imports realms.js, which imports this file: no import back).
function hash(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed), c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const isleOf = id => ISLES.find(i => i.id === id);
// the radius of the land (sand at or above the water) of an island
export const landRadius = i => (i.kind === 'stack' ? i.R : i.P + Math.ceil((i.top - SEA - 1) * SHORE));
const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };

/* ------------------------------ pure paths ------------------------------ */

// The arc spec for PATHS.arc (mover.js) of a worked-out cannon: S = the pad's stand point (feet), E = the target's middle (feet).
export function cannonSpec(c) {
  const S = c.S, E = c.E, dist = Math.hypot(E[0] - S[0], E[2] - S[2]);
  const time = Math.min(4, Math.max(1.4, 0.8 + dist / 22));                                    // seconds in the air
  const height = Math.min(44 - Math.max(S[1], E[1]), Math.min(16, Math.max(6, dist * 0.3))); // the top of the arc above the higher end
  return { kind: 'arc', from: S, to: E, height, time };
}

// The swing path of a worked-out rope (a, b = [x, feet, z] stand points with the same feet), starting at `from` ('a' or 'b'): a pendulum
// on an anchor above the middle, at rest at both ends (a soft start and landing). Both ends are SWING.lift above the stands, so the
// player's box clears the island's edge on the way in and out (the pendulum arrives at a steep angle) and drops the last bit.
// loop: the rope keeps swinging there and back (u is not clamped) until you let go (owner 2026-10-26).
export function swingPath(r, from = 'a', loop = false) {
  const [ax, ay, az] = r.a, [bx, , bz] = r.b, k = from === 'a' ? 1 : -1;
  const len = Math.hypot(bx - ax, bz - az), s = len / 2, ux = (bx - ax) / len, uz = (bz - az) / len;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2, end = ay + SWING.lift;
  const h = Math.max(5, Math.ceil((s * s - 9) / 6)) + 0.5;         // the anchor height above the ends: the lowest point stays above the water
  const L = Math.hypot(s, h), th0 = Math.atan2(s, h);
  const time = Math.min(2.4, Math.max(1.2, Math.PI * Math.sqrt(L / 28))); // half a pendulum swing at our gravity (28)
  const yaw = Math.atan2(-ux * k, -uz * k);
  return {
    time, loop, anchor: [mx, end + h, mz], L, span: len, lowest: end + h - L, ends: end,
    at(t) {
      const u = loop ? t / time : Math.min(1, Math.max(0, t / time)), th = th0 * Math.cos(Math.PI * u), off = -L * Math.sin(th) * k;
      return { x: mx + ux * off, y: end + h - L * Math.cos(th), z: mz + uz * off, yaw };
    },
  };
}

/* ------------------------------ the challenges (owner 2026-10-26: "some dexterity") ------------------------------ */
// Never a fail: a miss drops you in the sea near where you wanted to go, and you swim to a beach or a rope ladder.

// 1. Island cannons swing left and right (a triangle wave: an even speed, no fast middle); fire while the barrel points at the target.
// `u` is the cannon's own aim clock (PirateLive slows it after a miss: `slower[misses]`). A home cannon holds still.
export const AIM = { sweep: 0.36, hit: 0.12, period: 3.2, slower: [1, 0.75, 0.55] };
export function sweepAngle(u, c) {
  if (c.home) return 0;
  const k = (((u / AIM.period + (c.phase ?? 0)) % 1) + 1) % 1;
  return AIM.sweep * (1 - 4 * Math.abs(k - 0.5));
}
export const onTarget = off => Math.abs(off) <= AIM.hit;
// open water at least 2 deep in every column within r cells of (x, z)
export function openSea(world, x, z, r = 2) {
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz;
    if (cx < 2 || cz < 2 || cx >= world.W - 2 || cz >= world.D - 2 || colTop(world, cx, cz) > SEA - 2) return false;
  }
  return true;
}
// the player's box is free of blocks (water is fine) from `from` (0..1 of the time) to the end of a path
export function clearFlight(world, spec, from = 0.3) {
  const path = makePath(spec);
  for (let k = from; k <= 1.0001; k += 0.02) {
    const w = path.at(k * path.time);
    for (const dy of [0.1, 1, 1.7]) {
      const id = world.get(Math.floor(w.x), Math.floor(w.y + dy), Math.floor(w.z));
      if (id !== B.AIR && id !== B.WATER) return false;
    }
  }
  return true;
}
// The flight of a cannon fired `off` radians beside its target: the same distance (or a bit shorter / longer) that way, into open sea.
// If there is no sea that way (never on our map), it lands on the target after all (the spec checks every cannon at both ends).
export function missSpec(world, c, off) {
  const S = c.S, dist = Math.hypot(c.E[0] - S[0], c.E[2] - S[2]), a = Math.atan2(c.E[0] - S[0], c.E[2] - S[2]) + off;
  for (const f of [1, 0.9, 1.1, 0.8, 1.2, 0.7, 1.3, 0.6, 0.5]) {
    const x = Math.floor(S[0] + Math.sin(a) * dist * f) + 0.5, z = Math.floor(S[2] + Math.cos(a) * dist * f) + 0.5;
    if (!openSea(world, x, z)) continue;
    const spec = cannonSpec({ S, E: [x, SEA + 0.2, z] });
    if (clearFlight(world, spec)) return spec;
  }
  return c.spec;
}
// What a cannon does if you fire it now: { spec, hit }
export function cannonShot(world, c, off) {
  if (onTarget(off)) return { spec: c.spec, hit: true };
  const spec = missSpec(world, c, off);
  return { spec, hit: spec === c.spec };
}

// 2. The rope keeps swinging (swingPath(r, from, true)) until you press Let go! Out past `good` of the way on the far side you land on
// the far stand, on your own side you drop back on your stand, in the middle you splash into the sea. After `swings` times there and
// back with no press you drop back where you started.
export const LETGO = { good: 0.45, swings: 3, hop: 0.35 };
export function letGo(path, t) {
  const c = Math.cos(Math.PI * t / path.time); // 1 at your own stand, -1 at the far one
  return c <= -LETGO.good ? 'far' : c >= LETGO.good ? 'back' : 'splash';
}
// Where a splash lands: open sea under the rope's line, the nearest to `p` ([x, z]); null when there is none (then: back).
export function ropeDrop(world, r, p) {
  const [ax, , az] = r.a.pos, [bx, , bz] = r.b.pos, len = Math.hypot(bx - ax, bz - az);
  const s0 = Math.max(0, Math.min(1, ((p[0] - ax) * (bx - ax) + (p[1] - az) * (bz - az)) / (len * len)));
  const tries = [];
  for (let k = 0; k <= 20; k++) tries.push(k / 20);
  tries.sort((u, v) => Math.abs(u - s0) - Math.abs(v - s0));
  for (const rr of [1, 0]) for (const s of tries) { // (a narrow strait: a single deep enough column will do)
    const x = Math.floor(ax + (bx - ax) * s) + 0.5, z = Math.floor(az + (bz - az) * s) + 0.5;
    if (openSea(world, x, z, rr)) return [x, SEA + 0.2, z];
  }
  return null;
}

// 3. Captain Squawk's rowboats row figure-eights north of the ship (each in its own patch of sea, so they never meet), quite fast.
// Sink all three with the two swivel cannons on the north rail and the Captain battles you (the Boss def's gate). Aim by turning; the
// distance is how long you hold Fire! (it grows, then shrinks again: `power`). The ball flies a while, so aim where the boat will be;
// the dots turn gold for the short moment a let-go would hit.
// Sunk boats are `beaten` keys, saved at once, cleared after a won Captain battle (like the Ball Stadium's goals).
export const ROWBOATS = {
  boats: [{ c: [100, 26], a: [6, 5], per: 12 }, { c: [114, 23], a: [6, 5], per: 10 }, { c: [128, 26], a: [6, 5], per: 11 }], // about 4.5 blocks a second (a walk is 4.3)
  phase: [0, 0.35, 0.7],
  cannons: SHIP.swivels, // the swivel cannons on the north rail ([x, rail z]): you stand on the step one cell south of each
  turn: 1.1, near: 6, far: 28, fill: 2, // range from `near` to `far` blocks: up in `fill` seconds of holding, then back down
  hit: 1.8, reload: 1, sink: 1.5,
};
// (`rowboat`, not the first version's `boat`: the boats got harder, so boats sunk the easy way count no more)
export const boatKey = i => `pw:pirate:rowboat${i + 1}`;
export const OLD_BOAT = /^pw:pirate:boat\d$/;
export function boatState(game) {
  const need = ROWBOATS.boats.length, sunk = ROWBOATS.boats.filter((_, i) => game?.beaten?.includes(boatKey(i))).length;
  return { sunk, need, done: sunk >= need };
}
// a boat at boat clock t (a figure eight): { x, z, yaw } (yaw: the way it rows, as a mesh rotation.y)
export function boatAt(i, t) {
  const b = ROWBOATS.boats[i], u = 2 * Math.PI * (t / b.per + ROWBOATS.phase[i]);
  const x = b.c[0] + b.a[0] * Math.sin(u), z = b.c[1] + b.a[1] * Math.sin(2 * u);
  const vx = b.a[0] * Math.cos(u), vz = 2 * b.a[1] * Math.cos(2 * u);
  return { x: x + 0.5, z: z + 0.5, yaw: Math.atan2(vx, vz) };
}
// how far the ball goes after holding Fire! for `held` seconds: 0 -> 1 in `fill`, then back to 0, and so on
export function power(held) {
  const k = (held / ROWBOATS.fill) % 2;
  return k <= 1 ? k : 2 - k;
}
// where you stand to use the swivel cannon on rail cell `at` (feet): on its step, one cell south
export const deckStand = at => [at[0] + 0.5, SHIP.deck + 2, at[1] + 1.5];
// A shot of the swivel cannon on rail cell `at` = [x, z] when you look along `yaw` with power `pw` (0..1): the barrel turns your way
// (at most `turn` either side of north), the ball lands on the sea `near`..`far` blocks out. { a, spec, to, range }
export function deckShot(at, yaw, pw = 0) {
  let d = Math.atan2(-Math.sin(yaw), -Math.cos(yaw)) - Math.PI;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const a = Math.PI + Math.max(-ROWBOATS.turn, Math.min(ROWBOATS.turn, d)), range = ROWBOATS.near + (ROWBOATS.far - ROWBOATS.near) * Math.max(0, Math.min(1, pw));
  const from = [at[0] + 0.5 + Math.sin(a) * 1.1, SHIP.deck + 2.6, at[1] + 0.5 + Math.cos(a) * 1.1];
  const to = [from[0] + Math.sin(a) * range, SEA + 0.6, from[2] + Math.cos(a) * range];
  return { a, to, range, spec: { kind: 'arc', from, to, height: 1.5 + range * 0.12, time: 0.5 + range / 24 } };
}
// The boat (still afloat) within `hit` of `to` at boat clock t, or -1.
export function boatHit(game, to, t) {
  let best = -1, bd = ROWBOATS.hit;
  ROWBOATS.boats.forEach((_, i) => {
    if (game?.beaten?.includes(boatKey(i))) return;
    const b = boatAt(i, t), d = Math.hypot(b.x - to[0], b.z - to[2]);
    if (d <= bd) { bd = d; best = i; }
  });
  return best;
}

/* ------------------------------ where am I, how do I get there ------------------------------ */

const d_end = data => data.dockEnd[0];
// 'ship' | an island id | 'sea' | 'air' for a position (feet y). Islands and the ship are found by x / z; the sea by height.
export function placeOf(world, p) {
  const data = world.pirate;
  if (!data) return 'air';
  const S = SHIP;
  if (p.y >= 18.5 && p.x >= S.x0 - 1 && p.x <= S.x1 + 2 && p.z >= S.z0 - 1 && p.z <= S.z1 + 2) return 'ship';
  if (p.y >= 13.5 && p.z >= S.gang.z0 - 0.5 && p.z <= S.dock.z1 + 1.5 && p.x >= S.dock.x0 - 1 && p.x <= d_end(data) + 1) return p.x < S.gang.x1 + 1 ? 'ship' : 'cove'; // the gangplank and the dock
  if (p.y >= 13) {
    for (const i of data.isles) if (Math.hypot(p.x - (i.x + 0.5), p.z - (i.z + 0.5)) <= i.r + 1) return i.id;
  }
  return p.y < 13.8 ? 'sea' : 'air';
}

// The edges of the route graph: cannons one way, ropes and walks both ways. `at` = where to stand to use it.
export function routeEdges(world) {
  const d = world.pirate, out = [];
  for (const c of d.cannons) out.push({ kind: 'cannon', id: c.id, from: c.from, to: c.to, x: c.pad[0] + 0.5, z: c.pad[1] + 0.5, name: c.name });
  for (const r of d.ropes) {
    out.push({ kind: 'rope', id: r.id, from: r.a.isle, to: r.b.isle, x: r.a.x + 0.5, z: r.a.z + 0.5, name: isleOf(r.b.isle)?.name });
    out.push({ kind: 'rope', id: r.id, from: r.b.isle, to: r.a.isle, x: r.b.x + 0.5, z: r.b.z + 0.5, name: isleOf(r.a.isle)?.name });
  }
  const gx = (SHIP.gang.x0 + SHIP.gang.x1) / 2 + 0.5, gz = (SHIP.gang.z0 + SHIP.gang.z1) / 2 + 0.5; // both ways aim at the middle of the gangplank
  for (const [a, b] of d.walks) {
    out.push({ kind: 'walk', id: `${a}-${b}`, from: b, to: a, x: gx, z: gz, name: 'the ship' });
    out.push({ kind: 'walk', id: `${b}-${a}`, from: a, to: b, x: gx, z: gz, name: isleOf(b)?.name ?? b });
  }
  return out;
}
// The first gadget to use on the way from `from` to `goal` (breadth-first), or null when you are there / there is no way.
export function routeTo(world, from, goal) {
  if (from === goal) return null;
  const edges = routeEdges(world), first = new Map([[from, null]]), q = [from];
  while (q.length) {
    const at = q.shift();
    for (const e of edges) {
      if (e.from !== at || first.has(e.to)) continue;
      first.set(e.to, first.get(at) ?? e);
      if (e.to === goal) return first.get(e.to);
      q.push(e.to);
    }
  }
  return null;
}
const nearest = (p, list) => list.reduce((best, c) => (!best || Math.hypot(c.x - p.x, c.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? c : best), null);

// The guide arrow (TERRAIN_AIMS.pirateLand): { x, z, text(arrow, metres) } or null.
export function pirateAim(world, p, game) {
  const d = world.pirate;
  if (!d) return null;
  if (game?.player?.carry) return { x: p.x, z: p.z, text: () => 'Wheee! 🏴‍☠️' };
  const stars = game?.stars ?? [], star = stars.includes('pirate'), where = placeOf(world, p);
  if (where === 'sea') {
    const e = nearest(p, d.exits);
    return e ? { x: e.x, z: e.z, text: (a, m) => (e.kind === 'ladder' ? `🪜 Swim to the rope ladder ${a} ${m} m` : `🏝️ Swim to the beach ${a} ${m} m`) } : null;
  }
  if (where === 'air') return { x: p.x, z: p.z, text: () => 'Wheee! 🏴‍☠️' };
  const goal = star ? 'start' : 'ship';
  if (where === 'ship' && !star && !boatState(game).done) { // the rowboats first: to the nearer north deck cannon
    const { sunk, need } = boatState(game), at = nearest(p, ROWBOATS.cannons.map(c => { const s = deckStand(c); return { x: s[0], z: s[2] }; }));
    const here = Math.hypot(at.x - p.x, at.z - p.z) < 1.6;
    return { x: at.x, z: here ? at.z - 12 : at.z, text: (a, m) => (here ? `Aim at a rowboat and Fire! 🚣 ${sunk} / ${need} ${a}` : `💣 Deck cannon: sink the rowboats (${sunk} / ${need}) ${a} ${m} m`) };
  }
  if (where === goal) return pictureAim(world, p, { stars, via: game?.realms?.via });
  const e = routeTo(world, where, goal);
  if (!e) return pictureAim(world, p, { stars, via: game?.realms?.via });
  const here = Math.hypot(e.x - p.x, e.z - p.z) < 1.6;
  if (e.kind === 'cannon') return { x: e.x, z: e.z, text: (a, m) => (here ? `Fire the cannon! ${a}` : e.id && d.cannons.find(c => c.id === e.id)?.home ? `💣 Home cannon ${a} ${m} m` : `💣 Cannon to ${e.name} ${a} ${m} m`) };
  if (e.kind === 'rope') return { x: e.x, z: e.z, text: (a, m) => (here ? `Swing! ${a}` : `🪢 Rope to ${e.name} ${a} ${m} m`) };
  return { x: e.x, z: e.z, text: (a, m) => (e.name === 'the ship' ? `⛵ Walk to the ship ${a} ${m} m` : `🏝️ Walk to ${e.name} ${a} ${m} m`) };
}

/* ------------------------------ the builder ------------------------------ */

// Top block of a column (the highest non-air, non-water block, up to y 30).
export function colTop(world, x, z) {
  for (let y = 30; y >= 0; y--) { const id = world.get(x, y, z); if (id !== B.AIR && id !== B.WATER) return y; }
  return -1;
}
const line = (x0, z0, x1, z1) => { // the cells on a line (Bresenham)
  const out = [];
  let dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0), x = x0, z = z0, err = dx - dz;
  const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
  for (;;) {
    out.push([x, z]);
    if (x === x1 && z === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
  }
  return out;
}

export function pirateLand(world, def) {
  kit(world);
  const { W, D, seed } = world, rand = mulberry32((seed ^ 0x91a7) >>> 0);
  const idx = (x, z) => x + z * W, inMap = (x, z) => x >= 1 && z >= 1 && x < W - 1 && z < D - 1;
  const isles = ISLES.map(i => ({ ...i, r: landRadius(i), r0: i.kind === 'stack' ? i.R : i.P }));

  /* 1. the surface height of every column: the sea floor (4-7), the islands' skirts on top of it */
  const surf = new Int16Array(W * D), owner = new Array(W * D).fill(null), plateau = new Uint8Array(W * D);
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const n = noise(x * 0.06, z * 0.06, seed) * 0.65 + noise(x * 0.19, z * 0.19, seed + 1) * 0.35;
    surf[idx(x, z)] = 4 + Math.min(3, Math.floor(n * 4));
  }
  for (const i of isles) {
    const reach = Math.ceil(i.r0 + (i.top - 5) * SHORE + 2);
    for (let x = i.x - reach; x <= i.x + reach; x++) for (let z = i.z - reach; z <= i.z + reach; z++) {
      if (!inMap(x, z)) continue;
      const d = Math.hypot(x - i.x, z - i.z);
      let y;
      if (i.kind === 'stack') { if (d > i.R) continue; y = i.top; } else if (d <= i.P) y = i.top;
      else y = i.top - 1 - Math.max(0, Math.floor((d - i.P) / SHORE + (noise(x * 0.3, z * 0.3, seed + 7) - 0.5) * 0.9)); // a one block step down at the plateau's edge, then the shore
      if (y > surf[idx(x, z)]) {
        surf[idx(x, z)] = y; owner[idx(x, z)] = i.id;
        plateau[idx(x, z)] = d <= (i.kind === 'stack' ? i.R : i.P - 0.5) && y === i.top ? 1 : 0;
      }
    }
  }
  /* 2. fill the columns: stone, sand (grass and dirt on the plateaus), water up to the sea level */
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const y = surf[idx(x, z)], own = owner[idx(x, z)], stack = own && isleOf(own).kind === 'stack';
    for (let k = 0; k <= y; k++) {
      let id = stack ? B.STONE : k <= y - 4 ? B.STONE : B.SAND;
      if (!stack && plateau[idx(x, z)]) id = k === y ? B.GRASS : k >= y - 2 ? B.DIRT : id;
      if (stack && k === y) id = B.GRASS;
      put(world, x, k, z, id);
    }
    for (let k = y + 1; k <= SEA; k++) put(world, x, k, z, B.WATER);
    world.ground[idx(x, z)] = y;
  }

  /* 3. the ship and the dock (the ship's own columns count as high ground for the biome) */
  const ship = buildShip(world, SHIP);
  for (let x = SHIP.x0 - 1; x <= SHIP.x1 + 1; x++) for (let z = SHIP.z0 - 3; z <= SHIP.z1 + 3; z++) if (inMap(x, z)) world.ground[idx(x, z)] = Math.max(world.ground[idx(x, z)], 18);
  const dockEnd = buildDock(world, (x, z) => colTop(world, x, z));

  /* 4. gadgets: pads, targets, rope stands and arches */
  const reserved = new Set(), reserve = (cx, cz, r) => { for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) reserved.add(idx(x, z)); };
  const top = id => isleOf(id).top;
  const flatten = (x0, z0, x1, z1, id) => {
    const i = isleOf(id);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      for (let k = surf[idx(x, z)] + 1; k <= i.top; k++) put(world, x, k, z, B.DIRT);
      if (surf[idx(x, z)] < i.top) { surf[idx(x, z)] = i.top; world.ground[idx(x, z)] = i.top; }
      put(world, x, i.top, z, B.GRASS);
      for (let k = i.top + 1; k <= i.top + 4; k++) put(world, x, k, z, B.AIR);
    }
  };
  const keeps = [], cannons = [];
  const keep = (name, box, wallText) => keeps.push({ name, protect: [box], wallText });
  for (const c of CANNONS) {
    const t = top(c.from), tt = c.to === 'ship' ? SHIP.deck : top(c.to);
    const [px, pz] = c.pad, [tx, tz] = c.target;
    const dx = tx - px, dz = tz - pz, ax = Math.abs(dx) >= Math.abs(dz);
    const car = ax ? [px + Math.sign(dx), pz] : [px, pz + Math.sign(dz)];
    flatten(px - 1, pz - 1, px + 1, pz + 1, c.from);
    put(world, px, t, pz, B.CANNON_PAD);
    put(world, car[0], t, car[1], B.PLANKS);
    if (c.to !== 'ship') {
      flatten(tx - 2, tz - 2, tx + 2, tz + 2, c.to);
      for (let x = tx - 1; x <= tx + 1; x++) for (let z = tz - 1; z <= tz + 1; z++) put(world, x, tt, z, B.TARGET);
    }
    const S = [px + 0.5, t + 1, pz + 0.5], E = [tx + 0.5, tt + 1, tz + 0.5];
    const w = { ...c, carriage: car, padTop: t, S, E, dir: Math.atan2(dx, dz), phase: (cannons.length * 0.37) % 1 };
    w.spec = cannonSpec(w);
    cannons.push(w);
    keep(`cannon-${c.id}`, { x0: Math.min(px, car[0]), x1: Math.max(px, car[0]), y0: t, y1: t + 3, z0: Math.min(pz, car[1]), z1: Math.max(pz, car[1]) }, 'The cannon is part of the picture. Stand on it and press Fire!');
    if (c.to !== 'ship') keep(`target-${c.id}`, { x0: tx - 2, x1: tx + 2, y0: tt, y1: tt + 6, z0: tz - 2, z1: tz + 2 }, 'The cannon lands here. Keep the target free!');
    reserve(px, pz, 5);
    if (c.to !== 'ship') reserve(tx, tz, 6);
    // no palms under the first and last stretch of the flight
    const n = Math.ceil(Math.hypot(E[0] - S[0], E[2] - S[2]));
    for (let k = 0; k <= n; k++) { const f = k / n; if (f < 0.12 || f > 0.88) reserve(Math.floor(S[0] + (E[0] - S[0]) * f), Math.floor(S[2] + (E[2] - S[2]) * f), 3); }
  }
  // the keeps of the target squares on the ship are the ship's own
  const ropes = [];
  for (const r of ROPES) {
    const [ia, xa, za] = r.a, [ib, xb, zb] = r.b, feet = top(ia) + 1;
    const a = [xa + 0.5, feet, za + 0.5], b = [xb + 0.5, feet, zb + 0.5];
    const rope = { id: r.id, a: { isle: ia, x: xa, z: za, pos: a }, b: { isle: ib, x: xb, z: zb, pos: b }, feet };
    const sp = swingPath({ a, b }, 'a');
    rope.anchor = sp.anchor; rope.span = sp.span; rope.lowest = sp.lowest; rope.time = sp.time;
    ropes.push(rope);
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]), ux = (b[0] - a[0]) / len, uz = (b[2] - a[2]) / len;
    // each stand: a DECK block to stand on and a ROPE_POST (2 high) one cell behind it
    for (const [end, dir] of [[rope.a, 1], [rope.b, -1]]) {
      const t = top(end.isle);
      put(world, end.x, t, end.z, B.DECK);
      const px = end.x - Math.round(ux * dir), pz = end.z - Math.round(uz * dir);
      end.post = [px, pz];
      put(world, px, t + 1, pz, B.ROPE_POST); put(world, px, t + 2, pz, B.ROPE_POST);
      keep(`rope-${r.id}-${dir > 0 ? 'a' : 'b'}`, { x0: Math.min(end.x, px), x1: Math.max(end.x, px), y0: t, y1: t + 3, z0: Math.min(end.z, pz), z1: Math.max(end.z, pz) }, 'A rope stand. Stand here and press Swing!');
      reserve(end.x, end.z, 4);
    }
    // the arch: two log posts on reef rocks either side of the middle, joined by a beam whose underside holds the rope
    const mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2, px = -uz, pz = ux, ay = Math.round(rope.anchor[1]);
    const p1 = [Math.floor(mx + px * 3), Math.floor(mz + pz * 3)], p2 = [Math.floor(mx - px * 3), Math.floor(mz - pz * 3)];
    for (const [x, z] of [p1, p2]) {
      for (let k = surf[idx(x, z)] + 1; k <= SEA; k++) put(world, x, k, z, B.COBBLE);
      const base = Math.max(surf[idx(x, z)] + 1, SEA + 1);
      for (let k = base; k < ay; k++) put(world, x, k, z, B.LOG);
    }
    for (const [x, z] of line(p1[0], p1[1], p2[0], p2[1])) put(world, x, ay, z, B.LOG);
    rope.arch = { posts: [p1, p2], beam: ay };
    keep(`arch-${r.id}`, { x0: Math.min(p1[0], p2[0]), x1: Math.max(p1[0], p2[0]), y0: 0, y1: ay + 1, z0: Math.min(p1[1], p2[1]), z1: Math.max(p1[1], p2[1]) }, 'The rope hangs from this arch.');
    const n = Math.ceil(len * 2);
    for (let k = 0; k <= n; k++) reserve(Math.floor(a[0] + (b[0] - a[0]) * k / n), Math.floor(a[2] + (b[2] - a[2]) * k / n), 2);
  }

  /* 5. rope ladders on the stacks (a 3 wide strip of ROPE_LADDER on the outside, a lift column in the water beside it) */
  const lifts = [], exits = [];
  for (const i of isles.filter(q => q.kind === 'stack')) {
    const [lx, lz] = i.ladder, perp = [lz, lx], base = [i.x + lx * 3, i.z + lz * 3];
    for (let s = -1; s <= 1; s++) {
      const x = base[0] + perp[0] * s, z = base[1] + perp[1] * s;
      for (let k = SEA + 1; k <= i.top; k++) put(world, x, k, z, B.ROPE_LADDER);
    }
    const out = [base[0] + lx, base[1] + lz], a = [out[0] - Math.abs(perp[0]), out[1] - Math.abs(perp[1])], b = [out[0] + Math.abs(perp[0]), out[1] + Math.abs(perp[1])];
    lifts.push({ id: `ladder-${i.id}`, x: [Math.min(a[0], b[0]), Math.max(a[0], b[0])], z: [Math.min(a[1], b[1]), Math.max(a[1], b[1])], y: [SEA, i.top] });
    exits.push({ kind: 'ladder', x: out[0] + 0.5, z: out[1] + 0.5, isle: i.id });
    reserve(i.x, i.z, 4);
  }
  world.lifts = [...(world.lifts || []), ...lifts];
  for (const l of ship.lifts) exits.push({ kind: 'ladder', x: (l.x[0] + l.x[1]) / 2 + 0.5, z: l.z[0] + 0.5, isle: 'ship' });

  /* 6. beach exits: up to 12 points per beach island where a sand column at the water's edge (top 12-13) has water beside it */
  for (const i of isles.filter(q => q.kind === 'beach')) for (let k = 0; k < 12; k++) {
    const ang = (k * Math.PI) / 6;
    for (let rr = i.r + 3; rr >= i.P; rr -= 0.5) {
      const x = Math.floor(i.x + Math.cos(ang) * rr), z = Math.floor(i.z + Math.sin(ang) * rr);
      if (!inMap(x, z)) continue;
      const y = surf[idx(x, z)];
      if (y < SEA || y > SEA + 1 || world.get(x, y + 1, z) !== B.AIR || ![B.SAND, B.SHELL_SAND, B.GRASS].includes(world.get(x, y, z))) continue; // (a rope arch's reef or a palm there is no way out)
      const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => surf[idx(x + dx, z + dz)] < SEA && world.get(x + dx, SEA, z + dz) === B.WATER);
      if (!wet) continue;
      exits.push({ kind: 'beach', x: x + 0.5, z: z + 0.5, isle: i.id });
      break;
    }
  }

  /* 7. the sea floor: coral and reef rocks (never above y 10), shells on the beaches */
  for (let x = 2; x < W - 2; x++) for (let z = 2; z < D - 2; z++) {
    const y = surf[idx(x, z)];
    if (reserved.has(idx(x, z))) continue;
    if (y <= 8 && !owner[idx(x, z)] && world.get(x, y + 1, z) === B.WATER) {
      const r = rand();
      if (r < 0.012) put(world, x, y + 1, z, B.CORAL);
      else if (r < 0.016) { put(world, x, y + 1, z, B.COBBLE); if (rand() < 0.5) put(world, x, y + 2, z, B.COBBLE); }
    } else if (y >= SEA + 1 && world.get(x, y, z) === B.SAND && rand() < 0.07) put(world, x, y, z, B.SHELL_SAND);
  }

  reserve(isleOf('start').x, isleOf('start').z + 8, 5); // the way back and the arrival: no palms in the way
  reserve(LOOKOUT.x - 3, LOOKOUT.z, 7); // the lookout tower and its steps (built below)
  /* 8. palms on the plateaus and beaches (a creature island has many), the lookout tower, a parrot statue */
  const palms = [];
  const palm = (x, z, h) => {
    const y0 = surf[idx(x, z)] + 1, leans = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => !reserved.has(idx(x + dx, z + dz)));
    if (!leans.length) return;
    const lean = leans[Math.floor(rand() * leans.length)]; // the top leans one cell: never into a reserved strip
    for (let k = 0; k < h; k++) put(world, x + (k >= h - 2 ? lean[0] : 0), y0 + k, z + (k >= h - 2 ? lean[1] : 0), B.PALM_LOG);
    const tx = x + lean[0], tz = z + lean[1], ty = y0 + h - 1;
    for (const [dx, dz, dy] of [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [2, 0, -1], [-2, 0, -1], [0, 2, -1], [0, -2, -1], [1, 1, 0], [-1, -1, 0], [1, -1, 0], [-1, 1, 0]]) {
      if (world.get(tx + dx, ty + dy, tz + dz) === B.AIR) put(world, tx + dx, ty + dy, tz + dz, B.PALM_LEAVES);
    }
    palms.push([x, z]);
  };
  for (const i of isles.filter(q => q.kind === 'beach')) {
    const want = i.id === 'palm' ? 22 : i.id === 'start' ? 7 : 5;
    for (let tries = 0; tries < 400 && palms.filter(p => Math.hypot(p[0] - i.x, p[1] - i.z) <= i.r).length < want; tries++) {
      const a = rand() * 6.283, rr = (0.25 + rand() * 0.75) * (i.P + 2);
      const x = Math.floor(i.x + Math.cos(a) * rr), z = Math.floor(i.z + Math.sin(a) * rr), y = surf[idx(x, z)];
      if (reserved.has(idx(x, z)) || y < i.top - 1 || y > i.top || owner[idx(x, z)] !== i.id) continue;
      if (palms.some(p => Math.hypot(p[0] - x, p[1] - z) < 3.2)) continue;
      palm(x, z, 4 + Math.floor(rand() * 3));
    }
  }
  { // the lookout tower: four log posts, a plank platform 6 up, plank steps down to the west
    const t = top('lookout'), { x, z } = LOOKOUT;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let k = 1; k <= 6; k++) put(world, x + dx, t + k, z + dz, B.LOG);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(world, x + dx, t + 6, z + dz, B.PLANKS);
    for (let c = 1; c <= 5; c++) for (let k = 1; k <= 6 - c; k++) put(world, x - 1 - c, t + k, z, B.PLANKS);
    keep('lookout-tower', { x0: x - 7, x1: x + 1, y0: t, y1: t + 9, z0: z - 1, z1: z + 1 }, 'The lookout tower is part of the picture.');
  }

  /* 9. the way back, the Boss's rest, the islands' rest spots */
  const start = isleOf('start');
  buildWayBack(world, 'pirate', { x: start.x, y: start.top, z: start.z + 9, facing: [0, -1] });
  const rests = world.rests;
  for (const i of isles) {
    const cell = (() => {
      for (let rr = 0; rr <= i.r0 - 1; rr++) for (let a = 0; a < 12; a++) {
        const x = Math.round(i.x + Math.cos(a / 12 * 6.283) * rr), z = Math.round(i.z + Math.sin(a / 12 * 6.283) * rr);
        if (reserved.has(idx(x, z)) || surf[idx(x, z)] !== i.top || world.get(x, i.top + 1, z) !== B.AIR || world.get(x, i.top + 2, z) !== B.AIR) continue;
        return [x, z];
      }
      return [i.x, i.z];
    })();
    rests.push([cell[0] + 0.5, i.top + 1, cell[1] + 0.5, 0]);
  }
  rests.push([110.5, SHIP.deck + 1, 51.5, 0]);
  // people: Deckhand Dot beside the first rope, Lookout Lou under the tower (Fin is on the ship, placed by buildShip)
  placeCrew(world, 'pirate', 0, { x: 106, y: top('perch'), z: 136, facing: [1, 0] });
  placeCrew(world, 'pirate', 1, { x: 110, y: top('lookout'), z: 92, facing: [-1, 0] });
  for (const k of keeps) world.keeps.push(k);

  /* 10. what the realm knows about itself */
  const walks = WALKS.map(w => [...w]);
  world.pirate = { isles, cannons, ropes, walks, ship: { ...ship, box: ship.box }, exits, dockEnd: [Math.max(SHIP.dock.x0, dockEnd - 1), SHIP.dock.z0], lookout: LOOKOUT, reserved: [...reserved] };
  world.realmBiome = (x, z) => (world.ground[Math.floor(x) + Math.floor(z) * W] < SEA ? 'pirateSea' : 'pirate');
  world.parts.push({ id: 'seas', live: 'pirate' });
}
