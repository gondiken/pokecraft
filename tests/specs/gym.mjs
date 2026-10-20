// Gym flow: leader refuses before the trainer is beaten; trainer then leader; badge awarded.
import { openGame, newGame, playBattle, continueGame, waitFor, seedSave } from '../helpers.mjs';
import { GYMS as ALL_GYMS } from '../../src/gyms.js';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 1);
  t.ok(await page.evaluate(n => window.pokecraft.world.gyms.length === n, ALL_GYMS.length), `${ALL_GYMS.length} gyms are placed`);
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
  t.ok(await page.evaluate(() => JSON.stringify(window.pokecraft.battle.foes.map(c => [c.species, c.level])) === JSON.stringify(window.pokecraft.world.gyms[0].def.leaderTeam)
    && window.pokecraft.world.gyms[0].def.leaderTeam.length === 3), 'the first badge battle is unchanged: the leader\'s own team');
  t.ok(await playBattle(page), 'leader battle finishes');
  const s = await page.evaluate(() => ({ badges: window.pokecraft.badges, beaten: window.pokecraft.beaten }));
  t.ok(s.badges.includes('rock') && s.beaten.includes('rock:trainer'), 'Boulder Badge awarded');

  // Rematches (T28)
  t.ok(await page.evaluate(async () => {
    const { GYMS } = await import('/src/gyms.js');
    const { SPECIES } = await import('/src/species.js');
    const { rematchTeam, loadWins } = await import('/src/rematch.js');
    for (const def of GYMS) {
      let prev = null;
      for (let w = 0; w <= 30; w++) {
        const team = rematchTeam(def, w);
        if (team.length < 1 || team.length > 6 || team.length < (prev?.length || 0)) return `${def.id} w${w}: size ${team.length}`;
        if (team.some(([sp, l]) => !SPECIES[sp] || l > 55)) return `${def.id} w${w}: bad species or level`;
        const base = team.slice(team.length - def.leaderTeam.length);
        if (base.some(([, l], i) => l < def.leaderTeam[i][1])) return `${def.id} w${w}: base below badge level`;
        if (prev && prev.base.some((l, i) => base[i][1] < l)) return `${def.id} w${w}: level went down`;
        if (w === 0 && (team.length !== def.leaderTeam.length || base.some(([, l], i) => l !== Math.min(55, def.leaderTeam[i][1] + 3)))) return `${def.id}: wins 0 is not base + 3`;
        prev = { length: team.length, base: base.map(x => x[1]) };
      }
    }
    const rock = rematchTeam(GYMS[0], 1);
    if (rock.length !== 4) return 'boulder w1 size ' + rock.length;
    const vault = GYMS.find(g => g.id === 'treasure');
    const v = rematchTeam(vault, 30);
    if (v.length > 6 || v.some(x => x[1] !== 55)) return 'vault w30 ' + JSON.stringify(v);
    const ok = JSON.stringify(loadWins({ rock: 2, nope: 5, bug: -1, water: 'x', ice: 1.5 })) === '{"rock":2}'
      && JSON.stringify(loadWins(undefined)) === '{}' && JSON.stringify(loadWins([1])) === '{}';
    return ok ? true : 'loadWins';
  }) === true, 'rematch teams: sizes, levels, cap and loadWins');
  const heal = () => page.evaluate(async () => {
    const { statsFor } = await import('/src/species.js');
    for (const c of window.pokecraft.party) c.hp = statsFor(c).maxHp;
  });
  // Stand next to the leader like a real player (the question closes when you walk away).
  const near = () => page.evaluate(`(() => { const g = window.pokecraft, n = ${npc('leader')}; g.player.pos.set(n.pos.x + 1.5, n.pos.y, n.pos.z); document.exitPointerLock(); })()`);
  const askText = () => page.evaluate(() => (document.getElementById('ask').classList.contains('hidden') ? '' : document.getElementById('ask-text').textContent));
  await heal();
  await near();
  await page.evaluate(`window.pokecraft.talkTo(${npc('leader')})`);
  const q1 = await askText();
  t.ok(/rematch/i.test(q1) && q1.includes('level 11') && !(await page.evaluate(() => window.pokecraft.inBattle)), `the leader asks first: "${q1}"`);
  await page.screenshot({ path: 'screenshots/t28-ask-desktop.png' });
  await page.keyboard.press('KeyN');
  t.ok(!(await askText()) && !(await page.evaluate(() => window.pokecraft.inBattle)) && (await page.locator('#toast').innerText()).includes('Come back any time'), 'N says not now');
  const cubes0 = await page.evaluate(() => window.pokecraft.cubes);
  await near();
  await page.evaluate(`window.pokecraft.talkTo(${npc('leader')})`);
  await page.evaluate(`window.pokecraft.talkTo(${npc('leader')})`); // talking again = yes
  const r1 = await page.evaluate(() => ({ b: window.pokecraft.battle?.foes.map(c => c.level), boost: window.pokecraft.battle?.opts?.xpBoost ?? window.pokecraft.battle?.xpBoost }));
  t.ok(JSON.stringify(r1.b) === '[9,10,11]' && r1.boost === 1.5, `rematch 1: foes ${JSON.stringify(r1.b)}, xp boost ${r1.boost}`);
  t.ok(await playBattle(page), 'rematch 1 finishes');
  const w1 = await page.evaluate(() => ({ w: window.pokecraft.rematchWins.rock, cubes: window.pokecraft.cubes, saved: JSON.parse(localStorage.getItem('pokecraft-save-v2')).rematchWins, toast: document.getElementById('toast').innerText }));
  t.ok(w1.w === 1 && w1.cubes === cubes0 + 4 && w1.saved?.rock === 1 && w1.toast.includes('Rematch win 1'), `rematch win counted, +4 cubes, saved (${JSON.stringify(w1)})`);
  await page.evaluate(() => document.exitPointerLock());
  await heal();
  await near();
  await page.evaluate(`window.pokecraft.talkTo(${npc('leader')})`);
  const q2 = await askText();
  t.ok(q2.includes('level 14'), `second ask is harder: "${q2}"`);
  await page.evaluate(() => document.getElementById('ask-yes').click());
  const r2 = await page.evaluate(() => window.pokecraft.battle?.foes.map(c => c.level));
  t.ok(r2?.length === 4 && JSON.stringify(r2.slice(1)) === '[12,13,14]', `rematch 2 has an extra creature first: ${JSON.stringify(r2)}`);
  t.ok(await playBattle(page), 'rematch 2 finishes');
  t.ok(await page.evaluate(() => window.pokecraft.rematchWins.rock) === 2, 'second win counted');
  await page.evaluate(() => document.exitPointerLock());
  await heal();
  await near();
  await page.evaluate(`window.pokecraft.talkTo(${npc('leader')})`);
  t.ok(!!(await askText()), 'ask box open again');
  await page.evaluate(() => { const g = window.pokecraft; g.player.pos.x += 12; g.rematch.update(); });
  t.ok(!(await askText()), 'walking away closes the question');
  const oldSave = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('pokecraft-save-v2')); delete o.rematchWins; return o; });
  const pg2 = await openGame(browser, base, { setup: seedSave(oldSave) });
  await continueGame(pg2);
  const old = await pg2.evaluate(() => ({ w: JSON.stringify(window.pokecraft.rematchWins), badge: window.pokecraft.badges.includes('rock') }));
  t.ok(old.w === '{}' && old.badge, 'an old save has no rematch wins and keeps its badge');
  await pg2.evaluate(async id => {
    const g = window.pokecraft;
    const n = g.npcs.list.find(n => n.kind === 'leader' && n.gym === g.world.gyms[0]);
    g.player.pos.set(n.pos.x + 1.5, n.pos.y, n.pos.z);
    document.exitPointerLock();
    g.talkTo(n);
  });
  t.ok((await pg2.locator('#ask-text').innerText()).includes('level 11'), 'old save: first rematch ask says level 11');
  await pg2.context().close();

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

  // T23 Treasure Vault: locked until the three golden keys are found; then it is a normal gym with two trainers (the full checks
  // are in treasure-vault.mjs).
  const tv = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, gym = w.gyms.find(x => x.def.id === 'treasure'), [fx, fz] = gym.front;
    document.getElementById('toast').replaceChildren();
    g.player.pos.set(gym.x + 0.5 + fx * 9, gym.fy + 1, gym.z + 0.5 + fz * 9);
    g.updateGuide();
    const locked = document.getElementById('toast').innerText;
    const shut = gym.door.every(([x, y, z]) => w.get(x, y, z) === 74);
    for (const k of gym.keys) g.gymLive.hit({ x: k.chest[0], y: k.chest[1], z: k.chest[2], id: w.get(...k.chest) });
    g.gymLive.update(0.3);
    return { locked, shut, open: gym.door.every(([x, y, z]) => w.get(x, y, z) === 0), keys: g.keys.length };
  });
  t.ok(tv.locked.includes('Treasure Vault is locked') && tv.shut, `the Treasure Vault is locked at first (${tv.locked.replace(/\n/g, ' ')})`);
  t.ok(tv.keys === 3 && tv.open, 'with the three keys the vault door is open');
  const vt = (kind, i = 0) => `window.pokecraft.npcs.list.find(n => n.kind === '${kind}' && n.gym.def.id === 'treasure' && n.index === ${i})`;
  await page.evaluate(() => document.exitPointerLock());
  for (const [kind, i] of [['trainer', 0], ['trainer', 1], ['leader', 0]]) {
    await page.evaluate(`window.pokecraft.talkTo(${vt(kind, i)})`);
    t.ok(await playBattle(page), `Treasure Vault ${kind} ${i} battle finishes`);
  }
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('treasure')), 'Jackpot Badge awarded');

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
  // T23: the Cozy Gym moves into the owner's cozy home (no building).
  await cozyGym(page, t);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}

/* ------------------------------- the Cozy Gym ------------------------------- */

async function cozyGym(page, t) {
  // A slab with two example cozy houses (the second is 24 blocks east, for the "follows the Doormat" part).
  const setup = await page.evaluate(async () => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js'), { placeExample } = await import('/src/hometypes.js');
    const { GYMS } = await import('/src/gyms.js'), { makeCreature } = await import('/src/species.js');
    const s = g.spawnPoint, F = 42, W = 48, D = 16;
    const free = (x0, z0) => { for (let x = 0; x < W; x += 4) for (let z = 0; z < D; z += 4) for (let y = F; y <= F + 13; y += 3) if (g.world.protectedAt(x0 + x, y, z0 + z)) return false; return true; };
    let X0 = null, Z0 = null;
    search: for (let r = 0; r < 160; r += 8) for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
      const x = Math.floor(s.x) + 6 + dx, z = Math.floor(s.z) - 14 + dz;
      if (x > 2 && z > 2 && x + W < 220 && z + D < 220 && free(x, z)) { X0 = x; Z0 = z; break search; }
    }
    if (X0 === null) return { ok: false };
    for (let x = -2; x < W; x++) for (let z = -2; z < D + 2; z++) {
      g.world.set(X0 + x, F, Z0 + z, B.STONE);
      for (let y = 1; y <= 12; y++) g.world.set(X0 + x, F + y, Z0 + z, B.AIR);
    }
    const mat1 = placeExample(g.world, 'cozy', X0, F, Z0), mat2 = placeExample(g.world, 'cozy', X0 + 24, F, Z0);
    g.badges = GYMS.map(x => x.id).filter(id => id !== 'cozy');
    g.beaten = [];
    g.party = [makeCreature('tidalord', 70), makeCreature('thunderwolf', 70), makeCreature('grovebeast', 70)];
    g.book.caught = new Set();
    g.player.pos.set(X0 + 20, F + 1, Z0 + 12); g.player.vel.set(0, 0, 0);
    g.time = 0.25;
    window.__people = () => g.npcs.list.filter(n => n.gym?.def.id === 'cozy');
    window.__toastLog = [];
    const toast = g.ui.toast.bind(g.ui);
    g.ui.toast = m => { window.__toastLog.push(m); toast(m); };
    document.exitPointerLock();
    return { ok: true, mat1, mat2 };
  });
  t.ok(setup.ok, 'found a free patch for the cozy houses');
  if (!setup.ok) return;
  const { mat1, mat2 } = setup;

  // 1. No home at all: the people are away and the guide says to build one (no arrow).
  const before = await page.evaluate(() => {
    const g = window.pokecraft;
    g.updateGuide();
    return { away: window.__people().every(n => n.away), n: window.__people().length, target: g.guideTarget, text: document.getElementById('guide').textContent };
  });
  t.ok(before.n === 3 && before.away, 'before the home exists, the Cozy Gym people are away');
  t.ok(before.target === null && before.text.includes('build a cozy home'), `the guide says to build a cozy home, no arrow (${before.text})`);

  // 2. A cozy home, no cozy creatures caught yet: the guide counts them and points at the Doormat.
  const home = await page.evaluate(([mat1]) => {
    const g = window.pokecraft;
    const h = g.homes.place(...mat1);
    g.updateGuide();
    return { finished: h.finished && h.is('cozy'), target: g.guideTarget, text: document.getElementById('guide').textContent };
  }, [mat1]);
  t.ok(home.finished, 'the example home is finished (and cozy)');
  t.ok(home.text.includes('catch 3 cozy creatures (0/3)') && home.target && Math.abs(home.target[0] - (mat1[0] + 0.5)) < 1 && Math.abs(home.target[1] - (mat1[2] + 0.5)) < 1, `the guide counts cozy creatures and points at the Doormat (${home.text})`);
  t.ok(await page.evaluate(() => window.__people().every(n => n.away) && !window.pokecraft.homes.mine().gyms.length), 'with no creatures caught the people stay away');

  // 3. Three different cozy creatures in the Creature Book: they knock, then move in.
  await page.evaluate(() => { for (const id of ['snugbun', 'purrmit', 'pillowlamb']) window.pokecraft.book.caught.add(id); });
  await waitFor(page, () => window.pokecraft.homes.mine().gyms.includes('cozy'), null, 60000);
  const knock = await page.evaluate(() => ({ toast: window.__toastLog.join(' | '), played: window.pokecraft.sound.played.includes('knock') }));
  t.ok(knock.toast.includes('Knock knock! Leader Maple is at your door!') && knock.played, `they knock first (${knock.toast})`);
  await waitFor(page, () => window.pokecraft.gymLive.of('cozy').phase === '' && window.__toastLog.join('|').includes('moved into your cozy home'), null, 60000);
  const inside = await page.evaluate(() => {
    const g = window.pokecraft, h = g.homes.mine(), r = h.report;
    return window.__people().map(n => {
      const x = Math.floor(n.pos.x), y = Math.floor(n.pos.y), z = Math.floor(n.pos.z);
      return { name: n.name, away: n.away, visible: n.model.visible, inside: r.inside.some(([a, b]) => a === x && b === z), floor: g.world.get(x, y - 1, z) !== 0, air1: g.world.get(x, y, z) === 0, air2: g.world.get(x, y + 1, z) === 0 };
    });
  });
  t.ok(inside.length === 3 && inside.every(p => !p.away && p.visible && p.inside && p.floor && p.air1 && p.air2), `the leader and two trainers stand on free cells inside the home (${JSON.stringify(inside)})`);
  t.ok(await page.evaluate(() => window.__toastLog.join('|').includes('Leader Maple, Knitter Bea and Sleepy Sam moved into your cozy home! Talk to them to battle.')), 'the moving-in toast names the three of them');

  // 3b. A cozy home with gems is also a treasure home, and keeps the gym (T30.5): 14 gems in the back wall + 1 in the floor.
  const gems = await page.evaluate(async ([mat1]) => {
    const g = window.pokecraft, { B, TREASURE } = await import('/src/blocks.js');
    const X0 = mat1[0] - 4, Z0 = mat1[2] - 1, F = mat1[1];
    window.__toastLog.length = 0;
    const list = []; for (const x of [1, 2, 3, 4, 6, 7, 8]) for (const y of [1, 3]) list.push([x, y, 9]);
    list.push([2, 0, 2]);
    list.forEach(([x, y, z], i) => g.world.set(X0 + x, F + y, Z0 + z, TREASURE[i % 3]));
    return list.length;
  }, [mat1]);
  await waitFor(page, () => window.pokecraft.homes.mine().is('treasure') && window.pokecraft.homes.mine().is('cozy'), null, 30000);
  const gm = await page.evaluate(() => {
    const g = window.pokecraft, live = g.gymLive.of('cozy');
    return { n: g.homes.mine().types.join(), gyms: g.homes.mine().gyms.includes('cozy'), away: window.__people().some(n => n.away), chilly: live.chilly, log: window.__toastLog.join('|') };
  });
  t.ok(gems === 15 && gm.n === 'cozy,treasure' && gm.gyms && !gm.away && gm.chilly === false, `a cozy home with 15 gems is cozy and treasure and keeps the gym ${JSON.stringify(gm)}`);
  t.ok(gm.log.includes('Your home is a treasure home now!') && !gm.log.includes('Brr'), 'the treasure toast comes, nobody shivers');

  // A picture of the people in the home (from a few blocks in front of the leader, towards the door).
  await page.evaluate(() => {
    const g = window.pokecraft, h = g.homes.mine(), r = h.report, d = r.door[0];
    const c = window.__people().find(n => n.kind === 'leader').pos;
    const k = Math.hypot(d[0] + 0.5 - c.x, d[1] + 0.5 - c.z) || 1, back = Math.min(4, k * 0.7);
    const px = c.x + (d[0] + 0.5 - c.x) / k * back, pz = c.z + (d[1] + 0.5 - c.z) / k * back;
    g.player.pos.set(px, r.f + 1, pz); g.player.vel.set(0, 0, 0);
    g.player.yaw = Math.atan2(-(c.x - px), -(c.z - pz));
    g.player.pitch = -0.1;
    document.getElementById('pause').classList.add('hidden');
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: new URL('../screenshots/t23-cozy-people.png', import.meta.url).pathname }).catch(() => {});

  // 4. Chilly: a cozy home needs 3 of its 5 things, so first the Fireplace and the Lamp go (replaced by planks: it stays cozy
  // and nobody shivers), then the Bed goes: now it is not cozy. Nobody battles, the guide says it is chilly; with them back the battles work.
  const bed = await page.evaluate(async () => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js'), h = g.homes.mine();
    const found = [];
    for (let x = h.x - 12; x <= h.x + 12; x++) for (let z = h.z - 12; z <= h.z + 12; z++) for (let y = h.y; y <= h.y + 6; y++) {
      const id = g.world.get(x, y, z);
      if (id === B.BED || id === B.FIREPLACE || id === B.LAMP) found.push([x, y, z, id]);
    }
    for (const [x, y, z, id] of found) if (id !== B.BED) g.world.set(x, y, z, B.PLANKS);
    window.__toastLog.length = 0;
    return found;
  });
  await waitFor(page, () => window.pokecraft.homes.mine().resultOf('cozy').done === 3, null, 30000);
  t.ok(await page.evaluate(() => window.pokecraft.homes.mine().is('cozy') && !window.pokecraft.gymLive.of('cozy').chilly && !window.__toastLog.join('|').includes('Brr')), 'still cozy with 3 of 5 things: nobody shivers');
  await page.evaluate(async ([bed]) => { const { B } = await import('/src/blocks.js'); for (const [x, y, z, id] of bed) if (id === B.BED) window.pokecraft.world.set(x, y, z, B.AIR); }, [bed]);
  await waitFor(page, () => !window.pokecraft.homes.mine().is('cozy'), null, 30000);
  await waitFor(page, () => window.pokecraft.gymLive.of('cozy').chilly, null, 30000);
  t.ok(await page.evaluate(() => window.__toastLog.join('|').includes('Your home is not cozy any more')), 'the home says it is not cozy any more');
  const chilly = await page.evaluate(() => {
    const g = window.pokecraft, leader = window.__people().find(n => n.kind === 'leader');
    g.player.pos.set(leader.pos.x + 1.5, leader.pos.y, leader.pos.z);
    g.talkTo(leader);
    const toast = window.__toastLog[window.__toastLog.length - 1];
    g.updateGuide();
    return { toast, battle: g.inBattle, guide: document.getElementById('guide').textContent, still: g.homes.mine().gyms.includes('cozy') };
  });
  t.ok(chilly.toast.includes("Brr, it's chilly in here! Can you fix it?") && !chilly.battle, `the chilly leader will not battle (${chilly.toast})`);
  t.ok(await page.evaluate(() => { window.__people().forEach(n => window.pokecraft.talkTo(n)); return !window.pokecraft.inBattle; }), 'nobody battles while it is chilly');
  t.ok(chilly.guide.includes("it's chilly") && chilly.still, `the guide says it is chilly and the gym stays moved in (${chilly.guide})`);
  await page.evaluate(async ([bed]) => { window.__toastLog.length = 0; for (const [x, y, z, id] of bed) window.pokecraft.world.set(x, y, z, id); }, [bed]);
  await waitFor(page, () => window.pokecraft.homes.mine().finished && window.__toastLog.join('|').includes('Ahh, cozy again'), null, 60000);
  t.ok(true, 'with the furniture back the leader says thank you');
  const fight = async (kind, i) => {
    await page.evaluate(([kind, i]) => { const g = window.pokecraft, n = window.__people().find(n => n.kind === kind && (n.index || 0) === i); g.player.pos.set(n.pos.x + 1.5, n.pos.y, n.pos.z); g.talkTo(n); }, [kind, i]);
    return playBattle(page);
  };
  t.ok(await fight('trainer', 0), 'Knitter Bea battle finishes');
  t.ok(await fight('trainer', 1), 'Sleepy Sam battle finishes');
  t.ok(await fight('leader', 0), 'Leader Maple battle finishes');
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('cozy') && ['cozy:trainer', 'cozy:trainer2'].every(k => window.pokecraft.beaten.includes(k))), 'the Snuggle Badge is awarded');

  // 5. The people follow the Doormat: a Doormat in the second house moves the home (and the gym with it).
  await page.evaluate(([mat2]) => { document.exitPointerLock(); const g = window.pokecraft; g.player.pos.set(mat2[0] + 0.5, mat2[1] + 1, mat2[2] + 4.5); g.homes.place(...mat2); }, [mat2]);
  await waitFor(page, () => {
    const h = window.pokecraft.homes.mine(), r = h.report;
    return h.gyms.includes('cozy') && window.__people().every(n => !n.away && r.inside.some(([a, b]) => a === Math.floor(n.pos.x) && b === Math.floor(n.pos.z)));
  }, null, 30000);
  t.ok(true, 'the Cozy Gym people followed the Doormat into the second house');

  // 6. Saved: the record keeps `gyms`, and Continue brings the people back. Breaking the Doormat sends them away.
  await page.evaluate(() => window.pokecraft.save());
  t.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')).homes?.[0]?.gyms?.join() === 'cozy'), 'the save keeps the moved-in gym on the home record');
  await page.reload();
  await continueGame(page);
  await waitFor(page, () => { const p = window.pokecraft.npcs.list.filter(n => n.gym?.def.id === 'cozy'); return p.length === 3 && p.every(n => !n.away); }, null, 60000);
  t.ok(await page.evaluate(() => window.pokecraft.homes.mine().gyms.includes('cozy')), 'after Continue the people are back in the home');
  await page.evaluate(async ([mat2]) => { const { B } = await import('/src/blocks.js'); window.pokecraft.world.set(...mat2, B.AIR); }, [mat2]);
  await waitFor(page, () => window.pokecraft.npcs.list.filter(n => n.gym?.def.id === 'cozy').every(n => n.away), null, 30000);
  t.ok(await page.evaluate(() => !window.pokecraft.homes.mine()), 'breaking the Doormat sends the Cozy Gym away');
}
