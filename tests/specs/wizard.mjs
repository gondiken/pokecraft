// Wave 19 (plans/wave19-wizard-tower.md). Stage A: the Custom type and the `paint` field. Stage B: the Wizard's Tower (behind ?preview).
// Parts (WIZARD_ONLY=data|chart|paint|travel|old|canvas|land|bridge|painting|tower|ipad|closed|pair|shots, comma-separated):
//   data    the type, six designs (own shapes, one merged swirl badge, models animate with and without paint), moves + the signature + the
//           three big moves, fx recipes, the sounds, wool 137 "Canvas Wool", the twelve paints against the atlas
//   chart   the custom row and the five separate cells, no old cell changed (tests/fixtures/chart-before-wizard.json), weak counts
//   paint   cleanPaint / fixPaint / paintModel / buildModel(species, paint) / portraits / guardianLevel, box and trade cards, the Book
//   travel  two browsers: the lead avatar and a duel show the guardian in its owner's colours, the save keeps the paint
//   old     a save without paint / with junk paint, paint on a non-designed creature dropped, a duel from VERSION 12 refused kindly
//   canvas  (stage B) the five floors as data, checkCanvas with free groups, the naive / skilled bots, the terrain on a stand-in, the walk graph (no way up
//           with the stairs doors shut, exactly floors 1..k + 1 with doors 1..k open), the painter's cast from the mat (tests/wizardcheck.mjs, in Node and in the page)
//   land    the realm in the game: its def, nothing can be built, the game's tower = the stand-in's block for block, the arrival, the Wizard
//   bridge  the Swirl's door: sealed one star short (with the count), swirling with every needed star, the live open, the guide, an ally; and with the
//           Cube Planets world asleep: cloud stones, the door opens without it (the state after the owner opens the tower)
//   painting real keys and clicks through the game's loop (floor 1), taps from the mat on floors 2-5, the hint clock at 60 / 20 steps a second, a reload
//   tower   Swirl -> tower -> both ways back, a save inside loads inside
//   ipad    an emulated iPad: taps on pots and squares, the big button, Place / Ride, the easel card
//   closed  without ?preview: today's door and words, no realm, a save made inside loads in the main world
//   pair    two browsers: the guest follows into the tower, paints its own canvas, the Wizard's star words for a guest without stars
//   shots   screenshots (tests/screenshots/w19-*.png)
// (The Wizard's battle, the drawing board and the ending are stage C: their parts come with them.)
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, seedSave, continueGame, waitFor } from '../helpers.mjs';
import { analyze, bridgeRules } from '../wizardcheck.mjs';

const only = process.env.WIZARD_ONLY;
const want = name => !only || only.split(',').includes(name);
const DESIGNS = ['brushtail', 'palettoad', 'inkwing', 'crayonix', 'framesaur', 'blotbun'];
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); }); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };
const retry = async (fn, n = 3) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || !/Timeout/.test(e.message)) throw e; console.log('  (the page was slow to start: trying again)'); } } };
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
// A Champion in the Swirl.
async function intoSwirl(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
}

export default async function ({ browser, base, t }) {
  if (want('data') || want('chart') || want('paint')) {
    const page = await openGame(browser, base);
    if (want('data')) {
      const a = await page.evaluate(async DESIGNS => {
        const S = await import('/src/species.js'), SH = await import('/src/shapes.js'), FX = await import('/src/fxrecipes.js');
        const BK = await import('/src/blocks.js'), C = await import('/src/custom.js'), THREE = await import('three');
        const src = await (await fetch('/src/sound.js')).text();
        const out = { problems: [] };
        const bad = m => out.problems.push(m);
        if (!S.TYPE_COLORS.custom || !/#f2ead8/.test(S.TYPE_COLORS.custom)) bad('type colour');
        const mine = Object.entries(S.SPECIES).filter(([, s]) => s.type === 'custom').map(([id]) => id).sort();
        out.mine = mine.join();
        const shapes = new Set();
        const sig = g => { let sum = 0; g.updateMatrixWorld(true); g.traverse(o => { if (o.isMesh) for (const v of o.matrixWorld.elements) sum += v; }); return sum; };
        const colours = g => { const s = new Set(); g.traverse(o => { if (o.isMesh && !o.userData.eye && o.material.color) s.add(o.material.color.getHex()); }); return s; };
        out.sizes = {};
        for (const id of DESIGNS) {
          const sp = S.SPECIES[id];
          if (!sp || sp.type !== 'custom' || !sp.legendary || !sp.designed || sp.catchRate !== 0) { bad(`${id} flags`); continue; }
          if (Object.values(sp.base).reduce((x, y) => x + y, 0) !== 400) bad(`${id} base total`);
          if (!sp.desc || sp.desc.length > 120) bad(`${id} desc ${sp.desc?.length}`);
          if (!Array.isArray(sp.defaultPaint) || sp.defaultPaint.length !== 3 || !sp.defaultPaint.every(i => C.PAINTS[i])) bad(`${id} defaultPaint`);
          shapes.add(sp.model.shape);
          if (typeof SH.SHAPES[sp.model.shape] !== 'function') bad(`${id} no shape ${sp.model.shape}`);
          if (Object.entries(S.SPECIES).some(([o, s]) => s.model.shape === sp.model.shape && o !== id)) bad(`shape ${sp.model.shape} is used by another creature`);
          if (sp.evolve) bad(`${id} evolves`);
          const lm = sp.learn.map(e => e[1]);
          if (!sp.learn.some(([l, m]) => l === 40 && m === 'swirlseal')) bad(`${id} learns Swirl Seal at 40`);
          for (const [m, k] of [['bigmural', 'field'], ['paintshield', 'shield'], ['finaltouch', 'lastword']]) if (!sp.learn.some(([l, mv]) => mv === m && l === S.BIG_LEVEL[k])) bad(`${id} lacks ${m}`);
          for (const m of ['brushdab', 'quickstroke', 'paletteblast', 'freshcoat']) if (!lm.includes(m)) bad(`${id} lacks ${m}`);
          // the model colours are the default paint's
          const want = C.paintColours(sp.defaultPaint);
          for (const k of ['body', 'accent', 'belly', 'dark']) if (sp.model[k] !== want[k]) bad(`${id} model.${k}`);
          // models: with and without paint, animate, badge, eyes, size
          for (const paint of [undefined, [0, 1, 2], [11, 10, 9]]) {
            const mdl = S.buildModel(id, paint);
            const box = new THREE.Box3().setFromObject(mdl), size = box.getSize(new THREE.Vector3());
            if (!paint) out.sizes[id] = [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)].join('x');
            if (size.y < 0.5 || size.y > 2.4) bad(`${id} height ${size.y.toFixed(2)}`);
            if (size.x > 2.4 || size.z > 2.4) bad(`${id} width ${size.x.toFixed(2)}`);
            if (box.min.y < -0.1) bad(`${id} under the ground ${box.min.y.toFixed(2)}`);
            S.animateModel(mdl, 0.3, false); const s1 = sig(mdl); S.animateModel(mdl, 1.1, true); const s2 = sig(mdl);
            if (Math.abs(s1 - s2) < 1e-6) bad(`${id} does not animate`);
            let badges = 0, eyes = 0, badgeOk = false;
            mdl.traverse(o => { if (o.userData.gear === 'swirlbadge') { badges++; badgeOk = o.isMesh && !!o.geometry.attributes.color; } if (o.userData.eye) eyes++; });
            if (badges !== 1 || !badgeOk) bad(`${id} swirl badge: ${badges} (one merged mesh)`);
            if (eyes < 2) bad(`${id} has no eyes`);
            S.disposeModel(mdl);
          }
        }
        out.shapes = shapes.size;
        // moves
        const M = S.MOVES;
        const m = (id, power, acc) => { if (!M[id] || M[id].type !== 'custom' || M[id].power !== power || Math.abs(M[id].acc - acc) > 1e-9) bad(`move ${id} ${JSON.stringify(M[id])}`); };
        m('brushdab', 40, 1); m('paletteblast', 85, 0.9); m('quickstroke', 40, 1); m('freshcoat', 0, 1); m('swirlseal', 90, 1);
        if (!M.quickstroke.priority || M.freshcoat.fx.kind !== 'raise' || M.freshcoat.fx.stat !== 'def' || !M.swirlseal.sig || !M.swirlseal.sure) bad('move details');
        const bigs = { bigmural: 'field', paintshield: 'shield', finaltouch: 'lastword' };
        out.big = Object.entries(bigs).map(([id, k]) => [id, S.isBig(id), S.MOVES[id]?.fx?.kind === k, S.MOVES[id]?.type]).join(';');
        const names = Object.keys(M).filter(k => M[k].type === 'custom').map(k => M[k].name);
        if (new Set(names).size !== names.length || names.length !== 8) bad(`move names ${names.join()}`);
        for (const id of Object.keys(M).filter(k => M[k].type === 'custom')) if (new RegExp(`(^|\\n)\\s*['"]?${id}['"]?\\s*:\\s*\\(`).test(src)) bad(`move id ${id} is a sound name`);
        // fx and sounds
        if (!FX.TRAVEL.custom || FX.TRAVEL.custom === FX.TRAVEL.normal || FX.IMPACT.custom === FX.IMPACT.normal || !FX.IMPACT.custom || !FX.FX_COLORS.custom || FX.FX_COLORS.custom === FX.FX_COLORS.normal) bad('fx falls back to normal');
        if (!FX.SIG.swirlseal) bad('no signature fx');
        if (!/'fx:custom': \(\) =>/.test(src)) bad('no own fx:custom sound');
        for (const id of ['paintpick', 'paintdab', 'paintdone']) { if (!new RegExp(`\\n\\s*${id}: \\(`).test(src)) bad(`sound ${id}`); if (M[id]) bad(`sound ${id} is a move id`); }
        // wool 137
        const W = BK.WOOL;
        if (W.custom !== 137 || BK.BLOCKS[137]?.name !== 'Canvas Wool' || BK.PLACEABLE.includes(137)) bad('wool 137');
        if (new Set(Object.values(W)).size !== Object.keys(W).length) bad('wool ids clash');
        // the twelve paints = plain wool tiles of the atlas
        const atlas = BK.drawAtlas();
        const ctx = (atlas.canvas || atlas).getContext?.('2d');
        out.paints = [];
        if (!ctx) bad('no atlas canvas'); else C.PAINTS.forEach((p, i) => {
          const def = BK.BLOCKS[W[p.wool]];
          if (!def) { bad(`paint ${i} wool ${p.wool}`); return; }
          const tile = def.top, d = ctx.getImageData(BK.tileX(tile), BK.tileY(tile), 16, 16).data;
          const want = [(p.hex >> 16) & 255, (p.hex >> 8) & 255, p.hex & 255];
          let worst = 0;
          const mean = [0, 0, 0];
          for (let k = 0; k < 256; k++) for (let c = 0; c < 3; c++) { worst = Math.max(worst, Math.abs(d[k * 4 + c] - want[c]) / Math.max(want[c], 40)); mean[c] += d[k * 4 + c] / 256; }
          if (worst > 0.22) bad(`paint ${p.name}: its wool tile is not plain (worst ${worst.toFixed(2)})`);
          if (mean.some((v, c) => Math.abs(v - want[c]) > 14)) bad(`paint ${p.name}: tile ${mean.map(Math.round)} vs hex ${want}`);
          out.paints.push(p.name);
        });
        if (C.PAINTS.length !== 12 || new Set(C.PAINTS.map(p => p.hex)).size !== 12 || new Set(C.PAINTS.map(p => p.wool)).size !== 12 || C.WASH !== -1) bad('paints list');
        return out;
      }, DESIGNS);
      t.ok(a.mine === [...DESIGNS].sort().join(), `six Custom creatures (${a.mine})`);
      t.ok(a.shapes === 6, `six own body shapes (${a.shapes})`);
      t.ok(!a.problems.length, `type, designs, moves, fx, sounds, wool 137 and the paints are all in place ${a.problems.join('; ')}`);
      t.ok(a.big === 'bigmural,true,true,custom;paintshield,true,true,custom;finaltouch,true,true,custom', `the three big moves (${a.big})`);
      t.ok(a.paints.length === 12, `twelve paints match their plain wool tiles (${a.paints.join(', ')})`);
      console.log('  sizes', JSON.stringify(a.sizes));
    }
    if (want('chart')) {
      const c = await page.evaluate(async () => {
        const S = await import('/src/species.js');
        const fixture = await (await fetch('/tests/fixtures/chart-before-wizard.json')).json();
        const E = S.effectiveness, types = Object.keys(S.TYPE_COLORS);
        const out = {};
        out.row = ['portal', 'doodle', 'normal', 'metal', 'ghost', 'custom', 'fire'].map(d => E('custom', d)).join();
        out.cells = ['water', 'toxic', 'time'].map(a => E(a, 'custom')).join() + '|' + ['doodle', 'rainbow'].map(a => E(a, 'custom')).join();
        let changed = 0, cells = 0;
        const odd = [];
        for (const a of fixture.types) for (const d of fixture.types) { cells++; if (E(a, d) !== (fixture.chart[a]?.[d] ?? 1)) { changed++; odd.push(`${a}>${d}`); } }
        out.cells2 = cells; out.changed = changed; out.odd = odd;
        const weak = d => types.filter(a => E(a, d) > 1).length;
        const before = d => fixture.types.filter(a => (fixture.chart[a]?.[d] ?? 1) > 1).length;
        out.weak = Object.fromEntries(['custom', 'portal', 'doodle', 'normal'].map(d => [d, weak(d)]));
        out.over = types.filter(d => weak(d) > Math.max(5, fixture.types.includes(d) ? before(d) : 0)).map(d => `${d} ${weak(d)}`);
        out.types = types.length; out.old = fixture.types.length;
        out.grew = fixture.types.filter(d => weak(d) > before(d)).sort().join();
        return out;
      });
      t.ok(c.row === '2,2,2,0.5,0.5,0.5,1', `the custom row (${c.row})`);
      t.ok(c.cells === '2,2,2|0.5,0.5', `the five separate cells (${c.cells})`);
      t.ok(c.changed === 0, `no old chart cell changed (${c.cells2} cells of the ${c.old} old types, changed: ${c.odd.join()})`);
      t.ok(c.types === c.old + 2, `one new type, plus wave 18's Mirror (${c.types})`);
      t.ok(c.grew === 'doodle,ninja,normal,portal,surprise', `only portal, doodle and normal became weak to one more type (and ninja, surprise and doodle again through wave 18's Mirror) (${c.grew})`);
      t.ok(!c.over.length && c.weak.custom <= 5, `no defender is weak to more than 5 types (or more than before) ${c.over.join(', ')} (custom ${c.weak.custom}, portal ${c.weak.portal}, doodle ${c.weak.doodle}, normal ${c.weak.normal})`);
    }
    if (want('paint')) {
      await newGame(page, 0);
      await page.evaluate(() => document.exitPointerLock());
      const p = await page.evaluate(async () => {
        const S = await import('/src/species.js'), C = await import('/src/custom.js'), THREE = await import('three');
        const { portrait } = await import('/src/ui.js'), SC = await import('/src/swapcore.js');
        const g = window.pokecraft;
        const out = { problems: [] };
        const bad = m => out.problems.push(m);
        const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
        const sp = S.SPECIES;
        // 1. the pure rules
        const def = sp.brushtail.defaultPaint;
        if (!eq(C.cleanPaint([0, 1, 2], 'brushtail', sp), [0, 1, 2])) bad('clean keeps a good triple');
        if (!eq(C.cleanPaint([99, -1, 'x'], 'brushtail', sp), def)) bad('junk -> default');
        if (!eq(C.cleanPaint([5], 'brushtail', sp), [5, def[1], def[2]])) bad('a short list is completed');
        if (!eq(C.cleanPaint([1.5, 2, 3, 4, 5], 'brushtail', sp), [def[0], 2, 3])) bad('a fraction is junk, extras dropped');
        if (!eq(C.cleanPaint(null, 'inkwing', sp), sp.inkwing.defaultPaint) || !eq(C.cleanPaint('red', 'inkwing', sp), sp.inkwing.defaultPaint)) bad('no list -> default');
        if (C.cleanPaint([0, 1, 2], 'fluffin', sp) !== undefined || C.cleanPaint([0, 1, 2], 'nobody', sp) !== undefined || C.cleanPaint([0, 1, 2], 'zenithar', sp) !== undefined) bad('non-designed -> undefined');
        const list = [{ species: 'fluffin', paint: [1, 2, 3] }, { species: 'palettoad', paint: [4, 5, 99] }, { species: 'blotbun' }, null, 5];
        const same = C.fixPaint(list, sp);
        if (same !== list || 'paint' in list[0] || !eq(list[1].paint, [4, 5, sp.palettoad.defaultPaint[2]]) || !eq(list[2].paint, sp.blotbun.defaultPaint)) bad('fixPaint');
        C.fixPaint(undefined, sp); C.fixPaint('x', sp); // nothing to fix: no throw
        const lv = l => C.guardianLevel(l.map(level => ({ level })), S.MAX_LEVEL);
        if (lv([]) !== 50 || lv([{}]) !== 50 || lv([10, 20]) !== 50 || lv([70, 30]) !== 65 || lv([100]) !== 95 || lv([55]) !== 50 || lv([56]) !== 51) bad(`guardianLevel ${lv([10, 20])} ${lv([70, 30])} ${lv([100])}`);
        const cm = C.paintModel(sp.inkwing.model, [0, 1, 2]);
        if (cm === sp.inkwing.model || cm.body !== C.PAINTS[0].hex || cm.accent !== C.PAINTS[1].hex || cm.belly !== C.PAINTS[2].hex || cm.shape !== 'quillbird' || sp.inkwing.model.body === cm.body) bad('paintModel');
        if (C.paintModel(sp.inkwing.model, null) !== sp.inkwing.model) bad('paintModel without paint');
        // 2. models take the paint
        const colours = (id, paint) => { const m = S.buildModel(id, paint), s = new Set(); m.traverse(o => { if (o.isMesh && o.material.color) s.add(o.material.color.getHex()); }); S.disposeModel(m); return s; };
        for (const id of ['brushtail', 'palettoad', 'inkwing', 'crayonix', 'framesaur', 'blotbun']) {
          const paint = [6, 8, 2], c = colours(id, paint), w = C.paintColours(paint);
          for (const k of ['body', 'accent', 'belly', 'dark']) if (!c.has(w[k])) bad(`${id} model lacks its ${k}`);
          const d = colours(id), dw = C.paintColours(sp[id].defaultPaint);
          if (!d.has(dw.body) || !d.has(dw.accent)) bad(`${id} default colours`);
          if (id !== 'palettoad' && c.has(dw.body) && dw.body !== w.body && dw.body !== w.accent && dw.body !== w.belly) bad(`${id} still wears its old body colour`);
        }
        const f1 = colours('fluffin'), f2 = colours('fluffin', [0, 1, 2]);
        if (f1.size !== f2.size || [...f1].some(x => !f2.has(x))) bad('a non-designed species ignores paint');
        // 3. portraits and the creature
        const pa = portrait('brushtail', 60, 52, false, [0, 1, 2]), pb = portrait('brushtail', 60, 52, false, [6, 7, 8]), pc = portrait('brushtail', 60, 52, false, [0, 1, 2]);
        if (pa === pb || pa !== pc) bad('portraits: the cache key holds the paint');
        const c1 = S.makeCreature('crayonix', 60), c2 = S.makeCreature('crayonix', 60);
        if (!eq(c1.paint, sp.crayonix.defaultPaint) || c1.paint === sp.crayonix.defaultPaint || c1.paint === c2.paint) bad('makeCreature paint is its own copy of the default');
        if ('paint' in S.makeCreature('fluffin', 5)) bad('fluffin has paint');
        // 4. one of a kind: trades and let go
        const mk = (id, paint) => { const c = S.makeCreature(id, 50); c.paint = paint; return c; };
        const mine = mk('framesaur', [4, 5, 6]), plain = S.makeCreature('fluffin', 8), plain2 = S.makeCreature('blazehound', 8);
        if (SC.cleanCreature({ ...mine }) !== null || SC.creatureItem?.(mine)) bad('a designed creature can be traded (cleanCreature)');
        g.party = [S.makeCreature('blazehound', 20), mine]; g.box = [mk('blotbun', [1, 2, 3]), plain];
        const card = (c, i, inParty) => g.ui.monCard(c, i, inParty);
        const lg = el => el.querySelector('button.letgo');
        if (!lg(card(g.box[0], 0, false))?.classList.contains('dim') || lg(card(g.box[0], 0, false)).textContent !== 'Stays with you') bad('box card of a guardian: Let go is dim "Stays with you"');
        if (lg(card(g.box[1], 1, false))?.classList.contains('dim') || lg(card(g.box[1], 1, false))?.textContent !== 'Let go') bad('box card of a fluffin: Let go');
        if (!card(g.party[1], 1, true).querySelector('img')?.src.startsWith('data:')) bad('team card picture');
        // the trade screen's Offer button
        Object.defineProperty(g.swaps, 'session', { configurable: true, get: () => ({ state: 'pick', mine: [], theirs: [], name: 'Kid', ready: false, theirReady: false, note: '' }) });
        const ob = g.swapUi.view.buttons(mine, true)[0], ob2 = g.swapUi.view.buttons(plain2, false)[0];
        if (!ob.classList.contains('dim') || ob.textContent !== 'Stays with you') bad(`trade card of a guardian: ${ob.textContent}`);
        if (ob2.classList.contains('dim') || !/Offer/.test(ob2.textContent)) bad('trade card of a normal creature');
        g.swaps.put(mine); // ignored
        delete g.swaps.session;
        // 5. the Book
        g.party = [S.makeCreature('blazehound', 20)]; g.box = [];
        g.book.open({ type: 'custom' });
        out.note = document.getElementById('book-designed-note')?.textContent || '';
        g.book.open({ species: 'inkwing' });
        out.page1 = document.getElementById('book-detail')?.textContent || '';
        g.party.push(mk('inkwing', [0, 1, 2]));
        g.book.syncTeam?.(); g.book.open({ species: 'inkwing' });
        out.page2 = document.getElementById('book-detail')?.textContent || '';
        out.live = [...document.querySelectorAll('#book-detail .book-sec h3')].map(h => h.textContent).join();
        g.book.close();
        return out;
      });
      t.ok(!p.problems.length, `paint: the pure rules, models, portraits, one of a kind, cards ${p.problems.join('; ')}`);
      t.ok(/No wild Custom creatures\. Beat the Wizard and design your own!/.test(p.note), `the Custom list says there are no wild ones (${p.note})`);
      t.ok(/Designed in the Wizard's studio/.test(p.page1) && !/Designed by you/.test(p.page1), `a design you do not own: "Designed in the Wizard's studio" (${p.page1.slice(0, 80)})`);
      t.ok(/Designed by you/.test(p.page2) && !/Where it lives/.test(p.live), `your own guardian: "Designed by you", no wild-places section (${p.live})`);
    }
    t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
    await page.context().close();
  }

  if (want('travel')) {
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
    await waitFor(B, () => window.pokecraft.mp.others.size > 0, null, 30000);
    const PAINT = [6, 8, 2];
    await A.evaluate(async PAINT => {
      const S = await import('/src/species.js'), g = window.pokecraft;
      const c = S.makeCreature('palettoad', 60); c.paint = PAINT;
      g.party = [c, S.makeCreature('fluffin', 5)];
    }, PAINT);
    // the lead avatar
    await waitFor(B, () => { const o = [...window.pokecraft.mp.others.values()][0]; return o?.leadSpecies === 'palettoad' && o.leadPaint; }, null, 30000);
    const lead = await B.evaluate(async () => {
      const C = await import('/src/custom.js'), o = [...window.pokecraft.mp.others.values()][0], s = new Set();
      o.lead.traverse(m => { if (m.isMesh && m.material.color) s.add(m.material.color.getHex()); });
      const w = C.paintColours(o.leadPaint);
      return { paint: o.leadPaint, ok: [w.body, w.accent, w.belly].every(h => s.has(h)) };
    });
    t.ok(JSON.stringify(lead.paint) === JSON.stringify(PAINT) && lead.ok, `the friend's lead is painted in its owner's colours (${JSON.stringify(lead.paint)})`);
    // a duel
    await A.evaluate(() => { const g = window.pokecraft; g.duels.challenge([...g.mp.others.values()][0]); });
    await waitFor(B, () => window.pokecraft.duels.incoming, null, 30000);
    const got = await B.evaluate(() => window.pokecraft.duels.incoming.team.map(c => c.paint));
    t.ok(JSON.stringify(got[0]) === JSON.stringify(PAINT) && got[1] == null, `the challenged friend receives the paint (${JSON.stringify(got)})`);
    await B.evaluate(() => window.pokecraft.duels.accept());
    await waitFor(B, () => window.pokecraft.inBattle && window.pokecraft.battle?.foes?.length && window.pokecraft.battle.foeModel, null, 90000);
    const fb = await B.evaluate(async () => {
      const g = window.pokecraft, C = await import('/src/custom.js'), b = g.battle, f = b.foes[0];
      const s = new Set(); b.foeModel?.traverse?.(m => { if (m.isMesh && m.material.color) s.add(m.material.color.getHex()); });
      const w = C.paintColours(f.paint || [0, 0, 0]);
      return { species: f.species, paint: f.paint, model: s.size > 0 ? [w.body, w.accent].every(h => s.has(h)) : null };
    });
    t.ok(fb.species === 'palettoad' && JSON.stringify(fb.paint) === JSON.stringify(PAINT), `the duel copy keeps the paint (${fb.species} ${JSON.stringify(fb.paint)})`);
    t.ok(fb.model !== false, `the foe's model wears it (${fb.model})`);
    // my own save keeps it
    const saved = await A.evaluate(() => { const g = window.pokecraft; g.save?.(true); return JSON.parse(localStorage.getItem('pokecraft-save-v2')).party[0].paint; });
    t.ok(JSON.stringify(saved) === JSON.stringify(PAINT), `the save keeps the paint (${JSON.stringify(saved)})`);
    t.ok(!A.errors.length && !B.errors.length, `no page errors ${A.errors.concat(B.errors).join('; ')}`);
    await A.context().close(); await B.context().close();
  }

  if (want('old')) {
    const mk = (species, level, extra = {}) => ({ species, level, xp: level ** 3, hp: 30, moves: ['tackle'], ...extra });
    const save = {
      seed: 4242, edits: [], pos: [100.5, 31, 102.5], yaw: 0, pitch: 0, time: 0.2, size: [224, 224], cubes: 5, badges: [], beaten: [], savedAt: 1,
      party: [mk('brushtail', 60, { uid: 'g1', traits: [], paint: [99, 'a', null] }), mk('fluffin', 5, { uid: 'g2', traits: [], paint: [1, 2, 3] }),
        mk('blazehound', 8, { uid: 'g3', traits: [] }), mk('inkwing', 60, { uid: 'g4', traits: [] })],
      box: [mk('palettoad', 55, { uid: 'g5', traits: [], paint: [4, 5, 6] }), mk('blotbun', 55, { uid: 'g6', traits: [], paint: 'blue' })],
    };
    const page = await openGame(browser, base, { setup: seedSave(save) });
    await continueGame(page);
    const r = await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js');
      const all = [...g.party, ...g.box].map(c => [c.species, c.paint]);
      g.save?.(true);
      const saved = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
      return { all, saved: [...saved.party, ...saved.box].map(c => [c.species, c.paint]), def: Object.fromEntries(['brushtail', 'inkwing', 'blotbun'].map(id => [id, S.SPECIES[id].defaultPaint])) };
    });
    const want2 = [['brushtail', r.def.brushtail], ['fluffin', undefined], ['blazehound', undefined], ['inkwing', r.def.inkwing], ['palettoad', [4, 5, 6]], ['blotbun', r.def.blotbun]];
    t.ok(JSON.stringify(r.all) === JSON.stringify(want2), `junk paint -> the design's colours; missing paint -> its colours; paint on a fluffin dropped; a good one kept (${JSON.stringify(r.all)})`);
    t.ok(JSON.stringify(r.saved) === JSON.stringify(r.all), 'the save written after Continue equals the game');
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
    await continueGame(page);
    const again = await page.evaluate(() => [...window.pokecraft.party, ...window.pokecraft.box].map(c => [c.species, c.paint]));
    t.ok(JSON.stringify(again) === JSON.stringify(r.all), 'reloading changes nothing');
    // duels: VERSION 13; a game of version 12 is refused kindly; a team's paint is cleaned
    const d = await page.evaluate(async () => {
      const g = window.pokecraft, D = await import('/src/duel.js'), sent = [];
      g.mp.sendDuel = (to, m) => sent.push(m);
      const ask = (v, team, id) => g.duels.onMessage({ type: 'ask', v, id, from: 'nobody', name: 'Odd', seed: 1, team });
      ask(12, [{ species: 'fluffin', level: 5, moves: ['tackle'] }], 'a12');
      const refused = !g.duels.incoming && sent.some(m => m.type === 'no' && m.id === 'a12' && m.old);
      ask(D.VERSION, [{ species: 'palettoad', level: 5, moves: ['tackle'], paint: [1, 2, 3, 4, 5] }, { species: 'fluffin', level: 5, moves: ['tackle'], paint: 'x' }, { species: 'inkwing', level: 5, moves: ['tackle'] }], 'a13');
      const team = g.duels.incoming?.team.map(c => c.paint);
      return { version: D.VERSION, refused, team };
    });
    t.ok(d.version === 13, `duel VERSION is ${d.version}`);
    t.ok(d.refused, 'a duel ask from VERSION 12 is refused kindly (no, old)');
    t.ok(JSON.stringify(d.team) === JSON.stringify([[1, 2, 3], undefined, undefined]), `a team's paint arrives as at most three numbers (${JSON.stringify(d.team)})`);
    t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
    await page.context().close();
  }

  /* ==== Stage B: the tower (plans/wave19-wizard-tower.md sections 4-6, 9-12) ==== */
  if (want('canvas')) {
    // Node: the floors as data, the checker, the bots, the terrain on a stand-in, the walk graph, the cast (tests/wizardcheck.mjs); the same code in the page's module graph
    const r = analyze(1), b = await bridgeRules();
    t.ok(!r.problems.length && !b.problems.length, `canvas / checker / bots / terrain / walk graph / cast in Node (${JSON.stringify(r.info)}) ${[...r.problems, ...b.problems].join('; ')}`);
    t.ok(r.info.squares === '12,26,14,24,34', `the squares to paint: ${r.info.squares}`);
    t.ok(r.info.naive === '0,0,0,0,0', `the naive bot (600 random taps, 200 seeds) never finishes a floor: ${r.info.naive}`);
    const page = await openGame(browser, base);
    const p = await page.evaluate(async () => {
      const W = await import('/tests/wizardcheck.mjs');
      const a = W.analyze(2), b = await W.bridgeRules();
      return { problems: [...a.problems, ...b.problems], info: a.info };
    });
    t.ok(!p.problems.length && p.info.squares === '12,26,14,24,34', `the same checks pass in the browser's module graph ${p.problems.join('; ')}`);
    t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
    await page.context().close();
  }

  if (want('land') || want('bridge') || want('painting') || want('tower') || want('shots')) {
    // ONE page for the tower parts that need a game: a Champion with every needed star in the Swirl
    const page = await retry(() => openGame(browser, base));
    await newGame(page, 0);
    await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.weather?.set?.('clear'); g.time = 0.25; });
    await intoSwirl(page);
    const swirlInfo = async () => page.evaluate(async () => {
      const g = window.pokecraft, w = g.world, wz = w.swirl.wizard;
      await new Promise(r => setTimeout(r, 900));
      return { door: [...new Set(wz.door.map(c => w.get(...c)))].join(), info: g.portal.info(), place: g.place };
    });
    if (want('bridge')) {
      const need = await page.evaluate(async () => { const PW = await import('/src/pictureworlds.js'); return PW.bridgeNeed().map(w => w.id); });
      t.ok(need.length >= 12, `the bridge needs ${need.length} stars (every open world)`);
      // one star short: sealed with the count in the words
      const short = await page.evaluate(async need => {
        const g = window.pokecraft, WT = await import('/src/wizardtower.js'), BK = await import('/src/blocks.js');
        g.stars = need.slice(1);
        window.__toasts = []; const toast = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); toast(m); };
        for (let i = 0; i < 300 && g.portal.info()?.lit?.split('|')[0] !== g.stars.join(); i++) await new Promise(r => setTimeout(r, 100));
        const wz = g.world.swirl.wizard, c = wz.door[0], blk = { x: c[0], y: c[1], z: c[2], id: g.world.get(...c) };
        g.portal.use(blk);
        return { block: g.world.get(...c), stone: BK.B.WIZARD_STONE, open: WT.towerOpen(g), toast: window.__toasts.at(-1), prompt: g.portal.prompt(blk, 'tap'), action: g.portal.action(blk), info: g.portal.info() };
      }, need);
      t.ok(short.block === short.stone && !short.open && !short.info.towerGlow, 'one star short: the door is still sealed Wizard Stone, no glow');
      t.ok(new RegExp(`Bring him stars! \\(⭐ ${need.length - 1} / ${need.length}\\)`).test(short.toast), `its words carry the count: ${short.toast}`);
      t.ok(/sealed/.test(short.prompt) && short.action === '', `prompt "${short.prompt}", no action word`);
      // every needed star: it swirls, the prompt and the action say so, the first time the bridge is whole there is a toast
      const all = await page.evaluate(async need => {
        const g = window.pokecraft, BK = await import('/src/blocks.js');
        g.stars = [...need];
        for (let i = 0; i < 300 && !(g.portal.info()?.towerGlow && g.world.swirl.wizard.door.every(k => g.world.get(...k) === BK.B.PORTAL)); i++) await new Promise(r => setTimeout(r, 100));
        const wz = g.world.swirl.wizard, c = wz.door[0], blk = { x: c[0], y: c[1], z: c[2], id: g.world.get(...c) };
        return { block: g.world.get(...c), portal: BK.B.PORTAL, cells: wz.door.every(k => g.world.get(...k) === BK.B.PORTAL), prompt: g.portal.prompt(blk, 'tap'), action: g.portal.action(blk), info: g.portal.info(), toasts: window.__toasts, aim: g.guide?.aim?.() ?? null };
      }, need);
      t.ok(all.cells && all.info.towerGlow, `every needed star: the door cells swirl (live) and have a glow`);
      t.ok(/Wizard's tower · tap to go in/.test(all.prompt) && all.action === 'Step in!', `prompt "${all.prompt}", action "${all.action}"`);
      t.ok(all.toasts.some(m => /The star bridge is whole! Cross it to the Wizard's tower!/.test(m)), 'the bridge-whole toast');
      // the Portal House's star won inside the Swirl is the last one: the door opens live
      const live = await page.evaluate(async need => {
        const g = window.pokecraft, BK = await import('/src/blocks.js');
        const until = async f => { for (let i = 0; i < 300 && !f(); i++) await new Promise(r => setTimeout(r, 100)); return f(); };
        const wz = g.world.swirl.wizard, is = id => wz.door.every(k => g.world.get(...k) === id);
        g.stars = need.filter(id => id !== 'portal');
        const shut = await until(() => is(BK.B.WIZARD_STONE));
        g.stars = [...need];
        const open = await until(() => is(BK.B.PORTAL));
        return { shut, open };
      }, need);
      t.ok(live.shut && live.open, `the Portal House star (won inside the Swirl) opens the door live (${JSON.stringify(live)})`);
      // the guide: an arrow to the open tower, none for an ally
      const aim = await page.evaluate(async () => {
        const g = window.pokecraft, SL = await import('/src/swirlland.js'), WT = await import('/src/wizardtower.js');
        g.player.pos.set(60, 21, 80);
        const a = SL.swirlAim(g.world, g.player.pos, g), st = WT.towerStand(g.world);
        const ally = { ...g, studio: { ally: true } }, b = SL.swirlAim(g.world, g.player.pos, ally);
        return { text: a?.text('→', 40), x: a?.x, z: a?.z, st, allyText: b?.text('→', 40) };
      });
      t.ok(/Wizard's Tower/.test(aim.text) && aim.x === aim.st[0] && aim.z === aim.st[2], `the Swirl's guide points at the tower door: "${aim.text}"`);
      t.ok(!/Wizard's Tower/.test(aim.allyText || ''), `an ally's guide does not (${aim.allyText})`);
      // an ally keeps it open whatever the stars
      const ally = await page.evaluate(async () => {
        const g = window.pokecraft, BK = await import('/src/blocks.js'), WT = await import('/src/wizardtower.js');
        const until = async f => { for (let i = 0; i < 300 && !f(); i++) await new Promise(r => setTimeout(r, 100)); return f(); };
        const wz = g.world.swirl.wizard, is = id => wz.door.every(k => g.world.get(...k) === id);
        g.stars = []; g.studio = { ally: true };
        const open = await until(() => is(BK.B.PORTAL)), o = WT.towerOpen(g);
        delete g.studio; g.stars = [];
        const shut = await until(() => is(BK.B.WIZARD_STONE));
        return { open, o, shut };
      });
      t.ok(ally.open && ally.o && ally.shut, 'an ally keeps the door open for good (whatever the stars); no ally, no stars: sealed again');
      await page.evaluate(async need => { window.pokecraft.stars = [...need]; await new Promise(r => setTimeout(r, 900)); }, need);
    }

    const intoTower = async () => {
      await page.evaluate(async () => {
        const g = window.pokecraft, PW = await import('/src/pictureworlds.js'), WT = await import('/src/wizardtower.js');
        g.stars = PW.bridgeNeed().map(w => w.id);
        const s = WT.towerStand(g.world); g.player.pos.set(s[0], s[1], s[2]); g.player.yaw = s[3]; g.player.pitch = 0;
        await new Promise(r => setTimeout(r, 700));
        const c = g.world.swirl.wizard.door[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) });
      });
      await placeIs(page, 'wizard');
      await page.waitForFunction(() => window.pokecraft.gymLive.of('part:studio'), null, { timeout: 30000 });
    };
    const live = () => page.evaluate(() => window.pokecraft.gymLive.of('part:studio').info());

    if (want('land') || want('tower')) {
      const before = await swirlInfo();
      t.ok(before.place === 'swirl', 'in the Swirl');
      await intoTower();
      const L = await page.evaluate(async () => {
        const g = window.pokecraft, w = g.world, R = await import('/src/realms.js'), BK = await import('/src/blocks.js'), WL = await import('/src/wizardland.js'), C = await import('/src/custom.js'), WT = await import('/src/wizardtower.js');
        const def = R.REALMS.wizard, out = { problems: [] }, bad = m => out.problems.push(m);
        if (!def || def.version !== 1 || def.size.join() !== '48,48' || def.parent !== 'swirl' || def.entrance !== 'tower' || def.terrain !== 'wizardLand') bad('realm def');
        if (w.realm?.id !== 'wizard' || !w.studio || !w.parts.some(p => p.live === 'studio')) bad('world');
        if (g.world.W !== 48 || R.REALMS.swirl.version !== 5 && R.REALMS.swirl.version !== 6) bad(`sizes / the Swirl's version ${R.REALMS.swirl.version}`);
        // nothing can be built, anywhere (the keep covers the map): editAllowed on a grid of cells, inside and outside the tower
        let allowed = 0, n = 0;
        for (let x = 0; x < 48; x += 3) for (let z = 0; z < 48; z += 3) for (let y = 0; y < 48; y += 4) { n++; if (w.editAllowed(x, y, z, BK.B.STONE)) allowed++; }
        out.allowed = allowed; out.cells = n;
        // the walls, slabs and glass stay: breaking and placing are refused in game terms too
        const p = g.player; out.pos = [p.pos.x, p.pos.y, p.pos.z]; out.spawnAt = w.spawnAt;
        // the terrain is the same as the stand-in's (nothing in the game changes the map but live cells)
        const W2 = await import('/tests/wizardcheck.mjs'), sw = W2.makeTower(g.world.seed);
        let diff = 0; for (let i = 0; i < sw.data.length; i++) if (sw.data[i] !== w.data[i]) diff++;
        out.diff = diff;
        out.people = w.people?.map(q => q.name);
        out.npcs = g.npcs.list.filter(q => q.def?.wizard).length;
        out.floorKeys = [1, 2, 3, 4, 5].map(WT.floorKey).join();
        return out;
      });
      t.ok(!L.problems.length, `the realm: ${L.problems.join('; ')}`);
      t.ok(L.allowed === 0, `nothing can be built: ${L.allowed} of ${L.cells} sample cells allow an edit`);
      t.ok(L.diff === 0, `the game's tower is the stand-in's tower block for block (${L.diff} differ)`);
      t.ok(L.pos.join() === '24.5,2,28.5' && L.npcs === 1, `you arrive in front of the first canvas (${L.pos}); the Wizard stands in the studio (${L.npcs})`);
    }

    if (want('tower')) {
      // the way back: both doors come out at the tower door in the Swirl; a save inside loads inside
      const saved = await page.evaluate(() => { const g = window.pokecraft; g.save(true); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { place: s.place, up: s.realmUp, pos: s.realmPos, v: s.realmVersions?.wizard }; });
      t.ok(saved.place === 'wizard' && saved.up?.id === 'swirl' && Array.isArray(saved.up.ret) && saved.v === 1, `a save inside says place wizard, realmUp the Swirl and a spot (${JSON.stringify(saved.up)})`);
      const back = async key => {
        await page.evaluate(key => { const g = window.pokecraft, d = g.world.doors.find(o => o.key === key), c = d.surface[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, key);
        await placeIs(page, 'swirl');
        return page.evaluate(async () => { const g = window.pokecraft, WT = await import('/src/wizardtower.js'), s = WT.towerStand(g.world), p = g.player.pos; return { d: Math.hypot(p.x - s[0], p.z - s[2]), dy: Math.abs(p.y - s[1]), place: g.place }; });
      };
      let r1 = await back('wizard');
      t.ok(r1.d < 0.6 && r1.dy < 0.6, `the ground floor's way back comes out at the tower door in the Swirl (${r1.d.toFixed(2)} away)`);
      await intoTower();
      await page.evaluate(() => { const g = window.pokecraft, d = g.world.doors.find(o => o.key === 'wizard-top'), a = g.world.arrivals['wizard-top']; g.player.pos.set(a[0], a[1], a[2]); });
      let r2 = await back('wizard-top');
      t.ok(r2.d < 0.6 && r2.dy < 0.6, `the studio's way back comes out at the same door (${r2.d.toFixed(2)} away)`);
      await intoTower();
      // reload: loaded inside the tower
      await page.evaluate(() => window.pokecraft.save(true));
      await page.reload({ waitUntil: 'commit' });
      await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page);
      const re = await page.evaluate(() => { const g = window.pokecraft; return { place: g.place, y: g.player.pos.y, live: !!g.gymLive.of('part:studio') }; });
      t.ok(re.place === 'wizard' && re.live, `Continue loads you inside the tower (${re.place})`);
      await page.evaluate(() => { window.pokecraft.champion = true; });
      // and leaving still goes up to the Swirl
      await page.evaluate(() => { const g = window.pokecraft, d = g.world.doors[0], c = d.surface[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
      await placeIs(page, 'swirl');
      await intoTower();
    }

    const inTower = async () => { if (!(await page.evaluate(() => window.pokecraft.place === 'wizard'))) await intoTower(); };
    if (want('painting')) {
      await inTower();
      // real keys and clicks through the game's loop: floor 1 (a flower)
      await page.evaluate(() => { const g = window.pokecraft; g.player.pos.set(24.5, 2, 19.5); g.player.vel.set(0, 0, 0); });
      const lockIt = async () => { if (!(await page.evaluate(() => !!document.pointerLockElement))) { await page.mouse.click(550, 380); await page.waitForFunction(() => !!document.pointerLockElement, null, { timeout: 20000 }).catch(() => {}); } };
      await lockIt();
      const lookAt = (x, y, z) => page.evaluate(([x, y, z]) => { const p = window.pokecraft.player; p.lookAt({ x, y, z }); }, [x, y, z]);
      const prompt = () => page.evaluate(() => document.getElementById('prompt').textContent);
      const potAim = i => [18 + (i < 0 ? 12 : i) + 0.5, 2.7, 17.0];
      const sqAim = (c, i) => [c.x0 + (i % c.w) + 0.5, c.y0 + (c.h - 1 - Math.floor(i / c.w)) + 0.5, c.z + 1];
      const C = await page.evaluate(() => window.pokecraft.world.studio.canvases[0]);
      // no paint yet: a tap on a square says what to do
      await lookAt(...sqAim(C, 1));
      await waitFor(page, () => /paint/i.test(document.getElementById('prompt').textContent), null, 60000);
      await page.mouse.click(550, 380);
      await waitFor(page, () => [...document.querySelectorAll('#toasts div, .toast')].some(e => /Tap a paint pot first/.test(e.textContent)) || /first/.test(document.body.textContent), null, 30000);
      // the pots: E on the yellow pot, clicks for the others
      const FLOOR1 = { 2: [1, 2, 4, 7, 8, 11], 0: [5, 6, 9, 10], 3: [13, 14] };
      let first = true;
      for (const [paint, list] of Object.entries(FLOOR1)) {
        await lookAt(...potAim(Number(paint)));
        await waitFor(page, () => /dip/i.test(document.getElementById('prompt').textContent), null, 60000);
        if (first) { await page.keyboard.press('KeyE'); first = false; } else await page.mouse.click(550, 380);
        await waitFor(page, p => window.pokecraft.gymLive.of('part:studio').info().brush === Number(p), paint, 30000);
        for (const i of list) {
          await lookAt(...sqAim(C, i));
          await waitFor(page, () => /paint/i.test(document.getElementById('prompt').textContent), null, 60000);
          await page.mouse.click(550, 380);
          await waitFor(page, ([i, p]) => window.pokecraft.gymLive.of('part:studio').info().cells[0][i] === Number(p), [i, paint], 30000);
        }
      }
      await waitFor(page, () => window.pokecraft.beaten.includes('wizard:floor1'), null, 30000);
      const f1 = await live();
      t.ok(f1.done.join() === '1' && f1.doorOpen[0] === true && f1.doorOpen.slice(1).every(o => !o), `floor 1 done with real keys and clicks: its key is saved and its stairs door is open, the others shut (${JSON.stringify(f1.doorOpen)})`);
      const draw = await page.evaluate(async () => {
        const g = window.pokecraft, BK = await import('/src/blocks.js'), C = g.world.studio.canvases[0];
        const cell = (i) => g.world.get(C.x0 + (i % C.w), C.y0 + (C.h - 1 - Math.floor(i / C.w)), C.z);
        return { red: cell(5) === BK.WOOL.parkour, yellow: cell(1) === BK.WOOL.electric, green: cell(13) === BK.WOOL.grass, blank: cell(0) === BK.WOOL.custom, edits: [...g.world.edits].length, saved: JSON.parse(localStorage.getItem('pokecraft-save-v2')).beaten.includes('wizard:floor1') };
      });
      t.ok(draw.red && draw.yellow && draw.green && draw.blank && draw.edits === 0, `the squares are live blocks (never edits): ${JSON.stringify(draw)}`);
      t.ok(draw.saved, 'the key is in the save at once');
      // the remaining floors through the live part's own hooks (tap with exact rays from the mat), a skilled kid; floor 2-5 each time
      const play = await page.evaluate(async () => {
        const g = window.pokecraft, live = g.gymLive.of('part:studio'), WT = await import('/src/wizardtower.js'), WL = await import('/src/wizardland.js'), W2 = await import('/tests/wizardcheck.mjs');
        live.manual = true; live.playing = () => true;
        const out = { floors: [], problems: [] };
        const rayTo = (o, p) => { const d = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z }, l = Math.hypot(d.x, d.y, d.z); return { x: d.x / l, y: d.y / l, z: d.z / l }; };
        for (let n = 2; n <= 5; n++) {
          const L = g.world.studio.floors[n - 1], f = WT.FLOORS[n - 1], c = L.canvas;
          g.player.pos.set(24.5, L.slab + 1, 19.5); g.player.vel.set(0, 0, 0);
          const o = { x: 24.5, y: L.slab + 1 + 1.62, z: 19.5 };
          const sk = W2.skilled(f, 5);
          const T = WT.targetOf(f);
          // the same kid as the bot: dip each paint once, paint its squares (the bot's final cells say which paint each square wants)
          const byPaint = new Map();
          sk.cells.forEach((p, i) => { if (p >= 0 && T[i].kind !== 'given') (byPaint.get(p) ?? byPaint.set(p, []).get(p)).push(i); });
          let taps = 0;
          for (const [paint, list] of byPaint) {
            const pot = L.pots.find(q => q.i === paint);
            live.tap(o, rayTo(o, { x: pot.x + 0.5, y: pot.y + 0.75, z: pot.z + 1 })); taps++;
            for (const i of list) { live.tap(o, rayTo(o, { x: c.x0 + (i % c.w) + 0.5, y: c.y0 + (c.h - 1 - Math.floor(i / c.w)) + 0.5, z: c.z + 1 })); taps++; }
          }
          const info = live.info();
          out.floors.push({ n, done: info.done.includes(n), taps, want: sk.taps, door: n < 5 ? info.doorOpen[n - 1] : null });
        }
        out.paint = live.info().paint;
        return out;
      });
      t.ok(play.floors.every(f => f.done && f.taps === f.want && (f.door === null || f.door === true)), `floors 2-5 by taps from the mat: done in exactly squares + paints taps each, the door opens (${JSON.stringify(play.floors)})`);
      t.ok(Array.isArray(play.paint) && play.paint.length === 3, `floor 5's palette is its three groups (${JSON.stringify(play.paint)})`);
      // the hint clock: a wrong square blinks after 40 s of stepped play time, at 60 and at 20 steps a second the same
      const blink = await page.evaluate(async () => {
        const g = window.pokecraft, live = g.gymLive.of('part:studio'), WT = await import('/src/wizardtower.js');
        g.beaten = g.beaten.filter(k => k !== WT.floorKey(1)); // a fresh floor 1 (floors 2-5 stay done)
        const res = {};
        for (const [name, dt] of [['60', 1 / 60], ['20', 1 / 20]]) {
          // a fresh live part each time so the clock starts at zero
          g.gymLive.reset(g.world); const lv = g.gymLive.of('part:studio'); lv.manual = true; lv.playing = () => true;
          g.player.pos.set(24.5, 2, 19.5);
          lv.dip(0); lv.paintSquare(1, 5); // a red square where yellow... square 5 wants red: use a clearly wrong one instead
          lv.dip(11); lv.paintSquare(1, 1); // black on a yellow square: wrong
          let t0 = null, tOff = null, t = 0;
          for (let k = 0; k < 60 * 80 && tOff === null; k++) {
            lv.step(dt); t += dt;
            const b = lv.info().blink;
            if (b && t0 === null) t0 = t;
            if (!b && t0 !== null && tOff === null) tOff = t;
          }
          res[name] = { on: t0, off: tOff };
          // before 40 s nothing blinks
        }
        return res;
      });
      t.ok(Math.abs(blink['60'].on - 40) < 0.1 && Math.abs(blink['20'].on - 40) < 0.1 && Math.abs(blink['60'].off - blink['60'].on - 3) < 0.2, `a wrong square blinks after 40 s of play time (60 fps ${blink['60'].on?.toFixed(2)}, 20 fps ${blink['20'].on?.toFixed(2)}) for 3 s`);
      // a reload keeps the finished floors and their open doors
      await page.evaluate(() => { const g = window.pokecraft; g.save(true); });
      await page.reload({ waitUntil: 'commit' });
      await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page);
      await page.waitForFunction(() => window.pokecraft.gymLive.of('part:studio'), null, { timeout: 30000 });
      const re = await live();
      t.ok(re.done.join() === '2,3,4,5' || re.done.join() === '1,2,3,4,5', `a reload keeps the finished floors (${re.done})`);
      t.ok(re.doorOpen.slice(1).every(Boolean), `and their stairs doors stay open (${JSON.stringify(re.doorOpen)})`);
    }

    if (want('shots')) {
      await inTower();
      const look = (pos, at) => page.evaluate(([pos, at]) => { const p = window.pokecraft.player; p.pos.set(...pos); p.vel.set(0, 0, 0); p.lookAt({ x: at[0], y: at[1], z: at[2] }); window.pokecraft.ui.toastBox?.replaceChildren(); }, [pos, at]);
      await page.evaluate(() => { const g = window.pokecraft; g.beaten = g.beaten.filter(k => !k.startsWith('wizard:floor')); g.gymLive.reset(g.world); const l = g.gymLive.of('part:studio'); l.manual = true; l.playing = () => true; });
      await look([24.5, 2, 28.5], [24.5, 5, 15]); await page.waitForTimeout(1200); await shot(page, 'w19-arrival.png');
      for (let n = 1; n <= 5; n++) {
        await page.evaluate(async n => {
          const g = window.pokecraft, L = g.world.studio.floors[n - 1], p = g.player;
          p.pos.set(24.5, L.slab + 1, 19.5); p.vel.set(0, 0, 0); p.lookAt({ x: 24.5, y: L.canvas.y0 + L.canvas.h / 2 - 0.3, z: 15 });
          const live = g.gymLive.of('part:studio'); live.dip(n === 1 ? 2 : 6); live.step(0.1);
          g.ui.toastBox?.replaceChildren();
        }, n);
        await page.waitForTimeout(1200);
        await shot(page, `w19-floor${n}.png`);
      }
      // the stairs behind glass: shut, then open (floor 1), and the room seen from the side with the easel
      await look([24.5, 2, 24.5], [29, 4, 29]); await page.waitForTimeout(1200); await shot(page, 'w19-stairs-shut.png');
      await look([20.5, 2, 26.5], [21, 3.5, 19.5]); await page.waitForTimeout(1200); await shot(page, 'w19-easel.png');
      await page.evaluate(() => { const g = window.pokecraft, l = g.gymLive.of('part:studio'); g.beaten.push('wizard:floor1'); l.showFinished(1); });
      await look([25.5, 2, 26.5], [29.5, 3.5, 29.5]); await page.waitForTimeout(1500); await shot(page, 'w19-stairs-open.png');
      // the studio and the Wizard
      await page.evaluate(() => { const g = window.pokecraft; for (let n = 1; n <= 5; n++) if (!g.beaten.includes(`wizard:floor${n}`)) g.beaten.push(`wizard:floor${n}`); g.gymLive.reset(g.world); });
      await look([24.5, 34, 21.5], [24.5, 38, 15]); await page.waitForTimeout(1500); await shot(page, 'w19-studio-canvas.png');
      await look([24.5, 34, 31.0], [24.5, 36.5, 26.5]); await page.waitForTimeout(1500); await shot(page, 'w19-studio-wizard.png');
      await look([20.5, 34, 30.5], [25.5, 38, 18]); await page.waitForTimeout(1500); await shot(page, 'w19-studio-room.png');
      // the Swirl: the open door, then a cloud stone
      await page.evaluate(async () => { const g = window.pokecraft, d = g.world.doors[0], c = d.surface[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
      await placeIs(page, 'swirl');
      await page.evaluate(async () => { const g = window.pokecraft, WT = await import('/src/wizardtower.js'), s = WT.towerStand(g.world), p = g.player; p.pos.set(s[0] - 2, s[1], s[2]); p.vel.set(0, 0, 0); p.lookAt({ x: s[0] + 1.5, y: s[1] + 1.8, z: s[2] }); g.ui.toastBox?.replaceChildren(); });
      await page.waitForTimeout(2500); await shot(page, 'w19-swirl-door.png');
      await page.evaluate(() => { const g = window.pokecraft, p = g.player; p.pos.set(100, 21, 80); p.vel.set(0, 0, 0); p.lookAt({ x: 140, y: 24, z: 80 }); g.ui.toastBox?.replaceChildren(); });
      await page.waitForTimeout(2500); await shot(page, 'w19-swirl-bridge.png');
    }
    t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
    await page.context().close();
  }

  // the wizard opened for everyone while the Cube Planets world (and the Mirror Palace) still sleep: wave 15 closed, no ?preview, 'wizard' in OPEN_NOW (the state after the owner opens the tower)
  const openedSetup = ctx => ctx.route('**/src/comingsoon.js', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + "\nOPEN_NOW.push('wizard');\n" });
  });

  if (want('bridge')) {
    const page = await retry(() => openGame(browser, base, { wave15: false, setup: openedSetup }));
    await newGame(page, 0);
    await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.weather?.set?.('clear'); g.time = 0.25; });
    await intoSwirl(page);
    const r = await page.evaluate(async () => {
      const g = window.pokecraft, PW = await import('/src/pictureworlds.js'), BK = await import('/src/blocks.js'), WT = await import('/src/wizardtower.js'), R = await import('/src/realms.js');
      const need = PW.bridgeNeed().map(w => w.id), all = PW.BRIDGE_WORLDS.map(w => w.id), asleep = all.filter(id => !need.includes(id));
      const until = async f => { for (let i = 0; i < 300 && !f(); i++) await new Promise(r => setTimeout(r, 100)); return f(); };
      const out = { need: need.length, all: all.length, asleep, wizardRealm: !!R.REALMS.wizard, open: WT.towerOpen({ stars: need }) };
      g.stars = need.slice(1); await until(() => g.portal.info()?.lit?.startsWith(g.stars.join()));
      out.shortCloud = g.portal.info().cloud;
      out.shortOpen = WT.towerOpen(g);
      g.stars = [...need];
      await until(() => g.portal.info()?.cloud > 0);
      const info = g.portal.info();
      out.cloud = info.cloud;
      const stones = g.world.swirl.bridge.filter(s => asleep.includes(s.world));
      out.stones = stones.map(s => [s.world, s.cells.every(c => g.world.get(...c) === BK.B.CLOUD)]);
      out.starStones = g.world.swirl.bridge.filter(s => need.includes(s.world)).every(s => s.cells.every(c => g.world.get(...c) === BK.B.STAR_STONE));
      out.glow = !!info.towerGlow; out.doorOpen = g.world.swirl.wizard.door.every(c => g.world.get(...c) === BK.B.PORTAL);
      // the cloud stone says why
      window.__toasts = []; const toast = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); toast(m); };
      const c = stones[0].cells[0], blk = { x: c[0], y: c[1], z: c[2], id: BK.B.CLOUD };
      g.portal.use(blk);
      out.cloudToast = window.__toasts.at(-1); out.cloudPrompt = g.portal.prompt(blk, 'tap');
      // and its star turns the stone into a star stone
      g.stars = [...need, asleep[0]];
      await until(() => stones[0].cells.every(k => g.world.get(...k) === BK.B.STAR_STONE));
      out.becomes = stones[0].cells.every(k => g.world.get(...k) === BK.B.STAR_STONE);
      g.stars = [...need];
      return out;
    });
    t.ok(r.wizardRealm && r.open && r.asleep.length >= 1 && r.need === r.all - r.asleep.length, `opened for everyone while worlds sleep: the bridge needs ${r.need} of ${r.all} stars (asleep: ${r.asleep.join(', ')})`);
    t.ok(r.shortCloud === 0 && r.shortOpen === false, 'one star short: no cloud stones, the tower stays sealed');
    t.ok(r.stones.length >= 1 && r.stones.every(s => s[1]) && r.starStones && r.cloud > 0, `every needed star: the sleeping worlds' stones are soft cloud stones (${JSON.stringify(r.stones)}) and the others star stones`);
    t.ok(r.glow && r.doorOpen, 'the door opens without the sleeping worlds\' stars');
    t.ok(/waits for a world that is still asleep/.test(r.cloudToast) && /cloud stone/.test(r.cloudPrompt), `a cloud stone says why: "${r.cloudToast}" / "${r.cloudPrompt}"`);
    t.ok(r.becomes, 'when that world\'s star is won its stone becomes a star stone');
    // Node: the same rules in a fresh process with the shipped state + the tower open (the stand-in for a page)
    const child = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
      globalThis.location = { search: '' };
      const CS = await import(${JSON.stringify('file://' + path.join(ROOT, 'src', 'comingsoon.js'))});
      CS.OPEN_NOW.push('wizard');
      const PW = await import(${JSON.stringify('file://' + path.join(ROOT, 'src', 'pictureworlds.js'))});
      const WT = await import(${JSON.stringify('file://' + path.join(ROOT, 'src', 'wizardtower.js'))});
      const need = PW.bridgeNeed().map(w => w.id), all = PW.BRIDGE_WORLDS.map(w => w.id);
      console.log(JSON.stringify({ need, all, done: PW.bridgeDone(need), shortDone: PW.bridgeDone(need.slice(1)), ally: WT.towerOpen({ stars: [], studio: { ally: true } }), open: WT.towerOpen({ stars: need }), asleep: PW.BRIDGE_WORLDS.filter(w => PW.stoneAsleep(w)).map(w => w.id) }));
    `], { maxBuffer: 1 << 24 }).toString());
    t.ok(!child.need.includes('gravity') && !child.need.includes('mirror') && ['house', 'pirate', 'race', 'stadium'].every(id => child.need.includes(id)), `Node, shipped state: the bridge needs the first four worlds and every open one, not Cube Planets or the Mirror Palace (${child.need.length} of ${child.all.length})`);
    t.ok(child.done && !child.shortDone && child.ally && child.open && child.asleep.join() === 'gravity,mirror', `bridgeDone / towerOpen / the sleeping stones (${child.asleep})`);
    // a world switched off (REMOVED) is not needed either
    const rem = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
      globalThis.__pcRemoved = ['mirror'];
      const PW = await import(${JSON.stringify('file://' + path.join(ROOT, 'src', 'pictureworlds.js'))});
      console.log(JSON.stringify({ need: PW.bridgeNeed().map(w => w.id), all: PW.BRIDGE_WORLDS.map(w => w.id) }));
    `], { maxBuffer: 1 << 24 }).toString());
    t.ok(!rem.need.includes('mirror') && rem.need.length === rem.all.length, `a removed Mirror Palace is not needed (${rem.need.length} stars)`);
    t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
    await page.context().close();
  }

  if (want('ipad')) {
    const ip = await retry(() => openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] }));
    await newGame(ip, 0);
    await ip.evaluate(() => { const g = window.pokecraft; g.champion = true; g.weather?.set?.('clear'); g.time = 0.25; });
    await intoSwirl(ip);
    await ip.evaluate(async () => {
      const g = window.pokecraft, PW = await import('/src/pictureworlds.js'), WT = await import('/src/wizardtower.js');
      g.stars = PW.bridgeNeed().map(w => w.id);
      const s = WT.towerStand(g.world); g.player.pos.set(s[0], s[1], s[2]);
      const c = g.world.swirl.wizard.door[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) });
    });
    await placeIs(ip, 'wizard');
    await ip.waitForFunction(() => window.pokecraft.gymLive.of('part:studio'), null, { timeout: 30000 });
    const frames = async n => ip.evaluate(async n => { const g = window.pokecraft; for (let i = 0; i < n; i++) { const t0 = g.time; await new Promise(res => { const f = () => (g.time !== t0 ? res() : requestAnimationFrame(f)); f(); }); } }, n);
    await ip.evaluate(() => { const g = window.pokecraft; g.player.pos.set(24.5, 2, 19.5); g.player.vel.set(0, 0, 0); g.player.lookAt({ x: 22.5, y: 2.6, z: 17 }); });
    await frames(3);
    const act1 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    t.ok(act1 === 'Dip!', `iPad: the big button says Dip! at a pot (${act1})`);
    // tap the screen on the red pot (pot 0), then on a square: the tap hook paints what is under the finger
    const screenOf = pt => ip.evaluate(async pt => { const THREE = await import('three'), g = window.pokecraft, v = new THREE.Vector3(...pt).project(g.camera); return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight]; }, pt);
    // look at the middle of the canvas, then tap pot 0 (lower left of the screen) and square 5 (red) off-centre: neither is under the crosshair
    await ip.evaluate(() => window.pokecraft.player.lookAt({ x: 24.5, y: 3.4, z: 16 })); await frames(3);
    const potXY = await screenOf([22.5, 2.75, 17]);               // the teal pot (paint 4), a little left of the middle
    await ip.touchscreen.tap(potXY[0], potXY[1]);
    await waitFor(ip, () => window.pokecraft.gymLive.of('part:studio').info().brush === 4, null, 30000);
    const sqXY = await screenOf([23.5, 4.5, 16]);                 // the flower's second row, second square (not under the crosshair)
    await ip.touchscreen.tap(sqXY[0], sqXY[1]);
    await waitFor(ip, () => window.pokecraft.gymLive.of('part:studio').info().cells[0].some(c => c === 4), null, 30000);
    const painted = await ip.evaluate(() => { const c = window.pokecraft.gymLive.of('part:studio').info().cells[0]; return { n: c.filter(x => x >= 0).length, i: c.findIndex(x => x === 4) }; });
    t.ok(painted.n === 1 && painted.i >= 0, `iPad: a tap on a pot dips, a tap on a square paints exactly that square (${painted.i}) — no new buttons`);
    // a tap from far away answers kindly
    await ip.evaluate(() => { const g = window.pokecraft; window.__toasts = []; const toast = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); toast(m); }; g.player.pos.set(24.5, 2, 29.5); g.player.lookAt({ x: 24.5, y: 4.2, z: 15 }); });
    await frames(3);
    const farXY = await screenOf([24.5, 4.2, 16]);
    await ip.touchscreen.tap(farXY[0], farXY[1]);
    await waitFor(ip, () => window.__toasts.some(m => /Come a little closer/.test(m)), null, 30000);
    t.ok(true, 'iPad: a tap on the canvas from far away says "Come a little closer!"');
    // the fixed-slot buttons: Place and Ride dim with words (never move or disappear), the easel card sits top centre
    const b = await ip.evaluate(() => {
      const g = window.pokecraft, r = id => { const e = document.getElementById(id), q = e.getBoundingClientRect(); return { dim: e.classList.contains('dim'), hidden: q.width === 0, x: q.x, y: q.y, w: q.width }; };
      const card = document.getElementById('easel'), cq = card.getBoundingClientRect();
      return { place: r('btn-place'), ride: r('btn-ride'), whyPlace: g.touchWhy.place, whyRide: g.touchWhy.ride, card: { hidden: card.classList.contains('hidden'), x: cq.x, y: cq.y, w: cq.width, h: cq.height }, vw: window.innerWidth, vh: window.innerHeight, pause: r('btn-pause'), book: r('btn-book') };
    });
    t.ok(!b.card.hidden && Math.abs(b.card.x + b.card.w / 2 - b.vw / 2) < 4 && b.card.y < 20 && b.card.w >= 80, `iPad: the easel card sits top centre (${Math.round(b.card.x)}, ${Math.round(b.card.y)}, ${Math.round(b.card.w)}px of ${b.vw})`);
    t.ok(!b.place.hidden, 'iPad: Place stays where it is (it never disappears; Ride only shows with a rideable creature and dims with the tower\'s words)');
    t.ok(/riding inside the tower/i.test(b.whyRide) || b.ride.dim, `iPad: Ride is dim with the tower's words (${b.whyRide})`);
    // the easel card: a tap makes it big
    await ip.evaluate(() => document.getElementById('easel').dispatchEvent(new PointerEvent('pointerdown')));
    await ip.waitForTimeout(500);
    const big = await ip.evaluate(() => document.getElementById('easel').getBoundingClientRect().width);
    t.ok(big > 200, `iPad: a tap on the easel card makes it big (${Math.round(big)}px)`);
    // Place says why (the keep)
    await ip.evaluate(() => { const g = window.pokecraft; g.player.pos.set(24.5, 2, 19.5); g.player.lookAt({ x: 24.5, y: 4.2, z: 15 }); window.__toasts.length = 0; });
    await frames(3);
    await ip.tap('#btn-place');
    await waitFor(ip, () => window.__toasts.length > 0, null, 30000);
    const pw = await ip.evaluate(() => window.__toasts.at(-1));
    t.ok(/No building here|studio|can't build/i.test(pw), `iPad: Place says why (${pw})`);
    const edits = await ip.evaluate(() => [...window.pokecraft.world.edits].length);
    t.ok(edits === 0, 'iPad: nothing was built');
    await shot(ip, 'w19-ipad-floor1.png');
    t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
    await ip.context().close();
  }

  if (want('closed')) {
    // shipped state: no ?preview, wave 15 closed, 'wizard' not in OPEN_NOW
    const page = await retry(() => openGame(browser, base, { wave15: false }));
    await newGame(page, 0);
    await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.weather?.set?.('clear'); g.time = 0.25; });
    const r0 = await page.evaluate(async () => {
      const R = await import('/src/realms.js'), CS = await import('/src/comingsoon.js'), PW = await import('/src/pictureworlds.js');
      return { realm: !!R.REALMS.wizard, open: CS.worldOpen('wizard'), later: CS.LATER.includes('wizard'), need: PW.bridgeNeed().length, all: PW.BRIDGE_WORLDS.length, terrain: !!R.TERRAINS.wizardLand };
    });
    t.ok(!r0.realm && !r0.open && r0.later, `closed: REALMS.wizard is undefined, worldOpen('wizard') is false, it is listed in LATER (${JSON.stringify(r0)})`);
    await intoSwirl(page);
    const r = await page.evaluate(async () => {
      const g = window.pokecraft, PW = await import('/src/pictureworlds.js'), BK = await import('/src/blocks.js'), R = await import('/src/realms.js'), WT = await import('/src/wizardtower.js');
      const until = async f => { for (let i = 0; i < 300 && !f(); i++) await new Promise(r => setTimeout(r, 100)); return f(); };
      g.stars = PW.BRIDGE_WORLDS.map(w => w.id); // every star there is
      await until(() => g.portal.info()?.lit?.startsWith(g.stars.join()));
      await new Promise(r => setTimeout(r, 600));
      const wz = g.world.swirl.wizard, c = wz.door[0], blk = { x: c[0], y: c[1], z: c[2], id: g.world.get(...c) };
      window.__toasts = []; const toast = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); toast(m); };
      g.portal.use(blk);
      const aim = (await import('/src/swirlland.js')).swirlAim(g.world, { x: 60, y: 21, z: 80 }, g);
      return { door: [...new Set(wz.door.map(k => g.world.get(...k)))].join(), sealed: BK.B.WIZARD_STONE, toast: window.__toasts.at(-1), prompt: g.portal.prompt(blk, 'tap'), action: g.portal.action(blk), info: g.portal.info(), place: g.place, swirlVersion: R.REALMS.swirl.version, open: WT.towerOpen(g), aim: aim?.text('→', 40), whole: !window.__toasts.some(m => /bridge is whole/.test(m)) };
    });
    t.ok(r.door === String(r.sealed) && !r.info.towerGlow && !r.open, 'closed: with every star the door stays sealed Wizard Stone, no glow');
    t.ok(r.toast === 'The Wizard is inside, holding the Swirl together. Bring him stars!' && r.place === 'swirl', `closed: today's words, no count (${r.toast})`);
    t.ok(/sealed/.test(r.prompt) && r.action === '', `closed: the prompt says sealed (${r.prompt})`);
    t.ok(r.whole && !/Wizard's Tower/.test(r.aim || ''), `closed: no bridge-whole toast, no tower arrow (${r.aim})`);
    t.ok(r.swirlVersion === 5 || r.swirlVersion === 6, `closed: the Swirl is still version ${r.swirlVersion} (nothing in it changed)`);
    // a save made inside the tower (in ?preview) loads in the main world
    await page.evaluate(() => { const g = window.pokecraft; g.save(true); });
    const save = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('pokecraft-save-v2')); v.place = 'wizard'; v.realmPos = [24.5, 2, 28.5, 0, 0]; v.realmUp = { id: 'swirl', ret: [136.5, 21, 80, -1.57, 0], via: null }; v.realmVersions = { ...(v.realmVersions || {}), wizard: 1 }; return v; });
    const s = save.place;
    await page.context().close();
    const old = await retry(() => openGame(browser, base, { wave15: false, setup: seedSave(save) }));
    await continueGame(old);
    const re = await old.evaluate(() => ({ place: window.pokecraft.place, realm: window.pokecraft.world.realm?.id ?? null }));
    t.ok(s === 'wizard' && re.place === 'main' && !re.realm, `closed: a save made inside the tower loads in the main world (${re.place})`);
    t.ok(!old.errors.length, `no page errors ${old.errors.join('; ')}`);
    await old.context().close();
  }

  if (want('pair')) {
    const [A, Bp] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(Bp, 1); await pause(Bp);
    await A.fill('#mp input[placeholder="Your name"]', 'Dad');
    await A.locator('#mp button:has-text("Share my world")').click();
    await A.waitForTimeout(500);
    const code = (await A.textContent('.mp-code')).trim();
    await Bp.fill('#mp input[placeholder="Your name"]', 'Kid');
    await Bp.fill('#mp .mp-code-input', code);
    await Bp.locator('#mp button:has-text("Join a world")').click();
    await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000);
    await waitFor(A, () => window.pokecraft.mp.others.size > 0, null, 30000);
    for (const P of [A, Bp]) await P.evaluate(() => { window.pokecraft.champion = true; });
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'swirl');
    // Dad has every star, the Kid none: the door is Dad's; the Kid cannot open it alone
    await A.evaluate(async () => { const g = window.pokecraft, PW = await import('/src/pictureworlds.js'); g.stars = PW.bridgeNeed().map(w => w.id); });
    await Bp.evaluate(async () => { const g = window.pokecraft; g.stars = []; window.__toasts = []; const toast = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); toast(m); }; });
    const kidAlone = await Bp.evaluate(async () => {
      const g = window.pokecraft, WT = await import('/src/wizardtower.js'), c = g.world.swirl.wizard.door[0];
      const s = WT.towerStand(g.world); g.player.pos.set(s[0], s[1], s[2]);
      g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) });
      return { place: g.place, toast: window.__toasts.at(-1) };
    });
    t.ok(kidAlone.place === 'swirl' && /Follow Dad when they go into the tower|Bring him stars/.test(kidAlone.toast), `a guest cannot go in alone: "${kidAlone.toast}"`);
    // Dad goes in; the Kid is asked and follows (a guest skips the stars, the host's trip is the key)
    await A.evaluate(async () => {
      const g = window.pokecraft, WT = await import('/src/wizardtower.js'), c = g.world.swirl.wizard.door[0];
      const s = WT.towerStand(g.world); g.player.pos.set(s[0], s[1], s[2]);
      g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) });
    });
    await placeIs(A, 'wizard');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    const ask = await Bp.evaluate(() => document.getElementById('ask-text').textContent);
    t.ok(/Dad went into the Wizard's tower\. Go too\?/.test(ask), `the Kid is asked: "${ask}"`);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'wizard');
    for (const P of [A, Bp]) await P.waitForFunction(() => window.pokecraft.gymLive.of('part:studio'), null, { timeout: 30000 });
    // each paints their own canvas: Dad's squares do not change the Kid's
    const own = await A.evaluate(() => { const l = window.pokecraft.gymLive.of('part:studio'), p = window.pokecraft.player; p.pos.set(24.5, 2, 19.5); l.dip(2); l.paintSquare(1, 1); l.paintSquare(1, 2); return l.info().cells[0].filter(c => c >= 0).length; });
    await A.waitForTimeout(1500);
    const kid = await Bp.evaluate(async () => {
      const g = window.pokecraft, l = g.gymLive.of('part:studio'), BK = await import('/src/blocks.js'), C = g.world.studio.canvases[0];
      const cell = i => g.world.get(C.x0 + (i % C.w), C.y0 + (C.h - 1 - Math.floor(i / C.w)), C.z);
      return { cells: l.info().cells[0].filter(c => c >= 0).length, block: cell(1) === BK.WOOL.custom, edits: [...g.world.edits].length };
    });
    t.ok(own === 2 && kid.cells === 0 && kid.block && kid.edits === 0, `Dad painted ${own} squares; the Kid's canvas is untouched (${kid.cells} squares, blank block ${kid.block})`);
    // the Kid paints a square of their own, Dad's stays as it was
    await Bp.evaluate(() => { const l = window.pokecraft.gymLive.of('part:studio'); window.pokecraft.player.pos.set(24.5, 2, 19.5); l.dip(6); l.paintSquare(1, 5); });
    await Bp.waitForTimeout(1000);
    const dad = await A.evaluate(() => window.pokecraft.gymLive.of('part:studio').info().cells[0].filter(c => c >= 0).length);
    t.ok(dad === 2, `the Kid's square does not appear for Dad (${dad})`);
    // the Wizard's gate for a guest without stars (stage B: his words only)
    await Bp.evaluate(async () => { const g = window.pokecraft, l = g.gymLive.of('part:studio'); for (let n = 1; n <= 5; n++) if (!g.beaten.includes(`wizard:floor${n}`)) g.beaten.push(`wizard:floor${n}`); window.__toasts.length = 0; l.talk({ def: { wizard: true } }); });
    const gate = await Bp.evaluate(() => window.__toasts.at(-1));
    t.ok(/Bring me every star first! \(⭐ 0 \/ \d+\)/.test(gate), `a guest without stars gets the Wizard's star words: "${gate}"`);
    // the way out: Dad goes back up, the Kid follows (up to the Swirl)
    await A.evaluate(() => { const g = window.pokecraft, d = g.world.doors[0], c = d.surface[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
    await placeIs(A, 'swirl');
    await placeIs(Bp, 'swirl');
    t.ok(true, 'Dad goes back to the Swirl and the Kid comes too');
    t.ok(!A.errors.length && !Bp.errors.length, `no page errors ${A.errors.concat(Bp.errors).join('; ')}`);
    await A.context().close(); await Bp.context().close();
  }
}
