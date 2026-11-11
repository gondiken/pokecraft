// Chapter 3 (plans/chapter3-world.md, step 2): Wobbleland, the Wizard's very first drawing, as terrain data (realm `wobble`, 224 x 224,
// parent `swirl`). Node-runnable: needs only a world with W / D / data / ground / index / inBounds / get (tests/wobblecheck.mjs runs it on
// a stand-in). The same for every seed (a hand-made land: every patch spot is checked in Node).
//
// The first slice (section 4): Inkpot Camp at the south edge (the way back up to the Wizard's island, the healer), Puddle Meadow (soft bulgy
// hills, leaning and corkscrew trees, big puddles, a right-angle river, a giant flower, a cloud stuck on a hill, a house drawn too small
// with a huge door, stairs to nowhere) with its five scribbled patches and its knot, and the Scribble's wall that closes the rest of the
// page (Bumpy Hills, the Big Knot) until the knot is cleared. The whole map is a keep (nothing can be built: the Wizard's drawing).
// The look (the curling page, the first-draft colours, grey where the Scribble is) is drawn by wobblelook.js; nothing here is a look.
import { B, WOOL } from './blocks.js';
import { kit, buildWayBack } from './picturelands.js';

export const SIZE = 224;
export const BASE = 10;                                       // the plain ground's top block
export const CAMP = { x: 112, z: 204, r: 13 };                 // Inkpot Camp: a flat coloured clearing
export const STAIR = { x: 112, z: 217, top: BASE + 3 };        // the way back: a paper frame on a little hill of steps, facing north
export const HEALER = { x: 104.5, z: 199.5 };                  // world.healer stands here (a fully coloured spot)
export const WIZARD_SPOT = { x: 119.5, z: 199.5 };             // the Wizard at the Camp (his lines, step 6)
export const WALL = { z0: 120, z1: 121, h: 12 };               // the Scribble's wall: x 0..223, ground .. ground + h
export const REGIONS = {
  meadow: { name: 'Puddle Meadow', z0: WALL.z1 + 1, z1: SIZE - 1 },
  hills: { name: 'Bumpy Hills', z0: 0, z1: WALL.z0 - 1, soon: true },
};
export const KNOT = { x: 112, z: 62 };                          // the Big Knot (the end of the chapter) in the middle of the closed page
export const RING = 10;                                         // the fight's ring (scribblefight.js FIGHT.R): patches are checked with it
// The patches (append-only ids: a cleared patch saves `pw:wobble:patch<id>`). size: smudge 2 monsters, tangle 3-4, knot 4 + a Grumble.
// `wet`: a puddle inside the ring (the water twist: everyone swims slowly, Water creatures at full speed).
export const PATCHES = [
  { id: 1, x: 112, z: 178, size: 'smudge', region: 'meadow', species: ['sproutle', 'hopsy'] },
  { id: 2, x: 72, z: 168, size: 'smudge', region: 'meadow', species: ['beetlet', 'chirpit'] },
  { id: 3, x: 154, z: 162, size: 'tangle', region: 'meadow', species: ['flutterby', 'ripplet', 'kiteling'] },
  { id: 4, x: 46, z: 142, size: 'tangle', region: 'meadow', species: ['bubbuck', 'jellume', 'budling'], wet: true },
  { id: 5, x: 180, z: 140, size: 'tangle', region: 'meadow', species: ['hornbeetle', 'woolumph', 'balloony', 'mossloth'] },
  { id: 6, x: 112, z: 140, size: 'knot', region: 'meadow', species: ['thornox', 'gullop', 'monarchwing', 'bounceroo'], grumble: 'grovebeast', last: true },
];
export const patchKey = id => `pw:wobble:patch${id}`;
export const patchOf = id => PATCHES.find(p => p.id === id) ?? null;

// Soft bulgy hills: round bumps (x, z, height, width). Hand-placed, away from the patch rings (each ring is flattened anyway).
const BULGES = [
  [90, 190, 4, 7], [140, 188, 5, 8], [60, 196, 6, 9], [170, 200, 5, 8], [96, 156, 6, 8], [132, 176, 4, 6], [30, 172, 7, 9],
  [196, 172, 7, 9], [86, 128, 5, 7], [146, 132, 6, 8], [20, 128, 6, 8], [206, 128, 5, 7], [130, 156, 3, 5], [66, 140, 4, 6],
  // beyond the wall (Bumpy Hills): taller, the next region's ground
  [40, 90, 9, 10], [80, 100, 7, 9], [150, 96, 10, 11], [190, 80, 8, 10], [60, 40, 10, 12], [170, 30, 9, 11], [112, 20, 6, 9],
];
// Big puddles (x, z, radius): water at the ground's height, one block deep.
export const PUDDLES = [[92, 180, 3.5], [130, 168, 3], [44, 146, 3.2], [206, 150, 4], [24, 160, 3.5], [160, 186, 2.6]];
// A river drawn with a ruler that kept slipping: right-angle zigzags, two blocks wide, east edge -> the puddle at (206, 150).
export const RIVER = [[223, 190], [210, 190], [210, 176], [198, 176], [198, 162], [206, 162], [206, 150]];
// Wonky things (the Wizard's beginner drawing): x, z and their own numbers
export const TREES = [ // lean: blocks sideways per block up (dx, dz); twist: a corkscrew trunk
  { x: 96, z: 196, h: 7, lean: [0.45, 0] }, { x: 128, z: 194, h: 6, lean: [-0.4, 0.2] }, { x: 84, z: 172, h: 8, twist: true },
  { x: 140, z: 176, h: 7, lean: [0, -0.5] }, { x: 58, z: 182, h: 6, lean: [0.5, 0.5] }, { x: 166, z: 176, h: 8, twist: true },
  { x: 30, z: 150, h: 7, lean: [-0.5, 0] }, { x: 196, z: 156, h: 6, lean: [0.35, -0.35] }, { x: 96, z: 134, h: 9, twist: true },
  { x: 128, z: 128, h: 7, lean: [0.5, 0] }, { x: 64, z: 156, h: 6, lean: [0, 0.5] }, { x: 160, z: 146, h: 7, lean: [-0.45, 0.2] },
  { x: 16, z: 196, h: 8, twist: true }, { x: 208, z: 196, h: 7, lean: [-0.5, -0.3] },
];
export const FLOWER = { x: 140, z: 202, stem: 13, petal: 4 };       // a flower taller than a house
export const CLOUD_HILL = { x: 30, z: 172 };                        // a cloud stuck on a hilltop (on the bulge there)
export const SMALL_HOUSE = { x: 60, z: 206, w: 4, d: 4, h: 3 };     // a house drawn too small, with a door far too big for it
export const STAIRS_NOWHERE = { x: 192, z: 206, n: 8 };             // stone steps climbing into the air
export const MUSHROOM = { x: 196, z: 186, stalk: 4, cap: 4 };       // a mushroom-shaped hill

const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
// The ground's height at (x, z) (pure: the checks and the look use it too). Patch rings are flat (a gentle edge outside them), the Camp is flat.
export function heightAt(x, z) {
  let h = 0;
  for (const [bx, bz, a, w] of BULGES) { const d2 = ((x - bx) ** 2 + (z - bz) ** 2) / (w * w); if (d2 < 9) h += a * Math.exp(-d2); }
  let flat = 1 - smooth(CAMP.r, CAMP.r + 8, Math.hypot(x - CAMP.x, z - CAMP.z));
  for (const p of PATCHES) flat = Math.max(flat, 1 - smooth(RING + 1, RING + 7, Math.hypot(x - p.x, z - p.z)));
  return BASE + Math.round(h * (1 - flat));
}
const inPuddle = (x, z) => PUDDLES.some(([px, pz, r]) => Math.hypot(x + 0.5 - px, z + 0.5 - pz) <= r);
function onRiver(x, z) {
  for (let i = 0; i + 1 < RIVER.length; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    if (az === bz && z >= az && z <= az + 1 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx) + 1) return true;
    if (ax === bx && x >= ax && x <= ax + 1 && z >= Math.min(az, bz) && z <= Math.max(az, bz) + 1) return true;
  }
  return false;
}

export function wobbleLand(world) {
  const { W, D } = world;
  kit(world);
  const put = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  // the ground
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const y = heightAt(x, z), wet = inPuddle(x, z) || onRiver(x, z);
    for (let k = 0; k <= y; k++) put(x, k, z, k === y ? (wet ? B.WATER : B.GRASS) : k >= y - 3 ? (k === y - 1 && wet ? B.SAND : B.DIRT) : B.STONE);
    world.ground[x + z * W] = y;
  }
  // the water twist: a puddle in each wet patch's ring, off its middle (where the fight starts you stand dry)
  for (const p of PATCHES.filter(q => q.wet)) for (let dx = -4; dx <= 4; dx++) for (let dz = -3; dz <= 3; dz++) {
    if (Math.hypot(dx / 4, dz / 3) > 1) continue;
    const x = p.x - 4 + dx, z = p.z + dz;
    put(x, heightAt(x, z), z, B.WATER); put(x, heightAt(x, z) - 1, z, B.SAND);
  }
  // Inkpot Camp: a round clearing of colour: a ring of every first-draft wool, planks in the middle
  const camp = [WOOL.fire, WOOL.electric, WOOL.grass, WOOL.water, WOOL.pixie, WOOL.light];
  for (let x = CAMP.x - CAMP.r; x <= CAMP.x + CAMP.r; x++) for (let z = CAMP.z - CAMP.r; z <= CAMP.z + CAMP.r; z++) {
    const d = Math.hypot(x + 0.5 - CAMP.x, z + 0.5 - CAMP.z);
    if (d > CAMP.r) continue;
    const a = Math.atan2(z + 0.5 - CAMP.z, x + 0.5 - CAMP.x);
    put(x, BASE, z, d > CAMP.r - 1.5 ? camp[Math.floor((a + Math.PI) / (2 * Math.PI) * 24) % camp.length] : d < 4 ? B.PLANKS : B.GRASS);
  }
  // the way back: steps up to a paper frame (the Swirl's way back) on a little platform, facing north into the Camp
  for (let k = 1; k <= 3; k++) for (let x = STAIR.x - 3; x <= STAIR.x + 3; x++) for (let z = STAIR.z - 7 + 2 * k; z <= STAIR.z + 2; z++) put(x, BASE + k, z, B.STONE_BRICKS);
  buildWayBack(world, 'wobble', { x: STAIR.x, y: STAIR.top, z: STAIR.z, facing: [0, -1] });
  world.arrivals.wobble = [CAMP.x + 0.5, BASE + 1, CAMP.z + 2.5, 0]; // you arrive in the Camp, looking north at Puddle Meadow (yaw 0)
  world.rests.length = 0; world.rests.push(world.arrivals.wobble);      // a lost fight rests you at the Camp (realms.lost: the nearest rest)
  world.healer = { x: HEALER.x, y: BASE + 1, z: HEALER.z, heading: Math.PI };
  // the Scribble's wall across the whole page: dark scribble wool from the ground to h above the highest ground near it
  for (let x = 0; x < W; x++) for (let z = WALL.z0; z <= WALL.z1; z++) {
    const g = heightAt(x, z);
    for (let y = g + 1; y <= BASE + WALL.h + 6; y++) put(x, y, z, (x * 7 + y * 3 + z) % 5 === 0 ? WOOL.ghost : WOOL.ninja);
  }
  // wonky things
  for (const t of TREES) {
    const g = heightAt(t.x, t.z);
    let tx = t.x, tz = t.z;
    for (let k = 1; k <= t.h; k++) {
      if (t.twist) { tx = t.x + Math.round(Math.cos(k * 1.2) * 1.2); tz = t.z + Math.round(Math.sin(k * 1.2) * 1.2); }
      else { tx = t.x + Math.round(k * t.lean[0]); tz = t.z + Math.round(k * t.lean[1]); }
      put(tx, g + k, tz, B.LOG);
    }
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 2; dy++) {
      if (dx * dx + dz * dz + (dy - 1) * (dy - 1) * 2 > 6) continue;
      if (world.get(tx + dx, g + t.h + dy, tz + dz) === B.AIR) put(tx + dx, g + t.h + dy, tz + dz, B.LEAVES);
    }
  }
  { const f = FLOWER, g = heightAt(f.x, f.z);
    for (let k = 1; k <= f.stem; k++) put(f.x, g + k, f.z, WOOL.grass);
    for (let dx = -f.petal; dx <= f.petal; dx++) for (let dz = -f.petal; dz <= f.petal; dz++) {
      const d = Math.hypot(dx, dz);
      if (d <= f.petal) put(f.x + dx, g + f.stem + 1, f.z + dz, d < 1.5 ? WOOL.electric : WOOL.pixie);
    } }
  { const c = CLOUD_HILL, g = heightAt(c.x, c.z);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 1; dy <= 2; dy++) if (Math.hypot(dx / 3, dz / 2, (dy - 1) / 1.5) <= 1) put(c.x + dx, g + dy, c.z + dz, B.CLOUD); }
  { const s = SMALL_HOUSE, g = heightAt(s.x, s.z);
    for (let dx = 0; dx < s.w; dx++) for (let dz = 0; dz < s.d; dz++) for (let k = 1; k <= s.h + 1; k++) {
      const edge = dx === 0 || dz === 0 || dx === s.w - 1 || dz === s.d - 1;
      put(s.x + dx, g + k, s.z + dz, k === s.h + 1 ? B.BRICK : edge ? B.PLANKS : B.AIR);
    }
    // the huge door: taller than the house (a door frame of logs sticking out over the roof, the opening right through)
    for (let k = 1; k <= s.h + 3; k++) { put(s.x, g + k, s.z + 1, k <= s.h ? B.AIR : B.LOG); put(s.x, g + k, s.z + 2, k <= s.h ? B.AIR : B.LOG); }
    for (const dz of [0, 3]) for (let k = 1; k <= s.h + 3; k++) put(s.x - 1, g + k, s.z + dz, B.LOG); }
  { const s = STAIRS_NOWHERE, g = heightAt(s.x, s.z);
    for (let k = 0; k < s.n; k++) for (let y = g + 1; y <= g + 1 + k; y++) for (const dx of [0, 1]) put(s.x + dx, y, s.z - k, B.STONE_BRICKS); }
  { const m = MUSHROOM, g = heightAt(m.x, m.z);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let k = 1; k <= m.stalk; k++) put(m.x + dx, g + k, m.z + dz, B.SANDSTONE);
    for (let dx = -m.cap; dx <= m.cap; dx++) for (let dz = -m.cap; dz <= m.cap; dz++) if (Math.hypot(dx, dz) <= m.cap + 0.3) put(m.x + dx, g + m.stalk + 1, m.z + dz, WOOL.fire); }
  // where the Scribble is: the patches (scribble.js draws them; their keys say which are cleared), the regions, the wall
  const wallBox = { x0: 0, x1: W - 1, y0: 0, y1: 47, z0: WALL.z0, z1: WALL.z1 };
  world.wobble = { patches: PATCHES.map(p => ({ ...p, y: heightAt(p.x, p.z) + 1 })), wall: wallBox, camp: { ...CAMP, y: BASE + 1 }, regions: REGIONS, knot: KNOT };
  world.keeps.push({ name: 'wobble', protect: [{ x0: 0, x1: W - 1, y0: 0, y1: 47, z0: 0, z1: D - 1 }], wallText: "This is the Wizard's drawing. No building here!", rideText: "No riding in the Wizard's drawing!" });
  world.keeps.push({ name: 'scribble-wall', protect: [wallBox], wallText: 'The Scribble walled this off. Clear Puddle Meadow first!' });
  world.realmBiome = (x, z) => (z > WALL.z1 ? 'wobble' : 'wobbleHills');
  world.spawnAt = world.arrivals.wobble;
  return world;
}

// The guide in Wobbleland (step 6 fills in the patches through scribble.js; until then: the nearest uncleared patch, else the way back).
export function wobbleAim(world, p, game) {
  const keys = game?.beaten || [];
  const open = (world.wobble?.patches || []).filter(q => !keys.includes(patchKey(q.id)));
  const q = open.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (q) return { x: q.x + 0.5, z: q.z + 0.5, text: (a, m) => `✏️ ${q.size === 'knot' ? 'Knot' : q.size === 'tangle' ? 'Tangle' : 'Smudge'} ${a} ${m}m` };
  const d = world.doors?.[0]?.stand;
  return d ? { x: d[0], z: d[2], text: (a, m) => `🖼️ Way back ${a} ${m}m` } : null;
}
