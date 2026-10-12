// Gyms 17-18 (Fossil, Saucer) must not disturb old worlds or old saves: the first 16 gyms and the
// tower stay where they were, the rest of the world is block-for-block the same, old badges and the
// Champion title survive, and the tower asks for 18 badges only from players who are not Champion yet.
import fs from 'node:fs';
import { openGame, click } from '../helpers.mjs';

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
    setup: ctx => ctx.addInitScript(json => {
      if (!sessionStorage.getItem('seeded')) { localStorage.setItem('pokecraft-save-v2', json); sessionStorage.setItem('seeded', '1'); }
      window.__toasts = [];
      new MutationObserver(ms => {
        for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toasts.push(n.textContent);
      }).observe(document, { childList: true, subtree: true });
    }, JSON.stringify(save)),
  });
}

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  let page = await openGame(browser, base);

  // 1. The world itself.
  const worlds = await page.evaluate(async seeds => {
    const { World, WORLD_W: W, WORLD_D: D, WORLD_H: H } = await import('/src/world.js');
    const { WOOL } = await import('/src/blocks.js');
    const out = {};
    for (const seed of seeds) {
      const w = new World(seed, null, null);
      w.generate();
      const extra = w.gyms.slice(16);
      let h = 2166136261;
      for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
        if (extra.some(g => Math.abs(x - g.x) <= 18 && Math.abs(z - g.z) <= 18)) continue;
        h = Math.imul(h ^ w.data[x + W * (z + D * y)], 16777619) >>> 0;
      }
      const others = [...w.gyms.slice(0, 16).map(g => [g.x, g.z]), [w.tower.x, w.tower.z]];
      out[seed] = {
        n: w.gyms.length, old: w.gyms.slice(0, 16).map(g => [g.x, g.z]), extra: extra.map(g => [g.x, g.z]), h,
        types: extra.map(g => g.def.type),
        gap: Math.min(...extra.flatMap(g => others.map(([x, z]) => Math.hypot(g.x - x, g.z - z)))),
        middle: Math.min(...extra.map(g => Math.hypot(g.x - W / 2, g.z - D / 2))),
        roofs: extra.map(g => w.get(g.x + 5, g.y + 5, g.z + 5)),
        wool: [WOOL.bone, WOOL.alien],
      };
    }
    return out;
  }, [1, 4242]);
  for (const seed of [1, 4242]) {
    const w = worlds[seed];
    t.ok(w.n === 18 && JSON.stringify(w.old) === JSON.stringify(OLD_GYMS[seed]), `seed ${seed}: gyms 1-16 are where they always were`);
    t.ok(JSON.stringify(w.extra) === JSON.stringify(EXTRA[seed]), `seed ${seed}: Fossil and Saucer gyms at ${JSON.stringify(w.extra)}`);
    t.ok(w.h === SUM[seed], `seed ${seed}: every block outside the two new gyms is unchanged (checksum ${w.h})`);
    t.ok(w.gap >= 30 && w.middle >= 40, `seed ${seed}: new gyms are ${w.gap.toFixed(0)} from the nearest gym or tower and ${w.middle.toFixed(0)} from the middle`);
    t.ok(w.wool[0] === 37 && w.wool[1] === 38 && JSON.stringify(w.roofs) === JSON.stringify(w.wool) && w.types.join() === 'bone,alien',
      `seed ${seed}: bone and alien wool roofs (${w.roofs})`);
  }
  await page.context().close();

  // 2. An old Champion keeps the title and the tower; the arrow points at the new gyms.
  page = await openWithSave(browser, base, oldSave(true));
  await click(page, '#title-buttons button:has-text("Continue")');
  await page.waitForTimeout(3500);
  const champ = await page.evaluate(() => {
    const g = window.pokecraft;
    return {
      badges: g.badges.length, champion: g.champion, icons: document.querySelectorAll('#badges > *').length,
      lit: document.querySelectorAll('#badges > .got').length, title: !document.querySelector('#champion-title').classList.contains('hidden'),
      guide: document.getElementById('guide').textContent, toasts: window.__toasts.join(' | '), bonus: g.creatures.levelBonus,
    };
  });
  t.ok(champ.badges === 16 && champ.champion, 'the old Champion keeps 16 badges and the title');
  t.ok(champ.icons === 18 && champ.lit === 16 && champ.title, `badge HUD has ${champ.icons} icons with ${champ.lit} lit, and the Champion title shows`);
  t.ok(champ.guide.includes('Fossil Gym'), `the arrow leads to the Fossil Gym (${champ.guide})`);
  t.ok(champ.toasts.includes('New gyms have appeared'), 'a toast tells the player about the new gyms');
  t.ok(champ.bonus === 10, 'wild creatures still get +10 levels');
  await page.evaluate(() => document.exitPointerLock());
  const coach = await page.evaluate(() => {
    const g = window.pokecraft;
    const tw = g.world.tower, [fx, fz] = tw.front;
    g.player.pos.set(tw.x + 0.5 + fx * 3, tw.y, tw.z + 0.5 + fz * 3);
    g.talkTo(g.npcs.list.find(n => n.role === 'coach'));
    return g.inBattle;
  });
  t.ok(coach, 'Coach Dex still battles the old Champion (needs the Bone and Alien creatures: his 6th team uses them)');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 3. An old 16-badge player who is not Champion yet needs all 18.
  page = await openWithSave(browser, base, oldSave(false));
  await click(page, '#title-buttons button:has-text("Continue")');
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.pokecraft, tw = g.world.tower, [fx, fz] = tw.front;
    g.player.pos.set(tw.x + 0.5 + fx * 3, tw.y, tw.z + 0.5 + fz * 3);
    document.exitPointerLock();
    g.talkTo(g.npcs.list.find(n => n.role === 'guard1'));
  });
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), 'Guard Bram refuses with 16 badges');
  t.ok((await page.locator('#toast').innerText()).includes('18 badges'), 'the refusal asks for 18 badges');
  const open = await page.evaluate(async () => {
    const g = window.pokecraft;
    const { GYMS } = await import('/src/gyms.js');
    g.badges = GYMS.map(x => x.id);
    g.talkTo(g.npcs.list.find(n => n.role === 'guard1'));
    return g.inBattle;
  });
  t.ok(open, 'with all 18 badges Guard Bram battles');
  await page.context().close();

  // 4. Pictures of the two new gyms, from a stone platform 22 blocks out from each door.
  page = await openGame(browser, base);
  await click(page, '#title-buttons button:has-text("New Game")');
  await page.waitForTimeout(500);
  await click(page, '.starter >> nth=0');
  await page.waitForTimeout(1500);
  for (const id of ['bone', 'alien']) {
    await page.evaluate(gid => {
      const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === gid), [fx, fz] = gym.front;
      const px = gym.x + fx * 22, pz = gym.z + fz * 22, y = gym.y + 6;
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.world.set(px + x, y, pz + z, 3);
      g.player.pos.set(px + 0.5, y + 1, pz + 0.5);
      g.player.vel.set(0, 0, 0);
      g.player.lookAt({ x: gym.x + 0.5, y: gym.y + 6, z: gym.z + 0.5 });
    }, id);
    await page.waitForTimeout(4500);
    await page.screenshot({ path: SHOTS + `gym-${id}.png` });
  }
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
