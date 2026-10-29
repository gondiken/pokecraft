// Cube Planets (plans/cube-planets.md; realm `gravity`, the Swirl's old secret5 frame): the little planets, the three games, the Gravity type.
// frames (Node): the 24 frames turn and turn back exactly, every turn to every down, downAt's rule and hysteresis, a bent flight.
// land (Node, cubecheck.mjs): three seeds: nobody stuck on any face of the 11 planets, the plain jumps between them, the pebbles and the
//   Great Cube only by the launch flowers, blocks (the only new ids 149 / 183 / 249), the games' places, keeps, nooks.
// data (a page): the Gravity type: 7 creatures with 4 shapes of their own and the 'orbit' gear, the gait, moves / sigs / big moves, the chart
//   (separate lines, at most 5 weaknesses), effects and the fx:gravity sound, the spawns and AFTER_CHECKS, the wool, Professor Orbit.
// games (Node, cubebots.mjs, the real Player and the real CubeLive at 60 and 20 frames a second): the Orbikit Chase (chasing, camping and
//   wandering never tag it; waiting round a corner on its loop does), the Planet Hop (the skilled run lands every pebble; running straight
//   at the next pebble or walking straight at it each fail one hop; a random run seldom lands), the Moon Ride (jumping at the right moment
//   lands in each ring; jumping right over the ring or at random seldom does), the kind help (gentle, and chasing still never works), just
//   for fun after all is won, a won Boss battle clears the keys.
// off: the main world, the Dream and the Swirl move the player bit for bit as the golden says (tests/cuberecord.mjs).
// gravity (a page, the real Player): walking round every edge of every cube planet at 60 and 20 frames a second, no flicker, a corner,
//   jumps between planets land where flightLand said, the catch puff, standing on every face.
// play (the game): the frame, the arrival, the people, wild Gravity creatures circling on top of the planets, no riding / building, the
//   guide on a side face, the three games through the game's own live part, the crew, the Boss (a loss, the star, the keys cleared, a
//   rematch), a reload keeps the frame and the keys, an old 5-value spot loads upright, a step-0 save arrives at the start, the way back.
// real: real key presses through the game's own loop (a flower hop, the Moon Ride with E and Space). ipad: the stick on a side face, the
// camera turn, the Ride slot dims with the no-riding words, Tag! / Hop on! on the action button. pair: a friend on a side face is drawn
// turned to it. closed: without ?preview the frame is the old secret one. Screenshots tests/screenshots/cube-*.png.
// CUBE_ONLY=frames|land|data|games|off|gravity|play|real|ipad|pair|closed|shots
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, continueGame, playBattle, waitFor as waitFor0 } from '../helpers.mjs';
import * as G from '../../src/gravity.js';
import * as CL from '../../src/cubeland.js';
import { analyze } from '../cubecheck.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const GOLDEN = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'cube-off-golden.json'), 'utf8'));
const ONLY = process.env.CUBE_ONLY || '';
const want = part => !ONLY || ONLY.split(',').includes(part);
const waitFor = (page, fn, arg, timeout = 90000) => waitFor0(page, fn, arg, timeout);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); }); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };
const retry = async (fn, n = 3) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || !/Timeout/.test(e.message)) throw e; console.log('  (the page was slow to start: trying again)'); } } };
const CUBES = CL.PLANETS.map((p, i) => i).filter(i => CL.PLANETS[i].n); // the planets that are cubes (the walking checks)

// The in-page helpers: a Cube Planets world (made directly, or the game's), the real Player, walking with a fixed frame rate.
const harness = page => page.evaluate(async () => {
  const [{ World }, { REALMS }, { Player }, Gm, CLm, { B }] = await Promise.all(['/src/world.js', '/src/realms.js', '/src/player.js', '/src/gravity.js', '/src/cubeland.js', '/src/blocks.js'].map(u => import(u)));
  const C = window.__C = {
    G: Gm, CL: CLm, B, Player,
    make(seed = 1) { const w = new World(seed, null, null, REALMS.gravity.size, REALMS.gravity); w.generate(); return w; },
    player(w) { return new Player(w); },
    place(p, pos) { p.carry = null; p.pos.set(pos[0], pos[1], pos[2]); p.vel.set(0, 0, 0); p.keys = {}; p.joy = null; },
    settle(p) { for (let i = 0; i < 240; i++) { p.update(1 / 60); if (p.onGround && i > 2) return true; } return false; },
    yawToward(p, dir) { const l = Gm.toLocal(p.frame, dir); p.yaw = Math.atan2(-l[0], -l[2]); p.pitch = 0; },
    walk(p, keys, secs, fps) {
      const n = Math.round(secs * fps); let turns = 0, last = p.frame;
      for (let i = 0; i < n; i++) { p.keys = keys; p.update(1 / fps); if (p.frame !== last) { turns++; last = p.frame; } }
      p.keys = {};
      return { pos: [p.pos.x, p.pos.y, p.pos.z].join(','), p: p.pos.toArray(), turns, frame: p.frame, down: Gm.downOf(p.frame).join(), ground: p.onGround, grav: p.grav && { planet: p.grav.planet, axis: p.grav.axis, sign: p.grav.sign } };
    },
    // a free spot near `near` (world, on the first face's surface): no little thing within r on any of `faces` ([planet, axis, sign])
    free(w, faces, near, r = 1) {
      const ax0 = faces[0][1], oth = [0, 1, 2].filter(k => k !== ax0), cands = [];
      for (let du = -4; du <= 4; du++) for (let dv = -4; dv <= 4; dv++) cands.push([du, dv]);
      cands.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
      for (const [du, dv] of cands) {
        const pt = [...near]; pt[oth[0]] = Math.floor(near[oth[0]]) + du + 0.5; pt[oth[1]] = Math.floor(near[oth[1]]) + dv + 0.5;
        const ok = faces.every(([pi, axis, sign]) => {
          const P = CLm.PLANETS[pi], s = CLm.sizeOf(P), o = [0, 1, 2].filter(k => k !== axis), base = [P.x, P.y, P.z], u = Math.floor(pt[o[0]]) - base[o[0]], v = Math.floor(pt[o[1]]) - base[o[1]];
          if (u < 0 || v < 0 || u >= s[o[0]] || v >= s[o[1]]) return false;
          if ([1, 2].some(out => w.isSolid(...CLm.faceCell(P, axis, sign, u, v, out)))) return false;
          return w.cubes.bumps.every(q => q.planet !== pi || q.axis !== axis || q.sign !== sign || Math.max(Math.abs(q.u - u), Math.abs(q.v - v)) > r + (q.kind === 'tree' ? 1 : 0));
        });
        if (ok) return pt;
      }
      return null;
    },
    hopFree(w, h) { return C.free(w, [[h.from, h.axis, h.sign], [h.to, h.axis, -h.sign]], CLm.hopSpot(h), 1); },
    // a free lane (world axis b, cell c) for a walk from the middle of face [axis, sign] over its edge toward [a, s] and 5 cells onto that
    // face: every cell on the way has 2 cells of air above it (no little thing, no door frame, no flower in the way)
    lane(w, pi, axis, sign, a, s) {
      const P = CLm.PLANETS[pi], b = [0, 1, 2].find(k => k !== axis && k !== a), base = [P.x, P.y, P.z], mid = Math.floor(P.n / 2), m = P.n - 1;
      const air = (fax, fsg, cell) => [1, 2].every(out => { const o = [0, 1, 2].filter(k => k !== fax), uv = o.map(k => cell[k] - base[k]); return !w.isSolid(...CLm.faceCell(P, fax, fsg, uv[0], uv[1], out)); });
      const pad = (fax, fsg, cell) => { const o = [0, 1, 2].filter(k => k !== fax), uv = o.map(k => cell[k] - base[k]), c = CLm.faceCell(P, fax, fsg, uv[0], uv[1], 0); const k = c.join(); return [...CLm.FLOWERS, ...CLm.HOME_FLOWERS].some(f => f.cell.join() === k); };
      const cands = Array.from({ length: P.n - 2 }, (_, i) => i + 1).sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid));
      for (const c of cands) {
        let ok = true;
        for (let i = mid; ok && i >= 0 && i <= m; i += s) { const cell = [0, 0, 0]; cell[axis] = sign > 0 ? base[axis] + m : base[axis]; cell[a] = base[a] + i; cell[b] = base[b] + c; ok = air(axis, sign, cell) && !pad(axis, sign, cell); }
        for (let k = 0; ok && k < 6; k++) { const cell = [0, 0, 0]; cell[a] = s > 0 ? base[a] + m : base[a]; cell[axis] = sign > 0 ? base[axis] + m - k : base[axis] + k; cell[b] = base[b] + c; ok = air(a, s, cell) && !pad(a, s, cell); }
        if (ok) return { b, c: base[b] + c };
      }
      return null;
    },
  };
  return !!C;
});
// The game's own Cube Planets: the live part on a manual clock, toasts collected, the bots of cubebots.mjs on the game's player.
const arm = page => page.evaluate(async () => {
  const g = window.pokecraft, Bots = await import('/tests/cubebots.mjs'), CLm = await import('/src/cubeland.js'), Gm = await import('/src/gravity.js');
  const live = g.gymLive.of('part:gravity');
  live.manual = true; live.playing = () => true;
  window.__toasts = [];
  if (!g.ui.__cubeToast) { const f = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...r) => { window.__toasts.push(m); return f(m, ...r); }; g.ui.__cubeToast = true; }
  const p = g.player;
  const env = { game: g, world: g.world, player: p, live, step(dt) { p.update(dt); live.step(dt); } };
  window.__R = {
    g, live, p, env, Bots, CL: CLm, G: Gm,
    said: re => window.__toasts.some(m => new RegExp(re).test(m)),
    boss: () => g.npcs.list.find(n => n.kind === 'boss' && n.def?.id === 'gravity'),
    crew: i => g.npcs.list.find(n => n.kind === 'crew' && n.def?.boss === 'gravity' && n.def.index === i),
    near(n) { const r = n.pos; p.carry = null; p.pos.set(r.x, r.y, r.z + 2.2); p.vel.set(0, 0, 0); p.keys = {}; for (let i = 0; i < 10; i++) env.step(1 / 30); },
  };
  return true;
});

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });

  /* ------------------------------------------------------------ frames (Node) */
  if (want('frames')) {
    const F = G.FRAMES, dirs = [[0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    const v = [1.25, -7.5, 3.0625];
    let round = 0, turns = 0, back = 0, cells = 0;
    for (const f of F) {
      const w = G.toWorld(f.i, v), l = G.toLocal(f.i, w);
      if (l.join() === v.join() && Math.abs(Math.hypot(...w) - Math.hypot(...v)) < 1e-12) round++;
      for (const d of dirs) {
        const n = G.turnTo(f.i, d);
        if (n != null && G.downOf(n).join() === d.join()) turns++;
        if (n != null && G.turnTo(n, G.downOf(f.i)) === f.i) back++;
      }
      const ok = [[0, 0, 0], [3, -2, 5], [-4, 7, -1]].every(c => { const wc = G.cellToWorld(f.i, ...c), mid = G.toWorld(f.i, c.map(x => x + 0.5)); return wc.every((x, k) => x === Math.floor(mid[k])); });
      if (ok) cells++;
    }
    const dets = F.every(f => { const m = f.m; return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]) === 1; });
    t.ok(F.length === 24 && new Set(F.map(f => f.m.join())).size === 24 && dets && F[0].m.join() === '1,0,0,0,1,0,0,0,1', `24 different frames, all turns (no mirror), frame 0 is upright`);
    t.ok(round === 24 && turns === 144 && back === 144 && cells === 24, `every frame turns a point to the world and back exactly (${round}/24); from every frame every down is one smallest turn away (${turns}/144) and turning back gives the same frame (${back}/144); the world view's cells match (${cells}/24)`);
    const P = [{ x0: 0, y0: 0, z0: 0, x1: 10, y1: 10, z1: 10, reach: 8, g: 0.7 }, { x0: 13, y0: 0, z0: 0, x1: 20, y1: 10, z1: 10, reach: 8, g: 0.6 }];
    const top = G.downAt(P, [5, 10, 5]), east = G.downAt(P, [10, 5, 5]), under = G.downAt(P, [5, 0, 5]);
    const keepTop = G.downAt(P, [10.35, 10, 5], top), turnEast = G.downAt(P, [10.45, 10, 5], top), keepEast = G.downAt(P, [10, 10.35, 5], east);
    const mid1 = G.downAt(P, [11.6, 5, 5], east), mid2 = G.downAt(P, [11.75, 5, 5], east), space = G.downAt(P, [-30, 5, 5]);
    t.ok(top.down.join() === '0,-1,0' && east.down.join() === '-1,0,0' && under.down.join() === '0,1,0' && keepTop.down.join() === '0,-1,0' && turnEast.down.join() === '-1,0,0' && keepEast.down.join() === '-1,0,0',
      'down is toward the planet along the axis you are furthest out on (top -y, east -x, under +y); over an edge it turns only when the new side wins by 0.4 (no flicker)');
    t.ok(mid1.planet === 0 && mid2.planet === 1 && mid2.down.join() === '1,0,0' && space.soft && space.g < P[0].g && !mid2.soft, `between two planets the nearer one pulls (with 0.4 to spare: ${mid1.planet} at 11.6, ${mid2.planet} at 11.75); far out a soft pull (g ${space.g.toFixed(2)})`);
    const padded = G.downAt([P[0], { ...P[1], pad: 0.8 }], [11.2, 5, 5], null);
    t.ok(padded.planet === 1 && G.downAt(P, [11.2, 5, 5], null).planet === 0, 'a planet with a pad (the Planet Hop\'s kind help) catches a little further out');
    const f2 = G.flightLand([10.001, 5, 5], [8.6, 0, 0], P);
    t.ok(f2 && f2.planet === 1 && f2.turns >= 1 && Math.abs(f2.pos[0] - 13) < 1e-12, `a jump off a side flies across the gap, the next planet's pull turns it and it lands on that planet's facing side (after ${f2?.t.toFixed(2)} s)`);
  }

  /* ------------------------------------------------------------ land (Node) */
  if (want('land')) {
    for (const seed of [1, 2, 3]) {
      const t0 = Date.now(), r = analyze(seed);
      t.ok(!r.problems.length, `seed ${seed}: nobody stuck on any face of the ${CL.PLANETS.length} planets (${CL.PLANETS.map(P => `${P.id} ${r.info[P.id].flat}+${r.info[P.id].bumps}`).join(', ')}), every plain jump between planets works (${r.info.hops.length} ways), other plain jumps only between planets you can walk to anyway (${r.info.extra.join(', ') || 'none'}), the pebbles and the Great Cube only by the flowers (plain reach: ${r.info.plain.join(', ')}), blocks ${r.info.ids.filter(i => i > 100)}, ${r.info.nooks} nooks (${Date.now() - t0} ms) ${r.problems.slice(0, 4).join('; ')}`);
    }
    const a = analyze(1).world, b = analyze(1).world, c = analyze(2).world;
    let same = true, diff = false;
    for (let i = 0; i < a.data.length; i++) { if (a.data[i] !== b.data[i]) same = false; if (a.data[i] !== c.data[i]) diff = true; }
    t.ok(same && diff, 'the same seed makes the same planets, another seed moves their little things');
  }

  /* ------------------------------------------------------------ games (Node: the real Player and CubeLive) */
  if (want('games')) {
    const { cubeEnv } = await import('../cubenode.mjs');
    const B = await import('../cubebots.mjs');
    const O = await import('../../src/orbits.js');
    for (const fps of [60, 20]) {
      // the Orbikit Chase
      const chase = {};
      for (const kind of ['chaser', 'camper', 'random', 'skilled']) {
        chase[kind] = [];
        for (let i = 0; i < 3; i++) for (const seed of [1, 2]) { const env = await cubeEnv(seed); chase[kind].push(B.playChase(env, i, kind, { fps, seed: seed + i * 10, maxT: 45 })); }
      }
      const tags = k => chase[k].filter(r => r.tagged).length;
      t.ok(tags('chaser') === 0 && tags('camper') === 0 && tags('random') <= 1 && tags('skilled') === 6 && chase.skilled.every(r => r.spots === 0),
        `Orbikit Chase @${fps}: running after it never tags it (${tags('chaser')}/6 in 45 s), standing on its loop never does (${tags('camper')}/6: it sees you and turns ${chase.camper.map(r => r.spots).join(',')} times), wandering about almost never (${tags('random')}/6); waiting round a corner on its loop tags it every time (${tags('skilled')}/6, in ${chase.skilled.map(r => r.t.toFixed(1)).join(' / ')} s, never seen)`);
      // the Planet Hop: each flower, each kind
      const hop = {};
      for (const kind of ['skilled', 'sprinter', 'walker', 'random']) {
        hop[kind] = CL.FLOWERS.map(() => 0);
        const N = kind === 'random' ? 24 : 2;
        for (let k = 0; k < CL.FLOWERS.length; k++) { const env = await cubeEnv(1); for (let s = 1; s <= N; s++) if (B.playHop(env, k, kind, { fps, seed: s }).ok) hop[kind][k]++; }
      }
      const chainOf = k => hop[k].every((n, i) => n === (k === 'random' ? 24 : 2));
      const randRate = hop.random.map(n => n / 24), chain = randRate.reduce((a, b) => a * b, 1);
      t.ok(chainOf('skilled') && !chainOf('sprinter') && !chainOf('walker') && randRate[1] <= 0.3 && randRate[3] <= 0.35 && chain < 0.02,
        `Planet Hop @${fps}: the right run lands every pebble (${hop.skilled.join('/')} of 2 each); running straight at the next pebble fails (${hop.sprinter.join('/')}: too fast, the Sky Pebble catches you), walking straight at it fails (${hop.walker.join('/')}: too slow), a random run seldom lands (${hop.random.join('/')} of 24: the whole chain by luck ${(chain * 100).toFixed(2)} %)`);
      // the Moon Ride
      const moon = {};
      for (const kind of ['skilled', 'over', 'random']) {
        moon[kind] = [0, 0, 0];
        const N = kind === 'random' ? 12 : 2;
        for (let r = 0; r < 3; r++) { const env = await cubeEnv(1); env.live.winUpTo(0, false, r); for (let s = 1; s <= N; s++) { const res = B.playMoon(env, kind, { fps, seed: s * 31 + r }); if (res.hit) moon[kind][r]++; env.game.beaten = env.game.beaten.filter(x => x !== CL.ringKey(r + 1)); } }
      }
      const mr = moon.random.reduce((a, b) => a + b, 0) / 36;
      t.ok(moon.skilled.every(n => n === 2) && moon.over.every(n => n === 0) && mr <= 0.2,
        `Moon Ride @${fps}: jumping off at the right moment lands in every ring (${moon.skilled.join('/')} of 2); jumping right over the ring never does (${moon.over.join('/')}: you keep the moon's speed), a random moment seldom (${moon.random.join('/')} of 12, ${(mr * 100).toFixed(0)} %)`);
    }
    // 60 and 20 frames a second: the same flight lands on the same spot
    const land = [];
    for (const fps of [60, 20]) { const env = await cubeEnv(1); B.playHop(env, 0, 'skilled', { fps }); land.push(env.player.pos.toArray().map(v => v.toFixed(9)).join()); }
    t.ok(land[0] === land[1], `a flower flight at 60 and at 20 frames a second lands on exactly the same spot (${land[0]})`);
    // the kind help: gentle, and chasing still never works
    const h0 = O.gravityHelp(0), h2 = O.gravityHelp(2), h6 = O.gravityHelp(6), h20 = O.gravityHelp(20);
    t.ok(h0.ease === 0 && h2.ease > 0 && h20.ease <= 0.1 + 1e-12 && h20.pad <= 0.8 + 1e-9 && PUP_FAST(O, h20), `the kind help only through kindHelp: none at first, ${h2.ease} after 2 misses, at most ${h20.ease} (the Orbikit's sprint x${h20.sprint.toFixed(2)} = ${(7 * h20.sprint).toFixed(2)} b/s: still faster than your 6.2 sprint; tag reach x${h20.tag.toFixed(2)}; a pebble pulls ${h20.pad.toFixed(2)} further; the moon x${h20.moon.toFixed(2)}, the ring x${h20.ring.toFixed(2)})`);
    {
      const env = await cubeEnv(1); env.live.pMiss = [20, 20, 20];
      const r = B.playChase(env, 0, 'chaser', { maxT: 45 });
      t.ok(!r.tagged, 'with the most kind help, chasing the Orbikit still never tags it');
    }
    // just for fun and the Boss clearing the keys
    {
      const env = await cubeEnv(1), { live, game } = env;
      for (let i = 0; i < 3; i++) B.playChase(env, i, 'skilled');
      for (let k = 0; k < 4; k++) B.playHop(env, k, 'skilled');
      for (let r = 0; r < 3; r++) B.playMoon(env, 'skilled');
      const st = live.state(), keys = game.beaten.slice().sort().join();
      const again = [B.playChase(env, 0, 'skilled').tagged, B.playHop(env, 3, 'skilled').ok, B.playMoon(env, 'skilled').hit], keys2 = game.beaten.slice().sort().join();
      const fun = env.toasts.filter(m => /Just for fun/.test(m)).length;
      live.battleEnded('won', { picture: { id: 'gravity', crew: 0 } });
      const crewKeep = game.beaten.length;
      live.battleEnded('won', { picture: { id: 'gravity' } });
      t.ok(st.done && st.n === 7 && again.every(Boolean) && keys === keys2 && fun >= 3 && crewKeep === 7 && game.beaten.length === 0,
        `all seven games won with the bots (${keys}); afterwards every game still plays just for fun and saves nothing new (${fun} for-fun words); a crew battle keeps the keys, the Boss battle clears all seven (a rematch plays them again)`);
      game.stars = ['gravity'];
      const hard = new (live.constructor)(game, env.world.parts[0]);
      t.ok(hard.hard && B.playChase({ ...env, live: hard, step: dt => { env.player.update(dt); hard.step(dt); } }, 0, 'skilled').tagged, 'a rematch (you hold the star) is harder (the Orbikit and the moon x1.15) and a skilled player still wins it');
    }
  }

  /* ------------------------------------------------------------ data, off, gravity (a page, no game started) */
  if (want('data') || want('off') || want('gravity')) {
    const page = await retry(() => openGame(browser, base));
    if (want('data')) {
      const D = await page.evaluate(async () => {
        const S = await import('/src/species.js'), SH = await import('/src/shapes.js'), Bk = await import('/src/blocks.js'), FX = await import('/src/fxrecipes.js'), Snd = await import('/src/sound.js');
        const Cr = await import('/src/creatures.js'), SR = await import('/src/spawnrules.js'), WA = await import('/src/wildafter.js'), R = await import('/src/realms.js'), Pb = await import('/src/pictureboss.js'), PW = await import('/src/pictureworlds.js'), Tr = await import('/src/traits.js');
        const ids = Object.keys(S.SPECIES).filter(id => S.SPECIES[id].type === 'gravity');
        const shapes = [...new Set(ids.map(id => S.SPECIES[id].model.shape))];
        const otherShapes = new Set(Object.keys(S.SPECIES).filter(id => S.SPECIES[id].type !== 'gravity').map(id => S.SPECIES[id].model.shape));
        const gear = ids.map(id => { const m = S.buildModel(id); let n = 0; m.traverse(o => { if (o.userData.gear === 'orbit') n++; }); return n; });
        const types = Object.keys(S.TYPE_COLORS).concat('normal'), e = S.effectiveness;
        const weak = Object.fromEntries(types.map(b => [b, types.filter(a => e(a, b) > 1).length]));
        const moves = Object.values(S.MOVES).filter(m => m.type === 'gravity');
        const sigs = ids.map(id => S.SPECIES[id].learn?.some?.(([, m]) => S.MOVES[m]?.sig) ?? false);
        const boss = Pb.bossOf('gravity'), pw = PW.pictureWorld('gravity');
        return {
          ids, names: ids.map(id => S.SPECIES[id].name), shapes, own: shapes.every(s => !otherShapes.has(s) && !!SH.SHAPES[s]), gear, gaits: ids.map(id => S.SPECIES[id].gait),
          row: ['sky', 'racer', 'parkour', 'rock', 'metal', 'gravity'].map(b => e('gravity', b)), into: ['portal', 'alien', 'mind', 'rock'].map(a => e(a, 'gravity')),
          tooWeak: ['sky', 'racer', 'parkour', 'rock', 'metal', 'gravity'].filter(b => weak[b] > 5), weakGravity: weak.gravity,
          moves: moves.map(m => m.name), nSig: moves.filter(m => m.sig).length, nBig: moves.filter(m => m.big).length,
          fx: !!FX.TRAVEL.gravity && !!FX.IMPACT.gravity && ['cometail', 'ringtoss', 'upsidehug'].every(id => !!FX.SIG[id]) && !!FX.FX_COLORS.gravity, sound: typeof Snd.SOUNDS?.['fx:gravity'] === 'function' || !!Snd.sound,
          gait: !!Cr.GAITS.orbit, cond: !!SR.CONDITIONS.orbiting, after: typeof WA.AFTER_CHECKS.gravity === 'function', afterText: SR.AFTER_TEXT.gravity,
          spawns: R.REALMS.gravity.spawns.gravity.map(s => s[0]).sort().join() === ids.slice().sort().join(), wild: R.REALMS.gravity.wild,
          wool: Bk.WOOL.gravity, woolName: Bk.BLOCKS[149]?.name, ride: Tr.TRAITS.rideable.species.orbitah,
          boss: { name: boss.name, type: boss.type, look: boss.look, top: Math.max(...boss.team.map(x => x[1])), sig: boss.team[boss.team.length - 1][0], crew: boss.crew.map(c => c.name).join(), gate: boss.gate({ beaten: [], stars: [] }) },
          frame: { name: pw.name, ready: pw.ready, realm: pw.realm, idx: PW.PICTURE_WORLDS.findIndex(w => w.id === 'gravity') },
          version: R.REALMS.gravity.version,
        };
      });
      t.ok(D.ids.length === 7 && D.shapes.length === 4 && D.own && D.gear.every(n => n === 1) && D.gaits.every(g => g === 'orbit') && D.gait && D.cond,
        `the Gravity type: 7 creatures (${D.names.join(', ')}) with 4 shapes of their own (${D.shapes.join(', ')}), every model has one merged mesh of little moons ('orbit' gear), wild ones circle (gait 'orbit', condition 'orbiting')`);
      t.ok(D.row.join() === '2,2,2,0.5,0.5,0.5' && D.into.join() === '2,2,2,0.5' && !D.tooWeak.length && D.weakGravity === 3,
        `the chart: Gravity hits sky, racer and parkour hard, rock / metal / gravity softly; portal, alien and mind hit it hard, rock softly (separate lines); sky, racer and parkour are now weak to 5 types, no more ${D.tooWeak.join()}`);
      t.ok(D.moves.length >= 10 && D.nSig === 3 && D.nBig === 3 && D.fx && D.sound, `moves: ${D.moves.join(', ')} (3 signature moves, 3 big moves), effects and the fx:gravity sound`);
      t.ok(D.spawns && D.wild.max === 4 && D.after && /Orbikit/.test(D.afterText) && D.wool === 149 && D.woolName === 'Gravity Wool' && D.ride === 'land',
        `wild ones only on Cube Planets (at most ${D.wild.max} at once), the big ones only "${D.afterText}"; the gravity wool is block 149; Orbitah can be ridden (in other worlds)`);
      t.ok(D.boss.name === 'Professor Orbit' && D.boss.type === 'gravity' && D.boss.look === 'orbit' && D.boss.top === 63 && D.boss.sig === 'saturnowl' && D.boss.crew === 'Stargazer Stella,Captain Comet,Moon Mechanic Milo' && /Orbikits/.test(D.boss.gate) && D.frame.realm === 'gravity' && D.frame.idx === 11 && D.version === 2,
        `Professor Orbit (top level 63, his giant Saturnowl last), his helpers ${D.boss.crew}, his gate "${D.boss.gate}"; the frame (place ${D.frame.idx}) opens the realm, version ${D.version}`);
    }
    if (want('off')) {
      const now = await page.evaluate(async () => { const R = await import('/tests/cuberecord.mjs'), { Player } = await import('/src/player.js'); return R.recordOff(Player); });
      const rows = [];
      for (const w of ['main', 'dream', 'swirl']) for (const k of Object.keys(GOLDEN[w])) {
        if (k === 'water') continue;
        rows.push([`${w}.${k}`, now[w][k]?.hash === GOLDEN[w][k].hash && now[w][k]?.end === GOLDEN[w][k].end]);
      }
      t.ok(rows.every(r => r[1]) && rows.length === 6, `outside Cube Planets the player moves bit for bit as the golden says (${rows.map(r => `${r[0]} ${r[1] ? 'same' : 'DIFFERENT'}`).join(', ')})`);
    }
    if (want('gravity')) {
      await harness(page);
      const E = await page.evaluate(cubes => {
        const C = window.__C, w = C.make(1), rows = [], bad = [];
        for (const pi of cubes) for (const [axis, sign] of C.CL.FACES) for (const a of [0, 1, 2]) for (const s of [1, -1]) {
          if (a === axis) continue;
          const P = C.CL.PLANETS[pi], lane = C.lane(w, pi, axis, sign, a, s);
          if (!lane) { bad.push(`${P.id} [${axis},${sign}] -> [${a},${s}]: no free lane`); continue; }
          const res = [];
          for (const fps of [60, 20]) {
            const p = C.player(w), box = C.CL.BOXES[pi], lo = [box.x0, box.y0, box.z0], hi = [box.x1, box.y1, box.z1], at = [0, 0, 0];
            at[axis] = sign > 0 ? hi[axis] : lo[axis]; at[a] = (lo[a] + hi[a]) / 2; at[lane.b] = lane.c + 0.5;
            C.place(p, at); C.settle(p);
            const d = [0, 0, 0]; d[a] = s; C.yawToward(p, d);
            const secs = Math.ceil(((P.n / 2 + 3) / 4.3 + 0.3) * 20) / 20;
            res.push(C.walk(p, { KeyW: true }, secs, fps));
          }
          const [r60, r20] = res, want = [0, 0, 0]; want[a] = -s;
          const plane = s > 0 ? [C.CL.BOXES[pi].x1, C.CL.BOXES[pi].y1, C.CL.BOXES[pi].z1][a] : [C.CL.BOXES[pi].x0, C.CL.BOXES[pi].y0, C.CL.BOXES[pi].z0][a];
          const ok = r60.pos === r20.pos && r60.turns === 1 && r20.turns === 1 && r60.down === want.join() && r60.ground && r60.p[a] === plane && r60.grav.planet === pi;
          rows.push(ok);
          if (!ok) bad.push(`${P.id} [${axis},${sign}] -> [${a},${s}] ${JSON.stringify({ r60, r20 })}`);
        }
        return { n: rows.length, ok: rows.filter(Boolean).length, bad: bad.slice(0, 3) };
      }, CUBES);
      t.ok(E.n === CUBES.length * 24 && E.ok === E.n, `walking off every face of every cube planet toward each of its 4 edges, at 60 and 20 frames a second: exactly the same spot, one turn, standing on the next face (${E.ok}/${E.n}) ${E.bad.join(' | ')}`);
      const N = await page.evaluate(() => {
        const C = window.__C, w = C.make(1), P = C.CL.BOXES[0], out = {};
        let p = C.player(w); C.place(p, [P.x1 - 0.25, P.y1, P.z0 + 2.5]); C.settle(p); C.yawToward(p, [0, 0, 1]);
        out.along = C.walk(p, { KeyW: true }, 2, 60);
        p = C.player(w); C.place(p, [P.x1 + 0.2, P.y1, P.z0 + 2.5]); C.settle(p); C.yawToward(p, [0, 0, 1]);
        out.astride = C.walk(p, { KeyW: true }, 2, 60);
        p = C.player(w); C.place(p, [P.x1 - 1.5, P.y1, P.z0 + 6.5]); C.settle(p); C.yawToward(p, [1, 0, 0]);
        out.over = C.walk(p, { KeyW: true }, 0.75, 60); out.still = C.walk(p, {}, 1.5, 60);
        out.back = C.walk(p, { KeyS: true }, 0.75, 60); out.still2 = C.walk(p, {}, 1, 60);
        return out;
      });
      t.ok(N.along.turns === 0 && N.astride.turns === 0 && N.astride.ground && N.over.turns === 1 && N.still.turns === 0 && N.back.turns === 1 && N.back.down === '0,-1,0' && N.still2.turns === 0,
        `no flicker: along an edge (${N.along.turns} turns), astride it (${N.astride.turns}), over and stopping (${N.over.turns}, then ${N.still.turns}), and back (${N.back.turns}, then ${N.still2.turns})`);
      const J = await page.evaluate(() => {
        const C = window.__C, w = C.make(1), out = [];
        for (const h of C.CL.HOPS) {
          const p = C.player(w), at = C.hopFree(w, h);
          if (!at) { out.push({ hop: `${h.from}->${h.to}`, err: Infinity }); continue; }
          C.place(p, at); C.settle(p);
          p.keys = { Space: true }; p.update(1 / 120); p.keys = {};
          const pred = C.G.flightLand([p.pos.x, p.pos.y, p.pos.z], [p.vel.x, p.vel.y, p.vel.z], w.planets, { frame: p.frame, grav: p.grav });
          let i = 0;
          for (; i < 900; i++) { p.update(1 / 60); if (p.onGround) break; }
          const err = pred ? Math.max(...[0, 1, 2].map(k => Math.abs(pred.pos[k] - p.pos.toArray()[k]))) : Infinity;
          out.push({ hop: `${C.CL.PLANETS[h.from].id}->${C.CL.PLANETS[h.to].id}`, to: p.grav.planet, want: h.to, pred: pred?.planet, err });
        }
        return out;
      });
      t.ok(J.every(j => j.to === j.want && j.pred === j.want && j.err < 1e-9), `a plain jump across each of the ${J.length} gaps between planets bends into the next pull and lands exactly where gravity.js flightLand said (${J.filter(j => j.err >= 1e-9 || j.to !== j.want).map(j => j.hop).join(', ') || 'all exact'})`);
      const PF = await page.evaluate(() => {
        const C = window.__C, w = C.make(1), b = C.CL.BOXES[1], p = C.player(w), out = {};
        C.place(p, C.free(w, [[1, 1, 1]], [b.x0 + 4.5, b.y1, b.z0 + 4.5], 0)); C.settle(p);
        out.stood = p.pos.toArray();
        p.pos.set(5, 40, 5); p.vel.set(0, 0, 0); p.update(1 / 60);
        out.soft = p.grav.soft;
        for (let i = 0; i < 5.5 * 60; i++) p.update(1 / 60);
        out.early = p.caught || 0;
        for (let i = 0; i < 1 * 60; i++) p.update(1 / 60);
        out.caught = p.caught || 0; out.at = p.pos.toArray(); out.frame = p.frame;
        return out;
      });
      t.ok(PF.soft && PF.early === 0 && PF.caught === 1 && PF.at.every((v, k) => Math.abs(v - PF.stood[k]) < 1e-9) && PF.frame === 0, `far out in space after 6 s (not 5.5) a puff puts you back on the last face you stood on`);
      const S = await page.evaluate(cubes => {
        const C = window.__C, w = C.make(2), bad = [];
        for (const pi of cubes) for (const [axis, sign] of C.CL.FACES) {
          const o = [0, 1, 2].find(k => k !== axis), lane = C.lane(w, pi, axis, sign, o, 1), box = C.CL.BOXES[pi], lo = [box.x0, box.y0, box.z0], hi = [box.x1, box.y1, box.z1], at = [0, 0, 0];
          if (!lane) { bad.push(`${pi} [${axis},${sign}] no lane`); continue; }
          at[axis] = sign > 0 ? hi[axis] : lo[axis]; at[o] = (lo[o] + hi[o]) / 2; at[lane.b] = lane.c + 0.5;
          const p = C.player(w); C.place(p, at); const ok = C.settle(p);
          const moves = [1, -1].map(s => { const a = p.pos.clone(), d = [0, 0, 0]; d[o] = s; C.yawToward(p, d); C.walk(p, { KeyW: true }, 0.4, 60); return p.pos.distanceTo(a) > 1; });
          if (!ok || p.grav.planet !== pi || p.grav.axis !== axis || p.grav.sign !== sign || !moves.every(Boolean) || p.collides(p.pos)) bad.push(`${pi} [${axis},${sign}] ${ok} ${moves}`);
        }
        return bad;
      }, CUBES);
      t.ok(!S.length, `you can stand on every face of every cube planet (seed 2), feet toward the planet, and walk both ways across it ${S.slice(0, 3).join(' | ')}`);
    }
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }

  /* ------------------------------------------------------------ play, real, shots (the game) */
  if (want('play') || want('shots')) {
    const page = await retry(() => openGame(browser, base));
    await newGame(page, 0); await pause(page);
    await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.weather.set('clear'); g.time = 0.25; const c = S.makeCreature('blazehound', 30); c.traits = ['rideable']; g.party.unshift(c); });
    const rode = await intoCubes(page, { ride: true });
    await harness(page); await arm(page);
    if (want('play')) {
      const D0 = await page.evaluate(() => {
        const R = window.__R, { g, p, live } = R, toasts = window.__toasts, out = {};
        out.rideOn = g.riding.on; out.start = g.riding.start(); out.rideMsg = [...document.querySelectorAll('#toast div')].map(d => d.textContent).join('|');
        for (let i = 0; i < 6; i++) R.env.step(1 / 60);
        out.place = g.place; out.frame = p.frameNo(); out.ground = p.onGround; out.y = p.pos.y; out.top = R.CL.BOXES[0].y1;
        g.updateGuide(); out.guide = document.getElementById('guide')?.textContent || '';
        out.people = g.npcs.list.filter(n => n.def?.boss === 'gravity' || n.def?.id === 'gravity').map(n => n.name).sort().join();
        out.chip = document.getElementById('score-chip')?.textContent || '';
        const c = { x: Math.floor(p.pos.x), y: Math.floor(p.pos.y) - 1, z: Math.floor(p.pos.z) };
        out.edit = g.world.editAllowed(c.x, c.y, c.z, R.CL.P && 0) || g.world.editAllowed(c.x, c.y + 1, c.z, 5);
        out.stars = !!live.stars?.parent;
        return out;
      });
      t.ok(rode && !D0.rideOn && D0.start === false && /No riding on the little planets/.test(D0.rideMsg), `arriving on a creature gets you off and you can't get on again here ("No riding on the little planets")`);
      t.ok(D0.place === 'gravity' && D0.frame === 0 && D0.ground && D0.y === D0.top && /Crystal Cube/.test(D0.guide) && D0.people === 'Captain Comet,Moon Mechanic Milo,Professor Orbit,Stargazer Stella' && /0 \/ 3/.test(D0.chip) && D0.edit === false && D0.stars,
        `the gold-and-lilac frame opens Cube Planets: upright on the Meadow Cube, the guide leads to the Orbikit Chase ("${D0.guide}"), Professor Orbit and his three helpers are there, the chip says "${D0.chip}", no building, a starry sky`);
      // wild Gravity creatures circle on top of the planets (the game's own spawner, while the game runs)
      await page.evaluate(() => { const g = window.pokecraft, n = g.world.nooks[0]; g.player.pos.set(n.x + 8.5, n.y, n.z + 0.5); });
      const W0 = await waitFor(page, () => window.pokecraft.creatures.list.length > 0, null, 120000).then(() => page.evaluate(() => {
        const g = window.pokecraft, w = g.creatures.list[0], x0 = w.pos.x, z0 = w.pos.z;
        const before = { x: w.pos.x, z: w.pos.z };
        g.creatures.viewer = { x: 0, y: 0, z: 0 };
        g.creatures.updateOrbit?.(w, 1.0);
        const moved = Math.hypot(w.pos.x - before.x, w.pos.z - before.z);
        const onTop = g.world.nooks.some(n => Math.abs(n.y - w.pos.y) < 0.01);
        return { sp: w.data.species, type: w.species.type, gait: w.species.gait, moved, onTop, n: g.creatures.list.length };
      })).catch(e => ({ err: e.message }));
      t.ok(W0.type === 'gravity' && W0.gait === 'orbit' && W0.moved > 0.1 && W0.onTop, `a wild ${W0.sp} turns up, circling slowly on top of a little planet (${JSON.stringify(W0)})`);
      await page.evaluate(() => { const g = window.pokecraft; for (const w of [...g.creatures.list]) g.creatures.remove?.(w); });
      // the guide on a side face: walk over the Meadow Cube's east edge
      const D1 = await page.evaluate(() => {
        const R = window.__R, { g, p } = R, C = window.__C, b = C.CL.BOXES[0], out = {};
        C.place(p, [b.x1 - 1.5, b.y1, b.z0 + 6.5]); C.settle(p); C.yawToward(p, [1, 0, 0]);
        p.keys = { KeyW: true }; for (let i = 0; i < 60; i++) R.env.step(1 / 60); p.keys = {}; for (let i = 0; i < 30; i++) R.env.step(1 / 60);
        out.down = C.G.downOf(p.frame).join(); g.updateGuide(); out.guide = document.getElementById('guide')?.textContent || '';
        const ai = g.realms.aim(p.pos); out.arrow = ai && Number.isFinite(ai.x);
        return out;
      });
      t.ok(D1.down === '-1,0,0' && /Crystal Cube/.test(D1.guide) && D1.arrow, `on the Meadow Cube's east side the guide still points the way on your own face: "${D1.guide}"`);
      // the three games through the game's own live part (the bots of cubebots.mjs on the game's player)
      const GM = await page.evaluate(() => {
        const R = window.__R, { live, env, Bots } = R, out = {};
        out.chase = [0, 1, 2].map(i => Bots.playChase(env, i, 'skilled').tagged);
        out.tagSaid = R.said('Tagged!');
        out.hop = [0, 1, 2, 3].map(k => Bots.playHop(env, k, 'skilled').ok);
        out.hopSaid = R.said('hopped every pebble');
        out.moon = [0, 1, 2].map(() => Bots.playMoon(env, 'skilled').hit);
        out.st = live.state(); R.g.updateGuide(); out.guide = document.getElementById('guide')?.textContent;
        return out;
      });
      t.ok(GM.chase.every(Boolean) && GM.hop.every(Boolean) && GM.moon.every(Boolean) && GM.st.done && GM.tagSaid && GM.hopSaid, `in the game: three Orbikits tagged, four flower hops to the Last Pebble, three rings from the moon: all seven keys saved (${JSON.stringify(GM.st)}); the guide now says "${GM.guide}"`);
      // the Boss's gate (the helpers first), the helpers, a lost battle, the star, the keys cleared
      const G0 = await page.evaluate(() => { const R = window.__R, { g } = R; R.near(R.boss()); window.__toasts.length = 0; g.talkTo(R.boss()); return { battle: g.inBattle, said: window.__toasts.join('|') }; });
      t.ok(!G0.battle && /Stargazer Stella/.test(G0.said), `Professor Orbit waits for his helpers first: "${G0.said}"`);
      for (let i = 0; i < 3; i++) {
        await page.evaluate(async i => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('thunderwolf', 100)]; R.near(R.crew(i)); g.talkTo(R.crew(i)); }, i);
        await playBattle(page);
      }
      const C3 = await page.evaluate(() => window.pokecraft.beaten.filter(k => /pw:gravity:crew/.test(k)).length);
      await page.evaluate(async () => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('fluffin', 2)]; R.near(R.boss()); g.talkTo(R.boss()); });
      const lost = await playBattle(page);
      const L1 = await page.evaluate(() => { const g = window.pokecraft; return { place: g.place, star: g.stars.includes('gravity'), said: window.__R.said('A fine try') }; });
      t.ok(C3 === 3 && lost && L1.place === 'gravity' && !L1.star && L1.said, `the three helpers battle and are beaten (${C3}); a weak team loses to Professor Orbit and stays on the little planets`);
      await page.evaluate(async () => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('thunderwolf', 100)]; R.near(R.boss()); g.talkTo(R.boss()); });
      await playBattle(page);
      const W1 = await page.evaluate(() => { const R = window.__R, { g, live } = R; live.step(0.1); return { star: g.stars.includes('gravity'), keys: g.beaten.filter(k => /pw:gravity:(tag|hop|ring)/.test(k)).length, crew: g.beaten.filter(k => /pw:gravity:crew/.test(k)).length, note: R.said('walking round every one'), hard: live.hard }; });
      t.ok(W1.star && W1.keys === 0 && W1.crew === 3 && W1.note && W1.hard, 'the star and the Wizard\'s note; the seven keys are cleared for a rematch (the helpers stay beaten); the games are now a bit harder');
      // a rematch: the games are needed again, then the Professor asks
      const RM = await page.evaluate(() => { const R = window.__R, { g, live } = R; live.winUpTo(3, true, 3); R.near(R.boss()); g.talkTo(R.boss()); return { asking: g.ui.asking }; });
      if (RM.asking) { await page.evaluate(() => window.pokecraft.ui.askYes()); await playBattle(page); }
      const RW = await page.evaluate(() => window.pokecraft.bossWins.gravity || 0);
      t.ok(RM.asking && RW === 1, `with the star and the games won again, Professor Orbit asks for a rematch and it is won (${RW})`);
      // stand on the Crystal Cube's north side, save, reload: the same spot, the same frame
      const S0 = await page.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, h = C.CL.HOPS.find(h => h.from === C.CL.P.crystal && h.axis === 2); C.place(p, C.hopFree(g.world, h)); C.settle(p); p.yaw = 1.1; g.beaten.push('pw:gravity:tag2'); g.save(); return { pos: p.pos.toArray(), frame: p.frameNo(), yaw: p.yaw, saved: JSON.parse(localStorage.getItem('pokecraft-save-v2')).realmPos }; });
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page); await placeIs(page, 'gravity');
      const S1 = await page.evaluate(() => { const g = window.pokecraft, p = g.player; return { pos: p.pos.toArray(), frame: p.frameNo(), yaw: p.yaw, key: g.beaten.includes('pw:gravity:tag2'), star: g.stars.includes('gravity') }; });
      t.ok(S0.saved.length === 6 && S0.saved[5] === S0.frame && S1.frame === S0.frame && S1.pos.every((v, k) => Math.abs(v - S0.pos[k]) < 1e-9) && S0.frame !== 0 && S1.key && S1.star, `a save on the Crystal Cube's north side keeps the frame as a 6th value; after a reload you stand on the same spot of the same side (frame ${S1.frame}), the keys and the star kept`);
      // an old 5-value spot loads upright; a save from step 0 (realm version 1) arrives at the start
      await page.context().addInitScript(() => {
        if (sessionStorage.getItem('cube5')) return;
        const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); s.realmPos = [104.5, 27, 147.5, 0.3, 0];
        localStorage.setItem('pokecraft-save-v2', JSON.stringify(s)); sessionStorage.setItem('cube5', '1');
      });
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page); await placeIs(page, 'gravity');
      const S2 = await page.evaluate(() => { const g = window.pokecraft, p = g.player; for (let i = 0; i < 4; i++) p.update(1 / 60); return { pos: p.pos.toArray(), frame: p.frameNo(), ground: p.onGround }; });
      t.ok(S2.frame === 0 && S2.pos[0] === 104.5 && S2.pos[2] === 147.5 && S2.pos[1] === 27 && S2.ground, `a save with an old 5-value spot loads upright, at that spot`);
      await page.context().addInitScript(() => {
        if (sessionStorage.getItem('cubev1')) return;
        const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); s.realmPos = [125.5, 28, 130.5, 0.3, 0, 8]; s.realmVersions = { ...(s.realmVersions || {}), gravity: 1 };
        localStorage.setItem('pokecraft-save-v2', JSON.stringify(s)); sessionStorage.setItem('cubev1', '1');
      });
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page); await placeIs(page, 'gravity');
      const S3 = await page.evaluate(() => { const g = window.pokecraft, p = g.player, a = g.world.arrivals.gravity; return { d: Math.hypot(p.pos.x - a[0], p.pos.z - a[2]), y: p.pos.y - a[1], star: g.stars.includes('gravity') }; });
      t.ok(S3.d < 0.01 && Math.abs(S3.y) < 0.01 && S3.star, `a save from step 0 (the old planets, realm version 1) arrives at the start, nothing else lost`);
      // the way back (on the Great Cube too)
      await harness(page); await arm(page);
      await page.evaluate(() => { const g = window.pokecraft, d = g.world.doors[1], c = d.surface[Math.floor(d.surface.length / 2)]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
      await placeIs(page, 'swirl');
      const S4 = await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'gravity'), p = g.player; return { d: Math.hypot(p.pos.x - f.stand[0] - 0.5, p.pos.z - f.stand[2] - 0.5), frame: p.frameNo(), view: p.viewQuat() }; });
      t.ok(S4.d < 4 && S4.frame === null && S4.view === null, `the way back on the Great Cube puts you in front of the Cube Planets frame in the Swirl, upright again`);
      if (want('shots')) { await intoCubes(page); await harness(page); await arm(page); }
    }
    if (want('shots')) {
      const S = page => page.evaluate(fn => window.__shotPos = fn, null);
      await page.evaluate(() => { const R = window.__R; R.live.manual = true; });
      // on a side face, looking along it to the Crystal Cube
      await page.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, b = C.CL.BOXES[0]; C.place(p, [b.x1, b.y0 + 6.5, b.z0 + 9.5]); C.settle(p); p.yaw = 0.5; p.pitch = 0.15; p.update(1); });
      await shot(page, 'cube-side.png');
      // the Orbikit Chase: the pup on its loop, its trail, waiting round a corner
      await page.evaluate(() => { const R = window.__R, { live, p, env } = R, C = window.__C, b = C.CL.BOXES[C.CL.P.crystal]; C.place(p, [b.x0 + 4.5, b.y1, b.z1 - 0.5]); C.settle(p); for (let i = 0; i < 40; i++) env.step(1 / 30); const r = live.pups[0].run; if (r) { r.s = 2; r.dir = 1; } live.step(0.05); p.lookAt({ x: b.x0 + 3, y: b.y1, z: b.z0 + 4.5 }); p.pitch -= 0.2; });
      await shot(page, 'cube-chase.png');
      // a launch flower, then mid-flight to the next pebble
      await page.evaluate(() => { const R = window.__R, { live, p } = R; live.puffTo(live.flowerStand(1)); p.update(0.5); p.pitch = -0.2; live.step(0.05); });
      await shot(page, 'cube-flower.png');
      await page.evaluate(() => { const R = window.__R, { live, p, env } = R, f = R.CL.FLOWERS[1]; live.puffTo(live.flowerStand(1)); p.keys = { KeyW: true }; for (let i = 0; i < 120 && !live.flight; i++) { p.keys = { KeyW: true, Space: R.g.world.launchAt(p.pos, p.frameNo()) > 0 }; env.step(1 / 60); } p.keys = {}; for (let i = 0; i < 40; i++) env.step(1 / 60); });
      await shot(page, 'cube-hop.png');
      // riding the moon toward a ring
      await page.evaluate(() => { const R = window.__R, { live, p, env } = R; live.moonT = 0; const s = live.moonObj.safe(); live.puffTo({ pos: [s.x - 1.2, s.y, s.z], frame: 0 }); live.board(); live.moonT = 5; env.step(0.02); const r = R.CL.RINGS[0]; p.lookAt({ x: r.x, y: live.M.top, z: r.z }); });
      await shot(page, 'cube-moon.png');
      await page.evaluate(() => { window.__R.live.getOff(true); });
      // Professor Orbit on the Great Cube
      await page.evaluate(() => { const R = window.__R, { p } = R, b = R.boss(); R.near(b); p.lookAt({ x: b.pos.x, y: b.pos.y + 1.4, z: b.pos.z }); });
      await shot(page, 'cube-boss.png');
      // under a planet (upside down)
      await page.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, m = C.CL.BOXES[C.CL.P.great]; C.place(p, [m.x0 + 8.5, m.y0, m.z0 + 9.5]); C.settle(p); p.yaw = 0.8; p.pitch = 0.1; p.update(1); });
      await shot(page, 'cube-under.png');
      // the Gravity creatures
      await page.evaluate(async () => {
        const g = window.pokecraft, S = await import('/src/species.js'), C = window.__C, b = C.CL.BOXES[0], p = g.player;
        C.place(p, [b.x0 + 2.5, b.y1, b.z0 + 6.5]); C.settle(p);
        ['orbikit', 'orbitah', 'hootiter', 'saturnowl', 'danglet', 'turvysloth', 'wallibex'].forEach((id, i) => { const m = S.buildModel(id); m.position.set(b.x0 + 6.5, b.y1, b.z0 + 1.5 + i * 1.6); m.rotation.y = -Math.PI / 2; g.scene.add(m); (window.__models ||= []).push(m); });
        p.lookAt({ x: b.x0 + 6.5, y: b.y1 + 0.6, z: b.z0 + 6.5 });
      });
      await shot(page, 'cube-creatures.png');
      await page.evaluate(() => { for (const m of window.__models || []) m.parent?.remove(m); });
    }
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }

  /* ------------------------------------------------------------ real: real key presses through the game's own handlers and loop */
  if (want('real')) {
    const fakeLock = () => {
      Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get() { return window.__lock ? document.getElementById('game') : null; } });
      const change = on => { window.__lock = on; setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0); };
      HTMLCanvasElement.prototype.requestPointerLock = function () { change(true); return Promise.resolve(); };
      Document.prototype.exitPointerLock = function () { change(false); };
    };
    const page = await retry(() => openGame(browser, base, { setup: ctx => ctx.addInitScript(fakeLock) }));
    await newGame(page, 0);
    await page.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });
    await intoCubes(page);
    await harness(page); await arm(page);
    await page.evaluate(() => { const R = window.__R; R.live.manual = false; R.live.playing = () => window.pokecraft.playing(); });
    await page.evaluate(() => document.getElementById('game').requestPointerLock());
    await waitFor(page, () => !!document.pointerLockElement && window.pokecraft.started && document.getElementById('pause').classList.contains('hidden'), null, 20000);
    // a flower hop: stand behind the first flower facing the next pebble, hold W, press Space on the pad
    await page.evaluate(() => { const R = window.__R; R.live.puffTo(R.live.flowerStand(0)); window.__toasts.length = 0; });
    await page.keyboard.down('KeyW');
    await waitFor(page, () => { const g = window.pokecraft; return g.world.launchAt(g.player.pos, g.player.frameNo()) > 0; }, null, 60000);
    await page.keyboard.press('Space');
    await waitFor(page, () => !!window.__R.live.flight, null, 30000).catch(() => {});
    await page.keyboard.up('KeyW');
    await waitFor(page, () => { const R = window.__R; return !R.live.flight && R.p.onGround; }, null, 90000).catch(() => {});
    const K1 = await page.evaluate(() => { const R = window.__R; return { on: R.p.grav.planet, want: R.CL.P.hop1, said: window.__toasts.join('|') }; });
    t.ok(K1.on === K1.want, `real keys through the game's own loop: hold W, press Space on the flower: you land on the Pebble ("${K1.said.slice(0, 80)}")`);
    // the Moon Ride: E at the stop to hop on, Space at the right moment
    await page.evaluate(() => { const R = window.__R, s = R.live.moonObj.safe(); R.live.puffTo({ pos: [s.x - 1.2, s.y, s.z], frame: 0, look: [s.x - 5, s.y, s.z] }); });
    await waitFor(page, () => window.__R.live.near(window.__R.p) === 'Hop on!', null, 120000);
    await page.keyboard.press('KeyE');
    await waitFor(page, () => window.__R.live.onMoon, null, 30000);
    const plan = await page.evaluate(() => { const R = window.__R, b = R.Bots.bestJump(R.live, R.live.ringRound()); return { u: b.u, cyc: R.live.moonNow().cycle }; });
    await waitFor(page, ({ u, cyc }) => { const L = window.__R.live, v = ((L.moonT % cyc) + cyc) % cyc; return v >= u - 0.03 && v < u + 0.2; }, plan, 120000);
    await page.keyboard.press('Space');
    await waitFor(page, () => !window.__R.live.onMoon && !window.__R.live.jump, null, 60000).catch(() => {});
    const K2 = await page.evaluate(() => ({ rings: window.__R.live.state().rings, said: window.__toasts.slice(-2).join('|') }));
    t.ok(K2.rings >= 1, `real keys: E at the moon stop hops on, Space at the right moment lands in the ring (${K2.rings} ring, "${K2.said}")`);
    t.ok(!page.errors.length, `no page errors with real keys ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }

  /* ------------------------------------------------------------ ipad */
  if (want('ipad')) {
    const ip = await retry(() => openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] }));
    await newGame(ip, 0);
    await ip.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.weather.set('clear'); g.time = 0.25; const c = S.makeCreature('blazehound', 30); c.traits = ['rideable']; g.party.unshift(c); });
    await intoCubes(ip);
    await harness(ip);
    const I = await ip.evaluate(() => {
      const g = window.pokecraft, p = g.player, C = window.__C, b = C.CL.BOXES[0], out = {};
      g.started = true;
      C.place(p, C.free(g.world, [[0, 0, -1]], [b.x0, b.y0 + 6.5, b.z0 + 6.5], 2)); C.settle(p); p.yaw = 0.7; p.pitch = 0; p.update(1);
      const fwd = p.forward.clone(), a = p.pos.clone();
      p.joy = { x: 0, y: -1 }; for (let i = 0; i < 20; i++) p.update(1 / 60); p.joy = null;
      const m = p.pos.clone().sub(a);
      out.normal = Math.abs(m.x); out.dot = m.clone().normalize().dot(fwd.clone().normalize()); out.down = C.G.downOf(p.frame).join();
      const t = C.CL.BOXES[0]; C.place(p, [t.x0 + 6.5, t.y1, t.z1 - 1.5]); C.settle(p); C.yawToward(p, [0, 0, 1]); p.update(1);
      const angle = () => { const u = C.G.upOf(p.frame), cu = new p.pos.constructor(0, 1, 0).applyQuaternion(p.viewQuat()); return Math.acos(Math.max(-1, Math.min(1, cu.x * u[0] + cu.y * u[1] + cu.z * u[2]))) * 180 / Math.PI; };
      p.joy = { x: 0, y: -1 }; let f0 = p.frame, i = 0;
      for (; i < 120 && p.frame === f0; i++) p.update(1 / 60);
      out.turned = p.frame !== f0; out.a0 = angle();
      for (let k = 0; k < 12; k++) p.update(1 / 60); out.a02 = angle();
      for (let k = 0; k < 18; k++) p.update(1 / 60); out.a05 = angle();
      p.joy = null;
      return out;
    });
    t.ok(I.down === '1,0,0' && I.dot > 0.98 && I.normal < 1e-9, `iPad: on a side face the stick pushed up moves you where you look along the face (${I.dot.toFixed(3)}), never off the face`);
    t.ok(I.turned && I.a0 > 80 && I.a02 > 10 && I.a02 < 80 && I.a05 < 1, `iPad: over an edge the camera's up turns slowly: ${I.a0.toFixed(0)}° at the turn, ${I.a02.toFixed(0)}° after 0.2 s, ${I.a05.toFixed(1)}° after 0.5 s`);
    // the Ride slot dims with the no-riding words; the action button says Tag! and Hop on!
    await ip.evaluate(() => { const g = window.pokecraft, C = window.__C, b = C.CL.BOXES[0]; C.place(g.player, [b.x0 + 6.5, b.y1, b.z0 + 9.5]); C.settle(g.player); });
    await ip.waitForFunction(() => document.getElementById('btn-ride').classList.contains('dim'), null, { timeout: 60000 });
    await ip.evaluate(() => window.pokecraft.ui.toastBox.replaceChildren());
    await ip.tap('#btn-ride');
    const T1 = await ip.evaluate(() => ({ text: document.getElementById('btn-ride').textContent, riding: window.pokecraft.riding.on, toast: document.getElementById('toast').textContent }));
    t.ok(T1.text === 'Ride' && !T1.riding && /No riding on the little planets/.test(T1.toast), `iPad: the Ride slot is dim here; a tap says "${T1.toast}" (no steady camera any more)`);
    await arm(ip);
    const A1 = await ip.evaluate(() => {
      const R = window.__R, { live, p, env } = R, out = {};
      const s = live.moonObj.safe(); live.puffTo({ pos: [s.x - 1.2, s.y, s.z], frame: 0, look: [s.x - 5, s.y, s.z] });
      live.moonT = 0.2; env.step(0.02); out.moon = live.near(p);
      return out;
    });
    await ip.evaluate(() => { window.__R.live.manual = false; });
    await ip.waitForFunction(() => document.getElementById('btn-act').textContent === 'Hop on!', null, { timeout: 60000 }).catch(() => {});
    const A2 = await ip.evaluate(() => document.getElementById('btn-act').textContent);
    await ip.evaluate(() => { window.__R.live.manual = true; });
    t.ok(A1.moon === 'Hop on!' && A2 === 'Hop on!', `iPad: at the moon stop the big action button says "${A2}"`);
    await shot(ip, 'cube-ipad.png');
    t.ok(!ip.errors.length, `no page errors on the iPad ${ip.errors.slice(0, 3).join(' | ')}`);
    await ip.context().close();
  }

  /* ------------------------------------------------------------ pair */
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
    await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000);
    for (const P of [A, Bp]) await P.evaluate(() => { window.pokecraft.champion = true; });
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'swirl');
    const cell = await A.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'gravity'), p = g.player; p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 }); return f.cloth[Math.floor(f.cloth.length / 2)]; });
    await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(A, 'gravity');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'gravity');
    await harness(A);
    // Dad walks over the Meadow Cube's east edge and stands on its side; the Kid sees his avatar turned to that face
    const dad = await A.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, b = C.CL.BOXES[0]; C.place(p, [b.x1, b.y0 + 6.5, b.z0 + 6.5]); C.settle(p); g.mp.sendState(); return { frame: p.frameNo(), pos: p.pos.toArray() }; });
    await waitFor(Bp, f => [...window.pokecraft.mp.others.values()].some(a => a.frame === f), dad.frame, 30000).catch(() => {});
    const kid = await Bp.evaluate(async f => {
      const g = window.pokecraft, Gm = await import('/src/gravity.js'), a = [...g.mp.others.values()][0];
      for (let i = 0; i < 30; i++) a.tick(1 / 30, g.world);
      const up = new a.model.position.constructor(0, 1, 0).applyQuaternion(a.model.quaternion), want = Gm.upOf(f);
      return { frame: a.frame, here: a.here, visible: a.model.visible, dot: up.x * want[0] + up.y * want[1] + up.z * want[2], pos: a.pos.toArray() };
    }, dad.frame);
    t.ok(dad.frame !== 0 && kid.frame === dad.frame && kid.here && kid.visible && kid.dot > 0.999 && Math.hypot(kid.pos[0] - dad.pos[0], kid.pos[2] - dad.pos[2]) < 0.5, `two browsers: Dad stands on the Meadow Cube's side (frame ${dad.frame}); the Kid sees him there, standing out from that face (up ${kid.dot.toFixed(3)})`);
    // back upright: the avatar stands up again
    await A.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, b = C.CL.BOXES[0]; C.place(p, [b.x0 + 6.5, b.y1, b.z0 + 6.5]); C.settle(p); g.mp.sendState(); });
    await waitFor(Bp, () => [...window.pokecraft.mp.others.values()].some(a => a.frame === 0), null, 30000).catch(() => {});
    const kid2 = await Bp.evaluate(() => { const g = window.pokecraft, a = [...g.mp.others.values()][0]; for (let i = 0; i < 10; i++) a.tick(1 / 30, g.world); return { frame: a.frame, rx: a.model.rotation.x, rz: a.model.rotation.z }; });
    t.ok(kid2.frame === 0 && Math.abs(kid2.rx) < 1e-9 && Math.abs(kid2.rz) < 1e-9, 'back on top his avatar stands upright again');
    if (want('shots') || process.env.CUBE_SHOTS) {
      await Bp.evaluate(() => { const g = window.pokecraft, C = window.__C; }).catch(() => {});
      await A.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, b = C.CL.BOXES[0]; C.place(p, [b.x1, b.y0 + 6.5, b.z0 + 6.5]); C.settle(p); g.mp.sendState(); });
      await Bp.evaluate(() => { const g = window.pokecraft, p = g.player, b = { x: 111, y: 27, z: 146.5 }; p.pos.set(115.5, 25, 144.5); p.vel.set(0, 0, 0); p.lookAt({ x: 111, y: 21, z: 146.5 }); });
      await Bp.waitForTimeout(1500);
      await shot(Bp, 'cube-pair.png');
    }
    t.ok(!A.errors.length && !Bp.errors.length, `no page errors in the pair ${A.errors.concat(Bp.errors).slice(0, 3).join('; ')}`);
    await A.context().close(); await Bp.context().close();
  }

  /* ------------------------------------------------------------ closed */
  if (want('closed')) {
    const shut = await retry(() => openGame(browser, base, { wave15: false }));
    const c = await shut.evaluate(async () => { const PW = await import('/src/pictureworlds.js'), C = await import('/src/comingsoon.js'); const w = PW.pictureWorld('gravity'); return { ready: w.ready, secret: w.secret, name: w.name, emoji: w.emoji, open: C.worldOpen('gravity'), later: C.LATER.includes('gravity'), frame: w.frame.map(x => x.toString(16)).join() }; });
    t.ok(!c.ready && c.secret && c.name === 'Secret World' && c.emoji === '❓' && !c.open && c.later && c.frame === 'f0d080,d8c8f8', `closed without ?preview: the frame is the old secret one (${c.name} ${c.emoji}, colours ${c.frame})`);
    await newGame(shut, 0); await pause(shut);
    await shut.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
    await placeIs(shut, 'swirl');
    const r = await shut.evaluate(async () => {
      const g = window.pokecraft, { B } = await import('/src/blocks.js'), f = g.world.swirl.frames.find(f => f.world === 'gravity'), c = f.cloth[12];
      const cloth = f.cloth.every(x => g.world.get(...x) === B.CLOTH);
      g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) });
      g.updateGuide(); const guide = document.getElementById('guide')?.textContent || '';
      return { cloth, guide };
    });
    await shut.waitForTimeout(1500);
    const place = await shut.evaluate(() => window.pokecraft.place);
    t.ok(r.cloth && place === 'swirl' && !/Cube Planets/.test(r.guide), `closed: its frame in the Swirl stays under the cloth, stepping to it does not open it, the guide never points in`);
    t.ok(!shut.errors.length, `no page errors when closed ${shut.errors.slice(0, 3).join(' | ')}`);
    await shut.context().close();
  }
}
// with the most kind help the Orbikit's sprint is still faster than your sprint (6.2)
function PUP_FAST(O, h) { return 7.0 * h.sprint > 6.2; }

// A Champion steps into Cube Planets through its frame in the Swirl.
// ride: get on a rideable team creature in the Swirl first (owner 2026-10-29: you get off on arrival) -> whether you were riding.
async function intoCubes(page, { ride = false } = {}) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  const { cell, rode } = await page.evaluate(ride => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'gravity'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    let rode = false;
    if (ride) { const s = g.player.pos.clone(); p.pos.set(s.x, s.y, s.z + 3); rode = g.riding.start(); p.pos.copy(s); }
    return { cell: f.cloth[Math.floor(f.cloth.length / 2)], rode };
  }, ride);
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(page, 'gravity');
  return rode;
}
