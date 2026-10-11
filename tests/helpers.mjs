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

export const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

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
  await page.goto(base + '/' + query);
  await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  return page;
}

// Two players in separate browsers. The test relays messages between them in place of Supabase
// Realtime (?mp=local + a BroadcastChannel stand-in), because many test environments block WebSockets.
export async function openPair(browser, base) {
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
  pages.A = await openGame(browser, base, { query: '?mp=local', setup: relay('B') });
  pages.B = await openGame(browser, base, { query: '?mp=local', setup: relay('A') });
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

// Clicks the first enabled battle button until the battle is over (or gives up).
export async function playBattle(page, prefer) {
  for (let i = 0; i < 80; i++) {
    if (!(await page.evaluate(() => window.pokecraft.inBattle))) return true;
    await page.evaluate(pref => {
      const bs = [...document.querySelectorAll('#b-actions button:not([disabled])')];
      (bs.find(b => pref && b.textContent.startsWith(pref)) || bs[0])?.click();
    }, prefer);
    await page.waitForTimeout(700);
  }
  return false;
}

export class Checks {
  constructor(name) { this.name = name; this.results = []; }
  ok(cond, label) { this.results.push({ pass: !!cond, label }); console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); }
  get failed() { return this.results.filter(r => !r.pass).length; }
}
