// Wave 19 (plans/wave19-wizard-tower.md), stage A: the Custom type and the `paint` field. Parts (WIZARD_ONLY=data|chart|paint|travel|old):
//   data    the type, six designs (own shapes, one merged swirl badge, models animate with and without paint), moves + the signature + the
//           three big moves, fx recipes, the sounds, wool 137 "Canvas Wool", the twelve paints against the atlas
//   chart   the custom row and the five separate cells, no old cell changed (tests/fixtures/chart-before-wizard.json), weak counts
//   paint   cleanPaint / fixPaint / paintModel / buildModel(species, paint) / portraits / guardianLevel, box and trade cards, the Book
//   travel  two browsers: the lead avatar and a duel show the guardian in its owner's colours, the save keeps the paint
//   old     a save without paint / with junk paint, paint on a non-designed creature dropped, a duel from VERSION 12 refused kindly
// (The tower, the painting game and the Wizard's battle are stages B and C: their parts come with them.)
import { openGame, openPair, newGame, pause, seedSave, continueGame, waitFor } from '../helpers.mjs';

const only = process.env.WIZARD_ONLY;
const want = name => !only || only.split(',').includes(name);
const DESIGNS = ['brushtail', 'palettoad', 'inkwing', 'crayonix', 'framesaur', 'blotbun'];

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
      t.ok(c.types === c.old + 1, `one new type (${c.types})`);
      t.ok(c.grew === 'doodle,normal,portal', `only portal, doodle and normal became weak to one more type (${c.grew})`);
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
}
