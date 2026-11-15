// Chapter 3 (plans/chapter3-ways.md, plans/chapter3-abilities-build.md step C; ?preview only): the first ABILITY place, in Bumpy Hills
// north of Puddle Meadow. Node-runnable (wobbleland.js calls `waysLand`; tests/waysbots.mjs plays it with the real Player). Nothing here is
// saved or sent; opening the chest is the game's own chest (+3 Capture Cubes).
//
//   The Drip Tower (Climb): a chest on the roof of a tower of ice (nobody can grip ice). The way up is the shaft inside it (one block
//     wide, 15 blocks of sheer wall up through the cloud layer: wings stop at the clouds, FLY_CEILING 26, under its roof at 27).
//     Its outside is ice, drawn glossy with icicles, and a climber that tries it is told once why it slips (blocks.js noGrip).
//     Ink drips fall down the shaft; one knocks you off and you fall to the bottom. Three nooks in the shaft's side: climb into one and
//     the drips fall past. Skill: wait in a nook, climb when a drip has gone by. Hold Climb! (or push into the wall).
//   The Sluice Gate (Swim, sluice.js) north-west of the tower.
//   SPOTS (owner 2026-11-14: "these should be applicable ANYWHERE ... being part of the game rather than a spotlighted place"): sheer
//     rock crags with a chest on top (poking up through the cloud layer, FLY_CEILING: only a climber gets up, by walking into the wall) and little clouds
//     floating 5 over the ground with a chest (no wall to climb, too high to jump: only a flier), in Bumpy Hills and beyond. Nothing
//     marks them: every place entry (`NEED_PLACES`) only gives its hint after a few tries (abilityplaces.js NeedHints).
//   Storm Island (step C) and the Floating Isles (step D's first Fly place, "pretty lame") were removed (owner 2026-11-14).
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { SLUICE, buildSluice, SluiceRun } from './sluice.js'; // step D: the Swim place
import { FLATS, earthLand, EarthRun } from './earthworks.js'; // step D's second pair: Dig and Push
import { FLATS2, fireIceLand, FireIceRun } from './fireice.js'; // step D's third pair: Burn and Freeze

export const SHAFT = {
  x: 140, z: 112,             // the shaft's cell; the tower is the 5 x 5 round it
  floor: 11, roof: 26,        // the shaft is air from `floor` to roof - 1; the roof block at `roof` (you stand on it at roof + 1)
  nooks: [15, 19, 23],        // each nook's floor height (you stand in it at that y), on the east side (x + 1)
  every: 3.4, fall: 8,        // a drip every `every` s, falling `fall` blocks a second
  r: 0.35,                    // a drip's half width
};
// The natural spots: crags (Climb) and clouds (Fly). x, z = the north-west corner (a crag: w x d, h tall over the ground there) or the
// middle (a cloud: radius r, its top `lift` over the ground). Each gets a chest on top. Placed clear of every patch's ring.
export const SPOTS = [
  { id: 'crag1', kind: 'crag', needs: 'climb', x: 80, z: 112, w: 6, d: 6, h: 18 },
  { id: 'crag2', kind: 'crag', needs: 'climb', x: 100, z: 86, w: 5, d: 5, h: 19 },
  { id: 'crag3', kind: 'crag', needs: 'climb', x: 20, z: 30, w: 5, d: 5, h: 18 },    // (Bumpy Hills' far north-west)
  { id: 'cloud1', kind: 'cloud', needs: 'fly', x: 104, z: 120, r: 2, lift: 5 },
  { id: 'cloud2', kind: 'cloud', needs: 'fly', x: 88, z: 94, r: 2, lift: 5 },
  { id: 'cloud3', kind: 'cloud', needs: 'fly', x: 200, z: 30, r: 2, lift: 5 },     // (Bumpy Hills' far north-east)
  { id: 'cloud4', kind: 'cloud', needs: 'fly', x: 30, z: 140, r: 2, lift: 5 },     // (over Slippy Lake's ice, between its patches)
];
// a spot's cells: [[x, y, z, id]] on ground height `g` (the top block's y), and its top (where you stand on it)
export function spotCells(q, g) {
  const out = [];
  if (q.kind === 'crag') {
    for (let x = q.x; x < q.x + q.w; x++) for (let z = q.z; z < q.z + q.d; z++) for (let y = g + 1; y <= g + q.h; y++) out.push([x, y, z, y === g + q.h ? B.GRASS : B.STONE]);
    out.push([q.x + (q.w >> 1), g + q.h + 1, q.z + (q.d >> 1), B.CHEST]);
    return { cells: out, top: g + q.h + 1 };
  }
  const R = Math.ceil(q.r), y = g + q.lift; // (the cloud's top block: you stand on it `lift` over where you stand on the ground; the fly cap is 6)
  for (let x = q.x - R; x <= q.x + R; x++) for (let z = q.z - R; z <= q.z + R; z++) if (Math.hypot(x - q.x, z - q.z) <= q.r + 0.3) { out.push([x, y - 1, z, B.CLOUD]); out.push([x, y, z, B.CLOUD]); }
  out.push([q.x + 1, y + 1, q.z, B.CHEST]); // (beside the middle, where you settle)
  return { cells: out, top: y + 1 };
}
const spotBox = (q, g, top) => q.kind === 'crag'
  ? { x0: q.x - 4, x1: q.x + q.w + 3, y0: g - 1, y1: top + 1, z0: q.z - 4, z1: q.z + q.d + 3 }
  : { x0: q.x - q.r - 4, x1: q.x + q.r + 4, y0: g - 1, y1: top + 1, z0: q.z - q.r - 4, z1: q.z + q.r + 4 };

// The places that need an ability (abilityplaces.js): where trying counts and the hint shows. The spots are added by waysLand.
export const NEED_PLACES = [
  { id: 'sluice', needs: 'swim', box: { x0: SLUICE.pond.x0 - 3, x1: SLUICE.grotto.x1 + 1, y0: 4, y1: 16, z0: SLUICE.pond.z0 - 2, z1: SLUICE.grotto.z1 } },
  { id: 'driptower', needs: 'climb', box: { x0: SHAFT.x - 6, x1: SHAFT.x + 6, y0: SHAFT.floor - 2, y1: SHAFT.roof + 1, z0: SHAFT.z - 6, z1: SHAFT.z + 7 } },
];
export const AREA = { x0: 72, x1: 150, z0: 80, z1: 133, edge: 6 }; // flattened to the plain ground (heightAt), the edge eases into the hills

// How flat the area makes (x, z): 1 inside, easing to 0 over AREA.edge outside it (wobbleland.js heightAt).
const BOXES = [AREA, ...FLATS, ...FLATS2]; // (the Dig and Push places' flat ground too, earthworks.js FLATS)
export function areaFlat(x, z) {
  let best = 0;
  for (const A of BOXES) {
    const dx = Math.max(A.x0 - x, 0, x - A.x1), dz = Math.max(A.z0 - z, 0, z - A.z1), d = Math.hypot(dx, dz);
    if (d <= 0) return 1;
    const k = Math.min(1, d / (A.edge ?? AREA.edge));
    best = Math.max(best, 1 - k * k * (3 - 2 * k));
  }
  return best;
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
export function waysLand(world, put, heightAt) {
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
  buildSluice(world, put);
  world.spots = [];
  const places = NEED_PLACES.slice();
  places.push(...earthLand(world, put, heightAt)); // step D: soft earth (Dig), boulders and the Ball Garden (Push)
  places.push(...fireIceLand(world, put, heightAt)); // step D: brambles and ice doors (Burn), water and the Frozen Falls (Freeze)
  for (const q of SPOTS) {
    const g = heightAt(q.x + 0.5, q.z + 0.5) ?? 10, { cells, top } = spotCells(q, g);
    for (const [x, y, z, id] of cells) put(x, y, z, id);
    world.spots.push({ ...q, ground: g, top });
    places.push({ id: q.id, needs: q.needs, box: spotBox(q, g, top) });
  }
  world.needPlaces = places;
}

// The place's rules, one step after the player moved (the live part each frame, the bots in Node). Its clock is summed dt (it stands
// still while the game is paused). -> events: [{ kind: 'knocked' }]
export class Trials {
  // world: the islands and the gate change blocks through LiveCells (never solid inside you; world.setLive)
  constructor(world = null) {
    this.t = 0; this.knock = -1; this.p = null;
    this.cells = world?.setLive ? new LiveCells(world, () => this.p) : null;
    const set = (x, y, z, id) => this.cells?.want(x, y, z, id);
    this.sluice = new SluiceRun(set);
    const live = (x, y, z, id) => (this.cells ? this.cells.want(x, y, z, id) : world.setLive?.(x, y, z, id));
    this.earth = world?.earth ? new EarthRun(world, live) : null;
    this.fireice = world?.fireice ? new FireIceRun(world, live) : null;
  }
  step(p, dt) {
    this.t += dt; this.p = p;
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
    ev.push(...this.sluice.step(p, dt));
    if (this.earth) ev.push(...this.earth.step(p, dt));
    if (this.fireice) ev.push(...this.fireice.step(p, dt));
    this.cells?.flush();
    return ev;
  }
}
