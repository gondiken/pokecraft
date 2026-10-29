// The Bubble Well's rules (plans/bubble-well.md, "Rework 2026-10-29"), pure: no imports but the shared kind help, Node-runnable. Every
// clock is summed frame time cut into fixed 1/120 s sub-steps, so 60 and 20 frames a second give the same climb. No Math.random anywhere.
// Owner 2026-10-29: "Easy to understand, hard to master. Never forget this rule!"
//  - BubbleField (the Bubble Stairs): Blow! (one press, never held) puts a bubble at ONE place you can always see: two blocks ahead of your
//    feet, just above them, the way you face (looking up or down does not change it). It only works with your feet on something (the
//    ground or a bubble): in the air nothing happens, so jumping and blowing under yourself (the chapter-1 sky-gym pillar) never climbs.
//    A new bubble waits a moment, then floats up: hop on it right away and you gain a little, wait till it has floated up and you gain a
//    lot, wait too long and it is out of reach. The bubble you stand on sinks and pops soon after you land (keep going!). Two bubbles that
//    touch both pop (blowing twice at the same spot wastes soap). Six puffs of soap from ledge to ledge. Drips and winds pop or push them.
//  - Duckling: a sleepy rubber duckling in a bubble that you never hold: Puff! nudges it the way you look, harder the closer you stand
//    (an arrow shows where it will glide). It glides like a puck, a current carries it, a gust lane blows now and then, a thorn pops its
//    bubble (it plops back onto its island), and the bubble only lasts a while: then the duckling wakes up and waddles home to its island.
//  - Ride: the Chimney Ride inside a big bubble that always sinks a little: every tap is a puff up (no hold), the stick steers. Spike
//    plates with one gold-ringed gap, a fan, a spinning bar near the top; a pop puts you back at the last fizz star.
//  - bankShot (Captain Suds' shields): from a gold pad, Blow! sends a bubble flying flat the way you look; it bounces off the pink soap
//    cushions and pops on the foam guards that hide the shield. Bounce it into the shield. A dotted line shows the way to the first bounce.
// The kind help after misses comes only from kindhelp.js (bubbleHelp maps it onto each game's levers); a rematch's `hard` is separate.
import { kindHelp } from './kindhelp.js';

export const STEP = 1 / 120;
// r radius; ahead how far in front of your feet (flat, the way you face) a new bubble appears; step its top over your feet when it appears
// (one blown at a floor is lifted up to `lift` to sit on it); hang (s) it waits there, then rises `rise` blocks a second while free; life (s)
// while free; sink while you stand on it, stand (s) from landing to its pop, warn (s) of wobble before that pop; max at once; soap puffs;
// bounce (blocks: the jump off a bubble); wall (s of rubbing a wall before it pops); catch (how far from its middle your feet may land);
// onTop (how far you may walk on it); scoop (your feet from `scoop` over its middle up to its top also land you on it: a hop up into the
// top of a bubble lifts you onto it, a hop that only reaches its lower half does not).
export const BUBBLE = { r: 0.55, ahead: 2.0, step: 0.2, lift: 1.2, hang: 0.3, rise: 1.0, life: 4, sink: 0.3, stand: 1.5, warn: 0.5, max: 2, soap: 6, bounce: 1.6, wall: 0.2, catch: 0.8, onTop: 0.45, scoop: 0.2 };
// How high your feet get over where they are now: a jump from the ground (the Player's jump speed 8.6), a Bounce off a bubble, or what is
// left of a jump in the air (vy). g = the world's gravity.
export const JUMP = 8.6;
export const hopHeight = ({ ground = false, onBubble = false, vy = 0, g = 1 } = {}) =>
  onBubble ? BUBBLE.bounce : ground ? JUMP * JUMP / (2 * 28 * g) : Math.max(0, vy) ** 2 / (2 * 28 * g);
// Do your feet land on bubble b? feet / prev: the feet's height now and a frame ago; (x, z) where you are; vy your speed up. Two ways:
//  - from above: the feet came down through its top since the last frame (any frame rate);
//  - from inside: the feet are in its top part (from `scoop` over its middle to its top), you are not shooting up fast.
// inside = false: only from above (the bubble you just stepped or bounced off never scoops you up again).
export function landsOn(b, { x, z, feet, prev = feet, vy = 0, inside = true }) {
  if (Math.hypot(x - b.x, z - b.z) > BUBBLE.catch) return false;
  const top = b.y + BUBBLE.r;
  if (vy <= 0.5 && prev >= top - 0.12 && feet <= top + 0.15 && feet >= top - 1.2) return true;
  return inside && vy <= 6 && feet >= b.y + BUBBLE.scoop && feet <= top + 0.15;
}
// Where Blow! puts a bubble from feet (x, y, z) facing look (only its flat part counts): the middle, before a floor lifts it.
export function blowSpot(feet, look) {
  const l = Math.hypot(look.x, look.z);
  if (l < 1e-6) return null;
  return { x: feet.x + look.x / l * BUBBLE.ahead, y: feet.y + BUBBLE.step - BUBBLE.r, z: feet.z + look.z / l * BUBBLE.ahead };
}
// A rematch (you hold the star) is a new climb, a bit harder (separate from the kind help).
export const HARD = { life: 0.85, stand: 0.85, drip: 1.25, rise: 1.15, current: 1.3, friction: 0.85, duckLife: 0.85, gust: 1.2, sink: 1.2, bar: 1.2, catch: 0.85, slide: 1.2 };

// The ONE kind help of the Bubble Well's games: kindHelp(misses) mapped onto each game's levers (slow = 1 - e, more = 1 + e, e <= 0.10).
//   stairs  (a fall from a bubble)               a new bubble rises x slow (a longer moment to hop), the time you may stand on one x more,
//                                                drips x slow
//   ducks   (a duckling's bubble popped)         currents and gusts x slow, the glide stops x more sooner, the nest x more wider, the
//                                                bubble lasts x more
//   chimney (the ride's bubble popped)           the sink x slow, the gaps x more wider, the bar x slow
//   shields (a shot that missed)                 the shield x more bigger, the sliding cushion x slow
export function bubbleHelp(misses) {
  const k = kindHelp(misses);
  return { ...k, rise: k.slow, life: k.more, stand: k.more, drip: k.slow, current: k.slow, gust: k.slow, friction: k.more, nest: k.more, duckLife: k.more, sink: k.slow, gap: k.more, bar: k.slow, catch: k.more, slide: k.slow };
}
const H = (help, key) => (typeof help === 'object' && help ? help[key] ?? 1 : bubbleHelp(help || 0)[key]);

// Steps a clock in fixed sub-steps: fn(h) is called for each whole STEP of (acc + dt); returns the new leftover.
function substeps(acc, dt, fn) {
  acc += Math.max(0, Math.min(dt, 0.25));
  while (acc >= STEP - 1e-12) { acc -= STEP; fn(STEP); }
  return acc;
}

/* ------------------------------------------------------------------ the bubbles you blow */
// A drip from a spout over a shaft: { x, z, top, bottom, period, phase, speed }. Its y at clock t, or null while it is not falling.
// f > 1 makes drips faster and more often (a rematch), f < 1 slower and fewer (the kind help).
export function dripAt(d, t, f = 1) {
  const P = d.period / f, u = (((t + d.phase) % P) + P) % P, y = d.top - d.speed * f * u;
  return y >= d.bottom ? y : null;
}
// Does a sphere at (x, y, z) with radius r touch a solid cell? solid(x, y, z) for whole cells.
export function sphereTouches(solid, x, y, z, r) {
  for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++) for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++) {
    if (!solid(cx, cy, cz)) continue;
    const nx = Math.max(cx, Math.min(cx + 1, x)), ny = Math.max(cy, Math.min(cy + 1, y)), nz = Math.max(cz, Math.min(cz + 1, z));
    if ((nx - x) ** 2 + (ny - y) ** 2 + (nz - z) ** 2 < r * r) return true;
  }
  return false;
}
const inBox = (v, x, y, z) => x >= v.x0 && x < v.x1 + 1 && z >= v.z0 && z < v.z1 + 1 && y >= v.y0 && y < v.y1 + 1;

export class BubbleField {
  // help = misses (or a bubbleHelp object); hard = a rematch
  constructor({ help = 0, hard = false } = {}) {
    this.list = []; this.soap = BUBBLE.soap; this.clock = 0; this.acc = 0; this.n = 0;
    this.help = help; this.hard = hard;
  }
  get life() { return BUBBLE.life * H(this.help, 'life') * (this.hard ? HARD.life : 1); }
  get standLife() { return BUBBLE.stand * H(this.help, 'stand') * (this.hard ? HARD.stand : 1); }
  get rise() { return BUBBLE.rise * H(this.help, 'rise') * (this.hard ? HARD.rise : 1); }
  get drip() { return H(this.help, 'drip') * (this.hard ? HARD.drip : 1); }
  // Where Blow! would put a bubble now (null: no room there), from feet (x, y, z) facing look. solid(x, y, z) = a whole cell is solid.
  spot(feet, look, solid = () => false) {
    const s = blowSpot(feet, look);
    if (!s) return null;
    const R = BUBBLE.r + 0.02, y0 = s.y;
    if (sphereTouches(solid, s.x, s.y, s.z, R)) { // at a floor: it sits just on top of it (never through a wall or a ceiling)
      while (s.y < y0 + BUBBLE.lift && sphereTouches(solid, s.x, s.y, s.z, R)) s.y += 0.05;
      if (sphereTouches(solid, s.x, s.y, s.z, R)) s.y = y0;
    }
    return sphereTouches(solid, s.x, s.y, s.z, BUBBLE.r * 0.8) ? null : s;
  }
  // Blow! from your feet facing `look`. footing: 'ground' | 'bubble' | null (in the air: nothing happens, no soap used).
  // -> { ok, b?, why?, popped?, burst? } (burst: the bubbles that touched the new one; they all pop and the soap is used)
  blow(feet, look, solid = () => false, footing = 'ground') {
    if (!footing) return { ok: false, why: 'air' };
    if (this.soap <= 0) return { ok: false, why: 'soap' };
    const s = this.spot(feet, look, solid);
    if (!s) return { ok: false, why: 'wall' };
    const touch = this.list.filter(b => !b.stand && Math.hypot(b.x - s.x, b.y - s.y, b.z - s.z) < BUBBLE.r * 2);
    this.soap--;
    if (touch.length) { for (const b of touch) this.pop(b); return { ok: false, why: 'touch', burst: touch, at: s }; }
    let popped = null;
    if (this.list.length >= BUBBLE.max) { // the oldest one you are not standing on makes room
      const old = this.list.find(b => !b.stand) ?? this.list[0];
      this.list.splice(this.list.indexOf(old), 1); popped = old;
    }
    const b = { id: ++this.n, x: s.x, y: s.y, z: s.z, age: 0, stand: false, standT: 0, wallT: 0, warned: false };
    this.list.push(b);
    return { ok: true, b, popped };
  }
  refill() { const was = this.soap; this.soap = BUBBLE.soap; return this.soap > was; }
  // You landed on bubble b (the live part's carry object holds you on its top from now on).
  standOn(b) { if (b && !b.stand) { b.stand = true; b.standT = 0; } }
  pop(b) { const i = this.list.indexOf(b); if (i >= 0) this.list.splice(i, 1); }
  // env = { solid(x, y, z), vents: [{ x0, x1, y0, y1, z0, z1, vx, vy, vz }], drips: [drip] } -> events [{ type: 'pop' | 'warn', b, why }]
  step(dt, env = {}) {
    const ev = [], R = BUBBLE.r;
    this.acc = substeps(this.acc, dt, h => {
      for (const b of [...this.list]) {
        const was = { x: b.x, y: b.y, z: b.z };
        if (b.stand) {
          b.standT += h; b.y -= BUBBLE.sink * h;
          if (!b.warned && b.standT >= this.standLife - BUBBLE.warn) { b.warned = true; ev.push({ type: 'warn', b }); }
          if (b.standT >= this.standLife) { this.pop(b); ev.push({ type: 'pop', b, why: 'stood' }); continue; }
        } else {
          b.age += h; if (b.age > BUBBLE.hang + 1e-9) b.y += this.rise * h; // it waits a moment where you blew it, then floats up
          if (b.age >= this.life) { this.pop(b); ev.push({ type: 'pop', b, why: 'old' }); continue; }
        }
        for (const v of env.vents || []) if (inBox(v, b.x, b.y, b.z)) { b.x += (v.vx || 0) * h; b.y += (v.vy || 0) * h; b.z += (v.vz || 0) * h; }
        if (b.stand && b.y < was.y && env.solid && sphereTouches(env.solid, b.x, b.y, b.z, R) && !sphereTouches(env.solid, b.x, was.y, b.z, R)) b.y = was.y; // one you stand on rests on the floor (it pops on its own time)
        if (env.solid && sphereTouches(env.solid, b.x, b.y, b.z, R)) {
          b.wallT += h;
          if (b.wallT >= BUBBLE.wall) { this.pop(b); ev.push({ type: 'pop', b, why: 'wall' }); continue; }
        } else b.wallT = 0;
        for (const d of env.drips || []) {
          const y = dripAt(d, this.clock, this.drip);
          if (y !== null && Math.hypot(b.x - d.x, b.z - d.z) < R + 0.12 && Math.abs(y - b.y) < R) { this.pop(b); ev.push({ type: 'pop', b, why: 'drip' }); break; }
        }
      }
      this.clock += h;
    });
    return ev;
  }
}

/* ------------------------------------------------------------------ the ducklings */
// float: its height over the floor; r its bubble; reach (Puff!) and blowReach (Blow! to bubble it); near / far: the puff is strongest
// (max blocks a second) when you stand `near` and weakest (min) at `far`; friction (a second) while it glides, nest (friction inside
// the nest); stop: slower than this counts as stopped; stay (s) stopped in the nest = home; cone (radians): it must be in front of you;
// thorn: a coral thorn's radius; bounce: how much speed the garden's rim gives back; carry: how fast a current takes it over; gustCarry:
// how fast a blowing gust takes it over; life (s): how long its bubble lasts from the Blow!, hurry (s): the wobble before that; waddle:
// how fast it waddles home to its island once awake.
export const DUCK = { float: 0.9, r: 0.45, reach: 2.5, blowReach: 2.0, near: 0.8, far: 2.5, max: 3.6, min: 1.0, friction: 0.55, nest: 2.4, stop: 0.4, stay: 1.0, cone: 0.9, thorn: 0.45, bounce: 0.5, carry: 1.5, gustCarry: 2.5, life: 45, hurry: 6, waddle: 1.0 };
export function puffSpeed(dist) {
  const k = Math.max(0, Math.min(1, (dist - DUCK.near) / (DUCK.far - DUCK.near)));
  return DUCK.max + (DUCK.min - DUCK.max) * k;
}
// How far a puff from `dist` away glides on calm floor (the arrow you see): speed / friction.
export const glideOf = (dist, friction = DUCK.friction) => puffSpeed(dist) / friction;
// A gust lane: { x0, x1, z0, z1, vx, vz, period, on, warn, phase }: calm, then `warn` s of gathering puffs, then it blows for `on` s.
// -> 0 calm, 0.5 warning, 1 blowing, at the garden clock t.
export function gustAt(g, t) {
  const u = (((t + (g.phase || 0)) % g.period) + g.period) % g.period, start = g.period - g.on;
  return u >= start ? 1 : u >= start - g.warn ? 0.5 : 0;
}
// garden = { bounds: { x0, x1, z0, z1 }, nest: { x, z, r }, currents: [{ x0, x1, z0, z1, vx, vz }], gusts: [gust], thorns: [[x, z]] }
// island = [x, z]. States: 'sleep' on its island, 'float' in its bubble, 'waddle' (awake, walking home), 'home' in the nest.
export class Duckling {
  constructor(garden, island, { help = 0, hard = false } = {}) {
    this.g = garden; this.island = island; this.help = help; this.hard = hard;
    this.x = island[0]; this.z = island[1]; this.vx = 0; this.vz = 0; this.state = 'sleep'; this.homeT = 0; this.acc = 0; this.t = 0; this.age = 0;
  }
  get friction() { return DUCK.friction * H(this.help, 'friction') * (this.hard ? HARD.friction : 1); }
  get current() { return H(this.help, 'current') * (this.hard ? HARD.current : 1); }
  get gust() { return H(this.help, 'gust') * (this.hard ? HARD.gust : 1); }
  get nestR() { return this.g.nest.r * H(this.help, 'nest'); }
  get life() { return DUCK.life * H(this.help, 'duckLife') * (this.hard ? HARD.duckLife : 1); }
  get left() { return this.state === 'float' ? Math.max(0, this.life - this.age) : 0; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  // Blow! round it (asleep, or waddling home: it floats up where it is). clock: the garden's clock now (the gusts keep their beat).
  blow(clock = this.t) { if (this.state !== 'sleep' && this.state !== 'waddle') return false; this.state = 'float'; this.vx = 0; this.vz = 0; this.homeT = 0; this.age = 0; this.t = clock; return true; }
  // A puff along (dx, dz) (any length) from `dist` blocks away: the push adds to how it moves now.
  puff(dx, dz, dist) {
    if (this.state !== 'float') return false;
    const l = Math.hypot(dx, dz) || 1, v = puffSpeed(dist);
    this.vx += dx / l * v; this.vz += dz / l * v;
    return true;
  }
  backHome() { this.x = this.island[0]; this.z = this.island[1]; this.vx = 0; this.vz = 0; this.state = 'sleep'; this.homeT = 0; this.age = 0; }
  // -> events [{ type: 'pop' | 'home' | 'bonk' | 'wake' | 'asleep' | 'hurry' }]
  step(dt) {
    const ev = [];
    if (this.state !== 'float' && this.state !== 'waddle') return ev;
    const g = this.g, R = DUCK.r;
    this.acc = substeps(this.acc, dt, h => {
      this.t += h;
      if (this.state === 'waddle') { // awake: it waddles straight back to its island and falls asleep there
        const dx = this.island[0] - this.x, dz = this.island[1] - this.z, d = Math.hypot(dx, dz), s = DUCK.waddle * h;
        if (d <= s) { this.backHome(); ev.push({ type: 'asleep' }); } else { this.x += dx / d * s; this.z += dz / d * s; }
        return;
      }
      if (this.state !== 'float') return;
      this.age += h;
      if (this.age >= this.life - DUCK.hurry && this.age - h < this.life - DUCK.hurry) ev.push({ type: 'hurry' });
      if (this.age >= this.life) { this.state = 'waddle'; this.vx = 0; this.vz = 0; ev.push({ type: 'wake', at: [this.x, this.z] }); return; }
      const inNest = Math.hypot(this.x - g.nest.x, this.z - g.nest.z) < this.nestR;
      const cur = (g.currents || []).find(c => this.x >= c.x0 && this.x < c.x1 && this.z >= c.z0 && this.z < c.z1);
      const gust = (g.gusts || []).find(c => this.x >= c.x0 && this.x < c.x1 && this.z >= c.z0 && this.z < c.z1 && gustAt(c, this.t) === 1);
      if (gust && !inNest) { // a gust blowing: it takes the duckling along for a moment
        const k = Math.exp(-DUCK.gustCarry * h), cx = gust.vx * this.gust, cz = gust.vz * this.gust;
        this.vx = cx + (this.vx - cx) * k; this.vz = cz + (this.vz - cz) * k;
      } else if (cur && !inNest) { // the current takes it over: it moves toward the current's own speed
        const k = Math.exp(-DUCK.carry * h), cx = cur.vx * this.current, cz = cur.vz * this.current;
        this.vx = cx + (this.vx - cx) * k; this.vz = cz + (this.vz - cz) * k;
      } else { const k = Math.exp(-(inNest ? DUCK.nest : this.friction) * h); this.vx *= k; this.vz *= k; }
      this.x += this.vx * h; this.z += this.vz * h;
      const b = g.bounds; let bonk = false;
      if (this.x < b.x0 + R) { this.x = b.x0 + R; this.vx = Math.abs(this.vx) * DUCK.bounce; bonk = true; }
      if (this.x > b.x1 - R) { this.x = b.x1 - R; this.vx = -Math.abs(this.vx) * DUCK.bounce; bonk = true; }
      if (this.z < b.z0 + R) { this.z = b.z0 + R; this.vz = Math.abs(this.vz) * DUCK.bounce; bonk = true; }
      if (this.z > b.z1 - R) { this.z = b.z1 - R; this.vz = -Math.abs(this.vz) * DUCK.bounce; bonk = true; }
      if (bonk && this.speed > 0.3) ev.push({ type: 'bonk' });
      for (const [tx, tz] of g.thorns || []) if (Math.hypot(this.x - tx, this.z - tz) < R + DUCK.thorn) { ev.push({ type: 'pop', at: [this.x, this.z] }); this.backHome(); return; }
      if (inNest && this.speed < DUCK.stop) { this.homeT += h; if (this.homeT >= DUCK.stay) { this.state = 'home'; this.vx = 0; this.vz = 0; this.x = g.nest.x; this.z = g.nest.z; ev.push({ type: 'home' }); } } else this.homeT = 0;
    });
    return ev;
  }
}

/* ------------------------------------------------------------------ the Chimney Ride */
// R the ride bubble's radius; sink (blocks a second, always); a tap is a puff: `puff` blocks up over puffTime s and a `push` (blocks a
// second) the way you look; the stick steers (steer blocks a second, eased in at `relax` a second); a wall gives back `wall` of its speed;
// a spike plate's gap has radius gap (you pass with your middle within gap - pass of its centre); the arm (from the middle to the wall) is
// barHalf thick each side and turns at bar radians a second; a fizz star is touched within starR; after a pop you wait popWait s in the star's new bubble.
export const RIDE = { R: 0.8, sink: 0.9, puff: 1.4, puffTime: 0.3, push: 0.7, steer: 1.4, relax: 3, wall: 0.5, gap: 1.35, pass: 0.35, plate: 0.4, barHalf: 0.3, barSlab: 0.4, bar: 1.0, starR: 1.2, popWait: 0.6, maxPuffs: 6 };
// chim = { x, z, r (inside radius), floor (y of the floor's top face), top (done above this), plates: [{ y, a, d }], fan: { y0, y1, vx, vz },
//          bar: { y }, stars: [{ x, y, z }] }
export const gapOf = (chim, p) => ({ x: chim.x + Math.cos(p.a) * p.d, z: chim.z + Math.sin(p.a) * p.d });
export class Ride {
  constructor(chim, { help = 0, hard = false, star = 0 } = {}) {
    this.c = chim; this.help = help; this.hard = hard;
    this.star = star; this.t = 0; this.acc = 0; this.puffs = []; this.done = false; this.popT = null; this.pops = 0;
    this.toStar(star);
  }
  get sink() { return RIDE.sink * H(this.help, 'sink') * (this.hard ? HARD.sink : 1); }
  get gap() { return RIDE.gap * H(this.help, 'gap'); }
  get barSpeed() { return RIDE.bar * H(this.help, 'bar') * (this.hard ? HARD.bar : 1); }
  toStar(k) { const s = this.c.stars[k]; this.x = s.x; this.y = s.y; this.z = s.z; this.vx = 0; this.vz = 0; this.puffs = []; }
  barAngle(t = this.t) { return t * this.barSpeed; }
  // A tap: a puff up and a little push the way you look (lx, lz: your look, flat).
  tap(lx = 0, lz = 0) {
    if (this.done || this.popT !== null) return false;
    if (this.puffs.length >= RIDE.maxPuffs) this.puffs.shift();
    this.puffs.push(this.t);
    const l = Math.hypot(lx, lz);
    if (l > 1e-6) { this.vx += lx / l * RIDE.push; this.vz += lz / l * RIDE.push; }
    return true;
  }
  resting() { return this.popT === null && this.y <= this.c.floor + RIDE.R + 0.02 && !this.puffs.some(p => this.t - p < RIDE.puffTime); }
  // input = { sx, sz } the stick (world directions, length 0..1) -> events [{ type: 'pop', why } | { type: 'respawn' } | { type: 'star', k } | { type: 'top' }]
  step(dt, input = {}) {
    const ev = [], c = this.c, R = RIDE.R;
    const sx = input.sx || 0, sz = input.sz || 0;
    this.acc = substeps(this.acc, dt, h => {
      if (this.done) return;
      this.t += h;
      if (this.popT !== null) { this.popT += h; if (this.popT >= RIDE.popWait) { this.popT = null; this.toStar(this.star); ev.push({ type: 'respawn', k: this.star }); } return; }
      let vy = -this.sink;
      this.puffs = this.puffs.filter(p => this.t - p < RIDE.puffTime);
      for (const p of this.puffs) vy += (2 * RIDE.puff / RIDE.puffTime) * (1 - (this.t - p) / RIDE.puffTime);
      const k = 1 - Math.exp(-RIDE.relax * h);
      this.vx += (sx * RIDE.steer - this.vx) * k; this.vz += (sz * RIDE.steer - this.vz) * k;
      let fx = 0, fz = 0;
      if (c.fan && this.y >= c.fan.y0 && this.y < c.fan.y1) { fx = c.fan.vx; fz = c.fan.vz; }
      this.x += (this.vx + fx) * h; this.z += (this.vz + fz) * h; this.y += vy * h;
      if (this.y < c.floor + R) this.y = c.floor + R;
      const dx = this.x - c.x, dz = this.z - c.z, d = Math.hypot(dx, dz), lim = c.r - R;
      if (d > lim) { // a soft wall: back inside, the speed out of the wall turned round
        const nx = dx / d, nz = dz / d, out = this.vx * nx + this.vz * nz;
        this.x = c.x + nx * lim; this.z = c.z + nz * lim;
        if (out > 0) { this.vx -= (1 + RIDE.wall) * out * nx; this.vz -= (1 + RIDE.wall) * out * nz; }
      }
      // the spike plates: you only get through a plate's gap
      for (const p of c.plates) {
        if (this.y + R * 0.7 < p.y || this.y - R * 0.7 > p.y + RIDE.plate) continue;
        const g = gapOf(c, p);
        if (Math.hypot(this.x - g.x, this.z - g.z) > this.gap - RIDE.pass) { this.burst(ev, 'spike'); return; }
      }
      // the spinning arm: from the middle to the wall, turning like a clock hand
      if (c.bar && this.y + R * 0.7 >= c.bar.y && this.y - R * 0.7 <= c.bar.y + RIDE.barSlab) {
        const a = this.barAngle(), dx = this.x - c.x, dz = this.z - c.z, along = Math.cos(a) * dx + Math.sin(a) * dz, off = Math.abs(-Math.sin(a) * dx + Math.cos(a) * dz);
        if (along > -R * 0.6 && off < RIDE.barHalf + R * 0.6) { this.burst(ev, 'bar'); return; }
      }
      const nx = c.stars[this.star + 1];
      if (nx && Math.hypot(this.x - nx.x, this.y - nx.y, this.z - nx.z) < RIDE.starR) { this.star++; ev.push({ type: 'star', k: this.star }); }
      if (this.y >= c.top) { this.done = true; ev.push({ type: 'top' }); }
    });
    return ev;
  }
  burst(ev, why) { this.popT = 0; this.pops++; this.puffs = []; this.vx = 0; this.vz = 0; ev.push({ type: 'pop', why }); }
}


/* ------------------------------------------------------------------ Captain Suds' shields: bank shots */
// From a gold pad on the rim, Blow! sends a shot bubble flying flat the way you look (one press). It bounces off the pink soap cushions
// (like a ball off a wall: the angle in is the angle out), pops on a foam guard, and pops a shield when it reaches it. The foam guards
// hide the shield from every pad, so every shot is a bank shot. speed (blocks a second), r (the shot's radius), life (s), bounces (at most;
// one more pops it), from (how far in front of your feet it starts), h (its height over the rim's floor), pad (how near a pad's middle you
// stand to blow from it), stub (how far the aim line goes on after its first bounce).
export const BANK = { speed: 6, r: 0.3, life: 4, bounces: 3, from: 0.5, h: 1.3, pad: 1.0, stub: 1.6 };
// A box (blocks) { x0, x1, z0, z1 } in world units (cell x covers x..x+1, so a one-block wall at x = 87 is { x0: 87, x1: 88 }).
// court = { target: { x, z }, radius (the shield in the shot's plane), cushions: [box], guards: [box], slider?: { box, dx, dz, period },
//          wall?: { x, z, r } (a round wall: a shot pops on it) }
// The slider: a cushion that slides to and fro (dx, dz at most each way), a closed form of the court's clock t.
export function sliderBox(s, t, f = 1) {
  const k = Math.sin(2 * Math.PI * t * f / s.period);
  return { x0: s.box.x0 + s.dx * k, x1: s.box.x1 + s.dx * k, z0: s.box.z0 + s.dz * k, z1: s.box.z1 + s.dz * k };
}
// The push out of box b for a circle at (x, z) of radius r: { d, nx, nz } (d <= 0: its middle is inside), or null when it does not touch.
function touchBox(x, z, r, b) {
  const qx = Math.max(b.x0, Math.min(b.x1, x)), qz = Math.max(b.z0, Math.min(b.z1, z)), dx = x - qx, dz = z - qz, d = Math.hypot(dx, dz);
  if (d >= r) return null;
  if (d > 1e-9) return { d, nx: dx / d, nz: dz / d };
  const opts = [[x - b.x0, -1, 0], [b.x1 - x, 1, 0], [z - b.z0, 0, -1], [b.z1 - z, 0, 1]].sort((a, c) => a[0] - c[0]); // inside: out the nearest side
  return { d: -opts[0][0], nx: opts[0][1], nz: opts[0][2] };
}
const shieldR = (court, help, hard) => court.radius * H(help, 'catch') * (hard ? HARD.catch : 1);
const slideF = (help, hard) => H(help, 'slide') * (hard ? HARD.slide : 1);
// The cushions at court clock t (the slider's place is a closed form of t).
export const cushionsAt = (court, t, help = 0, hard = false) => [...court.cushions, ...(court.slider ? [sliderBox(court.slider, t, slideF(help, hard))] : [])];
// A shot from (x, z) along (dx, dz) blown at court clock t0. -> { hit, end: 'shield' | 'guard' | 'wall' | 'old' | 'bounces', bounces, time,
// at: [x, z] where it ended, path(t) -> { x, z }, turns: [[x, z]] where it bounced } (worked out at once in fixed sub-steps, so any frame
// rate draws the same flight).
export function bankShot(court, from, dir, { t0 = 0, help = 0, hard = false, stub = 0 } = {}) {
  const l = Math.hypot(dir.x, dir.z) || 1, R = BANK.r, sr = shieldR(court, help, hard), tx = court.target.x, tz = court.target.z, wall = court.wall;
  const fixed = court.cushions || [], slider = court.slider, sf = slider ? slideF(help, hard) : 1, guards = court.guards || [];
  let x = from.x, z = from.z, vx = dir.x / l * BANK.speed, vz = dir.z / l * BANK.speed, t = 0, bounces = 0, end = 'old', stopAt = Infinity;
  const pts = new Float64Array((Math.ceil(BANK.life / STEP) + 3) * 2), turns = [];
  let n = 1; pts[0] = x; pts[1] = z;
  const bounce = c => { // off a cushion: back out of it, the speed into it turned round
    const k = touchBox(x, z, R, c);
    if (!k) return false;
    const vn = vx * k.nx + vz * k.nz;
    x += k.nx * (R - k.d); z += k.nz * (R - k.d);
    if (vn < 0) { vx -= 2 * vn * k.nx; vz -= 2 * vn * k.nz; return true; }
    return false;
  };
  const put = () => { pts[2 * n] = x; pts[2 * n + 1] = z; n++; };
  while (t < BANK.life - 1e-9 && t < stopAt) {
    x += vx * STEP; z += vz * STEP; t += STEP;
    if (Math.hypot(x - tx, z - tz) < sr + R) { end = 'shield'; put(); break; }
    let fence = false;
    for (let i = 0; i < guards.length && !fence; i++) fence = !!touchBox(x, z, R, guards[i]);
    if (fence) { end = 'guard'; put(); break; }
    if (wall && Math.hypot(x - wall.x, z - wall.z) + R >= wall.r) { end = 'wall'; put(); break; } // the well's round wall
    let bounced = false;
    for (let i = 0; i < fixed.length; i++) if (bounce(fixed[i])) bounced = true;
    if (slider && bounce(sliderBox(slider, t0 + t, sf))) bounced = true;
    put();
    if (bounced) {
      turns.push([x, z]);
      if (stub && turns.length === 1) stopAt = t + stub / BANK.speed; // (the aim line only needs the way to the first bounce and a stub)
      if (++bounces > BANK.bounces) { end = 'bounces'; break; }
    }
  }
  const time = (n - 1) * STEP;
  const path = tt => { const i = Math.max(0, Math.min(n - 1, tt / STEP)), a = Math.floor(i), b = Math.min(n - 1, a + 1), f = i - a; return { x: pts[2 * a] + (pts[2 * b] - pts[2 * a]) * f, z: pts[2 * a + 1] + (pts[2 * b + 1] - pts[2 * a + 1]) * f }; };
  return { hit: end === 'shield', end, bounces, time, at: [pts[2 * n - 2], pts[2 * n - 1]], turns, path };
}
// The dotted aim line: from (x, z) the way you look to the first thing the shot meets (a cushion, a guard or the shield), and after a
// cushion a short stub the way it bounces off. -> [[x, z], [x, z]] or [[x, z], [x, z], [x, z]]
export function aimLine(court, from, dir, opts = {}) {
  const s = bankShot(court, from, dir, { ...opts, stub: BANK.stub });
  if (!s.turns.length) return [[from.x, from.z], s.at];
  const [tx, tz] = s.turns[0], tTurn = Math.hypot(tx - from.x, tz - from.z) / BANK.speed, stub = s.path(Math.min(s.time, tTurn + BANK.stub / BANK.speed));
  return [[from.x, from.z], [tx, tz], [stub.x, stub.z]];
}
