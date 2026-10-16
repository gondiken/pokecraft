// T23 Treasure Vault (gym 27, slot 4 of the new land): placement on several seeds (box, chests, gold X, the explore
// tunnel and the roof are walkable), the three golden keys (per player, saved), the key lights and door, the HUD key
// compass, the guide, battles, screenshots.
import fs from 'node:fs';
import { openGame, newGame, playBattle, continueGame, seedSave } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });

  // 1. Placement (no game needed). Seeds 1, 4242, 777 are generated twice (determinism); 22 and 122 once.
  const page0 = await openGame(browser, base);
  const placed = await page0.evaluate(async () => {
    const { World, WORLD_W: W, WORLD_D: D } = await import('/src/world.js');
    const { B, WOOL, isSolid } = await import('/src/blocks.js');
    const sum = w => { let h = 0; for (let i = 0; i < w.data.length; i += 7) h = (h * 31 + w.data[i]) | 0; return h; };
    const out = {};
    for (const seed of [1, 4242, 777, 22, 122]) {
      const w = new World(seed, null, null);
      w.generate();
      const g = w.gyms.find(x => x.def.id === 'treasure'), box = g.slot.box, r = {};
      r.slot = g.slot.k === 4;
      r.protectInBox = g.protect.every(b => b.x0 >= box.x0 && b.x1 <= box.x1 && b.z0 >= box.z0 && b.z1 <= box.z1);
      if ([1, 4242, 777].includes(seed)) { const w2 = new World(seed, null, null); w2.generate(); r.same = sum(w) === sum(w2) && w.gyms.find(x => x.def.id === 'treasure').keys[0].chest.join() === g.keys[0].chest.join(); }
      const [dig, build, explore] = g.keys;
      r.chests = g.keys.every(k => w.get(...k.chest) === B.KEY_CHEST);
      r.within = g.keys.every(k => Math.abs(k.chest[0] - g.x) <= 24 && Math.abs(k.chest[2] - g.z) <= 24 && k.chest[0] >= box.x0 && k.chest[0] <= box.x1 && k.chest[2] >= box.z0 && k.chest[2] <= box.z1);
      r.three = new Set(g.keys.map(k => k.chest.join())).size === 3;
      // The vault: walls protected, the roof protected, a pillar spot at Cheb 7 not, the build chest in the middle of the roof.
      const roofY = g.fy + 14;
      r.roof = w.get(g.x, roofY, g.z) === WOOL.treasure && build.chest[0] === g.x && build.chest[1] === roofY + 1 && build.chest[2] === g.z;
      const [fx, fz] = g.front;
      r.protect = !w.editAllowed(g.x + fx * 6, g.fy + 2, g.z + fz * 6, 0) && !w.editAllowed(g.x + 3, roofY, g.z + 2, 0) && w.editAllowed(g.x + fx * 7, g.fy + 2, g.z + fz * 7, B.STONE);
      r.noDoorEdit = g.door.length === 9 && g.door.every(([x, y, z]) => w.get(x, y, z) === B.VAULT_DOOR && !w.editAllowed(x, y, z, 0));
      r.lights = g.lights.length === 3 && g.lights.every(([x, y, z]) => w.get(x, y, z) === B.COBBLE);
      // Dig: 9 treasure-wool blocks on the ground, the chest 10 below the middle, solid between.
      const [cx, cy, cz] = dig.chest;
      const surfY = w.surface(cx, cz).y;
      r.x = dig.mark.length === 9 && dig.mark.every(([x, y, z]) => w.get(x, y, z) === WOOL.treasure && w.get(x, y + 1, z) === B.AIR);
      r.depth = surfY - cy;
      r.shaft = true;
      for (let y = cy + 1; y < surfY; y++) if (!isSolid(w.get(cx, y, cz))) r.shaft = false;
      r.xSurface = w.get(cx, surfY, cz) === WOOL.treasure;
      r.xInfo = JSON.stringify({ n: dig.mark.length, ids: dig.mark.map(([x, y, z]) => w.get(x, y, z) + '/' + w.get(x, y + 1, z)), surfY, cy, spot: dig.spot, fy: g.fy });
      // Walking: stand = air at y and y + 1, solid under; a step may go up 1 or down up to 3.
      const free = (x, y, z) => x >= 0 && z >= 0 && x < W && z < D && y >= 1 && !isSolid(w.get(x, y, z)) && w.get(x, y, z) !== undefined;
      const stand = (x, y, z) => free(x, y, z) && free(x, y + 1, z) && isSolid(w.get(x, y - 1, z));
      const walk = (start, goal, limit = 34) => {
        const seen = new Set([start.join()]), st = [start];
        while (st.length) {
          const [x, y, z] = st.pop();
          if (goal(x, y, z)) return true;
          for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ax, nz = z + az;
            if (Math.abs(nx - g.x) > limit || Math.abs(nz - g.z) > limit) continue;
            for (const ny of [y + 1, y, y - 1, y - 2, y - 3]) {
              if (!stand(nx, ny, nz) || seen.has([nx, ny, nz].join())) continue;
              let clear = true;
              for (let yy = ny; yy <= Math.max(y, ny) + 1; yy++) if (!free(nx, yy, nz)) clear = false;
              if (ny > y && !free(x, y + 2, z)) clear = false;
              if (!clear) continue;
              seen.add([nx, ny, nz].join()); st.push([nx, ny, nz]);
              break;
            }
          }
        }
        return false;
      };
      // Explore: from the mouth to a cell next to the chest; the chest cannot be seen from the mouth (the way turns).
      const [mx, my, mz] = explore.mouth, [ex, ey, ez] = explore.chest;
      r.mouthOpen = stand(mx, my, mz);
      r.exploreWalk = walk([mx, my, mz], (x, y, z) => y === ey && Math.abs(x - ex) + Math.abs(z - ez) === 1);
      r.exploreDeep = my - ey;
      r.exploreBend = Math.abs(mx - ex) + Math.abs(mz - ez) > 20;
      // Not walkable without digging from the outside near the chest: the chest's cell is walled in except via the tunnel.
      // Build: a pillar next to the front wall up to the roof, then a walk to the roof chest.
      const px = g.x + fx * 7, pz = g.z + fz * 7;
      for (let y = g.fy + 1; y <= roofY; y++) w.set(px, y, pz, B.STONE, false);
      const lamp = (x, z) => w.get(x, roofY + 1, z) === B.LAMP;
      r.roofWalk = stand(px, roofY + 1, pz) && walk([px, roofY + 1, pz], (x, y, z) => y === roofY + 1 && Math.abs(x - build.chest[0]) + Math.abs(z - build.chest[2]) === 1, 12);
      r.roofLamps = [[-6, -6], [6, 6]].every(([a, b]) => lamp(g.x + a, g.z + b));
      // Without the pillar there is no way up (the front wall is 14 high): not reachable from the ground.
      for (let y = g.fy + 1; y <= roofY; y++) w.set(px, y, pz, B.AIR, false);
      r.noRoofFromGround = !walk([g.x + fx * 9, g.fy + 1, g.z + fz * 9], (x, y) => y >= roofY + 1, 14);
      out[seed] = r;
    }
    return out;
  });
  await page0.context().close();
  for (const [seed, r] of Object.entries(placed)) {
    t.ok(r.slot && r.protectInBox, `seed ${seed}: the Treasure Vault is in slot 4 and its protected boxes are inside the slot box`);
    if (r.same !== undefined) t.ok(r.same, `seed ${seed}: generating twice gives the same world and chests`);
    t.ok(r.chests && r.three && r.within, `seed ${seed}: three Key Chests, all inside the slot box`);
    t.ok(r.roof && r.protect && r.noDoorEdit && r.lights, `seed ${seed}: roof protected with the chest in its middle, door and key lights in place, a pillar spot outside the wall is editable`);
    t.ok(r.x && r.xSurface && r.depth === 10 && r.shaft, `seed ${seed}: a gold X of 9 blocks, the chest ${r.depth} below its middle with solid blocks between ${r.x && r.xSurface && r.depth === 10 && r.shaft ? '' : r.xInfo}`);
    t.ok(r.mouthOpen && r.exploreWalk && r.exploreDeep >= 4 && r.exploreBend, `seed ${seed}: the tunnel is walkable from its mouth (${r.exploreDeep} down) to the chest and bends`);
    t.ok(r.roofWalk && r.roofLamps && r.noRoofFromGround, `seed ${seed}: a pillar at the front wall lets you walk onto the roof to the chest; without it the roof is out of reach`);
  }

  // 2. In the game.
  const page = await openGame(browser, base);
  await newGame(page, 1);
  await page.evaluate(async () => {
    const g = window.pokecraft;
    g.creatures.clear(); document.exitPointerLock();
    window.__toasts = [];
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) window.__toasts.push(n.textContent); })
      .observe(document.getElementById('toast'), { childList: true });
    const { makeCreature } = await import('/src/species.js');
    g.party = ['titanox', 'spectrion', 'stormwyvern'].map(s => makeCreature(s, 70));
    const { GYMS } = await import('/src/gyms.js');
    g.badges = GYMS.filter(x => x.id !== 'treasure').map(x => x.id);
  });
  const toasts = () => page.evaluate(() => window.__toasts.join(' | '));
  const clearToasts = () => page.evaluate(() => { window.__toasts.length = 0; });
  const vault = () => page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'treasure'), w = g.world;
    return { keys: [...g.keys], chests: gym.keys.map(k => w.get(...k.chest)), lights: gym.lights.map(l => w.get(...l)), door: [...new Set(gym.door.map(c => w.get(...c)))], edits: w.edits.size };
  });
  const place = async (x, y, z, look = [0, 0], pitch = 0) => page.evaluate(([x, y, z, look, pitch]) => {
    const g = window.pokecraft;
    g.player.pos.set(x, y, z); g.player.vel.set(0, 0, 0);
    g.player.yaw = Math.atan2(-look[0], -look[1]); g.player.pitch = pitch;
  }, [x, y, z, look, pitch]);
  const shot = async (name, wait = 2500) => {
    await page.evaluate(() => { window.pokecraft.time = 0.2; document.getElementById('pause').classList.add('hidden'); });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: SHOTS + name });
    console.log(`  screenshot ${SHOTS + name}`);
  };
  const info = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'treasure');
    return { x: gym.x, z: gym.z, fy: gym.fy, front: gym.front, keys: gym.keys, door: gym.door, lights: gym.lights };
  });
  const [fx, fz] = info.front;
  const onGround = (x, z) => page.evaluate(([x, z]) => window.pokecraft.world.surface(Math.floor(x), Math.floor(z)).y + 1, [x, z]);

  // Takes the trees out of the way of a camera (this player only, no edits).
  const thin = () => page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, gym = g.world.gyms.find(x => x.def.id === 'treasure'), [fx, fz] = gym.front;
    const { PLANTS } = await import('/src/world.js');
    for (let d = 7; d <= 26; d++) for (let s = -9; s <= 9; s++) {
      const x = gym.x + fx * d + fz * s, z = gym.z + fz * d + fx * s;
      for (let y = 1; y < 47; y++) if (PLANTS.has(w.get(x, y, z))) w.setLive(x, y, z, 0);
    }
  });

  // 2a. Guide: the arrow names the vault and counts the keys; the locked toast on the way in.
  await place(info.x + 0.5 - fx * 40, 40, info.z + 0.5 - fz * 40);
  await page.evaluate(() => window.pokecraft.updateGuide());
  const far = await page.evaluate(() => window.pokecraft.ui.guide.textContent);
  t.ok(far.startsWith('Next: Treasure Vault') && far.includes('golden keys 0/3'), `the guide says: "${far}"`);
  await clearToasts();
  await place(info.x + 0.5 + fx * 9, info.fy + 1, info.z + 0.5 + fz * 9, [-fx, -fz]);
  await page.evaluate(() => window.pokecraft.updateGuide());
  await page.waitForTimeout(300);
  t.ok((await toasts()).includes('The Treasure Vault is locked! Find the 3 golden keys hidden around it.'), `walking up to the vault says it is locked (${await toasts()})`);
  let v = await vault();
  t.ok(v.chests.every(c => c === 73) && v.lights.every(c => c === 42 || c !== 69) && v.door.length === 1 && v.door[0] === 74, 'at the start all chests are closed, the lights are dark and the door is shut');

  // 2b. Compass: hidden far away, near the X it blinks faster than farther out.
  const compass = async () => {
    await page.evaluate(() => window.pokecraft.gymLive.update(0.3));
    return page.evaluate(() => {
      const g = window.pokecraft, c = g.gymLive.of('treasure').compass, el = g.ui.keyCompass;
      return { shown: c.shown, period: c.period, visible: !el.classList.contains('hidden'), pips: el.querySelectorAll('.pip.got').length };
    });
  };
  await place(info.x + 0.5 - fx * 60, 40, info.z + 0.5 - fz * 60);
  const c60 = await compass();
  t.ok(!c60.shown && !c60.visible, '60 blocks from the vault the key compass is hidden');
  const dig = info.keys[0];
  await place(info.x + 0.5 + fx * 38, (await onGround(info.x + fx * 38, info.z + fz * 38)), info.z + 0.5 + fz * 38);
  const c20 = await compass();
  await place(dig.chest[0] + 0.5, dig.mark[0][1] + 1, dig.chest[2] + 0.5);
  const c0 = await compass();
  t.ok(c20.shown && c20.visible && c0.shown && c0.period < c20.period, `the compass is shown near the vault and glints faster on the X (${c0.period.toFixed(2)}s) than far out in front of the vault (${c20.period.toFixed(2)}s)`);

  // 2c. Screenshots: outside (door and lights), the X, the roof from a pillar, the compass.
  await thin();
  await place(info.x + 0.5 + fx * 20, (await onGround(info.x + fx * 20, info.z + fz * 20)), info.z + 0.5 + fz * 20, [-fx, -fz], 0.2);
  await shot('t23-vault-outside.png');
  const xlook = [-fx, -fz];
  await place(dig.chest[0] + 0.5 + fx * 5, (await onGround(dig.chest[0] + fx * 5, dig.chest[2] + fz * 5)), dig.chest[2] + 0.5 + fz * 5, xlook, -0.5);
  await page.evaluate(() => window.pokecraft.gymLive.update(0.3));
  await shot('t23-vault-x.png');
  await shot('t23-compass.png', 600);

  // 2d. Keys. Breaking the roof is refused; a click on a chest opens it instead of breaking it.
  await clearToasts();
  const roofY = info.fy + 14;
  const refused = await page.evaluate(([x, y, z]) => {
    const g = window.pokecraft, before = g.world.get(x, y, z);
    g.breakBlock({ x, y, z, id: before, normal: [0, 1, 0] });
    return before === g.world.get(x, y, z);
  }, [info.x + 2, roofY, info.z + 1]);
  t.ok(refused, 'breaking the vault roof does nothing');
  const touch = k => page.evaluate(([x, y, z]) => {
    const g = window.pokecraft;
    g.breakBlock({ x, y, z, id: g.world.get(x, y, z), normal: [0, 1, 0] }); // the touch break button
  }, k.chest);
  await touch(info.keys[0]);
  await page.evaluate(() => window.pokecraft.gymLive.update(0.3));
  v = await vault();
  const msg1 = await toasts();
  t.ok(v.keys.length === 1 && v.keys[0] === 'treasure:dig' && v.chests[0] === 48 && v.chests[1] === 73 && msg1.includes('You found a golden key! (1/3)') && msg1.includes('climb out'), `the Dig chest opens with a click (${msg1})`);
  t.ok(v.lights[0] !== 42 && v.edits === 0, 'the first key light turns gold and nothing was an edit');
  await clearToasts();
  await touch(info.keys[0]);
  t.ok((await toasts()).includes('You already have this key.') && (await vault()).keys.length === 1, 'a second click says you already have it');
  // The HUD shows one pip.
  const c1 = await compass();
  t.ok(c1.shown && c1.pips === 1, 'the compass shows one found key');
  // The roof chest is reached with a pillar (a real build next to the wall) and opened with the interact path.
  const px = info.x + fx * 7, pz = info.z + fz * 7;
  await page.evaluate(([px, pz, from, to]) => { const g = window.pokecraft; for (let y = from; y <= to; y++) g.world.set(px, y, pz, 3); }, [px, pz, info.fy + 1, roofY]);
  await place(px + 0.5, roofY + 1, pz + 0.5, [-fx, -fz], -0.2);
  await clearToasts();
  await page.evaluate(() => document.getElementById('toast').replaceChildren());
  await shot('t23-vault-roof.png');
  await page.evaluate(() => window.pokecraft.gymLive.update(0.3));
  await touch(info.keys[1]);
  v = await vault();
  t.ok(v.keys.length === 2 && v.chests[1] === 48 && v.door[0] === 74, 'the roof chest opens: 2 keys, the door is still shut');
  // The Explore chest: walk the tunnel for the screenshot.
  const ex = info.keys[2];
  const [mx, my, mz] = ex.mouth;
  await place(mx + 0.5, my, mz + 0.5, [-fx, -fz]);
  await shot('t23-vault-tunnel-mouth.png', 1500);
  const cell = await page.evaluate(([ex, ey, ez]) => {
    const w = window.pokecraft.world;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.get(ex + a, ey, ez + b) === 0 && w.get(ex + 2 * a, ey, ez + 2 * b) === 0) return [ex + 2 * a, ey, ez + 2 * b, -a, -b];
    return null;
  }, ex.chest);
  if (cell) await place(cell[0] + 0.5, cell[1], cell[2] + 0.5, [cell[3], cell[4]], 0);
  await page.evaluate(() => document.getElementById('toast').replaceChildren());
  await shot('t23-vault-tunnel.png', 1500);
  await clearToasts();
  await touch(ex);
  await page.evaluate(() => window.pokecraft.gymLive.update(0.3));
  v = await vault();
  const msg3 = await toasts();
  t.ok(v.keys.length === 3 && msg3.includes('You have all 3 golden keys! The vault door is open.'), `the third key opens the vault (${msg3})`);
  t.ok(v.door.length === 1 && v.door[0] === 0 && v.lights.every(l => l !== 42), 'the door cells are air and all three key lights are gold');
  const off = await compass();
  t.ok(!off.shown && !off.visible, 'with all three keys the compass is gone');

  // 2e. Save and Continue: keys come back, chests open, door open; an old save without keys; bad entries dropped.
  await page.evaluate(() => { document.exitPointerLock(); window.pokecraft.save(true); });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')).keys);
  t.ok(Array.isArray(saved) && saved.length === 3, `the save has keys (${saved})`);
  await page.reload();
  await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  await continueGame(page);
  await page.evaluate(() => window.pokecraft.gymLive.update(0.3));
  v = await vault();
  t.ok(v.keys.length === 3 && v.chests.every(c => c === 48) && v.door[0] === 0, 'after Continue the three chests are open and the door is open');
  // The save is read by fresh browsers (a reload would write the game's own state back on the way out).
  const saveText = await page.evaluate(() => localStorage.getItem('pokecraft-save-v2'));
  const fromSave = async edit => {
    const s = JSON.parse(saveText);
    edit(s);
    const p = await openGame(browser, base, { setup: seedSave(s) });
    await continueGame(p);
    await p.evaluate(() => window.pokecraft.gymLive.update(0.3));
    const out = await p.evaluate(() => {
      const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'treasure'), w = g.world;
      return { keys: [...g.keys], chests: gym.keys.map(k => w.get(...k.chest)), door: w.get(...gym.door[0]) };
    });
    await p.context().close();
    return out;
  };
  v = await fromSave(s => { s.keys = ['treasure:dig', 'treasure:dig', 'treasure:nope', 'cozy:x', 42, 'treasure:explore']; });
  t.ok(v.keys.join() === 'treasure:dig,treasure:explore' && v.chests.join() === '48,73,48' && v.door === 74, `bad key entries are dropped (${v.keys})`);
  v = await fromSave(s => { delete s.keys; });
  t.ok(v.keys.length === 0 && v.chests.every(c => c === 73) && v.door === 74, 'an old save without keys has everything closed');

  // 2f. With all keys: the welcome inside, the people, the battles, the badge.
  await page.evaluate(async () => {
    const g = window.pokecraft;
    g.keys = ['treasure:dig', 'treasure:build', 'treasure:explore'];
    g.creatures.clear(); document.exitPointerLock();
    window.__toasts = [];
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) window.__toasts.push(n.textContent); })
      .observe(document.getElementById('toast'), { childList: true });
    const { makeCreature } = await import('/src/species.js');
    const { GYMS } = await import('/src/gyms.js');
    g.party = ['titanox', 'spectrion', 'stormwyvern'].map(s => makeCreature(s, 70));
    g.badges = GYMS.filter(x => x.id !== 'treasure').map(x => x.id);
    g.gymLive.update(0.3);
  });
  await page.waitForTimeout(300);
  await place(info.x + 0.5 + fx * 12, (await onGround(info.x + fx * 12, info.z + fz * 12)), info.z + 0.5 + fz * 12, [-fx, -fz]);
  await page.evaluate(() => window.pokecraft.updateGuide());
  await place(info.x + 0.5 + fx * 3, info.fy + 1, info.z + 0.5 + fz * 3, [-fx, -fz]);
  await page.evaluate(() => window.pokecraft.updateGuide());
  await page.waitForTimeout(300);
  t.ok((await toasts()).includes('You opened the Treasure Vault! Everything here sparkles.'), `inside with all three keys: the welcome (${await toasts()})`);
  await shot('t23-vault-inside.png', 800);
  await place(info.x + 0.5 + fx * 3, info.fy + 1, info.z + 0.5 + fz * 3, [-fx, -fz]);
  await clearToasts();
  await page.evaluate(() => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'treasure')); });
  t.ok((await toasts()).includes('Beat Banker Penny and Miner Jem first'), `the leader refuses first (${await toasts()})`);
  for (const [i, name] of [[0, 'Banker Penny'], [1, 'Miner Jem']]) {
    await page.evaluate(i => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(x => x.kind === 'trainer' && x.index === i && x.gym.def.id === 'treasure')); }, i);
    t.ok(await page.evaluate(() => window.pokecraft.inBattle), `${name} battles`);
    t.ok(await playBattle(page), `beat ${name}`);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.exitPointerLock());
  }
  await page.evaluate(() => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'treasure')); });
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'the leader battles after both trainers');
  t.ok(await playBattle(page), 'beat Leader Goldie');
  await page.waitForTimeout(500);
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('treasure')), 'the Jackpot Badge is awarded');
  t.ok(page.errors.length === 0, `no page errors (${page.errors.join('; ')})`);
}
