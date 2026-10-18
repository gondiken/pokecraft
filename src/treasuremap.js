// Treasure map spots (T29): 5 columns per world from the seed and the terrain only (world.ground, biome(), the generated gyms,
// tower and new-land slots), never from player edits, so every player in a world gets the same spots. Never change the rules:
// it would move the X in existing worlds. Only the first MAP_GYMS gym defs count as landmarks / keep-outs, so gyms added later
// (T32) do not move them (T32: keep new gyms 12 blocks away from treasureSpots()).
import { B, mulberry32 } from './blocks.js';
import { WATER_LEVEL, MID_X, MID_Z } from './world.js';
import { GYMS } from './gyms.js';

export const MAP_GYMS = 27;
export const MAP_RULES = { edge: 10, gap: 12, pad: 6, slot: 4, spread: 40, start: 14, tries: 400, maxG: WATER_LEVEL + 24 };
export const MAP_LEGS = [ // per map: landmark and how far from its door (steps straight out)
  { from: 'tower', min: 8, max: 16 }, { from: 'gym', min: 10, max: 20 }, { from: 'gym', min: 14, max: 26 },
  { from: 'gym', min: 18, max: 32 }, { from: 'gym', min: 22, max: 40 },
];
export const DOOR_STEPS = 8; // the door column is one step outside the door (centre + front * 8)

// Chebyshev distance from a column to an inclusive box (0 inside).
const boxDist = (x, z, b) => Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1, 0);

function landmarksFor(world, k) {
  if (k === 0) return world.tower ? [{ name: world.tower.def?.name || "Champion's Tower", tower: true, x: world.tower.x, z: world.tower.z, front: world.tower.front }] : [];
  return world.gyms
    .filter(g => GYMS.indexOf(g.def) >= 0 && GYMS.indexOf(g.def) < MAP_GYMS && g.def.slot == null && !g.home && !g.sky
      && g.def.place !== 'cave' && g.x != null && g.front)
    .map(g => ({ name: g.def.name, x: g.x, z: g.z, front: g.front, gym: g }));
}

// Everything a spot must stay clear of: protect boxes (first MAP_GYMS gyms and the tower), sky gym pads, new-land slot boxes.
function keepOuts(world) {
  const boxes = [];
  for (const g of world.gyms) if (GYMS.indexOf(g.def) < MAP_GYMS) for (const b of g.protect || []) boxes.push(b);
  for (const b of world.tower?.protect || []) boxes.push(b);
  const pads = world.gyms.filter(g => g.sky && g.pad).map(g => g.pad);
  const slots = world.newLandSlots().map(s => s.box);
  return { boxes, pads, slots };
}

// "Left" as the player sees it with the back to the door, looking along `front` = [fx, fz]: three.js looks along -z at yaw 0 with +x
// on the right, so right = (-fz, fx) and left = (fz, -fx). (Checked in the game by the missions spec.)
export const leftOf = front => [front[1], -front[0]];

function okColumn(world, x, z, k, rules, out, chosen) {
  const { W, D } = world;
  if (x < rules.edge || z < rules.edge || x > W - 1 - rules.edge || z > D - 1 - rules.edge) return false;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const g = world.ground[(x + a) + (z + b) * W];
    if (g <= WATER_LEVEL || g > rules.maxG) return false;
  }
  for (const b of out.boxes) if (boxDist(x, z, b) <= rules.gap) return false;
  for (const p of out.pads) if (Math.max(Math.abs(x - p[0]), Math.abs(z - p[2])) <= rules.pad) return false;
  for (const s of out.slots) if (boxDist(x, z, s) <= rules.slot) return false;
  for (const c of chosen) if (Math.max(Math.abs(x - c.x), Math.abs(z - c.z)) < rules.spread) return false;
  if (Math.max(Math.abs(x - MID_X), Math.abs(z - MID_Z)) < rules.start) return false;
  return true;
}

function makeSpot(world, k, x, z, land, fwd, side, fallback, relaxed = fallback) {
  return { k, x, z, g: world.ground[x + z * world.W], land, fwd, side, fallback, relaxed };
}

function findSpot(world, k, chosen, out) {
  const leg = MAP_LEGS[k % MAP_LEGS.length];
  const rand = mulberry32((world.seed ^ 0x7ea5a9e) + k * 7919);
  const list = landmarksFor(world, k);
  if (!list.length) return null;
  const attempts = [{ ...MAP_RULES }, { ...MAP_RULES, gap: 8, spread: 24 }];
  for (const rules of attempts) {
    for (let pick = 0; pick < 6; pick++) {
      const L = list[Math.floor(rand() * list.length)];
      const door = [L.x + L.front[0] * DOOR_STEPS, L.z + L.front[1] * DOOR_STEPS];
      const left = leftOf(L.front);
      for (let t = 0; t < rules.tries; t++) {
        const fwd = leg.min + Math.floor(rand() * (leg.max - leg.min + 1));
        const side = Math.round((rand() * 2 - 1) * fwd / 2);
        const x = door[0] + L.front[0] * fwd + left[0] * side;
        const z = door[1] + L.front[1] * fwd + left[1] * side;
        if (okColumn(world, x, z, k, rules, out, chosen)) {
          return makeSpot(world, k, x, z, { name: L.name, door, front: L.front, tower: !!L.tower }, fwd, side, false, rules !== attempts[0]);
        }
      }
    }
  }
  // Fallback: any good column on the map, measured from the nearest landmark door.
  const rules = { ...MAP_RULES, gap: 8, spread: 24 };
  for (let t = 0; t < 20000; t++) {
    const x = Math.floor(rand() * world.W), z = Math.floor(rand() * world.D);
    if (!okColumn(world, x, z, k, rules, out, chosen)) continue;
    let best = null, bd = Infinity;
    for (const L of list) {
      const door = [L.x + L.front[0] * DOOR_STEPS, L.z + L.front[1] * DOOR_STEPS];
      const d = Math.hypot(x - door[0], z - door[1]);
      if (d < bd) { bd = d; best = { L, door }; }
    }
    const { L, door } = best;
    const left = leftOf(L.front);
    const dx = x - door[0], dz = z - door[1];
    const fwd = dx * L.front[0] + dz * L.front[1];
    const side = dx * left[0] + dz * left[1];
    return makeSpot(world, k, x, z, { name: L.name, door, front: L.front, tower: !!L.tower }, fwd, side, true);
  }
  return null;
}

// -> [{ k, x, z, g, land: { name, door: [x, z], front, tower }, fwd, side, fallback (plain search, no usable way), relaxed (gap 8 / spread 24) }], cached on the world (world.treasureSpots).
export function treasureSpots(world) {
  if (world.treasureSpots) return world.treasureSpots;
  const out = keepOuts(world), chosen = [];
  for (let k = 0; k < MAP_LEGS.length; k++) {
    const s = findSpot(world, k, chosen, out);
    if (s) chosen.push(s);
  }
  return (world.treasureSpots = chosen);
}

/* ------------------------------- the words -------------------------------- */

const PLACE = {
  forest: 'It is in the forest', meadow: 'It is in a field of flowers', plains: 'It is on the grass', desert: 'It is in the sandy desert',
  beach: 'It is on the beach', swamp: 'It is in the muddy swamp', taiga: 'It is in the snowy pine forest', mountain: 'It is on the mountain',
  snow: 'It is high up in the snow', peak: 'It is high up in the snow',
};

// What is close by right now (current blocks, within 4 columns); the spot itself never moves.
function nearWord(world, spot) {
  const seen = new Set(), wet = [];
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
    const x = spot.x + a, z = spot.z + b;
    if (!world.inBounds(x, 0, z)) continue;
    for (let y = world.ground[x + z * world.W] + 6; y >= Math.max(1, spot.g - 2); y--) {
      const id = world.get(x, y, z);
      if (id !== B.AIR) seen.add(id);
    }
  }
  for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) if (world.get(spot.x + a, WATER_LEVEL, spot.z + b) === B.WATER) wet.push(1);
  if (seen.has(B.FLOWER_BUSH)) return 'near a flower bush';
  if (seen.has(B.CACTUS)) return 'next to a cactus';
  if (seen.has(B.PINE_LOG)) return 'near a pine tree';
  if (seen.has(B.LOG)) return 'near a tree';
  if (seen.has(B.CRYSTAL)) return 'near a shiny crystal';
  if (wet.length) return 'close to the water';
  return 'on open ground';
}

// -> { lines: [string], near: string }. No numbers bigger than 40, no compass words.
export function clueOf(world, spot) {
  const { land, fwd, side } = spot;
  const steps = n => `${n} step${n === 1 ? '' : 's'}`;
  let way;
  if (spot.fallback) way = 'Look at the map picture!';
  else {
    const start = land.tower ? `Walk out of the door of the ${land.name}. Go ${steps(fwd)} straight ahead`
      : `Stand at the door of the ${land.name} with your back to it. Walk ${steps(fwd)} straight ahead`;
    way = start + (side === 0 ? '.' : `, then ${steps(Math.abs(side))} to your ${side > 0 ? 'left' : 'right'}.`);
  }
  const near = nearWord(world, spot);
  const place = `${PLACE[world.biome(spot.x, spot.z)] || PLACE.plains}, ${near}.`;
  return { lines: [way, place, 'Dig 2 blocks down on the X!'], near };
}

/* ------------------------------- the picture ------------------------------ */

// The map piece: a top-down picture of the blocks around the spot with a red X. size = cells per side (odd).
export function drawMap(canvas, world, spot, colorOf, { size = 41, px = 4 } = {}) {
  canvas.width = canvas.height = size * px;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  const half = (size - 1) / 2;
  const rand = mulberry32(spot.x * 31 + spot.z * 17 + 5);
  for (let cz = 0; cz < size; cz++) {
    for (let cx = 0; cx < size; cx++) {
      const x = spot.x - half + cx, z = spot.z - half + cz;
      // torn edge: cells on the border row/column are sometimes missing
      const edge = Math.min(cx, cz, size - 1 - cx, size - 1 - cz);
      const r = rand();
      if (edge === 0 && r < 0.5) continue;
      if (edge === 1 && r < 0.15) continue;
      let y = -1, id = B.AIR;
      if (world.inBounds(x, 0, z)) for (y = 47; y >= 0; y--) { id = world.get(x, y, z); if (id !== B.AIR) break; }
      let col = id === B.AIR ? [40, 40, 40] : colorOf(id);
      if (id === B.WATER) col = [70, 110, 190];
      else { const f = Math.max(0.7, Math.min(1.3, 1 + (y - spot.g) * 0.04)); col = col.map(v => Math.min(255, v * f)); }
      // parchment tint
      col = col.map((v, i) => v * 0.85 + [236, 218, 170][i] * 0.15);
      g.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      g.fillRect(cx * px, cz * px, px, px);
    }
  }
  // the red X, 2 px lines, 5 cells wide
  const c = half * px + px / 2, r = 2.5 * px;
  g.lineCap = 'butt';
  g.strokeStyle = '#fff'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(c - r, c - r); g.lineTo(c + r, c + r); g.moveTo(c + r, c - r); g.lineTo(c - r, c + r); g.stroke();
  g.strokeStyle = '#d81818'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(c - r, c - r); g.lineTo(c + r, c + r); g.moveTo(c + r, c - r); g.lineTo(c - r, c + r); g.stroke();
  // parchment border
  g.strokeStyle = '#b8935a'; g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  return canvas;
}

/* ---------------------------- hot / cold and found ------------------------- */

// -> { dist, word, period, found }. dist = horizontal distance to the middle of the spot column.
export function findCheck(player, spot) {
  const p = player.pos;
  const dist = Math.hypot(p.x - (spot.x + 0.5), p.z - (spot.z + 0.5));
  const word = dist > 48 ? 'cold' : dist > 24 ? 'warm' : dist > 8 ? 'hot!' : dist > 1.6 ? 'very hot!' : 'Dig here!';
  const period = Math.max(0.35, Math.min(3, 0.3 + dist / 12));
  const found = Math.abs(Math.floor(p.x) - spot.x) <= 1 && Math.abs(Math.floor(p.z) - spot.z) <= 1 && p.y <= spot.g - 0.9 && !!player.onGround;
  return { dist, word, period, found };
}
