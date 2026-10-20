// Block definitions and the procedurally drawn pixel-art texture atlas.

const TILE = 16;

// Tile indices inside the atlas (a single row of 16x16 tiles).
export const T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  LOG_SIDE: 6, LOG_TOP: 7, LEAVES: 8, PLANKS: 9, COBBLE: 10,
  SNOW: 11, SNOW_SIDE: 12, BRICK: 13, WOOL0: 14,
};

// Coloured "wool" blocks, one per creature type, used for gym roofs and carpets.
const WOOL_TYPES = [
  'normal', 'fire', 'water', 'grass', 'electric', 'rock', 'ice', 'bug', 'ghost',
  'mind', 'metal', 'toxic', 'pixie', 'drake', 'rainbow', 'cosmic', 'sound', 'bone', 'alien',
  'sky', 'slime', 'light', 'paper', // T10 gyms: ids 49-52 (see WOOL below)
  'time', 'camo', 'cyber', // T18: ids 54-56
  'cozy', 'treasure', // T21: ids 68-69
  'food', 'squad', 'dream', 'parkour', // wave 11 (T33-T36): ids 79-82
];
const WOOL_RGB = {
  normal: [200, 196, 170], fire: [222, 96, 40], water: [60, 110, 220], grass: [80, 170, 70], electric: [240, 200, 40],
  rock: [160, 130, 80], ice: [150, 220, 235], bug: [140, 170, 30], ghost: [110, 80, 160],
  mind: [235, 120, 175], metal: [170, 180, 190], toxic: [140, 70, 180], pixie: [255, 175, 220], drake: [95, 90, 220],
  rainbow: [255, 255, 255], cosmic: [48, 50, 130], sound: [60, 200, 180], bone: [236, 228, 205], alien: [140, 225, 90],
  sky: [150, 210, 255], slime: [120, 220, 110], light: [255, 228, 110], paper: [250, 248, 240],
  time: [222, 170, 80], camo: [110, 150, 80], cyber: [40, 52, 80],
  cozy: [200, 110, 90], treasure: [230, 185, 60],
  food: [235, 110, 70], squad: [70, 150, 210], dream: [185, 150, 240], parkour: [225, 60, 60],
};
// More tiles after the wool ones.
const MORE_TILES = [
  'ICE', 'GRAVEL', 'SANDSTONE', 'SANDSTONE_TOP', 'CACTUS_SIDE', 'CACTUS_TOP', 'MUD', 'PINE_SIDE', 'PINE_LEAVES',
  'FLOWERS', 'CRYSTAL', 'GLASS', 'STONE_BRICKS', 'LAMP', 'COAL_ORE', 'GOLD_ORE',
  'GLOWCAP', 'CHEST_SIDE', 'CHEST_TOP', 'CHEST_OPEN_TOP', 'CLOUD',
  'LASER_RED', 'LASER_BLUE', 'LASER_FRIEND', 'SWITCH_RED_TOP', 'SWITCH_BLUE_TOP', 'FRIEND_PAD_TOP', 'RESET_BUTTON', 'CLOCK_DOOR', // T19
  'SUNSTONE', 'RUBY', 'SAPPHIRE', // T20 treasure blocks
  'DOORMAT_TOP', 'DOORMAT_SIDE', 'BED_TOP', 'BED_SIDE', 'FIREPLACE', 'FIREPLACE_TOP', // T22 home blocks
  'KEY_CHEST_SIDE', 'KEY_CHEST_TOP', 'VAULT_DOOR', // T23 Treasure Vault blocks
  'STAR_BLOCK', 'RAINBOW_BRICK', 'TROPHY_SIDE', 'TROPHY_TOP', // T29 mission blocks
  'WAKE_STONE', // T31 realms
  'POT_SIDE', 'POT_TOP', 'POT_GOLD', 'POT_BURNT', 'STOVE_SIDE', 'STOVE_TOP', // T33 Restaurant
  'SOFT_MAT', 'CHECKPOINT_TOP', 'CHECKPOINT_ON_TOP', 'BEAM_TOP', 'BEAM_SIDE', // T36 parkour
  'BOUNCE_TOP', 'BOUNCE_SIDE', 'DREAM_GRASS_TOP', 'DREAM_GRASS_SIDE', // T35 dream
];
MORE_TILES.forEach((name, i) => { T[name] = T.WOOL0 + WOOL_TYPES.length + i; });
export const TILE_COUNT = T.WOOL0 + WOOL_TYPES.length + MORE_TILES.length;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  LOG: 6, LEAVES: 7, PLANKS: 8, COBBLE: 9, SNOW: 10, BRICK: 11,
  ICE: 12, GRAVEL: 13, SANDSTONE: 14, CACTUS: 15, MUD: 16, PINE_LOG: 17, PINE_LEAVES: 18, FLOWER_BUSH: 19,
  // 20-38 are the wool blocks.
  CRYSTAL: 40, GLASS: 41, STONE_BRICKS: 42, LAMP: 43, COAL_ORE: 44, GOLD_ORE: 45,
  GLOWCAP: 46, CHEST: 47, CHEST_OPEN: 48,
  // 49-52 are the sky / slime / light / paper wool blocks.
  CLOUD: 53,
  // 54-56 are the time / camo / cyber wool blocks, 68-69 the cozy / treasure ones (T21).
  // 57-64: T19 gym blocks (lasers, switches, reset button, clock door).
  LASER_RED: 57, LASER_BLUE: 58, LASER_FRIEND: 59, SWITCH_RED: 60, SWITCH_BLUE: 61, FRIEND_PAD: 62, RESET_BUTTON: 63, CLOCK_DOOR: 64,
  // 65-67: T20 treasure blocks (limited: you mine them to have them). 68-69: cozy / treasure wool (T21). (Next free id: 78, see below.)
  SUNSTONE: 65, RUBY: 66, SAPPHIRE: 67,
  // 70-72: T22 home blocks. 73-74: T23 Treasure Vault blocks (not placeable). Next free id: 78.
  DOORMAT: 70, BED: 71, FIREPLACE: 72,
  KEY_CHEST: 73, VAULT_DOOR: 74,
  // 75-77: T29 mission blocks (limited, only from Champion missions). Next free id: 78.
  STAR_BLOCK: 75, RAINBOW_BRICK: 76, GIANT_TROPHY: 77,
  // 78: T31 Wake Stone (only in realms, never in the main world). 79-82: food / squad / dream / parkour wool (wave 11).
  // Reserved for wave 11: 83-86 T33 (Restaurant), 87-90 T35 (Dream), 91-94 T36 (Parkour). Next free id: 95.
  WAKE_STONE: 78,
  POT: 83, POT_GOLDEN: 84, POT_BURNT: 85, STOVE: 86, // T33 Restaurant (not placeable)
  // T35 (87-90): Bounce Block and Dream Grass (natural, not placeable); 89-90 stay spare.
  BOUNCE: 87, DREAM_GRASS: 88,
  // 91-94: T36 Obstacle Course blocks (not placeable). Next free id: 95.
  SOFT_MAT: 91, CHECKPOINT: 92, CHECKPOINT_ON: 93, BEAM: 94,
};
// Block id of each type's wool block.
// The first 19 are 20 + i; the T10 ones can't continue there (39-48 are other blocks), so they sit at 49-52.
const WOOL_ID_OVERRIDE = { sky: 49, slime: 50, light: 51, paper: 52, time: 54, camo: 55, cyber: 56, cozy: 68, treasure: 69, food: 79, squad: 80, dream: 81, parkour: 82 };
export const WOOL = Object.fromEntries(WOOL_TYPES.map((t, i) => [t, WOOL_ID_OVERRIDE[t] ?? 20 + i]));

const all = t => ({ top: t, side: t, bottom: t });
export const BLOCKS = {
  [B.GRASS]: { name: 'Grass', top: T.GRASS_TOP, side: T.GRASS_SIDE, bottom: T.DIRT },
  [B.DIRT]: { name: 'Dirt', ...all(T.DIRT) },
  [B.STONE]: { name: 'Stone', ...all(T.STONE) },
  [B.SAND]: { name: 'Sand', ...all(T.SAND) },
  [B.WATER]: { name: 'Water', ...all(T.WATER) },
  [B.LOG]: { name: 'Log', top: T.LOG_TOP, side: T.LOG_SIDE, bottom: T.LOG_TOP },
  [B.LEAVES]: { name: 'Leaves', ...all(T.LEAVES) },
  [B.PLANKS]: { name: 'Planks', ...all(T.PLANKS) },
  [B.COBBLE]: { name: 'Cobblestone', ...all(T.COBBLE) },
  [B.SNOW]: { name: 'Snow', top: T.SNOW, side: T.SNOW_SIDE, bottom: T.STONE },
  [B.BRICK]: { name: 'Brick', ...all(T.BRICK) },
  [B.ICE]: { name: 'Ice', ...all(T.ICE) },
  [B.GRAVEL]: { name: 'Gravel', ...all(T.GRAVEL) },
  [B.SANDSTONE]: { name: 'Sandstone', top: T.SANDSTONE_TOP, side: T.SANDSTONE, bottom: T.SANDSTONE_TOP },
  [B.CACTUS]: { name: 'Cactus', top: T.CACTUS_TOP, side: T.CACTUS_SIDE, bottom: T.CACTUS_TOP },
  [B.MUD]: { name: 'Mud', ...all(T.MUD) },
  [B.PINE_LOG]: { name: 'Pine Log', top: T.LOG_TOP, side: T.PINE_SIDE, bottom: T.LOG_TOP },
  [B.PINE_LEAVES]: { name: 'Pine Leaves', ...all(T.PINE_LEAVES) },
  [B.FLOWER_BUSH]: { name: 'Flower Bush', ...all(T.FLOWERS) },
  [B.CRYSTAL]: { name: 'Star Crystal', ...all(T.CRYSTAL), glow: true },
  [B.GLASS]: { name: 'Glass', ...all(T.GLASS) },
  [B.STONE_BRICKS]: { name: 'Stone Bricks', ...all(T.STONE_BRICKS) },
  [B.LAMP]: { name: 'Lamp', ...all(T.LAMP), glow: true },
  [B.COAL_ORE]: { name: 'Coal Ore', ...all(T.COAL_ORE) },
  [B.GOLD_ORE]: { name: 'Gold Ore', ...all(T.GOLD_ORE) },
  [B.GLOWCAP]: { name: 'Glowcap', ...all(T.GLOWCAP), glow: true },
  [B.CHEST]: { name: 'Treasure Chest', top: T.CHEST_TOP, side: T.CHEST_SIDE, bottom: T.CHEST_TOP },
  [B.CHEST_OPEN]: { name: 'Open Chest', top: T.CHEST_OPEN_TOP, side: T.CHEST_SIDE, bottom: T.CHEST_TOP },
};
BLOCKS[B.CLOUD] = { name: 'Cloud', ...all(T.CLOUD) };
// T19 gym blocks: none can be placed. `noLight` = drawn bright at night but lights nothing around it (lasers flip often);
// `wallText` = what the toast says when someone tries to break it.
const LASER_TEXT = "Lasers can't be broken. Find the switch!";
BLOCKS[B.LASER_RED] = { name: 'Red Laser', ...all(T.LASER_RED), glow: true, noLight: true, wallText: LASER_TEXT };
BLOCKS[B.LASER_BLUE] = { name: 'Blue Laser', ...all(T.LASER_BLUE), glow: true, noLight: true, wallText: LASER_TEXT };
BLOCKS[B.LASER_FRIEND] = { name: 'Friend Laser', ...all(T.LASER_FRIEND), glow: true, noLight: true, wallText: 'A friend can open this one!' };
BLOCKS[B.SWITCH_RED] = { name: 'Red Switch', top: T.SWITCH_RED_TOP, side: T.STONE_BRICKS, bottom: T.STONE_BRICKS };
BLOCKS[B.SWITCH_BLUE] = { name: 'Blue Switch', top: T.SWITCH_BLUE_TOP, side: T.STONE_BRICKS, bottom: T.STONE_BRICKS };
BLOCKS[B.FRIEND_PAD] = { name: 'Friend Pad', top: T.FRIEND_PAD_TOP, side: T.STONE_BRICKS, bottom: T.STONE_BRICKS };
BLOCKS[B.RESET_BUTTON] = { name: 'Reset Button', ...all(T.RESET_BUTTON) };
BLOCKS[B.CLOCK_DOOR] = { name: 'Clock Door', ...all(T.CLOCK_DOOR), wallText: 'This door opens at its time. Look at the big clock!' };
// T20 treasure blocks. `limited`: you only have the ones you mined (game.blockCounts); breaking one gives 1, placing
// one uses 1. They glint in the dark (glow material) without lighting the cave around them.
BLOCKS[B.SUNSTONE] = { name: 'Sunstone', ...all(T.SUNSTONE), glow: true, noLight: true, limited: true };
BLOCKS[B.RUBY] = { name: 'Ruby', ...all(T.RUBY), glow: true, noLight: true, limited: true };
BLOCKS[B.SAPPHIRE] = { name: 'Sapphire', ...all(T.SAPPHIRE), glow: true, noLight: true, limited: true };
// T22 home blocks: full cubes. The Fireplace lights its room like a lamp and shows its fire on all four sides.
BLOCKS[B.DOORMAT] = { name: 'Doormat', top: T.DOORMAT_TOP, side: T.DOORMAT_SIDE, bottom: T.DOORMAT_SIDE };
BLOCKS[B.BED] = { name: 'Bed', top: T.BED_TOP, side: T.BED_SIDE, bottom: T.PLANKS };
BLOCKS[B.FIREPLACE] = { name: 'Fireplace', top: T.FIREPLACE_TOP, side: T.FIREPLACE, bottom: T.STONE_BRICKS, glow: true };
// T23 Treasure Vault blocks: not placeable. The key chest glints in the dark without lighting anything; an opened one is
// drawn as CHEST_OPEN (live, per player). The vault door stays until you have all three golden keys.
BLOCKS[B.KEY_CHEST] = { name: 'Golden Key Chest', top: T.KEY_CHEST_TOP, side: T.KEY_CHEST_SIDE, bottom: T.KEY_CHEST_TOP, glow: true, noLight: true, wallText: 'Open it! Click or tap the chest.' };
BLOCKS[B.VAULT_DOOR] = { name: 'Vault Door', ...all(T.VAULT_DOOR), wallText: 'The vault is locked. Find the 3 golden keys!' };
// T29 mission blocks: limited like the treasure blocks, but never in the world: Champion missions are the only way to get them.
const MISSION_MORE = 'Finish Champion missions to get more!';
BLOCKS[B.STAR_BLOCK] = { name: 'Star Block', ...all(T.STAR_BLOCK), glow: true, noLight: true, limited: true, getMore: MISSION_MORE };
BLOCKS[B.RAINBOW_BRICK] = { name: 'Rainbow Brick', ...all(T.RAINBOW_BRICK), limited: true, getMore: MISSION_MORE };
BLOCKS[B.GIANT_TROPHY] = { name: 'Giant Trophy', top: T.TROPHY_TOP, side: T.TROPHY_SIDE, bottom: T.TROPHY_TOP, limited: true, getMore: MISSION_MORE };
// T31: the Wake Stone in a realm: touch (use or break) it to wake up. Not placeable.
BLOCKS[B.WAKE_STONE] = { name: 'Wake Stone', ...all(T.WAKE_STONE), glow: true, wallText: 'Touch the Wake Stone to wake up!' };
// T33 Restaurant blocks: not placeable. The pot is drawn per player with setLive (raw -> golden -> burnt).
const POT_TEXT = 'Cook in it! Click or tap the pot.';
BLOCKS[B.POT] = { name: 'Cooking Pot', top: T.POT_TOP, side: T.POT_SIDE, bottom: T.POT_SIDE, wallText: POT_TEXT };
BLOCKS[B.POT_GOLDEN] = { name: 'Golden Pot', ...all(T.POT_GOLD), glow: true, noLight: true, wallText: POT_TEXT };
BLOCKS[B.POT_BURNT] = { name: 'Burnt Pot', ...all(T.POT_BURNT), wallText: POT_TEXT };
BLOCKS[B.STOVE] = { name: 'Stove', top: T.STOVE_TOP, side: T.STOVE_SIDE, bottom: T.STOVE_SIDE, glow: true, wallText: 'The stove is hot! Cook in the pot on top.' };
// T36 Obstacle Course blocks: none can be placed. The checkpoint flag turns green (CHECKPOINT_ON) with setLive once you stood on it.
BLOCKS[B.SOFT_MAT] = { name: 'Soft Mat', ...all(T.SOFT_MAT), wallText: 'A soft mat. Jump back on the course!' };
BLOCKS[B.CHECKPOINT] = { name: 'Checkpoint Flag', top: T.CHECKPOINT_TOP, side: T.WOOL0 + WOOL_TYPES.indexOf('parkour'), bottom: T.WOOL0 + WOOL_TYPES.indexOf('parkour'), wallText: 'Stand on the flag! If you fall, you come back here.' };
BLOCKS[B.CHECKPOINT_ON] = { name: 'Checkpoint Flag', top: T.CHECKPOINT_ON_TOP, side: T.WOOL0 + WOOL_TYPES.indexOf('parkour'), bottom: T.WOOL0 + WOOL_TYPES.indexOf('parkour'), glow: true, noLight: true, wallText: 'Stand on the flag! If you fall, you come back here.' };
BLOCKS[B.BEAM] = { name: 'Balance Beam', top: T.BEAM_TOP, side: T.BEAM_SIDE, bottom: T.BEAM_TOP, wallText: 'A balance beam. Walk along it!' };
// T35: the Bounce Block (jump on it to fly `bounce` blocks up; `fixed` = nobody can break or replace it) and Dream Grass.
BLOCKS[B.BOUNCE] = { name: 'Bounce Block', top: T.BOUNCE_TOP, side: T.BOUNCE_SIDE, bottom: T.BOUNCE_SIDE, glow: true, noLight: true, bounce: 14, fixed: true, wallText: "It's too springy to break! Jump on it instead." };
BLOCKS[B.DREAM_GRASS] = { name: 'Dream Grass', top: T.DREAM_GRASS_TOP, side: T.DREAM_GRASS_SIDE, bottom: T.CLOUD };
export const MISSION_BLOCKS = [B.STAR_BLOCK, B.RAINBOW_BRICK, B.GIANT_TROPHY];
export const TREASURE = [B.SUNSTONE, B.RUBY, B.SAPPHIRE];
export const isLimited = id => !!BLOCKS[id]?.limited;
WOOL_TYPES.forEach((t, i) => { BLOCKS[WOOL[t]] = { name: `${t[0].toUpperCase()}${t.slice(1)} Wool`, ...all(T.WOOL0 + i) }; });

// The starting hotbar. Players can swap any slot for another block in the Blocks panel.
export const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.LAMP];
// Every block players can build with (the Blocks panel), in a sensible order.
export const PLACEABLE = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.STONE_BRICKS, B.BRICK, B.PLANKS, B.LOG, B.PINE_LOG,
  B.LEAVES, B.PINE_LEAVES, B.FLOWER_BUSH, B.CACTUS, B.SAND, B.SANDSTONE, B.GRAVEL, B.MUD, B.SNOW,
  B.ICE, B.GLASS, B.CLOUD, B.LAMP, B.CRYSTAL, B.GLOWCAP, B.COAL_ORE, B.GOLD_ORE,
  B.SUNSTONE, B.RUBY, B.SAPPHIRE, // limited: only as many as you have mined
];
// T22: home blocks, then eight wool colours as rugs (any wool counts as a rug). Added after the others so nothing moves.
PLACEABLE.splice(PLACEABLE.indexOf(B.LAMP) + 1, 0, B.DOORMAT, B.BED, B.FIREPLACE);
PLACEABLE.push(WOOL.cozy, WOOL.normal, WOOL.fire, WOOL.water, WOOL.grass, WOOL.electric, WOOL.pixie, WOOL.treasure);
PLACEABLE.push(...MISSION_BLOCKS); // T29

// Blocks you can see through, so they don't hide the faces of their neighbours.
const SEE_THROUGH = new Set([B.AIR, B.WATER, B.LEAVES, B.PINE_LEAVES, B.FLOWER_BUSH, B.GLASS]);
export const isOccluder = id => !SEE_THROUGH.has(id);
// Blocks the player and creatures collide with.
export const isSolid = id => id !== B.AIR && id !== B.WATER;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawAtlas() {
  const c = document.createElement('canvas');
  c.width = TILE * TILE_COUNT;
  c.height = TILE;
  const g = c.getContext('2d');
  const rand = mulberry32(42);

  const put = (t, x, y, col) => {
    g.fillStyle = `rgb(${clamp(col[0])},${clamp(col[1])},${clamp(col[2])})`;
    g.fillRect(t * TILE + x, y, 1, 1);
  };
  const clamp = v => Math.max(0, Math.min(255, v | 0));
  const shade = (col, f) => col.map(v => v * f);
  const each = fn => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) fn(x, y); };
  const noisy = (t, col, amt) => each((x, y) => put(t, x, y, shade(col, 1 + (rand() - 0.5) * amt)));

  const GREEN = [96, 160, 56];
  const DIRT = [134, 96, 67];

  noisy(T.GRASS_TOP, GREEN, 0.35);

  noisy(T.DIRT, DIRT, 0.3);
  for (let i = 0; i < 14; i++) put(T.DIRT, (rand() * 16) | 0, (rand() * 16) | 0, shade(DIRT, 0.7));

  // Grass side: dirt with a ragged strip of grass on top.
  const edge = Array.from({ length: TILE }, () => 2 + ((rand() * 3) | 0));
  each((x, y) => put(T.GRASS_SIDE, x, y,
    y < edge[x] ? shade(GREEN, 1 + (rand() - 0.5) * 0.35) : shade(DIRT, 1 + (rand() - 0.5) * 0.3)));

  const STONE = [128, 128, 128];
  noisy(T.STONE, STONE, 0.22);
  for (let i = 0; i < 12; i++) {
    const x = (rand() * 15) | 0, y = (rand() * 16) | 0;
    put(T.STONE, x, y, shade(STONE, 0.72));
    put(T.STONE, x + 1, y, shade(STONE, 0.78));
  }

  noisy(T.SAND, [222, 210, 166], 0.14);

  each((x, y) => {
    const f = 1 + 0.13 * Math.sin((x + y * 2) * 0.8) + (rand() - 0.5) * 0.1;
    put(T.WATER, x, y, shade([50, 100, 210], f));
  });

  const BARK = [104, 82, 52];
  each((x, y) => put(T.LOG_SIDE, x, y, shade(BARK, (x % 4 === 0 ? 0.72 : 1) * (1 + (rand() - 0.5) * 0.2))));

  each((x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    const col = d > 6.5 ? BARK : shade([176, 140, 88], Math.floor(d) % 2 ? 0.85 : 1);
    put(T.LOG_TOP, x, y, shade(col, 1 + (rand() - 0.5) * 0.12));
  });

  each((x, y) => {
    const r = rand();
    put(T.LEAVES, x, y, r < 0.12 ? [30, 72, 22] : shade([62, 132, 42], 1 + (rand() - 0.5) * 0.5));
  });

  each((x, y) => {
    const row = Math.floor(y / 4);
    const seam = x === (row * 5 + 3) % 16;
    const f = (y % 4 === 3 || seam ? 0.68 : 1) * (1 + (rand() - 0.5) * 0.12);
    put(T.PLANKS, x, y, shade([182, 146, 92], f));
  });

  // Cobblestone: voronoi-ish stones with dark mortar.
  const pts = Array.from({ length: 9 }, () => [rand() * 16, rand() * 16, 0.85 + rand() * 0.3]);
  each((x, y) => {
    let d1 = 1e9, d2 = 1e9, best = 0;
    for (const p of pts) {
      for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) {
        const d = Math.hypot(x - p[0] - ox, y - p[1] - oy);
        if (d < d1) { d2 = d1; d1 = d; best = p[2]; } else if (d < d2) d2 = d;
      }
    }
    const mortar = d2 - d1 < 1.1;
    put(T.COBBLE, x, y, shade([122, 122, 122], mortar ? 0.55 : best * (1 + (rand() - 0.5) * 0.15)));
  });

  noisy(T.SNOW, [240, 246, 250], 0.06);
  const snowEdge = Array.from({ length: TILE }, () => 3 + ((rand() * 3) | 0));
  each((x, y) => put(T.SNOW_SIDE, x, y,
    y < snowEdge[x] ? shade([240, 246, 250], 1 + (rand() - 0.5) * 0.06) : shade(STONE, 1 + (rand() - 0.5) * 0.22)));

  each((x, y) => {
    const row = Math.floor(y / 4);
    const mortar = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 0;
    put(T.BRICK, x, y, mortar ? [200, 196, 186] : shade([160, 70, 50], 1 + (rand() - 0.5) * 0.2));
  });

  // Slime bubbles: round, with a darker rim, a pale middle and a shine.
  const SLIME_BUBBLE = (x, y) => {
    for (const [bx, by, r] of [[4, 5, 3.2], [11, 10, 2.6], [12, 3, 1.8]]) {
      const d = Math.hypot(x - bx, y - by);
      if (d > r) continue;
      if (d > r - 1) return [70, 165, 80];
      return x === bx - 1 && y === by - 1 ? [235, 255, 225] : [175, 245, 150];
    }
    return null;
  };
  const STRIPES = [[230, 70, 70], [245, 150, 50], [245, 220, 60], [90, 200, 90], [70, 140, 230], [150, 90, 210]];
  WOOL_TYPES.forEach((t, i) => each((x, y) => {
    const f = (1 + (rand() - 0.5) * 0.12) * ((x + y) % 4 === 0 ? 0.92 : 1);
    const base = t === 'rainbow' ? STRIPES[Math.floor((x + y) / 6) % STRIPES.length]
      : t === 'cosmic' && (x * 7 + y * 13) % 23 === 0 ? [255, 236, 150] // a sky full of stars
        : t === 'bone' && (x * 5 + y * 3) % 19 === 0 ? [150, 140, 120] // little cracks
          : t === 'alien' && (x * 11 + y * 7) % 17 === 0 ? [170, 110, 230] // purple dots
            : t === 'sky' && (x * 5 + y * 9) % 14 === 0 ? [255, 255, 255] // little clouds
              : t === 'slime' && SLIME_BUBBLE(x, y) ? SLIME_BUBBLE(x, y) // round bubbles
                : t === 'light' && (x * 7 + y * 5) % 9 === 0 ? [255, 255, 255] // sparkles
                  : t === 'paper' && y % 4 === 0 ? [205, 225, 245] // pale blue lines
                    : t === 'time' && (x === 0 || y === 0 || x === 15 || y === 15) && (x + y) % 4 === 0 ? [150, 100, 40] // clock ticks
                      : t === 'camo' && (x * 3 + y * 7) % 11 < 3 ? [70, 105, 55] // blotches
                        : t === 'camo' && (x * 5 + y * 2) % 13 === 0 ? [150, 130, 90]
                          : t === 'cyber' && (x % 4 === 0 || y % 4 === 0) ? [80, 220, 255] // glowing grid
                            : t === 'cozy' ? (x % 8 < 2 && y % 8 < 2 ? [150, 70, 60] : x % 8 < 2 || y % 8 < 2 ? [240, 200, 150] : WOOL_RGB[t]) // blanket plaid
                              : t === 'treasure' ? (x === 0 || y === 0 ? [255, 230, 140] : (x * 5 + y * 3) % 17 === 0 ? [230, 60, 80] : (x * 3 + y * 7) % 19 === 0 ? [80, 140, 240] : WOOL_RGB[t]) // gold with gems
                                : t === 'food' ? (((x >> 2) + (y >> 2)) % 2 ? [250, 240, 230] : WOOL_RGB[t]) // tablecloth check (T33)
                                : WOOL_RGB[t];
    put(T.WOOL0 + i, x, y, shade(base, f));
  }));

  // Cloud: soft white with faint grey puffs.
  each((x, y) => {
    const puff = ((x - 4) ** 2 + (y - 4) ** 2 < 7) || ((x - 11) ** 2 + (y - 9) ** 2 < 10) || ((x - 5) ** 2 + (y - 13) ** 2 < 5);
    put(T.CLOUD, x, y, shade(puff ? [226, 232, 242] : [250, 252, 255], 1 + (rand() - 0.5) * 0.04));
  });

  // Ice: pale blue with white cracks.
  each((x, y) => put(T.ICE, x, y, (x * 3 + y * 5) % 17 === 0 || x === y ? [235, 248, 255] : shade([150, 200, 240], 1 + (rand() - 0.5) * 0.08)));
  each((x, y) => {
    const r = rand();
    put(T.GRAVEL, x, y, shade(r < 0.3 ? [150, 140, 130] : r < 0.6 ? [110, 104, 100] : [128, 120, 112], 1 + (rand() - 0.5) * 0.2));
  });
  const SANDSTONE = [214, 196, 140];
  each((x, y) => put(T.SANDSTONE, x, y, shade(SANDSTONE, (y % 5 === 4 ? 0.82 : 1) * (1 + (rand() - 0.5) * 0.08))));
  noisy(T.SANDSTONE_TOP, SANDSTONE, 0.1);
  each((x, y) => put(T.CACTUS_SIDE, x, y, x % 5 === 2 && y % 3 === 0 ? [230, 230, 200] : shade([60, 140, 60], (x % 5 === 0 ? 0.8 : 1) * (1 + (rand() - 0.5) * 0.12))));
  each((x, y) => put(T.CACTUS_TOP, x, y, shade([80, 160, 70], Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) > 6 ? 0.8 : 1)));
  each((x, y) => put(T.MUD, x, y, shade([92, 70, 54], 1 + (rand() - 0.5) * 0.25 + (rand() < 0.08 ? -0.25 : 0))));
  each((x, y) => put(T.PINE_SIDE, x, y, shade([72, 52, 34], (x % 3 === 0 ? 0.75 : 1) * (1 + (rand() - 0.5) * 0.2))));
  each((x, y) => put(T.PINE_LEAVES, x, y, rand() < 0.15 ? [16, 50, 30] : shade([36, 96, 60], 1 + (rand() - 0.5) * 0.4)));
  const PETALS = [[240, 80, 90], [250, 210, 60], [180, 120, 240], [255, 255, 255]];
  each((x, y) => {
    const flower = (x % 5 === 2 && y % 5 === 1) || (x % 5 === 4 && y % 5 === 3);
    put(T.FLOWERS, x, y, flower ? PETALS[(x * 3 + y) % PETALS.length] : shade([70, 150, 50], 1 + (rand() - 0.5) * 0.4));
  });
  each((x, y) => {
    const facet = (x + y) % 8 < 4 ? 1.1 : 0.85;
    put(T.CRYSTAL, x, y, (x * 7 + y * 3) % 19 === 0 ? [255, 250, 200] : shade([150, 120, 240], facet * (1 + (rand() - 0.5) * 0.1)));
  });
  // Glass: a frame with a see-through middle (and a little shine).
  g.clearRect(T.GLASS * TILE, 0, TILE, TILE);
  each((x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) put(T.GLASS, x, y, [200, 225, 235]);
    else if ((x === 3 && y > 2 && y < 7) || (x === 4 && y > 3 && y < 6)) put(T.GLASS, x, y, [240, 250, 255]);
  });
  each((x, y) => {
    const mortar = y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 15;
    put(T.STONE_BRICKS, x, y, mortar ? [90, 90, 90] : shade([140, 140, 140], 1 + (rand() - 0.5) * 0.12));
  });
  each((x, y) => {
    const frame = x < 2 || y < 2 || x > 13 || y > 13;
    put(T.LAMP, x, y, frame ? [110, 80, 50] : shade([255, 220, 120], (x + y) % 6 === 0 ? 0.9 : 1));
  });
  const ore = (tile, col) => {
    each((x, y) => put(tile, x, y, shade(STONE, 1 + (rand() - 0.5) * 0.22)));
    for (const [x, y] of [[3, 3], [9, 2], [6, 7], [12, 9], [2, 11], [8, 12]]) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) put(tile, x + dx, y + dy, shade(col, 1 + (rand() - 0.5) * 0.2));
    }
  };
  ore(T.COAL_ORE, [40, 40, 40]);
  ore(T.GOLD_ORE, [250, 210, 60]);
  // Glowcap: a teal-blue mushroom cap with pale glowing spots.
  each((x, y) => {
    const spot = (x * 5 + y * 3) % 11 === 0 || (x * 3 + y * 7) % 13 === 0;
    put(T.GLOWCAP, x, y, spot ? [225, 255, 245] : shade([40, 150, 170], 1 + (rand() - 0.5) * 0.25 + (y % 4 === 3 ? -0.12 : 0)));
  });
  // Treasure chest: planks with a gold band and lock; the top is a lid (or dark inside when open).
  each((x, y) => {
    const band = y >= 6 && y <= 8;
    const lock = x >= 6 && x <= 9 && y >= 5 && y <= 10;
    const edgeLine = x === 0 || x === 15 || y === 0 || y === 15;
    put(T.CHEST_SIDE, x, y, lock ? [250, 215, 70] : band ? [214, 170, 50] : edgeLine ? [90, 56, 30] : shade([150, 98, 52], (y % 5 === 4 ? 0.8 : 1) * (1 + (rand() - 0.5) * 0.1)));
    put(T.CHEST_TOP, x, y, edgeLine ? [90, 56, 30] : x === 7 || x === 8 ? [214, 170, 50] : shade([164, 108, 58], 1 + (rand() - 0.5) * 0.1));
    put(T.CHEST_OPEN_TOP, x, y, edgeLine || x === 1 || x === 14 || y === 1 || y === 14 ? [120, 76, 40] : shade([34, 24, 20], 1 + (rand() - 0.5) * 0.3));
  });

  // T23 Golden Key Chest: gold planks, a dark keyhole and a white glint; the lid has a gold key shape.
  each((x, y) => {
    const edgeLine = x === 0 || x === 15 || y === 0 || y === 15;
    const hole = (x === 7 || x === 8) && y >= 6 && y <= 9;
    const glint = x === 11 && y === 3;
    const band = y >= 6 && y <= 8;
    put(T.KEY_CHEST_SIDE, x, y, glint ? [255, 255, 255] : hole ? [40, 28, 12] : edgeLine ? [120, 84, 20] : band ? [255, 226, 110] : shade([232, 186, 56], (y % 5 === 4 ? 0.82 : 1) * (1 + (rand() - 0.5) * 0.08)));
    const ring = (x - 5) ** 2 + (y - 7.5) ** 2 <= 6.5 && (x - 5) ** 2 + (y - 7.5) ** 2 >= 2.2;
    const shaft = y === 7 && x >= 6 && x <= 12 || y === 8 && x >= 6 && x <= 12;
    const teeth = (x === 11 || x === 13) && (y === 9 || y === 10);
    put(T.KEY_CHEST_TOP, x, y, edgeLine ? [120, 84, 20] : ring || shaft || teeth ? [255, 240, 150] : shade([232, 186, 56], 1 + (rand() - 0.5) * 0.08));
  });
  // T23 Vault Door: heavy grey metal, gold rivets, a round gold wheel and three keyholes in a row.
  each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    const rivet = (x === 1 || x === 14) && (y === 1 || y === 14) || (x === 1 || x === 14 || y === 1 || y === 14) && (x + y) % 4 === 0 && x > 0 && y > 0 && x < 15 && y < 15;
    const keyhole = y >= 12 && y <= 13 && (x === 3 || x === 7 || x === 12);
    put(T.VAULT_DOOR, x, y, rivet ? [255, 214, 70] : keyhole ? [20, 20, 26]
      : d < 2 ? [255, 226, 110] : d < 3.2 ? [150, 110, 30] : d < 5.4 ? [236, 190, 60] : d < 6.4 ? [90, 94, 104]
      : shade([142, 150, 162], (x === 0 || y === 0 || x === 15 || y === 15 ? 0.7 : 1) * (1 + (rand() - 0.5) * 0.06)));
  });

  // T29 Star Block: deep night blue, a few yellow plus-shaped stars and white dots.
  { // own random numbers, so no older tile changes
    const r2 = mulberry32(2929);
    const stars = [[4, 4], [11, 6], [6, 11], [12, 12]];
    each((x, y) => {
      const star = stars.some(([sx, sy]) => (Math.abs(x - sx) + Math.abs(y - sy) <= 1));
      const dot = (x * 7 + y * 13) % 29 === 0;
      put(T.STAR_BLOCK, x, y, star ? [255, 226, 80] : dot ? [255, 255, 255] : shade([24, 30, 84], 1 + (r2() - 0.5) * 0.25));
    });
    // Rainbow Brick: brick pattern, each brick row one rainbow colour.
    const RB = [[220, 50, 50], [240, 140, 40], [240, 210, 50], [70, 180, 70], [60, 120, 230], [140, 70, 200]];
    each((x, y) => {
      const row = (y / 3) | 0, off = row % 2 ? 4 : 0;
      const mortar = y % 3 === 2 || y >= 15 || (x + off) % 8 === 0;
      put(T.RAINBOW_BRICK, x, y, mortar ? [225, 222, 214] : shade(RB[Math.min(row, 5)], 1 + (r2() - 0.5) * 0.16));
    });
    // Giant Trophy: a gold cup with handles on a dark-gold plate.
    each((x, y) => {
      const cup = y >= 2 && y <= 8 && x >= 5 && x <= 10 && (y < 7 || (x >= 6 && x <= 9));
      const handle = y >= 3 && y <= 5 && (x === 3 || x === 4 || x === 11 || x === 12) && !(y === 4 && (x === 4 || x === 11));
      const stem = y >= 9 && y <= 10 && x >= 7 && x <= 8;
      const plate = y >= 11 && y <= 13 && x >= 3 && x <= 12;
      const rim = y === 2 && x >= 5 && x <= 10;
      put(T.TROPHY_SIDE, x, y, rim ? [150, 100, 10] : cup ? shade([255, 205, 50], 1 + (r2() - 0.5) * 0.1) : handle ? [255, 232, 130] : stem ? [230, 180, 40]
        : plate ? [150, 100, 16] : shade([96, 66, 18], 1 + (r2() - 0.5) * 0.15));
      const d = Math.hypot(x - 7.5, y - 7.5), edge = x === 0 || y === 0 || x === 15 || y === 15;
      put(T.TROPHY_TOP, x, y, edge ? [130, 88, 10] : d > 4.5 && d < 5.8 ? [255, 236, 140] : shade([226, 174, 40], 1 + (r2() - 0.5) * 0.08));
    });
  }
  { // T31 Wake Stone: a pale glowing stone with a sleepy moon. Own random numbers, so no older tile changes.
    const r3 = mulberry32(3131);
    each((x, y) => {
      const moon = Math.hypot(x - 7.5, y - 7.5) < 4.6 && Math.hypot(x - 9.3, y - 6.3) > 3.6;
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      put(T.WAKE_STONE, x, y, edge ? [150, 120, 220] : moon ? [255, 236, 150] : shade([210, 200, 255], 1 + (r3() - 0.5) * 0.12));
    });
  }

  { // T33 Restaurant: the cooking pot (iron with bubbling soup; golden = ready; burnt), and the stove. Own random numbers.
    const r4 = mulberry32(3333);
    const bubbles = (x, y) => (x * 5 + y * 3) % 7 === 0;
    const potSide = (tile, iron, rim, soup, soupDark, glint) => each((x, y) => {
      const handle = (x <= 1 || x >= 14) && y >= 6 && y <= 8;
      put(tile, x, y, handle ? rim : y <= 2 ? rim : y <= 5 ? (bubbles(x, y) ? soupDark : soup)
        : glint && (x * 3 + y * 7) % 11 === 0 ? glint : shade(iron, 1 + (r4() - 0.5) * 0.1));
    });
    potSide(T.POT_SIDE, [70, 74, 80], [110, 114, 122], [245, 235, 205], [225, 210, 170]);
    potSide(T.POT_GOLD, [255, 205, 70], [200, 140, 30], [255, 240, 150], [255, 205, 70], [255, 250, 200]);
    each((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      put(T.POT_TOP, x, y, d > 6.4 ? [60, 64, 70] : d > 5.4 ? [110, 114, 122] : (x * 5 + y * 3) % 9 === 0 ? [225, 210, 170] : [245, 235, 205]);
    });
    each((x, y) => {
      const smoke = (x + y * 2) % 7 === 0 && y > 2 && y < 12;
      const ember = (x * 7 + y * 3) % 17 === 0;
      put(T.POT_BURNT, x, y, ember ? [160, 40, 20] : smoke ? [120, 120, 120] : shade([35, 30, 28], 1 + (r4() - 0.5) * 0.3));
    });
    each((x, y) => {
      const fire = x >= 4 && x <= 11 && y >= 9 && y <= 13;
      const up = 13 - y, flame = fire && up <= 1 + (((x * 5) % 4) + 1);
      const knob = y >= 2 && y <= 3 && (x === 3 || x === 7 || x === 12);
      put(T.STOVE_SIDE, x, y, fire ? (flame ? (up < 1 ? [255, 235, 120] : up < 2 ? [255, 170, 40] : [235, 90, 30]) : [30, 24, 22])
        : knob ? [170, 174, 180] : x === 0 || x === 15 || y === 15 ? [24, 24, 28] : shade([40, 40, 46], 1 + (r4() - 0.5) * 0.12));
    });
    each((x, y) => {
      const ring = [[4, 4], [11, 11]].some(([cx, cy]) => { const d = Math.hypot(x - cx, y - cy); return d > 1.8 && d < 3.2; });
      put(T.STOVE_TOP, x, y, ring ? [255, 140, 40] : x % 4 === 0 || y % 4 === 0 ? [16, 16, 18] : shade([48, 48, 54], 1 + (r4() - 0.5) * 0.1));
    });
  }
  { // T36 Obstacle Course tiles. Own random numbers, so no older tile changes.
    const r4 = mulberry32(3636);
    const edge = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
    // Soft Mat: blue gym-mat foam with lighter seams in a 2 x 2 grid.
    each((x, y) => put(T.SOFT_MAT, x, y, edge(x, y) || x === 7 || x === 8 || y === 7 || y === 8 ? [130, 180, 255] : shade([58, 118, 222], 1 + (r4() - 0.5) * 0.1)));
    // Checkpoint flag: a white pad with a flag on a pole (red; green on gold when reached).
    const flag = (tile, pad, cloth, border) => each((x, y) => {
      const pole = x === 4 && y >= 2 && y <= 13;
      const cloth_ = x >= 5 && x <= 12 && y >= 2 && y <= 2 + Math.round(5 - Math.max(0, x - 8) * 1.2);
      put(tile, x, y, pole ? [60, 40, 30] : cloth_ ? cloth : edge(x, y) ? border : shade(pad, 1 + (r4() - 0.5) * 0.05));
    });
    flag(T.CHECKPOINT_TOP, [245, 245, 250], [235, 50, 50], [190, 190, 200]);
    flag(T.CHECKPOINT_ON_TOP, [255, 214, 90], [40, 180, 80], [200, 150, 30]);
    // Balance beam: light wood on top, red and white stripes down the sides.
    each((x, y) => {
      put(T.BEAM_TOP, x, y, y % 5 === 2 ? [196, 156, 98] : edge(x, y) ? [186, 146, 90] : shade([232, 198, 140], 1 + (r4() - 0.5) * 0.08));
      put(T.BEAM_SIDE, x, y, ((x + y) >> 2) % 2 ? [248, 248, 248] : [226, 52, 52]);
    });
  }
  { // T35 dream blocks (own random numbers). Bounce Block: a trampoline top (rings of pink and cyan round a white middle), striped sides.
    const r4 = mulberry32(3535);
    each((x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); // a trampoline: rings of pink and cyan round a white middle
      put(T.BOUNCE_TOP, x, y, d > 6.6 ? [120, 70, 200] : d < 1.6 ? [255, 255, 255] : d < 3.6 ? [255, 150, 220] : d < 5.6 ? [130, 230, 255] : [255, 150, 220]);
      put(T.BOUNCE_SIDE, x, y, y % 4 < 2 ? [255, 150, 220] : [130, 230, 255]);
      const speck = r4() < 0.07;
      put(T.DREAM_GRASS_TOP, x, y, speck ? [255, 170, 225] : shade([190, 160, 245], 1 + (r4() - 0.5) * 0.16));
      const band = y < 4 || (y < 6 && r4() < 0.5);
      put(T.DREAM_GRASS_SIDE, x, y, band ? shade([190, 160, 245], 1 + (r4() - 0.5) * 0.14) : shade([240, 238, 252], 1 + (r4() - 0.5) * 0.05));
    });
  }

  // T19 gym blocks. Lasers: three thin bright beams with dark gaps.
  const laser = (tile, base, dark, beam) => each((x, y) => put(tile, x, y, [1, 2, 3].some(k => Math.abs(y - (k * 4 - 2)) < 1)
    ? beam : (x + y) % 5 === 0 ? shade(base, 0.8) : y % 4 === 0 || y % 4 === 3 ? dark : base));
  laser(T.LASER_RED, [255, 60, 60], [120, 16, 24], [255, 235, 230]);
  laser(T.LASER_BLUE, [60, 110, 255], [18, 30, 120], [225, 238, 255]);
  laser(T.LASER_FRIEND, [190, 90, 255], [70, 24, 120], [245, 230, 255]);
  // Switches and the friend pad: a dark plate with a big round button (or a white ring).
  const plate = (tile, plateCol, fn) => each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5), edgeLine = x === 0 || y === 0 || x === 15 || y === 15;
    put(tile, x, y, edgeLine ? [30, 30, 38] : fn(d) || shade(plateCol, 1 + (rand() - 0.5) * 0.1));
  });
  plate(T.SWITCH_RED_TOP, [48, 48, 58], d => (d < 3 ? [255, 70, 70] : d < 5.2 ? [150, 24, 30] : null));
  plate(T.SWITCH_BLUE_TOP, [48, 48, 58], d => (d < 3 ? [70, 120, 255] : d < 5.2 ? [24, 40, 150] : null));
  plate(T.FRIEND_PAD_TOP, [110, 60, 170], d => (d > 3.2 && d < 5 ? [255, 255, 255] : null));
  // Reset button: a green face with a white round arrow.
  each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5), edgeLine = x === 0 || y === 0 || x === 15 || y === 15;
    const ring = d > 3 && d < 5 && !(x > 7 && y < 7); // a ring with a gap at the upper right
    const head = (x === 9 || x === 10) && y >= 3 && y <= 5 || (x >= 8 && x <= 11 && y === 5 && d < 6);
    put(T.RESET_BUTTON, x, y, edgeLine ? [20, 80, 40] : ring || head ? [255, 255, 255] : shade([50, 180, 90], 1 + (rand() - 0.5) * 0.08));
  });
  // Clock door: brass planks with a small clock dial.
  each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    const hand = (x === 8 && y >= 4 && y <= 8) || (y === 8 && x >= 8 && x <= 10);
    const col = d < 1.8 && !hand ? [60, 40, 20] : hand ? [50, 30, 14] : d < 4.2 ? [250, 240, 205] : d < 5.2 ? [110, 72, 30] : shade([214, 170, 80], (y % 4 === 3 ? 0.78 : 1) * (1 + (rand() - 0.5) * 0.08));
    put(T.CLOCK_DOOR, x, y, col);
  });

  // T20 treasure blocks: big cut gems set in dark rock, each in its own shape so they never look like ore or crystal.
  // Sunstone: a warm round sun with rays; Ruby: a red diamond; Sapphire: a blue octagon. Facets: light upper left.
  const ROCK = [58, 52, 60];
  const gem = (tile, inside, col, rim) => each((x, y) => {
    const dx = x - 7.5, dy = y - 7.5, k = inside(dx, dy);
    if (k < 0) { put(tile, x, y, shade(ROCK, 1 + (rand() - 0.5) * 0.3)); return; }
    const facet = dx + dy < -3 ? 1.35 : dx + dy > 3 ? 0.72 : Math.abs(dx - dy) < 1 ? 1.15 : 1;
    const shine = (x === 5 && y >= 4 && y <= 5) || (y === 4 && x === 6);
    put(tile, x, y, shine ? [255, 255, 245] : k < 1 ? rim : shade(col, facet));
  });
  gem(T.SUNSTONE, (dx, dy) => {
    const d = Math.hypot(dx, dy), ray = Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.7;
    return d < 4.6 ? 4.6 - d : ray && d < 7.4 ? 0.5 : -1;
  }, [255, 196, 60], [255, 140, 20]);
  gem(T.RUBY, (dx, dy) => 6.6 - Math.abs(dx) - Math.abs(dy) * 0.9 - 0.4, [215, 30, 60], [120, 10, 30]);
  gem(T.SAPPHIRE, (dx, dy) => {
    const a = Math.max(Math.abs(dx), Math.abs(dy)), b = (Math.abs(dx) + Math.abs(dy)) * 0.72;
    return 6 - Math.max(a, b);
  }, [50, 110, 235], [20, 40, 140]);

  // T22 home blocks. Doormat: coir brown with a dark border and a small heart; Bed: pillow + quilt; Fireplace: stone
  // bricks around a dark opening with logs and flames (4 flame frames, see flickerFire).
  const COIR = [170, 120, 70];
  each((x, y) => {
    const border = x < 2 || y < 2 || x > 13 || y > 13;
    const heart = [[6, 6], [9, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8],
      [6, 9], [7, 9], [8, 9], [9, 9], [7, 10], [8, 10]].some(([hx, hy]) => hx === x && hy === y);
    put(T.DOORMAT_TOP, x, y, heart ? [92, 40, 40] : border ? shade([110, 72, 40], 1 + (rand() - 0.5) * 0.2) : shade(COIR, 1 + (rand() - 0.5) * 0.3));
    put(T.DOORMAT_SIDE, x, y, shade(y % 3 === 1 ? [140, 96, 54] : COIR, 1 + (rand() - 0.5) * 0.2));
  });
  each((x, y) => {
    const pillow = y <= 4, seam = pillow && (y === 4 || x === 0 || x === 15 || y === 0);
    const diamond = !pillow && (Math.abs((x % 6) - 3) + Math.abs(((y - 5) % 6) - 3)) === 2;
    put(T.BED_TOP, x, y, pillow ? (seam ? [200, 200, 205] : shade([245, 245, 240], 1 + (rand() - 0.5) * 0.04))
      : diamond ? [226, 100, 108] : shade([200, 60, 70], 1 + (rand() - 0.5) * 0.08));
    const frame = y >= 11;
    put(T.BED_SIDE, x, y, frame ? shade([160, 120, 70], (y === 11 ? 0.7 : 1) * (1 + (rand() - 0.5) * 0.1))
      : y === 4 || y === 5 ? [240, 240, 235] : shade([200, 60, 70], 1 + (rand() - 0.5) * 0.08));
  });
  const brick = (tile, x, y) => {
    const mortar = y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 15;
    put(tile, x, y, mortar ? [90, 90, 90] : shade([140, 140, 140], 1 + (rand() - 0.5) * 0.12));
  };
  each((x, y) => {
    const hole = x >= 6 && x <= 9 && y >= 6 && y <= 9;
    if (hole) put(T.FIREPLACE_TOP, x, y, [30, 28, 28]); else brick(T.FIREPLACE_TOP, x, y);
  });
  const drawFire = k => {
    const r = mulberry32(700 + k * 31);
    each((x, y) => {
      const inside = x >= 3 && x <= 12 && y >= 5 && (y >= 8 || (x >= 5 && x <= 10 && y >= 6) || (x >= 4 && x <= 11 && y >= 7));
      if (!inside) { brick(T.FIREPLACE, x, y); return; }
      if (y >= 14) { put(T.FIREPLACE, x, y, shade([100, 62, 32], y === 14 ? 1 : 0.8)); return; }
      const h = 5 + Math.sin(x * 1.3 + k * 1.7) * 1.6 + r() * 1.6 - Math.abs(x - 7.5) * 0.45; // flame height from the logs up
      const up = 13 - y; // 0 at the log line
      const flame = up < h * (k === 3 ? 0.85 : 1);
      put(T.FIREPLACE, x, y, flame ? (up < h * 0.35 ? [255, 235, 120] : up < h * 0.7 ? [255, 170, 40] : [235, 90, 30]) : [34, 28, 26]);
    });
  };
  const fireFrames = [];
  for (let k = 0; k < 4; k++) {
    drawFire(k);
    fireFrames.push(g.getImageData(T.FIREPLACE * TILE, 0, TILE, TILE));
  }
  g.putImageData(fireFrames[0], T.FIREPLACE * TILE, 0);
  c.fireFrames = fireFrames;

  return c;
}

// T22: draws flame frame k % 4 of the Fireplace into the atlas canvas and returns { frame, x } (its ImageData and the
// tile's x in the atlas), so the caller can upload just that tile (re-uploading the whole atlas is slow on tablets).
export function flickerFire(atlas, k) {
  const f = atlas.fireFrames;
  if (!f) return null;
  const frame = f[((k % 4) + 4) % 4], x = T.FIREPLACE * TILE;
  atlas.getContext('2d').putImageData(frame, x, 0);
  return { frame, x };
}

// Small isometric-ish icon for a block, used by the hotbar.
export function drawBlockIcon(atlas, id, size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const def = BLOCKS[id];
  const pad = size * 0.12;
  g.drawImage(atlas, def.side * TILE, 0, TILE, TILE, pad, pad, size - pad * 2, size - pad * 2);
  return c;
}
