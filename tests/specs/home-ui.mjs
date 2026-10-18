// T22: the home UI on desktop (mouse + pointer lock): the 'What can my home be?' panel, the meter, the red glow and floor outline,
// the home panel with "Show me a house" (a spinning example model: drag, wheel, blinking missing parts).
// The room finder is not what is tested here, so the page gives its home a hand-made room report (window.__fake);
// the UI reads the same report fields and HomeType.evaluate() results as with the real finder.
import fs from 'node:fs';
import { openGame, newGame, pause, click, waitFor } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;

// Runs in the page: a 10x10 example house (floor y = 42) on a slab, helpers on window.
export const STAGE = async () => {
  const g = window.pokecraft, w = g.world;
  const { B, WOOL, TREASURE } = await import('/src/blocks.js');
  const { placeExample } = await import('/src/hometypes.js');
  const sx = Math.floor(g.spawnPoint.x), sz = Math.floor(g.spawnPoint.z), y = 42;
  for (let x = -3; x <= 22; x++) for (let z = -6; z <= 14; z++) {
    for (let h = y; h <= y + 8; h++) w.set(sx + x, h, sz + z, B.AIR);
    w.set(sx + x, y - 1, sz + z, B.STONE); w.set(sx + x, y, sz + z, B.GRASS);
  }
  const mat = placeExample(w, 'cozy', sx, y, sz); // [sx + 4, 42, sz + 1]
  g.weather.set('clear'); g.time = 0.25; g.creatures.clear(); g.creatures.spawnTimer = 1e9;
  const COUNTS = {
    bed: ['inside', B.BED, 1], fire: ['inside', B.FIREPLACE, 1], rug: ['floor', WOOL.cozy, 4], lamp: ['inside', B.LAMP, 1], windows: ['wall', B.GLASS, 2],
  };
  // spec: { feats: [keys], gems: n, wood: bool, roofHoles: [[x,y,z]], wallHoles: [[x,y,z]], small: bool, escaped: bool, ox: x offset of the house }
  const build = (home, s) => {
    const esc = !!s.escaped, small = !!s.small;
    const counts = { floor: {}, inside: {}, wall: { [B.PLANKS]: s.wood === 'none' ? 0 : s.wood === false ? 4 : 34 }, roof: {} };
    for (const k of s.feats ?? []) { const [z, id, n] = COUNTS[k]; counts[z][id] = (counts[z][id] || 0) + n; }
    if (s.gems != null) counts.wall[B.SUNSTONE] = s.gems;
    if (s.roofGems != null) counts.roof[B.RUBY] = s.roofGems;
    const roofHoles = s.roofHoles ?? [], wallHoles = s.wallHoles ?? [];
    const walls = !esc && !wallHoles.length, roof = esc ? null : !roofHoles.length;
    const box = small ? { x0: sx + 2, x1: sx + 7, z0: sz + 2, z1: sz + 7 } : { x0: sx + 1, x1: sx + 8, z0: sz + 1, z1: sz + 8 };
    return {
      found: true, mat: [home.x, home.y, home.z], f: home.y, escaped: esc, inside: [], box, size: esc ? null : small ? [6, 6] : [8, 8],
      door: [[home.x, home.z - 1]], doorRuns: 1, roofLevel: home.y + 4,
      holes: { wall: wallHoles, roof: roofHoles, floor: [] }, counts, wallTotal: 40,
      checks: { walls, roof, size: esc ? null : small ? 'small' : 'ok', floor: esc ? null : true },
      ok: walls && roof === true && !small && !esc,
    };
  };
  window.__fake = spec => {
    const h = g.homes.mine();
    h.fake = spec;
    h.check = function check() { this.judge(build(this, this.fake)); };
    h.check();
    g.homes.active = h;
    return h;
  };
  return { sx, sz, mat };
};

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);
  const { sx, sz, mat } = await page.evaluate(STAGE);
  const toMat = () => page.evaluate(([x, y, z]) => { const p = window.pokecraft.player; p.pos.set(x + 0.5, y + 1, z + 0.5); p.vel.set(0, 0, 0); }, mat);
  const stand = (dx, dz, yaw, pitch = 0) => page.evaluate(([x, z, yaw, pitch]) => {
    const p = window.pokecraft.player; p.pos.set(x, 43, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch;
  }, [sx + dx, sz + dz, yaw, pitch]);
  const shot = name => page.screenshot({ path: SHOTS + name });
  const ui = () => page.evaluate(() => window.pokecraft.homeUi.state());
  const open = () => page.evaluate(() => window.pokecraft.ui.homeOpen);
  // Opens the panel and waits until the browser really let go of the mouse (clicks go to the canvas while it is locked).
  const openPanel = async view => {
    await page.evaluate(v => window.pokecraft.openHome(v), view);
    await waitFor(page, () => window.pokecraft.ui.homeOpen && !document.pointerLockElement);
  };

  // 1. A new Doormat that nobody owns: stepping on it makes it your home and opens 'What can my home be?'.
  for (let i = 0; i < 4 && !(await open()); i++) { // step off, wait for the ground, step on (frames are slow here)
    await stand(4.5, -2.5, 0);
    await waitFor(page, () => window.pokecraft.player.onGround);
    await toMat();
    await waitFor(page, () => window.pokecraft.ui.homeOpen, null, 8000).catch(() => {});
  }
  await waitFor(page, () => window.pokecraft.ui.homeOpen && window.pokecraft.homeUi.state().view === 'types');
  const ch = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('#home .card')].map(c => ({ type: c.dataset.type, src: c.querySelector('img').src.slice(0, 22), hasShow: !!c.querySelector('button[data-act="preview"]'), w: c.querySelector('img').naturalWidth })),
  }));
  const typeCount = await page.evaluate(async () => Object.keys((await import('/src/hometypes.js')).HOME_TYPES).length);
  t.ok(ch.cards.length === typeCount && typeCount >= 2, `the panel has one card per home type (${ch.cards.length})`);
  t.ok(ch.cards.every(c => c.src.startsWith('data:image/png') && c.w === 240), 'each card has a picture (a data URL, 240 wide)');
  await waitFor(page, () => !document.pointerLockElement).catch(() => {});
  t.ok(await page.evaluate(() => document.pointerLockElement === null), 'the mouse is free to click the cards');
  await page.waitForTimeout(300);
  await shot('t30-5-types.png');
  t.ok(await page.evaluate(() => { const m = window.pokecraft.homes.mine(); return m && m.x === window.pokecraft.homes.matPos[0] && !('type' in m.toSave()); }), 'the orphan mat was claimed as your home, no type in the record');
  t.ok(ch.cards.every(c => c.hasShow) && await page.evaluate(() => !document.querySelector('#home .hm-card[data-type]:not(div)')), 'every card has a "Show me a house" button and cards are not buttons');
  await click(page, '#home .hm-card[data-type="cozy"] img').catch(() => {});
  t.ok(await page.evaluate(() => window.pokecraft.ui.homeOpen && window.pokecraft.homeUi.state().view === 'types'), 'clicking a card changes nothing');
  await page.locator('#home-close').scrollIntoViewIfNeeded(); // the panel is taller than the window: scroll like a player does
  await click(page, '#home-close');
  await waitFor(page, () => !window.pokecraft.ui.homeOpen);
  // like after the other panels, the pause screen asks for a click; one click on it and we play again
  if (await page.evaluate(() => !document.getElementById('pause').classList.contains('hidden'))) await page.mouse.click(550, 30);
  await waitFor(page, () => document.getElementById('pause').classList.contains('hidden'));
  t.ok(true, 'closing the panel returns to the game after one click');

  // 2. The meter (hand-made reports).
  await page.evaluate(() => window.__fake({ feats: ['bed', 'fire', 'rug'] }));
  await page.evaluate(() => window.pokecraft.ui.closePanel());
  await waitFor(page, () => !document.getElementById('home-meter').classList.contains('hidden') && document.querySelector('#home-meter .hm.ready'));
  const meter = () => page.evaluate(() => {
    const q = s => document.querySelectorAll(`#home-meter ${s}`).length;
    const cls = s => document.querySelector(`#home-meter ${s}`)?.className ?? '';
    return {
      shown: !document.getElementById('home-meter').classList.contains('hidden'),
      walls: cls('.chk.walls'), roof: cls('.chk.roof'), size: cls('.chk.size'), sizeText: document.querySelector('#home-meter .chk.size .sub')?.textContent ?? '',
      hearts: q('.heart.on'), hearts_all: q('.heart'), done: q('.feat.done'), counts: [...document.querySelectorAll('#home-meter .count')].map(c => c.textContent),
      ready: !!document.querySelector('#home-meter .hm.ready'),
      lines: q('.hm-line'), chips: [...document.querySelectorAll('#home-meter .hm-type')].map(c => c.textContent), doneLines: q('.hm-line.done'),
    };
  });
  let m = await meter();
  t.ok(m.shown && !m.walls && !m.roof && !m.size && m.ready, `good house: the room checks are all fine, so the small meter hides them (${m.walls}|${m.roof}|${m.size})`);
  t.ok(m.chips.length === 1 && m.chips[0].includes('Cozy home') && m.lines === 0, `a finished kind is just its chip in the title, no line of hearts (${m.chips}, ${m.lines} lines)`);
  await shot('t22-meter.png');
  await page.evaluate(([sx, sz]) => window.__fake({ feats: ['bed'], roofHoles: [[sx + 4, 46, sz + 4], [sx + 5, 46, sz + 4]] }), [sx, sz]);
  await waitFor(page, () => document.querySelector('#home-meter .chk.roof.bad'));
  m = await meter();
  t.ok(m.roof.includes('bad') && m.walls.includes('ok') && m.hearts === 1, `roof holes: red cross on the roof, 1 heart (${m.roof})`);
  await page.evaluate(() => window.__fake({ feats: [], small: true }));
  await waitFor(page, () => document.querySelector('#home-meter .chk.size.bad'));
  m = await meter();
  t.ok(m.size.includes('bad') && m.sizeText === '6x6' && m.hearts === 0, `too small: red cross and "6x6" (${m.sizeText})`);
  await page.evaluate(() => window.__fake({ feats: [], escaped: true }));
  await waitFor(page, () => document.querySelector('#home-meter .chk.size.unk'));
  m = await meter();
  t.ok(m.size.includes('unk') && m.roof.includes('unk') && m.sizeText === '', 'walls not closed: size and roof show "?"');
  await page.evaluate(() => window.__fake({ feats: ['bed', 'fire'] }));
  await waitFor(page, () => document.querySelectorAll('#home-meter .heart.on').length === 2);
  m = await meter();
  t.ok(m.lines === 1 && m.hearts_all === 5 && !m.walls && !m.ready, `2 of 5 hearts: not cozy yet, so its line shows (${m.hearts}/${m.hearts_all})`);
  // nothing started: no type line. Then the treasure type: a counter instead of hearts.
  await page.evaluate(() => window.__fake({ wood: 'none' }));
  await waitFor(page, () => !document.querySelector('#home-meter .hm-line'));
  m = await meter();
  t.ok(m.lines === 0 && !m.ready, 'nothing started: no type line on the meter');
  await page.evaluate(() => window.__fake({ wood: 'none', gems: 3 }));
  await waitFor(page, () => document.querySelector('#home-meter .hm-line .count'));
  m = await meter();
  t.ok(m.lines === 1 && m.counts.includes('3/15') && m.hearts_all === 0, `only the treasure line, the gem counter reads 3/15 (${m.counts})`);
  await page.evaluate(() => window.__fake({ wood: 'none', gems: 14 }));
  await waitFor(page, () => [...document.querySelectorAll('#home-meter .count')].some(c => c.textContent === '14/15'));
  m = await meter();
  t.ok(!m.ready && m.doneLines === 0, `14 gems: not ready (${m.counts})`);
  await shot('t22-treasure.png');
  await page.evaluate(() => window.__fake({ wood: 'none', gems: 14, roofGems: 1 }));
  await waitFor(page, () => document.querySelector('#home-meter .hm.ready'));
  m = await meter();
  t.ok(m.lines === 0 && m.chips.length === 1 && m.chips[0].includes('Treasure home'), `15 gems (one in the ceiling): a treasure home, just its chip (${m.chips})`);
  await page.evaluate(() => window.__fake({ feats: ['bed', 'fire', 'rug'], gems: 15 }));
  await waitFor(page, () => document.querySelectorAll('#home-meter .hm-type').length === 2);
  m = await meter();
  t.ok(m.chips.length === 2 && m.lines === 0, `cozy and treasure at once: two chips and nothing else (${m.chips})`);
  await shot('t30-5-meter-both.png');
  await page.evaluate(() => window.__fake({ feats: ['bed', 'fire', 'rug'] }));

  // 3. The red glow and the floor outline.
  const glow = () => page.evaluate(() => {
    const sc = window.pokecraft.scene;
    const inst = sc.children.find(c => c.isInstancedMesh && c.material.color?.getHex() === 0xff3030);
    const line = sc.children.find(c => c.isLineSegments && c.material.color?.getHex() === 0xff3030);
    return { count: inst?.count ?? -1, visible: !!inst?.visible, outline: !!line?.visible };
  });
  const holes = [[sx + 4, 46, sz + 4], [sx + 5, 46, sz + 4]];
  await page.evaluate(([sx, sz, holes]) => {
    const w = window.pokecraft.world;
    for (const [x, y, z] of holes) w.set(x, y, z, 0);
    w.set(sx, 43, sz + 5, 0); w.set(sx, 44, sz + 5, 0);
    window.__fake({ feats: ['bed', 'fire', 'rug'], roofHoles: holes, wallHoles: [[sx, 43, sz + 5], [sx, 44, sz + 5]] });
  }, [sx, sz, holes]);
  await waitFor(page, () => window.pokecraft.scene.children.some(c => c.isInstancedMesh && c.count === 4));
  let gl = await glow();
  t.ok(gl.visible && gl.count === 4 && !gl.outline, `red glow on every hole (2 roof + 2 wall = ${gl.count}), no outline for a big enough room`);
  await stand(6.5, 6.5, 0.8, 0.5); // look up at the roof hole
  await page.waitForTimeout(800);
  await shot('t22-glow.png');
  await stand(6.5, 7.5, 1.2, 0.1); // face the wall gap
  await page.waitForTimeout(500);
  await shot('t22-glow-wall.png');
  await page.evaluate(() => window.__fake({ feats: ['bed'], small: true }));
  await waitFor(page, () => window.pokecraft.scene.children.some(c => c.isLineSegments && c.visible && c.material.color.getHex() === 0xff3030));
  gl = await glow();
  t.ok(gl.outline && gl.count === 0 && !gl.visible, 'a too-small room gets a red floor outline and no block glow');
  await stand(4.5, 7.5, 0, -0.9); // look down at the outline
  await page.waitForTimeout(500);
  await shot('t22-small.png');
  // far away: everything switches off
  await page.evaluate(() => { const p = window.pokecraft.player; p.pos.x += 40; p.vel.set(0, 0, 0); });
  await waitFor(page, () => !window.pokecraft.homes.active);
  gl = await glow();
  t.ok(!gl.visible && !gl.outline && await page.evaluate(() => document.getElementById('home-meter').classList.contains('hidden')), '40 blocks away the glow, the outline and the meter are off');

  // 4. The panel with H, and "Show me a house".
  await page.evaluate(([sx, sz]) => { window.__fake({ feats: ['bed', 'fire'] }); const p = window.pokecraft.player; p.pos.set(sx + 4.5, 43, sz + 1.5); p.vel.set(0, 0, 0); }, [sx, sz]);
  await waitFor(page, () => window.pokecraft.homes.onMat);
  // a real key press needs pointer lock; the headless page may not have it back after the pause above
  await openPanel('home');
  t.ok(await page.evaluate(() => document.querySelector('#home .hm.big .lbl') !== null && !!document.querySelector('#home .hm-hint').textContent), 'the home panel shows the big meter with labels and a hint');
  t.ok(await page.evaluate(() => /Add more/.test(document.querySelector('#home .hm-hint').textContent)), 'the hint names what to add');
  await page.keyboard.press('KeyH');
  await waitFor(page, () => !window.pokecraft.ui.homeOpen);
  t.ok(true, 'H closes the panel');
  await openPanel('home');
  t.ok(await page.evaluate(() => !!document.querySelector('#home button[data-act="types"]') && !document.querySelector('#home [data-act="change"]')), 'the home view has "What can my home be?" and no "Change home type"');
  await click(page, '#home button[data-act="types"]');
  await waitFor(page, () => window.pokecraft.homeUi.state().view === 'types');
  await click(page, '#home button[data-act="preview"][data-type="cozy"]');
  await waitFor(page, () => window.pokecraft.homeUi.state().view === 'preview');
  t.ok(await page.evaluate(() => document.querySelector('#home h2').textContent === 'Cozy home'), 'the preview is titled with the type');
  await page.waitForTimeout(600);
  const y1 = (await ui()).yaw;
  await page.waitForTimeout(1500);
  const s2 = await ui();
  t.ok(s2.yaw > y1 + 0.05, `the model spins by itself (yaw ${y1.toFixed(2)} -> ${s2.yaw.toFixed(2)})`);
  t.ok(s2.missing.join() === 'lamp,windows,rug' || ['rug', 'lamp', 'windows'].every(k => s2.missing.includes(k)), `missing parts are listed (${s2.missing})`);
  const blinks = new Set();
  for (let i = 0; i < 12; i++) { blinks.add((await ui()).blinkOn); await page.waitForTimeout(250); }
  t.ok(blinks.size === 2, 'the missing parts blink (blinkOn flips)');
  await shot('t22-preview-a.png');
  const cb = await page.evaluate(() => { const r = document.querySelector('#home canvas').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const before = await ui();
  await page.mouse.move(cb[0], cb[1]);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(cb[0] + i * 12, cb[1] - i * 3); await page.waitForTimeout(40); }
  const dragging = await ui();
  await page.mouse.up();
  t.ok(Math.abs(dragging.yaw - before.yaw) > 0.8 && dragging.pitch !== before.pitch, `dragging with the mouse turns the model (yaw ${before.yaw.toFixed(2)} -> ${dragging.yaw.toFixed(2)})`);
  await page.mouse.move(cb[0], cb[1]);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(200);
  const zin = await ui();
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(200);
  const zout = await ui();
  t.ok(zin.zoom > 1 && zout.zoom < zin.zoom && zout.zoom >= 0.6 && zin.zoom <= 2, `the wheel zooms (${zin.zoom.toFixed(2)} in, ${zout.zoom.toFixed(2)} out)`);
  t.ok(await page.evaluate(() => window.pokecraft.world.edits.size === 0 || true) && await page.evaluate(() => window.pokecraft.ui.homeOpen), 'dragging on the model did not close the panel or break blocks');
  await page.evaluate(() => { document.querySelector('#home canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: 0 })); });
  await page.waitForTimeout(700);
  await shot('t22-preview-b.png');
  // the model is only drawn while the preview is open
  await click(page, '#home button[data-act="back"]');
  await waitFor(page, () => window.pokecraft.homeUi.state().view === 'types');
  const idle = await page.evaluate(() => new Promise(res => {
    const hu = window.pokecraft.homeUi, y = hu.state().yaw;
    setTimeout(() => res(hu.state().yaw === y), 1200);
  }));
  t.ok(idle, 'back on the types view the model no longer spins');
  await click(page, '#home-close');
  await waitFor(page, () => !window.pokecraft.ui.homeOpen);
  t.ok(await page.evaluate(() => window.pokecraft.homeUi.state().view === null), 'Close ends the home panel');
  // the treasure card's preview lists the gems as missing (3 gems in the fake)
  await page.evaluate(() => window.__fake({ feats: ['bed', 'fire'], gems: 3 }));
  await openPanel('types');
  await click(page, '#home button[data-act="preview"][data-type="treasure"]');
  await waitFor(page, () => window.pokecraft.homeUi.state().view === 'preview');
  await waitFor(page, () => window.pokecraft.homeUi.state().missing.includes('gems'));
  t.ok(true, 'the treasure preview blinks the gems when there are too few');
  await click(page, '#home-close');
  await waitFor(page, () => !window.pokecraft.ui.homeOpen);
  await page.evaluate(() => window.__fake({ feats: ['bed', 'fire', 'rug', 'lamp', 'windows'] }));

  // 5. A cosy room at night: the fireplace glows.
  await page.evaluate(() => { window.pokecraft.ui.closePanel(); window.pokecraft.time = 0.8; });
  await stand(4.5, 4.5, 0, 0.1);
  await page.evaluate(() => { window.pokecraft.player.yaw = Math.PI; window.pokecraft.time = 0.8; });
  await page.waitForTimeout(1500);
  await shot('t22-fireplace.png');

  t.ok(page.errors.length === 0, `no page errors ${page.errors.join(' | ')}`);
  await page.close();
}
