// More block types, new biomes, creatures living where they fit, and the Blocks panel.
import { openGame, newGame, pause, click } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  const r = await page.evaluate(async () => {
    const { B, BLOCKS, PLACEABLE, TILE_COUNT, WOOL, isSolid } = await import('/src/blocks.js');
    const { World } = await import('/src/world.js');
    const { SPAWNS, SPECIES } = await import('/src/species.js');
    const tiles = PLACEABLE.every(id => BLOCKS[id] && ['top', 'side', 'bottom'].every(k => BLOCKS[id][k] < TILE_COUNT));
    // What the worlds look like, over a few seeds.
    const biomes = new Set(), found = new Set();
    for (const seed of [11, 222, 3333]) {
      const w = new World(seed, null, null);
      w.generate();
      for (let x = 0; x < 224; x += 2) for (let z = 0; z < 224; z += 2) {
        biomes.add(w.biome(x, z));
        for (let y = 0; y < 48; y++) found.add(w.get(x, y, z));
      }
    }
    const natural = ['ICE', 'GRAVEL', 'SANDSTONE', 'CACTUS', 'MUD', 'PINE_LOG', 'PINE_LEAVES', 'FLOWER_BUSH', 'CRYSTAL', 'COAL_ORE', 'GOLD_ORE'];
    const where = type => Object.entries(SPAWNS).flatMap(([b, l]) => l.filter(e => SPECIES[e[0]].type === type).map(e => [b, e[2]]));
    return {
      count: PLACEABLE.length, tiles,
      cloud: B.CLOUD === 53 && PLACEABLE.includes(B.CLOUD) && BLOCKS[B.CLOUD].name === 'Cloud' && isSolid(B.CLOUD),
      wool: ['sky', 'slime', 'light', 'paper'].map(k => [WOOL[k], BLOCKS[WOOL[k]]?.name]),
      woolIds: new Set(Object.values(WOOL)).size === Object.keys(WOOL).length && Object.values(WOOL).every(id => id < 40 || (id >= 49 && id <= 52) || (id >= 54 && id <= 56)),
      biomes: [...biomes].sort(),
      missing: natural.filter(n => !found.has(B[n])),
      iceOk: where('ice').every(([b]) => ['snow', 'taiga', 'peak'].includes(b)),
      cosmicOk: where('cosmic').every(([, when]) => when === 'night'),
      cosmicHigh: where('cosmic').filter(([b]) => ['peak', 'mountain', 'snow'].includes(b)).length,
      toxicSwamp: where('toxic').filter(([b]) => b === 'swamp').length,
      tables: Object.keys(SPAWNS).filter(b => !['day', 'night'].every(time => SPAWNS[b].some(e => !e[2] || e[2] === time))),
    };
  });
  t.ok(r.count >= 24 && r.tiles, `${r.count} blocks to build with, each with its own textures`);
  t.ok(r.cloud, 'Cloud blocks (53) can be built with');
  t.ok(JSON.stringify(r.wool) === JSON.stringify([[49, 'Sky Wool'], [50, 'Slime Wool'], [51, 'Light Wool'], [52, 'Paper Wool']]) && r.woolIds,
    `the four new wool blocks are 49-52 and have names (${r.wool.map(w => w.join(' ')).join(', ')})`);
  const want = ['beach', 'desert', 'forest', 'meadow', 'mountain', 'peak', 'plains', 'snow', 'swamp', 'taiga'];
  t.ok(want.every(b => r.biomes.includes(b)), `worlds have all the biomes (${r.biomes.join(', ')})`);
  t.ok(!r.missing.length, `natural blocks appear in the world (cacti, pines, ice, crystals, ores...) ${r.missing.join(', ')}`);
  t.ok(r.iceOk, 'ice creatures only live in snowy places');
  t.ok(r.cosmicOk && r.cosmicHigh >= 3, 'cosmic creatures come out at night, many of them up high');
  t.ok(r.toxicSwamp >= 3, 'toxic creatures live in swamps');
  t.ok(!r.tables.length, `every biome has creatures by day and by night ${r.tables.join(', ')}`);

  // Spawning works in every biome.
  await newGame(page, 0);
  const spawned = await page.evaluate(() => {
    const g = window.pokecraft, cm = g.creatures;
    const out = {};
    for (const b of ['plains', 'meadow', 'forest', 'swamp', 'beach', 'water', 'desert', 'mountain', 'snow', 'taiga', 'peak']) {
      for (const night of [false, true]) out[`${b}/${night ? 'night' : 'day'}`] = cm.pickSpecies(b, night);
    }
    return out;
  });
  t.ok(Object.values(spawned).every(Boolean), 'a creature can spawn in every biome, day and night');

  // Standing still on the highest peak from day into night: night creatures (cosmic ones) must
  // show up, and day-only creatures must leave (they used to stay forever, blocking new ones).
  const night = await page.evaluate(() => {
    const g = window.pokecraft, w = g.world, cm = g.creatures;
    let best = null, peaks = 0, n = 0;
    for (let x = 20; x < 204; x += 2) for (let z = 20; z < 204; z += 2) {
      const h = w.terrainHeight(x, z);
      n++; if (w.biome(x, z) === 'peak') peaks++;
      if ((!best || h > best.h) && !w.gyms.some(gy => Math.hypot(gy.x - x, gy.z - z) < 20)) best = { x, z, h };
    }
    g.player.pos.set(best.x + 0.5, w.surface(best.x, best.z).y + 1, best.z + 0.5);
    // Set the clock too (noon, then midnight): a new game starts in the sunrise window, where
    // dawn-only Time creatures would take some of the 16 places.
    g.time = 0.25;
    for (let i = 0; i < 1800; i++) cm.update(0.1, g.player.pos, g.spawnPoint, false);
    g.time = 0.75;
    for (let i = 0; i < 1800; i++) cm.update(0.1, g.player.pos, g.spawnPoint, true);
    return {
      cosmic: cm.list.filter(c => c.species.type === 'cosmic').length,
      dayOnly: cm.list.filter(c => c.when === 'day' && c.pos.distanceTo(g.player.pos) > 10).length,
      peakShare: peaks / n,
    };
  });
  t.ok(night.cosmic >= 1, `after dark on a peak, cosmic creatures appear (${night.cosmic} of 16)`);
  t.ok(night.dayOnly === 0, 'day-only creatures leave when night falls');
  t.ok(night.peakShare > 0.015, `peaks are a few percent of this map (${(night.peakShare * 100).toFixed(1)}%)`);

  // The Blocks panel: B opens it, picking a block puts it in the selected hotbar slot.
  await pause(page);
  await page.keyboard.press('b');
  await page.waitForTimeout(500);
  t.ok(await page.evaluate(() => !document.getElementById('blocks').classList.contains('hidden')), 'B opens the Blocks panel');
  await click(page, '#block-list button:has-text("Ice")');
  await page.waitForTimeout(500);
  const after = await page.evaluate(async () => {
    const { B } = await import('/src/blocks.js');
    const g = window.pokecraft;
    return { slot: g.hotbar[0] === B.ICE, closed: document.getElementById('blocks').classList.contains('hidden'), title: document.querySelector('#hotbar .slot').title };
  });
  t.ok(after.slot && after.closed && after.title === 'Ice', 'picking Ice puts it in hotbar slot 1 and closes the panel');

  // Placing it, and lamps glowing at night.
  const placed = await page.evaluate(async () => {
    const { B } = await import('/src/blocks.js');
    const g = window.pokecraft, w = g.world, s = g.spawnPoint;
    const x = Math.floor(s.x) + 3, z = Math.floor(s.z), y = w.surface(x, z).y + 1;
    w.set(x, y, z, B.LAMP);
    w.updateDirty();
    const glowing = [...w.meshes.get(`${x >> 4},${z >> 4}`)].some(m => m.material.color && !m.material.alphaTest && !m.material.transparent);
    g.time = 0.75; // night
    // The glow material is never dimmed; everything else is dimmed by caveLight.uLit (see caves.js).
    // Wait for the game loop to draw a night frame (slow under load).
    const { caveLight } = await import('/src/caves.js');
    for (let i = 0; i < 120 && caveLight.uLit.value >= 0.6; i++) await new Promise(r => setTimeout(r, 500));
    return { glowing, bright: w.materials.glow.color.r, dim: caveLight.uLit.value };
  });
  t.ok(placed.glowing && placed.bright === 1 && placed.dim < 0.6, `lamps stay bright at night while the rest gets darker (${placed.bright} vs ${placed.dim.toFixed(2)})`);
  await pause(page); // pausing saves
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')).hotbar);
  t.ok(Array.isArray(saved) && saved[0] === 12, 'the chosen hotbar is saved');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
