// The Big Top Gym (T34, Squad gym, south slot 6): a striped circus tent with an acrobats' pyramid inside. Three tiers,
// a trainer on each of the first two and the leader on top: you climb it one battle at a time. Plain blocks only, no live
// parts. Plan: plans/T34.md section 7.
//
// Local coordinates as in clocktower.js: `d` steps along `front` (the door side), `s` steps across (`side`). Every block
// stays inside the slot box (the guarded `put` throws otherwise).
import { B, WOOL } from './blocks.js';
import { WORLD_H, WATER_LEVEL } from './world.js';

const R = 10; // the walls stand at Chebyshev distance 10
const HALF = [6, 4, 2]; // half widths of the three tiers (centred at d = -2)
const PYR_D = -2;
const STRIPES = [WOOL.fire, WOOL.squad, WOOL.grass]; // orange, blue, green

export function buildBigTop(world, def, slot) {
  const box = slot.box;
  const x0 = slot.x, z0 = slot.z;
  // The door faces the middle of the map, along whichever axis is closer (like the other slot gyms).
  const dx = 112 - x0, dz = 112 - z0;
  const front = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1];
  const side = [front[1], front[0]];
  const fy = Math.max(WATER_LEVEL + 1, Math.min(world.terrainHeight(x0, z0), 24)); // the peak (fy + 15) stays below WORLD_H
  const cell = (d, s) => [x0 + front[0] * d + side[0] * s, z0 + front[1] * d + side[1] * s];
  const put = (x, y, z, id) => {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1 || y < 1 || y >= WORLD_H) throw new Error(`big top: block outside its slot box (${x}, ${y}, ${z})`);
    world.set(x, y, z, id, false);
  };
  const putDS = (d, s, y, id) => { const [x, z] = cell(d, s); put(x, y, z, id); };
  const cheb = (d, s) => Math.max(Math.abs(d), Math.abs(s));

  // Level ground, a stone-brick plaza and a path to the door.
  world.levelSite({ x0: x0 - 12, x1: x0 + 12, z0: z0 - 12, z1: z0 + 12 }, fy, box, 2);
  for (let d = -12; d <= 12; d++) for (let s = -12; s <= 12; s++) {
    const c = cheb(d, s);
    if (c >= 11 || c === R) putDS(d, s, fy, B.STONE_BRICKS);
  }
  for (let d = 11; d <= 14; d++) for (let s = -1; s <= 1; s++) putDS(d, s, fy, B.STONE_BRICKS);

  // The hall: wooden floor, striped walls, glass windows, a door, a striped roof with a peak.
  for (let d = -R; d <= R; d++) for (let s = -R; s <= R; s++) {
    const c = cheb(d, s);
    if (c < R) putDS(d, s, fy, B.PLANKS);
    if (c === R) {
      const corner = Math.abs(d) === R && Math.abs(s) === R;
      const along = Math.abs(d) === R ? s : d; // front/back walls run along s, side walls along d
      const col = STRIPES[Math.floor((along + R) / 2) % 3];
      for (let y = fy + 1; y <= fy + 10; y++) putDS(d, s, y, corner ? B.STONE_BRICKS : col);
      if (!corner && Math.abs(s) === R && [-6, -5, 4, 5].includes(d)) for (let y = fy + 4; y <= fy + 5; y++) putDS(d, s, y, B.GLASS);
    }
    if (c <= R) putDS(d, s, fy + 11, WOOL.squad);
    if (c <= 7) putDS(d, s, fy + 12, STRIPES[c % 3]);
    if (c <= 4) putDS(d, s, fy + 13, STRIPES[c % 3]);
    if (c <= 1) putDS(d, s, fy + 14, STRIPES[c % 3]);
  }
  for (let s = -1; s <= 1; s++) for (let y = fy + 1; y <= fy + 3; y++) putDS(R, s, y, B.AIR); // the door
  putDS(0, 0, fy + 15, B.LAMP);
  for (const d of [-8, 8]) for (const s of [-8, 8]) putDS(d, s, fy + 10, B.LAMP);

  // A blue carpet from the door to the pyramid.
  for (let d = 5; d <= 9; d++) for (let s = -1; s <= 1; s++) putDS(d, s, fy, WOOL.squad);

  // The pyramid: three tiers, two blocks high each (orange, blue, green), with one step up to each tier.
  const tierOf = (d, s) => {
    let h = 0;
    for (let k = 1; k <= 3; k++) if (cheb(d - PYR_D, s) <= HALF[k - 1]) h = k;
    return h;
  };
  for (let d = -R + 1; d <= R - 1; d++) for (let s = -R + 1; s <= R - 1; s++) {
    const h = tierOf(d, s);
    for (let y = fy + 1; y <= fy + 2 * h; y++) putDS(d, s, y, STRIPES[Math.ceil((y - fy) / 2) - 1]);
  }
  for (const [d, y, k] of [[5, fy + 1, 0], [3, fy + 3, 1], [1, fy + 5, 2]]) for (let s = -1; s <= 1; s++) putDS(d, s, y, STRIPES[k]);

  // The people: a trainer on tier 1, a trainer on tier 2 and the leader on top, all facing the door.
  const heading = Math.atan2(front[0], front[1]);
  const stand = (d, s, y) => { const [x, z] = cell(d, s); return [x + 0.5, y, z + 0.5]; };
  const trainerPositions = [stand(3, -4, fy + 3), stand(1, 3, fy + 5)];
  const leaderPos = stand(-2, 0, fy + 7);

  world.markLitBox(x0 - 10, x0 + 10, z0 - 10, z0 + 10);

  return {
    def, x: x0, z: z0, y: fy + 1, fy, front,
    leaderPos, trainerPos: trainerPositions[0], trainerPositions, trainerHeadings: [heading, heading], leaderHeading: heading,
    tiers: [1, 2, 3].map(k => ({ k, top: fy + 2 * k, half: HALF[k - 1], id: STRIPES[k - 1] })),
    protect: [{ x0: x0 - 11, x1: x0 + 11, y0: 1, y1: WORLD_H - 1, z0: z0 - 11, z1: z0 + 11 }],
    area: { x0: x0 - 10, x1: x0 + 10, z0: z0 - 10, z1: z0 + 10, y0: fy, y1: fy + 16 },
  };
}
