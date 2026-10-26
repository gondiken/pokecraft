// Caves: tunnels carved under the hills from the world seed, glowing decorations, treasure
// chests, and the light shader that makes everything under cover dark.
import * as THREE from 'three';
import { B, WOOL, isSolid, mulberry32, ATLAS_COLS, ATLAS_ROWS } from './blocks.js';
import { OLD_W, OLD_D, WORLD_H, WATER_LEVEL } from './world.js';
import { ORIGINAL_GYMS, LEGACY_EXTRA_GYMS, LEGACY_CAVE_GYMS } from './gyms.js';

function hash3(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 1274126177) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// The cave carvers and gym-spot searches index arrays and search "the whole map" at once, so they only ever
// run on the old 224 x 224 World that generate() makes first (T17); the big world gets their results copied in.
export function legacyOnly(world) {
  if (world.W !== OLD_W || world.D !== OLD_D) throw new Error('This only runs on the old 224 x 224 map (T17)');
}

// Columns where no cave may ever be carved: map edges, shores, gyms, the tower and the start.
function keepOutMask(world) {
  legacyOnly(world);
  const Wd = world.W, D = world.D;
  const keep = new Uint8Array(Wd * D);
  const mark = (x0, z0, x1, z1) => {
    for (let x = Math.max(0, x0); x <= Math.min(Wd - 1, x1); x++) for (let z = Math.max(0, z0); z <= Math.min(D - 1, z1); z++) keep[x + z * Wd] = 1;
  };
  const edge = 4;
  for (let x = 0; x < Wd; x++) for (let z = 0; z < D; z++) {
    if (x < edge || z < edge || x >= Wd - edge || z >= D - edge) keep[x + z * Wd] = 1;
  }
  // Water and beaches (dilated by 2), so a cave never touches the sea or a lake.
  const wet = new Uint8Array(Wd * D);
  for (let i = 0; i < Wd * D; i++) wet[i] = world.ground[i] <= WATER_LEVEL + 2 ? 1 : 0;
  for (let x = 0; x < Wd; x++) {
    for (let z = 0; z < D; z++) {
      if (!wet[x + z * Wd]) continue;
      mark(x - 2, z - 2, x + 2, z + 2);
    }
  }
  // Only the original gyms (never re-run the spot search with another count); gyms 17+ are filled in afterwards.
  const spots = world.gymSpots(ORIGINAL_GYMS);
  for (const [x, z] of spots) mark(x - 18, z - 18, x + 18, z + 18);
  const [tx, tz] = world.towerSpot(spots.map(([x, z]) => ({ x, z })));
  mark(tx - 18, tz - 18, tx + 18, tz + 18);
  // Where you start: the middle of the map, and the first grass found going outwards (like findSpawn).
  const cx = Wd >> 1, cz = D >> 1;
  mark(cx - 12, cz - 12, cx + 12, cz + 12);
  spawn: for (let r = 0; r < 60; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (world.surface(cx + dx, cz + dz).id === B.GRASS) { mark(cx + dx - 10, cz + dz - 10, cx + dx + 10, cz + dz + 10); break spawn; }
      }
    }
  }
  return keep;
}

// Carves the caves into a freshly generated (terrain only) world. Everything is a function of the
// seed. Returns { air, entrances, opened, floors, crystals, chests, glow }.
export function carveCaves(world) {
  const Wd = world.W, D = world.D;
  const seed = world.seed;
  const rand = mulberry32(seed ^ 0x5eed);
  const { data, ground } = world;
  const keep = keepOutMask(world);
  const carved = []; // indices of every carved cell
  const opened = new Set(); // columns whose roof was broken (cave entrances)
  const idx = (x, y, z) => x + Wd * (z + D * y);

  // Removes the cell if the rules allow it. roofRule false = entrance mode (may break the surface).
  const carve = (x, y, z, roofRule, floorY = 2) => {
    if (x < 1 || z < 1 || x >= Wd - 1 || z >= D - 1 || y < floorY) return;
    const c = x + z * Wd;
    if (keep[c]) return;
    if (roofRule && y > ground[c] - 3) return;
    const i = idx(x, y, z);
    const id = data[i];
    if (id === B.AIR || id === B.WATER) return;
    data[i] = B.AIR;
    carved.push(i);
    if (y >= ground[c]) opened.add(c); // the surface itself is gone here
  };

  const ball = (cx, cy, cz, r, roofRule, floorY) => {
    const sy = 1.25, ry = Math.ceil(r / sy);
    const x0 = Math.floor(cx - r), x1 = Math.floor(cx + r);
    const z0 = Math.floor(cz - r), z1 = Math.floor(cz + r);
    const y0 = Math.floor(cy - ry), y1 = Math.floor(cy + ry);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * sy, dz = z + 0.5 - cz;
      if (dx * dx + dy * dy + dz * dz <= r * r) carve(x, y, z, roofRule, floorY);
    }
  };

  const paths = []; // sample points deep under hills, for the lake rooms
  const worm = (sx, sy, sz, yaw, pitch, steps, entrance) => {
    let x = sx, y = sy, z = sz, dyaw = 0;
    const g0 = ground[Math.floor(sx) + Math.floor(sz) * Wd] + (entrance ? 0 : 0);
    for (let s = 0; s < steps; s++) {
      dyaw = dyaw * 0.8 + (rand() - 0.5) * 0.35;
      yaw += dyaw;
      pitch = pitch * 0.85 + (rand() - 0.5) * 0.25;
      const entering = entrance && y > g0 - 6;
      if (entering) pitch = Math.max(-0.7, Math.min(-0.3, pitch - 0.08));
      x += Math.cos(yaw) * Math.cos(pitch);
      z += Math.sin(yaw) * Math.cos(pitch);
      y += Math.sin(pitch);
      if (x < 2 || z < 2 || x >= Wd - 2 || z >= D - 2) break;
      const gh = ground[Math.floor(x) + Math.floor(z) * Wd];
      if (!entering) {
        if (y > gh - 5) { y = gh - 5; pitch = -0.4; }
      }
      if (y < 3.5) { y = 3.5; if (pitch < 0) pitch = 0.2; }
      const r = 1.5 + 0.6 * Math.sin(s * 0.3 + sx) + (entering ? 0.6 : 0);
      ball(x, y, z, r, !entering);
      if (!entering && gh >= 18 && s % 6 === 0) paths.push([Math.floor(x), Math.floor(z)]);
    }
  };

  const randomColumn = (minGround, tries = 400) => {
    for (let i = 0; i < tries; i++) {
      const x = 5 + Math.floor(rand() * (Wd - 10)), z = 5 + Math.floor(rand() * (D - 10));
      const c = x + z * Wd;
      if (!keep[c] && ground[c] >= minGround) return [x, z];
    }
    return null;
  };

  // Ordinary tunnels.
  for (let n = 0; n < 40; n++) {
    const col = randomColumn(WATER_LEVEL + 5);
    if (!col) continue;
    const [x, z] = col, g = ground[x + z * Wd];
    worm(x + 0.5, 3 + rand() * (g - 8), z + 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.4, 60 + Math.floor(rand() * 80), false);
  }

  // Entrances on hillsides.
  const entrances = [];
  const want = 6 + Math.floor(rand() * 3);
  for (let tries = 0; tries < 6000 && entrances.length < want; tries++) {
    const x = 6 + Math.floor(rand() * (Wd - 12)), z = 6 + Math.floor(rand() * (D - 12));
    const c = x + z * Wd, g = ground[c];
    if (keep[c] || g < WATER_LEVEL + 6) continue;
    if (entrances.some(([ex, ez]) => Math.hypot(ex - x, ez - z) < 30)) continue;
    // A hillside: some neighbour 3 blocks away is at least 3 lower. Head into the hill, away from it.
    let best = null;
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
      const lo = ground[(x + dx) + (z + dz) * Wd];
      if (g - lo >= 3 && (!best || lo < best[2])) best = [dx, dz, lo];
    }
    if (!best) continue;
    const yaw = Math.atan2(-best[1], -best[0]);
    const before = opened.size;
    worm(x + 0.5, g + 0.5, z + 0.5, yaw, -0.5, 90 + Math.floor(rand() * 40), true);
    let broke = false; // it really broke through to the surface, right here
    if (opened.size > before) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (opened.has(x + dx + (z + dz) * Wd)) broke = true;
    if (broke) entrances.push([x, z]);
  }

  // Underground lakes: rooms whose lowest layers are flooded.
  const lakes = 4 + Math.floor(rand() * 3);
  for (let n = 0; n < lakes && paths.length; n++) {
    const [px, pz] = paths[Math.floor(rand() * paths.length)];
    const rx = 4 + rand() * 2, rz = 4 + rand() * 2, ry = 2.5;
    for (let x = Math.floor(px - rx); x <= px + rx; x++) for (let z = Math.floor(pz - rz); z <= pz + rz; z++) {
      for (let y = 1; y <= 6; y++) {
        const dx = (x + 0.5 - px) / rx, dz = (z + 0.5 - pz) / rz, dy = (y + 0.5 - 3) / ry;
        if (dx * dx + dy * dy + dz * dz <= 1) carve(x, y, z, true, 1);
      }
    }
  }

  // Everything carved at or below y = 2 is water, so lakes never have walls of water.
  for (const i of carved) {
    const y = Math.floor(i / (Wd * D));
    if (y <= 2) data[i] = B.WATER;
  }
  const air = carved.filter(i => data[i] === B.AIR);

  // Decoration ----------------------------------------------------------------------------
  const cellOf = i => [i % Wd, Math.floor(i / (Wd * D)), Math.floor(i / Wd) % D];
  const at = (x, y, z) => (x < 0 || z < 0 || y < 0 || x >= Wd || z >= D || y >= WORLD_H ? B.STONE : data[idx(x, y, z)]);
  const solidRock = id => id === B.STONE || id === B.DIRT || id === B.COAL_ORE || id === B.GOLD_ORE;
  const crystals = [];
  let glow = 0;
  // Ore on the walls.
  for (const i of air) {
    const [x, y, z] = cellOf(i);
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (ny < 1 || at(nx, ny, nz) !== B.STONE) continue;
      const r = hash3(nx, ny, nz, seed + 505);
      if (r < 0.012) data[idx(nx, ny, nz)] = B.GOLD_ORE;
      else if (r < 0.06) data[idx(nx, ny, nz)] = B.COAL_ORE;
    }
  }
  // Star crystals on ceilings and floors, glowcaps on floors.
  for (const i of air) {
    const [x, y, z] = cellOf(i);
    if (data[i] !== B.AIR) continue;
    const g = ground[x + z * Wd];
    const above = at(x, y + 1, z), below = at(x, y - 1, z);
    if (isSolid(above) && g - y >= 4 && hash3(x, y, z, seed + 506) < 0.015) {
      data[idx(x, y + 1, z)] = B.CRYSTAL; crystals.push([x, y + 1, z]); glow++;
      continue;
    }
    if (isSolid(below) && solidRock(below) && g - y >= 4) {
      const r = hash3(x, y, z, seed + 507);
      if (r < 0.008) {
        const h = 1 + (hash3(x, y, z, seed + 508) < 0.5 ? 1 : 0);
        for (let k = 0; k < h; k++) if (at(x, y + k, z) === B.AIR) { data[idx(x, y + k, z)] = B.CRYSTAL; glow++; }
        crystals.push([x, y, z]);
      } else if (r < 0.008 + 0.02) { data[i] = B.GLOWCAP; glow++; }
    }
  }

  // Floors: deep standing places with room to stand (air, solid below, 2+ air above).
  const floorsAll = [];
  for (const i of air) {
    const [x, y, z] = cellOf(i);
    if (data[i] !== B.AIR || ground[x + z * Wd] - y < 5 || y < 3) continue;
    const below = at(x, y - 1, z);
    if (!isSolid(below) || below === B.CRYSTAL || below === B.GLOWCAP) continue;
    if (at(x, y + 1, z) !== B.AIR || at(x, y + 2, z) !== B.AIR) continue;
    floorsAll.push([x, y, z]);
  }
  for (let i = floorsAll.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [floorsAll[i], floorsAll[j]] = [floorsAll[j], floorsAll[i]]; }
  const floors = floorsAll.slice(0, 300);

  // Treasure chests, far apart; a glowcap next to each so it can be spotted.
  const chests = [];
  for (const [x, y, z] of floorsAll) {
    if (chests.length >= 8) break;
    if (ground[x + z * Wd] - y < 6) continue;
    if (chests.some(([cx, , cz]) => Math.hypot(cx - x, cz - z) < 24)) continue;
    let cap = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (at(x + dx, y, z + dz) === B.AIR && isSolid(at(x + dx, y - 1, z + dz))) { cap = [x + dx, y, z + dz]; break; }
    }
    if (!cap) continue;
    data[idx(x, y, z)] = B.CHEST;
    data[idx(cap[0], cap[1], cap[2])] = B.GLOWCAP;
    glow++;
    chests.push([x, y, z]);
  }
  const floorsLeft = floors.filter(([x, y, z]) => data[idx(x, y, z)] === B.AIR && at(x, y + 1, z) === B.AIR);

  return { air: air.length, entrances, opened, floors: floorsLeft, crystals, chests, glow };
}

/* ------------------------------ the big cave layer (T8) ------------------------------ */

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Plans a straight stairway: from floor height fy at distance d0 from (x, z), one step up every
// `rise` blocks, until the walking surface reaches the ground. Fails if any of the 5 columns
// across (s = -2..2) is blocked (mask) or off the map. Returns the shortest of the tried directions.
export function planStairs(ground, mask, x, z, fy, d0, rise, dirs = DIRS, blockedCell = null, size) {
  if (!size) throw new Error('planStairs needs the map size [W, D]');
  const [Wd, D] = size;
  let best = null;
  for (const dir of dirs) {
    const start = typeof d0 === 'function' ? d0(dir) : d0;
    let mouth = -1, end = -1;
    for (let d = start; d <= start + 90; d++) {
      const tread = fy + Math.floor((d - start) / rise);
      let bad = false, g = 0;
      for (let s = -2; s <= 2; s++) {
        const cx = x + dir[0] * d + (dir[0] ? 0 : s), cz = z + dir[1] * d + (dir[1] ? 0 : s);
        if (cx < 2 || cz < 2 || cx >= Wd - 2 || cz >= D - 2 || mask[cx + cz * Wd]) { bad = true; break; }
        if (s === 0) g = ground[cx + cz * Wd];
        if (blockedCell && s >= -1 && s <= 1) for (let y = tread; y <= tread + 4; y++) if (blockedCell(cx, y, cz)) bad = true;
      }
      if (bad) break;
      if (mouth < 0 && tread + 4 >= g) mouth = d;
      if (tread >= g - 1) { end = d; break; }
    }
    if (end >= 0 && (!best || end - start < best.len)) best = { dir, d0: start, rise, fy, mouth, end, len: end - start };
  }
  return best;
}

// Builds a planned stairway (cobble treads, 4 blocks of headroom, lamps in the walls, an arch at
// the mouth). Returns the mouth cell and the surface columns it opened or decorated.
export function buildStairs(world, plan, x, z, { lintel = B.STONE_BRICKS, pillarExtra = null } = {}) {
  const Wd = world.W;
  const { dir, d0, rise, fy, mouth, end } = plan;
  const opened = [], marks = [];
  const col = (d, s) => [x + dir[0] * d + (dir[0] ? 0 : s), z + dir[1] * d + (dir[1] ? 0 : s)];
  for (let d = d0; d <= end; d++) {
    const tread = fy + Math.floor((d - d0) / rise);
    for (let s = -1; s <= 1; s++) {
      const [cx, cz] = col(d, s);
      world.set(cx, tread, cz, B.COBBLE, false);
      for (let y = tread + 1; y <= tread + 4; y++) world.set(cx, y, cz, B.AIR, false);
      if (tread + 4 >= world.ground[cx + cz * Wd]) opened.push(cx + cz * Wd);
    }
    if ((d - d0) % 6 === 3) {
      for (const s of [-2, 2]) {
        const [cx, cz] = col(d, s);
        if (isSolid(world.get(cx, tread + 2, cz)) && world.get(cx, tread + 2, cz) !== B.LAMP) world.set(cx, tread + 2, cz, B.LAMP, false);
      }
    }
  }
  const tread = fy + Math.floor((mouth - d0) / rise);
  for (const s of [-2, 2]) {
    const [cx, cz] = col(mouth, s);
    for (let y = tread + 1; y <= tread + 5; y++) world.set(cx, y, cz, B.STONE_BRICKS, false);
    world.set(cx, tread + 6, cz, B.LAMP, false);
    if (pillarExtra) world.set(cx, tread + 3, cz, pillarExtra, false);
    marks.push(cx + cz * Wd);
  }
  for (let s = -2; s <= 2; s++) {
    const [cx, cz] = col(mouth, s);
    world.set(cx, tread + 5, cz, s === 0 ? lintel : B.STONE_BRICKS, false);
    marks.push(cx + cz * Wd);
  }
  const [mx, mz] = col(mouth, 0);
  return { mouth: [mx, tread, mz], opened, marks };
}

// A second, much bigger cave layer on top of carveCaves (which is never changed): big halls with
// themes, wide tunnels, lit stairways up to the surface and lamp posts at the old holes. Only
// ever adds air, from the seed alone, with its own random stream. Merges into world.caves.
export function carveBigCaves(world) {
  const Wd = world.W, D = world.D;
  const seed = world.seed;
  const rand = mulberry32(seed ^ 0xb16ca7e);
  const { data, ground } = world;
  const cv = world.caves;
  const keep = keepOutMask(world);
  for (const [x, z] of world.extraGymSpots().slice(0, LEGACY_EXTRA_GYMS)) {
    for (let a = Math.max(0, x - 18); a <= Math.min(Wd - 1, x + 18); a++) for (let b = Math.max(0, z - 18); b <= Math.min(D - 1, z + 18); b++) keep[a + b * Wd] = 1;
  }
  // The Fossil Gym's cavern (and the walk to its stairs) is left alone.
  for (const sp of world.caveGymSpots().slice(0, LEGACY_CAVE_GYMS)) {
    if (!sp) continue;
    for (let a = Math.max(0, sp.x - 17); a <= Math.min(Wd - 1, sp.x + 17); a++) for (let b = Math.max(0, sp.z - 17); b <= Math.min(D - 1, sp.z + 17); b++) keep[a + b * Wd] = 1;
  }
  const idx = (x, y, z) => x + Wd * (z + D * y);
  const carved = [];
  const SKIP = new Set([B.CHEST, B.CHEST_OPEN, B.GLOWCAP, B.CRYSTAL, B.LAMP]);
  const carve = (x, y, z, floorY = 3) => {
    if (x < 1 || z < 1 || x >= Wd - 1 || z >= D - 1 || y < floorY) return;
    const c = x + z * Wd;
    if (keep[c] || y > ground[c] - 3) return;
    const i = idx(x, y, z), id = data[i];
    if (id === B.AIR || id === B.WATER || SKIP.has(id)) return;
    data[i] = B.AIR;
    carved.push(i);
  };
  const ball = (cx, cy, cz, r) => {
    const sy = 1.25, ry = Math.ceil(r / sy);
    for (let x = Math.floor(cx - r); x <= Math.floor(cx + r); x++) for (let z = Math.floor(cz - r); z <= Math.floor(cz + r); z++) {
      for (let y = Math.floor(cy - ry); y <= Math.floor(cy + ry); y++) {
        const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * sy, dz = z + 0.5 - cz;
        if (dx * dx + dy * dy + dz * dz <= r * r) carve(x, y, z);
      }
    }
  };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // A steered tunnel from (x, y, z) towards (tx, tz).
  const tunnel = (x, y, z, tx, tz, base, maxSteps) => {
    let yaw = Math.atan2(tz - z, tx - x);
    for (let s = 0; s < maxSteps; s++) {
      if (Math.hypot(tx - x, tz - z) < 2) break;
      yaw += wrap(Math.atan2(tz - z, tx - x) - yaw) * 0.15 + (rand() - 0.5) * 0.5;
      x += Math.cos(yaw); z += Math.sin(yaw);
      if (x < 3 || z < 3 || x >= Wd - 3 || z >= D - 3) break;
      const g = ground[Math.floor(x) + Math.floor(z) * Wd];
      y += (rand() - 0.5) * 0.6;
      y = Math.min(Math.max(y, 4.5), Math.max(4.5, g - 5));
      ball(x, y, z, base + 0.5 * Math.sin(s * 0.2));
    }
  };

  // 1. Halls.
  const halls = [];
  const THEMES = ['crystal', 'lake', 'glow', 'fossil'];
  for (let tries = 0; tries < 12000 && halls.length < 8; tries++) {
    const need = tries < 4000 ? 0.5 : tries < 8000 ? 0.2 : 0.04; // how much of the hall must be free of keep-out columns
    const x = 8 + Math.floor(rand() * (Wd - 16)), z = 8 + Math.floor(rand() * (D - 16));
    const c = x + z * Wd;
    if (keep[c] || ground[c] < 17) continue;
    if (halls.some(h => Math.hypot(h.x - x, h.z - z) < 34)) continue;
    const rx = 10 + rand() * 5, rz = 10 + rand() * 5;
    let clear = true; // the whole hall must fit: no keep-out column inside it
    for (let a = Math.floor(-rx); a <= rx && clear; a++) for (let b = Math.floor(-rz); b <= rz; b++) {
      if ((a / rx) ** 2 + (b / rz) ** 2 < need && (x + a < 1 || z + b < 1 || x + a >= Wd - 1 || z + b >= D - 1 || keep[x + a + (z + b) * Wd])) { clear = false; break; }
    }
    if (!clear) continue;
    halls.push({ x, z, rx, rz, theme: THEMES[halls.length % 4], mouth: null });
  }
  for (const h of halls) {
    for (let x = Math.floor(h.x - h.rx); x <= h.x + h.rx; x++) for (let z = Math.floor(h.z - h.rz); z <= h.z + h.rz; z++) {
      const d2 = ((x - h.x) / h.rx) ** 2 + ((z - h.z) / h.rz) ** 2;
      if (d2 >= 1 || x < 1 || z < 1 || x >= Wd || z >= D) continue;
      const top = Math.min(ground[x + z * Wd] - 3, 3 + Math.floor(9 * Math.sqrt(1 - d2)));
      for (let y = 3; y <= top; y++) carve(x, y, z);
    }
  }
  // 2. Hall tunnels, nearest neighbour first.
  if (halls.length > 1) {
    const left = halls.slice(1);
    let cur = halls[0];
    while (left.length) {
      let bi = 0;
      for (let i = 1; i < left.length; i++) if (Math.hypot(left[i].x - cur.x, left[i].z - cur.z) < Math.hypot(left[bi].x - cur.x, left[bi].z - cur.z)) bi = i;
      const next = left.splice(bi, 1)[0];
      tunnel(cur.x + 0.5, 5, cur.z + 0.5, next.x + 0.5, next.z + 0.5, 2.6, 400);
      cur = next;
    }
    // A second way in: every hall also joins its nearest other hall (the other way round).
    for (const h of halls) {
      const o = halls.filter(q => q !== h).sort((p, q) => Math.hypot(p.x - h.x, p.z - h.z) - Math.hypot(q.x - h.x, q.z - h.z))[0];
      tunnel(o.x + 0.5, 5, o.z + 0.5, h.x + 0.5, h.z + 0.5, 2.6, 400);
    }
  }
  // 3. Wide tunnels.
  for (let n = 0; n < 56; n++) {
    let col = n < 24 && halls.length ? [halls[n % halls.length].x, halls[n % halls.length].z] : null; // some leave a hall
    for (let i = 0; i < 400 && !col; i++) {
      const x = 5 + Math.floor(rand() * (Wd - 10)), z = 5 + Math.floor(rand() * (D - 10));
      if (!keep[x + z * Wd] && ground[x + z * Wd] >= WATER_LEVEL + 5) col = [x, z];
    }
    if (!col) continue;
    const a = rand() * Math.PI * 2;
    tunnel(col[0] + 0.5, 5, col[1] + 0.5, col[0] + 0.5 + Math.cos(a) * 60, col[1] + 0.5 + Math.sin(a) * 60, 2.3, 120);
  }

  // 5. Decoration of the new cells (own hash seeds, v1 is never re-decided).
  const cellOf = i => [i % Wd, Math.floor(i / (Wd * D)), Math.floor(i / Wd) % D];
  const at = (x, y, z) => (x < 0 || z < 0 || y < 0 || x >= Wd || z >= D || y >= WORLD_H ? B.STONE : data[idx(x, y, z)]);
  const solidRock = id => id === B.STONE || id === B.DIRT || id === B.COAL_ORE || id === B.GOLD_ORE;
  const air = carved.filter(i => data[i] === B.AIR);
  const crystals = [];
  let glow = 0;
  for (const i of air) {
    const [x, y, z] = cellOf(i);
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (ny < 1 || at(nx, ny, nz) !== B.STONE) continue;
      const r = hash3(nx, ny, nz, seed + 605);
      if (r < 0.012) data[idx(nx, ny, nz)] = B.GOLD_ORE;
      else if (r < 0.06) data[idx(nx, ny, nz)] = B.COAL_ORE;
    }
  }
  for (const i of air) {
    const [x, y, z] = cellOf(i);
    if (data[i] !== B.AIR) continue;
    const g = ground[x + z * Wd];
    const above = at(x, y + 1, z), below = at(x, y - 1, z);
    if (isSolid(above) && g - y >= 4 && hash3(x, y, z, seed + 606) < 0.012) {
      data[idx(x, y + 1, z)] = B.CRYSTAL; crystals.push([x, y + 1, z]); glow++;
      continue;
    }
    if (isSolid(below) && solidRock(below) && g - y >= 4) {
      const r = hash3(x, y, z, seed + 607);
      if (r < 0.006) {
        const h = 1 + (hash3(x, y, z, seed + 608) < 0.5 ? 1 : 0);
        for (let k = 0; k < h; k++) if (at(x, y + k, z) === B.AIR) { data[idx(x, y + k, z)] = B.CRYSTAL; glow++; }
        crystals.push([x, y, z]);
      } else if (r < 0.006 + 0.012) { data[i] = B.GLOWCAP; glow++; }
    }
  }

  // 4. Themes.
  const bone = WOOL.bone;
  const setAir = (x, y, z, id) => { if (x >= 0 && z >= 0 && x < Wd && z < D && at(x, y, z) === B.AIR) data[idx(x, y, z)] = id; };
  for (const h of halls) {
    const inside = (x, z, f) => ((x - h.x) / h.rx) ** 2 + ((z - h.z) / h.rz) ** 2 < f;
    if (h.theme === 'lake') {
      for (let x = Math.floor(h.x - h.rx); x <= h.x + h.rx; x++) for (let z = Math.floor(h.z - h.rz); z <= h.z + h.rz; z++) {
        if (!inside(x, z, 0.36) || keep[x + z * Wd] || at(x, 3, z) !== B.AIR) continue;
        for (let y = 1; y <= 2; y++) if (isSolid(at(x, y, z))) data[idx(x, y, z)] = B.WATER;
      }
    } else if (h.theme === 'crystal') {
      for (let x = Math.floor(h.x - h.rx); x <= h.x + h.rx; x++) for (let z = Math.floor(h.z - h.rz); z <= h.z + h.rz; z++) {
        if (!inside(x, z, 1)) continue;
        for (let y = 4; y < 14; y++) {
          if (at(x, y, z) === B.AIR && isSolid(at(x, y + 1, z)) && hash3(x, y, z, seed + 609) < 0.06) { data[idx(x, y + 1, z)] = B.CRYSTAL; crystals.push([x, y + 1, z]); glow++; break; }
        }
      }
      for (let n = 0, k = 3 + Math.floor(rand() * 3); n < k; n++) {
        const a = rand() * Math.PI * 2, r = rand() * 0.6;
        const x = Math.floor(h.x + Math.cos(a) * r * h.rx), z = Math.floor(h.z + Math.sin(a) * r * h.rz);
        const hh = 2 + Math.floor(rand() * 2);
        if (at(x, 2, z) !== B.STONE) continue;
        for (let y = 3; y < 3 + hh; y++) setAir(x, y, z, B.CRYSTAL);
        crystals.push([x, 3, z]); glow++;
      }
    } else if (h.theme === 'glow') {
      for (let x = Math.floor(h.x - h.rx); x <= h.x + h.rx; x++) for (let z = Math.floor(h.z - h.rz); z <= h.z + h.rz; z++) {
        if (!inside(x, z, 1) || at(x, 2, z) !== B.STONE || at(x, 3, z) !== B.AIR) continue;
        if (hash3(x, 3, z, seed + 610) < 0.12) { data[idx(x, 3, z)] = B.GLOWCAP; glow++; }
      }
    } else {
      // A friendly ribcage (5 arches) and a skull with two dark eyes.
      for (let k = -2; k <= 2; k++) {
        const z = h.z + k * 3;
        for (let a = 0; a <= 20; a++) {
          const t = a / 20 * Math.PI;
          setAir(Math.round(h.x + Math.cos(t) * 6.5), 3 + Math.round(Math.sin(t) * 5), z, bone);
        }
      }
      for (let z = h.z - 6; z <= h.z + 6; z++) setAir(h.x, 8, z, bone);
      for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy < 3; dy++) for (let dz = 0; dz < 3; dz++) {
        const eye = dz === 0 && dy === 1 && dx !== 0;
        setAir(h.x + dx, 3 + dy, h.z + 8 + dz, eye ? B.COAL_ORE : bone);
      }
    }
  }

  // Lamp posts in every hall, so a child can find the way across it.
  for (const h of halls) {
    const ph = rand() * Math.PI;
    for (let k = 0; k < 8; k++) {
      const a = ph + k * Math.PI / 4;
      const f = k % 2 ? 0.7 : 0.4;
      const x = Math.floor(h.x + Math.cos(a) * h.rx * f), z = Math.floor(h.z + Math.sin(a) * h.rz * f);
      if (at(x, 2, z) === B.STONE && at(x, 3, z) === B.AIR && at(x, 4, z) === B.AIR && at(x, 5, z) === B.AIR) {
        data[idx(x, 3, z)] = B.STONE_BRICKS; data[idx(x, 4, z)] = B.LAMP; glow++;
      }
    }
  }

  // 6. Stairways to the surface (up to 6 halls), then 7. lamp posts at the old holes.
  const noChest = (x, y, z) => { const id = data[idx(x, y, z)]; return id === B.CHEST || id === B.CHEST_OPEN; };
  const entrances = [], opened = new Set(), marks = new Set();
  let stairCount = 0;
  for (const h of halls) {
    if (stairCount >= 6) break;
    const d0 = dir => Math.floor((dir[0] ? h.rx : h.rz) * 0.45);
    const plan = planStairs(ground, keep, h.x, h.z, 2, d0, 2, DIRS, noChest, [Wd, D]) || planStairs(ground, keep, h.x, h.z, 2, d0, 1, DIRS, noChest, [Wd, D]);
    if (!plan) continue;
    const r = buildStairs(world, plan, h.x, h.z);
    h.mouth = r.mouth; h.dir = plan.dir;
    entrances.push([r.mouth[0], r.mouth[2]]);
    for (const c of r.opened) opened.add(c);
    for (const c of r.marks) marks.add(c);
    stairCount++;
  }
  for (const [ex, ez] of cv.entrances) {
    let best = null;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const x = ex + dx, z = ez + dz, c = x + z * Wd;
      if (x < 2 || z < 2 || x >= Wd - 2 || z >= D - 2 || keep[c] || cv.opened.has(c) || opened.has(c)) continue;
      const s = world.surface(x, z);
      if (s.y <= WATER_LEVEL || s.id === B.WATER || s.id === B.AIR) continue;
      if (!best || s.y > best.y) best = { x, z, y: s.y };
    }
    if (!best) continue;
    world.set(best.x, best.y + 1, best.z, B.COBBLE, false);
    world.set(best.x, best.y + 2, best.z, B.COBBLE, false);
    world.set(best.x, best.y + 3, best.z, B.LAMP, false);
    marks.add(best.x + best.z * Wd);
  }

  // 8. Floors and chests.
  const standing = (x, y, z) => data[idx(x, y, z)] === B.AIR && ground[x + z * Wd] - y >= 5 && y >= 3
    && isSolid(at(x, y - 1, z)) && at(x, y - 1, z) !== B.CRYSTAL && at(x, y - 1, z) !== B.GLOWCAP
    && at(x, y + 1, z) === B.AIR && at(x, y + 2, z) === B.AIR;
  const floorsAll = [];
  for (const i of air) { const [x, y, z] = cellOf(i); if (standing(x, y, z)) floorsAll.push([x, y, z]); }
  for (let i = floorsAll.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [floorsAll[i], floorsAll[j]] = [floorsAll[j], floorsAll[i]]; }
  const chests = [];
  const allChests = () => [...cv.chests, ...chests];
  for (const [x, y, z] of floorsAll) {
    if (chests.length >= 6) break;
    if (ground[x + z * Wd] - y < 6) continue;
    if (allChests().some(([cx, , cz]) => Math.hypot(cx - x, cz - z) < 24)) continue;
    let cap = null;
    for (const [dx, dz] of DIRS) {
      if (at(x + dx, y, z + dz) === B.AIR && isSolid(at(x + dx, y - 1, z + dz))) { cap = [x + dx, y, z + dz]; break; }
    }
    if (!cap) continue;
    data[idx(x, y, z)] = B.CHEST;
    data[idx(cap[0], cap[1], cap[2])] = B.GLOWCAP;
    glow++;
    chests.push([x, y, z]);
  }
  const newFloors = floorsAll.filter(([x, y, z]) => data[idx(x, y, z)] === B.AIR && at(x, y + 1, z) === B.AIR).slice(0, 200);
  const oldFloors = cv.floors.filter(([x, y, z]) => standing(x, y, z));

  cv.air += air.filter(i => data[i] === B.AIR).length;
  cv.entrances.push(...entrances);
  for (const c of opened) cv.opened.add(c);
  cv.floors = [...newFloors, ...oldFloors].slice(0, 300);
  cv.crystals.push(...crystals);
  cv.chests.push(...chests);
  cv.glow += glow;
  cv.halls = halls;
  cv.marks = marks;
  return cv;
}

/* ------------------------------ the light shader ------------------------------ */

// Shared by the solid and water materials: uLit is the time-of-day brightness, uLantern the
// strength of the light that follows the player underground, uPlayer where it is.
export const caveLight = {
  uLit: { value: 1 },
  uLantern: { value: 0 },
  uPlayer: { value: new THREE.Vector3() },
};

// T38d: the Swirl's zone tint. Blocks whose tile lies in one of two tile ranges (uTintU: Swirl Stone top/side, Swirl Paint/Cloud) take the
// colour of the zone you are in, mixed from the zone weights (the same smoothstep rings as swirlland.js zoneWeights; swirlsky.js fills
// the uniforms from ZONES), darker underneath and paler on top, with a slow wet-paint shimmer. uTintOn is 0 everywhere but the Swirl,
// where the output is exactly what it was before. Tint by tile range: no mesh change, player-built blocks keep their own colours.
export const swirlTint = {
  uTintOn: { value: 0 },
  uTintU: { value: new THREE.Vector4(-1, -1, -1, -1) }, // tile ranges (tile numbers): [a0, a1) and [b0, b1)
  uAtlas: { value: new THREE.Vector2(ATLAS_COLS, ATLAS_ROWS) }, // wave 14.5: the atlas grid, to get the tile number back from uv
  uTime: { value: 0 },
  uHaze: { value: 0.12 },
  uZone: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, // x, z, radius
  uLo: { value: Array.from({ length: 5 }, () => new THREE.Color(1, 1, 1)) },
  uHi: { value: Array.from({ length: 5 }, () => new THREE.Color(1, 1, 1)) },
  uSea: { value: Array.from({ length: 5 }, () => new THREE.Color(1, 1, 1)) },
};

// Vertex colours are packed as r = sky light x shade, g = block light x shade, b = shade.
export function patchMaterial(mat) {
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, caveLight, swirlTint);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vCavePos;
varying vec3 vTint;
uniform float uTintOn;
uniform vec4 uTintU;
uniform vec2 uAtlas;
uniform float uTime;
uniform float uHaze;
uniform vec4 uZone[4];
uniform vec3 uLo[5];
uniform vec3 uHi[5];
uniform vec3 uSea[5];`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vCavePos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTint = vec3(1.0);
float tileN = floor(uv.x * uAtlas.x) + floor((1.0 - uv.y) * uAtlas.y) * uAtlas.x;
if (uTintOn > 0.5 && ((tileN >= uTintU.x && tileN < uTintU.y) || (tileN >= uTintU.z && tileN < uTintU.w))) {
  vec3 wp = vCavePos;
  vec4 t = clamp(vec4(1.0) - vec4(distance(wp.xz, uZone[0].xy) / uZone[0].z, distance(wp.xz, uZone[1].xy) / uZone[1].z, distance(wp.xz, uZone[2].xy) / uZone[2].z, distance(wp.xz, uZone[3].xy) / uZone[3].z), 0.0, 1.0);
  vec4 w = t * t * (3.0 - 2.0 * t);
  float inv = 1.0 / (w.x + w.y + w.z + w.w + uHaze);
  vec3 c;
  if (wp.y < 1.5) c = (uSea[0] * w.x + uSea[1] * w.y + uSea[2] * w.z + uSea[3] * w.w + uSea[4] * uHaze) * inv;
  else {
    vec3 lo = (uLo[0] * w.x + uLo[1] * w.y + uLo[2] * w.z + uLo[3] * w.w + uLo[4] * uHaze) * inv;
    vec3 hi = (uHi[0] * w.x + uHi[1] * w.y + uHi[2] * w.z + uHi[3] * w.w + uHi[4] * uHaze) * inv;
    c = mix(lo, hi, clamp((wp.y - 4.0) / 26.0 + (color.b > 0.9 ? 0.4 : 0.0), 0.0, 1.0)); // tops are paler, sides and undersides deeper
  }
  vTint = c * (0.93 + 0.07 * sin(wp.x * 0.23 + wp.z * 0.17 + wp.y * 0.3 + uTime * 0.7));
  vTint *= min(inversesqrt(max(color.r, 0.25)), 1.9); // pastel: take back some of the face and overhang shading
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCavePos;\nvarying vec3 vTint;\nuniform float uLit;\nuniform float uLantern;\nuniform vec3 uPlayer;')
      .replace('#include <color_fragment>', `
        float lan = uLantern * clamp(1.0 - distance(vCavePos, uPlayer) / 8.0, 0.0, 1.0);
        diffuseColor.rgb *= max(vColor.r * uLit, max(vColor.g, vColor.b * lan));
        diffuseColor.rgb *= vTint;`);
  };
  mat.customProgramCacheKey = () => 'cave-light-3';
  mat.needsUpdate = true;
}
