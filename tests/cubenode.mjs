// Cube Planets in Node (no browser): the real Player, the real CubeLive and a stand-in world from cubeLand, with just enough of a game
// round them for the games' rules (beaten keys, a toast list, no scene). tests/cubebots.mjs plays on it; tests/specs/cube.mjs uses it for
// the bots at 60 and 20 frames a second (the page runs the same bots through the game's own loop in part `real`).
//   const env = await cubeEnv(seed)  ->  { game, world, player, live, step(dt), toasts }
if (typeof window === 'undefined') {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {} };
}
export async function cubeEnv(seed = 1, { stars = [] } = {}) {
  const { makeCubes } = await import('./cubecheck.mjs');
  const { Player } = await import('../src/player.js');
  const { CubeLive } = await import('../src/cubelive.js');
  const world = makeCubes(seed);
  const toasts = [];
  const game = { world, scene: null, beaten: [], stars: [...stars], ui: { toast: m => toasts.push(m), setScore() {} }, save() {}, playing: () => true };
  const player = new Player(world);
  game.player = player;
  const live = new CubeLive(game, world.parts[0]);
  live.manual = true;
  const step = dt => { player.update(dt); live.step(dt); };
  return { game, world, player, live, step, toasts };
}
