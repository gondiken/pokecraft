// Chapter 3 step C (plans/chapter3-abilities-build.md): the Drip Tower, the first ABILITY place (Climb), with the REAL Player in Node
// (wobbleEnv: the real Wobbleland terrain), the real body rules (creatureways.js bodyOf / bodyStep from abilities.js, player.js clingStep)
// and the real place rules (wayland.js Trials), in the game's own order each frame: Player.update, Trials.step, bodyStep. At 60 and
// 20 fps, from 12 moments of the drips' clock. Bodies come from real species (bodyOf(id, SPECIES[id])).
//   with Climb: a climber that just climbs (W, or Climb! held) is knocked down every time; a skilled one (waits in the nooks) always
//          reaches the roof, with W or with Climb! held (Sproutle: Grass; a Bug that also flies: it grips the wall it flies into);
//   without Climb nobody gets up: a flier (the fly cap: 6 over the floor right below), Boomwing, a walker jumping, you on foot,
//          a flier gliding in from the cave hill's top (the highest ground near), the tower's ice from outside even for a climber,
//          and mixes by swapping mid-way (flier -> walker at the cap, walker -> flier in a nook).
//   node tests/waysbots.mjs     (exit 1 on a problem)
import { wobbleEnv } from './wobblenode.mjs';

const RIDE = { // riding.js RIDE
  land: { kind: 'land', speed: 7.0, sprint: 9.5, jump: 11.2 },
  water: { kind: 'water', speed: 4.3, sprint: 6.2, jump: 8.6, landSlow: 0.5 },
  sky: { kind: 'sky', speed: 7.5, climb: 5, sink: 4, cap: 6, glide: 6, drift: 1.2 },
};

export async function setup() {
  const E = await wobbleEnv(), W = await import('../src/wayland.js'), C = await import('../src/creatureways.js'), S = await import('../src/species.js');
  const body = id => C.bodyOf(id, S.SPECIES[id]);
  const bug = Object.keys(S.SPECIES).find(k => S.SPECIES[k].type === 'bug' && !S.SPECIES[k].legendary);
  const B = { climber: body('sproutle'), bug: body(bug), flier: body('scalewing'), boomwing: body('boomwing'), walker: body('blazehound') };
  return { ...E, W, C, S, B, bugId: bug };
}

// one try: `brain(E, tr, t, st)` -> keys each frame (and may swap: st.swap = body). -> { won, t, knocks, maxY }
export function play(E, { body, start, yaw, phase, fps, secs, brain, won }) {
  const { player: p, w, W, C } = E;
  p.carry = null; p.glide = null; p.ride = null; p.climbing = false; p.keys = {}; p.joy = null;
  let cur = body;
  const be = () => { p.be = cur ? { ...cur, slip: false, grab: false } : null; if (!cur && p.ride?.be) p.ride = null; };
  be();
  p.pos.set(...start); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0;
  const tr = new W.Trials(); tr.t = phase;
  if (cur) C.bodyStep(p, w, cur, RIDE);
  const out = { won: false, t: 0, knocks: 0, maxY: p.pos.y }, st = {};
  const dt = 1 / fps;
  for (let t = 0; t < secs; t += dt) {
    const k = brain(E, tr, t, st) || {};
    if (st.swap !== undefined) { cur = st.swap; delete st.swap; be(); }
    if (p.be) p.be.grab = !!k.grab;
    p.keys = k;
    p.update(dt);
    for (const e of tr.step(p, dt)) if (e.kind === 'knocked') out.knocks++;
    if (cur) C.bodyStep(p, w, cur, RIDE);
    out.maxY = Math.max(out.maxY, p.pos.y);
    if (won(E)) { out.won = true; out.t = +t.toFixed(2); break; }
  }
  return out;
}

const onRoof = E => { const { W, player: p } = E, T = W.SHAFT; return p.pos.y >= T.roof + 0.9 && p.onGround && !W.inShaft(p.pos); };
const shaftStart = E => { const T = E.W.SHAFT; return [T.x + 0.5, T.floor, T.z + 2.5]; }; // in the door, facing north into the shaft
const naiveClimb = () => ({ KeyW: true });
const naiveGrab = (E, tr, t) => (t < 0.5 ? { KeyW: true } : { grab: true }); // walk in, then hold Climb!
// skilled: wait where the drips cannot reach you (the door, a nook), watch them fall, and go only when you can climb to the next nook (or
// out at the roof) before the next one meets you; step into the nook there, and so on. `up` = how it climbs ({ KeyW } or { grab }).
const skilled = (up = { KeyW: true }) => function (E, tr) {
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
  if (p.pos.z > T.z + 0.9) return { KeyW: true }; // (walk in from the door)
  return { ...up };
};
// a flier that tries hard: up the shaft as high as it goes, into each nook it can reach, out again, up
export function flierTries(E, tr, t, st) {
  const { W, player: p } = E, T = W.SHAFT;
  st.n = (st.n ?? 0) + 1;
  if (p.pos.z > T.z + 0.6) return { KeyW: true, Space: true }; // (all the way in: not under the door's lintel)
  const phase = Math.floor(st.n / 90) % 3; // (it keeps trying: up, into the nook side, back out)
  return phase === 0 ? { Space: true } : phase === 1 ? { KeyD: true, Space: true } : { KeyA: true, Space: true };
}
const jumper = (E, tr, t) => (E.player.pos.z > E.W.SHAFT.z + 0.6 ? { KeyW: true } : { Space: true, KeyD: (t % 2) > 1 });
// mixes without Climb: a flier at the cap swaps to the walker and jumps; a walker in the shaft swaps to the flier
const mixFlierWalker = (E, tr, t, st) => { const p = E.player; if (!st.did && p.capped) { st.did = true; st.swap = E.B.walker; } return st.did ? { Space: true, KeyD: (t % 1.4) > 0.7 } : flierTries(E, tr, t, st); };
const mixWalkerFlier = (E, tr, t, st) => { if (!st.did && t > 1.5) { st.did = true; st.swap = E.B.boomwing; } return st.did ? flierTries(E, tr, t, st) : jumper(E, tr, t); };
// the hill shortcut: from the cave hill's top (east), fly straight at the tower's roof as high as the cap lets you
function glider(E) { const { W, player: p } = E, T = W.SHAFT; const dx = T.x + 0.5 - p.pos.x, dz = T.z + 0.5 - p.pos.z; p.yaw = Math.atan2(-dx, -dz); return { KeyW: true, Space: true }; }

export async function runTower({ tries = 12, fps = [60, 20] } = {}) {
  const E = await setup(), problems = [], out = {}, T = E.W.SHAFT, B = E.B, L = E.L;
  const ice = [T.x + 3.4, T.floor, T.z + 0.5]; // outside the tower's east wall, facing west into it
  let hx = T.x + 12; for (let x = T.x + 12; x < 222; x++) if (L.heightAt(x, T.z) > L.heightAt(hx, T.z)) hx = x; // (the highest ground east of the tower)
  const hill = [hx + 0.5, L.heightAt(hx, T.z) + 1, T.z + 0.5]; // the top of the hill east of the tower
  const rows = {
    naiveClimb: { body: B.climber, brain: naiveClimb, want: 'never' },
    naiveGrab: { body: B.climber, brain: naiveGrab, want: 'never' },
    skilledClimb: { body: B.climber, brain: skilled(), want: 'always' },
    skilledGrab: { body: B.climber, brain: skilled({ grab: true }), want: 'always' },
    bugSkilled: { body: B.bug, brain: skilled(), want: 'always' },
    flier: { body: B.flier, brain: flierTries, want: 'never' },
    boomwing: { body: B.boomwing, brain: flierTries, want: 'never' },
    boomwingSkilled: { body: B.boomwing, brain: skilled(), want: 'never' },
    walker: { body: B.walker, brain: jumper, want: 'never' },
    onFoot: { body: null, brain: jumper, want: 'never' },
    mixFlierWalker: { body: B.flier, brain: mixFlierWalker, want: 'never' },
    mixWalkerFlier: { body: B.walker, brain: mixWalkerFlier, want: 'never' },
    hillGlider: { body: B.flier, start: hill, brain: glider, want: 'never' },
    iceWall: { body: B.climber, start: ice, yaw: Math.PI / 2, brain: () => ({ KeyW: true }), want: 'never' }, // (yaw pi/2: forward is -x)
    iceGrab: { body: B.bug, start: ice, yaw: Math.PI / 2, brain: () => ({ grab: true }), want: 'never' },
  };
  for (const [name, r] of Object.entries(rows).filter(([n]) => !process.env.WAYS_ROWS || process.env.WAYS_ROWS.split(',').includes(n))) for (const f of fps) {
    let wins = 0, times = [], knocks = 0, top = 0;
    for (let i = 0; i < tries; i++) {
      const res = play(E, { body: r.body, start: r.start ?? shaftStart(E), yaw: r.yaw ?? 0, phase: i * T.every / tries + 0.011, fps: f, secs: 40, brain: r.brain, won: onRoof });
      if (res.won) { wins++; times.push(res.t); }
      knocks += res.knocks; top = Math.max(top, res.maxY);
    }
    out[`${name}@${f}`] = { wins, of: tries, median: times.sort((a, b) => a - b)[times.length >> 1] ?? null, knocks, top: +top.toFixed(1) };
    if (r.want === 'never' && wins) problems.push(`tower: ${name} at ${f} fps reached the roof ${wins}/${tries}`);
    if (r.want === 'always' && wins < tries) problems.push(`tower: ${name} at ${f} fps reached the roof only ${wins}/${tries}`);
  }
  out.bug = E.bugId; out.roof = T.roof + 1; out.hill = hill.map(v => +v.toFixed(1));
  return { problems, out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = await runTower();
  for (const [k, v] of Object.entries(a.out)) console.log(k.padEnd(22), JSON.stringify(v));
  if (a.problems.length) { console.log('PROBLEMS:\n' + a.problems.join('\n')); process.exit(1); }
  console.log('ok');
}
