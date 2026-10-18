// Traits (T26): the data, drawing from the uid, evolution, old saves (same on every device), the card badge,
// the Book line, the catch toast and duels carrying traits.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, openPair, newGame, pause, seedSave, continueGame, platform, waitFor, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const RIDE = ['blazehound', 'tidalord', 'scalewing', 'woolumph', 'blizzbear', 'whaloft'];

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await platform(page, { day: true });

  // 1. Data
  const data = await page.evaluate(async () => {
    const { TRAITS } = await import('/src/traits.js');
    const { SPECIES } = await import('/src/species.js');
    const r = TRAITS.rideable;
    const ids = Object.keys(r.species);
    return {
      keys: Object.keys(TRAITS), n: ids.length,
      bad: ids.filter(i => !SPECIES[i] || SPECIES[i].legendary || SPECIES[i].evolve),
      kinds: ['land', 'water', 'sky'].map(k => ids.filter(i => r.species[i] === k).length),
      other: ids.filter(i => !['land', 'water', 'sky'].includes(r.species[i])),
      text: r.text.length, book: r.book.length, caught: r.caught('Blazehound').length, grown: r.grown('Blazehound'),
    };
  });
  t.ok(data.keys.join() === 'rideable', 'the only trait is rideable');
  t.ok(data.n >= 20 && data.n <= 40, `${data.n} rideable species`);
  t.ok(data.bad.length === 0, `all rideable species exist, are not legendary and do not evolve (${data.bad})`);
  t.ok(data.kinds.every(n => n >= 2) && data.other.length === 0, `land/water/sky each have 2 or more (${data.kinds})`);
  t.ok(data.text <= 40 && data.book <= 80 && data.caught <= 80 && !data.grown.includes('evolved into'), 'texts are short');

  // 2. Drawing
  const draw = await page.evaluate(async () => {
    const T = await import('/src/traits.js');
    const S = await import('/src/species.js');
    const g = window.pokecraft;
    const c = { uid: 'abc123', species: 'blazehound' };
    const same = JSON.stringify(T.drawTraits(c)) === JSON.stringify(T.drawTraits({ ...c }));
    let yes = 0;
    for (let i = 0; i < 2000; i++) if (S.makeCreature('blazehound', 30).traits.includes('rideable')) yes++;
    let leak = 0, arrays = true;
    for (const sp of ['fluffin', 'emberpup', 'sproutle', 'zapple']) for (let i = 0; i < 10; i++) {
      const m = S.makeCreature(sp, 10);
      arrays = arrays && Array.isArray(m.traits);
      if (m.traits.length) leak++;
    }
    let calls = 0; const orig = Math.random; Math.random = () => { calls++; return orig(); };
    S.makeCreature('blazehound', 10);
    Math.random = orig;
    const s = g.spawnPoint;
    const wild = g.creatures.spawnAt('blazehound', s.x, 43, s.z);
    const foe = ['blazehound', 'fluffin'].map(sp => S.makeCreature(sp, 5));
    return { same, share: yes / 2000, leak, arrays, calls, wild: Array.isArray(wild?.data.traits), foe: foe.every(f => Array.isArray(f.traits)) };
  });
  t.ok(draw.same, 'the same uid always gives the same traits');
  t.ok(draw.share > 0.2 && draw.share < 0.3, `about 1 in 4 blazehounds can be ridden (${draw.share})`);
  t.ok(draw.leak === 0 && draw.arrays, 'unlisted species never have it, and always have an array');
  t.ok(draw.calls === 1, `makeCreature makes exactly one Math.random call (${draw.calls})`);
  t.ok(draw.wild && draw.foe, 'wild and trainer creatures carry trait arrays');

  // 3. Evolution
  const evo = await page.evaluate(async () => {
    const T = await import('/src/traits.js');
    const S = await import('/src/species.js');
    let pass, fail;
    for (let i = 0; !(pass && fail); i++) {
      const u = 't' + i, r = T.traitRoll(u, 'rideable') < 0.25;
      if (r) pass ||= u; else fail ||= u;
    }
    const run = u => {
      const c = S.makeCreature('emberpup', 15);
      c.uid = u; c.traits = [];
      const { msgs } = S.gainXp(c, S.xpForLevel(16) - c.xp + 1);
      return { species: c.species, traits: c.traits, msgs: msgs.filter(m => typeof m === 'string') };
    };
    return { pass: run(pass), fail: run(fail) };
  });
  t.ok(evo.pass.species === 'blazehound' && evo.pass.traits.join() === 'rideable' && evo.pass.msgs.some(m => m.includes('big enough to ride')),
    `a lucky evolution gains Rideable and says so (${JSON.stringify(evo.pass)})`);
  t.ok(evo.fail.species === 'blazehound' && evo.fail.traits.length === 0 && !evo.fail.msgs.some(m => m.includes('ride')),
    'an unlucky one gains nothing and says nothing');

  // 5. Badge (party: rideable + plain blazehound; box: one of each)
  await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const g = window.pokecraft;
    const mk = ride => { const c = S.makeCreature('blazehound', 20); c.traits = ride ? ['rideable'] : []; return c; };
    g.party = [mk(true), mk(false)];
    g.box = [mk(true), mk(false)];
  });
  await pause(page);
  await page.keyboard.press('p');
  await page.waitForSelector('#party-list .mon');
  const badge = await page.evaluate(() => ({
    party: document.querySelectorAll('#party-list [data-trait="rideable"]').length,
    box: document.querySelectorAll('#box-list [data-trait="rideable"]').length,
    text: document.querySelector('#party-list [data-trait="rideable"]')?.textContent,
    plain: document.querySelectorAll('#party-list .mon')[1].querySelectorAll('.traits').length,
  }));
  t.ok(badge.party === 1 && badge.box === 1 && badge.text === 'Can be ridden' && badge.plain === 0, `the badge shows on the right cards (${JSON.stringify(badge)})`);
  await page.screenshot({ path: path.join(SHOTS, 't26-badge.png') });

  // 6. Book
  await page.evaluate(() => {
    const g = window.pokecraft;
    g.book.caught.add('blazehound'); g.book.seen.add('blazehound');
    g.book.caught.add('fluffin'); g.book.seen.add('fluffin');
    g.book.seen.add('tidalord'); g.book.caught.delete('tidalord');
  });
  const bookHas = async id => {
    await page.evaluate(id => window.pokecraft.book.open({ species: id }), id);
    await page.waitForTimeout(200);
    return page.evaluate(() => document.querySelectorAll('#book .book-trait').length);
  };
  t.ok(await bookHas('blazehound') === 1, 'a caught blazehound page has the Rideable line');
  t.ok(await bookHas('fluffin') === 0 && await bookHas('tidalord') === 0, 'fluffin and a seen-only species do not');
  await page.keyboard.press('Escape');

  // 7. Catch toast
  const toast = await page.evaluate(async () => {
    const g = window.pokecraft;
    g.inBattle = true;
    g.onBattleEnd('caught', { wild: { data: { species: 'blazehound', level: 5, traits: ['rideable'] } } });
    return document.getElementById('toast').textContent.toLowerCase();
  });
  t.ok(toast.includes('can be ridden'), `catching a rideable one toasts it (${toast})`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 4. Old saves
  const probe = await (async () => {
    const p = await openGame(browser, base);
    const r = await p.evaluate(async () => {
      const T = await import('/src/traits.js');
      const find = (want) => { for (let i = 0; ; i++) if ((T.traitRoll('u' + i, 'rideable') < 0.25) === want) return 'u' + i; };
      return { yes: find(true) };
    });
    await p.context().close();
    return r;
  })();
  const old = (species, level, extra = {}) => ({ species, level, xp: level ** 3, hp: 30, moves: ['tackle'], ...extra });
  const save = {
    seed: 4242, edits: [], pos: [100.5, 31, 102.5], yaw: 0, pitch: 0, time: 0.2, size: [224, 224], cubes: 5, badges: [], beaten: [], savedAt: 1,
    party: RIDE.map((s, i) => old(s, 20 + i, i === 0 ? { uid: 'keep1' } : {})),
    box: [
      ...RIDE.map((s, i) => old(s, 30 + i)), old('blazehound', 40), old('tidalord', 41),
    ].concat([
      old('blazehound', 50, { uid: probe.yes, traits: [] }),
      old('blazehound', 51, { uid: 'x1', traits: ['rideable', 'bogus', 'rideable'] }),
      old('fluffin', 5, { uid: 'x2', traits: ['rideable'] }),
    ]),
  };
  const snap = page => page.evaluate(() => {
    const g = window.pokecraft;
    const all = [...g.party, ...g.box];
    const saved = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
    return {
      all: all.map(c => [c.species, c.level, c.uid, c.traits]),
      saved: [...saved.party, ...saved.box].map(c => [c.species, c.level, c.uid, c.traits]),
    };
  });
  const p1 = await openGame(browser, base, { setup: seedSave(save) });
  await continueGame(p1);
  await waitFor(p1, () => JSON.parse(localStorage.getItem('pokecraft-save-v2')).party[1].uid);
  const s1 = await snap(p1);
  const n = RIDE.length * 2 + 2;
  const mine = s1.all.slice(0, n);
  t.ok(s1.all.every(c => c[2] && Array.isArray(c[3])), 'every creature has a uid and a trait array');
  t.ok(s1.all[0][2] === 'keep1', 'an existing uid is kept');
  t.ok(s1.all.every(c => c[3].length === 0 || (RIDE.includes(c[0]) && c[3].join() === 'rideable')), 'only listed species are rideable');
  t.ok(mine.some(c => c[3].length) && mine.some(c => !c[3].length), 'some are rideable and some are not');
  t.ok(s1.all[n][3].length === 0, 'a saved empty list stays empty');
  t.ok(s1.all[n + 1][3].join() === 'rideable', 'a messy list is cleaned');
  t.ok(s1.all[n + 2][3].length === 0, 'an unlisted species loses it');
  t.ok(JSON.stringify(s1.saved) === JSON.stringify(s1.all), 'the save is written right after Continue and equals the game');

  const p2 = await openGame(browser, base, { setup: seedSave(save) });
  await continueGame(p2);
  const s2 = await snap(p2);
  t.ok(JSON.stringify(s2.all) === JSON.stringify(s1.all), 'a second browser with the same save gets the same uids and traits');

  await p1.reload({ waitUntil: 'commit' });
  await p1.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  await continueGame(p1);
  const s3 = await snap(p1);
  t.ok(JSON.stringify(s3.all) === JSON.stringify(s1.all), 'reloading changes nothing');
  t.ok(!p1.errors.length && !p2.errors.length, `no page errors ${p1.errors.concat(p2.errors).join('; ')}`);
  await p1.context().close();
  await p2.context().close();

  // 8. Duels
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await A.locator('#mp button:has-text("Share my world")').click();
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await B.locator('#mp button:has-text("Join a world")').click();
  await waitFor(A, () => window.pokecraft.mp.others.size > 0, null, 30000);
  await A.evaluate(async () => {
    const S = await import('/src/species.js');
    const g = window.pokecraft;
    const a = S.makeCreature('blazehound', 18); a.traits = ['rideable'];
    g.party = [a, S.makeCreature('fluffin', 5)];
    g.party[1].traits = [];
  });
  const mineTraits = await A.evaluate(() => window.pokecraft.party.map(c => c.traits));
  await A.evaluate(() => { const g = window.pokecraft; g.duels.challenge([...g.mp.others.values()][0]); });
  await waitFor(B, () => window.pokecraft.duels.incoming, null, 30000);
  const got = await B.evaluate(() => window.pokecraft.duels.incoming.team.map(c => c.traits));
  t.ok(JSON.stringify(got) === JSON.stringify(mineTraits), `the other player sees the same traits (${JSON.stringify(got)})`);
  await B.evaluate(() => window.pokecraft.duels.decline());
  await waitFor(A, () => !window.pokecraft.duels.asking);
  // A hand-made challenge with a bad list and no list.
  const odd = await B.evaluate(async () => {
    const d = window.pokecraft.duels, { VERSION } = await import('/src/duel.js');
    d.onMessage({ type: 'ask', v: VERSION, from: 'nobody', id: 'zz', name: 'Odd', seed: 1,
      team: [{ species: 'blazehound', level: 5, moves: ['tackle'], traits: ['bogus'] }, { species: 'fluffin', level: 5, moves: ['tackle'] }] });
    return d.incoming?.team.map(c => c.traits);
  });
  t.ok(odd && JSON.stringify(odd) === '[[],[]]', `bad or missing traits become empty lists (${JSON.stringify(odd)})`);
  t.ok(!A.errors.length && !B.errors.length, `no page errors ${A.errors.concat(B.errors).join('; ')}`);
  await A.context().close();
  await B.context().close();
}
