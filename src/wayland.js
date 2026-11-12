// Chapter 3 (plans/chapter3-ways.md, ?preview only): the first two WAY places, side by side in Bumpy Hills, north of Puddle Meadow.
// Node-runnable (wobbleland.js calls `waysLand`; tests/waysbots.mjs plays them with the real Player). Nothing here is saved or sent;
// opening a chest is the game's own chest (+3 Capture Cubes).
//
//   Storm Island (Fly): a chest on a little island in the middle of a lake of the Scribble's ink. Touch the ink = a puff back to where you
//     came from. Three rings of ink-wind stand round the island and blow straight DOWN while they are on (2 s on, 1 s off; a flicker just
//     before they come on). Owner 2026-11-12 ("too windy for Boomwing but not for bubbles? make it make sense"): the storm is the same
//     for EVERY creature with wings, Boomwing, a Drake or a bubble: it is a wings place, not a type's. Skill: hover between the rings and
//     go when one turns off. The rings' times are set so flying straight in at full speed always meets one that is on (`ringOffsets`),
//     so the naive way never works.
//   The Drip Tower (Cling): a chest on the roof of a tower of ice (nobody can grip ice), reached only up the narrow shaft inside it
//     (one block wide: no wings open there). Ink drips fall down the shaft; one knocks you off and you fall to the bottom. Three nooks in
//     the shaft's side: climb into one and the drips fall past. Skill: wait in a nook, climb when a drip has gone by.
import { B } from './blocks.js';

export const STORM = {
  x: 100, z: 107, r: 23,      // the ink lake (a circle) round the island
  island: 4.5, top: 14,       // the island's top block (you stand at top + 1)
  ink: 10,                    // the ink's block (BASE: the ground's top); touching it = a puff
  rings: [18, 13, 8],         // each ring's middle radius, outermost first
  width: 2.5,                 // a ring's width
  period: 3, on: 1.8, warn: 0.4, // seconds: a cycle; on for `on`; it flickers for `warn` before it comes on (still calm then)
  down: 30,                   // blocks a second a ring pushes you down while on (more than any climb: you end in the ink)
  fly: 7.5,                   // the flying speed the ring times are worked out for (riding.js RIDE.sky.speed)
  shore: [100.5, 11, 133.5, 0], // where a puff from the ink puts you if you had no dry spot before (x, y, z, yaw)
};
export const SHAFT = {
  x: 140, z: 112,             // the shaft's cell; the tower is the 5 x 5 round it
  floor: 11, roof: 26,        // the shaft is air from `floor` to roof - 1; the roof block at `roof` (you stand on it at roof + 1)
  nooks: [15, 19, 23],        // each nook's floor height (you stand in it at that y), on the east side (x + 1)
  every: 3.4, fall: 8,        // a drip every `every` s, falling `fall` blocks a second
  r: 0.35,                    // a drip's half width
};
export const AREA = { x0: 72, x1: 150, z0: 80, z1: 133, edge: 6 }; // flattened to the plain ground (heightAt), the edge eases into the hills

// How flat the area makes (x, z): 1 inside, easing to 0 over AREA.edge outside it (wobbleland.js heightAt).
export function areaFlat(x, z) {
  const dx = Math.max(AREA.x0 - x, 0, x - AREA.x1), dz = Math.max(AREA.z0 - z, 0, z - AREA.z1), d = Math.hypot(dx, dz);
  if (d <= 0) return 1;
  const k = Math.min(1, d / AREA.edge);
  return 1 - k * k * (3 - 2 * k);
}
const distS = (x, z) => Math.hypot(x - STORM.x, z - STORM.z);
// in the lake (not on the island), by a position's x / z (world units)
export const overInk = (x, z) => { const d = distS(x, z); return d <= STORM.r && d > STORM.island; };
// The rings' times: ring i is off during [off_i, off_i + (period - on)) of each cycle. Flying straight in from the shore at `fly`, you
// reach ring i at a_i; off_i = a_i + i * period / 3 makes the three chances of slipping through all three at full speed never overlap.
export function ringOffsets() {
  const S = STORM, pass = 0.6;
  return S.rings.map((r, i) => ((S.r - (r + S.width / 2) - pass / 2) / S.fly + i * S.period / S.rings.length) % S.period);
}
const OFFS = ringOffsets();
// A ring's state at time t: 'on' (blowing down), 'warn' (about to), 'off'
export function ringState(i, t) {
  const S = STORM, off = S.period - S.on, ph = (((t - OFFS[i]) % S.period) + S.period) % S.period; // 0 = it turns off
  if (ph < off - S.warn) return 'off';
  if (ph < off) return 'warn';
  return 'on';
}
export const ringAt = (x, z) => { const d = distS(x, z); return STORM.rings.findIndex(r => Math.abs(d - r) <= STORM.width / 2); };
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
  const S = STORM, T = SHAFT;
  // the ink lake and the island
  for (let x = Math.floor(S.x - S.r - 1); x <= Math.ceil(S.x + S.r + 1); x++) for (let z = Math.floor(S.z - S.r - 1); z <= Math.ceil(S.z + S.r + 1); z++) {
    const d = distS(x + 0.5, z + 0.5);
    if (d > S.r) continue;
    for (let y = S.ink + 1; y <= S.top + 6; y++) put(x, y, z, 0);
    if (d <= S.island) { for (let y = S.ink; y <= S.top; y++) put(x, y, z, y === S.top ? B.GRASS : B.DIRT); }
    else put(x, S.ink, z, B.DO_INK);
  }
  put(Math.floor(S.x), S.top + 1, Math.floor(S.z), B.CHEST);
  // the Drip Tower: 5 x 5, ice outside, stone inside, the shaft in the middle, a door south, three nooks east, a roof with the chest
  for (let x = T.x - 2; x <= T.x + 2; x++) for (let z = T.z - 2; z <= T.z + 2; z++) for (let y = T.floor; y <= T.roof; y++) {
    const outer = x === T.x - 2 || x === T.x + 2 || z === T.z - 2 || z === T.z + 2;
    put(x, y, z, x === T.x && z === T.z ? 0 : outer && y < T.roof ? B.ICE : B.STONE_BRICKS); // (the shaft goes up through the roof)
  }
  for (let y = T.floor; y <= T.floor + 1; y++) for (let z = T.z + 1; z <= T.z + 2; z++) put(T.x, y, z, 0); // the door (one wide)
  for (const n of T.nooks) for (let y = n; y <= n + 1; y++) put(T.x + 1, y, T.z, 0);
  put(T.x + 1, T.roof + 1, T.z + 1, B.CHEST);
  world.trialsAt = { storm: S, shaft: T };
}

// The places' rules, one step after the player moved (the live part each frame, the bots in Node). Its clock is summed dt (it stands
// still while the game is paused). -> events: [{ kind: 'puff' | 'knocked' | 'downdraft', ... }]
export class Trials {
  constructor() { this.t = 0; this.dry = null; this.knock = -1; }
  step(p, dt) {
    this.t += dt;
    const ev = [], pos = p.pos, be = p.be, flying = p.ride?.kind === 'sky';
    const ink = overInk(pos.x, pos.z), d = distS(pos.x, pos.z);
    // the storm: a ring that is on blows every flier down (wings are wings)
    if (flying) {
      const i = ringAt(pos.x, pos.z);
      if (i >= 0 && ringState(i, this.t) === 'on') { p.moveAxis('y', -STORM.down * dt); ev.push({ kind: 'downdraft', ring: i }); }
    }
    // the ink: a puff back to the last dry spot outside the lake
    if (ink && pos.y <= STORM.ink + 1.15) {
      const to = this.dry ?? STORM.shore;
      pos.set(to[0], to[1], to[2]); p.vel.set(0, 0, 0); if (p.ride?.be) p.ride.landing = false;
      ev.push({ kind: 'puff', yaw: to[3] });
    } else if (d > STORM.r + 1 && (p.onGround || flying) && d < STORM.r + 12) this.dry = [pos.x, pos.y, pos.z, Math.atan2(pos.x - STORM.x, pos.z - STORM.z)];
    // the drips: one that meets you in the shaft (not in a nook) knocks you off
    if (inShaft(pos) && !p.onGround && this.t - this.knock > 0.4) { // (a drip landing beside you at the bottom does nothing)
      for (const y of dripsAt(this.t)) if (y < pos.y + p.height && y + 2 * SHAFT.r > pos.y) {
        this.knock = this.t;
        if (be) be.slip = true;
        p.vel.y = Math.min(p.vel.y, 0);
        ev.push({ kind: 'knocked' });
        break;
      }
    }
    return ev;
  }
}
