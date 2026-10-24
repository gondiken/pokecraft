// T35: the Dream realm of floating islands: terrain data (links, bounce pads, sea pads, the arrival), moon gravity, Bounce
// Blocks (jump to launch, can't be broken), the Upside-Down House gym inside the realm (badge, rematch, save/load), Healer
// Stella, the moon on the HUD, a friendly morning, old Dream edits dropped, the main world unchanged and the guide on the way.
// Physics run by calling p.update(dt) in a loop inside the page, so they do not depend on the frame rate.
// Screenshots: tests/screenshots/t35-dream-*.png (arrival, giants, the house from below, inside, the moon HUD, iPad).
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, newGame, pause, playBattle, continueGame, waitFor, seedSave, startWeakBattle, platform } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

// A checksum of the main world; gym "live" blocks count as air (same as the realms spec).
const sum = () => {
  const d = window.pokecraft.world.data, live = new Set([57, 58, 59, 60, 61, 62, 63, 64, 73, 74, 48, 69, 9, 83, 84, 85, 92, 93, 89, 90, 95, 96, 97, 98, 99, 100, 101, 102, 124, 125]); // T38a: the Portal Door is drawn per player; also the blocks wave 11 gyms redraw per player (pot, checkpoint flags)
  // Gyms with live parts redraw ordinary blocks too (the course's timed blocks turn into air, the maze's exit door opens with
  // the badge): skip their whole boxes.
  const w = window.pokecraft.world, boxes = w.gyms.filter(g => g.def.live && g.protect?.length).map(g => g.protect[0]);
  const inCourse = i => { const x = i % w.W, z = Math.floor(i / w.W) % w.D; return boxes.some(c => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1); };
  let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + (live.has(d[i]) || inCourse(i) ? 0 : d[i])) | 0; return h;
};
const toasts = page => page.evaluate(() => { window.__toasts ||= []; const g = window.pokecraft; if (!g.ui.__wrapped) { const f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; g.ui.__wrapped = true; } });
const enter = async (page, time = 0.75) => {
  await page.evaluate(t => { window.pokecraft.time = t; }, time);
  await page.evaluate(() => window.pokecraft.realms.enter('dream'));
  await waitFor(page, () => window.pokecraft.place === 'dream' && !window.pokecraft.realms.busy);
  t.ok(await page.evaluate(async () => { const { swirlTint } = await import('/src/caves.js'); return swirlTint.uTintOn.value === 0 && !window.pokecraft.scene.children.some(o => o.userData.swirlSky) && window.pokecraft.swirlSky.info() === null; }), 'in the Dream the Swirl gradient is off and no Swirl sky mesh exists (T38d)'); // T38d
  await page.evaluate(() => { document.getElementById('pause').classList.add('hidden'); });
};
const leave = async page => {
  await page.evaluate(() => window.pokecraft.realms.leave('stone'));
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);
};

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 1); await pause(page);
  await toasts(page);

  // 1. Terrain data: the same for the same seed; links, pads, sea pads, arrival, the 192 fallback.
  const terrain = await page.evaluate(async () => {
    const R = await import('/src/realms.js'), { World } = await import('/src/world.js'), { B } = await import('/src/blocks.js');
    const { GYMS } = await import('/src/gyms.js');
    const out = { seeds: [] };
    const make = (seed, def = R.REALMS.dream) => { const w = new World(R.realmSeed(seed, def.seedSalt), null, null, def.size, def); w.generate(); return w; };
    const hash = w => { let x = 0; for (let i = 0; i < w.data.length; i++) x = (x * 31 + w.data[i]) | 0; return x; };
    for (const seed of [1, 4242, 99]) {
      const w = make(seed), I = w.isles, W = w.W, r = { seed, problems: [] };
      const bad = m => r.problems.push(m);
      r.same = JSON.stringify(make(seed).isles) === JSON.stringify(I);
      const byId = Object.fromEntries(I.list.map(i => [i.id, i]));
      const cells = id => { const i = byId[id], c = []; for (let x = 0; x < W; x++) for (let z = 0; z < w.D; z++) { const g = w.ground[x + z * W]; if (g > 0 && g >= i.top - 1 && Math.hypot(x - i.x, z - i.z) <= i.r + 2) c.push([x, z]); } return c; };
      // every link: gap 2-7 on the real cells, |top difference| <= 10, pads 3x3 with air above, the launch can reach the other island
      for (const [a, b, pa, pb] of I.links) {
        let gap = 1e9; const ca = cells(a), cb = cells(b);
        for (const [x, z] of ca) for (const [x2, z2] of cb) gap = Math.min(gap, Math.hypot(x - x2, z - z2));
        if (gap < 2 || gap > 7) bad(`${a}-${b} gap ${gap.toFixed(1)}`);
        if (Math.abs(byId[a].top - byId[b].top) > 10) bad(`${a}-${b} top difference`);
        for (const [pad, from, to] of [[pa, a, b], [pb, b, a]]) {
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            if (w.get(pad[0] + dx, pad[1], pad[2] + dz) !== B.BOUNCE) bad(`${from} pad ${dx},${dz} is not a Bounce Block`);
            for (let y = pad[1] + 1; y <= pad[1] + 16; y++) if (w.get(pad[0] + dx, y, pad[2] + dz) !== 0) { bad(`${from} pad has something at +${y - pad[1]}`); break; }
          }
          if (pad[1] + 1 + 14 < byId[to].top + 3) bad(`${from} -> ${to}: the launch does not reach the other island`);
        }
      }
      // every island reachable from home
      const seen = new Set(['home']), q = ['home'];
      while (q.length) { const x = q.shift(); for (const [a, b] of I.links) { const o = a === x ? b : b === x ? a : null; if (o && !seen.has(o)) { seen.add(o); q.push(o); } } }
      r.unreachable = I.list.filter(i => !seen.has(i.id)).map(i => i.id);
      // the gym's entrance pad: 9 Bounce Blocks with clear air up to the floor of the house
      const g = w.gyms[0], F = g.y - 1;
      r.gymPad = g.pad;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const [fx, fz] = g.front, cx = g.pad[0] + (fx ? dx : dz) * 0 + dx, cz = g.pad[2] + dz;
        if (w.get(cx, g.pad[1], cz) !== B.BOUNCE) bad(`entrance pad ${dx},${dz}`);
        for (let y = g.pad[1] + 1; y <= F; y++) if (w.get(cx, y, cz) !== 0) { bad(`entrance column ${dx},${dz} blocked at ${y}`); break; }
      }
      // sea pads next to every low island, and every sea cell near an island is close to one
      for (const i of I.list.filter(i => i.top <= 13)) {
        const near = I.seaPads.filter(([x, , z]) => Math.hypot(x - i.x, z - i.z) <= i.r + 8);
        if (!near.length) bad(`no sea pad near ${i.id}`);
      }
      for (const [x, y, z] of I.seaPads) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (w.get(x + dx, 0, z + dz) !== B.BOUNCE) bad('sea pad block');
      let worst = 0;
      for (let x = 0; x < W; x += 4) for (let z = 0; z < w.D; z += 4) {
        if (w.ground[x + z * W] !== 0 || !I.list.some(i => Math.hypot(x - i.x, z - i.z) < i.r + 20)) continue;
        let m = 1e9; for (const [px, , pz] of I.seaPads) m = Math.min(m, Math.hypot(x - px, z - pz));
        worst = Math.max(worst, m);
      }
      r.worstSea = Math.round(worst);
      const s = w.surface(128, 128);
      r.arrive = w.get(128, s.y, 128) === B.DREAM_GRASS && w.get(128, s.y + 1, 128) === 0 && w.get(128, s.y + 2, 128) === 0;
      r.sea = w.get(5, 0, 5) === B.CLOUD && w.get(5, 1, 5) === 0 && w.ground[5 + 5 * W] === 0;
      r.wake = w.get(...w.wake) === B.WAKE_STONE;
      r.hash = hash(w);
      out.seeds.push(r);
    }
    // the smaller 192 map: the outer islands drop out, the core stays
    const small = { ...R.REALMS.dream, size: [192, 192], arrive: [96, 96] };
    const w2 = make(4242, small);
    out.small = { ids: w2.isles.list.map(i => i.id), inside: w2.isles.list.every(i => i.x - i.r > 1 && i.z - i.r > 1 && i.x + i.r < 191 && i.z + i.r < 191), links: w2.isles.links.length, gym: w2.gyms.length };
    out.big = make(4242).isles.list.map(i => i.id);
    out.differ = out.seeds[0].hash !== out.seeds[1].hash;
    out.gymsDef = GYMS.filter(d => d.realm).map(d => d.id);
    return out;
  });
  for (const r of terrain.seeds) {
    t.ok(r.same && !r.problems.length && !r.unreachable.length, `seed ${r.seed}: same islands for the same seed; every link 2-7 apart with 3x3 clear pads; all islands reachable ${r.problems.slice(0, 4).join('; ')} ${r.unreachable}`);
    t.ok(r.arrive && r.sea && r.wake && r.worstSea <= 60, `seed ${r.seed}: Dream Grass at the arrival, a cloud sea, the Wake Stone, sea pads (worst sea walk ${r.worstSea})`);
  }
  t.ok(terrain.differ && terrain.gymsDef.join() === 'dream', 'another seed gives another Dream (the layout table is the same); the dream gym is a realm gym');
  t.ok(terrain.small.gym === 1 && terrain.small.inside && !terrain.small.ids.includes('outerE') && terrain.small.links < 14 && terrain.big.includes('outerE'), `the 192 fallback map keeps the core islands and drops the outer ones (${terrain.small.ids.length} of ${terrain.big.length})`);

  // 2. Gravity: 1 in the main world, 0.5 in the dream; a jump peaks at ~1.3 / ~2.6 blocks.
  await platform(page, { day: true });
  const jump = () => {
    const g = window.pokecraft, p = g.player; p.keys = {};
    for (let i = 0; i < 10; i++) p.update(0.02);
    const y0 = p.pos.y; let top = y0;
    p.keys = { Space: true };
    for (let i = 0; i < 100; i++) { p.update(0.02); top = Math.max(top, p.pos.y); if (i > 3) p.keys = {}; }
    p.keys = {};
    return { g: g.world.gravity, up: top - y0 };
  };
  const mainJump = await page.evaluate(jump);
  // How far the clock moves per second of (clamped) game time: the night speed.
  const clockStep = () => new Promise(done => {
    // Per second of game time (each frame's dt is clamped to 0.05 s like main.js frame()), so a change of frame rate between
    // the two measurements doesn't skew the ratio.
    const g = window.pokecraft; let n = 0, t0 = null, prev = null, secs = 0;
    const tick = now => {
      if (prev == null) { prev = now; t0 = g.time; } else secs += Math.min(0.05, (now - prev) / 1000), prev = now;
      if (++n < 9) requestAnimationFrame(tick); else done({ per: ((g.time - t0 + 1) % 1) / secs, frames: n });
    };
    requestAnimationFrame(tick);
  });
  const mainClock = await page.evaluate(clockStep);
  t.ok(mainJump.g === 1 && Math.abs(mainJump.up - 1.32) < 0.15, `main world: gravity 1, a jump goes ${mainJump.up.toFixed(2)} blocks high`);
  const before = await page.evaluate(sum);
  await enter(page);
  await page.evaluate(() => { const g = window.pokecraft; g.player.pos.set(130.5, g.world.surface(130, 125).y + 1, 125.5); g.player.vel.set(0, 0, 0); });
  const dreamJump = await page.evaluate(jump);
  const dreamClock = await page.evaluate(clockStep);
  const speed = await page.evaluate(() => window.pokecraft.world.realm.timeSpeed);
  t.ok(speed === 0.5 && dreamClock.per / mainClock.per > 0.3 && dreamClock.per / mainClock.per < 0.7, `the dream clock runs at half speed, so the night lasts twice as long (${(dreamClock.per / mainClock.per).toFixed(2)})`);
  t.ok(dreamJump.g === 0.5 && Math.abs(dreamJump.up - 2.64) < 0.25, `the dream: gravity 0.5, a jump goes ${dreamJump.up.toFixed(2)} blocks high (moon jumps)`);
  const there = await page.evaluate(() => { const g = window.pokecraft, w = g.world; return { size: [w.W, w.D], npcs: g.npcs.list.map(n => n.name).sort(), light: w.litCol[200 + 200 * w.W], gyms: w.gyms.length, enterToasts: window.__toasts.filter(m => /light here|fall asleep/.test(m)) }; });
  t.ok(there.size.join() === '256,256' && there.npcs.join() === 'Healer Stella,Juggler Bo,Leader Wimsy,Painter Pia' && there.light === 1 && there.gyms === 1,
    `in the dream: 256x256, the gym's 3 people and Healer Stella, no darkness under the islands (${there.npcs})`);
  t.ok(there.enterToasts.length === 2, `entering says where to go (${there.enterToasts.join(' | ')})`);

  // screenshots: the arrival and the giants
  const shot = async (name, pos, yaw, pitch) => {
    await page.evaluate(([pos, yaw, pitch]) => { const g = window.pokecraft; g.player.pos.set(...pos); g.player.vel.set(0, 0, 0); g.player.yaw = yaw; g.player.pitch = pitch; g.time = 0.75; document.getElementById('toast').replaceChildren(); }, [pos, yaw, pitch]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS, name) });
  };
  const I = await page.evaluate(() => window.pokecraft.world.isles);
  const home = I.list.find(i => i.id === 'home'), meadow = I.list.find(i => i.id === 'meadow');
  await shot('t35-dream-arrival.png', [128.5, 21, 128.5], -Math.PI / 2, -0.15);
  await shot('t35-dream-meadow.png', [meadow.x - 22, meadow.top + 8, meadow.z + 2], -Math.PI * 1.5, -0.2);

  // 3. Bounce Blocks: standing on a pad does nothing; Space launches; steering lands you inside the house; pads can't be broken.
  const g0 = await page.evaluate(() => { const g = window.pokecraft.world.gyms[0]; return { pad: g.pad, front: g.front, F: g.y - 1, area: g.area }; });
  await page.evaluate(async () => { const { sound } = await import('/src/sound.js'); const f = sound.play.bind(sound); window.__played = []; sound.play = n => { window.__played.push(n); return f(n); }; });
  const bounce = await page.evaluate(g0 => {
    const g = window.pokecraft, p = g.player, [px, py, pz] = g0.pad, [fx, fz] = g0.front;
    p.pos.set(px + 0.5 - fx * 0.0, py + 1, pz + 0.5); p.vel.set(0, 0, 0); p.yaw = Math.atan2(-fx, -fz); p.keys = {};
    for (let i = 0; i < 10; i++) p.update(0.02);
    const idle = { y: p.pos.y, onBounce: p.onBounce, bounced: p.bounced };
    p.keys = { Space: true };
    p.update(0.05); p.keys = {};
    const launched = { vy: p.vel.y, bounced: p.bounced };
    p.bounced = false;
    let top = p.pos.y, steered = false;
    for (let i = 0; i < 400 && !(p.onGround && i > 5); i++) {
      if (p.pos.y >= g0.F + 1.2 && !steered) { p.keys = { KeyW: true }; steered = true; }
      p.update(0.02); top = Math.max(top, p.pos.y);
    }
    p.keys = {};
    const inside = p.pos.x >= g0.area.x0 && p.pos.x < g0.area.x1 + 1 && p.pos.z >= g0.area.z0 && p.pos.z < g0.area.z1 + 1;
    return { idle, launched, top, y: p.pos.y, inside, onGround: p.onGround };
  }, g0);
  t.ok(bounce.idle.onBounce && !bounce.idle.bounced && Math.abs(bounce.idle.y - (g0.pad[1] + 1)) < 0.01, 'standing on a Bounce Block without jumping does nothing');
  t.ok(bounce.launched.bounced && bounce.launched.vy > 18 && bounce.top >= g0.F + 2, `Space on the pad launches you (up to feet ${bounce.top.toFixed(1)}, the house floor is ${g0.F + 1})`);
  t.ok(bounce.inside && bounce.onGround && Math.abs(bounce.y - (g0.F + 1)) < 0.05, `steering while you fly lands you on the house floor inside it (feet ${bounce.y.toFixed(2)})`);
  await page.evaluate(() => { window.pokecraft.player.bounced = true; }); // the game loop plays boing and says the steering hint for a launch it sees
  await waitFor(page, () => window.__played.includes('boing') && window.__toasts.some(m => /Steer while you fly/.test(m)));
  t.ok(true, 'the game plays boing and tells you to steer while you fly');
  const wall = await page.evaluate(async g0 => {
    const g = window.pokecraft, w = g.world, { B } = await import('/src/blocks.js'), [px, py, pz] = g0.pad;
    window.__toasts = [];
    g.breakBlock({ x: px, y: py, z: pz, id: B.BOUNCE });
    const kept = w.get(px, py, pz) === B.BOUNCE;
    w.applyEdits([[w.index(px + 1, py, pz), B.AIR]]);
    return { kept, edit: w.get(px + 1, py, pz) === B.BOUNCE && w.edits.size === 0, toast: window.__toasts.at(-1), allowed: w.editAllowed(px, py, pz, B.AIR) };
  }, g0);
  t.ok(wall.kept && wall.edit && !wall.allowed && /too springy/.test(wall.toast), `a Bounce Block can't be broken and a saved edit on it is dropped ("${wall.toast}")`);

  // 11. The guide on the way (before the gym): pad on the home island, sea, under the house, inside.
  const guide = await page.evaluate(async I => {
    const g = window.pokecraft, out = {};
    const at = (x, y, z) => { g.player.pos.set(x, y, z); g.player.vel.set(0, 0, 0); g.updateGuide(); return document.getElementById('guide').textContent; };
    const home = I.list.find(i => i.id === 'home'), gx = g.world.gyms[0];
    out.home = at(home.x + 0.5, g.world.surface(home.x, home.z).y + 1, home.z + 0.5);
    out.sea = at(60.5, 1, 60.5);
    out.under = at(gx.pad[0] + 0.5, gx.pad[1] + 1, gx.pad[2] + 4.5);
    window.__toasts = [];
    out.inside = at(gx.x + 0.5 - gx.front[0] * 2, gx.y, gx.z + 0.5 - gx.front[1] * 2);
    out.welcome = window.__toasts.slice();
    return out;
  }, I);
  t.ok(/bounce to the next island/.test(guide.home), `on the home island the arrow leads to a pad ("${guide.home}")`);
  t.ok(/Bounce back up/.test(guide.sea), `on the cloud sea it says to find a bounce block ("${guide.sea}")`);
  t.ok(/right above you/.test(guide.under) && /is here/.test(guide.inside) && guide.welcome.some(m => /Welcome to the Upside-Down House/.test(m)), `under the house "${guide.under}", inside "${guide.inside}" and the welcome toast`);
  await shot('t35-dream-house-below.png', [g0.pad[0] + 0.5 - g0.front[0] * 11, 13, g0.pad[2] + 0.5 - g0.front[1] * 11], Math.atan2(g0.front[0], g0.front[1]), 0.6);
  await shot('t35-dream-house-inside.png', [g0.pad[0] + 0.5 + g0.front[0] * 2, g0.F + 1, g0.pad[2] + 0.5 + g0.front[1] * 2], Math.atan2(g0.front[0], g0.front[1]), 0.0);
  await shot('t35-dream-house-ceiling.png', [g0.pad[0] + 0.5 + g0.front[0] * 2, g0.F + 1, g0.pad[2] + 0.5 + g0.front[1] * 2 + 3], Math.atan2(g0.front[0], g0.front[1]) + 1.3, 0.35);

  // 7. The moon: ~0 at the start of the night, ~0.5 in the middle, hidden in the main world; the clock says "Dream".
  const moon = {};
  for (const [name, tm] of [['start', 0.5 + 0.0085 + 0.01], ['mid', 0.75], ['late', 0.97]]) {
    await page.evaluate(tm => { window.pokecraft.time = tm; }, tm);
    await page.waitForTimeout(1200);
    moon[name] = await page.evaluate(() => ({ p: window.pokecraft.ui.moonShown, clock: document.getElementById('clock').textContent, hidden: document.getElementById('moon').classList.contains('hidden') }));
  }
  t.ok(moon.start.p < 0.1 && Math.abs(moon.mid.p - 0.5) < 0.1 && moon.late.p > 0.85 && !moon.mid.hidden && moon.mid.clock === '☾ Dream', `the moon sets during the night (${moon.start.p} -> ${moon.mid.p} -> ${moon.late.p}), the clock says "${moon.mid.clock}"`);
  await page.evaluate(() => { window.pokecraft.time = 0.78; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, 't35-dream-moon.png'), clip: { x: 800, y: 0, width: 300, height: 220 } });

  // 4-6. The gym: Healer Stella, the leader refuses, a lost battle keeps the beaten trainer, both trainers, the leader, the badge.
  await page.evaluate(async g0 => {
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('tidalord', 90), makeCreature('thunderwolf', 90), makeCreature('grovebeast', 90)];
    g.player.pos.set(g0.pad[0] + 0.5 + g0.front[0] * 4, g0.F + 1, g0.pad[2] + 0.5); g.player.vel.set(0, 0, 0);
    document.exitPointerLock();
  }, g0);
  const npc = (name) => `window.pokecraft.npcs.list.find(n => n.name === '${name}')`;
  await page.evaluate(() => { window.__toasts = []; const g = window.pokecraft; g.party[0].hp = 1; });
  await page.evaluate(`window.pokecraft.talkTo(${npc('Healer Stella')})`);
  const healed = await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); return { full: g.party.every(c => c.hp === S.statsFor(c).maxHp), toast: window.__toasts.at(-1) }; });
  t.ok(healed.full && /Healer Stella: Your team is fully healed\. Sweet dreams/.test(healed.toast), `Healer Stella heals the team ("${healed.toast}")`);
  await page.evaluate(`window.pokecraft.talkTo(${npc('Leader Wimsy')})`);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)) && (await page.evaluate(() => window.__toasts.at(-1))).includes('Beat Juggler Bo and Painter Pia first'), 'the leader asks you to beat both trainers first');
  await page.evaluate(`window.pokecraft.talkTo(${npc('Juggler Bo')})`);
  t.ok(await playBattle(page), 'Juggler Bo battle finishes');
  // a real loss: a tiny team against Painter Pia wakes you up in the main world, the other trainer stays beaten
  await page.evaluate(async () => { const g = window.pokecraft, { makeCreature } = await import('/src/species.js'); window.__strong = g.party; g.party = [makeCreature('zapple', 1)]; });
  await page.evaluate(`window.pokecraft.talkTo(${npc('Painter Pia')})`);
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'Painter Pia battles');
  t.ok(await playBattle(page), 'the tiny team loses');
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);
  t.ok(await page.evaluate(() => window.pokecraft.beaten.includes('dream:trainer') && !window.pokecraft.beaten.includes('dream:trainer2')), 'losing to a trainer wakes you up and keeps the other trainer beaten');
  await enter(page);
  await page.evaluate(async g0 => { const g = window.pokecraft; g.party = window.__strong; g.player.pos.set(g0.pad[0] + 0.5 + g0.front[0] * 4, g0.F + 1, g0.pad[2] + 0.5); g.player.vel.set(0, 0, 0); document.exitPointerLock(); }, g0);
  await page.evaluate(`window.pokecraft.talkTo(${npc('Painter Pia')})`);
  t.ok(await playBattle(page), 'Painter Pia battle finishes');
  await page.evaluate(`window.pokecraft.talkTo(${npc('Leader Wimsy')})`);
  const leaderTeam = await page.evaluate(async () => { const G = await import('/src/gyms.js'); const g = window.pokecraft; return JSON.stringify(g.battle.foes.map(c => [c.species, c.level])) === JSON.stringify(G.GYMS.find(d => d.id === 'dream').leaderTeam.map(([s, l]) => [s, l])); });
  t.ok(leaderTeam, "the leader's own team (Bobblimp, Scrawlbert, Drizzup, Topsyturvy)");
  t.ok(await playBattle(page), 'Leader Wimsy battle finishes');
  const won = await page.evaluate(() => ({ badges: window.pokecraft.badges, beaten: window.pokecraft.beaten, toasts: window.__toasts.slice(-8) }));
  t.ok(won.badges.includes('dream') && won.beaten.includes('dream:trainer') && won.beaten.includes('dream:trainer2') && won.toasts.some(m => /Wonder Badge/.test(m)), 'the Wonder Badge is awarded');

  // reload in the dream: badge and keys kept; the leader now offers a rematch
  await page.evaluate(() => window.pokecraft.save(true));
  await page.reload();
  await page.waitForFunction(() => window.pokecraft?.world);
  await continueGame(page);
  await toasts(page);
  const re = await page.evaluate(async () => {
    const g = window.pokecraft;
    const n = g.npcs.list.find(x => x.name === 'Leader Wimsy');
    g.player.pos.set(g.world.gyms[0].x + 0.5, g.world.gyms[0].y, g.world.gyms[0].z + 0.5); document.exitPointerLock();
    g.talkTo(n);
    return { place: g.place, badges: g.badges.includes('dream'), beaten: g.beaten.filter(k => k.startsWith('dream')), asking: g.ui.asking, text: document.getElementById('ask-text').textContent };
  });
  t.ok(re.place === 'dream' && re.badges && re.beaten.length === 2 && re.asking && /rematch/i.test(re.text), `after a reload: still in the dream with the badge and both trainers beaten; the leader offers a rematch ("${re.text}")`);
  await page.evaluate(() => window.pokecraft.ui.closeAsk());

  // 8. The morning never wakes you in a battle; after it you wake up and the toast is the plain one (badge held).
  await page.evaluate(() => { window.pokecraft.time = 0.75; window.__toasts = []; });
  await page.evaluate(() => { const g = window.pokecraft; g.player.pos.set(130.5, g.world.surface(130, 125).y + 1, 125.5); g.player.vel.set(0, 0, 0); });
  await startWeakBattle(page, { species: 'zapple', level: 30 });
  await page.evaluate(() => { window.pokecraft.time = 0.1; });
  await page.waitForTimeout(3500);
  t.ok(await page.evaluate(() => window.pokecraft.place === 'dream' && window.pokecraft.inBattle), 'morning comes in the middle of a battle: you are still in the dream and in the battle');
  t.ok(await playBattle(page), 'the battle ends');
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy, null, 60000);
  const morning = await page.evaluate(() => window.__toasts.filter(m => /Good morning/.test(m)));
  t.ok(morning.length === 1 && /You woke up in your bed/.test(morning[0]), `after the battle the morning wakes you up ("${morning[0]}")`);
  t.ok(await page.evaluate(() => window.pokecraft.ui.moonShown === null && document.getElementById('moon').classList.contains('hidden')), 'the moon is hidden in the main world');

  // 10. The main world: same blocks, the stand-in gym, no Dream spot, the guide says "in a dream", the Tower needs the badge.
  const main = await page.evaluate(async () => {
    const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
    const stub = g.world.gyms.find(x => x.def.id === 'dream');
    const spots = g.world.newGymSpots();
    g.badges = GYMS.filter(d => d.id !== 'dream').map(d => d.id);
    const text = tm => { g.time = tm; g.night = tm > 0.5; g.updateGuide(); return document.getElementById('guide').textContent; };
    const guideNight = text(0.75), guideDay = text(0.25);
    window.__toasts = [];
    const guard = g.npcs.list.find(n => n.role === 'guard1');
    g.talkTo(guard);
    return { n: g.world.gyms.length, all: GYMS.length, stub: !!stub && stub.x === null && stub.elsewhere === 'dream' && !stub.protect.length, noSpot: !spots.some(s => s.def?.id === 'dream' || s.id === 'dream'),
      guideNight, guideDay, battle: g.inBattle, toast: window.__toasts.at(-1) };
  });
  t.ok(main.n === main.all && main.stub && main.noSpot, `the main world has the stand-in gym (${main.n} gyms) and no spot for it`);
  t.ok(/in a dream/.test(main.guideNight) && /opens when you dream at night/.test(main.guideDay), `main-world guide: "${main.guideNight}" / "${main.guideDay}"`);
  t.ok(!main.battle && /Only trainers with all \d+ badges/.test(main.toast), `a Tower guard refuses with every badge but the Wonder Badge ("${main.toast}")`);
  await page.evaluate(() => { window.pokecraft.time = 0.25; }); // the clock tower's live parts follow the time: back to the time `before` was measured at
  await page.waitForTimeout(3000);
  t.ok(await page.evaluate(sum) === before, 'the main world is block for block the same as before the dream (after a reload in the dream too)');
  t.ok(page.errors.length === 0, `no page errors (${page.errors.slice(0, 3).join(' | ')})`);
  await page.context().close();

  // 9. Old Dream edits (the 64 x 64 island of T31) are dropped once, the player arrives at the start; the next save says version 2.
  const old = { seed: 4242, edits: [], size: [288, 288], pos: [112.5, 30, 112.5], yaw: 0, pitch: 0, time: 0.75, party: [], box: [], cubes: 10, badges: [], beaten: [], savedAt: 1,
    place: 'dream', realmPos: [32.5, 23, 32.5, 0, 0], realmEdits: { dream: [[5, 3]] } };
  const P2 = await openGame(browser, base, { setup: seedSave(old) });
  await continueGame(P2);
  const o = await P2.evaluate(() => { const g = window.pokecraft, p = g.player.pos; g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { place: g.place, edits: g.world.edits.size, d: Math.hypot(p.x - 128.5, p.z - 128.5), v: s.realmVersions, re: JSON.stringify(s.realmEdits) }; });
  t.ok(o.place === 'dream' && o.edits === 0 && o.d < 2 && o.v?.dream === 2 && o.re === '{"dream":[]}', `an old save from the 64 x 64 dream loads in the new dream at the start, its edits dropped (${JSON.stringify(o)})`);
  t.ok(P2.errors.length === 0, `no page errors (${P2.errors.slice(0, 3).join(' | ')})`);
  await P2.context().close();

  // 12. iPad: the Jump button launches from a Bounce Block; screenshots.
  const ipad = await openGame(browser, base, { contextOptions: { ...devices['iPad (gen 7) landscape'] } });
  await ipad.tap('text=New Game');
  await ipad.tap('.starter >> nth=0');
  await waitFor(ipad, () => window.pokecraft.started, null, 30000);
  await ipad.waitForTimeout(1000);
  await ipad.evaluate(() => { window.pokecraft.time = 0.75; });
  await ipad.evaluate(() => window.pokecraft.realms.enter('dream'));
  await waitFor(ipad, () => window.pokecraft.place === 'dream' && !window.pokecraft.realms.busy);
  await ipad.evaluate(g0 => { const g = window.pokecraft, [px, py, pz] = g.world.gyms[0].pad; g.player.pos.set(px + 0.5, py + 1, pz + 0.5); g.player.vel.set(0, 0, 0); document.getElementById('toast').replaceChildren(); }, g0);
  await ipad.waitForTimeout(1500);
  const y0 = await ipad.evaluate(() => window.pokecraft.player.pos.y);
  const cdp = await ipad.context().newCDPSession(ipad);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const jb = await ipad.evaluate(() => { const r = document.getElementById('btn-jump').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await touch('touchStart', [[jb[0], jb[1], 4]]);
  await waitFor(ipad, y => window.pokecraft.player.pos.y > y + 3, y0, 90000);
  await touch('touchEnd', []);
  t.ok(true, 'iPad: the Jump button launches you from a Bounce Block');
  await ipad.evaluate(() => { document.getElementById('toast').replaceChildren(); });
  await ipad.screenshot({ path: path.join(SHOTS, 't35-dream-ipad.png') });
  t.ok(ipad.errors.length === 0, `no page errors (${ipad.errors.slice(0, 3).join(' | ')})`);
  await ipad.context().close();
}
