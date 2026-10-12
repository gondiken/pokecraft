// Caves: they exist under the hills, stay clear of gyms/tower/spawn/water, leave the surface alone,
// are dark (but lit by crystals, glowcaps and the lead creature), have their own creatures, and
// hold treasure chests. Screenshots go to tests/screenshots/ (ignored by git).
import fs from 'node:fs';
import path from 'node:path';
import { openGame, newGame, pause, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const SEEDS = [1, 4242, 99, 123456, 777];

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);

  // 1. Caves exist in every world: enough cave air, entrances with a lowered surface, glowing decorations.
  const worlds = await page.evaluate(async seeds => {
    const { World, WORLD_W, WORLD_D, WORLD_H } = await import('/src/world.js');
    const out = [];
    for (const seed of seeds) {
      const t0 = performance.now();
      const w = new World(seed, null, null);
      w.generate();
      const ms = Math.round(performance.now() - t0);
      let air = 0;
      for (let x = 0; x < WORLD_W; x++) for (let z = 0; z < WORLD_D; z++) {
        const g = w.ground[x + z * WORLD_W];
        for (let y = 2; y <= g - 3; y++) if (w.get(x, y, z) === 0) air++;
      }
      const c = w.caves;
      out.push({ seed, ms, air, entrances: c.entrances.length, glow: c.glow, chests: c.chests.length, floors: c.floors.length, opened: c.opened.size });
    }
    return out;
  }, SEEDS);
  for (const w of worlds) {
    t.ok(w.air >= 3000 && w.entrances >= 3 && w.floors >= 100,
      `seed ${w.seed}: ${w.air} cave air blocks, ${w.entrances} entrances, 1 glowing block per ${Math.round(w.air / w.glow)} air, ${w.chests} chests (generate ${w.ms} ms)`);
  }

  // 2. Keep-out: nothing near gyms, the tower, the middle, the start, the shore; heights unchanged.
  const keep = await page.evaluate(async seeds => {
    const { World, WORLD_W, WORLD_D, WORLD_H, WATER_LEVEL } = await import('/src/world.js');
    const out = [];
    for (const seed of seeds) {
      const a = new World(seed, null, null); a.generate({ caves: false });
      const b = new World(seed, null, null); b.generate();
      const near = (x, z, p, r) => Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= r;
      const bad = { gym: 0, tower: 0, middle: 0, water: 0, edge: 0 };
      let changed = 0;
      for (let i = 0; i < a.data.length; i++) {
        if (a.data[i] === b.data[i]) continue;
        changed++;
        const x = i % WORLD_W, z = Math.floor(i / WORLD_W) % WORLD_D;
        if (b.gyms.some(g => near(x, z, g, 14))) bad.gym++;
        if (near(x, z, b.tower, 14)) bad.tower++;
        if (near(x, z, { x: WORLD_W / 2, z: WORLD_D / 2 }, 6)) bad.middle++;
        if (b.ground[x + z * WORLD_W] <= WATER_LEVEL + 2) bad.water++;
        if (x < 3 || z < 3 || x >= WORLD_W - 3 || z >= WORLD_D - 3) bad.edge++;
      }
      // Same towers/gyms; surface heights equal except around entrance holes (trees nearby may differ).
      const holes = new Uint8Array(WORLD_W * WORLD_D);
      for (const col of b.caves.opened) {
        const cx = col % WORLD_W, cz = Math.floor(col / WORLD_W);
        for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) holes[cx + dx + (cz + dz) * WORLD_W] = 1;
      }
      let surfaceDiff = 0, strict = 0;
      for (let x = 0; x < WORLD_W; x++) for (let z = 0; z < WORLD_D; z++) {
        if (a.surface(x, z).y !== b.surface(x, z).y) { strict++; if (!holes[x + z * WORLD_W]) surfaceDiff++; }
      }
      const same = JSON.stringify(a.gyms.map(g => [g.x, g.z])) === JSON.stringify(b.gyms.map(g => [g.x, g.z])) && a.tower.x === b.tower.x && a.tower.z === b.tower.z;
      // Every entrance has a hole where the surface used to be.
      const holeAt = b.caves.entrances.filter(([x, z]) => {
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          const g = b.ground[x + dx + (z + dz) * WORLD_W];
          if (a.get(x + dx, g, z + dz) !== b.get(x + dx, g, z + dz) && b.get(x + dx, g, z + dz) === 0) return true;
        }
        return false;
      }).length;
      out.push({ seed, changed, bad, surfaceDiff, strict, same, opened: b.caves.opened.size, holeAt, entrances: b.caves.entrances.length });
    }
    return out;
  }, SEEDS);
  for (const k of keep) {
    const total = Object.values(k.bad).reduce((a, b) => a + b, 0);
    t.ok(total === 0 && k.surfaceDiff === 0 && k.same && k.opened < 600 && k.holeAt === k.entrances && k.entrances >= 3,
      `seed ${k.seed}: ${k.changed} blocks changed, none near gyms/tower/middle/water/edges; gyms and tower in place; ${k.holeAt} of ${k.entrances} entrances have a hole; surface same outside ${k.opened} hole columns (${k.strict} columns differ near holes)`);
  }

  // The live game: nothing changed around where you start.
  await newGame(page, 0);
  const start = await page.evaluate(async () => {
    const g = window.pokecraft, { World, WORLD_W, WORLD_D } = await import('/src/world.js');
    const a = new World(g.world.seed, null, null); a.generate({ caves: false });
    const s = g.spawnPoint;
    let diff = 0;
    for (let x = Math.floor(s.x) - 6; x <= s.x + 6; x++) for (let z = Math.floor(s.z) - 6; z <= s.z + 6; z++) for (let y = 0; y < 48; y++) if (a.get(x, y, z) !== g.world.get(x, y, z)) diff++;
    return { diff, seed: g.world.seed };
  });
  t.ok(start.diff === 0, `no cave within 6 blocks of the start (seed ${start.seed})`);

  // 3. New blocks.
  const blocks = await page.evaluate(async () => {
    const { B, BLOCKS, PLACEABLE } = await import('/src/blocks.js');
    return { cap: PLACEABLE.includes(B.GLOWCAP), chest: PLACEABLE.includes(B.CHEST) || PLACEABLE.includes(B.CHEST_OPEN), glow: BLOCKS[46].glow === true, ids: [B.GLOWCAP, B.CHEST, B.CHEST_OPEN].join() };
  });
  t.ok(blocks.cap && !blocks.chest && blocks.glow && blocks.ids === '46,47,48', 'Glowcap is placeable and glows; chests are not placeable');

  // 4. Darkness.
  const info = await page.evaluate(() => {
    const g = window.pokecraft, w = g.world, c = w.caves;
    const deep = c.floors[0];
    const gym = w.gyms[0];
    const surf = w.surface(Math.floor(g.spawnPoint.x), Math.floor(g.spawnPoint.z));
    return {
      surface: w.skyAt(Math.floor(g.spawnPoint.x), surf.y + 1, Math.floor(g.spawnPoint.z)),
      gym: w.skyAt(gym.x, gym.y, gym.z),
      deep: w.skyAt(deep[0], deep[1], deep[2]),
      under: w.underground({ x: deep[0] + 0.5, y: deep[1], z: deep[2] + 0.5 }),
      onSurface: w.underground(g.spawnPoint),
    };
  });
  t.ok(info.surface === 1 && info.gym === 1 && info.deep < 0.3 && info.under && !info.onSurface,
    `light: surface ${info.surface}, gym floor ${info.gym}, deep cave ${info.deep.toFixed(2)}`);

  // Pixel test: average brightness of what the camera sees, surface vs cave (lantern off / on).
  const luminance = async () => page.evaluate(async () => {
    const g = window.pokecraft, { caveLight } = await import('/src/caves.js');
    const measure = () => {
      g.camera.position.copy(g.player.eyePos);
      g.camera.rotation.set(g.player.pitch, g.player.yaw, 0);
      g.renderer.render(g.scene, g.camera);
      const c = document.createElement('canvas'); c.width = 64; c.height = 36;
      const x = c.getContext('2d');
      x.drawImage(g.renderer.domElement, 0, 0, 64, 36);
      const d = x.getImageData(0, 0, 64, 36).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 4);
    };
    const saved = caveLight.uLantern.value;
    caveLight.uLantern.value = 0;
    const off = measure();
    caveLight.uLantern.value = 0.75;
    const on = measure();
    caveLight.uLantern.value = saved;
    return { off, on };
  });
  await page.evaluate(() => {
    const g = window.pokecraft;
    g.time = 0.25;
    g.player.keys = {};
    g.player.yaw = 0.5; g.player.pitch = 0.05;
    g.player.vel.set(0, 0, 0);
  });
  await page.waitForTimeout(1500);
  const surfaceLum = await luminance();
  // Into a cave, facing a wall without anything glowing nearby.
  const wall = await page.evaluate(() => {
    const g = window.pokecraft, w = g.world;
    for (const [x, y, z] of w.caves.floors) {
      for (let k = 0; k < 8; k++) {
        const yaw = k * Math.PI / 4, dx = -Math.sin(yaw), dz = -Math.cos(yaw);
        let hitDist = -1;
        for (let d = 1; d <= 4; d++) if (w.isSolid(Math.round(x + dx * d), y + 1, Math.round(z + dz * d))) { hitDist = d; break; }
        if (hitDist < 3) continue;
        // nothing glowing within 7 blocks
        let glowNear = false;
        for (let a = -7; a <= 7 && !glowNear; a++) for (let b = -7; b <= 7 && !glowNear; b++) for (let c = -4; c <= 4; c++) {
          const id = w.get(x + a, y + c, z + b);
          if (id === 40 || id === 43 || id === 46) { glowNear = true; break; }
        }
        if (glowNear) continue;
        g.player.pos.set(x + 0.5, y, z + 0.5); g.player.vel.set(0, 0, 0);
        g.player.yaw = yaw; g.player.pitch = 0;
        return [x, y, z];
      }
    }
    return null;
  });
  t.ok(wall, 'found a dark spot in a cave');
  await page.waitForTimeout(1500);
  const caveLum = await luminance();
  t.ok(caveLum.off < surfaceLum.off * 0.5, `a cave is darker than the surface (${caveLum.off.toFixed(1)} vs ${surfaceLum.off.toFixed(1)})`);
  t.ok(caveLum.on > caveLum.off + 3 && caveLum.on > 4, `the lead creature's light helps (${caveLum.off.toFixed(1)} -> ${caveLum.on.toFixed(1)})`);
  const faces = await page.evaluate(() => {
    const g = window.pokecraft, [x, , z] = g.world.caves.floors[0];
    const meshes = g.world.meshes.get(`${x >> 4},${z >> 4}`);
    let dark = 0, total = 0;
    for (const m of meshes) {
      const c = m.geometry.getAttribute('color');
      if (!m.material.vertexColors || m.material === g.world.materials.glow) continue;
      for (let i = 0; i < c.count; i += 4) { total++; if (c.getX(i) < 0.3 * c.getZ(i)) dark++; }
    }
    return { dark, total };
  });
  t.ok(faces.dark > 50, `cave chunk faces carry dark sky light (${faces.dark} of ${faces.total})`);

  // 5. Frame time: a cave is not much slower than the surface.
  const frames = () => page.evaluate(() => new Promise(resolve => {
    const ts = [];
    const step = now => { ts.push(now); if (ts.length < 16) requestAnimationFrame(step); else resolve((ts[15] - ts[0]) / 15); };
    requestAnimationFrame(step);
  }));
  const caveFrame = await frames();
  await page.evaluate(() => { const g = window.pokecraft, s = g.spawnPoint; g.player.pos.copy(s); g.player.vel.set(0, 0, 0); });
  await page.waitForTimeout(1500);
  const surfFrame = await frames();
  t.ok(caveFrame <= surfFrame * 1.5 + 50, `frame time: cave ${Math.round(caveFrame)} ms, surface ${Math.round(surfFrame)} ms`);

  // Rebuilding the world with caves is not much slower, and a cave chunk builds quickly.
  const build = await page.evaluate(async () => {
    const g = window.pokecraft, { World } = await import('/src/world.js');
    const time = caves => {
      const w = new World(4242, g.scene, g.world.materials);
      const t0 = performance.now(); w.generate({ caves }); w.buildAll(); const ms = performance.now() - t0; w.dispose();
      return ms;
    };
    time(false); time(true);
    const no = Math.min(time(false), time(false)), yes = Math.min(time(true), time(true));
    const w = g.world, [x, , z] = w.caves.floors[0];
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) w.buildChunk(x >> 4, z >> 4);
    return { no: Math.round(no), yes: Math.round(yes), chunk: (performance.now() - t0) / 10 };
  });
  t.ok(build.yes <= build.no * 1.5 + 30, `generate + buildAll: ${build.no} ms without caves, ${build.yes} ms with; a cave chunk takes ${build.chunk.toFixed(1)} ms`);

  // 6. Cave creatures.
  const cave = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, cm = g.creatures, { SPAWNS } = await import('/src/species.js');
    const [x, y, z] = w.caves.floors[5];
    g.player.pos.set(x + 0.5, y, z + 0.5); g.player.vel.set(0, 0, 0);
    cm.clear();
    const spawned = [];
    const prev = cm.onSpawn;
    cm.onSpawn = wd => { spawned.push({ cave: wd.cave, species: wd.data.species, y: wd.pos.y, ground: w.ground[Math.floor(wd.pos.x) + Math.floor(wd.pos.z) * 224] }); };
    for (let i = 0; i < 600; i++) cm.update(0.1, g.player.pos, g.spawnPoint, false);
    cm.onSpawn = prev;
    const allowed = new Set(SPAWNS.cave.map(e => e[0]));
    const mid = cm.list.length;
    for (let i = 0; i < 300; i++) cm.update(0.1, g.player.pos, g.spawnPoint, false);
    return {
      spawned: spawned.length, allCave: spawned.every(s => s.cave === true && allowed.has(s.species) && s.y < s.ground - 2),
      alive: cm.list.length, mid,
      stillUnder: cm.list.every(wd => wd.cave && wd.pos.y < w.ground[Math.floor(wd.pos.x) + Math.floor(wd.pos.z) * 224]),
      species: [...new Set(spawned.map(s => s.species))].join(','),
    };
  });
  t.ok(cave.spawned >= 1 && cave.allCave && cave.alive >= 1 && cave.stillUnder, `cave creatures spawn underground and stay there (${cave.spawned} spawned: ${cave.species})`);
  const surface = await page.evaluate(async () => {
    const g = window.pokecraft, cm = g.creatures, s = g.spawnPoint, y = 42;
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) g.world.set(Math.floor(s.x) + x, y, Math.floor(s.z) + z, 3);
    g.player.pos.set(Math.floor(s.x) + 0.5, y + 1, Math.floor(s.z) + 0.5); g.player.vel.set(0, 0, 0);
    for (let i = 0; i < 400; i++) cm.update(0.1, g.player.pos, g.spawnPoint, false);
    return { cave: cm.list.filter(w => w.cave).length, other: cm.list.filter(w => !w.cave).length };
  });
  t.ok(surface.cave === 0 && surface.other >= 1, `back on the surface the cave creatures leave and surface ones come (${surface.other})`);
  await page.evaluate(() => { const g = window.pokecraft; g.creatures.clear(); g.player.pos.copy(g.spawnPoint); g.player.vel.set(0, 0, 0); });

  // 7. Treasure chest: opens for 3 cubes, becomes an open chest, and stays open after a reload.
  const chest = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world;
    const [cx, cy, cz] = w.caves.chests[0];
    let spot = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (w.get(cx + dx, cy, cz + dz) === 0 && w.isSolid(cx + dx, cy - 1, cz + dz) && w.get(cx + dx, cy + 1, cz + dz) === 0) { spot = [dx, dz]; break; }
    }
    if (!spot) return { error: 'no spot' };
    g.creatures.trySpawnCave = () => {}; // no visitors while testing
    g.creatures.clear();
    g.player.pos.set(cx + spot[0] + 0.5, cy, cz + spot[1] + 0.5); g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: cx + 0.5, y: cy + 0.5, z: cz + 0.5 });
    g.cubesBefore = g.cubes;
    return { chest: [cx, cy, cz], before: g.cubes, id: w.get(cx, cy, cz) };
  });
  t.ok(!chest.error && chest.id === 47, 'a treasure chest is waiting in a cave');
  await page.waitForTimeout(2500);
  const opened = await page.evaluate(() => {
    const g = window.pokecraft, [x, y, z] = g.world.caves.chests[0];
    const hadTarget = g.world.get(x, y, z);
    g.interact();
    const i = g.world.index(x, y, z);
    return { cubes: g.cubes - g.cubesBefore, id: g.world.get(x, y, z), edit: g.world.edits.get(i), hadTarget };
  });
  t.ok(opened.cubes === 3 && opened.id === 48 && opened.edit === 48, `opening the chest gives 3 cubes (${opened.cubes}) and it stays open as a saved block`);
  await pause(page);
  await page.reload();
  await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  await page.click('#title-buttons button:has-text("Continue")');
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const g = window.pokecraft;
    const [x, y, z] = g.world.caves.chests[0];
    return { id: g.world.get(x, y, z), cubes: g.cubes };
  });
  t.ok(after.id === 48, 'the chest is still open after saving and reloading');

  // 8. Screenshots.
  await page.evaluate(() => { const g = window.pokecraft; g.creatures.trySpawnCave = () => {}; g.creatures.clear(); g.time = 0.25; });
  const shoot = async name => {
    await page.waitForTimeout(800);
    const file = path.join(SHOTS, name);
    await page.screenshot({ path: file, timeout: 180000 });
    console.log(`  screenshot ${file}`);
  };
  const lanternReady = (min) => page.waitForFunction(async m => (await import('/src/caves.js')).caveLight.uLantern.value >= m, min, { timeout: 90000 });

  // Entrance from outside, at noon.
  const ent = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, { raycastVoxel } = await import('/src/world.js');
    const THREE_V = g.player.pos.constructor;
    for (const [ex, ez] of w.caves.entrances) {
      let best = null;
      for (let a = 0; a < 16; a++) {
        const ang = a * Math.PI / 8;
        for (const r of [8, 7, 9, 6]) {
          const x = Math.floor(ex + 0.5 + Math.cos(ang) * r), z = Math.floor(ez + 0.5 + Math.sin(ang) * r);
          const s = w.surface(x, z);
          if ([0, 5, 6, 7, 15, 17, 18, 19, 40].includes(s.id)) continue; // not water, trees or plants
          const eye = new THREE_V(x + 0.5, s.y + 1 + 1.62, z + 0.5);
          const tgt = new THREE_V(ex + 0.5, w.surface(ex, ez).y + 0.5, ez + 0.5);
          const dir = tgt.clone().sub(eye); const dist = dir.length(); dir.normalize();
          const hit = raycastVoxel(w, eye, dir, dist - 1.5);
          if (!hit && (!best || s.y < best.y)) best = { x, z, y: s.y, tgt: [tgt.x, tgt.y, tgt.z] };
        }
      }
      if (best) {
        g.player.pos.set(best.x + 0.5, best.y + 1, best.z + 0.5); g.player.vel.set(0, 0, 0);
        g.player.lookAt({ x: best.tgt[0], y: best.tgt[1], z: best.tgt[2] });
        return { at: [best.x, best.y, best.z], entrance: [ex, ez] };
      }
    }
    return null;
  });
  t.ok(ent, `found a view of a cave entrance ${ent ? JSON.stringify(ent.entrance) : ''}`);
  await shoot('cave-entrance.png');

  // Inside, lit by crystals and glowcaps (at night, so only their light counts).
  const cry = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, { raycastVoxel } = await import('/src/world.js');
    const V = g.player.pos.constructor;
    for (const [cx, cy, cz] of w.caves.crystals) {
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = -3; dy <= 0; dy++) {
        const x = cx + dx, y = cy + dy, z = cz + dz;
        const d = Math.hypot(dx, dz);
        if (d < 2.5 || d > 4.2) continue;
        if (w.get(x, y, z) !== 0 || w.get(x, y + 1, z) !== 0 || w.get(x, y + 2, z) !== 0 || !w.isSolid(x, y - 1, z)) continue;
        if (w.ground[x + z * 224] - y < 6) continue;
        const eye = new V(x + 0.5, y + 1.62, z + 0.5), tgt = new V(cx + 0.5, cy + 0.5, cz + 0.5);
        const dir = tgt.clone().sub(eye); const dist = dir.length(); dir.normalize();
        if (raycastVoxel(w, eye, dir, dist - 1)) continue;
        g.player.pos.set(x + 0.5, y, z + 0.5); g.player.vel.set(0, 0, 0);
        g.player.lookAt({ x: cx + 0.5, y: cy + 0.5, z: cz + 0.5 });
        g.time = 0.75;
        return [cx, cy, cz];
      }
    }
    return null;
  });
  t.ok(cry, 'found a view of a star crystal in a cave');
  await lanternReady(0.7);
  await shoot('cave-crystals.png');

  // A cave creature, three blocks ahead.
  const cr = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, cm = g.creatures, { raycastVoxel } = await import('/src/world.js');
    const { Wild } = await import('/src/creatures.js');
    const { buildModel, makeCreature } = await import('/src/species.js');
    const V = g.player.pos.constructor;
    g.time = 0.25;
    for (const [x, y, z] of w.caves.floors) {
      for (let k = 0; k < 8; k++) {
        const yaw = k * Math.PI / 4, ax = Math.round(x - Math.sin(yaw) * 3), az = Math.round(z - Math.cos(yaw) * 3);
        if (w.get(ax, y, az) !== 0 || w.get(ax, y + 1, az) !== 0 || !w.isSolid(ax, y - 1, az) || w.get(ax, y + 2, az) !== 0) continue;
        const eye = new V(x + 0.5, y + 1.62, z + 0.5), tgt = new V(ax + 0.5, y + 0.6, az + 0.5);
        const dir = tgt.clone().sub(eye); const dist = dir.length(); dir.normalize();
        if (raycastVoxel(w, eye, dir, dist - 0.3)) continue;
        const model = buildModel('echobat');
        const wild = new Wild(makeCreature('echobat', 8), model, new V(ax + 0.5, y, az + 0.5));
        wild.cave = true; wild.frozen = true; wild.heading = yaw + Math.PI;
        model.position.copy(wild.pos); model.rotation.y = wild.heading;
        g.scene.add(model); cm.list.push(wild);
        g.player.pos.set(x + 0.5, y, z + 0.5); g.player.vel.set(0, 0, 0);
        g.player.lookAt({ x: ax + 0.5, y: y + 0.8, z: az + 0.5 });
        return { at: [x, y, z], wild: [ax, y, az] };
      }
    }
    return null;
  });
  t.ok(cr, 'placed a cave creature in view');
  await lanternReady(0.7);
  await shoot('cave-creature.png');

  // The surface must look as before: noon, and night with a lamp ahead of the player.
  const open = await page.evaluate(() => {
    const g = window.pokecraft, w = g.world, s = g.spawnPoint;
    // An open, flat, tree-free patch of grass near the start.
    for (let r = 0; r < 90; r += 2) for (let a = 0; a < 24; a++) {
      const cx = Math.floor(s.x + Math.cos(a * Math.PI / 12) * r), cz = Math.floor(s.z + Math.sin(a * Math.PI / 12) * r);
      let ok = true;
      const y0 = w.surface(cx, cz).y;
      for (let dx = -3; dx <= 3 && ok; dx++) for (let dz = -2; dz <= 10 && ok; dz++) {
        const q = w.surface(cx + dx, cz + dz);
        if (q.id !== 1 || Math.abs(q.y - y0) > 2) ok = false;
      }
      if (ok && !w.gymAt(cx, cz + 5)) return [cx, y0 + 1, cz];
    }
    return [Math.floor(s.x), Math.floor(s.y), Math.floor(s.z)];
  });
  t.ok(open, 'found an open meadow for the surface pictures');
  await page.evaluate(([x, y, z]) => {
    const g = window.pokecraft;
    g.creatures.clear();
    g.weather.set('clear');
    g.player.pos.set(x + 0.5, y, z + 0.5); g.player.vel.set(0, 0, 0); g.player.yaw = Math.PI; g.player.pitch = 0.05;
    g.time = 0.25;
  }, open);
  await page.waitForFunction(async () => (await import('/src/caves.js')).caveLight.uLantern.value < 0.01, null, { timeout: 90000 });
  await shoot('surface-day.png');
  await page.evaluate(([x, y, z]) => {
    const g = window.pokecraft, w = g.world;
    for (const [dx, dz] of [[0, 4], [-3, 6], [3, 7]]) { w.set(x + dx, y, z + dz, 43); w.set(x + dx, y + 1, z + dz, 43); }
    g.player.yaw = Math.PI; g.player.pitch = -0.1;
    g.time = 0.75;
  }, open);
  await shoot('surface-night-lamp.png');

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
