// Gym flow: leader refuses before the trainer is beaten; trainer then leader; badge awarded.
import { openGame, newGame, playBattle } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 1);
  t.ok(await page.evaluate(() => window.pokecraft.world.gyms.length === 18), '18 gyms are placed');
  await page.evaluate(async () => {
    const g = window.pokecraft;
    const { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('grovebeast', 30), makeCreature('zapple', 12)];
    const gym = g.world.gyms[0];
    const [fx, fz] = gym.front;
    g.player.pos.set(gym.x + 0.5 + fx * 4.5, gym.y, gym.z + 0.5 + fz * 4.5);
    document.exitPointerLock();
  });
  const npc = kind => `window.pokecraft.npcs.list.find(n => n.kind === '${kind}' && n.gym === window.pokecraft.world.gyms[0])`;
  await page.evaluate(`window.pokecraft.talkTo(${npc('leader')})`);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), 'leader refuses until the trainer is beaten');
  await page.evaluate(`window.pokecraft.talkTo(${npc('trainer')})`);
  t.ok(await playBattle(page), 'trainer battle finishes');
  await page.evaluate(`window.pokecraft.talkTo(${npc('leader')})`);
  t.ok(await playBattle(page), 'leader battle finishes');
  const s = await page.evaluate(() => ({ badges: window.pokecraft.badges, beaten: window.pokecraft.beaten }));
  t.ok(s.badges.includes('rock') && s.beaten.includes('rock:trainer'), 'Boulder Badge awarded');

  // The two newest gyms (needs the Bone and Alien creatures): trainer, then leader, for both.
  for (const [id, badge] of [['bone', 'Fossil'], ['alien', 'Saucer']]) {
    await page.evaluate(async gid => {
      const g = window.pokecraft;
      const { makeCreature } = await import('/src/species.js');
      g.party = [makeCreature('tidalord', 45), makeCreature('thunderwolf', 45)];
      const gym = g.world.gyms.find(x => x.def.id === gid);
      const [fx, fz] = gym.front;
      g.player.pos.set(gym.x + 0.5 + fx * 4.5, gym.y, gym.z + 0.5 + fz * 4.5);
      document.exitPointerLock();
    }, id);
    const who = kind => `window.pokecraft.npcs.list.find(n => n.kind === '${kind}' && n.gym.def.id === '${id}')`;
    t.ok(await page.evaluate(`!!${who('leader')} && !!${who('trainer')}`), `${badge} Gym has a trainer and a leader`);
    await page.evaluate(`window.pokecraft.talkTo(${who('leader')})`);
    t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)), `${badge} leader refuses until the trainer is beaten`);
    await page.evaluate(`window.pokecraft.talkTo(${who('trainer')})`);
    t.ok(await playBattle(page), `${badge} trainer battle finishes`);
    await page.evaluate(`window.pokecraft.talkTo(${who('leader')})`);
    t.ok(await playBattle(page), `${badge} leader battle finishes`);
    t.ok(await page.evaluate(gid => window.pokecraft.badges.includes(gid), id), `${badge} Badge awarded`);
  }
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
