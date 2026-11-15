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
//   dig (step D's second pair): every mound: a digger (Rattlepup, Bone; Pebblor, Rock) taps its way down to the buried chest, nobody else
//          ever sees it; the Warm-or-Cold Dig: a skilled digger (digs the square that splits where the key can be best) always finds the
//          key, digging at random rarely (at most a quarter), a non-digger never.
//   push:  every boulder cave: a pusher (Woolumph, Normal; Pebblor) walks the boulder in and follows it, nobody else gets in; the Ball
//          Garden: the 5-push solution opens the case, pushing each ball straight at its nearest hole never does, nor anyone without Push.
//   burn (step D's third pair): every thicket and ice hut: a burner (Blazehound, Fire; Scalewing, Drake) burns the door and walks in,
//          nobody else; the Windy Bramble Tunnel: lighting each plug as the windsock swings in always gets through, lighting it at
//          once never, nobody without Burn.
//   freeze: every rapids: a freezer (Frostling) freezes the water ahead and walks up, nobody else (not a swimmer sprinting or diving,
//          not a flier in the spray, not a climber on the wet walls); the Frozen Falls: freeze it, swap to a climber at once, climb:
//          always; waiting 4 s first: never; the freezer or the climber alone, a flier, a swimmer: never.
//   squeeze (step D's fourth pair): every cracked rock: a squishy creature (Antsy, Tiny; Wobblock, Slime: it squeezes instead of climbing;
//          Origrane, Paper) squashes flat through the crack, nobody else; the Boulder Run: hiding in the cracks as the boulders roll by
//          always gets up, walking straight up never, nobody without Squeeze.
//   pass:  every pencil house: a ghostly creature (Flipsy, Dream; Wispurr, Ghost) walks through its faded wall, nobody else (a climber
//          finds nothing to hold on it); the Sliding Smudge: drifting with each patch always, walking straight in never.
//   node tests/waysbots.mjs     (exit 1 on a problem; WAYS_PLACES=tower,sluice,spots,currents,dig,push,burn,freeze,squeeze,pass, WAYS_ROWS=...)
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
  // shallow water (the meadow's zigzag river, one block deep, no current): a swimmer is fast there too (owner 2026-11-15)
  for (const [name, body] of [['bottlet', bodies.bottlet], ['blazehound', bodies.walker], ['tightropa', bodies.tightropa]]) for (const f of fps) {
    let x1 = 161.5;
    play(E, { body, start: [161.5, top(161, 174) + 0.2, 174.5], yaw: Math.PI / 2, phase: 0, fps: f, secs: 1.2, brain: () => ({ KeyW: true }), won: (E2) => { x1 = E2.player.pos.x; return false; } });
    out[`shallow.${name}@${f}`] = +(161.5 - x1).toFixed(1);
  }
  for (const f of fps) if (!(out[`shallow.bottlet@${f}`] > 1.8 * out[`shallow.blazehound@${f}`])) problems.push(`shallow: Bottlet ${out[`shallow.bottlet@${f}`]} not clearly faster than Blazehound ${out[`shallow.blazehound@${f}`]} at ${f} fps`);
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


/* ---- step D's second pair: Dig (soft earth: the mounds, the Warm-or-Cold Dig) and Push (the boulder caves, the Ball Garden) ---- */
// what pressing the big button does in the game (wobblelive.js Earthworks.use / hit): the aimed soft earth is dug if you can
export async function earthSetup() {
  const E = await setup(), T = await import('../src/things.js'), K = await import('../src/earthworks.js'), b = id => E.C.bodyOf(id, E.S.SPECIES[id]);
  E.T = T; E.K = K;
  Object.assign(E.B, { digger: b('rattlepup'), pusher: b('woolumph'), rock: b('pebblor'), swimmer2: b('tidalord') });
  return E;
}
const press = (E, tr) => { const p = E.player, hit = E.T.aimAt(E.w, p.eyePos, p.forward, 6); if (hit) tr.earth.dig(hit, p.be?.abilities ?? []); return hit; };
const lookAtCell = (p, x, y, z) => p.lookAt({ x: x + 0.5, y: y + 0.98, z: z + 0.5 }); // (its top face: what a child taps)
// walk to (x, z) and stop there (jumps when something is in the way). -> keys, or null when there
function walkTo(p, x, z, near = 0.22) {
  const d = Math.hypot(x - p.pos.x, z - p.pos.z);
  if (d < near) return null;
  steer(p, x, z);
  return { KeyW: true, Space: p.hitWall, ...(d < 0.8 ? {} : {}) };
}

// the mounds: a digger walks up, looks at where the chest must be and taps until it sees it (each tap digs the soft earth in the way);
// anyone else never sees it
function moundBrain(m) {
  return (E, tr, t, st) => {
    const p = E.player;
    st.n = (st.n ?? 0) + 1;
    const k = walkTo(p, m.x + 0.5, m.z + 2.6, 0.3);
    if (k) return k;
    lookAtCell(p, ...m.chest);
    if (st.n % 6 === 0) press(E, tr); // (a tap every few frames, like a child)
    return {};
  };
}
const seesChest = (x, y, z) => E => { const p = E.player, h = E.T.aimAt(E.w, p.eyePos, p.forward, 6); return !!h && h.x === x && h.y === y && h.z === z && h.id === E.B_CHEST; };

// the Warm-or-Cold Dig: stand by the patch's rim on the side nearest the square, look at it, press. Skilled: digs the square that splits
// the squares the key can still be under best; naive: random squares.
function patchBrain(pick) {
  return (E, tr, t, st) => {
    const p = E.player, P = E.w.earth.patch, R = tr.earth;
    st.cool = (st.cool ?? 0) - 1;
    if (R.rumble != null) { st.target = null; return {}; } // (the earth rumbles shut: wait)
    if (!st.target || E.w.get(P.x0 + st.target[0], P.g, P.z0 + st.target[1]) === 0) { st.target = pick(R, st); st.k = 0; }
    const [u, v] = st.target, x = P.x0 + u, z = P.z0 + v;
    // the stand: outside the rim, level with the square, on its nearest side
    const sides = [[x + 0.5, P.z0 - 1.6, v + 1], [x + 0.5, P.z0 + P.n + 1.6, P.n - v], [P.x0 - 1.6, z + 0.5, u + 1], [P.x0 + P.n + 1.6, z + 0.5, P.n - u]].sort((a, b) => a[2] - b[2]);
    const [sx, sz] = sides[0];
    const k = walkTo(p, sx, sz, 0.35);
    if (k) return k;
    lookAtCell(p, x, P.g, z);
    if (st.cool <= 0) { st.cool = 8; press(E, tr); }
    return {};
  };
}
const skilledPick = R => {
  const cands = R.w.earth && keyCands(R);
  const P = R.w.earth.patch, n = P.n, K = R.w.earth;
  let best = null, bestW = Infinity;
  for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) {
    if (R.holesDug.some(([a, b]) => a === u && b === v)) continue;
    const parts = new Map();
    for (const [a, b] of cands) { const l = Math.max(Math.abs(a - u), Math.abs(b - v)); const key = Math.min(4, l); parts.set(key, (parts.get(key) ?? 0) + 1); }
    let worst = 0; for (const [l, c] of parts) if (l > 0) worst = Math.max(worst, c);
    const score = worst * 2 - (cands.some(([a, b]) => a === u && b === v) ? 1 : 0);
    if (score < bestW) { bestW = score; best = [u, v]; }
  }
  return best;
};
let keyCandsFn = null;
const keyCands = R => keyCandsFn(R.holesDug.map(h => h.slice()));
const randomPick = (R, st) => { st.rng = ((st.rng ?? 12345) * 1103515245 + 12345) % 2147483648; const n = R.w.earth.patch.n; for (;;) { st.rng = (st.rng * 1103515245 + 12345) % 2147483648; const u = st.rng % n, v = Math.floor(st.rng / n) % n; if (!R.holesDug.some(([a, b]) => a === u && b === v)) return [u, v]; } };

export async function runDig({ fps = [60, 20], tries = 8 } = {}) {
  const E = await earthSetup(), problems = [], out = {}, B = E.B;
  E.B_CHEST = (await import('../src/blocks.js')).B.CHEST; keyCandsFn = E.K.keyCandidates;
  const bodies = { digger: [B.digger, 'always'], rock: [B.rock, 'always'], pusher: [B.pusher, 'never'], flier: [B.flier, 'never'], climber: [B.climber, 'never'], walker: [B.walker, 'never'], swimmer: [B.swimmer, 'never'], onFoot: [null, 'never'] };
  for (const m of E.w.earth.mounds) for (const [name, [body, want]] of Object.entries(bodies)) for (const f of fps) {
    const res = play(E, { body, start: [m.x + 0.5, E.L.heightAt(m.x, m.z + 7) + 1, m.z + 7.5], yaw: 0, phase: 0, fps: f, secs: 12, brain: moundBrain(m), won: seesChest(...m.chest) });
    out[`${m.id}.${name}@${f}`] = res.won;
    if (want === 'always' && !res.won) problems.push(`${m.id}: ${name} at ${f} fps did not dig down to the chest`);
    if (want === 'never' && res.won) problems.push(`${m.id}: ${name} at ${f} fps saw the chest`);
  }
  // the Warm-or-Cold Dig: a round per try (each try a new key), the found key opens the case
  const P = E.w.earth.patch;
  const rows = { skilled: [B.digger, skilledPick, 'always'], naive: [B.digger, randomPick, 'rarely'], pusher: [B.pusher, skilledPick, 'never'], flier: [B.flier, skilledPick, 'never'] };
  for (const [name, [body, pick, want]] of Object.entries(rows)) for (const f of fps) {
    let wins = 0, digs = [], fails = [];
    for (let i = 0; i < tries; i++) {
      let found = false, end = null;
      play(E, { body, start: [P.x0 + 4.5, P.g + 1, P.z0 + P.n + 3.5], yaw: 0, phase: 0, fps: f, secs: 60,
        brain: (E2, tr, t, st) => { if (st.round == null) { st.round = tr.earth.round = i + 3 * f; st.rng = 777 + i * 31 + f; } return patchBrain(pick)(E2, tr, t, st); },
        won: (E2, tr) => { const R = tr.earth; if (R.found) { found = true; digs.push(R.holesDug.length + 1); return true; } if (R.rumble != null) { end = R.holesDug.length; return true; } return false; } });
      if (found) wins++; else fails.push(end ?? 'time');
    }
    out[`patch.${name}@${f}`] = { wins, of: tries, digs: digs.join(' '), fails: fails.join(' ') };
    if (want === 'always' && wins < tries) problems.push(`the Warm-or-Cold Dig: ${name} at ${f} fps found the key only ${wins}/${tries}`);
    if (want === 'rarely' && wins > tries / 4) problems.push(`the Warm-or-Cold Dig: ${name} at ${f} fps found the key ${wins}/${tries}`);
    if (want === 'never' && wins) problems.push(`the Warm-or-Cold Dig: ${name} at ${f} fps found the key ${wins}/${tries}`);
  }
  return { problems, out };
}

// the boulder caves: walk at the boulder in the mouth and keep walking: a pusher pushes it in and walks in after it
const caveBrain = c => (E) => { const p = E.player, mx = c.x + 2, mz = c.z + c.d - 1; steer(p, mx, mz - 3); return { KeyW: true }; };
const inCaveRoom = c => E => { const p = E.player; return p.pos.x > c.x && p.pos.x < c.x + c.w && p.pos.z > c.z && p.pos.z < c.z + c.d - 1.2 && p.pos.y < c.g + c.h; };

// the Ball Garden: plan a way on the garden's grid (posts and balls in the way, the low wall hopped over), walk to the cell behind a
// ball and walk into it; skilled = the found solution, naive = push each ball straight toward its nearest hole
function gardenGrid(E, tr) {
  const G = E.w.earth.garden, R = tr.earth, n = G.n;
  const ball = (u, v) => R.balls.some(b => b.at[1] === G.g + 1 && b.at[0] === G.x0 + u && b.at[2] === G.z0 + v);
  const post = (u, v) => G.posts.some(([a, b]) => a === u && b === v);
  const free = (u, v) => u >= -3 && v >= -3 && u <= n + 2 && v <= n + 2 && !(u >= 0 && v >= 0 && u < n && v < n && (post(u, v) || ball(u, v)));
  return { G, R, n, ball, post, free };
}
function pathTo(grid, from, to) {
  const { free } = grid, k = (u, v) => u + ',' + v, prev = new Map([[k(...from), null]]), q = [from];
  while (q.length) {
    const [u, v] = q.shift();
    if (u === to[0] && v === to[1]) { const out = []; for (let c = [u, v]; c; c = prev.get(k(...c))) out.unshift(c); return out; }
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nu = u + du, nv = v + dv; if (free(nu, nv) && !prev.has(k(nu, nv))) { prev.set(k(nu, nv), [u, v]); q.push([nu, nv]); } }
  }
  return null;
}
const gardenSolution = [[0, -1, 0], [0, 0, -1], [0, 1, 0], [0, 0, 1], [1, 0, 1]]; // (ball, du, dv): the search's 5 pushes (earthworks.js GARDEN)
function naivePush(grid) { // each ball toward its nearest open hole, along the bigger gap first
  const { G, R } = grid;
  for (let i = 0; i < R.balls.length; i++) {
    const b = R.balls[i]; if (b.at[1] !== G.g + 1) continue;
    const u = b.at[0] - G.x0, v = b.at[2] - G.z0, open = R.holes.filter(h => !h.full).map(h => [h.x - G.x0, h.z - G.z0]).sort((a, c) => Math.abs(a[0] - u) + Math.abs(a[1] - v) - Math.abs(c[0] - u) - Math.abs(c[1] - v));
    if (!open.length) continue;
    const [hu, hv] = open[0], du = Math.sign(hu - u), dv = Math.sign(hv - v);
    const dirs = Math.abs(hu - u) >= Math.abs(hv - v) ? [[du, 0], [0, dv]] : [[0, dv], [du, 0]];
    for (const [a, c] of dirs) if ((a || c) && grid.free(u - a, v - c) && grid.free(u + a, v + c)) return [i, a, c];
  }
  return null;
}
export { gardenBrain as __gardenBrain, naivePush as __naive };
function gardenBrain(plan) { // plan(grid, st) -> [ball, du, dv] or null
  return (E, tr, t, st) => {
    const p = E.player, grid = gardenGrid(E, tr), { G, R } = grid;
    if (R.balls.some(b => b.from || b.roll)) return {}; // (a ball is rolling: wait)
    if (!st.push) { st.push = plan(grid, st); st.path = null; st.into = 0; if (!st.push) return {}; }
    const [i, du, dv] = st.push, b = R.balls[i], bu = b.at[0] - G.x0, bv = b.at[2] - G.z0;
    if (st.moved != null && b.at.join() !== st.moved) { st.push = null; st.moved = null; return {}; } // (it went: the next push)
    const me = [Math.floor(p.pos.x) - G.x0, Math.floor(p.pos.z) - G.z0], stand = [bu - du, bv - dv];
    const up = p.pos.y > G.g + 1.3; // (standing on a ball's edge or the wall: walk on to the floor first)
    if (me[0] !== stand[0] || me[1] !== stand[1] || Math.hypot(p.pos.x - (G.x0 + stand[0] + 0.5), p.pos.z - (G.z0 + stand[1] + 0.5)) > (up ? 0.05 : 0.25)) {
      if (st.into) { st.into = 0; }
      st.path = pathTo(grid, me, stand);
      if (!st.path) return { KeyW: true };
      const next = st.path[Math.min(1, st.path.length - 1)], tx = G.x0 + next[0] + 0.5, tz = G.z0 + next[1] + 0.5;
      steer(p, tx, tz);
      const wall = (c) => c[0] < 0 || c[1] < 0 || c[0] >= G.n || c[1] >= G.n;
      const hop = wall(next) !== wall(me) || p.hitWall || p.pos.y < G.g + 0.9;
      const d = Math.hypot(tx - p.pos.x, tz - p.pos.z);
      return { KeyW: d > (up ? 0.02 : 0.15), Space: hop && d < 1.2 && !up };
    }
    st.moved = b.at.join();
    steer(p, G.x0 + bu + 0.5, G.z0 + bv + 0.5);
    return { KeyW: true };
  };
}

export async function runPush({ fps = [60, 20], tries = 1 } = {}) {
  const E = await earthSetup(), problems = [], out = {}, B = E.B;
  const bodies = { pusher: [B.pusher, 'always'], rock: [B.rock, 'always'], digger: [B.digger, 'never'], flier: [B.flier, 'never'], climber: [B.climber, 'never'], walker: [B.walker, 'never'], swimmer: [B.swimmer, 'never'], onFoot: [null, 'never'] };
  for (const c of E.w.earth.caves) for (const [name, [body, want]] of Object.entries(bodies)) for (const f of fps) {
    const mx = c.x + 2, mz = c.z + c.d - 1;
    const res = play(E, { body, start: [mx, c.g + 1, mz + 3.5], yaw: 0, phase: 0, fps: f, secs: 10, brain: caveBrain(c), won: inCaveRoom(c) });
    out[`${c.id}.${name}@${f}`] = res.won ? res.t : false;
    if (want === 'always' && !res.won) problems.push(`${c.id}: ${name} at ${f} fps did not push its way in`);
    if (want === 'never' && res.won) problems.push(`${c.id}: ${name} at ${f} fps got in`);
  }
  const G = E.w.earth.garden;
  const solution = () => { let k = 0; return () => gardenSolution[k++] ?? null; };
  const rows = { skilled: [B.pusher, 'always', solution], naive: [B.pusher, 'never', () => naivePush], digger: [B.digger, 'never', solution], flier: [B.flier, 'never', solution], walker: [B.walker, 'never', solution] };
  for (const [name, [body, want, mk]] of Object.entries(rows)) for (const f of fps) {
    let open = false;
    const plan = mk();
    const res = play(E, { body, start: [G.x0 + 4.5, G.g + 1, G.z0 + G.n + 2.5], yaw: 0, phase: 0, fps: f, secs: 60, brain: gardenBrain(plan), won: (E2, tr) => (open = tr.earth.gardenOpen) });
    const R = E.w.trials;
    out[`garden.${name}@${f}`] = res.won ? res.t : false;
    if (want === 'always' && !res.won) problems.push(`the Ball Garden: ${name} at ${f} fps did not open the case`);
    if (want === 'never' && res.won) problems.push(`the Ball Garden: ${name} at ${f} fps opened the case`);
  }
  return { problems, out };
}

/* ---- step D's third pair: Burn (thickets, ice huts, the Windy Bramble Tunnel) and Freeze (the rapids, the Frozen Falls) ---- */
export async function fireSetup() {
  const E = await earthSetup(), F = await import('../src/fireice.js'), b = id => E.C.bodyOf(id, E.S.SPECIES[id]);
  E.F = F;
  Object.assign(E.B, { burner: E.B.walker, freezer: b('frostling'), drake: b('scalewing') }); // (Blazehound is Fire: it burns; Scalewing is Drake: it burns and flies)
  return E;
}
const pressFire = (E, tr) => { const p = E.player, hit = E.T.aimAt(E.w, p.eyePos, p.forward, 6); if (hit) tr.fireice.act(hit, p.be?.abilities ?? []); return hit; };
// walk up to a door, look at it, tap until it is gone, walk in
function doorBrain(stand, door, inside) {
  return (E, tr, t, st) => {
    const p = E.player;
    st.n = (st.n ?? 0) + 1;
    if (!st.open) {
      const k = walkTo(p, stand[0], stand[1], 0.3);
      if (k) return k;
      lookAtCell(p, door[0], door[1], door[2]); p.pitch -= 0.25; // (the door's middle)
      if (st.n % 6 === 0) pressFire(E, tr);
      if (E.w.get(...door) === 0) st.open = true;
      return {};
    }
    steer(p, inside[0], inside[1]);
    return { KeyW: Math.hypot(inside[0] - p.pos.x, inside[1] - p.pos.z) > 0.3 };
  };
}
// the tunnel: walk east to the next plug; skilled waits for the wind to blow in (away from you) with time left, naive burns at once
function tunnelBrain(skilled) {
  return (E, tr, t, st) => {
    const p = E.player, T = E.w.fireice.tunnel, R = tr.fireice;
    st.n = (st.n ?? 0) + 1;
    const next = T.plugs.find(px => E.w.get(px, T.g + 1, T.z) !== 0);
    if (next == null) { steer(p, T.x1 + 3, T.z + 0.5); return { KeyW: true }; }
    const sx = next - 1.6;
    if (p.pos.x < sx - 0.3) { steer(p, sx, T.z + 0.5); return { KeyW: true }; }
    lookAtCell(p, next, T.g + 1, T.z); p.pitch -= 0.2;
    const wind = E.F.windAt(R.t);
    if (st.n % 6 === 0 && (!skilled || (wind.way > 0 && wind.left > E.F.WIND.burn + 0.2))) pressFire(E, tr); // (skilled: light it as the windsock swings in)
    return {};
  };
}
export async function runBurn({ fps = [60, 20], tries = 8 } = {}) {
  const E = await fireSetup(), problems = [], out = {}, B = E.B, FI = E.w.fireice;
  const bodies = { burner: [B.burner, 'always'], drake: [B.drake, 'always'], freezer: [B.freezer, 'never'], digger: [B.digger, 'never'], pusher: [B.pusher, 'never'], climber: [B.climber, 'never'], swimmer: [B.swimmer, 'never'], onFoot: [null, 'never'] };
  const doors = [
    ...FI.thickets.map(h => ({ id: h.id, start: [h.x + 2.5, h.g + 1, h.z + 9.5], stand: [h.x + 2.5, h.z + 6.6], door: [h.x + 2, h.g + 2, h.z + 4], inside: [h.x + 2.5, h.z + 2.5], won: E2 => { const q = E2.player.pos; return q.x > h.x + 1 && q.x < h.x + 4 && q.z > h.z + 1 && q.z < h.z + 3.8; } })),
    ...FI.huts.map(h => ({ id: h.id, start: [h.x + 9.5, h.g + 1, h.z + 2.5], stand: [h.x + 6.6, h.z + 2.5], door: [h.x + 4, h.g + 2, h.z + 2], inside: [h.x + 2.5, h.z + 2.5], won: E2 => { const q = E2.player.pos; return q.x > h.x + 1 && q.x < h.x + 3.8 && q.z > h.z + 1 && q.z < h.z + 4; } })),
  ];
  const standY = (x, z) => { for (let y = 40; y > 0; y--) if (E.w.isSolid(Math.floor(x), y, Math.floor(z))) return y + 1; return 11; };
  for (const d of doors) for (const [name, [body, want]] of Object.entries(bodies)) for (const f of fps) {
    const res = play(E, { body, start: [d.start[0], standY(d.start[0], d.start[2]), d.start[2]], yaw: 0, phase: 0, fps: f, secs: 12, brain: doorBrain(d.stand, d.door, d.inside), won: d.won });
    out[`${d.id}.${name}@${f}`] = res.won;
    if (want === 'always' && !res.won) problems.push(`${d.id}: ${name} at ${f} fps did not get in`);
    if (want === 'never' && res.won) problems.push(`${d.id}: ${name} at ${f} fps got in`);
  }
  const T = FI.tunnel, rows = { skilled: [B.burner, true, 'always'], naive: [B.burner, false, 'rarely'], freezer: [B.freezer, true, 'never'], climber: [B.climber, true, 'never'] };
  for (const [name, [body, skilled, want]] of Object.entries(rows)) for (const f of fps) {
    let wins = 0, times = [], whoosh = 0;
    for (let i = 0; i < tries; i++) {
      const res = play(E, { body, start: [T.x0 - 2.5, T.g + 1, T.z + 0.5], yaw: -Math.PI / 2, phase: 0, fps: f, secs: 40,
        brain: (E2, tr, t, st) => { if (st.t0 == null) { st.t0 = tr.fireice.t = i * 1.37 + f * 0.11; } return tunnelBrain(skilled)(E2, tr, t, st); },
        won: (E2, tr) => { if (tr.fireice.log.some(e => e.kind === 'whoosh')) { whoosh++; tr.fireice.log.length = 0; } return E2.player.pos.x > T.x1 + 1; } });
      if (res.won) { wins++; times.push(res.t); }
    }
    out[`tunnel.${name}@${f}`] = { wins, of: tries, times: times.join(' '), whoosh };
    if (want === 'always' && wins < tries) problems.push(`the Windy Bramble Tunnel: ${name} at ${f} fps got through only ${wins}/${tries}`);
    if (want === 'rarely' && wins > tries / 4) problems.push(`the Windy Bramble Tunnel: ${name} at ${f} fps got through ${wins}/${tries}`);
    if (want === 'never' && wins) problems.push(`the Windy Bramble Tunnel: ${name} at ${f} fps got through ${wins}/${tries}`);
  }
  return { problems, out };
}

// the rapids: a freezer looks at the water ahead, taps, walks on the ice, and so on up to the ledge; anyone else swims / flies / walks up
export { rapidsBrain as __rapidsBrain };
function rapidsBrain(r, freeze) {
  return (E, tr, t, st) => {
    const p = E.player;
    st.n = (st.n ?? 0) + 1;
    steer(p, r.x + 0.5, r.z0 + 0.5);
    if (freeze) { // freeze the water two ahead, walk only onto ice (never into the rushing water)
      const water = z => E.w.get(r.x, r.w, z) === E.B_WATER, a2 = Math.floor(p.pos.z) - 2, a1 = Math.floor(p.pos.z - 0.9);
      p.pitch = -0.3;
      if (water(a2) && st.n % 6 === 0) { lookAtCell(p, r.x, r.w, a2); pressFire(E, tr); }
      return { KeyW: !water(a1) && !water(a2) || (!water(a1) && a2 < r.z0 + 2) };
    }
    p.pitch = -0.6; // (a swimmer looking down dives)
    return { KeyW: true, ShiftLeft: true, Space: st.n % 2 === 0 };
  };
}
// the Frozen Falls: the Ice creature freezes the falls from the pool's edge; swap to a climber after `wait` s and climb
export { fallsBrain as __fallsBrain };
function fallsBrain(Fa, { wait = 0, climber, freezer, swap = true } = {}) {
  return (E, tr, t, st) => {
    const p = E.player, R = tr.fireice;
    st.n = (st.n ?? 0) + 1;
    if (!st.frozen) {
      const k = walkTo(p, Fa.fx + 0.5, Fa.z + Fa.d + 1.6, 0.3);
      if (k) return k;
      lookAtCell(p, Fa.fx, Fa.g + 2, Fa.z + Fa.d);
      if (st.n % 6 === 0) pressFire(E, tr);
      if (R.fallsT != null) { st.frozen = t; }
      return {};
    }
    if (swap && !st.swapped && t - st.frozen >= wait) { st.swapped = true; st.swap = climber; }
    steer(p, Fa.fx + 0.5, Fa.z + 0.5);
    return { KeyW: true };
  };
}
export async function runFreeze({ fps = [60, 20], tries = 4 } = {}) {
  const E = await fireSetup(), problems = [], out = {}, B = E.B, FI = E.w.fireice;
  const bodies = { freezer: [B.freezer, true, 'always'], swimmer: [B.swimmer, false, 'never'], bubble: [B.bubble, false, 'never'], flier: [B.flier, false, 'never'], burner: [B.burner, false, 'never'], climber: [B.climber, false, 'never'], onFoot: [null, false, 'never'] };
  for (const r of FI.rapids) for (const [name, [body, freeze, want]] of Object.entries(bodies)) for (const f of fps) {
    const res = play(E, { body, start: [r.x + 0.5, r.w + 1, r.z1 + 6.5], yaw: 0, phase: 0, fps: f, secs: 14, brain: rapidsBrain(r, freeze), won: E2 => E2.player.pos.z < r.z0 + 2 && E2.player.pos.y >= r.w + 0.9 && E2.player.pos.y < r.w + 2.5 }); // (inside the tunnel, on the ledge)
    out[`${r.id}.${name}@${f}`] = res.won ? res.t : false;
    if (want === 'always' && !res.won) problems.push(`${r.id}: ${name} at ${f} fps did not get up the rapids`);
    if (want === 'never' && res.won) problems.push(`${r.id}: ${name} at ${f} fps got up the rapids`);
  }
  const Fa = FI.falls, onTop = E2 => E2.player.onGround && E2.player.pos.y >= Fa.top + 0.9;
  const rows = {
    skilled: [B.freezer, { climber: B.climber }, 'always'], bug: [B.freezer, { climber: B.bug }, 'always'],
    slow: [B.freezer, { climber: B.climber, wait: 4 }, 'never'], freezerOnly: [B.freezer, { swap: false }, 'never'],
    climberOnly: [B.climber, { swap: false }, 'never'], flier: [B.flier, { swap: false }, 'never'], swimmer: [B.swimmer, { swap: false }, 'never'], bubble: [B.bubble, { swap: false }, 'never'],
  };
  for (const [name, [body, how, want]] of Object.entries(rows)) for (const f of fps) {
    let wins = 0, times = [];
    for (let i = 0; i < tries; i++) {
      const res = play(E, { body, start: [Fa.fx + 0.5, Fa.g + 1, Fa.z + Fa.d + 5.5], yaw: 0, phase: 0, fps: f, secs: 30, brain: (E2, tr, t, st) => { const k = fallsBrain(Fa, how)(E2, tr, t, st); if (name === 'flier' || name === 'bubble') k.Space = true; if (name === 'swimmer') { k.Space = st.n % 2 === 0; E2.player.pitch = 0.9; } return k; }, won: onTop });
      if (res.won) { wins++; times.push(res.t); }
    }
    out[`falls.${name}@${f}`] = { wins, of: tries, times: times.join(' ') };
    if (want === 'always' && wins < tries) problems.push(`the Frozen Falls: ${name} at ${f} fps got up only ${wins}/${tries}`);
    if (want === 'never' && wins) problems.push(`the Frozen Falls: ${name} at ${f} fps got up ${wins}/${tries}`);
  }
  return { problems, out };
}

/* ---- step D's fourth pair: Squeeze (cracked rocks, the Boulder Run) and Pass through (pencil houses, the Sliding Smudge) ---- */
export async function slipSetup() {
  const E = await fireSetup(), M = await import('../src/slipthrough.js'), b = id => E.C.bodyOf(id, E.S.SPECIES[id]);
  E.M = M;
  Object.assign(E.B, { squeezer: b('antsy'), slime: b('wobblock'), paperFly: b('origrane'), passer: b('flipsy'), ghost: b('wispurr') });
  return E;
}
// walk straight at a crack or a faded wall and on into the room behind
const intoBrain = (to) => (E) => { steer(E.player, to[0], to[1]); return { KeyW: true }; };
// the Boulder Run: wait in a crack until a boulder has rolled past and the next is far, then dash to the next crack (or the top)
export { runBrain as __runBrain };
function runBrain(skilled) {
  return (E, tr, t, st) => {
    const p = E.player, R = E.w.slip.run, z = p.pos.z, bs = E.M.bouldersAt(tr.slip.t);
    if (!skilled) { steer(p, R.x + 0.5, R.z0 - 2); return { KeyW: true }; }
    return runStep(p, R, bs, st);
  };
}
// one step of the skilled Boulder Run (also the spec's page-driven run): wait (at the foot or in a crack) until no boulder can meet you
// before the next crack, dash there, step into it, wait again; the last dash goes to the top
export function runStep(p, R, bs, st) {
  const z = p.pos.z, steerTo = (x, zz) => { p.yaw = Math.atan2(-(x - p.pos.x), -(zz - p.pos.z)); };
  st.mode ??= 'wait';
  if (st.mode === 'wait') {
    const next = [...R.nooks].sort((a, b) => b - a).find(n => n + 1 < z - 0.6), goal = next == null ? R.z0 - 2 : next + 1;
    const need = (z - goal) * 2 + 3; // (you and a boulder close in at twice your speed)
    if (bs.some(b => b < z + 1 && b > z - need)) return {};
    st.goal = goal; st.last = next == null; st.mode = p.pos.x < R.x + 0.1 ? 'exit' : 'out';
  }
  if (st.mode === 'exit') { if (p.pos.x < R.x + 0.45) { steerTo(R.x + 1.5, z); return { KeyW: true }; } st.mode = 'out'; }
  if (st.mode === 'out') { if (st.last || z > st.goal + 0.15) { steerTo(R.x + 0.5, st.goal - (st.last ? 0 : 0)); return { KeyW: true }; } st.mode = 'in'; }
  if (st.mode === 'in') { if (p.pos.x > R.x - 0.4) { steerTo(R.x - 1, z); return { KeyW: true }; } st.mode = 'wait'; }
  return {};
}
export async function runSqueeze({ fps = [60, 20], tries = 6 } = {}) {
  const E = await slipSetup(), problems = [], out = {}, B = E.B, S = E.w.slip;
  const bodies = { squeezer: [B.squeezer, 'always'], slime: [B.slime, 'always'], paper: [B.paperFly, 'always'], ghost: [B.ghost, 'never'], digger: [B.digger, 'never'], pusher: [B.pusher, 'never'], climber: [B.climber, 'never'], flier: [B.flier, 'never'], onFoot: [null, 'never'] };
  for (const c of S.cracked) for (const [name, [body, want]] of Object.entries(bodies)) for (const f of fps) {
    const res = play(E, { body, start: [c.x + 2.5, c.g + 1, c.z + 8.5], yaw: 0, phase: 0, fps: f, secs: 10, brain: intoBrain([c.x + 2.5, c.z + 2]), won: E2 => { const q = E2.player.pos; return q.z < c.z + 4.6 && q.z > c.z + 1 && q.x > c.x + 1 && q.x < c.x + 5 && q.y < c.g + 3; } });
    out[`${c.id}.${name}@${f}`] = res.won;
    if (want === 'always' && !res.won) problems.push(`${c.id}: ${name} at ${f} fps did not squeeze in`);
    if (want === 'never' && res.won) problems.push(`${c.id}: ${name} at ${f} fps got in`);
  }
  const R = S.run, rows = { skilled: [B.squeezer, true, 'always'], slime: [B.slime, true, 'always'], naive: [B.squeezer, false, 'never'], ghost: [B.ghost, true, 'never'], climber: [B.climber, true, 'never'], flier: [B.flier, true, 'never'] };
  for (const [name, [body, skilled, want]] of Object.entries(rows)) for (const f of fps) {
    let wins = 0, times = [], hits = 0;
    for (let i = 0; i < tries; i++) {
      const res = play(E, { body, start: [R.x + 0.5, R.g + 1, R.z1 + 2.5], yaw: 0, phase: 0, fps: f, secs: 40, brain: (E2, tr, t, st) => { if (st.t0 == null) st.t0 = tr.slip.t = i * 0.53 + f * 0.01; return runBrain(skilled)(E2, tr, t, st); }, won: (E2, tr) => { hits = Math.max(hits, tr.slip.hits); return E2.player.pos.z < R.z0 - 1; } });
      if (res.won) { wins++; times.push(res.t); }
    }
    out[`run.${name}@${f}`] = { wins, of: tries, times: times.join(' ') };
    if (want === 'always' && wins < tries) problems.push(`the Boulder Run: ${name} at ${f} fps got up only ${wins}/${tries}`);
    if (want === 'never' && wins) problems.push(`the Boulder Run: ${name} at ${f} fps got up ${wins}/${tries}`);
  }
  return { problems, out };
}
// the Sliding Smudge: skilled: in front of each wall, wait for the smudge to come by at the start of its slide, step in at it and drift
// along with it while crossing; naive: walk straight through when the smudge comes
export { smudgeBrain as __smudgeBrain };
function smudgeBrain(skilled) {
  return (E, tr, t, st) => {
    const p = E.player, M = E.w.slip.smudge, T = tr.slip.t, z = p.pos.z;
    const k = M.walls.findIndex(z0 => z < z0 + M.thick + 0.8);
    if (k < 0) { steer(p, (M.x0 + M.x1) / 2 + 0.5, M.room + 1.5); return { KeyW: true }; }
    const z0 = M.walls[k], c = E.M.smudgeAt(k, T) + M.w / 2, inWall = z > z0 - 0.35;
    if (!skilled) { steer(p, p.pos.x, z0 + M.thick + 2); return { KeyW: true }; }
    const c2 = E.M.smudgeAt(k, T + 0.15) + M.w / 2, v = (c2 - c) / 0.15;
    const sp = (p.ride?.speed ?? 4.3) * E.M.FADE.wade, track = () => { const vx = Math.max(-sp * 0.9, Math.min(sp * 0.9, v + (c - p.pos.x) * 2.5)), vz = Math.sqrt(Math.max(0.05, sp * sp - vx * vx)); steer(p, p.pos.x + vx, z + vz); };
    if (!inWall) { // wait in front of the wall near the end its patch starts its slide from, step in as its middle reaches you
      const span = M.x1 - M.x0 + 1 - M.w, edge = v > 0 ? E.M.smudgeAt(k, T) - M.x0 : M.x0 + span - E.M.smudgeAt(k, T);
      if (Math.abs(c - p.pos.x) < 0.4 && edge < 2) { track(); return { KeyW: true }; }
      const wait = v > 0 ? M.x0 + 2 : M.x1 - 1;
      if (Math.abs(p.pos.x - wait) > 0.3 || z < z0 - 1.6) { steer(p, wait, z0 - 1.2); return { KeyW: true }; }
      return {};
    }
    track(); return { KeyW: true }; // (inside: keep in the patch's middle as it slides, go on as fast as that leaves you)
  };
}
export async function runPass({ fps = [60, 20], tries = 6 } = {}) {
  const E = await slipSetup(), problems = [], out = {}, B = E.B, S = E.w.slip;
  const bodies = { passer: [B.passer, 'always'], ghost: [B.ghost, 'always'], squeezer: [B.squeezer, 'never'], digger: [B.digger, 'never'], pusher: [B.pusher, 'never'], burner: [B.burner, 'never'], climber: [B.climber, 'never'], flier: [B.flier, 'never'], onFoot: [null, 'never'] };
  for (const c of S.pencil) for (const [name, [body, want]] of Object.entries(bodies)) for (const f of fps) {
    const res = play(E, { body, start: [c.x + 7.5, c.g + 1, c.z + 2.5], yaw: Math.PI / 2, phase: 0, fps: f, secs: 10, brain: intoBrain([c.x + 1.5, c.z + 2.5]), won: E2 => { const q = E2.player.pos; return q.x > c.x + 1 && q.x < c.x + 3.6 && q.z > c.z + 1 && q.z < c.z + 4 && q.y < c.g + 2.5; } }); // (inside, not on its roof)
    out[`${c.id}.${name}@${f}`] = res.won;
    if (want === 'always' && !res.won) problems.push(`${c.id}: ${name} at ${f} fps did not pass through`);
    if (want === 'never' && res.won) problems.push(`${c.id}: ${name} at ${f} fps got in`);
  }
  const M = S.smudge, rows = { skilled: [B.passer, true, 'always'], ghost: [B.ghost, true, 'always'], naive: [B.passer, false, 'never'], squeezer: [B.squeezer, true, 'never'], flier: [B.flier, true, 'never'] };
  for (const [name, [body, skilled, want]] of Object.entries(rows)) for (const f of fps) {
    let wins = 0, times = [];
    for (let i = 0; i < tries; i++) {
      const res = play(E, { body, start: [(M.x0 + M.x1) / 2 + 0.5, M.g + 1, M.z0 - 1.5], yaw: 0, phase: 0, fps: f, secs: 60, brain: (E2, tr, t, st) => { if (st.t0 == null) st.t0 = tr.slip.t = i * 1.71 + f * 0.01; return smudgeBrain(skilled)(E2, tr, t, st); }, won: E2 => E2.player.pos.z > M.room + 0.5 });
      if (res.won) { wins++; times.push(res.t); }
    }
    out[`smudge.${name}@${f}`] = { wins, of: tries, times: times.join(' ') };
    if (want === 'always' && wins < tries) problems.push(`the Sliding Smudge: ${name} at ${f} fps got through only ${wins}/${tries}`);
    if (want === 'never' && wins) problems.push(`the Sliding Smudge: ${name} at ${f} fps got through ${wins}/${tries}`);
  }
  return { problems, out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const which = (process.env.WAYS_PLACES || 'tower,sluice,spots,currents,dig,push,burn,freeze,squeeze,pass').split(',');
  const runs = { tower: runTower, sluice: runSluice, spots: runSpots, currents: runCurrents, dig: runDig, push: runPush, burn: runBurn, freeze: runFreeze, squeeze: runSqueeze, pass: runPass }, problems = [];
  for (const w of which) { const a = await runs[w](); for (const [k, v] of Object.entries(a.out)) console.log(k.padEnd(24), JSON.stringify(v)); problems.push(...a.problems); }
  if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
  console.log('ok');
}
