// Storage box (T13): the count in the heading, sorting (remembered), type chips, "To team" from a
// sorted and filtered view, "Let go" (asks first, the Book keeps it as caught, the save drops it),
// and the same with taps on an iPad.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { openGame, newGame, click, pause, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

// Five creatures in the box, in catch order: Fluffin 5, Emberpup 12, Sproutle 3, Blazehound 20, Zapple 9.
const fillBox = page => page.evaluate(async () => {
  const g = window.pokecraft;
  const { makeCreature } = await import('/src/species.js');
  g.box.length = 0;
  for (const [s, l] of [['fluffin', 5], ['emberpup', 12], ['sproutle', 3], ['blazehound', 20], ['zapple', 9]]) {
    const c = makeCreature(s, l);
    g.box.push(c);
    g.book.caught.add(s); g.book.seen.add(s);
  }
  g.party.length = 1;
});
const cards = page => page.$$eval('#box-list .mon .nm', ns => ns.map(n => n.textContent));
// The box is below the fold in the team panel: scroll the button into view, then a real click.
const press = async (page, sel) => { await page.locator(sel).first().scrollIntoViewIfNeeded(); await click(page, sel); };
const boxIds = page => page.evaluate(() => window.pokecraft.box.map(c => c.species).join());

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await fillBox(page);
  await pause(page);
  await page.keyboard.press('p');
  await page.waitForTimeout(400);
  t.ok(await page.textContent('#box-title') === 'Storage Box (5)', `the heading counts the box (${await page.textContent('#box-title')})`);
  t.ok((await cards(page)).join() === 'Zapple,Blazehound,Sproutle,Emberpup,Fluffin', `Newest first by default (${await cards(page)})`);

  await press(page, '#box-tools button[data-sort="level"]');
  t.ok((await cards(page)).join() === 'Blazehound,Emberpup,Zapple,Fluffin,Sproutle', `sort by Level (${await cards(page)})`);
  t.ok(await page.evaluate(() => localStorage.getItem('pokecraft-box-sort')) === 'level', 'the sort is remembered on this device');
  await press(page, '#box-tools button[data-sort="name"]');
  t.ok((await cards(page)).join() === 'Blazehound,Emberpup,Fluffin,Sproutle,Zapple', `sort by Name (${await cards(page)})`);
  await press(page, '#box-tools button[data-sort="type"]');
  t.ok((await cards(page)).join() === 'Fluffin,Blazehound,Emberpup,Sproutle,Zapple', `sort by Type (${await cards(page)})`);
  t.ok(await boxIds(page) === 'fluffin,emberpup,sproutle,blazehound,zapple', 'sorting does not change the box order (or the save)');

  const chips = await page.$$eval('#box-tools .chip', bs => bs.map(b => b.textContent));
  t.ok(chips.join() === 'All 5,normal 1,fire 2,grass 1,electric 1', `type chips show only the types in the box, with counts (${chips})`);
  await press(page, '#box-tools .chip[data-type="fire"]');
  t.ok((await cards(page)).join() === 'Blazehound,Emberpup', `the fire chip shows only fire creatures (${await cards(page)})`);
  await page.screenshot({ path: path.join(SHOTS, 'box-sorted.png') });

  // "To team" on the second card of the sorted, filtered view moves Emberpup (box index 1), not box[1] of the view.
  await press(page, '#box-list .mon >> nth=1 >> button:has-text("To team")');
  t.ok(await page.evaluate(() => window.pokecraft.party.at(-1).species === 'emberpup') && await boxIds(page) === 'fluffin,sproutle,blazehound,zapple',
    `"To team" moves the right creature (${await boxIds(page)})`);
  t.ok((await cards(page)).join() === 'Blazehound', 'the fire filter now shows just Blazehound');

  // Let go: asks first; "Keep it" keeps it.
  await press(page, '#box-tools .chip[data-type="all"]');
  await press(page, '#box-list .mon:has-text("Sproutle") button:has-text("Let go")');
  const ask = await page.textContent('#box-confirm-text');
  t.ok(await page.isVisible('#box-confirm') && ask.includes('Say goodbye to Sproutle (Lv 3)?') && ask.includes('back to the wild'), `it asks first (${ask})`);
  await page.screenshot({ path: path.join(SHOTS, 'box-letgo.png') });
  await press(page, '#box-confirm-no');
  t.ok(!(await page.isVisible('#box-confirm')) && (await boxIds(page)).includes('sproutle'), '"Keep it" keeps it');
  await press(page, '#box-list .mon:has-text("Sproutle") button:has-text("Let go")');
  await press(page, '#box-confirm-yes');
  await page.waitForTimeout(300);
  t.ok(await boxIds(page) === 'fluffin,blazehound,zapple' && (await cards(page)).join() === 'Fluffin,Blazehound,Zapple', `"Yes, let it go" removes it (${await boxIds(page)})`);
  t.ok(await page.textContent('#box-title') === 'Storage Box (3)', 'the count goes down');
  t.ok(await page.evaluate(() => window.pokecraft.book.caught.has('sproutle')), 'the Creature Book still has it as caught');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  t.ok(saved.box.map(c => c.species).join() === 'fluffin,blazehound,zapple' && saved.caught.includes('sproutle'), 'the save no longer has it (and still counts it as caught)');
  t.ok(await page.evaluate(() => [...document.querySelectorAll('#party-list .mon button')].every(b => b.textContent !== 'Let go')), 'team cards have no "Let go" button');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // iPad: the same with taps.
  const pad = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await pad.tap('text=New Game');
  await pad.tap('.starter >> nth=0');
  await pad.waitForTimeout(1500);
  await fillBox(pad);
  await pad.tap('#party-mini');
  await pad.waitForTimeout(400);
  t.ok((await cards(pad)).join() === 'Zapple,Blazehound,Sproutle,Emberpup,Fluffin', 'iPad: the box shows five cards, newest first');
  await pad.tap('#box-tools .chip[data-type="grass"]');
  t.ok((await cards(pad)).join() === 'Sproutle', 'iPad: tapping a type chip filters');
  const h = await pad.$eval('#box-tools .chip[data-type="grass"]', b => b.getBoundingClientRect().height);
  t.ok(h >= 44, `iPad: chips are big enough for a finger (${h}px)`);
  await pad.tap('#box-list .mon button:has-text("Let go")');
  await pad.tap('#box-confirm-yes');
  await pad.waitForTimeout(300);
  t.ok(await boxIds(pad) === 'fluffin,emberpup,blazehound,zapple' && (await cards(pad)).length === 4, 'iPad: tapping "Let go" then "Yes" lets it go (and the filter goes back to All)');
  await pad.screenshot({ path: path.join(SHOTS, 'box-ipad.png') });
  t.ok(!pad.errors.length, `no page errors ${pad.errors.join('; ')}`);
  await pad.context().close();
}
