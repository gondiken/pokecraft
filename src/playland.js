// T40: Playland, the Picture World behind the Race Track and Ball Stadium frames (and the Funfair in wave 15). One flat world
// (224 x 224) cut into zones: a promenade (the hub) across the middle with the ways back, and a zone each for the race, the
// stadium and the funfair. The hub is base-owned; every zone has a part builder that writes only inside its own zone box.
// Needs only a world with W / D / data / ground / index / inBounds / get (the spec runs it in Node).
import { B, WOOL } from './blocks.js';
import { PICTURE_WORLDS } from './pictureworlds.js';
import { kit, flatLand, buildWayBack, placeBoss } from './picturelands.js';
import { buildRaceTrack, RACER_SPAWNS, RACE_WALK } from './racetrack.js'; // T40c

export const PLAYLAND = { size: [224, 224], y: 10 };       // ground top y 10 (you stand at 11)
export const HUB = { x0: 8, x1: 215, z0: 96, z1: 131 };     // the promenade across the middle: base-owned
export const ZONES = {
  // gate = the way-back door in the hub: (x, z) its middle, `facing` = the way its front looks (towards the zone)
  race:    { box: { x0: 8, x1: 215, z0: 8, z1: 95 },    gate: { x: 112, z: 104, facing: [0, -1] } },   // 208 x 88: a loop track
  stadium: { box: { x0: 8, x1: 107, z0: 132, z1: 215 }, gate: { x: 58, z: 123, facing: [0, 1] } },     // 100 x 84: pitch + court + stands
  fair:    { box: { x0: 116, x1: 215, z0: 132, z1: 215 }, gate: { x: 166, z: 123, facing: [0, 1] } },  // wave 15
};
export const PLAYLAND_ZONE_NAMES = { hub: 'Playland', race: 'Playland · Race Track', stadium: 'Playland · Ball Stadium', fair: 'Playland · Funfair' };

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
const fill = (world, x0, x1, z0, z1, y, id) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) put(world, x, y, z, id); };

// Stand-in parts (T40c / T40d replace them): a checkered start line with the Boss, a green pitch with the Boss.
function raceStub(world, zone) {
  const y = PLAYLAND.y, mx = (zone.box.x0 + zone.box.x1 + 1) >> 1;
  for (let x = mx - 4; x <= mx + 4; x++) for (let z = 82; z <= 86; z++) put(world, x, y, z, (x + z) % 2 ? WOOL.ninja : WOOL.rainbow);
  placeBoss(world, 'race', { x: mx, y, z: 88, facing: [0, 1] });
}
function stadiumStub(world) {
  const y = PLAYLAND.y, mx = 58, mz = 174;
  fill(world, mx - 10, mx + 9, mz - 6, mz + 5, y, WOOL.grass);
  for (let x = mx - 10; x <= mx + 9; x++) { put(world, x, y, mz - 6, WOOL.rainbow); put(world, x, y, mz + 5, WOOL.rainbow); }
  for (let z = mz - 6; z <= mz + 5; z++) { put(world, mx - 10, y, z, WOOL.rainbow); put(world, mx + 9, y, z, WOOL.rainbow); put(world, mx, y, z, WOOL.rainbow); }
  placeBoss(world, 'stadium', { x: mx + 3, y, z: mz, facing: [0, -1] });
}

// Part builders, by zone: { build(world, zone, def), spawns: [[species, weight, cond?], ...], walk?: [block ids wild creatures walk on] }. Each writes only inside zone.box.
export const PLAYLAND_PARTS = {
  race: { build: buildRaceTrack, spawns: RACER_SPAWNS, walk: RACE_WALK }, // T40c
  stadium: { build: stadiumStub, spawns: [] }, // T40d replaces this line
  fair: null,                                  // wave 15
};
// The realm's wild creature tables by zone (read once by REALMS.playland; creatures read them through world.realmBiome).
export function playlandSpawns() {
  const out = { hub: [], fair: [], cave: [] };
  for (const k of ['race', 'stadium']) out[k] = PLAYLAND_PARTS[k]?.spawns ?? [];
  return out;
}
export function zoneAt(x, z) {
  for (const [k, zn] of Object.entries(ZONES)) { const b = zn.box; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return k; }
  return 'hub';
}

export function playLand(world, def) {
  kit(world);
  const y = PLAYLAND.y;
  flatLand(world, { y });
  // the promenade: a gravel path along the middle, a stone plaza with a fountain
  fill(world, HUB.x0, HUB.x1, 112, 115, y, B.GRAVEL);
  fill(world, 104, 119, 106, 121, y, B.STONE_BRICKS);
  fill(world, 111, 113, 113, 115, y, B.WATER);
  put(world, 112, y + 1, 114, B.LAMP); put(world, 112, y + 2, 114, B.LAMP);
  // a low hedge along the hub's two long edges, with a 7-wide gap in front of each open gate (the Funfair's stays closed)
  const open = PICTURE_WORLDS.filter(pw => pw.realm === 'playland' && ZONES[pw.id] && PLAYLAND_PARTS[pw.id]);
  for (const z of [HUB.z0, HUB.z1]) for (let x = HUB.x0; x <= HUB.x1; x++) {
    if (open.some(pw => { const g = ZONES[pw.id].gate; return Math.abs(x - g.x) <= 3 && (g.facing[1] < 0 ? z === HUB.z0 : z === HUB.z1); })) continue;
    put(world, x, y + 1, z, B.LEAVES);
  }
  // the ways back (the door's front looks towards its zone, so you arrive in the hub looking at the gap in the hedge)
  for (const pw of open) { const g = ZONES[pw.id].gate; buildWayBack(world, pw.id, { x: g.x, y, z: g.z, facing: g.facing }); }
  // the Funfair gate is closed until wave 15: a sign of planks
  const fg = ZONES.fair.gate;
  for (let x = fg.x - 2; x <= fg.x + 2; x++) for (let k = 1; k <= 3; k++) put(world, x, y + k, fg.z, B.PLANKS);
  world.keeps.push({ name: 'fair-sign', protect: [{ x0: fg.x - 2, x1: fg.x + 2, y0: y + 1, y1: y + 3, z0: fg.z, z1: fg.z }], wallText: 'Coming soon!' });
  // the zone parts, each inside its own box
  for (const [k, part] of Object.entries(PLAYLAND_PARTS)) part?.build(world, ZONES[k], def);
  world.extraWalk = Object.values(PLAYLAND_PARTS).flatMap(part => part?.walk ?? []); // a part may name blocks wild creatures walk on in its zone
  world.realmBiome = (x, z) => zoneAt(x, z);
}
