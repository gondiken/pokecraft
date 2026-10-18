// T20: treasure blocks (Sunstone, Ruby, Sapphire) you can only mine. They replace a little stone deep under the hills
// and in cave walls (old area and new land, never in a gym), breaking one adds 1 to your count, placing one uses 1,
// the hotbar and the Blocks panel show the count and grey them out at 0, and the counts are saved. Placed gold ore
// never gives Capture Cubes.
import fs from 'node:fs';
import { openGame, newGame, pause, platform, seedSave, continueGame, waitFor } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  let page = await openGame(browser, base);

  // 1. The world: where treasure is, and that it only ever replaced stone.
  const w = await page.evaluate(async () => {
    const { World, OLD_W, OLD_D, WORLD_W: W, WORLD_D: D } = await import('/src/world.js');
    const { B, BLOCKS, TREASURE, MISSION_BLOCKS, PLACEABLE, isLimited } = await import('/src/blocks.js');
    const out = {
      ids: TREASURE.join(), names: TREASURE.map(id => BLOCKS[id].name).join(),
      limited: TREASURE.every(isLimited) && PLACEABLE.filter(isLimited).join() === [...TREASURE, ...MISSION_BLOCKS].join(), // T29: the mission blocks 75-77 are limited too
      others: PLACEABLE.filter(id => !TREASURE.includes(id) && !MISSION_BLOCKS.includes(id)).every(id => !isLimited(id)),
      ownTiles: new Set(TREASURE.map(id => BLOCKS[id].side)).size === 3 && TREASURE.every(id => ![B.GOLD_ORE, B.CRYSTAL].some(o => BLOCKS[o].side === BLOCKS[id].side)),
      seeds: {},
    };
    for (const seed of [1, 4242]) {
      const plain = new World(seed, null, null); plain.generate({ treasure: false });
      const full = new World(seed, null, null); full.generate();
      const r = { kinds: {}, old: 0, newLand: 0, wall: 0, deep: 0, notStone: 0, shallow: 0, inGym: 0, otherDiff: 0 };
      for (let i = 0; i < full.data.length; i++) {
        const a = plain.data[i], b = full.data[i];
        if (!TREASURE.includes(b)) { if (a !== b) r.otherDiff++; continue; }
        const x = i % W, z = Math.floor(i / W) % D, y = Math.floor(i / (W * D));
        r.kinds[b] = (r.kinds[b] || 0) + 1;
        if (x < OLD_W && z < OLD_D) r.old++; else r.newLand++;
        if (a !== B.STONE) r.notStone++;
        if (y > full.ground[x + z * W] - 4) r.shallow++;
        if (full.protectedAt(x, y, z)) r.inGym++;
        if ([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => full.get(x + dx, y + dy, z + dz) === B.AIR)) r.wall++; else r.deep++;
      }
      out.seeds[seed] = r;
    }
    return out;
  });
  t.ok(w.ids === '65,66,67' && w.names === 'Sunstone,Ruby,Sapphire' && w.ownTiles, `three treasure blocks 65-67 (${w.names}) with their own textures`);
  t.ok(w.limited && w.others, 'only the treasure blocks are limited; every other block stays unlimited');
  for (const [seed, r] of Object.entries(w.seeds)) {
    const kinds = Object.values(r.kinds);
    t.ok(kinds.length === 3 && kinds.every(n => n >= 100 && n <= 600), `seed ${seed}: all three kinds are found, rare (${JSON.stringify(r.kinds)})`);
    t.ok(r.old > 200 && r.newLand > 100 && r.wall > 100 && r.deep > 100, `seed ${seed}: in the old area (${r.old}) and the new land (${r.newLand}), in cave walls (${r.wall}) and deep in the rock (${r.deep})`);
    t.ok(r.notStone === 0 && r.shallow === 0 && r.inGym === 0 && r.otherDiff === 0,
      `seed ${seed}: treasure only replaced stone 4+ blocks under the ground, never in a gym, and nothing else changed (${r.notStone}/${r.shallow}/${r.inGym}/${r.otherDiff})`);
  }

  // 2. Mining and placing on a platform high in the air.
  await newGame(page, 0);
  await platform(page, { day: true });
  const m = await page.evaluate(async () => {
    const { B } = await import('/src/blocks.js');
    const g = window.pokecraft, w = g.world, s = g.spawnPoint;
    const x = Math.floor(s.x) + 3, y = 42, z = Math.floor(s.z);
    const toasts = [];
    const toast = g.ui.toast.bind(g.ui);
    g.ui.toast = text => { toasts.push(text); toast(text); };
    const out = { start: g.blockCounts[B.RUBY] || 0 };
    // Placing a Ruby with none: nothing happens, a hint says where to look.
    g.hotbar[0] = B.RUBY; g.selected = 0; g.ui.renderHud();
    const slot = document.querySelector('#hotbar .slot');
    out.emptySlot = { grey: slot.classList.contains('empty'), count: slot.querySelector('.count')?.textContent };
    g.placeBlock({ x, y, z, id: B.STONE, normal: [0, 1, 0] });
    out.noneLeft = { placed: w.get(x, y + 1, z), toast: toasts.join('|') };
    // Two natural rubies in the platform (no edit: like the world's own) and one natural sapphire.
    for (const [dx, id] of [[0, B.RUBY], [1, B.RUBY], [2, B.SAPPHIRE]]) { w.set(x + dx, y, z, id, false); w.edits.delete(w.index(x + dx, y, z)); }
    for (const dx of [0, 1, 2]) g.breakBlock({ x: x + dx, y, z, id: w.get(x + dx, y, z), normal: [0, 1, 0] });
    out.mined = { ruby: g.blockCounts[B.RUBY], sapphire: g.blockCounts[B.SAPPHIRE], sunstone: g.blockCounts[B.SUNSTONE] || 0, air: w.get(x, y, z) === B.AIR, toast: toasts.at(-1) };
    out.fullSlot = { grey: slot.classList.contains('empty'), count: slot.querySelector('.count')?.textContent };
    // Placing uses one; breaking a placed one gives it back.
    w.set(x, y, z, B.STONE);
    g.placeBlock({ x, y, z, id: B.STONE, normal: [0, 1, 0] });
    out.placed = { id: w.get(x, y + 1, z), ruby: g.blockCounts[B.RUBY] };
    g.placeBlock({ x, y: y + 1, z, id: B.RUBY, normal: [0, 1, 0] });
    out.placed2 = { id: w.get(x, y + 2, z), ruby: g.blockCounts[B.RUBY], grey: slot.classList.contains('empty') };
    toasts.length = 0;
    g.placeBlock({ x, y: y + 2, z, id: B.RUBY, normal: [0, 1, 0] });
    out.third = { id: w.get(x, y + 3, z), ruby: g.blockCounts[B.RUBY], toast: toasts.join('|') };
    g.breakBlock({ x, y: y + 2, z, id: B.RUBY, normal: [0, 1, 0] });
    out.back = g.blockCounts[B.RUBY];
    // 3. Placed gold ore never gives a Capture Cube (natural gold sometimes does).
    const cubes = g.cubes;
    const real = Math.random;
    Math.random = () => 0; // the luckiest break there is
    g.hotbar[1] = B.GOLD_ORE; g.selected = 1;
    let golds = 0;
    for (let i = 0; i < 6; i++) {
      g.placeBlock({ x: x + 4, y, z, id: B.STONE, normal: [0, 1, 0] });
      if (w.get(x + 4, y + 1, z) === B.GOLD_ORE) golds++;
      g.breakBlock({ x: x + 4, y: y + 1, z, id: w.get(x + 4, y + 1, z), normal: [0, 1, 0] });
    }
    out.placedGold = { golds, cubes: g.cubes - cubes };
    w.set(x + 5, y, z, B.GOLD_ORE, false); w.edits.delete(w.index(x + 5, y, z));
    g.breakBlock({ x: x + 5, y, z, id: B.GOLD_ORE, normal: [0, 1, 0] });
    out.naturalGold = g.cubes - cubes;
    // Placed leaves don't either.
    w.set(x + 6, y + 1, z, B.LEAVES);
    g.breakBlock({ x: x + 6, y: y + 1, z, id: B.LEAVES, normal: [0, 1, 0] });
    out.placedLeaves = g.cubes - cubes;
    Math.random = real;
    g.selected = 0; g.ui.renderHud();
    w.updateDirty();
    return out;
  });
  t.ok(m.start === 0 && m.emptySlot.grey && m.emptySlot.count === '×0', `a new game has no rubies: the hotbar slot is grey and says ${m.emptySlot.count}`);
  t.ok(m.noneLeft.placed === 0 && /No Ruby left!.*break one you placed/.test(m.noneLeft.toast), `placing a Ruby with none does nothing ("${m.noneLeft.toast}")`);
  t.ok(m.mined.ruby === 2 && m.mined.sapphire === 1 && m.mined.sunstone === 0 && m.mined.air && /Sapphire/.test(m.mined.toast),
    `mining adds 1 each (rubies ${m.mined.ruby}, sapphires ${m.mined.sapphire}; "${m.mined.toast}")`);
  t.ok(!m.fullSlot.grey && m.fullSlot.count === '×2', `the hotbar slot lights up and says ${m.fullSlot.count}`);
  t.ok(m.placed.id === 66 && m.placed.ruby === 1 && m.placed2.id === 66 && m.placed2.ruby === 0 && m.placed2.grey, 'placing uses 1 each time, down to 0 (grey again)');
  t.ok(m.third.id === 0 && m.third.ruby === 0, 'at 0 you can\'t place any more (the hint toast shows at most every 2 seconds)');
  t.ok(m.back === 1, 'breaking a placed Ruby gives it back');
  t.ok(m.placedGold.golds === 6 && m.placedGold.cubes === 0, `placing and breaking gold ore 6 times gives no Capture Cubes (${m.placedGold.cubes})`);
  t.ok(m.naturalGold === 1, 'natural gold ore can still hide a Capture Cube');
  t.ok(m.placedLeaves === 1, 'placed leaves give no Capture Cubes either');

  // 4. The Blocks panel: counts, greyed at 0.
  await pause(page);
  await page.keyboard.press('b');
  await waitFor(page, () => !document.getElementById('blocks').classList.contains('hidden'));
  const panel = await page.evaluate(() => [...document.querySelectorAll('#block-list button')]
    .filter(b => /Sunstone|Ruby|Sapphire/.test(b.textContent)).map(b => [b.textContent, b.classList.contains('empty')]));
  t.ok(JSON.stringify(panel) === JSON.stringify([['Sunstone ×0', true], ['Ruby ×1', false], ['Sapphire ×1', false]]), `the Blocks panel shows the counts (${panel.map(([text, grey]) => text + (grey ? ' grey' : '')).join(', ')})`);
  await page.screenshot({ path: SHOTS + 't20-blocks-panel.png', timeout: 180000 });
  await page.keyboard.press('b');

  // 5. Saved and loaded.
  const saved = await page.evaluate(() => { window.pokecraft.save(); return JSON.parse(localStorage.getItem('pokecraft-save-v2')); });
  t.ok(JSON.stringify(saved.blockCounts) === JSON.stringify({ 66: 1, 67: 1 }) || JSON.stringify(saved.blockCounts) === JSON.stringify({ 65: 0, 66: 1, 67: 1 }),
    `the save has the counts (${JSON.stringify(saved.blockCounts)})`);
  await page.context().close();
  page = await openGame(browser, base, { setup: seedSave({ ...saved, blockCounts: { ...saved.blockCounts, 65: 4, 3: 9, 66: -2, 99: 1 } }) });
  await continueGame(page);
  const loaded = await page.evaluate(() => ({ ...window.pokecraft.blockCounts }));
  t.ok(JSON.stringify(loaded) === JSON.stringify({ 65: 4, 67: 1 }), `loading keeps good counts and drops bad ones (${JSON.stringify(loaded)})`);
  await page.context().close();
  // An old save has none.
  page = await openGame(browser, base, { setup: seedSave({ ...saved, blockCounts: undefined }) });
  await continueGame(page);
  t.ok(await page.evaluate(() => Object.keys(window.pokecraft.blockCounts).length === 0), 'an old save starts with no treasure');

  // 6. A look at all three in a little cave-like wall (screenshot).
  await platform(page, { day: true });
  await page.evaluate(async () => {
    const { B } = await import('/src/blocks.js');
    const g = window.pokecraft, w = g.world, s = g.spawnPoint;
    const x0 = Math.floor(s.x), z0 = Math.floor(s.z) + 4;
    for (let dx = -2; dx <= 4; dx++) for (let dy = 0; dy < 4; dy++) w.set(x0 + dx, 43 + dy, z0, B.STONE);
    w.set(x0 - 1, 44, z0, B.SUNSTONE); w.set(x0 + 1, 45, z0, B.RUBY); w.set(x0 + 3, 44, z0, B.SAPPHIRE); w.set(x0 + 1, 43, z0, B.GOLD_ORE);
    g.player.yaw = Math.PI; g.player.pitch = -0.1;
    for (const k of ['Sunstone', 'Ruby', 'Sapphire']) g.blockCounts[B[k.toUpperCase()]] = 3;
    g.hotbar[0] = B.SUNSTONE; g.hotbar[1] = B.RUBY; g.hotbar[2] = B.SAPPHIRE; g.ui.renderHud();
    w.updateDirty();
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOTS + 't20-treasure.png', timeout: 180000 });
  t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
  await page.context().close();
}
