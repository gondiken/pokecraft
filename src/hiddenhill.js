// The Hidden Hill Gym (T19, slot 1): from outside a natural grassy hill (it is made of whatever the land around it
// is made of), with a door hidden behind a bush on the side facing away from the start. Inside: a normal gym room
// with six stone pillars, two of which are the disguised trainers (see npc.js `disguiseAs`). plans/T19.md section 4.2.
import { B, WOOL, isSolid } from './blocks.js';
import { WORLD_H, WATER_LEVEL, MID_X, MID_Z, hash2, groundOf, PLANTS } from './world.js';

const HR = 18; // hill radius
const HILL_H = 12; // hill height above the floor at the middle
const R = 7; // the room: interior +-6, walls at +-7
const TUN = 14; // the tunnel runs from the front wall (d = 7) to d = 14; the hill's cut face is there
const BUSH = 17; // the hedge

export function buildHiddenHill(world, def, slot) {
  const { x: x0, z: z0, box } = slot;
  const fy = Math.max(WATER_LEVEL + 2, Math.min(world.terrainHeight(x0, z0), 26));
  // The door faces AWAY from the start (the other way round from every other gym): walk round the hill to find it.
  // But the way in must be walkable: if the land in front of that side climbs more than 4 blocks (or is water), the
  // next side is tried (terrain only, so the choice never depends on anything else). Order: away, the two sides, towards.
  const dx = MID_X - x0, dz = MID_Z - z0;
  const away = Math.abs(dx) > Math.abs(dz) ? [-Math.sign(dx), 0] : [0, -(Math.sign(dz) || 1)];
  const climb = f => {
    let worst = -99;
    for (let d = 20; d <= 24; d++) for (const s of [-2, 0, 2]) {
      const x = x0 + f[0] * d + (f[0] ? 0 : s), z = z0 + f[1] * d + (f[1] ? 0 : s), h = world.terrainHeight(x, z);
      worst = Math.max(worst, h <= WATER_LEVEL ? fy - WATER_LEVEL : h - fy); // water in front counts as a climb of its depth
    }
    return worst;
  };
  const sides = [away, [away[1], away[0]], [-away[1], -away[0]], [-away[0], -away[1]]];
  const front = sides.find(f => climb(f) <= 4) || sides.reduce((a, b) => (climb(b) < climb(a) ? b : a));

  // (d, s): d steps towards the door, s sideways.
  const col = (d, s) => [x0 + front[0] * d + (front[0] ? 0 : s), z0 + front[1] * d + (front[1] ? 0 : s)];
  const inBox = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
  const put = (x, y, z, id) => {
    if (!inBox(x, z)) throw new Error(`Hidden Hill wrote outside its slot box at ${x},${z}`);
    world.set(x, y, z, id, false);
  };
  const putD = (d, s, y, id) => { const [x, z] = col(d, s); put(x, y, z, id); };
  const topSolid = (x, z) => { for (let y = WORLD_H - 1; y >= 0; y--) if (isSolid(world.get(x, y, z))) return y; return -1; };

  // 1. Clear plants within r <= 21.
  for (let x = x0 - 21; x <= x0 + 21; x++) for (let z = z0 - 21; z <= z0 + 21; z++) {
    if (!inBox(x, z) || Math.hypot(x - x0, z - z0) > 21) continue;
    for (let y = 1; y < WORLD_H; y++) if (PLANTS.has(world.get(x, y, z))) put(x, y, z, B.AIR);
  }

  // 2. The hill: every column is filled up to its height with its own biome's blocks, never lowered.
  for (let x = x0 - HR; x <= x0 + HR; x++) for (let z = z0 - HR; z <= z0 + HR; z++) {
    const r = Math.hypot(x - x0, z - z0);
    if (r > HR || !inBox(x, z)) continue;
    const H = fy + Math.floor(HILL_H * (1 - (r / HR) ** 2));
    const top = topSolid(x, z);
    if (top >= H) continue;
    const [topId, under] = groundOf(world.biome(x, z), H);
    for (let y = Math.max(1, top + 1); y < H; y++) put(x, y, z, under);
    put(x, H, z, topId);
  }

  // 3. The room: planks floor with a camo carpet, cobble and stone walls, a camo-wool ceiling with four lamps.
  for (let d = -R; d <= R; d++) for (let s = -R; s <= R; s++) {
    const [x, z] = col(d, s);
    for (let y = 1; y < fy; y++) if (!isSolid(world.get(x, y, z))) put(x, y, z, B.STONE);
    if (Math.abs(d) === R || Math.abs(s) === R) {
      for (let y = fy; y <= fy + 5; y++) put(x, y, z, (d + s + y) % 3 === 0 ? B.STONE : B.COBBLE);
    } else {
      put(x, fy, z, s === 0 && d <= 6 && d >= -4 ? WOOL.camo : B.PLANKS);
      for (let y = fy + 1; y <= fy + 5; y++) put(x, y, z, B.AIR);
    }
    put(x, fy + 6, z, WOOL.camo);
  }
  for (const [d, s] of [[-4, -4], [-4, 4], [4, -4], [4, 4]]) putD(d, s, fy + 6, B.LAMP);

  // 4. Six stone pillars (1 x 1, 2 high); two of the six places are empty: the disguised trainers stand there.
  const hidden = [[2, -4], [-1, 4]];
  for (const [d, s] of [[2, 4], [-1, 4], [-4, 4], [2, -4], [-1, -4], [-4, -4]]) {
    if (hidden.some(([hd, hs]) => hd === d && hs === s)) continue;
    putD(d, s, fy + 1, B.STONE);
    putD(d, s, fy + 2, B.STONE);
  }

  // 5. The tunnel (1 wide, 2 tall, stone walls and roof) from the front wall to the hill's face, and the cut in front of it.
  for (let d = R; d <= TUN; d++) {
    for (let s = -1; s <= 1; s++) {
      if (d === R && s) continue; // the wall itself
      if (s) { for (let y = fy; y <= fy + 3; y++) putD(d, s, y, B.STONE); continue; }
      putD(d, 0, fy, B.PLANKS);
      putD(d, 0, fy + 1, B.AIR);
      putD(d, 0, fy + 2, B.AIR);
      if (d > R) putD(d, 0, fy + 3, d === 10 || d === 13 ? B.LAMP : B.STONE);
    }
  }
  for (let y = fy + 1; y <= fy + 2; y++) putD(R, 0, y, B.AIR); // the doorway in the front wall
  // Door approach: the ground in front of the tunnel is level (cut or filled to fy) and clear above it.
  for (let d = TUN + 1; d <= 19; d++) for (let s = -3; s <= 3; s++) {
    const [x, z] = col(d, s);
    const [topId, under] = groundOf(world.biome(x, z), fy);
    for (let y = WORLD_H - 1; y > fy; y--) if (world.get(x, y, z) !== B.AIR) put(x, y, z, B.AIR);
    for (let y = Math.max(1, topSolid(x, z) + 1); y < fy; y++) put(x, y, z, under);
    put(x, fy, z, topId);
  }
  // Beyond the cut the ground slopes (at most 1 block per block, 5 wide) towards the land outside: a walkable way in.
  for (let d = 20; d <= 24; d++) for (let s = -2; s <= 2; s++) {
    const [x, z] = col(d, s);
    const top = topSolid(x, z), T = Math.max(fy - (d - 19), Math.min(fy + (d - 19), top));
    const [topId, under] = groundOf(world.biome(x, z), T);
    if (top > T) { for (let y = WORLD_H - 1; y > T; y--) if (world.get(x, y, z) !== B.AIR) put(x, y, z, B.AIR); put(x, T, z, topId); }
    else if (top < T) { for (let y = Math.max(1, top + 1); y < T; y++) put(x, y, z, under); put(x, T, z, topId); }
  }
  // The bush: a leaf hedge 3 wide and 2 high in front of the hole, a flower bush on its middle.
  for (let s = -1; s <= 1; s++) { putD(BUSH, s, fy + 1, B.LEAVES); putD(BUSH, s, fy + 2, B.LEAVES); }
  putD(BUSH, 0, fy + 3, B.FLOWER_BUSH);

  // 6. Two or three plants on top, of the kind this biome grows.
  const plants = [];
  for (let k = 0; k < 3; k++) {
    const a = hash2(k, 5, world.seed + 711 + k) * Math.PI * 2, r = 4 + hash2(k, 9, world.seed + 711 + k) * 4;
    const x = Math.round(x0 + Math.cos(a) * r), z = Math.round(z0 + Math.sin(a) * r);
    const y = topSolid(x, z), id = world.get(x, y, z);
    if (world.biome(x, z) === 'desert' && id === B.SAND) { put(x, y + 1, z, B.CACTUS); put(x, y + 2, z, B.CACTUS); }
    else if (id === B.SNOW && world.biome(x, z) === 'taiga') world.placePine(x, y + 1, z);
    else if (id === B.GRASS && k < 2) world.placeTree(x, y + 1, z);
    else if (id === B.GRASS) put(x, y + 1, z, B.FLOWER_BUSH);
    else continue;
    plants.push([x, y + 1, z]);
  }

  world.markLit(x0, z0);
  const cell = (d, s) => { const [x, z] = col(d, s); return [x + 0.5, fy + 1, z + 0.5]; };
  const room = [col(-R, -R), col(R, R)], tunEnd = col(TUN, R);
  const span = (a, i, ...more) => [Math.min(...room.map(c => c[i]), ...more), Math.max(...room.map(c => c[i]), ...more)];
  const [px0, px1] = span(0, 0, tunEnd[0]), [pz0, pz1] = span(0, 1, tunEnd[1]);
  const [ix0, ix1] = [Math.min(room[0][0], room[1][0]) + 1, Math.max(room[0][0], room[1][0]) - 1];
  const [iz0, iz1] = [Math.min(room[0][1], room[1][1]) + 1, Math.max(room[0][1], room[1][1]) - 1];
  const [mx, mz] = col(TUN, 0), [bx, bz] = col(BUSH, 0);
  return {
    def, x: x0, z: z0, y: fy + 1, front,
    leaderPos: cell(-4, 0), trainerPos: cell(...hidden[0]), trainerPositions: hidden.map(([d, s]) => cell(d, s)),
    // One box holds the room and the tunnel (protect[0] is the building); the hill, hedge and trees stay open to builders.
    protect: [{ x0: px0, x1: px1, y0: 1, y1: fy + 6, z0: pz0, z1: pz1 }],
    area: { x0: ix0, x1: ix1, z0: iz0, z1: iz1, y0: fy, y1: fy + 5 }, // the room: standing on top of the hill is not "inside"
    door: [mx, fy + 1, mz], bush: [bx, fy + 1, bz], plants, hill: { fy, r: HR },
  };
}
