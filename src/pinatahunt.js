// Owner 2026-10-28 ("is that supposed to be a slide? what's the purpose of it? ... the ball pit? just a treasure chest?"): the
// Piñata Hunt. Before a piñata can swing on the party rug you have to find it: the three piñatas of the Piñata Party hide in the slide
// room, the springs room and the ball pit (which piñata where is shuffled from the player's seed), and each room asks its own skill:
//   slide    the piñata swings in and out over the slide: start sliding at the right moment and you grab it on the way down (timing);
//   springs  it floats high over the springs, drifting: jump on the spring right under it (aim and timing);
//   ballpit  it pops up out of the balls somewhere away from you and dives again a moment later: get to it in time (quick feet).
// Pure (no imports): closed forms of the room clock, the same at 60 and 20 frames a second. doorslive.js draws and wires them.
export const HUNT = {
  rooms: ['slide', 'springs', 'ballpit'],
  touch: 1.0,                                     // you take it when it is this close to the middle of your body
  slide: { at: 0.55, up: 1.25, swing: 1.6, period: 2.6 },   // at = how far down the slide (0..1), swing = how far out it swings
  springs: { u: 3.2, uT: 9, v: [5, 1.8], vT: 5.5, y: 15.6, bob: 0.3 },
  pit: { slot: 2.0, jiggle: 0.55, up: 0.85, away: 2.5, low: 0.6 },  // a slot: jiggle (the balls shake where it comes up), up, then down
  hard: { period: 0.8, uT: 0.75, slot: 0.85 },    // a rematch (you hold the star): quicker
};

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Which room hides the piñata of each round (1..3): a shuffle of HUNT.rooms from the seed. -> { 1: 'springs', 2: 'slide', 3: 'ballpit' }
export function huntRooms(seed) {
  const r = [...HUNT.rooms];
  for (let i = r.length - 1; i > 0; i--) { const j = hashStr(`${seed}|hunt|${i}`) % (i + 1); [r[i], r[j]] = [r[j], r[i]]; }
  return { 1: r[0], 2: r[1], 3: r[2] };
}

// The slide: how far out of the slide's path the piñata swings at time t (blocks; 0 = right over the path).
export const slideSwing = (t, hard = false) => HUNT.slide.swing * Math.abs(Math.sin((Math.PI * t) / (HUNT.slide.period * (hard ? HUNT.hard.period : 1))));

// The springs: where the piñata floats at time t, as room offsets { u, v } (across the room / into it) and y.
export function springsAt(t, hard = false) {
  const S = HUNT.springs, k = hard ? HUNT.hard.uT : 1;
  return { u: S.u * Math.sin((2 * Math.PI * t) / (S.uT * k)), v: S.v[0] + S.v[1] * Math.sin((2 * Math.PI * t) / (S.vT * k) + 1), y: S.y + S.bob * Math.sin(t * 2) };
}

// The ball pit: slot n starts at n * slot. pitPick chooses its cell (index into `cells`, [x, z] centres) away from where you stand
// when the slot starts; pitPhase says what the piñata does at time u into the slot: 'jiggle' | 'up' (it can be taken) | 'down'.
export const pitSlot = (hard = false) => HUNT.pit.slot * (hard ? HUNT.hard.slot : 1);
export function pitPick(seed, n, cells, at) {
  const far = cells.map((c, i) => [c, i]).filter(([c]) => !at || Math.hypot(c[0] - at[0], c[1] - at[1]) >= HUNT.pit.away);
  const list = far.length ? far : cells.map((c, i) => [c, i]);
  return list[hashStr(`${seed}|pit|${n}`) % list.length][1];
}
export function pitPhase(u, hard = false) {
  const s = hard ? HUNT.hard.slot : 1, P = HUNT.pit;
  if (u < P.jiggle * s) return { phase: 'jiggle', rise: 0 };
  if (u < (P.jiggle + P.up) * s) return { phase: 'up', rise: Math.min(1, (u - P.jiggle * s) / (0.15 * s)) };
  return { phase: 'down', rise: Math.max(0, 1 - (u - (P.jiggle + P.up) * s) / (0.2 * s)) };
}

// Does the player (feet at p, a 1.8 tall box) touch a piñata at q?
export const touches = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) < HUNT.touch && q.y > p.y - 0.45 && q.y < p.y + 2.25;
