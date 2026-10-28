// T48 (owner 2026-10-28, plans/T48-surprise-party.md): the Party Spinner and the party surprises (twists) of Jolly Jax's Surprise Party.
// Pure, no imports, Node-runnable.
//
// The Spinner is a big round party plate on the wall with four slices, one per party game (a piñata, a jack-in-the-box, a stack of
// presents, a pop-up box) and an arrow at the top. Spin! sets it turning at a steady speed; Stop! makes it slow down to a stop over
// SPIN.slow seconds. The slow-down always turns it exactly one more round plus a small wobble from the seed, so the slice that is under
// the arrow when you press Stop! is (nearly always) the one it stops on: good timing picks your game. Everything is a closed form of
// the press times, so 60 and 20 frames a second give the same slice.
//
// A party surprise (a twist) is drawn from the seed before round 2 and round 3 of a game (round 1 never has one) and changes the game in a
// way you can see at once.

export const SPIN = {
  turn: 2 * Math.PI * 1.25,  // radians a second while it spins (1.25 rounds: a slice is under the arrow for 0.2 s)
  slow: 1.6,                 // seconds from Stop! to standing still (it turns exactly one more round: turn x slow / 2 = 2 pi)
  wobble: 0.12,              // radians (at most) the stop lands off that, from the seed (a slice is pi / 2 = 1.57 wide)
  auto: 6,                   // nobody pressed Stop!: it stops by itself after this many seconds
  slices: 4,
};
export const GAMES = ['pinata', 'catch', 'stack', 'whack'];   // slice i = game i = golden bow i + 1
export const GAME_NAMES = { pinata: 'Piñata Party', catch: 'Jack Catch', stack: 'Gift Stack', whack: 'Pop-Up Whack' };

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
const unit = key => hashStr(key) / 4294967296;
const TAU = Math.PI * 2;
const mod = (a, m) => ((a % m) + m) % m;

// A spin: { a0 (the wheel's angle before it), press (time of Spin!), stop (time of Stop!, null = still spinning), wob (radians) }.
// wob comes from the seed and the spin number, so every spin of a player is its own and the same on a replay.
export function newSpin(a0, press, seed, n) { return { a0, press, stop: null, wob: (unit(`spin|${seed}|${n}`) * 2 - 1) * SPIN.wobble }; }
// The wheel's angle at time t (radians; it turns the slices past the fixed arrow).
export function spinAngle(s, t) {
  if (t <= s.press) return s.a0;
  const stop = s.stop ?? Infinity;
  if (t <= stop) return s.a0 + SPIN.turn * (t - s.press);
  const at = s.a0 + SPIN.turn * (stop - s.press), D = (SPIN.turn * SPIN.slow) / 2 + s.wob, u = Math.min(1, (t - stop) / SPIN.slow);
  return at + D * (1 - (1 - u) * (1 - u));
}
export const spinDone = (s, t) => s.stop != null && t >= s.stop + SPIN.slow;
export const restAngle = s => spinAngle(s, (s.stop ?? s.press) + SPIN.slow + 1);
// The slice under the arrow for a wheel angle: the arrow is at the wheel's own angle -a; slice k covers [k, k + 1) x pi / 2.
export const sliceAt = a => Math.floor(mod(-a, TAU) / (TAU / SPIN.slices)) % SPIN.slices;
// The plan's spinStop: Spin! at pressT, Stop! at stopT -> { slice, angle } where it comes to rest.
export function spinStop(pressT, stopT, seed, { a0 = 0, n = 0 } = {}) {
  const s = newSpin(a0, pressT, seed, n);
  s.stop = stopT;
  const angle = restAngle(s);
  return { slice: sliceAt(angle), angle };
}

/* ---------------------------------------- the party surprises ---------------------------------------- */

// Each game's list; `rounds` = the rounds a twist may come in (the first round never has one).
export const TWISTS = {
  pinata: [{ id: 'two', say: 'Surprise! Two piñatas!', rounds: [3] }, { id: 'wobbly', say: 'Surprise! Wobbly rope!', rounds: [2, 3] }, { id: 'dark', say: 'Surprise! Lights out!', rounds: [2, 3] }],
  catch: [{ id: 'gold', say: 'Surprise! Double gold!', rounds: [2, 3] }, { id: 'pies', say: 'Surprise! Pie party!', rounds: [2, 3] }, { id: 'sticky', say: 'Surprise! Sticky floor!', rounds: [2, 3] }],
  stack: [{ id: 'wobbly', say: 'Surprise! Wobbly crane!', rounds: [2, 3] }, { id: 'tiny', say: 'Surprise! Tiny presents!', rounds: [2, 3] }, { id: 'windy', say: 'Surprise! Windy!', rounds: [2, 3] }],
  whack: [{ id: 'dark', say: 'Surprise! Lights out!', rounds: [2, 3] }, { id: 'mirror', say: 'Surprise! Mirror!', rounds: [2, 3] }, { id: 'speedy', say: 'Surprise! Speedy!', rounds: [2, 3] }],
};
// The twist of round `round` of `game` (null in round 1). `n` = how many times this game was played this trip (another party, another surprise).
export function twistOf(game, round, seed, n = 0) {
  if (round <= 1) return null;
  const list = (TWISTS[game] || []).filter(x => x.rounds.includes(round));
  if (!list.length) return null;
  return list[hashStr(`twist|${seed}|${game}|${round}|${n}`) % list.length];
}
