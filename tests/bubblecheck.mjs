// The Bubble Well terrain checks that need no browser: a stand-in world for bubbleLand and the walk graph of housecheck.mjs, plus three
// kinds of extra edges: bubbles (redesign 2026-10-29: only from a floor with a soap pot, since one dip = one bubble and a jump shakes the
// film off; a bubble climbs at most bubbles.js rideUp() with the most kind help, up through open air, then over to a ledge at most 3 away),
// the fizz lifts (when on) and the Chimney Ride (from its floor to the rim). Used by tests/specs/bubble.mjs and run by hand with
// `node tests/bubblecheck.mjs [seed]`.
import { B, BLOCKS, WOOL } from '../src/blocks.js';
import { bubbleLand, SIZE, WELL, FLOOR, MESA, RIM, GARDEN, NEST, ISLANDS, THORNS, CHIMNEY, LEDGES, SOAP_POTS, SHIELDS, LIFTS, DRIPS, WINDS, rWell, rChim, onRim, inGarden } from '../src/bubbleland.js';
import { RIDE, DUCK, gapOf, rideUp } from '../src/bubbles.js';
import { kindHelp } from '../src/kindhelp.js';
import { walkGraph, bfs } from './housecheck.mjs';
import { standIn } from './castlecheck.mjs';

// The most one bubble lifts your feet (the most kind help: a bubble lasts 10 % longer), as whole blocks you can land on.
export const BUBBLE_UP = Math.floor(rideUp(kindHelp(99).more) - 0.02);
export function makeWell(seed) { const w = standIn(seed, [SIZE, SIZE]); bubbleLand(w, { id: 'bubble', size: [SIZE, SIZE] }); return w; }
const at = p => [Math.floor(p[0]), Math.round(p[1]), Math.floor(p[2])];
const parse = k => k.split(',').map(Number);

// The walk graph with extra edges: bubbles (from a cell on a soap pot's own floor: open air straight up, then over to a ledge at most 3
// away), lifts, the ride. skipPots: pots (indexes into SOAP_POTS) whose floor gives no bubbles (to prove each ledge is needed).
export function graphOf(w, { bubbles = false, lifts = [false, false], ride = false, skipPots = [] } = {}) {
  const g = walkGraph(w);
  const liftBoxes = LIFTS.filter((l, i) => lifts[i]);
  // the floors you can walk to with a wet wand: every cell reached from a pot without leaving that floor (no fall, no step up)
  const wet = new Set();
  if (bubbles) SOAP_POTS.forEach((pot, i) => {
    if (skipPots.includes(i)) return;
    const s = at(pot), q = [s]; wet.add(g.key(...s));
    while (q.length) { const c = q.shift(); for (const n of g.neighbours(...c)) { if (n[1] !== c[1]) continue; const k = g.key(...n); if (wet.has(k) || Math.hypot(n[0] - s[0], n[2] - s[2]) > 14) continue; wet.add(k); q.push(n); } }
  });
  g.edges = (x, y, z) => {
    const out = [];
    if (bubbles && wet.has(g.key(x, y, z))) {
      let top = y; // how high the air is open over this cell
      while (top < y + BUBBLE_UP && !g.solid(x, top + 2, z)) top++;
      for (let dy = 1; dy <= top - y; dy++) for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (Math.hypot(dx, dz) <= 4.2 && g.standOk(x + dx, y + dy, z + dz)) out.push([x + dx, y + dy, z + dz]);
    }
    for (const l of liftBoxes) if (x >= l.x[0] - 1 && x <= l.x[1] + 1 && z >= l.z[0] - 1 && z <= l.z[1] + 1 && y >= l.y[0] && y <= l.y[0] + 1) {
      const ty = l.y[1] + 1; // up the stream, then step off onto a ledge beside it
      for (let dx = -2; dx <= 3; dx++) for (let dz = -2; dz <= 3; dz++) if (g.standOk(l.x[0] + dx, ty, l.z[0] + dz)) out.push([l.x[0] + dx, ty, l.z[0] + dz]);
    }
    if (ride && Math.hypot(x + 0.5 - CHIMNEY.x, z + 0.5 - CHIMNEY.z) < CHIMNEY.r && y === CHIMNEY.floor) out.push(at([CHIMNEY.landing[0], RIM.y + 1, CHIMNEY.landing[1]]));
    return out;
  };
  return g;
}

export function analyze(seed = 1) {
  const out = { problems: [], info: {} };
  const bad = m => out.problems.push(m);
  const w = makeWell(seed), w2 = makeWell(seed);
  for (let i = 0; i < w.data.length; i++) if (w.data[i] !== w2.data[i]) { bad('not deterministic'); break; }
  const ids = [...new Set(w.data)].sort((a, b) => a - b);
  out.info.ids = ids; out.info.up = BUBBLE_UP;
  const unknown = ids.filter(id => id !== B.AIR && !BLOCKS[id]);
  if (unknown.length) bad(`unknown block ids ${unknown}`);
  const newIds = ids.filter(id => id > 136 && ![B.PICTURE, B.WAY_BACK, B.BOSS_STAND, B.PICTURE_FRAME].includes(id));
  if (newIds.some(id => ![B.FOAM, B.FIZZ_WALL, WOOL.bubble].includes(id))) bad(`ids other than 147 / 148 / 255: ${newIds}`);
  if (!ids.includes(B.FOAM) || !ids.includes(B.FIZZ_WALL) || !ids.includes(WOOL.bubble)) bad('the foam, the fizzy wall or the bubble wool is missing');
  const standOk = (x, y, z) => w.isSolid(x, y - 1, z) && !w.isSolid(x, y, z) && !w.isSolid(x, y + 1, z);
  const arrive = at(w.arrivals.bubble), rimArrive = at(w.arrivals['bubble-rim']);
  if (!standOk(...arrive) || !standOk(...rimArrive)) bad('an arrival is not standable');
  const boss = w.bosses[0];
  if (w.get(Math.floor(boss.pos[0]), boss.pos[1] - 1, Math.floor(boss.pos[2])) !== B.BOSS_STAND) bad('Captain Suds is not on his stand');
  for (const r of w.rests) if (!standOk(...at(r))) bad(`rest ${r.slice(0, 3).map(v => v.toFixed?.(1) ?? v)} not standable`);
  for (const c of boss.crew) if (!standOk(...at(c.pos))) bad(`crew ${c.i} not standable`);
  if (!w.keeps.some(k => k.name === 'well' && k.protect[0].x0 === 0 && k.protect[0].x1 === w.W - 1 && k.protect[0].y1 >= 47)) bad('the whole well is not a keep');
  if (!w.nooks.length || w.nooks.some(n => !standOk(n.x, n.y, n.z))) bad('nooks');
  out.info.nooks = w.nooks.length;
  for (const p of SOAP_POTS) if (!standOk(...at(p))) bad(`a soap pot in the air or a wall at ${p}`);
  // 0. one bubble never climbs 6 (so no ledge can be skipped); the ledges are 3 and 4 apart (a bubble needed, never a jump)
  if (BUBBLE_UP >= 6) bad(`one bubble climbs ${BUBBLE_UP}`);
  const tops = [FLOOR, ...LEDGES.map(l => l.top), MESA.top];
  tops.slice(1).forEach((t, i) => { const d = t - tops[i]; if (d < 2 || d > BUBBLE_UP) bad(`ledge ${i + 1} is ${d} up`); });
  // 1. no wand: from the bottom you never get up
  const none = bfs(graphOf(w), [arrive]);
  const maxY = Math.max(...[...none.keys()].map(k => parse(k)[1]));
  out.info.walkTop = maxY;
  if (maxY > FLOOR + 2) bad(`without bubbles you get up to y ${maxY}`);
  // 2. with the wand: every ledge, then the plateau; not the rim (that is the Chimney Ride)
  const has = (seen, f) => { for (const k of seen.keys()) { const [x, y, z] = parse(k); if (f(x, y, z)) return true; } return false; };
  const wand = bfs(graphOf(w, { bubbles: true }), [arrive]);
  for (const l of LEDGES) if (!has(wand, (x, y, z) => y === l.top + 1 && x >= l.x0 && x <= l.x1 && z >= l.z0 && z <= l.z1)) bad(`bubbles do not reach ledge ${l.n}`);
  if (!has(wand, (x, y, z) => y === MESA.top + 1)) bad('bubbles do not reach the plateau');
  if (has(wand, (x, y, z) => y >= RIM.y + 1)) bad('bubbles alone reach the rim (the chimney should be the only way)');
  // every ledge is needed: without the bubbles from any one floor's pot (the floor, ledge 1, 2, 3) nobody gets onto the plateau
  for (let i = 0; i <= LEDGES.length; i++) if (has(bfs(graphOf(w, { bubbles: true, skipPots: [i] }), [arrive]), (x, y, z) => y === MESA.top + 1)) bad(`the plateau without ${i ? `ledge ${i}'s` : "the floor's"} soap pot`);
  // 3. the lifts and the ride: the rim, the Boss, both ways back; nobody stuck (every rest and crew spot gets to a way back)
  const all = graphOf(w, { bubbles: true, lifts: [true, true], ride: true });
  const full = bfs(all, [arrive]);
  out.info.reach = full.size;
  if (!full.has(all.key(...at(boss.rest)))) bad('Captain Suds cannot be reached');
  if (!full.has(all.key(...rimArrive))) bad('the rim way back cannot be reached');
  if (!full.has(all.key(...at(SOAP_POTS.at(-1))))) bad('the rim soap pot cannot be reached');
  const onlyLifts = bfs(graphOf(w, { lifts: [true, true] }), [arrive]);
  if (!has(onlyLifts, (x, y, z) => y === MESA.top + 1) || !has(onlyLifts, (x, y, z) => y === RIM.y + 1)) bad('the fizz lifts do not take you up to the plateau and the rim');
  const doors = [arrive, rimArrive].map(d => all.key(...d));
  for (const s of [...w.rests.map(at), ...boss.crew.map(c => at(c.pos)), ...w.nooks.map(n => [n.x, n.y, n.z])]) {
    const seen = bfs(all, [s]);
    if (!doors.some(d => seen.has(d))) bad(`stuck at ${s}`);
  }
  // 4. the shields: never reachable by a jump from anything you can stand on (only from a bubble), but a bubble from the rim's pot climbs
  //    above every one of them
  const rimPot = SOAP_POTS.at(-1);
  SHIELDS.forEach((s, k) => {
    const low = s.y - (s.ay || 0) + s.r; // its top at its lowest
    for (let x = Math.floor(s.x - s.ax - s.r - 3); x <= s.x + s.ax + s.r + 3; x++) for (let z = Math.floor(s.z - s.az - s.r - 3); z <= s.z + s.az + s.r + 3; z++) for (let y = RIM.y; y <= 47; y++) {
      if (standOk(x, y, z) && y + 8.6 * 8.6 / 56 + 0.1 >= low) { bad(`shield ${k + 1} can be jumped onto from ${x},${y},${z}`); x = 999; break; }
    }
    if (rimPot[1] + rideUp() < s.y + (s.ay || 0) + s.r + 0.3) bad(`shield ${k + 1} is out of reach of a bubble from the rim`);
    if (!onRim(s.x, s.z)) bad(`shield ${k + 1} is not over the rim`);
  });
  // 5. the garden: nothing solid where the ducklings float; islands, nest and thorns inside its rim
  for (let x = GARDEN.x0; x < GARDEN.x1; x++) for (let z = GARDEN.z0; z < GARDEN.z1; z++) if (w.isSolid(x, MESA.top + 1, z) || w.isSolid(x, MESA.top + 2, z) || !w.isSolid(x, MESA.top, z)) { bad(`the garden is not clear at ${x},${z}`); break; }
  for (const [x, z] of [...ISLANDS, [NEST.x, NEST.z], ...THORNS]) if (!inGarden(x, z)) bad(`${x},${z} is outside the garden`);
  for (const [x, z] of ISLANDS) if (THORNS.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < DUCK.r + DUCK.thorn + 0.3)) bad('a thorn by an island');
  if (THORNS.some(([tx, tz]) => Math.hypot(tx - NEST.x, tz - NEST.z) < NEST.r + 1.5)) bad('a thorn by the nest');
  // 6. the chimney: open inside from its floor to the sky, the plates' gaps inside, the landing on the rim
  for (let y = CHIMNEY.floor; y < 48; y++) for (let x = Math.floor(CHIMNEY.x - CHIMNEY.r); x <= Math.ceil(CHIMNEY.x + CHIMNEY.r); x++) for (let z = Math.floor(CHIMNEY.z - CHIMNEY.r); z <= Math.ceil(CHIMNEY.z + CHIMNEY.r); z++) if (rChim(x, z) < CHIMNEY.r - 0.5 && w.isSolid(x, y, z)) { bad(`the chimney is blocked at ${x},${y},${z}`); y = 99; break; }
  if (!w.isSolid(Math.floor(CHIMNEY.x), CHIMNEY.floor - 1, Math.floor(CHIMNEY.z))) bad('the chimney has no floor');
  for (const p of CHIMNEY.plates) { const g = gapOf(CHIMNEY, p); if (Math.hypot(g.x - CHIMNEY.x, g.z - CHIMNEY.z) > CHIMNEY.r - RIDE.R) bad('a gap the ride cannot reach'); }
  if (!standOk(...at([CHIMNEY.landing[0], RIM.y + 1, CHIMNEY.landing[1]]))) bad('the chimney landing is not standable');
  if (!has(wand, (x, y, z) => y === CHIMNEY.floor && rChim(x, z) < CHIMNEY.r)) bad('the chimney floor cannot be reached with bubbles');
  // 7. the drips over ledge 3's way up, the winds inside the well
  for (const d of DRIPS) if (!(d.z > MESA.z1 + 0.5 && d.z < MESA.z1 + 2 && d.top <= MESA.top + 1)) bad('a drip not by the plateau edge');
  for (const v of WINDS) if (rWell(v.x0, v.z0) >= WELL.r || rWell(v.x1, v.z1) >= WELL.r) bad(`the wind ${v.id} is outside the well`);
  // 8. the wall all round
  for (let x = 0; x < w.W; x += 7) for (let z = 0; z < w.D; z += 7) if (rWell(x, z) >= WELL.r && w.get(x, WELL.top, z) !== B.FIZZ_WALL) { bad(`the wall has a hole at ${x},${z}`); break; }
  return out;
}

if (process.argv[1]?.endsWith('bubblecheck.mjs')) {
  const r = analyze(Number(process.argv[2] || 1));
  console.log(JSON.stringify(r.info), r.problems.length ? r.problems : 'ok');
}
