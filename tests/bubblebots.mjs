// Model players for the Bubble Well (pure, Node and page), like castlebots.mjs (plans/bubble-well.md "Rework 2026-10-29": every game
// has a naive kid that must fail or rarely win and a skilled one that must win). The ducklings, the Chimney Ride and the shields are played
// on the pure rules (bubbles.js) at `fps` frames a second (the input is decided once per frame, like a real player, and held for the
// frame); the Bubble Stairs are climbed in the page with the real Player physics by kids that only press keys (p.keys) and the big button
// (live.use, the E / tap path), see makeKid.
//   node tests/bubblebots.mjs   prints a table (calibration)
import { Duckling, DUCK, puffSpeed, gustAt, Ride, RIDE, gapOf, BUBBLE, BANK, bankShot, aimLine } from '../src/bubbles.js';
import { GARDEN_RULES, ISLANDS, NEST, CHIMNEY, GUSTS, COURT, courtOf, DRIPS } from '../src/bubbleland.js';

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
  // lines up under each gap while hovering, rises through, waits beside the bar until it has gone round, then rises past it
  skilled: () => {
    let last = -9, k = 0, go = false;
    return (r) => {
      const c = r.c, R = RIDE.R;
      let tx, tz, ty, gap = 0.45; // gap: the least time between taps (hovering wants gentle taps, going up quick ones)
      if (r.popT !== null) { go = false; return { tap: false, sx: 0, sz: 0 }; }
      while (k < c.plates.length && r.y > c.plates[k].y + RIDE.plate + R * 0.8) { k++; go = false; }
      if (k > 0 && r.star < k) k = r.star; // popped back below a plate
      if (k < c.plates.length) {
        const p = c.plates[k], g = gapOf(c, p);
        tx = g.x; tz = g.z;
        if (Math.hypot(r.x - g.x, r.z - g.z) < 0.2) go = true;
        if (go) { ty = p.y + RIDE.plate + R + 0.9; gap = 0.16; } else ty = p.y - R - 1.6;
      } else { // the arm: wait across the chimney from it, then go up when it has just gone past
        tx = c.x + Math.cos(2.6) * 2.4; tz = c.z + Math.sin(2.6) * 2.4;
        const a = Math.atan2(r.z - c.z, r.x - c.x), behind = (((r.barAngle() - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); // how far the arm has gone past you
        if (r.y > c.bar.y + RIDE.barSlab + R * 0.7) { ty = c.top + 1; gap = 0.16; }
        else if (go || (behind > 0.9 && behind < 2.2 && Math.hypot(r.x - tx, r.z - tz) < 0.5)) { go = true; ty = c.top + 1; gap = 0.16; }
        else ty = c.bar.y - R - 1.4;
      }
      const ex = tx - r.x, ez = tz - r.z, l = Math.hypot(ex, ez), s = Math.min(1, l * 1.6);
      const fx = c.fan && r.y >= c.fan.y0 - 0.5 && r.y < c.fan.y1 + 0.5 ? c.fan.vx / RIDE.steer : 0, fz = c.fan && r.y >= c.fan.y0 - 0.5 && r.y < c.fan.y1 + 0.5 ? c.fan.vz / RIDE.steer : 0;
      let sx = (l > 1e-6 ? ex / l * s : 0) - fx, sz = (l > 1e-6 ? ez / l * s : 0) - fz;
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

/* ---------------------------------------------------------------- Captain Suds' shields (bank shots) */
// Shooters stand on round k's pad and decide a yaw (radians, 0 = north, as the Player's yaw) at court clock t, or null (wait a moment).
const dirOf = yaw => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
const fromOf = (pad, d) => ({ x: pad.x + d.x * BANK.from, z: pad.z + d.z * BANK.from });
export const shotAt = (k, yaw, t0 = 0, opts = {}) => { const c = courtOf(k), d = dirOf(yaw); return bankShot(c, fromOf(c.pad, d), d, { t0, ...opts }); };
const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
// The yaws (step in radians) that hit from round k's pad when blown at court clock t0: [[from, to]...] (only the front half).
export function hitWindows(k, t0 = 0, step = 0.004, opts = {}) {
  const c = courtOf(k), out = [];
  let cur = null;
  for (let y = -Math.PI; y < Math.PI; y += step) {
    if (shotAt(k, y, t0, opts).hit) { if (cur && Math.abs(cur[1] + step - y) < 1e-9) cur[1] = y; else { cur = [y, y]; out.push(cur); } } else cur = null;
  }
  return out;
}
export const SHOT_BOTS = {
  // blows straight at the shield (the first thing a child tries)
  naive: (k) => () => yawTo(COURT.rounds[k].pad, courtOf(k).target),
  // blows any old way in front (random, seeded)
  random: (k, seed = 7) => { const r = rng(seed), base = yawTo(COURT.rounds[k].pad, courtOf(k).target); return () => base + (r() - 0.5) * Math.PI; },
  // reads the dotted line: turns until its bounce stub points at the shield (only what the aim line shows), then blows; waits while
  // the line shows no bounce toward it (the slider is not there yet)
  reader: (k) => (t0) => {
    const c = courtOf(k);
    let best = null;
    for (let y = -Math.PI; y < Math.PI; y += 0.004) {
      const d = dirOf(y), line = aimLine(c, fromOf(c.pad, d), d, { t0 });
      if (line.length < 3) continue;
      const [ax, az] = line[1], [bx, bz] = line[2], ux = bx - ax, uz = bz - az, l = Math.hypot(ux, uz) || 1;
      const tx = c.target.x - ax, tz = c.target.z - az, along = (tx * ux + tz * uz) / l, off = Math.abs(-uz / l * tx + ux / l * tz);
      if (along > 0 && (!best || off < best.off)) best = { y, off };
    }
    return best && best.off < c.radius * 0.5 ? best.y : null;
  },
  // knows the court: the middle of the widest window that hits now (waits for the slider when there is none)
  skilled: (k) => (t0) => { const w = hitWindows(k, t0, 0.004).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0]; return w && w[1] - w[0] > 0.01 ? (w[0] + w[1]) / 2 : null; },
};
// Plays round k: `tries` shots (a shot every `gap` seconds of court clock, a wait counts no shot), aim noise `wobble` radians (a child's
// hand). -> { hits, shots, first (the shot that first hit, 1-based, or 0) }
export function playShots(bot, k, { tries = 20, gap = 1.5, wobble = 0, seed = 3, help = 0, hard = false, t0 = 0 } = {}) {
  const r = rng(seed);
  let t = t0, hits = 0, shots = 0, first = 0, waits = 0;
  while (shots < tries && waits < 400) {
    const y = bot(t);
    if (y === null) { t += 0.1; waits++; continue; }
    shots++;
    const s = shotAt(k, y + (r() - 0.5) * 2 * wobble, t, { help, hard });
    if (s.hit) { hits++; if (!first) first = shots; }
    t += gap;
  }
  return { hits, shots, first };
}

/* ---------------------------------------------------------------- the Bubble Stairs (in the page, with the real Player) */
// The two shafts as legs from each ledge (by the height you stand at): which ways to blow, in turn, and where the ledge to hop onto is.
// shaft 1: from the floor one bubble north and a hop onto the low step; from the step east, west, east... (the bench is right ahead,
// too close for a bubble) and a hop north onto the bench. shaft 2: north up the narrow shaft (back south when the wall is in the way)
// and a hop north onto the plateau.
export const YAW = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 };
export const ROUTES = {
  shaft1: { start: [104.5, 5, 76.5], goal: 11, legs: { 5: { dirs: ['n'], ledge: { dir: 'n', y: 7 } }, 7: { dirs: ['e', 'w'], ledge: { dir: 'n', y: 11 } } } },
  shaft2: { start: [112.5, 11, 69.5], goal: 19, legs: { 11: { dirs: ['n'], ledge: { dir: 'n', y: 19 } } } },
};
// The kids (what they do between Blow! and the hop):
//   skilled  lets each bubble float up until its top is well above its feet (`want`), blows beside a drip's spout, steers at its bubble
//   masher   hops the moment it has blown (the hint read too literally: "blow, hop on, hop again")
//   spam     random waits, a wobbly aim, sometimes blows twice
//   pillar   the chapter-1 sky-gym trick: jump, look down, Blow! under its feet, again and again
export const KIDS = {
  skilled: { want: { ground: 1.0, bubble: 1.3 }, dodge: true, steer: true },
  masher: { want: { ground: -9, bubble: -9 }, dodge: false, steer: true },
  spam: { random: true, dodge: false, steer: true },
  pillar: { pillar: true },
};
const solidAt = (live, x, y, z) => live.world.isSolid(Math.floor(x), Math.floor(y), Math.floor(z));
// The tick for one kid: ({ p, live, dt }) -> null | 'done' (stands on the goal ledge). It only sets p.keys / p.yaw / p.pitch and presses
// the big button (live.use), like a child with a keyboard or a tablet. The caller then runs p.update(dt) and live.step(dt).
export function makeKid(kind, route, { seed = 1 } = {}) {
  const K = KIDS[kind], r = rng(seed);
  let phase = 'aim', t = 0, target = null, wait = 0, idx = 0, legY = null, want = 0, flip = 1, jumped = false, lastBlow = -9, clock = 0;
  const leg = y => route.legs[Math.round(y)];
  return ({ p, live, dt = 1 / 60 }) => {
    clock += dt; t += dt;
    const on = p.carry === live.standObj && !!live.stood, ground = p.onGround && !p.carry;
    if (ground && Math.round(p.pos.y) >= route.goal) { p.keys = {}; return 'done'; }
    p.keys.Space = false;
    if (K.pillar) { // jump, and at the top of the jump look down and Blow!; on the ground also blow down and hop straight up
      p.pitch = -1.5;
      if (ground) { p.keys.KeyW = false; if ((wait += dt) > 0.2) { live.use(p); p.keys.Space = true; wait = 0; jumped = true; } return null; }
      if (on) { live.use(p); p.keys.Space = true; return null; }
      if (jumped && p.vel.y < 1.5) { live.use(p); jumped = false; }
      return null;
    }
    if (ground && legY !== Math.round(p.pos.y)) { legY = Math.round(p.pos.y); idx = 0; phase = 'aim'; } // on a ledge (a new one, or back after a fall)
    const L = leg(legY ?? p.pos.y);
    if (!L) return null;
    if (phase === 'aim') {
      if (!on && !ground) return null; // still landing
      p.keys.KeyW = false;
      if ((wait += dt) < (K.random ? 0.1 + r() * 0.4 : 0.12)) return null;
      // on a bubble: is the ledge in reach? then hop onto it
      if (on) {
        const d = L.ledge.dir, fx = -Math.sin(YAW[d]), fz = -Math.cos(YAW[d]);
        const near = [0.8, 1.6, 2.4].some(s => solidAt(live, p.pos.x + fx * s, L.ledge.y - 1, p.pos.z + fz * s) && !solidAt(live, p.pos.x + fx * s, L.ledge.y, p.pos.z + fz * s));
        if (near && p.pos.y + BUBBLE.bounce >= L.ledge.y + 0.15) { p.yaw = YAW[d]; p.pitch = 0; p.keys.Space = true; p.keys.KeyW = true; phase = 'ledge'; t = 0; return null; }
      }
      if (!on && ground && L.dirs.length === 1 && L.ledge.y - p.pos.y <= 1.2) { p.yaw = YAW[L.ledge.dir]; p.keys.Space = true; p.keys.KeyW = true; phase = 'ledge'; t = 0; return null; }
      let dir = L.dirs[idx % L.dirs.length], yaw = YAW[dir] * 1 + (flip < 0 ? Math.PI : 0);
      if (K.random) yaw += (r() - 0.5) * 1.0;
      const look = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      let spot = live.field.spot(p.pos, look, (x, y, z) => live.world.isSolid(x, y, z));
      if (!spot && !K.random) { flip = -flip; yaw += Math.PI; spot = live.field.spot(p.pos, { x: -look.x, z: -look.z }, (x, y, z) => live.world.isSolid(x, y, z)); } // a wall ahead: the other way
      if (spot && K.dodge) { // a drip's spout right over the spot: blow a little to the side
        const dr = DRIPS.find(q => Math.hypot(q.x - spot.x, q.z - spot.z) < 0.8);
        if (dr) yaw += 0.5 * (p.pos.x < dr.x ? 1 : -1) * (Math.cos(yaw) > 0 ? 1 : -1);
      }
      p.yaw = yaw; p.pitch = -0.3;
      const n0 = live.field.n;
      live.use(p); lastBlow = clock;
      if (K.random && r() < 0.25) live.use(p); // blows twice
      target = live.field.list.find(b => b.id > n0) || null;
      idx++;
      if (!target) { wait = 0; return null; }
      want = K.random ? -1 + r() * 2.6 : on ? K.want.bubble : K.want.ground;
      phase = 'wait'; t = 0; return null;
    }
    if (phase === 'wait') {
      if (!live.field.list.includes(target)) { phase = 'aim'; wait = 0; return null; } // it popped (a drip, a touch): blow again
      const stoodLeft = live.stood ? live.field.standLife - live.stood.standT : 9;
      if (target.y + BUBBLE.r - p.pos.y >= want || stoodLeft < 0.3 || t > 2.5) { // hop now
        p.yaw = Math.atan2(-(target.x - p.pos.x), -(target.z - p.pos.z)); p.keys.Space = true; p.keys.KeyW = true; phase = 'hop'; t = 0;
      }
      return null;
    }
    if (phase === 'hop') {
      if (K.steer && live.field.list.includes(target)) { const dx = target.x - p.pos.x, dz = target.z - p.pos.z; if (Math.hypot(dx, dz) > 0.25) p.yaw = Math.atan2(-dx, -dz); p.keys.KeyW = Math.hypot(dx, dz) > 0.25; }
      if (t > 0.1 && on && live.stood) { p.keys.KeyW = false; phase = 'aim'; wait = 0; return null; }
      if (t > 0.2 && ground) { p.keys.KeyW = false; phase = 'aim'; wait = 0; return null; }
      return null;
    }
    if (phase === 'ledge') {
      p.keys.KeyW = true;
      if (t > 0.15 && (ground || on)) { p.keys.KeyW = false; phase = 'aim'; wait = 0; }
      return null;
    }
    return null;
  };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('bubblebots.mjs')) {
  for (const fps of [60, 20]) {
    const row = (name, f) => console.log(`@${fps} ${name}: ${f()}`);
    for (let i = 0; i < 3; i++) for (const b of ['skilled', 'pusher', 'straight', 'noGust']) row(`duck ${i + 1} ${b}`, () => { const r = playDuck(DUCK_BOTS[b](i), { i, fps }); const h = playDuck(DUCK_BOTS[b](i), { i, fps, help: 6 }); const hd = playDuck(DUCK_BOTS[b](i), { i, fps, hard: true }); return `${JSON.stringify(r)} help ${h.won} hard ${hd.won} ${hd.time.toFixed(0)}`; });
    for (const b of ['skilled', 'still', 'spammer']) row(`ride ${b}`, () => { const r = playRide(RIDE_BOTS[b](), { fps }); const hd = playRide(RIDE_BOTS[b](), { fps, hard: true }); return `${JSON.stringify(r)} hard ${hd.won} ${hd.pops}`; });
  }
  for (let k = 0; k < 3; k++) {
    const w = hitWindows(k, 0).map(([a, b]) => `${(a * 180 / Math.PI).toFixed(1)}..${(b * 180 / Math.PI).toFixed(1)}`);
    console.log(`shield ${k + 1}: windows ${w.join(' ')}`, ['naive', 'random', 'reader', 'skilled'].map(b => `${b} ${JSON.stringify(playShots(SHOT_BOTS[b](k), k, { tries: b === 'random' ? 100 : 10 }))}`).join(' | '), `| skilled wobbly 3° ${JSON.stringify(playShots(SHOT_BOTS.skilled(k), k, { tries: 30, wobble: 3 * Math.PI / 180 }))}`);
  }
}
