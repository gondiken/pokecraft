// Screenshots of the wave 11 creature prototypes (not a test). From the repo root:
//   python3 -m http.server 8765 &   then   node plans/wave11-prototypes/shoot.mjs   (needs tests/node_modules: cd tests && npm install)
import { chromium } from '../../tests/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const OUT = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 900, height: 640 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:8765/plans/wave11-prototypes/proto.html');
await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
const shots = [
  ['dream-headstander', 'headstander', { cam: [3.0, 2.0, 5.0], look: [0, 1.5, 0] }],
  ['dream-toddler', 'toddler', { cam: [1.8, 2.6, 4.6], look: [0, 1.5, 0] }],
  ['dream-balloonhead', 'balloonhead', { cam: [2.6, 2.3, 5.6], look: [0, 1.9, 0] }],
  ['dream-all', 'headstander,balloonhead,toddler', { cam: [0.8, 3.0, 8.2], look: [0, 1.5, 0] }],
  ['parkour-stickrunner', 'stickrunner', { cam: [2.6, 1.8, 3.6], look: [0, 1.0, 0] }],
  ['parkour-ferret', 'ferret', { cam: [3.6, 1.6, 1.6], look: [0, 0.9, 0.1] }],
  ['parkour-lemur', 'lemur', { cam: [2.8, 2.0, 3.4], look: [0, 1.3, 0] }],
  ['parkour-vaulter', 'vaulter', { cam: [3.6, 2.0, 3.0], look: [0, 1.2, 0.3] }],
  ['parkour-all', 'stickrunner,ferret,lemur,vaulter', { cam: [0.6, 3.2, 9.0], look: [0, 1.2, 0] }],
];
for (const [name, which, opts] of shots) {
  await p.evaluate(w => window.setup({ which: w }), which);
  await p.evaluate(o => window.shot(o), opts);
  await p.locator('canvas').screenshot({ path: `${OUT}/${name}.png` });
}
await b.close();
