// Owner 2026-10-27: "creatures in the Picture Worlds shouldn't be that richly available". The rare ones of each world (the big
// evolved forms and the odd ones) only come out once you got a bit further in that world, like Pipsqueak and the 12 crumbs.
// A spawn table entry may have a 4th element, a Picture World id: [species, weight, condition?, 'race']. The Book words it with
// spawnrules.js AFTER_TEXT. These checks read only saved keys and stars (and, for the race, the won race of this visit).
import { crumbKey } from './houselive.js';
import { goalState } from './stadium.js';
import { boatState } from './pirateland.js';
import { ticketState } from './funfair.js';
import { bowState } from './doorsland.js';
import { lightState } from './glowfish.js';
import { lineState } from './doodleland.js';
import { roomState } from './portalplay.js';
import { castleState } from './castleland.js'; // T49

const star = (g, id) => !!g.stars?.includes(id);
export const AFTER_CHECKS = {
  house: g => star(g, 'house') || Array.from({ length: 12 }, (_, i) => crumbKey(i)).filter(k => g.beaten?.includes(k)).length >= 6,
  race: g => star(g, 'race') || !!g.gymLive?.of?.('part:race')?.won,
  stadium: g => star(g, 'stadium') || goalState(g).n >= 2,
  pirate: g => star(g, 'pirate') || boatState(g).sunk >= 6,
  atlantis: g => star(g, 'atlantis') || lightState(g).total >= 6,
  fair: g => star(g, 'fair') || ticketState(g).n >= 1,
  doors: g => star(g, 'doors') || bowState(g).n >= 2,
  doodle: g => star(g, 'doodle') || lineState(g).count >= 4,
  portal: g => star(g, 'portal') || roomState(g).n >= 4,
  castle: g => star(g, 'castle') || castleState(g).n >= 3, // T49: three of the six rounds
};
export const wildAfter = (game, id) => { try { return !!AFTER_CHECKS[id]?.(game); } catch { return false; } };
