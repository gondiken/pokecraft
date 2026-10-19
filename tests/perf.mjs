// Speed and size of the main world (T32: measured before and after the map grows). Not a spec: `npm test` never runs it.
//
//   cd tests && node perf.mjs              3 runs, desktop and iPad, prints each run and the medians
//   node perf.mjs 5                        5 runs
//   node perf.mjs 3 /abs/path/to/tests     measure another checkout (its helpers, src and node_modules), e.g. a
//                                          `git worktree` of the old commit, so before and after can be run one after the other
//
// Everything runs on software WebGL (SwiftShader, like the specs), so absolute numbers are slow; compare runs made on the
// same machine with this same script. A fixed world (seed 4242, a seeded save) is used so every run sees the same place.
// What it measures, per profile (desktop 1100x760, iPad = Playwright's 'iPad (gen 7) landscape' with touch):
//   loadMs     page start -> the saved world generated and meshed (the title screen's world, before Continue)
//   genMs      World.generate() for seeds 1, 4242, 777 (median), meshMs: buildAll() for the same
//   heapMB     JS heap after GC, in the game; chunks / verts / gpuMB: the game world's chunk meshes (GPU estimate)
//   calls      draw calls of one frame from fixed spots (fog far 100, the game's culling): at the start looking
//              N/E/S/W, near the south edge (150, 278) looking south, near the east edge (278, 150) looking east
//   fps        frames per second over 8 s standing at the start looking south, and near the south edge looking south
//              (clear weather, noon, no wild creatures, so only the world is drawn)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runs = Number(process.argv[2]) || 3;
const dir = path.resolve(process.argv[3] || path.dirname(fileURLToPath(import.meta.url)));
const { serve, openGame, seedSave, continueGame } = await import(path.join(dir, 'helpers.mjs'));
const { chromium, devices } = await import(path.join(dir, 'node_modules/playwright/index.mjs'));

const SEED = 4242;
const SAVE = {
  seed: SEED, edits: [], size: [288, 288], pos: [120.5, 15, 111.5], yaw: 0, pitch: 0, time: 0.25,
  party: [{ uid: 'p', species: 'zapple', level: 8, xp: 307, hp: 20, moves: ['tackle', 'spark'] }],
  box: [], cubes: 10, badges: [], beaten: [], savedAt: 1, toldHomes: true, toldCaveGym: true,
};
const PROFILES = {
  desktop: {},
  ipad: { ...devices['iPad (gen 7) landscape'] },
};

const { server, base } = await serve();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });

async function measure(profile) {
  const page = await openGame(browser, base, { contextOptions: PROFILES[profile], setup: seedSave(SAVE) });
  const loadMs = await page.evaluate(() => Math.round(performance.now()));
  // Fresh worlds: generation and meshing (the same work as loading a world, without the page around it).
  const gen = await page.evaluate(async () => {
    const g = window.pokecraft, { World } = await import('/src/world.js');
    const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
    const genMs = [], meshMs = [];
    for (const seed of [1, 4242, 777]) {
      let t = performance.now();
      const w = new World(seed, g.scene, g.world.materials); w.generate();
      genMs.push(performance.now() - t); t = performance.now();
      w.buildAll(); meshMs.push(performance.now() - t); w.dispose();
    }
    return { W: g.world.W, D: g.world.D, genMs: Math.round(med(genMs)), meshMs: Math.round(med(meshMs)) };
  });
  await continueGame(page);
  await page.evaluate(() => document.exitPointerLock?.());
  const still = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, cam = g.camera;
    g.weather.set('clear', 99999); g.time = 0.25;
    g.creatures.clear(); g.creatures.update = () => {}; // only the world is drawn
    window.gc(); await new Promise(r => setTimeout(r, 300)); window.gc();
    let verts = 0, idx = 0, chunks = 0;
    for (const list of w.meshes.values()) { chunks++; for (const m of list) { verts += m.geometry.attributes.position.count; idx += m.geometry.index?.count || 0; } }
    const top = (x, z) => { let y = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) y = Math.max(y, w.surface(x + a, z + b).y); return y; };
    const s = g.spawnPoint, sx = Math.floor(s.x), sz = Math.floor(s.z);
    const views = {
      startN: [sx, sz, 0], startE: [sx, sz, -Math.PI / 2], startS: [sx, sz, Math.PI], startW: [sx, sz, Math.PI / 2],
      southEdge: [150, Math.min(278, w.D - 10), Math.PI], eastEdge: [Math.min(278, w.W - 10), 150, -Math.PI / 2],
    };
    const calls = {};
    for (const [k, [x, z, yaw]] of Object.entries(views)) {
      cam.position.set(x + 0.5, top(x, z) + 2.6, z + 0.5); cam.rotation.set(-0.15, yaw, 0); cam.updateMatrixWorld();
      w.cull(cam.position, 100);
      g.renderer.render(g.scene, cam);
      calls[k] = g.renderer.info.render.calls;
    }
    return { heapMB: Math.round(performance.memory.usedJSHeapSize / 1048576), chunks, verts, gpuMB: Math.round((verts * 32 + idx * 4) / 1048576), calls };
  });
  // Frame rate while standing still (the game loop draws as usual; the player is put on the ground each frame).
  const fps = {};
  for (const [k, spot] of Object.entries({ start: null, southEdge: [150, 278] })) {
    fps[k] = await page.evaluate(async spot => {
      const g = window.pokecraft, w = g.world, p = g.player;
      const [x, z] = spot ? [spot[0], Math.min(spot[1], w.D - 10)] : [Math.floor(g.spawnPoint.x), Math.floor(g.spawnPoint.z)];
      const put = () => { p.pos.set(x + 0.5, w.surface(x, z).y + 1, z + 0.5); p.vel.set(0, 0, 0); p.yaw = Math.PI; p.pitch = -0.15; };
      put();
      await new Promise(r => setTimeout(r, 1500));
      let n = 0, stop = false;
      const t0 = performance.now();
      const tick = () => { put(); n++; if (!stop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      await new Promise(r => setTimeout(r, 8000));
      stop = true;
      return Math.round(n / ((performance.now() - t0) / 1000) * 100) / 100;
    }, spot);
  }
  const errors = page.errors.slice();
  await page.context().close();
  return { profile, loadMs, ...gen, ...still, fps, errors: errors.length };
}

const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
const all = { desktop: [], ipad: [] };
for (let i = 0; i < runs; i++) {
  for (const profile of Object.keys(PROFILES)) { // interleaved, so a slow moment of the machine hits both
    const r = await measure(profile);
    all[profile].push(r);
    console.log(JSON.stringify(r));
  }
}
for (const [profile, rs] of Object.entries(all)) {
  const m = k => med(rs.map(r => r[k]));
  const mo = (k, sub) => med(rs.map(r => r[k][sub]));
  const calls = Object.fromEntries(Object.keys(rs[0].calls).map(k => [k, mo('calls', k)]));
  const fps = Object.fromEntries(Object.keys(rs[0].fps).map(k => [k, mo('fps', k)]));
  console.log(`MEDIAN ${profile} (${runs} runs): ` + JSON.stringify({ size: [rs[0].W, rs[0].D], loadMs: m('loadMs'), genMs: m('genMs'), meshMs: m('meshMs'), heapMB: m('heapMB'), chunks: m('chunks'), verts: m('verts'), gpuMB: m('gpuMB'), calls, fps }));
}
await browser.close();
server.close();
