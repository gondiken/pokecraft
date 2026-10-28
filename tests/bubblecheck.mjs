// The Bubble Well terrain checks that need no browser: a stand-in world for bubbleLand and the walk graph of housecheck.mjs, plus three
// kinds of extra edges: bubbles (from a ledge you can climb up to BUBBLE_UP blocks through open air), the fizz lifts (when on) and the
// Chimney Ride (from its floor to the rim). Used by tests/specs/bubble.mjs and run by hand with `node tests/bubblecheck.mjs [seed]`.
import { B, BLOCKS, isSolid, WOOL } from '../src/blocks.js';
import { bubbleLand, SIZE, WELL, FLOOR, MESA, BENCH, RIM, GARDEN, NEST, ISLANDS, THORNS, CURRENTS, CHIMNEY, VENTS, VENT_SPOTS, LIFTS, DRIPS, VENT2, BREEZES, SHAFT2, SOAP_FLOWERS, rWell, rChim, onRim, inGarden } from '../src/bubbleland.js';
import { RIDE, DUCK, gapOf } from '../src/bubbles.js';
import { walkGraph, bfs } from './housecheck.mjs';
import { standIn } from './castlecheck.mjs';

export const BUBBLE_UP = 9; // six puffs of soap, about 1.5 blocks a bubble
export function makeWell(seed) { const w = standIn(seed, [SIZE, SIZE]); bubbleLand(w, { id: 'bubble', size: [SIZE, SIZE] }); return w; }
const at = p => [Math.floor(p[0]), Math.round(p[1]), Math.floor(p[2])];
const parse = k => k.split(',').map(Number);

// The walk graph with extra edges: bubbles (open air straight up from a ledge, then over to a ledge at most 3 away), lifts, the ride.
export function graphOf(w, { bubbles = false, lifts = [false, false], ride = false } = {}) {
  const g = walkGraph(w);
  const liftBoxes = LIFTS.filter((l, i) => lifts[i]);
  g.edges = (x, y, z) => {
    const out = [];
    if (bubbles) {
      let top = y; // how high the air is open over this cell (the fizzy breeze blows bubbles away: as good as a wall)
      const windy = (x, y, z) => BREEZES.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1);
      while (top < y + BUBBLE_UP && !g.solid(x, top + 2, z) && !windy(x, top + 2, z)) top++;
      for (let dy = 2; dy <= top - y; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (g.standOk(x + dx, y + dy, z + dz)) out.push([x + dx, y + dy, z + dz]);
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
  out.info.ids = ids;
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
  // 1. no wand: from the bottom you never get up (the bench, the plateau, the rim)
  const none = bfs(graphOf(w), [arrive]);
  const maxY = Math.max(...[...none.keys()].map(k => parse(k)[1]));
  out.info.walkTop = maxY;
  if (maxY > FLOOR + 2) bad(`without bubbles you get up to y ${maxY}`);
  // 2. with the wand: the bench, then the plateau by the narrow shaft (the stairs' top); not the rim (that is the Chimney Ride)
  const wand = bfs(graphOf(w, { bubbles: true }), [arrive]);
  const has = (seen, f) => { for (const k of seen.keys()) { const [x, y, z] = parse(k); if (f(x, y, z)) return true; } return false; };
  if (!has(wand, (x, y, z) => y === BENCH.top + 1 && x >= BENCH.x0 && x <= BENCH.x1 && z >= BENCH.z0 && z <= BENCH.z1)) bad('bubbles do not reach the bench');
  if (!has(wand, (x, y, z) => y === MESA.top + 1)) bad('bubbles do not reach the plateau');
  if (has(wand, (x, y, z) => y >= RIM.y + 1)) bad('bubbles alone reach the rim (the chimney should be the only way)');
  // the bench only from in front of it (shaft 1) and the plateau only from the narrow shaft (the plateau overhangs the rest of the bench)
  const bub = graphOf(w, { bubbles: true }), without = skip => bfs({ ...bub, edges: (x, y, z) => (skip(x, y, z) ? [] : bub.edges(x, y, z)) }, [arrive]);
  if (has(without((x, y, z) => x >= 92 && x <= 128 && z >= 66 && z <= 81), (x, y, z) => y >= BENCH.top + 1)) bad('you can bubble up to the bench somewhere else than by it');
  if (has(without((x, y, z) => x >= SHAFT2.x0 && x <= SHAFT2.x1 && z >= SHAFT2.z0 && z <= SHAFT2.z1), (x, y, z) => y >= MESA.top + 1)) bad('you can bubble up to the plateau somewhere else than the narrow shaft');
  // 3. the lifts and the ride: the rim, the Boss, the vents, both ways back; nobody stuck (every rest and crew spot gets to a way back)
  const all = graphOf(w, { bubbles: true, lifts: [true, true], ride: true });
  const full = bfs(all, [arrive]);
  out.info.reach = full.size;
  if (!full.has(all.key(...at(boss.rest)))) bad('Captain Suds cannot be reached');
  if (!full.has(all.key(...rimArrive))) bad('the rim way back cannot be reached');
  for (const s of VENT_SPOTS) { const back = [s.x + Math.cos(s.a) * 1.6, RIM.y + 1, s.z + Math.sin(s.a) * 1.6]; if (!standOk(...at(back))) bad(`the spot to blow into a vent from (${back.map(v => v.toFixed(1))}) is not standable`); }
  const onlyLifts = bfs(graphOf(w, { lifts: [true, true] }), [arrive]);
  if (!has(onlyLifts, (x, y, z) => y === MESA.top + 1) || !has(onlyLifts, (x, y, z) => y === RIM.y + 1)) bad('the fizz lifts do not take you up to the plateau and the rim');
  const doors = [arrive, rimArrive].map(d => all.key(...d));
  for (const s of [...w.rests.map(at), ...boss.crew.map(c => at(c.pos)), ...w.nooks.map(n => [n.x, n.y, n.z])]) {
    const seen = bfs(all, [s]);
    if (!doors.some(d => seen.has(d))) bad(`stuck at ${s}`);
  }
  // 4. the garden: nothing solid where the ducklings float; islands, nest and thorns inside its rim; the current inside
  for (let x = GARDEN.x0; x < GARDEN.x1; x++) for (let z = GARDEN.z0; z < GARDEN.z1; z++) if (w.isSolid(x, MESA.top + 1, z) || w.isSolid(x, MESA.top + 2, z) || !w.isSolid(x, MESA.top, z)) { bad(`the garden is not clear at ${x},${z}`); break; }
  for (const [x, z] of [...ISLANDS, [NEST.x, NEST.z], ...THORNS]) if (!inGarden(x, z)) bad(`${x},${z} is outside the garden`);
  for (const [x, z] of ISLANDS) if (THORNS.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < DUCK.r + DUCK.thorn + 0.3)) bad('a thorn by an island');
  if (THORNS.some(([tx, tz]) => Math.hypot(tx - NEST.x, tz - NEST.z) < NEST.r + 1.5)) bad('a thorn by the nest');
  // 5. the chimney: open inside from its floor to the sky, a door, the plates' gaps and the stars inside, the landing on the rim
  for (let y = CHIMNEY.floor; y < 48; y++) for (let x = Math.floor(CHIMNEY.x - CHIMNEY.r); x <= Math.ceil(CHIMNEY.x + CHIMNEY.r); x++) for (let z = Math.floor(CHIMNEY.z - CHIMNEY.r); z <= Math.ceil(CHIMNEY.z + CHIMNEY.r); z++) if (rChim(x, z) < CHIMNEY.r - 0.5 && w.isSolid(x, y, z)) { bad(`the chimney is blocked at ${x},${y},${z}`); y = 99; break; }
  if (!w.isSolid(Math.floor(CHIMNEY.x), CHIMNEY.floor - 1, Math.floor(CHIMNEY.z))) bad('the chimney has no floor');
  for (const p of CHIMNEY.plates) { const g = gapOf(CHIMNEY, p); if (Math.hypot(g.x - CHIMNEY.x, g.z - CHIMNEY.z) > CHIMNEY.r - RIDE.R) bad('a gap the ride cannot reach'); }
  if (!standOk(...at([CHIMNEY.landing[0], RIM.y + 1, CHIMNEY.landing[1]]))) bad('the chimney landing is not standable');
  if (!has(bfs(graphOf(w, { bubbles: true }), [arrive]), (x, y, z) => y === CHIMNEY.floor && rChim(x, z) < CHIMNEY.r)) bad('the chimney floor cannot be reached with bubbles');
  // 6. the vents on the rim, the drips and the side wind inside the narrow shaft, soap flowers on ground
  for (const v of VENTS) if (!onRim(v.x, v.z) || !w.isSolid(Math.floor(v.x), RIM.y, Math.floor(v.z)) || w.isSolid(Math.floor(v.x), RIM.y + 1, Math.floor(v.z))) bad('a vent is not on the rim');
  for (const d of DRIPS) if (d.x < SHAFT2.x0 || d.x > SHAFT2.x1 + 1 || d.z < SHAFT2.z0 || d.z > SHAFT2.z1 + 1) bad('a drip outside the narrow shaft');
  if (VENT2.x0 < SHAFT2.x0 || VENT2.x1 > SHAFT2.x1) bad('the side wind outside the narrow shaft');
  for (const [x, y, z] of SOAP_FLOWERS) if (!standOk(Math.floor(x), y, Math.floor(z))) bad(`a soap flower in the air or a wall at ${x},${y},${z}`);
  // 7. inside the map, nothing above y 47, the wall all round
  for (let x = 0; x < w.W; x += 7) for (let z = 0; z < w.D; z += 7) if (rWell(x, z) >= WELL.r && w.get(x, WELL.top, z) !== B.FIZZ_WALL) { bad(`the wall has a hole at ${x},${z}`); break; }
  return out;
}

if (process.argv[1]?.endsWith('bubblecheck.mjs')) {
  const r = analyze(Number(process.argv[2] || 1));
  console.log(JSON.stringify(r.info), r.problems.length ? r.problems : 'ok');
}
