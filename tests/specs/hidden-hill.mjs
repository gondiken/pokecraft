// T19 Hidden Hill Gym (Camo, slot 1): placement and look from outside, the hidden door, the guide's fade-out,
// the two trainers disguised as stone pillars (reveal, bump, battles, leader, reload), screenshots.
import fs from 'node:fs';
import { openGame, newGame, playBattle, continueGame, waitFor } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });

  // 1. Placement on three seeds (no game needed): box, hill made of the surrounding land, hidden door, a way in.
  const page0 = await openGame(browser, base);
  const place = await page0.evaluate(async () => {
    const { World, WORLD_W: W, WORLD_D: D } = await import('/src/world.js');
    const { B, isSolid } = await import('/src/blocks.js');
    const out = {};
    for (const seed of [1, 4242, 777]) {
      const w = new World(seed, null, null);
      w.generate();
      const g = w.gyms.find(x => x.def.id === 'camo'), box = g.slot.box;
      const r = {};
      r.slot = g.slot.k === 1;
      r.protectInBox = g.protect.every(b => b.x0 >= box.x0 && b.x1 <= box.x1 && b.z0 >= box.z0 && b.z1 <= box.z1);
      // The hill's surface (ring r 12..16) is made of what the land around it (ring r 22..24) is made of.
      const shares = (lo, hi) => {
        const n = new Map();
        for (let x = g.x - hi; x <= g.x + hi; x++) for (let z = g.z - hi; z <= g.z + hi; z++) {
          const q = Math.hypot(x - g.x, z - g.z);
          if (q < lo || q > hi) continue;
          const id = w.surface(x, z).id;
          n.set(id, (n.get(id) || 0) + 1);
        }
        const total = [...n.values()].reduce((a, b) => a + b, 0);
        return Object.fromEntries([...n].map(([id, c]) => [id, c / total]));
      };
      const hillS = shares(10, 16), landS = shares(22, 26);
      r.hillTop = Object.entries(hillS).sort((a, b) => b[1] - a[1])[0][0]; // the hill's most common top block...
      r.landTop = Math.round((landS[r.hillTop] || 0) * 100); // ...is how many percent of the land around it
      const [dx, dy, dz] = g.door, [bx, by, bz] = g.bush;
      r.bush = w.get(bx, by, bz) === B.LEAVES && w.get(bx, by + 1, bz) === B.LEAVES && w.get(bx, by + 2, bz) === B.FLOWER_BUSH;
      r.mouthOpen = w.get(dx, dy, dz) === B.AIR && w.get(dx, dy + 1, dz) === B.AIR && w.get(dx, dy - 1, dz) !== B.AIR;
      r.hillHeight = w.surface(g.x, g.z).y - (g.y - 1);
      // Walk (step up/down one) from outside the hill, at r 22 on the door's line, to the middle of the room.
      const stand = (x, y, z) => x >= 0 && z >= 0 && x < W && z < D && y >= 1 && !isSolid(w.get(x, y, z)) && !isSolid(w.get(x, y + 1, z)) && isSolid(w.get(x, y - 1, z));
      const [fx, fz] = g.front;
      let sy = w.surface(g.x + fx * 22, g.z + fz * 22).y + 1;
      const key = (x, y, z) => x + W * (z + D * y);
      const seen = new Set(), st = [[g.x + fx * 22, sy, g.z + fz * 22]];
      let reached = false;
      while (st.length) {
        const [x, y, z] = st.pop();
        if (x === g.x && z === g.z && y === g.y) { reached = true; break; }
        for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ax, nz = z + az;
          if (Math.abs(nx - g.x) > 30 || Math.abs(nz - g.z) > 30) continue;
          for (const ny of [y + 1, y, y - 1, y - 2]) {
            if (ny === y + 1 && isSolid(w.get(x, y + 2, z))) continue;
            if (!stand(nx, ny, nz) || seen.has(key(nx, ny, nz))) continue;
            seen.add(key(nx, ny, nz)); st.push([nx, ny, nz]);
            break;
          }
        }
      }
      r.walk = reached;
      // The door never faces the start (away, or a side when the land in front of 'away' climbs or is water).
      const ax = Math.abs(g.x - 112) > Math.abs(g.z - 112) ? [Math.sign(g.x - 112), 0] : [0, Math.sign(g.z - 112)];
      r.away = g.front[0] * ax[0] + g.front[1] * ax[1] >= 0;
      out[seed] = r;
    }
    return out;
  });
  await page0.context().close();
  for (const [seed, r] of Object.entries(place)) {
    t.ok(r.slot && r.protectInBox, `seed ${seed}: the Hidden Hill is in slot 1 and its protected box is inside the slot box`);
    t.ok(r.landTop >= 20, `seed ${seed}: the hill's surface block (id ${r.hillTop}) is what ${r.landTop}% of the land around it is made of`);
    t.ok(r.hillHeight >= 8, `seed ${seed}: the hill is ${r.hillHeight} blocks above its floor`);
    t.ok(r.bush && r.mouthOpen, `seed ${seed}: a hedge with a flower bush stands in front of the tunnel mouth`);
    t.ok(r.away, `seed ${seed}: the door faces away from the start (or sideways)`);
    t.ok(r.walk, `seed ${seed}: you can walk from outside to the middle of the room`);
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
    g.party = ['titanox', 'spectrion', 'stormwyvern'].map(s => makeCreature(s, 60));
  });
  const toasts = () => page.evaluate(() => window.__toasts.join(' | '));
  const clearToasts = () => page.evaluate(() => { window.__toasts.length = 0; });

  // Puts the player at (d, s) of the hill (front direction), on the ground or at the room floor, looking along `look` ('in'/'out'/[dx,dz]).
  const stand = (d, s, look, pitch = 0, extra = 0) => page.evaluate(([d, s, look, pitch, extra]) => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'camo'), [fx, fz] = gym.front;
    const x = gym.x + 0.5 + fx * d + Math.abs(fz) * s, z = gym.z + 0.5 + fz * d + Math.abs(fx) * s; // s is unsigned (src/hiddenhill.js col)
    const y = d > 7 || Math.abs(s) > 7 ? g.world.surface(Math.floor(x), Math.floor(z)).y + 1 : gym.y;
    g.player.pos.set(x, y + extra, z);
    g.player.vel.set(0, 0, 0);
    const [lx, lz] = look === 'in' ? [fx, fz] : look === 'out' ? [-fx, -fz] : look;
    g.player.yaw = Math.atan2(-lx, -lz);
    g.player.pitch = pitch;
  }, [d, s, look, pitch, extra]);
  const shot = async (name, wait = 2500) => {
    await page.evaluate(() => { window.pokecraft.time = 0.2; document.getElementById('pause').classList.add('hidden'); });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: SHOTS + name });
    console.log(`  screenshot ${SHOTS + name}`);
  };

  // 2a. Guide: the arrow far away, no arrow within 20 blocks, no welcome on top of the hill, welcome inside.
  await page.evaluate(async () => {
    const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
    g.badges = GYMS.filter(x => x.id !== 'camo').map(x => x.id);
  });
  await stand(40, 0, 'out');
  const far = await page.evaluate(() => { const g = window.pokecraft; g.updateGuide(); return { text: g.ui.guide.textContent, target: g.guideTarget }; });
  t.ok(far.text.startsWith('Next: Hidden Hill') && far.target, `40 blocks away the arrow shows: "${far.text}"`);
  await stand(15, 0, 'out');
  const near = await page.evaluate(() => { const g = window.pokecraft; g.updateGuide(); return { text: g.ui.guide.textContent, target: g.guideTarget }; });
  t.ok(near.text.includes("It's hidden somewhere around here") && near.target === null, `15 blocks away there is no arrow: "${near.text}"`);
  await clearToasts();
  const top = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'camo');
    g.player.pos.set(gym.x + 0.5, g.world.surface(gym.x, gym.z).y + 1, gym.z + 0.5);
    g.updateGuide();
    return g.ui.guide.textContent;
  });
  await page.waitForTimeout(300);
  t.ok(!(await toasts()).includes('You found') && top.includes('hidden'), `standing on top of the hill is not "inside" (${top})`);
  await stand(6, 0, 'out');
  await page.evaluate(() => window.pokecraft.updateGuide());
  await page.waitForTimeout(300);
  t.ok((await toasts()).includes('You found the Hidden Hill!'), 'inside the room: "You found the Hidden Hill!"');

  // 2b. Screenshots from outside, at the bush and inside.
  await stand(30, 0, 'out', -0.12);
  await page.evaluate(() => { const g = window.pokecraft; g.player.pos.y = g.world.surface(Math.floor(g.player.pos.x), Math.floor(g.player.pos.z)).y + 1; });
  await shot('t19-hill-outside-door.png');
  await stand(-30, 0, 'in', -0.12);
  await shot('t19-hill-outside-back.png');
  await stand(24, 0, 'out', -0.05);
  await shot('t19-hill-bush.png');
  await stand(21, 7, 'out', -0.1);
  await shot('t19-hill-bush-side.png');

  // 2c. The disguised trainers.
  const info = await page.evaluate(() => {
    const g = window.pokecraft;
    const ts = g.npcs.list.filter(n => n.kind === 'trainer' && n.gym.def.id === 'camo');
    return ts.map(n => ({
      name: n.name, disguised: !!n.disguise, personHidden: n.model.children.filter(c => c !== n.disguise?.group).every(c => !c.visible),
    }));
  });
  t.ok(info.length === 2 && info.every(i => i.disguised && i.personHidden), `both trainers are stone pillars with the person hidden (${info.map(i => i.name)})`);
  const blink = await page.evaluate(() => {
    const g = window.pokecraft, n = g.npcs.list.find(x => x.kind === 'trainer' && x.gym.def.id === 'camo');
    n.disguise.blink(g.player.pos);
    return n.disguise.blinking;
  });
  t.ok(blink, 'a disguised trainer blinks');

  // Looking at one from 3 blocks away finds it.
  const picked = await page.evaluate(async () => {
    const g = window.pokecraft, THREE = await import('three'), gym = g.world.gyms.find(x => x.def.id === 'camo');
    const n = g.npcs.list.find(x => x.kind === 'trainer' && x.index === 0 && x.gym === gym), [fx, fz] = gym.front;
    // trainer 0 is at (d 2, s -4): stand at s -1 and look along -s
    const sx = Math.abs(fz), sz = Math.abs(fx); // the sideways unit vector (s)
    const origin = new THREE.Vector3(n.pos.x + 3 * sx, n.pos.y + 1.2, n.pos.z + 3 * sz);
    const hit = g.npcs.pick(origin, new THREE.Vector3(-sx, 0, -sz), 5);
    return { name: hit?.npc.name, want: n.name, dist: hit?.dist };
  });
  t.ok(picked.name === picked.want, `looking at the pillar from 3 blocks picks ${picked.name} (${picked.dist?.toFixed(1)} away)`);

  // Inside screenshots: beside trainer 0's pillar (looking along -s), and an overview from the doorway.
  const minusS = await page.evaluate(() => { const f = window.pokecraft.world.gyms.find(x => x.def.id === 'camo').front; return [-Math.abs(f[1]), -Math.abs(f[0])]; });
  await stand(2, -1, minusS, 0);
  await page.evaluate(() => { const g = window.pokecraft; g.npcs.list.filter(x => x.disguise).forEach(n => n.disguise.blink(g.player.pos)); });
  await shot('t19-hill-inside.png', 400);
  await stand(6, 0, 'out', 0);
  await page.evaluate(() => { const g = window.pokecraft; g.npcs.list.filter(x => x.disguise).forEach(n => n.disguise.blink(g.player.pos)); });
  await shot('t19-hill-inside-overview.png', 400);

  // 2d. Talk: reveal, battle, then the second, then the leader.
  await stand(3, 0, 'in');
  await clearToasts();
  await page.evaluate(() => {
    const g = window.pokecraft, n = g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'camo');
    g.talkTo(n);
  });
  let msg = await toasts();
  t.ok(msg.includes('Beat Ranger Ollie and Hider Juno first'), `the leader refuses first (${msg})`);
  await clearToasts();
  await page.evaluate(() => {
    const g = window.pokecraft, n = g.npcs.list.find(x => x.kind === 'trainer' && x.index === 0 && x.gym.def.id === 'camo');
    g.talkTo(n);
  });
  msg = await toasts();
  const afterTalk = await page.evaluate(() => {
    const g = window.pokecraft, n = g.npcs.list.find(x => x.kind === 'trainer' && x.index === 0 && x.gym.def.id === 'camo');
    return { disguise: !!n.disguise, shown: n.model.children.every(c => c.visible), battle: g.inBattle };
  });
  t.ok(msg.includes('That stone pillar was Ranger Ollie!') && !afterTalk.disguise && afterTalk.shown && afterTalk.battle, `talking reveals the person and starts the battle (${msg})`);
  t.ok(await playBattle(page), 'beat Ranger Ollie');
  await page.waitForTimeout(500);
  t.ok(await page.evaluate(() => window.pokecraft.beaten.includes('camo:trainer')), 'camo:trainer is beaten');
  await page.evaluate(() => document.exitPointerLock());

  // The second one: talk to it (E / click) from the side.
  await clearToasts();
  await page.evaluate(() => window.pokecraft.talkTo(window.pokecraft.npcs.list.find(x => x.kind === 'trainer' && x.index === 1 && x.gym.def.id === 'camo')));
  t.ok((await toasts()).includes('That stone pillar was Hider Juno!') && await page.evaluate(() => window.pokecraft.inBattle), 'the second pillar is Hider Juno and the battle starts');
  t.ok(await playBattle(page), 'beat Hider Juno');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.exitPointerLock());
  t.ok(await page.evaluate(() => window.pokecraft.beaten.includes('camo:trainer2')), 'camo:trainer2 is beaten');
  await clearToasts();
  await page.evaluate(() => {
    const g = window.pokecraft, n = g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'camo');
    g.talkTo(n);
  });
  await page.evaluate(() => {
    const g = window.pokecraft, n = g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'camo');
    g.badges = g.badges.filter(b => b !== 'camo');
    g.talkTo(n);
  });
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'the leader battles after both trainers');
  t.ok(await playBattle(page), 'beat Leader Sylva');
  await page.waitForTimeout(500);
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('camo')), 'the Hideout Badge is awarded');
  await page.evaluate(() => { document.exitPointerLock(); window.pokecraft.save(true); });

  // 2e. Reload (Continue): beaten trainers are people, not pillars.
  await page.reload();
  await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  await continueGame(page);
  const again = await page.evaluate(() => window.pokecraft.npcs.list.filter(n => n.kind === 'trainer' && n.gym.def.id === 'camo').map(n => !!n.disguise));
  t.ok(again.length === 2 && again.every(d => !d), 'after Continue the beaten trainers are not disguised');
  t.ok(page.errors.length === 0, `no page errors (${page.errors.join('; ')})`);

  // 3. A fresh game: unbeaten trainers are disguised again, and a bump starts the battle.
  const page2 = await openGame(browser, base);
  await newGame(page2, 1);
  await page2.evaluate(async () => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'camo');
    g.creatures.clear();
    const { makeCreature } = await import('/src/species.js');
    g.party = ['titanox'].map(s => makeCreature(s, 60));
    const n = g.npcs.list.find(x => x.kind === 'trainer' && x.index === 0 && x.gym === gym), [fx, fz] = gym.front;
    const sx = Math.abs(fz), sz = Math.abs(fx);
    g.player.pos.set(n.pos.x + 2.5 * sx, gym.y, n.pos.z + 2.5 * sz);
    g.player.vel.set(0, 0, 0);
    g.player.yaw = Math.atan2(sx, sz);
    g.player.keys.KeyW = true;
  });
  await waitFor(page2, () => window.pokecraft.inBattle, null, 60000);
  await page2.evaluate(() => { window.pokecraft.player.keys.KeyW = false; });
  t.ok(await page2.evaluate(() => window.pokecraft.battle.trainer?.name === 'Ranger Ollie'), 'in a fresh game, walking into a pillar starts the battle with its trainer');
  t.ok(page2.errors.length === 0, `no page errors (${page2.errors.join('; ')})`);
}
