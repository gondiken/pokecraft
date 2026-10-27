// T44: the Shuffle Stage's rules (the Room of Doors, plans/T44.md section 2). Pure: no imports, no Math.random, Node-runnable.
//
// A golden bow sits behind one of 3 / 4 / 5 doors on the stage. The doors close and swap places (two doors, one gliding round the front,
// the other round the back, so they never pass through each other), again and again, then stop. The child looks at the door with the bow
// and presses once. Everything is a closed form of the time `t` (seconds since the shuffle started), so 60 fps and 1 fps agree.
// A plan is made from the seed, the round and the attempt number only; the live part (doorslive.js) plays it.

export const SHUFFLE = {
  // round 1-3: how many doors, how many swaps, seconds one swap takes, the look of the doors, and whether two swaps may happen at once
  rounds: [
    { n: 3, swaps: 4, dur: 0.9, look: 'colours3', doubles: false },
    { n: 4, swaps: 6, dur: 0.7, look: 'colours2', doubles: false },
    { n: 5, swaps: 8, dur: 0.55, look: 'same', doubles: true },
  ],
  show: 1.6,      // the doors stand open and the bow bobs behind one
  close: 0.5,     // they close
  start: 0.3,     // a breath before the first swap
  gap: 0.12,      // between two swaps
  settle: 0.7,    // the doors wiggle when they stop
  spacing: 3,     // blocks between two door slots along the stage
  depth: 1.4,     // how far a swapping door swings out to the front / back
  doorW: 2.4, doorH: 3.2, doorD: 0.5,
  reach: 14, aimDeg: 8,
  // the rubber band: after `misses` misses in a row in a round every swap is `slow` times slower, a swap shorter; after 4 the prize door twinkles
  help: [{ misses: 2, slow: 1.35, fewer: 1, twinkle: false }, { misses: 4, slow: 1.7, fewer: 1, twinkle: true }],
  hard: { extra: 2, speed: 0.9, min: 0.45 }, // a rematch: two more swaps, 10% quicker (never under 0.45 s)
  colours: [0xe8384a, 0x3a8ce8, 0x3ac86a],  // red, blue, green
};

// The help level (0, 1, 2) after `misses` misses in a row.
export const helpLevel = misses => (misses >= SHUFFLE.help[1].misses ? 2 : misses >= SHUFFLE.help[0].misses ? 1 : 0);

// A string hash and a small seeded generator (the same on every device).
export function hashStr(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
export function seeded(key) {
  let a = hashStr(String(key)) | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const smooth = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const samePair = (p, q) => (p.a === q.a && p.b === q.b) || (p.a === q.b && p.b === q.a);

// The colour index of each door by round: 3 colours, 2 colours alternating, all the same.
export function lookOf(round, n) {
  const kind = SHUFFLE.rounds[round - 1].look;
  return Array.from({ length: n }, (_, d) => (kind === 'colours3' ? d % 3 : kind === 'colours2' ? d % 2 : 0));
}

// The plan of one shuffle: { n, round, attempt, prize, swaps: [{ a, b, t0, dur }], show, closeAt, closedAt, end, dur, look, twinkle, help, hard }.
// `a` and `b` are slots (places along the stage); the doors standing there trade places. `prize` is the door (0..n-1, numbered by the slot it
// starts in) with the bow. Rules: the prize door is in at least ceil(swaps / 2) swaps; no pair three times in a row; in rounds 2-3 the prize
// ends somewhere else; two swaps at once (round 3) never share a slot.
export function shufflePlan(seed, round, attempt, { help = 0, hard = false } = {}) {
  const R = SHUFFLE.rounds[Math.max(1, Math.min(3, round)) - 1];
  const n = R.n;
  let swapsN = R.swaps + (hard ? SHUFFLE.hard.extra : 0) - (help >= 1 ? SHUFFLE.help[0].fewer : 0);
  let dur = R.dur * (help >= 2 ? SHUFFLE.help[1].slow : help >= 1 ? SHUFFLE.help[0].slow : 1) * (hard ? SHUFFLE.hard.speed : 1);
  if (hard) dur = Math.max(dur, SHUFFLE.hard.min);
  const rnd = seeded(`${seed}|${round}|${attempt}`);
  const prize = Math.floor(rnd() * n);
  const need = Math.ceil(swapsN / 2);
  let groups = null; // each group = one swap or two at once
  for (let tries = 0; tries < 400 && !groups; tries++) { // rejection sampling on one deterministic stream
    const out = [], flat = [];
    let ps = prize, involved = 0, count = 0;
    while (count < swapsN) {
      const left = swapsN - count, mustHave = need - involved >= left;
      let double = R.doubles && left >= 2 && rnd() < 0.3;
      const wantPrize = mustHave || rnd() < 0.6;
      const others = Array.from({ length: n }, (_, i) => i).filter(i => i !== ps);
      let p1;
      if (wantPrize) p1 = { a: ps, b: others[Math.floor(rnd() * others.length)] };
      else { const a = others[Math.floor(rnd() * others.length)], rest = others.filter(i => i !== a); p1 = { a, b: rest[Math.floor(rnd() * rest.length)] }; }
      const group = [p1];
      if (double) { // the second swap is in a stretch of slots that does not touch the first one's (so the doors never cross in the air)
        const lo1 = Math.min(p1.a, p1.b), hi1 = Math.max(p1.a, p1.b), cands = [];
        for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) if (y < lo1 || x > hi1) cands.push([x, y]);
        if (cands.length) { const [x, y] = cands[Math.floor(rnd() * cands.length)]; group.push(rnd() < 0.5 ? { a: x, b: y } : { a: y, b: x }); } else double = false;
      }
      if (group.some(g => flat.length >= 2 && samePair(g, flat[flat.length - 1]) && samePair(g, flat[flat.length - 2]))) continue; // never the same pair three times
      for (const g of group) {
        flat.push(g);
        if (g.a === ps) { ps = g.b; involved++; } else if (g.b === ps) { ps = g.a; involved++; }
      }
      out.push(group); count += group.length;
    }
    if (involved >= need && (round === 1 || ps !== prize)) groups = out;
  }
  if (!groups) throw new Error(`shufflePlan: no plan for ${seed}|${round}|${attempt}`);
  // times: the groups one after the other, the two halves of a double at the same moment
  let t = SHUFFLE.show + SHUFFLE.close + SHUFFLE.start;
  const swaps = [];
  for (const group of groups) {
    for (const g of group) swaps.push({ a: g.a, b: g.b, t0: t, dur });
    t += dur + SHUFFLE.gap;
  }
  const lastEnd = t - SHUFFLE.gap;
  return { n, round, attempt, prize, swaps, show: SHUFFLE.show, closeAt: SHUFFLE.show, closedAt: SHUFFLE.show + SHUFFLE.close, end: lastEnd, stopped: lastEnd, over: lastEnd + SHUFFLE.settle,
    dur, look: lookOf(round, n), twinkle: help >= 2, help, hard };
}

// Where each door is at time t, stage-local: slot -> (x offset, z offset), added to `origin` ({ x, y, z } = the middle of the stage, y = the doors' feet).
// Returns [{ door, slot, x, y, z, open, wiggle, moving }] for doors 0..n-1. Doors face +z (towards the watch pad). The one gliding from the lower
// slot to the higher goes round the front (+z), the other round the back, on half ellipses (depth SHUFFLE.depth).
export function doorsAt(plan, t, origin = { x: 0, y: 0, z: 0 }) {
  const n = plan.n, at = Array.from({ length: n }, (_, i) => i); // at[slot] = door
  const xOf = slot => (slot - (n - 1) / 2) * SHUFFLE.spacing;
  const pos = Array.from({ length: n }, (_, d) => ({ door: d, slot: d, x: xOf(d), z: 0, moving: false }));
  for (const s of plan.swaps) {
    const lowSlot = Math.min(s.a, s.b), highSlot = Math.max(s.a, s.b), dl = at[lowSlot], dh = at[highSlot];
    if (t >= s.t0 + s.dur) { at[lowSlot] = dh; at[highSlot] = dl; continue; }
    if (t > s.t0) {
      const k = smooth((t - s.t0) / s.dur), lift = Math.sqrt(Math.sin(Math.PI * k)) * SHUFFLE.depth; // swings out quickly, so it clears its neighbours
      pos[dl].x = xOf(lowSlot) + (xOf(highSlot) - xOf(lowSlot)) * k; pos[dl].z = lift; pos[dl].moving = true;   // the lower one goes round the front
      pos[dh].x = xOf(highSlot) + (xOf(lowSlot) - xOf(highSlot)) * k; pos[dh].z = -lift; pos[dh].moving = true; // the other round the back
    }
  }
  for (let slot = 0; slot < n; slot++) if (!pos[at[slot]].moving) { pos[at[slot]].slot = slot; pos[at[slot]].x = xOf(slot); }
  const open = t < plan.closeAt ? 1 : t < plan.closedAt ? 1 - (t - plan.closeAt) / SHUFFLE.close : 0;
  const wiggle = t >= plan.stopped && t < plan.over ? Math.sin(((t - plan.stopped) / SHUFFLE.settle) * Math.PI) : 0;
  return pos.map(p => ({ door: p.door, slot: p.slot, x: origin.x + p.x, y: origin.y, z: origin.z + p.z, open, wiggle, moving: p.moving }));
}

// The slot the door stands in when the shuffle has stopped.
export function slotOf(plan, door) {
  return doorsAt(plan, plan.over + 1).find(d => d.door === door).slot;
}
// Which door the child is looking at: the one the look ray (eye, dir: unit vector) hits, the nearest, within `reach`; else the one closest to
// the look direction within `aimDeg` degrees (a child's aim is wobbly); else null. `doors` as from doorsAt.
export function pickDoor(doors, eye, dir, reach = SHUFFLE.reach) {
  let best = null, bestT = Infinity;
  for (const d of doors) { // the ray against the door's box (slab test)
    const lo = [d.x - SHUFFLE.doorW / 2, d.y, d.z - SHUFFLE.doorD / 2], hi = [d.x + SHUFFLE.doorW / 2, d.y + SHUFFLE.doorH, d.z + SHUFFLE.doorD / 2];
    const o = [eye.x, eye.y, eye.z], v = [dir.x, dir.y, dir.z];
    let t0 = 0, t1 = reach, ok = true;
    for (let i = 0; i < 3 && ok; i++) {
      if (Math.abs(v[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) ok = false; continue; }
      let a = (lo[i] - o[i]) / v[i], b = (hi[i] - o[i]) / v[i];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) ok = false;
    }
    if (ok && t0 < bestT) { bestT = t0; best = d.door; }
  }
  if (best !== null) return best;
  // no door under the ray: the door whose box comes within aimDeg degrees of it (the angle to the closest point of the box)
  const cos = Math.cos((SHUFFLE.aimDeg * Math.PI) / 180);
  let bc = cos;
  for (const d of doors) {
    const cx = d.x - eye.x, cy = d.y + SHUFFLE.doorH / 2 - eye.y, cz = d.z - eye.z, t = Math.max(0.1, cx * dir.x + cy * dir.y + cz * dir.z);
    const px = Math.min(d.x + SHUFFLE.doorW / 2, Math.max(d.x - SHUFFLE.doorW / 2, eye.x + dir.x * t));
    const py = Math.min(d.y + SHUFFLE.doorH, Math.max(d.y, eye.y + dir.y * t));
    const pz = Math.min(d.z + SHUFFLE.doorD / 2, Math.max(d.z - SHUFFLE.doorD / 2, eye.z + dir.z * t));
    const vx = px - eye.x, vy = py - eye.y, vz = pz - eye.z, len = Math.hypot(vx, vy, vz);
    if (!len || len > reach) continue;
    const c = (vx * dir.x + vy * dir.y + vz * dir.z) / len;
    if (c >= bc) { bc = c; best = d.door; }
  }
  return best;
}

// The doors standing still in a row, all shut (the stage when no shuffle is running): n doors, stage-local slots, `open` 0..1 for all of them.
export function restDoors(n, origin = { x: 0, y: 0, z: 0 }, open = 0) {
  return Array.from({ length: n }, (_, d) => ({ door: d, slot: d, x: origin.x + (d - (n - 1) / 2) * SHUFFLE.spacing, y: origin.y, z: origin.z, open, wiggle: 0, moving: false }));
}
