// Chapter 3 step B (plans/chapter3-abilities-build.md, owner 2026-11-14), pure, no imports: a creature's ABILITIES.
// Every creature walks (no chip). On top, its TYPE gives a set of abilities, and EVERY creature of that type has all of them (never "some
// fly, some swim"). Types and abilities are many to many. A card shows them as chips; a place (step C) asks for one.
// Every ability solves something no other can (owner 2026-11-14): Climb = a sheer wall taller than the fly cap (6 over the ground right
// below), Pass = faded half-erased walls only (Squeeze = a crack in real stone), Lift = something you can never reach, Grow = cracked
// stone (Push only shoves), Freeze = moving water stops, Swim = speed in water (anyone can dive), Rewind = it is already too late.
// Pictures: abilityicons.js draws each one as a badge (owner 2026-11-14: no emojis on screen); `icon` stays as a plain-text stand-in.
// **Ids are saved later (the guardian's chosen one is saved now, in its design `ab`): append-only, never renamed.**

export const ABILITIES = {
  fly: { icon: '🪽', name: 'Fly', line: 'Up into the open sky, over gaps with no floor.' },
  swim: { icon: '🌊', name: 'Swim', line: 'Fast in water: win a swim race, beat a gate before it shuts.' },
  climb: { icon: '🧗', name: 'Climb', line: 'Up a sheer wall too tall to fly up.' },
  dig: { icon: '⛏️', name: 'Dig', line: 'Through soft earth, to buried chests.' },
  squeeze: { icon: '📄', name: 'Squeeze', line: 'Flat as paper, through a crack in the stone.' },
  pass: { icon: '👻', name: 'Pass through', line: 'Through faded, half-erased walls.' },
  glow: { icon: '💡', name: 'Glow', line: 'Lights up the dark.' },
  burn: { icon: '🔥', name: 'Burn', line: 'Burns away thorns and tangles, melts ice.' },
  freeze: { icon: '❄️', name: 'Freeze', line: 'Stops moving water: a river, a waterfall.' },
  zap: { icon: '⚡', name: 'Zap', line: 'Zaps a machine into working.' },
  sprint: { icon: '💨', name: 'Sprint', line: 'A burst of speed to get there in time.' },
  rewind: { icon: '⏪', name: 'Rewind', line: 'Too late already? Turn the last moments back.' },
  push: { icon: '💪', name: 'Push', line: 'Shoves boulders and kicks balls into place.' },
  sneak: { icon: '🥷', name: 'Sneak', line: 'Sneaks past someone watching.' },
  lift: { icon: '✨', name: 'Lift', line: 'Lifts out what you can never reach.' },
  charm: { icon: '💖', name: 'Charm', line: 'Wins over someone grumpy.' },
  sense: { icon: '🔊', name: 'Sense', line: 'An echo shows a hidden path for a moment.' },
  grow: { icon: '🌱', name: 'Grow', line: 'Roots split cracked stone.' },
  heal: { icon: '💚', name: 'Heal', line: 'Brings grey, scribbled things back to colour.' },
};
for (const [id, a] of Object.entries(ABILITIES)) a.id = id;
export const ABILITY_IDS = Object.keys(ABILITIES); // the order chips are shown in

const ab = s => s.split(' ');
// type -> abilities (the map page's table, owner 2026-11-14). Custom has none of its own: the guardian's come from its design.
export const TYPE_ABILITIES = {
  normal: ab('push'), fire: ab('glow burn'), water: ab('swim'), grass: ab('climb grow'), electric: ab('glow zap'), ice: ab('freeze'),
  bug: ab('fly climb'), ghost: ab('fly pass'), mind: ab('fly lift sense'), metal: ab('zap push'), toxic: ab('burn'),
  pixie: ab('fly charm heal'), drake: ab('fly burn'), rainbow: ab('fly glow'), cosmic: ab('fly glow'), sound: ab('fly sense'),
  bone: ab('dig'), alien: ab('fly lift'), sky: ab('fly'), slime: ab('climb squeeze'), light: ab('glow'), paper: ab('fly squeeze'),
  time: ab('rewind'), camo: ab('sneak'), cyber: ab('zap'), cozy: ab('charm heal'), treasure: ab('dig'), food: ab('charm heal'),
  squad: ab('push'), dream: ab('pass'), parkour: ab('climb sprint'), ninja: ab('climb sneak'), tiny: ab('squeeze sneak'),
  pirate: ab('swim dig'), racer: ab('sprint'), ball: ab('push'), portal: ab('pass'), funfair: ab('charm'), surprise: ab('charm'),
  doodle: ab('squeeze'), atlantis: ab('swim glow'), knight: ab('push'), bubble: ab('swim fly'), gravity: ab('fly climb'),
  mirror: ab('pass'), rock: ab('dig push'),
  custom: [],
};

// The guardian (a `kit` species, the Wizard's part kit): Fly when its parts fly (wings or a cloud), plus the one ability chosen on the
// drawing board (`design.ab`). Fly is never chosen: it comes from the parts, so a guardian without wings never flies.
let kitFlies = () => false;
export const registerKitFlies = fn => { kitFlies = fn; }; // guardiankit.js hands its `flies(design)` over (it imports this file)
export const CHOOSABLE = ABILITY_IDS.filter(id => id !== 'fly');
export const cleanChoice = id => (typeof id === 'string' && CHOOSABLE.includes(id) ? id : null);

// sp = the SPECIES entry, c = the creature (optional; the guardian needs its design `c.paint`). -> ability ids in ABILITY_IDS order.
export function abilitiesOf(sp, c) {
  if (!sp) return [];
  const has = new Set(TYPE_ABILITIES[sp.type] || []);
  if (sp.kit) {
    const d = c?.paint;
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      if (kitFlies(d)) has.add('fly');
      const pick = cleanChoice(d.ab);
      if (pick) has.add(pick);
    }
  }
  return ABILITY_IDS.filter(id => has.has(id));
}
export const hasAbility = (sp, c, id) => abilitiesOf(sp, c).includes(id);
