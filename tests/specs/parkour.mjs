// T36 Parkour: the seven creatures (A), the "high places" spawn condition (B), the run-away walk (C) and, from step B of
// the task, the Obstacle Course gym (D; T36.5 made it a tall timed course: pieces, jump rules, crumble / blink / zap / pusher / spring checks). Creature logic is driven inside one page.evaluate with synchronous
// cm.updateOne / cm.update loops (the game loop cannot run in between, nothing depends on the frame rate).
// Screenshots go to tests/screenshots/t36-*.png and t365-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { openGame, newGame, platform, playBattle, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const IDS = ['teetail', 'tightropa', 'zippet', 'ferrocket', 'vaultling', 'highvault', 'zoomstick'];

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

  /* ---------------------------------------------------------------- A. Data and models */
  const A = await page.evaluate(async ids => {
    const S = await import('/src/species.js');
    const SH = await import('/src/shapes.js');
    const R = await import('/src/fxrecipes.js');
    const THREE = await import('three');
    const g = window.pokecraft;
    const out = { problems: [] };
    const bad = (id, msg) => out.problems.push(`${id}: ${msg}`);
    const all = Object.entries(S.SPECIES);
    const evolvesInto = new Set(all.map(([, s]) => s.evolve?.into).filter(Boolean));
    const names = all.map(([, s]) => s.name.toLowerCase());
    const mine = all.filter(([, s]) => s.type === 'parkour').map(([id]) => id);
    out.mine = mine.slice().sort();
    out.families = mine.filter(id => !evolvesInto.has(id)).length;
    out.singles = mine.filter(id => !S.SPECIES[id].evolve && !evolvesInto.has(id));
    const shapeUse = {};
    for (const [, s] of all) shapeUse[s.model.shape] = (shapeUse[s.model.shape] || 0) + 1;
    out.shapes = [...new Set(mine.map(id => S.SPECIES[id].model.shape))].sort();
    out.shapesRegistered = out.shapes.every(sh => typeof SH.SHAPES[sh] === 'function');
    out.zoomShapeUse = shapeUse[S.SPECIES.zoomstick.model.shape];
    const sigOf = m => {
      let sum = 0;
      m.updateMatrixWorld(true);
      m.traverse(o => { if (o.isMesh) for (const v of o.matrixWorld.elements) sum += v; });
      return sum;
    };
    out.mins = {};
    for (const id of ids) {
      const s = S.SPECIES[id];
      if (!s) { bad(id, 'missing'); continue; }
      if (s.type !== 'parkour') bad(id, `type ${s.type}`);
      if (s.evolve && S.SPECIES[s.evolve.into].type !== 'parkour') bad(id, 'evolution changes type');
      if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(id, `name ${s.name} is not unique`);
      if (!s.desc || s.desc.length > 110) bad(id, `desc is ${s.desc?.length} characters`);
      if (s.gait !== 'hopaway') bad(id, `gait ${s.gait}`);
      const where = Object.entries(S.SPAWNS).flatMap(([biome, list]) => list.filter(e => e[0] === id).map(e => ({ biome, w: e[1], when: e[2] })));
      if (!where.length) bad(id, 'in no SPAWNS table');
      for (const e of where) { if (e.when !== 'high') bad(id, `spawns ${e.when} in ${e.biome}`); if (e.w > 1.5) bad(id, `weight ${e.w}`); if (e.biome === 'cave') bad(id, 'in the cave table'); }
      const c = S.makeCreature(id, 5);
      if (c.moves.length < 2) bad(id, `only ${c.moves.length} moves at Lv 5`);
      if (!S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === 'parkour')) bad(id, 'no parkour move at Lv 20');
      for (const [, m] of s.learn) if (!S.MOVES[m]) bad(id, `move ${m} missing`);
      try {
        const m = S.buildModel(id);
        S.animateModel(m, 0);
        const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
        if (size.y < 0.35 || size.y > 2.6) bad(id, `height ${size.y.toFixed(2)} outside 0.35-2.6`);
        if (size.x > 2.6 || size.z > 2.6) bad(id, `width/depth ${size.x.toFixed(2)}/${size.z.toFixed(2)} over 2.6`);
        let min = box.min.y;
        for (const [tm, mv] of [[0.3, false], [0.7, true], [1.1, false], [1.9, true], [2.6, true]]) {
          S.animateModel(m, tm, mv);
          min = Math.min(min, new THREE.Box3().setFromObject(m).min.y);
        }
        out.mins[id] = +min.toFixed(3);
        if (min < -0.1) bad(id, `goes under the ground (min.y ${min.toFixed(2)})`);
        S.animateModel(m, 0.3, false); const a = sigOf(m);
        S.animateModel(m, 1.1, false); const b = sigOf(m);
        if (Math.abs(a - b) < 1e-6) bad(id, 'no idle animation');
        let band = 0, shoe = 0;
        m.traverse(o => { if (o.userData.gear === 'band') band++; if (o.userData.gear === 'shoe') shoe++; });
        if (band < 1) bad(id, 'no sweatband');
        if (shoe < 2) bad(id, `${shoe} sneakers`);
        S.disposeModel(m);
      } catch (e) { bad(id, `model failed: ${e.message}`); }
    }
    // moves
    const M = S.MOVES;
    out.moves = ['wallhop', 'flipkick', 'quickvault', 'warmup', 'rooftoprun', 'tripleflip', 'finalsprint'].map(id => M[id]?.type);
    out.quick = M.quickvault.priority;
    out.warm = M.warmup.fx?.kind;
    out.sig = !!M.rooftoprun.sig && S.SPECIES.highvault.learn.some(([l, m]) => l === 30 && m === 'rooftoprun');
    out.sigFx = typeof R.SIG.rooftoprun === 'function';
    out.big = [M.tripleflip.fx.kind, M.tripleflip.big, M.finalsprint.fx.kind, M.finalsprint.big];
    out.bigLearn = S.SPECIES.teetail.learn.filter(([, m]) => ['tripleflip', 'finalsprint'].includes(m)).map(x => x.join(':'));
    out.fxTables = !!R.TRAVEL.parkour && !!R.IMPACT.parkour && !!R.FX_COLORS.parkour;
    out.chart = S.effectiveness('parkour', 'dream') === 2 && S.effectiveness('squad', 'parkour') === 2;
    try { g.sound.play('fx:parkour'); out.sound = true; } catch (e) { out.sound = e.message; }
    return out;
  }, IDS);
  t.ok(JSON.stringify(A.mine) === JSON.stringify([...IDS].sort()), `seven Parkour species (${A.mine})`);
  t.ok(A.families === 4 && A.singles.length === 1 && A.singles[0] === 'zoomstick', `three two-stage families and a single-stage Zoomstick (${A.families} bases, singles ${A.singles})`);
  t.ok(A.shapes.length >= 3 && A.shapesRegistered, `${A.shapes.length} Parkour shapes (${A.shapes}), all registered in SHAPES`);
  t.ok(A.zoomShapeUse === 1, 'Zoomstick has its own shape');
  t.ok(!A.problems.length, `all seven pass the data and model checks ${A.problems.join('; ')}`);
  console.log('  lowest point of each model (all animation samples):', JSON.stringify(A.mins));
  t.ok(A.moves.every(m => m === 'parkour'), `the five moves and two big moves are Parkour (${A.moves})`);
  t.ok(A.quick === 1 && A.warm === 'raise', 'Quick Vault goes first, Warm Up raises attack');
  t.ok(A.sig && A.sigFx, 'Rooftop Run is a signature move Highvault learns at 30 and has its own effect');
  t.ok(A.big[0] === 'risky' && A.big[1] && A.big[2] === 'lastword' && A.big[3] && A.bigLearn.join() === '29:tripleflip,34:finalsprint', `Triple Flip (risky) and Final Sprint (lastword) (${A.big}; ${A.bigLearn})`);
  t.ok(A.fxTables && A.sound === true && A.chart, `attack effects, colours, the fx:parkour sound and the chart rows exist (${A.sound})`);

  // Portraits: a grid of the seven, then the seven standing on a high platform in daylight.
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
  save('t36-creatures.png', shots.grid);
  for (const id of IDS) save(`t36-creature-${id}.png`, shots.singles[id]);
  t.ok(shots.grid.length > 20000, 'portrait grid drawn');

  await platform(page, { day: true });
  const placed = await page.evaluate(async ids => {
    const g = window.pokecraft, y = 43;
    const sx = window.__keep.sx, sz = window.__keep.sz;
    g.creatures.clear();
    g.time = 0.25;
    const out = [];
    ids.forEach((id, i) => {
      const x = sx - 4 + i * 1.5, z = sz - 2;
      const w = g.creatures.spawnAt(id, x, y - 0, z, { level: 5, when: 'high' });
      w.frozen = true; // posing for the photo
      w.heading = Math.PI + (i - 3) * 0.12;
      out.push(!!w);
    });
    g.player.pos.set(sx + 0.5, y, sz + 4);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: sx + 0.5, y: y + 0.4, z: sz - 2 });
    g.player.keys = {};
    return out;
  }, IDS);
  t.ok(placed.every(Boolean), 'all seven stand on the platform');
  await frames(page, 3);
  await page.screenshot({ path: path.join(SHOTS, 't36-creatures-world.png'), timeout: 180000 });
  console.log('  screenshot t36-creatures-world.png');
  await page.evaluate(() => window.pokecraft.creatures.clear());

  /* ---------------------------------------------------------------- B. The condition */
  const Bres = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures, w = g.world;
    const { B } = await import('/src/blocks.js');
    const S = await import('/src/species.js');
    const R = await import('/src/spawnrules.js');
    const Bk = await import('/src/book.js');
    const { sx, sz } = window.__keep;
    const out = {};
    const colOf = (x, z) => x + z * w.W;
    // a natural column near the start that is no perch (no tree)
    let nx = sx + 14, nz = sz + 14;
    for (let k = 0; k < 40; k++, nx++) if (w.surface(nx, nz).y - w.ground[colOf(nx, nz)] < 3 && w.surface(nx, nz).id !== B.WATER) break;
    out.natural = cm.isPerch(nx, nz);
    const pillar = (x, z, n, id = B.STONE, record = true) => { const g0 = w.ground[colOf(x, z)]; for (let k = n + 1; k <= 16 && g0 + k < 47; k++) w.set(x, g0 + k, z, B.AIR, false); for (let k = 1; k <= n; k++) w.set(x, g0 + k, z, id, record); return g0; }; // the air above is cleared first (a tree there would be a perch)
    const px = nx + 3, pz = nz;
    const g4 = pillar(px, pz, 4);
    out.pillar4 = cm.isPerch(px, pz); out.pillar4Want = { x: px, y: g4 + 5, z: pz };
    pillar(px + 2, pz, 2);
    out.pillar2 = cm.isPerch(px + 2, pz);
    const wx = px, wz = pz + 3;
    pillar(wx, wz, 3);
    w.set(wx, w.ground[colOf(wx, wz)] + 4, wz, B.WATER);
    out.waterTop = cm.isPerch(wx, wz);
    const dx = px + 4, dz = pz;
    pillar(dx, dz, 4, B.DIRT, false);
    out.raised = cm.isPerch(dx, dz);
    // a tree top: logs and leaves placed without edits (not a ground block, so it counts)
    const tx = px + 6, tz = pz;
    pillar(tx, tz, 3, B.LOG, false);
    w.set(tx, w.ground[colOf(tx, tz)] + 4, tz, B.LEAVES, false);
    out.tree = cm.isPerch(tx, tz);
    // a real tree near the start, if there is one
    out.realTree = null;
    for (let x = sx - 40; x <= sx + 40 && !out.realTree; x++) for (let z = sz - 40; z <= sz + 40; z++) if (w.surface(x, z).id === B.LEAVES && w.surface(x, z).y - w.ground[colOf(x, z)] >= 3) { out.realTree = cm.isPerch(x, z); break; }
    // inside a gym box
    const gym = w.gyms.find(q => !q.home && q.protect?.length);
    const b = gym.protect[0], gx = b.x0 + 1, gz = b.z0 + 1;
    const gg = w.ground[colOf(gx, gz)];
    for (let k = 1; k <= 4; k++) w.set(gx, gg + k, gz, B.STONE, false);
    out.gymFenced = w.fenced(gx, gg + 5, gz);
    out.gym = cm.isPerch(gx, gz);
    for (let k = 1; k <= 4; k++) w.set(gx, gg + k, gz, B.AIR, false);
    // the context
    const here = g.player.pos;
    out.ctxPerch = typeof cm.context(here, false, false).perch;
    out.ctxUnder = cm.context(here, false, true).perch;
    // the share
    const spot = { x: px, y: g4 + 5, z: pz };
    const picks = (ctx, n = 3000) => { const r = []; for (let i = 0; i < n; i++) r.push(cm.pickEntry('forest', ctx)); return r; };
    const typeOf = e => S.SPECIES[e[0]].type;
    const withPerch = picks({ night: false, perch: () => spot });
    const pk = withPerch.filter(e => typeOf(e) === 'parkour');
    out.share = pk.length / withPerch.length;
    out.allHigh = pk.every(e => e[1] === 'high');
    out.noPerch = picks({ night: false }).filter(e => typeOf(e) === 'parkour').length;
    out.nullPerch = picks({ night: false, perch: null }).filter(e => typeOf(e) === 'parkour').length;
    cm.list.push({ when: 'high' }, { when: 'high' });
    out.maxTwo = picks({ night: false, perch: () => spot }).filter(e => typeOf(e) === 'parkour').length;
    cm.list.length = 0;
    // spawnPlaced puts it exactly on the perch, once-only toast
    g.toldOnce.clear();
    window.__toasts.length = 0;
    const ctx = { night: false, perch: () => spot };
    const handled = cm.spawnPlaced('teetail', 'high', ctx, g.spawnPoint);
    const wild = cm.list[0];
    out.placed = { handled, x: wild?.pos.x, y: wild?.pos.y, z: wild?.pos.z, indoor: !!wild?.indoor, when: wild?.when };
    cm.spawnPlaced('zippet', 'high', ctx, g.spawnPoint);
    out.toasts = window.__toasts.filter(m => m.startsWith('Look up')).length;
    out.spawned = cm.list.length;
    // not placed without a perch
    cm.clear();
    out.noSpot = cm.spawnPlaced('teetail', 'high', { night: false, perch: () => null }, g.spawnPoint) && cm.list.length === 0;
    // a high creature stays while above ground and goes underground (the context says so)
    out.stay = R.condOk('high', cm.context(here, false, false));
    out.leave = R.condOk('high', cm.context(here, false, true));
    // the Book
    out.book = Bk.spawnInfo('teetail').map(r => r.name);
    out.bookTightropa = Bk.spawnInfo('highvault').map(r => r.name);
    return out;
  });
  t.ok(Bres.natural === null, 'a natural column is no perch');
  t.ok(JSON.stringify(Bres.pillar4) === JSON.stringify(Bres.pillar4Want), `a 4-high stone pillar is a perch, on its top (${JSON.stringify(Bres.pillar4)})`);
  t.ok(Bres.pillar2 === null, 'a 2-high pillar is not');
  t.ok(Bres.waterTop === null, 'water on top of a pillar is not');
  t.ok(Bres.raised === null, 'ground raised without an edit (a gym builder) is not');
  t.ok(!!Bres.tree && Bres.tree.y > 0, `a tree top is a perch (${JSON.stringify(Bres.tree)}${Bres.realTree ? ', a real tree too' : ', no real tree nearby'})`);
  if (Bres.realTree !== null) t.ok(!!Bres.realTree, 'a real tree top is a perch');
  t.ok(Bres.gymFenced && Bres.gym === null, `a spot inside a gym box is not (fenced ${Bres.gymFenced})`);
  t.ok(Bres.ctxPerch === 'function' && Bres.ctxUnder === null, `context() has perch above ground and none underground (${Bres.ctxPerch}, ${Bres.ctxUnder})`);
  t.ok(Bres.share > 0.02 && Bres.share < 0.05 && Bres.allHigh, `with a perch the Parkour share is about 1/30 (${Bres.share.toFixed(3)}), all 'high'`);
  t.ok(Bres.noPerch === 0 && Bres.nullPerch === 0, 'without a perch no Parkour creature is picked (older specs unchanged)');
  t.ok(Bres.maxTwo === 0, 'with two out already, no third');
  t.ok(Bres.placed.handled && Bres.placed.x === Bres.pillar4Want.x + 0.5 && Bres.placed.y === Bres.pillar4Want.y && Bres.placed.z === Bres.pillar4Want.z + 0.5 && !Bres.placed.indoor && Bres.placed.when === 'high',
    `spawnPlaced puts it on the perch, not indoor (${JSON.stringify(Bres.placed)})`);
  t.ok(Bres.spawned === 2 && Bres.toasts === 1, `the "Look up!" toast shows once per session (${Bres.toasts} for ${Bres.spawned} spawns)`);
  t.ok(Bres.noSpot, 'no perch found = no spawn');
  t.ok(Bres.stay && !Bres.leave, 'the condition holds above ground and fails underground');
  t.ok(Bres.book.filter(n => n === 'Up high: on treetops, roofs and tall pillars').length === 1 && Bres.book.length === 1, `the Book has one row for it (${Bres.book})`);

  /* ---------------------------------------------------------------- C. The run-away walk */
  const C = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures, w = g.world;
    const { B } = await import('/src/blocks.js');
    const { sx, sz } = window.__keep;
    const out = { problems: [], hops: [] };
    const Y = 40;
    const cx = sx + 20, cz = sz - 24; // away from the start and the pillars above
    out.fenced = w.fenced(cx, Y + 1, cz);
    // 15 x 15 platform, air above it and a gap of air below the edges
    const rebuild = () => {
      for (let x = cx - 9; x <= cx + 9; x++) for (let z = cz - 9; z <= cz + 9; z++) {
        for (let y = Y; y <= Y + 6; y++) w.set(x, y, z, B.AIR);
        if (Math.abs(x - cx) <= 7 && Math.abs(z - cz) <= 7) w.set(x, Y, z, B.STONE);
      }
      w.set(cx + 5, Y, cz + 5, B.WATER);                  // a water cell
      w.set(cx - 5, Y + 1, cz + 5, B.STONE);             // a 1-high step
      for (let y = 1; y <= 3; y++) for (let x = cx - 6; x <= cx - 4; x++) w.set(x, Y + y, cz - 5, B.STONE); // a 3-high wall piece
    };
    rebuild();
    const mk = (id, x, z, y = Y + 1) => {
      cm.clear();
      const c = cm.spawnAt(id, x, y, z, { level: 5, when: 'high' });
      c.life = 1e9;
      return c;
    };
    const cell = p => ({ x: Math.floor(p.x), y: Math.round(p.y), z: Math.floor(p.z) });
    const check = (what, from, to, pl) => {
      const a = cell(from), b = cell(to);
      const ok = (cond, msg) => { if (!cond) out.problems.push(`${what}: ${msg} (${a.x},${a.y},${a.z} -> ${b.x},${b.y},${b.z})`); };
      ok(w.get(b.x, b.y, b.z) === B.AIR && w.get(b.x, b.y + 1, b.z) === B.AIR, 'no air at the landing');
      ok(w.get(b.x, b.y - 1, b.z) !== B.AIR && w.get(b.x, b.y - 1, b.z) !== B.WATER, 'nothing solid below the landing');
      ok(b.y - a.y <= 1, `climbs ${b.y - a.y}`);
      ok(a.y - b.y <= 2, `drops ${a.y - b.y}`);
      ok(Math.abs(b.x - cx) <= 7 && Math.abs(b.z - cz) <= 7, 'leaves the platform');
      const d = Math.hypot(to.x - from.x, to.z - from.z);
      ok(d >= 1 && d <= 4.3, `hop is ${d.toFixed(2)} blocks`);
      ok(Math.hypot(pl.x - to.x, pl.z - to.z) >= Math.hypot(pl.x - from.x, pl.z - from.z) - 1e-6, 'lands closer to the player');
      out.hops.push([a.x - cx, a.z - cz, b.x - cx, b.z - cz]);
    };
    // The player keeps 3 blocks behind the creature, on the side away from the middle, so the creature runs towards it.
    const chase = (c, p) => {
      let dx = cx + 0.5 - c.pos.x, dz = cz + 0.5 - c.pos.z;
      const l = Math.hypot(dx, dz);
      if (l < 1.5) { dx = 1; dz = 0; } else { dx /= l; dz /= l; }
      p.set(c.pos.x - dx * 3, c.pos.y, c.pos.z - dz * 3);
    };
    const run = (dt, label) => {
      const c = mk('teetail', cx, cz);
      const p = c.pos.clone();
      let tiredCalls = 0;
      cm.onTired = () => { tiredCalls++; };
      cm.viewer = p;
      p.set(c.pos.x - 3, c.pos.y, c.pos.z);
      let landed = 0, last = c.pos.clone(), maxSteps = 4000, steps = 0, tiredAt = -1;
      const whole = () => Math.abs(c.pos.x - 0.5 - Math.floor(c.pos.x)) < 1e-9 && Math.abs(c.pos.z - 0.5 - Math.floor(c.pos.z)) < 1e-9 && Math.abs(c.pos.y - Math.round(c.pos.y)) < 1e-9;
      while (steps++ < maxSteps && c.tired <= 0) {
        const wasHop = !!c.hop;
        cm.updateOne(c, dt);
        if (wasHop && !c.hop) { // landed
          if (!whole()) out.problems.push(`${label}: lands off a cell (${c.pos.x}, ${c.pos.y}, ${c.pos.z})`);
          check(label, last, c.pos, p);
          landed++;
          last = c.pos.clone();
          if (c.tired <= 0) chase(c, p);
        }
      }
      return { c, p, landed, tiredCalls, steps };
    };
    // 1. nothing happens until you come near
    {
      const c = mk('teetail', cx, cz);
      cm.viewer = new c.pos.constructor(c.pos.x + 12, c.pos.y, c.pos.z);
      for (let i = 0; i < 60; i++) cm.updateOne(c, 0.05);
      out.stillFar = c.pos.x === cx + 0.5 && c.hops === 0 && !c.hop;
    }
    // 2. hops with dt 0.05
    const r1 = run(0.05, 'dt 0.05');
    out.r1 = { landed: r1.landed, hops: r1.c.hops, tired: r1.c.tired, calls: r1.tiredCalls };
    // after the third hop it is tired: no moves for 8 s of game time while the player stays near
    {
      const c = r1.c, p = r1.p, at = c.pos.clone();
      let moved = false, i = 0;
      for (; i < 150; i++) { cm.updateOne(c, 0.05); if (!c.pos.equals(at)) moved = true; }
      out.tiredStill = !moved && c.tired > 0;
      out.scalePant = c.model.scale.y < 1;
      for (; i < 161; i++) cm.updateOne(c, 0.05);
      out.tiredOver = c.tired === 0 && c.hops === 0;
      // and it hops again
      for (let k = 0; k < 40; k++) cm.updateOne(c, 0.05);
      out.hopsAgain = !c.pos.equals(at) || !!c.hop;
      out.scaleBack = c.model.scale.x === 1 && c.model.scale.y === 1;
    }
    // 3. the same with 0.5 s steps
    const r2 = run(0.5, 'dt 0.5');
    out.r2 = { landed: r2.landed, hops: r2.c.hops, tired: r2.c.tired };
    // 4. several directions: the player comes from each side
    out.dirs = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const c = mk('zippet', cx, cz);
      const p = c.pos.clone();
      p.set(c.pos.x + Math.cos(a) * 3, c.pos.y, c.pos.z + Math.sin(a) * 3);
      cm.viewer = p;
      const from = c.pos.clone();
      let n = 0;
      while (!c.hop && n++ < 3) cm.updateOne(c, 0.05);
      let guard = 0;
      while (c.hop && guard++ < 100) cm.updateOne(c, 0.05);
      check(`dir ${k}`, from, c.pos, p);
    }
    // 5. cornered: a 1 x 1 hole, walls 2 high
    {
      rebuild();
      const hx = cx + 1, hz = cz + 1;
      for (let x = hx - 1; x <= hx + 1; x++) for (let z = hz - 1; z <= hz + 1; z++) if (x !== hx || z !== hz) for (let y = 1; y <= 2; y++) w.set(x, Y + y, z, B.STONE);
      const c = mk('teetail', hx, hz);
      cm.viewer = new c.pos.constructor(c.pos.x - 3, c.pos.y, c.pos.z);
      let calls = 0;
      cm.onTired = () => { calls++; };
      for (let i = 0; i < 4; i++) cm.updateOne(c, 0.05);
      out.cornered = { tired: c.tired, hops: c.hops, moved: c.pos.x !== hx + 0.5 || c.pos.z !== hz + 0.5, calls };
    }
    // 6. never off the edge: at the edge with the player pushing outwards
    {
      rebuild();
      const c = mk('teetail', cx + 7, cz);
      cm.viewer = new c.pos.constructor(c.pos.x - 2, c.pos.y, c.pos.z);
      let calls = 0;
      cm.onTired = () => { calls++; };
      let moved = false;
      for (let i = 0; i < 120; i++) { cm.updateOne(c, 0.05); if (c.pos.y < Y + 0.99) moved = true; }
      out.edge = { y: c.pos.y, x: c.pos.x, below: moved };
    }
    return out;
  });
  t.ok(!C.fenced, 'the test platform is outside every gym box');
  t.ok(C.stillFar, 'a Teetail 12 blocks away sits still');
  t.ok(!C.problems.length, `every hop is legal: lands on solid ground with room, 1 up and 2 down at most, never into water, never off the platform, 1-4 blocks, away from the player ${C.problems.slice(0, 6).join('; ')}`);
  t.ok(C.hops.length >= 14, `${C.hops.length} hops checked`);
  t.ok(C.r1.hops === 3 && C.r1.landed === 3 && C.r1.tired > 0 && C.r1.calls === 1, `after 3 hops it is tired and onTired fired once (${JSON.stringify(C.r1)})`);
  t.ok(C.tiredStill && C.scalePant, `tired for 8 s: it does not move and it pants (still ${C.tiredStill}, pant ${C.scalePant})`);
  t.ok(C.tiredOver && C.hopsAgain && C.scaleBack, `then it can run again (over ${C.tiredOver}, hops ${C.hopsAgain}, scale ${C.scaleBack})`);
  t.ok(C.r2.landed >= 2 && C.r2.tired > 0, `with 0.5 s steps the hops land on whole cells too (${JSON.stringify(C.r2)})`);
  t.ok(C.cornered.tired > 0 && !C.cornered.moved && C.cornered.calls === 1, `cornered in a hole it is tired at once (${JSON.stringify(C.cornered)})`);
  t.ok(!C.edge.below && C.edge.y === 41, `it never hops off the edge, 25 blocks above the ground (${JSON.stringify(C.edge)})`);

  // Treetop: a perch 5 above the natural ground: it jumps down to the ground when you come near. Needs flat natural ground, so make some.
  const T = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures, w = g.world;
    const { B } = await import('/src/blocks.js');
    const { sx, sz } = window.__keep;
    const cx = sx + 40, cz = sz + 30;
    let G = 0;
    for (let x = cx - 6; x <= cx + 6; x++) for (let z = cz - 6; z <= cz + 6; z++) G = Math.max(G, w.ground[x + z * w.W]);
    G += 1;
    for (let x = cx - 6; x <= cx + 6; x++) for (let z = cz - 6; z <= cz + 6; z++) {
      for (let y = 0; y <= G + 10; y++) w.set(x, y, z, y <= G ? B.STONE : B.AIR, false);
      w.ground[x + z * w.W] = G;
    }
    for (let k = 1; k <= 5; k++) w.set(cx, G + k, cz, B.STONE); // an edited pillar = a perch
    cm.clear();
    const c = cm.spawnAt('teetail', cx, G + 6, cz, { level: 5, when: 'high' });
    c.life = 1e9;
    const out = { perch: !!cm.isPerch(cx, cz), G };
    cm.viewer = new c.pos.constructor(cx + 0.5 + 3, G + 6, cz + 0.5);
    for (let i = 0; i < 40; i++) cm.updateOne(c, 0.05);
    out.y = c.pos.y; out.x = c.pos.x; out.z = c.pos.z; out.hop = !!c.hop;
    return out;
  });
  t.ok(T.perch && T.y === T.G + 1 && T.x < 100000 && !T.hop, `a Teetail on a 5-high perch jumps down to the ground (y ${T.y}, ground top ${T.G})`);

  // Bump: touching starts a battle once; standing in it does not start another.
  const Bump = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures, w = g.world;
    const { B } = await import('/src/blocks.js');
    const { sx, sz } = window.__keep;
    const Y = 40, cx = sx + 20, cz = sz - 24;
    for (let x = cx - 9; x <= cx + 9; x++) for (let z = cz - 9; z <= cz + 9; z++) {
      for (let y = Y; y <= Y + 6; y++) w.set(x, y, z, B.AIR);
      if (Math.abs(x - cx) <= 7 && Math.abs(z - cz) <= 7) w.set(x, Y, z, B.STONE);
    }
    cm.clear();
    const c = cm.spawnAt('zippet', cx, Y + 1, cz, { level: 5, when: 'high' });
    c.life = 1e9;
    c.tired = 1e6; // it just sits there, out of breath
    const P = c.pos.clone();
    const orig = cm.onBump;
    let bumps = 0;
    cm.onBump = () => { bumps++; };
    const upd = () => cm.update(0.1, P, g.spawnPoint, false, false);
    P.set(c.pos.x - 8, c.pos.y, c.pos.z); upd();
    const far = bumps;
    P.set(c.pos.x + 0.2, c.pos.y, c.pos.z); upd();
    const first = bumps;
    for (let i = 0; i < 20; i++) upd();
    const still = bumps;
    P.set(c.pos.x - 5, c.pos.y, c.pos.z); upd();
    P.set(c.pos.x + 0.2, c.pos.y, c.pos.z); upd();
    const again = bumps;
    // above or below it does not count
    P.set(c.pos.x - 5, c.pos.y, c.pos.z); upd();
    P.set(c.pos.x, c.pos.y + 3, c.pos.z); upd();
    const above = bumps;
    // frozen (in a battle) it does not
    c.frozen = true;
    P.set(c.pos.x - 5, c.pos.y, c.pos.z); upd();
    P.set(c.pos.x, c.pos.y, c.pos.z); upd();
    const frozen = bumps;
    cm.onBump = orig;
    cm.clear();
    for (let x = cx - 9; x <= cx + 9; x++) for (let z = cz - 9; z <= cz + 9; z++) for (let y = Y; y <= Y + 6; y++) w.set(x, y, z, B.AIR);
    return { far, first, still, again, above, frozen };
  });
  t.ok(Bump.far === 0 && Bump.first === 1, `walking into it starts a battle once (${JSON.stringify(Bump)})`);
  t.ok(Bump.still === 1, 'standing inside it starts no second battle');
  t.ok(Bump.again === 2, 'stepping away and back starts one again');
  t.ok(Bump.above === 2 && Bump.frozen === 2, 'jumping over it or touching it in a battle does nothing');

  /* ---------------------------------------------------------------- D. The Obstacle Course (T36.5: 60 pieces, 4 flags) */
  // D1 + D2: placement on three seeds, nothing outside the box changes, the layout rules (joins, skips, headroom, pushers) and the
  // course is solvable in one way only (all timed blocks in their solid state; springs are jumps).
  const D12 = await page.evaluate(async seeds => {
    const { World, WORLD_H } = await import('/src/world.js');
    const { GYMS } = await import('/src/gyms.js');
    const { B, isSolid } = await import('/src/blocks.js');
    const C = await import('/src/obstaclecourse.js');
    const out = {};
    for (const seed of seeds) {
      const r = {};
      const w = new World(seed, null, null); w.generate();
      const def = GYMS.find(x => x.id === 'parkour');
      const g = w.gyms.find(x => x.def === def);
      r.found = !!g; r.k = g?.slot?.k;
      const box = g.slot.box;
      const inBox = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
      r.protect = g.protect.every(b => b.x0 >= box.x0 && b.x1 <= box.x1 && b.z0 >= box.z0 && b.z1 <= box.z1);
      r.area = g.area.x0 >= box.x0 && g.area.x1 <= box.x1 && g.area.z0 >= box.z0 && g.area.z1 <= box.z1;
      // the world without the gym
      const i = GYMS.indexOf(def);
      GYMS.splice(i, 1);
      let w0;
      try { w0 = new World(seed, null, null); w0.generate(); } finally { GYMS.splice(i, 0, def); }
      let inside = 0, outside = 0;
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < w.D; z++) for (let x = 0; x < w.W; x++) {
        const k = x + w.W * (z + w.D * y);
        if (w.data[k] === w0.data[k]) continue;
        if (inBox(x, z)) inside++; else outside++;
      }
      r.inside = inside; r.outside = outside;
      // blocks
      const { fy, P, front, side, checkpoints, pieces, course, timed } = g;
      const col = (d, s) => [g.x + front[0] * d + side[0] * s, g.z + front[1] * d + side[1] * s];
      let matBad = 0, rimBad = 0;
      for (let d = -20; d <= 20; d++) for (let s = -20; s <= 20; s++) {
        const [x, z] = col(d, s), ring = Math.max(Math.abs(d), Math.abs(s));
        const stairs = d >= 20 && s >= -17 && s <= -15;
        if (w.get(x, fy, z) !== (stairs ? B.AIR : B.SOFT_MAT) && !stairs) matBad++;
        if (ring === 20 && !stairs && w.get(x, fy + 1, z) !== B.SOFT_MAT) rimBad++;
        if (ring < 20 && w.get(x, fy + 1, z) === B.SOFT_MAT) rimBad++;
      }
      r.mat = { bad: matBad, rimBad };
      r.cps = checkpoints.map(c => w.get(...c.cell));
      r.beamsOk = Object.values(pieces).filter(p => p.beam).every(p => {
        for (let x = p.x0; x <= p.x1; x++) for (let z = p.z0; z <= p.z1; z++) {
          const id = w.get(x, p.y, z);
          if (id !== B.BEAM) return false;
        }
        return true;
      });
      r.timedOk = {
        crumble: timed.crumbles.every(c => c.cells.every(k => w.get(...k) === B.CRUMBLE)),
        blink: timed.blinks.every(c => c.cells.every(k => w.get(...k) === B.BLINK)),
        zap: timed.zaps.every(c => c.cells.every(k => w.get(...k) === B.ZAP_OFF)),
        pusher: timed.pushers.every(p => p.body.every(k => w.get(...k) === B.PUSHER) && p.head.every(k => w.get(...k) === B.AIR)),
        spring: Object.entries(pieces).filter(([, p]) => p.kind === 'spring').every(([, p]) => { for (let x = p.x0; x <= p.x1; x++) for (let z = p.z0; z <= p.z1; z++) if (w.get(x, p.y, z) !== B.SPRING) return false; return true; }),
        noExitPad: !w.data.includes(B.EXIT_PAD),
      };
      r.counts = { crumble: timed.crumbles.length, blink: timed.blinks.length, zap: timed.zaps.length, pusher: timed.pushers.length, ghost: g.ghost.length };
      const cp0 = checkpoints[0].cell;
      const [fx, fz] = col(-12, 9);
      r.fenced = w.fenced(cp0[0], cp0[1] + 1, cp0[2]) && w.fenced(g.x, fy + 2, g.z) && w.fenced(fx, P + 5, fz);
      const [bx, bz] = col(-3, -11);
      const f0 = pieces.F, topY = f0.y;
      r.editBlocked = !w.editAllowed(pieces.P1.x0, pieces.P1.y, pieces.P1.z0, B.AIR) && !w.editAllowed(f0.x0, topY, f0.z0, B.AIR) && !w.editAllowed(col(0, 0)[0], fy, col(0, 0)[1], B.AIR) && !w.editAllowed(col(5, 5)[0], fy + 1, col(5, 5)[1], B.STONE) && !w.editAllowed(cp0[0], cp0[1], cp0[2], B.AIR);
      r.pieces = Object.keys(pieces).length;
      r.top = { max: Math.max(...Object.values(pieces).map(p => p.y)) - P, arch: P + 17 + 5 <= WORLD_H - 1 };

      // ---- the layout data (checked in Node-like terms from the exported tables)
      const P2 = C.PIECES.map(([id, d0, d1, s0, s1, h, kind, extra], i) => ({ id, d0, d1, s0, s1, h, kind: kind.startsWith('blink') ? 'blink' : kind, i, extra }));
      const flagIdx = C.FLAGS.map(f => f.piece);
      let sec = 0;
      for (const p of P2) { if (flagIdx.includes(p.id)) sec = flagIdx.indexOf(p.id); p.sec = sec; }
      const gapOf = (a, b) => ({ gd: Math.max(0, b.d0 - a.d1 - 1, a.d0 - b.d1 - 1), gs: Math.max(0, b.s0 - a.s1 - 1, a.s0 - b.s1 - 1) });
      const overlapD = (a, b) => a.d0 <= b.d1 && b.d0 <= a.d1, overlapS = (a, b) => a.s0 <= b.s1 && b.s0 <= a.s1;
      const joins = [];
      for (let k = 1; k < P2.length; k++) {
        const a = P2[k - 1], b = P2[k], { gd, gs } = gapOf(a, b);
        joins.push({ id: b.id, gap: Math.max(gd, gs), straight: (gs === 0 && overlapS(a, b)) || (gd === 0 && overlapD(a, b)), dy: b.h - a.h, spring: a.kind === 'spring' });
      }
      r.joins = joins;
      // the longest jump that really lands (largest gap of air, sprinting, at 60 or 20 fps: measured by the D3 sweep), as a reach
      // for 'hypot(gap) < reach + 0.3'; the plan's table (3.12 for a flat sprint) was about one block short.
      const G_NORMAL = { 1: 3, 0: 4, '-1': 5, '-2': 5, '-3': 6, '-4': 6, '-5': 6, '-6': 7, '-7': 7, '-8': 7 };
      const G_SPRING = { 4: 4, 3: 5, 2: 6, 1: 7, 0: 7, '-1': 7, '-2': 7, '-3': 8, '-4': 8, '-5': 8, '-6': 9, '-7': 9, '-8': 10 };
      const reach = (dy, spring) => (spring ? (dy > 4 ? -1 : G_SPRING[Math.max(dy, -8)] + 0.7) : (dy > 1 ? -1 : G_NORMAL[Math.max(dy, -8)] + 0.7));
      const skips = [], allowed = [];
      for (const a of P2) for (const b of P2) {
        if (b.i <= a.i + 1) continue;
        const { gd, gs } = gapOf(a, b), rr = reach(b.h - a.h, a.kind === 'spring');
        if (rr < 0 || Math.hypot(gd, gs) >= rr + 0.3) continue;
        const skipsAFlag = b.sec > a.sec && !(b.sec === a.sec + 1 && flagIdx.includes(b.id));
        (skipsAFlag ? skips : allowed).push(`${a.id}->${b.id}`);
      }
      r.skips = skips; r.allowed = allowed.length;
      // headroom: 4 air cells over every top cell (6 over springs), not counting the finish arch's own posts
      const headBad = [];
      for (const [id, p] of Object.entries(pieces)) {
        const need = p.kind === 'spring' ? 6 : 4;
        for (let x = p.x0; x <= p.x1; x++) for (let z = p.z0; z <= p.z1; z++) for (let k = 1; k <= need; k++) {
          if (id === 'F') continue;
          if (w.get(x, p.y + k, z) !== B.AIR) { headBad.push(`${id}@${x},${z}+${k}`); break; }
        }
      }
      r.headBad = headBad.slice(0, 6);
      // pushers: not on a beam's first or last cell; the 4 columns on the push side hold no top of a piece of the same or a later section up to beam height + 2
      const pushBad = [];
      for (const pu of timed.pushers) {
        const bid = pu.id.split('#')[0], bp = pieces[bid];
        const [zx, zy, zz] = pu.zone;
        const ends = [[bp.x0, bp.z0], [bp.x1, bp.z1]];
        if (ends.some(([x, z]) => x === zx && z === zz)) pushBad.push(`${pu.id} on an end`);
        const dx = pu.axis === 'x' ? pu.sign : 0, dz = pu.axis === 'z' ? pu.sign : 0;
        for (let n = 1; n <= 4; n++) for (let y = fy + 1; y <= zy + 1; y++) {
          const key = `${zx + dx * n},${y},${zz + dz * n}`;
          const e = g.secAt.get(key);
          if (e && e.sec >= (pieces[bid].sec)) pushBad.push(`${pu.id} -> ${key} (sec ${e.sec})`);
        }
        // the head cells are never in the beam column
        if (pu.head.some(([x, , z]) => x === zx && z === zz)) pushBad.push(`${pu.id} head in the beam`);
      }
      r.pushBad = pushBad.slice(0, 6);

      // ---- the BFS over standing cells
      const hidden = new Set();
      const key = (x, y, z) => x + w.W * (z + w.D * y);
      const get = (x, y, z) => (hidden.has(key(x, y, z)) ? B.AIR : w.get(x, y, z));
      const air = (x, y, z) => get(x, y, z) === B.AIR;
      const solid = (x, y, z) => isSolid(get(x, y, z));
      const stand = (x, y, z) => inBox(x, z) && y >= 1 && air(x, y, z) && air(x, y + 1, z) && solid(x, y - 1, z) && get(x, y - 1, z) !== B.SOFT_MAT;
      const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], D4 = D8.slice(0, 4);
      const moves = (x, y, z) => {
        const res = [];
        for (const [dx, dz] of D8) {
          const nx = x + dx, nz = z + dz;
          if (stand(nx, y, nz)) res.push([nx, y, nz, 'walk']);
          if (air(nx, y, nz) && air(nx, y + 1, nz)) for (let k = 1; k <= 3; k++) {
            if (k > 1 && !air(nx, y - k + 1, nz)) break;
            if (stand(nx, y - k, nz)) { res.push([nx, y - k, nz, 'down']); break; }
          }
          if (stand(nx, y + 1, nz) && air(x, y + 2, z)) res.push([nx, y + 1, nz, 'up']);
        }
        for (const [dx, dz] of D4) for (let gap = 1; gap <= 2; gap++) {
          for (const dy of [0, 1, -1, -2, -3]) {
            if (dy === 1 && gap > 1) continue;
            const lx = x + dx * (gap + 1), lz = z + dz * (gap + 1), y1 = y + dy;
            if (!stand(lx, y1, lz)) continue;
            let free = true;
            for (let j = 1; j <= gap && free; j++) for (let yy = Math.min(y, y1); yy <= Math.max(y, y1) + 1; yy++) if (!air(x + dx * j, yy, z + dz * j)) { free = false; break; }
            if (free) res.push([lx, y1, lz, `jump${gap}${dy === 0 ? 'flat' : dy > 0 ? 'up' : 'down'}`]);
          }
        }
        if (get(x, y - 1, z) === B.SPRING) { // a spring: fly 3.9 up, over 0-2 columns of air, onto something 0 to 3 up (or down)
          for (const [dx, dz] of D4) for (let gap = 0; gap <= 2; gap++) for (const dy of [3, 2, 1, 0, -1, -2, -3]) {
            const lx = x + dx * (gap + 1), lz = z + dz * (gap + 1), y1 = y + dy;
            if (!stand(lx, y1, lz)) continue;
            let free = true;
            for (let yy = y; yy <= y + 5 && free; yy++) { if (!air(x, yy, z)) free = false; for (let j = 1; j <= gap && free; j++) if (!air(x + dx * j, yy, z + dz * j)) free = false; }
            if (free) res.push([lx, y1, lz, `spring${gap}${dy}`]);
          }
        }
        return res;
      };
      const bfs = start => {
        const seen = new Map([[key(...start), null]]), q = [start];
        for (let i2 = 0; i2 < q.length; i2++) {
          const c = q[i2];
          for (const m of moves(c[0], c[1], c[2])) {
            const k = key(m[0], m[1], m[2]);
            if (seen.has(k)) continue;
            seen.set(k, { from: c, kind: m[3] });
            q.push([m[0], m[1], m[2]]);
          }
        }
        return { seen, has: c => seen.has(key(...c)) };
      };
      const stands = checkpoints.map(c => [c.cell[0], c.cell[1] + 1, c.cell[2]]);
      const leader = g.leaderPos.map(Math.floor);
      const entry = [g.entry[0], fy + 1, g.entry[2]];
      r.entryStands = stand(...entry);
      const all = bfs(entry);
      r.reach = [...stands, leader].map(c => all.has(c));
      const pieceIdAt = (x, y, z) => Object.entries(pieces).find(([, p]) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && y === p.y + 1)?.[0];
      const reachedPieces = b2 => new Set([...b2.seen.keys()].map(k => { const y = Math.floor(k / (w.W * w.D)), rest = k % (w.W * w.D); return pieceIdAt(rest % w.W, y, Math.floor(rest / w.W)); }).filter(Boolean));
      r.reachedAll = reachedPieces(all).size;
      // no flag can be skipped: with a landing out of the way nothing beyond it can be reached
      r.noLanding = {};
      for (let k = 1; k < C.FLAGS.length; k++) { // every flag landing after the start (L2, L5, F)
        const p = pieces[C.FLAGS[k].piece];
        for (let x = p.x0; x <= p.x1; x++) for (let z = p.z0; z <= p.z1; z++) for (let y = p.y - 1; y <= p.y + 1; y++) hidden.add(key(x, y, z));
        const b2 = bfs(entry);
        r.noLanding[k] = stands.filter((_, j) => j > k).concat([leader]).map(c => b2.has(c)).some(Boolean);
        hidden.clear();
      }
      // standing on a pusher body leads nowhere new
      const withBodies = reachedPieces(all);
      for (const pu of timed.pushers) for (const c of pu.body) hidden.add(key(...c));
      const noBodies = bfs(entry);
      r.bodyHarmless = reachedPieces(noBodies).size === withBodies.size && [...withBodies].every(id => reachedPieces(noBodies).has(id));
      hidden.clear();
      // from the ground only S0 is one move away (via the stairs; the rim is mat)
      const direct = new Set();
      let outsideStands = 0;
      for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) for (let y = Math.max(1, fy - 1); y <= fy + 3; y++) {
        if (!stand(x, y, z) || pieceIdAt(x, y, z)) continue;
        outsideStands++;
        for (const m of moves(x, y, z)) { const id = pieceIdAt(m[0], m[1], m[2]); if (id) direct.add(id); }
      }
      r.direct = [...direct].sort();
      r.outsideStands = outsideStands;
      out[seed] = r;
    }
    return out;
  }, [1, 4242, 777]);
  for (const seed of [1, 4242, 777]) {
    const r = D12[seed];
    t.ok(r.found && r.k === 7 && r.protect && r.area, `seed ${seed}: the Obstacle Course is in slot 7 with its protect box and area inside the slot box`);
    t.ok(r.inside > 1500 && r.outside === 0, `seed ${seed}: it changes ${r.inside} cells inside its slot box and ${r.outside} outside`);
    t.ok(r.mat.bad === 0 && r.mat.rimBad === 0 && r.cps.length === 4 && r.cps.every(c => c === 92) && r.beamsOk && r.pieces === 60, `seed ${seed}: soft mat and rim (${r.mat.bad} / ${r.mat.rimBad} bad), 4 flags (${r.cps}), beams are BEAM, ${r.pieces} pieces`);
    t.ok(Object.values(r.timedOk).every(Boolean) && r.counts.crumble === 11 && r.counts.blink === 11 && r.counts.zap === 6 && r.counts.pusher === 10, `seed ${seed}: every crumble / blink / zap / spring / pusher / exit pad cell is its block at rest (${JSON.stringify(r.timedOk)}, ${JSON.stringify(r.counts)})`);
    t.ok(r.top.max === 17 && r.top.arch, `seed ${seed}: the highest piece is P + ${r.top.max} and the arch fits under the world top`);
    t.ok(r.fenced && r.editBlocked, `seed ${seed}: the whole site is fenced and cannot be edited (${r.fenced}, ${r.editBlocked})`);
    t.ok(r.entryStands && r.reach.every(Boolean), `seed ${seed}: from the stair foot you can reach every flag and the leader (${r.reach})`);
    t.ok(Object.values(r.noLanding).every(v => !v), `seed ${seed}: without one of the 3 landing flags' pieces (L2, L5, F) nothing beyond it can be reached (${JSON.stringify(r.noLanding)})`);
    t.ok(r.direct.join() === 'S0', `seed ${seed}: from the ground only S0 is one move away (${r.direct}; ${r.outsideStands} outside cells)`);
    t.ok(r.bodyHarmless, `seed ${seed}: standing on a pusher body leads nowhere new`);
    const two = r.joins.filter(j => j.gap === 2), springs = r.joins.filter(j => j.spring);
    t.ok(two.length === 2 && two.every(j => j.dy === 0) && r.joins.every(j => j.straight && j.gap <= 2 && j.dy >= 0 && (j.spring ? j.dy <= 3 && j.gap <= 1 : j.dy <= 1 && (j.gap <= 1 || j.gap === 2 && j.dy === 0))) && springs.length === 2 && springs.every(j => j.dy === 3),
      `seed ${seed}: every join is straight with a gap of 0-1 blocks, exactly 2 flat two-block gaps, up 1 at most (3 from a spring)`);
    t.ok(r.skips.length === 0 && r.allowed >= 8, `seed ${seed}: no jump skips a flag (${JSON.stringify(r.skips)}; ${r.allowed} allowed shortcuts inside a section)`);
    t.ok(r.headBad.length === 0, `seed ${seed}: 4 blocks of headroom over every top (6 over springs) ${JSON.stringify(r.headBad)}`);
    t.ok(r.pushBad.length === 0, `seed ${seed}: every pusher is clear of the beam ends and shoves into free air ${JSON.stringify(r.pushBad)}`);
  }

  // D3: real physics on a high platform: what a child can really jump, at 60 and 20 frames per second.
  const D3 = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, p = g.player;
    const { B } = await import('/src/blocks.js');
    const { sx, sz } = window.__keep;
    const cx = sx + 20, cz = sz - 24, Y = 40;
    const out = {};
    // gap = blocks of air; dy = height of the landing above the takeoff; len = how long the landing is; spring = the takeoff is a SPRING
    const trial = (gap, dy, sprint, dt, { spring = false, len = 4 } = {}) => {
      for (let x = cx - 4; x <= cx + 4; x++) for (let z = cz - 12; z <= cz + 12; z++) for (let y = Y - 2; y <= Y + 10; y++) w.set(x, y, z, B.AIR, false);
      for (let x = cx - 2; x <= cx + 2; x++) {
        for (let z = cz; z <= cz + 4; z++) w.set(x, Y, z, spring ? B.SPRING : B.STONE, false);
        for (let z = cz - gap - len; z <= cz - gap - 1; z++) w.set(x, Y + dy, z, B.STONE, false);
      }
      p.pos.set(cx + 0.5, Y + 1, cz + 3.5); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; p.onGround = true; p.ride = null;
      p.keys = { KeyW: true, ShiftLeft: sprint };
      let jumped = false, air = false;
      for (let i = 0; i < 400; i++) {
        if (!jumped && p.pos.z - cz <= 0.2) { p.keys.Space = true; jumped = true; }
        p.update(dt);
        if (jumped && !p.onGround) air = true;
        if (jumped) p.keys.Space = false;
        if (air && p.onGround) break;
        if (p.pos.y < Y - 6) break;
      }
      p.bounced = false;
      p.keys = {};
      const target = Y + dy + 1;
      return { ok: Math.abs(p.pos.y - target) < 0.01 && p.pos.z < cz - gap + 0.3 && p.pos.z > cz - gap - len, y: +p.pos.y.toFixed(2), z: +(p.pos.z - cz).toFixed(2) };
    };
    for (const [name, dt] of [['60', 1 / 60], ['20', 1 / 20]]) {
      out[name] = {
        gap1walk: trial(1, 0, false, dt), gap2sprint: trial(2, 0, true, dt), up1gap1walk: trial(1, 1, false, dt), down1gap1walk: trial(1, -1, false, dt),
        gap4sprint: trial(4, 0, true, dt), gap5sprint: trial(5, 0, true, dt), gap7sprint: trial(7, 0, true, dt), up2gap1sprint: trial(1, 2, true, dt), up1gap5sprint: trial(5, 1, true, dt),
        // T36.5: springs, and why every landing is two long
        spring3gap1: trial(1, 3, false, dt, { spring: true }), spring3gap2: trial(2, 3, false, dt, { spring: true }),
        spring5gap1: trial(1, 5, true, dt, { spring: true }), springFlat9: trial(9, 0, true, dt, { spring: true }),
        walk2long: trial(1, 0, false, dt, { len: 2 }), walk1long: trial(1, 0, false, dt, { len: 1 }),
      };
    }
    for (let x = cx - 4; x <= cx + 4; x++) for (let z = cz - 12; z <= cz + 12; z++) for (let y = Y - 2; y <= Y + 10; y++) w.set(x, y, z, B.AIR, false);
    return out;
  });
  console.log('  jump trials:', JSON.stringify(D3));
  for (const fps of ['60', '20']) {
    const d = D3[fps];
    t.ok(d.gap1walk.ok && d.gap2sprint.ok && d.up1gap1walk.ok && d.down1gap1walk.ok, `at ${fps} fps: walking over one gap, sprinting over two, one up with one gap, one down with one gap all land`);
    t.ok(!d.gap5sprint.ok && !d.gap7sprint.ok && !d.up2gap1sprint.ok && !d.up1gap5sprint.ok, `at ${fps} fps: five blocks of air, two blocks up and the 5-block lane gaps cannot be jumped, so no lane can be skipped (${JSON.stringify([d.gap5sprint, d.up2gap1sprint, d.up1gap5sprint])})`);
    t.ok(d.spring3gap1.ok && d.spring3gap2.ok && !d.spring5gap1.ok && !d.springFlat9.ok, `at ${fps} fps: a spring throws you 3 up over one or two gaps, but not 5 up and not 9 along (${JSON.stringify([d.spring3gap1, d.spring3gap2, d.spring5gap1, d.springFlat9])})`);
    t.ok(d.walk2long.ok && !d.walk1long.ok, `at ${fps} fps: a walking jump over one gap lands on a 2-long piece but overshoots a 1-long one (${JSON.stringify([d.walk2long, d.walk1long])})`);
  }

  // D4: in the game.
  const D4 = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, p = g.player;
    const { B } = await import('/src/blocks.js');
    const { trainerKey } = await import('/src/gyms.js');
    const gym = w.gyms.find(x => x.def.id === 'parkour');
    const L = g.gymLive.of('parkour');
    const out = { has: !!L, def: gym.def };
    g.beaten = g.beaten.filter(k => !k.startsWith('parkour:'));
    g.badges = g.badges.filter(b => b !== 'parkour');
    window.__sounds = {};
    const play = g.sound.play.bind(g.sound);
    g.sound.play = (n, ...r) => { window.__sounds[n] = (window.__sounds[n] || 0) + 1; return play(n, ...r); };
    window.__toasts.length = 0;
    g.toldOnce.clear();
    const sound = n => window.__sounds[n] || 0;
    const cps = gym.checkpoints;
    // a mat cell with nothing above it (the stand call and the fall test need a clear drop)
    const mat = (() => {
      for (let x = gym.course.x0 + 1; x < gym.course.x1; x++) for (let z = gym.course.z0 + 1; z < gym.course.z1; z++) {
        let clear = true;
        for (let y = gym.fy + 1; y <= gym.fy + 12 && clear; y++) if (w.get(x, y, z) !== 0) clear = false;
        if (clear && w.get(x, gym.fy, z) === B.SOFT_MAT) return [x, gym.fy, z];
      }
      return null;
    })();
    const at = k => ({ x: cps[k].stand[0], y: cps[k].stand[1], z: cps[k].stand[2] });
    const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.01;
    const last = () => window.__toasts.at(-1);
    const beat = i => g.beaten.push(trainerKey(gym.def, i));
    out.four = cps.length === 4 && gym.def.trainers.length === 2 && cps[1].trainer === 0 && cps[2].trainer === 1 && cps.map(c => c.hint).every(h => h && h.length < 130);
    // flags are lit with setLive and never edits
    L.update(0);
    out.flag0 = w.get(...cps[0].cell); out.flag1 = w.get(...cps[1].cell);
    out.noEdits = !w.edits.has(w.index(...cps[0].cell)) && !w.edits.has(w.index(...cps[1].cell));
    // the hint of the start flag shows once per session
    L.stand(...cps[0].cell, B.CHECKPOINT_ON);
    out.hint0 = last();
    L.last = -1; window.__toasts.length = 0;
    L.stand(...cps[0].cell, B.CHECKPOINT_ON);
    out.hint0Again = window.__toasts.length;
    L.last = -1;
    // falling before any flag: the start
    p.pos.set(5, 5, 5);
    L.stand(...mat, B.SOFT_MAT);
    out.toStart = near(p.pos, at(0)) && sound('boing') === 1 && last() === 'Boing! Back to the start.' && L.falls === 1;
    // CP1 = Runner Remy's landing (L2)
    L.stand(...cps[1].cell, B.CHECKPOINT);
    out.cp1Toast = last();
    out.cp1Sound = sound('checkpoint');
    out.flag1On = w.get(...cps[1].cell) === B.CHECKPOINT_ON && w.get(...cps[2].cell) === B.CHECKPOINT;
    L.stand(...mat, B.SOFT_MAT);
    out.toCp1 = near(p.pos, at(1)) && last() === 'Boing! Back to your last flag.' && L.falls === 2;
    // CP2 = Gymnast Gigi's landing, reached with Remy NOT battled: a fall still goes back to CP2 (no trainer clamp)
    L.stand(...cps[2].cell, B.CHECKPOINT);
    out.cp2Toast = last();
    L.stand(...mat, B.SOFT_MAT);
    out.noClamp = near(p.pos, at(2)) && !g.beaten.some(k => k.startsWith('parkour:'));
    beat(0); beat(1);
    L.stand(...mat, B.SOFT_MAT);
    out.beatenSame = near(p.pos, at(2));
    // CP3 = the finish
    L.stand(...cps[3].cell, B.CHECKPOINT);
    L.stand(...mat, B.SOFT_MAT);
    out.finishBack = near(p.pos, at(3));
    // a real fall from above the mat
    const [mx, , mz] = mat;
    p.pos.set(mx + 0.5, gym.fy + 6, mz + 0.5); p.vel.set(0, 0, 0); p.keys = {};
    let n = 0;
    while (!p.onGround && n++ < 200) p.update(0.05);
    const under = w.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z));
    out.realFall = { under, onGround: p.onGround };
    L.stand(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z), under);
    out.realFallBack = near(p.pos, at(3));
    // the earlier-section catch: a drop from L6's height (section 2) onto Z1's safe wool (section 1) is a fall
    const drop = (fromPiece, toCell, k, expectBack) => {
      L.reached = k; L.last = -1; window.__toasts.length = 0;
      p.pos.set(toCell[0] + 0.5, toCell[1] + 6, toCell[2] + 0.5); p.vel.set(0, 0, 0); p.keys = {}; p.onGround = false;
      L.wasAir = true; L.lastTop = gym.pieces[fromPiece].y;
      let steps = 0;
      while (steps++ < 100) { p.update(0.05); L.update(0.05); if (p.onGround) break; }
      return { back: near(p.pos, at(expectBack)), onGround: p.onGround, toast: last() };
    };
    const [z6x, z6z] = [gym.pieces.Z1.x0, gym.pieces.Z1.z0];
    // Z1's plain island: local (d -16, s 6) (between the two strips)
    const dirW = (dd, ds) => [gym.front[0] * dd + gym.side[0] * ds, gym.front[1] * dd + gym.side[1] * ds];
    const col = (d, s) => { const [a, b] = dirW(d, s); return [gym.x + a, gym.z + b]; };
    const [ix, iz] = col(-16, 6);
    out.catchFall = drop('L6', [ix, gym.pieces.Z1.y, iz], 2, 2);
    out.secs = [gym.pieces.C7.sec, gym.pieces.L2.sec, gym.pieces.Z1.sec, gym.pieces.L5.sec, gym.pieces.L6.sec, gym.pieces.F.sec].join();
    // the same drop with reached = 1 (Z1 is the current section, sec 1): nothing happens
    out.catchSame = drop('L6', [ix, gym.pieces.Z1.y, iz], 1, 1);
    out.catchSameStays = Math.abs(p.pos.x - (ix + 0.5)) < 0.01 && p.onGround;
    // a drop onto a lower piece of the current section: H1 (h 10) onto SP1 (h 7) with reached = 1 (both section 1)
    const [sx, sz] = col(11, -3);
    out.catchLower = drop('H1', [sx, gym.pieces.SP1.y, sz], 1, 1);
    out.catchLowerStays = Math.abs(p.pos.x - (sx + 0.5)) < 0.01 && p.onGround;
    // walking back from L1 (section 0, a plain platform now) onto C7 (section 0, same height) is not a fall
    L.reached = 1; L.wasAir = false; L.lastTop = gym.pieces.L1.y;
    const [cx7, cz7] = col(15, 13);
    p.pos.set(cx7 + 0.5, gym.pieces.C7.y + 1, cz7 + 0.5); p.vel.set(0, 0, 0); p.onGround = true;
    L.update(0.05);
    out.walkBack = Math.abs(p.pos.x - (cx7 + 0.5)) < 0.01;
    // stepping on the start platform with a flag further up takes you to it
    L.reached = 3; L.last = -1; window.__toasts.length = 0;
    const [s0x, s0z] = col(14, -16);
    p.pos.set(s0x + 0.5, gym.pieces.S0.y + 1, s0z + 0.5); p.vel.set(0, 0, 0); p.onGround = true;
    L.update(0.05);
    out.startBack = near(p.pos, at(3)) && last() === 'Your flag is waiting! Whoosh!';
    // with no flag reached the start is just the start
    L.reached = 0;
    p.pos.set(s0x + 0.5, gym.pieces.S0.y + 1, s0z + 0.5); p.onGround = true;
    L.update(0.05);
    out.startStays = Math.abs(p.pos.x - (s0x + 0.5)) < 0.01;
    // no exit pad: with the badge, a fall from the finish lets you go (flags reset, no bounce back); without it you go back up
    L.reached = 3; L.last = -1; window.__toasts.length = 0;
    g.badges.push('parkour');
    p.pos.set(mat[0] + 0.5, gym.fy + 1, mat[2] + 0.5); p.vel.set(0, 0, 0); p.onGround = true;
    L.stand(...mat, B.SOFT_MAT);
    out.exit = { stays: Math.abs(p.pos.x - (mat[0] + 0.5)) < 0.01, reached: L.reached, toast: last() };
    g.badges = g.badges.filter(b => b !== 'parkour');
    L.reached = 3; L.last = -1;
    p.pos.set(mat[0] + 0.5, gym.fy + 1, mat[2] + 0.5); p.onGround = true;
    L.stand(...mat, B.SOFT_MAT);
    out.exit.noBadgeBack = near(p.pos, at(3));
    out.exit.noPad = !w.data.includes(B.EXIT_PAD);
    const a = gym.area;
    // standing on the mat (a fall) is not leaving
    L.reached = 2; L.last = -1; window.__toasts.length = 0;
    p.pos.set(mat[0] + 0.5, gym.fy + 1, mat[2] + 0.5); p.onGround = true;
    L.update(0.05); L.stand(...mat, B.SOFT_MAT); L.update(0.05);
    out.matKeeps = L.reached === 2 && !window.__toasts.some(x => x.startsWith('You left'));
    // a battle does not reset, even far outside the area
    p.pos.set(a.x1 + 6, gym.fy + 1, a.z1 + 6); g.inBattle = true;
    L.update(0.05);
    out.battleKeeps = L.reached === 2 && !window.__toasts.some(x => x.startsWith('You left'));
    g.inBattle = false;
    // walking out of the area: the flags start over, one toast, flags redrawn
    window.__toasts.length = 0;
    L.update(0.05);
    out.leave = { reached: L.reached, last: L.last, toast: last(), count: window.__toasts.length, lit: w.get(...cps[0].cell) === B.CHECKPOINT_ON && w.get(...cps[2].cell) === B.CHECKPOINT && w.get(...cps[1].cell) === B.CHECKPOINT };
    L.update(0.05);
    out.leave.once = window.__toasts.length === 1;
    // nothing reached: being outside does nothing
    L.reached = 0; window.__toasts.length = 0; L.update(0.05);
    out.leave.quiet = window.__toasts.length === 0 && L.reached === 0;
    p.pos.set(s0x + 0.5, gym.pieces.S0.y + 1, s0z + 0.5); p.onGround = true;
    L.reached = 2; L.last = -1;
    // prompts
    out.prompt = [L.prompt({ id: B.CHECKPOINT_ON }), L.prompt({ id: B.STONE })].join('|');
    // the mat outside the course box does nothing
    p.pos.set(1, 1, 1);
    L.stand(gym.course.x1 + 5, gym.fy, gym.course.z1 + 5, B.SOFT_MAT);
    out.outside = p.pos.x === 1;
    // protection: nothing in the site can be edited, riders cannot enter
    const beam = gym.pieces.A4;
    window.__toasts.length = 0;
    out.editBeam = w.editAllowed(beam.x0, beam.y, beam.z0, B.AIR);
    out.editMat = w.editAllowed(mat[0], mat[1], mat[2], B.AIR);
    out.fenced = w.fenced(Math.floor(cps[0].stand[0]), Math.floor(cps[0].stand[1]), Math.floor(cps[0].stand[2])) && w.fenced(Math.floor(cps[2].stand[0]), Math.floor(cps[2].stand[1]), Math.floor(cps[2].stand[2]));
    L.reached = 0; L.last = -1;
    return out;
  });
  t.ok(D4.has && D4.four && D4.flag0 === 93 && D4.flag1 === 92 && D4.noEdits, `4 flags (start, Remy's landing, Gigi's landing, finish) with short hints; the start flag is drawn lit, the others not, and flags are never edits (${D4.flag0}, ${D4.flag1})`);
  t.ok(D4.hint0?.startsWith('Run (Shift') && D4.hint0Again === 0, 'the start flag says how to run, once per session');
  t.ok(D4.toStart, 'a fall before any flag goes back to the start (boing, toast, falls counted)');
  t.ok(D4.cp1Toast?.startsWith('Checkpoint! Red zap') && D4.cp1Toast.includes('Runner Remy wants to battle you!') && D4.cp1Sound === 1 && D4.flag1On, `Remy's flag teaches zaps and pushers, names Runner Remy and lights up (${D4.cp1Toast})`);
  t.ok(D4.toCp1, 'a fall from Remy\'s landing goes back to its flag');
  t.ok(D4.cp2Toast?.includes('Gymnast Gigi wants to battle you!'), `Gigi's flag names Gymnast Gigi (${D4.cp2Toast})`);
  t.ok(D4.noClamp && D4.beatenSame, 'after reaching Gigi\'s flag without battling Remy a fall still goes back to Gigi\'s flag (no trainer clamp), and the same once both are beaten');
  t.ok(D4.finishBack, 'a fall after the finish flag goes back to the finish flag');
  t.ok(D4.realFall.under === 91 && D4.realFall.onGround && D4.realFallBack, `a real fall lands on the soft mat and the frame's stand call sends you back (${JSON.stringify(D4.realFall)})`);
  t.ok(D4.catchFall.back && D4.catchFall.toast === 'Boing! Back to your last flag.', `(sections ${D4.secs}) a drop from L6 (section 2) onto an earlier section sends you to your flag on the landing frame (${JSON.stringify(D4.catchFall)})`);
  t.ok(!D4.catchSame.back && D4.catchSameStays && !D4.catchLower.back && D4.catchLowerStays && D4.walkBack, 'a drop inside the current section and walking back onto an earlier piece do nothing');
  t.ok(D4.startBack && D4.startStays, 'stepping on the start platform takes you to your furthest flag ("Your flag is waiting! Whoosh!"), or nowhere without one');
  t.ok(D4.exit.noPad && D4.exit.stays && D4.exit.reached === 0 && D4.exit.toast === 'Great run! Come back any time.' && D4.exit.noBadgeBack, `no Exit Pad; with the badge a fall from the finish lets you leave, without it you go back up to the finish (${JSON.stringify(D4.exit)})`);
  t.ok(D4.matKeeps && D4.battleKeeps, `standing on the mat and a battle do not reset the flags (${D4.matKeeps}, ${D4.battleKeeps})`);
  t.ok(D4.leave.reached === 0 && D4.leave.last === -1 && D4.leave.toast === 'You left the Obstacle Course. Next time you start from the beginning!' && D4.leave.count === 1 && D4.leave.once && D4.leave.lit && D4.leave.quiet, `walking out of the course area resets the flags, redraws them and toasts once (${JSON.stringify(D4.leave)})`);
  t.ok(D4.prompt === 'Checkpoint flag|', `prompts (${D4.prompt})`);
  t.ok(D4.outside, 'the mat outside the course box does nothing');
  t.ok(!D4.editBeam && !D4.editMat && D4.fenced, 'breaking a beam or the mat is refused, and the course is fenced for riders');

  // D5: the timed blocks in the game, driven like main.js does: p.update, then the live object's update, then stand() with the block
  // under the player. Every check sets the course clock itself and runs inside one evaluate (the game loop cannot interleave).
  await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, p = g.player;
    const { B } = await import('/src/blocks.js');
    const C = await import('/src/obstaclecourse.js');
    const gym = w.gyms.find(x => x.def.id === 'parkour');
    const L = g.gymLive.of('parkour');
    const H = window.__H = { g, w, p, gym, L, B, C };
    const step = dt => {
      p.update(dt); L.update(dt);
      if (p.onGround) { const fx = Math.floor(p.pos.x), fy = Math.floor(p.pos.y - 0.05), fz = Math.floor(p.pos.z); L.stand(fx, fy, fz, w.get(fx, fy, fz)); }
    };
    H.step = step;
    const dirW = (dd, ds) => [gym.front[0] * dd + gym.side[0] * ds, gym.front[1] * dd + gym.side[1] * ds];
    H.col = (d, s) => { const [dx, dz] = dirW(d, s); return [gym.x + dx, gym.z + dz]; }; // the world cell of a local (d, s)
    H.dirW = dirW;
    H.yawOf = (dd, ds) => { const [wx, wz] = dirW(dd, ds); return Math.atan2(-wx, -wz); };
    // put the player on top of a world cell (centre), feet on its top
    H.stand = (cell, dx = 0, dz = 0) => { p.pos.set(cell[0] + 0.5 + dx, cell[1] + 1, cell[2] + 0.5 + dz); p.vel.set(0, 0, 0); p.onGround = true; p.keys = {}; L.shove = null; L.wasAir = false; L.lastTop = null; };
    H.run = (dt, t, fn) => { for (let i = 0, n = Math.round(t / dt); i < n; i++) { step(dt); if (fn && fn(i) === true) return i; } return -1; };
    H.blockOf = { crumble: { whole: B.CRUMBLE, shake: B.CRUMBLE_SHAKE, gone: B.AIR }, blink: { on: B.BLINK, warn: B.BLINK_WARN, off: B.AIR }, zap: { off: B.ZAP_OFF, warn: B.ZAP_WARN, on: B.ZAP_ON } };
    H.pieceOf = (x, y, z) => Object.entries(gym.pieces).find(([, q]) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && y === q.y + 1)?.[0];
    g.beaten = g.beaten.filter(k => !k.startsWith('parkour:'));
    g.badges = g.badges.filter(b => b !== 'parkour');
    g.creatures.clear();
  });

  // closed form + rest when far + never an edit
  const D5a = await page.evaluate(() => {
    const { w, p, gym, L, B, C, blockOf } = window.__H;
    const out = { bad: [] };
    const edits0 = w.edits.size;
    const expected = (el, t) => (el.kind === 'blink' ? blockOf.blink[C.blinkState(t, el.offset)] : el.kind === 'zap' ? blockOf.zap[C.zapState(t, el.offset)] : null);
    // far from everything: the entry
    p.pos.set(gym.entry[0] + 0.5, gym.entry[1], gym.entry[2] + 0.5); p.vel.set(0, 0, 0);
    L.crumbleAt.clear(); L.update(0);
    const rest = { crumble: B.CRUMBLE, blink: B.BLINK, zap: B.ZAP_OFF };
    out.restOk = L.els.every(el => (el.kind === 'pusher' ? el.body.every(c => w.get(...c) === B.PUSHER) && el.head.every(c => w.get(...c) === B.AIR) : el.cells.every(c => w.get(...c) === rest[el.kind])));
    L.activeR = 999;
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let n = 0; n < 40; n++) {
      const t = rnd() * 60;
      L.clock = t - 3; L.update(0);
      for (let i = 0; i < 60; i++) L.update(0.05);
      const stepped = L.els.map(el => el.drawn).join();
      const blocksA = L.els.map(el => el.cells.map(c => w.get(...c)).join()).join('|');
      L.clock = t; L.update(0); // (the stepped clock is t - 3 + 60 * 0.05 = t, so nothing changes)
      const same = L.els.map(el => el.drawn).join() === stepped;
      for (const el of L.els) {
        if (el.kind === 'pusher') {
          const st = C.pushState(L.clock, el.offset);
          const okBody = el.body.every(c => w.get(...c) === (st === 'warn' ? B.PUSHER_WARN : B.PUSHER)), okHead = el.head.every(c => w.get(...c) === (st === 'out' ? B.PUSHER_HEAD : B.AIR));
          if (!okBody || !okHead) out.bad.push(`${el.id}@${t.toFixed(2)}`);
        } else if (el.kind !== 'crumble') {
          const want = expected(el, L.clock);
          if (!el.cells.every(c => w.get(...c) === want)) out.bad.push(`${el.id}@${t.toFixed(2)}`);
        }
      }
      // a fresh jump straight to t gives the same blocks as stepping there
      if (!same || blocksA !== L.els.map(el => el.cells.map(c => w.get(...c)).join()).join('|')) out.bad.push(`step vs jump @${t.toFixed(2)}`);
    }
    L.activeR = 14;
    L.clock = 0; L.update(0);
    out.edits = w.edits.size === edits0;
    out.restAgain = L.els.every(el => el.drawn === { crumble: 'whole', blink: 'on', zap: 'off', pusher: 'rest' }[el.kind]);
    return out;
  });
  t.ok(D5a.restOk && D5a.restAgain, 'far from the course every timed element shows its rest block');
  t.ok(D5a.bad.length === 0, `every blink, zap and pusher shows the closed-form state of the clock, for 40 random clocks (${D5a.bad.slice(0, 5)})`);
  t.ok(D5a.edits, 'timed blocks are never edits');

  // crumble blocks
  const D5b = await page.evaluate(() => {
    const { w, p, gym, L, B, C } = window.__H;
    const out = {};
    const c1 = gym.timed.crumbles.find(c => c.id === 'C1');
    L.activeR = 14; L.clock = 0; L.crumbleAt.clear();
    for (const dt of [1 / 20, 1 / 60]) {
      const key = dt === 1 / 20 ? '20' : '60';
      const r = out[key] = {};
      L.clock = 100; L.update(0); L.crumbleAt.clear();
      window.__H.stand(c1.cells[0]);
      window.__H.run(dt, 0.1);
      r.shake = c1.cells.every(c => w.get(...c) === B.CRUMBLE_SHAKE);
      window.__H.run(dt, 0.5);
      r.stillThere = w.get(...c1.cells[0]) === B.CRUMBLE_SHAKE;
      window.__H.run(dt, 0.45);
      r.gone = c1.cells.every(c => w.get(...c) === B.AIR);
      window.__H.run(dt, 0.4);
      r.fell = !p.onGround && p.pos.y < c1.cells[0][1] + 1 - 0.1;
      window.__H.run(dt, 1.95);
      r.stillGone = w.get(...c1.cells[0]) === B.AIR;
      L.shove = null;
      p.pos.set(gym.entry[0] + 0.5, gym.entry[1], gym.entry[2] + 0.5); // leave (the block waits while you are inside it)
      window.__H.run(dt, 1.2);
      r.back = c1.cells.every(c => w.get(...c) === B.CRUMBLE);
      // standing on the edge: the centre over air, one corner on the block
      const c0 = c1.cells[0];
      let edge = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!c1.cells.some(c => c[0] === c0[0] + dx && c[2] === c0[2] + dz)) { edge = [dx, dz]; break; }
      L.crumbleAt.clear(); L.clock += 10; L.update(0);
      window.__H.stand(c0, edge[0] * 0.7, edge[1] * 0.7);
      window.__H.run(dt, 0.2);
      r.edge = w.get(...c0) === B.CRUMBLE_SHAKE && p.onGround;
      window.__H.run(dt, 5);
      L.shove = null;
      p.pos.set(gym.entry[0] + 0.5, gym.entry[1], gym.entry[2] + 0.5);
      window.__H.run(dt, 1.5);
    }
    // walking across C3 and the bridge at walk speed reaches L1
    for (const dt of [1 / 20, 1 / 60]) {
      const key = 'walk' + (dt === 1 / 20 ? '20' : '60');
      L.crumbleAt.clear(); L.clock += 10; L.update(0);
      const c3 = gym.timed.crumbles.find(c => c.id === 'C3');
      const [c3x, c3z] = window.__H.col(15, 8);
      window.__H.stand([c3x, c3.cells[0][1], c3z]);
      // the first cell of C3 on the side of C2 -> walk along +s to L1
      p.yaw = window.__H.yawOf(0, 1); p.keys = { KeyW: true };
      let reached = false;
      const L1 = gym.pieces.L1;
      window.__H.run(dt, 3, () => { if (p.onGround && p.pos.x >= L1.x0 && p.pos.x <= L1.x1 + 1 && p.pos.z >= L1.z0 && p.pos.z <= L1.z1 + 1 && Math.abs(p.pos.y - (L1.y + 1)) < 0.01) { reached = true; return true; } return false; });
      out[key] = reached;
      p.keys = {};
      p.pos.set(gym.entry[0] + 0.5, gym.entry[1], gym.entry[2] + 0.5);
      window.__H.run(dt, 1.5);
    }
    return out;
  });
  console.log('  crumble:', JSON.stringify(D5b));
  for (const k of ['20', '60']) {
    const r = D5b[k];
    t.ok(r.shake && r.stillThere && r.gone && r.fell && r.stillGone && r.back, `at ${k} fps: a crumble block shakes at once, is gone after 0.9 s, you fall, and it is back after 3 s more (${JSON.stringify(r)})`);
    t.ok(r.edge, `at ${k} fps: standing on the edge of a crumble block (centre over air) also starts it`);
    t.ok(D5b['walk' + k], `at ${k} fps: walking over C3 and the 4-cell crumble bridge reaches the first landing`);
  }

  // blink blocks: "when yours flashes, jump to the next one"
  const D5c = await page.evaluate(() => {
    const { w, p, gym, L, B, C } = window.__H;
    const H = window.__H;
    const out = { fine: {}, late: {}, stay: {}, inside: null };
    const k1 = gym.timed.blinks.find(b => b.id === 'K1'), k2 = gym.timed.blinks.find(b => b.id === 'K2');
    const k1y = k1.cells[0][1];
    // K1's cell furthest from K2, and the direction to K2 (towards -d)
    const [bx, bz] = H.col(5, 16); // K1 d 5..6, s 14..16: the cell next to the gap, middle lane (a walking jump from the very back is borderline)
    const cell = [bx, k1y, bz];
    const [hx, hz] = H.dirW(0.5, 0); // half a block back: the middle of K1
    const yaw = H.yawOf(-1, 0);
    for (const dt of [1 / 20, 1 / 60]) {
      const key = dt === 1 / 20 ? '20' : '60';
      const res = out.fine[key] = { tried: 0, landed: 0, fails: [] };
      for (let c = 0; c < 2.8; c += 0.1) {
        // arrive on K1 at clock c while it is solid; wait for the flash (phase 2.0), then jump: W + Space, a reaction time of 0..0.6 s
        for (const mid of [0, 1]) for (const react of [0, 0.3, 0.6]) {
          L.activeR = 999; L.crumbleAt.clear();
          L.clock = c; L.update(0);
          H.stand(cell, mid ? hx : 0, mid ? hz : 0); p.yaw = yaw; p.keys = {};
          let jumped = false, t = 0, onK2 = false;
          const flashAt = Math.max(c, 2.0 + react > 2.7 ? 2.7 : 2.0 + react);
          for (let i = 0; i < Math.round(6 / dt); i++) {
            if (!jumped && L.clock >= flashAt - 1e-9) { p.keys = { KeyW: true, Space: true }; jumped = true; }
            else if (jumped) p.keys = { KeyW: true };
            H.step(dt);
            if (jumped && p.onGround && L.clock > flashAt + 0.2) {
              const at = H.pieceOf(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05) + 1 - 1, Math.floor(p.pos.z));
              const cx = Math.floor(p.pos.x), cz = Math.floor(p.pos.z);
              onK2 = k2.cells.some(q => q[0] === cx && q[2] === cz) && Math.abs(p.pos.y - (k2.cells[0][1] + 1)) < 0.01;
              break;
            }
            if (p.pos.y < k1y - 3) break;
          }
          res.tried++;
          if (onK2) res.landed++; else res.fails.push(`${c.toFixed(1)}/${mid}/${react}/${p.pos.x.toFixed(2)},${p.pos.y.toFixed(2)},${p.pos.z.toFixed(2)}/${L.clock.toFixed(2)}`);
        }
      }
      // staying put until 2.9: you fall
      L.clock = 1.0; L.update(0); H.stand(cell); p.keys = {};
      const f0 = L.falls;
      H.run(dt, 3.2);
      out.stay[key] = L.falls === f0 + 1;
    }
    // a blink block that turns on while you are inside it waits (K2 is off in [0.8, 2.0))
    L.activeR = 999; L.clock = 1.0; L.update(0);
    const ck = k2.cells[0];
    out.offNow = w.get(...ck) === B.AIR;
    p.pos.set(ck[0] + 0.5, ck[1] + 0.2, ck[2] + 0.5); p.vel.set(0, 0, 0); p.keys = {};
    L.clock = 2.05; L.update(0);
    out.waits = w.get(...ck) === B.AIR && L.cells.waiting.size > 0;
    p.pos.set(ck[0] + 5.5, ck[1] + 5, ck[2] + 0.5);
    L.update(0);
    out.comes = w.get(...ck) === B.BLINK;
    L.activeR = 14;
    p.pos.set(gym.entry[0] + 0.5, gym.entry[1], gym.entry[2] + 0.5); p.vel.set(0, 0, 0); L.shove = null;
    L.update(0);
    return out;
  });
  console.log('  blink:', JSON.stringify(D5c));
  for (const k of ['20', '60']) {
    t.ok(D5c.fine[k].landed === D5c.fine[k].tried, `at ${k} fps: jumping from K1 to K2 when K1 flashes (0-0.6 s late, from every start clock) always lands: ${D5c.fine[k].landed}/${D5c.fine[k].tried} ${D5c.fine[k].fails.slice(0, 6)}`);
    t.ok(D5c.stay[k], `at ${k} fps: staying on a blink block until it is gone drops you`);
  }
  t.ok(D5c.offNow && D5c.waits && D5c.comes, 'a blink block that comes back while you are inside it waits until you leave');

  // zap tiles
  const D5d = await page.evaluate(() => {
    const { w, p, gym, L, B, C } = window.__H;
    const H = window.__H;
    const out = { rates: {} };
    L.activeR = 999;
    const z1 = gym.timed.zaps.find(z => z.id === 'Z1#0'); // s 8..11
    // standing on a strip while it is on sends you back
    L.reached = 0; L.zaps = 0; L.falls = 0;
    L.clock = 2.3; L.update(0); // on (phase 2.1 - 3.0)
    window.__toasts.length = 0;
    H.stand(z1.cells[0]);
    H.step(0.05);
    out.sent = L.zaps === 1 && window.__toasts.at(-1) === 'Zap! Back to the start.' && Math.hypot(p.pos.x - gym.checkpoints[0].stand[0], p.pos.z - gym.checkpoints[0].stand[2]) < 0.01;
    // walking across the first strip of Z1 (towards -s, from L2) over many start clocks
    const rate = (zapId, startLocal, dirLocal, len, dt) => {
      const z = gym.timed.zaps.find(q => q.id === zapId);
      const y = z.cells[0][1];
      let ok = 0, n = 0;
      for (let c = 0; c < 3; c += 0.01) {
        L.zaps = 0; L.reached = 0; L.crumbleAt.clear();
        L.clock = c; L.update(0);
        const [sx, sz] = H.col(...startLocal);
        H.stand([sx, y, sz]);
        p.yaw = H.yawOf(...dirLocal); p.keys = { KeyW: true };
        const [wx, wz] = H.dirW(...dirLocal);
        const x0 = p.pos.x, z0 = p.pos.z;
        let done = false;
        for (let i = 0; i < Math.round(4 / dt) && !done; i++) {
          H.step(dt);
          if (L.zaps > 0) break;
          if ((p.pos.x - x0) * wx + (p.pos.z - z0) * wz >= len) done = true;
        }
        n++; if (done && L.zaps === 0) ok++;
      }
      p.keys = {};
      return ok / n;
    };
    // Z1 strip 0: s 8..11, start on the landing side (s 12), walk -s for 6 blocks (through the strip and onto the island)
    out.rates.Z1a = rate('Z1#0', [-16, 12], [0, -1], 5.5, 1 / 60);
    out.rates.Z1b = rate('Z1#1', [-16, 6], [0, -1], 5.5, 1 / 60);   // strip 2..5 from the island
    out.rates.Z3 = rate('Z3#0', [-10, 16], [-1, 0], 4.6, 1 / 60);    // d -14..-11, walking -d from the plain cell before it
    out.rates.V5 = rate('V5#0', [-16, -6], [0, -1], 4.5, 1 / 60);
    out.rates.W4 = rate('W4#0', [4, -18], [1, 0], 4.5, 1 / 60);
    // starting right when the strip goes dark always works (walking)
    L.activeR = 14;
    p.pos.set(gym.entry[0] + 0.5, gym.entry[1], gym.entry[2] + 0.5); p.vel.set(0, 0, 0); p.keys = {}; L.shove = null; L.update(0);
    return out;
  });
  console.log('  zap:', JSON.stringify(D5d.rates));
  t.ok(D5d.sent, 'standing on a lit zap tile sends you back with a Zap! toast');
  for (const [k, v] of Object.entries(D5d.rates)) t.ok(v >= 0.25 && v <= 0.6, `walking nonstop over zap strip ${k} works for ${Math.round(v * 100)}% of start times (25-60%: timing matters, there is a big window)`);

  // pushers and springs
  const D5e = await page.evaluate(() => {
    const { w, p, gym, L, B, C } = window.__H;
    const H = window.__H;
    const out = { rates: {}, rule: {}, shove: {} };
    L.activeR = 999;
    const beams = {
      P1: { start: [-6, -8], dir: [1, 0], len: 7 }, P2: { start: [4, -8], dir: [1, 0], len: 5 }, P3: { start: [7, 16], dir: [-1, 0], len: 6 },
      P4: { start: [-16, 0], dir: [0, -1], len: 6 }, P5: { start: [-3, -18], dir: [1, 0], len: 7 },
    };
    // does a walk starting at clock c get shoved? (progress along the beam must reach the middle of its last cell)
    const walk = (id, c, dt, run = false) => {
      const b = beams[id], y = gym.pieces[id].y;
      L.clock = c; L.update(0); L.shove = null; L.crumbleAt.clear();
      const [sx, sz] = H.col(...b.start);
      H.stand([sx, y, sz]);
      p.yaw = H.yawOf(...b.dir); p.keys = { KeyW: true, ShiftLeft: run };
      const [wx, wz] = H.dirW(...b.dir);
      const x0 = p.pos.x, z0 = p.pos.z;
      let shoved = false, done = false;
      for (let i = 0; i < Math.round(6 / dt) && !done; i++) {
        H.step(dt);
        if (L.shove) shoved = true;
        if ((p.pos.x - x0) * wx + (p.pos.z - z0) * wz >= b.len) done = true;
        if (p.pos.y < y - 0.5) break;
      }
      p.keys = {};
      return done && !shoved && p.pos.y > y;
    };
    for (const id of Object.keys(beams)) {
      let ok = 0, n = 0, okRun = 0;
      for (let c = 0; c < 3; c += 0.01) { n++; if (walk(id, c, 1 / 60)) ok++; if (walk(id, c, 1 / 60, true)) okRun++; }
      out.rates[id] = [ok / n, okRun / n];
      // the rule "start walking right after the first pusher you meet pulls back": pushers along the walk, nearest first
      const b = beams[id], [wx, wz] = H.dirW(...b.dir), [bx, bz] = H.col(...b.start);
      const mine = gym.timed.pushers.filter(q => q.id.startsWith(id + '#')).map(q => ({ q, dist: (q.zone[0] - bx) * wx + (q.zone[2] - bz) * wz })).sort((a, b2) => a.dist - b2.dist);
      const first = mine[0].q;
      let allOk = true;
      for (const dt of [1 / 60, 1 / 20]) for (let delay = 0; delay <= 0.3001; delay += 0.05) for (let k = 0; k < 3; k++) {
        const c = first.offset + 3 * (k + 1) + delay; // the cycle ends (it pulls back) at offset + 3k
        if (!walk(id, c, dt)) { allOk = false; out.rule[id + '@' + delay.toFixed(2) + '/' + (dt === 1 / 20 ? 20 : 60)] = false; }
      }
      out.rule[id] = allOk;
    }
    // a pusher that is out shoves you at least 2 blocks sideways (also while you walk back towards the beam), and its head shows only then
    const p1 = gym.timed.pushers.find(q => q.id === 'P1#0');
    const push = (walkBack, dt) => {
      L.clock = p1.offset + 2.4 - 0.1; L.update(0); L.shove = null; L.falls = 0;
      H.stand(p1.zone.map((v, i) => (i === 1 ? v - 1 : v)));
      const x0 = p.pos.x, z0 = p.pos.z;
      const sign = p1.axis === 'x' ? p1.sign : 0, signz = p1.axis === 'z' ? p1.sign : 0;
      if (walkBack) p.yaw = Math.atan2(sign, signz); // facing the pusher (against the shove)
      let headSeen = false;
      const headBefore = p1.head.every(c => w.get(...c) === B.AIR);
      let moved = 0;
      H.run(dt, 1.2, () => { if (walkBack && L.shove) p.keys = { KeyW: true }; if (p1.head.every(c => w.get(...c) === B.PUSHER_HEAD)) headSeen = true; if (!L.falls) moved = Math.max(moved, (p.pos.x - x0) * sign + (p.pos.z - z0) * signz); return L.falls > 0; });
      p.keys = {};
      return { moved: +moved.toFixed(2), fell: p.pos.y < p1.zone[1] - 0.5, headSeen, headBefore, headAfter: p1.head.every(c => w.get(...c) === B.AIR) };
    };
    out.shove.still60 = push(false, 1 / 60); out.shove.back60 = push(true, 1 / 60); out.shove.still20 = push(false, 1 / 20); out.shove.back20 = push(true, 1 / 20);
    // springs: jump on SP1 and land on H1, walking towards it
    out.spring = {};
    const spring = (dt, run) => {
      const sp = gym.pieces.SP1, h1 = gym.pieces.H1;
      L.clock = 0; L.update(0);
      const [sx, sz] = H.col(11, -3); // the spring cell next to the gap, middle lane
      H.stand([sx, sp.y, sz]);
      p.yaw = H.yawOf(0, 1); p.keys = { KeyW: true, Space: true, ShiftLeft: run };
      let bounced = false, landed = false;
      for (let i = 0; i < Math.round(4 / dt); i++) {
        H.step(dt);
        if (p.bounced) { bounced = true; p.bounced = false; p.keys = { KeyW: true, ShiftLeft: run }; }
        if (bounced && p.onGround) { landed = p.pos.x >= h1.x0 && p.pos.x <= h1.x1 + 1 && p.pos.z >= h1.z0 && p.pos.z <= h1.z1 + 1 && Math.abs(p.pos.y - (h1.y + 1)) < 0.01; break; }
      }
      p.keys = {};
      return { bounced, landed };
    };
    out.spring.walk60 = spring(1 / 60, false); out.spring.walk20 = spring(1 / 20, false);
    L.activeR = 14;
    p.pos.set(gym.entry[0] + 0.5, gym.entry[1], gym.entry[2] + 0.5); p.vel.set(0, 0, 0); p.keys = {}; L.shove = null; L.update(0);
    return out;
  });
  console.log('  pushers:', JSON.stringify(D5e.rates), JSON.stringify(D5e.rule), JSON.stringify(D5e.shove), JSON.stringify(D5e.spring));
  t.ok(D5e.rates.P1[0] >= 0.55, `walking nonstop over P1 (one pusher) works for ${Math.round(D5e.rates.P1[0] * 100)}% of start times (at least 55%)`);
  for (const id of ['P2', 'P3', 'P4', 'P5']) t.ok(D5e.rates[id][0] >= 0.25 && D5e.rates[id][0] <= 0.6, `walking nonstop over ${id} works for ${Math.round(D5e.rates[id][0] * 100)}% of start times (running ${Math.round(D5e.rates[id][1] * 100)}%; 25-60%)`);
  for (const id of ['P1', 'P2', 'P3', 'P4', 'P5']) t.ok(D5e.rule[id], `"go right after the first pusher pulls back" crosses ${id} every time, 0-0.3 s late, at 60 and 20 fps ${JSON.stringify(Object.keys(D5e.rule).filter(k => k.startsWith(id + '@')))}`);
  for (const k of ['still60', 'back60', 'still20', 'back20']) {
    const s = D5e.shove[k];
    t.ok(s.moved >= 1.4 && s.fell && s.headSeen && s.headBefore && s.headAfter, `a pusher that is out shoves you off the beam (${k}: ${JSON.stringify(s)}), and its head shows only while it is out`);
  }
  t.ok(D5e.spring.walk60.bounced && D5e.spring.walk60.landed && D5e.spring.walk20.bounced && D5e.spring.walk20.landed, `jumping on spring SP1 launches you onto H1 at 60 and 20 fps (${JSON.stringify(D5e.spring)})`);

  // The way in a real game: the guide, the welcome, the people, the badge.
  const info = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'parkour');
    return { x: gym.x, z: gym.z, fy: gym.fy, front: gym.front, entry: gym.entry, stand0: gym.checkpoints[0].stand, yaw0: gym.checkpoints[0].yaw, P: gym.P };
  });
  const guide = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'parkour');
    const farP = { x: gym.entry[0] + 0.5 + 30, y: gym.fy + 1, z: gym.entry[2] + 0.5 + 30 };
    const far = g.access.of(gym).aim(farP).text('→', 30);
    const aim = g.access.of(gym).aim(farP);
    const nearP = { x: gym.entry[0] + 0.5 + gym.front[0] * 3, y: gym.fy + 1, z: gym.entry[2] + 0.5 + gym.front[1] * 3 }; // just outside the site, at the foot of the stairs
    const nearText = g.access.of(gym).aim(nearP).text('→', 3);
    const hereText = g.access.of(gym).aim({ x: gym.x + 0.5, y: gym.fy + 1, z: gym.z + 0.5 }).text('→', 5);
    const l7 = gym.checkpoints[3].stand; // the area is full height now: the arrow also says so up at the finish
    const hereTop = g.access.of(gym).aim({ x: l7[0], y: l7[1], z: l7[2] }).text('→', 5);
    return { far, aimOk: Math.abs(aim.x - (gym.entry[0] + 0.5)) < 1e-9 && Math.abs(aim.z - (gym.entry[2] + 0.5)) < 1e-9, nearText, welcome: g.access.of(gym).welcome(), hereText, hereTop, tips: g.access.of(gym).tips };
  });
  t.ok(guide.aimOk && guide.far === 'Next: Obstacle Course → 30m' && guide.nearText === 'The Obstacle Course starts up these stairs!' && guide.hereText === 'Obstacle Course is here!' && guide.hereTop === 'Obstacle Course is here!' && guide.tips === null, `the arrow points at the foot of the stairs (${guide.far} / ${guide.nearText})`);
  t.ok(guide.welcome.startsWith('Welcome to the Obstacle Course!'), 'the welcome toast');

  // People and the badge
  await page.evaluate(async () => {
    const g = window.pokecraft;
    g.creatures.clear(); document.exitPointerLock();
    window.__toasts = [];
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) window.__toasts.push(n.textContent); })
      .observe(document.getElementById('toast'), { childList: true });
    const { makeCreature } = await import('/src/species.js');
    g.party = ['titanox', 'spectrion', 'stormwyvern'].map(s => makeCreature(s, 70));
    g.beaten = g.beaten.filter(k => !k.startsWith('parkour:'));
    g.badges = g.badges.filter(b => b !== 'parkour');
  });
  const ppl = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'parkour');
    const ns = g.npcs.list.filter(n => n.gym === gym);
    return ns.map(n => ({ kind: n.kind, name: n.name, i: n.index, y: n.pos.y, ok: n.pos.y === gym.leaderPos[1] || gym.trainerPositions.some(p => p[1] === n.pos.y) }));
  });
  t.ok(ppl.length === 3 && ppl.every(p => p.ok), `Leader Rio and two trainers stand on the platforms (${JSON.stringify(ppl)})`);
  await page.evaluate(() => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'parkour')); });
  const ts = await page.evaluate(() => window.__toasts.join('|'));
  t.ok(ts.includes('Beat Runner Remy and Gymnast Gigi first'), `the leader refuses first (${ts})`);
  for (const [i, name] of [[0, 'Runner Remy'], [1, 'Gymnast Gigi']]) {
    await page.evaluate(i => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(x => x.kind === 'trainer' && x.index === i && x.gym.def.id === 'parkour')); }, i);
    t.ok(await page.evaluate(() => window.pokecraft.inBattle), `${name} battles`);
    t.ok(await playBattle(page), `beat ${name}`);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.exitPointerLock());
  }
  await page.evaluate(() => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'parkour')); });
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'the leader battles after both trainers');
  t.ok(await playBattle(page), 'beat Leader Rio');
  await page.waitForTimeout(500);
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('parkour')), 'the Sneaker Badge is awarded');

  // D6: screenshots. From above at noon, the start, each mechanic in action (the course clock is frozen so the look is fixed), the top, and an iPad.
  await page.evaluate(() => { const g = window.pokecraft; g.inBattle = false; document.getElementById('pause')?.classList.add('hidden'); g.time = 0.25; g.weather.set('clear'); g.creatures.clear(); g.creatures.spawnTimer = 1e9; });
  const cam = async (name, x, y, z, look, wait = 3000, clock = null, extra = null) => {
    await page.evaluate(([x, y, z, look, clock, extra]) => {
      const g = window.pokecraft, L = g.gymLive.of('parkour');
      if (!L.__u) { L.__u = L.update.bind(L); L.update = () => L.__u(0); } // freeze the course clock for the picture
      L.activeR = 999;
      if (clock !== null) L.clock = clock;
      L.crumbleAt.clear();
      if (extra === 'shake') L.crumbleAt.set('C1', L.clock - 0.3);
      L.__u(0);
      g.player.pos.set(x, y, z); g.player.vel.set(0, 0, 0); g.player.keys = {};
      g.player.lookAt({ x: look[0], y: look[1], z: look[2] });
      g.creatures.clear();
    }, [x, y, z, look, clock, extra]);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 });
    console.log(`  screenshot ${name}`);
  };
  const shotInfo = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'parkour');
    const dirW = (dd, ds) => [gym.front[0] * dd + gym.side[0] * ds, gym.front[1] * dd + gym.side[1] * ds];
    const col = (d, s) => { const [a, b] = dirW(d, s); return [gym.x + a + 0.5, gym.z + b + 0.5]; };
    const top = id => gym.pieces[id].y + 1;
    return { x: gym.x, z: gym.z, fy: gym.fy, front: gym.front, side: gym.side, stand0: gym.checkpoints[0].stand, yaw0: gym.checkpoints[0].yaw,
      at: Object.fromEntries([['b3', col(9, 16), top('B2')], ['l2', col(-16, 12), top('L2')], ['m1', col(-8, -8), top('M1')], ['a4', col(15, -1), top('A4')], ['l4', col(11, -9), top('L4')], ['f', col(15, -16), top('F')]].map(([k, c, y]) => [k, [c[0], y, c[1]]])),
      look: { k4: col(-4, 16), z1: col(-16, 5), p1: col(1, -8), c1: col(15, 4), sp1: col(11, 0), down: col(-8, 0) } };
  });
  const gx = shotInfo.x + 0.5, gz = shotInfo.z + 0.5, fy = shotInfo.fy, fr = shotInfo.front, sd = shotInfo.side;
  await cam('t36-course-overview.png', gx - fr[0] * 2 + 0.01, fy + 62, gz - fr[1] * 2, [gx, fy, gz], 4000, 0.4);
  await cam('t365-course-angle.png', gx + fr[0] * 38 + sd[0] * 30, fy + 34, gz + fr[1] * 38 + sd[1] * 30, [gx - fr[0] * 4, fy + 9, gz - fr[1] * 4], 4000, 0.4);
  await cam('t36-course-start.png', ...shotInfo.stand0, [shotInfo.stand0[0] - Math.sin(shotInfo.yaw0) * 8, shotInfo.stand0[1] - 1.2, shotInfo.stand0[2] - Math.cos(shotInfo.yaw0) * 8]);
  const eye = (k, h = 0) => [shotInfo.at[k][0], shotInfo.at[k][1] + h, shotInfo.at[k][2]];
  await cam('t365-course-blink.png', ...eye('b3'), [shotInfo.look.k4[0], shotInfo.at.b3[1] + 0.6, shotInfo.look.k4[1]], 3000, 0.4); // K4 (group B) flashes
  await cam('t365-course-zap.png', ...eye('l2'), [shotInfo.look.z1[0], shotInfo.at.l2[1] - 0.3, shotInfo.look.z1[1]], 3000, 2.4); // the first Z1 strip is lit
  await cam('t365-course-pusher.png', ...eye('m1'), [shotInfo.look.p1[0], shotInfo.at.m1[1] - 0.2, shotInfo.look.p1[1]], 3000, 2.7); // P1's pusher is out
  await cam('t365-course-crumble.png', ...eye('a4'), [shotInfo.look.c1[0], shotInfo.at.a4[1] - 0.3, shotInfo.look.c1[1]], 3000, 0.4, 'shake'); // C1 is cracking
  await cam('t365-course-spring.png', ...eye('l4'), [shotInfo.look.sp1[0], shotInfo.at.l4[1] + 1.5, shotInfo.look.sp1[1]], 3000, 0.4);
  await cam('t365-course-top.png', ...eye('f'), [shotInfo.look.down[0], shotInfo.at.f[1] - 8, shotInfo.look.down[1]], 3500, 0.4); // the finish, looking down the course

  const ipad = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await ipad.tap('text=New Game', { timeout: 180000 });
  await ipad.tap('.starter >> nth=0', { timeout: 180000 });
  await ipad.waitForTimeout(1500);
  const iinfo = await ipad.evaluate(info => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'parkour');
    g.time = 0.25; g.weather.set('clear'); g.creatures.clear(); g.creatures.spawnTimer = 1e9;
    const L = g.gymLive.of('parkour');
    L.__u = L.update.bind(L); L.update = () => L.__u(0);
    L.activeR = 999; L.clock = 0.4; L.__u(0);
    // this browser has its own world (its own seed): find the cells in its own gym
    const dirW = (dd, ds) => [gym.front[0] * dd + gym.side[0] * ds, gym.front[1] * dd + gym.side[1] * ds];
    const col = (d, s) => { const [x, z] = dirW(d, s); return [gym.x + x + 0.5, gym.z + z + 0.5]; };
    const [bx, bz] = col(9, 16), [kx, kz] = col(-4, 16), by = gym.pieces.B2.y + 1;
    g.player.pos.set(bx, by, bz); g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: kx, y: by + 0.6, z: kz });
    return { touch: document.body.classList.contains('touch'), mat: gym.course };
  }, shotInfo);
  await ipad.waitForTimeout(3500);
  await ipad.screenshot({ path: path.join(SHOTS, 't36-course-ipad.png'), timeout: 180000 });
  console.log('  screenshot t36-course-ipad.png (blink blocks flashing, at tablet size)');
  t.ok(iinfo.touch, 'the course loads on an iPad viewport');
  t.ok(!ipad.errors.length, `no page errors on the iPad ${ipad.errors.join('; ')}`);
  await ipad.context().close();

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
