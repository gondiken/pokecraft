// T17: the 288 x 288 map (old 224 x 224 area unchanged, a natural seam, the start point where it was, five
// reserved gym slots in the new land) and gyms that can't be broken into or built in.
import { devices } from 'playwright';
import { openGame, seedSave, continueGame, click } from '../helpers.mjs';

// newLandSlots() for three seeds (x, z), nearest the start first. They must never change.
const SLOTS = {
  1: [[136, 248], [80, 248], [260, 132], [260, 48], [192, 252]],
  4242: [[84, 248], [140, 248], [28, 248], [248, 204], [252, 260]],
  777: [[248, 92], [144, 248], [252, 152], [248, 28], [248, 248]],
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
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < 224; z++) for (let x = 0; x < 224; x++) if (w.data[x + 288 * (z + 288 * y)] !== o.data[x + 224 * (z + 224 * y)]) diff++;
      for (let z = 0; z < 224; z++) for (let x = 0; x < 224; x++) if (w.ground[x + 288 * z] !== o.ground[x + 224 * z]) gdiff++;
      const remap = c => (c % 224) + Math.floor(c / 224) * 288;
      const sameSet = (a, b) => a.size === b.size && [...b].every(c => a.has(remap(c)));
      out.same[seed] = {
        diff, gdiff, size: [w.W, w.D],
        gyms: w.gyms.length === o.gyms.length + 3 && w.gyms.slice(0, o.gyms.length).every((g, i) => g.def === o.gyms[i].def && g.x === o.gyms[i].x && g.y === o.gyms[i].y && g.z === o.gyms[i].z),
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
      const boxes = got.slice(0, 3).map(s => s.box);
      let outsideDiff = 0;
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < 288; z++) for (let x = 0; x < 288; x++) {
        if (boxes.some(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1)) continue;
        if (w.get(x, y, z) !== bare.get(x, y, z)) outsideDiff++;
      }
      const slotGyms = w.gyms.filter(g => g.slot);
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
      const res = { all: w.gyms.every(g => g.protect?.length) && !!w.tower.protect?.length, walls: [], outside: [], pads: [] };
      for (const g of w.gyms) {
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
    t.ok(s.size.join() === '288,288' && s.diff === 0 && s.gdiff === 0, `seed ${seed}: the old 224x224 area is block for block the same as the old map (${s.diff} blocks, ${s.gdiff} heights differ)`);
    t.ok(s.gyms && s.tower && s.caves, `seed ${seed}: no old gym, the tower or cave entrance moved`);
    const m = r.seam[seed];
    t.ok(m.bad === 0 && m.maxStep <= 3, `seed ${seed}: the seam at 224 is plain terrain on both sides (${m.bad} odd columns, biggest step ${m.maxStep})`);
    t.ok(m.biomes >= 3 && m.plants > 20, `seed ${seed}: the new land has ${m.biomes} biomes and ${m.plants} plants`);
    const sl = r.slots[seed];
    t.ok(sl.fixture && sl.same && sl.n === 5 && sl.inside && sl.apart >= 56, `seed ${seed}: 5 gym slots in the new land as always (${JSON.stringify(SLOTS[seed])}), at least ${sl.apart} apart`);
    t.ok(sl.placed === 25, `seed ${seed}: 25 gyms are placed (${sl.placed})`);
    const sg = r.slotGyms[seed];
    t.ok(sg.bareGyms === 22 && sg.n === 3 && sg.ids === 'time,camo,cyber' && sg.protect && sg.k && sg.inBox && sg.outsideDiff === 0,
      `seed ${seed}: the Clock Tower, Hidden Hill and Firewall Maze are in slots 0-2, protected, and change nothing outside their boxes (${sg.outsideDiff} cells differ)`);
    const p = r.prot[seed];
    t.ok(p.all && p.walls.every(Boolean) && p.tower, `seed ${seed}: every gym and the tower have a protected box that holds their walls or island`);
    t.ok(p.outside.every(Boolean), `seed ${seed}: cells 2 outside a box are not protected`);
    t.ok(p.pads.length === 2 && p.pads.every(Boolean), `seed ${seed}: the Cloud and Saucer pads and their pillar columns are not protected`);
  }
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
    return { wall: w.get(wx, wy, wz), brick: w.get(ox, oy, oz), editsHaveWall: w.edits.has(wx + 288 * (wz + 288 * wy)) };
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
    out.saved = { size: saved.size, brick: saved.edits.some(([i, id]) => id === 11 && i === (outBrick[0] + 288 * (outBrick[2] + 288 * outBrick[1]))), wall: saved.edits.some(([i]) => i === wallIdx) };
    return out;
  }, [[outX, outY, outZ], wallX + 288 * (wallZ + 288 * wallY)]);
  for (const c of play.cases) {
    t.ok(c.found && c.kept && c.toast === 'Gym walls are too strong to break!', `breaking ${c.name} fails with the toast (${c.found ? `kept ${c.kept}, "${c.toast}"` : 'no wall found'})`);
  }
  t.ok(play.inside.before === 0 && play.inside.after === 0 && play.inside.toast === "You can't build inside a gym!", `placing a block inside a gym fails with the toast ("${play.inside.toast}")`);
  t.ok(play.outside.placed !== 0 && play.outside.broken === 0 && play.outside.toasts === 0, 'next to a gym (outside its box) building and breaking still work');
  t.ok(play.pad.want >= 5 && play.pad.built === play.pad.want, `the Cloud pad pillar can be built all the way up (${play.pad.built} of ${play.pad.want} blocks)`);
  t.ok(JSON.stringify(play.saved.size) === '[288,288]' && play.saved.brick && !play.saved.wall, 'saving stores the new size, the outside brick at its new index and no edit inside the gym');
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
