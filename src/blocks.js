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
];
const WOOL_RGB = {
  normal: [200, 196, 170], fire: [222, 96, 40], water: [60, 110, 220], grass: [80, 170, 70], electric: [240, 200, 40],
  rock: [160, 130, 80], ice: [150, 220, 235], bug: [140, 170, 30], ghost: [110, 80, 160],
  mind: [235, 120, 175], metal: [170, 180, 190], toxic: [140, 70, 180], pixie: [255, 175, 220], drake: [95, 90, 220],
  rainbow: [255, 255, 255], cosmic: [48, 50, 130], sound: [60, 200, 180], bone: [236, 228, 205], alien: [140, 225, 90],
  sky: [150, 210, 255], slime: [120, 220, 110], light: [255, 228, 110], paper: [250, 248, 240],
  time: [222, 170, 80], camo: [110, 150, 80], cyber: [40, 52, 80],
};
// More tiles after the wool ones.
const MORE_TILES = [
  'ICE', 'GRAVEL', 'SANDSTONE', 'SANDSTONE_TOP', 'CACTUS_SIDE', 'CACTUS_TOP', 'MUD', 'PINE_SIDE', 'PINE_LEAVES',
  'FLOWERS', 'CRYSTAL', 'GLASS', 'STONE_BRICKS', 'LAMP', 'COAL_ORE', 'GOLD_ORE',
  'GLOWCAP', 'CHEST_SIDE', 'CHEST_TOP', 'CHEST_OPEN_TOP', 'CLOUD',
  'LASER_RED', 'LASER_BLUE', 'LASER_FRIEND', 'SWITCH_RED_TOP', 'SWITCH_BLUE_TOP', 'FRIEND_PAD_TOP', 'RESET_BUTTON', 'CLOCK_DOOR', // T19
  'SUNSTONE', 'RUBY', 'SAPPHIRE', // T20 treasure blocks
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
  // 54-56 are the time / camo / cyber wool blocks.
  // 57-64: T19 gym blocks (lasers, switches, reset button, clock door).
  LASER_RED: 57, LASER_BLUE: 58, LASER_FRIEND: 59, SWITCH_RED: 60, SWITCH_BLUE: 61, FRIEND_PAD: 62, RESET_BUTTON: 63, CLOCK_DOOR: 64,
  // 65-67: T20 treasure blocks (limited: you mine them to have them). Next free id: 68.
  SUNSTONE: 65, RUBY: 66, SAPPHIRE: 67,
};
// Block id of each type's wool block.
// The first 19 are 20 + i; the T10 ones can't continue there (39-48 are other blocks), so they sit at 49-52.
const WOOL_ID_OVERRIDE = { sky: 49, slime: 50, light: 51, paper: 52, time: 54, camo: 55, cyber: 56 };
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

  return c;
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
