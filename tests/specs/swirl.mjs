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
  t.ok(await page.evaluate(() => window.pokecraft.ui.starsShown === null), 'a Champion with no star sees no star row in our world (a calm HUD)');
  const before = await page.evaluate(sum);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); // a game frame has seen where we look now
  await page.evaluate(() => { window.__toasts = []; window.pokecraft.interact(true); });
  await swirlOn(page);
  await waitFor(page, () => window.pokecraft.ui.starsShown !== null); // the HUD refreshes from the game loop
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
  t.ok(there.sp === 'swirl' && there.sv?.swirl === 2 && there.sv?.dream === 2, `a save made in the Swirl says so and knows the realm versions (${JSON.stringify(there.sv)})`);
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
    window.__toasts = [];
    await new Promise(r => setTimeout(r, 20000));
    const shooting = window.__toasts.some(m => /shooting star|Cosmic creatures/i.test(m));
    return { shooting, place: g.place, list: g.creatures.list.length, clock: document.getElementById('clock').textContent, moon: g.ui.moonShown, kind: g.weather.kindAt('swirl'), bg, bg2: g.scene.background.getHex(), busy: g.realms.busy };
  });
  t.ok(still.place === 'swirl' && !still.busy, 'the morning does not wake you up in the Swirl');
  t.ok(still.list === 0, `no wild creatures (${still.list})`);
  t.ok(still.clock.includes('✦ Swirl') && still.moon === null && still.kind === 'clear' && !still.shooting, `the clock says Swirl, no moon, always clear: no shooting-star toast (${still.clock} ${still.moon} ${still.kind})`);
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
  t.ok(placed.id === 8 && (placed.top === 127 || placed.top === 132), `you can build on the Swirl Stone of the hub (${JSON.stringify(placed)})`);
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
    return { d: Math.hypot(p.x - c.stand[0], p.z - c.stand[2]), dy: Math.abs(p.y - c.stand[1]), yaw: g.player.yaw - Math.atan2(-c.front[0], -c.front[1]), toast: window.__toasts.find(m => m.startsWith('You stepped back')) ?? window.__toasts.at(-1), size: g.world.W, champion: g.champion };
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
  t.ok(o.place === 'main' && JSON.stringify(o.stars) === '[]' && o.shown === null && o.door, `an old Champion's save loads: no stars yet (no star row), the door is there (${JSON.stringify(o)})`);
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
  t.ok(await Bp.evaluate(() => window.pokecraft.place === 'main' && window.__toasts.at(-1) === 'You can go to the Swirl in your own world, or follow Dad when they go.'), 'a guest who is a Champion gets a toast, not a trip (T38b: follow the host instead)');
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
  // and on the cloud sea, an iPad tap.
  const Q = await openGame(browser, base);
  await newGame(Q, 0); await pause(Q);
  await Q.evaluate(toasts);
  await Q.evaluate(() => { window.pokecraft.champion = true; });
  await Q.evaluate(() => { const g = window.pokecraft; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await swirlOn(Q);
  await Q.evaluate(() => { document.getElementById('pause').classList.add('hidden'); window.__edits0 = window.pokecraft.world.edits.size; });

  // 4. The data: same seed, same blocks; the decks, frames, bridge and the Wizard's tower are where the tables say.
  const data = await Q.evaluate(async () => {
    const g = window.pokecraft, w = g.world, { B } = await import('/src/blocks.js'), { World } = await import('/src/world.js'), { REALMS } = await import('/src/realms.js');
    const L = await import('/src/swirlland.js'), { PICTURE_WORLDS } = await import('/src/pictureworlds.js');
    const sumOf = x => { let h = 0; for (let i = 0; i < x.data.length; i++) h = (h * 31 + x.data[i]) | 0; return h; };
    const a = new World(w.seed, null, null, REALMS.swirl.size, REALMS.swirl); a.generate();
    const b = new World(w.seed + 5, null, null, REALMS.swirl.size, REALMS.swirl); b.generate();
    const decks = L.DECKS.map(d => {
      const [x, z] = d.round ? [d.round[0] - 6, d.round[1]] : [d.box[0] + 1, d.box[2] + 1];
      return w.surface(x, z).y === d.y && (w.get(x, d.y, z) === B.SWIRL_STONE || w.get(x, d.y, z) === B.SWIRL_PAINT);
    });
    const sw = w.swirl;
    const frames = sw.frames.map(f => ({ id: f.spot.id, cloth: f.cloth.length, ok: f.cloth.every(([x, y, z]) => w.get(x, y, z) === B.CLOTH) && f.border.every(([x, y, z]) => w.get(x, y, z) !== B.AIR) }));
    const s3 = L.FRAME_SPOTS[7], s3empty = w.get(s3.x, s3.y + 3, s3.z) === 0 && w.get(s3.x - 3, s3.y, s3.z) === 0;
    const bridgeAir = sw.bridge.every(s => s.cells.every(([x, y, z]) => w.get(x, y, z) === B.AIR));
    // the Wizard's tower is sealed: flood from inside over non-solid cells and see if it ever leaves the 9 x 9 box
    const wz = sw.wizard, start = [wz.x, 25, wz.z], seen = new Set([start.join()]), q = [start];
    let leak = false;
    while (q.length) {
      const [x, y, z] = q.pop();
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = [x + dx, y + dy, z + dz];
        if (!w.inBounds(...n)) { leak = true; continue; }
        if (w.isSolid(...n)) continue;
        const k = n.join(); if (seen.has(k)) continue;
        seen.add(k); q.push(n);
        if (Math.abs(n[0] - wz.x) > 4 || Math.abs(n[2] - wz.z) > 4) leak = true;
      }
    }
    return {
      same: sumOf(a) === sumOf(w), other: sumOf(a) === sumOf(b), decks, frames, s3empty, bridgeAir, bridge: sw.bridge.length, n: PICTURE_WORLDS.length,
      sealed: !leak && seen.size > 100, island: [wz.x - 9, wz.x + 9], x12: L.wizardX(12) + 9,
      lifts: w.lifts.length, liftAt: !!w.liftAt({ x: 70.5, y: 5, z: 106.5 }) && !w.liftAt({ x: 80.5, y: 5, z: 106.5 }), size: [w.W, w.D], gyms: w.gyms.length, tower: w.tower,
    };
  });
  t.ok(data.same && data.other, 'the Swirl is the same for every seed, block for block (it is made of tables)');
  t.ok(data.decks.every(Boolean), `every deck is where DECKS says: Swirl Stone or Paint at its height (${data.decks.join()})`);
  t.ok(data.frames.length === 7 && data.frames.every(f => f.cloth === 25 && f.ok) && data.s3empty, `7 picture frames with cloth inside (5 x 5), the 8th spot waits empty (${data.frames.map(f => f.id).join()})`);
  t.ok(data.bridgeAir && data.bridge === data.n, `the ${data.n} star-bridge stones are air until a star is won`);
  t.ok(data.sealed, "the Wizard's tower has no way in (a flood from inside never gets out)");
  t.ok(data.x12 <= 158 && data.island[0] === 103 && data.island[1] === 121, `the Wizard's island stays on the 160 map even with 12 Picture Worlds (x ${data.island.join('-')}, 12 worlds: right edge ${data.x12})`);
  t.ok(data.liftAt && data.lifts === 6 && data.size.join() === '160,160' && data.gyms === 0 && data.tower === null, 'six lift streams (boxes, no blocks), no gyms, no tower');

  // 5. Walkable: a flood over standable cells from the arrival reaches every frame, the bridge start, the loop's peak and the door home.
  const walk = await Q.evaluate(() => {
    const w = window.pokecraft.world, sw = w.swirl, solid = (x, y, z) => w.isSolid(x, y, z);
    const start = [43, 21, 80], seen = new Set([start.join()]), q = [start];
    while (q.length) {
      const [x, y, z] = q.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        for (let ny = y + 1; ny >= 1; ny--) { // step up at most 1, drop any
          if (!solid(nx, ny - 1, nz)) continue;
          if (solid(nx, ny, nz) || solid(nx, ny + 1, nz) || (ny > y && solid(x, y + 2, z))) break;
          const k = [nx, ny, nz].join();
          if (!seen.has(k)) { seen.add(k); q.push([nx, ny, nz]); }
          break;
        }
      }
    }
    const has = (x, y, z) => seen.has([x, y, z].join());
    let peak = 0, island = false, tower = false;
    for (const k of seen) {
      const [x, y, z] = k.split(',').map(Number);
      if (x >= 56 && x <= 64 && z >= 84 && z <= 92) peak = Math.max(peak, y);
      if (x >= 103 && y >= 21) island = true;
      if (Math.abs(x - sw.wizard.x) <= 4 && y > 21) tower = true;
    }
    // from the cloud sea, every point of the playground is near a lift stream
    let far = 0;
    for (let x = 5; x <= 95; x += 5) for (let z = 20; z <= 140; z += 5) far = Math.max(far, Math.min(...w.lifts.map(l => Math.hypot((l.x[0] + l.x[1] + 1) / 2 - x, (l.z[0] + l.z[1] + 1) / 2 - z))));
    return { frames: sw.frames.map(f => has(...f.stand)), bridge: has(60, 21, 80), door: has(44, 21, 80), peak, island, tower, far: Math.round(far) };
  });
  t.ok(walk.frames.every(Boolean), `you can walk to every picture frame (${walk.frames.join()})`);
  t.ok(walk.bridge && walk.door, 'and to the start of the star bridge and back to the door home');
  t.ok(walk.peak >= 24, `the looping stairs climb ${walk.peak - 20} blocks`);
  t.ok(!walk.island && !walk.tower, "the Wizard's island can't be reached on foot (the bridge is empty)");
  t.ok(walk.far <= 60, `from the cloud sea a lift is never more than ${walk.far} blocks away`);

  // 6. A lift stream: stand in the south one at the bottom, it carries you up to the deck.
  const lift = await Q.evaluate(() => {
    const g = window.pokecraft, p = g.player, l = g.world.lifts.find(x => x.id === 'south');
    p.keys = {};
    p.pos.set(70.0, 1, 106.0); p.vel.set(0, 0, 0);
    for (let i = 0; i < 20; i++) p.update(0.05);
    const midY = p.pos.y;
    for (let i = 0; i < 60; i++) p.update(0.05);
    const topY = p.pos.y;
    p.pos.x = 67.5; p.pos.z = 106.5; p.vel.set(0, 0, 0); // a step to the west is the deck
    for (let i = 0; i < 40; i++) p.update(0.05);
    return { midY, topY, y1: l.y[1], landed: p.pos.y, onGround: p.onGround, meshes: g.portal.info().lifts };
  });
  t.ok(lift.midY > 5 && lift.topY > lift.y1 - 1 && lift.topY < lift.y1 + 3, `a lift stream carries you up to the deck (1 -> ${lift.midY.toFixed(1)} -> ${lift.topY.toFixed(1)}, top ${lift.y1})`);
  t.ok(Math.abs(lift.landed - 15) < 0.1 && lift.onGround, `a step sideways lands you on the south deck (${lift.landed})`);
  t.ok(lift.meshes === 6, 'each stream is drawn as one moving picture (6 meshes)');

  // 7. Frames: using one says the world is not open yet; breaking changes nothing.
  const fr = await Q.evaluate(async () => {
    const g = window.pokecraft, w = g.world, { B } = await import('/src/blocks.js'), f = w.swirl.frames[0], c = f.cloth[12], b = f.border[3];
    const before = w.edits.size;
    window.__toasts = [];
    const used = g.portal.use({ x: c[0], y: c[1], z: c[2], id: B.CLOTH }), t1 = window.__toasts.at(-1);
    const prompt = g.portal.prompt({ x: c[0], y: c[1], z: c[2], id: B.CLOTH }, 'click or E');
    window.__toasts = [];
    g.portal.use({ x: b[0], y: b[1], z: b[2], id: w.get(...b) });
    const t2 = window.__toasts.at(-1);
    const edits = w.edits.size;
    g.hotbar[g.selected] = B.PLANKS;
    g.placeBlock({ x: c[0], y: c[1], z: c[2] + 2, normal: [0, 0, -1], id: B.CLOTH }); // the cell in front of the cloth, inside the frame's keep
    return { used, t1, prompt, t2, still: w.get(...c), edits: w.edits.size - edits, before, placed: w.get(c[0], c[1], c[2] + 1) };
  });
  t.ok(fr.used && fr.t1 === "🏠 Giant House: this world isn't open yet. Come back soon!" && fr.prompt === 'Picture frame · Giant House · covered', `using a frame: "${fr.t1}" (${fr.prompt})`);
  t.ok(fr.still === 129 && fr.edits === 0 && fr.t2 === fr.t1, `breaking a frame says the same and changes nothing ${JSON.stringify(fr)}`);
  t.ok(fr.placed === 0, `you cannot build into a picture frame's space (${fr.placed})`);

  // 8. Stars light the bridge: the first stone turns to Star Stone, the others stay air with outlines.
  await waitFor(Q, () => window.pokecraft.portal.info()?.outline); // drawn by the first update after arriving (0.25 s steps)
  const bridge0 = await Q.evaluate(() => window.pokecraft.portal.info());
  t.ok(bridge0.outline && bridge0.outlineBoxes === 7, `seven gold outlines mark the empty stones (${bridge0.outlineBoxes})`);
  await Q.evaluate(() => { window.pokecraft.stars = ['house']; });
  await waitFor(Q, () => { const g = window.pokecraft, c = g.world.swirl.bridge[0].cells[0]; return g.world.get(...c) === 130; });
  const lit = await Q.evaluate(() => {
    const g = window.pokecraft, w = g.world, sw = w.swirl.bridge, i = g.portal.info();
    return { first: sw[0].cells.every(([x, y, z]) => w.get(x, y, z) === 130), rest: sw.slice(1).every(s => s.cells.every(([x, y, z]) => w.get(x, y, z) === 0)), boxes: i.outlineBoxes, edits: w.edits.size - window.__edits0 };
  });
  t.ok(lit.first && lit.rest && lit.boxes === 6 && lit.edits === 0, `one star lights stone 0; the other 6 keep their outline (${JSON.stringify(lit)})`);
  const walkOn = await Q.evaluate(() => {
    const g = window.pokecraft, p = g.player; p.keys = {};
    p.pos.set(63.5, 21, 80.5); p.vel.set(0, 0, 0);
    for (let i = 0; i < 10; i++) p.update(0.05);
    return { y: p.pos.y, on: p.onGround };
  });
  t.ok(Math.abs(walkOn.y - 21) < 0.1 && walkOn.on, 'a lit star stone holds you up');
  await Q.evaluate(() => { window.pokecraft.stars = []; });
  await waitFor(Q, () => window.pokecraft.world.get(...window.pokecraft.world.swirl.bridge[0].cells[0]) === 0);

  // 12. The guide: on the hub the door home, on the cloud sea the nearest lift.
  const guide = await Q.evaluate(() => {
    const g = window.pokecraft, p = g.player; p.pos.set(52.5, 21, 76.5); p.vel.set(0, 0, 0); g.updateGuide();
    const hub = document.getElementById('guide').textContent;
    p.pos.set(100.5, 1, 140.5); g.updateGuide();
    return { hub, sea: document.getElementById('guide').textContent, target: g.guideTarget };
  });
  t.ok(/Portal Door home/.test(guide.hub), `on the hub the guide points at the door home ("${guide.hub}")`);
  t.ok(/Ride the river up!/.test(guide.sea), `on the cloud sea it points at the nearest lift ("${guide.sea}")`);

  // The Wizard's tower: using it says why it is shut.
  const wz = await Q.evaluate(async () => {
    const g = window.pokecraft, w = g.world, { B } = await import('/src/blocks.js'), c = w.swirl.wizard.door[2];
    window.__toasts = [];
    const used = g.portal.use({ x: c[0], y: c[1], z: c[2], id: B.WIZARD_STONE });
    return { used, toast: window.__toasts.at(-1), prompt: g.portal.prompt({ x: c[0], y: c[1], z: c[2], id: B.WIZARD_STONE }, 'E') };
  });
  t.ok(wz.used && wz.toast === 'The Wizard is inside, holding the Swirl together. Bring him stars!' && /sealed/.test(wz.prompt), `the Wizard's door: "${wz.toast}" (${wz.prompt})`);

  // ===== T38d: the looks =====
  // 15. Zones (pure): weights add up to 1, change smoothly, the right zone is the biggest in the right place, palettes are sane, and the
  // shader's constants are the JS ones.
  const zn = await Q.evaluate(async () => {
    const L = await import('/src/swirlland.js'), { swirlTint } = await import('/src/caves.js');
    let sumErr = 0, maxd = 0;
    for (let x = 0; x < 160; x++) for (let z = 0; z < 160; z++) {
      const a = L.zoneWeights(x, z);
      if (x % 2 === 0 && z % 2 === 0) sumErr = Math.max(sumErr, Math.abs(Object.values(a).reduce((p, v) => p + v, 0) - 1));
      for (const [dx, dz] of [[1, 0], [0, 1]]) { if (x + dx > 159 || z + dz > 159) continue; const b = L.zoneWeights(x + dx, z + dz); for (const k in a) maxd = Math.max(maxd, Math.abs(a[k] - b[k])); }
    }
    const pal = L.PARSED.map(p => ({ id: p.id, rgb: ['top', 'mid', 'fog', 'band', 'blobA', 'blobB', 'lo', 'hi', 'sea'].every(k => p[k].every(v => Number.isFinite(v) && v >= 0 && v <= 1)), lit: p.lit, near: p.fogNear, far: p.fogFar }));
    const u = swirlTint.uZone.value;
    return { sumErr, maxd, at: ['hub', 'north', 'south', 'wizard', 'corner'].map((k, i) => L.zoneAt(...[[48, 80], [48, 54], [48, 106], [L.wizardX(7), 80], [4, 4]][i])), pal,
      haze: swirlTint.uHaze.value === L.HAZE.w && L.HAZE.w === 0.12, zones: L.ZONES.every((z, i) => u[i].x === z.x && u[i].y === z.z && u[i].z === z.r), n: L.ZONES.length };
  });
  t.ok(zn.sumErr < 1e-6 && zn.n === 4, `the zone weights add up to 1 (error ${zn.sumErr})`);
  t.ok(zn.maxd <= 0.12, `neighbouring cells never differ by more than 0.12 in any weight, so moods blend smoothly (${zn.maxd.toFixed(3)})`);
  t.ok(zn.at.join() === 'sherbet,mist,sundrop,inkwell,haze', `the biggest weight: hub sherbet, north mist, south sundrop, the Wizard's island inkwell, a corner haze (${zn.at.join()})`);
  t.ok(zn.pal.every(p => p.rgb && p.lit >= 0.6 && p.lit <= 1 && p.near < p.far && p.far >= 80) && zn.pal[0].lit === 1, `every palette parses, brightness 0.6-1 (sherbet 1), fog near < far >= 80 (${zn.pal.map(p => p.id + ' ' + p.lit).join(', ')})`);
  t.ok(zn.haze && zn.zones, "the shader's haze weight and zone rings are the JS ones");

  // 16. The decor: counts, and everything keeps its distance from the places you can walk.
  const decor = await Q.evaluate(async () => {
    const g = window.pokecraft, w = g.world, sw = w.swirl, solid = (x, y, z) => w.isSolid(x, y, z);
    const start = [43, 21, 80], seen = new Set([start.join()]), q = [start], cells = [];
    while (q.length) {
      const [x, y, z] = q.pop(); cells.push([x, y, z]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        for (let ny = y + 1; ny >= 1; ny--) {
          if (!solid(nx, ny - 1, nz)) continue;
          if (solid(nx, ny, nz) || solid(nx, ny + 1, nz) || (ny > y && solid(x, y + 2, z))) break;
          const k = [nx, ny, nz].join();
          if (!seen.has(k)) { seen.add(k); q.push([nx, ny, nz]); }
          break;
        }
      }
    }
    const high = cells.filter(c => c[1] > 4), d = sw.decor;
    const near = (p, list) => list.reduce((m, c) => Math.min(m, Math.hypot(p.x - (c[0] + 0.5), p.y - (c[1] + 0.5), p.z - (c[2] + 0.5))), 1e9);
    const inBox = (p, b) => p.x >= b.x0 && p.x <= b.x1 + 1 && p.y >= b.y0 && p.y <= b.y1 + 1 && p.z >= b.z0 && p.z <= b.z1 + 1;
    const keepBoxes = w.keeps.flatMap(k => k.protect);
    const viewBoxes = sw.frames.map(f => ({ ...f.box, z0: f.spot.facing[1] < 0 ? f.box.z0 - 6 : f.box.z0, z1: f.spot.facing[1] > 0 ? f.box.z1 + 6 : f.box.z1 }));
    const liftBoxes = w.lifts.map(l => ({ x0: l.x[0], x1: l.x[1], z0: l.z[0], z1: l.z[1], y0: l.y[0], y1: l.y[1] }));
    const doorBox = w.door.box;
    let puffMin = 1e9, floatMin = 1e9, floatBad = [];
    for (const p of d.puffs) puffMin = Math.min(puffMin, near(p, high));
    for (const f of d.floaters) {
      floatMin = Math.min(floatMin, near(f, high));
      if (inBox(f, doorBox) || viewBoxes.some(b => inBox(f, b))) floatBad.push(f);
    }
    const cellBad = [];
    const all = [...sw.sculptures.flatMap(s => s.cells.map(c => [s.id, c])), ...sw.lanterns.map(c => ['lantern', c])];
    for (const [id, c] of all) {
      const p = { x: c[0] + 0.5, y: c[1] + 0.5, z: c[2] + 0.5 };
      if (liftBoxes.some(b => inBox(p, b)) || inBox(p, doorBox) || viewBoxes.some(b => inBox(p, b)) || (sw.frames.some(f => inBox(p, f.box))) || seen.has(c.join())) cellBad.push([id, c]);
    }
    // a lantern sits right under a solid cell and is itself in the air before it is placed (a Glow Puff now)
    const lanternOk = sw.lanterns.every(c => w.isSolid(c[0], c[1] + 1, c[2]));
    const keepsOk = w.keeps.every(k => k.name === 'bridge' || k.name === 'wizard' || !all.some(([, c]) => inBox({ x: c[0] + 0.5, y: c[1] + 0.5, z: c[2] + 0.5 }, k.protect[0])));
    return { puffs: d.puffs.length, sparks: d.sparks.length, floaters: d.floaters.length, puffMin, floatMin, floatBad: floatBad.length, cellBad: cellBad.slice(0, 3), lanternOk, keepsOk, flood: seen.size,
      sculptures: sw.sculptures.map(s => s.id + ':' + s.cells.length).join(' '), lanterns: sw.lanterns.length };
  });
  t.ok(decor.puffs <= 80 && decor.sparks <= 400 && decor.floaters === 18, `puffs ${decor.puffs} <= 80, sparks ${decor.sparks} <= 400, 18 floating oddities`);
  t.ok(decor.puffMin >= 10, `every nebula puff is 10+ blocks from every place you can stand above the sea (${decor.puffMin.toFixed(1)})`);
  t.ok(decor.floatMin >= 5 && decor.floatBad === 0, `every frame and wheel is 5+ blocks from the walkways and outside the door and the frames' view boxes (${decor.floatMin.toFixed(1)}, ${decor.floatBad} bad)`);
  t.ok(decor.cellBad.length === 0 && decor.lanternOk && decor.keepsOk, `sculptures and lanterns are outside lifts, keeps, frames and the door, off the paths, and each lantern hangs under a solid cell (${JSON.stringify(decor.cellBad)}) ${decor.sculptures}`);
  t.ok(decor.lanterns === 8 && decor.sculptures.split(' ').length === 6, `8 lanterns, 6 sculptures (${decor.sculptures})`);

  // 17. In the game: the sky follows the zone you stand in; the zone's name shows once; the gradient is on.
  const info = async (pos, wait = 1200) => {
    await Q.evaluate(pos => { const g = window.pokecraft, p = g.player; p.keys = {}; p.pos.set(...pos); p.vel.set(0, 0, 0); g.swirlSky.snap(); }, pos);
    await Q.waitForTimeout(wait);
    return Q.evaluate(async pos => {
      const g = window.pokecraft, { caveLight, swirlTint } = await import('/src/caves.js'), L = await import('/src/swirlland.js'), i = g.swirlSky.info();
      const want = L.zoneMix(pos[0], pos[2], 'fog'), c = g.scene.fog.color, hex = c.getHex(), got = [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
      return { zone: i.zone, objects: i.objects, tint: swirlTint.uTintOn.value, lit: caveLight.uLit.value, fogErr: Math.max(...want.map((v, k) => Math.abs(v - got[k]))), wLit: L.zoneMix(pos[0], pos[2], 'lit'), near: g.scene.fog.near, bg: g.scene.background.getHex() === hex, sky: i.weights };
    }, pos);
  };
  // (the earlier checks teleported about before any frame ran: start the sky afresh at the arrival, like a real trip)
  await Q.evaluate(() => { const g = window.pokecraft, p = g.player; p.keys = {}; p.pos.set(43.5, 21, 80.5); p.vel.set(0, 0, 0); g.camera.position.copy(p.eyePos); g.swirlSky.reset(g.world); window.__toasts = []; });
  await Q.waitForTimeout(1500);
  t.ok(await Q.evaluate(() => !window.__toasts.some(m => /Sherbet/.test(m))), 'the zone you arrive in is not announced');
  const arr = await info([43.5, 21, 80.5]);
  t.ok(arr.zone === 'sherbet' && arr.tint === 1 && arr.lit > 0.95, `at the arrival: Sherbet Sky, the gradient is on, full brightness (${arr.zone} ${arr.lit.toFixed(2)})`);
  t.ok(arr.objects.dome === 1 && arr.objects.puffs > 0 && arr.objects.puffs <= 80 && arr.objects.sparks > 0 && arr.objects.frames === 12 && arr.objects.wheels === 6, `the sky has a dome, puffs, sparks, 12 frames, 6 wheels (${JSON.stringify(arr.objects)})`);
  const mist = await info([48.5, 27, 55.5]);
  t.ok(mist.zone === 'mist' && Math.abs(mist.lit - 0.7) <= 0.05 && Math.abs(mist.lit - mist.wLit) < 0.03 && mist.fogErr < 0.06 && mist.bg && mist.near < 35, `on the north deck: Moonmilk Mist, dim (${mist.lit.toFixed(2)}), the fog colour follows (err ${mist.fogErr.toFixed(3)}, near ${mist.near.toFixed(0)})`);
  t.ok(await Q.evaluate(() => window.__toasts.filter(m => /Moonmilk Mist/.test(m)).length) === 1, 'a toast names the Moonmilk Mist, once');
  await info([48.5, 21, 80.5], 800);
  await info([48.5, 27, 55.5], 800);
  t.ok(await Q.evaluate(() => window.__toasts.filter(m => /Moonmilk Mist/.test(m)).length) === 1, 'walking back into the mist says nothing again (once per trip)');
  const sun = await info([48.5, 15, 106.5]);
  t.ok(sun.zone === 'sundrop' && sun.fogErr < 0.06 && sun.lit > 0.85, `on the south deck: Sundrop Shore (${sun.lit.toFixed(2)}, fog err ${sun.fogErr.toFixed(3)})`);
  const ink = await info([90.5, 21, 80.5]);
  t.ok(ink.zone === 'inkwell' && ink.sky.inkwell > 0.3 && ink.fogErr < 0.06, `out on the bridge: Inkwell Deep (weight ${ink.sky.inkwell.toFixed(2)})`);
  const names = await Q.evaluate(() => window.__toasts.slice());
  t.ok(['Sundrop Shore', 'Inkwell Deep'].every(n => names.some(m => m.includes(n))), `each zone shows its name (${names.join(' | ')})`);

  // 20. The lift streams change colour.
  const hue = await Q.evaluate(async () => { const m = window.pokecraft.scene.children.find(o => o.isMesh && o.material?.blending === 2 && o.material.map && o.geometry.type === 'BoxGeometry'); const a = m.material.color.getHex(); await new Promise(r => setTimeout(r, 2500)); return [a, m.material.color.getHex()]; });
  t.ok(hue[0] !== hue[1], `a lift stream slowly changes pastel colour (${hue[0].toString(16)} -> ${hue[1].toString(16)})`);

  // 21. Draw calls at the arrival facing east (loose: software numbers vary).
  await Q.evaluate(() => { const p = window.pokecraft.player; p.pos.set(43.5, 21, 80.5); p.vel.set(0, 0, 0); p.lookAt({ x: 90, y: 24, z: 80.5 }); window.pokecraft.swirlSky.snap(); });
  await Q.waitForTimeout(1500);
  const calls = await Q.evaluate(() => window.pokecraft.renderer.info.render.calls);
  t.ok(calls > 0 && calls <= 110, `draw calls at the arrival facing east: ${calls}`);

  // Screenshots: the frames, the bridge and the Wizard's tower, a lift, the hub and the stairs.
  const shot = async (name, pos, at) => {
    await Q.evaluate(([pos, at]) => {
      const p = window.pokecraft.player; p.keys = {};
      document.getElementById('toast').replaceChildren();
      p.pos.set(...pos); p.vel.set(0, 0, 0); p.lookAt({ x: at[0], y: at[1], z: at[2] });
    }, [pos, at]);
    await Q.waitForTimeout(1500);
    await Q.screenshot({ path: path.join(SHOTS, name) });
  };
  await shot('t38-swirl-frames.png', [37.5, 29, 64], [42, 31, 51]);
  await Q.evaluate(() => { window.pokecraft.stars = ['house', 'pirate']; });
  await shot('t38-swirl-bridge.png', [58.5, 21, 80.5], [100, 30, 80.5]);
  await shot('t38-swirl-lift.png', [66, 3, 109], [70, 10, 106]);
  await shot('t38-swirl-hub.png', [41, 24, 72], [52, 20, 82]);
  await shot('t38-swirl-wizard.png', [64, 22, 80.5], [112, 34, 80.5]);
  await shot('t38-swirl-stairs.png', [48.5, 27, 80], [48, 27, 62]);
  await Q.evaluate(() => { window.pokecraft.stars = []; });
  // 22. T38d screenshots (the sky snaps to where you stand first)
  const shotD = async (name, pos, at, stars = []) => {
    await Q.evaluate(([pos, at, stars]) => {
      const g = window.pokecraft, p = g.player; p.keys = {}; g.stars = stars;
      document.getElementById('toast').replaceChildren();
      p.pos.set(...pos); p.vel.set(0, 0, 0); p.lookAt({ x: at[0], y: at[1], z: at[2] }); g.swirlSky.snap();
    }, [pos, at, stars]);
    await Q.waitForTimeout(2500);
    await Q.evaluate(() => document.getElementById('toast').replaceChildren());
    await Q.screenshot({ path: path.join(SHOTS, name) });
  };
  await shotD('t38d-arrival.png', [43.5, 21, 80.5], [80, 24, 80.5]);
  await shotD('t38d-hub-back.png', [50, 21, 80.5], [14, 18, 80.5]);
  await shotD('t38d-mist.png', [34.5, 27, 55.5], [66, 31, 57]);
  await shotD('t38d-sundrop.png', [48.5, 15, 106.5], [70, 24, 128]);
  await shotD('t38d-inkwell.png', [58.5, 21, 80.5], [105, 32, 80.5], ['house']);
  await shotD('t38d-from-sea.png', [66, 3, 109], [60, 14, 100]);
  t.ok(Q.errors.length === 0, `no page errors after the looks (${Q.errors.slice(0, 3).join(' | ')})`);

  // 18. Clean-up: back through the door, the Swirl's gradient, sky and fog are gone.
  await Q.evaluate(() => { window.pokecraft.realms.leave('door'); });
  await mainOn(Q);
  const gone = await Q.evaluate(async () => {
    const g = window.pokecraft, { swirlTint } = await import('/src/caves.js');
    return { tint: swirlTint.uTintOn.value, left: g.scene.children.filter(o => o.userData.swirlSky).length, info: g.swirlSky.info(), fog: g.swirlSky.fog, bg: g.scene.background.getHex() };
  });
  t.ok(gone.tint === 0 && gone.left === 0 && gone.info === null && gone.fog === null, `back in the main world nothing of the Swirl's look is left (${JSON.stringify(gone)})`);
  t.ok(Q.errors.length === 0, `no page errors in the real Swirl (${Q.errors.slice(0, 3).join(' | ')})`);
  await Q.context().close();

  // 19. An old Swirl save (version 1): loads in the Swirl at the arrival, its edit on the hub is gone, the stars are kept.
  const oldSwirl = { seed: 4242, edits: [], size: [288, 368], pos: [112.5, 30, 112.5], yaw: 0, pitch: 0, time: 0.2, party: [], box: [], cubes: 10, badges: [], beaten: [], champion: true, savedAt: 1,
    stars: ['house'], place: 'swirl', realmPos: [48.5, 15, 106.5, 0, 0], realmVersions: { swirl: 1 }, realmEdits: { swirl: [[48 + 80 * 160 + 21 * 160 * 160, 9]] } };
  const P3 = await openGame(browser, base, { setup: seedSave(oldSwirl) });
  await continueGame(P3);
  await waitFor(P3, () => window.pokecraft.place === 'swirl' && !window.pokecraft.realms.busy);
  const os = await P3.evaluate(() => { const g = window.pokecraft, p = g.player.pos; g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { realm: g.world.realm?.id, d: Math.hypot(p.x - 43.5, p.z - 80.5), block: g.world.get(48, 21, 80), stars: g.stars.join(), v: s.realmVersions?.swirl, re: JSON.stringify(s.realmEdits?.swirl ?? []) }; });
  t.ok(os.realm === 'swirl' && os.d < 2 && os.block === 0 && os.stars === 'house' && os.v === 2 && os.re === '[]', `an old Swirl save loads in the new Swirl at the arrival, its edit dropped, the star kept (${JSON.stringify(os)})`);
  t.ok(P3.errors.length === 0, `no page errors (${P3.errors.slice(0, 3).join(' | ')})`);
  await P3.context().close();

  // 14. iPad: tapping the Portal Door takes you in, and the action button says "Step in!".
  const { devices } = await import('playwright');
  const T = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await T.tap('text=New Game');
  await T.tap('.starter >> nth=0');
  await T.waitForFunction(() => window.pokecraft.started, null, { timeout: 60000 });
  await T.evaluate(() => { window.pokecraft.champion = true; });
  await T.evaluate(lookAtDoor);
  await waitFor(T, () => document.getElementById('btn-act')?.textContent === 'Step in!');
  t.ok(true, 'on an iPad the action button says "Step in!" in front of the Portal Door');
  const spot = await T.evaluate(() => {
    const g = window.pokecraft, c = g.world.portal.surface[7], v = new g.player.eyePos.constructor(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5).project(g.camera);
    return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight];
  });
  await T.touchscreen.tap(spot[0], spot[1]);
  await swirlOn(T);
  t.ok(await T.evaluate(() => window.pokecraft.place === 'swirl'), 'tapping the Portal Door on an iPad takes a Champion into the Swirl');
  await T.waitForTimeout(1000);
  await T.screenshot({ path: path.join(SHOTS, 't38-swirl-ipad.png') });
  await T.evaluate(() => { const g = window.pokecraft, p = g.player; p.pos.set(40.5, 27, 55.5); p.vel.set(0, 0, 0); p.lookAt({ x: 62, y: 31, z: 50 }); g.swirlSky.snap(); document.getElementById('toast').replaceChildren(); });
  await T.waitForTimeout(2500);
  await T.evaluate(() => document.getElementById('toast').replaceChildren());
  await T.screenshot({ path: path.join(SHOTS, 't38d-ipad.png') });
  t.ok(T.errors.length === 0, `no page errors on the iPad (${T.errors.slice(0, 3).join(' | ')})`);
  await T.context().close();
}
