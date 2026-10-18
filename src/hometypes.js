// T22: home types as data. A HomeType says which features (and an optional rule) make a room a home of that kind;
// nothing else (meter, glow, preview, the 'What can my home be?' panel, spawning) knows type names, they only read evaluate()'s result.
// Add a type with addHomeType(); tests add a throw-away one the same way.
import { B, WOOL, TREASURE } from './blocks.js';
import { HOME_SPAWN } from './spawnrules.js';

// T29: the feature helpers live in features.js (build challenges use them too); re-exported so every import keeps working.
import { count, hasBlock, atLeast, mostly } from './features.js';
export { count, hasBlock, atLeast, mostly };

export const GEMS_NEED = 15; // the ONE place: gems a treasure home needs (meter, Book row and spawn bonus read it from here)

export class HomeType {
  // T30.5: doneText / lostText (toasts), emoji (meter), near (the Book's words for its visitors), sparkle (the home glitters)
  constructor({ id, name, blurb = '', creature, rule = null, features, need = features.length, show = 'hearts', example, spawn, gymMovesIn = null,
    doneText, lostText, emoji = '🏠', near = null, sparkle = false }) {
    doneText = doneText ?? `Your home is a ${name} now!`;
    lostText = lostText ?? `Your home is not a ${name} any more. Stand on the Doormat to see what is missing.`;
    Object.assign(this, { id, name, blurb, creature, rule, features, need, show, example, spawn, gymMovesIn, doneText, lostText, emoji, near, sparkle });
  }

  // -> { room: report.checks, ok, rule: { key, name, icon, done, have, need } | null,
  //      features: [{ key, name, icon, done, have, need }], done, need, show, finished, full }
  evaluate(report) {
    const one = f => ({ key: f.key, name: f.name, icon: f.icon, ...f.check(report) });
    const rule = this.rule ? one(this.rule) : null;
    const features = this.features.map(one);
    const done = features.filter(f => f.done).length;
    const ok = !!report?.ok;
    const finished = ok && (!rule || rule.done) && done >= this.need;
    return {
      room: report?.checks ?? { walls: false, roof: null, size: null, floor: null }, ok, rule, features, done, need: this.need,
      show: this.show, finished, full: finished && done === features.length,
    };
  }
}

export const HOME_TYPES = {}; // registry, in panel order (also the order of home.types)
const spawnAdded = new Set(); // ids whose HOME_SPAWN entry addHomeType made (removeHomeType takes it away again)
const textAdded = new Set();  // ids whose HOME_SPAWN text addHomeType copied from the type's `near`
export function addHomeType(t) {
  HOME_TYPES[t.id] = t;
  if (!(t.id in HOME_SPAWN) && t.spawn) { HOME_SPAWN[t.id] = t.spawn; spawnAdded.add(t.id); }
  const s = HOME_SPAWN[t.id]; // T30.5: the Book reads the type's own words without spawnrules.js importing this file
  if (s && t.near && s.text == null) { s.text = t.near; textAdded.add(t.id); }
  return t;
}
export function removeHomeType(id) { // tests clean up
  delete HOME_TYPES[id];
  if (textAdded.delete(id) && HOME_SPAWN[id]) delete HOME_SPAWN[id].text;
  if (spawnAdded.delete(id)) delete HOME_SPAWN[id];
}

/* ------------------------------- examples ------------------------------- */

// A tidy box house as a block list in local coordinates (floor at y = 0, x 0..w-1, z 0..d-1). The door is in the
// front wall (z = 0), `door` wide (1 or 2) and 2 high with the wall above it; the Doormat lies just inside it.
// Block = [x, y, z, id, tag]; tags are the room checks (walls, roof, floor) or a feature / rule key.
export function boxHouse({ w, d, h = 3, wall, corner = wall, roof, rim = roof, floor, door = 1 }) {
  const blocks = [];
  const dx0 = Math.floor((w - door) / 2);
  const isDoor = (x, y, z) => z === 0 && y <= 2 && x >= dx0 && x < dx0 + door;
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) {
      blocks.push([x, 0, z, floor, 'floor']);
      const edge = x === 0 || z === 0 || x === w - 1 || z === d - 1;
      const isCorner = (x === 0 || x === w - 1) && (z === 0 || z === d - 1);
      if (edge) for (let y = 1; y <= h; y++) if (!isDoor(x, y, z)) blocks.push([x, y, z, isCorner ? corner : wall, 'walls']);
      blocks.push([x, h + 1, z, edge ? rim : roof, 'roof']);
    }
  }
  const mat = [dx0, 0, 1];
  const i = blocks.findIndex(b => b[0] === mat[0] && b[1] === 0 && b[2] === mat[2]);
  blocks[i] = [mat[0], 0, mat[2], B.DOORMAT, 'floor'];
  return { mat, blocks };
}
// Puts extra blocks ([x, y, z, id, tag]) into a house, replacing whatever was at those spots.
function withBlocks(house, extra) {
  const key = b => `${b[0]},${b[1]},${b[2]}`;
  const map = new Map(house.blocks.map(b => [key(b), b]));
  for (const b of extra) map.set(key(b), b);
  return { mat: house.mat, blocks: [...map.values()] };
}

// 10x10 outside (8x8 floor), planks walls with log corners, 1-wide door, planks roof with a log rim, and a bed, a
// fireplace, a 2x2 cozy rug, a lamp in the roof and two windows.
const COZY_EXAMPLE = withBlocks(
  boxHouse({ w: 10, d: 10, wall: B.PLANKS, corner: B.LOG, roof: B.PLANKS, rim: B.LOG, floor: B.PLANKS }),
  [
    [1, 1, 8, B.BED, 'bed'],
    [5, 2, 9, B.FIREPLACE, 'fire'],
    [4, 0, 4, WOOL.cozy, 'rug'], [5, 0, 4, WOOL.cozy, 'rug'], [4, 0, 5, WOOL.cozy, 'rug'], [5, 0, 5, WOOL.cozy, 'rug'],
    [4, 4, 5, B.LAMP, 'lamp'],
    [0, 2, 5, B.GLASS, 'windows'], [9, 2, 5, B.GLASS, 'windows'],
  ],
);

// 10x10 stone-brick house with 16 gems: 12 in the back wall (mixed Sunstone / Ruby / Sapphire), 2 in the floor and 2 in the
// ceiling (so it qualifies with room to spare).
const TREASURE_EXAMPLE = withBlocks(
  boxHouse({ w: 10, d: 10, wall: B.STONE_BRICKS, roof: B.STONE_BRICKS, floor: B.STONE_BRICKS }),
  [
    ...[2, 3, 4, 5, 6, 7].flatMap(x => [1, 2].map(y => [x, y]))
      .map(([x, y], i) => [x, y, 9, TREASURE[i % 3], 'gems']),
    [3, 0, 3, B.SUNSTONE, 'gems'], [6, 0, 3, B.RUBY, 'gems'],
    [4, 4, 5, B.SAPPHIRE, 'gems'], [5, 4, 5, B.SUNSTONE, 'gems'],
  ],
);

// Writes an example house with its floor at (x, y, z) (spec helper; the game never calls it). Returns the Doormat's cell.
export function placeExample(world, type, x, y, z) {
  const ex = (typeof type === 'string' ? HOME_TYPES[type] : type).example;
  for (const [bx, by, bz, id] of ex.blocks) world.set(x + bx, y + by, z + bz, id);
  return [x + ex.mat[0], y + ex.mat[1], z + ex.mat[2]];
}

const WOOD = [B.PLANKS, B.LOG, B.PINE_LOG], WOOLS = Object.values(WOOL);

addHomeType(new HomeType({
  id: 'cozy', name: 'Cozy home', creature: 'cozy', blurb: 'Soft and warm. Cozy creatures come to visit.',
  rule: mostly(WOOD, 0.5, { key: 'wood', name: 'Wooden walls', icon: B.PLANKS }),
  features: [
    hasBlock(B.BED, { key: 'bed', name: 'Bed' }),
    hasBlock(B.FIREPLACE, { key: 'fire', name: 'Fireplace', where: ['inside', 'wall'] }),
    atLeast(4, WOOLS, { key: 'rug', name: 'Rug', icon: WOOL.cozy, where: ['floor', 'inside'] }),
    hasBlock(B.LAMP, { key: 'lamp', name: 'Lamp', where: ['inside', 'wall', 'roof'] }),
    atLeast(2, [B.GLASS], { key: 'windows', name: 'Windows', where: ['wall'] }),
  ],
  need: 3, show: 'hearts', example: COZY_EXAMPLE, spawn: HOME_SPAWN.cozy, gymMovesIn: 'cozy', // T23 uses gymMovesIn
  emoji: '❤️', doneText: 'Your home is cozy now! Cozy creatures may come to visit.',
  lostText: 'Your home is not cozy any more. Stand on the Doormat to see what is missing.',
}));
addHomeType(new HomeType({
  id: 'treasure', name: 'Treasure home', creature: 'treasure', blurb: `${GEMS_NEED} gems in the walls, floor or ceiling. More gems, more treasure visitors!`,
  features: [atLeast(GEMS_NEED, TREASURE, { key: 'gems', name: 'Gems', icon: B.SUNSTONE, where: ['wall', 'floor', 'roof'] })],
  need: 1, show: 'counter', example: TREASURE_EXAMPLE, spawn: HOME_SPAWN.treasure,
  emoji: '💎', sparkle: true, near: `near a home with ${GEMS_NEED}+ gems`,
  doneText: 'Your home is a treasure home now! ✨',
  lostText: 'Your home is not a treasure home any more. Stand on the Doormat to see what is missing.',
}));
