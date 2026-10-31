// Wave 18: the Moonlit Gallery, the Mirror Palace's north room (plans/wave18-mirror.md 4.3). PURE rules (imports only bounceback.js's mirrorHelp), Node-runnable,
// fixed 1/120 s sub-steps. A sunbeam falls on the big sun mirror on the dais; you turn the mirror (your look) and the beam goes where you look, bounces off
// every shiny pane (`isPane`) and stops at any other solid. Where it lands on the Gloomy wall it makes a soft spot of light. Gloomies (bits of the Scribble's
// smudge) crawl over the wall: one in the spot shivers and squeaks, and held in the light long enough it poofs into sparkles. From round 2 a lit Gloomy runs
// away from the light and zigzags (lead it!); in round 3 two of them keep to the shadows behind the pillars, where only a beam banked off a side pane reaches.
import { mirrorHelp } from './bounceback.js';

export const SPOT_RULES = {
  step: 1 / 120, scare: 0.7, spotR: 1.2, gloomyR: 0.6, roundTime: 45, stick: 1.4, bounces: 2, maxLen: 160,
  sun: [80.5, 15, 104.5],                                              // the sun mirror's middle (over the dais)
  wall: { x0: 62.7, x1: 97.3, y0: 13.7, y1: 26.3, z: 54 },             // where a Gloomy's middle can be (the wall face is z 54)
  shade: [{ x0: 65.7, x1: 68.0 }, { x0: 91.8, x1: 94.0 }], shadeY: 26.3,            // the strips the two pillars' shadows cover: no straight beam from the mirror lands in them
  panes: [58, 102],                                                    // the side panes' faces (x): what a banked beam bounces off
  rounds: [
    { name: 'Gloomy!', n: 3, wander: 0.8, flee: 0, hold: 1.0, shaded: 0 },
    { name: 'They run!', n: 4, wander: 1.2, flee: 3.4, hold: 1.4, shaded: 0 },
    { name: 'Hide and seek!', n: 4, wander: 1.2, flee: 3.6, hold: 1.4, shaded: 2 },
  ],
};
export const HARD = { beam: { flee: 1.12, hold: 0.2 } }; // a rematch (you hold the star)
export const SPOT_ROUNDS = SPOT_RULES.rounds.length;
export const BEAM = { yawMax: 1.2, pitchMin: -0.7, pitchMax: 0.9 };
const mulberry = a => () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// the direction of a look (yaw 0 = north = -z)
export const dirOf = (yaw, pitch) => [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
// A ray through the voxel grid (Amanatides and Woo): on a pane face it reflects (the component through that face flips), up to `bounces` times; any other
// solid stops it. -> { cell, axis, sign, point, bounces, path } (sign = the face's normal along `axis`) or null when nothing is hit within `max`.
export function beamRay(o, d, isPane, isSolid, bounces = SPOT_RULES.bounces, max = SPOT_RULES.maxLen) {
  const len = Math.hypot(d[0], d[1], d[2]) || 1, dir = [d[0] / len, d[1] / len, d[2] / len], pos = [o[0], o[1], o[2]], cell = pos.map(Math.floor), path = [[...pos]];
  let b = 0, travelled = 0;
  for (let i = 0; i < 900 && travelled <= max; i++) {
    let axis = 0, tBest = Infinity;
    for (let a = 0; a < 3; a++) {
      const t = dir[a] > 0 ? (cell[a] + 1 - pos[a]) / dir[a] : dir[a] < 0 ? (cell[a] - pos[a]) / dir[a] : Infinity;
      if (t < tBest) { tBest = t; axis = a; }
    }
    if (!isFinite(tBest)) return null;
    for (let a = 0; a < 3; a++) pos[a] += dir[a] * tBest;
    travelled += tBest;
    const step = dir[axis] > 0 ? 1 : -1; pos[axis] = dir[axis] > 0 ? cell[axis] + 1 : cell[axis];
    const next = [...cell]; next[axis] += step;
    if (isSolid(next[0], next[1], next[2])) {
      if (isPane(next[0], next[1], next[2]) && b < bounces) { dir[axis] = -dir[axis]; b++; path.push([...pos]); continue; }
      path.push([...pos]);
      return { cell: next, axis, sign: -step, point: [...pos], bounces: b, path };
    }
    cell[axis] = next[axis];
  }
  return null;
}
// What a look does on the Gloomy wall: { spot: { x, y } | null, hit, path }. `world` = { isSolid(x, y, z), isPane(x, y, z) } (the page's world or a stand-in), or null for
// the bare wall (a plain ray to the plane z 54: no pillars, no panes, used by the tests that only need the open wall).
export function beamOf(world, yaw, pitch) {
  const R = SPOT_RULES, d = dirOf(yaw, pitch), o = R.sun, W = R.wall;
  if (!world) {
    if (d[2] >= -1e-6) return { spot: null, hit: null, path: [o] };
    const t = (o[2] - W.z) / -d[2], x = o[0] + d[0] * t, y = o[1] + d[1] * t;
    return { spot: x >= 62 && x <= 98 && y >= 13 && y <= 27 ? { x, y } : null, hit: null, path: [o, [x, y, W.z]] };
  }
  const hit = beamRay(o, d, world.isPane, world.isSolid, R.bounces, R.maxLen);
  const onWall = hit && hit.axis === 2 && hit.sign > 0 && hit.cell[2] === W.z - 1 && hit.point[0] >= 62 && hit.point[0] <= 98 && hit.point[1] >= 13 && hit.point[1] <= 27;
  return { spot: onWall ? { x: hit.point[0], y: hit.point[1] } : null, hit, path: hit ? hit.path : [o] };
}
// the look that sends a straight beam to a point (x, y) of the wall / a beam banked off a pane at x = px to it
export function aimAt(g, x, y, px = null) {
  const o = SPOT_RULES.sun, tx = px == null ? x : 2 * px - x, dx = tx - o[0], dy = y - o[1], dz = SPOT_RULES.wall.z - o[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

export class SpotRound {
  // seed, round 0..2, attempt (a different crowd each time), opts { help, hard, world }
  constructor(seed, round, attempt = 0, { help = 0, hard = false, world = null } = {}) {
    const R = SPOT_RULES, p = R.rounds[round], H = hard ? HARD.beam : { flee: 1, hold: 0 };
    this.round = round; this.plan = p; this.world = world; this.k = mirrorHelp(help);
    this.flee = p.flee * H.flee * this.k.gloomy; this.wander = p.wander * this.k.gloomy; this.hold = (p.hold + H.hold) * this.k.hold; this.spotR = R.spotR * this.k.spot;
    const rnd = mulberry((seed * 2654435761 + round * 40503 + attempt * 9973 + 5) >>> 0), W = R.wall;
    this.gloomies = [];
    for (let i = 0; i < p.n; i++) {
      const shade = i >= p.n - p.shaded, strip = R.shade[i % 2], r = mulberry(((seed + 1) * 7919 + round * 131 + attempt * 31 + i * 977) >>> 0);
      const x = shade ? strip.x0 + (strip.x1 - strip.x0) * r() : W.x0 + (W.x1 - W.x0) * ((i + 0.25 + r() * 0.5) / p.n), y = W.y0 + ((shade ? R.shadeY : W.y1) - W.y0) * r();
      this.gloomies.push({ i, x, y, ang: r() * Math.PI * 2, shiver: 0, gone: false, shade, strip: shade ? strip : null, r, turnIn: 1 + r() * 1.5, zig: r() < 0.5 ? 1 : -1, go: r() < 0.5, phase: 0.4 + r() * 0.8, lit: false, vx: 0, vy: 0 });
    }
    this.time = 0; this.acc = 0; this.yaw = 0; this.pitch = -0.15; this.spot = null; this.done = false; this.won = false; this.beam = null; this.litTime = 0;
    this.refresh();
  }
  alive() { return this.gloomies.filter(g => !g.gone); }
  refresh() { this.beam = beamOf(this.world, this.yaw, this.pitch); this.spot = this.beam.spot; }
  // Advance by dt with the input { yaw, pitch } (the look the beam follows). Returns the events: poof { i } / shiver { i } / done { won }.
  update(dt, input = {}) {
    const ev = [], R = SPOT_RULES;
    if (this.done) return ev;
    if (input.yaw != null) { this.yaw = clamp(input.yaw, -BEAM.yawMax, BEAM.yawMax); this.pitch = clamp(input.pitch ?? this.pitch, BEAM.pitchMin, BEAM.pitchMax); }
    this.refresh();
    this.acc += dt;
    while (this.acc >= R.step - 1e-12 && !this.done) { this.acc -= R.step; this.step(R.step, ev); }
    return ev;
  }
  step(h, ev) {
    const R = SPOT_RULES, W = R.wall, sp = this.spot;
    this.time += h;
    for (const g of this.gloomies) {
      if (g.gone) continue;
      const lit = !!sp && Math.hypot(g.x - sp.x, g.y - sp.y) < this.spotR;
      if (lit && !g.lit) ev.push({ type: 'shiver', i: g.i });
      g.lit = lit; if (lit) g.scare = SPOT_RULES.scare; else g.scare = Math.max(0, (g.scare || 0) - h); g.shiver = lit ? g.shiver + h : Math.max(0, g.shiver - 2 * h);
      if (g.shiver >= this.hold) { g.gone = true; g.lit = false; ev.push({ type: 'poof', i: g.i, x: g.x, y: g.y }); continue; }
      // where it goes: a lit one runs from the light (zigzagging), an unlit one wanders (round 1 steadily, later stop and go)
      g.turnIn -= h;
      let sx = 0, sy = 0;
      if ((lit || g.scare > 0) && this.flee > 0) {
        if (g.turnIn <= 0) { g.turnIn = 0.6 + g.r() * 0.4; g.zig = -g.zig; }
        let ax = g.x - (sp ? sp.x : g.fx), ay = g.y - (sp ? sp.y : g.fy); if (lit) { g.fx = sp.x; g.fy = sp.y; } const d = Math.hypot(ax, ay);
        if (d < 1e-6) { ax = Math.cos(g.ang); ay = Math.sin(g.ang); } else { ax /= d; ay /= d; }
        const a = Math.atan2(ay, ax) + g.zig * 0.9;
        sx = Math.cos(a) * this.flee; sy = Math.sin(a) * this.flee;
        if (g.shade) { sx *= 0.3; sy = Math.abs(sy) < 1 ? Math.sign(sy || (g.r() - 0.5)) * Math.max(1, Math.abs(sy)) : sy; } // (a shaded one only runs up and down its strip)
      } else {
        if (g.turnIn <= 0) { g.turnIn = 1.2 + g.r() * 1.4; g.ang += (g.r() - 0.5) * 2.4; if (this.plan.flee > 0) { g.go = !g.go; g.phase = g.go ? 0.8 + g.r() * 0.6 : 0.5 + g.r() * 0.5; g.turnIn = g.phase; } }
        const moving = this.plan.flee <= 0 || g.go;
        if (moving) { const s = this.wander * (g.shade ? 0.6 : 1); sx = Math.cos(g.ang) * s; sy = Math.sin(g.ang) * s; }
      }
      { // a scared one runs along a wall it meets, never stuck in it
        const x0 = g.strip ? g.strip.x0 : W.x0, x1 = g.strip ? g.strip.x1 : W.x1, fast = Math.hypot(sx, sy);
        if (fast > 0 && ((g.x <= x0 + 0.05 && sx < 0) || (g.x >= x1 - 0.05 && sx > 0))) { sx = 0; sy = (sy >= 0 ? 1 : -1) * fast; }
        if (fast > 0 && ((g.y <= W.y0 + 0.05 && sy < 0) || (g.y >= W.y1 - 0.05 && sy > 0))) { sy = 0; sx = (sx >= 0 ? 1 : -1) * fast; }
      }
      g.vx = sx; g.vy = sy; g.x += sx * h; g.y += sy * h;
      const x0 = g.strip ? g.strip.x0 : W.x0, x1 = g.strip ? g.strip.x1 : W.x1;
      if (g.x < x0) { g.x = 2 * x0 - g.x; g.ang = Math.PI - g.ang; g.vx = -g.vx; } else if (g.x > x1) { g.x = 2 * x1 - g.x; g.ang = Math.PI - g.ang; g.vx = -g.vx; }
      if (g.y < W.y0) { g.y = 2 * W.y0 - g.y; g.ang = -g.ang; g.vy = -g.vy; } else if (g.y > W.y1) { g.y = 2 * W.y1 - g.y; g.ang = -g.ang; g.vy = -g.vy; }
      const y1 = g.strip ? R.shadeY : W.y1; if (g.y > y1) { g.y = 2 * y1 - g.y; g.ang = -g.ang; g.vy = -g.vy; }
      g.x = clamp(g.x, x0, x1); g.y = clamp(g.y, W.y0, y1);
    }
    if (!this.alive().length) { this.done = true; this.won = true; ev.push({ type: 'done', won: true }); }
    else if (this.time >= R.roundTime) { this.done = true; this.won = false; ev.push({ type: 'done', won: false }); }
  }
  // The look that puts the spot on (x, y): straight if the beam gets there, else banked off a side pane (the one nearer the point first); null when no look does.
  solve(x, y) {
    const ok = a => { const b = beamOf(this.world, a.yaw, a.pitch); return !!b.spot && Math.hypot(b.spot.x - x, b.spot.y - y) < 0.6; };
    const d = aimAt(this, x, y);
    if (ok(d)) return d;
    for (const px of SPOT_RULES.panes.slice().sort((a, b) => Math.abs(a - x) - Math.abs(b - x))) { const a = aimAt(this, x, y, px); if (ok(a)) return a; }
    return null;
  }
  // For the bots: the look that puts the spot on the Gloomy that is easiest to take next, a little ahead of where it runs (`react` s).
  target(react = 0.12) {
    const al = this.alive(), sp = this.spot || { x: 80, y: 20 };
    const rank = al.slice().sort((a, b) => (b.shiver - a.shiver) * 4 + (Math.hypot(a.x - sp.x, a.y - sp.y) - Math.hypot(b.x - sp.x, b.y - sp.y)) * 0.1);
    for (const g of rank) { const a = this.solve(g.x + g.vx * react, g.y + g.vy * react); if (a) return a; }
    return null;
  }
}
export { mirrorHelp };
