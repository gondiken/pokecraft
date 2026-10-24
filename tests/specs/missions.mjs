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
      nextNone: M.nextMission({ done: M.MISSIONS.map(m => m.id), last: 'map1' }, null, 22)?.id, // T38c: the maker takes over
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
  t.ok(d.empty === '{"active":null,"done":[],"last":null,"next":13,"gen":0,"seed":null,"spec":null}', `no save gives an empty state (${d.empty})`);
  t.ok(d.junk === '{"active":null,"done":["map1"],"last":null,"next":13,"gen":0,"seed":null,"spec":null}', `junk is dropped (${d.junk})`);
  t.ok(d.doneActive === '{"active":null,"done":["map1"],"last":null,"next":13,"gen":0,"seed":null,"spec":null}' && d.goodActive === '{"active":"map2","done":["map1"],"last":"map1","next":13,"gen":0,"seed":null,"spec":null}', 'an active mission that is done is dropped; good saves stay');
  t.ok(d.next0 === 'map1' && d.nextWrap === 'map1' && d.nextSkip === 'map2' && d.nextNone === 'gen:13', `next mission: first, wraps round, skips, the maker after the 12 (${d.next0}/${d.nextWrap}/${d.nextSkip})`);
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
  t.ok(sw3.afterBridge === 'map3' && sw3.given === 'map3' && sw3.wrap === 'gen:13', `after the bridge comes map 3, and with only a giant left the maker's mission comes first (T38c) (${sw3.afterBridge}/${sw3.wrap})`);
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
  t.ok(r.st.s === '{"active":"map2","done":["map1"],"last":"map1","next":13,"gen":0,"seed":null,"spec":null}', `a saved state loads and drops junk (${r.st.s})`);
  t.ok(!r.pg.errors.length, 'no errors loading it');
  await r.pg.context().close();
  r = await mk(s => { delete s.missions; });
  t.ok(r.st.s === '{"active":null,"done":[],"last":null,"next":13,"gen":0,"seed":null,"spec":null}', 'an old save without missions starts empty');
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

  // 10. T38c: missions that never end (the maker, the save, the new kinds, treasure spots 6+, the realm pause).
  const OLD12 = ['map1', 'lamptower', 'map2', 'giant1', 'bridge', 'map3', 'rainbow', 'giant2', 'map4', 'startower', 'map5', 'giant3'];
  const genDump = pg => pg.evaluate(async () => {
    const G = await import('/src/missiongen.js');
    const { SPECIES, SPAWNS } = await import('/src/species.js');
    const { GYMS } = await import('/src/gyms.js');
    const { BOSSES } = await import('/src/coopboss.js');
    const { BUILD_TEMPLATES, makeBuild } = await import('/src/buildcheck.js');
    const { checkAll } = await import('/src/features.js');
    const lists = {};
    for (const seed of [22, 4242]) { lists[seed] = []; for (let n = 13; n < 13 + 6 * 20; n++) lists[seed].push(G.makeMission(n, seed)); }
    const pools = { catchOk: true, rematchOk: true, buildOk: true, bossOk: true, cleanOk: true, bad: [] };
    for (const type of G.CATCH_TYPES) {
      const ids = new Set();
      for (const list of Object.values(SPAWNS)) for (const [id, , cond] of list) if (SPECIES[id]?.type === type && (cond == null || cond === 'day' || cond === 'night')) ids.add(id);
      if (ids.size < 2) { pools.catchOk = false; pools.bad.push(type); }
    }
    for (const [id, name] of Object.entries(G.REMATCH_GYMS)) {
      const d = GYMS.find(g => g.id === id);
      if (!d || d.night || d.place || d.realm || d.name !== name) { pools.rematchOk = false; pools.bad.push(id); }
    }
    for (const t of Object.keys(BUILD_TEMPLATES)) for (let round = 1; round <= 12; round += 3) {
      let k = 0; const rand = () => ((k += 0.3173) % 1);
      const spec = { t, ...BUILD_TEMPLATES[t].pick(rand, round) };
      const b = makeBuild(spec), r = checkAll(b.features, { ok: true, counts: {}, stats: {} });
      if (!BUILD_TEMPLATES[t].ok(spec) || typeof b.text !== 'string' || !b.example.length || r.need !== b.features.length) { pools.buildOk = false; pools.bad.push(t); }
    }
    for (const [id, [species, name]] of Object.entries(G.GIANT_INFO)) if (BOSSES[id]?.species !== species || name !== `Giant ${SPECIES[species].name}`) pools.bossOk = false;
    for (const l of Object.values(lists)) for (const m of l) if (JSON.stringify(G.cleanSpec(JSON.parse(JSON.stringify(m)), m.n)) !== JSON.stringify(m)) pools.cleanOk = false;
    return { lists, pools };
  });
  let pg1 = await openGame(browser, base);
  const g1 = await genDump(pg1);
  const ld = await pg1.evaluate(async () => {
    const M = await import('/src/missions.js'), G = await import('/src/missiongen.js');
    const spec = G.makeMission(15, 22);
    const good = M.loadMissions({ active: 'gen:15', done: ['map1'], last: 'map1', next: 15, gen: 2, seed: 22, spec });
    return {
      good: JSON.stringify(good) === JSON.stringify({ active: 'gen:15', done: ['map1'], last: 'map1', next: 15, gen: 2, seed: 22, spec }),
      junk: JSON.stringify(M.loadMissions({ active: 'map1', done: [], last: null, next: -3, gen: 'x', seed: 'q', spec: { kind: 'zzz' } })),
      badSpec: M.loadMissions({ active: 'gen:15', next: 15, seed: 22, spec: { id: 'gen:15', n: 15, kind: 'zzz', name: 'x' } }).spec?.id,
      noSeed: M.loadMissions({ active: 'gen:15', next: 15, spec: { kind: 'zzz' } }).active,
      wrongN: M.loadMissions({ active: 'gen:7', next: 13, seed: 22 }).active,
      lastGen: M.loadMissions({ last: 'gen:14', next: 15 }).last,
      lastFuture: M.loadMissions({ last: 'gen:40', next: 15 }).last,
      of: M.missionOf({ active: null, seed: 22, spec: null }, 'gen:15')?.id,
      ofNoSeed: M.missionOf({ active: null, seed: null, spec: null }, 'gen:15'),
    };
  });
  await pg1.context().close();
  const pg2 = await openGame(browser, base);
  const g2 = await genDump(pg2);
  await pg2.context().close();
  t.ok(JSON.stringify(g1.lists) === JSON.stringify(g2.lists), 'the mission maker gives the same 120 missions for a seed on a second, fresh page');
  t.ok(JSON.stringify(g1.lists[22]) !== JSON.stringify(g1.lists[4242]), 'two seeds give different missions');
  for (const seed of [22, 4242]) {
    const l = g1.lists[seed];
    let rounds = true, giants = true, order = true;
    const ks = new Set();
    for (let r = 1; r <= 20; r++) {
      const round = l.slice((r - 1) * 6, r * 6), kinds = round.map(m => m.kind);
      const first = kinds.slice(0, 5).sort().join(), want = (r % 2 === 0 ? ['build', 'catch', 'map', 'map', 'rematch'] : ['build', 'build', 'catch', 'map', 'map']).join();
      if (first !== want) rounds = false;
      if (kinds[5] !== 'boss' || round[5].boss !== ['giant1', 'giant2', 'giant3'][(r - 1) % 3] || round[5].grow !== r) giants = false;
      if (round.some((m, i) => m.round !== r || m.pos !== i + 1 || m.n !== 12 + (r - 1) * 6 + i + 1)) order = false;
      for (const m of round) if (m.kind === 'map') ks.add(m.k);
    }
    t.ok(rounds && order, `seed ${seed}: every round is map x2, build, catch, rematch or build, then the giant`);
    t.ok(giants, `seed ${seed}: the giants cycle giant1-3 and grow by one each round`);
    t.ok(ks.size === 24 && Math.min(...ks) === 5 && Math.max(...ks) === 28, `seed ${seed}: the maps use treasure spots 5..28 (${ks.size} different)`);
    const types = l.filter(m => m.kind === 'catch').map(m => m.type);
    t.ok(types.every((x, i) => i === 0 || x !== types[i - 1]), `seed ${seed}: no catch type twice in a row`);
    const builds = l.filter(m => m.kind === 'build').map(m => m.build.t);
    t.ok(builds.length > 25 && new Set(builds).size >= 4, `seed ${seed}: builds use several templates (${[...new Set(builds)].join()})`);
  }
  t.ok(g1.pools.catchOk && g1.pools.rematchOk && g1.pools.buildOk && g1.pools.bossOk && g1.pools.cleanOk, `the pools are valid: catch types live in the main world, rematch gyms are open all day, builds are checkable (${g1.pools.bad.join()})`);
  t.ok(ld.good && ld.junk === '{"active":"map1","done":[],"last":null,"next":13,"gen":0,"seed":null,"spec":null}', 'loadMissions keeps next / gen / seed / spec and drops junk');
  t.ok(ld.badSpec === 'gen:15' && ld.noSeed === null && ld.wrongN === null, `a bad spec is made again from the seed; no seed or the wrong number drops the active one (${ld.badSpec}/${ld.noSeed}/${ld.wrongN})`);
  t.ok(ld.lastGen === 'gen:14' && ld.lastFuture === null && ld.of === 'gen:15' && ld.ofNoSeed === null, 'missionOf and a generated "last" load as expected');

  // The old save at mission 12 goes on with mission 13, on this device and after a reload.
  const withMissions = missions => ({ ...base1, missions });
  let og = await openGame(browser, base, { setup: seedSave(withMissions({ active: 'giant3', done: OLD12.slice(0, 11), last: 'giant3' })) });
  await continueGame(og);
  await champ(og);
  await pause(og);
  await og.evaluate(() => window.pokecraft.openMissions('view'));
  await waitFor(og, () => !document.getElementById('missions').classList.contains('hidden'));
  t.ok(await og.evaluate(() => /Mission 12/.test(document.getElementById('missions-body').innerText) && /11 done/.test(document.getElementById('missions-body').innerText)), 'an old save with 11 done and the third giant shows "Mission 12 / 11 done"');
  const c1 = await og.evaluate(async () => {
    const g = window.pokecraft, M = await import('/src/missions.js');
    g.missions.complete(g.missions.active);
    const toasts = document.getElementById('toast').innerText;
    const n = g.missions.next();
    const out = { next: n.id, number: g.missions.number, done: g.missionState.done.length, gen: g.missionState.gen, toasts, seedBefore: g.missionState.seed };
    g.missions.give();
    const s = g.missionState;
    out.active = s.active; out.seed = s.seed; out.worldSeed = g.world.seed; out.spec = s.spec && s.spec.id; out.nextNo = s.next; out.kind = g.missions.active.kind;
    out.panel = g.missions.active && M.missionOf(s, s.active).id;
    return out;
  });
  t.ok(c1.next === 'gen:13' && c1.number === 13 && c1.done === 12 && c1.gen === 0 && c1.seedBefore === null, `after the 12th mission the maker offers gen:13 (${JSON.stringify([c1.next, c1.number])})`);
  t.ok(/all of Champion Solenne's missions/.test(c1.toasts), 'the 12th mission says she has more');
  t.ok(c1.active === 'gen:13' && c1.seed === c1.worldSeed && c1.spec === 'gen:13' && c1.panel === 'gen:13', 'give() stores the own world seed and the spec');
  const saved13 = await og.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  const spec13 = await og.evaluate(() => JSON.stringify(window.pokecraft.missionState.spec));
  await og.context().close();
  og = await openGame(browser, base, { setup: seedSave(saved13) });
  await continueGame(og);
  await champ(og);
  await pause(og);
  await og.evaluate(() => window.pokecraft.openMissions('view'));
  await waitFor(og, () => !document.getElementById('missions').classList.contains('hidden'));
  const re = await og.evaluate(() => ({ active: window.pokecraft.missionState.active, spec: JSON.stringify(window.pokecraft.missionState.spec), text: document.getElementById('missions-body').innerText }));
  t.ok(re.active === 'gen:13' && re.spec === spec13 && /Mission 13/.test(re.text) && /Round 1 · mission 1 of 6/.test(re.text), 'after a reload the same generated mission is active ("Mission 13", round line)');

  // Solo unlock, swap past 12, completing.
  const sol = await og.evaluate(async () => {
    const g = window.pokecraft, s = g.missionState;
    const OLD = ['map1', 'lamptower', 'map2', 'giant1', 'bridge', 'map3', 'rainbow', 'giant2', 'map4', 'startower', 'map5', 'giant3'];
    Object.assign(s, { done: OLD.filter(id => !id.startsWith('giant')), active: null, last: 'map5', next: 13, gen: 0, seed: null, spec: null });
    g.missions.give();
    const a = s.active;
    g.missions.swap();
    const b = s.active, nb = s.next;
    g.missions.swap();
    return { a, b, nb, c: s.active, nc: s.next, done: s.done.length };
  });
  t.ok(sol.a === 'gen:13' && sol.b === 'giant1' && sol.nb === 14 && sol.c === 'gen:14' && sol.nc === 14, `a player with only the giants left gets the maker's missions (${JSON.stringify(sol)})`);
  const past = await og.evaluate(async () => {
    const g = window.pokecraft, s = g.missionState, G = await import('/src/missiongen.js');
    const OLD = ['map1', 'lamptower', 'map2', 'giant1', 'bridge', 'map3', 'rainbow', 'giant2', 'map4', 'startower', 'map5', 'giant3'];
    Object.assign(s, { done: OLD.slice(), active: 'gen:15', last: 'gen:14', next: 15, gen: 2, seed: g.world.seed, spec: G.makeMission(15, g.world.seed) });
    g.missions.swap();
    const a = { active: s.active, done: s.done.length, gen: s.gen, next: s.next, spec: s.spec?.id };
    g.missions.complete(g.missions.active);
    return { a, gen: s.gen, next: s.next, active: s.active, number: g.missions.number };
  });
  t.ok(past.a.active === 'gen:16' && past.a.done === 12 && past.a.gen === 2 && past.a.next === 16 && past.a.spec === 'gen:16', `swap past 12 gives the next number (${JSON.stringify(past.a)})`);
  t.ok(past.gen === 3 && past.next === 17 && past.active === null && past.number === 16, `completing a generated mission counts it (${JSON.stringify(past)})`);

  // New kinds: catch and rematch, and the realm pause.
  const kinds = await og.evaluate(async () => {
    const g = window.pokecraft, s = g.missionState, G = await import('/src/missiongen.js');
    const { SPECIES } = await import('/src/species.js');
    const { GYMS } = await import('/src/gyms.js');
    const seed = g.world.seed;
    const find = (kind, ok = () => true) => { for (let n = 13; n < 400; n++) { const m = G.makeMission(n, seed); if (m.kind === kind && ok(m)) return m; } };
    const set = m => { Object.assign(s, { done: ['map1'], gen: 0, active: m.id, last: m.id, next: m.n, seed, spec: m }); g.missions.hint = g.missions.report = g.missions.result = null; };
    const out = {};
    const c = find('catch');
    set(c);
    const other = Object.keys(SPECIES).find(id => SPECIES[id].type !== c.type && !SPECIES[id].legendary);
    const mine = Object.keys(SPECIES).find(id => SPECIES[id].type === c.type);
    g.missions.caught({ species: other });
    out.wrongStill = s.active === c.id;
    const before = { cubes: g.cubes, stars: g.blockCounts[75] || 0 };
    g.missions.caught({ species: mine });
    out.catchDone = s.active === null && s.gen === 1;
    out.catchReward = [g.cubes - before.cubes, (g.blockCounts[75] || 0) - before.stars];
    out.catchChip = c.name;
    const rm = find('rematch');
    set(rm);
    const otherGym = GYMS.find(x => x.id !== rm.gym && x.id !== 'cozy');
    g.missions.rematchWon(otherGym.id);
    out.rmWrongStill = s.active === rm.id;
    const def = GYMS.find(x => x.id === rm.gym);
    const cubes = g.cubes, bricks = g.blockCounts[76] || 0;
    g.rematch.won({ name: 'Leader', gym: { def } }, {});
    out.rmDone = s.active === null;
    out.rmReward = [g.cubes - cubes, (g.blockCounts[76] || 0) - bricks];
    // the realm pause: a map and a build stay put in a realm
    const mp = find('map'), bd = find('build');
    const realm = {};
    for (const m of [mp, bd]) {
      set(m);
      const was = g.world.realm;
      g.world.realm = { id: 'dream' };
      g.missions.update(0.3);
      const chip = document.getElementById('mission-chip').textContent;
      const res = g.missions.check();
      g.world.realm = was;
      realm[m.kind] = { chip, res, active: s.active === m.id, hint: g.missions.hint };
    }
    out.realm = realm;
    return out;
  });
  t.ok(kinds.wrongStill && kinds.catchDone, 'a catch mission finishes only when a creature of its type is caught');
  t.ok(kinds.catchReward[0] === 8 && kinds.catchReward[1] === 2, `a catch mission pays 8 cubes and 2 Star Blocks (${kinds.catchReward})`);
  t.ok(kinds.rmWrongStill && kinds.rmDone && kinds.rmReward[1] === 2 && kinds.rmReward[0] >= 5, `a rematch mission finishes only when its own gym is beaten again (${kinds.rmReward})`);
  t.ok(['map', 'build'].every(k => kinds.realm[k].active && /back home first/.test(kinds.realm[k].chip) && kinds.realm[k].hint === null && kinds.realm[k].res === null), `in a realm a map and a build wait: "${kinds.realm.map.chip}" / "${kinds.realm.build.chip}"`);

  // Treasure spots 6+.
  const more = await og.evaluate(async () => {
    const { World, WATER_LEVEL, MID_X, MID_Z } = await import('/src/world.js');
    const { treasureSpots, moreTreasureSpots, MORE_RULES, MORE_W, MORE_D } = await import('/src/treasuremap.js');
    const out = [];
    const box = (x, z, b) => Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1, 0);
    for (const seed of [22, 4242]) {
      const w = new World(seed, null, null); w.generate();
      const old = JSON.stringify(treasureSpots(w).map(p => [p.x, p.z]));
      const t0 = performance.now();
      const m = moreTreasureSpots(w);
      const ms = performance.now() - t0;
      const boxes = [...w.gyms, w.tower].flatMap(g => g.protect || []);
      const r = { seed, n: m.length, ms: Math.round(ms), old, same: old === JSON.stringify(treasureSpots(w).map(p => [p.x, p.z])), land: true, free: true, slots: true, olds: true, spread: true, inside: true, relaxed: m.filter(p => p.relaxed).length, ks: m.map(p => p.k).join() };
      const olds = treasureSpots(w);
      m.forEach((p, i) => {
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (w.ground[(p.x + a) + (p.z + b) * w.W] <= WATER_LEVEL) r.land = false;
        if (boxes.some(b => box(p.x, p.z, b) <= (p.relaxed ? 8 : MORE_RULES.gap))) r.free = false;
        if (w.gymSlots().some(sl => box(p.x, p.z, sl.box) <= MORE_RULES.slot)) r.slots = false;
        if (olds.some(o => Math.max(Math.abs(p.x - o.x), Math.abs(p.z - o.z)) < (p.relaxed ? 12 : MORE_RULES.old))) r.olds = false;
        for (let j = 0; j < i; j++) if (Math.max(Math.abs(p.x - m[j].x), Math.abs(p.z - m[j].z)) < (p.relaxed ? 14 : MORE_RULES.spread)) r.spread = false;
        if (p.x < 0 || p.z < 0 || p.x >= MORE_W || p.z >= MORE_D || Math.max(Math.abs(p.x - MID_X), Math.abs(p.z - MID_Z)) < MORE_RULES.start) r.inside = false;
      });
      const again = JSON.stringify(m.map(p => [p.x, p.z]));
      w.moreSpots = null;
      r.det = again === JSON.stringify(moreTreasureSpots(w).map(p => [p.x, p.z]));
      let threw = false;
      w.realm = { id: 'dream' }; w.moreSpots = null;
      try { moreTreasureSpots(w); } catch { threw = true; }
      r.realmThrows = threw;
      out.push(r);
    }
    return out;
  });
  for (const r of more) {
    t.ok(r.n === 24 && r.ks === Array.from({ length: 24 }, (_, i) => 5 + i).join(), `seed ${r.seed}: 24 more spots, k 5..28 (${r.n})`);
    t.ok(r.same && r.land && r.free && r.slots && r.olds && r.spread && r.inside && r.det, `seed ${r.seed}: the old five did not move; the new ones are on dry land, clear of every protected box and gym slot, away from the old ones and each other, and the same again (${r.relaxed} relaxed)`);
    t.ok(r.realmThrows, `seed ${r.seed}: no extra spots inside a realm`);
    console.log(`  timing: first moreTreasureSpots call for seed ${r.seed}: ${r.ms} ms (software rendering)`);
    t.ok(r.ms < 400, `seed ${r.seed}: the first moreTreasureSpots call is fast (${r.ms} ms)`);
  }
  // Play one: dig at spot k = 5.
  const played = await og.evaluate(async () => {
    const g = window.pokecraft, s = g.missionState, G = await import('/src/missiongen.js');
    const { spotOf } = await import('/src/treasuremap.js');
    const seed = g.world.seed;
    let m; for (let n = 13; n < 400 && !m; n++) { const x = G.makeMission(n, seed); if (x.kind === 'map' && x.k === 5) m = x; }
    Object.assign(s, { done: ['map1'], active: m.id, last: m.id, next: m.n, seed, spec: m });
    const spot = spotOf(g.world, 5), stars = g.blockCounts[75] || 0, cubes = g.cubes;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const dy of [0, -1]) g.world.set(spot.x + a, spot.g + dy, spot.z + b, 0);
    g.player.pos.set(spot.x + 0.5, spot.g - 1, spot.z + 0.5); g.player.vel.set(0, 0, 0); g.player.onGround = true;
    g.missions.update(0.3);
    return { id: m.id, active: s.active, gen: s.gen, stars: (g.blockCounts[75] || 0) - stars, cubes: g.cubes - cubes };
  });
  t.ok(played.active === null && played.stars === 4 && played.cubes === 5 && played.gen >= 1, `digging at spot 5 finishes a generated map: 4 Star Blocks, 5 cubes (${JSON.stringify(played)})`);
  t.ok(!og.errors.length, `no page errors ${og.errors.join('; ')}`);
  await og.context().close();

  // The panel on an iPad: counter, round line, catch card.
  page = await openGame(browser, base, { contextOptions: { ...devices['iPad (gen 7) landscape'], viewport: { width: 1024, height: 768 } } });
  await page.tap('text=New Game');
  await page.tap('.starter >> nth=0');
  await page.waitForTimeout(1500);
  await champ(page);
  await page.evaluate(async () => {
    const g = window.pokecraft, s = g.missionState, G = await import('/src/missiongen.js');
    const seed = g.world.seed;
    let m; for (let n = 13; n < 400 && !m; n++) { const x = G.makeMission(n, seed); if (x.kind === 'catch') m = x; }
    Object.assign(s, { done: ['map1', 'lamptower'], gen: 5, active: m.id, last: m.id, next: m.n, seed, spec: m });
    g.missions.update(0.3); document.exitPointerLock();
  });
  await waitFor(page, () => !document.getElementById('mission-chip').classList.contains('hidden'));
  const chipBox2 = await page.evaluate(() => { const r = document.getElementById('mission-chip').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(chipBox2[0], chipBox2[1]);
  await waitFor(page, () => !document.getElementById('missions').classList.contains('hidden'));
  await page.waitForTimeout(400);
  const ipad = await page.evaluate(() => {
    const p = document.querySelector('#missions .panel');
    return { text: document.getElementById('missions-body').innerText, fits: p.scrollWidth <= p.clientWidth + 1, small: [...document.querySelectorAll('#missions button')].filter(b => b.getBoundingClientRect().height < 48).map(b => b.textContent) };
  });
  t.ok(/Mission 8/.test(ipad.text) && /7 done/.test(ipad.text) && /Round 1 · mission \d of 6/.test(ipad.text) && /Look in:/.test(ipad.text) && /Catch/.test(ipad.text), `the panel shows the counter, the round line and the catch card ("${ipad.text.replace(/\n+/g, ' | ').slice(0, 200)}")`);
  t.ok(ipad.fits && !ipad.small.length, `the new panel fits the iPad and its buttons are big enough (${ipad.small.join()})`);
  await page.screenshot({ path: path.join(SHOTS, 't38c-mission-panel.png'), timeout: 120000 });
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
