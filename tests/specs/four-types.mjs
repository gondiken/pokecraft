// T9: the Sky, Slime, Light and Paper types (28 creatures with Puzzlet, 20 moves + 4 signature moves, chart, weather).
// Run one type with T9_TYPE=sky|slime|light|paper (paper also covers Puzzlet), or all four.
// Saves tests/screenshots/four-types[-<type>].png and creature-<id>.png.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, newGame, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const TYPES = ['sky', 'slime', 'light', 'paper'];
const OLD_SHAPES = ['quad', 'blob', 'biped', 'bird', 'serpent', 'bug', 'guardian', 'butterfly', 'moth', 'star', 'robe', 'hopper',
  'planet', 'comet', 'cloud', 'tall', 'squid', 'bat', 'drum', 'ape', 'bell', 'armadillo', 'wyvern', 'fish', 'nut', 'drone', 'wisp',
  'puff', 'crystal', 'skull', 'bonedog', 'dino', 'ufo', 'visitor', 'tripod',
  // T4b singles
  'snail', 'lantern', 'teacup', 'pitcher', 'windup', 'crane', 'nimbus', 'chameleon', 'blackhole', 'jukebox', 'fishbone', 'zorb'];
const only = process.env.T9_TYPE;
const types = only ? [only] : TYPES;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  t.ok(!only || TYPES.includes(only), `T9_TYPE "${only}" is sky, slime, light or paper (or unset)`);
  if (only && !TYPES.includes(only)) return;
  const page = await openGame(browser, base);
  await newGame(page, 0);

  // 1-5, 6: data, chart, moves, species, models.
  const r = await page.evaluate(async ({ types, ALL, OLD_SHAPES }) => {
    const S = await import('/src/species.js');
    const SH = await import('/src/shapes.js');
    const R = await import('/src/fxrecipes.js');
    const THREE = await import('three');
    const out = { problems: [], ids: [], info: {} };
    const bad = msg => out.problems.push(msg);
    const all = Object.entries(S.SPECIES);
    // 1. Colours, effects, sounds.
    out.colors = Object.keys(S.TYPE_COLORS).length;
    for (const type of ALL) {
      if (!S.TYPE_COLORS[type]) bad(`${type}: no TYPE_COLORS`);
      if (!R.FX_COLORS[type] || !R.TRAVEL[type] || !R.IMPACT[type]) bad(`${type}: no fx recipes or colours`);
    }
    const { sound } = await import('/src/sound.js');
    for (const type of ALL) if (!sound.has(`fx:${type}`)) bad(`${type}: no fx:${type} sound`);
    // 2. Chart.
    const eff = S.effectiveness;
    const must = [['sky', 'paper', 2], ['paper', 'light', 2], ['light', 'slime', 2], ['slime', 'sky', 2], ['fire', 'paper', 2], ['metal', 'paper', 2],
      ['paper', 'rock', 2], ['grass', 'slime', 2], ['electric', 'sky', 2], ['ice', 'sky', 2], ['toxic', 'light', 2], ['cosmic', 'light', 2],
      ['light', 'ghost', 2], ['normal', 'slime', 0.5]];
    for (const [a, d, v] of must) if (eff(a, d) !== v) bad(`${a}>${d} should be ${v}, is ${eff(a, d)}`);
    const allTypes = Object.keys(S.TYPE_COLORS);
    for (const d of allTypes) {
      const weak = allTypes.filter(a => eff(a, d) === 2).length;
      if (weak > 5) bad(`${d} is weak to ${weak} types`);
    }
    for (const type of ALL) {
      const strong = allTypes.filter(d => eff(type, d) === 2).length;
      const weak = allTypes.filter(a => eff(a, type) === 2).length;
      if (strong !== 3) bad(`${type} hits ${strong} types hard (want 3)`);
      if (weak !== 3) bad(`${type} is weak to ${weak} types (want 3)`);
    }
    // 3. Moves.
    for (const type of ALL) {
      const mv = Object.values(S.MOVES).filter(m => m.type === type);
      if (mv.filter(m => !m.sig).length < 4) bad(`${type}: fewer than 4 normal moves`);
      if (mv.filter(m => m.sig).length !== 1) bad(`${type}: ${mv.filter(m => m.sig).length} signature moves (want 1)`);
    }
    out.confetti = S.moveInfo('confetti').text;
    out.sigs = [['kitegale', 'jetstream'], ['slimperor', 'megasplat'], ['lumitower', 'beaconbeam'], ['origrane', 'thousandcranes']]
      .filter(([id, m]) => !S.SPECIES[id]?.learn.some(([l, mm]) => l === 30 && mm === m)).map(([id]) => id);
    out.kiteling = S.SPECIES.kiteling ? S.makeCreature('kiteling', 28).moves.includes('tornadospin') : false;
    // 4. Species per type.
    const evolvesInto = new Set(all.map(([, s]) => s.evolve?.into).filter(Boolean));
    const shapeUse = {};
    for (const [, s] of all) shapeUse[s.model.shape] = (shapeUse[s.model.shape] || 0) + 1;
    const names = all.map(([, s]) => s.name.toLowerCase());
    const sigOf = m => {
      let sum = 0;
      m.updateMatrixWorld(true);
      m.traverse(o => {
        if (!o.isMesh) return;
        for (const v of o.matrixWorld.elements) sum += v;
        if (o.material.color) sum += o.material.color.r * 3 + o.material.color.g * 5 + o.material.color.b * 7;
        if (o.material.emissive) sum += o.material.emissive.r * 11 + o.material.emissive.g * 13 + o.material.emissive.b * 17;
      });
      return sum;
    };
    const whereOf = id => Object.entries(S.SPAWNS).flatMap(([biome, list]) => list.filter(e => e[0] === id).map(e => ({ biome, w: e[1], when: e[2] })));
    const spawned = new Set(Object.values(S.SPAWNS).flat().map(e => e[0]));
    for (const type of types) {
      const ids = all.filter(([, s]) => s.type === type).map(([id]) => id);
      out.ids.push(...ids);
      if (type === 'paper') out.ids.push('puzzlet');
      if (ids.length !== 7) bad(`${type}: ${ids.length} species (want 7)`);
      const evo = ids.filter(id => S.SPECIES[id].evolve);
      const singles = ids.filter(id => !S.SPECIES[id].evolve && !evolvesInto.has(id));
      if (evo.length !== 3) bad(`${type}: ${evo.length} evolutions (want 3)`);
      for (const id of evo) {
        const e = S.SPECIES[id].evolve;
        if (S.SPECIES[e.into]?.type !== type || e.level < 20 || e.level > 24) bad(`${id}: evolves into ${e.into} at ${e.level}`);
      }
      if (singles.length !== 1) bad(`${type}: ${singles.length} single-stage creatures (want 1)`);
      const fam = id => (S.SPECIES[id].evolve ? id : [...ids].find(o => S.SPECIES[o].evolve?.into === id) || id);
      const shapes = new Set(ids.map(id => S.SPECIES[id].model.shape));
      if (shapes.size !== 4) bad(`${type}: ${shapes.size} different shapes (want 4)`);
      for (const id of (type === 'paper' ? [...ids, 'puzzlet'] : ids)) {
        const s = S.SPECIES[id];
        if (!s) { bad(`${id}: missing`); continue; }
        const shape = s.model.shape;
        const isNew = id !== 'origrane';
        if (isNew && OLD_SHAPES.includes(shape)) bad(`${id}: shape ${shape} is an old one`);
        if (typeof SH.SHAPES[shape] !== 'function') bad(`${id}: no SHAPES.${shape} builder`);
        const sameShape = ids.filter(o => S.SPECIES[o].model.shape === shape);
        if (isNew && sameShape.some(o => fam(o) !== fam(id))) bad(`${id}: shape ${shape} is shared by two families`);
        if (isNew && all.some(([o, os]) => os.model.shape === shape && !ids.includes(o))) bad(`${id}: shape ${shape} is used by an older species`);
        if (names.filter(nm => nm === s.name.toLowerCase()).length !== 1) bad(`${id}: name ${s.name} is not unique`);
        if (!s.desc || s.desc.length > 110) bad(`${id}: desc is ${s.desc?.length} characters`);
        if (!spawned.has(id) && !evolvesInto.has(id)) bad(`${id}: not reachable from SPAWNS`);
        for (const e of whereOf(id)) {
          if (e.w > 1.5) bad(`${id}: weight ${e.w} in ${e.biome}`);
          if (type === 'paper' && (e.biome === 'swamp' || e.biome === 'water')) bad(`${id}: paper in ${e.biome}`);
        }
        if (!(S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === s.type))) bad(`${id}: no move of its own type at Lv 20`);
        try {
          const m = SH.SHAPES[shape] && S.buildModel(id);
          S.animateModel(m, 0);
          const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
          if (size.y < 0.35 || size.y > 2.6) bad(`${id}: height ${size.y.toFixed(2)} outside 0.35-2.6`);
          if (size.x > 2.6 || size.z > 2.6) bad(`${id}: width/depth ${size.x.toFixed(2)}/${size.z.toFixed(2)} over 2.6`);
          if (box.min.y < -0.1) bad(`${id}: goes under the ground (min.y ${box.min.y.toFixed(2)})`);
          S.animateModel(m, 0.3, false); const a = sigOf(m);
          S.animateModel(m, 1.1, false); const b = sigOf(m);
          if (Math.abs(a - b) < 1e-6) bad(`${id}: no idle animation`);
          for (let tt = 0; tt < 3; tt += 0.5) S.animateModel(m, tt, tt > 1.5);
          S.disposeModel(m);
        } catch (e) { bad(`${id}: model failed: ${e.message}`); }
      }
      const where = ids.flatMap(whereOf);
      const count = (b, f = () => true) => where.filter(e => b.includes(e.biome) && f(e)).length;
      if (type === 'slime' && count(['swamp']) < 3) bad('slime: fewer than 3 swamp entries');
      if (type === 'sky' && count(['peak', 'mountain']) < 3) bad('sky: fewer than 3 peak/mountain entries');
      if (type === 'light' && where.length && where.every(e => e.when === 'night')) bad('light: night-only');
    }
    // 5. Origrane and Puzzlet.
    if (S.SPECIES.origrane.type !== 'paper') bad(`origrane is ${S.SPECIES.origrane.type}`);
    const p = S.SPECIES.puzzlet;
    if (!p) bad('no puzzlet');
    else {
      if (p.type !== 'mind' || p.evolve || evolvesInto.has('puzzlet') || p.model.shape !== 'puzzle') bad('puzzlet should be a single mind creature with the puzzle shape');
    }
    out.mind = all.filter(([, s]) => s.type === 'mind').length;
    out.normal = all.filter(([, s]) => !s.legendary).length;
    return out;
  }, { types, ALL: TYPES, OLD_SHAPES });

  const missing = r.problems;
  t.ok(r.colors === 23, `23 types in TYPE_COLORS (${r.colors})`);
  t.ok(!missing.length, `four-types data, chart, moves, species and models ${missing.join('; ')}`);
  t.ok(r.confetti.includes('hits 2 to 4 times'), `Confetti text: ${r.confetti}`);
  t.ok(!r.sigs.length, `Kitegale, Slimperor, Lumitower and Origrane learn their special at 30 ${r.sigs.join(', ')}`);
  t.ok(r.kiteling, 'a Lv 28 Kiteling knows Tornado Spin');
  t.ok(r.mind === 7, `Mind still has 7 creatures (${r.mind})`);
  t.ok(only || r.normal === 161, `${r.normal} normal species`);

  // 7. Weather, through the real weights.
  const wx = await page.evaluate(async () => {
    const g = window.pokecraft, { SPECIES } = await import('/src/species.js');
    const cm = g.creatures, w = g.weather;
    const share = (biome, type) => {
      const tab = cm.weights(biome, false);
      return tab.filter(([e]) => SPECIES[e[0]].type === type).reduce((a, [, x]) => a + x, 0) / tab.reduce((a, [, x]) => a + x, 0);
    };
    const rows = {};
    for (const [kind, biome, type] of [['rain', 'swamp', 'slime'], ['rainbow', 'meadow', 'light'], ['storm', 'peak', 'sky'], ['rain', 'plains', 'paper']]) {
      cm.weather = null;
      const base = share(biome, type);
      cm.weather = w;
      w.set(kind);
      rows[`${kind}/${biome}/${type}`] = { base, boosted: share(biome, type) };
    }
    w.set('clear');
    return rows;
  });
  for (const [key, v] of Object.entries(wx)) {
    const [kind, biome, type] = key.split('/');
    if (only && type !== only) continue;
    const ratio = v.boosted / v.base;
    const ok = type === 'paper' ? v.base > 0 && ratio < 1 : v.base > 0 && ratio >= 1.2;
    t.ok(ok, `${kind}: ${type} share in ${biome} ${(v.base * 100).toFixed(1)}% -> ${(v.boosted * 100).toFixed(1)}% (x${ratio.toFixed(2)})`);
  }

  // 8. Screenshots.
  if (!r.problems.length && r.ids.length === (only ? (only === 'paper' ? 8 : 7) : 29)) {
    const shots = await page.evaluate(async ({ types }) => {
      const { portrait } = await import('/src/ui.js');
      const S = await import('/src/species.js');
      const rowsIds = types.map(ty => Object.entries(S.SPECIES).filter(([, s]) => s.type === ty).map(([id]) => id));
      if (types.includes('paper') && S.SPECIES.puzzlet) rowsIds.push(['puzzlet']); // Puzzlet (mind) gets its own row
      const W = 200, H = 180, LABEL = 26, COLS = 7;
      const cv = document.createElement('canvas');
      cv.width = W * COLS; cv.height = (H + LABEL) * rowsIds.length;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
      const singles = {};
      for (let row = 0; row < rowsIds.length; row++) for (let i = 0; i < rowsIds[row].length; i++) {
        const id = rowsIds[row][i];
        const img = new Image();
        img.src = portrait(id, W, H);
        await img.decode();
        ctx.drawImage(img, i * W, row * (H + LABEL));
        ctx.fillText(S.SPECIES[id].name, i * W + W / 2, row * (H + LABEL) + H + 18);
        singles[id] = portrait(id, 480, 400);
      }
      return { grid: cv.toDataURL(), singles };
    }, { types });
    const save = (name, url) => {
      const file = path.join(SHOTS, name);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(`  screenshot ${file}`);
    };
    save(only ? `four-types-${only}.png` : 'four-types.png', shots.grid);
    for (const [id, url] of Object.entries(shots.singles)) save(`creature-${id}.png`, url);
    t.ok(shots.grid.length > 20000, 'portrait grid drawn');
  }

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
