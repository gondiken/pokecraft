// T22: homes (logic). The room finder's rules, the example houses, re-checks on edits, Doormats (place, move, break,
// orphan), home visitors (indoor walking, underground), a test-only home type, save/load and two browsers.
import { openGame, openPair, newGame, pause, click, continueGame, waitFor, seedSave } from '../helpers.mjs';

// Shared page helpers, installed on window.__h (a slab at y = 42 with clear air above, houses built from block lists).
const SETUP = async () => {
  const g = window.pokecraft;
  const { B, WOOL } = await import('/src/blocks.js');
  const ht = await import('/src/hometypes.js');
  const s = g.spawnPoint, F = 42;
  // A 32x32 patch near the start that no gym or tower protects (saved edits skip protected cells).
  const free = (x0, z0) => { for (let x = -2; x < 30; x += 3) for (let z = -2; z < 30; z += 3) for (let y = F; y <= F + 13; y += 3) if (g.world.protectedAt(x0 + x, y, z0 + z)) return false; return true; };
  let X0 = Math.floor(s.x) + 6, Z0 = Math.floor(s.z) - 14;
  search: for (let r = 0; r < 120; r += 8) for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
    const x = Math.floor(s.x) + 6 + dx, z = Math.floor(s.z) - 14 + dz;
    if (x > 2 && z > 2 && x < 250 && z < 250 && free(x, z)) { X0 = x; Z0 = z; break search; }
  }
  const put = (x, y, z, id) => { if (g.world.get(x, y, z) !== id) g.world.set(x, y, z, id); };
  const clear = () => {
    for (let x = -2; x < 30; x++) for (let z = -2; z < 30; z++) {
      put(X0 + x, F, Z0 + z, B.STONE);
      for (let y = 1; y <= 12; y++) put(X0 + x, F + y, Z0 + z, B.AIR);
    }
    g.homes.list.length = 0; g.homes.dirty.clear(); g.homes.active = null;
  };
  // A cozy house with a door in the front wall, all five features; mods = [[x, y, z, id], ...] (local) applied after.
  const house = ({ w = 10, d = 10, wall = B.PLANKS, features = ['bed', 'fire', 'rug', 'lamp', 'windows'], door = 1 } = {}, mods = [], ox = 0, oz = 0) => {
    clear();
    const ex = ht.boxHouse({ w, d, wall, corner: wall, roof: B.PLANKS, rim: B.PLANKS, floor: B.PLANKS, door });
    const at = (x, y, z, id) => put(X0 + ox + x, F + y, Z0 + oz + z, id);
    for (const [x, y, z, id] of ex.blocks) at(x, y, z, id);
    const cx = Math.floor(w / 2);
    if (features.includes('bed')) at(1, 1, d - 2, B.BED);
    if (features.includes('fire')) at(cx, 2, d - 1, B.FIREPLACE);
    if (features.includes('rug')) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) at(cx + dx, 0, 4 + dz, WOOL.cozy);
    if (features.includes('lamp')) at(cx, w >= 8 ? 4 : 4, 5, B.LAMP);
    if (features.includes('windows')) { at(0, 2, 5, B.GLASS); at(w - 1, 2, 5, B.GLASS); }
    for (const [x, y, z, id] of mods) at(x, y, z, id);
    return [X0 + ox + ex.mat[0], F, Z0 + oz + ex.mat[2]];
  };
  const report = mat => g.homes.findRoom(...mat);
  const evalCozy = rep => ht.HOME_TYPES.cozy.evaluate(rep);
  window.__h = { g, B, WOOL, ht, X0, Z0, F, put, clear, house, report, evalCozy };
};

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  await newGame(page);
  await pause(page);
  await page.evaluate(SETUP);

  // 1. The examples agree with the rules.
  const ex = await page.evaluate(() => {
    const { g, ht, X0, Z0, F, clear, report } = window.__h;
    const out = {};
    for (const id of Object.keys(ht.HOME_TYPES)) {
      clear();
      const mat = ht.placeExample(g.world, id, X0, F, Z0);
      const rep = report(mat), res = ht.HOME_TYPES[id].evaluate(rep);
      out[id] = { ok: rep.ok, size: rep.size, finished: res.finished, full: res.full, done: res.done, holes: rep.holes.wall.length + rep.holes.roof.length + rep.holes.floor.length };
    }
    return out;
  });
  t.ok(ex.cozy.finished && ex.cozy.full && ex.cozy.done === 5 && ex.cozy.ok && ex.cozy.holes === 0 && ex.cozy.size.join() === '8,8', `the cozy example is a finished, full home ${JSON.stringify(ex.cozy)}`);
  t.ok(ex.treasure.finished && ex.treasure.ok, `the treasure example is a finished home ${JSON.stringify(ex.treasure)}`);

  // 2. Rules, one house each.
  const R = await page.evaluate(() => {
    const { B, WOOL, ht, house, report, evalCozy, X0, F, Z0, g } = window.__h;
    const A = B.AIR;
    const run = (opts, mods) => { const rep = report(house(opts, mods)); return { rep, res: evalCozy(rep) }; };
    const o = {};
    const good = run({}); o.good = { ok: good.rep.ok, done: good.res.done, finished: good.res.finished, full: good.res.full, door: JSON.stringify(good.rep.door), runs: good.rep.doorRuns };
    const small = run({ w: 8, d: 8 }); o.small = { size: small.rep.size, c: small.rep.checks.size, ok: small.rep.ok };
    const roof = run({}, [[3, 4, 4, A], [3, 4, 5, A]]); o.roof = { c: roof.rep.checks.roof, holes: roof.rep.holes.roof.map(h => h.join()).sort().join('|'), want: [[X0 + 3, F + 4, Z0 + 4], [X0 + 3, F + 4, Z0 + 5]].map(h => h.join()).sort().join('|'), ok: roof.rep.ok };
    const nodoor = run({}, [[4, 1, 0, B.PLANKS], [4, 2, 0, B.PLANKS]]); o.nodoor = { runs: nodoor.rep.doorRuns, walls: nodoor.rep.checks.walls, door: nodoor.rep.door };
    const two = run({}, [[7, 1, 0, A], [7, 2, 0, A]]); o.two = { runs: two.rep.doorRuns, door: JSON.stringify(two.rep.door), want: JSON.stringify([[X0 + 4, Z0]]), holes: two.rep.holes.wall.map(h => h.join()).sort().join('|'), want2: [[X0 + 7, F + 1, Z0], [X0 + 7, F + 2, Z0]].map(h => h.join()).sort().join('|'), walls: two.rep.checks.walls };
    const wide = run({}, [[3, 1, 0, A], [3, 2, 0, A], [5, 1, 0, A], [5, 2, 0, A]]); o.wide = { door: wide.rep.door, walls: wide.rep.checks.walls, holes: wide.rep.holes.wall.length, runs: wide.rep.doorRuns };
    const top = run({}, [[6, 3, 0, A]]); o.top = { plug: top.rep.holes.wall.map(h => h.join()).join('|'), want: [X0 + 6, F + 3, Z0].join(), walls: top.rep.checks.walls, esc: top.rep.escaped };
    const corner = run({}, [[0, 1, 0, A], [0, 2, 0, A], [0, 3, 0, A]]); o.corner = { holes: corner.rep.holes.wall.length, walls: corner.rep.checks.walls, esc: corner.rep.escaped };
    const lint = run({}, [[4, 3, 0, A]]); o.lintel = { holes: lint.rep.holes.wall.map(h => h.join()).join('|'), want: [X0 + 4, F + 3, Z0].join(), door: JSON.stringify(lint.rep.door) };
    const floor = run({}, [[6, 0, 6, A]]); o.floor = { c: floor.rep.checks.floor, holes: floor.rep.holes.floor.length };
    const big = run({ w: 24, d: 24 }); o.big = { esc: big.rep.escaped, size: big.rep.size, c: JSON.stringify(big.rep.checks), ok: big.rep.ok };
    const doorway = run({}, [[4, 0, 1, B.PLANKS], [4, 0, 0, B.DOORMAT]]); o.doorway = { ok: doorway.rep.ok, finished: doorway.res.finished };
    // the mat of the doorway house is the doorway cell
    // stairs against a wall with air under the steps: the step at floor+3 has open space below it, which is part of the room
    const stairs = run({}, [[8, 1, 3, B.PLANKS], [8, 2, 4, B.PLANKS], [8, 3, 5, B.PLANKS], [7, 3, 5, B.PLANKS]]);
    o.stairs = { ok: stairs.rep.ok, holes: stairs.rep.holes.wall.length, runs: stairs.rep.doorRuns, size: stairs.rep.size.join() };
    const fur = run({}, [[6, 1, 6, B.BED], [7, 1, 6, B.FIREPLACE], [6, 1, 7, B.LAMP], [7, 1, 7, B.COBBLE], [7, 2, 7, B.COBBLE]]); o.furniture = { ok: fur.rep.ok, finished: fur.res.finished };
    const stone = run({ wall: B.STONE_BRICKS }); o.stone = { rule: stone.res.rule.done, finished: stone.res.finished, done: stone.res.done };
    const two5 = run({ features: ['bed', 'lamp'] }); o.two5 = { done: two5.res.done, finished: two5.res.finished };
    const three5 = run({ features: ['bed', 'lamp', 'fire'] }); o.three5 = { done: three5.res.done, finished: three5.res.finished, full: three5.res.full };
    // treasure: 12 gems in the example; take 3 away for 9, then put one back
    const tmat = ht.placeExample(g.world, 'treasure', X0, F, Z0 + 0);
    const gem = (x, y, z) => g.world.get(X0 + x, F + y, Z0 + z);
    const gems = ht.HOME_TYPES.treasure.example.blocks.filter(b => b[4] === 'gems');
    for (const [x, y, z] of gems.slice(0, 3)) g.world.set(X0 + x, F + y, Z0 + z, B.STONE_BRICKS);
    const t9 = ht.HOME_TYPES.treasure.evaluate(report(tmat));
    const [x, y, z, id] = gems[0]; g.world.set(X0 + x, F + y, Z0 + z, id);
    const t10 = ht.HOME_TYPES.treasure.evaluate(report(tmat));
    o.treasure = { nine: `${t9.features[0].have}/${t9.features[0].need} ${t9.finished}`, ten: `${t10.features[0].have}/${t10.features[0].need} ${t10.finished}` };
    return o;
  });
  t.ok(R.good.ok && R.good.done === 5 && R.good.finished && R.good.full && R.good.runs === 1, `a good cozy house is finished and full ${JSON.stringify(R.good)}`);
  t.ok(R.small.c === 'small' && R.small.size.join() === '6,6' && !R.small.ok, `too small: 6x6 inside is 'small' ${JSON.stringify(R.small)}`);
  t.ok(R.roof.c === false && R.roof.holes === R.roof.want && !R.roof.ok, `open roof: exactly the 2 missing blocks are roof holes ${JSON.stringify(R.roof)}`);
  t.ok(R.nodoor.runs === 0 && R.nodoor.walls === false && R.nodoor.door === null, `no door: no door run, walls not ok ${JSON.stringify(R.nodoor)}`);
  t.ok(R.two.runs === 2 && R.two.door === R.two.want && R.two.holes === R.two.want2 && R.two.walls === false, `two gaps: the nearest is the door, the other 2 cells are holes ${JSON.stringify(R.two)}`);
  t.ok(R.wide.door === null && R.wide.walls === false && R.wide.holes === 6 && R.wide.runs === 1, `a 3-wide door is a gap ${JSON.stringify(R.wide)}`);
  t.ok(R.top.plug === R.top.want && R.top.walls === false && !R.top.esc, `a missing wall top is plugged and glows ${JSON.stringify(R.top)}`);
  t.ok(R.corner.holes === 3 && R.corner.walls === false && !R.corner.esc, `a missing corner shows 3 holes ${JSON.stringify(R.corner)}`);
  t.ok(R.lintel.holes === R.lintel.want && R.lintel.door !== 'null', `no lintel: the plug at floor+3 is the only wall hole ${JSON.stringify(R.lintel)}`);
  t.ok(R.floor.c === false && R.floor.holes === 1, `a floor hole is found ${JSON.stringify(R.floor)}`);
  t.ok(R.big.esc && R.big.size === null && R.big.ok === false && JSON.parse(R.big.c).roof === null, `24x24 is too big: escaped, size unknown ${JSON.stringify(R.big)}`);
  t.ok(R.doorway.ok && R.doorway.finished, `a mat in the doorway works ${JSON.stringify(R.doorway)}`);
  t.ok(R.stairs.ok && R.stairs.holes === 0 && R.stairs.runs === 1 && R.stairs.size === '8,8', `stairs with air under the steps are not wall holes ${JSON.stringify(R.stairs)}`);
  t.ok(R.furniture.ok && R.furniture.finished, `furniture does not break the room ${JSON.stringify(R.furniture)}`);
  t.ok(R.stone.rule === false && !R.stone.finished && R.stone.done === 5, `stone walls: the wood rule fails ${JSON.stringify(R.stone)}`);
  t.ok(R.two5.done === 2 && !R.two5.finished && R.three5.done === 3 && R.three5.finished && !R.three5.full, `2 of 5 is not enough, 3 of 5 is finished but not full ${JSON.stringify([R.two5, R.three5])}`);
  t.ok(R.treasure.nine === '9/10 false' && R.treasure.ten === '10/10 true', `treasure: 9 gems no, 10 gems yes ${JSON.stringify(R.treasure)}`);

  // 3. Doormats and re-checks, with a real home.
  const D = await page.evaluate(async () => {
    const { g, B, house, X0, Z0, F, put } = window.__h;
    const toasts = [];
    const toast = g.ui.toast.bind(g.ui);
    g.ui.toast = s => { toasts.push(s); toast(s); };
    const o = {};
    g.player.pos.set(X0 + 4.5, F + 1, Z0 + 3.5);
    const mat = house();
    g.homes.place(...mat);
    g.homes.choose(g.homes.at(...mat), 'cozy');
    const hearts = () => g.homes.mine().result.done;
    o.start = `${hearts()} ${g.homes.mine().finished} ready=${g.homes.ready().length}`;
    // re-check timing
    let c0 = g.homes.checks;
    g.homes.update(3, g.player.pos);
    o.idle = g.homes.checks - c0;
    put(X0 + 60, F, Z0, B.STONE); // far away: not in the box
    g.homes.update(1, g.player.pos);
    o.far = g.homes.checks - c0;
    c0 = g.homes.checks;
    put(X0 + 1, F + 1, Z0 + 8, B.AIR); // the bed
    g.homes.update(1, g.player.pos);
    o.bed = `${hearts()} ${g.homes.checks - c0}`;
    put(X0 + 1, F + 1, Z0 + 8, B.BED);
    g.homes.update(1, g.player.pos);
    o.bedBack = hearts();
    // moving the Doormat
    const mat2 = [X0 + 20, F, Z0 + 3];
    put(...mat2, B.DOORMAT);
    g.homes.place(...mat2);
    o.moved = `${g.homes.list.filter(h => h.owner === g.playerId).length} old=${g.world.get(...mat) === B.PLANKS} at=${g.homes.mine().x === mat2[0]}`;
    o.movedToast = toasts.includes('Your home moved here!');
    // breaking it removes the home
    put(...mat2, B.AIR);
    o.removed = `${g.homes.list.length} ${toasts.some(s => s.startsWith('No doormat'))}`;
    // an orphan mat: standing on it opens the chooser, choosing claims it
    const orphan = [X0 + 24, F, Z0 + 3];
    put(...orphan, B.DOORMAT);
    o.orphanAsks = g.homes.stand(...orphan, B.DOORMAT);
    o.orphanTarget = JSON.stringify(g.homes.chooseTarget()) === JSON.stringify(orphan);
    g.homes.choose(g.homes.chooseTarget(), 'treasure');
    o.claimed = `${g.homes.mine()?.x === orphan[0]} ${g.homes.mine()?.type}`;
    o.otherChoose = g.homes.choose(g.homes.mine(), 'nonsense');
    return o;
  });
  t.ok(D.start === '5 true ready=1', `a placed, chosen home is finished and ready ${D.start}`);
  t.ok(D.idle === 0 && D.far === 0, `no edits (or edits far away) cause no re-checks ${JSON.stringify([D.idle, D.far])}`);
  t.ok(D.bed.startsWith('4 ') && D.bedBack === 5, `breaking the Bed drops a heart, putting it back adds it ${D.bed} ${D.bedBack}`);
  t.ok(D.moved === '1 old=true at=true' && D.movedToast, `placing a second Doormat moves the home, the old mat is Planks ${D.moved}`);
  t.ok(D.removed === '0 true', `breaking the Doormat removes the home and says so ${D.removed}`);
  t.ok(D.orphanAsks && D.orphanTarget && D.claimed === 'true treasure' && D.otherChoose === false, `an orphan mat opens the chooser and is claimed ${JSON.stringify([D.orphanAsks, D.claimed])}`);

  // 4. Visitors: indoor walking, one at a time, leaving, treasure, underground.
  const V = await page.evaluate(async () => {
    const { g, B, house, X0, Z0, F, ht } = window.__h;
    const sr = await import('/src/spawnrules.js');
    const old = { cozy: sr.HOME_SPAWN.cozy.share, treasure: sr.HOME_SPAWN.treasure.share };
    sr.HOME_SPAWN.cozy.share = 1; sr.HOME_SPAWN.treasure.share = 1;
    const o = {};
    const sp = g.spawnPoint;
    const far = { x: X0 + 22, y: F + 1, z: Z0 + 16 };
    const visitors = type => g.creatures.list.filter(w => w.when === `home:${type}`);
    const wait = (type, under = false) => { for (let i = 0; i < 60 && !visitors(type).length; i++) g.creatures.update(0.7, far, sp, false, under); };
    const clean = () => { for (const w of [...g.creatures.list]) g.creatures.remove(w); };
    g.homes.list.length = 0;
    const mat = house();
    g.homes.place(...mat); g.homes.choose(g.homes.at(...mat), 'cozy');
    clean();
    wait('cozy');
    const v = visitors('cozy');
    o.cozy = v.length;
    const free = g.homes.mine().freeCells();
    o.onFree = v.length && free.some(c => c.x === Math.floor(v[0].pos.x) && c.z === Math.floor(v[0].pos.z));
    o.indoor = !!v[0]?.indoor;
    for (let i = 0; i < 40; i++) g.creatures.update(0.7, far, sp, false, false);
    o.one = visitors('cozy').length;
    let maxY = 0, minY = 99, inBox = true;
    for (let i = 0; i < 100; i++) {
      for (const w of g.creatures.list) { w.life = 999; }
      g.creatures.update(0.1, far, sp, false, false);
      for (const w of visitors('cozy')) {
        maxY = Math.max(maxY, w.pos.y); minY = Math.min(minY, w.pos.y);
        if (w.pos.x < X0 - 0.1 || w.pos.x > X0 + 10.1 || w.pos.z < Z0 - 3 || w.pos.z > Z0 + 10.1) inBox = false;
      }
    }
    o.floorY = `${minY.toFixed(2)}..${maxY.toFixed(2)} f=${F + 1} roof=${F + 4}`;
    o.stays = maxY < F + 3 && minY >= F + 0.9 && inBox;
    // not finished any more and the player is away: it leaves
    g.world.set(X0, F + 2, Z0 + 3, B.AIR); // a hole in the wall
    g.homes.update(1, g.player.pos);
    o.unfinished = !g.homes.mine().finished;
    for (let i = 0; i < 40 && visitors('cozy').length; i++) g.creatures.update(0.7, far, sp, false, false);
    o.left = visitors('cozy').length === 0;
    // treasure
    clean();
    const mat2 = ht.placeExample(g.world, 'treasure', X0, F, Z0 + 0);
    g.homes.list.length = 0;
    g.homes.place(...mat2); g.homes.choose(g.homes.at(...mat2), 'treasure');
    o.treasureReady = g.homes.ready().length;
    wait('treasure');
    o.treasure = visitors('treasure').length;
    // underground (the player is under a hill: the cave spawner runs; the home lies under the natural ground)
    clean();
    g.homes.list.length = 0;
    const mat3 = house();
    for (let x = -2; x < 30; x++) for (let z = -2; z < 30; z++) g.world.ground[(X0 + x) + (Z0 + z) * g.world.W] = 90;
    g.homes.place(...mat3); g.homes.choose(g.homes.at(...mat3), 'cozy');
    wait('cozy', true);
    o.underground = visitors('cozy').length;
    for (let i = 0; i < 40; i++) g.creatures.update(0.1, far, sp, false, true);
    o.underStays = visitors('cozy').length === 1;
    // a test-only type works with data alone
    const { HomeType, atLeast, hasBlock, addHomeType, removeHomeType, boxHouse } = ht;
    const ex = boxHouse({ w: 10, d: 10, wall: B.COBBLE, roof: B.COBBLE, floor: B.COBBLE });
    const extra = [];
    for (let i = 0; i < 6; i++) extra.push([1 + i, 2, 9, B.GLASS, 'glass']);
    extra.push([5, 4, 5, B.LAMP, 'lamp']);
    const blocks = [...ex.blocks.filter(b => !extra.some(e => e[0] === b[0] && e[1] === b[1] && e[2] === b[2])), ...extra];
    const type = addHomeType(new HomeType({ id: 'testonly', name: 'Glass home', creature: 'normal',
      features: [atLeast(6, [B.GLASS], { key: 'glass', name: 'Glass', where: ['wall'] }), hasBlock(B.LAMP, { key: 'lamp', name: 'Lamp', where: ['inside', 'roof'] })],
      need: 2, example: { mat: ex.mat, blocks }, spawn: { share: 1 } }));
    const added = [];
    for (const list of Object.values((await import('/src/species.js')).SPAWNS)) { const e = ['fluffin', 1, 'home:testonly']; list.push(e); added.push([list, e]); }
    clean();
    g.homes.list.length = 0;
    const mat4 = ht.placeExample(g.world, type, X0, F, Z0);
    for (let x = -2; x < 30; x++) for (let z = -2; z < 30; z++) g.world.ground[(X0 + x) + (Z0 + z) * g.world.W] = 10;
    g.homes.place(...mat4);
    o.typeCount = Object.keys(ht.HOME_TYPES).length;
    o.chosen = g.homes.choose(g.homes.at(...mat4), 'testonly');
    o.testFinished = g.homes.mine().finished;
    wait('testonly');
    o.testVisitor = visitors('testonly').map(w => w.data.species).join();
    for (const [list, e] of added) list.splice(list.indexOf(e), 1);
    removeHomeType('testonly');
    o.removedType = Object.keys(ht.HOME_TYPES).join();
    clean();
    sr.HOME_SPAWN.cozy.share = old.cozy; sr.HOME_SPAWN.treasure.share = old.treasure;
    return o;
  });
  t.ok(V.cozy === 1 && V.onFree && V.indoor && V.one === 1, `a cozy visitor appears on a free cell inside, never two ${JSON.stringify([V.cozy, V.onFree, V.indoor, V.one])}`);
  t.ok(V.stays, `it walks on the floor and never reaches the roof ${V.floorY}`);
  t.ok(V.unfinished && V.left, `it leaves when the home stops being finished ${JSON.stringify([V.unfinished, V.left])}`);
  t.ok(V.treasureReady === 1 && V.treasure === 1, `a treasure home gets a treasure visitor ${JSON.stringify([V.treasureReady, V.treasure])}`);
  t.ok(V.underground === 1 && V.underStays, `an underground home gets a visitor too ${JSON.stringify([V.underground, V.underStays])}`);
  t.ok(V.typeCount === 3 && V.chosen && V.testFinished && V.testVisitor === 'fluffin' && V.removedType === 'cozy,treasure', `a test-only home type needs no code change ${JSON.stringify(V)}`);

  // 5. Save and load.
  const S = await page.evaluate(async () => {
    const { g, B, ht, X0, Z0, F, clear } = window.__h;
    clear();
    const mat = ht.placeExample(g.world, 'cozy', X0, F, Z0);
    g.homes.list.length = 0;
    g.homes.place(...mat); g.homes.choose(g.homes.at(...mat), 'cozy');
    g.save();
    const saved = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
    const o = { pid: saved.playerId === g.playerId && !!saved.playerId, homes: JSON.stringify(saved.homes.map(h => [h.owner === g.playerId, h.x, h.y, h.z, h.type])), want: JSON.stringify([[true, ...mat, 'cozy']]), told: saved.toldHomes };
    // bad records
    const w = g.world, m2 = [X0 + 25, F, Z0 + 25];
    w.set(...m2, B.DOORMAT);
    g.homes.load([
      { owner: 'a', x: m2[0], y: m2[1], z: m2[2], type: 'cozy' }, { owner: 'b', x: 1, y: 2, z: 3, type: 'cozy' }, { owner: 'c', x: NaN, y: 1, z: 1 },
      { owner: 'd', x: m2[0] + 0.5, y: m2[1], z: m2[2] }, null, 'x', { x: m2[0], y: m2[1], z: m2[2] }, { owner: 'e', x: m2[0], y: m2[1], z: m2[2], type: 'bogus' },
    ], 'e');
    o.bad = `${g.homes.list.length} ${g.homes.list[0]?.owner} ${g.homes.list[0]?.type}`;
    g.homes.load(undefined, 'z'); o.none = g.homes.list.length;
    g.homes.load(saved.homes, g.playerId); // back
    return o;
  });
  t.ok(S.pid && S.homes === S.want && S.told === true, `the save has playerId and the home ${S.homes}`);
  t.ok(S.bad === '1 e null' && S.none === 0, `bad records are dropped, an unknown type becomes null ${S.bad}`);
  await page.reload();
  await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  await continueGame(page);
  const L = await page.evaluate(async () => { const g = window.pokecraft; const s = JSON.parse(localStorage.getItem("pokecraft-save-v2")); const { B } = await import("/src/blocks.js"); return { n: g.homes.list.length, fin: !!g.homes.mine()?.finished, ready: g.homes.ready().length, pid: !!g.playerId, saved: JSON.stringify(s.homes), edits: s.edits.length, mats: s.homes.map(h => g.world.get(h.x, h.y, h.z)), pidSame: s.playerId === g.playerId, B: B.DOORMAT }; });
  t.ok(L.n === 1 && L.fin && L.ready === 1 && L.pid, `continue restores a finished home ${JSON.stringify(L)}`);
  // an old save has no homes
  const oldSave = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); delete s.homes; delete s.playerId; delete s.toldHomes; return s; });
  await page.context().close();
  const page2 = await openGame(browser, base, { setup: seedSave(oldSave) });
  await continueGame(page2);
  const O = await page2.evaluate(() => { const g = window.pokecraft; return { n: g.homes.list.length, pid: !!g.playerId }; });
  t.ok(O.n === 0 && O.pid, `an old save has no homes and gets a player id ${JSON.stringify(O)}`);
  t.ok(!page2.errors.length, `no page errors ${page2.errors.join('; ')}`);
  await page2.context().close();

  // 6. Two browsers.
  const [A, B2] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B2, 1); await pause(B2);
  await A.evaluate(SETUP);
  const home = await A.evaluate(() => {
    const { g, ht, X0, Z0, F, clear } = window.__h;
    clear();
    const mat = ht.placeExample(g.world, 'cozy', X0, F, Z0);
    g.homes.place(...mat); g.homes.choose(g.homes.at(...mat), 'cozy');
    g.player.pos.set(X0 + 4.5, F + 1, Z0 + 4.5);
    return { mat, pid: g.playerId };
  });
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B2.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B2.fill('#mp .mp-code-input', code.toLowerCase());
  await click(B2, '#mp button:has-text("Join a world")');
  await waitFor(B2, () => window.pokecraft.mp.role === 'guest', null, 20000);
  await B2.waitForTimeout(1500);
  const G = await B2.evaluate(() => {
    const g = window.pokecraft, h = g.homes.list[0];
    return { n: g.homes.list.length, type: h?.type, ready: g.homes.ready().length, owner: g.homes.worldOwnerHome()?.owner, name: h?.name };
  });
  t.ok(G.n === 1 && G.type === 'cozy' && G.ready === 1 && G.owner === home.pid, `the guest sees the host's cozy home ${JSON.stringify(G)}`);
  const place = await B2.evaluate(async ([x, y, z]) => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js');
    g.world.set(x, y, z, B.DOORMAT); g.mp.sendBlock(x, y, z, B.DOORMAT);
    const h = g.homes.place(x, y, z);
    g.homes.choose(h, 'treasure');
    return true;
  }, [home.mat[0] + 14, home.mat[1], home.mat[2]]);
  await A.waitForTimeout(1500);
  const A2 = await A.evaluate(() => { const g = window.pokecraft; g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { n: g.homes.list.length, types: g.homes.list.map(h => h.type).sort().join(), saved: s.homes.length }; });
  t.ok(place && A2.n === 2 && A2.types === 'cozy,treasure' && A2.saved === 2, `the host gets the guest's home and saves both ${JSON.stringify(A2)}`);
  await A.evaluate(async ([x, y, z]) => {
    const g = window.pokecraft, { B } = await import('/src/blocks.js');
    g.world.set(x, y, z, B.AIR); g.mp.sendBlock(x, y, z, B.AIR);
  }, [home.mat[0] + 14, home.mat[1], home.mat[2]]);
  await B2.waitForTimeout(1500);
  const gone = await B2.evaluate(() => window.pokecraft.homes.list.length);
  t.ok(gone === 1, `breaking the guest's mat removes the home for both (${gone} left for the guest)`);
  t.ok(!A.errors.length && !B2.errors.length, `no page errors ${[...A.errors, ...B2.errors].join('; ')}`);
}
