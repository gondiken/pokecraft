// The Cozy Gym (T23): a gym with no building. Its people move into the world owner's cozy home (see plans/T23.md section 3).
// Step 0 wrote the pure state (`homeGymState`, used by access.js) and an empty HomeLive; builder B fills HomeLive in.
import { HOME_TYPES } from './hometypes.js';
import { SPECIES } from './species.js';

// The home type a gym moves into: the HomeType whose gymMovesIn names it (Cozy: 'cozy'). No gym ids in code.
export const homeTypeFor = gymId => Object.values(HOME_TYPES).find(t => t.gymMovesIn === gymId) || null;
// How many different creatures of a type are in the Creature Book (letting one go does not undo it).
export const caughtOfType = (game, type) => [...game.book.caught].filter(id => SPECIES[id]?.type === type && !SPECIES[id].legendary).length;

// Where the gym stands right now: your home, its type and whether the gym has moved in. Pure: reads the game only.
export function homeGymState(game, g) {
  const type = homeTypeFor(g.def.id), home = game.homes?.worldOwnerHome?.() || null;
  const owner = game.homes?.worldOwner == null || game.homes.worldOwner === game.playerId; // visiting a friend's world = not the owner
  const ofType = !!home && home.type === type?.id;
  return {
    type, home, owner, ofType,
    ready: ofType && home.finished,                 // cozy right now
    movedIn: !!home?.gyms?.includes(g.def.id),      // sticky on the record until the Doormat is gone
    caught: owner ? caughtOfType(game, type?.creature) : 0, need: g.def.moveIn?.caught ?? 3,
  };
}

// The live part of the Cozy Gym (LIVE.home): builder B. Interface: constructor(game, gym), update(dt), dispose().
export class HomeLive {
  constructor(game, gym) { this.game = game; this.gym = gym; }
}
