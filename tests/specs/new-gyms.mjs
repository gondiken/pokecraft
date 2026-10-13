// T10: gyms 19-22 (Sunbeam, Origami, Goo, Cloud). Placement on six seeds (nothing old moves), the Goo Gym's cave,
// the Cloud Gym floating out of reach until you build up to it, and pictures of each new gym.
import fs from 'node:fs';
import { openGame, click, playBattle } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const SEEDS = [1, 7, 99, 777, 4242, 123456];
// Gyms 1-18 (in GYMS order), the tower and the Fossil Gym's floor, recorded with the code before T10 (identical now).
const OLD = {
  1: { gyms: [[84, 101], [87, 152], [91, 57], [130, 55], [168, 138], [129, 178], [182, 90], [40, 92], [27, 127], [185, 52], [136, 19], [56, 31], [54, 197], [178, 197], [18, 181], [20, 24], [40, 58], [96, 206]], tower: [125, 124], fossil: [40, 58, 3] },
  7: { gyms: [[141, 91], [76, 124], [99, 75], [131, 160], [164, 121], [39, 105], [55, 53], [165, 47], [95, 197], [92, 26], [200, 87], [128, 21], [32, 175], [190, 183], [16, 60], [55, 16], [66, 198], [146, 206]], tower: [110, 129], fossil: [66, 198, 3] },
  99: { gyms: [[127, 94], [157, 114], [127, 157], [72, 80], [48, 122], [170, 74], [123, 38], [185, 151], [118, 196], [72, 37], [48, 172], [80, 201], [22, 72], [207, 57], [194, 192], [37, 20], [164, 20], [206, 106]], tower: [113, 129], fossil: [164, 20, 3] },
  777: { gyms: [[113, 85], [145, 127], [91, 167], [159, 165], [150, 49], [183, 91], [42, 87], [132, 198], [99, 21], [95, 205], [205, 135], [16, 123], [54, 34], [36, 181], [203, 61], [207, 197], [172, 118], [170, 206]], tower: [112, 129], fossil: [172, 118, 3] },
  4242: { gyms: [[115, 92], [80, 76], [66, 139], [167, 116], [94, 168], [104, 48], [138, 177], [175, 175], [34, 65], [198, 76], [84, 205], [53, 33], [156, 16], [30, 200], [198, 26], [17, 23], [112, 204], [206, 140]], tower: [127, 121], fossil: [112, 204, 3] },
  123456: { gyms: [[121, 86], [114, 143], [161, 89], [73, 159], [172, 124], [132, 186], [168, 168], [32, 101], [38, 149], [63, 37], [84, 205], [204, 75], [170, 17], [43, 201], [187, 204], [17, 17], [120, 26], [22, 60]], tower: [82, 104], fossil: [120, 26, 3] },
};
// A seed where the Goo Gym finds no room for a cavern and stands on the surface instead (found by scanning seeds).
const GOO_FALLBACK_SEED = 22;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  let page = await openGame(browser, base);

  // 1. Placement.
  const worlds = await page.evaluate(async ([seeds, fallbackSeed]) => {
    const { World, WORLD_W: W, WORLD_D: D, WATER_LEVEL } = await import('/src/world.js');
    const { GYMS, TOWER } = await import('/src/gyms.js');
    const { B, WOOL } = await import('/src/blocks.js');
    const { isSolid } = await import('/src/blocks.js');
    const out = {};
    for (const seed of [...seeds, fallbackSeed]) {
      const w = new World(seed, null, null);
      w.generate();
      const gy = w.gyms;
      const tower = [w.tower.x, w.tower.z];
      const euclid = g => Math.min(...gy.filter(o => o !== g && !o.cave).map(o => Math.hypot(g.x - o.x, g.z - o.z)));
      const cheb = (g, [x, z]) => Math.max(Math.abs(g.x - x), Math.abs(g.z - z));
      const caveGap = g => { const c = gy.filter(o => o !== g && o.cave); return c.length ? Math.min(...c.map(o => cheb(g, [o.x, o.z]))) : 99; };
      const info = g => ({
        id: g.def.id, x: g.x, z: g.z, y: g.y, cave: !!g.cave, sky: !!g.sky,
        gap: euclid(g), towerGap: cheb(g, tower), caveGap: caveGap(g), middle: Math.hypot(g.x - W / 2, g.z - D / 2),
        roof: w.get(g.x + 5, g.y + 5, g.z + 5), corner: w.get(g.x + 6, g.y, g.z + 6), biome: w.biome(g.x, g.z),
      });
      const rec = {
        n: gy.length, order: gy.every((g, i) => g.def === GYMS[i]),
        old: gy.slice(0, 18).map(g => [g.x, g.z]), tower, fossil: [gy[16].x, gy[16].z, gy[16].y],
        news: gy.slice(18).map(info), boxes: (w.newGymBoxes || []).length,
        wool: [WOOL.light, WOOL.paper, WOOL.slime, WOOL.sky],
      };
      // The Goo Gym's way out: a walk from its door to the open sky.
      const goo = gy[20];
      if (goo.cave) {
        const [fx, fz] = goo.front;
        const door = [goo.x + fx * 8, goo.y, goo.z + fz * 8];
        const stand = (x, y, z) => x >= 0 && z >= 0 && x < W && z < D && y >= 1 && !isSolid(w.get(x, y, z)) && !isSolid(w.get(x, y + 1, z)) && (isSolid(w.get(x, y - 1, z)) || w.get(x, y - 1, z) === B.WATER);
        const key = (x, y, z) => x + W * (z + D * y);
        const seen = new Set([key(...door)]), st = [door];
        let sky = false;
        while (st.length && !sky) {
          const [x, y, z] = st.pop();
          if (y >= w.ground[x + z * W] && w.skyAt(x, y + 1, z) === 1) { sky = true; break; }
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, nz = z + dz;
            if (Math.abs(nx - goo.x) > 60 || Math.abs(nz - goo.z) > 60) continue;
            const tries = [];
            if (!isSolid(w.get(x, y + 2, z))) tries.push(y + 1);
            tries.push(y, y - 1, y - 2, y - 3);
            for (const ny of tries) {
              if (!stand(nx, ny, nz) || seen.has(key(nx, ny, nz))) continue;
              seen.add(key(nx, ny, nz)); st.push([nx, ny, nz]);
              break;
            }
          }
        }
        rec.gooWalk = sky;
        rec.gooLit = w.inLitRoom({ x: goo.x + 0.5, y: goo.y, z: goo.z + 0.5 });
        rec.gooHere = w.gymAt(goo.x, goo.z, goo.y)?.def.id;
        rec.gooHill = w.gymAt(goo.x, goo.z, w.ground[goo.x + goo.z * W] + 1)?.def.id ?? null;
      }
      const sky = gy[21];
      rec.skyHere = w.gymAt(sky.x, sky.z, sky.y)?.def.id;
      rec.skyBelow = w.gymAt(sky.x, sky.z, w.ground[sky.x + sky.z * W] + 1)?.def.id ?? null;
      rec.skyAny = w.gymAt(sky.x, sky.z)?.def.id;
      rec.pad = sky.pad;
      out[seed] = rec;
    }
    return out;
  }, [SEEDS, GOO_FALLBACK_SEED]);
  for (const seed of SEEDS) {
    const w = worlds[seed], o = OLD[seed];
    t.ok(w.n === 22 && w.order, `seed ${seed}: 22 gyms in GYMS order`);
    t.ok(JSON.stringify(w.old) === JSON.stringify(o.gyms) && JSON.stringify(w.tower) === JSON.stringify(o.tower) && JSON.stringify(w.fossil) === JSON.stringify(o.fossil),
      `seed ${seed}: gyms 1-18, the tower and the Fossil Gym are where they were before the new gyms`);
    const [light, paper, goo, sky] = w.news;
    t.ok(!light.cave && !light.sky && light.roof === w.wool[0] && light.corner === 9 && light.gap >= 30 && light.towerGap >= 30 && light.caveGap >= 32 && light.middle >= 40 && ['meadow', 'plains'].includes(light.biome),
      `seed ${seed}: the Sunbeam Gym stands in a ${light.biome} at (${light.x}, ${light.z}), ${light.gap.toFixed(0)} from the nearest gym, with a light-wool roof and cobble corners`);
    t.ok(!paper.cave && !paper.sky && paper.roof === w.wool[1] && paper.corner === 6 && paper.gap >= 30 && paper.towerGap >= 30 && paper.caveGap >= 32 && paper.middle >= 40,
      `seed ${seed}: the Origami Gym stands at (${paper.x}, ${paper.z}), ${paper.gap.toFixed(0)} from the nearest gym, with a paper roof and log corners`);
    if (goo.cave) {
      t.ok(w.gooWalk && w.gooLit && w.gooHere === 'slime' && w.gooHill === null && goo.y === 3,
        `seed ${seed}: the Goo Gym is a cave gym at (${goo.x}, ${goo.z}) (floor ${goo.y}) and the stairs lead to the sky`);
    } else {
      t.ok(!goo.sky && goo.roof === w.wool[2] && goo.gap >= 20 && goo.caveGap >= 32,
        `seed ${seed}: no room for a cavern: the Goo Gym stands on the surface at (${goo.x}, ${goo.z}), ${goo.gap.toFixed(0)} from the nearest gym`);
    }
    const fy = sky.y - 1;
    t.ok(sky.sky && fy >= 26 && fy <= 36 && sky.roof === w.wool[3] && sky.gap >= 24 && sky.towerGap >= 24 && sky.middle >= 40 && w.skyHere === 'sky' && w.skyBelow === null && w.skyAny === 'sky',
      `seed ${seed}: the Cloud Gym floats at (${sky.x}, ${sky.z}), floor ${fy}, ${sky.gap.toFixed(0)} from the nearest gym; gymAt only counts on the island`);
    t.ok(w.boxes >= 4, `seed ${seed}: the new gyms' boxes are recorded (${w.boxes})`);
  }
  const fb = worlds[GOO_FALLBACK_SEED];
  t.ok(fb.n === 22 && !fb.news[2].cave && !fb.news[2].sky && fb.news[2].id === 'slime', `seed ${GOO_FALLBACK_SEED}: no room for a cavern, the Goo Gym is a swamp or forest building on the surface`);

  // 2. The Cloud Gym is out of reach until you build up to it.
  const reach = await page.evaluate(async ([seeds]) => {
    const { World, WORLD_W: W, WORLD_D: D, WORLD_H: H } = await import('/src/world.js');
    const { Player } = await import('/src/player.js');
    const { B, WOOL, isSolid } = await import('/src/blocks.js');
    const out = {};
    for (const seed of seeds) {
      const w = new World(seed, null, null);
      w.generate();
      const g = w.gyms[21], fy = g.y - 1, [fx, fz] = g.front;
      const col = (d, s) => [g.x + fx * d + (fx ? 0 : s), g.z + fz * d + (fz ? 0 : s)];
      // Natural blocks: nothing solid at fy-3 or higher outside the island (r > 11) within 16, and the island is cloud on top.
      let highest = 0, solidHigh = 0;
      for (let a = -16; a <= 16; a++) for (let b = -16; b <= 16; b++) {
        const x = g.x + a, z = g.z + b;
        if (a * a + b * b <= 121) continue;
        for (let y = H - 1; y >= 0; y--) if (isSolid(w.get(x, y, z))) { highest = Math.max(highest, y); if (y >= fy - 3) solidHigh++; break; }
      }
      let underHigh = 0;
      for (let a = -11; a <= 11; a++) for (let b = -11; b <= 11; b++) {
        if (a * a + b * b > 121) continue;
        for (let y = fy - 4; y >= 0; y--) if (isSolid(w.get(g.x + a, y, g.z + b))) { underHigh = Math.max(underHigh, y); break; }
      }
      const topIsCloud = w.get(g.x + 9, fy, g.z) === B.CLOUD && w.get(g.x, fy, g.z + 9) === B.CLOUD && w.get(g.x, fy + 1, g.z + 9) === B.AIR;
      // The pad: sky wool on the ground, a lamp post, nothing solid above it up to the island's roof.
      let padOk = true, clear = true;
      const padTops = [];
      for (let d = 11; d <= 12; d++) for (let s = -1; s <= 1; s++) {
        const [x, z] = col(d, s);
        let y = H - 1; while (y > 0 && w.get(x, y, z) === B.AIR) y--;
        padTops.push(y);
        if (w.get(x, y, z) !== WOOL.sky) padOk = false;
        for (let k = y + 1; k <= fy + 4; k++) if (w.get(x, k, z) !== B.AIR) clear = false;
      }
      const [lx, lz] = col(11, 3);
      let ly = H - 1; while (ly > 0 && w.get(lx, ly, lz) === B.AIR) ly--;
      const lamp = w.get(lx, ly, lz) === B.LAMP && w.get(lx, ly - 1, lz) === B.COBBLE;
      const [px, pz] = col(11, 0);
      const padY = padTops[1] + 1; // the standing height on the pad's inner middle block (d = 11, s = 0)
      const padField = JSON.stringify(g.pad) === JSON.stringify([px, padTops[1], pz]) && padTops.every(y => y === padTops[0]);
      // Walking and jumping from the pad: first without a pillar, then with a pillar of stone up to the island's edge.
      const drive = (pillar) => {
        const w2 = w;
        const placed = [];
        const top = padY;
        if (pillar) for (let y = top; y <= fy - 1; y++) { w2.set(px, y, pz, B.STONE, false); placed.push(y); }
        const p = new Player(w2);
        p.pos.set(px + 0.5, pillar ? fy : top, pz + 0.5);
        p.yaw = Math.atan2(fx, fz); // towards the gym (the door faces the pad)
        p.keys = { Space: true, KeyW: true };
        let maxY = p.pos.y;
        for (let i = 0; i < 60; i++) { p.update(1 / 30); maxY = Math.max(maxY, p.pos.y); }
        p.keys = {}; // let go of the keys and settle
        for (let i = 0; i < 30; i++) p.update(1 / 30);
        const res = { maxY, y: p.pos.y, x: p.pos.x, z: p.pos.z, gym: w2.gymAt(Math.floor(p.pos.x), Math.floor(p.pos.z), p.pos.y)?.def.id ?? null };
        if (pillar) for (const y of placed) w2.set(px, y, pz, B.AIR, false);
        return res;
      };
      const ground = drive(false), built = drive(true);
      out[seed] = { fy, climb: fy - padY, padField, highest, solidHigh, underHigh, topIsCloud, padOk, clear, lamp, ground, built, front: g.front };
    }
    return out;
  }, [SEEDS]);
  for (const seed of SEEDS) {
    const r = reach[seed];
    t.ok(r.solidHigh === 0 && r.highest <= r.fy - 4 && r.underHigh <= r.fy - 4 && r.topIsCloud,
      `seed ${seed}: floor ${r.fy}; the highest natural block near the island is ${r.highest} (at most ${r.fy - 4}) and it is made of cloud, ${r.climb} blocks above the pad`);
    t.ok(r.padOk && r.clear && r.lamp && r.padField, `seed ${seed}: the flat blue landing pad (gym.pad), its lamp post and a free column above the pad`);
    t.ok(r.ground.maxY < r.fy - 0.5, `seed ${seed}: walking and jumping from the ground never gets above ${r.ground.maxY.toFixed(1)} (the island is at ${r.fy + 1})`);
    t.ok(Math.abs(r.built.y - (r.fy + 1)) < 0.01 && r.built.gym === 'sky', `seed ${seed}: after building a pillar on the pad one jump lands on the island (feet ${r.built.y.toFixed(2)}, ${r.built.gym})`);
  }
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();

  // 3. Pictures (seed 1, noon): each new gym from 22 blocks out (on a stone platform), the Goo Gym's cavern.
  const save = {
    seed: 1, edits: [], yaw: 0, pitch: 0, time: 0.25, size: [224, 224],
    party: [{ uid: 'a', species: 'zapple', level: 40, xp: 64000, hp: 100, moves: ['tackle', 'spark'] }],
    box: [], cubes: 12, badges: [], beaten: [], champion: false, savedAt: 1, toldCaveGym: true,
  };
  page = await openGame(browser, base, {
    setup: ctx => ctx.addInitScript(json => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('pokecraft-save-v2', json); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(save)),
  });
  await click(page, '#title-buttons button:has-text("Continue")');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.pokecraft; g.creatures.clear(); g.creatures.trySpawnCave = () => {}; g.time = 0.25; });
  for (const [id, file, up] of [['light', 'gym-light', 6], ['paper', 'gym-paper', 6], ['sky', 'gym-sky', -1]]) {
    await page.evaluate(([gid, up]) => {
      const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === gid), [fx, fz] = gym.front;
      const px = gym.x + fx * 22, pz = gym.z + fz * 22, y = gym.y + up;
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) g.world.set(px + x, y, pz + z, 3);
      g.player.pos.set(px + 0.5, y + 1, pz + 0.5);
      g.player.vel.set(0, 0, 0);
      g.player.lookAt({ x: gym.x + 0.5, y: gym.y + 6, z: gym.z + 0.5 });
    }, [id, up]);
    await page.waitForTimeout(4500);
    await page.screenshot({ path: SHOTS + file + '.png' });
  }
  // The Goo Gym's cavern from the back corner (puddles, glowcaps, goo dripping from the roof), lamps lit.
  const goo = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'slime'), [fx, fz] = gym.front;
    if (!gym.cave) return null;
    g.player.pos.set(gym.x - fx * 10 - fz * 7 + 0.5, gym.y, gym.z - fz * 10 + fx * 7 + 0.5);
    g.player.vel.set(0, 0, 0);
    g.player.lookAt({ x: gym.x + 0.5, y: gym.y + 1, z: gym.z + 0.5 });
    return true;
  });
  t.ok(goo, 'the Goo Gym stands in a cave on seed 1');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: SHOTS + 'gym-slime.png' });

  // 4. All four can be beaten: trainer, then leader, then the badge (a strong team, standing inside each gym).
  for (const [id, badge] of [['light', 'Sunbeam'], ['paper', 'Origami'], ['slime', 'Goo'], ['sky', 'Cloud']]) {
    await page.evaluate(async gid => {
      const g = window.pokecraft;
      const { makeCreature } = await import('/src/species.js');
      g.party = [makeCreature('tidalord', 45), makeCreature('thunderwolf', 45)];
      const gym = g.world.gyms.find(x => x.def.id === gid), [fx, fz] = gym.front;
      g.player.pos.set(gym.x + 0.5 + fx * 4.5, gym.y, gym.z + 0.5 + fz * 4.5);
      g.player.vel.set(0, 0, 0);
      document.exitPointerLock();
    }, id);
    const who = kind => `window.pokecraft.npcs.list.find(n => n.kind === '${kind}' && n.gym.def.id === '${id}')`;
    t.ok(await page.evaluate(`!!${who('leader')} && !!${who('trainer')}`), `${badge} Gym has a trainer and a leader`);
    await page.evaluate(`window.pokecraft.talkTo(${who('trainer')})`);
    t.ok(await playBattle(page), `${badge} trainer battle finishes`);
    await page.evaluate(`window.pokecraft.talkTo(${who('leader')})`);
    t.ok(await playBattle(page), `${badge} leader battle finishes`);
    t.ok(await page.evaluate(gid => window.pokecraft.badges.includes(gid), id), `${badge} Badge awarded`);
  }
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
