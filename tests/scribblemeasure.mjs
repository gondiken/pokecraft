// Night run 2026-11-10 (plans/chapter3.md section 9): measurements behind the numbers in the plan, on seeds 1, 22, 122.
//   node tests/scribblemeasure.mjs cam|kinds|length      what a child sees: the first try's camera vs the steep one, iPad landscape and portrait
//   SCRIBBLE_GAMES=n, SCRIBBLE_SEED=s, SCRIBBLE_TUNE='{"R":11}' (FIGHT), SCRIBBLE_BOTS=kid,skilled
import { serve, launch } from './helpers.mjs';
import { scribblePage, play, SEEDS } from './scribblebots.mjs';

const what = process.argv[2] || 'cam';
// step 2 (night run 2026-11-09) and step 1b (2026-11-11): a squad of three of one creature (Owlucid, Mind: Sound moves are neutral
// against all three monsters and get no same-type bonus), every attack at the same power (KIT_POWER, 75): "two shots" is the
// yardstick (a plain shot + the kind's move), "<kind> alone" is the kind's move by itself. Sound has all four attack kinds.
const KIT_SPECIES = process.env.KIT_SPECIES || 'owlucid', KIT_LEVEL = +process.env.KIT_LEVEL || 30, KIT_POWER = +process.env.KIT_POWER || 75;
const BOT_KIT = 'bassblast';
const KITS = Object.fromEntries(Object.entries({
  'two shots': ['slimeshot'], 'volley': ['echoping'], 'burst': ['shriek'], 'dash': ['bigbong'],
  'bolt alone': null, 'volley alone': ['echoping'], 'burst alone': ['shriek'], 'dash alone': ['bigbong'],
  'heal': ['snacktime'], 'buff atk': ['teamcheer'], 'buff def': ['lielow'], 'speed': ['revup'], 'cloud': ['twigtrip'], 'sleep': ['lullaby'],
}).filter(([k]) => !process.env.KITS || process.env.KITS.split(',').includes(k)).map(([k, m]) => [k, k.endsWith('alone') ? (m || [BOT_KIT]) : [BOT_KIT, ...m]]));
const TEAM = process.env.SCRIBBLE_TEAM ? process.env.SCRIBBLE_TEAM.split(',').map(x => { const [sp, l] = x.split(':'); return [sp, +l]; }) : null; // e.g. graphitan:56,kitegale:91
const BOTS_K = (process.env.SCRIBBLE_BOTS || 'naive,kid,person,skilled').split(',');
const games = +process.env.SCRIBBLE_GAMES || 4;
const { server, base } = await serve();
const browser = await launch();
const sum = {};
const add = (k, r) => { (sum[k] ??= []).push(r); };
for (const seed of process.env.SCRIBBLE_SEED ? [+process.env.SCRIBBLE_SEED] : SEEDS) {
  const page = await scribblePage(browser, base, { seed });
  if (process.env.SCRIBBLE_TUNE) await page.evaluate(async t => { const M = await import('/src/scribblefight.js'), deep = (o, v) => { for (const [k, x] of Object.entries(v)) if (x && typeof x === 'object' && o[k] && typeof o[k] === 'object') deep(o[k], x); else o[k] = x; }; deep(M.FIGHT, JSON.parse(t)); }, process.env.SCRIBBLE_TUNE); // (deep: '{"kinds":{"dash":{"hit":2}}}')
  if (process.env.SCRIBBLE_CAM) await page.evaluate(async t => Object.assign((await import('/src/scribblefight.js')).CAM, JSON.parse(t)), process.env.SCRIBBLE_CAM);
  if (what === 'cam') {
    const cams = (process.env.SCRIBBLE_CAMS || 'old,steep,flat,new').split(',').flatMap(c => [[c, 4 / 3], [c, 3 / 4]]);
    for (const bot of (process.env.SCRIBBLE_BOTS || 'kid,skilled').split(',')) for (let g = 0; g < games; g++) {
      const r = await play(page, bot, { lead: g, cams });
      add(`${bot}`, r);
      for (const c of r.cams) add(`cam ${c.cam} ${c.aspect}`, c);
    }
  }
  if (what === 'kinds') {
    for (const [name, moves] of Object.entries(KITS)) for (const bot of BOTS_K) for (let g = 0; g < games; g++) {
      const r = await play(page, bot, { solo: [KIT_SPECIES, KIT_LEVEL, moves, 3], lead: g, fps: g % 2 ? 20 : 60, power: KIT_POWER, limit: 240 });
      const kind = name.replace(/ .*/, '');
      r.kindDps = (r.byKind[kind] || 0) / Math.max(1, r.time);
      add(`${name} ${bot}`, r);
    }
  }
  if (what === 'length') {
    for (const bot of (process.env.SCRIBBLE_BOTS || 'naive,kid,person,skilled').split(',')) for (let g = 0; g < games; g++) {
      const r = await play(page, bot, { lead: g, fps: g % 2 ? 20 : 60, limit: 400, solo: TEAM });
      add(bot, r);
    }
  }
  await page.context().close();
}
const avg = (list, k) => Math.round(list.reduce((a, r) => a + (r[k] ?? 0), 0) / list.length * 10) / 10;
for (const [k, list] of Object.entries(sum)) {
  if (k.startsWith('cam')) console.log(`${k}: monsters on screen ${avg(list, 'foe')} %, whole red warning ${avg(list, 'tell')} %, your creature ${avg(list, 'you')} %, jumps ${avg(list, 'jumps')}, turns ${avg(list, 'turnPerMin')} deg/min, a block in the way ${avg(list, 'hidden')} %  (${list.length} fights)`);
  else if (what === 'kinds') console.log(`${k.padEnd(22)} won ${String(list.filter(r => r.won).length).padStart(2)}/${list.length}  ${String(avg(list, 'time')).padStart(5)} s  monsters' HP left ${String(avg(list, 'foeHp')).padStart(4)} %  this kind's damage/s ${avg(list, 'kindDps')}  shot ${Math.round(list.reduce((a, r) => a + (r.byKind.bolt || 0), 0) / list.reduce((a, r) => a + r.time, 0))}/s  hurt ${avg(list, 'takenPerMin')} % of squad HP/min  ${JSON.stringify(Object.fromEntries(['braced', 'spoilt', 'buffLost'].map(k => [k, avg(list.map(r => r.extra), k)])))}`);
  else if (what === 'length') { const w = list.filter(r => r.won).map(r => r.time).sort((a, b) => a - b), med = w.length ? w[w.length >> 1] : '-';
    console.log(`${k.padEnd(16)} won ${String(w.length).padStart(2)}/${list.length}  median win ${med} s  (wins ${w[0] ?? '-'}..${w.at(-1) ?? '-'} s)  all fights ${avg(list, 'time')} s  monsters' HP left ${avg(list, 'foeHp')} %`); }
  else console.log(`${k}: won ${list.filter(r => r.won).length}/${list.length}, ${avg(list, 'time')} s, snaps/min ${avg(list, 'snapsPerMin')}`);
}
await browser.close(); server.close();
