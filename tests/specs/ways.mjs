// Chapter 3: being your creature and the first two WAY places (plans/chapter3-ways.md, ?preview only, Wobbleland only):
//   data:   the 15 ways cover every type once (Custom: none yet), bodyOf (wings from `flies`, a sky ride or the Fly way)
//   bots:   tests/waysbots.mjs with the real Player on the real terrain at 60 / 20 fps: Storm Island (flying straight in never works,
//           the skilled flier always; Boomwing, a walker, a Cling creature and a rider never) and the Drip Tower (just climbing never
//           works, waiting in the nooks always; a flier, Boomwing, a walker and the ice outside never)
//   real:   real keys in a browser: the squad bar, 1 2 3 / X / V, Boomwing blown back by the storm ("Too windy"), a Drake flies into it,
//           a Cling creature walks into the tower and climbs (its camera goes into its eyes in the shaft), screenshots ways-*.png
//   fight:  walking into a scribble patch AS your creature: it leads (no Capture Cube), you are it again afterwards, where it stood
//   ipad:   an emulated iPad: the bar is tapped, the Jump button says Up while you are a flier
//   closed: without ?preview and in the main world there is no bar and 1 2 3 still pick blocks
//   WAYS_ONLY=data|bots|real|fight|ipad|closed
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
const toasts = page => page.evaluate(() => [...(window.pokecraft.ui.toastBox?.children || [])].map(e => e.textContent).join(' | '));

export default async function ({ browser, base, t }) {
  if (want('data')) {
    const C = await import('../../src/creatureways.js');
    const types = ['normal', 'fire', 'water', 'grass', 'electric', 'rock', 'ice', 'bug', 'ghost', 'mind', 'metal', 'toxic', 'pixie', 'drake', 'rainbow', 'cosmic', 'sound', 'bone', 'alien',
      'sky', 'slime', 'light', 'paper', 'time', 'camo', 'cyber', 'cozy', 'treasure', 'food', 'squad', 'dream', 'parkour', 'ninja', 'tiny', 'pirate', 'racer', 'ball', 'portal', 'funfair',
      'surprise', 'doodle', 'atlantis', 'knight', 'bubble', 'gravity', 'mirror'];
    const all = C.WAYS.flatMap(w => w.types), twice = all.filter((x, i) => all.indexOf(x) !== i), missing = types.filter(x => !all.includes(x));
    t.ok(C.WAYS.length <= 15 && !twice.length && !missing.length && all.length === types.length, `the ${C.WAYS.length} ways hold every one of the ${types.length} types once (Custom has none yet) (twice: ${twice}, missing: ${missing})`);
    const b = C.bodyOf('boomwing', { type: 'sound', flies: true }), d = C.bodyOf('scalewing', { type: 'drake' }), k = C.bodyOf('kiteling', { type: 'sky' }), s = C.bodyOf('sproutle', { type: 'grass' });
    t.ok(b.wings && !b.storm && d.wings && d.storm && k.wings && s.cling && !s.wings, `bodies: Boomwing has wings but no storm, every Fly creature flies, Sproutle clings (${JSON.stringify({ b, d, s })})`);
  }

  if (want('bots')) {
    const { runStorm, runShaft } = await import('../waysbots.mjs');
    const a = await runStorm(), b = await runShaft();
    const f = (o, k) => `${o[k + '@60'].wins}/${o[k + '@60'].of} · ${o[k + '@20'].wins}/${o[k + '@20'].of}`;
    t.ok(!a.problems.length, `Storm Island, the real Player at 60 · 20 fps: straight in ${f(a.out, 'naiveFly')}, skilled ${f(a.out, 'skilledFly')} (${a.out['skilledFly@60'].median} s), Boomwing ${f(a.out, 'boomwing')} / ${f(a.out, 'boomwingSkilled')}, walker ${f(a.out, 'walker')}, Cling ${f(a.out, 'cling')}, Drake rider ${f(a.out, 'rider')} ${a.problems.join('; ')}`);
    t.ok(!b.problems.length, `the Drip Tower: just climbing ${f(b.out, 'naiveClimb')}, skilled ${f(b.out, 'skilledClimb')} (${b.out['skilledClimb@60'].median} s), flier ${f(b.out, 'flier')}, Boomwing ${f(b.out, 'boomwing')}, walker ${f(b.out, 'walker')}, the ice outside ${f(b.out, 'iceWall')} ${b.problems.join('; ')}`);
  }

  if (want('real') || want('fight')) {
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    await team(page);
    await intoWobble(page);
    await put(page, 100.5, 11, 137.5);
    await frames(page, 3);
    if (want('real')) {
      const bar = await page.evaluate(() => [...document.querySelectorAll('#squad button')].map(b => b.textContent.trim()));
      t.ok(bar.length === 4 && /Me/.test(bar[0]) && /Scalewing/.test(bar[1]) && /Boomwing/.test(bar[3]), `the squad bar: you and your three (${bar.join(' / ')})`);
      await page.keyboard.press('Digit3'); await frames(page, 4);
      const b3 = await be(page);
      t.ok(b3.on && b3.species === 'boomwing' && b3.wings && b3.flying && b3.behind && b3.model, `3: you are Boomwing, it flies, the camera is behind it (${JSON.stringify(b3)})`);
      await shot(page, 'ways-boomwing.png');
      await page.keyboard.down('Space'); await page.keyboard.down('w');
      await waitFor(page, () => /Too windy for Boomwing/.test([...(window.pokecraft.ui.toastBox?.children || [])].map(e => e.textContent).join()), null, 180000).catch(() => {});
      const windy = await toasts(page), z1 = await page.evaluate(() => window.pokecraft.player.pos.z);
      await page.keyboard.up('w'); await page.keyboard.up('Space');
      t.ok(/Too windy for Boomwing/.test(windy) && z1 > 107 + 23, `Boomwing has wings but is blown back at the storm's edge (z ${z1.toFixed(1)}): "${windy}"`);
      await page.waitForTimeout(800); // (it floats down to the ground before a swap)
      await waitFor(page, () => { const p = window.pokecraft.player; return p.onGround; }, null, 120000).catch(() => {});
      await page.keyboard.press('Digit1'); await frames(page, 4);
      const b1 = await be(page);
      t.ok(b1.species === 'scalewing' && b1.way === 'fly', `1: you are Scalewing, a Fly creature (${b1.species}, ${b1.way})`);
      await page.keyboard.down('Space'); await page.keyboard.down('w');
      await waitFor(page, () => Math.hypot(window.pokecraft.player.pos.x - 100, window.pokecraft.player.pos.z - 107) < 21, null, 240000).catch(() => {});
      const inStorm = await page.evaluate(() => ({ d: Math.hypot(window.pokecraft.player.pos.x - 100, window.pokecraft.player.pos.z - 107), y: window.pokecraft.player.pos.y }));
      await shot(page, 'ways-storm.png');
      await page.keyboard.up('w'); await page.keyboard.up('Space');
      t.ok(inStorm.d < 21, `a Drake flies on into the storm (${inStorm.d.toFixed(1)} from the island's middle, y ${inStorm.y.toFixed(1)})`);
      // V switches the camera; X makes you you again
      await page.keyboard.press('KeyV'); await frames(page, 3);
      const eyes = await be(page);
      await page.keyboard.press('KeyV'); await frames(page, 2);
      t.ok(eyes.view === 'eyes' && !eyes.model, `V: the camera goes into its eyes (${eyes.view}), V again behind`);
      // the Drip Tower with Sproutle: walk in (real W), its camera goes into its eyes in the shaft, it climbs
      await put(page, 140.5, 11, 116.5, 0, 0.6);
      await frames(page, 3);
      await page.keyboard.press('Digit2'); await frames(page, 3);
      await shot(page, 'ways-tower.png');
      await page.keyboard.down('w');
      await waitFor(page, () => window.pokecraft.player.pos.y > 12.5, null, 240000).catch(() => {});
      const climb = await page.evaluate(() => ({ y: window.pokecraft.player.pos.y, z: window.pokecraft.player.pos.z, ...window.pokecraft.being.info() }));
      await shot(page, 'ways-shaft.png');
      await page.keyboard.up('w');
      t.ok(climb.species === 'sproutle' && climb.y > 12.5 && climb.tight && !climb.behind, `2: Sproutle walks into the tower and climbs the shaft (y ${climb.y.toFixed(1)}); in the shaft the camera is in its eyes (tight ${climb.tight})`);
      // X: you again (it drops you down first: wait for the ground)
      await waitFor(page, () => window.pokecraft.player.onGround, null, 120000).catch(() => {});
      await page.keyboard.press('KeyX'); await frames(page, 2);
      const me = await be(page);
      t.ok(!me.on && !(await page.evaluate(() => window.pokecraft.player.be)), `X: you are you again (${JSON.stringify({ on: me.on })})`);
    }
    if (want('fight')) {
      await put(page, 112.5, 11, 194.5);
      await frames(page, 3);
      await page.keyboard.press('Digit2'); await frames(page, 3);
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

  if (want('ipad')) {
    const page = await openGame(browser, base, { query: '?preview', contextOptions: devices['iPad (gen 7) landscape'] });
    await newGame(page, 0);
    await team(page);
    await intoWobble(page);
    await put(page, 100.5, 11, 137.5);
    await frames(page, 3);
    await page.tap('#squad button[data-i="0"]');
    await frames(page, 4);
    const a = await be(page), up = await page.evaluate(() => document.getElementById('btn-jump')?.textContent || '');
    t.ok(a.species === 'scalewing' && a.flying, `iPad: a tap on Scalewing in the bar makes you it (${a.species}); the Jump button: "${up.trim()}"`);
    await shot(page, 'ways-ipad.png');
    await page.tap('#squad button[data-i="me"]');
    await frames(page, 3);
    t.ok(!(await be(page)).on, 'iPad: a tap on Me makes you you again');
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
      const r = await page.evaluate(() => ({ can: window.pokecraft.being.can(), on: window.pokecraft.being.on, bar: !!document.querySelector('#squad:not(.hidden)'), sel: window.pokecraft.selected }));
      t.ok(!r.can && !r.on && !r.bar && r.sel === 2, `${q || 'without ?preview'}, in the main world: no being your creature, no bar, 3 picks the third block (${JSON.stringify(r)})`);
      await page.context().close();
    }
  }
}
