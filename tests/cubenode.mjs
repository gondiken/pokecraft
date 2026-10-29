// Cube Planets in Node (no browser): the real Player, the real CubeLive and a stand-in world from cubeLand, with just enough of a game
// round them for the games' rules (beaten keys, a toast list, no scene). tests/cubebots.mjs plays on it; tests/specs/cube.mjs uses it for
// the bots at 60 and 20 frames a second (the page runs the same bots through the game's own loop in part `real`).
//   const env = await cubeEnv(seed)  ->  { game, world, player, live, step(dt), toasts }
// The game's modules import 'three' by its bare name (the page's import map); in Node it lives in tests/node_modules, which src/ can't
// see, so send that one name there (works in any checkout, no node_modules link at the repo root needed).
import { register } from 'node:module';
const THREE_URL = import.meta.resolve('three');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { return next(s === 'three' ? ${JSON.stringify(THREE_URL)} : s, c); }`));
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
