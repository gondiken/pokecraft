// Chapter 3 A2: the scribble bugs' model players in Node (src/scribblebugs.js), at 60 and 20 fps:
//   naive   runs (sprints) straight at the nearest bug: it must seldom catch one (the bug is always a bit faster and slides along its
//           yard's edge away from a chaser behind it)
//   skilled corners it: goes round to the yard's open side (between the bug and the patch when the bug is at the outer edge, outside it
//           when it is at the inner edge) and then walks straight at it: it must pop every bug
//   node tests/wobblebugbots.mjs         (exit 1 on a failure); tests/specs/wobble.mjs part `bugs` runs it
import { pathToFileURL } from 'node:url';
import { BUG, BugField, bugsFor } from '../src/scribblebugs.js';

const WALK = 4.3, SPRINT = 6.2, FIGHT = 6.5;
const patch = { id: 1, x: 112, z: 178 };
export function playBugs(kind, { fps = 60, time = 60, seed = 0 } = {}) {
  const bugs = bugsFor({ ...patch, id: patch.id + seed }), F = new BugField(bugs), cx = bugs[0].cx, cz = bugs[0].cz;
  const start = (seed * 1.3) % (Math.PI * 2), you = { x: cx + Math.cos(start) * 25, z: cz + Math.sin(start) * 25, speed: 0 };
  const dt = 1 / fps, firsts = [];
  for (let t = 0; t < time; t += dt) {
    const left = bugs.filter(b => !b.popped);
    if (!left.length) break;
    const near = left.sort((p, q) => Math.hypot(p.x - you.x, p.z - you.z) - Math.hypot(q.x - you.x, q.z - you.z))[0];
    if (kind !== 'skilled' || !you.target || you.target.popped) you.target = near; // (the skilled one keeps after one bug)
    const b = you.target;
    let tx = b.x, tz = b.z, sp = SPRINT;
    if (kind === 'skilled') {
      // keep on the bug's line from the patch's middle, on the side away from the edge it is nearer, and close in along that line
      const rx = b.x - cx, rz = b.z - cz, r = Math.hypot(rx, rz), ux = rx / r, uz = rz / r;
      const outerSide = r > (BUG.inner + BUG.outer) / 2, gap = Math.hypot(b.x - you.x, b.z - you.z);
      const k = Math.max(0, Math.min(3, gap - 1.2)), pr = outerSide ? r - k : r + k;
      tx = cx + ux * pr + b.vx * 0.6; tz = cz + uz * pr + b.vz * 0.6; // (cut it off: a little ahead of where it slides)
      sp = Math.hypot(tx - you.x, tz - you.z) > 1.2 ? SPRINT : WALK;
    }
    let dx = tx - you.x, dz = tz - you.z, d = Math.hypot(dx, dz) || 1;
    let nx = you.x + dx / d * Math.min(d, sp * dt), nz = you.z + dz / d * Math.min(d, sp * dt);
    const rr = Math.hypot(nx - cx, nz - cz); // (never into the patch: the fight would start)
    if (rr < FIGHT + 0.6) { nx = cx + (nx - cx) / rr * (FIGHT + 0.6); nz = cz + (nz - cz) / rr * (FIGHT + 0.6); }
    you.speed = Math.hypot(nx - you.x, nz - you.z) / dt; you.x = nx; you.z = nz;
    for (const e of F.step(dt, you)) if (e.kind === 'pop') firsts.push(Math.round(t * 10) / 10);
  }
  return { popped: firsts.length, of: bugs.length, times: firsts };
}

export function runBugBots({ games = 6, log = console.log } = {}) {
  const lines = []; let fails = 0;
  for (const fps of [60, 20]) {
    let naive = 0, naiveOf = 0, skilled = 0, skilledOf = 0; const times = [];
    for (let s = 0; s < games; s++) {
      const n = playBugs('naive', { fps, seed: s }), k = playBugs('skilled', { fps, seed: s });
      naive += n.popped; naiveOf += n.of; skilled += k.popped; skilledOf += k.of; times.push(k.times.at(-1));
    }
    const ok = naive <= naiveOf / 4 && skilled === skilledOf;
    if (!ok) fails++;
    const line = `${ok ? 'ok  ' : 'FAIL'} ${fps} fps: naive (sprints at the nearest bug for 60 s) popped ${naive} / ${naiveOf}, skilled (corners them) ${skilled} / ${skilledOf}, all four in ${times.join(', ')} s`;
    lines.push(line); log(line);
  }
  return { lines, fails };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(runBugBots().fails ? 1 : 0);
