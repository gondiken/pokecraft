// Gyms 17-18 (Fossil, Saucer) must not disturb old worlds or old saves: the first 16 gyms and the
// tower stay where they were, the rest of the world is block-for-block the same, old badges and the
// Champion title survive, and the tower asks for all 25 badges (since T19 also from old Champions, who keep the title).
import fs from 'node:fs';
import { GYMS } from '../../src/gyms.js';
import { openGame, click, seedSave, continueGame } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
// Where gyms 1-16 were recorded before the Fossil and Saucer gyms existed (same list as the champion spec).
const OLD_GYMS = {
  1: [[84, 101], [87, 152], [91, 57], [130, 55], [168, 138], [129, 178], [182, 90], [40, 92], [27, 127], [185, 52], [136, 19], [56, 31], [54, 197], [178, 197], [18, 181], [20, 24]],
  4242: [[115, 92], [80, 76], [66, 139], [167, 116], [94, 168], [104, 48], [138, 177], [175, 175], [34, 65], [198, 76], [84, 205], [53, 33], [156, 16], [30, 200], [198, 26], [17, 23]],
};
// Where the two new gyms go, and a FNV-1a checksum of every block outside their 37x37 boxes
// (measured with the old code too: identical).
const EXTRA = { 1: [[206, 164], [96, 206]], 4242: [[16, 118], [206, 140]] };
const SUM = { 1: 1681420519, 4242: 3236083087 };
// T8: the Fossil Gym moved into a cave and the caves got a second, bigger layer. Without them ({ bigCaves: false,
// caveGyms: false }) every block outside the two legacy boxes is still exactly SUM (old caves, gyms 1-16, tower, plants).
// FNV-1a of the surface height of every column outside the new holes, arches, lamp posts and the old Fossil box,
// measured with the old code too (identical): the hills look the same.
// T10 (gyms 19-22) also leaves out world.newGymBoxes (the boxes the four new gyms may change), so this number changed.
const SURF = { 1: 595959614, 4242: 4175453469 };
// T10: FNV-1a of every block of the full world outside world.newGymBoxes, measured with the T8 code (boxes from the
// new code) and with the new code: identical. Without the new gyms ({ newGyms: false }) SUM above still holds.
// Wave 6: the Saucer Gym floats in the sky, and its 18-block box joined world.newGymBoxes, so SUM22 and SURF were
// measured again, the same way: the old code (with the Saucer box left out too) and the new code agree.
const SUM22 = { 1: 3934547195, 4242: 2033726684 };

// A save from before the two gyms: `badges` = the first 16 gym ids; the Champion title is optional.
function oldSave(champion) {
  const ids = ['rock', 'bug', 'toxic', 'water', 'pixie', 'grass', 'electric', 'sound', 'metal', 'mind', 'fire', 'ice', 'cosmic', 'ghost', 'drake', 'rainbow'];
  return {
    seed: 4242, edits: [], yaw: 0, pitch: 0, time: 0.3, size: [224, 224],
    party: [{ uid: 'a', species: 'zapple', level: 40, xp: 64000, hp: 100, moves: ['tackle', 'spark'] }],
    box: [], cubes: 12, badges: ids, beaten: champion ? ['tower:guard1', 'tower:guard2'] : [],
    champion, savedAt: 1,
  };
}

// Opens the game with a save in place and remembers every toast that appears.
function openWithSave(browser, base, save) {
  return openGame(browser, base, {
    setup: async ctx => {
      await seedSave(save)(ctx);
      await ctx.addInitScript(() => {
        window.__toasts = [];
        new MutationObserver(ms => {
          for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toasts.push(n.textContent);
        }).observe(document, { childList: true, subtree: true });
      });
    },
  });
}

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  let page = await openGame(browser, base);

  // 1. The world itself.
  const worlds = await page.evaluate(async seeds => {
    const { World, WORLD_W: W, WORLD_D: D, WORLD_H: H } = await import('/src/world.js');
    const { WOOL, B, TREASURE } = await import('/src/blocks.js');
    const out = {};
    for (const seed of seeds) {
      const plain = new World(seed, null, null);
      plain.generate({ bigCaves: false, caveGyms: false, newGyms: false, treasure: false });
      const spots = plain.extraGymSpots();
      let h = 2166136261;
      for (let y = 0; y < H; y++) for (let z = 0; z < 224; z++) for (let x = 0; x < 224; x++) { // the old 224 x 224 area (T17), indexed with the big map's stride
        if (spots.some(([sx, sz]) => Math.abs(x - sx) <= 18 && Math.abs(z - sz) <= 18)) continue;
        h = Math.imul(h ^ plain.data[x + W * (z + D * y)], 16777619) >>> 0;
      }
      let terrain = 0;
      for (let x = 0; x < 224; x += 3) for (let z = 0; z < 224; z += 3) terrain += plain.terrainHeight(x, z) * ((x * 7 + z) % 13 + 1);
      const w = new World(seed, null, null);
      w.generate();
      const inBox = (x, z, y) => w.newGymBoxes.some(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= b.y0 && y <= b.y1);
      // T20: treasure blocks only ever replace stone, so with them counted as stone the world is the old one.
      const asStone = id => (TREASURE.includes(id) ? B.STONE : id);
      let h22 = 2166136261;
      for (let y = 0; y < H; y++) for (let z = 0; z < 224; z++) for (let x = 0; x < 224; x++) {
        if (!inBox(x, z, y)) h22 = Math.imul(h22 ^ asStone(w.data[x + W * (z + D * y)]), 16777619) >>> 0;
      }
      const skip = new Uint8Array(W * D);
      const box = (cx, cz, r) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const x = cx + a, z = cz + b; if (x >= 0 && z >= 0 && x < W && z < D) skip[x + z * W] = 1; } };
      for (const c of w.caves.opened) box(c % W, Math.floor(c / W), 4);
      for (const c of w.caves.marks) box(c % W, Math.floor(c / W), 3);
      box(spots[0][0], spots[0][1], 18);
      for (let x = 0; x < 224; x++) for (let z = 0; z < 224; z++) if (inBox(x, z, 0)) skip[x + z * W] = 1;
      let surf = 2166136261;
      for (let x = 0; x < 224; x++) for (let z = 0; z < 224; z++) if (!skip[x + z * W]) surf = Math.imul(surf ^ w.surface(x, z).y, 16777619) >>> 0;
      const extra = w.gyms.slice(16, 18);
      const others = [...w.gyms.slice(0, 16).map(g => [g.x, g.z]), [w.tower.x, w.tower.z]];
      const gapOf = g => Math.min(...others.map(([x, z]) => Math.hypot(g.x - x, g.z - z)));
      out[seed] = {
        n: w.gyms.length, order: w.gyms.every((g, i) => g.def.id === ['rock', 'bug', 'toxic', 'water', 'pixie', 'grass', 'electric', 'sound', 'metal', 'mind', 'fire', 'ice', 'cosmic', 'ghost', 'drake', 'rainbow', 'bone', 'alien', 'light', 'paper', 'slime', 'sky', 'time', 'camo', 'cyber'][i]),
        old: w.gyms.slice(0, 16).map(g => [g.x, g.z]), reserved: spots[0], saucer: [extra[1].x, extra[1].z], h, h22, terrain, surf,
        types: extra.map(g => g.def.type), cave: extra.map(g => !!g.cave),
        gaps: extra.map(gapOf), middles: extra.map(g => Math.hypot(g.x - 112, g.z - 112)),
        roofs: extra.map(g => w.get(g.x + 5, g.y + 5, g.z + 5)),
        wool: [WOOL.bone, WOOL.alien],
      };
    }
    return out;
  }, [1, 4242]);
  for (const seed of [1, 4242]) {
    const w = worlds[seed];
    t.ok(w.n === 25 && w.order && JSON.stringify(w.old) === JSON.stringify(OLD_GYMS[seed]), `seed ${seed}: 25 gyms in order; gyms 1-16 are where they always were`);
    t.ok(JSON.stringify(w.reserved) === JSON.stringify(EXTRA[seed][0]) && JSON.stringify(w.saucer) === JSON.stringify(EXTRA[seed][1]), `seed ${seed}: the Saucer Gym stays at ${JSON.stringify(w.saucer)} (the old Fossil spot ${JSON.stringify(w.reserved)} is only reserved now)`);
    t.ok(w.h === SUM[seed] && (seed !== 4242 || w.terrain === 596409), `seed ${seed}: without the new caves and the cave gym every block outside the two legacy boxes is unchanged (checksum ${w.h}, terrain ${w.terrain})`);
    t.ok(w.h22 === SUM22[seed], `seed ${seed}: with the four new gyms every block outside their boxes is unchanged (checksum ${w.h22})`);
    t.ok(w.surf === SURF[seed], `seed ${seed}: the hills look the same outside the new entrances (surface checksum ${w.surf})`);
    t.ok(w.cave.join() === 'true,false' && w.gaps[0] >= 26 && w.middles[0] >= 28 && w.gaps[1] >= 30 && w.middles[1] >= 40,
      `seed ${seed}: the Fossil Gym is in a cave (${w.gaps[0].toFixed(0)} from the nearest gym or tower), the Saucer Gym is ${w.gaps[1].toFixed(0)} away`);
    t.ok(w.wool[0] === 37 && w.wool[1] === 38 && JSON.stringify(w.roofs) === JSON.stringify(w.wool) && w.types.join() === 'bone,alien',
      `seed ${seed}: bone and alien wool roofs (${w.roofs})`);
  }
  await page.context().close();

  // 2. An old Champion keeps the title and the tower; the arrow points at the new gyms.
  page = await openWithSave(browser, base, oldSave(true));
  await click(page, '#title-buttons button:has-text("Continue")');
  // The HUD (arrow, level bonus) refreshes from the game loop, which is slow under load.
  await page.waitForFunction(() => document.getElementById('guide').textContent && window.pokecraft.creatures.levelBonus,
    null, { timeout: 90000, polling: 500 }).catch(() => {});
  const champ = await page.evaluate(() => {
    const g = window.pokecraft;
    return {
      badges: g.badges.length, champion: g.champion, icons: document.querySelectorAll('#badges > *').length,
      lit: document.querySelectorAll('#badges > .got').length, title: !document.querySelector('#champion-title').classList.contains('hidden'),
      guide: document.getElementById('guide').textContent, toasts: window.__toasts.join(' | '), bonus: g.creatures.levelBonus,
    };
  });
  t.ok(champ.badges === 16 && champ.champion, 'the old Champion keeps 16 badges and the title');
  t.ok(champ.icons === 25 && champ.lit === 16 && champ.title, `badge HUD has ${champ.icons} icons with ${champ.lit} lit, and the Champion title shows`);
  t.ok(champ.guide.includes('Fossil Gym'), `the arrow leads to the Fossil Gym (${champ.guide})`);
  t.ok(/new gyms have appeared/i.test(champ.toasts), 'a toast tells the player about the new gyms');
  t.ok(champ.toasts.includes('The Fossil Gym moved into a big cave'), 'a toast says the Fossil Gym moved into a cave');
  t.ok(champ.bonus === 10, 'wild creatures still get +10 levels');
  await page.evaluate(() => document.exitPointerLock());
  const coach = await page.evaluate(() => {
    const g = window.pokecraft;
    const tw = g.world.tower, [fx, fz] = tw.front;
    g.player.pos.set(tw.x + 0.5 + fx * 3, tw.y, tw.z + 0.5 + fz * 3);
    g.talkTo(g.npcs.list.find(n => n.role === 'coach'));
    return { battle: g.inBattle, toast: document.querySelector('#toast').innerText };
  });
  t.ok(!coach.battle && coach.toast.includes('Welcome back, Champion') && coach.toast.includes('25') && coach.toast.includes('You have 16'),
    `since T19 Coach Dex refuses an old Champion with 16 badges, kindly (${coach.toast})`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 3. An old 16-badge player who is not Champion yet needs all 25.
  page = await openWithSave(browser, base, oldSave(false));
  await continueGame(page);
  await page.evaluate(() => {
    const g = window.pokecraft, tw = g.world.tower, [fx, fz] = tw.front;
    g.player.pos.set(tw.x + 0.5 + fx * 3, tw.y, tw.z + 0.5 + fz * 3);
    document.exitPointerLock();
    g.talkTo(g.npcs.list.find(n => n.role === 'guard1'));
  });
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), 'Guard Bram refuses with 16 badges');
  t.ok((await page.locator('#toast').innerText()).includes('25 badges'), 'the refusal asks for 25 badges');
  const open = await page.evaluate(async () => {
    const g = window.pokecraft;
    const { GYMS } = await import('/src/gyms.js');
    g.badges = GYMS.map(x => x.id);
    g.talkTo(g.npcs.list.find(n => n.role === 'guard1'));
    return g.inBattle;
  });
  t.ok(open, 'with all 25 badges Guard Bram battles');
  await page.context().close();

  // 3b. Someone who already has the Fossil Badge is not told that the gym moved.
  page = await openWithSave(browser, base, { ...oldSave(false), badges: [...oldSave(false).badges, 'bone'] });
  await continueGame(page);
  t.ok(!(await page.evaluate(() => window.__toasts.join(' | '))).includes('moved into a big cave'), 'no cave toast for a player who already has the Fossil Badge');
  await page.context().close();

  // 3c. A player with the first 18 badges (not Champion) is told about the newest gyms and needs 25.
  const save18 = { ...oldSave(false), badges: [...oldSave(false).badges, 'bone', 'alien'] };
  page = await openWithSave(browser, base, save18);
  await click(page, '#title-buttons button:has-text("Continue")');
  await page.waitForFunction(() => document.getElementById('guide').textContent, null, { timeout: 90000, polling: 500 }).catch(() => {});
  const p18 = await page.evaluate(() => ({ toasts: window.__toasts.join(' | '), guide: document.getElementById('guide').textContent }));
  t.ok(p18.toasts.includes('7 new gyms have appeared'), `the 18-badge player is told about the 7 new gyms (${p18.toasts})`);
  t.ok(p18.guide.includes('Sunbeam Gym'), `the arrow points at the Sunbeam Gym (${p18.guide})`);
  await page.evaluate(() => {
    const g = window.pokecraft, tw = g.world.tower, [fx, fz] = tw.front;
    g.player.pos.set(tw.x + 0.5 + fx * 3, tw.y, tw.z + 0.5 + fz * 3);
    document.exitPointerLock();
    g.talkTo(g.npcs.list.find(n => n.role === 'guard1'));
  });
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)) && (await page.locator('#toast').innerText()).includes('25 badges'),
    'Guard Bram refuses the 18-badge player and asks for 25 badges');
  await page.context().close();

  // 3d. An old Champion with 18 badges keeps the title, but the whole tower waits for 25 badges (T19).
  page = await openWithSave(browser, base, { ...save18, champion: true, beaten: ['tower:guard1', 'tower:guard2'] });
  await continueGame(page);
  const coach18 = await page.evaluate(() => {
    const g = window.pokecraft, tw = g.world.tower, [fx, fz] = tw.front;
    g.player.pos.set(tw.x + 0.5 + fx * 3, tw.y, tw.z + 0.5 + fz * 3);
    document.exitPointerLock();
    g.talkTo(g.npcs.list.find(n => n.role === 'coach'));
    return { champion: g.champion, battle: g.inBattle, toast: document.querySelector('#toast').innerText };
  });
  t.ok(coach18.champion && !coach18.battle && coach18.toast.includes('Welcome back, Champion'), 'an 18-badge Champion keeps the title, but Coach Dex waits for 25 badges');
  await page.context().close();

  // 3e. A player with the first 22 badges is told about the three newest gyms by name, and the arrow leads to the first.
  const save22 = { ...oldSave(false), badges: GYMS.slice(0, 22).map(x => x.id) };
  page = await openWithSave(browser, base, save22);
  await click(page, '#title-buttons button:has-text("Continue")');
  await page.waitForFunction(() => document.getElementById('guide').textContent, null, { timeout: 90000, polling: 500 }).catch(() => {});
  const p22 = await page.evaluate(() => ({ toasts: window.__toasts.join(' | '), guide: document.getElementById('guide').textContent }));
  t.ok(p22.toasts.includes('New gyms have appeared: the Clock Tower, Hidden Hill and Firewall Maze! Follow the arrow.'), `the 22-badge player is told about the three new gyms (${p22.toasts})`);
  t.ok(p22.guide.includes('Clock Tower'), `the arrow points at the Clock Tower (${p22.guide})`);
  await page.context().close();

  // 4. Pictures: the Saucer Gym from a stone platform 22 blocks out from its door; the Fossil Gym's cavern
  // from the stairs (noon) and its arch from 8 blocks outside (day).
  page = await openGame(browser, base);
  await click(page, '#title-buttons button:has-text("New Game")');
  await page.waitForTimeout(500);
  await click(page, '.starter >> nth=0');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.pokecraft; g.creatures.clear(); g.creatures.trySpawnCave = () => {}; g.time = 0.25; });
  await page.evaluate(gid => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === gid), [fx, fz] = gym.front;
    const px = gym.x + fx * 22, pz = gym.z + fz * 22, y = gym.y + 6;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.world.set(px + x, y, pz + z, 3);
    g.player.pos.set(px + 0.5, y + 1, pz + 0.5);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: gym.x + 0.5, y: gym.y + 6, z: gym.z + 0.5 });
  }, 'alien');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: SHOTS + 'gym-alien.png' });
  // Inside the cavern, on the stairs 12 blocks from the gym's middle.
  const cave = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'bone'), [fx, fz] = gym.front;
    if (!gym.cave) return null;
    const d = 12, tread = gym.y - 1 + Math.floor((d - 9) / gym.cave.spot.rise);
    g.player.pos.set(gym.x + fx * d + 0.5, tread + 1, gym.z + fz * d + 0.5);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: gym.x + 0.5, y: gym.y + 3, z: gym.z + 0.5 });
    return { y: tread + 1 };
  });
  t.ok(cave, 'the Fossil Gym stands in a cave');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: SHOTS + 'cave-gym.png' });
  // The arch above the stairs, from 8 blocks outside.
  const arch = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, { raycastVoxel } = await import('/src/world.js');
    const gym = w.gyms.find(x => x.def.id === 'bone');
    if (!gym.cave) return null;
    const V = g.player.pos.constructor, [mx, my, mz] = gym.cave.mouth, [fx, fz] = gym.front;
    let best = null;
    for (const r of [8, 9, 7, 10, 6]) for (let a = 0; a < 16; a++) {
      const x = Math.floor(mx + 0.5 + Math.cos(a * Math.PI / 8) * r), z = Math.floor(mz + 0.5 + Math.sin(a * Math.PI / 8) * r);
      const s = w.surface(x, z);
      if ([0, 5, 6, 7, 15, 17, 18, 19, 40].includes(s.id)) continue;
      const eye = new V(x + 0.5, s.y + 1 + 1.62, z + 0.5), tgt = new V(mx + 0.5, my + 2, mz + 0.5);
      const d = tgt.clone().sub(eye), dist = d.length(); d.normalize();
      const blocked = !!raycastVoxel(w, eye, d, dist - 1.5);
      const diff = Math.abs(Math.atan2(z - mz, x - mx) - Math.atan2(fz, fx)) + (blocked ? 10 : 0); // a clear view is best, any view will do
      if (!best || diff < best.diff) best = { x, z, y: s.y, diff };
    }
    if (!best) return null;
    g.player.pos.set(best.x + 0.5, best.y + 1, best.z + 0.5); g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: mx + 0.5, y: my + 2, z: mz + 0.5 });
    return best;
  });
  t.ok(arch, 'found a clear view of the Fossil Gym arch');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: SHOTS + 'cave-gym-entrance.png' });
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
