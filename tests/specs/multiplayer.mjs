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
  // T17: the visitor gets the whole 288 x 288 world, and a forged "block" message can't open a gym wall.
  t.ok(await B.evaluate(() => { const w = window.pokecraft.world; return w.W === 288 && w.D === 288 && w.get(250, 1, 250) !== 0; }), 'the visitor gets the bigger world, new land included');
  const wall = await B.evaluate(() => {
    const g = window.pokecraft, w = g.world, gym = w.gyms.find(x => !x.cave && !x.sky);
    for (let y = gym.y; y <= gym.y + 5; y++) for (let a = -6; a <= 6; a++) for (const b of [-6, 6]) if (w.get(gym.x + a, y, gym.z + b) !== 0) return [gym.x + a, y, gym.z + b];
    return null;
  });
  await A.evaluate(([x, y, z]) => { window.pokecraft.mp.sendBlock(x, y, z, 0); }, wall);
  await B.waitForTimeout(1500);
  t.ok(wall && await B.evaluate(([x, y, z]) => window.pokecraft.world.get(x, y, z) !== 0, wall), 'a block message that would break a gym wall is ignored by the visitor');

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
