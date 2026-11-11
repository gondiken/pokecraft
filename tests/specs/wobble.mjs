// Chapter 3's world, Wobbleland (plans/chapter3-world.md, ?preview only):
//   land:   the terrain in Node (tests/wobblecheck.mjs): every patch reachable from Inkpot Camp, rings walkable, the wall closes the rest
//   door:   the Paper Door on the Wizard's island: none without being his Ally, none without ?preview; the Ally steps in (the game's own use),
//           arrives at the Camp, reloads inside, walks back up through the way back with real keys, and a following guest is let in
//   look:   the curl (one switch), the first-draft colours, grey where the Scribble is and the colour flood; the main world draws the same
//           frame byte for byte before and after a trip (the WOBBLE define only exists in Wobbleland); draw calls and frame time
//   patches: the fight on every patch from data (tests/wobblebots.mjs: mashing with a type-neutral team under a quarter, skilled all, person
//           times), W walks you into the nearest patch, a win saves its key, +3 cubes, floods its colour, the next patch comes, a reload keeps it
//   WOBBLE_ONLY=land|door|look|patches      screenshots: tests/screenshots/wobble-*.png
import path from 'node:path';
import { ROOT, openGame, newGame, waitFor } from '../helpers.mjs';

const only = process.env.WOBBLE_ONLY;
const want = name => !only || only.split(',').includes(name);
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); }); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const frames = (page, n = 3) => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
// A Champion (and, with ally, the Wizard's Ally) in the Swirl.
export async function intoSwirl(page, { ally = true } = {}) {
  await page.evaluate(ally => { const g = window.pokecraft; g.champion = true; if (ally) { g.studio.won = true; g.studio.ally = true; } g.realms.enter('swirl', { back: g.world.portal.stand }); }, ally);
  await placeIs(page, 'swirl');
  await frames(page, 4);
}
// Through the Paper Door (the game's own use of the block), into Wobbleland.
export async function intoWobble(page) {
  await intoSwirl(page);
  await waitFor(page, () => window.pokecraft.portal.info?.()?.paper, null, 30000).catch(() => {});
  await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[4]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
  await placeIs(page, 'wobble');
}

export default async function ({ browser, base, t }) {
  if (want('land')) {
    const { checkWobble } = await import('../wobblecheck.mjs');
    const r = await checkWobble();
    t.ok(!r.problems.length, `Wobbleland: every patch reachable from the Camp, rings walkable (${r.out.rings.map(q => `${q.id}: ${q.walk} %${q.wet ? ` ${q.wet} wet` : ''}`).join(', ')}), no overlap, the wall closes Bumpy Hills (${r.out.hills} cells behind it) ${r.problems.slice(0, 4).join('; ')}`);
  }

  if (want('patches')) {
    const { wobblePage, runPatches } = await import('../wobblebots.mjs');
    const page = await wobblePage(browser, base);
    const r = await runPatches(page, { games: 2, log: () => {} });
    for (const l of r.lines) t.ok(l.startsWith('ok'), l.replace(/^(ok {2}|FAIL) /, ''));
    // the real loop: W from the Camp side walks you into patch 1 (the nearest), the fight starts
    const p1 = await page.evaluate(() => { const g = window.pokecraft, q = g.world.wobble.patches.find(r => r.id === 1); g.player.pos.set(q.x + 0.5, q.y, q.z + 10.5); g.player.yaw = 0; g.player.pitch = 0; return { info: g.scribble.info(), cubes: g.cubes }; });
    await frames(page, 4);
    t.ok(p1.info.patch === 1 && p1.info.phase === 'idle', `in Wobbleland the live patch is the nearest one you have not cleared (${JSON.stringify({ patch: p1.info.patch, phase: p1.info.phase })})`);
    await page.keyboard.down('w');
    await waitFor(page, () => ['enter', 'fight'].includes(window.pokecraft.scribble.info().phase), null, 60000).catch(() => {});
    await page.keyboard.up('w');
    const f = await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(); return F && { foes: F.foes.map(x => x.c.species), level: F.foes[0].c.level, you: F.squad.map(m => m.c.level) }; });
    t.ok(f && f.foes.join() === 'sproutle,hopsy,chirpit', `walking in starts the fight with the patch's own monsters (${JSON.stringify(f)})`);
    await waitFor(page, () => window.pokecraft.scribble.info().phase === 'fight', null, 60000).catch(() => {});
    await page.evaluate(() => { const F = window.pokecraft.scribble.fightOf(); for (const x of F.foes) F.hit(F.you, x, 9999, 'normal'); });
    await waitFor(page, () => window.pokecraft.scribble.info().patch !== 1 && window.pokecraft.scribble.info().phase === 'idle', null, 90000).catch(() => {});
    await waitFor(page, () => !window.pokecraft.wobbleLook.info().floods, null, 30000).catch(() => {});
    const won = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); return { key: g.beaten.includes(L.patchKey(1)), cubes: g.cubes, next: g.scribble.info().patch, colour: g.wobbleLook.colourAt(L.patchOf(1).x, L.patchOf(1).z) }; });
    t.ok(won.key && won.cubes === p1.cubes + 3 && won.next && won.next !== 1 && won.colour > 0.5, `a win keeps patch 1 cleared (saved), +3 cubes, its colour floods back and the next patch is live (${JSON.stringify(won)})`);
    await page.evaluate(() => window.pokecraft.save?.(true));
    await page.reload();
    await page.waitForFunction(() => window.pokecraft?.world, null, { timeout: 120000 });
    await page.evaluate(() => [...document.querySelectorAll('#title-buttons button')].find(b => /Continue/.test(b.textContent))?.click());
    await placeIs(page, 'wobble');
    await frames(page, 6);
    const after = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'); return { key: g.beaten.includes(L.patchKey(1)), patch: g.scribble.info().patch, colour: g.wobbleLook.colourAt(L.patchOf(1).x, L.patchOf(1).z) }; });
    t.ok(after.key && after.patch !== 1 && after.colour === 1, `after a reload patch 1 stays cleared and coloured (${JSON.stringify(after)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('look')) {
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    // one fixed view of the main world, drawn straight to a buffer
    await page.evaluate(() => {
      const g = window.pokecraft;
      window.__grab = async () => { // only the world's blocks, in a fixed light (creatures, people, the sky and the clock move between the two pictures)
        const C = await import('/src/caves.js'), THREE = await import('three');
        window.__view(); const r = g.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight; g.world.cull(g.camera.position, g.scene.fog.far);
        const own = new Set(Object.values(g.world.materials)), hidden = [];
        for (const o of g.scene.children) if (o.visible && !(o.isMesh && own.has(o.material)) && !o.isLight) { o.visible = false; hidden.push(o); }
        const keep = [C.caveLight.uLit.value, C.caveLight.uLantern.value, g.scene.background, g.scene.fog.color.getHex()];
        C.caveLight.uLit.value = 1; C.caveLight.uLantern.value = 0; g.scene.background = new THREE.Color(0x8899aa); g.scene.fog.color.setHex(0x8899aa);
        r.render(g.scene, g.camera);
        for (const o of hidden) o.visible = true;
        [C.caveLight.uLit.value, C.caveLight.uLantern.value, g.scene.background] = keep; g.scene.fog.color.setHex(keep[3]); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); let h = 0; for (let i = 0; i < b.length; i += 7) h = (h * 31 + b[i]) >>> 0; return { h, defines: Object.values(g.world.materials).filter(m => m.defines?.WOBBLE).length }; };
      window.__view = () => { const g = window.pokecraft, s = g.spawnPoint; g.player.pos.copy(s); g.player.yaw = 0.7; g.player.pitch = -0.1; g.camera.position.set(s.x, s.y + 1.6, s.z); g.camera.rotation.set(-0.1, 0.7, 0); g.camera.updateMatrixWorld(); };
    });
    await page.evaluate(() => { window.pokecraft.paused = true; window.__view(); });
    const A = await page.evaluate(() => window.__grab());
    await page.evaluate(() => { window.pokecraft.paused = false; });
    await intoWobble(page);
    await frames(page, 8);
    const on = await page.evaluate(() => { const g = window.pokecraft; g.player.pitch = -0.02; return g.wobbleLook.info(); });
    t.ok(on.on && on.curl && on.defines.every(Boolean), `in Wobbleland the look is on: the WOBBLE define on the block materials, the page curls (${JSON.stringify(on)})`);
    const perf = await page.evaluate(() => { const g = window.pokecraft, r = g.renderer; let ms = 0; for (let i = 0; i < 3; i++) { const t0 = performance.now(); g.wobbleLook.beforeRender(); r.render(g.scene, g.camera); g.wobbleLook.afterRender(); ms += performance.now() - t0; } return { calls: r.info.render.calls, ms: Math.round(ms / 3) }; });
    await shot(page, 'wobble-look-curl.png');
    await page.evaluate(() => window.pokecraft.wobbleLook.toggleCurl());
    await frames(page, 4);
    const perf0 = await page.evaluate(() => { const g = window.pokecraft, r = g.renderer; let ms = 0; for (let i = 0; i < 3; i++) { const t0 = performance.now(); r.render(g.scene, g.camera); ms += performance.now() - t0; } return { calls: r.info.render.calls, ms: Math.round(ms / 3) }; });
    await shot(page, 'wobble-look-flat.png');
    console.log(`  draw calls / software frame time: curl on ${perf.calls} / ${perf.ms} ms, off ${perf0.calls} / ${perf0.ms} ms`);
    t.ok(perf.calls < 400, `draw calls in Wobbleland: ${perf.calls} (curl on), ${perf0.calls} (off)`);
    await page.evaluate(() => window.pokecraft.wobbleLook.toggleCurl());
    // the Scribble's grey and the flood: patch 1 cleared, its colour floods out
    const grey = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), p = L.patchOf(1); return { patch: g.wobbleLook.colourAt(p.x, p.z), camp: g.wobbleLook.colourAt(L.CAMP.x, L.CAMP.z) }; });
    t.ok(grey.patch === 0 && grey.camp === 1, `the Camp is in colour, the patches are grey (${JSON.stringify(grey)})`);
    await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), p = L.patchOf(1); g.beaten.push(L.patchKey(1)); g.wobbleLook.flood(1); g.player.pos.set(p.x + 0.5, 11, p.z + 22); g.player.yaw = 0; g.player.pitch = -0.2; });
    await frames(page, 3);
    const mid = await page.evaluate(async () => { const L = await import('/src/wobbleland.js'), p = L.patchOf(1); return window.pokecraft.wobbleLook.colourAt(p.x + 12, p.z); });
    await waitFor(page, () => !window.pokecraft.wobbleLook.info().floods, null, 30000).catch(() => {});
    const after = await page.evaluate(async () => { const L = await import('/src/wobbleland.js'), p = L.patchOf(1); return { mid: window.pokecraft.wobbleLook.colourAt(p.x, p.z), edge: window.pokecraft.wobbleLook.colourAt(p.x + 12, p.z), far: window.pokecraft.wobbleLook.colourAt(p.x + 30, p.z) }; });
    await frames(page, 3);
    await shot(page, 'wobble-look-flood.png');
    t.ok(mid < 1 && after.mid === 1 && after.edge === 1 && after.far === 0, `a cleared patch floods its colour out over about 2 s (12 blocks out: ${mid.toFixed(2)} at first, then ${JSON.stringify(after)})`);
    // home again: the main world draws the very same frame as before the trip
    await page.evaluate(() => window.pokecraft.realms.leave('stone', { home: true }));
    await placeIs(page, 'main');
    await frames(page, 4);
    await page.evaluate(() => { window.pokecraft.paused = true; window.__view(); });
    const B = await page.evaluate(() => window.__grab());
    t.ok(A.h === B.h && !A.defines && !B.defines, `the main world draws the same frame byte for byte before and after a trip to Wobbleland, no WOBBLE define on its materials (${A.h} / ${B.h})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }

  if (want('door')) {
    // without ?preview: no realm, no door, even for the Ally
    {
      const page = await openGame(browser, base);
      await newGame(page, 0);
      await intoSwirl(page);
      const r = await page.evaluate(async () => { const g = window.pokecraft, R = await import('/src/realms.js'), { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[0]; return { realm: !!R.REALMS.wobble, block: g.world.get(...c), paper: g.portal.info?.()?.paper }; });
      t.ok(!r.realm && r.block !== 129 && !r.paper, `without ?preview: no Wobbleland and no Paper Door, even for the Wizard's Ally (${JSON.stringify(r)})`);
      await page.context().close();
    }
    const page = await openGame(browser, base, { query: '?preview' });
    await newGame(page, 0);
    await intoSwirl(page, { ally: false });
    const before = await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[4]; const used = g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); return { paper: g.portal.info?.()?.paper, prompt: g.portal.prompt?.({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }, 'tap'), place: g.place }; });
    t.ok(!before.paper && before.place === 'swirl', `not yet the Wizard's Ally: no Paper Door, and its wall does not take you anywhere (${JSON.stringify(before)})`);
    await page.evaluate(() => { const g = window.pokecraft; g.studio.won = true; g.studio.ally = true; });
    await waitFor(page, () => window.pokecraft.portal.info?.()?.paper, null, 30000).catch(() => {});
    const door = await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), pd = paperDoor(g.world); const s = pd.stand; g.player.pos.set(s[0], s[1], s[2]); g.player.yaw = 0; g.player.pitch = 0.1; return { paper: g.portal.info?.()?.paper, cells: pd.cells.map(c => g.world.get(...c)) }; });
    await frames(page, 6);
    await shot(page, 'wobble-door.png');
    t.ok(door.paper && door.cells.every(b => b === door.cells[0]), `the Wizard's Ally sees the Paper Door at the foot of his tower (${JSON.stringify(door)})`);
    await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), c = paperDoor(g.world).cells[4]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
    await placeIs(page, 'wobble');
    const inside = await page.evaluate(async () => { const g = window.pokecraft, L = await import('/src/wobbleland.js'), p = g.player.pos; return { x: p.x, z: p.z, camp: Math.hypot(p.x - L.CAMP.x, p.z - L.CAMP.z), healer: !!g.world.healer, keep: !!g.world.editAllowed && !g.world.editAllowed(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z) - 3, 1) }; });
    t.ok(inside.camp < 6 && inside.healer && inside.keep, `in Wobbleland: you arrive at Inkpot Camp, a healer is there, nothing can be built (${JSON.stringify(inside)})`);
    await frames(page, 6);
    await shot(page, 'wobble-arrive.png');
    // saved inside: a reload puts you back in Wobbleland
    await page.evaluate(() => window.pokecraft.save?.(true));
    await page.reload();
    await page.waitForFunction(() => window.pokecraft?.world, null, { timeout: 120000 });
    await page.evaluate(() => [...document.querySelectorAll('#title-buttons button')].find(b => /Continue/.test(b.textContent))?.click());
    await placeIs(page, 'wobble');
    t.ok(true, 'a reload inside puts you back in Wobbleland');
    // back up with real keys: walk (W) up the steps to the way back, look at it and press E
    await page.evaluate(() => { const g = window.pokecraft, d = g.world.doors[0], s = d.stand; g.player.pos.set(s[0], s[1], s[2] - 2); g.player.yaw = Math.PI; g.player.pitch = 0; });
    await page.keyboard.down('w'); await page.keyboard.down('Space'); // (the steps: jump up them)
    await waitFor(page, () => { const g = window.pokecraft, s = g.world.doors[0].stand; return g.player.pos.z > s[2] + 0.6; }, null, 30000).catch(() => {});
    await page.keyboard.up('w'); await page.keyboard.up('Space');
    await page.evaluate(() => { window.pokecraft.player.pitch = 0.15; });
    await frames(page, 3);
    await page.keyboard.press('e');
    await placeIs(page, 'swirl').catch(() => {});
    const back = await page.evaluate(async () => { const g = window.pokecraft, { paperDoor } = await import('/src/wobbleland.js'), s = paperDoor(g.world).stand; return { place: g.place, d: Math.hypot(g.player.pos.x - s[0], g.player.pos.z - s[2]) }; });
    t.ok(back.place === 'swirl' && back.d < 3, `W and Space up the steps and E on the way back take you up to the Paper Door on the Wizard's island (${JSON.stringify(back)})`);
    t.ok(!page.errors.length, `no page errors (${page.errors.join(' | ')})`);
    await page.context().close();
  }
}
