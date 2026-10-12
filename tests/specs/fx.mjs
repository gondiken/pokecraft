// Attack animations (src/fx.js, src/fxrecipes.js): every effect is added and removed cleanly, stays
// inside the budget (draw calls, points), never touches the battle's random numbers, never blocks it,
// and can be switched off from the pause screen.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, newGame, click, pause, playBattle, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

const platform = page => page.evaluate(() => {
  const g = window.pokecraft, s = g.spawnPoint, y = 42;
  for (let x = -4; x <= 6; x++) for (let z = -4; z <= 4; z++) g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3);
  g.player.pos.set(Math.floor(s.x) + 0.5, y + 1, Math.floor(s.z) + 0.5);
  g.player.vel.set(0, 0, 0);
  g.time = 0.25; // daytime
});

// A weak wild battle (copied from moves.mjs): thunderwolf against a 1-HP fluffin.
const startWeakBattle = (page, { species, level, moves }) => page.evaluate(async ({ species, level, moves }) => {
  const g = window.pokecraft;
  const S = await import('/src/species.js');
  const { Wild } = await import('/src/creatures.js');
  g.party = [S.makeCreature(species, level, moves)];
  const wild = new Wild(S.makeCreature('fluffin', 2), S.buildModel('fluffin'), g.player.pos.clone().setX(g.player.pos.x + 3));
  wild.data.hp = 1;
  g.creatures.list.push(wild);
  g.scene.add(wild.model); // the game adds a wild creature's model when it spawns
  wild.model.position.copy(wild.pos); // ...and places it
  g.inBattle = true; document.body.classList.add('in-battle');
  document.getElementById('pause').classList.add('hidden');
  g.battle.start({ wild });
}, { species, level, moves });

// Helpers that live in the page.
const installHelpers = page => page.evaluate(async () => {
  const S = await import('/src/species.js');
  const g = window.pokecraft, fx = g.fx, b = g.battle, r = g.renderer;
  const types = ['normal', ...Object.keys(S.TYPE_COLORS)];
  const firstMove = {};
  for (const [id, m] of Object.entries(S.MOVES)) if (m.power && !m.sig && !firstMove[m.type]) firstMove[m.type] = id;
  const sigs = Object.entries(S.MOVES).filter(([, m]) => m.sig).map(([id]) => id);
  g.creatures.update = () => {}; // no wild creatures spawning or leaving while we count geometries
  const H = window.H = { types, firstMove, sigs, idle: 0 };
  H.frames = n => new Promise(res => {
    const f0 = r.info.render.frame;
    const poll = () => (r.info.render.frame >= f0 + n ? res() : setTimeout(poll, 40));
    poll();
  });
  // Each item starts some effects and returns their promises.
  H.items = () => {
    const a = () => b.spot('ally'), f = () => b.spot('foe');
    const list = [];
    for (const t of types) list.push([`type ${t}`, () => [fx.attack(firstMove[t], a(), f()), fx.impact(t, f(), { big: false })]]);
    for (const id of sigs) list.push([`sig ${id}`, () => [fx.attack(id, a(), f()), fx.impact(S.MOVES[id].type, f(), { big: true })]]);
    for (const k of ['heal', 'sleep', 'flinch', 'recoil', 'power']) list.push([`status ${k}`, () => [fx.status(k, a())]]);
    for (const stat of ['atk', 'def', 'spd']) list.push([`status up ${stat}`, () => [fx.status('up', a(), { stat })]]);
    list.push(['status down', () => [fx.status('down', f(), { stat: 'atk' })]]);
    list.push(['status miss', () => [fx.status('miss', f(), { from: a() })]]);
    list.push(['aura fire', () => [fx.aura('fire', a())]]);
    list.push(['aura mind', () => [fx.aura('mind', a())]]);
    return list;
  };
  H.snap = () => ({ geos: r.info.memory.geometries, texs: r.info.memory.textures, scene: g.scene.children.length, root: fx.root.children.length });
  // One item: hold it at half way, look at it for two frames, then let it finish.
  H.check = async index => {
    const [name, start] = H.items()[index];
    await H.frames(1);
    const idle = r.info.render.calls;
    fx.hold = 0.5;
    const ps = start();
    await H.frames(2);
    const res = { name, children: fx.root.children.length, finite: true, points: fx.stats.points, calls: r.info.render.calls - idle };
    fx.root.traverse(o => {
      if (o.isPoints) for (const v of o.geometry.attributes.position.array) if (!Number.isFinite(v)) res.finite = false;
      if (o.isMesh || o.isSprite) for (const v of [o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z]) if (!Number.isFinite(v)) res.finite = false;
    });
    fx.hold = null;
    await Promise.all(ps);
    await H.frames(2);
    res.after = fx.root.children.length;
    return res;
  };
  return H.items().length;
});

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await platform(page);
  await pause(page);
  await startWeakBattle(page, { species: 'thunderwolf', level: 22 });
  await page.waitForSelector('#b-actions button:not([disabled])', { timeout: 90000 });
  const count = await installHelpers(page);

  // 1. Warm-up: every effect once (a few at a time), so shared textures and geometries exist.
  await page.evaluate(async () => {
    const H = window.H, fx = window.pokecraft.fx;
    const n = H.items().length;
    for (let i = 0; i < n; i += 2) {
      fx.hold = 0.5;
      const ps = [];
      for (const j of [i, i + 1]) if (j < n) ps.push(...H.items()[j][1]());
      await H.frames(2);
      fx.hold = null;
      await Promise.all(ps);
    }
    await H.frames(2);
    H.idle = window.pokecraft.renderer.info.render.calls;
  });
  const base0 = await page.evaluate(() => ({ ...window.H.snap(), stats: { ...window.pokecraft.fx.stats }, errors: window.pokecraft.fx.errors.length }));
  t.ok(base0.root === 0 && base0.stats.live === 0 && base0.stats.made === base0.stats.disposed && base0.errors === 0,
    `warm-up of ${count} effects leaves nothing behind (${JSON.stringify(base0)})`);

  // 2 + 3. Each type, signature move, status kind and the aura: added, inside the budget, removed.
  const bad = [];
  for (let i = 0; i < count; i++) {
    const r = await page.evaluate(i => window.H.check(i), i);
    const problems = [];
    if (!(r.children > 0)) problems.push('nothing added');
    if (!r.finite) problems.push('NaN');
    if (r.points > 300) problems.push(`${r.points} points`);
    if (r.calls > 12) problems.push(`${r.calls} extra draw calls`);
    if (r.after !== 0) problems.push('not removed');
    if (problems.length) bad.push(`${r.name}: ${problems.join(', ')}`);
  }
  t.ok(!bad.length, `all ${count} effects are added, finite, inside the budget and removed ${bad.join(' | ')}`);
  const end = await page.evaluate(() => {
    const fx = window.pokecraft.fx;
    return { ...window.H.snap(), stats: { ...fx.stats }, active: fx.active.size, errors: fx.errors.slice() };
  });
  t.ok(end.geos === base0.geos && end.texs === base0.texs, `no geometries or textures leak (${base0.geos}/${base0.texs} -> ${end.geos}/${end.texs})`);
  const rootCount = await page.evaluate(() => window.pokecraft.scene.children.filter(o => o.name === 'fx').length);
  t.ok(rootCount === 1 && end.root === 0 && end.active === 0, `the scene holds only the one empty fx group (${base0.scene} -> ${end.scene} children; creatures come and go)`);
  t.ok(end.stats.made === end.stats.disposed && end.stats.points === 0, `every geometry and material made was disposed (${JSON.stringify(end.stats)})`);
  t.ok(!end.errors.length, `no effect errors ${end.errors.join('; ')}`);

  // 4. Off switch, clear(), and the pause-screen button.
  const sw = await page.evaluate(async () => {
    const g = window.pokecraft, fx = g.fx, b = g.battle, H = window.H;
    const a = () => b.spot('ally'), f = () => b.spot('foe');
    const out = {};
    fx.setOn(false);
    const t0 = performance.now();
    await fx.attack(H.firstMove.fire, a(), f());
    fx.impact('fire', f()); fx.status('heal', a()); fx.aura('fire', a());
    out.offMs = performance.now() - t0; out.offChildren = fx.root.children.length;
    fx.setOn(true);
    fx.hold = 0.5;
    const ps = [fx.attack(H.firstMove.fire, a(), f()), fx.impact('water', f()), fx.status('sleep', a())];
    await H.frames(1);
    out.held = fx.root.children.length;
    fx.clear();
    out.clearedChildren = fx.root.children.length;
    out.resolved = await Promise.race([Promise.all(ps).then(() => true), new Promise(r => setTimeout(() => r(false), 1000))]);
    fx.hold = null;
    out.balanced = fx.stats.made === fx.stats.disposed && fx.stats.points === 0 && fx.active.size === 0;
    return out;
  });
  t.ok(sw.offMs < 100 && sw.offChildren === 0, `effects off: attack() resolves at once and adds nothing (${Math.round(sw.offMs)} ms)`);
  t.ok(sw.held >= 3 && sw.clearedChildren === 0 && sw.resolved && sw.balanced, `clear() removes everything, resolves the promises, stays balanced (${JSON.stringify(sw)})`);
  await page.evaluate(() => document.getElementById('pause').classList.remove('hidden'));
  const label1 = await page.textContent('#fx-btn');
  await click(page, '#fx-btn');
  const label2 = await page.textContent('#fx-btn');
  const stored = await page.evaluate(() => [window.pokecraft.fx.on, localStorage.getItem('pokecraft-fx')]);
  await click(page, '#fx-btn');
  const stored2 = await page.evaluate(() => [window.pokecraft.fx.on, localStorage.getItem('pokecraft-fx')]);
  await page.evaluate(() => document.getElementById('pause').classList.add('hidden'));
  t.ok(label1.includes('Effects on') && label2.includes('Effects off') && stored[0] === false && stored[1] === 'off' && stored2[0] === true && stored2[1] === 'on',
    `pause screen button turns effects off and on (${label1} / ${label2} / ${stored} / ${stored2})`);

  // 5c. Frame time with the heaviest effects held (software WebGL is noisy: the strict budget is above).
  const frameTime = () => page.evaluate(async () => {
    const d = [];
    let last = await new Promise(requestAnimationFrame);
    for (let i = 0; i < 8; i++) { const n = await new Promise(requestAnimationFrame); d.push(n - last); last = n; }
    d.sort((x, y) => x - y);
    return (d[3] + d[4]) / 2;
  });
  const measure = async () => {
    const idle = await frameTime();
    await page.evaluate(() => {
      const g = window.pokecraft, H = window.H, b = g.battle;
      g.fx.hold = 0.5;
      g.fx.attack('zenithray', b.spot('ally'), b.spot('foe'));
      g.fx.attack('mothership', b.spot('ally'), b.spot('foe'));
      g.fx.attack(H.firstMove.electric, b.spot('ally'), b.spot('foe'));
    });
    const busy = await frameTime();
    await page.evaluate(() => { window.pokecraft.fx.hold = null; });
    await page.waitForTimeout(1500);
    return { idle, busy, ratio: busy / idle };
  };
  let ft = await measure();
  if (ft.ratio > 1.35) ft = await measure();
  console.log(`  frame time: idle ${ft.idle.toFixed(0)} ms, heavy effects ${ft.busy.toFixed(0)} ms, ratio ${ft.ratio.toFixed(2)}`);
  t.ok(ft.ratio <= 1.35, `heavy effects do not slow frames much (ratio ${ft.ratio.toFixed(2)})`);

  // 5b. The open battle still finishes, and nothing is left behind.
  const finished = await playBattle(page);
  t.ok(finished, 'the battle with effects on finishes');
  const left = await page.evaluate(() => ({ root: window.pokecraft.fx.root.children.length, errors: window.pokecraft.fx.errors.length }));
  t.ok(left.root === 0 && left.errors === 0, `no effects left after the battle (${JSON.stringify(left)})`);

  // 5a. Random numbers: same draws, same damage, same log with effects on and off.
  const rng = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const g = window.pokecraft, b = g.battle, fx = g.fx;
    for (const k of ['say', 'lunge', 'flash', 'refresh']) delete b[k];
    const sp = g.spawnPoint;
    const mk = id => { const m = S.buildModel(id); g.scene.add(m); return m; };
    b.allyModel = mk('thunderwolf'); b.foeModel = mk('fluffin');
    const y = 43;
    b.allyModel.position.set(Math.floor(sp.x) + 0.5, y, Math.floor(sp.z) + 0.5);
    b.foeModel.position.set(Math.floor(sp.x) + 3.5, y, Math.floor(sp.z) + 0.5);
    const run = async on => {
      fx.setOn(on);
      const res = [];
      for (const [mv, ally, rolls] of [['seedvolley', 'sproutle', [0.1, 0.99, 0.5, 0.5]], ['flarekick', 'emberpup', [0.1, 0.5, 0.5, 0.5]],
        ['infernodash', 'emberpup', [0.1, 0.5, 0.5]], ['restup', 'fluffin', [0.1]], ['lullaby', 'echobat', [0.1, 0.5]], ['tackle', 'fluffin', [0.95, 0.5]]]) {
        const log = [];
        b.say = async text => { log.push(text); };
        b.lunge = async () => {}; b.flash = async () => {}; b.refresh = () => {};
        b.allies = [S.makeCreature(ally, 30, [mv])]; b.foes = [S.makeCreature('woolumph', 40, ['tackle'])];
        b.allyIdx = b.foeIdx = 0; b.trainer = b.duel = null; b.boss = false; b.modMap = new Map();
        b.ally.hp = Math.max(1, Math.floor(b.ally.hp / 2));
        const list = rolls.slice(); let n = 0;
        b.rng = () => { n++; return list.length ? list.shift() : 0.5; };
        const t0 = performance.now();
        await b.useMove('ally', mv, { first: true });
        res.push({ mv, draws: n, foe: b.foe.hp, ally: b.ally.hp, log: log.join('|'), ms: performance.now() - t0 });
      }
      return res;
    };
    const off = await run(false), on = await run(true);
    for (const k of ['say', 'lunge', 'flash', 'refresh']) delete b[k];
    g.scene.remove(b.allyModel); g.scene.remove(b.foeModel);
    b.allyModel = b.foeModel = null;
    fx.setOn(true);
    const strip = r => JSON.stringify(r.map(({ ms, ...x }) => x));
    return { same: strip(off) === strip(on), off: strip(off).slice(0, 200), draws: on.map(r => r.draws), extraMs: Math.max(...on.map((r, i) => r.ms - off[i].ms)), onMs: on.map(r => Math.round(r.ms)), offMs: off.map(r => Math.round(r.ms)) };
  });
  t.ok(rng.same, `effects on or off: same draws, damage and log (draws ${rng.draws}) ${rng.same ? '' : rng.off}`);
  // Timings on software WebGL are far too noisy to assert (timers wait for slow frames): just log them.
  console.log(`  move times, effects on ${rng.onMs} ms, off ${rng.offMs} ms`);

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
