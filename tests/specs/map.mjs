// The bigger map, and old saves (made when the map was 192x192) keeping their building.
import { openGame, click, seedSave, continueGame } from '../helpers.mjs';
import { GYMS as ALL_GYMS } from '../../src/gyms.js';
import { GYMS } from '../../src/gyms.js';
const N = GYMS.length; // T35: the number of gyms (and badges) grows with every wave, so never hard-code it

export default async function ({ browser, base, t }) {
  // An old save: a brick placed at (100, 30, 100), stored by its index in the old 192x192 map.
  const oldIndex = 100 + 192 * (100 + 192 * 30);
  const old = {
    seed: 4242, edits: [[oldIndex, 11]], pos: [100.5, 31, 102.5], yaw: 0, pitch: 0, time: 0.2,
    party: [{ uid: 'a', species: 'zapple', level: 8, xp: 307, hp: 20, moves: ['tackle', 'spark'] }],
    box: [], cubes: 7, badges: [], beaten: [], savedAt: 1,
  };
  const page = await openGame(browser, base, {
    setup: seedSave(old),
  });
  const { W, D, ms } = await page.evaluate(async () => {
    const { WORLD_W, WORLD_D, World } = await import('/src/world.js');
    const t0 = performance.now();
    new World(1, null, null).generate();
    return { W: WORLD_W, D: WORLD_D, ms: Math.round(performance.now() - t0) };
  });
  t.ok(W === 288 && D === 368, `the map is ${W}x${D} (generating it takes ${ms} ms here)`);
  // Caves must never change the terrain: heights are the same as ever (checksum for seed 4242), and
  // the surface is the same as a world without caves except at the cave entrances.
  const terrain = await page.evaluate(async () => {
    const { WORLD_W, WORLD_D, World } = await import('/src/world.js');
    const a = new World(4242, null, null); a.generate({ caves: false });
    const b = new World(4242, null, null); b.generate();
    let sum = 0, diff = 0; // the checksum covers the old 224 x 224 area (it must never change)
    for (let x = 0; x < 224; x += 3) for (let z = 0; z < 224; z += 3) sum += b.terrainHeight(x, z) * ((x * 7 + z) % 13 + 1);
    const near = new Uint8Array(WORLD_W * WORLD_D);
    for (const c of b.caves.opened) for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) near[(c % WORLD_W) + dx + (Math.floor(c / WORLD_W) + dz) * WORLD_W] = 1;
    for (let x = 0; x < WORLD_W; x++) for (let z = 0; z < WORLD_D; z++) if (a.surface(x, z).y !== b.surface(x, z).y && !near[x + z * WORLD_W]) diff++;
    return { sum, diff, holes: b.caves.opened.size };
  });
  t.ok(terrain.sum === 596409, `terrain heights are unchanged (checksum ${terrain.sum})`);
  t.ok(terrain.diff === 0 && terrain.holes < 600, `with caves the surface is the same except around ${terrain.holes} entrance columns`);
  await continueGame(page);
  t.ok(await page.evaluate(() => window.pokecraft.world.get(100, 30, 100) === 11), "an old save's block is still in the same place");
  t.ok(await page.evaluate(async () => window.pokecraft.world.gyms.length === (await import('/src/gyms.js')).GYMS.length), 'all gyms fit');
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForTimeout(800);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  t.ok(JSON.stringify(saved.size) === '[288,368]' && saved.edits.some(([i, id]) => id === 11 && i === 100 + 288 * (100 + 368 * 30)),
    'saving again stores the new size and converted block positions');
  t.ok(saved.party[0].species === 'zapple' && saved.cubes === 7, 'the team and items are kept');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
