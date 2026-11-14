// Chapter 3 (plans/chapter3-ways.md, plans/chapter3-abilities-build.md step C; ?preview only): the first ABILITY place, in Bumpy Hills
// north of Puddle Meadow. Node-runnable (wobbleland.js calls `waysLand`; tests/waysbots.mjs plays it with the real Player). Nothing here is
// saved or sent; opening the chest is the game's own chest (+3 Capture Cubes).
//
//   The Drip Tower (Climb): a chest on the roof of a tower of ice (nobody can grip ice). The way up is the shaft inside it (one block
//     wide, 15 blocks of sheer wall: more than twice the fly cap, RIDE.sky.cap 6 over the floor right below you, so wings never get up it).
//     Ink drips fall down the shaft; one knocks you off and you fall to the bottom. Three nooks in the shaft's side: climb into one and
//     the drips fall past. Skill: wait in a nook, climb when a drip has gone by. Hold Climb! (or push into the wall).
//   Its place entry (`NEED_PLACES`) is all the hint needs (abilityplaces.js): the badge over the roof, the button word, who can.
//   Storm Island (the Fly test, "just timing") was removed in step C (owner 2026-11-14): Fly gets a real skill place in step D.
import { B } from './blocks.js';

export const SHAFT = {
  x: 140, z: 112,             // the shaft's cell; the tower is the 5 x 5 round it
  floor: 11, roof: 26,        // the shaft is air from `floor` to roof - 1; the roof block at `roof` (you stand on it at roof + 1)
  nooks: [15, 19, 23],        // each nook's floor height (you stand in it at that y), on the east side (x + 1)
  every: 3.4, fall: 8,        // a drip every `every` s, falling `fall` blocks a second
  r: 0.35,                    // a drip's half width
};
// The places that need an ability (abilityplaces.js): where the hint shows (round the tower's foot and up the shaft) and where its badge floats.
export const NEED_PLACES = [
  { id: 'driptower', needs: 'climb', box: { x0: SHAFT.x - 6, x1: SHAFT.x + 6, y0: SHAFT.floor - 2, y1: SHAFT.roof + 1, z0: SHAFT.z - 6, z1: SHAFT.z + 7 }, badge: [SHAFT.x + 0.5, SHAFT.roof + 3.2, SHAFT.z + 0.5] },
];
export const AREA = { x0: 72, x1: 150, z0: 80, z1: 133, edge: 6 }; // flattened to the plain ground (heightAt), the edge eases into the hills

// How flat the area makes (x, z): 1 inside, easing to 0 over AREA.edge outside it (wobbleland.js heightAt).
export function areaFlat(x, z) {
  const dx = Math.max(AREA.x0 - x, 0, x - AREA.x1), dz = Math.max(AREA.z0 - z, 0, z - AREA.z1), d = Math.hypot(dx, dz);
  if (d <= 0) return 1;
  const k = Math.min(1, d / AREA.edge);
  return 1 - k * k * (3 - 2 * k);
}
// The drips in the shaft at time t: their heights (bottom of the blob), newest first.
export function dripsAt(t) {
  const S = SHAFT, out = [], top = S.roof - 0.4, len = (top - S.floor) / S.fall;
  for (let k = Math.floor(t / S.every); k >= 0 && t - k * S.every <= len; k--) out.push(top - (t - k * S.every) * S.fall);
  return out;
}
export const inShaft = pos => Math.abs(pos.x - (SHAFT.x + 0.5)) < 0.5 + 0.3 - 0.15 && Math.abs(pos.z - (SHAFT.z + 0.5)) < 0.5 + 0.3 - 0.15 && pos.y >= SHAFT.floor - 0.1 && pos.y < SHAFT.roof + 1;
export const towerBox = { x0: SHAFT.x - 2, x1: SHAFT.x + 2, z0: SHAFT.z - 2, z1: SHAFT.z + 2 };

// The blocks (after the ground: `put` is wobbleland.js's raw setter).
export function waysLand(world, put) {
  const T = SHAFT;
  // the Drip Tower: 5 x 5, ice outside, stone inside, the shaft in the middle, a door south, three nooks east, a roof with the chest
  for (let x = T.x - 2; x <= T.x + 2; x++) for (let z = T.z - 2; z <= T.z + 2; z++) for (let y = T.floor; y <= T.roof; y++) {
    const outer = x === T.x - 2 || x === T.x + 2 || z === T.z - 2 || z === T.z + 2;
    put(x, y, z, x === T.x && z === T.z ? 0 : outer && y < T.roof ? B.ICE : B.STONE_BRICKS); // (the shaft goes up through the roof)
  }
  for (let y = T.floor; y <= T.floor + 1; y++) for (let z = T.z + 1; z <= T.z + 2; z++) put(T.x, y, z, 0); // the door (one wide)
  for (const n of T.nooks) for (let y = n; y <= n + 1; y++) put(T.x + 1, y, T.z, 0);
  put(T.x + 1, T.roof + 1, T.z + 1, B.CHEST);
  world.trialsAt = { shaft: T };
  world.needPlaces = NEED_PLACES;
}

// The place's rules, one step after the player moved (the live part each frame, the bots in Node). Its clock is summed dt (it stands
// still while the game is paused). -> events: [{ kind: 'knocked' }]
export class Trials {
  constructor() { this.t = 0; this.knock = -1; }
  step(p, dt) {
    this.t += dt;
    const ev = [], pos = p.pos, be = p.be;
    // the drips: one that meets you in the shaft (not in a nook) knocks you off
    if (inShaft(pos) && !p.onGround && this.t - this.knock > 0.4) { // (a drip landing beside you at the bottom does nothing)
      for (const y of dripsAt(this.t)) if (y < pos.y + p.height && y + 2 * SHAFT.r > pos.y) {
        this.knock = this.t;
        if (be) be.slip = true; // (a held Climb! grips again once you stand)
        p.climbing = false;
        p.vel.y = Math.min(p.vel.y, 0);
        ev.push({ kind: 'knocked' });
        break;
      }
    }
    return ev;
  }
}
