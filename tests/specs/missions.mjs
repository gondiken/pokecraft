// T29 Champion missions: data and save, the shared feature helpers, the three rare blocks, treasure map spots (from the seed),
// the map mission (talk, panel, hot/cold, dig), build challenges (placed blocks only), swapping, save/load, not-Champion, iPad.
// Screenshots: tests/screenshots/t29-*.png
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { openGame, newGame, pause, seedSave, continueGame, waitFor, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');

// Champion with every badge, standing in front of Champion Solenne.
const champ = page => page.evaluate(async () => {
  const { GYMS } = await import('/src/gyms.js');
  const g = window.pokecraft;
  g.badges = GYMS.map(d => d.id); g.champion = true;
  for (const k of ['tower:guard1', 'tower:guard2']) if (!g.beaten.includes(k)) g.beaten.push(k);
  const tw = g.world.tower, [fx, fz] = tw.front;
  g.player.pos.set(tw.x + 0.5 + fx * 3, tw.y, tw.z + 0.5 + fz * 3);
  g.player.vel.set(0, 0, 0);
});

// A natural (unrecorded) stone platform high in the air with nothing else near; the player stands on it.
const slab = page => page.evaluate(() => {
  const g = window.pokecraft, s = g.spawnPoint, x0 = Math.floor(s.x), z0 = Math.floor(s.z), y = 34; // the world is 48 high: room for a 10-high build
  g.world.edits.clear();
  for (let x = -6; x <= 8; x++) for (let z = -6; z <= 6; z++) {
    g.world.set(x0 + x, y, z0 + z, 3, false);
    for (let dy = 1; dy <= 14; dy++) g.world.set(x0 + x, y + dy, z0 + z, 0, false);
  }
  g.player.pos.set(x0 + 0.5, y + 1, z0 + 0.5); g.player.vel.set(0, 0, 0); g.player.onGround = true;
  return { x: x0, z: z0, y };
});

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  let page = await openGame(browser, base);

  // 1. Data, save format, features and blocks.
  const d = await page.evaluate(async () => {
    const M = await import('/src/missions.js');
    const F = await import('/src/features.js');
    const H = await import('/src/hometypes.js');
    const Bk = await import('/src/blocks.js');
    const { BUILDS } = await import('/src/buildcheck.js');
    const { SPECIES } = await import('/src/species.js');
    const kinds = { map: 0, build: 0, boss: 0 };
    for (const m of M.MISSIONS) kinds[m.kind]++;
    const report = { ok: true, counts: { all: { 3: 4, 9: 1, 20: 2, 21: 1 }, top: { 43: 1 } }, stats: { height: 6 } };
    const checks = {
      reach: F.reach('height', 6, { key: 'h', name: 'h', icon: 3 }).check(report),
      reach2: F.reach('height', 9, { key: 'h', name: 'h', icon: 3 }).check(report),
      different: F.different(3, [3, 9, 20, 21], { key: 'd', name: 'd' }).check(report),
      different2: F.different(5, [3, 9, 20, 21], { key: 'd', name: 'd' }).check(report),
      any: F.atLeast(8, null, { key: 'a', name: 'a', icon: 3, where: ['all'] }).check(report),
      any2: F.atLeast(9, null, { key: 'a', name: 'a', icon: 3, where: ['all'] }).check(report),
      all: F.checkAll([F.reach('height', 6, { key: 'h', name: 'H', icon: 3 }), F.hasBlock(43, { key: 'l', name: 'L', where: ['top'] })], report),
      none: F.checkAll([F.reach('height', 6, { key: 'h', name: 'H', icon: 3 })], { ok: false, counts: {}, stats: { height: 9 } }),
    };
    return {
      n: M.MISSIONS.length, unique: new Set(M.MISSIONS.map(m => m.id)).size, kinds,
      builds: M.MISSIONS.filter(m => m.kind === 'build').every(m => BUILDS[m.build]),
      bosses: M.MISSIONS.filter(m => m.kind === 'boss').every(m => m.boss && SPECIES[m.species] && !SPECIES[m.species].legendary),
      empty: JSON.stringify(M.loadMissions(undefined)),
      junk: JSON.stringify(M.loadMissions({ active: 'nope', done: ['map1', 'map1', 'x', 3] })),
      doneActive: JSON.stringify(M.loadMissions({ active: 'map1', done: ['map1'], last: 'zzz' })),
      goodActive: JSON.stringify(M.loadMissions({ active: 'map2', done: ['map1'], last: 'map1' })),
      next0: M.nextMission({ done: [], last: null })?.id,
      nextWrap: M.nextMission({ done: M.MISSIONS.filter(m => m.id !== 'map1').map(m => m.id), last: 'giant3' })?.id,
      nextSkip: M.nextMission({ done: [], last: 'map1' }, 'lamptower')?.id,
      nextNone: M.nextMission({ done: M.MISSIONS.map(m => m.id), last: 'map1' }),
      same: H.hasBlock === F.hasBlock && H.atLeast === F.atLeast && H.mostly === F.mostly && H.count === F.count,
      checks,
      ids: [Bk.B.STAR_BLOCK, Bk.B.RAINBOW_BRICK, Bk.B.GIANT_TROPHY].join(),
      names: Bk.MISSION_BLOCKS.map(id => Bk.BLOCKS[id].name).join(),
      limited: Bk.MISSION_BLOCKS.every(id => Bk.isLimited(id) && Bk.PLACEABLE.includes(id) && !Bk.HOTBAR.includes(id) && Bk.BLOCKS[id].getMore),
      tiles: Bk.TILE_COUNT,
      tileNames: [Bk.T.STAR_BLOCK, Bk.T.RAINBOW_BRICK, Bk.T.TROPHY_SIDE, Bk.T.TROPHY_TOP].join(),
      cast: Bk.MISSION_BLOCKS.length,
    };
  });
  t.ok(d.n === 12 && d.unique === 12 && d.kinds.map === 5 && d.kinds.build === 4 && d.kinds.boss === 3, `12 missions, unique ids (${JSON.stringify(d.kinds)})`);
  t.ok(d.builds && d.bosses, 'every build mission has a challenge; every boss mission has a species');
  t.ok(d.empty === '{"active":null,"done":[],"last":null}', `no save gives an empty state (${d.empty})`);
  t.ok(d.junk === '{"active":null,"done":["map1"],"last":null}', `junk is dropped (${d.junk})`);
  t.ok(d.doneActive === '{"active":null,"done":["map1"],"last":null}' && d.goodActive === '{"active":"map2","done":["map1"],"last":"map1"}', 'an active mission that is done is dropped; good saves stay');
  t.ok(d.next0 === 'map1' && d.nextWrap === 'map1' && d.nextSkip === 'map2' && d.nextNone === null, `next mission: first, wraps round, skips, null at the end (${d.next0}/${d.nextWrap}/${d.nextSkip})`);
  t.ok(d.same, 'hometypes re-exports the same feature helpers');
  const c = d.checks;
  t.ok(c.reach.done && c.reach.have === 6 && !c.reach2.done && c.reach2.have === 6 && c.reach2.need === 9, 'reach() reads report.stats');
  t.ok(c.different.done && c.different.have === 3 && !c.different2.done && c.different2.have === 4, 'different() counts distinct ids');
  t.ok(c.any.done && c.any.have === 8 && !c.any2.done, 'atLeast(n, null) counts every block');
  t.ok(c.all.finished && c.all.done === 2 && c.all.need === 2 && !c.none.finished && c.none.features[0].done, 'checkAll: finished only when all are done and the report is ok');
  t.ok(d.ids === '75,76,77' && d.names === 'Star Block,Rainbow Brick,Giant Trophy' && d.limited, 'blocks 75-77 are limited, placeable, not in the hotbar, with a "get more" line');

  // 2. Treasure map spots from the seed.
  const sp = await page.evaluate(async () => {
    const { World, WATER_LEVEL, MID_X, MID_Z } = await import('/src/world.js');
    const { treasureSpots, clueOf, MAP_LEGS, MAP_RULES, MAP_GYMS } = await import('/src/treasuremap.js');
    const { GYMS } = await import('/src/gyms.js');
    const cheb = (a, b) => Math.max(Math.abs(a.x - b[0]), Math.abs(a.z - b[1]));
    const box = (x, z, b) => Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1, 0);
    const out = [];
    const bad = ['poke', 'trainer card', 'north', 'south', 'east', 'west'];
    for (const seed of [1, 7, 42, 4242, 99999, 2024]) {
      const w = new World(seed, null, null); w.generate();
      const s = treasureSpots(w);
      const r = { seed, n: s.length, land: true, free: true, slots: true, apart: true, start: true, legs: true, fallbacks: 0, words: true, tower: s[0]?.land.tower, ends: true, more: true };
      const boxes = [...w.gyms.filter(g => GYMS.indexOf(g.def) < MAP_GYMS).flatMap(g => g.protect || []), ...w.tower.protect];
      s.forEach((p, i) => {
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const g = w.ground[(p.x + a) + (p.z + b) * w.W]; if (g <= WATER_LEVEL) r.land = false; }
        if (boxes.some(b => box(p.x, p.z, b) <= (p.relaxed ? 8 : MAP_RULES.gap))) r.free = false;
        if (w.newLandSlots().some(sl => box(p.x, p.z, sl.box) <= MAP_RULES.slot)) r.slots = false;
        for (let j = 0; j < i; j++) if (cheb(p, [s[j].x, s[j].z]) < (p.relaxed ? 24 : MAP_RULES.spread)) r.apart = false;
        if (Math.max(Math.abs(p.x - MID_X), Math.abs(p.z - MID_Z)) < MAP_RULES.start) r.start = false;
        if (p.fallback) r.fallbacks++;
        else {
          const leg = MAP_LEGS[i];
          if (p.fwd < leg.min || p.fwd > leg.max) r.legs = false;
          const [dx, dz] = [p.x - p.land.door[0], p.z - p.land.door[1]];
          if (dx * p.land.front[0] + dz * p.land.front[1] !== p.fwd) r.legs = false;
        }
        const cl = clueOf(w, p);
        const text = cl.lines.join(' ').toLowerCase();
        if (bad.some(x => text.includes(x))) r.words = false;
        if (cl.lines.at(-1) !== 'Dig 2 blocks down on the X!') r.ends = false;
        if (!p.fallback && !(cl.lines[0].includes(p.land.name) && cl.lines[0].includes('step'))) r.more = false;
        if ((text.match(/\d+/g) || []).some(n => Number(n) > 40)) r.words = false;
      });
      // a second fresh world gives the same spots; edits around spot 0 change nothing
      const w2 = new World(seed, null, null); w2.generate();
      r.same = JSON.stringify(treasureSpots(w2).map(p => [p.x, p.z])) === JSON.stringify(s.map(p => [p.x, p.z]));
      const p0 = s[0];
      for (let i = 0; i < 50; i++) w2.set(p0.x - 3 + (i % 7), w2.ground[p0.x + p0.z * w2.W] + 1, p0.z - 3 + Math.floor(i / 7), 3);
      w2.treasureSpots = null;
      r.edited = JSON.stringify(treasureSpots(w2).map(p => [p.x, p.z])) === JSON.stringify(s.map(p => [p.x, p.z]));
      out.push(r);
    }
    return out;
  });
  for (const r of sp) {
    t.ok(r.n === 5 && r.land && r.free && r.slots && r.apart && r.start, `seed ${r.seed}: 5 spots on dry 3x3 land, clear of gyms and slots, 40 apart, away from the start`);
    t.ok(r.legs && r.tower && r.fallbacks <= 1 || r.fallbacks && r.legs, `seed ${r.seed}: map 1 starts at the tower (${r.tower}), distances fit the legs (${r.fallbacks} fallback)`);
    t.ok(r.same && r.edited, `seed ${r.seed}: a second world and edits give the same spots`);
    t.ok(r.words && r.ends && r.more, `seed ${r.seed}: the clue names the landmark, ends with the dig line and has no odd words`);
  }

  // 3. The map mission in the game.
  await newGame(page, 0);
  await champ(page);
  await pause(page);
  await page.evaluate(() => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(n => n.role === 'champion')); });
  await waitFor(page, () => !document.getElementById('missions').classList.contains('hidden'));
  t.ok(await page.evaluate(() => window.pokecraft.missionUi.mode === 'desk' && !!document.querySelector('#missions button.mbtn:not(.primary), #missions button')), 'talking to the Champion opens the missions panel (desk mode)');
  t.ok(await page.evaluate(() => [...document.querySelectorAll('#missions button')].some(b => b.textContent.includes('Battle Champion Solenne'))), 'the rematch is a button in the panel');
  await page.click('#missions button:has-text("Start this mission!")');
  const m1 = await page.evaluate(() => {
    const g = window.pokecraft, c = document.querySelector('#missions canvas.map');
    const ctx = c.getContext('2d'), mid = ctx.getImageData(c.width / 2 - 6, c.height / 2 - 6, 12, 12).data;
    let red = 0;
    for (let i = 0; i < mid.length; i += 4) if (mid[i] > 180 && mid[i + 1] < 60 && mid[i + 2] < 60) red++;
    return { active: g.missionState.active, red, clue: document.querySelector('#missions .clue').innerText, chip: document.getElementById('mission-chip').textContent };
  });
  t.ok(m1.active === 'map1', 'Start this mission! makes map 1 active');
  t.ok(m1.red > 5, `the map picture has a red X in the middle (${m1.red} red pixels)`);
  t.ok((/step/.test(m1.clue) || /Look at the map picture/.test(m1.clue)) && /Dig 2 blocks down on the X!/.test(m1.clue), `the clue is shown ("${m1.clue.replace(/\n+/g, ' ')}")`);
  t.ok(/Treasure map 1/.test(m1.chip), `the chip says ${m1.chip}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 't29-map.png'), timeout: 120000 });
  // walk the clue: left really is the player's left
  const way = await page.evaluate(async () => {
    const g = window.pokecraft;
    const { treasureSpots, leftOf } = await import('/src/treasuremap.js');
    const s = treasureSpots(g.world).find(p => !p.fallback);
    const front = s.land.front;
    // look along `front` and take the player's own forward; the left is up x forward
    g.player.lookAt({ x: g.player.pos.x + front[0] * 5, y: g.player.pos.y, z: g.player.pos.z + front[1] * 5 });
    g.player.pitch = 0;
    const f = g.player.forward, left = leftOf(front);
    // right = forward x up = (-fz, 0, fx), left = (fz, 0, -fx)
    return { left, mine: [f.z, -f.x], fwdOk: Math.abs(f.x - front[0]) < 0.01 && Math.abs(f.z - front[1]) < 0.01 };
  });
  t.ok(way.fwdOk && Math.abs(way.left[0] - way.mine[0]) < 0.01 && Math.abs(way.left[1] - way.mine[1]) < 0.01, 'the clue\'s "left" is the player\'s left when looking away from the door');
  // hot / cold
  const hc = await page.evaluate(() => {
    const g = window.pokecraft;
    return import('/src/treasuremap.js').then(({ treasureSpots }) => {
      const s = treasureSpots(g.world)[0], out = {};
      const put = (dx) => { g.player.pos.set(s.x + 0.5 + dx, s.g + 3, s.z + 0.5); g.player.vel.set(0, 0, 0); g.missions.update(0.3); return g.missions.hint.word; };
      out.warm = put(30); out.hot = put(15); out.very = put(4); out.here = put(0.5);
      out.chip = document.getElementById('mission-chip').textContent;
      out.cold = put(60);
      return out;
    });
  });
  t.ok(hc.cold === 'cold' && hc.warm === 'warm' && hc.hot === 'hot!' && hc.very === 'very hot!' && hc.here === 'Dig here!', `hot and cold words (${JSON.stringify(hc)})`);
  t.ok(/Dig here/.test(hc.chip), 'the chip shows the same word');
  // dig: stand in a 2-deep hole on the X
  const dug = await page.evaluate(async () => {
    const g = window.pokecraft;
    const { treasureSpots } = await import('/src/treasuremap.js');
    const s = treasureSpots(g.world)[0];
    const cubes = g.cubes;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const dy of [0, -1]) g.world.set(s.x + a, s.g + dy, s.z + b, 0);
    g.player.pos.set(s.x + 0.5, s.g - 1, s.z + 0.5); g.player.vel.set(0, 0, 0); g.player.onGround = true;
    g.missions.update(0.3);
    return { cubes: g.cubes - cubes };
  });
  await waitFor(page, () => window.pokecraft.missionState.done.includes('map1'));
  const done = await page.evaluate(() => {
    const g = window.pokecraft;
    return { done: g.missionState.done, active: g.missionState.active, stars: g.blockCounts[75], toasts: document.getElementById('toast').innerText, saved: JSON.parse(localStorage.getItem('pokecraft-save-v2')).missions };
  });
  t.ok(dug.cubes === 5 && done.stars === 4 && done.active === null, `digging the X gives 4 Star Blocks and 5 cubes (${dug.cubes} cubes, ${done.stars} stars)`);
  t.ok(/found the treasure/i.test(done.toasts) && /Go back to Champion Solenne/.test(done.toasts), 'the toasts say what happened and where to go');
  t.ok(done.saved?.done.includes('map1') && done.saved.last === 'map1', 'the save has the finished mission');

  // 4. Build missions.
  await page.evaluate(() => { window.pokecraft.missions.give(); });
  t.ok(await page.evaluate(() => window.pokecraft.missionState.active) === 'lamptower', 'the next mission after map 1 is the Lamp Tower');
  const s0 = await slab(page);
  const b1 = await page.evaluate(async ({ x, z, y }) => {
    const g = window.pokecraft, w = g.world;
    const { B } = await import('/src/blocks.js');
    const { scanBuild } = await import('/src/buildcheck.js');
    const cx = x + 2;
    for (let i = 1; i <= 4; i++) w.set(cx, y + i, z, B.COBBLE);
    w.set(cx, y + 5, z, B.LAMP);
    g.missions.update(0.3);
    const r = g.missions.check();
    const out = { done1: g.missionState.done.includes('lamptower'), high: r.features[0], lamp: r.features[1], cells: g.missions.report.cells };
    w.set(cx, y + 5, z, B.COBBLE); w.set(cx, y + 6, z, B.LAMP);
    out.bad = (() => { w.set(cx, y + 6, z, B.AIR); const rep = scanBuild(w, g.player.pos); w.set(cx, y + 6, z, B.LAMP); return rep.stats.height; })();
    return out;
  }, s0);
  t.ok(!b1.done1 && b1.high.have === 5 && !b1.high.done && b1.lamp.done, `a 5-high tower with a lamp is not enough yet (${b1.high.have}/${b1.high.need}, lamp ${b1.lamp.done})`);
  await page.evaluate(() => { document.exitPointerLock(); window.pokecraft.openMissions('view'); });
  await waitFor(page, () => !document.getElementById('missions').classList.contains('hidden'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 't29-build.png'), timeout: 120000 });
  await page.evaluate(() => window.pokecraft.closeMissions());
  const b2 = await page.evaluate(() => { const g = window.pokecraft; const r = g.missions.check(); return { done: g.missionState.done.includes('lamptower'), bricks: g.blockCounts[76], lampTop: r === null }; });
  t.ok(b2.done && b2.bricks === 4, `a 6-high tower with the lamp on top finishes the mission: 4 Rainbow Bricks (${b2.bricks})`);
  // natural blocks do not count
  const nat = await page.evaluate(async ({ x, z, y }) => {
    const g = window.pokecraft, w = g.world;
    const { B } = await import('/src/blocks.js');
    const { scanBuild } = await import('/src/buildcheck.js');
    w.edits.clear();
    for (let i = 1; i <= 7; i++) w.set(x + 3, y + i, z + 2, B.STONE, false);
    w.set(x + 3, y + 8, z + 2, B.LAMP);
    g.player.pos.set(x + 2.5, y + 8, z + 2.5);
    const rep = scanBuild(w, g.player.pos);
    return { height: rep.stats.height, cells: rep.cells };
  }, s0);
  t.ok(nat.height === 1 && nat.cells === 1, `natural blocks don't count: a 7-high stone pillar plus a placed lamp is height ${nat.height}`);
  // bridge and rainbow
  const br = await page.evaluate(async ({ x, z, y }) => {
    const g = window.pokecraft, w = g.world;
    const { B, WOOL, PLACEABLE } = await import('/src/blocks.js');
    const { scanBuild, BUILDS } = await import('/src/buildcheck.js');
    const { checkAll } = await import('/src/features.js');
    w.edits.clear();
    for (let dx = 0; dx < 10; dx++) w.set(x - 4 + dx, y + 1, z + 3, B.WATER, false);
    for (let dx = 1; dx <= 8; dx++) w.set(x - 4 + dx, y + 2, z + 3, B.PLANKS);
    g.player.pos.set(x + 0.5, y + 3, z + 3.5);
    const r = scanBuild(w, g.player.pos);
    const bridge = checkAll(BUILDS.bridge.features, r);
    const over = Object.values(r.counts.overWater).reduce((a, b) => a + b, 0);
    // 7 planks are not enough
    w.set(x + 4, y + 2, z + 3, B.AIR);
    const r7 = scanBuild(w, g.player.pos);
    const bridge7 = checkAll(BUILDS.bridge.features, r7);
    // rainbow wall
    w.edits.clear();
    const woolIds = PLACEABLE.filter(id => Object.values(WOOL).includes(id));
    const wall = n => {
      w.edits.clear();
      for (let dx = 0; dx < 6; dx++) for (let dy = 0; dy < 3; dy++) w.set(x - 2 + dx, y + 1 + dy, z - 3, woolIds[(dx < n ? dx : n - 1)]);
      g.player.pos.set(x + 0.5, y + 1, z - 1.5);
      return checkAll(BUILDS.rainbow.features, scanBuild(w, g.player.pos));
    };
    const six = wall(6), five = wall(5);
    return { over, bridge: bridge.finished, bridge7: bridge7.finished, over7: Object.values(r7.counts.overWater).reduce((a, b) => a + b, 0), six: six.finished, five: five.finished, fiveHave: five.features[0].have };
  }, s0);
  t.ok(br.over === 8 && br.bridge && !br.bridge7 && br.over7 === 7, `a bridge of 8 planks over water counts (${br.over}); 7 do not (${br.over7})`);
  t.ok(br.six && !br.five && br.fiveHave === 5, `a rainbow wall needs 6 wool colours (6: ${br.six}, 5: ${br.five})`);

  // 5. Swap and order.
  const sw = await page.evaluate(() => {
    const g = window.pokecraft, s = g.missionState;
    s.done = ['map1', 'lamptower', 'map2']; s.active = null; s.last = 'map2';
    g.missions.give();
    const first = s.active;
    g.openMissions('view');
    return first;
  });
  t.ok(sw === 'giant1', 'after map 2 comes the first giant');
  await waitFor(page, () => !document.getElementById('missions').classList.contains('hidden'));
  t.ok(await page.evaluate(() => document.getElementById('missions-body').innerText.includes('Play together with a friend first')), 'a boss mission without a friend says what to do');
  await page.click('#missions button:has-text("Do a different one")');
  const sw2 = await page.evaluate(() => { const s = window.pokecraft.missionState; return { active: s.active, last: s.last }; });
  t.ok(sw2.active === 'bridge' && sw2.last === 'giant1', `"Do a different one" puts the giant back and gives ${sw2.active}`);
  const sw3 = await page.evaluate(async () => {
    const g = window.pokecraft, M = await import('/src/missions.js');
    g.missions.complete(g.missions.active);
    const afterBridge = M.nextMission(g.missionState)?.id;
    g.missions.give();
    const given = g.missionState.active;
    const s = g.missionState;
    const all = M.MISSIONS.map(m => m.id).filter(id => id !== 'giant1');
    const wrap = M.nextMission({ done: all, last: 'map5' })?.id;
    return { afterBridge, given, wrap, saved: JSON.parse(localStorage.getItem('pokecraft-save-v2')).missions.last };
  });
  t.ok(sw3.afterBridge === 'map3' && sw3.given === 'map3' && sw3.wrap === 'giant1', `after the bridge comes map 3, and the giant comes back later (${sw3.afterBridge}/${sw3.wrap})`);
  t.ok(sw3.saved === 'map3', 'the "last" mission is saved');
  await page.evaluate(() => window.pokecraft.closeMissions());

  // 6. Rare blocks.
  const rb = await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world;
    const { B, BLOCKS } = await import('/src/blocks.js');
    const s = g.spawnPoint, x = Math.floor(s.x) + 3, y = 34, z = Math.floor(s.z);
    w.set(x, y, z, B.STONE, false);
    g.blockCounts[75] = 0;
    g.hotbar[0] = B.STAR_BLOCK; g.selected = 0; g.ui.renderHud();
    const toasts = [];
    const toast = g.ui.toast.bind(g.ui);
    g.ui.toast = text => { toasts.push(text); toast(text); };
    g.placeBlock({ x, y, z, id: B.STONE, normal: [0, 1, 0] });
    const none = { placed: w.get(x, y + 1, z), toast: toasts.join('|') };
    g.blockCounts[75] = 2; g.ui.renderHud();
    const slot = document.querySelector('#hotbar .slot');
    g.placeBlock({ x, y, z, id: B.STONE, normal: [0, 1, 0] });
    const placed = { id: w.get(x, y + 1, z), count: g.blockCounts[75], label: slot.querySelector('.count')?.textContent };
    g.breakBlock({ x, y: y + 1, z, id: B.STAR_BLOCK, normal: [0, 1, 0] });
    const back = g.blockCounts[75];
    g.ui.toast = toast;
    g.hotbar[0] = B.GRASS; g.selected = 0; g.ui.renderHud();
    return { none, placed, back };
  });
  t.ok(rb.none.placed === 0 && /Finish Champion missions to get more!/.test(rb.none.toast), `no Star Block left: "${rb.none.toast}"`);
  t.ok(rb.placed.id === 75 && rb.placed.count === 1 && rb.back === 2, 'placing uses one Star Block; breaking one gives it back');
  await pause(page);
  await page.keyboard.press('b');
  await waitFor(page, () => !document.getElementById('blocks').classList.contains('hidden'));
  const panel = await page.evaluate(() => [...document.querySelectorAll('#blocks-grid *, #blocks *')].map(e => e.textContent).join(' '));
  t.ok(/×\d/.test(panel), 'the Blocks panel shows counts for limited blocks');
  await page.keyboard.press('b');

  // 7. Save and load (a new context for each save).
  const base1 = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  await page.context().close();
  const mk = async mod => {
    const save = { ...base1 }; mod(save);
    const pg = await openGame(browser, base, { setup: seedSave(save) });
    await continueGame(pg);
    const st = await pg.evaluate(() => ({ s: JSON.stringify(window.pokecraft.missionState), err: 0 }));
    return { pg, st };
  };
  let r = await mk(s => { s.missions = { active: 'map2', done: ['map1', 'junk'], last: 'map1' }; });
  t.ok(r.st.s === '{"active":"map2","done":["map1"],"last":"map1"}', `a saved state loads and drops junk (${r.st.s})`);
  t.ok(!r.pg.errors.length, 'no errors loading it');
  await r.pg.context().close();
  r = await mk(s => { delete s.missions; });
  t.ok(r.st.s === '{"active":null,"done":[],"last":null}', 'an old save without missions starts empty');
  t.ok(!r.pg.errors.length, `no errors loading an old save ${r.pg.errors.join('; ')}`);

  // 8. Not the Champion.
  page = r.pg;
  await pause(page);
  await page.evaluate(() => { window.pokecraft.champion = false; });
  await page.keyboard.press('m');
  await waitFor(page, () => !document.getElementById('missions').classList.contains('hidden'));
  t.ok(await page.evaluate(() => document.getElementById('missions-body').innerText.includes('Become the Champion')), 'M says "Become the Champion to get missions!"');
  t.ok(await page.evaluate(() => document.getElementById('mission-chip').classList.contains('hidden')), 'no chip for a player who is not Champion');
  await page.keyboard.press('Escape');
  const lock = await page.evaluate(async () => {
    const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
    g.badges = GYMS.slice(0, 5).map(x => x.id); g.champion = false;
    const toasts = [];
    const toast = g.ui.toast.bind(g.ui);
    g.ui.toast = text => { toasts.push(text); toast(text); };
    g.talkTo(g.npcs.list.find(n => n.role === 'champion'));
    return { toasts: toasts.join('|'), panel: !document.getElementById('missions').classList.contains('hidden'), battle: g.inBattle };
  });
  t.ok(/badges/.test(lock.toasts) && !lock.panel && !lock.battle, `the tower still wants all badges ("${lock.toasts}")`);
  await page.context().close();

  // 9. iPad.
  page = await openGame(browser, base, { contextOptions: { ...devices['iPad (gen 7) landscape'], viewport: { width: 1024, height: 768 } } });
  await page.tap('text=New Game');
  await page.tap('.starter >> nth=0');
  await page.waitForTimeout(1500);
  await champ(page);
  await page.evaluate(() => { const g = window.pokecraft; g.missions.give(); g.missions.update(0.3); document.exitPointerLock(); });
  await waitFor(page, () => !document.getElementById('mission-chip').classList.contains('hidden'));
  const chipBox = await page.evaluate(() => { const r = document.getElementById('mission-chip').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.height]; });
  await page.touchscreen.tap(chipBox[0], chipBox[1]);
  await waitFor(page, () => !document.getElementById('missions').classList.contains('hidden'));
  const heights = await page.evaluate(() => [...document.querySelectorAll('#missions button')].map(b => [b.textContent, Math.round(b.getBoundingClientRect().height)]));
  t.ok(heights.length >= 2 && heights.every(h => h[1] >= 48), `every panel button is at least 48 px high (${JSON.stringify(heights)})`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 't29-panel-ipad.png'), timeout: 120000 });
  const fits = await page.evaluate(() => { const p = document.querySelector('#missions .panel'); return p.scrollWidth <= p.clientWidth + 1; });
  t.ok(fits, 'the panel fits the iPad width without sideways scrolling');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
