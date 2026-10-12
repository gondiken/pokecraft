// Cosmic and Sound types: moves, creatures, wild spawns, wool roofs and a gym each.
import { openGame, newGame, playBattle } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  const info = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const { GYMS } = await import('/src/gyms.js');
    const { WOOL } = await import('/src/blocks.js');
    const out = {};
    for (const type of ['cosmic', 'sound']) {
      const mons = Object.entries(S.SPECIES).filter(([, s]) => s.type === type).map(([id]) => id);
      const spawns = Object.values(S.SPAWNS).flat().map(e => e[0]);
      const moves = Object.values(S.MOVES).filter(m => m.type === type).length;
      const gym = GYMS.find(g => g.type === type);
      const teams = gym ? [...gym.trainerTeam, ...gym.leaderTeam].every(([id, l]) => S.SPECIES[id] && l > 0) : false;
      const learn = mons.every(id => S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === type));
      out[type] = { mons, everySpawns: mons.every(id => spawns.includes(id)), moves, gym: gym?.name, teams, learn,
        wool: !!WOOL[type], color: !!S.TYPE_COLORS[type] };
    }
    out.triangle = [S.effectiveness('cosmic', 'sound'), S.effectiveness('sound', 'mind'), S.effectiveness('mind', 'cosmic')];
    out.evolves = S.SPECIES.moonhop.evolve?.into === 'lunaroo' && S.SPECIES.drumbo.evolve?.into === 'bongorilla';
    return out;
  });
  for (const type of ['cosmic', 'sound']) {
    const i = info[type];
    t.ok(i.mons.length === 6, `${type}: 6 creatures (${i.mons.join(', ')})`);
    t.ok(i.everySpawns && i.learn && i.moves >= 4, `${type}: all spawn in the wild and learn ${type} moves`);
    t.ok(i.gym && i.teams && i.wool && i.color, `${type}: has the ${i.gym} with a wool roof`);
  }
  t.ok(info.triangle.every(x => x === 2), 'cosmic > sound > mind > cosmic');
  t.ok(info.evolves, 'Moonhop and Drumbo evolve');

  // Win at the Echo Gym with a strong team.
  await newGame(page, 0);
  await page.evaluate(async () => {
    const g = window.pokecraft;
    const { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('thunderwolf', 45), makeCreature('zapple', 40)];
    const gym = g.world.gyms.find(x => x.def.id === 'sound');
    const [fx, fz] = gym.front;
    g.player.pos.set(gym.x + 0.5 + fx * 4.5, gym.y, gym.z + 0.5 + fz * 4.5);
    document.exitPointerLock();
  });
  const npc = kind => `window.pokecraft.npcs.list.find(n => n.kind === '${kind}' && n.gym.def.id === 'sound')`;
  t.ok(await page.evaluate(`!!${npc('leader')} && !!${npc('trainer')}`), 'Echo Gym has a trainer and a leader');
  await page.evaluate(`window.pokecraft.talkTo(${npc('trainer')})`);
  t.ok(await playBattle(page), 'Echo Gym trainer battle finishes');
  await page.evaluate(`window.pokecraft.talkTo(${npc('leader')})`);
  t.ok(await playBattle(page), 'Echo Gym leader battle finishes');
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('sound')), 'Echo Badge awarded');
  const shown = await page.evaluate(() => [...document.querySelectorAll('#badges > *')].length);
  t.ok(shown === 18, `HUD shows 18 badge slots (${shown})`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
