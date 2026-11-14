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
//   WAYS_ONLY=data|bots|real|places|fight|ipad|closed
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
    const tops = E.w.spots.map(q => `${q.id} ${q.top - (q.ground + 1)}`).join(', ');
    t.ok(ids === 'sluice:swim,driptower:climb,crag1:climb,crag2:climb,crag3:climb,cloud1:fly,cloud2:fly,cloud3:fly,cloud4:fly' && E.w.spots.every(q => q.kind === 'crag' ? q.top - (q.ground + 1) > 6 : q.top - (q.ground + 1) <= 6 && q.top - (q.ground + 1) > 2.3),
      `places: ${ids}; crags taller than the fly cap, clouds within it and over a jump (${tops})`);
    t.ok(G.BRIGHT.slice().sort().join() === 'atlantis,cosmic,electric,fire,light,rainbow' && G.KEEN.join() === 'ghost,ninja', `Glowcap Caves: the glowing types are the Glow ability's (${G.BRIGHT}); Ghost / Ninja still sense (${G.KEEN})`);
  }

  if (want('bots')) {
    const { runTower, runSluice, runSpots } = await import('../waysbots.mjs');
    const a = await runTower(), ss = await runSluice(), sp = await runSpots();
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
    const onTop = await poll(`g.player.onGround && g.player.pos.y >= ${crag.top - 0.05} && g.player.pos.y`);
    await page.keyboard.up('w'); await frames(page, 3);
    t.ok(!c0.card && onTop, `a crag (nothing marks it: no card ${!c0.card}): Sproutle walks into its wall and climbs on top (y ${onTop})`);
    await page.evaluate(() => { window.pokecraft.player.pitch = -0.5; }); await frames(page, 3);
    await shot(page, 'ways-crag-top.png');
    // Scalewing (no Climb) flies at it holding Jump: it stops at the fly cap
    await put(page, cx, crag.ground + 1, cz + crag.d / 2 + 4, 0, 0.35); await page.keyboard.press('Digit2'); await frames(page, 3);
    await page.keyboard.down('Space'); await page.keyboard.down('w');
    await page.waitForTimeout(4000);
    const flyTop = await page.evaluate(() => window.pokecraft.player.pos.y);
    await page.keyboard.up('w'); await page.keyboard.up('Space');
    t.ok(flyTop < crag.top - 0.5, `Scalewing flies at the crag holding Jump: it stops at the cap (${flyTop.toFixed(1)} < ${crag.top})`);
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
