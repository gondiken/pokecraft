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
// Owner 2026-11-11 ("too much empty space", plans/chapter3-world.md A1): Puddle Meadow is a packed box round the Camp (patch centres
// 26-28 apart, a 6-8 s walk) and the next regions sit right behind its walls: Bumpy Hills north, Slippy Lake west, Shadywood east.
export const MEADOW = { x0: 62, x1: 162, z0: 134, z1: SIZE - 1 };
export const WALL = { h: 12, t: 2 };                            // the Scribble's wall round the meadow: 2 thick, ground .. BASE + h + 6
// its three straight pieces (inclusive boxes in x / z): north, west, east
export const WALLS = [
  { x0: MEADOW.x0 - 2, x1: MEADOW.x1 + 2, z0: MEADOW.z0 - 2, z1: MEADOW.z0 - 1 },
  { x0: MEADOW.x0 - 2, x1: MEADOW.x0 - 1, z0: MEADOW.z0 - 2, z1: SIZE - 1 },
  { x0: MEADOW.x1 + 1, x1: MEADOW.x1 + 2, z0: MEADOW.z0 - 2, z1: SIZE - 1 },
];
export const inMeadow = (x, z) => x >= MEADOW.x0 && x <= MEADOW.x1 + 1 && z >= MEADOW.z0 && z <= MEADOW.z1 + 1;
export const REGIONS = {
  meadow: { name: 'Puddle Meadow', biome: 'wobble' },
  hills: { name: 'Bumpy Hills', biome: 'wobbleHills', soon: true },
  lake: { name: 'Slippy Lake', biome: 'wobbleLake', soon: true },
  wood: { name: 'Shadywood', biome: 'wobbleWood', soon: true },
};
export const regionAt = (x, z) => (inMeadow(x, z) ? 'meadow' : z < MEADOW.z0 - 2 ? 'hills' : x < MEADOW.x0 ? 'lake' : 'wood');
export const KNOT = { x: 112, z: 62 };                          // the Big Knot (the end of the chapter) in the middle of the closed page
export const RING = 10;                                         // the fight's ring (scribblefight.js FIGHT.R): patches are checked with it
// The patches (append-only ids: a cleared patch saves `pw:wobble:patch<id>`). size: smudge 3 monsters (2 were always mashable, tests/wobblebots.mjs), tangle 3-4, knot 4 + a Grumble.
// `wet`: a puddle inside the ring (the water twist: everyone swims slowly, Water creatures at full speed). `pot`: the paint pot's colour
// a cleared patch leaves (A3: paint-pot hops, wobblelive.js).
export const PATCHES = [
  { id: 1, x: 112, z: 178, size: 'smudge', region: 'meadow', species: ['sproutle', 'hopsy', 'chirpit'], pot: 0xe8402a },
  { id: 2, x: 86, z: 184, size: 'smudge', region: 'meadow', species: ['beetlet', 'fluffin', 'flutterby'], pot: 0xf2c418 },
  { id: 3, x: 138, z: 184, size: 'tangle', region: 'meadow', species: ['flutterby', 'ripplet', 'kiteling'], pot: 0x2f9be8 },
  { id: 4, x: 84, z: 156, size: 'tangle', region: 'meadow', species: ['bubbuck', 'jellume', 'budling'], wet: true, pot: 0x3fc04a },
  { id: 5, x: 140, z: 156, size: 'tangle', region: 'meadow', species: ['hornbeetle', 'woolumph', 'balloony', 'mossloth'], pot: 0xf07ab8 },
  { id: 6, x: 112, z: 152, size: 'knot', region: 'meadow', species: ['thornox', 'gullop', 'monarchwing', 'bounceroo'], grumble: 'grovebeast', last: true, pot: 0x8a4ee0 },
];
export const CAMP_POT = { x: 120, z: 207, colour: 0xff8a1c };    // A3: the Camp's own paint pot (a hop back home)
export const patchKey = id => `pw:wobble:patch${id}`;
// Freed creatures (step 6): each patch's monsters live in the meadow as wild creatures once it is cleared (the 4th element: wildafter.js).
export const FREED_SPAWNS = PATCHES.flatMap(p => [...p.species, ...(p.grumble ? [p.grumble] : [])].map(sp => [sp, p.grumble === sp ? 0.25 : 1, null, `wobble:${p.id}`]));
// The patches you can fight now: every one not cleared, but a region's knot only once its other patches are clear (step 6: the knot is
// the region's end). The one rule the arrow, "Where to go" and the fight all read.
export function openPatches(beaten, list = PATCHES) {
  const keys = new Set(beaten || []), left = list.filter(p => !keys.has(patchKey(p.id)));
  return left.filter(p => !p.last || !left.some(q => q !== p && q.region === p.region));
}
export const meadowState = beaten => { const keys = new Set(beaten || []), mine = PATCHES.filter(p => p.region === 'meadow'); return { n: mine.filter(p => keys.has(patchKey(p.id))).length, of: mine.length }; };
export const patchOf = id => PATCHES.find(p => p.id === id) ?? null;

// Soft bulgy hills: round bumps (x, z, height, width). Hand-placed, away from the patch rings (each ring is flattened anyway).
const BULGES = [
  [70, 210, 4, 6], [154, 210, 5, 7], [68, 172, 5, 6], [125, 166, 3, 4], [70, 142, 4, 6], [154, 142, 4, 6], [99, 166, 3, 4],
  // beyond the walls: Bumpy Hills (north) taller, the next region's ground; a few round the lake and in the wood
  [40, 90, 9, 10], [80, 100, 7, 9], [150, 96, 10, 11], [190, 80, 8, 10], [60, 40, 10, 12], [170, 30, 9, 11], [112, 20, 6, 9], [112, 112, 5, 8],
  [30, 120, 6, 8], [196, 120, 6, 8], [200, 200, 5, 9], [184, 156, 4, 7],
];
// Big puddles (x, z, radius): water at the ground's height, one block deep.
export const PUDDLES = [[100, 192, 2.5], [124, 190, 2.5], [123, 164, 2.4], [70, 184, 3], [154, 184, 3]];
// Slippy Lake (behind the west wall, for later): a wide lake with two islands (x, z, rx, rz)
export const LAKE = { x: 30, z: 178, rx: 24, rz: 38, isles: [[24, 160, 4], [38, 196, 5]] };
// A river drawn with a ruler that kept slipping: right-angle zigzags, two blocks wide, the east wall -> the puddle at (154, 184).
export const RIVER = [[162, 174], [153, 174], [153, 184]];
// Wonky things (the Wizard's beginner drawing): x, z and their own numbers
export const TREES = [ // lean: blocks sideways per block up (dx, dz); twist: a corkscrew trunk
  { x: 70, z: 196, h: 7, lean: [0.45, 0] }, { x: 154, z: 196, h: 6, lean: [-0.4, 0.2] }, { x: 96, z: 198, h: 8, twist: true },
  { x: 126, z: 196, h: 7, lean: [0, -0.5] }, { x: 68, z: 162, h: 6, lean: [0.5, 0.5] }, { x: 150, z: 170, h: 8, twist: true },
  { x: 98, z: 168, h: 7, lean: [-0.5, 0] }, { x: 126, z: 170, h: 6, lean: [0.35, -0.35] }, { x: 98, z: 140, h: 9, twist: true },
  { x: 126, z: 140, h: 7, lean: [0.5, 0] }, { x: 70, z: 140, h: 6, twist: true }, { x: 154, z: 141, h: 7, lean: [-0.45, 0.2] },
  { x: 66, z: 214, h: 8, twist: true }, { x: 158, z: 214, h: 7, lean: [-0.5, -0.3] },
];
// Shadywood (behind the east wall, for later): a thick wood of tall straight trees
export const WOOD = { x0: 168, x1: 218, z0: 140, z1: 218, step: 7 };
export const FLOWER = { x: 140, z: 206, stem: 13, petal: 4 };       // a flower taller than a house
export const CLOUD_HILL = { x: 68, z: 172 };                        // a cloud stuck on a hilltop (on the bulge there)
export const SMALL_HOUSE = { x: 78, z: 204, w: 4, d: 4, h: 3 };     // a house drawn too small, with a door far too big for it
export const STAIRS_NOWHERE = { x: 146, z: 216, n: 8 };             // stone steps climbing into the air
export const MUSHROOM = { x: 157, z: 160, stalk: 4, cap: 4 };       // a mushroom-shaped hill

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
  world.healer = [HEALER.x, BASE + 1, HEALER.z, 0]; // (npc.js: Healer Stella, as in the Dream and the Portal House)
  // Slippy Lake behind the west wall (for later): a wide lake one block deep with two islands
  for (let x = 0; x < MEADOW.x0 - 2; x++) for (let z = MEADOW.z0; z < D; z++) {
    if (Math.hypot((x + 0.5 - LAKE.x) / LAKE.rx, (z + 0.5 - LAKE.z) / LAKE.rz) > 1 || LAKE.isles.some(([ix, iz, r]) => Math.hypot(x + 0.5 - ix, z + 0.5 - iz) < r)) continue;
    const y = world.ground[x + z * W]; put(x, y, z, B.WATER); put(x, y - 1, z, B.SAND);
  }
  // Shadywood behind the east wall (for later): tall straight trees close together
  for (let x = WOOD.x0; x <= WOOD.x1; x += WOOD.step) for (let z = WOOD.z0; z <= WOOD.z1; z += WOOD.step) {
    const tx = x + ((x * 13 + z * 7) % 3) - 1, tz = z + ((x * 5 + z * 11) % 3) - 1, g = heightAt(tx, tz), h = 9 + ((tx + tz) % 4);
    for (let k = 1; k <= h; k++) put(tx, g + k, tz, B.LOG);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 1; dy++) if (dx * dx + dz * dz + dy * dy < 7 && world.get(tx + dx, g + h + dy, tz + dz) === B.AIR) put(tx + dx, g + h + dy, tz + dz, B.LEAVES);
  }
  // the Scribble's wall round the meadow: dark scribble wool from the ground up (north, west and east of it; the page's edge is south)
  for (const b of WALLS) for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) {
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
  const walls = WALLS.map(b => ({ ...b, y0: 0, y1: 47 }));
  world.wobble = { patches: PATCHES.map(p => ({ ...p, y: heightAt(p.x, p.z) + 1 })), walls, wall: walls[0], camp: { ...CAMP, y: BASE + 1 }, regions: REGIONS, knot: KNOT };
  // B (owner 2026-11-11: "why can't I ride or fly my creature here?"): the page keeps out building, never riders (`rideIn`); the
  // Scribble's wall fences riders out too (its keep has no rideIn). A rider who reaches a patch hops off as the fight starts (scribble.js).
  world.keeps.push({ name: 'wobble', rideIn: true, protect: [{ x0: 0, x1: W - 1, y0: 0, y1: 47, z0: 0, z1: D - 1 }], wallText: "This is the Wizard's drawing. No building here!" });
  world.keeps.push({ name: 'scribble-wall', protect: walls, wallText: 'The Scribble walled this off. Clear Puddle Meadow first!', rideText: 'The Scribble walled this off. Clear Puddle Meadow first!' });
  world.people ??= []; // the Wizard at the Camp (step 6): his words follow your progress (WIZARD_LINES; scribble.js says them on a win)
  world.people.push({ name: 'The Wizard', title: 'The Wizard · Inkpot Camp', colors: { skin: 0xf2c9a0, hair: 0xf4f0ea, shirt: 0x6a3ab8, pants: 0x4a2a90 }, look: 'wizard',
    line: "The Scribble is in my very first drawing. Let's colour it back in! Grey means the Scribble.", pos: [WIZARD_SPOT.x, BASE + 1, WIZARD_SPOT.z], heading: Math.PI });
  world.parts.push({ id: 'wobble', live: 'wobble' }); // wobblelive.js: the paint-pot hops (A3)
  world.realmBiome = (x, z) => REGIONS[regionAt(x, z)].biome;
  world.spawnAt = world.arrivals.wobble;
  return world;
}

// The guide in Wobbleland (step 6 fills in the patches through scribble.js; until then: the nearest uncleared patch, else the way back).
const SIZE_RANK = { smudge: 0, tangle: 1, knot: 2 };
export function wobbleAim(world, p, game) {
  const open = openPatches(game?.beaten, world.wobble?.patches || []);
  const rank = q => SIZE_RANK[q.size] ?? 1; // A1: the packed meadow puts tangles as near as smudges: the arrow shows the small ones first
  const q = open.sort((a, b) => rank(a) - rank(b) || Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (q) return { x: q.x + 0.5, z: q.z + 0.5, text: (a, m) => `✏️ ${q.size === 'knot' ? 'Knot' : q.size === 'tangle' ? 'Tangle' : 'Smudge'} ${a} ${m}m` };
  const d = world.doors?.[0]?.stand;
  return d ? { x: d[0], z: d[2], text: (a, m) => `🖼️ Way back ${a} ${m}m` } : null;
}

// The Paper Door (step 3): a crumpled-paper door in the south wall of the Wizard's tower on his island in the Swirl (world.swirl.wizard),
// drawn only for his Ally (portal.js). Its three-by-three cells and where you stand when you come back up (in front of it, looking south).
export function paperDoor(world) {
  const wz = world?.swirl?.wizard;
  if (!wz?.box) return null;
  const y0 = wz.box.y0, z = wz.box.z1, cells = [];
  for (let dx = -1; dx <= 1; dx++) for (let k = 0; k < 3; k++) cells.push([wz.x + dx, y0 + k, z]);
  return { cells, stand: [wz.x + 0.5, y0, z + 2.5, Math.PI] };
}
// The Wizard's words after a patch is cleared (n = patches cleared in the region, of = how many it has).
export function wizardLine(n, of) {
  if (n >= of) return '🧙 Puddle Meadow is bright again! Next: Bumpy Hills.';
  if (n === 1) return '🧙 You did it! Look, the colour is coming back!';
  if (n === of - 1) return '🧙 Only the big knot is left. Be careful: something grumbles in there!';
  return `🧙 Wonderful! ${of - n} more to go.`;
}
export const PAPER_WORDS = {
  prompt: how => `The Paper Door · ${how} to go down`, action: 'Down!',
  first: "The Scribble is in my very first drawing. Let's colour it back in!",
};
