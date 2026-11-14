// Chapter 3: being your creature and the first ABILITY place (plans/chapter3-ways.md, plans/chapter3-abilities-build.md step C; ?preview only,
// Wobbleland only):
//   data:   bodyOf from abilities.js (fly / swim / climb by type, the guardian's from its design), the place hook (abilityplaces.js: placeAt,
//           needOf, swapTo, every ability has a verb), the Drip Tower is a place entry, Glowcap Caves' glowing types = Glow
//   bots:   tests/waysbots.mjs with the real Player on the real terrain at 60 / 20 fps: the Drip Tower (Climb): just climbing (W or Climb! held)
//           never, waiting in the nooks always (Sproutle, a Bug that also flies); a flier, Boomwing, a walker, you on foot, mixes by
//           swapping mid-way, gliding in from the hilltop and the ice outside never
//   real:   real keys in a browser: you are your creature by itself, no bar, the pause screen's Be me (R), F = Swap, 1 2 3, V; the camera
//           stays behind while walking W / A / D / S; at the tower as Boomwing the card shows the Climb badge and lights Sproutle, F goes
//           straight to Sproutle, the button says Climb!, holding E climbs; Be me shows the card too; ways-*.png
//   fight:  walking into a scribble patch AS your creature: it leads (no Capture Cube), you are it again afterwards, where it stood
//   ipad:   an emulated iPad: Place = Swap, Jump = Up while you fly; at the tower the card, Swap = one tap to Sproutle, a held Climb! button climbs
//   closed: without ?preview and in the main world there is no creature mode and 1 2 3 still pick blocks
//   places: step D with real keys: the Floating Isles (Sproutle: the card lights Scalewing; F; flying straight on = the ink mist's puff;
//           holding Fly! at the edge, then W = the first island) and the Sluice Gate (Scalewing: Tidalord lit; F; on the plate the gate opens;
//           W + Shift, looking where to go: dives, rides the jets, through before it shuts); ways-isles-*.png, ways-sluice-*.png
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
    act: g.touch?.cur?.().act.label ?? document.getElementById('btn-act')?.textContent.trim(), prompt: document.getElementById('prompt')?.textContent ?? '' };
});
const toasts = page => page.evaluate(() => [...(window.pokecraft.ui.toastBox?.children || [])].map(e => e.textContent).join(' | '));

export default async function ({ browser, base, t }) {
  if (want('data')) {
    await import('../wobblenode.mjs'); // (registers 'three' for Node)
    const C = await import('../../src/creatureways.js'), S = await import('../../src/species.js'), A = await import('../../src/abilities.js'), P = await import('../../src/abilityplaces.js');
    const W = await import('../../src/wayland.js'), G = await import('../../src/groundrules.js');
    const b = id => C.bodyOf(id, S.SPECIES[id]);
    const bw = b('boomwing'), sw = b('scalewing'), sp = b('sproutle'), td = b('tidalord'), bt = b('beetlet'), vw = b('voltwing');
    t.ok(bw.fly && sw.fly && !sw.climb && sp.climb && !sp.fly && td.swim && !td.fly && bt.fly && bt.climb && !vw.fly, `bodies come from abilities: Boomwing and Scalewing fly, Sproutle climbs, Tidalord swims, Beetlet flies and climbs, Voltwing (small wings, Electric) walks`);
    const noVerb = A.ABILITY_IDS.filter(id => !A.ABILITIES[id].verb);
    t.ok(!noVerb.length, `every ability has a button word (${A.ABILITY_IDS.map(id => A.ABILITIES[id].verb).join(' ')}) ${noVerb}`);
    const place = W.NEED_PLACES.find(q => q.id === 'driptower'), at = P.placeAt(W.NEED_PLACES, { x: W.SHAFT.x + 0.5, y: W.SHAFT.floor, z: W.SHAFT.z + 3 }), off = P.placeAt(W.NEED_PLACES, { x: 60, y: 11, z: 60 });
    const n1 = P.needOf(at, sw.abilities, [sw.abilities, sp.abilities, bw.abilities]), n2 = P.needOf(at, sp.abilities, []), n3 = P.needOf(at, [], [sw.abilities, bw.abilities]);
    t.ok(place.needs === 'climb' && at === place && !off && !n1.has && n1.who.join() === '1' && P.swapTo(n1, 2, 3) === 1 && P.swapTo(n1, null, 3) === 1 && n2.has && n2.word === 'Climb!' && !n3.who.length && P.swapTo(n3, 0, 2) === null,
      `the Drip Tower is one place entry (needs ${place.needs}); Scalewing: not it, Sproutle lit, Swap from Boomwing or from you goes straight to Sproutle; Sproutle: "${n2.word}"; nobody: no shortcut`);
    const ids = W.NEED_PLACES.map(q => `${q.id}:${q.needs}`).join();
    t.ok(ids === 'isles:fly,sluice:swim,driptower:climb' && P.placeAt(W.NEED_PLACES, { x: 100.5, y: 11, z: 132 })?.needs === 'fly' && P.placeAt(W.NEED_PLACES, { x: 128.5, y: 11, z: 93.5 })?.needs === 'swim', `three places, each one data entry: ${ids}`);
    t.ok(b('bubbuck').swim && !b('scalewing').swim && b(Object.keys(S.SPECIES).find(k => S.SPECIES[k].type === 'bubble')).fly, 'Swim: Water and Bubble creatures; Bubble also flies (it settles onto water and dives)');
    t.ok(G.BRIGHT.slice().sort().join() === 'atlantis,cosmic,electric,fire,light,rainbow' && G.KEEN.join() === 'ghost,ninja', `Glowcap Caves: the glowing types are the Glow ability's (${G.BRIGHT}); Ghost / Ninja still sense (${G.KEEN})`);
  }

  if (want('bots')) {
    const { runTower, runIsles, runSluice } = await import('../waysbots.mjs');
    const ii = await runIsles(), ss = await runSluice();
    const g = (o, k) => `${o[k + '@60'].wins}/${o[k + '@60'].of} · ${o[k + '@20'].wins}/${o[k + '@20'].of}`;
    t.ok(!ii.problems.length, `the Floating Isles (Fly), 60 · 20 fps: straight on ${g(ii.out, 'isles.naive')}, hovering with no timing ${g(ii.out, 'isles.hover')}, skilled ${g(ii.out, 'isles.skilled')} (${ii.out['isles.skilled@60'].median} s), Boomwing ${g(ii.out, 'isles.boomwing')}, a Bug ${g(ii.out, 'isles.bug')}; without Fly: walker ${g(ii.out, 'isles.walker')}, climber ${g(ii.out, 'isles.climber')}, on foot ${g(ii.out, 'isles.onFoot')}, a Bug climbing a cloud ${g(ii.out, 'isles.bugClings')}, flier -> climber ${g(ii.out, 'isles.mixWalker')} ${ii.problems.join('; ')}`);
    t.ok(!ss.problems.length, `the Sluice Gate (Swim), 60 · 20 fps: straight through the kelp ${g(ss.out, 'sluice.naive')}, skilled ${g(ss.out, 'sluice.skilled')} (${ss.out['sluice.skilled@60'].times} s, shut at 5.6), Bubble ${g(ss.out, 'sluice.bubble')}; without Swim: walker ${g(ss.out, 'sluice.walker')}, on foot ${g(ss.out, 'sluice.onFoot')}, flier ${g(ss.out, 'sluice.flier')}, climber ${g(ss.out, 'sluice.climber')}, flier -> walker ${g(ss.out, 'sluice.mixFlierWalker')} ${ss.problems.join('; ')}`);
    const a = await runTower();
    const f = k => `${a.out[k + '@60'].wins}/${a.out[k + '@60'].of} · ${a.out[k + '@20'].wins}/${a.out[k + '@20'].of}`;
    t.ok(!a.problems.length, `the Drip Tower (Climb), the real Player at 60 · 20 fps: just climbing ${f('naiveClimb')}, holding Climb! ${f('naiveGrab')}, skilled ${f('skilledClimb')} (${a.out['skilledClimb@60'].median} s), skilled with Climb! ${f('skilledGrab')}, a Bug (${a.out.bug}) ${f('bugSkilled')}; without Climb: flier ${f('flier')} (top ${a.out['flier@60'].top} < roof ${a.out.roof}), Boomwing ${f('boomwing')}, walker ${f('walker')}, on foot ${f('onFoot')}, flier -> walker ${f('mixFlierWalker')}, walker -> flier ${f('mixWalkerFlier')}, glide from the hill ${f('hillGlider')} (top ${a.out['hillGlider@60'].top}), the ice outside ${f('iceWall')} · ${f('iceGrab')} ${a.problems.join('; ')}`);
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
      // the Drip Tower asks for Climb (step C): as Boomwing the card shows the badge and lights Sproutle; F goes straight to it
      await put(page, 140.5, 11, 117.5, 0, 0.32);
      await frames(page, 4);
      const n1 = await need(page);
      t.ok(n1.needAt === 'driptower' && n1.needs === 'climb' && !n1.needHas && n1.card && n1.lit === 'Sproutle' && n1.next === 'Sproutle' && n1.badge && n1.act !== 'Climb!', `at the Drip Tower as Boomwing: a card with the drawn Climb badge, "${n1.text}", Sproutle lit and marked for Swap (${JSON.stringify(n1)})`);
      await shot(page, 'ways-need-without.png');
      await put(page, 140.5, 16, 138.5, 0, 0.12); await frames(page, 6); // (from afar: the badge floats over the tower)
      await shot(page, 'ways-need-far.png');
      await put(page, 140.5, 11, 117.5, 0, 0.32); await frames(page, 3);
      await page.keyboard.press('KeyF'); await frames(page, 4);
      const n2 = await need(page), sp = await be(page);
      t.ok(sp.species === 'sproutle' && sp.climb && n2.needHas && !n2.card && n2.act === 'Climb!' && /climb/i.test(n2.prompt), `F from Boomwing goes straight to Sproutle (not round to Scalewing); the card goes, the button says "${n2.act}" (${n2.prompt})`);
      t.ok(sp.move === 'land' && sp.speed === 7, `Sproutle walks at the land ride's speed (${sp.speed})`);
      await shot(page, 'ways-need-with.png');
      // walk in, then hold E (Climb!) and it climbs the shaft
      await page.keyboard.down('w');
      await waitFor(page, () => window.pokecraft.player.pos.z < 112.65, null, 120000).catch(() => {});
      await page.keyboard.up('w');
      await page.keyboard.down('e');
      const climb = await page.evaluate(() => new Promise(res => { const t0 = performance.now(); const f = () => { const g = window.pokecraft, p = g.player; if (p.pos.y > 12.5 || performance.now() - t0 > 200000) res({ y: p.pos.y, grab: !!p.be?.grab, ...g.being.info() }); else requestAnimationFrame(f); }; f(); }));
      await shot(page, 'ways-shaft.png');
      await page.keyboard.up('e'); await frames(page, 2);
      const let1 = await page.evaluate(() => !!window.pokecraft.player.be?.grab);
      t.ok(climb.y > 12.5 && climb.grab && !let1 && climb.tight && !climb.behind, `holding E (Climb!) climbs the shaft (y ${climb.y.toFixed(1)}), letting go lets go; in the shaft the camera is in its eyes (${JSON.stringify({ grab: climb.grab, let1, tight: climb.tight, behind: climb.behind, climbing: climb.climbing })})`);
      // Be me: you have no Climb, the card shows too
      await put(page, 140.5, 11, 117.5, 0, 0.32);
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

  if (want('places')) { // step D: the Floating Isles (Fly) and the Sluice Gate (Swim) with real keys through the game's loop
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('sproutle', 30), S.makeCreature('scalewing', 30), S.makeCreature('tidalord', 30)]; });
    await intoWobble(page, { creature: true });
    const live = () => page.evaluate(() => window.pokecraft.gymLive.of('part:wobble').info());
    const poll = fn => page.evaluate(src => new Promise(res => { const f = new Function('g', 'return ' + src), t0 = performance.now(); const go = () => { const g = window.pokecraft; let v = null; try { v = f(g); } catch { v = null; } if (v || performance.now() - t0 > 200000) res(v); else requestAnimationFrame(go); }; go(); }), fn);
    // the Floating Isles, as Sproutle: the card asks for Fly and lights Scalewing
    await put(page, 100.5, 11, 133.5, 0, 0.25); await frames(page, 6);
    const n1 = await need(page);
    t.ok(n1.needAt === 'isles' && n1.needs === 'fly' && n1.card && n1.lit === 'Scalewing' && n1.next === 'Scalewing', `the Floating Isles as Sproutle: "${n1.text}", Scalewing lit (${JSON.stringify(n1)})`);
    await shot(page, 'ways-isles-without.png');
    await page.keyboard.press('KeyF'); await frames(page, 4);
    const n2 = await need(page);
    t.ok((await be(page)).species === 'scalewing' && n2.needHas && n2.act === 'Fly!', `F: Scalewing, the button says ${n2.act}`);
    // flying straight on from the shore sinks into the ink mist: a puff back to the shore
    await put(page, 100.5, 11, 131.5, 0, 0.1); await frames(page, 2);
    await page.keyboard.down('Space'); await page.keyboard.down('w');
    const puffed = await poll("g.player.pos.z < 128.9 ? (window.__low = 1) && false : (window.__low && g.player.pos.z > 130.5)");
    await page.keyboard.up('w'); await page.keyboard.up('Space');
    const toast1 = await toasts(page);
    t.ok(puffed && /ink mist/.test(toast1), `flying straight on from the shore sinks into the ink mist and puffs you back (${toast1})`);
    // hold Fly! (E) at the shore's edge until you are at your highest, then W: you reach the first island
    await put(page, 100.5, 11, 129.6, 0, 0.1); await frames(page, 2);
    await page.keyboard.down('e');
    const high = await poll('g.player.pos.y > 16.9 && g.player.pos.y');
    await page.keyboard.down('w');
    const land = await poll("g.gymLive.of('part:wobble').info().isleBest >= 0");
    await page.keyboard.up('w'); await page.keyboard.up('e');
    t.ok(high && land, `holding Fly! (E) at the shore's edge rises to ${high?.toFixed?.(1)} (the cap), then W: the first island (${JSON.stringify(await live())})`);
    await page.evaluate(() => { window.pokecraft.player.pitch = 0.05; window.pokecraft.player.yaw = 0; }); await frames(page, 4);
    await shot(page, 'ways-isles-fly.png');
    // the Sluice Gate, as Scalewing: Needs Swim, Tidalord lit; F goes to Tidalord
    const S = { x: 128.5, z: 93.5 };
    await put(page, S.x, 11, S.z + 2.5, 0, -0.2); await frames(page, 6);
    const n3 = await need(page);
    t.ok(n3.needAt === 'sluice' && n3.needs === 'swim' && n3.card && n3.lit === 'Tidalord', `the Sluice Gate as Scalewing: "${n3.text}", Tidalord lit (${JSON.stringify(n3)})`);
    await shot(page, 'ways-sluice-without.png');
    await page.keyboard.press('KeyF'); await frames(page, 4);
    await put(page, S.x, 11, S.z, 0, -0.2); await frames(page, 6);
    const n4 = await need(page), g1 = await live();
    t.ok((await be(page)).species === 'tidalord' && n4.act === 'Swim!' && g1.gateShut === 0, `F: Tidalord; on the gold plate the gate is open (${g1.gateShut} rows shut), the button says ${n4.act}`);
    await shot(page, 'ways-sluice-with.png');
    // a run with real keys (W + Shift held, kicks with E): the page only turns the head toward each spot, like a child steering
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
    const kick = setInterval(() => page.keyboard.press('e').catch(() => {}), 400);
    const thru = await poll("(() => { const i = g.gymLive.of('part:wobble').info(); if (g.player.diving) window.__dived = true; if (window.__dived && !window.__shot && g.player.pos.x > 136) { window.__shot = 1; return 'shot'; } return i.through ? i : null; })()");
    if (thru === 'shot') await shot(page, 'ways-sluice-dive.png');
    const done = thru === 'shot' ? await poll("(() => { const i = g.gymLive.of('part:wobble').info(); return i.through ? i : null; })()") : thru;
    clearInterval(kick);
    await page.keyboard.up('w'); await page.keyboard.up('Shift');
    const dived = await page.evaluate(() => !!window.__dived);
    t.ok(done?.through && dived, `Tidalord dives (looking down), rides the bubble jets and gets through the gate before it shuts (${JSON.stringify(done)})`);
    await shot(page, 'ways-sluice-grotto.png');
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
    // the Drip Tower on the iPad: the card, one tap on Swap, the Climb! button held climbs
    await put(page, 140.5, 11, 117.5, 0, 0.32);
    await frames(page, 4);
    const n1 = await need(page);
    t.ok(n1.card && n1.badge && n1.lit === 'Sproutle' && n1.next === 'Sproutle', `iPad: at the Drip Tower as Scalewing the card shows the Climb badge and lights Sproutle (${JSON.stringify(n1)})`);
    await shot(page, 'ways-ipad-need-without.png');
    await page.tap('#btn-place'); await frames(page, 4);
    const n2 = await need(page), l2 = await label();
    t.ok((await be(page)).species === 'sproutle' && !n2.card && l2.act === 'Climb!', `iPad: one tap on Swap = Sproutle, the action button says ${l2.act}`);
    await shot(page, 'ways-ipad-need-with.png');
    await put(page, 140.5, 11, 112.5, 0, 0);
    await frames(page, 3);
    const box = await page.evaluate(() => { const r = document.getElementById('btn-act').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box[0], y: box[1], id: 1 }] });
    const y1 = await page.evaluate(() => new Promise(res => { const t0 = performance.now(); const f = () => { const p = window.pokecraft.player; if (p.pos.y > 12.5 || performance.now() - t0 > 200000) res({ y: p.pos.y, grab: !!p.be?.grab }); else requestAnimationFrame(f); }; f(); }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await frames(page, 2);
    const grab2 = await page.evaluate(() => !!window.pokecraft.player.be?.grab);
    t.ok(y1.y > 12.5 && y1.grab && !grab2, `iPad: holding the Climb! button climbs the shaft (y ${y1.y.toFixed(1)}); lifting the finger lets go`);
    // the Floating Isles on the iPad as Sproutle: the card lights Scalewing and Boomwing, one tap on Swap, a held Fly! button rises
    await put(page, 100.5, 11, 133.5, 0, 0.25); await frames(page, 6);
    const n3 = await need(page);
    t.ok(n3.needs === 'fly' && n3.card && n3.lit === 'Scalewing,Boomwing' && n3.next === 'Boomwing', `iPad: at the Floating Isles as Sproutle the card lights Scalewing and Boomwing, Swap goes to Boomwing next (${JSON.stringify(n3)})`);
    await shot(page, 'ways-ipad-isles-without.png');
    await page.tap('#btn-place'); await frames(page, 4);
    const l3 = await label();
    t.ok((await be(page)).species === 'boomwing' && l3.act === 'Fly!', `iPad: one tap on Swap = Boomwing, the action button says ${l3.act}`);
    const box2 = await page.evaluate(() => { const r = document.getElementById('btn-act').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const y0 = await page.evaluate(() => window.pokecraft.player.pos.y);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box2[0], y: box2[1], id: 2 }] });
    const y2 = await page.evaluate(y0 => new Promise(res => { const t0 = performance.now(); const f = () => { const p = window.pokecraft.player; if (p.pos.y > y0 + 3 || performance.now() - t0 > 120000) res(p.pos.y); else requestAnimationFrame(f); }; f(); }), y0);
    await shot(page, 'ways-ipad-isles-with.png');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await frames(page, 2);
    t.ok(y2 > y0 + 3 && !(await page.evaluate(() => window.pokecraft.player.be?.rise)), `iPad: holding the Fly! button rises (${y0.toFixed(1)} -> ${y2.toFixed(1)}); lifting the finger stops`);
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
