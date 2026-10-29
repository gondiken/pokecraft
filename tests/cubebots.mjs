// Cube Planets: model players for the three games (owner 2026-10-29: "a naive kid bot that must fail and a skilled one that must win").
// They play with the real Player (keys and yaw, as a child does) and the real CubeLive, frame by frame at `fps`, in Node (tests/cubenode.mjs)
// or in the page (the game's own player and live part). Each bot returns what happened; tests/specs/cube.mjs counts.
//   node tests/cubebots.mjs   prints a table (calibration)
import { PLANETS, P, PUPS, FLOWERS, LENSES, BOXES, MOON } from '../src/cubeland.js';
import { toLocal, upOf, GRAV, flightLand } from '../src/gravity.js';
import { loopAt, loopNearest, ferryAt, jumpOff } from '../src/orbits.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const P3 = v => [v.x, v.y, v.z];
export const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// Face of a box a surface point lies on: [axis, sign] (the axis it is furthest out on).
export function faceAt(box, p) {
  const c = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2], h = [(box.x1 - box.x0) / 2, (box.y1 - box.y0) / 2, (box.z1 - box.z0) / 2];
  let best = 0, bd = -Infinity;
  for (let a = 0; a < 3; a++) { const d = Math.abs(p[a] - c[a]) - h[a]; if (d > bd) { bd = d; best = a; } }
  return [best, Math.sign(p[best] - c[best]) || 1];
}
// Turn to face a world point (seen from the face you stand on: the part across the face). With `box`, a point on a next face is first
// unfolded onto yours (over the edge you share), as a child walks toward something round a corner.
export function face(pl, target, box = null) {
  let t = target;
  if (box && pl.grav) {
    const a = pl.grav.axis, s = pl.grav.sign, there = faceAt(box, target), lo = [box.x0, box.y0, box.z0], hi = [box.x1, box.y1, box.z1];
    if (there[0] !== a) { const plane = s > 0 ? hi[a] : lo[a], depth = Math.abs(target[a] - plane); t = target.slice(); t[a] = plane; t[there[0]] += there[1] * depth; }
  }
  const l = toLocal(pl.frame ?? 0, sub(t, P3(pl.pos))); if (Math.hypot(l[0], l[2]) > 1e-6) pl.yaw = Math.atan2(-l[0], -l[2]); pl.pitch = 0;
}
// Put the player down standing on a face point.
export function standAt(env, at) { const p = env.player; p.pos.set(at[0], at[1], at[2]); p.vel.set(0, 0, 0); p.keys = {}; p.joy = null; for (let i = 0; i < 30; i++) env.step(1 / 60); }
// A walking route on a box's surface to a point on face `to` from where the player stands: a face's middle in between when they are opposite.
function route(box, pl, target) {
  const here = pl.grav ? [pl.grav.axis, pl.grav.sign] : [1, 1], there = faceAt(box, target);
  if (here[0] !== there[0] || here[1] === there[1]) return [target];
  // opposite: through a face that is neither (the one nearer the target's spot)
  const c = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2], mids = [];
  for (let a = 0; a < 3; a++) if (a !== here[0]) for (const s of [1, -1]) { const m = c.slice(); m[a] = s > 0 ? [box.x1, box.y1, box.z1][a] : [box.x0, box.y0, box.z0][a]; mids.push(m); }
  mids.sort((m1, m2) => Math.hypot(...sub(m1, target)) + Math.hypot(...sub(m1, P3(pl.pos))) - Math.hypot(...sub(m2, target)) - Math.hypot(...sub(m2, P3(pl.pos))));
  return [mids[0], target];
}

/* ================================================================ the Orbikit Chase */
// The planet's pup: starts a round (the player on its planet, CubeLive starts the run). -> { tagged, t, spots }
// kinds: 'chaser' (sprints straight at it), 'camper' (stands on its loop in the middle of a face), 'skilled' (waits round a corner).
export function playChase(env, i, kind, { fps = 60, maxT = 60, seed = 1 } = {}) {
  const { live, player: pl } = env, q = PUPS[i], box = BOXES[q.planet], dt = 1 / fps;
  // start on a face the loop does not cross the middle of (the far side of a corner of the planet)
  const c = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2], start = c.slice();
  const pole = [0, 1, 2].find(a => q.loop.every(p => Math.abs(p[a] - q.loop[0][a]) < 1e-9)); // a belt's pole axis
  if (pole != null) { start[pole] = [box.x1, box.y1, box.z1][pole]; } else { start[1] = box.y1; }
  start[0] = Math.floor(start[0]) + 0.5; start[2] = Math.floor(start[2]) + 0.5; if (pole === 0 || pole === 2) start[1] = Math.floor(start[1]) + 0.5;
  standAt(env, start);
  live.pups[i].run = null; live.pups[i].tagT = -99;
  const tagsBefore = live.state().tags, keyBefore = live.state().tag[i];
  let t = 0, plan = null, waitT = 0;
  const run = () => live.pups[i].run;
  const r0 = rng(seed);
  for (let n = 0; n < maxT * fps; n++) {
    const r = run(), k = {};
    if (r && r.tagged === false) {
      const at = r.at, pup = at.pos;
      if (kind === 'chaser') { face(pl, pup, box); k.KeyW = true; k.ShiftLeft = true; }
      else if (kind === 'camper') {
        if (!plan) { const fc = faceAt(box, P3(pl.pos)), segs = r.L.segs.filter(g => g.face[0] === fc[0] && g.face[1] === fc[1]); const g = segs[0] ?? r.L.segs[0]; plan = { wp: [g.a.map((v, j) => (v + g.b[j]) / 2)] }; }
        const wp = plan.wp[0]; if (Math.hypot(...sub(wp, P3(pl.pos))) > 0.4) { face(pl, wp, box); k.KeyW = true; }
      } else if (kind === 'random') { // wanders and turns at random, now and then sprints
        if (!plan || t >= plan.until) plan = { yaw: r0() * Math.PI * 2, until: t + 0.5 + r0() * 1.5, sprint: r0() < 0.4 };
        pl.yaw = plan.yaw; k.KeyW = true; k.ShiftLeft = plan.sprint;
      } else { // skilled: pick the corner of its loop it reaches next that I can get to first; wait just round it on its lane
        const L = r.L, speed = r.base, mypos = P3(pl.pos);
        if (!plan || plan.dir !== r.dir || plan.missed) {
          let best = null;
          L.pts.forEach((pt, ci) => {
            const sC = L.segs[ci].at, arc = r.dir > 0 ? ((sC - r.s) % L.total + L.total) % L.total : ((r.s - sC) % L.total + L.total) % L.total;
            const out = r.dir > 0 ? L.segs[ci] : L.segs[(ci - 1 + L.segs.length) % L.segs.length], od = r.dir > 0 ? out.dir : out.dir.map(v => -v);
            const amb = pt.map((v, j) => v + od[j] * 0.75), dist = Math.hypot(...sub(amb, mypos)) * 1.35;
            const tPup = arc / speed, tMe = dist / GRAV.sprint + 0.6;
            if (tPup > tMe && (!best || tPup < best.tPup)) best = { amb, tPup, edge: pt, ci };
          });
          if (best) plan = { dir: r.dir, wp: route(box, pl, best.amb), edge: best.edge, ci: best.ci, sAt: L.segs[best.ci].at };
          else plan = null;
        }
        if (plan) {
          const wp = plan.wp[0], d = Math.hypot(...sub(wp, mypos));
          if (d > 0.35) { face(pl, wp, box); k.KeyW = true; k.ShiftLeft = d > 1.2; }
          else if (plan.wp.length > 1) plan.wp.shift();
          else face(pl, plan.edge, box); // wait, looking at the edge it comes over
          // it went past my corner (or turned): plan again
          const arcNow = r.dir > 0 ? ((plan.sAt - r.s) % L.total + L.total) % L.total : ((r.s - plan.sAt) % L.total + L.total) % L.total;
          if (arcNow > L.total - 1.5) plan.missed = true;
        }
      }
      if (live.pupNear(pl) >= 0) live.use(pl); // Tag! when it is in reach
    }
    pl.keys = k;
    env.step(dt); t += dt;
    if (live.state().tags > tagsBefore || (keyBefore && live.pups[i].tagT > -99 && !run())) return { tagged: true, t, spots: live.pMiss[i] };
  }
  return { tagged: false, t, spots: live.pMiss[i] };
}

// A skilled CHILD (owner 2026-10-29: "1 easy, 2 medium, 3 harder but fair"; the ramp is measured with this one, not with the perfect
// robot above): it knows the dotted way but sees the Orbikit only when nothing is in between (else it guesses from where it last saw it),
// thinks again only every `think` s, presses Tag! a `react` s late, and stands a little off the perfect spot (up to `err` blocks along
// and across), so on a planet that is easy to read it wins at once and on a harder one it needs a few goes. -> { tagged, t, spots }
export function playChaseKid(env, i, { fps = 60, maxT = 120, seed = 1, think = 0.5, react = 0.25, err = Number(process.env.KID_ERR ?? 0.5) } = {}) {
  const { live, player: pl } = env, q = PUPS[i], box = BOXES[q.planet], dt = 1 / fps, r0 = rng(seed * 131 + i);
  const c = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2], start = c.slice();
  const pole = [0, 1, 2].find(a => q.loop.every(p => Math.abs(p[a] - q.loop[0][a]) < 1e-9));
  if (pole != null) start[pole] = [box.x1, box.y1, box.z1][pole]; else start[1] = box.y1;
  start[0] = Math.floor(start[0]) + 0.5; start[2] = Math.floor(start[2]) + 0.5; if (pole === 0 || pole === 2) start[1] = Math.floor(start[1]) + 0.5;
  standAt(env, start);
  live.pups[i].run = null; live.pups[i].tagT = -99;
  const tagsBefore = live.state().tags, keyBefore = live.state().tag[i];
  let t = 0, plan = null, nextThink = 0, mem = null, pressAt = -1, spots = 0;
  for (let n = 0; n < maxT * fps; n++) {
    const r = live.pups[i].run, k = {};
    if (r && !r.tagged) {
      const L = r.L, mypos = P3(pl.pos), a = r.at, mid = a.pos.map((v, j) => v + a.up[j] * 0.6), head = mypos.map((v, j) => v + upOf(pl.frame ?? 0)[j] * 1.5);
      if (live.seen(head, mid)) mem = { s: r.s, dir: r.dir, t };
      if (live.pMiss[i] > spots) { spots = live.pMiss[i]; plan = null; nextThink = t + think; } // it saw me: think again (a moment later)
      if (t >= nextThink || !plan) {
        nextThink = t + think;
        const est = mem ? { s: mem.s + mem.dir * r.base * (t - mem.t), dir: mem.dir } : null;
        if (est && (!plan || plan.look || plan.dir !== est.dir || plan.passed)) {
          let best = null;
          L.pts.forEach((pt, ci) => {
            const sC = L.segs[ci].at, arc = est.dir > 0 ? ((sC - est.s) % L.total + L.total) % L.total : ((est.s - sC) % L.total + L.total) % L.total;
            const out = est.dir > 0 ? L.segs[ci] : L.segs[(ci - 1 + L.segs.length) % L.segs.length], od = est.dir > 0 ? out.dir : out.dir.map(v => -v);
            const side = [out.up[1] * od[2] - out.up[2] * od[1], out.up[2] * od[0] - out.up[0] * od[2], out.up[0] * od[1] - out.up[1] * od[0]];
            const along = 0.75 + (r0() * 2 - 1) * err * 0.6, across = (r0() * 2 - 1) * err * 0.6;
            const amb = pt.map((v, j) => v + od[j] * along + side[j] * across), dist = Math.hypot(...sub(amb, mypos)) * 1.35;
            const tPup = arc / r.base, tMe = dist / GRAV.sprint + 0.8;
            if (tPup > tMe && (!best || tPup < best.tPup)) best = { amb, tPup, edge: pt, sAt: sC };
          });
          plan = best ? { dir: est.dir, wp: route(box, pl, best.amb), edge: best.edge, sAt: best.sAt } : null;
        }
      }
      if (!mem) { // not seen it yet: walk round the planet on its dotted way to look for it
        if (!plan || !plan.look) { const sNear = loopNearest(L, mypos).s, aim = loopAt(L, sNear + 4).pos; plan = { look: true, wp: route(box, pl, aim) }; }
      }
      if (plan) {
        const wp = plan.wp[0], d = Math.hypot(...sub(wp, mypos));
        if (d > 0.35) { face(pl, wp, box); k.KeyW = true; k.ShiftLeft = d > 1.2; }
        else if (plan.wp.length > 1) plan.wp.shift();
        else if (plan.look) plan = null;
        else face(pl, plan.edge, box);
        if (mem && plan && !plan.look) { const arcNow = plan.dir > 0 ? ((plan.sAt - (mem.s + mem.dir * r.base * (t - mem.t))) % L.total + L.total) % L.total : (((mem.s + mem.dir * r.base * (t - mem.t)) - plan.sAt) % L.total + L.total) % L.total; if (arcNow > L.total - 1.5) plan.passed = true; }
      }
      if (live.pupNear(pl) >= 0) { if (pressAt < 0) pressAt = t + react; } else pressAt = -1;
      if (pressAt >= 0 && t >= pressAt) { live.use(pl); pressAt = -1; }
    }
    pl.keys = k;
    env.step(dt); t += dt;
    if (live.state().tags > tagsBefore || (keyBefore && live.pups[i].tagT > -99 && !live.pups[i].run)) return { tagged: true, t, spots: live.pMiss[i] };
  }
  return { tagged: false, t, spots: live.pMiss[i] };
}

/* ================================================================ the Planet Hop */
// One flight from flower k. kinds: 'skilled' (its solution), 'sprinter' / 'walker' (straight at the next pebble), 'random' (a random way and
// a random run). -> { landed (planet index), ok (on flower.to) }
export function playHop(env, k, kind, { fps = 60, seed = 1 } = {}) {
  const { live, player: pl } = env, f = FLOWERS[k], dt = 1 / fps;
  const o = [0, 1, 2].filter(a => a !== f.axis), surf = f.cell.map(v => v + 0.5); surf[f.axis] = f.sign > 0 ? f.cell[f.axis] + 1 : f.cell[f.axis];
  let mode, dir;
  if (kind === 'skilled') { mode = f.solution.mode; dir = f.solution.dir; }
  else if (kind === 'random') { const r = rng(seed * 7919 + k), a = r() * Math.PI * 2; mode = ['still', 'walk', 'sprint'][Math.floor(r() * 3)]; dir = [Math.sin(a), Math.cos(a)]; }
  else { const b = BOXES[f.to], c = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2], d = [c[o[0]] - surf[o[0]], c[o[1]] - surf[o[1]]], L = Math.hypot(...d) || 1; mode = kind === 'sprinter' ? 'sprint' : 'walk'; dir = [d[0] / L, d[1] / L]; }
  const back = mode === 'still' ? 0 : 2.4, start = surf.slice(); start[o[0]] -= dir[0] * back; start[o[1]] -= dir[1] * back;
  standAt(env, start);
  const tgt = surf.slice(); tgt[o[0]] += dir[0] * 9; tgt[o[1]] += dir[1] * 9;
  face(pl, tgt);
  const missBefore = live.hMiss[k];
  let launched = false;
  for (let n = 0; n < 10 * fps; n++) {
    const on = env.world.launchAt(pl.pos, pl.frame ?? 0) > 0 && pl.onGround; // (a child presses Jump once on the pad)
    const keys = launched || mode === 'still' ? {} : { KeyW: true, ShiftLeft: mode === 'sprint' };
    if (!launched && on) keys.Space = true;
    pl.keys = keys;
    env.step(dt);
    if (live.flight) launched = true;
    if (launched && !live.flight) return { landed: pl.grav.planet, ok: live.hMiss[k] === 0 && pl.grav.planet === f.to, missed: live.hMiss[k] > missBefore };
    if (!launched && n > 4 * fps) return { landed: -1, ok: false, nolaunch: true };
  }
  return { landed: -1, ok: false };
}

/* ================================================================ the Moon Ferry */
// Where a jump off the moon at `phase` lands (the physics a child learns by trying): the planet index or -1 (floats off).
export function ferryLand(live, phase) {
  const m = ferryAt(live.M, phase, live.moonK), L = flightLand(m.pos, jumpOff(m.vel, GRAV.jump), live.world.planets, { frame: 0, maxT: 8 });
  return L ? L.planet : -1;
}
// The moments of one lap whose jump lands on Lens Rock `n` (0..2): [{ from, to }] in phase (0..1), and their length in seconds.
export function ferryWindows(live, n) {
  const want = LENSES[n].planet, step = 1 / (120 * live.M.period), out = [];
  let cur = null;
  for (let ph = 0.5; ph < 1.5; ph += step) { // (from the far end round: a window never wraps)
    const hit = ferryLand(live, ph % 1) === want;
    if (hit && !cur) cur = { from: ph }; else if (!hit && cur) { cur.to = ph; out.push(cur); cur = null; }
  }
  if (cur) { cur.to = 1.5; out.push(cur); }
  return out.map(w => ({ ...w, secs: (w.to - w.from) * live.M.period / live.moonK }));
}
// Ride from the dock and jump once, aiming at Lens Rock `lens`. kinds: 'skilled' (the middle of its window), 'kid' (the window's middle
// with a human's timing: +- `jitter` s), 'naive' (when the moon is closest to the rock, as a child who waits until it is "right there"),
// 'random' (a random moment of the lap). -> { hit (landed on that rock), any (on any rock), landed, t }
export function playFerry(env, kind, { fps = 60, seed = 1, lens = 0, jitter = 0.4 } = {}) {
  const { live, player: pl } = env, dt = 1 / fps, r = rng(seed * 977 + lens), want = LENSES[lens].planet, rock = LENSES[lens].at;
  // wait on the dock where the moon's far end passes: it scoops you up
  const s = live.dockSpot();
  live.jump = null; live.moonBackT = 0;
  standAt(env, [s.x, s.y, s.z]);
  for (let n = 0; n < 40 * fps && !live.onMoon; n++) { pl.keys = {}; env.step(dt); }
  if (!live.onMoon) return { hit: false, any: false, landed: -2, noboard: true };
  const w = ferryWindows(live, lens).sort((a, b) => b.secs - a.secs)[0];
  let plan = null;
  if (kind === 'skilled' && w) plan = ((w.from + w.to) / 2) % 1;
  if (kind === 'kid' && w) plan = ((w.from + w.to) / 2 + (r() * 2 - 1) * jitter * live.moonK / live.M.period + 1) % 1;
  if (kind === 'random') plan = r();
  const lensesBefore = live.state().lenses, keysBefore = env.game.beaten.length;
  let jumped = false, lastD = Infinity, t = 0;
  for (let n = 0; n < 2.2 * live.M.period * fps; n++) {
    const k = {};
    if (!jumped && live.onMoon) {
      const m = live.moonNow();
      if (kind === 'naive') { const d = Math.hypot(m.pos[0] - rock[0], m.pos[2] - rock[2]); if (d > lastD && lastD < 20) k.Space = true; lastD = d; }
      else if (plan != null) { const dph = ((live.phase - plan) % 1 + 1) % 1; if (dph < 1.5 * dt * live.moonK / live.M.period) k.Space = true; }
    }
    pl.keys = k;
    env.step(dt); t += dt;
    if (k.Space) jumped = true;
    if (jumped && !live.jump && !live.onMoon && (pl.onGround || live.moonBackT <= 0)) {
      for (let i = 0; i < 4; i++) env.step(dt);
      const landed = pl.grav?.planet ?? -1;
      return { hit: landed === want, any: LENSES.some(L => L.planet === landed), landed, t, found: live.state().lenses > lensesBefore || env.game.beaten.length > keysBefore };
    }
  }
  return { hit: false, any: false, landed: -1, nojump: !jumped };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('cubebots.mjs')) {
  const { cubeEnv } = await import('./cubenode.mjs');
  const only = process.env.ONLY || 'chase,hop,moon';
  for (const fps of [60, 20]) {
    if (process.env.FLIP) PUPS[2].flip = Number(process.env.FLIP); // (tuning)
    if (only.includes('kid')) for (let i = 0; i < 3; i++) {
      const res = [];
      for (let s = 1; s <= Number(process.env.N ?? 8); s++) { const env = await cubeEnv(s); res.push(playChaseKid(env, i, { fps, seed: s })); }
      const ok = res.filter(r => r.tagged), mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
      console.log(`chase ${i} kid ${fps}fps: ${ok.length}/${res.length} tagged, mean ${mean(ok.map(r => r.t)).toFixed(1)} s, mean ${mean(res.map(r => r.spots)).toFixed(1)} times seen  (${res.map(r => (r.tagged ? r.t.toFixed(0) : 'no')).join(' ')})`);
    }
    if (only.includes('chase')) for (let i = 0; i < 3; i++) for (const kind of ['chaser', 'camper', 'random', 'skilled']) {
      const res = [];
      for (let s = 1; s <= Number(process.env.N ?? 3); s++) { const env = await cubeEnv(s); res.push(playChase(env, i, kind, { fps, seed: s })); }
      console.log(`chase ${i} ${kind.padEnd(8)} ${fps}fps: ${res.map(r => (r.tagged ? `TAG ${r.t.toFixed(1)}s` : 'no')).join(' ')}  spots ${res.map(r => r.spots).join(',')}`);
    }
    if (only.includes('hop')) for (let k = 0; k < FLOWERS.length; k++) for (const kind of ['skilled', 'sprinter', 'walker', 'random']) {
      const env = await cubeEnv(1), N = kind === 'random' ? 20 : 3; let ok = 0;
      for (let s = 1; s <= N; s++) if (playHop(env, k, kind, { fps, seed: s }).ok) ok++;
      console.log(`hop ${k} ${kind.padEnd(8)} ${fps}fps: ${ok}/${N}`);
    }
    if (only.includes('moon')) {
      { const env = await cubeEnv(1); console.log('ferry windows (s):', [0, 1, 2].map(n => ferryWindows(env.live, n).map(w => w.secs.toFixed(2)).join('+')).join(' | ')); }
      for (let n = 0; n < 3; n++) for (const kind of ['skilled', 'kid', 'naive', 'random']) {
        const N = kind === 'random' || kind === 'kid' ? 12 : 2; let ok = 0, any = 0;
        for (let s = 1; s <= N; s++) { const env = await cubeEnv(1); const res = playFerry(env, kind, { fps, seed: s, lens: n }); if (res.hit) ok++; if (res.any) any++; }
        console.log(`ferry lens ${n + 1} ${kind.padEnd(8)} ${fps}fps: ${ok}/${N} (any rock ${any})`);
      }
    }
  }
}
