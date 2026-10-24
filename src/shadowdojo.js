// The Shadow Dojo (T37b, wave 12; slot 8 of the south strip): the Ninja gym, the 32nd and last gym of our world. A walled
// garden at dusk with paper lanterns, a dojo hall and a pagoda; Leader Kage waits on the pagoda roof. It is about sneaking,
// never a fail: watchers walk set paths with a lantern and its light falls on the floor where they look. Caught in the light
// = "Spotted!" and a puff of smoke puts you back at the last stone lantern you passed. Hide in tall grass, behind paper
// screens or between barrels; walk (never run) on the golden nightingale boards; sneak up behind a watcher for a surprise
// attack (your creature moves first). Kids who like jumping take the rooftops: the garden wall, a beam to the hall roof,
// a beam to the pagoda and barrel steps up its roofs.
// The building is plain blocks inside the slot box; the watchers, their light and the lit lanterns live in DojoLive
// (LIVE.dojo), per player, in memory only (never saved or sent). The pieces it wires together are in sneak.js.
//
// Local coordinates as in the other slot gyms: `d` steps along `front` (towards the gate, which faces the middle of the
// map), `s` steps across (`side`). Every block stays inside the slot box (the guarded `put` throws otherwise).
import * as THREE from 'three';
import { B, WOOL } from './blocks.js';
import { WORLD_H, WATER_LEVEL, MID_X, MID_Z } from './world.js';
import { trainersOf, trainerKey } from './gyms.js';
import { LiveCells } from './livecells.js';
import { Watcher, Hideout, FloorMap, Checkpoint } from './sneak.js';
import { sound } from './sound.js';

const HALF = 22;  // the site: flat ground and the protected box (+-22)
const WALL = 20;  // the garden wall stands at Chebyshev distance 20
const PAG = -13;  // the pagoda's middle (d); it stands at s = 0
// The hall: walls at d = HALL.d0 / d1 and s = +-HALL.s; the front door (s0..s1) and the back door.
const HALL = { d0: -2, d1: 8, s: 12, front: [-9, -7], back: [7, 9] };

// Tunables (one object so the owner can make it easier or harder).
export const DOJO = {
  speed: 1.0,      // watchers walk this many blocks a second (the player walks 4.3)
  range: 5.5,      // how far a lantern's light reaches
  angle: 0.6,      // half the light cone (radians, about 34 degrees)
  pause: 1.8,      // seconds a watcher stands at each corner of its path
  hear: 8,         // a squeak within this many blocks makes a watcher turn
  turn: 3,         // and look there this long
  grace: 2.5,      // seconds nobody can spot you after a puff, a battle or arriving
  battle: 3,       // a trainer who spots you this close battles you instead (no puff)
  run: 5.0,        // faster than this (blocks a second) on nightingale boards = running = squeak
};

// Where the people walk, in local (d, s) points (a loop; two points = back and forth). who: a trainer index or a guard index.
const WATCH = [
  { id: 'suzu', trainer: 0, path: [[12, -12], [12, 12]] },                                // the front garden, across the path
  { id: 'ren', trainer: 1, path: [[6.5, -10.5], [6.5, 10.5], [-0.5, 10.5], [-0.5, -10.5]] }, // round the hall's board corridor
  { id: 'hoshi', guard: 0, path: [[-6, -7], [-6, 7], [-18, 7], [-18, -7]] },                // round the pagoda
];
// Hiding spots: two cells each [d, s] and the side they open to ([dd, ds]); built from `block`, two high.
const NOOKS = [
  { id: 'grass1', kind: 'grass', cells: [[15, -5], [15, -4]], open: [1, 0] },
  { id: 'grass2', kind: 'grass', cells: [[15, 4], [15, 5]], open: [1, 0] },
  { id: 'grass3', kind: 'grass', cells: [[10, -5], [10, -4]], open: [1, 0] },
  { id: 'grass4', kind: 'grass', cells: [[10, 4], [10, 5]], open: [1, 0] },
  { id: 'screen1', kind: 'screen', cells: [[3, -7], [4, -7]], open: [0, 1] },
  { id: 'screen2', kind: 'screen', cells: [[3, 0], [3, 1]], open: [-1, 0] },
  { id: 'screen3', kind: 'screen', cells: [[2, 6], [3, 6]], open: [0, 1] },
  { id: 'barrel1', kind: 'barrel', cells: [[-4, 2], [-4, 3]], open: [-1, 0] }, // opens to the courtyard (never to the hall wall)
  { id: 'barrel2', kind: 'barrel', cells: [[-12, 9], [-13, 9]], open: [0, -1] },
  { id: 'barrel3', kind: 'barrel', cells: [[-12, -9], [-13, -9]], open: [0, 1] },
  { id: 'barrel4', kind: 'barrel', cells: [[-8, -3], [-8, -2]], open: [1, 0] },
];
const NOOK_BLOCK = { grass: B.TALL_GRASS, screen: B.SHOJI, barrel: B.BARREL };
// Stone lanterns (checkpoints): the lantern [d, s], where you come back [d, s] and the way you face then [dd, ds].
const LANTERNS = [
  { at: [18, -3], stand: [18, -1], way: [-1, 0] }, // inside the gate
  { at: [9, -11], stand: [9, -9], way: [-1, 0] },  // at the hall's front door
  { at: [-4, 11], stand: [-4, 8], way: [-1, 0] },  // out of the hall's back door
];
// Paper lanterns on posts [d, s] round the garden.
const POSTS = [[19, 3], [16, -8], [16, 8], [11, 14], [11, -14], [-4, -12], [-5, 14], [-19, 12], [-19, -12]];
const TREES = [[14, -16], [-16, -16], [-16, 16], [18, 12]];

export function buildShadowDojo(world, def, slot) {
  const { x: x0, z: z0, box } = slot;
  const ddx = MID_X - x0, ddz = MID_Z - z0; // the gate faces the middle of the map, like the other gyms
  const front = Math.abs(ddx) > Math.abs(ddz) ? [Math.sign(ddx), 0] : [0, Math.sign(ddz) || 1];
  const side = [front[1], front[0]];
  const col = (d, s) => [x0 + front[0] * d + side[0] * s, z0 + front[1] * d + side[1] * s];
  // The garden sits at the height of the land just outside the gate (so the way in is never a cliff); the spire (fy + 16)
  // stays below WORLD_H.
  const [gx, gz] = col(HALF + 3, 0);
  const fy = Math.max(WATER_LEVEL + 1, Math.min(world.inBounds(gx, 0, gz) ? world.ground[gx + gz * world.W] : world.terrainHeight(x0, z0), 24));
  const pt = (d, s) => [x0 + 0.5 + front[0] * d + side[0] * s, z0 + 0.5 + front[1] * d + side[1] * s]; // a point (cell middles at whole d, s)
  const dir = (dd, ds) => [front[0] * dd + side[0] * ds, front[1] * dd + side[1] * ds];
  const heading = (dd, ds) => { const [wx, wz] = dir(dd, ds); return Math.atan2(wx, wz); };
  const inBox = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
  const put = (x, y, z, id) => {
    if (!inBox(x, z) || y < 1 || y >= WORLD_H) throw new Error(`Shadow Dojo wrote outside its slot box at ${x},${y},${z}`);
    world.set(x, y, z, id, false);
  };
  const putD = (d, s, y, id) => { const [x, z] = col(d, s); put(x, y, z, id); };
  const getD = (d, s, y) => { const [x, z] = col(d, s); return world.get(x, y, z); };
  const fill = (d, s, y0, y1, id) => { for (let y = y0; y <= y1; y++) putD(d, s, y, id); };
  const bbox = (d0, d1, s0, s1) => {
    const a = col(d0, s0), b = col(d1, s1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  };
  const cheb = (d, s) => Math.max(Math.abs(d), Math.abs(s));
  const site = bbox(-HALF, HALF, -HALF, HALF);
  world.levelSite(site, fy, box, 0);
  const DARK = WOOL.ninja, RED = WOOL.fire;

  // 1. The garden floor: moss inside the wall, raked gravel in the back courtyard, gravel paths and stepping stones.
  for (let d = -WALL + 1; d < WALL; d++) for (let s = -WALL + 1; s < WALL; s++) putD(d, s, fy, d <= -3 && cheb(d, s) < 18 ? B.GRAVEL : B.GRASS);
  for (let d = 13; d <= 19; d++) for (let s = -1; s <= 1; s++) putD(d, s, fy, B.GRAVEL);
  for (let d = 11; d <= 12; d++) for (let s = -9; s <= 1; s++) putD(d, s, fy, B.GRAVEL);
  for (let d = 9; d <= 10; d++) for (let s = -9; s <= -7; s++) putD(d, s, fy, B.GRAVEL);
  for (let d = 15; d <= 17; d++) for (let s = -1; s <= 1; s++) putD(d, s, fy, B.NIGHTINGALE); // a few squeaky boards on the way in
  for (const [d, s] of [[-3, 8], [-4, 7], [-5, 6], [-6, 4], [-7, 3], [-8, 1], [-9, 0], [-7, 1], [-5, 5]]) putD(d, s, fy, B.STONE_BRICKS);

  // 2. The wall: stone at the bottom, pale plaster, a dark cap. The gate (3 wide) faces the middle of the map; a red torii in front.
  for (let d = -WALL; d <= WALL; d++) for (let s = -WALL; s <= WALL; s++) {
    if (cheb(d, s) !== WALL) continue;
    putD(d, s, fy + 1, B.STONE_BRICKS);
    putD(d, s, fy + 2, (Math.abs(d) + Math.abs(s)) % 8 === 0 ? B.LOG : WOOL.normal);
    putD(d, s, fy + 3, DARK);
  }
  for (let s = -1; s <= 1; s++) for (let y = fy + 1; y <= fy + 3; y++) putD(WALL, s, y, B.AIR);
  putD(21, 0, fy, B.GRAVEL);
  for (const s of [-2, 2]) fill(21, s, fy + 1, fy + 5, RED);
  for (let s = -2; s <= 2; s++) putD(21, s, fy + 4, RED);
  for (let s = -3; s <= 3; s++) putD(21, s, fy + 6, DARK);
  for (const s of [-3, 3]) putD(21, s, fy + 5, RED);
  for (let s = -1; s <= 1; s++) putD(21, s, fy + 5, RED);
  for (let s = -1; s <= 1; s++) putD(21, s, fy, B.GRAVEL);
  // A gravel ramp from the torii down (or up) to the land just outside the slot box, so the way in is never a cliff.
  for (let s = -2; s <= 2; s++) {
    const [ox, oz] = col(HALF + 3, s);
    const out = world.inBounds(ox, 0, oz) ? world.ground[ox + oz * world.W] : fy; // the natural land height (no trees)
    for (let d = 22; d <= HALF + 2; d++) {
      const h = Math.max(1, Math.min(WORLD_H - 8, fy + Math.round((out - fy) * (d - 21) / 4)));
      for (let y = 1; y < WORLD_H; y++) putD(d, s, y, y < h ? B.STONE : y === h ? (Math.abs(s) <= 1 ? B.GRAVEL : B.STONE_BRICKS) : B.AIR);
    }
  }

  // 3. The pond (beside the way in) with a stone rim.
  for (let d = 12; d <= 18; d++) for (let s = 10; s <= 17; s++) {
    const rim = d === 12 || d === 18 || s === 10 || s === 17;
    if (rim) putD(d, s, fy, B.STONE_BRICKS);
    else { putD(d, s, fy, B.WATER); putD(d, s, fy - 1, B.SAND); }
  }

  // 4. The dojo hall: tatami in the middle, nightingale boards round the edge (two wide), plank and paper walls, a dark roof.
  const floors = new FloorMap();
  const hallIn = (d, s) => d > HALL.d0 && d < HALL.d1 && Math.abs(s) < HALL.s;
  for (let d = HALL.d0; d <= HALL.d1; d++) for (let s = -HALL.s; s <= HALL.s; s++) {
    const [x, z] = col(d, s);
    if (hallIn(d, s)) {
      const edge = d >= HALL.d1 - 2 || d <= HALL.d0 + 2 || Math.abs(s) >= HALL.s - 2;
      putD(d, s, fy, edge ? B.NIGHTINGALE : B.TATAMI);
      floors.add(x, fy, z, edge ? 'squeak' : 'quiet');
      continue;
    }
    // the walls: log posts at the corners and every 4, paper screens between them
    const post = (Math.abs(d) === HALL.s || Math.abs(s) === HALL.s) && ((d === HALL.d0 || d === HALL.d1) && (Math.abs(s) === HALL.s || s % 4 === 0) || (Math.abs(s) === HALL.s && (d - HALL.d0) % 5 === 0));
    putD(d, s, fy, B.PLANKS);
    for (let y = fy + 1; y <= fy + 4; y++) putD(d, s, y, post ? B.LOG : y === fy + 1 || y === fy + 4 ? B.PLANKS : B.SHOJI);
  }
  for (let s = HALL.front[0]; s <= HALL.front[1]; s++) for (let y = fy + 1; y <= fy + 3; y++) putD(HALL.d1, s, y, B.AIR);
  for (let s = HALL.back[0]; s <= HALL.back[1]; s++) for (let y = fy + 1; y <= fy + 3; y++) putD(HALL.d0, s, y, B.AIR);
  for (let s = HALL.front[0]; s <= HALL.front[1]; s++) { const [x, z] = col(HALL.d1, s); putD(HALL.d1, s, fy, B.NIGHTINGALE); floors.add(x, fy, z, 'squeak'); }
  for (let s = HALL.back[0]; s <= HALL.back[1]; s++) { const [x, z] = col(HALL.d0, s); putD(HALL.d0, s, fy, B.NIGHTINGALE); floors.add(x, fy, z, 'squeak'); }
  for (let d = 15; d <= 17; d++) for (let s = -1; s <= 1; s++) { const [x, z] = col(d, s); floors.add(x, fy, z, 'squeak'); }
  // the roof: one block over the walls all round (red trim), a ridge along the middle; paper lanterns hang inside
  for (let d = HALL.d0 - 1; d <= HALL.d1 + 1; d++) for (let s = -HALL.s - 1; s <= HALL.s + 1; s++) {
    const trim = d === HALL.d0 - 1 || d === HALL.d1 + 1 || Math.abs(s) === HALL.s + 1;
    putD(d, s, fy + 5, trim ? RED : DARK);
    if (d >= 2 && d <= 4) putD(d, s, fy + 6, d === 3 ? RED : DARK);
  }
  for (const s of [-7, 0, 7]) for (const d of [5, 1]) putD(d, s, fy + 4, B.PAPER_LANTERN);
  world.markLitBox(...Object.values(bbox(HALL.d0, HALL.d1, -HALL.s, HALL.s)));

  // 5. The pagoda: a red-cornered tower (walls at Chebyshev 3), three dark roofs that get smaller going up, a deck on top
  // (Leader Kage) and a golden spire. Inside, steps go round a middle pillar up to the deck: the ground way up.
  const P = (dd, ds) => [PAG + dd, ds]; // pagoda-local -> d, s
  for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) {
    const c = cheb(a, b), [d, s] = P(a, b);
    if (c <= 3) putD(d, s, fy, B.PLANKS);
    if (c === 3) for (let y = fy + 1; y <= fy + 11; y++) {
      const corner = Math.abs(a) === 3 && Math.abs(b) === 3;
      const win = !corner && (Math.abs(a) === 3 ? Math.abs(b) <= 1 : Math.abs(a) <= 1) && [fy + 2, fy + 3, fy + 6, fy + 7, fy + 10].includes(y);
      putD(d, s, y, corner ? B.LOG : win ? B.SHOJI : y === fy + 4 || y === fy + 8 ? DARK : RED);
    }
    if (c <= 1) for (let y = fy + 1; y <= fy + 11; y++) putD(d, s, y, B.PLANKS); // the middle pillar
    if (c >= 4) putD(d, s, fy + 4, c === 5 && Math.abs(a) === 5 && Math.abs(b) === 5 ? RED : DARK); // the first roof
    if (c === 5 && Math.abs(a) === 5 && Math.abs(b) === 5) putD(d, s, fy + 5, RED); // upturned corners
    if (c === 4) putD(d, s, fy + 5, DARK); // the first roof slopes up to the wall
    if (c === 4) putD(d, s, fy + 8, DARK); // the second roof
    if (c === 4 && Math.abs(a) === 4 && Math.abs(b) === 4) putD(d, s, fy + 9, RED);
    if (c <= 3) putD(d, s, fy + 12, c === 3 ? RED : DARK); // the deck
  }
  for (const [a, b, y] of [[1, 0, fy + 3], [-1, 0, fy + 7], [0, 1, fy + 10], [0, -1, fy + 5]]) putD(...P(a, b), y, B.PAPER_LANTERN);
  putD(...P(3, 0), fy + 1, B.AIR); putD(...P(3, 0), fy + 2, B.AIR); // the door (1 wide, 2 high)
  // the steps: round the ring (Chebyshev 2) from the cell inside the door, one up per cell, solid underneath
  const RING = [[2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [-1, 2], [-2, 2], [-2, 1], [-2, 0], [-2, -1], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [2, -1]];
  for (let k = 0; k <= 10; k++) fill(...P(...RING[k + 1]), fy + 1, fy + 1 + k, B.PLANKS);
  for (let i = 7; i <= 11; i++) putD(...P(...RING[i]), fy + 12, B.AIR); // room for your head over the top steps
  for (const [a, b] of [[3, 3], [3, -3], [-3, 3], [-3, -3]]) putD(...P(a, b), fy + 13, RED); // railing posts
  putD(...P(0, 0), fy + 13, DARK); putD(...P(0, 0), fy + 14, WOOL.treasure); putD(...P(0, 0), fy + 15, WOOL.treasure); putD(...P(0, 0), fy + 16, B.PAPER_LANTERN);
  world.markLitBox(...Object.values(bbox(PAG - 3, PAG + 3, -3, 3)));

  // 6. Hiding spots: two cells walled by tall grass, paper screens or barrels on every side but one.
  const hideouts = NOOKS.map(n => {
    const id = NOOK_BLOCK[n.kind];
    const inside = (d, s) => n.cells.some(([a, b]) => a === d && b === s);
    const front = (d, s) => n.cells.some(([a, b]) => a + n.open[0] === d && b + n.open[1] === s);
    for (const [cd, cs] of n.cells) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const d = cd + a, s = cs + b;
      if (inside(d, s) || front(d, s)) continue;
      fill(d, s, fy + 1, fy + 2, id);
    }
    for (const [d, s] of n.cells) for (let y = fy + 1; y <= fy + 3; y++) putD(d, s, y, B.AIR);
    const b = bbox(Math.min(...n.cells.map(c => c[0])), Math.max(...n.cells.map(c => c[0])), Math.min(...n.cells.map(c => c[1])), Math.max(...n.cells.map(c => c[1])));
    return { id: n.id, kind: n.kind, box: { ...b, y0: fy + 1, y1: fy + 2 } };
  });

  // 7. Maple trees and paper lanterns on posts.
  for (const [td, ts] of TREES) {
    fill(td, ts, fy + 1, fy + 3, B.LOG);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let y = fy + 3; y <= fy + 6; y++) {
      const r = y === fy + 6 ? 1 : y === fy + 3 ? 1 : 2;
      if (Math.abs(a) > r || Math.abs(b) > r || (Math.abs(a) === 2 && Math.abs(b) === 2)) continue;
      if (getD(td + a, ts + b, y) === B.AIR) putD(td + a, ts + b, y, B.MAPLE_LEAVES);
    }
  }
  for (const [d, s] of POSTS) { fill(d, s, fy + 1, fy + 2, B.LOG); putD(d, s, fy + 3, B.PAPER_LANTERN); }

  // 8. The rooftop way: barrel steps up onto the wall, along its top, a beam to the hall roof, across the roof, a beam to the
  // pagoda's first roof and barrel steps up its roofs to the deck. Every step is one block up.
  fill(17, 19, fy + 1, fy + 1, B.BARREL);
  fill(18, 19, fy + 1, fy + 2, B.BARREL);
  for (let s = 14; s <= 19; s++) putD(6, s, fy + 4, B.LOG);                  // the wall top (fy + 3) -> the hall roof (fy + 5)
  for (let d = HALL.d0 - 2; d >= PAG + 6; d--) putD(d, 2, fy + 5, B.LOG);    // the hall roof -> the pagoda's first roof (fy + 4)
  fill(...P(4, 5), fy + 5, fy + 6, B.BARREL);                               // first roof -> second roof (fy + 8)
  fill(...P(3, 5), fy + 5, fy + 7, B.BARREL);
  fill(...P(1, 4), fy + 9, fy + 9, B.BARREL);                               // second roof -> the deck (fy + 12)
  fill(...P(0, 4), fy + 9, fy + 10, B.BARREL);
  fill(...P(-1, 4), fy + 9, fy + 11, B.BARREL);

  // 9. Stone lanterns (checkpoints): a stone foot, the lantern, a little dark roof.
  const cell = (d, s, y) => { const [x, z] = pt(d, s); return [x, y, z]; };
  const checkpoints = LANTERNS.map((l, i) => {
    const [ld, ls] = l.at;
    putD(ld, ls, fy + 1, B.STONE_BRICKS);
    putD(ld, ls, fy + 2, B.STONE_LANTERN);
    putD(ld, ls, fy + 3, DARK);
    const [x, z] = col(ld, ls);
    return { id: `lantern${i}`, cell: [x, fy + 2, z], stand: cell(...l.stand, fy + 1), yaw: Math.atan2(-dir(...l.way)[0], -dir(...l.way)[1]) };
  });

  // 10. The floor cells the lanterns' light may fall on: inside the wall, open above (water and hiding walls stay as they are).
  const light = [];
  for (let d = -WALL + 1; d < WALL; d++) for (let s = -WALL + 1; s < WALL; s++) {
    const [x, z] = col(d, s);
    const id = world.get(x, fy, z);
    if (id === B.WATER || world.get(x, fy + 1, z) !== B.AIR || world.get(x, fy + 2, z) !== B.AIR) continue;
    light.push([x, z]);
  }

  // 11. The people: watchers start at the first point of their path; the leader stands on the deck facing the gate.
  const watchers = WATCH.map(w => {
    const path = w.path.map(([d, s]) => pt(d, s));
    return { id: w.id, trainer: w.trainer ?? null, guard: w.guard ?? null, path };
  });
  const startOf = w => [w.path[0][0], fy + 1, w.path[0][1]];
  const legHeading = w => Math.atan2(w.path[1][0] - w.path[0][0], w.path[1][1] - w.path[0][1]);
  const trainerWatch = trainersOf(def).map((_, i) => watchers.find(w => w.trainer === i));
  const trainerPositions = trainerWatch.map(w => startOf(w));
  const trainerHeadings = trainerWatch.map(w => legHeading(w));
  const people = (def.guards || []).map((p, i) => {
    const w = watchers.find(x => x.guard === i);
    return { kind: 'guest', name: p.name, title: `${p.name} (${def.name})`, colors: p.colors, look: p.look, line: p.line, sneak: p.sneak, pos: startOf(w), heading: legHeading(w), guard: i };
  });
  const [ex, ez] = col(21, 0); // under the torii
  const garden = bbox(-WALL + 1, WALL - 1, -WALL + 1, WALL - 1);
  return {
    def, x: x0, z: z0, y: fy + 1, fy, front, side,
    entry: [ex, fy + 1, ez],
    watchers, hideouts, floors, checkpoints, light,
    garden: { ...garden, y0: fy + 1, y1: fy + 3 }, // where watchers can spot you (on the ground inside the wall)
    leaderPos: cell(...P(3, 0), fy + 13), leaderHeading: heading(1, 0),
    trainerPos: trainerPositions[0], trainerPositions, trainerHeadings, people,
    pagoda: { door: col(...P(3, 0)), deck: fy + 12, steps: RING.slice(1, 12).map(([a, b]) => col(...P(a, b))) },
    route: { wallStep: col(17, 19), deckStep: col(...P(-1, 4)) },
    protect: [{ ...site, y0: 1, y1: WORLD_H - 1 }],
    area: { ...site, y0: fy, y1: WORLD_H - 1 },
  };
}

// The live part (LIVE.dojo): watchers, their light on the floor, hiding, squeaky boards, stone lanterns and the puff back.
// State is per player and in memory only. It only wires sneak.js pieces together.
const SMOKE = 0.8; // seconds a puff of smoke lasts

export class DojoLive {
  constructor(game, gym) {
    this.game = game;
    this.gym = gym;
    this.def = gym.def;
    const y = gym.fy + 1;
    this.watchers = gym.watchers.map(w => Object.assign(new Watcher({ id: w.id, path: w.path, y, speed: DOJO.speed, pause: DOJO.pause, range: DOJO.range, angle: DOJO.angle, hear: DOJO.hear, turn: DOJO.turn }), { trainer: w.trainer, guard: w.guard, npc: null }));
    this.hideouts = gym.hideouts.map(h => new Hideout(h));
    this.floors = gym.floors;
    this.checkpoints = gym.checkpoints.map(c => new Checkpoint(c));
    this.lightable = new Set(gym.light.map(([x, z]) => `${x},${z}`));
    this.cells = new LiveCells(game.world, () => game.player);
    this.base = new Map();   // 'x,z' -> the floor block under a light cell
    this.lit = new Set();    // 'x,z' cells drawn as light now
    this.last = 0;           // the stone lantern you passed last
    this.passed = new Set(); // lanterns passed this visit (drawn lit)
    this.drawnLanterns = new Set();
    this.grace = DOJO.grace;
    this.coneT = 0;
    this.squeakT = 0;
    this.spots = 0;
    this.squeaks = 0;
    this.puffs = [];
    this.near = false;
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.solid = (x, yy, z) => game.world.isSolid(x, yy, z);
    for (const w of this.watchers) if (this.beaten(w)) w.stopped = true;
  }

  beaten(w) { return w.trainer != null && this.game.beaten.includes(trainerKey(this.def, w.trainer)); }
  watcherOf(npc) { return npc?.gym === this.gym ? this.watchers.find(w => w.npc === npc) || null : null; }
  hidden(pos) { return this.hideouts.some(h => h.hides(pos)); }
  safe(pos) { return this.checkpoints.some(c => c.isSafe(pos)); }
  inGarden(pos) {
    const g = this.gym.garden;
    return pos.x >= g.x0 && pos.x < g.x1 + 1 && pos.z >= g.z0 && pos.z < g.z1 + 1 && pos.y >= g.y0 - 0.5 && pos.y < g.y1;
  }
  inArea(pos) { const a = this.gym.area; return pos.x >= a.x0 && pos.x < a.x1 + 1 && pos.z >= a.z0 && pos.z < a.z1 + 1; }
  // Can anybody spot you now? Never in a battle, a question box, a panel, a pause, or the grace time after a puff.
  canSpot() {
    const g = this.game;
    return this.grace <= 0 && !g.inBattle && !g.ui?.asking && !g.ui?.panelOpen && this.playing();
  }
  seenBy(pos) {
    if (this.hidden(pos) || this.safe(pos)) return null;
    return this.watchers.find(w => w.sees(pos, this.solid)) || null;
  }

  // Finds the people the watchers carry (they change with every world) and gives them a lantern.
  bind() {
    for (const w of this.watchers) {
      if (w.npc && this.game.npcs.list.includes(w.npc)) continue;
      w.npc = this.game.npcs.list.find(n => n.gym === this.gym && (w.trainer != null ? n.kind === 'trainer' && (n.index || 0) === w.trainer : n.kind === 'guest' && n.def?.guard === w.guard)) || null;
      if (!w.npc) continue;
      if (!w.npc.model.userData.lantern) {
        const g = new THREE.Group();
        const stick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.55), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
        stick.position.set(0, 0, 0.27);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial({ color: 0xffb04a }));
        lamp.position.set(0, -0.18, 0.55);
        g.add(stick, lamp);
        g.position.set(0.38, 1.25, 0.1);
        w.npc.model.add(g);
        w.npc.model.userData.lantern = g;
      }
    }
  }

  update(dt = 0) {
    const g = this.game, p = g.player;
    if (!p) return;
    this.bind();
    this.cells.flush();
    if (g.inBattle || g.ui?.asking || g.ui?.panelOpen) this.grace = Math.max(this.grace, 1.2);
    else this.grace -= dt;
    this.squeakT -= dt;
    this.updatePuffs(dt);
    // Watchers: beaten trainers stop where they are (no light); the others walk (not during a battle).
    for (const w of this.watchers) {
      if (!w.stopped && this.beaten(w)) { w.stopped = true; w.noise = null; }
      if (!g.inBattle) w.update(dt);
      const n = w.npc;
      if (!n) continue;
      if (w.stopped) {
        if (n.steer) {
          n.steer = false;
          n.homeHeading = w.heading;
          for (const l of n.model.userData.parts?.legs || []) l.g.rotation.x = 0;
        }
        continue;
      }
      n.steer = true;
      n.moving = w.moving;
      n.pos.set(w.x, w.y, w.z);
      n.heading = n.homeHeading = w.heading;
    }
    // Walked out of the dojo: the lanterns start over.
    const inArea = this.inArea(p.pos);
    if (!inArea && this.passed.size) { this.passed.clear(); this.last = 0; }
    // Only near the dojo is anything drawn.
    const a = this.gym.area, far = Math.max(a.x0 - p.pos.x, p.pos.x - a.x1, a.z0 - p.pos.z, p.pos.z - a.z1) > 24;
    if (far) { if (this.near) this.clearLight(); this.near = false; this.drawLanterns(); return; }
    this.near = true;
    this.coneT -= dt;
    if (this.coneT <= 0) { this.coneT = 0.1; this.drawLight(); }
    if (inArea && !g.inBattle) this.passLanterns(p.pos);
    this.drawLanterns();
    if (!inArea || g.inBattle) return;
    // Running on the nightingale boards: squeak, and the watchers near you turn to look.
    if (p.onGround && this.floors.under(p.pos) === 'squeak' && Math.hypot(p.vel.x, p.vel.z) > DOJO.run && this.squeakT <= 0) this.squeak(p.pos);
    // Spotted?
    if (!this.canSpot() || !this.inGarden(p.pos)) return;
    const w = this.seenBy(p.pos);
    if (w) this.spotted(w);
  }

  // Stone lanterns you walk past: the last one is where a puff takes you.
  passLanterns(pos) {
    const g = this.game;
    this.checkpoints.forEach((c, i) => {
      if (!c.passed(pos) || (this.last === i && this.passed.has(i))) return;
      const first = !this.passed.has(i);
      this.last = i;
      this.passed.add(i);
      if (!first) return;
      sound.play('checkpoint');
      const told = g.toldOnce;
      if (told && !told.has('dojo:lantern')) { told.add('dojo:lantern'); g.ui?.toast('A stone lantern! If a watcher spots you, a puff of smoke brings you back here.'); }
    });
  }

  squeak(pos) {
    this.squeakT = 0.45;
    this.squeaks++;
    sound.play('squeak');
    let heard = 0;
    for (const w of this.watchers) if (Math.abs(pos.y - w.y) < 2 && w.hearNoise(pos.x, pos.z)) heard++;
    const told = this.game.toldOnce;
    if (told && !told.has('dojo:squeak')) { told.add('dojo:squeak'); this.game.ui?.toast('Squeak! The golden boards squeak when you run. Walk softly!'); }
    return heard;
  }

  // Seen by w: a trainer close by battles you (no puff); otherwise a puff of smoke takes you back to the last lantern.
  spotted(w) {
    const g = this.game, p = g.player;
    this.spots++;
    const dist = Math.hypot(p.pos.x - w.x, p.pos.z - w.z);
    if (w.trainer != null && w.npc && dist <= DOJO.battle) {
      const t = trainersOf(this.def)[w.trainer];
      g.ui?.toast(`Spotted! ${t.name} wants to battle!`);
      this.grace = DOJO.grace;
      g.startBattle?.({ trainer: w.npc, team: t.team, intro: t.intro });
      return 'battle';
    }
    this.sendBack(w);
    return 'puff';
  }

  sendBack(w) {
    const g = this.game, p = g.player, cp = this.checkpoints[this.last] || this.checkpoints[0];
    this.puff(p.pos.x, p.pos.y, p.pos.z);
    p.pos.set(...cp.stand);
    p.vel.set(0, 0, 0);
    p.yaw = cp.yaw;
    p.pitch = 0;
    this.puff(...cp.stand);
    this.grace = DOJO.grace;
    sound.play('puff');
    const who = w?.npc?.name ? `${w.npc.name} spotted you! ` : 'Spotted! ';
    g.ui?.toast(`${who}Poof! Back to the lantern. Hide in the grass, behind screens or barrels!`);
  }

  // A little puff of grey smoke (a few boxes that grow and fade).
  puff(x, y, z) {
    const scene = this.game.world?.scene;
    if (!scene) return;
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xc8c4d0, transparent: true, opacity: 0.8, depthWrite: false });
    const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(geo, mat);
      const a = i * 2.4, r = 0.35 + (i % 3) * 0.12;
      m.userData.to = [Math.cos(a) * r, 0.3 + (i % 4) * 0.35, Math.sin(a) * r];
      group.add(m);
    }
    group.position.set(x, y, z);
    scene.add(group);
    this.puffs.push({ group, mat, geo, t: 0 });
  }

  updatePuffs(dt) {
    for (const f of this.puffs) {
      f.t += dt;
      const k = Math.min(1, f.t / SMOKE);
      for (const m of f.group.children) { const [a, b, c] = m.userData.to; m.position.set(a * (0.5 + k), b * (0.6 + k * 0.6), c * (0.5 + k)); m.scale.setScalar(0.6 + k * 1.4); }
      f.mat.opacity = 0.8 * (1 - k);
    }
    for (const f of this.puffs.filter(f => f.t >= SMOKE)) this.dropPuff(f);
  }

  dropPuff(f) {
    f.group.parent?.remove(f.group);
    f.geo.dispose();
    f.mat.dispose();
    this.puffs.splice(this.puffs.indexOf(f), 1);
  }

  // The light cones on the floor: every lightable cell some watcher's light falls on, drawn as LANTERN_LIGHT.
  drawLight() {
    const want = new Set();
    for (const w of this.watchers) for (const [x, z] of w.cone(this.solid)) { const k = `${x},${z}`; if (this.lightable.has(k)) want.add(k); }
    const fy = this.gym.fy, world = this.game.world;
    for (const k of this.lit) if (!want.has(k)) { const [x, z] = k.split(',').map(Number); this.cells.want(x, fy, z, this.base.get(k)); }
    for (const k of want) {
      if (this.lit.has(k)) continue;
      const [x, z] = k.split(',').map(Number);
      if (!this.base.has(k)) this.base.set(k, world.get(x, fy, z));
      this.cells.want(x, fy, z, B.LANTERN_LIGHT);
    }
    this.lit = want;
  }

  clearLight() {
    const fy = this.gym.fy;
    for (const k of this.lit) { const [x, z] = k.split(',').map(Number); this.cells.want(x, fy, z, this.base.get(k)); }
    this.lit = new Set();
  }

  drawLanterns() {
    this.checkpoints.forEach((c, i) => {
      const on = this.passed.has(i);
      if (on === this.drawnLanterns.has(i)) return;
      if (on) this.drawnLanterns.add(i); else this.drawnLanterns.delete(i);
      this.game.world.setLive(c.cell[0], c.cell[1], c.cell[2], on ? B.STONE_LANTERN_ON : B.STONE_LANTERN);
    });
  }

  // A sneak attack: right behind a watcher who can't see you.
  sneaky(w) {
    const p = this.game.player?.pos;
    return !!p && !w.stopped && w.behind(p) && !w.sees(p, this.solid);
  }

  // Talking to (tapping) a watcher: from behind = a surprise attack; a guard just jumps.
  talk(npc) {
    const w = this.watcherOf(npc);
    if (!w) return false;
    const sneak = this.sneaky(w);
    if (w.trainer != null) {
      if (this.beaten(w)) return false; // "You already beat me!"
      const t = trainersOf(this.def)[w.trainer];
      this.grace = DOJO.grace;
      this.game.startBattle({ trainer: npc, team: t.team, intro: sneak ? (t.sneak || ['Eek! Where did you come from?']) : t.intro, surprise: sneak });
      return true;
    }
    const d = npc.def || {};
    if (sneak) sound.play('popout');
    this.game.ui?.toast(`${npc.name}: ${sneak ? d.sneak || 'Eek! You sneaked up on me! Real ninja feet!' : d.line || 'Shh!'}`);
    return true;
  }

  talkPrompt(npc) {
    const w = this.watcherOf(npc);
    if (!w || (w.trainer != null && this.beaten(w))) return null;
    if (this.sneaky(w)) return { verb: w.trainer != null ? 'sneak attack' : 'surprise', action: w.trainer != null ? 'Sneak attack!' : 'Boo!' };
    return w.trainer != null ? null : { verb: 'talk', action: 'Talk' };
  }

  battleEnded() { this.grace = DOJO.grace; }

  prompt(block) {
    if (block.id === B.STONE_LANTERN || block.id === B.STONE_LANTERN_ON) return 'Stone lantern · walk past it';
    if (block.id === B.LANTERN_LIGHT) return 'Lantern light · stay out of it!';
    return null;
  }

  state() {
    return { last: this.last, passed: [...this.passed], grace: this.grace, spots: this.spots, squeaks: this.squeaks, lit: this.lit.size, watchers: this.watchers.map(w => w.state()) };
  }

  dispose() {
    for (const f of [...this.puffs]) this.dropPuff(f);
    for (const w of this.watchers) {
      const n = w.npc;
      if (!n) continue;
      n.steer = false;
      const l = n.model.userData.lantern;
      if (l) { n.model.remove(l); l.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); n.model.userData.lantern = null; }
    }
  }
}
