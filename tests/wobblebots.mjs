// Chapter 3 step 5 (plans/chapter3-world.md section 10): the scribble fight on every Wobbleland patch (its monsters, patterns and level
// step from data, the real ground of Wobbleland), with the model players of tests/scribblebots.mjs at 60 and 20 fps:
//   naive (mashing) must win under a quarter over NAIVE_GAMES fights a frame rate; skilled must win every fight; person times reported.
//   node tests/wobblebots.mjs            WOBBLE_GAMES=n (skilled / person fights per patch and frame rate), WOBBLE_PATCHES=1,4
// tests/specs/wobble.mjs part `patches` runs it.
import { pathToFileURL } from 'node:url';
import { serve, launch, openGame, newGame } from './helpers.mjs';
import { play, NAIVE_GAMES } from './scribblebots.mjs';
import { intoWobble } from './specs/wobble.mjs';

export const TEAMS = { neutral: [['owlucid', 30], ['owlucid', 30], ['owlucid', 30]], ready: [['blazehound', 30], ['tidalord', 30], ['thunderwolf', 30]], owner: [['graphitan', 56], ['kitegale', 91], ['blazehound', 89]],
  ice: [['snowpaw', 30], ['flurrydome', 30], ['waddlice', 30]] }; // Slippy Lake's fitting team: Ice creatures keep their grip on the ice (base stats close to Owlucid's: the grip and the chart, not stronger bodies)
export async function wobblePage(browser, base) {
  const page = await openGame(browser, base, { query: '?preview' });
  await newGame(page, 0);
  await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('blazehound', 30), S.makeCreature('tidalord', 30), S.makeCreature('thunderwolf', 30)]; });
  await intoWobble(page);
  return page;
}
// -> { lines, fails, rows }
export async function runPatches(page, { games = 2, naive = NAIVE_GAMES, patches = null, log = console.log } = {}) {
  const lines = [], rows = [];
  let fails = 0;
  const ids = patches ?? await page.evaluate(() => window.pokecraft.world.wobble.patches.filter(p => p.region === 'meadow').map(p => p.id)); // (Slippy Lake: runLake)
  for (const id of ids) {
    const r = { id, naive: 0, naiveN: 0, skilled: 0, skilledN: 0, person: [], personN: 0, owner: 0, ownerN: 0 };
    for (const fps of [60, 20]) {
      // mashing is judged with a team whose types are neutral to the meadow's (Owlucid, Mind): a Fire team mashing Grass and Bug
      // monsters is the type chart doing its job (plans/chapter3-world.md section 3, lever 4), reported as `matched`
      for (let k = 0; k < naive; k++) { const x = await play(page, 'naive', { fps, solo: TEAMS.neutral, patch: id }); r.naiveN++; if (x.won) r.naive++; }
      for (let k = 0; k < Math.ceil(naive / 3); k++) { const x = await play(page, 'naive', { fps, lead: k % 3, patch: id }); r.matchedN = (r.matchedN || 0) + 1; if (x.won) r.matched = (r.matched || 0) + 1; }
      for (let k = 0; k < games; k++) { const x = await play(page, 'skilled', { fps, lead: k, patch: id, limit: 300 }); r.skilledN++; if (x.won) r.skilled++; }
      for (let k = 0; k < games; k++) { const x = await play(page, 'person', { fps, lead: k, patch: id, limit: 400 }); r.personN++; if (x.won) r.person.push(x.time); }
      for (let k = 0; k < Math.ceil(naive / 3); k++) { const x = await play(page, 'naive', { fps, solo: TEAMS.owner, patch: id }); r.ownerN++; if (x.won) r.owner++; }
    }
    const ok = r.naive <= Math.floor(r.naiveN / 4) && r.skilled === r.skilledN;
    if (!ok) fails++;
    r.person.sort((a, b) => a - b);
    const line = `${ok ? 'ok  ' : 'FAIL'} patch ${id}: mashing ${r.naive}/${r.naiveN} (reported: the ready-made Fire / Water / Electric team ${r.matched || 0}/${r.matchedN}, the owner's team ${r.owner}/${r.ownerN}), skilled ${r.skilled}/${r.skilledN}, person ${r.person.length}/${r.personN} won in ${r.person.join(', ')} s`;
    lines.push(line); log(line); rows.push(r);
  }
  return { lines, fails, rows };
}

// Slippy Lake (plans/chapter3-world.md "Slippy Lake"): every lake patch with three teams: the one that fits the place (Ice: it keeps its
// grip), a type-neutral one and the owner's. Judged: mashing under a quarter with the Ice and the neutral team, skilled wins every fight
// with all three. Reported: how much the fitting type helps (the person bot's wins and times, the HP a minute it loses, and the same
// neutral team with the ice turned off: what the slide costs).
// (measurements only) takes the grip away from YOUR creature on the ice: the fight's walk / carry see a slipping rule for side 'you'
const gripOff = String.raw`async off => {
  const GR = await import('/src/groundrules.js'), P = (await import('/src/scribblefight.js')).ScribbleFight.prototype;
  if (!P.__gripWrap) { P.__gripWrap = true; for (const m of ['walk', 'carryOf']) { const orig = P[m]; P[m] = function (f, ...a) { if (!window.__gripOff || f.side !== 'you') return orig.call(this, f, ...a); GR.GROUND.ice.grips = () => false; try { return orig.call(this, f, ...a); } finally { delete GR.GROUND.ice.grips; } }; } }
  window.__gripOff = off;
}`;
const SUM = rs => ({ won: rs.filter(r => r.won).length, n: rs.length, time: rs.filter(r => r.won).map(r => r.time).sort((a, b) => a - b), lost: Math.round(rs.reduce((a, r) => a + r.takenPerMin, 0) / Math.max(1, rs.length)) });
export async function runLake(page, { games = 2, naive = NAIVE_GAMES, patches = null, log = console.log } = {}) {
  const lines = [], rows = [];
  let fails = 0;
  const ids = patches ?? await page.evaluate(() => window.pokecraft.world.wobble.patches.filter(p => p.region === 'lake').map(p => p.id));
  const setIce = on => page.evaluate(async on => { (await import('/src/scribblefight.js')).FIGHT.ground = on ? undefined : false; }, on);
  for (const id of ids) {
    const r = { id, teams: {} };
    for (const [name, team] of [['ice', TEAMS.ice], ['neutral', TEAMS.neutral], ['owner', TEAMS.owner]]) {
      const x = { naive: [], skilled: [], person: [] };
      for (const fps of [60, 20]) {
        for (let k = 0; k < (name === 'owner' ? Math.ceil(naive / 3) : naive); k++) x.naive.push(await play(page, 'naive', { fps, solo: team, patch: id }));
        for (let k = 0; k < games; k++) x.skilled.push(await play(page, 'skilled', { fps, solo: team, patch: id, limit: 300 }));
        for (let k = 0; k < games; k++) x.person.push(await play(page, 'person', { fps, solo: team, patch: id, limit: 400 }));
      }
      r.teams[name] = { naive: SUM(x.naive), skilled: SUM(x.skilled), person: SUM(x.person) };
    }
    { // the grip alone: the Ice team's kid bot (sees a warning 0.35 s late and walks out of it) with its grip, and with its grip taken
      // away for this measurement only (the monsters unchanged): what keeping its feet is worth to a child
      const kid = async nogrip => { await page.evaluate(`(${gripOff})(${nogrip})`); const x = []; for (const fps of [60, 20]) for (let k = 0; k < games * 2; k++) x.push(await play(page, 'kid', { fps, solo: TEAMS.ice, patch: id, limit: 300 })); await page.evaluate(`(${gripOff})(false)`); return SUM(x); };
      r.grip = await kid(false); r.slip = await kid(true);
    }
    { // the same neutral team on the same patch with the ice turned off (the slide's cost)
      await setIce(false);
      const x = []; for (const fps of [60, 20]) for (let k = 0; k < games; k++) x.push(await play(page, 'person', { fps, solo: TEAMS.neutral, patch: id, limit: 400 }));
      await setIce(true);
      r.noIce = SUM(x);
    }
    const T = r.teams, ok = T.ice.naive.won <= Math.floor(T.ice.naive.n / 4) && T.neutral.naive.won <= Math.floor(T.neutral.naive.n / 4) && ['ice', 'neutral', 'owner'].every(k => T[k].skilled.won === T[k].skilled.n);
    if (!ok) fails++;
    const f = (k, t) => `${k}: mashing ${t.naive.won}/${t.naive.n}, skilled ${t.skilled.won}/${t.skilled.n} (${t.skilled.time.join(' ')} s, loses ${t.skilled.lost} % HP a minute), person ${t.person.won}/${t.person.n} (${t.person.time.join(' ')} s, loses ${t.person.lost} %)`;
    const line = `${ok ? 'ok  ' : 'FAIL'} lake patch ${id}: ${f('Ice', T.ice)} | ${f('neutral', T.neutral)} | ${f('owner', T.owner)} | neutral person without the ice: ${r.noIce.won}/${r.noIce.n} (${r.noIce.time.join(' ')} s, loses ${r.noIce.lost} %) | the grip: Ice kid ${r.grip.won}/${r.grip.n} loses ${r.grip.lost} % HP a minute, the same kid slipping ${r.slip.won}/${r.slip.n} loses ${r.slip.lost} %`;
    lines.push(line); log(line); rows.push(r);
  }
  return { lines, fails, rows };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server, base } = await serve();
  const browser = await launch();
  const page = await wobblePage(browser, base);
  if (process.env.SCRIBBLE_TUNE) await page.evaluate(async t => { const M = await import('/src/scribblefight.js'), deep = (o, v) => { for (const [k, x] of Object.entries(v)) if (x && typeof x === 'object' && o[k] && typeof o[k] === 'object') deep(o[k], x); else o[k] = x; }; deep(M.FIGHT, JSON.parse(t)); }, process.env.SCRIBBLE_TUNE);
  const want = process.env.WOBBLE_PATCHES?.split(',').map(Number) ?? null, lake = new Set([7, 8, 9, 10, 11]);
  const r = { fails: 0 };
  if (!want || want.some(i => !lake.has(i))) r.fails += (await runPatches(page, { games: +process.env.WOBBLE_GAMES || 2, patches: want?.filter(i => !lake.has(i)) ?? [1, 2, 3, 4, 5, 6] })).fails;
  if (!want || want.some(i => lake.has(i))) r.fails += (await runLake(page, { games: +process.env.WOBBLE_GAMES || 2, naive: +process.env.WOBBLE_NAIVE || NAIVE_GAMES, patches: want?.filter(i => lake.has(i)) ?? null })).fails;
  if (page.errors.length) console.log('errors', page.errors);
  await browser.close(); server.close();
  process.exit(r.fails ? 1 : 0);
}
