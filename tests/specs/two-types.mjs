// T21: the Cozy and Treasure types (14 creatures, 9 moves + 2 signature moves, chart, fx, models, sparkle) and the
// 'home:<type>' spawn condition driven with fake homes (T22 builds the real ones).
// Run one type with T21_TYPE=cozy|treasure, or both.
// Saves tests/screenshots/two-types[-<type>].png and creature-<id>.png.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, newGame, platform, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const TYPES = ['cozy', 'treasure'];
const OLD_SHAPES = ['quad', 'blob', 'biped', 'bird', 'serpent', 'bug', 'guardian', 'butterfly', 'moth', 'star', 'robe', 'hopper',
  'planet', 'comet', 'cloud', 'tall', 'squid', 'bat', 'drum', 'ape', 'bell', 'armadillo', 'wyvern', 'fish', 'nut', 'drone', 'wisp',
  'puff', 'crystal', 'skull', 'bonedog', 'dino', 'ufo', 'visitor', 'tripod',
  // T4b singles
  'snail', 'lantern', 'teacup', 'pitcher', 'windup', 'crane', 'nimbus', 'chameleon', 'blackhole', 'jukebox', 'fishbone', 'zorb',
  // T9 shapes
  'kite', 'balloon', 'skywhale', 'pinwheel', 'gelcube', 'drip', 'slimedog', 'gummy', 'sunfox', 'lighthouse', 'rooster', 'mirrorball',
  'paperplane', 'origamifrog', 'book', 'puzzle',
  // T18 shapes
  'hourglass', 'pendulum', 'alarmclock', 'sunmoon', 'bushblock', 'sandcastle', 'stonecube', 'igloo', 'pixelblob', 'cursor', 'wifiwing', 'glitchghost'];
// Every pair of the old 26 types whose multiplier is not 1, measured before T21 changed the chart ("attacker>defender:multiplier").
const OLD_CHART = 'normal>rock:0.5 normal>ghost:0 normal>metal:0.5 normal>bone:0.5 normal>slime:0.5 normal>camo:0.5 fire>fire:0.5 fire>water:0.5 fire>grass:2 fire>rock:0.5 fire>ice:2 fire>bug:2 fire>metal:2 fire>drake:0.5 fire>rainbow:0.5 fire>paper:2 water>fire:2 water>water:0.5 water>grass:0.5 water>rock:2 water>drake:0.5 water>rainbow:0.5 water>bone:2 water>cyber:2 grass>fire:0.5 grass>water:2 grass>grass:0.5 grass>rock:2 grass>bug:0.5 grass>metal:0.5 grass>toxic:0.5 grass>drake:0.5 grass>sky:0.5 grass>slime:2 grass>camo:0.5 electric>water:2 electric>grass:0.5 electric>electric:0.5 electric>rock:0.5 electric>drake:0.5 electric>sound:2 electric>bone:0.5 electric>alien:2 electric>sky:2 electric>light:0.5 electric>cyber:0.5 rock>fire:2 rock>grass:0.5 rock>electric:2 rock>ice:2 rock>bug:2 rock>metal:0.5 rock>slime:0.5 rock>paper:0.5 ice>fire:0.5 ice>water:0.5 ice>grass:2 ice>ice:0.5 ice>bug:2 ice>metal:0.5 ice>drake:2 ice>sky:2 bug>fire:0.5 bug>grass:2 bug>rock:0.5 bug>ghost:0.5 bug>mind:2 bug>metal:0.5 bug>pixie:0.5 bug>sky:0.5 bug>time:2 bug>cyber:2 ghost>normal:0 ghost>ghost:2 ghost>mind:2 ghost>rainbow:2 ghost>cosmic:2 mind>mind:0.5 mind>metal:0.5 mind>toxic:2 mind>drake:2 mind>cosmic:2 mind>alien:0.5 mind>camo:0.5 metal>fire:0.5 metal>water:0.5 metal>electric:0.5 metal>rock:2 metal>ice:2 metal>metal:0.5 metal>pixie:2 metal>paper:2 toxic>grass:2 toxic>rock:0.5 toxic>ghost:0.5 toxic>metal:0 toxic>toxic:0.5 toxic>pixie:2 toxic>bone:0.5 toxic>light:2 pixie>fire:0.5 pixie>ghost:2 pixie>metal:0.5 pixie>toxic:0.5 pixie>drake:2 pixie>light:0.5 drake>metal:0.5 drake>pixie:0 drake>drake:2 drake>bone:2 rainbow>ghost:2 rainbow>mind:2 rainbow>metal:0.5 rainbow>toxic:2 rainbow>rainbow:0.5 cosmic>rock:2 cosmic>metal:0.5 cosmic>drake:2 cosmic>rainbow:0.5 cosmic>cosmic:0.5 cosmic>sound:2 cosmic>alien:0.5 cosmic>light:2 cosmic>time:2 sound>ice:2 sound>bug:2 sound>mind:2 sound>metal:0.5 sound>cosmic:0.5 sound>sound:0.5 sound>alien:2 sound>camo:2 bone>grass:0.5 bone>electric:2 bone>ghost:2 bone>metal:0.5 bone>alien:2 alien>normal:2 alien>metal:2 alien>toxic:2 alien>cosmic:0.5 alien>alien:0.5 sky>fire:2 sky>rock:0.5 sky>metal:0.5 sky>pixie:2 sky>paper:2 slime>metal:2 slime>toxic:0.5 slime>sound:2 slime>sky:2 slime>slime:0.5 slime>paper:0.5 light>ghost:2 light>rainbow:0.5 light>cosmic:2 light>slime:2 light>light:0.5 light>paper:0.5 light>camo:2 paper>fire:0.5 paper>rock:2 paper>metal:0.5 paper>slime:2 paper>light:2 paper>paper:0.5 time>ghost:0.5 time>metal:2 time>cosmic:0.5 time>slime:2 time>paper:2 time>time:0.5 camo>bug:2 camo>mind:2 camo>metal:0.5 camo>light:0.5 camo>camo:0.5 cyber>water:0.5 cyber>grass:0.5 cyber>mind:2 cyber>metal:2 cyber>paper:2 cyber>cyber:0.5'.split(' ');
const OLD_TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'rock', 'ice', 'bug', 'ghost', 'mind', 'metal', 'toxic', 'pixie', 'drake',
  'rainbow', 'cosmic', 'sound', 'bone', 'alien', 'sky', 'slime', 'light', 'paper', 'time', 'camo', 'cyber'];
const only = process.env.T21_TYPE;
const types = only ? [only] : TYPES;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  t.ok(!only || TYPES.includes(only), `T21_TYPE "${only}" is cozy or treasure (or unset)`);
  if (only && !TYPES.includes(only)) return;
  const page = await openGame(browser, base);
  await newGame(page, 0);

  const r = await page.evaluate(async ({ types, ALL, OLD_SHAPES, OLD_CHART, OLD_TYPES }) => {
    const S = await import('/src/species.js');
    const SH = await import('/src/shapes.js');
    const R = await import('/src/fxrecipes.js');
    const B = await import('/src/blocks.js');
    const THREE = await import('three');
    const { sound } = await import('/src/sound.js');
    const out = { problems: [], ids: [], info: {} };
    const bad = msg => out.problems.push(msg);
    const all = Object.entries(S.SPECIES);
    // 1. Colours, effects, sounds, wool.
    out.colors = Object.keys(S.TYPE_COLORS).length;
    for (const type of ALL) {
      if (!S.TYPE_COLORS[type]) bad(`${type}: no TYPE_COLORS`);
      if (!R.FX_COLORS[type] || !R.TRAVEL[type] || !R.IMPACT[type]) bad(`${type}: no fx recipes or colours`);
      if (R.TRAVEL[type] === R.TRAVEL.normal || R.IMPACT[type] === R.IMPACT.normal) bad(`${type}: still the normal fx recipe`);
      if (!sound.has(`fx:${type}`)) bad(`${type}: no fx:${type} sound`);
    }
    if (B.WOOL.cozy !== 68 || B.WOOL.treasure !== 69) bad(`wool ids ${B.WOOL.cozy}, ${B.WOOL.treasure}`);
    if (B.BLOCKS[68]?.name !== 'Cozy Wool' || B.BLOCKS[69]?.name !== 'Treasure Wool') bad(`wool names ${B.BLOCKS[68]?.name}, ${B.BLOCKS[69]?.name}`);
    for (const [id, was] of [['lightsout', 'blazedash'], ['crownjewel', 'rootslam']]) {
      if (!R.SIG[id] || R.SIG[id] === R.SIG[was]) bad(`${id}: no signature fx of its own`);
    }
    // 2. Chart.
    const eff = S.effectiveness;
    const must = [['cozy', 'ice', 2], ['cozy', 'ghost', 2], ['cozy', 'cyber', 2], ['bug', 'cozy', 2], ['toxic', 'cozy', 2], ['ice', 'cozy', 0.5], ['cozy', 'cozy', 0.5],
      ['treasure', 'drake', 2], ['treasure', 'pixie', 2], ['treasure', 'cozy', 2], ['slime', 'treasure', 2], ['toxic', 'treasure', 2],
      ['cyber', 'treasure', 2], ['normal', 'treasure', 0.5], ['treasure', 'treasure', 0.5]];
    for (const [a, d, v] of must) if (eff(a, d) !== v) bad(`${a}>${d} should be ${v}, is ${eff(a, d)}`);
    const oldNow = [];
    for (const a of OLD_TYPES) for (const d of OLD_TYPES) { const e = eff(a, d); if (e !== 1) oldNow.push(`${a}>${d}:${e}`); }
    if (oldNow.join(' ') !== OLD_CHART.join(' ')) {
      const was = new Set(OLD_CHART), now = new Set(oldNow);
      bad(`the old 26 x 26 chart changed: lost ${OLD_CHART.filter(x => !now.has(x))}, new ${oldNow.filter(x => !was.has(x))}`);
    }
    out.oldPairs = oldNow.length;
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
    const info = id => S.moveInfo(id).text;
    out.infos = { hotcocoa: info('hotcocoa'), bedtimestory: info('bedtimestory'), pillowfight: info('pillowfight'), gemtoss: info('gemtoss'), bling: info('bling') };
    out.sigs = [['dozeram', 'lightsout'], ['crownguard', 'crownjewel']]
      .filter(([id, m]) => !S.SPECIES[id]?.learn.some(([l, mm]) => l === 30 && mm === m)).map(([id]) => id);
    out.bts = S.makeCreature('snoozebear', 20).moves.includes('bedtimestory');
    for (const id of ['snuggle', 'pillowfight', 'warmhug', 'hotcocoa', 'bedtimestory', 'lightsout', 'coinflip', 'gemtoss', 'goldrush', 'bling', 'crownjewel']) {
      if (!S.MOVES[id]) bad(`no move ${id}`);
      if (sound.has(id)) bad(`move ${id} is also a sound name`);
    }
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
    const newIds = new Set(all.filter(([, s]) => ALL.includes(s.type)).map(([id]) => id));
    const T18_SHAPES = ['hourglass', 'pendulum', 'alarmclock', 'sunmoon', 'bushblock', 'sandcastle', 'stonecube', 'igloo', 'pixelblob', 'cursor', 'wifiwing', 'glitchghost'];
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
        if (OLD_SHAPES.includes(shape) || T18_SHAPES.includes(shape)) bad(`${id}: shape ${shape} is an old one`);
        if (typeof SH.SHAPES[shape] !== 'function') bad(`${id}: no SHAPES.${shape} builder`);
        if (ids.filter(o => S.SPECIES[o].model.shape === shape).some(o => fam(o) !== fam(id))) bad(`${id}: shape ${shape} is shared by two families`);
        if (all.some(([o, os]) => os.model.shape === shape && o !== id && !ids.includes(o))) bad(`${id}: shape ${shape} is used by an older species`);
        if (names.filter(nm => nm === s.name.toLowerCase()).length !== 1) bad(`${id}: name ${s.name} is not unique`);
        if (!s.desc || s.desc.length > 110) bad(`${id}: desc is ${s.desc?.length} characters`);
        const where = whereOf(id);
        if (!where.length) bad(`${id}: not in any SPAWNS table`);
        for (const e of where) {
          if (e.when !== `home:${type}`) bad(`${id}: spawn entry ${e.when} in ${e.biome} (want home:${type})`);
          if (e.w > 1.5) bad(`${id}: weight ${e.w} in ${e.biome}`);
        }
        if (Object.keys(S.SPAWNS).some(b => !where.some(e => e.biome === b))) bad(`${id}: not in every SPAWNS table`);
        if (!(S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === s.type))) bad(`${id}: no move of its own type at Lv 20`);
        try {
          const m = S.buildModel(id);
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
          // 5. Sparkle: every Treasure model twinkles, nobody else.
          const sp = m.userData.parts.sparkle;
          if (type === 'treasure') {
            if (sp?.length !== 3) bad(`${id}: ${sp?.length} sparkles (want 3)`);
            else {
              const before = sp.map(s => s.g.position);
              const vis = sp.map(() => 0); let any = 0, steps = 0;
              for (let tt = 0; tt <= 3.0001; tt += 0.05) {
                S.animateModel(m, tt, false);
                steps++;
                sp.forEach((s, i) => { if (s.g.visible) vis[i]++; });
                if (sp.some(s => s.g.visible)) any++;
              }
              vis.forEach((v, i) => { if (v === 0 || v === steps) bad(`${id}: glint ${i} is ${v === 0 ? 'never' : 'always'} visible`); });
              if (any / steps < 0.4) bad(`${id}: a glint is visible in only ${Math.round(100 * any / steps)}% of the steps`);
              if (sp.some((s, i) => s.g.position !== before[i])) bad(`${id}: a glint position was reallocated`);
            }
          } else if (sp) bad(`${id}: only Treasure creatures sparkle`);
          S.disposeModel(m);
        } catch (e) { bad(`${id}: model failed: ${e.message}`); }
      }
    }
    // Nobody else has a home: spawn entry or a sparkle.
    for (const [id] of all) {
      if (newIds.has(id)) continue;
      if (whereOf(id).some(e => String(e.when || '').startsWith('home:'))) bad(`${id}: only Cozy and Treasure creatures spawn at homes`);
      if (S.buildModel(id).userData.parts.sparkle) bad(`${id}: only Treasure creatures sparkle`);
    }
    out.normal = all.filter(([, s]) => !s.legendary).length;
    return out;
  }, { types, ALL: TYPES, OLD_SHAPES, OLD_CHART, OLD_TYPES });

  const missing = r.problems;
  t.ok(r.colors === 28, `28 types in TYPE_COLORS (${r.colors})`);
  t.ok(!missing.length, `two-types data, chart, moves, species, models and sparkle ${missing.join('; ')}`);
  t.ok(r.oldPairs === OLD_CHART.length, `the old chart still has ${OLD_CHART.length} non-1 pairs (${r.oldPairs})`);
  t.ok(r.infos.hotcocoa.includes('heals you'), `Hot Cocoa text: ${r.infos.hotcocoa}`);
  t.ok(r.infos.bedtimestory.includes('puts the foe to sleep'), `Bedtime Story text: ${r.infos.bedtimestory}`);
  t.ok(r.infos.pillowfight.includes('hits 2 to 4 times') && r.infos.gemtoss.includes('hits 2 to 4 times'), `Pillow Fight / Gem Toss text: ${r.infos.pillowfight} | ${r.infos.gemtoss}`);
  t.ok(r.infos.bling.includes("lowers the foe's attack"), `Bling! text: ${r.infos.bling}`);
  t.ok(!r.sigs.length, `Dozeram and Crownguard learn their special at 30 ${r.sigs.join(', ')}`);
  t.ok(r.bts, 'a Lv 20 Snoozebear knows Bedtime Story');
  t.ok(only || r.normal === 196, `${r.normal} normal species`);
  console.log(`  sizes ${Object.entries(r.info).map(([k, v]) => `${k} ${v}`).join(', ')}`);

  /* 6. The home condition with fake homes */
  if (!only) {
    await platform(page, { day: true });
    const h = await page.evaluate(async () => {
      const g = window.pokecraft, cm = g.creatures;
      const R = await import('/src/spawnrules.js');
      const S = await import('/src/species.js');
      const Bk = await import('/src/book.js');
      const out = {};
      g.weather.set('clear');
      cm.weather = null;
      cm.clear();
      cm.spawnTimer = 1e9;
      const typeOf = e => S.SPECIES[e[0]].type;
      const picks = (ctx, n) => { const res = []; for (let i = 0; i < n; i++) res.push(cm.pickEntry('plains', ctx)); return res; };
      const share = (list, type) => list.filter(e => typeOf(e) === type).length / list.length;
      out.text = R.condText('home:cozy');
      out.toast = R.condToast('home:treasure');
      const rows = Bk.spawnInfo('snugbun');
      out.rows = rows.map(x => `${x.name}|${x.words}|${x.rarity}`);
      out.rowsTreasure = Bk.spawnInfo('crownguard').map(x => `${x.name}|${x.rarity}`);
      const none = picks({ night: false, golden: null, homes: [] }, 3000);
      out.noHome = none.filter(e => ['cozy', 'treasure'].includes(typeOf(e))).length;
      const base = { night: false, golden: null };
      const c1 = picks({ ...base, homes: [{ type: 'cozy', full: false }] }, 60000);
      out.cozy = share(c1, 'cozy'); out.cozyTreasure = share(c1, 'treasure');
      out.cozyOnlyHome = c1.filter(e => typeOf(e) === 'cozy').every(e => e[1] === 'home:cozy');
      out.eve = share(picks({ ...base, evening: true, homes: [{ type: 'cozy', full: false }] }, 60000), 'cozy');
      out.full = share(picks({ ...base, homes: [{ type: 'cozy', full: true }] }, 60000), 'cozy');
      const tr = picks({ ...base, homes: [{ type: 'treasure', full: false }] }, 60000);
      out.treasure = tr.filter(e => typeOf(e) === 'treasure').length; out.treasureCozy = tr.filter(e => typeOf(e) === 'cozy').length;
      cm.list.push({ when: 'home:cozy' });
      out.cozyMax = picks({ ...base, homes: [{ type: 'cozy', full: true }] }, 20000).filter(e => typeOf(e) === 'cozy').length;
      cm.list.length = 0;

      // End to end: a fake home on the platform.
      const sx = Math.floor(g.spawnPoint.x), sz = Math.floor(g.spawnPoint.z), py = 43;
      const pos = g.player.pos.clone();
      const spot = { x: sx + 2, y: py, z: sz + 1 };
      let home = { type: 'cozy', x: sx, y: py, z: sz, full: true, spawnSpot: () => ({ ...spot }) };
      let homes = [home];
      cm.env = { time: () => 0.25, friends: () => [], homes: () => homes };
      const oldShare = R.HOME_SPAWN.cozy.share;
      R.HOME_SPAWN.cozy.share = 1;
      const seen = [];
      const old = cm.onSpawn;
      cm.onSpawn = w => { seen.push({ when: w.when, x: w.pos.x, y: w.pos.y, z: w.pos.z, type: w.species.type }); old?.(w); };
      let maxAtOnce = 0;
      const run = n => { for (let i = 0; i < n; i++) { cm.update(0.7, pos, g.spawnPoint, false, false); maxAtOnce = Math.max(maxAtOnce, cm.list.filter(w => w.when === 'home:cozy').length); } };
      cm.spawnTimer = 0;
      run(300);
      out.e2e = seen.filter(s => s.when === 'home:cozy');
      out.e2eAt = out.e2e.length > 0 && out.e2e.every(s => s.x === spot.x + 0.5 && s.y === spot.y && s.z === spot.z + 0.5 && s.type === 'cozy');
      out.maxAtOnce = maxAtOnce;
      out.others = seen.filter(s => s.when !== 'home:cozy' && ['cozy', 'treasure'].includes(s.type)).length;
      // spawnSpot returning null: no spawn
      cm.clear(); seen.length = 0;
      home.spawnSpot = () => null;
      cm.spawnTimer = 0; run(100);
      out.nullSpot = seen.filter(s => s.when === 'home:cozy').length;
      // far away: it is removed
      home.spawnSpot = () => ({ ...spot });
      cm.clear(); cm.spawnTimer = 0; run(40);
      out.beforeFar = cm.list.filter(w => w.when === 'home:cozy').length;
      const far = pos.clone(); far.x += 60;
      home = { ...home, x: sx, z: sz };
      homes = [home];
      cm.spawnTimer = 0;
      cm.update(0.7, far, g.spawnPoint, false, false);
      for (let i = 0; i < 4; i++) { cm.spawnTimer = 0; cm.update(0.7, far, g.spawnPoint, false, false); }
      out.afterFar = cm.list.filter(w => w.when === 'home:cozy').length;
      // no homes: none
      cm.clear(); seen.length = 0; homes = [];
      cm.spawnTimer = 0; run(100);
      out.noHomes = seen.filter(s => ['cozy', 'treasure'].includes(s.type)).length;
      // a test-only home type needs no code change
      R.HOME_SPAWN.testonly = { share: 1 };
      for (const list of Object.values(S.SPAWNS)) list.push(['fluffin', 1, 'home:testonly']);
      homes = [{ type: 'testonly', x: sx, y: py, z: sz, full: false, spawnSpot: () => ({ ...spot }) }];
      cm.clear(); seen.length = 0; cm.spawnTimer = 0; run(100);
      out.testonly = seen.filter(s => s.when === 'home:testonly').length;
      for (const list of Object.values(S.SPAWNS)) list.pop();
      delete R.HOME_SPAWN.testonly;
      R.HOME_SPAWN.cozy.share = oldShare;
      cm.onSpawn = old;
      cm.env = { time: () => g.time, friends: () => (g.mp?.active ? [...g.mp.others.values()].map(a => a.pos) : []) };
      cm.spawnTimer = 1e9;
      cm.clear();
      cm.weather = g.weather;
      return out;
    });
    t.ok(h.text === 'near a cozy home', `condText: ${h.text}`);
    t.ok(/treasure/.test(h.toast || ''), `condToast: ${h.toast}`);
    t.ok(h.rows.length === 1 && h.rows[0].startsWith('Near a cozy home|null|'), `Book: one row "Near a cozy home" (${h.rows})`);
    t.ok(h.rowsTreasure.length === 1 && h.rowsTreasure[0] === 'Near a treasure home|rare', `Book: Crownguard is rare near a treasure home (${h.rowsTreasure})`);
    t.ok(h.noHome === 0, `without a home no Cozy or Treasure creature is picked (${h.noHome})`);
    t.ok(h.cozy > 0.012 && h.cozy < 0.022 && h.cozyTreasure === 0 && h.cozyOnlyHome, `near a cozy home about 1/60 picks are Cozy (${h.cozy}), never Treasure`);
    t.ok(h.eve > h.cozy * 1.25 && h.eve < h.cozy * 1.8, `evening: about x1.5 (${h.eve} vs ${h.cozy})`);
    t.ok(h.full > h.cozy * 1.6 && h.full < h.cozy * 2.5, `5 hearts: about x2 (${h.full} vs ${h.cozy})`);
    t.ok(h.treasure >= 15 && h.treasure <= 90 && h.treasureCozy === 0, `near a treasure home 15-90 of 60000 picks are Treasure (${h.treasure})`);
    t.ok(h.cozyMax === 0, 'with one visitor already out, no more are picked');
    t.ok(h.e2eAt && h.maxAtOnce === 1, `a cozy visitor appears on the home's spot, never two at once (${h.e2e.length} spawns, max ${h.maxAtOnce})`);
    t.ok(h.others === 0, 'the home spawns only that home type');
    t.ok(h.nullSpot === 0, 'spawnSpot returning null: no spawn');
    t.ok(h.beforeFar === 1 && h.afterFar === 0, `60 blocks away the visitor leaves (${h.beforeFar} -> ${h.afterFar})`);
    t.ok(h.noHomes === 0, 'with no homes, nothing spawns');
    t.ok(h.testonly >= 1, `a test-only home type works with no code change (${h.testonly})`);
  }

  /* 7. Screenshots: portrait grid, white background, names under the portraits */
  if (!r.problems.length && r.ids.length === (only ? 7 : 14)) {
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
    save(only ? `two-types-${only}.png` : 'two-types.png', shots.grid);
    for (const [id, url] of Object.entries(shots.singles)) save(`creature-${id}.png`, url);
    t.ok(shots.grid.length > 20000, 'portrait grid drawn');
  }

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
