// Chapter 3 step C (plans/chapter3-abilities-build.md, ?preview only): "the world says what it needs". Pure, no game imports
// (Node bots and the game share it).
//   A PLACE is data: { id, needs: '<ability id>', box: { x0, x1, y0, y1, z0, z1 } (where the hint shows), badge: [x, y, z] (where its
//   drawn badge floats) }. A world lists its places in `world.needPlaces` (wayland.js); nothing here knows any ability or place.
//   - the creature you are has it: the action button's word is the ability's verb ("Climb!"); `ACTS[ability]` (optional) says what the
//     button does (held while pressed, or a tap);
//   - it doesn't (or you are yourself, "Be me"): the place shows the ability's badge and which of your first three have it; Swap goes
//     straight to the next one that has it (one tap).
//   A new place = one data entry. A new ability with a button = one `ACTS` entry.
import { ABILITIES } from './abilities.js';

// the place the position is in (the first), or null. pos: { x, y, z } (world units, the feet)
export function placeAt(places, pos) {
  if (!places?.length || !pos) return null;
  for (const q of places) {
    const b = q.box;
    if (pos.x >= b.x0 && pos.x < b.x1 + 1 && pos.z >= b.z0 && pos.z < b.z1 + 1 && pos.y >= b.y0 && pos.y < b.y1 + 1) return q;
  }
  return null;
}

// What the place says to you. you = your abilities now (an array; [] when you are yourself), squad = each of your three's abilities.
// -> { place, needs, has, word, who: [squad indexes that have it], next(from) }
export function needOf(place, you, squad = []) {
  if (!place) return null;
  const id = place.needs, a = ABILITIES[id];
  const has = (you || []).includes(id), who = squad.map((ab, i) => ((ab || []).includes(id) ? i : -1)).filter(i => i >= 0);
  return { place, needs: id, name: a?.name ?? id, has, word: has ? (a?.verb ?? `${a?.name ?? id}!`) : null, who };
}

// Swap at a place: the next squad creature after `from` (null = yourself) that has what the place needs, or null when none does
// (then Swap goes round as always).
export function swapTo(need, from, n) {
  if (!need || need.has || !need.who.length) return null;
  const start = from == null ? -1 : from;
  for (let k = 1; k <= n; k++) { const i = (start + k) % n; if (need.who.includes(i)) return i; }
  return null;
}

// What an ability's button does at its place (p = the Player). hold: pressed = start, let go = stop. No entry = the word only.
// climb: holding Climb! is pushing toward the wall you face (player.js reads `be.grab`), so one finger climbs on a tablet.
export const ACTS = {
  climb: { hold: true, start(p) { if (p.be) p.be.grab = true; }, stop(p) { if (p.be) p.be.grab = false; } },
};
