// Features (T29, moved here from hometypes.js; imports nothing). A report is anything with counts: { [zone]: { [blockId]: n } }
// and optionally stats: { [name]: number }. Homes (roomfinder.js: zones floor / inside / wall / roof) and build challenges
// (buildcheck.js: zones all / top / base / overWater) both make one, so the same features check both.

// Sum of report.counts[zone][id] over the zones and ids. `ids = null` counts every block.
export function count(report, zones, ids = null) {
  let n = 0;
  for (const z of zones) {
    const c = report?.counts?.[z];
    if (!c) continue;
    for (const [id, k] of Object.entries(c)) if (!ids || ids.includes(Number(id))) n += k;
  }
  return n;
}

// A Feature (or rule) is { key, name, icon (block id for its picture), check(report) -> { done, have, need } }.
export const hasBlock = (id, { key, name, where = ['inside'], icon = id }) =>
  ({ key, name, icon, where, check: r => { const have = count(r, where, [id]); return { done: have >= 1, have: Math.min(have, 1), need: 1 }; } });
export const atLeast = (n, ids, { key, name, where = ['inside'], icon = ids?.[0] }) =>
  ({ key, name, icon, where, check: r => { const have = count(r, where, ids); return { done: have >= n, have, need: n }; } });
// Rule: at least `share` of all blocks in the zones are one of ids (need = ceil(total * share); nothing there = not done).
export const mostly = (ids, share, { key, name, where = ['wall'], icon = ids[0] }) =>
  ({ key, name, icon, where, check: r => {
    const total = count(r, where), have = count(r, where, ids), need = Math.ceil(total * share);
    return { done: total > 0 && have >= need, have, need };
  } });

// A number in report.stats is at least n (e.g. height 6).
export const reach = (stat, n, { key, name, icon }) =>
  ({ key, name, icon, check: r => { const have = r?.stats?.[stat] || 0; return { done: have >= n, have: Math.min(have, n), need: n }; } });
// At least n different ids of `ids` in the zones.
export const different = (n, ids, { key, name, where = ['all'], icon = ids[0] }) =>
  ({ key, name, icon, where, check: r => {
    const seen = new Set();
    for (const z of where) for (const [id, k] of Object.entries(r?.counts?.[z] || {})) if (k > 0 && ids.includes(Number(id))) seen.add(Number(id));
    return { done: seen.size >= n, have: Math.min(seen.size, n), need: n };
  } });

// Every feature's { key, name, icon, done, have, need }, how many are done and whether all are.
export function checkAll(features, report) {
  const list = features.map(f => ({ key: f.key, name: f.name, icon: f.icon, ...f.check(report) }));
  const done = list.filter(f => f.done).length;
  return { features: list, done, need: list.length, finished: done === list.length && !!report?.ok };
}
