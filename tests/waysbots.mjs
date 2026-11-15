// Chapter 3 step C (plans/chapter3-abilities-build.md): the Drip Tower, the first ABILITY place (Climb), with the REAL Player in Node
// (wobbleEnv: the real Wobbleland terrain), the real body rules (creatureways.js bodyOf / bodyStep from abilities.js, player.js clingStep)
// and the real place rules (wayland.js Trials), in the game's own order each frame: Player.update, Trials.step, bodyStep. At 60 and
// 20 fps, from 12 moments of the drips' clock. Bodies come from real species (bodyOf(id, SPECIES[id])).
//   with Climb: a climber that just climbs (walks into the wall) is knocked down every time; a skilled one (waits in the nooks) always
//          reaches the roof (Sproutle: Grass; a Bug that also flies: it grips the wall it flies into);
//   without Climb nobody gets up: a flier (the fly cap: 6 over the floor right below), Boomwing, a walker jumping, you on foot,
//          a flier gliding in from the cave hill's top (the highest ground near), the tower's ice from outside even for a climber,
//          and mixes by swapping mid-way (flier -> walker at the cap, walker -> flier in a nook).
//   spots (the crags and clouds, SPOTS: anywhere in Wobbleland, nothing marks them): a climber walking into a crag gets on top, so does a
//          Bug (flies into it, then climbs); a flier never gets on a crag (taller than the fly cap), a walker never; a flier rises onto
//          every cloud, a climber and a walker never (no wall, too high to jump).
//   sluice (the Sluice Gate, Swim): a skilled swimmer (dives, rides the bubble jets) always gets through before the gate shuts, a Bubble
//          creature (Fly + Swim) too; straight through the kelp never; nobody without Swim (walker, on foot, flier, climber, a flier that
//          sinks as a walker) ever.
//   currents (the floating river, a lake lead, the cave river): every Swim creature swims up them (5+ blocks in 3 s), nobody else gets
//          more than 1 upstream (owner 2026-11-14).
//   node tests/waysbots.mjs     (exit 1 on a problem; WAYS_PLACES=tower,sluice,spots, WAYS_ROWS=...)
import { wobbleEnv } from './wobblenode.mjs';

const RIDE = { // riding.js RIDE
  land: { kind: 'land', speed: 7.0, sprint: 9.5, jump: 11.2 },
  water: { kind: 'water', speed: 4.3, sprint: 6.2, jump: 8.6, landSlow: 0.5 },
  sky: { kind: 'sky', speed: 7.5, climb: 5, sink: 4, cap: 6, glide: 6, drift: 1.2 },
};

export async function setup() {
  const E = await wobbleEnv(), W = await import('../src/wayland.js'), C = await import('../src/creatureways.js'), S = await import('../src/species.js');
  E.w.setLive = (x, y, z, id) => { if (E.w.inBounds(x, y, z)) E.w.data[E.w.index(x, y, z)] = id; }; // (the islands and the gate move blocks)
  const Q = await import('../src/sluice.js');
  const body = id => C.bodyOf(id, S.SPECIES[id]);
  const bug = Object.keys(S.SPECIES).find(k => S.SPECIES[k].type === 'bug' && !S.SPECIES[k].legendary);
  const B = { climber: body('sproutle'), bug: body(bug), flier: body('scalewing'), boomwing: body('boomwing'), walker: body('blazehound'), swimmer: body('tidalord'), bubble: body(Object.keys(S.SPECIES).find(k => S.SPECIES[k].type === 'bubble')) };
  return { ...E, W, C, S, Q, B, bugId: bug, B_WATER: (await import('../src/blocks.js')).B.WATER };
}

// one try: `brain(E, tr, t, st)` -> keys each frame (and may swap: st.swap = body). -> { won, t, knocks, maxY }
export function play(E, { body, start, yaw, phase, fps, secs, brain, won }) {
  const { player: p, w, W, C } = E;
  p.carry = null; p.glide = null; p.ride = null; p.climbing = false; p.keys = {}; p.joy = null; p.diving = false; p.kick = null; // (nothing carried over from the last try)
  let cur = body;
  const be = () => { p.be = cur ? { ...cur, slip: false } : null; if (!cur && p.ride?.be) p.ride = null; };
  be();
  p.pos.set(...start); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0;
  const tr = new W.Trials(w); tr.t = phase; // (each try at another moment of the drips' clock)
  if (cur) C.bodyStep(p, w, cur, RIDE);
  const out = { won: false, t: 0, knocks: 0, maxY: p.pos.y }, st = {};
  const dt = 1 / fps;
  for (let t = 0; t < secs; t += dt) {
    const k = brain(E, tr, t, st) || {};
    if (st.swap !== undefined) { cur = st.swap; delete st.swap; be(); }
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
// skilled: wait where the drips cannot reach you (the door, a nook), watch them fall, and go only when you can climb to the next nook (or
// out at the roof) before the next one meets you; step into the nook there, and so on.
const skilled = (up = { KeyW: true }) => function (E, tr) { // (`up`: the keys that climb: walking into the wall)
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

const steer = (p, x, z) => { p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); };

/* ---- the spots: crags (Climb) and clouds (Fly), anywhere in Wobbleland ---- */
// walk (or fly) straight at the spot's middle from 8 blocks south of it; a flier holds Jump (rises to its cap) all the way
const spotBrain = (q, { fly = false } = {}) => (E) => {
  const p = E.player, cx = q.kind === 'crag' ? q.x + q.w / 2 : q.x + 0.5, cz = q.kind === 'crag' ? q.z + q.d / 2 : q.z + 0.5;
  const over = Math.hypot(p.pos.x - cx, p.pos.z - cz) < 0.8; // (over its middle: let go of everything and settle onto it)
  steer(p, cx, cz);
  return over ? {} : { KeyW: true, Space: fly };
};
const spotTop = q => E => { const p = E.player; return p.onGround && p.pos.y >= q.top - 0.05; };
export async function runSpots({ fps = [60, 20] } = {}) {
  const E = await setup(), problems = [], out = {}, B = E.B;
  for (const q of E.w.spots) {
    const front = q.kind === 'crag' ? [q.x + q.w / 2, q.ground + 1, q.z + q.d + 8] : [q.x + 0.5, q.ground + 1, q.z + 8.5];
    const rows = q.kind === 'crag'
      ? { climber: [B.climber, {}, 'always'], bug: [B.bug, {}, 'always'], flier: [B.flier, { fly: true }, 'never'], boomwing: [B.boomwing, { fly: true }, 'never'], walker: [B.walker, { fly: true }, 'never'], onFoot: [null, { fly: true }, 'never'] }
      : { flier: [B.flier, { fly: true }, 'always'], boomwing: [B.boomwing, { fly: true }, 'always'], bug: [B.bug, { fly: true }, 'always'], climber: [B.climber, { fly: true }, 'never'], walker: [B.walker, { fly: true }, 'never'], onFoot: [null, { fly: true }, 'never'] };
    for (const [name, [body, how, want]] of Object.entries(rows)) for (const f of fps) {
      const res = play(E, { body, start: front, yaw: 0, phase: 0, fps: f, secs: 14, brain: spotBrain(q, how), won: spotTop(q) });
      out[`${q.id}.${name}@${f}`] = { won: res.won, t: res.t, top: +res.maxY.toFixed(1), need: q.top };
      if (want === 'always' && !res.won) problems.push(`${q.id}: ${name} at ${f} fps did not get on top (reached ${res.maxY.toFixed(1)} of ${q.top})`);
      if (want === 'never' && res.won) problems.push(`${q.id}: ${name} at ${f} fps got on top`);
    }
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
    return { KeyW: true, ShiftLeft: true, Space: kick && p.diving && st.n % 2 === 0 }; // (under water Jump kicks; never at the surface: there it jumps out)
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

/* ---- currents: a swimmer swims up them, everyone else is held back or carried (owner 2026-11-14: Bottlet and Tightropa were as fast) ---- */
export async function runCurrents({ fps = [60, 20] } = {}) {
  const E = await setup(), problems = [], out = {}, w = E.w;
  const top = (x, z) => { let t = -1; for (let y = 0; y < 40; y++) if (w.get(x, y, z) === E.B_WATER) t = y; return t; };
  const places = [['river', 64, 196, Math.PI, 1], ['lead', 54, 168, 0, -1], ['cave', 199, 200, Math.PI, 1]]; // (the floating river, a lake lead, the cave river: x, z, yaw upstream, +1 = upstream is +z)
  const bodies = { bottlet: E.C.bodyOf('bottlet', E.S.SPECIES.bottlet), tidalord: E.B.swimmer, tightropa: E.C.bodyOf('tightropa', E.S.SPECIES.tightropa), walker: E.B.walker, onFoot: null };
  for (const [where, x, z, yaw, sign] of places) for (const [name, body] of Object.entries(bodies)) for (const f of fps) for (const sprint of [false, true]) {
    let z1 = z;
    play(E, { body, start: [x + 1, top(x, z) + 0.5, z + 0.5], yaw, phase: 0, fps: f, secs: 3, brain: () => ({ KeyW: true, ShiftLeft: sprint }), won: (E2) => { z1 = E2.player.pos.z; return false; } });
    const up = +(sign * (z1 - (z + 0.5))).toFixed(1), swims = !!body?.swim;
    out[`${where}.${name}${sprint ? '.sprint' : ''}@${f}`] = up;
    if (swims && up < 5) problems.push(`${where}: ${name} (Swim) swam only ${up} upstream in 3 s at ${f} fps`);
    if (!swims && up > 1) problems.push(`${where}: ${name} (no Swim) got ${up} upstream in 3 s at ${f} fps`);
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
    skilledClimb: { body: B.climber, brain: skilled(), want: 'always' },
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
  const which = (process.env.WAYS_PLACES || 'tower,sluice,spots,currents').split(',');
  const runs = { tower: runTower, sluice: runSluice, spots: runSpots, currents: runCurrents }, problems = [];
  for (const w of which) { const a = await runs[w](); for (const [k, v] of Object.entries(a.out)) console.log(k.padEnd(24), JSON.stringify(v)); problems.push(...a.problems); }
  if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
  console.log('ok');
}
