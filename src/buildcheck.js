// T29 build challenges. scanBuild finds the build next to the player: placed blocks only (world.edits, not air or water), joined by
// faces, edges or corners (26 neighbours), the biggest group touching a placed block within `reach` of the player.
// The report works with the feature helpers (features.js), like a home's room report.
// Zones: all = every block of the build, top = its highest layer, base = its lowest layer, overWater = blocks with water below them
// (straight down through air).
import { B, WOOL, PLACEABLE } from './blocks.js';
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
