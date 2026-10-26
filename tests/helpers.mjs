// Shared test helpers: a tiny static server, a browser with software WebGL, and a game page
// whose CDN scripts come from local copies (some environments block unpkg and jsdelivr).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/three/build/three.module.js');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

export function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url.endsWith('/') ? url + 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

export const launch = () => chromium.launch({ executablePath: process.env.PC_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

// Opens the game in a fresh browser context (its own localStorage).
// online: false blocks Supabase so tests never touch the real project.
export async function openGame(browser, base, { query = '', contextOptions = {}, online = false, setup } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, ...contextOptions });
  if (setup) await setup(ctx);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.route('https://unpkg.com/**', r => r.fulfill({ path: THREE, contentType: 'application/javascript' }));
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  if (!online) {
    await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
    await page.route('https://*.supabase.co/**', r => r.abort());
  }
  page.on('dialog', d => d.accept());
  await page.goto(base + '/' + query, { timeout: 120000 });
  await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  return page;
}

// Two players in separate browsers. The test relays messages between them in place of Supabase
// Realtime (?mp=local + a BroadcastChannel stand-in), because many test environments block WebSockets.
export async function openPair(browser, base, { contextOptions = {} } = {}) {
  const pages = {};
  const relay = other => async ctx => {
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
  pages.A = await openGame(browser, base, { query: '?mp=local', contextOptions, setup: relay('B') });
  pages.B = await openGame(browser, base, { query: '?mp=local', contextOptions, setup: relay('A') });
  return [pages.A, pages.B];
}

// Real mouse click at the centre of an element (catches overlays that block clicks).
export async function click(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`not visible: ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

// Title screen -> New Game -> starter n. Leaves the game running with the mouse captured.
export async function newGame(page, starter = 0) {
  await click(page, '#title-buttons button:has-text("New Game")');
  await page.waitForTimeout(500);
  await click(page, `.starter >> nth=${starter}`);
  await page.waitForTimeout(1500);
}

// Pause the way a player does: release the mouse (Esc). Note: while the mouse is captured
// (pointer lock), every click goes to the canvas, so always pause like this before clicking UI.
export async function pause(page) {
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForTimeout(500);
}

// Clicks the first enabled battle button until the battle is over (or gives up). Attack
// animations make battles slower on the software renderer, so allow a few minutes.
export async function playBattle(page, prefer) {
  for (let i = 0; i < 300; i++) {
    if (!(await page.evaluate(() => window.pokecraft.inBattle))) return true;
    await page.evaluate(pref => {
      const bs = [...document.querySelectorAll('#b-actions button:not([disabled])')];
      const no = bs.find(b => b.textContent.startsWith("Don't learn")); // a forget prompt (big moves are offered at Lv 21+): keep the attacks
      if (no) { no.click(); return; }
      (bs.find(b => pref && b.textContent.startsWith(pref)) || bs.find(b => { const s = b.querySelector('small')?.textContent || ''; return s.includes('power ') && !s.includes('half the time'); }) || bs[0])?.click();
    }, prefer);
    await page.waitForTimeout(700);
  }
  return false;
}

// A new-browser init script that puts a save in localStorage once (use as openGame's setup option).
export const seedSave = save => ctx => ctx.addInitScript(json => {
  if (!sessionStorage.getItem('seeded')) { localStorage.setItem('pokecraft-save-v2', json); sessionStorage.setItem('seeded', '1'); }
}, typeof save === 'string' ? save : JSON.stringify(save));

// A small stone platform high in the air, so nothing else is in the way. day: also set the time to noon-ish.
export const platform = (page, { day = false } = {}) => page.evaluate(day => {
  const g = window.pokecraft, s = g.spawnPoint, y = 42;
  for (let x = -4; x <= 6; x++) for (let z = -4; z <= 4; z++) g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3);
  g.player.pos.set(Math.floor(s.x) + 0.5, y + 1, Math.floor(s.z) + 0.5);
  g.player.vel.set(0, 0, 0);
  if (day) g.time = 0.25;
}, day);

// Starts a wild battle against a level-2 Fluffin with 1 HP, for a party of one.
export const startWeakBattle = (page, { species, level, moves, xpToNext }) => page.evaluate(async ({ species, level, moves, xpToNext }) => {
  const g = window.pokecraft;
  const S = await import('/src/species.js');
  const { Wild } = await import('/src/creatures.js');
  const c = S.makeCreature(species, level, moves);
  if (xpToNext) c.xp = S.xpForLevel(level + 1) - 1;
  g.party = [c];
  const wild = new Wild(S.makeCreature('fluffin', 2), S.buildModel('fluffin'), g.player.pos.clone().setX(g.player.pos.x + 3));
  wild.data.hp = 1;
  g.creatures.list.push(wild);
  g.scene.add(wild.model); // the game adds a wild creature's model when it spawns...
  wild.model.position.copy(wild.pos); // ...and places it
  g.inBattle = true; document.body.classList.add('in-battle');
  document.getElementById('pause').classList.add('hidden'); // like startBattle() in main.js
  g.battle.start({ wild });
}, { species, level, moves, xpToNext });

// Title screen -> Continue; returns once the game is running (no fixed sleep).
export async function continueGame(page) {
  await click(page, '#title-buttons button:has-text("Continue")');
  await page.waitForFunction(() => window.pokecraft.started, null, { timeout: 30000, polling: 100 });
  await page.waitForTimeout(300);
}

// Waits until fn (run in the page, with arg) returns something truthy. Use instead of a fixed sleep:
// the software renderer is slow and its speed changes with the load.
export const waitFor = (page, fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });

export class Checks {
  constructor(name) { this.name = name; this.results = []; }
  ok(cond, label) { this.results.push({ pass: !!cond, label }); console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); }
  get failed() { return this.results.filter(r => !r.pass).length; }
}
