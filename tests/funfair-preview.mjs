// T43 preview: the Funfair's models (bumper cars, carousel, rings, balloons, coaster car, Ferris wheel, slide, Merry Mae and Ticket Tess)
// photographed up close from where a player stands, in Playland itself. Not a spec: pictures for the owner to judge.
//   node funfair-preview.mjs [outDir]
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
const cell = await page.evaluate(() => {
  const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'fair'), p = g.player;
  p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
  p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
  return f.cloth[Math.floor(f.cloth.length / 2)];
});
await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
await waitFor(page, () => window.pokecraft.place === 'playland' && !window.pokecraft.realms.busy, null, 120000);
await page.evaluate(() => {
  const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25;
  const live = g.gymLive.of('part:fair'); live.manual = true; live.playing = () => true;
  for (let k = 0; k < 90; k++) live.step(1 / 30); // the bots are somewhere on their loops
  g.player.update = () => {}; // the camera stays where it is put
  window.__at = (s, l) => { const p = g.player; p.pos.set(...s); p.vel.set(0, 0, 0); p.keys = {}; p.lookAt({ x: l[0], y: l[1], z: l[2] }); };
});
// [name, camera, look at]
const shots = [
  ['bumper-cars', [139, 14, 142], [135, 11.8, 153]],
  ['bumper-close', [128, 12.6, 148], [133, 12, 153]],
  ['parked-cars', [143, 13, 142], [146.3, 11.6, 148]],
  ['carousel', [150, 16, 141], [166.5, 13, 153.5]],
  ['horses-close', [166.5, 13.5, 140.5], [166.5, 12.6, 147.5]],
  ['rings', [166.5, 14.5, 144], [166.5, 14.4, 147]],
  ['balloons', [190.5, 17, 148.5], [198, 19.5, 154]],
  ['coaster-car', [163, 14, 168], [166.5, 12.6, 173.5]],
  ['coaster-lift', [150, 16, 166], [135, 22, 173.5]],
  ['wheel', [132, 16, 170], [118, 26, 152]],
  ['slide', [200, 20, 185], [193, 18, 190]],
  ['stage', [190, 28, 192], [201, 25, 201]],
  ['mae-and-friends', [201.5, 25.6, 196.5], [201.5, 25.2, 201.5]],
  ['tess', [166.5, 12.6, 134.5], [166.5, 12.3, 138.5]],
];
for (const [name, cam, look] of shots) {
  await page.evaluate(([c, l]) => window.__at(c, l), [cam, look]);
  await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, `t43-preview-${name}.png`) });
  console.log('shot', name);
}
await browser.close(); server.close();
