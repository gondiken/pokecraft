// Weather: each kind can be forced (game.weather.set), shows particles / a rainbow, shifts the
// spawn mix, never blocks spawns, rain ends in a rainbow, storms flash, roofs keep it dry, and
// visitors get the host's weather. Screenshots go to tests/screenshots/ (ignored by git).
import fs from 'node:fs';
import path from 'node:path';
import { openGame, openPair, newGame, click, pause, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

// Stand on a stone platform high in the air, so nothing else is in the way.
const platform = page => page.evaluate(() => {
  const g = window.pokecraft, s = g.spawnPoint, y = 42;
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3);
  g.player.pos.set(Math.floor(s.x) + 0.5, y + 1, Math.floor(s.z) + 0.5);
  g.player.vel.set(0, 0, 0);
  g.player.keys = {};
  g.time = 0.25;
});

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await platform(page);
  const wx = fn => page.evaluate(fn);

  t.ok(await wx(() => { const w = window.pokecraft.weather; return w.phase === 'clear' && w.forced === null; }), 'a new game starts with clear weather');

  const shot = async kind => {
    await page.evaluate(() => { const p = window.pokecraft.player; p.yaw = 0; p.pitch = 0.15; });
    await page.waitForTimeout(2500);
    const file = path.join(SHOTS, `weather-${kind}.png`);
    await page.screenshot({ path: file, timeout: 180000 });
    console.log(`  screenshot ${file}`);
  };

  // 2. Every kind: particles and the rainbow arc.
  const kinds = await wx(async () => (await import('/src/weather.js')).KINDS);
  for (const kind of kinds) {
    await page.evaluate(k => window.pokecraft.weather.set(k), kind);
    const info = await wx(() => { const w = window.pokecraft.weather; return { ...w.info(), visible: w.points.visible }; });
    const falling = ['rain', 'storm', 'snow', 'sandstorm'].includes(kind);
    t.ok(info.here === kind, `${kind}: set() takes effect (${info.here})`);
    t.ok(falling ? info.particles >= 100 && info.particles <= 600 && info.visible : info.particles === 0, `${kind}: particles ${info.particles}`);
    t.ok(info.rainbow === (kind === 'rainbow'), `${kind}: rainbow arc ${info.rainbow ? 'shown' : 'hidden'}`);
    if (['rain', 'storm', 'snow', 'sandstorm', 'rainbow', 'fog'].includes(kind)) await shot(kind);
  }
  await page.evaluate(() => { window.pokecraft.weather.set('storm'); });
  await page.evaluate(() => { window.pokecraft.weather.flash = 1; });
  await page.evaluate(() => window.pokecraft.weather.set('clear'));

  // 3. Spawn mix (exact, from the weights).
  const mix = await wx(async () => {
    const g = window.pokecraft, { SPECIES } = await import('/src/species.js');
    const cm = g.creatures, wxr = g.weather;
    const share = (biome, night, type) => {
      const table = cm.weights(biome, night);
      return table.filter(([e]) => SPECIES[e[0]].type === type).reduce((a, [, w]) => a + w, 0) / table.reduce((a, [, w]) => a + w, 0);
    };
    const rows = [];
    for (const [kind, biome, night, type] of [['storm', 'plains', false, 'electric'], ['rain', 'swamp', false, 'water'], ['snow', 'peak', false, 'ice'],
      ['rainbow', 'meadow', false, 'rainbow'], ['sandstorm', 'desert', false, 'rock'], ['fog', 'swamp', true, 'ghost'], ['stars', 'peak', true, 'cosmic'],
      ['stars', 'plains', true, 'alien'],
      ['rain', 'swamp', false, 'slime'], ['rainbow', 'meadow', false, 'light'], ['storm', 'peak', false, 'sky']]) {
      cm.weather = null;
      const base = share(biome, night, type);
      cm.weather = wxr;
      wxr.set(kind);
      rows.push({ kind, biome, type, base, boosted: share(biome, night, type) });
    }
    wxr.set('clear');
    return rows;
  });
  const need = { storm: 2, rain: 1.8, snow: 1.5, rainbow: 5, sandstorm: 1.5, fog: 1.5, stars: 1.3 };
  const needType = { bone: 1.2, alien: 1.2, slime: 1.2, light: 1.2, sky: 1.2 }; // the new types get smaller boosts
  for (const r of mix) {
    const ratio = r.boosted / r.base;
    t.ok(r.base > 0 && ratio >= (needType[r.type] ?? need[r.kind]) && (r.kind !== 'rainbow' || r.boosted >= 0.05),
      `${r.kind}: ${r.type} share in ${r.biome} ${(r.base * 100).toFixed(1)}% -> ${(r.boosted * 100).toFixed(1)}% (x${ratio.toFixed(1)})`);
  }

  // 4. Never zero.
  const never = await wx(async () => {
    const g = window.pokecraft, { SPAWNS, SPECIES } = await import('/src/species.js'), { KINDS } = await import('/src/weather.js');
    const cm = g.creatures; let bad = 0, picks = 0;
    for (const kind of KINDS) {
      g.weather.set(kind);
      for (const biome of Object.keys(SPAWNS)) for (const night of [false, true]) {
        if (cm.weights(biome, night).some(([, w]) => !(w > 0))) bad++;
        const [id] = cm.pickEntry(biome, night);
        if (SPECIES[id]) picks++; else bad++;
      }
    }
    g.weather.set('clear');
    return { bad, picks };
  });
  t.ok(never.bad === 0 && never.picks > 100, `every weather keeps every spawn possible (${never.picks} picks, ${never.bad} problems)`);

  // 5. Spawn simulation through the real spawn path.
  const sim = async kind => page.evaluate(async kind => {
    const g = window.pokecraft, cm = g.creatures, { SPECIES } = await import('/src/species.js');
    g.weather.set(kind);
    cm.clear();
    const counts = {}; let total = 0;
    const old = cm.onSpawn;
    cm.onSpawn = w => { counts[w.species.type] = (counts[w.species.type] || 0) + 1; total++; };
    for (let i = 0; i < 600; i++) {
      if (cm.list.length >= 16) cm.clear();
      cm.trySpawn(g.player.pos, g.spawnPoint, false);
    }
    cm.onSpawn = old;
    cm.clear();
    // Also the real random pick, many times, for a steadier number (plains, day).
    let electric = 0;
    for (let i = 0; i < 4000; i++) if (SPECIES[cm.pickEntry('plains', false)[0]].type === 'electric') electric++;
    return { counts, total, picked: electric / 4000 };
  }, kind);
  const clear = await sim('clear'), storm = await sim('storm');
  await page.evaluate(() => window.pokecraft.weather.set('clear'));
  const share = r => (r.counts.electric || 0) / r.total;
  t.ok(clear.total >= 20 && storm.total >= 20, `spawn simulation made ${clear.total} / ${storm.total} creatures`);
  t.ok(storm.picked > 1.5 * clear.picked, `storms pick more electric creatures (${(clear.picked * 100).toFixed(1)}% -> ${(storm.picked * 100).toFixed(1)}%)`);
  console.log(`  (real spawns: electric ${(share(clear) * 100).toFixed(1)}% in clear, ${(share(storm) * 100).toFixed(1)}% in storm)`);

  // 6. Rainbow after rain.
  await wx(() => { window.pokecraft.time = 0.25; window.pokecraft.weather.random = () => 0.99; });
  await wx(() => { window.pokecraft.weather.set('rain'); window.pokecraft.weather.skip(); });
  const rb = await wx(() => ({ phase: window.pokecraft.weather.phase, info: window.pokecraft.weather.info(), toast: document.getElementById('toast').lastElementChild?.textContent || '', played: [...window.pokecraft.sound.played] }));
  t.ok(rb.phase === 'rainbow' && rb.info.rainbow, 'rain ends in a rainbow (daytime)');
  t.ok(rb.toast.includes('A rainbow!'), `the rainbow shows a toast (${rb.toast})`);
  t.ok(rb.played.includes('rainbow'), 'the rainbow plays its chime');
  t.ok(await wx(() => {
    const w = window.pokecraft.weather;
    w.set('rain', 2);
    for (let i = 0; i < 60; i++) w.tick(0.05);
    return w.phase === 'rainbow';
  }), 'the phase timer moves rain on to a rainbow');
  t.ok(await wx(() => {
    const g = window.pokecraft; g.time = 0.75;
    g.weather.set('rain'); g.weather.skip();
    const ok = g.weather.phase === 'clear';
    g.time = 0.25;
    return ok;
  }), 'rain at night ends clear (no rainbow)');
  await wx(() => { const w = window.pokecraft.weather; w.random = Math.random; w.set('clear'); });

  // 7. Storm: lightning, thunder, ambience, sound off.
  const st = await wx(() => {
    const g = window.pokecraft, w = g.weather, s = g.sound;
    s.played.length = 0;
    w.set('storm');
    for (let i = 0; i < 400; i++) w.tick(0.05);
    w.update(0.01, performance.now() + 1000);
    const res = { flashes: w.flashes, played: [...s.played], ambient: s.ambient, level: s.ambientLevel };
    s.setOn(false);
    res.off = s.ambientLevel;
    s.setOn(true);
    res.errors = [...s.errors];
    return res;
  });
  t.ok(st.flashes >= 1 && st.played.includes('thunder'), `a storm flashes (${st.flashes}) and rumbles`);
  t.ok(st.ambient === 'storm' && st.level > 0, `storm ambience plays (${st.ambient} ${st.level})`);
  t.ok(st.off === 0, 'with sound off the ambience level is 0');
  t.ok(st.errors.length === 0, `weather sounds play without errors ${st.errors.join('; ')}`);
  await wx(() => window.pokecraft.weather.set('clear'));
  t.ok(await wx(() => { const w = window.pokecraft.weather; w.update(0.01, performance.now() + 2000); return window.pokecraft.sound.ambient === null; }), 'the ambience stops when the weather clears');

  // 8. Covered: no particles under a roof.
  const roof = await wx(() => {
    const g = window.pokecraft, p = g.player.pos, x = Math.floor(p.x), z = Math.floor(p.z), y = Math.floor(p.y) + 3;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) g.world.set(x + dx, y, z + dz, 3);
    g.weather.set('rain');
    const under = g.weather.info().particles;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) g.world.set(x + dx, y, z + dz, 0);
    g.weather.snap();
    const open = g.weather.info().particles;
    g.weather.set('clear');
    return { under, open };
  });
  t.ok(roof.under === 0 && roof.open > 0, `a roof keeps the rain off (${roof.under} under, ${roof.open} in the open)`);

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 9. Multiplayer: the host's weather reaches visitors.
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await A.evaluate(() => { window.pokecraft.weather.set('rain'); });
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code.toLowerCase());
  await click(B, '#mp button:has-text("Join a world")');
  await B.waitForTimeout(4000);
  const ph = p => p.evaluate(() => { const w = window.pokecraft.weather; return { phase: w.phase, here: w.info().here }; });
  t.ok((await ph(B)).phase === 'rain', `the visitor joins in the host's rain (${JSON.stringify(await ph(B))})`);
  await A.evaluate(() => window.pokecraft.weather.set('storm'));
  await B.waitForTimeout(2000);
  const b2 = await ph(B);
  t.ok(b2.phase === 'storm' && b2.here === 'storm', `a change on the host reaches the visitor (${JSON.stringify(b2)})`);
  await A.evaluate(() => window.pokecraft.weather.set('clear'));
  await B.waitForTimeout(2000);
  t.ok((await ph(B)).phase === 'clear', 'the visitor sees the host clear up');
  t.ok(await B.evaluate(() => { const w = window.pokecraft.weather; w.left = 0; w.tick(1); return w.phase === 'clear'; }), 'visitors do not run their own weather timer');
  t.ok(!A.errors.length && !B.errors.length, `no page errors ${[...A.errors, ...B.errors].join('; ')}`);
  await A.context().close(); await B.context().close();
}
