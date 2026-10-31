// The Mirror Palace in Node (no browser): the real Player, the real MirrorLive and a stand-in world from mirrorLand, with just enough of a game round them (beaten keys,
// stars, a toast list, no scene), like tests/cubenode.mjs. tests/specs/mirror.mjs runs the kids of mirrorbots.mjs on it at 60 and 20 frames a second (the page runs them
// through the game's own loop in parts `play` and `real`).
//   const env = await mirrorEnv(seed)  ->  { game, world, player, live, step(dt), toasts, put, key, walkTo, ... }
import { register } from 'node:module';
const THREE_URL = import.meta.resolve('three');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { return next(s === 'three' ? ${JSON.stringify(THREE_URL)} : s, c); }`));
if (typeof window === 'undefined') {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {} };
}
export async function mirrorEnv(seed = 1, { stars = [], beaten = [] } = {}) {
  const { makeMirror } = await import('./mirrorcheck.mjs');
  const { Player } = await import('../src/player.js');
  const { MirrorLive } = await import('../src/mirrorlive.js');
  const ML = await import('../src/mirrorland.js');
  const world = makeMirror(seed);
  world.setLive = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  world.gravity = 1;
  const toasts = [];
  const game = { world, scene: null, beaten: [...beaten], stars: [...stars], cubes: 0, ui: { toast: m => toasts.push(m), setScore() {} }, save() {}, playing: () => true };
  const player = new Player(world);
  game.player = player;
  const live = new MirrorLive(game, world.parts[0]);
  live.manual = true;
  const step = dt => { player.update(dt); live.step(dt); };
  // puts the player at (x, y, z) facing yaw, with nothing else going on
  const put = (x, y, z, yaw = 0, pitch = 0) => { live.giveBack(); player.carry = null; player.stepHook = null; player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.keys = {}; player.joy = null; player.yaw = yaw; player.pitch = pitch; player.update(0.02); };
  // walks the real Player (real keys: the stick) toward (x, z) for up to `max` s; -> true when there
  const walkTo = (x, z, { dt = 1 / 60, max = 30, sprint = false, eps = 0.15 } = {}) => {
    let t = 0;
    while (t < max) {
      const dx = x - player.pos.x, dz = z - player.pos.z, d = Math.hypot(dx, dz);
      if (d < eps) { player.joy = null; player.keys = {}; return true; }
      // the stick in the player's own frame: yaw is set so that "forward" points at the target, so the Player's own maths walks there
      player.yaw = Math.atan2(-dx, -dz); player.joy = { x: 0, y: -(sprint ? 1 : 0.94) };
      step(dt); t += dt;
    }
    player.joy = null; return false;
  };
  return { game, world, player, live, step, toasts, put, walkTo, ML };
}
