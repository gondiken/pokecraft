// More block types, new biomes, creatures living where they fit, and the Blocks panel.
import { openGame, newGame, pause, click } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  const r = await page.evaluate(async () => {
    const { B, BLOCKS, PLACEABLE, TILE_COUNT, WOOL, isSolid, T } = await import('/src/blocks.js');
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
      gymBlocks: ['LASER_RED', 'LASER_BLUE', 'LASER_FRIEND', 'SWITCH_RED', 'SWITCH_BLUE', 'FRIEND_PAD', 'RESET_BUTTON', 'CLOCK_DOOR'].map((k, i) => ({
        id: B[k] === 57 + i, def: !!BLOCKS[B[k]], placeable: PLACEABLE.includes(B[k]), tiles: ['top', 'side', 'bottom'].every(f => BLOCKS[B[k]][f] < TILE_COUNT),
        noLight: !!BLOCKS[B[k]].noLight, glow: !!BLOCKS[B[k]].glow, wallText: !!BLOCKS[B[k]].wallText })),
      vault: ['KEY_CHEST', 'VAULT_DOOR'].map((k, i) => ({ id: B[k] === 73 + i, def: !!BLOCKS[B[k]], placeable: PLACEABLE.includes(B[k]), limited: !!BLOCKS[B[k]].limited, tiles: ['top', 'side', 'bottom'].every(f => BLOCKS[B[k]][f] < TILE_COUNT), wallText: !!BLOCKS[B[k]].wallText })),
      restaurant: ['POT', 'POT_GOLDEN', 'POT_BURNT', 'STOVE'].map((k, i) => ({ id: B[k] === 83 + i, def: !!BLOCKS[B[k]], placeable: PLACEABLE.includes(B[k]), limited: !!BLOCKS[B[k]].limited, tiles: ['top', 'side', 'bottom'].every(f => BLOCKS[B[k]][f] < TILE_COUNT), wallText: !!BLOCKS[B[k]].wallText })), // T33
      dream: [['BOUNCE', 87], ['DREAM_GRASS', 88]].map(([k, n]) => ({ id: B[k] === n, def: !!BLOCKS[B[k]], placeable: PLACEABLE.includes(B[k]), tiles: ['top', 'side', 'bottom'].every(f => BLOCKS[B[k]][f] < TILE_COUNT), bounce: BLOCKS[B[k]].bounce, fixed: !!BLOCKS[B[k]].fixed, wallText: !!BLOCKS[B[k]].wallText, glow: !!BLOCKS[B[k]].glow, noLight: !!BLOCKS[B[k]].noLight })),
      course: [['CRUMBLE', 89], ['CRUMBLE_SHAKE', 90], ['BLINK', 95], ['BLINK_WARN', 96], ['ZAP_OFF', 97], ['ZAP_WARN', 98], ['ZAP_ON', 99], ['PUSHER', 100], ['PUSHER_WARN', 101], ['PUSHER_HEAD', 102], ['SPRING', 103], ['EXIT_PAD', 104]].map(([k, n]) => ({ k, id: B[k] === n, def: !!BLOCKS[B[k]], placeable: PLACEABLE.includes(B[k]), tiles: ['top', 'side', 'bottom'].every(f => BLOCKS[B[k]][f] < TILE_COUNT), bounce: BLOCKS[B[k]].bounce, wallText: !!BLOCKS[B[k]].wallText, glow: !!BLOCKS[B[k]].glow, noLight: !!BLOCKS[B[k]].noLight, solid: isSolid(B[k]) })), // T36.5
      wool: ['sky', 'slime', 'light', 'paper'].map(k => [WOOL[k], BLOCKS[WOOL[k]]?.name]),
      woolIds: new Set(Object.values(WOOL)).size === Object.keys(WOOL).length && Object.values(WOOL).every(id => id < 40 || (id >= 49 && id <= 52) || (id >= 54 && id <= 56) || (id >= 68 && id <= 69) || (id >= 79 && id <= 82) || id === 113 || (id >= 140 && id <= 143)),
      dojo: [['NIGHTINGALE', 114], ['TATAMI', 115], ['SHOJI', 116], ['BARREL', 117], ['TALL_GRASS', 118], ['PAPER_LANTERN', 119], ['STONE_LANTERN', 120], ['STONE_LANTERN_ON', 121], ['LANTERN_LIGHT', 122], ['MAPLE_LEAVES', 123]].map(([k, n]) => ({ k, id: B[k] === n, def: !!BLOCKS[B[k]], placeable: PLACEABLE.includes(B[k]), tiles: ['top', 'side', 'bottom'].every(f => BLOCKS[B[k]][f] < TILE_COUNT), wallText: !!BLOCKS[B[k]].wallText, glow: !!BLOCKS[B[k]].glow, noLight: !!BLOCKS[B[k]].noLight, solid: isSolid(B[k]) })), // T37b
      looks: { adjacent: T.SWIRL_CLOUD === T.SWIRL_PAINT + 1 && T.SWIRL_STONE === T.SWIRL_STONE_TOP + 1, defs: [['SWIRL_PAINT', 132], ['SWIRL_CLOUD', 133], ['GLOW_PUFF', 134], ['GLOW_PUFF_MINT', 135], ['BRISTLE', 136]].map(([k, n]) => ({ k, id: B[k] === n, placeable: PLACEABLE.includes(B[k]), tiles: ['top', 'side', 'bottom'].every(f => BLOCKS[B[k]][f] < TILE_COUNT), wallText: !!BLOCKS[B[k]].wallText, fixed: !!BLOCKS[B[k]].fixed, glow: !!BLOCKS[B[k]].glow, noLight: !!BLOCKS[B[k]].noLight })) }, // T38d
      swirl: [['PORTAL_DIM', 124], ['PORTAL', 125], ['PORTAL_FRAME', 126], ['SWIRL_STONE', 127], ['PICTURE_FRAME', 128], ['CLOTH', 129], ['STAR_STONE', 130], ['WIZARD_STONE', 131]].map(([k, n]) => ({ k, id: B[k] === n, def: !!BLOCKS[B[k]], placeable: PLACEABLE.includes(B[k]), tiles: ['top', 'side', 'bottom'].every(f => BLOCKS[B[k]][f] < TILE_COUNT), wallText: !!BLOCKS[B[k]].wallText, glow: !!BLOCKS[B[k]].glow, noLight: !!BLOCKS[B[k]].noLight, fixed: !!BLOCKS[B[k]].fixed, solid: isSolid(B[k]) })), // T38a
      nextFree: Math.max(...Object.values(B)) + 1,
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
  // Wave 14.5: the atlas is a grid. Every corner's uv leads back to its own tile (the Swirl tint's shader formula), the canvas is the
  // grid's size, and a whole row of tiles more still fits in a 32 x 32 grid (512 x 512 px).
  const atlas = await page.evaluate(async () => {
    const Bk = await import('/src/blocks.js'), c = Bk.drawAtlas(), uv = [];
    let wrong = 0;
    for (let t = 0; t < Bk.TILE_COUNT; t++) for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      uv.length = 0; Bk.tileUv(uv, t, u, v);
      const back = Math.floor(uv[0] * Bk.ATLAS_COLS) + Math.floor((1 - uv[1]) * Bk.ATLAS_ROWS) * Bk.ATLAS_COLS;
      const px = [Bk.tileX(t) + (u ? 15.9 : 0.1), (1 - uv[1]) * c.height]; // the texel the corner samples, in canvas pixels
      if (back !== t || Math.floor(px[0] / 16) !== t % Bk.ATLAS_COLS || Math.floor(px[1] / 16) !== Math.floor(t / Bk.ATLAS_COLS)) wrong++;
      if (Bk.tileGlY(t) !== c.height - 16 - Bk.tileY(t)) wrong++;
    }
    return { wrong, w: c.width, h: c.height, rows: Bk.ATLAS_ROWS, cols: Bk.ATLAS_COLS, n: Bk.TILE_COUNT };
  });
  t.ok(atlas.wrong === 0 && atlas.w === atlas.cols * 16 && atlas.h === atlas.rows * 16 && atlas.rows <= 31, `the block atlas is a ${atlas.cols} x ${atlas.rows} grid (${atlas.w} x ${atlas.h} px, ${atlas.n} of 1024 tiles) and every tile corner finds its own tile`);
  t.ok(r.cloud, 'Cloud blocks (53) can be built with');
  t.ok(r.gymBlocks.every(b => b.id && b.def && !b.placeable && b.tiles), 'the T19 gym blocks 57-64 exist, have tiles and cannot be built with');
  t.ok(r.gymBlocks.slice(0, 3).every(b => b.glow && b.noLight && b.wallText) && r.gymBlocks[7].wallText, 'lasers glow without lighting their surroundings; lasers and the clock door have a wall text');
  t.ok(r.vault.every(b => b.id && b.def && !b.placeable && !b.limited && b.tiles && b.wallText), 'the T23 vault blocks 73-74 exist, have tiles and a wall text, and cannot be built with');
  t.ok(r.restaurant.every(b => b.id && b.def && !b.placeable && !b.limited && b.tiles && b.wallText), 'the T33 Restaurant blocks 83-86 exist, have tiles and a wall text, and cannot be built with');
  t.ok(r.dream.every(b => b.id && b.def && !b.placeable && b.tiles) && r.dream[0].bounce === 14 && r.dream[0].fixed && r.dream[0].wallText && r.dream[0].glow && r.dream[0].noLight && !r.dream[1].fixed && !r.dream[1].bounce, 'the T35 blocks 87 (Bounce Block: bounce 14, fixed, wall text, glows without lighting) and 88 (Dream Grass) exist, have tiles and cannot be built with');
  const cb = k => r.course.find(c => c.k === k);
  t.ok(r.course.every(b => b.id && b.def && !b.placeable && b.tiles && b.wallText && b.solid), 'the T36.5 course blocks 89-90 and 95-104 exist, have tiles and a wall text, and cannot be built with');
  t.ok(cb('SPRING').bounce === 4 && ['BLINK', 'BLINK_WARN', 'ZAP_WARN', 'ZAP_ON', 'PUSHER_WARN', 'SPRING', 'EXIT_PAD'].every(k => cb(k).glow && cb(k).noLight) && ['CRUMBLE', 'CRUMBLE_SHAKE', 'ZAP_OFF', 'PUSHER', 'PUSHER_HEAD'].every(k => !cb(k).glow && !cb(k).bounce), 'the spring bounces 4 blocks; the flashing course blocks glow without lighting their surroundings');
  const db = k => r.dojo.find(c => c.k === k);
  t.ok(r.dojo.every(b => b.id && b.def && !b.placeable && b.tiles && b.wallText && b.solid) && r.nextFree >= 147 && r.nextFree <= 204, `the T37b Shadow Dojo blocks 114-123 exist, have tiles and a wall text, and cannot be built with (next free id ${r.nextFree})`);
  t.ok(['STONE_LANTERN_ON', 'LANTERN_LIGHT'].every(k => db(k).glow && db(k).noLight) && db('PAPER_LANTERN').glow && !db('PAPER_LANTERN').noLight && !db('NIGHTINGALE').glow, 'paper lanterns light the garden; the lit stone lantern and the lantern light glow without lighting their surroundings');
  const sw = k => r.swirl.find(c => c.k === k);
  t.ok(r.swirl.every(b => b.id && b.def && !b.placeable && b.tiles && b.wallText && b.solid) && r.swirl.slice(1).every(b => b.fixed) && !sw('PORTAL_DIM').fixed, 'the T38a Portal Door and Swirl blocks 124-131 exist, have tiles and a wall text, cannot be built with; 125-131 cannot be broken');
  t.ok(r.looks.adjacent && r.looks.defs.every(b => b.id && !b.placeable && b.tiles && b.wallText && b.fixed), 'the T38d Swirl looks 132-136 exist with tiles, cannot be built with or broken; Swirl Paint and Cloud (and the stone top and side) tiles sit side by side for the tint range');
  t.ok(r.looks.defs.filter(b => b.k.startsWith('GLOW')).every(b => b.glow && !b.noLight) && !r.looks.defs.find(b => b.k === 'SWIRL_CLOUD').glow, 'Glow Puffs glow and light their surroundings (not noLight)');
  t.ok(['PORTAL', 'PORTAL_FRAME', 'STAR_STONE'].every(k => sw(k).glow && sw(k).noLight) && !sw('PORTAL_DIM').glow && !sw('SWIRL_STONE').glow, 'the Portal Door, its frame and the star stones glow without lighting their surroundings; the dim door and the Swirl Stone do not glow');
  t.ok(JSON.stringify(r.wool) ===JSON.stringify([[49, 'Sky Wool'], [50, 'Slime Wool'], [51, 'Light Wool'], [52, 'Paper Wool']]) && r.woolIds,
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
