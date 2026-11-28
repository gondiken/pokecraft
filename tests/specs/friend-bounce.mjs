// Bounce-Back for two (owner 2026-11-28, plans/friend-games-next.md section 2): the Mirror Palace's court with a friend in Copycat Cleo's place.
//   rules : Node: the pure DuelCourt (src/bounceduelrules.js) at 60 and 20 frames a second plays the same rally bit for bit; the far end is the
//           near end turned half round; angle in = angle out at both ends; model players (tests/bounceduelbots.mjs): a still "naive kid" loses,
//           two trackers keep the rally going, an aiming player beats a child who follows the ball with its eyes; then the REAL BounceDuel twice,
//           joined by a line with a delay (tests/bounceduelnode.mjs): both computers agree on every point, and two trackers never lose a point
//           to the delay; the single-player BounceRound is unchanged
//   play  : two browsers in the Mirror Palace: the friend menu's Bounce-Back, ask, yes, both on their ends (Dad at the near rail, Kid at Cleo's
//           line facing south), the crew step aside, Play! is gone, real keys and the mouse slide and tilt each mirror (the far one mirrored),
//           Jump does not step off, points by each side, to 3, both hear the winner, back on foot by the plate, the crew back, nothing saved
//   trip  : asked in the main world by a Champion host: both land in the Mirror Palace, play to 3, and are back on the very spot they stood on
//   ipad  : two iPads, asked from the main world with taps: the joystick slides, a drag tilts, the Jump button keeps you on, Stop, back home
// BOUNCE_ONLY=rules|play|trip|ipad
import { devices } from 'playwright';
import { openPair, newGame, click, pause } from '../helpers.mjs';

const only = process.env.BOUNCE_ONLY;
const want = part => !only || only.split(',').includes(part);
const veil = (page, on) => page.evaluate(on => { const e = document.getElementById('pause'); if (e) e.style.visibility = on ? 'hidden' : ''; }, on).catch(() => {});
const shot = async (page, name) => { await veil(page, true); await page.waitForTimeout(1200); await shot0(page, name); await veil(page, false); };
const shot0 = (page, name) => page.screenshot({ path: new URL(`../screenshots/${name}`, import.meta.url).pathname, timeout: 120000 }).then(() => console.log(`  screenshot ${name}`)).catch(() => {});
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
  const cx = Math.floor(s.x) + dx, cz = Math.floor(s.z) + dz;
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
async function invite(from, to, yes = true) {
  await openMenu(from);
  await waitFor(from, () => !!document.querySelector('#friend [data-friend="bounce"]'), null, 8000);
  await click(from, '#friend [data-friend="bounce"]');
  const asked = await waitFor(to, () => !document.getElementById('ask').classList.contains('hidden'));
  const text = await to.evaluate(() => document.getElementById('ask-text').textContent);
  if (yes) await to.evaluate(() => window.pokecraft.ui.askYes());
  return asked ? text : '';
}
// The model players of bounceduelbots.mjs steer each page's mirror (window.__bot = a bot name, or null for the real keys / stick)
const arm = page => page.evaluate(async () => {
  const Bots = await import('/tests/bounceduelbots.mjs'), fg = window.pokecraft.friendGames;
  window.__bot = window.__bot ?? null; window.__made = window.__made || {};
  if (window.__armed) return; window.__armed = true;
  const up = fg.update.bind(fg);
  fg.update = () => {
    const play = fg.play;
    if (play && !play.__wrapped) {
      play.__wrapped = true;
      const pu = play.update.bind(play);
      play.update = dt => {
        const n = window.__bot;
        if (n && play.court) { window.__made[n] ||= Bots.DUEL_BOTS[n](); play.input = window.__made[n](play.court, play.side, Math.min(dt, 1)); } else play.input = null;
        pu(dt);
      };
    }
    up();
  };
});
const setBot = (page, n) => page.evaluate(n => { window.__bot = n; window.__made = {}; }, n);
// Plays points with the bots until the score is `to` on both screens
// Waits until side `who` has `n` points on both screens (prints both games' state when it does not come)
async function playTo(A, B, who, n, ms = 240000) {
  const ok = await both(A, B, ([w, n]) => (window.pokecraft.friendGames.state().info?.score[w] ?? (window.pokecraft.friendGames.active ? -1 : 99)) >= n, [who, n], ms);
  if (!ok) for (const P of [A, B]) console.log('  state:', JSON.stringify(await P.evaluate(() => ({ s: window.pokecraft.friendGames.state(), bot: window.__bot, toasts: (window.__toasts || []).slice(-6) }))));
  return ok;
}
const savedOf = page => page.evaluate(() => JSON.stringify([window.pokecraft.beaten, window.pokecraft.cubes, window.pokecraft.stars, window.pokecraft.bossWins]));
// Pointer lock in the page (for real keys): the game thinks the mouse is caught
const fakeLock = page => page.evaluate(() => {
  if (window.__fake) return; window.__fake = true;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get() { return window.__lock ? document.getElementById('game') : null; } });
  const change = on => { window.__lock = on; setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0); };
  HTMLCanvasElement.prototype.requestPointerLock = function () { change(true); return Promise.resolve(); };
  Document.prototype.exitPointerLock = function () { change(false); };
});

export default async function ({ browser, base, t }) {
  /* ------------------------------------------------ rules (Node) ------------------------------------------------ */
  if (want('rules')) {
    const { DuelCourt, DUEL_RULES, courtU, courtV, toLocal, tiltOf, facingOf, serveOf } = await src('bounceduelrules.js');
    const BB = await src('bounceback.js');
    const { DUEL_BOTS, playDuel } = await import('../bounceduelbots.mjs');
    const R = BB.COURT_RULES;
    // the far end is the near end turned half round
    t.ok(courtU(1, 3) === 13 && courtV(1, 1.5) === 28.5 && courtU(0, 3) === 3 && DUEL_RULES.lines[1] === R.cleoV && DUEL_RULES.lines[0] === R.mirrorV, 'the far player\'s own u 3 is the court\'s 13, its line is Cleo\'s (v 28.5); the near player stands on the single-player rail');
    const l = toLocal(1, { u: 4, v: 20, du: 0.6, dv: 0.8, s: 6 });
    t.ok(l.u === 12 && l.v === 10 && l.du === -0.6 && l.dv === -0.8, 'a ball seen from the far end: u 16 - u, v 30 - v, its way turned round');
    t.ok(Math.abs(tiltOf(0, 0.3) + 0.3) < 1e-9 && Math.abs(tiltOf(1, Math.PI + 0.3) + 0.3) < 1e-9 && Math.abs(facingOf(1, Math.PI)) < 1e-9 && Math.abs(tiltOf(0, 2)) === R.tiltMax,
      'the way you look tilts your mirror the same way at both ends (looking left of straight down the court leans it left), never more than 40 degrees');
    // angle in = angle out at both ends: a ball at the far mirror does exactly what its mirror image does at the near one
    const near = new DuelCourt(), far = new DuelCourt();
    near.ball = { u: 6, v: 2.0, du: 0.3, dv: -Math.sqrt(0.91), s: 6, cool: 0 }; near.phase = 'rally'; near.m[0] = 6; near.tilt[0] = 0.2;
    far.ball = { u: 10, v: 28.0, du: -0.3, dv: Math.sqrt(0.91), s: 6, cool: 0 }; far.phase = 'rally'; far.m[1] = 6; far.tilt[1] = 0.2;
    near.update(0.2); far.update(0.2);
    const a = near.ball, b = toLocal(1, far.ball);
    t.ok(near.hits === 1 && far.hits === 1 && Math.abs(a.u - b.u) < 1e-9 && Math.abs(a.v - b.v) < 1e-9 && Math.abs(a.du - b.du) < 1e-12 && a.dv > 0,
      `a hit at the far end is the mirror image of the same hit at the near end (near u ${a.u.toFixed(3)}, far seen from its end ${b.u.toFixed(3)})`);
    const d = BB.hitDir([0.3, -Math.sqrt(0.91)], 0.2), out = [a.du * near.ball.s, a.dv];
    t.ok(Math.abs(a.du - d[0]) < 1e-12 && Math.abs(a.dv - d[1]) < 1e-12 && near.ball.s > 6, `the same angle in = angle out as the single-player game (bounceback.js hitDir), a little faster after the hit (${near.ball.s.toFixed(2)}) ${out.length}`);
    // both ends are open: past a mirror = out (no back mirror, no goal mouth)
    const open = new DuelCourt({ auto: true }); open.serve(1, 1); open.m[1] = 1; const ev = []; for (let i = 0; i < 8 * 60; i++) ev.push(...open.update(1 / 60, [null, { slide: -1, tilt: 0 }]));
    t.ok(ev.some(e => e.type === 'miss' && e.side === 1) && open.score[0] >= 1 && open.score[1] === 0 && !ev.some(e => e.where === 'wall' && open.ball && open.ball.v > 29), 'a ball past the far mirror is out (the far end does not bounce): a point for the near player');
    t.ok(serveOf(4, 0).dv < 0 && serveOf(4, 1).dv > 0 && serveOf(4, 1).u === 8 && serveOf(4, 1).v === 15 && JSON.stringify(serveOf(5, 1)) === JSON.stringify(serveOf(5, 1)), 'a serve starts in the middle and goes to the one who lost the point, the same on both computers');
    // 60 and 20 frames a second: the same rally, bit for bit (inputs that change every 1/20 s)
    const script = (tt, side) => { const g = Math.floor(tt * 20 + 1e-6) / 20; return { slide: Math.sin(g * 1.3 + side), tilt: R.tiltMax * Math.sin(g * 0.7 + side * 2) }; };
    const trace = fps => { const c = new DuelCourt({ auto: true }), ev = []; for (let i = 0; i < 60 * fps; i++) for (const e of c.update(1 / fps, [script(i / fps, 0), script(i / fps, 1)])) if (e.type !== 'bounce') ev.push(e.type + (e.side ?? '')); return { ev: ev.join(), score: c.score.join(), m: c.m.map(x => x.toFixed(6)).join(), ball: c.ball && c.ball.u.toFixed(9) }; };
    const t60 = trace(60), t20 = trace(20);
    t.ok(JSON.stringify(t60) === JSON.stringify(t20) && t60.ev.length > 10, `60 and 20 frames a second give the same rally (${t60.ev.split(',').length} events, score ${t60.score})`);
    // the model players
    for (const fps of [60, 20]) {
      const s1 = playDuel([DUEL_BOTS.tracker(), DUEL_BOTS.still()], { fps }), s2 = playDuel([DUEL_BOTS.still(), DUEL_BOTS.tracker()], { fps });
      t.ok(s1.winner === 0 && s1.score.join() === '3,0' && s2.winner === 1 && s2.score.join() === '0,3', `${fps} fps: a still "naive kid" loses every point, at either end (${s1.score.join(':')}, ${s2.score.join(':')})`);
      const tt = playDuel([DUEL_BOTS.tracker(), DUEL_BOTS.tracker()], { fps, budget: 120 });
      t.ok(tt.score.join() === '0,0' && tt.hits >= 30, `${fps} fps: two players who slide under every ball keep the rally going (${tt.hits} hits in 120 s, no point)`);
      const ak = playDuel([DUEL_BOTS.angler(), DUEL_BOTS.kid()], { fps }), ka = playDuel([DUEL_BOTS.kid(), DUEL_BOTS.angler()], { fps });
      const tk = playDuel([DUEL_BOTS.tracker(), DUEL_BOTS.kid()], { fps, budget: 120 });
      t.ok(ak.winner === 0 && ka.winner === 1 && tk.score.join() === '0,0', `${fps} fps: easy to get, hard to master: a player who angles the mirror beats a child who follows the ball with its eyes (${ak.score.join(':')} in ${ak.time} s, ${ka.score.join(':')}); sending it straight back never does (${tk.score.join(':')})`);
    }
    // the single-player game is untouched (the same numbers mirror.mjs checks)
    const cr = new BB.BounceRound(7, 0, 0); for (let i = 0; i < 600; i++) cr.update(1 / 60, { slide: 0.3, tilt: 0.2 });
    t.ok(R.speedUp === 1.03 && R.speedCap === 1.3 && R.rounds[0].ball === 6 && cr.time > 9.99 && !cr.done, 'BounceRound and COURT_RULES are as they were (the duel has its own speed-up)');
    // two computers with a line in between: the real BounceDuel twice
    const { duelPair } = await import('../bounceduelnode.mjs');
    for (const [fps, lag] of [[60, 0.15], [20, 0.3]]) {
      const w = await duelPair({ bots: ['tracker', 'dodge'], fps, lag }), w2 = await duelPair({ bots: ['dodge', 'tracker'], fps, lag });
      t.ok(w.results.every(r => /Dad wins 3 : 0/.test(r)) && w.scores.every(s => s === '3,0') && w2.results.every(r => /Kid wins 3 : 0/.test(r)) && w2.scores.every(s => s === '0,3'),
        `${fps} fps, a ${lag} s line: both computers agree on every point and on the winner (the friend's misses are claimed and counted by the leader; ${w.results[1]} / ${w2.results[0]})`);
      const tt = await duelPair({ bots: ['tracker', 'tracker'], fps, lag, budget: 90 });
      t.ok(tt.scores.every(s => s === '0,0') && tt.trace.hits[0] >= 10 && tt.trace.hits[1] >= 10 && tt.info.every(i => i.applied > 5),
        `${fps} fps, a ${lag} s line: two trackers never lose a point to the delay: each computer judges only its own mirror (${tt.trace.hits.join(' / ')} hits, ${tt.info.map(i => i.guesses).join(' / ')} guesses put right by ${tt.info.map(i => i.applied).join(' / ')} states)`);
      const ak = await duelPair({ bots: ['kid', 'angler'], fps, lag });
      t.ok(ak.scores.every(s => s === '0,3') && ak.results.every(r => /Kid wins/.test(r)), `${fps} fps, a ${lag} s line: the aiming player wins on both screens (${ak.scores[0]})`);
    }
    const lossy = await duelPair({ bots: ['tracker', 'dodge'], fps: 30, lag: 0.2, drop: 0.25 });
    t.ok(lossy.scores.every(s => s === '3,0') && lossy.results.every(r => /Dad wins 3 : 0/.test(r)) && lossy.lost > 10, `a quarter of the messages lost: the claims, serves and the heartbeat still bring both to the same end (${lossy.lost} lost, ${lossy.results[1]})`);
    const p = lossy.players;
    t.ok(p.every(q => q.carry === null) && Math.abs(p[0].pos.z - 120.6) < 1e-9 && Math.abs(p[1].pos.z - 120.6) < 1e-9, 'at the end both are put down on foot in front of the court');
  }

  /* ------------------------------------------------ play (two browsers in the palace) ------------------------------------------------ */
  if (want('play')) {
    const [A, B] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(B, 1); await pause(B);
    await share(A, B);
    for (const P of [A, B]) await P.evaluate(() => { const g = window.pokecraft; g.champion = true; g.weather?.set?.('clear'); });
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(B, 'swirl');
    const cell = await A.evaluate(() => {
      const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'mirror'), p = g.player;
      p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
      return f.cloth[Math.floor(f.cloth.length / 2)];
    });
    await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(A, 'mirror');
    await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
    t.ok(await placeIs(B, 'mirror'), 'both friends are in the Mirror Palace');
    await A.evaluate(() => { const p = window.pokecraft.player; p.pos.set(27.5, 11, 123.5); p.vel.set(0, 0, 0); });
    await B.evaluate(() => { const p = window.pokecraft.player; p.pos.set(30.5, 11, 123.5); p.vel.set(0, 0, 0); });
    await both(A, B, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return a?.here && a.pos.distanceTo(g.player.pos) < 6; });
    await arm(A); await arm(B);
    const saved0 = await Promise.all([A, B].map(savedOf));

    // the friend menu in the palace
    await openMenu(A);
    const m = await menu(A), row = m.find(x => x.id === 'bounce');
    t.ok(row && !row.dim && row.word === 'Bounce-Back' && /First to 3/.test(row.sub), `in the Mirror Palace the friend menu has Bounce-Back (${m.map(x => x.word).join('|')}; "${row?.sub}")`);
    await A.evaluate(() => window.pokecraft.closeFriend());
    const ask = await invite(A, B);
    t.ok(/Dad wants to play Bounce-Back with you! Keep the shine ball out of your end\. First to 3 wins\./.test(ask) && !/You both go/.test(ask), `Kid is asked ("${ask}")`);
    t.ok(await both(A, B, () => !!window.pokecraft.friendGames.state().info?.onStance), 'both are on their ends of the court');
    const st = await Promise.all([A, B].map(P => P.evaluate(() => {
      const g = window.pokecraft, p = g.player, live = g.gymLive.of('part:mirror'), i = g.friendGames.state().info, a = [...g.mp.others.values()][0];
      const crew = g.npcs.list.filter(n => n.kind === 'crew' && n.def?.boss === 'mirror');
      return { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, side: i.side, duel: live.duel === g.friendGames.play, near: live.near(p), crew: crew.length, away: crew.every(n => n.away && !n.model.visible),
        cleo: live.cleo.visible, rail: live.rail, friend: a && { x: a.pos.x, z: a.pos.z }, chip: document.getElementById('hs-hud').textContent };
    })));
    t.ok(st[0].side === 0 && Math.abs(st[0].z - 116) < 0.01 && Math.abs(st[0].yaw) < 1e-9 && st[1].side === 1 && Math.abs(st[1].z - 89) < 0.01 && Math.abs(st[1].yaw - Math.PI) < 1e-9 && st.every(s => s.y === 11),
      `Dad (who asked) stands at the near rail looking north, Kid at Cleo's line looking south (Dad z ${st[0].z}, Kid z ${st[1].z})`);
    t.ok(st.every(s => s.duel && s.near === null && s.crew === 3 && s.away && !s.cleo && !s.rail), 'the court is the duel\'s: no Play! button, Cleo, Gwen and Lux step aside, the single-player Cleo is not drawn');
    t.ok(await both(A, B, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0], me = g.player.pos.z; return a.here && Math.abs(a.pos.z - (me > 100 ? 89 : 116)) < 0.2; }), 'each sees the friend\'s avatar at the other end');
    t.ok(st.every(s => /🏓 Dad 0 · Kid 0/.test(s.chip)), `the chip: "🏓 Dad 0 · Kid 0" (${st[0].chip})`);
    t.ok(await heard(A, /^Go!$/) && await both(A, B, () => window.pokecraft.friendGames.state().info.n === 1), 'then "Go!", and the first serve is in play on both screens');
    await shot(B, 'bounce-far-end.png');

    // real keys and the mouse: D slides each mirror to the player's own right, the mouse tilts it; Jump does not step off
    for (const [P, side] of [[A, 0], [B, 1]]) {
      await fakeLock(P);
      await P.evaluate(() => document.getElementById('game').requestPointerLock());
      await waitFor(P, () => !!document.pointerLockElement && document.getElementById('pause').classList.contains('hidden'), null, 20000);
      const m0 = await P.evaluate(() => ({ m: window.pokecraft.friendGames.state().info.m, x: window.pokecraft.player.pos.x }));
      await P.keyboard.down('KeyD');
      await waitFor(P, ([s, m]) => window.pokecraft.friendGames.state().info.m[s] > m + 1.5, [side, m0.m[side]], 30000);
      await P.keyboard.up('KeyD');
      await P.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementX: -250, movementY: 0 })));
      await P.waitForTimeout(800);
      await P.keyboard.press('Space');
      await P.waitForTimeout(1200);
      const r = await P.evaluate(() => ({ m: window.pokecraft.friendGames.state().info.m, tilt: window.pokecraft.friendGames.state().info.tilt, x: window.pokecraft.player.pos.x, on: window.pokecraft.friendGames.state().info.onStance }));
      const moved = side ? r.x < m0.x - 1.5 : r.x > m0.x + 1.5;
      t.ok(r.m[side] > m0.m[side] + 1.5 && moved && r.tilt[side] < -0.3 && r.on, `${side ? 'Kid (far end, the court turned round)' : 'Dad (near end)'}: real D slides the mirror to the right of the way you look (x ${m0.x.toFixed(1)} to ${r.x.toFixed(1)}), the mouse leans it (${r.tilt[side].toFixed(2)}), Space keeps you on`);
      await pause(P);
    }
    t.ok(await heard(A, /To stop the game, press Stop/) && await heard(B, /To stop the game, press Stop/), 'Jump says how to stop instead');
    const theirs = await A.evaluate(() => { const g = window.pokecraft, pl = g.friendGames.play; return { m: pl.court.m[1], x: pl.theirMirror.position.x, z: pl.theirMirror.position.z }; });
    t.ok(Math.abs(theirs.z - 89.45) < 0.01 && theirs.m > 9, `Dad sees Kid's mirror where Kid put it (Kid's own u ${theirs.m.toFixed(1)}, x ${theirs.x.toFixed(1)})`);

    // points by each side, to 3
    await setBot(A, 'tracker'); await setBot(B, 'dodge');
    t.ok(await playTo(A, B, 0, 1), 'Kid lets one past: a point for Dad on both screens (claimed by Kid\'s computer, counted by Dad\'s)');
    t.ok(await heard(B, /Point to Dad! Dad 1 · Kid 0/), 'Kid hears "Point to Dad!"');
    await setBot(A, 'dodge'); await setBot(B, 'tracker');
    t.ok(await playTo(A, B, 1, 1), 'Dad lets one past: a point for Kid on both screens');
    await shot(A, 'bounce-near-end.png');
    const mid = await Promise.all([A, B].map(info));
    t.ok(mid.every(i => i.hits + i.guesses >= 1), `the ball really went back and forth (${mid.map(i => `${i.hits} hits`).join(' / ')})`);
    await setBot(A, 'tracker'); await setBot(B, 'dodge');
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active, null, 300000), 'to 3: the game is over on both screens');
    t.ok(await heard(A, /🏓 Dad wins 3 : [01]! Good game!/) && await heard(B, /🏓 Dad wins 3 : [01]! Good game!/), 'both hear "🏓 Dad wins 3 : 1! Good game!" (or 3 : 0)');
    const after = await Promise.all([A, B].map(P => P.evaluate(() => {
      const g = window.pokecraft, p = g.player, live = g.gymLive.of('part:mirror'), crew = g.npcs.list.filter(n => n.kind === 'crew' && n.def?.boss === 'mirror');
      const pp = g.player.pos.clone(); p.pos.set(27.5, 11, 119.6); const word = live.near(p); p.pos.copy(pp);
      return { carry: !!p.carry, z: p.pos.z, place: g.place, duel: !!live.duel, crew: crew.every(n => !n.away && n.model.visible), word, court: g.beaten.filter(k => /pw:mirror:court/.test(k)).length };
    })));
    t.ok(after.every(a => !a.carry && Math.abs(a.z - 120.6) < 0.01 && a.place === 'mirror' && !a.duel && a.crew && a.word === 'Play!'), 'both walk again in front of the court, the crew are back, and the plate says Play! again');
    const saved1 = await Promise.all([A, B].map(savedOf));
    t.ok(saved0[0] === saved1[0] && saved0[1] === saved1[1] && after.every(a => a.court === 0), 'nothing saved: keys, cubes, stars and Boss wins as before (no court key)');
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
    t.ok(!(await menu(A)).some(x => x.id === 'bounce'), 'the host is no Champion yet: no Bounce-Back in the main world');
    await A.evaluate(() => window.pokecraft.closeFriend());
    await A.evaluate(() => { const g = window.pokecraft; g.champion = true; g.mp.sendState(); });
    await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === true);
    await openMenu(B);
    const row = (await menu(B)).find(x => x.id === 'bounce');
    t.ok(row && !row.dim && row.sub === 'You both go to the Mirror Palace and back.', `the host is a Champion: Bounce-Back for both, anywhere ("${row?.sub}")`);
    await B.evaluate(() => window.pokecraft.closeFriend());
    const at0 = [await where(A), await where(B)], saved0 = await Promise.all([A, B].map(savedOf));
    const ask = await invite(A, B);
    t.ok(/You both go to the Mirror Palace and back\./.test(ask), `Kid is asked, with where it goes ("${ask}")`);
    t.ok(await heard(A, /🏓 Off to the Mirror Palace!/) && await placeIs(A, 'mirror') && await placeIs(B, 'mirror'), 'both go to the Mirror Palace (the host first, the guest follows)');
    t.ok(await both(A, B, () => !!window.pokecraft.friendGames.state().info?.onStance, null, 120000), 'and land on their ends of the court');
    const k = await Promise.all([A, B].map(P => P.evaluate(() => { const g = window.pokecraft; return { z: g.player.pos.z, guest: !!g.realms.stash?.guest }; })));
    t.ok(Math.abs(k[0].z - 116) < 0.01 && Math.abs(k[1].z - 89) < 0.01 && !k[0].guest && k[1].guest, 'Dad at the near rail, Kid at the far line, in the host\'s palace');
    await shot(A, 'bounce-trip.png');
    await arm(A); await arm(B);
    await setBot(A, 'tracker'); await setBot(B, 'dodge');
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active, null, 400000) && await heard(B, /Dad wins 3 : 0/), 'a whole game to 3 there');
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
    await TB.tap('#friend [data-friend="bounce"]');
    t.ok(await waitFor(TA, () => !document.getElementById('ask').classList.contains('hidden') && /Bounce-Back/.test(document.getElementById('ask-text').textContent)), 'iPad: a tap on Bounce-Back asks the friend');
    await TA.tap('#ask-yes');
    t.ok(await placeIs(TA, 'mirror', 240000) && await placeIs(TB, 'mirror', 240000) && await both(TA, TB, () => !!window.pokecraft.friendGames.state().info?.onStance, null, 120000), 'iPad: both land on their ends in the Mirror Palace');
    // Kid asked, so Kid leads and stands at the near end; Dad at the far one. The joystick slides, a drag tilts, Jump keeps you on.
    const I = await TA.evaluate(() => {
      const g = window.pokecraft, p = g.player, pl = g.friendGames.play, s = pl.side, m0 = pl.court.m[s], x0 = p.pos.x;
      g.touch.joy = { x: 1, y: 0 }; p.joy = g.touch.joy;
      for (let i = 0; i < 12; i++) { p.update(1 / 30); pl.update(1 / 30); }
      g.touch.joy = null; p.joy = null;
      const out = { side: s, slid: pl.court.m[s] - m0, dx: p.pos.x - x0 };
      p.look(-200, 0); pl.update(1 / 30); out.tilt = pl.court.tilt[s];
      return out;
    });
    t.ok(I.side === 1 && I.slid > 1 && I.dx < -1 && I.tilt < -0.2, `iPad (far end): the stick to the right slides the mirror to your right (${I.slid.toFixed(1)}; x ${I.dx.toFixed(1)}), a drag leans it (${I.tilt.toFixed(2)})`);
    const jump = await TA.evaluate(() => document.getElementById('btn-jump')?.textContent.trim());
    await TA.tap('#btn-jump');
    await TA.waitForTimeout(1500);
    t.ok(await heard(TA, /To stop the game, press Stop/) && (await info(TA)).onStance, `iPad: the Jump button ("${jump}") keeps you on your end and says how to stop`);
    await shot(TA, 'bounce-ipad.png');
    await TB.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await both(TA, TB, () => !window.pokecraft.friendGames.active), 'iPad: Stop ends it for both');
    t.ok(await placeIs(TA, 'main') && await placeIs(TB, 'main'), 'iPad: both are back in the main world');
    const back = await TB.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
    t.ok(Math.hypot(back[0] - home[0], back[1] - home[1], back[2] - home[2]) < 0.3, 'iPad: back on the very spot');
    t.ok(!TA.errors.length && !TB.errors.length, `no page errors (iPad) ${[...TA.errors, ...TB.errors].slice(0, 3).join(' | ')}`);
    await TA.context().close(); await TB.context().close();
  }
}
