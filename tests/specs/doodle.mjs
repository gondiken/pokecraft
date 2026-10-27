// T45: the Doodle type and the Sketchbook (plans/T45.md). A. type data. B. the pencil atlas. C. the sketch switch off = bit for bit
// (main world, Dream, Swirl, and again after a trip to the Sketchbook). D. the look in the game. E. terrain for three seeds (the walk graph
// from tests/doodlecheck.mjs). F. Trace! (pure, tracing.js). G. play: the frame, Draw!, ink, falling, saving, crew, Arlo, rematch, the ways
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
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 300000); // software WebGL compiles the pencil shader on the way in
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
const helpers = page => page.evaluate(() => {
  const g = window.pokecraft;
  window.__live = () => g.gymLive.of('part:doodle');
  const lv = window.__live();
  if (lv) lv.playing = () => true;
  window.__at = (x, y, z, yaw = 0, pitch = 0) => { const p = g.player; p.carry?.leave?.(false); p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.keys = {}; };
  // a perfect tracker: look straight at the tip from where you stand (or from `from`)
  window.__aimAt = (from, tip) => { const e = from ?? g.player.eyePos.toArray(), d = [tip[0] - e[0], tip[1] - e[1], tip[2] - e[2]], m = Math.hypot(...d); return { eye: e, dir: d.map(v => v / m) }; };
  // a perfect tracker who walks along with the tip: the eye 5 blocks behind it, looking at it
  window.__aimNear = tip => { const e = [tip[0], tip[1] + 1.2, tip[2] - 5], d = [0, tip[1] + 1.05 - e[1], 5], m = Math.hypot(...d); return { eye: e, dir: d.map(v => v / m) }; };
  window.__walk = (pts, max = 1500) => {
    const p = g.player; let i = 0, steps = 0;
    while (i < pts.length && steps < max) {
      const [x, z] = pts[i], dx = x - p.pos.x, dz = z - p.pos.z;
      if (Math.hypot(dx, dz) < 0.45) { i++; continue; }
      p.yaw = Math.atan2(-dx, -dz);
      p.keys.KeyW = true; p.keys.Space = p.hitWall;
      p.update(0.05); g.gymLive.update(0.05); steps++;
    }
    p.keys.KeyW = false; p.keys.Space = false;
    return { i, steps, x: p.pos.x, y: p.pos.y, z: p.pos.z };
  };
  // draw line n (1-based) with a perfect tracker, `dt` per step; stops after max steps; returns the info
  window.__draw = (n, dt = 0.05, max = 4000) => {
    const L = window.__live(); L.manual = true;
    const used = L.use(g.player); let i = 0;
    for (; i < max && L.cur; i++) { const tip = L.cur.line.line.at(L.cur.st.s); L.step(dt, window.__aimNear(tip)); }
    return { used, steps: i, info: L.info() };
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
  // look v2: a data atlas (R = kind x 8, G = tone, B = auto detail, A = the colour tile's alpha); the shader draws the marks.
  if (want('atlas')) {
    const B = await page.evaluate(async () => {
      const BL = await import('/src/blocks.js'), SA = await import('/src/sketchatlas.js');
      const atlas = BL.drawAtlas();
      const t0 = performance.now(); const a = SA.drawSketchAtlas(atlas); const ms = performance.now() - t0;
      const t1 = performance.now(); const a2 = SA.drawSketchAtlas(atlas); const ms2 = performance.now() - t1;
      const dat = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const col = dat(atlas), sk = dat(a), sk2 = dat(a2);
      let same = true; for (let i = 0; i < sk.length; i++) if (sk[i] !== sk2[i]) { same = false; break; }
      let alphaBad = 0; for (let i = 3; i < col.length; i += 4) if (col[i] !== sk[i]) alphaBad++;
      const at = (tt, x, y) => ((BL.tileY(tt) + y) * a.width + BL.tileX(tt) + x) * 4;
      // every opaque pixel of a tile carries the tile's kind and tone (one value per tile)
      let mixed = 0;
      for (let tt = 0; tt < BL.TILE_COUNT; tt++) {
        let r = -1, g = -1;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = at(tt, x, y); if (sk[i + 3] < 255) continue; if (r < 0) { r = sk[i]; g = sk[i + 1]; } else if (sk[i] !== r || sk[i + 1] !== g) mixed++; }
      }
      const kindOf = n => { const tt = BL.T[n]; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = at(tt, x, y); if (sk[i + 3] === 255) return sk[i] / 8; } return -1; };
      const wrong = SA.SKETCH_TILES.filter(n => BL.T[n] != null && kindOf(n) !== SA.KIND[SA.KIND_OF[n]]);
      const kinds = new Set(SA.SKETCH_TILES.filter(n => BL.T[n] != null).map(kindOf));
      const wool = kindOf('WOOL0' in BL.T ? 'WOOL0' : 'ICE') === SA.KIND.wool;
      const detail = n => { const out = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) out.push(sk[at(BL.T[n], x, y) + 2] > 128 ? 1 : 0); return out; };
      const p = detail('CHEST_SIDE'), q = detail('TROPHY_SIDE');
      let autoDiff = 0, autoInk = 0; for (let k = 0; k < 256; k++) { if (p[k] !== q[k]) autoDiff++; autoInk += p[k]; }
      const toneOf = n => sk[at(BL.T[n], 8, 8) + 1];
      // the marks texture: one cell per kind, every kind with marks has a few pencil strokes and is mostly empty
      const M = SA.drawSketchMarks(), md = dat(M), T = SA.MARK_TILE, cells = [];
      for (const [name, k] of Object.entries(SA.KIND)) {
        if (['auto', 'page', 'ink'].includes(name)) continue;
        let n = 0; const ox = (k % SA.MARK_GRID[0]) * T, oy = Math.floor(k / SA.MARK_GRID[0]) * T;
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (md[((oy + y) * M.width + ox + x) * 4 + 3] > 100) n++;
        cells.push([name, n / (T * T)]);
      }
      const badCells = cells.filter(([n, f]) => f < (n === 'snow' ? 0.0003 : 0.002) || f > 0.3).map(([n, f]) => n + ':' + f.toFixed(3));
      return { w: a.width === atlas.width, h: a.height === atlas.height, same, alphaBad, mixed, wrong, kinds: kinds.size, wool, autoDiff, autoInk, ms, ms2, cells: cells.length, badCells, dark: toneOf('COAL_ORE') < toneOf('SAND') };
    });
    t.ok(B.w && B.h, 'the pencil atlas has exactly the size of the colour atlas');
    t.ok(B.same, 'drawing it twice gives the same bytes');
    t.ok(B.alphaBad === 0, `the alpha is copied 1:1 (glass and holes stay holes; ${B.alphaBad} differ)`);
    t.ok(B.mixed === 0, `every tile carries one kind and one tone (${B.mixed} pixels differ from their tile)`);
    t.ok(B.wrong.length === 0 && B.kinds >= 28, `every named tile has its kind (${B.kinds} different kinds; wrong: ${B.wrong.join(' ')})`);
    t.ok(B.wool, 'wool tiles get the knit kind');
    t.ok(B.autoInk > 4 && B.autoDiff > 20, `auto tiles keep a little of their own detail (${B.autoInk} detail pixels, two tiles differ in ${B.autoDiff})`);
    t.ok(B.dark, 'the tone follows the colour tile (coal ore darker than sand)');
    t.ok(B.cells >= 29 && B.badCells.length === 0, `the marks texture has a few strokes for each of ${B.cells} kinds and is mostly paper (${B.badCells.join(' ')})`);
    t.ok(B.ms < 120, `drawing the atlas takes ${B.ms.toFixed(0)} ms here the first time (${B.ms2.toFixed(0)} ms the second; software rendering, once per session)`);
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

  /* ================================ F. Trace! (pure) ================================ */
  if (want('trace')) {
    const F = await page.evaluate(async () => {
      const T = await import('/src/tracing.js'), D = await import('/src/doodleland.js');
      const lines = D.doodleLines();
      const out = { problems: [], rows: [] };
      const bad = m => out.problems.push(m);
      // a tracker: aim(st, tip, t) -> { eye, dir, touch } ; dt = 1 / hz; returns the final state and time
      const run = (line, kind, hz, aim, { k = 0, wins = 0, max = 400, touch = false } = {}) => {
        const st = T.newTrace(kind, k), dt = 1 / hz; let t = 0;
        while (!st.done && t < max) { const tip = line.at(st.s); const a = aim(tip, t, st); traceStep(st, dt, { ...a, touch }, line, kind, wins); t += dt; }
        return { st, t };
      };
      const traceStep = T.traceStep;
      const perfect = (tip) => ({ eye: [tip[0], tip[1] + 1.2, tip[2] - 5], dir: [0, -1.2 / 5.15, 5 / 5.15].map((v, i, a) => v / Math.hypot(...a)) });
      const away = () => ({ eye: [0, 80, 0], dir: [0, 1, 0] });
      lines.forEach((l, i) => {
        const kind = l.kind, cfg = T.TRACE[kind];
        for (const hz of [60, 20]) {
          const r = run(l.line, kind, hz, tip => perfect([tip[0], tip[1] + 1.05, tip[2]]), { k: i - 5 });
          const want = kind === 'race' ? null : l.line.len / cfg.speed;
          if (!r.st.done) bad(`line ${l.n} at ${hz} does not finish`);
          if (want && Math.abs(r.t - want) / want > 0.02) bad(`line ${l.n} at ${hz}: ${r.t.toFixed(2)} s, wanted ${want.toFixed(2)} s`);
          if (kind === 'race' && r.st.rubbed) bad(`a perfect tracker is rubbed on line ${l.n} at ${hz}`);
          out.rows.push([l.n, hz, +r.t.toFixed(2), r.st.rubbed]);
        }
      });
      // half the time looking away still finishes (later)
      const half = run(lines[0].line, 'straight', 60, (tip, t) => (Math.floor(t) % 2 === 0 ? perfect([tip[0], tip[1] + 1.05, tip[2]]) : away()));
      if (!half.st.done || half.t < lines[0].line.len / 1.6 * 1.6) bad(`looking away half the time: ${half.t}`);
      // race: look away for 6 s right after the start: rubbed back to a star dot (or the start), and still finishes
      const race = lines[5];
      const lost = run(race.line, 'race', 60, (tip, t) => (t > 1 && t < 8 ? away() : perfect([tip[0], tip[1] + 1.05, tip[2]])), { k: 0 });
      if (lost.st.rubbed < 1 || !lost.st.done) bad(`looking away 7 s on a race line: rubbed ${lost.st.rubbed}, done ${lost.st.done}`);
      const star = race.line.stars;
      // grace: a 0.2 s glance away changes nothing
      const plain = run(lines[0].line, 'straight', 60, tip => perfect([tip[0], tip[1] + 1.05, tip[2]]));
      const glance = run(lines[0].line, 'straight', 60, (tip, t) => (t > 2 && t < 2.2 ? away() : perfect([tip[0], tip[1] + 1.05, tip[2]])));
      if (Math.abs(plain.t - glance.t) > 0.05) bad(`a 0.2 s glance changed the time: ${plain.t} vs ${glance.t}`);
      // 60 and 20 steps a second: the same within one step
      const a60 = run(lines[3].line, 'curl', 60, tip => perfect([tip[0], tip[1] + 1.05, tip[2]])), a20 = run(lines[3].line, 'curl', 20, tip => perfect([tip[0], tip[1] + 1.05, tip[2]]));
      if (Math.abs(a60.t - a20.t) > 0.06) bad(`60 vs 20 steps: ${a60.t} vs ${a20.t}`);
      // the touch ring is 1.25 x: an aim 1.7 off the tip counts only with touch (straight ring 1.5 -> 1.875)
      const off17 = (tip) => { const e = [tip[0], tip[1] + 1.05, tip[2] - 5]; const aimAt = [tip[0] + 1.7, tip[1] + 1.05, tip[2]]; const d = [aimAt[0] - e[0], aimAt[1] - e[1], aimAt[2] - e[2]], m = Math.hypot(...d); return { eye: e, dir: d.map(v => v / m) }; };
      const noTouch = run(lines[0].line, 'straight', 20, off17, { max: 12 }), withTouch = run(lines[0].line, 'straight', 20, off17, { touch: true, max: 12 });
      if (noTouch.st.s > 0.5 || withTouch.st.s < 5) bad(`touch ring: ${noTouch.st.s} without, ${withTouch.st.s} with`);
      // rematch: the eraser is faster per win, capped
      const eraserRate = wins => { const st = T.newTrace('race', 0), l = race.line; st.s = 14; st.wait = 0; const before = st.eraser; T.traceStep(st, 0.1, away(), l, 'race', wins); return (st.eraser - before) / 0.1; };
      const r0 = eraserRate(0), r3 = eraserRate(3), r99 = eraserRate(99);
      if (!(r3 > r0 && r99 <= T.TRACE.race.eraserCap + 1e-9 && r99 > r3)) bad(`eraser speed by wins: ${r0} ${r3} ${r99}`);
      out.rates = [r0, r3, r99]; out.stars = star.length;
      // the first neat line fraction
      out.neat = [plain.st.onTime / plain.st.time, half.st.onTime / half.st.time];
      return out;
    });
    t.ok(F.problems.length === 0, `Trace!: ${F.problems.length ? F.problems.join('; ') : `a perfect tracker finishes every line in len / speed (+-2%) at 60 and 20 steps a second and is never rubbed; looking away half the time or 7 s on a race line still finishes (and is rubbed back); a 0.2 s glance changes nothing; touch ring x1.25; the eraser is faster per win and capped (${F.rates.map(r => r.toFixed(2))})`}`);
    t.ok(F.neat[0] > 0.95 && F.neat[1] < 0.8, `the neat fraction: a perfect line ${F.neat[0].toFixed(2)}, half the time away ${F.neat[1].toFixed(2)}`);
    console.log('  perfect runs (line, hz, seconds, rubbed): ' + JSON.stringify(F.rows));
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
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); // a frame in the Sketchbook (the sky and fog follow it)
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
        for (let x = 82; x < 87; x++) for (let z = 138; z < 143; z++) w0.set(x, top + 1, z, 3);
        w0.updateDirty();
        const cam = g.camera; cam.position.set(84.5, top + 14, 140.5); cam.rotation.set(-Math.PI / 2, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        g.sketch.hold = true;
        g.scene.fog.near = 1000; g.scene.fog.far = 2000;
        r.render(g.scene, cam); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
        const px = (x, y) => { const i = ((H - 1 - y) * W + x) * 4; return b[i] + b[i + 1] + b[i + 2]; };
        const scr = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [Math.round((v.x * 0.5 + 0.5) * W), Math.round((1 - (v.y * 0.5 + 0.5)) * H)]; };
        const dark = (x0, y0, x1, y1) => { let n = 0, tot = 0; for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x++) { tot++; if (px(x, y) < 3 * 110) n++; } return n / Math.max(1, tot); };
        const [ax, ay] = scr(82, top + 2, 138), [bx, by] = scr(87, top + 2, 143); // the slab's top face on screen
        const edgeBand = 5;
        const north = dark(ax, ay - 2, bx, ay + edgeBand), south = dark(ax, by - edgeBand, bx, by + 2), west = dark(ax - 2, ay, ax + edgeBand, by), east = dark(bx - edgeBand, ay, bx + 2, by);
        const mid = dark(ax + 20, ay + 20, bx - 20, by - 20);
        // the field beside it: same size band between two grass blocks of the flat field
        const [fx, fy] = scr(66, top + 1, 140), [gx, gy] = scr(71, top + 1, 140);
        const field = dark(fx, fy - 40, gx, fy + 40);
        // distance: a block 76 from the middle (80, 80) is mostly paper
        const meanAt = (x, z) => 0;
        const out = { north, south, west, east, mid, field, size: [bx - ax, by - ay] };
        for (let x = 82; x < 87; x++) for (let z = 138; z < 143; z++) w0.set(x, top + 1, z, 0);
        w0.updateDirty();
        return out;
      });
      t.ok(P.north > 0.15 && P.south > 0.15 && P.west > 0.15 && P.east > 0.15, `an outline on each drawn edge of a slab (dark share of the edge bands: N ${P.north.toFixed(2)} S ${P.south.toFixed(2)} W ${P.west.toFixed(2)} E ${P.east.toFixed(2)})`);
      t.ok(P.field < P.north * 0.6, `none between two grass blocks of a flat field (field ${P.field.toFixed(2)} vs edge ${P.north.toFixed(2)})`);
      // look v2: the kinds read apart (doodled marks, not a texture): the inside of a 3 x 3 slab of each kind, seen from above
      const K = await page.evaluate(async () => {
        const g = window.pokecraft, THREE = await import('three'), { B } = await import('/src/blocks.js'), r = g.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        const w0 = g.world, top = 14, cam = g.camera, out = {};
        cam.position.set(84.5, top + 5, 140.5); cam.rotation.set(-Math.PI / 2, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        g.scene.fog.near = 1000; g.scene.fog.far = 2000;
        const masks = {};
        for (const name of ['STONE', 'PLANKS', 'BRICK', 'COBBLE', 'SAND', 'LEAVES']) {
          for (let x = 83; x < 86; x++) for (let z = 139; z < 142; z++) w0.set(x, top + 1, z, B[name]);
          w0.updateDirty();
          r.render(g.scene, cam); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
          const p0 = new THREE.Vector3(83.15, top + 2, 139.15).project(cam), p1 = new THREE.Vector3(85.85, top + 2, 141.85).project(cam);
          const sx = v => Math.round((v.x * 0.5 + 0.5) * W), sy = v => Math.round((v.y * 0.5 + 0.5) * H);
          const m = []; let dark = 0;
          for (let y = Math.min(sy(p0), sy(p1)); y < Math.max(sy(p0), sy(p1)); y += 2) for (let x = Math.min(sx(p0), sx(p1)); x < Math.max(sx(p0), sx(p1)); x += 2) { const i = (y * W + x) * 4, d = b[i] + b[i + 1] + b[i + 2] < 3 * 150 ? 1 : 0; m.push(d); dark += d; }
          masks[name] = m; out[name] = dark / m.length;
        }
        for (let x = 83; x < 86; x++) for (let z = 139; z < 142; z++) w0.set(x, top + 1, z, 0);
        w0.updateDirty();
        const names = Object.keys(masks); let worst = 1, pair = '';
        for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const a = masks[names[i]], c = masks[names[j]]; let d = 0, n = 0; for (let k = 0; k < a.length; k++) { if (a[k] !== c[k]) d++; n += a[k] + c[k]; } if (d / Math.max(1, n) < worst) { worst = d / Math.max(1, n); pair = names[i] + '/' + names[j]; } }
        out.worst = worst; out.pair = pair;
        return out;
      });
      console.log(`  kinds (dark share of a block top): ${['STONE', 'PLANKS', 'BRICK', 'COBBLE', 'SAND', 'LEAVES'].map(n => n + ' ' + K[n].toFixed(3)).join(', ')}`);
      t.ok(K.worst > 0.6 && ['STONE', 'PLANKS', 'BRICK', 'COBBLE', 'LEAVES'].every(n => K[n] > 0.003 && K[n] < 0.35), `block kinds are drawn with their own marks, mostly paper (worst pair ${K.pair} shares only ${(100 - K.worst * 100).toFixed(0)}% of its pencil marks)`);
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
      await waitFor(page, () => window.pokecraft.battle.allyModel && window.pokecraft.battle.foeModel, null, 180000);
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
      await stand(page, 0);
      // draw line 1 with a perfect tracker
      await stand(page, 0);
      const r1 = await page.evaluate(() => window.__draw(1, 0.05));
      t.ok(r1.used && !r1.info.drawing && r1.info.drawn[0], `Draw! starts, the pencil follows a perfect tracker, the line is drawn after ${r1.steps} steps (${(r1.steps * 0.05).toFixed(1)} s)`);
      const ink = await page.evaluate(() => { const g = window.pokecraft, L = window.__live(), cs = L.inkableOf(0); return { n: cs.length, ink: cs.filter(c => g.world.get(c.x, c.y, c.z) === 246).length, saved: g.beaten.includes('pw:doodle:line1'), toast: window.__toasts.filter(m => /You drew a bridge/.test(m)).length, neat: window.__toasts.some(m => /Neat line/.test(m)), cubes: g.cubes, chip: document.getElementById('score-chip')?.textContent }; });
      t.ok(ink.n > 10 && ink.ink === ink.n && ink.saved, `every cell of the line became ink (${ink.ink} of ${ink.n}), nothing is an edit, the key pw:doodle:line1 is saved`);
      t.ok(ink.toast === 1 && ink.neat && /Lines 1 \/ 8/.test(ink.chip || ''), `"You drew a bridge! 1 / 8", "Neat line!" for a perfect line, the score chip says ${ink.chip}`);
      // the ink never turns solid inside the player: stand in a cell of line 2, start it, and the cell waits
      const wait = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live(), cs = L.inkableOf(1), c = cs[5];
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
      // walk line 1 to the Meadow with real Player physics
      await stand(page, 0);
      const walk = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live(), cs = L.lines[0].line.cells, pts = cs.filter((c, i) => i % 2 === 0).map(c => [c.x + 0.5, c.z + 0.5]);
        const end = L.lines[0].line.at(L.lines[0].line.len);
        const r = window.__walk([...pts, [end[0], end[2] - 2]], 2500);
        const U = g.player.pos;
        const page2 = g.world.get(Math.floor(U.x), Math.floor(U.y - 0.05), Math.floor(U.z));
        return { ...r, under: page2, inMeadow: U.z < 118 && U.z > 99 };
      });
      t.ok(walk.inMeadow && walk.y > 15.9 && walk.under === 1, `walked line 1 with real physics onto Sketch Meadow (z ${walk.z.toFixed(1)}, y ${walk.y.toFixed(1)}, standing on grass)`);
      // falling: not drawn line 2 yet: step off the Meadow's west edge into the gap and land on the blank page: puffed to the pad
      const fell = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live();
        L.manual = true; window.__toasts.length = 0;
        window.__at(60.5, 15.5, 106.5, Math.PI / 2, 0);
        let n = 0; for (; n < 400; n++) { g.player.update(0.05); L.step(0.05); const p = g.player.pos; if (p.y > 12 && p.x > 70 && n > 20) break; }
        const p = g.player.pos, pad = g.world.doodle.pads[1].stand;
        return { n, x: p.x, y: p.y, z: p.z, pad, near: Math.hypot(p.x - pad[0], p.z - pad[2]) < 2, toast: window.__toasts.some(m => /Whoops/.test(m)) };
      });
      t.ok(fell.near && fell.toast, `falling off the page lands on the blank page and puffs you back up to the next pad (${fell.x.toFixed(1)}, ${fell.y.toFixed(1)}, ${fell.z.toFixed(1)}: "Whoops!")`);
      // the pause: nothing happens while a panel is open
      const pz = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live(); window.__at(...g.world.doodle.pads[1].stand); L.manual = true;
        L.use(g.player); const before = L.cur.st.s; L.playing = () => false;
        const tip = L.cur.line.line.at(0); for (let i = 0; i < 30; i++) L.step(0.05, window.__aimNear(tip));
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
      // curl lines and the spiral stair, then race lines: draw 4..5 fast with perfect aim
      const more = await page.evaluate(() => { const L = window.__live(), out = []; for (const n of [4, 5]) { window.__at(...window.pokecraft.world.doodle.pads[n - 1].stand); out.push(window.__draw(n, 0.05).info.drawn.filter(Boolean).length); } return out; });
      t.ok(more[1] === 5, `the zigzag (4) and the spiral stair (5) are drawn (${more})`);
      const deck = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live(), l = L.lines[4], cs = l.line.cells, last = cs[cs.length - 1];
        window.__at(...g.world.doodle.pads[4].stand);
        const pts = cs.map(c => [c.x + 0.5, c.z + 0.5]);
        const r = window.__walk(pts.filter((c, i) => i % 2 === 0), 6000);
        const D = g.world.doodle.tower;
        return { ...r, onDeck: Math.abs(g.player.pos.y - (D.deckY + 1)) < 1.5, last };
      });
      t.ok(deck.onDeck, `walking up the spiral stair (real physics) reaches the tower deck (y ${deck.y.toFixed(1)})`);
      // a race line with a perfect tracker is never rubbed; a tracker who looks away is rubbed back to a star dot
      const race = await page.evaluate(() => {
        const g = window.pokecraft, L = window.__live(); L.drawUpTo(5); window.__at(...g.world.doodle.pads[5].stand); L.manual = true;
        L.use(g.player);
        let n = 0, rubbedMsg = false;
        for (; n < 400; n++) { const tip = L.cur.line.line.at(L.cur.st.s); L.step(0.05, n > 20 && n < 200 ? { eye: [0, 90, 0], dir: [0, 1, 0] } : window.__aimNear(tip)); if (L.info().rubbed >= 1) { rubbedMsg = true; break; } }
        const info = L.info(), rub = window.__toasts.some(m => /Rubber rubbed it out/.test(m));
        L.stop();
        // now a perfect run of line 6
        const r = window.__draw(6, 0.05);
        return { rubbed: rubbedMsg, rub, sAfter: info.s, perfect: r.info.drawn[5], rubbedPerfect: r.info.last?.rubbed, steps: r.steps };
      });
      t.ok(race.rubbed && race.rub, 'on the Eraser Hill looking away lets Rubber catch the pencil: the line is rubbed back and he giggles');
      t.ok(race.perfect && race.rubbedPerfect === 0, `a steady tracker draws race line 6 without being rubbed (${race.steps} steps)`);
      await page.evaluate(() => { const L = window.__live(); L.drawUpTo(7); window.__at(...window.pokecraft.world.doodle.pads[7].stand); window.__draw(8, 0.05); });
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
      await waitFor(page, () => window.pokecraft.inBattle, null, 180000);
      await playBattle(page);
      await waitFor(page, () => window.pokecraft.beaten.includes('pw:doodle:crew1'), null, 180000);
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
      await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 180000);
      await shot(page, 'battle');
      await playBattle(page);
      await waitFor(page, () => !window.pokecraft.inBattle, null, 180000);
      const lost = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos, b = g.world.bosses[0]; return { place: g.place, d: Math.hypot(p.x - b.rest[0], p.z - b.rest[2]), hp: g.party.every(c => c.hp > 0), stars: g.stars.includes('doodle') }; });
      t.ok(lost.place === 'doodle' && lost.d < 14 && lost.hp && !lost.stars, `losing to Arlo keeps you in the Sketchbook at a rest spot, healed, no star (${lost.d.toFixed(1)} from his rest)`);
      // win: the star, the Wizard's note, lines 6-8 cleared and 1-5 kept
      await page.evaluate(async () => {
        const g = window.pokecraft, S = await import('/src/species.js'), n = g.npcs.list.find(n => n.kind === 'boss'), r = g.world.bosses[0].rest;
        g.party = [S.makeCreature('thunderwolf', 100)]; g.cubes = 0; window.__at(r[0], r[1], r[2], Math.atan2(-(n.pos.x - r[0]), -(n.pos.z - r[2])), 0);
        g.bosses.talk(n);
      });
      await waitFor(page, () => window.pokecraft.inBattle, null, 180000);
      await playBattle(page);
      await waitFor(page, () => window.pokecraft.stars.includes('doodle'), null, 180000);
      const won = await page.evaluate(() => {
        const g = window.pokecraft, k = n => g.beaten.includes(`pw:doodle:line${n}`);
        return { note: document.querySelector('#celebrate .big')?.textContent, small: document.querySelector('#celebrate .small')?.textContent || document.querySelector('#celebrate')?.textContent, cubes: g.cubes, kept: [1, 2, 3, 4, 5].every(k), cleared: ![6, 7, 8].some(k), drawnNow: [...window.__live().drawnNow].length, gate: window.__live().state().count };
      });
      t.ok(/Sketchbook star/.test(won.note || '') && /My first sketchbook/.test(won.small || '') && won.cubes >= 10, `the star, the Wizard's note and cubes (${won.note})`);
      t.ok(won.kept && won.cleared && won.gate === 5, `a won battle clears lines 6-8 (a rematch is a new race) and keeps 1-5 (${won.gate} / 8 drawn)`);
      // the rematch: the gate wants lines 6-8 again; draw them, then the rematch is offered
      const gate2 = await page.evaluate(async () => { const g = window.pokecraft, B = await import('/src/pictureboss.js'); const n = g.npcs.list.find(n => n.kind === 'boss'); g.bosses.talk(n); return { gate: B.bossOf('doodle').gate(g), asking: g.ui.asking }; });
      t.ok(/\(✏️ 5 \/ 8\)/.test(gate2.gate || '') && !gate2.asking, `the rematch waits for the Eraser Hill lines (${gate2.gate})`);
      await page.evaluate(() => { const L = window.__live(); for (const n of [6, 7, 8]) { window.__at(...window.pokecraft.world.doodle.pads[n - 1].stand); window.__draw(n, 0.05); } });
      await page.evaluate(async () => {
        const g = window.pokecraft, n = g.npcs.list.find(n => n.kind === 'boss'), r = g.world.bosses[0].rest;
        window.__at(r[0], r[1], r[2], Math.atan2(-(n.pos.x - r[0]), -(n.pos.z - r[2])), 0); g.bosses.talk(n);
      });
      const ask = await page.evaluate(() => ({ asking: window.pokecraft.ui.asking, text: document.getElementById('ask-text')?.textContent }));
      t.ok(ask.asking && /rematch/i.test(ask.text || ''), `with all 8 lines drawn again Arlo offers a rematch ("${ask.text}")`);
      await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.party = [S.makeCreature('thunderwolf', 100), S.makeCreature('thunderwolf', 100)]; g.ui.askYes(); });
      await waitFor(page, () => window.pokecraft.inBattle, null, 180000);
      await playBattle(page);
      await waitFor(page, () => !window.pokecraft.inBattle, null, 180000);
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
  // look v2: the main page would keep drawing the Sketchbook (software WebGL) while the other parts run: close it first
  if (!ONLY) { await page.context().close(); await ipadPart({ browser, base, t }); await pairPart({ browser, base, t }); await shotsPart({ browser, base, t }); }
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
  await waitFor(ip, () => /Draw/.test(document.getElementById('btn-act')?.textContent || ''), null, 180000);
  const label = await ip.evaluate(() => document.getElementById('btn-act').textContent);
  const count = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  t.ok(/Draw!/.test(label) && count === before, `iPad: on a star pad the big button says "${label}" and the number of touch buttons is unchanged (${before})`);
  const chip = await ip.evaluate(() => { const c = document.getElementById('score-chip'), r = c.getBoundingClientRect(), v = { w: innerWidth, h: innerHeight }; return { text: c.textContent, inside: r.right <= v.w && r.left >= 0 && r.top >= 0 && r.bottom <= v.h, hidden: c.classList.contains('hidden') }; });
  t.ok(!chip.hidden && chip.inside && /Lines 0 \/ 8/.test(chip.text), `iPad: the score chip "${chip.text}" fits on the screen`);
  // a real tap on the big button starts the line
  const box = await ip.evaluate(() => { const r = document.getElementById('btn-act').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await ip.touchscreen.tap(box.x, box.y);
  await waitFor(ip, () => window.__live().info().drawing, null, 30000);
  const word = await ip.evaluate(() => document.getElementById('btn-act').textContent);
  t.ok(true, `iPad: a tap on the big button starts the pencil; it now says "${word}"`);
  // real drag-to-look touches: calibrate, then keep the tip under the crosshair for a few frames
  const cdp = await ip.context().newCDPSession(ip);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const drag = async (dx, dy) => { const x0 = 560, y0 = 330; await touch('touchStart', [[x0, y0, 5]]); for (let i = 1; i <= 4; i++) await touch('touchMove', [[x0 + dx * i / 4, y0 + dy * i / 4, 5]]); await touch('touchEnd', []); };
  const look = () => ip.evaluate(() => { const p = window.pokecraft.player; return [p.yaw, p.pitch]; });
  const a = await look(); await drag(80, 0); await ip.waitForTimeout(300); const b = await look(); await drag(0, 60); await ip.waitForTimeout(300); const c2 = await look();
  const kx = (b[0] - a[0]) / 80, ky = (c2[1] - b[1]) / 60;
  t.ok(Math.abs(kx) > 1e-4 && Math.abs(ky) > 1e-4, `iPad: a real drag turns the view (${kx.toFixed(4)} rad per px sideways, ${ky.toFixed(4)} up/down)`);
  let n = 0;
  for (let i = 0; i < 24; i++) {
    const want = await ip.evaluate(() => { const g = window.pokecraft, L = window.__live(), p = g.player; if (!L.cur) return null; const tip = L.cur.line.line.at(L.cur.st.s), e = p.eyePos, d = [tip[0] - e.x, tip[1] + 1.05 - e.y, tip[2] - e.z]; return [Math.atan2(-d[0], -d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2])), p.yaw, p.pitch]; });
    if (!want) break;
    let dyaw = want[0] - want[2]; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const dxp = Math.max(-150, Math.min(150, dyaw / kx)), dyp = Math.max(-100, Math.min(100, (want[1] - want[3]) / ky));
    if (Math.abs(dxp) > 1 || Math.abs(dyp) > 1) await drag(dxp, dyp);
    await ip.waitForTimeout(250); n++;
  }
  const res = await ip.evaluate(() => { const L = window.__live(), c = L.cur; return { s: c ? c.st.s : L.lines[0].line.len, frac: c ? c.st.onTime / Math.max(0.01, c.st.time) : 1, touch: document.body.classList.contains('touch') }; });
  t.ok(res.s > 1 && res.frac > 0.5 && res.touch, `iPad: following the tip with real drags for ${n} rounds drew ${res.s.toFixed(1)} blocks, the aim was on the tip ${(res.frac * 100).toFixed(0)}% of the time (bigger touch ring)`);
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
  await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 180000);
  await toasts(Bp); await toasts(A);
  for (const pg of [A, Bp]) await pg.evaluate(() => { window.pokecraft.champion = true; });
  await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
  await placeIs(A, 'swirl');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 180000);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'swirl');
  const cell = await A.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'doodle'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(A, 'doodle');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 180000);
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
  await page.evaluate(() => { const g = window.pokecraft, p = g.player; p.pos.set(80.5, 15, 140.5); p.lookAt({ x: 80.5, y: 14.5, z: 122 }); });
  await shot(page, 'dotted-line', null, 800);
  await shot(page, 'edge', [80.5, 15, 143.5, 0.6, -0.05]);
  await page.evaluate(() => { const g = window.pokecraft; window.__at(80.5, 15, 140.5, 0, -0.1); });
  await row('creatures', 800);
  await page.evaluate(() => { const g = window.pokecraft; window.__row?.forEach(m => g.scene.remove(m)); });
  // a line being drawn: the ring on the tip
  await stand(page, 0);
  await page.evaluate(() => { const g = window.pokecraft, L = window.__live(); L.manual = true; L.use(g.player); for (let i = 0; i < 160; i++) { const tip = L.cur.line.line.at(L.cur.st.s); L.step(0.05, window.__aimNear(tip)); } const tip = L.cur.line.line.at(L.cur.st.s); g.player.lookAt({ x: tip[0], y: tip[1] + 1.1, z: tip[2] }); });
  await shot(page, 'meadow', null, 800);
  await page.evaluate(() => window.__live().stop());
  // the Curly Tower: the spiral stair half drawn
  await page.evaluate(() => { const L = window.__live(), g = window.pokecraft; L.drawUpTo(4); window.__at(...g.world.doodle.pads[4].stand); L.manual = true; L.use(g.player); for (let i = 0; i < 600; i++) { const tip = L.cur.line.line.at(L.cur.st.s); L.step(0.05, window.__aimNear(tip)); if (L.cur.st.s > 40) break; } g.player.pos.set(88.5, 20, 52.5); g.player.vel.set(0, 0, 0); g.player.lookAt({ x: 80, y: 30, z: 60 }); });
  await shot(page, 'tower', null, 800);
  await page.evaluate(() => window.__live().stop());
  // the Eraser Hill: Rubber chasing the pencil
  await page.evaluate(() => {
    const L = window.__live(), g = window.pokecraft; L.drawUpTo(5); window.__at(...g.world.doodle.pads[5].stand); L.manual = true; L.use(g.player);
    for (let i = 0; i < 70; i++) { const tip = L.cur.line.line.at(L.cur.st.s); L.step(0.05, window.__aimNear(tip)); }
    for (let i = 0; i < 50; i++) L.step(0.05, { eye: [0, 90, 0], dir: [0, 1, 0] }); // look away: Rubber closes in
    const c = L.cur, r = c.line.line.at(Math.max(0, c.st.eraser)), t0 = c.line.line.at(c.st.s);
    g.player.pos.set((r[0] + t0[0]) / 2 + 4, r[1] + 1.5, (r[2] + t0[2]) / 2 + 4); g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: (r[0] + t0[0]) / 2, y: r[1] + 1.5, z: (r[2] + t0[2]) / 2 });
  });
  await shot(page, 'eraser', null, 800);
  await page.evaluate(() => window.__live().stop());
  // the Desk: Arlo
  await page.evaluate(() => { const g = window.pokecraft, L = window.__live(); L.drawUpTo(8); const n = g.npcs.list.find(n => n.kind === 'boss'), r = g.world.bosses[0].rest; window.__at(r[0], r[1], r[2], Math.atan2(-(n.pos.x - r[0]), -(n.pos.z - r[2])), -0.05); });
  await shot(page, 'desk', null, 800);
  // a battle in the Sketchbook (look v2: paper models, outlines, hatching)
  await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), p = g.player;
    window.__at(80.5, 15, 140.5, 0, 0);
    g.party = [S.makeCreature('thunderwolf', 20)];
    const wild = g.creatures.spawnAt('graphitan', Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z) - 4);
    g.inBattle = true; document.body.classList.add('in-battle');
    g.battle.start({ wild });
  });
  await waitFor(page, () => window.pokecraft.battle.allyModel && window.pokecraft.battle.foeModel, null, 180000);
  await shot(page, 'battle', null, 1500);
  t.ok(!page.errors.length, `no page errors (screenshots) ${page.errors.join('; ')}`);
  await page.context().close();
}
