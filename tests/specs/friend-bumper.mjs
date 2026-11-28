// Bumper Cars for two friends (owner 2026-11-28; src/bumperduel.js, the rules in src/bumperrules.js).
//   rules : Node: the pop rule between two friends' cars (from behind and fast pops; head-on, from the side and a slow push never do),
//           60 and 20 frames a second give the same pops and places, the shared clock (a late friend's clock pulled to the leader's:
//           the bots stand in the same places), the leader's score (grace, the balloon coming back, first to 3, a newer state only),
//           the seen car (carried on with its speed, stopped when stale, a jump snaps), drivers: facing each other still gives pops (a side bump spins you, the nose turns at a limited rate), a clipper vs a facer is close, a still player loses
//   play  : two browsers in Playland's Funfair: the friend menu, ask, yes, both in cars in their bays, 3-2-1-Go, a pop by each side
//           with real keys through the game's own loop, to 3, both hear the winner, both out of the cars, nothing saved, the
//           Funfair's own Bumper Cars game untouched
//   ipad  : two iPads, asked in the main world (the trip): the joystick drives the car, the round button honks, a tap on the friend
//           opens nothing, Stop takes both back
//   trip  : asked by the guest in the main world and by the host in the Swirl: both land in cars at the Funfair, a pop counts on
//           both screens, and both are back on the very spot (and facing) they had
// BUMPER_ONLY=rules|play|ipad|trip
import { devices } from 'playwright';
import { openPair, newGame, click, pause } from '../helpers.mjs';
import * as R from '../../src/bumperrules.js';
import { BAYS } from '../../src/fairgames.js';

const only = process.env.BUMPER_ONLY;
const want = part => !only || only.split(',').includes(part);
const shot = (page, name) => page.screenshot({ path: new URL(`../screenshots/${name}`, import.meta.url).pathname, timeout: 120000 }).then(() => console.log(`  screenshot ${name}`)).catch(() => {});
const fg = page => page.evaluate(() => window.pokecraft.friendGames.state());
const info = page => page.evaluate(() => window.pokecraft.friendGames.state().info);
const said = (page, re) => page.evaluate(r => (window.__toasts || []).some(m => new RegExp(r).test(m)), re.source);
async function waitFor(page, fn, arg, ms = 30000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 150 }); return true; } catch { return false; }
}
const heard = (page, re, ms = 20000) => waitFor(page, r => (window.__toasts || []).some(m => new RegExp(r).test(m)), re.source, ms);
const listen = page => page.evaluate(() => {
  const g = window.pokecraft;
  if (window.__toasts) return;
  window.__toasts = [];
  const f = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...r) => { window.__toasts.push(m); return f(m, ...r); };
});
const standAt = (page, dx, dz = 0) => page.evaluate(([dx, dz]) => {
  const g = window.pokecraft, s = g.spawnPoint, y = 42;
  let cx = Math.floor(s.x) + dx, cz = Math.floor(s.z) + dz;
  // a spot outside every gym's protect box (else the platform is dropped when the world is built again after a trip)
  const ok = (cx, cz) => { for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (!g.world.editAllowed(cx + x, y, cz + z, 3)) return false; return true; };
  for (let k = 0; k < 40 && !ok(cx, cz); k++) cx += 8;
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
const menu = page => page.evaluate(() => [...document.querySelectorAll('#friend .fm-btn')].map(b => ({ id: b.dataset.friend, word: b.querySelector('b').textContent, dim: b.classList.contains('dim'), sub: b.querySelector('small')?.textContent || '' })));
async function invite(from, to, id) {
  await openMenu(from);
  await waitFor(from, i => !!document.querySelector(`#friend [data-friend="${i}"]`), id, 8000);
  await click(from, `#friend [data-friend="${id}"]`);
  const asked = await waitFor(to, () => !document.getElementById('ask').classList.contains('hidden'));
  const text = await to.evaluate(() => document.getElementById('ask-text').textContent);
  await to.evaluate(() => window.pokecraft.ui.askYes());
  return asked ? text : '';
}
const both = async (A, B, fn, arg, ms) => (await waitFor(A, fn, arg, ms)) && (await waitFor(B, fn, arg, ms));
const saved = page => page.evaluate(() => { const g = window.pokecraft; return JSON.stringify([g.beaten, g.cubes, g.stars, g.blockCounts, g.keys]); });
// put my car somewhere (and say so at once), facing yaw
const putCar = (page, x, z, yaw) => page.evaluate(([x, z, yaw]) => { const m = window.pokecraft.friendGames.play; m.car.car.reset(x, z, yaw); m.sendT = 0; }, [x, z, yaw]);
const seesFriendAt = (page, x, z, ms = 20000) => waitFor(page, ([x, z]) => { const s = window.pokecraft.friendGames.state().info?.seen; return s && Math.hypot(s.x - x, s.z - z) < 0.15; }, [x, z], ms);

/* ---- a Node stand-in for the two browsers: each drives its own car, states every 0.2 s over a slow line, inputs held 0.05 s ---- */
function sim({ fps = 60, lag = 0.15, secs = 40, drive = 'skilled', friend = 'cruise', k = 0 } = {}) {
  const dt = 1 / fps, per = fps / 20;
  const mk = (b, o) => ({ car: new R.DuelCar(BAYS[b]), seen: new R.SeenCar(BAYS[o].x, BAYS[o].z, BAYS[o].yaw), inbox: [], wish: { x: 0, z: 0 }, memo: {} });
  const L = mk(1, 4), F = mk(4, 1), score = new R.DuelScore(), pops = [];
  const wishOf = (who, me, now) => {
    const c = me.car.car;
    if (who === 'still') return { x: 0, z: 0 };
    if (who === 'cruise') { // a kid driving round the arena, on and off the pedal, stopping a moment at each corner
      const W = [[125, 147], [143, 147], [143, 160], [125, 160]]; me.wp ??= k % 4;
      if (me.waitTo > now || now % 2 > 1.2) return { x: 0, z: 0 };
      const [tx, tz] = W[me.wp];
      if (Math.hypot(tx - c.x, tz - c.z) < 3.5) { me.wp = (me.wp + 1) % 4; me.waitTo = now + 1.5; return { x: 0, z: 0 }; }
      const d = Math.hypot(tx - c.x, tz - c.z) || 1; return { x: (tx - c.x) / d, z: (tz - c.z) / d };
    }
    const o = { ...me.seen.pos, vx: me.seen.m.vx, vz: me.seen.m.vz, yaw: me.seen.m.yaw };
    if (who === 'facer') return R.faceWish(c, o, 0.15 * Math.sin(now * (0.7 + 0.1 * k) + k)); // keeps its nose on you, a little wobbly
    if (who === 'clipper') return R.clipWish(c, o, k % 2 ? 1 : -1);
    return who === 'skilled' ? R.behindWish(c, o, 2.6, me.memo) : R.ramWish(c, o);
  };
  for (let f = 0; f < secs * fps; f++) {
    const q = Math.floor(f / per);
    for (const [me, other, who, side] of [[L, F, drive, 0], [F, L, friend, 1]]) {
      while (me.inbox.length && me.inbox[0].q <= q) me.seen.hear(me.inbox.shift().m);
      if (f % per === 0) me.wish = wishOf(who, me, q * 0.05);
      const T = L.car.T, poppable = !score.safe(T) && !score.hidden(1 - side, T) && score.winner == null;
      for (const e of me.car.step(dt, { wish: me.wish, friend: me.seen, poppable })) if (e.type === 'pop' && score.claim(side, L.car.T)) pops.push([side, +e.T.toFixed(4)]);
      if (f % (4 * per) === per - 1) other.inbox.push({ q: q + 1 + Math.round(lag / 0.05), m: me.car.state() });
    }
  }
  return { pops, score: score.score, L: L.car.state(), F: F.car.state(), at3: pops.filter(p => p[0] === 0)[2]?.[1] ?? null, first: pops[0]?.[1] ?? null };
}
// one car driving at a still friend (state heard once) from `from`, wish held; -> the events
function ram({ fps = 60, from = [134, 144.2], friendYaw = -Math.PI / 2, wish = { x: -1, z: 0 }, secs = 2, friendAt = [130, 144.2], friendV = [0, 0] } = {}) {
  const me = new R.DuelCar({ x: from[0], z: from[1], yaw: Math.atan2(wish.x, wish.z) }, 0), seen = new R.SeenCar();
  seen.hear({ x: friendAt[0], z: friendAt[1], vx: friendV[0], vz: friendV[1], yaw: friendYaw });
  const ev = [];
  for (let f = 0; f < secs * fps; f++) for (const e of me.step(1 / fps, { wish, friend: seen, poppable: true })) if (e.type === 'pop' || (e.type === 'hit' && e.kind === 'friend')) ev.push(`${e.type}@${e.T.toFixed(4)}`);
  return { ev: ev.join(' '), x: me.car.x.toFixed(4), pop: ev.some(e => e.startsWith('pop')), hit: ev.length > 0 };
}

export default async function ({ browser, base, t }) {
  /* ------------------------------------------------ rules (Node) ------------------------------------------------ */
  if (want('rules')) {
    // the pop rule between two friends' cars
    const back60 = ram(), back20 = ram({ fps: 20 });
    t.ok(back60.pop && back20.pop && back60.ev === back20.ev && back60.x === back20.x, `from behind, closing fast: a pop, at 60 and 20 frames a second at the same sub-step (${back60.ev.split(' ')[0]})`);
    const head60 = ram({ friendYaw: Math.PI / 2 }), head20 = ram({ friendYaw: Math.PI / 2, fps: 20 });
    t.ok(head60.hit && !head60.pop && !head20.pop && head60.ev === head20.ev, `a head-on ram: a bump, never a pop (60 and 20 the same: ${head60.ev.split(' ').length} bumps)`);
    const headMoving = ram({ friendYaw: Math.PI / 2, friendV: [5, 0] });
    t.ok(headMoving.hit && !headMoving.pop, 'a head-on ram with both cars driving at each other: never a pop');
    const side = ram({ friendYaw: 0 });
    t.ok(side.hit && !side.pop, 'into its side: no pop');
    const slow = ram({ from: [131.95, 144.2], wish: { x: -0.12, z: 0 } });
    t.ok(slow.hit === false || !slow.pop, 'a slow push on its back: no pop (it must be closing fast)');
    const sp = R.popsFriend({ x: 131.6, z: 144.2, vx: -4, vz: 0 }, { x: 130, z: 144.2, hx: -1, hz: 0 });
    t.ok(sp && !R.popsFriend({ x: 131.6, z: 144.2, vx: -1, vz: 0 }, { x: 130, z: 144.2, hx: -1, hz: 0 }), 'the rule is the bots\' rule (fairgames.js bumpPops): behind within 55 degrees and at least 2 blocks a second');
    // the bounce: my car never goes through the friend's
    const thru = (() => { const me = new R.DuelCar({ x: 136, z: 144.2, yaw: -Math.PI / 2 }, 0), seen = new R.SeenCar(); seen.hear({ x: 130, z: 144.2, vx: 0, vz: 0, yaw: Math.PI / 2 }); let minX = Infinity;
      for (let f = 0; f < 120; f++) { me.step(1 / 60, { wish: { x: -1, z: 0 }, friend: seen, poppable: true }); minX = Math.min(minX, me.car.x); } return minX; })();
    t.ok(thru >= 130 + 1.7 - 1e-6, `my car bounces off the friend's car as I see it, never through it (it gets to x ${thru.toFixed(2)}, the friend's middle is 130)`);
    // the whole duel at 60 and 20 frames a second
    const a = sim({ fps: 60 }), b = sim({ fps: 20 });
    t.ok(JSON.stringify(a) === JSON.stringify(b) && a.pops.length >= 1, `two browsers over a slow line: 60 and 20 frames a second give the same pops and places (${JSON.stringify(a.pops)})`);
    // drivers (twelve games each, the line 0.10 to 0.21 s slow). Owner 2026-11-28: "both players just turn front" was a stalemate.
    const runs = (d, fr) => Array.from({ length: 12 }, (_, k) => sim({ drive: d, friend: fr, k, secs: 60, lag: 0.1 + 0.01 * k }));
    const wins = (rs, i = 0) => rs.filter(r => r.score[i] >= 3).length, pops = (rs, i) => rs.reduce((n, r) => n + r.score[i], 0);
    const median = rs => { const v = rs.map(r => r.first ?? 99).sort((a, b) => a - b); return v[rs.length >> 1]; };
    const ff = runs('facer', 'facer'), cf = runs('clipper', 'facer'), fs = runs('facer', 'still'), sk = runs('skilled', 'cruise');
    const line = (rs, a, b) => `${a} ${pops(rs, 0)} pops / ${wins(rs, 0)} wins, ${b} ${pops(rs, 1)} / ${wins(rs, 1)}, first pop ${median(rs) === 99 ? 'none' : `${median(rs).toFixed(0)} s`}`;
    t.ok(median(ff) < 30 && pops(ff, 0) >= 8 && pops(ff, 1) >= 8, `two friends who both keep facing each other still pop balloons, both of them (${line(ff, 'leader', 'friend')})`);
    t.ok(pops(cf, 0) >= 8 && pops(cf, 1) >= 8 && wins(cf, 1) <= 6, `a skilled player clipping the front corner (a side bump spins them) and a plain facer are a close game: ramming does not win easily (${line(cf, 'clipper', 'facer')})`);
    t.ok(pops(fs, 1) <= 2 && wins(fs, 0) >= 8, `a player who sits still loses (${line(fs, 'facer', 'still')})`);
    t.ok(wins(sk) === 12, `a skilled driver pops a friend driving round the arena 3 times in every game`);
    console.log(`  (bots, 60 s games: facer vs facer: ${line(ff, 'leader', 'friend')}; clipper vs facer: ${line(cf, 'clipper', 'facer')})`);
    const bounce = (() => { const me = new R.DuelCar({ x: 134, z: 144.2, yaw: -Math.PI / 2 }, 0), seen = new R.SeenCar(); seen.hear({ x: 130, z: 144.2, vx: 0, vz: 0, yaw: Math.PI / 2 });
      for (let f = 0; f < 90; f++) me.step(1 / 60, { wish: f < 40 ? { x: -1, z: 0 } : { x: 0, z: 0 }, friend: seen, poppable: true }); return { yaw: me.car.yaw, vx: me.car.vx }; })();
    t.ok(Math.abs(bounce.yaw + Math.PI / 2) < 1e-9 && bounce.vx > 0, 'a head-on bump sends my car back, but never spins it: its nose (and so its balloon) stays the way I steer');
    const spun = (() => { const me = new R.DuelCar({ x: 130, z: 144.2, yaw: -Math.PI / 2 }, 0), seen = new R.SeenCar(); seen.hear({ x: 130, z: 146.5, vx: 0, vz: -6, yaw: Math.PI }); let maxSpin = 0;
      for (let f = 0; f < 60; f++) { me.step(1 / 60, { friend: seen, poppable: true }); maxSpin = Math.max(maxSpin, Math.abs(me.spin)); } return { maxSpin, turned: Math.abs(R.DUEL_BUMP.noseRate) }; })();
    t.ok(spun.maxSpin > 2, `a bump from the side spins the car round (${spun.maxSpin.toFixed(1)} rad/s), so its balloon swings out`);
    const turn = (() => { const me = new R.DuelCar({ x: 124, z: 144.5, yaw: Math.PI / 2 }, 0); for (let f = 0; f < 30; f++) me.step(1 / 60, { wish: { x: -1, z: 0 } }); return Math.abs(me.car.yaw - Math.PI / 2); })();
    t.ok(Math.abs(turn - R.DUEL_BUMP.noseRate * 0.5) < 0.02, `the nose turns at most ${R.DUEL_BUMP.noseRate} rad/s: half a second of steering back turns it ${turn.toFixed(2)} rad (a quick friend can get round you)`);
    // the shared clock: the friend started 0.3 s late; one ping / pong over a 0.12 s line pulls it to the leader's
    const L = new R.DuelCar(BAYS[1]), F = new R.DuelCar(BAYS[4], -R.DUEL_BUMP.count - 0.3);
    let now = 0, skew = 0, best = Infinity, sent = null, pong = null;
    const lag = 0.12;
    for (let f = 0; f < 60 * 8; f++) {
      now += 1 / 60;
      L.step(1 / 60); F.step(1 / 60);
      if (skew) { const d = Math.abs(skew) > R.DUEL_BUMP.skewSnap ? skew : skew * Math.min(1, R.DUEL_BUMP.skewRate / 60); F.T += d; skew -= d; }
      if (!sent && f % 60 === 0) sent = { a: now, at: now + lag };
      if (sent && now >= sent.at) { pong = { a: sent.a, T: L.T, at: now + lag }; sent = null; }
      if (pong && now >= pong.at) { const rtt = now - pong.a; if (rtt <= best * 1.5 + 0.02) { best = Math.min(best, rtt); skew = R.clockOffset(pong.a, pong.T, now, F.T); } pong = null; }
    }
    const bl = R.botsAt(L.T), bf = R.botsAt(F.T), off = Math.max(...bl.map((p, i) => Math.hypot(p.x - bf[i].x, p.z - bf[i].z)));
    t.ok(Math.abs(L.T - F.T) < 0.02 && off < 0.1, `the friend's clock is pulled to the leader's (${(L.T - F.T).toFixed(3)} s apart): the six bots stand in the same places on both screens (${off.toFixed(3)} blocks)`);
    const b0 = R.botsAt(-2), b1 = R.botsAt(0);
    t.ok(b0.every((p, i) => p.x === b1[i].x && p.z === b1[i].z) && R.botsAt(5).some((p, i) => Math.hypot(p.x - b1[i].x, p.z - b1[i].z) > 1), 'the bots wait during the count and drive from Go');
    t.ok(R.DUEL_BUMP.bays.length === 2 && R.duelBays().every(b => b.yaw === -Math.PI / 2 && b.x > 146), 'both friends start in bays on the east rail, facing in');
    // the leader's score
    const sc = new R.DuelScore();
    t.ok(!sc.claim(0, -1) && sc.claim(0, 1) && sc.score.join() === '1,0', 'no pop before Go; a pop counts');
    t.ok(!sc.claim(1, 1 + R.DUEL_BUMP.grace - 0.1) && sc.hidden(1, 1.5) && !sc.hidden(1, 1 + R.DUEL_BUMP.back + 0.01) && !sc.hidden(0, 1.5), `after a pop nobody can be popped for ${R.DUEL_BUMP.grace} s; the popped balloon is back after ${R.DUEL_BUMP.back} s`);
    t.ok(sc.claim(1, 1 + R.DUEL_BUMP.grace + 0.01) && sc.claim(0, 10) && sc.claim(0, 20) && sc.winner === 0 && !sc.claim(1, 30) && sc.score.join() === '3,1', 'first to 3 wins; nothing counts after that');
    const copy = new R.DuelScore();
    t.ok(copy.load(sc.state()) && copy.score.join() === '3,1' && copy.winner === 0 && !copy.load({ ...sc.state(), n: 2 }), 'the friend takes the leader\'s score, never an older one');
    // the seen car
    const seen = new R.SeenCar();
    seen.hear({ x: 130, z: 150, vx: 4, vz: 0, yaw: Math.PI / 2 });
    seen.advance(0.25);
    const x1 = seen.pos.x;
    for (let i = 0; i < 60; i++) seen.advance(1 / 60);
    const x2 = seen.pos.x;
    seen.hear({ x: x2 + 0.5, z: 150, vx: 0, vz: 0, yaw: Math.PI / 2 });
    const jumpless = Math.abs(seen.pos.x - x2) < 1e-9;
    for (let i = 0; i < 30; i++) seen.advance(1 / 60);
    seen.hear({ x: 140, z: 160, vx: 0, vz: 0, yaw: 0 });
    t.ok(x1 > 130.9 && x2 - x1 < 4 * 0.4 && jumpless && Math.abs(seen.pos.x - 140) < 1e-9 && !seen.hear({ x: NaN }), `the friend's car as I see it: carried on with its speed (${x1.toFixed(2)}), stopped when no news comes (${x2.toFixed(2)}), a new state eased in without a jump, a teleport snaps, junk is ignored`);
    const late = new R.SeenCar();
    late.hear({ x: 130, z: 150, vx: -5, vz: 0, yaw: -Math.PI / 2 }, 0.4); // it came 0.4 s into a slow frame
    late.advance(0.4); const lx1 = late.pos.x; late.advance(0.1);
    t.ok(lx1 === 130 && late.pos.x < 130 && late.pos.x > 129.4, 'a state that arrived in the middle of a slow frame is carried on only from when it arrived (never ahead of the real car)');
  }

  /* ------------------------------------------------ play: two browsers in the Funfair ------------------------------------------------ */
  if (want('play')) {
    const [A, B] = await openPair(browser, base);
    await newGame(A, 0); await pause(A);
    await newGame(B, 1); await pause(B);
    await share(A, B);
    const placeIs = (page, id) => waitFor(page, i => window.pokecraft.place === i && !window.pokecraft.realms.busy, id, 120000);
    await A.evaluate(() => { window.pokecraft.champion = true; }); await B.evaluate(() => { window.pokecraft.champion = true; });
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(B, 'swirl');
    const cell = await A.evaluate(() => {
      const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'fair'), p = g.player;
      p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
      return f.cloth[Math.floor(f.cloth.length / 2)];
    });
    await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(A, 'playland');
    await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
    t.ok(await placeIs(B, 'playland'), 'both friends are in Playland');
    // by the arena's gate
    await A.evaluate(() => { const p = window.pokecraft.player; p.pos.set(151.5, 11, 152.5); p.vel.set(0, 0, 0); });
    await B.evaluate(() => { const p = window.pokecraft.player; p.pos.set(151.5, 11, 155.5); p.vel.set(0, 0, 0); });
    await both(A, B, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return a?.here && a.pos.distanceTo(g.player.pos) < 5; });
    const fair0 = await Promise.all([A, B].map(p => p.evaluate(() => { const L = window.pokecraft.gymLive.of('part:fair'); return JSON.stringify({ round: L.bump.round, popped: L.bump.popped, misses: L.bump.misses, wins: L.bump.wins, drive: L.drive }); })));
    const saved0 = await Promise.all([A, B].map(saved));
    await openMenu(A);
    const m = await menu(A), row = m.find(x => x.id === 'bumper');
    t.ok(row && row.word === 'Bumper Cars' && !row.dim && /Pop the balloon on your friend's back\. First to 3\./.test(row.sub), `the friend menu has Bumper Cars ("${row?.sub}")`);
    await shot(A, 'bumper-menu.png');
    await A.evaluate(() => window.pokecraft.closeFriend());
    const ask = await invite(A, B, 'bumper');
    t.ok(/Dad wants to play bumper cars with you! Bump the balloon on the back of their car\. First to 3 wins\./.test(ask) && !/go to/.test(ask), `Kid is asked, no trip ("${ask}")`);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().started), 'the game starts on both sides');
    const in0 = [await info(A), await info(B)];
    t.ok(in0.every(i => i.carried && i.duel) && Math.hypot(in0[0].car.x - BAYS[1].x, in0[0].car.z - BAYS[1].z) < 0.01 && Math.hypot(in0[1].car.x - BAYS[4].x, in0[1].car.z - BAYS[4].z) < 0.01 && in0[0].T < 0,
      `both sit in cars: Dad in bay 2, Kid in bay 5, facing in; the count runs (T ${in0[0].T.toFixed(2)})`);
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.T > 0, null, 60000) && await heard(A, /Go! Bump Kid's balloon!/) && await heard(B, /Go! Bump Dad's balloon!/), 'the count, then "Go! Bump Kid\'s balloon!" (and Dad\'s on Kid\'s screen)');
    t.ok(await waitFor(B, () => window.pokecraft.friendGames.state().info.syncs >= 1, null, 20000), `Kid's clock is pulled to Dad's (ping ${((await info(B)).rtt * 1000).toFixed(0)} ms)`);
    const sees = await waitFor(A, () => { const i = window.pokecraft.friendGames.state().info; return i.seen.heard && Math.hypot(i.seen.x - 146.3, i.seen.z - 159.8) < 0.2; });
    if (!sees) console.log('  ', JSON.stringify(await info(A)), JSON.stringify(await info(B)));
    t.ok(sees, 'Dad sees Kid\'s car where Kid sits');
    const bal = await A.evaluate(() => { const g = window.pokecraft, bs = g.scene.children.filter(c => c.userData.bumperBalloon); return { n: bs.length, vis: bs.every(b => b.visible) }; });
    t.ok(bal.n === 2 && bal.vis, 'a balloon rides on each friend\'s car');
    await shot(A, 'bumper-start.png');
    // real keys through the game's loop: `who` drives west (W) into the other's back on the south strip
    // back into the game with a real click (the mouse is caught again; the browser may say no right after letting go: try again)
    const lock = async page => {
      for (let i = 0; i < 6; i++) {
        await page.bringToFront(); // (only the page in front may catch the mouse)
        const at = await page.evaluate(() => { // a spot on the pause screen itself (not on the play-together box)
          const vw = innerWidth, vh = innerHeight;
          for (const [x, y] of [[0.5, 0.5], [0.08, 0.5], [0.92, 0.5], [0.08, 0.15], [0.92, 0.85], [0.5, 0.95], [0.5, 0.05]]) {
            const e = document.elementFromPoint(x * vw, y * vh);
            if (e && (e.id === 'pause' || e.tagName === 'CANVAS')) return [x * vw, y * vh];
          }
          return [550, 300];
        });
        await page.mouse.click(at[0], at[1]);
        if (await waitFor(page, () => window.pokecraft.playing(), null, 3000)) return true;
        await page.waitForTimeout(1200);
      }
      console.log('  (no mouse lock)', await page.evaluate(() => { const e = document.elementFromPoint(550, 300); return [e?.id, e?.className, document.hasFocus(), document.getElementById('pause').classList.contains('hidden')].join(' '); }));
      return false;
    };
    const park = async () => { await putCar(A, BAYS[1].x, BAYS[1].z, -Math.PI / 2); await putCar(B, BAYS[4].x, BAYS[4].z, -Math.PI / 2); }; // (no stray bump between the tests)
    // real keys through the game's loop: `who` drives west (W) into the other's back on the south strip
    const ram = async (who, other, n, score) => {
      await putCar(other, 130, 144.2, -Math.PI / 2);
      await putCar(who, 134.5, 144.2, -Math.PI / 2);
      await seesFriendAt(who, 130, 144.2);
      await who.evaluate(() => { const p = window.pokecraft.player; p.yaw = Math.PI / 2; p.pitch = -0.2; });
      const locked = await lock(who);
      await who.evaluate(() => { window.pokecraft.player.yaw = Math.PI / 2; });
      await who.keyboard.down('KeyW');
      const ok = await waitFor(who, n => window.pokecraft.friendGames.state().info?.n >= n, n, 30000);
      await who.keyboard.up('KeyW');
      await park();
      await pause(who);
      const now = await info(who), sc = now ? now.score.join() : score; // (the last pop may have ended the game already)
      if (!ok || sc !== score) console.log('  (ram)', locked, JSON.stringify(await info(who)), JSON.stringify(await info(other)));
      return ok && sc === score;
    };
    t.ok(await ram(A, B, 1, '1,0'), 'Dad drives into Kid\'s back with real keys: a pop');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.score.join() === '1,0') && await heard(A, /🎈 Pop! You got Kid's balloon! Dad 1 · Kid 0/) && await heard(B, /🎈 Pop! Dad got your balloon! Dad 1 · Kid 0/), 'both screens count it: "Pop! You got Kid\'s balloon!" / "Dad got your balloon!"');
    await shot(B, 'bumper-popped.png');
    t.ok(await ram(B, A, 2, '1,1'), 'Kid drives into Dad\'s back with real keys: a pop (claimed by Kid, counted by Dad)');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.score.join() === '1,1') && await heard(B, /You got Dad's balloon! Dad 1 · Kid 1/), 'both screens: 1 · 1');
    const chip = await A.evaluate(() => document.getElementById('hs-hud')?.textContent || '');
    t.ok(/🎈 Dad 1 · Kid 1/.test(chip), `the chip says the score ("${chip.trim()}")`);
    // head-on with real keys: no pop
    await putCar(B, 130, 144.2, Math.PI / 2);
    await putCar(A, 134.5, 144.2, -Math.PI / 2);
    await seesFriendAt(A, 130, 144.2);
    await A.waitForTimeout(2500); // (the grace is over)
    await lock(A);
    await A.evaluate(() => { window.pokecraft.player.yaw = Math.PI / 2; });
    await A.keyboard.down('KeyW');
    const bumped = await waitFor(A, () => window.pokecraft.friendGames.state().info.friendHits > 0, null, 20000);
    await A.waitForTimeout(800);
    await A.keyboard.up('KeyW'); await park(); await pause(A);
    t.ok(bumped && (await info(A)).n === 2, 'Dad rams Kid head-on with real keys: a bump, no pop');
    t.ok(await ram(A, B, 3, '2,1') && await ram(A, B, 4, '3,1'), 'Dad pops Kid twice more');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info?.result === 0 || !window.pokecraft.friendGames.active) && await heard(A, /🏆 Dad wins Bumper Cars! Dad 3 · Kid 1/) && await heard(B, /🏆 Dad wins Bumper Cars! Dad 3 · Kid 1/), 'both hear "🏆 Dad wins Bumper Cars! Dad 3 · Kid 1"');
    await shot(A, 'bumper-win.png');
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active, null, 30000) && await heard(A, /You won Bumper Cars! Good game!/) && await heard(B, /Good game! Try again\?/), 'a moment to cheer, then the game ends for both');
    const out = await Promise.all([A, B].map(p => p.evaluate(() => { const g = window.pokecraft, L = g.gymLive.of('part:fair');
      return { carry: !!g.player.carry, duel: !!L.duel, balloons: g.scene.children.filter(c => c.userData.bumperBalloon).length, y: g.player.pos.y, place: g.place, fair: JSON.stringify({ round: L.bump.round, popped: L.bump.popped, misses: L.bump.misses, wins: L.bump.wins, drive: L.drive }) }; })));
    t.ok(out.every(o => !o.carry && !o.duel && !o.balloons && o.place === 'playland' && Math.abs(o.y - 11) < 0.6), 'both are out of the cars, standing in the arena; the balloons are gone');
    t.ok(out[0].fair === fair0[0] && out[1].fair === fair0[1], 'the Funfair\'s own Bumper Cars game is as it was (round, balloons, misses)');
    t.ok((await saved(A)) === saved0[0] && (await saved(B)) === saved0[1] && !(await A.evaluate(() => window.pokecraft.beaten.some(k => /pw:fair:ticket/.test(k)))), 'nothing was saved; no golden ticket');
    t.ok(await A.evaluate(() => { const L = window.pokecraft.gymLive.of('part:fair'), p = window.pokecraft.player; p.pos.set(L.parked[0].x - 1, 11, L.parked[0].z); L.playing = () => true; return L.near(p) === 'Drive!'; }), 'afterwards Drive! is offered by a parked car again');
    t.ok(!A.errors.length && !B.errors.length, `play: no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
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
    await TA.evaluate(() => { const g = window.pokecraft; g.touch.reset(); g.champion = true; g.mp.sendState(); });
    await waitFor(TB, () => window.pokecraft.mp.hostAvatar?.champ === true);
    await standAt(TA, 0); await standAt(TB, 3);
    await TA.waitForTimeout(2000);
    const at0 = await TB.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
    await openMenu(TA);
    await waitFor(TA, () => !!document.querySelector('#friend [data-friend="bumper"]'), null, 8000);
    t.ok((await menu(TA)).find(x => x.id === 'bumper')?.sub === 'You both go to the Funfair and back.', 'iPad: Bumper Cars in the main world says "You both go to the Funfair and back."');
    await TA.tap('#friend [data-friend="bumper"]');
    t.ok(await waitFor(TB, () => !document.getElementById('ask').classList.contains('hidden') && /bumper cars/.test(document.getElementById('ask-text').textContent)), 'iPad: a tap asks the friend');
    await TB.tap('#ask-yes');
    const going = page => waitFor(page, () => window.pokecraft.place === 'playland' && window.pokecraft.friendGames.state().info?.T > 0, null, 240000);
    t.ok(await going(TA) && await going(TB), 'iPad: both land in cars at the Funfair and Go!');
    await TA.evaluate(() => { const g = window.pokecraft; g.ui.closePanel?.(); document.getElementById('pause')?.classList.add('hidden'); });
    t.ok(await waitFor(TA, () => window.pokecraft.playing()), 'iPad: playing');
    const before = (await info(TA)).car;
    const cdp = await TA.context().newCDPSession(TA);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
    const joy = await TA.evaluate(() => { const r = document.getElementById('joystick').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await touch('touchStart', [[joy[0], joy[1], 1]]);
    for (let i = 0; i < 8; i++) { await touch('touchMove', [[joy[0], joy[1] - 60, 1]]); await TA.waitForTimeout(150); }
    const moving = (await info(TA)).car;
    await touch('touchEnd', []);
    t.ok(Math.hypot(moving.x - before.x, moving.z - before.z) > 0.5, `iPad: the joystick drives the car (${Math.hypot(moving.x - before.x, moving.z - before.z).toFixed(1)} blocks)`);
    t.ok(await waitFor(TA, () => document.getElementById('btn-act').textContent.trim() === 'Honk!'), `iPad: the round button says "Honk!" ("${await TA.evaluate(() => document.getElementById('btn-act').textContent.trim())}")`);
    await TA.evaluate(() => { window.pokecraft.sound.played = []; });
    await TA.tap('#btn-act');
    t.ok(await waitFor(TA, () => (window.pokecraft.sound.played || []).includes('honkhonk'), null, 8000), 'iPad: a tap on it honks');
    await shot(TA, 'bumper-ipad.png');
    // a tap right on the friend opens nothing
    await TA.evaluate(() => { const g = window.pokecraft, k = [...g.mp.others.values()][0]; g.player.lookAt(k.pos.clone().setY(k.pos.y + 1)); });
    const vp = TA.viewportSize();
    await TA.touchscreen.tap(vp.width / 2, vp.height / 2);
    await TA.waitForTimeout(600);
    t.ok(await TA.evaluate(() => document.getElementById('friend').classList.contains('hidden') && !window.pokecraft.ui.panelOpen), 'iPad: a tap on the friend does not open the friend menu');
    await TB.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await waitFor(TA, () => window.pokecraft.place === 'main' && !window.pokecraft.friendGames.tripping, null, 240000) && await waitFor(TB, () => window.pokecraft.place === 'main' && !window.pokecraft.friendGames.tripping, null, 240000), 'iPad: Stop takes both back to the main world');
    const at1 = await TB.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
    t.ok(Math.hypot(at0[0] - at1[0], at0[1] - at1[1], at0[2] - at1[2]) < 0.3 && await TA.evaluate(() => !window.pokecraft.player.carry), 'iPad: Kid stands where Kid stood before, nobody in a car');
    t.ok(!TA.errors.length && !TB.errors.length, `iPad: no page errors (${[...TA.errors, ...TB.errors].slice(0, 2).join(' / ')})`);
    await TA.context().close(); await TB.context().close();
  }

  /* ------------------------------------------------ the trip there and back ------------------------------------------------ */
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
    await openMenu(A);
    t.ok(!(await menu(A)).some(x => x.id === 'bumper'), 'the host is no Champion yet: no Bumper Cars in the main world');
    await A.evaluate(() => window.pokecraft.closeFriend());
    await A.evaluate(() => { const g = window.pokecraft; g.champion = true; g.mp.sendState(); });
    await waitFor(B, () => window.pokecraft.mp.hostAvatar?.champ === true);
    const saved0 = await Promise.all([A, B].map(saved));
    // asked by the GUEST in the main world
    const at0 = [await where(A), await where(B)];
    const ask = await invite(B, A, 'bumper');
    t.ok(/Kid wants to play bumper cars with you!.*You both go to the Funfair and back\./.test(ask), `Dad is asked, with where it goes ("${ask}")`);
    t.ok(await heard(A, /🚗 Off to the Funfair!/) && await heard(B, /🚗 Off to the Funfair!/), 'both hear "🚗 Off to the Funfair!"');
    t.ok(await placeIs(A, 'playland') && await placeIs(B, 'playland') && await both(A, B, () => window.pokecraft.friendGames.state().info?.carried === true, null, 120000), 'both land in Playland and sit in cars at the Funfair');
    const sides = [await info(A), await info(B)];
    t.ok(sides[1].side === 0 && sides[0].side === 1 && Math.hypot(sides[1].car.x - BAYS[1].x, sides[1].car.z - BAYS[1].z) < 0.01 && Math.hypot(sides[0].car.x - BAYS[4].x, sides[0].car.z - BAYS[4].z) < 0.01, 'Kid (who asked) leads from bay 2, Dad in bay 5');
    await shot(A, 'bumper-trip.png');
    t.ok(await both(A, B, () => window.pokecraft.friendGames.state().info.T > 0, null, 60000), 'Go!');
    // Dad (the friend here) pops Kid: his car glides into Kid's back
    await putCar(B, 130, 144.2, -Math.PI / 2);
    await seesFriendAt(A, 130, 144.2);
    await A.evaluate(() => { const m = window.pokecraft.friendGames.play; window.__log = []; const s0 = m.car.step.bind(m.car);
      m.car.step = (dt, o) => { const x0 = m.car.car.x, ev = s0(dt, o); if (window.__log.length < 40) window.__log.push([+dt.toFixed(3), o.poppable, +o.friend.pos.x.toFixed(2), +x0.toFixed(2), +m.car.car.x.toFixed(2), ev.map(e => e.type + (e.kind || e.mover || '')).join(',')]); return ev; };
      m.car.car.reset(133.5, 144.2, -Math.PI / 2); m.car.car.vx = -5; });
    const tripPop = await both(A, B, () => window.pokecraft.friendGames.state().info.score.join() === '0,1');
    if (!tripPop) console.log('  ', JSON.stringify(await info(A)), JSON.stringify(await info(B)), JSON.stringify(await A.evaluate(() => window.__log)));
    t.ok(tripPop, 'a pop by Dad (claimed by Dad, counted by Kid, the leader) on both screens');
    await A.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await both(A, B, () => !window.pokecraft.friendGames.active), 'Stop ends it for both');
    t.ok(await placeIs(A, 'main') && await placeIs(B, 'main') && await both(A, B, () => !window.pokecraft.friendGames.state().returning && !window.pokecraft.friendGames.tripping), 'both are back in the main world');
    const at1 = [await where(A), await where(B)];
    t.ok(same(at0[0], at1[0]) && same(at0[1], at1[1]) && await A.evaluate(() => !window.pokecraft.player.carry) && await B.evaluate(() => !window.pokecraft.player.carry), `each on the very spot (and facing) they stood before, out of the cars (${at1.map(a => a.slice(1, 4).map(n => n.toFixed(1))).join(' / ')})`);
    t.ok((await saved(A)) === saved0[0] && (await saved(B)) === saved0[1], 'nothing was saved');
    // from the Swirl, asked by the host, and back to the Swirl
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(B, () => window.pokecraft.ui.asking); await B.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(B, 'swirl');
    await B.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; g.player.pos.set(a.target.x + 1.5, a.target.y, a.target.z); });
    await both(A, B, () => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; return a?.here && a.pos.distanceTo(g.player.pos) < 6; });
    const sw0 = [await where(A), await where(B)];
    await invite(A, B, 'bumper');
    t.ok(await placeIs(A, 'playland') && await placeIs(B, 'playland') && await both(A, B, () => window.pokecraft.friendGames.state().info?.carried === true, null, 120000), 'Bumper Cars from the Swirl: both in cars at the Funfair');
    await B.evaluate(() => window.pokecraft.friendGames.stop());
    t.ok(await placeIs(A, 'swirl') && await placeIs(B, 'swirl') && await both(A, B, () => !window.pokecraft.friendGames.tripping), 'afterwards both are back in the Swirl');
    const sw1 = [await where(A), await where(B)];
    t.ok(same(sw0[0], sw1[0]) && same(sw0[1], sw1[1]), 'on the same spots in the Swirl');
    t.ok(!A.errors.length && !B.errors.length, `trip: no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
    await A.context().close(); await B.context().close();
  }
}
