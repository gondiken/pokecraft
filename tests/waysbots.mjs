// Chapter 3 (plans/chapter3-ways.md): the first two WAY places with the REAL Player in Node (wobbleEnv: the real Wobbleland terrain),
// the real body rules (creatureways.js bodyStep, player.js clingStep) and the real place rules (wayland.js Trials), in the game's own
// order each frame: Player.update, Trials.step, bodyStep. At 60 and 20 fps, from 12 different moments of the rings' / drips' clock.
//   storm (Storm Island, a wings place: owner 2026-11-12, the same for every creature with wings): flying straight in never makes it
//          (a Drake or Boomwing); a skilled flier (hovers between the rings and goes when the next one is off) always does, whatever its
//          type; a walker and a Cling creature end in the ink
//   shaft (the Drip Tower, Cling): a Cling creature that just climbs is knocked down every time; a skilled one (waits in the nooks)
//          always reaches the roof; a flier folds its wings and stays at the bottom; nobody grips the tower's ice from outside
//   node tests/waysbots.mjs     (exit 1 on a problem)
import { wobbleEnv } from './wobblenode.mjs';

const SKY = { kind: 'sky', speed: 7.5, climb: 5, sink: 4, cap: 6, glide: 6, drift: 1.2 }; // riding.js RIDE.sky
const BODIES = { // (creatureways.js bodyOf of a stand-in species: every body moves like riding it, RIDE below)
  fly: { species: 'scalewing', type: 'drake', way: 'fly', wings: true, move: 'land', cling: false },
  boomwing: { species: 'boomwing', type: 'sound', way: 'sense', wings: true, move: 'land', cling: false },
  walker: { species: 'blazehound', type: 'fire', way: 'burn', wings: false, move: 'land', cling: false },
  cling: { species: 'sproutle', type: 'grass', way: 'cling', wings: false, move: 'land', cling: true },
};
const RIDE = { // riding.js RIDE
  land: { kind: 'land', speed: 7.0, sprint: 9.5, jump: 11.2 },
  water: { kind: 'water', speed: 4.3, sprint: 6.2, jump: 8.6, landSlow: 0.5 },
  sky: SKY,
};

async function setup() {
  const E = await wobbleEnv(), W = await import('../src/wayland.js'), C = await import('../src/creatureways.js');
  return { ...E, W, C };
}

// one try: `brain(E, t)` -> keys each frame. -> { won, t, puffs, windy, knocks, maxY }
function play(E, { body, ride = null, start, yaw, phase, fps, secs, brain, won }) {
  const { player: p, w, W, C } = E;
  p.carry = null; p.glide = null; p.ride = null; p.be = body ? { ...body, slip: false } : null; p.keys = {}; p.joy = null;
  p.pos.set(...start); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0;
  if (ride) p.ride = { ...SKY, type: ride };
  const tr = new W.Trials(); tr.t = phase;
  if (body) C.bodyStep(p, w, body, RIDE);
  const out = { won: false, t: 0, puffs: 0, windy: 0, knocks: 0, maxY: p.pos.y };
  const dt = 1 / fps;
  for (let t = 0; t < secs; t += dt) {
    p.keys = brain(E, tr, t) || {};
    p.update(dt);
    for (const e of tr.step(p, dt)) { if (e.kind === 'puff') out.puffs++; if (e.kind === 'windy') out.windy++; if (e.kind === 'knocked') out.knocks++; }
    if (body) C.bodyStep(p, w, body, RIDE);
    out.maxY = Math.max(out.maxY, p.pos.y);
    if (won(E)) { out.won = true; out.t = +t.toFixed(2); break; }
  }
  return out;
}

/* ---- Storm Island ---- */
const onIsland = E => { const { W, player: p } = E, S = W.STORM; return Math.hypot(p.pos.x - S.x, p.pos.z - S.z) < S.island - 0.3 && p.pos.y >= S.top + 0.9; };
const stormStart = E => { const S = E.W.STORM; return [S.x + 0.5, 11, S.z + S.r + 3.5]; }; // on the shore south of the lake, facing north (yaw 0)
const naiveFly = () => ({ KeyW: true, Space: true });
// skilled: at the shore or between two rings, look at the next ring in: go only if it stays off all the way through, else hover
function skilledFly(E, tr) {
  const { W, player: p } = E, S = W.STORM, d = Math.hypot(p.pos.x - S.x, p.pos.z - S.z);
  if (S.rings.some(r => Math.abs(d - r) <= S.width / 2 + 0.4)) return { KeyW: true, Space: true }; // (going through one: keep going)
  const next = S.rings.findIndex(r => r + S.width / 2 < d);
  if (next < 0) return { KeyW: true, Space: true };
  const r = S.rings[next];
  const t0 = (d - 0.35 - (r + S.width / 2)) / S.fly, t1 = (d + 0.35 - (r - S.width / 2)) / S.fly;
  for (let k = t0 - 0.05; k <= t1 + 0.1; k += 0.05) if (W.ringState(next, tr.t + k) === 'on') return { Space: true };
  return { KeyW: true, Space: true };
}

/* ---- the Drip Tower ---- */
const onRoof = E => { const { W, player: p } = E, T = W.SHAFT; return p.pos.y >= T.roof + 0.9 && p.onGround && !W.inShaft(p.pos); };
const shaftStart = E => { const T = E.W.SHAFT; return [T.x + 0.5, T.floor, T.z + 2.5]; }; // in the door, facing north into the shaft
const naiveClimb = () => ({ KeyW: true });
// skilled: wait where the drips cannot reach you (the door, a nook), watch them fall, and go only when you can climb to the next nook (or
// out at the roof) before the next one meets you; step into the nook there, and so on
function skilledClimb(E, tr) {
  const { W, player: p } = E, T = W.SHAFT, x = p.pos.x, y = p.pos.y;
  const st = tr.bot ??= { going: false };
  const inNook = x > T.x + 1.4 && p.onGround, atDoor = p.pos.z > T.z + 1.1 && p.onGround;
  if ((inNook || atDoor) && !st.going) {
    const target = T.nooks.find(n => n > y + 0.05) ?? T.roof + 1, lag = atDoor ? 0.7 : 0.3; // (from the door: the walk in first)
    const need = (target - y) / 3 + lag + 0.3; // the climb, plus stepping out and in
    for (let s = 0; s <= need; s += 0.05) {
      const me = y + 3 * Math.max(0, s - lag);
      if (W.dripsAt(tr.t + s).some(d => d < me + p.height + 0.15 && d + 2 * T.r > me - 0.15)) return {}; // a drip would meet you: wait
    }
    st.going = true; st.target = target;
  }
  if (!st.going) return {};
  const target = st.target;
  if (target <= T.roof && y >= target - 0.02) { // level with the nook: step all the way in, then wait there
    if (x > T.x + 1.4 && p.onGround) { st.going = false; return {}; }
    return { KeyD: true };
  }
  if (x > T.x + 0.68) return { KeyA: true }; // out into the middle of the shaft first (the nook's ceiling is over its edge)
  return { KeyW: true };
}

export async function runStorm({ tries = 12, fps = [60, 20] } = {}) {
  const E = await setup(), problems = [], out = {};
  const rows = {
    naiveFly: { body: BODIES.fly, brain: naiveFly, want: 'never' },
    skilledFly: { body: BODIES.fly, brain: skilledFly, want: 'always' },
    boomwing: { body: BODIES.boomwing, brain: naiveFly, want: 'never' },
    boomwingSkilled: { body: BODIES.boomwing, brain: skilledFly, want: 'always' },
    walker: { body: BODIES.walker, brain: naiveFly, want: 'never' },
    cling: { body: BODIES.cling, brain: naiveFly, want: 'never' },
  };
  for (const [name, r] of Object.entries(rows)) for (const f of fps) {
    let wins = 0, times = [];
    for (let i = 0; i < tries; i++) {
      const res = play(E, { body: r.body, ride: r.ride, start: stormStart(E), yaw: 0, phase: i * E.W.STORM.period / tries + 0.013, fps: f, secs: 25, brain: r.brain, won: onIsland });
      if (res.won) { wins++; times.push(res.t); }
    }
    out[`${name}@${f}`] = { wins, of: tries, median: times.sort((a, b) => a - b)[times.length >> 1] ?? null };
    if (r.want === 'never' && wins) problems.push(`storm: ${name} at ${f} fps reached the island ${wins}/${tries}`);
    if (r.want === 'always' && wins < tries) problems.push(`storm: ${name} at ${f} fps reached the island only ${wins}/${tries}`);
  }
  return { problems, out };
}

export async function runShaft({ tries = 12, fps = [60, 20] } = {}) {
  const E = await setup(), problems = [], out = {}, T = E.W.SHAFT;
  const ice = [T.x + 3.4, T.floor, T.z + 0.5]; // outside the tower's east wall, facing west into it
  const rows = {
    naiveClimb: { body: BODIES.cling, brain: naiveClimb, want: 'never' },
    skilledClimb: { body: BODIES.cling, brain: skilledClimb, want: 'always' },
    flier: { body: BODIES.fly, brain: () => ({ KeyW: true, Space: true }), want: 'never' },
    boomwing: { body: BODIES.boomwing, brain: skilledClimb, want: 'never' },
    walker: { body: BODIES.walker, brain: () => ({ KeyW: true, Space: true }), want: 'never' },
    iceWall: { body: BODIES.cling, start: ice, yaw: Math.PI / 2, brain: () => ({ KeyW: true }), want: 'never' }, // (yaw pi/2: forward is -x)
  };
  for (const [name, r] of Object.entries(rows)) for (const f of fps) {
    let wins = 0, times = [], knocks = 0, top = 0;
    for (let i = 0; i < tries; i++) {
      const res = play(E, { body: r.body, start: r.start ?? shaftStart(E), yaw: r.yaw ?? 0, phase: i * T.every / tries + 0.011, fps: f, secs: 40, brain: r.brain, won: onRoof });
      if (res.won) { wins++; times.push(res.t); }
      knocks += res.knocks; top = Math.max(top, res.maxY);
    }
    out[`${name}@${f}`] = { wins, of: tries, median: times.sort((a, b) => a - b)[times.length >> 1] ?? null, knocks, top: +top.toFixed(1) };
    if (r.want === 'never' && wins) problems.push(`shaft: ${name} at ${f} fps reached the roof ${wins}/${tries}`);
    if (r.want === 'always' && wins < tries) problems.push(`shaft: ${name} at ${f} fps reached the roof only ${wins}/${tries}`);
  }
  return { problems, out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = await runStorm(), b = await runShaft();
  console.log(JSON.stringify({ storm: a.out, shaft: b.out }, null, 1));
  const problems = [...a.problems, ...b.problems];
  if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
  console.log('ok');
}
