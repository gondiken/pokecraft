// Creature Book: seen/caught tracking, saves, the list and detail pages, silhouettes, and the iPad buttons.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { openGame, newGame, click, pause, playBattle, seedSave, ROOT, continueGame } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);
  const g = fn => page.evaluate(fn);
  const visible = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.classList.contains('hidden'); }, sel);

  // Stand on a stone platform high in the air so nothing is in the way.
  await page.evaluate(() => {
    const g = window.pokecraft, s = g.spawnPoint, y = 42;
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3);
    g.player.pos.set(Math.floor(s.x) + 0.5, y + 1, Math.floor(s.z) + 0.5);
    g.player.vel.set(0, 0, 0);
  });

  // 1
  const start = await g(() => ({ seen: [...window.pokecraft.book.seen], caught: [...window.pokecraft.book.caught] }));
  t.ok(JSON.stringify(start.seen) === '["emberpup"]' && JSON.stringify(start.caught) === '["emberpup"]',
    'a new game starts with just the starter seen and caught');

  // 2
  await page.waitForFunction(() => window.pokecraft.creatures.list.some(w => w.data.species !== 'emberpup'), null, { timeout: 60000 });
  const sp = await page.evaluate(() => {
    const g = window.pokecraft;
    const w = g.creatures.list.filter(c => c.data.species !== 'emberpup')
      .sort((a, b) => a.pos.distanceTo(g.player.pos) - b.pos.distanceTo(g.player.pos))[0];
    g.party[0].level = 40; g.party[0].hp = 999; w.data.hp = 1; g.cubes = 30;
    g.inBattle = true; document.body.classList.add('in-battle'); document.exitPointerLock();
    g.battle.start({ wild: w });
    return w.data.species;
  });
  await page.waitForFunction(s => window.pokecraft.book.seen.has(s), sp, { timeout: 30000 });
  t.ok(await page.evaluate(s => window.pokecraft.book.seen.has(s) && !window.pokecraft.book.caught.has(s), sp), `meeting a wild creature marks it seen (${sp})`);

  // 3
  await page.waitForSelector('#b-actions button', { timeout: 60000 });
  await playBattle(page, 'Cube');
  const caughtIt = await page.evaluate(s => window.pokecraft.book.caught.has(s), sp);
  t.ok(caughtIt, `catching marks it caught (${sp})`);
  await pause(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  t.ok(saved.seen?.includes(sp) && saved.seen.includes('emberpup') && saved.caught?.includes(sp) && saved.caught.includes('emberpup'),
    'the save stores seen and caught lists');

  // 4
  await page.evaluate(() => {
    const g = window.pokecraft;
    const pos = g.player.pos.clone(); pos.x += 4;
    g.party[0].hp = 999;
    g.inBattle = true; document.body.classList.add('in-battle');
    g.battle.start({ trainer: { name: 'Tester', pos, kind: 'trainer', gym: { def: { id: 'tester', leader: { name: 'Boss' } } } }, team: [['geodrake', 3]] });
  });
  await page.waitForFunction(() => window.pokecraft.book.seen.has('geodrake'), null, { timeout: 30000 });
  t.ok(await page.evaluate(() => !window.pokecraft.book.caught.has('geodrake')), 'trainer creatures are seen, not caught');
  await page.waitForSelector('#b-actions button', { timeout: 60000 });
  await playBattle(page);
  await page.evaluate(() => { const g = window.pokecraft; if (g.inBattle) { g.battle.active = false; g.inBattle = false; document.body.classList.remove('in-battle'); } });

  // 5
  await page.evaluate(async () => {
    const { gainXp } = await import('/src/species.js');
    gainXp(window.pokecraft.party[0], 200000);
  });
  const evolved = await page.evaluate(() => window.pokecraft.party[0].species);
  await page.keyboard.press('c');
  await page.waitForTimeout(500);
  t.ok(evolved === 'blazehound' && await page.evaluate(() => window.pokecraft.book.caught.has('blazehound')),
    `evolving fills in the evolved page (${evolved})`);
  t.ok(await visible('#book') && await page.evaluate(() => document.pointerLockElement === null), 'C opens the book and frees the mouse');

  // 6
  const total = await page.evaluate(async () => Object.values((await import('/src/species.js')).SPECIES).filter(sp => !sp.legendary).length);
  const counts = await page.evaluate(() => ({ s: window.pokecraft.book.seen.size, c: window.pokecraft.book.caught.size, txt: document.getElementById('book-count').textContent }));
  t.ok(counts.txt === `Seen ${counts.s} / ${total} · Caught ${counts.c} / ${total}`, `the counters match (${counts.txt})`);

  // 7
  await page.evaluate(() => document.querySelector('.book-filter[data-filter="fire"]').click());
  const fire = await page.evaluate(async () => {
    const { SPECIES } = await import('/src/species.js');
    const cards = [...document.querySelectorAll('.book-card')];
    return { n: cards.length, all: cards.every(c => SPECIES[c.dataset.species].type === 'fire'), info: document.getElementById('book-typeinfo')?.textContent };
  });
  t.ok(fire.n === 7 && fire.all, `the Fire filter shows the 7 fire creatures (${fire.info})`);
  await page.evaluate(() => document.querySelector('.book-filter[data-filter="paper"]').click());
  const paper = await page.evaluate(async () => {
    const { SPECIES } = await import('/src/species.js');
    const cards = [...document.querySelectorAll('.book-card')];
    return { n: cards.length, all: cards.every(c => SPECIES[c.dataset.species].type === 'paper') };
  });
  t.ok(paper.n === 7 && paper.all, `the Paper filter shows the 7 paper creatures (${paper.n})`);
  await page.evaluate(() => document.querySelector('.book-filter[data-filter="all"]').click());
  t.ok(await page.evaluate(async () => { const { TYPE_COLORS } = await import('/src/species.js'); return document.querySelectorAll('.book-filter').length === Object.keys(TYPE_COLORS).length + 1; }), 'one filter button per type, and All');

  // 8
  await page.evaluate(() => { const b = window.pokecraft.book; b.markCaught('wispurr'); b.showDetail('emberpup'); });
  await page.waitForTimeout(300);
  const info = await page.evaluate(async () => {
    const { spawnInfo } = await import('/src/book.js');
    return { names: spawnInfo('emberpup').map(s => s.name), text: document.getElementById('book-detail').textContent };
  });
  t.ok(info.names.length > 0 && info.names.every(n => info.text.includes(n)), `a caught page lists where it lives (${info.names.join(', ')})`);
  t.ok(info.text.includes('Lv 16') && info.text.includes('Blazehound'), 'a caught page shows its evolution');
  await page.waitForFunction(() => [...document.querySelectorAll('#book-detail img')].every(i => i.src.startsWith('data:')), null, { timeout: 60000 });
  await page.screenshot({ path: path.join(SHOTS, 'book-detail.png') });
  await page.evaluate(() => window.pokecraft.book.showDetail('wispurr'));
  t.ok((await page.textContent('#book-detail')).includes('night'), 'a night creature page says night');

  // 9
  const un = await page.evaluate(async () => {
    const { SPECIES } = await import('/src/species.js');
    const { portrait } = await import('/src/ui.js');
    const b = window.pokecraft.book;
    const id = Object.keys(SPECIES).reverse().find(i => !b.seen.has(i));
    b.showList();
    return { id, name: SPECIES[id].name };
  });
  await page.waitForFunction(id => document.querySelector(`.book-card[data-species="${id}"] img`)?.src.startsWith('data:'), un.id, { timeout: 60000 });
  const sil = await page.evaluate(async id => {
    const { portrait } = await import('/src/ui.js');
    const card = document.querySelector(`.book-card[data-species="${id}"]`);
    const a = portrait(id, 96, 82, true);
    return { cls: card.classList.contains('unseen'), text: card.textContent, same: card.querySelector('img').src === a,
      differs: a !== portrait(id, 96, 82), cached: a === portrait(id, 96, 82, true) };
  }, un.id);
  t.ok(sil.cls && sil.text.includes('???') && !sil.text.includes(un.name), 'unseen cards say ??? and hide the name');
  t.ok(sil.same && sil.differs && sil.cached, 'unseen cards use the cached silhouette picture');
  await page.evaluate(id => window.pokecraft.book.showDetail(id), un.id);
  const utext = await page.textContent('#book-detail');
  t.ok(utext.includes('???') && !utext.includes(un.name), 'an unseen page hides the name');
  await page.waitForFunction(() => [...document.querySelectorAll('#book-detail img')].every(i => i.src.startsWith('data:')), null, { timeout: 60000 });
  await page.screenshot({ path: path.join(SHOTS, 'book-silhouette.png') });

  // 10
  await page.evaluate(async () => {
    const { SPECIES } = await import('/src/species.js');
    const b = window.pokecraft.book;
    Object.keys(SPECIES).slice(0, 30).forEach((id, i) => { if (i % 3 === 0) b.markSeen(id); if (i % 6 === 0) b.markCaught(id); });
    Object.keys(SPECIES).slice(30, 45).forEach(id => b.markSeen(id));
    b.showList();
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#book-grid img')].every(i => i.src.startsWith('data:')), null, { timeout: 120000 });
  await page.screenshot({ path: path.join(SHOTS, 'book-list.png') });
  t.ok(await visible('#book-grid'), 'the list fills in with pictures');

  // 11: wiki links between the team screen and the Book
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.keyboard.press('p');
  await page.waitForTimeout(400);
  const lead = await g(() => window.pokecraft.party[0].species);
  await page.evaluate(() => document.querySelector('#party-list .mon .wlink.nm').click());
  await page.waitForTimeout(300);
  const w1 = await page.evaluate(() => ({ book: window.pokecraft.book.isOpen, team: !document.getElementById('party').classList.contains('hidden'),
    page: window.pokecraft.book.page, back: document.getElementById('book-back')?.textContent, yours: document.querySelector('.book-yours')?.textContent || '' }));
  t.ok(w1.book && !w1.team && w1.page === lead && w1.back === '‹ Team', `a team creature's name opens its Book page (${w1.page}, ${w1.back})`);
  t.ok(w1.yours.includes('In your team: Lv'), `its page says which ones are yours (${w1.yours})`);
  const mv = await page.evaluate(() => { const b = document.querySelector('.book-move button.wlink'); b.click(); return b.dataset.move; });
  await page.waitForTimeout(300);
  const w2 = await page.evaluate(() => ({ move: document.querySelector('.book-move-page')?.dataset.move, learners: [...document.querySelectorAll('.book-learners .book-stage')].map(b => b.dataset.species) }));
  t.ok(w2.move === mv && w2.learners.includes(lead), `a move name opens the move's page with who learns it (${mv}: ${w2.learners.length} known)`);
  await page.waitForFunction(() => [...document.querySelectorAll('#book-detail img')].every(i => i.src.startsWith('data:')), null, { timeout: 60000 });
  await page.screenshot({ path: path.join(SHOTS, 'book-move.png') });
  await page.evaluate(() => document.querySelector('.book-movepic .wlink-chip').click());
  await page.waitForTimeout(300);
  const w3 = await page.evaluate(() => ({ filter: window.pokecraft.book.filter, list: !!document.getElementById('book-grid'), match: !!document.getElementById('book-typematch') }));
  t.ok(w3.list && w3.match && w3.filter !== 'all', `a type chip opens that type's list with its strengths (${w3.filter})`);
  await page.evaluate(() => document.getElementById('book-back').click());
  await page.waitForTimeout(200);
  t.ok(await page.evaluate(m => document.querySelector('.book-move-page')?.dataset.move === m, mv), 'Back returns to the move page');
  await page.evaluate(() => document.getElementById('book-back').click());
  await page.waitForTimeout(200);
  t.ok(await page.evaluate(s => window.pokecraft.book.page === s, lead), 'Back again returns to the creature');
  await page.evaluate(() => document.getElementById('book-back').click());
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => !window.pokecraft.book.isOpen && !document.getElementById('party').classList.contains('hidden')), '‹ Team returns to the team screen');
  await page.evaluate(() => document.querySelector('#party-list .mon .moves button').click());
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => !!document.querySelector('.book-move-page')), 'a move on a team card opens its Book page');
  await page.evaluate(() => document.querySelector('.book-learners .book-stage')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('book-to-team')?.click() ?? window.pokecraft.book.toTeam());
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => !window.pokecraft.book.isOpen && window.pokecraft.ui.panelOpen), 'the team screen opens again from the Book');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.keyboard.press('c');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => window.pokecraft.book.isOpen && document.getElementById('book-back')?.textContent !== '‹ Team'), 'opening the Book with C forgets the way back to the team');

  // 12
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  t.ok(!(await visible('#book')) && await page.evaluate(() => !window.pokecraft.ui.panelOpen), 'Esc closes the book');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 13: old saves
  const old = {
    seed: 4242, edits: [], pos: [100.5, 31, 102.5], yaw: 0, pitch: 0, time: 0.2, size: [224, 224],
    party: [{ uid: 'a', species: 'zapple', level: 8, xp: 307, hp: 20, moves: ['tackle', 'spark'] }],
    box: [{ uid: 'b', species: 'frostling', level: 5, xp: 75, hp: 20, moves: ['tackle'] }],
    cubes: 7, badges: [], beaten: [], savedAt: 1,
  };
  const p2 = await openGame(browser, base, {
    setup: seedSave(old),
  });
  await continueGame(p2);
  const b2 = await p2.evaluate(() => ({ c: [...window.pokecraft.book.caught].sort(), s: [...window.pokecraft.book.seen].sort() }));
  t.ok(JSON.stringify(b2.c) === '["frostling","zapple"]' && JSON.stringify(b2.s) === '["frostling","zapple"]', 'old saves get their team marked seen and caught');
  await pause(p2);
  const s2 = await p2.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  t.ok(s2.caught?.includes('zapple') && s2.caught.includes('frostling'), 'the migrated save stores the lists');
  t.ok(!p2.errors.length, `no page errors ${p2.errors.join('; ')}`);
  await p2.context().close();

  // 14: iPad
  const p3 = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await p3.tap('text=New Game');
  await p3.tap('.starter >> nth=0');
  await p3.waitForTimeout(1500);
  await p3.tap('#btn-book');
  await p3.waitForTimeout(500);
  t.ok(await p3.evaluate(() => window.pokecraft.book.isOpen), 'the Book button opens the book');
  await p3.waitForFunction(() => [...document.querySelectorAll('#book-grid img')].every(i => i.src.startsWith('data:')), null, { timeout: 120000 });
  await p3.screenshot({ path: path.join(SHOTS, 'book-ipad.png') });
  t.ok(await p3.evaluate(() => {
    const f = [...document.querySelectorAll('.book-filter')];
    return f.length >= 29 && f.every(b => b.getBoundingClientRect().right <= window.innerWidth + 1) && document.documentElement.scrollWidth <= window.innerWidth + 1;
  }), 'the filter buttons wrap inside the iPad screen');
  await p3.tap('.book-card >> nth=0');
  await p3.waitForTimeout(400);
  t.ok(await p3.evaluate(() => !!document.getElementById('book-detail')), 'tapping a card opens its page');
  await p3.waitForFunction(() => [...document.querySelectorAll('#book-detail img')].every(i => i.src.startsWith('data:')), null, { timeout: 60000 });
  await p3.screenshot({ path: path.join(SHOTS, 'book-ipad-detail.png') });
  await p3.tap('#book-back');
  await p3.waitForTimeout(400);
  t.ok(await p3.evaluate(() => !!document.getElementById('book-grid')), 'Back returns to the list');
  await p3.tap('#book-close');
  await p3.waitForTimeout(400);
  t.ok(await p3.evaluate(() => !window.pokecraft.book.isOpen && document.getElementById('pause').classList.contains('hidden')), 'Close closes the book without the pause screen');
  t.ok(!p3.errors.length, `no page errors ${p3.errors.join('; ')}`);
  await p3.context().close();
}
