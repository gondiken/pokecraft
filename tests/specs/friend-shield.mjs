// Shield Up! for two (owner 2026-11-28): one friend throws with the Castle's catapults, the other blocks on a Shield Stone, then they swap.
//   rules : Node: the pure ShieldTurn (src/siegeduelrules.js) judges the same at 60 and 20 frames a second with siege.js's own rule and grace;
//           looking at a catapult picks it, looking up high picks a sky pumpkin; the cool-down; the score and the turns (5 each, level = one
//           more each, then a draw); model players (tests/siegeduelbots.mjs): a still / spinning / jumping defender who mashes Throw! loses to
//           a skilled one at 60 and 20 fps, mashing Throw! never splats a defender who watches, a skilled thrower splats a slow child more
//           than mashing does; then the REAL ShieldDuel twice over a line with a delay and lost messages (tests/castleduelnode.mjs)
//   play  : two browsers in the Castle: the menu row (dim with its line while the host is no Champion, asking refused), ask, yes, Kid on the
//           Shield Stone, Dad on the other stone, the helpers step aside, real keys: Dad looks at a catapult and presses E, Kid holds W
//           toward it = a block (Kid's point), a throw from behind = a splat (Dad's point), then to the end, both hear the winner, back
//           where they stood, nothing saved
//   trip  : asked in the main world by a Champion host: both land in the Castle, play, and are back on the very spot they stood on
//   ipad  : two iPads, asked from the main world with taps: the joystick turns the shield, the round action button says Throw! and throws, Stop
// SHIELD_ONLY=rules|play|trip|ipad
import { devices } from 'playwright';
import { openPair, newGame, pause } from '../helpers.mjs';
import { H } from './friend-joust.mjs';

const { waitFor, heard, listen, both, info, placeIs, standAt, share, openMenu, menu, invite, savedOf, fakeLock, shot, intoCastle } = H;
const only = process.env.SHIELD_ONLY;
const want = part => !only || only.split(',').includes(part);
const src = f => import(new URL(`../../src/${f}`, import.meta.url).href);
// The model players of siegeduelbots.mjs play each page's side (window.__bot = [defender, thrower] names, or null for the real keys / stick)
const arm = page => page.evaluate(async () => {
  const Bots = await import('/tests/siegeduelbots.mjs'), fg = window.pokecraft.friendGames;
  window.__bot = window.__bot ?? null;
  if (window.__armed) return; window.__armed = true;
  const up = fg.update.bind(fg);
  fg.update = () => {
    const play = fg.play;
    if (play && !play.__wrapped && play.throwNow) {
      play.__wrapped = true;
      const pu = play.update.bind(play);
      play.update = dt => {
        const b = window.__bot;
        if (b && play.turn) {
          window.__made ||= { defend: Bots.DEFENDERS[b[0]](), throw: Bots.THROWERS[b[1]]() };
          if (play.role === 'def') play.input = window.__made.defend(play.turn, Math.min(dt, 1));
          else { play.input = null; const w = window.__made.throw({ time: play.clock, shield: play.theirShield, thrown: play.thrown, can: play.canThrow() }); if (w) play.throwNow(w); }
        } else play.input = null;
        pu(dt);
      };
    }
    up();
  };
});
const setBot = (page, b) => page.evaluate(b => { window.__bot = b; window.__made = null; }, b);

export default async function ({ browser, base, t }) {
  /* ------------------------------------------------ rules (Node) ------------------------------------------------ */
  if (want('rules')) {
    const R = await src('siegeduelrules.js'), S = await src('siege.js');
    const { DEFENDERS, THROWERS, player, playShieldDuel } = await import('../siegeduelbots.mjs');
    const D = R.DUEL_SHIELD, stand = S.SIEGE.stones[D.defStone], thr = S.SIEGE.stones[D.throwStone];
    // looking at a catapult picks it; looking high up = a sky pumpkin
    const eye = [thr[0], thr[1] + 1.62, thr[2]];
    const look = k => { const s = S.spotPos(k), dx = s[0] - eye[0], dy = s[1] - eye[1], dz = s[2] - eye[2]; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
    t.ok([0, 2, 4, 6, 9, 11].every(k => { const [y, p] = look(k); const a = R.aimOf(eye, y, p); return a.k === k && a.kind === 'pumpkin'; }) && R.aimOf(eye, 0, 1.2).kind === 'sky',
      'looking at a catapult picks that one; looking up high picks a sky pumpkin');
    const th = R.throwOf(0, 3, 'pumpkin'), sk = R.throwOf(1, 3, 'sky');
    t.ok(th.tell === S.SIEGE.tell.pumpkin[1] && th.flight === S.SIEGE.flight.pumpkin[1] && sk.tell === S.SIEGE.tell.sky[1] && sk.flight === S.SIEGE.flight.sky, 'a throw has the single-player round 2\'s tell and flight');
    t.ok(!R.canThrow(1.0, 0.5, 1, 5) && R.canThrow(1.3, 0.5, 1, 5) && !R.canThrow(9, 0.5, 5, 5), `the cool-down: ${D.cool} s between throws, ${D.throws} a turn`);
    // the judging: siege.js's own rule with its grace window, at 60 and 20 frames a second
    const judgeRun = (fps, ang, up, kind = 'pumpkin') => { const g = new R.ShieldTurn({ n: 1 }); g.add(R.throwOf(0, 2, kind)); const ev = []; for (let i = 0; i < 5 * fps; i++) ev.push(...g.update(1 / fps, { ang, up })); return ev.find(e => e.type === 'hit')?.result; };
    const at = S.dirTo(stand, 2);
    t.ok(judgeRun(60, at, false) === 'perfect' && judgeRun(20, at, false) === 'perfect' && judgeRun(60, at + 0.4, false) === 'block' && judgeRun(60, at + Math.PI, false) === 'splat' && judgeRun(20, at, true) === 'splat' && judgeRun(60, 0, true, 'sky') === 'block',
      'block, perfect and splat as in the single-player game (shield up only for a sky pumpkin), the same at 60 and 20 fps');
    // the grace window: a turn just after the arrival still blocks
    const late = fps => { const g = new R.ShieldTurn({ n: 1 }), t0 = R.throwOf(0, 2, 'pumpkin'); g.add(t0); const arrive = t0.tell + t0.flight; let r; for (let i = 0; i < 5 * fps; i++) { const tt = i / fps; for (const e of g.update(1 / fps, { ang: tt > arrive + 0.05 ? at : at + Math.PI, up: false })) if (e.type === 'hit') r = e.result; } return r; };
    t.ok(late(60) === 'perfect' && late(20) !== undefined, `a shield turned a moment late still counts (SIEGE.grace: ${late(60)} at 60 fps, ${late(20)} at 20)`);
    // the score and the turns
    const sc = new R.ShieldScore();
    for (let i = 0; i < 5; i++) sc.add(1, i, i < 3 ? 'block' : 'splat');
    t.ok(sc.score.join() === '2,3' && sc.turnDone(1) && sc.after(1) === null && !sc.add(1, 0, 'block') && R.turnOf(1).def === 1 && R.turnOf(2).def === 0 && R.turnOf(3).n === 1, 'one point a throw (a block to the defender, a splat to the thrower), counted once; the friend blocks first');
    for (let i = 0; i < 5; i++) sc.add(2, i, i < 3 ? 'block' : 'splat');
    t.ok(sc.score.join() === '5,5' && sc.after(2) === null, 'level after both turns: one more throw each');
    sc.add(3, 0, 'block'); sc.add(4, 0, 'block');
    t.ok(sc.after(4) === 'draw', 'still level: a draw');
    // the model players
    for (const fps of [60, 20]) {
      for (const naive of ['still', 'spinner', 'jumpy']) {
        const a = playShieldDuel([player('skilled', 'skilled'), player(naive, 'spam')], { fps, lag: 0.2 }), b = playShieldDuel([player(naive, 'spam'), player('skilled', 'skilled')], { fps, lag: 0.2 });
        t.ok(a.winner === 0 && b.winner === 1, `${fps} fps: a skilled player beats a ${naive} defender who mashes Throw! (${a.score.join(':')}, ${b.score.join(':')})`);
      }
      let spamSplats = 0;
      for (let seed = 1; seed <= 10; seed++) { const r = playShieldDuel([{ defend: DEFENDERS.skilled(), throw: THROWERS.spam(seed) }, { defend: DEFENDERS.skilled(), throw: THROWERS.lazy() }], { fps, lag: 0.2 }); spamSplats += r.results.filter(x => /^[13]:splat/.test(x)).length; }
      t.ok(spamSplats === 0, `${fps} fps: mashing Throw! as fast as it goes never splats a defender who watches (10 games)`);
      let sk = 0, sp = 0;
      for (let seed = 1; seed <= 10; seed++) {
        sk += playShieldDuel([player('skilled', 'skilled'), player('kid', 'lazy')], { fps, lag: 0.2 }).results.filter(x => /^[13]:splat/.test(x)).length;
        sp += playShieldDuel([{ defend: DEFENDERS.skilled(), throw: THROWERS.spam(seed) }, player('kid', 'lazy')], { fps, lag: 0.2 }).results.filter(x => /^[13]:splat/.test(x)).length;
      }
      t.ok(sk > sp * 2 && sk >= 10, `${fps} fps: throwing from opposite sides splats a slow child more than mashing does (${sk} vs ${sp} splats in 10 games)`);
      console.log(`  ${fps} fps: splats on a slow child in 10 games: skilled thrower ${sk}, masher ${sp}`);
    }
    t.ok(S.SIEGE.grace.before === 0.12 && S.SIEGE.cover > 0.6 && S.SIEGE.rounds.length === 3, 'the single-player Shield Up! is as it was');
    // two computers with a line in between: the real ShieldDuel twice
    const { shieldPair } = await import('../castleduelnode.mjs');
    for (const [fps, lag] of [[60, 0.15], [20, 0.3]]) {
      const w = await shieldPair({ players: [['skilled', 'skilled'], ['still', 'spam']], fps, lag }), w2 = await shieldPair({ players: [['jumpy', 'spam'], ['skilled', 'skilled']], fps, lag });
      t.ok(w.results.every(r => /Dad wins/.test(r)) && w.results[0] === w.results[1] && w.scores[0] === w.scores[1] && w2.results.every(r => /Kid wins/.test(r)) && w2.results[0] === w2.results[1],
        `${fps} fps, a ${lag} s line: both computers agree on every throw and on the winner (${w.results[0]} / ${w2.results[0]})`);
      const d = await shieldPair({ players: [['skilled', 'skilled'], ['skilled', 'skilled']], fps, lag });
      t.ok(d.results.every(r => /A draw, 6 : 6/.test(r)), `${fps} fps, a ${lag} s line: two skilled players block everything: a draw after one more each (${d.results[0]})`);
    }
    const lossy = await shieldPair({ players: [['skilled', 'skilled'], ['kid', 'lazy']], fps: 30, lag: 0.2, drop: 0.25 });
    t.ok(lossy.results.every(r => /Dad wins/.test(r)) && lossy.results[0] === lossy.results[1] && lossy.lost > 10 && JSON.stringify(lossy.info[0].counts) === JSON.stringify(lossy.info[1].counts),
      `a quarter of the messages lost: the throws, the words and the heartbeat still bring both to the same end, every throw shown on both (${lossy.lost} lost, ${lossy.results[0]})`);
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

    await A.evaluate(() => { const g = window.pokecraft; g.champion = false; g.mp.sendState(); });
    await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === false);
    for (const [P, who] of [[A, 'Dad'], [B, 'Kid']]) {
      await openMenu(P);
      const row = (await menu(P)).find(x => x.id === 'shieldup');
      t.ok(row && row.dim && /Champion first/.test(row.sub), `${who}: while the host is no Champion the Shield Up! row is dim and says why ("${row?.sub}")`);
      await P.evaluate(() => window.pokecraft.closeFriend());
    }
    await A.evaluate(() => { const g = window.pokecraft; g.friendGames.invite('shieldup', [...g.mp.others.values()][0]); });
    t.ok(await heard(A, /Become the Champion first/) && !(await B.evaluate(() => window.pokecraft.ui.asking)), 'asking anyway is refused with the same line; Kid is not asked');
    await A.evaluate(() => { const g = window.pokecraft; g.champion = true; g.mp.sendState(); });
    await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === true);

    await openMenu(A);
    const m = await menu(A), row = m.find(x => x.id === 'shieldup');
    t.ok(row && !row.dim && row.word === 'Shield Up!' && m.some(x => x.id === 'joust'), `in the Castle the friend menu has Shield Up! and the Joust (${m.map(x => x.word).join('|')}; "${row?.sub}")`);
    await A.evaluate(() => window.pokecraft.closeFriend());
    const ask = await invite(A, B, 'shieldup');
    t.ok(/Dad wants to play Shield Up! with you!/.test(ask), `Kid is asked ("${ask}")`);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info?.t === 1 && !!window.pokecraft.friendGames.state().info?.onStone, null, 60000), 'turn 1 starts; both on their stones');
    const st = await Promise.all([A, B].map(P => P.evaluate(() => {
      const g = window.pokecraft, p = g.player, live = g.gymLive.of('part:castle'), i = g.friendGames.state().info, crew = g.npcs.list.filter(n => n.kind === 'crew' && n.def?.boss === 'castle');
      return { x: p.pos.x, z: p.pos.z, role: i.role, near: live.near(p), away: crew.length === 2 && crew.every(n => n.away), chip: document.getElementById('hs-hud').textContent };
    })));
    t.ok(st[1].role === 'def' && Math.abs(st[1].x - 76.5) < 0.01 && Math.abs(st[1].z - 130.5) < 0.01 && st[0].role === 'throw' && Math.abs(st[0].x - 84.5) < 0.01, 'Kid (who was asked) blocks first on the Shield Stone, Dad throws from the other stone');
    t.ok(st[0].near === 'Throw!' && st[1].near === null && st.every(s => s.away), `Dad's big button says Throw!, Kid's nothing; the helpers step aside ("${st[0].chip}")`);
    t.ok(st.every(s => /🛡️ Dad 0 · Kid 0/.test(s.chip)), `the chip: "${st[1].chip}"`);

    // real keys: Dad looks at the gate's catapult and presses E; Kid holds W toward it = a block; then one from behind = a splat
    for (const P of [A, B]) { await fakeLock(P); await P.evaluate(() => document.getElementById('game').requestPointerLock()); await waitFor(P, () => !!document.pointerLockElement && document.getElementById('pause').classList.contains('hidden'), null, 20000); }
    await B.evaluate(() => window.pokecraft.player.lookAt({ x: 80.5, y: 14, z: 104 }));
    await B.keyboard.down('KeyW');
    await A.evaluate(() => window.pokecraft.player.lookAt({ x: 80.5, y: 27.5, z: 104.5 }));
    await waitFor(A, () => window.pokecraft.friendGames.state().info.can, null, 20000);
    await A.keyboard.press('KeyE');
    t.ok(await waitFor(B, () => window.pokecraft.friendGames.state().info.inTurn === 1, null, 20000), 'real E: Dad throws from the gate; Kid sees it coming');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.score[1] === 1, null, 60000) && await heard(A, /Kid blocked it! \+1 for Kid/), 'Kid holds W toward it: blocked, a point for Kid on both screens');
    await A.evaluate(() => window.pokecraft.player.lookAt({ x: 80.5, y: 14.5, z: 148.5 }));
    await waitFor(A, () => window.pokecraft.friendGames.state().info.can, null, 20000);
    await A.keyboard.press('KeyE');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.score[0] === 1, null, 60000) && await heard(A, /Splat! \+1 for you!/), 'one from behind while Kid still faces the gate: Splat!, a point for Dad on both screens');
    await shot(B, 'shield-duel-defend.png');
    await B.keyboard.up('KeyW');
    for (const P of [A, B]) await pause(P);

    await setBot(A, ['skilled', 'skilled']); await setBot(B, ['still', 'spam']);
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active, null, 300000), 'to the end: the game is over on both screens');
    const res = await A.evaluate(() => (window.__toasts || []).find(m => /Good game!/.test(m)));
    t.ok(/🛡️ Dad wins \d+ : \d+! Good game!/.test(res) && await heard(B, /🛡️ Dad wins \d+ : \d+! Good game!/), `both hear the winner ("${res}")`);
    const end = await Promise.all([A, B].map(P => P.evaluate(() => {
      const g = window.pokecraft, p = g.player, live = g.gymLive.of('part:castle'), crew = g.npcs.list.filter(n => n.kind === 'crew' && n.def?.boss === 'castle');
      const pp = p.pos.clone(); p.pos.set(76.5, 11, 130.5); const word = live.near(p); p.pos.copy(pp);
      return { carry: !!p.carry, pos: [p.pos.x, p.pos.y, p.pos.z], duel: !!live.duel, crew: crew.every(n => !n.away), word, keys: g.beaten.filter(k => /pw:castle:(lance|shield)/.test(k)).length };
    })));
    t.ok(end.every((e, k) => !e.carry && Math.hypot(e.pos[0] - at0[k][0], e.pos[2] - at0[k][2]) < 0.3 && !e.duel && e.crew && e.word === 'Shield!'), 'both are back on foot where they stood, the helpers are back, the Shield Stone says Shield! again');
    const saved1 = await Promise.all([A, B].map(savedOf));
    t.ok(saved0[0] === saved1[0] && saved0[1] === saved1[1] && end.every(e => e.keys === 0), 'nothing saved: keys, cubes, stars and Boss wins as before (no shield key)');
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
    t.ok(!(await menu(A)).some(x => x.id === 'shieldup'), 'the host is no Champion yet: no Shield Up! in the main world');
    await A.evaluate(() => window.pokecraft.closeFriend());
    await A.evaluate(() => { const g = window.pokecraft; g.champion = true; g.mp.sendState(); });
    await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === true);
    const at0 = [await where(A), await where(B)], saved0 = await Promise.all([A, B].map(savedOf));
    const ask = await invite(A, B, 'shieldup');
    t.ok(/You both go to the Castle and back\./.test(ask), `Kid is asked, with where it goes ("${ask}")`);
    t.ok(await placeIs(A, 'castle') && await placeIs(B, 'castle') && await both(A, B, () => !!window.pokecraft.friendGames.state().info?.onStone, null, 120000), 'both go to the Castle and stand on their stones');
    await shot(A, 'shield-duel-throw.png');
    await arm(A); await arm(B);
    await setBot(A, ['still', 'spam']); await setBot(B, ['skilled', 'skilled']);
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active, null, 400000) && await heard(A, /Kid wins/), 'a whole game there: Kid wins');
    t.ok(await placeIs(A, 'main') && await placeIs(B, 'main') && await both(A, B, () => !window.pokecraft.friendGames.state().returning && !window.pokecraft.friendGames.tripping), 'both are back in the main world');
    const at1 = [await where(A), await where(B)];
    t.ok(same(at0[0], at1[0]) && same(at0[1], at1[1]), 'on the very spot and facing they had');
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
    await TB.tap('#friend [data-friend="shieldup"]');
    t.ok(await waitFor(TA, () => !document.getElementById('ask').classList.contains('hidden') && /Shield Up!/.test(document.getElementById('ask-text').textContent)), 'iPad: a tap on Shield Up! asks the friend');
    await TA.tap('#ask-yes');
    t.ok(await placeIs(TA, 'castle', 240000) && await placeIs(TB, 'castle', 240000) && await both(TA, TB, () => window.pokecraft.friendGames.state().info?.t === 1, null, 120000), 'iPad: both land on their stones in the Castle');
    // Kid asked, so Kid leads and throws first; Dad blocks. The joystick turns Dad's shield.
    const I = await TA.evaluate(() => {
      const g = window.pokecraft, p = g.player, pl = g.friendGames.play, a0 = pl.shieldIn.ang;
      g.touch.joy = { x: 1, y: 0 }; p.joy = g.touch.joy;
      for (let i = 0; i < 4; i++) { p.update(1 / 30); pl.update(1 / 30); }
      const out = { role: pl.role, turned: Math.abs(Math.atan2(Math.sin(pl.shieldIn.ang - a0), Math.cos(pl.shieldIn.ang - a0))) };
      g.touch.joy = null; p.joy = null;
      return out;
    });
    t.ok(I.role === 'def' && I.turned > 1.2, `iPad: Dad blocks; the joystick to the right turns his shield to his right (${I.turned.toFixed(2)} rad)`);
    await TB.evaluate(() => window.pokecraft.player.lookAt({ x: 80.5, y: 27.5, z: 104.5 }));
    t.ok(await waitFor(TB, () => /Throw!/.test(document.getElementById('btn-act')?.textContent || '') && window.pokecraft.friendGames.state().info.can, null, 30000), 'iPad: Kid\'s round action button says Throw!');
    await TB.tap('#btn-act');
    t.ok(await waitFor(TB, () => window.pokecraft.friendGames.state().info.thrown === 1, null, 20000) && await waitFor(TA, () => window.pokecraft.friendGames.state().info.inTurn === 1, null, 20000), 'iPad: a tap throws; Dad sees it coming');
    await shot(TA, 'shield-duel-ipad.png');
    await TB.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await both(TA, TB, () => !window.pokecraft.friendGames.active), 'iPad: Stop ends it for both');
    t.ok(await placeIs(TA, 'main') && await placeIs(TB, 'main'), 'iPad: both are back in the main world');
    const back = await TB.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
    t.ok(Math.hypot(back[0] - home[0], back[1] - home[1], back[2] - home[2]) < 0.3, 'iPad: back on the very spot');
    t.ok(!TA.errors.length && !TB.errors.length, `no page errors (iPad) ${[...TA.errors, ...TB.errors].slice(0, 3).join(' | ')}`);
    await TA.context().close(); await TB.context().close();
  }
}
