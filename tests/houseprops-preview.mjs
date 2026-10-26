// T40a.5 preview: the Giant House's new puzzle models placed in the house, photographed from where a player stands.
// node houseprops-preview.mjs [outDir]   (not a spec: pictures for the owner to judge)
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
await page.evaluate(async () => {
  const { pictureWorld } = await import('/src/pictureworlds.js'); pictureWorld('house').ready = true;
  const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand });
});
await waitFor(page, () => window.pokecraft.place === 'swirl' && !window.pokecraft.realms.busy, null, 60000);
await page.evaluate(() => window.pokecraft.realms.enter('house', { arrive: 'house' }));
await waitFor(page, () => window.pokecraft.place === 'house' && !window.pokecraft.realms.busy, null, 60000);
await page.evaluate(async () => {
  const g = window.pokecraft, w = g.world, P = await import('/src/houseprops.js');
  for (let x = 74; x <= 97; x++) for (let z = 86; z <= 97; z++) for (let y = 15; y <= 23; y++) w.setLive(x, y, z, 0); // the block cat goes
  const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; g.scene.add(o); return o; };
  put(P.buildCat({ pose: 'sleep' }), 88, 15, 92, Math.PI / 2);
  put(P.buildYarn(), 106, 15, 90, 0.4);
  put(P.buildNote(P.NOTES.yarn), 110, 15, 95.5, Math.PI / 2 + 0.3);
  put(P.buildCat({ pose: 'stand' }), 128, 1, 140, 0.5);
  put(P.buildSpoonSeesaw(), 74, 26, 66, 0);
  put(P.buildMarble(), 74, 26, 74.5);
  put(P.buildNote(P.NOTES.spoon), 79, 26, 60, Math.PI / 2 - 0.3);
  put(P.buildPlug({ chainTo: [-4, 0, -1.2] }), 44, 31, 24);
  put(P.buildNote(P.NOTES.plug), 50, 31, 24.5, Math.PI / 2);
  put(P.buildSock(), 11.5, 4, 127.5, 0.6);
  put(P.buildWindKey(), 22, 1, 127, Math.PI / 2);
  put(P.buildNote(P.NOTES.fan), 24, 1, 131, Math.PI / 2 + 0.4);
  g.player.update = () => {}; // the camera stays where it is put (no falling)
  window.__at = (x, y, z, yaw, pitch = 0) => { const p = g.player; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.keys = {}; };
});
const shots = [
  ['cat-sleep-bench', [120, 15, 92, Math.PI / 2, -0.12]],
  ['cat-sleep-close', [104, 15, 88, Math.atan2(16, -4), -0.15]],
  ['cat-from-floor', [96, 1, 118, Math.atan2(8, 26), 0.42]],
  ['cat-stand', [134, 1, 163, Math.atan2(6, 23), 0.12]],
  ['spoon', [85, 30, 54, Math.atan2(11, -12), -0.32]], ['spoon-side', [87, 26, 66, Math.PI / 2, -0.12]],
  ['plug', [49, 32.5, 21, Math.atan2(5, -3), -0.45]],
  ['fan', [32, 1, 136, Math.atan2(18, 8), 0]], ['sock', [20, 12, 136, Math.atan2(8.5, 8.5), -0.6]],
];
for (const [name, spot] of shots) {
  await page.evaluate(s => window.__at(...s), spot);
  await page.evaluate(() => document.getElementById('pause')?.classList.add('hidden'));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, `t40a5-${name}.png`) });
  console.log('shot', name);
}
await browser.close(); server.close();
