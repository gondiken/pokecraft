// Every type has the same number of creatures; every creature can be found, evolves into
// something real, and has a model.
import { openGame } from '../helpers.mjs';
import { PENDING } from '../pending-types.mjs'; // T40 base: wave 14 types whose creatures are not made yet

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  const r = await page.evaluate(async pending => {
    const S = await import('/src/species.js');
    const { condOf } = await import('/src/spawnrules.js');
    const allIds = Object.keys(S.SPECIES);
    // One-of-a-kind legendary creatures (never wild) are checked separately.
    const legendary = allIds.filter(id => S.SPECIES[id].legendary);
    const ids = allIds.filter(id => !S.SPECIES[id].legendary);
    const byType = {};
    for (const id of ids) (byType[S.SPECIES[id].type] ||= []).push(id);
    const { REALMS } = await import('/src/realms.js'); // T35: Dream creatures live only in the realm's tables
    const realmSpawns = Object.values(REALMS).flatMap(r => Object.values(r.spawns).flat());
    const spawns = new Set([...Object.values(S.SPAWNS).flat(), ...realmSpawns].map(e => e[0]));
    const badModels = [];
    for (const id of allIds) {
      try {
        const model = S.buildModel(id);
        for (let t = 0; t < 3; t += 0.5) S.animateModel(model, t, t > 1.5); // standing, then walking
        S.disposeModel(model);
      } catch (e) { badModels.push(`${id}: ${e.message}`); }
    }
    const names = allIds.map(id => S.SPECIES[id].name);
    return {
      count: ids.length,
      sizes: Object.fromEntries(Object.entries(byType).map(([t, l]) => [t, l.length])),
      types: Object.keys(S.TYPE_COLORS).filter(x => !pending.includes(x)),
      notFound: ids.filter(id => !spawns.has(id) && !ids.some(o => S.SPECIES[o].evolve?.into === id && spawns.has(o))),
      badConds: [...Object.values(S.SPAWNS).flat(), ...realmSpawns].filter(e => e[2] && !condOf(e[2])).map(e => `${e[0]}:${e[2]}`),
      badSpawns: [...spawns].filter(id => !S.SPECIES[id]),
      badEvolve: allIds.filter(id => S.SPECIES[id].evolve && S.SPECIES[id].evolve.into in S.SPECIES === false),
      crossType: allIds.filter(id => S.SPECIES[id].evolve && S.SPECIES[S.SPECIES[id].evolve.into]?.type !== S.SPECIES[id].type),
      dupNames: names.filter((n, i) => names.indexOf(n) !== i),
      noMoves: allIds.filter(id => S.makeCreature(id, 5).moves.length === 0),
      // Each type's six creatures shouldn't all share one body shape.
      samey: Object.entries(byType).filter(([, l]) => new Set(l.map(id => S.SPECIES[id].model.shape)).size < 3).map(([t]) => t),
      badModels,
      legendaryWild: legendary.filter(id => spawns.has(id)),
      legendary,
    };
  }, PENDING);
  const sizes = Object.values(r.sizes);
  t.ok(r.types.every(t => r.sizes[t]) && new Set(sizes).size === 1,
    `every type has the same number of creatures (${JSON.stringify(r.sizes)})`);
  t.ok(r.count === r.types.length * 7, `${r.count} creatures, 7 per type`);
  t.ok(!r.notFound.length, `every creature can be caught, or evolved from one that can ${r.notFound.join(', ')}`);
  t.ok(!r.badConds.length, `every spawn condition is known to spawnrules.js ${r.badConds.join(', ')}`);
  t.ok(!r.badSpawns.length, `spawn tables only list real creatures ${r.badSpawns.join(', ')}`);
  t.ok(!r.badEvolve.length && !r.crossType.length, `evolutions are real and keep their type ${[...r.badEvolve, ...r.crossType].join(', ')}`);
  t.ok(!r.dupNames.length, `no two creatures share a name ${r.dupNames.join(', ')}`);
  t.ok(!r.noMoves.length, `every creature knows moves at level 5 ${r.noMoves.join(', ')}`);
  t.ok(!r.samey.length, `every type has at least 3 different body shapes ${r.samey.join(', ')}`);
  t.ok(!r.badModels.length, `every creature has a model that animates ${r.badModels.join('; ')}`);
  t.ok(r.legendary.length > 0 && !r.legendaryWild.length, `legendary creatures (${r.legendary.join(', ')}) never spawn in the wild`);
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
