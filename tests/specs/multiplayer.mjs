// Play together, with two separate browsers (see openPair).
import { openPair, newGame, click, pause, playBattle, continueGame } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  const seedA = await A.evaluate(() => window.pokecraft.world.seed);
  const seedB = await B.evaluate(() => window.pokecraft.world.seed);

  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  t.ok(/^[A-Z0-9]{5}$/.test(code), `sharing shows a 5-character code (${code})`);
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code.toLowerCase());
  await click(B, '#mp button:has-text("Join a world")');
  await B.waitForTimeout(4000);
  t.ok(await B.evaluate(s => window.pokecraft.world.seed === s, seedA), 'joining loads the host\'s world');
  t.ok(JSON.stringify(await A.evaluate(() => window.pokecraft.mp.players)) === '["Kid"]', 'host sees the visitor');
  t.ok(JSON.stringify(await B.evaluate(() => window.pokecraft.mp.players)) === '["Dad"]', 'visitor sees the host');

  const spot = await A.evaluate(() => { const g = window.pokecraft, p = g.player.pos; const x = Math.floor(p.x) + 2, y = Math.floor(p.y) + 3, z = Math.floor(p.z); g.world.set(x, y, z, 11); g.mp.sendBlock(x, y, z, 11); return [x, y, z]; });
  await B.waitForTimeout(800);
  t.ok(await B.evaluate(([x, y, z]) => window.pokecraft.world.get(x, y, z) === 11, spot), 'host\'s block appears for the visitor');
  await B.evaluate(([x, y, z]) => { const g = window.pokecraft; g.world.set(x, y + 1, z, 9); g.mp.sendBlock(x, y + 1, z, 9); }, spot);
  await A.waitForTimeout(800);
  t.ok(await A.evaluate(([x, y, z]) => window.pokecraft.world.get(x, y + 1, z) === 9, spot), 'visitor\'s block appears for the host');
  t.ok(await B.evaluate(s => JSON.parse(localStorage.getItem('pokecraft-save-v2')).seed === s, seedB), 'visitor\'s own saved world is untouched');
  // T17/T32: the visitor gets the whole 288 x 368 world, and a forged "block" message can't open a gym wall.
  t.ok(await B.evaluate(() => { const w = window.pokecraft.world; return w.W === 288 && w.D === 368 && w.get(250, 1, 250) !== 0 && w.get(150, 1, 340) !== 0; }), 'the visitor gets the bigger world, new land and the south strip included');
  const wall = await B.evaluate(() => {
    const g = window.pokecraft, w = g.world, gym = w.gyms.find(x => !x.cave && !x.sky);
    for (let y = gym.y; y <= gym.y + 5; y++) for (let a = -6; a <= 6; a++) for (const b of [-6, 6]) if (w.get(gym.x + a, y, gym.z + b) !== 0) return [gym.x + a, y, gym.z + b];
    return null;
  });
  await A.evaluate(([x, y, z]) => { window.pokecraft.mp.sendBlock(x, y, z, 0); }, wall);
  await B.waitForTimeout(1500);
  t.ok(wall && await B.evaluate(([x, y, z]) => window.pokecraft.world.get(x, y, z) !== 0, wall), 'a block message that would break a gym wall is ignored by the visitor');

  // T23 Treasure Vault: golden keys and opened chests belong to each player; nothing is sent.
  const vaultChest = P => P.evaluate(() => { const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'treasure'); return { id: g.world.get(...gym.keys[0].chest), keys: g.keys.length }; });
  await A.evaluate(() => { const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'treasure'), [x, y, z] = gym.keys[0].chest; g.gymLive.hit({ x, y, z, id: g.world.get(x, y, z) }); g.gymLive.update(0.3); });
  await B.waitForTimeout(1500);
  const [vA, vB] = [await vaultChest(A), await vaultChest(B)];
  t.ok(vA.id === 48 && vA.keys === 1 && vB.id === 73 && vB.keys === 0, `the host opened the dig chest: it is still closed for the visitor (host ${vA.id}/${vA.keys} keys, visitor ${vB.id}/${vB.keys} keys)`);

  // T19 Firewall Maze: a friend standing on a friend pad opens the purple lane for the other player (positions only, no new
  // message). Switches stay per player: the host's red switch leaves the visitor's lasers alone.
  const fwSetup = async () => { const { B } = await import('/src/blocks.js'); window.fwB = B; };
  await A.evaluate(fwSetup); await B.evaluate(fwSetup);
  const friendIds = P => P.evaluate(() => { const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'cyber'); return gym.rooms[0].friend.map(([x, y, z]) => g.world.get(x, y, z)); });
  t.ok((await friendIds(A)).every(id => id === 59) && (await friendIds(B)).every(id => id === 59), 'both players start with the purple friend lane closed');
  const home = await B.evaluate(() => window.pokecraft.player.pos.toArray());
  await B.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'cyber'), [px, pz] = [...gym.rooms[0].pads][0].split(',').map(Number);
    g.player.pos.set(px + 0.5, gym.fy + 1, pz + 0.5); g.player.vel.set(0, 0, 0);
  });
  await A.waitForFunction(() => { const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'cyber'); return gym.rooms[0].friend.every(([x, y, z]) => g.world.get(x, y, z) === 0); }, null, { timeout: 60000, polling: 200 }).catch(() => {});
  t.ok((await friendIds(A)).every(id => id === 0), 'the visitor on a friend pad opens the friend lane for the host');
  t.ok((await friendIds(B)).every(id => id === 59), 'it stays closed for the visitor on their own pad (only a friend opens it)');
  await A.evaluate(() => { const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'cyber'), [sx, , sz] = [...gym.rooms[0].switches.keys()][0].split(',').map(Number); g.gymLive.stand(sx, gym.fy, sz, g.world.get(sx, gym.fy, sz)); });
  const redNow = P => P.evaluate(() => { const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'cyber'); return gym.rooms[0].red.map(([x, y, z]) => g.world.get(x, y, z)); });
  const [redA, redB] = [await redNow(A), await redNow(B)];
  t.ok(redA.every(id => id === 0) && redB.every(id => id === 57), `the host's red switch leaves the visitor's lasers alone (host ${redA}, visitor ${redB})`);
  await B.evaluate(h => { const g = window.pokecraft; g.player.pos.set(h[0], h[1], h[2]); g.player.vel.set(0, 0, 0); }, home);
  await A.waitForFunction(() => { const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'cyber'); return gym.rooms[0].friend.every(([x, y, z]) => g.world.get(x, y, z) === 59); }, null, { timeout: 60000, polling: 200 }).catch(() => {});
  t.ok((await friendIds(A)).every(id => id === 59), 'when the visitor steps off the pad the friend lane closes again');

  // T23 Cozy Gym: the host's cozy home gets the gym moved in (only the owner's browser decides); the visitor sees the
  // people inside the host's home, the guide does not ask them to catch anything, "chilly" agrees in both browsers, and
  // the visitor can battle there. Both browsers get the same house blocks (blocks are not sent in this test).
  const cozyHouse = await A.evaluate(async () => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js');
    const s = g.spawnPoint, F = 42;
    let X0 = null, Z0 = null;
    search: for (let r = 0; r < 160; r += 8) for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
      const x = Math.floor(s.x) + 6 + dx, z = Math.floor(s.z) - 14 + dz;
      let free = x > 2 && z > 2 && x + 16 < 220 && z + 16 < 220;
      for (let a = 0; free && a < 16; a += 4) for (let b = 0; free && b < 16; b += 4) for (let y = F; y <= F + 13; y += 3) if (g.world.protectedAt(x + a, y, z + b)) free = false;
      if (free) { X0 = x; Z0 = z; break search; }
    }
    return X0 === null ? null : [X0, Z0];
  });
  t.ok(cozyHouse, 'found a free patch for the host\'s cozy house');
  const build = async ([X0, Z0]) => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js'), { placeExample } = await import('/src/hometypes.js');
    for (let x = -2; x < 12; x++) for (let z = -2; z < 12; z++) {
      g.world.set(X0 + x, 42, Z0 + z, B.STONE);
      for (let y = 1; y <= 12; y++) g.world.set(X0 + x, 42 + y, Z0 + z, B.AIR);
    }
    return placeExample(g.world, 'cozy', X0, 42, Z0);
  };
  const mat = await A.evaluate(build, cozyHouse);
  await B.evaluate(build, cozyHouse);
  await A.evaluate(([mat]) => {
    const g = window.pokecraft;
    window.__sentHomes = []; const sh = g.mp.sendHome.bind(g.mp); g.mp.sendHome = r => { window.__sentHomes.push(r); return sh(r); };
    g.homes.place(...mat);
    for (const id of ['snugbun', 'purrmit', 'pillowlamb']) g.book.caught.add(id);
    g.player.pos.set(mat[0] + 0.5, mat[1] + 1, mat[2] + 5.5);
  }, [mat]);
  const peopleIn = P => P.evaluate(() => {
    const g = window.pokecraft, h = g.homes.worldOwnerHome(), r = h?.report;
    const list = g.npcs.list.filter(n => n.gym?.def.id === 'cozy');
    return !!r?.inside && list.length === 3 && list.every(n => !n.away && r.inside.some(([a, b]) => a === Math.floor(n.pos.x) && b === Math.floor(n.pos.z)));
  });
  await A.waitForFunction(() => window.pokecraft.homes.mine()?.gyms.includes('cozy') && window.pokecraft.gymLive.of('cozy').phase === '', null, { timeout: 90000, polling: 200 }).catch(() => {});
  await B.waitForFunction(() => window.pokecraft.homes.worldOwnerHome()?.gyms.includes('cozy'), null, { timeout: 60000, polling: 200 }).catch(() => {});
  await B.waitForFunction(() => { const g = window.pokecraft, h = g.homes.worldOwnerHome(), r = h?.report, l = g.npcs.list.filter(n => n.gym?.def.id === 'cozy'); return !!r?.inside && l.length === 3 && l.every(n => !n.away); }, null, { timeout: 60000, polling: 200 }).catch(() => {});
  t.ok(await peopleIn(A), 'the host sees the Cozy Gym people inside their home');
  t.ok(await peopleIn(B), 'the visitor sees the Cozy Gym people inside the host\'s home');
  // T30.5: no type in the message; the visitor works out the same types from the same blocks
  const typesA = await A.evaluate(() => ({ sent: window.__sentHomes.length, noType: !window.__sentHomes.some(r => 'type' in r), types: window.pokecraft.homes.mine().types.join() }));
  const typesB = await B.evaluate(() => window.pokecraft.homes.worldOwnerHome()?.types.join());
  t.ok(typesA.sent > 0 && typesA.noType && typesA.types === 'cozy' && typesB === 'cozy', `the home message has no type, both browsers say cozy (${JSON.stringify(typesA)} ${typesB})`);
  const guideB = await B.evaluate(async () => { // the arrow follows the nearest unbeaten gym: leave only the Cozy Gym
    const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
    window.__oldBadges = g.badges; g.badges = GYMS.map(x => x.id).filter(id => id !== 'cozy');
    g.updateGuide(); return document.getElementById('guide').textContent; });
  t.ok(guideB.includes('Cozy Gym') && !guideB.includes('catch 3') && !guideB.includes('build a cozy home'), `the visitor's guide does not ask for cozy creatures (${guideB})`);
  const furniture = await A.evaluate(async () => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js'), h = g.homes.mine(), found = [];
    for (let x = h.x - 12; x <= h.x + 12; x++) for (let z = h.z - 12; z <= h.z + 12; z++) for (let y = h.y; y <= h.y + 6; y++) {
      const id = g.world.get(x, y, z);
      if (id === B.BED || id === B.FIREPLACE || id === B.LAMP) found.push([x, y, z, id]);
    }
    for (const [x, y, z] of found) { g.world.set(x, y, z, B.AIR); g.mp.sendBlock(x, y, z, B.AIR); }
    return found;
  });
  await B.waitForFunction(() => !window.pokecraft.homes.worldOwnerHome()?.finished, null, { timeout: 60000, polling: 200 }).catch(() => {});
  const chillyB = await B.evaluate(() => {
    const g = window.pokecraft, l = g.npcs.list.find(n => n.gym?.def.id === 'cozy' && n.kind === 'leader');
    document.exitPointerLock();
    g.talkTo(l);
    return { toast: document.getElementById('toast').textContent, battle: g.inBattle };
  });
  t.ok(chillyB.toast.includes('Brr') && !chillyB.battle, `breaking the furniture on the host makes it chilly for the visitor too (${chillyB.toast})`);
  await A.evaluate(([f]) => { const g = window.pokecraft; for (const [x, y, z, id] of f) { g.world.set(x, y, z, id); g.mp.sendBlock(x, y, z, id); } }, [furniture]);
  await B.waitForFunction(() => window.pokecraft.homes.worldOwnerHome()?.finished, null, { timeout: 60000, polling: 200 }).catch(() => {});
  await B.evaluate(async () => {
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    window.__oldParty = g.party;
    g.party = [makeCreature('tidalord', 70), makeCreature('thunderwolf', 70), makeCreature('grovebeast', 70)];
    const n = g.npcs.list.find(n => n.gym?.def.id === 'cozy' && n.kind === 'trainer' && n.index === 0);
    g.player.pos.set(n.pos.x + 1.5, n.pos.y, n.pos.z);
    g.talkTo(n);
  });
  t.ok(await playBattle(B), 'the visitor battles Knitter Bea in the host\'s home');
  t.ok(await B.evaluate(() => window.pokecraft.beaten.includes('cozy:trainer')), 'the visitor remembers beating her');
  await B.evaluate(() => { const g = window.pokecraft; g.party = window.__oldParty; g.badges = window.__oldBadges; g.beaten = g.beaten.filter(k => !k.startsWith('cozy:')); });

  // The visitor is in a battle when the host stops: they go home only after the battle.
  await B.evaluate(async () => {
    const g = window.pokecraft;
    const S = await import('/src/species.js');
    const { Wild } = await import('/src/creatures.js');
    const wild = new Wild(S.makeCreature('fluffin', 2), S.buildModel('fluffin'), g.player.pos.clone().setX(g.player.pos.x + 3));
    wild.data.hp = 1;
    g.creatures.list.push(wild);
    g.startBattle({ wild });
  });
  await A.evaluate(() => { document.exitPointerLock(); document.getElementById('pause').classList.remove('hidden'); });
  await A.waitForTimeout(400);
  await click(A, '#mp button:has-text("Stop sharing")');
  await B.waitForTimeout(5000);
  t.ok(await B.evaluate(() => window.pokecraft.inBattle && window.pokecraft.hostLeft), 'the visitor is not sent home in the middle of a battle');
  await playBattle(B);
  await B.waitForTimeout(5000);
  await B.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 20000 });
  await B.waitForTimeout(1000);
  await continueGame(B);
  t.ok(await B.evaluate(s => window.pokecraft.world.seed === s && window.pokecraft.party[0].species === 'sproutle', seedB), 'when the host stops, the visitor goes home with their own world and team');
  t.ok(!A.errors.length && !B.errors.length, `no page errors ${[...A.errors, ...B.errors].join('; ')}`);
  await A.context().close(); await B.context().close();
}
