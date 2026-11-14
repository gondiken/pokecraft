// Chapter 3 step B (plans/chapter3-abilities-build.md): creature abilities as data (src/abilities.js) and their chips on every card.
//   node: the 19 abilities (append-only ids, every one has an icon, a name and a short line), every type mapped, consistency with the
//         bodies (no `flies` species in a type without Fly, Voltwing's small wings are a look only, every sky-ride species in a Fly type,
//         every water-ride species in a Swim type), every creature of a type has the same abilities, the guardian (Fly when its parts fly,
//         plus the one ability chosen on the drawing board, kept by cleanDesign; Fly and junk are never chosen)
//   browser (desktop and iPad): the team screen's cards (two creatures of one type: the same chips), the Book's creature page and type
//         page, the creature you are (the HUD, icons only), the drawing board's Ability tab (a pick saved in the design) and screenshots
//         `abilities-*.png`; `ABILITIES_ONLY=node|desktop|ipad`
import { register } from 'node:module';
import { devices } from 'playwright';
import { openGame, seedSave, continueGame, waitFor, ROOT } from '../helpers.mjs';

const THREE_URL = import.meta.resolve('three');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { return next(s === 'three' ? ${JSON.stringify(THREE_URL)} : s, c); }`));

const ONLY = process.env.ABILITIES_ONLY;
const want = part => !ONLY || ONLY.split(',').includes(part);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SHOTS = `${ROOT}/tests/screenshots`;

// The owner's list (2026-11-14), in this order; ids are saved later, so this list may only grow at the end.
const IDS = 'fly swim climb dig squeeze pass glow burn freeze zap sprint rewind push sneak lift charm sense grow heal'.split(' ');

async function node(t) {
  const { SPECIES, TYPE_COLORS } = await import('../../src/species.js');
  const { KIT, BARE, cleanDesign } = await import('../../src/guardiankit.js');
  const { TRAITS } = await import('../../src/traits.js');
  const A = await import('../../src/abilities.js');
  t.ok(same(A.ABILITY_IDS, IDS), `the 19 abilities in the owner's order (${A.ABILITY_IDS.join(' ')})`);
  t.ok(IDS.every(id => { const a = A.ABILITIES[id]; return a.id === id && a.icon && a.name && a.line && a.line.length <= 70; }), 'each has an icon, a name and a short line');
  const types = Object.keys(TYPE_COLORS);
  const missing = types.filter(ty => !A.TYPE_ABILITIES[ty]);
  const unknown = Object.entries(A.TYPE_ABILITIES).filter(([ty, l]) => !TYPE_COLORS[ty] || l.some(id => !A.ABILITIES[id]));
  const wildTypes = [...new Set(Object.values(SPECIES).filter(s => !s.designed).map(s => s.type))];
  const empty = wildTypes.filter(ty => !A.TYPE_ABILITIES[ty]?.length);
  t.ok(!missing.length && !unknown.length && !empty.length && types.length === 47, `every type mapped (${types.length}), no unknown ids, every wild type has one at least (${missing} ${unknown.map(u => u[0])} ${empty})`);
  t.ok(A.TYPE_ABILITIES.custom.length === 0 && same(A.TYPE_ABILITIES.time, ['rewind']) && same(A.TYPE_ABILITIES.grass, ['climb', 'grow']) && same(A.TYPE_ABILITIES.bubble, ['swim', 'fly']),
    'Custom has none of its own; Time rewinds, Grass climbs and grows, Bubble swims and flies');
  const unused = IDS.filter(id => !Object.values(A.TYPE_ABILITIES).some(l => l.includes(id)));
  t.ok(!unused.length, `every ability belongs to a type (${unused})`);

  const all = Object.entries(SPECIES);
  const fliers = all.filter(([, s]) => s.flies && !A.abilitiesOf(s).includes('fly')).map(e => e[0]);
  t.ok(!fliers.length, `no flying species in a type without Fly (${fliers})`);
  t.ok(!SPECIES.voltwing.flies && !A.abilitiesOf(SPECIES.voltwing).includes('fly'), 'Voltwing\'s small wings are a look only: it never flies');
  const rides = TRAITS.rideable.species;
  const sky = Object.keys(rides).filter(id => rides[id] === 'sky' && !A.abilitiesOf(SPECIES[id]).includes('fly'));
  const water = Object.keys(rides).filter(id => rides[id] === 'water' && !A.abilitiesOf(SPECIES[id]).includes('swim'));
  t.ok(!sky.length && !water.length, `every sky-ride species is in a Fly type (${sky}), every water-ride species in a Swim type (${water})`);
  const byType = {};
  for (const [id, s] of all) if (!s.kit) (byType[s.type] ??= new Set()).add(JSON.stringify(A.abilitiesOf(s, { species: id })));
  const mixed = Object.entries(byType).filter(([, set]) => set.size > 1).map(e => e[0]);
  t.ok(!mixed.length, `every creature of a type has the same abilities (${mixed})`);
  t.ok(A.hasAbility(SPECIES.bubbuck, null, 'swim') && !A.hasAbility(SPECIES.emberpup, null, 'swim') && same(A.abilitiesOf(null), []), 'hasAbility, and nothing for no species');

  // the guardian: Fly from its parts, plus the one chosen ability
  const wings = KIT.back.findIndex(b => b.fly), cloud = KIT.legs.findIndex(l => l.hover);
  const g = SPECIES.guardian, des = (back, legs, ab) => cleanDesign({ p: [0, 0, 0, legs, 0, back, 0], c: BARE.c, ab });
  t.ok(same(A.abilitiesOf(g, { paint: des(0, 1) }), []) && same(A.abilitiesOf(g, { paint: des(wings, 1) }), ['fly']) && same(A.abilitiesOf(g, { paint: des(0, cloud) }), ['fly']),
    'a guardian flies only with wings or a cloud');
  t.ok(same(A.abilitiesOf(g, { paint: des(wings, 1, 'heal') }), ['fly', 'heal']) && same(A.abilitiesOf(g, { paint: des(0, 1, 'dig') }), ['dig']), 'plus the one ability chosen');
  t.ok(des(0, 1, 'heal').ab === 'heal' && !('ab' in des(0, 1, 'fly')) && !('ab' in des(0, 1, 'nope')) && !('ab' in des(0, 1, 7)) && !('ab' in cleanDesign(null)),
    'cleanDesign keeps a chosen ability and drops Fly and junk');
  t.ok(same(A.abilitiesOf(g, null), []) && same(A.abilitiesOf(g, { paint: [1, 2, 3] }), []) && same(A.abilitiesOf(SPECIES.inkwing, { paint: [1, 2, 3] }), []),
    'no design (or an old retired guardian) = no abilities');
}

const lead = (species, level, uid, extra = {}) => ({ species, level, xp: level ** 3, hp: 20, moves: ['tackle'], uid, ...extra });
function save(design) {
  return {
    seed: 4242, edits: [], pos: [100.5, 31, 102.5], yaw: 0, pitch: 0, time: 0.3, size: [224, 224], cubes: 5, badges: [], beaten: [], savedAt: 1,
    party: [lead('emberpup', 12, 'a1'), lead('blazehound', 30, 'a2'), lead('bubbuck', 14, 'a3'), lead('guardian', 40, 'a4', { paint: design })],
    box: [lead('voltwing', 20, 'a5'), lead('fluffin', 8, 'a6')],
    seen: ['emberpup', 'blazehound', 'bubbuck', 'guardian', 'voltwing', 'fluffin'], caught: ['emberpup', 'blazehound', 'bubbuck', 'guardian', 'voltwing', 'fluffin'],
    wizard: { won: true, ally: true, design: 'guardian', look: design, wins: 1, redesign: true },
  };
}

async function browserPart(t, browser, base, ipad) {
  const tag = ipad ? 'ipad' : 'desktop';
  const design = { n: 'Sparky', p: [0, 0, 0, 1, 0, 1, 0], c: [2, 2, 7, 2, 2, 7, 2], ab: 'heal' };
  const p = await openGame(browser, base, { setup: seedSave(save(design)), ...(ipad ? { contextOptions: devices['iPad (gen 7) landscape'] } : {}) });
  await continueGame(p);
  await waitFor(p, () => window.pokecraft.started);
  await p.evaluate(() => document.exitPointerLock?.());
  const quiet = () => p.evaluate(() => document.querySelectorAll('#toast > div, #toasts > div').forEach(d => d.remove()));
  const chipsOf = sel => p.evaluate(sel => [...document.querySelectorAll(sel)].map(n => [...n.querySelectorAll('.abi')].map(a => a.dataset.ability)), sel);

  await p.evaluate(() => window.pokecraft.ui.openPanel('team'));
  await p.waitForTimeout(400);
  const team = await chipsOf('#party-list .mon');
  t.ok(same(team[0], ['glow', 'burn']) && same(team[0], team[1]), `${tag}: the team screen: Emberpup and Blazehound (both Fire) show the same chips (${JSON.stringify(team)})`);
  t.ok(same(team[2], ['swim']) && same(team[3], ['fly', 'heal']), `${tag}: Bubbuck swims, the guardian with wings flies and heals as chosen`);
  const box = await chipsOf('#box-list .mon, #party-panel .mon');
  t.ok(box.some(l => same(l, ['glow', 'zap'])) && box.some(l => same(l, ['push'])), `${tag}: the box cards too (Voltwing glows and zaps, Fluffin pushes)`);
  const size = await p.evaluate(() => { const a = document.querySelector('#party-list .abi'); const r = a.getBoundingClientRect(); return { h: r.height, f: parseFloat(getComputedStyle(a).fontSize) }; });
  t.ok(size.h >= 20 && size.f >= 18, `${tag}: a chip is readable (${size.h.toFixed(0)} px high, font ${size.f} px)`);
  await quiet(); await p.screenshot({ path: `${SHOTS}/abilities-team-${tag}.png` });
  await p.evaluate(() => window.pokecraft.ui.closePanel());

  // the Book: a creature's page and a type's page
  const book = await p.evaluate(async () => {
    const g = window.pokecraft, wait = () => new Promise(r => setTimeout(r, 300)), ids = () => [...document.querySelectorAll('#book .abis .abi')].map(a => a.dataset.ability);
    const out = {};
    g.book.open({ species: 'blazehound' }); await wait(); out.blaze = ids();
    g.book.open({ species: 'emberpup' }); await wait(); out.ember = ids();
    g.book.open({ species: 'guardian' }); await wait(); out.guardian = ids();
    g.book.open({ type: 'mind' }); await wait(); out.mind = ids(); out.mindText = document.getElementById('book-typeabis')?.textContent;
    g.book.open({ type: 'custom' }); await wait(); out.custom = document.getElementById('book-typeabis')?.textContent;
    g.book.open({ type: 'fire' }); await wait();
    return out;
  });
  t.ok(same(book.blaze, ['glow', 'burn']) && same(book.blaze, book.ember) && same(book.guardian, ['fly', 'heal']), `${tag}: the Book's creature pages (${JSON.stringify(book)})`);
  t.ok(same(book.mind, ['fly', 'lift', 'sense']) && /Every Mind creature/.test(book.mindText) && /wings or a cloud/.test(book.custom), `${tag}: the type pages say what every creature of the type can do`);
  await quiet(); await p.screenshot({ path: `${SHOTS}/abilities-booktype-${tag}.png` });
  await p.evaluate(async () => { window.pokecraft.book.open({ species: 'blazehound' }); await new Promise(r => setTimeout(r, 400)); });
  await quiet(); await p.screenshot({ path: `${SHOTS}/abilities-book-${tag}.png` });
  await p.evaluate(() => { const g = window.pokecraft; g.closeBook(); if (g.ui.panelOpen) g.ui.closePanel(); });

  // the creature you are (chapter 3): its chips in the HUD's team list, icons only (being stood in for: no Wobbleland needed)
  const hud = await p.evaluate(() => {
    const g = window.pokecraft, real = g.being;
    g.being = { on: true, creature: g.party[1] };
    try { g.ui.renderHud(); return [...document.querySelectorAll('#party-mini .mini')].map(m => [...m.querySelectorAll('.abi')].map(a => a.dataset.ability)); }
    finally { g.being = real; }
  });
  t.ok(same(hud, [[], ['glow', 'burn'], [], []]), `${tag}: the creature you are shows its chips, the others none (${JSON.stringify(hud)})`);
  // for the picture the stand-in stays over a frame: the HUD is redrawn every frame (only `on` and `creature` change)
  await p.evaluate(() => { const g = window.pokecraft, real = g.being; window.__realBeing = real;
    g.being = new Proxy(real, { get: (o, k) => (k === 'on' ? true : k === 'creature' ? g.party[1] : typeof o[k] === 'function' ? o[k].bind(o) : o[k]) }); g.ui.renderHud(); });
  await p.waitForTimeout(300);
  await quiet(); await p.screenshot({ path: `${SHOTS}/abilities-hud-${tag}.png`, clip: { x: 0, y: 0, width: 420, height: 260 } });
  await p.evaluate(() => { window.pokecraft.being = window.__realBeing; window.pokecraft.ui.renderHud(); });

  // the drawing board's Ability tab: pick one, the design keeps it
  await p.evaluate(() => window.pokecraft.openBoard());
  await waitFor(p, () => !!document.querySelector('#db-tabs [data-slot="ability"]'));
  const tabs = await p.evaluate(() => document.querySelectorAll('#db-tabs .db-tab').length);
  await p.evaluate(() => document.querySelector('#db-tabs [data-slot="ability"]').click());
  await waitFor(p, () => document.querySelectorAll('#db-parts .db-abil').length > 0);
  const board = await p.evaluate(() => ({ n: document.querySelectorAll('#db-parts .db-abil').length, fly: !!document.querySelector('#db-parts [data-ability="fly"]'),
    on: document.querySelector('#db-parts .db-abil.on')?.dataset.ability, line: document.querySelector('.db-abline')?.textContent }));
  const stray = await p.evaluate(() => /false/.test(document.getElementById('db-tabs').textContent));
  t.ok(tabs === 8 && !stray && board.n === 18 && !board.fly && board.on === 'heal' && /wings/.test(board.line), `${tag}: the board's Ability tab: 18 to choose (no Fly), the saved pick shown (${JSON.stringify(board)}, ${tabs} tabs)`);
  await p.evaluate(() => document.querySelector('#db-parts [data-ability="dig"]').click());
  await p.waitForTimeout(300);
  await quiet(); await p.screenshot({ path: `${SHOTS}/abilities-board-${tag}.png` });
  const picked = await p.evaluate(async () => {
    const g = window.pokecraft;
    g.studio.choose(g.studio.draft);
    await new Promise(r => setTimeout(r, 300));
    const c = g.party.find(x => x.species === 'guardian');
    const saved = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
    return { ab: c.paint.ab, look: saved.wizard.look.ab, kept: saved.party.find(x => x.species === 'guardian').paint.ab };
  });
  t.ok(picked.ab === 'dig' && picked.look === 'dig' && picked.kept === 'dig', `${tag}: the new pick is saved in the design (${JSON.stringify(picked)})`);
  t.ok(!p.errors.length, `${tag}: no page errors ${p.errors.join('; ')}`);
  await p.context().close();
}

export default async function ({ browser, base, t }) {
  if (want('node')) await node(t);
  if (want('desktop')) await browserPart(t, browser, base, false);
  if (want('ipad')) await browserPart(t, browser, base, true);
}
