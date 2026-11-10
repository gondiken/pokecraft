// Night run 2026-11-10 (plans/chapter3.md section 9): measurements behind the numbers in the plan, on seeds 1, 22, 122.
//   node tests/scribblemeasure.mjs cam      what a child sees: the first try's camera vs the steep one, iPad landscape and portrait
//   SCRIBBLE_GAMES=n, SCRIBBLE_SEED=s, SCRIBBLE_TUNE='{"R":11}' (FIGHT), SCRIBBLE_BOTS=kid,skilled
import { serve, launch } from './helpers.mjs';
import { scribblePage, play, SEEDS } from './scribblebots.mjs';

const what = process.argv[2] || 'cam';
// step 2: a squad of three of one creature (neutral against all three monsters), one plain shot + the kind's move; 'two shots' is the yardstick
const KIT_SPECIES = process.env.KIT_SPECIES || 'owlucid', KIT_LEVEL = +process.env.KIT_LEVEL || 30;
const BOT_KIT = 'slimeslam';
const KITS = Object.fromEntries(Object.entries({
  'two shots': ['bassblast'], 'volley': ['broadside'], 'burst': ['statueslam'], 'dash': ['swashbuckle'], 'dash recoil': ['leadlance'],
  'heal': ['snacktime'], 'buff atk': ['teamcheer'], 'buff def': ['lielow'], 'cloud': ['twigtrip'], 'sleep': ['lullaby'],
}).filter(([k]) => !process.env.KITS || process.env.KITS.split(',').includes(k)).map(([k, m]) => [k, [BOT_KIT, ...m]]));
const TEAM = process.env.SCRIBBLE_TEAM ? process.env.SCRIBBLE_TEAM.split(',').map(x => { const [sp, l] = x.split(':'); return [sp, +l]; }) : null; // e.g. graphitan:56,kitegale:91
const BOTS_K = (process.env.SCRIBBLE_BOTS || 'naive,kid,skilled').split(',');
const games = +process.env.SCRIBBLE_GAMES || 4;
const { server, base } = await serve();
const browser = await launch();
const sum = {};
const add = (k, r) => { (sum[k] ??= []).push(r); };
for (const seed of process.env.SCRIBBLE_SEED ? [+process.env.SCRIBBLE_SEED] : SEEDS) {
  const page = await scribblePage(browser, base, { seed });
  if (process.env.SCRIBBLE_TUNE) await page.evaluate(async t => Object.assign((await import('/src/scribblefight.js')).FIGHT, JSON.parse(t)), process.env.SCRIBBLE_TUNE);
  if (what === 'cam') {
    const cams = [['old', 4 / 3], ['new', 4 / 3], ['old', 3 / 4], ['new', 3 / 4]];
    for (const bot of (process.env.SCRIBBLE_BOTS || 'kid,skilled').split(',')) for (let g = 0; g < games; g++) {
      const r = await play(page, bot, { lead: g, cams });
      add(`${bot}`, r);
      for (const c of r.cams) add(`cam ${c.cam} ${c.aspect}`, c);
    }
  }
  if (what === 'kinds') {
    for (const [name, moves] of Object.entries(KITS)) for (const bot of BOTS_K) for (let g = 0; g < games; g++) {
      const r = await play(page, bot, { solo: [KIT_SPECIES, KIT_LEVEL, moves, 3], lead: g, fps: g % 2 ? 20 : 60 });
      const kind = name.replace(/ .*/, '');
      r.kindDps = (r.byKind[kind] || 0) / Math.max(1, r.time);
      add(`${name} ${bot}`, r);
    }
  }
  if (what === 'length') {
    for (const bot of (process.env.SCRIBBLE_BOTS || 'naive,kid,person,skilled').split(',')) for (let g = 0; g < games; g++) for (const eyes of [false, true]) {
      const r = await play(page, bot, { lead: g, eyes, fps: g % 2 ? 20 : 60, limit: 400, solo: TEAM });
      add(`${bot} ${eyes ? 'eyes' : 'behind'}`, r);
    }
  }
  await page.context().close();
}
const avg = (list, k) => Math.round(list.reduce((a, r) => a + (r[k] ?? 0), 0) / list.length * 10) / 10;
for (const [k, list] of Object.entries(sum)) {
  if (k.startsWith('cam')) console.log(`${k}: monsters on screen ${avg(list, 'foe')} %, whole red warning ${avg(list, 'tell')} %, your creature ${avg(list, 'you')} %, jumps ${avg(list, 'jumps')}, a block in the way ${avg(list, 'hidden')} %  (${list.length} fights)`);
  else if (what === 'kinds') console.log(`${k.padEnd(22)} won ${String(list.filter(r => r.won).length).padStart(2)}/${list.length}  ${String(avg(list, 'time')).padStart(5)} s  monsters' HP left ${String(avg(list, 'foeHp')).padStart(4)} %  this kind's damage/s ${avg(list, 'kindDps')}  shot ${Math.round(list.reduce((a, r) => a + (r.byKind.bolt || 0), 0) / list.reduce((a, r) => a + r.time, 0))}/s  hurt ${avg(list, 'takenPerMin')} % of squad HP/min  ${JSON.stringify(Object.fromEntries(['braced', 'spoilt', 'buffLost'].map(k => [k, avg(list.map(r => r.extra), k)])))}`);
  else if (what === 'length') { const w = list.filter(r => r.won).map(r => r.time).sort((a, b) => a - b), med = w.length ? w[w.length >> 1] : '-';
    console.log(`${k.padEnd(16)} won ${String(w.length).padStart(2)}/${list.length}  median win ${med} s  (wins ${w[0] ?? '-'}..${w.at(-1) ?? '-'} s)  all fights ${avg(list, 'time')} s  monsters' HP left ${avg(list, 'foeHp')} %`); }
  else console.log(`${k}: won ${list.filter(r => r.won).length}/${list.length}, ${avg(list, 'time')} s, snaps/min ${avg(list, 'snapsPerMin')}`);
}
await browser.close(); server.close();
