// The Bubble Well's rules (plans/bubble-well.md), pure: no imports but the shared kind help, Node-runnable. Every clock is summed frame
// time cut into fixed 1/120 s sub-steps, so 60 and 20 frames a second give the same climb. No Math.random anywhere.
//  - BubbleField: the bubbles YOU blow with the wand (Blow!: one press, never held). A bubble appears in front of your eyes, waits there a
//    moment (BUBBLE.hang: time to hop on), rises slowly,
//    drifts in a vent's wind and pops when it is old, when a drip hits it, when it rubs a wall, or a little while after you landed on it.
//    At most two at once; the wand holds six puffs of soap (soap flowers fill it up). Standing on one is the live part's `carry` object.
//  - Duckling: a sleepy rubber duckling in a bubble that you never hold: Puff! nudges it the way you look, harder the closer you stand.
//    It glides like a puck, a current carries it, a thorn pops its bubble (it plops back onto its island, never hurt), the nest stops it.
//  - Ride: the Chimney Ride inside a big bubble that always sinks a little: every tap is a puff up (no hold), the stick steers. Spike
//    plates with one gap, a fan, a spinning bar near the top; a pop puts you back at the last fizz star.
//  - shieldShot: a bubble blown into a fizz vent is carried up and round (each vent curls its own way) and flies out the side it ends
//    on: from the right spot it pops one of Captain Suds' shields.
// The kind help after misses comes only from kindhelp.js (bubbleHelp maps it onto each game's levers); a rematch's `hard` is separate.
import { kindHelp } from './kindhelp.js';

export const STEP = 1 / 120;
// r radius, ahead how far in front of your eyes it appears, rise (blocks a second) while free, life (s) while free, sink while you stand
// on it, stand (s) from landing to the pop, warn (s) of wobble before that pop, max at once, soap puffs, bounce (blocks: the jump off a
// bubble), wall (s of rubbing a wall before it pops), catch (how far from its middle your feet may land), onTop (how far you may walk on it),
// hang (s a new bubble waits where you blew it before it starts to rise: time to hop on; owner 2026-10-29 "I could never jump on a bubble"),
// scoop (your feet anywhere from `scoop` below its middle up to its top also land you on it: a bubble blown under your feet mid-jump, or
// one you hop up into, catches you; only a bubble below your middle can, so a straight-ahead one stays too high to hop on from the ground),
// lift (a bubble blown at the floor is lifted up to this far to sit just on top of it, so looking down at your feet and blowing works),
// under (in the air, a bubble you blow right under your feet catches you at once if your feet are no more than this below its middle).
export const BUBBLE = { r: 0.55, ahead: 1.6, rise: 0.6, life: 4, sink: 0.25, stand: 2.0, warn: 0.6, max: 2, soap: 6, bounce: 2.1, wall: 0.2, catch: 0.8, onTop: 0.45, hang: 0.6, scoop: 0.15, lift: 1.1, under: 0.6 };
// How high your feet get over where they are now: a jump from the ground (the Player's jump speed 8.6), a Bounce off a bubble, or what is
// left of a jump in the air (vy). g = the world's gravity.
export const JUMP = 8.6;
export const hopHeight = ({ ground = false, onBubble = false, vy = 0, g = 1 } = {}) =>
  onBubble ? BUBBLE.bounce : ground ? JUMP * JUMP / (2 * 28 * g) : Math.max(0, vy) ** 2 / (2 * 28 * g);
// Do your feet land on bubble b? feet / prev: the feet's height now and a frame ago; (x, z) where you are; vy your speed up. Two ways:
//  - from above: the feet came down through its top since the last frame (any frame rate);
//  - from inside: the feet are in its upper part (from `scoop` below its middle to its top), you are not shooting up fast.
// inside = false: only from above (the bubble you just stepped or bounced off never scoops you up again).
export function landsOn(b, { x, z, feet, prev = feet, vy = 0, inside = true }) {
  if (Math.hypot(x - b.x, z - b.z) > BUBBLE.catch) return false;
  const top = b.y + BUBBLE.r;
  if (vy <= 0.5 && prev >= top - 0.12 && feet <= top + 0.15 && feet >= top - 1.2) return true;
  return inside && vy <= 6 && feet >= b.y - BUBBLE.scoop && feet <= top + 0.15;
}
// A rematch (you hold the star) is a new climb, a bit harder (separate from the kind help).
export const HARD = { life: 0.85, stand: 0.85, drip: 1.25, current: 1.3, friction: 0.85, sink: 1.2, bar: 1.2, catch: 0.85 };

// The ONE kind help of the Bubble Well's games: kindHelp(misses) mapped onto each game's levers (slow = 1 - e, more = 1 + e, e <= 0.10).
//   stairs  (a fall from a bubble)              bubbles' life and the time you may stand on one x more, drips x slow
//   ducks   (a duckling's bubble popped)        currents x slow, the duckling's glide stops x more sooner, the nest x more wider
//   chimney (the ride's bubble popped)          the sink x slow, the gaps x more wider, the bar x slow
//   shields (a bubble from a vent that missed)  the shield's catch x more
export function bubbleHelp(misses) {
  const k = kindHelp(misses);
  return { ...k, life: k.more, stand: k.more, drip: k.slow, current: k.slow, friction: k.more, nest: k.more, sink: k.slow, gap: k.more, bar: k.slow, catch: k.more };
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
  get drip() { return H(this.help, 'drip') * (this.hard ? HARD.drip : 1); }
  // Blow! from the eye (x, y, z) along the unit direction d. solid(x, y, z) = a whole cell is solid. -> { ok, b?, why?, popped? }
  blow(eye, d, solid = () => false) {
    if (this.soap <= 0) return { ok: false, why: 'soap' };
    const x = eye.x + d.x * BUBBLE.ahead, z = eye.z + d.z * BUBBLE.ahead;
    const y0 = eye.y + d.y * BUBBLE.ahead, R = BUBBLE.r + 0.02;
    let y = y0;
    if (sphereTouches(solid, x, y, z, R)) { // blown at the floor: it sits just on top of it (never through a wall or a ceiling)
      while (y < y0 + BUBBLE.lift && sphereTouches(solid, x, y, z, R)) y += 0.05;
      if (sphereTouches(solid, x, y, z, R)) y = y0;
    }
    if (sphereTouches(solid, x, y, z, BUBBLE.r * 0.8)) return { ok: false, why: 'wall' };
    let popped = null;
    if (this.list.length >= BUBBLE.max) { // the oldest one you are not standing on makes room
      const old = this.list.find(b => !b.stand) ?? this.list[0];
      this.list.splice(this.list.indexOf(old), 1); popped = old;
    }
    const b = { id: ++this.n, x, y, z, age: 0, stand: false, standT: 0, wallT: 0, warned: false };
    this.list.push(b);
    this.soap--;
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
          b.age += h; if (b.age > BUBBLE.hang + 1e-9) b.y += BUBBLE.rise * h; // it waits a moment where you blew it, then rises
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
// thorn: a coral thorn's radius; bounce: how much speed the garden's rim gives back; carry: how fast a current takes it over.
export const DUCK = { float: 0.9, r: 0.45, reach: 2.5, blowReach: 2.0, near: 0.8, far: 2.5, max: 3.6, min: 1.0, friction: 0.55, nest: 2.4, stop: 0.4, stay: 1.0, cone: 0.9, thorn: 0.45, bounce: 0.5, carry: 1.5 };
export function puffSpeed(dist) {
  const k = Math.max(0, Math.min(1, (dist - DUCK.near) / (DUCK.far - DUCK.near)));
  return DUCK.max + (DUCK.min - DUCK.max) * k;
}
// garden = { bounds: { x0, x1, z0, z1 }, nest: { x, z, r }, currents: [{ x0, x1, z0, z1, vx, vz }], thorns: [[x, z]] }; island = [x, z]
export class Duckling {
  constructor(garden, island, { help = 0, hard = false } = {}) {
    this.g = garden; this.island = island; this.help = help; this.hard = hard;
    this.x = island[0]; this.z = island[1]; this.vx = 0; this.vz = 0; this.state = 'sleep'; this.homeT = 0; this.acc = 0; this.t = 0;
  }
  get friction() { return DUCK.friction * H(this.help, 'friction') * (this.hard ? HARD.friction : 1); }
  get current() { return H(this.help, 'current') * (this.hard ? HARD.current : 1); }
  get nestR() { return this.g.nest.r * H(this.help, 'nest'); }
  get speed() { return Math.hypot(this.vx, this.vz); }
  blow() { if (this.state !== 'sleep') return false; this.state = 'float'; this.vx = 0; this.vz = 0; this.homeT = 0; return true; }
  // A puff along (dx, dz) (any length) from `dist` blocks away: the push adds to how it moves now.
  puff(dx, dz, dist) {
    if (this.state !== 'float') return false;
    const l = Math.hypot(dx, dz) || 1, v = puffSpeed(dist);
    this.vx += dx / l * v; this.vz += dz / l * v;
    return true;
  }
  backHome() { this.x = this.island[0]; this.z = this.island[1]; this.vx = 0; this.vz = 0; this.state = 'sleep'; this.homeT = 0; }
  // -> events [{ type: 'pop' | 'home' | 'bonk' }]
  step(dt) {
    const ev = [];
    if (this.state !== 'float') return ev;
    const g = this.g, R = DUCK.r;
    this.acc = substeps(this.acc, dt, h => {
      if (this.state !== 'float') return;
      this.t += h;
      const inNest = Math.hypot(this.x - g.nest.x, this.z - g.nest.z) < this.nestR;
      const cur = (g.currents || []).find(c => this.x >= c.x0 && this.x < c.x1 && this.z >= c.z0 && this.z < c.z1);
      if (cur && !inNest) { // the current takes it over: it moves toward the current's own speed
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

/* ------------------------------------------------------------------ the shields */
// A bubble that floats into a fizz vent (within ventR of its middle, below rise above its floor) rises at `up` blocks a second while
// it is carried round the vent by the vent's curl, then flies out the side it ends on at `out` blocks a second for at most `far` blocks.
// It pops Captain Suds' shield if its way out passes within catchR of his middle. minR: an entry closer to the middle than this counts
// as the vent's lazy side.
export const SHOT = { up: 2.5, rise: 3, out: 3, far: 12, catchR: 3.0, minR: 0.25, ventR: 1.2 };
// vent = { x, z, y (its floor: you stand at y), curl (radians), lazy (radians) }; entry = { x, z } where the bubble came in; target = { x, z }
export function shieldShot(vent, entry, target, { help = 0, hard = false } = {}) {
  const dx = entry.x - vent.x, dz = entry.z - vent.z, r0 = Math.hypot(dx, dz);
  const a0 = r0 < SHOT.minR ? vent.lazy : Math.atan2(dz, dx), aOut = a0 + vent.curl;
  const ux = Math.cos(aOut), uz = Math.sin(aOut), rr = Math.max(0.5, Math.min(SHOT.ventR, r0));
  const sx = vent.x + ux * rr, sz = vent.z + uz * rr; // where it leaves the column
  const tx = target.x - sx, tz = target.z - sz, proj = tx * ux + tz * uz, perp = Math.abs(-uz * tx + ux * tz);
  const catchR = SHOT.catchR * H(help, 'catch') * (hard ? HARD.catch : 1);
  const hit = proj > 0 && proj < SHOT.far && perp < catchR;
  const T1 = SHOT.rise / SHOT.up, dist = hit ? Math.max(0, proj - Math.sqrt(Math.max(0, catchR * catchR - perp * perp)) * 0.5) : SHOT.far * 0.6;
  const T2 = dist / SHOT.out;
  const y0 = vent.y + 1.6;
  // where the bubble is t seconds after it came in (closed form)
  const path = t => {
    if (t <= T1) { const a = a0 + vent.curl * (t / T1); return { x: vent.x + Math.cos(a) * rr, y: y0 + SHOT.up * t, z: vent.z + Math.sin(a) * rr }; }
    const s = Math.min(t - T1, T2) * SHOT.out;
    return { x: sx + ux * s, y: y0 + SHOT.rise, z: sz + uz * s };
  };
  return { hit, a0, aOut, perp, proj, catchR, time: T1 + T2, path };
}
// The spot a bubble must come in at, to pop the shield from this vent (for the guide's words and the robots): r blocks from its middle.
export function shieldSpot(vent, target, r = 0.6) {
  const want = Math.atan2(target.z - vent.z, target.x - vent.x) - vent.curl;
  return { x: vent.x + Math.cos(want) * r, z: vent.z + Math.sin(want) * r, a: want };
}
