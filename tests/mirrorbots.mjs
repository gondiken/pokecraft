// Wave 18: model players for the Mirror Palace's three games (pure, Node and page), like castlebots.mjs. Each bot is given the live rules object every frame
// and returns the input of that frame (held for the whole frame, like a real player); `play*` runs a whole round at `fps` frames a second.
//   node tests/mirrorbots.mjs     prints the calibration table (naive vs skilled per game and frame rate)
import { BounceRound, COURT_RULES, COURT_ROUNDS } from '../src/bounceback.js';
import { TwinRoom, TWIN_RULES, pathHit } from '../src/lookingglass.js';
import { SpotRound, BEAM, SPOT_RULES, SPOT_ROUNDS, aimAt, beamOf } from '../src/spotlight.js';
import { TWIN_ROOMS } from '../src/mirrorland.js';
import { B } from '../src/blocks.js';
import { makeMirror } from './mirrorcheck.mjs';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lcg = seed => { let a = seed >>> 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };
const deg = d => d * Math.PI / 180;

/* ============================================ Bounce-Back ============================================ */
export const COURT_BOTS = {
  // the best player: slides under the ball early and aims the return where Cleo (who stands where it stands) cannot reach, into the goal mouth
  skilled: () => (g, dt) => {
    const R = COURT_RULES, a = g.arrival(), out = { slide: 0, tilt: g.tilt };
    if (!a) return { slide: clamp((1.6 - g.m) / (R.slideSpeed * dt), -1, 1), tilt: 0 }; // (waits near a side: the goal mouth is then far from where Cleo copies you)
    out.slide = clamp((a.u - g.m) / (R.slideSpeed * dt), -1, 1);
    if (a.t < 0.7) {
      const reach = g.slide * g.react + R.cleoHalf + R.r; let best = null;
      for (let deg_ = -40; deg_ <= 40; deg_ += 2) {
        const t = deg(deg_), f = g.forecast(a.ball, t, { spin: a.spin });
        if (f.u == null) continue;
        const margin = Math.abs(f.u - a.u) - reach, score = (f.inMouth ? 100 : 0) + Math.min(margin, 6) - Math.abs(deg_) * 0.01;
        if (!best || score > best.score) best = { score, t };
      }
      out.tilt = best ? best.t : 0;
    }
    return out;
  },
  // a first-time player: slides to the ball a quarter of a second late, tilts the mirror a little half the time (10 to 25 degrees, either way)
  firstTime: (seed = 1, lag = 0.25) => { const rnd = lcg(seed), mem = []; let rally = -1, choice = 0; return (g, dt) => {
    const a = g.arrival(); mem.push([g.time, a ? a.u : 8]); while (mem.length > 2 && mem[1][0] <= g.time - lag) mem.shift();
    const seen = mem[0][1];
    if (a && a.t < 0.8 && rally !== g.hits) { rally = g.hits; choice = rnd() < 0.5 ? (rnd() < 0.5 ? -1 : 1) * deg(10 + rnd() * 15) : 0; }
    return { slide: clamp((seen - g.m) / (COURT_RULES.slideSpeed * dt), -1, 1), tilt: a ? choice : 0 };
  }; },
  // stands where the ball will be and never tilts: every return is straight, Cleo stands exactly there
  still: () => (g, dt) => { const a = g.arrival(); return { slide: a ? clamp((a.u - g.m) / (COURT_RULES.slideSpeed * dt), -1, 1) : 0, tilt: 0 }; },
  // slides and tilts at random
  random: (seed = 1) => { const rnd = lcg(seed); let s = 0, t = 0, n = 0; return () => { if (n-- <= 0) { n = 20; s = rnd() * 2 - 1; t = (rnd() * 2 - 1) * deg(40); } return { slide: s, tilt: t }; }; },
};
export function playBounce(bot, { seed = 7, round = 0, attempt = 0, fps = 60, help = 0, hard = false, budget = 180 } = {}) {
  const g = new BounceRound(seed, round, attempt, { help, hard }), dt = 1 / fps, ev = [];
  let t = 0;
  while (!g.done && t < budget) { for (const e of g.update(dt, bot(g, dt))) ev.push(e); t += dt; }
  return { won: g.won, done: g.done, you: g.you, cleo: g.cleo, time: +t.toFixed(1), events: ev };
}

/* ============================================ Looking-Glass Rooms ============================================ */
// A walker in a room's own coordinates (the real Player in Node is tests/mirrornode.mjs): 1/60 s sub-steps like Player.update, speed 4.3 (6.2 sprinting)
export function makeWalker(room) {
  return {
    room, you: { u: 0, v: 0 }, t: 0, events: [],
    start() { const [u, v] = room.data.start; this.you = { u, v }; room.begin(this.you); },
    // walk toward (u, v) for one sub-step h at `speed`; returns the room's events
    walk(tu, tv, h, speed = 4.3) {
      const y = this.you, dx = tu - y.u, dz = tv - y.v, d = Math.hypot(dx, dz), s = Math.min(d, speed * h), du = d > 1e-9 ? dx / d * s : 0, dv = d > 1e-9 ? dz / d * s : 0;
      let nu = y.u + du, nv = y.v + dv;
      const R = TWIN_RULES;
      nu = clamp(nu, R.half, R.width - R.half); nv = clamp(nv, R.half, R.depth - R.half); // (the room's walls; your side has no dresser)
      const mu = nu - y.u, mv = nv - y.v; y.u = nu; y.v = nv;
      const ev = room.tick(h, y, mu, mv);
      for (const e of ev) { if (e.type === 'puff') { y.u = e.you[0]; y.v = e.you[1]; } this.events.push(e); }
      this.t += h; return ev;
    },
  };
}
// waypoints per room (your side, room-local) for the skilled player; `wait` means: do not start a leg that would be hit (a lookahead on a copy of the room)
export const TWIN_PLANS = { // [u, v, dwell s]
  1: [[16.5, 12], [6, 12, 0.7], [8, 12], [8, 5.5], [3, 4, 0.7]],
  2: [[10.5, 13.5], [12, 9.5, 0.7], [12, 5], [8, 4.5, 0.7], [8.5, 9], [4, 9.5, 0.7]],
  3: [[16.5, 12], [16.5, 2.5], [6, 2.5, 0.7], [16.5, 2.5], [16.5, 12], [3, 12], [2.5, 4.5, 0.7]],
};
export const TWIN_BOTS = {
  // walks straight at the nearest pad, never looks at the glass
  straight: () => w => {
    const room = w.room, left = room.data.pads.map((p, i) => ({ p, i })).filter(x => !room.lit[x.i]);
    if (!left.length) return null;
    left.sort((a, b) => Math.hypot(a.p.you[0] - w.you.u, a.p.you[1] - w.you.v) - Math.hypot(b.p.you[0] - w.you.u, b.p.you[1] - w.you.v));
    return { to: left[0].p.you, speed: 4.3 };
  },
  // walks at random (turns every 0.7 s)
  random: (seed = 1) => { const rnd = lcg(seed); let ang = 0, n = 0; return w => { if (n-- <= 0) { n = 42; ang = rnd() * Math.PI * 2; } return { to: [w.you.u + Math.cos(ang) * 3, w.you.v + Math.sin(ang) * 3], speed: 4.3 }; }; },
  // watches the glass: goes pad to pad in straight lines but only when the way is clear on BOTH sides for the next 2 s (balls, mop, puddles), and steps round a puddle it would plop in
  watcher: () => w => {
    const room = w.room, left = room.data.pads.map((p, i) => ({ p, i })).filter(x => !room.lit[x.i]);
    if (!left.length) return null;
    left.sort((a, b) => Math.hypot(a.p.you[0] - w.you.u, a.p.you[1] - w.you.v) - Math.hypot(b.p.you[0] - w.you.u, b.p.you[1] - w.you.v));
    const to = left[0].p.you, wp = detour(room, w.you, to);
    return { to: wp, speed: 4.3, wait: true };
  },
  // the intended play: the room's waypoints (the dresser, the gaps), waiting for the gaps
  skilled: () => w => {
    const room = w.room, plan = TWIN_PLANS[room.data.n];
    if (room.lit.every(Boolean)) return null;
    if (w.dwellUntil > w.t) return { to: [w.you.u, w.you.v], speed: 0 };
    let i = w.leg || 0;
    if (i >= plan.length) { w.leg = 0; i = 0; }
    const to = plan[i];
    if (Math.hypot(to[0] - w.you.u, to[1] - w.you.v) < 0.08) { w.leg = i + 1; if (to[2]) w.dwellUntil = w.t + to[2]; return { to: [w.you.u, w.you.v], speed: 0 }; }
    return { to, speed: 6.2, wait: true };
  },
};
// puddles in the straight way: the shortest way through one free waypoint (a puddle on either side, as both of you would walk it)
function detour(room, you, to) {
  const ps = room.data.puddles || [], clear = (a, b) => ps.every(p => !pathHit(a[0], a[1], b[0], b[1], p.u, p.v, p.r + 0.7));
  const from = [you.u, you.v];
  if (clear(from, to)) return to;
  let best = null;
  for (let u = 1; u <= 17; u += 0.5) for (let v = 1; v <= 15; v += 0.5) {
    const m = [u, v];
    if (!clear(from, m) || !clear(m, to)) continue;
    const d = Math.hypot(u - from[0], v - from[1]) + Math.hypot(to[0] - u, to[1] - v);
    if (!best || d < best.d) best = { d, m };
  }
  return best ? best.m : to;
}
// Plays one room with a bot from its start pad; -> { won, time, misses }. `fps` only changes how often the bot looks (the room runs on 1/60 s sub-steps).
export function playTwin(bot, n, { fps = 60, help = 0, hard = false, budget = 120, blockedTwin, phase = 0 } = {}) {
  const data = TWIN_ROOMS[n - 1], room = new TwinRoom(data, { help, hard, blocked: blockedTwin, phase }), w = makeWalker(room), act = bot, h = 1 / 60;
  w.start();
  let t = 0, cmd = null, nextLook = 0, misses = 0;
  while (t < budget && !room.won) {
    if (t >= nextLook) { cmd = act(w); nextLook = t + 1 / fps; }
    if (!cmd) break;
    let to = cmd.to, speed = cmd.speed;
    if (cmd.wait && speed > 0) { // lookahead: copy the room and the walker, walk the next 1.2 s to see whether anything hits
      const c = room.clone(), cw = { ...w, room: c, you: { ...w.you }, events: [] }; let bad = false;
      for (let i = 0; i < 72 && !bad; i++) if (walkOn(cw, c, to, speed, h).some(e => e.type === 'puff')) bad = true;
      if (bad) { // wait only if standing here is safe (a ball already on the way to you: walk on)
        const c2 = room.clone(), cw2 = { ...w, room: c2, you: { ...w.you }, events: [] }; let badStay = false;
        for (let i = 0; i < 72 && !badStay; i++) if (walkOn(cw2, c2, to, 0, h).some(e => e.type === 'puff')) badStay = true;
        if (!badStay) speed = 0;
      }
    }
    const evs = w.walk(to[0], to[1], h, speed || 0.0001);
    if (speed === 0) { /* stood still */ }
    for (const e of evs) if (e.type === 'puff') misses++;
    t += h;
  }
  return { won: room.won, time: +t.toFixed(1), misses };
}
function walkOn(cw, room, to, speed, h) { // a throwaway walk step on a copy (same maths as makeWalker.walk)
  const y = cw.you, R = TWIN_RULES, dx = to[0] - y.u, dz = to[1] - y.v, d = Math.hypot(dx, dz), s = Math.min(d, speed * h);
  const nu = clamp(y.u + (d > 1e-9 ? dx / d * s : 0), R.half, R.width - R.half), nv = clamp(y.v + (d > 1e-9 ? dz / d * s : 0), R.half, R.depth - R.half), mu = nu - y.u, mv = nv - y.v;
  y.u = nu; y.v = nv;
  const ev = room.tick(h, y, mu, mv);
  for (const e of ev) if (e.type === 'puff') { y.u = e.you[0]; y.v = e.you[1]; }
  return ev;
}

// Would walking from `you` toward `to` for the next `secs` seconds get you (or the twin) puffed back? (on a copy of the room; speed 0 = standing here)
export function lookBad(room, you, to, speed, secs = 1.2, h = 1 / 60) {
  const c = room.clone(), cw = { you: { u: you.u, v: you.v } };
  for (let i = 0; i < Math.round(secs / h); i++) if (walkOn(cw, c, to, speed, h).some(e => e.type === 'puff')) return true;
  return false;
}
// The skilled player's whole room with a REAL Player and MirrorLive (tests/mirrornode.mjs mirrorEnv, or the page's `{ player, live, step }`): walks to the room's start pad
// through the doors, then along TWIN_PLANS with real keys, waiting for the gaps (the lookahead on a copy of the room). -> { won, t, misses }
export function driveRoom(env, n, { dt = 1 / 60, max = 150 } = {}) {
  const { player: p, live, step } = env, z0 = [118, 100, 82][n - 1], plan = TWIN_PLANS[n], start = TWIN_ROOMS[n - 1].start;
  const go = (x, z) => { const d = Math.hypot(x - p.pos.x, z - p.pos.z); p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); p.joy = { x: 0, y: -(d < 0.7 ? Math.max(0.2, Math.min(0.9, d / (4.3 * dt))) : 1) }; }; // (slows to land on the spot, like a careful player)
  let t = 0, leg = 0, dwell = 0, way = [];
  if (n > 1 && p.pos.z > z0 + 17) way = [[113.5, z0 + 18.8], [113.5, z0 + 14.8]];
  way.push([128 - start[0], z0 + start[1]]);
  while (!(live.room && live.roomN === n) && t < max) {
    const w = way[0];
    if (!w) { p.joy = null; step(dt); t += dt; continue; } // (on the start pad: the room starts a moment later)
    if (Math.hypot(w[0] - p.pos.x, w[1] - p.pos.z) < 0.25) { way.shift(); continue; }
    go(w[0], w[1]); step(dt); t += dt;
  }
  while (live.room && !live.room.won && t < max) {
    if (dwell > t) p.joy = null;
    else {
      const [tu, tv, dw] = plan[leg % plan.length], x = 128 - tu, z = z0 + tv;
      if (Math.hypot(x - p.pos.x, z - p.pos.z) < 0.12) { leg++; if (dw) dwell = t + dw; p.joy = null; }
      else {
        const you = { u: 128 - p.pos.x, v: p.pos.z - z0 }, walkBad = lookBad(live.room, you, [tu, tv], 6.2), stayBad = walkBad && lookBad(live.room, you, [tu, tv], 0.0001);
        if (walkBad && !stayBad) p.joy = null; else go(x, z);
      }
    }
    step(dt); t += dt;
  }
  p.joy = null;
  return { won: !!live.room?.won, t: +t.toFixed(1), misses: live.room?.misses ?? 0 };
}

/* ============================================ the Moonlit Gallery ============================================ */
// the beam's view of a stand-in Mirror Palace world (or the page's own world)
export const beamWorld = w => ({ isSolid: (x, y, z) => w.isSolid(x, y, z), isPane: (x, y, z) => w.get(x, y, z) === B.MIRROR_PANE });
export const standInBeam = (seed = 1) => beamWorld(makeMirror(seed));
// Gloomy-chasing players. `world` = a stand-in world for the beam (tests/mirrorcheck.mjs makeMirror) or null (the pure open wall).
export const SPOT_BOTS = {
  // leads each Gloomy, keeps the spot on it, and banks the beam off a side panel for the ones in a pillar's shadow
  skilled: (react = 0.03) => (g, dt) => {
    const t = g.target(react);
    return t ? { yaw: t.yaw, pitch: t.pitch } : { yaw: g.yaw, pitch: g.pitch };
  },
  // aims at where the nearest Gloomy IS (as seen `lag` s ago), straight, never banking
  lagging: (lag = 0.4) => { const mem = []; return (g, dt) => {
    const l = g.alive().filter(x => !x.shade); // (it never looks round a pillar)
    const sp = g.spot || { x: 80, y: 20 }, near = l.sort((a, b) => Math.hypot(a.x - sp.x, a.y - sp.y) - Math.hypot(b.x - sp.x, b.y - sp.y))[0];
    mem.push([g.time, near ? [near.x, near.y] : null]); while (mem.length > 2 && mem[1][0] <= g.time - lag) mem.shift();
    const seen = mem[0][1];
    return seen ? aimAt(g, seen[0], seen[1]) : { yaw: g.yaw, pitch: g.pitch };
  }; },
  // sweeps the light slowly over the wall
  sweeper: () => (g) => ({ yaw: Math.sin(g.time * 0.5) * 0.4, pitch: -0.15 + Math.sin(g.time * 0.31) * 0.12 }),
  still: () => (g) => ({ yaw: 0, pitch: -0.2 }),
};
export function playSpot(bot, { seed = 7, round = 0, attempt = 0, fps = 60, help = 0, hard = false, budget = 60, world = null } = {}) {
  const g = new SpotRound(seed, round, attempt, { help, hard, world }), dt = 1 / fps, ev = [];
  let t = 0;
  while (!g.done && t < budget) { for (const e of g.update(dt, bot(g, dt))) ev.push(e); t += dt; }
  return { won: g.won, done: g.done, left: g.alive().length, time: +t.toFixed(1), events: ev };
}

export { COURT_ROUNDS, SPOT_ROUNDS };
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('mirrorbots.mjs')) {
  const wins = (f, n = 12) => { let w = 0; for (let s = 1; s <= n; s++) if (f(s).won) w++; return `${w}/${n}`; };
  const world = standInBeam(1);
  for (const fps of [60, 20]) {
    for (let r = 0; r < 3; r++) console.log(`bounce r${r + 1} @${fps}: ` + ['skilled', 'firstTime', 'still', 'random'].map(n => `${n} ${wins(s => playBounce(COURT_BOTS[n](s), { seed: s, round: r, fps }))}`).join(' | '));
    for (const n of [1, 2, 3]) console.log(`twin room ${n} @${fps}: ` + ['straight', 'random', 'watcher', 'skilled'].map(b => `${b} ${wins(s => playTwin(TWIN_BOTS[b](s), n, { fps, phase: s * 1.37, budget: b === 'watcher' ? 240 : 90 }), 6)}`).join(' | '));
    for (let r = 0; r < 3; r++) console.log(`spot r${r + 1} @${fps}: ` + ['skilled', 'lagging', 'sweeper', 'still'].map(b => `${b} ${wins(s => playSpot(SPOT_BOTS[b](), { seed: s, round: r, fps, world }), 20)}`).join(' | '));
  }
}
