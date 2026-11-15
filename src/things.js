// Chapter 3 step D (plans/chapter3-abilities-build.md, "Overnight 2026-11-15/16"; ?preview only, Wobbleland): THINGS an ability acts on.
// Pure, Node-runnable (the bots and the game share it). Owner 2026-11-15: "an ability that acts on something should feel natural:
// walking into it, or the big action button aimed at the thing, as when breaking a block. Never a hold-E."
//   A thing kind says which ability moves it, HOW you act on it and the one line a creature without it is told (like a block's noGrip):
//     aim:  look at it and press the big button (E, a click, a tap on the action button): Dig soft earth, Burn thorns, Freeze running
//           water. The button says the word ("Dig!") only when the creature you are can do it (otherwise it says nothing, as everywhere
//           in Wobbleland: nothing breaks there).
//     walk: walk into it: Push a boulder or a stone ball, Squeeze into a crack, Pass through a faded pencil wall.
//   A world lists its things in `world.things` (a Map: cell index -> { kind, ... }); the place rules (earthworks.js ...) keep it up to date.
// A new kind = one entry here + its rules in its place's file.
import { B } from './blocks.js';
export const THINGS = {
  soft: { needs: 'dig', how: 'aim', word: 'Dig!', why: 'Soft earth! Only a digger can dig it.' },
  boulder: { needs: 'push', how: 'walk', why: 'Too heavy! Only a strong creature can push it.' },
  ball: { needs: 'push', how: 'walk', why: 'A stone ball! Too heavy to push.' },
  thorns: { needs: 'burn', how: 'aim', word: 'Burn!', why: 'Thorns! Only fire can burn them away.' },          // fireice.js
  icewall: { needs: 'burn', how: 'aim', word: 'Burn!', why: 'Thick ice! Only fire can melt it.' },
  water: { needs: 'freeze', how: 'aim', word: 'Freeze!', why: '' },                                        // (any water: no line, it is just water)
  falls: { needs: 'freeze', how: 'aim', word: 'Freeze!', why: 'A waterfall! Only ice could stop it.' },
  crack: { needs: 'squeeze', how: 'walk', why: 'Too narrow! Only a squishy creature fits in a crack.' },                  // slipthrough.js
  faded: { needs: 'pass', how: 'walk', why: 'A faded pencil wall! Only a ghostly creature can pass through it.' },
};
// things a block is by itself (no entry in world.things): any water can be frozen
const BLOCK_THINGS = { [B.WATER]: { kind: 'water' } };

// The first cell the eye's ray meets that is not air (water counts: Freeze aims at it), within `reach`. Pure DDA (world.js raycastVoxel
// skips water). -> { x, y, z, id, t } or null
export function aimAt(world, eye, dir, reach = 6) {
  let x = Math.floor(eye.x), y = Math.floor(eye.y), z = Math.floor(eye.z);
  const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
  const dx = sx ? Math.abs(1 / dir.x) : Infinity, dy = sy ? Math.abs(1 / dir.y) : Infinity, dz = sz ? Math.abs(1 / dir.z) : Infinity;
  let mx = sx > 0 ? (x + 1 - eye.x) * dx : sx < 0 ? (eye.x - x) * dx : Infinity;
  let my = sy > 0 ? (y + 1 - eye.y) * dy : sy < 0 ? (eye.y - y) * dy : Infinity;
  let mz = sz > 0 ? (z + 1 - eye.z) * dz : sz < 0 ? (eye.z - z) * dz : Infinity;
  let t = 0;
  while (t <= reach) {
    const id = world.get(x, y, z);
    if (id) return { x, y, z, id, t };
    if (mx < my && mx < mz) { x += sx; t = mx; mx += dx; } else if (my < mz) { y += sy; t = my; my += dy; } else { z += sz; t = mz; mz += dz; }
  }
  return null;
}
export const thingAt = (world, x, y, z) => (world.inBounds(x, y, z) ? world.things?.get(world.index(x, y, z)) ?? BLOCK_THINGS[world.get(x, y, z)] ?? null : null);

// What the big button would do now: the aimed thing an `aim` kind of the creature you are can act on. abilities = yours ([] as yourself).
// -> { cell, thing, kind, word } or null
export function aimedThing(world, p, abilities, reach = 6) {
  const hit = aimAt(world, p.eyePos, p.forward, reach);
  const th = hit && thingAt(world, hit.x, hit.y, hit.z), k = th && THINGS[th.kind];
  if (!k || k.how !== 'aim' || !(abilities || []).includes(k.needs)) return null;
  return { cell: hit, thing: th, kind: th.kind, word: k.word };
}

// Walking into a thing: the cell in front of your feet the way you walk (p.wish, player.js), if it is a thing. -> { cell, thing, dir } or null
export function walkedInto(world, p) {
  const w = p.wish;
  if (!w || !p.hitWall) return null;
  const ax = Math.abs(w[0]) >= Math.abs(w[1]), dir = ax ? [Math.sign(w[0]), 0] : [0, Math.sign(w[1])];
  const x = Math.floor(p.pos.x + dir[0] * (p.halfW + 0.12)), z = Math.floor(p.pos.z + dir[1] * (p.halfW + 0.12));
  for (const dy of [0.1, 1.1]) { // (feet, then knees: a ball is one block, a boulder two)
    const y = Math.floor(p.pos.y + dy), th = thingAt(world, x, y, z);
    if (th) return { cell: { x, y, z }, thing: th, dir };
  }
  return null;
}
