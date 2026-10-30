// T45: the Sketchbook (realm `doodle`), a Picture World that is a pencil drawing. Terrain as data (Node-runnable: needs only a world with
// W / D / data / ground / index / inBounds / get, like pirateland.js). Eight pages float above the blank page (DO_PAPER, y 4); the ways
// between them are LINES: the child draws each one with the giant pencil and walks on it (Draw!, owner 2026-10-27: COURSES below,
// tracing.js, doodlelive.js); a saved line is drawn as its neat bridge (LINES). Nothing in the world data is a bridge: the ink is drawn
// per player with setLive, so until you drew a line there is only air (and a dotted guide).
import { B, WOOL } from './blocks.js';
import { kit, buildWayBack, placeBoss, placeCrew, pictureAim } from './picturelands.js';
import { lineOf } from './tracing.js';

export const SIZE = 160;
export const FLOOR = 4; // the blank page below: DO_PAPER up to y 4 everywhere (you are puffed back onto your page if you land on it)
export const MIDDLE = [80, 80, 64, 78]; // the drawing's middle and the unfinished edge (REALMS.doodle.look.sketch.edge)

// A page: a flat plateau (STONE sides, DIRT under a GRASS top) with sketchbook rings along one edge. top = the block row of the grass.
// Owner 2026-10-27 (longer, more demanding lines): the pages sit round a ring (r about 56 round the middle) and the lines go 1, 1, 2, 2
// steps round it, then 3, 4 and 2 steps across the middle, so the gaps grow from about 20 to 90 blocks.
export const PAGES = {
  cover: { name: 'Cover', x0: 67, x1: 93, z0: 133, z1: 151, top: 14 },
  meadow: { name: 'Sketch Meadow', x0: 109, x1: 131, z0: 109, z1: 131, top: 15 },
  house: { name: 'Little House', x0: 125, x1: 147, z0: 69, z1: 91, top: 17 },
  pond: { name: 'Pond Page', x0: 69, x1: 91, z0: 13, z1: 35, top: 19 },
  tower: { name: 'Curly Tower', x0: 10, x1: 38, z0: 66, z1: 94, top: 19 },
  hill1: { name: 'Eraser Hill', x0: 109, x1: 131, z0: 29, z1: 51, top: 28 },
  hill2: { name: 'Eraser Hill 2', x0: 29, x1: 51, z0: 109, z1: 131, top: 31 },
  desk: { name: 'The Desk', x0: 27, x1: 53, z0: 31, z1: 49, top: 34 },
};
// The round tower on the Curly Tower page: STONE_BRICKS up to y 39, a 7 x 7 deck of planks at y 40 (21 rows above the page).
export const TOWER = { cx: 24, cz: 80, r: 3, deckY: 40, deck: [21, 27, 77, 83] };

const inRect = (x, z, r) => !!r && x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
const pageRect = id => { const p = PAGES[id]; return [p.x0, p.x1, p.z0, p.z1]; };

// T45 Draw! (owner 2026-10-27, plans/T45.md "Challenge rework"): the child draws each line. Per line: the pad (where it starts, on the
// page it leaves), `land` (the strip of the next page's edge where the line must land: elsewhere the page's side stops the pencil, so
// some lines go round a page), the pencil's speed, its ink, blocks of line per row of climb, Rubber's speed (Eraser Hill), the wind
// [x, z] (blocks / s, in gusts), star dots [x, z], ink blots [x, z, r], doodle bees { a: [x, z], b: [x, z], T (s, there and back),
// phase } and `route`: a good way through (the neat bridge a saved line is drawn as, the guide's hint, the heights the stars and blots
// are drawn at, and the spec's skilled player). The difficulty grows line by line (table in the plan).
const ring = (cx, cz, r0, r1, a0, turns, n) => Array.from({ length: n }, (_, i) => { const k = (i + 1) / n, a = a0 + k * turns * Math.PI * 2, r = r0 + (r1 - r0) * k; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
export const COURSES = [
  { n: 1, from: 'cover', to: 'meadow', pad: [90, 136], land: [119, 129, 129, 131], speed: 4.5, ink: 40,
    stars: [[106, 139.5]], route: [[98, 138], [106, 139.5], [114, 138.5], [122, 136], [124.5, 130.5]] },
  { n: 2, from: 'meadow', to: 'house', pad: [115, 111], land: [125, 127, 75, 85], speed: 4.6, ink: 27,
    stars: [[119.5, 96.5]], blots: [[117.5, 103, 1.5], [121.5, 89.5, 1.4]],
    route: [[114.5, 106], [112, 102], [114, 98.5], [119.5, 96.5], [117.5, 92], [116.5, 87], [120.5, 82], [125.5, 80]] },
  { n: 3, from: 'house', to: 'pond', pad: [129, 72], land: [75, 85, 13, 15], speed: 4.7, ink: 40,
    stars: [[106, 52], [94, 20]], blots: [[114.5, 54.5, 1.6], [106, 41, 1.6], [100, 24, 1.5], [88, 11, 1.4]],
    route: [[125, 67], [118, 63], [110, 57], [106, 52], [103, 46], [97, 37], [95, 28], [94, 20], [95, 12], [94, 7.5], [88, 6.5], [82, 8], [80, 12], [80, 14]] },
  { n: 4, from: 'pond', to: 'tower', pad: [72, 34], land: [36, 38, 86, 92], speed: 4.8, ink: 32,
    stars: [[56, 56], [48, 81]], blots: [[66, 52, 1.6], [56.5, 66, 1.5], [44, 75, 1.4]],
    bees: [{ a: [44, 59], b: [64, 59], T: 9, phase: 0.1 }, { a: [40, 76], b: [62, 76], T: 9, phase: 0.6 }],
    route: [[68, 39], [66, 46], [60, 50], [56, 56], [51, 61], [50, 67], [53, 72], [52, 78], [48, 81], [44, 86], [42, 90], [37.5, 90]] },
  { n: 5, from: 'tower', to: 'tower', pad: [24, 73], land: TOWER.deck, speed: 4.8, ink: 27, climb: 3.8, tower: true, rowB: TOWER.deckY, flatA: [23, 25, 71, 74],
    stars: [[31, 80, 22], [17, 80, 28], [31, 80.5, 33], [17, 80.5, 39]], // [x, z, y]: the spiral passes each place twice
    route: [...ring(TOWER.cx, TOWER.cz, 7, 7, -Math.PI / 2, 2, 24), [27.5, 74.5], [26.5, 77.5], [24, 80]] },
  { n: 6, from: 'tower', to: 'hill1', pad: [27, 80], land: [109, 111, 36, 46], speed: 5.0, ink: 36, climbDown: 1.5, rubber: 3.4, wind: [0, -0.9], rowA: TOWER.deckY, flatA: TOWER.deck,
    stars: [[49, 71], [73, 54], [96, 48]], blots: [[60, 66.5, 1.6], [78, 57.5, 1.6], [104, 46, 1.5]],
    route: [[33, 79], [41, 76], [49, 71], [55, 63], [60, 61], [67, 61], [73, 54], [80, 52], [86, 52], [90, 49], [96, 48], [102, 41], [107, 41], [110.5, 41]] },
  { n: 7, from: 'hill1', to: 'hill2', pad: [113, 50], land: [49, 51, 110, 120], speed: 5.0, ink: 32, rubber: 3.6,
    stars: [[96, 59], [82, 86], [60, 103]], blots: [[96, 66, 1.6], [76, 82, 1.6], [64, 96, 1.5]],
    bees: [{ a: [70, 76], b: [94, 76], T: 10, phase: 0 }, { a: [56, 98], b: [76, 98], T: 9, phase: 0.5 }],
    route: [[109, 55], [102, 58], [96, 59], [91, 64], [89, 71], [84, 80], [82, 86], [75, 89], [71, 94], [66, 101], [60, 103], [55, 108], [52, 114], [50.5, 115]] },
  { n: 8, from: 'hill2', to: 'desk', pad: [48, 110], land: [51, 53, 37, 47], speed: 5.1, ink: 28, rubber: 3.7, wind: [0.8, 0],
    stars: [[58, 93], [60, 78], [55, 59.5]], blots: [[51.5, 93, 1.5], [51, 76, 1.6], [57, 54, 1.4]],
    bees: [{ a: [48, 66], b: [62, 66], T: 8, phase: 0.3 }],
    route: [[52, 106.5], [56.5, 103], [59, 98], [58, 93], [53, 88.5], [54, 82], [60, 78], [61, 72], [56, 68], [52, 63.5], [55, 59.5], [61, 57.5], [64, 53], [61, 49], [57, 47.5], [52.5, 45]] },
];
const KIND = n => (n <= 3 ? 'straight' : n <= 5 ? 'curl' : 'race');
// A polyline as a path function of u in 0..1 (arc length).
function poly(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  return u => { const s = Math.max(0, Math.min(1, u)) * L; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const k = cum[i] === cum[i - 1] ? 0 : (s - cum[i - 1]) / (cum[i] - cum[i - 1]); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; };
}
const polyLen = pts => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
// The neat bridges: from the pad along the route (rows go linearly from the page it leaves to the landing strip).
export const LINES = COURSES.map(c => ({ n: c.n, kind: KIND(c.n), from: c.from, to: c.to, path: poly([c.pad, ...c.route]), rowA: c.rowA, rowB: c.rowB, flatA: c.flatA, flatB: c.land, len: polyLen([c.pad, ...c.route]) }));
export const lineKey = n => `pw:doodle:line${n}`;
const BEE_Y = 1.6, BLOT_Y = 1.1;

// The course of line n (1-based) for tracing.js newDraw / drawStep. solid(x, y, z): the world's solid cells (the live part passes the
// real world, the spec a stand-in one). Cached per solid function.
const courseCache = new WeakMap();
export function courseOf(n, solid) {
  let byN = courseCache.get(solid);
  if (!byN) courseCache.set(solid, byN = new Map());
  if (byN.has(n)) return byN.get(n);
  const l = doodleLines()[n - 1], d = COURSES[n - 1];
  const from = pageRect(l.from), to = pageRect(l.to);
  const fromRect = l.rowA === PAGES[l.from].top ? from : l.flatA; // where the line's first row is the page itself (the deck: its own rect)
  const target = d.land, climb = d.climb ?? 2;
  const start = [l.line.pts[0][0], l.line.pts[0][2]], dir = l.line.dirAt(0);
  // the rows a line drawn along the route would have (the stars, blots and bees are drawn at those heights)
  const rowAlong = [];
  { let x = start[0], z = start[1], row = l.rowA, acc = 0, off = false;
    const pts = [start, ...d.route];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az), k = Math.ceil(len / 0.5);
      for (let j = 1; j <= k; j++) {
        x = ax + (bx - ax) * j / k; z = az + (bz - az) * j / k;
        if (!off && !(x >= l.flatA[0] && x < l.flatA[1] + 1 && z >= l.flatA[2] && z < l.flatA[3] + 1)) off = true;
        if (off && row !== l.rowB) { acc += len / k; const need = l.rowB > row ? climb : (d.climbDown ?? climb * 0.75); if (acc >= need) { acc -= need; row += Math.sign(l.rowB - row); } }
        rowAlong.push([x, z, row]);
      }
    } }
  const rowAt = (x, z) => { let best = rowAlong[0], bd = Infinity; for (const p of rowAlong) { const dd = Math.hypot(p[0] - x, p[1] - z); if (dd < bd) { bd = dd; best = p; } } return best[2]; };
  const others = Object.entries(PAGES).filter(([id]) => id !== l.from && id !== l.to).map(([, p]) => [p.x0, p.x1, p.z0, p.z1]);
  const R = 14, roam = [Math.max(2, Math.min(from[0], to[0]) - R), Math.min(SIZE - 3, Math.max(from[1], to[1]) + R), Math.max(2, Math.min(from[2], to[2]) - R), Math.min(SIZE - 3, Math.max(from[3], to[3]) + R)];
  const c = {
    n, kind: l.kind, rowA: l.rowA, rowB: l.rowB, flatA: l.flatA, fromRect, target, toRect: to, start, dir, climb, climbDown: d.climbDown,
    pad: [...(l.padStand ?? [start[0], l.rowA + 1, start[1]])], speed: d.speed, ink: d.ink, rubber: d.rubber ?? 0, wind: d.wind ?? null, tower: !!d.tower,
    stars: (d.stars || []).map(([x, z, y]) => ({ x, z, y: y ?? rowAt(x, z) + 1 })),
    blots: (d.blots || []).map(([x, z, r]) => ({ x, z, r, y: rowAt(x, z) + BLOT_Y })),
    bees: (d.bees || []).map(b => ({ ...b, y: rowAt((b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2) + BEE_Y })),
    route: d.route, fence: others, roam, solid,
  };
  byN.set(n, c);
  return c;
}
export const LINE_COUNT = LINES.length;

// The lines as data (cached): each with its `line` (tracing.lineOf: pts, cells, stars...), the page rows and the pad cells (the first 2 x 2).
let built = null;
export function doodleLines() {
  if (built) return built;
  built = LINES.map(d => {
    const rowA = d.rowA ?? PAGES[d.from].top, rowB = d.rowB ?? PAGES[d.to].top;
    const flatA = d.flatA ?? pageRect(d.from), flatB = d.flatB ?? pageRect(d.to);
    const N = Math.max(40, Math.ceil(d.len * 4));
    const xz = Array.from({ length: N + 1 }, (_, i) => d.path(i / N));
    const cum = [0];
    for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(xz[i][0] - xz[i - 1][0], xz[i][1] - xz[i - 1][1]));
    let s0 = 0; while (s0 < N && inRect(xz[s0][0], xz[s0][1], flatA)) s0++;   // first point off the page it leaves
    let s1 = N; while (s1 > 0 && inRect(xz[s1][0], xz[s1][1], flatB)) s1--;   // last point off the page it reaches
    const a = cum[Math.max(0, s0 - 1)], b = cum[Math.min(N, s1 + 1)];
    const rowOf = c => (b <= a ? rowA : rowA + (rowB - rowA) * Math.max(0, Math.min(1, (c - a) / (b - a))));
    const pts = xz.map((p, i) => [p[0], rowOf(cum[i]), p[1]]);
    const line = lineOf({ pts, kind: d.kind });
    const sx = Math.round(pts[0][0]), sz = Math.round(pts[0][2]); // the pad: the 2 x 2 cells round the line's start point, on the page it leaves
    const padCells = [[sx - 1, rowA, sz - 1], [sx, rowA, sz - 1], [sx - 1, rowA, sz], [sx, rowA, sz]];
    const padStand = [sx, rowA + 1, sz]; // the middle of the 2 x 2 pad
    return { ...d, rowA, rowB, flatA, flatB, line, padCells, padStand };
  });
  return built;
}

// What is drawn: { drawn: [bool x 8], next (0-based index of the first undrawn, 8 = all), done }. Read from the saved keys.
export function lineState(game) {
  const drawn = LINES.map(l => !!game?.beaten?.includes(lineKey(l.n)));
  const n = drawn.findIndex(d => !d);
  return { drawn, count: drawn.filter(Boolean).length, next: n < 0 ? LINES.length : n, done: n < 0 };
}

const put = (world, x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
const box = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });

// Where the guide points: the next line's pad (or the Desk once all are drawn); a fallen player is pointed at the pad (the live part's aim runs first).
export function doodleAim(world, p, game) {
  const tip = game?.gymLive?.of?.('part:doodle')?.aimTip?.(); // drawing: the arrow is the next star, then the next page
  if (tip) return tip;
  const st = lineState(game), lines = doodleLines();
  if (st.done) return null; // the base's aim: the Boss, then the way back
  const l = lines[st.next], c = l.padCells[0];
  const x = c[0] + 0.5, z = c[2] + 0.5;
  return { x, z, text: (a, m) => `✏️ Line ${l.n} of ${LINES.length}: go to the pencil pad ${a} ${m}m` };
}

// The air over the blank page beside the pages, as a few boxes (y FLOOR + 1 .. 47).
export function gapBoxes() {
  const T = 1, N = SIZE / T, near = (x, z) => Object.values(PAGES).some(p => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1);
  const free = (i, j) => { for (let x = i * T; x < i * T + T; x++) for (let z = j * T; z < j * T + T; z++) if (near(x, z)) return false; return true; };
  const boxes = [], open = new Map(); // 'i0,i1' -> box still growing in z
  for (let j = 0; j < N; j++) {
    const runs = [];
    for (let i = 0; i < N; i++) { if (!free(i, j)) continue; const r = runs[runs.length - 1]; if (r && r[1] === i - 1) r[1] = i; else runs.push([i, i]); }
    const next = new Map();
    for (const [i0, i1] of runs) {
      const k = `${i0},${i1}`, b = open.get(k);
      if (b) { b.z1 = j * T + T - 1; next.set(k, b); open.delete(k); }
      else { const nb = box(i0 * T, i1 * T + T - 1, FLOOR + 1, 47, j * T, j * T + T - 1); boxes.push(nb); next.set(k, nb); }
    }
    open.clear(); for (const [k, b] of next) open.set(k, b);
  }
  return boxes;
}

export function doodleLand(world, def) {
  kit(world);
  const { W, D } = world;
  // 1. the blank page below
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    for (let y = 0; y <= FLOOR; y++) put(world, x, y, z, B.DO_PAPER);
    world.ground[x + z * W] = FLOOR;
  }
  // 2. the pages: solid plateaus with round-ish corners, spiral rings down the west side
  for (const [id, p] of Object.entries(PAGES)) {
    for (let x = p.x0; x <= p.x1; x++) for (let z = p.z0; z <= p.z1; z++) {
      const dx = Math.min(x - p.x0, p.x1 - x), dz = Math.min(z - p.z0, p.z1 - z);
      if (dx + dz < 2) continue; // a rounded corner
      for (let y = FLOOR + 1; y <= p.top; y++) {
        const edge = dx === 0 || dz === 0 || dx + dz < 3;
        let b = y === p.top ? B.GRASS : y >= p.top - 2 ? B.DIRT : B.STONE;
        if (x === p.x0 && y < p.top - 1 && z % 3 !== 0 && z > p.z0 + 1 && z < p.z1 - 1) b = B.DO_BINDING; // the spiral spine
        else if (edge && y < p.top - 2) b = B.STONE;
        put(world, x, y, z, b);
      }
      world.ground[x + z * W] = p.top;
    }
  }
  const top = id => PAGES[id].top;
  const keeps = [];
  const keep = (name, b, wallText) => keeps.push({ name, protect: [b], wallText });
  // 3. little things on the pages (old blocks only)
  const tree = (x, z, y, h = 4) => { for (let k = 1; k <= h; k++) put(world, x, y + k, z, B.LOG); for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = h - 1; dy <= h + 1; dy++) if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - h) <= 3 && !(dx === 0 && dz === 0 && dy < h + 1)) put(world, x + dx, y + dy, z + dz, B.LEAVES); };
  const M = PAGES.meadow, H = PAGES.house, P = PAGES.pond, Dk = PAGES.desk; // things sit at offsets from their page's corner
  tree(M.x0 + 4, M.z0 + 10, top('meadow')); tree(M.x0 + 17, M.z0 + 13, top('meadow'), 5); tree(M.x0 + 19, M.z0 + 4, top('meadow'), 3); tree(M.x0 + 6, M.z0 + 17, top('meadow'), 3);
  for (const [x, z] of [[7, 6], [14, 6], [12, 16], [3, 14], [19, 9]]) put(world, M.x0 + x, top('meadow') + 1, M.z0 + z, B.FLOWER_BUSH);
  for (const [x, z] of [[17, 18], [8, 4], [19, 3]]) put(world, H.x0 + x, top('house') + 1, H.z0 + z, B.FLOWER_BUSH);
  { // the little house on the House page: planks, brick corners, glass windows, a brick roof, a door to the south
    const y = top('house'), x0 = H.x0 + 11, z0 = H.z0 + 9;
    for (let dx = 0; dx < 7; dx++) for (let dz = 0; dz < 7; dz++) for (let k = 1; k <= 4; k++) {
      const wall = dx === 0 || dx === 6 || dz === 0 || dz === 6, corner = (dx === 0 || dx === 6) && (dz === 0 || dz === 6);
      if (!wall) continue;
      const win = k === 2 && !corner && ((dz === 0 || dz === 6) ? dx === 3 : dz === 3);
      const door = dz === 6 && dx === 3 && k <= 2;
      put(world, x0 + dx, y + k, z0 + dz, door ? B.AIR : win ? B.GLASS : corner ? B.BRICK : B.PLANKS);
    }
    for (let dx = -1; dx <= 7; dx++) for (let dz = -1; dz <= 7; dz++) put(world, x0 + dx, y + 5, z0 + dz, B.BRICK);
    keep('house', box(x0 - 1, x0 + 7, y, y + 6, z0 - 1, z0 + 7), 'This little house is part of the drawing.');
  }
  for (let x = P.x0 + 4; x <= P.x0 + 13; x++) for (let z = P.z0 + 4; z <= P.z0 + 11; z++) { put(world, x, top('pond'), z, B.WATER); put(world, x, top('pond') - 1, z, B.DIRT); } // a pond
  { // the Curly Tower
    const { cx, cz, r, deckY, deck } = TOWER, y0 = top('tower');
    for (let y = y0 + 1; y < deckY; y++) for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) if (Math.hypot(x - cx, z - cz) <= r + 0.3) put(world, x, y, z, B.STONE_BRICKS);
    for (let x = deck[0]; x <= deck[1]; x++) for (let z = deck[2]; z <= deck[3]; z++) { put(world, x, deckY, z, B.PLANKS); for (let k = 1; k <= 4; k++) put(world, x, deckY + k, z, B.AIR); }
    keep('tower', box(cx - r - 1, cx + r + 1, y0, deckY + 1, cz - r - 1, cz + r + 1), 'The Curly Tower is part of the drawing.');
  }
  { // a giant pencil lying on the Cover (yellow wool body, wooden cone, a lead tip), with a gap for the way to the first pad
    const y = top('cover') + 1;
    for (let x = 68; x <= 76; x++) for (const z of [141, 142]) for (const dy of [0, 1]) put(world, x, y + dy, z, WOOL.light);
    for (const z of [141, 142]) { put(world, 77, y, z, B.PLANKS); put(world, 77, y + 1, z, B.PLANKS); }
    put(world, 78, y, 141, B.PLANKS); put(world, 78, y, 142, B.PLANKS); put(world, 79, y, 141, B.COAL_ORE);
    keep('pencil', box(68, 79, y - 1, y + 2, 141, 142), 'The giant pencil is part of the drawing.');
  }
  { // the Desk: a pencil pot, a ruler, an ink bottle
    const y = top('desk');
    const X = Dk.x0, Z = Dk.z0;
    for (let dx = 0; dx < 5; dx++) for (let dz = 0; dz < 5; dz++) { const wall = dx === 0 || dx === 4 || dz === 0 || dz === 4; if (wall) for (let k = 1; k <= 4; k++) put(world, X + 4 + dx, y + k, Z + 3 + dz, WOOL.cozy); }
    for (let x = X + 10; x <= X + 21; x++) put(world, x, y + 1, Z + 15, x % 3 === 0 ? B.COAL_ORE : B.PLANKS);
    for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) for (let k = 1; k <= 3; k++) put(world, X + 18 + dx, y + k, Z + 4 + dz, k === 3 && dx === 1 && dz === 1 ? B.AIR : B.GLASS);
    keep('desk-things', box(X + 4, X + 8, y, y + 5, Z + 3, Z + 7), 'The pencil pot is part of the drawing.');
    keep('desk-ink', box(X + 18, X + 20, y, y + 4, Z + 4, Z + 6), 'The ink bottle is part of the drawing.');
  }
  // 4. the lines: air for 3 above every ink cell where the world is free, the pads, the keeps
  const lines = doodleLines(), pads = [], rests = [];
  for (const l of lines) {
    for (const c of l.line.cells) if (world.get(c.x, c.y, c.z) === B.AIR) for (let k = 1; k <= 3; k++) put(world, c.x, c.y + k, c.z, B.AIR);
    const cells = l.padCells;
    for (const [x, y, z] of cells) { put(world, x, y, z, B.DO_PAD); for (let k = 1; k <= 3; k++) put(world, x, y + k, z, B.AIR); }
    const cx = cells.reduce((a, c) => a + c[0] + 0.5, 0) / cells.length, cz = cells.reduce((a, c) => a + c[2] + 0.5, 0) / cells.length, y = cells[0][1];
    const pad = { n: l.n, cells, stand: [cx, y + 1, cz, 0] }; // the middle of the 2 x 2 pad
    pads.push(pad); rests.push(pad.stand);
    const xs = cells.map(c => c[0]), zs = cells.map(c => c[2]);
    keep(`pad-${l.n}`, box(Math.min(...xs), Math.max(...xs), y, y + 3, Math.min(...zs), Math.max(...zs)), 'The pencil pad is part of the drawing. Stand on it and press Draw!');
    // the line itself: groups of 6 cells in a keep (nobody builds a bridge across the pencil's work)
    for (let i = 0; i < l.line.cells.length; i += 6) {
      const g = l.line.cells.slice(i, i + 6), ys = g.map(c => c.y);
      keep(`line-${l.n}`, box(Math.min(...g.map(c => c.x)) - 1, Math.max(...g.map(c => c.x)) + 1, Math.min(...ys) - 1, Math.max(...ys) + 4, Math.min(...g.map(c => c.z)) - 1, Math.max(...g.map(c => c.z)) + 1), 'This line is drawn by the pencil!');
    }
  }
  // 5. the way back (the Cover), a second one on the Desk, the Boss, the crew
  buildWayBack(world, 'doodle', { x: 80, y: top('cover'), z: 150, facing: [0, -1] });
  buildWayBack(world, 'doodle-desk', { x: PAGES.desk.x0 + 6, y: top('desk'), z: PAGES.desk.z0 + 14, facing: [0, -1] });
  placeBoss(world, 'doodle', { x: PAGES.desk.x0 + 13, y: top('desk'), z: PAGES.desk.z0 + 3, facing: [0, 1] });
  placeCrew(world, 'doodle', 0, { x: PAGES.meadow.x0 + 11, y: top('meadow'), z: PAGES.meadow.z0 + 8, facing: [0, -1] });
  placeCrew(world, 'doodle', 1, { x: PAGES.tower.x0 + 4, y: top('tower'), z: PAGES.tower.z0 + 26, facing: [1, 0] });
  // T45 Draw!: the gaps between the pages are keeps (no block bridges, no flying across: riders are fenced out of keeps).
  for (const b of gapBoxes()) keep('gap', b, 'Draw your way across with the pencil!');
  for (const k of keeps) world.keeps.push(k);
  for (const pg of Object.values(PAGES)) { const x = Math.floor((pg.x0 + pg.x1) / 2), z = Math.floor((pg.z0 + pg.z1) / 2); if (world.get(x, pg.top, z) === B.GRASS && world.get(x, pg.top + 1, z) === B.AIR && world.get(x, pg.top + 2, z) === B.AIR) rests.push([x + 0.5, pg.top + 1, z + 0.5, 0]); }
  for (const r of rests) world.rests.push(r);
  world.doodle = { pages: PAGES, tower: TOWER, lines, pads, floorY: FLOOR, checkpoints: lines.filter(l => l.kind === 'race').map(l => ({ n: l.n, stars: l.line.stars.map(s => l.line.at(s)) })) };
  world.realmBiome = () => 'doodle';
  world.parts.push({ id: 'doodle', live: 'doodle' });
}

export { pictureAim };
