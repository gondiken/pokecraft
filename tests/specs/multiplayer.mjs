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
