// T43 Funfair type and the Funfair in Playland (plans/T43.md). A: the seven creatures, shapes (a string of bulbs), moves, effects, sounds, chart,
// spawns only in the fair zone, Galloprance rideable, Merry Mae's team; B: the layout on a stand-in world in Node (only inside the zone, the
// coaster's clearance and supports, the slide, nothing walkable up to the stage, nobody stuck); C: the three games and the rides (pure rules
// in Node at 60 and 20 steps a second, the trampoline with the real Player, the live part driven by hand); D: the whole play loop in a
// browser (tickets saved and reloaded, the coaster, Merry Mae, the star, a lost battle, the slide, the crew); E: an iPad; F: two browsers.
// FAIR_ONLY=data|land|games|play|ipad|pair|shots runs part of it. Screenshots: tests/screenshots/t43-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, waitFor as waitFor0, playBattle, seedSave, continueGame, platform } from '../helpers.mjs';
import * as G from '../../src/fairgames.js';
import * as FF from '../../src/funfair.js';
import * as PL from '../../src/playland.js';
import { B, isSolid, BLOCKS, WOOL } from '../../src/blocks.js';
import { walkGraph, bfs } from '../housecheck.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const IDS = ['merrycolt', 'galloprance', 'flufflamb', 'candyram', 'twistpup', 'balloodle', 'tixit'];
const ONLY = process.env.FAIR_ONLY || '';
const want = part => !ONLY || ONLY === part;
const waitFor = (page, fn, arg, timeout = 90000) => waitFor0(page, fn, arg, timeout);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const frames = (page, n = 2) => page.evaluate(async n => {
  const g = window.pokecraft;
  for (let i = 0; i < n; i++) { const t0 = g.time; await new Promise(res => { const f = () => (g.time !== t0 ? res() : requestAnimationFrame(f)); f(); }); }
}, n);
const save = (name, url) => { const file = path.join(SHOTS, name); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); console.log(`  screenshot ${file}`); };
const shot = async (page, name, { clear = true } = {}) => { await page.evaluate(clear => { document.getElementById('pause')?.classList.add('hidden'); if (clear) window.pokecraft.ui.toastBox.replaceChildren(); }, clear); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };

// A page that takes more than 30 s to start (a busy machine, software WebGL) is tried again.
const retry = async (fn, n = 3) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || !/Timeout/.test(e.message)) throw e; console.log('  (the page was slow to start: trying again)'); } } };

// A Champion in Playland, through the Funfair frame of the Swirl.
async function intoFair(page, { stars = [] } = {}) {
  await page.evaluate(stars => { const g = window.pokecraft; g.champion = true; g.stars = stars; g.realms.enter('swirl', { back: g.world.portal.stand }); }, stars);
  await placeIs(page, 'swirl');
  const cell = await page.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'fair'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(page, 'playland');
}

// The live part driven by hand (a manual clock, fixed dt), toasts collected, the real Player stepped by the spec.
const arm = page => page.evaluate(async () => {
  const g = window.pokecraft, F = await import('/src/funfair.js'), Gm = await import('/src/fairgames.js'), { B } = await import('/src/blocks.js');
  const live = g.gymLive.of('part:fair');
  live.manual = true; live.playing = () => true;
  window.__toasts = [];
  const f = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...r) => { window.__toasts.push(m); return f(m, ...r); };
  const p = g.player;
  const R = window.__R = {
    g, live, F, G: Gm, B, p,
    said: re => window.__toasts.some(m => new RegExp(re).test(m)),
    // put the player somewhere, standing (one tiny physics step so onGround is true)
    put(x, y, z) { p.carry = null; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.keys = {}; p.joy = null; p.trampH = 0; p.onGround = false; p.update(0.02); },
    // real Player physics and the live part, `sec` seconds in dt steps
    run(sec, dt = 1 / 30, each) { for (let t = 0; t < sec; t += dt) { p.update(dt); live.step(dt); each?.(t); } },
    mae: () => g.npcs.list.find(n => n.kind === 'boss' && n.def?.id === 'fair'),
    tess: () => g.npcs.list.find(n => n.kind === 'guest' && n.name === 'Ticket Tess'),
    crew: i => g.npcs.list.find(n => n.kind === 'crew' && n.def?.boss === 'fair' && n.def.index === i),
    tickets: n => { for (let i = 1; i <= 3; i++) { const k = F.ticketKey(i), at = g.beaten.indexOf(k); if (i <= n && at < 0) g.beaten.push(k); if (i > n && at >= 0) g.beaten.splice(at, 1); } live.syncBlocks(true); },
  };
  return true;
});

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });

  /* ---------------------------------------------------------------- B. The layout on a stand-in world (Node) */
  if (want('land')) {
    const W = 224, D = 224, H = 48;
    const standIn = () => {
      const w = { W, D, H, data: new Uint8Array(W * D * H), ground: new Int16Array(W * D), seed: 1 };
      w.index = (x, y, z) => x + W * (z + D * y);
      w.inBounds = (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < H;
      w.get = (x, y, z) => (w.inBounds(x, y, z) ? w.data[w.index(x, y, z)] : 0);
      w.isSolid = (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 ? true : isSolid(w.get(x, y, z)));
      return w;
    };
    const hash = w => { let h = 0; for (let i = 0; i < w.data.length; i++) h = (h * 31 + w.data[i]) | 0; return h; };
    const w = standIn(); PL.playLand(w, {});
    const part = w.parts.find(p => p.id === 'fair'), Z = PL.ZONES.fair.box;
    t.ok(!!part && part.live === 'fair' && PL.PLAYLAND_PARTS.fair.build === FF.buildFunfair, 'Playland builds the fair part (world.parts has { id: fair, live: fair })');
    { const w2 = standIn(); PL.playLand(w2, {}); t.ok(hash(w2) === hash(w), 'the same blocks twice (no seed: the fair is the same in every world)'); }
    // 1. only inside the zone box
    const old = PL.PLAYLAND_PARTS.fair; PL.PLAYLAND_PARTS.fair = null;
    const w0 = standIn(); PL.playLand(w0, {});
    PL.PLAYLAND_PARTS.fair = old;
    let inside = 0; const outside = [];
    for (let i = 0; i < w.data.length; i++) if (w.data[i] !== w0.data[i]) {
      const x = i % W, z = Math.floor(i / W) % D, y = Math.floor(i / (W * D));
      if (x >= Z.x0 && x <= Z.x1 && z >= Z.z0 && z <= Z.z1) inside++; else outside.push([x, y, z]);
    }
    const gate = PL.ZONES.fair.gate;
    const hubOnly = outside.every(([x, y, z]) => x >= gate.x - 3 && x <= gate.x + 3 && (z === 131 || z === 123 || (z >= 122 && z <= 124)));
    t.ok(inside > 8000 && hubOnly, `the fair changes only cells inside its zone box (${inside}); outside it only the hub's sign cells and the opened hedge gap and way back door at the gate (${outside.length} cells, z ${[...new Set(outside.map(c => c[2]))].join()})`);
    // 2. every id in the box: old ones or 224-234
    const ids = new Set();
    for (let x = Z.x0; x <= Z.x1; x++) for (let z = Z.z0; z <= Z.z1; z++) for (let y = 0; y < H; y++) ids.add(w.get(x, y, z));
    const mine = [...ids].filter(id => id >= 204);
    t.ok(mine.every(id => (id >= 224 && id <= 234) || id === B.BOSS_STAND), `every block in the fair box is old or in 224-234 (${[...ids].sort((a, b) => a - b).join()})`);
    t.ok([225, 226, 227, 228, 229, 230, 231, 232, 233, 234].every(id => ids.has(id)), 'all ten fair blocks 225-234 are used (and the funfair wool 224 under the stalls or not at all)');
    // 3. the way in
    const arr = w.arrivals.fair;
    t.ok(arr && [0, 1, 2].every(k => w.get(Math.floor(arr[0]), 11 + k, Math.floor(arr[2])) === B.AIR) && w.get(Math.floor(arr[0]), 10, Math.floor(arr[2])) !== B.AIR, `the arrival stand is free and on the floor (${arr?.map(v => +v.toFixed(2))})`);
    t.ok(Math.abs(-Math.sin(arr[3]) - 0) < 1e-6 && Math.abs(-Math.cos(arr[3]) - 1) < 1e-6, 'it faces south, at the hedge gap');
    t.ok([163, 164, 165, 166, 167, 168, 169].every(x => [11, 12].every(y => w.get(x, y, 131) === B.AIR)) && w.get(162, 11, 131) !== B.AIR && w.get(170, 11, 131) !== B.AIR, 'the hedge gap x 163..169 is open (2 high), the hedge round it stays');
    const door = w.doors.find(d => d.key === 'fair');
    t.ok(!!door && door.surface.length === 12 && !w.keeps.some(k => k.name === 'fair-sign'), 'the way back door of the fair stands in the hub and the "Coming soon" sign is gone');
    // 4. the coaster track
    const track = G.makeCoaster(G.COASTER), gateSet = new Set(part.coaster.gate.map(c => c.join()));
    let head = 0, outBox = 0;
    for (const s of track.samples) {
      if (s[0] < Z.x0 + 1 || s[0] > Z.x1 || s[2] < Z.z0 + 1 || s[2] > Z.z1) outBox++;
      for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) for (let y = s[1] + 1.0; y <= s[1] + 1.8; y += 0.4) {
        const c = [Math.floor(s[0] + dx), Math.floor(y), Math.floor(s[2] + dz)];
        if (w.isSolid(...c) && !gateSet.has(c.join())) head++;
      }
    }
    t.ok(head === 0 && outBox === 0, `the coaster: ${track.samples.length} samples, nothing solid over the rider's head (the shutter opens for the car), all inside the zone (${head} / ${outBox})`);
    const sup = new Set(part.coaster.supports.map(c => c.join()));
    let bare = 0;
    for (const [x, y, z] of part.coaster.rails) {
      if (y <= 11) continue;
      let ok = false;
      for (let dx = -3; dx <= 3 && !ok; dx++) for (let dz = -3; dz <= 3 && !ok; dz++) ok = sup.has([x + dx, 11, z + dz].join());
      if (!ok) bare++;
    }
    t.ok(bare === 0 && part.coaster.rails.length > 200, `every rail above the floor has a white support column to the floor within 3 blocks (${part.coaster.rails.length} rails, ${part.coaster.supports.length} support blocks)`);
    const end = track.samples.at(-1);
    t.ok(Math.hypot(end[0] - 206.5, end[2] - 201.5) < 0.05 && Math.abs(end[1] - 24) < 0.05 && w.get(Math.floor(end[0]), 23, Math.floor(end[2])) === B.STAR_STAGE, 'the ride ends on the Star Stage (206.5, 24, 201.5)');
    t.ok(track.time >= 30 && track.time <= 40, `the ride takes ${track.time.toFixed(1)} s (30-40)`);
    let clash = 0;
    for (const [x, y, z] of part.coaster.rails) {
      const A = G.ARENA, T = G.TRAMP, C = G.CAROUSEL;
      if ((x >= A.x0 - 1 && x <= A.x1 && z >= A.z0 - 1 && z <= A.z1) || (x >= T.x0 && x <= T.x1 && z >= T.z0 && z <= T.z1) || Math.hypot(x + 0.5 - C.c[0], z + 0.5 - C.c[1]) < 10.3) clash++;
    }
    t.ok(clash === 0, `no rail cell lies inside the arena, the carousel or the trampoline (${clash})`);
    // 5. the slide
    const h = G.makeHelix();
    let slide = 0;
    for (let s = 0; s <= h.time; s += 0.05) {
      const p = h.at(s);
      for (let a = 0; a < 6.3; a += 0.7) for (let dy = 0; dy <= 1.8; dy += 0.3) {
        if (w.isSolid(Math.floor(p.x + Math.cos(a) * 0.3), Math.floor(p.y + 0.02 + dy), Math.floor(p.z + Math.sin(a) * 0.3))) slide++;
        if (s > 0.8 && dy > 0.2 && w.isSolid(Math.floor(p.x + Math.cos(a) * 1.2), Math.floor(p.y + dy), Math.floor(p.z + Math.sin(a) * 1.2))) slide++;
      }
    }
    const he = h.at(h.time);
    t.ok(slide === 0 && Math.hypot(he.x - G.SLIDE.to[0], he.z - G.SLIDE.to[2]) < 0.05 && he.y === 11, `the slide's helix is clear of blocks (body and tube) and ends on the floor at (${he.x.toFixed(1)}, ${he.z.toFixed(1)}) (${slide} cells hit)`);
    // 6. walking: everything reachable from the arch, nothing walkable up to the stage, nobody stuck
    const g = walkGraph(w), seen = bfs(g, [[166, 11, 126]]);
    const reach = (x, y, z) => seen.has(g.key(x, y, z));
    t.ok(reach(166, 11, 136) && reach(166, 11, 138) && reach(150, 11, 153) && reach(134, 11, 153) && G.BAYS.every(b => reach(Math.floor(b.x), 11, Math.floor(b.z))), 'walking from the arch you reach the plaza, Ticket Tess, the arena gate, the inside of the arena and every parked car');
    t.ok(reach(197, 11, 153) && reach(175, 12, 153) && reach(166, 12, 172) && reach(189, 11, 189), 'the trampoline, the carousel deck, the coaster station and the slide\'s foot are reachable');
    const high = [...seen.keys()].filter(k => +k.split(',')[1] >= 20 && +k.split(',')[0] >= 190 && +k.split(',')[2] >= 190);
    t.ok(high.length === 0, `no way to walk up to the Star Stage (the shutter keeps walkers off the rails; ${high.length} stand cells up there are reachable)`);
    let loose = 0, total = 0;
    for (let x = Z.x0; x <= Z.x1; x++) for (let z = Z.z0; z <= Z.z1; z++) if (g.standOk(x, 11, z)) { total++; if (!reach(x, 11, z)) loose++; }
    t.ok(loose === 0 && total > 7000, `nobody can get stuck: every one of the ${total} floor cells in the zone is reachable (${loose} not)`);
    // 7. the rest: Merry Mae on the stage, the crew, Ticket Tess, rests, keeps
    const boss = w.bosses.find(b => b.id === 'fair');
    t.ok(boss && boss.pos[1] === 24 && w.get(201, 23, 201) === B.BOSS_STAND && boss.crew.length === 2 && w.people.length === 1 && w.people[0].name === 'Ticket Tess', 'Merry Mae stands on the Star Stage (y 24) on her stand with two crew; Ticket Tess is a person of the world');
    const keep = w.keeps.find(k => k.name === 'fair');
    t.ok(keep && keep.protect[0].x0 === Z.x0 && keep.protect[0].z1 === Z.z1 && keep.rideText && !keep.rideIn, 'one keep for the whole zone, riders are fenced out with a kind word (no rideIn)');
    t.ok(w.rests.some(r => r[1] >= 24 && r[0] > 196) && w.rests.some(r => Math.abs(r[2] - 138.5) < 1), 'rest spots: on the Star Stage (a lost battle stays there) and the entry plaza');
    t.ok(part.board.length === 3 && part.board.every(s => (s.x1 - s.x0 + 1) === 3 && (s.y1 - s.y0 + 1) === 2 && w.get(s.x0, s.y0, s.z) === B.MARQUEE), 'the ticket board: three slots of unlit fair lights on the arch');
    t.ok(part.coaster.lights.length >= 12 && part.coaster.lights.every(([x, y, z]) => w.get(x, y, z) === B.MARQUEE), `the coaster has ${part.coaster.lights.length} fair lights on poles`);
    t.ok(w.parts.length === 3 && w.parts.map(p => p.id).join() === 'race,stadium,fair', 'the Race Track and the Ball Stadium parts are still there beside the fair');
    t.ok(PL.zoneAt(150, 150) === 'fair' && JSON.stringify(PL.playlandSpawns().fair.map(e => e[0]).sort()) === JSON.stringify([...IDS].sort()), 'the fair zone gives the seven Funfair creatures to Playland\'s spawn tables');
  }

  /* ---------------------------------------------------------------- C. The games, pure (Node) */
  if (want('games')) {
    const { BumperCar, BumperGame, BAYS, BOTS, botAt, skilledWish, bumpPops, ARENA, BUMPER, BUMPER_ROUNDS, BOT_TRICKS, BounceGame, BOUNCE_ROUNDS, bounceWish, balloonPath,
      Seat, RING_ROUNDS, ringWish, ringTotal, ringNeed, omegaOf, TRAMP, nextBounce, makeCoaster, COASTER, fairHelp } = G;
    const TAU = Math.PI * 2;
    const hashn = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    const STEPS = [[1 / 60, '60'], [1 / 20, '20']];
    /* -------- Bumper Cars: three rounds (owner 2026-10-27: harder games) */
    // play the whole game with a driver: returns { won, secs, log } (log: round / again / done with the time)
    const drive = (dt, hard, driver, limit = 420) => {
      const g = new BumperGame(hard), parked = BAYS.slice(1).map(b => ({ x: b.x, z: b.z })), memo = {}, log = [];
      g.car.reset(BAYS[0].x, BAYS[0].z, BAYS[0].yaw);
      let t = 0, k = 0, zooms = 0, faced = 0;
      while (t < limit) {
        const ev = g.update(dt, { driving: true, wish: driver(g, memo, t, k++), parked, home: BAYS[0] });
        for (const e of ev) {
          if (e.type === 'zoom') zooms++;
          if (e.type === 'exit') g.car.reset(BAYS[0].x, BAYS[0].z, 0);
          if (['round', 'again', 'done'].includes(e.type)) log.push(`${e.type}${e.round != null ? e.round + 1 : ''}@${t.toFixed(0)}`);
          if (e.type === 'done') return { won: true, secs: t, log, zooms, faced };
        }
        if (g.fleet.bots.some(b => Math.abs(b.face) > 0.6)) faced++;
        t += dt;
      }
      return { won: false, secs: t, log, zooms, faced, round: g.round + 1 };
    };
    const skilled = (g, memo) => skilledWish(memo, g);
    const ram = g => { // straight at the nearest balloon bot's middle, whichever way it faces
      let best = null, bd = 1e9; const car = g.car;
      g.fleet.bots.forEach((b, i) => { if (!b.kind || g.popped[i]) return; const p = g.fleet.at(i), d = Math.hypot(p.x - car.x, p.z - car.z); if (d < bd) { bd = d; best = p; } });
      const dx = best.x - car.x, dz = best.z - car.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d };
    };
    const randomStick = (g, memo, t) => { const q = Math.floor(t / 0.4), a = hashn(q) * TAU, m = hashn(q + 77) < 0.2 ? 0 : 0.4 + hashn(q + 5) * 0.6; return { x: Math.cos(a) * m, z: Math.sin(a) * m }; };
    const idle = () => ({ x: 0, z: 0 });
    const bs = [];
    for (const hard of [false, true]) for (const [dt, n] of STEPS) bs.push({ n, hard, ...drive(dt, hard, skilled) });
    console.log('  bumper skilled', JSON.stringify(bs.map(r => [r.n, r.hard, r.won, +r.secs.toFixed(0), r.log.join(' ')])));
    t.ok(bs.every(r => r.won && r.secs < 300) && bs.filter(r => !r.hard).every(r => r.secs < 200), `Bumper Cars: a skilled driver (chase the back, back off from a spinner that faces you) wins all three rounds at 60 and 20 steps a second, also in a rematch (${bs.map(r => `${r.n}${r.hard ? ' hard' : ''} ${r.secs.toFixed(0)} s`).join(', ')})`);
    t.ok(bs.every(r => r.zooms >= 3 && r.faced > 0), `the zoomers zoom off when they notice you (${bs.map(r => r.zooms).join(', ')} zooms) and the spinners turn to face you`);
    const careless = [];
    for (const [name, dr] of [['idle', idle], ['random stick', randomStick], ['ram the nearest bot', ram]]) for (const [dt, n] of STEPS) careless.push({ name, n, ...drive(dt, false, dr, 360) });
    console.log('  bumper careless', JSON.stringify(careless.map(r => [r.name, r.n, r.won, r.round, r.log.slice(0, 6).join(' ')])));
    t.ok(careless.every(r => !r.won), `careless driving never wins the ticket in 6 minutes: ${careless.map(r => `${r.name} (${r.n}) stuck in round ${r.round}`).join(', ')}`);
    t.ok(careless.filter(r => r.name !== 'ram the nearest bot').every(r => r.round === 1), 'standing still or a random stick never even gets past round 1');
    {
      const g = new BumperGame(false); g.start(1); const a = g.fleet.bots[3].speed; g.misses = 2; g.start(1); const b = g.fleet.bots[3].speed, tb = g.time;
      g.misses = 9; g.start(1);
      t.ok(Math.abs(b / a - 0.9) < 1e-9 && tb === BUMPER_ROUNDS[1].time + 10 && Math.abs(g.fleet.bots[3].speed / a - 0.7) < 1e-9 && fairHelp(1).slow === 1, `the kind help: after two missed tries the bots are 10 % slower and the round 10 s longer, at most 30 % slower (${a} -> ${b.toFixed(2)} -> ${g.fleet.bots[3].speed.toFixed(2)})`);
      // the round clock runs only while you drive
      const h = new BumperGame(false), l0 = h.left; for (let k = 0; k < 600; k++) h.update(1 / 60, { driving: false });
      t.ok(h.left === l0 && h.fleet.t > 9.9, 'the round clock stands still while you are out of the car (the bots keep driving)');
    }
    // a zoomer: noticed from behind -> zoom (faster than your car) -> tired (slower) -> rest; a spinner turns its nose
    {
      const f = new G.BotFleet(); f.setRound(1, false);
      const b = f.at(3), car = { x: b.x - b.mx * 3, z: b.z - b.mz * 3, vx: b.mx * 5, vz: b.mz * 5 };
      const ev = f.step(1 / 120, car), z = f.speedOf(f.bots[3]);
      for (let k = 0; k < 120 * 1.2; k++) f.step(1 / 120, null);
      const tired = f.bots[3].tired > 0, ts = f.speedOf(f.bots[3]);
      const f2 = new G.BotFleet(); f2.setRound(1, false); const b2 = f2.at(3), front = { x: b2.x + b2.mx * 3, z: b2.z + b2.mz * 3, vx: -b2.mx * 5, vz: -b2.mz * 5 };
      const ev2 = f2.step(1 / 120, front);
      t.ok(ev.some(e => e.type === 'zoom' && e.i === 3) && z > BUMPER.top && tired && ts < 2 && !ev2.length, `a zoomer that sees you behind it zooms off at ${z.toFixed(1)} b/s (your car: ${BUMPER.top}), then puffs along at ${ts.toFixed(1)}; a car in front does not set it off`);
      const f3 = new G.BotFleet(); f3.setRound(2, false); const b3 = f3.at(4), side = { x: b3.x + b3.mz * 2.5, z: b3.z - b3.mx * 2.5, vx: 0, vz: 0 };
      for (let k = 0; k < 120 * 0.5; k++) f3.step(1 / 120, side);
      const turned = Math.abs(f3.bots[4].face);
      t.ok(turned > 0.4 && turned < 0.6, `a spinner turns its nose to a car beside it at ${BOT_TRICKS.spinRate} rad/s (${turned.toFixed(2)} rad in 0.5 s)`);
    }
    // the old rules: head-on and side hits never pop, a hit from behind does
    let wrongPop = 0, missed = 0, n = 0;
    for (const hard of [false, true]) for (let i = 0; i < 6; i++) for (const t0 of [1.3, 4.7, 9.1]) {
      const bot = botAt(i, t0, hard), side = [-bot.hz, bot.hx];
      const trial = (dx, dz, vx, vz) => {
        const car = new BumperCar(bot.x + dx, bot.z + dz, 0); car.vx = vx; car.vz = vz; car.t = t0;
        let pop = false; const popped = BOTS.map(() => false);
        for (let k = 0; k < 40; k++) for (const e of car.update(1 / 120, { wish: { x: 0, z: 0 }, hard, popped, parked: [] })) if (e.type === 'pop' && e.i === i) pop = true;
        return pop;
      };
      n++;
      if (trial(bot.hx * 1.9, bot.hz * 1.9, -bot.hx * 5, -bot.hz * 5)) wrongPop++;               // head-on
      if (trial(side[0] * 1.9, side[1] * 1.9, -side[0] * 5, -side[1] * 5)) wrongPop++;           // from the side
      if (trial(-side[0] * 1.9, -side[1] * 1.9, side[0] * 5, side[1] * 5)) wrongPop++;           // from the other side
      if (!trial(-bot.hx * 1.9, -bot.hz * 1.9, bot.hx * 6.5, bot.hz * 6.5)) missed++;            // from behind, fast
      if (trial(-bot.hx * 1.9, -bot.hz * 1.9, bot.hx * 0.6, bot.hz * 0.6)) wrongPop++;           // from behind, but crawling (below 2 b/s)
    }
    t.ok(wrongPop === 0 && missed === 0, `head-on and side hits never pop; a quick hit from behind always does; a crawl from behind does not (${n} trials per kind: ${wrongPop} wrong, ${missed} missed)`);
    t.ok(bumpPops({ x: 0, z: -1.5, vx: 0, vz: 4 }, { x: 0, z: 0, hx: 0, hz: 1, vx: 0, vz: 3.4 }) && !bumpPops({ x: 0, z: 1.5, vx: 0, vz: -4 }, { x: 0, z: 0, hx: 0, hz: 1, vx: 0, vz: 3.4 }), 'bumpPops: behind yes, in front no (a plain example)');
    // never inside a rail or a bot after 10 000 random-stick steps (the round's fleet with its tricks)
    for (const [dt] of STEPS) {
      const g = new BumperGame(false), parked = BAYS.slice(1).map(b => ({ x: b.x, z: b.z })), car = g.car;
      car.reset(BAYS[0].x, BAYS[0].z, BAYS[0].yaw);
      let deep = 0, railIn = 0, nan = 0;
      for (let k = 0; k < 10000; k++) {
        if (k % 2500 === 0) g.start(Math.floor(k / 2500) % 3);
        const q = Math.floor(k * dt / 0.4), a = hashn(q) * TAU, m = hashn(q + 77) < 0.2 ? 0 : 0.4 + hashn(q + 5) * 0.6;
        const ev = g.update(dt, { driving: true, wish: { x: Math.cos(a) * m, z: Math.sin(a) * m }, parked, home: BAYS[0] });
        if (ev.some(e => e.type === 'exit')) car.reset(BAYS[0].x, BAYS[0].z, 0);
        if (!Number.isFinite(car.x + car.z)) nan++;
        for (let i = 0; i < 6; i++) { const b = g.fleet.at(i); if (Math.hypot(b.x - car.x, b.z - car.z) < 1.2) deep++; }
        for (const o of parked) if (Math.hypot(o.x - car.x, o.z - car.z) < 1.2) deep++;
        if (car.x < ARENA.x0 + BUMPER.r - 1e-6 || car.z < ARENA.z0 + BUMPER.r - 1e-6 || car.z > ARENA.z1 - BUMPER.r + 1e-6) railIn++;
      }
      t.ok(deep === 0 && railIn === 0 && nan === 0, `10 000 random-stick steps at dt ${dt.toFixed(3)} (all three rounds): the car never ends inside a rail, a bot or a parked car (${deep} / ${railIn} / ${nan})`);
    }
    {
      const a = new BumperCar(134.5, 153.5, 0), b = new BumperCar(134.5, 153.5, 0);
      for (let k = 0; k < 300; k++) a.update(1 / 60, { wish: { x: 1, z: 0.3 }, hard: false, popped: [], parked: [] });
      for (let k = 0; k < 100; k++) b.update(1 / 20, { wish: { x: 1, z: 0.3 }, hard: false, popped: [], parked: [] });
      t.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.t - b.t) < 1e-9, `5 s at 60 and at 20 steps a second end on the same spot (${a.x.toFixed(4)} / ${b.x.toFixed(4)})`);
      const d = new BumperCar(134.5, 153.5, 0); d.vx = 6.5; let t4 = 0;
      while (d.speed > 0.01 && t4 < 10) { d.update(1 / 60, { wish: { x: 0, z: 0 }, hard: false, popped: [], parked: [] }); t4 += 1 / 60; }
      t.ok(d.speed <= 0.01 && t4 > 2.5 && t4 < 6, `off the stick the car glides to a stop (${t4.toFixed(1)} s from top speed): momentum is the game`);
      const g1 = new BumperGame(false), g2 = new BumperGame(false), w = { x: 0.6, z: -0.8 };
      for (let k = 0; k < 600; k++) g1.update(1 / 60, { driving: true, wish: w, parked: [] });
      for (let k = 0; k < 200; k++) g2.update(1 / 20, { driving: true, wish: w, parked: [] });
      t.ok(Math.abs(g1.car.x - g2.car.x) < 1e-6 && Math.abs(g1.fleet.bots[4].s - g2.fleet.bots[4].s) < 1e-6 && Math.abs(g1.left - g2.left) < 1e-6, 'a whole game (car, bots and their tricks, the clock) gives the same at 60 and 20 steps a second');
    }

    /* -------- Balloon Bounce: three rounds (a point-mass player with the numbers of player.js: gravity 28, a walk of 4.3 in the air) */
    const bounce = (dt, hard, brain, limit = 420) => {
      const g = new BounceGame(hard), P = { x: 198.5, y: 11, z: 154.5, vy: 0, h: 0 }, log = [];
      let t = 0, boops = 0, combo = 0;
      while (t < limit) {
        const { wx = 0, wz = 0, space = false } = brain(g, P, t);
        let landed = false;
        P.vy = Math.max(P.vy - 28 * dt, -19);
        P.x = Math.min(TRAMP.x1 + 0.7, Math.max(TRAMP.x0 + 0.3, P.x + wx * 4.3 * dt)); P.z = Math.min(TRAMP.z1 + 0.7, Math.max(TRAMP.z0 + 0.3, P.z + wz * 4.3 * dt));
        P.y += P.vy * dt;
        if (P.y <= 11) { P.y = 11; const r = nextBounce(P.h, space); P.h = r.h; P.vy = r.vy; landed = true; }
        for (const e of g.update(dt, { pos: P, vy: P.vy, landed, active: true })) {
          if (e.type === 'boop') boops++;
          if (e.type === 'pop') combo = Math.max(combo, e.mult);
          if (['round', 'again', 'done'].includes(e.type)) log.push(`${e.type}${e.round != null ? e.round + 1 : ''}@${t.toFixed(0)}`);
          if (e.type === 'done') return { won: true, secs: t, log, combo, boops };
        }
        t += dt;
      }
      return { won: false, secs: t, log, combo, boops, round: g.round + 1 };
    };
    const bb = [];
    for (const hard of [false, true]) for (const [dt, n] of STEPS) bb.push({ n, hard, ...bounce(dt, hard, (g, P) => bounceWish(g, P)) });
    console.log('  bounce skilled', JSON.stringify(bb.map(r => [r.n, r.hard, r.won, +r.secs.toFixed(0), r.log.join(' ')])));
    t.ok(bb.every(r => r.won && r.secs < 360 && r.combo === 3), `Balloon Bounce: a skilled bouncer (the right height, steering to where the balloon will be) wins all three rounds at 60 and 20 steps a second, also in a rematch, with x3 combos (${bb.map(r => `${r.n}${r.hard ? ' hard' : ''} ${r.secs.toFixed(0)} s`).join(', ')})`);
    const lazyB = [];
    for (const [name, br] of [['idle', () => ({})], ['holding Jump in one spot', () => ({ space: true })], ['random steering, Jump held', (g, P, t) => { const q = Math.floor(t / 0.7), a = hashn(q) * TAU; return { wx: Math.cos(a), wz: Math.sin(a), space: true }; }]]) for (const [dt, n] of STEPS) lazyB.push({ name, n, ...bounce(dt, false, br, 360) });
    t.ok(lazyB.every(r => !r.won && r.round === 1), `careless bouncing never gets past round 1 in 6 minutes (${[...new Set(lazyB.map(r => r.name))].join(', ')})`);
    {
      const g = new BounceGame(false); g.start(1);
      const i = BOUNCE_ROUNDS[1].balloons.findIndex(b => b.top), b = g.balloon(i);
      const below = g.update(0, { pos: { x: b.x, y: b.y - 1.5, z: b.z }, vy: 6, active: true });
      g.prev = null; const above = g.update(0, { pos: { x: b.x, y: b.y - 0.1, z: b.z }, vy: -6, active: true });
      t.ok(below.some(e => e.type === 'boop') && !below.some(e => e.type === 'pop') && above.some(e => e.type === 'pop' && e.i === i), 'a star balloon only boops when you come up under it, and pops when you come down onto it');
      const c = new BounceGame(false); c.start(2); const R = BOUNCE_ROUNDS[2], pts = [], none = { x: 0, y: 0, z: 0 };
      const hit = k => { const b2 = c.balloon(k); c.update(0, { pos: { x: b2.x, y: b2.y - 0.1, z: b2.z }, vy: -3, active: true }).forEach(e => e.type === 'pop' && pts.push(e.pts)); };
      const land = () => c.update(0, { landed: true, active: true, pos: none });
      hit(0); land(); hit(2); land(); hit(6); land(); land(); const kept = c.chain === 3; land(); const ended = c.chain === 0; hit(3);
      t.ok(pts.join() === '1,4,9,1' && kept && ended && R.respawn === 2.5, `combo: a pop on every bounce counts x1, x2, x3 (a star at x2 = 4, a gold one at x3 = 9); one bounce without a pop keeps it, two in a row end it (${pts})`);
      let outCol = 0;
      for (const hard of [false, true]) for (let r = 0; r < 3; r++) { const g2 = new BounceGame(hard); g2.start(r); for (let s2 = 0; s2 < 40; s2 += 0.25) { g2.t = s2; g2.spec.balloons.forEach((_, k) => { const p2 = g2.balloon(k); if (p2.x < TRAMP.x0 + 2 || p2.x > TRAMP.x1 - 1 || p2.z < TRAMP.z0 + 2 || p2.z > TRAMP.z1 - 1 || p2.y - 11 < 4) outCol++; }); } }
      t.ok(outCol === 0 && BOUNCE_ROUNDS.every(r => r.balloons.length <= 8), `every balloon of every round floats inside the trampoline's air column shrunk by 2 and at least 4 above the mat (${outCol} samples outside)`);
      let lzPop = 0;
      for (let s2 = 0; s2 < 60; s2 += 0.1) for (const y of [11, 12, 13]) for (let x = 190; x <= 205; x += 1) for (let z = 148; z <= 160; z += 1) if (BOUNCE_ROUNDS[0].balloons.some(b2 => G.touchesBalloon({ x, y, z }, balloonPath(b2, s2)))) lzPop++;
      t.ok(lzPop === 0, 'a lazy 2-block bounce (feet up to 2 above the mat) reaches no balloon of round 1 anywhere: you must hold Jump to climb');
    }
    let h = 0, bounces = [];
    for (let k = 0; k < 12 && h < TRAMP.max; k++) { h = nextBounce(h, true).h; bounces.push(h); }
    t.ok(bounces.join() === '2,4,6,8,10,12,13' && Math.abs(nextBounce(13, true).vy ** 2 / 56 - 13) < 1e-9, `holding Jump gives bounces of ${bounces.join(', ')} blocks (7 bounces to the top, apex 13)`);
    let down = 13; const d2 = []; while (down > TRAMP.min) { down = nextBounce(down, false).h; d2.push(down); }
    t.ok(d2.join() === '11.5,10,8.5,7,5.5,4,2.5,2', `letting go comes down step by step (${d2.join(', ')})`);

    /* -------- Gold Ring Ride: one lap per round, faster each round */
    const ride = (dt, hard, brain, limit = 420) => {
      const seat = new Seat(hard); seat.reset(0, 0.3, 2); seat.jumpHeld = false;
      let t = 0, k = 0; const log = [];
      while (t < limit) {
        const { radial, space } = brain(seat, k++, t);
        seat.steer(radial, space);
        const ev = seat.update(dt); t += dt;
        if (ev.lap) { log.push(`${ev.lap.won ? 'won' : 'again'}${ev.lap.round + 1}:${ev.lap.score}/${ev.lap.need}`); if (ev.lap.done) return { won: true, secs: t, log }; }
      }
      return { won: false, secs: t, log, round: seat.round + 1 };
    };
    const rr = [];
    for (const hard of [false, true]) for (const [dt, n] of STEPS) rr.push({ n, hard, ...ride(dt, hard, ringWish) });
    console.log('  rings skilled', JSON.stringify(rr.map(r => [r.n, r.hard, r.won, +r.secs.toFixed(0), r.log.join(' ')])));
    t.ok(rr.every(r => r.won && r.log.length === 3), `Gold Ring Ride: the skilled lane-and-hop schedule wins each round on its first lap at 60 and 20 steps a second, also in a rematch (${rr.map(r => r.log.join(' ')).join(' | ')})`);
    const ringCareless = [];
    const oneLane = l => (seat, k, t) => ({ radial: seat.to !== l ? (l > seat.to ? 1 : -1) * (k % 2) : 0, space: Math.floor(t / 0.3) % 2 === 0 });
    for (const [name, br] of [['idle', () => ({ radial: 0, space: false })], ['lane 0, hopping', oneLane(0)], ['lane 1, hopping', oneLane(1)], ['lane 2, hopping', oneLane(2)], ['no hops', (s, k) => ({ ...ringWish(s, k), space: false })],
      ['a random stick and Jump', (s, k, t) => { const q = Math.floor(t / 0.35); return { radial: hashn(q) < 0.3 ? -1 : hashn(q) > 0.7 ? 1 : 0, space: hashn(q + 9) < 0.4 }; }]]) for (const [dt, n] of STEPS) ringCareless.push({ name, n, ...ride(dt, false, br, 360) });
    t.ok(ringCareless.every(r => !r.won && r.round <= 2), `careless riding never wins in 6 minutes: ${[...new Set(ringCareless.map(r => `${r.name} (round ${r.round})`))].join(', ')}`);
    t.ok([0, 1, 2].every(r => ringNeed(r) > ringTotal(r) / 2 && ringNeed(r) < ringTotal(r)) && omegaOf(false, 2) > omegaOf(false, 1) && omegaOf(false, 1) > omegaOf(false, 0) && omegaOf(true, 0) > omegaOf(false, 0), `each round needs most of its points (${RING_ROUNDS.map((_, r) => `${ringNeed(r)} / ${ringTotal(r)}`).join(', ')}) and the carousel turns faster each round (${RING_ROUNDS.map((_, r) => omegaOf(false, r)).join(', ')} rad/s)`);
    let tight = 0;
    RING_ROUNDS.forEach((R, r) => R.rings.forEach((ring, i) => {
      const nx = R.rings[(i + 1) % R.rings.length]; let d = (nx.a - ring.a) % TAU; if (d < 0) d += TAU; const sec = d / omegaOf(true, r);
      if (nx.lane === ring.lane || sec < 0.55 || (Math.abs(nx.lane - ring.lane) === 2 && sec < 0.7) || (nx.high && ring.high && sec < 0.8)) tight++;
    }));
    t.ok(tight === 0, 'two rings in a row are always in different lanes, at least 0.55 s apart (a two-lane swap 0.7 s, two high ones 0.8 s) even in a rematch');
    {
      const s1 = new Seat(false); s1.round = 1; const w1 = s1.omega; s1.misses = 2; const w2 = s1.omega;
      t.ok(Math.abs(w2 / w1 - 0.9) < 1e-9, `the kind help: after two missed laps the carousel turns 10 % slower (${w1} -> ${w2.toFixed(3)})`);
    }

    // The coaster path
    const tr = makeCoaster(COASTER);
    let jump = 0, slow = 99, fast = 0;
    for (let s = 0; s < tr.time; s += 0.05) { const a = tr.at(s), b = tr.at(s + 0.05); if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > Math.max(a.v, b.v) * 0.05 + 0.02) jump++; slow = Math.min(slow, a.v); fast = Math.max(fast, a.v); }
    t.ok(jump === 0 && slow >= 1.5 && fast < 30, `the coaster's at(t) is continuous (speeds ${slow.toFixed(1)} to ${fast.toFixed(1)} blocks per second, ${tr.time.toFixed(1)} s)`);
    const top = tr.samples[tr.topIdx];
    t.ok(Math.abs(top[1] - 34) < 0.2 && top[0] < 122 && tr.at(0).x === 166.5 && Math.abs(tr.at(tr.time).x - 206.5) < 1e-9, 'it starts at the station (166.5, 12, 173.5), climbs the lift hill to y 34 at the west end and ends at the stage (206.5, 24, 201.5)');
  }

  if (ONLY === 'land' || ONLY === 'games') return; // (the pure parts need no browser page)
  const page = await retry(() => openGame(browser, base));
  page.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await newGame(page, 0); await pause(page);
  await page.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });

  /* ---------------------------------------------------------------- A. Data, shapes, moves, effects */
  if (want('data')) {
    const A = await page.evaluate(async ids => {
      const S = await import('/src/species.js'), SH = await import('/src/shapes.js'), R = await import('/src/fxrecipes.js'), RL = await import('/src/realms.js');
      const Tr = await import('/src/traits.js'), THREE = await import('three'), Bk = await import('/src/blocks.js'), Pb = await import('/src/pictureboss.js');
      const old = await (await fetch('/tests/fixtures/old-chart.json')).json();
      const g = window.pokecraft, out = { problems: [] };
      const bad = (id, m) => out.problems.push(`${id}: ${m}`);
      const all = Object.entries(S.SPECIES), mine = all.filter(([, s]) => s.type === 'funfair').map(([id]) => id);
      out.mine = mine.slice().sort();
      out.shapes = [...new Set(mine.map(id => S.SPECIES[id].model.shape))].sort();
      out.shapesRegistered = out.shapes.every(sh => typeof SH.SHAPES[sh] === 'function');
      out.ownShapes = out.shapes.every(sh => all.every(([, s]) => s.model.shape !== sh || s.type === 'funfair'));
      out.evolve = ['merrycolt', 'flufflamb', 'twistpup'].map(id => `${id}>${S.SPECIES[id].evolve?.into}@${S.SPECIES[id].evolve?.level}`);
      out.single = !S.SPECIES.tixit.evolve;
      const names = all.map(([, s]) => s.name.toLowerCase());
      const bulb = new THREE.Color(0xffe27a);
      for (const id of ids) {
        const s = S.SPECIES[id];
        if (!s) { bad(id, 'missing'); continue; }
        if (s.type !== 'funfair') bad(id, `type ${s.type}`);
        if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(id, 'name is not unique');
        if (!s.desc || s.desc.length > 125) bad(id, `desc is ${s.desc?.length} characters`);
        if (S.makeCreature(id, 5).moves.length < 2) bad(id, 'fewer than 2 moves at Lv 5');
        if (!S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === 'funfair')) bad(id, 'no funfair move at Lv 20');
        for (const [, m] of s.learn) if (!S.MOVES[m]) bad(id, `move ${m} missing`);
        for (const [biome, list] of Object.entries(S.SPAWNS)) if (list.some(e => e[0] === id)) bad(id, `in the main world's ${biome} table`);
        try {
          const m = S.buildModel(id);
          S.animateModel(m, 0, false);
          const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
          if (size.y < 0.35 || size.y > 2.8) bad(id, `height ${size.y.toFixed(2)}`);
          if (size.x > 2.8 || size.z > 2.8) bad(id, `width/depth ${size.x.toFixed(2)}/${size.z.toFixed(2)}`);
          let min = box.min.y;
          for (const [tm, mv] of [[0.3, false], [0.7, true], [1.1, false], [1.9, true], [2.6, true]]) { S.animateModel(m, tm, mv); min = Math.min(min, new THREE.Box3().setFromObject(m).min.y); }
          if (min < -0.1) bad(id, `goes under the ground (${min.toFixed(2)})`);
          const sig = () => { let sum = 0; m.updateMatrixWorld(true); m.traverse(o => { if (o.isMesh) for (const v of o.matrixWorld.elements) sum += v; }); return sum; };
          S.animateModel(m, 0.3, false); const a = sig(); S.animateModel(m, 1.1, false); const b = sig();
          if (Math.abs(a - b) < 1e-6) bad(id, 'no idle animation');
          const gear = []; m.traverse(o => { if (o.userData.gear === 'bulbs') gear.push(o); });
          if (gear.length !== 1) bad(id, `${gear.length} bulb meshes (one merged mesh per model)`);
          else {
            const o = gear[0], col = o.geometry.attributes.color;
            let n = 0; for (let i = 0; i < col.count; i++) if (Math.abs(col.getX(i) - bulb.r) < 1e-3 && Math.abs(col.getY(i) - bulb.g) < 1e-3 && Math.abs(col.getZ(i) - bulb.b) < 1e-3) n++;
            if (n % 24 || n / 24 < 5 || n / 24 > 9) bad(id, `${n / 24} bulbs`);
            if (!(o.material.isMeshBasicMaterial && !o.material.emissive)) bad(id, 'the bulbs are not unlit');
          }
          S.disposeModel(m);
        } catch (e) { bad(id, `model failed: ${e.message}`); }
      }
      const M = S.MOVES, m6 = ['tickettoss', 'bumperbash', 'ziprider', 'funhouse', 'grandgallop', 'balloonburst'], m3 = ['funforall', 'prizewheel', 'fairday'];
      out.moves = [...m6, ...m3].map(id => M[id]?.type);
      out.fine = M.ziprider.priority === 1 && M.funhouse.fx?.kind === 'lower' && M.funhouse.fx.stat === 'atk' && M.bumperbash.fx?.kind === 'flinch' && M.tickettoss.power === 40;
      out.sig = !!M.grandgallop.sig && !!M.balloonburst.sig && M.balloonburst.fx?.kind === 'multi' && M.balloonburst.fx.min === 2 && M.balloonburst.fx.max === 5
        && S.SPECIES.galloprance.learn.some(([l, m]) => l === 30 && m === 'grandgallop') && S.SPECIES.balloodle.learn.some(([l, m]) => l === 30 && m === 'balloonburst');
      out.sigOnly = all.filter(([, s]) => s.learn.some(([, m]) => m === 'grandgallop' || m === 'balloonburst')).map(([id]) => id).sort().join();
      out.big = m3.map(id => [M[id].fx.kind, !!M[id].big]);
      out.bigLearn = S.SPECIES.merrycolt.learn.filter(([, m]) => m3.includes(m)).map(x => x.join(':'));
      out.t1 = S.makeCreature('merrycolt', 1).moves.includes('tickettoss');
      // the chart: its own row, four cells against it, every old cell unchanged
      const types = Object.keys(S.TYPE_COLORS), olds = Object.keys(old);
      out.types = types.length;
      out.ownRow = types.filter(x => S.effectiveness('funfair', x) !== 1).map(x => `${x}:${S.effectiveness('funfair', x)}`).sort().join();
      const known = [...olds, 'tiny', 'pirate', 'racer', 'ball']; // (the types of wave 14; the other wave 15 types may add their own cells)
      out.vs = types.filter(x => known.includes(x) && x !== 'funfair' && S.effectiveness(x, 'funfair') !== 1).map(x => `${x}:${S.effectiveness(x, 'funfair')}`).sort().join();
      out.oldChart = olds.every(a => olds.every(d => S.effectiveness(a, d) === (old[a][d] ?? 1)));
      out.hits = known.filter(x => S.effectiveness('funfair', x) === 2).length;
      out.color = S.TYPE_COLORS.funfair;
      out.wool = [Bk.WOOL.funfair, Bk.BLOCKS[Bk.WOOL.funfair]?.name, Bk.PLACEABLE.includes(Bk.WOOL.funfair)];
      out.fxOwn = R.TRAVEL.funfair !== R.TRAVEL.normal && R.IMPACT.funfair !== R.IMPACT.normal && R.FX_COLORS.funfair !== R.FX_COLORS.normal;
      out.sigFx = typeof R.SIG.grandgallop === 'function' && typeof R.SIG.balloonburst === 'function';
      const sounds = ['fx:funfair', 'balloonpop', 'ringding', 'honkhonk', 'coasterclack', 'ticketprize', 'fairtune'];
      out.sounds = sounds.map(n => g.sound.has(n));
      try { for (const n of sounds) g.sound.play(n); out.played = true; } catch (e) { out.played = e.message; }
      out.soundErrors = g.sound.errors.length;
      out.soundClash = [...m6, ...m3].filter(id => g.sound.has(id));
      const spawns = RL.REALMS.playland.spawns;
      out.realm = (spawns.fair || []).map(e => e[0]).sort().join();
      out.realmElsewhere = Object.entries(spawns).filter(([k]) => k !== 'fair').some(([, l]) => l.some(e => ids.includes(e[0])));
      out.rideable = Tr.TRAITS.rideable.species.galloprance;
      out.levels = [RL.REALMS.playland.levelBonus, RL.REALMS.playland.levelCap];
      out.zone = RL.REALMS.playland.zoneNames.fair;
      // Merry Mae: top level 64, four creatures, the move lists are what movesWith gives
      const mae = Pb.bossOf('fair');
      out.mae = { name: mae.name, top: Math.max(...mae.team.map(x => x[1])), n: mae.team.length, type: mae.type, look: mae.look, crew: mae.crew.map(c => c.name).join(), gate: typeof mae.gate, notes: !!mae.note && !!mae.lose && !!mae.win && mae.intro.length === 2 && !!mae.rematchIntro };
      out.maeMoves = mae.team.filter(x => x[2]).every(([id, lv, mv]) => JSON.stringify(S.movesWith(id, lv, 'grandgallop', 'funforall', 'bumperbash').slice().sort()) === JSON.stringify(mv.slice().sort()));
      out.maeSpecies = [...mae.team, ...mae.crew.flatMap(c => c.team)].every(x => S.SPECIES[x[0]]);
      out.frame = (await import('/src/pictureworlds.js')).pictureWorld('fair');
      out.frame = { ready: out.frame.ready, realm: out.frame.realm, place: out.frame.place, name: (await import('/src/pictureworlds.js')).fullName(out.frame) };
      return out;
    }, IDS);
    t.ok(JSON.stringify(A.mine) === JSON.stringify([...IDS].sort()), `seven Funfair species (${A.mine})`);
    t.ok(A.evolve.join() === 'merrycolt>galloprance@24,flufflamb>candyram@22,twistpup>balloodle@22' && A.single, `three two-stage families and a single-stage Tixit (${A.evolve})`);
    t.ok(A.shapes.join() === 'balloondog,carouselhorse,flosssheep,ticket' && A.shapesRegistered && A.ownShapes, `four own Funfair shapes (${A.shapes}), registered in SHAPES, used by no other type`);
    t.ok(!A.problems.length, `all seven pass the data and model checks (one merged bulb mesh of 5-9 unlit bulbs, size, animation, only in Playland) ${A.problems.join('; ')}`);
    t.ok(A.moves.every(m => m === 'funfair') && A.fine && A.t1, `the nine moves are Funfair moves; Zip Ride goes first, Fun House lowers attack (${A.moves})`);
    t.ok(A.sig && A.sigOnly === 'balloodle,galloprance', `Grand Gallop (Galloprance, flinch) and Balloon Burst (Balloodle, multi 2-5) are signature moves learned at 30 (${A.sigOnly})`);
    t.ok(JSON.stringify(A.big) === JSON.stringify([['rally', true], ['risky', true], ['field', true]]) && A.bigLearn.join() === '22:funforall,26:fairday,29:prizewheel', `big moves Fun for All (rally), Prize Wheel (risky), Fair Day (field) (${A.bigLearn})`);
    t.ok(A.types >= 38 && A.ownRow === 'cozy:2,funfair:0.5,metal:0.5,normal:2,rainbow:2,rock:0.5' && A.hits === 3, `the Funfair row: cozy, normal and rainbow 2, metal and rock and itself 0.5 (${A.ownRow}); it hits 3 types hard`);
    t.ok(A.vs === 'ball:0.5,electric:2,sound:0.5,toxic:2,water:2' && A.oldChart, `against it: water, toxic and electric 2, sound and ball 0.5 (${A.vs}); every cell of the old chart is unchanged`);
    t.ok(/repeating-linear-gradient/.test(A.color) && A.wool[0] === 224 && A.wool[1] === 'Funfair Wool' && A.wool[2] === false, `a type colour, wool block 224 "${A.wool[1]}" (not placeable)`);
    t.ok(A.fxOwn && A.sigFx, 'funfair attack effects, colours and the two signature effects exist');
    t.ok(A.sounds.every(Boolean) && A.played === true && !A.soundErrors && !A.soundClash.length, `fx:funfair and the six fair sounds exist and play, no move is named like a sound (${A.played})`);
    t.ok(A.realm === [...IDS].sort().join() && !A.realmElsewhere && A.zone === 'Playland · Funfair', `all seven spawn only in Playland's fair zone ("${A.zone}")`);
    t.ok(A.rideable === 'land', `Galloprance can be ridden (land) (${A.rideable})`);
    t.ok(A.levels.join() === '33,45', `wild creatures in Playland are level +33, at most 45 (${A.levels})`);
    t.ok(A.mae.name === 'Merry Mae' && A.mae.top === 64 && A.mae.n === 4 && A.mae.type === 'funfair' && A.mae.look === 'fair' && A.mae.crew === 'Bumper Bea,Bouncy Ben' && A.mae.gate === 'function' && A.mae.notes, `Merry Mae: top level 64, four creatures, her words, a gate and her crew (${JSON.stringify(A.mae)})`);
    t.ok(A.maeMoves && A.maeSpecies, "Mae's named move lists are what movesWith gives");
    t.ok(A.frame.ready && A.frame.realm === 'playland' && A.frame.name === 'Playland · Funfair', `the Funfair frame is ready and opens Playland (${A.frame.name})`);
    t.ok(FF.FUNFAIR_SPAWNS.length === 7 && FF.FAIR_WALK.join() === String(B.FAIR_FLOOR), 'FUNFAIR_SPAWNS lists the seven; wild ones walk on the fair floor only');

    // portraits, and the seven in the world
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
    save('t43-creatures.png', shots.grid);
    for (const id of IDS) save(`t43-creature-${id}.png`, shots.singles[id]);
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
    await shot(page, 't43-funfair-creatures.png');
    await page.evaluate(() => window.pokecraft.creatures.clear());
    if (ONLY === 'data') return;
  }

  /* ---------------------------------------------------------------- D. Playing the fair (browser, by hand) */
  if (want('play')) {
    await intoFair(page);
    await arm(page);
    const D0 = await page.evaluate(() => {
      const R = window.__R, { g, live, p } = R;
      p.pos.set(166.5, 11, 126.5); p.update(0.02);
      live.step(0.05);
      const told = R.said('The Funfair! Win 3 golden tickets');
      R.put(166.5, 11, 138); live.step(0.05);
      return { place: g.place, parts: g.world.parts.map(x => x.id).join(), told, aim: live.aim(p.pos)?.text('↑', 20), chip: document.getElementById('score-chip')?.textContent, tess: !!R.tess(), mae: !!R.mae(), crew: [R.crew(0)?.name, R.crew(1)?.name].join(), meshes: live.groups.length };
    });
    t.ok(D0.place === 'playland' && D0.parts === 'race,stadium,fair' && D0.told && D0.tess && D0.mae && D0.crew === 'Bumper Bea,Bouncy Ben', `the Funfair frame opens Playland; the arrival toast, Ticket Tess, Merry Mae and her crew are there (${D0.crew})`);
    t.ok(/Bumper Cars|Balloon Bounce|Gold Ring Ride/.test(D0.aim) && /🎟️ 0 \/ 3/.test(D0.chip), `the guide leads to a game ("${D0.aim}") and the chip says ${D0.chip}`);
    // the words of the big button
    const D1 = await page.evaluate(() => {
      const R = window.__R, { g, live, p } = R, w = {};
      R.put(145.3, 11, 145.2); w.car = live.near(p);
      R.put(175.8, 11, 153.5); w.deck = live.near(p);
      R.put(166.5, 12, 171.5); w.station = live.near(p); w.stationUse = live.use(p); w.stationToast = R.said('Win 3 golden tickets first! 🎟️ 0 / 3'); w.stationCarry = !!p.carry;
      R.put(197.5, 24, 197.5); w.slide = live.near(p);
      R.put(120, 11, 130); w.away = live.near(p);
      const tess = R.tess(); w.tessPrompt = g.gymLive.talkPrompt(tess); g.talkTo(tess); w.tessLine = R.said('Three games, three golden tickets, one big coaster! \\(🎟️ 0 / 3\\)');
      const mae = R.mae(); w.maePrompt = g.gymLive.talkPrompt(mae); g.talkTo(mae); w.gate = R.said('Win 3 golden tickets at the games! Then ride the coaster up to me. \\(🎟️ 0 / 3\\)');
      return w;
    });
    t.ok(D1.car === 'Drive!' && D1.deck === 'Ride!' && D1.station === 'Ride!' && D1.slide === 'Slide!' && D1.away === null, `the big button says Drive! by a car, Ride! at the carousel and the coaster, Slide! on the stage (${JSON.stringify([D1.car, D1.deck, D1.station, D1.slide, D1.away])})`);
    t.ok(D1.stationUse && D1.stationToast && !D1.stationCarry, 'the coaster before three tickets: "Win 3 golden tickets first! 🎟️ 0 / 3" and nobody is carried');
    t.ok(D1.tessPrompt?.action === 'Talk' && D1.tessLine && D1.maePrompt?.action === 'Talk' && D1.gate, `Ticket Tess says her line with the ticket count; Mae's gate says what to do (button "${D1.maePrompt?.action}")`);

    // wild Funfair creatures spawn and walk only on the fair floor (never in the arena, on the mat or on the deck)
    const D1w = await page.evaluate(async ids => {
      const R = window.__R, { g, p } = R, cm = g.creatures, { B } = await import('/src/blocks.js');
      cm.clear(); R.put(166.5, 11, 150);
      const seen = new Set(); let bad = 0, steps = 0;
      for (let k = 0; k < 160; k++) {
        cm.spawnTimer = 0; cm.update(0.5, p.pos, g.spawnPoint, false);
        for (const w of cm.list) { seen.add(w.data.species); const x = Math.floor(w.pos.x), z = Math.floor(w.pos.z); steps++; if (g.world.get(x, 10, z) !== B.FAIR_FLOOR) bad++; }
      }
      const out = { seen: [...seen].sort(), bad, steps };
      cm.clear();
      return out;
    }, IDS);
    t.ok(D1w.seen.length >= 1 && D1w.seen.every(id => IDS.includes(id)) && D1w.bad === 0, `wild creatures appear in the fair and only of the Funfair type (${D1w.seen.join()}), always on the fair floor (${D1w.bad} of ${D1w.steps} samples elsewhere)`);

    // Bumper Cars: drive, side bump, pop all six, the ticket
    await page.evaluate(() => { const R = window.__R; R.put(145.3, 11, 145.2); R.live.use(R.p); });
    const D2 = await page.evaluate(() => {
      const R = window.__R, { g, live, p, G } = R;
      const out = { carried: p.carry === live.carObj, drive: live.drive, word: live.near(p), told: R.said('Bump the balloon on the BACK of a car!') };
      // a car that goes where you wish: full stick, then let go (it glides on)
      live.carObj.steer(-1, 0, 1, false); for (let k = 0; k < 30; k++) live.step(1 / 30);
      out.moved = live.car.vx < -1; live.carObj.steer(0, 0, 0, false); const v0 = live.car.speed; for (let k = 0; k < 30; k++) live.step(1 / 30);
      out.glides = live.car.speed > 0.5 && live.car.speed < v0;
      out.posFollows = Math.hypot(p.pos.x - live.car.x, p.pos.z - live.car.z) < 1e-6 && p.pos.y > 11;
      // a honk
      live.carObj.steer(0, 0, 0, true); live.step(0.03); out.honk = g.sound.played.includes('honkhonk'); live.carObj.steer(0, 0, 0, false);
      // careless first: sitting still in the car until the round's clock runs out (round 1 simply starts again)
      const left0 = live.bump.left; let idle = 0;
      while (live.bump.misses === 0 && idle < 60) { live.carObj.steer(0, 0, 0, false); live.step(1 / 30); idle += 1 / 30; }
      out.idle = { secs: idle, misses: live.bump.misses, round: live.bump.round, left0, again: R.said('Time is up! Round 1 again. You can do it!'), chip: document.getElementById('score-chip')?.textContent };
      // then a skilled driver (chase the back, back off from a spinner that faces you) through the three rounds
      let t = 0; const memo = {};
      while (!g.beaten.includes('pw:fair:ticket1') && t < 400) {
        if (live.drive < 0) { R.put(145.3, 11, 145.2); live.use(p); } // (out through the gate by chance: in again)
        const wish = G.skilledWish(memo, live.bump);
        live.carObj.steer(wish.x, wish.z, 1, false); live.step(1 / 30); t += 1 / 30;
      }
      out.secs = t; out.wins = live.bump.wins; out.side = R.said('Boing! Get behind it!'); out.popToast = R.said('🎈 Pop! 1 / 4') && R.said('🎈 Pop! 5 / 5') && R.said('🎈 Pop! 6 / 6'); // owner 2026-10-27: 4, 5 and 6 balloons
      out.rounds = R.said('Round 2: Zoomers!') && R.said('Round 3: Spinners'); out.zoom = R.said('Zoom! It saw you coming') && g.sound.played.includes('botzoom') || window.__toasts.some(m => /Zoom!/.test(m));
      out.ticket = g.beaten.includes('pw:fair:ticket1'); out.toast = R.said('Golden ticket! 🎟️ 1 / 3');
      out.board = [161, 165, 169].map(x => g.world.get(x, 16, 133)).join();
      out.sounds = ['balloonpop', 'ticketprize'].every(n => g.sound.played.includes(n));
      const saved = (g.save(), JSON.parse(localStorage.getItem('pokecraft-save-v2')));
      out.saved = saved.beaten.includes('pw:fair:ticket1');
      out.chipWhileDriving = document.getElementById('score-chip')?.textContent;
      return out;
    });
    // a picture from the driver's seat (round 3: all six balloons), then Get out
    await page.evaluate(() => { const R = window.__R, { live, p } = R; live.bump.start(2); live.car.reset(123.5, 160.5, 0); live.step(0.03); p.lookAt({ x: 136, y: 11.6, z: 151 }); });
    await frames(page, 2);
    await shot(page, 't43-bumper.png').catch(() => {});
    D2.out = await page.evaluate(() => { const R = window.__R, { live, p } = R; live.use(p); return { carry: !!p.carry, drive: live.drive, word: live.near(p) }; });
    console.log('  D2', JSON.stringify(D2));
    t.ok(D2.carried && D2.drive === 0 && D2.told && D2.moved && D2.glides && D2.posFollows, `Drive! puts you in the car (the first hint "Bump the balloon on the BACK of a car!"); the stick drives it and it glides on when you let go`);
    t.ok(D2.idle.misses === 1 && D2.idle.again && D2.idle.round === 0 && Math.abs(D2.idle.secs - D2.idle.left0) < 0.2 && /Round 1\/3 · 🎈 0 \/ 4 · ⏱/.test(D2.idle.chip), `careless: sitting still in the car pops nothing; after ${D2.idle.secs.toFixed(0)} s "Time is up! Round 1 again." (the chip: "${D2.idle.chip}")`);
    t.ok(D2.wins === 1 && D2.ticket && D2.toast && D2.popToast && D2.rounds && D2.secs < 400 && D2.honk, `a skilled driver wins the three rounds (warm-up, zoomers, spinners) in ${D2.secs.toFixed(0)} s: golden ticket 1; honk, pop, zoom and ticket sounds`);
    t.ok(D2.board.startsWith(String(B.LAMP)) && D2.saved, `the board's first slot lights (block ${D2.board}) and the ticket is saved at once`);
    t.ok(D2.out.carry === false && D2.out.drive === -1 && D2.out.word === 'Drive!', 'Get out parks the car and puts you beside it; Drive! is offered again');

    // Balloon Bounce: the real Player on the trampoline. Careless first (holding Jump in one spot until the clock runs out), then a skilled
    // bouncer (fairgames.bounceWish) through the three rounds, at 60 and at 20 steps a second.
    const D3 = await page.evaluate(() => {
      const R = window.__R, { g, live, p, G } = R, out = {};
      const runGame = (dt, limit, brain) => {
        let t = 0; const w0 = live.bounce.wins;
        while (t < limit && live.bounce.wins === w0) {
          const c = brain();
          p.yaw = Math.atan2(-c.wx, -c.wz); const k = Math.hypot(c.wx, c.wz);
          p.joy = k > 0.16 ? { x: 0, y: -Math.min(0.94, k) } : null; p.keys = { Space: !!c.space };
          p.update(dt); live.step(dt); t += dt;
        }
        p.joy = null; p.keys = {};
        return { won: live.bounce.wins > w0, secs: t };
      };
      R.put(198.5, 11, 154.5); p.trampH = 0; live.bounce = new G.BounceGame(false);
      const lazy = runGame(1 / 30, 75, () => ({ wx: 0, wz: 0, space: true }));
      out.lazy = { ...lazy, misses: live.bounce.misses, round: live.bounce.round, again: R.said('Time is up! Round 1 again'), chip: document.getElementById('score-chip')?.textContent };
      for (const [dt, n] of [[1 / 60, '60'], [1 / 20, '20']]) {
        R.put(198.5, 11, 154.5); p.trampH = 0; live.bounce = new G.BounceGame(false); live.trampN = p.trampN;
        const r = runGame(dt, 420, () => G.bounceWish(live.bounce, { x: p.pos.x, y: p.pos.y, z: p.pos.z, vy: p.vel.y, h: p.trampH || 0 }));
        out[n] = { ...r, misses: live.bounce.misses };
        for (let k = 0; k < 40; k++) { p.update(1 / 30); live.step(1 / 30); } // let go and settle
      }
      out.ticket = g.beaten.includes('pw:fair:ticket2'); out.toast = R.said('Golden ticket! 🎟️ 2 / 3');
      out.rounds = R.said('Round 2: Wobbly balloons!') && R.said('Round 3: Combo!'); out.combo = window.__toasts.some(m => /combo x3!/.test(m)); out.again = R.said('You beat all 3 rounds of Balloon Bounce again!');
      out.board = [161, 165, 169].map(x => g.world.get(x, 16, 133)).join();
      return out;
    });
    console.log('  D3', JSON.stringify(D3));
    t.ok(!D3.lazy.won && D3.lazy.misses >= 1 && D3.lazy.round === 0 && D3.lazy.again, `careless: holding Jump in one spot for ${D3.lazy.secs.toFixed(0)} s never pops all five balloons of round 1; "Time is up! Round 1 again."`);
    t.ok(D3['60'].won && D3['20'].won && D3.ticket && D3.toast && D3.rounds && D3.combo && D3.again && D3.board.split(',').slice(0, 2).every(v => +v === 43),
      `real Player physics: a skilled bouncer wins the three rounds (warm-up, wobblers and star balloons, combo x3) at 60 steps (${D3['60'].secs.toFixed(0)} s) and at 20 (${D3['20'].secs.toFixed(0)} s): golden ticket 2, the second slot lights`);
    const D3b = await page.evaluate(() => {
      const R = window.__R, { g, live, p, G } = R, out = {};
      // the climb: hold Jump on the mat, apex of every bounce; then let go; then walk off
      for (const dt of [1 / 60, 1 / 20]) {
        R.put(190.5, 11, 148.5); p.trampH = 0; p.keys = { Space: true };
        const apexes = []; let peak = 0, rising = false;
        for (let k = 0; k < 60 * 25 && apexes.length < 9; k++) {
          p.update(dt); const y = p.pos.y - 11;
          if (p.vel.y > 0) { rising = true; peak = Math.max(peak, y); } else if (rising) { apexes.push(+peak.toFixed(1)); rising = false; peak = 0; }
        }
        out[`up${dt === 1 / 60 ? 60 : 20}`] = apexes;
      }
      R.put(190.5, 11, 148.5); p.trampH = 0; p.keys = { Space: true };
      for (let k = 0; k < 60 * 20 && p.trampH < 13; k++) p.update(1 / 60);
      out.top = p.trampH;
      p.keys = {}; let downs = 0, last = p.trampH; for (let k = 0; k < 60 * 30 && p.trampH > 2; k++) { p.update(1 / 60); if (p.trampH !== last) { downs++; last = p.trampH; } }
      out.down = p.trampH; out.downs = downs;
      // landing off the mat stops the bouncing: walk off the edge at the top
      R.put(190.5, 11, 148.5); p.trampH = 0; p.keys = { Space: true };
      for (let k = 0; k < 60 * 20 && p.trampH < 8; k++) p.update(1 / 60);
      p.keys = { KeyW: true }; p.yaw = Math.PI; // walk north (-z... yaw PI looks +z? the facing does not matter: just keep walking one way)
      p.yaw = 0; // forward = (0, -1)
      let off = false; for (let k = 0; k < 60 * 20; k++) { p.update(1 / 60); if (p.pos.z < 145 && p.onGround) { off = true; break; } }
      p.keys = {}; const h0 = p.trampH;
      let bounced = false; for (let k = 0; k < 60 * 3; k++) { p.update(1 / 60); if (p.vel.y > 1) bounced = true; }
      out.off = off; out.afterH = p.trampH; out.stopped = !bounced && p.onGround; out.h0 = h0;
      return out;
    });
    console.log('  D3b', JSON.stringify(D3b));
    t.ok(JSON.stringify(D3b.up60.slice(0, 7)) === '[2,4,6,8,10,12,13]' || (D3b.up60.slice(0, 7).every((a, i) => Math.abs(a - [2, 4, 6, 8, 10, 12, 13][i]) < 0.45) && D3b.up20.slice(0, 7).every((a, i) => Math.abs(a - [2, 4, 6, 8, 10, 12, 13][i]) < 0.8)), `holding Jump: the apex of each bounce is 2, 4, 6, 8, 10, 12, 13 blocks at 60 and at 20 steps a second (${D3b.up60.slice(0, 8)} / ${D3b.up20.slice(0, 8)})`);
    t.ok(D3b.top === 13 && D3b.down === 2 && D3b.downs >= 6 && D3b.off && D3b.stopped && D3b.afterH === 0, `letting go comes down step by step to 2 and landing off the mat stops the bouncing (top ${D3b.top}, down ${D3b.down}, steps ${D3b.downs}, stopped ${D3b.stopped})`);
    await page.evaluate(() => { const R = window.__R; R.put(198.5, 11, 154.5); R.p.trampH = 0; R.live.bounce.start(1); });
    await page.evaluate(() => { const R = window.__R; R.p.pos.set(190.5, 19.5, 148.5); R.p.vel.set(0, 3, 0); R.p.lookAt({ x: 198, y: 18.5, z: 154 }); R.live.step(0.03); });
    await frames(page, 2);
    await shot(page, 't43-bounce.png').catch(() => {});

    // Gold Ring Ride: the schedule through the live part
    const D4 = await page.evaluate(() => {
      const R = window.__R, { g, live, p, G } = R, out = {};
      R.put(175.6, 11, 153.5);
      out.word = live.near(p); live.use(p);
      out.carried = p.carry === live.seatObj && live.riding; out.told = R.said('Push the stick in or out to change horses. Jump for high rings!');
      g.save(); { const at = JSON.parse(localStorage.getItem('pokecraft-save-v2')).realmPos; out.savedAt = [at[0], at[1], at[2]]; out.savedOnDeck = Math.hypot(at[0] - 166.5, at[2] - 153.5) < 9.5 && at[1] === 12; }
      out.startY = p.pos.y; out.radius = Math.hypot(p.pos.x - 166.5, p.pos.z - 153.5);
      // joystick style: the stick pushed outwards / inwards (world direction x radial)
      // careless first: sitting on the outer horse for a whole lap (2 of round 1's 9 points): the lap starts again
      let idle = 0; while (live.seat.misses === 0 && idle < 20) { live.seatObj.steer(0, 0, 0, false); live.step(1 / 30); idle += 1 / 30; }
      out.idle = { secs: idle, misses: live.seat.misses, round: live.seat.round, again: R.said('You got 2 of 9 points! Round 1 again') };
      let t = 0, flip = 0; const dt = 1 / 30;
      while (t < 120 && !g.beaten.includes('pw:fair:ticket3')) {
        const { radial, space } = G.ringWish(live.seat, flip);
        flip++;
        // the same call Player.update makes: the stick as a world direction along the radius
        const dx = p.pos.x - 166.5, dz = p.pos.z - 153.5, d = Math.hypot(dx, dz) || 1;
        live.seatObj.steer((dx / d) * Math.sign(radial || 1), (dz / d) * Math.sign(radial || 1), Math.abs(radial), space);
        live.step(dt); t += dt;
        if (p.carry !== live.seatObj) break;
      }
      out.secs = t; out.rings = live.seat.caught.length; out.ticket = g.beaten.includes('pw:fair:ticket3'); out.toast = R.said('Golden ticket! 🎟️ 3 / 3'); out.toast10 = R.said('Round 2: Faster!') && R.said('Round 3: Gold rush!') && window.__toasts.some(m => /💍 \+3 gold!/.test(m));
      out.board = [161, 165, 169].map(x => g.world.get(x, 16, 133)).join(); out.sound = g.sound.played.includes('ringding');
      out.y = p.pos.y;
      live.use(p);
      out.off = { carry: !!p.carry, riding: live.riding, y: p.pos.y, onDeck: Math.hypot(p.pos.x - 166.5, p.pos.z - 153.5) < 9.5 };
      return out;
    });
    console.log('  D4', JSON.stringify(D4));
    t.ok(D4.word === 'Ride!' && D4.carried && D4.told && D4.startY >= 12 && Math.abs(D4.radius - 8.5) < 0.2 && D4.savedOnDeck, `Ride! puts you on an outer horse of the carousel (radius ${D4.radius.toFixed(1)}) with the hint; a save while you ride puts you on the deck (${D4.savedAt?.map(v => +v.toFixed(1))})`);
    t.ok(D4.idle.misses === 1 && D4.idle.again && D4.idle.round === 0 && D4.idle.secs > 12 && D4.idle.secs < 16, `careless: sitting on one horse for a lap (${D4.idle.secs.toFixed(1)} s) gets 2 of 9 points: "Round 1 again"`);
    t.ok(D4.ticket && D4.toast && D4.toast10 && D4.board.split(',').every(v => +v === 43) && D4.secs < 50, `lane changes and hops on time win the three rounds (one lap each, the carousel faster each time, gold rings 3 points) in ${D4.secs.toFixed(0)} s: golden ticket 3, all three slots lit`);
    t.ok(!D4.off.carry && !D4.off.riding && D4.off.onDeck && D4.off.y >= 12 && D4.off.y < 12.5, 'Get off puts you on the deck beside your horse');
    await page.evaluate(() => { const R = window.__R; R.put(175.6, 11, 153.5); R.live.use(R.p); R.p.lookAt({ x: 166.5, y: 14, z: 148 }); R.live.step(0.2); });
    await frames(page, 2);
    await shot(page, 't43-carousel.png').catch(() => {});
    await page.evaluate(() => { const R = window.__R; R.live.use(R.p); });

    // the three tickets: the ride, saved and reloaded
    const D5 = await page.evaluate(() => {
      const R = window.__R, { g, live, p, B } = R, out = {};
      live.step(0.03);
      out.n = R.F.ticketState(g).n; out.chip = document.getElementById('score-chip')?.textContent;
      out.lights = live.lit.lights; out.total = live.part.coaster.lights.length;
      out.litBlocks = live.part.coaster.lights.filter(([x, y, z]) => g.world.get(x, y, z) === B.LAMP).length;
      out.shutter = g.world.get(156, 13, 173);
      g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
      out.saved = ['pw:fair:ticket1', 'pw:fair:ticket2', 'pw:fair:ticket3'].every(k => s.beaten.includes(k)); out.save = JSON.stringify(s);
      R.put(166.5, 12, 171.5);
      out.aim = live.aim(p.pos)?.text('↑', 5);
      out.word = live.near(p); live.use(p);
      out.carried = !!p.carry && p.carry === live.coaster; out.told = R.said('All aboard! Hold on tight!');
      return out;
    });
    t.ok(D5.n === 3 && /Ride the coaster/.test(D5.chip) && D5.litBlocks === D5.total && D5.shutter === B.CANDY_STRIPE, `three tickets: the chip says "${D5.chip}", all ${D5.total} coaster lights are on, the shutter is shut until the car goes`);
    t.ok(D5.saved && D5.carried && D5.told && D5.word === 'Ride!' && /roller coaster/.test(D5.aim), `all three tickets are saved; the guide says "${D5.aim}"; Ride! at the station: "All aboard! Hold on tight!"`);
    // a reload in a fresh browser while the coaster is carrying us
    const midSave = await page.evaluate(() => { const R = window.__R, { g, live, p, B } = R; live.step(4); const open = g.world.get(156, 13, 173) === B.AIR; live.step(6); g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { carried: !!p.carry, y: p.pos.y, saved: s.realmPos, json: JSON.stringify(s), open, closed: g.world.get(156, 13, 173) === B.CANDY_STRIPE }; });
    t.ok(midSave.open && midSave.closed && midSave.carried && midSave.y > 12 && Math.abs(midSave.saved[0] - 166.5) < 1 && midSave.saved[1] === 12, `the shutter opened for the car and shut behind it; saved in the air on the coaster (y ${midSave.y.toFixed(1)}): the save says "back at the station" (${midSave.saved.slice(0, 3).map(v => v.toFixed(1))})`);
    const fresh = await retry(() => openGame(browser, base, { setup: seedSave(midSave.json) }));
    await continueGame(fresh);
    await waitFor(fresh, () => window.pokecraft.place === 'playland' && !window.pokecraft.realms.busy, null, 120000);
    const reloaded = await fresh.evaluate(async () => { const g = window.pokecraft, F = await import('/src/funfair.js'), p = g.player; return { st: F.ticketState(g), pos: [p.pos.x, p.pos.y, p.pos.z] }; });
    t.ok(reloaded.st.done && Math.hypot(reloaded.pos[0] - 166.5, reloaded.pos[2] - 173.5) < 3.5 && reloaded.pos[1] < 13.5, `a reload in a fresh browser: three tickets still there, standing at the station (${reloaded.pos.map(v => v.toFixed(1))})`);
    t.ok(!fresh.errors.length, `no page errors in the reloaded game ${fresh.errors.join('; ')}`);
    await fresh.context().close();
    // the ride itself
    const D6 = await page.evaluate(() => {
      const R = window.__R, { g, live, p, B } = R, out = { minY: 99, maxY: 0, bad: 0 };
      let t = 10; const dt = 1 / 30; // (the first 10 s were ridden above)
      while (live.coaster && t < 90) {
        live.step(dt); t += dt;
        if (!Number.isFinite(p.pos.x + p.pos.y + p.pos.z) || p.pos.x < 116 || p.pos.x > 216 || p.pos.z < 132 || p.pos.z > 216) out.bad++;
        out.minY = Math.min(out.minY, p.pos.y); out.maxY = Math.max(out.maxY, p.pos.y);
      }
      out.secs = t; out.end = [p.pos.x, p.pos.y, p.pos.z]; out.carry = !!p.carry; out.shutterAfter = g.world.get(156, 13, 173);
      out.clack = g.sound.played.includes('coasterclack'); out.told = R.said('Merry Mae is waiting on the Star Stage!');
      return out;
    });
    console.log('  D6', JSON.stringify(D6));
    t.ok(!D6.carry && D6.bad === 0 && D6.secs > 30 && D6.secs < 40 && D6.maxY > 33 && D6.minY < 14, `the coaster rides ${D6.secs.toFixed(0)} s from the station up to y ${D6.maxY.toFixed(0)}, down to y ${D6.minY.toFixed(0)} and ends on the stage, always inside the zone`);
    t.ok(Math.hypot(D6.end[0] - 206.5, D6.end[2] - 201.5) < 0.1 && Math.abs(D6.end[1] - 24) < 0.05 && D6.shutterAfter === B.CANDY_STRIPE && D6.clack && D6.told, 'it ends on the stage (206.5, 24, 201.5); the shutter is shut again; the chain clicks; "Merry Mae is waiting"');
    await page.evaluate(() => { const R = window.__R; R.put(190, 24, 190); R.p.pos.set(203.5, 24, 201.5); R.p.lookAt({ x: 213, y: 17, z: 206 }); R.live.step(0.03); });
    await frames(page, 2);
    await shot(page, 't43-stage.png').catch(() => {});
    await page.evaluate(() => { const R = window.__R, { g, live, p } = R; live.coaster = null; });

    // the coaster drop (a picture mid-ride)
    await page.evaluate(() => {
      const R = window.__R, { g, live, p } = R;
      R.put(166.5, 12, 171.5); live.use(p);
      for (let k = 0; k < 30 * 30; k++) { live.step(1 / 30); if (live.coaster.clock > 17.6) break; }
      const w = live.coasterPath.at(live.coaster.clock + 0.8);
      p.yaw = w.yaw; p.pitch = -0.38; // looking down the big drop
      live.step(0.03);
    });
    await frames(page, 2);
    await shot(page, 't43-coaster.png').catch(() => {});
    await page.evaluate(() => { const R = window.__R, { live, p } = R; for (let k = 0; k < 40 * 30 && live.coaster; k++) live.step(1 / 30); });

    // owner 2026-10-27: every Boss battles only once his helpers are beaten
    const crewGate = await page.evaluate(() => {
      const R = window.__R, { g } = R; R.put(204.5, 24, 201.5); window.__toasts.length = 0;
      g.talkTo(R.mae()); const gated = !g.inBattle && R.said('Beat Bumper Bea and Bouncy Ben first');
      g.beaten.push('pw:fair:crew1', 'pw:fair:crew2'); // (their real battles are below)
      return gated;
    });
    t.ok(crewGate, 'with three tickets but her helpers not beaten Merry Mae says: beat Bumper Bea and Bouncy Ben first');
    // Merry Mae, a lost battle first (stays on the stage), then the star
    await page.evaluate(async () => {
      const R = window.__R, { g, p } = R, S = await import('/src/species.js');
      g.party = [S.makeCreature('fluffin', 1)]; g.cubes = 0;
      R.put(204.5, 24, 201.5); p.lookAt({ x: 201.5, y: 25.5, z: 201.5 });
      const mae = R.mae(); window.__maeAt = [mae.pos.x, mae.pos.y, mae.pos.z];
      g.talkTo(mae);
    });
    await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
    t.ok(true, 'with three tickets Merry Mae battles you (no gate words)');
    t.ok(await playBattle(page), 'a weak team loses the Boss battle');
    await pause(page);
    const L1 = await page.evaluate(() => { const g = window.pokecraft, p = g.player; return { aim: window.__R.live.aim(p.pos)?.text('↑', 5), place: g.place, y: p.pos.y, x: p.pos.x, z: p.pos.z, star: g.stars.includes('fair'), tickets: window.__R.F.ticketState(g).n, hp: g.party[0].hp > 0, said: window.__R.said('Good try! Have some candy floss and try again.') }; });
    t.ok(/Battle Merry Mae/.test(L1.aim) && L1.place === 'playland' && L1.y >= 23.9 && L1.x > 195 && !L1.star && L1.tickets === 3 && L1.hp && L1.said, `a lost battle keeps you on the Star Stage (y ${L1.y.toFixed(1)}), healed, with the three tickets and Mae's kind words`);
    await page.evaluate(async () => {
      const R = window.__R, { g, p } = R, S = await import('/src/species.js');
      g.party = [S.makeCreature('thunderwolf', 100)]; g.cubes = 0; window.__toasts.length = 0;
      R.put(204.5, 24, 201.5); p.lookAt({ x: 201.5, y: 25.5, z: 201.5 });
      g.talkTo(R.mae());
    });
    await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
    t.ok(await playBattle(page), 'the Boss battle is won');
    await pause(page);
    const W1 = await page.evaluate(() => {
      const R = window.__R, { g, live } = R; live.step(0.05); const i = live.info();
      return { star: g.stars.includes('fair'), cubes: g.cubes, tickets: R.F.ticketState(g).n, awake: i.awake, wheelLit: live.wheelMesh.userData.parts.lights.visible, note: R.said('I built this fair for the festival'), lose: R.said('What a ride!'), starToast: R.said('You won the star of the Funfair'),
        lights: live.part.coaster.lights.filter(([x, y, z]) => g.world.get(x, y, z) === R.B.LAMP).length, total: live.part.coaster.lights.length, celebrate: !!document.getElementById('celebrate') };
    });
    t.ok(W1.star && W1.cubes >= 10 && W1.note && W1.lose && W1.starToast, `the star of the Funfair, the Wizard's note and 10 Capture Cubes (${W1.cubes})`);
    t.ok(W1.tickets === 0 && W1.awake && W1.wheelLit, `the three tickets are used up; the fair is awake: the Ferris wheel's bulbs are on (${W1.lights} of ${W1.total} coaster lights lit until the next sync)`);
    await page.evaluate(() => { const R = window.__R; R.live.step(0.3); });
    const W2 = await page.evaluate(() => { const R = window.__R, { g, live } = R; return { lights: live.part.coaster.lights.filter(([x, y, z]) => g.world.get(x, y, z) === R.B.LAMP).length, total: live.part.coaster.lights.length, board: [161, 165, 169].map(x => g.world.get(x, 16, 133)).join(), hard: live.hard, rings: live.seat.hard }; });
    t.ok(W2.lights === W2.total && W2.hard, `awake: every coaster light stays on even with no tickets (${W2.lights} of ${W2.total}); the next rounds are harder`);

    // the slide back down
    const S1 = await page.evaluate(() => {
      const R = window.__R, { g, live, p } = R, out = {};
      R.put(197.5, 24, 197.5);
      out.aim = live.aim(p.pos)?.text('↑', 5);
      out.word = live.near(p); live.use(p); out.carried = !!p.carry && p.carry === live.slide;
      let t = 0; while (live.slide && t < 20) { live.step(1 / 30); t += 1 / 30; }
      out.secs = t; out.end = [p.pos.x, p.pos.y, p.pos.z]; out.carry = !!p.carry;
      return out;
    });
    t.ok(/Slide/.test(S1.aim) && S1.word === 'Slide!' && S1.carried && !S1.carry && Math.hypot(S1.end[0] - 189.33, S1.end[2] - 189.33) < 0.1 && S1.end[1] === 11 && S1.secs > 6 && S1.secs < 8, `Slide! on the stage: a ${S1.secs.toFixed(1)} s helix down to the ground (${S1.end.map(v => v.toFixed(1))})`);

    // a rematch needs the games again: harder (a faster carousel, more balloons, more rings)
    const H1 = await page.evaluate(() => {
      const R = window.__R, { g, live, G } = R;
      return { hard: live.hard, games: [live.bump.hard, live.bounce.hard, live.seat.hard], omega: live.seat.omega, need: live.bounce.need, round: [live.bump.round, live.bounce.round, live.seat.round], bot: live.bump.fleet.bots[0].speed, time: live.bump.time, ticketsBefore: R.F.ticketState(g).n };
    });
    t.ok(H1.hard && H1.games.every(Boolean) && H1.round.join() === '0,0,0' && H1.omega > G.omegaOf(false, 0) && H1.bot > 3 && H1.time < 55 && H1.ticketsBefore === 0, `with the star the three games start again from round 1, harder: quicker bots (${H1.bot} b/s, ${H1.time} s), a faster carousel (${H1.omega.toFixed(2)} rad/s)`);
    const H2 = await page.evaluate(() => {
      const R = window.__R, { g } = R, w = window.__toasts.length;
      g.talkTo(R.mae());
      return { gate: R.said('Win 3 golden tickets at the games! Then ride the coaster up to me. \\(🎟️ 0 / 3\\)'), inBattle: g.inBattle, extra: window.__toasts.length - w };
    });
    t.ok(H2.gate && !H2.inBattle, "a rematch needs the three tickets again: Mae's gate words (nothing is cleared in the save but the tickets)");

    // the crew: battles before Mae (owner 2026-10-27), never in the tickets' gate
    await page.evaluate(async () => {
      const R = window.__R, { g, p } = R, S = await import('/src/species.js');
      g.beaten = g.beaten.filter(k => !/^pw:fair:crew/.test(k)); // (set above to reach Mae: now Bea's real battle)
      g.party = [S.makeCreature('thunderwolf', 100)];
      const bea = R.crew(0); R.put(bea.pos.x + 1.5, 11, bea.pos.z); p.lookAt({ x: bea.pos.x, y: 12.5, z: bea.pos.z });
      g.talkTo(bea);
    });
    await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
    t.ok(await playBattle(page), 'Bumper Bea\'s practice battle is won');
    await pause(page);
    const C1 = await page.evaluate(() => { const R = window.__R, { g } = R; g.talkTo(R.crew(0)); return { key: g.beaten.includes('pw:fair:crew1'), line: R.said('Get behind a car and bump its balloon!'), gateStillTickets: R.F.ticketState(g).n }; });
    t.ok(C1.key && C1.line && C1.gateStillTickets === 0, 'Bea is beaten once (crew1 saved), then only tells you the tip; the crew never touch the tickets');
    t.ok(!page.errors.length, `no page errors in the fair ${page.errors.join('; ')}`);
  }

  /* ---------------------------------------------------------------- E. iPad */
  if (want('ipad')) {
    const ip = await retry(() => openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] }));
    await newGame(ip, 0);
    await ip.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });
    await intoFair(ip);
    await arm(ip);
    const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    const word = async (x, y, z) => {
      await ip.evaluate(([x, y, z]) => { const R = window.__R; R.put(x, y, z); R.live.step(0.03); }, [x, y, z]);
      await frames(ip, 2);
      return ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    };
    const w1 = await word(145.3, 11, 145.2);
    t.ok(w1 === 'Drive!', `on the iPad the big button says "${w1}" by a bumper car`);
    await ip.tap('#btn-act');
    await waitFor(ip, () => window.__R.live.drive === 0, null, 30000);
    t.ok(true, 'a tap on the big button gets you in the car');
    await waitFor(ip, () => document.getElementById('btn-act')?.textContent.trim() === 'Get out', null, 30000).catch(() => {});
    const w2 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    // the joystick drives: full push (a world direction through Player.update's carry branch)
    const drove = await ip.evaluate(() => {
      const R = window.__R, { g, live, p } = R;
      g.touch.joy = { x: 0, y: -1 }; p.joy = g.touch.joy; p.yaw = Math.PI / 2; p.keys = {}; // forward = (-1, 0)... sin(pi/2) = 1: forward is -x
      const x0 = live.car.x;
      for (let k = 0; k < 40; k++) { p.update(1 / 30); live.step(1 / 30); }
      const moved = x0 - live.car.x; g.touch.joy = null; p.joy = null;
      return { moved, speed: live.car.speed };
    });
    t.ok(w2 === 'Get out' && drove.moved > 2 && drove.speed > 3, `driving with the joystick: the button says "${w2}", the car moved ${drove.moved.toFixed(1)} blocks`);
    await ip.evaluate(() => { const R = window.__R; R.live.use(R.p); R.put(188.5, 11, 150.5); R.p.trampH = 0; R.p.keys = {}; });
    // Jump on the trampoline: the touch Jump button sets keys.Space
    const bounce = await ip.evaluate(() => {
      const R = window.__R, { g, p } = R, hs = [];
      g.touch.jump?.(true); p.keys.Space = true;
      let peak = 0, rising = false;
      for (let k = 0; k < 60 * 10 && hs.length < 5; k++) {
        p.update(1 / 60); const y = p.pos.y - 11;
        if (p.vel.y > 0) { rising = true; peak = Math.max(peak, y); } else if (rising) { hs.push(+peak.toFixed(1)); rising = false; peak = 0; }
      }
      p.keys.Space = false;
      return hs;
    });
    t.ok(bounce.length >= 4 && bounce[3] > bounce[0] + 3, `holding the touch Jump button on the mat bounces higher each time (${bounce})`);
    // the carousel: Ride! on a tap, a stick push changes the lane, Jump hops
    const w3 = await word(175.6, 11, 153.5);
    await ip.tap('#btn-act');
    await waitFor(ip, () => window.__R.live.riding, null, 30000);
    await waitFor(ip, () => document.getElementById('btn-act')?.textContent.trim() === 'Get off', null, 30000).catch(() => {});
    const ride = await ip.evaluate(() => {
      const R = window.__R, { g, live, p } = R, out = { word: document.getElementById('btn-act')?.textContent.trim() };
      const radial = () => { const dx = p.pos.x - 166.5, dz = p.pos.z - 153.5, d = Math.hypot(dx, dz); return [dx / d, dz / d]; };
      const [rx, rz] = radial();
      // the stick as the joystick gives it: a direction in the world after the yaw: push inwards
      p.yaw = Math.atan2(rx, rz); // looking inwards (forward = (-sin yaw, -cos yaw) = minus the radius): pushing the stick forward goes inwards
      g.touch.joy = { x: 0, y: -1 }; p.joy = g.touch.joy;
      p.update(1 / 30); live.step(1 / 30);
      out.lane1 = live.seat.to;
      g.touch.joy = null; p.joy = null; p.update(1 / 30); live.step(1 / 30); live.step(0.4);
      p.keys.Space = true; p.update(1 / 30); live.step(1 / 30); p.keys.Space = false; live.step(0.2);
      out.hop = live.seat.hopHeight > 0.3;
      return out;
    });
    t.ok(w3 === 'Ride!' && ride.word === 'Get off' && ride.lane1 === 1 && ride.hop, `iPad carousel: Ride! / Get off on the big button, a stick push inwards changes lane (${ride.lane1}), Jump hops`);
    await ip.evaluate(() => { const R = window.__R; R.live.use(R.p); });
    const after = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    t.ok(after === before, `the number of touch buttons did not change (${before})`);
    await ip.evaluate(() => { const R = window.__R; R.put(150, 11, 141); R.p.lookAt({ x: 134, y: 12, z: 153 }); });
    await frames(ip, 2);
    await shot(ip, 't43-ipad.png').catch(() => {});
    t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
    await ip.context().close();
  }

  /* ---------------------------------------------------------------- F. Two browsers */
  if (want('pair')) {
    const [A, Bp] = await retry(() => openPair(browser, base));
    await newGame(A, 0); await pause(A);
    await newGame(Bp, 1); await pause(Bp);
    await A.fill('#mp input[placeholder="Your name"]', 'Dad');
    await click(A, '#mp button:has-text("Share my world")');
    await A.waitForTimeout(500);
    const code = (await A.textContent('.mp-code')).trim();
    await Bp.fill('#mp input[placeholder="Your name"]', 'Kid');
    await Bp.fill('#mp .mp-code-input', code);
    await click(Bp, '#mp button:has-text("Join a world")');
    await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000); console.log('  pair: Kid joined');
    await A.evaluate(() => { window.pokecraft.champion = true; });
    await Bp.evaluate(() => { window.pokecraft.champion = true; });
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl'); console.log('  pair: Dad in the Swirl');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'swirl'); console.log('  pair: Kid followed');
    const cell = await A.evaluate(() => {
      const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'fair'), p = g.player;
      p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
      return f.cloth[Math.floor(f.cloth.length / 2)];
    });
    await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(A, 'playland'); console.log('  pair: Dad in Playland');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'playland'); console.log('  pair: Kid in Playland');
    await arm(A); await arm(Bp);
    // Dad drives and pops a balloon; Kid's balloons and cars are his own
    const a = await A.evaluate(() => {
      const R = window.__R, { live, G } = R;
      R.put(145.3, 11, 145.2); live.use(R.p);
      let t = 0;
      const memo = {};
      while (!live.popped.some(Boolean) && t < 100) { const wish = G.skilledWish(memo, live.bump); live.carObj.steer(wish.x, wish.z, 1, false); live.step(1 / 30); t += 1 / 30; }
      return { pops: live.popped.filter(Boolean).length, drive: live.drive, pos: [R.p.pos.x, R.p.pos.y, R.p.pos.z] };
    });
    await Bp.evaluate(() => { const R = window.__R; R.put(150, 11, 141); R.live.step(0.2); });
    await A.evaluate(() => window.pokecraft.mp.sendState?.());
    await Bp.waitForTimeout(1500);
    const b = await Bp.evaluate(() => {
      const R = window.__R, { g, live } = R, others = [...g.mp.others.values()];
      return { pops: live.popped.filter(Boolean).length, drive: live.drive, friends: others.length, friendHere: others.some(o => o.here), friendPos: others[0]?.pos ? [others[0].pos.x, others[0].pos.y, others[0].pos.z] : null };
    });
    t.ok(a.pops >= 1 && a.drive === 0 && b.pops === 0 && b.drive === -1, `Dad drives and pops a balloon (${a.pops}); Kid's balloons and cars are his own (${b.pops} popped)`);
    t.ok(b.friends === 1 && b.friendHere, `Kid sees Dad's avatar in the fair (from the normal state message, nothing new is sent) ${JSON.stringify(b.friendPos?.map(v => +v.toFixed(1)))}`);
    t.ok(!A.errors.length && !Bp.errors.length, `no page errors in the pair ${A.errors.concat(Bp.errors).slice(0, 3).join('; ')}`);
    await A.context().close(); await Bp.context().close();
  }

  /* ---------------------------------------------------------------- the pictures */
  if (want('shots')) {
    const sp = await retry(() => openGame(browser, base));
    sp.on('pageerror', e => console.log('  PAGE ERROR', e.message));
    await newGame(sp, 0); await pause(sp);
    await sp.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
    await placeIs(sp, 'swirl');
    const cell = await sp.evaluate(() => {
      const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'fair'), p = g.player;
      p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
      return f.cloth[Math.floor(f.cloth.length / 2)];
    });
    await frames(sp, 3);
    await shot(sp, 't43-frame.png');
    await sp.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(sp, 'playland');
    await arm(sp);
    await sp.evaluate(() => { const R = window.__R, { p } = R; R.put(166.5, 11, 126.5); p.yaw = Math.PI; p.pitch = 0.05; R.live.step(0.05); });
    await frames(sp, 3);
    await shot(sp, 't43-arch.png');
    await sp.evaluate(() => { const R = window.__R, { p } = R; R.put(166.5, 11, 140); p.lookAt({ x: 166.5, y: 13, z: 153 }); R.live.step(0.05); });
    await frames(sp, 2);
    await shot(sp, 't43-fair.png');
    t.ok(!sp.errors.length, `no page errors for the pictures ${sp.errors.join('; ')}`);
    await sp.context().close();
  }
}
