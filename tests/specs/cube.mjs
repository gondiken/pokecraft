// Cube Planets, step 0 (plans/cube-planets.md section 9: the gravity sandbox; section 12's step-0 parts).
// off: the main world, the Dream and the Swirl move the player bit for bit as before Cube Planets (a recorded walk / swim / bounce pad /
//   lift stream, tests/cuberecord.mjs, against tests/fixtures/cube-off-golden.json, made with the player.js of before).
// frames (Node): the 24 frames turn and turn back exactly, every turn to every down, the view of the world in a frame.
// gravity (the real Player on a real Cube Planets world, in a page): walking round every edge of every planet (4 ways off each of the 6
//   faces) at 60 and 20 frames a second ends at exactly the same spot, on the next face, with one turn; no flicker along an edge or on
//   it; stepping off a corner; a jump across two fields lands exactly where gravity.js flightLand said; the catch puff after 6 s in
//   space (not before); standing on every face of every planet.
// land (Node, cubecheck.mjs): three seeds: nobody stuck on any face, each planet reached only by its hops, blocks, keeps.
// play: the frame in the Swirl, the arrival, no creatures / riding / building, over an edge, a hop to the next planet, the guide, a
//   reload keeps the spot and the frame, an old 5-value realmPos loads upright, the way back. Screenshots tests/screenshots/cube-*.png.
// closed: without ?preview the frame is the old secret one and the realm is not reached. ipad: the stick means forward on a side face,
//   the camera turns slowly over an edge (0.45 s) and more slowly for a big turn (0.8 s).
// CUBE_ONLY=off|frames|gravity|land|play|closed|ipad|shots
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, newGame, pause, continueGame, waitFor as waitFor0 } from '../helpers.mjs';
import * as G from '../../src/gravity.js';
import * as CL from '../../src/cubeland.js';
import { analyze } from '../cubecheck.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const GOLDEN = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'cube-off-golden.json'), 'utf8'));
const ONLY = process.env.CUBE_ONLY || '';
const want = part => !ONLY || ONLY === part;
const waitFor = (page, fn, arg, timeout = 90000) => waitFor0(page, fn, arg, timeout);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); }); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };
const retry = async (fn, n = 3) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || !/Timeout/.test(e.message)) throw e; console.log('  (the page was slow to start: trying again)'); } } };

// The in-page helpers: a Cube Planets world (made directly, or the game's), the real Player, walking with a fixed frame rate.
const harness = page => page.evaluate(async () => {
  const [{ World }, { REALMS }, { Player }, Gm, CLm, { B }] = await Promise.all(['/src/world.js', '/src/realms.js', '/src/player.js', '/src/gravity.js', '/src/cubeland.js', '/src/blocks.js'].map(u => import(u)));
  const C = window.__C = {
    G: Gm, CL: CLm, B, Player,
    make(seed = 1) { const w = new World(seed, null, null, REALMS.gravity.size, REALMS.gravity); w.generate(); return w; },
    player(w) { return new Player(w); },
    place(p, pos) { p.pos.set(pos[0], pos[1], pos[2]); p.vel.set(0, 0, 0); p.keys = {}; p.joy = null; },
    settle(p) { for (let i = 0; i < 240; i++) { p.update(1 / 60); if (p.onGround && i > 2) return true; } return false; },
    yawToward(p, dir) { const l = Gm.toLocal(p.frame, dir); p.yaw = Math.atan2(-l[0], -l[2]); p.pitch = 0; },
    // walk with `keys` for `secs` at `fps`: -> { pos (full-precision string), turns, frame, down, ground }
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
          const P = CLm.PLANETS[pi], o = [0, 1, 2].filter(k => k !== axis), base = [P.x, P.y, P.z], u = Math.floor(pt[o[0]]) - base[o[0]], v = Math.floor(pt[o[1]]) - base[o[1]];
          if (u < 0 || v < 0 || u >= P.n || v >= P.n) return false;
          return w.cubes.bumps.every(q => q.planet !== pi || q.axis !== axis || q.sign !== sign || Math.max(Math.abs(q.u - u), Math.abs(q.v - v)) > r + (q.kind === 'tree' ? 1 : 0));
        });
        if (ok) return pt;
      }
      return null;
    },
    hopFree(w, h) { return C.free(w, [[h.from, h.axis, h.sign], [h.to, h.axis, -h.sign]], CLm.hopSpot(h), 1); },
    // a free lane across a face along world axis `b` (cell index), away from that face's and the next face's bumps
    // a free lane (world axis b, cell c) for a walk from the middle of face [axis, sign] over its edge toward [a, s] and 5 cells onto that
    // face: every cell on the way has 2 cells of air above it (no little thing, no door frame in the way)
    lane(w, pi, axis, sign, a, s) {
      const P = CLm.PLANETS[pi], b = [0, 1, 2].find(k => k !== axis && k !== a), base = [P.x, P.y, P.z], mid = Math.floor(P.n / 2), m = P.n - 1;
      const air = (fax, fsg, cell) => [1, 2].every(out => { const o = [0, 1, 2].filter(k => k !== fax), uv = o.map(k => cell[k] - base[k]); return !w.isSolid(...CLm.faceCell(P, fax, fsg, uv[0], uv[1], out)); });
      const cands = Array.from({ length: P.n - 2 }, (_, i) => i + 1).sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid));
      for (const c of cands) {
        let ok = true;
        for (let i = mid; ok && i >= 0 && i <= m; i += s) { const cell = [0, 0, 0]; cell[axis] = sign > 0 ? base[axis] + m : base[axis]; cell[a] = base[a] + i; cell[b] = base[b] + c; ok = air(axis, sign, cell); }
        for (let k = 0; ok && k < 6; k++) { const cell = [0, 0, 0]; cell[a] = s > 0 ? base[a] + m : base[a]; cell[axis] = sign > 0 ? base[axis] + m - k : base[axis] + k; cell[b] = base[b] + c; ok = air(a, s, cell); }
        if (ok) return { b, c: base[b] + c };
      }
      return null;
    },
  };
  return !!C;
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
      // the world seen from the frame: local cell -> world cell, and the cell's middle turns to the same place
      const ok = [[0, 0, 0], [3, -2, 5], [-4, 7, -1]].every(c => { const wc = G.cellToWorld(f.i, ...c), mid = G.toWorld(f.i, c.map(x => x + 0.5)); return wc.every((x, k) => x === Math.floor(mid[k])); });
      if (ok) cells++;
    }
    const dets = F.every(f => { const m = f.m; return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]) === 1; });
    t.ok(F.length === 24 && new Set(F.map(f => f.m.join())).size === 24 && dets && F[0].m.join() === '1,0,0,0,1,0,0,0,1', `24 different frames, all turns (no mirror), frame 0 is upright`);
    t.ok(round === 24 && turns === 144 && back === 144 && cells === 24, `every frame turns a point to the world and back exactly (${round}/24); from every frame every down is one smallest turn away (${turns}/144) and turning back gives the same frame (${back}/144); the world view's cells match (${cells}/24)`);
    // downAt: the rule, the hysteresis
    const P = [{ x0: 0, y0: 0, z0: 0, x1: 10, y1: 10, z1: 10, reach: 8, g: 0.7 }, { x0: 13, y0: 0, z0: 0, x1: 20, y1: 10, z1: 10, reach: 8, g: 0.6 }];
    const top = G.downAt(P, [5, 10, 5]), east = G.downAt(P, [10, 5, 5]), under = G.downAt(P, [5, 0, 5]);
    const keepTop = G.downAt(P, [10.35, 10, 5], top), turnEast = G.downAt(P, [10.45, 10, 5], top), keepEast = G.downAt(P, [10, 10.35, 5], east);
    const mid1 = G.downAt(P, [11.6, 5, 5], east), mid2 = G.downAt(P, [11.75, 5, 5], east), space = G.downAt(P, [-30, 5, 5]);
    t.ok(top.down.join() === '0,-1,0' && east.down.join() === '-1,0,0' && under.down.join() === '0,1,0' && keepTop.down.join() === '0,-1,0' && turnEast.down.join() === '-1,0,0' && keepEast.down.join() === '-1,0,0',
      'down is toward the planet along the axis you are furthest out on (top -y, east -x, under +y); over an edge it turns only when the new side wins by 0.4 (no flicker)');
    t.ok(mid1.planet === 0 && mid2.planet === 1 && mid2.down.join() === '1,0,0' && space.soft && space.g < P[0].g && !mid2.soft, `between two planets the nearer one pulls (with 0.4 to spare: ${mid1.planet} at 11.6, ${mid2.planet} at 11.75); far out a soft pull (g ${space.g.toFixed(2)})`);
    // a flight's sub-steps: the same at any step count of the same size, and a flight bends into the next field
    const f1 = G.flightAt([10.001, 5, 5], [8.6, 0, 0], P, 1), f2 = G.flightLand([10.001, 5, 5], [8.6, 0, 0], P);
    t.ok(f2 && f2.planet === 1 && f2.turns >= 1 && Math.abs(f2.pos[0] - 13) < 1e-12 && f1.pos.every(Number.isFinite), `a jump off a side flies across the gap, the next planet's pull turns it and it lands on that planet's facing side (x ${f2?.pos[0]}, after ${f2?.t.toFixed(2)} s, ${f2?.turns} turn)`);
  }

  /* ------------------------------------------------------------ land (Node) */
  if (want('land')) {
    for (const seed of [1, 2, 3]) {
      const t0 = Date.now(), r = analyze(seed);
      t.ok(!r.problems.length, `seed ${seed}: nobody stuck on any face of the ${CL.PLANETS.length} planets (${CL.PLANETS.map(P => `${P.id} ${r.info[P.id].flat} + ${r.info[P.id].bumps}`).join(', ')}), every planet reached only by its hops (${r.info.hops.join(', ')}), the arrival on top, blocks ${r.info.ids.filter(i => i > 100)}, keeps (${Date.now() - t0} ms) ${r.problems.slice(0, 4).join('; ')}`);
    }
    const a = analyze(1).world, b = analyze(1).world, c = analyze(2).world;
    let same = true, diff = false;
    for (let i = 0; i < a.data.length; i++) { if (a.data[i] !== b.data[i]) same = false; if (a.data[i] !== c.data[i]) diff = true; }
    t.ok(same && diff, 'the same seed makes the same planets, another seed moves their little things');
  }

  /* ------------------------------------------------------------ off + gravity (a page, no game started) */
  if (want('off') || want('gravity')) {
    const page = await retry(() => openGame(browser, base));
    if (want('off')) {
      const now = await page.evaluate(async () => { const R = await import('/tests/cuberecord.mjs'), { Player } = await import('/src/player.js'); return R.recordOff(Player); });
      const rows = [];
      for (const w of ['main', 'dream', 'swirl']) for (const k of Object.keys(GOLDEN[w])) {
        if (k === 'water') continue;
        rows.push([`${w}.${k}`, now[w][k]?.hash === GOLDEN[w][k].hash && now[w][k]?.end === GOLDEN[w][k].end]);
      }
      t.ok(rows.every(r => r[1]) && rows.length === 6, `outside Cube Planets the player moves bit for bit as before (${rows.map(r => `${r[0]} ${r[1] ? 'same' : 'DIFFERENT'}`).join(', ')}: a walk with jumps, sprint, stick and uneven frames; a swim; a Bounce pad; a lift stream)`);
      t.ok(GOLDEN.main.swim.maxY > GOLDEN.main.water[1] && GOLDEN.dream.pad.bounces >= 1 && GOLDEN.swirl.lift.maxY > 15, 'the recordings really swim, bounce and ride a lift');
    }
    if (want('gravity')) {
      await harness(page);
      // walking round every edge of every planet, at 60 and 20 frames a second
      const E = await page.evaluate(() => {
        const C = window.__C, w = C.make(1), rows = [], bad = [];
        for (const [pi, P] of C.CL.PLANETS.entries()) for (const [axis, sign] of C.CL.FACES) for (const a of [0, 1, 2]) for (const s of [1, -1]) {
          if (a === axis) continue;
          const lane = C.lane(w, pi, axis, sign, a, s);
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
      });
      t.ok(E.n === 72 && E.ok === 72, `walking off every face of every planet toward each of its 4 edges, at 60 and 20 frames a second: exactly the same spot, one turn, standing on the next face (${E.ok}/${E.n}) ${E.bad.join(' | ')}`);
      // no flicker: along an edge, on the edge, stopping just over it
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
      t.ok(N.along.turns === 0 && N.along.down === '0,-1,0' && N.astride.turns === 0 && N.astride.ground && N.over.turns === 1 && N.still.turns === 0 && N.back.turns === 1 && N.back.down === '0,-1,0' && N.still2.turns === 0,
        `no flicker: walking along an edge (just inside: ${N.along.turns} turns; standing 0.2 over it: ${N.astride.turns}), over an edge and stopping (${N.over.turns} turn, then ${N.still.turns}), and back (${N.back.turns}, then ${N.still2.turns})`);
      // the steady camera (owner 2026-10-29): over an edge no rolling turn; the view dips to the sky colour, snaps while hidden, comes back
      const SC = await page.evaluate(() => {
        const C = window.__C, w = C.make(1), b = C.CL.BOXES[0], out = {};
        const run = (steady, fps) => {
          const p = C.player(w); p.steady = steady; C.place(p, [b.x1 - 1.5, b.y1, b.z0 + 6.5]); C.settle(p); C.yawToward(p, [1, 0, 0]);
          const rows = []; let f0 = p.frame, turnAt = -1;
          for (let i = 0; i < Math.round(1.5 * fps); i++) {
            p.keys = { KeyW: true }; p.update(1 / fps);
            if (p.frame !== f0 && turnAt < 0) turnAt = i;
            const u = C.G.upOf(p.frame), cu = new p.pos.constructor(0, 1, 0).applyQuaternion(p.viewQuat());
            rows.push({ a: Math.acos(Math.max(-1, Math.min(1, cu.x * u[0] + cu.y * u[1] + cu.z * u[2]))) * 180 / Math.PI, dip: p.dipAmount() });
          }
          return { rows: rows.slice(turnAt), pos: p.pos.toArray().join(), frame: p.frame };
        };
        const s60 = run(true, 60), s20 = run(true, 20), e60 = run(false, 60);
        const mid = r => r.rows.filter(x => x.a > 1 && x.a < 89).length; // a frame with the view part-way round = a rolling turn
        out.steadyMid = mid(s60) + mid(s20); out.easedMid = mid(e60);
        out.peak = Math.max(...s60.rows.map(x => x.dip)); const snapDip = r => { const i = r.rows.findIndex(x => x.a < 1); return i > 0 ? r.rows[i].dip : 0; }; out.snapDip = Math.min(snapDip(s60), snapDip(s20)); out.hiddenSnap = out.snapDip > 0.8;
        const back = s60.rows.findIndex(x => x.a < 1), clear = s60.rows.findIndex((x, i) => i > back && x.dip === 0);
        out.snapT = back / 60; out.clearT = clear / 60; out.same = s60.pos === e60.pos && s60.frame === e60.frame;
        out.easedDip = Math.max(...e60.rows.map(x => x.dip));
        return out;
      });
      t.ok(SC.steadyMid === 0 && SC.easedMid >= 10 && SC.peak > 0.9 && SC.hiddenSnap && SC.snapT <= 0.13 && SC.clearT > 0.25 && SC.clearT <= 0.33 && SC.same && SC.easedDip === 0,
        `steady camera: over an edge the view never rolls part-way (${SC.steadyMid} frames part-way at 60 / 20 fps, the eased turn has ${SC.easedMid}); it dips to the sky colour (peak ${SC.peak.toFixed(2)}), snaps to the new up while hidden (after ${SC.snapT.toFixed(2)} s, at ${SC.snapDip.toFixed(2)} sky) and is clear again after ${SC.clearT.toFixed(2)} s; the walk itself is the same; off (the default) never dips`);
      // stepping off a corner
      const K = await page.evaluate(() => {
        const C = window.__C, w = C.make(1), P = C.CL.BOXES[2], res = [];
        for (const fps of [60, 20]) { const p = C.player(w); C.place(p, [P.x1 - 1.5, P.y1, P.z1 - 1.5]); C.settle(p); C.yawToward(p, [Math.SQRT1_2, 0, Math.SQRT1_2]); res.push(C.walk(p, { KeyW: true }, 2.5, fps)); }
        return res;
      });
      t.ok(K[0].pos === K[1].pos && K[0].ground && K[0].turns >= 1 && ['-1,0,0', '0,0,-1', '0,1,0'].includes(K[0].down), `stepping off a corner of the Moon Cube: you walk round it onto a side and stand there (${K[0].turns} turns, down ${K[0].down}, the same at 60 and 20)`);
      // a jump across two fields lands where flightLand said
      const J = await page.evaluate(() => {
        const C = window.__C, w = C.make(1), out = [];
        for (const h of C.CL.HOPS) {
          const p = C.player(w), at = C.hopFree(w, h);
          C.place(p, at); C.settle(p);
          p.keys = { Space: true }; p.update(1 / 120); p.keys = {};
          const pred = C.G.flightLand([p.pos.x, p.pos.y, p.pos.z], [p.vel.x, p.vel.y, p.vel.z], w.planets, { frame: p.frame, grav: p.grav });
          let i = 0, turns = 0, f0 = p.frame;
          for (; i < 900; i++) { p.update(1 / 60); if (p.frame !== f0) { turns++; f0 = p.frame; } if (p.onGround) break; }
          const err = pred ? Math.max(...[0, 1, 2].map(k => Math.abs(pred.pos[k] - p.pos.toArray()[k]))) : Infinity;
          out.push({ hop: `${h.from}->${h.to}`, to: p.grav.planet, want: h.to, pred: pred?.planet, err, turns, t: pred?.t });
        }
        return out;
      });
      t.ok(J.every(j => j.to === j.want && j.pred === j.want && j.err < 1e-9 && j.turns >= 1), `a plain jump from each hop side flies across two fields, bends and lands exactly where gravity.js flightLand said (${J.map(j => `${j.hop}: ${j.err.toExponential(1)} in ${j.t?.toFixed(2)} s`).join(', ')})`);
      // the catch puff: 6 s outside every field (not before) puts you back on the last face you stood on
      const P = await page.evaluate(() => {
        const C = window.__C, w = C.make(1), b = C.CL.BOXES[1], p = C.player(w), out = {};
        C.place(p, C.free(w, [[1, 1, 1]], [b.x0 + 4.5, b.y1, b.z0 + 4.5], 0)); C.settle(p);
        out.stood = p.pos.toArray();
        p.pos.set(5, 40, 5); p.vel.set(0, 0, 0); p.update(1 / 60);
        out.soft = p.grav.soft;
        for (let i = 0; i < 5.5 * 60; i++) p.update(1 / 60);
        out.early = p.caught || 0; out.moved = p.pos.distanceTo({ x: 5, y: 40, z: 5 }) > 1;
        for (let i = 0; i < 1 * 60; i++) p.update(1 / 60);
        out.caught = p.caught || 0; out.at = p.pos.toArray(); out.frame = p.frame;
        return out;
      });
      t.ok(P.soft && P.moved && P.early === 0 && P.caught === 1 && P.at.every((v, k) => Math.abs(v - P.stood[k]) < 1e-9) && P.frame === 0, `far out in space a soft pull draws you in; after 6 s (not 5.5) a puff puts you back on the last face you stood on (${P.at.map(v => v.toFixed(2))})`);
      // standing on every face of every planet
      const S = await page.evaluate(() => {
        const C = window.__C, w = C.make(2), bad = [];
        for (const [pi] of C.CL.PLANETS.entries()) for (const [axis, sign] of C.CL.FACES) {
          const o = [0, 1, 2].find(k => k !== axis), lane = C.lane(w, pi, axis, sign, o, 1), box = C.CL.BOXES[pi], lo = [box.x0, box.y0, box.z0], hi = [box.x1, box.y1, box.z1], at = [0, 0, 0];
          at[axis] = sign > 0 ? hi[axis] : lo[axis]; at[o] = (lo[o] + hi[o]) / 2; at[lane.b] = lane.c + 0.5;
          const p = C.player(w); C.place(p, at); const ok = C.settle(p);
          const moves = [1, -1].map(s => { const a = p.pos.clone(), d = [0, 0, 0]; d[o] = s; C.yawToward(p, d); C.walk(p, { KeyW: true }, 0.4, 60); return p.pos.distanceTo(a) > 1; });
          if (!ok || p.grav.planet !== pi || p.grav.axis !== axis || p.grav.sign !== sign || !moves.every(Boolean) || p.collides(p.pos)) bad.push(`${pi} [${axis},${sign}] ${ok} ${moves}`);
        }
        return bad;
      });
      t.ok(!S.length, `you can stand on every face of every planet (seed 2), with your feet toward the planet, and walk both ways across it ${S.slice(0, 3).join(' | ')}`);
    }
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
  }

  /* ------------------------------------------------------------ play (the game) */
  if (want('play') || want('shots')) {
    const page = await retry(() => openGame(browser, base));
    await newGame(page, 0); await pause(page);
    await page.evaluate(async () => { const g = window.pokecraft, S = await import('/src/species.js'); g.weather.set('clear'); g.time = 0.25; const c = S.makeCreature('blazehound', 30); c.traits = ['rideable']; g.party.unshift(c); });
    const rode = await intoCubes(page, { ride: true });
    await harness(page);
    // owner 2026-10-29: no riding here. Arriving on a creature gets you off with a word; you can't get on (R, the button, the team card)
    const RD = await page.evaluate(() => {
      const g = window.pokecraft, toasts = () => [...document.querySelectorAll('#toast div')].map(d => d.textContent).join(' | '), out = {};
      out.on = g.riding.on; out.ride = !!g.player.ride; out.arrive = toasts();
      document.getElementById('toast').replaceChildren();
      out.start = g.riding.start(); out.after = g.riding.on || !!g.player.ride; out.startToast = toasts();
      out.fence = g.player.inFrame ? (() => { const p = g.player; p.ride = { kind: 'land', speed: 7, sprint: 9.5, jump: 11.2 }; const hit = p.collides(p.pos); p.ride = null; return hit; })() : null;
      return out;
    });
    t.ok(rode && !RD.on && !RD.ride && /No riding on the little planets/.test(RD.arrive), `arriving on a creature (riding in the Swirl: ${rode}) gets you off, with a word: "${RD.arrive}"`);
    t.ok(RD.start === false && !RD.after && /No riding on the little planets/.test(RD.startToast) && RD.fence === true, `trying to get on here says "${RD.startToast}" and you stay on foot; a rider's box is fenced on every face too (it was not before: the frame's view of the world had no fences)`);
    const D0 = await page.evaluate(async () => {
      const g = window.pokecraft, p = g.player, live = g.gymLive.of('part:gravity'), C = window.__C, out = {};
      for (let i = 0; i < 6; i++) { p.update(1 / 60); live.update(1 / 60); }
      out.place = g.place; out.frame = p.frameNo(); out.ground = p.onGround; out.pos = p.pos.toArray();
      out.top = C.CL.BOXES[0].y1; out.visited = [...live.visited];
      g.updateGuide(); out.guide = document.getElementById('guide')?.textContent || '';
      out.ride = g.world.fenceAt(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z))?.rideText || ''; out.wild = g.creatures.list.length;
      const hit = { x: Math.floor(p.pos.x), y: Math.floor(p.pos.y) - 1, z: Math.floor(p.pos.z) }, before = g.world.get(hit.x, hit.y, hit.z);
      out.edit = g.world.editAllowed(hit.x, hit.y, hit.z, C.B.AIR) || g.world.editAllowed(hit.x, hit.y + 1, hit.z, C.B.PLANKS);
      out.before = before;
      out.stars = !!live.stars?.parent; out.sky = g.world.realm.look.sky;
      return out;
    });
    t.ok(D0.place === 'gravity' && D0.frame === 0 && D0.ground && D0.pos[1] === D0.top && D0.visited.join() === '0', `the gold-and-lilac frame opens Cube Planets: you arrive standing upright on top of the Meadow Cube (y ${D0.pos[1]})`);
    t.ok(/Crystal Cube/.test(D0.guide) && /No riding/.test(D0.ride) && D0.wild === 0 && D0.edit === false && D0.stars, `the guide leads to the next planet ("${D0.guide}"); no riding, no wild creatures, no building or digging; a starry sky`);
    // over the east edge, then a hop to the Crystal Cube (the real game's player, stepped by hand while paused)
    const D1 = await page.evaluate(() => {
      const g = window.pokecraft, p = g.player, C = window.__C, live = g.gymLive.of('part:gravity'), out = {}, b = C.CL.BOXES[0];
      C.place(p, [b.x1 - 1.5, b.y1, b.z0 + 6.5]); C.settle(p); C.yawToward(p, [1, 0, 0]);
      const ups = [];
      p.keys = { KeyW: true };
      for (let i = 0; i < 60; i++) { p.update(1 / 60); live.update(1 / 60); ups.push(new g.player.pos.constructor(0, 1, 0).applyQuaternion(p.viewQuat()).x); }
      p.keys = {}; C.settle(p);
      out.frame = p.frameNo(); out.down = C.G.downOf(p.frame).join(); out.ups = ups;
      g.updateGuide(); out.guide = document.getElementById('guide')?.textContent || '';
      // the hop: walk to the hop spot on this side, jump
      const h = C.CL.HOPS[0], at = C.hopFree(g.world, h);
      C.place(p, at); C.settle(p);
      g.updateGuide(); out.guide2 = document.getElementById('guide')?.textContent || '';
      p.keys = { Space: true }; p.update(1 / 120); p.keys = {};
      let n = 0; for (; n < 600 && !(p.onGround && p.grav.planet === 1); n++) { p.update(1 / 60); live.update(1 / 60); }
      out.planet = p.grav.planet; out.frame2 = p.frameNo(); out.visited = [...live.visited];
      return out;
    });
    const turnSteps = D1.ups.filter((u, i) => i > 0 && Math.abs(u - D1.ups[i - 1]) > 1e-6).length, maxStep = Math.max(...D1.ups.map((u, i) => (i ? Math.abs(u - D1.ups[i - 1]) : 0)));
    t.ok(D1.down === '-1,0,0' && D1.frame === 8 && turnSteps >= 15 && maxStep < 0.12 && /Crystal Cube/.test(D1.guide), `walking over the edge: you stand on the Meadow Cube's east side (frame ${D1.frame}); the camera turned over ${turnSteps} frames, never more than ${maxStep.toFixed(3)} a frame (no snap); the guide: "${D1.guide}"`);
    t.ok(/Jump!/.test(D1.guide2) && D1.planet === 1 && D1.visited.join() === '0,1', `on the side that faces the Crystal Cube the guide says "${D1.guide2}"; a jump flies across and its pull catches you (planet ${D1.planet}, frame ${D1.frame2})`);
    if (want('shots')) {
      // on a side face, looking along it to the Crystal Cube
      await page.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, b = C.CL.BOXES[0]; C.place(p, [b.x1, b.y0 + 6.5, b.z0 + 9.5]); C.settle(p); p.yaw = 0.5; p.pitch = 0.15; p.update(1); });
      await shot(page, 'cube-side.png');
      // mid-hop from the Meadow Cube's east side to the Crystal Cube, looking along the gap (the Meadow below, the Crystal above)
      await page.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, h = C.CL.HOPS[0]; C.place(p, C.hopFree(g.world, h)); C.settle(p); C.yawToward(p, [0, 0, 1]); p.yaw -= 0.35; p.pitch = 0; p.keys = { Space: true }; p.update(1 / 120); p.keys = {}; for (let i = 0; i < 9; i++) p.update(1 / 60); });
      await shot(page, 'cube-hop.png');
      // on top of the Meadow Cube looking at the Moon Cube
      await page.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, b = C.CL.BOXES[0], m = C.CL.BOXES[2]; C.place(p, [b.x1 - 1.5, b.y1, b.z0 + 1.5]); C.settle(p); p.lookAt({ x: (m.x0 + m.x1) / 2, y: (m.y0 + m.y1) / 2 + 2, z: (m.z0 + m.z1) / 2 }); p.update(1); });
      await shot(page, 'cube-top.png');
      // under the Moon Cube (upside down)
      await page.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, m = C.CL.BOXES[2]; C.place(p, [m.x0 + 5.5, m.y0, m.z0 + 7.5]); C.settle(p); p.yaw = 0.8; p.pitch = 0.1; p.update(1); });
      await shot(page, 'cube-under.png');
    }
    if (want('play')) {
      // the steady camera's pause-screen button (owner 2026-10-29): only here, per device (localStorage), never in the game save
      await page.waitForFunction(() => document.getElementById('btn-ride').textContent === 'Steady', null, { timeout: 60000 });
      const B0 = await page.evaluate(() => { const b = document.getElementById('steady-btn'), r = document.getElementById('btn-ride'); window.pokecraft.ui.toastBox.replaceChildren(); const before = { text: b.textContent, hidden: b.classList.contains('hidden'), slot: r.textContent, dim: r.classList.contains('dim') }; b.click(); return { before, after: b.textContent, on: window.pokecraft.steadyCam.on, stored: localStorage.getItem('pokecraft-steady'), toast: document.getElementById('toast').textContent }; });
      await page.waitForFunction(() => !document.getElementById('btn-ride').classList.contains('dim'), null, { timeout: 60000 });
      t.ok(!B0.before.hidden && /Steady camera off/.test(B0.before.text) && /Steady camera on/.test(B0.after) && B0.on && B0.stored === 'on' && /Steady camera on/.test(B0.toast) && B0.before.slot === 'Steady' && B0.before.dim,
        `the pause screen has "${B0.before.text}" here; a click turns it on ("${B0.after}", kept on this device); the Ride slot says ${B0.before.slot} (dim while off, lit once on)`);
      if (want('shots') || process.env.CUBE_SHOTS) { await page.evaluate(() => { window.pokecraft.ui.toastBox.replaceChildren(); document.getElementById('pause').classList.remove('hidden'); }); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(SHOTS, 'cube-pause-steady.png'), timeout: 180000 }); console.log('  screenshot cube-pause-steady.png'); }
      // stand on the Crystal Cube's north side, save, reload: the same spot and the same frame
      const S0 = await page.evaluate(() => { const g = window.pokecraft, p = g.player, C = window.__C, h = C.CL.HOPS[2]; C.place(p, C.hopFree(g.world, h)); C.settle(p); p.yaw = 1.1; g.save(); return { pos: p.pos.toArray(), frame: p.frameNo(), yaw: p.yaw, saved: JSON.parse(localStorage.getItem('pokecraft-save-v2')).realmPos }; });
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page); await placeIs(page, 'gravity');
      const S1 = await page.evaluate(() => { const p = window.pokecraft.player; return { pos: p.pos.toArray(), frame: p.frameNo(), yaw: p.yaw, steady: window.pokecraft.steadyCam.on, inSave: /steady/i.test(localStorage.getItem('pokecraft-save-v2')) }; });
      t.ok(S1.steady && !S1.inSave, `the steady camera is still on after a reload (kept on this device, not in the game save)`);
      t.ok(S0.saved.length === 6 && S0.saved[5] === S0.frame && S1.frame === S0.frame && S1.pos.every((v, k) => Math.abs(v - S0.pos[k]) < 1e-9) && Math.abs(S1.yaw - S0.yaw) < 1e-9 && S0.frame !== 0, `a save on the Crystal Cube's north side keeps the frame as a 6th value (${S0.saved.slice(3).map(v => +v.toFixed(2))}); after a reload you stand on the same spot of the same side (frame ${S1.frame})`);
      // an old 5-value realmPos (from before this change) loads upright
      await page.context().addInitScript(() => { // (after the page's own save on unload)
        if (sessionStorage.getItem('cube5')) return;
        const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); s.realmPos = [104.5, 27, 147.5, 0.3, 0];
        localStorage.setItem('pokecraft-save-v2', JSON.stringify(s)); sessionStorage.setItem('cube5', '1');
      });
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page); await placeIs(page, 'gravity');
      const S2 = await page.evaluate(() => { const g = window.pokecraft, p = g.player; for (let i = 0; i < 4; i++) p.update(1 / 60); return { pos: p.pos.toArray(), frame: p.frameNo(), ground: p.onGround }; });
      t.ok(S2.frame === 0 && S2.pos[0] === 104.5 && S2.pos[2] === 147.5 && S2.pos[1] === 27 && S2.ground, `a save with an old 5-value spot loads upright, at that spot (frame ${S2.frame})`);
      // the way back
      await harness(page);
      await page.evaluate(() => { const g = window.pokecraft, d = g.world.doors[0], c = d.surface[Math.floor(d.surface.length / 2)]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); });
      await placeIs(page, 'swirl');
      await page.waitForFunction(() => document.getElementById('btn-ride').textContent !== 'Steady', null, { timeout: 60000 });
      const S3 = await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'gravity'), p = g.player, r = document.getElementById('btn-ride'); return { d: Math.hypot(p.pos.x - f.stand[0] - 0.5, p.pos.z - f.stand[2] - 0.5), frame: p.frameNo(), view: p.viewQuat(), slot: r.textContent, steadyCls: r.classList.contains('steady'), btn: document.getElementById('steady-btn').classList.contains('hidden') }; });
      t.ok(S3.slot === 'Ride' && !S3.steadyCls && S3.btn, `back in the Swirl the slot is ${S3.slot} again and the pause screen has no steady button`);
      t.ok(S3.d < 4 && S3.frame === null && S3.view === null, `the way back puts you in front of the Cube Planets frame in the Swirl (${S3.d.toFixed(1)} away), upright again (no frame there)`);
    }
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join(' | ')}`);
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
      const g = window.pokecraft, p = g.player, C = window.__C, b = C.CL.BOXES[2], out = {};
      g.started = true;
      // on the Moon Cube's west side: the stick pushed forward moves you where the camera looks along the face
      C.place(p, C.free(g.world, [[2, 0, -1]], [b.x0, b.y0 + 8.5, b.z0 + 8.5], 3)); C.settle(p); p.yaw = 0.7; p.pitch = 0; p.update(1);
      const fwd = p.forward.clone(), a = p.pos.clone();
      p.joy = { x: 0, y: -1 }; for (let i = 0; i < 20; i++) p.update(1 / 60); p.joy = null;
      const m = p.pos.clone().sub(a);
      out.normal = Math.abs(m.x); out.dot = m.clone().normalize().dot(fwd.clone().normalize()); out.frame = p.frameNo(); out.down = C.G.downOf(p.frame).join();
      // stick right = right on the face
      const a2 = p.pos.clone(); p.joy = { x: 1, y: 0 }; for (let i = 0; i < 20; i++) p.update(1 / 60); p.joy = null;
      const right = new p.pos.constructor().crossVectors(fwd, new p.pos.constructor(0, 1, 0).applyQuaternion(p.viewQuat())).normalize();
      out.right = p.pos.clone().sub(a2).normalize().dot(right);
      // the camera over an edge: the angle between the camera's up and the new up at 0, 0.2 and 0.5 s after the turn
      const t = C.CL.BOXES[0]; C.place(p, [t.x0 + 6.5, t.y1, t.z1 - 1.5]); C.settle(p); C.yawToward(p, [0, 0, 1]); p.update(1);
      const angle = () => { const u = C.G.upOf(p.frame), cu = new p.pos.constructor(0, 1, 0).applyQuaternion(p.viewQuat()); return Math.acos(Math.max(-1, Math.min(1, cu.x * u[0] + cu.y * u[1] + cu.z * u[2]))) * 180 / Math.PI; };
      p.joy = { x: 0, y: -1 }; let f0 = p.frame, i = 0;
      for (; i < 120 && p.frame === f0; i++) p.update(1 / 60);
      out.turned = p.frame !== f0; out.a0 = angle();
      for (let k = 0; k < 12; k++) p.update(1 / 60); out.a02 = angle();
      for (let k = 0; k < 18; k++) p.update(1 / 60); out.a05 = angle();
      p.joy = null;
      // a big turn: from the top of the Meadow Cube straight to its bottom (a puff there), the camera turns for 0.8 s
      C.place(p, [t.x0 + 6.5, t.y1, t.z0 + 6.5]); C.settle(p); p.update(1);
      p.turnView(C.G.frameOf([0, 1, 0])); p.frame = C.G.frameOf([0, 1, 0]);
      out.big = p._vDur;
      return out;
    });
    t.ok(I.down === '1,0,0' && I.dot > 0.98 && I.normal < 1e-9 && I.right > 0.98, `iPad: on the Moon Cube's west side the stick pushed up moves you where you look along the face (${I.dot.toFixed(3)}), right is right (${I.right.toFixed(3)}), never off the face`);
    t.ok(I.turned && I.a0 > 80 && I.a02 > 10 && I.a02 < 80 && I.a05 < 1 && Math.abs(I.big - 0.8) < 1e-9, `iPad: over an edge the camera's up turns slowly: ${I.a0.toFixed(0)}° at the turn, ${I.a02.toFixed(0)}° after 0.2 s, ${I.a05.toFixed(1)}° after 0.5 s; a turn upside down takes 0.8 s`);
    // owner 2026-10-29: here the Ride slot is the steady camera (same place, dim = off, lit = on); a tap and the V key switch it
    await ip.evaluate(() => { const p = window.pokecraft.player, C = window.__C, b = C.CL.BOXES[0]; C.place(p, [b.x0 + 6.5, b.y1, b.z0 + 9.5]); C.settle(p); p.yaw = 2.6; p.pitch = -0.1; });
    await ip.waitForFunction(() => document.getElementById('btn-ride').textContent === 'Steady', null, { timeout: 60000 });
    const box = id => ip.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; }, id);
    const T0 = await ip.evaluate(() => { const r = document.getElementById('btn-ride'); return { dim: r.classList.contains('dim'), hidden: r.classList.contains('hidden'), on: window.pokecraft.steadyCam.on }; });
    const at0 = await box('btn-ride');
    await ip.evaluate(() => window.pokecraft.ui.toastBox.replaceChildren());
    await ip.tap('#btn-ride');
    await ip.waitForFunction(() => !document.getElementById('btn-ride').classList.contains('dim'), null, { timeout: 60000 });
    const T1 = await ip.evaluate(() => ({ on: window.pokecraft.steadyCam.on, steady: document.getElementById('btn-ride').classList.contains('steady'), riding: window.pokecraft.riding.on, toast: document.getElementById('toast').textContent }));
    const at1 = await box('btn-ride');
    await ip.evaluate(() => window.pokecraft.ui.toastBox.replaceChildren());
    await shot(ip, 'cube-ipad-steady.png');
    await ip.keyboard.press('KeyV');
    await ip.waitForFunction(() => document.getElementById('btn-ride').classList.contains('dim'), null, { timeout: 60000 }).catch(() => {});
    const T2 = await ip.evaluate(() => ({ on: window.pokecraft.steadyCam.on, stored: localStorage.getItem('pokecraft-steady') }));
    t.ok(!T0.hidden && T0.dim && !T0.on && T1.on && T1.steady && !T1.riding && /Steady camera on/.test(T1.toast) && at0.join() === at1.join() && !T2.on && T2.stored === 'off',
      `iPad: the Ride slot says Steady here (dim = off), a tap turns the steady camera on (lit, "${T1.toast}", never a ride), it stays in its place (${at0}), and V turns it off again`);
    t.ok(!ip.errors.length, `no page errors on the iPad ${ip.errors.slice(0, 3).join(' | ')}`);
    await ip.context().close();
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
    t.ok(r.cloth && place === 'swirl' && !/Cube Planets/.test(r.guide), `closed: its frame in the Swirl stays under the cloth, stepping to it does not open it (still in the ${place}), the guide never points in`);
    t.ok(!shut.errors.length, `no page errors when closed ${shut.errors.slice(0, 3).join(' | ')}`);
    await shut.context().close();
  }
}

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
    if (ride) { const s = g.player.pos.clone(); p.pos.set(s.x, s.y, s.z + 3); rode = g.riding.start(); p.pos.copy(s); } // (a step away from the frame's keep)
    return { cell: f.cloth[Math.floor(f.cloth.length / 2)], rode };
  }, ride);
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(page, 'gravity');
  return rode;
}
