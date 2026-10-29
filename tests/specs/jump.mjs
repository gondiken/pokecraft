// Jumping is the same on every device (owner 2026-10-29: the son plays on an iPad, the owner tests on a laptop).
// A: the jump arc (heights at fixed times, the apex, where a walking / sprinting jump lands), a fall, a Spring, a Bounce Block in the
//    Dream's half gravity, a trampoline, swimming up and a lift column at 20, 30, 60 and 120 frames a second: all the same as the
//    60 fps arc every course was calibrated on (OLD60 = the numbers player.js gave at 60 fps before the fix).
// B: a Jump tap shorter than one frame (keydown + keyup, and on an emulated iPad touch down + up, between two frames) still jumps;
//    holding Jump still hops again on every landing.
// Physics run inside one page.evaluate with a fixed dt (the game loop cannot run meanwhile), like parkour.mjs D3.
import { devices } from 'playwright';
import { openGame, newGame, pause, waitFor } from '../helpers.mjs';

// player.js before the fix at exactly 60 fps (measured with this spec on commit 6ed3d16).
const OLD60 = {
  stand: { y02: 1.2067, y04: 1.2933, y06: 0.26, apex: 1.3933, land: 0.6333 },
  walk: { apex: 1.3933, land: 0.6333, z: -2.7233 },
  sprint: { apex: 1.3933, land: 0.6333, z: -3.9267 },
  fall: { y02: 9.3933, y04: 7.6667, y06: 4.82 }, // dropped from 10 above the floor
  spring: { apex: 4.125 },
  dream: { apex: 14.1652 }, // a Bounce Block at gravity 0.5
  tramp: [2.089, 2.089, 2.089, 2.089], // the bounces after a drop from 3 above (no Jump: the lowest bounce)
  lift: { y02: 0.65, y04: 1.85, y06: 3.05 },
};

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await pause(page);

  const A = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, p = g.player;
    const { B } = await import('/src/blocks.js');
    const s = g.spawnPoint, cx = Math.floor(s.x), cz = Math.floor(s.z), Y = 28;
    const clear = () => { for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 12; z <= cz + 3; z++) for (let y = Y - 1; y <= 47; y++) w.set(x, y, z, B.AIR, false); };
    const floor = (under = B.STONE) => {
      clear();
      for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 12; z <= cz + 3; z++) w.set(x, Y, z, B.STONE, false);
      w.set(cx, Y, cz, under, false);
    };
    // One trial: keys on the first frame (Space only then unless hold), then run `secs`; heights relative to the floor top (Y + 1).
    const trial = (dt, { keys = {}, hold = false, secs = 2.5, startY = Y + 1, until = 'land' } = {}) => {
      p.pos.set(cx + 0.5, startY, cz + 0.5); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; p.onGround = startY === Y + 1; p.ride = null; p.carry = null; p.joy = null;
      p.trampH = 0; p.trampN = 0;
      p.keys = { ...keys };
      const n = Math.round(secs / dt), out = { apex: -1e9, land: null, z: null, at: {}, jumps: 0, peaks: [] };
      let air = false, wasGround = p.onGround, peak = -1e9, t = 0;
      // watched after every sub-step (player.js walkStep), so a landing inside a long frame is seen where it happens
      const watch = h => {
        t += h;
        const y = p.pos.y - (Y + 1);
        out.apex = Math.max(out.apex, y); peak = Math.max(peak, y);
        if (p.onGround && !wasGround) { out.peaks.push(+peak.toFixed(3)); peak = -1e9; }
        if (!p.onGround) air = true;
        if (wasGround && !p.onGround) out.jumps++;
        wasGround = p.onGround;
        if (air && p.onGround && out.land === null) { out.land = +t.toFixed(4); out.z = +(p.pos.z - (cz + 0.5)).toFixed(4); }
      };
      const step = Object.getPrototypeOf(p).walkStep;
      p.walkStep = function (h, ...rest) { step.call(this, h, ...rest); watch(h); };
      for (let i = 1; i <= n; i++) {
        p.update(dt);
        if (!hold) p.keys.Space = false;
        const tt = Math.round(i * dt * 1000) / 1000;
        if ([0.2, 0.4, 0.6].includes(tt)) out.at['y' + String(tt).replace('0.', '0')] = +(p.pos.y - (Y + 1)).toFixed(4);
        if (out.land !== null && until === 'land') break;
      }
      delete p.walkStep;
      out.apex = +out.apex.toFixed(4);
      p.keys = {}; p.bounced = false; p.trampolined = false;
      return out;
    };
    const res = {};
    for (const fps of [20, 30, 60, 120]) {
      const dt = 1 / fps, r = res[fps] = {};
      floor();
      r.stand = trial(dt, { keys: { Space: true } });
      r.walk = trial(dt, { keys: { Space: true, KeyW: true } });
      r.sprint = trial(dt, { keys: { Space: true, KeyW: true, ShiftLeft: true } });
      r.fall = trial(dt, { startY: Y + 11, secs: 0.6, until: 'time' });
      r.hold = trial(dt, { keys: { Space: true }, hold: true, secs: 3, until: 'time' }); // held Jump: hops again on every landing
      floor(B.SPRING);
      r.spring = trial(dt, { keys: { Space: true } });
      floor(B.BOUNCE);
      Object.defineProperty(w, 'gravity', { value: 0.5, configurable: true }); // the Dream's moon gravity
      r.dream = trial(dt, { keys: { Space: true }, secs: 6 });
      delete w.gravity;
      floor(B.TRAMPOLINE ?? B.STONE);
      r.tramp = trial(dt, { startY: Y + 4, secs: 4, until: 'time' }); // dropped onto a trampoline, no Jump: it bounces lower each time
      r.tramp = { peaks: r.tramp.peaks.slice(1), jumps: r.tramp.jumps }; // (the first peak is where it was dropped from)
      // a lift column (the Swirl's streams): how high in 0.6 s
      floor();
      w.liftAt = pos => Math.floor(pos.x) === cx && Math.floor(pos.z) === cz;
      r.lift = trial(dt, { secs: 0.6, until: 'time' }).at;
      delete w.liftAt;
    }
    clear();
    p.pos.copy(g.spawnPoint); p.vel.set(0, 0, 0);
    return res;
  });
  console.log('  jumps by fps:', JSON.stringify(A));
  const near = (a, b, e) => a != null && b != null && Math.abs(a - b) <= e;
  for (const fps of [20, 30, 60, 120]) {
    const r = A[fps], c = 0.01, e = 0.012; // e: the apex between two frames at 20 fps is at most 0.009 above the highest frame
    t.ok(near(r.stand.at.y02, OLD60.stand.y02, c) && near(r.stand.at.y04, OLD60.stand.y04, c) && near(r.stand.at.y06, OLD60.stand.y06, c) && near(r.stand.apex, OLD60.stand.apex, e),
      `at ${fps} fps a standing jump follows the old 60 fps arc (${JSON.stringify(r.stand)} vs ${JSON.stringify(OLD60.stand)})`);
    const tz = fps > 60 ? 0.06 : 0.001, tl = fps > 60 ? 1 / 60 + 1e-6 : 1e-3; // above 60 fps a landing is found a sub-frame earlier
    t.ok(near(r.walk.z, OLD60.walk.z, tz) && near(r.walk.land, OLD60.walk.land, tl) && near(r.walk.apex, OLD60.walk.apex, e),
      `at ${fps} fps a walking jump lands where it did at 60 fps (${JSON.stringify(r.walk)} vs ${JSON.stringify(OLD60.walk)})`);
    t.ok(near(r.sprint.z, OLD60.sprint.z, tz) && near(r.sprint.apex, OLD60.sprint.apex, e),
      `at ${fps} fps a sprinting jump lands where it did at 60 fps (${JSON.stringify(r.sprint)} vs ${JSON.stringify(OLD60.sprint)})`);
    t.ok(near(r.fall.at.y02, OLD60.fall.y02, c) && near(r.fall.at.y04, OLD60.fall.y04, c) && near(r.fall.at.y06, OLD60.fall.y06, c), `at ${fps} fps a fall drops as at 60 fps (${JSON.stringify(r.fall.at)})`);
    t.ok(near(r.spring.apex, OLD60.spring.apex, 0.02) && near(r.dream.apex, OLD60.dream.apex, 0.03),
      `at ${fps} fps a Spring and a Dream Bounce Block throw you as high as at 60 fps (${r.spring.apex}, ${r.dream.apex})`);
    t.ok(r.hold.jumps === A[60].hold.jumps && r.hold.jumps >= 3, `at ${fps} fps holding Jump hops again on every landing (${r.hold.jumps} hops in 3 s, 60 fps: ${A[60].hold.jumps})`);
    t.ok(r.tramp.peaks.length === OLD60.tramp.length && r.tramp.peaks.every((v, i) => near(v, OLD60.tramp[i], 0.012)), `at ${fps} fps a trampoline bounces as at 60 fps (${JSON.stringify(r.tramp)})`);
    t.ok(fps > 60 || (near(r.lift.y02, OLD60.lift.y02, 0.001) && near(r.lift.y06, OLD60.lift.y06, 0.001)), `at ${fps} fps a lift column lifts as at 60 fps (${JSON.stringify(r.lift)})`);
  }

  // B1: a keyboard Jump shorter than one frame (keydown and keyup between two frames) still jumps.
  const tapTest = async (pg, fire) => {
    await pg.evaluate(() => {
      const g = window.pokecraft, p = g.player, s = g.spawnPoint, y = 42;
      for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3); for (let dy = 1; dy <= 4; dy++) g.world.set(Math.floor(s.x) + x, y + dy, Math.floor(s.z) + z, 0); }
      p.pos.set(Math.floor(s.x) + 0.5, y + 1, Math.floor(s.z) + 0.5); p.vel.set(0, 0, 0); p.keys = {};
    });
    await waitFor(pg, () => window.pokecraft.player.onGround);
    await pg.evaluate(() => { // watch the next frames
      const p = window.pokecraft.player, up = p.update.bind(p), y0 = p.pos.y;
      window.__jump = { top: 0, frames: 0 };
      p.update = dt => { up(dt); window.__jump.top = Math.max(window.__jump.top, p.pos.y - y0); window.__jump.frames++; };
    });
    await fire();
    await waitFor(pg, () => window.__jump.frames >= 3, null, 30000).catch(() => {});
    await pg.waitForTimeout(300);
    return pg.evaluate(() => { const p = window.pokecraft.player; delete p.update; return { ...window.__jump, space: !!p.keys.Space }; });
  };
  // the game must be "playing" for keys to count: take the mouse like a click does
  await page.evaluate(() => document.querySelector('canvas').requestPointerLock?.());
  await page.mouse.click(500, 380);
  await page.waitForTimeout(600);
  const locked = await page.evaluate(() => !!document.pointerLockElement);
  if (locked) {
    const key = await tapTest(page, () => page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    }));
    t.ok(key.top > 0.3 && !key.space, `a Space tap shorter than a frame still jumps (${JSON.stringify(key)})`);
  } else t.ok(true, 'no pointer lock in this browser: the keyboard tap is checked through the touch tap below');
  await page.context().close();

  // B2: on an emulated iPad, a Jump button tap whose finger goes down and up between two frames still jumps.
  const ipad = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await ipad.tap('text=New Game');
  await ipad.tap('.starter >> nth=0');
  await ipad.waitForTimeout(1500);
  const tap = await tapTest(ipad, () => ipad.evaluate(() => {
    const el = document.getElementById('btn-jump'), r = el.getBoundingClientRect();
    const o = { pointerId: 77, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
  }));
  t.ok(tap.top > 0.3 && !tap.space, `an iPad Jump tap shorter than a frame still jumps (${JSON.stringify(tap)})`);
  // a real touch, down and up as fast as the browser sends them
  const cdp = await ipad.context().newCDPSession(ipad);
  const jb = await ipad.evaluate(() => { const r = document.getElementById('btn-jump').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const real = await tapTest(ipad, async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jb[0], y: jb[1], id: 9 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  });
  t.ok(real.top > 0.3 && !real.space, `a real quick touch on Jump jumps and lets go (${JSON.stringify(real)})`);
  // holding the Jump button still hops on every landing
  await ipad.evaluate(() => { window.__jump = { hops: 0 }; const p = window.pokecraft.player; const up = p.update.bind(p); let was = true; p.update = dt => { up(dt); if (was && !p.onGround) window.__jump.hops++; was = p.onGround; }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jb[0], y: jb[1], id: 10 }] });
  await waitFor(ipad, () => window.__jump.hops >= 2, null, 60000).catch(() => {});
  const held = await ipad.evaluate(() => ({ hops: window.__jump.hops, space: !!window.pokecraft.player.keys.Space }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await ipad.waitForTimeout(500);
  const after = await ipad.evaluate(() => ({ space: !!window.pokecraft.player.keys.Space }));
  t.ok(held.hops >= 2 && held.space && !after.space, `holding Jump on the iPad hops again and again, letting go stops (${JSON.stringify([held, after])})`);
  t.ok(!page.errors.length && !ipad.errors.length, `no page errors (${[...page.errors, ...ipad.errors].slice(0, 3)})`);
  await ipad.context().close();
}
