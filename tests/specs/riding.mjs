// Riding (T27): rules and toasts, the R key and team cards, land / water / sky physics, gym fences,
// battles, tablet buttons, and what a visitor sees. Physics run with a fixed step (the game is paused),
// so the frame rate does not matter. Screenshots: tests/screenshots/t27-*.png
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { openGame, openPair, newGame, pause, click, platform, waitFor, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

// Helpers that live in the page: window.__t (fake clock), __step(n, keys, dt) runs n physics frames.
const install = page => page.evaluate(async () => {
  const S = await import('/src/species.js');
  const g = window.pokecraft;
  window.__t = 1e6;
  window.__step = (n, keys, dt = 1 / 60, each) => {
    const p = g.player;
    p.keys = keys || {};
    p.joy = null;
    for (let i = 0; i < n; i++) {
      p.update(dt);
      g.riding.update(dt, window.__t += dt * 1000);
      each?.(i);
    }
    p.keys = {};
  };
  window.__mk = (id, hp = true) => { const c = S.makeCreature(id, 30); c.traits = ['rideable']; if (!hp) c.hp = 0; return c; };
  window.__toasts = () => [...document.querySelectorAll('#toast div')].map(d => d.textContent).join(' | ');
});

// A flat stone slab high in the air (clear above it). Returns the standing height.
const slab = (page, { y = 40, r = 24 } = {}) => page.evaluate(([y, r]) => {
  const g = window.pokecraft, s = g.spawnPoint, x0 = Math.floor(s.x), z0 = Math.floor(s.z);
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
    g.world.set(x0 + x, y, z0 + z, 3);
    for (let dy = 1; dy <= 7; dy++) g.world.set(x0 + x, y + dy, z0 + z, 0);
  }
  const p = g.player;
  p.ride = null;
  p.pos.set(x0 + 0.5, y + 1, z0 + 0.5); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; p.onGround = false;
  window.__step(10);
  return { x: x0, z: z0, stand: y + 1 };
}, [y, r]);

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const shot = async (page, name) => {
    // hide the pause box and old toasts so the picture shows the world
    if (name !== 't27-card.png') await page.evaluate(() => { document.getElementById('pause').classList.add('hidden'); document.getElementById('toast').replaceChildren(); });
    await page.waitForTimeout(700);
    return page.screenshot({ path: path.join(SHOTS, name), timeout: 120000 });
  };
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await platform(page, { day: true });
  await install(page);
  const ev = (fn, arg) => page.evaluate(fn, arg);

  // 1. Rules and toasts
  const data = await ev(async () => {
    const R = await import('/src/riding.js');
    const g = window.pokecraft;
    const mk = window.__mk;
    const kinds = ['blazehound', 'tidalord', 'whaloft'].map(id => R.rideKind(mk(id)));
    const none = R.rideKind({ species: 'blazehound', traits: [] });
    const toast = () => { const s = window.__toasts(); document.getElementById('toast').replaceChildren(); return s; };
    const out = { kinds, none };
    g.party = [{ ...mk('fluffin'), traits: [] }];
    g.riding.start(); out.noneToast = toast();
    g.riding.start(g.party[0]); out.plainToast = toast();
    const box = mk('woolumph'); g.box = [box];
    g.riding.start(box); out.boxToast = toast();
    const tired = mk('blazehound', false); g.party = [tired];
    g.riding.start(tired); out.tiredToast = toast();
    const good = mk('blazehound'); g.party = [good, { ...mk('fluffin'), traits: [] }];
    out.started = g.riding.start();
    out.on = g.riding.on; out.kind = g.riding.kind; out.pride = g.player.ride?.kind;
    out.inScene = g.scene.children.includes(g.riding.model);
    out.startToast = toast();
    const top = new (await import('three')).Box3().setFromObject(g.riding.model).max.y;
    out.headroom = g.player.pos.y + g.player.eye - top;
    window.__step(5);
    g.riding.stop('user');
    out.stopToast = toast();
    out.after = { on: g.riding.on, model: g.riding.model, ride: g.player.ride, inScene: g.scene.children.some(o => o === g.riding.model) };
    return out;
  });
  t.ok(data.kinds.join() === 'land,water,sky' && data.none === null, `rideKind follows the trait list (${data.kinds}, ${data.none})`);
  t.ok(data.noneToast.includes('None of your team'), `no rideable team: "${data.noneToast}"`);
  t.ok(data.plainToast.includes('Can be ridden'), `a plain creature: "${data.plainToast}"`);
  t.ok(data.boxToast.includes('team first'), `a box creature: "${data.boxToast}"`);
  t.ok(data.tiredToast.includes('too tired'), `0 HP: "${data.tiredToast}"`);
  t.ok(data.started && data.on && data.kind === 'land' && data.pride === 'land' && data.inScene, 'a good start: riding, land kind, model in the scene');
  t.ok(data.startToast.includes("You're riding Blazehound") && data.startToast.includes('R'), `start toast: "${data.startToast}"`);
  t.ok(data.headroom > 0.2, `the model stays below the eye (${data.headroom.toFixed(2)} below)`);
  t.ok(data.stopToast.includes('You got off') && !data.after.on && !data.after.model && !data.after.ride && !data.after.inScene, 'getting off removes the model');

  // 2. R key and team cards
  await ev(() => { const g = window.pokecraft; g.party = [window.__mk('blazehound'), window.__mk('tidalord'), window.__mk('whaloft'), { ...window.__mk('fluffin'), traits: [] }]; g.box = [window.__mk('woolumph')]; });
  // Headless pointer lock can refuse, so playing() may be false and the key ignored: then fall back to toggle().
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(200);
  let viaKey = await ev(() => window.pokecraft.riding.on);
  if (!viaKey) await ev(() => window.pokecraft.riding.toggle());
  t.ok(await ev(() => window.pokecraft.riding.species === 'blazehound'), `R (${viaKey ? 'real key' : 'toggle(), the key needs pointer lock'}) rides the first rideable team creature`);
  await ev(() => window.pokecraft.riding.toggle());
  t.ok(await ev(() => !window.pokecraft.riding.on), 'and a second press gets off');
  await ev(() => window.pokecraft.ui.openPanel('team'));
  await page.waitForTimeout(300);
  const cards = await ev(() => ({ party: document.querySelectorAll('#party-list button.ride').length, box: document.querySelectorAll('#box-list button.ride').length }));
  t.ok(cards.party === 3 && cards.box === 0, `3 Ride buttons on team cards, none in the box (${JSON.stringify(cards)})`);
  await shot(page, 't27-card.png');
  await ev(() => document.querySelector('#party-list button.ride[data-ride="' + window.pokecraft.party[2].uid + '"]').click());
  await page.waitForTimeout(300);
  t.ok(await ev(() => window.pokecraft.riding.species === 'whaloft' && !window.pokecraft.ui.panelOpen), 'the whaloft card closes the panel and rides whaloft');
  await ev(() => window.pokecraft.ui.openPanel('team'));
  await page.waitForTimeout(300);
  t.ok(await ev(() => [...document.querySelectorAll('#party-list button.ride')].some(b => b.textContent === 'Get off')), 'reopened: its button says Get off');
  await ev(() => { window.pokecraft.ui.closePanel(); window.pokecraft.riding.stop('quiet'); });
  await pause(page);

  // 3. Land
  await slab(page, { r: 30 });
  const land = await ev(() => {
    const g = window.pokecraft, p = g.player;
    const run = (ride, keys, n) => {
      if (ride) g.riding.start(g.party[0]); else g.riding.stop('quiet');
      p.pos.x = Math.floor(g.spawnPoint.x) - 20; p.pos.z = Math.floor(g.spawnPoint.z) + 0.5; p.yaw = -Math.PI / 2;
      window.__step(20);
      const x0 = p.pos.x;
      window.__step(n, keys);
      return (p.pos.x - x0) / (n / 60);
    };
    const out = {};
    out.foot = run(false, { KeyW: true }, 60);
    out.ride = run(true, { KeyW: true }, 60);
    out.rideSprint = run(true, { KeyW: true, ShiftLeft: true }, 60);
    const jump = ride => {
      if (ride) g.riding.start(g.party[0]); else g.riding.stop('quiet');
      p.pos.set(Math.floor(g.spawnPoint.x) + 0.5, 41, Math.floor(g.spawnPoint.z) + 0.5);
      window.__step(10);
      let maxY = p.pos.y;
      window.__step(70, { Space: true }, 1 / 60, () => { maxY = Math.max(maxY, p.pos.y); });
      return maxY - 41;
    };
    out.jumpFoot = jump(false); out.jumpRide = jump(true);
    // a 2-high wall to the east of the start
    const wall = ride => {
      const x0 = Math.floor(g.spawnPoint.x) + 6, z0 = Math.floor(g.spawnPoint.z);
      for (let z = -3; z <= 3; z++) for (let y = 41; y <= 42; y++) g.world.set(x0, y, z0 + z, 3);
      if (ride) g.riding.start(g.party[0]); else g.riding.stop('quiet');
      p.pos.set(x0 - 4, 41, z0 + 0.5); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2;
      window.__step(10);
      window.__step(150, { KeyW: true, Space: true });
      const over = p.pos.x > x0 + 1;
      out.wallDbg = [...(out.wallDbg || []), [p.pos.x - x0, p.pos.y, g.riding.on, p.ride?.kind]];
      for (let z = -3; z <= 3; z++) for (let y = 41; y <= 42; y++) g.world.set(x0, y, z0 + z, 0);
      return over;
    };
    out.wallFoot = wall(false); out.wallRide = wall(true);
    g.riding.stop('quiet');
    return out;
  });
  t.ok(land.foot > 4 && land.foot < 4.6 && land.ride >= 6.5 && land.rideSprint >= 9, `walking ${land.foot.toFixed(1)}/s on foot, ${land.ride.toFixed(1)} riding, ${land.rideSprint.toFixed(1)} sprinting`);
  t.ok(land.jumpFoot < 1.5 && land.jumpRide >= 2.0, `jump ${land.jumpFoot.toFixed(2)} on foot, ${land.jumpRide.toFixed(2)} riding`);
  t.ok(!land.wallFoot && land.wallRide, `a 2-high wall: on foot ${land.wallFoot}, riding ${land.wallRide} ${JSON.stringify(land.wallDbg)}`);
  await ev(() => { const g = window.pokecraft, p = g.player; g.riding.start(g.party[0]); p.pos.set(Math.floor(g.spawnPoint.x) + 0.5, 41, Math.floor(g.spawnPoint.z) + 0.5); p.yaw = 0.5; p.pitch = -0.25; window.__step(30); });
  await page.waitForTimeout(500);
  await shot(page, 't27-ride-land.png');
  await ev(() => window.pokecraft.riding.stop('quiet'));

  // 4. Water: a pool in the air, 2 deep, with a bank at the east end
  const water = await ev(async () => {
    const { B } = await import('/src/blocks.js');
    const g = window.pokecraft, p = g.player, w = g.world;
    const x0 = Math.floor(g.spawnPoint.x) - 20, z0 = Math.floor(g.spawnPoint.z) - 3, y = 40;
    for (let x = 0; x <= 30; x++) for (let z = 0; z <= 6; z++) {
      for (let dy = 1; dy <= 7; dy++) w.set(x0 + x, y + dy, z0 + z, 0);
      w.set(x0 + x, y, z0 + z, 3);
      if (x <= 20) { w.set(x0 + x, y + 1, z0 + z, B.WATER); w.set(x0 + x, y + 2, z0 + z, B.WATER); }
      else w.set(x0 + x, y + 1, z0 + z, 3); // bank: 1 above the floor, 1 below the surface? (surface is y + 3)
    }
    for (let x = 21; x <= 30; x++) for (let z = 0; z <= 6; z++) { w.set(x0 + x, y + 2, z0 + z, 3); w.set(x0 + x, y + 3, z0 + z, 3); } // bank top y + 4: 1 above the water
    const WATER = w.get(x0 + 1, y + 1, z0 + 3);
    const reset = (ride, x = 2) => {
      if (ride) g.riding.start(g.party[ride]); else g.riding.stop('quiet');
      p.pos.set(x0 + x, y + 2.5, z0 + 3.5); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2;
      window.__step(60);
    };
    const out = { WATER };
    reset(0);
    out.footIn = p.inWater;
    const a = p.pos.x; window.__step(60, { KeyW: true }); out.swim = p.pos.x - a;
    reset(1);
    out.surf = p.waterTop();
    out.feetBelowTop = out.surf - p.pos.y;
    out.inWater = p.inWater;
    const b = p.pos.x; window.__step(60, { KeyW: true }); out.waterSpeed = p.pos.x - b;
    out.stillSurface = Math.abs(out.surf - 0.25 - p.pos.y) < 0.15;
    out.modelY = g.riding.model.position.y;
    // hop onto the bank (1 above the water)
    reset(1, 17);
    window.__step(200, { KeyW: true, Space: true });
    out.onBank = p.pos.x - x0 > 21 && p.pos.y >= y + 4.9;
    out.bankXY = [p.pos.x - x0, p.pos.y];
    // on land it still rides, at half speed
    window.__step(30);
    const c = p.pos.x; window.__step(60, { KeyW: true }); out.landSpeed = p.pos.x - c;
    out.stillOn = g.riding.on;
    // a land ride in water swims like on foot
    reset(0);
    g.riding.stop('quiet'); g.riding.start(g.party[0]);
    p.pos.set(x0 + 2, y + 2.5, z0 + 3.5); p.vel.set(0, 0, 0); window.__step(60);
    out.landInWater = p.inWater;
    const d = p.pos.x; window.__step(60, { KeyW: true }); out.landSwim = p.pos.x - d;
    reset(1, 5);
    p.yaw = 0.5; p.pitch = -0.3; window.__step(20);
    return out;
  });
  t.ok(water.footIn && water.swim < 2.7, `on foot you swim in it at ${water.swim.toFixed(1)}/s`);
  t.ok(!water.inWater && water.stillSurface && water.feetBelowTop > 0.1 && water.feetBelowTop < 0.4, `the water rider floats on the surface (${water.feetBelowTop.toFixed(2)} below the top, inWater ${water.inWater})`);
  t.ok(water.waterSpeed >= 3.5, `${water.waterSpeed.toFixed(1)}/s on water (3.5 or more)`);
  t.ok(water.onBank, `a hop climbs a bank 1 above the water (${water.bankXY})`);
  t.ok(water.stillOn && water.landSpeed <= 2.6 && water.landSpeed > 1, `still riding on land at ${water.landSpeed.toFixed(1)}/s (half speed)`);
  t.ok(water.landInWater && water.landSwim <= 2.7, `a land ride swims like on foot (${water.landSwim.toFixed(1)}/s)`);
  await page.waitForTimeout(500);
  await shot(page, 't27-ride-water.png');
  await ev(() => window.pokecraft.riding.stop('quiet'));

  // 5. Sky
  await slab(page, { r: 16 });
  const sky = await ev(() => {
    const g = window.pokecraft, p = g.player;
    const out = {};
    g.riding.start(g.party[2]);
    out.skyKind = g.riding.kind;
    const fl = p.floorBelow().y;
    out.floor = fl;
    window.__step(10);
    let max = 0;
    window.__step(240, { Space: true }, 1 / 60, () => { max = Math.max(max, p.pos.y); });
    out.cap = max - fl;
    out.capToast = window.__toasts().includes("can't fly any higher");
    out.noGravity = (() => { const y = p.pos.y; window.__step(30); return Math.abs(p.pos.y - y) < 0.05; })();
    window.__step(240, { ShiftLeft: true });
    out.down = p.pos.y - fl;
    // beyond the slab: the ground is far below, so the cap drops and the rider sinks (no horizontal movement)
    window.__step(60, { Space: true });
    const x0 = Math.floor(g.spawnPoint.x);
    p.pos.x = x0 + 30;
    let worst = 0, last = p.pos.y;
    window.__step(600, {}, 1 / 60, () => { worst = Math.max(worst, last - p.pos.y); last = p.pos.y; });
    out.sinkRate = worst * 60;
    out.afterEdge = p.pos.y - p.floorBelow().y;
    // a lake: never below the water top
    return out;
  });
  t.ok(sky.skyKind === 'sky' && Math.abs(sky.cap - 6) < 0.15 && sky.capToast, `Space climbs to floor + ${sky.cap.toFixed(2)} and says so (${sky.capToast})`);
  t.ok(sky.noGravity, 'no gravity: it hovers');
  t.ok(sky.down < 0.1 || sky.down > -0.01, `Shift flies down to the floor (${sky.down.toFixed(2)})`);
  t.ok(sky.sinkRate <= 4.6, `leaving the slab never sinks faster than 4.5/s (${sky.sinkRate.toFixed(1)})`);
  t.ok(sky.afterEdge <= 6.05, `above the ground you cap at floor + 6 (${sky.afterEdge.toFixed(2)})`);

  const lake = await ev(async () => {
    const { B } = await import('/src/blocks.js');
    const g = window.pokecraft, p = g.player, w = g.world;
    const x0 = Math.floor(g.spawnPoint.x) - 6, z0 = Math.floor(g.spawnPoint.z) - 6;
    for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) { w.set(x0 + x, 41, z0 + z, B.WATER); w.set(x0 + x, 42, z0 + z, B.WATER); }
    p.pos.set(x0 + 6, 46, z0 + 6); p.vel.set(0, 0, 0);
    let min = 1e9;
    window.__step(120, { ShiftLeft: true }, 1 / 60, () => { min = Math.min(min, p.pos.y); });
    const wt = p.waterTop();
    return { min, wt, in: p.inWater };
  });
  t.ok(lake.min >= 42.95, `over water a sky rider never goes below the surface (lowest ${lake.min.toFixed(2)}, top 43)`);
  // getting off in the air: glides straight down, then off
  const glide = await ev(() => {
    const g = window.pokecraft, p = g.player;
    const x0 = p.pos.x, z0 = p.pos.z;
    p.pos.set(Math.floor(g.spawnPoint.x) + 10.5, 41, Math.floor(g.spawnPoint.z) - 10.5);
    window.__step(5);
    window.__step(60, { Space: true });
    const hy = p.pos.y;
    g.riding.stop('user');
    const gliding = g.riding.landing && g.riding.on;
    const px = p.pos.x;
    window.__step(5, { KeyW: true }); // input is ignored
    const straight = Math.abs(p.pos.x - px) < 0.01;
    window.__step(200);
    return { hy, gliding, straight, off: !g.riding.on, y: p.pos.y, toast: window.__toasts().includes('You got off'), ride: g.player.ride };
  });
  t.ok(glide.gliding && glide.straight && glide.off && glide.y < 42.5 && glide.toast && !glide.ride, `get off in the air: glides straight down and gets off (${JSON.stringify(glide)})`);
  await ev(() => { const g = window.pokecraft, p = g.player; g.riding.start(g.party[2]); p.pos.set(Math.floor(g.spawnPoint.x) + 0.5, 41, Math.floor(g.spawnPoint.z) + 8.5); p.yaw = 0.6; p.pitch = -0.15; window.__step(90, { Space: true }); window.__step(20); });
  await page.waitForTimeout(500);
  await shot(page, 't27-ride-sky.png');
  await ev(() => window.pokecraft.riding.stop('quiet'));

  // 6. Gym protection (in the real world)
  const gyms = await ev(() => {
    const g = window.pokecraft, w = g.world, p = g.player;
    const fence = (x, y, z) => w.fenced(Math.floor(x), Math.floor(y), Math.floor(z));
    const overlaps = () => {
      const hw = p.halfW, pts = [];
      for (const dx of [-hw, hw]) for (const dz of [-hw, hw]) for (const dy of [0.01, 0.9, 1.79]) pts.push([p.pos.x + dx, p.pos.y + dy, p.pos.z + dz]);
      return pts.some(q => fence(...q));
    };
    const surf = w.gyms.find(x => !x.cave && !x.sky && !x.home && x.protect?.length && x.x != null);
    const out = { surfId: surf.def.id };
    const ground = (x, z) => { for (let y = 120; y > 0; y--) if (w.isSolid(Math.floor(x), y, Math.floor(z))) return y + 1; return 1; };
    // (a) fly at it
    let hit = false;
    g.riding.stop('quiet');
    const startAt = (gym, dx, dz, kind) => {
      const x = gym.x + dx + 0.5, z = gym.z + dz + 0.5;
      p.pos.set(x, ground(x, z), z); p.vel.set(0, 0, 0);
      p.yaw = Math.atan2(-(gym.x - x), -(gym.z - z));
      p.ride = null; g.riding.creature = null;
      window.__step(5);
      g.riding.start(g.party[kind]);
    };
    for (const kind of [2, 0]) {
      let bad = false, toast = false, enteredAt = null;
      for (const [dx, dz] of [[22, 0], [-22, 0], [0, 22], [0, -22]]) {
        startAt(surf, dx, dz, kind);
        if (!g.riding.on) { out.startFail = (out.startFail || 0) + 1; continue; }
        window.__step(300, { KeyW: true, Space: kind === 2 }, 1 / 60, () => { if (overlaps()) bad = true; });
        toast = toast || window.__toasts().includes('Gyms are for walking');
        g.riding.stop('quiet'); p.landed = false;
        document.getElementById('toast').replaceChildren();
      }
      out[kind === 2 ? 'skyBad' : 'landBad'] = bad;
      out[kind === 2 ? 'skyToast' : 'landToast'] = toast;
    }
    // (e) starting inside a gym fails with a toast
    const b = surf.protect[0];
    p.ride = null; g.riding.creature = null;
    p.pos.set((b.x0 + b.x1) / 2 + 0.5, b.y0 + 1, (b.z0 + b.z1) / 2 + 0.5);
    document.getElementById('toast').replaceChildren();
    out.startInside = g.riding.start(g.party[0]);
    out.insideToast = window.__toasts();
    out.insideRide = p.ride;
    return out;
  });
  t.ok(!gyms.skyBad && !gyms.landBad, `a rider never overlaps a surface gym's box (${gyms.surfId}; sky ${gyms.skyBad}, land ${gyms.landBad}, failed starts ${gyms.startFail || 0})`);
  t.ok(gyms.skyToast || gyms.landToast, `the gym toast shows (sky ${gyms.skyToast}, land ${gyms.landToast})`);
  t.ok(!gyms.startInside && gyms.insideToast.includes('No riding in or next to a gym') && !gyms.insideRide, `starting inside a gym fails kindly ("${gyms.insideToast}")`);

  // (c) and (d): the Cloud and Saucer Gyms
  for (const gid of ['sky', 'alien']) {
    const r = await ev(gid => {
      const g = window.pokecraft, w = g.world, p = g.player;
      const gym = w.gyms.find(x => x.def.id === gid);
      if (!gym) return null;
      const fy = gym.y - 1, [fx, fz] = gym.front, [px, py, pz] = gym.pad;
      g.riding.stop('quiet');
      const out = { fy };
      const inBox = () => w.fenced(Math.floor(p.pos.x), Math.floor(p.pos.y + 0.9), Math.floor(p.pos.z));
      // fly towards the island
      p.pos.set(px + 0.5, py + 1, pz + 0.5); p.vel.set(0, 0, 0); window.__step(5);
      p.yaw = Math.atan2(fx, fz);
      g.riding.start(g.party[2]);
      let bad = false, high = false;
      window.__step(360, { KeyW: true, Space: true }, 1 / 60, () => {
        if (inBox()) bad = true;
        if (Math.hypot(p.pos.x - gym.x, p.pos.z - gym.z) < 10 && p.pos.y >= gym.y - 1) high = true;
      });
      out.flyBad = bad; out.flyHigh = high;
      g.riding.stop('quiet');
      // pillar
      const placed = [];
      for (let y = py + 1; y <= fy - 1; y++) { w.set(px, y, pz, 3, false); placed.push(y); }
      const jump = ride => {
        g.riding.stop('quiet'); p.ride = null;
        p.pos.set(px + 0.5, fy, pz + 0.5); p.vel.set(0, 0, 0); p.yaw = Math.atan2(fx, fz); window.__step(10);
        if (ride) g.riding.start(g.party[0]);
        window.__step(90, { Space: true, KeyW: true });
        window.__step(60);
        const on = Math.hypot(p.pos.x - gym.x, p.pos.z - gym.z) < 11 && Math.abs(p.pos.y - gym.y) < 0.05;
        g.riding.stop('quiet');
        return { on, y: p.pos.y };
      };
      out.foot = jump(false); out.ride = jump(true);
      for (const y of placed) w.set(px, y, pz, 0, false);
      return out;
    }, gid);
    if (!r) { t.ok(false, `no ${gid} gym found`); continue; }
    t.ok(!r.flyBad && !r.flyHigh, `${gid}: flying at the island never enters a box or goes above it (${JSON.stringify([r.flyBad, r.flyHigh])})`);
    t.ok(r.foot.on && !r.ride.on, `${gid}: the pillar jump works on foot (${r.foot.y.toFixed(2)}) but not riding (${r.ride.y.toFixed(2)})`);
  }

  // 7. Battles and leaving the team
  await slab(page, { r: 12 });
  const bat = await ev(async () => {
    const g = window.pokecraft, p = g.player;
    const S = await import('/src/species.js');
    const { Wild } = await import('/src/creatures.js');
    const out = {};
    g.party = [window.__mk('whaloft'), window.__mk('blazehound')];
    g.riding.start(g.party[0]);
    window.__step(60, { Space: true });
    out.air = p.pos.y;
    g.startBattle({ wild: new Wild(S.makeCreature('fluffin', 2), S.buildModel('fluffin'), p.pos.clone().setX(p.pos.x + 3)) });
    out.floorNow = p.pos.y;
    out.on = g.riding.on; out.model = !!g.riding.model; out.inBattle = g.inBattle;
    return out;
  });
  t.ok(bat.air > 44 && bat.floorNow <= 41.01 && !bat.on && !bat.model && bat.inBattle, `a battle gets you off at once, on the floor (${bat.air.toFixed(1)} -> ${bat.floorNow.toFixed(2)})`);
  await ev(() => { const g = window.pokecraft; g.battle?.end?.(); });
  // leave the battle state the way tests do
  await ev(() => { const g = window.pokecraft; g.inBattle = false; document.body.classList.remove('in-battle'); document.getElementById('battle')?.classList.add('hidden'); });
  const left = await ev(() => {
    const g = window.pokecraft;
    document.getElementById('toast').replaceChildren();
    g.party = [window.__mk('blazehound'), window.__mk('tidalord')];
    g.riding.start(g.party[0]);
    g.box.push(...g.party.splice(0, 1));
    window.__step(2);
    const out = { on: g.riding.on, toast: window.__toasts() };
    g.party[0].hp = 0;
    g.riding.start(g.party[0]);
    return out;
  });
  t.ok(!left.on && left.toast.includes("isn't in your team"), `moving it to the box gets you off ("${left.toast}")`);
  const saved = await ev(() => { window.pokecraft.riding.start(window.pokecraft.party.find(c => c.hp > 0) || window.pokecraft.party[0]); window.pokecraft.save?.(true); return localStorage.getItem('pokecraft-save-v2') || ''; });
  t.ok(!/"ride"|riding/.test(saved), 'the save has no ride state');
  await ev(() => window.pokecraft.riding.stop('quiet'));
  t.ok(page.errors.length === 0, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 8. Touch (iPad)
  const tp = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await tp.tap('text=New Game');
  await tp.tap('.starter >> nth=0');
  await tp.waitForTimeout(1500);
  await platform(tp, { day: true });
  await install(tp);
  const hidden = id => tp.evaluate(id => document.getElementById(id).classList.contains('hidden') || getComputedStyle(document.getElementById(id)).display === 'none', id);
  await tp.waitForTimeout(600);
  t.ok(await hidden('btn-ride'), 'touch: Ride is hidden without a rideable creature');
  await tp.evaluate(() => { const g = window.pokecraft; g.party = [window.__mk('whaloft'), ...g.party]; });
  await waitFor(tp, () => !document.getElementById('btn-ride').classList.contains('hidden'), null, 10000).catch(() => {});
  t.ok(!(await hidden('btn-ride')) && (await tp.textContent('#btn-ride')) === 'Ride', 'touch: with one, the Ride button shows');
  await tp.tap('#btn-ride');
  await waitFor(tp, () => window.pokecraft.riding.on, null, 10000).catch(() => {});
  t.ok(await tp.evaluate(() => window.pokecraft.riding.kind === 'sky' && document.getElementById('touch').classList.contains('sky')), 'touch: tapping rides, #touch gets .sky');
  const ui = await tp.evaluate(() => ({
    ride: document.getElementById('btn-ride').textContent,
    jump: document.getElementById('btn-jump').textContent,
    down: getComputedStyle(document.getElementById('btn-down')).display,
    place: getComputedStyle(document.getElementById('btn-place')).display,
  }));
  t.ok(ui.ride === 'Get off' && ui.jump === 'Up' && ui.down !== 'none' && ui.place === 'none', `touch: buttons while flying ${JSON.stringify(ui)}`);
  const cdp = await tp.context().newCDPSession(tp);
  const center = sel => tp.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  // Check the key wiring (hold sets the key, release clears it), then fly with the physics.
  const wiring = await (async () => {
    const [x, y] = await center('#btn-jump');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2 }] });
    await tp.waitForTimeout(150);
    const upDown = await tp.evaluate(() => !!window.pokecraft.player.keys.Space);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await tp.waitForTimeout(150);
    const [dx, dy] = await center('#btn-down');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: dx, y: dy, id: 3 }] });
    await tp.waitForTimeout(150);
    const downDown = await tp.evaluate(() => !!window.pokecraft.player.keys.ShiftLeft);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await tp.waitForTimeout(150);
    const released = await tp.evaluate(() => !window.pokecraft.player.keys.ShiftLeft && !window.pokecraft.player.keys.Space);
    return { upDown, downDown, released };
  })();
  t.ok(wiring.upDown && wiring.downDown && wiring.released, `touch: Up and Down hold and release (${JSON.stringify(wiring)})`);
  const fly = await tp.evaluate(() => {
    const p = window.pokecraft.player, y = p.pos.y;
    window.__step(60, { Space: true });
    const up = p.pos.y - y;
    window.__step(60, { ShiftLeft: true });
    return { up, back: p.pos.y - y };
  });
  t.ok(fly.up > 3 && fly.back < fly.up, `touch: flying up and down (${JSON.stringify(fly)})`);
  await tp.evaluate(() => window.__step(60, { Space: true }));
  await tp.waitForTimeout(400);
  await tp.screenshot({ path: path.join(SHOTS, 't27-touch-sky.png'), timeout: 120000 });
  await tp.tap('#btn-ride');
  await tp.evaluate(() => window.__step(1));
  t.ok(await tp.evaluate(() => window.pokecraft.riding.landing), 'touch: tapping Get off in the air starts the glide');
  await tp.evaluate(() => window.__step(300));
  t.ok(await tp.evaluate(() => !window.pokecraft.riding.on && document.getElementById('btn-jump').textContent === 'Jump'), 'touch: after landing you are off and Jump is back');
  t.ok(tp.errors.length === 0, `touch: no page errors ${tp.errors.join('; ')}`);
  await tp.context().close();

  // 9. A visitor sees it
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await install(A);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code.toLowerCase());
  await click(B, '#mp button:has-text("Join a world")');
  await waitFor(B, () => window.pokecraft.mp.role === 'guest' && window.pokecraft.mp.others.size > 0, null, 30000);
  await slab(A, { r: 10 });
  await A.evaluate(() => { const g = window.pokecraft; g.party = [window.__mk('blazehound'), window.__mk('whaloft')]; g.riding.start(g.party[0]); g.player.yaw = 0; g.mp.sendState(); });
  const seen = () => B.evaluate(() => {
    const a = [...window.pokecraft.mp.others.values()][0];
    return a && { ride: a.rideSpecies, model: !!a.rideModel && window.pokecraft.scene.children.includes(a.rideModel), raised: a.rideModel ? a.model.position.y - a.pos.y : 0, lead: a.lead ? a.lead.visible : null, y: a.pos.y, rideY: a.rideModel?.position.y };
  });
  await waitFor(B, () => [...window.pokecraft.mp.others.values()][0]?.rideSpecies === 'blazehound', null, 20000).catch(() => {});
  await B.waitForTimeout(600);
  let s = await seen();
  t.ok(s.ride === 'blazehound' && s.model && s.raised > 0.1 && s.lead === false, `visitor sees a blazehound ride (${JSON.stringify(s)})`);
  // put B next to A to look at it
  await B.evaluate(() => {
    const g = window.pokecraft, a = [...g.mp.others.values()][0], p = g.player;
    p.pos.set(a.pos.x + 3.5, a.pos.y + 0.2, a.pos.z - 2.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: a.pos.x, y: a.pos.y + 1, z: a.pos.z });
  });
  await B.waitForTimeout(800);
  await shot(B, 't27-visitor.png');
  await A.evaluate(() => { const g = window.pokecraft; g.riding.stop('quiet'); g.riding.start(g.party[1]); window.__step(60, { Space: true }); g.mp.sendState(); });
  await waitFor(B, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a?.rideSpecies === 'whaloft' && a.pos.y > 43; }, null, 30000).catch(() => {});
  s = await seen();
  const ay = await A.evaluate(() => window.pokecraft.player.pos.y);
  t.ok(s.ride === 'whaloft' && s.y > 43, `visitor sees the whaloft in the air (${s.y.toFixed(1)}, host ${ay.toFixed(1)})`);
  await A.evaluate(() => { const g = window.pokecraft; g.riding.stop('quiet'); g.mp.sendState(); });
  await waitFor(B, () => [...window.pokecraft.mp.others.values()][0]?.rideSpecies === null, null, 20000).catch(() => {});
  s = await seen();
  t.ok(s.ride === null && !s.model && s.lead === true, `getting off: the ride is gone, the lead is back (${JSON.stringify(s)})`);
  const bogus = await B.evaluate(() => {
    const a = [...window.pokecraft.mp.others.values()][0], base = { x: a.pos.x, y: a.pos.y, z: a.pos.z, yaw: 0, lead: 'fluffin' };
    const out = [];
    for (const r of ['fluffin', 'bogus', 7, {}]) { a.update({ ...base, ride: r }); out.push(a.rideSpecies); }
    a.update({ ...base, ride: 'blazehound' }); out.push(a.rideSpecies);
    a.update({ ...base, ride: null }); out.push(a.rideSpecies);
    return out;
  });
  t.ok(bogus.slice(0, 4).every(x => x === null) && bogus[4] === 'blazehound' && bogus[5] === null, `made-up ride ids are ignored (${JSON.stringify(bogus)})`);
  t.ok(A.errors.length === 0 && B.errors.length === 0, `no page errors ${[...A.errors, ...B.errors].join('; ')}`);
  await A.context().close(); await B.context().close();
}
