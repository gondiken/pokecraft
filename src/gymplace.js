// Gym and tower placement: where they go (terrain only, so old worlds never change) and how they
// are built. Moved out of world.js without changes; installGymPlacement(World) adds the methods
// to World.prototype.
import { B, WOOL, isSolid } from './blocks.js';
import { GYMS, TOWER, ORIGINAL_GYMS, LEGACY_EXTRA_GYMS, LEGACY_CAVE_GYMS, EXTRA_GYMS_END } from './gyms.js';
import { planStairs, buildStairs, legacyOnly } from './caves.js';
import { buildClockTower } from './clocktower.js';
import { buildHiddenHill } from './hiddenhill.js';
import { buildFirewallMaze } from './firewall.js';
import { OLD_W, OLD_D, MID_X, MID_Z, WORLD_H, WATER_LEVEL, hash2, groundOf, PLANTS } from './world.js';

// Builders of the slot gyms (T19), by `def.build`: (world, def, slot) => gym object. Each writes only inside slot.box and
// returns { def, x, z, y, front, leaderPos, trainerPos, trainerPositions, protect, area, ... }.
const SLOT_BUILDERS = { clockTower: buildClockTower, hiddenHill: buildHiddenHill, firewallMaze: buildFirewallMaze };

// Slot boxes of the new land (T17): the 5 places where gyms 23+ go. Never change these numbers.
export const SLOT_R = 24, SLOT_GAP = 56;

// A protected box (inclusive): nothing in it can be broken or built (World.editAllowed).
const pbox = (x, z, r, y0, y1) => ({ x0: x - r, x1: x + r, y0, y1, z0: z - r, z1: z + r });

class GymPlacement {
  // Gyms are scattered around the map, well apart from each other. The closest one to the
  // middle (where you start) gets the first gym, the next closest the second, and so on.
  gymSpots(count) {
    const cx = MID_X, cz = MID_Z; // pinned: the old map (T17)
    const margin = 16;
    for (let minGap = 36; minGap > 14; minGap -= 3) {
      const spots = [];
      for (let i = 0; i < 4000 && spots.length < count; i++) {
        const x = Math.floor(margin + hash2(i, 11, this.seed) * (OLD_W - margin * 2));
        const z = Math.floor(margin + hash2(i, 23, this.seed) * (OLD_D - margin * 2));
        if (Math.hypot(x - cx, z - cz) < 18) continue;
        if (spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < minGap)) continue;
        spots.push([x, z]);
      }
      if (spots.length === count) return spots.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
    }
    throw new Error('No room for the gyms');
  }

  placeGyms() {
    const spots = this.gymSpots(ORIGINAL_GYMS);
    this.gyms = GYMS.slice(0, ORIGINAL_GYMS).map((def, i) => this.placeGym(def, spots[i][0], spots[i][1]));
    for (const g of this.gyms) this.markLit(g.x, g.z);
  }

  // Is the spot (and the four corners 6 blocks around it) above the water, by terrain alone?
  dryAt(x, z) {
    return [[0, 0], [6, 6], [-6, 6], [6, -6], [-6, -6]].every(([dx, dz]) => this.terrainHeight(x + dx, z + dz) > WATER_LEVEL);
  }

  // Gyms 17+ go to the dry spots furthest from every other gym and the tower (terrain only, so the
  // spots are the same with or without caves). Never changes where gyms 1-16 or the tower are.
  extraGymSpots() {
    if (this.extraSpots) return this.extraSpots;
    const cx = MID_X, cz = MID_Z;
    const taken = this.gymSpots(ORIGINAL_GYMS).map(([x, z]) => ({ x, z }));
    const [tx, tz] = this.towerSpot(taken);
    const dry = (x, z) => this.dryAt(x, z);
    const spots = [];
    // Only the two legacy extra gyms (17-18) live here; gyms 19+ use newGymSpots().
    for (let k = ORIGINAL_GYMS; k < EXTRA_GYMS_END; k++) {
      for (const needDry of [true, false]) {
        let best = null, bestScore = -1;
        for (let x = 16; x < OLD_W - 16; x += 2) {
          for (let z = 16; z < OLD_D - 16; z += 2) {
            if (Math.hypot(x - cx, z - cz) < 40 || (needDry && !dry(x, z))) continue;
            let score = Math.max(Math.abs(x - tx), Math.abs(z - tz));
            for (const t of taken) score = Math.min(score, Math.hypot(x - t.x, z - t.z));
            for (const [sx, sz] of spots) score = Math.min(score, Math.hypot(x - sx, z - sz));
            if (score > bestScore) { bestScore = score; best = [x, z]; }
          }
        }
        if (best) { spots.push(best); break; }
      }
    }
    return (this.extraSpots = spots);
  }

  // Where gyms that live in caves go (def.place === 'cave'), one entry per such legacy def (the Fossil Gym) in
  // GYMS order, or null if the map has no room (that gym is then built on its reserved surface spot). Terrain
  // only, so the same with or without caves. NEVER change the mask, the order or fy: it would move the gym
  // in existing worlds (see plans/T8.md section 4). Cave gyms after index EXTRA_GYMS_END use newGymSpots().
  caveGymSpots() {
    if (this.caveSpots) return this.caveSpots;
    const { A, M } = this.caveMasks();
    const out = [];
    for (const def of GYMS.slice(0, EXTRA_GYMS_END).filter(d => d.place === 'cave')) {
      const found = this.caveGymSpot(def, A, M);
      if (found) this.markBox(M, found.x, found.z, 26);
      out.push(found);
    }
    return (this.caveSpots = out);
  }

  markBox(arr, x, z, r) {
    for (let a = Math.max(0, x - r); a <= Math.min(this.W - 1, x + r); a++) {
      for (let b = Math.max(0, z - r); b <= Math.min(this.D - 1, z + r); b++) arr[a + b * this.W] = 1;
    }
  }

  // The masks cave gyms must stay out of. A: the sea, shores and the map edges. M: gyms 1-16, the tower, the
  // legacy extra spots, the middle and the start.
  caveMasks() {
    legacyOnly(this);
    const Wd = this.W, D = this.D, ground = this.ground;
    const A = new Uint8Array(Wd * D), M = new Uint8Array(Wd * D);
    const mark = (arr, x0, z0, x1, z1) => {
      for (let x = Math.max(0, x0); x <= Math.min(Wd - 1, x1); x++) for (let z = Math.max(0, z0); z <= Math.min(D - 1, z1); z++) arr[x + z * Wd] = 1;
    };
    for (let x = 0; x < Wd; x++) for (let z = 0; z < D; z++) {
      if (x < 6 || z < 6 || x >= Wd - 6 || z >= D - 6) A[x + z * Wd] = 1;
      else if (ground[x + z * Wd] <= WATER_LEVEL + 2) mark(A, x - 2, z - 2, x + 2, z + 2);
    }
    const spots = this.gymSpots(ORIGINAL_GYMS);
    for (const [x, z] of spots) mark(M, x - 14, z - 14, x + 14, z + 14);
    const [tx, tz] = this.towerSpot(spots.map(([x, z]) => ({ x, z })));
    mark(M, tx - 14, tz - 14, tx + 14, tz + 14);
    const extra = this.extraGymSpots();
    for (let i = 0; i < LEGACY_EXTRA_GYMS && i < extra.length; i++) {
      if (GYMS[ORIGINAL_GYMS + i]?.place === 'cave') continue; // the reserved spot is free
      mark(M, extra[i][0] - 14, extra[i][1] - 14, extra[i][0] + 14, extra[i][1] + 14);
    }
    const cx = Wd >> 1, cz = D >> 1;
    mark(M, cx - 14, cz - 14, cx + 14, cz + 14);
    // Where you start: the first grass going outwards from the middle (from the terrain alone).
    start: for (let r = 0; r < 60; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = cx + dx, z = cz + dz;
          if (groundOf(this.biome(x, z), ground[x + z * Wd])[0] === B.GRASS && ground[x + z * Wd] > WATER_LEVEL) { mark(M, x - 12, z - 12, x + 12, z + 12); break start; }
        }
      }
    }
    return { A, M };
  }

  // The cave spot for one def against the masks (see caveGymSpots). Returns null if there is no room.
  caveGymSpot(def, A, M) {
    const Wd = this.W, D = this.D, ground = this.ground;
    const cx = Wd >> 1, cz = D >> 1;
    const prefix = arr => {
      const P = new Int32Array((Wd + 1) * (D + 1));
      for (let z = 0; z < D; z++) for (let x = 0; x < Wd; x++) P[(x + 1) + (z + 1) * (Wd + 1)] = arr[x + z * Wd] + P[x + (z + 1) * (Wd + 1)] + P[(x + 1) + z * (Wd + 1)] - P[x + z * (Wd + 1)];
      return P;
    };
    const boxSum = (P, x, z, R) => {
      const x0 = Math.max(0, x - R), z0 = Math.max(0, z - R), x1 = Math.min(Wd, x + R + 1), z1 = Math.min(D, z + R + 1), W1 = Wd + 1;
      return P[x1 + z1 * W1] - P[x0 + z1 * W1] - P[x1 + z0 * W1] + P[x0 + z0 * W1];
    };
    const PA = prefix(A), PM = prefix(M);
    const union = new Uint8Array(Wd * D);
    for (let i = 0; i < union.length; i++) union[i] = A[i] | M[i];
    const cands = [];
    for (let x = 20; x <= Wd - 20; x += 2) for (let z = 20; z <= D - 20; z += 2) {
      if (Math.hypot(x - cx, z - cz) < 28) continue;
      if (boxSum(PA, x, z, 9) || boxSum(PM, x, z, 12)) continue;
      let m = 99;
      for (let a = -8; a <= 8; a++) for (let b = -8; b <= 8; b++) m = Math.min(m, ground[(x + a) + (z + b) * Wd]);
      cands.push({ x, z, m: Math.min(m, 18) });
    }
    let found = null;
    for (const rise of [2, 1]) {
      const tiers = [...new Set(cands.map(c => c.m))].sort((a, b) => b - a);
      for (const tier of tiers) {
        let best = null;
        for (const c of cands) {
          if (c.m !== tier) continue;
          const plan = planStairs(ground, union, c.x, c.z, 2, 9, rise, undefined, null, [Wd, D]);
          if (!plan) continue;
          if (!best || plan.len < best.plan.len || (plan.len === best.plan.len && (c.x < best.c.x || (c.x === best.c.x && c.z < best.c.z)))) best = { c, plan };
        }
        if (best) { found = best; break; }
      }
      if (found) break;
    }
    if (!found) return null;
    const { c, plan } = found;
    return { def, x: c.x, z: c.z, fy: 2, front: plan.dir, rise: plan.rise, len: plan.len, plan };
  }

  // The cells along a cave gym's stairway (for keeping other things away from it).
  stairCells(spot) {
    const { plan, x, z } = spot, out = [];
    for (let d = plan.d0; d <= plan.end; d++) out.push([x + plan.dir[0] * d, z + plan.dir[1] * d]);
    return out;
  }

  // Where gyms 19+ (T10) go, one entry per def in GYMS order: { def, place: 'surface' | 'cave' | 'sky', x, z, ... }.
  // Terrain only (the same with or without caves); every spot depends only on gyms 1-18, the tower and the
  // new spots before it. Never change the rules: it would move the new gyms in existing worlds.
  newGymSpots() {
    if (this.newSpots) return this.newSpots;
    const pts = this.gymSpots(ORIGINAL_GYMS).map(([x, z]) => ({ x, z }));
    const tower = this.towerSpot(pts.slice());
    for (const [x, z] of this.extraGymSpots()) pts.push({ x, z }); // the reserved bone spot and the Saucer Gym
    const caveItems = []; // cave gyms so far: { x, z, cells } (cells = the stairway)
    for (const sp of this.caveGymSpots()) if (sp) caveItems.push({ x: sp.x, z: sp.z, cells: this.stairCells(sp) });
    // Cave gyms first (they need the most room; the others keep away from them), then the rest in GYMS order.
    const defs = GYMS.slice(EXTRA_GYMS_END).filter(d => d.slot == null), found = new Map(); // slot gyms (T17/T19) live in the new land
    let masks = null;
    for (const def of defs) {
      if (def.place !== 'cave') continue;
      if (!masks) masks = this.caveMasks();
      const M = masks.M.slice();
      for (const it of caveItems) { this.markBox(M, it.x, it.z, 26); for (const [cx, cz] of it.cells) this.markBox(M, cx, cz, 3); }
      const spot = this.caveGymSpot(def, masks.A, M);
      if (!spot) continue;
      found.set(def, { ...spot, place: 'cave', fresh: true });
      caveItems.push({ x: spot.x, z: spot.z, cells: this.stairCells(spot) });
    }
    const out = [];
    for (const def of defs) {
      const spot = found.get(def) || { ...this.pickSpot(def, pts, tower, caveItems), def };
      pts.push({ x: spot.x, z: spot.z });
      out.push(spot);
    }
    return (this.newSpots = out);
  }

  // A dry spot far from everything (the highest score = the distance to the nearest gym or the tower), with
  // the def's preferred biomes; relaxed step by step if there is none. Sky gyms also need low ground around.
  pickSpot(def, pts, tower, caveItems) {
    legacyOnly(this);
    const Wd = this.W, D = this.D, ground = this.ground, cx = Wd / 2, cz = D / 2;
    const sky = def.place === 'sky';
    const dry = (x, z) => [[0, 0], [6, 6], [-6, 6], [6, -6], [-6, -6]].every(([dx, dz]) => ground[(x + dx) + (z + dz) * Wd] > WATER_LEVEL);
    const maxG = (x, z) => {
      let m = 0;
      for (let a = -14; a <= 14; a++) for (let b = -14; b <= 14; b++) m = Math.max(m, ground[(x + a) + (z + b) * Wd]);
      return m;
    };
    // How much of the land around (x, z) (25 points within 12 blocks) has one of the def's biomes, 0 if the centre has not.
    const biomes = def.spot?.biomes;
    const share = (x, z) => {
      if (!biomes) return 1;
      if (!biomes.includes(this.biome(x, z))) return 0;
      let n = 0;
      for (let a = -12; a <= 12; a += 6) for (let b = -12; b <= 12; b += 6) if (biomes.includes(this.biome(x + a, z + b))) n++;
      return n / 25;
    };
    // From strict to relaxed: the first stage that finds a spot wins. `biome` = the least share of the right biomes
    // around (0 = any); `hill`: the def's minGround counts; `min` = the least distance to any other gym (the tower counts as Chebyshev).
    const stages = sky
      ? [{ dry: true, cap: 22, min: 30 }, { dry: true, cap: 22, min: 0 }, { dry: false, cap: 22, min: 0 }, { dry: false, cap: 99, min: 0 }]
      : [{ biome: 0.8, hill: true, dry: true, min: 30 }, { biome: 0.8, hill: true, dry: true, min: 26 }, { biome: 0.6, hill: true, dry: true, min: 26 },
        { biome: 0.6, dry: true, min: 26 }, { biome: 0.01, hill: true, dry: true, min: 26 }, { biome: 0, dry: true, min: 26 }, { biome: 0, dry: true, min: 0 },
        { biome: 0, dry: false, min: 0 }];
    for (const st of stages) {
      let best = null, bestScore = st.min - 0.001;
      for (let x = 20; x <= Wd - 20; x += 2) {
        for (let z = 20; z <= D - 20; z += 2) {
          if (Math.hypot(x - cx, z - cz) < 40 || (st.dry && !dry(x, z))) continue;
          let ok = true;
          for (const c of caveItems) {
            if (Math.max(Math.abs(x - c.x), Math.abs(z - c.z)) < (sky ? 24 : 32)) { ok = false; break; }
            if (c.cells.some(([sx, sz]) => Math.max(Math.abs(x - sx), Math.abs(z - sz)) < 18)) { ok = false; break; }
          }
          if (!ok) continue;
          let score = Math.max(Math.abs(x - tower[0]), Math.abs(z - tower[1]));
          for (const t of pts) score = Math.min(score, Math.hypot(x - t.x, z - t.z));
          if (score <= bestScore) continue;
          if (!sky && st.biome && def.spot) {
            if (st.hill && def.spot.minGround && ground[x + z * Wd] < def.spot.minGround) continue;
            if (share(x, z) < st.biome) continue;
          }
          if (sky && maxG(x, z) > st.cap) continue;
          best = [x, z]; bestScore = score;
        }
      }
      if (best) {
        const [x, z] = best;
        return sky ? { place: 'sky', x, z, fy: Math.min(36, maxG(x, z) + 12) } : { place: 'surface', x, z };
      }
    }
    throw new Error('No room for the new gyms');
  }

  // The new gyms (19+): surface buildings, the cave gym (if there was room for its cavern) and the cloud island.
  placeNewGyms(caveGyms = true) {
    const all = (x, z, r) => ({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, y0: 0, y1: WORLD_H - 1 });
    for (const spot of this.newGymSpots()) {
      const { def, x, z } = spot;
      let g;
      if (spot.place === 'cave') {
        if (!caveGyms) continue;
        g = this.placeGym(def, x, z, { cave: spot });
        this.newGymBoxes.push(all(x, z, 16));
        const cells = this.stairCells(spot);
        const xs = cells.map(c => c[0]), zs = cells.map(c => c[1]);
        this.newGymBoxes.push({ x0: Math.min(...xs) - 6, x1: Math.max(...xs) + 6, z0: Math.min(...zs) - 6, z1: Math.max(...zs) + 6, y0: 0, y1: WORLD_H - 1 });
      } else if (spot.place === 'sky') {
        g = this.placeSkyGym(spot);
        this.newGymBoxes.push(all(x, z, 16));
        this.markLit(x, z);
      } else {
        g = this.placeGym(def, x, z);
        this.newGymBoxes.push(all(x, z, 21)); // the cave fill (18) plus room for trees growing where a hole was filled
        this.markLit(g.x, g.z);
      }
      this.gyms.push(g);
    }
  }

  // Carves the cavern, the stairway with its arch, the lamps and the pillars for every cave gym
  // (before the plants and the buildings; also when there are no caves).
  carveGymRooms(solid = null, newSpots = []) {
    const carveOne = (spot, fill) => {
      // The first cave gym's spot was kept free of caves; later ones clear the caves around them.
      if (solid && this.caves && fill) {
        if (spot.fresh) this.fillNewGymCaves(solid, spot.x, spot.z, 10); // T10: only around the building, so the cavern may open into the caves
        else {
          this.fillCavesNear(solid, spot.x, spot.z, 15);
          for (const h of this.caves.halls || []) if (h.mouth && Math.max(Math.abs(h.mouth[0] - spot.x), Math.abs(h.mouth[2] - spot.z)) <= 15) h.mouth = null;
        }
      }
      this.carveGymRoom(spot);
    };
    this.caveGymSpots().forEach((spot, i) => { if (spot) carveOne(spot, i >= LEGACY_CAVE_GYMS); });
    for (const spot of newSpots) if (spot.place === 'cave') carveOne(spot, true);
  }

  // Undoes the caves within R blocks of a new (T10) gym and forgets entrances, halls' mouths and
  // markers that were in the way. Everything it touches is inside the gym's newGymBoxes.
  fillNewGymCaves(solid, x0, z0, R) {
    const c = this.caves;
    if (!c) return;
    // A hall whose stairway runs through the box loses its mouth (the stairway would end in rock).
    const near = (x, z) => Math.max(Math.abs(x - x0), Math.abs(z - z0)) <= R + 1;
    for (const h of c.halls || []) {
      if (!h.mouth) continue;
      let hit = false;
      const len = Math.max(Math.abs(h.mouth[0] - h.x), Math.abs(h.mouth[2] - h.z));
      if (h.dir) for (let d = 0; d <= len && !hit; d++) hit = near(h.x + h.dir[0] * d, h.z + h.dir[1] * d);
      else hit = near(h.mouth[0], h.mouth[2]);
      if (hit) { c.entrances = c.entrances.filter(([ex, ez]) => ex !== h.mouth[0] || ez !== h.mouth[2]); h.mouth = null; }
    }
    this.fillCavesNear(solid, x0, z0, R);
    if (c.marks) for (const m of [...c.marks]) if (near(m % this.W, Math.floor(m / this.W))) c.marks.delete(m);
  }

  carveGymRoom(spot) {
    const Wd = this.W;
    const { x: x0, z: z0, fy, front, plan, def } = spot;
    const RC = 13;
    for (let x = x0 - RC; x <= x0 + RC; x++) for (let z = z0 - RC; z <= z0 + RC; z++) {
      const d2 = ((x - x0) / RC) ** 2 + ((z - z0) / RC) ** 2;
      if (d2 >= 1) continue;
      const g = this.ground[x + z * Wd];
      const inBox = Math.abs(x - x0) <= 8 && Math.abs(z - z0) <= 8;
      let top = Math.min(g - 3, 2 + 4 + Math.floor(8 * Math.sqrt(1 - d2)));
      if (inBox) top = Math.min(g - 3, Math.max(top, 10));
      this.set(x, fy, z, B.STONE, false);
      for (let y = fy + 1; y <= top; y++) this.set(x, y, z, B.AIR, false);
    }
    const r = buildStairs(this, plan, x0, z0, { lintel: WOOL[def.type], pillarExtra: WOOL.bone });
    const bone = WOOL[def.type]; // the Fossil Gym's room is bone-white, the Goo Gym's is slimy
    spot.mouth = r.mouth;
    // Lamp ring and bone pillars.
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, dx = Math.round(Math.cos(a) * 10), dz = Math.round(Math.sin(a) * 10);
      if (front[0] * dx + front[1] * dz > 5) continue; // not in the way of the stairs
      const x = x0 + dx, z = z0 + dz;
      if (this.get(x, fy + 1, z) !== B.AIR) continue;
      this.set(x, fy + 1, z, B.STONE_BRICKS, false);
      this.set(x, fy + 2, z, B.STONE_BRICKS, false);
      this.set(x, fy + 3, z, B.LAMP, false);
    }
    for (const sx of [-10, 10]) for (const sz of [-10, 10]) {
      for (let y = fy + 1; y < WORLD_H && this.get(x0 + sx, y, z0 + sz) === B.AIR; y++) this.set(x0 + sx, y, z0 + sz, bone, false);
    }
    let glow = 0;
    for (let x = x0 - RC; x <= x0 + RC; x++) for (let z = z0 - RC; z <= z0 + RC; z++) {
      if (((x - x0) / RC) ** 2 + ((z - z0) / RC) ** 2 >= 1 || (Math.abs(x - x0) <= 9 && Math.abs(z - z0) <= 9)) continue;
      if (this.get(x, fy + 1, z) === B.AIR && this.get(x, fy, z) === B.STONE && hash2(x * 31, z, this.seed + 811) < 0.05) { this.set(x, fy + 1, z, B.GLOWCAP, false); glow++; }
    }
    if (def.cave?.theme === 'slime') glow += this.decorateSlimeRoom(spot);
    this.litRooms.push({ x0: x0 - 8, x1: x0 + 8, z0: z0 - 8, z1: z0 + 8, y0: fy, y1: fy + 8 });
    const c = this.caves;
    if (c) {
      const far = ([x, , z]) => Math.max(Math.abs(x - x0), Math.abs(z - z0)) > RC + 1;
      c.floors = c.floors.filter(far); c.crystals = c.crystals.filter(far); c.chests = c.chests.filter(far);
      c.chests = c.chests.filter(([x, y, z]) => this.get(x, y, z) === B.CHEST); // none lost under the stairs
      for (const col of r.opened) c.opened.add(col);
      c.glow += glow;
      for (const col of r.marks) c.marks?.add(col);
    }
  }

  // The gyms that live in caves (def.place === 'cave'), or on their reserved surface spot if the
  // map had no room for a cavern.
  placeCaveGyms() {
    const spots = this.caveGymSpots(), extra = this.extraGymSpots();
    let n = 0;
    GYMS.slice(0, EXTRA_GYMS_END).forEach((def, k) => {
      if (def.place !== 'cave') return;
      const spot = spots[n++];
      let g;
      if (spot) g = this.placeGym(def, spot.x, spot.z, { cave: spot });
      else {
        const e = extra[k - ORIGINAL_GYMS];
        g = this.placeGym(def, e[0], e[1]);
        this.markLit(g.x, g.z);
      }
      this.gyms.push(g);
    });
  }

  placeExtraGyms() {
    const spots = this.extraGymSpots();
    GYMS.slice(ORIGINAL_GYMS, EXTRA_GYMS_END).forEach((def, i) => {
      if (def.place === 'cave') return; // placed by placeCaveGyms
      const [x, z] = spots[i];
      let g;
      if (def.place === 'sky') {
        // The Saucer Gym (wave 6): a floating saucer island above its old spot (same x, z, so nothing else moves).
        // Everything it changes is inside its box (the old building's 18-block box), like the T10 gyms.
        g = this.placeSkyGym({ def, x, z, fy: this.saucerFloor(x, z) }, 'saucer');
        this.newGymBoxes.push({ x0: x - 18, x1: x + 18, z0: z - 18, z1: z + 18, y0: 0, y1: WORLD_H - 1 });
      } else g = this.placeGym(def, x, z);
      this.gyms.push(g);
      this.markLit(g.x, g.z);
    });
  }

  // The Saucer Gym's floor: 12 above the highest ground within 14, like the Cloud Gym, but at most 35 (so the
  // roof fits under the sky). Its spot was picked for being far away, not low, so on hilly maps (about 1 in 4)
  // the hills under it are cut down to 5 below the floor (within 13) and the plants within 16 cleared; the
  // island always floats.
  saucerFloor(x0, z0) {
    let maxG = 0;
    for (let a = -14; a <= 14; a++) for (let b = -14; b <= 14; b++) maxG = Math.max(maxG, this.ground[(x0 + a) + (z0 + b) * this.W]);
    const fy = Math.min(35, maxG + 12);
    if (maxG + 12 <= 35) return fy;
    const cap = fy - 5;
    for (let a = -16; a <= 16; a++) for (let b = -16; b <= 16; b++) {
      const x = x0 + a, z = z0 + b;
      for (let y = 1; y < WORLD_H; y++) if (PLANTS.has(this.get(x, y, z))) this.set(x, y, z, B.AIR, false);
      if (Math.abs(a) > 13 || Math.abs(b) > 13 || this.ground[x + z * this.W] <= cap) continue;
      for (let y = cap + 1; y < WORLD_H; y++) this.set(x, y, z, B.AIR, false);
      if (isSolid(this.get(x, cap, z))) this.set(x, cap, z, groundOf(this.biome(x, z), cap)[0], false);
      this.ground[x + z * this.W] = cap; // the landing pad and the darkness checks see the lower hill
    }
    return fy;
  }

  placeGym(def, x, z, opts = {}) {
    if (opts.cave) {
      const spot = opts.cave, floor = spot.fy, front = spot.front;
      this.buildGym(x, floor, z, front, def.type, { cave: true });
      const at = d => [x + front[0] * d + 0.5, z + front[1] * d + 0.5];
      const [lx, lz] = at(-4), [tx, tz] = at(1);
      return {
        def, x, z, y: floor + 1, front,
        leaderPos: [lx, floor + 1, lz], trainerPos: [tx + front[1] * 2, floor + 1, tz + front[0] * 2],
        cave: { mouth: spot.mouth, spot },
        protect: [pbox(x, z, 13, 1, floor + 13)], // the cavern and one roof layer; the stairway outside stays open
      };
    }
    const cx = MID_X, cz = MID_Z;
    // The door faces the middle of the map, along whichever axis is closer.
    const dx = cx - x, dz = cz - z;
    const front = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
    const floor = Math.max(WATER_LEVEL + 1, Math.min(this.terrainHeight(x, z), 26));
    this.buildGym(x, floor, z, front, def.type);
    const at = d => [x + front[0] * d + 0.5, z + front[1] * d + 0.5];
    const [lx, lz] = at(-4), [tx, tz] = at(1);
    return {
      def, x, z, y: floor + 1, front,
      leaderPos: [lx, floor + 1, lz], trainerPos: [tx + front[1] * 2, floor + 1, tz + front[0] * 2],
      protect: [pbox(x, z, 7, 1, WORLD_H - 1)], // walls are +-6; door pillars, lanterns and the fossil arch reach 7
    };
  }

  // Gym and tower footprints stay bright even where the floor is below the natural ground.
  markLit(x0, z0) {
    for (let x = Math.max(0, x0 - 8); x <= Math.min(this.W - 1, x0 + 8); x++) {
      for (let z = Math.max(0, z0 - 8); z <= Math.min(this.D - 1, z0 + 8); z++) this.litCol[x + z * this.W] = 1;
    }
  }

  // A rectangle (inclusive world x/z) that stays bright, like markLit (T19: the long Firewall Maze).
  markLitBox(x0, x1, z0, z1) {
    for (let x = Math.max(0, x0); x <= Math.min(this.W - 1, x1); x++) {
      for (let z = Math.max(0, z0); z <= Math.min(this.D - 1, z1); z++) this.litCol[x + z * this.W] = 1;
    }
  }

  buildGym(x0, fy, z0, front, type, { cave = false } = {}) {
    const R = 6; // half-size of the building
    const wool = WOOL[type];
    if (cave) return this.buildCaveGym(x0, fy, z0, front, type);
    // Clear nearby trees so nothing hangs over the building or blocks the door.
    for (let dx = -R - 5; dx <= R + 5; dx++) {
      for (let dz = -R - 5; dz <= R + 5; dz++) {
        for (let y = 1; y < WORLD_H; y++) {
          const id = this.get(x0 + dx, y, z0 + dz);
          if (PLANTS.has(id)) this.set(x0 + dx, y, z0 + dz, B.AIR, false);
        }
      }
    }
    // Slope the surrounding ground towards the gym so it is never buried in a hill or stuck on a cliff.
    const M = R + 9;
    for (let dx = -M; dx <= M; dx++) {
      for (let dz = -M; dz <= M; dz++) {
        const x = x0 + dx, z = z0 + dz;
        const slope = Math.max(Math.abs(dx), Math.abs(dz)) - (R + 2);
        if (slope <= 0 || !this.inBounds(x, 0, z)) continue;
        const s = this.surface(x, z);
        const top = fy + slope, bottom = fy - slope;
        if (s.y > top) {
          for (let y = top + 1; y <= s.y; y++) this.set(x, y, z, B.AIR, false);
          if (isSolid(this.get(x, top, z))) this.set(x, top, z, groundOf(this.biome(x, z), top)[0], false);
        } else if (s.y < bottom && s.id !== B.WATER) {
          const [topId, under] = groundOf(this.biome(x, z), bottom);
          for (let y = s.y; y < bottom; y++) this.set(x, y, z, under, false);
          this.set(x, bottom, z, topId, false);
        }
      }
    }
    for (let dx = -R - 2; dx <= R + 2; dx++) {
      for (let dz = -R - 2; dz <= R + 2; dz++) {
        const x = x0 + dx, z = z0 + dz;
        if (!this.inBounds(x, 0, z)) continue;
        // Solid foundation and a cleared space above.
        for (let y = 1; y < fy; y++) if (!isSolid(this.get(x, y, z))) this.set(x, y, z, B.STONE, false);
        for (let y = fy + 1; y < WORLD_H; y++) this.set(x, y, z, B.AIR, false);
        const inside = Math.abs(dx) <= R && Math.abs(dz) <= R;
        if (!inside) { this.set(x, fy, z, groundOf(this.biome(x, z), fy)[0], false); continue; }
        const edge = Math.abs(dx) === R || Math.abs(dz) === R;
        const corner = Math.abs(dx) === R && Math.abs(dz) === R;
        // Carpet runs from the door to the leader.
        const along = front[0] ? dz : dx;
        this.set(x, fy, z, !edge && along === 0 ? wool : B.PLANKS, false);
        if (edge) for (let y = fy + 1; y <= fy + 5; y++) this.set(x, y, z, corner ? B.COBBLE : B.BRICK, false);
        // Stepped roof in the gym's colour.
        this.set(x, fy + 6, z, wool, false);
        if (Math.abs(dx) <= R - 2 && Math.abs(dz) <= R - 2) this.set(x, fy + 7, z, wool, false);
      }
    }
    // Doorway (3 wide, 3 tall) with a cobble path leading out.
    for (let s = -1; s <= 1; s++) {
      for (let d = R; d <= R + 2; d++) {
        const x = x0 + front[0] * d + (front[0] ? 0 : s);
        const z = z0 + front[1] * d + (front[1] ? 0 : s);
        if (d === R) for (let y = fy + 1; y <= fy + 3; y++) this.set(x, y, z, B.AIR, false);
        if (d > R) this.set(x, fy, z, B.COBBLE, false);
      }
    }
    // Pillars of the gym's colour beside the door.
    for (const s of [-2, 2]) {
      const x = x0 + front[0] * (R + 1) + (front[0] ? 0 : s);
      const z = z0 + front[1] * (R + 1) + (front[1] ? 0 : s);
      for (let y = fy + 1; y <= fy + 3; y++) this.set(x, y, z, wool, false);
    }
    if (type === 'bone') this.decorateFossilGym(x0, fy, z0, front);
    if (type === 'alien') this.decorateSaucerGym(x0, fy, z0, front);
    if (type === 'light') this.decorateLightGym(x0, fy, z0, front);
    if (type === 'paper') this.decorateOrigamiGym(x0, fy, z0, front);
    if (type === 'slime') this.decorateSlimeGym(x0, fy, z0, front, false);
  }

  // A gym inside a cavern (see carveGymRoom): no plants, no reshaping of the ground, only the
  // building itself, a solid floor and the door.
  buildCaveGym(x0, fy, z0, front, type) {
    const R = 6, wool = WOOL[type];
    for (let dx = -R - 2; dx <= R + 2; dx++) {
      for (let dz = -R - 2; dz <= R + 2; dz++) {
        const x = x0 + dx, z = z0 + dz;
        for (let y = 1; y < fy; y++) if (!isSolid(this.get(x, y, z))) this.set(x, y, z, B.STONE, false);
        const inside = Math.abs(dx) <= R && Math.abs(dz) <= R;
        if (!inside) continue;
        for (let y = fy + 1; y <= fy + 5; y++) this.set(x, y, z, B.AIR, false);
        const edge = Math.abs(dx) === R || Math.abs(dz) === R;
        const corner = Math.abs(dx) === R && Math.abs(dz) === R;
        const along = front[0] ? dz : dx;
        this.set(x, fy, z, !edge && along === 0 ? wool : B.PLANKS, false);
        if (edge) for (let y = fy + 1; y <= fy + 5; y++) this.set(x, y, z, corner ? B.COBBLE : B.BRICK, false);
        this.set(x, fy + 6, z, wool, false);
        if (Math.abs(dx) <= R - 2 && Math.abs(dz) <= R - 2) this.set(x, fy + 7, z, wool, false);
      }
    }
    for (let s = -1; s <= 1; s++) {
      for (let d = R; d <= R + 2; d++) {
        const x = x0 + front[0] * d + (front[0] ? 0 : s), z = z0 + front[1] * d + (front[1] ? 0 : s);
        if (d === R) for (let y = fy + 1; y <= fy + 3; y++) this.set(x, y, z, B.AIR, false);
        if (d > R) this.set(x, fy, z, B.COBBLE, false);
      }
    }
    for (const s of [-2, 2]) {
      const x = x0 + front[0] * (R + 1) + (front[0] ? 0 : s), z = z0 + front[1] * (R + 1) + (front[1] ? 0 : s);
      for (let y = fy + 1; y <= fy + 3; y++) this.set(x, y, z, wool, false);
    }
    if (type === 'bone') this.decorateFossilGym(x0, fy, z0, front, true);
    if (type === 'slime') this.decorateSlimeGym(x0, fy, z0, front, true);
  }

  // Fossil Gym: bone-white pillars on the roof corners and a bony arch over the door.
  // In a cave (`cave`) the roof pillars grow up to the rock: they hold the cave up.
  decorateFossilGym(x0, fy, z0, front, cave = false) {
    const bone = WOOL.bone;
    for (const sx of [-4, 4]) for (const sz of [-4, 4]) {
      if (cave) {
        for (let y = fy + 8; y < WORLD_H && !isSolid(this.get(x0 + sx, y, z0 + sz)); y++) this.set(x0 + sx, y, z0 + sz, bone, false);
        continue;
      }
      for (let y = fy + 8; y <= fy + 10; y++) this.set(x0 + sx, y, z0 + sz, bone, false);
      this.set(x0 + sx, fy + 11, z0 + sz, B.STONE_BRICKS, false);
    }
    for (let s = -2; s <= 2; s++) {
      const x = x0 + front[0] * 7 + (front[0] ? 0 : s), z = z0 + front[1] * 7 + (front[1] ? 0 : s);
      this.set(x, fy + 4, z, bone, false);
      if (Math.abs(s) === 2) this.set(x, fy + 5, z, bone, false);
    }
  }

  // Saucer Gym: a glass dome with a lamp inside and an antenna on the roof.
  decorateSaucerGym(x0, fy, z0) {
    const wool = WOOL.alien;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) === 2 || Math.abs(dz) === 2) this.set(x0 + dx, fy + 8, z0 + dz, B.GLASS, false);
      else if (dx || dz) this.set(x0 + dx, fy + 9, z0 + dz, B.GLASS, false);
    }
    this.set(x0, fy + 8, z0, B.LAMP, false);
    this.set(x0, fy + 9, z0, B.GLASS, false);
    this.set(x0, fy + 10, z0, B.GLASS, false);
    for (let y = fy + 11; y <= fy + 13; y++) this.set(x0, y, z0, wool, false);
    this.set(x0, fy + 14, z0, B.LAMP, false);
  }

  // (d, s) -> world column for a gym at (x0, z0) whose door faces `front`: d steps towards the door, s sideways.
  gymCol(x0, z0, front, d, s) {
    return [x0 + front[0] * d + (front[0] ? 0 : s), z0 + front[1] * d + (front[1] ? 0 : s)];
  }

  // Sunbeam Gym: glass windows, a striped lighthouse with a lamp on the back corner of the roof, lamps
  // on the door pillars and a golden sun over the door.
  decorateLightGym(x0, fy, z0, front) {
    const R = 6, wool = WOOL.light;
    const put = (d, s, y, id) => { const [x, z] = this.gymCol(x0, z0, front, d, s); this.set(x, y, z, id, false); };
    const at = (d, s, y) => { const [x, z] = this.gymCol(x0, z0, front, d, s); return this.get(x, y, z); };
    // Windows on the three walls without the door.
    for (let a = -3; a <= 3; a++) for (let y = fy + 2; y <= fy + 4; y++) {
      for (const [d, s] of [[-R, a], [a, -R], [a, R]]) if (at(d, s, y) === B.BRICK) put(d, s, y, B.GLASS);
    }
    // Lighthouse: 3x3, stripes of light wool and stone bricks, a lamp inside a glass ring, a light cap.
    const lc = [-3, 3];
    for (let y = fy + 8; y <= fy + 13; y++) {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) put(lc[0] + a, lc[1] + b, y, ((y - fy - 8) >> 1) % 2 ? B.STONE_BRICKS : wool);
    }
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      put(lc[0] + a, lc[1] + b, fy + 14, a || b ? B.GLASS : B.LAMP);
      put(lc[0] + a, lc[1] + b, fy + 15, wool);
    }
    put(lc[0], lc[1], fy + 16, B.LAMP);
    // Lamps on the door pillars.
    for (const s of [-2, 2]) put(R + 1, s, fy + 4, B.LAMP);
    // A sun over the door: a light-wool disc with a lamp heart, on the wall above the doorway.
    for (let s = -1; s <= 1; s++) put(R, s, fy + 4, wool);
    put(R, 0, fy + 5, B.LAMP);
    for (const s of [-1, 1]) put(R, s, fy + 5, wool);
  }

  // Origami Gym: a house of paper screens (paper wool between wooden frames), log corners, a folded roof
  // ridge with a paper crane on top and four paper lanterns on posts.
  decorateOrigamiGym(x0, fy, z0, front) {
    const R = 6, paper = WOOL.paper;
    const put = (d, s, y, id) => { const [x, z] = this.gymCol(x0, z0, front, d, s); this.set(x, y, z, id, false); };
    const at = (d, s, y) => { const [x, z] = this.gymCol(x0, z0, front, d, s); return this.get(x, y, z); };
    for (let a = -R; a <= R; a++) for (let y = fy + 1; y <= fy + 5; y++) {
      for (const [d, s] of [[-R, a], [R, a], [a, -R], [a, R]]) {
        const id = at(d, s, y);
        if (Math.abs(a) === R) { if (id === B.COBBLE) put(d, s, y, B.LOG); continue; }
        if (id !== B.BRICK) continue;
        put(d, s, y, y === fy + 3 || a % 3 === 0 ? B.PLANKS : paper);
      }
    }
    // Folded ridge and a paper crane.
    for (let s = -3; s <= 3; s++) put(0, s, fy + 8, paper);
    for (let s = -2; s <= 2; s++) put(0, s, fy + 9, paper);
    put(0, 0, fy + 10, paper);
    for (let s = -1; s <= 1; s++) put(0, s, fy + 11, paper); // body
    put(0, -2, fy + 12, paper); // tail
    put(0, 2, fy + 12, paper); put(0, 3, fy + 13, paper); put(0, 4, fy + 13, paper); // neck, head and beak
    for (const d of [-2, -1, 1, 2]) put(d, 0, fy + 12 + (Math.abs(d) === 2 ? 1 : 0), paper); // wings, tips raised
    // Paper lanterns on posts just outside the corners.
    for (const d of [-R - 1, R + 1]) for (const s of [-R - 1, R + 1]) {
      for (let y = fy + 1; y <= fy + 3; y++) put(d, s, y, B.LOG);
      put(d, s, fy + 4, B.LAMP);
      put(d, s, fy + 5, B.PLANKS);
    }
  }

  // Goo Gym: slime bubbles on the roof and slime dripping off the walls. Drips only on the surface fallback if `drips`.
  decorateSlimeGym(x0, fy, z0, front, cave = false) {
    const R = 6, slime = WOOL.slime;
    const put = (d, s, y, id) => { const [x, z] = this.gymCol(x0, z0, front, d, s); if (this.get(x, y, z) === B.AIR) this.set(x, y, z, id, false); };
    // Goo running down the walls from the roof: 1-4 blocks of slime on every wall column.
    for (let a = -R + 1; a <= R - 1; a++) {
      for (const [d, s] of [[-R, a], [R, a], [a, -R], [a, R]]) {
        const [x, z] = this.gymCol(x0, z0, front, d, s);
        const len = 1 + Math.floor(hash2(x, z, this.seed + 628) * 4);
        for (let y = fy + 5; y > fy + 5 - len; y--) if (this.get(x, y, z) === B.BRICK) this.set(x, y, z, slime, false);
      }
    }
    const n = 4 + Math.floor(hash2(x0, z0, this.seed + 624) * 3);
    for (let k = 0; k < n; k++) {
      const d = Math.floor(hash2(x0 + k, z0, this.seed + 625) * 7) - 3, s = Math.floor(hash2(x0, z0 + k, this.seed + 626) * 7) - 3;
      put(d, s, fy + 8, slime);
      if (!cave && k % 2 === 0) put(d, s, fy + 9, slime);
    }
    if (!cave) return;
    for (let a = -R; a <= R; a += 3) {
      for (const [d, s] of [[-R - 1, a], [a, -R - 1], [a, R + 1]]) {
        put(d, s, fy + 5, slime);
        if (hash2(d + x0, s + z0, this.seed + 627) < 0.5) put(d, s, fy + 4, slime);
      }
    }
  }

  // The Goo Gym's cavern: puddles of goo on the floor, goo dripping from the ceiling and more glowcaps.
  // Returns the number of glowcaps it added.
  decorateSlimeRoom(spot) {
    const { x: x0, z: z0, fy, plan } = spot;
    const slime = WOOL.slime, Wd = this.W, RC = 13;
    const path = new Set();
    for (const [cx, cz] of this.stairCells(spot)) for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) path.add((cx + a) + (cz + b) * Wd);
    const free = (x, z) => ((x - x0) / RC) ** 2 + ((z - z0) / RC) ** 2 < 0.8 && !path.has(x + z * Wd) && (Math.abs(x - x0) > 9 || Math.abs(z - z0) > 9);
    // Puddles
    const puddles = 6 + Math.floor(hash2(x0, z0, this.seed + 621) * 3);
    for (let k = 0; k < puddles; k++) {
      const ang = (k + hash2(k, 1, this.seed + 621) * 0.6) * Math.PI * 2 / puddles, rad = 9.5 + hash2(k, 2, this.seed + 621) * 2;
      const px = x0 + Math.round(Math.cos(ang) * rad), pz = z0 + Math.round(Math.sin(ang) * rad);
      const r = 2.2 + hash2(k, 3, this.seed + 621) * 1.4;
      for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
        const x = px + a, z = pz + b;
        if (a * a + b * b > r * r + 1.5 * hash2(x, z, this.seed + 622) || !free(x, z)) continue;
        if (this.get(x, fy, z) === B.STONE && this.get(x, fy + 1, z) === B.AIR) this.set(x, fy, z, slime, false);
      }
    }
    // Drips and glowcaps
    let glow = 0;
    for (let x = x0 - RC; x <= x0 + RC; x++) for (let z = z0 - RC; z <= z0 + RC; z++) {
      if (!free(x, z)) continue;
      let top = fy;
      while (top + 1 < WORLD_H && this.get(x, top + 1, z) === B.AIR) top++;
      if (top <= fy + 2) continue;
      const h = hash2(x, z, this.seed + 623);
      if (h < 0.05) {
        this.set(x, top, z, slime, false);
        if (h < 0.02 && top - 1 > fy + 2) this.set(x, top - 1, z, slime, false);
      } else if (h > 0.9 && this.get(x, fy, z) === B.STONE) {
        this.set(x, fy + 1, z, B.GLOWCAP, false); glow++;
      }
    }
    return glow;
  }

  // The Cloud Gym: a floating island of cloud blocks with the building on it, a landing pad on the ground
  // beside it (build a tower of blocks next to the pad and jump across) and a lamp post by the pad.
  // theme 'saucer' (the Saucer Gym): the same shape and pad, but a metal saucer with lights and a green pad.
  placeSkyGym(spot, theme = 'cloud') {
    const { def, x: x0, z: z0, fy } = spot;
    const R = 6, Wd = this.W;
    const cx = MID_X, cz = MID_Z;
    const dx = cx - x0, dz = cz - z0;
    const front = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
    const col = (d, s) => this.gymCol(x0, z0, front, d, s);
    // Nothing grows in the way of the pad (or hangs over it).
    for (let d = 8; d <= 16; d++) for (let s = -6; s <= 6; s++) {
      const [x, z] = col(d, s);
      for (let y = 1; y < WORLD_H; y++) if (PLANTS.has(this.get(x, y, z))) this.set(x, y, z, B.AIR, false);
    }
    // The island.
    const saucer = theme === 'saucer';
    const put = (x, y, z, id) => { if (this.get(x, y, z) === B.AIR) this.set(x, y, z, id, false); };
    for (let a = -11; a <= 11; a++) for (let b = -11; b <= 11; b++) {
      const r2 = a * a + b * b, x = x0 + a, z = z0 + b;
      if (saucer) {
        // A smooth metal disc with a green rim, narrowing underneath.
        if (r2 <= 110) put(x, fy, z, r2 > 81 ? WOOL.alien : WOOL.metal);
        if (r2 <= 81) put(x, fy - 1, z, B.STONE_BRICKS);
        if (r2 <= 42) put(x, fy - 2, z, B.STONE_BRICKS);
        if (r2 <= 12) put(x, fy - 3, z, r2 <= 2 ? B.LAMP : B.STONE_BRICKS);
        continue;
      }
      const h = hash2(x, z, this.seed + 631);
      if (r2 <= 110) put(x, fy, z, B.CLOUD);
      if (r2 <= 81 || (r2 <= 110 && h < 0.3)) put(x, fy - 1, z, B.CLOUD);
      if (r2 <= 49 || (r2 <= 81 && h < 0.25)) put(x, fy - 2, z, B.CLOUD);
      if (r2 <= 16 || (r2 <= 42 && h < 0.2)) put(x, fy - 3, z, B.CLOUD);
    }
    for (const sa of [-6, 6]) for (const sb of [-6, 6]) this.set(x0 + sa, fy - 1, z0 + sb, B.LAMP, false);
    // The saucer's ring of lights round its rim.
    if (saucer) for (const [a, b] of [[9, 0], [-9, 0], [0, 9], [0, -9]]) this.set(x0 + a, fy - 1, z0 + b, B.LAMP, false);
    if (saucer) this.buildSaucerGym(x0, fy, z0, front);
    else this.buildSkyGym(x0, fy, z0, front);
    // Landing pad on the ground, a lamp post beside it.
    const surf = (x, z) => {
      for (let y = WORLD_H - 1; y > 0; y--) if (this.get(x, y, z) !== B.AIR) return y;
      return 0;
    };
    // The pad is flat, at the height of its highest block (build the tower on its inner middle block: stand at py + 1).
    const [px, pz] = col(11, 0);
    let py = 0;
    for (let d = 11; d <= 12; d++) for (let s = -1; s <= 1; s++) { const [x, z] = col(d, s); py = Math.max(py, this.ground[x + z * Wd]); }
    for (let d = 11; d <= 12; d++) for (let s = -1; s <= 1; s++) {
      const [x, z] = col(d, s), top = surf(x, z);
      for (let y = top + 1; y < py; y++) this.set(x, y, z, B.DIRT, false);
      for (let y = py + 1; y <= top; y++) this.set(x, y, z, B.AIR, false);
      this.set(x, py, z, saucer ? WOOL.alien : WOOL.sky, false);
    }
    const [lx, lz] = col(11, 3), ly = surf(lx, lz);
    this.set(lx, ly + 1, lz, B.COBBLE, false); this.set(lx, ly + 2, lz, B.COBBLE, false); this.set(lx, ly + 3, lz, B.LAMP, false);
    const at = d => [x0 + front[0] * d + 0.5, z0 + front[1] * d + 0.5];
    const [lpx, lpz] = at(-4), [tx, tz] = at(1);
    return {
      def, x: x0, z: z0, y: fy + 1, front, sky: true, pad: [px, py, pz], padColor: saucer ? 'green' : 'blue',
      leaderPos: [lpx, fy + 1, lpz], trainerPos: [tx + front[1] * 2, fy + 1, tz + front[0] * 2],
      protect: [pbox(x0, z0, 10, fy - 3, WORLD_H - 1)], // the island; the pad (d = 11-12) and its pillar are outside
    };
  }

  // The building on the cloud island: the usual gym (cloud walls with a glass band), a pole with a cloud puff
  // on the roof and two cloud wings.
  buildSkyGym(x0, fy, z0, front) {
    const R = 6, wool = WOOL.sky;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const x = x0 + dx, z = z0 + dz;
      const edge = Math.abs(dx) === R || Math.abs(dz) === R;
      const corner = Math.abs(dx) === R && Math.abs(dz) === R;
      const along = front[0] ? dz : dx;
      this.set(x, fy, z, !edge && along === 0 ? wool : B.PLANKS, false);
      for (let y = fy + 1; y <= fy + 5; y++) this.set(x, y, z, !edge ? B.AIR : corner ? B.COBBLE : y === fy + 2 || y === fy + 3 ? B.GLASS : B.CLOUD, false);
      this.set(x, fy + 6, z, wool, false);
      if (Math.abs(dx) <= R - 2 && Math.abs(dz) <= R - 2) this.set(x, fy + 7, z, wool, false);
    }
    const put = (d, s, y, id) => { const [x, z] = this.gymCol(x0, z0, front, d, s); this.set(x, y, z, id, false); };
    // Doorway, cloud path and pillars.
    for (let s = -1; s <= 1; s++) {
      for (let y = fy + 1; y <= fy + 3; y++) put(R, s, y, B.AIR);
      put(R + 1, s, fy, B.CLOUD); put(R + 2, s, fy, B.CLOUD);
    }
    for (const s of [-2, 2]) for (let y = fy + 1; y <= fy + 3; y++) put(R + 1, s, y, wool);
    // Pole and puff on the roof, wings on the side walls.
    for (let y = fy + 8; y <= fy + 10; y++) put(0, 0, y, wool);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let y = fy + 11; y <= fy + 12; y++) put(a, b, y, B.CLOUD);
    for (const s of [-1, 1]) for (let k = 1; k <= 3; k++) put(0, s * (R + k), fy + 3, B.CLOUD);
  }

  // The building on the saucer: alien-green walls with a glass band, metal corners and floor, and an
  // antenna with a light on the roof (the flying saucer itself hovers above it at night).
  buildSaucerGym(x0, fy, z0, front) {
    const R = 6, wool = WOOL.alien, metal = WOOL.metal;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const x = x0 + dx, z = z0 + dz;
      const edge = Math.abs(dx) === R || Math.abs(dz) === R;
      const corner = Math.abs(dx) === R && Math.abs(dz) === R;
      const along = front[0] ? dz : dx;
      this.set(x, fy, z, !edge && along === 0 ? wool : metal, false);
      for (let y = fy + 1; y <= fy + 5; y++) this.set(x, y, z, !edge ? B.AIR : corner ? metal : y === fy + 2 || y === fy + 3 ? B.GLASS : wool, false);
      this.set(x, fy + 6, z, wool, false);
      if (Math.abs(dx) <= R - 2 && Math.abs(dz) <= R - 2) this.set(x, fy + 7, z, wool, false);
    }
    const put = (d, s, y, id) => { const [x, z] = this.gymCol(x0, z0, front, d, s); this.set(x, y, z, id, false); };
    // Doorway, metal path and pillars.
    for (let s = -1; s <= 1; s++) {
      for (let y = fy + 1; y <= fy + 3; y++) put(R, s, y, B.AIR);
      put(R + 1, s, fy, metal); put(R + 2, s, fy, metal);
    }
    for (const s of [-2, 2]) for (let y = fy + 1; y <= fy + 3; y++) put(R + 1, s, y, wool);
    // Antenna with a light on the roof.
    for (let y = fy + 8; y <= fy + 9; y++) put(0, 0, y, metal);
    put(0, 0, fy + 10, B.LAMP);
  }

  // The gym whose building contains (x, z), if any.
  // Cave gyms only count when y (feet) is in the building's height, not on the hill above it.
  gymAt(x, z, y) {
    return this.gyms.find(g => Math.abs(x - g.x - 0.5) <= 6.5 && Math.abs(z - g.z - 0.5) <= 6.5
      && (!g.cave || y === undefined || (y >= g.y - 1 && y <= g.y + 6))
      && (!g.sky || y === undefined || y >= g.y - 1)) || null;
  }

  // The 5 places in the new land where gyms 23+ go (T19: slots 0-2, T23: 3-4). Terrain only (seed and constants,
  // nothing else), so the same with or without anything else in the world. NEVER change the rules: it would move
  // these gyms in every world made since T17. Slot 0 is the nearest to the start, slot 4 the farthest.
  newLandSlots() {
    if (this.slots) return this.slots;
    const h = (x, z) => Math.min(this.terrainHeight(x, z), WORLD_H - 10);
    const dry = (x, z) => [[0, 0], [6, 6], [-6, 6], [6, -6], [-6, -6]].every(([a, b]) => h(x + a, z + b) > WATER_LEVEL);
    const score = (x, z) => {
      let n = 0;
      for (let a = -16; a <= 16; a += 8) for (let b = -16; b <= 16; b += 8) { const g = h(x + a, z + b); if (g > WATER_LEVEL && g <= 26) n++; }
      return n + (dry(x, z) ? 5 : 0);
    };
    const cands = []; // centres whose +-24 box lies inside the new land and the map
    for (let z = 28; z <= 260; z += 4) for (let x = OLD_W + SLOT_R; x <= 260; x += 4) cands.push([x, z]); // east strip and corner
    for (let x = 28; x <= OLD_W + 20; x += 4) for (let z = OLD_D + SLOT_R; z <= 260; z += 4) cands.push([x, z]); // south strip
    const scored = cands.map(([x, z], i) => ({ x, z, i, s: score(x, z) })).sort((a, b) => b.s - a.s || a.i - b.i);
    const picked = [];
    for (const c of scored) {
      if (picked.length === 5) break;
      if (picked.every(p => Math.max(Math.abs(p.x - c.x), Math.abs(p.z - c.z)) >= SLOT_GAP)) picked.push(c);
    }
    const d = c => Math.hypot(c.x - MID_X, c.z - MID_Z);
    picked.sort((a, b) => d(a) - d(b) || a.i - b.i);
    return (this.slots = picked.map(({ x, z }, k) => ({ k, x, z, box: pbox(x, z, SLOT_R, 0, WORLD_H - 1) })));
  }

  // Places the gyms whose def has a `slot` in their slot of the new land. A slot gym may change blocks only inside
  // its slot box. def.build names a builder in SLOT_BUILDERS; otherwise it is a normal surface gym.
  placeSlotGyms() {
    const slots = this.newLandSlots();
    for (const def of GYMS) {
      if (def.slot == null) continue;
      const s = slots[def.slot];
      const b = SLOT_BUILDERS[def.build];
      const g = b ? b(this, def, s) : this.placeGym(def, s.x, s.z);
      g.slot = s;
      this.gyms.push(g);
    }
  }

  // Step-0 stand-in for the slot gym builders: the plain gym of its type with a second trainer beside the first, so
  // the gym can be battled (and is protected) until its real building exists.
  stubSlotGym(def, slot) {
    const g = this.placeGym(def, slot.x, slot.z);
    const [tx, , tz] = g.trainerPos, f = g.front;
    g.trainerPositions = [g.trainerPos, [tx - f[1] * 4, g.trainerPos[1], tz - f[0] * 4]]; // the other side of the door line
    g.area = { x0: g.x - 6, x1: g.x + 6, z0: g.z - 6, z1: g.z + 6, y0: g.y - 1, y1: g.y + 7 };
    this.markLit(g.x, g.z);
    return g;
  }

  // Levels the ground to `fy` under a rectangle (+ pad) and slopes the land around it (1 block per block, 9 blocks
  // out), never outside `box`; clears plants within rect + 5 (inside box). rect and box are { x0, x1, z0, z1 } in world
  // x/z, inclusive. Plain terrain only: the caller builds on it. (Generalised from buildGym, which is unchanged.)
  levelSite(rect, fy, box, pad = 2) {
    const inBox = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1 && this.inBounds(x, 0, z);
    for (let x = rect.x0 - 5; x <= rect.x1 + 5; x++) for (let z = rect.z0 - 5; z <= rect.z1 + 5; z++) {
      if (!inBox(x, z)) continue;
      for (let y = 1; y < WORLD_H; y++) if (PLANTS.has(this.get(x, y, z))) this.set(x, y, z, B.AIR, false);
    }
    const reach = pad + 9;
    for (let x = rect.x0 - reach; x <= rect.x1 + reach; x++) for (let z = rect.z0 - reach; z <= rect.z1 + reach; z++) {
      if (!inBox(x, z)) continue;
      const out = Math.max(rect.x0 - x, x - rect.x1, rect.z0 - z, z - rect.z1, 0); // Chebyshev distance outside rect
      const slope = out - pad;
      if (slope <= 0) { // the flat part: solid foundation, cleared air above, the biome's ground on top
        for (let y = 1; y < fy; y++) if (!isSolid(this.get(x, y, z))) this.set(x, y, z, B.STONE, false);
        for (let y = fy + 1; y < WORLD_H; y++) this.set(x, y, z, B.AIR, false);
        this.set(x, fy, z, groundOf(this.biome(x, z), fy)[0], false);
        continue;
      }
      const s = this.surface(x, z);
      const top = fy + slope, bottom = fy - slope;
      if (s.y > top) {
        for (let y = top + 1; y <= s.y; y++) this.set(x, y, z, B.AIR, false);
        if (isSolid(this.get(x, top, z))) this.set(x, top, z, groundOf(this.biome(x, z), top)[0], false);
      } else if (s.y < bottom && s.id !== B.WATER) {
        const [topId, under] = groundOf(this.biome(x, z), bottom);
        for (let y = s.y; y < bottom; y++) this.set(x, y, z, under, false);
        this.set(x, bottom, z, topId, false);
      }
    }
  }

  // The Champion's Tower stands near the middle of the map, clear of every gym.
  towerSpot(gyms = this.gyms) {
    const cx = MID_X, cz = MID_Z, off = hash2(3, 77, this.seed) * Math.PI * 2;
    const clear = (x, z, gap) => gyms.every(g => Math.max(Math.abs(x - g.x), Math.abs(z - g.z)) >= gap);
    const dry = (x, z) => this.dryAt(x, z);
    for (const gap of [26, 23]) {
      for (const needDry of [true, false]) {
        for (let r = 18; r <= 80; r += 2) {
          for (let k = 0; k < 24; k++) {
            const a = off + k * Math.PI / 12, x = Math.floor(cx + Math.cos(a) * r), z = Math.floor(cz + Math.sin(a) * r);
            if (x < 18 || z < 18 || x >= OLD_W - 18 || z >= OLD_D - 18) continue;
            if (clear(x, z, gap) && (!needDry || dry(x, z))) return [x, z];
          }
        }
      }
    }
    // Last resort (never expected): the grid spot furthest from every gym.
    let best = [cx, cz], bestGap = -1;
    for (let x = 18; x < OLD_W - 18; x += 4) {
      for (let z = 18; z < OLD_D - 18; z += 4) {
        const gap = Math.min(...gyms.map(g => Math.max(Math.abs(x - g.x), Math.abs(z - g.z))));
        if (gap > bestGap) { bestGap = gap; best = [x, z]; }
      }
    }
    return best;
  }

  placeTower() {
    const cx = MID_X, cz = MID_Z;
    const [x, z] = this.towerSpot();
    const dx = cx - x, dz = cz - z;
    const front = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1];
    const floor = Math.max(WATER_LEVEL + 1, Math.min(this.terrainHeight(x, z), 24));
    this.buildTower(x, floor, z, front);
    const side = [front[1], front[0]];
    const posOf = ([d, s]) => [x + front[0] * d + side[0] * s + 0.5, floor + 1, z + front[1] * d + side[1] * s + 0.5];
    this.tower = { def: TOWER, tower: true, x, z, y: floor + 1, front, people: TOWER.people.map(p => ({ ...p, pos: posOf(p.at) })), protect: [pbox(x, z, 7, 1, WORLD_H - 1)] };
    this.markLit(x, z);
  }

  // The tower: stone walls 11 high, a rainbow roof with battlements and a crystal spire.
  buildTower(x0, fy, z0, front) {
    const R = 6;
    const rainbow = WOOL.rainbow;
    const side = [front[1], front[0]];
    for (let dx = -R - 5; dx <= R + 5; dx++) {
      for (let dz = -R - 5; dz <= R + 5; dz++) {
        for (let y = 1; y < WORLD_H; y++) {
          const id = this.get(x0 + dx, y, z0 + dz);
          if (PLANTS.has(id)) this.set(x0 + dx, y, z0 + dz, B.AIR, false);
        }
      }
    }
    // Slope the ground towards the tower (but never into a gym's own ground).
    const M = R + 9;
    for (let dx = -M; dx <= M; dx++) {
      for (let dz = -M; dz <= M; dz++) {
        const x = x0 + dx, z = z0 + dz;
        const slope = Math.max(Math.abs(dx), Math.abs(dz)) - (R + 2);
        if (slope <= 0 || !this.inBounds(x, 0, z)) continue;
        if (this.gyms.some(g => Math.max(Math.abs(x - g.x), Math.abs(z - g.z)) <= R + 3)) continue;
        const s = this.surface(x, z);
        const top = fy + slope, bottom = fy - slope;
        if (s.y > top) {
          for (let y = top + 1; y <= s.y; y++) this.set(x, y, z, B.AIR, false);
          if (isSolid(this.get(x, top, z))) this.set(x, top, z, groundOf(this.biome(x, z), top)[0], false);
        } else if (s.y < bottom && s.id !== B.WATER) {
          const [topId, under] = groundOf(this.biome(x, z), bottom);
          for (let y = s.y; y < bottom; y++) this.set(x, y, z, under, false);
          this.set(x, bottom, z, topId, false);
        }
      }
    }
    for (let dx = -R - 2; dx <= R + 2; dx++) {
      for (let dz = -R - 2; dz <= R + 2; dz++) {
        const x = x0 + dx, z = z0 + dz;
        if (!this.inBounds(x, 0, z)) continue;
        for (let y = 1; y < fy; y++) if (!isSolid(this.get(x, y, z))) this.set(x, y, z, B.STONE, false);
        for (let y = fy + 1; y < WORLD_H; y++) this.set(x, y, z, B.AIR, false);
        const inside = Math.abs(dx) <= R && Math.abs(dz) <= R;
        if (!inside) { this.set(x, fy, z, B.STONE_BRICKS, false); continue; }
        const d = dx * front[0] + dz * front[1], s = dx * side[0] + dz * side[1];
        const edge = Math.abs(dx) === R || Math.abs(dz) === R;
        const corner = Math.abs(dx) === R && Math.abs(dz) === R;
        // Floor, a rainbow carpet from the door and a rainbow square under the champion.
        const carpet = !edge && ((s === 0 && d >= -4) || (d >= -5 && d <= -3 && Math.abs(s) <= 1));
        this.set(x, fy, z, carpet ? rainbow : B.PLANKS, false);
        if (edge) {
          const top = corner ? fy + 14 : fy + 11;
          const along = Math.abs(d) === R ? s : d;
          for (let y = fy + 1; y <= top; y++) {
            const window = !corner && Math.abs(along) === 3 && [3, 4, 7, 8].includes(y - fy);
            this.set(x, y, z, window ? B.GLASS : B.STONE_BRICKS, false);
          }
          if (corner) this.set(x, fy + 15, z, B.LAMP, false);
          else if (along === 0 && d !== R) this.set(x, fy + 6, z, B.LAMP, false);
        }
        // Rainbow roof, battlements, and a stepped crown.
        this.set(x, fy + 12, z, rainbow, false);
        if (edge && (dx + dz) % 2 === 0) this.set(x, fy + 13, z, B.STONE_BRICKS, false);
        if (Math.abs(dx) <= R - 2 && Math.abs(dz) <= R - 2) this.set(x, fy + 13, z, rainbow, false);
        if (Math.abs(dx) <= R - 4 && Math.abs(dz) <= R - 4) this.set(x, fy + 14, z, rainbow, false);
        if (dx === 0 && dz === 0) for (let y = fy + 15; y <= fy + 17; y++) this.set(x, y, z, B.CRYSTAL, false);
      }
    }
    // Doorway (3 wide, 4 tall) with a stone path.
    for (let s = -1; s <= 1; s++) {
      for (let d = R; d <= R + 4; d++) {
        const x = x0 + front[0] * d + side[0] * s, z = z0 + front[1] * d + side[1] * s;
        if (d === R) for (let y = fy + 1; y <= fy + 4; y++) this.set(x, y, z, B.AIR, false);
        else {
          for (let y = fy - 1; y < fy; y++) if (!isSolid(this.get(x, y, z))) this.set(x, y, z, B.STONE, false);
          for (let y = fy + 1; y <= fy + 4; y++) this.set(x, y, z, B.AIR, false);
        }
        if (d > R) this.set(x, fy, z, B.STONE_BRICKS, false);
      }
    }
    // Rainbow pillars with a lamp on top beside the door.
    for (const s of [-2, 2]) {
      const x = x0 + front[0] * (R + 1) + side[0] * s, z = z0 + front[1] * (R + 1) + side[1] * s;
      for (let y = fy + 1; y <= fy + 4; y++) this.set(x, y, z, rainbow, false);
      this.set(x, fy + 5, z, B.LAMP, false);
    }
    // Two crystal columns beside the champion.
    for (const s of [-2, 2]) {
      const x = x0 - front[0] * 5 + side[0] * s, z = z0 - front[1] * 5 + side[1] * s;
      for (let y = fy + 1; y <= fy + 2; y++) this.set(x, y, z, B.CRYSTAL, false);
    }
  }

  // The tower, if (x, z) is inside its walls.
  towerAt(x, z) {
    const t = this.tower;
    return t && Math.abs(x - t.x - 0.5) <= 6.5 && Math.abs(z - t.z - 0.5) <= 6.5 ? t : null;
  }
}

export function installGymPlacement(World) {
  for (const name of Object.getOwnPropertyNames(GymPlacement.prototype)) {
    if (name !== 'constructor') Object.defineProperty(World.prototype, name, Object.getOwnPropertyDescriptor(GymPlacement.prototype, name));
  }
}
