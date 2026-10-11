// Play together, with two separate browsers. The test relays messages between them in place of
// Supabase Realtime (?mp=local + a BroadcastChannel stand-in), because many test environments
// block WebSockets.
import { openGame, newGame, click, pause } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const pages = {};
  const relay = (me, other) => async ctx => {
    await ctx.exposeBinding('__relaySend', async (_s, ch, data) => {
      await pages[other]?.evaluate(([ch, data]) => window.__relayRecv(ch, data), [ch, data]).catch(() => {});
    });
    await ctx.addInitScript(() => {
      const chans = {};
      window.__relayRecv = (name, data) => (chans[name] || []).forEach(c => c.onmessage?.({ data }));
      window.BroadcastChannel = class {
        constructor(name) { this.name = name; (chans[name] ||= []).push(this); }
        postMessage(data) { window.__relaySend(this.name, data); }
        close() { chans[this.name] = (chans[this.name] || []).filter(c => c !== this); }
      };
    });
  };
  const A = pages.A = await openGame(browser, base, { query: '?mp=local', setup: relay('A', 'B') });
  const B = pages.B = await openGame(browser, base, { query: '?mp=local', setup: relay('B', 'A') });
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

  await A.evaluate(() => { document.exitPointerLock(); document.getElementById('pause').classList.remove('hidden'); });
  await A.waitForTimeout(400);
  await click(A, '#mp button:has-text("Stop sharing")');
  await B.waitForTimeout(5000);
  await B.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 20000 });
  await B.waitForTimeout(1000);
  await click(B, '#title-buttons button:has-text("Continue")');
  await B.waitForTimeout(1500);
  t.ok(await B.evaluate(s => window.pokecraft.world.seed === s && window.pokecraft.party[0].species === 'sproutle', seedB), 'when the host stops, the visitor goes home with their own world and team');
  t.ok(!A.errors.length && !B.errors.length, `no page errors ${[...A.errors, ...B.errors].join('; ')}`);
  await A.context().close(); await B.context().close();
}
