// T31: realms. Pure checks (realm seed, Dream terrain from the seed, the main world untouched), sleeping in your own
// cozy home's Bed at night (day / other beds say no), there and back (Wake Stone, morning, a lost battle), save/load in
// the realm, an old save without `place`, and two browsers (same place: see each other and share blocks; different
// places: hidden, no cross edits, the guest's edit waits for the host's main world).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, openGame, openPair, newGame, pause, click, continueGame, waitFor, seedSave } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

// A cozy house on a stone slab at y = 42 near the start (all five features), your home, at night. Returns its cells.
const HOUSE = async () => {
  const g = window.pokecraft, { B, WOOL } = await import('/src/blocks.js'), ht = await import('/src/hometypes.js');
  const s = g.spawnPoint, F = 42;
  const free = (x0, z0) => { for (let x = -2; x < 14; x += 3) for (let z = -2; z < 14; z += 3) for (let y = F; y <= F + 13; y += 3) if (g.world.protectedAt(x0 + x, y, z0 + z)) return false; return true; };
  let X0 = null, Z0 = null;
  search: for (let r = 0; r < 120; r += 8) for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
    const x = Math.floor(s.x) + 6 + dx, z = Math.floor(s.z) - 14 + dz;
    if (x > 2 && z > 2 && x < 200 && z < 200 && free(x, z)) { X0 = x; Z0 = z; break search; }
  }
  for (let x = -2; x < 14; x++) for (let z = -2; z < 14; z++) { g.world.set(X0 + x, F, Z0 + z, B.STONE); for (let y = 1; y <= 12; y++) g.world.set(X0 + x, F + y, Z0 + z, B.AIR); }
  const ex = ht.boxHouse({ w: 10, d: 10, wall: B.PLANKS, roof: B.PLANKS, floor: B.PLANKS });
  const at = (x, y, z, id) => g.world.set(X0 + x, F + y, Z0 + z, id);
  for (const [x, y, z, id] of ex.blocks) at(x, y, z, id);
  at(1, 1, 8, B.BED); at(5, 2, 9, B.FIREPLACE); at(5, 4, 5, B.LAMP); at(0, 2, 5, B.GLASS); at(9, 2, 5, B.GLASS);
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) at(5 + dx, 0, 4 + dz, WOOL.cozy);
  at(-1, 1, -1, B.BED); // a bed outside any home
  const mat = [X0 + ex.mat[0], F, Z0 + ex.mat[2]];
  g.homes.place(...mat);
  g.player.pos.set(X0 + 3.5, F + 1, Z0 + 6.5); g.player.vel.set(0, 0, 0);
  g.time = 0.75; // midnight
  window.__toasts = [];
  const toast = g.ui.toast.bind(g.ui);
  g.ui.toast = m => { window.__toasts.push(m); toast(m); };
  return { bed: [X0 + 1, F + 1, Z0 + 8], outside: [X0 - 1, F + 1, Z0 - 1], mat, edit: [X0 + 12, F, Z0 + 12] };
};

// A checksum of the main world; gym "live" blocks (doors that open by the clock, lasers, vault lights) count as air.
const sum = () => {
  const d = window.pokecraft.world.data, live = new Set([57, 58, 59, 60, 61, 62, 63, 64, 73, 74, 48, 69, 9, 83, 84, 85, 92, 93, 89, 90, 95, 96, 97, 98, 99, 100, 101, 102, 124, 125]); // T38a: the Portal Door is drawn per player
  // Gyms with live parts redraw ordinary blocks too (the course's timed blocks turn into air, the maze's exit door opens with
  // the badge): skip their whole boxes.
  const w = window.pokecraft.world, boxes = w.gyms.filter(g => g.def.live && g.protect?.length).map(g => g.protect[0]);
  const inCourse = i => { const x = i % w.W, z = Math.floor(i / w.W) % w.D; return boxes.some(c => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1); };
  let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + (live.has(d[i]) || inCourse(i) ? 0 : d[i])) | 0; return h;
};
const sleep = async (page, bed) => {
  await page.evaluate(b => { const g = window.pokecraft; g.realms.useBed({ x: b[0], y: b[1], z: b[2], id: 71 }); }, bed);
  const asked = await page.evaluate(() => window.pokecraft.ui.asking && document.getElementById('ask-text').textContent);
  await page.evaluate(() => window.pokecraft.ui.askYes());
  await waitFor(page, () => window.pokecraft.place === 'dream' && !window.pokecraft.realms.busy);
  return asked;
};

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);

  // 6. Pure: the realm seed, the Dream island from the seed, the main World has no realm.
  const pure = await page.evaluate(async () => {
    const R = await import('/src/realms.js'), { World } = await import('/src/world.js'), { B } = await import('/src/blocks.js');
    const make = seed => { const w = new World(R.realmSeed(seed, R.REALMS.dream.seedSalt), null, null, R.REALMS.dream.size, R.REALMS.dream); w.generate(); return w; };
    const h = w => { let x = 0; for (let i = 0; i < w.data.length; i++) x = (x * 31 + w.data[i]) | 0; return x; };
    const a = make(1234), b = make(1234), c = make(99);
    return {
      seed: R.realmSeed(1234, 0xd2ea) === R.realmSeed(1234, 0xd2ea) && R.realmSeed(1234, 0xd2ea) !== R.realmSeed(1235, 0xd2ea),
      same: h(a) === h(b), differ: h(a) !== h(c), size: [a.W, a.D], wake: a.get(...a.wake) === B.WAKE_STONE,
      biome: a.biome(5, 5), gyms: a.gyms.length, tower: a.tower, arrive: a.surface(128, 128).y > 15,
      mainRealm: window.pokecraft.world.realm, realmOf: R.realmOf('nope') === null && R.realmOf('dream') === R.REALMS.dream,
      clean: JSON.stringify(R.cleanRealmEdits({ dream: [[5, 3], ['x', 1], [-1, 2]], moon: [[1, 1]] }, { dream: 2 })),
      cleanOld: JSON.stringify(R.cleanRealmEdits({ dream: [[5, 3]] })), cleanOld1: JSON.stringify(R.cleanRealmEdits({ dream: [[5, 3]] }, { dream: 1 })),
    };
  });
  t.ok(pure.seed, 'realmSeed is a pure function of the main seed');
  t.ok(pure.same && pure.differ, 'the Dream island is the same for the same seed and different for another');
  t.ok(pure.size.join() === '256,256' && pure.wake && pure.biome === 'dream' && pure.gyms === 1 && pure.tower === null && pure.arrive, `the Dream realm: 256x256, a Wake Stone, biome dream, one gym (${JSON.stringify(pure)})`);
  t.ok(pure.mainRealm === null && pure.realmOf, 'the main world has no realm; realmOf knows only real realms');
  t.ok(pure.clean === '{"dream":[[5,3]]}', `realmEdits from a save keep only good entries of known realms of the right version (${pure.clean})`);
  t.ok(pure.cleanOld === '{}' && pure.cleanOld1 === '{}', `old (version 1) Dream edits are dropped (${pure.cleanOld} ${pure.cleanOld1})`);

  // 1. There and back.
  await newGame(page); await pause(page);
  const H = await page.evaluate(HOUSE);
  await waitFor(page, () => window.pokecraft.homes.mine()?.types.includes('cozy'));
  t.ok(true, 'the test house is a finished cozy home');
  await page.evaluate(([x, y, z]) => window.pokecraft.world.set(x, y, z, 11), H.edit); // a main-world edit to keep
  const before = await page.evaluate(sum);
  await page.evaluate(b => { const g = window.pokecraft; g.time = 0.25; g.realms.useBed({ x: b[0], y: b[1], z: b[2], id: 71 }); g.time = 0.75; }, H.bed);
  await page.evaluate(b => window.pokecraft.realms.useBed({ x: b[0], y: b[1], z: b[2], id: 71 }), H.outside);
  const no = await page.evaluate(() => ({ toasts: window.__toasts.slice(), asking: window.pokecraft.ui.asking, place: window.pokecraft.place }));
  t.ok(no.toasts.includes('You can only dream at night.') && no.toasts.includes('To dream, sleep in the Bed of your own cozy home.') && !no.asking && no.place === 'main',
    `by day, or in a bed outside your cozy home, you only get a toast (${no.toasts.join(' | ')})`);
  const asked = await sleep(page, H.bed);
  t.ok(asked === 'Go to sleep and dream?', `your own cozy home's bed at night asks first ("${asked}")`);
  const there = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player.pos;
    g.updateGuide();
    return { size: [g.world.W, g.world.D], realm: g.world.realm?.id, px: p.x, pz: p.z, npcs: g.npcs.list.length, homes: g.homes.list.length,
      guide: document.getElementById('guide').textContent, stash: g.realms.stash.edits.length, mainSave: JSON.parse(JSON.stringify(g.save && (() => { g.save(); return JSON.parse(localStorage.getItem('pokecraft-save-v2')); })())) };
  });
  t.ok(there.realm === 'dream' && there.size.join() === '256,256' && Math.abs(there.px - 128.5) < 1 && Math.abs(there.pz - 128.5) < 1, `you arrive in the Dream realm at its middle (${JSON.stringify(there.size)} ${there.px},${there.pz})`);
  t.ok(there.npcs === 4 && there.homes === 0 && /Upside-Down House/.test(there.guide), `the gym's 3 people and Healer Stella, no homes; the guide follows the way to the gym ("${there.guide}")`);
  const sv = there.mainSave;
  t.ok(sv.party?.length === 1 && Array.isArray(sv.badges) && !!sv.playerId, 'the save made in the dream still has the team, badges and player id');
  t.ok(sv.realmVersions?.dream === 2, 'a save made in the dream says which version of the Dream it was');
  t.ok(sv.place === 'dream' && Array.isArray(sv.realmPos) && sv.homes.length === 1 && sv.edits.some(([, b]) => b === 11) && Math.hypot(sv.pos[0] - H.bed[0] - 0.5, sv.pos[2] - H.bed[2] - 0.5) < 2,
    'the save keeps the main world (edits, homes, pos beside the bed) and says where you are');
  // building in the dream: a broken block; a Doormat is refused
  const dreamEdit = await page.evaluate(async () => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js'), w = g.world, [x, , z] = [w.wake[0] - 8, 0, w.wake[2] + 3], y = w.surface(x, z).y;
    g.breakBlock({ x, y, z, id: w.get(x, y, z) });
    g.hotbar[g.selected] = B.DOORMAT;
    const x2 = x - 2, y2 = w.surface(x2, z).y;
    g.placeBlock({ x: x2, y: y2, z, normal: [0, 1, 0], id: w.get(x2, y2, z) });
    return { cell: [x, y, z], air: w.get(x, y, z) === 0, mat: w.get(x2, y2 + 1, z) === B.DOORMAT, toast: window.__toasts.at(-1) };
  });
  t.ok(dreamEdit.air && !dreamEdit.mat && /No homes in dreams/.test(dreamEdit.toast), `you can dig in the dream, but not put a Doormat down ("${dreamEdit.toast}")`);
  await page.evaluate(() => { window.pokecraft.player.yaw = -Math.PI / 2; window.pokecraft.player.pitch = -0.15; });
  await page.evaluate(() => { document.getElementById('pause').classList.add('hidden'); document.getElementById('toast').replaceChildren(); });
  await page.waitForTimeout(1500);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, 't31-dream.png') });
  // the Wake Stone
  await page.evaluate(() => { const g = window.pokecraft, w = g.world; g.breakBlock({ x: w.wake[0], y: w.wake[1], z: w.wake[2], id: w.get(...w.wake) }); });
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);
  const back = await page.evaluate(([b, e]) => {
    const g = window.pokecraft, p = g.player.pos;
    return { size: g.world.W, d: Math.hypot(p.x - b[0] - 0.5, p.z - b[2] - 0.5), dy: Math.abs(p.y - b[1]), edit: g.world.get(...e), home: g.homes.mine()?.types.includes('cozy'),
      dream: (g.realmEdits.dream || []).length, toast: window.__toasts.at(-1) };
  }, [H.bed, H.edit]);
  t.ok(back.size === 288 && back.d < 2 && back.dy < 1.5, `the Wake Stone wakes you beside your bed (dist ${back.d.toFixed(2)})`);
  t.ok(back.edit === 11 && back.home, 'the main world kept its edit and your cozy home');
  t.ok(back.dream === 1, `the dream's own edit is kept for next time (${back.dream})`);
  t.ok(await page.evaluate(sum) === before, 'the main world is block for block the same after the trip');

  // morning and a lost battle wake you too
  await sleep(page, H.bed);
  await page.evaluate(() => { window.pokecraft.time = 0.1; });
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);
  t.ok(await page.evaluate(() => window.__toasts.includes('Good morning! The gym will wait for you tonight.')), 'the morning wakes you up (the gym waits for tonight)');
  await page.evaluate(() => { const g = window.pokecraft; g.badges.push('dream'); g.time = 0.75; });
  await sleep(page, H.bed);
  await page.evaluate(() => { window.__toasts = []; window.pokecraft.time = 0.1; });
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);
  t.ok(await page.evaluate(() => window.__toasts.includes('Good morning! You woke up in your bed.')), 'with the Wonder Badge the morning toast is the plain one');
  await page.evaluate(() => { const g = window.pokecraft; g.badges = g.badges.filter(b => b !== 'dream'); });
  await page.evaluate(() => { window.pokecraft.time = 0.75; });
  await sleep(page, H.bed);
  await page.evaluate(() => window.pokecraft.onBattleEnd('lost', {}));
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);
  const lost = await page.evaluate(b => { const p = window.pokecraft.player.pos; return Math.hypot(p.x - b[0] - 0.5, p.z - b[2] - 0.5); }, H.bed);
  t.ok(lost < 2, `losing a battle in the dream wakes you beside your bed (${lost.toFixed(2)})`);

  // 2. Save and load in the realm (a new page on the same browser).
  await sleep(page, H.bed);
  await page.evaluate(() => { const g = window.pokecraft; g.player.pos.x += 2; g.save(); });
  const want = await page.evaluate(() => window.pokecraft.player.pos.toArray());
  await page.reload();
  await page.waitForFunction(() => window.pokecraft?.world);
  await continueGame(page);
  const loaded = await page.evaluate(([c, w]) => { const g = window.pokecraft, p = g.player.pos; return { place: g.place, realm: g.world.realm?.id, cell: g.world.get(...c), d: Math.hypot(p.x - w[0], p.z - w[2]) }; }, [dreamEdit.cell, want]);
  t.ok(loaded.place === 'dream' && loaded.realm === 'dream' && loaded.d < 1.5, `a save made in the dream loads in the dream, where you were (${JSON.stringify(loaded)})`);
  t.ok(loaded.cell === 0, 'the block you broke in the dream is still broken');
  await page.evaluate(() => window.pokecraft.realms.leave('stone'));
  await waitFor(page, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);
  t.ok(await page.evaluate(sum) === before && await page.evaluate(e => window.pokecraft.world.get(...e) === 11, H.edit), 'after loading, waking up gives the same main world');
  t.ok(page.errors.length === 0, `no page errors (${page.errors.slice(0, 3).join(' | ')})`);
  await page.context().close();

  // 3. An old save without `place` loads in the main world, unchanged.
  const old = { seed: 4242, edits: [], size: [288, 288], pos: [112.5, 30, 112.5], yaw: 0, pitch: 0, time: 0.2, party: [], box: [], cubes: 10, badges: [], beaten: [], savedAt: 1 };
  const P2 = await openGame(browser, base, { setup: seedSave(old) });
  await continueGame(P2);
  const o = await P2.evaluate(() => { const g = window.pokecraft; g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { place: g.place, W: g.world.W, seed: g.world.seed, sp: s.place, re: s.realmEdits }; });
  t.ok(o.place === 'main' && o.W === 288 && o.seed === 4242 && o.sp === undefined && JSON.stringify(o.re) === '{}', `an old save loads in the main world (${JSON.stringify(o)})`);
  await P2.context().close();

  // 4. Two browsers.
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await waitFor(B, () => window.pokecraft.mp.role === 'guest', null, 60000);
  const HA = await A.evaluate(HOUSE);
  await waitFor(A, () => window.pokecraft.homes.mine()?.types.includes('cozy'));
  await B.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; window.__toasts = []; const toast = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); toast(m); }; g.player.pos.copy(a.target).add({ x: 2, y: 0, z: 0 }); });
  await waitFor(B, () => [...window.pokecraft.mp.others.values()][0]?.model.visible);
  // same place: a block goes across
  const s1 = await A.evaluate(() => { const g = window.pokecraft, p = g.player.pos, x = Math.floor(p.x) + 2, y = Math.floor(p.y) + 3, z = Math.floor(p.z); g.world.set(x, y, z, 11); g.mp.sendBlock(x, y, z, 11); return [x, y, z]; });
  await waitFor(B, c => window.pokecraft.world.get(...c) === 11, s1);
  t.ok(true, 'in the same place: the guest sees the host and gets the host\'s block');
  // the guest can't dream in the host's world
  await B.evaluate(b => window.pokecraft.realms.useBed({ x: b[0], y: b[1], z: b[2], id: 71 }), HA.bed);
  t.ok(await B.evaluate(() => window.pokecraft.place === 'main' && window.__toasts.some(m => /your own world/.test(m))), 'a guest gets a toast instead of dreaming');
  // the host dreams: hidden from the guest, a toast, no cross edits
  await sleep(A, HA.bed);
  await waitFor(B, () => { const a = [...window.pokecraft.mp.others.values()][0]; return a && !a.here && !a.model.visible; });
  t.ok(await B.evaluate(() => window.__toasts.some(m => /Dad fell asleep/.test(m))), 'the guest is told the host is dreaming');
  t.ok(await B.evaluate(() => { const g = window.pokecraft, o = g.player.eyePos.clone(), a = [...g.mp.others.values()][0]; return !g.mp.pick(o, a.pos.clone().setY(a.pos.y + 1).sub(o).normalize(), 50); }), 'the dreaming host can\'t be picked by the guest');
  const s2 = await B.evaluate(() => { const g = window.pokecraft, p = g.player.pos, x = Math.floor(p.x) + 1, y = Math.floor(p.y) + 4, z = Math.floor(p.z) + 1; g.world.set(x, y, z, 9); g.mp.sendBlock(x, y, z, 9); return [x, y, z]; });
  const s3 = await A.evaluate(() => { const g = window.pokecraft, w = g.world, x = w.wake[0] - 4, z = w.wake[2] - 4, y = w.surface(x, z).y + 1; w.set(x, y, z, 11); g.mp.sendBlock(x, y, z, 11); return [x, y, z]; });
  await A.waitForTimeout(1500);
  t.ok(await A.evaluate(c => window.pokecraft.world.get(...c) !== 9, s2) && await B.evaluate(c => window.pokecraft.world.get(...c) !== 11, s3), 'edits do not cross between the dream and the main world');
  await A.evaluate(() => window.pokecraft.realms.leave('stone'));
  await waitFor(A, () => window.pokecraft.place === 'main' && !window.pokecraft.realms.busy);
  t.ok(await A.evaluate(c => window.pokecraft.world.get(...c) === 9, s2), 'the guest\'s edit made while the host dreamed is there when the host wakes up');
  await waitFor(B, () => [...window.pokecraft.mp.others.values()][0]?.model.visible);
  t.ok(await B.evaluate(() => window.__toasts.some(m => /Dad woke up/.test(m))), 'the guest sees the host again after waking up');
  t.ok(A.errors.length === 0 && B.errors.length === 0, `no page errors (${[...A.errors, ...B.errors].slice(0, 3).join(' | ')})`);
  await A.context().close(); await B.context().close();
}
