// Chapter 3's world, Wobbleland (plans/chapter3-world.md, ?preview only):
//   land:   the terrain in Node (tests/wobblecheck.mjs): every patch reachable from Inkpot Camp, rings walkable, the wall closes the rest
//   door:   the Paper Door on the Wizard's island: none without being his Ally, none without ?preview; the Ally steps in (the game's own use),
//           arrives at the Camp, reloads inside, walks back up through the way back with real keys, and a following guest is let in
//   WOBBLE_ONLY=land|door      screenshots: tests/screenshots/wobble-*.png
import path from 'node:path';
import { ROOT, openGame, newGame, waitFor } from '../helpers.mjs';

const only = process.env.WOBBLE_ONLY;
const want = name => !only || only.split(',').includes(name);
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); }); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const frames = (page, n = 3) => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
// A Champion (and, with ally, the Wizard's Ally) in the Swirl.
export async function intoSwirl(page, { ally = true } = {}) {
  await page.evaluate(ally => { const g = window.pokecraft; g.champion = true; if (ally) { g.studio.won = true; g.studio.ally = true; } g.realms.enter('swirl', { back: g.world.portal.stand }); }, ally);
  await placeIs(page, 'swirl');
  await frames(page, 4);
}
// Through the Paper Door (the game's own use of the block), into Wobbleland.
export async function intoWobble(page) {
  await intoSwirl(page);
  await waitFor(page, () => window.pokecraft.portal.info?.()?.paper, null, 30000).catch(() => {});
  await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[4]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
  await placeIs(page, 'wobble');
}

export default async function ({ browser, base, t }) {
  if (want('land')) {
    const { checkWobble } = await import('../wobblecheck.mjs');
    const r = await checkWobble();
    t.ok(!r.problems.length, `Wobbleland: every patch reachable from the Camp, rings walkable (${r.out.rings.map(q => `${q.id}: ${q.walk} %${q.wet ? ` ${q.wet} wet` : ''}`).join(', ')}), no overlap, the wall closes Bumpy Hills (${r.out.hills} cells behind it) ${r.problems.slice(0, 4).join('; ')}`);
  }

  if (want('door')) {
    // without ?preview: no realm, no door, even for the Ally
    {
      const page = await openGame(browser, base);
      await newGame(page, 0);
      await intoSwirl(page);
      const r = await page.evaluate(async () => { const g = window.pokecraft, R = await import('/src/realms.js'), { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[0]; return { realm: !!R.REALMS.wobble, block: g.world.get(...c), paper: g.portal.info?.()?.paper }; });
      t.ok(!r.realm && r.block !== 129 && !r.paper, `without ?preview: no Wobbleland and no Paper Door, even for the Wizard's Ally (${JSON.stringify(r)})`);
      await page.context().close();
    }
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    await intoSwirl(page, { ally: false });
    const before = await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[4]; const used = g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); return { paper: g.portal.info?.()?.paper, prompt: g.portal.prompt?.({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }, 'tap'), place: g.place }; });
    t.ok(!before.paper && before.place === 'swirl', `not yet the Wizard's Ally: no Paper Door, and its wall does not take you anywhere (${JSON.stringify(before)})`);
    await page.evaluate(() => { const g = window.pokecraft; g.studio.won = true; g.studio.ally = true; });
    await waitFor(page, () => window.pokecraft.portal.info?.()?.paper, null, 30000).catch(() => {});
    const door = await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), pd = paperDoor(g.world); const s = pd.stand; g.player.pos.set(s[0], s[1], s[2]); g.player.yaw = 0; g.player.pitch = 0.1; return { paper: g.portal.info?.()?.paper, cells: pd.cells.map(c => g.world.get(...c)) }; });
    await frames(page, 6);
    await shot(page, 'wobble-door.png');
    t.ok(door.paper && door.cells.every(b => b === door.cells[0]), `the Wizard's Ally sees the Paper Door at the foot of his tower (${JSON.stringify(door)})`);
    await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[4]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
    await placeIs(page, 'wobble');
    const inside = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), p = g.player.pos; return { x: p.x, z: p.z, camp: Math.hypot(p.x - L.CAMP.x, p.z - L.CAMP.z), healer: !!g.world.healer, keep: !!g.world.editAllowed && !g.world.editAllowed(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z) - 3, 1) }; });
    t.ok(inside.camp < 6 && inside.healer && inside.keep, `in Wobbleland: you arrive at Inkpot Camp, a healer is there, nothing can be built (${JSON.stringify(inside)})`);
    await frames(page, 6);
    await shot(page, 'wobble-arrive.png');
    // saved inside: a reload puts you back in Wobbleland
    await page.evaluate(() => window.pokecraft.save?.(true));
    await page.reload();
    await page.waitForFunction(() => window.pokecraft?.world, null, { timeout: 120000 });
    await page.evaluate(() => [...document.querySelectorAll('#title-buttons button')].find(b => /Continue/.test(b.textContent))?.click());
    await placeIs(page, 'wobble');
    t.ok(true, 'a reload inside puts you back in Wobbleland');
    // back up with real keys: walk (W) up the steps to the way back, look at it and press E
    await page.evaluate(() => { const g = window.pokecraft, d = g.world.doors[0], s = d.stand; g.player.pos.set(s[0], s[1], s[2] - 2); g.player.yaw = Math.PI; g.player.pitch = 0; });
    await page.keyboard.down('w'); await page.keyboard.down('Space'); // (the steps: jump up them)
    await waitFor(page, () => { const g = window.pokecraft, s = g.world.doors[0].stand; return g.player.pos.z > s[2] + 0.6; }, null, 30000).catch(() => {});
    await page.keyboard.up('w'); await page.keyboard.up('Space');
    await page.evaluate(() => { window.pokecraft.player.pitch = 0.15; });
    await frames(page, 3);
    await page.keyboard.press('e');
    await placeIs(page, 'swirl').catch(() => {});
    const back = await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), s = paperDoor(g.world).stand; return { place: g.place, d: Math.hypot(g.player.pos.x - s[0], g.player.pos.z - s[2]) }; });
    t.ok(back.place === 'swirl' && back.d < 3, `W and Space up the steps and E on the way back take you up to the Paper Door on the Wizard's island (${JSON.stringify(back)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }
}
