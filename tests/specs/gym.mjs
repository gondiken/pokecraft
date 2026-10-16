// Gym flow: leader refuses before the trainer is beaten; trainer then leader; badge awarded.
import { openGame, newGame, playBattle } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 1);
  t.ok(await page.evaluate(() => window.pokecraft.world.gyms.length === 25), '25 gyms are placed');
  t.ok(await page.evaluate(async () => {
    const { GYMS } = await import('/src/gyms.js');
    return window.pokecraft.world.gyms.every((g, i) => g.def === GYMS[i]);
  }), 'gyms are in GYMS order');

  // The Fossil Gym lives in a cavern under the hill; from its door you can walk up the stairs to the open sky.
  const caves = await page.evaluate(async seeds => {
    const { World, WORLD_W: W, WORLD_D: D } = await import('/src/world.js');
    const { B, isSolid } = await import('/src/blocks.js');
    const out = [];
    for (const seed of seeds) {
      const w = new World(seed, null, null);
      w.generate();
      const gym = w.gyms.find(g => g.def.id === 'bone');
      if (!gym.cave) { out.push({ seed, surface: true, y: gym.y }); continue; }
      const [fx, fz] = gym.front;
      const door = [gym.x + fx * 8, gym.y, gym.z + fz * 8];
      const stand = (x, y, z) => x >= 0 && z >= 0 && x < W && z < D && y >= 1 && !isSolid(w.get(x, y, z)) && !isSolid(w.get(x, y + 1, z)) && (isSolid(w.get(x, y - 1, z)) || w.get(x, y - 1, z) === B.WATER);
      const key = (x, y, z) => x + W * (z + D * y);
      const seen = new Set([key(...door)]), st = [door];
      let sky = false;
      while (st.length && !sky) {
        const [x, y, z] = st.pop();
        if (y >= w.ground[x + z * W] && w.skyAt(x, y + 1, z) === 1) { sky = true; break; }
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (Math.abs(nx - gym.x) > 60 || Math.abs(nz - gym.z) > 60) continue;
          const tries = [];
          if (!isSolid(w.get(x, y + 2, z))) tries.push(y + 1);
          tries.push(y, y - 1, y - 2, y - 3);
          for (const ny of tries) {
            if (!stand(nx, ny, nz) || seen.has(key(nx, ny, nz))) continue;
            seen.add(key(nx, ny, nz)); st.push([nx, ny, nz]);
            break;
          }
        }
      }
      const ground = w.ground[gym.x + gym.z * W];
      out.push({
        seed, y: gym.y, under: w.ground[door[0] + door[2] * W] - gym.y, inside: w.skyAt(gym.x, gym.y, gym.z), cavern: w.skyAt(gym.x + fz * 10, gym.y, gym.z + fx * 10),
        here: w.gymAt(gym.x, gym.z, gym.y)?.def.id, hill: w.gymAt(gym.x, gym.z, ground + 1)?.def.id ?? null, any: w.gymAt(gym.x, gym.z)?.def.id, sky,
        lit: w.inLitRoom({ x: gym.x + 0.5, y: gym.y, z: gym.z + 0.5 }),
      });
    }
    return out;
  }, [1, 4242, 99, 123456, 777, 7, 122]);
  for (const c of caves) {
    if (c.seed === 122) { t.ok(c.surface, 'seed 122 has no room for a cavern: the Fossil Gym is built on the surface'); continue; }
    t.ok(!c.surface && c.y === 3 && c.under >= 9 && c.inside === 1 && c.cavern < 0.5 && c.here === 'bone' && c.hill === null && c.any === 'bone' && c.lit && c.sky,
      `seed ${c.seed}: the Fossil Gym is a cave gym (floor ${c.y}, ${c.under} blocks of hill over its door, bright inside ${c.inside}, cavern ${c.cavern.toFixed(2)}), gymAt checks the height, and the stairs lead to the sky`);
  }
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
    if (id === 'alien') { // the Saucer people only come at night
      await page.evaluate(() => { window.pokecraft.time = 0.75; });
      await page.waitForFunction(() => window.pokecraft.night, null, { timeout: 60000, polling: 300 });
    }
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

  // T19: the three newest gyms have two trainers each (index 0 keeps the old beaten key, the second gets `:trainer2`);
  // the leader asks for both. The Firewall Maze's talkTo does not depend on its rooms, so its whole flow is fought here.
  const two = await page.evaluate(async () => {
    const g = window.pokecraft, { trainersOf, trainerKey } = await import('/src/gyms.js');
    return ['time', 'camo', 'cyber'].map(id => {
      const gym = g.world.gyms.find(x => x.def.id === id);
      const tr = g.npcs.list.filter(n => n.kind === 'trainer' && n.gym === gym);
      return { id, n: tr.length, idx: tr.map(n => n.index), defs: trainersOf(gym.def).length, keys: [trainerKey(gym.def, 0), trainerKey(gym.def, 1)], pos: gym.trainerPositions.length, protect: !!gym.protect?.length, area: !!gym.area };
    });
  });
  for (const x of two) {
    t.ok(x.n === 2 && x.idx.join() === '0,1' && x.defs === 2 && x.pos === 2 && x.protect && x.area && x.keys[0] === `${x.id}:trainer` && x.keys[1] === `${x.id}:trainer2`,
      `${x.id}: two trainers (keys ${x.keys.join(', ')}), two positions, protected, with an area`);
  }
  await page.evaluate(async () => {
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('tidalord', 70), makeCreature('thunderwolf', 70), makeCreature('grovebeast', 70)];
    const gym = g.world.gyms.find(x => x.def.id === 'cyber');
    const [fx, fz] = gym.front;
    g.player.pos.set(gym.x + 0.5 + fx * 4.5, gym.y, gym.z + 0.5 + fz * 4.5);
    document.exitPointerLock();
  });
  const cy = (kind, i = 0) => `window.pokecraft.npcs.list.find(n => n.kind === '${kind}' && n.gym.def.id === 'cyber' && n.index === ${i})`;
  await page.evaluate(`window.pokecraft.talkTo(${cy('trainer')})`);
  t.ok(await playBattle(page), 'Coder Kit battle finishes');
  await page.evaluate(`window.pokecraft.talkTo(${cy('leader')})`);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)) && (await page.locator('#toast').innerText()).includes('Beat Gamer Zed first'), 'Leader Ada asks for the second trainer too');
  await page.evaluate(`window.pokecraft.talkTo(${cy('trainer', 1)})`);
  t.ok(await playBattle(page), 'Gamer Zed battle finishes');
  t.ok(await page.evaluate(() => ['cyber:trainer', 'cyber:trainer2'].every(k => window.pokecraft.beaten.includes(k))), 'both Firewall Maze trainers are remembered');
  await page.evaluate(`window.pokecraft.talkTo(${cy('trainer', 1)})`);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)) && (await page.locator('#toast').innerText()).includes('waiting in the server room'), 'a beaten trainer says where the leader is');
  await page.evaluate(async () => { // like a visit to Healer Hana before the leader
    const { statsFor } = await import('/src/species.js');
    for (const c of window.pokecraft.party) c.hp = statsFor(c).maxHp;
  });
  await page.evaluate(`window.pokecraft.talkTo(${cy('leader')})`);
  t.ok(await playBattle(page), 'Leader Ada battle finishes');
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('cyber')), 'Circuit Badge awarded');

  // The arrow: on the hill it points at the stairs, down the stairs it points at the gym.
  const guide = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, { GYMS } = await import('/src/gyms.js');
    g.badges = GYMS.slice(0, 16).map(x => x.id);
    const gym = w.gyms.find(x => x.def.id === 'bone');
    if (!gym.cave) return null;
    const [mx, my, mz] = gym.cave.mouth, [fx, fz] = gym.front;
    const out = {};
    const at = (x, z, y) => { g.player.pos.set(x + 0.5, y, z + 0.5); g.updateGuide(); return { target: g.guideTarget, text: document.getElementById('guide').textContent }; };
    // 30 blocks out, on the surface.
    const ox = Math.round(mx - fx * 30), oz = Math.round(mz - fz * 30);
    out.far = at(ox, oz, w.surface(ox, oz).y + 1);
    out.mouth = [mx, mz];
    out.near = at(mx, mz, w.ground[mx + mz * 288] + 1);
    // down the stairs
    const d = 16, tread = gym.y - 1 + Math.floor((d - 9) / gym.cave.spot.rise);
    out.stairs = at(gym.x + fx * d, gym.z + fz * d, tread + 1);
    out.gym = [gym.x + 0.5, gym.z + 0.5];
    out.at = at(gym.x, gym.z, gym.y);
    return out;
  });
  t.ok(guide, 'the Fossil Gym has a mouth to point at');
  if (guide) {
    t.ok(guide.far.target[0] === guide.mouth[0] + 0.5 && guide.far.target[1] === guide.mouth[1] + 0.5 && guide.far.text.includes('in a cave'), `on the hill the arrow points at the stairs (${guide.far.text})`);
    t.ok(guide.near.text.includes('down these stairs'), `at the arch: ${guide.near.text}`);
    t.ok(guide.stairs.target[0] === guide.gym[0] && guide.stairs.target[1] === guide.gym[1] && guide.stairs.text.includes('Fossil Gym'), `on the stairs the arrow points at the gym (${guide.stairs.text})`);
    t.ok(guide.at.text.includes('is here'), `in the gym: ${guide.at.text}`);
  }
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
