// Model players for the Bubble Well (pure, Node and page), like castlebots.mjs. The ducklings and the Chimney Ride are played on the pure
// rules (bubbles.js) at `fps` frames a second (the input is decided once per frame, like a real player, and held for the frame); the
// climb runs in the page with the real Player physics (makeClimber).
//   node tests/bubblebots.mjs   prints a table (calibration)
import { Duckling, DUCK, puffSpeed, Ride, RIDE, gapOf, shieldShot, shieldSpot } from '../src/bubbles.js';
import { GARDEN_RULES, ISLANDS, NEST, CHIMNEY, VENTS, SHIELD } from '../src/bubbleland.js';

/* ---------------------------------------------------------------- the ducklings */
// The way each duckling should go (waypoints; the last is the nest): straight; across the current; through the thorn pen's two gaps.
export const DUCK_WAYS = [
  [[NEST.x, NEST.z]],
  [[68.5, 44.5], [NEST.x, NEST.z]],
  [[94.25, 57.5], [94.25, 52.5], [85.25, 52], [85.25, 46.5], [NEST.x, NEST.z]],
];
// A player decides a puff when the duckling has (nearly) stopped: { dx, dz, dist } or null (wait).
const inNest = d => Math.hypot(d.x - NEST.x, d.z - NEST.z) < d.nestR - 0.1; // every player waits while it settles in the nest
export const DUCK_BOTS = {
  // reads the duckling: follows the waypoints, stands just far enough for the glide it needs, aims a bit upstream in a current
  skilled: (i) => {
    let w = 0;
    return (d, t) => {
      const way = DUCK_WAYS[i];
      while (w < way.length - 1 && Math.hypot(way[w][0] - d.x, way[w][1] - d.z) < 0.8) w++;
      const [tx, tz] = way[w], cur = (GARDEN_RULES.currents || []).find(c => d.x >= c.x0 - 3 && d.x < c.x1 + 3 && d.z >= c.z0 && d.z < c.z1);
      if (inNest(d) || (d.speed > 0.15 && !(cur && d.speed > 0.15 && t - (d._last ?? -9) > 1.2))) return null;
      let dx = tx - d.x, dz = tz - d.z;
      const far = Math.hypot(dx, dz), last = w === way.length - 1;
      const k = d.friction, v = Math.min(DUCK.max, Math.max(DUCK.min, far * k * (last ? 0.95 : 1.05)));
      if (cur) { const time = far / Math.max(0.5, v); dx -= cur.vx * time * 0.5; dz -= cur.vz * time * 0.5; } // aim upstream
      const dist = DUCK.near + (DUCK.max - v) / (DUCK.max - DUCK.min) * (DUCK.far - DUCK.near);
      d._last = t;
      return { dx, dz, dist };
    };
  },
  // always the biggest puff, straight at the nest
  pusher: () => (d) => (d.speed > 0.2 || inNest(d) ? null : { dx: NEST.x - d.x, dz: NEST.z - d.z, dist: DUCK.near }),
  // little puffs straight at the nest, never minding the thorns or the current
  straight: () => (d) => (d.speed > 0.2 || inNest(d) ? null : { dx: NEST.x - d.x, dz: NEST.z - d.z, dist: Math.min(DUCK.far, DUCK.near + Math.hypot(NEST.x - d.x, NEST.z - d.z) * 0.1) }),
};
export function playDuck(bot, { i = 0, fps = 60, help = 0, hard = false, time = 120 } = {}) {
  const d = new Duckling(GARDEN_RULES, ISLANDS[i], { help, hard }), dt = 1 / fps;
  let t = 0, pops = 0, puffs = 0;
  d.blow();
  while (t < time && d.state !== 'home') {
    if (d.state === 'sleep') d.blow();
    const p = bot(d, t);
    if (p && d.puff(p.dx, p.dz, p.dist)) puffs++;
    for (const e of d.step(dt)) if (e.type === 'pop') pops++;
    t += dt;
  }
  return { won: d.state === 'home', pops, puffs, time: t };
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

/* ---------------------------------------------------------------- the shields */
// Where a bubble comes into each vent: the right spot, the side you would blow from straight from the throne's south, the middle.
export const VENT_TRIES = {
  right: k => shieldSpot(VENTS[k], SHIELD, 0.6),
  south: k => ({ x: VENTS[k].x, z: VENTS[k].z + 0.6 }),
  middle: k => ({ x: VENTS[k].x, z: VENTS[k].z }),
};
export const shotFrom = (k, how, opts) => shieldShot(VENTS[k], VENT_TRIES[how](k), SHIELD, opts);

/* ---------------------------------------------------------------- the climb (in the page, with the real Player) */
// moves: [{ dir: 'n' | 'e' | 's' | 'w', kind: 'bubble' | 'ledge', top? }] (top: how high the bubble's top should be over your feet).
// The returned tick({ p, live }) sets the keys and the view for the next frame and returns 'done', 'fail' or null; the caller then runs
// p.update(dt) and live.step(dt).
export const YAW = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 };
export function makeClimber(moves, { straight = false } = {}) {
  let i = 0, phase = 'aim', t = 0, target = null, n0 = 0, wait = 0;
  return ({ p, live, dt = 1 / 60 }) => {
    t += dt;
    const m = moves[i];
    if (!m) return 'done';
    const on = p.carry === live.standObj, ground = p.onGround && !p.carry;
    p.keys.Space = false;
    if (phase === 'aim') {
      if (!on && !ground) return null;                    // still landing
      if ((wait += dt) < 0.1) return null;
      p.yaw = YAW[m.dir];
      if (m.kind === 'ledge') { p.pitch = 0; p.keys.Space = true; p.keys.KeyW = true; phase = 'ledge'; t = 0; return null; }
      const top = m.top ?? (on ? 1.9 : 1.0); // (from a bubble a little higher: a new bubble waits before it rises)
      p.pitch = straight ? 0 : Math.asin(Math.max(-1, Math.min(1, (top - 0.55 - 1.62) / 1.6)));
      n0 = live.field.n;
      live.blow(p.eyePos, p.forward);
      const b = live.field.list.find(x => x.id > n0);
      if (!b) return 'fail';
      target = b; p.keys.Space = true; p.keys.KeyW = true; phase = 'jump'; t = 0; return null;
    }
    if (phase === 'jump') {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), ahead = (target.x - p.pos.x) * fx + (target.z - p.pos.z) * fz;
      p.keys.KeyW = ahead > 0.1;
      if (on && live.stood === target) { p.keys.KeyW = false; i++; phase = 'aim'; wait = 0; return i >= moves.length ? 'done' : null; }
      if (t > 0.3 && (ground || p.carry)) return 'fail';
      if (t > 3) return 'fail';
      return null;
    }
    if (phase === 'ledge') {
      p.keys.KeyW = true;
      if (t > 0.2 && ground) { p.keys.KeyW = false; i++; phase = 'aim'; wait = 0; return i >= moves.length ? 'done' : null; }
      if (t > 3) return 'fail';
      return null;
    }
    return null;
  };
}
// The two shafts: from the floor in front of the bench, and from the bench into the narrow shaft.
export const CLIMB = {
  shaft1: { start: [104.5, 5, 76.5], moves: [{ dir: 'n', kind: 'bubble' }, { dir: 'n', kind: 'bubble' }, { dir: 'n', kind: 'bubble' }, { dir: 'n', kind: 'ledge' }] },
  shaft2: { start: [112.5, 11, 69.5], moves: [{ dir: 'n', kind: 'bubble' }, { dir: 'n', kind: 'bubble' }, { dir: 'n', kind: 'bubble' }, { dir: 'n', kind: 'bubble' }, { dir: 'e', kind: 'ledge' }] },
};

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('bubblebots.mjs')) {
  for (const fps of [60, 20]) {
    const row = (name, f) => console.log(`@${fps} ${name}: ${f()}`);
    for (let i = 0; i < 3; i++) for (const b of ['skilled', 'pusher', 'straight']) row(`duck ${i + 1} ${b}`, () => { const r = playDuck(DUCK_BOTS[b](i), { i, fps }); const h = playDuck(DUCK_BOTS[b](i), { i, fps, help: 6 }); const hd = playDuck(DUCK_BOTS[b](i), { i, fps, hard: true }); return `${JSON.stringify(r)} help ${h.won} hard ${hd.won} ${hd.time.toFixed(0)}`; });
    for (const b of ['skilled', 'still', 'spammer']) row(`ride ${b}`, () => { const r = playRide(RIDE_BOTS[b](), { fps }); const hd = playRide(RIDE_BOTS[b](), { fps, hard: true }); return `${JSON.stringify(r)} hard ${hd.won} ${hd.pops}`; });
  }
  for (let k = 0; k < 3; k++) console.log(`vent ${k + 1}`, ['right', 'south', 'middle'].map(h => `${h} ${shotFrom(k, h).hit}`).join(' '));
}
