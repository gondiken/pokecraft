// Bone and Alien types: six creatures each from T4a (plus T4b's 7th of each type), spawns, learnsets, the type chart, new body shapes and
// moves, and a portrait grid (tests/screenshots/new-creatures.png + creature-<id>.png).
import fs from 'node:fs';
import path from 'node:path';
import { openGame, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const IDS = ['skullop', 'skullossal', 'rattlepup', 'howlbone', 'dinobit', 'stompasaur',
  'saucerling', 'ufomax', 'blipling', 'blipstar', 'podlet', 'tallipod'];

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  const r = await page.evaluate(async ids => {
    const S = await import('/src/species.js');
    const spawners = new Set(Object.values(S.SPAWNS).flat().map(e => e[0]));
    const out = { types: {}, bad: [] };
    for (const type of ['bone', 'alien']) {
      const mons = Object.entries(S.SPECIES).filter(([, s]) => s.type === type).map(([id]) => id);
      const own = mons.filter(id => ids.includes(id)); // T4a's six per type (T4b adds a 7th)
      const olderShapes = new Set(Object.entries(S.SPECIES).filter(([id]) => !ids.includes(id)).map(([, s]) => s.model.shape));
      const shapes = new Set(own.map(id => S.SPECIES[id].model.shape));
      out.types[type] = {
        mons,
        own: own.length,
        reachable: mons.every(id => spawners.has(id) || mons.some(o => S.SPECIES[o].evolve?.into === id && spawners.has(o))),
        moves: Object.values(S.MOVES).filter(m => m.type === type).length,
        knows: mons.every(id => S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === type)),
        shapes: shapes.size,
        sharedShapes: [...shapes].filter(x => olderShapes.has(x)),
        color: !!S.TYPE_COLORS[type],
      };
    }
    for (const id of ids) {
      try {
        const g = S.buildModel(id);
        for (let k = 0; k < 4; k += 0.4) S.animateModel(g, k, k > 2);
        S.disposeModel(g);
      } catch (e) { out.bad.push(`${id}: ${e.message}`); }
    }
    out.chart = [['bone', 'ghost', 2], ['bone', 'electric', 2], ['bone', 'alien', 2], ['electric', 'bone', 0.5], ['alien', 'normal', 2],
      ['alien', 'metal', 2], ['alien', 'toxic', 2], ['sound', 'alien', 2], ['toxic', 'bone', 0.5], ['water', 'bone', 2], ['drake', 'bone', 2],
      ['normal', 'bone', 0.5], ['mind', 'alien', 0.5], ['cosmic', 'alien', 0.5], ['electric', 'alien', 2]]
      .filter(([a, d, v]) => S.effectiveness(a, d) !== v).map(([a, d, v]) => `${a}>${d} should be ${v}, is ${S.effectiveness(a, d)}`);
    out.evolve = ids.filter(id => S.SPECIES[id].evolve).map(id => `${id}>${S.SPECIES[id].evolve.into}@${S.SPECIES[id].evolve.level}`);
    out.bonetoss = S.moveInfo('bonetoss').text;
    out.sig = [S.makeCreature('howlbone', 31).moves.includes('rattledance') || S.SPECIES.howlbone.learn.some(([l, m]) => l === 30 && m === 'rattledance'),
      S.SPECIES.ufomax.learn.some(([l, m]) => l === 30 && m === 'mothership')];
    const boneIn = Object.entries(S.SPAWNS).map(([b, l]) => [b, l.filter(e => S.SPECIES[e[0]].type === 'bone')]);
    out.boneSurface = boneIn.filter(([b, l]) => b !== 'cave' && l.length).map(([b]) => b);
    const cave = S.SPAWNS.cave.filter(e => !String(e[2] || '').startsWith('home:')), total = cave.reduce((a, e) => a + e[1], 0); // home visitors (T21) never compete with the biome's creatures
    out.caveBone = boneIn.find(([b]) => b === 'cave')[1].length;
    out.caveShare = cave.filter(e => S.SPECIES[e[0]].type === 'bone').reduce((a, e) => a + e[1], 0) / total;
    out.count = Object.values(S.SPECIES).filter(s => !s.legendary).length;
    return out;
  }, IDS);
  for (const type of ['bone', 'alien']) {
    const i = r.types[type];
    t.ok(i.mons.length === 7 && i.own === 6, `${type}: 7 creatures, 6 of them T4a's (${i.mons.join(', ')})`);
    t.ok(i.reachable, `${type}: every creature spawns or evolves from one that does`);
    t.ok(i.moves >= 4 && i.knows, `${type}: ${i.moves} moves, every creature knows one at Lv 20`);
    t.ok(i.shapes === 3 && !i.sharedShapes.length, `${type}: 3 own body shapes ${i.sharedShapes.join(', ')}`);
    t.ok(i.color, `${type}: has a type colour`);
  }
  t.ok(!r.boneSurface.length, `bone creatures spawn only in caves (surface: ${r.boneSurface.join(', ') || 'none'})`);
  t.ok(r.caveBone >= 5 && r.caveShare >= 0.2, `caves have ${r.caveBone} bone entries, ${(r.caveShare * 100).toFixed(0)}% of the table`);
  t.ok(!r.chart.length, `type chart ${r.chart.join('; ')}`);
  t.ok(!r.bad.length, `all 12 models build and animate ${r.bad.join('; ')}`);
  t.ok(r.evolve.length === 6, `6 evolutions (${r.evolve.join(', ')})`);
  t.ok(r.bonetoss.includes('hits 1 to 5 times'), `Bone Toss text: ${r.bonetoss}`);
  t.ok(r.sig.every(Boolean), 'Howlbone and Ufomax learn their special moves at 30');
  t.ok(r.count === 231, `${r.count} normal species`);

  // Portrait grid: 4 columns x 3 rows, and a close-up of each.
  const shots = await page.evaluate(async ids => {
    const { portrait } = await import('/src/ui.js');
    const W = 220, H = 190;
    const cv = document.createElement('canvas');
    cv.width = W * 4; cv.height = H * 3;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#7fa8c8';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const singles = {};
    for (let i = 0; i < ids.length; i++) {
      const url = portrait(ids[i], W, H);
      const img = new Image();
      img.src = url;
      await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]); // decode() can hang in a busy headless browser
      ctx.drawImage(img, (i % 4) * W, Math.floor(i / 4) * H);
      singles[ids[i]] = portrait(ids[i], 480, 400);
    }
    return { grid: cv.toDataURL(), singles };
  }, IDS);
  const save = (name, url) => {
    const file = path.join(SHOTS, name);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`  screenshot ${file}`);
  };
  save('new-creatures.png', shots.grid);
  for (const id of IDS) save(`creature-${id}.png`, shots.singles[id]);
  t.ok(shots.grid.length > 20000, 'portrait grid drawn');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
