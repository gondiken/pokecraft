// Chapter 3 (plans/chapter3-ways.md, ?preview only): BEING your creature outside a fight. Pure, no imports: Node bots and the
// game share it.
//
// Two things decide what a creature can do in the world, and they never mix:
//   its BODY = how it moves, the same for everyone with that body: legs walk and jump, wings fly (`flies` in species.js: any
//              creature with wings, Boomwing too), in calm air, with room to spread them, never higher than 6 over the floor;
//   its TYPE = one of the WAYS below: the hard version of a place that only that group masters (the Fly types ride the storm,
//              the Cling types climb a narrow shaft...). A way is never a key: it is a skill game (easy to understand, hard to
//              master), the main path is open to everyone, and a way's places are shaped so no other way (or mix of ways) helps.
//
// Owner 2026-11-12: "world movement or what happens with the creature in the world should reflect the type", grouped, at most 15.
// `built`: playable now (the test in Bumpy Hills, wayland.js). The rest are planned in plans/chapter3-ways.md. Ids are append-only.
export const WAYS = [
  { id: 'fly', icon: '🪽', name: 'Fly', types: ['sky', 'drake', 'alien', 'bubble'], beats: 'a stormy open gap', built: true },
  { id: 'cling', icon: '🧗', name: 'Cling', types: ['grass', 'bug', 'slime', 'parkour', 'gravity'], beats: 'a narrow shaft, walls and ceilings', built: true },
  { id: 'dive', icon: '🌊', name: 'Dive', types: ['water', 'pirate', 'atlantis'], beats: 'deep water and its currents' },
  { id: 'freeze', icon: '❄️', name: 'Freeze', types: ['ice'], beats: 'rushing water too wild to swim' },
  { id: 'dig', icon: '⛏️', name: 'Dig', types: ['rock', 'bone', 'treasure'], beats: 'soft earth and buried things' },
  { id: 'squeeze', icon: '📄', name: 'Squeeze', types: ['paper', 'tiny', 'doodle'], beats: 'cracks and gaps under doors' },
  { id: 'slip', icon: '👻', name: 'Slip through', types: ['ghost', 'dream', 'portal', 'mirror'], beats: 'bars, fences and glass' },
  { id: 'glow', icon: '💡', name: 'Glow', types: ['light', 'rainbow', 'cosmic'], beats: 'the dark' },
  { id: 'burn', icon: '🔥', name: 'Burn away', types: ['fire', 'toxic'], beats: 'thorns and tangles that grow back' },
  { id: 'power', icon: '⚡', name: 'Power', types: ['electric', 'cyber'], beats: 'machines: lifts, bridges, doors' },
  { id: 'dash', icon: '⏱️', name: 'Dash', types: ['racer', 'time', 'ball'], beats: 'crumbling floors and closing doors' },
  { id: 'push', icon: '💪', name: 'Push', types: ['normal', 'metal', 'knight', 'squad'], beats: 'heavy things' },
  { id: 'sneak', icon: '🥷', name: 'Sneak', types: ['camo', 'ninja'], beats: 'someone watching the way' },
  { id: 'sense', icon: '🔊', name: 'Sense', types: ['mind', 'sound'], beats: 'hidden paths' },
  { id: 'charm', icon: '💖', name: 'Charm', types: ['pixie', 'cozy', 'food', 'funfair', 'surprise'], beats: 'someone grumpy in the way' },
];
export const WAY = Object.fromEntries(WAYS.map(w => [w.id, w]));
export const WAY_OF = Object.fromEntries(WAYS.flatMap(w => w.types.map(t => [t, w.id])));
// The Wizard's guardian (Custom) has no way of its own yet: plans/chapter3-ways.md (chosen on the drawing board, later).
export const wayOf = type => WAY_OF[type] ?? null;

// The body's numbers (the flying ones are riding.js RIDE.sky, handed in by the caller so this file imports nothing).
export const BODY = {
  squad: 3,     // the three you can be: your first three creatures (the scribble fight's squad, scribblefight.js squadOf)
  climb: 3,     // Cling: blocks a second up a wall while you push into it
  side: 0.7,    // Cling: sideways along a wall, x your walking speed
  probe: 0.06,  // a wall closer than this to your box is "beside you"
};
// (Walls nobody can grip: ice is too slippery. player.js clingStep.)

// A creature's body: { species, type, way, wings, cling, storm }. `sp` = SPECIES[id] (or a stand-in { type, flies }); `skyRide`: it is
// ridden through the sky (traits.js), so it flies when you are it too. Every Fly-type creature flies (a kite, a saucer, a bubble).
export function bodyOf(species, sp, skyRide = false) {
  const way = wayOf(sp?.type);
  return { species, type: sp?.type ?? null, way, wings: !!sp?.flies || skyRide || way === 'fly', cling: way === 'cling', storm: way === 'fly' };
}

// Room to spread wings round the body's middle: no wings open with a wall on both sides of you (a shaft, a doorway, a tunnel).
// Every winged creature folds them there, a Drake as much as Boomwing.
export function wingRoom(world, pos) {
  const x = Math.floor(pos.x), y = Math.floor(pos.y + 0.9), z = Math.floor(pos.z), s = (a, b, c) => world.isSolid(a, b, c);
  return !((s(x - 1, y, z) && s(x + 1, y, z)) || (s(x, y, z - 1) && s(x, y, z + 1)));
}

// Before each Player.update: a winged body flies (the sky riding physics, p.ride with `be: true`) wherever it has room, and walks with
// folded wings where it has none. -> 'folded' the moment it had to fold them (the toast), else null.
export function bodyStep(p, world, body, sky) {
  if (!body?.wings) { if (p.ride?.be) p.ride = null; return null; }
  const room = wingRoom(world, p.pos);
  if (room && !p.ride) { p.ride = { ...sky, type: body.type, be: true }; return null; }
  if (!room && p.ride?.be) { p.ride = null; return 'folded'; }
  return null;
}
