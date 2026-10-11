// Runs every browser test: node run.mjs [name ...]   (e.g. node run.mjs gym touch)
import fs from 'node:fs';
import { serve, launch, Checks } from './helpers.mjs';

const only = process.argv.slice(2);
const specs = fs.readdirSync(new URL('./specs/', import.meta.url)).filter(f => f.endsWith('.mjs'))
  .filter(f => !only.length || only.includes(f.replace('.mjs', '')));
const { server, base } = await serve();
const browser = await launch();
let failed = 0;
for (const file of specs) {
  const t = new Checks(file);
  console.log(`\n${file}`);
  try {
    const { default: run } = await import(`./specs/${file}`);
    await run({ browser, base, t });
  } catch (e) {
    t.ok(false, `crashed: ${e.message.split('\n')[0]}`);
  }
  failed += t.failed;
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
