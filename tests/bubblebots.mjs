// Model players for the Bubble Well (pure, Node and page), like castlebots.mjs (plans/bubble-well.md "Rework 2026-10-29": every game
// has a naive kid that must fail or rarely win and a skilled one that must win). The ducklings, the Chimney Ride and the shields are played
// on the pure rules (bubbles.js) at `fps` frames a second (the input is decided once per frame, like a real player, and held for the
// frame); the Fizz Ledges and the shields are played in the page with the real Player physics by kids that only press keys (p.keys)
// and the big button (live.use, the E / tap path), see makeKid and makeShieldKid.
//   node tests/bubblebots.mjs   prints a table (calibration)
import { Duckling, DUCK, puffSpeed, gustAt, Ride, RIDE, gapOf, barsOf, BUBBLE, shieldAt } from '../src/bubbles.js';
import { GARDEN_RULES, ISLANDS, NEST, CHIMNEY, GUSTS, LEDGES, SOAP_POTS, RIM_POTS, WINDS, SHIELDS, MESA, RIM, FLOOR } from '../src/bubbleland.js';

// A small seeded random (mulberry32), so every robot run is the same.
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------------------------------------------------------------- the ducklings */
// The way each duckling should go (waypoints; the last is the nest): straight; across the current; through the thorn pen's two gaps,
// crossing the gusty gap in one quick glide between two gusts.
export const DUCK_WAYS = [
  [[NEST.x, NEST.z]],
  [[68.5, 44.5], [NEST.x, NEST.z]],
  [[94.25, 57.5], [92.7, 51.5], [85.25, 51.5], [85.25, 46.5], [NEST.x, NEST.z]],
];
// A player decides a puff when the duckling has (nearly) stopped: { dx, dz, dist } or null (wait).
const inNest = d => Math.hypot(d.x - NEST.x, d.z - NEST.z) < d.nestR - 0.1; // every player waits while it settles in the nest
// Can the duckling glide straight from where it is to (x, z) without a thorn on the way (with a little room to spare)?
const clearTo = (d, [x, z]) => (GARDEN_RULES.thorns || []).every(([tx, tz]) => {
  const ux = x - d.x, uz = z - d.z, l2 = ux * ux + uz * uz || 1, k = Math.max(0, Math.min(1, ((tx - d.x) * ux + (tz - d.z) * uz) / l2));
  return Math.hypot(d.x + ux * k - tx, d.z + uz * k - tz) > DUCK.r + DUCK.thorn + 0.35;
});
// Does the glide from the duckling to (x, z) cross a gust lane? Has a gust just stopped blowing (the longest calm is ahead)?
const crossesGust = (d, [x, z]) => (GARDEN_RULES.gusts || []).some(g => Array.from({ length: 21 }, (_, k) => k / 20).some(f => { const px = d.x + (x - d.x) * f, pz = d.z + (z - d.z) * f; return px >= g.x0 - 0.5 && px < g.x1 + 0.5 && pz >= g.z0 && pz < g.z1; }));
const justCalm = d => (GARDEN_RULES.gusts || []).every(g => gustAt(g, d.t) === 0 && gustAt(g, d.t - 0.4) === 1);
export const DUCK_BOTS = {
  // reads the duckling: follows the waypoints, stands just far enough for the glide it needs, aims a bit upstream in a current, and in
  // the gust lane only puffs right after a gust (so the next one finds it on the lane's safe side)
  skilled: (i) => {
    let w = 0;
    return (d, t) => {
      const way = DUCK_WAYS[i];
      if (d.age < 0.05) w = 0; // a new bubble on its island: from the start again
      while (w < way.length - 1 && Math.hypot(way[w][0] - d.x, way[w][1] - d.z) < 0.8) w++;
      if (i === 2) { w = 0; for (let k = way.length - 1; k >= 0; k--) if (clearTo(d, way[k])) { w = k; break; } } // the furthest point it can glide to past no thorn (a gust may have pushed it back)
      const [tx, tz] = way[w], cur = (GARDEN_RULES.currents || []).find(c => d.x >= c.x0 - 3 && d.x < c.x1 + 3 && d.z >= c.z0 && d.z < c.z1);
      if (inNest(d) || (d.speed > 0.15 && !(cur && d.speed > 0.15 && t - (d._last ?? -9) > 1.2))) return null;
      const gusty = crossesGust(d, way[w]);
      if (gusty && !justCalm(d)) return null; // across the gusty gap: wait till a gust has just blown over, then one quick strong puff
      let dx = tx - d.x, dz = tz - d.z;
      const far = Math.hypot(dx, dz), last = w === way.length - 1;
      const k = d.friction, v = gusty ? DUCK.max : Math.min(DUCK.max, Math.max(DUCK.min, far * k * (last ? 0.95 : 1.05)));
      if (cur) { const time = far / Math.max(0.5, v); dx -= cur.vx * time * 0.5; dz -= cur.vz * time * 0.5; } // aim upstream
      const dist = DUCK.near + (DUCK.max - v) / (DUCK.max - DUCK.min) * (DUCK.far - DUCK.near);
      d._last = t;
      return { dx, dz, dist };
    };
  },
  // always the biggest puff, straight at the nest
  pusher: () => (d) => (d.speed > 0.2 || inNest(d) ? null : { dx: NEST.x - d.x, dz: NEST.z - d.z, dist: DUCK.near }),
  // little puffs straight at the nest, never minding the thorns, the current or the gusts
  straight: () => (d) => (d.speed > 0.2 || inNest(d) ? null : { dx: NEST.x - d.x, dz: NEST.z - d.z, dist: Math.min(DUCK.far, DUCK.near + Math.hypot(NEST.x - d.x, NEST.z - d.z) * 0.1) }),
  // follows the right way (it read the hint) but puffs whenever the duckling stops, never minding the gusts
  noGust: (i) => {
    let w = 0;
    return (d) => {
      const way = DUCK_WAYS[i];
      if (d.age < 0.05) w = 0;
      while (w < way.length - 1 && Math.hypot(way[w][0] - d.x, way[w][1] - d.z) < 0.8) w++;
      if (inNest(d) || d.speed > 0.15) return null;
      const [tx, tz] = way[w], far = Math.hypot(tx - d.x, tz - d.z), v = Math.min(DUCK.max, Math.max(DUCK.min, far * d.friction * 1.05));
      return { dx: tx - d.x, dz: tz - d.z, dist: DUCK.near + (DUCK.max - v) / (DUCK.max - DUCK.min) * (DUCK.far - DUCK.near) };
    };
  },
};
export function playDuck(bot, { i = 0, fps = 60, help = 0, hard = false, time = 120, clock = 0 } = {}) {
  const d = new Duckling(GARDEN_RULES, ISLANDS[i], { help, hard }), dt = 1 / fps;
  let t = 0, pops = 0, puffs = 0, wakes = 0;
  d.blow(clock);
  while (t < time && d.state !== 'home') {
    if (d.state === 'sleep' || d.state === 'waddle') d.blow(d.t);
    const p = bot(d, t);
    if (p && d.puff(p.dx, p.dz, p.dist)) puffs++;
    for (const e of d.step(dt)) { if (e.type === 'pop') pops++; if (e.type === 'wake') wakes++; }
    t += dt;
  }
  return { won: d.state === 'home', pops, wakes, puffs, time: t };
}

/* ---------------------------------------------------------------- the Chimney Ride */
// A rider decides { tap, sx, sz } every frame.
export const RIDE_BOTS = {
  // lines up under each gap while hovering, rises through, waits beside each arm until it has gone round, then rises past it (the
  // pieces in the order they come on the way up: owner 2026-10-30, a gold ring and a second arm above the first arm)
  skilled: () => {
    let last = -9, k = 0, go = false, star = 0;
    return (r) => {
      const c = r.c, R = RIDE.R;
      const pieces = [...c.plates.map(p => ({ plate: p, y: p.y, top: p.y + RIDE.plate })), ...barsOf(c).map((b, i) => ({ bar: b, i, y: b.y, top: b.y + RIDE.barSlab }))].sort((a, b) => a.y - b.y);
      let tx, tz, ty, gap = 0.45; // gap: the least time between taps (hovering wants gentle taps, going up quick ones)
      if (r.popT !== null) { go = false; return { tap: false, sx: 0, sz: 0 }; }
      if (r.star < star) { k = pieces.findIndex(q => q.plate === c.plates[r.star]) + 1; go = false; } // popped back to the last soap bar
      star = r.star;
      while (k < pieces.length && r.y > pieces[k].top + R * 0.8) { k++; go = false; }
      const q = pieces[k], prev = pieces[k - 1], floorY = prev ? prev.top + R * 0.7 + 0.45 : -1e9; // (hover above the piece below, too)
      if (q?.plate) {
        const p = q.plate, g = gapOf(c, p, r.t + 0.4), now = gapOf(c, p, r.t); // (a turning plate: steer to where its gap will be in a moment)
        tx = g.x; tz = g.z;
        if (Math.hypot(r.x - now.x, r.z - now.z) < 0.3) go = true;
        if (go) { ty = p.y + RIDE.plate + R + 0.9; gap = 0.16; } else ty = Math.max(p.y - R - 1.6, floorY);
      } else if (q?.bar) { // an arm: wait across the chimney from it, then go up when it has just gone past
        tx = c.x + Math.cos(2.6) * 2.4; tz = c.z + Math.sin(2.6) * 2.4;
        const s = Math.sign(q.bar.speed ?? 1) || 1, a = Math.atan2(r.z - c.z, r.x - c.x);
        const behind = ((((r.barAngle(r.t, q.i) - a) * s) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); // how far the arm has gone past you
        const fast = Math.abs(q.bar.speed ?? 1) >= 0.9, lo = fast ? 0.9 : 0.6, hi = fast ? 2.2 : 1.7;
        if (go || (behind > lo && behind < hi && Math.hypot(r.x - tx, r.z - tz) < 0.5)) { go = true; ty = q.top + R + 1.2; gap = 0.16; }
        else ty = Math.max(q.y - R - 1.4, floorY);
      } else { tx = c.x; tz = c.z; ty = c.top + 1; gap = 0.16; } // the top
      const ex = tx - r.x, ez = tz - r.z, l = Math.hypot(ex, ez), sp = Math.min(1, l * 1.6);
      const fan = (c.fans || [c.fan]).find(f => r.y >= f.y0 - 0.5 && r.y < f.y1 + 0.5), fx = fan ? fan.vx / RIDE.steer : 0, fz = fan ? fan.vz / RIDE.steer : 0;
      let sx = (l > 1e-6 ? ex / l * sp : 0) - fx, sz = (l > 1e-6 ? ez / l * sp : 0) - fz;
      const sl = Math.hypot(sx, sz); if (sl > 1) { sx /= sl; sz /= sl; }
      const tap = r.y < ty && r.t - last > gap;
      if (tap) last = r.t;
      return { tap, sx, sz };
    };
  },
  still: () => () => ({ tap: false, sx: 0, sz: 0 }),               // never taps
  spammer: () => { let last = -9; return r => { const tap = r.t - last > 0.1; if (tap) last = r.t; return { tap, sx: 0, sz: 0 }; }; }, // taps all the time, no steering
};
export function playRide(bot, { fps = 60, help = 0, hard = false, time = 120 } = {}) {
  const r = new Ride(CHIMNEY, { help, hard }), dt = 1 / fps;
  let t = 0, stars = 0;
  while (t < time && !r.done) {
    const b = bot(r);
    if (b.tap) r.tap(0, 0);
    for (const e of r.step(dt, { sx: b.sx, sz: b.sz })) if (e.type === 'star') stars = Math.max(stars, e.k);
    t += dt;
  }
  return { won: r.done, pops: r.pops, stars, time: t };
}


/* ---------------------------------------------------------------- the Fizz Ledges and the shields (in the page, with the real Player) */
// Redesign 2026-10-29 ("natural rules"). Kids that only press keys (p.keys W / Space, the look) and the big button (live.use, the E / tap
// path), like a child with a keyboard or a tablet; the caller runs p.update(dt) and live.step(dt) after each tick. A leg: from the floor
// you stand on (feet y `from`), walk to its soap pot (the wand dips), walk to `stand`, face `yaw`, Blow!, hop on the bubble, ride it,
// hop off onto the box `to` (its top block `top`). `gust`: the leg's air is blown by a gust now and then (WINDS). Kinds:
//   skilled    waits for a calm moment after a gust, leans its bubble toward the next ledge, hops off when it is high and close enough
//   firsttime  does the obvious and nothing more: dips, faces the ledge, blows, hops on, hops off once its feet are above the ledge
//   nowind     the skilled kid's timing, but it never leans and never minds the gusts
//   masher     hops onto its bubble and straight off again toward the ledge (no ride)
//   random     blows any old way, hops off at a random moment, never leans
//   pillar     the chapter-1 sky-gym trick: jump, look down, press the button in the air, again and again
export const YAW = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 };
const PLATEAU = { x0: 104, x1: 124, z0: 56, z1: 66, top: MESA.top };
const box = l => ({ x0: l.x0, x1: l.x1, z0: l.z0, z1: l.z1, top: l.top });
export const LEGS = [
  { from: FLOOR + 1, pot: SOAP_POTS[0], stand: [100.5, 80.4], yaw: YAW.n, to: box(LEDGES[0]) },
  { from: LEDGES[0].top + 1, pot: SOAP_POTS[1], stand: [102.6, 75.4], yaw: YAW.e, to: box(LEDGES[1]) },
  { from: LEDGES[1].top + 1, pot: SOAP_POTS[2], stand: [109.6, 70.5], yaw: YAW.e, to: box(LEDGES[2]) }, // (the stream blows south: blow from the north corner)
  { from: LEDGES[2].top + 1, pot: SOAP_POTS[3], stand: [114.0, 68.5], yaw: YAW.w, to: PLATEAU, gust: WINDS.find(w => w.id === 'gust') },
];
export const KIDS = { // spot: where it blows from ('best' = the leg's stand and yaw; 'pot' = right by the pot, facing the next ledge)
  skilled: { lean: true, gust: true, hop: 'ready', spot: 'best' },
  firsttime: { lean: false, gust: false, hop: 'above', spot: 'pot' },
  nowind: { lean: false, gust: false, hop: 'ready', spot: 'pot' },
  nolean: { lean: false, gust: false, hop: 'ready', spot: 'best' }, // (blows from the right corner, but never leans and never minds the gusts)
  masher: { lean: false, gust: false, hop: 'now', spot: 'pot' },
  random: { lean: false, gust: false, hop: 'random', wobble: 0.8, spot: 'pot' },
  pillar: { pillar: true },
};
const yawTo = (from, x, z) => Math.atan2(-(x - from.x), -(z - from.z));
// The point of box b nearest to (x, z), pulled `inside` blocks into it.
const nearIn = (b, x, z, inside = 0.9) => ({ x: Math.max(b.x0 + inside, Math.min(b.x1 + 1 - inside, x)), z: Math.max(b.z0 + inside, Math.min(b.z1 + 1 - inside, z)) });
// The tick for one kid on `legs` (LEGS, or a slice): ({ p, live, dt }) -> null | 'done' (it stands on the last leg's goal).
export function makeKid(kind, legs = LEGS, { seed = 1 } = {}) {
  const K = KIDS[kind], r = rng(seed), goal = legs.at(-1).to.top + 1;
  let phase = 'pot', t = 0, target = null, hopAt = 0, wait = 0, legY = null, clock = 0, jumped = false;
  return ({ p, live, dt = 1 / 60 }) => {
    clock += dt; t += dt;
    const on = p.carry === live.standObj && !!live.stood, ground = p.onGround && !p.carry;
    p.keys.Space = false;
    if (ground && Math.abs(p.pos.y - goal) < 0.3) { p.keys = {}; return 'done'; }
    if (K.pillar) {
      p.pitch = -1.5; p.keys.KeyW = false;
      if (ground) { if ((wait += dt) > 0.25) { live.use(p); p.keys.Space = true; wait = 0; jumped = true; } return null; }
      if (on) { live.use(p); p.keys.Space = true; return null; }
      if (jumped && p.vel.y < 1.5) { live.use(p); jumped = false; }
      return null;
    }
    if (ground && legY !== Math.round(p.pos.y) && phase !== 'walk') { legY = Math.round(p.pos.y); phase = 'pot'; t = 0; } // on a floor (a new one, or back after a fall)
    if (ground && (phase === 'ride' || phase === 'hop' || phase === 'air') && t > 0.3) { phase = 'pot'; t = 0; } // landed somewhere: start over from there
    const L = legs.find(l => Math.abs(l.from - (legY ?? p.pos.y)) < 0.3);
    if (!L) return null;
    const walkTo = (x, z, next) => {
      const d = Math.hypot(x - p.pos.x, z - p.pos.z);
      if (d < 0.22) { p.keys.KeyW = false; phase = next; t = 0; return; }
      p.yaw = yawTo(p.pos, x, z); p.pitch = -0.2; p.keys.KeyW = true;
    };
    if (phase === 'pot') { if (!ground) return null; walkTo(L.pot[0], L.pot[2], 'walk'); return null; }
    if (phase === 'walk') { if (K.spot === 'best') walkTo(L.stand[0], L.stand[1], 'aim'); else { phase = 'aim'; t = 0; } return null; }
    if (phase === 'aim') {
      p.keys.KeyW = false;
      const c = { x: (L.to.x0 + L.to.x1 + 1) / 2, z: (L.to.z0 + L.to.z1 + 1) / 2 }, yaw = K.spot === 'best' ? L.yaw : yawTo(p.pos, c.x, Math.min(c.z, p.pos.z + 99));
      p.yaw = yaw + (K.wobble ? (r() - 0.5) * 2 * K.wobble : 0); p.pitch = -0.25;
      if (t < 0.15) return null;
      if (K.gust && L.gust) { const c = live.field.clock, g = L.gust; if (!(gustAt(g, c) === 0 && gustAt(g, c - 0.25) === 1)) return null; } // right after a gust
      if (!live.wet) { phase = 'pot'; return null; }
      const n0 = live.field.n;
      live.use(p);
      target = live.field.list.find(b => b.id > n0) || null;
      if (!target) { phase = 'pot'; return null; }
      p.yaw = yawTo(p.pos, target.x, target.z); p.keys.KeyW = true; p.keys.Space = true; phase = 'hop'; t = 0; // hop on at once
      return null;
    }
    if (phase === 'hop') {
      if (live.field.list.includes(target)) { const dx = target.x - p.pos.x, dz = target.z - p.pos.z; p.yaw = Math.atan2(-dx, -dz); p.keys.KeyW = Math.hypot(dx, dz) > 0.2; }
      if (on && live.stood) { p.keys.KeyW = false; phase = 'ride'; t = 0; hopAt = K.hop === 'random' ? 0.3 + r() * 2.7 : 0; }
      return null;
    }
    if (phase === 'ride') {
      if (!on) { phase = 'air'; t = 0; return null; }
      const b = live.stood, to = L.to, q = nearIn(to, p.pos.x, p.pos.z), d = Math.hypot(q.x - p.pos.x, q.z - p.pos.z);
      const up = BUBBLE.bounce + (p.pos.y - (to.top + 1)); // how far above the ledge's top a Bounce now gets your feet
      p.yaw = yawTo(p.pos, q.x, q.z);
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), wall = [0, -0.5].some(dy => live.world.isSolid(Math.floor(b.x + fx * (BUBBLE.r + 0.4)), Math.floor(b.y + dy), Math.floor(b.z + fz * (BUBBLE.r + 0.4))));
      p.keys.KeyW = !!K.lean && !wall && d > 0.5; // (a skilled kid never leans its bubble into a wall)
      const late = b.age > live.field.life - 0.3;
      const hop = K.hop === 'now' ? t > 0.1 : K.hop === 'random' ? t > hopAt : K.hop === 'above' ? (p.pos.y > to.top + 1 + 0.1 || late) : ((up > 0.35 && d < 2.0) || (late && up > 0.1));
      if (hop) { p.keys.Space = true; p.keys.KeyW = true; phase = 'air'; t = 0; }
      return null;
    }
    if (phase === 'air') { const q = nearIn(L.to, p.pos.x, p.pos.z, 1.2); p.yaw = yawTo(p.pos, q.x, q.z); p.keys.KeyW = Math.hypot(q.x - p.pos.x, q.z - p.pos.z) > 0.3; return null; }
    return null;
  };
}

// Captain Suds' shields (owner 2026-10-30: the high ones need a bubble ride; the low first one rests on the balcony right in front of him):
// a kid on the rim. The high ones (k = 1, 2): from the soap pot under it the kid faces its shield, Blow!, hops on, rides, hops off and
// steers down onto it. Kinds: skilled (blows when the shield will be just over its bubble's way up, leans toward it, hops off once high
// enough and close, then steers onto its top), random (any way, any moment), masher (straight off again). -> tick returning null | 'pop'
export const RIM_LEG = { from: RIM.y + 1, pots: RIM_POTS };
// The low first shield: a kid walks at it from the balcony's front, as a child walks toward Captain Suds. Kinds: firsttime (walks at it
// and jumps once it is a step or two away: what a child does when a bubble is in its way; each try at a new distance), walker (only walks
// into it: boing, boing), underjump (stands under a high shield, k, and jumps at it again and again: the chapter-1 trick, never a pop).
export function makeLowShieldKid(kind, { seed = 1, k = 0 } = {}) {
  const r = rng(seed), next = () => 1.2 + r() * 1.8;
  let t = 0, at = next(), boings = null;
  return ({ p, live, dt = 1 / 60 }) => {
    t += dt; p.keys.Space = false;
    if (!live.shieldUp(k)) { p.keys = {}; return 'pop'; }
    const { c } = live.shieldNow(k), d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z), ground = p.onGround && !p.carry;
    if (boings !== null && live.boings > boings && kind === 'firsttime') at = 9; // boing! (a child jumps at it next)
    boings = live.boings;
    p.yaw = yawTo(p.pos, c.x, c.z); p.keys.KeyW = kind !== 'underjump' || d > 0.3;
    if (kind === 'walker' || !ground || t < 0.35) return null;
    if (kind === 'underjump' ? d < 0.6 : d <= at) { p.keys.Space = true; t = 0; at = next(); }
    return null;
  };
}
export function makeShieldKid(kind, k, { seed = 1 } = {}) {
  const r = rng(seed);
  let phase = 'pot', t = 0, target = null, hopAt = 0, start = 0;
  const S = SHIELDS[k], pot = RIM_POTS[k];
  return ({ p, live, dt = 1 / 60 }) => {
    t += dt;
    const on = p.carry === live.standObj && !!live.stood, ground = p.onGround && !p.carry;
    p.keys.Space = false;
    if (!live.shieldUp(k)) { p.keys = {}; return 'pop'; }
    if (ground && (phase === 'ride' || phase === 'air' || phase === 'hop') && t > 0.3) { phase = 'pot'; t = 0; }
    const sh = live.shieldNow(k), future = s => shieldAt(S, live.courtT + s);
    if (phase === 'pot') {
      const d = Math.hypot(pot[0] - p.pos.x, pot[2] - p.pos.z);
      if (d < 0.22 && live.wet) { p.keys.KeyW = false; phase = 'aim'; t = 0; start = 0; return null; }
      p.yaw = yawTo(p.pos, pot[0], pot[2]); p.keys.KeyW = d >= 0.22; return null;
    }
    if (phase === 'aim') {
      p.keys.KeyW = false;
      if (kind === 'skilled') { // the shield where it will be when the bubble is up, the bubble's way (blown 1.5 out, carried by the breeze)
        const f = future(2.8); p.yaw = yawTo(p.pos, f.x, f.z + 1.2); p.pitch = -0.2;
        const dir = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) }, bx = p.pos.x + dir.x * BUBBLE.ahead, bz = p.pos.z + dir.z * BUBBLE.ahead - 0.45 * 2.8;
        if (Math.hypot(f.x - bx, f.z - bz) > 2.2 && t < 6) return null; // wait for a moment when it comes over
      } else { p.yaw = yawTo(p.pos, sh.c.x, sh.c.z) + (r() - 0.5) * 2; if (t < 0.3 + r() * 0.5) return null; }
      const n0 = live.field.n;
      live.use(p);
      target = live.field.list.find(b => b.id > n0) || null;
      if (!target) { phase = 'pot'; return null; }
      p.yaw = yawTo(p.pos, target.x, target.z); p.keys.KeyW = true; p.keys.Space = true; phase = 'hop'; t = 0;
      return null;
    }
    if (phase === 'hop') {
      if (live.field.list.includes(target)) { const dx = target.x - p.pos.x, dz = target.z - p.pos.z; p.yaw = Math.atan2(-dx, -dz); p.keys.KeyW = Math.hypot(dx, dz) > 0.2; }
      if (on) { p.keys.KeyW = false; phase = 'ride'; t = 0; hopAt = kind === 'masher' ? 0.1 : 0.3 + r() * 3; }
      return null;
    }
    if (phase === 'ride') {
      if (!on) { phase = 'air'; t = 0; return null; }
      const b = live.stood, d = Math.hypot(sh.c.x - p.pos.x, sh.c.z - p.pos.z), top = sh.c.y + sh.r;
      p.yaw = yawTo(p.pos, sh.c.x, sh.c.z); p.keys.KeyW = kind === 'skilled' && d > 1.0;
      const late = b.age > live.field.life - 0.3;
      const hop = kind === 'skilled' ? ((p.pos.y + BUBBLE.bounce > top + 0.3 && d < 2.4) || late) : t > hopAt;
      if (hop) { p.keys.Space = true; p.keys.KeyW = true; phase = 'air'; t = 0; }
      return null;
    }
    if (phase === 'air') { const d = Math.hypot(sh.c.x - p.pos.x, sh.c.z - p.pos.z); p.yaw = yawTo(p.pos, sh.c.x, sh.c.z); p.keys.KeyW = d > 0.25; return null; } // (any child steers at it in the air)
    return null;
  };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('bubblebots.mjs')) {
  for (const fps of [60, 20]) {
    const row = (name, f) => console.log(`@${fps} ${name}: ${f()}`);
    for (let i = 0; i < 3; i++) for (const b of ['skilled', 'pusher', 'straight', 'noGust']) row(`duck ${i + 1} ${b}`, () => { const r = playDuck(DUCK_BOTS[b](i), { i, fps }); const h = playDuck(DUCK_BOTS[b](i), { i, fps, help: 6 }); const hd = playDuck(DUCK_BOTS[b](i), { i, fps, hard: true }); return `${JSON.stringify(r)} help ${h.won} hard ${hd.won} ${hd.time.toFixed(0)}`; });
    for (const b of ['skilled', 'still', 'spammer']) row(`ride ${b}`, () => { const r = playRide(RIDE_BOTS[b](), { fps }); const hd = playRide(RIDE_BOTS[b](), { fps, hard: true }); return `${JSON.stringify(r)} hard ${hd.won} ${hd.pops}`; });
  }
}
