// T10 access and UI: the Saucer Gym only has its people at night, the Cloud Gym's hints, the four new gyms'
// battles, the 22-badge HUD (desktop and iPad) and the badge count for the tower.
// (Placement and the Cloud Gym's geometry are checked in new-gyms.mjs.)
import fs from 'node:fs';
import { devices } from 'playwright';
import { openGame, newGame, playBattle } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;

// Sets the clock and waits for the game loop to notice (it is slow under software rendering).
async function setTime(page, time, night) {
  await page.evaluate(tm => { window.pokecraft.time = tm; }, time);
  await page.waitForFunction(n => window.pokecraft.night === n, night, { timeout: 60000, polling: 300 });
}

// Remembers every toast that appears (they vanish after 3 seconds).
const recordToasts = page => page.evaluate(() => {
  window.__toasts = [];
  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) window.__toasts.push(n.textContent);
  }).observe(document.getElementById('toast'), { childList: true });
});
const toasts = page => page.evaluate(() => window.__toasts.join(' | '));
const clearToasts = page => page.evaluate(() => { window.__toasts.length = 0; });

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 1);
  await recordToasts(page);
  await page.evaluate(() => { const g = window.pokecraft; g.creatures.clear(); document.exitPointerLock(); });
  t.ok(await page.evaluate(() => window.pokecraft.world.gyms.length === 22), '22 gyms are placed');
  t.ok(await page.evaluate(async () => {
    const { GYMS } = await import('/src/gyms.js');
    return GYMS.find(g => g.id === 'alien').night === true && GYMS.slice(18).map(g => g.id).join() === 'light,paper,slime,sky';
  }), 'the Saucer Gym is a night gym; gyms 19-22 are light, paper, slime, sky');

  const stand = (id, d = 4.5) => page.evaluate(async ([gid, dist]) => {
    const g = window.pokecraft;
    const { makeCreature } = await import('/src/species.js');
    g.party = ['titanox', 'spectrion', 'stormwyvern'].map(s => makeCreature(s, 60));
    const gym = g.world.gyms.find(x => x.def.id === gid), [fx, fz] = gym.front;
    g.player.pos.set(gym.x + 0.5 + fx * dist, gym.y, gym.z + 0.5 + fz * dist);
    g.player.vel.set(0, 0, 0);
    document.exitPointerLock();
  }, [id, d]);
  const who = (kind, id) => `window.pokecraft.npcs.list.find(n => n.kind === '${kind}' && n.gym.def.id === '${id}')`;

  // 1. By day the Saucer people are gone, talking says when night comes, and the arrow skips ahead.
  await setTime(page, 0.25, false);
  await stand('alien');
  t.ok(await page.evaluate(`${who('leader', 'alien')}.model.visible === false && ${who('trainer', 'alien')}.model.visible === false`), 'the Saucer Gym people are hidden by day');
  t.ok(await page.evaluate(`window.pokecraft.npcs.list.filter(n => n.gym && !n.gym.def.night).every(n => n.model.visible)`), "other gyms' people are not hidden");
  await clearToasts(page);
  await page.evaluate(`window.pokecraft.talkTo(${who('trainer', 'alien')})`);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), 'the Saucer trainer does not battle by day');
  let msg = await toasts(page);
  t.ok(msg.includes('at night') && /about \d+ minute/.test(msg), `the toast says when night comes (${msg})`);
  const arrowDay = await page.evaluate(async () => {
    const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
    g.badges = GYMS.filter(x => x.id !== 'alien').map(x => x.id);
    g.updateGuide();
    return document.getElementById('guide').textContent;
  });
  t.ok(arrowDay.includes('opens at night') && arrowDay.includes('Sunbeam Gym'), `the arrow skips to the next gym and mentions the Saucer Gym (${arrowDay})`);
  await page.evaluate(() => { window.pokecraft.badges = []; });

  // Same camera, noon and midnight.
  await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'alien'), [fx, fz] = gym.front;
    const px = gym.x + fx * 22, pz = gym.z + fz * 22, y = gym.y + 6;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.world.set(px + x, y, pz + z, 3);
    g.player.pos.set(px + 0.5, y + 1, pz + 0.5);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: gym.x + 0.5, y: gym.y + 8, z: gym.z + 0.5 });
  });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: SHOTS + 'gym-alien-day.png' });

  // 2. At night they are back, the saucer hovers, and the gym works.
  await setTime(page, 0.75, true);
  await page.evaluate(() => { for (const s of window.pokecraft.npcs.saucers) s.rise = 0; });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: SHOTS + 'gym-alien-night.png' });
  t.ok(await page.evaluate(`${who('leader', 'alien')}.model.visible && ${who('trainer', 'alien')}.model.visible`), 'the Saucer Gym people are there at night');
  t.ok(await page.evaluate(() => window.pokecraft.npcs.saucers.length === 1 && window.pokecraft.npcs.saucers[0].group.visible), 'the flying saucer is out at night');
  await stand('alien');
  await page.evaluate(`window.pokecraft.talkTo(${who('leader', 'alien')})`);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), 'the Saucer leader refuses until the trainer is beaten');
  await page.evaluate(`window.pokecraft.talkTo(${who('trainer', 'alien')})`);
  t.ok(await playBattle(page), 'Saucer trainer battle finishes');
  await page.evaluate(`window.pokecraft.talkTo(${who('leader', 'alien')})`);
  t.ok(await playBattle(page), 'Saucer leader battle finishes');
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('alien')), 'Saucer Badge awarded at night');
  await setTime(page, 0.25, false);
  t.ok(await page.evaluate(`!${who('leader', 'alien')}.model.visible`), 'the people go away again at dawn');

  // 3. The four new gyms: trainer, then leader, badge.
  for (const [id, badge] of [['light', 'Sunbeam'], ['paper', 'Origami'], ['slime', 'Goo'], ['sky', 'Cloud']]) {
    if (id === 'sky') {
      // Pretend the other 21 are done so the Cloud Gym is the 22nd badge.
      await page.evaluate(async () => {
        const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
        g.badges = GYMS.filter(x => x.id !== 'sky').map(x => x.id);
      });
      await clearToasts(page);
    }
    await stand(id);
    t.ok(await page.evaluate(`!!${who('leader', id)} && !!${who('trainer', id)}`), `${badge} Gym has a trainer and a leader`);
    await page.evaluate(`window.pokecraft.talkTo(${who('leader', id)})`);
    t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), `${badge} leader refuses until the trainer is beaten`);
    await page.evaluate(`window.pokecraft.talkTo(${who('trainer', id)})`);
    t.ok(await playBattle(page), `${badge} trainer battle finishes`);
    await page.evaluate(`window.pokecraft.talkTo(${who('leader', id)})`);
    t.ok(await playBattle(page), `${badge} leader battle finishes`);
    t.ok(await page.evaluate(gid => window.pokecraft.badges.includes(gid), id), `${badge} Badge awarded`);
  }
  msg = await toasts(page);
  t.ok(await page.evaluate(() => window.pokecraft.badges.length === 22) && msg.includes('(22/22)') && msg.includes('Tower is open'),
    `the 22nd badge says the Champion's Tower is open`);

  // 4. Cloud Gym hints.
  await clearToasts(page);
  const hints = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world;
    const gym = w.gyms.find(x => x.def.id === 'sky'), [fx, fz] = gym.front;
    g.badges = (await import('/src/gyms.js')).GYMS.filter(x => x.id !== 'sky').map(x => x.id);
    const out = {};
    const onGround = (x, z) => g.player.pos.set(x + 0.5, w.surface(Math.round(x), Math.round(z)).y + 1, z + 0.5);
    // Far away.
    onGround(gym.x - fx * 40, gym.z - fz * 40);
    g.updateGuide();
    out.far = document.getElementById('guide').textContent;
    // On the ground under the island, away from the pad.
    onGround(gym.x - fx * 4, gym.z - fz * 4);
    g.updateGuide();
    out.under = document.getElementById('guide').textContent;
    out.target = g.guideTarget; out.pad = gym.pad;
    out.toasts = window.__toasts.join(' | ');
    window.__toasts.length = 0;
    // On the pad.
    g.player.pos.set(gym.pad[0] + 0.5, gym.pad[1] + 1, gym.pad[2] + 0.5);
    g.updateGuide();
    out.padToasts = window.__toasts.join(' | ');
    // On the island.
    g.player.pos.set(gym.x + 0.5, gym.y, gym.z + 0.5);
    g.updateGuide();
    out.here = document.getElementById('guide').textContent;
    return out;
  });
  t.ok(hints.far.includes('Cloud Gym') && hints.far.includes('up in the sky'), `from far away the arrow says it is up in the sky (${hints.far})`);
  t.ok(hints.under.includes('right above you'), `under the Cloud Gym the arrow says so (${hints.under})`);
  t.ok(hints.toasts.includes('Build a tower of blocks'), `a toast says to build a tower (${hints.toasts})`);
  t.ok(hints.target[0] === hints.pad[0] + 0.5 && hints.target[1] === hints.pad[2] + 0.5, 'the arrow aims at the pad');
  t.ok(hints.padToasts.includes('place a block under you'), `on the pad a tip says how to climb (${hints.padToasts})`);
  t.ok(hints.here.includes('Cloud Gym is here'), `on the island: ${hints.here}`);

  // The island and pad from the ground, noon.
  await page.evaluate(() => {
    const g = window.pokecraft, w = g.world, gym = w.gyms.find(x => x.def.id === 'sky'), [fx, fz] = gym.front;
    const x = Math.round(gym.x + fx * 30), z = Math.round(gym.z + fz * 30);
    g.player.pos.set(x + 0.5, w.surface(x, z).y + 1, z + 0.5);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: gym.x + 0.5, y: gym.y + 2, z: gym.z + 0.5 });
  });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: SHOTS + 'gym-sky-ground.png' });

  // 5. The badge HUD with 22 diamonds, on desktop.
  await page.evaluate(async () => {
    const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
    g.badges = GYMS.map(x => x.id);
    g.ui.renderHud();
  });
  await page.waitForTimeout(1500);
  const desk = await page.evaluate(() => {
    const r = document.getElementById('badges').getBoundingClientRect();
    return { n: document.querySelectorAll('#badges > *').length, got: document.querySelectorAll('#badges > .got').length, h: r.height, w: r.width, right: r.right, vw: innerWidth };
  });
  t.ok(desk.n === 22 && desk.got === 22 && desk.h <= 90 && desk.right <= desk.vw, `desktop: 22 badge slots in a box ${Math.round(desk.w)}x${Math.round(desk.h)}`);
  await page.screenshot({ path: SHOTS + 'badges-22-desktop.png' });
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 6. The same on an iPad: the badge box must not run into the touch buttons.
  for (const [name, dev] of [['landscape', 'iPad (gen 7) landscape'], ['portrait', 'iPad (gen 7)']]) {
    const pad = await openGame(browser, base, { contextOptions: devices[dev] });
    await pad.tap('text=New Game');
    await pad.tap('.starter >> nth=0');
    await pad.waitForTimeout(1500);
    await pad.evaluate(async () => {
      const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
      g.badges = GYMS.map(x => x.id);
      g.ui.renderHud();
    });
    await pad.waitForTimeout(1000);
    const m = await pad.evaluate(() => {
      const r = document.getElementById('badges').getBoundingClientRect();
      const hud = document.getElementById('badges').parentElement.getBoundingClientRect();
      const others = [...document.querySelectorAll('#btn-break, #btn-place, #btn-jump, #btn-team, #btn-blocks, #btn-book, #btn-pause, #joystick')]
        .filter(e => e.offsetParent).map(e => e.getBoundingClientRect());
      const hit = others.some(o => !(o.right < hud.left || o.left > hud.right || o.bottom < hud.top || o.top > hud.bottom));
      return { n: document.querySelectorAll('#badges > *').length, h: r.height, right: r.right, vw: innerWidth, hit };
    });
    t.ok(m.n === 22 && m.h <= 90 && m.right <= m.vw && !m.hit, `iPad ${name}: 22 badges fit (${Math.round(m.h)}px high) and the touch buttons are clear`);
    await pad.screenshot({ path: SHOTS + `badges-22-ipad-${name}.png` });
    t.ok(!pad.errors.length, `iPad ${name}: no page errors ${pad.errors.join('; ')}`);
    await pad.context().close();
  }
}
