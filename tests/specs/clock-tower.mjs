// T19 Clock Tower (Time gym, slot 0): placement, walkable stairs, doors by game time (never closing on you), the guide,
// the clock hand, protection, and screenshots.
import fs from 'node:fs';
import { openGame, newGame, playBattle, waitFor } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);

  // 1. Placement and walkable stairs on three seeds (generated worlds, no game needed).
  const worlds = await page.evaluate(async seeds => {
    const { World, WORLD_W: W, WORLD_D: D, WORLD_H } = await import('/src/world.js');
    const { B, isSolid } = await import('/src/blocks.js');
    const out = [];
    for (const seed of seeds) {
      const w = new World(seed, null, null);
      w.generate();
      const g = w.gyms.find(x => x.def.id === 'time');
      const box = g.slot.box, fy = g.fy;
      let top = 0;
      for (let x = g.x - 12; x <= g.x + 12; x++) for (let z = g.z - 12; z <= g.z + 12; z++) for (let y = WORLD_H - 1; y > 0; y--) {
        if (w.get(x, y, z) !== B.AIR) { top = Math.max(top, y); break; }
      }
      const inside = box.x0 <= g.x - 9 && g.x + 9 <= box.x1 && box.z0 <= g.z - 9 && g.z + 9 <= box.z1;
      const closed = g.floors.every(f => f.door.length === 6 && f.door.every(([x, y, z]) => w.get(x, y, z) === B.CLOCK_DOOR));
      // BFS over standing cells from the plaza in front of the lobby door (jump up 1, drop at most 3).
      const stand = (x, y, z) => x >= 0 && z >= 0 && x < W && z < D && y >= 1 && !isSolid(w.get(x, y, z)) && !isSolid(w.get(x, y + 1, z)) && isSolid(w.get(x, y - 1, z));
      const key = (x, y, z) => x + W * (z + D * y);
      const start = [g.x + g.front[0] * 8, fy + 1, g.z + g.front[1] * 8];
      const seen = new Set([key(...start)]), st = [start];
      const reached = [];
      while (st.length) {
        const [x, y, z] = st.pop();
        reached.push([x, y, z]);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (Math.abs(nx - g.x) > 14 || Math.abs(nz - g.z) > 14) continue;
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
      // Each door has a reachable standing cell beside it at the door's own level (the landing).
      const landings = g.floors.map(f => {
        const [dx, dy, dz] = f.door[0];
        return { ok: reached.some(([x, y, z]) => y === dy && Math.abs(x - dx) + Math.abs(z - dz) === 1), level: dy - 1 - fy };
      });
      const lobby = reached.some(([x, y, z]) => y === fy + 1 && Math.max(Math.abs(x - g.x), Math.abs(z - g.z)) <= 4);
      const rooms = g.floors.some(f => reached.some(([x, y, z]) => y === f.room.y0 && x > f.room.x0 && x < f.room.x1 && z > f.room.z0 && z < f.room.z1));
      out.push({ seed, inside, top, closed, landings, lobby, rooms, slot: g.slot.k, protect: g.protect.length, area: !!g.area });
    }
    return out;
  }, [1, 4242, 777]);
  for (const w of worlds) {
    t.ok(w.inside && w.slot === 0 && w.top <= 47 && w.protect === 1 && w.area, `seed ${w.seed}: the tower is inside slot 0 (top ${w.top}), protected, with an area`);
    t.ok(w.closed, `seed ${w.seed}: all three doors are generated closed`);
    t.ok(w.lobby && w.landings.every(l => l.ok) && w.landings.map(l => l.level).join() === '6,12,18' && !w.rooms,
      `seed ${w.seed}: the stairs are walkable to all three landings (levels ${w.landings.map(l => l.level)}), the rooms are shut`);
  }

  // 2. A new game with a strong party, next to the tower.
  await newGame(page, 0);
  await page.evaluate(async () => {
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('tidalord', 50), makeCreature('thunderwolf', 50), makeCreature('grovebeast', 50)];
    window.__time = g.world.gyms.find(x => x.def.id === 'time');
    window.__edits = Object.keys(g.world.edits).length;
    // d steps along the tower's front, s across; world cell (x, y, z)
    window.__at = (d, s, y) => { const G = window.__time, [fx, fz] = G.front, sd = [fz, fx]; return [G.x + fx * d + sd[0] * s, y, G.z + fz * d + sd[1] * s]; };
    window.__put = (d, s, y) => { const [x, yy, z] = window.__at(d, s, y), p = window.pokecraft.player; p.pos.set(x + 0.5, yy, z + 0.5); p.vel.set(0, 0, 0); document.exitPointerLock(); };
    window.__doors = () => window.__time.floors.map(f => f.door.map(([x, y, z]) => window.pokecraft.world.get(x, y, z)));
  });
  const AIR = 0, DOOR = 64;
  const doorsAre = (a, b, c) => waitFor(page, ([a, b, c]) => { const d = window.__doors(); return [a, b, c].every((v, i) => d[i].every(x => x === v)); }, [a, b, c], 60000).then(() => true, () => false);
  const say = () => page.locator('#toast').innerText();
  const wins = await page.evaluate(() => window.__time.floors.map(f => f.window));
  t.ok(wins.join() === 'morning,afternoon,night', `doors in order: ${wins}`);

  // Morning: floor 1 is open.
  await page.evaluate(() => { window.pokecraft.time = 0.1; window.__put(9, 4, window.__time.fy + 1); });
  t.ok(await doorsAre(AIR, DOOR, DOOR), 'morning: floor 1 door is open, 2 and 3 closed');
  const npcOf = (kind, i = 0) => `window.pokecraft.npcs.list.find(n => n.kind === '${kind}' && n.gym.def.id === 'time' && ${kind === 'leader' ? 'true' : `n.index === ${i}`})`;
  const standBy = (n, along) => page.evaluate(([n, along]) => {
    const f = window.__time.floors[n], p = window.pokecraft.player;
    p.pos.set(f.pos[0] + along[0], f.pos[1], f.pos[2] + along[1]); p.vel.set(0, 0, 0); document.exitPointerLock();
  }, [n, along]);
  // The afternoon trainer refuses in the morning.
  await standBy(1, [0, 3]);
  await page.evaluate(`window.pokecraft.time = 0.1; window.pokecraft.talkTo(${npcOf('trainer', 1)})`);
  const msg = await say();
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)) && msg.includes('afternoon') && msg.includes('minute'), `Tea Time Theo's door is closed in the morning: "${msg}"`);
  // Beat Early Bird Ana.
  await standBy(0, [0, 1.5]);
  await page.evaluate(`window.pokecraft.time = 0.1; window.pokecraft.talkTo(${npcOf('trainer', 0)})`);
  t.ok(await playBattle(page), 'Early Bird Ana battle finishes');
  t.ok(await page.evaluate(() => window.pokecraft.beaten.includes('time:trainer')), 'Early Bird Ana is remembered');

  // Afternoon: floor 2 opens, floor 1 closes (the player is outside).
  await page.evaluate(() => { window.pokecraft.time = 0.3; window.__put(9, 4, window.__time.fy + 1); });
  t.ok(await doorsAre(DOOR, AIR, DOOR), 'afternoon: floor 2 door is open, 1 and 3 closed');
  await standBy(1, [0, 1.5]);
  await page.evaluate(`window.pokecraft.time = 0.3; window.pokecraft.talkTo(${npcOf('trainer', 1)})`);
  t.ok(await playBattle(page), 'Tea Time Theo battle finishes');
  await page.evaluate(`window.pokecraft.time = 0.3; window.pokecraft.talkTo(${npcOf('leader')})`);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)) && (await say()).includes('night'), 'Leader Tikka waits for the night door');

  // Night: floor 3 opens, the leader battles, badge.
  await page.evaluate(() => { window.pokecraft.time = 0.7; window.__put(9, 4, window.__time.fy + 1); });
  t.ok(await doorsAre(DOOR, DOOR, AIR), 'night: floor 3 door is open, 1 and 2 closed');
  await standBy(2, [0, 1.5]);
  await page.evaluate(`window.pokecraft.time = 0.7; window.pokecraft.talkTo(${npcOf('leader')})`);
  t.ok(await playBattle(page), 'Leader Tikka battle finishes');
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('time')), 'the Chime Badge is awarded');

  // A door never closes on the player: stand in floor 1's doorway at 0.24, then 0.26.
  await page.evaluate(() => {
    const f = window.__time.floors[0], [x, y, z] = f.door[0], p = window.pokecraft.player;
    window.pokecraft.time = 0.24;
    p.pos.set(x + 0.5, y, z + 0.5); p.vel.set(0, 0, 0); document.exitPointerLock();
  });
  await waitFor(page, () => window.__doors()[0].every(x => x === 0), null, 60000);
  await page.evaluate(() => { window.pokecraft.time = 0.26; });
  await page.waitForTimeout(2500);
  t.ok(await page.evaluate(() => window.__doors()[0].every(x => x === 0)), 'a door stays open while you stand in it (also after its time is over)');
  await page.evaluate(() => { window.__put(9, 4, window.__time.fy + 1); window.pokecraft.time = 0.26; });
  t.ok(await doorsAre(DOOR, AIR, DOOR), 'it closes once you have left');

  // The hand: noon straight up, 18:00 to the right.
  const hand = async time => {
    await page.evaluate(time => { window.pokecraft.time = time; }, time);
    await page.waitForTimeout(1500);
    return page.evaluate(() => window.pokecraft.gymLive.of('time').pivot.rotation.z);
  };
  const noon = await hand(0.25), eve = await hand(0.5);
  t.ok(Math.abs(noon) < 0.15 && Math.abs(eve + Math.PI / 2) < 0.15, `the hand points up at noon (${noon.toFixed(2)}) and right at 18:00 (${eve.toFixed(2)})`);

  // The guide: from 40 out it names the tower and says which door is open.
  const guide = async time => {
    await page.evaluate(time => {
      const g = window.pokecraft, G = window.__time, [fx, fz] = G.front;
      g.badges = g.world.gyms.map(x => x.def.id).filter(id => id !== 'time'); g.beaten = []; g.time = time;
      g.player.pos.set(G.x + 0.5 + fx * 40, G.fy + 20, G.z + 0.5 + fz * 40); g.player.vel.set(0, 0, 0);
      g.updateGuide();
    }, time);
    await page.waitForTimeout(800);
    await page.evaluate(() => window.pokecraft.updateGuide());
    return page.locator('#guide').innerText();
  };
  const g1 = await guide(0.1);
  t.ok(g1.includes('Clock Tower') && g1.includes('the yellow door is open!'), `guide in the morning: "${g1}"`);
  const g2 = await guide(0.3);
  t.ok(g2.includes('Clock Tower') && g2.includes('the yellow door opens in'), `guide in the afternoon: "${g2}"`);
  t.ok(await page.evaluate(() => { const g = window.pokecraft, a = g.access.of(window.__time); const day = a.wait() == null; g.time = 0.8; return day && a.wait() == null; }), 'the Clock Tower is never skipped by the arrow, by day or night');

  // Protection: a door cannot be broken, and the world's edits are unchanged.
  const prot = await page.evaluate(() => {
    const g = window.pokecraft, f = window.__time.floors[0], [x, y, z] = f.door[0];
    g.time = 0.1;
    g.world.setLive(x, y, z, 64);
    g.breakBlock({ x, y, z, id: 64 });
    return { still: g.world.get(x, y, z) === 64, edits: Object.keys(g.world.edits).length, was: window.__edits };
  });
  t.ok(prot.still && prot.edits === prot.was, `breaking a door does nothing (edits ${prot.edits} = ${prot.was})`);
  const why = await say();
  t.ok(why.includes('opens at its time'), `...and says why: "${why}"`);

  // 3. Screenshots: outside at noon and at night (clock in view), the stairs, and inside the leader's room.
  const shot = async (name, time, spot, look, platform = true) => {
    await page.evaluate(([time, spot, look, platform]) => {
      const g = window.pokecraft;
      g.time = time;
      const [px, py, pz] = window.__at(...spot);
      if (platform) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) g.world.set(px + a, py - 1, pz + b, 3);
      g.player.pos.set(px + 0.5, py, pz + 0.5); g.player.vel.set(0, 0, 0);
      const [lx, ly, lz] = window.__at(...look);
      g.player.lookAt({ x: lx + 0.5, y: ly + 0.5, z: lz + 0.5 });
      document.getElementById('pause').classList.add('hidden');
    }, [time, spot, look, platform]);
    await page.waitForTimeout(4500);
    await page.screenshot({ path: SHOTS + name });
  };
  const fy = await page.evaluate(() => window.__time.fy);
  await shot('t19-clock-outside-noon.png', 0.27, [26, 0, fy + 14], [6, 0, fy + 14]);
  await shot('t19-clock-outside-night.png', 0.75, [26, 0, fy + 14], [6, 0, fy + 14]);
  await shot('t19-clock-outside-wide.png', 0.3, [32, 16, fy + 20], [0, 0, fy + 10]);
  await shot('t19-clock-stairs.png', 0.7, [12, -7, fy + 6], [-3, -6, fy + 9]);
  // Inside floor 3 (night door open): stand in the room, 3 cells from the leader, looking at them.
  await page.evaluate(() => { window.pokecraft.time = 0.7; });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.pokecraft, f = window.__time.floors[2], p = g.player;
    const out = [Math.sin(f.heading), Math.cos(f.heading)];
    p.pos.set(f.pos[0] - out[0] * 3, f.room.y0, f.pos[2] - out[1] * 3); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.pos[0], y: f.pos[1] + 1.2, z: f.pos[2] });
    document.getElementById('pause').classList.add('hidden');
  });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: SHOTS + 't19-clock-inside.png' });
  await page.evaluate(() => { window.pokecraft.time = 0.1; });
  await shot('t19-clock-lobby.png', 0.1, [4, 0, fy + 1], [-4, 0, fy + 2], false);
  t.ok(page.errors.length === 0, `no page errors ${page.errors.join(' | ')}`);
}
