// T40: the shared kit for Picture World terrains (the realms behind the Swirl's picture frames): flat land, the way back
// (an upright picture frame you step into to return to the Swirl), the Boss's stand, helpers' spots and the guide arrow.
// The KIT part belongs to the base; the STUBS part (flat stand-in worlds) is deleted piece by piece as T40a / T40b register
// their real terrains. Imports only blocks.js and pictureworlds.js and needs only a world with
// W / D / data / ground / index / inBounds / get (the spec runs it on a stand-in in Node, like dreamland.js).
import { B } from './blocks.js';
import { pictureWorld } from './pictureworlds.js';

const WORLD_H = 48;

// Makes sure the lists a Picture World terrain fills exist (World does not know about them); returns the world.
export function kit(world) {
  world.doors ??= [];       // the ways back: { key, surface, box, stand } (world.door = the first one; portal.js draws a DoorGlow on each)
  world.arrivals ??= {};    // where you arrive, by PICTURE_WORLDS id: [x, y, z, yaw]
  world.rests ??= [];       // spots you wake up at after losing a battle: [x, y, z, yaw]
  world.bosses ??= [];      // { id, pos, heading, rest, crew: [{ i, pos, heading }] }
  world.parts ??= [];       // live parts (gymlive.js): { id, live, ... }
  world.keeps ??= [];       // boxes nobody can build in: { name, protect: [box], wallText }
  return world;
}

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };

// Every column: stone down to y - 4, `under` y - 3 .. y - 1, `top` at y. world.ground = y.
export function flatLand(world, { y = 10, top = B.GRASS, under = B.DIRT, deep = B.STONE } = {}) {
  const { W, D } = world;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    for (let k = 0; k <= y; k++) put(world, x, k, z, k === y ? top : k >= y - 3 ? under : deep);
    world.ground[x + z * W] = y;
  }
  return world;
}

// An upright picture frame on the ground at (x, z), floor top y (you stand at y + 1), `facing` = [fx, fz] (the way its front looks).
// Posts PICTURE_FRAME at side -2 / +2 (y + 1 .. y + 5), lintel at y + 5, WAY_BACK surface side -1..1 x y + 1 .. y + 4 (12 cells).
// Clears air 3 wide x 3 high for 4 cells in front. You arrive 3 cells in front, looking away from it.
export function buildWayBack(world, key, { x, y, z, facing }) {
  kit(world);
  const [fx, fz] = facing, side = [fz, fx];
  const at = (d, s) => [x + fx * d + side[0] * s, z + fz * d + side[1] * s];
  for (let d = 1; d <= 4; d++) for (let s = -1; s <= 1; s++) for (let k = 1; k <= 3; k++) { const [cx, cz] = at(d, s); put(world, cx, y + k, cz, B.AIR); }
  for (let k = 1; k <= 5; k++) for (const s of [-2, 2]) { const [cx, cz] = at(0, s); put(world, cx, y + k, cz, B.PICTURE_FRAME); }
  for (let s = -1; s <= 1; s++) { const [cx, cz] = at(0, s); put(world, cx, y + 5, cz, B.PICTURE_FRAME); }
  const surface = [];
  for (let s = -1; s <= 1; s++) for (let k = 1; k <= 4; k++) { const [cx, cz] = at(0, s); put(world, cx, y + k, cz, B.WAY_BACK); surface.push([cx, y + k, cz]); }
  const [a, b] = [at(-1, -2), at(1, 2)];
  const box = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: y, y1: y + 6, z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  const stand = [x + 3 * fx + 0.5, y + 1, z + 3 * fz + 0.5, Math.atan2(-fx, -fz)];
  const door = { key, surface, box, stand };
  world.doors.push(door);
  world.door = world.doors[0];
  world.arrivals[key] = stand;
  world.rests.push(stand);
  world.keeps.push({ name: `door-${key}`, protect: [box], wallText: 'This is the way back to the Swirl!' });
  return door;
}

// The Boss's stand: a BOSS_STAND block at (x, y, z) (the block the Boss stands on), air 2 above. `facing` = the way the Boss looks;
// the rest spot (where you wake up after a lost battle) is 3 in front of it.
export function placeBoss(world, id, { x, y, z, facing }) {
  kit(world);
  const [fx, fz] = facing;
  put(world, x, y, z, B.BOSS_STAND);
  put(world, x, y + 1, z, B.AIR); put(world, x, y + 2, z, B.AIR);
  const entry = { id, pos: [x + 0.5, y + 1, z + 0.5], heading: Math.atan2(fx, fz), rest: [x + 0.5 + 3 * fx, y + 1, z + 0.5 + 3 * fz, Math.atan2(fx, fz)], crew: [] };
  world.bosses.push(entry);
  world.rests.push(entry.rest);
  world.keeps.push({ name: `boss-${id}`, protect: [{ x0: x, x1: x, y0: y, y1: y + 2, z0: z, z1: z }], wallText: 'The Boss stands here!' });
  return entry;
}

// Crew person i (0-based) of the Boss `id` (pictureboss.js) stands at (x, y + 1, z) facing `facing`. No block is placed.
export function placeCrew(world, id, i, { x, y, z, facing }) {
  const boss = world.bosses?.find(b => b.id === id);
  if (!boss) return null;
  const c = { i, pos: [x + 0.5, y + 1, z + 0.5], heading: Math.atan2(facing[0], facing[1]) };
  boss.crew.push(c);
  return c;
}

// The guide in a Picture World: the Boss of `via` (else the nearest Boss) whose star you have not got, else the nearest way back.
const arrow = (p, x, z) => { const a = Math.atan2(x - p.x, z - p.z); return a; };
export function pictureAim(world, p, { stars = [], via = null } = {}) {
  const near = list => list.reduce((best, c) => (!best || Math.hypot(c.x - p.x, c.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? c : best), null);
  const open = (world.bosses || []).filter(b => !stars.includes(b.id)).map(b => ({ x: b.pos[0], z: b.pos[2], id: b.id }));
  const mine = open.find(b => b.id === via);
  const c = mine ?? near(open);
  if (c) { const pw = pictureWorld(c.id); return { x: c.x, z: c.z, text: (a, m) => `⭐ ${pw?.emoji ?? ''} ${pw?.name ?? 'Boss'} Boss ${a} ${m}m` }; }
  const doors = (world.doors || []).map(d => { const s = d.surface[Math.floor(d.surface.length / 2)]; return { x: s[0] + 0.5, z: s[2] + 0.5 }; });
  const d = near(doors);
  if (!d) return null;
  if (Math.hypot(d.x - p.x, d.z - p.z) < 3) return { x: d.x, z: d.z, text: () => 'Way back: step in to go to the Swirl' };
  return { x: d.x, z: d.z, text: (a, m) => `🖼️ Way back ${a} ${m}m` };
}

/* ---- The stand-in worlds (64 x 64, flat): each task deletes its line when it registers its real terrain. ---- */
export const STUBS = {
};
export function pictureStub(world, def) {
  const s = STUBS[def.id] ?? { door: [32, 34, [0, 1]], boss: [32, 52, [0, -1]] }; // T40a, T40b: every picture realm has its own terrain now (kept for tests and wave 15)
  kit(world);
  flatLand(world, { y: 10, top: s.top ?? B.GRASS });
  buildWayBack(world, def.id, { x: s.door[0], y: 10, z: s.door[1], facing: s.door[2] });
  const boss = placeBoss(world, def.id, { x: s.boss[0], y: 10, z: s.boss[1], facing: s.boss[2] });
  // a 5 x 5 square of planks in front of the Boss, so the stand-in is not just grass
  const [rx, , rz] = boss.rest;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) put(world, Math.floor(rx) + dx, 10, Math.floor(rz) + dz, B.PLANKS);
}
