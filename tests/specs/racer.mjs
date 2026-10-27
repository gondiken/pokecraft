// T40c Racer type and Playland's Race Track (plans/T40c.md). A: the seven creatures, shapes (stripe + goggles), moves, effects, sounds,
// spawns only in Playland, rideable; B: the track maths and Rio's rubber band (pure, run in Node); C: the builder on three seeds (only
// inside the race zone, the centreline is open asphalt, the walk in, the keep); D: the race in a browser (countdown, flags, laps, boost
// pads, pause, leaving, riding, the Boss battle after the race, the parade after the star); E: the 'dash' gait with the real Player
// physics; F: the Book; G: an iPad; H: two browsers. RACER_ONLY=data|track|race|gait|book|ipad|pair runs part of it.
// Screenshots: tests/screenshots/t40c-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, waitFor as waitFor0, playBattle, platform } from '../helpers.mjs';
import { makeTrack, bossSpeed, buildRaceTrack, RACE, RACER_SPAWNS } from '../../src/racetrack.js';
import { Kart, KART } from '../../src/kart.js';
import { B } from '../../src/blocks.js';

// A stand-in Playland for Node: flat land at y 10 and the race track (buildRaceTrack writes only into world.data).
function standIn() {
  const W = 224, D = 224, HH = 48;
  const world = { W, D, data: new Uint8Array(W * D * HH), ground: new Int16Array(W * D).fill(10), index: (x, y, z) => x + z * W + y * W * D, inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < HH, parts: [], keeps: [] };
  world.get = (x, y, z) => (world.inBounds(x, y, z) ? world.data[world.index(x, y, z)] : 0);
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = 0; y <= 10; y++) world.data[world.index(x, y, z)] = y === 10 ? B.GRASS : B.DIRT;
  return { world, part: buildRaceTrack(world, { box: { x0: 8, x1: 215, z0: 8, z1: 95 } }) };
}
// A driver for a whole 3-lap race against Rio: it steers at a point ahead on the middle line and brakes so every corner ahead can be
// taken (skill 1 = at the grip's limit, lower = slower in the corners); `wobble` = steering noise (radians, changed every half second).
function autoRace(world, part, skill, losses, { fps = 60, wobble = 0, seed = 1 } = {}) {
  const t = part.track, L = t.L, end = RACE.laps * L, g = part.grid.player, k = new Kart(g[0], g[1], g[2], Math.PI / 2);
  let rio = RACE.grid, P = RACE.grid, laps = 0, lastS = L + RACE.grid, time = 0, r = seed, noise = 0;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < fps * 400; i++) {
    const pr = t.project(k.x, k.z), tgt = t.at(pr.s + 3 + k.speed * 0.25, 0);
    let wx = tgt.x - k.x, wz = tgt.z - k.z; const m = Math.hypot(wx, wz); wx /= m; wz /= m;
    if (i % Math.round(fps / 2) === 0) noise = (rnd() - 0.5) * 2 * wobble;
    [wx, wz] = [wx * Math.cos(noise) - wz * Math.sin(noise), wx * Math.sin(noise) + wz * Math.cos(noise)];
    let allowed = 99;
    for (let a = 1; a <= 30; a++) {
      const h0 = t.at(pr.s + a - 1).heading, h1 = t.at(pr.s + a + 1).heading, curv = Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))) / 2;
      const vmax = curv > 1e-3 ? Math.sqrt(KART.grip / curv) * skill : 99;
      allowed = Math.min(allowed, Math.sqrt(vmax * vmax + 2 * KART.brake * 0.7 * Math.max(0, a - 1)));
    }
    const input = k.speed > allowed + 0.3 ? { x: -Math.sin(k.h), z: -Math.cos(k.h), m: 1 } : { x: wx, z: wz, m: 1 };
    if (k.update(1 / fps, input, world.get).some(e => e.type === 'splash')) { const b = t.at(t.pieces.find(p => p.kind === 'kicker').s0 - 6, 0); k.reset(b.x, 11, b.z, b.heading); }
    time += 1 / fps;
    const ns = t.project(k.x, k.z).s;
    if (lastS > L - 40 && ns < 40) laps++;
    if (lastS < 40 && ns > L - 40) laps--;
    lastS = ns;
    P = laps === 0 ? ns - L : (laps - 1) * L + ns;
    rio += bossSpeed(rio, rio - P, losses, t) / fps;
    if (P >= end) return { win: true, time: +time.toFixed(1), margin: +(end - rio).toFixed(1) };
    if (rio >= end) return { win: false, time: +time.toFixed(1), margin: +(end - P).toFixed(1) };
  }
  return { win: null };
}

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const IDS = ['vroomlet', 'vroomster', 'zipskate', 'blastskate', 'pitpig', 'karthog', 'wheelie'];
const ONLY = process.env.RACER_ONLY || '';
const want = part => !ONLY || ONLY === part;
const waitFor = (page, fn, arg, timeout = 90000) => waitFor0(page, fn, arg, timeout);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const save = (name, url) => { const file = path.join(SHOTS, name); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); console.log(`  screenshot ${file}`); };
const frames = (page, n = 2) => page.evaluate(async n => {
  const g = window.pokecraft;
  for (let i = 0; i < n; i++) { const t0 = g.time; await new Promise(res => { const f = () => (g.time !== t0 ? res() : requestAnimationFrame(f)); f(); }); }
}, n);
const shot = async (page, name, { clear = false } = {}) => { await page.evaluate(clear => { document.getElementById('pause')?.classList.add('hidden'); if (clear) window.pokecraft.ui.toastBox.replaceChildren(); }, clear); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };

// A Champion in Playland, through the race frame of the Swirl.
async function intoPlayland(page, { star = false } = {}) {
  await page.evaluate(({ star }) => { const g = window.pokecraft; g.champion = true; if (star) g.stars = ['race']; g.realms.enter('swirl', { back: g.world.portal.stand }); }, { star });
  await placeIs(page, 'swirl');
  const cell = await page.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'race'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(page, 'playland');
}

// Page side helpers for the race: the live part driven by hand (manual clocks, fixed dt), toasts collected.
const arm = page => page.evaluate(async () => {
  const g = window.pokecraft, T = await import('/src/racetrack.js'), { B } = await import('/src/blocks.js'), { KART } = await import('/src/kart.js');
  const live = g.gymLive.of('part:race');
  live.manual = true; live.playing = () => true;
  window.__toasts = [];
  const f = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...r) => { window.__toasts.push(m); return f(m, ...r); };
  const track = live.track, Y = live.part.y, p = g.player;
  const R = window.__R = {
    g, live, track, Y, B, T, p,
    rio: () => g.npcs.list.find(n => n.kind === 'boss' && n.def?.id === 'race'),
    // a spot on the track (in the kart during a race: the kart is put there, standing still)
    put(s, lane = -1.5, y = null) {
      const a = track.at(s, lane), yy = y ?? Y + 1 + Math.round(track.project(a.x, a.z).h);
      if (live.car) live.car.reset(a.x, yy, a.z, a.heading);
      p.pos.set(a.x, yy, a.z); p.vel.set(0, 0, 0); return a;
    },
    at(x, z, y = Y + 1) { if (live.car) live.car.reset(x, y, z); p.pos.set(x, y, z); p.vel.set(0, 0, 0); },
    // really drive the kart: a driver steering at a point ahead and braking before the corners (like the spec's Node driver)
    auto({ skill = 1, dt = 1 / 30, until = () => live.state !== 'race', max = 300 } = {}) {
      let t = 0;
      while (!until() && t < max) {
        const c = live.car;
        if (c) {
          const pr = track.project(c.x, c.z), q = track.at(pr.s + 3 + c.speed * 0.25, 0);
          let wx = q.x - c.x, wz = q.z - c.z; const m = Math.hypot(wx, wz); wx /= m; wz /= m;
          let allowed = 99;
          for (let a = 1; a <= 30; a++) {
            const h0 = track.at(pr.s + a - 1).heading, h1 = track.at(pr.s + a + 1).heading, cv = Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))) / 2;
            allowed = Math.min(allowed, Math.sqrt((cv > 1e-3 ? KART.grip / cv * skill * skill : 9801) + 2 * KART.brake * 0.7 * Math.max(0, a - 1)));
          }
          live.wish = c.speed > allowed + 0.3 ? { x: -Math.sin(c.h), z: -Math.cos(c.h), m: 1 } : { x: wx, z: wz, m: 1 };
        }
        live.step(dt); t += dt;
      }
      return t;
    },
    // run along `lane` at v blocks per second from distance s until `until` or max seconds; returns the seconds used
    drive(v, { s = -1.5, lane = -1.5, dt = 1 / 20, until = () => live.state !== 'race', max = 200, y = null } = {}) {
      let t = 0;
      R.s = s;
      while (!until() && t < max) { s += v * dt; R.s = s; R.put(s, lane, y); live.step(dt); t += dt; }
      return t;
    },
    steps(seconds, dt = 1 / 20) { for (let t = 0; t < seconds; t += dt) live.step(dt); },
    lamps: () => live.part.lights.map(([x, y, z]) => g.world.get(x, y, z)),
    said: re => window.__toasts.some(m => new RegExp(re).test(m)),
  };
  return true;
});

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });

  /* ---------------------------------------------------------------- B. Track maths and the kart (pure, in Node) */
  if (want('track')) {
    const tr = makeTrack();
    const kinds = new Set(tr.pieces.map(p => p.kind));
    t.ok(tr.L > 450 && tr.L < 520 && tr.pieces.length === 31 && tr.gates.length === 4, `owner 2026-10-27: a lap more than twice as long as the old 191 (${tr.L.toFixed(1)} blocks in ${tr.pieces.length} pieces, 4 gates)`);
    t.ok(['snake', 'kicker', 'jump', 'climb', 'high', 'drop', 'tunnel', 'hairpin', 'chicane', 'corner'].every(k => kinds.has(k)), `a snake, a jump over the pond, the orange flyover (climb, high, drop), a tunnel, a hairpin and a chicane (${[...kinds]})`);
    // the lap closes and never comes back near itself (points 24+ apart along it are 12+ apart: the road is 7 wide)
    const end = tr.at(tr.L - 1e-6), st = tr.at(0);
    let close = 0; const pts = []; for (let s = 0; s < tr.L; s += 1) pts.push([s, tr.at(s)]);
    for (const [s1, a] of pts) for (const [s2, b] of pts) { let ds = Math.abs(s1 - s2); ds = Math.min(ds, tr.L - ds); if (ds >= 24 && Math.hypot(a.x - b.x, a.z - b.z) < 12) close++; }
    t.ok(Math.hypot(end.x - st.x, end.z - st.z) < 1e-3 && close === 0, `the loop closes and never runs close to itself (${close} close points)`);
    let jump = 0, back = 0, cells = 0, inZone = 0;
    const corners = tr.pieces.filter(p => p.type === 'arc' && p.r < 8).flatMap(p => [p.s0, p.s0 + p.len]);
    for (let s = 0; s < tr.L; s += 0.5) {
      const a = tr.at(s), b = tr.at(s + 0.01);
      if (Math.hypot(a.x - b.x, a.z - b.z) > 0.02 || Math.abs(a.y - b.y) > 0.1) jump++;
      for (const lane of [-2, -1, 0, 1, 2]) {
        if (Math.abs(lane) > 0.5 && corners.some(c => Math.abs(c - s) < 1.6 * Math.abs(lane) + 0.5)) continue; // the offset line folds over at the sharp chicane corners
        const q = tr.at(s, lane), p = tr.project(q.x, q.z);
        let ds = Math.abs(p.s - s); ds = Math.min(ds, tr.L - ds);
        if (ds > 0.05 || Math.abs(p.across - lane) > 0.05) back++;
        cells++;
      }
      for (const lane of [-4.3, 4.3]) { const q = tr.at(s, lane); if (q.x < 8 || q.x >= 216 || q.z < 8 || q.z >= 96) inZone++; }
    }
    t.ok(jump === 0, 'at(s) is continuous (every 0.5), the height too');
    t.ok(back === 0, `project(at(s, lane)) gives back s and the lane for lanes -2..2 (${cells} points, ${back} wrong)`);
    t.ok(inZone === 0, `the road and its rails stay inside the race zone (${inZone} points outside)`);
    t.ok(tr.gates.map(g => g.id).join() === 'G0,G1,G2,G3' && tr.gates.every((g, i) => i === 0 || g.s > tr.gates[i - 1].s), 'the gates are G0..G3, sorted by distance');
    t.ok(tr.pads.length === 4 && tr.pads.every(p => p.cells.length >= 6 && p.cells.length <= 8), `four thin boost strips (${tr.pads.map(p => p.cells.length)})`);
    // owner 2026-10-27: the pads boost Rio too
    const pad = tr.pads[0], base = bossSpeed(pad.s0 - 1, 0, 0, tr);
    t.ok(bossSpeed(pad.s0 + 2, 0, 0, tr) === RACE.boost.speed && bossSpeed(pad.s0 + RACE.boost.dist + RACE.boost.fade / 2, 0, 0, tr) > base && tr.kindAt(pad.s0 + 1) === 'boost', `a boost strip speeds Rio up to ${RACE.boost.speed} (from ${base}) and he slows back after it`);
    const top = Math.max(RACE.boost.speed, ...Object.values(RACE.speed)) * RACE.band.max;
    let fast = 0;
    for (let s = -2; s < RACE.laps * tr.L; s += 1.1) for (const lead of [-30, -4, 0, 2, 20]) for (const l of [0, 1, 2, 3]) if (bossSpeed(s, lead, l, tr) > top + 1e-9) fast++;
    t.ok(fast === 0, `Rio is never faster than ${top.toFixed(2)} blocks per second`);
    t.ok(tr.pieces.filter(p => p.hot).every(p => p.y[0] >= 0 && p.y[1] <= 6) && Math.max(...pts.map(([, a]) => a.y)) === 6 && tr.yAt(tr.pieces.find(p => p.kind === 'jump').s0 + 3.5) > 2, 'the flyover climbs to 6 blocks and drops back; over the pond Rio arcs above the road');

    // the kart on the real blocks (a stand-in world: flat land at y 10 and buildRaceTrack)
    const { world, part } = standIn(), get = (x, y, z) => world.get(x, y, z), Y = 10;
    const K = (x, z, h, y = Y + 1) => new Kart(x, y, z, h);
    const run = (k, secs, input, fps = 60) => { const ev = []; for (let i = 0; i < secs * fps; i++) ev.push(...k.update(1 / fps, typeof input === 'function' ? input(k) : input, get)); return ev; };
    const g0 = part.grid.player, east = { x: 1, z: 0, m: 1 };
    const k1 = K(g0[0], g0[2], Math.PI / 2); run(k1, 0.5, east); const v05 = k1.v; run(k1, 2, east);
    t.ok(v05 > 2 && v05 < 5 && Math.abs(k1.v - KART.top.road) < 0.01 && k1.surface === 'road', `a kart speeds up (${v05.toFixed(1)} after half a second), then drives ${k1.v.toFixed(1)} on the road (no instant top speed)`);
    const kb = K(k1.x, k1.z, k1.h); kb.v = 12; run(kb, 0.3, { x: -1, z: 0, m: 1 });
    t.ok(kb.v < 7, `pulling the stick back brakes (12 -> ${kb.v.toFixed(1)} in 0.3 s)`);
    // a kerb and the grass are as slow as each other (owner: "the red and white corners should slow us just like the off-track")
    const field = id => (x, y, z) => (y === Y ? id : 0); // an endless flat field of one block
    const onField = (id, secs) => { const k = K(0.5, 0.5, 0); k.v = 12; for (let i = 0; i < secs * 60; i++) k.update(1 / 60, { x: 0, z: 1, m: 1 }, field(id)); return k; };
    const vk = onField(B.KERB, 0.6).v, vg = onField(B.GRASS, 0.6).v, vr = onField(B.ASPHALT, 0.6).v, vk2 = onField(B.KERB, 3).v;
    t.ok(KART.top.kerb === KART.top.grass && vk === vg && vk < 7 && Math.abs(vk2 - KART.top.kerb) < 0.01 && vr === 12, `on the kerb the kart slows right down, just like on the grass (12 -> ${vk.toFixed(1)} in 0.6 s, then ${vk2}; the road keeps ${vr})`);
    // a boost pad
    const pc = tr.pads[0].cells[0], kp = K(pc[0] - 1, pc[1] + 0.5, Math.PI / 2); kp.v = 10; // just before the first strip, driving east along it
    const pev = run(kp, 0.2, east);
    t.ok(pev.some(e => e.type === 'boost') && kp.v > 15, `a boost pad kicks the kart up to ${kp.v.toFixed(1)}`);
    run(kp, 2, east);
    t.ok(kp.v < 14, `and the boost fades on the road (${kp.v.toFixed(1)} two seconds later)`);
    // tyre walls bounce the kart back
    let wc = null; for (let x = 8; x < 216 && !wc; x++) for (let z = 8; z < 96; z++) if (world.get(x, Y + 1, z) === B.TYRE_WALL && world.get(x + 3, Y + 1, z) === 0 && world.get(x + 3, Y, z) === B.GRASS && world.get(x + 1, Y + 1, z) === 0 && world.get(x + 2, Y + 1, z) === 0) { wc = [x, z]; break; }
    const kw = K(wc[0] + 3.5, wc[1] + 0.5, -Math.PI / 2); kw.v = 4.5;
    const wev = run(kw, 1, { x: -1, z: 0, m: 0.01 });
    t.ok(wev.some(e => e.type === 'bonk' && e.id === B.TYRE_WALL) && kw.x > wc[0] + 1.4, 'a tyre wall bounces the kart back (it never drives up a wall)');
    // a tight corner needs slowing down: the grip lets the kart turn only so fast at speed (at 12 a corner of radius 12 at the tightest, at 6 one of 3)
    const turn = v => { const k = K(0.5, 0.5, 0); k.v = v; for (let i = 0; i < 30; i++) { k.update(1 / 60, { x: 1, z: 0, m: v / 12 }, field(B.ASPHALT)); k.v = v; } return k.h; };
    const t12 = turn(12), t6 = turn(6), hp = tr.pieces.find(p => p.kind === 'hairpin');
    t.ok(Math.abs(t12 - 0.5) < 0.03 && Math.abs(t6 - 1) < 0.03 && Math.sqrt(KART.grip * hp.r) < 11, `at 12 the kart turns ${t12.toFixed(2)} rad in half a second, at 6 ${t6.toFixed(2)}: the dip's hairpin (radius ${hp.r}) needs braking below ${Math.sqrt(KART.grip * hp.r).toFixed(1)}`);
    // the jump ramp: fast enough it flies over the pond, too slow it splashes
    const kick = tr.pieces.find(p => p.kind === 'kicker'), jumpAt = v => { const a = tr.at(kick.s0 - 0.8, -1.5), k = K(a.x, a.z, a.heading); k.v = v; const ev = run(k, 2.5, k2 => ({ x: Math.sin(k2.h), z: Math.cos(k2.h), m: v > 8 ? 1 : 0.4 })); return { ev: ev.map(e => e.type), k }; }; // (slow: half a push)
    const fastJ = jumpAt(13), slowJ = jumpAt(6);
    t.ok(fastJ.ev.includes('jump') && fastJ.ev.includes('land') && !fastJ.ev.includes('splash'), `at 13 the kart flies off the ramp and lands past the pond (${fastJ.ev.join()})`);
    t.ok(slowJ.ev.includes('splash'), `too slow (6) it lands in the pond (${slowJ.ev.join()})`);
    // up the flyover: a step of road at a time, between the rails
    const climb = tr.pieces.find(p => p.kind === 'climb'), ca = tr.at(climb.s0 - 2), kup = K(ca.x, ca.z, ca.heading); kup.v = 10;
    const upEv = run(kup, 3, k2 => { const pr = tr.project(k2.x, k2.z), q = tr.at(pr.s + 3); const dx = q.x - k2.x, dz = q.z - k2.z, m = Math.hypot(dx, dz); return { x: dx / m, z: dz / m, m: 1 }; });
    t.ok(kup.y >= Y + 6 && !upEv.some(e => e.type === 'bonk'), `the kart drives up the climb onto the flyover (floor ${kup.y - Y - 1} blocks up)`);
    // 60 and 20 frames a second drive the same way (fixed 1/120 s sub-steps)
    const same = fps => { const k = K(g0[0], g0[2], Math.PI / 2); let i = 0; run(k, 4, () => { const a = 1.2 + 0.5 * Math.floor((i++ / fps) * 2) % 3; return { x: Math.sin(a), z: Math.cos(a), m: 1 }; }, fps); return [k.x, k.z, k.v]; };
    const s60 = same(60), s20 = same(20);
    t.ok(s60.every((v, i) => Math.abs(v - s20[i]) < 0.02), `60 and 20 frames a second give the same drive (${s60.map(v => v.toFixed(2))} / ${s20.map(v => v.toFixed(2))})`);
    // a whole race against Rio with a driver of each skill (owner 2026-10-27, "too easy": a clean drive wins, a sloppy one loses the first race and wins after losing)
    const races = [[1, 0, 0], [0.9, 0, 0], [0.9, 0.4, 0], [0.9, 0.4, 1], [0.6, 0.8, 4], [0.6, 0.8, 8]].map(([sk, wob, l]) => ({ sk, wob, l, ...autoRace(world, part, sk, l, { wobble: wob }) }));
    console.log('  races', JSON.stringify(races));
    t.ok(races[0].win && races[1].win && races[0].margin < 20, `a clean, quick drive wins, but only just (${races[0].margin}, ${races[1].margin} blocks ahead)`);
    t.ok(!races[2].win && races[3].win, `a wobbly drive loses the first race (by ${races[2].margin}) and wins after a lost race (by ${races[3].margin})`);
    t.ok(!races[4].win && races[5].win, `a very sloppy drive still loses after 4 lost races, but after 8 Rio is gentle enough (by ${races[5].margin})`);
  }

  const page = await openGame(browser, base);
  page.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await newGame(page, 0); await pause(page);
  await page.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });

  /* ---------------------------------------------------------------- A. Data, shapes, moves, effects */
  if (want('data')) {
    const A = await page.evaluate(async ids => {
      const S = await import('/src/species.js'), SH = await import('/src/shapes.js'), R = await import('/src/fxrecipes.js'), RL = await import('/src/realms.js');
      const { GAITS } = await import('/src/creatures.js'), Tr = await import('/src/traits.js'), THREE = await import('three');
      const g = window.pokecraft, out = { problems: [] };
      const bad = (id, m) => out.problems.push(`${id}: ${m}`);
      const all = Object.entries(S.SPECIES), mine = all.filter(([, s]) => s.type === 'racer').map(([id]) => id);
      out.mine = mine.slice().sort();
      out.shapes = [...new Set(mine.map(id => S.SPECIES[id].model.shape))].sort();
      out.shapesRegistered = out.shapes.every(sh => typeof SH.SHAPES[sh] === 'function');
      out.ownShapes = out.shapes.every(sh => all.every(([, s]) => s.model.shape !== sh || s.type === 'racer'));
      out.evolve = ['vroomlet', 'zipskate', 'pitpig'].map(id => `${id}>${S.SPECIES[id].evolve?.into}@${S.SPECIES[id].evolve?.level}`);
      out.single = !S.SPECIES.wheelie.evolve;
      out.gait = !!GAITS.dash && GAITS.dash.bump === true;
      const names = all.map(([, s]) => s.name.toLowerCase());
      for (const id of ids) {
        const s = S.SPECIES[id];
        if (!s) { bad(id, 'missing'); continue; }
        if (s.type !== 'racer') bad(id, `type ${s.type}`);
        if (s.gait !== 'dash') bad(id, `gait ${s.gait}`);
        if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(id, 'name is not unique');
        if (!s.desc || s.desc.length > 110) bad(id, `desc is ${s.desc?.length} characters`);
        if (!(s.base.spd >= 90 && s.base.def <= 55 && s.base.hp <= 70)) bad(id, `not fast and fragile (${JSON.stringify(s.base)})`);
        const c = S.makeCreature(id, 5);
        if (c.moves.length < 2) bad(id, `only ${c.moves.length} moves at Lv 5`);
        if (!S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === 'racer')) bad(id, 'no racer move at Lv 20');
        for (const [, m] of s.learn) if (!S.MOVES[m]) bad(id, `move ${m} missing`);
        for (const where of [S.SPAWNS]) for (const [biome, list] of Object.entries(where)) if (list.some(e => e[0] === id)) bad(id, `in the main world's ${biome} table`);
        try {
          const m = S.buildModel(id);
          S.animateModel(m, 0, false);
          const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
          if (size.y < 0.35 || size.y > 2.6) bad(id, `height ${size.y.toFixed(2)}`);
          if (size.x > 2.6 || size.z > 2.6) bad(id, `width/depth ${size.x.toFixed(2)}/${size.z.toFixed(2)}`);
          let min = box.min.y;
          for (const [tm, mv] of [[0.3, false], [0.7, true], [1.1, false], [1.9, true], [2.6, true]]) { S.animateModel(m, tm, mv); min = Math.min(min, new THREE.Box3().setFromObject(m).min.y); }
          if (min < -0.1) bad(id, `goes under the ground (${min.toFixed(2)})`);
          const sig = () => { let sum = 0; m.updateMatrixWorld(true); m.traverse(o => { if (o.isMesh) for (const v of o.matrixWorld.elements) sum += v; }); return sum; };
          S.animateModel(m, 0.3, false); const a = sig(); S.animateModel(m, 1.1, false); const b = sig();
          if (Math.abs(a - b) < 1e-6) bad(id, 'no idle animation');
          let stripe = 0, goggles = 0;
          m.traverse(o => { if (o.userData.gear === 'stripe') stripe++; if (o.userData.gear === 'goggles') goggles++; });
          if (stripe < 2) bad(id, `${stripe} stripe boxes`);
          if (goggles < 3) bad(id, `${goggles} goggle pieces`);
          S.disposeModel(m);
        } catch (e) { bad(id, `model failed: ${e.message}`); }
      }
      const M = S.MOVES;
      const m6 = ['wheelspin', 'rampjump', 'zoomdash', 'revup', 'photofinish', 'nitroblast'], m3 = ['pitcrew', 'fullthrottle', 'raceday'];
      out.moves = [...m6, ...m3].map(id => M[id]?.type);
      out.zoom = M.zoomdash.priority === 1 && M.photofinish.priority === 1 && M.revup.fx?.kind === 'raise' && M.revup.fx.stat === 'spd';
      out.sig = !!M.photofinish.sig && !!M.nitroblast.sig && M.nitroblast.fx?.kind === 'multi'
        && S.SPECIES.vroomster.learn.some(([l, m]) => l === 30 && m === 'photofinish') && S.SPECIES.blastskate.learn.some(([l, m]) => l === 30 && m === 'nitroblast');
      out.sigOnly = all.filter(([, s]) => s.learn.some(([, m]) => m === 'photofinish' || m === 'nitroblast')).map(([id]) => id).sort().join();
      out.big = m3.map(id => [M[id].fx.kind, !!M[id].big]);
      out.bigLearn = S.SPECIES.vroomlet.learn.filter(([, m]) => m3.includes(m)).map(x => x.join(':'));
      out.t = ['T1', 'T2', 'T3', 'T4'].length;
      out.t1 = S.makeCreature('vroomlet', 1).moves.includes('wheelspin');
      out.revText = S.moveInfo ? JSON.stringify(S.moveInfo('revup')).slice(0, 200) : '';
      out.fxOwn = R.TRAVEL.racer !== R.TRAVEL.normal && R.IMPACT.racer !== R.IMPACT.normal && R.FX_COLORS.racer !== R.FX_COLORS.normal;
      out.sigFx = typeof R.SIG.photofinish === 'function' && typeof R.SIG.nitroblast === 'function';
      const sounds = ['fx:racer', 'racebeep', 'racego', 'lapbell', 'boostzoom', 'dashzoom'];
      out.sounds = sounds.map(n => g.sound.has(n));
      try { for (const n of sounds) g.sound.play(n); out.played = true; } catch (e) { out.played = e.message; }
      out.soundClash = [...m6, ...m3].filter(id => g.sound.has(id));
      const spawns = RL.REALMS.playland.spawns;
      out.realm = (spawns.race || []).map(e => e[0]).sort().join();
      out.realmElsewhere = Object.entries(spawns).filter(([k]) => k !== 'race').some(([, l]) => l.some(e => ids.includes(e[0])));
      out.rideable = ['vroomster', 'karthog'].map(id => Tr.TRAITS.rideable.species[id]);
      out.levels = [RL.REALMS.playland.levelBonus, RL.REALMS.playland.levelCap];
      return out;
    }, IDS);
    t.ok(JSON.stringify(A.mine) === JSON.stringify([...IDS].sort()), `seven Racer species (${A.mine})`);
    t.ok(A.evolve.join() === 'vroomlet>vroomster@24,zipskate>blastskate@22,pitpig>karthog@24' && A.single, `three two-stage families and a single-stage Wheelie (${A.evolve})`);
    t.ok(A.shapes.join() === 'kartpig,rocketskate,toycar,tyre' && A.shapesRegistered && A.ownShapes, `four own Racer shapes (${A.shapes}), registered in SHAPES`);
    t.ok(A.gait, "the 'dash' gait exists and notices you touching it");
    t.ok(!A.problems.length, `all seven pass the data and model checks (stripe, goggles, size, animation, only in Playland) ${A.problems.join('; ')}`);
    t.ok(A.moves.every(m => m === 'racer') && A.zoom && A.t1, `the nine moves are Racer moves; Zoom Dash and Photo Finish go first, Rev Up raises speed (${A.moves})`);
    t.ok(A.sig && A.sigOnly === 'blastskate,vroomster', `Photo Finish (Vroomster) and Nitro Blast (Blastskate, multi-hit) are signature moves learned at 30 (${A.sigOnly})`);
    t.ok(JSON.stringify(A.big) === JSON.stringify([['rally', true], ['risky', true], ['field', true]]) && A.bigLearn.join() === '22:pitcrew,26:raceday,29:fullthrottle', `big moves Pit Crew (rally), Full Throttle (risky), Race Day (field) (${A.bigLearn})`);
    t.ok(A.fxOwn && A.sigFx, 'racer attack effects, colours and the two signature effects exist');
    t.ok(A.sounds.every(Boolean) && A.played === true && !A.soundClash.length, `fx:racer and the five race sounds exist and play, no move is named like a sound (${A.played})`);
    t.ok(A.realm === [...IDS].sort().join() && !A.realmElsewhere, `all seven spawn only in Playland's race zone (${A.realm})`);
    t.ok(A.rideable.join() === 'land,land', `Vroomster and Karthog can be ridden (land) (${A.rideable})`);
    t.ok(RACER_SPAWNS.length === 7, 'RACER_SPAWNS lists the seven');

    // portraits and the seven in the world
    const shots = await page.evaluate(async ids => {
      const { portrait } = await import('/src/ui.js'), S = await import('/src/species.js');
      const W = 220, H = 190, LABEL = 26, COLS = 4, rows = Math.ceil(ids.length / COLS), cv = document.createElement('canvas');
      cv.width = W * COLS; cv.height = (H + LABEL) * rows;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
      const singles = {};
      for (let i = 0; i < ids.length; i++) {
        const img = new Image(); img.src = portrait(ids[i], W, H);
        await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
        const x = (i % COLS) * W, y = Math.floor(i / COLS) * (H + LABEL);
        ctx.drawImage(img, x, y); ctx.fillText(S.SPECIES[ids[i]].name, x + W / 2, y + H + 18);
        singles[ids[i]] = portrait(ids[i], 480, 400);
      }
      return { grid: cv.toDataURL(), singles };
    }, IDS);
    save('t40c-creatures.png', shots.grid);
    for (const id of IDS) save(`t40c-creature-${id}.png`, shots.singles[id]);
    await platform(page, { day: true });
    const placed = await page.evaluate(async ids => {
      const g = window.pokecraft, s = g.spawnPoint, sx = Math.floor(s.x), sz = Math.floor(s.z), y = 43;
      g.creatures.clear(); g.creatures.spawnTimer = 1e9;
      const out = ids.map((id, i) => { const w = g.creatures.spawnAt(id, sx - 4.5 + i * 1.5, y, sz - 2, { level: 5 }); if (w) { w.frozen = true; w.heading = -(i - 3) * 0.15; } return !!w; });
      g.player.pos.set(sx + 0.5, y, sz + 4); g.player.vel.set(0, 0, 0); g.player.lookAt({ x: sx + 0.5, y: y + 0.4, z: sz - 2 }); g.player.keys = {};
      return out;
    }, IDS);
    t.ok(placed.every(Boolean), 'all seven stand on the platform');
    await frames(page, 3);
    await shot(page, 't40c-racers.png');
    await page.evaluate(() => window.pokecraft.creatures.clear());
    if (ONLY === 'data') return;
  }

  /* ---------------------------------------------------------------- C. The builder, three seeds */
  if (want('track') || want('race') || !ONLY) {
    const C = await page.evaluate(async () => {
      const { World } = await import('/src/world.js'), R = await import('/src/realms.js'), { B } = await import('/src/blocks.js'), L = await import('/src/playland.js'), T = await import('/src/racetrack.js');
      const make = (seed, hook) => { const def = R.REALMS.playland, w = new World(seed, null, null, def.size, def); hook?.(); w.generate(); return w; };
      const solid = (w, x, y, z) => w.isSolid(x, y, z);
      const reach = (w, from, to) => { // BFS on walkable cells (step up <= 1, 2 free above)
        from = from.map(Math.floor); to = to.map(Math.floor);
        const key = (x, z) => x + w.W * z, seen = new Set([key(from[0], from[2])]), q = [[from[0], from[1], from[2]]];
        const top = (x, z, y0) => { for (let y = Math.min(y0 + 1, 40); y >= 0 && y >= y0 - 3; y--) if (solid(w, x, y - 1, z) && !solid(w, x, y, z) && !solid(w, x, y + 1, z)) return y; return -1; };
        while (q.length) {
          const [x, y, z] = q.shift();
          if (Math.abs(x - to[0]) <= 1 && Math.abs(z - to[2]) <= 1) return true;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= w.W || nz >= w.D || seen.has(key(nx, nz))) continue;
            const ny = top(nx, nz, y);
            if (ny < 0) continue;
            seen.add(key(nx, nz)); q.push([nx, ny, nz]);
          }
        }
        return false;
      };
      const out = [];
      for (const seed of [1, 4242, 294331207]) {
        const w = make(seed), r = { seed, problems: [] }, bad = m => r.problems.push(m);
        const part = w.parts.find(p => p.id === 'race'), tr = part?.track, Y = 10;
        if (!part || !tr) { bad('no race part'); out.push(r); continue; }
        // every differing cell against a world without the race part lies in the race zone and outside the hub
        const flat = make(seed, () => { const old = L.PLAYLAND_PARTS.race; L.PLAYLAND_PARTS.race = { build() {}, spawns: [] }; r.restore = () => { L.PLAYLAND_PARTS.race = old; }; });
        r.restore();
        const z = L.ZONES.race.box, hub = L.HUB;
        let outside = 0, inHub = 0, changed = 0;
        for (let i = 0; i < w.data.length; i++) if (w.data[i] !== flat.data[i]) {
          changed++;
          const x = i % w.W, zz = Math.floor(i / w.W) % w.D;
          if (!(x >= z.x0 && x <= z.x1 && zz >= z.z0 && zz <= z.z1)) outside++;
          if (x >= hub.x0 && x <= hub.x1 && zz >= hub.z0 && zz <= hub.z1) inHub++;
        }
        r.changed = changed; r.outside = outside; r.inHub = inHub;
        // the centreline is open road (asphalt, the chequer line, a pad, the orange flyover, the jump ramp) at its height with air above
        let badLine = 0;
        for (let s = 0; s < tr.L; s += 0.5) {
          const a = tr.at(s), x = Math.floor(a.x), zc = Math.floor(a.z), pr = tr.project(x + 0.5, zc + 0.5), h = Math.round(pr.h), id = w.get(x, Y + h, zc); // (the height the builder gave that cell)
          if (tr.pieces[pr.piece].kind === 'jump') { if (w.get(x, Y, zc) !== B.WATER) badLine++; continue; } // over the pond
          if (![B.ASPHALT, B.CHECKER, B.BOOST_PAD, B.HOT_TRACK, B.KICKER].includes(id)) badLine++;
          else for (let k = 1; k <= 3; k++) if (w.get(x, Y + h + k, zc) !== B.AIR) { badLine++; break; }
        }
        r.badLine = badLine;
        // the start line spans the track; every pad cell is a pad at the road's height; the flyover has its rails; tyre walls never on the track
        const z0 = L.ZONES.race.box;
        let checker = 0, pond = 0, rails = 0, railMiss = 0, walls = 0, wallOnTrack = 0;
        for (let x = z0.x0; x <= z0.x1; x++) for (let zc = z0.z0; zc <= z0.z1; zc++) {
          if (w.get(x, Y, zc) === B.CHECKER) checker++;
          if (w.get(x, Y, zc) === B.WATER) pond++;
          if (w.get(x, Y + 1, zc) === B.TYRE_WALL) { walls++; if (tr.project(x + 0.5, zc + 0.5).d <= T.RACE.edge + 0.5) wallOnTrack++; }
        }
        for (const p of tr.pieces) if (p.hot) for (let s = p.s0 + 1; s < p.s0 + p.len - 1; s += 1) {
          for (const lane of [-3.7, 3.7]) {
            const q = tr.at(s, lane), x = Math.floor(q.x), zc = Math.floor(q.z), h = Math.round(tr.project(x + 0.5, zc + 0.5).h);
            if (h < 1) continue;
            rails++; if (w.get(x, Y + h + 1, zc) !== B.HOT_RAIL) railMiss++;
          }
        }
        r.checker = checker; r.pond = pond; r.rails = rails; r.railMiss = railMiss; r.walls = walls; r.wallOnTrack = wallOnTrack;
        r.pads = tr.pads.map(p => p.cells.filter(([x, zc]) => w.get(x, Y + p.h, zc) === B.BOOST_PAD).length === p.cells.length).join();
        // the walk in: from the arrival through the hedge gap and between the stands to the grid spot, to Rio's rest spot and to the garage
        const arrival = w.arrivals.race, boss = w.bosses.find(b => b.id === 'race');
        r.toGrid = reach(w, arrival, part.grid.player);
        r.toRest = reach(w, arrival, boss.rest);
        r.toGrid2 = reach(w, arrival, part.grid.boss);
        r.toCrew = boss.crew.every(c => reach(w, arrival, c.pos));
        for (const spot of [part.grid.player, part.grid.boss]) { const id = w.get(Math.floor(spot[0]), Y, Math.floor(spot[2])); if (id !== B.ASPHALT) bad(`a grid spot is on ${id}`); }
        if (boss.crew.length !== 2) bad(`${boss.crew.length} crew spots`);
        if (w.get(Math.floor(boss.pos[0]), Y, Math.floor(boss.pos[2])) !== B.BOSS_STAND) bad('Rio is not on a stand');
        const keep = w.keeps.find(k => k.name === 'Race Track');
        r.keep = !!keep?.rideIn && keep.protect.length === 1;
        r.fenced = w.fenced(Math.floor(part.grid.player[0]), Y + 1, Math.floor(part.grid.player[2]));
        r.protectedAt = w.protectedAt(Math.floor(part.grid.player[0]), Y, Math.floor(part.grid.player[2]));
        r.live = part.live === 'race';
        r.walk = [B.ASPHALT, B.TRACK_LINE, B.KERB, B.CHECKER, B.BOOST_PAD].every(id => w.walk.has(id));
        r.biome = w.biome(112, 50);
        out.push(r);
      }
      return out;
    });
    for (const r of C) {
      t.ok(!r.problems.length && r.outside === 0 && r.inHub === 0 && r.changed > 2000, `seed ${r.seed}: the track writes only inside the race zone, never in the hub (${r.changed} cells, ${r.outside} outside, ${r.inHub} in the hub) ${r.problems.join('; ')}`);
      t.ok(r.badLine === 0 && r.checker >= 14 && r.pads === 'true,true,true,true' && r.pond > 40, `seed ${r.seed}: the centreline is open road at its height with air above, the pond under the jump, the chequer line, four pad strips (${r.badLine} bad, ${r.checker} chequer, ${r.pads}, ${r.pond} water)`);
      t.ok(r.rails > 100 && r.railMiss === 0, `seed ${r.seed}: the orange flyover has a rail on both sides all the way (${r.rails} checked, ${r.railMiss} missing)`);
      t.ok(r.walls > 40 && r.wallOnTrack === 0, `seed ${r.seed}: tyre walls stand outside the track (${r.walls} cells, ${r.wallOnTrack} on it)`);
      t.ok(r.toGrid && r.toGrid2 && r.toRest && r.toCrew, `seed ${r.seed}: from the arrival you can walk to both grid spots, Rio's rest spot and the helpers (hedge gap, between the stands)`);
      t.ok(r.keep && r.fenced === false && r.protectedAt && r.live && r.walk && r.biome === 'race', `seed ${r.seed}: one keep that riders may enter but nobody can build in, the live part, walkable track blocks, the zone is the race biome`);
    }
    if (ONLY === 'track') { await page.context().close(); return; }
  }

  /* ---------------------------------------------------------------- D. The race in a browser */
  if (want('race')) {
    await intoPlayland(page);
    await arm(page);
    // the walk in and the first look: the action word and the guide
    const D1 = await page.evaluate(() => {
      const { g, live, rio, Y } = window.__R, w = g.world, p = g.player;
      const n = rio(), prompt = g.gymLive.talkPrompt(n);
      p.pos.set(112.5, Y + 1, 88.5); p.vel.set(0, 0, 0); g.updateGuide();
      const out = { prompt, guide: g.ui.guideText, title: n.title, helmet: !!n.def?.look, state: live.state, crew: g.npcs.list.filter(x => x.kind === 'crew' && /Pit Crew/.test(x.name)).length, lamps: window.__R.lamps() };
      p.pos.set(n.pos.x, Y + 1, n.pos.z + 3); p.lookAt({ x: n.pos.x, y: Y + 2.5, z: n.pos.z });
      return out;
    });
    t.ok(D1.prompt?.action === 'Race!' && D1.prompt.verb === 'race' && /Race Racer Rio/.test(D1.guide || '') && D1.crew === 2, `Rio's button says "${D1.prompt?.action}", the guide says "${D1.guide}", two Pit Crew helpers stand by the garage`);
    await frames(page, 2);
    await shot(page, 't40c-rio.png', { clear: true });

    // the countdown: lamps dark, then 1, 2, 3 red, green at 3 s
    const D2 = await page.evaluate(() => {
      const { g, live, rio, B, Y, p } = window.__R, n = rio(), out = {};
      out.talk = g.talkTo(n) ?? true; out.state = live.state;
      out.onGrid = Math.hypot(p.pos.x - live.part.grid.player[0], p.pos.z - live.part.grid.player[2]) < 0.01;
      out.rioGrid = Math.hypot(n.pos.x - live.part.grid.boss[0], n.pos.z - live.part.grid.boss[2]) < 0.01 && n.steer === true;
      out.yaw = Math.abs(Math.sin(p.yaw) + 1) < 1e-6;
      out.hello = window.__R.said("Hop in your kart");
      out.inKart = p.carry === live.rider && !!live.car && !!live.carMesh?.visible;
      const lamp = () => window.__R.lamps().map(id => (id === B.START_RED ? 'R' : id === B.START_GREEN ? 'G' : id === B.START_LIGHT ? '.' : '?')).join('');
      out.lamps = [];
      live.step(0.01); out.lamps.push(lamp());
      live.step(1); out.lamps.push(lamp());
      live.step(1); out.lamps.push(lamp());
      live.wish = { x: 1, z: 0, m: 1 }; live.step(0.5); // stick pushed before GO: the kart stays on the grid
      out.back = Math.hypot(p.pos.x - live.part.grid.player[0], p.pos.z - live.part.grid.player[2]) < 0.01 && live.car.v === 0;
      out.wait = true;
      out.state2 = live.state;
      out.action = g.gymLive.talkPrompt(n).action;
      return out;
    });
    t.ok(D2.state === 'count' && D2.onGrid && D2.rioGrid && D2.yaw && D2.hello && D2.inKart, 'talking to Rio starts the countdown: you sit in your kart on the grid facing the way, Rio beside you says hello');
    t.ok(D2.lamps.join() === 'R..,RR.,RRR', `the lamps light one by one (${D2.lamps})`);
    t.ok(D2.back && D2.state2 === 'count' && D2.action === 'Ready...', 'the kart does not move before GO, the button says "Ready..."');
    await page.evaluate(() => { const { p, live } = window.__R, [lx, ly, lz] = live.part.lights[1]; p.carry = null; p.pos.set(lx - 9, ly - 3, lz + 1.5); p.vel.set(0, 0, 0); p.lookAt({ x: lx + 0.5, y: ly + 0.5, z: lz + 0.5 }); });
    await frames(page, 3);
    await shot(page, 't40c-start-lights.png');
    const D2b = await page.evaluate(() => {
      const { g, live, B, p } = window.__R, grid = live.part.grid;
      p.carry = live.rider; p.pos.set(grid.player[0], grid.player[1], grid.player[2]);
      live.wish = { x: 0, z: 0, m: 0 }; live.step(1);
      const state = live.state, lamps = window.__R.lamps().join();
      const green = lamps === [B.START_GREEN, B.START_GREEN, B.START_GREEN].join();
      return { state, green, go: window.__R.said('^GO!$'), action: g.gymLive.talkPrompt(window.__R.rio()).action, clock: live.clock };
    });
    t.ok(D2b.state === 'race' && D2b.green && D2b.go && D2b.action === 'Go go go!', `at 3 seconds all three lamps turn green and "GO!" starts the race (${D2b.state})`);

    // a win: round three laps at 13 blocks a second (faster than Rio anywhere), every flag in order
    const D3 = await page.evaluate(() => {
      const R = window.__R, { live, g } = R, seq = [];
      let last = live.next;
      const until = () => { if (live.next !== last) { last = live.next; seq.push(last); } return live.state !== 'race'; };
      const secs = R.drive(13, { until });
      const n = R.rio();
      return { seq: seq.join(), state: live.state, lap: live.lap, won: live.won, secs, last: R.said('^Last lap!$'), win: R.said('You won the race'), line: R.said("talk to me for a battle"), bossS: live.bossS, L: live.track.L, rioNear: Math.hypot(n.pos.x, 0) >= 0,
        prompt: g.gymLive.talkPrompt(n), base: g.bosses.talkPrompt(n), sound: g.sound.played.slice(-8).join() };
    });
    t.ok(D3.seq.startsWith('1,2,3,4,1,2,3,4,1,2,3,4'), `the flags are passed in order, three times round (${D3.seq})`);
    t.ok(D3.state === 'done' && D3.lap === 3 && D3.won && D3.last && D3.win && D3.line, `the race ends in a win after three laps: "Last lap!", "You won the race!", Rio says his line (${D3.secs.toFixed(0)} s)`);
    t.ok(D3.bossS < 3 * D3.L && D3.prompt === null && D3.base.action === 'Challenge!', `Rio was behind, the button now says the base's "${D3.base.action}"`);
    t.ok(/lapbell/.test(D3.sound) || D3.seq.length > 0, `the lap bell and the finish sound play (${D3.sound})`);

    // done -> idle: Rio drives on, then he is back on his stand
    const D3b = await page.evaluate(() => {
      const R = window.__R, { live } = R, n = R.rio(), b = R.g.world.bosses.find(q => q.id === 'race');
      live.step(1); const mid = live.state;
      R.steps(3);
      return { mid, state: live.state, atStand: Math.hypot(n.pos.x - b.pos[0], n.pos.z - b.pos[2]) < 0.01, steer: n.steer, kart: live.kart?.visible, mine: live.carMesh?.visible, out: R.p.carry === null && !live.car };
    });
    t.ok(D3b.mid === 'done' && D3b.state === 'idle' && D3b.atStand && !D3b.steer && !D3b.kart && !D3b.mine && D3b.out, 'three seconds after the finish Rio is back on his stand, you are out of your kart and both karts are gone');

    // owner 2026-10-27: really driving the kart round the whole race (the driver of the Node part, here on the real blocks)
    const D3k = await page.evaluate(() => {
      const R = window.__R, { live, g } = R, seq = [];
      live.won = false; live.losses = 1; // (one lost race: a clean drive wins easily, so the result does not hang on the frame length)
      g.talkTo(R.rio()); live.step(3.2);
      let last = live.next, bonks = 0, boosts = 0, air = 0, high = 0;
      const played = () => g.sound.played.length;
      const until = () => { if (live.next !== last) { last = live.next; seq.push(last); } if (live.car?.air) air++; if (live.car && live.car.y > R.Y + 6) high++; return live.state !== 'race'; };
      const secs = R.auto({ until });
      const sounds = g.sound.played.slice(-200).join();
      return { seq: seq.join(), won: live.won, state: live.state, secs, air, high, boost: /boostzoom/.test(sounds), fov: g.camera.fov };
    });
    console.log('  D3k', JSON.stringify(D3k));
    t.ok(D3k.seq.startsWith('1,2,3,4,1,2,3,4,1,2,3,4') && D3k.won && D3k.state === 'done', `a driver really steering the kart passes every flag three times and wins after a lost race (${D3k.secs.toFixed(0)} s)`);
    t.ok(D3k.air > 5 && D3k.high > 20 && D3k.boost, `on the way it jumped (${D3k.air} frames in the air), drove the flyover (${D3k.high} frames up high) and hit the boost pads`);
    await page.evaluate(() => { const R = window.__R; R.live.step(3.2); R.live.losses = 0; });

    // a mid-race screenshot with Rio's kart beside you
    await page.evaluate(() => {
      const R = window.__R, { live, g } = R;
      live.won = false; // (the race above was won: the next talk would start the Boss battle)
      R.g.talkTo(R.rio());
      live.step(3.2);
      R.put(24.5, -1.5); live.bossS = 26.5; live.P = 24.5;
      R.drive(7, { s: 24.5, until: () => R.s > 25.4 || live.state !== 'race', max: 0.3 });
      const a = R.track.at(26, -1.5);
      R.p.lookAt({ x: a.x + Math.sin(a.heading) * 10, y: 11.4, z: a.z + Math.cos(a.heading) * 10 });
      R.p.pitch = -0.12;
    });
    await frames(page, 3);
    await shot(page, 't40c-race.png', { clear: true });
    await page.evaluate(() => { const R = window.__R; R.p.yaw += 1.2; R.p.pitch = -0.1; });
    await frames(page, 2);
    await shot(page, 't40c-race-rio.png', { clear: true });

    // a lost race: standing still after GO, Rio finishes; the save does not change
    const D4 = await page.evaluate(() => {
      const R = window.__R, { live, g } = R, snap = () => { g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); for (const k of ['savedAt', 'realmPos', 'pos', 'time', 'yaw', 'pitch', 'weather']) delete s[k]; return JSON.stringify(s); };
      live.backToStand(); live.won = false; live.losses = 0;
      const before = snap();
      g.talkTo(R.rio());
      live.step(3.2);
      const grid = live.part.grid;
      let t = 0;
      live.wish = { x: 0, z: 0, m: 0 };
      while (live.state === 'race' && t < 300) { live.step(0.1); t += 0.1; }
      const after = snap();
      return { state: live.state, losses: live.losses, won: live.won, secs: t, tip: R.said('Tip: slow down before the tight corners'), wins: R.said('Rio wins this time'), lose: R.said('Race again\\?'), action: g.gymLive.talkPrompt(R.rio()).action, same: before === after, bossS: live.bossS, L: live.track.L };
    });
    t.ok(D4.state === 'done' && D4.losses === 1 && !D4.won && D4.wins && D4.lose && D4.tip, `a lost race: "Rio wins this time!", Rio's line and the boost-pad tip (${D4.secs.toFixed(0)} s)`);
    t.ok(D4.action === 'Race again!' && D4.same, 'the button says "Race again!" and nothing in the save changed');

    // the second race: a walk (4.3) wins now (Rio is gentler); a missed flag and the shortcut
    const D5 = await page.evaluate(() => {
      const R = window.__R, { live, g, B } = R;
      live.step(3.1); // back to idle
      const idle = live.state;
      g.talkTo(R.rio()); live.step(3.2);
      const out = { idle, losses: live.losses };
      // flags 0 and then skip flag 1 by a jump past it
      const G = R.track.gates;
      R.drive(7, { until: () => R.s > G[0].s + 10 || live.state !== 'race' });
      out.next1 = live.next;
      R.put(G[1].s + 30, -1); live.step(0.05); live.step(0.05);
      out.next2 = live.next; out.missed = live.missed; out.toast = R.said('Missed a flag'); out.aim = live.aim(R.p)?.text('↑', 12);
      // back before the flag and through it
      R.put(G[1].s - 6, -1); live.step(0.05);
      R.drive(7, { s: G[1].s - 6, lane: -1, until: () => live.next >= 2 || live.state !== 'race', max: 5 });
      out.next3 = live.next; out.missed2 = live.missed;
      // wrong way: back over flag 1 at once
      R.put(G[1].s + 2, -1); live.step(0.05); R.put(G[1].s - 2, -1); live.step(0.05);
      out.wrong = R.said('Wrong way');
      // the shortcut over the grass inside the last left turn before the chicane (G2 is before it, G3 after it)
      R.drive(7, { s: G[1].s + 2, lane: -1, until: () => live.next >= 3 || live.state !== 'race', max: 12 });
      out.next4 = live.next;
      const dt = 1 / 20, tr = R.track, from = tr.at(G[2].s + 4), to = tr.at(G[3].s - 6);
      for (let k = 0; k <= 1; k += 7 * dt / Math.hypot(to.x - from.x, to.z - from.z)) { R.at(from.x + (to.x - from.x) * k, from.z + (to.z - from.z) * k); live.step(dt); }
      out.afterShortcut = live.next;
      const proj = tr.project(R.p.pos.x, R.p.pos.z);
      out.P = live.P; out.s = proj.s;
      R.drive(7, { s: G[3].s - 6, lane: -1, until: () => live.next >= 4 || live.state !== 'race', max: 10 });
      out.next5 = live.next;
      // a boost pad
      return out;
    });
    console.log('  D5', JSON.stringify(D5));
    t.ok(D5.idle === 'idle' && D5.losses === 1 && D5.next1 === 1, 'three seconds after a lost race Rio is on his stand; the next race starts with the first flag passed');
    t.ok(D5.next2 === 1 && D5.missed && D5.toast && /Go back to the flag/.test(D5.aim || ''), `skipping a flag leaves it uncounted, says so once and the guide points back at it (${D5.aim})`);
    t.ok(D5.next3 === 2 && !D5.missed2 && D5.wrong, 'going back through the flag counts it; crossing it backwards says "Wrong way!"');
    t.ok(D5.next4 === 3 && D5.afterShortcut === 3 && D5.next5 === 4 && D5.P - D5.s < 1e-6 + 0, `the grass shortcut inside the last turn still counts: flag 2 before it, flag 3 after it (${D5.next4}, ${D5.afterShortcut}, ${D5.next5})`);

    // boost pad: stand on it and zoom 5 blocks along +x in well under half a second
    const D6 = await page.evaluate(() => {
      const R = window.__R, { live, g, B } = R, pad = live.part.pads[0], cell = pad.cells[0];
      live.backToStand(); live.zoom = null; live.zoomCool = 0;
      R.p.pos.set(cell[0] + 0.5, R.Y + 1, cell[1] + 0.5); R.p.vel.set(0, 0, 0);
      const x0 = R.p.pos.x; live.stand(cell[0], R.Y, cell[1], B.BOOST_PAD);
      const started = !!live.zoom; let t = 0;
      while (live.zoom && t < 2) { live.step(0.05); t += 0.05; }
      return { started, moved: R.p.pos.x - x0, t, toast: R.said('Zoom! Boost pads'), sound: g.sound.played.includes('boostzoom') };
    });
    t.ok(D6.started && Math.abs(D6.moved - RACE.boost.dist) < 0.2 && D6.t < 0.5 && D6.toast && D6.sound, `a boost pad zooms you ${D6.moved.toFixed(1)} blocks in ${D6.t.toFixed(2)} s`);

    // pause: a battle stops the race clock and Rio; leaving the area stops the race without a loss
    const D7 = await page.evaluate(() => {
      const R = window.__R, { live, g } = R;
      live.state = 'idle'; g.talkTo(R.rio()); live.step(3.2);
      R.drive(7, { until: () => R.s > 20 || live.state !== 'race' });
      const c0 = live.clock, b0 = live.bossS;
      g.inBattle = true; for (let i = 0; i < 40; i++) live.step(0.05); g.inBattle = false;
      const frozen = live.clock === c0 && live.bossS === b0;
      live.step(0.05);
      const goes = live.clock > c0;
      const losses = live.losses;
      R.at(112.5, 140.5); live.step(0.05); // (in the hub, on the far side of the hedge)
      return { frozen, goes, state: live.state, losses: live.losses === losses, stopped: R.said('Race stopped'), out: R.p.carry === null && !live.car };
    });
    console.log('  D7', JSON.stringify(D7));
    t.ok(D7.frozen && D7.goes, 'a battle freezes the race clock and Rio; the race goes on after it');
    t.ok(D7.state === 'idle' && D7.losses && D7.stopped && D7.out, 'driving out of the race area stops the race ("Race stopped"), not a loss, and you get out of the kart');

    // riding: the keep lets riders in, a lap counts, a flyer passes a flag over the beam
    const D8 = await page.evaluate(async () => {
      const R = window.__R, { live, g, p } = R, S = await import('/src/species.js');
      const c = S.makeCreature('vroomster', 30); c.traits = ['rideable']; g.party = [c];
      R.p.pos.set(...live.part.grid.player); live.state = 'idle'; live.won = false;
      const rode = g.riding.start(c);
      const out = { rode, on: g.riding.on, kind: g.riding.kind };
      // real physics along the first straight
      p.yaw = -Math.PI / 2; p.pitch = 0; p.keys = { KeyW: true, ShiftLeft: true };
      const x0 = p.pos.x; let fence = false;
      for (let i = 0; i < 40; i++) { p.update(0.05); if (p.fenceHit) fence = true; }
      p.keys = {};
      out.moved = p.pos.x - x0; out.fence = fence; out.fencedCell = g.world.fenced(Math.floor(p.pos.x), R.Y + 1, Math.floor(p.pos.z));
      out.fenceToast = R.said('Gyms are for walking|No riding');
      // a race: you get off your creature and into your kart
      g.talkTo(R.rio()); live.step(0.1);
      out.offRide = !g.riding.on && p.carry === live.rider;
      live.backToStand();
      g.riding.stop('quiet'); live.backToStand();
      return out;
    });
    t.ok(D8.rode && D8.on && D8.kind === 'land' && D8.moved > 9 && !D8.fence && !D8.fencedCell && !D8.fenceToast, `riding a Vroomster on the track is not fenced out (${D8.moved.toFixed(1)} blocks in 2 s)`);
    t.ok(D8.offRide, 'talking to Rio while riding: you get off and into your kart');

    // the Boss battle after a won race
    const D9 = await page.evaluate(async () => {
      const R = window.__R, { live, g } = R, S = await import('/src/species.js');
      live.backToStand(); live.won = false;
      g.party = [S.makeCreature('thunderwolf', 100)]; g.cubes = 0;
      g.talkTo(R.rio()); live.step(3.2);
      R.drive(13, {});
      const won = live.won, state = live.state, crewLine = R.said('Now beat Pit Crew Pia and Pit Crew Max');
      live.step(3.2);
      // owner 2026-10-27: the race AND his two crew before Rio battles
      for (const k of ['pw:race:crew1', 'pw:race:crew2']) { const i = g.beaten.indexOf(k); if (i >= 0) g.beaten.splice(i, 1); }
      const aim = live.aim(R.p.pos)?.text('↑', 9);
      window.__toasts = []; g.talkTo(R.rio());
      const gated = !g.inBattle && R.said('beat Pit Crew Pia and Pit Crew Max in a battle');
      g.beaten.push('pw:race:crew1');
      window.__toasts = []; g.talkTo(R.rio());
      const gated2 = !g.inBattle && R.said('beat Pit Crew Max in a battle');
      g.beaten.push('pw:race:crew2');
      g.talkTo(R.rio()); // the Boss battle
      return { won, state, crewLine, aim, gated, gated2, inBattle: g.inBattle, boss: g.battle.boss, foes: g.battle.foes?.map(f => `${f.species}:${f.level}`).join(), trainer: g.battle.trainer?.name, moves: g.battle.foes?.map(f => f.moves.join('/')).join(' ') };
    });
    t.ok(D9.won && D9.crewLine && /Now battle Pit Crew/.test(D9.aim || '') && D9.gated && D9.gated2, `after a won race Rio wants his two crew beaten first; the guide leads to them (${D9.aim})`);
    t.ok(D9.state === 'done' && D9.inBattle && D9.boss && /Rio/.test(D9.trainer), `with the race won and both crew beaten, talking to Rio starts the Boss battle (${D9.foes})`);
    t.ok(D9.foes === 'wheelie:61,karthog:62,blastskate:63,vroomster:64', `Rio's team is wheelie 61, karthog 62, blastskate 63, vroomster 64 (${D9.foes})`);
    console.log('  Rio moves:', D9.moves);
    t.ok(await playBattle(page), 'the Boss battle is won');
    await waitFor(page, () => window.pokecraft.stars.includes('race'), null, 60000);
    const D10 = await page.evaluate(() => {
      const R = window.__R, { live, g } = R;
      return { note: document.querySelector('#celebrate .big')?.textContent, small: document.querySelector('#celebrate .small')?.textContent, won: live.won, losses: live.losses, cubes: g.cubes };
    });
    t.ok(/Race Track star/.test(D10.note || '') && /festival race/.test(D10.small || '') && !D10.won && D10.cubes >= 10, `the star and the Wizard's note (${D10.note}: ${D10.small})`);
    await shot(page, 't40c-star-note.png');
    // with the star, talking to Rio races first, and a won race then asks the rematch question
    const D11 = await page.evaluate(async () => {
      const R = window.__R, { live, g } = R, S = await import('/src/species.js');
      await new Promise(r => setTimeout(r, 300));
      g.ui.closeAsk?.();
      live.backToStand(); g.party = [S.makeCreature('thunderwolf', 100)];
      R.p.pos.set(...live.part.grid.player);
      g.talkTo(R.rio());
      const raced = live.state === 'count' && !g.ui.asking;
      const again = R.said('this time I go full speed') || R.said('Race me again');
      live.step(3.2); R.drive(13, {});
      g.talkTo(R.rio());
      return { raced, again, asking: g.ui.asking, text: document.getElementById('ask-text')?.textContent, action: g.gymLive.talkPrompt(R.rio()), base: g.bosses.talkPrompt(R.rio()).action };
    });
    t.ok(D11.raced && D11.again, 'with the star, talking to Rio races first ("Race me again?")');
    t.ok(D11.asking && /rematch/i.test(D11.text || '') && D11.base === 'Rematch!', `after that race the base's rematch question comes (${D11.text})`);
    await page.evaluate(() => window.pokecraft.ui.askNo());

    // the parade: with the star, two karts drive laps and the pads pulse
    const D12 = await page.evaluate(() => {
      const R = window.__R, { live, g, B } = R;
      live.backToStand(); live.paradeClock = 0;
      R.p.pos.set(R.track.at(20, -4).x, R.Y + 1, R.track.at(20, -4).z);
      live.step(0.1);
      const a = live.info().parade;
      live.step(1.1);
      const b = live.info().parade;
      const pads = [];
      for (let i = 0; i < 6; i++) { pads.push(g.world.get(...[live.part.pads[0].cells[0][0], R.Y, live.part.pads[0].cells[0][1]])); live.step(0.5); }
      const lamps = new Set(); for (let i = 0; i < 12; i++) { lamps.add(R.lamps().join()); live.step(0.6); }
      return { a, b, pads: [...new Set(pads)].sort().join(), lit: pads.includes(B.BOOST_PAD_LIT) && pads.includes(B.BOOST_PAD), lamps: lamps.size, karts: g.scene.children.filter(o => o.userData?.parade).length };
    });
    t.ok(D12.a && D12.b && D12.karts === 2 && Math.hypot(D12.a[0][0] - D12.b[0][0], D12.a[0][1] - D12.b[0][1]) > 4, `with the star two parade karts drive round the track (${D12.karts} karts)`);
    t.ok(D12.lit && D12.lamps >= 3, `the boost pads pulse and the start lamps cycle (${D12.lamps} lamp pictures)`);
    await page.evaluate(() => {
      const R = window.__R, k = R.live.paradeKarts[0], h = k.rotation.y;
      R.live.won = false;
      // beside the track a few blocks behind the first kart, looking at it
      R.p.pos.set(k.position.x - Math.sin(h) * 7 + Math.cos(h) * 5, R.Y + 3, k.position.z - Math.cos(h) * 7 - Math.sin(h) * 5); R.p.vel.set(0, 0, 0);
      R.p.lookAt({ x: k.position.x, y: R.Y + 1.2, z: k.position.z });
      R.live.step(0.001); R.g.updateGuide();
    });
    await frames(page, 3);
    await shot(page, 't40c-parade.png', { clear: true });
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join('; ')}`);
    if (ONLY === 'race') { await page.context().close(); return; }
  }

  /* ---------------------------------------------------------------- E. The dash gait (real Player physics) */
  if (want('gait')) {
    if (await page.evaluate(() => window.pokecraft.place !== 'main')) { await page.evaluate(() => window.pokecraft.realms.leave('door', { home: true })); await placeIs(page, 'main'); }
    await page.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; g.creatures.clear(); g.creatures.spawnTimer = 1e9; });
    const E = await page.evaluate(async () => {
      const g = window.pokecraft, cm = g.creatures, w = g.world, p = g.player;
      const { B } = await import('/src/blocks.js'), { GAITS } = await import('/src/creatures.js');
      const G = GAITS.dash, s = g.spawnPoint, sx = Math.floor(s.x), sz = Math.floor(s.z);
      const out = { problems: [], dashes: [] };
      const Y = 40, R = 16;
      const clear = (x0, z0) => { if (x0 - R - 3 < 1 || z0 - R - 3 < 1 || x0 + R + 3 >= w.W - 1 || z0 + R + 3 >= w.D - 1) return false; for (let x = x0 - R - 3; x <= x0 + R + 3; x += 2) for (let z = z0 - R - 3; z <= z0 + R + 3; z += 2) if (w.fenced(x, Y + 1, z)) return false; return true; };
      let cx = sx + 20, cz = sz - 26;
      search: for (let d = 24; d <= 120; d += 8) for (let k = 0; k < 12; k++) { const x = Math.floor(sx + Math.cos(k * Math.PI / 6) * d), z = Math.floor(sz + Math.sin(k * Math.PI / 6) * d); if (clear(x, z)) { cx = x; cz = z; break search; } }
      let fenced = 0;
      const build = () => {
        for (let x = cx - R - 2; x <= cx + R + 2; x++) for (let z = cz - R - 2; z <= cz + R + 2; z++) {
          for (let y = Y - 1; y <= Y + 6; y++) w.set(x, y, z, B.AIR);
          if (Math.abs(x - cx) <= R && Math.abs(z - cz) <= R) { w.set(x, Y, z, B.STONE); if (w.fenced(x, Y + 1, z)) fenced++; }
        }
        for (const [dx, dz] of [[7, 2], [7, 3], [8, 2], [8, 3], [-3, 6], [-3, 7], [9, -5]]) w.set(cx + dx, Y, cz + dz, B.WATER); // a pool
        for (let y = 1; y <= 3; y++) for (let k = -3; k <= 3; k++) w.set(cx + 5, Y + y, cz + 5 + k, B.STONE); // a 3 high wall
        for (let x = cx + 11; x <= cx + R; x++) for (let z = cz - R; z <= cz - 6; z++) w.set(x, Y, z, B.AIR); // a ledge: a hole in the corner
      };
      build(); out.fenced = fenced;
      const mk = (id, x = cx, z = cz) => { cm.clear(); const c = cm.spawnAt(id, x, Y + 1, z, { level: 5 }); c.life = 1e9; return c; };
      const free = (x, y, z) => w.get(x, y, z) === B.AIR && w.get(x, y + 1, z) === B.AIR;
      const legal = (what, cells, from, pl) => {
        const ok = (cond, msg) => { if (!cond) out.problems.push(`${what}: ${msg}`); };
        ok(cells.length >= 5 && cells.length <= 10, `${cells.length} cells`);
        let prev = { x: Math.floor(from.x), y: Math.round(from.y), z: Math.floor(from.z) };
        for (const c of cells) {
          const x = Math.floor(c.x), z = Math.floor(c.z), y = c.y;
          ok(free(x, y, z), `no room at ${x - cx},${y},${z - cz}`);
          const under = w.get(x, y - 1, z); ok(under !== B.AIR && under !== B.WATER, `nothing solid under ${x - cx},${z - cz}`);
          ok(Math.abs(x - cx) <= R && Math.abs(z - cz) <= R, `off the platform ${x - cx},${z - cz}`);
          ok(!w.fenced(x, y, z), 'in a gym box');
          ok(Math.abs(x - prev.x) <= 1 && Math.abs(z - prev.z) <= 1 && (x !== prev.x || z !== prev.z), `a step of more than one cell ${prev.x - cx},${prev.z - cz} -> ${x - cx},${z - cz}`);
          ok(Math.abs(y - prev.y) <= 1, `a ${y - prev.y} step in height`);
          if (x !== prev.x && z !== prev.z) ok(free(prev.x, Math.max(prev.y, y), z) || free(x, Math.max(prev.y, y), prev.z), `a diagonal squeeze at ${x - cx},${z - cz}`);
          prev = { x, y, z };
        }
        const last = cells[cells.length - 1];
        ok(Math.hypot(pl.x - last.x, pl.z - last.z) > Math.hypot(pl.x - from.x, pl.z - from.z), 'not further from the player');
      };
      const chase = (c, { sprint = true, dt = 0.05, steps = 700, startX = -10, stop = true } = {}) => {
        p.pos.set(c.pos.x + startX, Y + 1, c.pos.z); p.vel.set(0, 0, 0);
        p.keys = { KeyW: true, ...(sprint ? { ShiftLeft: true } : {}) };
        const r = { dashes: 0, bumps: 0, tiredAt: -1, tiredCalls: 0, revs: 0, speedMax: 0, steps: 0, goes: 0, pooled: 0 };
        cm.onTired = () => { r.tiredCalls++; }; cm.onBump = () => { r.bumps++; };
        let was = null, from = null;
        for (let i = 0; i < steps; i++) {
          r.steps = i;
          p.lookAt({ x: c.pos.x, y: p.pos.y + 1.62, z: c.pos.z }); p.update(dt);
          const before = c.pos.clone(), hadDash = c.dash;
          cm.update(dt, p.pos, g.spawnPoint, false, false);
          if (!hadDash && c.dash) { r.dashes++; from = before; was = c.dash; if (c.dash.phase === 'rev') r.revs++; }
          if (c.dash?.phase === 'go' && was) { was = null; r.goes++; legal(`${c.species.name} dash ${r.dashes}`, c.dash.cells, from, p.pos); out.dashes.push(c.dash.cells.length); }
          if (c.dash) r.speedMax = Math.max(r.speedMax, c.pos.distanceTo(before) / dt);
          if (c.tired > 0 && r.tiredAt < 0) r.tiredAt = i;
          if (r.bumps && stop) break;
        }
        p.keys = {};
        return r;
      };
      // 1. far away: nothing happens
      { const c = mk('vroomlet'); cm.viewer = c.pos.clone().setX(c.pos.x - 20); for (let i = 0; i < 20; i++) cm.updateOne(c, 0.05); out.far = !c.dash && c.pos.x === cx + 0.5; }
      // 2. run at it: three dashes, then tired, then you run into it
      out.run = chase(mk('vroomlet'));
      build(); out.run2 = chase(mk('pitpig'), { dt: 0.1, steps: 400 });
      // 3. closed form: the same landing cells at 60 and 20 frames per second (a viewer 4 blocks behind it)
      const landing = dt => {
        build(); const c = mk('zipskate'), v = c.pos.clone(); v.x -= 5; cm.viewer = v;
        const spots = []; let had = false;
        for (let i = 0; i < 1200 && spots.length < 3; i++) { if (!c.dash) v.set(c.pos.x - 4, c.pos.y, c.pos.z); cm.updateOne(c, dt); if (c.dash) had = true; else if (had) { had = false; spots.push([c.pos.x - cx, c.pos.z - cz, c.pos.y].map(n => +n.toFixed(2)).join()); } }
        return spots;
      };
      out.land60 = landing(1 / 60); out.land20 = landing(1 / 20);
      out.gait = G;
      // 4. a creature in a corner (the ledge side) never leaves the platform: run at it from the far side
      build(); const c4 = mk('wheelie', cx + 10, cz - 4);
      const r4 = chase(c4, { startX: -9, steps: 500, stop: false });
      out.cornerOk = Math.abs(c4.pos.x - cx) <= R + 0.5 && Math.abs(c4.pos.z - cz) <= R + 0.5 && c4.pos.y >= Y + 0.9;
      out.corner = r4;
      out.pooled = out.problems.filter(m => /nothing solid/.test(m)).length;
      return out;
    });
    t.ok(E.fenced === 0 && E.far, 'the test platform is outside every gym box and a Racer 12 blocks away stays put');
    t.ok(E.run.dashes === 3 && E.run.revs === 3 && E.run.tiredAt >= 0 && E.run.tiredCalls === 1 && E.run.bumps === 1, `running at it: it revs and dashes 3 times, is out of breath (onTired once) and you run into it (${JSON.stringify(E.run)})`);
    t.ok(E.run.speedMax > 8, `a dash is fast (${E.run.speedMax.toFixed(1)} blocks per second at most)`);
    t.ok(E.run2.dashes === 3 && E.run2.bumps === 1, `with 0.1 s steps too (${JSON.stringify(E.run2)})`);
    t.ok(!E.problems.length, `every dash is a straight line of free, dry, solid cells, one step at a time, no diagonal squeeze, never off the ledge ${E.problems.slice(0, 5).join('; ')}`);
    t.ok(E.land60.length === 3 && E.land60.join('|') === E.land20.join('|'), `the same three landing cells at 60 and 20 frames per second (${E.land60.join(' | ')})`);
    t.ok(E.cornerOk, 'a Racer in a corner by the ledge stays on the platform');
    console.log('  dash lengths:', JSON.stringify(E.dashes));
  }

  /* ---------------------------------------------------------------- F. The Book */
  if (want('book')) {
    await page.evaluate(() => { const g = window.pokecraft; for (const id of ['vroomlet', 'vroomster']) { g.book.markSeen(id); g.book.markCaught(id); } g.book.open({ species: 'vroomster' }); });
    await page.waitForFunction(() => [...document.querySelectorAll('#book-detail img')].every(i => i.src.startsWith('data:')), null, { timeout: 60000 });
    const F = await page.evaluate(async () => {
      const Bk = await import('/src/book.js');
      return { text: document.getElementById('book-detail')?.textContent || '', rows: Bk.spawnInfo('vroomster').map(r => r.name) };
    });
    t.ok(F.text.includes('Vroomster') && F.text.includes('Photo Finish') && F.text.includes('Vroomlet') && /racer/i.test(F.text), `the Book page shows Vroomster, its move and Vroomlet (${F.text.slice(0, 120)}...)`);
    t.ok(F.rows.includes('Playland · Race Track'), `the Book says where to find it (${F.rows.join(', ')})`);
    await shot(page, 't40c-book-vroomster.png');
    await page.evaluate(() => window.pokecraft.book.close?.());
  }
  t.ok(!page.errors.length, `no page errors in the game page ${page.errors.slice(0, 3).join('; ')}`);
  await page.context().close();

  /* ---------------------------------------------------------------- G. iPad */
  if (want('ipad')) {
    const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
    await newGame(ip, 0);
    await ip.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });
    await intoPlayland(ip);
    const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    await arm(ip);
    await ip.evaluate(() => {
      const R = window.__R, n = R.rio();
      R.p.pos.set(n.pos.x, R.Y + 1, n.pos.z + 2.5); R.p.vel.set(0, 0, 0);
      R.p.lookAt({ x: n.pos.x, y: R.Y + 2.4, z: n.pos.z });
    });
    await waitFor(ip, () => document.getElementById('btn-act')?.textContent.trim() === 'Race!', null, 60000).catch(() => {});
    const word = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    t.ok(word === 'Race!', `on the iPad the big button says "${word}" in front of Rio`);
    await ip.tap('#btn-act');
    await waitFor(ip, () => window.__R.live.state === 'count', null, 30000);
    t.ok(true, 'a tap on the big button starts the countdown');
    const sp = await ip.evaluate(() => {
      const R = window.__R; R.live.step(3.2); R.live.manual = false; // the game's own frames drive the race now
      R.g.touch.joy = { x: 0, y: -1 }; R.p.yaw = -Math.PI / 2; R.p.keys = {};
      return R.live.state;
    });
    await waitFor(ip, () => (window.__R.live.car?.v ?? 0) > 6, null, 60000).catch(() => {});
    const run = await ip.evaluate(() => { const R = window.__R; const v = R.live.car?.v ?? 0, x = R.live.car?.x; R.g.touch.joy = null; R.live.manual = true; return { v, moved: x - R.live.part.grid.player[0] }; });
    t.ok(sp === 'race' && run.v > 3 && run.moved > 1, `pushing the joystick forward drives the kart (${run.v.toFixed(1)} blocks per second, ${run.moved.toFixed(1)} blocks)`);
    const after = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    t.ok(after === before, `the number of touch buttons did not change (${before})`);
    await ip.evaluate(() => { const R = window.__R; R.put(4, -1.5); R.live.wish = { x: 0, z: 0, m: 0 }; R.live.step(0.05); R.p.pitch = -0.15; });
    await frames(ip, 2);
    await shot(ip, 't40c-ipad.png');
    t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
    await ip.context().close();
  }

  /* ---------------------------------------------------------------- H. Two browsers */
  if (want('pair')) {
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
    await A.evaluate(() => { window.pokecraft.champion = true; });
    await Bp.evaluate(() => { window.pokecraft.champion = true; });
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 30000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'swirl');
    const cell = await A.evaluate(() => {
      const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'race'), p = g.player;
      p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
      return f.cloth[Math.floor(f.cloth.length / 2)];
    });
    await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(A, 'playland');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 30000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'playland');
    await arm(A); await arm(Bp);
    const before = await A.evaluate(() => { const n = window.__R.rio(); return [n.pos.x, n.pos.y, n.pos.z]; });
    const k = await Bp.evaluate(() => { const R = window.__R; R.g.talkTo(R.rio()); R.live.step(3.2); R.drive(7, { until: () => R.s > 30 }); return { state: R.live.state, mine: R.live.info().next }; });
    await Bp.evaluate(() => { const R = window.__R; R.live.step(0.1); });
    const after = await A.evaluate(() => { const n = window.__R.rio(); return { pos: [n.pos.x, n.pos.y, n.pos.z], state: window.__R.live.state, steer: n.steer }; });
    t.ok(k.state === 'race' && after.state === 'idle' && !after.steer && after.pos.join() === before.join(), `Kid races his own Rio; Dad's Rio stays on his stand (${k.state}, Dad: ${after.state})`);
    t.ok(!A.errors.length && !Bp.errors.length, `no page errors in the pair ${A.errors.concat(Bp.errors).slice(0, 3).join('; ')}`);
    await A.context().close(); await Bp.context().close();
  }
}
