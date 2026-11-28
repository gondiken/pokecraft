// The Joust for two (owner 2026-11-28): two friends ride at each other in the Castle's Tilt Yard and aim at the gold spot on the other's shield.
//   rules : Node: the pure Rider (src/joustduelrules.js) gives the same tip at 60 and 20 frames a second; the spot = the single-player spots /
//           ellipse + the owner's lean; model players (tests/joustduelbots.mjs): still / random / mashing lose to a skilled rider at 60 and 20
//           fps, a child who aims where the spot IS loses to one who leads it; then the REAL JoustDuel twice joined by a line with a delay and
//           lost messages (tests/castleduelnode.mjs): both computers agree on every pass and on the winner; joust.js unchanged
//   play  : two browsers in the Castle: the menu row (dim with its line while the host is no Champion, asking refused), ask, yes, both on
//           their horses at opposite ends, the Castle's helpers and Sir Splinter step aside, real keys and the mouse move the lance tip,
//           Jump does not get off, a hit by each side, to the end, both hear the winner, back where they stood, nothing saved
//   trip  : asked in the main world by a Champion host: both land in the Castle, joust, and are back on the very spot they stood on
//   ipad  : two iPads, asked from the main world with taps: the joystick and a drag move the tip, the Jump button keeps you on, Stop, home
// JOUST_ONLY=rules|play|trip|ipad
import { devices } from 'playwright';
import { openPair, newGame, click, pause } from '../helpers.mjs';

const only = process.env.JOUST_ONLY;
const want = part => !only || only.split(',').includes(part);
const veil = (page, on) => page.evaluate(on => { const e = document.getElementById('pause'); if (e) e.style.visibility = on ? 'hidden' : ''; }, on).catch(() => {});
const shot = async (page, name) => { await veil(page, true); await page.waitForTimeout(1200); await page.screenshot({ path: new URL(`../screenshots/${name}`, import.meta.url).pathname, timeout: 120000 }).then(() => console.log(`  screenshot ${name}`)).catch(() => {}); await veil(page, false); };
const src = f => import(new URL(`../../src/${f}`, import.meta.url).href);
async function waitFor(page, fn, arg, ms = 60000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }); return true; } catch { return false; }
}
const heard = (page, re, ms = 30000) => waitFor(page, r => (window.__toasts || []).some(m => new RegExp(r).test(m)), re.source, ms);
const listen = page => page.evaluate(() => {
  const g = window.pokecraft;
  if (window.__toasts) return;
  window.__toasts = [];
  const f = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...r) => { window.__toasts.push(m); return f(m, ...r); };
});
const both = async (A, B, fn, arg, ms) => (await waitFor(A, fn, arg, ms)) && (await waitFor(B, fn, arg, ms));
const info = page => page.evaluate(() => window.pokecraft.friendGames.state().info);
const placeIs = (page, id, ms = 180000) => waitFor(page, i => window.pokecraft.place === i && !window.pokecraft.realms.busy, id, ms);
const standAt = (page, dx, dz = 0) => page.evaluate(([dx, dz]) => {
  const g = window.pokecraft, s = g.spawnPoint, y = 42;
  let cx = Math.floor(s.x) + dx, cz = Math.floor(s.z) + dz;
  const ok = (cx, cz) => { for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (!g.world.editAllowed(cx + x, y, cz + z, 3)) return false; return true; };
  for (let k = 0; k < 40 && !ok(cx, cz); k++) cx += 8;
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.world.set(cx + x, y, cz + z, 3);
  g.player.pos.set(cx + 0.5, y + 1, cz + 0.5); g.player.vel.set(0, 0, 0);
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
const menu = page => page.evaluate(() => [...document.querySelectorAll('#friend .fm-btn')].map(b => ({ id: b.dataset.friend, word: b.querySelector('b').textContent, dim: b.classList.contains('dim'), sub: b.querySelector('small')?.textContent || '' })));
async function invite(from, to, id, yes = true) {
  await openMenu(from);
  await waitFor(from, id => !!document.querySelector(`#friend [data-friend="${id}"]`), id, 8000);
  await click(from, `#friend [data-friend="${id}"]`);
  const asked = await waitFor(to, () => !document.getElementById('ask').classList.contains('hidden'));
  const text = await to.evaluate(() => document.getElementById('ask-text').textContent);
  if (yes) await to.evaluate(() => window.pokecraft.ui.askYes());
  return asked ? text : '';
}
// The model players of joustduelbots.mjs steer each page's lance (window.__bot = a bot name, or null for the real keys / stick)
const arm = page => page.evaluate(async () => {
  const Bots = await import('/tests/joustduelbots.mjs'), fg = window.pokecraft.friendGames;
  window.__bot = window.__bot ?? null; window.__made = window.__made || {};
  if (window.__armed) return; window.__armed = true;
  const up = fg.update.bind(fg);
  fg.update = () => {
    const play = fg.play;
    if (play && !play.__wrapped && play.rider !== undefined) {
      play.__wrapped = true;
      const pu = play.update.bind(play);
      play.update = dt => {
        const n = window.__bot;
        if (n && play.phase === 'pass' && play.rider && !play.rider.met) { window.__made[n] ||= Bots.JDUEL_BOTS[n](); play.input = window.__made[n](play.rider, play.plan, play.side, { friendTip: play.friendTip, dt }); } else play.input = null;
        pu(dt);
      };
    }
    up();
  };
});
const setBot = (page, n) => page.evaluate(n => { window.__bot = n; window.__made = {}; }, n);
const savedOf = page => page.evaluate(() => JSON.stringify([window.pokecraft.beaten, window.pokecraft.cubes, window.pokecraft.stars, window.pokecraft.bossWins]));
const fakeLock = page => page.evaluate(() => {
  if (window.__fake) return; window.__fake = true;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get() { return window.__lock ? document.getElementById('game') : null; } });
  const change = on => { window.__lock = on; setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0); };
  HTMLCanvasElement.prototype.requestPointerLock = function () { change(true); return Promise.resolve(); };
  Document.prototype.exitPointerLock = function () { change(false); };
});
// Both friends into the Castle (through the Swirl's frame), standing side by side in front of the way back
export async function intoCastle(A, B) {
  for (const P of [A, B]) await P.evaluate(() => { const g = window.pokecraft; g.champion = true; g.weather?.set?.('clear'); });
  await A.evaluate(() => window.pokecraft.mp.sendState?.());
  await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
  await placeIs(A, 'swirl');
  await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(B, 'swirl');
  const cell = await A.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'castle'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(A, 'castle');
  await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
  const ok = await placeIs(B, 'castle');
  await A.evaluate(() => { const p = window.pokecraft.player; p.pos.set(78.5, 11, 146.5); p.vel.set(0, 0, 0); p.yaw = 0; });
  await B.evaluate(() => { const p = window.pokecraft.player; p.pos.set(82.5, 11, 146.5); p.vel.set(0, 0, 0); p.yaw = 0; });
  await both(A, B, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return a?.here && a.pos.distanceTo(g.player.pos) < 6; });
  return ok;
}

// (shared with friend-shield.mjs)
export const H = { waitFor, heard, listen, both, info, placeIs, standAt, share, openMenu, menu, invite, savedOf, fakeLock, shot, intoCastle };

export default async function ({ browser, base, t }) {
  /* ------------------------------------------------ rules (Node) ------------------------------------------------ */
  if (want('rules')) {
    const R = await src('joustduelrules.js'), J = await src('joust.js');
    const { JDUEL_BOTS, playJoustDuel } = await import('../joustduelbots.mjs');
    const D = R.DUEL_JOUST;
    // the meeting is in the middle of the lane; the two horses meet there at the same pass time
    t.ok(Math.abs(R.rodeAt(D.meet) - D.len / 2) < 1e-9 && R.rodeAt(99) === D.len && R.dirOf(0, 1) === 1 && R.dirOf(1, 1) === -1 && R.dirOf(0, 2) === -1, `both gallop to the middle of the lane at the meeting (${D.meet} s), then on to the far end; they turn each pass`);
    const p1 = R.passPlan(7, 1), p3 = R.passPlan(7, 3), p5 = R.passPlan(7, 5);
    t.ok(JSON.stringify(p1) === JSON.stringify(R.passPlan(7, 1)) && p1.level === 0 && p3.level === 1 && p5.level === 2 && J.JOUST.spots.some(s => s[0] === p1.spots[0].spot[0] && s[1] === p1.spots[0].spot[1]),
      'a pass plan is the same on both computers; passes 1-2 a still spot (the single-player spots), 3-4 sliding, 5 on faster');
    const s0 = R.spotAt(p3, 1, 1.2, [0, 0]), s1 = R.spotAt(p3, 1, 1.2, [0.4, -0.4]);
    t.ok(Math.abs(s1[0] - s0[0] - 0.4 * D.lean) < 1e-12 && Math.abs(s1[1] - s0[1] + 0.4 * D.lean) < 1e-12 && Math.hypot(...s0) > 0.4, `your shield follows your lance a little (lean ${D.lean}): the spot moves with its owner's aim`);
    // 60 and 20 frames a second: the same tip (inputs that change every 1/20 s)
    const script = tt => { const g = Math.floor(tt * 20 + 1e-6) / 20; return { su: Math.sin(g * 2.1), sv: Math.cos(g * 1.3) }; };
    const tipAt = fps => { const r = new R.Rider(p3, 0); let meet = null; for (let i = 0; i < 7 * fps && !r.ended; i++) for (const e of r.update(1 / fps, script(i / fps))) if (e.type === 'meet') meet = e.tip; return meet.map(x => x.toFixed(12)).join(); };
    t.ok(tipAt(60) === tipAt(20), `60 and 20 frames a second: the same tip at the meeting (${tipAt(60)})`);
    // the result: a tip on the spot (with the bob) is a hit
    const spot = R.spotAt(p1, 1, p1.meet, [0, 0]), bob = R.bobOf(p1, 0, p1.meet);
    t.ok(R.lanceResult(p1, 0, [spot[0] - bob[0], spot[1] - bob[1]], [0, 0]).kind === 'hit' && R.lanceResult(p1, 0, [-spot[0], -spot[1]], [0, 0]).kind !== 'hit', 'a tip on the gold spot at the meeting is a Hit; the other side of the shield is not');
    // the model players
    for (const fps of [60, 20]) {
      const rows = [];
      for (const naive of ['still', 'random', 'masher', 'kid']) {
        let w = 0, l = 0;
        for (let seed = 1; seed <= 10; seed++) {
          const a = playJoustDuel([JDUEL_BOTS.skilled(), JDUEL_BOTS[naive](seed)], { fps, seed, lag: 0.2 }), b = playJoustDuel([JDUEL_BOTS[naive](seed), JDUEL_BOTS.skilled()], { fps, seed, lag: 0.2 });
          w += (a.winner === 0) + (b.winner === 1); l += (a.winner === 1) + (b.winner === 0);
        }
        rows.push(`${naive} ${w}-${l}`);
        t.ok(w === 20 && l === 0, `${fps} fps: a skilled rider beats ${naive === 'kid' ? 'a child who aims where the spot IS' : `a ${naive} lance`} in all 20 games, at either end`);
      }
      console.log(`  ${fps} fps, skilled vs: ${rows.join(' | ')}`);
    }
    const ss = playJoustDuel([JDUEL_BOTS.skilled(), JDUEL_BOTS.skilled()], { fps: 60, seed: 3, lag: 0.2 });
    t.ok(ss.winner === 'draw' && ss.passes === D.maxPasses, `two skilled riders hit every pass: a draw after ${D.maxPasses} passes (${ss.score.join(':')})`);
    t.ok(J.JOUST.meet.join() === '3.4,3,2.6' && J.JOUST.r.join() === '0.32,0.28,0.26' && J.JOUST.passes === 4, 'the single-player Joust is as it was');
    // two computers with a line in between: the real JoustDuel twice
    const { joustPair } = await import('../castleduelnode.mjs');
    for (const [fps, lag] of [[60, 0.15], [20, 0.3]]) {
      const w = await joustPair({ bots: ['skilled', 'still'], fps, lag }), w2 = await joustPair({ bots: ['random', 'skilled'], fps, lag });
      t.ok(w.results.every(r => /Dad wins 3 : 0/.test(r)) && w.scores.every(s => s === '3,0') && w2.results.every(r => /Kid wins 3 : [01]/.test(r)) && w2.results[0] === w2.results[1] && w.passes[0] === w.passes[1] && w2.passes[0] === w2.passes[1],
        `${fps} fps, a ${lag} s line: both computers agree on every pass and on the winner (${w.results[1]} / ${w2.results[0]})`);
      const k = await joustPair({ bots: ['kid', 'skilled'], fps, lag });
      t.ok(k.results.every(r => /Kid wins 3 : [0-2]/.test(r)) && k.scores[0] === k.scores[1], `${fps} fps, a ${lag} s line: leading the spot beats a child who aims where it is (${k.results[0]})`);
    }
    const lossy = await joustPair({ bots: ['skilled', 'masher'], fps: 30, lag: 0.2, drop: 0.25 });
    t.ok(lossy.results.every(r => /Dad wins 3 : [01]/.test(r)) && lossy.results[0] === lossy.results[1] && lossy.passes[0] === lossy.passes[1] && lossy.lost > 10, `a quarter of the messages lost: the tips, the words and the heartbeat still bring both to the same end (${lossy.lost} lost, ${lossy.results[1]})`);
    t.ok(lossy.players.every(q => q.carry === null && Math.abs(q.pos.z - 140) < 1e-9), 'at the end both are put down where they stood');
  }

  /* ------------------------------------------------ play (two browsers in the Castle) ------------------------------------------------ */
  if (want('play')) {
    const [A, B] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(B, 1); await pause(B);
    await share(A, B);
    t.ok(await intoCastle(A, B), 'both friends are in the Castle');
    await arm(A); await arm(B);
    const saved0 = await Promise.all([A, B].map(savedOf));
    const at0 = await Promise.all([A, B].map(P => P.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; })));

    // the host is no Champion: the row is dim with its line on both screens, asking is refused
    await A.evaluate(() => { const g = window.pokecraft; g.champion = false; g.mp.sendState(); });
    await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === false);
    for (const [P, who] of [[A, 'Dad'], [B, 'Kid']]) {
      await openMenu(P);
      const row = (await menu(P)).find(x => x.id === 'joust');
      t.ok(row && row.dim && (who === 'Dad' ? /Become the Champion first/.test(row.sub) : /Dad must be the Champion first/.test(row.sub)), `${who}: while the host is no Champion the Joust row is dim and says why ("${row?.sub}")`);
      await P.evaluate(() => window.pokecraft.closeFriend());
    }
    await B.evaluate(() => { const g = window.pokecraft; g.friendGames.invite('joust', [...g.mp.others.values()][0]); });
    t.ok(await heard(B, /Dad must be the Champion first/) && !(await A.evaluate(() => window.pokecraft.ui.asking)), 'asking anyway is refused with the same line; Dad is not asked');
    await A.evaluate(() => { const g = window.pokecraft; g.champion = true; g.mp.sendState(); });
    await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === true);

    await openMenu(A);
    const m = await menu(A), row = m.find(x => x.id === 'joust');
    t.ok(row && !row.dim && row.word === 'Joust' && /First to 3 hits/.test(row.sub), `in the Castle the friend menu has the Joust (${m.map(x => x.word).join('|')}; "${row?.sub}")`);
    await A.evaluate(() => window.pokecraft.closeFriend());
    const ask = await invite(A, B, 'joust');
    t.ok(/Dad wants to joust with you!/.test(ask) && !/You both go/.test(ask), `Kid is asked ("${ask}")`);
    t.ok(await both(A, B, () => !!window.pokecraft.friendGames.state().info?.onHorse), 'both are on their horses');
    const st = await Promise.all([A, B].map(P => P.evaluate(() => {
      const g = window.pokecraft, p = g.player, live = g.gymLive.of('part:castle'), i = g.friendGames.state().info;
      const crew = g.npcs.list.filter(n => n.kind === 'crew' && n.def?.boss === 'castle');
      return { x: p.pos.x, z: p.pos.z, side: i.side, duel: live.duel === g.friendGames.play, near: live.near(p), crew: crew.length, away: crew.every(n => n.away), knight: live.knight.visible, steed: live.steed?.visible, chip: document.getElementById('hs-hud').textContent };
    })));
    t.ok(st[0].side === 0 && Math.abs(st[0].x - 64.5) < 0.01 && Math.abs(st[0].z - 32.5) < 0.01 && st[1].side === 1 && Math.abs(st[1].x - 116.5) < 0.01 && Math.abs(st[1].z - 38.5) < 0.01,
      `Dad (who asked) waits at the west end of his lane, Kid at the east end of the other (Dad ${st[0].x},${st[0].z}; Kid ${st[1].x},${st[1].z})`);
    t.ok(st.every(s => s.duel && s.near === null && s.crew === 2 && s.away && !s.knight && !s.steed), 'the Castle is the game\'s: no Mount! / Shield!, Squire Pip and Archer Wren step aside, Sir Splinter and the castle\'s horse are not drawn');
    t.ok(st.every(s => /🐴 Dad 0 · Kid 0/.test(s.chip)), `the chip: "🐴 Dad 0 · Kid 0" (${st[0].chip})`);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.phase === 'pass' && window.pokecraft.friendGames.state().info.n === 1, null, 60000), 'then Charge!: pass 1 on both screens');

    // real keys and the mouse: D moves the tip to the right, the mouse moves it too; Space does not get off
    for (const [P, who] of [[A, 'Dad'], [B, 'Kid']]) {
      await fakeLock(P);
      await P.evaluate(() => document.getElementById('game').requestPointerLock());
      await waitFor(P, () => !!document.pointerLockElement && document.getElementById('pause').classList.contains('hidden'), null, 20000);
    }
    await both(A, B, () => { const i = window.pokecraft.friendGames.state().info; return i.phase === 'pass' && !i.met && i.tau < 1.5; }, null, 90000);
    for (const P of [A, B]) await P.keyboard.down('KeyD');
    const keyed = await both(A, B, () => { const i = window.pokecraft.friendGames.state().info; return i.met ? (window.__tipAtMeet ??= i.mine[i.n]?.[0]) > 0.2 : i.tip[0] > 0.2; }, null, 30000);
    for (const P of [A, B]) await P.keyboard.up('KeyD');
    t.ok(keyed, 'real D: each lance tip moves to the right on both screens');
    await both(A, B, () => { const i = window.pokecraft.friendGames.state().info; return i.phase === 'pass' && !i.met && i.n >= 2; }, null, 90000);
    const before = await Promise.all([A, B].map(info));
    for (const P of [A, B]) await P.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: -60 })));
    await A.waitForTimeout(300);
    const after = await Promise.all([A, B].map(info));
    t.ok(after.every((a, k) => a.n !== before[k].n || a.met || a.tip[1] > before[k].tip[1] + 0.15), `the mouse moves the tip up (${before.map(b => b.tip?.[1].toFixed(2)).join('/')} -> ${after.map(a => a.tip?.[1].toFixed(2)).join('/')})`);
    for (const P of [A, B]) { await P.keyboard.press('Space'); }
    t.ok(await heard(A, /To stop the game, press Stop/) && await heard(B, /To stop the game, press Stop/) && (await info(A)).onHorse && (await info(B)).onHorse, 'Space keeps you on your horse and says how to stop');
    await shot(A, 'joust-duel-charge.png');
    for (const P of [A, B]) await pause(P);

    // a hit by each side, then to the end
    await setBot(A, 'skilled'); await setBot(B, 'skilled');
    t.ok(await both(A, B, () => { const s = window.pokecraft.friendGames.state().info?.score; return s && s[0] >= 1 && s[1] >= 1; }, null, 240000), 'a hit by each side: both screens count it');
    t.ok(await heard(A, /Pass \d+: Dad Hit! · Kid Hit!/) && await heard(B, /Pass \d+: Dad Hit! · Kid Hit!/), 'both hear "Pass n: Dad Hit! · Kid Hit!"');
    await setBot(B, 'still');
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active, null, 300000), 'to 3 hits: the game is over on both screens');
    t.ok(await heard(A, /🐴 Dad wins 3 : [12]! Good game!/) && await heard(B, /🐴 Dad wins 3 : [12]! Good game!/), 'both hear "🐴 Dad wins 3 : 1! Good game!"');
    const end = await Promise.all([A, B].map(P => P.evaluate(() => {
      const g = window.pokecraft, p = g.player, live = g.gymLive.of('part:castle'), crew = g.npcs.list.filter(n => n.kind === 'crew' && n.def?.boss === 'castle');
      const pp = p.pos.clone(); p.pos.set(76.5, 11, 130.5); const word = live.near(p); p.pos.copy(pp);
      return { carry: !!p.carry, pos: [p.pos.x, p.pos.y, p.pos.z], place: g.place, duel: !!live.duel, crew: crew.every(n => !n.away), knight: live.knight.visible, word, keys: g.beaten.filter(k => /pw:castle:(lance|shield)/.test(k)).length };
    })));
    t.ok(end.every((e, k) => !e.carry && Math.hypot(e.pos[0] - at0[k][0], e.pos[2] - at0[k][2]) < 0.3 && e.place === 'castle' && !e.duel && e.crew && e.knight && e.word === 'Shield!'), 'both are back on foot where they stood, the helpers and Sir Splinter are back, the Shield Stone says Shield! again');
    const saved1 = await Promise.all([A, B].map(savedOf));
    t.ok(saved0[0] === saved1[0] && saved0[1] === saved1[1] && end.every(e => e.keys === 0), 'nothing saved: keys, cubes, stars and Boss wins as before (no lance key)');
    t.ok(!A.errors.length && !B.errors.length, `no page errors ${[...A.errors, ...B.errors].slice(0, 3).join(' | ')}`);
    await A.context().close(); await B.context().close();
  }

  /* ------------------------------------------------ trip (asked in the main world) ------------------------------------------------ */
  if (want('trip')) {
    const [A, B] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(B, 1); await pause(B);
    await share(A, B);
    const where = page => page.evaluate(() => { const g = window.pokecraft, p = g.player; return [g.place, p.pos.x, p.pos.y, p.pos.z, p.yaw]; });
    const same = (a, b) => a[0] === b[0] && Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]) < 0.3 && Math.abs(a[4] - b[4]) < 0.01;
    await standAt(A, 0); await standAt(B, 4, 2);
    await A.evaluate(() => { window.pokecraft.player.yaw = 0.7; }); await B.evaluate(() => { window.pokecraft.player.yaw = -1.1; });
    await A.waitForTimeout(1500);
    await openMenu(A);
    t.ok(!(await menu(A)).some(x => x.id === 'joust'), 'the host is no Champion yet: no Joust in the main world');
    await A.evaluate(() => window.pokecraft.closeFriend());
    await A.evaluate(() => { const g = window.pokecraft; g.champion = true; g.mp.sendState(); });
    await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === true);
    await openMenu(B);
    const row = (await menu(B)).find(x => x.id === 'joust');
    t.ok(row && !row.dim && row.sub === 'You both go to the Castle and back.', `the host is a Champion: the Joust for both, anywhere ("${row?.sub}")`);
    await B.evaluate(() => window.pokecraft.closeFriend());
    const at0 = [await where(A), await where(B)], saved0 = await Promise.all([A, B].map(savedOf));
    const ask = await invite(B, A, 'joust');
    t.ok(/You both go to the Castle and back\./.test(ask), `Dad is asked by Kid, with where it goes ("${ask}")`);
    t.ok(await heard(B, /🐴 Off to the Castle!/) && await placeIs(A, 'castle') && await placeIs(B, 'castle'), 'both go to the Castle (the host first, the guest follows)');
    t.ok(await both(A, B, () => !!window.pokecraft.friendGames.state().info?.onHorse, null, 120000), 'and land on their horses');
    const k = await Promise.all([A, B].map(P => P.evaluate(() => { const g = window.pokecraft; return { z: g.player.pos.z, side: g.friendGames.state().info.side, guest: !!g.realms.stash?.guest }; })));
    t.ok(k[1].side === 0 && Math.abs(k[1].z - 32.5) < 0.01 && k[0].side === 1 && Math.abs(k[0].z - 38.5) < 0.01 && !k[0].guest && k[1].guest, 'Kid (who asked) on the west lane, Dad on the other, in the host\'s Castle');
    await shot(B, 'joust-duel-trip.png');
    await arm(A); await arm(B);
    await setBot(A, 'still'); await setBot(B, 'skilled');
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active, null, 400000) && await heard(A, /Kid wins 3 : 0/), 'a whole joust there: Kid wins 3 : 0');
    t.ok(await placeIs(A, 'main') && await placeIs(B, 'main') && await both(A, B, () => !window.pokecraft.friendGames.state().returning && !window.pokecraft.friendGames.tripping), 'both are back in the main world');
    const at1 = [await where(A), await where(B)];
    t.ok(same(at0[0], at1[0]) && same(at0[1], at1[1]), `on the very spot and facing they had (${JSON.stringify(at0[1].map(x => (typeof x === 'number' ? +x.toFixed(2) : x)))} -> ${JSON.stringify(at1[1].map(x => (typeof x === 'number' ? +x.toFixed(2) : x)))})`);
    const saved1 = await Promise.all([A, B].map(savedOf));
    t.ok(saved0[0] === saved1[0] && saved0[1] === saved1[1], 'nothing saved by the game');
    t.ok(!A.errors.length && !B.errors.length, `no page errors ${[...A.errors, ...B.errors].slice(0, 3).join(' | ')}`);
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
    await TA.evaluate(() => { const g = window.pokecraft; g.touch.reset(); g.champion = true; g.mp.sendState(); });
    await waitFor(TB, () => window.pokecraft.mp.hostAvatar?.champ === true);
    await standAt(TA, 0); await standAt(TB, 3);
    await TA.waitForTimeout(2000);
    const home = await TB.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
    await openMenu(TB);
    await TB.tap('#friend [data-friend="joust"]');
    t.ok(await waitFor(TA, () => !document.getElementById('ask').classList.contains('hidden') && /joust/.test(document.getElementById('ask-text').textContent)), 'iPad: a tap on Joust asks the friend');
    await TA.tap('#ask-yes');
    t.ok(await placeIs(TA, 'castle', 240000) && await placeIs(TB, 'castle', 240000) && await both(TA, TB, () => !!window.pokecraft.friendGames.state().info?.onHorse, null, 120000), 'iPad: both land on their horses in the Castle');
    await waitFor(TA, () => { const i = window.pokecraft.friendGames.state().info; return i.phase === 'pass' && !i.met && i.tau < 1.2; }, null, 90000);
    // the joystick to the right moves the tip right, a drag up moves it up (stepped here, as frames would)
    const I = await TA.evaluate(() => {
      const g = window.pokecraft, p = g.player, pl = g.friendGames.play, u0 = pl.rider.tip[0];
      g.touch.joy = { x: 1, y: 0 }; p.joy = g.touch.joy;
      for (let i = 0; i < 6; i++) { p.update(1 / 30); pl.update(1 / 30); }
      g.touch.joy = null; p.joy = null; p.update(1 / 30);
      const out = { du: pl.rider.tip[0] - u0, v0: pl.rider.tip[1] };
      p.look(0, -80); pl.update(1 / 30); out.dv = pl.rider.tip[1] - out.v0;
      return out;
    });
    t.ok(I.du > 0.15 && I.dv > 0.2, `iPad: the joystick moves the lance tip (${I.du.toFixed(2)}), a drag too (${I.dv.toFixed(2)})`);
    const jump = await TA.evaluate(() => document.getElementById('btn-jump')?.textContent.trim());
    await TA.tap('#btn-jump');
    await TA.waitForTimeout(1500);
    t.ok(await heard(TA, /To stop the game, press Stop/) && (await info(TA)).onHorse, `iPad: the Jump button ("${jump}") keeps you on your horse and says how to stop`);
    await shot(TA, 'joust-duel-ipad.png');
    await TB.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await both(TA, TB, () => !window.pokecraft.friendGames.active), 'iPad: Stop ends it for both');
    t.ok(await placeIs(TA, 'main') && await placeIs(TB, 'main'), 'iPad: both are back in the main world');
    const back = await TB.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
    t.ok(Math.hypot(back[0] - home[0], back[1] - home[1], back[2] - home[2]) < 0.3, 'iPad: back on the very spot');
    t.ok(!TA.errors.length && !TB.errors.length, `no page errors (iPad) ${[...TA.errors, ...TB.errors].slice(0, 3).join(' | ')}`);
    await TA.context().close(); await TB.context().close();
  }
}
