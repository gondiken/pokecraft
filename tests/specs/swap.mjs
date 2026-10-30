// Wave 17: gifts and trades between two browsers (plans/wave17-gifts-trading.md). SWAP_ONLY=rules|gift|trade|crash|old|ipad
// rules: swapcore.js in the page; gift / trade: the whole flow with real buttons (uid, traits and learned arrive unchanged,
// Book and Box updated, both saves agree); crash: a browser that closes halfway (messages dropped, page reloaded, rejoined):
// every uid in exactly one save; old: a friend whose game never says hi gets no buttons; ipad: the pair on an emulated iPad.
import { devices } from 'playwright';
import { openPair, newGame, click, pause, waitFor, continueGame } from '../helpers.mjs';

const ONLY = process.env.SWAP_ONLY;
const want = k => !ONLY || ONLY.split(',').includes(k);

// Two extra creatures in the Box with known uids, a trait and a learned list, so we can follow them.
const stock = (P, tag) => P.evaluate(async tag => {
  const g = window.pokecraft, S = await import('/src/species.js');
  const mk = (sp, lv, uid) => { const c = S.makeCreature(sp, lv); c.uid = uid; c.traits = []; c.learned = [...c.learned, 'tackle']; return c; };
  g.box.push(mk('fluffin', 7, `${tag}box1`), mk('blazehound', 22, `${tag}box2`), mk('sproutle', 5, `${tag}box3`));
  const r = g.box.find(c => c.species === 'blazehound'); r.traits = ['rideable'];
  g.save(true);
}, tag);

// Where a uid is: in this page's team / Box / escrow, and in this page's saved game.
const where = (P, uid) => P.evaluate(uid => {
  const g = window.pokecraft, s = JSON.parse(localStorage.getItem('pokecraft-save-v2') || '{}');
  const live = [...g.party, ...g.box].filter(c => c.uid === uid).length;
  const saved = [...(s.party || []), ...(s.box || [])].filter(c => c.uid === uid).length;
  const escrow = Object.values(g.swaps.ledger.out).filter(e => e.give.some(i => i.c.uid === uid)).length;
  const savedEscrow = Object.values(s.swaps?.out || {}).filter(e => e.give.some(i => i.c.uid === uid)).length;
  return { live, saved, escrow, savedEscrow };
}, uid);
const creature = (P, uid) => P.evaluate(uid => { const g = window.pokecraft; const c = [...g.party, ...g.box].find(x => x.uid === uid); return c && JSON.parse(JSON.stringify({ ...c, hp: 0 })); }, uid);

async function pair(browser, base, contextOptions) {
  const [A, B] = await openPair(browser, base, contextOptions ? { contextOptions } : {});
  if (contextOptions) {
    for (const p of [A, B]) { await p.tap('text=New Game', { timeout: 120000 }); await p.tap('.starter >> nth=0', { timeout: 120000 }); await p.waitForTimeout(1500); }
  } else { await newGame(A, 0); await pause(A); await newGame(B, 1); await pause(B); }
  await A.evaluate(async () => { await window.pokecraft.mp.host('Dad'); });
  const code = await A.evaluate(() => window.pokecraft.mp.code);
  await B.evaluate(async code => { await window.pokecraft.mp.join(code, 'Kid'); }, code);
  return { A, B, code };
}
const hello = (A, B) => Promise.all([A, B].map(P => waitFor(P, () => { const f = window.pokecraft.swaps.friends(); return f.length === 1 && f[0].ok; }, null, 120000)));
const showPause = P => P.evaluate(() => { document.exitPointerLock(); document.getElementById('pause').classList.remove('hidden'); });
const asked = (P, text) => waitFor(P, text => !document.getElementById('ask').classList.contains('hidden') && document.getElementById('ask-text').textContent.includes(text), text, 30000);
const idle = P => waitFor(P, () => { const i = window.pokecraft.swaps.info(); return !i.out.length && !i.mine && !i.theirs; }, null, 60000);

export default async function ({ browser, base, t }) {
  // ---------------- rules ----------------
  if (want('rules')) {
    const [A, B] = await openPair(browser, base);
    const r = await A.evaluate(async () => {
      const S = await import('/src/species.js'), X = await import('/src/swapcore.js');
      const out = {};
      const c = S.makeCreature('blazehound', 30); c.traits = ['rideable', 'nonsense'];
      const clean = X.cleanCreature(c);
      out.keeps = clean.uid === c.uid && clean.level === 30 && clean.xp === c.xp && JSON.stringify(clean.moves) === JSON.stringify(c.moves) && JSON.stringify(clean.learned) === JSON.stringify(c.learned) && JSON.stringify(clean.traits) === '["rideable"]';
      out.bad = [null, {}, { ...c, species: 'nope' }, { ...c, species: 'zenithar' }, { ...c, uid: 'a b' }, { ...c, uid: 'x'.repeat(40) }].map(X.cleanCreature).every(v => v === null);
      const lv = X.cleanCreature({ ...c, level: 999, xp: -5, hp: 1e9, moves: ['zzz', 'tackle', 'tackle'] });
      out.clamp = lv.level === S.MAX_LEVEL && lv.xp === S.xpForLevel(S.MAX_LEVEL) && lv.hp === S.statsFor(lv).maxHp && JSON.stringify(lv.moves) === '["tackle"]';
      const old = { ...c }; delete old.learned;
      out.oldLearned = !('learned' in X.cleanCreature(old));
      // two stand-in saves: a gift, a repeated give, a refused trade, a refund
      const game = () => ({ party: [S.makeCreature('fluffin', 5)], box: [], book: { marked: [], markCaught(id) { this.marked.push(id); } } });
      const ga = game(), gb = game(), la = X.newLedger(), lb = X.newLedger();
      const gift = S.makeCreature('sproutle', 9); ga.box.push(gift);
      const give = [X.creatureItem(gift)];
      out.lastStays = X.canGive(ga, [X.creatureItem(ga.party[0])]) === 'last' && !X.commitOut(ga, la, { sid: 's0', to: 'pB', kind: 'gift', give: [X.creatureItem(ga.party[0])] });
      out.commit = X.commitOut(ga, la, { sid: 's1', to: 'pB', kind: 'gift', give }) && ga.box.length === 0 && !!la.out.s1;
      out.twice = !X.commitOut(ga, la, { sid: 's1', to: 'pB', kind: 'gift', give });
      const r1 = X.receive(gb, lb, { sid: 's1', give, get: [] }, { give, get: [] });
      const r2 = X.receive(gb, lb, { sid: 's1', give, get: [] }, { give, get: [] });
      out.receive = r1.answer === 'got' && r1.fresh && r2.answer === 'got' && !r2.fresh && gb.party.filter(x => x.uid === gift.uid).length === 1 && gb.book.marked.includes('sproutle');
      out.settle = X.settle(ga, la, 's1', 'got') === 'done' && X.settle(ga, la, 's1', 'got') === null && ![...ga.party, ...ga.box].some(x => x.uid === gift.uid);
      // a give nobody agreed to: no, remembered; the giver gets it back where it was
      const g2 = S.makeCreature('fluffin', 3); ga.party.push(g2);
      const give2 = [X.creatureItem(g2)];
      X.commitOut(ga, la, { sid: 's2', to: 'pB', kind: 'gift', give: give2 });
      const n1 = X.receive(gb, lb, { sid: 's2', give: give2, get: [] }, null), n2 = X.receive(gb, lb, { sid: 's2', give: give2, get: [] }, { give: give2, get: [] });
      out.refused = n1.answer === 'no' && n2.answer === 'no' && !gb.party.some(x => x.uid === g2.uid);
      out.refund = X.settle(ga, la, 's2', 'no') === 'back' && ga.party[1]?.uid === g2.uid;
      // a trade: mine takes the place of theirs; a changed creature of theirs is refused
      const mineC = S.makeCreature('blazehound', 12); ga.party.push(mineC);
      const theirC = S.makeCreature('thornox', 14); gb.party.unshift(theirC);
      const tGive = [X.creatureItem(mineC)], tGet = [X.creatureItem(theirC)];
      X.commitOut(ga, la, { sid: 's3', to: 'pB', kind: 'trade', give: tGive, get: tGet });
      const tr = X.receive(gb, lb, { sid: 's3', give: tGive, get: tGet }, { give: tGive, get: tGet });
      X.settle(ga, la, 's3', tr.answer);
      out.trade = tr.answer === 'got' && gb.party[0].uid === mineC.uid && !gb.party.some(x => x.uid === theirC.uid) && ga.party.some(x => x.uid === theirC.uid) && !ga.party.some(x => x.uid === mineC.uid);
      const t4 = S.makeCreature('fluffin', 8); ga.box.push(t4);
      const t4Get = [X.creatureItem(gb.party[1])];
      gb.party[1].level += 1; // it changed after it was picked
      X.commitOut(ga, la, { sid: 's4', to: 'pB', kind: 'trade', give: [X.creatureItem(t4)], get: t4Get });
      const r4 = X.receive(gb, lb, { sid: 's4', give: [X.creatureItem(t4)], get: t4Get }, { give: [X.creatureItem(t4)], get: t4Get });
      out.changed = r4.answer === 'no' && X.settle(ga, la, 's4', 'no') === 'back' && ga.box.some(x => x.uid === t4.uid);
      const saved = X.loadSwaps(JSON.parse(JSON.stringify({ out: { s9: { to: 'pB', name: 'Kid', kind: 'gift', give, get: [], from: [{ where: 'box', i: 0 }] }, bad: 1 }, seen: [['s1', 'got', 1], ['x y', 'got'], ['s2', 'maybe']] })));
      out.load = Object.keys(saved.out).join() === 's9' && saved.seen.length === 1 && JSON.stringify(X.loadSwaps(null)) === '{"out":{},"seen":[]}';
      out.parcels = Object.keys(X.PARCELS).join() === 'creature' && typeof X.addParcel === 'function';
      out.nothingForNothing = !X.commitOut(ga, la, { sid: 's5', to: 'pB', kind: 'trade', give: [], get: [] }) && X.receive(gb, lb, { sid: 's5', give: [], get: [] }, { give: [], get: [] }).answer === 'no';
      const solo = game(); const soloGet = [X.creatureItem(solo.party[0])];
      out.presentKeepsLast = X.receive(solo, X.newLedger(), { sid: 's6', give: [], get: soloGet }, { give: [], get: soloGet }).answer === 'no' && solo.party.length === 1;
      const ask = S.makeCreature('fluffin', 4); gb.box.push(ask); const askGet = [X.creatureItem(ask)];
      const asked = X.commitOut(ga, la, { sid: 's7', to: 'pB', kind: 'trade', give: [], get: askGet }) && X.receive(gb, lb, { sid: 's7', give: [], get: askGet }, { give: [], get: askGet }).answer === 'got' && X.settle(ga, la, 's7', 'got') === 'done';
      out.askPresent = asked && [...ga.party, ...ga.box].some(x => x.uid === ask.uid) && ![...gb.party, ...gb.box].some(x => x.uid === ask.uid);
      return out;
    });
    for (const [k, v] of Object.entries(r)) t.ok(v, `rules: ${k}`);
    await A.context().close(); await B.context().close();
  }

  if (want('gift') || want('trade') || want('crash') || want('old')) {
    const { A, B, code } = await pair(browser, base);
    await stock(A, 'a'); await stock(B, 'b');
    await hello(A, B);
    t.ok(true, 'both games said hi (they know each other\'s playerId)');

    if (want('gift')) {
      // A present = a trade with Nothing back (owner 2026-10-29: one way, not two). Screenshots of every step for the owner.
      const before = await creature(A, 'abox2');
      await showPause(A);
      await waitFor(A, () => !!document.querySelector('#mp button[data-swap="trade"]'), null, 20000);
      t.ok(await A.evaluate(() => [...document.querySelectorAll('#mp .swap-btn')].map(b => b.textContent).join('|') === '🔁 Trade with Kid'), 'the pause screen has one Trade button for the friend');
      await A.screenshot({ path: 'screenshots/w17-1-pause.png' });
      await click(A, '#mp button[data-swap="trade"]');
      await waitFor(A, () => window.pokecraft.swapUi.isOpen);
      t.ok(await A.evaluate(() => document.querySelectorAll('#swap .swap-tile').length === window.pokecraft.party.length + window.pokecraft.box.length + 1), 'the panel shows Nothing plus every creature of the team and the Box');
      t.ok(await A.evaluate(() => document.querySelector(`#swap .swap-tile[data-where="party"]`).classList.contains('dim')), 'the last team creature is dim (it stays with you)');
      await click(A, '#swap .swap-tile[data-uid="abox2"]');
      await A.screenshot({ path: 'screenshots/w17-2-offer.png' });
      await click(A, '#swap-go');
      await asked(B, 'wants to trade');
      await B.screenshot({ path: 'screenshots/w17-3-asked.png' });
      await B.evaluate(() => window.pokecraft.ui.askYes());
      await waitFor(B, () => window.pokecraft.swapUi.isOpen && !!document.querySelector('#swap .swap-tile[data-uid="nothing"]'));
      await click(B, '#swap .swap-tile[data-uid="nothing"]');
      await B.screenshot({ path: 'screenshots/w17-4-pick-nothing.png' });
      await click(B, '#swap-go');
      await waitFor(A, () => !!document.getElementById('swap-yes'), null, 30000);
      t.ok(await A.evaluate(() => document.getElementById('swap-yes').textContent.includes('anyway')), 'nothing back: the asker says the last yes ("Give it anyway!")');
      await A.screenshot({ path: 'screenshots/w17-5-last-yes.png' });
      await click(A, '#swap-yes');
      await waitFor(B, () => [...window.pokecraft.party, ...window.pokecraft.box].some(c => c.uid === 'abox2'), null, 30000);
      await B.screenshot({ path: 'screenshots/w17-6-present.png' });
      await idle(A);
      const after = await creature(B, 'abox2');
      if (JSON.stringify(after) !== JSON.stringify(before)) console.log('   ', JSON.stringify(before), '\n   ', JSON.stringify(after));
      t.ok(JSON.stringify(after) === JSON.stringify(before), `a present arrives unchanged: uid, traits ${JSON.stringify(after?.traits)}, learned, moves, level, xp`);
      const [wa, wb] = [await where(A, 'abox2'), await where(B, 'abox2')];
      t.ok(wa.live + wa.saved + wa.escrow + wa.savedEscrow === 0 && wb.live === 1 && wb.saved === 1, `in exactly one save (giver ${JSON.stringify(wa)}, friend ${JSON.stringify(wb)})`);
      t.ok(await B.evaluate(() => window.pokecraft.book.caught.has('blazehound')), "the friend's Creature Book has it as caught");
      for (const P of [A, B]) await P.evaluate(() => { if (window.pokecraft.swapUi.isOpen) document.getElementById('swap-close').click(); });
      // Asking for a present: Nothing offered, the friend gives one
      await showPause(A); await waitFor(A, () => !!document.querySelector('#mp button[data-swap="trade"]'), null, 20000);
      await click(A, '#mp button[data-swap="trade"]'); await waitFor(A, () => window.pokecraft.swapUi.isOpen);
      await click(A, '#swap .swap-tile[data-uid="nothing"]'); await click(A, '#swap-go');
      await asked(B, 'would love a present');
      await B.evaluate(() => window.pokecraft.ui.askYes());
      await waitFor(B, () => window.pokecraft.swapUi.isOpen && !!document.querySelector('#swap .swap-tile[data-uid="bbox1"]'));
      t.ok(await B.evaluate(() => !document.querySelector('#swap .swap-tile[data-uid="nothing"]')), 'nothing for nothing is not offered');
      await click(B, '#swap .swap-tile[data-uid="bbox1"]'); await click(B, '#swap-go');
      await waitFor(A, () => !!document.getElementById('swap-yes'), null, 30000);
      await click(A, '#swap-yes');
      await waitFor(A, () => [...window.pokecraft.party, ...window.pokecraft.box].some(c => c.uid === 'bbox1'), null, 30000);
      await idle(A); await idle(B);
      t.ok((await where(A, 'bbox1')).saved === 1 && (await where(B, 'bbox1')).saved === 0, 'asking for a present: it arrives, in exactly one save');
      for (const P of [A, B]) await P.evaluate(() => { if (window.pokecraft.swapUi.isOpen) document.getElementById('swap-close').click(); });
      // Not now: nothing moves
      await showPause(A); await waitFor(A, () => !!document.querySelector('#mp button[data-swap="trade"]'), null, 20000);
      await click(A, '#mp button[data-swap="trade"]');
      await waitFor(A, () => window.pokecraft.swapUi.isOpen);
      await click(A, '#swap .swap-tile[data-uid="abox1"]'); await click(A, '#swap-go');
      await asked(B, 'wants to trade');
      await B.evaluate(() => window.pokecraft.ui.askNo());
      await waitFor(A, () => window.pokecraft.swaps.info().view === 'note', null, 20000);
      const w1 = await where(A, 'abox1');
      t.ok(w1.live === 1 && w1.escrow === 0 && (await where(B, 'abox1')).live === 0, '"Not now" moves nothing');
      await A.evaluate(() => document.getElementById('swap-close').click());
    }

    if (want('trade')) {
      const mine = await creature(B, 'bbox3'), theirs = await creature(A, 'abox1');
      await showPause(B); await waitFor(B, () => !!document.querySelector('#mp button[data-swap="trade"]'), null, 20000);
      await click(B, '#mp button[data-swap="trade"]');
      await waitFor(B, () => window.pokecraft.swapUi.isOpen);
      await click(B, '#swap .swap-tile[data-uid="bbox3"]'); await click(B, '#swap-go');
      await asked(A, 'wants to trade');
      await A.evaluate(() => window.pokecraft.ui.askYes());
      await waitFor(A, () => window.pokecraft.swapUi.isOpen && !!document.querySelector('#swap .swap-card'));
      t.ok(await A.evaluate(() => document.querySelector('#swap .swap-card').textContent.includes('Sproutle')), 'the friend sees what is offered on top of their own creatures');
      await click(A, '#swap .swap-tile[data-uid="abox1"]'); await click(A, '#swap-go');
      await waitFor(B, () => !!document.getElementById('swap-yes'), null, 30000);
      t.ok(await B.evaluate(() => document.querySelector('#swap .swap-pair').textContent.includes('Fluffin')), 'the one who asked sees the offer back and says the last yes');
      await B.screenshot({ path: 'screenshots/w17-7-trade-last-yes.png' });
      await click(B, '#swap-yes');
      await idle(B); await idle(A);
      await waitFor(A, () => window.pokecraft.box.some(c => c.uid === 'bbox3'), null, 30000);
      t.ok(JSON.stringify(await creature(A, 'bbox3')) === JSON.stringify(mine) && JSON.stringify(await creature(B, 'abox1')) === JSON.stringify(theirs), 'both creatures arrive unchanged');
      const ws = [await where(A, 'bbox3'), await where(B, 'bbox3'), await where(A, 'abox1'), await where(B, 'abox1')];
      t.ok(ws[0].saved === 1 && ws[1].saved === 0 && ws[2].saved === 0 && ws[3].saved === 1 && ws.every(w => !w.escrow && !w.savedEscrow), `each one in exactly one save after the trade (${JSON.stringify(ws)})`);
      for (const P of [A, B]) await P.evaluate(() => { if (window.pokecraft.swapUi.isOpen) document.getElementById('swap-close').click(); });
      // No thanks at the last yes: nothing moves
      await showPause(B); await waitFor(B, () => !!document.querySelector('#mp button[data-swap="trade"]'), null, 20000);
      await click(B, '#mp button[data-swap="trade"]'); await waitFor(B, () => window.pokecraft.swapUi.isOpen);
      await click(B, '#swap .swap-tile[data-uid="bbox2"]'); await click(B, '#swap-go');
      await asked(A, 'wants to trade'); await A.evaluate(() => window.pokecraft.ui.askYes());
      await waitFor(A, () => !!document.querySelector('#swap .swap-tile[data-uid="abox3"]'));
      await click(A, '#swap .swap-tile[data-uid="abox3"]'); await click(A, '#swap-go');
      await waitFor(B, () => !!document.getElementById('swap-no'), null, 30000);
      await click(B, '#swap-no');
      await waitFor(A, () => window.pokecraft.swaps.info().theirs === null, null, 20000);
      t.ok((await where(A, 'abox3')).live === 1 && (await where(B, 'bbox2')).live === 1 && (await where(A, 'bbox2')).live === 0, '"No thanks" moves nothing');
      for (const P of [A, B]) await P.evaluate(() => { if (window.pokecraft.swapUi.isOpen) document.getElementById('swap-close').click(); });
    }

    if (want('crash')) {
      const reopen = async P => {
        await P.reload({ timeout: 120000 });
        await P.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
        await continueGame(P); await pause(P);
      };
      const join = P => P.evaluate(async code => { await window.pokecraft.mp.join(code, 'Kid'); }, code);
      const rejoin = async P => { await reopen(P); await join(P); };
      const gift = async (from, to, uid) => {
        await from.evaluate(uid => { const g = window.pokecraft; const a = [...g.mp.others.values()].find(x => x.swapPid); g.swaps.start(a); g.swaps.choose([...g.party, ...g.box].find(c => c.uid === uid)); }, uid);
        await asked(to, 'wants to trade'); await to.evaluate(() => window.pokecraft.ui.askYes());
        await waitFor(to, () => window.pokecraft.swaps.view?.mode === 'pick'); await to.evaluate(() => window.pokecraft.swaps.choose(null)); // Nothing back: a present
        await waitFor(from, () => window.pokecraft.swaps.mine?.stage === 'decide', null, 30000); await from.evaluate(() => window.pokecraft.swaps.yes());
      };
      // 1. the giver commits, its give never leaves, the giver's browser closes: the creature waits in its save, then comes back
      await B.evaluate(() => window.pokecraft.swaps.drop.add('give'));
      await gift(B, A, 'bbox2');
      await waitFor(B, () => window.pokecraft.swaps.info().out.length === 1, null, 20000);
      const w = await where(B, 'bbox2');
      t.ok(w.live === 0 && w.saved === 0 && w.escrow === 1 && w.savedEscrow === 1 && (await where(A, 'bbox2')).live === 0, `crash 1: after the giver's commit it is only in the giver's saved escrow (${JSON.stringify(w)})`);
      await reopen(B);
      t.ok((await B.evaluate(() => window.pokecraft.swaps.info().out.length)) === 1 && (await where(B, 'bbox2')).live === 0, 'crash 1: after the reload the escrow is still there (not in the team or Box)');
      await join(B);
      await hello(A, B);
      await waitFor(B, () => window.pokecraft.swaps.info().out.length === 0, null, 60000);
      const [c1a, c1b] = [await where(A, 'bbox2'), await where(B, 'bbox2')];
      t.ok(c1a.saved + c1b.saved === 1 && c1a.live + c1b.live === 1 && !c1a.escrow && !c1b.escrow && !c1b.savedEscrow, `crash 1: settled, in exactly one save (Dad ${JSON.stringify(c1a)}, Kid ${JSON.stringify(c1b)})`);
      // 2. the receiver commits, its "got" never leaves, the receiver's browser closes: the giver settles after the rejoin
      await hello(A, B);
      await B.evaluate(() => window.pokecraft.swaps.drop.add('got'));
      await gift(A, B, 'abox3');
      await waitFor(B, () => [...window.pokecraft.party, ...window.pokecraft.box].some(c => c.uid === 'abox3'), null, 30000);
      t.ok((await where(B, 'abox3')).saved === 1 && (await where(A, 'abox3')).savedEscrow === 1, "crash 2: the friend saved it, the giver's escrow waits for the answer");
      await rejoin(B);
      await waitFor(A, () => window.pokecraft.swaps.info().out.length === 0, null, 60000);
      const [c2a, c2b] = [await where(A, 'abox3'), await where(B, 'abox3')];
      t.ok(c2a.saved + c2a.live + c2a.escrow + c2a.savedEscrow === 0 && c2b.saved === 1 && c2b.live === 1, `crash 2: the repeated give is answered "got" from memory: never doubled (Dad ${JSON.stringify(c2a)}, Kid ${JSON.stringify(c2b)})`);
      // 3. the receiver said yes, then reloaded before the give came: it answers no and the creature goes home
      await hello(A, B);
      await A.evaluate(() => window.pokecraft.swaps.drop.add('give'));
      const uid3 = await A.evaluate(() => window.pokecraft.box[0].uid);
      await gift(A, B, uid3);
      await waitFor(A, () => window.pokecraft.swaps.info().out.length === 1, null, 20000);
      await rejoin(B);
      await A.evaluate(() => window.pokecraft.swaps.drop.clear());
      await waitFor(A, () => window.pokecraft.swaps.info().out.length === 0, null, 60000);
      const [c3a, c3b] = [await where(A, uid3), await where(B, uid3)];
      t.ok(c3a.saved === 1 && c3a.live === 1 && c3b.live + c3b.saved === 0, `crash 3: a forgotten yes answers no: the creature is back home (Dad ${JSON.stringify(c3a)}, Kid ${JSON.stringify(c3b)})`);
      t.ok(await B.evaluate(() => window.pokecraft.swaps.info().seen.includes('no')), 'crash 3: the no is remembered, so a later copy can never be taken');
    }

    if (want('old')) {
      // a friend whose game is older (never says hi, never hears swap): no buttons, one line
      await B.reload({ timeout: 120000 });
      await B.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await B.evaluate(() => { const g = window.pokecraft; g.swaps.update = () => {}; g.swaps.onMessage = () => {}; });
      await continueGame(B); await pause(B);
      await B.evaluate(async code => { await window.pokecraft.mp.join(code, 'Kid'); }, code);
      await waitFor(A, () => window.pokecraft.mp.others.size === 1 && !![...window.pokecraft.mp.others.values()].find(a => !a.swapPid), null, 90000);
      await showPause(A);
      await waitFor(A, () => document.querySelector('#mp')?.textContent.includes('game is older'), null, 30000);
      t.ok(await A.evaluate(() => !document.querySelector('#mp .swap-btn')), "an older friend's game gets no Trade button, just one line");
    }
    t.ok(A.errors.length === 0 && B.errors.length === 0, `no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
    await A.context().close(); await B.context().close();
  }

  // ---------------- iPad ----------------
  if (want('ipad')) {
    const { A, B } = await pair(browser, base, devices['iPad (gen 7) landscape']);
    await stock(A, 'a'); await stock(B, 'b');
    await hello(A, B);
    await A.tap('#btn-pause');
    await waitFor(A, () => !!document.querySelector('#mp button[data-swap="trade"]'), null, 20000);
    const tapAt = async (P, sel) => { const at = await P.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); await P.touchscreen.tap(at[0], at[1]); };
    await tapAt(A, '#mp button[data-swap="trade"]'); // a real finger tap (the box is redrawn every second, so no "stable" wait)
    await waitFor(A, () => window.pokecraft.swapUi.isOpen);
    t.ok(await A.evaluate(() => { const r = document.querySelector('#swap .swap-tile').getBoundingClientRect(); return r.width >= 100 && r.height >= 100; }), 'iPad: the tiles are big enough to tap');
    await A.tap('#swap .swap-tile[data-uid="abox1"]');
    t.ok(await A.evaluate(() => parseFloat(getComputedStyle(document.getElementById('swap-go')).minHeight) >= 44), 'iPad: the Offer! button is big enough to tap');
    await A.screenshot({ path: 'screenshots/w17-swap-ipad.png' });
    await A.tap('#swap-go');
    await asked(B, 'wants to trade');
    await B.tap('#ask-yes');
    await waitFor(B, () => window.pokecraft.swapUi.isOpen && !!document.querySelector('#swap .swap-tile[data-uid="nothing"]'));
    await B.tap('#swap .swap-tile[data-uid="nothing"]'); await B.tap('#swap-go');
    await waitFor(A, () => !!document.getElementById('swap-yes'), null, 30000);
    await A.tap('#swap-yes');
    await waitFor(B, () => [...window.pokecraft.party, ...window.pokecraft.box].some(c => c.uid === 'abox1'), null, 30000);
    await idle(A);
    t.ok((await where(A, 'abox1')).saved === 0 && (await where(B, 'abox1')).saved === 1, 'iPad: the present arrives, in exactly one save');
    await B.screenshot({ path: 'screenshots/w17-present-ipad.png' });
    t.ok(A.errors.length === 0 && B.errors.length === 0, `iPad: no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
    await A.context().close(); await B.context().close();
  }
}
