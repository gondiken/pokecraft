// Chapter 3 step C (plans/chapter3-abilities-build.md): the Drip Tower, the first ABILITY place (Climb), with the REAL Player in Node
// (wobbleEnv: the real Wobbleland terrain), the real body rules (creatureways.js bodyOf / bodyStep from abilities.js, player.js clingStep)
// and the real place rules (wayland.js Trials), in the game's own order each frame: Player.update, Trials.step, bodyStep. At 60 and
// 20 fps, from 12 moments of the drips' clock. Bodies come from real species (bodyOf(id, SPECIES[id])).
//   with Climb: a climber that just climbs (W, or Climb! held) is knocked down every time; a skilled one (waits in the nooks) always
//          reaches the roof, with W or with Climb! held (Sproutle: Grass; a Bug that also flies: it grips the wall it flies into);
//   without Climb nobody gets up: a flier (the fly cap: 6 over the floor right below), Boomwing, a walker jumping, you on foot,
//          a flier gliding in from the cave hill's top (the highest ground near), the tower's ice from outside even for a climber,
//          and mixes by swapping mid-way (flier -> walker at the cap, walker -> flier in a nook).
//   isles (the Floating Isles, Fly): flying straight on never reaches the chest; hovering to its highest with no timing seldom (the drifting
//          and the bobbing island); a skilled flier (hovers at the edge, goes when the next island will be close and low) always, Boomwing
//          and a Bug too; nobody without Fly gets onto the first island; a Bug taking off low meets a cloud's side and cannot climb it.
//   sluice (the Sluice Gate, Swim): a skilled swimmer (dives, rides the bubble jets) always gets through before the gate shuts, a Bubble
//          creature (Fly + Swim) too; straight through the kelp never; nobody without Swim (walker, on foot, flier, climber, a flier that
//          sinks as a walker) ever.
//   node tests/waysbots.mjs     (exit 1 on a problem; WAYS_PLACES=tower,isles,sluice, WAYS_ROWS=...)
import { wobbleEnv } from './wobblenode.mjs';

const RIDE = { // riding.js RIDE
  land: { kind: 'land', speed: 7.0, sprint: 9.5, jump: 11.2 },
  water: { kind: 'water', speed: 4.3, sprint: 6.2, jump: 8.6, landSlow: 0.5 },
  sky: { kind: 'sky', speed: 7.5, climb: 5, sink: 4, cap: 6, glide: 6, drift: 1.2 },
};

export async function setup() {
  const E = await wobbleEnv(), W = await import('../src/wayland.js'), C = await import('../src/creatureways.js'), S = await import('../src/species.js');
  E.w.setLive = (x, y, z, id) => { if (E.w.inBounds(x, y, z)) E.w.data[E.w.index(x, y, z)] = id; }; // (the islands and the gate move blocks)
  const I = await import('../src/skyisles.js'), Q = await import('../src/sluice.js');
  const body = id => C.bodyOf(id, S.SPECIES[id]);
  const bug = Object.keys(S.SPECIES).find(k => S.SPECIES[k].type === 'bug' && !S.SPECIES[k].legendary);
  const B = { climber: body('sproutle'), bug: body(bug), flier: body('scalewing'), boomwing: body('boomwing'), walker: body('blazehound'), swimmer: body('tidalord'), bubble: body(Object.keys(S.SPECIES).find(k => S.SPECIES[k].type === 'bubble')) };
  return { ...E, W, C, S, I, Q, B, bugId: bug };
}

// one try: `brain(E, tr, t, st)` -> keys each frame (and may swap: st.swap = body). -> { won, t, knocks, maxY }
export function play(E, { body, start, yaw, phase, fps, secs, brain, won }) {
  const { player: p, w, W, C } = E;
  p.carry = null; p.glide = null; p.ride = null; p.climbing = false; p.keys = {}; p.joy = null;
  let cur = body;
  const be = () => { p.be = cur ? { ...cur, slip: false, grab: false } : null; if (!cur && p.ride?.be) p.ride = null; };
  be();
  p.pos.set(...start); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0;
  const tr = new W.Trials(w); tr.t = phase; tr.isles.t = phase; // (each try at another moment of the drips' and the islands' clocks)
  if (cur) C.bodyStep(p, w, cur, RIDE);
  const out = { won: false, t: 0, knocks: 0, maxY: p.pos.y }, st = {};
  const dt = 1 / fps;
  for (let t = 0; t < secs; t += dt) {
    const k = brain(E, tr, t, st) || {};
    if (st.swap !== undefined) { cur = st.swap; delete st.swap; be(); }
    if (p.be) { p.be.grab = !!k.grab; p.be.rise = !!k.rise; if (k.kick) p.be.kick = true; }
    p.keys = k;
    p.update(dt);
    for (const e of tr.step(p, dt)) if (e.kind === 'knocked') out.knocks++;
    if (cur) C.bodyStep(p, w, cur, RIDE);
    out.maxY = Math.max(out.maxY, p.pos.y);
    if (won(E, tr)) { out.won = true; out.t = +t.toFixed(2); break; }
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

/* ---- the Floating Isles (Fly) ---- */
const steer = (p, x, z) => { p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); };
// the point on island i's rim toward (tx, tz), at its offset o
function rim(q, o, tx, tz, inset = 0.2) { const cx = q.x + o[0] + 0.5, cz = q.z + o[2] + 0.5, d = Math.hypot(tx - cx, tz - cz) || 1; return [cx + (tx - cx) / d * (q.r + 0.5 - inset), cz + (tz - cz) / d * (q.r + 0.5 - inset)]; }
// a flier bot. timing: 'none' (flies straight on: the naive kid), 'hover' (hovers to its highest at the edge, then goes: no timing),
// 'skilled' (hovers at the edge and goes only when the next island will be close and low enough when it gets there)
export const isleBot = timing => function (E, tr) {
  const { I, player: p } = E, R = tr.isles, L = I.ISLES.list, st = tr.bot ??= { go: false, from: -2 };
  const cur = R.last, nx = Math.min(L.length - 1, cur + 1), q = L[nx], o = R.offs[nx] ?? [0, 0, 0];
  const tc = [q.x + o[0] + 0.5, q.z + o[2] + 0.5];
  if (timing === 'none' || cur < 0 && p.pos.z > I.ISLES.pit.z1 + 1 && timing !== 'skilled' && timing !== 'hover') { steer(p, ...tc); return { KeyW: true, Space: true }; }
  if (st.from !== cur) { st.from = cur; st.go = false; }
  if (st.go) { steer(p, ...tc); return { KeyW: true, Space: true }; }
  // get ready: at the edge toward the next island, at the cap
  const here = cur >= 0 ? L[cur] : null, ho = cur >= 0 ? R.offs[cur] : [0, 0, 0];
  const edge = here ? rim(here, ho, ...tc) : [p.pos.x, I.ISLES.pit.z1 + 1.25];
  if (!here) edge[0] = tc[0];
  const dx = edge[0] - p.pos.x, dz = edge[1] - p.pos.z, far = Math.hypot(dx, dz);
  const keys = { Space: true };
  if (far > 0.25) { steer(p, ...edge); keys.KeyW = true; }
  const top = (here ? here.S + ho[1] : 11) + 6;
  if (timing === 'low' && far <= 0.4 && cur >= 0) { st.go = true; return keys; } // (goes at once, low: it meets the next island's side)
  if (far > 0.4 || p.pos.y < top - 0.05) return keys;
  if (timing === 'hover') { st.go = true; return keys; }
  // skilled: will the next island be within reach when I get there (and a moment either side)? The sinking starts where the ground
  // under me ends (the rim of this island, or the shore's edge).
  const sup = here ? rim(here, ho, ...tc, 0) : [p.pos.x, I.ISLES.pit.z1 + 1];
  const ok = dt => {
    const t = tr.isles.t, oo0 = I.isleOffset(nx, t);
    const g0 = Math.hypot(q.x + oo0[0] + 0.5 - sup[0], q.z + oo0[2] + 0.5 - sup[1]) - (q.r + 0.5);
    const at = t + (Math.max(0, g0) + 0.3) / 7.5 + dt, oo = I.isleOffset(nx, at);
    const gap = Math.hypot(q.x + oo[0] + 0.5 - sup[0], q.z + oo[2] + 0.5 - sup[1]) - (q.r + 0.5) + 0.2;
    return p.pos.y - 4 / 7.5 * gap >= q.S + oo[1] + 0.1;
  };
  if (ok(0) && ok(-0.25) && ok(0.25)) st.go = true;
  return keys;
};
const onTopIsle = (E, tr) => tr.isles.won();

export async function runIsles({ tries = 12, fps = [60, 20] } = {}) {
  const E = await setup(), problems = [], out = {}, B = E.B, I = E.I;
  const start = I.ISLES.start.slice(0, 3), P = I.ISLES.list[0];
  const rows = {
    naive: { body: B.flier, brain: isleBot('none'), want: 'never' },
    hover: { body: B.flier, brain: isleBot('hover'), want: 'some' },
    skilled: { body: B.flier, brain: isleBot('skilled'), want: 'always' },
    boomwing: { body: B.boomwing, brain: isleBot('skilled'), want: 'always' },
    bug: { body: B.bug, brain: isleBot('skilled'), want: 'always' },
    walker: { body: B.walker, brain: (E2, tr) => { steer(E2.player, P.x + 0.5, P.z + 0.5); return { KeyW: true, ShiftLeft: true, Space: E2.player.pos.z < I.ISLES.pit.z1 + 1.6 }; }, want: 'never' },
    climber: { body: B.climber, brain: (E2, tr) => { steer(E2.player, P.x + 0.5, P.z + 0.5); return { KeyW: true, ShiftLeft: true, Space: E2.player.pos.z < I.ISLES.pit.z1 + 1.6 }; }, want: 'never' },
    onFoot: { body: null, brain: (E2) => { steer(E2.player, P.x + 0.5, P.z + 0.5); return { KeyW: true, ShiftLeft: true, Space: E2.player.pos.z < I.ISLES.pit.z1 + 1.6 }; }, want: 'never' },
    bugClings: { body: B.bug, brain: (E2, tr, t, st) => { const k = isleBot(tr.isles.last >= 0 ? 'low' : 'skilled')(E2, tr); if (E2.player.climbing) st.climbed = true; return { ...k, grab: tr.isles.last >= 0 }; }, want: 'never' }, // (a Bug that takes off low meets the next island's side and holds Climb!: clouds give no grip)
    mixWalker: { body: B.flier, brain: (E2, tr, t, st) => { const k = isleBot('skilled')(E2, tr); if (!st.did && tr.isles.last >= 1) { st.did = true; st.swap = E2.B.climber; } return st.did ? { KeyW: true, Space: true } : k; }, want: 'never' },
  };
  for (const [name, r] of Object.entries(rows).filter(([n]) => !process.env.WAYS_ROWS || process.env.WAYS_ROWS.split(',').includes(n))) for (const f of fps) {
    let wins = 0, times = [], best = 0;
    for (let i = 0; i < tries; i++) {
      let reach = -1;
      const res = play(E, { body: r.body, start, yaw: 0, phase: i * 6 / tries + 0.013, fps: f, secs: 60, brain: r.brain, won: (E2, tr) => { reach = Math.max(reach, tr.isles.best); return onTopIsle(E2, tr); } });
      if (res.won) { wins++; times.push(res.t); }
      best += reach + 1;
    }
    out[`isles.${name}@${f}`] = { wins, of: tries, median: times.sort((a, b) => a - b)[times.length >> 1] ?? null, isles: +(best / tries).toFixed(1) };
    if (r.want === 'never' && wins) problems.push(`isles: ${name} at ${f} fps reached the chest ${wins}/${tries}`);
    if (r.want === 'always' && wins < tries) problems.push(`isles: ${name} at ${f} fps reached the chest only ${wins}/${tries}`);
    if (r.want === 'some' && wins === tries) problems.push(`isles: ${name} at ${f} fps (no timing) always won: the moving islands do nothing`);
  }
  return { problems, out };
}

/* ---- the Sluice Gate (Swim) ---- */
// a swimmer bot: from the plate, through waypoints (x, y, z), looking at each (it swims where it looks under water), Shift held, kicks
export function sluiceBot(points, { kick = true } = {}) {
  return function (E, tr, t) {
    const p = E.player, st = tr.bot ??= { i: 0, n: 0 };
    while (st.i < points.length - 1 && Math.hypot(points[st.i][0] - p.pos.x, points[st.i][1] - p.pos.y - 0.4, points[st.i][2] - p.pos.z) < 1.1) st.i++;
    const [x, y, z] = points[st.i];
    steer(p, x, z);
    const d = Math.hypot(x - p.pos.x, z - p.pos.z) || 1;
    p.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(y - (p.pos.y + 0.9), d)));
    st.n++;
    return { KeyW: true, ShiftLeft: true, kick: kick && st.n % 2 === 0, Space: false };
  };
}
export async function runSluice({ tries = 6, fps = [60, 20] } = {}) {
  const E = await setup(), problems = [], out = {}, B = E.B, Q = E.Q, S = Q.SLUICE;
  const start = [S.plate.x + 0.5, 11, S.plate.z + 0.5];
  if (process.env.SLUICE_OPEN) S.shut = 99; // (tuning: how long each one takes)
  const yM = 6.6;
  const jets = [[128.5, 9.5, 90.2], [131.5, yM, 88.6], [141.5, yM, 88.7], [147.6, yM, 88.6], [147.6, yM, 99.5], [147.5, yM, 102.2]];
  const straight = [[128.5, 9.5, 90.2], [132, yM, 86.5], [145, yM, 86.5], [145, yM, 99.5], [145, yM, 102.2]];
  const rows = {
    naive: { body: B.swimmer, brain: sluiceBot(straight), want: 'never' },
    skilled: { body: B.swimmer, brain: sluiceBot(jets), want: 'always' },
    bubble: { body: B.bubble, brain: sluiceBot(jets), want: 'always' },
    walker: { body: B.walker, brain: sluiceBot(jets), want: 'never' },
    onFoot: { body: null, brain: sluiceBot(jets), want: 'never' },
    flier: { body: B.flier, brain: sluiceBot(jets), want: 'never' },
    climber: { body: B.climber, brain: sluiceBot(jets), want: 'never' },
    mixFlierWalker: { body: B.flier, brain: (E2, tr, t, st) => { const k = sluiceBot(jets)(E2, tr, t); if (!st.did && E2.player.pos.z < 90.5) { st.did = true; st.swap = E2.B.walker; } return k; }, want: 'never' }, // (flies to the pond, then sinks as a walker)
  };
  for (const [name, r] of Object.entries(rows).filter(([n]) => !process.env.WAYS_ROWS || process.env.WAYS_ROWS.split(',').includes(n))) for (const f of fps) {
    let wins = 0, times = [];
    for (let i = 0; i < tries; i++) {
      let left = null, reached = null;
      const res = play(E, { body: r.body, start, yaw: 0, phase: i * 0.37, fps: f, secs: 30, brain: r.brain, won: (E2, tr) => { if (left == null && tr.sluice.since != null) left = tr.sluice.t; if (Q.inGrotto(E2.player.pos)) { reached = tr.sluice.t - (left ?? tr.sluice.t); return true; } return false; } });
      if (res.won) { wins++; times.push(+reached.toFixed(2)); }
    }
    out[`sluice.${name}@${f}`] = { wins, of: tries, times: times.sort((a, b) => a - b).join(' ') };
    if (r.want === 'never' && wins) problems.push(`sluice: ${name} at ${f} fps got through ${wins}/${tries}`);
    if (r.want === 'always' && wins < tries) problems.push(`sluice: ${name} at ${f} fps got through only ${wins}/${tries}`);
  }
  return { problems, out };
}

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
  const which = (process.env.WAYS_PLACES || 'tower,isles,sluice').split(',');
  const runs = { tower: runTower, isles: runIsles, sluice: runSluice }, problems = [];
  for (const w of which) { const a = await runs[w](); for (const [k, v] of Object.entries(a.out)) console.log(k.padEnd(24), JSON.stringify(v)); problems.push(...a.problems); }
  if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
  console.log('ok');
}
