// Chapter 3 (plans/chapter3-ways.md, plans/chapter3-abilities-build.md step C; ?preview only): BEING your creature outside a fight.
// Pure, no game imports: Node bots and the game share it.
//
// Step C (owner 2026-11-14): a creature moves by its ABILITIES (abilities.js abilitiesOf, from its type; the guardian from its design).
// Every creature walks and jumps like riding it on land (riding.js RIDE.land). On top:
//   Fly   = it flies like the sky ride (hold Jump to rise, at most RIDE.sky.cap 6 over the floor right below you);
//   Swim  = in water it swims fast like the water ride; looking down it dives and swims fast under water (step D, player.js dive with
//           BE_SWIM); anyone else still swims, slowly, and can go under;
//   Climb = push into a wall (or hold Climb!) and it climbs (player.js clingStep; ice is too slippery). A creature that flies AND climbs
//           (Bug, Gravity) grips a wall it flies into and climbs it.
// Removed in step C: the 15 WAYS (one per type group) and the wing rules (`flies` / a sky ride / the Fly way = wings, wings fold where
// there is no room for them: the owner never liked folding). A body is no longer read from the model; the type's abilities decide.
// `tightAt` stays, only for the camera (in a shaft or a doorway it goes into the creature's eyes).
import { abilitiesOf } from './abilities.js';

export const BODY = {
  squad: 3,     // the three you can be: your first three creatures (the scribble fight's squad, scribblefight.js squadOf); Swap goes round them
  climb: 3,     // Climb: blocks a second up a wall while you push into it
  side: 0.7,    // Climb: sideways along a wall, x your walking speed
};

// A creature's body: { species, type, abilities, fly, swim, climb }. `sp` = SPECIES[id], `c` = the creature (the guardian needs its design).
export function bodyOf(species, sp, c = null) {
  const abilities = abilitiesOf(sp, c);
  return { species, type: sp?.type ?? null, abilities, fly: abilities.includes('fly'), swim: abilities.includes('swim'), climb: abilities.includes('climb') };
}

// A wall on both sides of the body's middle (a shaft, a doorway, a tunnel): the camera goes into the creature's eyes there.
export function tightAt(world, pos) {
  const x = Math.floor(pos.x), y = Math.floor(pos.y + 0.9), z = Math.floor(pos.z), s = (a, b, c) => world.isSolid(a, b, c);
  return (s(x - 1, y, z) && s(x + 1, y, z)) || (s(x, y, z - 1) && s(x, y, z + 1));
}

// Which ride the body uses this moment: a climber on (or reaching for) a wall clings like a land body, a flier flies, a swimmer in
// water swims, everything else walks.
export function kindOf(p, body) {
  if (body.climb && !p.keys?.Space) {
    const w = p.wallsBeside?.();
    const wall = !!w && (w.px || w.nx || w.pz || w.nz);
    if (p.climbing || (wall && (p.be?.grab || (p.ride?.kind === 'sky' && p.hitWall)))) return 'land';
  }
  if (body.swim && (p.inWater || ((p.ride?.kind === 'water' || !p.keys?.Space) && onWater(p)))) return 'water'; // (a creature that swims and flies, Bubble, settles onto water and dives; Jump takes it up again)
  if (body.fly) return 'sky';
  return 'land';
}

// flying right on the water (not rising): a swimmer lands on it
const onWater = p => { const f = p.floorBelow?.(); return !!f?.water && p.pos.y <= f.y + 0.1; };

// After each Player.update: the body's riding physics (p.ride with `be: true`; `RIDE` = riding.js's numbers, handed in).
export function bodyStep(p, world, body, RIDE) {
  if (!body) { if (p.ride?.be) p.ride = null; return null; }
  const kind = kindOf(p, body);
  if (p.ride?.be && p.ride.kind === kind) return null;
  p.ride = { ...RIDE[kind], type: body.type, be: true };
  return kind;
}
