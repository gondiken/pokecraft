// T37a Ninja: the seven creatures and their moves (A), portraits (B), the 'blink' walk (C: run at one and it vanishes in a puff
// and pops up a few blocks away on a legal spot; walk up slowly and you reach it and battle; tired after 3 blinks), the spawns and
// the 'evening' condition (D) and a Book page (E). The walk is driven inside one page.evaluate with the real Player physics
// (p.update with the W and Shift keys) and synchronous cm.update calls, so nothing depends on the frame rate.
// Screenshots go to tests/screenshots/t37-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, newGame, platform, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const IDS = ['hushcoon', 'shadecoon', 'peekaw', 'ravenshade', 'flickit', 'whirlwhisk', 'bambooze'];

const frames = (page, n = 2) => page.evaluate(async n => {
  const g = window.pokecraft;
  for (let i = 0; i < n; i++) { const t0 = g.time; await new Promise(res => { const f = () => (g.time !== t0 ? res() : requestAnimationFrame(f)); f(); }); }
}, n);

const save = (name, url) => {
  const file = path.join(SHOTS, name);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`  screenshot ${file}`);
};

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await newGame(page, 0);
  await page.evaluate(() => {
    const g = window.pokecraft;
    g.weather.set('clear');
    g.time = 0.25;
    g.creatures.clear();
    g.creatures.spawnTimer = 1e9; // the test decides what spawns
    g.creatures.weather = null;
    window.__toasts = [];
    const toast = g.ui.toast.bind(g.ui);
    g.ui.toast = (m, ...r) => { window.__toasts.push(m); return toast(m, ...r); };
    window.__keep = { sx: Math.floor(g.spawnPoint.x), sz: Math.floor(g.spawnPoint.z) };
  });

  /* ---------------------------------------------------------------- A. Data, moves, chart and models */
  const A = await page.evaluate(async ids => {
    const S = await import('/src/species.js');
    const SH = await import('/src/shapes.js');
    const R = await import('/src/fxrecipes.js');
    const { GAITS } = await import('/src/creatures.js');
    const { WOOL } = await import('/src/blocks.js');
    const THREE = await import('three');
    const g = window.pokecraft;
    const out = { problems: [] };
    const bad = (id, msg) => out.problems.push(`${id}: ${msg}`);
    const all = Object.entries(S.SPECIES);
    const evolvesInto = new Set(all.map(([, s]) => s.evolve?.into).filter(Boolean));
    const names = all.map(([, s]) => s.name.toLowerCase());
    const mine = all.filter(([, s]) => s.type === 'ninja').map(([id]) => id);
    out.mine = mine.slice().sort();
    out.families = mine.filter(id => !evolvesInto.has(id)).length;
    out.singles = mine.filter(id => !S.SPECIES[id].evolve && !evolvesInto.has(id));
    out.evolve = ['hushcoon', 'peekaw', 'flickit'].map(id => `${id}>${S.SPECIES[id].evolve?.into}@${S.SPECIES[id].evolve?.level}`);
    const shapeUse = {};
    for (const [, s] of all) shapeUse[s.model.shape] = (shapeUse[s.model.shape] || 0) + 1;
    out.shapes = [...new Set(mine.map(id => S.SPECIES[id].model.shape))].sort();
    out.shapesRegistered = out.shapes.every(sh => typeof SH.SHAPES[sh] === 'function');
    out.ownShapes = out.shapes.every(sh => all.every(([, s]) => s.model.shape !== sh || s.type === 'ninja'));
    out.bambooShapeUse = shapeUse[S.SPECIES.bambooze.model.shape];
    out.gait = !!GAITS.blink && GAITS.blink.bump === true;
    const sigOf = m => {
      let sum = 0;
      m.updateMatrixWorld(true);
      m.traverse(o => { if (o.isMesh) for (const v of o.matrixWorld.elements) sum += v; });
      return sum;
    };
    out.sizes = {};
    for (const id of ids) {
      const s = S.SPECIES[id];
      if (!s) { bad(id, 'missing'); continue; }
      if (s.type !== 'ninja') bad(id, `type ${s.type}`);
      if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(id, `name ${s.name} is not unique`);
      if (!s.desc || s.desc.length > 110) bad(id, `desc is ${s.desc?.length} characters`);
      if (s.gait !== 'blink') bad(id, `gait ${s.gait}`);
      const where = Object.entries(S.SPAWNS).flatMap(([biome, list]) => list.filter(e => e[0] === id).map(e => ({ biome, w: e[1], when: e[2] })));
      if (!where.length) bad(id, 'in no SPAWNS table');
      const final = evolvesInto.has(id);
      for (const e of where) {
        if (e.biome === 'cave') bad(id, 'in the cave table');
        if (e.w > 1.5) bad(id, `weight ${e.w}`);
        if (final && e.w > 0.15) bad(id, `a final evolution with weight ${e.w} in ${e.biome}`);
        if (e.when && !['evening', 'day', 'night'].includes(e.when)) bad(id, `spawns '${e.when}'`);
      }
      const c = S.makeCreature(id, 5);
      if (c.moves.length < 2) bad(id, `only ${c.moves.length} moves at Lv 5`);
      if (!S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === 'ninja')) bad(id, 'no ninja move at Lv 20');
      for (const [, m] of s.learn) if (!S.MOVES[m]) bad(id, `move ${m} missing`);
      try {
        const m = S.buildModel(id);
        S.animateModel(m, 0);
        const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
        out.sizes[id] = [size.x, size.y, size.z].map(v => v.toFixed(2)).join('x');
        if (size.y < 0.35 || size.y > 2.6) bad(id, `height ${size.y.toFixed(2)} outside 0.35-2.6`);
        if (size.x > 2.6 || size.z > 2.6) bad(id, `width/depth ${size.x.toFixed(2)}/${size.z.toFixed(2)} over 2.6`);
        let min = box.min.y;
        for (const [tm, mv] of [[0.3, false], [0.7, true], [1.1, false], [1.9, true], [2.6, true]]) {
          S.animateModel(m, tm, mv);
          min = Math.min(min, new THREE.Box3().setFromObject(m).min.y);
        }
        if (min < -0.1) bad(id, `goes under the ground (min.y ${min.toFixed(2)})`);
        S.animateModel(m, 0.3, false); const a = sigOf(m);
        S.animateModel(m, 1.1, false); const b = sigOf(m);
        if (Math.abs(a - b) < 1e-6) bad(id, 'no idle animation');
        let mask = 0, band = 0;
        m.traverse(o => { if (o.userData.gear === 'mask') mask++; if (o.userData.gear === 'band') band++; });
        if (mask < 1) bad(id, 'no mask');
        if (band < 3) bad(id, `${band} headband pieces (band and two tails)`);
        S.disposeModel(m);
      } catch (e) { bad(id, `model failed: ${e.message}`); }
    }
    // moves
    const M = S.MOVES;
    const ids7 = ['leafstar', 'sneakstep', 'shadowstrike', 'twigtrip', 'leafwhirl', 'smokescreen', 'duskfalls', 'vanishswap'];
    out.moves = ids7.map(id => M[id]?.type);
    out.names = ids7.map(id => M[id]?.name);
    out.sneak = M.sneakstep.priority === 1 && M.shadowstrike.fx?.kind === 'flinch' && M.twigtrip.fx?.kind === 'lower' && M.twigtrip.fx.stat === 'spd';
    out.sig = !!M.leafwhirl.sig && M.leafwhirl.fx?.kind === 'multi' && S.SPECIES.whirlwhisk.learn.some(([l, m]) => l === 30 && m === 'leafwhirl');
    out.sigOnlyFinal = all.filter(([, s]) => s.learn.some(([, m]) => m === 'leafwhirl')).map(([id]) => id);
    out.sigFx = typeof R.SIG.leafwhirl === 'function';
    out.big = ['smokescreen', 'duskfalls', 'vanishswap'].map(id => [M[id].fx.kind, !!M[id].big]);
    out.bigLearn = S.SPECIES.hushcoon.learn.filter(([, m]) => ['smokescreen', 'duskfalls', 'vanishswap'].includes(m)).map(x => x.join(':'));
    out.t1 = S.makeCreature('hushcoon', 1).moves.includes('leafstar');
    out.fxTables = !!R.TRAVEL.ninja && !!R.IMPACT.ninja && !!R.FX_COLORS.ninja;
    // the chart cells of plans/T37.md, and no other cell with ninja is not 1
    const eff = S.effectiveness, types = Object.keys(S.TYPE_COLORS);
    const want = { 'ninja>mind': 2, 'ninja>paper': 2, 'ninja>squad': 2, 'ninja>ninja': 0.5, 'ninja>light': 0.5, 'ninja>metal': 0.5,
      'light>ninja': 2, 'sound>ninja': 2, 'ghost>ninja': 0.5, 'camo>ninja': 0.5 };
    out.chartBad = [];
    for (const a of ['normal', ...types]) for (const d of types) {
      if (a !== 'ninja' && d !== 'ninja') continue;
      const v = eff(a, d), w = want[`${a}>${d}`] ?? 1;
      if (v !== w) out.chartBad.push(`${a}>${d} is ${v}, want ${w}`);
    }
    out.types = types.length;
    out.wool = WOOL.ninja;
    try { g.sound.play('fx:ninja'); g.sound.play('smokepuff'); out.sound = g.sound.has('fx:ninja') && g.sound.has('smokepuff'); } catch (e) { out.sound = e.message; }
    out.soundClash = ids7.filter(id => g.sound.has(id));
    return out;
  }, IDS);
  t.ok(JSON.stringify(A.mine) === JSON.stringify([...IDS].sort()), `seven Ninja species (${A.mine})`);
  t.ok(A.families === 4 && A.singles.length === 1 && A.singles[0] === 'bambooze', `three two-stage families and a single-stage Bambooze (${A.families} bases, singles ${A.singles})`);
  t.ok(A.evolve.join() === 'hushcoon>shadecoon@22,peekaw>ravenshade@22,flickit>whirlwhisk@24', `evolution levels kept (${A.evolve})`);
  t.ok(A.shapes.join() === 'bamboo,crow,raccoon,squirrel' && A.shapesRegistered && A.ownShapes, `four own Ninja shapes (${A.shapes}), registered in SHAPES`);
  t.ok(A.bambooShapeUse === 1, 'Bambooze has its own shape');
  t.ok(A.gait, "the 'blink' gait exists and bumps start battles");
  t.ok(!A.problems.length, `all seven pass the data and model checks (mask, headband, size, animation) ${A.problems.join('; ')}`);
  console.log('  sizes:', JSON.stringify(A.sizes));
  t.ok(A.moves.every(m => m === 'ninja'), `the eight moves are Ninja (${A.names.join(', ')})`);
  t.ok(A.sneak && A.t1, 'Sneak Step goes first, Shadow Strike may flinch, Twig Trip slows, Leaf Star is the first move');
  t.ok(A.sig && A.sigFx && A.sigOnlyFinal.join() === 'whirlwhisk', `Leaf Whirlwind is a signature multi-hit move Whirlwhisk learns at 30, with its own effect (${A.sigOnlyFinal})`);
  t.ok(JSON.stringify(A.big) === JSON.stringify([['shield', true], ['field', true], ['sacrifice', true]]) && A.bigLearn.join() === '21:smokescreen,26:duskfalls,32:vanishswap',
    `big moves Smoke Screen (shield), Dusk Falls (field), Vanish Swap (sacrifice) (${A.bigLearn})`);
  t.ok(A.fxTables && A.sound === true && !A.soundClash.length, `attack effects, colours, the fx:ninja and smokepuff sounds exist, no move is named like a sound (${A.sound}; ${A.soundClash})`);
  t.ok(!A.chartBad.length && A.types === 33, `the chart cells of plans/T37.md, all other ninja cells 1, 33 types ${A.chartBad.join('; ')}`);
  t.ok(A.wool === 113, `ninja wool is block 113 (${A.wool})`);

  /* ---------------------------------------------------------------- B. Portraits */
  const shots = await page.evaluate(async ids => {
    const { portrait } = await import('/src/ui.js');
    const S = await import('/src/species.js');
    const W = 220, H = 190, LABEL = 26, COLS = 4, rows = Math.ceil(ids.length / COLS);
    const cv = document.createElement('canvas');
    cv.width = W * COLS; cv.height = (H + LABEL) * rows;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
    const singles = {};
    for (let i = 0; i < ids.length; i++) {
      const img = new Image();
      img.src = portrait(ids[i], W, H);
      await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
      const x = (i % COLS) * W, y = Math.floor(i / COLS) * (H + LABEL);
      ctx.drawImage(img, x, y);
      ctx.fillText(S.SPECIES[ids[i]].name, x + W / 2, y + H + 18);
      singles[ids[i]] = portrait(ids[i], 480, 400);
    }
    return { grid: cv.toDataURL(), singles };
  }, IDS);
  save('t37-creatures.png', shots.grid);
  for (const id of IDS) save(`t37-creature-${id}.png`, shots.singles[id]);
  t.ok(shots.grid.length > 20000, 'portrait grid drawn');

  // the seven in the world, on a platform in daylight
  await platform(page, { day: true });
  const placed = await page.evaluate(async ids => {
    const g = window.pokecraft, y = 43;
    const { sx, sz } = window.__keep;
    g.creatures.clear();
    const out = ids.map((id, i) => {
      const w = g.creatures.spawnAt(id, sx - 4 + i * 1.5, y, sz - 2, { level: 5 });
      w.frozen = true; // posing for the photo
      w.heading = -(i - 3) * 0.15; // facing you
      return !!w;
    });
    g.player.pos.set(sx + 0.5, y, sz + 4);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: sx + 0.5, y: y + 0.4, z: sz - 2 });
    g.player.keys = {};
    return out;
  }, IDS);
  t.ok(placed.every(Boolean), 'all seven stand on the platform');
  await frames(page, 3);
  await page.screenshot({ path: path.join(SHOTS, 't37-creatures-world.png'), timeout: 180000 });
  console.log('  screenshot t37-creatures-world.png');
  await page.evaluate(() => window.pokecraft.creatures.clear());

  /* ---------------------------------------------------------------- C. The blink walk */
  const C = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures, w = g.world, p = g.player;
    const { B } = await import('/src/blocks.js');
    const { GAITS } = await import('/src/creatures.js');
    const G = GAITS.blink;
    const { sx, sz } = window.__keep;
    const out = { problems: [], blinks: [] };
    const Y = 40, R = 14;
    // a spot near the start whose platform (and a margin) is outside every gym box
    const clear = (x0, z0) => { for (let x = x0 - R - 9; x <= x0 + R + 9; x++) for (let z = z0 - R - 9; z <= z0 + R + 9; z++) if (w.fenced(x, Y + 1, z)) return false; return true; };
    let cx = sx + 20, cz = sz - 26;
    for (const [dx, dz] of [[20, -26], [-30, -30], [30, 30], [-30, 30], [0, 40], [40, 0], [0, -40], [-40, 0], [50, 50], [-50, -50]]) if (clear(sx + dx, sz + dz)) { cx = sx + dx; cz = sz + dz; break; }
    window.__plat = { cx, cz };
    let fenced = 0;
    // a 29 x 29 stone platform in the air with a few water cells and a wall piece on it
    const build = () => {
      for (let x = cx - R - 2; x <= cx + R + 2; x++) for (let z = cz - R - 2; z <= cz + R + 2; z++) {
        for (let y = Y - 1; y <= Y + 6; y++) w.set(x, y, z, B.AIR);
        if (Math.abs(x - cx) <= R && Math.abs(z - cz) <= R) { w.set(x, Y, z, B.STONE); if (w.fenced(x, Y + 1, z)) fenced++; }
      }
      for (const [dx, dz] of [[6, 2], [6, 3], [5, -2], [10, -4], [-3, 6], [14, 0]]) w.set(cx + dx, Y, cz + dz, B.WATER); // off the line you run along
      for (let y = 1; y <= 3; y++) for (let k = -2; k <= 2; k++) w.set(cx + 4, Y + y, cz + 5 + k, B.STONE);
    };
    build();
    out.fenced = fenced;
    const mk = (id, x = cx, z = cz) => {
      cm.clear();
      const c = cm.spawnAt(id, x, Y + 1, z, { level: 5 });
      c.life = 1e9;
      return c;
    };
    const legal = (what, from, to, pl) => {
      const b = { x: Math.floor(to.x), y: Math.round(to.y), z: Math.floor(to.z) }, a = { x: Math.floor(from.x), y: Math.round(from.y), z: Math.floor(from.z) };
      const ok = (cond, msg) => { if (!cond) out.problems.push(`${what}: ${msg} (${a.x - cx},${a.y},${a.z - cz} -> ${b.x - cx},${b.y},${b.z - cz})`); };
      ok(w.get(b.x, b.y, b.z) === B.AIR && w.get(b.x, b.y + 1, b.z) === B.AIR, 'no room at the new spot');
      const under = w.get(b.x, b.y - 1, b.z);
      ok(under !== B.AIR && under !== B.WATER, 'nothing solid under the new spot');
      ok(Math.abs(b.y - a.y) <= 3, `height change ${b.y - a.y}`);
      ok(!w.fenced(b.x, b.y, b.z), 'in a gym box');
      ok(Math.abs(b.x - cx) <= R && Math.abs(b.z - cz) <= R, 'off the platform');
      const d = Math.hypot(to.x - from.x, to.z - from.z);
      ok(d >= 3 && d <= 7.6, `blink is ${d.toFixed(2)} blocks`);
      ok(Math.hypot(pl.x - to.x, pl.z - to.z) > Math.hypot(pl.x - from.x, pl.z - from.z), 'closer to the player');
      out.blinks.push([b.x - cx, b.z - cz, +d.toFixed(1)]);
    };
    // The player runs (or walks) at the creature with the real physics; the creature updates in the same steps.
    const chase = (c, { sprint, dt = 0.05, steps = 600, startX = -11, stopOnBump = true }) => {
      p.pos.set(c.pos.x + startX, Y + 1, c.pos.z);
      p.vel.set(0, 0, 0);
      p.keys = { KeyW: true, ...(sprint ? { ShiftLeft: true } : {}) };
      const r = { blinks: 0, bumps: 0, tiredAt: -1, tiredCalls: 0, hiddenAfter: null, shownAgain: null, puffs: 0, closing: 0, steps: 0 };
      cm.onTired = () => { r.tiredCalls++; };
      cm.onBump = () => { r.bumps++; };
      cm.onBlink = () => {};
      let blinkFrom = null;
      for (let i = 0; i < steps; i++) {
        r.steps = i;
        p.lookAt({ x: c.pos.x, y: p.pos.y + 1.62, z: c.pos.z });
        p.update(dt);
        const was = !!c.blink, before = c.pos.clone();
        cm.update(dt, p.pos, g.spawnPoint, false, false);
        r.closing = Math.max(r.closing, c.closing || 0);
        if (!was && c.blink) {
          r.blinks++;
          blinkFrom = before;
          legal(`${sprint ? 'sprint' : 'walk'} dt ${dt}`, before, c.pos, p.pos);
          if (r.hiddenAfter === null) { r.hiddenAfter = !c.model.visible; r.puffs = cm.puffs.length; }
        }
        if (was && !c.blink && r.shownAgain === null) r.shownAgain = c.model.visible;
        if (c.tired > 0 && r.tiredAt < 0) r.tiredAt = i;
        if (r.bumps && stopOnBump) break;
      }
      p.keys = {};
      return r;
    };
    // 1. far away nothing happens, also with a fast viewer
    {
      const c = mk('hushcoon');
      const v = c.pos.clone(); v.x -= 20;
      cm.viewer = v;
      for (let i = 0; i < 30; i++) { v.x += 0.3; cm.updateOne(c, 0.05); } // 6 blocks/s, from 20 to 11 blocks away
      out.farStill = c.pos.x === cx + 0.5 && !c.blink && c.hops === 0;
    }
    // 2. sprinting at it: three blinks, then it is out of breath and you run into it
    const s1 = chase(mk('hushcoon'), { sprint: true });
    out.s1 = s1;
    // 3. the same with longer steps
    build();
    const s2 = chase(mk('peekaw'), { sprint: true, dt: 0.1, steps: 300 });
    out.s2 = s2;
    // 4. walking up slowly: no blink, you reach it, and the battle starts
    build();
    {
      const c = mk('flickit');
      const r = chase(c, { sprint: false });
      out.walk = r;
    }
    window.__chase = chase; window.__mk = mk; // section F starts a real battle the same way
    return out;
  });
  t.ok(C.fenced === 0, 'the test platform is outside every gym box');
  t.ok(C.farStill, 'a Hushcoon 12+ blocks away stays put, even with you running');
  t.ok(C.s1.blinks === 3 && C.s1.tiredAt >= 0 && C.s1.tiredCalls === 1 && C.s1.bumps === 1, `sprinting at it: 3 blinks, then tired (onTired once) and you run into it (${JSON.stringify(C.s1)})`);
  t.ok(C.s1.hiddenAfter === true && C.s1.shownAgain === true && C.s1.puffs >= 1, `it vanishes in a puff and shows up again (${C.s1.hiddenAfter}, ${C.s1.shownAgain}, ${C.s1.puffs} puffs)`);
  t.ok(C.s1.closing > 5.2, `sprinting closes in at ${C.s1.closing.toFixed(2)} blocks/s (more than 5.2)`);
  t.ok(C.s2.blinks === 3 && C.s2.bumps === 1, `with 0.1 s steps too (${JSON.stringify(C.s2)})`);
  t.ok(!C.problems.length, `every blink lands on a free, dry, solid spot on the platform, 3-7 blocks away, further from you ${C.problems.slice(0, 6).join('; ')}`);
  console.log('  blinks (x, z, distance):', JSON.stringify(C.blinks));
  t.ok(C.walk.blinks === 0 && C.walk.bumps === 1 && C.walk.closing < 5.2 && C.walk.closing > 3.5, `walking up slowly: no blink, you reach it (${JSON.stringify(C.walk)})`);

  // C2: tired lasts, cornered, water and gyms, teleports, puffs
  const C2 = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures, w = g.world;
    const { B } = await import('/src/blocks.js');
    const { GAITS } = await import('/src/creatures.js');
    const G = GAITS.blink;
    const { sx, sz } = window.__keep;
    const out = {};
    const Y = 40, { cx, cz } = window.__plat;
    g.inBattle = false; document.body.classList.remove('in-battle');
    const mk = (id, x = cx, z = cz) => { cm.clear(); const c = cm.spawnAt(id, x, Y + 1, z, { level: 5 }); c.life = 1e9; return c; };
    const V = (c, dx) => { const v = c.pos.clone(); v.x += dx; return v; };
    // a viewer running at the creature (6.2 blocks/s) along x
    const run = (c, v, dt, n) => { for (let i = 0; i < n; i++) { v.x += 6.2 * dt * Math.sign(c.pos.x - v.x || 1); cm.viewer = v; cm.updateOne(c, dt); } };
    // tired: no blink for 10 s, it pants, then it blinks again
    {
      const c = mk('bambooze');
      let tired = 0;
      cm.onTired = () => { tired++; };
      c.hops = G.tiredAfter - 1;
      const v = V(c, -7);
      cm.viewer = v; cm.updateOne(c, 0.05);
      run(c, v, 0.05, 4);
      while (c.blink) cm.updateOne(c, 0.05);
      out.tired = c.tired > 0 && tired === 1;
      const at = c.pos.clone();
      v.copy(at); v.x -= 7;
      let moved = false;
      for (let i = 0; i < 150; i++) { v.x += 6.2 * 0.05; if (v.x > at.x - 0.5) v.x = at.x - 7; cm.viewer = v; cm.updateOne(c, 0.05); if (!c.pos.equals(at)) moved = true; }
      out.tiredStill = !moved && c.tired > 0 && c.model.scale.y <= 1;
      for (let i = 0; i < 60; i++) cm.updateOne(c, 0.05);
      out.tiredOver = c.tired === 0 && c.hops === 0;
      v.copy(c.pos); v.x -= 7; cm.viewer = v; cm.updateOne(c, 0.05);
      run(c, v, 0.05, 4);
      out.blinksAgain = !!c.blink || !c.pos.equals(at);
    }
    // a teleport next to it is not running: no blink
    {
      const c = mk('hushcoon');
      cm.viewer = V(c, -12); cm.updateOne(c, 0.05);
      cm.viewer = V(c, -2); cm.updateOne(c, 0.05);
      out.teleport = !c.blink && c.hops === 0;
    }
    // cornered in a hole (walls 4 high): it cannot blink, so it is tired at once
    {
      const hx = cx - 6, hz = cz - 6;
      for (let x = hx - 8; x <= hx + 8; x++) for (let z = hz - 8; z <= hz + 8; z++) for (let y = 1; y <= 4; y++) if (x !== hx || z !== hz) w.set(x, Y + y, z, B.STONE);
      const c = mk('peekaw', hx, hz);
      let calls = 0;
      cm.onTired = () => { calls++; };
      const v = V(c, -6); cm.viewer = v; cm.updateOne(c, 0.05);
      run(c, v, 0.05, 3);
      out.cornered = { tired: c.tired > 0, moved: c.pos.x !== hx + 0.5 || c.pos.z !== hz + 0.5, calls };
      for (let x = hx - 8; x <= hx + 8; x++) for (let z = hz - 8; z <= hz + 8; z++) for (let y = 1; y <= 4; y++) w.set(x, Y + y, z, B.AIR);
    }
    // the landing rule: water, gyms, no floor, a wall
    out.landWater = cm.blinkLanding(G, Y + 1, cx + 6, cz + 2);
    out.landStone = cm.blinkLanding(G, Y + 1, cx + 2, cz);
    out.landAir = cm.blinkLanding(G, Y + 1, cx + 40, cz + 40);
    w.set(cx + 2, Y + 1, cz - 3, B.STONE); w.set(cx + 2, Y + 2, cz - 3, B.STONE); w.set(cx + 2, Y + 3, cz - 3, B.STONE);
    out.landWall = cm.blinkLanding(G, Y + 1, cx + 2, cz - 3);
    const gym = w.gyms.find(q => !q.home && q.x != null && q.protect?.length);
    const b = gym.protect[0], gx = Math.floor((b.x0 + b.x1) / 2) + 3, gz = Math.floor((b.z0 + b.z1) / 2) + 3;
    let gy = -1;
    for (let y = b.y0 + 1; y < Math.min(b.y1, 45); y++) if (w.get(gx, y, gz) === B.AIR && w.get(gx, y + 1, gz) === B.AIR && w.get(gx, y - 1, gz) !== B.AIR) { gy = y; break; }
    out.gymSpot = gy;
    out.landGym = gy > 0 ? cm.blinkLanding(G, gy, gx, gz) : 'no spot';
    // puffs fade away
    cm.updatePuffs(1);
    out.puffsGone = cm.puffs.length === 0;
    cm.puff({ x: cx, y: Y + 1, z: cz });
    out.puffMade = cm.puffs.length === 1;
    cm.update(0.7, g.player.pos, g.spawnPoint, false, false);
    out.puffFaded = cm.puffs.length === 0;
    cm.clear();
    return out;
  });
  t.ok(C2.tired && C2.tiredStill, `after 3 blinks it is out of breath and stays put even when you run at it (${C2.tired}, ${C2.tiredStill})`);
  t.ok(C2.tiredOver && C2.blinksAgain, `after 10 s it can blink again (${C2.tiredOver}, ${C2.blinksAgain})`);
  t.ok(C2.teleport, 'a teleport next to it does not count as running');
  t.ok(C2.cornered.tired && !C2.cornered.moved && C2.cornered.calls === 1, `cornered in a hole it is tired at once (${JSON.stringify(C2.cornered)})`);
  t.ok(C2.landWater === null && C2.landStone === 41 && C2.landAir === null && C2.landWall === null, `never into water, the air or a wall (${C2.landWater}, ${C2.landStone}, ${C2.landAir}, ${C2.landWall})`);
  t.ok(C2.landGym === null, `never into a gym (spot y ${C2.gymSpot}: ${C2.landGym})`);
  t.ok(C2.puffsGone && C2.puffMade && C2.puffFaded, 'smoke puffs fade away');

  /* ---------------------------------------------------------------- D. Spawns and the 'evening' condition */
  const D = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures;
    const S = await import('/src/species.js');
    const R = await import('/src/spawnrules.js');
    const Bk = await import('/src/book.js');
    const out = {};
    const picks = (biome, ctx, n = 4000) => { const r = []; for (let i = 0; i < n; i++) r.push(cm.pickEntry(biome, ctx)); return r; };
    const ninja = e => S.SPECIES[e[0]].type === 'ninja';
    const noon = picks('forest', { night: false, evening: false }).filter(ninja);
    const night = picks('forest', { night: true, evening: false }).filter(ninja);
    const eve = picks('forest', { night: false, evening: true }).filter(ninja);
    out.noon = [...new Set(noon.map(e => e[0]))].sort();
    out.night = [...new Set(night.map(e => e[0]))].sort();
    out.shareNoon = noon.length / 4000; out.shareNight = night.length / 4000; out.shareEve = eve.length / 4000;
    out.cave = Object.values(S.SPAWNS.cave).some(e => S.SPECIES[e[0]].type === 'ninja');
    out.cond = [R.condOk('evening', { night: false, evening: false }), R.condOk('evening', { evening: true }), R.condOk('evening', { night: true })];
    out.text = R.condText('evening');
    out.ctxEvening = (() => { const t0 = g.time; g.time = 0.45; const a = cm.context(g.player.pos, false, false).evening; g.time = 0.1; const b = cm.context(g.player.pos, false, false).evening; g.time = t0; return [a, b]; })();
    out.book = Bk.spawnInfo('hushcoon').map(r => `${r.name}: ${r.words}`);
    out.bookBamboo = Bk.spawnInfo('bambooze').map(r => `${r.name}: ${r.words}`);
    return out;
  });
  t.ok(D.noon.join() === 'bambooze,flickit,whirlwhisk' && D.night.includes('hushcoon') && D.night.includes('peekaw') && D.night.includes('shadecoon'),
    `in the forest at noon only Flickit, Whirlwhisk and Bambooze; at night the others too (noon ${D.noon}; night ${D.night})`);
  t.ok(D.shareNight > D.shareNoon && D.shareEve > D.shareNoon && D.shareNight < 0.2, `more ninjas in the evening and at night (noon ${D.shareNoon.toFixed(3)}, evening ${D.shareEve.toFixed(3)}, night ${D.shareNight.toFixed(3)})`);
  t.ok(!D.cave, 'no ninja in the cave table');
  t.ok(JSON.stringify(D.cond) === '[false,true,true]' && JSON.stringify(D.ctxEvening) === '[true,false]', `'evening' holds in the evening and at night (${D.cond}; context ${D.ctxEvening})`);
  t.ok(D.book.some(r => r.includes('In the evening and at night') || r.includes('in the evening and at night')), `the Book words it (${D.book.join(' | ')})`);

  /* ---------------------------------------------------------------- E. A Book page */
  await page.evaluate(() => {
    const g = window.pokecraft;
    g.inBattle = false; document.body.classList.remove('in-battle');
    document.exitPointerLock?.();
    for (const id of ['flickit', 'whirlwhisk']) { g.book.markSeen(id); g.book.markCaught(id); }
    g.book.open({ species: 'whirlwhisk' });
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#book-detail img')].every(i => i.src.startsWith('data:')), null, { timeout: 60000 });
  const E = await page.evaluate(() => ({ text: document.getElementById('book-detail')?.textContent || '', page: window.pokecraft.book.page }));
  await page.screenshot({ path: path.join(SHOTS, 't37-book-whirlwhisk.png'), timeout: 180000 });
  console.log('  screenshot t37-book-whirlwhisk.png');
  t.ok(E.text.includes('Whirlwhisk') && E.text.includes('Leaf Whirlwind') && E.text.includes('Flickit') && /ninja/i.test(E.text), `the Book page shows Whirlwhisk, its move and Flickit (${E.text.slice(0, 160)}...)`);

  /* ---------------------------------------------------------------- F. Walking up slowly starts a real battle */
  await page.keyboard.press('Escape');
  const F = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures;
    const c = window.__mk('flickit');
    let r = null;
    const realBump = cm.onBump;
    r = window.__chase(c, { sprint: false, startX: -6 });
    cm.onBump = realBump;
    if (!r.bumps) return { r };
    // what main.js's onBump does while playing (startBattle)
    g.inBattle = true; document.body.classList.add('in-battle');
    document.getElementById('pause').classList.add('hidden');
    g.battle.start({ wild: c });
    return { r, active: g.battle.active, foe: g.battle.foes?.[0]?.species, frozen: c.frozen, visible: c.model.visible };
  });
  t.ok(F.r.blinks === 0 && F.active && F.foe === 'flickit' && F.frozen && F.visible, `walking into a Flickit starts a battle with it (${JSON.stringify(F)})`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, 't37-battle.png'), timeout: 180000 });
  console.log('  screenshot t37-battle.png');
  t.ok(!errors.length, `no page errors ${errors.slice(0, 3).join(' | ')}`);
}
