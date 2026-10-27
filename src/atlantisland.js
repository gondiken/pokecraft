// T41: Atlantis, the Sunken City, in the east strip of the Pirate Seas (x 224..319; every island, the ship and the old sea stay where they
// were). Everything is data (BELL, WHIRL, BUBBLES, PALACE, DISTRICTS, STALLS, JARS, HOUSES, CORRIDORS, STEPS...) and small loops: a crater
// carved down to y 1 (about 11 blocks of water above the city), a rim of rock and glowing coral, a diving bell with the way back, the Jar
// Market (west), the Arch Gardens (north), the Temple Steps (south) and the palace under its glass dome (dry inside, like a sky gym).
// Like pirateland.js it only needs a world with W / D / data / ground / index / inBounds / get, and imports no game state. pirateLand calls
// atlantisLand(world, ctx) at its end for a map wider than the old 224.
import { B } from './blocks.js';
import { kit, buildWayBack, placeBoss, placeCrew } from './picturelands.js';
import { lightState, LIGHTS, PER_DISTRICT } from './glowfish.js';

export const OLD_W = 224;                        // the Pirate Seas before T41: nothing at x < 224 may change
export const SEA = 12;                           // the top water block row
export const CITY = { x: 270, z: 112, floor: 1, flat: 38, ramp: 41, rimTo: 46, dive: 44, top: 11 }; // centre, flat floor to r 38, ramp to 41, rim rock to 46, dive swimming to 44
// The diving bell on the west rim: a dry glass room; the way back is on its west wall, the door out is on the east wall.
export const BELL = { x0: 230, x1: 238, z0: 108, z1: 116, floor: 4, roof: 10, frame: [231, 112], door: { x: 238, z: [111, 113], y: [5, 7] } };
// The whirlpool over the west rim (the way in from the sea) and the bubble columns that carry you back up (centres, u / v from the city).
export const WHIRL = { x: 233, z: 126, r: 4, y: [2, 13] };
export const BUBBLES = [[-30, -14], [-30, 14], [30, -14], [30, 14], [-22, -30], [22, -30]];
// The palace: a plinth, a glass dome (R 8.5, 1 thick), a tunnel to the west with a gate that opens when the 12 lights are in.
export const PALACE = { plinth: 9, floor: 3, domeIn: 7.5, domeOut: 8.5, domeY: 3.5, tunnel: { u0: -13, u1: -8 }, boss: [3, 0], throne: [6, 0] };
// The three districts: kind of fish, centre (u, v), radius of its light, the lantern (centre of its 3 x 3 base).
export const DISTRICTS = [
  { id: 'market', name: 'Jar Market', kind: 'shy', c: [-19, 0], r: 15, lantern: [-19, 0], base: 4, say: 'Bump a jar... get ready!' },
  { id: 'gardens', name: 'Arch Gardens', kind: 'darter', c: [0, -25], r: 17, lantern: [0, -25], base: 4, say: 'Too fast! Chase it into a corner.' },
  { id: 'temple', name: 'Temple Steps', kind: 'school', c: [0, 22], r: 17, lantern: [0, 31], base: 9, say: 'Wait till they bunch up!' },
];
// Stalls: a table of bricks (w x d, h high) with a clay jar on top at jar [u, v]. `fish` = the index of the shy fish in it, null = an empty jar.
export const STALLS = [
  { u: -27, v: -8, w: 3, d: 2, h: 2, jar: [-26, -8], fish: 0 },
  { u: -27, v: 7, w: 3, d: 2, h: 2, jar: [-26, 8], fish: 1 },
  { u: -16, v: -10, w: 3, d: 2, h: 2, jar: [-15, -10], fish: 2 },
  { u: -16, v: 8, w: 3, d: 2, h: 2, jar: [-15, 9], fish: 3 },
];
// Low walls with an empty jar on top (the jar sits on the wall cell `jar`).
export const WALLS = [
  { u: -23, v: -12, w: 3, d: 1, jar: [-22, -12] }, { u: -23, v: 12, w: 3, d: 1, jar: [-22, 12] },
  { u: -31, v: -1, w: 1, d: 3, jar: [-31, 0] }, { u: -13, v: -7, w: 3, d: 1, jar: [-12, -7] },
];
// Broken columns (u, v, height) round the market.
export const COLUMNS = [[-23, -6, 3], [-23, 6, 5], [-13, -10, 2], [-13, 11, 4], [-30, -12, 4], [-30, 12, 2], [-8, -12, 5], [8, -12, 3], [-6, 12, 4], [6, 12, 2]];
// Broken houses of the Arch Gardens: 7 x 7 outside (walls y 2..5, a roof at y 6 with a few holes), a 3 wide door facing `door` (du, dv).
export const HOUSES = [
  { id: 'h1', c: [-10, -18], door: [1, 0] }, { id: 'h2', c: [10, -18], door: [-1, 0] },
  { id: 'h3', c: [-10, -31], door: [1, 0] }, { id: 'h4', c: [10, -31], door: [-1, 0] },
  { id: 'h5', c: [0, -36], door: [0, 1] },
];
// Arch corridors closed by fallen stones: 3 wide, 7 long, going away from the gardens along `dir`, starting at the gardens' street.
export const CORRIDORS = [{ id: 'a1', start: [-14, -24], dir: [-1, 0], len: 8 }, { id: 'a2', start: [14, -24], dir: [1, 0], len: 8 }];
export const ARCHES = [[0, -14], [0, -20]];
export const DARTERS = [[-3, -23], [3, -23], [-3, -27], [3, -27]];
// The Temple Steps: 5 steps of 3 rows (top y 2..6), a terrace to v 33, columns, a back wall; the school drifts between `a` and `b` (u, v).
export const STEPS = { v0: 12, rows: 3, n: 5, top0: 2, terrace: [27, 33], u: 10, columns: [-8, -4, 4, 8], colV: 29, wallV: [34, 35] };
export const SCHOOL = { a: [-7, 17], b: [7, 25], over: 3 };
export const SHY_AT = 1.35; // a jar fish sits this far above its jar block's bottom face... (its centre above the jar's top)

const wrap = (u, v) => [CITY.x + u, CITY.z + v];
export const stepTop = v => (v < STEPS.v0 ? 1 : v >= STEPS.terrace[0] - 3 ? STEPS.top0 + STEPS.n - 1 : STEPS.top0 + Math.floor((v - STEPS.v0) / STEPS.rows));

/* ------------------------------ pure helpers ------------------------------ */

export const craterR = (x, z) => Math.hypot(x + 0.5 - CITY.x - 0.5, z + 0.5 - CITY.z - 0.5);
export const inCrater = (x, z, r = CITY.dive) => craterR(x, z) <= r;
// The district whose light reaches (x, z), else -1.
export function districtAt(x, z) {
  let best = -1, bd = 1e9;
  DISTRICTS.forEach((d, i) => { const dd = Math.hypot(x - (CITY.x + d.c[0]), z - (CITY.z + d.c[1])); if (dd <= d.r && dd < bd) { bd = dd; best = i; } });
  return best;
}
// The brightness (0..1) of a place for the vertex colours (World.skyDim): dim blue-green, never black. lit[d] = lights in district d (0..4).
export function dimAt(x, y, z, lit = [0, 0, 0]) {
  const r = craterR(x, z);
  if (r > CITY.dive) return 1;
  if (x >= BELL.x0 && x <= BELL.x1 && z >= BELL.z0 && z <= BELL.z1) return 1;
  if (Math.hypot(x - CITY.x, z - CITY.z) <= PALACE.plinth + 5) return 0.85;
  const d = districtAt(x, z);
  const LOW = 0.22, BASE = 0.32; // owner 2026-10-27: a dark district is really dark, so lighting its lantern is a big change (was 0.38 / 0.5)
  if (d < 0) return BASE;
  return LOW + (1 - LOW) * Math.min(1, (lit[d] ?? 0) / PER_DISTRICT);
}

/* ------------------------------ the builder ------------------------------ */

// ctx = { surf, idx, noise, put, rand? }: pirateLand's own sea-floor heights (Int16Array of W * D), its index function and value noise.
export function atlantisLand(world, ctx) {
  kit(world);
  const { W, D, seed } = world, { surf, idx, noise } = ctx;
  const put = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  const at = (u, v) => wrap(u, v);
  const box = (x0, y0, z0, x1, y1, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, id); };
  const ubox = (u0, y0, v0, u1, y1, v1, id) => { const [a, b] = at(u0, v0), [c, d] = at(u1, v1); box(Math.min(a, c), y0, Math.min(b, d), Math.max(a, c), y1, Math.max(b, d), id); };
  const U = (u, y, v, id) => { const [x, z] = at(u, v); put(x, y, z, id); };
  const keepers = [];

  /* 1. the crater: a flat floor at y 1, a short ramp up, a rim of rock with glowing coral (a gap where the whirlpool is) */
  const whirlA = Math.atan2(WHIRL.z - CITY.z, WHIRL.x - CITY.x);
  const reach = CITY.rimTo + 1;
  for (let x = CITY.x - reach; x <= CITY.x + reach; x++) for (let z = CITY.z - reach; z <= CITY.z + reach; z++) {
    if (x < OLD_W || x >= W - 1 || z < 1 || z >= D - 1) continue;
    const r = craterR(x, z);
    if (r > CITY.rimTo) continue;
    const nat = surf[idx(x, z)];
    let fl;
    if (r <= CITY.flat) fl = CITY.floor;
    else if (r <= CITY.ramp) fl = CITY.floor + Math.round((nat - CITY.floor) * (r - CITY.flat) / (CITY.ramp - CITY.flat));
    else {
      let da = Math.abs(Math.atan2(z - CITY.z, x - CITY.x) - whirlA); if (da > Math.PI) da = 2 * Math.PI - da;
      const gap = da < 0.42;
      const rise = gap ? 0 : 2 + Math.floor(noise(x * 0.35, z * 0.35, seed + 41) * 4) - Math.floor((r - CITY.ramp) * 0.5);
      fl = Math.min(10, nat + Math.max(0, rise));
    }
    for (let y = 0; y <= fl; y++) put(x, y, z, y === fl ? (r <= CITY.ramp ? B.SAND : B.STONE) : B.STONE);
    for (let y = fl + 1; y <= SEA; y++) put(x, y, z, B.WATER);
    for (let y = SEA + 1; y <= SEA + 4; y++) put(x, y, z, B.AIR);
    surf[idx(x, z)] = fl; world.ground[idx(x, z)] = fl;
    if (r > CITY.ramp && fl >= 4 && noise(x * 0.9, z * 0.9, seed + 77) < 0.2) { // glowing coral on the rim, so the crater is found from the islands
      put(x, fl + 1, z, B.AT_RIM_CORAL);
      if (noise(x * 0.5, z * 0.5, seed + 78) < 0.5 && fl + 2 <= 11) put(x, fl + 2, z, B.AT_RIM_CORAL);
    }
  }

  /* 2. the palace under its dome */
  const P = PALACE, [pcx, pcz] = [CITY.x, CITY.z];
  for (let u = -P.plinth; u <= P.plinth; u++) for (let v = -P.plinth; v <= P.plinth; v++) {
    const r = Math.hypot(u, v);
    if (r > P.plinth) continue;
    for (let y = 1; y <= P.floor; y++) U(u, y, v, y === P.floor && r <= P.domeOut ? B.AT_MOSAIC : B.AT_BRICK);
  }
  const DR = Math.ceil(P.domeOut) + 1;
  for (let u = -DR; u <= DR; u++) for (let v = -DR; v <= DR; v++) for (let y = P.floor + 1; y <= SEA; y++) {
    const d = Math.sqrt(u * u + (y - P.domeY) ** 2 + v * v);
    if (d < P.domeIn) U(u, y, v, B.AIR);
    else if (d < P.domeOut) U(u, y, v, B.AT_DOME);
  }
  for (const [u, v] of [[-4, -4], [-4, 4], [4, -4], [4, 4]]) for (let y = 4; y <= 8; y++) U(u, y, v, B.AT_COLUMN); // four columns in the throne room
  ubox(P.throne[0], 4, -1, P.throne[0] + 1, 4, 1, B.AT_BRICK); // the throne: a seat and a tall back
  ubox(P.throne[0] + 1, 5, -1, P.throne[0] + 1, 6, 1, B.AT_BRICK);
  // the tunnel west: a mosaic floor, brick walls and roof, 3 wide inside; the dome's glass is cut away where it joins
  const T = P.tunnel;
  ubox(T.u0, 1, -2, T.u1 + 1, 3, 2, B.AT_BRICK);
  ubox(T.u0, 3, -1, T.u1 + 1, 3, 1, B.AT_MOSAIC);
  ubox(T.u0, 4, -2, T.u1 + 1, 7, -2, B.AT_BRICK); ubox(T.u0, 4, 2, T.u1 + 1, 7, 2, B.AT_BRICK);
  ubox(T.u0, 7, -2, T.u1 + 1, 7, 2, B.AT_BRICK);
  ubox(T.u0, 4, -1, T.u1 + 1, 6, 1, B.AIR);
  ubox(T.u1 + 1, 4, -1, T.u1 + 1, 6, 1, B.AIR); // through the dome wall
  ubox(T.u0 - 1, 1, -2, T.u0 - 1, 2, 2, B.AT_BRICK); // a step down outside
  const gate = [];
  for (let v = -1; v <= 1; v++) for (let y = 4; y <= 6; y++) { U(T.u0, y, v, B.AT_DOME); const [x, z] = at(T.u0, v); gate.push([x, y, z]); }
  const [bx, bz] = at(P.boss[0], P.boss[1]);
  const boss = placeBoss(world, 'atlantis', { x: bx, y: P.floor, z: bz, facing: [-1, 0] });
  const [mx, mz] = at(T.u0 - 3, 0);
  const palace = {
    c: [pcx, pcz], gate, mouth: [mx + 0.5, mz + 0.5], boss,
    inside: { x0: CITY.x + T.u0 - 1, x1: CITY.x + P.plinth + 1, y0: 3, y1: SEA, z0: CITY.z - P.plinth, z1: CITY.z + P.plinth }, // the throne room and the tunnel: the gate never shuts on you
    dome: { cy: P.domeY, R: P.domeOut },
  };
  world.keeps.push({ name: 'atlantis-palace', protect: [{ x0: CITY.x - P.plinth, x1: CITY.x + P.plinth, y0: 0, y1: SEA + 1, z0: CITY.z - P.plinth, z1: CITY.z + P.plinth }], wallText: 'The palace is part of the picture. The Queen lives here!' });

  /* 3. the districts */
  const floorTile = (u0, v0, u1, v1, id) => ubox(u0, 1, v0, u1, 1, v1, id);
  const lanternAt = d => { // a pedestal of bricks and a 3 x 3 x 3 lantern; its cells are drawn dark/lit with setLive
    const [lu, lv] = d.lantern, cells = [];
    ubox(lu - 1, 1, lv - 1, lu + 1, d.base - 1 + 0, lv + 1, B.AT_BRICK);
    for (let u = lu - 1; u <= lu + 1; u++) for (let v = lv - 1; v <= lv + 1; v++) for (let y = d.base + 0; y <= d.base + 2; y++) { U(u, y, v, B.AT_LANTERN_OFF); const [x, z] = at(u, v); cells.push([x, y, z]); }
    const [cx, cz] = at(lu, lv);
    return { cells, centre: [cx + 0.5, d.base + 1.5, cz + 0.5], box: { x0: cx - 1, x1: cx + 1, y0: d.base, y1: d.base + 2, z0: cz - 1, z1: cz + 1 } };
  };
  const lampAt = (u, y, v, lamps) => { U(u, y - 1, v, B.AT_BRICK); U(u, y, v, B.AT_LAMP_OFF); const [x, z] = at(u, v); lamps.push([x, y, z]); };
  const districts = DISTRICTS.map(d => ({ ...d, lamps: [], lit: 0 }));
  const [mk, gd, tp] = districts;

  // Jar Market: a mosaic square, stalls with clay jars, low walls, broken columns, lamps
  for (let u = -33; u <= -5; u++) for (let v = -15; v <= 15; v++) if (Math.hypot(u + 19, v) <= 13.5 && !(u >= PALACE.tunnel.u0 - 2 && Math.abs(v) <= 3)) U(u, 1, v, B.AT_MOSAIC);
  const jars = [];
  const jarAt = (u, y, v, fish) => {
    U(u, y, v, B.AT_JAR);
    const [x, z] = at(u, v);
    jars.push({ id: `jar${jars.length}`, cell: [x, y, z], fish, home: [x + 0.5, y + SHY_AT, z + 0.5] });
  };
  for (const s of STALLS) { ubox(s.u, 2, s.v, s.u + s.w - 1, 1 + s.h, s.v + s.d - 1, B.AT_BRICK); jarAt(s.jar[0], 2 + s.h, s.jar[1], s.fish); }
  for (const w of WALLS) { ubox(w.u, 2, w.v, w.u + w.w - 1, 2, w.v + w.d - 1, B.AT_BRICK); jarAt(w.jar[0], 3, w.jar[1], null); }
  for (const [u, v, h] of COLUMNS) for (let y = 2; y < 2 + h; y++) U(u, y, v, B.AT_COLUMN);
  const marketLantern = lanternAt(mk);
  for (const [u, v] of [[-24, -3], [-24, 3], [-14, -4], [-14, 4], [-29, -6], [-29, 6], [-20, -9], [-20, 9]]) lampAt(u, 2, v, mk.lamps);

  // Arch Gardens: a mosaic plaza, arches, five broken houses and two closed corridors (the dead ends), the lantern in the middle
  for (let u = -13; u <= 13; u++) for (let v = -34; v <= -14; v++) if (Math.abs(u) <= 6 || (v >= -27 && v <= -22)) U(u, 1, v, B.AT_MOSAIC);
  const deadEnds = [];
  for (const h of HOUSES) {
    const [cu, cv] = h.c, [du, dv] = h.door;
    ubox(cu - 3, 2, cv - 3, cu + 3, 5, cv + 3, B.AT_BRICK);
    ubox(cu - 2, 2, cv - 2, cu + 2, 5, cv + 2, B.WATER);
    ubox(cu - 3, 6, cv - 3, cu + 3, 6, cv + 3, B.AT_BRICK);
    ubox(cu - 3, 1, cv - 3, cu + 3, 1, cv + 3, B.AT_MOSAIC);
    for (const [ru, rv] of [[-1, 1], [1, 1], [0, -2], [2, 0]]) if (!(ru === 0 && rv === 0)) U(cu + ru, 6, cv + rv, B.WATER); // the roof is broken in a few places
    for (const [ru, rv] of [[-3, 0], [3, 1], [0, 3], [-1, -3]]) if (!(Math.abs(ru - 3 * du) < 1 && Math.abs(rv - 3 * dv) < 1)) U(cu + ru, 5, cv + rv, B.WATER); // and the wall tops are chipped
    // the door: 3 wide, y 2..4
    for (let s = -1; s <= 1; s++) for (let y = 2; y <= 4; y++) U(cu + 3 * du + (dv ? s : 0), y, cv + 3 * dv + (du ? s : 0), B.WATER);
    const deep = at(cu - 2 * du, cv - 2 * dv), mouth = at(cu + 4 * du, cv + 4 * dv);
    deadEnds.push({ id: h.id, kind: 'house', deep: [deep[0] + 0.5, deep[1] + 0.5], mouth: [mouth[0] + 0.5, mouth[1] + 0.5], dir: [-du, -dv] });
  }
  for (const c of CORRIDORS) {
    const [su, sv] = c.start, [du, dv] = c.dir, n = c.len;
    for (let k = 0; k <= n; k++) {
      const u = su + du * k, v = sv + dv * k, pu = dv ? 1 : 0, pv = du ? 1 : 0; // across the corridor
      for (let s = -2; s <= 2; s++) {
        const edge = Math.abs(s) === 2;
        for (let y = 2; y <= 6; y++) U(u + pu * s, y, v + pv * s, edge || y === 6 || k === n ? B.AT_BRICK : B.WATER);
        U(u + pu * s, 1, v + pv * s, B.AT_MOSAIC);
      }
    }
    for (let y = 2; y <= 4; y++) for (let s = -1; s <= 1; s++) { const k = n - 1; U(su + du * k + (dv ? s : 0), y, sv + dv * k + (du ? s : 0), s === 0 && y === 2 ? B.AT_BRICK : B.AT_BRICK); } // fallen stones close the end
    const deep = at(su + du * (n - 2), sv + dv * (n - 2)), mouth = at(su - du * 1, sv - dv * 1);
    deadEnds.push({ id: c.id, kind: 'arch', deep: [deep[0] + 0.5, deep[1] + 0.5], mouth: [mouth[0] + 0.5, mouth[1] + 0.5], dir: [-du, -dv] });
  }
  for (const [u, v] of ARCHES) { for (const s of [-2, 2]) for (let y = 2; y <= 5; y++) U(u + s, y, v, B.AT_COLUMN); for (let s = -2; s <= 2; s++) U(u + s, 6, v, B.AT_BRICK); }
  for (const [u, v] of [[-6, -15], [6, -15], [-6, -34], [6, -34], [-6, -29], [6, -29]]) { U(u, 2, v, B.CORAL); U(u, 3, v, B.CORAL); } // coral hedges
  const gardensLantern = lanternAt(gd);
  for (const [u, v] of [[-5, -21], [5, -21], [-5, -29], [5, -29], [-3, -18], [3, -18], [-16, -27], [16, -27]]) lampAt(u, 2, v, gd.lamps);

  // Temple Steps: five wide steps, a terrace, columns with a lintel, a back wall, the lantern
  for (let k = 0; k < STEPS.n; k++) for (let r = 0; r < STEPS.rows; r++) {
    const v = STEPS.v0 + k * STEPS.rows + r, top = STEPS.top0 + k;
    ubox(-STEPS.u, 1, v, STEPS.u, top - 1, v, B.AT_BRICK); ubox(-STEPS.u, top, v, STEPS.u, top, v, B.AT_MOSAIC);
  }
  const topY = STEPS.top0 + STEPS.n - 1;
  ubox(-STEPS.u - 1, 1, STEPS.terrace[0], STEPS.u + 1, topY - 1, STEPS.terrace[1], B.AT_BRICK); ubox(-STEPS.u - 1, topY, STEPS.terrace[0], STEPS.u + 1, topY, STEPS.terrace[1], B.AT_MOSAIC);
  ubox(-STEPS.u - 1, 1, STEPS.wallV[0], STEPS.u + 1, 11, STEPS.wallV[1], B.AT_BRICK);
  for (const u of STEPS.columns) for (let y = topY + 1; y <= topY + 4; y++) U(u, y, STEPS.colV, B.AT_COLUMN);
  ubox(-9, topY + 5, STEPS.colV, 9, topY + 5, STEPS.colV, B.AT_BRICK);
  for (const s of [-1, 1]) ubox(s * 11, 2, 12, s * 11, 3, 33, B.AT_BRICK); // low side walls
  const templeLantern = lanternAt(tp);
  for (const [u, v] of [[-8, 13], [8, 13], [-9, 20], [9, 20], [-9, 26], [9, 26], [-6, 33], [6, 33]]) { const y = stepTop(v) + 1; U(u, y - 1, v, B.AT_BRICK); U(u, y, v, B.AT_LAMP_OFF); const [x, z] = at(u, v); tp.lamps.push([x, y, z]); }
  mk.lantern = marketLantern; gd.lantern = gardensLantern; tp.lantern = templeLantern;

  /* 4. the diving bell: a dry glass room on the west rim, the way back on its west wall, the door out on its east wall */
  const Bl = BELL;
  for (let x = Bl.x0; x <= Bl.x1; x++) for (let z = Bl.z0; z <= Bl.z1; z++) {
    for (let y = 0; y < Bl.floor; y++) put(x, y, z, B.STONE);
    put(x, Bl.floor, z, B.AT_BRICK);
    const edge = x === Bl.x0 || x === Bl.x1 || z === Bl.z0 || z === Bl.z1, corner = (x === Bl.x0 || x === Bl.x1) && (z === Bl.z0 || z === Bl.z1);
    for (let y = Bl.floor + 1; y < Bl.roof; y++) put(x, y, z, corner ? B.AT_BRICK : edge ? B.AT_DOME : B.AIR);
    put(x, Bl.roof, z, edge ? B.AT_BRICK : B.AT_DOME);
    for (let y = Bl.roof + 1; y <= SEA; y++) put(x, y, z, B.WATER);
    surf[idx(x, z)] = Bl.floor; world.ground[idx(x, z)] = Bl.floor;
  }
  for (let z = Bl.door.z[0]; z <= Bl.door.z[1]; z++) for (let y = Bl.door.y[0]; y <= Bl.door.y[1]; y++) put(Bl.door.x, y, z, B.AIR);
  const door = buildWayBack(world, 'atlantis', { x: Bl.frame[0], y: Bl.floor, z: Bl.frame[1], facing: [1, 0] });
  world.keeps.push({ name: 'atlantis-bell', protect: [{ x0: Bl.x0, x1: Bl.x1, y0: 0, y1: Bl.roof + 1, z0: Bl.z0, z1: Bl.z1 }], wallText: 'The diving bell is part of the picture.' });

  /* 5. the whirlpool, the bubble columns, the swimming box, the crater keep */
  const sinks = [{ id: 'whirl', x: [WHIRL.x - WHIRL.r, WHIRL.x + WHIRL.r], z: [WHIRL.z - WHIRL.r, WHIRL.z + WHIRL.r], y: WHIRL.y }];
  world.sinks = sinks;
  world.sinkAt = p => sinks.some(s => p.x >= s.x[0] && p.x <= s.x[1] + 1 && p.z >= s.z[0] && p.z <= s.z[1] + 1 && p.y >= s.y[0] && p.y <= s.y[1]);
  const lifts = BUBBLES.map(([u, v], i) => { const [x, z] = at(u, v); return { id: `bubbles-${i}`, x: [x - 1, x + 1], z: [z - 1, z + 1], y: [2, SEA] }; });
  world.lifts = [...(world.lifts || []), ...lifts];
  const DEEP = { cx: CITY.x + 0.5, cz: CITY.z + 0.5, r: CITY.dive, y0: 1.5, y1: SEA + 1.3 };
  world.deepWater = DEEP;
  world.deepAt = p => Math.hypot(p.x - DEEP.cx, p.z - DEEP.cz) <= DEEP.r && p.y >= DEEP.y0 && p.y <= DEEP.y1;
  world.keeps.push({ name: 'atlantis-city', rideIn: true, protect: [{ x0: CITY.x - CITY.rimTo, x1: CITY.x + CITY.rimTo, y0: 0, y1: SEA + 2, z0: CITY.z - CITY.rimTo, z1: CITY.z + CITY.rimTo }], wallText: 'The Sunken City is part of the picture. It is too old to break!' });

  /* 6. the fish: homes, the school's path, the dead ends */
  const darters = DARTERS.map(([u, v], i) => { const [x, z] = at(u, v); return { id: `dart${i}`, index: i, home: [x + 0.5, z + 0.5], y: 3.3 }; });
  const [sax, saz] = at(...SCHOOL.a), [sbx, sbz] = at(...SCHOOL.b);
  const school = { a: [sax + 0.5, saz + 0.5], b: [sbx + 0.5, sbz + 0.5], y: z => stepTop(Math.floor(z) - CITY.z) + SCHOOL.over + 0.3, floor: (x, z) => stepTop(Math.floor(z) - CITY.z) };
  const shy = jars.filter(j => j.fish != null).sort((a, b) => a.fish - b.fish);

  /* 7. guards (optional bonus battles), rests */
  const guard = (i, u, v, y, facing) => { const [x, z] = at(u, v); placeCrew(world, 'atlantis', i, { x, y, z, facing }); };
  guard(0, -21, 5, 1, [1, 0]);   // Guard Pelos: in the Jar Market
  guard(1, -3, 28, topY, [0, -1]); // Guard Talia: on the temple terrace
  world.rests.push([CITY.x + 0.5, P.floor + 1, CITY.z + 0.5, Math.PI / 2]);

  world.atlantis = {
    city: CITY, bell: { ...BELL, door: door }, whirl: WHIRL, bubbles: BUBBLES.map(([u, v]) => at(u, v)), palace, districts,
    jars, shy, darters, deadEnds, school, lit: [0, 0, 0], boss, deep: DEEP,
  };
  world.skyDim = (x, y, z) => dimAt(x, y, z, world.atlantis.lit);
  world.underground = () => false; // the dim city is not a cave: no cave fog, no "it's dark down here" (the net's glow is the light)
  const biome = world.realmBiome;
  world.realmBiome = (x, z) => (Math.hypot(x - CITY.x, z - CITY.z) <= CITY.flat ? 'atlantis' : biome ? biome(x, z) : 'pirateSea');
  world.sunkenY = (x, z, sp) => { // wild Atlantis creatures stand on the free city floor (creatures.groundY): a y, null (no room here) or undefined (not for this creature)
    if (sp.type !== 'atlantis' || craterR(x, z) > CITY.flat) return undefined; // not ours: the usual rules (null = ours, but no room here)
    const x0 = Math.floor(x), z0 = Math.floor(z), fl = world.ground[x0 + z0 * W];
    if (x0 >= BELL.x0 - 1 && x0 <= BELL.x1 + 1 && z0 >= BELL.z0 - 1 && z0 <= BELL.z1 + 1) return null; // the dry diving bell is no home for them
    if (!world.isSolid(x0, fl, z0) || world.isSolid(x0, fl + 1, z0) || world.isSolid(x0, fl + 2, z0)) return null; // only the free floor: not the steps, the plinth, a house
    return sp.floats ? fl + 1.5 : fl + 1;
  };
  world.parts.push({ id: 'atlantis', live: 'atlantis' });
  return world.atlantis;
}

/* ------------------------------ the guide ------------------------------ */

// The arrow in the Pirate Seas when Atlantis matters (called first by pirateAim): { x, z, text(arrow, metres) } or null.
export function atlantisAim(world, p, game) {
  const A = world.atlantis;
  if (!A) return null;
  const stars = game?.stars ?? [], star = stars.includes('atlantis'), via = game?.realms?.via;
  const inside = craterR(p.x, p.z) <= CITY.rimTo + 4, east = p.x > 195;
  if (!inside && !east && via !== 'atlantis') return null;
  if (!inside && star) return null;                      // the star is won: the usual Pirate Seas guide
  const live = game?.gymLive?.of?.('part:atlantis');
  if (!inside) return { x: WHIRL.x + 0.5, z: WHIRL.z + 0.5, text: (a, m) => `🔱 Swim into the whirlpool to find Atlantis ${a} ${m} m` };
  const st = lightState(game);
  if (star) { // the Queen is beaten: the way back is the bell's door
    const d = world.doors?.find(q => q.key === 'atlantis'), s = d?.surface?.[Math.floor(d.surface.length / 2)];
    return s ? { x: s[0] + 0.5, z: s[2] + 0.5, text: (a, m) => `🖼️ Way back ${a} ${m} m` } : null;
  }
  const carried = live?.carriedKinds?.() ?? [];
  const lanternOf = d => ({ x: d.lantern.centre[0], z: d.lantern.centre[2] });
  const pick = A.districts.find(d => carried.includes(d.kind) && st.lit[A.districts.indexOf(d)] < PER_DISTRICT)
    ?? A.districts.find((d, i) => st.lit[i] < PER_DISTRICT);
  if (pick && !st.done) {
    const i = A.districts.indexOf(pick), at = lanternOf(pick), lab = `(${st.total} / ${LIGHTS})`;
    if (carried.includes(pick.kind)) return { x: at.x, z: at.z, text: (a, m) => `💡 Take the glowfish to the ${pick.name} lantern! ${lab} ${a} ${m} m` };
    return { x: at.x, z: at.z, text: (a, m) => `🐟 ${pick.name}: catch glowfish! ${st.lit[i]} / ${PER_DISTRICT} ${a} ${m} m` };
  }
  // all 12 lights: the palace gate, then the Queen
  const b = A.boss, gm = A.palace.mouth;
  const inPalace = p.x >= A.palace.inside.x0 && p.x <= A.palace.inside.x1 && p.z >= A.palace.inside.z0 && p.z <= A.palace.inside.z1 && p.y >= 3;
  if (inPalace) return { x: b.pos[0], z: b.pos[2], text: (a, m) => `👑 Queen Coralia ${a} ${m} m` };
  return { x: gm[0], z: gm[1], text: (a, m) => `🏛️ The palace is open! Swim in ${a} ${m} m` };
}
