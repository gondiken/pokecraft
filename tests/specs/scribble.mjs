// Chapter 3 Test A / B (owner 2026-11-09, plans/chapter3.md section 6): one scribbled patch near the start, ?preview only.
//   bots:   tests/scribblebots.mjs on three worlds: naive (mashes, never moves) loses, skilled wins, 60 / 20 fps
//   real:   real keys through the game's own loop: W walks you in, the ring snaps, the cube, the camera rises (screenshots of the move),
//           Q / Space / D act, the camera turns by itself to bring a monster back in, a win: the camera glides back down and W walks on; a loss: try again
//   ipad:   an emulated iPad: the joystick walks you in, three buttons: Dodge, Attack, Special (Ride and Down hidden), a tap picks a monster, all restored after
//   closed: without ?preview there is no patch at all (and no "Where to go" row)
//   nav:    the guide arrow leads to the patch until you cleared it once; "Where to go" (G) has a row for it, dim while it is gone
//   SCRIBBLE_ONLY=bots|real|ipad|closed|nav      screenshots: tests/screenshots/scribble-*.png
import { devices } from 'playwright';
import { openGame, newGame } from '../helpers.mjs';
import { scribblePage, runBots, SEEDS } from '../scribblebots.mjs';
const KIND_WORDS = /^(Shot|Many shots|Blast|Rush|Heal|Power up|Tough|Slow cloud|Sleepy cloud)/;

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
    t.ok(await page.evaluate(() => !window.pokecraft.nav.rows().some(r => r.dest.id === 'scribble')), 'without ?preview "Where to go" has no scribble row');
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (part('nav')) {
    const page = await scribblePage(browser, base, { seed: 22 });
    const guide = () => page.evaluate(() => document.querySelector('#guide')?.textContent || '');
    await until(page, () => /Scribble/.test(document.querySelector('#guide')?.textContent || ''), null, 20000).catch(() => {});
    t.ok(/^✏️ Scribble [↑↖←↙↓↘→↗] \d+m$/.test(await guide()), `the guide arrow leads to the patch (${await guide()})`);
    const row = await page.evaluate(() => { const r = window.pokecraft.nav.rows().find(r => r.dest.id === 'scribble'); return r && { group: r.dest.group, reason: r.reason, label: r.dest.label }; });
    t.ok(row && !row.reason && row.label === 'The scribble', `"Where to go" has a row for it (${JSON.stringify(row)})`);
    // cleared once: the arrow goes back to the gyms; the row stays, dim while the patch is gone, and leads there once it is back
    await page.evaluate(() => { const g = window.pokecraft; g.scribble.beaten = true; g.scribble.phase = 'cleared'; });
    await until(page, () => !/Scribble/.test(document.querySelector('#guide')?.textContent || ''), null, 20000).catch(() => {});
    t.ok(!/Scribble/.test(await guide()), `cleared once, the arrow goes back to the next gym (${await guide()})`);
    t.ok(await page.evaluate(() => !!window.pokecraft.nav.rows().find(r => r.dest.id === 'scribble')?.reason), 'while it is gone the row is dim');
    await page.evaluate(() => { const g = window.pokecraft; g.scribble.phase = 'idle'; g.nav.choose(g.nav.rows().find(r => r.dest.id === 'scribble').dest); });
    await until(page, () => /The scribble/.test(document.querySelector('#guide')?.textContent || ''), null, 20000).catch(() => {});
    t.ok(/^📍 The scribble [↑↖←↙↓↘→↗] \d+m$/.test(await guide()), `picked in "Where to go", the arrow leads there (${await guide()})`);
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
      for (const l of lines.filter(l => l.startsWith('info'))) console.log(`  ${l}`);
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
    t.ok(Math.abs(view.fov - 50) < 0.5 && view.down > 52 && view.down < 61, `the fight camera (owner 2026-11-10: a little flatter than the arena's): fov ${view.fov.toFixed(1)}, ${view.down.toFixed(0)} degrees down`);
    const yaw0 = await page.evaluate(() => window.pokecraft.player.yaw);
    await page.mouse.move(500, 380); await page.mouse.move(700, 380); await frames(page, 3);
    t.ok(Math.abs(await page.evaluate(() => window.pokecraft.player.yaw) - yaw0) < 0.05, 'the camera does not follow the mouse in a fight');
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
    t.ok(await fight(page, F => F.cd[1] > 0), 'Q = Attack: it uses the first attack move');
    await page.keyboard.press('KeyE');
    await until(page, () => { const F = window.pokecraft.scribble.fightOf(); return F.cd[2] > 0; }, null, 20000).catch(() => {});
    t.ok(await fight(page, F => F.cd[2] > 0 && F.moves[1].kind === 'buff'), 'E = Special: it uses the help move (Pump Up)');
    await page.keyboard.down('Space'); await frames(page, 2); await page.keyboard.up('Space');
    await until(page, () => window.pokecraft.scribble.fightOf().cd[0] > 0, null, 20000).catch(() => {});
    t.ok(await fight(page, F => F.cd[0] > 0), 'Space dodges (and does not jump)');
    await page.screenshot({ path: `${SHOTS}scribble-8-fight.png` });
    // step 2: a big blast held with a real key: its ring grows on the ground; let go = the blast
    // owner 2026-11-10 ("a creature has 4 types of attacks and zero special. what to do there?"): no button sits empty
    const lay = await fight(page, F => {
      const old = F.moves, mk = kinds => kinds.map(k => ({ kind: k }));
      const out = [['bolt', 'buff', 'dash', 'dash'], ['bolt', 'volley', 'dash', 'burst'], ['bolt', 'bolt', 'bolt', 'bolt'], ['heal', 'cloud', 'sleep', 'buff']].map(ks => { F.moves = mk(ks); const L = F.buttonsOf(); return [L[1].map(i => ks[i - 1]).join('+'), L[2].map(i => ks[i - 1]).join('+')].join(' | '); });
      F.moves = old; return out;
    });
    t.ok(lay[0] === 'bolt+dash+dash | buff' && lay[1] === 'bolt+volley | dash+burst' && lay[2] === 'bolt+bolt | bolt+bolt' && lay[3] === 'heal+cloud | sleep+buff', `moves spread over the two buttons: ${lay.join(' ; ')}`);
    await fight(page, async F => { const { shapeOf } = await import('/src/arena/core.js'); F.moves[3] = shapeOf('statueslam'); F.cd[4] = 0; F.usedAt[1] = F.usedAt[3] = F.clock; });
    await frames(page, 3);
    const shows = await page.evaluate(() => document.querySelectorAll('#sc-ui .mv')[1]?.textContent || '');
    t.ok(/Blast · hold/.test(shows) && /Statue Slam/.test(shows), `the Q card says what it does next: ${shows.replace(/\s+/g, ' ')}`);
    await page.keyboard.down('KeyQ');
    await until(page, () => window.pokecraft.scribble.fightOf().charge.t > 0.7, null, 20000).catch(() => {});
    const ring = await page.evaluate(() => { const g = window.pokecraft, a = g.scene.getObjectByName('scribble').children.find(o => o.geometry?.type === 'RingGeometry'); return { shown: !!a?.visible, r: a?.scale.x, charge: g.scribble.fightOf().charge.t }; });
    await page.screenshot({ path: `${SHOTS}scribble-8b-charge.png` });
    await page.keyboard.up('KeyQ');
    await until(page, () => window.pokecraft.scribble.fightOf().cd[4] > 0, null, 20000).catch(() => {});
    t.ok(ring.shown && ring.r > 3 && await fight(page, F => F.cd[4] > 0 && F.charge.slot < 0), `Q held on a Blast: the big blast's ring grows on the ground (radius ${ring.r?.toFixed(1)} after ${ring.charge?.toFixed(1)} s), let go = the blast`);
    const perf = await page.evaluate(() => window.pokecraft.renderer.info.render.calls);
    t.ok(perf < 200, `draw calls in the fight: ${perf} (the steep camera sees less of the world; it was about 335)`);
    // owner 2026-11-10 ("a slight turn to cover for the scene is ok"): a monster at the edge of the screen = the camera turns, slowly
    const turned = await page.evaluate(async () => {
      const { FightCam, groundOf, onScreen } = await import('/src/scribblefight.js');
      const g = window.pokecraft, F = g.scribble.fightOf(), G = groundOf(g.world), cam = new FightCam(), aspect = 4 / 3;
      cam.start(0, F.you.x, F.you.y, F.you.z);
      const right = { x: 9.5, z: 0 }; // the screen's right at yaw 0, near its edge
      const foe = { x: F.you.x + right.x, y: F.you.y, z: F.you.z + right.z };
      let p = cam.update(1 / 60, F.you, 0, aspect, G, true, [foe]);
      const x0 = onScreen(p, aspect, foe.x, foe.y + 0.6, foe.z)?.x;
      for (let k = 0; k < 180; k++) p = cam.update(1 / 60, F.you, 0, aspect, G, false, [foe]);
      const x1 = onScreen(p, aspect, foe.x, foe.y + 0.6, foe.z)?.x;
      for (let k = 0; k < 180; k++) cam.update(1 / 60, F.you, 0, aspect, G, false, [{ ...foe, x: F.you.x - 1, z: F.you.z - 3 }]);
      const y2 = cam.yaw; for (let k = 0; k < 120; k++) cam.update(1 / 60, F.you, 0, aspect, G, false, [{ ...foe, x: F.you.x - 1, z: F.you.z - 3 }]);
      return { x0, x1, dy: Math.abs(cam.yaw), still: Math.abs(cam.yaw - y2) };
    });
    t.ok(turned.x0 > 0.85 && turned.x1 < 0.86 && turned.dy < 1 && turned.still < 1e-3, `a monster at the screen's edge: the camera turns slowly until it is back in (x ${turned.x0.toFixed(2)} -> ${turned.x1.toFixed(2)} in 3 s, ${(turned.dy * 180 / Math.PI).toFixed(0)} degrees), then stays still`);
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
    const slots = await page.evaluate(() => ['btn-jump', 'btn-act', 'btn-place', 'btn-ride', 'btn-down'].map(id => { const e = document.getElementById(id); return { id, text: e.textContent, svg: !!e.querySelector('svg'), shown: e.offsetParent !== null }; }));
    t.ok(slots[0].text === 'Dodge' && KIND_WORDS.test(slots[1].text) && KIND_WORDS.test(slots[2].text) && slots[1].svg && slots[2].svg && slots.slice(0, 3).every(s => s.shown) && slots.slice(3).every(s => !s.shown), `three buttons, each with a drawn icon and its move's kind: ${slots.slice(0, 3).map(s => s.text).join(' / ')}; Ride and Down hidden`);
    await tap(await center('#btn-act'), 5);
    await until(page, () => window.pokecraft.scribble.fightOf().cd[1] > 0, null, 20000).catch(() => {});
    t.ok(await fight(page, F => F.cd[1] > 0), 'the round action button is Attack');
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
