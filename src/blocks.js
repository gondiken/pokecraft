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
  'mind', 'metal', 'toxic', 'pixie', 'drake', 'rainbow', 'cosmic', 'sound',
];
const WOOL_RGB = {
  normal: [200, 196, 170], fire: [222, 96, 40], water: [60, 110, 220], grass: [80, 170, 70], electric: [240, 200, 40],
  rock: [160, 130, 80], ice: [150, 220, 235], bug: [140, 170, 30], ghost: [110, 80, 160],
  mind: [235, 120, 175], metal: [170, 180, 190], toxic: [140, 70, 180], pixie: [255, 175, 220], drake: [95, 90, 220],
  rainbow: [255, 255, 255], cosmic: [48, 50, 130], sound: [60, 200, 180],
};
export const TILE_COUNT = T.WOOL0 + WOOL_TYPES.length;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  LOG: 6, LEAVES: 7, PLANKS: 8, COBBLE: 9, SNOW: 10, BRICK: 11,
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
};
WOOL_TYPES.forEach((t, i) => { BLOCKS[WOOL[t]] = { name: `${t[0].toUpperCase()}${t.slice(1)} Wool`, ...all(T.WOOL0 + i) }; });

export const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.LEAVES, B.SAND, B.BRICK];

// Blocks that hide the faces of their neighbours.
export const isOccluder = id => id !== B.AIR && id !== B.WATER && id !== B.LEAVES;
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
        : WOOL_RGB[t];
    put(T.WOOL0 + i, x, y, shade(base, f));
  }));

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
