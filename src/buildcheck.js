// T29 build challenges. scanBuild finds the build next to the player: placed blocks only (world.edits, not air or water), joined by
// faces, edges or corners (26 neighbours), the biggest group touching a placed block within `reach` of the player.
// The report works with the feature helpers (features.js), like a home's room report.
// Zones: all = every block of the build, top = its highest layer, base = its lowest layer, overWater = blocks with water below them
// (straight down through air).
import { B, WOOL, PLACEABLE, BLOCKS } from './blocks.js'; // T38c: BLOCKS
import { reach, hasBlock, atLeast, different } from './features.js';

const WOOLS = PLACEABLE.filter(id => Object.values(WOOL).includes(id));

export function scanBuild(world, pos, { reach: near = 3, box = 16, up = 24, max = 4000 } = {}) {
  const none = { ok: false, cells: 0, stats: {}, counts: {} };
  const px = Math.floor(pos.x), py = Math.floor(pos.y), pz = Math.floor(pos.z);
  const placed = (x, y, z) => {
    if (!world.inBounds(x, y, z)) return 0;
    const id = world.edits.get(world.index(x, y, z));
    return id && id !== B.AIR && id !== B.WATER && world.get(x, y, z) === id ? id : 0;
  };
  const inside = (x, y, z) => Math.abs(x - px) <= box && Math.abs(z - pz) <= box && y >= py - box && y <= py + up;
  const seen = new Set();
  const key = (x, y, z) => x + 1024 * (z + 1024 * y);
  let best = null;
  for (let x = px - near; x <= px + near; x++) for (let z = pz - near; z <= pz + near; z++) for (let y = py - near; y <= py + near + 1; y++) {
    if (seen.has(key(x, y, z)) || !placed(x, y, z)) continue;
    const cells = [], stack = [[x, y, z]];
    seen.add(key(x, y, z));
    while (stack.length && cells.length < max) {
      const [cx, cy, cz] = stack.pop();
      cells.push([cx, cy, cz]);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        if (!a && !b && !c) continue;
        const nx = cx + a, ny = cy + b, nz = cz + c;
        if (!inside(nx, ny, nz)) continue;
        const k = key(nx, ny, nz);
        if (seen.has(k) || !placed(nx, ny, nz)) continue;
        seen.add(k);
        stack.push([nx, ny, nz]);
      }
    }
    if (!best || cells.length > best.length) best = cells;
  }
  if (!best) return none;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, y, z] of best) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const counts = { all: {}, top: {}, base: {}, overWater: {} };
  const add = (zone, id) => { counts[zone][id] = (counts[zone][id] || 0) + 1; };
  for (const [x, y, z] of best) {
    const id = placed(x, y, z);
    add('all', id);
    if (y === y1) add('top', id);
    if (y === y0) add('base', id);
    let d = y - 1;
    while (d >= 0 && d >= y - 12 && world.get(x, d, z) === B.AIR) d--;
    if (d >= 0 && world.get(x, d, z) === B.WATER) add('overWater', id);
  }
  return {
    ok: true, cells: best.length, box: { x0, x1, y0, y1, z0, z1 },
    stats: { height: y1 - y0 + 1, width: Math.max(x1 - x0, z1 - z0) + 1, blocks: best.length }, counts,
  };
}

// Small example pictures: [x, y, z, id] blocks (y up). Only used for the picture in the panel.
const column = (x, z, h, id, top = id) => Array.from({ length: h }, (_, y) => [x, y, z, y === h - 1 ? top : id]);
const tower3 = (h, stars) => {
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
    if (z !== 0 && !(x === 1 && z === 1)) continue; // front face only is enough for the side picture
    out.push([x, y, z, stars.includes(y) && x === 1 ? B.STAR_BLOCK : B.STONE_BRICKS]);
  }
  return out;
};
const wall = () => {
  const out = [];
  for (let x = 0; x < 6; x++) for (let y = 0; y < 3; y++) out.push([x, y, 0, WOOLS[(x + y) % 6]]);
  return out;
};
const bridge = () => {
  const out = [];
  for (let x = 0; x < 8; x++) out.push([x + 1, 1, 0, B.WATER]);
  for (let x = 0; x < 10; x++) out.push([x, 2, 0, B.PLANKS]);
  out.push([0, 1, 0, B.PLANKS], [9, 1, 0, B.PLANKS]);
  return out;
};

export const BUILDS = {
  lamptower: {
    name: 'Lamp Tower', text: 'Build a tower 6 blocks high with a Lamp on top.',
    features: [
      reach('height', 6, { key: 'high', name: '6 blocks high', icon: B.COBBLE }),
      hasBlock(B.LAMP, { key: 'lamp', name: 'Lamp on top', where: ['top'] })],
    example: [...column(0, 0, 5, B.COBBLE), [0, 5, 0, B.LAMP]],
  },
  bridge: {
    name: 'Water Bridge', text: 'Build a bridge over water, 8 blocks long.',
    features: [atLeast(8, null, { key: 'span', name: '8 blocks over water', icon: B.PLANKS, where: ['overWater'] })],
    example: bridge(),
  },
  rainbow: {
    name: 'Rainbow Wall', text: 'Build a wall with 6 different colours of wool.',
    features: [
      different(6, WOOLS, { key: 'colours', name: '6 wool colours', icon: WOOL.fire }),
      reach('height', 3, { key: 'tall', name: '3 blocks high', icon: WOOL.water })],
    example: wall(),
  },
  startower: {
    name: 'Star Tower', text: 'Build a tower 8 blocks high with 3 Star Blocks in it.',
    features: [
      reach('height', 8, { key: 'high', name: '8 blocks high', icon: B.STONE_BRICKS }),
      atLeast(3, [B.STAR_BLOCK], { key: 'stars', name: '3 Star Blocks', where: ['all'] })],
    example: tower3(8, [1, 3, 5]),
    tip: 'Star Blocks come from treasure maps.',
  },
};

/* ----------------------- build templates (T38c) ----------------------- */
// The mission maker (missiongen.js) picks a template and numbers; makeBuild turns `{ t, ...params }` into a BUILDS-shaped object
// (name, text, features, example, tip?) so scanBuild / checkAll / the panel work unchanged. Pure: it never reads the game.
// Numbers grow slowly with the round: `lo + (0..2) + floor(round / 3)`, at most `hi`.
const rint = (rand, lo, hi, round) => Math.min(hi, lo + Math.floor(rand() * 3) + Math.max(0, Math.floor(round / 3)));
export const TOWER_TOPS = [B.LAMP, B.CRYSTAL, ...WOOLS.slice(0, 4)];
const blockName = id => BLOCKS[id]?.name || 'block';
const inRange = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const MAX_COLOURS = Math.min(8, WOOLS.length);

const wallPic = (w, h, colours) => {
  const out = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) out.push([x, y, 0, WOOLS[(x + y) % colours]]);
  return out;
};
const bridgePic = len => {
  const out = [];
  for (let x = 0; x < len; x++) out.push([x + 1, 1, 0, B.WATER]);
  for (let x = 0; x < len + 2; x++) out.push([x, 2, 0, B.PLANKS]);
  out.push([0, 1, 0, B.PLANKS], [len + 1, 1, 0, B.PLANKS]);
  return out;
};
const starPlaces = (h, n) => Array.from({ length: n }, (_, i) => 1 + 2 * i).filter(y => y < h - 1);

// pick(rand, round) -> params; ok(p) -> are the params of the right type and in range; make(p) -> the BUILDS-shaped object.
export const BUILD_TEMPLATES = {
  tower: {
    pick: (r, round) => ({ h: rint(r, 6, 10, round), top: TOWER_TOPS[Math.floor(r() * TOWER_TOPS.length)] }),
    ok: p => inRange(p.h, 6, 10) && TOWER_TOPS.includes(p.top),
    make: p => ({
      name: `${blockName(p.top)} Tower ${p.h}`, text: `Build a tower ${p.h} blocks high with a ${blockName(p.top)} on top.`,
      features: [reach('height', p.h, { key: 'high', name: `${p.h} blocks high`, icon: B.COBBLE }),
        hasBlock(p.top, { key: 'top', name: `${blockName(p.top)} on top`, where: ['top'] })],
      example: [...column(0, 0, p.h - 1, B.COBBLE), [0, p.h - 1, 0, p.top]],
    }),
  },
  bridge: {
    pick: (r, round) => ({ len: rint(r, 8, 14, round) }),
    ok: p => inRange(p.len, 8, 14),
    make: p => ({
      name: `Water Bridge ${p.len}`, text: `Build a bridge over water, ${p.len} blocks long.`,
      features: [atLeast(p.len, null, { key: 'span', name: `${p.len} blocks over water`, icon: B.PLANKS, where: ['overWater'] })],
      example: bridgePic(Math.min(p.len, 10)),
    }),
  },
  rainbow: {
    pick: (r, round) => ({ c: rint(r, 4, MAX_COLOURS, round), h: rint(r, 3, 4, 0) }),
    ok: p => inRange(p.c, 4, MAX_COLOURS) && inRange(p.h, 3, 4),
    make: p => ({
      name: `Rainbow Wall ${p.c}`, text: `Build a wall with ${p.c} different colours of wool.`,
      features: [different(p.c, WOOLS, { key: 'colours', name: `${p.c} wool colours`, icon: WOOL.fire }),
        reach('height', p.h, { key: 'tall', name: `${p.h} blocks high`, icon: WOOL.water })],
      example: wallPic(Math.max(6, p.c), p.h, p.c),
    }),
  },
  wide: {
    pick: (r, round) => ({ w: rint(r, 8, 14, round), h: rint(r, 2, 3, 0) }),
    ok: p => inRange(p.w, 8, 14) && inRange(p.h, 2, 3),
    make: p => ({
      name: `Long Wall ${p.w}`, text: `Build a long wall, ${p.w} blocks wide.`,
      features: [reach('width', p.w, { key: 'wide', name: `${p.w} blocks wide`, icon: B.STONE_BRICKS }),
        reach('height', p.h, { key: 'tall', name: `${p.h} blocks high`, icon: B.COBBLE })],
      example: wallPic(Math.min(p.w, 10), p.h, 1).map(b => [b[0], b[1], b[2], B.STONE_BRICKS]),
    }),
  },
  glowtower: {
    pick: (r, round) => ({ h: rint(r, 6, 8, round), n: rint(r, 3, 5, round) }),
    ok: p => inRange(p.h, 6, 8) && inRange(p.n, 3, 5),
    make: p => ({
      name: `Glow Tower ${p.h}`, text: `Build a tower ${p.h} blocks high with ${p.n} Lamps in it.`,
      features: [reach('height', p.h, { key: 'high', name: `${p.h} blocks high`, icon: B.COBBLE }),
        atLeast(p.n, [B.LAMP], { key: 'lamps', name: `${p.n} Lamps`, where: ['all'] })],
      example: Array.from({ length: p.h }, (_, y) => [0, y, 0, y % 2 === 1 && y <= p.n * 2 - 1 ? B.LAMP : B.COBBLE]),
    }),
  },
  startower: {
    pick: (r, round) => ({ h: rint(r, 8, 10, round), n: rint(r, 3, 4, round) }),
    ok: p => inRange(p.h, 8, 10) && inRange(p.n, 3, 4),
    make: p => ({
      name: `Star Tower ${p.h}`, text: `Build a tower ${p.h} blocks high with ${p.n} Star Blocks in it.`,
      features: [reach('height', p.h, { key: 'high', name: `${p.h} blocks high`, icon: B.STONE_BRICKS }),
        atLeast(p.n, [B.STAR_BLOCK], { key: 'stars', name: `${p.n} Star Blocks`, where: ['all'] })],
      example: tower3(p.h, starPlaces(p.h, p.n)),
      tip: 'Star Blocks come from treasure maps.',
    }),
  },
};
export const BUILD_IDS = Object.keys(BUILD_TEMPLATES);
export const buildSpecOk = s => !!s && typeof s === 'object' && !!BUILD_TEMPLATES[s.t] && BUILD_TEMPLATES[s.t].ok(s);
export const makeBuild = s => BUILD_TEMPLATES[s.t].make(s);
// A mission's build: a BUILDS id (hand-written missions) or a `{ t, ...params }` object (the mission maker).
export const buildOf = def => (typeof def.build === 'string' ? BUILDS[def.build] : makeBuild(def.build));
