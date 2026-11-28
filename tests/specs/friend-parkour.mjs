// The Parkour race, a game for two friends (owner 2026-11-28, plans/friend-games-next.md section 1): both race the Obstacle Course.
//   rules : Node: parkourrules.js (the two start spots, "You're 1st!", the leader's judge at 60 and 20 fps)
//   race  : two browsers in the main world, far from the course: the friend menu, asking, both puffed onto the start platform side
//           by side, 3-2-1 with real keys (W does nothing), Go = the course starts over on both, real keys walk off the start and
//           a fall sends you back, flags, "You're 2nd!", the trainers step aside (E and walking into them), the first to the top
//           wins on both screens, both back to normal, nothing saved; a second race: walking out of the course stops it
//   ipad  : two iPads: taps ask and answer, the Jump button during the count, the friend wins with a tap-started race
//   trip  : a Champion host in the Swirl: both home to the main world onto the start platform, and back to their Swirl spots
// PARKOUR_ONLY=rules|race|ipad|trip
import { devices } from 'playwright';
import { openPair, newGame, click, pause } from '../helpers.mjs';

const only = process.env.PARKOUR_ONLY;
const want = part => !only || only.split(',').includes(part);
const shot = (page, name) => page.screenshot({ path: new URL(`../screenshots/${name}`, import.meta.url).pathname, timeout: 120000 }).then(() => console.log(`  screenshot ${name}`)).catch(() => {});
const src = f => import(new URL(`../../src/${f}`, import.meta.url).href);
const said = (page, re) => page.evaluate(r => (window.__toasts || []).some(m => new RegExp(r).test(m)), re.source);
async function waitFor(page, fn, arg, ms = 30000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 150 }); return true; } catch { return false; }
}
const heard = (page, re, ms = 15000) => waitFor(page, r => (window.__toasts || []).some(m => new RegExp(r).test(m)), re.source, ms);
const listen = page => page.evaluate(() => {
  const g = window.pokecraft;
  if (window.__toasts) return;
  window.__toasts = [];
  const f = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...r) => { window.__toasts.push(m); return f(m, ...r); };
});
const standAt = (page, dx, dz = 0) => page.evaluate(([dx, dz]) => {
  const g = window.pokecraft, s = g.spawnPoint, y = 42;
  const cx = Math.floor(s.x) + dx, cz = Math.floor(s.z) + dz;
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.world.set(cx + x, y, cz + z, 3);
  g.player.pos.set(cx + 0.5, y + 1, cz + 0.5);
  g.player.vel.set(0, 0, 0);
}, [dx, dz]);
async function share(A, B) {
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await waitFor(B, () => window.pokecraft.mp.role === 'guest', null, 60000);
  await waitFor(A, () => window.pokecraft.mp.others.size === 1); await waitFor(B, () => window.pokecraft.mp.others.size === 1);
  await listen(A); await listen(B);
}
const openMenu = page => page.evaluate(() => { const g = window.pokecraft; g.ui.closePanel?.(); g.openFriend([...g.mp.others.values()][0]); });
const menu = page => page.evaluate(() => [...document.querySelectorAll('#friend .fm-btn')].map(b => ({ id: b.dataset.friend, word: b.querySelector('b').textContent, sub: b.querySelector('small')?.textContent || '', dim: b.classList.contains('dim') })));
async function invite(from, to, id, yes = true) {
  await openMenu(from);
  await waitFor(from, i => !!document.querySelector(`#friend [data-friend="${i}"]`), id, 8000);
  await click(from, `#friend [data-friend="${id}"]`);
  const asked = await waitFor(to, () => !document.getElementById('ask').classList.contains('hidden'));
  const text = await to.evaluate(() => document.getElementById('ask-text').textContent);
  if (yes) await to.evaluate(() => window.pokecraft.ui.askYes()); else await to.keyboard.press('n');
  return asked ? text : '';
}
const both = async (A, B, fn, arg) => (await waitFor(A, fn, arg)) && (await waitFor(B, fn, arg));
const info = page => page.evaluate(() => window.pokecraft.friendGames.state().info);
// where I stand against my start spot and the course's state
const onSpot = page => page.evaluate(async () => {
  const g = window.pokecraft, c = g.gymLive.of('parkour'), { startSpots } = await import('/src/parkourrules.js'), p = g.player;
  const side = g.friendGames.state().leader ? 0 : 1, sp = startSpots(c.gym)[side];
  return { side, d: Math.hypot(p.pos.x - sp[0], p.pos.z - sp[2]), dy: Math.abs(p.pos.y - sp[1]), race: !!c.race, x: p.pos.x, z: p.pos.z };
});
// to the stand of flag k (a teleport; the course's own stand hook counts it)
const toFlag = (page, k) => page.evaluate(k => {
  const g = window.pokecraft, c = g.gymLive.of('parkour'), cp = c.gym.checkpoints[k], p = g.player;
  p.pos.set(...cp.stand); p.vel.set(0, 0, 0); p.onGround = true;
}, k);
const flagIs = (page, k, ms = 20000) => waitFor(page, k => window.pokecraft.gymLive.of('parkour').reached >= k, k, ms);
const saved = page => page.evaluate(() => { const g = window.pokecraft; return JSON.stringify([g.beaten, g.badges, g.cubes, g.stars, g.keys]); });
const slowCount = (page, n) => page.evaluate(n => import('/src/parkourrules.js').then(m => { m.PARKOUR.count = n; }), n);
// back to the real 3-2-1 and straight to its end (GO)
const goNow = page => page.evaluate(() => import('/src/parkourrules.js').then(m => { m.PARKOUR.count = 3; const r = window.pokecraft.friendGames.play; if (r?.phase === 'count') r.countT = 3; }));

export default async function ({ browser, base, t }) {
  /* ------------------------------------------------ rules (Node) ------------------------------------------------ */
  if (want('rules')) {
    const { PARKOUR, RaceJudge, startSpots, standing } = await src('parkourrules.js');
    for (const [front, side] of [[[1, 0], [0, 1]], [[0, -1], [-1, 0]], [[-1, 0], [0, -1]]]) {
      const gym = { x: 100, z: 200, front, side, pieces: { S0: { y: 20 } } };
      const [a, b] = startSpots(gym);
      const wx = side[0], wz = side[1]; // both face +s
      const looks = [Math.sin(a[3]) * -1, Math.cos(a[3]) * -1]; // the way yaw looks (player.js: forward = (-sin, -cos))
      t.ok(Math.abs(Math.hypot(a[0] - b[0], a[2] - b[2]) - 3) < 1e-9 && a[1] === 21 && b[1] === 21 && a[3] === b[3]
        && Math.abs(looks[0] - wx) < 1e-9 && Math.abs(looks[1] - wz) < 1e-9,
      `start spots (front ${front}): side by side, three blocks apart, on top of the start platform, both facing the first jump`);
    }
    t.ok(standing(2, 1) === "You're 1st!" && standing(1, 2) === "You're 2nd!" && standing(1, 1) === 'Neck and neck!' && standing(1, 3, null, 30) === "You're 2nd!" && standing(2, 3, 25, null) === "You're 1st!",
      'the chip: 1st / 2nd by flags, neck and neck on the same flag, a finish counts first');
    const run = (fps, plan) => { // plan: [[time, side, runTime]]: at `time` on the leader's clock, that side's finish is known
      const j = new RaceJudge(), dt = 1 / fps; let clock = 0, w;
      for (let i = 0; i < fps * 120 && w === undefined; i++) {
        clock += dt;
        for (const [at, side, rt] of plan) if (clock >= at) j.set(side, rt);
        w = j.step(dt, clock);
      }
      return { w, clock };
    };
    for (const fps of [60, 20]) {
      const a = run(fps, [[40, 0, 40], [40.5, 1, 39.2]]);
      t.ok(a.w === 1 && a.clock < 40.6, `${fps} fps: the friend's faster time arrives just after mine: the friend wins (decided at ${a.clock.toFixed(2)} s)`);
      const b = run(fps, [[40, 0, 40]]);
      t.ok(b.w === 0 && Math.abs(b.clock - 40 - PARKOUR.grace) < 0.1, `${fps} fps: no finish from the friend: I win after the grace (${b.clock.toFixed(2)} s)`);
      const c = run(fps, [[31, 1, 30]]);
      t.ok(c.w === 1 && c.clock >= 31 && c.clock < 31.1, `${fps} fps: the friend's time already passed on my clock: the friend wins at once`);
      const d = run(fps, [[50, 0, 50], [50.3, 1, 50.002]]);
      t.ok(d.w === null, `${fps} fps: the same time = a dead heat`);
      const e = run(fps, [[20, 1, 10], [10, 0, 9]]);
      t.ok(e.w === 0, `${fps} fps: my own faster finish stands`);
    }
    const j = new RaceJudge(); j.set(0, 30); j.set(0, 10); j.set(1, -3); j.set(1, NaN);
    t.ok(j.times[0] === 30 && j.times[1] === null, 'a time is kept once; junk times are ignored');
  }

  /* ------------------------------------------------ race (two browsers) ------------------------------------------------ */
  if (want('race')) {
    const [A, B] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(B, 1); await pause(B);
    await share(A, B);
    await standAt(A, 0); await standAt(B, 4);
    await A.waitForTimeout(1500);
    // the friend menu
    await openMenu(A);
    const m = await menu(A), row = m.find(x => x.id === 'parkour');
    t.ok(row && row.word === 'Parkour race' && !row.dim && /Obstacle Course/.test(row.sub), `the friend menu has "Parkour race" in the main world (${m.map(x => x.word).join('|')}; "${row?.sub}")`);
    await shot(A, 'parkour-menu.png');
    await A.evaluate(() => window.pokecraft.closeFriend());
    const saved0 = [await saved(A), await saved(B)];
    const far = await A.evaluate(() => { const g = window.pokecraft, c = g.gymLive.of('parkour').gym; return Math.hypot(g.player.pos.x - c.x, g.player.pos.z - c.z); });

    await slowCount(A, 40); await slowCount(B, 40); // a long 3-2-1 for the real keys below
    const ask = await invite(A, B, 'parkour');
    t.ok(/Dad wants a Parkour race! First to the top of the Obstacle Course wins\./.test(ask), `Kid is asked ("${ask}")`);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info?.phase === 'count'), 'yes: both are in the count');
    const s0 = [await onSpot(A), await onSpot(B)];
    t.ok(s0[0].side === 0 && s0[1].side === 1 && s0.every(s => s.d < 0.01 && s.dy < 0.6 && s.race) && Math.abs(Math.hypot(s0[0].x - s0[1].x, s0[0].z - s0[1].z) - 3) < 0.01,
      `both puffed onto the start platform from ${far.toFixed(0)} blocks away, side by side (Dad side 0, Kid side 1)`);
    t.ok(await heard(A, /A Parkour race with Kid!/) && await heard(B, /A Parkour race with Dad!/), 'both hear the start');
    t.ok(await waitFor(A, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a?.here && a.inGame && (!a.lead || !a.lead.visible); }), 'no lead creature behind the friend in the race');
    // real keys: W does nothing while counting
    await A.mouse.click(550, 300);
    t.ok(await waitFor(A, () => window.pokecraft.playing(), null, 8000), 'Dad is back in the game (the mouse is caught)');
    const x0 = await onSpot(A);
    await A.keyboard.down('KeyW');
    await A.waitForTimeout(2500);
    const x1 = await onSpot(A);
    await A.keyboard.up('KeyW');
    t.ok(x1.d < 0.01 && (await info(A)).phase === 'count', `real keys: W does nothing during 3-2-1 (${x0.d.toFixed(3)} -> ${x1.d.toFixed(3)})`);
    await shot(A, 'parkour-count.png');
    // Go: the course starts over on both screens
    await A.evaluate(() => { const c = window.pokecraft.gymLive.of('parkour'); c.crumbleAt.set('C1', c.clock); c.clock += 50; }); // (left over from before: Go clears it)
    await goNow(A); await goNow(B);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info?.phase === 'race') && await heard(A, /GO! 🏃/) && await heard(B, /GO! 🏃/), 'GO! on both screens');
    const go = await Promise.all([A, B].map(p => p.evaluate(() => { const c = window.pokecraft.gymLive.of('parkour'); return { clock: c.clock, crumbles: c.crumbleAt.size, reached: c.reached, lit: c.lit }; })));
    t.ok(go.every(g => g.clock < 3 && g.crumbles === 0 && g.reached === 0 && g.lit === 0), `Go: the course clock started at 0, crumbles whole, flags off on both (${JSON.stringify(go)})`);
    // real keys: walk off the start platform into the gap: a fall sends you back to the start
    await A.evaluate(() => { window.__toasts.length = 0; });
    await A.keyboard.down('KeyW');
    const fell = await waitFor(A, () => window.pokecraft.gymLive.of('parkour').falls >= 1, null, 90000);
    await A.keyboard.up('KeyW');
    const back = await A.evaluate(() => { const g = window.pokecraft, cp = g.gymLive.of('parkour').gym.checkpoints[0], p = g.player.pos; return Math.hypot(p.x - cp.stand[0], p.z - cp.stand[2]); });
    t.ok(fell && await said(A, /Boing! Back to the start\./) && back < 0.6 && (await info(A)).phase === 'race', `real keys: Dad runs off the start, falls on the mat and is puffed back to the start flag (${back.toFixed(2)} from it); still racing`);
    // flags and the chip
    await toFlag(A, 1);
    t.ok(await flagIs(A, 1) && await heard(A, /🚩 Flag 1! Keep going!/), 'Dad reaches flag 1: "Flag 1! Keep going!"');
    t.ok(!(await said(A, /wants to battle you/)), 'no "Runner Remy wants to battle you!" in a race');
    t.ok(await waitFor(B, () => window.pokecraft.friendGames.play.theirFlag === 1 && /You're 2nd!/.test(window.pokecraft.friendGames.play.chip().phase)), 'Kid\'s chip: "You\'re 2nd!"');
    t.ok(/You're 1st!/.test((await A.evaluate(() => window.pokecraft.friendGames.play.chip().phase))), 'Dad\'s chip: "You\'re 1st!"');
    const arrow = await A.evaluate(() => { const g = window.pokecraft, a = g.friendGames.aim(g.player.pos), cp = g.gymLive.of('parkour').gym.checkpoints[2]; return { ok: a && a.x === cp.stand[0] && a.z === cp.stand[2], text: a?.text('↗', 12) }; });
    t.ok(arrow.ok && /Flag 2!/.test(arrow.text), `the guide arrow points at the next flag ("${arrow.text}")`);
    // the trainers step aside: E on Runner Remy and walking into him start nothing
    const remy = await A.evaluate(() => { const g = window.pokecraft, n = g.npcs.list.find(q => q.kind === 'trainer' && q.gym?.def.id === 'parkour' && (q.index || 0) === 0);
      g.player.lookAt(n.pos.clone().setY(n.pos.y + 1.5)); return !!n; });
    await A.waitForTimeout(1500);
    const prompt = await A.evaluate(() => document.getElementById('prompt')?.textContent || window.pokecraft.ui.promptEl.textContent);
    await A.keyboard.press('KeyE');
    await A.waitForTimeout(1500);
    t.ok(remy && !/challenge|Remy/.test(prompt) && !(await A.evaluate(() => window.pokecraft.inBattle || window.pokecraft.ui.asking)), `E at Runner Remy during a race does nothing (prompt "${prompt}")`);
    await A.evaluate(() => { const g = window.pokecraft, n = g.npcs.list.find(q => q.kind === 'trainer' && q.gym?.def.id === 'parkour' && (q.index || 0) === 0); g.player.pos.set(n.pos.x + 0.6, n.pos.y, n.pos.z); g.player.vel.set(0, 0, 0); });
    await A.keyboard.down('KeyA'); await A.waitForTimeout(1500); await A.keyboard.up('KeyA');
    t.ok(!(await A.evaluate(() => window.pokecraft.inBattle)) && (await info(A)).phase === 'race', 'walking into Runner Remy starts no battle either');
    // Kid is behind; Dad gets to the top first
    await toFlag(B, 1); await flagIs(B, 1);
    await toFlag(A, 2); await flagIs(A, 2);
    await toFlag(A, 3);
    t.ok(await flagIs(A, 3) && await heard(A, /🏁 You made it to the top in/), 'Dad reaches the top flag: his own time');
    t.ok(await heard(A, /🏁 Dad wins the Parkour race/) && await heard(B, /🏁 Dad wins the Parkour race/), 'both hear "Dad wins the Parkour race!"');
    const res = [await info(A), await info(B)];
    t.ok(res.every(r => r.result === 0 && r.times[0] > 0 && r.times[1] === null), `the same result on both screens (Dad ${res[0].times[0]?.toFixed(1)} s)`);
    await shot(B, 'parkour-result.png');
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active, null, 30000), 'a moment to cheer, then the game is over for both');
    t.ok(await said(A, /You won the Parkour race! Good game!/) && await said(B, /Good race! Try again\?/), 'Dad: "You won the Parkour race! Good game!", Kid: "Good race! Try again?"');
    const after = await Promise.all([A, B].map(p => p.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return { race: !!g.gymLive.of('parkour').race, inGame: a?.inGame }; })));
    t.ok(after.every(a => !a.race && !a.inGame), 'both back to normal: the course has no race, the friend\'s lead creature is back');
    t.ok((await saved(A)) === saved0[0] && (await saved(B)) === saved0[1], 'nothing was saved by the race');

    // a second race, asked by Kid; Kid walks out of the course: the race is over for both
    await pause(A);
    await A.evaluate(() => { window.__toasts.length = 0; }); await B.evaluate(() => { window.__toasts.length = 0; });
    await standAt(A, 0); await standAt(B, 4);
    await both(A, B, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return a?.here && a.pos.distanceTo(g.player.pos) < 8 && !g.friendGames.busy; });
    await invite(B, A, 'parkour');
    const go2 = await both(A, B, () => window.pokecraft.friendGames.state().info?.phase === 'race', null, 40000);
    if (!go2) console.log('  toasts:', JSON.stringify(await A.evaluate(() => window.__toasts)), JSON.stringify(await B.evaluate(() => [window.__toasts, window.pokecraft.friendGames.state()])));
    t.ok(go2, 'a second race, asked by Kid: GO');
    t.ok((await onSpot(B)).side === 0, 'Kid asked, so Kid leads (side 0)');
    t.ok(await said(A, /^3$/) && await said(A, /^2$/) && await said(A, /^1$/) && await said(B, /^1$/), 'the real count: "3", "2", "1", then GO');
    await B.evaluate(() => { const g = window.pokecraft, a = g.gymLive.of('parkour').gym.area; g.player.pos.set(a.x1 + 4.5, g.player.pos.y, a.z0 + 3.5); });
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active) && await heard(B, /You left the Obstacle Course, so the race is over\./) && await heard(A, /Kid stopped the game\./),
      'Kid walks out of the Obstacle Course: the race is over for both, with words');
    t.ok(!(await said(B, /Next time you start from the beginning/)), 'and no "You left the Obstacle Course. Next time..." on top');
    t.ok(!A.errors.length && !B.errors.length, `race: no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
    await A.context().close(); await B.context().close();
  }

  /* ------------------------------------------------ ipad ------------------------------------------------ */
  if (want('ipad')) {
    const [TA, TB] = await openPair(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
    for (const p of [TA, TB]) { await p.tap('text=New Game', { timeout: 120000 }); await p.tap('.starter >> nth=0', { timeout: 120000 }); await p.waitForTimeout(1500); }
    await TA.evaluate(async () => { await window.pokecraft.mp.host('Dad'); });
    const code = await TA.evaluate(() => window.pokecraft.mp.code);
    await TB.evaluate(async code => { await window.pokecraft.mp.join(code, 'Kid'); }, code);
    await waitFor(TA, () => window.pokecraft.mp.others.size === 1); await waitFor(TB, () => window.pokecraft.mp.others.size === 1);
    await listen(TA); await listen(TB);
    await TA.evaluate(() => window.pokecraft.touch.reset());
    await standAt(TA, 0); await standAt(TB, 3);
    await TA.waitForTimeout(2000);
    await slowCount(TA, 40); await slowCount(TB, 40);
    await openMenu(TA);
    await TA.tap('#friend [data-friend="parkour"]');
    t.ok(await waitFor(TB, () => !document.getElementById('ask').classList.contains('hidden') && /wants a Parkour race/.test(document.getElementById('ask-text').textContent)), 'iPad: a tap on Parkour race asks the friend');
    await TB.tap('#ask-yes');
    t.ok(await both(TA, TB, () => window.pokecraft.friendGames.state().info?.phase === 'count'), 'iPad: a tap on "Let\'s play!" starts the count');
    // the Jump button during the count: a hop on the spot, never off it
    await TB.tap('#btn-jump');
    await TB.waitForTimeout(1500);
    const j = await onSpot(TB);
    t.ok(j.d < 0.01, `iPad: Jump during the count stays on the spot (${j.d.toFixed(3)})`);
    const ride = await TB.evaluate(() => window.pokecraft.friendGames.noRide);
    t.ok(/No riding in a Parkour race/.test(ride), `iPad: no riding in a race ("${ride}")`);
    await goNow(TA); await goNow(TB);
    t.ok(await both(TA, TB, () => window.pokecraft.friendGames.state().info?.phase === 'race'), 'iPad: GO');
    await shot(TB, 'parkour-ipad.png');
    for (const k of [1, 2, 3]) { await toFlag(TB, k); await flagIs(TB, k); }
    t.ok(await heard(TA, /🏁 Kid wins the Parkour race/) && await heard(TB, /🏁 Kid wins the Parkour race/), 'iPad: Kid (the friend) gets to the top first: both hear it');
    t.ok(await both(TA, TB, () => !window.pokecraft.friendGames.active, null, 30000) && await said(TB, /You won the Parkour race! Good game!/), 'iPad: then the game is over; Kid hears "You won"');
    t.ok(!TA.errors.length && !TB.errors.length, `ipad: no page errors (${[...TA.errors, ...TB.errors].slice(0, 2).join(' / ')})`);
    await TA.context().close(); await TB.context().close();
  }

  /* ------------------------------------------------ trip (from the Swirl and back) ------------------------------------------------ */
  if (want('trip')) {
    const [A, B] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(B, 1); await pause(B);
    await share(A, B);
    const placeIs = (page, id, ms = 180000) => waitFor(page, i => window.pokecraft.place === i && !window.pokecraft.realms.busy, id, ms);
    const where = page => page.evaluate(() => { const g = window.pokecraft, p = g.player; return [g.place, p.pos.x, p.pos.y, p.pos.z, p.yaw]; });
    const same = (a, b) => a[0] === b[0] && Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]) < 0.3 && Math.abs(a[4] - b[4]) < 0.01;
    await A.evaluate(() => { const g = window.pokecraft; g.champion = true; g.mp.sendState(); });
    t.ok(await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === true), 'the guest\'s game knows the host is a Champion');
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(B, 'swirl');
    await B.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; g.player.pos.set(a.target.x + 1.5, a.target.y, a.target.z); });
    await both(A, B, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return a?.here && a.pos.distanceTo(g.player.pos) < 6; });
    await openMenu(A);
    const m = await menu(A), row = m.find(x => x.id === 'parkour');
    t.ok(row && !row.dim && row.sub === 'You both go to the Obstacle Course and back.', `in the Swirl: "Parkour race" with "${row?.sub}"`);
    await A.evaluate(() => window.pokecraft.closeFriend());
    const sw0 = [await where(A), await where(B)];
    const ask = await invite(A, B, 'parkour');
    t.ok(/You both go to the Obstacle Course and back\./.test(ask), `Kid is asked, with where it goes ("${ask}")`);
    t.ok(await placeIs(A, 'main') && await placeIs(B, 'main'), 'both go home to the main world');
    t.ok(await both(A, B, () => !!window.pokecraft.friendGames.state().info?.race, null, 60000), 'the race starts there');
    const s = [await onSpot(A), await onSpot(B)];
    t.ok(s.every(q => q.d < 0.01 && q.race), 'both on their start spots on the Obstacle Course');
    await A.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await placeIs(A, 'swirl') && await placeIs(B, 'swirl') && await both(A, B, () => !window.pokecraft.friendGames.tripping && !window.pokecraft.friendGames.active), 'Stop: both are back in the Swirl');
    const sw1 = [await where(A), await where(B)];
    t.ok(same(sw0[0], sw1[0]) && same(sw0[1], sw1[1]), 'on the very spots they stood on in the Swirl');
    t.ok(!A.errors.length && !B.errors.length, `trip: no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
    await A.context().close(); await B.context().close();
  }
}
