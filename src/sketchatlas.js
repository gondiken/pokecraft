// T45 (look v2): the Sketchbook's pencil atlas is a DATA atlas. drawSketchAtlas(atlas) makes a canvas of exactly the same size and grid
// as the colour atlas (so every block's tile number and every uv in every chunk stay valid), but its pixels are not a picture:
//   R = the tile's KIND x 8 (what pencil marks the shader doodles on it: grass tufts, cracks, boards...; 0 = auto),
//   G = the tone of the colour tile (its mean brightness: a dark block gets a little hatching even in the light),
//   B = the auto detail (255 where the colour tile has an edge: a few faint strokes for blocks without a kind of their own),
//   A = the colour tile's alpha, copied 1:1 (glass and leaf holes stay holes, so alphaTest still cuts them).
// The face itself is paper and every mark is drawn by the block shader (caves.js skDraw) in world units, so lines run on across blocks,
// stay smooth at any distance and boil with the drawing. The texture is uploaded without colour conversion (NoColorSpace, sketch.js).
// Deterministic (no random numbers at all): the same atlas on every device.
import { T, TILE_COUNT, tileX, tileY, mulberry32 } from './blocks.js';

export const PAPER = [246, 242, 232];  // warm cream (the realm's look.sketch.paper)
export const INK = [62, 60, 70];        // soft blue-grey graphite, never pure black (look.sketch.ink)
const N = 16;

// The kinds of pencil marks (the shader's numbers: keep them in step with caves.js skMarks).
export const KIND = {
  auto: 0, grassTop: 1, grassSide: 2, dirt: 3, stone: 4, cobble: 5, sand: 6, gravel: 7, water: 8, bark: 9, rings: 10, leaves: 11,
  pine: 12, planks: 13, brick: 14, stoneBricks: 15, glass: 16, snow: 17, flowers: 18, sun: 19, wool: 20, page: 21, ink: 22,
  padTop: 23, padSide: 24, binding: 25, snowSide: 26, layers: 27, ore: 28, mud: 29, ice: 30, crystal: 31,
};
// Tile name -> kind. Every other tile is `auto` (wool tiles are `wool`).
export const KIND_OF = {
  GRASS_TOP: 'grassTop', DREAM_GRASS_TOP: 'grassTop', PITCH_LIGHT: 'grassTop', PITCH_DARK: 'grassTop',
  GRASS_SIDE: 'grassSide', DREAM_GRASS_SIDE: 'grassSide',
  DIRT: 'dirt', STONE: 'stone', COBBLE: 'cobble', CRUMBLE: 'cobble',
  SAND: 'sand', SHELL_SAND: 'sand', SANDSTONE_TOP: 'sand', GRAVEL: 'gravel', WATER: 'water',
  LOG_SIDE: 'bark', PINE_SIDE: 'bark', PALM: 'bark', CACTUS_SIDE: 'bark', ROPE_POST: 'bark',
  LOG_TOP: 'rings', CACTUS_TOP: 'rings', PALM_TOP: 'rings', ROPE_POST_TOP: 'rings', BARREL_TOP: 'rings',
  LEAVES: 'leaves', MAPLE_LEAVES: 'leaves', PALM_LEAVES: 'pine', PINE_LEAVES: 'pine',
  PLANKS: 'planks', DECK: 'planks', HULL: 'planks', TABLE_WOOD: 'planks', BARREL_SIDE: 'planks', NIGHTINGALE: 'planks', BEAM_SIDE: 'planks', BEAM_TOP: 'planks',
  BRICK: 'brick', AT_BRICK: 'brick', RAINBOW_BRICK: 'brick',
  STONE_BRICKS: 'stoneBricks', SWIRL_STONE: 'stoneBricks',
  GLASS: 'glass', AT_DOME: 'glass',
  SNOW: 'snow', CLOUD: 'snow', SWIRL_CLOUD: 'snow', CLOTH: 'snow', COURT_FLOOR: 'snow',
  FLOWERS: 'flowers', TALL_GRASS: 'flowers',
  LAMP: 'sun', GLOWCAP: 'sun', PAPER_LANTERN: 'sun', AT_LAMP_ON: 'sun', AT_LANTERN_ON: 'sun', SUNSTONE: 'sun',
  DO_PAPER: 'page', DO_INK: 'ink', DO_PAD_TOP: 'padTop', DO_PAD_SIDE: 'padSide', DO_BINDING: 'binding',
  SNOW_SIDE: 'snowSide', SANDSTONE: 'layers', MUD: 'mud',
  COAL_ORE: 'ore', GOLD_ORE: 'ore', RUBY: 'ore', SAPPHIRE: 'ore',
  ICE: 'ice', CRYSTAL: 'crystal',
};
export const SKETCH_TILES = Object.keys(KIND_OF);

// The kind number a tile gets (wool tiles: knit stitches).
const kindOf = (name, t) => {
  if (name && KIND_OF[name]) return KIND[KIND_OF[name]];
  if (t >= T.WOOL0 && t < T.ICE) return KIND.wool; // the wool tiles sit between WOOL0 and the first of the more tiles
  return KIND.auto;
};
export const kindOfTile = t => kindOf(Object.keys(T).find(k => T[k] === t), t);

export function drawSketchAtlas(atlas) {
  const W = atlas.width, H = atlas.height;
  const src = atlas.getContext('2d').getImageData(0, 0, W, H).data;
  const out = new ImageData(W, H), o = out.data;
  const names = {}; for (const [k, v] of Object.entries(T)) names[v] = k;
  const luma = new Float32Array(N * N), alpha = new Uint8Array(N * N);
  for (let t = 0; t < TILE_COUNT; t++) {
    const tx = tileX(t), ty = tileY(t);
    let sum = 0, cnt = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = ((ty + y) * W + tx + x) * 4, k = y * N + x;
      alpha[k] = src[i + 3];
      luma[k] = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255;
      if (alpha[k] >= 128) { sum += luma[k]; cnt++; }
    }
    const tone = cnt ? sum / cnt : 1;
    const kind = kindOf(names[t], t);
    // the auto detail: a Sobel edge map of the colour tile, sharper and sharper until it is a few strokes and not a scribble
    const at = (x, y) => luma[Math.max(0, Math.min(N - 1, y)) * N + Math.max(0, Math.min(N - 1, x))];
    const edge = new Float32Array(N * N);
    if (kind === KIND.auto) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      edge[y * N + x] = Math.hypot(gx, gy) / 4;
    }
    let th = 0.12;
    if (kind === KIND.auto) for (th of [0.12, 0.2, 0.3, 0.45, 2]) {
      let n = 0; for (let i = 0; i < N * N; i++) if (alpha[i] >= 128 && edge[i] > th) n++;
      if (n <= N * N * 0.25) break;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = y * N + x, i = ((ty + y) * W + tx + x) * 4;
      o[i] = kind * 8;
      o[i + 1] = Math.round(Math.max(0, Math.min(1, tone)) * 255);
      o[i + 2] = kind === KIND.auto && alpha[k] >= 128 && edge[k] > th ? 255 : 0;
      o[i + 3] = src[i + 3]; // the alpha is copied 1:1: glass and holes stay what they were, so alphaTest still cuts them
    }
  }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d').putImageData(out, 0, 0);
  return c;
}

/* ---- the marks: one 96 px cell per kind, pencil strokes as alpha on a clear canvas (the shader reads .a, mipmapped) ---- */
// The block shader picks the cell of a face's kind and turns / flips it per block (ROTATE kinds: any of 8 ways, the others only a mirror),
// so neighbours never look stamped. Rows (planks, bricks, water, layers) run to the cell's edge so they join from block to block.
export const MARK_TILE = 96;
export const MARK_GRID = [8, 4];
export const ROTATE_KINDS = [KIND.grassTop, KIND.dirt, KIND.stone, KIND.cobble, KIND.sand, KIND.gravel, KIND.leaves, KIND.snow, KIND.ore, KIND.rings]
  .reduce((m, k) => m | (1 << k), 0);
const MARKS = {
  grassTop: ({ tuft }) => { tuft(0.38, 0.45, 1.1, -0.2); },
  grassSide: ({ L, dot, rand }) => {
    for (let i = 0; i < 6; i++) { const x = (i + 0.25 + 0.5 * rand()) / 6; L([[x, 0], [x + 0.06 * (rand() - 0.5), 0.07 + 0.13 * rand()]]); }
    dot(0.3, 0.62, 0.014); dot(0.72, 0.8, 0.01);
  },
  dirt: ({ dot }) => { dot(0.25, 0.3, 0.016); dot(0.7, 0.22, 0.01); dot(0.55, 0.62, 0.02); dot(0.2, 0.75, 0.01); dot(0.8, 0.78, 0.014); dot(0.83, 0.79, 0.008); },
  stone: ({ L, ring }) => { L([[0.22, 0.3], [0.38, 0.42], [0.36, 0.58]]); L([[0.38, 0.42], [0.5, 0.4]]); ring(0.68, 0.68, 0.11, 0.075); },
  cobble: ({ ring }) => { ring(0.28, 0.28, 0.19, 0.16); ring(0.73, 0.3, 0.17, 0.17); ring(0.3, 0.74, 0.17, 0.18); ring(0.72, 0.72, 0.19, 0.16); },
  sand: ({ dot, rand }) => { for (let i = 0; i < 16; i++) dot(0.08 + 0.84 * rand(), 0.08 + 0.84 * rand(), 0.007); },
  gravel: ({ ring, rand }) => { for (let i = 0; i < 7; i++) { const r = 0.04 + 0.03 * rand(); ring(0.12 + 0.76 * rand(), 0.12 + 0.76 * rand(), r, r * 0.8); } },
  water: ({ wave }) => { wave(0.22, 0.04, 0.1, 0.6); wave(0.55, 0.035, 0.45, 0.95); wave(0.85, 0.04, 0.05, 0.45); },
  bark: ({ L, ring }) => { for (const x of [0.18, 0.5, 0.8]) L([[x, 0.02], [x + 0.03, 0.3], [x - 0.02, 0.6], [x + 0.01, 0.82]]); ring(0.33, 0.45, 0.05, 0.08); },
  rings: ({ ring, dot }) => { ring(0.5, 0.5, 0.16, 0.15); ring(0.5, 0.5, 0.32, 0.3); dot(0.5, 0.5, 0.02); },
  leaves: ({ loop }) => { loop(0.28, 0.3, 0.09, 1); loop(0.7, 0.36, 0.08, 3); loop(0.42, 0.72, 0.1, 5); loop(0.78, 0.76, 0.07, 2); },
  pine: ({ L }) => { for (const [x, y] of [[0.3, 0.25], [0.7, 0.5], [0.35, 0.78]]) L([[x - 0.1, y - 0.07], [x, y], [x + 0.1, y - 0.07]]); },
  planks: ({ L }) => { for (const y of [0, 1 / 3, 2 / 3, 1]) L([[0, y], [1, y]], 0.004); L([[0.6, 0], [0.6, 1 / 3]]); L([[0.25, 1 / 3], [0.25, 2 / 3]]); L([[0.8, 2 / 3], [0.8, 1]]); L([[0.1, 0.5], [0.45, 0.52]], 0.01); },
  brick: ({ L }) => { for (const y of [0, 0.25, 0.5, 0.75, 1]) L([[0, y], [1, y]], 0.004); for (let r = 0; r < 4; r++) for (const x of r % 2 ? [0.25, 0.75] : [0.5]) L([[x, r * 0.25], [x, r * 0.25 + 0.25]]); },
  stoneBricks: ({ L }) => { for (const y of [0, 0.5, 1]) L([[0, y], [1, y]], 0.004); L([[0.5, 0], [0.5, 0.5]]); L([[0.25, 0.5], [0.25, 1]]); L([[0.75, 0.5], [0.75, 1]]); L([[0.08, 0.1], [0.2, 0.1]]); L([[0.58, 0.6], [0.7, 0.6]]); },
  glass: ({ L }) => { L([[0.22, 0.55], [0.55, 0.22]]); L([[0.4, 0.7], [0.7, 0.4]]); },
  snow: ({ dot }) => { dot(0.3, 0.35, 0.01); dot(0.7, 0.68, 0.008); },
  flowers: ({ daisy, L }) => { daisy(0.32, 0.32); daisy(0.68, 0.5); L([[0.32, 0.42], [0.34, 0.97]]); L([[0.68, 0.6], [0.66, 0.97]]); },
  sun: ({ ring, L }) => { ring(0.5, 0.5, 0.15, 0.15); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; L([[0.5 + Math.cos(a) * 0.23, 0.5 + Math.sin(a) * 0.23], [0.5 + Math.cos(a) * 0.34, 0.5 + Math.sin(a) * 0.34]]); } },
  wool: ({ L }) => { for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) if ((gx + gy) % 2 === 0) { const x = gx / 4, y = gy / 4; L([[x + 0.075, y + 0.09], [x + 0.125, y + 0.16], [x + 0.175, y + 0.09]], 0.002); } },
  padTop: ({ ring, L }) => { ring(0.5, 0.5, 0.42, 0.42); const p = i => [0.5 + 0.3 * Math.sin(i * 4 * Math.PI / 5), 0.5 - 0.3 * Math.cos(i * 4 * Math.PI / 5)]; L([0, 1, 2, 3, 4, 5].map(p)); },
  padSide: ({ L }) => { L([[0.1, 0.38], [0.78, 0.38], [0.94, 0.5], [0.78, 0.62], [0.1, 0.62], [0.1, 0.38]]); L([[0.22, 0.38], [0.22, 0.62]]); L([[0.78, 0.38], [0.78, 0.62]]); },
  binding: ({ ring, L }) => { ring(0.5, 0.28, 0.15, 0.12); ring(0.5, 0.72, 0.15, 0.12); L([[0.1, 0.28], [0.32, 0.28]]); L([[0.1, 0.72], [0.32, 0.72]]); },
  snowSide: ({ wave, dot }) => { wave(0.24, 0.04, 0, 1); dot(0.35, 0.6, 0.012); dot(0.7, 0.8, 0.01); },
  layers: ({ L }) => { for (const y of [0, 1 / 3, 2 / 3, 1]) L([[0, y], [1, y]], 0.006); },
  ore: ({ L, dot }) => { L([[0.2, 0.25], [0.35, 0.4], [0.3, 0.55]]); dot(0.65, 0.3, 0.045); dot(0.72, 0.68, 0.035); dot(0.35, 0.75, 0.04); },
  mud: ({ dot, wave }) => { dot(0.3, 0.3, 0.014); dot(0.7, 0.25, 0.01); wave(0.62, 0.05, 0.1, 0.8); },
  ice: ({ L }) => { L([[0.15, 0.7], [0.6, 0.2]]); L([[0.45, 0.85], [0.85, 0.45]]); },
  crystal: ({ L }) => { L([[0.3, 0.8], [0.5, 0.2], [0.7, 0.8]]); L([[0.5, 0.2], [0.5, 0.8]]); },
};

export function drawSketchMarks() {
  const T = MARK_TILE, [GX, GY] = MARK_GRID;
  const c = document.createElement('canvas');
  c.width = T * GX; c.height = T * GY;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const rand = mulberry32(4545);
  for (const [name, k] of Object.entries(KIND)) {
    const paint = MARKS[name];
    if (!paint) continue;
    const ox = (k % GX) * T, oy = Math.floor(k / GX) * T;
    const P = (x, y) => [ox + x * T, oy + y * T];
    // a pencil line through the points (tile units): split in short pieces that wander a little, each with its own pressure
    const L = (pts, wob = 0.008) => {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.05));
        let px = x0, py = y0;
        for (let j = 1; j <= n; j++) {
          const t = j / n, edge = i === pts.length - 1 && j === n;
          const x = x0 + (x1 - x0) * t + (edge ? 0 : (rand() - 0.5) * wob), y = y0 + (y1 - y0) * t + (edge ? 0 : (rand() - 0.5) * wob);
          ctx.strokeStyle = `rgba(0,0,0,${(0.78 + 0.22 * rand()).toFixed(3)})`;
          ctx.lineWidth = 1.3 + 0.5 * rand();
          ctx.beginPath(); ctx.moveTo(...P(px, py)); ctx.lineTo(...P(x, y)); ctx.stroke();
          px = x; py = y;
        }
      }
    };
    const ring = (cx, cy, rx, ry, from = 0, to = Math.PI * 2) => {
      const n = 24, pts = [];
      for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n, w = 1 + 0.08 * Math.sin(a * 3 + cx * 9); pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]); }
      L(pts, 0.006);
    };
    const dot = (x, y, r) => { ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.beginPath(); ctx.arc(...P(x, y), Math.max(1, r * T), 0, Math.PI * 2); ctx.fill(); };
    const tuft = (x, y, s, a) => { // two or three blades side by side
      const R = (u, v) => [x + (u * Math.cos(a) - v * Math.sin(a)) * s, y + (u * Math.sin(a) + v * Math.cos(a)) * s];
      L([R(-0.03, 0), R(-0.05, -0.08)]); L([R(0, 0), R(0.005, -0.12)]); L([R(0.03, 0), R(0.05, -0.075)]);
    };
    const loop = (x, y, r, seed) => { const g = seed * 1.3; ring(x, y, r, r * 0.85, g, g + Math.PI * 1.7); L([[x + Math.cos(g) * r, y + Math.sin(g) * r], [x + Math.cos(g) * r * 1.5, y + Math.sin(g) * r * 1.6]]); };
    const wave = (y, amp, x0, x1) => { const pts = []; for (let i = 0; i <= 24; i++) { const x = x0 + (x1 - x0) * i / 24; pts.push([x, y + amp * Math.sin(x * Math.PI * 4)]); } L(pts, 0.004); };
    const daisy = (x, y) => { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ring(x + Math.cos(a) * 0.055, y + Math.sin(a) * 0.055, 0.035, 0.035); } dot(x, y, 0.015); };
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, T, T); ctx.clip();
    paint({ L, ring, dot, tuft, loop, wave, daisy, rand });
    ctx.restore();
  }
  return c;
}
