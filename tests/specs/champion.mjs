// The Champion's Tower: placement in every world, refusing before all 25 badges (also for old Champions), guards, coach,
// the champion with Zenithar (powers up at half HP), saving, reloading and the rematch.
import fs from 'node:fs';
import { openGame, newGame, click, continueGame } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
// Gym positions recorded BEFORE the tower was added: gyms must never move in existing saves.
const GYM_POSITIONS = {
  1: [[84, 101], [87, 152], [91, 57], [130, 55], [168, 138], [129, 178], [182, 90], [40, 92], [27, 127], [185, 52], [136, 19], [56, 31], [54, 197], [178, 197], [18, 181], [20, 24]],
  4242: [[115, 92], [80, 76], [66, 139], [167, 116], [94, 168], [104, 48], [138, 177], [175, 175], [34, 65], [198, 76], [84, 205], [53, 33], [156, 16], [30, 200], [198, 26], [17, 23]],
};

// Plays a battle to the end, always using the strongest move. Returns false if still in battle.
async function finish(page, max = 400, each) {
  for (let i = 0; i < max; i++) {
    if (!(await page.evaluate(() => window.pokecraft.inBattle))) return true;
    if (each) await each();
    await page.evaluate(() => {
      const bs = [...document.querySelectorAll('#b-actions button:not([disabled])')];
      const power = b => Number(/power (\d+)/.exec(b.querySelector('small')?.textContent || '')?.[1] || 0);
      const best = bs.filter(b => power(b)).sort((a, b) => power(b) - power(a))[0] || bs[0];
      best?.click();
    });
    await page.waitForTimeout(700);
  }
  return false;
}

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);

  // 1. Every world has a tower, clear of the gyms, and gyms did not move.
  const worlds = await page.evaluate(async () => {
    const { World, WATER_LEVEL } = await import('/src/world.js');
    const { WOOL } = await import('/src/blocks.js');
    const out = [];
    for (const seed of [1, 7, 42, 4242, 99999, 123456, 2024, 31337]) {
      const w = new World(seed, null, null);
      w.generate();
      const tw = w.tower;
      const [fx, fz] = tw.front;
      out.push({
        seed, ok: !!tw, gyms: w.gyms.length,
        gap: Math.min(...w.gyms.map(g => Math.max(Math.abs(tw.x - g.x), Math.abs(tw.z - g.z)))),
        middle: Math.hypot(tw.x - 112, tw.z - 112),
        back: w.get(tw.x - 6 * fx, tw.y, tw.z - 6 * fz), spire: w.get(tw.x, tw.y + 14, tw.z),
        dry: tw.y - 1 > WATER_LEVEL,
        corners: w.gyms.filter(g => g.def.slot == null).every(g => [9, 6].includes(w.get(g.x + 6, g.y, g.z + 6)) || (g.def.id === 'alien' && w.get(g.x + 6, g.y, g.z + 6) === WOOL.metal)), // the Saucer's corners are metal
        pos: w.gyms.map(g => [g.x, g.z]),
      });
    }
    return out;
  });
  for (const w of worlds) {
    t.ok(w.ok && w.gyms === 25 && w.gap >= 23 && w.middle >= 17 && w.back === 42 && w.spire === 40 && w.dry && w.corners,
      `seed ${w.seed}: tower placed (gap ${w.gap}, ${w.middle.toFixed(0)} from the middle)`);
  }
  for (const seed of [1, 4242]) {
    const w = worlds.find(x => x.seed === seed);
    t.ok(JSON.stringify(w.pos.slice(0, 16)) === JSON.stringify(GYM_POSITIONS[seed]), `seed ${seed}: gyms are where they always were`);
  }

  // 2. A new game: spawn is outside the tower and five people live in it.
  await newGame(page, 0);
  const basics = await page.evaluate(() => {
    const g = window.pokecraft;
    return {
      spawnFree: !g.world.towerAt(g.spawnPoint.x, g.spawnPoint.z),
      roles: g.npcs.list.filter(n => n.role).map(n => n.role).sort(),
      towerKinds: g.npcs.list.filter(n => n.kind === 'tower').length,
    };
  });
  t.ok(basics.spawnFree, 'you do not start inside the tower');
  t.ok(basics.roles.length === 5 && basics.towerKinds === 4, `five people in the tower (${basics.roles.join(', ')})`);

  // Screenshot: the whole tower from outside (a stone platform 16 blocks out from the door).
  await page.evaluate(() => {
    const g = window.pokecraft, tw = g.world.tower, [fx, fz] = tw.front;
    const px = tw.x + fx * 22, pz = tw.z + fz * 22, y = tw.y + 6;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.world.set(px + x, y, pz + z, 3);
    g.player.pos.set(px + 0.5, y + 1, pz + 0.5);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: tw.x + 0.5, y: tw.y + 9, z: tw.z + 0.5 });
  });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: SHOTS + 'tower.png' });

  // 3. Before 25 badges everyone in the tower refuses politely (the nurse still heals).
  await page.evaluate(async () => {
    const g = window.pokecraft;
    const { GYMS } = await import('/src/gyms.js');
    g.badges = GYMS.slice(0, 24).map(x => x.id);
    const tw = g.world.tower, [fx, fz] = tw.front;
    g.player.pos.set(tw.x + 0.5 + fx * 3, tw.y, tw.z + 0.5 + fz * 3);
    g.player.vel.set(0, 0, 0);
    document.exitPointerLock();
  });
  const person = role => `window.pokecraft.npcs.list.find(n => n.role === '${role}')`;
  for (const role of ['guard1', 'coach', 'champion']) {
    await page.evaluate(`window.pokecraft.talkTo(${person(role)})`);
    t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), `${role} refuses with 24 badges`);
  }
  t.ok((await page.locator('#toast').innerText()).includes('25 badges'), 'the refusal says how many badges are needed');
  // Also with 22 badges (what a player had before the three newest gyms), and an old Champion is refused too (T19).
  for (const champion of [false, true]) {
    await page.evaluate(async champion => {
      const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
      g.badges = GYMS.slice(0, 22).map(x => x.id);
      g.champion = champion;
    }, champion);
    for (const role of ['guard1', 'coach', 'champion']) {
      await page.evaluate(`window.pokecraft.talkTo(${person(role)})`);
      t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), `${role} refuses ${champion ? 'an old Champion' : 'a player'} with 22 badges`);
    }
    const msg = await page.locator('#toast').innerText();
    t.ok(msg.includes('25 badges') && msg.includes('You have 22') && (!champion || msg.includes('Welcome back, Champion')), `the refusal asks for 25 badges${champion ? ' and welcomes the Champion back' : ''}`);
  }
  await page.evaluate(() => { window.pokecraft.champion = false; });

  // 4. Nurse Poppy heals the team.
  await page.evaluate(`(() => { const g = window.pokecraft; g.party.forEach(c => { c.hp = 1; }); g.talkTo(${person('nurse')}); })()`);
  t.ok(await page.evaluate(async () => {
    const { statsFor } = await import('/src/species.js');
    return window.pokecraft.party.every(c => c.hp === statsFor(c).maxHp);
  }), 'Nurse Poppy heals the team');

  // 5. With all 25 badges and a strong team: guards in order, then the champion.
  await page.evaluate(async () => {
    const g = window.pokecraft;
    const { GYMS } = await import('/src/gyms.js');
    const { makeCreature } = await import('/src/species.js');
    g.badges = GYMS.map(x => x.id);
    g.party = ['titanox', 'spectrion', 'stormwyvern', 'visionelk', 'bongorilla', 'blazehound'].map(s => makeCreature(s, 60));
    g.cubes = 10;
  });
  const heal = () => page.evaluate(`window.pokecraft.talkTo(${person('nurse')})`);
  for (const role of ['champion', 'guard2']) {
    await page.evaluate(`window.pokecraft.talkTo(${person(role)})`);
    t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), `${role} refuses until the guard before is beaten`);
  }
  await page.evaluate(`window.pokecraft.talkTo(${person('guard1')})`);
  t.ok(await finish(page), 'Guard Bram battle finishes');
  await page.evaluate(`window.pokecraft.talkTo(${person('guard2')})`);
  t.ok(await finish(page), 'Guard Opal battle finishes');
  t.ok(await page.evaluate(() => ['tower:guard1', 'tower:guard2'].every(k => window.pokecraft.beaten.includes(k))), 'both guards stay beaten');

  // Screenshot: inside, with the champion in sight.
  await page.evaluate(() => {
    const g = window.pokecraft, tw = g.world.tower, [fx, fz] = tw.front;
    g.player.pos.set(tw.x + 0.5 + fx * 1, tw.y, tw.z + 0.5 + fz * 1);
    g.player.vel.set(0, 0, 0);
    const c = g.npcs.list.find(n => n.role === 'champion');
    g.player.lookAt({ x: c.pos.x, y: c.pos.y + 1.2, z: c.pos.z });
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOTS + 'tower-inside.png' });

  await heal();
  await page.evaluate(`window.pokecraft.talkTo(${person('champion')})`);
  t.ok(await page.evaluate(() => window.pokecraft.inBattle && window.pokecraft.battle.boss), 'the champion battle starts as a boss battle');
  let shot = false;
  const beaten = await finish(page, 700, async () => {
    if (shot) return;
    if (await page.evaluate(() => window.pokecraft.battle.foeIdx === 5 && window.pokecraft.battle.foeModel?.visible)) {
      await page.waitForTimeout(1500);
      await page.screenshot({ path: SHOTS + 'champion-battle.png' });
      shot = true;
    }
  });
  t.ok(beaten, 'champion battle finishes');
  t.ok(shot, 'Zenithar was sent out last');
  const after = await page.evaluate(() => ({
    champion: window.pokecraft.champion, powered: window.pokecraft.battle.poweredUp, cubes: window.pokecraft.cubes,
    title: !document.querySelector('#champion-title').classList.contains('hidden'),
    celebrate: !!document.getElementById('celebrate'),
  }));
  t.ok(after.champion && after.powered, 'you are the Champion, and Zenithar powered up on the way');
  t.ok(after.title && after.celebrate, 'the Champion title shows and the celebration plays');
  t.ok(after.cubes >= 30, `rewards: ${after.cubes} Capture Cubes`);

  // Zenithar close up.
  const png = await page.evaluate(async () => (await import('/src/ui.js')).portrait('zenithar', 520, 440));
  fs.writeFileSync(SHOTS + 'zenithar.png', Buffer.from(png.split(',')[1], 'base64'));

  // 6. Coach Dex: three creatures at the lead's level, double XP.
  await heal();
  await page.evaluate(`window.pokecraft.talkTo(${person('coach')})`);
  const coach = await page.evaluate(() => ({ inBattle: window.pokecraft.inBattle, levels: window.pokecraft.battle.foes?.map(c => c.level), boost: window.pokecraft.battle.xpBoost }));
  t.ok(coach.inBattle && coach.levels.length === 3 && coach.levels.every(l => l >= 46 && l <= 47) && coach.boost === 2,
    `Coach Dex brings 3 creatures at level ${coach.levels} with double XP`);
  t.ok(await finish(page), 'Coach Dex battle finishes');

  // 7. Saved, and it survives a reload; the champion can be fought again.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  t.ok(saved.champion === true && saved.beaten.includes('tower:guard1') && saved.beaten.includes('tower:guard2'), 'the win is in the save');
  await page.reload();
  await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  await continueGame(page);
  t.ok(await page.evaluate(() => window.pokecraft.champion && !document.querySelector('#champion-title').classList.contains('hidden')), 'still the Champion after a reload');
  // The HUD refreshes every 0.5 game seconds, which takes a while with software rendering.
  const guided = await page.waitForFunction(() => document.getElementById('guide').textContent.includes('Champion'), null, { timeout: 40000 }).then(() => true, () => false);
  t.ok(guided, 'the guide says Champion');
  await page.evaluate(`document.exitPointerLock(); window.pokecraft.talkTo(${person('champion')})`);
  const rematch = await page.evaluate(() => ({ inBattle: window.pokecraft.inBattle, lv: window.pokecraft.battle.foes?.[0]?.level }));
  t.ok(rematch.inBattle && rematch.lv === 46, `rematch: Solenne's first creature is Lv ${rematch.lv}`);

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
