// Chapter 3: being your creature and its abilities in the world (plans/chapter3-ways.md, plans/chapter3-abilities-build.md steps C-D;
// ?preview only, Wobbleland only). Owner 2026-11-14: abilities work anywhere in Wobbleland with the usual controls (Jump flies, walking
// into a wall climbs, looking down dives, Jump kicks under water: no E), and a place only hints at what it needs after a few tries.
//   data:   bodies from abilities (fly / swim / climb), the place hook (placeAt, needOf, swapTo, NeedHints: the hint after 3 tries), the
//           places (the Sluice Gate, the Drip Tower, the crags and clouds), Glowcap Caves' glowing types = Glow
//   bots:   tests/waysbots.mjs with the real Player on the real terrain at 60 / 20 fps: the Drip Tower (Climb: just climbing never, waiting in
//           the nooks always, nobody without Climb or by swapping), the Sluice Gate (Swim), every crag (only climbers) and cloud (only fliers)
//   real:   real keys in a browser: you are your creature by itself, no bar, the pause screen's Be me (R), F = Swap, 1 2 3, V; the camera
//           stays behind; at the tower as Boomwing nothing shows until the third try, F goes round as always until then, then the card
//           (Climb, Sproutle lit) and F straight to Sproutle; no button word; W into the shaft's wall climbs; Be me shows the card too
//   places: the Sluice Gate (the card after tries, F to Tidalord, the plate, a run with real keys and Jump kicks through before it shuts),
//           a crag (Sproutle walks into it and climbs on top; Scalewing flies at it and stops at the cap), a cloud (Scalewing rises with
//           Jump and settles on it; Sproutle cannot); ways-sluice-*.png, ways-crag*.png, ways-cloud*.png
//   fight:  walking into a scribble patch AS your creature: it leads (no Capture Cube), you are it again afterwards, where it stood
//   ipad:   an emulated iPad: Place = Swap, Jump = Up while you fly; at the tower the card after tries, one tap on Swap, the joystick pushed
//           into the shaft's wall climbs; at a cloud the card, Swap, the Jump button held rises
//   closed: without ?preview and in the main world there is no creature mode and 1 2 3 still pick blocks
//   step D's second pair (overnight 2026-11-15/16, plans/chapter3-abilities-build.md "Overnight"): Dig and Push (earthworks.js, things.js)
//   bots:   + runDig (every mound's chest only for diggers; the Warm-or-Cold Dig: skilled always, at random at most a quarter, no digger
//           never) and runPush (the boulder caves only for pushers; the Ball Garden: the 5 pushes open it, straight at the holes never)
//   dig:    real keys: at a wall the button says nothing (it said "Break"); a mound as Scalewing: no word, a press says why, the card after
//           3 tries, Swap to Rattlepup, "Dig!", dig down, open the buried chest; the Warm-or-Cold Dig won with E presses (ways-digpatch*.png)
//   push:   a boulder cave: Scalewing walking into it is told it is too heavy, Woolumph walks it in; the Ball Garden: a real-key push rolls a
//           ball to the wall, the rest of the solution opens the glass case (ways-cave-*.png, ways-garden*.png)
//   earthipad: the same on an emulated iPad (the action button, Swap, the joystick into the boulder)
//   pose:   the climbing pose from behind, the side and three quarters (ways-pose-*.png): faces the wall, leans in, four paws grip it
//   WAYS_ONLY=data|bots|real|places|dig|push|earthipad|pose|fight|ipad|closed
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, newGame, waitFor } from '../helpers.mjs';
import { intoWobble } from './wobble.mjs';

const only = process.env.WAYS_ONLY;
const want = name => !only || only.split(',').includes(name);
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const shot = async (page, name) => { await page.evaluate(() => window.pokecraft.ui.toastBox?.replaceChildren()); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`    screenshot ${name}`); };
const frames = (page, n = 3) => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const team = page => page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('scalewing', 30), S.makeCreature('sproutle', 30), S.makeCreature('boomwing', 30)]; });
const put = (page, x, y, z, yaw = 0, pitch = -0.1) => page.evaluate(([x, y, z, yaw, pitch]) => { const p = window.pokecraft.player; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; }, [x, y, z, yaw, pitch]);
const be = page => page.evaluate(() => window.pokecraft.being.info());
const need = page => page.evaluate(() => {
  const g = window.pokecraft, i = g.gymLive.of('part:wobble').info(), c = document.getElementById('need'), card = !!c && !c.classList.contains('hidden');
  return { needAt: i.needAt, needs: i.needs, needHas: i.needHas, card, badge: card && !!c.querySelector('.need-badge svg'), text: card ? c.querySelector('.need-text').textContent : '',
    lit: card ? [...c.querySelectorAll('.need-mon.can span')].map(e => e.textContent).join() : '', next: card ? c.querySelector('.need-mon.next span')?.textContent ?? '' : '',
    act: g.touch?.cur?.().act.label ?? document.getElementById('btn-act')?.textContent.trim(), tries: i.needTries, prompt: document.getElementById('prompt')?.textContent ?? '' };
});
// walk into a place's box `n` times (from far away), so the place counts n tries
const tries = async (page, at, n) => { for (let i = 0; i < n; i++) { await put(page, 60.5, 11, 60.5); await frames(page, 2); await put(page, ...at); await frames(page, 3); } };
const poll = (page, fn) => page.evaluate(src => new Promise(res => { const f = new Function('g', 'return ' + src), t0 = performance.now(); const go = () => { const g = window.pokecraft; let v = null; try { v = f(g); } catch { v = null; } if (v || performance.now() - t0 > 200000) res(v); else requestAnimationFrame(go); }; go(); }), fn);
const toasts = page => page.evaluate(() => [...(window.pokecraft.ui.toastBox?.children || [])].map(e => e.textContent).join(' | '));

export default async function ({ browser, base, t }) {
  if (want('data')) {
    await import('../wobblenode.mjs'); // (registers 'three' for Node)
    const C = await import('../../src/creatureways.js'), S = await import('../../src/species.js'), P = await import('../../src/abilityplaces.js');
    const W = await import('../../src/wayland.js'), G = await import('../../src/groundrules.js');
    const b = id => C.bodyOf(id, S.SPECIES[id]);
    const bw = b('boomwing'), sw = b('scalewing'), sp = b('sproutle'), td = b('tidalord'), bt = b('beetlet'), vw = b('voltwing');
    t.ok(bw.fly && sw.fly && !sw.climb && sp.climb && !sp.fly && td.swim && !td.fly && bt.fly && bt.climb && !vw.fly, `bodies come from abilities: Boomwing and Scalewing fly, Sproutle climbs, Tidalord swims, Beetlet flies and climbs, Voltwing (small wings, Electric) walks`);
    t.ok(b('bubbuck').swim && b(Object.keys(S.SPECIES).find(k => S.SPECIES[k].type === 'bubble')).fly, 'Swim: Water and Bubble creatures; Bubble also flies (it settles onto water and dives)');
    const place = W.NEED_PLACES.find(q => q.id === 'driptower'), at = P.placeAt(W.NEED_PLACES, { x: W.SHAFT.x + 0.5, y: W.SHAFT.floor, z: W.SHAFT.z + 3 }), off = P.placeAt(W.NEED_PLACES, { x: 60, y: 11, z: 60 });
    const n1 = P.needOf(at, sw.abilities, [sw.abilities, sp.abilities, bw.abilities]), n2 = P.needOf(at, sp.abilities, []), n3 = P.needOf(at, [], [sw.abilities, bw.abilities]);
    t.ok(place.needs === 'climb' && at === place && !off && !n1.has && n1.who.join() === '1' && P.swapTo(n1, 2, 3) === 1 && P.swapTo(n1, null, 3) === 1 && n2.has && !n3.who.length && P.swapTo(n3, 0, 2) === null,
      `a place is one data entry (the Drip Tower needs ${place.needs}); Scalewing: not it, Sproutle lit, Swap goes straight to Sproutle; nobody: no shortcut`);
    const h = new P.NeedHints(), seen = [];
    for (let i = 0; i < 3; i++) { h.step(null, false, 0.1); h.step(place, false, 0.1); seen.push(h.shown(place.id)); }
    const h2 = new P.NeedHints(); h2.step(place, false, 0.1); for (let i = 0; i < 100; i++) h2.step(place, false, 0.1);
    const h3 = new P.NeedHints(); for (let i = 0; i < 3; i++) { h3.step(null, true, 0.1); h3.step(place, true, 0.1); }
    t.ok(seen.join() === 'false,false,true' && h2.tries(place.id) === 2 && !h3.shown(place.id), `the hint only after trying: walking in 3 times (${seen}), or staying ${P.HINT.every} s counts one more (${h2.tries(place.id)} after 10 s), never while you can (${h3.tries(place.id)})`);
    const E = await (await import('../wobblenode.mjs')).wobbleEnv(), ids = E.w.needPlaces.map(q => `${q.id}:${q.needs}`).join();
    const ceil = E.w.flyCeiling, tops = E.w.spots.map(q => `${q.id} ${q.top}`).join(', ');
    t.ok(ids === 'sluice:swim,driptower:climb,mound1:dig,mound2:dig,mound3:dig,mound4:dig,mound5:dig,mound6:dig,cave1:push,cave2:push,cave3:push,digpatch:dig,garden:push,crag1:climb,crag2:climb,crag3:climb,cloud1:fly,cloud2:fly,cloud3:fly,cloud4:fly' && ceil === 26 && W.SHAFT.roof + 1 > ceil && E.w.spots.every(q => q.kind === 'crag' ? q.top > ceil + 1 : q.top <= ceil && q.top - (q.ground + 1) > 2.3),
      `places: ${ids}; one cloud ceiling for wings at ${ceil} (owner 2026-11-14): the crags' tops and the tower's roof (${W.SHAFT.roof + 1}) above it, the clouds under it and over a jump (${tops})`);
    const TH = await import('../../src/things.js'), K = await import('../../src/earthworks.js'), A = await import('../../src/abilities.js');
    const kinds = Object.entries(TH.THINGS).map(([k, v]) => `${k}:${v.needs}/${v.how}`).join(' ');
    const c1 = K.keyCandidates([[3, 3, 4]]).length, c2 = K.keyCandidates([[3, 3, 1]]).length, worst = Math.max(...Array.from({ length: 49 }, (_, i) => K.keyCandidates([[0, 0, K.warmth(0, 0, i % 7, Math.floor(i / 7))]]).length));
    t.ok(Object.values(TH.THINGS).every(v => A.ABILITIES[v.needs] && v.why && (v.how === 'walk' || v.word)) && c1 === 0 && c2 === 8 && worst === 33,
      `things an ability acts on (things.js): ${kinds}; every one says why; the Warm-or-Cold Dig: a cold hole in the middle leaves ${c1} squares, a red one ${c2}, a cold corner hole ${worst} (of 49)`);
    t.ok(G.BRIGHT.slice().sort().join() === 'atlantis,cosmic,electric,fire,light,rainbow' && G.KEEN.join() === 'ghost,ninja', `Glowcap Caves: the glowing types are the Glow ability's (${G.BRIGHT}); Ghost / Ninja still sense (${G.KEEN})`);
  }

  if (want('bots')) {
    const { runTower, runSluice, runSpots, runCurrents, runDig, runPush } = await import('../waysbots.mjs');
    const dg = await runDig({ tries: 12 }), pu = await runPush(), d = (o, k) => `${o[k + '@60'].wins}/${o[k + '@60'].of} · ${o[k + '@20'].wins}/${o[k + '@20'].of}`;
    const ok = (o, re) => [...new Set(Object.entries(o).filter(([k, v]) => re.test(k) && v).map(([k]) => k.split('.')[1].split('@')[0]))].join(', ');
    t.ok(!dg.problems.length, `Dig, 60 · 20 fps: the mounds' chests seen by ${ok(dg.out, /^mound/)} only; the Warm-or-Cold Dig: skilled ${d(dg.out, 'patch.skilled')} (digs ${dg.out['patch.skilled@60'].digs}), at random ${d(dg.out, 'patch.naive')}, without Dig: ${d(dg.out, 'patch.pusher')} / ${d(dg.out, 'patch.flier')} ${dg.problems.join('; ')}`);
    t.ok(!pu.problems.length, `Push, 60 · 20 fps: into the boulder caves: ${ok(pu.out, /^cave/)} only; the Ball Garden: the 5 pushes ${pu.out['garden.skilled@60']} s · ${pu.out['garden.skilled@20']} s, straight at the holes ${pu.out['garden.naive@60']} · ${pu.out['garden.naive@20']}, without Push ${pu.out['garden.digger@60']} / ${pu.out['garden.flier@60']} / ${pu.out['garden.walker@60']} ${pu.problems.join('; ')}`);
    const a = await runTower(), ss = await runSluice(), sp = await runSpots(), cu = await runCurrents();
    const c = k => cu.out[k + '@60'];
    t.ok(!cu.problems.length, `shallow water, 1.2 s: Bottlet ${c('shallow.bottlet')}, Blazehound ${c('shallow.blazehound')}, Tightropa ${c('shallow.tightropa')}; currents, 3 s upstream at 60 · 20 fps: Bottlet ${c('river.bottlet')} / ${c('lead.bottlet')} / ${c('cave.bottlet')} (river / lake lead / cave river), Tidalord ${c('lead.tidalord')}; no Swim: Tightropa ${c('river.tightropa.sprint')} / ${c('lead.tightropa.sprint')} / ${c('cave.tightropa.sprint')} sprinting, on foot ${c('lead.onFoot')} ${cu.problems.join('; ')}`);
    const g = (o, k) => `${o[k + '@60'].wins}/${o[k + '@60'].of} · ${o[k + '@20'].wins}/${o[k + '@20'].of}`, f = k => g(a.out, k);
    t.ok(!a.problems.length, `the Drip Tower (Climb), the real Player at 60 · 20 fps: just climbing ${f('naiveClimb')}, skilled ${f('skilledClimb')} (${a.out['skilledClimb@60'].median} s), a Bug (${a.out.bug}) ${f('bugSkilled')}; without Climb: flier ${f('flier')} (top ${a.out['flier@60'].top} < roof ${a.out.roof}), Boomwing ${f('boomwing')}, walker ${f('walker')}, on foot ${f('onFoot')}, flier -> walker ${f('mixFlierWalker')}, walker -> flier ${f('mixWalkerFlier')}, glide from the hill ${f('hillGlider')} (top ${a.out['hillGlider@60'].top}), the ice outside ${f('iceWall')} ${a.problems.join('; ')}`);
    t.ok(!ss.problems.length, `the Sluice Gate (Swim), 60 · 20 fps: straight through the kelp ${g(ss.out, 'sluice.naive')}, skilled ${g(ss.out, 'sluice.skilled')} (${ss.out['sluice.skilled@60'].times} s), Bubble ${g(ss.out, 'sluice.bubble')}; without Swim: walker ${g(ss.out, 'sluice.walker')}, on foot ${g(ss.out, 'sluice.onFoot')}, flier ${g(ss.out, 'sluice.flier')}, climber ${g(ss.out, 'sluice.climber')}, flier -> walker ${g(ss.out, 'sluice.mixFlierWalker')} ${ss.problems.join('; ')}`);
    const won = Object.entries(sp.out).filter(([, v]) => v.won).map(([k]) => k.split('@')[0]);
    t.ok(!sp.problems.length, `the crags and clouds at 60 · 20 fps: on top: ${[...new Set(won)].join(', ')}; nobody else ${sp.problems.join('; ')}`);
  }

  if (want('real') || want('fight')) {
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    await team(page);
    await intoWobble(page, { creature: true });
    await put(page, 100.5, 11, 137.5);
    await frames(page, 4);
    if (want('real')) {
      const b1 = await be(page);
      t.ok(!(await page.evaluate(() => !!document.getElementById('squad'))) && b1.on && !b1.me && b1.species === 'scalewing' && b1.flying && b1.behind && b1.model, `in Wobbleland you are your first creature by itself (owner 2026-11-12), Scalewing, flying, the camera behind it; no extra bar (${JSON.stringify(b1)})`);
      // the camera stays put while you walk forward and sideways (owner 2026-11-12: it flashed in and out on W, A, D)
      const camSteady = await page.evaluate(async () => {
        const g = window.pokecraft, p = g.player, out = [];
        for (const k of ['KeyW', 'KeyD', 'KeyA', 'KeyS']) {
          p.keys[k] = true;
          for (let i = 0; i < 10; i++) { await new Promise(r => requestAnimationFrame(r)); const c = g.camera.position; out.push(Math.hypot(c.x - p.pos.x, c.y - p.pos.y - 1.2, c.z - p.pos.z)); }
          p.keys[k] = false;
        }
        return { min: Math.min(...out), max: Math.max(...out) };
      });
      t.ok(camSteady.min > 3.5, `walking W, D, A, S the camera stays behind your creature (distance ${camSteady.min.toFixed(2)}..${camSteady.max.toFixed(2)}, never on its head)`);
      await shot(page, 'ways-scalewing.png');
      await page.keyboard.press('KeyF'); await page.keyboard.press('KeyF'); await frames(page, 4);
      const b3 = await be(page);
      t.ok(b3.species === 'boomwing' && b3.flying, `F twice: Swap goes round your three to Boomwing (${b3.species}); swapping works in the air too`);
      // V switches the camera
      await page.keyboard.press('KeyV'); await frames(page, 3);
      const eyes = await be(page);
      await page.keyboard.press('KeyV'); await frames(page, 2);
      t.ok(eyes.view === 'eyes' && !eyes.model, `V: the camera goes into its eyes (${eyes.view}), V again behind`);
      // the Drip Tower (step C, owner 2026-11-14: discovery first): as Boomwing nothing shows at first, F goes round as always
      const T = [140.5, 11, 117.5, 0, 0.32];
      await tries(page, T, 1);
      const n0 = await need(page);
      await page.keyboard.press('KeyF'); await frames(page, 3);
      const r0 = await be(page);
      t.ok(n0.needAt === 'driptower' && !n0.card && r0.species === 'scalewing', `at the Drip Tower as Boomwing: no card at first (tries ${n0.tries}); F goes round as always (${r0.species})`);
      await page.keyboard.press('KeyF'); await frames(page, 2); await page.keyboard.press('KeyF'); await frames(page, 2); // (back to Boomwing)
      await tries(page, T, 2);
      const n1 = await need(page);
      t.ok((await be(page)).species === 'boomwing' && n1.card && n1.badge && n1.text === 'Needs Climb' && n1.lit === 'Sproutle' && n1.next === 'Sproutle', `after the third try: the card with the drawn Climb badge, "${n1.text}", Sproutle lit and ringed (tries ${n1.tries})`);
      await shot(page, 'ways-need-without.png');
      await page.keyboard.press('KeyF'); await frames(page, 4);
      const n2 = await need(page), sp = await be(page);
      t.ok(sp.species === 'sproutle' && sp.climb && n2.needHas && !n2.card && n2.act !== 'Climb!' && !/climb/i.test(n2.prompt), `now F goes straight to Sproutle; the card goes, no button word (action "${n2.act}", prompt "${n2.prompt}")`);
      t.ok(sp.move === 'land' && sp.speed === 7, `Sproutle walks at the land ride's speed (${sp.speed})`);
      await shot(page, 'ways-need-with.png');
      // just walk in and on into the shaft's wall: it climbs
      await page.keyboard.down('w');
      const climb = await page.evaluate(() => new Promise(res => { const t0 = performance.now(); const f = () => { const g = window.pokecraft, p = g.player; if (p.pos.y > 12.5 || performance.now() - t0 > 200000) res({ y: p.pos.y, ...g.being.info() }); else requestAnimationFrame(f); }; f(); }));
      await shot(page, 'ways-shaft.png');
      await page.keyboard.up('w'); await frames(page, 2);
      t.ok(climb.y > 12.5 && climb.climbing && climb.tight && !climb.behind, `W into the shaft's wall climbs it (y ${climb.y.toFixed(1)}), no button; in the shaft the camera is in its eyes`);
      // Be me: you have no Climb, the card shows too (the tries are already counted)
      await put(page, ...T);
      await page.evaluate(() => window.pokecraft.being.setMe(true)); await frames(page, 4);
      const n3 = await need(page);
      t.ok(n3.card && !n3.needHas && n3.lit === 'Sproutle', `as yourself (Be me) the same card: Sproutle lit (${n3.lit})`);
      await shot(page, 'ways-need-me.png');
      await page.keyboard.press('KeyF'); await frames(page, 3);
      t.ok((await be(page)).species === 'sproutle', 'and Swap from yourself goes straight to Sproutle');
      await page.evaluate(() => window.pokecraft.being.setMe(false)); await frames(page, 2);
      // the pause screen's button: Be me, and back
      await page.evaluate(() => document.exitPointerLock()); await page.waitForTimeout(400);
      const btn1 = await page.evaluate(() => document.getElementById('beme-btn')?.textContent);
      await page.evaluate(() => document.getElementById('beme-btn').click()); await frames(page, 4);
      const me = await be(page), btn2 = await page.evaluate(() => document.getElementById('beme-btn')?.textContent);
      t.ok(btn1 === '🧍 Be me' && !me.on && me.me && btn2 === '🐾 Be my creature' && !(await page.evaluate(() => window.pokecraft.player.be)), `the pause screen: "${btn1}" makes you you and stays so (${btn2})`);
      await page.evaluate(() => document.getElementById('beme-btn').click()); await frames(page, 3);
      t.ok((await be(page)).on, 'and "Be my creature" makes you your creature again');
      await page.evaluate(() => document.getElementById('resume').click()); await frames(page, 3); // (back to playing)
      await page.evaluate(() => window.pokecraft.being.setMe(true)); await frames(page, 2);
    }
    if (want('fight')) {
      await put(page, 112.5, 11, 194.5);
      await frames(page, 3);
      await page.evaluate(() => window.pokecraft.being.setMe(false)); await frames(page, 3); await page.keyboard.press('Digit2'); await frames(page, 3); // (creature mode again, 2 = Sproutle)
      await page.keyboard.down('w');
      await waitFor(page, () => window.pokecraft.scribble.fighting, null, 240000).catch(() => {});
      await page.keyboard.up('w');
      const f = await page.evaluate(() => { const S = window.pokecraft.scribble, i = S.info(); return { fighting: S.fighting, lead: S.fight?.lead, you: S.fight?.you?.c?.species, cube: i.cube, avatar: i.avatar }; });
      t.ok(f.fighting && f.lead === 1 && f.you === 'sproutle' && !f.cube && !f.avatar, `walking in as Sproutle: it leads the fight (squad place 2), no Capture Cube, no person standing by (${JSON.stringify(f)})`);
      await waitFor(page, () => window.pokecraft.scribble.info().phase === 'fight', null, 120000).catch(() => {});
      await shot(page, 'ways-fight.png');
      await page.evaluate(() => { const F = window.pokecraft.scribble.fight; for (const x of F.foes) { x.hp = 0; x.alive = false; } F.finish(true); });
      await waitFor(page, () => !window.pokecraft.scribble.fighting, null, 240000).catch(() => {});
      const after = await page.evaluate(() => ({ ...window.pokecraft.being.info(), key: window.pokecraft.beaten.includes('pw:wobble:patch1') }));
      t.ok(after.on && after.species === 'sproutle' && after.key, `after the win you are still Sproutle, where it fought; the patch is cleared (${JSON.stringify({ on: after.on, species: after.species, key: after.key })})`);
    }
    t.ok(!page.errors.length, `no page errors (${page.errors.join('; ')})`);
    await page.context().close();
  }

  if (want('places')) { // step D with real keys through the game's loop: the Sluice Gate (Swim), a crag (Climb), a cloud (Fly)
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('sproutle', 30), S.makeCreature('scalewing', 30), S.makeCreature('tidalord', 30)]; });
    await intoWobble(page, { creature: true });
    const live = () => page.evaluate(() => window.pokecraft.gymLive.of('part:wobble').info());
    const poll = fn => page.evaluate(src => new Promise(res => { const f = new Function('g', 'return ' + src), t0 = performance.now(); const go = () => { const g = window.pokecraft; let v = null; try { v = f(g); } catch { v = null; } if (v || performance.now() - t0 > 200000) res(v); else requestAnimationFrame(go); }; go(); }), fn);
    const spots = await page.evaluate(() => window.pokecraft.world.spots.map(q => ({ ...q })));
    // a crag, as Sproutle: walk into it and climb on top (nothing marks it)
    const crag = spots.find(q => q.id === 'crag1'), cx = crag.x + crag.w / 2, cz = crag.z + crag.d / 2;
    await put(page, cx, crag.ground + 1, cz + crag.d / 2 + 4, 0, 0.35); await frames(page, 4);
    const c0 = await need(page);
    await shot(page, 'ways-crag.png');
    await page.keyboard.down('w');
    const mid = await poll(`g.player.climbing && g.player.pos.y > ${crag.ground + 5} && g.being.info()`);
    await shot(page, 'ways-crag-climb.png');
    t.ok(mid && mid.pose > 0.8 && mid.tilt < -0.3 && mid.paws && mid.behind, `climbing, it faces the wall and leans into it (pose ${mid?.pose}, tilt ${mid?.tilt}), four paws grip the wall (${mid?.paws}), the camera behind it`);
    const onTop = await poll(`g.player.onGround && g.player.pos.y >= ${crag.top - 0.05} && g.player.pos.y`);
    await page.keyboard.up('w'); await frames(page, 3);
    t.ok(!c0.card && onTop, `a crag (nothing marks it: no card ${!c0.card}): Sproutle walks into its wall and climbs on top (y ${onTop})`);
    await page.evaluate(() => { window.pokecraft.player.pitch = -0.5; }); await frames(page, 3);
    await shot(page, 'ways-crag-top.png');
    // Scalewing (no Climb) flies at it holding Jump: it stops at the fly cap
    await put(page, cx, crag.ground + 1, cz + crag.d / 2 + 4, 0, 0.35); await page.keyboard.press('Digit2'); await frames(page, 3);
    await page.keyboard.down('Space'); await page.keyboard.down('w');
    await page.waitForTimeout(4000);
    const flyTop = await page.evaluate(() => window.pokecraft.player.pos.y), tcCrag = await toasts(page);
    await page.keyboard.up('w'); await page.keyboard.up('Space');
    t.ok(flyTop < crag.top - 0.5, `Scalewing flies at the crag holding Jump: it cannot get up it (${flyTop.toFixed(1)} < ${crag.top}): the top is above the clouds`);
    // the cloud layer: holding Jump, Scalewing stops at it and is told once why
    const ceil = await page.evaluate(() => window.pokecraft.world.flyCeiling);
    await put(page, 60.5, 11, 160.5, 0, 0.6); await frames(page, 2);
    await page.keyboard.down('Space');
    const atCeil = await poll(`g.player.capped && g.player.pos.y`);
    await page.keyboard.up('Space');
    const tc = await toasts(page);
    await shot(page, 'ways-ceiling.png');
    t.ok(Math.abs(atCeil - ceil) < 0.1 && /up to the clouds/.test(tc + tcCrag), `holding Jump anywhere, Scalewing rises to the cloud layer (${atCeil}, ceiling ${ceil}), the same height everywhere, and is told why once (${tc})`);
    // a cloud, as Scalewing: hold Jump (no E), fly over it, let go and settle on it
    const cl = spots.find(q => q.id === 'cloud1');
    await put(page, cl.x + 0.5, cl.ground + 1, cl.z + 7.5, 0, 0.4); await frames(page, 3);
    await page.keyboard.down('Space');
    await poll(`g.player.pos.y > ${cl.top + 0.6}`);
    await page.keyboard.down('w');
    await poll(`Math.hypot(g.player.pos.x - ${cl.x + 0.5}, g.player.pos.z - ${cl.z + 0.5}) < 0.9`);
    await page.keyboard.up('w'); await page.keyboard.up('Space');
    const onCloud = await poll(`g.player.onGround && g.player.pos.y >= ${cl.top - 0.05} && g.player.pos.y`);
    t.ok(onCloud, `a cloud: Scalewing rises with Jump, flies over it, lets go and settles on it (y ${onCloud})`);
    await page.evaluate(() => { window.pokecraft.player.pitch = -0.3; }); await frames(page, 3);
    await shot(page, 'ways-cloud.png');
    // the Drip Tower's ice, as Sproutle: walking into it from outside does not climb, and it says why once
    await page.keyboard.press('Digit1'); await frames(page, 3);
    await put(page, 145.0, 11, 112.5, Math.PI / 2, 0.2); await frames(page, 2);
    await page.keyboard.down('w'); await page.waitForTimeout(2500);
    const iceY = await page.evaluate(() => window.pokecraft.player.pos.y), ti = await toasts(page);
    await shot(page, 'ways-ice.png');
    await page.keyboard.up('w');
    t.ok(iceY < 12 && /slippery/i.test(ti), `the Drip Tower's outside is glossy ice: Sproutle cannot climb it (y ${iceY.toFixed(1)}) and is told why (${ti})`);
    await page.keyboard.press('Digit2'); await frames(page, 3);
    // the Sluice Gate, as Scalewing: the card after tries, Tidalord lit; F goes to Tidalord
    const SP = [128.5, 11, 96, 0, -0.2];
    await tries(page, SP, 3);
    const n3 = await need(page);
    t.ok(n3.needAt === 'sluice' && n3.needs === 'swim' && n3.card && n3.lit === 'Tidalord', `the Sluice Gate as Scalewing, after 3 tries: "${n3.text}", Tidalord lit`);
    await shot(page, 'ways-sluice-without.png');
    await page.keyboard.press('KeyF'); await frames(page, 4);
    await put(page, 128.5, 11, 93.5, 0, -0.2); await frames(page, 6);
    const g1 = await live();
    t.ok((await be(page)).species === 'tidalord' && g1.gateShut === 0, `F: Tidalord; on the gold plate the gate is open (${g1.gateShut} rows shut)`);
    // after that one jump Swap goes round all three as always (owner 2026-11-15: it went back and forth between two and never reached the third)
    const round = [];
    for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyF'); await frames(page, 3); round.push((await be(page)).species); }
    t.ok(round.join() === 'sproutle,scalewing,tidalord', `at the Sluice Gate, after the jump to Tidalord, F goes round all three: ${round.join(' -> ')}`);
    await shot(page, 'ways-sluice-with.png');
    // a run with real keys (W + Shift held, Jump kicks under water): the page only turns the head toward each spot, like a child steering
    await page.evaluate(() => {
      const g = window.pokecraft, p = g.player, y = 6.6, pts = [[128.5, 9.5, 90.2], [131.5, y, 88.6], [141.5, y, 88.7], [147.6, y, 88.6], [147.6, y, 99.5], [147.5, y, 102.2]];
      let i = 0; const t0 = performance.now();
      const go = () => {
        while (i < pts.length - 1 && Math.hypot(pts[i][0] - p.pos.x, pts[i][1] - p.pos.y - 0.4, pts[i][2] - p.pos.z) < 1.1) i++;
        const [x, yy, z] = pts[i], d = Math.hypot(x - p.pos.x, z - p.pos.z) || 1;
        p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); p.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(yy - (p.pos.y + 0.9), d)));
        if (!g.gymLive.of('part:wobble').info().through && performance.now() - t0 < 240000) requestAnimationFrame(go);
      };
      go();
    });
    await page.keyboard.down('Shift'); await page.keyboard.down('w');
    let kicking = true;
    const kicks = (async () => { while (kicking) { if (await page.evaluate(() => window.pokecraft.player.diving).catch(() => false)) await page.keyboard.press('Space').catch(() => {}); await page.waitForTimeout(350); } })();
    const thru = await poll("(() => { const i = g.gymLive.of('part:wobble').info(); if (g.player.diving) window.__dived = true; if (window.__dived && !window.__shot && g.player.pos.x > 136) { window.__shot = 1; return 'shot'; } return i.through ? i : null; })()");
    if (thru === 'shot') await shot(page, 'ways-sluice-dive.png');
    const done = thru === 'shot' ? await poll("(() => { const i = g.gymLive.of('part:wobble').info(); return i.through ? i : null; })()") : thru;
    kicking = false; await kicks;
    await page.keyboard.up('w'); await page.keyboard.up('Shift');
    t.ok(done?.through && await page.evaluate(() => !!window.__dived), `Tidalord dives (looking down), kicks with Jump, rides the bubble jets and gets through the gate before it shuts`);
    t.ok(!page.errors.length, `places: no page errors (${page.errors.join('; ')})`);
    await page.context().close();
  }

  // step D's second pair: Dig and Push with real keys through the game's own loop (desktop, then iPad)
  if (want('dig') || want('push') || want('earthipad')) for (const dev of [(want('dig') || want('push')) && null, want('earthipad') && 'iPad (gen 7) landscape'].filter(x => x !== false)) {
    const ipad = !!dev, tag = ipad ? 'iPad: ' : '';
    const page = await openGame(browser, base, { query: '?preview', ...(dev ? { contextOptions: devices[dev] } : {}) });
    await newGame(page, 0);
    await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('scalewing', 30), S.makeCreature('rattlepup', 30), S.makeCreature('woolumph', 30)]; });
    await intoWobble(page, { creature: true });
    const live = () => page.evaluate(() => window.pokecraft.gymLive.of('part:wobble').info().earth);
    const act = () => page.evaluate(() => ({ act: window.pokecraft.touch?.cur?.().act.label ?? '', dim: window.pokecraft.touch?.cur?.().act.dim, prompt: document.getElementById('prompt')?.textContent ?? '' }));
    const press = async () => { if (ipad) await page.tap('#btn-act'); else await page.keyboard.press('KeyE'); await frames(page, 3); };
    const swap = async () => { if (ipad) await page.tap('#btn-place'); else await page.keyboard.press('KeyF'); await frames(page, 3); };
    const look = (x, y, z) => page.evaluate(([x, y, z]) => window.pokecraft.player.lookAt({ x, y, z }), [x, y, z]);
    const E = await page.evaluate(() => { const e = window.pokecraft.world.earth; return { mounds: e.mounds, caves: e.caves.map(c => ({ id: c.id, x: c.x, z: c.z, w: c.w, d: c.d, g: c.g, h: c.h })), patch: { x0: e.patch.x0, z0: e.patch.z0, n: e.patch.n, g: e.patch.g, case: e.patch.case }, garden: { x0: e.garden.x0, z0: e.garden.z0, n: e.garden.n, g: e.garden.g } }; });
    if (want('dig') || ipad) {
      // nothing breaks in Wobbleland: at a plain wall the button says nothing (owner 2026-11-15: it said "Break")
      await put(page, 141.5, 11, 116.6, 0, 0.1); await frames(page, 3);
      const wall = await act();
      t.ok(wall.act === '' && wall.dim, `${tag}looking at the Drip Tower's wall the action button says nothing (was "Break"): "${wall.act}", dim ${wall.dim}`);
      // a mound as Scalewing (no Dig): the button says nothing; a press says why once; after 3 tries the card, Swap goes to Rattlepup
      const m = E.mounds[0], top = [m.x + 0.5, m.g + 1.98, m.z + 0.5];
      await tries(page, [m.x + 0.5, m.g + 1, m.z + 2.8, 0, -0.5], 3);
      await look(...top); await frames(page, 2);
      const a0 = await act();
      await press();
      const why = await toasts(page), n0 = await need(page);
      t.ok(a0.act === '' && /only a digger/i.test(why) && n0.card && n0.text === 'Needs Dig' && n0.lit === 'Rattlepup', `${tag}a mound of soft earth as Scalewing: no word on the button ("${a0.act}"), a press says why ("${why}"), after 3 tries the card "${n0.text}" with ${n0.lit} lit`);
      await shot(page, `ways-${ipad ? 'ipad-' : ''}mound-without.png`);
      await swap();
      await look(...top); await frames(page, 2);
      const a1 = await act(), who = (await be(page)).species;
      t.ok(who === 'rattlepup' && a1.act === 'Dig!' && !a1.dim, `${tag}Swap goes straight to Rattlepup; looking at the mound the button says "${a1.act}" (prompt "${a1.prompt}")`);
      await page.evaluate(([x, y, z]) => window.pokecraft.player.lookAt({ x: x + 0.5, y: y + 0.98, z: z + 0.5 }), m.chest);
      for (let i = 0; i < 4; i++) { const h = await page.evaluate(([x, y, z]) => window.pokecraft.world.get(x, y, z), m.chest); const a = await act(); if (a.act !== 'Dig!') break; await press(); }
      const sees = await page.evaluate(() => window.pokecraft.touch?.cur?.().act.label ?? '');
      await shot(page, `ways-${ipad ? 'ipad-' : ''}mound-dug.png`);
      const cubes0 = await page.evaluate(() => window.pokecraft.cubes);
      await press();
      const opened = await page.evaluate(([x, y, z]) => window.pokecraft.world.get(x, y, z), m.chest), cubes1 = await page.evaluate(() => window.pokecraft.cubes);
      t.ok(sees === 'Open' && cubes1 === cubes0 + 3, `${tag}Rattlepup digs down with the action button (it says "${sees}" at the chest) and opens the buried chest (+${cubes1 - cubes0} Capture Cubes, block ${opened})`);
    }
    if (want('dig') && !ipad) {
      // the Warm-or-Cold Dig with real presses: the head turns to each square (like a child looking), E digs; the glows guide the next
      const P = E.patch;
      await put(page, P.x0 + 3.5, P.g + 1, P.z0 + P.n + 1.6, 0, -0.6); await frames(page, 3);
      await shot(page, 'ways-digpatch.png');
      for (let k = 0; k < 8; k++) {
        const st = await live();
        if (st.patchOpen) break;
        const pick = await page.evaluate(async () => { // the squares the key can still be under: dig the one that splits them best (waysbots.mjs skilledPick)
          const K = await import('/src/earthworks.js'), R = window.pokecraft.world.trials.earth, P = window.pokecraft.world.earth.patch, c = K.keyCandidates(R.holesDug);
          let best = null, bw = 1e9;
          for (let u = 0; u < P.n; u++) for (let v = 0; v < P.n; v++) {
            if (R.holesDug.some(([a, b]) => a === u && b === v)) continue;
            const parts = new Map(); for (const [a, b] of c) { const l = Math.min(4, Math.max(Math.abs(a - u), Math.abs(b - v))); parts.set(l, (parts.get(l) ?? 0) + 1); }
            let w = 0; for (const [l, n] of parts) if (l) w = Math.max(w, n);
            const sc = w * 2 - (c.some(([a, b]) => a === u && b === v) ? 1 : 0); if (sc < bw) { bw = sc; best = [u, v]; }
          }
          return best;
        });
        const [u, v] = pick, x = P.x0 + u, z = P.z0 + v;
        const sides = [[x + 0.5, P.z0 - 1.6, v], [x + 0.5, P.z0 + P.n + 1.6, P.n - 1 - v], [P.x0 - 1.6, z + 0.5, u], [P.x0 + P.n + 1.6, z + 0.5, P.n - 1 - u]].sort((a, b) => a[2] - b[2]);
        await put(page, sides[0][0], P.g + 1, sides[0][1]); await frames(page, 2);
        await look(x + 0.5, P.g + 0.98, z + 0.5); await frames(page, 2);
        await press();
      }
      await frames(page, 6);
      const won = await live();
      await put(page, P.case.x + 0.5, P.g + 1, P.case.z + 3.2, 0, -0.35); await frames(page, 6);
      await shot(page, 'ways-digpatch-found.png');
      t.ok(won.patchOpen && won.holesDug.length <= 4, `the Warm-or-Cold Dig with E presses: holes glow red / orange / yellow / blue (${won.holesDug.join(', ')}), the key found within ${won.holesDug.length + 1} digs, the glass case opens`);
    }
    if (want('push') || ipad) {
      // a boulder cave: as Scalewing walking into the boulder: why once; as Woolumph walking on: it pushes in
      const c = E.caves[0], mx = c.x + 2, mz = c.z + c.d - 1;
      if (!ipad) {
        await page.keyboard.press('Digit1'); await frames(page, 3);
        await put(page, mx, c.g + 1, mz + 2.5, 0, 0); await frames(page, 2);
        await page.keyboard.down('w'); await page.waitForTimeout(3500); await page.keyboard.up('w');
        const heavy = await toasts(page), b0 = (await live()).boulders[0];
        t.ok(/too heavy/i.test(heavy) && b0 === `${mx - 1},${c.g + 1},${mz - 1}`, `Scalewing walks into the cave's boulder: it does not move (${b0}) and says why ("${heavy}")`);
        await shot(page, 'ways-cave-without.png');
        await page.keyboard.press('Digit3'); await frames(page, 3);
      } else { await swap(); }
      await put(page, mx, c.g + 1, mz + 2.5, 0, 0); await frames(page, 3);
      let cdp = null;
      if (ipad) { // the joystick, with real touches
        cdp = await page.context().newCDPSession(page);
        const j = await page.evaluate(() => { const r = document.getElementById('joystick').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: j[0], y: j[1], id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: j[0], y: j[1] - 60, id: 1 }] });
      } else await page.keyboard.down('w');
      const inside = await page.evaluate(([c]) => new Promise(res => { const t0 = performance.now(); const f = () => { const p = window.pokecraft.player; if (p.pos.z < c.z + c.d - 1.3 || performance.now() - t0 > 200000) res({ z: p.pos.z, b: window.pokecraft.gymLive.of('part:wobble').info().earth.boulders[0], sp: window.pokecraft.being.info().species }); else requestAnimationFrame(f); }; f(); }), [c]);
      if (ipad) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.keyboard.up('w');
      await shot(page, `ways-${ipad ? 'ipad-' : ''}cave-with.png`);
      t.ok(inside.sp === 'woolumph' && inside.z < c.z + c.d - 1.3 && inside.b !== `${mx - 1},${c.g + 1},${mz - 1}`, `${tag}as Woolumph (Push) ${ipad ? 'the joystick pushed' : 'W held'} into the boulder pushes it in, block by block, and walks in after it (boulder at ${inside.b})`);
    }
    if (want('push') && !ipad) {
      // the Ball Garden: one push with real keys: the ball rolls on until it bumps the low wall
      const G = E.garden;
      await put(page, G.x0 + 8.5, G.g + 1, G.z0 + 4.5, Math.PI / 2, -0.2); await frames(page, 3); // (east of ball 1, facing west)
      await shot(page, 'ways-garden.png');
      await page.keyboard.down('w');
      await poll(page, "g.gymLive.of('part:wobble').info().earth.balls[0] !== '97,11,44'");
      await page.keyboard.up('w');
      const rolled = await poll(page, "(() => { const e = g.gymLive.of('part:wobble').info().earth; return e.balls[0] === '91,11,44' && e; })()");
      await shot(page, 'ways-garden-rolled.png');
      t.ok(rolled, `the Ball Garden: walking into a stone ball as Woolumph, it rolls on until it bumps the low wall (${rolled?.balls?.[0]})`);
      // the rest of the solution: the pushes are walked by the page like a bot (tests/waysbots.mjs proves them with the real Player); the case opens
      const solved = await page.evaluate(async () => {
        const g = window.pokecraft, R = g.world.trials.earth, steps = [[0, 0, -1], [0, 1, 0], [0, 0, 1], [1, 0, 1]];
        for (const [i, dx, dz] of steps) {
          const b = R.balls[i]; g.player.pos.set(b.at[0] - dx + 0.5, b.at[1], b.at[2] - dz + 0.5); g.player.vel.set(0, 0, 0); g.player.yaw = Math.atan2(-dx, -dz);
          g.player.keys.KeyW = true;
          const at = b.at.join();
          await new Promise(res => { const t0 = performance.now(); const f = () => (b.at.join() !== at && !b.roll && !b.from) || performance.now() - t0 > 60000 ? res() : requestAnimationFrame(f); f(); });
          g.player.keys.KeyW = false;
          await new Promise(r => setTimeout(r, 300));
        }
        return g.gymLive.of('part:wobble').info().earth;
      });
      await put(page, 94.5, E.garden.g + 1, 39.2, 0, -0.3); await frames(page, 6);
      await shot(page, 'ways-garden-open.png');
      t.ok(solved.gardenOpen && solved.holesFull === 2, `both balls in their holes: the glass case opens (${JSON.stringify({ open: solved.gardenOpen, full: solved.holesFull })})`);
    }
    t.ok(!page.errors.length, `${tag}dig / push: no page errors (${page.errors.join('; ')})`);
    await page.context().close();
  }

  if (want('pose')) { // the climbing pose (owner 2026-11-15: make it read clearly as climbing): from behind and from the side, screenshots
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('sproutle', 30), S.makeCreature('scalewing', 30), S.makeCreature('woolumph', 30)]; });
    await intoWobble(page, { creature: true });
    const crag = await page.evaluate(() => ({ ...window.pokecraft.world.spots.find(q => q.id === 'crag1') }));
    const cx = crag.x + crag.w / 2, face = crag.z + crag.d;
    const views = [['behind', 0, 'w', 0.2], ['side', Math.PI / 2, 'd', 0.05], ['three-quarter', Math.PI / 4, 'w', 0.15]];
    for (const [name, yaw, key, pitch] of views) {
      await put(page, cx + 0.5, crag.ground + 1, face + 0.4, yaw, pitch); await frames(page, 3);
      await page.keyboard.down(key);
      const mid = await poll(page, `g.player.climbing && g.player.pos.y > ${crag.ground + 4} && g.being.info()`);
      await page.keyboard.up(key); await frames(page, 2);
      await page.keyboard.down(key); await frames(page, 4); // (mid-scramble: the paws reaching)
      await shot(page, `ways-pose-${name}.png`);
      await page.keyboard.up(key);
      t.ok(mid && mid.climbing && mid.paws && mid.pose > 0.8 && mid.behind, `climbing pose seen from ${name}: facing the wall, leaning in (tilt ${mid?.tilt}), four paws on the wall (${mid?.paws}), the camera behind`);
      await page.evaluate(() => { const p = window.pokecraft.player; p.keys = {}; }); await frames(page, 2);
    }
    t.ok(!page.errors.length, `pose: no page errors (${page.errors.join('; ')})`);
    await page.context().close();
  }

  if (want('ipad')) {
    const page = await openGame(browser, base, { query: '?preview', contextOptions: devices['iPad (gen 7) landscape'] });
    await newGame(page, 0);
    await team(page);
    await intoWobble(page, { creature: true });
    await put(page, 100.5, 11, 137.5);
    await frames(page, 4);
    const label = () => page.evaluate(() => ({ act: document.getElementById('btn-act')?.textContent.trim(), ride: document.getElementById('btn-ride')?.textContent.trim(), place: document.getElementById('btn-place')?.textContent.trim(), jump: document.getElementById('btn-jump')?.textContent.trim() }));
    const a = await be(page), l1 = await label(), rideShown = await page.evaluate(() => !document.getElementById('btn-ride')?.classList.contains('hidden'));
    t.ok(a.species === 'scalewing' && a.flying && !rideShown && l1.place === 'Swap' && l1.jump === 'Up', `iPad: you are Scalewing by itself; no Creature / Me button (Ride hidden: ${!rideShown}), the Place button says ${l1.place}, Jump says ${l1.jump}`);
    await shot(page, 'ways-ipad.png');
    // the Drip Tower on the iPad: the card after tries, one tap on Swap, the joystick pushed into the shaft's wall climbs
    await tries(page, [140.5, 11, 117.5, 0, 0.32], 3);
    const n1 = await need(page);
    t.ok(n1.card && n1.badge && n1.lit === 'Sproutle' && n1.next === 'Sproutle', `iPad: at the Drip Tower as Scalewing, after 3 tries, the card shows the Climb badge and lights Sproutle`);
    await shot(page, 'ways-ipad-need-without.png');
    await page.tap('#btn-place'); await frames(page, 4);
    const n2 = await need(page), l2 = await label();
    t.ok((await be(page)).species === 'sproutle' && !n2.card && l2.act !== 'Climb!', `iPad: one tap on Swap = Sproutle; no button word (${l2.act})`);
    await shot(page, 'ways-ipad-need-with.png');
    await put(page, 140.5, 11, 112.5, 0, 0);
    await frames(page, 3);
    const cdp = await page.context().newCDPSession(page);
    const joy = await page.evaluate(() => { const r = document.getElementById('joystick').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joy[0], y: joy[1], id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: joy[0], y: joy[1] - 60, id: 1 }] });
    const y1 = await page.evaluate(() => new Promise(res => { const t0 = performance.now(); const f = () => { const p = window.pokecraft.player; if (p.pos.y > 12.5 || performance.now() - t0 > 200000) res(p.pos.y); else requestAnimationFrame(f); }; f(); }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await frames(page, 2);
    t.ok(y1 > 12.5, `iPad: the joystick pushed into the shaft's wall climbs it (y ${y1.toFixed(1)})`);
    // a cloud on the iPad as Sproutle: the card after tries lights Scalewing and Boomwing, one tap on Swap, the Jump button held rises
    const cl = await page.evaluate(() => ({ ...window.pokecraft.world.spots.find(q => q.id === 'cloud1') }));
    await tries(page, [cl.x + 0.5, cl.ground + 1, cl.z + 4.5, 0, 0.3], 3);
    if ((await be(page)).species !== 'sproutle') { await page.evaluate(() => window.pokecraft.being.become(1, false)); await frames(page, 3); } // (Sproutle, as on the tower)
    const n3 = await need(page);
    t.ok(n3.needs === 'fly' && n3.card && n3.lit === 'Scalewing,Boomwing' && n3.next === 'Boomwing', `iPad: at a cloud as Sproutle the card lights Scalewing and Boomwing, Swap goes to Boomwing next (${JSON.stringify(n3)})`);
    await shot(page, 'ways-ipad-cloud-without.png');
    await page.tap('#btn-place'); await frames(page, 4);
    const l3 = await label();
    t.ok((await be(page)).species === 'boomwing' && l3.jump === 'Up', `iPad: one tap on Swap = Boomwing; the Jump button says ${l3.jump}`);
    const box2 = await page.evaluate(() => { const r = document.getElementById('btn-jump').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const y0 = await page.evaluate(() => window.pokecraft.player.pos.y);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box2[0], y: box2[1], id: 2 }] });
    const y2 = await page.evaluate(y0 => new Promise(res => { const t0 = performance.now(); const f = () => { const p = window.pokecraft.player; if (p.pos.y > y0 + 3 || performance.now() - t0 > 120000) res(p.pos.y); else requestAnimationFrame(f); }; f(); }), y0);
    await shot(page, 'ways-ipad-cloud-with.png');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await frames(page, 2);
    t.ok(y2 > y0 + 3, `iPad: holding the Jump button rises (${y0.toFixed(1)} -> ${y2.toFixed(1)}), no other button`);
    await page.tap('#btn-pause'); await page.waitForTimeout(500);
    await page.tap('#beme-btn'); await frames(page, 3);
    t.ok(!(await be(page)).on, 'iPad: the pause screen\'s "Be me" = me mode');
    t.ok(!page.errors.length, `iPad: no page errors (${page.errors.join('; ')})`);
    await page.context().close();
  }

  if (want('closed')) {
    for (const q of ['', '?preview']) {
      const page = await openGame(browser, base, { query: q });
      await newGame(page, 0);
      await team(page);
      await frames(page, 3);
      await page.evaluate(() => document.querySelector('#title') && null);
      await page.keyboard.press('Digit3'); await frames(page, 2);
      await page.keyboard.press('KeyF'); await frames(page, 2);
      const r = await page.evaluate(() => ({ can: window.pokecraft.being.can(), on: window.pokecraft.being.on, place: document.getElementById('btn-place')?.textContent.trim(), sel: window.pokecraft.selected }));
      t.ok(!r.can && !r.on && r.place === 'Place' && r.sel === 2, `${q || 'without ?preview'}, in the main world: no creature mode (R and F do nothing new), 3 picks the third block (${JSON.stringify(r)})`);
      await page.context().close();
    }
  }
}
