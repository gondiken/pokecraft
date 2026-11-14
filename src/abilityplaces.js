// Chapter 3 step C (plans/chapter3-abilities-build.md, ?preview only): "the world says what it needs". Pure, no game imports
// (Node bots and the game share it).
//   A PLACE is data: { id, needs: '<ability id>', box: { x0, x1, y0, y1, z0, z1 } (where trying counts and the hint shows) }. A world lists its places in `world.needPlaces` (wayland.js); nothing here knows any ability or place.
//   - it doesn't (or you are yourself, "Be me") and you tried a few times (`NeedHints`): a small card shows the ability's badge and which
//     of your first three have it; Swap goes straight to the next one that has it (one tap).
//   A new place = one data entry.
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
// -> { place, needs, name, has, who: [squad indexes that have it] }
export function needOf(place, you, squad = []) {
  if (!place) return null;
  const id = place.needs, a = ABILITIES[id];
  const has = (you || []).includes(id), who = squad.map((ab, i) => ((ab || []).includes(id) ? i : -1)).filter(i => i >= 0);
  return { place, needs: id, name: a?.name ?? id, has, who };
}

// Swap at a place: the next squad creature after `from` (null = yourself) that has what the place needs, or null when none does
// (then Swap goes round as always).
export function swapTo(need, from, n) {
  if (!need || need.has || !need.who.length) return null;
  const start = from == null ? -1 : from;
  for (let k = 1; k <= n; k++) { const i = (start + k) % n; if (need.who.includes(i)) return i; }
  return null;
}

// The hint comes only after trying (owner 2026-11-14: "doesn't give any chance to the player to think 'oh wait I have a climber'"):
// no badge and no card at first. A try = walking into the place's box without what it needs, or every `every` s spent in it; after
// `tries` tries its card shows (the badge, who has it) and Swap goes straight to one that can. Abilities need no button: you fly with
// Jump (like riding), climb by walking into a wall, dive by looking down.
export const HINT = { tries: 3, every: 8 };
export class NeedHints {
  constructor() { this.n = new Map(); this.in = null; this.t = 0; }
  // place = where you are now (or null), has = you can do what it needs. -> how many tries at it so far
  step(place, has, dt) {
    if (!place) { this.in = null; return 0; }
    if (this.in !== place.id) { this.in = place.id; this.t = 0; if (!has) this.n.set(place.id, (this.n.get(place.id) ?? 0) + 1); }
    else if (!has && (this.t += dt) >= HINT.every) { this.t = 0; this.n.set(place.id, (this.n.get(place.id) ?? 0) + 1); }
    return this.n.get(place.id) ?? 0;
  }
  tries(id) { return this.n.get(id) ?? 0; }
  shown(id) { return this.tries(id) >= HINT.tries; }
}
