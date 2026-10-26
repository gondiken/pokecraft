// T40d: the Ball type and Playland's Ball Stadium. Part 1 runs in Node (ballphysics.js on its own: bounce, roll, walls, 60 fps
// against 1 fps, a fuzz in the real stadium, kicks, shots, keepers, aim help; and the stadium build: layout, parts outside the
// zone, walking from the gate). Part 2 runs in the browser (data, the realm, kicking, goals, saves, outs, the Captain and the
// gate, baskets, save and load, iPad, the Book, two browsers). BALL_ONLY=node|browser runs one part.
// Screenshots: t40d-stadium.png, t40d-court.png, t40d-goal.png, t40d-ipad.png, t40d-book.png, t40d-creatures.png.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, continueGame, seedSave, playBattle, pause, click, waitFor as waitFor0 } from '../helpers.mjs';
const waitFor = (page, fn, arg, ms = 90000) => waitFor0(page, fn, arg, ms); // the software renderer is slow with several pages open

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const src = f => import(pathToFileURL(path.join(ROOT, 'src', f)).href);
const rng = seed => { let a = seed | 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const only = process.env.BALL_ONLY;
  if (only !== 'browser') await nodePart(t);
  if (only !== 'node') await browserPart({ browser, base, t });
}

/* ======================================================= Node ======================================================= */

async function nodePart(t) {
  const P = await src('ballphysics.js'), S = await src('stadium.js'), L = await src('playland.js'), Bk = await src('blocks.js');
  const { Ball, BALL, BALL_COURT, touchKick, canBoot, boot, shotTo, keeperAt, KEEPER, HOLD, kickZone, kickPower, shotWindow, shotMiss, diveAt, DIVE } = P;
  const { B, isSolid } = Bk;
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

  // a stand-in world (W / D / data / ground / index / inBounds / get / isSolid), as the dream and picture-worlds specs use
  const standIn = (W, D, H = 48) => {
    const w = { W, D, H, data: new Uint8Array(W * D * H), ground: new Int16Array(W * D), seed: 1 };
    w.index = (x, y, z) => x + W * (z + D * y);
    w.inBounds = (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < H;
    w.get = (x, y, z) => (w.inBounds(x, y, z) ? w.data[w.index(x, y, z)] : 0);
    w.isSolid = (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 ? true : isSolid(w.get(x, y, z)));
    return w;
  };
  const flat = (cells = []) => (x, y, z) => y < 10 || cells.some(([cx, cy, cz]) => cx === x && cy === y && cz === z);

  /* ---- 1-4. bounce, roll, walls, 60 fps vs 1 fps ---- */
  {
    const b = new Ball(flat(), [5, 15, 5]);
    const hits = []; let min = 99, rest = 0, lastSpeed = Infinity, falling = true;
    for (let i = 0; i < 60 * 5; i++) {
      b.update(1 / 60); min = Math.min(min, b.pos.y);
      for (const e of b.events) if (e.axis === 'y' && e.speed > BALL.rest) hits.push(e.speed);
      if (!rest && b.restFor > 0.1) rest = b.time;
    }
    t.ok(hits.length >= 3 && hits.every((s, i) => i === 0 || s < hits[i - 1]), `1: every bounce is lower than the last (${hits.map(s => s.toFixed(1)).join(' > ')})`);
    t.ok(rest > 0 && rest < 3 && near(b.pos.y, 10 + BALL.r + 0.001, 1e-9) && min >= 10 + BALL.r, `1: at rest within 3 s (${rest.toFixed(2)} s) at floor + r, never below it (min ${min.toFixed(4)})`);
    const c = new Ball(flat(), [2, 10.401, 5]);
    c.vel.x = 10; c.vel.y = 0;
    for (let i = 0; i < 60 * 8; i++) c.update(1 / 60);
    const d = c.pos.x - 2;
    t.ok(d > 18 && d < 22 && near(c.pos.z, 5, 1e-9) && c.vel.x === 0, `2: a 10 blocks/s kick rolls ${d.toFixed(1)} blocks (18-22), straight, then stops`);
    // 3. walls, a post, a corner, a crossbar
    const rand = rng(77);
    const shapes = { wall: [], post: [], corner: [], bar: [] };
    for (let y = 10; y < 16; y++) for (let z = 0; z < 60; z++) shapes.wall.push([30, y, z]);
    for (let y = 10; y < 13; y++) shapes.post.push([30, y, 20]);
    for (let y = 10; y < 16; y++) for (let k = 0; k < 40; k++) { shapes.corner.push([30, y, 20 + k]); shapes.corner.push([10 + k / 2, y, 20]); }
    for (let x = 29; x < 33; x++) for (let z = 15; z < 25; z++) shapes.bar.push([x, 13, z]);
    shapes.bar.push([29, 10, 15], [29, 11, 15], [29, 12, 15]);
    let bad = 0, nan = 0, back = 0, n = 0, leaked = 0, solidShots = 0;
    for (const [name, cells] of Object.entries(shapes)) {
      const solid = flat(cells);
      for (let k = 0; k < 50; k++) {
        const ball = new Ball(solid, [24 + rand() * 4, 10.4 + rand() * 2, (name === 'corner' ? 26 : 12) + rand() * 28]);
        const sp = 5 + rand() * 17, a = (rand() - 0.5) * 1.6;
        ball.vel.x = Math.cos(a) * sp; ball.vel.z = Math.sin(a) * sp; ball.vel.y = rand() * 6;
        let came = false;
        for (let i = 0; i < 3 * 120; i++) {
          ball.update(1 / 120);
          if (!Number.isFinite(ball.pos.x + ball.pos.y + ball.pos.z)) nan++;
          if (ball.overlaps(ball.pos.x, ball.pos.y, ball.pos.z)) bad++;
          if (ball.vel.x < 0 && ball.pos.x < 29.5) came = true;
        }
        n++;
        if (name === 'wall' || name === 'corner') { solidShots++; if (ball.pos.x > 30 || ball.pos.z < 20 && name === 'corner') leaked++; if (came) back++; }
      }
    }
    t.ok(bad === 0 && nan === 0, `3: ${n} seeded shots at a wall, a post, a corner and under a crossbar: the ball is never inside a block, no NaN (${bad} / ${nan})`);
    t.ok(leaked === 0 && back > solidShots * 0.9, `3: a wall and a corner keep the ball in (${leaked} leaked) and send it back (${back} of ${solidShots} bounced back)`);
    // 4. 60 fps against 1-2 fps
    const a1 = new Ball(flat(), [2, 10.401, 5]), a2 = new Ball(flat(), [2, 10.401, 5]);
    a1.vel.x = a2.vel.x = 10; a1.vel.y = a2.vel.y = 3; a1.vel.z = a2.vel.z = 2;
    for (let i = 0; i < 180; i++) a1.update(1 / 60);
    for (let i = 0; i < 60; i++) a2.update(0.05);
    t.ok(near(a1.pos.x, a2.pos.x) && near(a1.pos.y, a2.pos.y) && near(a1.pos.z, a2.pos.z) && near(a1.time, a2.time, 1e-9), `4: 3 s at 60 fps and at dt 0.05 end on the same spot (1e-6): ${a1.pos.x.toFixed(4)} / ${a2.pos.x.toFixed(4)}`);
  }

  /* ---- the stadium build ---- */
  const build = (hook) => {
    const w = standIn(224, 224);
    if (hook) hook();
    L.playLand(w, {});
    return w;
  };
  const hash = w => { let h = 0; for (let i = 0; i < w.data.length; i++) h = (h * 31 + w.data[i]) | 0; return h; };
  const world = build();
  const part = world.parts.find(p => p.id === 'stadium');
  const Z = L.ZONES.stadium.box;
  const solidAt = (x, y, z) => world.isSolid(x, y, z);
  {
    // 10. the part writes only inside its zone; the same twice
    const old = L.PLAYLAND_PARTS.stadium; L.PLAYLAND_PARTS.stadium = { build() {}, spawns: [] };
    const flatW = build();
    L.PLAYLAND_PARTS.stadium = old;
    let outside = 0, inside = 0;
    for (let i = 0; i < world.data.length; i++) if (world.data[i] !== flatW.data[i]) {
      const x = i % world.W, z = Math.floor(i / world.W) % world.D;
      if (x >= Z.x0 && x <= Z.x1 && z >= Z.z0 && z <= Z.z1) inside++; else outside++;
    }
    t.ok(outside === 0 && inside > 5000, `10: the stadium changes only cells inside its zone box (${inside} inside, ${outside} outside: hub, hedge gap and door untouched)`);
    t.ok(hash(build()) === hash(world), '10: the same blocks twice (no seed: the stadium is the same in every world)');
    // layout cells
    const at = (x, y, z) => world.get(x, y, z);
    const cellsAre = (list, id) => list.every(([x, y, z]) => at(x, y, z) === id);
    const mouths = [];
    for (const g of part.goals) for (let z = g.z[0]; z < g.z[1]; z++) for (let y = 11; y < g.top; y++) mouths.push([g.side < 0 ? 29 : 86, y, z]);
    t.ok(mouths.length === 2 * 8 * 3 && mouths.every(([x, y, z]) => !solidAt(x, y, z)), `10: both goal mouths are open, 8 wide and 3 high (${mouths.length} cells)`);
    const nets = []; // net back and roof of the west goal
    for (let z = 157; z <= 166; z++) for (let y = 11; y <= 14; y++) nets.push([27, y, z]);
    for (let x = 27; x <= 28; x++) for (let z = 158; z <= 165; z++) nets.push([x, 14, z]);
    t.ok(cellsAre(nets, B.GOAL_NET) && cellsAre([[29, 11, 157], [29, 13, 157], [29, 11, 166], [29, 14, 160]], B.GOAL_POST), '10: the net is closed (back and roof), the posts and the bar stand');
    const holes = [];
    for (const h of part.hoops) for (let dx = -1; dx <= 0; dx++) for (let dz = -1; dz <= 0; dz++) for (let y = 11; y <= 16; y++) holes.push([h.hole[0] + dx, y, h.hole[1] + dz]);
    t.ok(holes.every(([x, y, z]) => !solidAt(x, y, z)) && at(46, 15, 203) === B.HOOP_RIM && at(49, 15, 203) === B.HOOP_RIM && at(48, 15, 204) === B.HOOP_RIM && at(47, 15, 201) === B.HOOP_RIM && at(45, 16, 203) === B.BACKBOARD, `10: each hoop's 2 x 2 hole is open from the rim down to the floor, ringed by rim blocks`);
    let flatFloor = true;
    for (let x = Z.x0; x <= Z.x1; x++) for (let z = Z.z0; z <= Z.z1; z++) if (!solidAt(x, 10, z) || at(x, 11, z) === B.AIR && false) flatFloor = false;
    t.ok(flatFloor && at(58, 10, 162) !== B.AIR && !solidAt(58, 11, 162), '10: the pitch floor is flat at y 10 with air above the middle');
    const stand = (x, y, z) => solidAt(Math.floor(x), y - 1, Math.floor(z)) && !solidAt(Math.floor(x), y, Math.floor(z)) && !solidAt(Math.floor(x), y + 1, Math.floor(z));
    const boss = world.bosses.find(b => b.id === 'stadium');
    t.ok(boss && boss.crew.length === 2 && [boss.pos, boss.rest, boss.crew[0].pos, boss.crew[1].pos, ...part.rests].every(p => stand(p[0], p[1], p[2])), `10: the Captain's stand, both helpers and both rest spots have a floor and 2 air above`);
    t.ok(world.keeps.some(k => k.name === 'stadium' && k.protect[0].x0 === Z.x0 && k.protect[0].z1 === Z.z1) && world.parts.filter(o => o.live === 'stadium').length === 1, '10: one keep over the whole zone, one live part');
    // BFS on foot from the gate's arrival (step up <= 1, head room 2)
    const arrival = world.arrivals.stadium;
    const reach = (from, to) => {
      const W = world.W, key = (x, z) => x + W * z, seen = new Set([key(Math.floor(from[0]), Math.floor(from[2]))]);
      const q = [[Math.floor(from[0]), Math.floor(from[1]), Math.floor(from[2])]];
      const top = (x, z, y0) => { for (let y = y0 + 1; y >= Math.max(1, y0 - 3); y--) if (solidAt(x, y - 1, z) && !solidAt(x, y, z) && !solidAt(x, y + 1, z)) return y; return -1; };
      while (q.length) {
        const [x, y, z] = q.shift();
        if (Math.abs(x - to[0]) <= 1 && Math.abs(z - to[2]) <= 1) return true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= world.D || seen.has(key(nx, nz))) continue;
          const ny = top(nx, nz, y);
          if (ny < 0) continue;
          seen.add(key(nx, nz)); q.push([nx, ny, nz]);
        }
      }
      return false;
    };
    const goals = [[31.5, 11, 162], [84.5, 11, 162], [58, 11, 162], [58, 11, 203], boss.rest, boss.crew[0].pos, boss.crew[1].pos];
    const missed = goals.filter(g => !reach(arrival, g));
    t.ok(arrival && Math.abs(arrival[0] - 58.5) < 0.01 && Math.abs(arrival[2] - 126.5) < 0.01 && !missed.length, `10: on foot from the gate (hedge gap, north tunnel, south tunnel, court gap) you reach the Captain, both helpers, the centre spot, both goal fronts and the court (${missed.length} missed)`);
  }

  /* ---- 5. a fuzz in the real stadium ---- */
  {
    const rules = { out: 0.8, high: 12.5, goal: 1.5 };
    const rand = rng(4242);
    let bad = 0, nan = 0, stuck = 0, goals = 0, baskets = 0, resets = 0, runs = 0;
    const KP = part.keepers;
    const keepers = (time, hard) => KP.map((k, i) => { const b = keeperAt(k, time, hard).box; b.id = i; return b; });
    const sim = (ball, box, isFoot) => {
      let outAt = null, goalAt = null;
      for (let f = 0; f < 20 * 60; f++) {
        const prevY = ball.pos.y;
        ball.update(1 / 60, isFoot ? tm => keepers(tm, false) : undefined);
        const p = ball.pos;
        if (![p.x, p.y, p.z].every(Number.isFinite)) { nan++; return; }
        if (ball.overlaps(p.x, p.y, p.z)) bad++;
        if (isFoot) {
          if (goalAt == null && S.goalOf(part, p) >= 0) { goalAt = ball.time; goals++; }
          if (goalAt != null && ball.time - goalAt > rules.goal) { ball.reset(); goalAt = null; resets++; }
        } else if (S.basketCross(part, prevY, p)) baskets++;
        const out = p.x < box.x0 || p.x > box.x1 || p.z < box.z0 || p.z > box.z1 || (ball.onGround && ball.restFor >= 1 && p.y > rules.high);
        if (out && goalAt == null) { if (outAt == null) outAt = ball.time; else if (ball.time - outAt > rules.out) { ball.reset(); outAt = null; resets++; } } else outAt = null;
        if (ball.restFor > 3 && goalAt == null && (p.y > rules.high || p.x < box.x0 || p.x > box.x1 || p.z < box.z0 || p.z > box.z1)) { stuck++; return; }
      }
      runs++;
    };
    for (let k = 0; k < 500; k++) {
      const foot = k % 2 === 0;
      const box = foot ? part.pitchBox : part.courtBox;
      const spot = foot ? [box.x0 + 1 + rand() * (box.x1 - box.x0 - 2), 11.401, box.z0 + 1 + rand() * (box.z1 - box.z0 - 2)] : [box.x0 + 1 + rand() * (box.x1 - box.x0 - 2), 11.401, box.z0 + 1 + rand() * (box.z1 - box.z0 - 2)];
      const ball = new Ball((x, y, z) => world.isSolid(x, y, z), foot ? part.ballSpot : part.courtSpot, foot ? BALL : BALL_COURT);
      if (world.isSolid(Math.floor(spot[0]), 11, Math.floor(spot[2]))) continue;
      ball.pos.x = spot[0]; ball.pos.y = spot[1]; ball.pos.z = spot[2];
      if (ball.overlaps(spot[0], spot[1], spot[2])) continue;
      ball.time = rand() * 20;
      if (rand() < 0.5) boot(ball, { x: (rand() - 0.5) * 40, y: rand() * 9, z: (rand() - 0.5) * 40 });
      else { const a = rand() * 6.283; boot(ball, { x: Math.cos(a) * 13, y: 3, z: Math.sin(a) * 13 }); }
      sim(ball, box, foot);
    }
    t.ok(bad === 0 && nan === 0 && stuck === 0 && runs > 440, `5: 500 seeded kicks and shots in the real stadium, 20 s each: never inside a block, no NaN, never stuck (${runs} runs, ${goals} goals, ${baskets} baskets, ${resets} resets; bad ${bad}, nan ${nan}, stuck ${stuck})`);
  }

  /* ---- 6. touchKick: eight directions ---- */
  {
    const solid = flat();
    const results = [];
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      const pl = { x: 20, y: 10, z: 20, vx: 4.3, vz: 0, yaw: -Math.PI / 2, halfW: 0.3, height: 1.8 }; // walking east
      const frozen = JSON.stringify(pl);
      const ball = new Ball(solid, [20 + Math.cos(a) * 0.6, 10.401, 20 + Math.sin(a) * 0.6]);
      const before = Math.hypot(ball.pos.x - pl.x, ball.pos.z - pl.z);
      const r = touchKick(ball, pl);
      for (let i = 0; i < 30; i++) ball.update(1 / 60);
      const after = Math.hypot(ball.pos.x - pl.x, ball.pos.z - pl.z);
      results.push({ k, r, before, after, vx: ball.vel.x, frozen: JSON.stringify(pl) === frozen, front: Math.cos(a) > 0.3 });
    }
    t.ok(results.every(r => r.r === 'kick' && r.after > r.before + 1 && r.frozen), `6: walking into the ball from 8 directions: it always ends further from you, and the player object is never written (${results.map(r => r.after.toFixed(1)).join(' ')})`);
    t.ok(results.filter(r => r.front).every(r => r.vx > 3), '6: a ball in front goes where you look (east)');
    const still = new Ball(solid, [20.6, 10.401, 20]);
    const none = touchKick(still, { x: 20, y: 10, z: 20, vx: 0, vz: 0, yaw: 0 });
    const rolling = new Ball(solid, [20.6, 10.401, 20]); rolling.vel.x = -3;
    const nudge = touchKick(rolling, { x: 20, y: 10, z: 20, vx: 0, vz: 0, yaw: 0 });
    t.ok(none === null && nudge === 'nudge' && rolling.vel.x > 0 && rolling.vel.x < 3, '6: standing still: a resting ball is not kicked, a rolling one is only nudged back, slower');
  }

  /* ---- 7. shotTo: every court cell scores ---- */
  {
    const shot = S.SHOT;
    let cells = 0, fails = [], peakMax = 0;
    const court = part.courtBox;
    for (let x = court.x0; x < court.x1; x++) for (let z = court.z0; z < court.z1; z++) {
      if (solidAt(x, 11, z)) continue;
      for (const h of part.hoops) {
        const from = { x: x + 0.5, y: 11.401, z: z + 0.5 }, d = Math.hypot(h.hole[0] - from.x, h.hole[1] - from.z);
        if (d < shot.min || d > shot.max || !S.shootable(h, from)) continue;
        cells++;
        const ball = new Ball(solidAt, [from.x, from.y, from.z], BALL_COURT);
        const s = shotTo(from, { x: h.hole[0], y: h.rimMid, z: h.hole[1] }, BALL_COURT.g, 2, BALL_COURT.h, { d: shot.rim, y: h.rimMid + shot.clear });
        boot(ball, s.v);
        let scored = false, touched = false, peak = 0;
        for (let i = 0; i < 6 * 60 && !scored; i++) {
          const prevY = ball.pos.y;
          ball.update(1 / 60);
          peak = Math.max(peak, ball.pos.y);
          if (ball.events.length) touched = true;
          if (S.basketCross(part, prevY, ball.pos)) scored = true;
        }
        peakMax = Math.max(peakMax, peak);
        if (!scored || touched) fails.push(`${x},${z} d${d.toFixed(1)}${scored ? ' touched' : ' missed'}`);
      }
    }
    t.ok(cells > 500 && !fails.length, `7: a Shoot! from every court cell 3.6-15 from a hoop (not behind the backboard or under the rim) scores without touching a block (${cells} shots, ${fails.length} failed ${fails.slice(0, 5).join('; ')})`);
    t.ok(peakMax < 46, `7: the highest arc stays inside the world (peak y ${peakMax.toFixed(1)} of 48)`);
  }

  /* ---- 8. keepers ---- */
  {
    const k = part.keepers[0];
    const a = keeperAt(k, 1.7), b = keeperAt(k, 1.7, true);
    const A = KEEPER.A, w = 2 * Math.PI / KEEPER.P;
    t.ok(near(a.z, k.c + A * Math.sin(w * 1.7)) && near(a.vz, A * w * Math.cos(w * 1.7)) && near(a.x, 30.5), '8: keeperAt follows z = c + A sin(2 pi t / P + phase)');
    let inside = true, maxV = 0;
    for (let tt = 0; tt < 40; tt += 0.01) for (const kp of part.keepers) for (const hard of [false, true]) {
      const kk = keeperAt(kp, tt, hard).box, post = [158, 166];
      if (kk.z0 < post[0] + 0.4 - 1e-9 || kk.z1 > post[1] - 0.4 + 1e-9) inside = false;
      if (!hard) maxV = Math.max(maxV, Math.abs(keeperAt(kp, tt, hard).vz));
    }
    t.ok(inside && maxV < 4.3 && keeperAt(k, 0, true).vz > keeperAt(k, 0, false).vz, `8: a keeper box stays 0.4 inside each post (also hard); the top speed is ${maxV.toFixed(1)} blocks/s (a walk is 4.3); hard is faster`);
    // a drive from 16 blocks out at the east goal: when the ball arrives, keeper 1 is at his top (nearly standing still)
    const k1 = part.keepers[1], w1 = 2 * Math.PI / KEEPER.P, boxesAt = tm => part.keepers.map((kp, ix) => { const bx = keeperAt(kp, tm).box; bx.id = ix; return bx; });
    const dry = new Ball(solidAt, [70, 11.401, 162]);
    boot(dry, { x: 13, y: 3, z: 0 });
    while (dry.pos.x < 84.7) dry.update(1 / 60);
    const arrive = dry.time, tTop = (Math.PI / 2 - k1.phase) / w1 + KEEPER.P; // he is at the top at tTop
    const high = keeperAt(k1, tTop).z;
    const drive = tz => {
      const ball = new Ball(solidAt, [70, 11.401, tz]);
      ball.time = tTop - arrive;
      boot(ball, { x: 13, y: 3, z: 0 });
      let saved = false, goal = false;
      for (let i = 0; i < 3 * 60; i++) {
        ball.update(1 / 60, boxesAt);
        if (ball.events.some(e => e.kind === 'keeper')) saved = true;
        if (S.goalOf(part, ball.pos) >= 0) { goal = true; break; }
      }
      return { saved, goal };
    };
    const straight = drive(high), open = drive(162 - (high - 162));
    t.ok(straight.saved && !straight.goal, `8: a drive straight at the keeper is saved (z ${high.toFixed(1)}): ${JSON.stringify(straight)}`);
    t.ok(open.goal && !open.saved, `8: a drive at the open side scores: ${JSON.stringify(open)}`);
  }

  /* ---- 9. hold and let go (owner 2026-10-26: a real skill; no aim help) ---- */
  {
    const mouths = part.goals.map(g => ({ x: g.line }));
    const pos = { x: 74, y: 11.401, z: 162 }, f = [1, 0];
    const zs = [0, 1, 2].map(n => kickZone(n)), hz = [0, 1, 2].map(n => kickZone(n, true));
    const width = z => z[1] - z[0];
    t.ok(zs.every((z, i) => i === 0 || width(z) < width(zs[i - 1])) && hz.every((z, i) => width(z) < width(zs[i])), `9: the green part of the power ring shrinks with every goal and is smaller in a rematch (${zs.map(width).map(v => v.toFixed(2))} / ${hz.map(width).map(v => v.toFixed(2))})`);
    const soft = kickPower(0.1, pos, f, zs[0], mouths), drive = kickPower(0.6, pos, f, zs[0], mouths), over = kickPower(1.1, pos, f, zs[0], mouths);
    t.ok(soft.kind === 'soft' && soft.x < 8.1 && drive.kind === 'drive' && drive.x === HOLD.foot.drive.speed && over.kind === 'over' && over.y > drive.y && near(soft.z, 0) && near(drive.z, 0), `9: let go early = a soft roll (${soft.x.toFixed(1)}), in the green = a hard drive (${drive.x}), late = up and over (${over.y.toFixed(1)} up); every kick goes where you face`);
    // over-hit from 6..14 blocks: the ball crosses the goal line above the bar (further out the live part's `wild` rule says over)
    let above = 0, tries = 0;
    for (let x = 72; x <= 80; x++) for (const z of [159, 162, 165]) {
      const from = { x, y: 11.401, z }, ball = new Ball(solidAt, [x, 11.401, z]);
      boot(ball, kickPower(1.2, from, f, zs[0], mouths)); tries++;
      for (let i = 0; i < 240; i++) { const px = ball.pos.x; ball.update(1 / 60); if (px < 86 && ball.pos.x >= 86) { if (ball.pos.y >= 14) above++; break; } }
    }
    t.ok(above === tries, `9: an over-hit kick from 6-14 blocks crosses the line above the bar (${above} / ${tries})`);
    // the keeper's dive: inside the posts, smooth, back on his walk afterwards; beaten at the far post, saving the middle from far out
    const k = part.keepers[1];
    let inside = true, jump = 0, prev = null;
    const dv = { t0: 1, z0: keeperAt(k, 1).z, z1: k.c - 2.9, speed: DIVE.speed[2], until: 1 + DIVE.hold };
    for (let tt = 0; tt < 6; tt += 0.01) {
      const a = diveAt(k, tt, false, dv);
      if (a.box.z0 < 158.4 - 1e-9 || a.box.z1 > 165.6 + 1e-9) inside = false;
      if (prev != null) jump = Math.max(jump, Math.abs(a.z - prev)); prev = a.z;
    }
    const back = Math.abs(diveAt(k, dv.until + DIVE.back + 0.01, false, dv).z - keeperAt(k, dv.until + DIVE.back + 0.01).z) < 1e-9;
    t.ok(inside && jump < 0.075 && back, `9: a dive stays inside the posts, never jumps (${jump.toFixed(3)} per 0.01 s) and eases back to the keeper's walk`);
    const trial = (x, zt, t0, speed) => {
      const from = { x, y: 11.401, z: 162 }, l = Math.hypot(86 - x, zt - 162), ff = [(86 - x) / l, (zt - 162) / l];
      const ball = new Ball(solidAt, [x, 11.401, 162]); ball.time = t0; boot(ball, kickPower(0.6, from, ff, zs[0], mouths));
      const zc = 162 + ball.vel.z * (k.x - x) / ball.vel.x, ts = t0 + DIVE.react;
      const dive = { t0: ts, z0: keeperAt(k, ts).z, z1: Math.max(k.c - 2.9, Math.min(k.c + 2.9, zc)), speed, until: ts + DIVE.hold };
      const boxes = tm => part.keepers.map((kp, i) => { const bx = (i === 1 ? diveAt(kp, tm, false, dive) : keeperAt(kp, tm)).box; bx.id = i; return bx; });
      for (let i = 0; i < 240; i++) { ball.update(1 / 60, boxes); if (ball.events.some(e => e.kind === 'keeper')) return 'saved'; if (S.goalOf(part, ball.pos) >= 0) return 'goal'; }
      return 'miss';
    };
    const tally = (dist, speed, aim) => { let gl = 0; for (let i = 0; i < 40; i++) { const t0 = i * 0.11, kz = keeperAt(k, t0 + 0.3).z; if (trial(86 - dist, aim === 'far' ? (kz > 162 ? 158.9 : 165.1) : 162, t0, speed) === 'goal') gl++; } return gl; };
    const farNear = DIVE.speed.map(sp => tally(9, sp, 'far')), midFar = DIVE.speed.map(sp => tally(16, sp, 'mid'));
    t.ok(farNear.every(n => n >= 30) && midFar.every(n => n === 0), `9: from 9 blocks a drive at the far post beats the diving keeper (${farNear.join(' / ')} of 40 for goals 1-3); from 16 a drive at the middle is always saved (${midFar.join(' / ')})`);
    // Shoot!: the good moment round the top of the jump
    const wins = [0, 1, 2].map(n => shotWindow(n, 8)), wNear = shotWindow(0, 4), wFar = shotWindow(0, 15), wHard = shotWindow(0, 8, true);
    t.ok(wins.every((w, i) => i === 0 || w < wins[i - 1]) && wNear > wins[0] && wFar < wins[0] && wHard < wins[0] && shotMiss(wins[0] * 0.9, wins[0]) === 0 && shotMiss(-wins[0] * 1.2, wins[0]) < 0 && shotMiss(wins[0] * 1.2, wins[0]) > 0,
      `9: the good moment is shorter with every basket, further away and in a rematch (${wins.map(w => w.toFixed(3)).join(' > ')} s at 8 blocks); inside it a shot is clean, early is short, late is long`);
    const court = part.courtBox;
    const missRate = m => {
      let cells = 0, scored = 0;
      for (let x = Math.ceil(court.x0); x < court.x1; x++) for (let z = Math.ceil(court.z0); z < court.z1; z++) {
        if (solidAt(x, 11, z)) continue;
        for (const h of part.hoops) {
          const from = { x: x + 0.5, y: 13.05, z: z + 0.5 }, d = Math.hypot(h.hole[0] - from.x, h.hole[1] - from.z);
          if (d < S.SHOT.min || d > S.SHOT.max || !S.shootable(h, from)) continue;
          cells++;
          const ux = (h.hole[0] - from.x) / d, uz = (h.hole[1] - from.z) / d, side = Math.abs(m) * HOLD.hoop.side;
          const ball = new Ball(solidAt, [from.x, from.y, from.z], BALL_COURT);
          boot(ball, shotTo(from, { x: h.hole[0] + ux * m - uz * side, y: h.rimMid, z: h.hole[1] + uz * m + ux * side }, BALL_COURT.g, 2, BALL_COURT.h, { d: S.SHOT.rim, y: h.rimMid + S.SHOT.clear }).v);
          for (let i = 0; i < 360; i++) { const py = ball.pos.y; ball.update(1 / 60); if (S.basketCross(part, py, ball.pos)) { scored++; break; } }
        }
      }
      return scored / cells;
    };
    const early = missRate(-HOLD.hoop.miss[0]), late = missRate(HOLD.hoop.miss[0]);
    t.ok(early < 0.1 && late < 0.1, `9: a shot let go too early or too late from every court cell nearly always misses (${(early * 100).toFixed(0)}% / ${(late * 100).toFixed(0)}% still go in: lucky bounces)`);
    const b0 = new Ball(solidAt, [10, 11.401, 10]);
    t.ok(canBoot(b0, { x: 8.5, y: 11, z: 10, yaw: -Math.PI / 2 }) && !canBoot(b0, { x: 8.5, y: 11, z: 10, yaw: Math.PI / 2 }) && canBoot(b0, { x: 9.3, y: 11, z: 10, yaw: Math.PI / 2 }) && !canBoot(b0, { x: 5, y: 11, z: 10, yaw: -Math.PI / 2 }), '9: Kick! shows when the ball is in front of you (within 2.3), or right at your feet; not when it is behind you or far');
  }
}

/* ===================================================== browser ===================================================== */

const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 90000);
const toasts = page => page.evaluate(() => { window.__toasts = []; const g = window.pokecraft, f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; });
const said = (page, re) => page.evaluate(src => window.__toasts.some(m => new RegExp(src).test(m)), re.source);
const GOAL = n => `pw:stadium:goal${n}`;

// A Champion steps through the stadium frame of the Swirl into Playland (arrives at the stadium's way back).
async function intoStadium(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  const cell = await page.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'stadium'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(page, 'playland');
}
// The live part runs without pointer lock (free) in the desktop tests; the iPad test keeps the real rule.
const prep = (page, free = true) => page.evaluate(free => {
  const g = window.pokecraft, L = g.gymLive.of('part:stadium');
  if (free) L.playing = () => true;
  window.__live = L;
  return !!L;
}, free);
// The player is the camera: look at a spot from another
const look = (page, eye, at) => page.evaluate(([e, a]) => { const p = window.pokecraft.player; p.pos.set(e[0], e[1], e[2]); p.vel.set(0, 0, 0); p.lookAt({ x: a[0], y: a[1], z: a[2] }); }, [eye, at]);

async function browserPart({ browser, base, t }) {
  const page = await openGame(browser, base);

  /* ---- 11. Data ---- */
  const d11 = await page.evaluate(async () => {
    const S = await import('/src/species.js'), F = await import('/src/fxrecipes.js'), R = await import('/src/realms.js'), Bk = await import('/src/blocks.js');
    const ids = Object.keys(S.SPECIES).filter(id => S.SPECIES[id].type === 'ball');
    const shapes = new Set(ids.map(id => S.SPECIES[id].model.shape));
    const gear = ids.map(id => { const m = S.buildModel(id); let shine = 0; m.traverse(o => { if (o.userData.gear === 'shine') shine++; }); return shine; });
    const evolvesInto = new Set(ids.map(id => S.SPECIES[id].evolve?.into).filter(Boolean));
    const seventh = ids.filter(id => !S.SPECIES[id].evolve && !evolvesInto.has(id));
    const spawnIds = Object.values(S.SPAWNS).flat().map(e => e[0]);
    const sound = await (await fetch('/src/sound.js')).text();
    const names = ['PITCH_LIGHT', 'PITCH_DARK', 'PITCH_LINE', 'GOAL_POST', 'GOAL_NET', 'COURT_FLOOR', 'COURT_LINE', 'HOOP_RIM', 'BACKBOARD', 'STAND_SEAT'];
    return {
      ids, shapes: [...shapes], gear, seventh,
      moves: ['bouncebop', 'cannonroll', 'quickpass', 'dribble', 'goldengoal', 'acesmash', 'teamhuddle', 'trickshot', 'bigmatch'].map(m => S.MOVES[m] && S.MOVES[m].type),
      big: ['teamhuddle', 'trickshot', 'bigmatch'].map(m => !!S.MOVES[m]?.big),
      sig: [S.MOVES.goldengoal.sig, S.MOVES.acesmash.sig], learn: [S.SPECIES.goalhound.learn.some(([l, m]) => l === 30 && m === 'goldengoal'), S.SPECIES.smashbird.learn.some(([l, m]) => l === 30 && m === 'acesmash')],
      fx: [F.TRAVEL.ball !== F.TRAVEL.normal, F.IMPACT.ball !== F.IMPACT.normal, F.FX_COLORS.ball !== F.FX_COLORS.normal, typeof F.SIG.goldengoal, typeof F.SIG.acesmash],
      sound: /'fx:ball': \(\) =>/.test(sound) && /ballkick:/.test(sound) && /goalcheer:/.test(sound) && /netswish:/.test(sound) && /whistle:/.test(sound),
      inMain: ids.filter(id => spawnIds.includes(id)), inRealm: ids.filter(id => R.REALMS.playland.spawns.stadium.some(e => e[0] === id)),
      blocks: names.map(k => Bk.B[k]).concat(Bk.B.STAND_SEAT),
      defs: names.every(k => { const b = Bk.BLOCKS[Bk.B[k]]; return b.fixed && b.wallText && !Bk.PLACEABLE.includes(Bk.B[k]); }),
      tiles: Bk.TILE_COUNT, chip: !!S.TYPE_COLORS.ball, ready: (await import('/src/pictureworlds.js')).pictureWorld('stadium').ready,
    };
  });
  t.ok(d11.ids.length === 7 && d11.shapes.length === 4 && d11.gear.every(n => n >= 1), `11: 7 Ball creatures with 4 shapes, every model has a shine spot (${d11.ids.join(',')}; ${d11.gear.join('')})`);
  t.ok(d11.seventh.join() === 'strikehorn', `11: the 7th, Strikehorn, is single-stage (${d11.seventh})`);
  t.ok(d11.moves.every(m => m === 'ball') && d11.big.every(Boolean) && d11.sig.every(Boolean) && d11.learn.every(Boolean), '11: four Ball moves, two signature moves learned at 30, three big moves');
  t.ok(d11.fx[0] && d11.fx[1] && d11.fx[2] && d11.fx[3] === 'function' && d11.fx[4] === 'function' && d11.sound, '11: real Ball fx recipes (not the borrowed ones), both signature recipes, the Ball sounds');
  t.ok(!d11.inMain.length && d11.inRealm.length === 7, "11: Ball creatures are in no main world spawn table, all seven in Playland's stadium zone");
  t.ok(d11.blocks.slice(0, 10).join() === '194,195,196,197,198,199,200,201,202,203' && d11.defs && d11.tiles <= 163 + 72 && d11.ready === true, `11: blocks 194-203 are fixed, have wall text, are not placeable; the stadium frame is ready (${d11.tiles} tiles)`);
  // the creatures, as portraits
  const shots = await page.evaluate(async ids => {
    const { portrait } = await import('/src/ui.js');
    const S = await import('/src/species.js');
    const W = 220, H = 190, LABEL = 26, COLS = 4, rows = Math.ceil(ids.length / COLS);
    const cv = document.createElement('canvas');
    cv.width = W * COLS; cv.height = (H + LABEL) * rows;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
    const singles = {};
    for (let i = 0; i < ids.length; i++) {
      const img = new Image();
      img.src = portrait(ids[i], W, H);
      await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
      const x = (i % COLS) * W, y = Math.floor(i / COLS) * (H + LABEL);
      ctx.drawImage(img, x, y);
      ctx.fillText(S.SPECIES[ids[i]].name, x + W / 2, y + H + 18);
      singles[ids[i]] = portrait(ids[i], 480, 400);
    }
    return { grid: cv.toDataURL(), singles };
  }, d11.ids);
  fs.writeFileSync(path.join(SHOTS, 't40d-creatures.png'), Buffer.from(shots.grid.split(',')[1], 'base64'));
  for (const id of d11.ids) fs.writeFileSync(path.join(SHOTS, `t40d-creature-${id}.png`), Buffer.from(shots.singles[id].split(',')[1], 'base64'));
  console.log('  screenshot t40d-creatures.png');
  t.ok(shots.grid.length > 20000, '11: portrait grid drawn');

  /* ---- 12. Into Playland ---- */
  await newGame(page, 0);
  await toasts(page);
  await intoStadium(page);
  await prep(page);
  const d12 = await page.evaluate(() => {
    const g = window.pokecraft, p = g.player.pos, d = g.world.doors.find(d => d.key === 'stadium');
    const meshes = g.scene.children.filter(c => c.userData.ball).length, keepers = g.scene.children.filter(c => c.userData.keeper !== undefined).length;
    return { via: g.realms.via, z: p.z, door: d.stand[2], meshes, keepers, live: !!g.gymLive.of('part:stadium'), walk: g.world.walk.has(195) && g.world.walk.has(194), biome: g.world.biome(58, 170) };
  });
  t.ok(d12.via === 'stadium' && Math.abs(d12.z - d12.door) < 0.1 && d12.live, '12: the stadium frame opens Playland at the stadium gate and the live part exists');
  t.ok(d12.meshes === 4 && d12.keepers === 2 && d12.walk && d12.biome === 'stadium', `12: 2 balls and 2 shadows (4 meshes), 2 keepers, the pitch grass is walkable for wild creatures, the zone is the biome (${d12.meshes} / ${d12.keepers})`);
  await look(page, [58.5, 11, 133.5], [58, 12, 175]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, 't40d-stadium.png'), timeout: 180000 });
  await look(page, [58.5, 11, 196], [48, 14, 203]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, 't40d-court.png'), timeout: 180000 });
  console.log('  screenshot t40d-stadium.png, t40d-court.png');

  /* ---- 13. Walk into the football ---- */
  const d13 = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live, p = g.player;
    const run = (ballX, z) => {
      L.foot.reset([ballX, 11.401, z]);
      p.pos.set(47, 11, z); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0; p.keys.KeyW = true;
      for (let i = 0; i < 20; i++) { p.update(0.05); L.update(0.05); }
      p.keys.KeyW = false;
      return { px: p.pos.x, bx: L.foot.pos.x, bvx: L.foot.vel.x };
    };
    const solo = run(60, 150.5); // the ball is far ahead: never touched
    const kicked = run(49.5, 162.5);
    return { solo, kicked };
  });
  t.ok(d13.kicked.bx > 52 && d13.kicked.bvx > 1, `13: walking into the football moves it east (ball x ${d13.kicked.bx.toFixed(1)}, speed ${d13.kicked.bvx.toFixed(1)})`);
  t.ok(Math.abs(d13.kicked.px - d13.solo.px) < 1e-6, `13: the player only moved by its own walking (${d13.kicked.px.toFixed(4)} with the ball, ${d13.solo.px.toFixed(4)} without)`);

  /* ---- 14. Saved, then a goal ---- */
  await page.evaluate(() => { window.__toasts = []; window.pokecraft.beaten = window.pokecraft.beaten.filter(k => !k.startsWith('pw:stadium:goal')); });
  // time 5.65: Keeper Gail is just about at the top of his run (z 164.6), nearly standing still, when the ball arrives
  const shootAt = (z, time) => page.evaluate(([z, time]) => {
    const g = window.pokecraft, L = window.__live, p = g.player;
    L.goalAt = null; L.lastSave = -99; L.rivals = false;
    L.foot.reset([82, 11.401, z]); L.foot.time = time;
    p.pos.set(80.6, 11, z); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0;
    const word = g.gymLive.near(g.player), used = g.gymLive.use(g.player);
    L.held.t0 = L.t - 0.6; g.gymLive.release(g.player); // held into the green: a hard drive
    let goalFrame = -1;
    for (let i = 0; i < 60; i++) { L.update(0.05); if (goalFrame < 0 && L.goalAt != null) goalFrame = i; }
    return { word, used, goalFrame, beaten: g.beaten.filter(k => k.startsWith('pw:stadium:goal')), ball: L.foot.pos.x, spot: L.part.ballSpot };
  }, [z, time]);
  const { KEEPER } = await import(pathToFileURL(path.join(ROOT, 'src', 'ballphysics.js')).href);
  const TOP = KEEPER.P - 0.35; // Keeper Gail is at the top of his run (z 162 + A) when the ball arrives
  const saved = await shootAt(162 + KEEPER.A - 0.3, TOP);
  t.ok(saved.word === 'Kick!' && saved.used && saved.goalFrame < 0 && !saved.beaten.length && await said(page, /Saved by Keeper Gail! Try again!/), `14: a shot straight at the keeper is saved: the toast comes, no goal key (${JSON.stringify(saved.beaten)})`);
  const scored = await shootAt(162, TOP);
  t.ok(scored.goalFrame >= 0 && scored.goalFrame < 60 && scored.beaten.join() === GOAL(1) && await said(page, /GOAL! ⚽ 1 of 3/), `14: a shot at the open side is a goal within 3 s: GOAL! 1 of 3, key ${GOAL(1)} (goal at frame ${scored.goalFrame})`);
  t.ok(Math.abs(scored.ball - scored.spot[0]) < 0.5, `14: 1.5 s after the goal the ball is on the centre spot again (${scored.ball.toFixed(1)})`);
  // a goal picture: the ball in the net (the part is frozen so the picture stays)
  await page.evaluate(TOP => {
    const g = window.pokecraft, L = window.__live, p = g.player;
    L.goalAt = null; L.foot.reset([82, 11.401, 162]); L.foot.time = TOP; p.pos.set(80.6, 11, 162); p.yaw = -Math.PI / 2;
    g.gymLive.use(g.player); L.held.t0 = L.t - 0.6; g.gymLive.release(g.player);
    for (let i = 0; i < 9; i++) L.update(0.05); // the ball is in the net, the crowd is cheering
    L.playing = () => false;
    p.pos.set(75, 12, 160); p.vel.set(0, 0, 0); p.lookAt({ x: 87.5, y: 12, z: 162 });
  }, TOP);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, 't40d-goal.png'), timeout: 180000 });
  console.log('  screenshot t40d-goal.png');
  await page.evaluate(() => { const L = window.__live; L.playing = () => true; L.goalAt = null; L.foot.reset(); });

  /* ---- 15. Out ---- */
  await page.evaluate(() => { window.__toasts = []; });
  const d15 = await page.evaluate(() => {
    const L = window.__live;
    L.goalAt = null; L.foot.reset([58, 11.401, 142]); L.foot.vel.z = -8;
    for (let i = 0; i < 60; i++) L.update(0.05);
    return { x: L.foot.pos.x, z: L.foot.pos.z, spot: L.part.ballSpot };
  });
  t.ok(Math.hypot(d15.x - d15.spot[0], d15.z - d15.spot[2]) < 0.5 && await said(page, /Out! The ball goes back to the middle/), `15: a ball kicked into the north tunnel is back on the centre spot within 3 s, with the toast (${d15.x.toFixed(1)}, ${d15.z.toFixed(1)})`);

  /* ---- 17. Baskets ---- */
  const d17 = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live, p = g.player, out = [];
    L.rivals = false; // Blocker Bo is checked below
    for (let k = 0; k < 4; k++) {
      L.hoop.reset([52.2, 11.401, 203]);
      p.pos.set(53.6, 11, 203); p.vel.set(0, 0, 0); p.yaw = Math.PI / 2; p.pitch = 0; p.onGround = true;
      const c0 = g.cubes, word = g.gymLive.near(g.player);
      g.gymLive.use(g.player); L.t = L.held.apex; g.gymLive.release(g.player); // let go right at the top of the jump
      p.vel.set(0, 0, 0);
      for (let i = 0; i < 80; i++) L.update(0.05);
      out.push({ word, cubes: g.cubes - c0, bonus: L.bonus });
    }
    L.hoop.reset();
    return out;
  });
  t.ok(d17.every(r => r.word === 'Shoot!') && d17.map(r => r.cubes).join() === '1,1,1,0' && d17[3].bonus === 3, `17: next to the court ball the button says Shoot!; three baskets give a cube each, the fourth none (${d17.map(r => r.cubes)})`);
  t.ok(await said(page, /Swish! 🏀 1 of 3 \+1 Capture Cube/) && await said(page, /Swish! 🏀$/), '17: the Swish! words (a basket for the Captain counts: 1 of 3)');

  /* ---- 17b. Defender Dee and Blocker Bo (owner 2026-10-26: a bit harder) ---- */
  const d17b = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live, p = g.player;
    L.rivals = true; L.goalAt = null; L.outAt.foot = null; window.__toasts = [];
    p.pos.set(60, 11, 150); p.vel.set(0, 0, 0); // the player is far away
    // Dee: once you touched the football he runs at it anywhere (here in the middle of the pitch, far from both goals) and kicks it
    // up over the nearer sideline; it is out and back on the centre spot a moment later
    L.foot.reset([50, 11.401, 157]); L.touched = true; L.dee.x = 47; L.dee.z = 157; L.dee.rest = 0;
    let stole = false, sideways = false;
    for (let i = 0; i < 40 && !stole; i++) { L.update(0.05); stole = L.foot.vel.z < -5; sideways = stole && Math.abs(L.foot.vel.z) > 3 * Math.abs(L.foot.vel.x); }
    const deeToast = window.__toasts.some(m => /Defender Dee kicked it out/.test(m));
    for (let i = 0; i < 60 && L.touched; i++) L.update(0.05);
    const backOnSpot = !L.touched && Math.hypot(L.foot.pos.x - L.part.ballSpot[0], L.foot.pos.z - L.part.ballSpot[2]) < 0.5;
    // a ball nobody has touched yet he leaves alone: he walks back to his spot
    L.foot.reset([70, 11.401, 150]); L.touched = false; L.dee.x = 40; L.dee.z = 140; L.dee.rest = 0;
    for (let i = 0; i < 20; i++) L.update(0.05);
    const homeward = Math.hypot(L.dee.x - L.part.ballSpot[0], L.dee.z - L.part.ballSpot[2] - 3) < Math.hypot(40 - L.part.ballSpot[0], 140 - L.part.ballSpot[2] - 3) && Math.hypot(L.foot.vel.x, L.foot.vel.z) < 0.1;
    // Bo: in the air his box is higher than on the ground
    L.t = 0.45; L.moveBlocker(0); const up = L.blockerBox().y0; L.t = 1.5; L.moveBlocker(0); const down = L.blockerBox().y0;
    L.t = 0.45; L.moveBlocker(0);
    // a ball thrown flat at him while he is up bounces off with the hint
    window.__toasts = []; L.bo.told = -99;
    const bx = L.bo.x, bz = L.bo.z, by = L.blockerBox().y0 + 0.8;
    L.hoop.reset([bx - 2.5, by, bz]); Object.assign(L.hoop.vel, { x: 8, y: 0, z: 0 });
    let back = false;
    for (let i = 0; i < 10 && !back; i++) { L.hoop.update(0.05, () => [L.blockerBox()]); for (const ev of L.hoop.events) if (ev.kind === 'keeper') { L.blocked(L.hoop); back = true; } }
    const boToast = window.__toasts.some(m => /Blocked by Blocker Bo/.test(m));
    // Shoot! held: you jump with the ball over your head, it glows at the top; early / late let-gos miss
    L.rivals = false;
    const h0 = L.part.hoops[0], shotFrom = early => {
      L.hoop.reset([h0.hole[0] + 8 * h0.front, 11.401, h0.hole[1]]);
      p.pos.set(h0.hole[0] + 8.9 * h0.front, 11, h0.hole[1]); p.vel.set(0, 0, 0); p.onGround = true; p.yaw = h0.front > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.gymLive.use(g.player);
      const jumped = p.vel.y > 9, overHead = L.hoop.pos.y > p.pos.y + 1.9;
      L.t = L.held.apex; L.drawAll(); const glowTop = L.meshes.hoop.material.emissive.r;
      L.t = L.held.apex + (early ? -0.25 : 0.25); L.drawAll(); const glowOff = L.meshes.hoop.material.emissive.r;
      g.gymLive.release(g.player); p.vel.set(0, 0, 0);
      let swish = false; const nb = L.basket; L.basket = () => { swish = true; };
      for (let i = 0; i < 80 && !swish; i++) L.update(0.05);
      L.basket = nb;
      return { jumped, overHead, glowTop, glowOff, miss: L.lastShot.miss, swish };
    };
    const early = shotFrom(true), late = shotFrom(false);
    // Kick! held: the ring fills; an over-hit ball never scores
    L.foot.reset([82, 11.401, 162]); p.pos.set(80.6, 11, 162); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2;
    g.gymLive.use(g.player); L.t += 0.3; L.drawAll();
    const ring = L.ring.g.visible, word = g.gymLive.near(g.player);
    L.held.t0 = L.t - 1.2; window.__toasts = [];
    g.gymLive.release(g.player);
    const wild = L.wild, b0 = g.beaten.filter(k => k.startsWith('pw:stadium:goal')).length;
    for (let i = 0; i < 60; i++) L.update(0.05);
    const overToast = window.__toasts.some(m => /Too much power/.test(m)), b1 = g.beaten.filter(k => k.startsWith('pw:stadium:goal')).length;
    L.rivals = true; L.hoop.reset(); L.foot.reset();
    return { stole, sideways, backOnSpot, deeToast, homeward, up, down, back, boToast, early, late, ring, word, wild, overToast, noGoal: b1 === b0, ringAfter: L.ring.g.visible };
  });
  t.ok(d17b.stole && d17b.sideways && d17b.deeToast && d17b.backOnSpot, '17b: once you touched the football, Defender Dee runs at it anywhere on the pitch and kicks it out over the nearer sideline ("Defender Dee kicked it out!"); it comes back to the centre spot');
  t.ok(d17b.homeward, '17b: a ball nobody touched yet he leaves alone and walks back to his spot');
  t.ok(d17b.up > d17b.down + 1, `17b: Blocker Bo jumps (feet ${d17b.down.toFixed(1)} -> ${d17b.up.toFixed(1)})`);
  t.ok(d17b.back && d17b.boToast, '17b: a ball thrown at Bo in the air bounces off ("Blocked by Blocker Bo! Shoot when he lands.")');
  t.ok(d17b.early.jumped && d17b.early.overHead && d17b.early.glowTop > 0.3 && d17b.early.glowOff === 0, '17b: holding Shoot! jumps you up with the ball over your head; it glows only at the top of the jump');
  t.ok(d17b.early.miss < 0 && d17b.late.miss > 0 && !d17b.early.swish && !d17b.late.swish, `17b: let go too early the shot is short, too late it is long, and neither goes in (${d17b.early.miss.toFixed(2)} / ${d17b.late.miss.toFixed(2)})`);
  t.ok(d17b.ring && d17b.word === 'Kick!' && d17b.wild && d17b.overToast && d17b.noGoal && !d17b.ringAfter, '17b: holding Kick! fills the ring round the ball; held too long it flies over the bar ("Too much power!") and is no goal');

  /* ---- 17c. The score in the corner (owner 2026-10-26) ---- */
  const d17c = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live, p = g.player, chip = document.getElementById('score-chip'), keep = [...g.beaten];
    const read = (x, z) => { p.pos.set(x, 11, z); p.vel.set(0, 0, 0); L.update(0.05); return chip.classList.contains('hidden') ? null : chip.textContent; };
    g.beaten = g.beaten.filter(k => !k.startsWith('pw:stadium:')); g.beaten.push('pw:stadium:goal1');
    const pitch = read(60, 150), court = read(55, 198), off = read(58, 128);
    for (const k of ['goal2', 'goal3', 'basket1', 'basket2', 'basket3']) g.beaten.push('pw:stadium:' + k);
    const done = read(60, 150), green = chip.classList.contains('done');
    g.beaten = keep; read(58, 128);
    return { pitch, court, off, done, green };
  });
  t.ok(d17c.pitch === '⚽ 1/3 · 🏀 0/3' && d17c.court === d17c.pitch && d17c.off === null, `17c: on the pitch or the court the corner shows the goals and baskets ("${d17c.pitch}"), off them nothing`);
  t.ok(d17c.done === '⚽ 3/3 · 🏀 3/3 · Battle the Captain!' && d17c.green, `17c: with 3 and 3 it says "${d17c.done}"`);

  /* ---- 16. The Captain ---- */
  await page.evaluate(async () => {
    const g = window.pokecraft, L = window.__live, S = await import('/src/species.js');
    L.goalAt = null; g.beaten = g.beaten.filter(k => !k.startsWith('pw:stadium:')); g.beaten.push('pw:stadium:goal1');
    const bs = g.world.bosses.find(b => b.id === 'stadium');
    g.player.pos.set(bs.rest[0], bs.rest[1], bs.rest[2]); g.player.vel.set(0, 0, 0);
    g.party = [S.makeCreature('grovebeast', 100), S.makeCreature('thunderwolf', 100)];
    window.__toasts = [];
  });
  const d16a = await page.evaluate(() => {
    const g = window.pokecraft, npc = g.npcs.list.find(n => n.kind === 'boss' && n.def.id === 'stadium');
    const word = g.gymLive.talkPrompt(npc)?.action;
    g.bosses.talk(npc);
    return { word, inBattle: g.inBattle, name: npc.name };
  });
  t.ok(d16a.name === 'Captain Kickley' && d16a.word === 'Talk' && !d16a.inBattle && await said(page, /Captain Kickley: Score 3 goals and 3 baskets first! Then we battle\. \(⚽ 1 \/ 3 · 🏀 0 \/ 3\)/), '16: with 1 goal the Captain says to score 3 goals and 3 baskets first (⚽ 1 / 3 · 🏀 0 / 3), no battle, the button says Talk');
  const guide = await page.evaluate(() => { const g = window.pokecraft; g.player.pos.set(58.5, 11, 150); g.updateGuide(); return g.ui.guideText; });
  t.ok(/Kick the ball into a goal! \(1 \/ 3\)/.test(guide || ''), `16: the guide says "${guide}"`);
  // a lost battle: still in Playland, healed, the goals are kept
  await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js');
    g.beaten.push('pw:stadium:goal2', 'pw:stadium:goal3');
    window.__gateGoals = (await import('/src/pictureboss.js')).bossOf('stadium').gate(g); // 3 goals, no baskets: the gate is still shut
    g.beaten.push('pw:stadium:basket1', 'pw:stadium:basket2', 'pw:stadium:basket3');
    g.party = [S.makeCreature('fluffin', 2)];
    g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss' && n.def.id === 'stadium'));
  });
  await waitFor(page, () => window.pokecraft.inBattle, null, 30000);
  const foes = await page.evaluate(() => { const g = window.pokecraft, f = g.battle.foes; return { levels: f.map(x => x.level).join(), last: f.at(-1).species, moves: JSON.stringify(f.at(-1).moves) }; });
  t.ok(Math.max(...foes.levels.split(',').map(Number)) === 65 && foes.last === 'goalhound' && /goldengoal/.test(foes.moves), `16: with 3 goals and 3 baskets the Captain battles: top level 65, Goalhound last with Golden Goal (${foes.levels}; ${foes.moves})`);
  await playBattle(page);
  await waitFor(page, () => !window.pokecraft.inBattle, null, 60000);
  const lost = await page.evaluate(() => { const g = window.pokecraft; return { place: g.place, hp: g.party.every(c => c.hp > 0), keys: g.beaten.filter(k => k.startsWith('pw:stadium:')).length, star: g.stars.includes('stadium'), gate3: window.__gateGoals }; });
  t.ok(/🏀 0 \/ 3/.test(lost.gate3 || ''), `16: 3 goals but no baskets: the gate is still shut ("${lost.gate3}")`);
  t.ok(lost.place === 'playland' && lost.hp && lost.keys === 6 && !lost.star, `16: losing keeps you in Playland, healed, with all goals and baskets (${JSON.stringify(lost)})`);
  // a won battle: the star, the goal keys are gone, the next gate says 0 / 3
  await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js');
    g.party = [S.makeCreature('grovebeast', 100), S.makeCreature('thunderwolf', 100)];
    window.__toasts = [];
    g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss' && n.def.id === 'stadium'));
  });
  await waitFor(page, () => window.pokecraft.inBattle, null, 30000);
  const fin = await playBattle(page);
  const dbg = await page.evaluate(() => ({ stars: window.pokecraft.stars, inBattle: window.pokecraft.inBattle, toasts: window.__toasts.slice(-4), party: window.pokecraft.party.map(c => `${c.species} ${c.level} ${c.hp}`) }));
  if (!dbg.stars.includes('stadium')) console.log('  debug', fin, JSON.stringify(dbg));
  await waitFor(page, () => window.pokecraft.stars.includes('stadium'), null, 60000);
  const won = await page.evaluate(async () => {
    const g = window.pokecraft, PB = await import('/src/pictureboss.js'), npc = g.npcs.list.find(n => n.kind === 'boss' && n.def.id === 'stadium');
    const L = g.gymLive.of('part:stadium'), p = g.player; L.playing = () => true; p.pos.set(60, 11, 150); p.vel.set(0, 0, 0); L.update(0.05); const corner = document.getElementById('score-chip').textContent;
    return { keys: g.beaten.filter(k => k.startsWith('pw:stadium:')).length, gate: PB.bossOf('stadium').gate(g), word: g.gymLive.talkPrompt(npc)?.action, corner };
  });
  t.ok(won.keys === 0 && /Score 3 goals and 3 baskets first!.*\(⚽ 0 \/ 3 · 🏀 0 \/ 3\)/.test(won.gate) && won.word === 'Talk' && won.corner === '⚽ 0/3 · 🏀 0/3', `16: winning gives the star and clears the goals and baskets: the rematch gate says "${won.gate}", the corner "${won.corner}"`);
  await page.waitForTimeout(500);

  /* ---- 18. Save and load ---- */
  await page.evaluate(() => { window.pokecraft.beaten.push('pw:stadium:goal1'); window.pokecraft.save(); });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  const p2 = await openGame(browser, base, { setup: seedSave(save) });
  await continueGame(p2);
  const d18 = await p2.evaluate(async () => { const g = window.pokecraft, S = await import('/src/stadium.js'); return { keys: g.beaten.filter(k => k.startsWith('pw:stadium:goal')), state: S.goalState(g), place: g.place, star: g.stars.includes('stadium') }; });
  t.ok(d18.keys.join() === GOAL(1) && d18.state.n === 1 && d18.state.need === 3 && d18.star, `18: a goal key and the star survive a reload in a fresh browser (${JSON.stringify(d18)})`);
  await p2.context().close();
  t.ok(!page.errors.length, `no page errors (${page.errors.join('; ').slice(0, 200)})`);
  await page.context().close();

  /* ---- 19. iPad ---- */
  const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await newGame(ip, 0);
  const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  await intoStadium(ip);
  await prep(ip, false);
  await ip.evaluate(() => { const g = window.pokecraft, L = window.__live, p = g.player; L.foot.reset([52.0, 11.401, 162.5]); p.pos.set(50.6, 11, 162.5); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0; });
  await waitFor(ip, () => document.getElementById('btn-act').textContent === 'Kick!', null, 60000);
  const act1 = await ip.evaluate(() => ({ text: document.getElementById('btn-act').textContent, prompt: document.getElementById('prompt')?.textContent }));
  await ip.screenshot({ path: path.join(SHOTS, 't40d-ipad.png'), timeout: 180000 });
  console.log('  screenshot t40d-ipad.png');
  // a real finger: down on the big button starts the hold, up kicks
  const box = await ip.locator('#btn-act').boundingBox(), cdp = await ip.context().newCDPSession(ip);
  const finger = type => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 7 }] });
  await finger('touchStart');
  await waitFor(ip, () => !!window.__live.held, null, 30000);
  const holding = await ip.evaluate(() => { const L = window.__live; L.held.t0 = L.t - 0.6; return L.held.key; }); // into the green
  await finger('touchEnd');
  await waitFor(ip, () => !window.__live.held && window.__live.foot.vel.x > 10, null, 60000);
  t.ok(act1.text === 'Kick!' && holding === 'foot', `19: next to the football the big button says "${act1.text}" (${act1.prompt}); a real finger held on it powers up and lifting it kicks a hard drive`);
  await ip.evaluate(() => { const g = window.pokecraft, L = window.__live, p = g.player; L.hoop.reset([52.2, 11.401, 203]); p.pos.set(53.6, 11, 203); p.vel.set(0, 0, 0); p.yaw = Math.PI / 2; p.pitch = 0; });
  await waitFor(ip, () => document.getElementById('btn-act').textContent === 'Shoot!', null, 60000);
  await finger('touchStart');
  await waitFor(ip, () => window.__live.held?.key === 'hoop', null, 30000);
  const jumped = await ip.evaluate(() => window.pokecraft.player.vel.y > 0 || window.pokecraft.player.pos.y > 11.2);
  await finger('touchEnd');
  await waitFor(ip, () => !window.__live.held, null, 60000);
  t.ok(jumped, '19: a finger held on Shoot! jumps you with the ball; lifting it shoots');
  const after = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  t.ok(after === before, `19: on the court it says Shoot!, and the number of touch buttons is unchanged (${before} / ${after})`);
  await ip.context().close();

  /* ---- 20. The Book ---- */
  const bk = await openGame(browser, base);
  await newGame(bk, 0);
  await bk.evaluate(() => {
    const g = window.pokecraft;
    g.inBattle = false; document.body.classList.remove('in-battle'); document.exitPointerLock?.();
    for (const id of ['boinkle', 'goalhound']) { g.book.markSeen(id); g.book.markCaught(id); }
    g.book.open({ species: 'goalhound' });
  });
  await bk.waitForFunction(() => [...document.querySelectorAll('#book-detail img')].every(i => i.src.startsWith('data:')), null, { timeout: 60000 });
  const d20 = await bk.evaluate(() => document.getElementById('book-detail')?.textContent || '');
  await bk.screenshot({ path: path.join(SHOTS, 't40d-book.png'), timeout: 180000 });
  console.log('  screenshot t40d-book.png');
  t.ok(/Goalhound/.test(d20) && /Ball/.test(d20) && /Golden Goal/.test(d20) && /Playland · Ball Stadium/.test(d20), `20: the Book page shows Goalhound, the Ball type, Golden Goal and "Playland · Ball Stadium" (${d20.slice(0, 120)}...)`);
  await bk.context().close();

  /* ---- 21. Two browsers ---- */
  const [A, Bp] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(Bp, 1); await pause(Bp);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await Bp.fill('#mp input[placeholder="Your name"]', 'Kid');
  await Bp.fill('#mp .mp-code-input', code);
  await click(Bp, '#mp button:has-text("Join a world")');
  await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000);
  await toasts(A); await toasts(Bp);
  await A.evaluate(() => { window.pokecraft.champion = true; }); await Bp.evaluate(() => { window.pokecraft.champion = true; });
  await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
  await placeIs(A, 'swirl');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 30000);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'swirl');
  const cellA = await A.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'stadium'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cellA);
  await placeIs(A, 'playland');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 30000);
  const ask = await Bp.evaluate(() => document.getElementById('ask-text').textContent);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'playland');
  await prep(A); await prep(Bp);
  t.ok(/Dad stepped into the Playland\. Go too\?/.test(ask), `21: Kid is asked to follow into Playland ("${ask}")`);
  // Dad scores; Kid's ball does not move and Kid has no goal
  const kBefore = await Bp.evaluate(() => { const L = window.__live; return { x: L.foot.pos.x, z: L.foot.pos.z }; });
  const dad = await A.evaluate(() => {
    const g = window.pokecraft, L = window.__live, p = g.player;
    L.rivals = false; L.foot.reset([82, 11.401, 162]); L.foot.time = 4.05; p.pos.set(80.6, 11, 162); p.yaw = -Math.PI / 2; p.pitch = 0; // 4.05 = KEEPER.P - 0.35: Gail at the top of her run
    g.gymLive.use(g.player); L.held.t0 = L.t - 0.6; g.gymLive.release(g.player);
    for (let i = 0; i < 60; i++) L.update(0.05);
    return g.beaten.filter(k => k.startsWith('pw:stadium:goal'));
  });
  await Bp.waitForTimeout(1500);
  const kid = await Bp.evaluate(() => { const g = window.pokecraft, L = window.__live; return { keys: g.beaten.filter(k => k.startsWith('pw:stadium:goal')), x: L.foot.pos.x, z: L.foot.pos.z, spot: L.part.ballSpot }; });
  t.ok(dad.join() === GOAL(1) && !kid.keys.length && Math.hypot(kid.x - kBefore.x, kid.z - kBefore.z) < 0.01 && Math.hypot(kid.x - kid.spot[0], kid.z - kid.spot[2]) < 0.5, `21: Dad scored (${dad}); Kid's ball stayed on the centre spot and Kid has no goal (balls are local per player)`);
  t.ok(!A.errors.length && !Bp.errors.length, `21: no page errors in the pair (${[...A.errors, ...Bp.errors].join('; ').slice(0, 200)})`);
  await A.context().close(); await Bp.context().close();
}
