// Owner 2026-11-08: Easy / Normal / Hard, changeable any time in the pause screen ("object orientation pls"). One Difficulty object
// is the game's level; everything that gets easier or harder asks it, nothing else checks a level's id.
//   skill   the Picture World skill games: handed to kindhelp.js (`KIND.use`), so every game that maps kindHelp(misses) onto its
//           levers moves at once. base = ease from the first try, extra = how far past KIND_HELP.max the misses may take it.
//           Levers with a hard limit (a bubble never lifts 6, an Orbikit always outruns you, the pebbles' pull) cap themselves
//           (`capped` in kindhelp.js), so no level ever opens a shortcut. A rematch's `hard` (you hold the star) stacks on top.
//   react   (owner 2026-11-08: "genuinely difficult for my son on the tablet") how much more time the reaction games give: a jack stays
//           up, a throw's warning and flight, the rowboats' rowing, all x react (Easy 1.4; Normal and Hard 1). Only levers
//           that give a child time to see and tap: never the shield's width, the points needed or anything a masher or spinner gains from
//           (the bots check it over many seeds). Read with `reactNow()` by siege.js (every warning, flight and gap), popupwhack.js (how long
//           a jack stays up) and pirateland.js boatAt (the rowboats row slower). `rest`: Pop-Up Whack's stick rests x rest after a second
//           whiff soon after another (Easy 2), so the longer jacks do not help mashing. The Piñata Party is the same on every level: a slower
//           swing, a longer stick or more time all let mashing under it win (measured). Hard keeps react 1 (a quicker Shield Up! let a
//           spinning stick get lucky).
//   battle  battles against the game (wild, trainers, leaders, Bosses, the Tower, the Wizard): `smart` = how often the foe picks its
//           best move (Normal 0.5 = as before), `foeLevels` / `wildLevels` = levels added to trainer teams / new wild creatures,
//           `catch` = x the catch chance. Duels and co-op giants always play Normal (both browsers must agree: `battleLevel`).
//   scribble (owner 2026-11-12: "all scribble fights and bugs should work with easy / normal / hard too") chapter 3's scribble fights
//           (scribblefight.js, read when a fight starts): `levels` = added to the monsters' level (they match your strongest creature),
//           `tell` = x how long a monster's red warning shows (Easy = react: time to see and move). Easy's longer warning shows EARLIER:
//           the monster walks on under its early part as on Normal and strikes at Normal's moment (a longer stand-still, -2 levels or a
//           slower rhythm all let mashing win most meadow fights: measured); the timed rush's / blast's window stays the last 0.475 s;
//           in the dark the late warning is x tell too. `rhythm` = x the time between a monster's attacks. Hard: +2, x0.9, x0.9.
//           tests/wobblebots.mjs with PC_DIFFICULTY proves mashing still loses and skilled still wins on every patch.
//   bugs    the scribble bugs (scribblebugs.js): overrides of BUG: `catchR` how close pops one (Easy 1.0, Hard 0.75; Normal 0.85),
//           `faster` how much faster than you it runs (Hard 1.12). Never below Normal's 1.08: at 1.06 a kid sprinting straight at a bug
//           caught most of them (measured, tests/wobblebugbots.mjs; its `kid` bot, 0.25 s late, pops about 70 % / 35 % / 25 %).
// Stars, badges and keys won on any level count the same. Normal is bit for bit the game as it was. Pure, Node-runnable.
import { KIND } from './kindhelp.js';

export class Difficulty {
  constructor({ id, name, icon, line, skill, battle, react = 1, rest = 1, scribble, bugs }) {
    Object.assign(this, { id, name, icon, line, react, rest });
    this.scribble = Object.freeze({ levels: 0, tell: react, rhythm: 1, ...scribble });
    this.bugs = Object.freeze({ ...bugs });
    this.skill = Object.freeze({ base: 0, extra: 0, ...skill });
    this.battle = Object.freeze({ smart: 0.5, foeLevels: 0, wildLevels: 0, catch: 1, ...battle });
  }
  get label() { return `${this.icon} ${this.name}`; }
  // A creature level moved by this level's shift, kept within 1..cap.
  shiftLevel(level, by, cap = 100) { return by ? Math.max(1, Math.min(cap, (level | 0) + by)) : level; } // (Normal: untouched)
  foeLevel(level, cap) { return this.shiftLevel(level, this.battle.foeLevels, cap); }
  wildLevel(level, cap) { return this.shiftLevel(level, this.battle.wildLevels, cap); }
  catchChance(p) { return Math.max(0.05, Math.min(0.95, p * this.battle.catch)); }
}

export class Easy extends Difficulty {
  constructor() {
    super({ id: 'easy', name: 'Easy', icon: '🐣', line: 'Easy: slower games, gentler battles.',
      skill: { base: 0.06, extra: 0.06 }, react: 1.4, rest: 2, battle: { smart: 0.25, foeLevels: -3, wildLevels: -2, catch: 1.3 },
      scribble: {}, bugs: { catchR: 1.0 } });
  }
}
export class Normal extends Difficulty {
  constructor() { super({ id: 'normal', name: 'Normal', icon: '🙂', line: 'Normal: the game as it is.' }); }
}
export class Hard extends Difficulty {
  constructor() {
    super({ id: 'hard', name: 'Hard', icon: '🔥', line: 'Hard: faster games, tougher battles!',
      skill: { base: -0.05, extra: 0 }, battle: { smart: 0.8, foeLevels: 3, wildLevels: 2, catch: 0.85 },
      scribble: { levels: 2, tell: 0.9, rhythm: 0.9 }, bugs: { catchR: 0.75, faster: 1.12 } });
  }
}

export const DIFFICULTIES = [new Easy(), new Normal(), new Hard()]; // (the pause button's order)
export const NORMAL = DIFFICULTIES[1];
export const difficultyOf = id => DIFFICULTIES.find(d => d.id === id) ?? NORMAL; // junk / old saves -> Normal
export const nextDifficulty = d => DIFFICULTIES[(DIFFICULTIES.indexOf(d) + 1) % DIFFICULTIES.length];

// The one current level (module state, like kindhelp.js's KIND, so pure rule files need no game object).
export const DIFFICULTY = { current: NORMAL };
export function setDifficulty(d) {
  const lvl = d instanceof Difficulty ? d : difficultyOf(d);
  DIFFICULTY.current = lvl;
  KIND.use(lvl.skill);
  return lvl;
}
// How much more time the reaction games give right now (1 on Normal).
export const reactNow = () => DIFFICULTY.current.react;
// The level a battle plays at: duels and co-op giants are always Normal (both players work the turn out the same way).
export const battleLevel = opts => (opts?.duel ? NORMAL : DIFFICULTY.current);
