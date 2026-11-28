// Owner 2026-11-28: the Wizard paints a NEW team for every battle. Pure (no Math.random): `wizardCrew(seed, wins)` -> six part-kit
// designs (guardiankit.js) of the Custom species `guardian`, each with a theme type whose colours it wears and whose moves it uses
// (plus one move of a second type), and a name from a word for that type + an ending from its parts ("Frostwing", "Blazecopter").
// studio.js `battleTeam` gives the seed (a fresh one each battle) and the levels; battle.js reads the 4th entry `paint`.
import { SLOTS, KIT, RAINBOW, NAME_MAX, cleanDesign, kitEnds } from './guardiankit.js';
import { PAINTS } from './custom.js';
import { MOVES, TYPE_COLORS, typeMoves } from './species.js';

// One word per theme type (at most 6 letters, so word + ending fits NAME_MAX). Every type but normal and custom has one (spec `wizard`).
export const THEME_WORDS = {
  fire: 'Blaze', water: 'Tide', grass: 'Leafy', electric: 'Volt', rock: 'Pebble', ice: 'Frost', bug: 'Buzz', ghost: 'Spook',
  mind: 'Brainy', metal: 'Clank', toxic: 'Gloop', pixie: 'Pixie', drake: 'Scaly', rainbow: 'Prism', cosmic: 'Comet', sound: 'Echo',
  bone: 'Bony', alien: 'Zorp', sky: 'Breezy', slime: 'Slimy', light: 'Shiny', paper: 'Folda', time: 'Ticky', camo: 'Hidey',
  cyber: 'Pixel', cozy: 'Snug', treasure: 'Goldy', food: 'Yum', squad: 'Crew', dream: 'Dozy', parkour: 'Flippy', ninja: 'Ninja',
  tiny: 'Teeny', pirate: 'Ahoy', racer: 'Zoom', ball: 'Bouncy', portal: 'Swirly', funfair: 'Jolly', surprise: 'Popsy',
  doodle: 'Doodly', atlantis: 'Coral', knight: 'Brave', bubble: 'Bubbly', gravity: 'Orby', mirror: 'Glassy',
};
const real = id => !!id && !!MOVES[id];
// The themes a creature can have: a word and all four standard moves.
export const THEMES = Object.keys(THEME_WORDS).filter(t => TYPE_COLORS[t] && (({ t1, t2, t3, t4 }) => [t1, t2, t3, t4].every(real))(typeMoves(t)));

export function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hexOf = c => (typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c) | 0;
const gap = (a, b) => ((a >> 16) - (b >> 16)) ** 2 + (((a >> 8) & 255) - ((b >> 8) & 255)) ** 2 + ((a & 255) - (b & 255)) ** 2;
// The paint (custom.js) closest to a type's colour; Rainbow wears the rainbow.
export function paintOfType(t) {
  if (t === 'rainbow') return RAINBOW;
  const h = hexOf(TYPE_COLORS[t]);
  let best = 0;
  PAINTS.forEach((p, i) => { if (gap(p.hex, h) < gap(PAINTS[best].hex, h)) best = i; });
  return best;
}

// Its moves: the theme's strong, quick and fourth move + the second type's strong one; from the third rematch (tier 3, like rematch.js)
// the quick move becomes one of the theme's big moves (never a sacrifice).
export function crewMoves(theme, second, wins = 0, r = Math.random) {
  const a = typeMoves(theme), b = typeMoves(second);
  const moves = [a.t2, a.t4, a.t3, b.t2];
  if (wins >= 2) {
    const bigs = a.big.filter(id => real(id) && MOVES[id].fx?.kind !== 'sacrifice');
    if (bigs.length) moves[2] = bigs[Math.floor(r() * bigs.length)];
  }
  return [...new Set(moves.filter(real))];
}

// One painted creature: random parts, the body in the theme's colour, an accent in the second type's, the rest at random.
export function crewDesign(theme, second, r, taken = new Set()) {
  const p = SLOTS.map(s => Math.floor(r() * KIT[s].length));
  const main = paintOfType(theme), acc = paintOfType(second);
  const any = () => (r() < 0.06 ? RAINBOW : Math.floor(r() * PAINTS.length));
  const c = SLOTS.map((s, i) => (i === 0 ? main : i === 2 ? (r() < 0.5 ? 11 : any()) : r() < 0.45 ? main : r() < 0.6 ? acc : any()));
  const word = THEME_WORDS[theme];
  const d = { n: '', p, c };
  const ends = kitEnds(d).filter(e => word.length + e.length <= NAME_MAX);
  let n = ends.length ? word + ends[Math.floor(r() * ends.length)] : word;
  for (let k = 2; taken.has(n); k++) n = `${word.slice(0, NAME_MAX - 2)} ${k}`;
  taken.add(n);
  d.n = n;
  return cleanDesign(d);
}

// Six creatures, six different themes. -> [{ theme, second, design, moves }]
export function wizardCrew(seed, wins = 0, size = 6) {
  const r = rng(seed);
  const pool = [...THEMES], taken = new Set(), out = [];
  for (let i = 0; i < size; i++) {
    const theme = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const others = THEMES.filter(t => t !== theme);
    const second = others[Math.floor(r() * others.length)];
    out.push({ theme, second, design: crewDesign(theme, second, r, taken), moves: crewMoves(theme, second, wins, r) });
  }
  return out;
}
