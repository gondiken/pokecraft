// The bigger map, and old saves (made when the map was 192x192) keeping their building.
import { openGame, click } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  // An old save: a brick placed at (100, 30, 100), stored by its index in the old 192x192 map.
  const oldIndex = 100 + 192 * (100 + 192 * 30);
  const old = {
    seed: 4242, edits: [[oldIndex, 11]], pos: [100.5, 31, 102.5], yaw: 0, pitch: 0, time: 0.2,
    party: [{ uid: 'a', species: 'zapple', level: 8, xp: 307, hp: 20, moves: ['tackle', 'spark'] }],
    box: [], cubes: 7, badges: [], beaten: [], savedAt: 1,
  };
  const page = await openGame(browser, base, {
    setup: ctx => ctx.addInitScript(save => {
      if (!sessionStorage.getItem('seeded')) { localStorage.setItem('pokecraft-save-v2', save); sessionStorage.setItem('seeded', '1'); }
    }, JSON.stringify(old)),
  });
  const { W, D, ms } = await page.evaluate(async () => {
    const { WORLD_W, WORLD_D, World } = await import('/src/world.js');
    const t0 = performance.now();
    new World(1, null, null).generate();
    return { W: WORLD_W, D: WORLD_D, ms: Math.round(performance.now() - t0) };
  });
  t.ok(W === 224 && D === 224, `the map is ${W}x${D} (generating it takes ${ms} ms here)`);
  await click(page, '#title-buttons button:has-text("Continue")');
  await page.waitForTimeout(1500);
  t.ok(await page.evaluate(() => window.pokecraft.world.get(100, 30, 100) === 11), "an old save's block is still in the same place");
  t.ok(await page.evaluate(() => window.pokecraft.world.gyms.length === 16), 'all 16 gyms fit');
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForTimeout(800);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  t.ok(JSON.stringify(saved.size) === '[224,224]' && saved.edits.some(([i, id]) => id === 11 && i === 100 + 224 * (100 + 224 * 30)),
    'saving again stores the new size and converted block positions');
  t.ok(saved.party[0].species === 'zapple' && saved.cubes === 7, 'the team and items are kept');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
