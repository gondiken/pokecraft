// Tablet controls on an emulated iPad: joystick + drag-look (multi-touch), buttons, team screen, pause.
import { devices } from 'playwright';
import { openGame } from '../helpers.mjs';
import { STAGE } from './home-ui.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await page.tap('text=New Game');
  await page.tap('.starter >> nth=0');
  await page.waitForTimeout(1500);
  t.ok(await page.evaluate(() => document.body.classList.contains('touch')), 'touch mode turns on');
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const center = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const before = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z, yaw: window.pokecraft.player.yaw }));
  const joy = await center('#joystick');
  await touch('touchStart', [[joy[0], joy[1], 1]]);
  await touch('touchMove', [[joy[0], joy[1] - 60, 1], [700, 300, 2]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[joy[0], joy[1] - 60, 1], [700 - i * 15, 300, 2]]); await page.waitForTimeout(60); }
  await page.waitForTimeout(600);
  await touch('touchEnd', []);
  const after = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z, yaw: window.pokecraft.player.yaw }));
  t.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0.5, 'joystick walks');
  t.ok(Math.abs(after.yaw - before.yaw) > 0.1, 'dragging the right side looks around (at the same time)');
  // A battle (or menu) starting while the joystick and Jump are held resets them, so the next touch works.
  const jump = await center('#btn-jump');
  await touch('touchStart', [[joy[0], joy[1], 3], [jump[0], jump[1], 4]]);
  await page.waitForTimeout(200);
  t.ok(await page.evaluate(() => window.pokecraft.touch.joyId !== null && document.getElementById('btn-jump').classList.contains('down')), 'holding the joystick and Jump');
  await page.evaluate(() => window.pokecraft.touch.reset());
  t.ok(await page.evaluate(() => window.pokecraft.touch.joyId === null && !document.getElementById('btn-jump').classList.contains('down')), 'reset forgets the joystick finger and the Jump button');
  await touch('touchEnd', []);
  await page.evaluate(() => { const g = window.pokecraft; g.touch.joyId = 999; }); // as if a finger's "up" got lost
  await page.evaluate(() => window.pokecraft.touch.reset());
  const b2 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
  await touch('touchStart', [[joy[0], joy[1], 5]]);
  for (let i = 0; i < 6; i++) { await touch('touchMove', [[joy[0], joy[1] - 60, 5]]); await page.waitForTimeout(100); }
  // Hold until the player has moved (walking runs on frames, which are slow under load), at most 20 s.
  await page.waitForFunction(b => Math.hypot(window.pokecraft.player.pos.x - b.x, window.pokecraft.player.pos.z - b.z) > 0.3, b2, { timeout: 20000, polling: 100 }).catch(() => {});
  await touch('touchEnd', []);
  const a2 = await page.evaluate(() => ({ x: window.pokecraft.player.pos.x, z: window.pokecraft.player.pos.z }));
  t.ok(Math.hypot(a2.x - b2.x, a2.z - b2.z) > 0.3, 'after a reset the joystick walks again');
  await page.tap('.slot >> nth=4');
  t.ok(await page.evaluate(() => window.pokecraft.selected === 4), 'tapping the hotbar picks a block');
  await page.evaluate(() => { window.pokecraft.player.pitch = -1.2; });
  await page.waitForTimeout(300);
  // T39c: fixed slots. The action button says Break and is bright at a block; Down is not there on the ground.
  const st = () => page.evaluate(() => {
    const r = id => { const e = document.getElementById(id), b = e.getBoundingClientRect(); return { dim: e.classList.contains('dim'), hidden: getComputedStyle(e).display === 'none', text: e.textContent, x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
    return { act: r('btn-act'), place: r('btn-place'), ride: r('btn-ride'), jump: r('btn-jump'), down: r('btn-down'), pause: r('btn-pause'), book: r('btn-book') };
  });
  await page.waitForFunction(() => document.getElementById('btn-act').textContent === 'Break' && !document.getElementById('btn-act').classList.contains('dim'), null, { timeout: 20000 }).catch(() => {});
  const u1 = await st();
  t.ok(u1.act.text === 'Break' && !u1.act.dim && !u1.place.dim, 'at a block: the action button says Break, Place is bright');
  t.ok(u1.down.hidden && u1.ride.hidden, 'on the ground with no rideable creature: no Down, no Ride');
  t.ok(u1.act.w >= 96 && u1.jump.w === 84 && u1.place.w >= 64, 'sizes: action 100, Jump 84, Place 68');
  const boxes = ['act', 'place', 'jump'].map(k => u1[k]);
  t.ok(boxes.every((a, i) => boxes.every((b, j) => i === j || a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)), 'Action, Place and Jump do not overlap');
  t.ok(u1.pause.h >= 56 && u1.book.h >= 56 && await page.evaluate(() => !document.getElementById('btn-team') && !document.getElementById('btn-blocks') && !document.getElementById('btn-break')), 'top bar: only the menu and Book');
  await page.tap('#btn-act');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => window.pokecraft.world.edits.size > 0), 'the action button breaks a block');
  // The sky: Action and Place dim in the same places; a tap on dim Place says why.
  await page.evaluate(() => { window.pokecraft.player.pitch = 1.4; });
  await page.waitForFunction(() => document.getElementById('btn-place').classList.contains('dim'), null, { timeout: 20000 });
  const u2 = await st();
  t.ok(u2.act.dim && u2.place.dim && u2.act.x === u1.act.x && u2.act.y === u1.act.y && u2.place.x === u1.place.x && u2.place.y === u1.place.y && !u2.act.hidden && !u2.place.hidden, 'looking at the sky: both dim, same size and place');
  await page.evaluate(() => { window.__toasts = []; });
  await page.tap('#btn-place');
  t.ok(await page.evaluate(() => /Look at a block/.test(document.getElementById('toast').textContent)), 'a tap on dim Place says why');
  await page.evaluate(() => { window.pokecraft.player.pitch = -1.2; });
  await page.waitForTimeout(400);
  // Ride only with a rideable creature, in its fixed slot; Down only while flying, right under Jump.
  await page.evaluate(async () => { const g = window.pokecraft; const S = await import('/src/species.js'); const c = S.makeCreature('whaloft', 20); c.traits = ['rideable']; g.party.push(c); });
  await page.waitForFunction(() => !document.getElementById('btn-ride').classList.contains('hidden'), null, { timeout: 20000 }).catch(() => {});
  const u3 = await st();
  t.ok(!u3.ride.hidden && u3.ride.text === 'Ride' && u3.ride.x < u3.place.x && u3.ride.y === u3.place.y, 'with a rideable creature the Ride slot appears above the action button, left of Place');
  await page.evaluate(() => { const g = window.pokecraft; g.party.pop(); });
  await page.evaluate(async () => { const g = window.pokecraft; g.touch.setButtons({ ...g.touch.cur(), sky: true }); });
  const u4 = await st();
  t.ok(!u4.down.hidden && u4.jump.text === 'Up' && u4.down.y >= u4.jump.y + u4.jump.h - 2 && Math.abs((u4.down.x + u4.down.w / 2) - (u4.jump.x + u4.jump.w / 2)) < 20 && u4.jump.x === u1.jump.x && u4.jump.y === u1.jump.y, 'flying: Jump says Up in the same place, Down sits right under it');
  await page.screenshot({ path: new URL('../screenshots/t39-after-ipad-fly-buttons.png', import.meta.url).pathname });
  await page.evaluate(() => { const g = window.pokecraft; g.touch.setButtons({ ...g.touch.cur(), sky: false }); });
  await page.tap('#party-mini');
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => window.pokecraft.ui.panelOpen), 'tapping the creature card opens the team screen');
  await page.tap('#party-close');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => !window.pokecraft.ui.panelOpen), 'Close button closes it');
  // Tapping the selected hotbar slot again opens the Blocks panel; picking a block fills that slot.
  await page.tap('#hotbar .slot.sel');
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => !document.getElementById('blocks').classList.contains('hidden')), 'tapping the selected hotbar slot again opens the Blocks panel');
  await page.tap('#block-list button:has-text("Lamp")');
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => !window.pokecraft.ui.panelOpen && document.querySelector('#hotbar .slot.sel').title === 'Lamp'), 'picking Lamp fills the slot and closes the panel');
  await page.tap('#btn-pause');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => !document.getElementById('pause').classList.contains('hidden')), 'the menu button pauses (and the tap does not instantly unpause)');
  const pb = await page.evaluate(() => ['pb-team', 'pb-blocks', 'pb-book', 'pb-missions', 'pb-where', 'pb-home'].map(id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return [id, getComputedStyle(e).display !== 'none', Math.round(r.height)]; }));
  t.ok(pb.slice(0, 3).every(([, shown, h]) => shown && h >= 56) && pb[4][1] && !pb[3][1] && !pb[5][1], `pause screen: big Team, Blocks, Book, Where to go; no Missions (not a Champion) or My home (not on a mat) ${JSON.stringify(pb)}`);
  await page.tap('#pb-blocks');
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => !document.getElementById('blocks').classList.contains('hidden') && document.getElementById('pause').classList.contains('hidden')), 'the pause Blocks button opens the Blocks panel');
  await page.tap('#blocks-close');
  await page.waitForTimeout(300);
  await page.tap('#btn-pause');
  await page.tap('#pb-where');
  await page.waitForTimeout(400);
  t.ok(await page.evaluate(() => window.pokecraft.ui.navOpen), 'the pause Where to go button opens the nav panel');
  await page.tap('#nav-close');
  await page.waitForTimeout(300);
  await page.tap('#btn-pause');
  await page.waitForTimeout(300);
  await page.tap('#resume');
  await page.waitForTimeout(300);
  t.ok(await page.evaluate(() => document.getElementById('pause').classList.contains('hidden')), 'Resume button resumes');
  // T18: a Camo creature is a block that blinks: tapping it, or the Break button while looking at it, starts a battle.
  const camoSetup = () => page.evaluate(async () => {
    const g = window.pokecraft, w = g.world;
    const { B } = await import('/src/blocks.js');
    const sx = Math.floor(g.spawnPoint.x), sz = Math.floor(g.spawnPoint.z), y = 42;
    g.weather.set('clear'); g.time = 0.25; g.creatures.clear(); g.creatures.spawnTimer = 1e9;
    for (let x = -4; x <= 6; x++) for (let z = -4; z <= 4; z++) { for (let h = y; h <= y + 4; h++) w.set(sx + x, h, sz + z, B.AIR); w.set(sx + x, y, sz + z, B.GRASS); }
    for (const [a, b] of [[2, 1], [4, 1], [3, 1], [2, -1], [4, -1], [3, -1], [3, 2]]) w.set(sx + a, y + 1, sz + b, B.LEAVES);
    w.updateDirty();
    g.creatures.spawnAt('bushling', sx + 3, y + 1, sz, { level: 5 });
    g.player.pos.set(sx + 0.5, y + 1, sz + 0.5);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: sx + 3.5, y: y + 1.5, z: sz + 0.5 });
    return !!g.creatures.list[0]?.disguise;
  });
  const endBattle = async () => {
    await page.waitForSelector('#b-actions button', { timeout: 180000 });
    await page.evaluate(() => document.querySelector('#b-actions button:last-child').click()); // Run
    await page.waitForFunction(() => !window.pokecraft.inBattle, null, { timeout: 120000 }).catch(() => {});
    if (await page.evaluate(() => window.pokecraft.inBattle)) await page.evaluate(() => { window.pokecraft.battle.active = false; window.pokecraft.inBattle = false; document.body.classList.remove('in-battle'); document.getElementById('battle').classList.add('hidden'); });
  };
  t.ok(await camoSetup(), 'a disguised Bushling stands in front of the player');
  await page.waitForFunction(() => document.getElementById('prompt').textContent.includes('Bushling'), null, { timeout: 60000 }).catch(() => {});
  const spot = await page.evaluate(() => {
    const g = window.pokecraft, THREE_V = g.player.eyePos.constructor;
    const w = g.creatures.list[0];
    const v = new THREE_V(w.pos.x, w.pos.y + 0.5, w.pos.z).project(g.camera);
    return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight];
  });
  await page.touchscreen.tap(spot[0], spot[1]);
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'tapping a disguised Camo creature starts a battle');
  t.ok(await page.evaluate(() => window.pokecraft.creatures.list[0].disguise === null), 'and it pops out of its block');
  await endBattle();
  await camoSetup();
  await page.waitForFunction(() => document.getElementById('prompt').textContent.includes('Bushling'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => document.getElementById('btn-act').textContent === 'Battle!', null, { timeout: 60000 }).catch(() => {});
  await page.tap('#btn-act');
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'the action button on a disguised creature battles it (and breaks no block)');
  await endBattle();
  // T22: homes on a tablet. Stepping on a new Doormat claims it and opens 'What can my home be?', the action
  // button says "My home", the meter can be tapped, "Show me a house" shows the spinning model (drag turns, pinch zooms).
  const { sx: hx, sz: hz, mat } = await page.evaluate(STAGE);
  await page.evaluate(([x, z]) => { const p = window.pokecraft.player; p.pos.set(x + 4.5, 43, z - 2.5); p.vel.set(0, 0, 0); }, [hx, hz]);
  await page.waitForTimeout(600);
  await page.evaluate(([x, y, z]) => { const p = window.pokecraft.player; p.pos.set(x + 0.5, y + 1, z + 0.5); p.vel.set(0, 0, 0); }, mat);
  await page.waitForFunction(() => window.pokecraft.ui.homeOpen && window.pokecraft.homeUi.state().view === 'types', null, { timeout: 30000 });
  const nTypes = await page.evaluate(async () => Object.keys((await import('/src/hometypes.js')).HOME_TYPES).length);
  t.ok(await page.evaluate(([x, z]) => { const m = window.pokecraft.homes.mine(); return !!m && m.x === x + 4 && m.z === z + 1; }, [hx, hz]) && await page.evaluate(() => document.querySelectorAll('#home .hm-card').length) === nTypes, 'stepping on a new Doormat claims it and opens "What can my home be?"');
  await page.screenshot({ path: new URL('../screenshots/t30-5-types-ipad.png', import.meta.url).pathname });
  t.ok(await page.evaluate(() => [...document.querySelectorAll('#home-body button')].every(b => b.getBoundingClientRect().height >= 44)), 'every button in the panel is at least 44 px high');
  await page.tap('#home-close');
  await page.waitForFunction(() => !window.pokecraft.ui.homeOpen, null, { timeout: 15000 });
  t.ok(await page.evaluate(() => document.getElementById('pause').classList.contains('hidden')), 'and the pause screen stays away');
  // T39c: the action button breaks what you look at (the Doormat room has walls); My home is a big button in the pause screen.
  await page.tap('#btn-pause');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('pb-home')).display !== 'none', null, { timeout: 15000 });
  t.ok(true, 'the pause screen shows "My home" on the Doormat');
  await page.tap('#pb-home');
  await page.waitForFunction(() => window.pokecraft.ui.homeOpen, null, { timeout: 15000 });
  t.ok(true, 'and it opens the home panel');
  await page.tap('#home-close');
  await page.waitForFunction(() => !window.pokecraft.ui.homeOpen, null, { timeout: 15000 });
  await page.evaluate(() => window.__fake({ feats: ['bed', 'fire'] }));
  await page.waitForFunction(() => !document.getElementById('home-meter').classList.contains('hidden') && document.querySelector('#home-meter .feat'), null, { timeout: 15000 });
  t.ok(await page.evaluate(() => getComputedStyle(document.getElementById('home-meter')).pointerEvents === 'auto'), 'the meter takes taps on a tablet');
  await page.tap('#home-meter');
  await page.waitForFunction(() => window.pokecraft.ui.homeOpen && window.pokecraft.homeUi.state().view === 'home', null, { timeout: 15000 });
  t.ok(true, 'tapping the meter opens the home panel');
  await page.tap('#home button[data-act="types"]');
  await page.waitForFunction(() => window.pokecraft.homeUi.state().view === 'types', null, { timeout: 15000 });
  await page.tap('#home button[data-act="preview"][data-type="cozy"]');
  await page.waitForFunction(() => window.pokecraft.homeUi.state().view === 'preview', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  t.ok(await page.evaluate(() => !!document.querySelector('#home canvas.hm-canvas')), '"Show me a house" shows the model');
  const cv = await center('#home canvas');
  const s0 = await page.evaluate(() => window.pokecraft.homeUi.state());
  await touch('touchStart', [[cv[0] - 60, cv[1], 11]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[cv[0] - 60 + i * 15, cv[1], 11]]); await page.waitForTimeout(40); }
  const s1 = await page.evaluate(() => window.pokecraft.homeUi.state());
  await touch('touchEnd', []);
  t.ok(Math.abs(s1.yaw - s0.yaw) > 0.8, `a one-finger drag turns the model (yaw ${s0.yaw.toFixed(2)} -> ${s1.yaw.toFixed(2)})`);
  await touch('touchStart', [[cv[0] - 40, cv[1], 21], [cv[0] + 40, cv[1], 22]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[cv[0] - 40 - i * 10, cv[1], 21], [cv[0] + 40 + i * 10, cv[1], 22]]); await page.waitForTimeout(40); }
  const s2 = await page.evaluate(() => window.pokecraft.homeUi.state());
  await touch('touchEnd', []);
  t.ok(s2.zoom > 1.3 && s2.zoom <= 2, `a two-finger pinch zooms in (zoom ${s2.zoom.toFixed(2)})`);
  await page.screenshot({ path: new URL('../screenshots/t22-touch-preview.png', import.meta.url).pathname });
  await page.tap('#home-close');
  await page.waitForFunction(() => !window.pokecraft.ui.homeOpen, null, { timeout: 15000 });
  t.ok(await page.evaluate(() => document.getElementById('pause').classList.contains('hidden')), 'Close returns to playing (no pause screen)');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
