// Photographs the 19 ability badges (src/abilityicons.js) big and at chip size, on light and dark: tests/screenshots/ability-icons.png.
//   node tests/abilityicons-preview.mjs
import { launch, ROOT } from './helpers.mjs';
import { ABILITY_IDS, ABILITIES } from '../src/abilities.js';
import { abilitySvg } from '../src/abilityicons.js';

const cell = id => `<div class="c"><div>${abilitySvg(id, 96)}</div><b>${ABILITIES[id].name}</b><span class="chip">${abilitySvg(id, 22)}${ABILITIES[id].name}</span><span class="chip dark">${abilitySvg(id, 22)}${ABILITIES[id].name}</span></div>`;
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet"><style>
body{margin:0;padding:20px;background:#2a2d3a;font-family:VT323,monospace;color:#fff}
.g{display:grid;grid-template-columns:repeat(5,170px);gap:14px}.c{display:flex;flex-direction:column;align-items:center;gap:6px;background:#1c1f2a;border-radius:12px;padding:10px}
b{font-size:22px}.chip{display:inline-flex;align-items:center;gap:5px;font-size:18px;padding:2px 8px 2px 3px;border-radius:10px;background:#eaf3ff;color:#1b1d26;border:2px solid #1b1d26}
.chip.dark{background:#353a4a;color:#fff}svg{display:block}</style></head><body><div class="g">${ABILITY_IDS.map(cell).join('')}</div></body></html>`;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: `${ROOT}/tests/screenshots/ability-icons.png`, fullPage: true });
await browser.close();
console.log('tests/screenshots/ability-icons.png');
