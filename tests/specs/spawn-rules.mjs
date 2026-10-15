// T18: how creatures are found. Spawn conditions as data (dawn, dusk, together), Time creatures only in the
// golden hour, Camo creatures that are a block (blink, battle when hit, never move, never change the world),
// Cyber creatures only with a second player close by (two browsers). Screenshots go to tests/screenshots/.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, openPair, newGame, click, pause, waitFor, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

// Build things high in the air so the terrain, trees and people are never in the way.
const setup = page => page.evaluate(async () => {
  const g = window.pokecraft;
  g.weather.set('clear');
  g.time = 0.25;
  g.creatures.clear();
  g.creatures.spawnTimer = 1e9; // the test decides what spawns
  window.__sounds = {};
  const play = g.sound.play.bind(g.sound);
  g.sound.play = (n, ...r) => { window.__sounds[n] = (window.__sounds[n] || 0) + 1; return play(n, ...r); };
  window.__toasts = [];
  const toast = g.ui.toast.bind(g.ui);
  g.ui.toast = (m, ...r) => { window.__toasts.push(m); return toast(m, ...r); };
  window.__keep = { sx: Math.floor(g.spawnPoint.x), sz: Math.floor(g.spawnPoint.z) };
});

const frames = (page, n = 2) => page.evaluate(async n => {
  const g = window.pokecraft;
  for (let i = 0; i < n; i++) { const t0 = g.time; await new Promise(res => { const f = () => (g.time !== t0 ? res() : requestAnimationFrame(f)); f(); }); }
}, n);

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await setup(page);

  /* 1. Rules as data */
  const rules = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures;
    const R = await import('/src/spawnrules.js');
    const S = await import('/src/species.js');
    const out = {};
    out.gh = [R.goldenHour(0), R.goldenHour(0.5), R.goldenHour(0.25), R.goldenHour(0.97), R.goldenHour(0.92), R.goldenHour(1.5), R.goldenHour(-0.02)];
    cm.weather = null;
    cm.clear();
    const picks = (ctx, n = 2000, biome = 'plains') => { const r = []; for (let i = 0; i < n; i++) r.push(cm.pickEntry(biome, ctx)); return r; };
    const typeOf = e => S.SPECIES[e[0]].type;
    const plain = picks({ night: false, golden: null });
    out.plainBad = plain.filter(e => ['time', 'cyber'].includes(typeOf(e))).length;
    const dawn = picks({ night: false, golden: 'dawn' });
    out.dawnShare = dawn.filter(e => typeOf(e) === 'time').length / dawn.length;
    out.dawnSpecies = [...new Set(dawn.filter(e => typeOf(e) === 'time').map(e => e[0]))].sort();
    out.dawnWhen = [...new Set(dawn.filter(e => typeOf(e) === 'time').map(e => e[1]))];
    const dusk = picks({ night: false, golden: 'dusk' });
    out.duskShare = dusk.filter(e => typeOf(e) === 'time').length / dusk.length;
    out.duskSpecies = [...new Set(dusk.filter(e => typeOf(e) === 'time').map(e => e[0]))].sort();
    const night = picks({ night: true, golden: null });
    out.nightTime = night.filter(e => typeOf(e) === 'time').length;
    const together = picks({ night: false, golden: null, friendsNear: true }, 3000);
    out.cyberShare = together.filter(e => typeOf(e) === 'cyber').length / together.length;
    out.cyberOnlyTogether = together.filter(e => typeOf(e) === 'cyber').every(e => e[1] === 'together');
    cm.list.push({ when: 'together' });
    out.cyberMax = picks({ night: false, golden: null, friendsNear: true }, 2000).filter(e => typeOf(e) === 'cyber').length;
    cm.list.pop();
    for (let i = 0; i < 3; i++) cm.list.push({ when: 'dawn' });
    out.dawnMax = picks({ night: false, golden: 'dawn' }, 2000).filter(e => typeOf(e) === 'time').length;
    cm.list.length = 0;
    // The old boolean argument still works.
    out.oldArgs = [cm.pickSpecies('plains', false), cm.pickSpecies('plains', true)].every(s => typeof s === 'string') && cm.weights('plains', true).length > 0;
    // A test-only condition needs no other code.
    R.CONDITIONS.testonly = { ok: c => !!c.flag, share: 1, max: 1 };
    S.SPAWNS.plains.push(['pixbit', 1, 'testonly']);
    out.testOff = picks({ night: false, flag: false }, 300).filter(e => e[1] === 'testonly').length;
    out.testOn = picks({ night: false, flag: true }, 50).filter(e => e[1] === 'testonly').length;
    cm.list.push({ when: 'testonly' });
    out.testMax = picks({ night: false, flag: true }, 300).filter(e => e[1] === 'testonly').length;
    cm.list.pop();
    S.SPAWNS.plains.pop();
    delete R.CONDITIONS.testonly;
    cm.weather = g.weather;
    return out;
  });
  t.ok(rules.gh.join() === 'dawn,dusk,,dawn,,dusk,dawn', `goldenHour: sunrise, sunset, not in between, wraps round (${rules.gh.join('|')})`);
  t.ok(rules.plainBad === 0, 'outside the golden hour and without a friend, no Time or Cyber creature is picked in 2000 tries');
  t.ok(rules.dawnShare > 0.3 && rules.dawnShare < 0.5, `at dawn about 40% Time creatures (${rules.dawnShare})`);
  t.ok(rules.dawnSpecies.join() === 'clangalarm,flipsand,ringaling' && rules.dawnWhen.join() === 'dawn', `dawn: only the dawn species (${rules.dawnSpecies})`);
  t.ok(rules.duskShare > 0.3 && rules.duskShare < 0.5 && rules.duskSpecies.join() === 'grandtock,pendulo,twilorb', `dusk: only the dusk species (${rules.duskSpecies}, ${rules.duskShare})`);
  t.ok(rules.nightTime === 0, 'Time creatures are not picked at night');
  t.ok(rules.cyberShare > 0.03 && rules.cyberShare < 0.12 && rules.cyberOnlyTogether, `with a friend close, about 1 in 15 picks is Cyber (${rules.cyberShare})`);
  t.ok(rules.cyberMax === 0, 'with one Cyber creature already out, no more are picked (max 1)');
  t.ok(rules.dawnMax === 0, 'with 3 Time creatures out, no more are picked (max 3)');
  t.ok(rules.oldArgs, 'pickSpecies / weights still take the old night boolean');
  t.ok(rules.testOff === 0 && rules.testOn === 50 && rules.testMax === 0, `a test-only condition works with no other code change (${rules.testOff}, ${rules.testOn}, ${rules.testMax})`);

  /* 2. Time creatures end to end */
  const time = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures;
    const R = await import('/src/spawnrules.js');
    const S = await import('/src/species.js');
    const pos = g.player.pos.clone();
    cm.weather = null;
    cm.clear();
    let T = 0.95;
    cm.env = { time: () => T, friends: () => [] };
    cm.spawnTimer = 0;
    const spawned = [];
    const old = cm.onSpawn;
    cm.onSpawn = w => { spawned.push({ type: S.SPECIES[w.data.species].type, when: w.when, golden: R.goldenHour(T) }); };
    const tidy = () => { if (cm.list.length >= 13) for (const w of [...cm.list]) if (!['dawn', 'dusk'].includes(w.when)) cm.remove(w); };
    for (let i = 0; i < 1200; i++) { T = 0.95 + i * 0.0001; tidy(); cm.update(0.1, pos, g.spawnPoint, false, false); }
    const timeSpawns = spawned.filter(s => s.type === 'time');
    const inWindow = timeSpawns.every(s => s.golden && s.when === s.golden);
    T = 0.2;
    for (let i = 0; i < 600; i++) { tidy(); cm.update(0.1, pos, g.spawnPoint, false, false); }
    const left = cm.list.filter(w => ['dawn', 'dusk'].includes(w.when) && w.pos.distanceTo(pos) > 10).length;
    const closeLeft = cm.list.filter(w => ['dawn', 'dusk'].includes(w.when)).length;
    cm.onSpawn = old;
    cm.env = { time: () => g.time, friends: () => [] };
    cm.spawnTimer = 1e9;
    cm.weather = g.weather;
    cm.clear();
    return { n: timeSpawns.length, inWindow, left, closeLeft };
  });
  t.ok(time.n >= 1, `Time creatures spawn in the golden hour (${time.n} spawned)`);
  t.ok(time.inWindow, 'every Time creature spawned while the golden hour was on, with its own dawn or dusk');
  t.ok(time.left === 0, `after the window closes Time creatures wander off (${time.left} still far away, ${time.closeLeft} close by)`);

  // Sky and tick-tock. The game's own loop runs here, so wait for real frames.
  await page.evaluate(() => { window.pokecraft.time = 0; });
  await frames(page, 2);
  const dawnSky = await page.evaluate(() => { const c = window.pokecraft.scene.background; return [c.r, c.b]; });
  t.ok(dawnSky[0] > dawnSky[1], `the sky is orange at sunrise (r ${dawnSky[0].toFixed(2)} > b ${dawnSky[1].toFixed(2)})`);
  await page.evaluate(() => { window.pokecraft.time = 0.25; });
  await frames(page, 2);
  const noonSky = await page.evaluate(() => { const c = window.pokecraft.scene.background; return [c.r, c.b]; });
  t.ok(noonSky[0] < noonSky[1], 'the sky is blue at noon');
  await page.evaluate(() => { const g = window.pokecraft; g.time = 0.9; window.__sounds.ticktock = 0; });
  await frames(page, 2);
  t.ok(!(await page.evaluate(() => window.__sounds.ticktock)), 'no tick-tock outside the golden hour');
  await page.evaluate(() => { window.pokecraft.time = 0.97; });
  await frames(page, 1);
  t.ok(await page.evaluate(() => window.__sounds.ticktock) === 1, 'crossing into the golden hour plays the tick-tock once');
  await frames(page, 3);
  t.ok(await page.evaluate(() => window.__sounds.ticktock) === 1, 'staying in it does not play it again');
  await page.evaluate(() => { window.pokecraft.time = 0.25; });

  /* 3. Camo creatures */
  const built = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world;
    const { B } = await import('/src/blocks.js');
    const { sx, sz } = window.__keep;
    const y = 42;
    for (let x = -8; x <= 8; x++) for (let z = -6; z <= 12; z++) {
      for (let h = y; h <= y + 4; h++) w.set(sx + x, h, sz + z, B.AIR);
      w.set(sx + x, y, sz + z, B.GRASS);
    }
    // a ring of leaves around the cell (sx+3, sz), open on the side of the player
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) === 2 && !(dx === -2 && dz === 0)) w.set(sx + 3 + dx, y + 1, sz + dz, B.LEAVES);
    }
    // a flat 2x2 spot for a Topiphant, with leaves around, and a 1-wide ledge (a block in the footprint)
    for (let dx = -1; dx <= 3; dx++) for (let dz = -1; dz <= 3; dz++) {
      if (dx < 0 || dx > 1 || dz < 0 || dz > 1) w.set(sx - 5 + dx, y + 1, sz + 6 + dz, B.LEAVES);
    }
    w.set(sx + 5, y + 1, sz + 6, B.LEAVES); w.set(sx + 6, y + 1, sz + 6, B.LEAVES); w.set(sx + 5, y + 1, sz + 7, B.LEAVES);
    w.set(sx + 6, y + 1, sz + 7, B.DIRT); // the ledge
    // stone around a Cubble
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) === 2) w.set(sx - 4 + dx, y + 1, sz - 4 + dz, B.STONE);
    }
    g.player.pos.set(sx + 0.5, y + 1, sz + 0.5);
    g.player.vel.set(0, 0, 0);
    g.player.keys = {};
    w.updateDirty();
    return { sx, sz, y: y + 1 };
  });
  const { sx, sz, y } = built;

  const camo = await page.evaluate(async ({ sx, sz, y }) => {
    const g = window.pokecraft, cm = g.creatures, w = g.world;
    const { B } = await import('/src/blocks.js');
    const out = {};
    const wild = cm.spawnAt('bushling', sx + 3, y, sz, { level: 5 });
    out.made = !!wild?.disguise;
    out.block = wild?.disguise?.block === B.LEAVES;
    out.rootHidden = wild.model.userData.parts.root.visible === false;
    out.air = w.get(sx + 3, y, sz) === B.AIR;
    out.editsBefore = w.edits.size;
    const p0 = wild.pos.clone();
    for (let i = 0; i < 300; i++) cm.updateOne(wild, 0.1);
    out.still = wild.pos.distanceTo(p0) === 0 && wild.model.rotation.y === 0;
    out.edits = w.edits.size === out.editsBefore && w.get(sx + 3, y, sz) === B.AIR;
    // blinking
    const d = wild.disguise;
    d.blinkIn = 0;
    cm.updateOne(wild, 0.05);
    out.blinkOn = d.blinking && d.eyes.visible;
    for (let i = 0; i < 5; i++) cm.updateOne(wild, 0.1);
    out.blinkOff = !d.blinking && !d.eyes.visible;
    // about twice a minute: 120 s with the first blink at 20 s -> 3 to 5 blinks
    d.blinkIn = 20;
    let blinks = 0, was = false;
    for (let i = 0; i < 1200; i++) { cm.updateOne(wild, 0.1); if (d.blinking && !was) blinks++; was = d.blinking; }
    out.blinks = blinks;
    cm.remove(wild);
    out.afterRemove = !!g.world.materials.solid.map && cm.list.length === 0;
    // a 2x2x2 Topiphant, and no room on the ledge
    const big = cm.spawnAt('topiphant', sx - 5, y, sz + 6, { level: 8 });
    out.big = !!big?.disguise && big.disguise.w === 2 && big.size === 2;
    if (big) { big.disguise.geo.computeBoundingBox(); const s = big.disguise.geo.boundingBox.getSize(new (big.model.position.constructor)()); out.bigSize = [s.x, s.y, s.z].join(); }
    out.ledge = cm.spawnAt('topiphant', sx + 5, y, sz + 6) === null;
    out.noBlock = cm.spawnAt('igloop', sx, y, sz + 10) === null; // no snow around: it does not spawn
    if (big) cm.remove(big);
    // a chunk rebuild still renders with the shared material
    w.set(sx + 7, y, sz + 10, B.STONE);
    w.updateDirty();
    out.afterRebuild = !!g.world.materials.solid.map;
    return out;
  }, built);
  t.ok(camo.made && camo.block, 'a Bushling next to leaves is dressed as a Leaves block');
  t.ok(camo.rootHidden && camo.air && camo.edits, 'its real model is hidden and the world has no block there (nothing changed, nothing saved)');
  t.ok(camo.still, 'after 300 updates it has not moved');
  t.ok(camo.blinkOn && camo.blinkOff, 'a blink shows the eyes, then hides them');
  t.ok(camo.blinks >= 3 && camo.blinks <= 5, `about twice a minute (${camo.blinks} blinks in 120 s)`);
  t.ok(camo.afterRemove && camo.afterRebuild, 'removing a disguised creature leaves the world material usable');
  t.ok(camo.big && camo.bigSize === '2,2,2', `an evolved Camo is a 2x2x2 block (${camo.bigSize})`);
  t.ok(camo.ledge && camo.noBlock, 'no room (a ledge) or no matching block around: it does not spawn');

  // Looking at it, hitting it
  await page.evaluate(({ sx, sz, y }) => {
    const g = window.pokecraft;
    g.creatures.spawnAt('bushling', sx + 3, y, sz, { level: 5 });
    g.player.pos.set(sx + 0.5, y, sz + 0.5);
    g.player.lookAt({ x: sx + 3.5, y: y + 0.5, z: sz + 0.5 });
    g.player.keys = {};
  }, built);
  await waitFor(page, () => document.getElementById('prompt').textContent.includes('Bushling'), null, 60000).catch(() => {});
  const look = await page.evaluate(() => ({
    prompt: document.getElementById('prompt').textContent,
    outline: window.pokecraft.scene.children.some(o => o.isLineSegments && o.visible && o.material.color.getHex() === 0),
  }));
  t.ok(look.prompt.includes('Bushling') && look.outline, `looking at it shows its name and the block outline ("${look.prompt}")`);
  await page.evaluate(() => window.pokecraft.interact());
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'hitting it starts a battle');
  await waitFor(page, () => document.getElementById('b-log').textContent.includes('block was a wild'), null, 180000).catch(() => {});
  const log = await page.evaluate(() => document.getElementById('b-log').textContent);
  t.ok(log.includes('That Leaves block was a wild Bushling!'), `the battle says what it was ("${log.trim()}")`);
  const popped = await page.evaluate(() => {
    const w = window.pokecraft.creatures.list.find(x => x.data.species === 'bushling');
    return { gone: w.disguise === null, shown: w.model.userData.parts.root.visible };
  });
  t.ok(popped.gone && popped.shown, 'the disguise is gone and the real creature shows');
  await waitFor(page, () => !!document.querySelector('#b-actions button'), null, 180000);
  await page.evaluate(() => document.querySelector('#b-actions button:last-child').click()); // Run
  await waitFor(page, () => !window.pokecraft.inBattle, null, 120000).catch(() => {});
  if (await page.evaluate(() => window.pokecraft.inBattle)) await page.evaluate(() => { window.pokecraft.battle.active = false; });
  const after = await page.evaluate(({ sx, sz }) => {
    const w = window.pokecraft.creatures.list.find(x => x.data.species === 'bushling');
    const p = w && { x: w.pos.x, z: w.pos.z };
    return { p, still: w && Math.abs(w.pos.x - (sx + 3.5)) < 1e-6 && Math.abs(w.pos.z - (sz + 0.5)) < 1e-6 };
  }, built);
  t.ok(after.still, 'after running away it stays put (Camo creatures never walk)');
  await page.evaluate(() => { window.pokecraft.inBattle = false; document.body.classList.remove('in-battle'); window.pokecraft.creatures.clear(); });

  // Walking into one (the battle let go of the mouse: click the game to capture it again, like a player)
  await page.mouse.click(550, 380);
  await waitFor(page, () => document.pointerLockElement, null, 10000).catch(() => {});
  await page.waitForTimeout(800); // let the game's pointerlockchange handler run
  await page.evaluate(({ sx, sz, y }) => {
    const g = window.pokecraft;
    g.battle.active = false;
    g.inBattle = false;
    g.creatures.clear();
    g.creatures.spawnAt('cubble', sx - 4, y, sz - 4, { level: 5 });
    g.player.pos.set(sx - 4 + 0.5, y, sz - 2); // just outside its block
    g.player.vel.set(0, 0, 0);
    g.creatures.update(0.1, g.player.pos, g.spawnPoint, false, false);
  }, built);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), 'standing next to a disguised creature does nothing');
  const bump = await page.evaluate(({ sx, sz, y }) => {
    const g = window.pokecraft, cm = g.creatures;
    let bumps = 0;
    const orig = cm.onBump;
    cm.onBump = w => { bumps++; orig(w); };
    g.player.pos.set(sx - 4 + 0.5, y, sz - 3.2); // into its block
    cm.update(0.1, g.player.pos, g.spawnPoint, false, false);
    cm.onBump = orig;
    return { bumps, locked: !!document.pointerLockElement, battle: g.inBattle, panel: g.ui.panelOpen, started: g.started, hp: g.party.map(c => c.hp), toasts: window.__toasts.slice(-2) };
  }, built);
  t.ok(bump.bumps === 1, 'walking into a disguised Cubble finds it');
  // The game only starts the battle while the mouse is captured (a headless browser does not always allow that).
  t.ok(bump.battle || !bump.locked, `...and that starts a battle (mouse captured: ${bump.locked}; ${JSON.stringify(bump)})`);
  await page.evaluate(() => { const g = window.pokecraft; g.battle.active = false; g.inBattle = false; document.body.classList.remove('in-battle'); document.getElementById('b-box')?.closest?.('#battle')?.classList.add('hidden'); g.creatures.clear(); });

  /* 5. Screenshots (before the pair test, which reloads nothing here but takes a while) */
  const shot = async (name, timeout = 180000) => { await frames(page, 2); await page.screenshot({ path: path.join(SHOTS, name), timeout }); };
  await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world;
    const { B } = await import('/src/blocks.js');
    const { sx, sz } = window.__keep;
    const y = 42;
    g.creatures.clear();
    g.time = 0.25;
    for (let x = -16; x <= 16; x++) for (let z = 14; z <= 34; z++) { for (let h = y; h <= y + 6; h++) w.set(sx + x, h, sz + z, B.AIR); w.set(sx + x, y, sz + z, B.GRASS); }
    const kinds = [
      ['bushling', B.GRASS, B.LEAVES, 1], ['topiphant', B.GRASS, B.LEAVES, 2], ['castlet', B.SAND, B.SAND, 1], ['fortsand', B.SAND, B.SAND, 2],
      ['cubble', B.STONE, B.STONE, 1], ['statuo', B.STONE, B.STONE, 2], ['igloop', B.SNOW, B.SNOW, 1],
    ];
    window.__row = [];
    kinds.forEach(([id, floor, block, size], i) => {
      const x = sx - 11 + i * 3.6 | 0, z = sz + 26;
      for (let a = -2; a <= 4; a++) for (let b = -2; b <= 3; b++) w.set(x + a, y, z + b, floor);
      // real blocks of the same kind beside it, at the same height: the neighbours it hides among
      for (const [a, b, hgt] of [[-1, 0, 1], [size, 0, 1], [-1, size, 1], [size, 1, 1], [size, 1, 2], [0, size, 1], [size - 1, size, 2]]) w.set(x + a, y + hgt, z + b, block);
    });
    w.updateDirty();
    kinds.forEach(([id, , , size], i) => {
      const x = sx - 11 + i * 3.6 | 0, z = sz + 26;
      const c = g.creatures.spawnAt(id, x, y + 1, z, { level: 5 });
      window.__row.push(c ? id : null);
      if (c) c.disguise.blinkIn = 1e9;
    });
    g.player.pos.set(sx + 0.5, y + 1, sz + 0.5 + 10);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: sx + 1.5, y: y + 1, z: sz + 26 });
    g.player.keys = {};
  });
  const row = await page.evaluate(() => window.__row);
  t.ok(row.every(Boolean), `all seven Camo creatures were dressed on their patches (${row.join()})`);
  // Close-ups, 6 blocks away, two creatures at a time: first disguised, then one blinking, then popped out.
  const groups = [[0, 1], [2, 3], [4, 5], [6]];
  const aim = ids => page.evaluate(ids => {
    const g = window.pokecraft;
    const cs = ids.map(i => g.creatures.list.find(w => w.data.species === window.__ids[i]));
    const mx = cs.reduce((a, c) => a + c.pos.x, 0) / cs.length, mz = cs[0].pos.z;
    g.player.pos.set(mx, 43, mz - 6);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: mx, y: 43.8, z: mz });
    g.player.keys = {};
  }, ids);
  await page.evaluate(row => { window.__ids = row; }, row);
  await shot('spawn-camo-overview.png');
  for (const [n, ids] of groups.entries()) { await aim(ids); await shot(`spawn-camo-disguised-${n + 1}.png`); }
  await aim([2, 3]);
  await page.evaluate(() => {
    const w = window.pokecraft.creatures.list.find(x => x.data.species === 'castlet');
    w.disguise.blink(window.pokecraft.player.pos);
    w.disguise.update = () => {}; // hold the blink for the picture
    window.__held = w;
  });
  await shot('spawn-camo-blink.png');
  await page.evaluate(() => { const w = window.__held; delete w.disguise.update; });
  await page.evaluate(() => { for (const w of window.pokecraft.creatures.list) { w.reveal(); w.model.userData.parts.root.scale.setScalar(1); w.popT = -1; } });
  for (const [n, ids] of groups.entries()) { await aim(ids); await shot(`spawn-camo-popped-${n + 1}.png`); }
  await page.evaluate(() => { const g = window.pokecraft; g.creatures.clear(); g.weather.set('clear'); g.time = 0.0; });
  await shot('spawn-golden.png');
  await page.evaluate(() => { window.pokecraft.time = 0.25; });
  t.ok(true, 'screenshots saved: spawn-camo-overview/disguised-1..4/blink/popped-1..4 and spawn-golden');
  const pageErrors = page.errors.slice();
  t.ok(pageErrors.length === 0, `no page errors (${pageErrors.join('; ')})`);
  t.ok((await page.evaluate(() => window.pokecraft.sound.errors)).length === 0, 'no sound errors');

  /* 4. Cyber creatures: two players close together */
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await B.waitForTimeout(4000);
  await setup(A);
  const spot = (pg, dx) => pg.evaluate(async dx => {
    const g = window.pokecraft, s = g.spawnPoint;
    const cx = Math.floor(s.x) + dx, cz = Math.floor(s.z);
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) g.world.set(cx + x, 42, cz + z, 3);
    g.player.pos.set(cx + 0.5, 43, cz + 0.5);
    g.player.vel.set(0, 0, 0);
    g.player.keys = {};
  }, dx);
  await spot(A, 0);
  await spot(B, 10);
  const near = await waitFor(A, () => {
    const g = window.pokecraft;
    return [...g.mp.others.values()].some(a => Math.hypot(a.pos.x - g.player.pos.x, a.pos.z - g.player.pos.z) < 14);
  }, null, 60000).then(() => true, () => false);
  t.ok(near, 'the other player shows up close by');
  const cy = await A.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures;
    const S = await import('/src/species.js');
    const pos = g.player.pos.clone();
    cm.weather = null;
    cm.clear();
    cm.spawnTimer = 0;
    const out = { friendsNear: cm.context(pos, false, false).friendsNear };
    const isCyber = w => S.SPECIES[w.data.species].type === 'cyber';
    let max = 0, seen = 0;
    const old = cm.onSpawn;
    cm.onSpawn = w => { if (isCyber(w)) seen++; old?.(w); };
    for (let i = 0; i < 1500; i++) {
      if (cm.list.length >= 13) for (const w of [...cm.list]) if (!isCyber(w)) cm.remove(w);
      cm.update(0.6, pos, g.spawnPoint, false, false);
      max = Math.max(max, cm.list.filter(isCyber).length);
    }
    cm.onSpawn = old;
    out.seen = seen; out.max = max;
    out.toast = window.__toasts.some(m => m.startsWith('Bzzt!'));
    cm.clear();
    return out;
  });
  t.ok(cy.friendsNear, 'with the friend 10 blocks away, "a friend is close" is true');
  t.ok(cy.seen >= 1 && cy.max <= 1, `Cyber creatures appear (${cy.seen}) and never two at once (max ${cy.max})`);
  t.ok(cy.toast, 'the "Bzzt!" toast showed');
  // Move B 100 blocks away
  await B.evaluate(() => {
    const g = window.pokecraft, s = g.spawnPoint;
    const x = s.x > 112 ? s.x - 100 : s.x + 100;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) g.world.set(Math.floor(x) + a, 42, Math.floor(s.z) + b, 3);
    g.player.pos.set(Math.floor(x) + 0.5, 43, Math.floor(s.z) + 0.5);
  });
  const far = await waitFor(A, () => {
    const g = window.pokecraft;
    return [...g.mp.others.values()].length && [...g.mp.others.values()].every(a => Math.hypot(a.pos.x - g.player.pos.x, a.pos.z - g.player.pos.z) > 60);
  }, null, 90000).then(() => true, () => false);
  t.ok(far, 'the other player is now far away');
  const gone = await A.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures;
    const S = await import('/src/species.js');
    const pos = g.player.pos.clone();
    const ctx = cm.context(pos, false, false);
    let n = 0;
    for (let i = 0; i < 2000; i++) if (S.SPECIES[cm.pickEntry('plains', ctx)[0]].type === 'cyber') n++;
    const p = cm.spawnAt('pixbit', Math.floor(pos.x) + 15, Math.floor(pos.y) - 1, Math.floor(pos.z), { when: 'together', level: 5 });
    const placed = !!p;
    cm.spawnTimer = 0;
    if (p) p.life = 1e9;
    for (let i = 0; i < 6; i++) cm.update(0.6, pos, g.spawnPoint, false, false);
    return { friendsNear: ctx.friendsNear, picks: n, placed, left: cm.list.filter(w => w.when === 'together').length };
  });
  t.ok(!gone.friendsNear && gone.picks === 0, `far away: no friend close, 0 Cyber picks in 2000 (${gone.picks})`);
  t.ok(gone.placed && gone.left === 0, 'a Cyber creature already out leaves within a few spawn ticks when the friend is far');
  // Solo: the friend leaves the world
  await B.evaluate(() => window.pokecraft.mp.close());
  await waitFor(A, () => window.pokecraft.mp.others.size === 0, null, 30000).catch(() => {});
  const solo = await A.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures;
    const S = await import('/src/species.js');
    const pos = g.player.pos.clone();
    const ctx = cm.context(pos, false, false);
    let n = 0;
    for (let i = 0; i < 2000; i++) if (S.SPECIES[cm.pickEntry('plains', ctx)[0]].type === 'cyber') n++;
    return { n, friendsNear: ctx.friendsNear, others: g.mp.others.size };
  });
  t.ok(solo.others === 0 && !solo.friendsNear && solo.n === 0, 'playing alone: no Cyber creatures');
  t.ok(A.errors.length === 0 && B.errors.length === 0, `no page errors in the pair (${[...A.errors, ...B.errors].join('; ')})`);
}
