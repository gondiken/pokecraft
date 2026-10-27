// T45: the Doodle type and the Sketchbook (plans/T45.md). A. type data. B. the pencil atlas. C. the sketch switch off = bit for bit
// (main world, Dream, Swirl, and again after a trip to the Sketchbook). D. the look in the game. E. terrain for three seeds (the walk graph
// from tests/doodlecheck.mjs). F. Draw! (pure, tracing.js, the model players of tests/doodlecheck.mjs). G. play: the frame, Draw!, ink, falling, saving, crew, Arlo, rematch, the ways
// back. H. iPad. I. two browsers. J. screenshots (tests/screenshots/t45-*.png).
// DOODLE_ONLY=data|atlas|off|look|land|trace|play|ipad|pair|shots runs part of it.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, waitFor as waitFor0, startWeakBattle, playBattle } from '../helpers.mjs';

const waitFor = (page, fn, arg, ms = 120000) => waitFor0(page, fn, arg, ms);
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const ONLY = process.env.DOODLE_ONLY || '';
const want = part => !ONLY || ONLY === part;
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id);
const toasts = page => page.evaluate(() => { window.__toasts = []; const g = window.pokecraft; if (g.ui.__wrapped) return; const f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; g.ui.__wrapped = true; });
const said = (page, re) => page.evaluate(src => window.__toasts.some(m => new RegExp(src).test(m)), re.source);
const shot = async (page, name, spot, wait = 1500) => {
  if (spot) await page.evaluate(([x, y, z, yaw, pitch]) => window.__at(x, y, z, yaw, pitch), spot);
  await page.evaluate(() => document.getElementById('pause')?.classList.add('hidden'));
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `t45-${name}.png`), timeout: 180000 });
  console.log(`  screenshot t45-${name}.png`);
};

// in-page helpers: step the player and the live part by hand (no pointer lock in tests, so the frame loop does not play)
const helpers = page => page.evaluate(async () => {
  const g = window.pokecraft;
  window.__DC = await import('/tests/doodlecheck.mjs'); window.__T = await import('/src/tracing.js');
  window.__live = () => g.gymLive.of('part:doodle');
  const lv = window.__live();
  if (lv) lv.playing = () => true;
  window.__at = (x, y, z, yaw = 0, pitch = 0) => { const p = g.player; p.carry?.leave?.(false); p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.keys = {}; };
  window.__walk = (pts, max = 1500, dt = 0.05) => { // real Player physics along points (jumping up steps)
    const p = g.player; let i = 0, steps = 0;
    while (i < pts.length && steps < max) {
      const [x, z] = pts[i], dx = x - p.pos.x, dz = z - p.pos.z;
      if (Math.hypot(dx, dz) < 0.45) { i++; continue; }
      p.yaw = Math.atan2(-dx, -dz);
      p.keys.KeyW = true; p.keys.Space = p.hitWall;
      p.update(dt); g.gymLive.update(dt); steps++;
    }
    p.keys.KeyW = false; p.keys.Space = false;
    return { i, steps, x: p.pos.x, y: p.pos.y, z: p.pos.z };
  };
  // Draw line n from its pad with a model player (tests/doodlecheck.mjs DrawBot: it stands on the drawn line and looks where the bot
  // wants the line to go); the real live part gets the same input. bot: skilled | careless | lazy | idle | nostar.
  window.__draw = (n, dt = 0.05, { bot = 'skilled', max = 3000, lazy = 5 } = {}) => {
    const L = window.__live(); L.manual = true;
    const s = g.world.doodle.pads[n - 1].stand; window.__at(s[0], s[1], s[2]);
    const used = L.use(g.player);
    if (!L.cur) return { used, steps: 0, info: L.info() };
    const st = L.cur.st, B = new window.__DC.DrawBot(L.cur.course, { bot, lazy });
    let i = 0;
    for (; i < max && L.cur; i++) { const inp = B.input(st, dt); g.player.pos.set(...inp.player); g.player.vel.set(0, 0, 0); L.step(dt, inp); B.after(st); }
    const cells = [...st.cells.values()].map(c => [c.x, c.y, c.z]);
    return { used, steps: i, info: L.info(), log: B.log, cells, pts: st.pts.map(p => [p.x, p.row, p.z]), done: st.done };
  };
  // Draw line n while walking on it with real Player physics (the sticky line and the step-up hop on): when the pencil's heading is
  // off the next point of the route, look 3 past the pencil toward it (steer); else look at your own line 2.5 ahead of your feet
  // (walk). Walk forward while more than `close` from the pencil (-1 = always); careless = always steer at the route's last point.
  window.__drawReal = (n, dt = 0.05, { max = 3000, route = null, close = 2 } = {}) => {
    const L = window.__live(), p = g.player, T = window.__T; L.manual = true; L.guardInTests = true;
    const s = g.world.doodle.pads[n - 1].stand; window.__at(s[0], s[1], s[2]);
    L.use(p);
    if (!L.cur) return null;
    const st = L.cur.st, pts = route ?? L.cur.course.route, backs = []; let wp = 0, i = 0, minY = 99, steer = 0;
    for (; i < max && L.cur; i++) {
      const t = st.tip, passed = q => { const dx = q[0] - t.x, dz = q[1] - t.z, d = Math.hypot(dx, dz); return d < 1.6 || (d < 4 && dx * Math.cos(t.h) + dz * Math.sin(t.h) < 0); };
      while (wp < pts.length - 1 && passed(pts[wp])) wp++;
      const dx = pts[wp][0] - t.x, dz = pts[wp][1] - t.z, m = Math.hypot(dx, dz) || 1, err = Math.atan2(Math.sin(Math.atan2(dz, dx) - t.h), Math.cos(Math.atan2(dz, dx) - t.h));
      let q;
      if (route || Math.abs(err) > 0.12) { q = [t.x + dx / m * 3, t.row + 1, t.z + dz / m * 3]; steer++; }
      else { const a = T.pointAt(st, Math.min(st.s, st.playerS + 2.5)); q = [a[0], a[1] + 1, a[2]]; }
      const e = p.eyePos, v = [q[0] - e.x, q[1] - e.y, q[2] - e.z];
      p.yaw = Math.atan2(-v[0], -v[2]); p.pitch = Math.atan2(v[1], Math.hypot(v[0], v[2]));
      p.keys.KeyW = Math.hypot(t.x - p.pos.x, t.z - p.pos.z) > close; p.keys.Space = false;
      p.update(dt); L.step(dt); minY = Math.min(minY, p.pos.y);
      for (const ev of st.events) if (ev.kind === 'back') backs.push([ev.reason, i, +p.pos.x.toFixed(1), +p.pos.z.toFixed(1)]);
    }
    p.keys = {}; L.guardInTests = false;
    return { steps: i, done: st.done, setbacks: st.setbacks, backs, steer, guarded: L.guarded, info: L.info(), x: p.pos.x, y: p.pos.y, z: p.pos.z, minY, under: g.world.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z)) };
  };
});
// the Champion goes into the Swirl and through the Sketchbook frame
async function intoDoodle(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; if (g.place !== 'swirl') g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  const cell = await page.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'doodle'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  const info = await page.evaluate(c => {
    const g = window.pokecraft, b = { x: c[0], y: c[1], z: c[2], id: g.world.get(...c) };
    return { id: b.id, prompt: g.portal.prompt(b, 'click or E'), action: g.portal.action(b), used: g.portal.use(b) };
  }, cell);
  await placeIs(page, 'doodle');
  await helpers(page);
  return info;
}
const stand = (page, k) => page.evaluate(k => { const s = window.pokecraft.world.doodle.pads[k].stand; window.__at(s[0], s[1], s[2], 0, 0); return s; }, k);

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (ONLY === 'pair') return pairPart({ browser, base, t });
  if (ONLY === 'ipad') return ipadPart({ browser, base, t });
  if (ONLY === 'shots') return shotsPart({ browser, base, t });
  const page = await openGame(browser, base);

  /* ================================ A. the type ================================ */
  if (want('data')) {
    const A = await page.evaluate(async () => {
      const S = await import('/src/species.js'), R = await import('/src/realms.js'), FX = await import('/src/fxrecipes.js'), SH = await import('/src/shapes.js');
      const TR = await import('/src/traits.js'), PW = await import('/src/pictureworlds.js'), BK = await import('/src/book.js'), { sound } = await import('/src/sound.js');
      const BL = await import('/src/blocks.js');
      const ids = Object.keys(S.SPECIES).filter(i => S.SPECIES[i].type === 'doodle');
      const shapes = [...new Set(ids.map(i => S.SPECIES[i].model.shape))].sort();
      const otherShapes = new Set(Object.values(S.SPECIES).filter(s => s.type !== 'doodle').map(s => s.model.shape));
      const crayon = ids.map(id => {
        const m = S.buildModel(id); let star = 0, keep = 0, meshes = 0;
        m.traverse(o => { if (o.isMesh) meshes++; if (o.userData.gear === 'crayon') { star++; if (o.userData.keepColour) keep++; } });
        S.disposeModel(m);
        return [id, star > 0 && star === keep, meshes];
      });
      const mv = id => S.MOVES[id];
      const learns = id => S.SPECIES[id].learn.map(([l, m]) => `${l}:${m}`);
      const eff = S.effectiveness, keys = Object.keys(S.TYPE_COLORS);
      const own = keys.filter(d => eff('doodle', d) !== 1).map(d => `${d}:${eff('doodle', d)}`).sort().join();
      const onD = keys.filter(a => a !== 'doodle' && eff(a, 'doodle') !== 1).map(a => `${a}:${eff(a, 'doodle')}`).sort().join();
      const rows = ids.flatMap(id => BK.spawnInfo(id).map(r => r.name)).filter((n, i, a) => a.indexOf(n) === i);
      const spawns = Object.values(S.SPAWNS).flat().filter(e => ids.includes(e[0])).length;
      const rs = R.REALMS.doodle.spawns, inRealm = ids.every(id => Object.entries(rs).some(([k, l]) => k !== 'cave' && l.some(e => e[0] === id)));
      const blocks = [245, 246, 247, 248].map(id => { const d = BL.BLOCKS[id]; return !!d && d.fixed === true && !BL.PLACEABLE.includes(id) && !!d.wallText && BL.isSolid(id); });
      return {
        ids, shapes, ownShapes: shapes.every(s => !otherShapes.has(s)), registered: shapes.every(s => !!SH.SHAPES[s]), crayon,
        evo: ids.map(id => `${id}:${S.SPECIES[id].evolve ? S.SPECIES[id].evolve.level + '>' + S.SPECIES[id].evolve.into : '-'}`).join(),
        moves: ['pencilpoke', 'sketchswipe', 'quickdraw', 'rubout', 'leadlance', 'cleanslate', 'squigglestrike'].map(id => !!mv(id) && mv(id).type === 'doodle'),
        mvs: [mv('quickdraw').priority, mv('rubout').fx, mv('leadlance').sig, mv('cleanslate').sig, mv('squigglestrike').fx, mv('squigglestrike').sig],
        big: [['masterpiece', 'rally'], ['tracingpaper', 'shield'], ['finishingtouch', 'lastword']].map(([id, k]) => mv(id)?.big && mv(id).fx.kind === k && mv(id).type === 'doodle'),
        sig: [learns('graphitan').includes('30:leadlance'), learns('rubbadub').includes('30:cleanslate'), learns('outlynx').includes('30:squigglestrike')],
        sigFx: !!FX.SIG.leadlance && !!FX.SIG.cleanslate && !!FX.SIG.squigglestrike,
        fx: [FX.TRAVEL.doodle !== FX.TRAVEL.normal, FX.IMPACT.doodle !== FX.IMPACT.normal, FX.FX_COLORS.doodle !== FX.FX_COLORS.normal],
        sounds: [sound.has('fx:doodle'), sound.has('doodlescratch'), sound.has('doodlerub')], clash: Object.keys(S.MOVES).filter(m => sound.has(m) && S.MOVES[m].type === 'doodle'),
        color: S.TYPE_COLORS.doodle, wool: BL.WOOL.doodle, woolDef: !!BL.BLOCKS[244], blocks,
        ride: TR.TRAITS.rideable.species.outlynx, spawns, inRealm, rows, ready: PW.pictureWorld('doodle')?.ready, secret1: !!PW.pictureWorld('secret1'),
        own, onD, twelve: PW.PICTURE_WORLDS.length,
        old: (() => { // every old cell is unchanged: compare each old row with a copy of the chart minus the doodle keys (the chart is rebuilt without them)
          const old = {}; for (const a of keys) for (const d of keys) if (a !== 'doodle' && d !== 'doodle') old[a + '>' + d] = eff(a, d);
          return Object.keys(old).length;
        })(),
        book: (() => { try { return !!BK.spawnInfo('nibling'); } catch (e) { return false; } })(),
      };
    });
    t.ok(A.ids.length === 7 && A.ids.join() === 'nibling,graphitan,rubbit,rubbadub,sketchkit,outlynx,notquite', `seven Doodle creatures (${A.ids})`);
    t.ok(A.evo === 'nibling:27>graphitan,graphitan:-,rubbit:26>rubbadub,rubbadub:-,sketchkit:28>outlynx,outlynx:-,notquite:-', `three families of two and a single-stage 7th (${A.evo})`);
    t.ok(A.shapes.join() === 'eraserbun,halfdrawn,outline,pencil' && A.ownShapes && A.registered, `four own shapes used by no other type (${A.shapes})`);
    t.ok(A.crayon.every(c => c[1]), `every model wears the yellow crayon star that keeps its colour (${A.crayon.map(c => c[0] + ':' + c[2]).join(' ')} meshes)`);
    t.ok(A.crayon.every(c => c[2] <= 60), 'the models stay small (at most 60 meshes: the outline shape merges its sticks)');
    t.ok(A.moves.every(Boolean) && A.mvs[0] === 1 && A.mvs[1]?.kind === 'lower' && A.mvs[2] && A.mvs[3] && A.mvs[4]?.kind === 'multi' && A.mvs[4].min === 2 && A.mvs[4].max === 5 && A.mvs[5], `the seven moves are as planned (${JSON.stringify(A.mvs)})`);
    t.ok(A.big.every(Boolean) && A.sig.every(Boolean) && A.sigFx, 'Masterpiece (rally), Tracing Paper (shield), Finishing Touch (lastword); the three signature moves at 30 with effects');
    t.ok(A.fx.every(Boolean) && A.sounds.every(Boolean) && !A.clash.length, `own attack effects, colours and sounds (fx:doodle, doodlescratch, doodlerub), no move named like a sound (${A.clash})`);
    t.ok(A.color.includes('#f6f2e8') && A.wool === 244 && A.woolDef && A.blocks.every(Boolean), `type colour, wool 244, blocks 245-248 exist, are fixed, solid, not placeable, with a wall text (${A.blocks})`);
    t.ok(A.ride === 'land', 'Outlynx can be ridden on land');
    t.ok(A.spawns === 0 && A.inRealm && A.rows.some(r => /Sketchbook/.test(r)), `in no SPAWNS table, every one in the Sketchbook's table; Book rows ${A.rows}`);
    t.ok(A.ready === true && !A.secret1 && A.twelve === 12, `the Sketchbook frame ships ready (the old secret1 place); still 12 stars (${A.twelve})`);
    t.ok(A.own === 'camo:2,doodle:0.5,fire:0.5,metal:0.5,sky:2,tiny:2' && A.onD === 'paper:0.5,rainbow:2,water:2', `chart: Doodle hits camo, tiny, sky; water and rainbow hit Doodle, paper is half (${A.own} / ${A.onD})`);
    t.ok(A.book, 'the Book page can list where a Doodle creature lives');
    if (ONLY) { /* data only */ }
  }

  /* ================================ B. the pencil atlas ================================ */
  if (want('atlas')) {
    const B = await page.evaluate(async () => {
      const BL = await import('/src/blocks.js'), SA = await import('/src/sketchatlas.js');
      const atlas = BL.drawAtlas();
      const t0 = performance.now(); const a = SA.drawSketchAtlas(atlas); const ms = performance.now() - t0;
      const t1 = performance.now(); const a2 = SA.drawSketchAtlas(atlas); const ms2 = performance.now() - t1;
      const dat = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const col = dat(atlas), sk = dat(a), sk2 = dat(a2);
      let same = true; for (let i = 0; i < sk.length; i++) if (sk[i] !== sk2[i]) { same = false; break; }
      let alphaBad = 0; for (let i = 3; i < col.length; i += 4) if (col[i] < 128 && sk[i] !== col[i]) alphaBad++; else if (col[i] !== sk[i]) alphaBad++;
      const tiles = []; // per tile: paper pixels and ink pixels
      const PAPER = SA.PAPER, ink = (r, g, b) => r + g + b < 3 * 120;
      let noPaper = 0, noInk = [];
      for (let tt = 0; tt < BL.TILE_COUNT; tt++) {
        let paper = 0, inkN = 0;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = ((BL.tileY(tt) + y) * a.width + BL.tileX(tt) + x) * 4; if (sk[i + 3] < 128) continue; if (ink(sk[i], sk[i + 1], sk[i + 2])) inkN++; else if (sk[i] > 150 && sk[i + 1] > 150) paper++; }
        if (paper === 0) noPaper++;
        if (inkN < 3) noInk.push(tt);
      }
      // patterns differ: the binarised ink masks of the tiles that have a painter of their own
      const names = SA.SKETCH_TILES.filter(n => n !== 'GLASS');
      const mask = n => { const out = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = ((BL.tileY(BL.T[n]) + y) * a.width + BL.tileX(BL.T[n]) + x) * 4; out.push(sk[i] + sk[i + 1] + sk[i + 2] < 3 * 150 ? 1 : 0); } return out; };
      const masks = Object.fromEntries(names.map(n => [n, mask(n)]));
      let worst = 1, worstPair = ''; const low = [];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        let d = 0; for (let k = 0; k < 256; k++) if (masks[names[i]][k] !== masks[names[j]][k]) d++;
        if (d / 256 < 0.14) low.push(names[i] + '/' + names[j] + ':' + (d / 256 * 100).toFixed(0)); if (d / 256 < worst) { worst = d / 256; worstPair = names[i] + '/' + names[j]; }
      }
      // brick-like tiles do not look like board-like ones in the auto pattern: BRICK vs PLANKS use painters, so compare two auto tiles
      const auto = n => { const m = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = ((BL.tileY(BL.T[n]) + y) * a.width + BL.tileX(BL.T[n]) + x) * 4; m.push(sk[i] + sk[i + 1] + sk[i + 2] < 3 * 150 ? 1 : 0); } return m; };
      let autoDiff = 0; { const p = auto('RAINBOW_BRICK'), q = auto('SANDSTONE'); for (let k = 0; k < 256; k++) if (p[k] !== q[k]) autoDiff++; }
      return { w: a.width === atlas.width, h: a.height === atlas.height, same, alphaBad, noPaper, noInk: noInk.length, ms, ms2, worst, worstPair, names: names.length, low, autoDiff, tiles: BL.TILE_COUNT, walls: ['DO_PAPER', 'DO_INK', 'DO_PAD_TOP', 'DO_PAD_SIDE', 'DO_BINDING'].every(n => BL.T[n] > 0) };
    });
    t.ok(B.w && B.h, 'the pencil atlas has exactly the size of the colour atlas');
    t.ok(B.same, 'drawing it twice gives the same bytes (own random numbers)');
    t.ok(B.alphaBad === 0, `the alpha is copied 1:1 (glass and holes stay holes; ${B.alphaBad} differ)`);
    t.ok(B.noPaper === 0, `every tile has paper (${B.noPaper} tiles without)`);
    t.ok(B.noInk <= 6, `tiles have at least 3 ink pixels (${B.noInk} of ${B.tiles} do not: blank-ish ones such as glass, snow-like or tiny tiles)`);
    t.ok(B.worst >= 0.12, `the ${B.names} painted patterns differ pairwise in at least 12% of their pixels (worst ${(B.worst * 100).toFixed(0)}%: ${B.worstPair})`);
    t.ok(B.autoDiff > 20, `two auto-pattern tiles differ (${B.autoDiff} pixels)`);
    t.ok(B.ms < 120, `drawing the atlas takes ${B.ms.toFixed(0)} ms here the first time (${B.ms2.toFixed(0)} ms the second; software rendering, once per session)`);
    if (B.low.length) console.log('  close pairs: ' + B.low.join(' '));
    console.log(`  atlas draw ${B.ms.toFixed(1)} ms (first), ${B.ms2.toFixed(1)} ms (second)`);
  }

  /* ================================ C. the switch off = bit for bit ================================ */
  if (want('off')) {
    await newGame(page, 0);
    await page.evaluate(() => {
      const g = window.pokecraft;
      window.__cmp = async () => {
        const THREE = await import('three'), { patchMaterial, sketchLook } = await import('/src/caves.js');
        const r = g.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        g.fx.hold = 0.5; g.sketch.hold = true;
        g.world.cull(g.camera.position, g.scene.fog.far);
        const grab = () => { r.render(g.scene, g.camera); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
        const a = grab();
        const mats = g.world.materials, clones = new Map();
        const mk = (m, patch) => { const c = m.clone(); if (patch) patchMaterial(c, { sketch: false }); return c; };
        clones.set(mats.solid, mk(mats.solid, true)); clones.set(mats.water, mk(mats.water, true)); clones.set(mats.glow, mk(mats.glow, false));
        const swapped = [];
        for (const list of g.world.meshes.values()) for (const m of list) { const c = clones.get(m.material); if (c) { swapped.push([m, m.material]); m.material = c; } }
        const b = grab();
        for (const [m, old] of swapped) m.material = old;
        for (const c of clones.values()) c.dispose();
        let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
        let ink = 0; for (let i = 0; i < a.length; i += 4) if (a[i] + a[i + 1] + a[i + 2] > 0) ink++;
        let sketchAttr = 0, keys = 0;
        for (const list of g.world.meshes.values()) for (const m of list) if (m.geometry.getAttribute('sketchEdge')) sketchAttr++;
        g.scene.traverse(o => { const mm = o.material; if (mm && mm.customProgramCacheKey && /sketch-model/.test(mm.customProgramCacheKey())) keys++; });
        return {
          diff, nonblack: ink, swapped: swapped.length, on: sketchLook.uSketchOn.value, mapColour: !!mats.solid.map.image.fireFrames && mats.water.map === mats.solid.map && mats.glow.map === mats.solid.map,
          sketchAttr, modelKeys: keys, programs: r.info.programs.length, progKeys: r.info.programs.map(p => p.cacheKey?.length ?? 0).length,
          sketchProgs: r.info.programs.filter(p => /sketch-model/.test(String(p.name) + String(p.cacheKey))).length,
        };
      };
    });
    const show = (label, r) => console.log(`  ${label}: ${r.swapped} meshes swapped, ${r.diff} bytes differ, ${r.programs} programs`);
    const base0 = await page.evaluate(() => window.__cmp());
    show('main world', base0);
    t.ok(base0.swapped > 10 && base0.nonblack > 1000 && base0.diff === 0, `main world: the real materials and the sketch-free clones draw the same frame, byte for byte (${base0.swapped} chunk meshes, ${base0.diff} differ)`);
    t.ok(base0.on === 0 && base0.mapColour && base0.sketchAttr === 0 && base0.modelKeys === 0, `main world: the switch is 0, every map is the colour texture, no chunk has an edge mask, no model is patched`);
    await page.evaluate(() => { window.pokecraft.time = 0.75; window.pokecraft.realms.enter('dream'); });
    await placeIs(page, 'dream');
    await page.waitForTimeout(800);
    const dream = await page.evaluate(() => window.__cmp());
    show('dream', dream);
    t.ok(dream.diff === 0 && dream.on === 0 && dream.mapColour && dream.sketchAttr === 0, `Dream: bit for bit too (${dream.swapped} chunk meshes, ${dream.diff} differ)`);
    await page.evaluate(() => window.pokecraft.realms.leave('stone'));
    await placeIs(page, 'main');
    await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
    await placeIs(page, 'swirl');
    await page.waitForTimeout(800);
    const swirl = await page.evaluate(() => window.__cmp());
    show('swirl', swirl);
    t.ok(swirl.diff === 0 && swirl.on === 0 && swirl.mapColour && swirl.sketchAttr === 0, `Swirl: bit for bit too (${swirl.swapped} chunk meshes, ${swirl.diff} differ)`);
    const progsBefore = swirl.programs;
    // a trip to the Sketchbook and back: the swap really goes back
    await intoDoodle(page);
    const inside = await page.evaluate(async () => {
      const g = window.pokecraft, { sketchLook } = await import('/src/caves.js'), mats = g.world.materials;
      let edge = 0; for (const list of g.world.meshes.values()) for (const m of list) if (m.geometry.getAttribute('sketchEdge')) edge++;
      return { on: sketchLook.uSketchOn.value, tex: mats.solid.map === g.sketch.texture && mats.water.map === g.sketch.texture && mats.glow.map === g.sketch.texture, edge, programs: g.renderer.info.programs.length };
    });
    t.ok(inside.on === 1 && inside.tex && inside.edge > 5, `in the Sketchbook the switch is 1, all three maps are the pencil texture, chunks carry the edge mask (${inside.edge})`);
    await page.evaluate(() => { const g = window.pokecraft; g.realms.leave('door', { via: 'doodle' }); });
    await placeIs(page, 'swirl');
    await page.waitForTimeout(800);
    const back = await page.evaluate(() => window.__cmp());
    show('swirl again', back);
    t.ok(back.diff === 0 && back.on === 0 && back.mapColour && back.sketchAttr === 0 && back.modelKeys === 0, `after the trip: the Swirl is bit for bit again, maps are the colour texture, no edge masks, no patched models (${back.diff} differ)`);
    t.ok(back.programs <= Math.max(progsBefore, inside.programs) + 2, `no shader program was added outside the Sketchbook (${progsBefore} before, ${inside.programs} inside, ${back.programs} after)`);
    await page.evaluate(() => window.pokecraft.realms.leave('stone'));
    await placeIs(page, 'main');
    const final = await page.evaluate(() => window.__cmp());
    t.ok(final.diff === 0 && final.on === 0 && final.mapColour, `and the main world again (${final.diff} differ)`);
    t.ok(page.errors.length === 0, `no page errors (${page.errors.slice(0, 2).join(' | ')})`);
    if (ONLY === 'off') return;
  }

  /* ================================ E. terrain (Node code run in the page) ================================ */
  if (want('land')) {
    for (const seed of [1, 4242, 294331207]) {
      const r = await page.evaluate(async seed => {
        const C = await import('/tests/doodlecheck.mjs'), { World } = await import('/src/world.js'), R = await import('/src/realms.js');
        const a = C.analyze(seed);
        const def = R.REALMS.doodle, w = new World(seed, null, null, def.size, def); w.generate();
        const w2 = new World(seed, null, null, def.size, def); w2.generate();
        let same = w.data.length === w2.data.length; for (let i = 0; i < w.data.length && same; i++) if (w.data[i] !== w2.data[i]) same = false;
        return { problems: a.problems, info: a.info, same, parts: w.parts.map(p => p.live), biome: w.biome(80, 80), sketch: w.sketch, ground: w.ground[5 + 5 * w.W], size: [w.W, w.D], healer: !!w.healer, gyms: w.gyms.length };
      }, seed);
      t.ok(r.problems.length === 0, `terrain seed ${seed}: ${r.problems.length ? r.problems.slice(0, 4).join('; ') : `8 pages (gaps >= ${r.info.minGap}), 8 lines walkable, each pad needs the line before, the Desk only after all 8, the spiral stair ends on the deck, nobody stuck, keeps cover everything (${r.info.ms} ms)`}`);
      t.ok(r.same && r.parts.includes('doodle') && r.biome === 'doodle' && r.sketch === true && r.size.join() === '160,160' && r.gyms === 0, `terrain seed ${seed}: made again the same, a doodle part, biome doodle, a sketch world of 160 x 160`);
      if (seed === 1) console.log('  lines: ' + JSON.stringify(r.info.lines));
    }
    if (ONLY === 'land') return;
  }

  /* ================================ F. Draw! (pure, tracing.js + the model players of tests/doodlecheck.mjs) ================================ */
  if (want('trace')) {
    const F = await page.evaluate(async () => {
      const C = await import('/tests/doodlecheck.mjs'), T = await import('/src/tracing.js'), D = await import('/src/doodleland.js');
      const t0 = performance.now(), checks = C.drawChecks(1), ms = performance.now() - t0;
      const w = C.makeDoodle(1), solid = C.solidOf(w), out = { problems: [...checks.problems], rows: checks.rows, ms };
      const bad = m => out.problems.push(m);
      // the same input twice: the same line (no Math.random)
      const a = C.simCourse(D.courseOf(3, solid)), b = C.simCourse(D.courseOf(3, solid));
      if (a.st.pts.length !== b.st.pts.length || a.st.pts.some((p, i) => p.x !== b.st.pts[i].x || p.z !== b.st.pts[i].z)) bad('two runs drew different lines');
      // the pencil draws where you look: looking left of it bends the line left, looking at it keeps it straight
      const c1 = D.courseOf(1, solid), pl = c1.pad, look = (st, P) => { const e = [pl[0], pl[1] + 1.6, pl[2]], d = [P[0] - e[0], st.tip.row + 1 - e[1], P[1] - e[2]], m = Math.hypot(...d); return { eye: e, dir: d.map(v => v / m), player: pl }; };
      const h0 = T.newDraw(c1).tip.h, side = [-Math.sin(h0), Math.cos(h0)];
      const s1 = T.newDraw(c1); for (let i = 0; i < 40; i++) T.drawStep(s1, 1 / 60, look(s1, [s1.tip.x, s1.tip.z])); // at the pencil
      const s2 = T.newDraw(c1); for (let i = 0; i < 40; i++) T.drawStep(s2, 1 / 60, look(s2, [s2.tip.x + Math.cos(h0) * 4 + side[0] * 3, s2.tip.z + Math.sin(h0) * 4 + side[1] * 3])); // to one side of it
      out.steer = [+(s1.tip.h - h0).toFixed(3), +(s2.tip.h - h0).toFixed(3)];
      if (Math.abs(out.steer[0]) > 0.001 || Math.abs(out.steer[1]) < 0.3) bad(`steering: at the pencil it turned ${out.steer[0]}, looking to the side ${out.steer[1]}`);
      // the leash: standing still on the pad, the pencil stops 5 blocks ahead; it uses ink only while it draws
      const s3 = T.newDraw(c1); for (let i = 0; i < 300; i++) T.drawStep(s3, 1 / 60, look(s3, [pl[0] + Math.cos(h0) * 20, pl[2] + Math.sin(h0) * 20]));
      out.leash = +Math.hypot(s3.tip.x - pl[0], s3.tip.z - pl[2]).toFixed(2);
      if (out.leash > T.DRAW.leash + 0.2 || out.leash < T.DRAW.leash - 0.5 || Math.abs(s3.ink - (c1.ink - s3.s)) > 1e-6) bad(`the leash: ${out.leash} ahead, ink ${s3.ink}`);
      // a blot stops the pencil (line 2 straight at it), another page too (line 6 from the tower deck toward the Desk, with ink to spare), the tower too (line 5)
      const blk = (n, P0, via) => { const c = { ...D.courseOf(n, solid), ink: 99, rubber: 0 }, st = T.newDraw(c); for (let i = 0; i < 900; i++) { const P = via && i < 90 ? via : P0; const pl = [st.tip.x, c.rowA + 1, st.tip.z]; const e = [pl[0], pl[1] + 1.6, pl[2]], d = [P[0] - e[0], st.tip.row + 1 - e[1], P[1] - e[2]], m = Math.hypot(...d); T.drawStep(st, 1 / 60, { eye: e, dir: d.map(v => v / m), player: [st.tip.x, st.tip.row + 1, st.tip.z] }); } return st.blocked; };
      const c2 = D.courseOf(2, solid), b0 = c2.blots[0], aimBlot = [c2.start[0] + (b0.x - c2.start[0]) * 2, c2.start[1] + (b0.z - c2.start[1]) * 2];
      out.blocks = [blk(2, aimBlot), blk(6, [40, 40], [45, 78]), blk(5, [24, 80])];
      if (out.blocks.join() !== 'blot,page,low') bad(`blocked by ${out.blocks}`);
      // a star: full ink again, and a setback after it keeps the line up to it (Rubber never rubs before it)
      const r6 = C.simCourse(D.courseOf(6, solid), { bot: 'lazy', lazy: 6, maxT: 40 });
      out.r6 = r6.backs;
      const c7 = D.courseOf(7, solid), st7 = T.newDraw(c7), B7 = new C.DrawBot(c7);
      let star = null, after = null;
      for (let i = 0; i < 2400 && !st7.done; i++) {
        const inp = B7.input(st7, 1 / 60);
        T.drawStep(st7, 1 / 60, inp); B7.after(st7);
        if (!star && st7.taken.size) { star = { s: st7.s, ink: st7.ink, cells: [...st7.cells.values()].filter(c => c.s <= st7.s).length }; }
        if (star && !after && st7.s > star.s + 3) { // now stand still until Rubber comes
          for (let j = 0; j < 900 && !st7.events.some(e => e.kind === 'back'); j++) { T.drawStep(st7, 1 / 60, { ...inp, player: inp.player }); }
          after = { back: st7.events.find(e => e.kind === 'back')?.reason, s: st7.s, kept: [...st7.cells.values()].filter(c => c.s <= star.s).length, ink: st7.ink };
          break;
        }
      }
      out.star = { star, after };
      if (!star || Math.abs(star.ink - c7.ink) > 1e-6) bad(`a star fills the ink: ${JSON.stringify(star)}`);
      if (!after || after.back !== 'caught' || Math.abs(after.s - star.s) > 1e-6 || after.kept < star.cells || Math.abs(after.ink - c7.ink) > 1e-6) bad(`caught after the star: back to the star with the line kept: ${JSON.stringify(after)}`);
      return out;
    });
    t.ok(F.problems.length === 0, `Draw!: ${F.problems.length ? F.problems.join('; ') : `for every line a skilled player wins cleanly at 60 and 20 fps (about the same time), drawing straight at the page wins no line cleanly (the landing strip, blots, the tower, bees), the ink never reaches without a star, Rubber catches a player who stops on lines 6-8 and the line still gets drawn, a player who never waits for the bees gets nibbled, lines 6-8 need their stars, Rubber gets faster per rematch win but never as fast as walking, the gaps are keeps (${F.ms.toFixed(0)} ms)`}`);
    t.ok(Math.abs(F.steer[0]) < 0.001 && Math.abs(F.steer[1]) > 0.3, `the pencil draws where you look: looking at the pencil it goes straight (turned ${F.steer[0]}), looking to one side bends the line (turned ${F.steer[1]} rad)`);
    t.ok(F.leash <= 5.2, `standing still the pencil waits ${F.leash} blocks ahead and uses ink only while it draws`);
    t.ok(F.blocks.join() === 'blot,page,low', `an ink blot, a page that is not the next one and the tower stop the pencil (${F.blocks})`);
    t.ok(!!F.star.after, `a star fills the ink; caught after it you go back to it with the line up to it kept (${JSON.stringify(F.star)})`);
    console.log('  Draw! per line: ' + F.rows.map(r => JSON.stringify(r)).join('\n    '));
    if (ONLY === 'trace') return;
  }

  /* ================================ D. the look + G. play ================================ */
  if (want('look') || want('play')) {
    if (!(await page.evaluate(() => !!window.pokecraft.started))) await newGame(page, 0);
    await page.evaluate(() => window.pokecraft.world && window.pokecraft.realms.place !== 'main' && 0);
    await toasts(page);
    const frame = await intoDoodle(page);
    await toasts(page);
    await page.evaluate(() => { window.pokecraft.sketch.hold = true; });
    if (want('play') || !ONLY) {
      t.ok(/Sketchbook/.test(frame.prompt) && frame.used, `the frame in the Swirl says Sketchbook and opens it ("${frame.prompt}")`);
    }
    const base = await page.evaluate(() => { const g = window.pokecraft; return { place: g.place, clock: g.world.realm.clock, pos: g.player.pos.toArray(), doors: g.world.doors.length, crew: g.world.bosses[0].crew.length, live: !!g.gymLive.of('part:doodle'), arrival: g.world.arrivals.doodle }; });
    t.ok(base.place === 'doodle' && base.live && base.doors === 2 && base.crew === 2 && Math.abs(base.pos[0] - base.arrival[0]) < 0.6, `in the Sketchbook: ${base.doors} ways back, ${base.crew} crew, the pencil part is live, you arrived in front of the way back`);

    if (want('look')) {
      const L = await page.evaluate(async () => {
        const g = window.pokecraft, { sketchLook } = await import('/src/caves.js'), S = await import('/src/species.js'), THREE = await import('three');
        const out = {};
        out.on = sketchLook.uSketchOn.value;
        out.maps = g.world.materials.solid.map === g.sketch.texture && g.world.materials.glow.map === g.sketch.texture;
        out.bg = g.scene.background.getHex(); out.fog = g.scene.fog.color.getHex(); out.fogRange = [g.scene.fog.near, g.scene.fog.far];
        // the boil: the step changes about 4 times a second (hold off), and stops with hold
        g.sketch.hold = false;
        const steps = [];
        for (let i = 0; i < 8; i++) { g.sketch.update(0.05, i * 250 + 10); steps.push(sketchLook.uSketchStep.value); }
        const moved = new Set(steps).size;
        g.sketch.hold = true; const frozen = sketchLook.uSketchStep.value; g.sketch.update(0.05, 99999); out.frozen = frozen === sketchLook.uSketchStep.value;
        out.moved = moved;
        const wasPlaying = g.playing; g.sketch.hold = false; const s0 = sketchLook.uSketchStep.value; g.playing = () => false; g.sketch.update(0.05, 123456); out.pausedStill = s0 === sketchLook.uSketchStep.value; g.playing = wasPlaying; g.sketch.hold = true;
        // creatures: a wild one, Arlo and a crew person are patched, the crayon star keeps its colour
        const p = g.player.pos, w = g.creatures.spawnAt('nibling', Math.floor(p.x) + 3, Math.floor(p.y), Math.floor(p.z) + 3);
        const patched = grp => { let a = 0, b = 0, star = 0, starKept = 0; grp.traverse(o => { if (!o.isMesh) return; if (o.userData.keepColour) { star++; if (!o.material.userData.sketched) starKept++; } else if (o.material.userData.sketched) a++; else b++; }); return { a, b, star, starKept }; };
        out.wild = w ? patched(w.model) : null;
        const boss = g.npcs.list.find(n => n.kind === 'boss'), crew = g.npcs.list.find(n => n.kind === 'crew');
        out.boss = patched(boss.model); out.crew = patched(crew.model);
        out.bossName = boss.name;
        // tintModel flashes still work on patched models
        if (w) { S.tintModel(w.model, 0xff0000); let ok = 0; w.model.traverse(o => { if (o.isMesh && o.material.emissive && o.material.emissive.getHex() === 0xff0000) ok++; }); S.tintModel(w.model, null); out.flash = ok; }
        // blocks: the edge mask is on the right edges. A lone stone block on the flat grass of the Cover, and the flat field
        const w0 = g.world, top = 14;
        for (const [x, z] of [[72, 137], [73, 137]]) w0.set(x, top + 1, z, 3);
        const FACES = (await import('/src/world.js')).FACES;
        const top4 = FACES.findIndex(f => f.dir[1] === 1);
        out.maskLone = w0.edgeMask(72, top + 1, 137, top4, 3); // one of two stones side by side: the long sides only
        out.maskField = w0.edgeMask(86, top, 137, top4, 1);    // a grass block in the middle of the flat field
        out.maskStep = w0.edgeMask(72, top, 137, top4, 1);     // the grass under a stone: hidden top
        out.maskFace = [0, 1, 2, 3, 4, 5].map(i => w0.edgeMask(75, top + 1, 140, i, 3));
        w0.set(72, top + 1, 137, 0); w0.set(73, top + 1, 137, 0);
        return out;
      });
      t.ok(L.on === 1 && L.maps && L.bg === 0xf6f2e8 && L.fog === 0xf6f2e8 && L.fogRange[0] === 18 && L.fogRange[1] === 66, `in the Sketchbook the switch is on, the maps are the pencil texture, the sky and fog are paper (fog ${L.fogRange})`);
      t.ok(L.moved >= 6 && L.frozen && L.pausedStill, `the lines boil about 4 times a second (${L.moved} different steps in 8 quarter-seconds), and stand still with hold and when paused`);
      t.ok(L.wild && L.wild.a > 5 && L.wild.star >= 1 && L.wild.starKept === L.wild.star, `a wild Doodle creature is drawn in pencil and its crayon star keeps its colour (${JSON.stringify(L.wild)})`);
      t.ok(L.boss.a > 5 && L.crew.a > 5, `${L.bossName} and a crew person are patched too (${L.boss.a}, ${L.crew.a} meshes)`);
      t.ok(L.flash > 3, `a hit flash (tintModel) still reaches the patched materials (${L.flash} meshes)`);
      t.ok(L.maskField === 0 && L.maskLone !== 0 && L.maskLone !== 15 && L.maskStep !== undefined, `the edge mask: none inside the flat grass field (${L.maskField}), lines round a stone block (${L.maskLone}), the long sides of a pair`);
      t.ok(L.maskFace.length === 6, `the mask works on every face (${L.maskFace})`);
      // pixels: an outline on each drawn edge, none between two grass blocks of a field; a block 76 from the middle is mostly paper
      const P = await page.evaluate(async () => {
        const g = window.pokecraft, THREE = await import('three'), r = g.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        const w0 = g.world, top = 14;
        // a 5 x 5 stone slab, one block high, on the grass of the Cover, seen from straight above
        for (let x = 74; x < 79; x++) for (let z = 138; z < 143; z++) w0.set(x, top + 1, z, 3);
        w0.updateDirty();
        const cam = g.camera; cam.position.set(76.5, top + 14, 140.5); cam.rotation.set(-Math.PI / 2, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        g.sketch.hold = true;
        g.scene.fog.near = 1000; g.scene.fog.far = 2000;
        r.render(g.scene, cam); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
        const px = (x, y) => { const i = ((H - 1 - y) * W + x) * 4; return b[i] + b[i + 1] + b[i + 2]; };
        const scr = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [Math.round((v.x * 0.5 + 0.5) * W), Math.round((1 - (v.y * 0.5 + 0.5)) * H)]; };
        const dark = (x0, y0, x1, y1) => { let n = 0, tot = 0; for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x++) { tot++; if (px(x, y) < 3 * 110) n++; } return n / Math.max(1, tot); };
        const [ax, ay] = scr(74, top + 2, 138), [bx, by] = scr(79, top + 2, 143); // the slab's top face on screen
        const edgeBand = 5;
        const north = dark(ax, ay - 2, bx, ay + edgeBand), south = dark(ax, by - edgeBand, bx, by + 2), west = dark(ax - 2, ay, ax + edgeBand, by), east = dark(bx - edgeBand, ay, bx + 2, by);
        const mid = dark(ax + 20, ay + 20, bx - 20, by - 20);
        // the field beside it: same size band between two grass blocks of the flat field
        const [fx, fy] = scr(66, top + 1, 140), [gx, gy] = scr(71, top + 1, 140);
        const field = dark(fx, fy - 40, gx, fy + 40);
        // distance: a block 76 from the middle (80, 80) is mostly paper
        const meanAt = (x, z) => 0;
        const out = { north, south, west, east, mid, field, size: [bx - ax, by - ay] };
        for (let x = 74; x < 79; x++) for (let z = 138; z < 143; z++) w0.set(x, top + 1, z, 0);
        w0.updateDirty();
        return out;
      });
      t.ok(P.north > 0.15 && P.south > 0.15 && P.west > 0.15 && P.east > 0.15, `an outline on each drawn edge of a slab (dark share of the edge bands: N ${P.north.toFixed(2)} S ${P.south.toFixed(2)} W ${P.west.toFixed(2)} E ${P.east.toFixed(2)})`);
      t.ok(P.field < P.north * 0.6, `none between two grass blocks of a flat field (field ${P.field.toFixed(2)} vs edge ${P.north.toFixed(2)})`);
      const far = await page.evaluate(async () => {
        const g = window.pokecraft, THREE = await import('three'), r = g.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, w0 = g.world;
        // a pile of stone 76 from the middle (80, 80): (80, 4) is the south... north edge of the map; the page below is at y 4, so build up from there
        const cx = 80, cz = 5;
        for (let x = cx - 2; x <= cx + 2; x++) for (let y = 5; y <= 9; y++) w0.set(x, y, cz, 3);
        w0.updateDirty();
        const cam = g.camera; cam.position.set(cx + 0.5, 7.5, cz + 6); cam.lookAt(cx + 0.5, 7.5, cz); cam.updateMatrixWorld();
        g.scene.fog.near = 1000; g.scene.fog.far = 2000;
        r.render(g.scene, cam); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
        let sum = 0, n = 0; for (let y = H * 0.4; y < H * 0.6; y++) for (let x = W * 0.45; x < W * 0.55; x++) { const i = (Math.floor(y) * W + Math.floor(x)) * 4; sum += (b[i] + b[i + 1] + b[i + 2]) / 3; n++; }
        for (let x = cx - 2; x <= cx + 2; x++) for (let y = 5; y <= 9; y++) w0.set(x, y, cz, 0);
        w0.updateDirty();
        return { mean: sum / n, dist: Math.hypot(cx - 80, cz - 80) };
      });
      t.ok(far.dist > 70 && far.mean > 215, `a block ${far.dist.toFixed(0)} from the middle is mostly paper (mean grey ${far.mean.toFixed(0)} of 255)`);
      // a battle there: ally and foe are patched
      await page.evaluate(() => { const g = window.pokecraft; g.camera.fov = 75; g.camera.updateProjectionMatrix(); const p = g.player; window.__at(p.pos.x, p.pos.y, p.pos.z, 0, 0); g.scene.fog.near = 18; g.scene.fog.far = 66; });
      await page.evaluate(async () => {
        const g = window.pokecraft, S = await import('/src/species.js'), p = g.player.pos;
        g.party = [S.makeCreature('thunderwolf', 20)];
        const wild = g.creatures.spawnAt('nibling', Math.floor(p.x) + 3, Math.floor(p.y), Math.floor(p.z));
        wild.data.hp = 1;
        g.inBattle = true; document.body.classList.add('in-battle'); document.getElementById('pause').classList.add('hidden');
        g.battle.start({ wild });
      });
      await waitFor(page, () => window.pokecraft.battle.allyModel && window.pokecraft.battle.foeModel, null, 60000);
      const B = await page.evaluate(() => {
        const g = window.pokecraft, b = g.battle;
        const cnt = m => { let a = 0, c = 0; m?.traverse(o => { if (o.isMesh && !o.userData.keepColour) { if (o.material.userData.sketched) a++; else c++; } }); return [a, c]; };
        return { ally: cnt(b.allyModel), foe: cnt(b.foeModel), inBattle: g.inBattle };
      });
      t.ok(B.inBattle && B.ally[0] > 3 && B.ally[1] === 0 && B.foe[0] > 3 && B.foe[1] === 0, `in a battle there the ally and the foe are drawn in pencil (${JSON.stringify(B)})`);
      await page.evaluate(() => { const g = window.pokecraft; g.battle.end?.(); });
      t.ok(page.errors.length === 0, `no page errors in the look checks (${page.errors.slice(0, 2).join(' | ')})`);
      await page.reload();
      await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
      if (ONLY === 'look') return;
      await newGame(page, 0);
      await toasts(page);
      await intoDoodle(page);
      await toasts(page);
    }

    /* ================================ G. play ================================ */
    if (want('play')) {
      const mid = await page.evaluate(() => { const g = window.pokecraft; g.battle.end?.(); return { inBattle: g.inBattle }; });
      // Draw! on pad 1
      const s1 = await stand(page, 0);
      const near = await page.evaluate(() => { const g = window.pokecraft, L = window.__live(); return { word: g.gymLive.near(g.player), onTwo: (() => { const s = g.world.doodle.pads[1].stand; const keep = g.player.pos.toArray(); window.__at(s[0], s[1], s[2]); const w = g.gymLive.near(g.player); window.__at(...keep); return w; })(), chip: document.getElementById('score-chip')?.textContent }; });
      t.ok(near.word === 'Draw!' && near.onTwo === 'Draw!', `on a star pad the big button says Draw! (${near.word})`);
      const guide = await page.evaluate(() => { const g = window.pokecraft; g.updateGuide?.(); const a = g.realms.aim(g.player); return a ? a.text('↑', 12) : null; });
      t.ok(/Line 1 of 8/.test(guide || ''), `the guide points at the next pad ("${guide}")`);
      // a later pad: "Draw the line before this one first!"
      await page.evaluate(() => { const g = window.pokecraft, s = g.world.doodle.pads[3].stand; window.__at(s[0], s[1], s[2]); const L = window.__live(); L.manual = true; window.__lastUse = L.use(g.player); });
      t.ok(await said(page, /Draw the line before this one first/) && !(await page.evaluate(() => window.__live().cur)), 'a later pad says to draw the line before it first, and nothing starts');
      // line 1 drawn while walking on it with real Player physics (60 and 20 steps a second): the pencil draws where you look
      const real = [];
      for (const dt of [1 / 60, 0.05]) {
        real.push(await page.evaluate(dt => {
          const r = window.__drawReal(1, dt), L = window.__live(), p = window.pokecraft.player;
          const t1 = L.courseOf(0).target, w = window.__walk([[(t1[0] + t1[1] + 1) / 2, t1[2] - 3]], 400, dt); // and on along your line onto the page
          const out = { ...r, z: w.z, y: w.y, under: window.pokecraft.world.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z)) };
          if (r?.done && dt < 0.05) { L.drawnNow.delete(0); window.pokecraft.beaten = window.pokecraft.beaten.filter(k => k !== 'pw:doodle:line1'); }
          return out;
        }, dt));
      }
      for (const [i, r] of real.entries()) t.ok(r && r.done && r.setbacks === 0 && r.z < 131 && r.z > 109 && r.x > 109 && r.y > 15.9 && r.under === 1 && r.minY > 14.5, `line 1 at ${i ? 20 : 60} steps a second: Draw! starts, you walk on your own line as the pencil draws it and reach Sketch Meadow (${r?.steps} steps, at ${r?.x.toFixed(1)}, ${r?.z.toFixed(1)}, lowest y ${r?.minY.toFixed(1)}, ${r?.setbacks} setbacks)`);
      const ink = await page.evaluate(() => { const g = window.pokecraft, L = window.__live(); return { keep: L.keepInk.size, ink: [...L.keepInk].filter(k => g.world.get(...k.split(',').map(Number)) === 246).length, edits: g.world.edits.size, saved: g.beaten.includes('pw:doodle:line1'), toast: window.__toasts.filter(m => /You drew a bridge/.test(m)).length, neat: window.__toasts.some(m => /Neat line/.test(m)), chip: document.getElementById('score-chip')?.textContent }; });
      t.ok(ink.keep > 20 && ink.ink === ink.keep && ink.saved && ink.edits === 0, `your line stays ink (${ink.ink} cells), nothing is an edit, the key pw:doodle:line1 is saved`);
      t.ok(ink.toast >= 1 && ink.neat && /Lines 1 \/ 8/.test(ink.chip || ''), `"You drew a bridge! 1 / 8", "Neat line!" without a setback, the score chip says ${ink.chip}`);
      // careless on line 2 (real physics): looking straight at the House page the pencil stops at the ink blot, you walk off its end
      // and are puffed back to the pad; the try goes on
      const care = await page.evaluate(() => {
        const g = window.pokecraft; window.__toasts.length = 0;
        const L0 = window.__live(), t0 = L0.courseOf(1).target, r = window.__drawReal(2, 0.05, { max: 160, route: [[(t0[0] + t0[1] + 1) / 2, (t0[2] + t0[3] + 1) / 2]], close: -1 });
        const L = window.__live(), out = { ...r, toasts: window.__toasts.slice(), chip: document.getElementById('score-chip')?.textContent };
        L.stop(true); return out;
      });
      t.ok(!care.done && care.info.blocked === 'blot' && care.toasts.some(m => /Ink blot/.test(m)) && /Ink ▮/.test(care.chip || ''), `careless on line 2: looking straight at the page the pencil stops at the ink blot and the line goes nowhere (your line is sticky, you stay on it: ${care.setbacks} setbacks; "${care.toasts.slice(0, 3).join('" "')}"; chip "${care.chip}")`);
      // a skilled real-physics player steers round it, through the star
      const r2 = await page.evaluate(() => window.__drawReal(2, 0.05));
      t.ok(r2 && r2.done && r2.info.drawn[1], `steering round the blot (real physics) draws line 2 (${r2?.steps} steps, ${r2?.setbacks} setbacks ${JSON.stringify(r2?.backs)})`);
      // the ink never turns solid inside the player: stand in a cell of line 2, start it, and the cell waits
      const wait = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live(), cs = L.inkableOf(3), c = cs[5]; // line 4: not drawn yet
        g.world.edits.size; // (not edited)
        const edits = g.world.edits.size;
        window.__at(c.x + 0.5, c.y + 1, c.z + 0.5); // in the air above the cell: standing ON an air cell is the same as being inside it once it turns solid
        g.player.pos.y = c.y + 0.4; // inside the future ink cell
        L.cells.want(c.x, c.y, c.z, 246);
        const waiting = L.cells.waiting.size, solid = g.world.get(c.x, c.y, c.z) === 246;
        g.player.pos.y = c.y + 1.2; L.cells.flush();
        return { waiting, solid, after: g.world.get(c.x, c.y, c.z) === 246, edits, editsAfter: g.world.edits.size };
      });
      t.ok(wait.waiting === 1 && !wait.solid && wait.after && wait.edits === wait.editsAfter, 'ink never turns solid inside the player (it waits until you step off) and is no edit');
      // falling while not drawing: step off the Meadow's south edge (no line there) onto the blank page: puffed up to the next pad
      const fell = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live();
        L.manual = true; window.__toasts.length = 0;
        window.__at(g.world.doodle.pages.meadow.x1 + 2.5, 16, 120.5, -Math.PI / 2, 0); // in the air beside the Meadow's east side: no line there
        let n = 0, low = 99; for (; n < 400; n++) { g.player.update(0.05); L.step(0.05); const p = g.player.pos; low = Math.min(low, p.y); if (low < 6 && p.y > 12) break; }
        const p = g.player.pos, pad = g.world.doodle.pads[L.state().next].stand;
        return { n, x: p.x, y: p.y, z: p.z, pad, near: Math.hypot(p.x - pad[0], p.z - pad[2]) < 2, toast: window.__toasts.some(m => /Whoops/.test(m)) };
      });
      t.ok(fell.near && fell.toast, `falling off the page lands on the blank page and puffs you back up to the next pad (${fell.x.toFixed(1)}, ${fell.y.toFixed(1)}, ${fell.z.toFixed(1)}: "Whoops!")`);
      // the pause: nothing happens while a panel is open
      const pz = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live(); window.__at(...g.world.doodle.pads[2].stand); L.manual = true;
        L.use(g.player); const before = L.cur.st.s; L.playing = () => false;
        for (let i = 0; i < 30; i++) L.step(0.05, L.aimNow());
        const still = L.cur.st.s === before; L.playing = () => true; L.stop(); return { still };
      });
      t.ok(pz.still, 'the pencil stands still while the game is paused');
      // saved lines are drawn again after a reload of the realm (a fresh part)
      await page.evaluate(() => { const g = window.pokecraft; g.beaten = g.beaten.filter(k => !/^pw:doodle/.test(k)); });
      // lines 1-3 saved: re-enter the realm: they are drawn at once
      const keep = await page.evaluate(async () => {
        const g = window.pokecraft; g.beaten.push('pw:doodle:line1', 'pw:doodle:line2', 'pw:doodle:line3');
        await g.realms.leave('door', { via: 'doodle' });
        return true;
      });
      await placeIs(page, 'swirl');
      await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'doodle'), p = g.player; p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 }); const c = f.cloth[6]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: 144 }); });
      await placeIs(page, 'doodle');
      await helpers(page);
      await toasts(page);
      const reload = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live(), st = L.state();
        const drawn = [0, 1, 2].map(i => L.inkableOf(i).every(c => g.world.get(c.x, c.y, c.z) === 246)), notDrawn = L.inkableOf(3).every(c => g.world.get(c.x, c.y, c.z) !== 246);
        return { drawn, notDrawn, count: st.count, chip: document.getElementById('score-chip')?.textContent };
      });
      t.ok(reload.drawn.every(Boolean) && reload.notDrawn && reload.count === 3, `a new visit draws the saved lines at once (${reload.drawn}) and leaves the rest (${reload.chip})`);
      // the gate before all 8
      const gate = await page.evaluate(() => { const g = window.pokecraft, def = window.__bossDef ??= null; return null; });
      const gateText = await page.evaluate(async () => { const B = await import('/src/pictureboss.js'); return B.bossOf('doodle').gate(window.pokecraft); });
      t.ok(/Draw all the lines to reach me first! \(✏️ 3 \/ 8\)/.test(gateText), `Arlo's gate words: "${gateText}"`);
      // the bee line and the spiral round the tower (a model player on the drawn line, the real live part)
      const more = await page.evaluate(() => [4, 5].map(n => { const r = window.__draw(n, 0.05); return { n, done: r.done, back: r.info.last?.setbacks, waits: r.log.waits, nib: r.log.nibbles, stars: r.log.stars, drawn: r.info.drawn.filter(Boolean).length, pts: r.pts }; }));
      t.ok(more.every(m => m.done && m.back === 0) && more[1].drawn === 5 && more[1].stars === 4, `line 4: wait for the bee, then go (${more[0].waits} steps waited, ${more[0].nib} nibbles); line 5: a spiral drawn twice round the tower through 4 stars (${more.map(m => m.drawn)})`);
      await page.evaluate(pts => { window.__spiral = pts; }, more[1].pts);
      const deck = await page.evaluate(() => {
        const g = window.pokecraft, D = g.world.doodle.tower;
        window.__at(...g.world.doodle.pads[4].stand);
        const r = window.__walk(window.__spiral.filter((c, i) => i % 2 === 0).map(p => [p[0], p[2]]), 6000);
        return { ...r, onDeck: Math.abs(g.player.pos.y - (D.deckY + 1)) < 1.5 };
      });
      t.ok(deck.onDeck, `walking up your own spiral (real physics) reaches the tower deck (y ${deck.y.toFixed(1)})`);
      // Eraser Hill: stop for a while and Rubber catches you (back to the star, he giggles); keep moving and he never does
      const race = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live(); window.__toasts.length = 0;
        const lazy = window.__draw(6, 0.05, { bot: 'lazy', lazy: 6 });
        const rub = window.__toasts.some(m => /Rubber rubbed it out/.test(m));
        const done = lazy.done, backs = lazy.log.backs;
        // the rematch way: draw line 6 again from its pad, moving all the time
        L.drawnNow.delete(5); g.beaten = g.beaten.filter(k => k !== 'pw:doodle:line6');
        const r = window.__drawReal(6, 0.05); // with real Player physics: steering, walking, wind and Rubber
        return { rub, done, backs, perfect: r.done, back: r.info.last?.setbacks, steps: r.steps, steer: r.steer };
      });
      t.ok(race.backs.some(b => b[0] === 'caught') && race.rub && race.done, `on the Eraser Hill a player who stops is caught by Rubber ("Hee hee!", back to the star) and still draws the line after (${JSON.stringify(race.backs)})`);
      t.ok(race.perfect && race.back === 0, `with real physics a player who keeps moving (and steers into the wind) draws race line 6 without Rubber catching them (${race.steps} steps = ${(race.steps * 0.05).toFixed(1)} s, steering ${race.steer} of them)`);
      const last = await page.evaluate(() => { const L = window.__live(); window.__draw(7, 0.05); const r = window.__draw(8, 0.05); return { seven: L.state().drawn[6], eight: r.done }; });
      t.ok(last.seven && last.eight, 'lines 7 (two bees) and 8 (wind, a bee) are drawn');
      const all = await page.evaluate(async () => { const g = window.pokecraft, B = await import('/src/pictureboss.js'); return { gate: B.bossOf('doodle').gate(g), chip: document.getElementById('score-chip')?.textContent, done: window.__live().state().done }; });
      t.ok(all.gate === null && all.done && /To the Desk/.test(all.chip || ''), `all 8 lines: Arlo's gate opens, the chip says "${all.chip}"`);
      // crew battles are optional (never a gate)
      const crew = await page.evaluate(async () => { const g = window.pokecraft, B = await import('/src/pictureboss.js'); return { names: B.bossOf('doodle').crew.map(c => c.name), gateOpen: B.bossOf('doodle').gate(g) === null, keyFmt: B.crewKey('doodle', 0) }; });
      t.ok(crew.names.join() === 'Tracey,Charlie Charcoal' && crew.gateOpen && crew.keyFmt === 'pw:doodle:crew1', 'two optional crew (Tracey, Charlie Charcoal): the gate never needs them');
      // crew: Tracey battles once (2 cubes), then says her line; never a gate
      await page.evaluate(async () => {
        const g = window.pokecraft, S = await import('/src/species.js'), n = g.npcs.list.find(n => n.kind === 'crew' && /Tracey/.test(n.name));
        g.party = [S.makeCreature('thunderwolf', 100)]; g.cubes = 0; window.__at(n.pos.x, n.pos.y, n.pos.z + 2.5, Math.PI, 0);
        g.bosses.talk(n);
      });
      await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
      await playBattle(page);
      await waitFor(page, () => window.pokecraft.beaten.includes('pw:doodle:crew1'), null, 60000);
      const tr = await page.evaluate(() => { const g = window.pokecraft, n = g.npcs.list.find(n => /Tracey/.test(n.name)); g.bosses.talk(n); return { cubes: g.cubes, inBattle: g.inBattle }; });
      t.ok(tr.cubes === 2 && !tr.inBattle && await said(page, /Follow the dots, and keep your eyes on the tip/), `Tracey's battle gives 2 cubes once, then she says her line (${tr.cubes})`);
      // Artist Arlo: his team, losing keeps you here at a rest spot, healed, no star
      const arlo = await page.evaluate(async () => {
        const g = window.pokecraft, S = await import('/src/species.js'), n = g.npcs.list.find(n => n.kind === 'boss'), r = g.world.bosses[0].rest;
        g.party = [S.makeCreature('fluffin', 2)];
        window.__at(r[0], r[1], r[2], Math.atan2(-(n.pos.x - r[0]), -(n.pos.z - r[2])), 0);
        const out = { name: n.name, team: n.def.team.map(t => `${t[0]}${t[1]}`).join(), top: Math.max(...n.def.team.map(t => t[1])), prompt: g.bosses.talkPrompt(n) };
        g.bosses.talk(n);
        return out;
      });
      t.ok(arlo.name === 'Artist Arlo' && arlo.top === 63 && arlo.team === 'notquite60,rubbadub61,graphitan62,outlynx63' && arlo.prompt?.action === 'Challenge!', `Artist Arlo's team ${arlo.team}, top level ${arlo.top}`);
      await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 60000);
      await shot(page, 'battle');
      await playBattle(page);
      await waitFor(page, () => !window.pokecraft.inBattle, null, 60000);
      const lost = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos, b = g.world.bosses[0]; return { place: g.place, d: Math.hypot(p.x - b.rest[0], p.z - b.rest[2]), hp: g.party.every(c => c.hp > 0), stars: g.stars.includes('doodle') }; });
      t.ok(lost.place === 'doodle' && lost.d < 14 && lost.hp && !lost.stars, `losing to Arlo keeps you in the Sketchbook at a rest spot, healed, no star (${lost.d.toFixed(1)} from his rest)`);
      // win: the star, the Wizard's note, lines 6-8 cleared and 1-5 kept
      await page.evaluate(async () => {
        const g = window.pokecraft, S = await import('/src/species.js'), n = g.npcs.list.find(n => n.kind === 'boss'), r = g.world.bosses[0].rest;
        g.party = [S.makeCreature('thunderwolf', 100)]; g.cubes = 0; window.__at(r[0], r[1], r[2], Math.atan2(-(n.pos.x - r[0]), -(n.pos.z - r[2])), 0);
        g.bosses.talk(n);
      });
      await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
      await playBattle(page);
      await waitFor(page, () => window.pokecraft.stars.includes('doodle'), null, 60000);
      const won = await page.evaluate(() => {
        const g = window.pokecraft, k = n => g.beaten.includes(`pw:doodle:line${n}`);
        return { note: document.querySelector('#celebrate .big')?.textContent, small: document.querySelector('#celebrate .small')?.textContent || document.querySelector('#celebrate')?.textContent, cubes: g.cubes, kept: [1, 2, 3, 4, 5].every(k), cleared: ![6, 7, 8].some(k), drawnNow: [...window.__live().drawnNow].length, gate: window.__live().state().count };
      });
      t.ok(/Sketchbook star/.test(won.note || '') && /My first sketchbook/.test(won.small || '') && won.cubes >= 10, `the star, the Wizard's note and cubes (${won.note})`);
      t.ok(won.kept && won.cleared && won.gate === 5, `a won battle clears lines 6-8 (a rematch is a new race) and keeps 1-5 (${won.gate} / 8 drawn)`);
      // the rematch: the gate wants lines 6-8 again; draw them, then the rematch is offered
      const gate2 = await page.evaluate(async () => { const g = window.pokecraft, B = await import('/src/pictureboss.js'); const n = g.npcs.list.find(n => n.kind === 'boss'); g.bosses.talk(n); return { gate: B.bossOf('doodle').gate(g), asking: g.ui.asking }; });
      t.ok(/\(✏️ 5 \/ 8\)/.test(gate2.gate || '') && !gate2.asking, `the rematch waits for the Eraser Hill lines (${gate2.gate})`);
      await page.evaluate(() => { for (const n of [6, 7, 8]) window.__draw(n, 0.05); });
      await page.evaluate(async () => {
        const g = window.pokecraft, n = g.npcs.list.find(n => n.kind === 'boss'), r = g.world.bosses[0].rest;
        window.__at(r[0], r[1], r[2], Math.atan2(-(n.pos.x - r[0]), -(n.pos.z - r[2])), 0); g.bosses.talk(n);
      });
      const ask = await page.evaluate(() => ({ asking: window.pokecraft.ui.asking, text: document.getElementById('ask-text')?.textContent }));
      t.ok(ask.asking && /rematch/i.test(ask.text || ''), `with all 8 lines drawn again Arlo offers a rematch ("${ask.text}")`);
      await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('thunderwolf', 100), S.makeCreature('thunderwolf', 100)]; g.ui.askYes(); });
      await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
      await playBattle(page);
      await waitFor(page, () => !window.pokecraft.inBattle, null, 60000);
      const rem = await page.evaluate(() => ({ wins: window.pokecraft.bossWins.doodle, six: window.pokecraft.beaten.includes('pw:doodle:line6') }));
      t.ok(rem.wins === 1 && !rem.six, `a rematch win counts (${rem.wins}) and clears the race lines again`);
      // both ways back lead to the Swirl in front of the Sketchbook frame
      for (const key of ['doodle', 'doodle-desk']) {
        const back = await page.evaluate(async key => {
          const g = window.pokecraft, D = g.world.doors.find(d => d.key === key), s = D.stand;
          window.__at(s[0], s[1], s[2], s[3], 0);
          const blk = { x: D.surface[1][0], y: D.surface[1][1], z: D.surface[1][2], id: g.world.get(...D.surface[1]) };
          return { prompt: g.portal.prompt(blk, 'click or E'), used: g.portal.use(blk) };
        }, key);
        await placeIs(page, 'swirl');
        const out = await page.evaluate(async () => {
          const g = window.pokecraft, SL = await import('/src/swirlland.js'), at = SL.frameReturn('doodle'), p = g.player.pos;
          return { d: Math.hypot(p.x - at[0], p.z - at[2]), y: Math.abs(p.y - at[1]) };
        });
        t.ok(back.used && out.d < 1.6 && out.y < 1.2, `the way back "${key}" (${back.prompt}) leads out in front of the Sketchbook frame (${out.d.toFixed(2)} away)`);
        if (key === 'doodle') { // and in again for the second door
          await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'doodle'), c = f.cloth[6]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: 144 }); });
          await placeIs(page, 'doodle'); await helpers(page);
        }
      }
      t.ok(page.errors.length === 0, `no page errors in play (${page.errors.slice(0, 2).join(' | ')})`);
    }
  }
  if (!ONLY) { await ipadPart({ browser, base, t }); await pairPart({ browser, base, t }); await shotsPart({ browser, base, t }); }
}


/* ================================ H. iPad ================================ */
async function ipadPart({ browser, base, t }) {
  const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await newGame(ip, 0);
  const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  await intoDoodle(ip);
  await toasts(ip);
  await ip.evaluate(() => { const L = window.__live(); L.playing = () => window.pokecraft.started && document.getElementById('pause').classList.contains('hidden'); });
  const s = await stand(ip, 0);
  await ip.evaluate(() => { const p = window.pokecraft.player; p.pitch = -0.15; document.getElementById('pause').classList.add('hidden'); });
  await waitFor(ip, () => /Draw/.test(document.getElementById('btn-act')?.textContent || ''), null, 60000);
  const label = await ip.evaluate(() => document.getElementById('btn-act').textContent);
  const count = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  t.ok(/Draw!/.test(label) && count === before, `iPad: on a star pad the big button says "${label}" and the number of touch buttons is unchanged (${before})`);
  const chip = await ip.evaluate(() => { const c = document.getElementById('score-chip'), r = c.getBoundingClientRect(), v = { w: innerWidth, h: innerHeight }; return { text: c.textContent, inside: r.right <= v.w && r.left >= 0 && r.top >= 0 && r.bottom <= v.h, hidden: c.classList.contains('hidden') }; });
  t.ok(!chip.hidden && chip.inside && /Lines 0 \/ 8/.test(chip.text), `iPad: the score chip "${chip.text}" fits on the screen`);
  // a real tap on the big button starts the line
  const box = await ip.evaluate(() => { const r = document.getElementById('btn-act').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await ip.touchscreen.tap(box.x, box.y);
  await waitFor(ip, () => window.__live().info().drawing, null, 30000);
  await waitFor(ip, () => /Stop/.test(document.getElementById('btn-act')?.textContent || ''), null, 30000).catch(() => {});
  const word = await ip.evaluate(() => document.getElementById('btn-act').textContent);
  t.ok(/Stop/.test(word), `iPad: a tap on the big button starts the pencil; it now says "${word}"`);
  // real touches: one finger holds the joystick forward (you walk on your line), another drags the view (the pencil draws where you look)
  const cdp = await ip.context().newCDPSession(ip);
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const joy = await ip.evaluate(() => { const r = document.getElementById('joystick').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const J = [joy[0], joy[1] - 60, 1]; // pushed forward, not all the way (a walk)
  const look = () => ip.evaluate(() => { const p = window.pokecraft.player; return [p.yaw, p.pitch]; });
  const drag = async (dx, dy, hold) => { const x0 = 620, y0 = 330, base = hold ? [J] : []; await send(hold ? 'touchMove' : 'touchStart', [...base, [x0, y0, 5]]); if (hold) await send('touchStart', [...base, [x0, y0, 5]]); for (let i = 1; i <= 4; i++) await send('touchMove', [...base, [x0 + dx * i / 4, y0 + dy * i / 4, 5]]); await send('touchEnd', base); };
  const a = await look(); await drag(80, 0, false); await ip.waitForTimeout(300); const b = await look();
  const kx = (b[0] - a[0]) / 80;
  t.ok(Math.abs(kx) > 1e-4, `iPad: a real drag turns the view (${kx.toFixed(4)} rad per px)`);
  // face along line 1 and look a little down the line, then hold the joystick
  const start = await ip.evaluate(() => { const g = window.pokecraft, p = g.player; const L = window.__live(), h = L.cur.st.tip.h; p.yaw = Math.atan2(-Math.cos(h), -Math.sin(h)); p.pitch = -0.32; return { x: p.pos.x, z: p.pos.z, h, s: L.cur.st.s }; }); // face along the line
  await send('touchStart', [J]);
  const rounds = [];
  for (let i = 0; i < 30; i++) {
    await ip.waitForTimeout(400);
    const r = await ip.evaluate(() => { const L = window.__live(), p = window.pokecraft.player, c = L.cur; return { s: c ? c.st.s : -1, x: p.pos.x, z: p.pos.z, y: p.pos.y, h: c ? c.st.tip.h : null, back: c ? c.st.setbacks : -1, done: !c }; });
    rounds.push(r);
    if (r.done || (r.s > 8 && Math.hypot(r.x - start.x, r.z - start.z) > 2)) break;
  }
  const mid = rounds[rounds.length - 1];
  // a drag to the right while walking: the pencil turns right (west to east is +x: heading grows toward 0 from -pi/2)
  await drag(-110, 0, true);
  for (let i = 0; i < 4; i++) await ip.waitForTimeout(350);
  const end = await ip.evaluate(() => { const L = window.__live(), p = window.pokecraft.player, c = L.cur; return { s: c ? c.st.s : -1, z: p.pos.z, y: p.pos.y, h: c ? c.st.tip.h : null, back: c ? c.st.setbacks : -1, drawing: !!c, chip: document.getElementById('score-chip')?.textContent }; });
  await send('touchEnd', []);
  t.ok(mid.s > 3 && Math.hypot(mid.x - start.x, mid.z - start.z) > 1 && mid.y > 14.5 && mid.back === 0, `iPad: holding the joystick you walk on your own line while the pencil draws it (${mid.s.toFixed(1)} blocks drawn, walked ${Math.hypot(mid.x - start.x, mid.z - start.z).toFixed(1)}, y ${mid.y.toFixed(1)})`);
  t.ok(end.h != null && Math.abs(end.h - start.h) > 0.15 && /Ink ▮/.test(end.chip || ''), `iPad: a drag of the view while walking steers the pencil (heading ${start.h.toFixed(2)} -> ${end.h?.toFixed(2)}), the chip shows the ink "${end.chip}"`);
  await ip.evaluate(() => { const L = window.__live(), p = window.pokecraft.player, t = L.cur?.st.tip; if (t) p.lookAt({ x: t.x, y: t.row + 0.6, z: t.z }); });
  await shot(ip, 'ipad');
  t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
  await ip.context().close();
}

/* ================================ I. two browsers ================================ */
async function pairPart({ browser, base, t }) {
  const [A, Bp] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(Bp, 1); await pause(Bp);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await A.click('#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await Bp.fill('#mp input[placeholder="Your name"]', 'Kid');
  await Bp.fill('#mp .mp-code-input', code);
  await Bp.click('#mp button:has-text("Join a world")');
  await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000);
  await toasts(Bp); await toasts(A);
  for (const pg of [A, Bp]) await pg.evaluate(() => { window.pokecraft.champion = true; });
  await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
  await placeIs(A, 'swirl');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'swirl');
  const cell = await A.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'doodle'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(A, 'doodle');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
  const ask = await Bp.evaluate(() => document.getElementById('ask-text').textContent);
  t.ok(/Dad stepped into the Sketchbook\. Go too\?/.test(ask), `Kid is asked to follow Dad into the Sketchbook ("${ask}")`);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'doodle');
  await helpers(A); await helpers(Bp);
  const k = await Bp.evaluate(() => { const g = window.pokecraft; return { via: g.realms.via, guest: g.realms.stash.guest, live: !!g.gymLive.of('part:doodle'), on: g.sketch.on, lines: g.world.doodle.lines.length }; });
  t.ok(k.via === 'doodle' && k.guest && k.live && k.on && k.lines === 8, 'Kid is in the Sketchbook with its own pencil, in the pencil look');
  const ons = await A.evaluate(() => window.pokecraft.sketch.on);
  t.ok(ons, 'Dad sees the pencil look too');
  // Dad draws line 1; Kid's world is unchanged, Kid's save has no line; Kid draws their own
  await stand(A, 0); await stand(Bp, 0);
  const d = await A.evaluate(() => window.__draw(1, 0.05));
  const kid0 = await Bp.evaluate(() => { const g = window.pokecraft, L = window.__live(); return { has: g.beaten.includes('pw:doodle:line1'), ink: L.inkableOf(0).filter(c => g.world.get(c.x, c.y, c.z) === 246).length }; });
  t.ok(d.info.drawn[0] && !kid0.has && kid0.ink === 0, `Dad's line is drawn for Dad only (Kid: key ${kid0.has}, ${kid0.ink} ink cells)`);
  const kd = await Bp.evaluate(() => window.__draw(1, 0.05));
  const dad = await A.evaluate(() => window.pokecraft.beaten.filter(k => /^pw:doodle/.test(k)));
  const kid = await Bp.evaluate(() => window.pokecraft.beaten.filter(k => /^pw:doodle/.test(k)));
  t.ok(kd.info.drawn[0] && kid.join() === 'pw:doodle:line1' && dad.join() === 'pw:doodle:line1', `Kid draws their own line 1: each save holds only its own key (${dad} / ${kid})`);
  t.ok(!A.errors.length && !Bp.errors.length, `no page errors (two browsers) ${A.errors.concat(Bp.errors).join('; ')}`);
  await A.context().close(); await Bp.context().close();
}

/* ================================ J. screenshots ================================ */
async function shotsPart({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await page.evaluate(() => { const g = window.pokecraft; g.fx.hold = 0.5; });
  // the seven in a row: our world (colour) and the Sketchbook (pencil)
  const row = async (name, wait) => {
    await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js'), K = await import('/src/sketch.js'), p = g.player;
      window.__row?.forEach(m => { g.scene.remove(m); S.disposeModel(m); });
      const ids = ['nibling', 'graphitan', 'rubbit', 'rubbadub', 'sketchkit', 'outlynx', 'notquite'];
      const fy = p.pos.y;
      window.__row = ids.map((id, i) => { const m = S.buildModel(id); K.sketchModel(m); m.position.set(p.pos.x - 4.2 + i * 1.4, fy, p.pos.z - 4.5); m.rotation.y = 0; g.scene.add(m); S.animateModel(m, 1 + i * 0.3, false); return m; });
      p.yaw = 0; p.pitch = -0.1;
    });
    await shot(page, name, null, wait);
  };
  await row('creatures-color', 800);
  await intoDoodle(page);
  await toasts(page);
  await page.evaluate(() => { window.pokecraft.sketch.hold = true; window.pokecraft.fx.hold = 0.5; });
  await shot(page, 'arrival', [80.5, 15, 146.5, 0, -0.12]);
  await page.evaluate(() => { const g = window.pokecraft, p = g.player; p.pos.set(84.5, 15, 137.5); p.lookAt({ x: 112, y: 14.5, z: 137 }); }); // the dotted way of line 1 and the landing strip
  await shot(page, 'dotted-line', null, 800);
  await shot(page, 'edge', [80.5, 15, 143.5, 0.6, -0.05]);
  await page.evaluate(() => { const g = window.pokecraft; window.__at(80.5, 15, 140.5, 0, -0.1); });
  await row('creatures', 800);
  await page.evaluate(() => { const g = window.pokecraft; window.__row?.forEach(m => g.scene.remove(m)); });
  // a line being drawn (stopped half way): the pencil, your line, the star dot, the aim ring
  const half = (n, steps, look) => page.evaluate(([n, steps, look]) => {
    const g = window.pokecraft, L = window.__live(); L.manual = true;
    const s = g.world.doodle.pads[n - 1].stand; window.__at(s[0], s[1], s[2]);
    L.use(g.player);
    const st = L.cur.st, B = new window.__DC.DrawBot(L.cur.course);
    for (let i = 0; i < steps && L.cur; i++) { const inp = B.input(st, 0.05); g.player.pos.set(...inp.player); g.player.vel.set(0, 0, 0); L.step(0.05, inp); B.after(st); }
    if (look) { const p = g.player; p.pos.set(look[0], look[1], look[2]); p.vel.set(0, 0, 0); p.lookAt({ x: look[3], y: look[4], z: look[5] }); }
    else { const p = g.player, t = st.tip, q = window.__DC.pointAt(st, Math.max(0, st.s - 6)); p.pos.set(q[0], q[1] + 2.2, q[2]); p.vel.set(0, 0, 0); p.lookAt({ x: t.x + Math.cos(t.h) * 3, y: t.row + 1, z: t.z + Math.sin(t.h) * 3 }); }
    L.stepMeshes(g.player);
    return L.info();
  }, [n, steps, look]);
  await half(1, 22);
  await shot(page, 'meadow', null, 800);
  await page.evaluate(() => window.__live().stop(true));
  // line 4: the bee, the ink blot and the star over the gap
  await page.evaluate(() => window.__live().drawUpTo(3));
  await half(4, 60, [74.5, 22, 33.5, 55, 20, 62]);
  await shot(page, 'bee', null, 800);
  await page.evaluate(() => window.__live().stop(true));
  // the Curly Tower: your spiral half way up
  await page.evaluate(() => window.__live().drawUpTo(4));
  await half(5, 160, [37.5, 22, 95.5, 24, 30, 80]);
  await shot(page, 'tower', null, 800);
  await page.evaluate(() => window.__live().stop(true));
  // the Eraser Hill: Rubber coming along your line
  await page.evaluate(() => window.__live().drawUpTo(5));
  const er = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(); L.manual = true;
    const s = g.world.doodle.pads[5].stand; window.__at(s[0], s[1], s[2]); L.use(g.player);
    const st = L.cur.st, B = new window.__DC.DrawBot(L.cur.course, { bot: 'lazy', lazy: 99 });
    for (let i = 0; i < 160 && L.cur && !(st.rubber.on && st.rubber.s > 2); i++) { const inp = B.input(st, 0.05); g.player.pos.set(...inp.player); g.player.vel.set(0, 0, 0); L.step(0.05, inp); B.after(st); }
    const r = window.__DC ? st.rubber : null, p = g.player;
    const q = window.__DC.pointAt(st, r.s), m = [(q[0] + st.tip.x) / 2, (q[2] + st.tip.z) / 2];
    p.pos.set(m[0] + 2, st.tip.row + 6, m[1] + 9); p.vel.set(0, 0, 0); p.lookAt({ x: m[0], y: q[1] + 1, z: m[1] });
    L.stepMeshes(p);
    return { rubber: r && { s: r.s, on: r.on }, s: st.s };
  });
  await shot(page, 'eraser', null, 800);
  t.ok(er.rubber?.on, `screenshot: Rubber on his way along your line (${JSON.stringify(er)})`);
  await page.evaluate(() => window.__live().stop(true));
  // the Desk: Arlo
  await page.evaluate(() => { const g = window.pokecraft, L = window.__live(); L.drawUpTo(8); const n = g.npcs.list.find(n => n.kind === 'boss'), r = g.world.bosses[0].rest; window.__at(r[0], r[1], r[2], Math.atan2(-(n.pos.x - r[0]), -(n.pos.z - r[2])), -0.05); });
  await shot(page, 'desk', null, 800);
  t.ok(!page.errors.length, `no page errors (screenshots) ${page.errors.join('; ')}`);
  await page.context().close();
}
