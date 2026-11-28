// Games for two friends (owner 2026-11-26): tag anywhere; football, basketball and a kart race in Playland.
//   rules  : Node: tagrules.js, sharedball.js (two browsers' balls over a slow line: they agree; two touches at once: the leader's
//            stands), matchrules.js (kick-off spots, sides, the score, who won a race)
//   tag    : two browsers in the main world: the friend menu, asking, no / yes, IT counts to three, a touch, no tag-back while
//            counting, a tap, the IT! sign, the play area, no battles, time up, Stop, busy, a lost leader, real keys
//   sports : two browsers in Playland: the friend menu's seven choices, a football match (kick-off spots, the keepers step aside,
//            one ball on both screens, a touch takes it, goals by the leader and by the friend, to 3), basketball (the ball in
//            their hands, a basket), a kart race (both karts on the grid, laps, the times, the winner), nothing saved
//   ipad   : two iPads: the menu fits with seven choices, taps ask and answer, the action button says Tag!
//   trip   : two browsers far from Playland (owner 2026-11-28): no stadium games until the host is a Champion, then all seven
//            choices in the main world; football asked by the guest: both land in the host's Playland, play, and are back on
//            the very spot they stood on; a kart race the same; from the Swirl and back to the Swirl
// FRIEND_ONLY=rules|tag|sports|ipad|trip
import { devices } from 'playwright';
import { openPair, newGame, click, pause } from '../helpers.mjs';

const only = process.env.FRIEND_ONLY;
const want = part => !only || only.split(',').includes(part);
const shot = (page, name) => page.screenshot({ path: new URL(`../screenshots/${name}`, import.meta.url).pathname, timeout: 120000 }).then(() => console.log(`  screenshot ${name}`)).catch(() => {});
const src = f => import(new URL(`../../src/${f}`, import.meta.url).href);
const fg = page => page.evaluate(() => window.pokecraft.friendGames.state());
const said = (page, re) => page.evaluate(r => (window.__toasts || []).some(m => new RegExp(r).test(m)), re.source);
async function waitFor(page, fn, arg, ms = 30000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 150 }); return true; } catch { return false; }
}
const heard = (page, re, ms = 15000) => waitFor(page, r => (window.__toasts || []).some(m => new RegExp(r).test(m)), re.source, ms);
// every toast is kept in window.__toasts
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
const menu = page => page.evaluate(() => [...document.querySelectorAll('#friend .fm-btn')].map(b => ({ id: b.dataset.friend, word: b.querySelector('b').textContent, dim: b.classList.contains('dim') })));
// ask through the friend menu with a real click; the other one answers
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

export default async function ({ browser, base, t }) {
  /* ------------------------------------------------ rules (Node) ------------------------------------------------ */
  if (want('rules')) {
    const { TAG, TagRound, touching } = await src('tagrules.js');
    const r = new TagRound(['dad', 'kid']);
    t.ok(r.it === 'dad' && !r.canTag('dad') && !r.canTag('kid'), 'tag: the inviter is IT and counts first (nobody can tag yet)');
    r.step(TAG.freeze - 0.5);
    t.ok(!r.canTag('dad') && r.itTime.dad === 0, 'tag: still counting, and counting is not "being IT" time');
    r.step(1);
    t.ok(r.canTag('dad') && !r.canTag('kid') && Math.abs(r.itTime.dad - 0.5) < 1e-9, 'tag: after the count IT can tag, the other never');
    t.ok(!r.tagged('kid') && r.tagged('dad') && r.it === 'kid' && r.frozen === TAG.freeze && r.tags === 1, 'tag: a touch makes the other one IT, who counts again');
    t.ok(!r.tagged('kid') && !r.tagged('dad'), 'tag: no tag-back while they count');
    const m = new TagRound(['dad', 'kid']);
    t.ok(m.load(r.state()) && m.it === 'kid' && m.tags === 1, 'tag: the other side takes the leader\'s state');
    const old = new TagRound(['dad', 'kid']).state();
    t.ok(!m.load(old) && m.it === 'kid', 'tag: an older state is never taken');
    r.step(TAG.time);
    t.ok(r.over && r.left === 0 && r.winner() === 'dad', `tag: time up, the one who was IT less wins (${JSON.stringify(r.itTime)})`);
    const a60 = new TagRound(['a', 'b']), a20 = new TagRound(['a', 'b']);
    for (let i = 0; i < 600; i++) a60.step(1 / 60);
    for (let i = 0; i < 200; i++) a20.step(1 / 20);
    t.ok(Math.abs(a60.itTime.a - a20.itTime.a) < 1e-6 && Math.abs(a60.itTime.a - 7) < 1e-6, 'tag: 60 and 20 frames a second count the same');
    t.ok(touching({ x: 0, y: 5, z: 0 }, { x: 1.2, y: 5.5, z: 0 }) && !touching({ x: 0, y: 5, z: 0 }, { x: 1.5, y: 5, z: 0 }) && !touching({ x: 0, y: 5, z: 0 }, { x: 0.5, y: 8, z: 0 }), 'tag: a touch is close side to side and in height');
    t.ok(TAG.boost > 1 && TAG.boost <= 1.15, `tag: IT runs a little faster so a chase ends (${TAG.boost})`);

    // one ball on two computers
    const { Ball, BALL, boot } = await src('ballphysics.js');
    const { SharedBall, SHARE } = await src('sharedball.js');
    const solid = (x, y) => y <= 10;
    function pair(lag = 0.15, dt = 1 / 60) {
      const mk = me => { const ball = new Ball(solid, [50, 11.401, 50], BALL); return { ball, sh: new SharedBall(ball, me, 'L'), inbox: [] }; };
      const L = mk('L'), G = mk('G');
      let now = 0, sent = 0;
      const step = (seconds, each) => {
        for (let k = 0; k < Math.round(seconds / dt); k++) {
          now += dt;
          each?.(now);
          for (const [me, other] of [[L, G], [G, L]]) {
            while (me.inbox.length && me.inbox[0].at <= now) me.sh.apply(me.inbox.shift().m);
            me.sh.tick(dt); me.ball.update(dt);
            const m = me.sh.outgoing();
            if (m) { sent++; other.inbox.push({ at: now + lag, m: JSON.parse(JSON.stringify(m)) }); }
          }
        }
      };
      const gap = () => Math.hypot(L.ball.pos.x - G.ball.pos.x, L.ball.pos.y - G.ball.pos.y, L.ball.pos.z - G.ball.pos.z);
      return { L, G, step, gap, sent: () => sent };
    }
    let P = pair();
    boot(P.L.ball, { x: 9, y: 3, z: 2 }); P.L.sh.take();
    P.step(0.5);
    const mid = P.gap();
    P.step(8);
    t.ok(mid < 9 * 0.15 + 0.6 && P.gap() < 0.01 && P.L.ball.pos.x > 55 && P.G.sh.owner === 'L' && !P.G.sh.mine, `ball: the leader's kick rolls on both computers; in flight the copy is at most the line's delay behind (${mid.toFixed(2)}), at rest they agree (${P.gap().toFixed(4)})`);
    t.ok(P.sent() < 8.5 * 4, `ball: few messages (${P.sent()} in 8.5 s)`);
    // the friend touches it in flight: it is theirs, the leader follows
    P = pair();
    boot(P.L.ball, { x: 9, y: 0, z: 0 }); P.L.sh.take();
    P.step(0.6);
    boot(P.G.ball, { x: -6, y: 2, z: 5 }); P.G.sh.take();
    P.step(8);
    t.ok(P.gap() < 0.01 && P.L.sh.owner === 'G' && P.G.sh.mine && P.L.ball.pos.z > 52, `ball: the friend's touch takes it: both follow the friend's ball (${P.gap().toFixed(4)}, z ${P.L.ball.pos.z.toFixed(1)})`);
    // both touch at the same moment: the leader's stands on both
    P = pair();
    boot(P.L.ball, { x: 8, y: 0, z: 0 }); P.L.sh.take();
    boot(P.G.ball, { x: -8, y: 0, z: 0 }); P.G.sh.take();
    P.step(8);
    t.ok(P.gap() < 0.01 && P.L.sh.owner === 'L' && P.G.sh.owner === 'L' && P.L.ball.pos.x > 52, `ball: two touches at once: the leader's stands on both (${P.gap().toFixed(4)}, x ${P.L.ball.pos.x.toFixed(1)})`);
    // 20 frames a second on one side, a slow line
    P = pair(0.4, 1 / 20);
    boot(P.G.ball, { x: 3, y: 6, z: -7 }); P.G.sh.take();
    P.step(9);
    t.ok(P.gap() < 0.01 && P.L.sh.owner === 'G', `ball: 20 frames a second and a slow line (0.4 s) still agree (${P.gap().toFixed(4)})`);
    // old and repeated messages
    P = pair();
    boot(P.L.ball, { x: 5, y: 0, z: 0 }); P.L.sh.take();
    const m1 = P.L.sh.outgoing();
    t.ok(m1 && P.G.sh.apply(m1) && !P.G.sh.apply(m1), 'ball: a repeated message is not taken twice');
    P.G.sh.take();
    t.ok(!P.G.sh.apply(m1) && P.G.sh.mine, 'ball: an older message never takes the ball back');
    t.ok(!P.G.sh.apply({ q: 99, k: 1, o: 'L', p: [1, 2, 'x'], v: [0, 0, 0] }) && !P.G.sh.apply(null), 'ball: junk is dropped');
    P.G.sh.kickOff(3);
    t.ok(P.G.sh.q === 3000 && P.G.sh.owner === 'L' && !P.G.sh.apply({ ...m1, q: 2999 }), 'ball: a kick-off starts a new count on both sides; a late message from before it is dropped');
    // a held basketball rides on the message
    P = pair();
    P.G.sh.held = true; P.G.sh.take();
    P.step(0.5);
    t.ok(P.L.sh.held && P.L.sh.owner === 'G', 'ball: "in their hands" reaches the other side');
    t.ok(SHARE.moving <= 0.5 && SHARE.gap >= 0.1, 'ball: at most a few messages a second');

    const { SPORTS, startSpot, scorerOf, MatchScore, decide, BODY, ballFrame } = await src('matchrules.js');
    // a ball never goes through a player (owner 2026-11-27), however close and hard the kick and however slow the frames
    const stand = (x, z, yaw) => ({ x, y: 11, z, vx: 0, vz: 0, yaw, halfW: 0.3, height: 1.8 });
    for (const [gap, speed] of [[1.6, 14], [2.5, 14], [3.5, 14], [8, 14], [1.6, 24], [2.5, 24], [5, 24], [12, 9]]) for (const fps of [60, 20, 10]) for (const off of [0, 0.2, 0.5]) {
      const friend = stand(50 + gap, 50 + off, Math.PI / 2), kicker = stand(48.7, 50, -Math.PI / 2), front = friend.x - BODY.half - BALL.r + 0.01;
      // the kicker's screen: the friend is a solid box at once
      const own = new Ball(solid, [50, 11.401, 50], BALL);
      boot(own, { x: speed, y: 1, z: 0 });
      let maxOwn = -1, hits = 0;
      for (let i = 0; i < fps * 3; i++) { if (ballFrame(own, 1 / fps, kicker, friend).blocked) hits++; maxOwn = Math.max(maxOwn, own.pos.x); }
      // the friend's own screen: the kick arrives as a message, then their own body stops the ball and it is theirs
      const copy = new Ball(solid, [50, 11.401, 50], BALL), sh = new SharedBall(copy, 'G', 'L');
      sh.apply({ q: 1, k: 1, o: 'L', p: [50, 11.401, 50], v: [speed, 1, 0], h: 0 });
      let maxCopy = -1;
      for (let i = 0; i < fps * 3; i++) { if (ballFrame(copy, 1 / fps, friend).touch) sh.take(); maxCopy = Math.max(maxCopy, copy.pos.x); }
      if (!(maxOwn <= front && hits >= 1 && sh.mine && maxCopy <= front)) t.ok(false, `a ball kicked at a friend ${gap} blocks away (${off} to the side) at ${speed} blocks/s, ${fps} fps, went through them (kicker's screen ${maxOwn.toFixed(2)}, ${hits} bounces; their screen ${maxCopy.toFixed(2)}, theirs ${sh.mine}; their front is at ${front.toFixed(2)})`);
    }
    t.ok(true, 'ball: a kick (up to the ball\'s top speed) at a friend standing 1.6 to 12 blocks away never goes through them, on either screen, at 60, 20 and 10 frames a second');
    {
      // my own kick does not bounce off me: the ball right at my feet, kicked the way I face
      const mine = new Ball(solid, [50.3, 11.401, 50], BALL), me = stand(50, 50, -Math.PI / 2);
      boot(mine, { x: 14, y: 1, z: 0 });
      let back = 99;
      for (let i = 0; i < 60; i++) { ballFrame(mine, 1 / 60, me); back = Math.min(back, mine.vel.x); }
      t.ok(back > 0 && mine.pos.x > 55, `ball: my own kick of a ball at my feet flies off (never back off my own body; x ${mine.pos.x.toFixed(1)})`);
      // running into the ball still kicks it along (dribbling), as in the stadium's own game
      const dr = new Ball(solid, [50.7, 11.401, 50], BALL), runner = { ...stand(50, 50, -Math.PI / 2), vx: 6 };
      const first = ballFrame(dr, 1 / 60, runner).touch;
      t.ok(first === 'kick' && dr.vel.x > 5, `ball: running into the ball kicks it along (${dr.vel.x.toFixed(1)} blocks/s)`);
    }
    {
      const miss = new Ball(solid, [50, 11.401, 50], BALL);
      boot(miss, { x: 14, y: 1, z: 0 });
      let far = -1;
      for (let i = 0; i < 180; i++) { ballFrame(miss, 1 / 60, stand(48.7, 50, -Math.PI / 2), { x: 53, y: 11, z: 52 }); far = Math.max(far, miss.pos.x); }
      t.ok(far > 60, `ball: a kick past a friend (2 blocks to the side) flies on (${far.toFixed(1)})`);
    }
    const { buildStadium } = await src('stadium.js'), { ZONES } = await src('playland.js'), { kit } = await src('picturelands.js');
    const world = { W: 224, D: 224, H: 48, data: new Uint8Array(224 * 224 * 48), ground: new Uint8Array(224 * 224), index(x, y, z) { return (y * 224 + z) * 224 + x; }, inBounds(x, y, z) { return x >= 0 && x < 224 && z >= 0 && z < 224 && y >= 0 && y < 48; }, get(x, y, z) { return this.inBounds(x, y, z) ? this.data[this.index(x, y, z)] : 0; } };
    kit(world);
    const part = buildStadium(world, ZONES.stadium);
    const F = SPORTS.football, H = SPORTS.hoops, c = part.ballSpot, cc = part.courtSpot;
    const f = (side, has) => startSpot(F, part, side, has), h = (side, has) => startSpot(H, part, side, has);
    t.ok(f(0, 1)[0] === c[0] - 10 && f(1, 1)[0] === c[0] + 3 && f(0, 0)[0] === c[0] - 3 && f(1, 0)[0] === c[0] + 10 && f(0, 0)[2] === c[2], 'football: at a kick-off the one with the ball stands 3 from it, the other 10, each in their own half');
    t.ok(Math.abs(-Math.sin(f(0, 1)[3]) - 1) < 1e-9 && Math.abs(-Math.sin(f(1, 1)[3]) + 1) < 1e-9, 'football: both face the middle');
    const inBox = (b, s) => s[0] > b.x0 + 1 && s[0] < b.x1 - 1 && s[2] > b.z0 + 1 && s[2] < b.z1 - 1;
    t.ok([0, 1].every(s => [0, 1].every(hs => inBox(part.pitchBox, f(s, hs)) && inBox(part.courtBox, h(s, hs)))), 'every start spot is inside the pitch / the court');
    const b1 = H.ballAt(part, 1), b0 = H.ballAt(part, 0);
    t.ok(b0[0] === cc[0] - 6 && b1[0] === cc[0] + 6 && h(0, 0)[0] === cc[0] - 8 && h(1, 0)[0] === cc[0] + 5 && h(1, 1)[0] === cc[0] + 8 && h(0, 1)[0] === cc[0] - 5, 'basketball: the ball starts in its owner\'s half, they stand behind it, the other one in front of their own hoop');
    const far = Math.abs(part.hoops[1].hole[0] - b0[0]);
    t.ok(far > 15 && far < 18, `basketball: from the start the hoop is just too far for a shot (${far} blocks): dribble closer first`);
    t.ok(scorerOf(1) === 0 && scorerOf(0) === 1 && part.goals[1].side > 0 && part.hoops[1].hole[0] > part.hoops[0].hole[0], 'the leader (west half) scores in the east goal / hoop, the friend in the west one');
    t.ok(F.scored(part, { pos: { x: part.goals[1].line + 1, y: 11.5, z: c[2] } }) === 1 && F.scored(part, { pos: { x: c[0], y: 11.4, z: c[2] } }) === -1, 'football: a ball behind the east line between the posts is in goal 1');
    const hp = part.hoops[0];
    t.ok(H.scored(part, { pos: { x: hp.hole[0], y: hp.rimMid - 0.1, z: hp.hole[1] } }, hp.rimMid + 0.1) === 0 && H.scored(part, { pos: { x: hp.hole[0] + 2, y: hp.rimMid - 0.1, z: hp.hole[1] } }, hp.rimMid + 0.1) === -1, 'basketball: down through the west hoop is hoop 0');
    const sc = new MatchScore(3);
    t.ok(!sc.add(0) && !sc.add(1) && !sc.add(0) && sc.winner === null && sc.add(0) && sc.winner === 0 && sc.score.join() === '3,1', 'the score: first to 3');
    t.ok(decide(61.2, 63) === 0 && decide(70, 63) === 1 && decide(null, 63) === 1 && decide(61, null) === 0 && decide(null, null) === null && decide(60, 60.001) === null, 'race: the smaller time wins; only one finished = they win; the same time = a dead heat');
  }

  /* ------------------------------------------------ tag (two browsers) ------------------------------------------------ */
  if (want('tag')) {
    const [A, B] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(B, 1); await pause(B);
    await share(A, B);
    const SHORT = () => import('/src/tagrules.js').then(m => Object.assign(m.TAG, { time: 1000 }));
    await A.evaluate(SHORT); await B.evaluate(SHORT);
    await standAt(A, 0); await standAt(B, 4);
    await A.waitForTimeout(1500);

    // the friend menu
    await openMenu(A);
    const m1 = await menu(A);
    t.ok(m1.map(x => x.word).join('|') === 'Battle|Trade|Hide and seek|Tag' && !m1.find(x => x.id === 'tag').dim, `the friend menu has Tag; no stadium games outside Playland (${m1.map(x => x.word).join('|')})`);
    await shot(A, 'friend-menu-tag.png');
    await A.evaluate(() => window.pokecraft.closeFriend());
    // no, then yes
    const ask = await invite(A, B, 'tag', false);
    t.ok(/Dad wants to play tag! Dad is IT first\./.test(ask), `Kid is asked ("${ask}")`);
    t.ok(await heard(A, /Kid doesn't want to play right now/), 'N = "Kid doesn\'t want to play right now."');
    t.ok(!(await fg(A)).active && !(await fg(B)).active, 'no game after "Not now"');
    await invite(A, B, 'tag');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.active), 'yes: both are in the game');
    const a1 = await fg(A), b1 = await fg(B);
    t.ok(a1.kind === 'tag' && a1.leader && !b1.leader && a1.info.it === a1.info.me && b1.info.it === a1.info.me && a1.info.frozen > 0, `Dad (who asked) leads and is IT first, counting (${a1.info.frozen})`);
    t.ok(Math.abs(a1.info.center[0] - b1.info.center[0]) < 0.01 && Math.abs(a1.info.center[1] - b1.info.center[1]) < 0.01, 'the same play area on both sides');
    t.ok(await said(A, /You are IT! Count to 3, then catch Kid!/) && await heard(B, /Run! Dad is IT!/), 'Dad: "You are IT! Count to 3...", Kid: "Run! Dad is IT!"');
    // counting: IT cannot walk; the chip is red; the IT! sign is over Dad's head on Kid's screen
    const pin = await A.evaluate(() => {
      const g = window.pokecraft, p = g.player.pos, before = p.clone(), pos = p.clone(); pos.x += 0.4; pos.z += 0.3; const vel = { x: 3, y: 0, z: 3 };
      g.friendGames.fence(pos, before, vel);
      return pos.distanceTo(before) < 1e-6 && vel.x === 0 && vel.z === 0;
    });
    t.ok(pin, 'while counting, IT cannot walk');
    t.ok(await waitFor(A, () => { const h = document.getElementById('hs-hud'); return !h.classList.contains('hidden') && h.classList.contains('hot') && /You are IT/.test(h.textContent) && /Tag ·/.test(h.textContent); }), 'Dad\'s chip is red and says "You are IT!"');
    t.ok(await waitFor(B, () => { const h = document.getElementById('hs-hud'); return !h.classList.contains('hot') && /Dad is IT! Run!/.test(h.textContent); }), 'Kid\'s chip says "Dad is IT! Run!"');
    t.ok(await waitFor(B, () => window.pokecraft.friendGames.state().info.sign && [...window.pokecraft.mp.others.values()][0].model.children.some(c => c.userData.tagIt)), 'Kid sees an IT! sign over Dad');
    t.ok(!(await fg(A)).info.sign, 'Dad sees no sign over Kid');
    // owner 2026-11-28: the catcher's arrow points at the runner; the runner keeps the usual arrow
    t.ok(await waitFor(A, () => /^🏃 (Count to 3! Kid is [↑↖←↙↓↘→↗] \d+m away|Catch Kid! [↑↖←↙↓↘→↗] \d+m)$/.test(window.pokecraft.ui.guideText)), `Dad (IT): the arrow leads to Kid ("${await A.evaluate(() => window.pokecraft.ui.guideText)}")`);
    t.ok(await B.evaluate(() => !/Catch|Count to/.test(window.pokecraft.ui.guideText) && /Next:/.test(window.pokecraft.ui.guideText)), `Kid (running): the usual arrow ("${await B.evaluate(() => window.pokecraft.ui.guideText)}")`);
    // owner 2026-11-28: no lead creature trots behind the friend during a game
    t.ok(await waitFor(A, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a.inGame && a.lead && !a.lead.visible; }) && await waitFor(B, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a.inGame && a.lead && !a.lead.visible; }), 'during the game nobody sees the friend\'s lead creature');
    await shot(B, 'tag-it-sign.png'); await shot(A, 'tag-counting.png');
    // standing right beside Kid while counting does not tag
    await A.evaluate(() => { window.pokecraft.friendGames.play.round.frozen = 3; }); // (the screenshots took a while: count again)
    await standAt(A, 4);
    await A.waitForTimeout(800);
    const c0 = (await fg(A)).info;
    t.ok(c0.tags === 0 && c0.frozen > 0, `a touch while counting does not count (${c0.frozen} s left)`);
    // the count ends: the touch tags
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.tags === 1, null), 'after the count a touch tags');
    const a2 = await fg(A), b2 = await fg(B);
    t.ok(a2.info.it === b2.info.me && b2.info.it === b2.info.me && b2.info.frozen > 0, 'Kid is IT on both screens and counts');
    t.ok(await said(A, /Tag! Kid is IT now\. Run!/) && await heard(B, /Tagged! You are IT now\. Count to 3!/), 'Dad: "Tag! Kid is IT now. Run!", Kid: "Tagged! You are IT now. Count to 3!"');
    t.ok(await A.evaluate(() => window.pokecraft.player.speedK === 1) && await waitFor(A, () => window.pokecraft.friendGames.state().info.sign), 'Dad walks at his own speed again and sees the sign over Kid');
    // away before Kid finishes counting: no tag-back
    await standAt(A, -8);
    await B.waitForTimeout(4500);
    const b3 = await fg(B);
    t.ok(b3.info.tags === 1 && b3.info.frozen === 0 && await B.evaluate(() => Math.abs(window.pokecraft.player.speedK - 1.1) < 1e-9), `no tag-back while counting; then Kid (IT) runs a little faster (${JSON.stringify(b3.info.itTime)})`);
    // a look and a click from close by tags too (Kid is not the leader: the leader counts it)
    await standAt(A, 6, 12); // (round Kid, not through: on Kid's screen Dad glides from spot to spot)
    await B.waitForTimeout(1500);
    await standAt(A, 6);
    await B.waitForTimeout(1500);
    await B.evaluate(() => { const g = window.pokecraft, k = [...g.mp.others.values()][0]; g.player.lookAt(k.pos.clone().setY(k.pos.y + 1)); });
    const pr = await waitFor(B, () => /Dad · click or E to tag!/.test(document.getElementById('prompt').textContent), null, 8000);
    if (!pr) console.log('  debug prompt:', await B.evaluate(() => { const g = window.pokecraft, k = [...g.mp.others.values()][0]; return [document.getElementById('prompt').textContent, g.friendGames.state().info, k.pos.distanceTo(g.player.pos), g.friendGames.prompt(k, 'x')]; }));
    t.ok(pr, 'looking at Dad from close by: "Dad · click or E to tag!"');
    const clk = await B.evaluate(() => { const g = window.pokecraft, k = [...g.mp.others.values()][0], pl = g.friendGames.play; const before = pl.info(); const did = g.interact(); return { did, before, claim: pl.claim, reach: pl.inReach(k), d: k.pos.distanceTo(g.player.pos) }; });
    const clicked = await both(A, B, () => window.pokecraft.friendGames.state().info.tags === 2);
    if (!clicked) console.log('  (click to tag:', JSON.stringify(clk), '| Dad', JSON.stringify((await fg(A)).info), '| Kid', JSON.stringify((await fg(B)).info), ')');
    t.ok(clicked, 'a click on Dad tags him');
    t.ok(await B.evaluate(() => document.getElementById('friend').classList.contains('hidden')), 'the click did not open the friend menu');
    // the play area and battles
    // (Dad is IT and counting: wait it out first)
    await waitFor(A, () => window.pokecraft.friendGames.state().info.frozen === 0, null, 8000);
    const edge = await A.evaluate(async () => {
      const g = window.pokecraft, c = g.friendGames.state().info.center, p = g.player.pos, { TAG } = await import('/src/tagrules.js');
      const free = p.clone(); free.x = c[0] + 60; free.z = c[1];
      const far = free.clone(); far.x += 30; const v0 = { x: 3, y: 0, z: 0 };
      g.friendGames.fence(far, free, v0); // 90 blocks from the middle: still inside
      const before = p.clone(); before.x = c[0] + TAG.radius - 1; before.z = c[1];
      const pos = before.clone(); pos.x = c[0] + TAG.radius + 1; const vel = { x: 3, y: 0, z: 0 };
      g.friendGames.fence(pos, before, vel);
      return { radius: TAG.radius, roam: Math.abs(far.x - (c[0] + 90)) < 1e-6 && v0.x === 3, back: pos.distanceTo(before) < 1e-6 && vel.x === 0 };
    });
    t.ok(edge.radius >= 100 && edge.roam, `the play area is big (owner 2026-11-27): ${edge.radius} blocks every way from where you began`);
    t.ok(edge.back && await heard(A, /edge of the play area/), 'stepping out of the play area puts you back, with a kind toast');
    const noBattle = await B.evaluate(async () => {
      const g = window.pokecraft, { makeCreature, buildModel } = await import('/src/species.js'), { Wild } = await import('/src/creatures.js');
      g.startBattle({ wild: new Wild(makeCreature('fluffin', 2), buildModel('fluffin'), g.player.pos.clone()) });
      g.duels.challenge([...g.mp.others.values()][0]);
      g.hideSeek.invite([...g.mp.others.values()][0]);
      return !g.inBattle && !g.duels.asking && !g.hideSeek.state().active;
    });
    t.ok(noBattle && await heard(B, /No battles during a game/), 'no battles, duels or hide and seek during tag');
    // time up
    await standAt(A, -8);
    await A.evaluate(async () => { const m = await import('/src/tagrules.js'), r = window.pokecraft.friendGames.play.round; m.TAG.time = r.t + 3; });
    await B.evaluate(async () => { const m = await import('/src/tagrules.js'); m.TAG.time = 1; }); // (the other side waits for the leader's word)
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active), 'time up ends the game on both sides');
    t.ok(await said(A, /Time's up! Dad was IT for \d+ s, Kid for \d+ s\./) && await said(B, /Time's up! Dad was IT for \d+ s, Kid for \d+ s\./) && await said(A, /(Dad|Kid) wins! 🏆 Good game!|It's a draw/) && await said(B, /(Dad|Kid) wins! 🏆 Good game!|It's a draw/), 'both hear who was IT for how long and who won');
    const clean = await Promise.all([A, B].map(p => p.evaluate(() => document.getElementById('hs-hud').classList.contains('hidden') && window.pokecraft.player.speedK === 1
      && [...window.pokecraft.mp.others.values()].every(a => !a.model.children.some(c => c.userData.tagIt)))));
    t.ok(clean[0] && clean[1], 'the chip and the IT! sign are gone, everybody walks at their own speed');
    t.ok(await waitFor(A, () => { const a = [...window.pokecraft.mp.others.values()][0]; return !a.inGame && a.lead?.visible; }) && await A.evaluate(() => /Next:/.test(window.pokecraft.ui.guideText)), 'afterwards the friend\'s lead creature is back, and the usual arrow');
    await A.evaluate(SHORT); await B.evaluate(SHORT);

    // real keys through the game's own loop: IT stands still while counting, walks afterwards
    await A.evaluate(() => { window.__toasts.length = 0; }); await B.evaluate(() => { window.__toasts.length = 0; });
    await standAt(A, 0); await standAt(B, 40, 12);
    await A.waitForTimeout(1500);
    await standAt(B, 4); await A.waitForTimeout(1200);
    await standAt(B, 4, 2);
    await invite(A, B, 'tag');
    await both(A, B, () => window.pokecraft.friendGames.active);
    await A.mouse.click(550, 300); // back into the game (the mouse is caught again)
    await waitFor(A, () => window.pokecraft.playing(), null, 8000);
    const x0 = await A.evaluate(() => { const g = window.pokecraft, p = g.player; p.yaw = Math.PI; p.pitch = 0; g.friendGames.play.round.frozen = 3; return [p.pos.x, p.pos.z]; }); // (count from here: getting the mouse back took a moment)
    await A.keyboard.down('KeyW');
    await A.waitForTimeout(1200);
    const x1 = await A.evaluate(() => [window.pokecraft.player.pos.x, window.pokecraft.player.pos.z, window.pokecraft.friendGames.state().info.frozen]);
    await waitFor(A, () => window.pokecraft.friendGames.state().info.frozen === 0, null, 8000);
    await A.waitForTimeout(2500);
    await A.keyboard.up('KeyW');
    const x2 = await A.evaluate(() => [window.pokecraft.player.pos.x, window.pokecraft.player.pos.z]);
    t.ok(x1[2] > 0 && Math.hypot(x1[0] - x0[0], x1[1] - x0[1]) < 0.02 && Math.hypot(x2[0] - x0[0], x2[1] - x0[1]) > 0.15, `real keys: W does nothing while IT counts, and walks after "Go!" (${Math.hypot(x1[0] - x0[0], x1[1] - x0[1]).toFixed(2)} then ${Math.hypot(x2[0] - x0[0], x2[1] - x0[1]).toFixed(2)} blocks)`);
    t.ok(await said(A, /Go! Catch Kid!/), 'after the count: "Go! Catch Kid!"');
    // Stop from the other one's pause box
    await pause(A);
    await pause(B);
    t.ok(await waitFor(B, () => { const bs = [...document.querySelectorAll('#mp button')].map(b => b.textContent); return bs.includes('Stop tag') && !bs.some(x => /Hide and seek/.test(x)); }), 'the pause box has "Stop tag" (and no hide and seek button meanwhile)');
    const stopAt = await B.evaluate(() => { const r = [...document.querySelectorAll('#mp button')].find(b => b.textContent === 'Stop tag').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await B.mouse.click(stopAt[0], stopAt[1]); // (a real click at the button)
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active) && await heard(A, /Kid stopped the game\./) && await said(B, /You stopped the game\./), 'Stop ends it for both, with words');
    // Both sides always agree that a game is on (owner 2026-11-27: "on my screen he looked like IT" while his tablet was not playing).
    // No single message is trusted: each of these loses one and the game still ends up the same on both screens.
    const drop = (page, what, n = 99) => page.evaluate(([what, n]) => {
      const mp = window.pokecraft.mp; mp.__send ??= mp.sendPlay.bind(mp); window.__dropped = []; let left = n;
      mp.sendPlay = (to, d) => { if (left > 0 && (d.type === what || (d.type === 'g' && `g:${d.k}` === what))) { left--; window.__dropped.push(what); return; } mp.__send(to, d); };
    }, [what, n]);
    const undrop = page => page.evaluate(() => { const mp = window.pokecraft.mp; if (mp.__send) mp.sendPlay = mp.__send; });
    const quiet = page => page.evaluate(() => { window.__toasts.length = 0; });
    await standAt(A, 0); await standAt(B, 4, 3);
    await A.waitForTimeout(1500);
    // a) the start never arrives: the next heartbeat starts the friend's game
    await drop(A, 'start');
    await invite(A, B, 'tag');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().started) && await A.evaluate(() => window.__dropped.length === 1), 'a lost start: the friend\'s game still starts, a second later');
    await undrop(A);
    await drop(A, 'open');
    await A.evaluate(() => window.pokecraft.friendGames.stop());
    await both(A, B, () => !window.pokecraft.friendGames.active);
    await A.waitForTimeout(1200);
    await invite(A, B, 'tag');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().started) && await A.evaluate(() => window.__dropped.length === 1), 'a lost "open": the start itself brings the friend in');
    const s1 = [await fg(A), await fg(B)];
    t.ok(s1[1].info.it === s1[0].info.me && Math.abs(s1[0].info.center[0] - s1[1].info.center[0]) < 0.01 && !s1[1].leader, 'and it is the same game: Dad is IT, the same play area');
    await undrop(A);
    // b) the friend's game is gone and the leader was not told: the leader stops too (no lonely IT! sign)
    await quiet(A);
    await drop(B, 'stop', 0); // (a reset says nothing by itself)
    await B.evaluate(() => window.pokecraft.friendGames.reset());
    t.ok(await waitFor(A, () => !window.pokecraft.friendGames.active, null, 6000) && await said(A, /Kid is not playing any more\. The game is over\./), 'the friend\'s game is gone without a word: Dad\'s game stops within a few seconds ("Kid is not playing any more.")');
    t.ok(await A.evaluate(() => document.getElementById('hs-hud').classList.contains('hidden') && ![...window.pokecraft.mp.others.values()].some(a => a.model.children.some(c => c.userData.tagIt))), 'no chip and no IT! sign are left on Dad\'s screen');
    await undrop(B);
    // c) the leader's game is gone and the friend was not told: the friend asks, and stops
    await A.waitForTimeout(1200);
    await invite(A, B, 'tag');
    await both(A, B, () => window.pokecraft.friendGames.active);
    await quiet(B);
    await drop(A, 'stop', 0);
    await A.evaluate(() => window.pokecraft.friendGames.reset());
    t.ok(await waitFor(B, () => !window.pokecraft.friendGames.active, null, 8000) && await said(B, /Dad is not playing any more\. The game is over\./), 'the leader\'s game is gone without a word: Kid\'s game asks and stops ("Dad is not playing any more.")');
    await undrop(A);
    // d) the last word (time is up, who won) never arrives: it is said again
    await A.waitForTimeout(1200);
    await invite(A, B, 'tag');
    await both(A, B, () => window.pokecraft.friendGames.active);
    await quiet(B);
    await drop(A, 'g:state', 1);
    await A.evaluate(async () => { const m = await import('/src/tagrules.js'), r = window.pokecraft.friendGames.play.round; m.TAG.time = r.t + 2; });
    await B.evaluate(async () => { const m = await import('/src/tagrules.js'); m.TAG.time = 1; });
    t.ok(await waitFor(A, () => !window.pokecraft.friendGames.active, null, 10000) && await A.evaluate(() => window.__dropped.length === 1), 'time is up on Dad\'s side and his last word is lost');
    t.ok(await waitFor(B, () => !window.pokecraft.friendGames.active, null, 8000) && await said(B, /Time's up! Dad was IT for \d+ s, Kid for \d+ s\./) && await said(B, /wins! 🏆 Good game!|It's a draw/), 'Kid still hears the result a moment later');
    await undrop(A);
    await A.evaluate(SHORT); await B.evaluate(SHORT);
    // e) the friend goes silent (a sleeping tablet): the leader stops by itself
    await A.waitForTimeout(1200);
    await A.evaluate(() => import('/src/friendgames.js').then(m => { m.PLAY.lost = 4; }));
    await invite(A, B, 'tag');
    await both(A, B, () => window.pokecraft.friendGames.active);
    await quiet(A);
    await drop(B, 'pong');
    t.ok(await waitFor(A, () => !window.pokecraft.friendGames.active, null, 12000) && await said(A, /Lost touch with Kid\. The game is over\./), 'a friend who stops answering: Dad\'s game ends ("Lost touch with Kid.")');
    await undrop(B);
    t.ok(await waitFor(B, () => !window.pokecraft.friendGames.active, null, 10000), 'and Kid\'s game ends too when it asks');
    await A.evaluate(() => import('/src/friendgames.js').then(m => { m.PLAY.lost = 10; }));
    await A.waitForTimeout(1200);

    // busy; a leader who goes quiet; leaving
    await standAt(A, 0); await standAt(B, 4);
    await B.evaluate(() => { window.pokecraft.duels.incoming = { id: 'x', from: 'zz', name: 'Zed', team: [], seed: 1, timer: setTimeout(() => {}, 100) }; });
    await A.evaluate(() => { const g = window.pokecraft; g.friendGames.invite('tag', [...g.mp.others.values()][0]); });
    t.ok(await heard(A, /Kid is busy right now/), 'a busy friend answers "busy"');
    await B.evaluate(() => { clearTimeout(window.pokecraft.duels.incoming.timer); window.pokecraft.duels.incoming = null; });
    await B.evaluate(() => import('/src/friendgames.js').then(m => { m.PLAY.lost = 4; }));
    await invite(A, B, 'tag');
    await both(A, B, () => window.pokecraft.friendGames.active);
    await A.evaluate(() => clearInterval(window.pokecraft.friendGames.ticker));
    t.ok(await waitFor(B, () => !window.pokecraft.friendGames.active, null, 20000) && await said(B, /Lost touch with Dad/), 'the other side ends the game when the leader goes quiet');
    await A.evaluate(() => { const g = window.pokecraft; g.friendGames.reset(); g.friendGames.ticker = setInterval(() => g.friendGames.tick(), 500); });
    await invite(A, B, 'tag');
    await both(A, B, () => window.pokecraft.friendGames.active);
    await B.evaluate(() => window.pokecraft.mp.close());
    t.ok(await waitFor(A, () => !window.pokecraft.friendGames.active, null, 15000) && await said(A, /Kid left, so the game is over\./), 'Dad\'s game ends when Kid leaves');
    t.ok(!A.errors.length && !B.errors.length, `tag: no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
    await A.context().close(); await B.context().close();
  }

  /* ------------------------------------------------ Playland (two browsers) ------------------------------------------------ */
  if (want('sports')) {
    const [A, B] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(B, 1); await pause(B);
    await share(A, B);
    const placeIs = (page, id) => waitFor(page, i => window.pokecraft.place === i && !window.pokecraft.realms.busy, id, 90000);
    await A.evaluate(() => { window.pokecraft.champion = true; }); await B.evaluate(() => { window.pokecraft.champion = true; });
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(B, 'swirl');
    const cell = await A.evaluate(() => {
      const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'stadium'), p = g.player;
      p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
      return f.cloth[Math.floor(f.cloth.length / 2)];
    });
    await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(A, 'playland');
    await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
    t.ok(await placeIs(B, 'playland'), 'both friends are in Playland');
    // the live parts by hand: clocks run without the mouse caught
    const prep = page => page.evaluate(() => {
      const g = window.pokecraft, S = g.gymLive.of('part:stadium'), R = g.gymLive.of('part:race');
      S.playing = () => true; R.playing = () => true;
      g.ui.closePanel?.();
      window.__S = S; window.__R = R;
      window.__steps = n => { for (let i = 0; i < n; i++) S.update(0.05); };
      window.__ball = () => { const b = g.friendGames.play.ball.pos; return [b.x, b.y, b.z]; };
    });
    await prep(A); await prep(B);
    await A.evaluate(() => { const g = window.pokecraft; g.player.pos.set(60.5, 11, 150.5); g.player.vel.set(0, 0, 0); });
    await B.evaluate(() => { const g = window.pokecraft; g.player.pos.set(63.5, 11, 150.5); g.player.vel.set(0, 0, 0); });
    await waitFor(A, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return a?.here && a.pos.distanceTo(g.player.pos) < 6; });
    await waitFor(B, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return a?.here && a.pos.distanceTo(g.player.pos) < 6; });

    // the friend menu in Playland
    await openMenu(A);
    const m2 = await menu(A);
    t.ok(m2.map(x => x.word).join('|') === 'Battle|Trade|Hide and seek|Tag|Football|Basketball|Kart race' && ['tag', 'football', 'hoops', 'race'].every(id => !m2.find(x => x.id === id).dim),
      `in Playland the friend menu also has Football, Basketball and Kart race (${m2.map(x => `${x.word}${x.dim ? ' (dim)' : ''}`).join('|')})`);
    const fits = await A.evaluate(() => [...document.querySelectorAll('#friend .fm-btn')].every(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height >= 56; }));
    t.ok(fits, 'all seven choices fit on the screen, each big enough');
    await shot(A, 'friend-menu-playland.png');
    await A.evaluate(() => window.pokecraft.closeFriend());

    /* ---- football ---- */
    const keysBefore = await Promise.all([A, B].map(p => p.evaluate(() => JSON.stringify([window.pokecraft.beaten, window.pokecraft.cubes, window.pokecraft.stars]))));
    const askF = await invite(A, B, 'football');
    t.ok(/Dad wants to play football with you! First to 3 wins\./.test(askF), `Kid is asked ("${askF}")`);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info?.phase === 'ready'), 'football: both are at the kick-off');
    const k1 = await Promise.all([A, B].map(p => p.evaluate(() => {
      const g = window.pokecraft, S = window.__S, i = g.friendGames.state().info, pl = g.player;
      return { x: pl.pos.x, z: pl.pos.z, y: pl.pos.y, yaw: pl.yaw, side: i.side, has: i.has, n: i.kickN, score: i.score.join(), signs: i.signs, ball: window.__ball(), spot: S.part.ballSpot,
        hidden: [...S.keepers, S.dee.mesh, S.bo.mesh].every(m => !m.visible), match: !!S.match, chip: document.getElementById('hs-hud').textContent, stadiumChip: !document.getElementById('score-chip') || document.getElementById('score-chip').classList.contains('hidden') };
    })));
    t.ok(k1[0].side === 0 && k1[1].side === 1 && k1[0].has === 1 && k1[1].has === 1 && Math.abs(k1[0].x - 48) < 0.01 && Math.abs(k1[1].x - 61) < 0.01 && Math.abs(k1[0].z - 162) < 0.01 && k1[0].y === 11,
      `football: Kid (asked) gets the ball and stands 3 from it, Dad 10 away in his half (Dad x ${k1[0].x}, Kid x ${k1[1].x})`);
    t.ok(k1.every(k => k.hidden && k.match && k.signs === 2 && Math.hypot(k.ball[0] - k.spot[0], k.ball[2] - k.spot[2]) < 0.01), 'football: the keepers, Dee and Bo step aside; two signs; the ball is on the centre spot');
    t.ok(k1.every(k => /⚽ Dad 0 · Kid 0/.test(k.chip) && /Get ready/.test(k.chip)), `the chip: "⚽ Dad 0 · Kid 0 / Get ready..." (${k1[0].chip})`);
    t.ok(await said(A, /Football with Kid! First to 3 wins\./) && await said(A, /Kid's ball! Get ready/) && await said(B, /Your ball! Get ready/), 'words at the kick-off ("Your ball! Get ready...")');
    const pinned = await B.evaluate(() => {
      const g = window.pokecraft, p = g.player.pos, before = p.clone(), pos = p.clone(); pos.x -= 0.5; const vel = { x: -4, y: 0, z: 0 };
      g.friendGames.fence(pos, before, vel);
      return g.friendGames.state().info.phase !== 'ready' || (pos.distanceTo(before) < 1e-6 && vel.x === 0);
    });
    t.ok(pinned, 'nobody walks at "Get ready"');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.phase === 'play') && await said(A, /^Go!$/), 'then "Go!" on both screens');
    await shot(A, 'match-football-kickoff.png');
    const aimA = await A.evaluate(() => { const g = window.pokecraft, a = g.gymLive.aim(g.player.pos); return a && { x: a.x, text: a.text('→', 12) }; });
    t.ok(aimA && aimA.x > 80 && /⚽ Score there! → 12m/.test(aimA.text), `the guide points Dad at the east goal (${JSON.stringify(aimA)})`);
    // Kid runs into the ball: it is Kid's, and it rolls on Dad's screen too
    await B.evaluate(() => {
      const g = window.pokecraft, p = g.player, b = g.friendGames.play.ball.pos;
      p.pos.set(b.x + 0.65, 11, b.z); p.vel.set(-6, 0, 0); p.yaw = Math.PI / 2;
      window.__steps(2); p.vel.set(0, 0, 0);
    });
    t.ok(await waitFor(A, () => { const i = window.pokecraft.friendGames.state().info; return i.q > 1000 && !i.mine && i.ball.x < 57.9; }), 'Kid runs into the ball: Dad sees it roll, and it is Kid\'s ball');
    const kidMine = (await fg(B)).info;
    t.ok(kidMine.mine && kidMine.q > 1000, 'on Kid\'s screen the ball is Kid\'s');
    await B.evaluate(() => window.__steps(160)); await A.evaluate(() => window.__steps(160));
    await B.waitForTimeout(2500);
    await B.evaluate(() => window.__steps(45)); // a resting ball is sent again every 2 s
    t.ok(await waitFor(A, bb => { window.__steps(1); const b = window.__ball(); return Math.hypot(b[0] - bb[0], b[2] - bb[2]) < 0.05; }, await B.evaluate(() => window.__ball()), 15000), 'at rest the ball is in the same place on both screens');
    // a ball never goes through the friend (owner 2026-11-27): Kid stands 2.5 blocks in front of Dad's hard kick
    await B.evaluate(() => {
      const g = window.pokecraft, S = window.__S, p = g.player;
      p.pos.set(63.5, 11, 162); p.vel.set(0, 0, 0);
      window.__maxX = -99;
      if (!S.__u) { S.__u = S.update.bind(S); S.update = dt => { S.__u(dt); if (g.friendGames.play?.ball) window.__maxX = Math.max(window.__maxX, g.friendGames.play.ball.pos.x); }; }
    });
    await waitFor(A, () => Math.abs([...window.pokecraft.mp.others.values()][0].pos.x - 63.5) < 0.03);
    const wall = await A.evaluate(() => {
      const g = window.pokecraft, m = g.friendGames.play, S = window.__S, p = g.player;
      m.ball.reset([61, 11.401, 162]); m.shared.take();
      p.pos.set(59.6, 11, 162); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0;
      g.gymLive.use(p); S.held.t0 = S.t - 0.6; g.gymLive.release(p);
      const v = m.ball.vel.x;
      let max = -99;
      for (let i = 0; i < 50; i++) { S.update(0.05); max = Math.max(max, m.ball.pos.x); }
      return { v, max, blocks: m.info().blocks, vx: m.ball.vel.x };
    });
    t.ok(Math.abs(wall.v - 14) < 0.01 && wall.blocks >= 1 && wall.max < 63.5 - 0.7, `Dad kicks hard at Kid from 2.5 blocks: on Dad's screen the ball bounces off Kid (it gets to x ${wall.max.toFixed(2)}, Kid stands at 63.5)`);
    await waitFor(B, () => window.pokecraft.friendGames.state().info.q > 1001, null, 10000);
    const wallB = await B.evaluate(() => { window.__steps(60); return { max: window.__maxX, info: window.pokecraft.friendGames.state().info }; });
    t.ok(wallB.max < 63.5 && wallB.max > 60, `and on Kid's screen it never passes Kid either (it gets to x ${wallB.max.toFixed(2)})`);
    // owner 2026-11-28: during a game E does the game's own thing and nothing else: Kid stands right in the crosshair, behind the ball
    await B.evaluate(() => { const p = window.pokecraft.player; p.pos.set(60, 11, 165); p.vel.set(0, 0, 0); });
    await waitFor(A, () => Math.abs([...window.pokecraft.mp.others.values()][0].pos.x - 60) < 0.03);
    await A.evaluate(() => {
      const g = window.pokecraft, m = g.friendGames.play, p = g.player;
      m.ball.reset([58, 11.401, 165]); m.shared.take();
      p.pos.set(56.6, 11, 165); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0;
    });
    const picked = await A.evaluate(() => { const g = window.pokecraft, hit = g.mp.pick(g.player.eyePos, g.player.forward, 6); return !!hit; });
    t.ok(picked && await waitFor(A, () => /Hold E and let go to kick/.test(document.getElementById('prompt').textContent), null, 10000), `Kid is right under Dad's crosshair, and still the prompt is the ball's ("${await A.evaluate(() => document.getElementById('prompt').textContent)}")`);
    const eKick = await A.evaluate(() => { const g = window.pokecraft, S = window.__S; const did = g.interact(true); const held = !!S.held; g.gymLive.release(g.player);
      return { did, held, menu: !document.getElementById('friend').classList.contains('hidden'), vx: g.friendGames.play.ball.vel.x }; });
    t.ok(eKick.did && eKick.held && !eKick.menu && eKick.vx > 0, `E kicks; it never opens the friend menu (${JSON.stringify(eKick)})`);
    // Dad (the leader) takes it and scores with a real hold and let go
    const kick = (page, x, dir, hold = 0.6) => page.evaluate(([x, dir, hold]) => {
      const g = window.pokecraft, m = g.friendGames.play, S = window.__S, p = g.player;
      m.ball.reset([x, 11.401, 162]); m.shared.take();           // (the test puts the ball in front of a goal)
      p.pos.set(x - dir * 1.4, 11, 162); p.vel.set(0, 0, 0); p.yaw = dir > 0 ? -Math.PI / 2 : Math.PI / 2; p.pitch = 0;
      const word = g.gymLive.near(p), holds = g.gymLive.holds(p);
      g.gymLive.use(p); const held = !!S.held; S.held.t0 = S.t - hold; const ring = S.ring.g.visible || (S.drawAll(), S.ring.g.visible);
      g.gymLive.release(p);
      const v = m.ball.vel.x;
      for (let i = 0; i < 60 && g.friendGames.state().info.phase === 'play'; i++) S.update(0.05);
      return { word, holds, held, ring, v, info: g.friendGames.state().info };
    }, [x, dir, hold]);
    const g1 = await kick(A, 76, 1);
    t.ok(g1.word === 'Kick!' && g1.holds && g1.held && g1.ring && Math.abs(g1.v - 14) < 0.01, `Dad: the button says Kick!, it is held (the power ring shows), a green let-go is a hard drive (${g1.v.toFixed(1)} blocks/s)`);
    t.ok(g1.info.phase === 'goal' && g1.info.score.join() === '1,0', `Dad's ball is in the east goal: 1 : 0 (${JSON.stringify(g1.info.score)})`);
    t.ok(await waitFor(B, () => window.pokecraft.friendGames.state().info.score.join() === '1,0') && await heard(B, /GOAL! Dad scores! ⚽ Dad 1 · Kid 0/) && await said(A, /GOAL! Dad scores! ⚽ Dad 1 · Kid 0/), 'both hear "GOAL! Dad scores! ⚽ Dad 1 · Kid 0"');
    t.ok(await both(A, B, () => { const i = window.pokecraft.friendGames.state().info; return i.kickN === 2 && i.has === 1; }), 'a new kick-off: Kid (scored on) gets the ball');
    const k2 = await Promise.all([A, B].map(p => p.evaluate(() => { const g = window.pokecraft; return [g.player.pos.x, ...window.__ball()]; })));
    t.ok(Math.abs(k2[0][0] - 48) < 0.01 && Math.abs(k2[1][0] - 61) < 0.01 && k2.every(k => Math.abs(k[1] - 58) < 0.01 && Math.abs(k[3] - 162) < 0.01), 'everybody is back on their spot, the ball in the middle');
    await both(A, B, () => window.pokecraft.friendGames.state().info.phase === 'play');
    // Kid (not the leader) scores in the west goal: Kid's browser calls it, Dad's counts it
    const g2 = await kick(B, 40, -1);
    t.ok(Math.abs(g2.v + 14) < 0.01, 'Kid kicks west');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.score.join() === '1,1') && await heard(A, /GOAL! Kid scores! ⚽ Dad 1 · Kid 1/) && await heard(B, /GOAL! Kid scores! ⚽ Dad 1 · Kid 1/), 'Kid\'s goal counts on both screens: 1 : 1');
    t.ok(await both(A, B, () => { const i = window.pokecraft.friendGames.state().info; return i.kickN === 3 && i.has === 0 && i.phase === 'play'; }), 'kick-off 3: now Dad gets the ball');
    const k3 = await Promise.all([A, B].map(p => p.evaluate(() => window.pokecraft.player.pos.x)));
    t.ok(Math.abs(k3[0] - 55) < 0.01 && Math.abs(k3[1] - 68) < 0.01, `Dad stands 3 from the ball, Kid 10 (${k3})`);
    // too much power: over the bar, never a goal
    const over = await kick(A, 76, 1, 1.2);
    t.ok(over.info.score.join() === '1,1' && await said(A, /Too much power! It flew over the bar\./), 'held too long: over the bar, no goal');
    await A.evaluate(() => window.__steps(40));
    t.ok(await waitFor(B, () => { const b = window.__ball(); return Math.hypot(b[0] - 58, b[2] - 162) < 0.05; }) && await heard(B, /Out! The ball is back in the middle\./), 'the ball goes back to the middle on both screens ("Out!")');
    // an own goal counts for the other one
    const own = await kick(A, 40, -1);
    t.ok(own.info.score.join() === '1,2' && await heard(B, /GOAL! Kid scores!/), 'a ball in your own goal counts for your friend');
    await both(A, B, () => { const i = window.pokecraft.friendGames.state().info; return i.kickN === 4 && i.phase === 'play'; });
    // the pitch is the field: nobody leaves it
    const edge = await A.evaluate(() => {
      const g = window.pokecraft, b = window.__S.part.pitchBox, p = g.player.pos, before = p.clone(); before.x = b.x1 - 0.6;
      const pos = before.clone(); pos.x = b.x1 - 0.2; const vel = { x: 3, y: 0, z: 0 };
      g.friendGames.fence(pos, before, vel);
      return Math.abs(pos.x - before.x) < 1e-6 && vel.x === 0;
    });
    t.ok(edge, 'nobody walks off the pitch during a match');
    // Kid wins 3 : 1
    await kick(B, 40, -1);
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active), 'the third goal ends the match on both sides');
    t.ok(await said(A, /Kid wins 3 : 1! 🏆 Good game!/) && await said(B, /Kid wins 3 : 1! 🏆 Good game!/), 'both hear "Kid wins 3 : 1! 🏆 Good game!"');
    const after = await Promise.all([A, B].map(p => p.evaluate(() => {
      const g = window.pokecraft, S = window.__S, f = S.foot.pos, s = S.part.ballSpot;
      return { visible: [...S.keepers, S.dee.mesh, S.bo.mesh].every(m => m.visible), match: !!S.match, ball: Math.hypot(f.x - s[0], f.z - s[2]) < 0.01, chip: document.getElementById('hs-hud').classList.contains('hidden'),
        signs: g.scene.children.filter(c => c.userData.matchSign).length, saved: JSON.stringify([g.beaten, g.cubes, g.stars]) };
    })));
    t.ok(after.every(a => a.visible && !a.match && a.ball && a.chip && a.signs === 0), 'afterwards the keepers, Dee and Bo are back, the ball is on its spot, the signs and the chip are gone');
    t.ok(after[0].saved === keysBefore[0] && after[1].saved === keysBefore[1], 'a match saves nothing: no goal keys for the Captain, no cubes, no star');
    const own1 = await A.evaluate(() => { const g = window.pokecraft, S = window.__S; S.rivals = false; S.update(0.05); return typeof g.gymLive.aim(g.player.pos)?.text === 'function' && !S.match; });
    t.ok(own1, 'the stadium\'s own game goes on as before');

    /* ---- basketball ---- */
    await A.evaluate(() => { const g = window.pokecraft; g.player.pos.set(57.5, 11, 200.5); }); await B.evaluate(() => { const g = window.pokecraft; g.player.pos.set(60.5, 11, 200.5); });
    await A.waitForTimeout(1200);
    const askH = await invite(A, B, 'hoops');
    t.ok(/Dad wants to play basketball with you! First to 5 wins\./.test(askH), `Kid is asked ("${askH}")`);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info?.phase === 'ready'), 'basketball: both are at the tip-off');
    const h1 = await Promise.all([A, B].map(p => p.evaluate(() => { const g = window.pokecraft; return [g.player.pos.x, g.player.pos.z, ...window.__ball()]; })));
    t.ok(Math.abs(h1[0][0] - 53) < 0.01 && Math.abs(h1[1][0] - 66) < 0.01 && h1.every(h => Math.abs(h[2] - 64) < 0.01 && Math.abs(h[1] - 203) < 0.01), `Kid gets the ball in Kid's half and stands behind it; Dad guards his hoop (${h1.map(h => h[0])}, ball x ${h1[0][2]})`);
    await both(A, B, () => window.pokecraft.friendGames.state().info.phase === 'play');
    // Kid dribbles closer (a run into the ball), then Shoot!: the ball is in Kid's hands on Dad's screen too
    const shoot = await B.evaluate(() => {
      const g = window.pokecraft, m = g.friendGames.play, S = window.__S, p = g.player;
      m.ball.reset([57, 11.401, 203]); m.shared.take();
      p.pos.set(58.3, 11, 203); p.vel.set(0, 0, 0); p.yaw = Math.PI / 2; p.pitch = 0; p.onGround = true;
      const word = g.gymLive.near(p);
      g.gymLive.use(p);
      S.update(0.05);
      return { word, held: !!S.held, sh: m.shared.held, mine: m.shared.mine, by: m.ball.pos.y - p.pos.y };
    });
    t.ok(shoot.word === 'Shoot!' && shoot.held && shoot.sh && shoot.mine && Math.abs(shoot.by - 2.05) < 0.01, 'Kid: the button says Shoot!, the ball is in Kid\'s hands');
    t.ok(await waitFor(A, () => { const g = window.pokecraft, i = g.friendGames.state().info, a = [...g.mp.others.values()][0]; window.__steps(1); return i.held && !i.mine && Math.hypot(i.ball.x - a.pos.x, i.ball.z - a.pos.z) < 0.01 && !g.gymLive.near(g.player); }), 'on Dad\'s screen the ball is over Kid\'s head, and Dad cannot take it');
    const basket = await B.evaluate(() => {
      const g = window.pokecraft, S = window.__S, p = g.player;
      S.held.apex = S.t; // let go at the very top of the jump
      g.gymLive.release(p);
      for (let i = 0; i < 80 && g.friendGames.state().info.phase === 'play' && !g.friendGames.state().info.claim; i++) S.update(0.05);
      return g.friendGames.state().info;
    });
    t.ok(basket.claim || basket.phase === 'goal' || basket.score.join() === '0,1', `a clean shot drops through the west hoop: Kid's browser calls the basket (${basket.phase})`);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.score.join() === '0,1') && await heard(A, /Swish! Kid scores! 🏀 Dad 0 · Kid 1/) && await heard(B, /Swish! Kid scores! 🏀 Dad 0 · Kid 1/), 'Kid\'s basket counts on both screens: "Swish! Kid scores! 🏀 Dad 0 · Kid 1"');
    t.ok(await both(A, B, () => { const i = window.pokecraft.friendGames.state().info; return i.kickN === 2 && i.has === 0 && Math.abs(i.ball.x - 52) < 0.01; }), 'the next ball is Dad\'s, in Dad\'s half');
    await shot(A, 'match-basketball.png');
    // Stop
    await B.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active) && await heard(A, /Kid stopped the game\./) && await A.evaluate(() => !window.__S.match && window.__S.bo.mesh.visible), 'Stop ends the match for both; Blocker Bo is back');

    /* ---- the kart race ---- */
    await A.evaluate(() => { window.__R.manual = true; }); await B.evaluate(() => { window.__R.manual = true; });
    const rio0 = await A.evaluate(() => { const n = window.pokecraft.npcs.list.find(n => n.kind === 'boss' && n.def?.id === 'race'); return [n.pos.x, n.pos.z]; });
    const askR = await invite(A, B, 'race');
    t.ok(/Dad wants to race you! 3 laps in karts\./.test(askR), `Kid is asked ("${askR}")`);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info?.duel && window.__R.state === 'count'), 'race: both are on the grid, lamps counting');
    const r1 = await Promise.all([A, B].map(p => p.evaluate(() => {
      const g = window.pokecraft, R = window.__R, grid = R.part.grid, n = g.npcs.list.find(n => n.kind === 'boss' && n.def?.id === 'race');
      return { car: !!R.car, carry: g.player.carry === R.rider, at: [R.car.x, R.car.z], player: [grid.player[0], grid.player[2]], boss: [grid.boss[0], grid.boss[2]], rio: [n.pos.x, n.pos.z], won: R.won, losses: R.losses };
    })));
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01;
    t.ok(r1.every(r => r.car && r.carry) && near(r1[0].at, r1[0].player) && near(r1[1].at, r1[1].boss), 'each sits in their own kart: Dad on his lane, Kid on the other');
    t.ok(r1.every(r => near(r.rio, rio0)), 'Racer Rio stays on his stand and watches');
    await A.evaluate(() => window.__R.step(0.05)); await B.waitForTimeout(800);
    t.ok(await waitFor(A, () => { const g = window.pokecraft, R = window.__R, a = [...g.mp.others.values()][0]; R.step(0.01); return R.kart?.visible && Math.hypot(R.kart.position.x - a.pos.x, R.kart.position.z - a.pos.z) < 0.01; }), 'Dad sees Kid\'s kart under Kid');
    await shot(A, 'race-grid.png');
    // GO on both; Kid drives a lap and a bit: Dad sees how far Kid is, and that he is 2nd
    const go = await Promise.all([A, B].map(p => p.evaluate(() => { const R = window.__R; R.step(1.6); R.step(1.6); return R.state; })));
    t.ok(go.join() === 'race,race' && await said(A, /^GO!$/) && await said(B, /^GO!$/), 'GO! on both screens');
    const drive = (page, v, until) => page.evaluate(([v, until]) => {
      const g = window.pokecraft, R = window.__R, track = R.track, Y = R.part.y, p = g.player;
      let s = window.__s ?? -1.5, t = 0;
      const stop = () => R.state !== 'race' || (until != null && s > until);
      while (!stop() && t < 400) {
        s += v / 20;
        const a = track.at(s, -1.5), yy = Y + 1 + Math.round(track.project(a.x, a.z).h);
        R.car.reset(a.x, yy, a.z, a.heading); p.pos.set(a.x, yy, a.z); p.vel.set(0, 0, 0);
        R.step(1 / 20); t += 1 / 20;
      }
      window.__s = s;
      return { state: R.state, lap: R.lap, clock: R.clock, L: track.L, info: g.friendGames.state().info };
    }, [v, until ?? null]);
    const L = await A.evaluate(() => window.__R.track.L);
    const d1 = await drive(B, 13, L * 1.3);
    t.ok(d1.state === 'race' && d1.lap === 1, `Kid drives a lap and a bit (lap ${d1.lap + 1} of 3)`);
    t.ok(await waitFor(A, l => { window.__R.step(0.01); return window.pokecraft.friendGames.state().info.theirP > l; }, L, 15000), 'Dad\'s game knows how far Kid is');
    t.ok(await waitFor(A, () => /🏁 Race with Kid/.test(document.getElementById('hs-hud').textContent) && /Lap 1\/3 · You're 2nd!/.test(document.getElementById('hs-hud').textContent)), 'Dad\'s chip: "Lap 1/3 · You\'re 2nd!"');
    // Kid finishes first; Dad finishes later with a bigger time: the leader says Kid won
    const d2 = await drive(B, 13);
    t.ok(d2.state === 'done' && d2.info.times[1] > 20 && await said(B, /🏁 You finished in /), `Kid finishes three laps (${d2.clock.toFixed(1)} s)`);
    t.ok(await waitFor(A, () => window.pokecraft.friendGames.state().info.times[1] > 0), 'Kid\'s time reaches Dad');
    t.ok((await fg(A)).info.result === 'none', 'Dad is still driving (his clock has not passed Kid\'s time): not decided yet');
    const d3 = await drive(A, 9);
    t.ok(d3.state === 'done' && d3.info.times[0] > d3.info.times[1] && d3.info.result === 1, `Dad finishes later (${d3.clock.toFixed(1)} s): Kid wins`);
    t.ok(await waitFor(B, () => window.pokecraft.friendGames.state().info?.result === 1 || !window.pokecraft.friendGames.active) && await heard(B, /🏁 Kid wins the race by \d+\.\d s! 🏆/) && await said(A, /🏁 Kid wins the race by \d+\.\d s! 🏆/), 'both hear "🏁 Kid wins the race by ... s! 🏆"');
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active, null) && await both(A, B, () => { window.__R.step(0.01); return !window.__R.car && !window.__R.duel && window.__R.state === 'idle' && !window.pokecraft.player.carry; }), 'a moment later both are out of their karts and the track is Rio\'s again');
    const r2 = await A.evaluate(() => { const g = window.pokecraft, R = window.__R; return { won: R.won, losses: R.losses, saved: JSON.stringify([g.beaten, g.cubes, g.stars]) }; });
    t.ok(r2.won === r1[0].won && r2.losses === r1[0].losses && r2.saved === keysBefore[0], 'a friends\' race changes nothing of Rio\'s race and saves nothing');
    // a race stops for both when one stops; leaving Playland stops a game
    await A.evaluate(() => { window.__s = undefined; }); await B.evaluate(() => { window.__s = undefined; });
    await invite(B, A, 'race');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info?.duel), 'Kid can ask too: then Kid leads');
    t.ok((await fg(B)).leader && await B.evaluate(() => { const R = window.__R; return Math.hypot(R.car.x - R.part.grid.player[0], R.car.z - R.part.grid.player[2]) < 0.01; }), 'the one who asked is on the first lane');
    await A.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active && !window.__R.car), 'Stop: both karts are gone');
    await invite(A, B, 'tag');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().kind === 'tag'), 'tag works in Playland too');
    await B.evaluate(() => window.pokecraft.friendGames.stop());
    await both(A, B, () => !window.pokecraft.friendGames.active);
    t.ok(!A.errors.length && !B.errors.length, `Playland: no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
    await A.context().close(); await B.context().close();
  }

  /* ------------------------------------------------ two iPads ------------------------------------------------ */
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
    // the menu with all seven choices (as in Playland) fits an iPad
    await TA.evaluate(async () => { const m = await import('/src/friendgames.js'); for (const d of Object.values(m.FRIEND_GAMES)) { d.shownWas = d.shown; d.shown = () => true; } });
    await openMenu(TA);
    const fit = await TA.evaluate(() => { const bs = [...document.querySelectorAll('#friend .fm-btn')], c = document.getElementById('friend-close').getBoundingClientRect();
      return { n: bs.length, ok: bs.every(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height >= 56 && r.width >= 200; }), close: c.bottom <= innerHeight && c.top >= 0 }; });
    t.ok(fit.n === 7 && fit.ok && fit.close, `iPad: seven choices and Close all fit, each big enough to tap (${JSON.stringify(fit)})`);
    await shot(TA, 'friend-menu-ipad.png');
    await TA.evaluate(async () => { const m = await import('/src/friendgames.js'); for (const d of Object.values(m.FRIEND_GAMES)) d.shown = d.shownWas; window.pokecraft.closeFriend(); });
    // taps ask and answer
    await openMenu(TA);
    await TA.tap('#friend [data-friend="tag"]');
    t.ok(await waitFor(TB, () => !document.getElementById('ask').classList.contains('hidden') && /wants to play tag/.test(document.getElementById('ask-text').textContent)), 'iPad: a tap on Tag asks the friend');
    await TB.tap('#ask-yes');
    t.ok(await both(TA, TB, () => window.pokecraft.friendGames.active), 'iPad: a tap on "Let\'s play!" starts it');
    await waitFor(TA, () => window.pokecraft.friendGames.state().info.frozen === 0, null, 10000);
    // the joystick does not move IT while counting was checked with keys; here: the action button says Tag! when IT looks at the friend
    await standAt(TB, 2);
    const tagged0 = (await fg(TA)).info.tags;
    await TA.evaluate(() => { const g = window.pokecraft, k = [...g.mp.others.values()][0]; g.player.lookAt(k.pos.clone().setY(k.pos.y + 1)); });
    t.ok(await waitFor(TA, () => document.getElementById('btn-act').textContent.trim() === 'Tag!', null, 10000), 'iPad: IT looking at the friend from close by: the action button says "Tag!"');
    await shot(TA, 'tag-ipad-button.png');
    await TA.tap('#btn-act');
    t.ok(await both(TA, TB, n => window.pokecraft.friendGames.state().info?.tags > n, tagged0), 'iPad: a tap on Tag! tags the friend');
    await shot(TB, 'tag-ipad.png');
    await TA.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await both(TA, TB, () => !window.pokecraft.friendGames.active), 'iPad: Stop ends it');
    // football asked on the tablets in the main world (owner 2026-11-28): the trip, and on the pitch a tap and the round button only kick
    await TA.evaluate(() => { const g = window.pokecraft; g.champion = true; g.mp.sendState(); });
    await waitFor(TB, () => window.pokecraft.mp.hostAvatar?.champ === true);
    await standAt(TA, 0); await standAt(TB, 3);
    await TA.waitForTimeout(1500);
    const ipad0 = await TB.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
    await openMenu(TA);
    await TA.tap('#friend [data-friend="football"]');
    t.ok(await waitFor(TB, () => !document.getElementById('ask').classList.contains('hidden') && /You both go to the Ball Stadium and back\./.test(document.getElementById('ask-text').textContent)), 'iPad: football asked in the main world says where it goes');
    await TB.tap('#ask-yes');
    const inPlay = page => waitFor(page, () => window.pokecraft.place === 'playland' && window.pokecraft.friendGames.state().info?.phase === 'play', null, 240000);
    t.ok(await inPlay(TA) && await inPlay(TB), 'iPad: both land on the pitch in Playland and the match runs');
    await TB.evaluate(() => { const p = window.pokecraft.player; p.pos.set(54, 11, 162); p.vel.set(0, 0, 0); });
    await waitFor(TA, () => Math.abs([...window.pokecraft.mp.others.values()][0].pos.x - 54) < 0.03);
    await TA.evaluate(() => {
      const g = window.pokecraft, m = g.friendGames.play, p = g.player;
      m.ball.reset([52, 11.401, 162]); m.shared.take();
      p.pos.set(50.6, 11, 162); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0;
    });
    t.ok(await waitFor(TA, () => document.getElementById('btn-act').textContent.trim() === 'Kick!' && !document.getElementById('btn-act').classList.contains('dim'), null, 15000), `iPad: the friend stands in the crosshair, the round button still says "Kick!" ("${await TA.evaluate(() => document.getElementById('btn-act').textContent.trim())}")`);
    await shot(TA, 'match-ipad-kick.png');
    const vp = TA.viewportSize();
    await TA.touchscreen.tap(vp.width / 2, vp.height / 2); // a tap right on the friend
    await TA.waitForTimeout(600);
    t.ok(await TA.evaluate(() => document.getElementById('friend').classList.contains('hidden') && !window.pokecraft.ui.panelOpen), 'iPad: a tap on the friend does not open the friend menu during the match');
    const q0 = (await fg(TA)).info.q;
    await TA.tap('#btn-act');
    t.ok(await waitFor(TA, q => { const i = window.pokecraft.friendGames.state().info; return i && (i.q > q || i.ball.vx > 0.5); }, q0, 15000), 'iPad: the round button kicks the ball');
    await TA.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await waitFor(TA, () => window.pokecraft.place === 'main' && !window.pokecraft.friendGames.tripping, null, 240000) && await waitFor(TB, () => window.pokecraft.place === 'main' && !window.pokecraft.friendGames.tripping, null, 240000), 'iPad: Stop takes both back to the main world');
    const ipad1 = await TB.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
    t.ok(Math.hypot(ipad0[0] - ipad1[0], ipad0[1] - ipad1[1], ipad0[2] - ipad1[2]) < 0.3, 'iPad: Kid stands where Kid stood before');
    t.ok(!TA.errors.length && !TB.errors.length, `iPad: no page errors (${[...TA.errors, ...TB.errors].slice(0, 2).join(' / ')})`);
    await TA.context().close(); await TB.context().close();
  }
  /* ------------------------------------------------ a trip to Playland and back (two browsers) ------------------------------------------------ */
  if (want('trip')) {
    const [A, B] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(B, 1); await pause(B);
    await share(A, B);
    const placeIs = (page, id, ms = 180000) => waitFor(page, i => window.pokecraft.place === i && !window.pokecraft.realms.busy, id, ms);
    const where = page => page.evaluate(() => { const g = window.pokecraft, p = g.player; return [g.place, p.pos.x, p.pos.y, p.pos.z, p.yaw]; });
    const same = (a, b) => a[0] === b[0] && Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]) < 0.3 && Math.abs(a[4] - b[4]) < 0.01;
    await standAt(A, 0); await standAt(B, 4, 2);
    await A.evaluate(() => { window.pokecraft.player.yaw = 0.7; }); await B.evaluate(() => { window.pokecraft.player.yaw = -1.1; });
    await A.waitForTimeout(1500);
    // the host has not finished chapter 1: only tag
    await openMenu(A);
    t.ok((await menu(A)).map(x => x.word).join('|') === 'Battle|Trade|Hide and seek|Tag', 'the host is no Champion yet: no stadium games in the main world');
    await A.evaluate(() => window.pokecraft.closeFriend());
    // the host is a Champion: all seven, for the host and for the guest
    await A.evaluate(() => { const g = window.pokecraft; g.champion = true; g.mp.sendState(); });
    t.ok(await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === true), 'the guest\'s game knows the host finished chapter 1');
    for (const [page, who] of [[A, 'Dad'], [B, 'Kid']]) {
      await openMenu(page);
      const m = await menu(page);
      const subs = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#friend .fm-btn')].map(b => [b.dataset.friend, b.querySelector('small')?.textContent || ''])));
      t.ok(m.map(x => x.word).join('|') === 'Battle|Trade|Hide and seek|Tag|Football|Basketball|Kart race' && ['football', 'hoops', 'race'].every(id => !m.find(x => x.id === id).dim)
        && subs.football === 'You both go to the Ball Stadium and back.' && subs.race === 'You both go to the Race Track and back.',
      `${who} in the main world: Football, Basketball and Kart race too ("${subs.football}")`);
      if (page === A) await shot(A, 'friend-menu-anywhere.png');
      await page.evaluate(() => window.pokecraft.closeFriend());
    }
    const saved0 = await Promise.all([A, B].map(p => p.evaluate(() => JSON.stringify([window.pokecraft.beaten, window.pokecraft.cubes, window.pokecraft.stars]))));

    // football asked by the GUEST in the main world: the host's Playland, and back
    const at0 = [await where(A), await where(B)];
    const ask = await invite(B, A, 'football');
    t.ok(/Kid wants to play football with you! First to 3 wins\. You both go to the Ball Stadium and back\./.test(ask), `Dad is asked, with where it goes ("${ask}")`);
    t.ok(await heard(A, /⚽ Off to the Ball Stadium!/) && await heard(B, /⚽ Off to the Ball Stadium!/), 'both hear "⚽ Off to the Ball Stadium!"');
    t.ok(await placeIs(A, 'playland') && await placeIs(B, 'playland'), 'both are in Playland (the host went first, the guest followed, no questions)');
    t.ok(await both(A, B, () => { const s = window.pokecraft.friendGames.state(); return s.started && (s.info?.phase === 'ready' || s.info?.phase === 'play'); }, null), 'the match starts when both are there');
    const k = await Promise.all([A, B].map(p => p.evaluate(() => { const g = window.pokecraft, S = g.gymLive.of('part:stadium'), i = g.friendGames.state().info;
      return { x: g.player.pos.x, z: g.player.pos.z, side: i.side, has: i.has, match: !!S.match, asking: !!g.ui.asking, guest: !!g.realms.stash?.guest, up: g.realms.upPart() }; })));
    t.ok(k[1].side === 0 && k[0].side === 1 && k[0].has === 1 && Math.abs(k[1].x - 48) < 0.01 && Math.abs(k[0].x - 61) < 0.01 && k.every(q => q.match && Math.abs(q.z - 162) < 0.01),
      `on the pitch at the kick-off: Kid (who asked) leads, Dad gets the ball (Kid x ${k[1].x}, Dad x ${k[0].x})`);
    t.ok(!k[0].guest && k[1].guest && k[0].up?.id === 'swirl' && k[1].up?.id === 'swirl' && !k[0].asking && !k[1].asking, 'it is the host\'s Playland (the guest is a guest there); nobody was asked "Go too?"');
    t.ok(await waitFor(A, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a.here && a.inGame && (!a.lead || !a.lead.visible); }), 'no lead creature behind the friend on the pitch');
    await shot(A, 'trip-football.png');
    // Kid scores once with a real hold and let go, so it is a real match
    await both(A, B, () => window.pokecraft.friendGames.state().info.phase === 'play');
    const goal = await B.evaluate(() => {
      const g = window.pokecraft, m = g.friendGames.play, S = g.gymLive.of('part:stadium'), p = g.player;
      S.playing = () => true;
      m.ball.reset([76, 11.401, 162]); m.shared.take();
      p.pos.set(74.6, 11, 162); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0;
      g.gymLive.use(p); S.held.t0 = S.t - 0.6; g.gymLive.release(p);
      for (let i = 0; i < 60 && g.friendGames.state().info.phase === 'play'; i++) S.update(0.05);
      return g.friendGames.state().info.score.join();
    });
    t.ok(goal === '1,0' && await waitFor(A, () => window.pokecraft.friendGames.state().info?.score.join() === '1,0'), 'a goal counts on both screens there');
    // Stop: both are back where they stood
    await A.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active), 'Stop ends it for both');
    t.ok(await placeIs(A, 'main') && await placeIs(B, 'main') && await both(A, B, () => !window.pokecraft.friendGames.state().returning && !window.pokecraft.friendGames.tripping), 'both are back in the main world');
    const at1 = [await where(A), await where(B)];
    t.ok(same(at0[0], at1[0]) && same(at0[1], at1[1]), `each on the very spot (and facing the way) they stood before (${at1.map(a => a.slice(1, 4).map(n => n.toFixed(1))).join(' / ')})`);
    t.ok(await said(A, /Back where you were!/) && await said(B, /Back where you were!/), 'both hear "Back where you were!"');
    const back = await Promise.all([A, B].map(p => p.evaluate(() => { const g = window.pokecraft, q = g.player.pos, a = [...g.mp.others.values()][0];
      return { floor: g.world.get(Math.floor(q.x), 42, Math.floor(q.z)), stash: !!g.realms.stash, here: a?.here, inGame: a?.inGame, asking: !!g.ui.asking, saved: JSON.stringify([g.beaten, g.cubes, g.stars]) }; })));
    t.ok(back.every(b => b.floor === 3 && !b.stash && !b.asking), 'the main world is as they left it (their platforms are there), no question waits');
    t.ok(await both(A, B, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a.here && !a.inGame && a.lead?.visible; }), 'they see each other again, lead creatures and all');
    t.ok(back[0].saved === saved0[0] && back[1].saved === saved0[1], 'nothing was saved by the match');

    // a kart race asked by the host: the grid, and back
    await A.evaluate(() => { window.__toasts.length = 0; }); await B.evaluate(() => { window.__toasts.length = 0; });
    await invite(A, B, 'race');
    t.ok(await placeIs(A, 'playland') && await placeIs(B, 'playland') && await both(A, B, () => window.pokecraft.friendGames.state().started && window.pokecraft.gymLive.of('part:race')?.duel), 'a kart race from the main world: both are in karts on the Race Track');
    const grid = await Promise.all([A, B].map(p => p.evaluate(() => { const R = window.pokecraft.gymLive.of('part:race'), g = R.part.grid; return [Math.hypot(R.car.x - g.player[0], R.car.z - g.player[2]), Math.hypot(R.car.x - g.boss[0], R.car.z - g.boss[2])]; })));
    t.ok(grid[0][0] < 0.01 && grid[1][1] < 0.01, 'Dad (who asked) on the first lane, Kid on the other');
    await B.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await placeIs(A, 'main') && await placeIs(B, 'main') && await both(A, B, () => !window.pokecraft.friendGames.tripping), 'Stop: both are back in the main world');
    const at2 = [await where(A), await where(B)];
    t.ok(same(at0[0], at2[0]) && same(at0[1], at2[1]) && await A.evaluate(() => !window.pokecraft.player.carry), 'on their spots again, out of the karts');

    // from the Swirl, and back to the Swirl
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(B, 'swirl');
    await B.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; g.player.pos.set(a.target.x + 1.5, a.target.y, a.target.z); });
    await both(A, B, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return a?.here && a.pos.distanceTo(g.player.pos) < 6; });
    const sw0 = [await where(A), await where(B)];
    await invite(A, B, 'hoops');
    t.ok(await placeIs(A, 'playland') && await placeIs(B, 'playland') && await both(A, B, () => window.pokecraft.friendGames.state().started && window.pokecraft.friendGames.state().info?.sport === 'Basketball'), 'basketball from the Swirl: both are on the court in Playland');
    await A.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await placeIs(A, 'swirl') && await placeIs(B, 'swirl') && await both(A, B, () => !window.pokecraft.friendGames.tripping), 'afterwards both are back in the Swirl');
    const sw1 = [await where(A), await where(B)];
    t.ok(same(sw0[0], sw1[0]) && same(sw0[1], sw1[1]), 'on the same spots in the Swirl');
    t.ok(await A.evaluate(() => window.pokecraft.realms.leave('door')) && await placeIs(A, 'main'), 'and the Portal Door still takes the host home from there');
    t.ok(!A.errors.length && !B.errors.length, `trip: no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
    await A.context().close(); await B.context().close();
  }

}
