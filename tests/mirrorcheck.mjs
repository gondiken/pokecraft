// Wave 18: the Mirror Palace terrain checks that need no browser: a stand-in world for mirrorLand and the walk graph of housecheck.mjs.
// Used by tests/specs/mirror.mjs (in Node and in the page, through /tests/mirrorcheck.mjs) and run by hand with `node tests/mirrorcheck.mjs [seed]`.
// Proves: every part you need can be reached, nothing you must not reach can be (the court, the twin's side of the glass, the pool, the Gloomies'
// wall), the glass is sealed, the keeps cover the whole map, the nooks / rests / crew / the way back stand on the ground, the twin side is the mirror
// image of yours (but the dressers), and which cells of the Gloomy wall no straight beam from the sun mirror reaches (the beam shadows: a bounce
// off a side pane is what gets there).
import { B, BLOCKS, WOOL, isSolid } from '../src/blocks.js';
import { mirrorLand, SIZE, G, PALACE, FUNHALL, FUNNY, COURT, TWIN, TWIN_ROOMS, GALLERY, DAIS, GLOOMY_WALL, PILLARS, PANES, GRAND, RESTS, CREW, liveCells, yourX, twinX } from '../src/mirrorland.js';
import { walkGraph, bfs } from './housecheck.mjs';

export const WORLD_H = 48;
export function standIn(seed, [W, D] = [SIZE, SIZE]) {
  const w = {
    W, D, seed, data: new Uint8Array(W * D * WORLD_H), ground: new Uint8Array(W * D),
    index: (x, y, z) => x + W * (z + D * y),
    inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < WORLD_H,
    get: (x, y, z) => (w.inBounds(x, y, z) ? w.data[x + W * (z + D * y)] : B.AIR),
    isSolid: (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 ? true : isSolid(w.get(x, y, z))),
  };
  return w;
}
export function makeMirror(seed = 1) { const w = standIn(seed); mirrorLand(w, { id: 'mirror', size: [SIZE, SIZE] }); return w; }
const keyOf = (x, y, z) => `${x},${y},${z}`;
const parse = k => k.split(',').map(Number);
const at = p => [Math.floor(p[0]), Math.round(p[1]), Math.floor(p[2])];

// A beam from `o` (continuous) along `d` through the world, reflecting off MIRROR_PANE blocks (flip the component of the face it entered through) up to
// `bounces` times, stopping at any other solid. Returns the cell it stopped in ({ cell, bounces }) or null. (The voxel DDA of spotlight.js, stage 3, does the same.)
export function beam(w, o, d, bounces = 1, max = 160) {
  let [x, y, z] = o, [dx, dy, dz] = d, b = 0;
  const len = Math.hypot(dx, dy, dz); dx /= len; dy /= len; dz /= len;
  const step = 0.02;
  for (let t = 0; t < max; t += step) {
    const nx = x + dx * step, ny = y + dy * step, nz = z + dz * step;
    const cx = Math.floor(nx), cy = Math.floor(ny), cz = Math.floor(nz);
    if (!w.isSolid(cx, cy, cz)) { x = nx; y = ny; z = nz; continue; }
    if (w.get(cx, cy, cz) === B.MIRROR_PANE && b < bounces) {
      const px = Math.floor(x), py = Math.floor(y), pz = Math.floor(z);
      if (px !== cx) dx = -dx; else if (py !== cy) dy = -dy; else if (pz !== cz) dz = -dz; else { dx = -dx; dy = -dy; dz = -dz; }
      b++; continue;
    }
    return { cell: [cx, cy, cz], bounces: b };
  }
  return null;
}
// The sun mirror (a mesh in stage 3) swivels over the dais: its middle.
export const SUN_AT = [DAIS.x + 0.5, DAIS.y + 4.0, DAIS.z + 0.5]; // (a tall stand: its beam clears the pool's rail)
// Which cells of the Gloomy wall (x 62..97, y 13..26) are hit by a straight beam from the sun mirror, by a beam with one bounce, by neither.
export function beamShadows(w) {
  const wall = GLOOMY_WALL, hit = (r, x, y) => r && r.cell[2] === wall.z && r.cell[0] === x && r.cell[1] === y;
  const direct = [], bounce = [], shadow = [];
  for (let x = wall.x0; x <= wall.x1; x++) for (let y = wall.y0; y <= wall.y1; y++) {
    const target = [x + 0.5, y + 0.5, wall.z + 0.99];
    const d = [target[0] - SUN_AT[0], target[1] - SUN_AT[1], target[2] - SUN_AT[2]];
    if (hit(beam(w, SUN_AT, d, 0), x, y)) { direct.push([x, y]); continue; }
    shadow.push([x, y]);
    // one bounce: aim at the cell's reflection in each side pane's plane (x = 58 and x = 102)
    let ok = false;
    for (const px of [PANES[0].x + 1, PANES[1].x]) {
      const mirrored = [2 * px - target[0], target[1], target[2]]; // aim at the cell's image behind the pane
      if (hit(beam(w, SUN_AT, [mirrored[0] - SUN_AT[0], mirrored[1] - SUN_AT[1], mirrored[2] - SUN_AT[2]], 1), x, y)) { ok = true; break; }
    }
    if (ok) bounce.push([x, y]);
  }
  return { direct, bounce, shadow };
}

// The walk graph; `closed` = cells treated as walls (doors drawn closed), swimming is not needed anywhere.
export function graphOf(w, { closed = null } = {}) { return walkGraph(w, { block: closed }); }

export function analyze(seed = 1) {
  const out = { problems: [], info: {} };
  const bad = m => out.problems.push(m);
  const w = makeMirror(seed), w2 = makeMirror(seed + 1000);
  let same = true;
  for (let i = 0; i < w.data.length; i++) if (w.data[i] !== w2.data[i]) { same = false; break; }
  if (!same) bad('the Mirror Palace changes with the seed');
  // 0. data sanity
  const BLOCK_IDS = new Set(Object.keys(BLOCKS).map(Number)), used = new Set(w.data);
  const unknown = [...used].filter(id => id !== 0 && !BLOCK_IDS.has(id));
  if (unknown.length) bad(`unknown block ids ${unknown.join(',')}`);
  for (const id of [B.MIRROR_PANE, B.HEDGE, B.GLASS, B.PICTURE_FRAME, B.HOUSE_PROP, B.BOSS_STAND, B.WAY_BACK]) if (!used.has(id)) bad(`block ${id} is never used`);
  let top = 0; for (let i = 0; i < w.data.length; i++) if (w.data[i]) top = Math.max(top, Math.floor(i / (w.W * w.D)));
  out.info.top = top; if (top > 47) bad('blocks above y 47');
  // 1. the way back and the arrival
  const arrive = at(w.arrivals.mirror);
  const stand = (x, y, z) => w.isSolid(x, y - 1, z) && !w.isSolid(x, y, z) && !w.isSolid(x, y + 1, z);
  if (!stand(...arrive)) bad('the arrival does not stand on the ground');
  if (w.doors.length !== 1 || w.door !== w.doors[0]) bad(`ways back: ${w.doors.length}`);
  // 2. what the live part will draw is air in the data; doors sit in the right partitions
  const L = liveCells();
  for (const d of L.doors) for (const c of [...d.yours, ...d.its]) if (w.get(...c) !== B.AIR) bad(`room ${d.n}'s door cell ${c} is not air`);
  // 3. the walk (every door open: the live part closes them one by one)
  const g = graphOf(w), seen = bfs(g, [arrive]);
  out.info.cells = seen.size;
  const some = f => { for (const k of seen.keys()) { const [x, y, z] = parse(k); if (f(x, y, z)) return true; } return false; };
  const reachAny = (x, y, z, d, dy = 3) => some((cx, cy, cz) => Math.hypot(cx + 0.5 - x, cz + 0.5 - z) <= d && Math.abs(cy - y) <= dy);
  const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  // must reach: the funny hall, the gate, the court wing, the plate, your side of every room, the lobby, the dais, the strip, the Grand Hall, in front of Duke
  const musts = [
    ['the gate', (x, y, z) => inR({ x0: 77, x1: 82, z0: 134, z1: 135 }, x, z)],
    ['the Hall of Funny Mirrors', (x, y, z) => inR({ x0: FUNHALL.x0 + 1, x1: FUNHALL.x1 - 1, z0: FUNHALL.z0 + 1, z1: FUNHALL.z1 - 1 }, x, z)],
    ['the court wing', (x, y, z) => inR(COURT.wing, x, z)],
    ['the corridor to the twin rooms', (x, y, z) => inR({ x0: 100, x1: 109, z0: 120, z1: 123 }, x, z)],
    ...TWIN_ROOMS.map(r => [`twin room ${r.n}, your side`, (x, y, z) => inR({ x0: TWIN.yours.x0, x1: TWIN.yours.x1, z0: TWIN.rooms[r.n - 1].z0, z1: TWIN.rooms[r.n - 1].z0 + 15 }, x, z)]),
    ['Glazier Gwen\'s room', (x, y, z) => inR(TWIN.lobby, x, z)],
    ['the dais', (x, y, z) => inR(DAIS.box, x, z) && y === DAIS.y + 1],
    ['the gallery strip next to the pool', (x, y, z) => inR({ x0: GALLERY.strip.x0, x1: GALLERY.strip.x1, z0: 54, z1: 60 }, x, z)],
    ['the Grand Mirror Hall', (x, y, z) => inR(GRAND.in, x, z)],
  ];
  for (const [name, f] of musts) if (!some(f)) bad(`cannot reach ${name}`);
  // must NOT reach: the court, the twin's side, the pool, the roof of anything, behind the glass, the Gloomy wall's foot
  const nots = [
    ['inside the court', (x, y, z) => inR(COURT.box, x, z) && y <= G + 4],
    ['the twin side of the glass', (x, y, z) => x >= TWIN.glass && x <= TWIN.its.x1 + 1 && z >= TWIN.lobby.z0 - 1 && z <= 134],
    ['the pool', (x, y, z) => inR(GALLERY.pool, x, z)],
    ['above the floor (a roof or a wall top)', (x, y, z) => y > G + 2 && !(inR(DAIS.box, x, z) && y === DAIS.y + 1) && !(inR(GRAND.stage, x, z) && y === G + 2)],
    ['the net', (x, y, z) => inR({ x0: COURT.net.x0, x1: COURT.net.x1, z0: COURT.net.z0, z1: COURT.net.z1 }, x, z) && y > G + 1],
  ];
  for (const [name, f] of nots) if (some(f)) bad(`can reach ${name}`);
  // the court's plate is close to a reachable spot; Cleo, Gwen and Lux are too; Duke; the rests; the nooks
  if (!reachAny(COURT.plate[0], G + 1, COURT.plate[1], 3.5, 1)) bad('the rail plate cannot be reached (3.5 or less from a stand cell)');
  CREW.forEach(c => { if (!reachAny(c.x + 0.5, G + 1, c.z + 0.5, 3, 1)) bad(`${c.name} is out of reach`); });
  const boss = w.bosses[0];
  if (!reachAny(boss.pos[0], boss.pos[1], boss.pos[2], 3, 1)) bad('Duke Dazzle is out of reach');
  if (w.get(Math.floor(boss.pos[0]), boss.pos[1] - 1, Math.floor(boss.pos[2])) !== B.BOSS_STAND) bad('Duke is not on a BOSS_STAND');
  for (const r of w.rests) { const c = at(r); if (!stand(...c)) bad(`rest ${r} does not stand on the ground`); else if (!seen.has(keyOf(...c))) bad(`rest ${r} is not reached`); }
  for (const n of w.nooks) { if (!seen.has(keyOf(n.x, n.y, n.z))) bad(`nook ${n.x},${n.y},${n.z} is not reached`); }
  out.info.nooks = w.nooks.length;
  if (w.nooks.length < 10) bad(`only ${w.nooks.length} nooks (6 in the garden, one by each funny mirror)`);
  for (const f of FUNNY) if (!w.nooks.some(n => Math.hypot(n.x - f.x, n.z - f.z) <= 3)) bad(`no nook in front of the ${f.kind} mirror`);
  // 4. the keeps cover every cell; only the garden's lets riders in
  const covers = (x, y, z) => w.keeps.some(k => k.protect.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1));
  let open = 0; for (let x = 0; x < w.W; x += 3) for (let z = 0; z < w.D; z += 3) for (const y of [0, 11, 30, 47]) if (!covers(x, y, z)) open++;
  if (open) bad(`${open} sampled cells are outside every keep`);
  const gk = w.keeps.find(k => k.name === 'garden'), pk = w.keeps.find(k => k.name === 'palace');
  if (!gk?.rideIn || pk?.rideIn) bad('the garden keep must let riders in and the palace keep must not');
  // 5. the glass is sealed; the twin side is your side's mirror image
  for (let z = TWIN.lobby.z0; z <= 133; z++) for (let y = G + 1; y <= G + 6; y++) if (w.get(TWIN.glass, y, z) !== B.GLASS && w.get(TWIN.glass, y, z) !== B.PICTURE_FRAME) bad(`a hole in the glass at ${TWIN.glass},${y},${z}`);
  const dress = new Set();
  for (const r of TWIN_ROOMS) for (const d of r.dressers) for (let u = d.u[0]; u <= d.u[1]; u++) for (const y of [G + 1, G + 2]) dress.add(keyOf(Math.floor(d.side === 'its' ? twinX(u) : yourX(u)), y, TWIN.rooms[r.n - 1].z0 + d.v));
  let diff = 0;
  for (let x = TWIN.yours.x0; x <= TWIN.yours.x1; x++) for (let z = TWIN.lobby.z0; z <= 133; z++) for (let y = G + 1; y <= PALACE.top; y++) {
    const a = w.isSolid(x, y, z), b = w.isSolid(256 - x, y, z);
    if (a !== b && !dress.has(keyOf(256 - x, y, z)) && !dress.has(keyOf(x, y, z))) diff++;
  }
  if (diff) bad(`the twin side differs from yours in ${diff} cells (besides the dressers)`);
  out.info.dressers = dress.size;
  // the pads' floor tiles are inside the rooms
  for (const r of TWIN_ROOMS) {
    for (const p of r.pads) for (const [side, [u, v]] of [['you', p.you], ['its', p.its]]) {
      const x = Math.floor(side === 'its' ? twinX(u) : yourX(u)), z = TWIN.rooms[r.n - 1].z0 + Math.floor(v);
      if (w.get(x, G, z) !== WOOL.treasure) bad(`room ${r.n}: the ${side} pad's tile is not gold`);
      if (w.isSolid(x, G + 1, z) || w.isSolid(x, G + 2, z)) bad(`room ${r.n}: a pad stands inside something`);
    }
    for (const side of ['you', 'its']) for (const p of r.pads) {
      const [u, v] = side === 'you' ? p.you : p.its;
      if (u < 0.7 || u > 17.3 || v < 0.7 || v > 15.3) bad(`room ${r.n}: a pad is too close to a wall (${u}, ${v})`);
    }
  }
  // 6. the Gloomies' wall is out of reach, and the beam shadows behind the two pillars need a bounce
  for (const k of seen.keys()) { const [x, y, z] = parse(k); if (x >= GLOOMY_WALL.x0 - 1 && x <= GLOOMY_WALL.x1 + 1 && z <= GLOOMY_WALL.z + 3 && z >= GLOOMY_WALL.z && y >= GLOOMY_WALL.y0 - 3) bad(`the Gloomy wall is within reach of ${k}`); }
  const sh = beamShadows(w);
  out.info.beam = { direct: sh.direct.length, shadow: sh.shadow.length, bounce: sh.bounce.length };
  if (!sh.direct.length) bad('no cell of the Gloomy wall is hit by a straight beam');
  if (sh.shadow.length < 40) bad(`only ${sh.shadow.length} shadow cells behind the pillars`);
  for (const p of PILLARS) {
    const cx = (p.x0 + p.x1 + 1) / 2, mine = sh.shadow.filter(([x]) => Math.abs(x - (SUN_AT[0] + (cx - SUN_AT[0]) * (SUN_AT[2] - GLOOMY_WALL.z) / (SUN_AT[2] - p.z1 - 1))) <= 1.2);
    const bounced = mine.filter(([x, y]) => sh.bounce.some(([bx, by]) => bx === x && by === y));
    if (mine.length < 10) bad(`the pillar at x ${p.x0} casts no clear shadow (${mine.length} cells)`);
    if (bounced.length < 6) bad(`only ${bounced.length} cells of the pillar at x ${p.x0}'s shadow can be hit with one bounce off a side pane`);
    out.info[`shadow${p.x0}`] = { cells: mine.length, bounced: bounced.length };
  }
  return out;
}
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('mirrorcheck.mjs')) {
  const seed = Number(process.argv[2] ?? 1), r = analyze(seed);
  console.log(JSON.stringify(r.info));
  console.log(r.problems.length ? `PROBLEMS:\n${r.problems.join('\n')}` : 'no problems');
  process.exit(r.problems.length ? 1 : 0);
}
