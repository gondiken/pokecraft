// T36 Parkour: the seven creatures (A), the "high places" spawn condition (B), the run-away walk (C) and, from step B of
// the task, the Obstacle Course gym (D). Creature logic is driven inside one page.evaluate with synchronous
// cm.updateOne / cm.update loops (the game loop cannot run in between, nothing depends on the frame rate).
// Screenshots go to tests/screenshots/t36-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, newGame, platform, ROOT } from '../helpers.mjs';

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
      const x = sx - 3 + i, z = sz - 2;
      const w = g.creatures.spawnAt(id, x, y - 0, z, { level: 5, when: 'high' });
      w.frozen = true; // posing for the photo
      w.heading = Math.PI + (i - 3) * 0.12;
      out.push(!!w);
    });
    g.player.pos.set(sx + 0.5, y, sz + 3.6);
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
    const pillar = (x, z, n, id = B.STONE, record = true) => { const g0 = w.ground[colOf(x, z)]; for (let k = 1; k <= n; k++) w.set(x, g0 + k, z, id, record); return g0; };
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

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
