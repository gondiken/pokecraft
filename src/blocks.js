// Block definitions and the procedurally drawn pixel-art texture atlas.

export const TILE = 16;

// Tile indices inside the atlas (a single row of 16x16 tiles).
export const T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  LOG_SIDE: 6, LOG_TOP: 7, LEAVES: 8, PLANKS: 9, COBBLE: 10,
  SNOW: 11, SNOW_SIDE: 12, BRICK: 13, WOOL0: 14,
};

// Coloured "wool" blocks, one per creature type, used for gym roofs and carpets.
export const WOOL_TYPES = [
  'normal', 'fire', 'water', 'grass', 'electric', 'rock', 'ice', 'bug', 'ghost',
  'mind', 'metal', 'toxic', 'pixie', 'drake', 'rainbow', 'cosmic', 'sound', 'bone', 'alien',
];
const WOOL_RGB = {
  normal: [200, 196, 170], fire: [222, 96, 40], water: [60, 110, 220], grass: [80, 170, 70], electric: [240, 200, 40],
  rock: [160, 130, 80], ice: [150, 220, 235], bug: [140, 170, 30], ghost: [110, 80, 160],
  mind: [235, 120, 175], metal: [170, 180, 190], toxic: [140, 70, 180], pixie: [255, 175, 220], drake: [95, 90, 220],
  rainbow: [255, 255, 255], cosmic: [48, 50, 130], sound: [60, 200, 180], bone: [236, 228, 205], alien: [140, 225, 90],
};
// More tiles after the wool ones.
const MORE_TILES = [
  'ICE', 'GRAVEL', 'SANDSTONE', 'SANDSTONE_TOP', 'CACTUS_SIDE', 'CACTUS_TOP', 'MUD', 'PINE_SIDE', 'PINE_LEAVES',
  'FLOWERS', 'CRYSTAL', 'GLASS', 'STONE_BRICKS', 'LAMP', 'COAL_ORE', 'GOLD_ORE',
  'GLOWCAP', 'CHEST_SIDE', 'CHEST_TOP', 'CHEST_OPEN_TOP',
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
};
// Block id of each type's wool block.
export const WOOL = Object.fromEntries(WOOL_TYPES.map((t, i) => [t, 20 + i]));

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
WOOL_TYPES.forEach((t, i) => { BLOCKS[WOOL[t]] = { name: `${t[0].toUpperCase()}${t.slice(1)} Wool`, ...all(T.WOOL0 + i) }; });

// The starting hotbar. Players can swap any slot for another block in the Blocks panel.
export const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.LAMP];
// Every block players can build with (the Blocks panel), in a sensible order.
export const PLACEABLE = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.STONE_BRICKS, B.BRICK, B.PLANKS, B.LOG, B.PINE_LOG,
  B.LEAVES, B.PINE_LEAVES, B.FLOWER_BUSH, B.CACTUS, B.SAND, B.SANDSTONE, B.GRAVEL, B.MUD, B.SNOW,
  B.ICE, B.GLASS, B.LAMP, B.CRYSTAL, B.GLOWCAP, B.COAL_ORE, B.GOLD_ORE,
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

  const STRIPES = [[230, 70, 70], [245, 150, 50], [245, 220, 60], [90, 200, 90], [70, 140, 230], [150, 90, 210]];
  WOOL_TYPES.forEach((t, i) => each((x, y) => {
    const f = (1 + (rand() - 0.5) * 0.12) * ((x + y) % 4 === 0 ? 0.92 : 1);
    const base = t === 'rainbow' ? STRIPES[Math.floor((x + y) / 6) % STRIPES.length]
      : t === 'cosmic' && (x * 7 + y * 13) % 23 === 0 ? [255, 236, 150] // a sky full of stars
        : t === 'bone' && (x * 5 + y * 3) % 19 === 0 ? [150, 140, 120] // little cracks
          : t === 'alien' && (x * 11 + y * 7) % 17 === 0 ? [170, 110, 230] // purple dots
            : WOOL_RGB[t];
    put(T.WOOL0 + i, x, y, shade(base, f));
  }));

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
