// T39b one-button answers: the key / tap that asked also answers. E, Enter, Y and a tap are yes; Esc, N, Backspace
// and "Not now" are no; no double press (a held or too-quick E is ignored); a question from another player waits 1 s
// for E / tap; the Let go question takes Enter / Esc; on iPad the box sits below the top bar and the action button
// says the Yes word and answers it. Screenshots t39-asks-*.png.
import fs from 'node:fs';
import { devices } from 'playwright';
import { openGame, openPair, newGame, pause, click, waitFor } from '../helpers.mjs';
import { HOUSE } from '../realmhelp.mjs';

fs.mkdirSync('screenshots', { recursive: true });

// A test question; `age` pretends it opened that many ms ago. The answers are counted in window.__a.
const open = (page, { kind = 'mine', age = 0, yes = 'Sleep' } = {}) => page.evaluate(({ kind, age, yes }) => {
  const g = window.pokecraft;
  window.__a = { yes: 0, no: 0 };
  g.ui.ask({ text: 'Test question?', yes, no: 'Not now', kind, onYes: () => { window.__a.yes++; }, onNo: () => { window.__a.no++; } });
  g.ui.asked.openedAt = performance.now() - age;
}, { kind, age, yes });
const key = (page, code, repeat = false) => page.evaluate(([code, repeat]) => document.dispatchEvent(new KeyboardEvent('keydown', { code, repeat, bubbles: true, cancelable: true })), [code, repeat]);
const state = page => page.evaluate(() => ({ asking: window.pokecraft.ui.asking, ...window.__a }));

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page); await pause(page);
  const H = await page.evaluate(HOUSE);
  await waitFor(page, () => window.pokecraft.homes.mine()?.types.includes('cozy'));

  // 1. The bed: E asks, a held or too-quick E does not answer, a fresh E sleeps
  await page.evaluate(b => window.pokecraft.realms.useBed({ x: b[0], y: b[1], z: b[2], id: 71 }), H.bed);
  const bed = await page.evaluate(() => ({ asking: window.pokecraft.ui.asking, kind: window.pokecraft.ui.asked?.kind, yes: document.getElementById('ask-yes').textContent,
    hint: document.getElementById('ask-hint').textContent }));
  t.ok(bed.asking && bed.kind === 'mine' && bed.yes === 'Sleep', `the Bed asks "Sleep" as a question you started (${JSON.stringify(bed)})`);
  t.ok(/E = Sleep/.test(bed.hint) && /Esc = Not now/.test(bed.hint), `the hint is built from the words: "${bed.hint}"`);
  await page.evaluate(() => { window.pokecraft.ui.asked.openedAt = performance.now(); });
  await key(page, 'KeyE');
  t.ok(await page.evaluate(() => window.pokecraft.ui.asking), 'an E within 350 ms of the box opening does not answer');
  await page.evaluate(() => { window.pokecraft.ui.asked.openedAt = performance.now() - 1000; });
  await key(page, 'KeyE', true);
  t.ok(await page.evaluate(() => window.pokecraft.ui.asking), 'a held E (repeat) does not answer');
  await key(page, 'KeyE');
  await waitFor(page, () => window.pokecraft.place === 'dream' && !window.pokecraft.realms.busy);
  t.ok(await page.evaluate(() => !window.pokecraft.ui.asking && window.pokecraft.place === 'dream'), 'a fresh E sleeps: you are in the Dream');
  await page.evaluate(() => window.pokecraft.realms.leave('stone'));
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);

  // 2. Every key
  await open(page, { age: 1000 }); await key(page, 'Enter');
  let s = await state(page);
  t.ok(!s.asking && s.yes === 1 && s.no === 0, 'Enter says yes');
  await open(page, { age: 1000 }); await key(page, 'KeyY');
  s = await state(page); t.ok(!s.asking && s.yes === 1, 'Y says yes');
  await open(page, { age: 0 }); await key(page, 'KeyY');
  s = await state(page); t.ok(!s.asking && s.yes === 1, 'Y works at once (no waiting)');
  await open(page, { age: 1000 }); await key(page, 'Escape');
  s = await state(page); t.ok(!s.asking && s.no === 1 && s.yes === 0, 'Esc says no');
  await open(page, { age: 1000 }); await key(page, 'KeyN');
  s = await state(page); t.ok(!s.asking && s.no === 1 && s.yes === 0, 'N says no');
  await open(page, { age: 1000 }); await key(page, 'Backspace');
  s = await state(page); t.ok(!s.asking && s.no === 1 && s.yes === 0, 'Backspace says no');
  await open(page, { age: 1000 }); await key(page, 'Space');
  s = await state(page); t.ok(s.asking && s.yes === 0 && s.no === 0, 'Space is not an answer (it is jump)');
  await page.evaluate(() => document.dispatchEvent(new Event('pointerlockchange'))); // Esc while the mouse is captured: the lock goes away
  s = await state(page); t.ok(!s.asking && s.no === 1, 'losing the mouse capture (Esc) says no');
  await open(page, { age: 1000 });
  await page.evaluate(() => document.getElementById('ask-no').click());
  s = await state(page); t.ok(!s.asking && s.no === 1, 'the "Not now" button says no');
  await open(page, { age: 0 });
  await page.evaluate(() => document.getElementById('ask-yes').click());
  s = await state(page); t.ok(!s.asking && s.yes === 1, 'the Yes button works at once');
  // a click or tap follows the same time rule as E
  const rule = await page.evaluate(() => {
    const u = window.pokecraft.ui;
    u.ask({ text: '?', yes: 'Yes', no: 'No', onYes() {} });
    const quick = [u.canConfirm('click'), u.canConfirm('tap'), u.canConfirm('key', { repeat: false })];
    u.asked.openedAt -= 400;
    const later = [u.canConfirm('click'), u.canConfirm('tap'), u.canConfirm('key', { repeat: true }), u.canConfirm('key', { repeat: false })];
    u.closeAsk();
    return { quick, later };
  });
  t.ok(rule.quick.every(x => !x) && JSON.stringify(rule.later) === '[true,true,false,true]', `click / tap / key follow the 350 ms and fresh-press rule (${JSON.stringify(rule)})`);
  // E while asking never also does the usual thing
  await page.evaluate(() => { const g = window.pokecraft; window.__n = 0; window.__old = g.openHome; g.openHome = () => { window.__n++; }; });
  await open(page, { age: 0 }); await key(page, 'KeyE');
  t.ok((await page.evaluate(() => window.__n)) === 0 && (await state(page)).asking, 'E while a question is open (too quick) does nothing else');
  await page.evaluate(() => { window.pokecraft.ui.closeAsk(); window.pokecraft.openHome = window.__old; });

  // 3. The Let go question in the box
  const lg = await page.evaluate(async () => {
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.box.push(makeCreature('blazehound', 5, ['infernodash']));
    g.ui.askLetGo(g.box[g.box.length - 1]);
    const open1 = !!g.ui.confirmYes;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    const keep = { still: g.box.length, closed: !g.ui.confirmYes };
    g.ui.askLetGo(g.box[g.box.length - 1]);
    const n = g.box.length;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
    return { open1, keep, n, after: g.box.length };
  });
  t.ok(lg.open1 && lg.keep.closed && lg.keep.still === lg.n && lg.after === lg.n - 1, `Let go: Esc keeps the creature, Enter lets it go (${JSON.stringify(lg)})`);
  await page.context().close();

  // 4. A question from another player waits 1 s for E (two browsers)
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await waitFor(A, () => window.pokecraft.mp.others.size > 0, null, 60000);
  await waitFor(B, () => window.pokecraft.mp.others.size > 0, null, 60000);
  await A.evaluate(() => { const g = window.pokecraft; g.duels.challenge([...g.mp.others.values()][0]); });
  await waitFor(B, () => window.pokecraft.ui.asking);
  const inc = await B.evaluate(() => ({ kind: window.pokecraft.ui.asked.kind, text: document.getElementById('ask-text').textContent }));
  t.ok(inc.kind === 'incoming' && /battle/.test(inc.text), `the duel invite is the shared box, kind incoming ("${inc.text}")`);
  await B.evaluate(() => { window.pokecraft.ui.asked.openedAt = performance.now() - 600; });
  await key(B, 'KeyE');
  t.ok(await B.evaluate(() => window.pokecraft.ui.asking && !window.pokecraft.duels.current), "an E within 1 s of a friend's invite does not accept it");
  await B.evaluate(() => { window.pokecraft.ui.asked.openedAt = performance.now() - 1100; });
  await key(B, 'KeyE');
  t.ok(await waitFor(B, () => window.pokecraft.inBattle && window.pokecraft.duels.current).then(() => true, () => false), 'after 1 s an E accepts it');
  await A.context().close(); await B.context().close();

  // 5. iPad: the box is below the top bar, the action button says the Yes word and answers
  const ipad = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await ipad.tap('text=New Game');
  await ipad.tap('.starter >> nth=0');
  await ipad.waitForTimeout(1500);
  await open(ipad, { age: 0, yes: 'Sleep' });
  await waitFor(ipad, () => document.getElementById('btn-act').textContent === 'Sleep' && !document.getElementById('btn-act').classList.contains('hidden'));
  const geo = await ipad.evaluate(() => {
    const r = id => document.getElementById(id).getBoundingClientRect();
    return { ask: r('ask'), top: r('touch-top'), yes: r('ask-yes'), hint: getComputedStyle(document.getElementById('ask-hint')).display };
  });
  t.ok(geo.ask.top >= geo.top.bottom, `the box is below the top bar (box top ${geo.ask.top}, bar bottom ${geo.top.bottom})`);
  t.ok(geo.yes.height >= 60, `the Yes button is big (${geo.yes.height} px)`);
  t.ok(geo.hint === 'none', 'no key hint on a tablet');
  await ipad.screenshot({ path: 'screenshots/t39-asks-ipad.png' });
  await ipad.evaluate(() => { window.pokecraft.ui.asked.openedAt = performance.now() - 400; });
  await ipad.tap('#btn-act');
  s = await state(ipad);
  t.ok(!s.asking && s.yes === 1, 'tapping the action button (it says "Sleep") answers yes');
  await ipad.context().close();
}
