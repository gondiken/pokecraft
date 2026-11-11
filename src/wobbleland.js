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
import { GROUND } from './groundrules.js'; // Slippy Lake: the ice's rule (the player and the fight both ask world.groundAt)

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
// its straight pieces (inclusive boxes in x / z): north, west, east, and the lake's north side. `to` = the region behind it: a wall melts
// when that region opens (Slippy Lake: the meadow's knot; Shadywood: the lake's knot; Bumpy Hills: later), one region at a time.
export const WALLS = [
  { x0: MEADOW.x0 - 2, x1: MEADOW.x1 + 2, z0: MEADOW.z0 - 2, z1: MEADOW.z0 - 1, to: 'hills' },
  { x0: MEADOW.x0 - 2, x1: MEADOW.x0 - 1, z0: MEADOW.z0, z1: SIZE - 1, to: 'lake' }, // (from z0: the corner stays the north wall's)
  { x0: MEADOW.x1 + 1, x1: MEADOW.x1 + 2, z0: MEADOW.z0, z1: SIZE - 1, to: 'wood' },
  { x0: 0, x1: MEADOW.x0 - 3, z0: MEADOW.z0 - 2, z1: MEADOW.z0 - 1, to: 'hills' },
];
export const inMeadow = (x, z) => x >= MEADOW.x0 && x <= MEADOW.x1 + 1 && z >= MEADOW.z0 && z <= MEADOW.z1 + 1;
// The regions in the order they open: `after` = the region whose knot opens this one (its wall melts); `soon` = still being drawn.
export const REGIONS = {
  meadow: { name: 'Puddle Meadow', biome: 'wobble' },
  lake: { name: 'Slippy Lake', biome: 'wobbleLake', after: 'meadow' },
  wood: { name: 'Shadywood', biome: 'wobbleWood', after: 'lake', soon: true },
  hills: { name: 'Bumpy Hills', biome: 'wobbleHills', after: 'wood', soon: true },
};
export const regionAt = (x, z) => (inMeadow(x, z) ? 'meadow' : z < MEADOW.z0 - 2 ? 'hills' : x < MEADOW.x0 ? 'lake' : 'wood');
export const KNOT = { x: 112, z: 62 };                          // the Big Knot (the end of the chapter) in the middle of the closed page
export const RING = 10;                                         // the fight's ring (scribblefight.js FIGHT.R): patches are checked with it
// The patches (append-only ids: a cleared patch saves `pw:wobble:patch<id>`). size: smudge 3 monsters (2 were always mashable, tests/wobblebots.mjs), tangle 3-4, knot 4 + a Grumble.
// `wet`: a puddle inside the ring (the water twist: everyone swims slowly, Water creatures at full speed). `pot`: the paint pot's colour
// a cleared patch leaves (A3: paint-pot hops, wobblelive.js).
export const PATCHES = [
  // Puddle Meadow
  { id: 1, x: 112, z: 178, size: 'smudge', region: 'meadow', species: ['sproutle', 'hopsy', 'chirpit'], pot: 0xe8402a },
  { id: 2, x: 86, z: 184, size: 'smudge', region: 'meadow', species: ['beetlet', 'fluffin', 'flutterby'], pot: 0xf2c418 },
  { id: 3, x: 138, z: 184, size: 'tangle', region: 'meadow', species: ['flutterby', 'ripplet', 'kiteling'], pot: 0x2f9be8 },
  { id: 4, x: 84, z: 156, size: 'tangle', region: 'meadow', species: ['bubbuck', 'jellume', 'budling'], wet: true, pot: 0x3fc04a },
  { id: 5, x: 140, z: 156, size: 'tangle', region: 'meadow', species: ['hornbeetle', 'woolumph', 'balloony', 'mossloth'], pot: 0xf07ab8 },
  { id: 6, x: 112, z: 152, size: 'knot', region: 'meadow', species: ['thornox', 'gullop', 'monarchwing', 'bounceroo'], grumble: 'grovebeast', last: true, pot: 0x8a4ee0 },
  // Slippy Lake (owner 2026-11-11: the ground decides the fight): every ring is on the ice, so everyone slides but Ice creatures. One Ice
  // monster in each (it keeps its grip), the rest the lake's Bubble ducks and Sky birds and a Water one where there is open water (Ice
  // moves do half to Water and Ice: a lake of Water monsters would hide the grip behind the type chart, measured: plans/chapter3-world.md).
  // `holes`: open water in the ice inside the ring ([dx, dz, r]: the water twist there too, a Water creature swims at full speed). The
  // knot's big one is Blizzbear (an Ice Grumble: it keeps its grip). No smudges: the second region starts with tangles, and `step`: its
  // monsters are 2 levels over a meadow patch of the same size (scribblefight.js patchFight).
  { id: 7, x: 41, z: 204, size: 'tangle', region: 'lake', step: 2, species: ['frostling', 'squeaklet', 'skyfin'], pot: 0x46d0e0 },
  { id: 8, x: 41, z: 152, size: 'tangle', region: 'lake', step: 2, species: ['waddlice', 'suddly', 'pinwhirl'], pot: 0x9be36a },
  { id: 9, x: 17, z: 204, size: 'tangle', region: 'lake', step: 2, species: ['flurrydome', 'hippip', 'shellby'], wet: true, holes: [[3, 3, 1.8], [-4, -3, 1.6]], pot: 0x1a9e8f },
  { id: 10, x: 17, z: 152, size: 'tangle', region: 'lake', step: 2, species: ['snowpaw', 'balloony', 'fizzbomb'], pot: 0x2a3fae },
  { id: 11, x: 30, z: 178, size: 'knot', region: 'lake', species: ['frostling', 'suddly', 'skyfin'], grumble: 'blizzbear', last: true, wet: true, holes: [[-5, 3, 1.6], [4, -4, 1.5], [6, 5, 1.3]], pot: 0xd6f4ff },
];
export const CAMP_POT = { x: 120, z: 207, colour: 0xff8a1c };    // A3: the Camp's own paint pot (a hop back home)
export const patchKey = id => `pw:wobble:patch${id}`;
// Freed creatures (step 6): each patch's monsters live in the meadow as wild creatures once it is cleared (the 4th element: wildafter.js).
// Owner 2026-11-11: they stay near their own patch ('near:patch<id>'), and some live up on the floating hills ('near:float').
// One table per region (realms.js spawns by the region's biome): the lake's creatures also live on its islands ('near:isle').
export const freedSpawns = region => PATCHES.filter(p => p.region === region).flatMap(p => [...p.species, ...(p.grumble ? [p.grumble] : [])].flatMap(sp => [
  [sp, p.grumble === sp ? 0.25 : 1, `near:patch${p.id}`, `wobble:${p.id}`],
  [sp, p.grumble === sp ? 0.15 : 0.5, region === 'lake' ? 'near:isle' : 'near:float', `wobble:${p.id}`],
]));
export const FREED_SPAWNS = freedSpawns('meadow');
// Is a region open (its wall melted)? Puddle Meadow always; any other once the knot of the region before it is cleared.
export function regionOpen(id, beaten) {
  const r = REGIONS[id];
  if (!r?.after) return !!r;
  const keys = new Set(beaten || []), knot = PATCHES.find(p => p.region === r.after && p.last);
  return !!knot && keys.has(patchKey(knot.id));
}
// The patches you can fight now: every one not cleared in an open region, but a region's knot only once its other patches are clear
// (step 6: the knot is the region's end). The one rule the arrow, "Where to go" and the fight all read.
export function openPatches(beaten, list = PATCHES) {
  const keys = new Set(beaten || []), left = list.filter(p => !keys.has(patchKey(p.id)) && regionOpen(p.region ?? 'meadow', beaten));
  return left.filter(p => !p.last || !left.some(q => q !== p && q.region === p.region));
}
// a region's meter: patches cleared of how many (the chip `🎨 <region> n / of`)
export const regionState = (beaten, region = 'meadow') => { const keys = new Set(beaten || []), mine = PATCHES.filter(p => p.region === region); return { n: mine.filter(p => keys.has(patchKey(p.id))).length, of: mine.length, name: REGIONS[region]?.name ?? region }; };
export const meadowState = beaten => regionState(beaten, 'meadow');
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
// Slippy Lake (owner 2026-11-11, plans/chapter3-world.md "Slippy Lake"), behind the meadow's west wall (x 0..59, z 134..223): a frozen
// lake, its ice a rounded square (|dx/rx|^4 + |dz/rz|^4 <= 1, so the patches' rings in its corners are on the ice), its top block ICE at
// y LAKE.y (you stand one higher), water under it, a snowy shore rising to the meadow's height. `isles`: snowy islands one block up.
// `hills`: stepped snow hills in the shore's corners (a cone, one block up every `slope`), each with an ice chute down its side.
export const LAKE = { x: 30, z: 178, rx: 26, rz: 39, y: BASE - 2, box: { x0: 0, x1: MEADOW.x0 - 3, z0: MEADOW.z0, z1: SIZE - 1 },
  isles: [{ x: 53, z: 178, r: 4.5 }, { x: 8, z: 178, r: 3 }], hills: [{ x: 55, z: 137, top: BASE + 7 }, { x: 55, z: 219, top: BASE + 7 }], slope: 1.25 };
export const inLakeBox = (x, z) => x >= LAKE.box.x0 && x <= LAKE.box.x1 && z >= LAKE.box.z0 && z <= LAKE.box.z1;
export const lakeShape = (x, z) => ((x + 0.5 - LAKE.x) / LAKE.rx) ** 4 + ((z + 0.5 - LAKE.z) / LAKE.rz) ** 4; // <= 1: the ice
// Ways to move with no button: CHUTES (ice down a hill's side, a push `speed` along it: you shoot out onto the lake and glide on) and
// LEADS (open water in the ice with a current `speed` that carries you to the east island and lifts you out onto it). Straight runs
// along z: x0..x1 two wide, from z0 to z1 (dir = +1 south, -1 north). A chute's floor steps down from `from` to `to`.
export const CHUTES = [
  { x0: 54, x1: 55, z0: 137, z1: 152, dir: 1, from: BASE + 7, to: BASE - 1, speed: 8 },
  { x0: 54, x1: 55, z0: 219, z1: 206, dir: -1, from: BASE + 7, to: BASE - 1, speed: 8 },
];
export const LEADS = [
  { x0: 54, x1: 55, z0: 153, z1: 175, dir: 1, speed: 3.6 },
  { x0: 54, x1: 55, z0: 205, z1: 182, dir: -1, speed: 3.6 },
];
const along = (c, z) => (z - c.z0) * c.dir;                     // how far down a chute / lead (0 at its start)
const runLen = c => Math.abs(c.z1 - c.z0);
const inRun = (c, x, z) => x >= c.x0 && x <= c.x1 && along(c, z) >= 0 && along(c, z) <= runLen(c);
export const chuteFloor = (c, z) => c.from - Math.round(along(c, z) * (c.from - c.to) / runLen(c)); // the chute's ice block at z
const holeAt = (x, z) => PATCHES.some(p => p.holes?.some(([dx, dz, r]) => Math.hypot(x + 0.5 - (p.x + 0.5 + dx), z + 0.5 - (p.z + 0.5 + dz)) <= r));
const isleAt = (x, z) => LAKE.isles.find(i => Math.hypot(x + 0.5 - i.x - 0.5, z + 0.5 - i.z - 0.5) <= i.r) ?? null;
// the lake's ground height (the top block) at (x, z) inside its box (pure)
function lakeHeight(x, z) {
  const s = lakeShape(x, z);
  if (s <= 1) return isleAt(x, z) ? LAKE.y + 1 : LAKE.y;
  let y = s <= 1.25 ? LAKE.y + 1 : BASE;
  for (const h of LAKE.hills) y = Math.max(y, h.top - Math.floor(Math.hypot(x + 0.5 - h.x - 0.5, z + 0.5 - h.z - 0.5) / LAKE.slope));
  return y;
}
// A river drawn with a ruler that kept slipping: right-angle zigzags, two blocks wide, the east wall -> the puddle at (154, 184).
export const RIVER = [[162, 174], [153, 174], [153, 184]];
// Wonky things (the Wizard's beginner drawing): x, z and their own numbers
export const TREES = [ // lean: blocks sideways per block up (dx, dz); twist: a corkscrew trunk
  { x: 70, z: 196, h: 7, lean: [0.45, 0] }, { x: 154, z: 196, h: 6, lean: [-0.4, 0.2] }, { x: 96, z: 198, h: 8, twist: true },
  { x: 126, z: 196, h: 7, lean: [0, -0.5] }, { x: 68, z: 162, h: 6, lean: [0.5, 0.5] }, { x: 150, z: 170, h: 8, twist: true },
  { x: 126, z: 170, h: 6, lean: [0.35, -0.35] }, { x: 98, z: 140, h: 9, twist: true },
  { x: 126, z: 140, h: 7, lean: [0.5, 0] }, { x: 70, z: 140, h: 6, twist: true }, { x: 154, z: 141, h: 7, lean: [-0.45, 0.2] },
  { x: 73, z: 217, h: 8, twist: true }, { x: 158, z: 214, h: 7, lean: [-0.5, -0.3] },
];
// Shadywood (behind the east wall, for later): a thick wood of tall straight trees
export const WOOD = { x0: 168, x1: 218, z0: 140, z1: 218, step: 7 };
export const FLOWER = { x: 140, z: 206, stem: 13, petal: 4 };       // a flower taller than a house
export const CLOUD_HILL = { x: 68, z: 172 };                        // a cloud stuck on a hilltop (on the bulge there)
export const SMALL_HOUSE = { x: 78, z: 204, w: 4, d: 4, h: 3 };     // a house drawn too small, with a door far too big for it
export const STAIRS_NOWHERE = { x: 146, z: 216, n: 8 };             // stone steps climbing into the air
export const MUSHROOM = { x: 157, z: 160, stalk: 4, cap: 4 };       // a mushroom-shaped hill
// C4 / C5 (owner 2026-11-11, "more different than our regular world"): shapes our world can never have, and a drawing's way to move.
// Hills that float on strings (a chest on top), each with a drawn spring beside it (the Bounce Block: jump on it, steer onto the hill)
// (owner 2026-11-11: "more floating hills, with more creatures": wild creatures live on them too, `spawnSpot('float')`). No `spring` = the
// floating river (RIVER_UP) is its way up.
export const FLOATERS = [
  { x: 69, z: 148, y: 21, r: 3.6, spring: [69, 156] }, { x: 155, z: 146, y: 22, r: 3.6, spring: [155, 154] },
  { x: 66, z: 160, y: 22, r: 3.8 }, { x: 124, z: 215, y: 21, r: 3.6, spring: [124, 208] }, { x: 98, z: 167, y: 23, r: 3.6, spring: [100, 173] },
  { x: 8, z: 178, y: 20, r: 3.2, spring: [8, 186] }, // Slippy Lake: over the west island, its spring on the ice (glide up to it and jump)
];
// The floating river (owner 2026-11-11: "floating river", nothing to press): water on a paper strip that starts on the ground by the
// Camp and runs uphill to a floating hill; step in and it carries you up (world.flowAt, read by Player in water).
export const RIVER_UP = { x0: 64, x1: 65, z0: 216, z1: 164, from: 11, rise: 4, top: 22, speed: 3.6 };
export const riverLevel = z => Math.min(RIVER_UP.top, RIVER_UP.from + Math.floor((RIVER_UP.z0 - z) / RIVER_UP.rise));
// the water's own height there (over a bump of ground it runs on the ground)
export const riverY = z => Math.max(riverLevel(z), heightAt(RIVER_UP.x0, z), heightAt(RIVER_UP.x1, z));
export const UPSIDE_TREES = [{ x: 88, z: 214, h: 7 }, { x: 132, z: 215, h: 6 }]; // leaves on the ground, roots in the air
export const CRAYONS = [{ x: 71, z: 203, h: 13, c: 'fire' }, { x: 158, z: 191, h: 11, c: 'water' }, { x: 98, z: 152, h: 12, c: 'grass' }]; // giant crayons stuck in the ground

const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
// The ground's height at (x, z) (pure: the checks and the look use it too). Patch rings are flat (a gentle edge outside them), the Camp is flat.
export function heightAt(x, z) {
  if (inLakeBox(x, z)) return lakeHeight(x, z);
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
  slippyLake(world, put);
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
  // C4 / C5: floating hills on strings with a chest on top, a spring beside each
  for (const f of FLOATERS) {
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > f.r) continue;
      const depth = Math.round((f.r - d) * 0.9); // a round lump: thickest in the middle, hanging down
      for (let k = 0; k <= depth; k++) put(f.x + dx, f.y - k, f.z + dz, k === 0 ? B.GRASS : B.DIRT);
    }
    // (its string is a drawn line up to the top of the page: wobblelive.js HillStrings)
    put(f.x, f.y + 1, f.z, B.CHEST);
    if (f.spring) { const [sx, sz] = f.spring; put(sx, heightAt(sx, sz), sz, B.BOUNCE); }
  }
  // the floating river: water on a paper strip, a step up every RIVER_UP.rise blocks, into the last floating hill
  for (let z = RIVER_UP.z1; z <= RIVER_UP.z0; z++) for (let x = RIVER_UP.x0; x <= RIVER_UP.x1; x++) {
    const g = heightAt(x, z), y = riverY(z);
    if (world.get(x, y, z) !== B.AIR && y > g) continue; // (into the hill: stop)
    put(x, y, z, B.WATER); if (y > g) put(x, y - 1, z, WOOL.paper);
  }
  for (const t of UPSIDE_TREES) {
    const g = heightAt(t.x, t.z);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 1; dy <= 3; dy++) if (dx * dx + dz * dz + (dy - 2) * (dy - 2) * 2 <= 6) put(t.x + dx, g + dy, t.z + dz, B.LEAVES);
    for (let k = 4; k <= t.h + 3; k++) put(t.x, g + k, t.z, B.LOG);
    const top = g + t.h + 3; // the roots, spreading out in the air
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { put(t.x + dx, top + 1, t.z + dz, B.LOG); put(t.x + dx * 2, top + 2, t.z + dz * 2, B.LOG); }
    put(t.x, top + 1, t.z, B.DIRT);
  }
  for (const c of CRAYONS) {
    const g = heightAt(c.x, c.z);
    for (let k = 1; k <= c.h; k++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (k === 1 && (dx || dz)) continue; // the tip goes into the ground
      const band = k >= c.h * 0.35 && k <= c.h * 0.7; // the paper wrapper
      put(c.x + dx, g + k, c.z + dz, band ? (dx === 0 || dz === 0 ? WOOL.paper : WOOL[c.c]) : WOOL[c.c]);
    }
  }
  // where the Scribble is: the patches (scribble.js draws them; their keys say which are cleared), the regions, the wall
  const walls = WALLS.map(b => ({ ...b, y0: 0, y1: 47 }));
  world.wobble = { patches: PATCHES.map(p => ({ ...p, y: heightAt(p.x, p.z) + 1 })), walls, wall: walls[0], camp: { ...CAMP, y: BASE + 1 }, regions: REGIONS, knot: KNOT };
  // B (owner 2026-11-11: "why can't I ride or fly my creature here?"): the page keeps out building, never riders (`rideIn`); the
  // Scribble's wall fences riders out too (its keep has no rideIn). A rider who reaches a patch hops off as the fight starts (scribble.js).
  world.keeps.push({ name: 'wobble', rideIn: true, protect: [{ x0: 0, x1: W - 1, y0: 0, y1: 47, z0: 0, z1: D - 1 }], wallText: "This is the Wizard's drawing. No building here!" });
  world.keeps.push({ name: 'scribble-wall', protect: walls, wallText: 'The Scribble walled this off. Clear the big knot first!', rideText: 'The Scribble walled this off. Clear the big knot first!' });
  world.people ??= []; // the Wizard at the Camp (step 6): his words follow your progress (WIZARD_LINES; scribble.js says them on a win)
  world.people.push({ name: 'The Wizard', title: 'The Wizard · Inkpot Camp', colors: { skin: 0xf2c9a0, hair: 0xf4f0ea, shirt: 0x6a3ab8, pants: 0x4a2a90 }, look: 'wizard',
    line: "The Scribble is in my very first drawing. Let's colour it back in! Grey means the Scribble.", pos: [WIZARD_SPOT.x, BASE + 1, WIZARD_SPOT.z], heading: Math.PI });
  world.flowAt = p => riverFlow(p) ?? lakeFlow(p); // the floating river's current, the lake's chutes and leads (player.js)
  world.groundAt = p => iceUnder(world, p); // Slippy Lake: on ice you slide (groundrules.js; the player and the fight ask it)
  world.spawnSpot = (arg, near) => wobbleSpot(world, arg, near); // creatures.js: where 'near:<arg>' creatures appear
  world.parts.push({ id: 'wobble', live: 'wobble' }); // wobblelive.js: the paint-pot hops (A3)
  world.realmBiome = (x, z) => REGIONS[regionAt(x, z)].biome;
  world.spawnAt = world.arrivals.wobble;
  return world;
}

// Slippy Lake's blocks (the heights are heightAt's): ice over water inside the lake, snow on the shore, the islands and the hills, holes of
// open water in two rings, the chutes (an ice floor on snow, a snow kerb each side) and the leads (open water with sand under it).
function slippyLake(world, put) {
  const { x0, x1, z0, z1 } = LAKE.box;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const y = lakeHeight(x, z), ice = lakeShape(x, z) <= 1 && !isleAt(x, z);
    if (ice) { put(x, y, z, holeAt(x, z) ? B.WATER : B.ICE); put(x, y - 1, z, B.WATER); put(x, y - 2, z, B.SAND); }
    else { put(x, y, z, B.SNOW); put(x, y - 1, z, B.DIRT); }
  }
  for (const c of CHUTES) for (let k = 0; k <= runLen(c); k++) {
    const z = c.z0 + k * c.dir, f = chuteFloor(c, z);
    for (let x = c.x0 - 1; x <= c.x1 + 1; x++) {
      const kerb = x < c.x0 || x > c.x1, top = kerb ? f + 1 : f;
      for (let y = world.ground[x + z * world.W] + 1; y <= top; y++) put(x, y, z, B.SNOW);
      for (let y = top + 1; y <= top + 8; y++) put(x, y, z, B.AIR); // (carved through the hill)
      if (!kerb) put(x, f, z, B.ICE);
      world.ground[x + z * world.W] = top;
    }
  }
  for (const l of LEADS) for (let k = 0; k <= runLen(l); k++) {
    const z = l.z0 + k * l.dir;
    for (let x = l.x0; x <= l.x1; x++) { for (let y = LAKE.y + 1; y <= LAKE.y + 3; y++) put(x, y, z, B.AIR); put(x, LAKE.y, z, B.WATER); put(x, LAKE.y - 1, z, B.WATER); put(x, LAKE.y - 2, z, B.SAND); world.ground[x + z * world.W] = LAKE.y; }
  }
  // a little pine on the east island (where the leads come in), a snowy one on the west
  for (const [i, h] of [[LAKE.isles[0], 5], [LAKE.isles[1], 3]]) {
    const g = LAKE.y + 1;
    for (let k = 1; k <= h; k++) put(i.x, g + k, i.z, B.PINE_LOG);
    for (let dy = 2; dy <= h + 1; dy++) { const r = dy > h ? 0 : dy < h - 1 ? 1 : 0; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if ((dx || dz || dy > h) && world.get(i.x + dx, g + dy, i.z + dz) === B.AIR) put(i.x + dx, g + dy, i.z + dz, B.PINE_LEAVES); }
  }
}
// The ground's rule where p stands (groundrules.js): ice under your feet (or under you in a jump, up to 3 blocks down) = slide.
// (Over an edge, held up by the ice behind you, the corners of your feet count: you glide off the edge, never stop on it.)
export function iceUnder(world, p) {
  if (!inLakeBox(Math.floor(p.x), Math.floor(p.z))) return null;
  const under = (x, z) => { for (let y = Math.floor(p.y - 0.05); y >= Math.floor(p.y) - 3; y--) { const b = world.get(x, y, z); if (b !== B.AIR) return b; } return B.AIR; };
  const b = under(Math.floor(p.x), Math.floor(p.z));
  if (b === B.ICE) return GROUND.ice;
  if (b !== B.AIR && b !== B.WATER) return null;
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) if (under(Math.floor(p.x + dx), Math.floor(p.z + dz)) === B.ICE) return GROUND.ice;
  return null;
}
// The lake's pushes (blocks a second): down a chute, along a lead (in its water; the last bit lifts you out onto the island), or null.
export function lakeFlow(p) {
  const x = Math.floor(p.x), z = Math.floor(p.z);
  for (const c of CHUTES) if (inRun(c, x, z) && p.y >= chuteFloor(c, z) + 0.5 && p.y < chuteFloor(c, z) + 3) return { x: ((c.x0 + c.x1 + 1) / 2 - p.x) * 2, z: c.dir * c.speed, y: 0 };
  for (const l of LEADS) if (p.x >= l.x0 - 0.3 && p.x <= l.x1 + 1.3 && along(l, z) >= 0 && along(l, z) <= runLen(l) + 1) {
    const end = runLen(l) - along(l, z);
    if (p.y > LAKE.y + (end < 2.5 ? 2.2 : 0.95)) continue; // (only a swimmer in it; the ice beside it stays still)
    return { x: ((l.x0 + l.x1 + 1) / 2 - p.x) * 2, z: l.dir * l.speed, y: end < 2.5 ? 10.5 : 0 }; // (10.5: a push that climbs one block out of the water)
  }
  return null;
}

// The guide in Wobbleland (step 6 fills in the patches through scribble.js; until then: the nearest uncleared patch, else the way back).
// The floating river's current at a place (blocks a second; y = a lift over the next step), or null off it.
export function riverFlow(p) {
  const R = RIVER_UP;
  if (p.x < R.x0 - 0.3 || p.x > R.x1 + 1.3 || p.z < R.z1 - 2 || p.z > R.z0 + 1) return null; // (2 more onto the hill: off the edge)
  const lvl = riverY(Math.floor(p.z)), next = riverY(Math.floor(p.z - 1.2)), mid = (R.x0 + R.x1 + 1) / 2;
  if (p.y < lvl - 1 || p.y > lvl + 1.6) return null;
  return { x: (mid - p.x) * 2, z: -R.speed, y: next > lvl || p.z < R.z1 + 2.5 ? 7 : 0 }; // downstream is north (-z); a step up ahead lifts you
}
// Where a 'near:<arg>' creature appears (owner 2026-11-11: freed creatures stay near their patch; floating hills have their own):
// 'patch<id>' = round its cleared ring, 'float' = on top of a floating hill. Only within 45 of the player, else none this time.
export function wobbleSpot(world, arg, near) {
  const rnd = Math.random, ok = (x, z) => !near || Math.hypot(x - near.x, z - near.z) < 45;
  if (arg === 'float') {
    const f = FLOATERS.filter(q => ok(q.x, q.z))[Math.floor(rnd() * FLOATERS.length)];
    if (!f) return null;
    const a = rnd() * Math.PI * 2, r = 1 + rnd() * 1.6, x = Math.floor(f.x + Math.cos(a) * r), z = Math.floor(f.z + Math.sin(a) * r);
    return world.get(x, f.y + 1, z) === B.AIR && world.get(x, f.y, z) === B.GRASS ? { x, y: f.y + 1, z } : null; // (on the hill's grass)
  }
  if (arg === 'isle') { // Slippy Lake: on an island's snow
    const i = LAKE.isles[Math.floor(rnd() * LAKE.isles.length)];
    if (!ok(i.x, i.z)) return null;
    const a = rnd() * Math.PI * 2, r = 1.2 + rnd() * (i.r - 1.4), x = Math.floor(i.x + 0.5 + Math.cos(a) * r), z = Math.floor(i.z + 0.5 + Math.sin(a) * r);
    return world.get(x, LAKE.y + 2, z) === B.AIR && world.get(x, LAKE.y + 1, z) === B.SNOW ? { x, y: LAKE.y + 2, z } : null;
  }
  const p = PATCHES.find(q => `patch${q.id}` === arg);
  if (!p || !ok(p.x, p.z)) return null;
  const a = rnd() * Math.PI * 2, r = 3 + rnd() * 8.4, x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
  return { x, y: heightAt(x, z) + 1, z };
}
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
const NEXT_WORDS = { meadow: 'Next: Slippy Lake, through the west wall!', lake: 'Next: Shadywood, through the east wall of the meadow.' };
const KNOT_WORDS = { meadow: 'Be careful: something grumbles in there!', lake: 'Be careful: something big skates in there!' };
export function wizardLine(n, of, region = 'meadow') {
  const name = REGIONS[region]?.name ?? 'Puddle Meadow';
  if (n >= of) return `🧙 ${name} is bright again! ${NEXT_WORDS[region] ?? ''}`.trim();
  if (n === 1) return region === 'lake' ? '🧙 You did it! Ice is slippy, but you kept your feet!' : '🧙 You did it! Look, the colour is coming back!';
  if (n === of - 1) return `🧙 Only the big knot is left. ${KNOT_WORDS[region] ?? KNOT_WORDS.meadow}`;
  return `🧙 Wonderful! ${of - n} more to go.`;
}
export const PAPER_WORDS = {
  prompt: how => `The Paper Door · ${how} to go down`, action: 'Down!',
  first: "The Scribble is in my very first drawing. Let's colour it back in!",
};
