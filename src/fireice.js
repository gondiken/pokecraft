// Chapter 3 step D, the third pair (plans/chapter3-abilities-build.md "Overnight 2026-11-15/16"; ?preview only, Wobbleland): BURN and FREEZE.
// Pure, Node-runnable (wayland.js builds it into the land, its Trials steps FireIceRun; tests/waysbots.mjs plays it with the real Player).
// Both act on a thing you look at, with the big button (things.js `aim`): "Burn!" / "Freeze!" only when the creature you are can.
//   Burn (Fire, Toxic, Drake): thorns (kind `thorns`, a bramble drawn over the hidden solid block) burn away; an ice wall (kind `icewall`)
//     melts. They grow back / freeze again when you are far away. Natural spots: THICKETS (hedge huts with a bramble door and a chest inside)
//     and ICE_HUTS (snow huts on Slippy Lake's shore with a door of thick ice).
//   The Windy Bramble Tunnel (TUNNEL, the deeper Burn place): a hedge tunnel with five bramble plugs and a chest at the end. The wind
//     along it takes turns blowing in and out, with a calm between (a windsock at the mouth and leaves blowing say which way): fire
//     follows the wind. A plug takes a second to burn through; if the wind blows at you meanwhile the flames blow back: whoosh, you are
//     puffed back to the mouth and the brambles grow back. Skill: light it the moment the windsock swings in; lighting it at once fails.
//   Freeze (Ice): any water you look at freezes over (a few blocks round it, its top), and a waterfall (kind `falls`) freezes into a column
//     of rough ice. Frozen water stops: no current, you walk on it. It thaws after a while (or when you are far away).
//     Natural spots: RAPIDS (a stream rushing out of a low stone tunnel: nobody gets up it, not even a swimmer, and the spray pushes a flier
//     back; frozen, you walk up it to the chest at the end).
//   The Frozen Falls (FALLS, the deeper Freeze place, two abilities together): a waterfall down an ice cliff taller than the cloud layer,
//     a chest on top. Frozen, the falls are rough ice a climber can climb (the cliff's smooth ice it cannot); it melts again after `hold`
//     seconds, from the top down. Skill: freeze it, swap to a climber at once, climb without stopping.
import { B } from './blocks.js';

export const PROP = B.HOUSE_PROP; // (a bramble or the frozen falls: solid, never drawn; models show them)
export const THICKETS = [{ id: 'thicket1', x: 66, z: 76 }, { id: 'thicket2', x: 156, z: 74 }, { id: 'thicket3', x: 60, z: 2 }]; // hedge huts 5 x 5, the door south
export const ICE_HUTS = [{ id: 'icehut1', x: 4, z: 138 }, { id: 'icehut2', x: 24, z: 73 }]; // snow huts 5 x 5, the door east
export const RAPIDS = [ // a stream in a stone tunnel running south (out of the mouth at z1) from its spring at z0; the chest on a ledge at the spring
  { id: 'rapids1', x: 8, z0: 40, z1: 54 }, { id: 'rapids2', x: 196, z0: 46, z1: 60 },
];
export const RAPID = { speed: 12, deep: 2, air: 2 }; // blocks a second (a Swim creature sprinting at the top makes 10.5, diving 10.5 with kicks: never)
export const TUNNEL = { x0: 140, x1: 160, z: 16, plugs: [143, 146, 149, 152, 155] }; // the hedge tunnel runs east from its mouth at x0; plugs at those x; the chest room after x1
export const WIND = { calm: 0.6, min: 2.8, max: 3.6, burn: 1.0 }; // a calm, then a blow of min..max s, the blows taking turns in and out; a plug takes `burn` s to burn through (a wind blowing at you meanwhile blows it back)
export const FALLS = { x: 40, z: 4, w: 7, d: 5, h: 18, fx: 43, hold: 8, melt: 0.12 }; // the ice cliff (w x d, h tall), the falls down its south face at x fx; frozen for `hold` s, then a row melts every `melt` s from the top
export const FREEZE = { r: 2.2, thaw: 25, far: 22 }; // freezing water: the top within r of where you look; it thaws after `thaw` s or when you are `far` away
export const BURN = { regrow: 18 }; // burnt brambles and melted ice grow back when you are this far away
// The flat ground under the places (wayland.js areaFlat)
export const FLATS2 = [
  ...THICKETS.map(t => ({ x0: t.x - 3, x1: t.x + 7, z0: t.z - 3, z1: t.z + 8 })),
  { x0: TUNNEL.x0 - 6, x1: TUNNEL.x1 + 6, z0: TUNNEL.z - 6, z1: TUNNEL.z + 6 },
  ...RAPIDS.map(r => ({ x0: r.x - 5, x1: r.x + 7, z0: r.z0 - 3, z1: r.z1 + 7 })),
  { x0: FALLS.x - 4, x1: FALLS.x + FALLS.w + 3, z0: FALLS.z - 3, z1: FALLS.z + FALLS.d + 8 },
];

const hash = n => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
// The wind in the tunnel at time t: +1 = blowing in (east, away from you as you go in), -1 = out (at you), 0 = calm. A cycle: calm, blow,
// calm, blow, each blow's way and length from the cycle's number (the same on every device).
export function windAt(t) {
  let s = 0;
  for (let k = 0; k < 100000; k++) {
    const len = WIND.min + (hash(k) % 1000) / 1000 * (WIND.max - WIND.min), way = k % 2 ? -1 : 1;
    if (t < s + WIND.calm) return { way: 0, left: s + WIND.calm - t, next: way };
    if (t < s + WIND.calm + len) return { way, left: s + WIND.calm + len - t };
    s += WIND.calm + len;
  }
  return { way: 0, left: 1 };
}

const at = (w, x, y, z) => w.index(x, y, z);

// The blocks (wayland.js waysLand). Registers world.things, world.fireice, world.colourSpots; returns the places (where trying counts).
export function fireIceLand(world, put, heightAt) {
  const things = world.things ??= new Map(), spots = world.colourSpots ??= [], places = [];
  const F = world.fireice = { thickets: [], huts: [], rapids: [], tunnel: null, falls: null };
  const thing = (x, y, z, o) => things.set(at(world, x, y, z), o);
  const bramble = (x, y, z, group, tunnel = false) => { put(x, y, z, PROP); thing(x, y, z, { kind: 'thorns', group, tunnel }); };
  for (const t of THICKETS) { // a hedge hut: walls and roof of hedge, 5 x 5 x 4, a bramble door (1 wide, 2 tall) in the south wall, a chest inside
    const g = heightAt(t.x + 2.5, t.z + 2.5);
    for (let x = t.x; x < t.x + 5; x++) for (let z = t.z; z < t.z + 5; z++) {
      put(x, g, z, B.GRASS);
      for (let y = g + 1; y <= g + 4; y++) put(x, y, z, x === t.x || x === t.x + 4 || z === t.z || z === t.z + 4 || y === g + 4 ? B.HEDGE : 0);
    }
    for (let y = g + 1; y <= g + 2; y++) bramble(t.x + 2, y, t.z + 4, t.id);
    put(t.x + 2, g + 1, t.z + 1, B.CHEST);
    F.thickets.push({ ...t, g });
    spots.push([t.x + 2.5, t.z + 2.5, 5]);
    places.push({ id: t.id, needs: 'burn', box: { x0: t.x - 2, x1: t.x + 6, y0: g - 1, y1: g + 6, z0: t.z - 2, z1: t.z + 7 } });
  }
  for (const h of ICE_HUTS) { // a snow hut: walls and roof of snow, a door of thick ice (1 wide, 2 tall) in the east wall, a chest inside
    const g = heightAt(h.x + 2.5, h.z + 2.5);
    for (let x = h.x; x < h.x + 5; x++) for (let z = h.z; z < h.z + 5; z++) {
      put(x, g, z, B.SNOW);
      for (let y = g + 1; y <= g + 4; y++) put(x, y, z, x === h.x || x === h.x + 4 || z === h.z || z === h.z + 4 || y === g + 4 ? B.SNOW : 0);
    }
    for (let y = g + 1; y <= g + 2; y++) { put(h.x + 4, y, h.z + 2, B.ICE); thing(h.x + 4, y, h.z + 2, { kind: 'icewall', group: h.id }); }
    for (let x = h.x + 5; x < h.x + 8; x++) for (let z = h.z + 1; z <= h.z + 3; z++) { put(x, g, z, B.SNOW); for (let y = g + 1; y <= g + 3; y++) put(x, y, z, 0); } // (a step of snow in front)
    put(h.x + 1, g + 1, h.z + 2, B.CHEST);
    F.huts.push({ ...h, g });
    spots.push([h.x + 2.5, h.z + 2.5, 5]);
    places.push({ id: h.id, needs: 'burn', box: { x0: h.x - 1, x1: h.x + 8, y0: g - 1, y1: g + 6, z0: h.z - 2, z1: h.z + 6 } });
  }
  for (const r of RAPIDS) { // the stream: 3 wide (x - 1 .. x + 1), water RAPID.deep deep, RAPID.air air over it, a stone roof; a dry ledge at the spring
    const g = heightAt(r.x + 0.5, r.z1 + 3), wTop = g; // (the water's top is level with the ground outside: it spills out of the mouth)
    for (let x = r.x - 2; x <= r.x + 2; x++) for (let z = r.z0 - 1; z <= r.z1; z++) {
      const side = x === r.x - 2 || x === r.x + 2 || z === r.z0 - 1;
      for (let y = wTop - RAPID.deep; y <= wTop + RAPID.air + 2; y++) put(x, y, z, side || y === wTop - RAPID.deep || y >= wTop + RAPID.air + 1 ? B.STONE : y <= wTop ? B.WATER : 0);
    }
    for (let x = r.x - 1; x <= r.x + 1; x++) for (let z = r.z0; z <= r.z0 + 1; z++) { for (let y = wTop - RAPID.deep + 1; y <= wTop; y++) put(x, y, z, B.STONE); } // (the ledge at the spring: dry stone, level with the water)
    put(r.x, wTop + 1, r.z0, B.CHEST);
    for (let x = r.x - 1; x <= r.x + 1; x++) for (let z = r.z1 + 1; z <= r.z1 + 4; z++) { put(x, wTop - 1, z, B.STONE); put(x, wTop, z, B.WATER); for (let y = wTop + 1; y < wTop + 4; y++) put(x, y, z, 0); } // (it spills out into a shallow run)
    for (let x = r.x - 1; x <= r.x + 1; x++) for (let z = r.z0 + 2; z <= r.z1 + 4; z++) for (let y = wTop - 1; y <= wTop; y++) if (world.get?.(x, y, z) === B.WATER || y === wTop) thing(x, y, z, { kind: 'water', group: r.id });
    F.rapids.push({ ...r, w: wTop });
    spots.push([r.x + 0.5, (r.z0 + r.z1) / 2, 6], [r.x + 0.5, r.z1 + 2, 4]);
    places.push({ id: r.id, needs: 'freeze', box: { x0: r.x - 3, x1: r.x + 3, y0: wTop - 3, y1: wTop + 4, z0: r.z0, z1: r.z1 + 5 } });
  }
  { // the Windy Bramble Tunnel: hedge walls 1 thick round a 1 wide, 2 tall way, a roof; the plugs; a room with the chest at the end
    const T = TUNNEL, g = heightAt((T.x0 + T.x1) / 2, T.z);
    for (let x = T.x0; x <= T.x1 + 4; x++) for (let z = T.z - 2; z <= T.z + 2; z++) {
      put(x, g, z, B.GRASS);
      const room = x > T.x1, inner = room ? Math.abs(z - T.z) <= 1 && x < T.x1 + 4 : z === T.z;
      for (let y = g + 1; y <= g + 3; y++) put(x, y, z, inner && y <= g + 2 ? 0 : (Math.abs(z - T.z) <= 1 || room) ? B.HEDGE : 0);
    }
    for (const px of T.plugs) for (let y = g + 1; y <= g + 2; y++) bramble(px, y, T.z, 'tunnel' + px, true); // (each plug burns on its own)
    put(T.x1 + 3, g + 1, T.z, B.CHEST);
    F.tunnel = { ...T, g };
    spots.push([(T.x0 + T.x1) / 2, T.z, 11]);
    places.push({ id: 'tunnel', needs: 'burn', box: { x0: T.x0 - 4, x1: T.x1 + 5, y0: g - 1, y1: g + 5, z0: T.z - 4, z1: T.z + 4 } });
  }
  { // the Frozen Falls: an ice cliff, the falls (water, 1 wide) down its south face from a spring on top into a pool, the chest on top
    const Fa = FALLS, g = heightAt(Fa.x + 3.5, Fa.z + 2.5), top = g + Fa.h;
    for (let x = Fa.x; x < Fa.x + Fa.w; x++) for (let z = Fa.z; z < Fa.z + Fa.d; z++) for (let y = g + 1; y <= top; y++) put(x, y, z, B.ICE);
    for (let x = Fa.x - 1; x <= Fa.x + Fa.w; x++) for (let z = Fa.z + Fa.d; z <= Fa.z + Fa.d + 4; z++) { put(x, g - 1, z, B.STONE); put(x, g, z, Math.abs(x - Fa.fx) <= 2 && z >= Fa.z + Fa.d + 2 && z <= Fa.z + Fa.d + 3 ? B.WATER : B.SNOW); for (let y = g + 1; y < g + 5; y++) put(x, y, z, 0); } // (a snowy lip under the falls, the pool in front of it)
    const cells = [];
    for (let y = g + 1; y <= top; y++) { put(Fa.fx, y, Fa.z + Fa.d, B.WATER); cells.push([Fa.fx, y, Fa.z + Fa.d]); thing(Fa.fx, y, Fa.z + Fa.d, { kind: 'falls', group: 'falls' }); }
    put(Fa.fx, top, Fa.z + Fa.d - 1, B.WATER); // (the spring on top)
    put(Fa.x + 1, top + 1, Fa.z + 1, B.CHEST);
    F.falls = { ...Fa, g, top, cells };
    spots.push([Fa.x + 3.5, Fa.z + 4, 8]);
    places.push({ id: 'falls', needs: 'freeze', box: { x0: Fa.x - 3, x1: Fa.x + Fa.w + 2, y0: g - 1, y1: top + 2, z0: Fa.z - 2, z1: Fa.z + Fa.d + 6 } });
  }
  return places;
}

// The rapids' push (world.flowAt in their water, world.pushAt for anyone in the spray over it), unless frozen. -> { x, y, z } or null
export function rapidsFlow(world, p) {
  for (const r of world.fireice?.rapids ?? []) {
    if (p.x < r.x - 1 || p.x > r.x + 2 || p.z < r.z0 + 2 || p.z > r.z1 + 4 || p.y < r.w - 2 || p.y > r.w + 2.6) continue;
    if (world.get(Math.floor(p.x), r.w, Math.floor(p.z)) !== B.WATER) return null; // (frozen over: the current stops)
    return { x: (r.x + 0.5 - p.x) * 2, y: 0, z: RAPID.speed };
  }
  return null;
}
// The falls push down whoever is in them (a swimmer cannot swim up a waterfall), unless frozen.
export function fallsFlow(world, p) {
  const Fa = world.fireice?.falls;
  if (!Fa || Math.abs(p.x - Fa.fx - 0.5) > 0.9 || Math.abs(p.z - Fa.z - Fa.d - 0.5) > 0.9 || p.y < Fa.g || p.y > Fa.top + 1) return null;
  if (world.get(Fa.fx, Math.min(Fa.top, Math.max(Fa.g + 1, Math.floor(p.y + 0.5))), Fa.z + Fa.d) !== B.WATER) return null;
  return { x: 0, y: -10, z: 3 };
}

// The rules, one step after the player moved. set(x, y, z, id): a live block (LiveCells in the game). -> events
// [{ kind: 'burnt' | 'melted' | 'frozen' | 'thawed' | 'backfire' | 'smoulder' | 'whoosh' | 'regrow' | 'heavy' | 'falls' | 'melting', ... }]
export class FireIceRun {
  constructor(world, set) {
    this.w = world; this.set = set; this.t = 0; this.events = []; this.log = [];
    this.burnt = new Map();   // index -> { x, y, z, id (what it was), kind, group }
    this.frozen = new Map();  // index -> { x, y, z, t (when) }
    this.fallsT = null;       // when the falls froze (null = running water)
    this.tunnelAway = 0; this.backfire = null; this.burning = null;
    this.reset();
  }
  get tunnel() { return this.w.fireice?.tunnel; }
  get falls() { return this.w.fireice?.falls; }
  // everything back as built (a new run on the same world: a reload of the live part, each bot try): every cell a run changed is kept in
  // world.fireice.memo (index -> [x, y, z, what it was]) so a new run can put it back
  reset() {
    const memo = this.w.fireice ? (this.w.fireice.memo ??= new Map()) : new Map();
    for (const [x, y, z, id] of memo.values()) this.set(x, y, z, id);
    memo.clear(); this.memo = memo;
    this.burnt.clear(); this.frozen.clear();
    const Fa = this.falls;
    if (Fa) for (const [x, y, z] of Fa.cells) this.set(x, y, z, B.WATER);
    this.fallsT = null;
  }
  // the big button on a thing (things.js aimedThing; abilities = the creature you are's). -> true when it did something
  act(cell, abilities) {
    const w = this.w, i = at(w, cell.x, cell.y, cell.z), th = w.things?.get(i) ?? (w.get(cell.x, cell.y, cell.z) === B.WATER ? { kind: 'water' } : null);
    if (!th) return false;
    const can = a => (abilities || []).includes(a);
    if (th.kind === 'thorns' || th.kind === 'icewall') {
      if (!can('burn')) { this.events.push({ kind: 'heavy', what: th.kind }); return true; }
      if (th.tunnel) return this.burnTunnel(cell, th);
      this.burn(cell, th);
      return true;
    }
    if (th.kind === 'falls') {
      if (!can('freeze')) { this.events.push({ kind: 'heavy', what: 'falls' }); return true; }
      this.freezeFalls(); return true;
    }
    if (th.kind === 'water') {
      if (!can('freeze')) return false;
      this.freezeAround(cell); return true;
    }
    return false;
  }
  burn(cell, th) {
    const w = this.w, group = [];
    for (const [i, o] of w.things) if (o.group === th.group && o.kind === th.kind && !this.burnt.has(i)) group.push(i); // (the whole door at once)
    for (const i of group) {
      const y = Math.floor(i / (w.W * w.D)), r = i - y * w.W * w.D, x = r % w.W, z = Math.floor(r / w.W);
      this.burnt.set(i, { x, y, z, id: w.get(x, y, z), kind: th.kind, group: th.group, tunnel: !!th.tunnel });
      if (!this.memo.has(i)) this.memo.set(i, [x, y, z, w.get(x, y, z)]);
      this.set(x, y, z, B.AIR);
    }
    this.events.push({ kind: th.kind === 'icewall' ? 'melted' : 'burnt', x: cell.x, y: cell.y, z: cell.z });
  }
  // the tunnel: fire follows the wind
  burnTunnel(cell, th) {
    if (this.burning || this.backfire != null) return true; // (one fire at a time)
    this.burning = { cell, th, t0: this.t };
    this.events.push({ kind: 'lit', x: cell.x, y: cell.y, z: cell.z });
    return true;
  }
  plugsLeft() { const T = this.tunnel; return T ? T.plugs.filter(px => this.w.get(px, T.g + 1, T.z) === PROP).length : 0; }
  regrowTunnel() {
    for (const [i, b] of [...this.burnt]) if (b.tunnel) { this.set(b.x, b.y, b.z, b.id); this.burnt.delete(i); }
  }
  freezeAround(cell) {
    const w = this.w, r = FREEZE.r, R = Math.ceil(r);
    let y = cell.y; while (w.get(cell.x, y + 1, cell.z) === B.WATER) y++; // (the top of the water there)
    const fallsCell = w.things?.get(at(w, cell.x, y, cell.z))?.kind === 'falls';
    if (fallsCell) { this.freezeFalls(); return; }
    let n = 0;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      if (Math.hypot(dx, dz) > r) continue;
      const x = cell.x + dx, z = cell.z + dz;
      if (w.get(x, y, z) !== B.WATER || w.get(x, y + 1, z) === B.WATER || w.things?.get(at(w, x, y, z))?.kind === 'falls') continue;
      const i = at(w, x, y, z);
      this.frozen.set(i, { x, y, z, t: this.t }); if (!this.memo.has(i)) this.memo.set(i, [x, y, z, B.WATER]); this.set(x, y, z, B.ICE); n++;
    }
    if (n) this.events.push({ kind: 'frozen', x: cell.x, y, z: cell.z, n });
  }
  freezeFalls() {
    const Fa = this.falls;
    if (!Fa || this.fallsT != null) return;
    for (const [x, y, z] of Fa.cells) this.set(x, y, z, PROP);
    this.fallsT = this.t;
    this.events.push({ kind: 'falls', x: Fa.fx, y: Fa.g + 1, z: Fa.z + Fa.d });
  }
  // how many rows of the frozen falls are still ice (from the bottom), at time t
  fallsRows(t = this.t) {
    const Fa = this.falls;
    if (!Fa || this.fallsT == null) return 0;
    const since = t - this.fallsT - Fa.hold;
    return since <= 0 ? Fa.cells.length : Math.max(0, Fa.cells.length - Math.floor(since / Fa.melt) - 1);
  }
  step(p, dt) {
    this.t += dt;
    const ev = this.events; this.events = [];
    const w = this.w;
    // the tunnel: a backfire puffs you back to the mouth and the brambles grow back; leaving it does the same (quietly)
    const T = this.tunnel;
    if (T) {
      if (this.backfire != null && this.t - this.backfire > 0.35) {
        this.backfire = null; this.regrowTunnel();
        p.pos.set(T.x0 - 1.5, T.g + 1, T.z + 0.5); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.climbing = false;
        ev.push({ kind: 'whoosh' });
      }
      const B0 = this.burning;
      if (B0) { // a fire on a plug: it burns through in WIND.burn s unless the wind blows at you meanwhile
        if (windAt(this.t).way < 0) { this.burning = null; this.backfire = this.t; ev.push({ kind: 'backfire', x: B0.cell.x, z: B0.cell.z }); }
        else if (this.t - B0.t0 >= WIND.burn) { this.burning = null; this.burn(B0.cell, B0.th); }
      }
      const inside = p.pos.x > T.x0 - 3 && p.pos.x < T.x1 + 5 && Math.abs(p.pos.z - T.z - 0.5) < 4;
      this.tunnelAway = inside ? 0 : this.tunnelAway + dt;
      if (this.tunnelAway > 3 && [...this.burnt.values()].some(b => b.tunnel)) this.regrowTunnel();
    }
    // the frozen falls melt from the top down
    const Fa = this.falls;
    if (Fa && this.fallsT != null) {
      const rows = this.fallsRows();
      if (!this.meltSaid && this.t - this.fallsT > Fa.hold - 2) { this.meltSaid = true; ev.push({ kind: 'melting' }); }
      Fa.cells.forEach(([x, y, z], k) => { if (k >= rows && w.get(x, y, z) === PROP) this.set(x, y, z, B.WATER); });
      if (rows === 0) { this.fallsT = null; this.meltSaid = false; ev.push({ kind: 'thawed', what: 'falls' }); }
    }
    // frozen water thaws after a while or when you are far away
    for (const [i, f] of [...this.frozen]) if (this.t - f.t > FREEZE.thaw || Math.hypot(p.pos.x - f.x, p.pos.z - f.z) > FREEZE.far) {
      if (p.overlapsBlock?.(f.x, f.y, f.z)) continue;
      this.set(f.x, f.y, f.z, B.WATER); this.frozen.delete(i);
    }
    // burnt brambles and melted ice doors grow back when you are far away
    for (const [i, b] of [...this.burnt]) if (!b.tunnel && Math.hypot(p.pos.x - b.x, p.pos.z - b.z) > BURN.regrow) { this.set(b.x, b.y, b.z, b.id); this.burnt.delete(i); }
    this.log.push(...ev); if (this.log.length > 64) this.log.splice(0, this.log.length - 64);
    return ev;
  }
  info() {
    return { burnt: this.burnt.size, frozen: this.frozen.size, falls: this.fallsT != null, fallsRows: this.fallsRows(), plugs: this.plugsLeft(), wind: windAt(this.t).way };
  }
}
