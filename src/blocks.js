// Block definitions and the procedurally drawn pixel-art texture atlas.

const TILE = 16;

// Tile indices inside the atlas (a grid of 16x16 tiles, see ATLAS_COLS).
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
  'ninja', // wave 12 (T37): id 113
  'tiny', 'pirate', 'racer', 'ball', // wave 14 (T40): ids 140-143
  'doodle', // wave 15 (T45): id 244
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
  ninja: [46, 40, 66],
  tiny: [230, 192, 138], pirate: [200, 90, 80], racer: [255, 150, 60], ball: [120, 190, 255],
  doodle: [236, 232, 220], // T45
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
  // T36.5 Obstacle Course: crumble, blink, zap, pusher, spring and exit pad tiles
  'CRUMBLE', 'CRUMBLE_SHAKE', 'BLINK', 'BLINK_WARN', 'ZAP_OFF_TOP', 'ZAP_WARN_TOP', 'ZAP_ON_TOP',
  'PUSHER', 'PUSHER_WARN', 'PUSHER_HEAD', 'SPRING_TOP', 'SPRING_SIDE', 'EXIT_TOP',
  'DANCE_0', 'DANCE_1', 'DANCE_2', 'DANCE_3', 'DANCE_0_LIT', 'DANCE_1_LIT', 'DANCE_2_LIT', 'DANCE_3_LIT', // Echo Gym dance floor
  // T37b Shadow Dojo: nightingale boards, tatami, paper screen, barrel, tall grass, paper lantern, stone lantern (dark / lit),
  // a watcher's lantern light on the floor, maple leaves
  'NIGHTINGALE', 'TATAMI', 'SHOJI', 'BARREL_SIDE', 'BARREL_TOP', 'TALL_GRASS', 'PAPER_LANTERN', 'STONE_LANTERN', 'STONE_LANTERN_ON',
  'LANTERN_LIGHT', 'MAPLE_LEAVES',
  // T38a swirl: the Portal Door (dim, swirling, frame), the Swirl's stone (top / side), picture frame, cloth, star stone, Wizard stone
  'PORTAL_DIM', 'PORTAL', 'PORTAL_FRAME', 'SWIRL_STONE_TOP', 'SWIRL_STONE', 'PICTURE_FRAME', 'CLOTH', 'STAR_STONE', 'WIZARD_STONE',
  // T38d swirl looks: SWIRL_PAINT and SWIRL_CLOUD must stay next to each other (one tint range, see caves.js swirlTint)
  'SWIRL_PAINT', 'SWIRL_CLOUD', 'GLOW_PUFF', 'GLOW_PUFF_MINT', 'BRISTLE_SIDE', 'BRISTLE_TOP',
  // T40 base (wave 14): a ready picture frame, the way back to the Swirl, the Boss's stand
  'PICTURE', 'WAY_BACK', 'BOSS_STAND_TOP', 'BOSS_STAND_SIDE',
  // T40d Ball Stadium: pitch stripes, chalk line, goal post, net, court floor and line, hoop, backboard, stadium seat (top / side)
  'PITCH_LIGHT', 'PITCH_DARK', 'PITCH_LINE', 'GOAL_POST', 'GOAL_NET', 'COURT_FLOOR', 'COURT_LINE', 'HOOP_RIM', 'BACKBOARD', 'SEAT_TOP', 'SEAT_SIDE',
  // T40c Race Track: asphalt, white line, chequer, kerb, boost pad (2), start light (3), tyre wall (2)
  'ASPHALT', 'TRACK_LINE', 'CHECKER', 'KERB', 'BOOST_PAD', 'BOOST_PAD_LIT', 'START_LIGHT', 'START_RED', 'START_GREEN', 'TYRE_SIDE', 'TYRE_TOP',
  // T40a Giant House: kitchen floor (two), wallpaper, counter top / cupboard side, giant wood, cookie (top / side), crumb, fan grill, chrome,
  // fan switch (off / on), toy track, train remote button, tap handle, cat fur / sleeping eye / open eye, keyhole
  'FLOOR_TILE', 'FLOOR_TILE_DARK', 'WALLPAPER', 'COUNTER_TOP', 'CUPBOARD_SIDE', 'TABLE_WOOD', 'COOKIE_TOP', 'COOKIE_SIDE', 'CRUMB', 'FAN_GRILL',
  'CHROME', 'FAN_SWITCH', 'FAN_SWITCH_ON', 'TRACK_TOP', 'REMOTE_BUTTON', 'TAP_HANDLE', 'CAT_FUR', 'CAT_EYE', 'CAT_EYE_OPEN', 'KEYHOLE',
  // T40b pirate (wave 14): ship planks, deck, rope ladder, cannon pad, target, rope post, palm, flag, chest (closed / open), wheel, coral, shell sand
  'HULL', 'DECK', 'ROPE_LADDER', 'CANNON_PAD', 'TARGET', 'ROPE_POST', 'ROPE_POST_TOP', 'PALM', 'PALM_TOP', 'PALM_LEAVES',
  'PIRATE_FLAG', 'BIG_CHEST', 'BIG_CHEST_TOP', 'BIG_CHEST_OPEN', 'WHEEL', 'CORAL', 'SHELL_SAND',
  // T45 doodle (wave 15): the blank page under the drawing, a drawn line (ink), the star pad (top / side), the sketchbook's spiral rings
  'DO_PAPER', 'DO_INK', 'DO_PAD_TOP', 'DO_PAD_SIDE', 'DO_BINDING',
];
MORE_TILES.forEach((name, i) => { T[name] = T.WOOL0 + WOOL_TYPES.length + i; });
export const TILE_COUNT = T.WOOL0 + WOOL_TYPES.length + MORE_TILES.length;
// Wave 14.5: the atlas is a grid, ATLAS_COLS tiles wide, as many rows as needed (it was one row, 256 tiles at most).
// Tile t sits at column t % ATLAS_COLS, row t / ATLAS_COLS (row 0 at the top of the canvas). Everything that finds a
// tile in the atlas goes through tileX / tileY (canvas pixels), tileUv (texture coordinates) or tileGlY (texture uploads).
export const ATLAS_COLS = 32;
export const ATLAS_ROWS = Math.ceil(TILE_COUNT / ATLAS_COLS);
export const tileX = t => (t % ATLAS_COLS) * TILE;
export const tileY = t => Math.floor(t / ATLAS_COLS) * TILE;
// The tile's y as WebGL counts it for renderer.copyTextureToTexture: from the bottom of the (flipped) texture.
export const tileGlY = t => (ATLAS_ROWS - 1) * TILE - tileY(t);
// Pushes the texture coordinates of corner (u, v) (each 0 or 1) of tile t, a hair inside the tile so its neighbours never bleed in.
export function tileUv(out, t, u, v) {
  out.push(((t % ATLAS_COLS) + (u ? 0.999 : 0.001)) / ATLAS_COLS, 1 - (Math.floor(t / ATLAS_COLS) + (v ? 0.001 : 0.999)) / ATLAS_ROWS);
}

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
  // Reserved for wave 11: 83-86 T33 (Restaurant), 87-88 T35 (Dream), 89-90 and 95-104 T36.5, 91-94 T36 (Parkour). Next free id: 105.
  WAKE_STONE: 78,
  POT: 83, POT_GOLDEN: 84, POT_BURNT: 85, STOVE: 86, // T33 Restaurant (not placeable)
  // T35 (87-88): Bounce Block and Dream Grass (natural, not placeable); 89-90 are the course's crumble blocks (T36.5).
  BOUNCE: 87, DREAM_GRASS: 88,
  // 91-94: T36 Obstacle Course blocks (not placeable). T36.5 adds 89-90 and 95-104. Next free id: 105.
  SOFT_MAT: 91, CHECKPOINT: 92, CHECKPOINT_ON: 93, BEAM: 94,
  CRUMBLE: 89, CRUMBLE_SHAKE: 90, BLINK: 95, BLINK_WARN: 96, ZAP_OFF: 97, ZAP_WARN: 98, ZAP_ON: 99,
  PUSHER: 100, PUSHER_WARN: 101, PUSHER_HEAD: 102, SPRING: 103, EXIT_PAD: 104,
  // 105-112: the Echo Gym's dance pads (red, blue, green, yellow) and their lit versions, drawn only with setLive. Next free id: 113.
  DANCE_0: 105, DANCE_1: 106, DANCE_2: 107, DANCE_3: 108, DANCE_0_LIT: 109, DANCE_1_LIT: 110, DANCE_2_LIT: 111, DANCE_3_LIT: 112,
  // 113: ninja wool (wave 12). 114-123: the Shadow Dojo (T37b, not placeable). Next free id: 124.
  NIGHTINGALE: 114, TATAMI: 115, SHOJI: 116, BARREL: 117, TALL_GRASS: 118, PAPER_LANTERN: 119,
  STONE_LANTERN: 120, STONE_LANTERN_ON: 121, LANTERN_LIGHT: 122, MAPLE_LEAVES: 123,
  // STONE_LANTERN_ON and LANTERN_LIGHT are drawn only with setLive (a lit checkpoint, a watcher's light cone).
  // 124-131: T38a, the Portal Door and the Swirl (none placeable). Next free id: 132.
  PORTAL_DIM: 124, PORTAL: 125, PORTAL_FRAME: 126, SWIRL_STONE: 127, PICTURE_FRAME: 128, CLOTH: 129, STAR_STONE: 130, WIZARD_STONE: 131,
  // 132-136: T38d, the Swirl's looks (none placeable, only in the Swirl). 137-139 are reserved for more Swirl looks. Next free id: 140.
  SWIRL_PAINT: 132, SWIRL_CLOUD: 133, GLOW_PUFF: 134, GLOW_PUFF_MINT: 135, BRISTLE: 136,
  // 140-143: wave 14 wool (tiny, pirate, racer, ball). 144-146: T40 base blocks (none placeable); 147-149 reserved for the base.
  // 150-203 belong to T40a-d (see plans/T40.md). Next free id after wave 14: 204.
  PICTURE: 144, WAY_BACK: 145, BOSS_STAND: 146,
  // 194-203: T40d, the Ball Stadium in Playland (none placeable, all fixed)
  PITCH_LIGHT: 194, PITCH_DARK: 195, PITCH_LINE: 196, GOAL_POST: 197, GOAL_NET: 198, COURT_FLOOR: 199, COURT_LINE: 200, HOOP_RIM: 201, BACKBOARD: 202, STAND_SEAT: 203,
  // 184-193: T40c, the Race Track (none placeable). BOOST_PAD_LIT, START_RED and START_GREEN are drawn only with setLive.
  ASPHALT: 184, TRACK_LINE: 185, CHECKER: 186, KERB: 187, BOOST_PAD: 188, BOOST_PAD_LIT: 189, START_LIGHT: 190, START_RED: 191, START_GREEN: 192, TYRE_WALL: 193,
  // 150-167: T40a, the Giant House (none placeable; HOUSE_FLOOR_DARK, FAN_SWITCH_ON and CAT_EYE_OPEN are drawn with setLive where they change)
  HOUSE_FLOOR: 150, HOUSE_FLOOR_DARK: 151, WALLPAPER: 152, CUPBOARD: 153, GIANT_WOOD: 154, COOKIE: 155, CRUMB: 156, FAN_GRILL: 157, FAN_SWITCH: 158, FAN_SWITCH_ON: 159,
  TRACK: 160, REMOTE_BUTTON: 161, TAP_HANDLE: 162, CAT_FUR: 163, CAT_EYE: 164, CAT_EYE_OPEN: 165, KEYHOLE: 166, CHROME: 167,
  // 250: T40a.5, the Giant House's puzzle things are models (houseprops.js); this hidden block is what you stand on, bump into and
  // tap under a model (the cat, the plug, the wind-up key...). Taken from the top so it never meets the ids wave 15 takes from 204 up.
  HOUSE_PROP: 250,
  // 168-181: T40b, the Pirate Seas (182-183 reserved; none placeable, only in the Pirate Seas)
  HULL: 168, DECK: 169, ROPE_LADDER: 170, CANNON_PAD: 171, TARGET: 172, ROPE_POST: 173, PALM_LOG: 174, PALM_LEAVES: 175,
  PIRATE_FLAG: 176, BIG_CHEST: 177, BIG_CHEST_OPEN: 178, SHIP_WHEEL: 179, CORAL: 180, SHELL_SAND: 181,
  // 244-249: T45, the Sketchbook (244 is the doodle wool; 249 reserved; none placeable, all fixed). DO_INK is drawn only with setLive.
  DO_PAPER: 245, DO_INK: 246, DO_PAD: 247, DO_BINDING: 248,
};
// Block id of each type's wool block.
// The first 19 are 20 + i; the T10 ones can't continue there (39-48 are other blocks), so they sit at 49-52.
const WOOL_ID_OVERRIDE = { sky: 49, slime: 50, light: 51, paper: 52, time: 54, camo: 55, cyber: 56, cozy: 68, treasure: 69, food: 79, squad: 80, dream: 81, parkour: 82, ninja: 113, tiny: 140, pirate: 141, racer: 142, ball: 143, doodle: 244 };
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
// T36.5 Obstacle Course blocks (none can be placed). The "live only" ones (shake, warn, zap on/warn, pusher warn/head) are drawn
// with setLive while you are near; the others are what the world holds.
const PK = T.WOOL0 + WOOL_TYPES.indexOf('parkour');
BLOCKS[B.CRUMBLE] = { name: 'Crumble Block', ...all(T.CRUMBLE), wallText: 'Crumbly! It falls soon after you step on it.' };
BLOCKS[B.CRUMBLE_SHAKE] = { name: 'Crumble Block', ...all(T.CRUMBLE_SHAKE), wallText: 'Crumbly! It falls soon after you step on it.' };
BLOCKS[B.BLINK] = { name: 'Blink Block', ...all(T.BLINK), glow: true, noLight: true, wallText: 'A blink block: it comes and goes.' };
BLOCKS[B.BLINK_WARN] = { name: 'Blink Block', ...all(T.BLINK_WARN), glow: true, noLight: true, wallText: 'A blink block: it comes and goes.' };
BLOCKS[B.ZAP_OFF] = { name: 'Zap Tile', top: T.ZAP_OFF_TOP, side: PK, bottom: PK, wallText: 'A zap tile! Cross it when it is dark.' };
BLOCKS[B.ZAP_WARN] = { name: 'Zap Tile', top: T.ZAP_WARN_TOP, side: PK, bottom: PK, glow: true, noLight: true, wallText: 'A zap tile! Cross it when it is dark.' };
BLOCKS[B.ZAP_ON] = { name: 'Zap Tile', top: T.ZAP_ON_TOP, side: PK, bottom: PK, glow: true, noLight: true, wallText: 'A zap tile! Cross it when it is dark.' };
BLOCKS[B.PUSHER] = { name: 'Pusher', ...all(T.PUSHER), wallText: 'A pusher! Go when it pulls back.' };
BLOCKS[B.PUSHER_WARN] = { name: 'Pusher', ...all(T.PUSHER_WARN), glow: true, noLight: true, wallText: 'A pusher! Go when it pulls back.' };
BLOCKS[B.PUSHER_HEAD] = { name: 'Pusher', ...all(T.PUSHER_HEAD), wallText: 'A pusher! Go when it pulls back.' };
BLOCKS[B.SPRING] = { name: 'Spring', top: T.SPRING_TOP, side: T.SPRING_SIDE, bottom: T.SPRING_SIDE, glow: true, noLight: true, bounce: 4, wallText: 'A spring! Jump on it to fly up.' };
// EXIT_PAD (104) is no longer in the world (WORLD_VERSION 16); the id stays reserved.
BLOCKS[B.EXIT_PAD] = { name: 'Exit Pad', top: T.EXIT_TOP, side: PK, bottom: PK, glow: true, noLight: true, wallText: 'Stand on it to go back down.' };
// Echo Gym dance pads (not placeable): the world holds the gym's planks; the pads are drawn per player with setLive.
for (let k = 0; k < 4; k++) {
  const text = 'The dance floor! Talk to Leader Melody for a dance-off.';
  BLOCKS[B[`DANCE_${k}`]] = { name: 'Dance Pad', ...all(T[`DANCE_${k}`]), wallText: text };
  BLOCKS[B[`DANCE_${k}_LIT`]] = { name: 'Dance Pad', ...all(T[`DANCE_${k}_LIT`]), glow: true, noLight: true, wallText: text };
}
// T35: the Bounce Block (jump on it to fly `bounce` blocks up; `fixed` = nobody can break or replace it) and Dream Grass.
BLOCKS[B.BOUNCE] = { name: 'Bounce Block', top: T.BOUNCE_TOP, side: T.BOUNCE_SIDE, bottom: T.BOUNCE_SIDE, glow: true, noLight: true, bounce: 14, fixed: true, wallText: "It's too springy to break! Jump on it instead." };
BLOCKS[B.DREAM_GRASS] = { name: 'Dream Grass', top: T.DREAM_GRASS_TOP, side: T.DREAM_GRASS_SIDE, bottom: T.CLOUD };
// T37b Shadow Dojo blocks (not placeable). The lit stone lantern and the lantern light are drawn only with setLive.
BLOCKS[B.NIGHTINGALE] = { name: 'Nightingale Floor', ...all(T.NIGHTINGALE), wallText: 'Squeaky golden boards! Walk softly, never run.' };
BLOCKS[B.TATAMI] = { name: 'Tatami Mat', top: T.TATAMI, side: T.PLANKS, bottom: T.PLANKS, wallText: 'A soft tatami mat. It is always quiet.' };
BLOCKS[B.SHOJI] = { name: 'Paper Screen', ...all(T.SHOJI), wallText: 'A paper screen. Hide behind it!' };
BLOCKS[B.BARREL] = { name: 'Barrel', top: T.BARREL_TOP, side: T.BARREL_SIDE, bottom: T.BARREL_TOP, wallText: 'A big barrel. Hide between the barrels!' };
BLOCKS[B.TALL_GRASS] = { name: 'Tall Grass', ...all(T.TALL_GRASS), wallText: 'Tall grass. Step into the gap to hide!' };
BLOCKS[B.PAPER_LANTERN] = { name: 'Paper Lantern', ...all(T.PAPER_LANTERN), glow: true, wallText: 'A paper lantern. It lights the garden.' };
BLOCKS[B.STONE_LANTERN] = { name: 'Stone Lantern', ...all(T.STONE_LANTERN), wallText: 'A stone lantern. Walk past it: if a watcher spots you, you come back here.' };
BLOCKS[B.STONE_LANTERN_ON] = { name: 'Stone Lantern', ...all(T.STONE_LANTERN_ON), glow: true, noLight: true, wallText: 'A stone lantern. Walk past it: if a watcher spots you, you come back here.' };
BLOCKS[B.LANTERN_LIGHT] = { name: 'Lantern Light', ...all(T.LANTERN_LIGHT), glow: true, noLight: true, wallText: "A watcher's lantern light. Stay out of it!" };
BLOCKS[B.MAPLE_LEAVES] = { name: 'Maple Leaves', ...all(T.MAPLE_LEAVES), wallText: 'Red maple leaves. So pretty at dusk!' };
// T38a: the Portal Door and the Swirl. None can be placed; 125-131 are `fixed` (nobody can break or replace them).
// PORTAL_DIM is what the main world holds; Champions see PORTAL (setLive). STAR_STONE is drawn only with setLive.
BLOCKS[B.PORTAL_DIM] = { name: 'Portal Door', ...all(T.PORTAL_DIM), wallText: 'Only a Champion can open this door. Win in the tower first!' };
BLOCKS[B.PORTAL] = { name: 'Portal Door', ...all(T.PORTAL), glow: true, noLight: true, fixed: true, wallText: 'Step into the swirl! (press E or tap)' };
BLOCKS[B.PORTAL_FRAME] = { name: 'Portal Frame', ...all(T.PORTAL_FRAME), glow: true, noLight: true, fixed: true, wallText: "The Portal Door is made of magic. It can't break!" };
BLOCKS[B.SWIRL_STONE] = { name: 'Swirl Stone', top: T.SWIRL_STONE_TOP, side: T.SWIRL_STONE, bottom: T.SWIRL_STONE, fixed: true, wallText: 'Swirl Stone is too magic to break. You can build on it!' };
BLOCKS[B.PICTURE_FRAME] = { name: 'Picture Frame', ...all(T.PICTURE_FRAME), fixed: true, wallText: 'A picture frame. Somebody magic hung it here.' };
BLOCKS[B.CLOTH] = { name: 'Cloth', ...all(T.CLOTH), fixed: true, wallText: 'A cloth covers the picture. This world is not open yet!' };
BLOCKS[B.STAR_STONE] = { name: 'Star Stone', ...all(T.STAR_STONE), glow: true, noLight: true, fixed: true, wallText: 'A star stone. It lit up because you won a star!' };
BLOCKS[B.WIZARD_STONE] = { name: 'Wizard Stone', ...all(T.WIZARD_STONE), fixed: true, wallText: 'The Wizard is inside, holding the Swirl together. Bring him stars!' };
// T38d: the Swirl's looks. Paint and Cloud are tinted by the zone you are in (caves.js swirlTint); Glow Puffs glow and light their cells.
BLOCKS[B.SWIRL_PAINT] = { name: 'Swirl Paint', ...all(T.SWIRL_PAINT), fixed: true, wallText: 'Wet paint that never dries. Too magic to break!' };
BLOCKS[B.SWIRL_CLOUD] = { name: 'Swirl Cloud', ...all(T.SWIRL_CLOUD), fixed: true, wallText: 'A soft Swirl cloud. It holds you up!' };
BLOCKS[B.GLOW_PUFF] = { name: 'Glow Puff', ...all(T.GLOW_PUFF), glow: true, fixed: true, wallText: 'A glowing puff. Too magic to break!' };
BLOCKS[B.GLOW_PUFF_MINT] = { name: 'Glow Puff', ...all(T.GLOW_PUFF_MINT), glow: true, fixed: true, wallText: 'A glowing puff. Too magic to break!' };
BLOCKS[B.BRISTLE] = { name: 'Brush Bristles', top: T.BRISTLE_TOP, side: T.BRISTLE_SIDE, bottom: T.BRISTLE_TOP, fixed: true, wallText: 'The giant paintbrush is too big to break!' };
// T40 base: PICTURE is drawn only with setLive (a ready frame in the Swirl); WAY_BACK is the picture you step into to go back up
BLOCKS[B.PICTURE] = { name: 'Picture', ...all(T.PICTURE), glow: true, noLight: true, fixed: true, wallText: "It's a picture of another world. Step in! (press E or tap)" };
BLOCKS[B.WAY_BACK] = { name: 'Way Back', ...all(T.WAY_BACK), glow: true, noLight: true, fixed: true, wallText: 'This is the way back to the Swirl. Step in!' };
BLOCKS[B.BOSS_STAND] = { name: 'Boss Stand', top: T.BOSS_STAND_TOP, side: T.BOSS_STAND_SIDE, bottom: T.BOSS_STAND_SIDE, fixed: true, wallText: 'The Boss stands here!' };
// T40d Ball Stadium: none placeable, all `fixed`. The hoop glows (easy to see from far) without lighting anything.
{
  const PITCH = 'This is the football pitch! Kick the ball into a goal.', GOAL = 'The goal! Kick the ball in here.', HOOPS = 'Shoot hoops! Tap Shoot! next to the ball.';
  BLOCKS[B.PITCH_LIGHT] = { name: 'Pitch Grass', top: T.PITCH_LIGHT, side: T.GRASS_SIDE, bottom: T.DIRT, fixed: true, wallText: PITCH };
  BLOCKS[B.PITCH_DARK] = { name: 'Pitch Grass', top: T.PITCH_DARK, side: T.GRASS_SIDE, bottom: T.DIRT, fixed: true, wallText: PITCH };
  BLOCKS[B.PITCH_LINE] = { name: 'Chalk Line', top: T.PITCH_LINE, side: T.GRASS_SIDE, bottom: T.DIRT, fixed: true, wallText: PITCH };
  BLOCKS[B.GOAL_POST] = { name: 'Goal Post', ...all(T.GOAL_POST), fixed: true, wallText: GOAL };
  BLOCKS[B.GOAL_NET] = { name: 'Goal Net', ...all(T.GOAL_NET), fixed: true, wallText: GOAL };
  BLOCKS[B.COURT_FLOOR] = { name: 'Court Floor', top: T.COURT_FLOOR, side: T.PLANKS, bottom: T.PLANKS, fixed: true, wallText: HOOPS };
  BLOCKS[B.COURT_LINE] = { name: 'Court Line', top: T.COURT_LINE, side: T.PLANKS, bottom: T.PLANKS, fixed: true, wallText: HOOPS };
  BLOCKS[B.HOOP_RIM] = { name: 'Hoop', ...all(T.HOOP_RIM), glow: true, noLight: true, fixed: true, wallText: HOOPS };
  BLOCKS[B.BACKBOARD] = { name: 'Backboard', ...all(T.BACKBOARD), fixed: true, wallText: HOOPS };
  BLOCKS[B.STAND_SEAT] = { name: 'Stadium Seat', top: T.SEAT_TOP, side: T.SEAT_SIDE, bottom: T.SEAT_SIDE, fixed: true, wallText: 'The stands. Go down onto the pitch!' };
}
// T40c Race Track: all fixed (nobody breaks or replaces them), none placeable. The lit pads and lamps glow without lighting anything.
BLOCKS[B.ASPHALT] = { name: 'Asphalt', ...all(T.ASPHALT), fixed: true, wallText: "That's the race track. Too tough to dig!" };
BLOCKS[B.TRACK_LINE] = { name: 'Track Line', top: T.TRACK_LINE, side: T.ASPHALT, bottom: T.ASPHALT, fixed: true, wallText: "That's the race track. Too tough to dig!" };
BLOCKS[B.CHECKER] = { name: 'Chequer', ...all(T.CHECKER), fixed: true, wallText: 'The start and finish line. Too tough to dig!' };
BLOCKS[B.KERB] = { name: 'Kerb', top: T.KERB, side: T.ASPHALT, bottom: T.ASPHALT, fixed: true, wallText: "That's the race track. Too tough to dig!" };
BLOCKS[B.BOOST_PAD] = { name: 'Boost Pad', top: T.BOOST_PAD, side: T.ASPHALT, bottom: T.ASPHALT, glow: true, noLight: true, fixed: true, wallText: 'A boost pad! Run over it. Zoom!' };
BLOCKS[B.BOOST_PAD_LIT] = { name: 'Boost Pad', top: T.BOOST_PAD_LIT, side: T.ASPHALT, bottom: T.ASPHALT, glow: true, noLight: true, fixed: true, wallText: 'A boost pad! Run over it. Zoom!' };
BLOCKS[B.START_LIGHT] = { name: 'Start Light', ...all(T.START_LIGHT), fixed: true, wallText: 'The start lights. Wait for green!' };
BLOCKS[B.START_RED] = { name: 'Start Light', ...all(T.START_RED), glow: true, noLight: true, fixed: true, wallText: 'The start lights. Wait for green!' };
BLOCKS[B.START_GREEN] = { name: 'Start Light', ...all(T.START_GREEN), glow: true, noLight: true, fixed: true, wallText: 'The start lights. Wait for green!' };
BLOCKS[B.TYRE_WALL] = { name: 'Tyre Wall', top: T.TYRE_TOP, side: T.TYRE_SIDE, bottom: T.TYRE_TOP, fixed: true, wallText: 'Bouncy tyres keep racers on the track.' };
// T40a: the Giant House (everything is `fixed` except the crumbs, which you pick up with a click through houselive.js)
{
  const HOUSE = "It's the Wizard's house. Everything is too big to change!", fx = { fixed: true };
  const cyberTile = T.WOOL0 + WOOL_TYPES.indexOf('cyber');
  BLOCKS[B.HOUSE_FLOOR] = { name: 'Kitchen Floor', ...all(T.FLOOR_TILE), ...fx, wallText: 'The kitchen floor. Far too big to dig!' };
  BLOCKS[B.HOUSE_FLOOR_DARK] = { name: 'Kitchen Floor', ...all(T.FLOOR_TILE_DARK), ...fx, wallText: 'The kitchen floor. Far too big to dig!' };
  BLOCKS[B.WALLPAPER] = { name: 'Wallpaper', ...all(T.WALLPAPER), ...fx, wallText: "It's the wall of the house. Too big to break!" };
  BLOCKS[B.CUPBOARD] = { name: 'Cupboard', top: T.COUNTER_TOP, side: T.CUPBOARD_SIDE, bottom: T.CUPBOARD_SIDE, ...fx, wallText: HOUSE };
  BLOCKS[B.GIANT_WOOD] = { name: 'Giant Wood', ...all(T.TABLE_WOOD), ...fx, wallText: 'Giant furniture! Too big to break.' };
  BLOCKS[B.COOKIE] = { name: 'Giant Cookie', top: T.COOKIE_TOP, side: T.COOKIE_SIDE, bottom: T.COOKIE_SIDE, ...fx, wallText: "Yum! But it is Nibbles' cookie." };
  BLOCKS[B.CRUMB] = { name: 'Cookie Crumb', ...all(T.CRUMB), glow: true, noLight: true, wallText: 'A cookie crumb! Pick it up.' };
  BLOCKS[B.FAN_GRILL] = { name: 'Fan Grill', top: T.FAN_GRILL, side: T.CHROME, bottom: T.CHROME, ...fx, wallText: HOUSE };
  BLOCKS[B.FAN_SWITCH] = { name: 'Fan Switch', ...all(T.FAN_SWITCH), ...fx, wallText: "It's the fan's switch. Press it!" };
  BLOCKS[B.FAN_SWITCH_ON] = { name: 'Fan Switch', ...all(T.FAN_SWITCH_ON), glow: true, noLight: true, ...fx, wallText: "It's the fan's switch. Press it!" };
  BLOCKS[B.TRACK] = { name: 'Toy Track', top: T.TRACK_TOP, side: T.TABLE_WOOD, bottom: T.TABLE_WOOD, ...fx, wallText: HOUSE };
  BLOCKS[B.REMOTE_BUTTON] = { name: 'Train Remote', top: T.REMOTE_BUTTON, side: cyberTile, bottom: cyberTile, glow: true, noLight: true, ...fx, wallText: "It's the train's remote. Press it!" };
  BLOCKS[B.TAP_HANDLE] = { name: 'Tap Handle', ...all(T.TAP_HANDLE), ...fx, wallText: "It's the tap. Turn it on!" };
  BLOCKS[B.CAT_FUR] = { name: 'Cat Fur', ...all(T.CAT_FUR), ...fx, wallText: 'Shh! Let the cat sleep.' };
  BLOCKS[B.CAT_EYE] = { name: 'Sleepy Cat', ...all(T.CAT_EYE), ...fx, wallText: 'Shh! Let the cat sleep.' };
  BLOCKS[B.CAT_EYE_OPEN] = { name: 'Cat Eye', ...all(T.CAT_EYE_OPEN), ...fx, wallText: 'Shh! Let the cat sleep.' };
  BLOCKS[B.KEYHOLE] = { name: 'Keyhole', ...all(T.KEYHOLE), ...fx, wallText: 'A brass keyhole. You are small enough to squeeze through!' };
  BLOCKS[B.CHROME] = { name: 'Shiny Metal', ...all(T.CHROME), ...fx, wallText: HOUSE };
  BLOCKS[B.HOUSE_PROP] = { name: 'Giant House thing', ...all(T.CHROME), ...fx, hidden: true, wallText: HOUSE }; // never drawn: a model shows it
}
// T40b Pirate Seas blocks (none can be placed). Gadget blocks are `fixed`; palm, coral and shell sand are natural (breakable, no cubes).
BLOCKS[B.HULL] = { name: 'Ship Planks', ...all(T.HULL), wallText: "Captain Squawk's ship is too strong to break!" };
BLOCKS[B.DECK] = { name: 'Deck', top: T.DECK, side: T.PLANKS, bottom: T.PLANKS, wallText: "Captain Squawk's ship is too strong to break!" };
BLOCKS[B.ROPE_LADDER] = { name: 'Rope Ladder', top: T.HULL, side: T.ROPE_LADDER, bottom: T.HULL, fixed: true, wallText: 'A rope ladder! Swim into it and up you go.' };
BLOCKS[B.CANNON_PAD] = { name: 'Cannon Pad', top: T.CANNON_PAD, side: T.PLANKS, bottom: T.PLANKS, fixed: true, wallText: 'Stand on the cannon and press Fire!' };
BLOCKS[B.TARGET] = { name: 'Target', top: T.TARGET, side: T.SAND, bottom: T.SAND, fixed: true, wallText: 'The cannon lands here. Boom!' };
BLOCKS[B.ROPE_POST] = { name: 'Rope Post', top: T.ROPE_POST_TOP, side: T.ROPE_POST, bottom: T.ROPE_POST_TOP, fixed: true, wallText: 'A rope post. Stand here and press Swing!' };
BLOCKS[B.PALM_LOG] = { name: 'Palm Log', top: T.PALM_TOP, side: T.PALM, bottom: T.PALM_TOP };
BLOCKS[B.PALM_LEAVES] = { name: 'Palm Leaves', ...all(T.PALM_LEAVES) };
BLOCKS[B.PIRATE_FLAG] = { name: 'Pirate Flag', ...all(T.PIRATE_FLAG), fixed: true, wallText: 'A pirate flag with a parrot feather and two spoons. Squawk!' };
BLOCKS[B.BIG_CHEST] = { name: "Captain's Chest", top: T.BIG_CHEST_TOP, side: T.BIG_CHEST, bottom: T.BIG_CHEST_TOP, fixed: true, wallText: "Captain Squawk's treasure chest! It's locked tight." };
BLOCKS[B.BIG_CHEST_OPEN] = { name: "Captain's Chest", top: T.BIG_CHEST_OPEN, side: T.BIG_CHEST, bottom: T.BIG_CHEST_TOP, glow: true, noLight: true, fixed: true, wallText: 'Only gold coins left. Squawk!' };
BLOCKS[B.SHIP_WHEEL] = { name: 'Ship Wheel', top: T.PLANKS, side: T.WHEEL, bottom: T.PLANKS, fixed: true, wallText: "The Captain's wheel. Only he steers this ship!" };
BLOCKS[B.CORAL] = { name: 'Coral', ...all(T.CORAL) };
BLOCKS[B.SHELL_SAND] = { name: 'Shell Sand', ...all(T.SHELL_SAND) };
// T45 Sketchbook blocks (none placeable, all fixed). The ink is drawn only with setLive (the pencil draws a line as you follow its tip).
BLOCKS[B.DO_PAPER] = { name: 'Blank Page', ...all(T.DO_PAPER), fixed: true, wallText: "It's the blank page under the drawing." };
BLOCKS[B.DO_INK] = { name: 'Pencil Line', ...all(T.DO_INK), fixed: true, wallText: "The pencil drew this. You can't rub it out!" };
BLOCKS[B.DO_PAD] = { name: 'Star Pad', top: T.DO_PAD_TOP, side: T.DO_PAD_SIDE, bottom: T.DO_PAD_SIDE, fixed: true, wallText: 'Stand on the star pad and press Draw!' };
BLOCKS[B.DO_BINDING] = { name: 'Sketchbook Rings', ...all(T.DO_BINDING), fixed: true, wallText: "The sketchbook's spiral rings. Too big to break!" };
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
const SEE_THROUGH = new Set([B.AIR, B.WATER, B.LEAVES, B.PINE_LEAVES, B.FLOWER_BUSH, B.GLASS, B.MAPLE_LEAVES, B.HOUSE_PROP]);
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
  c.width = TILE * ATLAS_COLS;
  c.height = TILE * ATLAS_ROWS;
  const g = c.getContext('2d');
  const rand = mulberry32(42);

  const put = (t, x, y, col) => {
    g.fillStyle = `rgb(${clamp(col[0])},${clamp(col[1])},${clamp(col[2])})`;
    g.fillRect(tileX(t) + x, tileY(t) + y, 1, 1);
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
                                : t === 'doodle' ? (y % 5 === 2 ? [176, 200, 232] : WOOL_RGB[t]) // T45: notebook paper with blue ruled lines
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
  g.clearRect(tileX(T.GLASS), tileY(T.GLASS), TILE, TILE);
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
  { // T36.5 Obstacle Course tiles (own random numbers).
    const r4 = mulberry32(3650);
    const edge = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
    // Crumble: a sandy biscuit with thin cracks; the shaking one has many dark cracks and missing corners.
    const crack = (x, y) => (x * 3 + y * 5) % 11 === 0 || (x + 2 * y) % 13 === 1;
    each((x, y) => {
      const biscuit = shade([222, 188, 120], 1 + (r4() - 0.5) * 0.1);
      put(T.CRUMBLE, x, y, edge(x, y) ? [176, 138, 80] : (x * 5 + y * 3) % 17 === 0 ? [168, 130, 76] : biscuit);
      const corner = (x < 3 && y < 3) || (x > 12 && y > 12);
      put(T.CRUMBLE_SHAKE, x, y, corner ? [40, 30, 24] : crack(x, y) || (x + y) % 6 === 0 ? [70, 46, 24] : edge(x, y) ? [120, 86, 50] : shade([206, 166, 98], 1 + (r4() - 0.5) * 0.1));
    });
    // Blink: bright cyan glass with a white frame; the warning one has orange-red stripes.
    each((x, y) => {
      put(T.BLINK, x, y, edge(x, y) ? [255, 255, 255] : x === 1 || y === 1 || x === 14 || y === 14 ? [120, 220, 255] : shade([60, 200, 240], 1 + (r4() - 0.5) * 0.08));
      put(T.BLINK_WARN, x, y, edge(x, y) ? [255, 255, 255] : ((x + y) >> 1) % 2 ? [255, 90, 40] : [255, 190, 60]);
    });
    // Zap tile tops: dark tile with a red zigzag outline; half lit orange; on = bright red/yellow electric zigzag.
    const zig = (x, y) => Math.abs(y - (7.5 + (((x >> 1) % 2) ? 3.5 : -3.5))) < 1.3 || Math.abs(x - 7.5) > 6 && Math.abs(y - 7.5) > 3 && ((x + y) % 4 === 0);
    each((x, y) => {
      const zz = zig(x, y), line = edge(x, y);
      put(T.ZAP_OFF_TOP, x, y, line ? [200, 40, 40] : zz ? [170, 36, 36] : shade([52, 52, 60], 1 + (r4() - 0.5) * 0.08));
      put(T.ZAP_WARN_TOP, x, y, line ? [255, 150, 40] : zz && x < 8 ? [255, 190, 70] : zz ? [170, 36, 36] : shade([66, 56, 56], 1 + (r4() - 0.5) * 0.08));
      put(T.ZAP_ON_TOP, x, y, line ? [255, 240, 80] : zz ? [255, 255, 200] : (x + y) % 3 === 0 ? [255, 190, 40] : [235, 40, 30]);
    });
    // Pusher: grey metal box with yellow-black hazard stripes; warning = red stripes and a white "!".
    const bang = (x, y) => (x === 7 || x === 8) && (y >= 3 && y <= 9 || y === 12);
    each((x, y) => {
      const stripe = ((x + y) >> 2) % 2;
      put(T.PUSHER, x, y, edge(x, y) ? [60, 60, 66] : stripe ? [250, 210, 40] : [40, 40, 44]);
      put(T.PUSHER_WARN, x, y, bang(x, y) ? [255, 255, 255] : edge(x, y) ? [255, 255, 255] : stripe ? [235, 40, 40] : [120, 16, 20]);
      const d = Math.hypot(x - 7.5, y - 7.5);
      put(T.PUSHER_HEAD, x, y, d > 7 || edge(x, y) ? [255, 255, 255] : d < 3.5 ? [255, 120, 120] : shade([220, 40, 50], 1 + (r4() - 0.5) * 0.08));
    });
    // Spring: green with a yellow coil spiral on top; green / yellow bands on the sides.
    each((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5), ring = Math.abs(((d * 1.2 + Math.atan2(y - 7.5, x - 7.5) / 1.6) % 3 + 3) % 3) < 1.1;
      put(T.SPRING_TOP, x, y, edge(x, y) ? [30, 120, 50] : ring ? [255, 220, 60] : [60, 190, 90]);
      put(T.SPRING_SIDE, x, y, y % 4 < 2 ? [60, 190, 90] : [255, 220, 60]);
    });
    // Exit pad: green with a big white down arrow.
    each((x, y) => {
      const arrow = (x >= 6 && x <= 9 && y >= 2 && y <= 8) || (y >= 8 && y <= 13 && Math.abs(x - 7.5) <= 13.5 - y - 0.5);
      put(T.EXIT_TOP, x, y, arrow ? [255, 255, 255] : edge(x, y) ? [20, 120, 50] : shade([50, 190, 90], 1 + (r4() - 0.5) * 0.06));
    });
  }
  { // Echo Gym dance pads: a coloured tile with a light border and a note in the middle; lit = bright with a white glow.
    const PADS = [[230, 60, 70], [60, 120, 235], [60, 190, 90], [245, 205, 50]];
    const note = (x, y) => (Math.hypot(x - 6, y - 10.5) < 2.2) || (x === 8 && y >= 3 && y <= 10) || (y === 3 && x >= 8 && x <= 11) || (y === 4 && x >= 10 && x <= 11);
    PADS.forEach((c, k) => each((x, y) => {
      const rim = x === 0 || y === 0 || x === 15 || y === 15, inner = x === 1 || y === 1 || x === 14 || y === 14;
      put(T[`DANCE_${k}`], x, y, rim ? [40, 36, 50] : inner ? shade(c, 0.55) : note(x, y) ? shade(c, 0.45) : shade(c, 0.72));
      put(T[`DANCE_${k}_LIT`], x, y, rim ? [255, 255, 255] : inner ? shade(c, 1.25) : note(x, y) ? [255, 255, 255] : shade(c, 1.15));
    }));
  }
  { // T37b Shadow Dojo tiles (own random numbers, so no older tile changes).
    const r5 = mulberry32(3737);
    const edge = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
    each((x, y) => {
      // Nightingale boards: golden planks in four rows with dark seams and little nail dots.
      const seam = y % 4 === 3, nail = y % 4 === 1 && (x + (y >> 2) * 5) % 8 === 2;
      put(T.NIGHTINGALE, x, y, seam ? [120, 84, 20] : nail ? [250, 236, 160] : shade([226, 178, 64], 1 + (r5() - 0.5) * 0.14 + (x % 7 === 0 ? -0.08 : 0)));
      // Tatami: straw green with woven lines and a dark cloth border on two sides.
      const border = y < 2 || y > 13;
      put(T.TATAMI, x, y, border ? (y === 0 || y === 15 ? [30, 40, 30] : [44, 66, 44]) : shade(x % 2 ? [176, 186, 112] : [164, 176, 100], 1 + (r5() - 0.5) * 0.08));
      // Paper screen: white paper in a dark wooden grid.
      const wood = x === 0 || x === 15 || y === 0 || y === 15 || x === 5 || x === 10 || y === 5 || y === 10;
      put(T.SHOJI, x, y, wood ? [70, 46, 30] : shade([246, 238, 214], 1 + (r5() - 0.5) * 0.04));
      // Barrel: brown staves with two dark iron hoops; the top is a round lid.
      const hoop = y === 3 || y === 4 || y === 11 || y === 12;
      put(T.BARREL_SIDE, x, y, hoop ? [54, 50, 52] : shade(x % 4 === 0 ? [118, 74, 40] : [150, 98, 52], 1 + (r5() - 0.5) * 0.1));
      const dl = Math.hypot(x - 7.5, y - 7.5);
      put(T.BARREL_TOP, x, y, dl > 7 ? [54, 50, 52] : dl > 6 ? [118, 74, 40] : shade(y % 3 ? [170, 116, 64] : [146, 98, 54], 1 + (r5() - 0.5) * 0.08));
      // Tall grass: thick blades in dusky greens.
      const blade = (x * 7 + ((y * 3) >> 2)) % 5;
      put(T.TALL_GRASS, x, y, blade === 0 ? [30, 64, 34] : blade === 2 ? shade([96, 150, 64], 1 + (r5() - 0.5) * 0.2) : shade([62, 116, 52], 1 + (r5() - 0.5) * 0.25));
      // Paper lantern: red paper with dark caps, gold bands and thin ribs.
      const cap = y < 2 || y > 13, rib = y % 3 === 0, lx = Math.abs(x - 7.5);
      put(T.PAPER_LANTERN, x, y, cap ? [60, 40, 30] : y === 2 || y === 13 ? [240, 190, 70] : rib ? [210, 70, 50] : shade([255, 120 - lx * 6, 70 - lx * 3], 1 + (r5() - 0.5) * 0.06));
      // Stone lantern: grey stone with a window; dark when unlit, warm orange when lit.
      const win = x >= 4 && x <= 11 && y >= 4 && y <= 10;
      put(T.STONE_LANTERN, x, y, win ? [36, 32, 34] : edge(x, y) ? [104, 102, 96] : shade([150, 148, 140], 1 + (r5() - 0.5) * 0.18));
      put(T.STONE_LANTERN_ON, x, y, win ? (Math.hypot(x - 7.5, y - 7) < 2.4 ? [255, 250, 200] : [255, 186, 70]) : edge(x, y) ? [130, 120, 100] : shade([176, 168, 150], 1 + (r5() - 0.5) * 0.12));
      // A watcher's lantern light on the floor: warm yellow, brightest in the middle.
      put(T.LANTERN_LIGHT, x, y, shade([255, 214, 110], 1.05 - dl * 0.03 + (r5() - 0.5) * 0.05));
      // Maple leaves: red and orange with a few dark gaps.
      const r = r5();
      put(T.MAPLE_LEAVES, x, y, r < 0.1 ? [70, 20, 18] : r < 0.4 ? shade([236, 110, 40], 1 + (r5() - 0.5) * 0.2) : shade([200, 44, 40], 1 + (r5() - 0.5) * 0.3));
    });
  }
  { // T38a swirl tiles (own random numbers). The Portal Door is a purple and pink spiral; 4 frames turn it (see swirlPortal).
    const r6 = mulberry32(3838);
    const edge = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
    const spiral = (x, y, turn) => {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const v = Math.sin(a * 2 + d * 0.9 - turn * Math.PI / 2);
      return d < 1.4 ? [255, 255, 255] : v > 0.35 ? [255, 140, 220] : v > -0.35 ? [170, 90, 240] : [90, 40, 170];
    };
    each((x, y) => {
      put(T.PORTAL_DIM, x, y, spiral(x, y, 0).map(v => v * 0.38 + 30));
      put(T.PORTAL, x, y, spiral(x, y, 0));
      put(T.PORTAL_FRAME, x, y, edge(x, y) ? [120, 70, 200] : (x + y) % 6 === 0 ? [255, 235, 150] : shade([190, 150, 250], 1 + (r6() - 0.5) * 0.14));
      const swirlBand = ((x + y * 2) >> 2) % 2 === 0;
      put(T.SWIRL_STONE_TOP, x, y, shade(swirlBand ? [150, 110, 220] : [118, 84, 190], 1 + (r6() - 0.5) * 0.1));
      put(T.SWIRL_STONE, x, y, edge(x, y) ? [84, 56, 150] : shade(y % 5 < 2 ? [112, 80, 184] : [132, 98, 206], 1 + (r6() - 0.5) * 0.1));
      const inner = x >= 3 && x <= 12 && y >= 3 && y <= 12;
      put(T.PICTURE_FRAME, x, y, edge(x, y) ? [96, 60, 20] : inner ? shade([226, 188, 90], 1 + (r6() - 0.5) * 0.1) : shade([200, 150, 52], 1 + (r6() - 0.5) * 0.14));
      const fold = Math.sin(x * 0.9 + Math.sin(y * 0.5) * 1.6);
      put(T.CLOTH, x, y, shade([176, 70, 110], 0.8 + 0.22 * fold + (r6() - 0.5) * 0.06));
      const dd = Math.hypot(x - 7.5, y - 7.5), starRay = Math.abs(x - 7.5) < 1 || Math.abs(y - 7.5) < 1 || Math.abs(Math.abs(x - 7.5) - Math.abs(y - 7.5)) < 1;
      put(T.STAR_STONE, x, y, dd < 2.5 ? [255, 255, 235] : starRay && dd < 7 ? [255, 226, 110] : edge(x, y) ? [210, 160, 40] : shade([250, 200, 70], 1 + (r6() - 0.5) * 0.1));
      const star = r6() < 0.07;
      put(T.WIZARD_STONE, x, y, star ? [235, 240, 255] : edge(x, y) ? [18, 28, 80] : shade([30, 46, 120], 1 + (r6() - 0.5) * 0.2));
    });
    const turnFrames = [];
    for (let k = 0; k < 4; k++) {
      each((x, y) => put(T.PORTAL, x, y, spiral(x, y, k)));
      turnFrames.push(g.getImageData(tileX(T.PORTAL), tileY(T.PORTAL), TILE, TILE));
    }
    g.putImageData(turnFrames[0], tileX(T.PORTAL), tileY(T.PORTAL));
    c.portalFrames = turnFrames;
  }
  { // T38d swirl looks (own random numbers): pale canvas stone, wet paint, cloud, glow puffs, brush bristles
    const r7 = mulberry32(3842);
    const sh = (col, a) => shade(col, 1 + (r7() - 0.5) * a);
    each((x, y) => {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const spiral = (((a / (Math.PI * 2)) * 16 + d + 64) % 4) < 1;
      put(T.SWIRL_STONE_TOP, x, y, sh(spiral ? [212, 208, 220] : [240, 236, 244], 0.05));
      const stroke = y % 4 === 1 && ((x * 7 + (y >> 2) * 5) % 13) < 8;
      put(T.SWIRL_STONE, x, y, y === 15 ? [200, 196, 210] : sh(stroke ? [214, 210, 222] : [232, 228, 238], 0.05));
      put(T.SWIRL_PAINT, x, y, sh((((a / (Math.PI * 2)) * 16 + d + 64) % 4) < 1 ? [238, 230, 250] : [204, 190, 232], 0.06));
      const blot = Math.sin(x * 0.9 + Math.sin(y * 0.7) * 1.4) + Math.sin(y * 0.8 + x * 0.3) > 0.9;
      put(T.SWIRL_CLOUD, x, y, sh(blot ? [232, 230, 238] : [246, 244, 250], 0.04));
      const bump = Math.sin(a * 4) * 0.8;
      put(T.GLOW_PUFF, x, y, d < 3 ? [255, 238, 248] : d < 6 + bump ? [255, 214, 236] : d < 7.5 ? [255, 176, 218] : [240, 140, 200]);
      put(T.GLOW_PUFF_MINT, x, y, d < 3 ? [240, 255, 250] : d < 6 + bump ? [190, 245, 228] : d < 7.5 ? [140, 228, 206] : [90, 200, 180]);
      put(T.BRISTLE_SIDE, x, y, sh(x % 2 ? [250, 242, 224] : [228, 212, 180], 0.06 + (y > 11 ? 0.2 : 0)));
      put(T.BRISTLE_TOP, x, y, sh([246, 128, 186], 0.06));
    });
    each((x, y) => { if (r7() < 0.012) put(T.SWIRL_CLOUD, x, y, [255, 255, 255]); });
  }
  { // T40 base blocks (own random numbers): a pale swirl of paint, the Swirl's purple sky seen through a way back, the Boss's star stand
    const r8 = mulberry32(4040);
    const edge = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
    each((x, y) => {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const sw = Math.sin(a * 2 + d * 0.8);
      put(T.PICTURE, x, y, edge(x, y) ? [230, 220, 245] : shade(sw > 0.3 ? [255, 250, 240] : sw > -0.3 ? [235, 225, 250] : [215, 205, 240], 1 + (r8() - 0.5) * 0.05));
      const deck = (y === 11 || y === 12) && ((x >= 2 && x <= 6) || (x >= 9 && x <= 13));
      put(T.WAY_BACK, x, y, edge(x, y) ? [120, 70, 200] : deck ? [236, 228, 252] : shade([128 + y * 3, 90 + y * 2, 200 + y], 1 + (r8() - 0.5) * 0.08));
      const star = d < 2.4 || (Math.abs(dx) < 0.9 && Math.abs(dy) < 6) || (Math.abs(dy) < 0.9 && Math.abs(dx) < 6);
      put(T.BOSS_STAND_TOP, x, y, edge(x, y) ? [255, 226, 110] : star ? [255, 226, 110] : shade([96, 56, 170], 1 + (r8() - 0.5) * 0.08));
      put(T.BOSS_STAND_SIDE, x, y, edge(x, y) ? [255, 226, 110] : shade(y % 4 < 2 ? [110, 70, 190] : [92, 56, 164], 1 + (r8() - 0.5) * 0.06));
    });
  }
  { // T40d Ball Stadium tiles (own random numbers)
    const r9 = mulberry32(4044);
    const edge = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
    each((x, y) => {
      const blade = r9() < 0.12 ? 0.9 : 1 + (r9() - 0.5) * 0.1;
      put(T.PITCH_LIGHT, x, y, shade([112, 188, 70], blade));
      put(T.PITCH_DARK, x, y, shade([84, 156, 54], blade));
      const chalk = (x + y * 3) % 11 === 0 ? 0.92 : 1; // a slightly uneven edge on the chalk
      put(T.PITCH_LINE, x, y, edge(x, y) && (x + y) % 5 === 0 ? shade([96, 168, 62], 1) : shade([248, 248, 240], chalk * (1 + (r9() - 0.5) * 0.04)));
      put(T.GOAL_POST, x, y, edge(x, y) ? [176, 180, 188] : shade([252, 252, 252], 1 + (r9() - 0.5) * 0.02));
      const mesh = (x + y) % 4 === 0 || (x - y + 16) % 4 === 0;
      put(T.GOAL_NET, x, y, mesh ? [236, 240, 244] : [58, 84, 74]);
      const board = y % 8 === 7, nailed = y % 8 === 3 && (x + (y >> 3) * 5) % 8 === 2; // two long boards a tile: calmer from far away
      put(T.COURT_FLOOR, x, y, board ? [184, 108, 42] : nailed ? [236, 164, 92] : shade([226, 140, 60], 1 + (r9() - 0.5) * 0.06));
      put(T.COURT_LINE, x, y, y >= 6 && y <= 9 ? [250, 250, 245] : board ? [184, 108, 42] : shade([226, 140, 60], 1 + (r9() - 0.5) * 0.06));
      const ring = Math.abs(Math.hypot(x - 7.5, y - 7.5) - 5.5) < 1.1;
      put(T.HOOP_RIM, x, y, ring ? [255, 150, 40] : edge(x, y) ? [255, 190, 90] : shade([255, 110, 20], 1 + (r9() - 0.5) * 0.06));
      const square = x >= 4 && x <= 11 && y >= 4 && y <= 11 && (x === 4 || x === 11 || y === 4 || y === 11);
      put(T.BACKBOARD, x, y, square ? [220, 40, 40] : edge(x, y) ? [150, 154, 164] : shade([250, 252, 255], 1 + (r9() - 0.5) * 0.03));
      const seat = (x % 8 < 6) && (y % 8 < 6);
      put(T.SEAT_TOP, x, y, seat ? shade([50, 110, 230], 1 + (r9() - 0.5) * 0.06) : [28, 56, 130]);
      put(T.SEAT_SIDE, x, y, y < 10 ? (y === 9 ? [24, 50, 120] : shade([50, 108, 224], 1 + (r9() - 0.5) * 0.06)) : shade([156, 160, 168], 1 + (r9() - 0.5) * 0.08)); // a blue seat back over grey concrete
    });
  }
  { // T40c Race Track tiles (own random numbers): dark grain, a white edge line, a 4 x 4 chequer, red and white kerb, chevron boost pads, lamps, stacked tyres
    const r9 = mulberry32(4141);
    const grain = (x, y, base = [58, 60, 68], a = 0.12) => shade(base, 1 + (r9() - 0.5) * a + (r9() < 0.06 ? -0.12 : 0));
    each((x, y) => {
      put(T.ASPHALT, x, y, grain(x, y));
      put(T.TRACK_LINE, x, y, y < 3 ? [244, 244, 240] : y === 3 ? [120, 122, 130] : grain(x, y));
      put(T.CHECKER, x, y, ((x >> 2) + (y >> 2)) % 2 ? [24, 24, 30] : [244, 244, 240]);
      put(T.KERB, x, y, (x >> 2) % 2 ? [230, 50, 50] : [244, 244, 240]);
      const chev = (yy, lit) => { const k = ((y + Math.abs(x - 7.5) * 1.1) % 6); return k < 2.2 ? (lit ? [255, 245, 90] : [255, 150, 30]) : (lit ? [110, 90, 30] : [44, 40, 50]); };
      put(T.BOOST_PAD, x, y, x === 0 || x === 15 ? [255, 190, 60] : chev(y, false));
      put(T.BOOST_PAD_LIT, x, y, x === 0 || x === 15 ? [255, 255, 160] : chev(y, true));
      const d = Math.hypot(x - 7.5, y - 7.5), lamp = d < 4.2;
      put(T.START_LIGHT, x, y, lamp ? [58, 40, 44] : [30, 30, 36]);
      put(T.START_RED, x, y, lamp ? (d < 2 ? [255, 210, 200] : [255, 50, 40]) : [30, 30, 36]);
      put(T.START_GREEN, x, y, lamp ? (d < 2 ? [210, 255, 215] : [40, 230, 80]) : [30, 30, 36]);
      const row = y >> 2, tx = (x + (row % 2) * 4) % 8; // stacked black tyres, a white ring on each
      const ring = Math.abs(Math.hypot((tx - 3.5) / 1.0, ((y % 4) - 1.5) * 1.6) - 3.2) < 0.7;
      put(T.TYRE_SIDE, x, y, y % 4 === 3 ? [10, 10, 14] : ring ? [236, 236, 232] : grain(x, y, [34, 34, 40], 0.25));
      const td = Math.hypot(x - 7.5, y - 7.5);
      put(T.TYRE_TOP, x, y, td < 2.5 ? [14, 14, 18] : td > 4.4 && td < 5.4 ? [236, 236, 232] : td > 7.4 ? [14, 14, 18] : grain(x, y, [38, 38, 44], 0.25));
    });
  }
  { // T40a Giant House blocks (own random numbers)
    const rg = mulberry32(4001);
    const edge = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
    const sh = (col, a) => shade(col, 1 + (rg() - 0.5) * a);
    each((x, y) => {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy);
      put(T.FLOOR_TILE, x, y, x === 0 || y === 0 ? [196, 184, 156] : sh([238, 228, 202], 0.06));
      put(T.FLOOR_TILE_DARK, x, y, x === 0 || y === 0 ? [140, 74, 52] : sh([200, 114, 82], 0.08));
      const stripe = x % 4 < 2, flower = (x % 8 === 3 && y % 8 === 3) || (x % 8 === 4 && y % 8 === 2) || (x % 8 === 2 && y % 8 === 4) || (x % 8 === 3 && y % 8 === 4) || (x % 8 === 4 && y % 8 === 4);
      put(T.WALLPAPER, x, y, flower && (x + y) % 3 ? [250, 160, 190] : flower ? [255, 250, 240] : sh(stripe ? [204, 232, 196] : [186, 218, 178], 0.05));
      put(T.COUNTER_TOP, x, y, rg() < 0.1 ? [150, 146, 140] : rg() < 0.08 ? [250, 248, 244] : sh([222, 216, 206], 0.05));
      const panel = x === 2 || x === 13 || y === 2 || y === 13, knob = Math.abs(x - 11) < 1.5 && Math.abs(y - 7.5) < 1.5;
      put(T.CUPBOARD_SIDE, x, y, knob ? [236, 196, 80] : panel ? [118, 78, 42] : sh([178, 126, 76], 0.08));
      put(T.TABLE_WOOD, x, y, sh(Math.sin(y * 1.3 + Math.sin(x * 0.4) * 2) > 0.55 ? [160, 102, 54] : [194, 136, 76], 0.05));
      const chip = ((x * 5 + y * 3) % 11 === 0) || ((x * 7 + y) % 13 === 0);
      put(T.COOKIE_TOP, x, y, chip ? [96, 56, 32] : sh([218, 166, 92], 0.1));
      put(T.COOKIE_SIDE, x, y, y > 12 ? [176, 120, 60] : ((x * 3 + y) % 9 === 0 ? [255, 226, 170] : sh([226, 176, 102], 0.1)));
      put(T.CRUMB, x, y, d > 6.4 ? [150, 100, 50] : d < 3 ? [255, 240, 190] : sh([236, 190, 110], 0.1));
      put(T.FAN_GRILL, x, y, x % 4 === 0 || y % 4 === 0 ? [188, 194, 206] : [64, 70, 82]);
      const hi = Math.abs(x - y) < 2 || Math.abs(x - y - 8) < 1;
      put(T.CHROME, x, y, edge(x, y) ? [128, 136, 150] : hi ? [248, 250, 255] : sh([196, 204, 216], 0.06));
      const plate = Math.abs(dx) < 5 && Math.abs(dy) < 5;
      put(T.FAN_SWITCH, x, y, edge(x, y) ? [40, 40, 48] : plate ? (dy > 0 ? [150, 40, 40] : [214, 70, 70]) : [78, 80, 92]);
      put(T.FAN_SWITCH_ON, x, y, edge(x, y) ? [40, 40, 48] : plate ? (dy > 0 ? [60, 170, 90] : [120, 240, 140]) : [78, 80, 92]);
      const rail = (y >= 2 && y <= 3) || (y >= 12 && y <= 13), sleeper = x % 4 < 2;
      put(T.TRACK_TOP, x, y, rail ? [206, 212, 224] : sleeper ? [178, 124, 66] : sh([126, 88, 52], 0.1));
      put(T.REMOTE_BUTTON, x, y, edge(x, y) ? [30, 30, 40] : d < 4.6 ? (d < 2 ? [255, 150, 150] : [226, 40, 40]) : d < 6 ? [150, 24, 28] : [50, 52, 66]);
      const bar = Math.abs(dx) < 2.2 && Math.abs(dy) < 7 ? [64, 110, 240] : Math.abs(dy) < 2.2 && Math.abs(dx) < 7 ? [230, 52, 52] : null;
      put(T.TAP_HANDLE, x, y, bar ?? sh([196, 204, 216], 0.05));
      const stripeC = y % 5 < 2 && x % 7 !== 3;
      put(T.CAT_FUR, x, y, sh(stripeC ? [186, 92, 28] : [240, 158, 66], 0.08));
      const closed = (y === 8 && x >= 3 && x <= 12) || (y === 9 && (x === 3 || x === 12));
      put(T.CAT_EYE, x, y, closed ? [70, 40, 20] : sh(stripeC ? [186, 92, 28] : [240, 158, 66], 0.08));
      put(T.CAT_EYE_OPEN, x, y, d < 3.4 ? (Math.abs(dx) < 1 ? [20, 20, 20] : [150, 230, 90]) : d < 5 ? [240, 244, 200] : sh(stripeC ? [186, 92, 28] : [240, 158, 66], 0.08));
      const hole = Math.hypot(x - 7.5, y - 5) < 2.7 || (x >= 6 && x <= 9 && y >= 6 && y <= 12);
      put(T.KEYHOLE, x, y, hole ? [24, 20, 16] : edge(x, y) ? [150, 112, 36] : sh([214, 170, 62], 0.08));
    });
  }
  { // T40b pirate blocks (own random numbers)
    const r9 = mulberry32(4141);
    const sh9 = (col, a) => shade(col, 1 + (r9() - 0.5) * a);
    const edge9 = (x, y) => x === 0 || y === 0 || x === 15 || y === 15;
    each((x, y) => {
      // HULL: dark brown boards with a thin yellow line every 4 rows and a few nails
      put(T.HULL, x, y, y % 4 === 0 ? [214, 170, 60] : (x + (y >> 2) * 5) % 8 === 0 ? [60, 36, 20] : sh9([104, 62, 34], 0.14));
      // DECK: long light boards, dark seams, nail dots
      const nail = (y % 8 === 1 || y % 8 === 5) && (x === 2 || x === 13);
      put(T.DECK, x, y, nail ? [90, 70, 50] : y % 4 === 3 ? [128, 96, 60] : sh9([206, 166, 106], 0.1));
      // ROPE_LADDER: hull planks with rope rungs and two side ropes
      const rung = y % 4 === 1 || y % 4 === 2, rail = x === 3 || x === 4 || x === 11 || x === 12;
      put(T.ROPE_LADDER, x, y, rail ? sh9([214, 188, 130], 0.12) : rung && x > 3 && x < 12 ? sh9([196, 164, 100], 0.12) : y % 4 === 0 ? [214, 170, 60] : sh9([104, 62, 34], 0.14));
      // CANNON_PAD: an iron plate with a gold arrow
      const arrow = (x >= 7 && x <= 8 && y >= 5 && y <= 13) || (y >= 2 && y <= 5 && Math.abs(x - 7.5) <= y - 1.5);
      const rivet = (x === 2 || x === 13) && (y === 2 || y === 13);
      put(T.CANNON_PAD, x, y, edge9(x, y) ? [40, 40, 46] : arrow ? [255, 214, 70] : rivet ? [150, 150, 160] : sh9([82, 84, 94], 0.1));
      // TARGET: red-white rings on sand
      const d = Math.hypot(x - 7.5, y - 7.5);
      put(T.TARGET, x, y, d < 1.8 ? [230, 50, 50] : d < 3.6 ? [250, 246, 240] : d < 5.4 ? [230, 50, 50] : d < 7.2 ? [250, 246, 240] : sh9([222, 210, 166], 0.14));
      // ROPE_POST: a log wrapped in rope; top is the log end with a rope ring
      const coil = (y + (x >> 1)) % 3 === 0;
      put(T.ROPE_POST, x, y, y > 3 && y < 14 && coil ? sh9([222, 196, 140], 0.1) : y > 3 && y < 14 ? sh9([176, 140, 90], 0.12) : sh9([104, 82, 52], 0.2));
      const dd = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      put(T.ROPE_POST_TOP, x, y, dd > 6.5 ? sh9([104, 82, 52], 0.1) : dd > 4.5 ? sh9([222, 196, 140], 0.1) : sh9([176, 140, 88], 0.12));
      // PALM trunk: ring bands; top: end rings
      put(T.PALM, x, y, y % 3 === 0 ? sh9([120, 92, 58], 0.1) : sh9([170, 136, 92], 0.14));
      put(T.PALM_TOP, x, y, dd > 5.5 ? sh9([130, 100, 62], 0.1) : Math.floor(dd) % 2 ? sh9([176, 140, 88], 0.1) : sh9([150, 114, 70], 0.1));
      // PALM_LEAVES: long fronds in two greens
      const frond = Math.abs(((x + y) % 8) - 4) < 1.3 || Math.abs(((x - y + 16) % 8) - 4) < 1;
      put(T.PALM_LEAVES, x, y, frond ? sh9([108, 190, 70], 0.12) : sh9([52, 140, 60], 0.18));
      // PIRATE_FLAG: black, a white parrot feather and two crossed spoons (no skulls)
      const feather = Math.abs(y - 7.5) < 1.2 && x > 2 && x < 9 || (x === 5 && y > 3 && y < 12) || (Math.abs((x - 5) - (y - 7.5) * 0.5) < 0.9 && x > 2 && x < 9 && Math.abs(y - 7.5) < 4);
      const spoon1 = Math.abs((x - 9) - (y - 3)) < 0.8 && x >= 9 && y >= 3 && y <= 12, spoon2 = Math.abs((x - 9) + (y - 12)) < 0.8 && x >= 9 && y >= 3 && y <= 12;
      put(T.PIRATE_FLAG, x, y, feather ? [250, 246, 240] : spoon1 || spoon2 ? [210, 214, 224] : sh9([24, 24, 32], 0.1));
      // BIG_CHEST: wood, two gold bands, a lock
      const band = x === 2 || x === 3 || x === 12 || x === 13 || y === 0 || y === 1 || y === 14 || y === 15;
      const lock = x >= 7 && x <= 8 && y >= 6 && y <= 9;
      put(T.BIG_CHEST, x, y, lock ? [255, 226, 110] : band ? sh9([232, 184, 56], 0.1) : y % 4 === 3 ? [86, 50, 26] : sh9([140, 88, 44], 0.14));
      put(T.BIG_CHEST_TOP, x, y, edge9(x, y) || x === 2 || x === 13 ? sh9([232, 184, 56], 0.1) : sh9([150, 96, 48], 0.14));
      // BIG_CHEST_OPEN (top): a heap of gold coins with a star glint
      const coin = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0, glint = (Math.abs(x - 7.5) < 0.9 && Math.abs(y - 7.5) < 3.2) || (Math.abs(y - 7.5) < 0.9 && Math.abs(x - 7.5) < 3.2);
      put(T.BIG_CHEST_OPEN, x, y, glint ? [255, 255, 235] : edge9(x, y) ? [232, 184, 56] : coin ? sh9([255, 214, 60], 0.1) : sh9([226, 170, 30], 0.12));
      // WHEEL: spoked wheel on a post
      const dw = Math.hypot(x - 7.5, y - 6.5), ang = Math.atan2(y - 6.5, x - 7.5), spoke = Math.abs(Math.sin(ang * 4)) < 0.2;
      const sea = [150, 190, 220], rim = dw >= 4.4 && dw < 5.8, tip = dw >= 5.8 && dw < 7 && Math.abs(Math.sin(ang * 4)) < 0.2;
      put(T.WHEEL, x, y, dw < 1.6 ? [232, 184, 56] : tip ? [232, 184, 56] : rim ? sh9([150, 96, 48], 0.1) : dw < 4.4 && spoke ? sh9([176, 120, 62], 0.1) : y > 12 && x > 5 && x < 10 ? sh9([104, 62, 34], 0.1) : sea);
      // CORAL: pink and orange branches on a darker coral red
      const br = (Math.abs(x - 3) < 1.2 && y > 5) || (Math.abs(x - 8) < 1.5 && y > 2) || (Math.abs(x - 12.5) < 1.2 && y > 7) || (y === 6 && x > 2 && x < 9) || (y === 9 && x > 8 && x < 13);
      put(T.CORAL, x, y, br ? ((x + y) % 3 === 0 ? sh9([255, 170, 110], 0.12) : sh9([250, 130, 170], 0.12)) : sh9([196, 84, 112], 0.2));
      // SHELL_SAND: sand with pink and white shell flecks
      const fleck = r9() < 0.07;
      put(T.SHELL_SAND, x, y, fleck ? (r9() < 0.5 ? [250, 226, 226] : [240, 150, 160]) : sh9([226, 214, 170], 0.14));
    });
  }
  { // T45 Sketchbook tiles (own random numbers): the colour versions; the pencil versions are drawn by sketchatlas.js
    const r5 = mulberry32(4545), CREAM = [244, 240, 228];
    each((x, y) => {
      put(T.DO_PAPER, x, y, y === 5 || y === 11 ? [176, 200, 232] : shade(CREAM, 1 + (r5() - 0.5) * 0.03)); // a notebook page: faint blue ruled lines
      const hi = (x + y) % 9 === 0 && x > 2 && x < 13; // the drawn line: dark graphite with one bright stroke
      put(T.DO_INK, x, y, hi ? [150, 150, 170] : shade([56, 54, 66], 1 + (r5() - 0.5) * 0.2));
      const d = Math.hypot(x - 7.5, y - 7.5), star = Math.abs(Math.sin(Math.atan2(y - 7.5, x - 7.5) * 2.5 + 1.57)) > 0.5 && d < 5 - Math.abs(Math.sin(Math.atan2(y - 7.5, x - 7.5) * 2.5)) * 2;
      put(T.DO_PAD_TOP, x, y, d > 6.4 ? [90, 84, 100] : star || d < 1.4 ? [255, 214, 60] : shade(CREAM, 1 + (r5() - 0.5) * 0.03)); // a yellow star in a circle
      const body = y >= 5 && y <= 10 && x >= 2, tip = x < 5 && Math.abs(y - 7.5) < x - 0.5; // a pencil lying down: yellow body, wood cone, dark lead
      put(T.DO_PAD_SIDE, x, y, y === 4 || y === 11 ? [90, 84, 100] : body && x >= 5 ? (y === 5 || y === 10 ? [214, 160, 20] : [255, 214, 60]) : tip ? (x < 2 ? [60, 58, 70] : [230, 190, 140]) : shade(CREAM, 1 + (r5() - 0.5) * 0.03));
      put(T.DO_BINDING, x, y, (y % 5 >= 1 && y % 5 <= 2 && x > 1 && x < 14) ? [196, 200, 214] : shade([150, 118, 84], 1 + (r5() - 0.5) * 0.1));
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
    fireFrames.push(g.getImageData(tileX(T.FIREPLACE), tileY(T.FIREPLACE), TILE, TILE));
  }
  g.putImageData(fireFrames[0], tileX(T.FIREPLACE), tileY(T.FIREPLACE));
  c.fireFrames = fireFrames;

  return c;
}

// T22: draws flame frame k % 4 of the Fireplace into the atlas canvas and returns { frame, x, y } (its ImageData and the
// tile's place for renderer.copyTextureToTexture: y counted from the bottom, tileGlY), so the caller can upload just that
// tile (re-uploading the whole atlas is slow on tablets).
export function flickerFire(atlas, k) {
  const f = atlas.fireFrames;
  if (!f) return null;
  const frame = f[((k % 4) + 4) % 4], x = tileX(T.FIREPLACE);
  atlas.getContext('2d').putImageData(frame, x, tileY(T.FIREPLACE));
  return { frame, x, y: tileGlY(T.FIREPLACE) };
}

// T38a: the Portal Door's spiral: draws frame k % 4 into the atlas canvas like flickerFire (upload only that tile).
export function swirlPortal(atlas, k) {
  const f = atlas.portalFrames;
  if (!f) return null;
  const frame = f[((k % 4) + 4) % 4], x = tileX(T.PORTAL);
  atlas.getContext('2d').putImageData(frame, x, tileY(T.PORTAL));
  return { frame, x, y: tileGlY(T.PORTAL) };
}

// Small isometric-ish icon for a block, used by the hotbar.
export function drawBlockIcon(atlas, id, size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const def = BLOCKS[id];
  const pad = size * 0.12;
  g.drawImage(atlas, tileX(def.side), tileY(def.side), TILE, TILE, pad, pad, size - pad * 2, size - pad * 2);
  return c;
}
