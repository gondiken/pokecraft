// T38c: the mission maker. After the 12 hand-written MISSIONS (missions.js) Champion Solenne keeps giving missions made from
// templates. Pure: no Math.random, no game state; the same (n, seed) gives the same mission on every device. Missions come in
// rounds of 6 (map, map, build, catch, rematch or build, then a giant that grows each round). Numbers 13, 14, ... are `gen:<n>`.
// Pools are data (ids as strings, checked by the `missions` spec against the real species / gyms), so this file loads anywhere.
import { mulberry32 } from './blocks.js';
import { BUILD_IDS, BUILD_TEMPLATES, buildSpecOk, makeBuild } from './buildcheck.js';

export const FIRST_GEN = 13;      // the 12 hand-written missions are 1-12
export const ROUND_LEN = 6;
export const MORE_SPOTS = 24;     // treasure spots 5..28 (treasuremap.js moreTreasureSpots)
export const FIRST_MORE = 5;      // the old five come first
export const ROUND = ['map', 'map', 'build', 'catch', 'rematchOrBuild']; // shuffled per round; 'boss' is always the 6th

// Types that live in main-world biomes with no special condition (day / night are fine). Not cozy / treasure (homes), dream (realm),
// camo (disguised), cyber (needs a friend), time / ninja (golden hour, evening), cosmic / alien / bone (night or caves), parkour (high up).
export const CATCH_TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'rock', 'bug', 'ice', 'sound', 'metal', 'mind', 'toxic',
  'pixie', 'ghost', 'drake', 'rainbow', 'sky', 'slime', 'light', 'paper', 'food', 'squad'];
// Gyms with a building in the main world, open all day and easy to reach (id -> name; the spec compares with GYMS).
export const REMATCH_GYMS = {
  rock: 'Boulder Gym', bug: 'Hive Gym', toxic: 'Swamp Gym', water: 'Tide Gym', pixie: 'Twinkle Gym', grass: 'Grove Gym',
  electric: 'Volt Gym', sound: 'Echo Gym', metal: 'Iron Gym', mind: 'Mystic Gym', fire: 'Blaze Gym', ice: 'Frost Gym',
  ghost: 'Phantom Gym', drake: 'Scale Gym', rainbow: 'Prism Gym', light: 'Sunbeam Gym', paper: 'Origami Gym',
  food: 'Restaurant', squad: 'Big Top Gym',
};
export const GIANT_CYCLE = ['giant1', 'giant2', 'giant3'];
export const GIANT_INFO = { giant1: ['cragtusk', 'Giant Cragtusk'], giant2: ['blizzbear', 'Giant Blizzbear'], giant3: ['stormwyvern', 'Giant Stormwyvern'] };
export const KINDS = ['map', 'build', 'catch', 'rematch', 'boss'];

export const roundOf = n => Math.floor((n - FIRST_GEN) / ROUND_LEN) + 1;   // 13-18 -> 1, 19-24 -> 2 ...
export const isGenId = id => typeof id === 'string' && /^gen:\d+$/.test(id);
export const genNumber = id => (isGenId(id) ? Number(id.slice(4)) : null);
export const typeName = t => t.charAt(0).toUpperCase() + t.slice(1);
export const aType = t => `${/^[aeiou]/i.test(t) ? 'an' : 'a'} ${typeName(t)}`;
export const spotIndex = def => (def.kind === 'map' ? (def.k ?? def.n) : null); // generated maps use k, hand-written ones n

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const seedOf = seed => (Number.isFinite(seed) ? seed | 0 : 0);
// A step that is coprime with `len`, from the seed: walking a pool by it visits every entry before any repeats, never twice in a row.
function stride(seed, len, salt) {
  const ok = [];
  for (let s = 2; s <= len - 2; s++) if (gcd(s, len) === 1) ok.push(s);
  if (!ok.length) return 1;
  return ok[Math.floor(mulberry32((seedOf(seed) ^ salt) >>> 0)() * ok.length)];
}
const pickWalk = (pool, seed, salt, index) => {
  const r = mulberry32((seedOf(seed) ^ salt) >>> 0);
  const start = Math.floor(r() * pool.length);
  return pool[(start + index * stride(seed, pool.length, salt + 1)) % pool.length];
};

// The kinds of a round, in order (6 entries, the boss last), closed form from (seed, round).
export function roundKinds(round, seed) {
  const r = mulberry32((((seedOf(seed) ^ 0x6d155e) + round * 7919) >>> 0));
  const kinds = ROUND.map(k => (k === 'rematchOrBuild' ? (round % 2 === 0 ? 'rematch' : 'build') : k));
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  return [...kinds, 'boss'];
}

// Two different build templates per round, from (seed, round): the first build uses [0], the second [1].
function roundBuilds(round, seed) {
  const r = mulberry32((((seedOf(seed) ^ 0x6d1560) + round * 6151) >>> 0));
  const a = Math.floor(r() * BUILD_IDS.length);
  const b = (a + 1 + Math.floor(r() * (BUILD_IDS.length - 1))) % BUILD_IDS.length;
  return [BUILD_IDS[a], BUILD_IDS[b]];
}

// -> { id: 'gen:<n>', n, round, pos (1-6), kind, name, ...params }. Same (n, seed) -> the same object.
export function makeMission(n, seed) {
  const round = roundOf(n), pos = (n - FIRST_GEN) % ROUND_LEN;
  const kinds = roundKinds(round, seed), kind = kinds[pos];
  const before = k => kinds.slice(0, pos).filter(x => x === k).length;
  const rand = mulberry32((((seedOf(seed) ^ 0x6d155f) + n * 104729) >>> 0));
  const base = { id: `gen:${n}`, n, round, pos: pos + 1, kind };
  if (kind === 'map') {
    const j = 2 * (round - 1) + before('map'); // the j-th generated map
    return { ...base, name: `Treasure map ${6 + j}`, k: FIRST_MORE + (j % MORE_SPOTS) };
  }
  if (kind === 'build') {
    const t = roundBuilds(round, seed)[before('build')];
    const build = { t, ...BUILD_TEMPLATES[t].pick(rand, round) };
    return { ...base, name: makeBuild(build).name, build };
  }
  if (kind === 'catch') {
    const type = pickWalk(CATCH_TYPES, seed, 0x6d1561, round - 1);
    return { ...base, name: `Catch ${aType(type)} creature`, type };
  }
  if (kind === 'rematch') {
    const ids = Object.keys(REMATCH_GYMS);
    const gym = pickWalk(ids, seed, 0x6d1563, Math.floor(round / 2) - 1);
    return { ...base, name: `${REMATCH_GYMS[gym]} rematch`, gym };
  }
  const boss = GIANT_CYCLE[(round - 1) % GIANT_CYCLE.length], [species, name] = GIANT_INFO[boss];
  return { ...base, name, boss, grow: round, species };
}

// A saved spec checked: -> a clean copy, or null when it is junk (wrong kind, numbers or ids outside the pools). Must be gen:<n>.
export function cleanSpec(s, n) {
  if (!s || typeof s !== 'object' || !Number.isInteger(n) || n < FIRST_GEN) return null;
  if (s.id !== `gen:${n}` || s.n !== n || !KINDS.includes(s.kind) || typeof s.name !== 'string') return null;
  const base = { id: s.id, n, round: roundOf(n), pos: ((n - FIRST_GEN) % ROUND_LEN) + 1, kind: s.kind, name: s.name.slice(0, 60) };
  if (s.kind === 'map') return Number.isInteger(s.k) && s.k >= FIRST_MORE && s.k < FIRST_MORE + MORE_SPOTS ? { ...base, k: s.k } : null;
  if (s.kind === 'build') return buildSpecOk(s.build) ? { ...base, build: { ...s.build } } : null;
  if (s.kind === 'catch') return CATCH_TYPES.includes(s.type) ? { ...base, type: s.type } : null;
  if (s.kind === 'rematch') return REMATCH_GYMS[s.gym] ? { ...base, gym: s.gym } : null;
  if (!GIANT_INFO[s.boss] || !Number.isInteger(s.grow) || s.grow < 0 || s.grow > 99) return null;
  return { ...base, boss: s.boss, grow: s.grow, species: GIANT_INFO[s.boss][0] };
}
