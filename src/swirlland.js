// T38a: the terrain of the Swirl realm (TERRAINS.swirlLand in realms.js). A purple sky over a soft cloud sea, with floating
// decks (the hub with the door home, a north and a south gallery, the looping stairs, the Wizard's island), a spiral stair and
// a straight one, lift streams (upward rivers: boxes, no blocks), eleven picture frames hanging in the air covered with cloth,
// and far to the east the Wizard's tower behind a row of empty star-stone spots (the star bridge).
// Everything is data (DECKS, STAIRS, LIFTS, FRAME_SPOTS, BRIDGE) and a few loops; the seed changes nothing, so every deck, step
// and frame is always where the table says. Node-runnable like dreamland.js: needs only a world with
// W / D / data / ground / index / inBounds / get (the spec runs it on a stand-in as well).
// T38d: the Wizard's paint-box look: four moods (ZONES, zoneWeights), painted deck tops, glow puffs and lanterns, sculptures made of
// blocks (SCULPTURES), and the data for the sky's nebula puffs, sparks and floating oddities (decorList; swirlsky.js draws those).
import { B, WOOL, mulberry32 } from './blocks.js';
import { FRAME_WORLDS, BRIDGE_WORLDS, pictureWorld } from './pictureworlds.js';
import { buildPortalHouse, houseAim, HUB as HOUSE_HUB } from './portalhouse.js'; // T42: the Portal House in the north-east sky

// ---------------------------------------------------------------------------------------------------------------------------------
// T38d: the Swirl's moods. Four zones with their own pastel palettes blend over a constant haze (weights are smoothstep rings; the GLSL
// in caves.js swirlTint copies zoneWeights exactly). Colours are hex as written (sRGB); swirlsky.js turns them into screen colours.
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const hexRgb = hex;
export const ZONES = [
  { id: 'sherbet', name: '🍧 Sherbet Sky', x: 50, z: 80, r: 26, // the hub: bright candy sherbet
    top: '#9fd8ff', mid: '#ffc9e3', fog: '#fff0d4', band: '#c9f5df', blobA: '#ffd6a5', blobB: '#ffffff', lo: '#f4a6c8', hi: '#fff4d6', sea: '#ffd9ec', lit: 1.0, fogNear: 50, fogFar: 130 },
  { id: 'mist', name: '🌙 Moonmilk Mist', x: 48, z: 42, r: 30, // north: dim violet mist, glowing puffs
    top: '#2c2466', mid: '#4b3f8f', fog: '#8a7fc7', band: '#3fb8b0', blobA: '#ff8fd0', blobB: '#6fe3ff', lo: '#3b3570', hi: '#a99be0', sea: '#4a3f86', lit: 0.7, fogNear: 26, fogFar: 85 },
  { id: 'sundrop', name: '🌅 Sundrop Shore', x: 48, z: 116, r: 30, // south: peach and butter sunset
    top: '#c7a6ff', mid: '#ffab9e', fog: '#ffe08a', band: '#ff8fb1', blobA: '#fff3b0', blobB: '#ffd0e8', lo: '#ff9f8f', hi: '#ffe9a8', sea: '#ffd0b0', lit: 0.95, fogNear: 44, fogFar: 120 },
  { id: 'inkwell', name: '🖋️ Inkwell Deep', x: 110, z: 80, r: 50, // east: inky blue nebula with gold flecks
    top: '#0f2345', mid: '#2a4f8c', fog: '#6fb6c9', band: '#ffd98a', blobA: '#b28dff', blobB: '#ff9ad5', lo: '#24406e', hi: '#8fd0e0', sea: '#3b6f9a', lit: 0.78, fogNear: 36, fogFar: 115 },
];
export const HAZE = { id: 'haze', w: 0.12, name: 'Haze', // a little of this everywhere
  top: '#b9a8f0', mid: '#d8c8ff', fog: '#f2e8ff', band: '#ffd1f0', blobA: '#ffe0f4', blobB: '#d6f0ff', lo: '#b8a6e8', hi: '#efe8ff', sea: '#e3d8ff', lit: 0.85, fogNear: 44, fogFar: 125 };
export const PALETTES = [...ZONES, HAZE];
const COLOR_KEYS = ['top', 'mid', 'fog', 'band', 'blobA', 'blobB', 'lo', 'hi', 'sea'];
export const PARSED = PALETTES.map(z => { const o = { id: z.id }; for (const k of COLOR_KEYS) o[k] = hex(z[k]); o.lit = z.lit; o.fogNear = z.fogNear; o.fogFar = z.fogFar; return o; });
const smooth = t => t * t * (3 - 2 * t);
// Weights of the four zones and the haze at a spot of the map; they add up to 1.
export function zoneWeights(x, z) {
  const w = {};
  let sum = HAZE.w;
  for (const zn of ZONES) { w[zn.id] = smooth(Math.max(0, Math.min(1, 1 - Math.hypot(x - zn.x, z - zn.z) / zn.r))); sum += w[zn.id]; }
  for (const k in w) w[k] /= sum;
  w.haze = HAZE.w / sum;
  return w;
}
// The id of the biggest weight.
export function zoneAt(x, z) {
  const w = zoneWeights(x, z);
  let best = 'haze';
  for (const k in w) if (w[k] > w[best]) best = k;
  return best;
}
// The weighted palette value at a spot: [r, g, b] (0..1, as written) for a colour key, a number for lit / fogNear / fogFar.
export function zoneMix(x, z, key) {
  const w = zoneWeights(x, z);
  if (typeof PARSED[0][key] === 'number') return PARSED.reduce((a, p, i) => a + p[key] * w[PALETTES[i].id], 0);
  const out = [0, 0, 0];
  PARSED.forEach((p, i) => { const k = w[PALETTES[i].id]; for (let c = 0; c < 3; c++) out[c] += p[key][c] * k; });
  return out;
}

export const SEA = 0; // B.SWIRL_CLOUD at y 0 everywhere, ground 0: a soft landing
export const DECKS = [ // round: [cx, cz, r]; box: [x0, x1, z0, z1]; the top block is at y (you stand at y + 1)
  { id: 'hub', round: [48, 80, 11], y: 20 },        // arrival, door home, start of the star bridge
  { id: 'north', box: [20, 68, 52, 57], y: 26 },    // north gallery: frames N0-N5 hang above its north edge (x 20-27 since 2026-10-26, for N5)
  { id: 'south', box: [28, 68, 103, 108], y: 14 },  // south gallery: frames S0-S4 hang beyond its south edge
  { id: 'loopbase', box: [56, 64, 84, 92], y: 20 }, // the looping stairs stand here, joined to the hub
  { id: 'wizard', round: [142, 80, 9], y: 20 },     // the Wizard's island (its x = wizardX(12), the number of bridge stones)
];
export const DOOR = { x: 39, z: [78, 82], y: [21, 25], facing: [1, 0] }; // PORTAL 5 wide x 5 tall, frame round it (z 77/83, y 26)
export const STAIRS = [
  { id: 'spiral', kind: 'spiral', core: [46, 50, 60, 64], ring: [45, 51, 59, 65], from: [45, 65], rise: 6 }, // hub -> north gallery, round a 5x5 core
  { id: 'down', kind: 'straight', x: [47, 49], z: [91, 102], from: 19, step: 2 },                           // hub -> south gallery, 2 cells per step
  { id: 'loop', kind: 'loop', ring: [56, 64, 84, 92], rise: 4 },                                             // a 9x9 square ring: up 4 on one half, down 4 on the other
];
export const LIFTS = [ // upward rivers: boxes (cells x0..x1, z0..z1), feet inside rise until y1 + 1, then you bob and walk onto the deck
  { id: 'hubS', x: [50, 51], z: [91, 92], y: [1, 22] },
  { id: 'north', x: [69, 70], z: [54, 55], y: [1, 28] },
  { id: 'northW', x: [18, 19], z: [54, 55], y: [1, 28] }, // beside the gallery's west end
  { id: 'south', x: [69, 70], z: [105, 106], y: [1, 16] },
  { id: 'southW', x: [26, 27], z: [105, 106], y: [1, 16] },
  { id: 'wizard', x: [59, 60], z: [82, 83], y: [1, 22] }, // beside the bridge's start: a fall from the bridge is never far from here
];
const north = (x, k) => ({ id: `N${k}`, x, z: 51, y: 28, facing: [0, 1], stand: [x, 27, 52] }); // hangs 1 above the north deck (y 27 is air)
export const FRAME_SPOTS = [ // 11 places; FRAME_WORLDS[i] -> FRAME_SPOTS[i]
  ...[32, 40, 48, 56, 64].map(north),
  ...[32, 40, 48, 56, 64].map((x, k) => ({ id: `S${k}`, x, z: 109, y: 16, facing: [0, -1], stand: [x, 15, 108] })),
  north(24, 5), // owner 2026-10-26: the 11th frame (the fifth secret world), west of N0
];
// Which spot a world's frame hangs on: FRAME_WORLDS order (i -> FRAME_SPOTS[i]) unless moved here. Owner 2026-10-29: the Giant House
// moved one left (N5), so Deep Blue's two frames hang side by side (Atlantis on N0, beside the Pirate Seas on N1); Gravity took Atlantis's
// old spot (S2). Only which picture hangs where changes: the frame blocks (and their gem corners, by spot) are the same as before.
export const FRAME_MOVED = { house: 10, atlantis: 0, gravity: 7 };
export function frameSpotOf(id) { // -1: no frame (or a spot a moved frame took: never, the spec checks every spot is used once)
  if (FRAME_MOVED[id] !== undefined) return FRAME_MOVED[id];
  const i = FRAME_WORLDS.findIndex(w => w.id === id);
  return i < 0 || Object.values(FRAME_MOVED).includes(i) ? -1 : i;
}
export const FRAME = { w: 7, h: 7 }; // PICTURE_FRAME border, 5x5 inside: CLOTH, or PORTAL when the world is ready (later waves)
export const BRIDGE = { x0: 61, z: [79, 81], y: 20, len: 5, gap: 1 }; // star stone i: x 61+6i .. 65+6i, two layers (y 19-20)
export const WIZARD = { z: 80, r: 9, y: 20, R: 4, wallTop: 39 };
// Little floating islets: scenery only, nobody needs them.
export const ISLETS = [[14, 20, 3, 30], [24, 128, 4, 22], [86, 36, 3, 34], [90, 122, 4, 18], [126, 40, 3, 26], [132, 118, 5, 30], [152, 60, 3, 34], [78, 14, 4, 20], [76, 148, 3, 26]]; // (T38d: the one at 10, 82 is the paint palette now)

// T38d: painted swirls on the deck tops: round decks get arms of a spiral, box decks wavy stripes (true = Swirl Paint, false = Swirl Stone).
const ARMS = { hub: 3, wizard: 5 };
export function paintAt(deck, x, z) {
  if (deck.round) {
    const [cx, cz] = deck.round, dx = x + 0.5 - cx, dz = z + 0.5 - cz, r = Math.hypot(dx, dz);
    const u = (Math.atan2(dz, dx) * (ARMS[deck.id] ?? 3) / (Math.PI * 2) + r * 0.18) % 1;
    return r > 1.5 && (u + 1) % 1 < 0.28;
  }
  return (((x * 0.35 + 1.5 * Math.sin(z * 0.6)) % 4) + 4) % 4 < 1.3;
}

// Hanging Glow Puffs [x, y, z]: each sits right under a solid cell.
export const LANTERNS = [
  [32, 23, 57], [40, 23, 57], [56, 23, 57], [64, 23, 57], [36, 23, 52], [60, 23, 52], // under the north deck
  [40, 16, 74], [56, 17, 86],                                                          // under the hub rim
];

// Odd things built from blocks (all outside every lift, keep, frame and door box and away from every path).
export const SCULPTURES = [
  { id: 'crayon1', zone: 'sherbet', kind: 'crayon', x: 24, z: 70, top: 40, len: 12, color: 'pixie' }, // upside-down crayons, hanging tip-down
  { id: 'crayon2', zone: 'sherbet', kind: 'crayon', x: 22, z: 92, top: 38, len: 10, color: 'ice' },
  { id: 'palette', zone: 'sherbet', kind: 'palette', x: 16, z: 80, y: 12, r: 7, thumb: [19, 84, 2] },  // a painter's palette you see behind the door
  { id: 'fellup', zone: 'mist', kind: 'fellup', x: 48, z: 30, r: 6, y: 33 },                           // an island that fell up
  { id: 'brush', zone: 'sundrop', kind: 'brush', from: [64, 1, 134], to: [78, 31, 122] },             // a giant paintbrush dipped in the sea
  { id: 'inkpot', zone: 'inkwell', kind: 'inkpot', x: 96, z: 106, r: 4 },                             // an inkpot with a quill
];

// Floating oddities (drawn by swirlsky.js, never blocks): tumbling empty frames (w x h, colour index) and spinning swirl-wheels (radius).
export const FLOATERS = [
  ...[[30, 64, 30, 4, 3, 0], [64, 70, 32, 3, 4, 1], [36, 98, 28, 5, 5, 2],
    [30, 40, 34, 4, 3, 3], [62, 38, 30, 5, 5, 0], [70, 48, 40, 3, 4, 1],
    [34, 122, 22, 3, 4, 2], [64, 124, 20, 4, 3, 3],
    [84, 66, 30, 5, 5, 1], [90, 94, 34, 4, 3, 0], [126, 66, 36, 3, 4, 2], [128, 96, 30, 4, 3, 3]].map(([x, z, y, w, h, c]) => ({ kind: 'frame', x, y, z, w, h, c })),
  ...[[20, 60, 34, 2.5], [74, 40, 36, 3], [78, 104, 26, 2], [40, 128, 26, 3], [100, 62, 38, 2.5], [140, 80, 34, 3]].map(([x, z, y, r]) => ({ kind: 'wheel', x, y, z, r })),
];
export const FRAME_COLORS = ['#e8b84a', '#9ee8c8', '#ffa8cf', '#9ccfff'];

// Glowing nebula puffs and sparkles (swirlsky.js). Scattered from a fixed seed: the world never depends on them.
const PUFF_COLORS = { mist: ['#ff8fd0', '#6fe3ff', '#c9a8ff'], ink: ['#b28dff', '#ff9ad5', '#6fe3ff'], sun: ['#fff3b0', '#ffb3c6', '#ffc9a0'], sherbet: ['#ffffff', '#ffd0e8', '#bfe6ff'] };
export const PUFFS = [ // { zone, x, z, r, y: [y0, y1], n, colors }
  { zone: 'mist', x: 48, z: 30, r: 11, y: [10, 36], n: 8, colors: PUFF_COLORS.mist },
  { zone: 'mist', x: 48, z: 62, r: 18, y: [2, 8], n: 5, colors: PUFF_COLORS.mist },
  { zone: 'inkwell', x: 92, z: 62, r: 12, y: [4, 30], n: 6, colors: PUFF_COLORS.ink },
  { zone: 'inkwell', x: 92, z: 98, r: 12, y: [4, 30], n: 6, colors: PUFF_COLORS.ink },
  { zone: 'inkwell', x: 142, z: 80, r: 14, y: [10, 40], n: 6, colors: PUFF_COLORS.ink },
  { zone: 'sundrop', x: 48, z: 132, r: 18, y: [4, 18], n: 6, colors: PUFF_COLORS.sun },
  { zone: 'sherbet', x: 40, z: 82, r: 24, y: [38, 48], n: 6, colors: PUFF_COLORS.sherbet },
];
export const SPARKS = [ // { zone, box: [x0, x1, z0, z1, y0, y1], n, colors, kind: 0 firefly / 1 rising drop }
  { zone: 'mist', box: [28, 68, 50, 60, 27, 32], n: 60, colors: ['#7ff0e8', '#ffa0dc'], kind: 0 },
  { zone: 'inkwell', box: [60, 110, 74, 86, 21, 30], n: 50, colors: ['#ffe08a', '#fff3c4'], kind: 0 },
  { zone: 'sundrop', box: [30, 66, 108, 120, 14, 20], n: 30, colors: ['#ff9f8f', '#ffe08a', '#ffffff'], kind: 1 },
  { zone: 'sundrop', box: [56, 74, 126, 140, 1, 8], n: 30, colors: ['#ff9f8f', '#ffe08a', '#ffffff'], kind: 1 },
  { zone: 'sherbet', box: [30, 66, 66, 96, 22, 34], n: 30, colors: ['#ffffff', '#fff0d4'], kind: 0 },
];
// The scattered lists: { puffs: [{ zone, x, y, z, size, color, phase }], sparks: [{ zone, x, y, z, color, kind, phase }], floaters, lanterns }.
export function decorList() {
  const rand = mulberry32(0x5d1d), pick = a => a[Math.floor(rand() * a.length)];
  const puffs = [], sparks = [];
  for (const s of PUFFS) for (let i = 0; i < s.n; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * s.r;
    puffs.push({ zone: s.zone, x: s.x + Math.cos(a) * d, y: s.y[0] + rand() * (s.y[1] - s.y[0]), z: s.z + Math.sin(a) * d, size: 0.75 + rand() * 0.6, color: hex(pick(s.colors)), phase: rand() });
  }
  for (const s of SPARKS) for (let i = 0; i < s.n; i++) {
    const [x0, x1, z0, z1, y0, y1] = s.box;
    sparks.push({ zone: s.zone, x: x0 + rand() * (x1 - x0), y: y0 + rand() * (y1 - y0), z: z0 + rand() * (z1 - z0), color: hex(pick(s.colors)), kind: s.kind, phase: rand() });
  }
  return { puffs, sparks, floaters: FLOATERS, lanterns: LANTERNS };
}
// Corner gems of a frame: the wool nearest to the world's frame colour.
const GEMS = ['electric', 'water', 'fire', 'grass', 'mind', 'pixie', 'rock'];

// The first block of the star bridge for world i, and the Wizard's island x for n worlds.
export const stoneX = i => BRIDGE.x0 + (BRIDGE.len + BRIDGE.gap) * i;
export const wizardX = n => BRIDGE.x0 + (BRIDGE.len + BRIDGE.gap) * n + WIZARD.r;
// Every Swirl x/z cell of a lift, the middle of its box.
export const liftCenter = l => [(l.x[0] + l.x[1] + 1) / 2, (l.z[0] + l.z[1] + 1) / 2];

export function swirlLand(world, def, { house = def?.house !== false } = {}) { // T42: `house: false` makes the version 4 Swirl (tests; and while wave 15 is closed: comingsoon.js)
  const { W, D } = world;
  const put = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  const ground = (x, z, y) => { if (x >= 0 && z >= 0 && x < W && z < D) world.ground[x + z * W] = y; };
  const S = B.SWIRL_STONE;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) { put(x, SEA, z, B.SWIRL_CLOUD); ground(x, z, SEA); }

  // A solid column of stone from y0 up to the top.
  const column = (x, z, y0, top) => { for (let y = y0; y <= top; y++) put(x, y, z, S); ground(x, z, Math.max(world.ground[x + z * W], top)); };

  // 1. The decks: 3 thick, then a tapering underside so they look like they float.
  const round = (cx, cz, r, y, thick = 3) => {
    const T = Math.min(7, Math.round(r));
    for (let k = 0; k < thick + T; k++) { // the deck itself, then an underside that shrinks to a point
      const rr = k < thick ? r : r * (1 - (k - thick + 1) / (T + 1));
      for (let x = Math.floor(cx - rr - 1); x <= Math.ceil(cx + rr + 1); x++) for (let z = Math.floor(cz - rr - 1); z <= Math.ceil(cz + rr + 1); z++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > rr) continue;
        put(x, y - k, z, S);
        if (k === 0) ground(x, z, y);
      }
    }
  };
  const box = (x0, x1, z0, z1, y, thick = 3, taper = 2) => {
    for (let k = 0; k < thick + taper; k++) {
      const inset = Math.max(0, k - thick + 1);
      for (let x = x0 + inset; x <= x1 - inset; x++) for (let z = z0 + inset; z <= z1 - inset; z++) {
        put(x, y - k, z, S);
        if (k === 0) ground(x, z, y);
      }
    }
  };
  for (const d of DECKS) {
    if (d.id === 'wizard') continue; // placed below (its x depends on the number of worlds)
    if (d.round) round(d.round[0], d.round[1], d.round[2], d.y); else box(...d.box, d.y);
  }
  const n = BRIDGE_WORLDS.length;
  const wx = wizardX(n);
  round(wx, WIZARD.z, WIZARD.r, WIZARD.y);

  // A short post with a lamp on top (fixed stone, a glowing lamp).
  const post = (x, z, y, h = 2, lamp = B.LAMP) => { for (let i = 1; i <= h; i++) put(x, y + i, z, S); put(x, y + h + 1, z, lamp); };
  const puff = i => (i % 2 ? B.GLOW_PUFF_MINT : B.GLOW_PUFF); // pink and mint Glow Puffs take turns
  const lamps = [];

  // 2. The hub: lamp posts round the edge, the walkways to the stairs and the bridge.
  for (const a of [0.8, 2.4, 3.9, 5.5]) { // four lamp posts round the edge
    const x = Math.floor(48 + Math.cos(a) * 9.5), z = Math.floor(80 + Math.sin(a) * 9.5);
    post(x, z, 20, 2); lamps.push([x, z]);
  }
  for (let x = 59; x <= 60; x++) for (let z = 79; z <= 81; z++) box(x, x, z, z, 20, 3, 0); // the bridgehead
  for (const x of [45, 46]) for (let z = 66; z <= 68; z++) box(x, x, z, z, 20, 3, 0); // the walkway to the spiral stair

  // 3. The spiral stair: a 19-cell path round the 5x5 core, one step up every 3.6 cells, ending on the north gallery.
  const sp = STAIRS[0], [rx0, rx1, rz0, rz1] = sp.ring, [cx0, cx1, cz0, cz1] = sp.core;
  const path = [];
  for (let x = rx0; x <= rx1; x++) path.push([x, rz1]);        // along the south side, east
  for (let z = rz1 - 1; z >= rz0; z--) path.push([rx1, z]);   // up the east side, north
  for (let x = rx1 - 1; x >= rx0; x--) path.push([x, rz0]);   // along the north side, west
  const spiral = [];
  const paintTops = []; // [x, y, z] of tops that become Swirl Paint at the end (every other stair step, the painted deck swirls)
  path.forEach(([x, z], i) => { const top = 21 + Math.min(sp.rise - 1, Math.floor(i / 3.6)); spiral.push({ x, z, top }); column(x, z, 18, top); if (Math.floor(i / 2) % 2 === 0) paintTops.push([x, top, z]); });
  for (let x = cx0; x <= cx1; x++) for (let z = cz0; z <= cz1; z++) { column(x, z, 18, 31); } // the core: a tower you walk round
  put(48, 32, 62, B.CRYSTAL); put(48, 33, 62, B.CRYSTAL);
  const last = spiral.at(-1); // joins the north gallery (y 26) one cell away
  column(last.x, last.z - 1, 22, 26);

  // 4. The straight stair down to the south gallery: 2 cells per step.
  const dn = STAIRS[1];
  for (let z = dn.z[0]; z <= dn.z[1]; z++) for (let x = dn.x[0]; x <= dn.x[1]; x++) { const k = Math.floor((z - dn.z[0]) / dn.step), top = dn.from - k; column(x, z, 12, top); if (k % 2 === 0) paintTops.push([x, top, z]); }

  // 5. The looping stairs: a 1-wide square ring on the base, up 4 on one half and down 4 on the other. Round and round!
  const lp = STAIRS[2], [lx0, lx1, lz0, lz1] = lp.ring;
  const ring = [];
  for (let x = lx0; x <= lx1; x++) ring.push([x, lz0]);
  for (let z = lz0 + 1; z <= lz1; z++) ring.push([lx1, z]);
  for (let x = lx1 - 1; x >= lx0; x--) ring.push([x, lz1]);
  for (let z = lz1 - 1; z > lz0; z--) ring.push([lx0, z]);
  const loopTops = ring.map(([x, z], i) => {
    const top = 20 + Math.floor(Math.min(i, ring.length - i) / (ring.length / 2 / lp.rise));
    if (top > 20) { column(x, z, 20, top); if (Math.floor(i / 3) % 2 === 0) paintTops.push([x, top, z]); }
    return { x, z, top };
  });
  const mx = Math.floor((lx0 + lx1) / 2), mz = Math.floor((lz0 + lz1) / 2);
  post(mx, mz, 20, 6); lamps.push([mx, mz]);

  // 6. The galleries: lamp posts at the back, the frames in front.
  // The north gallery (the mist) has glowing puffs on its posts, the south one (the sunset) keeps lamps.
  [37, 47, 57].forEach((x, i) => { post(x, 53, 26, 2, puff(i)); lamps.push([x, 53]); });
  for (const x of [37, 47, 57]) { post(x, 107, 14, 2); lamps.push([x, 107]); }
  [29, 67].forEach((x, i) => { post(x, 55, 26, 2, puff(i + 1)); post(x, 105, 14, 2); });

  // 7. The picture frames: a PICTURE_FRAME border 7 x 7, two gem corners, CLOTH inside.
  const frames = [];
  FRAME_WORLDS.forEach(pw => {
    const i = frameSpotOf(pw.id), spot = FRAME_SPOTS[i]; // i = the spot (it picks the gem corners, so the blocks never move)
    if (!spot) return;
    const cells = [], border = [], cloth = [];
    for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy < FRAME.h; dy++) {
      const x = spot.x + dx, y = spot.y + dy, edge = Math.abs(dx) === 3 || dy === 0 || dy === FRAME.h - 1;
      const corner = Math.abs(dx) === 3 && (dy === 0 || dy === FRAME.h - 1);
      put(x, y, spot.z, edge ? (corner ? WOOL[GEMS[i % GEMS.length]] : B.PICTURE_FRAME) : B.CLOTH);
      (edge ? border : cloth).push([x, y, spot.z]);
      cells.push([x, y, spot.z]);
    }
    frames.push({ spot, world: pw.id, cells, border, cloth, stand: spot.stand, box: { x0: spot.x - 3, x1: spot.x + 3, z0: spot.z - 1, z1: spot.z + 1, y0: spot.y, y1: spot.y + FRAME.h - 1 } });
  });

  // 8. The star bridge: n stones of air (drawn with setLive when won), the island after them.
  const bridge = BRIDGE_WORLDS.map((pw, i) => {
    const x0 = stoneX(i), x1 = x0 + BRIDGE.len - 1, [z0, z1] = BRIDGE.z, cells = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = BRIDGE.y - 1; y <= BRIDGE.y; y++) cells.push([x, y, z]);
    return { world: pw.id, cells, box: { x0, x1, z0, z1, y0: BRIDGE.y - 1, y1: BRIDGE.y } };
  });

  // 9. The Wizard's tower: sealed Wizard Stone, glass windows with lamps behind them, a stepped wool cone, a crystal tip.
  const R = WIZARD.R, wz = WIZARD.z, wy = WIZARD.y, X = B.WIZARD_STONE;
  for (let y = wy + 1; y <= WIZARD.wallTop; y++) {
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) < R) continue;
      const lit = (y === wy + 8 || y === wy + 9 || y === wy + 15 || y === wy + 16) && (dx === 0 || dz === 0) && Math.abs(dx + dz) === R;
      put(wx + dx, y, wz + dz, lit ? B.GLASS : X);
    }
  }
  for (const y of [wy + 8, wy + 9, wy + 15, wy + 16]) for (const [dx, dz] of [[-R + 1, 0], [R - 1, 0], [0, -R + 1], [0, R - 1]]) put(wx + dx, y, wz + dz, B.LAMP);
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) put(wx + dx, WIZARD.wallTop + 1, wz + dz, X); // roof
  const cone = (r, y) => { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) put(wx + dx, y, wz + dz, WOOL.mind); };
  cone(R + 1, WIZARD.wallTop + 2); cone(3, WIZARD.wallTop + 3); cone(3, WIZARD.wallTop + 4); cone(2, WIZARD.wallTop + 5); cone(2, WIZARD.wallTop + 6); cone(1, WIZARD.wallTop + 7);
  put(wx, WIZARD.wallTop + 8, wz, B.CRYSTAL); // y 47, the top of the world
  // The sealed door on the west face: a gold frame round a 2 x 3 panel of Wizard Stone, a star above it.
  const dxw = wx - R, doorCells = [];
  for (let y = wy + 1; y <= wy + 4; y++) for (let z = wz - 2; z <= wz + 1; z++) {
    const inner = z >= wz - 1 && z <= wz && y <= wy + 3;
    put(dxw, y, z, inner ? X : B.PICTURE_FRAME);
    if (inner) doorCells.push([dxw, y, z]);
  }
  const star = [[dxw, wy + 6, wz - 1], [dxw, wy + 6, wz], [dxw, wy + 7, wz - 1], [dxw, wy + 7, wz]];
  for (const [x, y, z] of star) put(x, y, z, B.STAR_STONE); // always lit
  post(wx - 7, wz - 3, wy, 2, B.GLOW_PUFF); post(wx - 7, wz + 3, wy, 2, B.GLOW_PUFF_MINT);

  // 10. Scenery: little floating islets, each with a Glow Puff on top.
  ISLETS.forEach(([x, z, r, y], i) => { round(x, z, r + 0.5, y, 2); put(x, y + 1, z, puff(i)); });

  // 10b. T38d: painted swirls on the deck tops and every other stair step, hanging Glow Puffs, and the sculptures.
  for (const d of DECKS) {
    const [cx, cz, r] = d.round ? [d.id === 'wizard' ? wx : d.round[0], d.round[1], d.round[2]] : [0, 0, 0];
    const x0 = d.round ? Math.floor(cx - r) : d.box[0], x1 = d.round ? Math.ceil(cx + r) : d.box[1];
    const z0 = d.round ? Math.floor(cz - r) : d.box[2], z1 = d.round ? Math.ceil(cz + r) : d.box[3];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (d.round && Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r) continue;
      if (world.get(x, d.y, z) !== S || world.get(x, d.y + 1, z) !== B.AIR) continue; // posts, stair columns and the tower stay as they are
      if (paintAt(d.round ? { ...d, round: [cx, cz, r] } : d, x, z)) put(x, d.y, z, B.SWIRL_PAINT);
    }
  }
  for (const [x, y, z] of paintTops) if (world.get(x, y, z) === S && world.get(x, y + 1, z) === B.AIR) put(x, y, z, B.SWIRL_PAINT);
  const lanterns = LANTERNS.map(([x, y, z], i) => { put(x, y, z, puff(i)); return [x, y, z]; });
  const sculptures = [];
  for (const s of SCULPTURES) {
    const cells = [], sp = (x, y, z, id) => { put(x, y, z, id); cells.push([x, y, z]); };
    if (s.kind === 'crayon') { // a 3 x 3 pastel crayon with a paper band, tip down
      const tipY = s.top - s.len;
      for (let y = s.top; y > tipY + 1; y--) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) sp(s.x + dx, y, s.z + dz, y <= s.top - 3 && y >= s.top - 5 ? WOOL.paper : WOOL[s.color]);
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) sp(s.x + dx, tipY + 1, s.z + dz, WOOL[s.color]);
      sp(s.x, tipY, s.z, WOOL[s.color]);
    } else if (s.kind === 'palette') { // a kidney-shaped islet with a thumb hole and five blobs of paint
      const [tx, tz, tr] = s.thumb, T = 5;
      for (let k = 0; k < 2 + T; k++) {
        const rr = k < 2 ? s.r : s.r * (1 - (k - 1) / (T + 1));
        for (let x = Math.floor(s.x - s.r - 1); x <= Math.ceil(s.x + s.r + 1); x++) for (let z = Math.floor(s.z - s.r - 1); z <= Math.ceil(s.z + s.r + 1); z++) {
          if (Math.hypot(x + 0.5 - s.x, z + 0.5 - s.z) > rr || Math.hypot(x + 0.5 - tx, z + 0.5 - tz) < tr) continue;
          sp(x, s.y - k, z, k === 0 && paintAt({ id: 'palette', round: [s.x, s.z, s.r] }, x, z) ? B.SWIRL_PAINT : S);
        }
      }
      [[-4, -2, 'pixie'], [-2, -5, 'sky'], [2, -4, 'light'], [-5, 2, 'slime'], [0, 1, 'fire']].forEach(([dx, dz, c]) => {
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) sp(s.x + dx + a, s.y + 1, s.z + dz + b, WOOL[c]);
      });
    } else if (s.kind === 'fellup') { // an island that fell up: a flat face at the bottom, a point on top, trees hanging down
      for (let k = 0; k < 3; k++) for (let x = s.x - s.r; x <= s.x + s.r; x++) for (let z = s.z - s.r; z <= s.z + s.r; z++) if (Math.hypot(x + 0.5 - s.x, z + 0.5 - s.z) <= s.r) sp(x, s.y + k, z, S);
      for (let k = 1; k <= 6; k++) {
        const rr = s.r * (1 - k / 7);
        for (let x = s.x - s.r; x <= s.x + s.r; x++) for (let z = s.z - s.r; z <= s.z + s.r; z++) if (Math.hypot(x + 0.5 - s.x, z + 0.5 - s.z) <= rr) sp(x, s.y + 2 + k, z, k % 2 ? B.SWIRL_PAINT : S);
      }
      for (const [tx, tz] of [[s.x - 3, s.z], [s.x + 3, s.z + 1]]) {
        for (let y = s.y - 1; y >= s.y - 3; y--) sp(tx, y, tz, B.PLANKS);
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) if (dx * dx + dy * dy + dz * dz <= 5 && !(dx === 0 && dz === 0 && dy >= 0)) sp(tx + dx, s.y - 5 + dy, tz + dz, WOOL.grass);
      }
      [[s.x, s.z], [s.x - 2, s.z + 3], [s.x + 2, s.z - 3]].forEach(([x, z], i) => sp(x, s.y - 1, z, puff(i)));
    } else if (s.kind === 'brush') { // a giant paintbrush dipped in the cloud sea, with a puddle of paint
      const [x0, y0, z0] = s.from, [x1, y1, z1] = s.to, len = Math.hypot(x1 - x0, y1 - y0, z1 - z0), N = Math.ceil(len * 2);
      for (let x = Math.floor(x0 - 5); x <= Math.ceil(x0 + 5); x++) for (let z = Math.floor(z0 - 5); z <= Math.ceil(z0 + 5); z++) {
        const d = Math.hypot(x + 0.5 - x0, z + 0.5 - z0);
        if (d <= 5 && d >= 2.5) sp(x, SEA, z, B.SWIRL_PAINT);
      }
      for (let i = 0; i <= N; i++) {
        const t = i / N, d = t * len, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, pz = z0 + (z1 - z0) * t;
        const id = d < 1.5 ? WOOL.mind : d < 5 ? B.BRISTLE : d < 7 ? B.PICTURE_FRAME : d > len - 1.5 ? B.SWIRL_PAINT : WOOL.pixie;
        const w = d < 5 ? 3 : 2, o = d < 5 ? 1 : 0; // fat bristles, a thinner ferrule and handle
        for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) sp(Math.floor(px) - o + a, Math.floor(py), Math.floor(pz) - o + b, id);
      }
    } else if (s.kind === 'inkpot') { // a glass inkpot full of deep ink, a Wizard Stone rim and a quill
      for (let x = s.x - s.r - 1; x <= s.x + s.r + 1; x++) for (let z = s.z - s.r - 1; z <= s.z + s.r + 1; z++) {
        const d = Math.hypot(x + 0.5 - s.x, z + 0.5 - s.z);
        if (d > s.r) continue;
        if (d > s.r - 1.2) { for (let y = 1; y <= 7; y++) sp(x, y, z, B.GLASS); sp(x, 8, z, B.WIZARD_STONE); }
        else for (let y = 1; y <= 6; y++) sp(x, y, z, B.SWIRL_PAINT);
      }
      const q0 = [s.x + 1, 7, s.z], q1 = [s.x + 5, 20, s.z - 3];
      for (let i = 0; i <= 26; i++) {
        const t = i / 26, x = Math.floor(q0[0] + (q1[0] - q0[0]) * t), y = Math.floor(q0[1] + (q1[1] - q0[1]) * t), z = Math.floor(q0[2] + (q1[2] - q0[2]) * t);
        sp(x, y, z, WOOL.paper);
        if (t > 0.55) { sp(x + 1, y, z, WOOL.pixie); sp(x, y, z + 1, WOOL.pixie); }
      }
    }
    sculptures.push({ id: s.id, zone: s.zone, cells });
  }

  // 11. The door home: a frame round a 5 x 5 Portal, facing east (+x).
  const surface = [];
  const [z0, z1] = DOOR.z, [y0, y1] = DOOR.y;
  for (let z = z0 - 1; z <= z1 + 1; z++) {
    for (let y = y0; y <= y1 + 1; y++) {
      const frame = z === z0 - 1 || z === z1 + 1 || y === y1 + 1;
      put(DOOR.x, y, z, frame ? B.PORTAL_FRAME : B.PORTAL);
      if (!frame) surface.push([DOOR.x, y, z]);
    }
  }
  const doorBox = { x0: DOOR.x - 1, x1: DOOR.x + 1, z0: z0 - 2, z1: z1 + 2, y0: y0 - 1, y1: y1 + 2 };
  world.door = { surface, box: doorBox, stand: [44.5, y0, 80.5, -Math.PI / 2] };

  // 12. Keep boxes: nobody can build on or into these (the stone itself is fixed anyway).
  const keep = (name, b, wallText) => ({ name, protect: [b], wallText });
  world.keeps = [
    keep('door', doorBox, "The Portal Door is made of magic. You can't build here!"),
    ...frames.map(f => keep(`frame-${f.spot.id}`, f.box, "You can't build here: it's a picture frame!")),
    keep('bridge', { x0: 59, x1: wx - WIZARD.r - 1, z0: 76, z1: 84, y0: 1, y1: 47 }, "You can't build here: it's the star bridge!"),
    keep('wizard', { x0: wx - WIZARD.r - 1, x1: wx + WIZARD.r + 1, z0: wz - WIZARD.r - 1, z1: wz + WIZARD.r + 1, y0: 1, y1: 47 }, "You can't build here: it's the Wizard's island!"),
  ];
  world.lifts = LIFTS;
  world.swirl = {
    decks: DECKS, lifts: LIFTS, frames, bridge, spiral, loop: loopTops, lamps, zones: ZONES, decor: decorList(), sculptures, lanterns,
    wizard: { x: wx, z: wz, x0: wx - WIZARD.r, door: doorCells, star, box: { x0: wx - R, x1: wx + R, z0: wz - R, z1: wz + R, y0: wy + 1, y1: 47 } },
  };
  if (house) buildPortalHouse(world); // T42 (version 5): writes only inside its own volume, never moves an old Swirl part
}

// The guide in the Swirl: { x, z, text(arrow, distance) }. On the cloud sea: the nearest lift; a ready Picture World you have no
// star from: its frame; otherwise the door home.
// Where you come back out when you leave a Picture World through the way back of `id` (owner 2026-10-26: each door of a shared
// world, like Playland's, takes you out at its own frame): in front of that frame, facing it. Same as portal.js's way in.
export function frameReturn(id) {
  const spot = FRAME_SPOTS[frameSpotOf(id)];
  if (!spot) return null;
  const [fx, fz] = spot.facing;
  return [spot.stand[0] + 0.5, spot.stand[1], spot.stand[2] + 0.5, Math.atan2(-fx, -fz), 0];
}

export function swirlAim(world, p, game) {
  const inHouse = houseAim(world, p, game); // T42: inside the Portal House its own guide leads the way
  if (inHouse) return inHouse;
  const near = list => list.reduce((best, c) => (!best || Math.hypot(c.x - p.x, c.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? c : best), null);
  if (p.y < 4 && world.lifts?.length) {
    const c = near(world.lifts.map(l => { const [x, z] = liftCenter(l); return { x, z }; }));
    return { x: c.x, z: c.z, text: (a, m) => `Ride the river up! ${a} ${m}m` };
  }
  const open = (world.swirl?.frames || []).map(f => ({ f, w: FRAME_WORLDS.find(w => w.id === f.world) }))
    .filter(({ w }) => w?.ready && !game?.stars?.includes(w.id)).map(({ f, w }) => ({ x: f.stand[0] + 0.5, z: f.stand[2] + 0.5, w }));
  const house = world.swirl?.house; // T42: the Portal House is one more open world (a floor swirl on the hub), until you hold its star
  if (house && pictureWorld('portal')?.ready && !game?.stars?.includes('portal')) open.push({ x: (HOUSE_HUB.x[0] + HOUSE_HUB.x[1] + 1) / 2, z: (HOUSE_HUB.z[0] + HOUSE_HUB.z[1] + 1) / 2, w: pictureWorld('portal') });
  if (open.length) { const c = near(open); return { x: c.x, z: c.z, text: (a, m) => `${c.w.emoji} ${c.w.name} ${a} ${m}m` }; }
  const d = world.door, c = d.surface[Math.floor(d.surface.length / 2)];
  const x = c[0] + 0.5, z = c[2] + 0.5;
  if (Math.hypot(x - p.x, z - p.z) < 3) return { x, z, text: () => 'Portal Door: step in to go home' };
  return { x, z, text: (a, m) => `Portal Door home ${a} ${m}m` };
}
