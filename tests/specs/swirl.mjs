// T38a: the Portal Door and the Swirl. PART A (builder A): the door in the main world (pure checks on three seeds, closed for
// everybody but a Champion, swirling for a Champion), stars (HUD, save, loadStars), travel there and back, the realm
// generalisation (no morning, no wild creatures, clock, sky, guide), a save made in the Swirl, two browsers.
// PART B (builder B, see the marked block near the end): the real Swirl terrain, lifts, frames, star bridge, Wizard's tower.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, openGame, openPair, newGame, pause, click, continueGame, waitFor, seedSave } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

// A checksum of the main world; blocks drawn per player (gyms' live parts, the Portal Door's two looks) count as air.
const sum = () => {
  const d = window.pokecraft.world.data, live = new Set([57, 58, 59, 60, 61, 62, 63, 64, 73, 74, 48, 69, 9, 83, 84, 85, 92, 93, 89, 90, 95, 96, 97, 98, 99, 100, 101, 102, 124, 125]);
  const w = window.pokecraft.world, boxes = w.gyms.filter(g => g.def.live && g.protect?.length).map(g => g.protect[0]);
  const inCourse = i => { const x = i % w.W, z = Math.floor(i / w.W) % w.D; return boxes.some(c => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1); };
  let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + (live.has(d[i]) || inCourse(i) ? 0 : d[i])) | 0; return h;
};
const toasts = () => { // record every toast from now on
  const g = window.pokecraft, toast = g.ui.toast.bind(g.ui);
  window.__toasts = [];
  g.ui.toast = m => { window.__toasts.push(m); toast(m); };
};
// Stand in front of the Portal Door looking at its middle.
const lookAtDoor = () => {
  const g = window.pokecraft, c = g.world.portal, p = g.player;
  p.pos.set(c.stand[0], c.stand[1], c.stand[2]); p.vel.set(0, 0, 0);
  p.yaw = Math.atan2(c.front[0], c.front[1]); // towards the tower
  const mid = c.surface[7]; // the middle cell of the 3 x 5 surface
  p.pitch = Math.atan2(mid[1] + 0.5 - p.eyePos.y, Math.hypot(mid[0] + 0.5 - p.pos.x, mid[2] + 0.5 - p.pos.z));
};
// Float a few blocks back and look at the door, for a screenshot (the game is paused: nothing falls).
const backOff = () => {
  const g = window.pokecraft, c = g.world.portal, p = g.player, mid = c.surface[7];
  p.pos.set(c.stand[0] + c.front[0] * 6, c.y + 4, c.stand[2] + c.front[1] * 6); p.vel.set(0, 0, 0);
  p.lookAt({ x: mid[0] + 0.5, y: mid[1] + 0.5, z: mid[2] + 0.5 });
};
const swirlOn = page => waitFor(page, () => window.pokecraft.place === 'swirl' && !window.pokecraft.realms.busy);
const mainOn = page => waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);

  // ======================================= PART A =======================================
  // 1. Pure: the door is built with the tower (three seeds, the 224 map), changes nothing else, moves no treasure spot.
  const pure = await page.evaluate(async () => {
    const { World } = await import('/src/world.js'), { B } = await import('/src/blocks.js'), { treasureSpots } = await import('/src/treasuremap.js');
    const P = await import('/src/portal.js');
    const out = [];
    for (const seed of [1, 4242, 294331207]) {
      const a = new World(seed, null, null, [224, 224]); a.generate();
      const b = new World(seed, null, null, [224, 224]); b.generate({ portal: false });
      const pd = a.portal, box = pd.box, T = a.tower.protect[0];
      const inBox = (x, y, z) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1 && z >= box.z0 && z <= box.z1;
      let outside = 0, inside = 0;
      for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) { const x = i % a.W, z = Math.floor(i / a.W) % a.D, y = Math.floor(i / (a.W * a.D)); if (inBox(x, y, z)) inside++; else outside++; }
      const ts = JSON.stringify(treasureSpots(a)), ts2 = JSON.stringify(treasureSpots(b));
      out.push({
        seed, cells: pd.surface.length, dim: pd.surface.every(([x, y, z]) => a.get(x, y, z) === B.PORTAL_DIM), frame: pd.frame.every(([x, y, z]) => a.get(x, y, z) === B.PORTAL_FRAME),
        none: b.portal === undefined, withinTower: box.x0 >= T.x0 && box.x1 <= T.x1 && box.z0 >= T.z0 && box.z1 <= T.z1 && box.y0 >= T.y0 && box.y1 <= T.y1,
        last: JSON.stringify(a.tower.protect.at(-1)) === JSON.stringify(box), protects: a.tower.protect.length, outside, inside, spots: ts === ts2,
        stand: !a.get(Math.floor(pd.stand[0]), Math.floor(pd.stand[1]), Math.floor(pd.stand[2])) && !a.get(Math.floor(pd.stand[0]), Math.floor(pd.stand[1]) + 1, Math.floor(pd.stand[2])),
        edit: a.editAllowed(pd.surface[0][0], pd.surface[0][1], pd.surface[0][2], B.STONE) || a.editAllowed(pd.frame[0][0], pd.frame[0][1], pd.frame[0][2], B.AIR),
        boxes: a.newGymBoxes.some(n => n.x0 === box.x0 && n.z1 === box.z1 && n.y0 === 0),
      });
    }
    const g = window.pokecraft.world;
    const full = { W: g.W, D: g.D, dim: g.portal && g.portal.surface.every(([x, y, z]) => g.get(x, y, z) === B.PORTAL_DIM || g.get(x, y, z) === B.PORTAL), hasBox: g.tower.protect.length === 2 };
    return { out, full, ids: [B.PORTAL_DIM, B.PORTAL, B.PORTAL_FRAME], at: P.PORTAL_AT };
  });
  for (const o of pure.out) {
    t.ok(o.cells === 15 && o.dim && o.frame && o.withinTower && o.last && o.protects === 2 && o.boxes, `seed ${o.seed}: the Portal Door (15 dim cells, its frame) stands inside the tower's protected box and is appended to tower.protect (${JSON.stringify(o)})`);
    t.ok(o.none && o.outside === 0 && o.inside > 0 && o.spots, `seed ${o.seed}: generate({ portal: false }) differs only inside the door's box (${o.inside} cells, ${o.outside} outside); treasure spots are the same`);
    t.ok(o.stand && !o.edit, `seed ${o.seed}: you come back to a free spot, and nobody can edit the door`);
  }
  t.ok(pure.full.W === 288 && pure.full.D === 368 && pure.full.dim && pure.full.hasBox, `the big 288 x 368 map has the door too (${JSON.stringify(pure.full)})`);

  // 2. Not a Champion: the door is closed.
  await newGame(page); await pause(page);
  await page.evaluate(toasts);
  await page.evaluate(lookAtDoor);
  await page.evaluate(() => { document.getElementById('pause').classList.add('hidden'); });
  await waitFor(page, () => document.getElementById('prompt').textContent.startsWith('Portal Door'));
  const closed = await page.evaluate(async () => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js'), w = g.world, c = w.portal.surface[7], edits = w.edits.size;
    const prompt = document.getElementById('prompt').textContent, action = document.getElementById('btn-action')?.textContent ?? null;
    g.interact(true);
    const t1 = window.__toasts.at(-1);
    window.__toasts = [];
    g.breakBlock();
    const t2 = window.__toasts.at(-1);
    window.__toasts = [];
    g.hotbar[g.selected] = B.STONE;
    const lintel = w.portal.frame.find(([x, y, z]) => y === w.portal.y + 5 && w.get(x, y, z) === B.PORTAL_FRAME); // a frame block at the lintel
    g.placeBlock({ x: lintel[0], y: lintel[1], z: lintel[2], normal: [0, 1, 0], id: B.PORTAL_FRAME });
    const t3 = window.__toasts.at(-1), above = w.get(lintel[0], lintel[1] + 1, lintel[2]);
    return { prompt, action, t1, t2, t3, above, still: w.get(...c), edits: w.edits.size - edits, place: g.place };
  });
  t.ok(closed.prompt === 'Portal Door · closed' && closed.t1 === 'Only a Champion can open this door. Win in the tower first!' && closed.place === 'main', `a non-Champion sees "Portal Door · closed" and gets the kind toast (${closed.prompt} | ${closed.t1})`);
  t.ok(closed.still === pure.ids[0] && closed.edits === 0 && closed.t2 === closed.t1, `breaking the door changes nothing (it just says the same, ${closed.t2})`);
  t.ok(closed.above === 0 && closed.edits === 0 && /gym|build/i.test(closed.t3 || ''), `you cannot build into the door's box (${closed.t3})`);
  t.ok(await page.evaluate(() => window.pokecraft.ui.starsShown === null && document.getElementById('stars').classList.contains('hidden')), 'a non-Champion sees no stars on the screen');
  await page.evaluate(backOff);
  await page.evaluate(() => { document.getElementById('toast').replaceChildren(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 't38-door-dim.png') });
  await page.evaluate(lookAtDoor);

  // 3. A Champion: the door swirls, using it travels.
  await page.evaluate(() => { window.pokecraft.champion = true; });
  await waitFor(page, ([x, y, z]) => window.pokecraft.world.get(x, y, z) === 125, await page.evaluate(() => window.pokecraft.world.portal.surface[7]));
  const open = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, { B } = await import('/src/blocks.js');
    return { all: w.portal.surface.every(([x, y, z]) => w.get(x, y, z) === B.PORTAL), edits: w.edits.size, dirty: !!w.hasPortal };
  });
  t.ok(open.all && open.edits === 0, `for a Champion all 15 cells swirl (setLive: no edit, ${open.edits} edits)`);
  await waitFor(page, () => document.getElementById('prompt').textContent === 'Portal Door · click or E to step in');
  await page.evaluate(backOff);
  await page.evaluate(() => { document.getElementById('toast').replaceChildren(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 't38-door-open.png') });
  await page.evaluate(lookAtDoor);
  t.ok(await page.evaluate(() => window.pokecraft.world.hasPortal === true), 'the world knows it has a swirling door (so main.js turns its tile)');
  t.ok(await page.evaluate(() => window.pokecraft.ui.starsShown === '0/7'), 'a Champion sees 7 empty stars on the screen');
  const before = await page.evaluate(sum);
  await page.evaluate(() => { window.__toasts = []; window.pokecraft.interact(true); });
  await swirlOn(page);
  const there = await page.evaluate(() => {
    const g = window.pokecraft, p = g.player.pos, s = JSON.parse((g.save(), localStorage.getItem('pokecraft-save-v2')));
    g.updateGuide();
    return { size: [g.world.W, g.world.D], realm: g.world.realm?.id, x: p.x, y: p.y, z: p.z, yaw: g.player.yaw, toasts: window.__toasts.slice(), stars: g.ui.starsShown,
      npcs: g.npcs.list.length, homes: g.homes.list.length, guide: document.getElementById('guide').textContent, sp: s.place, sv: s.realmVersions, pos: s.pos, ret: g.realms.stash.ret, door: g.world.portal === undefined || g.world.portal === null };
  });
  t.ok(there.realm === 'swirl' && there.size.join() === '160,160' && Math.abs(there.x - 43.5) < 0.6 && Math.abs(there.z - 80.5) < 0.6 && Math.abs(there.yaw + Math.PI / 2) < 0.01,
    `using the door takes a Champion to the Swirl: 160 x 160, arrive at 43.5, 80.5, facing east (${JSON.stringify(there)})`);
  t.ok(there.toasts.includes('Whoosh! Welcome to the Swirl!') && !there.toasts.some(m => /Wake Stone|upside-down/i.test(m)), `the welcome toast is the Swirl's own (${there.toasts.join(' | ')})`);
  t.ok(there.stars === '0/7' && there.npcs === 0 && there.homes === 0, `7 empty stars on the screen, no people, no homes (${there.stars}, npcs ${there.npcs})`);
  t.ok(there.sp === 'swirl' && there.sv?.swirl === 1 && there.sv?.dream === 2, `a save made in the Swirl says so and knows the realm versions (${JSON.stringify(there.sv)})`);
  t.ok(Math.hypot(there.ret[0] - there.pos[0], there.ret[2] - there.pos[2]) < 0.01, 'the saved main position is where the Portal Door sends you back');
  t.ok(/Portal Door home/.test(there.guide), `the guide in the Swirl points at the door home ("${there.guide}")`);
  await page.evaluate(() => { document.getElementById('toast').replaceChildren(); document.getElementById('pause').classList.add('hidden'); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, 't38-swirl-arrival.png') });

  // 11. No morning, no wild creatures, the Swirl's own clock, a still sky, stars in the weather.
  const still = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player.pos;
    g.time = 0.1; // morning in the main world
    for (let i = 0; i < 60; i++) { g.realms.update(); g.creatures.update(0.5, p, g.spawnPoint, g.night); }
    const bg = g.scene.background.getHex();
    g.time = 0.75;
    await new Promise(r => setTimeout(r, 1500));
    return { place: g.place, list: g.creatures.list.length, clock: document.getElementById('clock').textContent, moon: g.ui.moonShown, kind: g.weather.kindAt('swirl'), bg, bg2: g.scene.background.getHex(), busy: g.realms.busy };
  });
  t.ok(still.place === 'swirl' && !still.busy, 'the morning does not wake you up in the Swirl');
  t.ok(still.list === 0, `no wild creatures (${still.list})`);
  t.ok(still.clock.includes('✦ Swirl') && still.moon === null && still.kind === 'stars', `the clock says Swirl, no moon, twinkly stars (${still.clock} ${still.moon} ${still.kind})`);
  t.ok(still.bg === still.bg2, 'the sky does not change with the main clock');

  // 10. Place a block on the hub, save, reload: still in the Swirl, where you were, block kept.
  const placed = await page.evaluate(async () => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js'), w = g.world;
    g.hotbar[g.selected] = B.PLANKS;
    const x = 50, z = 88, y = w.surface(x, z).y;
    g.placeBlock({ x, y, z, normal: [0, 1, 0], id: w.get(x, y, z) });
    g.player.pos.x += 1; g.save();
    return { cell: [x, y + 1, z], id: w.get(x, y + 1, z), pos: g.player.pos.toArray(), top: w.get(x, y, z) };
  });
  t.ok(placed.id === 8 && placed.top === 127, `you can build on the Swirl Stone of the hub (${JSON.stringify(placed)})`);
  await page.reload();
  await page.waitForFunction(() => window.pokecraft?.world);
  await continueGame(page);
  const loaded = await page.evaluate(([c, pos]) => { const g = window.pokecraft, p = g.player.pos; return { place: g.place, realm: g.world.realm?.id, id: g.world.get(...c), d: Math.hypot(p.x - pos[0], p.z - pos[2]), stash: !!g.realms.stash }; }, [placed.cell, placed.pos]);
  t.ok(loaded.place === 'swirl' && loaded.realm === 'swirl' && loaded.d < 1.5 && loaded.stash, `a save made in the Swirl loads in the Swirl, where you were (${JSON.stringify(loaded)})`);
  t.ok(loaded.id === 8, 'the block you built on the hub is still there');

  // 9. Back through the door.
  await page.evaluate(toasts);
  await page.evaluate(async () => { const g = window.pokecraft, { B } = await import('/src/blocks.js'), c = g.world.door.surface[7]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: B.PORTAL }); });
  await mainOn(page);
  const back = await page.evaluate(() => {
    const g = window.pokecraft, p = g.player.pos, c = g.world.portal;
    return { d: Math.hypot(p.x - c.stand[0], p.z - c.stand[2]), dy: Math.abs(p.y - c.stand[1]), yaw: g.player.yaw - Math.atan2(-c.front[0], -c.front[1]), toast: window.__toasts.at(-1), size: g.world.W, champion: g.champion };
  });
  t.ok(back.d < 0.5 && back.dy < 1 && Math.abs(back.yaw) < 0.01 && back.size === 288, `the door back puts you in front of the Portal Door, looking away from it (${JSON.stringify(back)})`);
  t.ok(back.toast === 'You stepped back through the Portal Door.', `the words coming back (${back.toast})`);
  await waitFor(page, () => { const g = window.pokecraft; return g.world.get(...g.world.portal.surface[0]) === 125; });
  t.ok(await page.evaluate(sum) === before, 'the main world is block for block the same after the trip');
  // a trip does not leave the door half-drawn or the tile stuck: a second trip works
  await page.evaluate(() => window.pokecraft.portal.use({ ...(() => { const [x, y, z] = window.pokecraft.world.portal.surface[3]; return { x, y, z }; })(), id: 125 }));
  await swirlOn(page);
  t.ok(await page.evaluate(() => { const g = window.pokecraft; return g.player.pos.x > 43 && g.player.pos.x < 44; }), 'a second trip through the door works');
  await page.evaluate(() => window.pokecraft.realms.leave('door'));
  await mainOn(page);

  // 8 (A part). Stars: HUD, save, reload, loadStars.
  await page.evaluate(() => { window.pokecraft.stars = ['house']; });
  await waitFor(page, () => window.pokecraft.ui.starsShown === '1/7');
  const hud = await page.evaluate(async () => {
    const { loadStars, PICTURE_WORLDS } = await import('/src/pictureworlds.js');
    const g = window.pokecraft;
    g.save();
    return { got: document.querySelectorAll('#stars .star.got').length, all: document.querySelectorAll('#stars .star').length, titles: [...document.querySelectorAll('#stars .star')].map(s => s.title).join(),
      saved: JSON.parse(localStorage.getItem('pokecraft-save-v2')).stars, clean: JSON.stringify(loadStars(['x', 'house', 'house', 3])), none: JSON.stringify(loadStars()), order: JSON.stringify(loadStars(['doors', 'house'])),
      ids: PICTURE_WORLDS.map(w => w.id).join(), ready: PICTURE_WORLDS.some(w => w.ready) };
  });
  t.ok(hud.got === 1 && hud.all === 7 && hud.titles.startsWith('Giant House,Pirate Seas'), `one gold star of seven, each named (${hud.got}/${hud.all}: ${hud.titles})`);
  t.ok(JSON.stringify(hud.saved) === '["house"]' && hud.clean === '["house"]' && hud.none === '[]' && hud.order === '["house","doors"]', `stars are saved; loadStars drops junk and repeats, and keeps the list order (${hud.clean} ${hud.order})`);
  t.ok(hud.ids === 'house,pirate,race,stadium,portal,fair,doors' && !hud.ready, 'seven Picture Worlds, none ready in wave 13');
  await page.evaluate(() => { document.getElementById('toast').replaceChildren(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 't38-hud-stars.png') });
  await page.reload();
  await page.waitForFunction(() => window.pokecraft?.world);
  await continueGame(page);
  t.ok(await page.evaluate(() => JSON.stringify(window.pokecraft.stars) === '["house"]' && window.pokecraft.ui.starsShown === '1/7'), 'stars survive a reload');
  t.ok(page.errors.length === 0, `no page errors (${page.errors.slice(0, 3).join(' | ')})`);
  await page.context().close();

  // An old save (no stars, no place) loads in the main world with no stars and no new toasts.
  const old = { seed: 4242, edits: [], size: [288, 288], pos: [112.5, 30, 112.5], yaw: 0, pitch: 0, time: 0.2, party: [], box: [], cubes: 10, badges: [], beaten: [], champion: true, savedAt: 1 };
  const P2 = await openGame(browser, base, { setup: seedSave(old) });
  await continueGame(P2);
  const o = await P2.evaluate(() => { const g = window.pokecraft; g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { place: g.place, stars: s.stars, shown: g.ui.starsShown, door: !!g.world.portal }; });
  t.ok(o.place === 'main' && JSON.stringify(o.stars) === '[]' && o.shown === '0/7' && o.door, `an old Champion's save loads: no stars yet, the door is there (${JSON.stringify(o)})`);
  await P2.context().close();

  // 13. Two browsers: a guest can't use the host's door; the host going in and coming back is told to the guest.
  const [A, Bp] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(Bp, 1); await pause(Bp);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await Bp.fill('#mp input[placeholder="Your name"]', 'Kid');
  await Bp.fill('#mp .mp-code-input', code);
  await click(Bp, '#mp button:has-text("Join a world")');
  await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000);
  await A.evaluate(toasts); await Bp.evaluate(toasts);
  await A.evaluate(() => { window.pokecraft.champion = true; });
  await Bp.evaluate(() => { window.pokecraft.champion = true; });
  await Bp.evaluate(() => { const g = window.pokecraft, c = g.world.portal; g.portal.use({ x: c.surface[0][0], y: c.surface[0][1], z: c.surface[0][2], id: 125 }); });
  t.ok(await Bp.evaluate(() => window.pokecraft.place === 'main' && window.__toasts.at(-1) === 'Go through the Portal Door in your own world!'), 'a guest who is a Champion gets a toast, not a trip');
  await Bp.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; g.player.pos.copy(a.target).add({ x: 2, y: 0, z: 0 }); });
  await waitFor(Bp, () => [...window.pokecraft.mp.others.values()][0]?.model.visible);
  await A.evaluate(() => { const g = window.pokecraft, c = g.world.portal; g.portal.use({ x: c.surface[0][0], y: c.surface[0][1], z: c.surface[0][2], id: 125 }); });
  await swirlOn(A);
  await waitFor(Bp, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a && !a.here && !a.model.visible; });
  t.ok(await Bp.evaluate(() => window.__toasts.some(m => m === 'Dad stepped through the Portal Door.')), 'the guest is told the host stepped through the Portal Door, and the host is hidden');
  await A.evaluate(() => window.pokecraft.realms.leave('door'));
  await mainOn(A);
  await waitFor(Bp, () => [...window.pokecraft.mp.others.values()][0]?.model.visible);
  t.ok(await Bp.evaluate(() => window.__toasts.some(m => m === 'Dad is back!')), 'the guest sees the host again: "Dad is back!"');
  t.ok(A.errors.length === 0 && Bp.errors.length === 0, `no page errors in the pair (${[...A.errors, ...Bp.errors].slice(0, 3).join(' | ')})`);
  await A.context().close(); await Bp.context().close();

  // ===================================== PART B (builder B) =====================================
  // The real Swirl: decks, galleries, stairs, lifts, frames, the star bridge, the Wizard's tower, walks, the guide on the hub
  // and on the cloud sea, an iPad tap. Builder B adds those checks here (plans/T38a.md sections 3 and 7).
}
