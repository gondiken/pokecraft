// T38b: realms together. A friend (the guest) follows the host into the Dream and the Swirl: the follow ask, the host's realm
// edits, blocks across, the guest's own save untouched (the main bug to prevent: the host's realm edits in the guest's save),
// the badge per player, waking up together, following later, a battle when the host wakes, the morning, duels / co-op /
// hide and seek only in the same place, the host stopping, the Swirl (no title needed) and an iPad pair.
// Screenshot: tests/screenshots/t38b-together-dream.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { HOUSE, sleep } from '../realmhelp.mjs';
import { ROOT, openPair, newGame, pause, click, waitFor, startWeakBattle, playBattle } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const toasts = page => page.evaluate(() => { window.__toasts = []; const g = window.pokecraft, f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; });
const said = (page, re) => page.evaluate(src => window.__toasts.some(m => new RegExp(src).test(m)), re.source);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 60000);
const askText = page => waitFor(page, () => window.pokecraft.ui.asking, null, 20000).then(() => page.evaluate(() => document.getElementById('ask-text').textContent));
const saved = page => page.evaluate(() => { window.pokecraft.save(); return JSON.parse(localStorage.getItem('pokecraft-save-v2')); });
const near = page => page.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return Math.hypot(a.pos.x - g.player.pos.x, a.pos.z - g.player.pos.z); });
// a free cell on the ground near (x, z) in the current world
const cellNear = (page, dx, dz) => page.evaluate(([dx, dz]) => { const g = window.pokecraft, w = g.world, x = Math.floor(g.player.pos.x) + dx, z = Math.floor(g.player.pos.z) + dz; return [x, w.surface(x, z).y + 1, z]; }, [dx, dz]);
const setBlock = (page, c, b) => page.evaluate(([c, b]) => { const g = window.pokecraft; g.world.set(...c, b); g.mp.sendBlock(...c, b); }, [c, b]);

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });

  // 1. Setup: Dad hosts, Kid joins and has dream edits of his own (they must never change).
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  const own = await B.evaluate(() => { const g = window.pokecraft; g.realmEdits = { dream: [[1234, 9]] }; g.save(); return g.world.seed; });
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await waitFor(B, () => window.pokecraft.mp.role === 'guest', null, 60000);
  const HA = await A.evaluate(HOUSE);
  await waitFor(A, () => window.pokecraft.homes.mine()?.types.includes('cozy'));
  await toasts(B);
  await B.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; g.player.pos.copy(a.target).add({ x: 2, y: 0, z: 0 }); });
  await waitFor(B, () => [...window.pokecraft.mp.others.values()][0]?.model.visible);

  // 2. Dad dreams; he builds a block; Kid is asked and follows.
  await sleep(A, HA.bed);
  const aSeed = await A.evaluate(() => window.pokecraft.realms.stash.seed);
  const aBlock = await cellNear(A, -4, -4);
  await setBlock(A, aBlock, 11);
  const ask = await askText(B);
  t.ok(/Dad is dreaming\. Dream together\?/.test(ask) && await B.evaluate(() => document.getElementById('ask-yes').textContent === 'Follow'), `Kid is asked to follow ("${ask}")`);
  await B.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(B, 'dream');
  const f = await B.evaluate(async ([aSeed, aBlock]) => {
    const g = window.pokecraft, R = await import('/src/realms.js'), a = [...g.mp.others.values()][0];
    return { seed: g.world.seed === R.realmSeed(aSeed, R.REALMS.dream.seedSalt), block: g.world.get(...aBlock), toast: window.__toasts.some(m => /You followed Dad into the dream/.test(m)), champion: g.champion };
  }, [aSeed, aBlock]);
  t.ok(f.seed, "Kid's world is the host's dream (same seed)");
  t.ok(f.block === 11, "Dad's block is there when Kid arrives (the host's dream edits)");
  t.ok(f.toast, 'Kid is told "You followed Dad into the dream!"');
  await waitFor(B, () => [...window.pokecraft.mp.others.values()][0]?.here && [...window.pokecraft.mp.others.values()][0].model.visible);
  await waitFor(A, () => [...window.pokecraft.mp.others.values()][0]?.here);
  t.ok(await near(B) < 4, `Kid arrives beside Dad (${(await near(B)).toFixed(1)} blocks)`);

  // 3. Blocks across, both ways; fixed blocks stay.
  const c1 = await cellNear(A, 2, 3);
  await setBlock(A, c1, 12);
  await waitFor(B, c => window.pokecraft.world.get(...c) === 12, c1);
  const c2 = await cellNear(B, -3, 3);
  await setBlock(B, c2, 13);
  await waitFor(A, c => window.pokecraft.world.get(...c) === 13, c2);
  const idx = await A.evaluate(c => { const w = window.pokecraft.world; return c[0] + w.W * (c[2] + w.D * c[1]); }, c2);
  t.ok(await A.evaluate(i => window.pokecraft.realms.edits().dream.some(e => e[0] === i && e[1] === 13), idx), "Kid's block is in Dad's dream edits (the host owns the dream)");
  const pad = await A.evaluate(() => { const g = window.pokecraft, w = g.world, [a, b, pa] = w.isles.links[0]; return [pa[0], pa[1], pa[2]]; });
  const padId = await A.evaluate(c => window.pokecraft.world.get(...c), pad);
  await B.evaluate(c => window.pokecraft.mp.sendBlock(c[0], c[1], c[2], 0), pad);
  await A.waitForTimeout(1500);
  t.ok(padId === 87 && await A.evaluate(c => window.pokecraft.world.get(...c) === 87, pad), "a Bounce Block can't be broken by a friend");
  await B.screenshot({ path: path.join(SHOTS, 't38b-together-dream.png') });

  // 4. Kid's own save: no host edits, his own seed, no place.
  const s1 = await saved(B);
  t.ok(s1.seed === own && !s1.place && JSON.stringify(s1.realmEdits.dream) === '[[1234,9]]', `Kid's save while following is his own: seed, no place, dream edits [[1234,9]] (${JSON.stringify(s1.realmEdits)} ${s1.seed === own})`);
  await pause(B);
  const s2 = await saved(B);
  t.ok(JSON.stringify(s2.realmEdits.dream) === '[[1234,9]]' && s2.seed === own, "and after pausing (the online-save path) it is still Kid's own");

  // 5. The guide and the gym: Kid earns the badge in Dad's dream; Dad does not.
  const guide = await B.evaluate(() => { const g = window.pokecraft; g.updateGuide(); return { text: document.getElementById('guide').textContent, gym: g.world.gyms.some(x => x.def.id === 'dream' && x.x != null) }; });
  t.ok(/Upside-Down House|Bounce|Jump|Fly|bounce/.test(guide.text) && guide.gym, `Kid's guide leads to the Upside-Down House ("${guide.text}")`);
  await B.evaluate(() => { const g = window.pokecraft, n = g.npcs.list.find(x => x.name === 'Leader Wimsy'); g.beaten.push('dream:trainer', 'dream:trainer2'); g.onBattleEnd('won', { trainer: n }); });
  t.ok(await B.evaluate(() => window.pokecraft.badges.includes('dream')) && !(await A.evaluate(() => window.pokecraft.badges.includes('dream'))), "Kid gets the Wonder Badge; Dad's badges are his own");

  // 6. Dad wakes: Kid wakes too, beside Dad, in Dad's world; his save is still his own.
  await toasts(B);
  await A.evaluate(() => window.pokecraft.realms.leave('stone'));
  await placeIs(B, 'main');
  t.ok(await said(B, /wake up too/), 'Kid is told "Dad woke up, so you wake up too!"');
  await placeIs(A, 'main');
  await waitFor(B, () => [...window.pokecraft.mp.others.values()][0]?.here);
  t.ok(await near(B) < 4 && await B.evaluate(s => window.pokecraft.world.seed === s, aSeed), `Kid is back in Dad's world beside Dad (${(await near(B)).toFixed(1)})`);
  const s3 = await saved(B);
  t.ok(JSON.stringify(s3.realmEdits.dream) === '[[1234,9]]' && s3.seed === own, "Kid's own dream edits are still [[1234,9]] after the trip");

  // 7. Follow later; Kid wakes alone; the Bed asks again.
  await A.evaluate(t => { window.pokecraft.time = t; }, 0.75);
  await sleep(A, HA.bed);
  t.ok(/Dad is dreaming/.test(await askText(B)), 'Dad dreams again: the ask comes again');
  await B.evaluate(() => window.pokecraft.ui.askNo());
  await pause(B);
  await click(B, '#mp button:has-text("Follow Dad")');
  await placeIs(B, 'dream');
  t.ok(true, 'Not now, then the pause box "Follow Dad" button takes Kid into the dream');
  await B.evaluate(() => window.pokecraft.realms.leave('stone'));
  await placeIs(B, 'main');
  await waitFor(B, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a && !a.here && !a.model.visible; });
  t.ok(await A.evaluate(() => window.pokecraft.place === 'dream'), 'Kid woke alone: Dad is still dreaming and hidden for Kid');
  await B.waitForTimeout(800);
  t.ok(!(await B.evaluate(() => window.pokecraft.ui.asking)), 'Kid is not asked again for the same trip');
  await B.evaluate(b => window.pokecraft.realms.useBed({ x: b[0], y: b[1], z: b[2], id: 71 }), HA.bed);
  t.ok(/Dad is dreaming/.test(await askText(B)), "using a Bed in Dad's world asks the same question");
  await B.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(B, 'dream');

  // 8. Kid is in a battle when Dad wakes: he stays until the battle ends; his block still reaches Dad's dream.
  await startWeakBattle(B, { species: 'zapple', level: 30 });
  await A.evaluate(() => window.pokecraft.realms.leave('stone'));
  await placeIs(A, 'main');
  await B.waitForTimeout(1500);
  t.ok(await B.evaluate(() => window.pokecraft.place === 'dream' && window.pokecraft.inBattle), 'Kid stays in the dream while he is in a battle');
  const c3 = await cellNear(B, 3, -3);
  await setBlock(B, c3, 14);
  const idx3 = await B.evaluate(c => { const w = window.pokecraft.world; return c[0] + w.W * (c[2] + w.D * c[1]); }, c3);
  await waitFor(A, i => (window.pokecraft.realmEdits.dream || []).some(e => e[0] === i && e[1] === 14), idx3);
  t.ok(true, "Kid's block reaches Dad's dream edits while Dad is awake (nothing Kid builds is lost)");
  t.ok(await playBattle(B), 'the battle ends');
  await placeIs(B, 'main');
  t.ok(true, 'right after the battle Kid wakes up too');

  // 9. Morning: both in the dream, the clock reaches morning, both are in main.
  await A.evaluate(t => { window.pokecraft.time = t; }, 0.75);
  await sleep(A, HA.bed);
  await askText(B); await B.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(B, 'dream');
  await A.evaluate(() => { window.pokecraft.time = 0.3; });
  await placeIs(A, 'main'); await placeIs(B, 'main');
  t.ok(true, 'in the morning both end up in the main world');

  // 10. Places: coop / hide and seek need the same place; hide and seek works in the dream and stops when someone leaves.
  await A.evaluate(t => { window.pokecraft.time = t; }, 0.75);
  await B.evaluate(() => window.pokecraft.ui.closeAsk?.());
  await B.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; g.player.pos.copy(a.target).add({ x: 2, y: 0, z: 0 }); });
  await sleep(A, HA.bed);
  await askText(B); await B.evaluate(() => window.pokecraft.ui.askNo());
  t.ok(await B.evaluate(() => [...window.pokecraft.mp.others.values()][0].here === false), 'Kid (main) and Dad (dream) are in different places');
  // a duel ask from a friend in another place is answered "busy" and never shown
  const duel = await B.evaluate(async () => { const g = window.pokecraft, D = await import('/src/duel.js'), a = [...g.mp.others.values()][0]; g.duels.onMessage({ type: 'ask', v: D.VERSION, id: 'x1', from: a.id, name: 'Dad', seed: 1, team: [] }); return !!g.duels.incoming; });
  t.ok(!duel, 'a duel ask from another place is not shown');
  await A.evaluate(() => window.pokecraft.realms.leave('stone')); await placeIs(A, 'main');
  await A.evaluate(t => { window.pokecraft.time = t; }, 0.75);
  await B.evaluate(() => { const g = window.pokecraft; g.ui.closeAsk?.(); });
  await sleep(A, HA.bed);
  await askText(B); await B.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(B, 'dream');
  // Dad in the dream, Kid in the dream: coopFor works for the place check only when they are apart; test "other place" with Kid back in main
  await B.evaluate(() => window.pokecraft.realms.leave('stone')); await placeIs(B, 'main');
  const err = await A.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return g.coopFor(g, 'giant1', a); });
  t.ok(/another place/.test(err.error || ''), `a co-op ask across places says so ("${err.error}")`);
  t.ok(await A.evaluate(() => (window.pokecraft.hideSeek.menuButtons() || []).every(b => b.tagName !== 'BUTTON' || !/Kid/.test(b.textContent))), 'no hide and seek button for a friend in another place');
  // follow again, then hide and seek inside the dream
  await B.evaluate(() => window.pokecraft.realms.follow()); await placeIs(B, 'dream');
  await waitFor(A, () => [...window.pokecraft.mp.others.values()][0]?.here);
  await A.evaluate(() => { const g = window.pokecraft, k = [...g.mp.others.values()][0]; g.hideSeek.invite(k); });
  await waitFor(B, () => window.pokecraft.ui.asking && /hide and seek/.test(document.getElementById('ask-text').textContent));
  await B.evaluate(() => window.pokecraft.ui.askYes());
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.active) && await waitFor(B, () => window.pokecraft.hideSeek.active), 'hide and seek starts inside the dream');
  await A.evaluate(() => window.pokecraft.realms.leave('stone'));
  await placeIs(A, 'main');
  t.ok(await waitFor(A, () => !window.pokecraft.hideSeek.active) && await waitFor(B, () => !window.pokecraft.hideSeek.active, null, 20000), 'hide and seek stops on both sides when Dad leaves the dream');
  await placeIs(B, 'main');

  // 11. The host stops sharing while Kid is in the dream: Kid goes home to his own world.
  await A.evaluate(t => { window.pokecraft.time = t; }, 0.75);
  await sleep(A, HA.bed);
  await askText(B); await B.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(B, 'dream');
  const before = await saved(B);
  t.ok(before.seed === own && !before.place, "while following, Kid's save is still his own world");
  await A.evaluate(() => window.pokecraft.mp.close());
  await B.waitForEvent('load', { timeout: 60000 }).catch(() => {});
  await B.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 60000 });
  const after = await B.evaluate(() => { const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { seed: s.seed, place: s.place, dream: s.realmEdits.dream }; });
  t.ok(after.seed === own && !after.place && JSON.stringify(after.dream) === '[[1234,9]]', `Kid reloaded into his own world and his dream edits are unchanged (${JSON.stringify(after)})`);

  t.ok(A.errors.length === 0 && B.errors.length === 0, `no page errors (${[...A.errors, ...B.errors].slice(0, 3).join(' | ')})`);
  await A.context().close(); await B.context().close();

  // 12. The Swirl: a Champion host; a guest without the title follows; the door asks again; the host comes back.
  const R = await (async () => { const [p] = await openPair(browser, base); const r = await p.evaluate(async () => !!(await import('/src/realms.js')).REALMS.swirl); await p.context().close(); return r; })();
  if (!R) t.ok(true, 'Swirl case skipped: no REALMS.swirl (T38a not merged)');
  else {
    const [SA, SB] = await openPair(browser, base);
    await newGame(SA, 0); await pause(SA); await newGame(SB, 1); await pause(SB);
    await SA.fill('#mp input[placeholder="Your name"]', 'Dad');
    await click(SA, '#mp button:has-text("Share my world")');
    await SA.waitForTimeout(500);
    const code2 = (await SA.textContent('.mp-code')).trim();
    await SB.fill('#mp input[placeholder="Your name"]', 'Kid');
    await SB.fill('#mp .mp-code-input', code2);
    await click(SB, '#mp button:has-text("Join a world")');
    await waitFor(SB, () => window.pokecraft.mp.role === 'guest', null, 60000);
    await toasts(SA); await toasts(SB);
    await SA.evaluate(() => { window.pokecraft.champion = true; });
    await SB.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; g.player.pos.copy(a.target).add({ x: 2, y: 0, z: 0 }); });
    const door = p => p.evaluate(() => { const g = window.pokecraft, c = g.world.portal; g.portal.use({ x: c.surface[0][0], y: c.surface[0][1], z: c.surface[0][2], id: 125 }); });
    await door(SA);
    await placeIs(SA, 'swirl');
    const sask = await askText(SB);
    t.ok(/Swirl/.test(sask), `Kid is asked about the Swirl ("${sask}")`);
    await SB.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(SB, 'swirl');
    t.ok(await said(SB, /door opens for you too/) && !(await SB.evaluate(() => window.pokecraft.champion)), "Kid follows without the Champion title, and the title stays Dad's");
    await SB.evaluate(() => window.pokecraft.realms.leave('door'));
    await placeIs(SB, 'main');
    await door(SB);
    t.ok(/Swirl/.test(await askText(SB)), 'the Portal Door asks again while Dad is in the Swirl');
    await SB.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(SB, 'swirl');
    await toasts(SB);
    await SA.evaluate(() => window.pokecraft.realms.leave('door'));
    await placeIs(SB, 'main');
    t.ok(await said(SB, /Portal Door, so you go too/), 'Dad goes back through the Portal Door: Kid does too');
    const ss = await saved(SB);
    t.ok(!ss.place && !(ss.realmEdits.swirl || []).length, "Kid's save has no Swirl edits of Dad's");
    t.ok(SA.errors.length === 0 && SB.errors.length === 0, `no page errors in the Swirl pair (${[...SA.errors, ...SB.errors].slice(0, 3).join(' | ')})`);
    await SA.context().close(); await SB.context().close();
  }

  // 13. iPad pair: Kid joins while Dad dreams, taps "Follow", and wakes with the touch button on the Wake Stone.
  const [TA, TB] = await openPair(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  for (const p of [TA, TB]) { await p.tap('text=New Game', { timeout: 120000 }); await p.tap('.starter >> nth=0', { timeout: 120000 }); await p.waitForTimeout(1500); }
  await TA.evaluate(async () => { const g = window.pokecraft; g.time = 0.75; await g.mp.host('Dad'); });
  await TA.evaluate(() => window.pokecraft.realms.enter('dream'));
  await placeIs(TA, 'dream');
  const tcode = await TA.evaluate(() => window.pokecraft.mp.code);
  await TB.evaluate(async code => { await window.pokecraft.mp.join(code, 'Kid'); }, tcode);
  t.ok(await TB.evaluate(() => window.pokecraft.place === 'main' && window.pokecraft.mp.role === 'guest'), 'iPad: Kid joins and lands in the main world');
  t.ok(/Dad is dreaming/.test(await askText(TB)), 'iPad: the ask comes at once');
  await TB.tap('#ask-yes');
  await placeIs(TB, 'dream');
  t.ok(true, 'iPad: tapping Follow takes Kid into the dream');
  await TB.evaluate(() => { const g = window.pokecraft, w = g.world, [x, y, z] = w.wake; g.player.pos.set(x + 0.5, y + 1, z + 3.5); g.player.vel.set(0, 0, 0); g.player.lookAt({ x: x + 0.5, y: y + 0.5, z: z + 0.5 }); });
  await waitFor(TB, () => document.getElementById('btn-act').textContent !== '' && !document.getElementById('btn-act').classList.contains('hidden'), null, 20000);
  await TB.tap('#btn-act');
  await placeIs(TB, 'main');
  t.ok(true, 'iPad: the touch action button on the Wake Stone wakes Kid');
  t.ok(TA.errors.length === 0 && TB.errors.length === 0, `no iPad page errors (${[...TA.errors, ...TB.errors].slice(0, 3).join(' | ')})`);
  await TA.context().close(); await TB.context().close();
}
