// T45: the Sketchbook's pencil atlas. drawSketchAtlas(atlas) makes a canvas of exactly the same size and grid as the colour
// atlas (so every block's tile number, every uv in every chunk and the Swirl tint's tile ranges stay valid) with the same tiles
// drawn as a pencil sketch on warm paper: soft graphite strokes with gaps and grain, a faint wash of the tile's own colour.
// The PATTERN says what a block is (grass flicks, brick rows, board lines), never only the shade. Tiles without a painter of their
// own get the auto pattern (the colour tile's own detail as strokes, hatching when dark). Made once (lazily, game.sketch) and
// deterministic: own mulberry32(4545), the same on every device.
import { T, TILE_COUNT, tileX, tileY, mulberry32 } from './blocks.js';

export const PAPER = [246, 242, 232];  // warm cream
export const INK = [62, 60, 70];        // soft blue-grey graphite, never pure black
const N = 16;

/* ---- a tiny drawing kit: a painter gets `d` (put a dot), `L` (line), `C` (ring), `S` (value setter) and the random numbers ---- */
// mask values: 1 = stroke (grain, gaps), 2 = faint stroke, 3 = solid graphite, 4 = highlight (light)
function kit(m, rand) {
  let val = 1;
  const d = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) m[y * N + x] = val; };
  const L = (x0, y0, x1, y1) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      d(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  const C = (cx, cy, r, from = 0, to = Math.PI * 2) => {
    const steps = Math.max(12, Math.ceil(r * 10));
    for (let i = 0; i <= steps; i++) { const a = from + (to - from) * i / steps; d(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  };
  const S = v => { val = v; };
  return { d, L, C, S, rand };
}

// Explicit painters for the blocks the Sketchbook is made of (the rest of the world's blocks use the auto pattern).
const SKETCH = {
  GRASS_TOP: ({ d, L, S }) => { S(2); for (const [x, y] of [[2, 2], [10, 1], [6, 7], [13, 8], [3, 12], [10, 13]]) { L(x, y, x + 1, y + 1); L(x + 1, y + 1, x + 2, y); d(x + 1, y + 2); d(x + 1, y + 3); } },
  GRASS_SIDE: ({ d, L }) => {
    for (const x0 of [0, 4, 8, 12]) { L(x0, 3, x0, 2); L(x0, 2, x0 + 1, 1); L(x0 + 1, 1, x0 + 2, 1); L(x0 + 2, 1, x0 + 3, 2); L(x0 + 3, 2, x0 + 3, 3); }
    L(4, 7, 4, 9); L(11, 9, 11, 12); L(8, 11, 8, 12); L(2, 14, 5, 14); L(9, 15, 13, 15); d(14, 6); d(1, 10);
  },
  DIRT: ({ d, rand }) => { for (let i = 0; i < 24; i++) d(rand() * N, rand() * N); for (let i = 0; i < 5; i++) { const x = rand() * 14, y = rand() * 14; d(x, y); d(x + 1, y); } },
  STONE: ({ L, C, d }) => { C(4, 4, 2.6); C(11.5, 5, 3); C(5, 11.5, 3.1); C(12, 12, 2.3); L(8, 8, 9, 10); L(9, 10, 8, 12); d(1, 8); d(14, 1); },
  COBBLE: ({ C }) => { C(3, 3, 3); C(10, 3, 3.2); C(6.5, 8.5, 3); C(13, 9, 2.6); C(2.5, 13, 2.6); C(9.5, 14, 2.4); },
  SAND: ({ d, L, rand }) => { for (let i = 0; i < 18; i++) d(rand() * N, rand() * N); L(3, 4, 5, 3); L(5, 3, 7, 4); L(7, 4, 9, 3); L(8, 11, 10, 10); L(10, 10, 12, 11); L(12, 11, 14, 10); },
  GRAVEL: ({ L }) => { for (const [x, y] of [[1, 1], [6, 0], [11, 2], [3, 6], [8, 5], [13, 7], [1, 11], [6, 10], [11, 12]]) { L(x, y, x + 2, y); L(x, y + 2, x + 2, y + 2); L(x, y, x, y + 2); L(x + 2, y, x + 2, y + 2); } },
  WATER: ({ d }) => { [3, 8, 13].forEach((y, k) => { for (let x = 0; x < N; x++) d(x, y + Math.round(Math.sin(x * 0.9 + k * 2) * 1.2)); }); },
  LOG_SIDE: ({ L, C, d }) => { for (const x of [2, 6, 10, 14]) for (let y = 0; y < N; y++) d(x + (y % 5 === 2 ? 1 : 0), y); C(4, 8, 1.4); C(12, 4, 1.2); },
  LOG_TOP: ({ C, d }) => { C(7.5, 7.5, 2.2); C(7.5, 7.5, 4.3); C(7.5, 7.5, 6.4); d(7, 7); d(8, 8); },
  LEAVES: ({ L, C }) => { [3, 8, 13].forEach((y, k) => { for (let x0 = (k % 2) * 2 - 2; x0 < N; x0 += 5) C(x0 + 2.5, y, 2.4, Math.PI, Math.PI * 2); }); },
  PINE_LEAVES: ({ L }) => { for (const y of [1, 6, 11]) { for (const x0 of [0, 8]) { L(x0, y, x0 + 3, y + 3); L(x0 + 3, y + 3, x0 + 7, y); } L(7, y + 2, 7, y + 4); } },
  PLANKS: ({ L, d }) => { for (const y of [3, 7, 11, 15]) L(0, y, 15, y); [[5, 0, 3], [11, 4, 7], [4, 8, 11], [10, 12, 15]].forEach(([x, a, b]) => L(x, a, x, b)); for (const [x, y] of [[1, 1], [13, 5], [1, 9], [13, 13]]) d(x, y); },
  BRICK: ({ L }) => { for (const y of [3, 7, 11, 15]) L(0, y, 15, y); [[3, 0, 3], [11, 0, 3], [7, 4, 7], [15, 4, 7], [3, 8, 11], [11, 8, 11], [7, 12, 15], [15, 12, 15]].forEach(([x, a, b]) => L(x, a, x, b)); },
  STONE_BRICKS: ({ L }) => { L(0, 7, 15, 7); L(0, 15, 15, 15); L(7, 0, 7, 15); L(15, 0, 15, 15); for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) { L(x + 1, y + 1, x + 4, y + 1); L(x + 1, y + 1, x + 1, y + 4); } },
  GLASS: () => 'opaque', // the outline and the shine are the opaque pixels of the colour tile: ink on all of them
  CLOUD: ({ d }) => { const cs = [[5, 9, 4.6], [10.5, 8.5, 5], [7.5, 5.5, 3.8]], inside = (x, y) => cs.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inside(x, y) && !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1))) d(x, y); },
  SNOW: ({ d, L }) => { for (const [x, y] of [[3, 4], [9, 10], [12, 3]]) d(x, y); for (const [x, y] of [[6, 7], [2, 13], [13, 13]]) { L(x - 1, y, x + 1, y); L(x, y - 1, x, y + 1); } },
  FLOWERS: ({ d, L, C }) => { for (const [x, y] of [[4, 5], [11, 9]]) { d(x, y); C(x, y, 2.4); L(x, y + 3, x, 15); } L(4, 11, 6, 9); L(11, 14, 13, 12); L(2, 13, 4, 12); },
  LAMP: ({ C, L }) => { C(7.5, 7.5, 2.8); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; L(7.5 + Math.cos(a) * 4.4, 7.5 + Math.sin(a) * 4.4, 7.5 + Math.cos(a) * 6.8, 7.5 + Math.sin(a) * 6.8); } },
  DO_PAPER: ({ L, S }) => { S(2); L(0, 4, 15, 4); L(0, 9, 15, 9); L(0, 14, 15, 14); L(3, 0, 3, 15); },
  DO_INK: ({ L, S }) => { S(3); for (let y = 0; y < N; y++) L(0, y, 15, y); S(4); L(3, 4, 12, 4); L(4, 11, 10, 11); },
  DO_PAD_TOP: ({ C, L, d }) => { C(7.5, 7.5, 6.6); const p = i => [7.5 + Math.sin(i * 4 * Math.PI / 5) * 4.6, 7.5 - Math.cos(i * 4 * Math.PI / 5) * 4.6]; for (let i = 0; i < 5; i++) L(...p(i), ...p(i + 1)); },
  DO_PAD_SIDE: ({ L, d }) => { L(0, 4, 15, 4); L(0, 11, 15, 11); L(5, 4, 5, 11); L(0, 4, 0, 11); L(0, 4, 3, 7); L(0, 11, 3, 7); L(5, 5, 14, 5); d(2, 7); d(3, 7); },
  DO_BINDING: ({ L, C }) => { for (const y of [1, 6, 11]) { C(7.5, y + 1.5, 1.4); L(1, y + 1, 5, y + 1); L(10, y + 1, 14, y + 1); L(1, y + 1, 1, y + 3); L(14, y + 1, 14, y + 3); } },
};
export const SKETCH_TILES = Object.keys(SKETCH);

// Knit stitches (rows of little v's) for the wool blocks.
function knit({ L }) { for (let y = 0; y < N; y += 4) for (let x = (y / 4) % 2 * 2; x < N; x += 4) { L(x, y, x + 1, y + 1); L(x + 1, y + 1, x + 2, y); L(x + 1, y + 2, x + 1, y + 3); } }

/* ---- the auto pattern: the colour tile's own detail (a Sobel edge map of its luma) as strokes, plus hatching when it is dark ---- */
function autoMask(m, luma, alpha, mean, rand) {
  const at = (x, y) => luma[Math.max(0, Math.min(N - 1, y)) * N + Math.max(0, Math.min(N - 1, x))];
  const edge = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
    const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
    edge[y * N + x] = Math.hypot(gx, gy) / 4;
  }
  for (const th of [0.12, 0.2, 0.3, 0.45, 2]) { // sharper and sharper until it is a drawing and not a scribble
    m.fill(0);
    let n = 0;
    for (let i = 0; i < N * N; i++) if (alpha[i] >= 128 && edge[i] > th) { m[i] = 1; n++; }
    if (n <= N * N * 0.34) break;
  }
  let count = 0; for (let i = 0; i < N * N; i++) count += m[i] ? 1 : 0;
  if (count < 4) for (const [x, y] of [[4, 4], [11, 7], [7, 12], [13, 13], [2, 10]]) m[y * N + x] = 1; // a smooth tile still gets a few pencil dots
  if (mean < 0.5) { // dark tiles: horizontal hatching, closer the darker (never the shader's diagonal)
    const gap = mean < 0.25 ? 2 : mean < 0.38 ? 3 : 4;
    for (let y = 0; y < N; y++) if (y % gap === 1) for (let x = 0; x < N; x++) if (alpha[y * N + x] >= 128 && (x + y * 3) % 7 !== 0) m[y * N + x] = 1;
  }
}

// Hex of a colour in [r, g, b] 0..255 mixed.
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function drawSketchAtlas(atlas) {
  const W = atlas.width, H = atlas.height;
  const src = atlas.getContext('2d').getImageData(0, 0, W, H).data;
  const out = new ImageData(W, H), o = out.data;
  const rand = mulberry32(4545);
  const names = Object.fromEntries(Object.entries(T).map(([k, v]) => [v, k]));
  const wool0 = T.WOOL0, woolEnd = T.ICE; // the wool tiles sit between WOOL0 and the first of the more tiles
  const mask = new Uint8Array(N * N), luma = new Float32Array(N * N), alpha = new Uint8Array(N * N);
  for (let t = 0; t < TILE_COUNT; t++) {
    const tx = tileX(t), ty = tileY(t);
    let sum = 0, cnt = 0, rr = 0, gg = 0, bb = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = ((ty + y) * W + tx + x) * 4, k = y * N + x;
      alpha[k] = src[i + 3];
      luma[k] = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255;
      if (alpha[k] >= 128) { sum += luma[k]; cnt++; rr += src[i]; gg += src[i + 1]; bb += src[i + 2]; }
    }
    const mean = cnt ? sum / cnt : 1;
    // paper: a little darker for dark blocks (never below 80% of the paper), with a faint wash of the tile's own colour
    const wash = 1 - Math.min(0.2, 0.16 * (1 - mean));
    const tint = cnt ? [rr / cnt, gg / cnt, bb / cnt] : PAPER;
    const base = mix(PAPER.map(v => v * wash), tint, 0.07);
    mask.fill(0);
    const name = names[t], paint = SKETCH[name];
    let opaque = false;
    if (paint) { const r = paint(kit(mask, rand)); opaque = r === 'opaque'; }
    else if (t >= wool0 && t < woolEnd) knit(kit(mask, rand));
    else autoMask(mask, luma, alpha, mean, rand);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = y * N + x, i = ((ty + y) * W + tx + x) * 4;
      let m = opaque ? (alpha[k] >= 128 ? 1 : 0) : mask[k];
      if (alpha[k] < 128) m = 0;
      if ((m === 1 || m === 2) && rand() < 1 / 12) m = 0; // gappy, hand-drawn
      const g = 1 + (rand() - 0.5) * 0.3; // +-15% grain
      let c = base;
      if (m === 1) c = INK.map(v => v * g);
      else if (m === 2) c = mix(base, INK, 0.62).map(v => v * g);
      else if (m === 3) c = INK.map(v => v * (0.8 + (g - 1) * 0.5));
      else if (m === 4) c = [196, 196, 210];
      o[i] = Math.max(0, Math.min(255, c[0])); o[i + 1] = Math.max(0, Math.min(255, c[1])); o[i + 2] = Math.max(0, Math.min(255, c[2]));
      o[i + 3] = src[i + 3]; // the alpha is copied 1:1: glass and holes stay what they were, so alphaTest still cuts them
    }
  }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d').putImageData(out, 0, 0);
  return c;
}
