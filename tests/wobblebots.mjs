// Chapter 3 step 5 (plans/chapter3-world.md section 10): the scribble fight on every Wobbleland patch (its monsters, patterns and level
// step from data, the real ground of Wobbleland), with the model players of tests/scribblebots.mjs at 60 and 20 fps:
//   naive (mashing) must win under a quarter over NAIVE_GAMES fights a frame rate; skilled must win every fight; person times reported.
//   node tests/wobblebots.mjs            WOBBLE_GAMES=n (skilled / person fights per patch and frame rate), WOBBLE_PATCHES=1,4
// tests/specs/wobble.mjs part `patches` runs it.
import { pathToFileURL } from 'node:url';
import { serve, launch, openGame, newGame } from './helpers.mjs';
import { play, NAIVE_GAMES } from './scribblebots.mjs';
import { intoWobble } from './specs/wobble.mjs';

export const TEAMS = { neutral: [['owlucid', 30], ['owlucid', 30], ['owlucid', 30]], ready: [['blazehound', 30], ['tidalord', 30], ['thunderwolf', 30]], owner: [['graphitan', 56], ['kitegale', 91], ['blazehound', 89]] };
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
  const ids = patches ?? await page.evaluate(() => window.pokecraft.world.wobble.patches.map(p => p.id));
  for (const id of ids) {
    const r = { id, naive: 0, naiveN: 0, skilled: 0, skilledN: 0, person: [], personN: 0, owner: 0, ownerN: 0 };
    for (const fps of [60, 20]) {
      // mashing is judged with a team whose types are neutral to the meadow's (Owlucid, Mind): a Fire team mashing Grass and Bug
      // monsters is the type chart doing its job (plans/chapter3-world.md section 3, lever 4), reported as `matched`
      for (let k = 0; k < naive; k++) { const x = await play(page, 'naive', { fps, solo: TEAMS.neutral, patch: id }); r.naiveN++; if (x.won) r.naive++; }
      for (let k = 0; k < Math.ceil(naive / 3); k++) { const x = await play(page, 'naive', { fps, lead: k % 3, patch: id }); r.matchedN = (r.matchedN || 0) + 1; if (x.won) r.matched = (r.matched || 0) + 1; }
      for (let k = 0; k < games; k++) { const x = await play(page, 'skilled', { fps, lead: k, patch: id }); r.skilledN++; if (x.won) r.skilled++; }
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server, base } = await serve();
  const browser = await launch();
  const page = await wobblePage(browser, base);
  if (process.env.SCRIBBLE_TUNE) await page.evaluate(async t => { const M = await import('/src/scribblefight.js'), deep = (o, v) => { for (const [k, x] of Object.entries(v)) if (x && typeof x === 'object' && o[k] && typeof o[k] === 'object') deep(o[k], x); else o[k] = x; }; deep(M.FIGHT, JSON.parse(t)); }, process.env.SCRIBBLE_TUNE);
  const r = await runPatches(page, { games: +process.env.WOBBLE_GAMES || 2, patches: process.env.WOBBLE_PATCHES?.split(',').map(Number) ?? null });
  if (page.errors.length) console.log('errors', page.errors);
  await browser.close(); server.close();
  process.exit(r.fails ? 1 : 0);
}
