// Every type has the same number of creatures; every creature can be found, evolves into
// something real, and has a model.
import { openGame } from '../helpers.mjs';

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  const r = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const ids = Object.keys(S.SPECIES);
    const byType = {};
    for (const id of ids) (byType[S.SPECIES[id].type] ||= []).push(id);
    const spawns = new Set(Object.values(S.SPAWNS).flat().map(e => e[0]));
    const badModels = [];
    for (const id of ids) {
      try { S.disposeModel(S.buildModel(id)); } catch (e) { badModels.push(`${id}: ${e.message}`); }
    }
    const names = ids.map(id => S.SPECIES[id].name);
    return {
      count: ids.length,
      sizes: Object.fromEntries(Object.entries(byType).map(([t, l]) => [t, l.length])),
      types: Object.keys(S.TYPE_COLORS),
      notFound: ids.filter(id => !spawns.has(id) && !ids.some(o => S.SPECIES[o].evolve?.into === id && spawns.has(o))),
      badSpawns: [...spawns].filter(id => !S.SPECIES[id]),
      badEvolve: ids.filter(id => S.SPECIES[id].evolve && S.SPECIES[id].evolve.into in S.SPECIES === false),
      crossType: ids.filter(id => S.SPECIES[id].evolve && S.SPECIES[S.SPECIES[id].evolve.into]?.type !== S.SPECIES[id].type),
      dupNames: names.filter((n, i) => names.indexOf(n) !== i),
      noMoves: ids.filter(id => S.makeCreature(id, 5).moves.length === 0),
      badModels,
    };
  });
  const sizes = Object.values(r.sizes);
  t.ok(r.types.every(t => r.sizes[t]) && new Set(sizes).size === 1,
    `every type has the same number of creatures (${JSON.stringify(r.sizes)})`);
  t.ok(r.count === r.types.length * 6, `${r.count} creatures, 6 per type`);
  t.ok(!r.notFound.length, `every creature can be caught, or evolved from one that can ${r.notFound.join(', ')}`);
  t.ok(!r.badSpawns.length, `spawn tables only list real creatures ${r.badSpawns.join(', ')}`);
  t.ok(!r.badEvolve.length && !r.crossType.length, `evolutions are real and keep their type ${[...r.badEvolve, ...r.crossType].join(', ')}`);
  t.ok(!r.dupNames.length, `no two creatures share a name ${r.dupNames.join(', ')}`);
  t.ok(!r.noMoves.length, `every creature knows moves at level 5 ${r.noMoves.join(', ')}`);
  t.ok(!r.badModels.length, `every creature has a model ${r.badModels.join('; ')}`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
