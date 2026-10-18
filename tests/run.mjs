// Runs every browser test.
//   node run.mjs                 all specs, the quick ones first
//   node run.mjs gym touch       just these
//   node run.mjs --skip champion all but these
//   node run.mjs --fast          only the quick group
// Each spec prints its time and has a time limit (PC_SPEC_TIMEOUT_MIN minutes, default 15; the
// slow specs get more), so one hung spec can't stall the whole run.
import fs from 'node:fs';
import { serve, launch, Checks } from './helpers.mjs';

const FAST = ['roster', 'seventh', 'four-types', 'bone-alien', 'icon', 'blocks', 'map'];
const LIMIT_MIN = { 'treasure-vault': 20, 'clock-tower': 20, 'hidden-hill': 15, 'firewall-maze': 20, 'big-map': 15, champion: 30, caves: 25, 'old-saves': 25, 'new-gyms': 25, fx: 25, moves: 25, gym: 25 };

const args = process.argv.slice(2);
const skip = new Set(), only = [];
let fastOnly = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--skip') skip.add(args[++i]);
  else if (args[i] === '--fast') fastOnly = true;
  else only.push(args[i]);
}
const names = fs.readdirSync(new URL('./specs/', import.meta.url)).filter(f => f.endsWith('.mjs')).map(f => f.replace('.mjs', ''))
  .filter(n => (!only.length || only.includes(n)) && !skip.has(n) && (!fastOnly || FAST.includes(n)));
const rank = n => (FAST.includes(n) ? 0 : 1);
const specs = only.length ? names : names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

const { server, base } = await serve();
const browser = await launch();
let failed = 0;
const times = [];
for (const name of specs) {
  const t = new Checks(name + '.mjs');
  console.log(`\n${name}.mjs`);
  const started = Date.now();
  const limitMs = (LIMIT_MIN[name] || Number(process.env.PC_SPEC_TIMEOUT_MIN) || 15) * 60000;
  let timer;
  try {
    const { default: run } = await import(`./specs/${name}.mjs`);
    await Promise.race([
      run({ browser, base, t }),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`timed out after ${limitMs / 60000} minutes`)), limitMs); }),
    ]);
  } catch (e) {
    t.ok(false, `crashed: ${e.message.split("\n")[0]}`); if (process.env.PC_STACK) console.log(e.stack);
    // a crashed or timed-out spec leaves its pages running; close them so the next specs get the browser to themselves
    for (const c of browser.contexts()) await c.close().catch(() => {});
  }
  clearTimeout(timer);
  const secs = Math.round((Date.now() - started) / 1000);
  times.push([name, secs]);
  console.log(`  (${name}: ${secs}s)`);
  failed += t.failed;
}
await browser.close();
server.close();
console.log('\nTimes: ' + times.map(([n, s]) => `${n} ${s}s`).join(', '));
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
