// T18: the Time, Camo and Cyber types (21 creatures, 13 moves + 3 signature moves, chart, fx, models).
// Run one type with T18_TYPE=time|camo|cyber, or all three.
// Saves tests/screenshots/three-types[-<type>].png and creature-<id>.png (the popped-out Camo forms; the
// disguised view is covered by the spawn-rules spec).
import fs from 'node:fs';
import path from 'node:path';
import { openGame, newGame, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const TYPES = ['time', 'camo', 'cyber'];
const OLD_SHAPES = ['quad', 'blob', 'biped', 'bird', 'serpent', 'bug', 'guardian', 'butterfly', 'moth', 'star', 'robe', 'hopper',
  'planet', 'comet', 'cloud', 'tall', 'squid', 'bat', 'drum', 'ape', 'bell', 'armadillo', 'wyvern', 'fish', 'nut', 'drone', 'wisp',
  'puff', 'crystal', 'skull', 'bonedog', 'dino', 'ufo', 'visitor', 'tripod',
  // T4b singles
  'snail', 'lantern', 'teacup', 'pitcher', 'windup', 'crane', 'nimbus', 'chameleon', 'blackhole', 'jukebox', 'fishbone', 'zorb',
  // T9 shapes
  'kite', 'balloon', 'skywhale', 'pinwheel', 'gelcube', 'drip', 'slimedog', 'gummy', 'sunfox', 'lighthouse', 'rooster', 'mirrorball',
  'paperplane', 'origamifrog', 'book', 'puzzle'];
const only = process.env.T18_TYPE;
const types = only ? [only] : TYPES;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  t.ok(!only || TYPES.includes(only), `T18_TYPE "${only}" is time, camo or cyber (or unset)`);
  if (only && !TYPES.includes(only)) return;
  const page = await openGame(browser, base);
  await newGame(page, 0);

  const r = await page.evaluate(async ({ types, ALL, OLD_SHAPES }) => {
    const S = await import('/src/species.js');
    const SH = await import('/src/shapes.js');
    const R = await import('/src/fxrecipes.js');
    const B = await import('/src/blocks.js');
    const THREE = await import('three');
    const out = { problems: [], ids: [], info: {} };
    const bad = msg => out.problems.push(msg);
    const all = Object.entries(S.SPECIES);
    // 1. Colours, effects, sounds, wool.
    out.colors = Object.keys(S.TYPE_COLORS).length;
    const { sound } = await import('/src/sound.js');
    for (const type of ALL) {
      if (!S.TYPE_COLORS[type]) bad(`${type}: no TYPE_COLORS`);
      if (!R.FX_COLORS[type] || !R.TRAVEL[type] || !R.IMPACT[type]) bad(`${type}: no fx recipes or colours`);
      if (R.TRAVEL[type] === R.TRAVEL.normal || R.IMPACT[type] === R.IMPACT.normal) bad(`${type}: still the normal fx recipe`);
      if (!sound.has(`fx:${type}`)) bad(`${type}: no fx:${type} sound`);
      const wool = B.WOOL[type];
      if (!(wool >= 54 && wool <= 56) || !B.BLOCKS[wool]?.name.toLowerCase().startsWith(type)) bad(`${type}: wool ${wool}`);
    }
    for (const id of ['ticktock', 'popout']) if (!sound.has(id)) bad(`no ${id} sound`);
    for (const [id, was] of [['wakeupcall', 'blazedash'], ['statueslam', 'rootslam'], ['megabyte', 'zenithray']]) {
      if (!R.SIG[id] || R.SIG[id] === R.SIG[was]) bad(`${id}: no signature fx of its own`);
    }
    // 2. Chart.
    const eff = S.effectiveness;
    const must = [['time', 'metal', 2], ['time', 'paper', 2], ['time', 'slime', 2], ['cosmic', 'time', 2], ['bug', 'time', 2],
      ['camo', 'bug', 2], ['camo', 'mind', 2], ['light', 'camo', 2], ['sound', 'camo', 2], ['normal', 'camo', 0.5],
      ['cyber', 'metal', 2], ['cyber', 'mind', 2], ['cyber', 'paper', 2], ['water', 'cyber', 2], ['bug', 'cyber', 2], ['electric', 'cyber', 0.5],
      // old triangles and rows stay as they were
      ['sky', 'paper', 2], ['paper', 'light', 2], ['light', 'slime', 2], ['slime', 'sky', 2], ['fire', 'paper', 2], ['metal', 'paper', 2],
      ['paper', 'rock', 2], ['grass', 'slime', 2], ['electric', 'sky', 2], ['ice', 'sky', 2], ['toxic', 'light', 2], ['cosmic', 'light', 2],
      ['light', 'ghost', 2], ['normal', 'slime', 0.5]];
    for (const [a, d, v] of must) if (eff(a, d) !== v) bad(`${a}>${d} should be ${v}, is ${eff(a, d)}`);
    const allTypes = Object.keys(S.TYPE_COLORS);
    for (const d of allTypes) {
      const weak = allTypes.filter(a => eff(a, d) === 2).length;
      if (weak > (['mind', 'ghost', 'drake'].includes(d) ? 6 : 5)) bad(`${d} is weak to ${weak} types`);
    }
    for (const type of ALL) {
      const strong = allTypes.filter(d => eff(type, d) === 2).length;
      const weak = allTypes.filter(a => eff(a, type) === 2).length;
      if (strong < 2 || strong > 4) bad(`${type} hits ${strong} types hard (want 2 to 4)`);
      if (weak < 2 || weak > 5) bad(`${type} is weak to ${weak} types (want 2 to 5)`);
    }
    // 3. Moves.
    for (const type of ALL) {
      const mv = Object.values(S.MOVES).filter(m => m.type === type);
      if (mv.filter(m => !m.sig).length < 4) bad(`${type}: fewer than 4 normal moves`);
      if (mv.filter(m => m.sig).length !== 1) bad(`${type}: ${mv.filter(m => m.sig).length} signature moves (want 1)`);
    }
    out.infos = { rewind: S.moveInfo('rewind').text, snooze: S.moveInfo('snoozebutton').text, ff: S.moveInfo('fastforward').text };
    out.sigs = [['clangalarm', 'wakeupcall'], ['statuo', 'statueslam'], ['pixbit2', 'megabyte']]
      .filter(([id, m]) => !S.SPECIES[id]?.learn.some(([l, mm]) => l === 30 && mm === m)).map(([id]) => id);
    out.snooze = S.SPECIES.pendulo ? S.makeCreature('pendulo', 20).moves.includes('snoozebutton') : false;
    // 4. Species per type.
    const evolvesInto = new Set(all.map(([, s]) => s.evolve?.into).filter(Boolean));
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
      for (const id of ids) {
        const s = S.SPECIES[id];
        const shape = s.model.shape;
        if (OLD_SHAPES.includes(shape)) bad(`${id}: shape ${shape} is an old one`);
        if (typeof SH.SHAPES[shape] !== 'function') bad(`${id}: no SHAPES.${shape} builder`);
        if (ids.filter(o => S.SPECIES[o].model.shape === shape).some(o => fam(o) !== fam(id))) bad(`${id}: shape ${shape} is shared by two families`);
        if (all.some(([o, os]) => os.model.shape === shape && o !== id && !ids.includes(o))) bad(`${id}: shape ${shape} is used by an older species`);
        if (names.filter(nm => nm === s.name.toLowerCase()).length !== 1) bad(`${id}: name ${s.name} is not unique`);
        if (!s.desc || s.desc.length > 110) bad(`${id}: desc is ${s.desc?.length} characters`);
        if (!spawned.has(id) && !evolvesInto.has(id)) bad(`${id}: not reachable from SPAWNS`);
        for (const e of whereOf(id)) if (e.w > 1.5) bad(`${id}: weight ${e.w} in ${e.biome}`);
        if (!(S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === s.type))) bad(`${id}: no move of its own type at Lv 20`);
        if (/ 2\.0$/.test(s.name) !== /2$/.test(id)) bad(`${id}: "2.0" name and id disagree (${s.name})`);
        if (type === 'camo') {
          const d = s.disguise;
          if (!d || !d.blocks?.length || d.blocks.some(b => !B.BLOCKS[b])) bad(`${id}: disguise.blocks must be real blocks`);
          if ((evolvesInto.has(id) ? 2 : 1) !== (d?.size || 1)) bad(`${id}: disguise size ${d?.size} (evolved ones are 2)`);
        } else if (s.disguise) bad(`${id}: only Camo creatures have a disguise`);
        try {
          const m = SH.SHAPES[shape] && S.buildModel(id);
          S.animateModel(m, 0);
          const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
          out.info[id] = `${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`;
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
      if (type === 'time') {
        if (where.some(e => e.when !== 'dawn' && e.when !== 'dusk')) bad('time: every spawn entry should be dawn or dusk');
        if (!where.some(e => e.when === 'dawn') || !where.some(e => e.when === 'dusk')) bad('time: needs both dawn and dusk entries');
      }
      if (type === 'cyber') {
        if (where.some(e => e.when !== 'together')) bad('cyber: every spawn entry should be "together"');
        const biomes = Object.keys(S.SPAWNS).filter(b => b !== 'cave' && !where.some(e => e.biome === b));
        if (biomes.length) bad(`cyber: not in ${biomes.join(', ')}`);
      }
    }
    // Only Camo creatures have a disguise (checked over every species, also when one type runs).
    for (const [id, s] of all) if (s.disguise && s.type !== 'camo') bad(`${id}: only Camo creatures have a disguise`);
    out.normal = all.filter(([, s]) => !s.legendary).length;
    return out;
  }, { types, ALL: TYPES, OLD_SHAPES });

  const missing = r.problems;
  t.ok(r.colors >= 26, `at least 26 types in TYPE_COLORS (${r.colors})`);
  t.ok(!missing.length, `three-types data, chart, moves, species and models ${missing.join('; ')}`);
  t.ok(r.infos.rewind.includes('heals you'), `Rewind text: ${r.infos.rewind}`);
  t.ok(r.infos.snooze.includes('puts the foe to sleep'), `Snooze text: ${r.infos.snooze}`);
  t.ok(r.infos.ff.includes('goes first'), `Fast Forward text: ${r.infos.ff}`);
  t.ok(!r.sigs.length, `Clangalarm, Statuo and Pixbit 2.0 learn their special at 30 ${r.sigs.join(', ')}`);
  t.ok(r.snooze, 'a Lv 20 Pendulo knows Snooze');
  t.ok(only || r.normal >= 182, `${r.normal} normal species`);
  console.log(`  sizes ${Object.entries(r.info).map(([k, v]) => `${k} ${v}`).join(', ')}`);

  // Screenshots: portrait grid, white background, names under the portraits (the popped-out forms).
  if (!r.problems.length && r.ids.length === (only ? 7 : 21)) {
    const shots = await page.evaluate(async ({ types }) => {
      const { portrait } = await import('/src/ui.js');
      const S = await import('/src/species.js');
      const rowsIds = types.map(ty => Object.entries(S.SPECIES).filter(([, s]) => s.type === ty).map(([id]) => id));
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
        await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]); // decode() can hang in a busy headless browser
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
    save(only ? `three-types-${only}.png` : 'three-types.png', shots.grid);
    for (const [id, url] of Object.entries(shots.singles)) save(`creature-${id}.png`, url);
    t.ok(shots.grid.length > 20000, 'portrait grid drawn');
  }

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
