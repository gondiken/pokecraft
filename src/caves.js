// Caves: tunnels carved under the hills from the world seed, glowing decorations, treasure
// chests, and the light shader that makes everything under cover dark.
import * as THREE from 'three';
import { B, isSolid, mulberry32 } from './blocks.js';
import { WORLD_W, WORLD_D, WORLD_H, WATER_LEVEL } from './world.js';
import { ORIGINAL_GYMS } from './gyms.js';

function hash3(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 1274126177) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// Columns where no cave may ever be carved: map edges, shores, gyms, the tower and the start.
function keepOutMask(world) {
  const Wd = WORLD_W, D = WORLD_D;
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
  const Wd = WORLD_W, D = WORLD_D;
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

/* ------------------------------ the light shader ------------------------------ */

// Shared by the solid and water materials: uLit is the time-of-day brightness, uLantern the
// strength of the light that follows the player underground, uPlayer where it is.
export const caveLight = {
  uLit: { value: 1 },
  uLantern: { value: 0 },
  uPlayer: { value: new THREE.Vector3() },
};

// Vertex colours are packed as r = sky light x shade, g = block light x shade, b = shade.
export function patchMaterial(mat) {
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, caveLight);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCavePos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCavePos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCavePos;\nuniform float uLit;\nuniform float uLantern;\nuniform vec3 uPlayer;')
      .replace('#include <color_fragment>', `
        float lan = uLantern * clamp(1.0 - distance(vCavePos, uPlayer) / 8.0, 0.0, 1.0);
        diffuseColor.rgb *= max(vColor.r * uLit, max(vColor.g, vColor.b * lan));`);
  };
  mat.customProgramCacheKey = () => 'cave-light';
  mat.needsUpdate = true;
}
