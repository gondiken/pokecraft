// Chapter 3 step D, the fourth pair (plans/chapter3-abilities-build.md "Overnight 2026-11-15/16"; ?preview only, Wobbleland): SQUEEZE and
// PASS THROUGH. Pure, Node-runnable (wayland.js builds it into the land, its Trials steps SlipRun; tests/waysbots.mjs plays it with the
// real Player). Both are walking into a thing (things.js `walk`): no button.
//   Squeeze (Slime, Paper, Tiny, Doodle): a crack in real stone (kind `crack`) is only one block high. A squishy creature walking into it
//     squashes flat and crawls through, slowly (player.js `squash`); anyone else bumps its head. Natural spots: CRACKED rocks (a chest
//     inside, the only way in a crack at the foot of the rock).
//   The Boulder Run (RUN, the deeper Squeeze place): a long stone corridor up a slope, too low to fly in, a chest at the top. Boulders
//     roll down it one after another; a boulder that meets you rolls you back to the bottom. Long low cracks in its west wall (2 along,
//     1 high) are the only places to duck into while one rolls past. Skill: wait in a crack, then dash to the next one before the next boulder comes.
//   Pass through (Ghost, Dream, Portal, Mirror): a half-erased pencil wall (kind `faded`) is solid to everyone else; a ghostly creature
//     walks through it, slowly (as if wading: player.js `fadedAt`). Natural spots: PENCIL houses (a chest inside, one wall half erased).
//   The Sliding Smudge (SMUDGE, the deeper Pass place): thick inked walls across a hall, solid to everyone, ghosts too; on each, a smudge
//     where the ink is rubbed away slides along it. Inside a wall you are slow, and if the smudge slides off you the ink comes back round
//     you: puff, back to the start. Skill: walk in at the smudge's front edge and drift along with it while you cross; just walking
//     straight in when it arrives leaves you behind in the ink.
import { B } from './blocks.js';

export const PROP = B.HOUSE_PROP;
export const CRACKED = [{ id: 'cracked1', x: 74, z: 12 }, { id: 'cracked2', x: 176, z: 62 }, { id: 'cracked3', x: 30, z: 20 }]; // rock lumps 6 x 6 x 4, the crack in the south face
export const PENCIL = [{ id: 'pencil1', x: 120, z: 4 }, { id: 'pencil2', x: 150, z: 200 }, { id: 'pencil3', x: 12, z: 64 }];   // houses 5 x 5, the faded wall the east one
export const SQUASH = { h: 0.8, eye: 0.55, crawl: 0.45 };   // a squashed body: its height, its eye, its speed x
export const FADE = { wade: 0.3 };                        // inside a faded wall you move this much as fast
export const RUN = { x: 212, z0: 4, z1: 34, nooks: [9, 15, 21, 27], period: 3.2, speed: 7, first: 1.2 }; // the corridor (x, from z0 at the top to z1 at the bottom); cracks at those z (west side); boulders every `period` s at `speed`
export const SMUDGE = { x0: 108, x1: 120, z0: 98, walls: [102, 110, 118], thick: 5, w: 4, speeds: [1.0, 1.3, 1.6], room: 125 }; // the hall (x0..x1, from z0); inked walls `thick` deep starting at those z; a smudge `w` wide sliding at those speeds; the chest room from `room`
// The flat ground under the places (wayland.js areaFlat)
export const FLATS3 = [
  ...CRACKED.map(c => ({ x0: c.x - 3, x1: c.x + 8, z0: c.z - 3, z1: c.z + 10 })),
  ...PENCIL.map(c => ({ x0: c.x - 3, x1: c.x + 9, z0: c.z - 3, z1: c.z + 8 })),
  { x0: RUN.x - 5, x1: RUN.x + 5, z0: RUN.z0 - 3, z1: RUN.z1 + 6 },
  { x0: SMUDGE.x0 - 4, x1: SMUDGE.x1 + 4, z0: SMUDGE.z0 - 4, z1: SMUDGE.room + 7 },
];

const at = (w, x, y, z) => w.index(x, y, z);
// where a wall's smudge is (its west edge, along x) at time t: back and forth across the hall (a closed form: the same at every frame rate)
export function smudgeAt(k, t) {
  const S = SMUDGE, span = S.x1 - S.x0 + 1 - S.w, L = 2 * span, u = ((t * S.speeds[k] + k * 2.7) % L + L) % L;
  return S.x0 + (u <= span ? u : L - u);
}
// is the cell (x of a wall k) rubbed out at time t (a cell counts while at least most of it is inside the smudge)
export const rubbed = (k, x, t) => { const s = smudgeAt(k, t); return x + 0.15 >= s && x + 0.85 <= s + SMUDGE.w; };
// the boulders in the Boulder Run at time t: their z (the middle), rolling from the top (z0) down to the bottom (z1)
export function bouldersAt(t) {
  const out = [], len = (RUN.z1 - RUN.z0 + 2) / RUN.speed;
  for (let k = Math.floor((t - RUN.first) / RUN.period); k >= 0; k--) { const a = t - RUN.first - k * RUN.period; if (a > len) break; out.push(RUN.z0 - 1 + a * RUN.speed); }
  return out;
}

export function slipLand(world, put, heightAt) {
  const things = world.things ??= new Map(), spots = world.colourSpots ??= [], places = [];
  const S = world.slip = { cracked: [], pencil: [], run: null, smudge: null, faded: new Set() };
  for (const c of CRACKED) { // a rock: 6 x 6, 4 tall, a room inside (4 x 4, 2 tall); the crack 1 high, 1 wide at the foot of the south face
    const g = heightAt(c.x + 3, c.z + 3);
    for (let x = c.x; x < c.x + 6; x++) for (let z = c.z; z < c.z + 6; z++) {
      put(x, g, z, B.STONE);
      for (let y = g + 1; y <= g + 4; y++) put(x, y, z, x > c.x && x < c.x + 5 && z > c.z && z < c.z + 5 && y <= g + 2 ? 0 : B.STONE);
    }
    put(c.x + 2, g + 1, c.z + 5, 0); things.set(at(world, c.x + 2, g + 1, c.z + 5), { kind: 'crack', group: c.id }); // (the crack)
    put(c.x + 4, g + 1, c.z + 1, B.CHEST);
    S.cracked.push({ ...c, g });
    spots.push([c.x + 3, c.z + 3, 5]);
    places.push({ id: c.id, needs: 'squeeze', box: { x0: c.x - 2, x1: c.x + 7, y0: g - 1, y1: g + 6, z0: c.z - 1, z1: c.z + 8 } });
  }
  for (const c of PENCIL) { // a little house: walls of planks, a roof; its east wall is faded pencil (solid to all but ghostly creatures)
    const g = heightAt(c.x + 2.5, c.z + 2.5);
    for (let x = c.x; x < c.x + 5; x++) for (let z = c.z; z < c.z + 5; z++) {
      put(x, g, z, B.PLANKS);
      for (let y = g + 1; y <= g + 3; y++) {
        const edge = x === c.x || x === c.x + 4 || z === c.z || z === c.z + 4, roof = y === g + 3;
        if (x === c.x + 4 && !roof && z > c.z && z < c.z + 4) { put(x, y, z, PROP); things.set(at(world, x, y, z), { kind: 'faded', group: c.id }); S.faded.add(at(world, x, y, z)); continue; }
        put(x, y, z, edge || roof ? B.PLANKS : 0);
      }
    }
    for (let x = c.x + 5; x < c.x + 8; x++) for (let z = c.z; z < c.z + 5; z++) for (let y = g + 1; y < g + 4; y++) put(x, y, z, 0);
    put(c.x + 1, g + 1, c.z + 2, B.CHEST);
    S.pencil.push({ ...c, g });
    spots.push([c.x + 2.5, c.z + 2.5, 5]);
    places.push({ id: c.id, needs: 'pass', box: { x0: c.x - 1, x1: c.x + 7, y0: g - 1, y1: g + 5, z0: c.z - 2, z1: c.z + 6 } });
  }
  { // the Boulder Run: a corridor 1 wide, 2 tall, a stone roof, running north from its foot (z1) to the top (z0) and a room with the chest;
    // the crack nooks in its west wall (1 high, 1 deep); boulders roll down it (drawn and judged by bouldersAt: no blocks move)
    const R = RUN, g = heightAt(R.x + 0.5, (R.z0 + R.z1) / 2);
    for (let x = R.x - 3; x <= R.x + 2; x++) for (let z = R.z0 - 4; z <= R.z1; z++) {
      put(x, g, z, B.STONE);
      const room = z < R.z0 && x >= R.x - 1 && x <= R.x + 1 && z > R.z0 - 4, way = x === R.x && z >= R.z0;
      for (let y = g + 1; y <= g + 3; y++) put(x, y, z, (way || room) && y <= g + 2 ? 0 : B.STONE);
    }
    for (const n of R.nooks) for (const z of [n, n + 1]) { put(R.x - 1, g + 1, z, 0); things.set(at(world, R.x - 1, g + 1, z), { kind: 'crack', group: 'run' }); } // (a long low crack: 2 along, 1 high, 1 deep)
    put(R.x, g + 1, R.z0 - 3, B.CHEST);
    S.run = { ...R, g };
    spots.push([R.x + 0.5, (R.z0 + R.z1) / 2, 9]);
    places.push({ id: 'run', needs: 'squeeze', box: { x0: R.x - 3, x1: R.x + 3, y0: g - 1, y1: g + 4, z0: R.z0 - 4, z1: R.z1 + 4 } });
  }
  { // the Sliding Smudge: a roofed hall (x0..x1), inked walls across it `thick` deep (PROP: solid to everyone, the smudge's cells only to
    // ghostly creatures: player.js asks world.fadedAt), the chest room after the last wall
    const M = SMUDGE, g = heightAt((M.x0 + M.x1) / 2, (M.z0 + M.room) / 2);
    for (let x = M.x0 - 1; x <= M.x1 + 1; x++) for (let z = M.z0 - 1; z <= M.room + 4; z++) {
      put(x, g, z, B.PLANKS);
      const side = x < M.x0 || x > M.x1 || z === M.room + 4;
      for (let y = g + 1; y <= g + 4; y++) put(x, y, z, side || y === g + 4 ? B.PLANKS : 0);
    }
    for (let x = M.x0; x <= M.x1; x++) for (let y = g + 1; y <= g + 3; y++) put(x, y, M.z0 - 1, 0); // (the way in, at the south end)
    M.walls.forEach((z0, k) => { for (let z = z0; z < z0 + M.thick; z++) for (let x = M.x0; x <= M.x1; x++) for (let y = g + 1; y <= g + 3; y++) { put(x, y, z, PROP); things.set(at(world, x, y, z), { kind: 'ink', wall: k }); } });
    put((M.x0 + M.x1) >> 1, g + 1, M.room + 2, B.CHEST);
    S.smudge = { ...M, g };
    spots.push([(M.x0 + M.x1) / 2, (M.z0 + M.room) / 2, 14]);
    places.push({ id: 'smudge', needs: 'pass', box: { x0: M.x0 - 2, x1: M.x1 + 2, y0: g - 1, y1: g + 5, z0: M.z0 - 3, z1: M.room + 4 } });
  }
  return places;
}

// world.fadedAt(x, y, z, t): can a ghostly creature walk through this solid cell now? (a pencil house's faded wall, a smudge's cells)
export function fadedAt(world, x, y, z, t) {
  const S = world.slip;
  if (!S) return false;
  const i = at(world, x, y, z);
  if (S.faded.has(i)) return true;
  const th = world.things?.get(i);
  return th?.kind === 'ink' ? rubbed(th.wall, x, t) : false;
}

// The rules, one step after the player moved. -> events [{ kind: 'squished' | 'inked' | 'narrow' | 'solid' }]
export class SlipRun {
  constructor(world) { this.w = world; this.t = 0; this.log = []; this.push = 0; this.hits = 0; world.slipT = 0; }
  get run() { return this.w.slip?.run; }
  get smudge() { return this.w.slip?.smudge; }
  // a body in the corridor (not in a nook) that a boulder meets
  boulderHit(p, t = this.t) {
    const R = this.run;
    if (!R || p.pos.x + p.halfW < R.x + 0.1 || p.pos.x - p.halfW > R.x + 0.9 || p.pos.z < R.z0 || p.pos.z > R.z1 + 1 || p.pos.y > R.g + 2.5) return false;
    return bouldersAt(t).some(bz => Math.abs(bz - p.pos.z) < 0.5 + p.halfW + 0.2);
  }
  step(p, dt) {
    this.t += dt; this.w.slipT = this.t; // (world.fadedAt reads the smudges at this time)
    const ev = [], w = this.w, ab = p.be?.abilities ?? [];
    const R = this.run;
    if (R && this.boulderHit(p)) { // rolled back to the foot of the run
      p.pos.set(R.x + 0.5, R.g + 1, R.z1 + 2.5); p.vel.set(0, 0, 0); p.squashed && p.unsquash?.(true);
      ev.push({ kind: 'squished' }); this.hits++;
    }
    // inside an inked wall whose smudge slid away: back to the start of the hall
    const M = this.smudge;
    if (M && p.pos.x > M.x0 - 0.3 && p.pos.x < M.x1 + 1.3 && p.pos.y < M.g + 4) {
      const lo = Math.floor(p.pos.x - p.halfW), hi = Math.floor(p.pos.x + p.halfW), zl = Math.floor(p.pos.z - p.halfW), zh = Math.floor(p.pos.z + p.halfW), y = Math.floor(p.pos.y + 0.1);
      let stuck = false;
      for (let x = lo; x <= hi && !stuck; x++) for (let z = zl; z <= zh && !stuck; z++) { const th = w.things?.get(at(w, x, y, z)); if (th?.kind === 'ink' && !rubbed(th.wall, x, this.t)) stuck = true; }
      if (stuck) { p.pos.set((M.x0 + M.x1) / 2 + 0.5, M.g + 1, M.z0 - 1.5); p.vel.set(0, 0, 0); ev.push({ kind: 'inked' }); }
    }
    // walking into a crack or a faded wall you cannot go through: why, once (after a moment of pushing)
    const wi = walkedIntoWall(w, p, this.t);
    if (wi && !ab.includes(wi.needs)) { this.push += dt; if (this.push > 0.3) { ev.push({ kind: 'heavy', what: wi.kind }); this.push = -9; } } else if (!wi) this.push = 0;
    this.log.push(...ev); if (this.log.length > 64) this.log.splice(0, this.log.length - 64);
    return ev;
  }
  info() { return { boulders: bouldersAt(this.t).map(z => +z.toFixed(1)), hits: this.hits, smudges: (this.smudge?.walls ?? []).map((_, k) => +smudgeAt(k, this.t).toFixed(2)) }; }
}
// walking into a crack (your head bumps the stone over it) or a faded wall
function walkedIntoWall(world, p, t) {
  const w = p.wish;
  if (!w || !p.hitWall) return null;
  const ax = Math.abs(w[0]) >= Math.abs(w[1]), dir = ax ? [Math.sign(w[0]), 0] : [0, Math.sign(w[1])];
  const x = Math.floor(p.pos.x + dir[0] * (p.halfW + 0.12)), z = Math.floor(p.pos.z + dir[1] * (p.halfW + 0.12));
  for (const dy of [0.1, 1.1]) {
    const y = Math.floor(p.pos.y + dy), th = world.things?.get(world.index(x, y, z));
    if (th?.kind === 'crack') return { kind: 'crack', needs: 'squeeze' };
    if (th?.kind === 'faded' || (th?.kind === 'ink' && rubbed(th.wall, x, t))) return { kind: 'faded', needs: 'pass' };
  }
  return null;
}
