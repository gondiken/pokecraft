// T30 hide and seek: the menu, asking, the dark head start, the compass, Camo decoys, finding (tap and bump),
// the score and the swap, the time-out point, the fence, stopping, leaving, "busy" and an iPad pair.
import { devices } from 'playwright';
import { openPair, newGame, click, pause } from '../helpers.mjs';

const shot = (page, name) => page.screenshot({ path: new URL(`../screenshots/${name}`, import.meta.url).pathname }).catch(() => {});
const st = page => page.evaluate(() => window.pokecraft.hideSeek.state());
const toasts = page => page.evaluate(() => [...document.querySelectorAll('#toast div')].map(d => d.textContent).join(' | '));

async function waitFor(page, fn, arg, ms = 25000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 150 }); return true; } catch { return false; }
}

// A 5x5 stone platform high in the air at dx / dz from the spawn point; stands the player there.
const standAt = (page, dx, dz = 0) => page.evaluate(([dx, dz]) => {
  const g = window.pokecraft, s = g.spawnPoint, y = 42;
  const cx = Math.floor(s.x) + dx, cz = Math.floor(s.z) + dz;
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.world.set(cx + x, y, cz + z, 3);
  g.player.pos.set(cx + 0.5, y + 1, cz + 0.5);
  g.player.vel.set(0, 0, 0);
}, [dx, dz]);

async function startShare(A, B) {
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await B.waitForTimeout(4000);
}

const SHORT = () => import('/src/hideseek.js').then(m => Object.assign(m.HS, { hide: 15, seek: 120, brk: 3, beat: 1, lost: 6 }));

export default async function ({ browser, base, t }) {
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await startShare(A, B);
  await A.evaluate(SHORT); await B.evaluate(SHORT);
  await standAt(A, 0); await standAt(B, 4);
  await A.waitForTimeout(1500);

  // 1. Menu
  t.ok(await waitFor(A, () => [...document.querySelectorAll('#mp button')].some(b => b.textContent === 'Hide and seek with Kid')),
    'the Play-together box has "Hide and seek with Kid" when Kid is close');
  await standAt(B, 40);
  t.ok(await waitFor(A, () => document.getElementById('mp').textContent.includes('Walk closer to Kid to play hide and seek.')
    && ![...document.querySelectorAll('#mp button')].some(b => b.textContent.startsWith('Hide and seek with'))),
  'far away: "Walk closer to Kid", and no button');
  await standAt(B, 4);
  await waitFor(A, () => [...document.querySelectorAll('#mp button')].some(b => b.textContent === 'Hide and seek with Kid'));

  // 2. Invite, no, yes
  await click(A, '#mp button:has-text("Hide and seek with Kid")');
  t.ok(await waitFor(B, () => !document.getElementById('ask').classList.contains('hidden')
    && document.getElementById('ask-text').textContent.includes('hide and seek')
    && document.getElementById('ask-yes').textContent === "Let's play!"), 'Kid is asked "... hide and seek!" with a "Let\'s play!" button');
  await B.keyboard.press('n');
  t.ok(await waitFor(A, () => (document.getElementById('toast').textContent || '').includes("doesn't want to play")), 'N tells Dad "doesn\'t want to play"');
  t.ok(!(await st(A)).active && !(await st(B)).active, 'no game after "Not now"');
  await click(A, '#mp button:has-text("Hide and seek with Kid")');
  await waitFor(B, () => !document.getElementById('ask').classList.contains('hidden'));
  await click(B, '#ask-yes');
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.active) && await waitFor(B, () => window.pokecraft.hideSeek.active), 'both players are in the game');
  const a1 = await st(A), b1 = await st(B);
  t.ok(a1.leader && !b1.leader && a1.role === 'seeker' && b1.role === 'hider', 'Dad (inviter) leads and seeks, Kid hides first');
  t.ok(a1.n === 1 && b1.n === 1 && a1.center && Math.abs(a1.center[0] - b1.center[0]) < 0.01 && Math.abs(a1.center[1] - b1.center[1]) < 0.01, 'same round and play area on both sides');

  // 3. Head start
  t.ok(await waitFor(A, () => !document.getElementById('hs-dark').classList.contains('hidden')), "the seeker's screen is dark");
  const c1 = Number(await A.textContent('#hs-dark .hs-count'));
  await A.waitForTimeout(1500);
  const c2 = Number(await A.textContent('#hs-dark .hs-count'));
  t.ok(Number.isFinite(c1) && c2 <= c1, `the number counts down (${c1} -> ${c2})`);
  const f = await A.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0];
    return { frozen: g.hideSeek.frozen, playing: g.playing(), hiding: a.hiding, vis: a.model.visible, tag: a.tag.visible }; });
  t.ok(f.frozen && !f.playing && f.hiding && !f.vis, `the seeker is frozen and cannot play; the hider is hidden from them (${JSON.stringify(f)})`);
  t.ok(await B.evaluate(() => !window.pokecraft.hideSeek.frozen && document.getElementById('hs-dark').classList.contains('hidden')), 'the hider sees no dark screen');
  await shot(A, 't30-dark.png'); await shot(B, 't30-hider.png');
  const blocked = await A.evaluate(async () => {
    const g = window.pokecraft, a = [...g.mp.others.values()][0];
    g.duels.challenge(a);
    const { makeCreature, buildModel } = await import('/src/species.js');
    const { Wild } = await import('/src/creatures.js');
    const wild = new Wild(makeCreature('fluffin', 2), buildModel('fluffin'), g.player.pos.clone());
    g.startBattle({ wild });
    return { battle: g.inBattle, asking: !!g.duels.asking };
  });
  t.ok(!blocked.battle && !blocked.asking, 'no battles and no duel invites during the game');
  t.ok(await B.evaluate(async () => {
    const g = window.pokecraft; const { makeCreature, buildModel } = await import('/src/species.js'); const { Wild } = await import('/src/creatures.js');
    g.startBattle({ wild: new Wild(makeCreature('fluffin', 2), buildModel('fluffin'), g.player.pos.clone()) }); return !g.inBattle;
  }), 'the hider cannot start a battle either');

  // 4. Seek and compass
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.state().phase === 'seek') && await waitFor(B, () => window.pokecraft.hideSeek.state().phase === 'seek'), 'both reach the seek phase');
  t.ok(await waitFor(A, () => !document.getElementById('seek-compass').classList.contains('hidden')), 'the compass shows for the seeker');
  const a2 = await st(A);
  t.ok(!a2.frozen && !a2.dark, 'the dark screen is gone');
  await standAt(B, 33);
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.state().compass.word === 'Cold'), 'far away the compass says Cold');
  const far = (await st(A)).compass.period;
  await standAt(B, 8);
  t.ok(await waitFor(A, () => /Hot/.test(window.pokecraft.hideSeek.state().compass.word)), 'close by it says Hot!');
  const near = (await st(A)).compass.period;
  t.ok(near < far, `closer = faster glint (${near.toFixed(2)} < ${far.toFixed(2)})`);
  t.ok(await A.evaluate(() => !([...window.pokecraft.mp.others.values()][0].tag.visible)), "the hider's name tag is hidden from the seeker");
  await shot(A, 't30-compass.png');

  // 5. Camo decoy
  await standAt(B, 8);
  const camo = await B.evaluate(async () => {
    const g = window.pokecraft, p = g.player.pos, { B: BL } = await import('/src/blocks.js');
    for (let i = 0; i < 4; i++) g.world.set(Math.floor(p.x) + 2, 43 + (i % 2), Math.floor(p.z) + (i >> 1), BL.LEAVES);
    const w = g.creatures.spawnAt('bushling', Math.floor(p.x) + 1, 43, Math.floor(p.z), { level: 5 });
    return !!w?.disguise;
  });
  t.ok(camo, 'a Camo creature is next to the hider');
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.state().help && window.pokecraft.hideSeek.state().compass.word === '???'), 'the seeker\'s compass says ??? (fooled)');
  t.ok((await toasts(B)).includes('helping you hide') || await waitFor(B, () => (document.getElementById('toast').textContent || '').includes('helping you hide'), null, 2000), 'the hider hears "A Camo creature is helping you hide!"');
  await B.evaluate(() => { const g = window.pokecraft; for (const w of [...g.creatures.list]) if (w.disguise) g.creatures.remove(w); });
  t.ok(await waitFor(A, () => !window.pokecraft.hideSeek.state().help && window.pokecraft.hideSeek.state().compass.word !== '???'), 'without the Camo creature the compass works again');

  // 6. Found by looking and clicking
  await standAt(B, 4);
  await A.waitForTimeout(1500);
  await A.evaluate(() => { const g = window.pokecraft, k = [...g.mp.others.values()][0]; g.player.lookAt(k.pos.clone().setY(k.pos.y + 1)); });
  t.ok(await waitFor(A, () => document.getElementById('prompt').textContent.includes('Kid · click or E to find them!')), 'looking at Kid says "click or E to find them!"');
  await A.evaluate(() => window.pokecraft.interact());
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.state().phase === 'brk') && await waitFor(B, () => window.pokecraft.hideSeek.state().phase === 'brk'), 'both reach the break after a find');
  const sc = await Promise.all([A, B].map(async p => p.evaluate(() => { const s = window.pokecraft.hideSeek.state(); const m = window.pokecraft.mp;
    return JSON.stringify(Object.entries(s.score).map(([k, v]) => [k === m.id ? 'me' : 'other', v]).sort()); })));
  t.ok(sc[0] === JSON.stringify([['me', 1], ['other', 0]]) && sc[1] === JSON.stringify([['me', 0], ['other', 1]]), `Dad 1 - Kid 0 on both sides (${sc.join(' / ')})`);
  t.ok((await toasts(A)).includes('Dad found Kid!') && await waitFor(B, () => document.getElementById('toast').textContent.includes('Dad found Kid!'), null, 3000), 'both see "Dad found Kid!"');
  t.ok(await waitFor(A, () => document.getElementById('hs-hud').textContent.includes('Dad 1 · Kid 0')), 'the score line shows Dad 1 · Kid 0');
  await shot(A, 't30-score.png');

  // after the break: round 2, swapped
  t.ok(await waitFor(B, () => window.pokecraft.hideSeek.state().n >= 2), 'round 2 begins');
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.state().n === 2), 'Dad is on round 2 too');
  const a3 = await st(A), b3 = await st(B);
  t.ok(a3.role === 'hider' && b3.role === 'seeker' && (b3.phase !== 'hide' || (b3.frozen && b3.dark)), 'roles swapped: Kid seeks behind the dark screen, Dad hides');
  // 7a. Bump: after the head start Dad (hider) walks right up to Kid
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.state().phase === 'seek') && await waitFor(B, () => window.pokecraft.hideSeek.state().phase === 'seek'), 'round 2 seek phase');
  await A.evaluate(() => { const g = window.pokecraft; const s = g.spawnPoint; g.player.pos.set(Math.floor(s.x) + 4.5, 43, Math.floor(s.z) + 0.5); });
  t.ok(await waitFor(B, () => window.pokecraft.hideSeek.state().phase === 'brk') && await waitFor(A, () => window.pokecraft.hideSeek.state().phase === 'brk'), 'bumping into the hider finds them');
  const sc2 = await A.evaluate(() => { const s = window.pokecraft.hideSeek.state(); return Object.values(s.score).join(','); });
  t.ok(sc2 === '1,1', `score is 1 - 1 (${sc2})`);

  // 8. Fence (round 3 head start: B hides)
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.state().n === 3), 'round 3 begins');
  await standAt(A, -20);
  const fence = await B.evaluate(async () => {
    const g = window.pokecraft, s = g.hideSeek.state(), p = g.player.pos;
    const before = p.clone();
    const out = before.clone(); out.x = s.center[0] + 41; out.z = s.center[1];
    before.x = s.center[0] + 39; before.z = s.center[1];
    const pos = out.clone(), vel = { x: 3, z: 3, y: 0 };
    g.hideSeek.fence(pos, before, vel);
    const r1 = pos.distanceTo(before) < 0.001 && vel.x === 0;
    const gy = g.world.gyms.find(x => !x.home && x.protect?.length);
    const bx = gy.protect[0];
    const inside = out.clone().set(bx.x0 + 1, bx.y0 + 1, bx.z0 + 1);
    const pos2 = inside.clone();
    g.hideSeek.fence(pos2, p.clone(), { x: 0, z: 0, y: 0 });
    return { r1, r2: pos2.distanceTo(p) < 0.001 };
  });
  t.ok(fence.r1, 'stepping out of the play area puts you back');
  t.ok(fence.r2, 'stepping into a gym puts you back');
  t.ok(await waitFor(B, () => /edge of the play area|No hiding in gyms/.test(document.getElementById('toast').textContent), null, 3000), 'the fence gives a kind toast');

  // riding gets you off
  const ride = await B.evaluate(async () => {
    const g = window.pokecraft;
    if (!g.riding) return 'skip';
    const { makeCreature } = await import('/src/species.js');
    const c = makeCreature('blazehound', 20); c.traits = ['rideable'];
    g.party.unshift(c);
    if (!g.riding.start(c)) return 'nostart';
    for (let i = 0; i < 100 && g.riding.creature; i++) await new Promise(r => setTimeout(r, 300));
    return !g.riding.creature;
  });
  t.ok(ride === 'skip' || ride === true || ride === 'nostart', 'no riding during the game');

  // 7b. Time-out: nobody finds B in round 3 -> hider (B) gets the point
  await A.evaluate(async () => (await import('/src/hideseek.js')).HS.seek = 6);
  t.ok(await waitFor(A, () => window.pokecraft.hideSeek.state().phase === 'brk' && window.pokecraft.hideSeek.state().n === 3, null, 40000), 'round 3 ends by time');
  const fin = await Promise.all([A, B].map(p => p.evaluate(() => { const s = window.pokecraft.hideSeek.state(); const m = window.pokecraft.mp;
    return JSON.stringify(Object.entries(s.score).map(([k, v]) => [k === m.id ? 'me' : 'other', v]).sort()); })));
  t.ok(fin[0] === JSON.stringify([['me', 1], ['other', 2]]) && fin[1] === JSON.stringify([['me', 2], ['other', 1]]), `Kid got the time-out point: Dad 1 - Kid 2 on both pages (${fin.join(' / ')})`);

  // 9. Stop from the non-leader's pause box
  await standAt(A, 0); await standAt(B, 4);
  await pause(B);
  t.ok(await waitFor(B, () => [...document.querySelectorAll('#mp button')].some(b => b.textContent === 'Stop hide and seek')), 'the pause box has "Stop hide and seek"');
  await click(B, '#mp button:has-text("Stop hide and seek")');
  t.ok(await waitFor(A, () => !window.pokecraft.hideSeek.active) && !(await st(B)).active, 'stopping ends it for both');
  const clean = await Promise.all([A, B].map(p => p.evaluate(() => ['seek-compass', 'hs-hud', 'hs-dark'].every(id => document.getElementById(id).classList.contains('hidden'))
    && [...window.pokecraft.mp.others.values()].every(a => !a.hiding && a.tag.visible && a.model.visible))));
  t.ok(clean[0] && clean[1], 'overlays gone, name tags and people back');
  t.ok((await toasts(A)).includes('stopped the game') && (await toasts(A)).includes('Final score'), 'Dad sees "Kid stopped the game" and the final score');

  // 10. Busy
  await A.evaluate(() => { window.pokecraft.hideSeek.reset(); });
  await B.evaluate(() => { window.pokecraft.duels.incoming = { id: 'x', from: 'zz', name: 'Zed', team: [], seed: 1, timer: setTimeout(() => {}, 100) }; });
  await A.evaluate(() => window.pokecraft.hideSeek.invite([...window.pokecraft.mp.others.values()][0]));
  t.ok(await waitFor(A, () => document.getElementById('toast').textContent.includes('busy right now'), null, 8000), 'a busy player answers "busy"');
  await B.evaluate(() => { clearTimeout(window.pokecraft.duels.incoming.timer); window.pokecraft.duels.incoming = null; });
  await A.waitForTimeout(3200);

  // 9b. Start again; the watchdog; then leaving
  const startGame = async () => {
    await A.evaluate(() => window.pokecraft.hideSeek.invite([...window.pokecraft.mp.others.values()][0]));
    await waitFor(B, () => !document.getElementById('ask').classList.contains('hidden'));
    await B.keyboard.press('y');
    return waitFor(A, () => window.pokecraft.hideSeek.active) && waitFor(B, () => window.pokecraft.hideSeek.active);
  };
  t.ok(await startGame(), 'a new game starts');
  await A.evaluate(() => clearInterval(window.pokecraft.hideSeek.ticker));
  t.ok(await waitFor(B, () => !window.pokecraft.hideSeek.active, null, 20000), 'the other side ends the game when the leader goes quiet');
  t.ok((await toasts(B)).includes('Lost touch with Dad'), 'Kid sees "Lost touch with Dad"');
  await A.evaluate(() => window.pokecraft.hideSeek.reset());
  await A.waitForTimeout(3200);
  t.ok(await startGame(), 'and again');
  await B.evaluate(() => window.pokecraft.mp.close());
  t.ok(await waitFor(A, () => !window.pokecraft.hideSeek.active, null, 12000), 'Dad\'s game ends when Kid leaves');
  t.ok((await toasts(A)).includes('left, so hide and seek is over'), 'Dad sees "Kid left, so hide and seek is over."');

  // 12. No errors
  t.ok(A.errors.length === 0 && B.errors.length === 0, `no page errors (${[...A.errors, ...B.errors].slice(0, 2).join(' / ')})`);
  await A.context().close(); await B.context().close();

  // 11. iPad pair
  const [TA, TB] = await openPair(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  for (const p of [TA, TB]) { await p.tap('text=New Game', { timeout: 120000 }); await p.tap('.starter >> nth=0', { timeout: 120000 }); await p.waitForTimeout(1500); }
  await TA.evaluate(async () => { const g = window.pokecraft; await g.mp.host('Dad'); });
  const code = await TA.evaluate(() => window.pokecraft.mp.code);
  await TB.evaluate(async code => { await window.pokecraft.mp.join(code, 'Kid'); }, code);
  await TA.evaluate(SHORT); await TB.evaluate(SHORT);
  await TA.evaluate(() => { window.pokecraft.touch.reset(); });
  await standAt(TA, 0); await standAt(TB, 5);
  await TA.waitForTimeout(2000);
  await TA.evaluate(() => window.pokecraft.hideSeek.invite([...window.pokecraft.mp.others.values()][0]));
  await waitFor(TB, () => !document.getElementById('ask').classList.contains('hidden'));
  await TB.tap('#ask-yes');
  t.ok(await waitFor(TA, () => window.pokecraft.hideSeek.state().frozen), 'iPad: the seeker is frozen in the head start');
  await shot(TA, 't30-touch-dark.png');
  const cdp = await TA.context().newCDPSession(TA);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const joy = await TA.evaluate(() => { const r = document.getElementById('joystick').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const p0 = await TA.evaluate(() => window.pokecraft.player.pos.x);
  await touch('touchStart', [[joy[0], joy[1], 1]]);
  for (let i = 0; i < 5; i++) { await touch('touchMove', [[joy[0], joy[1] - 60, 1]]); await TA.waitForTimeout(150); }
  await touch('touchEnd', []);
  t.ok(Math.abs(await TA.evaluate(() => window.pokecraft.player.pos.x) - p0) < 0.05, 'iPad: the joystick does not move the frozen seeker');
  await shot(TA, 't30-touch-dark.png');
  t.ok(await TA.evaluate(() => { return parseFloat(getComputedStyle(document.getElementById('hs-stop')).minHeight) >= 44; }), 'the Stop button is big enough to tap');
  t.ok(await waitFor(TA, () => window.pokecraft.hideSeek.state().phase === 'seek'), 'iPad: the seek phase begins');
  await TA.evaluate(() => { const g = window.pokecraft, k = [...g.mp.others.values()][0]; g.player.lookAt(k.pos.clone().setY(k.pos.y + 1)); });
  t.ok(await waitFor(TA, () => document.getElementById('btn-act').textContent === 'Found you!'), 'iPad: the action button says "Found you!"');
  await shot(TA, 't30-touch.png');
  const pt = await TA.evaluate(() => {
    const g = window.pokecraft, k = [...g.mp.others.values()][0];
    const v = k.pos.clone(); v.y += 1; v.project(g.camera || window.__camera);
    return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
  }).catch(() => null);
  if (pt) await TA.touchscreen.tap(pt[0], pt[1]); else await TA.tap('#btn-act');
  t.ok(await waitFor(TA, () => window.pokecraft.hideSeek.state().phase === 'brk'), 'iPad: tapping the hider finds them');
  t.ok(TA.errors.length === 0 && TB.errors.length === 0, `no iPad page errors (${[...TA.errors, ...TB.errors].slice(0, 2).join(' / ')})`);
  await TA.context().close(); await TB.context().close();
}
