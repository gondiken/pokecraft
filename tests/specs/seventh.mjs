// T4b: each type's 7th creature (19 in all; Puzzlet is Mind's, Origrane moved to Paper in T9). Run one group with T4B_GROUP=A|B|C, or all of them.
// Checks data, spawns, moves, the model (size, idle animation) and saves portraits to
// tests/screenshots/seventh-creatures[-X].png and creature-<id>.png.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const GROUPS = { A: ['stitchums', 'waxwobble', 'jellume', 'bonzoise', 'wattwink', 'amethump', 'flurrydome'],
  B: ['twirlshell', 'lanterboo', 'puzzlet', 'tickatin', 'gurglepot', 'cuppix'],
  C: ['nimbrake', 'chromacurl', 'voidle', 'clawdio', 'finnibone', 'zorbit'],
  W11: ['drizzup'], // wave 11: each task adds its 7th here (T35: drizzup)
  W12: ['bambooze'], // wave 12 (T37: bambooze)
  W14: ['pipsqueak'], // wave 14 (T40a: pipsqueak; the other wave 14 tasks add theirs)
  W15: ['partypop'], // wave 15 (T44: partypop; the other wave 15 tasks add theirs)
  W16: ['turrock', 'fizzbomb'] }; // T49 (the Castle: Turrock); the Bubble Well: Fizzbomb
const OLD_SHAPES = ['quad', 'blob', 'biped', 'bird', 'serpent', 'bug', 'guardian', 'butterfly', 'moth', 'star', 'robe', 'hopper',
  'planet', 'comet', 'cloud', 'tall', 'squid', 'bat', 'drum', 'ape', 'bell', 'armadillo', 'wyvern', 'fish', 'nut', 'drone', 'wisp',
  'puff', 'crystal', 'skull', 'bonedog', 'dino', 'ufo', 'visitor', 'tripod'];
const group = process.env.T4B_GROUP;
const ids = group ? GROUPS[group] : Object.values(GROUPS).flat();

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  t.ok(!!ids, `T4B_GROUP "${group}" is A, B, C, W11, W12, W14 or W15 (or unset)`);
  if (!ids) return;
  const page = await openGame(browser, base);
  const r = await page.evaluate(async ({ ids, OLD_SHAPES, full }) => {
    const S = await import('/src/species.js');
    const SH = await import('/src/shapes.js');
    const { REALMS } = await import('/src/realms.js'); // T35: creatures that live only in a realm
    const SPAWN_TABLES = { ...S.SPAWNS, ...Object.fromEntries(Object.values(REALMS).flatMap(r => Object.entries(r.spawns).filter(([b]) => b !== 'cave').map(([b, l]) => [`realm:${r.id}:${b}`, l]))) };
    const THREE = await import('three');
    const out = { missing: ids.filter(id => !S.SPECIES[id]), problems: [], types: [], sig: {}, hue: null };
    if (out.missing.length) return out;
    const bad = (id, msg) => out.problems.push(`${id}: ${msg}`);
    const all = Object.entries(S.SPECIES);
    const evolvesInto = new Set(all.map(([, s]) => s.evolve?.into).filter(Boolean));
    const names = all.map(([, s]) => s.name.toLowerCase());
    const shapeUse = {};
    for (const [, s] of all) shapeUse[s.model.shape] = (shapeUse[s.model.shape] || 0) + 1;
    const dark = new Set(['ghost', 'cosmic']);
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
    for (const id of ids) {
      const s = S.SPECIES[id];
      out.types.push(s.type);
      if (s.evolve || evolvesInto.has(id) || s.legendary) bad(id, 'must be single-stage and not legendary');
      const shape = s.model.shape;
      if (OLD_SHAPES.includes(shape)) bad(id, `shape ${shape} is an old one`);
      if (typeof SH.SHAPES[shape] !== 'function') bad(id, `no SHAPES.${shape} builder`);
      if (shapeUse[shape] !== 1) bad(id, `shape ${shape} is used by ${shapeUse[shape]} species`);
      if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(id, `name ${s.name} is not unique`);
      if (!s.desc || s.desc.length > 110) bad(id, `desc is ${s.desc?.length} characters`);
      // spawns
      const where = Object.entries(SPAWN_TABLES).flatMap(([biome, list]) => list.filter(e => e[0] === id).map(e => ({ biome, w: e[1], when: e[2] })));
      if (!where.length) bad(id, 'is in no SPAWNS table');
      for (const e of where) {
        if (s.type === 'ice' && !['snow', 'taiga', 'peak'].includes(e.biome)) bad(id, `ice in ${e.biome}`);
        if (s.type === 'cosmic' && e.when !== 'night') bad(id, `cosmic in ${e.biome} not at night`);
        if (s.type === 'ghost' && e.when !== 'night' && e.biome !== 'cave') bad(id, `ghost in ${e.biome} by day`);
        if (s.type === 'rainbow' && e.when !== 'day') bad(id, `rainbow in ${e.biome} not by day`);
        if (s.waterOnly && e.biome !== 'water') bad(id, `waterOnly in ${e.biome}`);
        if (e.w > 1.5) bad(id, `weight ${e.w} in ${e.biome} is over 1.5`);
      }
      // moves
      const c = S.makeCreature(id, 5);
      if (c.moves.length < 2) bad(id, `only ${c.moves.length} moves at Lv 5`);
      if (!S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === s.type)) bad(id, 'no move of its own type at Lv 20');
      for (const [, m] of s.learn) if (!S.MOVES[m]) bad(id, `learnset move ${m} does not exist`);
      if (!(S.makeCreature(id, 12).hp > 0)) bad(id, 'Lv 12 has no HP');
      // model
      try {
        const m = S.buildModel(id);
        S.animateModel(m, 0);
        const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
        if (size.y < 0.35 || size.y > 2.6) bad(id, `height ${size.y.toFixed(2)} outside 0.35-2.6`);
        if (size.x > 2.6 || size.z > 2.6) bad(id, `width/depth ${size.x.toFixed(2)}/${size.z.toFixed(2)} over 2.6`);
        if (box.min.y < -0.1) bad(id, `goes under the ground (min.y ${box.min.y.toFixed(2)})`);
        S.animateModel(m, 0.3, false); const a = sigOf(m);
        S.animateModel(m, 1.1, false); const b = sigOf(m);
        if (Math.abs(a - b) < 1e-6) bad(id, 'no idle animation');
        if (id === 'chromacurl') {
          const hueAt = t => {
            S.animateModel(m, t, false);
            let best = null;
            m.traverse(o => { if (o.isMesh && !best && !o.userData.eye && o.material.color) best = o; });
            const hsl = {}; best.material.color.getHSL(hsl);
            return hsl.h;
          };
          const h0 = hueAt(0), h2 = hueAt(2);
          const d = Math.abs(h0 - h2);
          out.hue = Math.min(d, 1 - d);
        }
        S.disposeModel(m);
      } catch (e) { bad(id, `model failed: ${e.message}`); }
    }
    out.fullTypes = full ? ['normal', 'fire', 'water', 'grass', 'electric', 'rock', 'ice', 'bug', 'ghost', 'mind', 'metal', 'toxic', 'pixie', 'drake', 'rainbow', 'cosmic', 'sound', 'bone', 'alien'] : null;
    return out;
  }, { ids, OLD_SHAPES, full: !group });

  if (r.missing.length) {
    t.ok(false, `species exist (missing: ${r.missing.join(', ')})`);
  } else {
    t.ok(new Set(r.types).size === r.types.length, `one creature per type (${r.types.join(', ')})`);
    if (r.fullTypes) t.ok(r.fullTypes.length === 19 && r.fullTypes.every(x => r.types.includes(x)), `all 19 types covered (${r.fullTypes.length} original types)`);
    t.ok(!r.problems.length, `all ${ids.length} creatures pass the checks ${r.problems.join('; ')}`);
    if (ids.includes('chromacurl')) t.ok(r.hue > 0.1, `Chromacurl changes colour (hue moved ${r.hue?.toFixed(2)})`);
  }

  // Portraits: 5 per row, white background, name under each; plus a close-up of each.
  if (!r.missing.length) {
    const shots = await page.evaluate(async ids => {
      const { portrait } = await import('/src/ui.js');
      const S = await import('/src/species.js');
      const W = 220, H = 190, LABEL = 26, COLS = 5, rows = Math.ceil(ids.length / COLS);
      const cv = document.createElement('canvas');
      cv.width = W * COLS; cv.height = (H + LABEL) * rows;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
      const singles = {};
      for (let i = 0; i < ids.length; i++) {
        const img = new Image();
        img.src = portrait(ids[i], W, H);
        await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]); // decode() can hang in a busy headless browser
        const x = (i % COLS) * W, y = Math.floor(i / COLS) * (H + LABEL);
        ctx.drawImage(img, x, y);
        ctx.fillText(S.SPECIES[ids[i]].name, x + W / 2, y + H + 18);
        singles[ids[i]] = portrait(ids[i], 480, 400);
      }
      return { grid: cv.toDataURL(), singles };
    }, ids);
    const save = (name, url) => {
      const file = path.join(SHOTS, name);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(`  screenshot ${file}`);
    };
    save(group ? `seventh-creatures-${group}.png` : 'seventh-creatures.png', shots.grid);
    for (const id of ids) save(`creature-${id}.png`, shots.singles[id]);
    t.ok(shots.grid.length > Math.min(20000, ids.length * 6000), 'portrait grid drawn');
  }
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
