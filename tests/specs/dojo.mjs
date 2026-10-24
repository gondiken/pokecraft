// T37b: the Shadow Dojo (gym 32, slot 8): the building inside its slot box and protected; the sneak.js pieces (watcher paths
// in closed form, light cones, hiding spots, squeaky boards, lanterns); spotted -> back to the last lantern; a sneak attack
// from behind makes your creature move first; the leader after both trainers and the badge; an iPad; screenshots
// (tests/screenshots/t37-dojo-*.png). The live part is driven with synchronous L.update(dt) calls inside page.evaluate; between
// them L.playing() is false, so the game's own frames never spot the player.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { openGame, newGame, playBattle, waitFor, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const ONLY = process.env.DOJO_ONLY || ''; // 'shots' = only the screenshots (to work on the look)

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await page.evaluate(() => {
    const g = window.pokecraft;
    g.weather.set('clear');
    g.time = 0.25;
    g.creatures.clear();
    g.creatures.spawnTimer = 1e9; // the test decides what spawns
    window.__toasts = [];
    const toast = g.ui.toast.bind(g.ui);
    g.ui.toast = (m, ...r) => { window.__toasts.push(m); return toast(m, ...r); };
    g.gymLive.of('ninja').playing = () => false;
  });

  // Screenshots (the look): dusk, from above, the gate, the garden with a watcher's light, the hall, the courtyard, the pagoda, the deck.
  const shots = async () => {
    const at = await page.evaluate(() => {
      const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'ninja');
      const P = (d, s, y) => [gym.x + 0.5 + gym.front[0] * d + gym.side[0] * s, y, gym.z + 0.5 + gym.front[1] * d + gym.side[1] * s];
      return {
        over: [P(30, 26, gym.fy + 26), P(-4, 0, gym.fy + 2)],
        top: [P(1, 0.01, gym.fy + 60), P(0, 0, gym.fy)],
        gate: [P(21.5, 1.5, gym.fy + 2.6), P(12, -2, gym.fy + 2)],
        garden: [P(18.5, -1, gym.fy + 1), P(11, -2, gym.fy + 0.5)],
        hall: [P(6.5, -9, gym.fy + 1), P(2, 4, gym.fy + 1.2)],
        court: [P(-3, 9, gym.fy + 1), P(-12, 0, gym.fy + 5)],
        pagoda: [P(-5, 14, gym.fy + 9), P(-13, 0, gym.fy + 8)],
        deck: [P(-12, -2, gym.fy + 13), P(10, 0, gym.fy + 4)],
        roof: [P(3, 18, gym.fy + 5), P(3, 6, gym.fy + 6)],
      };
    });
    const cam = async (name, [eye, look], { time = 0.47, wait = 3500, clock = 3 } = {}) => {
      await page.evaluate(([eye, look, time, clock]) => {
        const g = window.pokecraft, L = g.gymLive.of('ninja');
        g.time = time; g.weather.set('clear'); g.creatures.clear();
        L.playing = () => false; // nobody gets spotted while we take pictures
        if (!L.__u) { L.__u = L.update.bind(L); L.update = () => L.__u(0); }
        for (const w of L.watchers) { w.noise = null; w.clock = clock; w.set(w.at(clock)); }
        L.coneT = 0;
        g.player.pos.set(...eye); g.player.vel.set(0, 0, 0); g.player.keys = {};
        g.player.lookAt({ x: look[0], y: look[1], z: look[2] });
        L.__u(0);
      }, [eye, look, time, clock]);
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 });
      console.log(`  screenshot ${path.join(SHOTS, name)}`);
    };
    await cam('t37-dojo-overview.png', at.over);
    await cam('t37-dojo-top.png', at.top, { time: 0.25 });
    await cam('t37-dojo-gate.png', at.gate);
    await cam('t37-dojo-garden.png', at.garden, { clock: 2 });
    await cam('t37-dojo-hall.png', at.hall, { clock: 8 });
    await cam('t37-dojo-courtyard.png', at.court, { clock: 1 });
    await cam('t37-dojo-pagoda.png', at.pagoda);
    await cam('t37-dojo-roof.png', at.roof);
    await cam('t37-dojo-deck.png', at.deck);
    await page.evaluate(() => { const L = window.pokecraft.gymLive.of('ninja'); L.update = L.__u; delete L.__u; });
  };
  if (ONLY === 'shots') { await shots(); t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`); await page.context().close(); return; }

  /* ------------------------------------------------ A. The building, for three seeds */
  const A = await page.evaluate(async seeds => {
    const { World, WORLD_H } = await import('/src/world.js');
    const { GYMS } = await import('/src/gyms.js');
    const { B, BLOCKS, PLACEABLE, isSolid } = await import('/src/blocks.js');
    const out = {};
    for (const seed of seeds) {
      const r = {};
      const w = new World(seed, null, null); w.generate();
      const def = GYMS.find(x => x.id === 'ninja');
      const g = w.gyms.find(x => x.def === def);
      r.found = !!g; r.k = g?.slot?.k; r.last = GYMS[GYMS.length - 1] === def && GYMS.length === 32;
      const box = g.slot.box;
      const inBox = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
      r.protect = g.protect.length > 0 && g.protect.every(b => b.x0 >= box.x0 && b.x1 <= box.x1 && b.z0 >= box.z0 && b.z1 <= box.z1);
      r.area = g.area.x0 >= box.x0 && g.area.x1 <= box.x1 && g.area.z0 >= box.z0 && g.area.z1 <= box.z1;
      const i = GYMS.indexOf(def);
      GYMS.splice(i, 1);
      let w0;
      try { w0 = new World(seed, null, null); w0.generate(); } finally { GYMS.splice(i, 0, def); }
      // outside the box only the treasure pass may differ, right next to the box (it looks at a stone's neighbours: World.placeTreasure)
      let inside = 0, outside = 0, ore = 0;
      const next = (x, z) => x >= box.x0 - 1 && x <= box.x1 + 1 && z >= box.z0 - 1 && z <= box.z1 + 1;
      const isOre = id => id >= 65 && id <= 67;
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < w.D; z++) for (let x = 0; x < w.W; x++) {
        const k = x + w.W * (z + w.D * y);
        if (w.data[k] === w0.data[k]) continue;
        if (inBox(x, z)) inside++;
        else if (next(x, z) && (isOre(w.data[k]) || isOre(w0.data[k]))) ore++;
        else outside++;
      }
      r.inside = inside; r.outside = outside; r.ore = ore;
      const { fy, front, side } = g;
      const col = (d, s) => [g.x + front[0] * d + side[0] * s, g.z + front[1] * d + side[1] * s];
      const solid = (x, y, z) => w.isSolid(x, y, z);
      // blocks: every Shadow Dojo block is there (the lit ones only with setLive), none is placeable, all have wallText
      const count = {};
      for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) for (let y = 1; y < WORLD_H; y++) { const id = w.get(x, y, z); if (id >= 113 && id <= 123) count[id] = (count[id] || 0) + 1; }
      r.count = count;
      r.blockDefs = [114, 115, 116, 117, 118, 119, 120, 121, 122, 123].every(id => BLOCKS[id]?.wallText && !PLACEABLE.includes(id));
      r.litNone = !count[B.STONE_LANTERN_ON] && !count[B.LANTERN_LIGHT];
      r.lanterns = g.checkpoints.map(c => w.get(...c.cell));
      r.stands = g.checkpoints.every(c => { const [x, y, z] = c.stand.map(Math.floor); return !solid(x, y, z) && !solid(x, y + 1, z) && solid(x, y - 1, z); });
      // hiding spots: open cells, two high, walled on every side but one
      r.hideouts = g.hideouts.length;
      r.kinds = [...new Set(g.hideouts.map(h => h.kind))].sort().join();
      r.hideBad = g.hideouts.filter(h => {
        const b = h.box;
        for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) for (let y = b.y0; y <= b.y1; y++) if (solid(x, y, z)) return true;
        let open = 0, walls = 0;
        for (let x = b.x0 - 1; x <= b.x1 + 1; x++) for (let z = b.z0 - 1; z <= b.z1 + 1; z++) {
          if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) continue;
          if (solid(x, fy + 1, z) && solid(x, fy + 2, z)) walls++; else open++;
        }
        return open !== 2 || walls < 8;
      }).map(h => h.id);
      // floors: nightingale boards squeak, tatami is quiet
      r.squeak = g.floors.count('squeak'); r.quiet = g.floors.count('quiet');
      r.floorsMatch = [...g.floors.cells].every(([k, kind]) => { const [x, y, z] = k.split(',').map(Number); return w.get(x, y, z) === (kind === 'squeak' ? B.NIGHTINGALE : B.TATAMI); });
      // watcher paths: every point on every leg is open at feet and head height, inside the garden
      const gd = g.garden;
      r.pathBad = [];
      for (const wd of g.watchers) {
        const pts = wd.path;
        for (let k = 0; k < pts.length; k++) {
          const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % pts.length];
          for (let u = 0; u <= 1.0001; u += 0.05) {
            const x = ax + (bx - ax) * u, z = az + (bz - az) * u;
            for (const [ox, oz] of [[-0.25, -0.25], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25]]) {
              const cx = Math.floor(x + ox), cz = Math.floor(z + oz);
              if (solid(cx, fy + 1, cz) || solid(cx, fy + 2, cz) || cx < gd.x0 || cx > gd.x1 || cz < gd.z0 || cz > gd.z1) { r.pathBad.push(`${wd.id}@${cx},${cz}`); break; }
            }
          }
        }
      }
      r.watchers = g.watchers.length;
      r.trainers = g.trainerPositions.length === 2 && g.watchers.filter(x => x.trainer != null).length === 2;
      // edits and riders refused
      const [mx, mz] = col(10, 0);
      r.edit = !w.editAllowed(mx, fy, mz, B.AIR) && !w.editAllowed(mx, fy + 1, mz, B.STONE) && w.fenced(mx, fy + 1, mz);
      // ways up: a walk over standable cells (step up 1 with head room, step or fall down), from the gate to the leader
      const stand = (x, y, z) => !solid(x, y, z) && !solid(x, y + 1, z) && solid(x, y - 1, z);
      const key = (x, y, z) => `${x},${y},${z}`;
      const moves = (x, y, z, banned) => {
        const res = [];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (!inBox(nx, nz)) continue;
          if (stand(nx, y + 1, nz) && !solid(x, y + 2, z)) res.push([nx, y + 1, nz]);
          if (!solid(nx, y, nz) && !solid(nx, y + 1, nz)) { let ny = y; while (ny > 1 && !solid(nx, ny - 1, nz)) ny--; if (stand(nx, ny, nz)) res.push([nx, ny, nz]); }
        }
        return res.filter(c => !banned?.(...c));
      };
      const bfs = (start, banned) => {
        const seen = new Set([key(...start)]), q = [start];
        while (q.length) { const c = q.shift(); for (const m of moves(...c, banned)) { const k = key(...m); if (!seen.has(k)) { seen.add(k); q.push(m); } } }
        return seen;
      };
      const entry = g.entry;
      const leader = g.leaderPos.map(Math.floor);
      r.entryStands = stand(...entry);
      const all = bfs(entry);
      r.ground = all.has(key(...leader));
      // the rooftop way: never inside the pagoda (no stairs), still the deck
      const [pdx, pdz] = col(-13, 0);
      const inPagoda = (x, y, z) => Math.max(Math.abs(x - pdx), Math.abs(z - pdz)) <= 2 && y >= fy + 1 && y <= fy + 12;
      r.roof = bfs(entry, inPagoda).has(key(...leader));
      // and the ground way works without the barrel steps onto the wall
      const [wx, wz] = g.route.wallStep;
      r.groundOnly = bfs(entry, (x, y, z) => y > fy + 1 && !inPagoda(x, y, z) && !(Math.max(Math.abs(x - pdx), Math.abs(z - pdz)) <= 3 && y >= fy + 12)).has(key(...leader));
      r.wallStep = w.get(wx, fy + 1, wz) === B.BARREL;
      // nobody gets stuck: from every place you can reach you can walk back to the gate
      const back = new Map();
      for (const k of all) { const c = k.split(',').map(Number); for (const m of moves(...c)) { const mk = key(...m); if (!back.has(mk)) back.set(mk, []); back.get(mk).push(k); } }
      const home = new Set([key(...entry)]), q = [key(...entry)];
      while (q.length) { const k = q.shift(); for (const p of back.get(k) || []) if (!home.has(p)) { home.add(p); q.push(p); } }
      // (only the dojo itself: past the wall the land goes on outside the box, where this walk does not look)
      const local = k => { const [x, , z] = k.split(',').map(Number); return Math.max(Math.abs((x - g.x) * front[0] + (z - g.z) * front[1]), Math.abs((x - g.x) * side[0] + (z - g.z) * side[1])); };
      r.reach = all.size; r.stuck = [...all].filter(k => !home.has(k) && local(k) <= 20).length;
      // the way in: from the land just outside the box, up (or down) the ramp to the torii
      const [fx0, fz0] = col(24, 0);
      let fyy = WORLD_H - 2; while (fyy > 1 && !solid(fx0, fyy - 1, fz0)) fyy--;
      r.ramp = bfs([fx0, fyy, fz0]).has(key(...entry)) && home.has(key(fx0, fyy, fz0));
      r.height = Math.max(...g.protect.map(b => b.y1)) < WORLD_H && fy + 16 < WORLD_H;
      out[seed] = r;
    }
    return out;
  }, [1, 4242, 777]);
  for (const seed of [1, 4242, 777]) {
    const r = A[seed];
    t.ok(r.found && r.k === 8 && r.last && r.protect && r.area, `seed ${seed}: the Shadow Dojo is gym 32 in south slot 8, with its protect box and area inside the slot box`);
    t.ok(r.inside > 3000 && r.outside === 0, `seed ${seed}: it changes ${r.inside} cells inside its slot box and ${r.outside} outside (${r.ore} treasure stones right beside the box)`);
    t.ok(r.blockDefs && r.litNone && r.count[114] > 30 && r.count[115] > 30 && r.count[116] > 20 && r.count[117] > 10 && r.count[118] > 10 && r.count[119] > 5 && r.count[123] > 20 && r.count[113] > 100,
      `seed ${seed}: all the dojo blocks are there, none placeable, the lit lantern and the light only drawn live (${JSON.stringify(r.count)})`);
    t.ok(r.lanterns.length === 3 && r.lanterns.every(id => id === 120) && r.stands, `seed ${seed}: three stone lanterns with standable spots (${r.lanterns})`);
    t.ok(r.hideouts === 11 && r.kinds === 'barrel,grass,screen' && !r.hideBad.length, `seed ${seed}: 11 hiding spots (grass, screens, barrels), each open, two high and walled on all sides but one ${r.hideBad}`);
    t.ok(r.squeak > 40 && r.quiet > 80 && r.floorsMatch, `seed ${seed}: ${r.squeak} squeaky board cells and ${r.quiet} quiet tatami cells, matching their blocks`);
    t.ok(r.watchers === 3 && r.trainers && !r.pathBad.length, `seed ${seed}: 3 watchers (2 trainers, 1 guard) whose paths never go through a block ${r.pathBad.slice(0, 5)}`);
    t.ok(r.edit, `seed ${seed}: the dojo cannot be edited and riders are fenced out`);
    t.ok(r.entryStands && r.ground && r.groundOnly, `seed ${seed}: from the gate the ground way (through the pagoda's stairs) reaches the leader`);
    t.ok(r.roof && r.wallStep, `seed ${seed}: the rooftop way (wall, beams, roofs, barrel steps) reaches the leader without the pagoda's stairs`);
    t.ok(r.stuck === 0 && r.reach > 800, `seed ${seed}: from all ${r.reach} reachable places you can get back to the gate (${r.stuck} stuck)`);
    t.ok(r.ramp, `seed ${seed}: a ramp joins the torii to the land outside, both ways`);
    t.ok(r.height, `seed ${seed}: everything fits under the world top`);
  }

  /* ------------------------------------------------ B. The sneak.js pieces on their own */
  const Bq = await page.evaluate(async () => {
    const S = await import('/src/sneak.js');
    const out = {};
    // closed form: the same place at 60 and 20 frames a second, and at(t) is periodic
    const mk = () => new S.Watcher({ id: 'w', path: [[0.5, 0.5], [10.5, 0.5], [10.5, 6.5]], speed: 1, pause: 2, range: 5.5, angle: 0.6, y: 10 });
    const a = mk(), b = mk();
    for (let i = 0; i < 1200; i++) a.update(1 / 60);
    for (let i = 0; i < 400; i++) b.update(1 / 20);
    const c = a.at(20);
    out.fps = Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.heading - b.heading) < 1e-6 && Math.abs(a.x - c.x) < 1e-9;
    out.period = a.period;
    const p0 = a.at(3.3), p1 = a.at(3.3 + a.period * 5);
    out.periodic = Math.abs(p0.x - p1.x) < 1e-9 && Math.abs(p0.z - p1.z) < 1e-9;
    out.walk = [a.at(0), a.at(5), a.at(10), a.at(12.5)].map(s => [+s.x.toFixed(2), +s.z.toFixed(2), +s.heading.toFixed(2), s.moving]);
    // the cone: in front (in range) yes, behind no, too far no, beside no; a wall in between hides you
    const w = new S.Watcher({ id: 'v', path: [[0.5, 0.5]], range: 5.5, angle: 0.6, y: 10 }); // one point: stands, looks along +z
    out.front = w.sees({ x: 0.5, y: 10, z: 4.5 });
    out.far = w.sees({ x: 0.5, y: 10, z: 7 });
    out.behind = w.sees({ x: 0.5, y: 10, z: -3 });
    out.beside = w.sees({ x: 4, y: 10, z: 0.6 });
    out.roof = w.sees({ x: 0.5, y: 13, z: 3 });
    const wall = (x, y, z) => z === 2 && y >= 10 && y <= 12;
    out.wall = w.sees({ x: 0.5, y: 10, z: 4.5 }, wall);
    out.isBehind = w.behind({ x: 0.5, y: 10, z: -2 }) && !w.behind({ x: 0.5, y: 10, z: 2 });
    const cone = w.cone();
    out.cone = cone.length;
    out.coneMatch = cone.every(([x, z]) => w.sees({ x: x + 0.5, y: 10, z: z + 0.5 })) && cone.some(([x, z]) => x === 0 && z === 4) && !cone.some(([x, z]) => z < 0);
    // a noise turns it and its clock waits; afterwards it walks on from where it was
    const n = mk(); n.update(1);
    const before = n.clock;
    out.heard = n.hearNoise(n.x, n.z - 4) && !n.hearNoise(n.x + 50, n.z);
    for (let i = 0; i < 30; i++) n.update(1 / 30);
    out.turned = Math.abs(Math.atan2(Math.sin(n.heading - Math.PI), Math.cos(n.heading - Math.PI))) < 0.05 && n.clock === before;
    for (let i = 0; i < 90; i++) n.update(1 / 30);
    out.resumed = !n.noise && n.clock > before;
    // hideouts, floors, checkpoints
    const h = new S.Hideout({ id: 'h', box: { x0: 3, x1: 4, y0: 10, y1: 11, z0: 5, z1: 5 } });
    out.hide = h.hides({ x: 3.5, y: 10, z: 5.5 }) && h.hides({ x: 4.9, y: 11, z: 5.1 }) && !h.hides({ x: 5.1, y: 10, z: 5.5 }) && !h.hides({ x: 3.5, y: 12, z: 5.5 });
    const f = new S.FloorMap(); f.add(1, 9, 1, 'squeak'); f.add(2, 9, 1, 'quiet');
    out.floor = f.under({ x: 1.5, y: 10, z: 1.5 }) === 'squeak' && f.under({ x: 2.5, y: 10, z: 1.5 }) === 'quiet' && f.under({ x: 3.5, y: 10, z: 1.5 }) === null && S.FLOORS.squeak.squeak && !S.FLOORS.quiet.squeak;
    let threw = false; try { f.add(0, 0, 0, 'loud'); } catch { threw = true; }
    out.floorThrows = threw;
    const cp = new S.Checkpoint({ id: 'c', cell: [0, 11, 0], stand: [2.5, 10, 0.5] });
    out.cp = cp.passed({ x: 1.5, y: 10, z: 1.5 }) && !cp.passed({ x: 5.5, y: 10, z: 0.5 }) && cp.isSafe({ x: 2.5, y: 10, z: 1.5 }) && !cp.isSafe({ x: 5, y: 10, z: 0.5 });
    const st = new S.Watcher({ id: 's', path: [[0.5, 0.5], [5.5, 0.5]] }); st.stopped = true;
    out.stopped = !st.sees({ x: 2, y: 0, z: 0.5 }) && st.cone().length === 0 && !st.hearNoise(0.5, 0.5);
    return out;
  });
  t.ok(Bq.fps && Bq.periodic, `a watcher's place is a closed form of its clock: the same at 60 and 20 fps, and it loops every ${Bq.period} s`);
  t.ok(JSON.stringify(Bq.walk) === JSON.stringify([[0.5, 0.5, 1.57, true], [5.5, 0.5, 1.57, true], [10.5, 0.5, 1.57, false], [10.5, 1, 0, true]]), `it walks a leg, pauses and turns at the corner, then walks the next leg ${JSON.stringify(Bq.walk)}`);
  t.ok(Bq.front && !Bq.far && !Bq.behind && !Bq.beside && !Bq.roof && !Bq.wall && Bq.isBehind, 'sees(): in front within range yes; too far, behind, beside, on a roof or behind a wall no');
  t.ok(Bq.cone > 10 && Bq.coneMatch, `the light cone is exactly the floor cells sees() is true for (${Bq.cone} cells)`);
  t.ok(Bq.heard && Bq.turned && Bq.resumed, 'a noise nearby turns a watcher to look (its clock waits), a noise far away does not; then it walks on');
  t.ok(Bq.hide && Bq.floor && Bq.floorThrows && Bq.cp && Bq.stopped, 'Hideout.hides, FloorMap kinds (quiet / squeak), Checkpoint passed / safe, and a stopped watcher sees nothing');

  if (ONLY === 'build') { t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`); await page.context().close(); return; }

  /* ------------------------------------------------ C. In the game */
  // A strong team; the gym's people start fresh.
  await page.evaluate(async () => {
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('tidalord', 80), makeCreature('thunderwolf', 80), makeCreature('grovebeast', 80)];
    for (const c of g.party) c.moves = ['tackle'];
    g.beaten = g.beaten.filter(k => !k.startsWith('ninja:'));
    g.badges = g.badges.filter(b => b !== 'ninja');
    g.time = 0.25;
  });
  // C1: watchers walk in closed form, the people follow them, their light is drawn on the floor (and put back).
  const C1 = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, gym = w.gyms.find(x => x.def.id === 'ninja'), L = g.gymLive.of('ninja');
    const { B } = await import('/src/blocks.js');
    const P = (d, s, y = gym.fy + 1) => [gym.x + 0.5 + gym.front[0] * d + gym.side[0] * s, y, gym.z + 0.5 + gym.front[1] * d + gym.side[1] * s];
    const out = {};
    g.player.pos.set(...P(18, 0)); g.player.vel.set(0, 0, 0);
    for (const x of L.watchers) { x.noise = null; x.clock = 0; x.set(x.at(0)); }
    for (let i = 0; i < 90; i++) L.update(1 / 30);
    const su = L.watchers.find(x => x.id === 'suzu');
    const at = su.at(su.clock);
    out.closed = Math.abs(su.x - at.x) < 1e-9 && Math.abs(su.clock - 3) < 1e-6;
    out.npc = L.watchers.every(x => x.npc && x.npc.steer && Math.abs(x.npc.pos.x - x.x) < 1e-9 && Math.abs(x.npc.pos.z - x.z) < 1e-9 && x.npc.model.userData.lantern);
    out.names = L.watchers.map(x => x.npc?.name);
    L.coneT = 0; L.update(0);
    const want = new Set();
    for (const x of L.watchers) for (const [cx, cz] of x.cone(L.solid)) if (L.lightable.has(`${cx},${cz}`)) want.add(`${cx},${cz}`);
    out.lit = L.lit.size; out.want = want.size;
    out.drawn = [...want].every(k => { const [x, z] = k.split(',').map(Number); return w.get(x, gym.fy, z) === B.LANTERN_LIGHT; });
    out.noEdits = [...want].every(k => { const [x, z] = k.split(',').map(Number); return !w.edits.has(w.index(x, gym.fy, z)); });
    // walk away: the light goes and the floor comes back
    const bases = [...L.base.entries()];
    g.player.pos.set(gym.x + 80, 40, gym.z); L.update(0.1);
    out.cleared = L.lit.size === 0 && bases.every(([k, id]) => { const [x, z] = k.split(',').map(Number); return w.get(x, gym.fy, z) === id && id !== B.LANTERN_LIGHT; });
    g.player.pos.set(...P(18, 0)); L.coneT = 0; L.update(0);
    return out;
  });
  t.ok(C1.closed && C1.npc, `the three watchers (${C1.names}) walk their paths in closed form and carry a lantern`);
  t.ok(C1.lit > 20 && C1.lit === C1.want && C1.drawn && C1.noEdits, `their light falls on ${C1.lit} floor cells, drawn live (never an edit)`);
  t.ok(C1.cleared, 'far away the light is taken off and every floor block is back');

  // C2: stone lanterns, spotted -> puff back to the last one, the grace time, hiding, never in a battle or a question box.
  const C2 = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, gym = w.gyms.find(x => x.def.id === 'ninja'), L = g.gymLive.of('ninja'), p = g.player;
    const { B } = await import('/src/blocks.js');
    const P = (d, s, y = gym.fy + 1) => [gym.x + 0.5 + gym.front[0] * d + gym.side[0] * s, y, gym.z + 0.5 + gym.front[1] * d + gym.side[1] * s];
    const out = {};
    window.__toasts = [];
    L.playing = () => true;
    g.toldOnce.delete('dojo:lantern');
    // walking past the lantern at the hall door
    L.grace = 99;
    p.pos.set(...gym.checkpoints[1].stand); p.vel.set(0, 0, 0);
    L.update(0.016);
    out.passed = L.last === 1 && L.passed.has(1) && w.get(...gym.checkpoints[1].cell) === B.STONE_LANTERN_ON && window.__toasts.some(m => m.startsWith('A stone lantern!'));
    // Suzu looks one way and stays (a noise far in front of her); stand 4 blocks in front of her
    const su = L.watchers.find(x => x.id === 'suzu');
    const look = (x, dx, dz) => { x.heading = Math.atan2(dx, dz); x.noise = { x: x.x + dx * 30, z: x.z + dz * 30, left: 1e9 }; };
    const fwd = x => [Math.sin(x.heading), Math.cos(x.heading)];
    su.clock = 6; su.set(su.at(6)); look(su, gym.side[0], gym.side[1]);
    const [fx, fz] = fwd(su);
    const inFront = k => [su.x + fx * k, gym.fy + 1, su.z + fz * k];
    L.grace = 0;
    p.pos.set(...inFront(4)); p.vel.set(0, 0, 0);
    out.seenBefore = su.sees(p.pos, L.solid);
    L.update(0.016);
    const s = gym.checkpoints[1].stand;
    out.back = Math.abs(p.pos.x - s[0]) < 1e-6 && Math.abs(p.pos.z - s[2]) < 1e-6 && L.spots === 1 && !g.inBattle;
    out.toast = window.__toasts.find(m => m.includes('Poof!'));
    out.puffs = L.puffs.length;
    out.grace = L.grace;
    // right after the puff: not again (grace time)
    p.pos.set(...inFront(4)); L.update(0.5);
    out.graceOk = L.spots === 1;
    // in a battle or with a question box open: never
    L.grace = 0; g.inBattle = true; L.update(0.016); out.battleOk = L.spots === 1; g.inBattle = false;
    L.grace = 0; g.ui.ask({ text: 'Test?', yes: 'Yes', no: 'No' }); L.update(0.016); out.askOk = L.spots === 1; g.ui.closeAsk();
    // hiding: a grass nook in her light
    let spot = null;
    for (const h of gym.hideouts.filter(x => x.kind === 'grass')) {
      const c = [(h.box.x0 + h.box.x1 + 1) / 2, gym.fy + 1, (h.box.z0 + h.box.z1 + 1) / 2];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 2; k <= 4 && !spot; k++) {
        const sx = c[0] + dx * k, sz = c[2] + dz * k;
        su.x = sx; su.z = sz; look(su, -dx, -dz);
        if (su.sees({ x: c[0], y: c[1], z: c[2] }, L.solid)) spot = { h: h.id, c, at: [sx, sz], dir: [-dx, -dz] };
      }
      if (spot) break;
    }
    out.nook = !!spot;
    if (spot) {
      p.pos.set(...spot.c);
      L.grace = 0;
      out.inLight = su.sees(p.pos, L.solid);
      out.hidden = L.hidden(p.pos) && !L.seenBy(p.pos);
      L.update(0.016);
      out.hideOk = L.spots === 1;
      // one step out of the nook (towards her) and she sees you
      p.pos.set(spot.c[0] - spot.dir[0] * 1, spot.c[1], spot.c[2] - spot.dir[1] * 1);
      out.outSeen = !L.hidden(p.pos) && !!L.seenBy(p.pos);
    }
    // leaving the dojo: the lanterns start over
    L.grace = 99;
    p.pos.set(gym.x + 60, 40, gym.z); L.update(0.016);
    out.left = L.last === 0 && L.passed.size === 0 && w.get(...gym.checkpoints[1].cell) === B.STONE_LANTERN;
    su.noise = null;
    L.playing = () => false;
    return out;
  });
  t.ok(C2.passed, 'walking past a stone lantern lights it and says what it is for (once)');
  t.ok(C2.seenBefore && C2.back && C2.toast && C2.puffs >= 1, `caught in Suzu's light: "${C2.toast}" and a puff of smoke puts you back at the last lantern`);
  t.ok(C2.grace > 2 && C2.graceOk, 'right after the puff nobody can spot you for a moment');
  t.ok(C2.battleOk && C2.askOk, 'nobody spots you during a battle or while a question box is open');
  t.ok(C2.nook && C2.inLight && C2.hidden && C2.hideOk && C2.outSeen, 'in a grass nook in her light you are hidden; one step out and she sees you');
  t.ok(C2.left, 'leaving the dojo resets the lanterns');

  // C3: squeaky boards, with the real player physics: running on them squeaks and turns Ren; walking or tatami does not.
  const C3 = await page.evaluate(async () => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'ninja'), L = g.gymLive.of('ninja'), p = g.player;
    const P = (d, s, y = gym.fy + 1) => [gym.x + 0.5 + gym.front[0] * d + gym.side[0] * s, y, gym.z + 0.5 + gym.front[1] * d + gym.side[1] * s];
    const ren = L.watchers.find(x => x.id === 'ren');
    const yawTo = (dd, ds) => { const dx = gym.front[0] * dd + gym.side[0] * ds, dz = gym.front[1] * dd + gym.side[1] * ds; return Math.atan2(-dx, -dz); };
    g.toldOnce.delete('dojo:squeak');
    window.__toasts = [];
    const run = (from, sprint, frames = 24) => {
      for (const x of L.watchers) x.noise = null;
      ren.clock = 0; ren.set(ren.at(0)); // at the corner (6.5, -10.5), about to walk along +s
      ren.clock = 8; ren.set(ren.at(8)); // 8 s later: walking along +s, s about -4.3
      const h0 = ren.heading, sq0 = L.squeaks;
      p.pos.set(...from); p.vel.set(0, 0, 0); p.yaw = yawTo(0, 1); p.pitch = 0; p.onGround = true; p.ride = null;
      p.keys = { KeyW: true, ShiftLeft: sprint };
      for (let i = 0; i < frames; i++) { p.update(1 / 60); L.update(1 / 60); }
      p.keys = {};
      const toP = Math.atan2(p.pos.x - ren.x, p.pos.z - ren.z);
      return { squeaks: L.squeaks - sq0, heard: !!ren.noise, turned: Math.abs(Math.atan2(Math.sin(ren.heading - toP), Math.cos(ren.heading - toP))) < 0.35, kept: Math.abs(ren.heading - h0) < 1e-9, speed: +Math.hypot(p.vel.x, p.vel.z).toFixed(2), under: L.floors.under(p.pos) };
    };
    L.grace = 99; // squeaks only: nobody spots you here
    const out = {};
    out.walk = run(P(7, -10), false);
    out.tatami = run(P(1, -9), true);
    out.sprint = run(P(7, -10), true);
    out.toast = window.__toasts.some(m => m.startsWith('Squeak!'));
    out.played = g.sound.played?.includes?.('squeak') ?? true;
    for (const x of L.watchers) x.noise = null;
    return out;
  });
  t.ok(C3.walk.squeaks === 0 && !C3.walk.heard && C3.walk.kept && C3.walk.under === 'squeak', `walking on the nightingale boards is quiet: Ren keeps walking (${JSON.stringify(C3.walk)})`);
  t.ok(C3.tatami.squeaks === 0 && !C3.tatami.heard && C3.tatami.under === 'quiet', `running on tatami is quiet too (${JSON.stringify(C3.tatami)})`);
  t.ok(C3.sprint.squeaks >= 1 && C3.sprint.heard && C3.sprint.turned && C3.toast, `running on the boards squeaks and Ren turns to look (${JSON.stringify(C3.sprint)})`);

  // C4: a sneak attack from behind (Suzu): "Surprise attack!" and your creature moves first, though it is slower.
  const battleTurn = async () => {
    await waitFor(page, () => window.pokecraft.inBattle && document.querySelectorAll('#b-actions button:not([disabled])').length > 0, null, 180000);
    const info = await page.evaluate(() => { const b = window.pokecraft.battle; return { surprise: b.surprise, ally: b.speedOf(b.ally), foe: b.speedOf(b.foe), round: b.round }; });
    await page.evaluate(() => { const bs = [...document.querySelectorAll('#b-actions button:not([disabled])')]; (bs.find(b => b.textContent.includes('Bump')) || bs[0]).click(); });
    await waitFor(page, () => window.pokecraft.battle.order, null, 180000);
    info.order = await page.evaluate(() => window.pokecraft.battle.order);
    info.log = await page.evaluate(() => window.pokecraft.battle.history.slice(-12));
    await page.evaluate(() => { const b = window.pokecraft.battle; for (const f of b.foes) f.hp = Math.min(f.hp, 1); });
    info.done = await playBattle(page);
    return info;
  };
  const C4 = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'ninja'), L = g.gymLive.of('ninja'), p = g.player;
    const su = L.watchers.find(x => x.id === 'suzu');
    su.clock = 6; su.set(su.at(6));
    su.heading = Math.atan2(gym.side[0], gym.side[1]);
    su.noise = { x: su.x + gym.side[0] * 30, z: su.z + gym.side[1] * 30, left: 1e9 };
    L.update(0.016);
    p.pos.set(su.x - gym.side[0] * 2.2, gym.fy + 1, su.z - gym.side[1] * 2.2); p.vel.set(0, 0, 0);
    p.lookAt({ x: su.x, y: gym.fy + 2.2, z: su.z });
    const b = g.battle;
    b.speedOf = c => (c === b.ally ? 1 : 999); // your creature is much slower: only a surprise lets it go first
    const out = { prompt: L.talkPrompt(su.npc), sneaky: L.sneaky(su) };
    window.__toasts = [];
    g.talkTo(su.npc);
    out.inBattle = g.inBattle;
    return out;
  });
  t.ok(C4.sneaky && C4.prompt?.action === 'Sneak attack!' && C4.inBattle, `right behind Suzu the button says "${C4.prompt?.action}" and tapping her starts a battle`);
  const sneakB = await battleTurn();
  t.ok(sneakB.surprise && sneakB.ally < sneakB.foe && sneakB.order?.[0] === 'ally' && sneakB.log.some(m => m.startsWith('Surprise attack!')), `a sneak attack: "Surprise attack!" and your slower creature moves first in round 1 (${sneakB.order}, speed ${sneakB.ally} vs ${sneakB.foe})`);
  t.ok(sneakB.done && await page.evaluate(() => window.pokecraft.beaten.includes('ninja:trainer')), 'Suzu is beaten');
  const C4b = await page.evaluate(() => {
    const g = window.pokecraft, L = g.gymLive.of('ninja');
    L.update(0.1);
    const su = L.watchers.find(x => x.id === 'suzu');
    return { stopped: su.stopped, cone: su.cone(L.solid).length, steer: su.npc.steer, grace: L.grace > 0 };
  });
  t.ok(C4b.stopped && C4b.cone === 0 && !C4b.steer && C4b.grace, 'a beaten watcher stops watching: she stands still and has no light');

  // C5: talking to Ren from the front is a normal battle (he moves first, as the faster one).
  const C5 = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'ninja'), L = g.gymLive.of('ninja'), p = g.player;
    const ren = L.watchers.find(x => x.id === 'ren');
    ren.clock = 8; ren.set(ren.at(8));
    ren.noise = { x: ren.x + gym.side[0] * 30, z: ren.z + gym.side[1] * 30, left: 1e9 };
    L.update(0.016);
    p.pos.set(ren.x + gym.side[0] * 2.2, gym.fy + 1, ren.z + gym.side[1] * 2.2); p.vel.set(0, 0, 0);
    p.lookAt({ x: ren.x, y: gym.fy + 2.2, z: ren.z });
    const out = { sneaky: L.sneaky(ren), prompt: L.talkPrompt(ren.npc) };
    g.talkTo(ren.npc);
    out.inBattle = g.inBattle;
    return out;
  });
  t.ok(!C5.sneaky && C5.prompt === null && C5.inBattle, 'in front of Ren there is no sneak attack: a normal "Challenge!" battle');
  const normalB = await battleTurn();
  t.ok(!normalB.surprise && normalB.order?.[0] === 'foe' && !normalB.log.some(m => m.startsWith('Surprise attack!')), `a normal battle: the faster foe moves first (${normalB.order})`);
  t.ok(normalB.done && await page.evaluate(() => window.pokecraft.beaten.includes('ninja:trainer2')), 'Ren is beaten');
  await page.evaluate(() => { delete window.pokecraft.battle.speedOf; });

  // C6: a trainer who spots you close by battles you (no puff); the guard Hoshi only jumps when you sneak up on him.
  const C6 = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'ninja'), L = g.gymLive.of('ninja'), p = g.player;
    const out = {};
    const ho = L.watchers.find(x => x.id === 'hoshi');
    ho.clock = 2; ho.set(ho.at(2));
    ho.noise = { x: ho.x + gym.side[0] * 30, z: ho.z + gym.side[1] * 30, left: 1e9 };
    L.update(0.016);
    p.pos.set(ho.x - gym.side[0] * 2, gym.fy + 1, ho.z - gym.side[1] * 2);
    window.__toasts = [];
    out.prompt = L.talkPrompt(ho.npc)?.action;
    g.talkTo(ho.npc);
    out.boo = window.__toasts.find(m => m.includes('sneaked up'));
    p.pos.set(ho.x + gym.side[0] * 2, gym.fy + 1, ho.z + gym.side[1] * 2);
    g.talkTo(ho.npc);
    out.line = window.__toasts.find(m => m.includes('keep watch'));
    out.noBattle = !g.inBattle;
    // a guard who sees you close by: a puff, not a battle
    L.playing = () => true; L.grace = 0; L.last = 0;
    L.update(0.016);
    out.guardPuff = !g.inBattle && L.spots === 2;
    // Suzu again (her beaten key taken away for this check): close in front of her = a normal battle
    g.beaten = g.beaten.filter(k => k !== 'ninja:trainer');
    const su = L.watchers.find(x => x.id === 'suzu'); su.stopped = false;
    su.clock = 6; su.set(su.at(6)); su.heading = Math.atan2(gym.side[0], gym.side[1]); su.noise = { x: su.x + gym.side[0] * 30, z: su.z + gym.side[1] * 30, left: 1e9 };
    L.update(0.016);
    p.pos.set(su.x + gym.side[0] * 2.5, gym.fy + 1, su.z + gym.side[1] * 2.5); L.grace = 0;
    L.update(0.016);
    out.spottedBattle = g.inBattle && !g.battle.surprise && window.__toasts.some(m => m === 'Spotted! Watcher Suzu wants to battle!');
    L.playing = () => false;
    for (const x of L.watchers) x.noise = null;
    return out;
  });
  t.ok(C6.prompt === 'Boo!' && C6.boo && C6.line && C6.noBattle, `Night Guard Hoshi: sneak up on him for "${C6.boo}"; from the front he says his line; he never battles`);
  t.ok(C6.guardPuff, 'when the guard sees you, a puff takes you back');
  t.ok(C6.spottedBattle, 'a trainer who spots you close by battles you normally ("Spotted! ... wants to battle!")');
  await waitFor(page, () => window.pokecraft.battle.foes?.length, null, 60000).catch(() => {});
  await page.evaluate(() => { const b = window.pokecraft.battle; for (const f of b.foes || []) f.hp = Math.min(f.hp, 1); });
  t.ok(await playBattle(page), 'that battle finishes');

  // C7: the leader waits for both trainers, then battles; the badge.
  await page.evaluate(() => {
    const g = window.pokecraft;
    g.beaten = g.beaten.filter(k => !k.startsWith('ninja:'));
    window.__toasts = [];
    g.talkTo(g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'ninja'));
  });
  t.ok(await page.evaluate(() => !window.pokecraft.inBattle && window.__toasts.some(m => m.includes('Beat Watcher Suzu and Watcher Ren first'))), 'Leader Kage refuses until both watchers are beaten');
  await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'ninja');
    g.beaten.push('ninja:trainer', 'ninja:trainer2');
    g.player.pos.set(gym.leaderPos[0] + gym.front[0] * -2, gym.leaderPos[1], gym.leaderPos[2] + gym.front[1] * -2);
    g.talkTo(g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'ninja'));
  });
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'after both, Leader Kage battles you on the pagoda roof');
  await page.evaluate(() => { const b = window.pokecraft.battle; for (const f of b.foes) f.hp = Math.min(f.hp, 1); });
  t.ok(await playBattle(page), 'beat Leader Kage');
  await page.waitForTimeout(500);
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('ninja') && window.__toasts.some(m => m.includes('Shuriken Badge'))), 'the Shuriken Badge is awarded');
  // the guide
  const guide = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'ninja'), a = g.access.of(gym);
    const far = a.aim({ x: gym.x + 80, y: 30, z: gym.z }), inside = a.aim({ x: gym.x + 0.5, y: gym.fy + 1, z: gym.z + 0.5 });
    return { where: a.where, tips: a.tips, far: far.text('→', 80), gate: [far.x, far.z].join() === [gym.entry[0] + 0.5, gym.entry[2] + 0.5].join(), inside: inside.text('→', 3), welcome: a.welcome() };
  });
  t.ok(guide.where === 'dojo' && guide.tips === null && guide.gate && guide.far.startsWith('Next: Shadow Dojo') && guide.inside.includes('is here') && guide.welcome.startsWith('Welcome to the Shadow Dojo'), `the guide points at the gate (${guide.far} / ${guide.inside})`);

  await shots();

  /* ------------------------------------------------ D. iPad: tap a watcher from behind */
  const ipad = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await ipad.tap('text=New Game', { timeout: 180000 });
  await ipad.tap('.starter >> nth=0', { timeout: 180000 });
  await ipad.waitForTimeout(1500);
  await ipad.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'ninja'), L = g.gymLive.of('ninja'), p = g.player;
    g.time = 0.47; g.weather.set('clear'); g.creatures.clear(); g.creatures.spawnTimer = 1e9;
    L.playing = () => false;
    const su = L.watchers.find(x => x.id === 'suzu');
    su.clock = 6; su.set(su.at(6));
    su.heading = Math.atan2(gym.side[0], gym.side[1]);
    su.noise = { x: su.x + gym.side[0] * 30, z: su.z + gym.side[1] * 30, left: 1e9 };
    p.pos.set(su.x - gym.side[0] * 2.4, gym.fy + 1, su.z - gym.side[1] * 2.4); p.vel.set(0, 0, 0);
    p.lookAt({ x: su.x, y: gym.fy + 2, z: su.z });
  });
  await waitFor(ipad, () => document.getElementById('prompt').textContent.includes('sneak attack'), null, 60000).catch(() => {});
  const iinfo = await ipad.evaluate(() => {
    const g = window.pokecraft, L = g.gymLive.of('ninja'), su = L.watchers.find(x => x.id === 'suzu');
    const v = new (g.player.eyePos.constructor)(su.x, su.y + 1.1, su.z).project(g.camera);
    return { touch: document.body.classList.contains('touch'), prompt: document.getElementById('prompt').textContent, action: document.getElementById('btn-act')?.textContent ?? null, spot: [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight] };
  });
  await ipad.screenshot({ path: path.join(SHOTS, 't37-dojo-ipad.png'), timeout: 180000 });
  console.log(`  screenshot ${path.join(SHOTS, 't37-dojo-ipad.png')}`);
  await ipad.touchscreen.tap(iinfo.spot[0], iinfo.spot[1]);
  await waitFor(ipad, () => window.pokecraft.inBattle, null, 30000).catch(() => {});
  const ib = await ipad.evaluate(() => ({ inBattle: window.pokecraft.inBattle, surprise: window.pokecraft.battle.surprise }));
  t.ok(iinfo.touch && iinfo.prompt.includes('sneak attack'), `on an iPad the prompt says "${iinfo.prompt}"`);
  t.ok(ib.inBattle && ib.surprise, 'tapping the watcher from behind starts a surprise battle');
  t.ok(!ipad.errors.length, `no page errors on the iPad ${ipad.errors.join('; ')}`);
  await ipad.context().close();

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
