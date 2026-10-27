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
export const PAGES = {
  cover: { name: 'Cover', x0: 67, x1: 93, z0: 133, z1: 151, top: 14 },
  meadow: { name: 'Sketch Meadow', x0: 65, x1: 95, z0: 99, z1: 117, top: 15 },
  house: { name: 'Little House', x0: 34, x1: 55, z0: 91, z1: 111, top: 17 },
  pond: { name: 'Pond Page', x0: 32, x1: 53, z0: 56, z1: 77, top: 19 },
  tower: { name: 'Curly Tower', x0: 67, x1: 93, z0: 49, z1: 71, top: 19 },
  hill1: { name: 'Eraser Hill', x0: 104, x1: 122, z0: 64, z1: 82, top: 28 },
  hill2: { name: 'Eraser Hill 2', x0: 114, x1: 132, z0: 36, z1: 52, top: 31 },
  desk: { name: 'The Desk', x0: 80, x1: 106, z0: 18, z1: 34, top: 34 },
};
// The round tower on the Curly Tower page: STONE_BRICKS up to y 35, a 7 x 7 deck of planks at y 36.
export const TOWER = { cx: 80, cz: 60, r: 3, deckY: 36, deck: [77, 83, 57, 63] };

const inRect = (x, z, r) => !!r && x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
const pageRect = id => { const p = PAGES[id]; return [p.x0, p.x1, p.z0, p.z1]; };

// The path of each line in x / z (the line's middle; its 2 wide ink cells sit either side). Every shape is a function of u in 0..1.
const straight = (a, b) => u => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const spiral = u => { // 2 turns round the tower, radius 6.5 -> 5.5, starting north of it, then straight in onto the deck
  if (u > 0.92) { const k = (u - 0.92) / 0.08; return [TOWER.cx, TOWER.cz - 5.5 + 4.2 * k]; }
  const a = -Math.PI / 2 + (u / 0.92) * Math.PI * 4, r = 6.5 - 1.0 * (u / 0.92);
  return [TOWER.cx + Math.cos(a) * r, TOWER.cz + Math.sin(a) * r];
};
// from / to: page ids; flatA / flatB: the rectangles where the line keeps its start / end height (the page it leaves / reaches);
// rows: the block row of the ink at the start and the end (the page tops, or the tower deck).
export const LINES = [
  { n: 1, kind: 'straight', from: 'cover', to: 'meadow', path: straight([80, 135], [80, 115]), len: 20 },
  { n: 2, kind: 'straight', from: 'meadow', to: 'house', path: straight([67, 106], [53, 102]), len: 15 },
  { n: 3, kind: 'straight', from: 'house', to: 'pond', path: u => { const a = [44, 93], b = [43, 75]; return [a[0] + (b[0] - a[0]) * u + 2.4 * Math.sin(Math.PI * 2 * u), a[1] + (b[1] - a[1]) * u]; }, len: 18 },
  { n: 4, kind: 'curl', from: 'pond', to: 'tower', path: u => [52 + 16.5 * u + 3.2 * Math.sin(Math.PI * 2 * u), 63.5 + 3.2 * Math.sin(Math.PI * 4 * u)], len: 28 },
  { n: 5, kind: 'curl', from: 'tower', to: 'tower', path: spiral, rowB: TOWER.deckY, flatA: [79, 81, 52, 55], flatB: TOWER.deck, len: 80 },
  { n: 6, kind: 'race', from: 'tower', to: 'hill1', path: straight([82, 59], [106, 70]), rowA: TOWER.deckY, flatA: TOWER.deck, len: 30 },
  { n: 7, kind: 'race', from: 'hill1', to: 'hill2', path: u => [118 + 4 * u + 1.6 * Math.sin(Math.PI * 2 * u), 66 - 16 * u], len: 18 },
  { n: 8, kind: 'race', from: 'hill2', to: 'desk', path: straight([116, 40], [104, 28]), len: 18 },
];
export const lineKey = n => `pw:doodle:line${n}`;

// T45 Draw! (owner 2026-10-27, plans/T45.md "Challenge rework"): the child draws each line. Per line: the pencil's speed, its ink,
// how many blocks of line per row of climb, Rubber's speed (Eraser Hill), the wind [x, z] (blocks / s), star dots [x, z], ink blots
// [x, z, r], doodle bees { a: [x, z], b: [x, z], T (s, there and back), phase } and `route`: a good way through (the guide's hint, the
// heights the stars and blots are drawn at, and the spec's skilled player). The difficulty grows line by line (table in the plan).
export const COURSES = [
  { n: 1, speed: 4.5, ink: 30, stars: [[80, 125]], route: [[80, 128], [80, 116]] },
  { n: 2, speed: 4.6, ink: 20, stars: [[60.5, 100]], blots: [[60.5, 104.2, 1.5]], route: [[63, 101.5], [60.5, 100], [57, 100.5], [54, 101]] },
  { n: 3, speed: 4.7, ink: 12, stars: [[40.5, 84]], blots: [[44, 86.5, 1.5], [39.5, 79.5, 1.5]], route: [[41, 89], [40.5, 84], [44, 80.5], [44.5, 76.5]] },
  { n: 4, speed: 4.8, ink: 14, stars: [[59, 67.5]], blots: [[63.5, 63.5, 1.6]], bees: [{ a: [60.5, 55], b: [60.5, 72], T: 8, phase: 0.25 }], route: [[56, 66.5], [59, 67.5], [63.5, 68.5], [68.5, 68]] },
  { n: 5, speed: 4.8, ink: 14, climb: 1.75, tower: true, stars: [[86, 60], [80, 66], [74, 60]], route: [...Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i + 1) * Math.PI / 6; return [80 + 6 * Math.cos(a), 60 + 6 * Math.sin(a)]; }), [76.5, 55.2], [80, 60]] },
  { n: 6, speed: 5.0, ink: 16, climb: 2.2, rubber: 3.6, wind: [0, -0.8], stars: [[93, 69]], blots: [[94, 64.5, 1.8]], route: [[88, 63.5], [93, 69], [100, 70.5], [106, 71]] },
  { n: 7, speed: 5.0, ink: 12, rubber: 3.8, stars: [[114, 58]], bees: [{ a: [109, 60.5], b: [127, 60.5], T: 8, phase: 0 }, { a: [127, 55.5], b: [109, 55.5], T: 7, phase: 0.5 }], route: [[116, 62], [114, 58], [117, 55], [119, 51.5]] },
  { n: 8, speed: 5.1, ink: 12, rubber: 4.0, wind: [0, 1.0], stars: [[112, 30.5]], blots: [[110.5, 35, 1.5]], bees: [{ a: [108.5, 25], b: [108.5, 41], T: 7, phase: 0.75 }], route: [[114.5, 34], [112, 30.5], [105.5, 29.5]] },
];
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
  const target = l.flatB, climb = d.climb ?? 2;
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
  const R = 10, roam = [Math.max(2, Math.min(from[0], to[0]) - R), Math.min(SIZE - 3, Math.max(from[1], to[1]) + R), Math.max(2, Math.min(from[2], to[2]) - R), Math.min(SIZE - 3, Math.max(from[3], to[3]) + R)];
  const c = {
    n, kind: l.kind, rowA: l.rowA, rowB: l.rowB, flatA: l.flatA, fromRect, target, start, dir, climb, climbDown: d.climbDown,
    pad: [...(l.padStand ?? [start[0], l.rowA + 1, start[1]])], speed: d.speed, ink: d.ink, rubber: d.rubber ?? 0, wind: d.wind ?? null, tower: !!d.tower,
    stars: (d.stars || []).map(([x, z]) => ({ x, z, y: rowAt(x, z) + 1 })),
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
  return { x, z, text: (a, m) => `✏️ Line ${l.n} of ${LINES.length}: go to the star pad ${a} ${m}m` };
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
  tree(70, 104, top('meadow')); tree(89, 111, top('meadow'), 5); tree(92, 103, top('meadow'), 3); tree(75, 114, top('meadow'), 3);
  for (const [x, z] of [[72, 109], [84, 104], [78, 101], [91, 107], [68, 113]]) put(world, x, top('meadow') + 1, z, B.FLOWER_BUSH);
  for (const [x, z] of [[38, 108], [50, 95], [41, 94]]) put(world, x, top('house') + 1, z, B.FLOWER_BUSH);
  { // the little house on the House page: planks, brick corners, glass windows, a brick roof, a door to the south
    const y = top('house'), x0 = 45, z0 = 98;
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
  for (let x = 36; x <= 45; x++) for (let z = 60; z <= 67; z++) { put(world, x, top('pond'), z, B.WATER); put(world, x, top('pond') - 1, z, B.DIRT); } // a pond
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
    for (let dx = 0; dx < 5; dx++) for (let dz = 0; dz < 5; dz++) { const wall = dx === 0 || dx === 4 || dz === 0 || dz === 4; if (wall) for (let k = 1; k <= 4; k++) put(world, 84 + dx, y + k, 21 + dz, WOOL.cozy); }
    for (let x = 90; x <= 103; x++) put(world, x, y + 1, 31, x % 3 === 0 ? B.COAL_ORE : B.PLANKS);
    for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) for (let k = 1; k <= 3; k++) put(world, 98 + dx, y + k, 22 + dz, k === 3 && dx === 1 && dz === 1 ? B.AIR : B.GLASS);
    keep('desk-things', box(84, 88, y, y + 5, 21, 25), 'The pencil pot is part of the drawing.');
    keep('desk-ink', box(98, 100, y, y + 4, 22, 24), 'The ink bottle is part of the drawing.');
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
    keep(`pad-${l.n}`, box(Math.min(...xs), Math.max(...xs), y, y + 3, Math.min(...zs), Math.max(...zs)), 'The star pad is part of the drawing. Stand on it and press Draw!');
    // the line itself: groups of 6 cells in a keep (nobody builds a bridge across the pencil's work)
    for (let i = 0; i < l.line.cells.length; i += 6) {
      const g = l.line.cells.slice(i, i + 6), ys = g.map(c => c.y);
      keep(`line-${l.n}`, box(Math.min(...g.map(c => c.x)) - 1, Math.max(...g.map(c => c.x)) + 1, Math.min(...ys) - 1, Math.max(...ys) + 4, Math.min(...g.map(c => c.z)) - 1, Math.max(...g.map(c => c.z)) + 1), 'This line is drawn by the pencil!');
    }
  }
  // 5. the way back (the Cover), a second one on the Desk, the Boss, the crew
  buildWayBack(world, 'doodle', { x: 80, y: top('cover'), z: 150, facing: [0, -1] });
  buildWayBack(world, 'doodle-desk', { x: 86, y: top('desk'), z: 32, facing: [0, -1] });
  placeBoss(world, 'doodle', { x: 93, y: top('desk'), z: 21, facing: [0, 1] });
  placeCrew(world, 'doodle', 0, { x: 78, y: top('meadow'), z: 108, facing: [0, -1] });
  placeCrew(world, 'doodle', 1, { x: 90, y: top('tower'), z: 66, facing: [-1, 0] });
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
