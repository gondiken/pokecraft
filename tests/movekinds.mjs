// Owner 2026-11-11 (plans/chapter3-world.md section 7, step 1): every attacking move's live kind BY ITS NATURE, one line each in
// src/movekinds.js MOVE_KIND. This check (Node, no browser):
//   - fails on an attacking move (power > 0) missing from MOVE_KIND, a MOVE_KIND line for a move that does not exist or is not an
//     attack, or a kind that is not shot / many shots / rush / big blast;
//   - fails when a help move changed kind (heal, sleep, cloud, power up keep their kinds from their effect: none removed);
//   - counts the spread: per type, which of the four kinds its moves have (gaps listed), and per creature (its learnable attack moves:
//     the share of creatures that can learn at least two, three and all four kinds).
//   node tests/movekinds.mjs            the counts and any problem (exit 1 on a problem)
//   node tests/movekinds.mjs --list     also the kind list by type (as in plans/chapter3-world.md "Decided overnight")
// tests/specs/scribble.mjs part `kinds` runs it.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const THREE_URL = import.meta.resolve('three');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { return next(s === 'three' ? ${JSON.stringify(THREE_URL)} : s, c); }`));

const ATTACK = ['bolt', 'volley', 'dash', 'burst'];
const WORD = { bolt: 'Shot', volley: 'Many shots', dash: 'Rush', burst: 'Big blast' };

export async function checkKinds() {
  const { MOVES, SPECIES } = await import('../src/species.js');
  const { MOVE_KIND, kindOfMove } = await import('../src/movekinds.js');
  const problems = [];
  for (const [id, m] of Object.entries(MOVES)) {
    if (m.power > 0 && !MOVE_KIND[id]) problems.push(`${id} (${m.name}) has no MOVE_KIND line`);
    const k = kindOfMove(m)?.id;
    if (m.power > 0 && k !== MOVE_KIND[id]) problems.push(`${id}: kindOfMove says ${k}, MOVE_KIND ${MOVE_KIND[id]}`);
    if (!m.power) { // help moves keep their kinds from their effect (the old rule, unchanged)
      const fx = m.fx?.kind, want = fx === 'heal' ? 'heal' : fx === 'sleep' ? 'sleep' : fx === 'lower' || fx === 'curse' ? 'cloud' : 'buff';
      if (k !== want) problems.push(`help move ${id} is ${k}, not ${want}`);
    }
  }
  for (const [id, k] of Object.entries(MOVE_KIND)) {
    if (!MOVES[id]) problems.push(`MOVE_KIND names a move that does not exist: ${id}`);
    else if (!(MOVES[id].power > 0)) problems.push(`MOVE_KIND names a help move: ${id}`);
    if (!ATTACK.includes(k)) problems.push(`${id}: '${k}' is not an attack kind`);
  }
  // the spread per type
  const types = {};
  for (const [id, m] of Object.entries(MOVES)) if (m.power > 0) (types[m.type] ||= []).push(id);
  const byType = Object.entries(types).map(([type, ids]) => {
    const has = new Set(ids.map(id => MOVE_KIND[id]));
    return { type, ids, missing: ATTACK.filter(k => !has.has(k)) };
  });
  // the spread per creature (its whole learn list's attack moves; Zenithar and the guardian kit too)
  const per = { 1: 0, 2: 0, 3: 0, 4: 0 }, few = [];
  let n = 0;
  for (const [sid, s] of Object.entries(SPECIES)) {
    const ids = (s.learn || []).map(([, id]) => id).filter(id => MOVES[id]?.power > 0);
    if (!ids.length) continue;
    const kinds = new Set(ids.map(id => MOVE_KIND[id]));
    n++; per[kinds.size] = (per[kinds.size] || 0) + 1;
    if (kinds.size < 2) few.push(sid);
  }
  const total = Object.values(MOVE_KIND).reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {});
  return { problems, byType, per, n, few, total, MOVES, MOVE_KIND };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await checkKinds();
  console.log(`attack moves by kind: ${ATTACK.map(k => `${WORD[k]} ${r.total[k] || 0}`).join(', ')}`);
  const full = r.byType.filter(t => !t.missing.length).length;
  console.log(`types with all four kinds: ${full} / ${r.byType.length}`);
  for (const t of r.byType.filter(t => t.missing.length)) console.log(`  ${t.type} (${t.ids.length} attack moves) has no ${t.missing.map(k => WORD[k]).join(', ')}`);
  console.log(`creatures (${r.n}) by how many kinds they can learn: ${[1, 2, 3, 4].map(k => `${k}: ${r.per[k] || 0}`).join(', ')}${r.few.length ? `; one kind only: ${r.few.join(' ')}` : ''}`);
  if (process.argv.includes('--list')) for (const t of r.byType) console.log(`- **${t.type}**: ${t.ids.map(id => `${r.MOVES[id].name} ${WORD[r.MOVE_KIND[id]]?.toLowerCase()}`).join(', ')}`);
  for (const p of r.problems) console.log('PROBLEM', p);
  process.exit(r.problems.length ? 1 : 0);
}
