// Chapter 3: being your creature and the first two WAY places (plans/chapter3-ways.md, ?preview only, Wobbleland only):
//   data:   the 15 ways cover every type once (Custom: none yet), bodyOf (wings from `flies`, a sky ride or the Fly way)
//   bots:   tests/waysbots.mjs with the real Player on the real terrain at 60 / 20 fps: Storm Island (flying straight in never works,
//           the skilled flier always; a walker and a Cling creature never; Boomwing with skill too: wings are wings) and the Drip Tower (just climbing never
//           works, waiting in the nooks always; a flier, Boomwing, a walker and the ice outside never)
//   real:   real keys in a browser (owner 2026-11-12): you are your creature by itself, no bar, the pause screen's Be me (R), F = Swap, 1 2 3, V; the camera stays behind
//           while walking W / A / D / S (it flashed); Boomwing flies into the storm like every creature with wings; a land body runs at the
//           land ride's speed; a Cling creature walks into the tower and climbs (its camera goes into its eyes in the shaft); ways-*.png
//   fight:  walking into a scribble patch AS your creature: it leads (no Capture Cube), you are it again afterwards, where it stood
//   ipad:   an emulated iPad: no Creature / Me button (Be me is in the pause screen), the Place button Swap, the Jump button Up while you fly
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
    const b = C.bodyOf('boomwing', { type: 'sound', flies: true }, 'sky'), d = C.bodyOf('scalewing', { type: 'drake' }), k = C.bodyOf('kiteling', { type: 'sky' }), s = C.bodyOf('sproutle', { type: 'grass' }), w = C.bodyOf('tidalord', { type: 'water' }, 'water');
    t.ok(b.wings && d.wings && k.wings && s.cling && !s.wings && s.move === 'land' && w.move === 'water', `bodies: every creature with wings flies (Boomwing too), Sproutle clings and walks, Tidalord swims like its ride (${JSON.stringify({ b, s, w })})`);
  }

  if (want('bots')) {
    const { runStorm, runShaft } = await import('../waysbots.mjs');
    const a = await runStorm(), b = await runShaft();
    const f = (o, k) => `${o[k + '@60'].wins}/${o[k + '@60'].of} · ${o[k + '@20'].wins}/${o[k + '@20'].of}`;
    t.ok(!a.problems.length, `Storm Island, the real Player at 60 · 20 fps: straight in ${f(a.out, 'naiveFly')}, skilled ${f(a.out, 'skilledFly')} (${a.out['skilledFly@60'].median} s), Boomwing straight in ${f(a.out, 'boomwing')}, skilled ${f(a.out, 'boomwingSkilled')}, walker ${f(a.out, 'walker')}, Cling ${f(a.out, 'cling')} ${a.problems.join('; ')}`);
    t.ok(!b.problems.length, `the Drip Tower: just climbing ${f(b.out, 'naiveClimb')}, skilled ${f(b.out, 'skilledClimb')} (${b.out['skilledClimb@60'].median} s), flier ${f(b.out, 'flier')}, Boomwing ${f(b.out, 'boomwing')}, walker ${f(b.out, 'walker')}, the ice outside ${f(b.out, 'iceWall')} ${b.problems.join('; ')}`);
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
      // Boomwing flies into the storm like any creature with wings (owner 2026-11-12: "too windy for Boomwing but not for bubbles?")
      await put(page, 100.5, 15, 136.5);
      await page.keyboard.down('Space'); await page.keyboard.down('w');
      await waitFor(page, () => Math.hypot(window.pokecraft.player.pos.x - 100, window.pokecraft.player.pos.z - 107) < 21, null, 240000).catch(() => {});
      const inStorm = await page.evaluate(() => ({ d: Math.hypot(window.pokecraft.player.pos.x - 100, window.pokecraft.player.pos.z - 107), toasts: [...(window.pokecraft.ui.toastBox?.children || [])].map(e => e.textContent).join(' | ') }));
      await shot(page, 'ways-storm.png');
      await page.keyboard.up('w'); await page.keyboard.up('Space');
      t.ok(inStorm.d < 21 && !/windy/i.test(inStorm.toasts), `Boomwing flies into the storm like any creature with wings, no "too windy" (${inStorm.d.toFixed(1)} from the island's middle)`);
      // V switches the camera
      await page.keyboard.press('KeyV'); await frames(page, 3);
      const eyes = await be(page);
      await page.keyboard.press('KeyV'); await frames(page, 2);
      t.ok(eyes.view === 'eyes' && !eyes.model, `V: the camera goes into its eyes (${eyes.view}), V again behind`);
      // Blazehound-like speed: a land creature moves like riding it (owner 2026-11-12)
      await put(page, 140.5, 11, 116.5, 0, 0.6);
      await page.keyboard.press('Digit2'); await frames(page, 3);
      const sp = await be(page);
      t.ok(sp.species === 'sproutle' && sp.move === 'land' && sp.speed === 7, `2: Sproutle, a land body: it runs at the land ride's speed (${sp.speed})`);
      await shot(page, 'ways-tower.png');
      await page.keyboard.down('w');
      await waitFor(page, () => window.pokecraft.player.pos.y > 12.5, null, 240000).catch(() => {});
      const climb = await page.evaluate(() => ({ y: window.pokecraft.player.pos.y, ...window.pokecraft.being.info() }));
      await shot(page, 'ways-shaft.png');
      await page.keyboard.up('w');
      t.ok(climb.y > 12.5 && climb.tight && !climb.behind, `Sproutle walks into the tower and climbs the shaft (y ${climb.y.toFixed(1)}); in the shaft the camera is in its eyes`);
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

  if (want('ipad')) {
    const page = await openGame(browser, base, { query: '?preview', contextOptions: devices['iPad (gen 7) landscape'] });
    await newGame(page, 0);
    await team(page);
    await intoWobble(page, { creature: true });
    await put(page, 100.5, 11, 137.5);
    await frames(page, 4);
    const label = () => page.evaluate(() => ({ ride: document.getElementById('btn-ride')?.textContent.trim(), place: document.getElementById('btn-place')?.textContent.trim(), jump: document.getElementById('btn-jump')?.textContent.trim() }));
    const a = await be(page), l1 = await label(), rideShown = await page.evaluate(() => !document.getElementById('btn-ride')?.classList.contains('hidden'));
    t.ok(a.species === 'scalewing' && a.flying && !rideShown && l1.place === 'Swap' && l1.jump === 'Up', `iPad: you are Scalewing by itself; no Creature / Me button (Ride hidden: ${!rideShown}), the Place button says ${l1.place}, Jump says ${l1.jump}`);
    await shot(page, 'ways-ipad.png');
    await page.tap('#btn-place'); await frames(page, 3);
    t.ok((await be(page)).species === 'sproutle', 'iPad: Swap goes to the next creature');
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
