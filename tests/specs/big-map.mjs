// T17: the 288 x 288 map (old 224 x 224 area unchanged, a natural seam, the start point where it was, five
// reserved gym slots in the new land) and gyms that can't be broken into or built in.
// T32: the map is 288 x 368: the 288 x 288 map unchanged inside it, an 80-row south strip with five more gym slots (5-9),
// treasure map spots pinned, old [288, 288] saves converted.
import { devices } from 'playwright';
import { openGame, seedSave, continueGame, click } from '../helpers.mjs';
import { GYMS } from '../../src/gyms.js';
const NG = GYMS.length; // all gyms, also those added later

// newLandSlots() for three seeds (x, z), nearest the start first. They must never change.
const SLOTS = {
  1: [[136, 248], [80, 248], [260, 132], [260, 48], [192, 252]],
  4242: [[84, 248], [140, 248], [28, 248], [248, 204], [252, 260]],
  777: [[248, 92], [144, 248], [252, 152], [248, 28], [248, 248]],
};
// T32: southSlots() (slots 5-9, dry ones first, then nearest the start). They must never change.
const SOUTH = {
  1: [[131, 314], [183, 316], [27, 314], [79, 335], [235, 340]],
  4242: [[131, 314], [79, 314], [27, 314], [260, 336], [208, 318]],
  777: [[156, 314], [208, 316], [104, 338], [27, 331], [260, 314]],
  294331207: [[81, 314], [197, 314], [249, 314], [134, 314], [27, 314]],
};
// T32: treasureSpots() measured before the map grew (they must never move; 777 and 294331207 have fallback spots).
const SPOTS = {
  1: [[104, 129], [172, 174], [89, 80], [57, 133], [146, 130]],
  4242: [[103, 127], [192, 51], [72, 172], [146, 143], [23, 154]],
  777: [[30, 210], [67, 90], [176, 144], [170, 51], [61, 164]],
  294331207: [[211, 14], [96, 76], [56, 56], [152, 77], [95, 118]],
};
// Where a new player starts: x, feet y, z.
const START = { 1: [112, 15, 112], 4242: [120, 15, 111], 294331207: [94, 17, 96] };

export default async function ({ browser, base, t }) {
  let page = await openGame(browser, base);

  // 1-5. The world itself (no game running).
  const r = await page.evaluate(async ({ slots, start }) => {
    const { World, WORLD_H, WATER_LEVEL, PLANTS } = await import('/src/world.js');
    const { B } = await import('/src/blocks.js');
    const out = { same: {}, seam: {}, land: {}, start: {}, slots: {}, prot: {} };
    for (const seed of [1, 4242, 777]) {
      const w = new World(seed, null, null); w.generate();
      const o = new World(seed, null, null, [224, 224]); o.generate();
      // 1. Old area identical.
      let diff = 0, gdiff = 0;
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < 224; z++) for (let x = 0; x < 224; x++) if (w.data[x + w.W * (z + w.D * y)] !== o.data[x + 224 * (z + 224 * y)]) diff++;
      for (let z = 0; z < 224; z++) for (let x = 0; x < 224; x++) if (w.ground[x + w.W * z] !== o.ground[x + 224 * z]) gdiff++;
      const remap = c => (c % 224) + Math.floor(c / 224) * w.W;
      const sameSet = (a, b) => a.size === b.size && [...b].every(c => a.has(remap(c)));
      out.same[seed] = {
        diff, gdiff, size: [w.W, w.D],
        gyms: w.gyms.filter(g => !(g.slot?.k >= 5)).length === o.gyms.length + 5 && w.gyms.slice(0, o.gyms.length).every((g, i) => g.def === o.gyms[i].def && g.x === o.gyms[i].x && g.y === o.gyms[i].y && g.z === o.gyms[i].z),
        tower: w.tower.x === o.tower.x && w.tower.z === o.tower.z && w.tower.y === o.tower.y,
        caves: sameSet(w.caves.opened, o.caves.opened) && sameSet(w.caves.marks, o.caves.marks),
      };
      // 2. The seam: the top land block of columns on both sides of 223 | 224 is the natural terrain.
      const natural = (x, z) => Math.max(Math.min(w.terrainHeight(x, z), WORLD_H - 10), WATER_LEVEL);
      const landTop = (x, z) => { for (let y = WORLD_H - 1; y >= 0; y--) { const id = w.get(x, y, z); if (id !== B.AIR && !PLANTS.has(id) && id !== B.FLOWER_BUSH) return y; } return -1; };
      let bad = 0, maxStep = 0;
      for (let k = 0; k < 224; k++) {
        for (const [x, z] of [[223, k], [224, k], [k, 223], [k, 224]]) if (landTop(x, z) !== natural(x, z)) bad++;
        maxStep = Math.max(maxStep, Math.abs(natural(223, k) - natural(224, k)), Math.abs(natural(k, 223) - natural(k, 224)));
      }
      const biomes = new Set();
      for (let x = 0; x < 288; x += 4) for (let z = 0; z < 288; z += 4) if (x >= 224 || z >= 224) biomes.add(w.biome(x, z));
      let plants = 0;
      for (let x = 226; x < 285; x += 2) for (let z = 3; z < 285; z += 2) { if (PLANTS.has(w.get(x, w.surface(x, z).y, z)) || w.get(x, w.surface(x, z).y, z) === B.FLOWER_BUSH) plants++; }
      out.seam[seed] = { bad, maxStep, biomes: biomes.size, plants };
      // 4. Slots: the same before and after generating, and as they always were.
      const fresh = new World(seed, null, null).newLandSlots();
      const got = w.newLandSlots();
      let apart = 99;
      for (let i = 0; i < got.length; i++) for (let j = i + 1; j < got.length; j++) apart = Math.min(apart, Math.max(Math.abs(got[i].x - got[j].x), Math.abs(got[i].z - got[j].z)));
      // T19: the three slot gyms (slots 0-2) change nothing outside their boxes, and are protected with an area.
      const bare = new World(seed, null, null); bare.generate({ slotGyms: false });
      const boxes = [0, 1, 2, 4].map(i => got[i].box).concat(w.gyms.filter(g => g.slot?.k >= 5).map(g => g.slot.box)); // slot 3 is spare; the south slot gyms (T32+) have their own boxes
      let outsideDiff = 0;
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < w.D; z++) for (let x = 0; x < w.W; x++) {
        if (boxes.some(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1)) continue;
        if (w.get(x, y, z) !== bare.get(x, y, z)) outsideDiff++;
      }
      const slotGyms = w.gyms.filter(g => g.slot && g.slot.k < 5); // the south slots (5+) are checked below
      out.slotGyms = out.slotGyms || {};
      out.slotGyms[seed] = {
        outsideDiff, n: slotGyms.length, ids: slotGyms.map(g => g.def.id).join(),
        protect: slotGyms.every(g => g.protect?.length && g.area), k: slotGyms.every(g => g.slot.k === g.def.slot),
        inBox: slotGyms.every(g => g.protect.every(b => b.x0 >= g.slot.box.x0 && b.x1 <= g.slot.box.x1 && b.z0 >= g.slot.box.z0 && b.z1 <= g.slot.box.z1)),
        bareGyms: bare.gyms.length,
      };
      out.slots[seed] = {
        fixture: JSON.stringify(got.map(s => [s.x, s.z])) === JSON.stringify(slots[seed]),
        same: JSON.stringify(fresh.map(s => [s.x, s.z])) === JSON.stringify(got.map(s => [s.x, s.z])),
        n: got.length, apart,
        inside: got.every(s => (s.box.x0 >= 224 || s.box.z0 >= 224) && s.box.x0 >= 0 && s.box.z0 >= 0 && s.box.x1 < 288 && s.box.z1 < 288),
        placed: w.gyms.length,
      };
      // 5. Protection data.
      const res = { all: w.gyms.filter(g => !g.home).every(g => g.protect?.length) && !!w.tower.protect?.length, walls: [], outside: [], pads: [] };
      for (const g of w.gyms.filter(g => !g.home)) {
        const wall = g.sky ? w.protectedAt(g.x, g.y - 1, g.z) === g : w.protectedAt(g.x + 6, g.y + 1, g.z + 6) === g;
        const b = g.protect[0];
        const out2 = w.protectedAt(b.x1 + 2, (b.y0 + b.y1) >> 1, g.z) !== g && w.protectedAt(g.x, (b.y0 + b.y1) >> 1, b.z1 + 2) !== g;
        res.walls.push(wall); res.outside.push(out2);
        if (g.sky) {
          const [px, py, pz] = g.pad;
          let free = !w.protectedAt(px, py, pz);
          for (let y = py; y <= g.y - 2; y++) free = free && !w.protectedAt(px, y, pz);
          res.pads.push(free);
        }
      }
      res.tower = w.protectedAt(w.tower.x + 6, w.tower.y + 1, w.tower.z + 6) === w.tower;
      out.prot[seed] = res;
    }
    for (const seed of [1, 4242, 294331207]) {
      const w = new World(seed, null, null); w.generate();
      const [x, z] = w.startColumn();
      out.start[seed] = [x, w.surface(x, z).y + 1, z];
    }
    return out;
  }, { slots: SLOTS, start: START });

  for (const seed of [1, 4242, 777]) {
    const s = r.same[seed];
    t.ok(s.size.join() === '288,368' && s.diff === 0 && s.gdiff === 0, `seed ${seed}: the old 224x224 area is block for block the same as the old map (${s.diff} blocks, ${s.gdiff} heights differ)`);
    t.ok(s.gyms && s.tower && s.caves, `seed ${seed}: no old gym, the tower or cave entrance moved`);
    const m = r.seam[seed];
    t.ok(m.bad === 0 && m.maxStep <= 3, `seed ${seed}: the seam at 224 is plain terrain on both sides (${m.bad} odd columns, biggest step ${m.maxStep})`);
    t.ok(m.biomes >= 3 && m.plants > 20, `seed ${seed}: the new land has ${m.biomes} biomes and ${m.plants} plants`);
    const sl = r.slots[seed];
    t.ok(sl.fixture && sl.same && sl.n === 5 && sl.inside && sl.apart >= 56, `seed ${seed}: 5 gym slots in the new land as always (${JSON.stringify(SLOTS[seed])}), at least ${sl.apart} apart`);
    t.ok(sl.placed === NG, `seed ${seed}: ${NG} gyms are placed (${sl.placed})`);
    const sg = r.slotGyms[seed];
    t.ok(sg.bareGyms === 22 && sg.n === 4 && sg.ids === 'time,camo,cyber,treasure' && sg.protect && sg.k && sg.inBox && sg.outsideDiff === 0,
      `seed ${seed}: the Clock Tower, Hidden Hill and Firewall Maze are in slots 0-2 and the Treasure Vault in slot 4, protected, and change nothing outside their boxes (${sg.outsideDiff} cells differ)`);
    const p = r.prot[seed];
    t.ok(p.all && p.walls.every(Boolean) && p.tower, `seed ${seed}: every gym and the tower have a protected box that holds their walls or island`);
    t.ok(p.outside.every(Boolean), `seed ${seed}: cells 2 outside a box are not protected`);
    t.ok(p.pads.length === 2 && p.pads.every(Boolean), `seed ${seed}: the Cloud and Saucer pads and their pillar columns are not protected`);
  }
  // T32 1-5: the 288 x 288 map inside the 288 x 368 one, treasure spots, the seam at 287 | 288, the south slots, a test-only south gym.
  const q = await page.evaluate(async ({ south, spots }) => {
    const { World, WORLD_H, WATER_LEVEL, PLANTS } = await import('/src/world.js');
    const { B } = await import('/src/blocks.js');
    const { GYMS } = await import('/src/gyms.js');
    const { treasureSpots } = await import('/src/treasuremap.js');
    const out = { same: {}, spots: {}, seam: {}, south: {}, gym: null };
    const seeds = [1, 4242, 777, 294331207];
    for (const seed of seeds) {
      const w = new World(seed, null, null); w.generate();
      const m = new World(seed, null, null, [288, 288]); m.generate();
      const xz = a => JSON.stringify(a.map(s => [s.x, s.z]));
      // 2. Treasure spots: as measured before T32, and the same as on the 288 map.
      out.spots[seed] = { fixture: xz(treasureSpots(w)) === JSON.stringify(spots[seed]), same: xz(treasureSpots(w)) === xz(treasureSpots(m)), got: xz(treasureSpots(w)) };
      // 4. South slots.
      const fresh = new World(seed, null, null).southSlots(), got = w.southSlots(), t17 = w.newLandSlots();
      let apart = 999;
      for (let i = 0; i < got.length; i++) for (let j = i + 1; j < got.length; j++) apart = Math.min(apart, Math.abs(got[i].x - got[j].x));
      const overlap = got.some(a => t17.some(b => !(a.box.x1 < b.box.x0 || b.box.x1 < a.box.x0 || a.box.z1 < b.box.z0 || b.box.z1 < a.box.z0)));
      const boxDist = (x, z, b) => Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1, 0);
      const spotDist = Math.min(...treasureSpots(w).flatMap(s => got.map(g => boxDist(s.x, s.z, g.box))));
      const h = (x, z) => Math.min(w.terrainHeight(x, z), WORLD_H - 10);
      const dry = s => [[0, 0], [6, 6], [-6, 6], [6, -6], [-6, -6]].every(([a, b]) => h(s.x + a, s.z + b) > WATER_LEVEL);
      const dryFlags = got.map(dry);
      out.south[seed] = {
        fixture: xz(got) === JSON.stringify(south[seed]), same: xz(fresh) === xz(got), got: xz(got),
        n: got.length, ks: got.map(s => s.k).join(), all: w.gymSlots().length, apart, overlap, spotDist,
        inside: got.every(s => s.box.z0 >= 290 && s.box.z1 <= w.D - 4 && s.box.x0 >= 3 && s.box.x1 <= w.W - 4),
        dryFirst: dryFlags.every((d, i) => i === 0 || d <= dryFlags[i - 1]),
      };
      if (seed === 294331207) continue; // 1-3 only on the first three seeds (time)
      // 1. The 288 x 288 map is block for block inside the 288 x 368 one.
      let diff = 0, gdiff = 0;
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < 288; z++) for (let x = 0; x < 288; x++) if (w.data[x + 288 * (z + 368 * y)] !== m.data[x + 288 * (z + 288 * y)]) diff++;
      for (let z = 0; z < 288; z++) for (let x = 0; x < 288; x++) if (w.ground[x + 288 * z] !== m.ground[x + 288 * z]) gdiff++;
      const sameSet = (a, b) => a.size === b.size && [...b].every(c => a.has(c));
      out.same[seed] = {
        diff, gdiff, size: [m.W, m.D],
        gyms: w.gyms.filter(g => !(g.slot?.k >= 5)).length === m.gyms.length && w.gyms.every((g, i) => !m.gyms[i] || g.def === m.gyms[i].def && g.x === m.gyms[i].x && g.y === m.gyms[i].y && g.z === m.gyms[i].z),
        tower: w.tower.x === m.tower.x && w.tower.y === m.tower.y && w.tower.z === m.tower.z,
        caves: sameSet(w.caves.opened, m.caves.opened) && sameSet(w.caves.marks, m.caves.marks),
        slots: xz(w.newLandSlots()) === xz(m.newLandSlots()),
        start: w.startColumn().join() === m.startColumn().join(),
      };
      // 3. The seam at 287 | 288: plain terrain on both sides; the strip has biomes and plants.
      const natural = (x, z) => Math.max(Math.min(w.terrainHeight(x, z), WORLD_H - 10), WATER_LEVEL);
      const landTop = (x, z) => { for (let y = WORLD_H - 1; y >= 0; y--) { const id = w.get(x, y, z); if (id !== B.AIR && !PLANTS.has(id) && id !== B.FLOWER_BUSH) return y; } return -1; };
      let bad = 0, maxStep = 0;
      for (let x = 0; x < 288; x++) {
        for (const z of [287, 288]) if (landTop(x, z) !== natural(x, z)) bad++;
        maxStep = Math.max(maxStep, Math.abs(natural(x, 287) - natural(x, 288)));
      }
      const biomes = new Set();
      let plants = 0;
      for (let x = 0; x < 288; x += 2) for (let z = 290; z < 365; z += 2) {
        biomes.add(w.biome(x, z));
        const id = w.get(x, w.surface(x, z).y, z);
        if (PLANTS.has(id) || id === B.FLOWER_BUSH) plants++;
      }
      out.seam[seed] = { bad, maxStep, biomes: biomes.size, plants };
    }
    // 5. A test-only gym in slot 5 (the Boulder Gym's def, a plain surface gym): placed in its slot, protected inside the box,
    // changes nothing outside it, and the 288 x 288 map is still the same.
    const seed = 4242;
    const plain = new World(seed, null, null); plain.generate();
    const def = { ...GYMS[0], id: 'test32', slot: 5 };
    GYMS.push(def);
    let w;
    try { w = new World(seed, null, null); w.generate(); } finally { GYMS.splice(GYMS.indexOf(def), 1); }
    const g = w.gyms.find(x => x.def === def), box = w.southSlots()[0].box;
    let outside = 0, inside = 0;
    for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < w.D; z++) for (let x = 0; x < w.W; x++) {
      if (w.data[x + 288 * (z + 368 * y)] === plain.data[x + 288 * (z + 368 * y)]) continue;
      if (x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1) inside++; else outside++;
    }
    out.gym = {
      found: !!g, at: g && g.x === w.southSlots()[0].x && g.z === w.southSlots()[0].z, k: g?.slot?.k, n: w.gyms.length, inside, outside,
      protect: !!g?.protect?.length && g.protect.every(b => b.x0 >= box.x0 && b.x1 <= box.x1 && b.z0 >= box.z0 && b.z1 <= box.z1),
      protectedHere: g && w.protectedAt(g.x + 6, g.y + 1, g.z + 6) === g,
    };
    return out;
  }, { south: SOUTH, spots: SPOTS });
  for (const seed of [1, 4242, 777]) {
    const s = q.same[seed];
    t.ok(s.size.join() === '288,288' && s.diff === 0 && s.gdiff === 0, `seed ${seed}: the 288x288 map is block for block the same inside the 288x368 one (${s.diff} blocks, ${s.gdiff} heights differ)`);
    t.ok(s.gyms && s.tower && s.caves && s.slots && s.start, `seed ${seed}: no gym, the tower, a cave entrance, a T17 slot or the start moved`);
    const m = q.seam[seed];
    t.ok(m.bad === 0 && m.maxStep <= 3, `seed ${seed}: the seam at 288 is plain terrain on both sides (${m.bad} odd columns, biggest step ${m.maxStep})`);
    t.ok(m.biomes >= 3 && m.plants > 20, `seed ${seed}: the south strip has ${m.biomes} biomes and ${m.plants} plants`);
  }
  for (const seed of [1, 4242, 777, 294331207]) {
    const sp = q.spots[seed];
    t.ok(sp.fixture && sp.same, `seed ${seed}: treasure map spots did not move (${sp.got})`);
    const so = q.south[seed];
    t.ok(so.fixture && so.same && so.n === 5 && so.ks === '5,6,7,8,9' && so.all === 10, `seed ${seed}: 5 south slots (5-9) as always (${so.got})`);
    t.ok(so.inside && so.apart >= 52 && !so.overlap && so.dryFirst, `seed ${seed}: south slot boxes lie in the strip, at least ${so.apart} apart, not on a T17 slot, dry ones first`);
    t.ok(so.spotDist >= 12, `seed ${seed}: south slots stay ${so.spotDist} blocks from every treasure spot`);
  }
  const tg = q.gym;
  t.ok(tg.found && tg.at && tg.k === 5 && tg.n === NG + 1 && tg.protect && tg.protectedHere, `a test-only gym with slot 5 is built in south slot 5 and protected (${JSON.stringify(tg)})`);
  t.ok(tg.inside > 0 && tg.outside === 0, `the slot 5 gym changes ${tg.inside} cells inside its box and ${tg.outside} outside`);
  t.ok(JSON.stringify(r.start) === JSON.stringify(START), `the start point did not move ${JSON.stringify(r.start)}`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 6. In the game: a save from the 224 map with one hole dug into gym 1 and one brick outside it.
  const spots = await (async () => {
    const p = await openGame(browser, base);
    const v = await p.evaluate(async () => {
      const { World } = await import('/src/world.js');
      const w = new World(4242, null, null); w.generate();
      const g = w.gyms[0];
      return { x: g.x, y: g.y, z: g.z, front: g.front };
    });
    await p.context().close();
    return v;
  })();
  const wallX = spots.front[0] ? spots.x : spots.x + 6, wallZ = spots.front[0] ? spots.z + 6 : spots.z, wallY = spots.y + 2;
  const outX = spots.x + 17, outY = 40, outZ = spots.z;
  const idx224 = (x, y, z) => x + 224 * (z + 224 * y);
  const save = {
    seed: 4242, edits: [[idx224(wallX, wallY, wallZ), 0], [idx224(outX, outY, outZ), 11]], pos: [spots.x + 0.5, 50, spots.z + 0.5], yaw: 0, pitch: 0, time: 0.4, size: [224, 224],
    party: [{ uid: 'a', species: 'zapple', level: 8, xp: 307, hp: 20, moves: ['tackle', 'spark'] }],
    box: [], cubes: 7, badges: [], beaten: [], savedAt: 1,
  };
  page = await openGame(browser, base, { setup: seedSave(save) });
  await continueGame(page);
  const loaded = await page.evaluate(([wx, wy, wz, ox, oy, oz]) => {
    const w = window.pokecraft.world;
    return { wall: w.get(wx, wy, wz), brick: w.get(ox, oy, oz), editsHaveWall: w.edits.has(wx + 288 * (wz + 368 * wy)) };
  }, [wallX, wallY, wallZ, outX, outY, outZ]);
  t.ok(loaded.wall !== 0 && !loaded.editsHaveWall, `the hole dug into the gym in the old save was repaired on load (block ${loaded.wall})`);
  t.ok(loaded.brick === 11, 'a brick built outside the gym is still there');

  const play = await page.evaluate(async ([outBrick, wallIdx]) => {
    const g = window.pokecraft, w = g.world;
    const { B } = await import('/src/blocks.js');
    const toasts = [];
    const orig = g.ui.toast.bind(g.ui);
    g.ui.toast = s => { toasts.push(s); orig(s); };
    const wait = () => new Promise(r => setTimeout(r, 2150));
    const out = { cases: [] };
    // A wall block of a gym: a non-air cell of its protected box around the building, at the building's height.
    const findWall = gym => {
      for (let y = gym.y; y <= gym.y + 5; y++) for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) {
        if (Math.abs(a) !== 6 && Math.abs(b) !== 6) continue;
        const x = gym.x + a, z = gym.z + b;
        if (w.get(x, y, z) !== B.AIR && w.protectedAt(x, y, z) === gym) return [x, y, z];
      }
      return null;
    };
    const targets = [];
    const surf = w.gyms.find(x => !x.cave && !x.sky);
    targets.push(['a gym wall', surf, findWall(surf)]);
    targets.push(['the tower wall', w.tower, findWall(w.tower)]);
    const sky = w.gyms.find(x => x.sky && x.def.type === 'sky');
    targets.push(['the Cloud island', sky, [sky.x, sky.y - 1, sky.z]]);
    const cave = w.gyms.find(x => x.cave);
    if (cave) targets.push(['the cave gym wall', cave, findWall(cave)]);
    for (const [name, gym, c] of targets) {
      if (!c) { out.cases.push({ name, found: false }); continue; }
      const [x, y, z] = c, id = w.get(x, y, z);
      toasts.length = 0;
      g.breakBlock({ x, y, z, id, normal: [0, 1, 0] });
      out.cases.push({ name, found: true, kept: w.get(x, y, z) === id, toast: toasts.join('|') });
      await wait();
    }
    // Placing inside: the air above the floor in the middle of a surface gym.
    toasts.length = 0;
    const px = surf.x, py = surf.y, pz = surf.z;
    const before = w.get(px, py, pz);
    g.placeBlock({ x: px, y: py - 1, z: pz, id: w.get(px, py - 1, pz), normal: [0, 1, 0] });
    out.inside = { before, after: w.get(px, py, pz), toast: toasts.join('|') };
    await wait();
    // Outside, 3 blocks past a box edge: build and break work.
    const ox = surf.x + 10, oz = surf.z;
    w.set(ox, 44, oz, B.STONE);
    toasts.length = 0;
    g.placeBlock({ x: ox, y: 44, z: oz, id: B.STONE, normal: [0, 1, 0] });
    const placed = w.get(ox, 45, oz);
    g.breakBlock({ x: ox, y: 45, z: oz, id: placed, normal: [0, 1, 0] });
    out.outside = { placed, broken: w.get(ox, 45, oz), toasts: toasts.length };
    // The Cloud pad: stone from the pad up to the island floor (fy - 1) can be built, block by block.
    const [qx, qy, qz] = sky.pad;
    let built = 0, want = 0;
    for (let y = qy + 1; y <= sky.y - 2; y++) {
      want++;
      g.placeBlock({ x: qx, y: y - 1, z: qz, id: w.get(qx, y - 1, qz), normal: [0, 1, 0] });
      if (w.get(qx, y, qz) !== B.AIR) built++;
    }
    out.pad = { built, want };
    // The save writes the new size and index.
    g.save();
    const saved = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
    out.saved = { size: saved.size, brick: saved.edits.some(([i, id]) => id === 11 && i === (outBrick[0] + 288 * (outBrick[2] + 368 * outBrick[1]))), wall: saved.edits.some(([i]) => i === wallIdx) };
    return out;
  }, [[outX, outY, outZ], wallX + 288 * (wallZ + 368 * wallY)]);
  for (const c of play.cases) {
    t.ok(c.found && c.kept && c.toast === 'Gym walls are too strong to break!', `breaking ${c.name} fails with the toast (${c.found ? `kept ${c.kept}, "${c.toast}"` : 'no wall found'})`);
  }
  t.ok(play.inside.before === 0 && play.inside.after === 0 && play.inside.toast === "You can't build inside a gym!", `placing a block inside a gym fails with the toast ("${play.inside.toast}")`);
  t.ok(play.outside.placed !== 0 && play.outside.broken === 0 && play.outside.toasts === 0, 'next to a gym (outside its box) building and breaking still work');
  t.ok(play.pad.want >= 5 && play.pad.built === play.pad.want, `the Cloud pad pillar can be built all the way up (${play.pad.built} of ${play.pad.want} blocks)`);
  t.ok(JSON.stringify(play.saved.size) === '[288,368]' && play.saved.brick && !play.saved.wall, 'saving stores the new size, the outside brick at its new index and no edit inside the gym');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // T32 6: a save from the 288 x 288 map with a brick near its old south edge; the player can walk into the strip.
  const save288 = {
    seed: 4242, edits: [[150 + 288 * (280 + 288 * 30), 11]], pos: [112.5, 40, 112.5], yaw: 0, pitch: 0, time: 0.4, size: [288, 288],
    party: [{ uid: 'a', species: 'zapple', level: 8, xp: 307, hp: 20, moves: ['tackle', 'spark'] }],
    box: [], cubes: 7, badges: [], beaten: [], savedAt: 1,
  };
  page = await openGame(browser, base, { setup: seedSave(save288) });
  await continueGame(page);
  const s288 = await page.evaluate(() => {
    const g = window.pokecraft, w = g.world;
    const brick = w.get(150, 30, 280);
    g.save();
    const saved = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
    // Stand at the old edge: the old wall at z = 288 is gone, the strip has land, the new wall is at z = 368.
    const y = w.surface(150, 286).y + 1;
    g.player.pos.set(150.5, y, 286.5); g.player.vel.set(0, 0, 0);
    let open = 0;
    for (let z = 287; z <= 292; z++) if (!w.isSolid(150, Math.max(y, w.surface(150, z).y + 1), z)) open++;
    return {
      brick, size: saved.size, idx: saved.edits.some(([i, id]) => id === 11 && i === 150 + 288 * (280 + 368 * 30)),
      open, land: w.surface(150, 330).y > 0 && w.get(150, 1, 330) !== 0, wall: w.isSolid(150, 40, 368) && !w.isSolid(150, 46, 367),
    };
  });
  t.ok(s288.brick === 11 && JSON.stringify(s288.size) === '[288,368]' && s288.idx, `a [288, 288] save keeps its brick at (150, 30, 280) and saves it at the new index (${JSON.stringify(s288)})`);
  t.ok(s288.open === 6 && s288.land && s288.wall, 'past the old south edge there is open land, and the map edge is at z = 368');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 7. Touch: tapping the break button at a gym wall does nothing but show the toast.
  page = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await page.tap('text=New Game');
  await page.tap('.starter >> nth=0');
  await page.waitForFunction(() => window.pokecraft.started, null, { timeout: 30000, polling: 100 });
  await page.evaluate(() => {
    const g = window.pokecraft, w = g.world, gym = w.gyms.find(x => !x.cave && !x.sky);
    window.__toasts = [];
    const orig = g.ui.toast.bind(g.ui);
    g.ui.toast = s => { window.__toasts.push(s); orig(s); };
    // Stand 4 blocks outside the wall opposite the door and look at a wall block.
    const alongX = !!gym.front[0];
    const wx = alongX ? gym.x : gym.x + 6, wz = alongX ? gym.z + 6 : gym.z;
    const sx = alongX ? wx : wx + 4, sz = alongX ? wz + 4 : wz;
    const wy = gym.y + 2;
    window.__wall = [wx, wy, wz, w.get(wx, wy, wz)];
    const feet = Math.max(w.surface(sx, sz).y + 1, gym.y);
    g.player.pos.set(sx + 0.5, feet, sz + 0.5); g.player.vel.set(0, 0, 0);
    g.player.yaw = alongX ? 0 : Math.PI / 2;
    g.player.pitch = Math.atan2(wy + 0.5 - (feet + 1.6), 4);
  });
  let toast = '';
  for (let i = 0; i < 8 && !toast; i++) {
    await page.tap('#btn-break');
    await page.waitForTimeout(2300);
    toast = await page.evaluate(() => window.__toasts.find(s => /too strong/.test(s)) || '');
  }
  const wall = await page.evaluate(() => { const [x, y, z, id] = window.__wall; return window.pokecraft.world.get(x, y, z) === id && id !== 0; });
  t.ok(wall && toast, `tapping Break at a gym wall on a tablet leaves the wall and says "${toast}"`);
  await page.context().close();
}
