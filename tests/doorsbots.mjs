// T44 rework: players for the Room of Doors' two skill games, for the `surprise` spec (Node, and served to the page: /tests/doorsbots.mjs).
// A bot only decides where to walk, where to look and when to press; the rules are the game's own (src/pinata.js, src/jackcatch.js).
//   pinata: 'pro' (sees everything at once), 'kid' (sees 0.45 s late, guesses the moment +-0.2 s), 'masher' (stands under the balloons and
//           whacks all the time), 'still' (stands in the middle of the rug, looks north and whacks all the time)
//   jacks:  'pro', 'kid' (sees a jack 0.4 s after it flies and misjudges where it lands by up to 2.2 blocks at first), 'still' (on the pad)
import { PINATA, pinataPlan, newRun, pinataAt, topAt, inReach, towards, whack, timeUp, hashStr } from '../src/pinata.js';
import { CATCH, catchPlan, newCatch, stepCatch, flyAt, slowed } from '../src/jackcatch.js';

export const EYE = 1.62;   // the player's eyes over the feet
export const WALK = 4.3;   // a walk (blocks a second)

// -> { to: { x, z } | null (walk there), face: { x, z } | null (look along), press: bool }
export function pinataMind(kind) {
  return (run, t, pos) => {
    const eye = { x: pos.x, y: pos.y + EYE, z: pos.z }, p = pinataAt(run, t), dirTo = { x: p.x - pos.x, z: p.z - pos.z };
    if (kind === 'still') return { to: null, face: { x: 0, z: -1 }, press: true };
    const seg = run.segs[run.segs.length - 1], l = Math.hypot(seg.v[0], seg.v[1]) || 1, ax = seg.v[0] / l, az = seg.v[1] / l;
    if (kind === 'masher') { const top = topAt(run, t); return { to: { x: top.x, z: top.z + 1.6 }, face: dirTo, press: true }; }
    const late = kind === 'kid' ? 0.45 : 0.3, top = topAt(run, Math.max(0, t - late) + 0.3);
    const to = { x: top.x - ax * 1.8, z: top.z - az * 1.8 };   // behind the swing: it comes back at you
    if (kind === 'pro') return { to, face: dirTo, press: inReach(p, eye, dirTo) && towards(p, eye) >= PINATA.bigV + 0.3 && p.y <= PINATA.low + PINATA.bigLow };
    const j = ((hashStr(`j${run.hits}|${run.whiffs}|${run.plan.attempt}`) % 1000) / 1000 - 0.5) * 0.4, q = pinataAt(run, Math.max(0, t + j));
    return { to, face: dirTo, press: inReach(q, eye, dirTo) && towards(q, eye) > 0.5 };
  };
}
export function walkTo(pos, to, step) {
  if (!to) return;
  const dx = to.x - pos.x, dz = to.z - pos.z, d = Math.hypot(dx, dz), s = Math.min(d, step);
  if (d > 1e-6) { pos.x += (dx / d) * s; pos.z += (dz / d) * s; }
}
// A whole try in Node: -> { won, t, hits, big, whiffs, presses: [[t, eye, dir]] }
export function playPinata(kind, plan, dt, start = { x: PINATA.ring.x, y: 11, z: PINATA.ring.z + 7.5 }) {
  const run = newRun(plan), mind = pinataMind(kind), pos = { ...start }, presses = [];
  let t = 0;
  while (!run.done && !timeUp(run, t)) {
    t += dt;
    const m = mind(run, t, pos);
    walkTo(pos, m.to, WALK * dt);
    if (m.press) {
      const eye = { x: pos.x, y: pos.y + EYE, z: pos.z }, dir = { x: m.face.x, y: 0, z: m.face.z };
      const r = whack(run, t, eye, dir);
      if (r.swung) presses.push([t, eye, dir]);
    }
  }
  return { won: run.done, t, hits: run.hits, big: run.big, whiffs: run.whiffs, presses, log: run.log };
}

// (a spot inside the room's floor: the walls would stop a real player)
const inRoom = (run, q) => { const b = run.plan.box; return q && { x: Math.min(b.x1, Math.max(b.x0, q.x)), z: Math.min(b.z1, Math.max(b.z0, q.z)) }; };
export function catchMind(kind) {
  const think = catchThink(kind);
  return (run, t, pos) => inRoom(run, think(run, t, pos));
}
function catchThink(kind) {
  return (run, t, pos) => {
    if (kind === 'still') return null;
    const plan = run.plan, react = kind === 'kid' ? 0.4 : 0.25;
    const seen = plan.launches.filter(l => l.kind !== 'pie' && !run.done.has(l.n) && t - l.t0 >= react);
    seen.sort((a, b) => a.t0 + a.flight - (b.t0 + b.flight) - (a.kind === 'gold' ? 0.3 : 0) + (b.kind === 'gold' ? 0.3 : 0));
    const tgt = seen[0];
    if (tgt) {
      const q = flyAt(tgt, t), s = q ? q.s : 1, E = kind === 'kid' ? 2.2 : 1.0, h = (((tgt.n * 2654435761) >>> 0) / 4294967296) * Math.PI * 2;
      return { x: tgt.to[0] + Math.cos(h) * E * (1 - s), z: tgt.to[1] + Math.sin(h) * E * (1 - s) };
    }
    for (const l of plan.launches) if (l.kind === 'pie' && run.pieTo.has(l.n) && !run.done.has(l.n)) { const p = run.pieTo.get(l.n); if (Math.hypot(p[0] - pos.x, p[1] - pos.z) < 1.2) return { x: p[0] + 1.6, z: p[1] }; }
    return null;
  };
}
export const catchSpeed = (kind, run, t) => (kind === 'kid' ? 4.6 : 5.5) * (slowed(run, t) ? CATCH.pies.cap / 4.6 : 1);
export function playCatch(kind, plan, dt, start) {
  const run = newCatch(plan), mind = catchMind(kind), pos = { x: start[0], y: 11, z: start[1] }, vel = { x: 0, y: 0, z: 0 };
  let t = 0;
  while (!run.over) {
    t += dt;
    const to = mind(run, t, pos), x0 = pos.x, z0 = pos.z;
    walkTo(pos, to, catchSpeed(kind, run, t) * dt);
    vel.x = (pos.x - x0) / dt; vel.z = (pos.z - z0) / dt;
    stepCatch(run, t, pos, vel);
  }
  return { won: run.score >= plan.need, score: run.score, splats: run.splats, most: plan.most };
}
export { pinataPlan, catchPlan, PINATA, CATCH };
