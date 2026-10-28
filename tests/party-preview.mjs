// T48 preview: Jolly Jax's Surprise Party's models (the Party Spinner, the toy crane and a stack of presents, the jacks of Pop-Up Whack,
// the bunting, balloons, cups and plates, the cake with its candles and Jolly Jax, the guests) photographed up close from where a player
// stands, in the party itself. Not a spec: pictures for the owner to judge.
//   node party-preview.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, openGame, newGame, waitFor } from './helpers.mjs';

const OUT = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const { server, base } = await serve();
const browser = await launch();
const page = await openGame(browser, base);
page.on('pageerror', e => console.log('page error', e.message));
await newGame(page);
await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
await waitFor(page, () => window.pokecraft.place === 'swirl' && !window.pokecraft.realms.busy, null, 120000);
await waitFor(page, () => { const f = window.pokecraft.world.swirl.frames.find(f => f.world === 'doors'); return window.pokecraft.world.get(...f.cloth[0]) === 144; }, null, 150000);
await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'doors'), c = f.cloth[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: 144 }); });
await waitFor(page, () => window.pokecraft.place === 'doors' && !window.pokecraft.realms.busy, null, 120000);
await page.evaluate(() => {
  const g = window.pokecraft, L = g.gymLive.of('part:doors');
  L.manual = true; L.playing = () => true;
  for (const w of [...g.creatures.list]) g.creatures.remove(w);
  g.player.update = () => {}; // the camera stays where it is put
  window.__at = (s, l) => { const p = g.player; p.pos.set(...s); p.vel.set(0, 0, 0); p.keys = {}; p.lookAt({ x: l[0], y: l[1], z: l[2] }); };
  // a game on the party floor: `id` (slice), stepped `secs` into its round
  window.__game = (k, secs, round = 1) => {
    L.gm = null; for (const id of ['pinata', 'catch', 'stack', 'whack']) for (const c of L.order[id]) L.cells.want(c.x, c.y, c.z, c.base);
    L.startGame(['pinata', 'catch', 'stack', 'whack'][k]); for (let i = 0; i < 60; i++) L.step(0.05);
    L.gm.round = round; L.beginRound(); for (let t = 0; t < secs; t += 1 / 30) { L.step(1 / 30); if (L.gm.game === 'stack' && L.near(g.player) === 'Drop!' && Math.abs(L.gm.run.st.top.x - (L.gm.run.st.plan.amp * Math.sin((2 * Math.PI / L.gm.run.st.plan.period) * L.gm.run.t + L.gm.run.st.plan.phase))) < 0.25) L.dropNow(); }
    L.draw();
  };
});
const finale = async () => page.evaluate(() => { const g = window.pokecraft, L = g.gymLive.of('part:doors'); L.gm = null; for (let i = 1; i <= 4; i++) if (!g.beaten.includes(`pw:doors:bow${i}`)) g.beaten.push(`pw:doors:bow${i}`); L.sync(); for (let i = 0; i < 80; i++) L.step(0.05); L.draw(); });
// [name, setup, camera, look at]
const shots = [
  ['room', null, [56.5, 15, 74], [56.5, 12, 40]],
  ['spinner', () => page.evaluate(() => window.pokecraft.gymLive.of('part:doors').sync()), [66.5, 13, 53.5], [73.9, 15.4, 53.5]],
  ['table', null, [40.5, 13.5, 47.5], [35.5, 12.2, 52.5]],
  ['cake', null, [56.5, 13, 41.5], [56.5, 14, 31.5]],
  ['stack', () => page.evaluate(() => window.__game(2, 12, 3)), [56.5, 13.5, 60.5], [56.5, 15.5, 52.5]],
  ['whack', () => page.evaluate(() => window.__game(3, 6.3, 2)), [56.5, 13.2, 59.5], [56.5, 12, 53]],
  ['catch', () => page.evaluate(() => window.__game(1, 7, 2)), [56.5, 14, 60.5], [56.5, 12.5, 52]],
  ['pinata', () => page.evaluate(() => window.__game(0, 3, 1)), [56.5, 13, 63.5], [56.5, 13, 53.5]],
  ['finale', finale, [56.5, 13, 43.5], [56.5, 16.5, 31.5]],
];
for (const [name, setup, cam, look] of shots) {
  if (setup) await setup();
  await page.evaluate(([c, l]) => window.__at(c, l), [cam, look]);
  await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren?.(); });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, `t48-preview-${name}.png`) });
  console.log('shot', name);
}
await browser.close(); server.close();
