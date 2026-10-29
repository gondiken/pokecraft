// The Bubble Well in Node (no browser): the real Player, the real BubbleLive and a stand-in world from bubbleLand, with just enough of a
// game round them (beaten keys, stars, a toast list, no scene), like tests/cubenode.mjs. tests/specs/bubble.mjs runs the kids of
// bubblebots.mjs on it at 60 and 20 frames a second (the page runs kids through the game's own loop in parts `stairs` and `real`).
//   const env = await bubbleEnv(seed)  ->  { game, world, player, live, step(dt), toasts }
import { register } from 'node:module';
const THREE_URL = import.meta.resolve('three');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { return next(s === 'three' ? ${JSON.stringify(THREE_URL)} : s, c); }`));
if (typeof window === 'undefined') {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {} };
}
export async function bubbleEnv(seed = 1, { stars = [], beaten = [] } = {}) {
  const { makeWell } = await import('./bubblecheck.mjs');
  const { Player } = await import('../src/player.js');
  const { BubbleLive } = await import('../src/bubblelive.js');
  const world = makeWell(seed);
  const toasts = [];
  const game = { world, scene: null, beaten: [...beaten], stars: [...stars], cubes: 0, ui: { toast: m => toasts.push(m), setScore() {} }, save() {}, playing: () => true };
  const player = new Player(world);
  game.player = player;
  const live = new BubbleLive(game, world.parts[0]);
  live.manual = true;
  const step = dt => { player.update(dt); live.step(dt); };
  // puts the player at (x, y, z) facing yaw, with nothing else going on (no bubbles, a dry wand)
  const put = (x, y, z, yaw = 0) => { live.giveBack(); for (const b of [...live.field.list]) live.field.pop(b); player.carry = null; player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.keys = {}; player.joy = null; player.yaw = yaw; player.pitch = 0; player.update(0.02); live.ledge = null; live.fromBubble = false; live.prevFeet = player.pos.y; live.wet = false; };
  // a whole run of a kid (tick from bubblebots.mjs): -> { done, t, top, trace }
  const run = (tick, { budget = 60, dt = 1 / 60 } = {}) => {
    let t = 0, done = false, top = player.pos.y, was = null; const trace = [];
    while (t < budget) {
      const r = tick({ p: player, live, dt });
      if (r) { done = r; break; }
      step(dt); t += dt;
      if (player.onGround && !player.carry) top = Math.max(top, player.pos.y);
      const now = player.carry ? 'b' : player.onGround ? 'g' : 'a';
      if (now !== was && now !== 'a' && trace.length < 60) trace.push(now + player.pos.y.toFixed(1) + '@' + t.toFixed(1));
      was = now;
    }
    player.keys = {};
    return { done, t: +t.toFixed(1), top: +top.toFixed(1), trace: trace.join(' ') };
  };
  return { game, world, player, live, step, toasts, put, run };
}
