// Owner 2026-11-08: Easy / Normal / Hard, changeable any time in the pause screen ("object orientation pls"). One Difficulty object
// is the game's level; everything that gets easier or harder asks it, nothing else checks a level's id.
//   skill   the Picture World skill games: handed to kindhelp.js (`KIND.use`), so every game that maps kindHelp(misses) onto its
//           levers moves at once. base = ease from the first try, extra = how far past KIND_HELP.max the misses may take it.
//           Levers with a hard limit (a bubble never lifts 6, an Orbikit always outruns you, the pebbles' pull) cap themselves
//           (`capped` in kindhelp.js), so no level ever opens a shortcut. A rematch's `hard` (you hold the star) stacks on top.
//   battle  battles against the game (wild, trainers, leaders, Bosses, the Tower, the Wizard): `smart` = how often the foe picks its
//           best move (Normal 0.5 = as before), `foeLevels` / `wildLevels` = levels added to trainer teams / new wild creatures,
//           `catch` = x the catch chance. Duels and co-op giants always play Normal (both browsers must agree: `battleLevel`).
// Stars, badges and keys won on any level count the same. Normal is bit for bit the game as it was. Pure, Node-runnable.
import { KIND } from './kindhelp.js';

export class Difficulty {
  constructor({ id, name, icon, line, skill, battle }) {
    Object.assign(this, { id, name, icon, line });
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
      skill: { base: 0.06, extra: 0.06 }, battle: { smart: 0.25, foeLevels: -3, wildLevels: -2, catch: 1.3 } });
  }
}
export class Normal extends Difficulty {
  constructor() { super({ id: 'normal', name: 'Normal', icon: '🙂', line: 'Normal: the game as it is.' }); }
}
export class Hard extends Difficulty {
  constructor() {
    super({ id: 'hard', name: 'Hard', icon: '🔥', line: 'Hard: faster games, tougher battles!',
      skill: { base: -0.05, extra: 0 }, battle: { smart: 0.8, foeLevels: 3, wildLevels: 2, catch: 0.85 } });
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
// The level a battle plays at: duels and co-op giants are always Normal (both players work the turn out the same way).
export const battleLevel = opts => (opts?.duel ? NORMAL : DIFFICULTY.current);
