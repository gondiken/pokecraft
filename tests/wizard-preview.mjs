// Wave 19 preview: the six Custom guardians (Brushtail, Palettoad, Inkwing, Crayonix, Framesaur, Blotbun) photographed in their own
// colours and in three painted palettes. Not a spec: a picture for the owner to judge.   node wizard-preview.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, openGame } from './helpers.mjs';

const OUT = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const { server, base } = await serve();
const browser = await launch();
const page = await openGame(browser, base);
page.on('pageerror', e => console.log('page error', e.message));
await page.evaluate(async () => {
  const { portrait } = await import('/src/ui.js');
  const { DESIGNS, PAINTS } = await import('/src/custom.js');
  const rows = [['their own colours', null], ['Red, yellow, sky blue', [0, 2, 5]], ['Blue, pink, yellow', [6, 8, 2]], ['Black, orange, grey', [11, 1, 10]]];
  const box = document.createElement('div');
  box.id = 'w19-grid';
  box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#e8e4f0;padding:10px;font:14px sans-serif;overflow:auto';
  for (const [label, paint] of rows) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px';
    const l = document.createElement('div'); l.style.cssText = 'width:110px'; l.textContent = label + (paint ? ` (${paint.map(i => PAINTS[i].name).join(' / ')})` : '');
    row.append(l);
    for (const id of DESIGNS) { const img = document.createElement('img'); img.src = portrait(id, 160, 140, false, paint); img.width = 160; img.height = 140; row.append(img); }
    box.append(row);
  }
  document.body.append(box);
});
await page.waitForTimeout(500);
await page.setViewportSize({ width: 1180, height: 640 });
await page.screenshot({ path: path.join(OUT, 'w19-guardians.png') });
console.log('shot w19-guardians');
await browser.close(); server.close();
