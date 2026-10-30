// The Bubble Well's rules (plans/bubble-well.md, "Redesign 2026-10-29 (natural rules)"), pure: no imports but the shared kind help,
// Node-runnable. Every clock is summed frame time cut into fixed 1/120 s sub-steps, so 60 and 20 frames a second give the same climb.
// No Math.random anywhere. Owner 2026-10-29: "Easy to understand, hard to master" and "Those rules should be natural to the game": every
// rule here is something a child already expects from real bubbles and a real wand, and nothing needs explaining.
//  - The wand: dip it in a soap pot and it holds ONE soap film (one bubble). Blowing through a wet wand makes a bubble just in front of
//    it; blowing through a dry wand is only a puff of air, which pushes light things (bubbles, a duckling in its bubble). The film is
//    shaken off when you leave the ground (a jump), so a bubble is always blown from where you stand. (The live part keeps `wet`.)
//  - BubbleField (the Fizz Ledges, Captain Suds' shields): a bubble waits a moment where you blew it, then floats up and drifts with the
//    air (the fizz streams you can see), wobbles, and pops after a while, or when it rubs a wall or a drip hits it. Hop on it and it
//    carries you up (lean with the stick to steer it a little); hop off onto the next ledge before it pops.
//  - Duckling: a sleepy rubber duckling in a bubble that you never hold: puffs of air push it (harder the closer you stand); it glides,
//    a current carries it, a gust lane blows now and then, a thorn pops its bubble, and the bubble only lasts a while.
//  - Ride: the Chimney Ride inside a big bubble that always sinks a little: every tap is a puff up (no hold), the stick steers. Spike
//    plates with one gold-ringed gap (two of them turn), two fans, two spinning arms (owner 2026-10-30: "slightly longer"); a pop puts
//    you back at the last bar of soap you floated past (the chimney's checkpoints; never stars: stars are the Wizard's).
//  - Shields: Captain Suds' three shield bubbles feed the big bubble he sits sealed in. A bubble pops when you come down onto its top (a
//    stomp); from the side, from below or onto its shoulder it only boings you away (owner 2026-10-30: "from the side = boing, from above
//    = pop" is learnt by doing it, on the low first shield).
// The kind help after misses comes only from kindhelp.js (bubbleHelp maps it onto each game's levers); a rematch's `hard` is separate.
import { kindHelp } from './kindhelp.js';

export const STEP = 1 / 120;
// r radius; ahead how far in front of your feet (flat, the way you face) a new bubble appears (closer when something is in the way: near
// is the closest); lift how far it may be lifted to sit on a floor; hang (s) it waits there, then rises `rise` blocks a second; life (s)
// from the blow to its pop, warn (s) of wobble before that; max at once; steer (blocks a second: leaning on the one you ride); drag (a
// second: how fast a pushed bubble slows); bounce (blocks: the jump off a bubble); wall (s of rubbing a wall before it pops); catch (how
// far from its middle your feet may land); scoop (your feet from `scoop` over its middle up to its top also land you on it).
export const BUBBLE = { r: 0.6, ahead: 1.5, near: 0.8, lift: 1.0, hang: 0.6, rise: 0.95, life: 3.6, warn: 0.8, max: 4, steer: 0.5, drag: 1.2, bounce: 1.6, wall: 0.15, catch: 0.85, scoop: 0.2, puffReach: 2.6, puffMax: 2.4, puffMin: 0.6 };
// How high your feet get over where they are now: a jump from the ground (the Player's jump speed 8.6), a Bounce off a bubble, or what is
// left of a jump in the air (vy). g = the world's gravity.
export const JUMP = 8.6;
export const hopHeight = ({ ground = false, onBubble = false, vy = 0, g = 1 } = {}) =>
  onBubble ? BUBBLE.bounce : ground ? JUMP * JUMP / (2 * 28 * g) : Math.max(0, vy) ** 2 / (2 * 28 * g);
// The most your feet can climb with one bubble from where you blew it (its top when it pops, then a Bounce): life x more for the kind help.
export const rideUp = (more = 1) => 2 * BUBBLE.r + BUBBLE.rise * (BUBBLE.life * more - BUBBLE.hang) + BUBBLE.bounce;
// Do your feet land on bubble b? feet / prev: the feet's height now and a frame ago; (x, z) where you are; vy your speed up. Two ways:
//  - from above: the feet came down through its top since the last frame (any frame rate);
//  - from inside: the feet are in its top part (from `scoop` over its middle to its top), you are not shooting up fast.
// inside = false: only from above (the bubble you just bounced off never scoops you up again).
export function landsOn(b, { x, z, feet, prev = feet, vy = 0, inside = true }) {
  if (Math.hypot(x - b.x, z - b.z) > BUBBLE.catch) return false;
  const top = b.y + BUBBLE.r;
  if (vy <= 0.5 && prev >= top - 0.12 && feet <= top + 0.15 && feet >= top - 1.2) return true;
  return inside && vy <= 6 && feet >= b.y + BUBBLE.scoop && feet <= top + 0.15;
}
// Where a bubble comes out of the wand from feet (x, y, z) facing look (only its flat part counts), `ahead` blocks out: its middle.
export function blowSpot(feet, look, ahead = BUBBLE.ahead) {
  const l = Math.hypot(look.x, look.z);
  if (l < 1e-6) return null;
  return { x: feet.x + look.x / l * ahead, y: feet.y + BUBBLE.r + 0.02, z: feet.z + look.z / l * ahead };
}
// A rematch (you hold the star) is a new climb, a bit harder (separate from the kind help).
export const HARD = { life: 0.9, drip: 1.25, current: 1.2, friction: 0.85, duckLife: 0.85, gust: 1.2, sink: 1.2, bar: 1.2, shield: 0.85, sway: 1.25 };

// The ONE kind help of the Bubble Well's games: kindHelp(misses) mapped onto each game's levers (slow = 1 - e, more = 1 + e, e <= 0.10).
//   ledges  (a fall from a bubble)               a bubble lasts x more (a longer ride), drips x slow, the fizz streams and gusts x slow
//   ducks   (a duckling's bubble popped)         currents and gusts x slow, the glide stops x more sooner, the nest x more wider, the
//                                                bubble lasts x more
//   chimney (the ride's bubble popped)           the sink x slow, the gaps x more wider, the bar x slow
//   shields (a ride from the rim with no stomp)  the shields x more bigger, their sway x slow
export function bubbleHelp(misses) {
  const k = kindHelp(misses);
  return { ...k, life: k.more, drip: k.slow, wind: k.slow, current: k.slow, gust: k.slow, friction: k.more, nest: k.more, duckLife: k.more, sink: k.slow, gap: k.more, bar: k.slow, shield: k.more, sway: k.slow };
}
const H = (help, key) => (typeof help === 'object' && help ? help[key] ?? 1 : bubbleHelp(help || 0)[key]);

// Steps a clock in fixed sub-steps: fn(h) is called for each whole STEP of (acc + dt); returns the new leftover.
function substeps(acc, dt, fn) {
  acc += Math.max(0, Math.min(dt, 0.25));
  while (acc >= STEP - 1e-12) { acc -= STEP; fn(STEP); }
  return acc;
}

/* ------------------------------------------------------------------ the bubbles you blow */
// A drip from a spout: { x, z, top, bottom, period, phase, speed }. Its y at clock t, or null while it is not falling.
// f > 1 makes drips faster and more often (a rematch), f < 1 slower and fewer (the kind help).
export function dripAt(d, t, f = 1) {
  const P = d.period / f, u = (((t + d.phase) % P) + P) % P, y = d.top - d.speed * f * u;
  return y >= d.bottom ? y : null;
}
// A wind that blows now and then: { period, on, warn, phase } -> 0 calm, 0.5 gathering (you see it coming), 1 blowing, at clock t.
// A wind without a period always blows (1).
export function gustAt(g, t) {
  if (!g.period) return 1;
  const u = (((t + (g.phase || 0)) % g.period) + g.period) % g.period, start = g.period - g.on;
  return u >= start ? 1 : u >= start - (g.warn || 0) ? 0.5 : 0;
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
// How hard a puff of air from `dist` away pushes (blocks a second): close = big, far = small.
export const puffPush = dist => { const k = Math.max(0, Math.min(1, (dist - 0.8) / (BUBBLE.puffReach - 0.8))); return BUBBLE.puffMax + (BUBBLE.puffMin - BUBBLE.puffMax) * k; };

export class BubbleField {
  // help = misses (or a bubbleHelp object); hard = a rematch
  constructor({ help = 0, hard = false } = {}) {
    this.list = []; this.clock = 0; this.acc = 0; this.n = 0;
    this.help = help; this.hard = hard;
  }
  get life() { return BUBBLE.life * H(this.help, 'life') * (this.hard ? HARD.life : 1); }
  get drip() { return H(this.help, 'drip') * (this.hard ? HARD.drip : 1); }
  get wind() { return H(this.help, 'wind') * (this.hard ? HARD.current : 1); }
  // Where a bubble would come out now (null: no room in front of the wand), from feet (x, y, z) facing look. solid(x, y, z) = a whole cell.
  spot(feet, look, solid = () => false) {
    const R = BUBBLE.r + 0.02;
    for (let a = BUBBLE.ahead; a >= BUBBLE.near - 1e-9; a -= 0.1) { // out of the wand: as far as `ahead`, closer when something is in the way
      const s = blowSpot(feet, look, a);
      if (!s) return null;
      const y0 = s.y;
      while (s.y < y0 + BUBBLE.lift && sphereTouches(solid, s.x, s.y, s.z, R)) s.y += 0.05; // on a step: it sits on top of it
      if (!sphereTouches(solid, s.x, s.y, s.z, R)) return s;
    }
    return null;
  }
  // Blow a bubble (the wand was wet) from your feet facing `look`. -> { ok, b?, why?, popped? }: why 'wall' = no room (it pops at once)
  blow(feet, look, solid = () => false) {
    const s = this.spot(feet, look, solid);
    if (!s) return { ok: false, why: 'wall', at: blowSpot(feet, look, BUBBLE.near) };
    let popped = null;
    if (this.list.length >= BUBBLE.max) { // the oldest one nobody stands on makes room
      const old = this.list.find(b => !b.stand) ?? this.list[0];
      this.pop(old); popped = old;
    }
    const b = { id: ++this.n, x: s.x, y: s.y, z: s.z, vx: 0, vz: 0, sx: 0, sz: 0, age: 0, stand: false, standT: 0, wallT: 0, warned: false };
    this.list.push(b);
    return { ok: true, b, popped };
  }
  // You landed on bubble b (the live part's carry object holds you on its top from now on).
  standOn(b) { if (b && !b.stand) { b.stand = true; b.standT = 0; } }
  pop(b) { const i = this.list.indexOf(b); if (i >= 0) this.list.splice(i, 1); }
  // A puff of air from (x, z) along (dx, dz): every free bubble in front within reach is pushed along. -> how many
  puff(from, dir, skip = null) {
    const l = Math.hypot(dir.x, dir.z) || 1, ux = dir.x / l, uz = dir.z / l;
    let n = 0;
    for (const b of this.list) {
      if (b === skip) continue;
      const dx = b.x - from.x, dz = b.z - from.z, d = Math.hypot(dx, dz), along = dx * ux + dz * uz;
      if (d > BUBBLE.puffReach || along < 0.2 || Math.abs(b.y - from.y - 1) > 1.6 || Math.abs(-dx * uz + dz * ux) > 0.9 + 0.3 * along) continue;
      const v = puffPush(d); b.vx += ux * v; b.vz += uz * v; n++;
    }
    return n;
  }
  // env = { solid(x, y, z), winds: [{ x0, x1, y0, y1, z0, z1, vx, vy, vz, period?, on?, warn?, phase? }], drips: [drip] }
  // -> events [{ type: 'pop' | 'warn', b, why }]
  step(dt, env = {}) {
    const ev = [], R = BUBBLE.r, life = this.life, wind = this.wind;
    this.acc = substeps(this.acc, dt, h => {
      for (const b of [...this.list]) {
        b.age += h; if (b.stand) b.standT += h;
        if (b.age > BUBBLE.hang + 1e-9) b.y += BUBBLE.rise * h; // it waits a moment where you blew it, then floats up
        if (!b.warned && b.age >= life - BUBBLE.warn) { b.warned = true; ev.push({ type: 'warn', b }); }
        if (b.age >= life) { this.pop(b); ev.push({ type: 'pop', b, why: 'old' }); continue; }
        const k = Math.exp(-BUBBLE.drag * h); b.vx *= k; b.vz *= k; // a puff's push dies away
        let wx = b.vx + (b.stand ? b.sx * BUBBLE.steer : 0), wz = b.vz + (b.stand ? b.sz * BUBBLE.steer : 0), wy = 0;
        for (const v of env.winds || []) if (inBox(v, b.x, b.y, b.z) && gustAt(v, this.clock) === 1) { wx += (v.vx || 0) * wind; wy += (v.vy || 0) * wind; wz += (v.vz || 0) * wind; }
        b.x += wx * h; b.y += wy * h; b.z += wz * h;
        if (env.solid && sphereTouches(env.solid, b.x, b.y, b.z, R)) {
          b.wallT += h;
          if (b.wallT >= BUBBLE.wall) { this.pop(b); ev.push({ type: 'pop', b, why: 'wall' }); continue; }
        } else b.wallT = 0;
        for (const d of env.drips || []) {
          const y = dripAt(d, this.clock, this.drip);
          if (y !== null && Math.hypot(b.x - d.x, b.z - d.z) < R + 0.12 && Math.abs(y - b.y) < R + 0.1) { this.pop(b); ev.push({ type: 'pop', b, why: 'drip' }); break; }
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
// A gust lane: { x0, x1, z0, z1, vx, vz, period, on, warn, phase }: calm, then `warn` s of gathering puffs, then it blows for `on` s (gustAt).
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
// barHalf thick each side and turns at bar radians a second (times each arm's own `speed`); a bar of soap (the checkpoint: `stars` in the
// data, never drawn or named as a star) is touched within starR; after a pop you wait popWait s in a new bubble at the last one.
export const RIDE = { R: 0.8, sink: 0.75, puff: 1.2, puffTime: 0.3, push: 0.6, steer: 0.8, relax: 3, wall: 0.5, gap: 1.35, pass: 0.35, plate: 0.4, barHalf: 0.3, barSlab: 0.4, bar: 1.0, starR: 1.2, popWait: 0.6, maxPuffs: 6 };
// chim = { x, z, r (inside radius), floor (y of the floor's top face), top (done above this), plates: [{ y, a, d }], fan: { y0, y1, vx, vz },
//          fans?: [{ y0, y1, vx, vz }], bar: { y }, bars?: [{ y, speed }], stars: [{ x, y, z }] }  (stars = the soap bars' spots)
export const barsOf = c => c.bars || (c.bar ? [c.bar] : []);
// A plate's gap at ride clock t (a plate with `spin` turns slowly, radians a second).
export const gapOf = (chim, p, t = 0) => ({ x: chim.x + Math.cos(p.a + (p.spin || 0) * t) * p.d, z: chim.z + Math.sin(p.a + (p.spin || 0) * t) * p.d });
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
  barAngle(t = this.t, k = 0) { const b = barsOf(this.c)[k]; return t * this.barSpeed * (b?.speed ?? 1) + (b?.a0 || 0); }
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
      for (const f of c.fans || (c.fan ? [c.fan] : [])) if (this.y >= f.y0 && this.y < f.y1) { fx = f.vx; fz = f.vz; }
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
        const g = gapOf(c, p, this.t);
        if (Math.hypot(this.x - g.x, this.z - g.z) > this.gap - RIDE.pass) { this.burst(ev, 'spike'); return; }
      }
      // the spinning arms: from the middle to the wall, turning like clock hands
      const bars = barsOf(c);
      for (let k = 0; k < bars.length; k++) {
        const bar = bars[k];
        if (this.y + R * 0.7 < bar.y || this.y - R * 0.7 > bar.y + RIDE.barSlab) continue;
        const a = this.barAngle(this.t, k), dx = this.x - c.x, dz = this.z - c.z, along = Math.cos(a) * dx + Math.sin(a) * dz, off = Math.abs(-Math.sin(a) * dx + Math.cos(a) * dz);
        if (along > -R * 0.6 && off < RIDE.barHalf + R * 0.6) { this.burst(ev, 'bar'); return; }
      }
      const nx = c.stars[this.star + 1];
      if (nx && (Math.hypot(this.x - nx.x, this.y - nx.y, this.z - nx.z) < RIDE.starR || this.y >= nx.y - 1.0)) { this.star++; ev.push({ type: 'star', k: this.star }); } // (up past a ring's soap bar counts too: a turning ring carries it round)
      if (this.y >= c.top) { this.done = true; ev.push({ type: 'top' }); }
    });
    return ev;
  }
  burst(ev, why) { this.popT = 0; this.pops++; this.puffs = []; this.vx = 0; this.vz = 0; ev.push({ type: 'pop', why }); }
}


/* ------------------------------------------------------------------ Captain Suds' shields: drop onto them from above */
// Captain Suds sits sealed in a big bubble (DOME in bubbleland.js) that his three shield bubbles feed (owner 2026-10-30: "they didn't seem
// to be preventing him from battling"). A shield { x, y, z, r, ax, ay, az, period, phase }: its middle at clock t loops round (x, y, z)
// (ax / az across, ay up and down) once a `period`. f > 1 sways faster (a rematch), < 1 slower (the help). The first one rests low on the
// balcony's foam (a bubble on a soapy floor is a dome): a plain jump lands on it and walking into it boings you back, so a child learns
// "from the side = boing, from above = pop" by doing it. The other two bob high: a bubble ride from a soap pot under each.
// top: how near its middle (share of r) a stomp must land (beyond it, on its shoulder, you slide off with a boing); body: your half-width;
// height: your height; rise: how fast a stomp bounces you back up (blocks a second); push: how fast a boing pushes you out (blocks a second).
export const SHIELD_RULES = { top: 0.7, body: 0.3, height: 1.8, rise: 7.5, push: 9 };
export function shieldAt(s, t, f = 1) {
  const w = 2 * Math.PI * t * f / s.period + (s.phase || 0);
  return { x: s.x + (s.ax || 0) * Math.sin(w), y: s.y + (s.ay || 0) * Math.sin(2 * w), z: s.z + (s.az || 0) * Math.cos(w) };
}
// Your feet meet a sphere at middle c with radius r: 'pop' (you came down onto its top, near the middle), { bump: [nx, nz], up } (your
// body touches it anywhere else: beside it, under it, or your feet come down onto its shoulder: it boings you away; up = from above),
// or null (not touching; also while you are still above its top). feet / prev = your feet now and a frame ago, vy your speed up. Any
// frame rate: a stomp is the feet coming down through its surface since the last frame.
export function stomp(c, r, { x, z, feet, prev = feet, vy = 0 }) {
  const d = Math.hypot(x - c.x, z - c.z), n = d > 1e-6 ? [(x - c.x) / d, (z - c.z) / d] : [1, 0];
  const R = SHIELD_RULES, surf = d < r ? c.y + Math.sqrt(r * r - d * d) : null; // its top surface right under your middle
  if (surf !== null && feet >= surf - 0.05) { // over it
    if (vy > 0 || feet > surf + 0.2) return null; // still above it (or rising off it)
    if (prev < surf - 0.15) return null;
    return d <= r * R.top ? 'pop' : { bump: n, up: true }; // down onto its top: pop; onto its shoulder: you slide off, boing
  }
  // beside or under it: does your body (a column `body` wide each side, `height` tall) reach into it?
  const e = Math.max(0, d - R.body); // the nearest your column gets to its middle, across
  if (e >= r) return null;
  const h = Math.sqrt(r * r - e * e);
  return feet < c.y + h && feet + R.height > c.y - h ? { bump: n, up: false } : null;
}
// How far out (across, from its middle) you stand clear of a sphere at middle c, radius r, with your feet at `feet`: the boing's push.
export function clearOf(c, r, feet) {
  const lo = feet, hi = feet + SHIELD_RULES.height, dy = c.y < lo ? lo - c.y : c.y > hi ? c.y - hi : 0;
  return dy >= r ? 0 : Math.sqrt(r * r - dy * dy) + SHIELD_RULES.body + 0.02;
}
export const shieldSize = (s, help = 0, hard = false) => s.r * H(help, 'shield') * (hard ? HARD.shield : 1);
export const shieldSway = (help = 0, hard = false) => H(help, 'sway') * (hard ? HARD.sway : 1);
