// One-off: records tests/fixtures/chart-before-mirror.json (every type but Mirror, only the cells that are not 1) from the chart as it was
// when the Mirror type was added (its statements only add cells that involve Mirror). Not a spec.
import fs from 'node:fs';
import { launch, serve, openGame } from './helpers.mjs';
const { server, base } = await serve(); const browser = await launch(); const page = await openGame(browser, base);
const d = await page.evaluate(async () => { const S = await import('/src/species.js'); const types = Object.keys(S.TYPE_COLORS).filter(x => x !== 'mirror'); const chart = {}; for (const a of types) { chart[a] = {}; for (const dd of types) { const e = S.effectiveness(a, dd); if (e !== 1) chart[a][dd] = e; } } return { types, chart }; });
fs.writeFileSync(new URL('./fixtures/chart-before-mirror.json', import.meta.url), JSON.stringify(d));
console.log(d.types.length); await browser.close(); server.close();
