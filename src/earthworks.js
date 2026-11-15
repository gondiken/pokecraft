// Chapter 3 step D, the second pair (plans/chapter3-abilities-build.md "Overnight 2026-11-15/16"; ?preview only, Wobbleland): DIG and PUSH.
// Pure, Node-runnable (wayland.js builds it into the land, its Trials steps EarthRun; tests/waysbots.mjs plays it with the real Player).
//   Soft earth (things.js kind `soft`): dark crumbly earth. A digger looks at it and presses the big button ("Dig!"): one press, one
//     block. Nobody else can (the button says nothing, a press says why once). Natural spots: MOUNDS, little humps of soft earth all over
//     Wobbleland with a chest buried under each (two digs).
//   The Warm-or-Cold Dig (DIG_PATCH, the deeper Dig place): a square of soft earth by a glass case with a chest. A gold key is buried
//     under one of its 49 squares. Each dig makes a hole that glows how close the key is: red = right next to it, orange = 2 away, yellow
//     = 3, blue = cold. The 6th wrong hole: the earth rumbles shut and the key moves. Skill: dig where the colours point (4 digs always
//     do it); digging at random finds it about 1 time in 10.
//   Boulders (kind `boulder`, 2 x 2 x 2, heavy): walk into one and a pusher pushes it a block (it does not roll). Natural spots: CAVES,
//     rock lumps with a boulder in the mouth and a chest inside.
//   The Ball Garden (GARDEN, the deeper Push place): two stone balls (kind `ball`) in a walled garden with stone posts and two holes.
//     A ball you push ROLLS until it bumps into something (a post, the low wall, the other ball) or drops into a hole. Both holes full:
//     the glass case opens. Skill: use the posts to stop a ball where you need it (5 pushes); pushing a ball straight at a hole only
//     sends it to the wall. Walk out of the garden and the balls roll home.
// Everything moves through `set` (LiveCells in the game: never solid inside you); nothing is saved but the opened chests (the game's
// own chests, +3 Capture Cubes each).
import { B } from './blocks.js';

export const PROP = B.HOUSE_PROP; // (solid, never drawn: a model shows the boulder or ball; wobblelive.js Earthworks)
export const SOFT = B.MUD;        // soft earth's block
export const MOUNDS = [ // { x, z }: the middle of a 3 x 3 hump of soft earth with a cross on top; a chest one under its middle
  { id: 'mound1', x: 12, z: 10 }, { id: 'mound2', x: 100, z: 6 }, { id: 'mound3', x: 210, z: 52 },
  { id: 'mound4', x: 44, z: 66 }, { id: 'mound5', x: 96, z: 168 }, { id: 'mound6', x: 152, z: 141 },
];
export const CAVES = [ // rock lumps (w x d x h) with a room inside, the mouth (2 wide, 2 tall) in the south face, a boulder in it
  { id: 'cave1', x: 26, z: 52, w: 8, d: 9, h: 5 }, { id: 'cave2', x: 168, z: 50, w: 8, d: 9, h: 5 }, { id: 'cave3', x: 182, z: 4, w: 8, d: 9, h: 5 },
];
export const DIG_PATCH = { x0: 132, z0: 40, n: 7, digs: 5, case: { x: 135, z: 36 } }; // 7 x 7 squares (every one in reach from outside its rim), two deep; 5 wrong holes and it rumbles shut; the case north of it
export const GARDEN = { // the grid is n x n (gx 0..8, gz 0..8 from x0, z0) in a low wall; the case north of it
  x0: 90, z0: 40, n: 9, case: { x: 94, z: 36 },
  posts: [[8, 5], [5, 6], [1, 1], [0, 4], [3, 6], [1, 8]], holes: [[2, 5], [3, 3]], balls: [[7, 4], [3, 2]], // (found by a search: 5 pushes, the straight push fails)
};
export const PUSH = { hold: 0.22, move: 0.3, ball: 0.1, away: 14, home: 4, leave: 1.5 }; // hold = pushing this long moves it; ball = s a cell; away / home = a boulder rolls home when you are this far for this long
export const WARM = [0, 1, 2, 3]; // a hole's level by its distance to the key (the bigger of the two: a square ring): 1 red, 2 orange, 3 yellow, else blue
// The flat ground under the places (wayland.js areaFlat: heightAt eases them to the plain ground)
export const FLATS = [
  { x0: DIG_PATCH.x0 - 6, x1: DIG_PATCH.x0 + DIG_PATCH.n + 5, z0: DIG_PATCH.case.z - 5, z1: DIG_PATCH.z0 + DIG_PATCH.n + 5 },
  { x0: GARDEN.x0 - 6, x1: GARDEN.x0 + GARDEN.n + 5, z0: GARDEN.case.z - 5, z1: GARDEN.z0 + GARDEN.n + 6 },
  ...CAVES.map(c => ({ x0: c.x - 4, x1: c.x + c.w + 3, z0: c.z - 3, z1: c.z + c.d + 5 })),
  ...MOUNDS.map(m => ({ x0: m.x - 3, x1: m.x + 3, z0: m.z - 3, z1: m.z + 3 })),
];

const hash = n => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
// the key's square in round n (the same on every device)
export const keyOf = n => { const h = hash(n + 7); return [h % DIG_PATCH.n, Math.floor(h / DIG_PATCH.n) % DIG_PATCH.n]; };
// how warm a hole at square (u, v) is for a key at (ku, kv): 0 = the key, 1 red, 2 orange, 3 yellow, 4 cold
export const warmth = (u, v, ku, kv) => Math.min(4, Math.max(Math.abs(u - ku), Math.abs(v - kv)));
// the squares the key can still be under after these holes ([u, v, level], level 4 = cold)
export function keyCandidates(holes, n = DIG_PATCH.n) {
  const out = [];
  for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) if (holes.every(([a, b, l]) => warmth(a, b, u, v) === l)) out.push([u, v]);
  return out;
}

// the case's cells: a stone plinth, the chest on it, glass round it (3 x 3, two high, a glass lid); `front` = the cells that open (south)
export function caseCells(c, g) {
  const out = [], front = [];
  for (let x = c.x - 1; x <= c.x + 1; x++) for (let z = c.z - 1; z <= c.z + 1; z++) {
    out.push([x, g, z, B.STONE_BRICKS]);
    for (let y = g + 1; y <= g + 2; y++) {
      if (x === c.x && z === c.z) { out.push([x, y, z, y === g + 1 ? B.CHEST : B.AIR]); continue; }
      out.push([x, y, z, B.GLASS]);
      if (z === c.z + 1) front.push([x, y, z]);
    }
    out.push([x, g + 3, z, B.GLASS]);
  }
  return { cells: out, front };
}

const keyIdx = (w, x, y, z) => w.index(x, y, z);

// The blocks (wayland.js waysLand, after the ground: `put` is wobbleland.js's raw setter). Registers world.things and returns the places
// (abilityplaces.js entries: where trying counts).
export function earthLand(world, put, heightAt) {
  const things = world.things ??= new Map(), places = [], E = world.earth = { mounds: [], caves: [], patch: null, garden: null };
  const spots = world.colourSpots ??= []; // (wobblelook.js: in colour even in a grey region: soft earth must look like earth, a boulder like a boulder)
  const soft = (x, y, z, group) => { put(x, y, z, SOFT); things.set(keyIdx(world, x, y, z), { kind: 'soft', group }); };
  for (const m of MOUNDS) {
    const g = heightAt(m.x + 0.5, m.z + 0.5);
    for (let x = m.x - 1; x <= m.x + 1; x++) for (let z = m.z - 1; z <= m.z + 1; z++) { soft(x, g, z, m.id); put(x, g - 1, z, B.DIRT); for (let y = g + 1; y < g + 4; y++) put(x, y, z, 0); }
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) soft(m.x + dx, g + 1, m.z + dz, m.id);
    put(m.x, g - 1, m.z, B.CHEST);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(m.x + dx, g - 1, m.z + dz, B.STONE);
    put(m.x, g - 2, m.z, B.STONE);
    E.mounds.push({ ...m, g, chest: [m.x, g - 1, m.z] });
    spots.push([m.x + 0.5, m.z + 0.5, 3.5]);
    places.push({ id: m.id, needs: 'dig', box: { x0: m.x - 3, x1: m.x + 3, y0: g - 2, y1: g + 4, z0: m.z - 3, z1: m.z + 3 } });
  }
  for (const c of CAVES) { // a rock lump of stone: walls 1 thick, a room inside, the mouth in the south face (2 wide, 2 tall) at x + 1..2
    const g = heightAt(c.x + c.w / 2, c.z + c.d / 2);
    for (let x = c.x; x < c.x + c.w; x++) for (let z = c.z; z < c.z + c.d; z++) {
      put(x, g, z, B.STONE); // (its floor, at the ground's level)
      for (let y = g + 1; y <= g + c.h; y++) {
        const wall = x === c.x || x === c.x + c.w - 1 || z === c.z || z === c.z + c.d - 1 || y === g + c.h;
        put(x, y, z, wall ? (y === g + c.h && (x + z) % 3 === 0 ? B.MUD : B.STONE) : 0);
      }
    }
    for (let x = c.x - 2; x < c.x + c.w + 2; x++) for (let z = c.z + c.d; z < c.z + c.d + 3; z++) for (let y = g + 1; y < g + 4; y++) put(x, y, z, 0); // (room in front)
    const mx = c.x + 1, mz = c.z + c.d - 1; // the mouth: x mx..mx+1, y g+1..g+2, z mz (the south wall); the boulder fills it and the cell behind
    for (let x = mx; x <= mx + 1; x++) for (let y = g + 1; y <= g + 2; y++) put(x, y, mz, 0);
    put(c.x + c.w - 2, g + 1, c.z + 1, B.CHEST); // (in the far corner, away from where the boulder goes)
    const b = { id: c.id, home: [mx, g + 1, mz - 1], size: 2, cave: c };
    E.caves.push({ ...c, g, boulder: b });
    spots.push([c.x + c.w / 2, c.z + c.d / 2, 7]);
    places.push({ id: c.id, needs: 'push', box: { x0: c.x - 2, x1: c.x + c.w + 1, y0: g - 1, y1: g + c.h + 1, z0: c.z, z1: c.z + c.d + 3 } });
  }
  { // the Warm-or-Cold Dig: 9 x 9 soft earth two deep, stone under it, a stone rim round it, the case north of it
    const P = DIG_PATCH, g = heightAt(P.x0 + 4.5, P.z0 + 4.5);
    for (let x = P.x0 - 1; x <= P.x0 + P.n; x++) for (let z = P.z0 - 1; z <= P.z0 + P.n; z++) {
      const rim = x < P.x0 || z < P.z0 || x >= P.x0 + P.n || z >= P.z0 + P.n;
      put(x, g - 2, z, B.STONE);
      if (rim) { put(x, g - 1, z, B.STONE); put(x, g, z, B.STONE_BRICKS); } else { soft(x, g - 1, z, 'patch'); soft(x, g, z, 'patch'); }
    }
    const cg = heightAt(P.case.x + 0.5, P.case.z + 0.5), { cells, front } = caseCells(P.case, cg);
    for (const [x, y, z, id] of cells) put(x, y, z, id);
    E.patch = { ...P, g, caseG: cg, front };
    spots.push([P.x0 + P.n / 2, P.z0 + P.n / 2 - 1.5, 8]);
    places.push({ id: 'digpatch', needs: 'dig', box: { x0: P.x0 - 3, x1: P.x0 + P.n + 2, y0: g - 3, y1: g + 5, z0: P.case.z - 2, z1: P.z0 + P.n + 2 } });
  }
  { // the Ball Garden: a stone floor, a low wall (1 high: you hop over it, a ball never), posts (2 high), holes (1 deep), the case north of it
    const G = GARDEN, g = heightAt(G.x0 + 4.5, G.z0 + 4.5);
    for (let x = G.x0 - 1; x <= G.x0 + G.n; x++) for (let z = G.z0 - 1; z <= G.z0 + G.n; z++) {
      const wall = x < G.x0 || z < G.z0 || x >= G.x0 + G.n || z >= G.z0 + G.n; // (no gate: the wall is one block, you hop over it; a ball never)
      put(x, g, z, B.STONE_BRICKS); put(x, g - 1, z, B.STONE);
      for (let y = g + 1; y < g + 4; y++) put(x, y, z, 0);
      if (wall) put(x, g + 1, z, B.COBBLE);
    }
    for (const [u, v] of G.posts) { put(G.x0 + u, g + 1, G.z0 + v, B.STONE); put(G.x0 + u, g + 2, G.z0 + v, B.STONE); }
    for (const [u, v] of G.holes) put(G.x0 + u, g, G.z0 + v, 0);
    const cg = heightAt(G.case.x + 0.5, G.case.z + 0.5), { cells, front } = caseCells(G.case, cg);
    for (const [x, y, z, id] of cells) put(x, y, z, id);
    E.garden = { ...G, g, caseG: cg, front };
    spots.push([G.x0 + G.n / 2, G.z0 + G.n / 2 - 1.5, 9]);
    places.push({ id: 'garden', needs: 'push', box: { x0: G.x0 - 2, x1: G.x0 + G.n + 1, y0: g - 2, y1: g + 5, z0: G.case.z - 2, z1: G.z0 + G.n + 2 } });
  }
  return places;
}

// A boulder or a ball: its cells are PROP; `at` is its lowest, west-most, north-most cell
class Rock {
  constructor(o, kind) { Object.assign(this, o); this.kind = kind; this.at = o.home.slice(); this.from = null; this.k = 1; this.push = 0; }
  cells(at = this.at) { const s = this.size, out = []; for (let dx = 0; dx < s; dx++) for (let dy = 0; dy < s; dy++) for (let dz = 0; dz < s; dz++) out.push([at[0] + dx, at[1] + dy, at[2] + dz]); return out; }
}

// The rules, one step after the player moved. set(x, y, z, id): a live block (LiveCells in the game). -> events
// [{ kind: 'dug' | 'heavy' | 'push' | 'roll' | 'drop' | 'case' | 'warm' | 'found' | 'rumble' | 'home', ... }]
export class EarthRun {
  constructor(world, set) {
    this.w = world; this.set = set; this.t = 0; this.events = []; this.log = []; // (log: every event, for the drawing: wobblelive.js Earthworks)
    const E = world.earth;
    this.dug = new Map(); // index -> [x, y, z] soft cells dug out (they come back when you are away)
    this.boulders = (E?.caves ?? []).map(c => new Rock({ ...c.boulder, cave: c.id }, 'boulder'));
    const G = E?.garden;
    this.balls = G ? G.balls.map(([u, v], i) => new Rock({ id: 'ball' + (i + 1), home: [G.x0 + u, G.g + 1, G.z0 + v], size: 1 }, 'ball')) : [];
    this.holes = G ? G.holes.map(([u, v]) => ({ x: G.x0 + u, z: G.z0 + v, full: null })) : [];
    this.gardenOpen = false; this.outT = 0; this.patchOpen = false;
    this.round = 0; this.holesDug = []; this.digsLeft = DIG_PATCH.digs; this.rumble = null; this.patchAway = 0; this.found = false;
    this.reset();
  }
  // everything back as built (a new run on the same world: a reload of the live part, each bot try)
  reset() {
    const w = this.w, G = this.garden, P = this.patch;
    for (const [i, th] of [...(w.things ?? [])]) {
      if (th.rock) { w.things.delete(i); const y = Math.floor(i / (w.W * w.D)), r = i - y * w.W * w.D; this.set(r % w.W, y, Math.floor(r / w.W), B.AIR); }
      else if (th.kind === 'soft') { const y = Math.floor(i / (w.W * w.D)), r = i - y * w.W * w.D; if (w.data[i] !== SOFT) this.set(r % w.W, y, Math.floor(r / w.W), SOFT); }
    }
    for (const h of this.holes) this.set(h.x, G.g, h.z, B.AIR);
    for (const C of [G, P]) if (C) for (const [x, y, z] of C.front) this.set(x, y, z, B.GLASS);
    for (const r of [...this.boulders, ...this.balls]) { r.at = r.home.slice(); r.from = null; r.k = 1; r.roll = null; this.place(r, r.at); }
  }
  get patch() { return this.w.earth?.patch; }
  get garden() { return this.w.earth?.garden; }
  place(r, at, old = null) {
    const things = this.w.things;
    if (old) for (const [x, y, z] of r.cells(old)) { things.delete(this.w.index(x, y, z)); this.set(x, y, z, B.AIR); }
    r.at = at.slice();
    for (const [x, y, z] of r.cells()) { things.set(this.w.index(x, y, z), { kind: r.kind, rock: r }); this.set(x, y, z, PROP); }
  }
  // a dig at the cell (the big button). abilities = the creature you are's. -> true when something happened
  dig(cell, abilities) {
    const w = this.w, th = cell && w.things?.get(w.index(cell.x, cell.y, cell.z));
    if (!th || th.kind !== 'soft') return false;
    if (!(abilities || []).includes('dig')) { this.events.push({ kind: 'heavy', what: 'soft' }); return true; }
    const P = this.patch;
    if (th.group === 'patch' && P) return this.digPatch(cell);
    this.clear(cell.x, cell.y, cell.z);
    this.events.push({ kind: 'dug', x: cell.x, y: cell.y, z: cell.z });
    return true;
  }
  clear(x, y, z) { const i = this.w.index(x, y, z); this.dug.set(i, [x, y, z]); this.set(x, y, z, B.AIR); }
  digPatch(cell) {
    const P = this.patch, u = cell.x - P.x0, v = cell.z - P.z0;
    if (this.rumble != null || this.found) return true;
    for (const y of [P.g, P.g - 1]) if (this.w.get(cell.x, y, cell.z) === SOFT) this.clear(cell.x, y, cell.z);
    const [ku, kv] = keyOf(this.round), level = warmth(u, v, ku, kv);
    if (level === 0) {
      this.found = true; this.patchOpen = true;
      for (const [x, y, z] of P.front) this.set(x, y, z, B.AIR);
      this.events.push({ kind: 'found', x: cell.x, y: P.g - 1, z: cell.z }, { kind: 'case', where: 'patch' });
      return true;
    }
    this.holesDug.push([u, v, level]);
    this.digsLeft--;
    this.events.push({ kind: 'warm', x: cell.x, y: P.g - 1, z: cell.z, level, left: this.digsLeft });
    if (this.digsLeft <= 0) { this.rumble = this.t; this.events.push({ kind: 'rumble' }); }
    return true;
  }
  // the patch shuts: its holes fill, the key moves (a new round), the case shuts
  refillPatch() {
    const P = this.patch;
    for (const [i, [x, y, z]] of [...this.dug]) if (this.w.things.get(i)?.group === 'patch') { this.set(x, y, z, SOFT); this.dug.delete(i); }
    if (this.patchOpen) for (const [x, y, z] of P.front) this.set(x, y, z, B.GLASS);
    this.patchOpen = false; this.found = false; this.round++; this.holesDug = []; this.digsLeft = DIG_PATCH.digs; this.rumble = null;
  }
  step(p, dt) {
    this.t += dt;
    const ev = this.events; this.events = [];
    const abilities = p.be?.abilities ?? [];
    // pushing: walk into a boulder or a ball
    const hit = walkedIntoRock(this.w, p);
    for (const r of [...this.boulders, ...this.balls]) if (r !== hit?.rock) r.push = 0;
    if (hit && !hit.rock.from) {
      const r = hit.rock;
      r.push += dt;
      if (!abilities.includes('push')) { if (r.push > 0.5) { ev.push({ kind: 'heavy', what: r.kind }); r.push = -9; } }
      else if (r.push >= PUSH.hold) { r.push = 0; this.shove(r, hit.dir, p, ev); }
    }
    // moving rocks (a boulder's one block, a ball's roll)
    for (const r of [...this.boulders, ...this.balls]) if (r.from) {
      r.k = Math.min(1, r.k + dt / (r.kind === 'ball' ? PUSH.ball : PUSH.move));
      if (r.k >= 1) { r.from = null; if (r.kind === 'ball' && r.roll) this.roll(r, p, ev); }
    }
    // the garden: both holes full -> the case opens; walk out and the balls roll home
    const G = this.garden;
    if (G) {
      const inside = p.pos.x > G.x0 - 1.6 && p.pos.x < G.x0 + G.n + 1.6 && p.pos.z > G.case.z - 2.5 && p.pos.z < G.z0 + G.n + 1.6;
      this.outT = inside ? 0 : this.outT + dt;
      const full = this.holes.every(h => h.full);
      if (full && !this.gardenOpen) { this.gardenOpen = true; for (const [x, y, z] of G.front) this.set(x, y, z, B.AIR); ev.push({ kind: 'case', where: 'garden' }); }
      if (this.outT > PUSH.leave && this.balls.some(b => b.at.join() !== b.home.join() || b.from)) {
        for (const b of this.balls) for (const [x, y, z] of b.cells()) { this.w.things.delete(this.w.index(x, y, z)); this.set(x, y, z, B.AIR); }
        for (const b of this.balls) { b.roll = null; b.from = null; b.k = 1; this.place(b, b.home); }
        for (const h of this.holes) { if (h.full) this.set(h.x, G.g, h.z, B.AIR); h.full = null; }
        if (this.gardenOpen) for (const [x, y, z] of G.front) this.set(x, y, z, B.GLASS);
        this.gardenOpen = false;
        ev.push({ kind: 'home', where: 'garden' });
      }
    }
    // the patch: a rumble refills it; walking away (or the found key, once you leave) starts a new round
    const P = this.patch;
    if (P) {
      if (this.rumble != null && this.t - this.rumble > 1.2) this.refillPatch();
      const near = p.pos.x > P.x0 - 4 && p.pos.x < P.x0 + P.n + 4 && p.pos.z > P.case.z - 4 && p.pos.z < P.z0 + P.n + 4;
      this.patchAway = near ? 0 : this.patchAway + dt;
      if (this.patchAway > 3 && (this.holesDug.length || this.found)) this.refillPatch();
    }
    // far away: dug mounds fill again and boulders roll home
    const far = r => Math.hypot(p.pos.x - r.at[0], p.pos.z - r.at[2]) > PUSH.away;
    for (const r of this.boulders) {
      if (r.at.join() === r.home.join() || !far(r)) { r.awayT = 0; continue; }
      if ((r.awayT = (r.awayT ?? 0) + dt) > PUSH.home) { r.from = null; r.k = 1; this.place(r, r.home, r.at); r.awayT = 0; }
    }
    for (const [i, [x, y, z]] of [...this.dug]) {
      const th = this.w.things.get(i);
      if (th?.group === 'patch') continue;
      if (Math.hypot(p.pos.x - x, p.pos.z - z) > PUSH.away + 4) { this.set(x, y, z, SOFT); this.dug.delete(i); }
    }
    this.log.push(...ev); if (this.log.length > 64) this.log.splice(0, this.log.length - 64);
    return ev;
  }
  free(x, y, z, p) { return this.w.get(x, y, z) === B.AIR && !p?.overlapsBlock?.(x, y, z); }
  shove(r, dir, p, ev) {
    const [dx, dz] = dir, to = [r.at[0] + dx, r.at[1], r.at[2] + dz];
    const ok = r.cells(to).every(([x, y, z]) => (r.cells().some(c => c[0] === x && c[1] === y && c[2] === z) || this.free(x, y, z, p)));
    const under = r.cells(to).filter(c => c[1] === to[1]).every(([x, y, z]) => this.w.isSolid(x, y - 1, z) || this.holeAt(x, z));
    if (!ok || !under) return;
    if (r.kind === 'ball') { r.roll = dir; ev.push({ kind: 'roll', id: r.id }); this.roll(r, p, ev, true); return; }
    this.move(r, to);
    ev.push({ kind: 'push', id: r.id });
  }
  move(r, to) { const old = r.at.slice(); this.place(r, to, old); r.from = old; r.k = 0; }
  holeAt(x, z) { return this.holes.find(h => !h.full && h.x === x && h.z === z) ?? null; }
  // a ball rolls on one cell at a time until something stops it; over an empty hole it drops in and fills it
  roll(r, p, ev, first = false) {
    const [dx, dz] = r.roll, [x, y, z] = r.at;
    const h = !first && this.holeAt(x, z);
    if (h && this.w.get(x, y - 1, z) === B.AIR) { h.full = r.id; r.roll = null; this.move(r, [x, y - 1, z]); ev.push({ kind: 'drop', id: r.id }); return; }
    if (!this.free(x + dx, y, z + dz, p)) { r.roll = null; ev.push({ kind: 'bump', id: r.id }); return; }
    this.move(r, [x + dx, y, z + dz]);
  }
  info() {
    return {
      dug: this.dug.size, boulders: this.boulders.map(b => b.at.join()), balls: this.balls.map(b => b.at.join()), holesFull: this.holes.filter(h => h.full).length,
      gardenOpen: this.gardenOpen, patchOpen: this.patchOpen, round: this.round, digsLeft: this.digsLeft, holesDug: this.holesDug.map(h => h.join(':')),
    };
  }
}

// walking into a rock (things.js walkedInto, for rocks only)
function walkedIntoRock(world, p) {
  const w = p.wish;
  if (!w || !p.hitWall) return null;
  const ax = Math.abs(w[0]) >= Math.abs(w[1]), dir = ax ? [Math.sign(w[0]), 0] : [0, Math.sign(w[1])];
  const x = Math.floor(p.pos.x + dir[0] * (p.halfW + 0.12)), z = Math.floor(p.pos.z + dir[1] * (p.halfW + 0.12));
  for (const dy of [0.1, 1.1]) {
    const th = world.things?.get(world.index(x, Math.floor(p.pos.y + dy), z));
    if (th?.rock) return { rock: th.rock, dir };
  }
  return null;
}
