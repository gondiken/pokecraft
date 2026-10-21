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

// T35: `--dream` measures the Dream realm next to the main world (the "Dreaming..." time, generation and meshing of the realm,
// chunks / verts / gpuMB, draw calls at the arrival and from the highest island, fps at the arrival); `--size=192` measures the
// smaller fallback map. Example: node perf.mjs 3 --dream   /   node perf.mjs 3 --dream --size=192
const flags = process.argv.slice(2).filter(a => a.startsWith('--')), args = process.argv.slice(2).filter(a => !a.startsWith('--'));
// T36.5: `--course` measures the Obstacle Course: fps and chunk rebuilds a second standing on the landing L5 (sections 5-6 animate around
// you) against standing at the entry (everything at rest). Example: node perf.mjs 3 --course
const COURSE = flags.includes('--course');
const DREAM = flags.includes('--dream'), DREAM_SIZE = Number((flags.find(a => a.startsWith('--size=')) || '').slice(7)) || 0;
const runs = Number(args[0]) || 3;
const dir = path.resolve(args[1] || path.dirname(fileURLToPath(import.meta.url)));
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

// T35: the main world and the Dream realm in one browser, same profile, same seeded save.
async function measureDream(profile) {
  const page = await openGame(browser, base, { contextOptions: PROFILES[profile], setup: seedSave(SAVE) });
  await continueGame(page);
  await page.evaluate(() => document.exitPointerLock?.());
  const probe = async (label, setup) => page.evaluate(async ([label, setup]) => {
    const g = window.pokecraft, w = g.world, cam = g.camera;
    g.weather.set('clear', 99999); g.time = 0.75;
    g.creatures.clear(); g.creatures.update = () => {};
    window.gc(); await new Promise(r => setTimeout(r, 300)); window.gc();
    let verts = 0, idx = 0, chunks = 0;
    for (const list of w.meshes.values()) { chunks++; for (const m of list) { verts += m.geometry.attributes.position.count; idx += m.geometry.index?.count || 0; } }
    const s = g.spawnPoint, sx = Math.floor(s.x), sz = Math.floor(s.z);
    const spots = { N: [sx, sz, 0], E: [sx, sz, -Math.PI / 2], S: [sx, sz, Math.PI], W: [sx, sz, Math.PI / 2] };
    if (w.isles) { const t = w.isles.list.find(i => i.id === 'tall'); spots.tall = [t.x, t.z, Math.PI / 4, t.top + 3]; }
    const calls = {};
    for (const [k, [x, z, yaw, y]] of Object.entries(spots)) {
      cam.position.set(x + 0.5, y ?? w.surface(x, z).y + 2.6, z + 0.5); cam.rotation.set(-0.15, yaw, 0); cam.updateMatrixWorld();
      w.cull(cam.position, w.realm?.look?.fog ? w.realm.look.fog[1] : 100);
      g.renderer.render(g.scene, cam);
      calls[k] = g.renderer.info.render.calls;
    }
    // fps: standing at the arrival, drawn by the game loop
    const p = g.player, put = () => { p.pos.set(s.x, s.y, s.z); p.vel.set(0, 0, 0); p.yaw = Math.PI; p.pitch = -0.15; };
    put();
    await new Promise(r => setTimeout(r, 1500));
    let n = 0, stop = false; const t0 = performance.now();
    const tick = () => { put(); n++; if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await new Promise(r => setTimeout(r, 8000));
    stop = true;
    return { label, chunks, verts, gpuMB: Math.round((verts * 32 + idx * 4) / 1048576), calls, fps: Math.round(n / ((performance.now() - t0) / 1000) * 100) / 100 };
  }, [label, setup]);
  const main = await page.evaluate(async () => {
    const g = window.pokecraft, { World } = await import('/src/world.js');
    let t = performance.now();
    const w = new World(4242, g.scene, g.world.materials); w.generate();
    const genMs = performance.now() - t; t = performance.now();
    w.buildAll(); const meshMs = performance.now() - t; w.dispose();
    return { genMs: Math.round(genMs), meshMs: Math.round(meshMs) };
  });
  const mainView = await probe('main');
  // the realm: the "Dreaming..." time, and generation / meshing of the same realm in a World of its own
  const enter = await page.evaluate(async size => {
    const g = window.pokecraft, R = await import('/src/realms.js'), { World } = await import('/src/world.js');
    const def = R.REALMS.dream;
    if (size) { def.size = [size, size]; def.arrive = [size >> 1, size >> 1]; }
    const mats = g.world.materials;
    let t = performance.now();
    const w = new World(R.realmSeed(4242, def.seedSalt), g.scene, mats, def.size, def); w.generate();
    const genMs = performance.now() - t; t = performance.now();
    w.buildAll(); const meshMs = performance.now() - t; w.dispose();
    g.time = 0.75;
    t = performance.now();
    await g.realms.enter('dream');
    return { size: def.size, genMs: Math.round(genMs), meshMs: Math.round(meshMs), enterMs: Math.round(performance.now() - t) };
  }, DREAM_SIZE);
  const dream = await probe('dream');
  const errors = page.errors.slice();
  await page.context().close();
  return { profile, main: { ...main, ...mainView }, enter, dream, errors: errors.length };
}

// T36.5: the Obstacle Course. Frames per second and chunk rebuilds a second over 8 s at the entry (everything at rest) and on L5
// (the timed blocks around you animate; the game loop runs gymLive.update as usual).
async function measureCourse(profile) {
  const page = await openGame(browser, base, { contextOptions: PROFILES[profile], setup: seedSave(SAVE) });
  await continueGame(page);
  await page.evaluate(() => document.exitPointerLock?.());
  const out = {};
  for (const where of ['entry', 'L5', 'L2']) {
    out[where] = await page.evaluate(async where => {
      const g = window.pokecraft, w = g.world, p = g.player;
      g.weather.set('clear', 99999); g.time = 0.25;
      g.creatures.clear(); g.creatures.update = () => {};
      const gym = w.gyms.find(x => x.def.id === 'parkour');
      const L = g.gymLive.of('parkour');
      const spot = where === 'entry' ? [gym.entry[0] + 0.5, gym.entry[1], gym.entry[2] + 0.5] : gym.checkpoints[where === 'L5' ? 5 : 2].stand;
      const put = () => { p.pos.set(spot[0], spot[1], spot[2]); p.vel.set(0, 0, 0); p.yaw = Math.PI; p.pitch = -0.15; };
      put();
      window.__builds = window.__builds || 0;
      if (!w.__counted) { const b = w.buildChunk.bind(w); w.buildChunk = (...a) => { window.__builds++; return b(...a); }; w.__counted = true; }
      await new Promise(r => setTimeout(r, 1500));
      window.__builds = 0;
      const clock0 = L.clock;
      let n = 0, stop = false; const t0 = performance.now();
      const tick = () => { put(); n++; if (!stop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      await new Promise(r => setTimeout(r, 8000));
      stop = true;
      const secs = (performance.now() - t0) / 1000;
      return { fps: Math.round(n / secs * 100) / 100, rebuildsPerSec: Math.round(window.__builds / secs * 100) / 100, clockSecs: Math.round((L.clock - clock0) * 10) / 10 };
    }, where);
  }
  const errors = page.errors.slice();
  await page.context().close();
  return { profile, ...out, errors: errors.length };
}

const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
if (COURSE) {
  const rs = { desktop: [], ipad: [] };
  for (let i = 0; i < runs; i++) for (const profile of Object.keys(PROFILES)) { const r = await measureCourse(profile); rs[profile].push(r); console.log(JSON.stringify(r)); }
  for (const [profile, list] of Object.entries(rs)) {
    const m = (k, sub) => med(list.map(r => r[k][sub]));
    console.log(`MEDIAN ${profile} (${runs} runs) course: ` + JSON.stringify({ fpsEntry: m('entry', 'fps'), fpsL5: m('L5', 'fps'), fpsL2: m('L2', 'fps'), ratioL5: Math.round(m('L5', 'fps') / m('entry', 'fps') * 100) / 100, rebuildsEntry: m('entry', 'rebuildsPerSec'), rebuildsL5: m('L5', 'rebuildsPerSec'), rebuildsL2: m('L2', 'rebuildsPerSec') }));
  }
  await browser.close();
  server.close();
  process.exit(0);
}
if (DREAM) {
  const rs = { desktop: [], ipad: [] };
  for (let i = 0; i < runs; i++) for (const profile of Object.keys(PROFILES)) { const r = await measureDream(profile); rs[profile].push(r); console.log(JSON.stringify(r)); }
  for (const [profile, list] of Object.entries(rs)) {
    const m = (k, sub) => med(list.map(r => r[k][sub]));
    const calls = (k, sub) => med(list.map(r => r[k].calls[sub]));
    console.log(`MEDIAN ${profile} (${runs} runs) main: ` + JSON.stringify({ genMeshMs: m('main', 'genMs') + m('main', 'meshMs'), chunks: m('main', 'chunks'), verts: m('main', 'verts'), gpuMB: m('main', 'gpuMB'), callsN: calls('main', 'N'), callsE: calls('main', 'E'), callsS: calls('main', 'S'), callsW: calls('main', 'W'), fps: m('main', 'fps') }));
    console.log(`MEDIAN ${profile} (${runs} runs) dream ${JSON.stringify(list[0].enter.size)}: ` + JSON.stringify({ enterMs: m('enter', 'enterMs'), genMeshMs: m('enter', 'genMs') + m('enter', 'meshMs'), chunks: m('dream', 'chunks'), verts: m('dream', 'verts'), gpuMB: m('dream', 'gpuMB'), callsN: calls('dream', 'N'), callsE: calls('dream', 'E'), callsS: calls('dream', 'S'), callsW: calls('dream', 'W'), callsTall: calls('dream', 'tall'), fps: m('dream', 'fps') }));
  }
  await browser.close();
  server.close();
  process.exit(0);
}
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
