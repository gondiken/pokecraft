// Chapter 3 Test A / B (owner 2026-11-09, plans/chapter3.md section 6): one scribbled patch near the start, ?preview only.
//   bots:   tests/scribblebots.mjs on three worlds: naive (mashes, never moves) loses, skilled wins, behind and in first person, 60 / 20 fps
//   real:   real keys through the game's own loop: W walks you in, the ring snaps, the cube, the camera rises (screenshots of the move),
//           Q / Space / D act, V glides to first person and back, a win: the camera glides back down and W walks on; a loss: try again
//   ipad:   an emulated iPad: the joystick walks you in, the five fixed slots are Dodge + your moves, a tap picks a monster, all restored after
//   closed: without ?preview there is no patch at all
//   SCRIBBLE_ONLY=bots|real|ipad|closed      screenshots: tests/screenshots/scribble-*.png
import { devices } from 'playwright';
import { openGame, newGame } from '../helpers.mjs';
import { scribblePage, runBots, SEEDS } from '../scribblebots.mjs';

const ONLY = process.env.SCRIBBLE_ONLY;
const part = n => !ONLY || ONLY.split(',').includes(n);
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const frames = (page, n = 2) => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const info = page => page.evaluate(() => window.pokecraft.scribble.info());
const until = (page, fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
const fight = (page, fn, arg) => page.evaluate(([fn, arg]) => eval(fn)(window.pokecraft.scribble.fightOf(), arg), [fn.toString(), arg]);

export default async function ({ browser, base, t }) {
  if (part('closed')) {
    const page = await openGame(browser, base);
    await newGame(page, 0);
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ on: window.pokecraft.scribble.on, info: window.pokecraft.scribble.info(), group: window.pokecraft.scene.getObjectByName('scribble') }));
    t.ok(!r.on && !r.info.on && !r.group, 'without ?preview there is no scribbled patch at all (no scene object, nothing to fight)');
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (part('bots')) {
    for (const seed of SEEDS) {
      const page = await scribblePage(browser, base, { seed });
      const { spot, d } = await page.evaluate(() => { const g = window.pokecraft, s = g.scribble.info().spot; return { spot: s, d: s && Math.hypot(s.x - g.spawnPoint.x, s.z - g.spawnPoint.z) }; });
      t.ok(spot && d >= 13 && d <= 24, `seed ${seed}: the patch is ${d?.toFixed(1)} blocks from the start (${JSON.stringify(spot)})`);
      const { lines, fails } = await runBots(page, 4, () => {});
      for (const l of lines.filter(l => !l.startsWith('info'))) t.ok(l.startsWith('ok'), `seed ${seed}: ${l.replace(/^(ok {2}|FAIL) /, '').replace(/ {2}\{.*/, '')}`);
      console.log(`  ${lines.find(l => l.startsWith('info'))}`);
      t.ok(!page.errors.length, `seed ${seed}: no page errors`);
      await page.context().close();
    }
  }

  if (part('real')) {
    const page = await scribblePage(browser, base, { seed: 1, contextOptions: { viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 } });
    await page.evaluate(() => { window.pokecraft.time = 0.3; window.pokecraft.scribble.warp(); });
    await frames(page, 3);
    await page.screenshot({ path: `${SHOTS}scribble-1-patch.png` });
    t.ok((await info(page)).phase === 'idle', 'a scribbled patch waits near the start, monsters inside');
    // walk in with a real key, through the game's own loop
    await page.keyboard.down('KeyW');
    await until(page, () => window.pokecraft.scribble.info().phase !== 'idle');
    await page.keyboard.up('KeyW');
    await page.evaluate(() => { window.pokecraft.scribble.pinT = 0.02; });
    let i0 = await info(page);
    t.ok(i0.phase === 'enter' && i0.camK === 0, 'stepping in starts it: the camera is still in your eyes');
    // the move, moment by moment (pinned so every screenshot shows one moment of the same move)
    const ks = [];
    for (const [n, at] of [[2, 0.25], [3, 0.6], [4, 0.95], [5, 1.3], [6, 1.65], [7, 1.95]]) {
      await page.evaluate(at => { window.pokecraft.scribble.pinT = at; }, at);
      await frames(page, 3);
      const i = await info(page);
      ks.push(i.camK);
      await page.screenshot({ path: `${SHOTS}scribble-${n}-rise.png` });
      if (n === 3) t.ok(i.you, 'your creature is out of its cube');
    }
    t.ok(ks.every((k, i) => i === 0 || k >= ks[i - 1]) && ks[0] < 0.05 && ks.at(-1) === 1, `the camera rises in one continuous move: ${ks.map(k => k.toFixed(2)).join(' -> ')}`);
    await page.evaluate(() => { window.pokecraft.scribble.pinT = null; });
    await until(page, () => window.pokecraft.scribble.info().phase === 'fight');
    let i1 = await info(page);
    t.ok(i1.camK === 1 && i1.fight.foes.length === 3 && i1.fight.squad.length === 3, 'the fight: behind your creature, three monsters, your squad of three');
    const view = await page.evaluate(() => { const c = window.pokecraft.camera, F = window.pokecraft.scribble.fightOf(); return { fov: c.fov, down: Math.atan2(c.position.y - F.you.y, Math.hypot(c.position.x - F.you.x, c.position.z - F.you.z)) * 180 / Math.PI }; });
    t.ok(Math.abs(view.fov - 50) < 0.5 && view.down > 55 && view.down < 70, `the steep fight camera like the arena's: fov ${view.fov.toFixed(1)}, ${view.down.toFixed(0)} degrees down`);
    const yaw0 = await page.evaluate(() => window.pokecraft.player.yaw);
    await page.mouse.move(500, 380); await page.mouse.move(700, 380); await frames(page, 3);
    t.ok(Math.abs(await page.evaluate(() => window.pokecraft.player.yaw) - yaw0) < 1e-6, 'behind your creature the camera does not turn with the mouse');
    const p0 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
    // real keys: Q = move 1, Space = Dodge, D moves your creature (not you)
    const c0 = await fight(page, F => ({ x: F.you.x, z: F.you.z }));
    await page.keyboard.down('KeyD');
    await until(page, c0 => { const F = window.pokecraft.scribble.fightOf(); return Math.hypot(F.you.x - c0.x, F.you.z - c0.z) > 0.6; }, c0);
    await page.keyboard.up('KeyD');
    const p1 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
    t.ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.01, 'D moves your creature; you stand still at the edge');
    await page.keyboard.press('KeyQ');
    await until(page, () => window.pokecraft.scribble.fightOf().cd[1] > 0, null, 20000).catch(() => {});
    t.ok(await fight(page, F => F.cd[1] > 0), 'Q uses your first move');
    await page.keyboard.down('Space'); await frames(page, 2); await page.keyboard.up('Space');
    await until(page, () => window.pokecraft.scribble.fightOf().cd[0] > 0, null, 20000).catch(() => {});
    t.ok(await fight(page, F => F.cd[0] > 0), 'Space dodges (and does not jump)');
    await page.screenshot({ path: `${SHOTS}scribble-8-fight.png` });
    // step 2: a big blast held with a real key: its ring grows on the ground; let go = the blast
    await fight(page, async F => { const { shapeOf } = await import('/src/arena/core.js'); F.moves[3] = shapeOf('statueslam'); F.cd[4] = 0; });
    await page.keyboard.down('KeyF');
    await until(page, () => window.pokecraft.scribble.fightOf().charge.t > 0.7, null, 20000).catch(() => {});
    const ring = await page.evaluate(() => { const g = window.pokecraft, a = g.scene.getObjectByName('scribble').children.find(o => o.geometry?.type === 'RingGeometry'); return { shown: !!a?.visible, r: a?.scale.x, charge: g.scribble.fightOf().charge.t }; });
    await page.screenshot({ path: `${SHOTS}scribble-8b-charge.png` });
    await page.keyboard.up('KeyF');
    await until(page, () => window.pokecraft.scribble.fightOf().cd[4] > 0, null, 20000).catch(() => {});
    t.ok(ring.shown && ring.r > 3 && await fight(page, F => F.cd[4] > 0 && F.charge.slot < 0), `F held: the big blast's ring grows on the ground (radius ${ring.r?.toFixed(1)} after ${ring.charge?.toFixed(1)} s), let go = the blast`);
    const perf = await page.evaluate(() => window.pokecraft.renderer.info.render.calls);
    t.ok(perf < 200, `draw calls in the fight: ${perf} (the steep camera sees less of the world; it was about 335)`);
    // Test B: V glides into first person in the middle of the fight; W then walks YOU, your creature follows
    await page.keyboard.press('KeyV');
    await until(page, () => window.pokecraft.scribble.info().camK === 0);
    t.ok((await info(page)).mode === 'eyes', 'V: the camera glides down into your eyes (Test B)');
    await page.evaluate(() => { const g = window.pokecraft, F = g.scribble.fightOf(), p = g.player; p.yaw = Math.atan2(-(F.foes[0].x - p.pos.x), -(F.foes[0].z - p.pos.z)); p.pitch = -0.15; });
    await frames(page, 3);
    await page.screenshot({ path: `${SHOTS}scribble-9-eyes.png` });
    const e0 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
    await page.keyboard.down('KeyS');
    await until(page, e0 => Math.hypot(window.pokecraft.player.pos.x - e0.x, window.pokecraft.player.pos.z - e0.z) > 0.8, e0);
    await page.keyboard.up('KeyS');
    await page.waitForTimeout(1500);
    const near = await page.evaluate(() => { const g = window.pokecraft, F = g.scribble.fightOf(); return Math.hypot(F.you.x - g.player.pos.x, F.you.z - g.player.pos.z); });
    t.ok(near < 4, `first person: W/S walk you, your creature runs beside you (${near.toFixed(1)} blocks away)`);
    await page.keyboard.press('KeyV');
    await until(page, () => window.pokecraft.scribble.info().camK === 1);
    t.ok((await info(page)).mode === 'behind', 'V again: back up behind your creature');
    // a win (the monsters' HP is taken away here; the bots play the real thing): the camera glides back down, then you walk on
    await fight(page, F => { for (const f of F.foes) F.hit(F.you, f, 9999, F.you.type, 100); });
    await until(page, () => window.pokecraft.scribble.info().phase === 'exit');
    const back = [];
    for (const [n, at] of [[10, 0.6], [11, 1.3], [12, 1.8], [13, 2.3], [14, 2.6]]) {
      await page.evaluate(at => { window.pokecraft.scribble.pinT = at; }, at);
      await frames(page, 3);
      back.push((await info(page)).camK);
      await page.screenshot({ path: `${SHOTS}scribble-${n}-back.png` });
    }
    t.ok(back.every((k, i) => i === 0 || k <= back[i - 1]) && back[0] === 1 && back.at(-1) === 0, `the camera glides back into your eyes: ${back.map(k => k.toFixed(2)).join(' -> ')}`);
    await page.evaluate(() => { window.pokecraft.scribble.pinT = null; });
    await until(page, () => window.pokecraft.scribble.info().phase === 'cleared');
    const w0 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
    await page.keyboard.down('KeyW');
    await until(page, w0 => Math.hypot(window.pokecraft.player.pos.x - w0.x, window.pokecraft.player.pos.z - w0.z) > 1, w0);
    await page.keyboard.up('KeyW');
    await frames(page, 3);
    await page.screenshot({ path: `${SHOTS}scribble-15-walk-on.png` });
    const ui = await page.evaluate(() => ({ fight: document.body.classList.contains('scribbling'), hud: !document.getElementById('sc-ui').classList.contains('hidden'), party: window.pokecraft.party.map(c => c.hp) }));
    t.ok(!ui.fight && !ui.hud, 'cleared: the scribble is gone, the HUD is the game\'s again, and W walks you on');
    t.ok(await page.evaluate(() => window.pokecraft.camera.fov) === 75, 'the field of view is the game\'s own again (75)');
    // a loss: the knot comes back, walk out and in again to retry
    await page.evaluate(() => { const s = window.pokecraft.scribble; s.phase = 'idle'; s.warp(); s.armed = true; /* as if you walked out and came back */ });
    await page.keyboard.down('KeyW');
    await until(page, () => window.pokecraft.scribble.info().phase === 'fight');
    await page.keyboard.up('KeyW');
    await fight(page, F => { for (let k = 0; k < 6 && !F.over; k++) { F.hit(F.foes[0], F.you, 9999, F.foes[0].type, 100); F.step(0.1); } });
    await until(page, () => window.pokecraft.scribble.info().phase === 'idle');
    const lost = await info(page);
    t.ok(lost.phase === 'idle' && !lost.armed && lost.camK === 0, 'a loss: back in your eyes, the scribble is a knot again; walk out and back in to try again');
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (part('ipad')) {
    const page = await scribblePage(browser, base, { seed: 22, contextOptions: devices['iPad (gen 7) landscape'] });
    t.ok(await page.evaluate(() => document.body.classList.contains('touch')), 'iPad: touch mode');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
    const center = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
    const tap = async (xy, id) => { await touch('touchStart', [[xy[0], xy[1], id]]); await frames(page, 2); await touch('touchEnd', []); };
    await page.evaluate(() => { window.pokecraft.time = 0.3; window.pokecraft.scribble.warp(); });
    const joy = await center('#joystick');
    await touch('touchStart', [[joy[0], joy[1], 1]]);
    await touch('touchMove', [[joy[0], joy[1] - 50, 1]]);
    await until(page, () => window.pokecraft.scribble.info().phase !== 'idle');
    await touch('touchEnd', []);
    await until(page, () => window.pokecraft.scribble.info().phase === 'fight');
    t.ok(true, 'the joystick walks you into the patch');
    const slots = await page.evaluate(() => ['btn-jump', 'btn-act', 'btn-place', 'btn-ride', 'btn-down'].map(id => { const e = document.getElementById(id); return { id, text: e.textContent, shown: e.offsetParent !== null }; }));
    const moves = await fight(page, F => F.moves.map(s => s?.name));
    t.ok(slots[0].text === 'Dodge' && slots.slice(1).every((s, i) => s.text === (moves[i] ?? '—')) && slots.every(s => s.shown), `the five fixed slots: ${slots.map(s => s.text).join(' / ')}`);
    await tap(await center('#btn-act'), 5);
    await until(page, () => window.pokecraft.scribble.fightOf().cd[1] > 0, null, 20000).catch(() => {});
    t.ok(await fight(page, F => F.cd[1] > 0), 'the round action button uses move 1');
    await tap(await center('#btn-jump'), 6);
    await until(page, () => window.pokecraft.scribble.fightOf().cd[0] > 0, null, 20000).catch(() => {});
    t.ok(await fight(page, F => F.cd[0] > 0), 'Jump dodges');
    const c0 = await fight(page, F => ({ x: F.you.x, z: F.you.z }));
    await touch('touchStart', [[joy[0], joy[1], 7]]);
    await touch('touchMove', [[joy[0] + 50, joy[1], 7]]);
    await until(page, c0 => { const F = window.pokecraft.scribble.fightOf(); return Math.hypot(F.you.x - c0.x, F.you.z - c0.z) > 0.6; }, c0);
    await touch('touchEnd', []);
    t.ok(true, 'the joystick moves your creature');
    // a tap on a monster makes it the target
    const other = await page.evaluate(() => {
      const g = window.pokecraft, F = g.scribble.fightOf(), cam = g.camera;
      for (const f of F.foes) if (f.alive && f !== F.target) {
        const v = new cam.position.constructor(f.x, f.y + 0.8, f.z).project(cam);
        if (v.z < 1 && Math.abs(v.x) < 0.8 && Math.abs(v.y) < 0.7) return { i: F.foes.indexOf(f), x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
      }
      return null;
    });
    if (other) {
      await tap([other.x, other.y], 8);
      await until(page, i => window.pokecraft.scribble.fightOf().target === window.pokecraft.scribble.fightOf().foes[i], other.i, 20000).catch(() => {});
      t.ok(await page.evaluate(i => window.pokecraft.scribble.fightOf().target === window.pokecraft.scribble.fightOf().foes[i], other.i), 'a tap on a monster picks it');
    } else t.ok(true, 'a tap on a monster picks it (no other monster on screen this time)');
    await frames(page, 3);
    await page.screenshot({ path: `${SHOTS}scribble-ipad.png` });
    await fight(page, F => { for (const f of F.foes) F.hit(F.you, f, 9999, F.you.type, 100); });
    await until(page, () => window.pokecraft.scribble.info().phase === 'cleared');
    await frames(page, 4);
    const after = await page.evaluate(() => ({ jump: document.getElementById('btn-jump').textContent, fight: document.getElementById('touch').classList.contains('fight'), down: getComputedStyle(document.getElementById('btn-down')).display }));
    t.ok(after.jump === 'Jump' && !after.fight && after.down === 'none', `after the fight the buttons are the game's again (${JSON.stringify(after)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }
}
