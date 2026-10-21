// T33 Food type and the Restaurant (gym 28, south slot 5): 7 Food creatures (data, models, portraits), moves, fx and
// sounds, the gym def, the building on several seeds, ingredients that exist on a map, which dish comes next on a map
// that lacks a source, then the game: the Chef's order, ingredients from natural blocks, the pot (raw -> golden -> burnt),
// serving a customer, the Chef battle, saving, rematch = the next dish, and a short iPad part.
// Saves tests/screenshots/food-creatures.png, creature-<id>.png and t33-*.png.
import fs from 'node:fs';
import { devices } from 'playwright';
import { openGame, newGame, playBattle, continueGame, seedSave, platform } from '../helpers.mjs';

const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const IDS = ['makiroll', 'sushisail', 'bitesize', 'bigbite', 'noodlet', 'pastapus', 'scoopsy'];
const OLD_SHAPES = ['quad', 'blob', 'biped', 'bird', 'serpent', 'bug', 'guardian', 'butterfly', 'moth', 'star', 'robe', 'hopper',
  'planet', 'comet', 'cloud', 'tall', 'squid', 'bat', 'drum', 'ape', 'bell', 'armadillo', 'wyvern', 'fish', 'nut', 'drone', 'wisp',
  'puff', 'crystal', 'skull', 'bonedog', 'dino', 'ufo', 'visitor', 'tripod'];

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });

  /* 1. Data (no game needed) */
  const page0 = await openGame(browser, base);
  const d = await page0.evaluate(async ({ IDS, OLD_SHAPES }) => {
    const S = await import('/src/species.js');
    const SH = await import('/src/shapes.js');
    const R = await import('/src/fxrecipes.js');
    const BL = await import('/src/blocks.js');
    const { GYMS } = await import('/src/gyms.js');
    const { sound } = await import('/src/sound.js');
    const THREE = await import('three');
    const out = { problems: [], info: {} };
    const bad = m => out.problems.push(m);
    const all = Object.entries(S.SPECIES);
    const food = all.filter(([, s]) => s.type === 'food').map(([id]) => id);
    if (food.join() !== IDS.join()) bad(`food species ${food}`);
    const evolvesInto = new Set(all.map(([, s]) => s.evolve?.into).filter(Boolean));
    const evo = food.filter(id => S.SPECIES[id].evolve);
    if (evo.length !== 3) bad(`${evo.length} evolutions`);
    for (const id of evo) { const e = S.SPECIES[id].evolve; if (S.SPECIES[e.into]?.type !== 'food' || e.level < 22 || e.level > 24) bad(`${id} evolves into ${e.into} at ${e.level}`); }
    const singles = food.filter(id => !S.SPECIES[id].evolve && !evolvesInto.has(id));
    if (singles.length !== 1 || singles[0] !== 'scoopsy') bad(`singles ${singles}`);
    const shapes = new Set(food.map(id => S.SPECIES[id].model.shape));
    if ([...shapes].sort().join() !== 'burger,icecream,noodlebowl,sushi') bad(`shapes ${[...shapes]}`);
    const names = all.map(([, s]) => s.name.toLowerCase());
    const whereOf = id => Object.entries(S.SPECIES ? S.SPAWNS : {}).filter(([, l]) => l.some(e => e[0] === id)).map(([b]) => b);
    const sigOf = m => {
      let sum = 0;
      m.updateMatrixWorld(true);
      m.traverse(o => {
        if (!o.isMesh) return;
        for (const v of o.matrixWorld.elements) sum += v;
        if (o.material.color) sum += o.material.color.r * 3 + o.material.color.g * 5 + o.material.color.b * 7;
      });
      return sum;
    };
    for (const id of food) {
      const s = S.SPECIES[id];
      if (OLD_SHAPES.includes(s.model.shape) || typeof SH.SHAPES[s.model.shape] !== 'function') bad(`${id}: shape ${s.model.shape}`);
      if (all.some(([o, os]) => os.model.shape === s.model.shape && !food.includes(o))) bad(`${id}: shape used by another type`);
      if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(`${id}: name not unique`);
      if (!s.desc || s.desc.length > 110) bad(`${id}: desc is ${s.desc?.length} characters`);
      if (!whereOf(id).length) bad(`${id}: in no SPAWNS table`);
      if (!S.makeCreature(id, 20).moves.some(m => S.MOVES[m].type === 'food')) bad(`${id}: no food move at 20`);
      if (['wolf', 'pizza'].some(w => s.name.toLowerCase().includes(w))) bad(`${id}: odd name`);
      try {
        const m = S.buildModel(id);
        S.animateModel(m, 0);
        const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
        out.info[id] = `${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`;
        if (size.y < 0.35 || size.y > 2.6) bad(`${id}: height ${size.y.toFixed(2)}`);
        if (size.x > 2.3 || size.z > 2.3) bad(`${id}: width/depth ${size.x.toFixed(2)}/${size.z.toFixed(2)}`);
        if (box.min.y < -0.1) bad(`${id}: under the ground (${box.min.y.toFixed(2)})`);
        S.animateModel(m, 0.3, false); const a = sigOf(m);
        S.animateModel(m, 1.1, false); const b = sigOf(m);
        if (Math.abs(a - b) < 1e-6) bad(`${id}: no idle animation`);
        for (let tt = 0; tt < 3; tt += 0.5) S.animateModel(m, tt, tt > 1.5);
        S.tintModel(m, 0xff2020); S.tintModel(m, null);
        S.disposeModel(m);
      } catch (e) { bad(`${id}: model failed: ${e.message}`); }
    }
    // Moves, big moves, fx, sounds.
    for (const id of ['nomnom', 'foodfight', 'sprinkles', 'snacktime', 'megamunch', 'dinnerbell', 'lastbite', 'picnicday']) {
      if (!S.MOVES[id] || S.MOVES[id].type !== 'food') bad(`move ${id}`);
      if (sound.has(id)) bad(`move ${id} is also a sound name`);
    }
    const foodMoves = Object.entries(S.MOVES).filter(([, m]) => m.type === 'food');
    if (foodMoves.filter(([, m]) => m.sig).length !== 1 || !S.MOVES.megamunch.sig) bad('signature moves');
    if (!S.SPECIES.bigbite.learn.some(([l, m]) => l === 30 && m === 'megamunch')) bad('Bigbite does not learn Mega Munch at 30');
    out.snack = S.moveInfo('snacktime').text; out.sprinkles = S.moveInfo('sprinkles').text;
    const bigs = foodMoves.filter(([, m]) => m.big).map(([, m]) => m.fx.kind).sort().join();
    if (bigs !== 'field,rally,sacrifice') bad(`big kinds ${bigs}`);
    if (!R.FX_COLORS.food || !R.TRAVEL.food || !R.IMPACT.food || R.TRAVEL.food === R.TRAVEL.normal || R.IMPACT.food === R.IMPACT.normal) bad('fx recipes');
    if (!R.SIG.megamunch || R.SIG.megamunch === R.SIG.blazedash) bad('no Mega Munch fx');
    for (const n of ['fx:food', 'potbubble', 'cookding', 'potburnt', 'yum']) { if (!sound.has(n)) bad(`no sound ${n}`); sound.play(n); }
    out.soundErrors = [...(sound.errors || [])].length;
    // Blocks.
    for (const [name, id] of [['POT', 83], ['POT_GOLDEN', 84], ['POT_BURNT', 85], ['STOVE', 86]]) {
      const def = BL.BLOCKS[id];
      if (BL.B[name] !== id || !def) { bad(`block ${name}`); continue; }
      for (const f of ['top', 'side', 'bottom']) if (def[f] === undefined || def[f] >= BL.TILE_COUNT) bad(`${name}.${f}`);
      if (!def.wallText || def.limited || BL.PLACEABLE.includes(id)) bad(`${name}: wallText/limited/placeable`);
    }
    if (BL.WOOL.food !== 79) bad('wool food');
    // Gym def.
    const g = GYMS[27];
    if (!g || g.id !== 'food' || g.slot !== 5 || g.build !== 'restaurant' || g.live !== 'restaurant' || g.access?.when !== 'menu') bad('gym def');
    else {
      if (g.keys.join() !== ['order', 'cooked', 'served', ...Object.keys(g.ingredients)].join()) bad('keys');
      for (const dish of g.menu) {
        for (const k of dish.ingredients) if (!g.ingredients[k]) bad(`${dish.id}: unknown ingredient ${k}`);
        if (dish.table < 1 || dish.table > 4 || !g.customers.some(c => c.table === dish.table)) bad(`${dish.id}: table`);
        if (dish.time < 2.5 || dish.time > 4) bad(`${dish.id}: time`);
      }
      for (let i = 2; i < g.menu.length; i++) if (g.menu[i].time > g.menu[i - 1].time) bad('times get longer');
      if (g.menu[0].ingredients.length !== 3) bad('dish 0 ingredients');
      for (const [k, ing] of Object.entries(g.ingredients)) for (const n of ing.blocks) if (BL.B[n] === undefined) bad(`${k}: block ${n}`);
      if (new Set(g.customers.map(c => c.table)).size !== 4) bad('customers');
      if (g.customers.some(c => /lulu/i.test(c.name))) bad('a customer is still called Lulu');
      const lv = g.trainers.flatMap(p => p.team.map(x => x[1]));
      if (Math.min(...lv) < 46 || Math.max(...lv) > 47) bad(`trainer levels ${lv}`);
      if (Math.max(...g.leaderTeam.map(x => x[1])) !== 48) bad('leader level');
      for (const sp of [...g.trainers.flatMap(p => p.team), ...g.leaderTeam].map(x => x[0])) if (S.SPECIES[sp].type !== 'food') bad(`${sp} is not food`);
      for (const [sp, lv2, mv] of g.leaderTeam) {
        if (!mv) continue;
        const big = mv.find(m => S.MOVES[m].big);
        const want = S.movesWith(sp, lv2, big).join();
        if (want !== mv.join()) bad(`${sp}: written moves ${mv} differ from movesWith ${want}`);
      }
    }
    out.gyms = GYMS.length;
    return out;
  }, { IDS, OLD_SHAPES });
  t.ok(!d.problems.length, `food data, models, moves, fx, sounds, blocks and gym def ${d.problems.join('; ')}`);
  t.ok(d.snack.includes('heals you') && d.sprinkles.includes('hits 1 to 5 times'), `Snack Time: ${d.snack} | Sprinkles: ${d.sprinkles}`);
  t.ok(d.soundErrors === 0, 'playing the new sounds gives no errors');
  console.log(`  sizes ${Object.entries(d.info).map(([k, v]) => `${k} ${v}`).join(', ')}`);

  // Portrait grid.
  const shots = await page0.evaluate(async ({ IDS }) => {
    const { portrait } = await import('/src/ui.js');
    const S = await import('/src/species.js');
    const W = 200, H = 180, LABEL = 26;
    const cv = document.createElement('canvas');
    cv.width = W * IDS.length; cv.height = H + LABEL;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
    const singles = {};
    for (let i = 0; i < IDS.length; i++) {
      const img = new Image();
      img.src = portrait(IDS[i], W, H);
      await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
      ctx.drawImage(img, i * W, 0);
      ctx.fillText(S.SPECIES[IDS[i]].name, i * W + W / 2, H + 18);
      singles[IDS[i]] = portrait(IDS[i], 480, 400);
    }
    return { grid: cv.toDataURL(), singles };
  }, { IDS });
  const save = (name, url) => { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log(`  screenshot ${SHOTS + name}`); };
  save('food-creatures.png', shots.grid);
  for (const [id, url] of Object.entries(shots.singles)) save(`creature-${id}.png`, url);
  t.ok(shots.grid.length > 20000, 'portrait grid drawn');

  /* 2. Placement and ingredients (no game needed) */
  const placed = await page0.evaluate(async () => {
    const { World, WORLD_W: W, WORLD_D: D } = await import('/src/world.js');
    const { B, WOOL, isSolid } = await import('/src/blocks.js');
    const { GYMS } = await import('/src/gyms.js');
    const R = await import('/src/restaurant.js');
    const sum = w => { let h = 0; for (let i = 0; i < w.data.length; i += 7) h = (h * 31 + w.data[i]) | 0; return h; };
    const out = {};
    for (const seed of [1, 4242, 777, 22, 122]) {
      const w = new World(seed, null, null);
      w.generate();
      const g = w.gyms.find(x => x.def.id === 'food'), box = g.slot.box, r = {};
      r.slot = g.slot.k === 5;
      r.inBox = [...g.protect, g.area].every(b => b.x0 >= box.x0 && b.x1 <= box.x1 && b.z0 >= box.z0 && b.z1 <= box.z1);
      if ([1, 4242, 777].includes(seed)) { const w2 = new World(seed, null, null); w2.generate(); r.same = sum(w) === sum(w2); }
      r.pot = w.get(...g.pot) === B.POT && w.get(g.pot[0], g.pot[1] - 1, g.pot[2]) === B.STOVE;
      r.tables = g.tables.length === 4 && g.tables.every(tb => w.get(...tb.at) === tb.wool);
      const fl = Math.floor;
      const free = (x, y, z) => x >= 0 && z >= 0 && x < W && z < D && y >= 1 && !isSolid(w.get(x, y, z));
      const stand = (x, y, z) => free(x, y, z) && free(x, y + 1, z) && isSolid(w.get(x, y - 1, z));
      const cells = [g.leaderPos, ...g.trainerPositions, ...g.people.map(p => p.pos)];
      r.cellsOk = cells.every(([x, y, z]) => stand(fl(x), fl(y), fl(z)));
      r.people = g.people.length === 4 && g.people.every(p => p.kind === 'guest' && p.title.includes('table'));
      const walk = (start, goal, limit = 30) => {
        const seen = new Set([start.join()]), st = [start];
        while (st.length) {
          const [x, y, z] = st.pop();
          if (goal(x, y, z)) return true;
          for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + ax, nz = z + az;
            if (Math.abs(nx - g.x) > limit || Math.abs(nz - g.z) > limit) continue;
            for (const ny of [y + 1, y, y - 1, y - 2]) {
              if (!stand(nx, ny, nz) || seen.has([nx, ny, nz].join())) continue;
              if (ny > y && !free(x, y + 2, z)) continue;
              seen.add([nx, ny, nz].join()); st.push([nx, ny, nz]);
              break;
            }
          }
        }
        return false;
      };
      const [fx, fz] = g.front;
      const outside = [g.x + fx * 11, g.fy + 1, g.z + fz * 11];
      let start = outside;
      for (let y = g.fy - 2; y <= g.fy + 4; y++) if (stand(outside[0], y, outside[2])) { start = [outside[0], y, outside[2]]; break; }
      const [px, py, pz] = g.pot;
      r.toPot = walk(start, (x, y, z) => Math.hypot(x - px, z - pz) <= 3 && Math.abs(y - py) <= 3);
      r.toGuests = g.people.every(p => walk(start, (x, y, z) => Math.abs(x - fl(p.pos[0])) + Math.abs(z - fl(p.pos[2])) <= 1 && y === fl(p.pos[1])));
      r.protect = !w.editAllowed(px, py, pz, 0) && !w.editAllowed(g.x + fx * 8, g.fy + 2, g.z + fz * 8, 0) && w.editAllowed(g.x + fx * 17, g.fy + 2, g.z + fz * 17, B.STONE);
      // Ingredients: which exist as natural, breakable blocks on this map; the dishes that can be made; the badge dish must be makeable.
      const have = R.sourcesFound(w, g.def);
      r.have = [...have].sort().join();
      r.dishes = R.availableDishes(w, g.def).join();
      r.badgeDish = g.def.menu[0].ingredients.every(k => have.has(k));
      out[seed] = r;
    }
    // Only the building's box changes: generate with the Restaurant taken out of GYMS and compare (seed 4242).
    const idx = GYMS.findIndex(x => x.id === 'food'), def = GYMS[idx];
    const a = new World(4242, null, null); a.generate();
    GYMS.splice(idx, 1);
    let b;
    try { b = new World(4242, null, null); b.generate(); } finally { GYMS.splice(idx, 0, def); }
    const box = a.gyms.find(x => x.def.id === 'food').slot.box;
    let outside = 0, inside = 0;
    for (let y = 0; y < 48; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const i = x + W * (z + D * y);
      if (a.data[i] === b.data[i]) continue;
      if (x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1) inside++; else outside++;
    }
    out.diff = { inside, outside };
    return out;
  });
  for (const [seed, r] of Object.entries(placed)) {
    if (seed === 'diff') continue;
    t.ok(r.slot && r.inBox, `seed ${seed}: the Restaurant is in slot 5 and its boxes are inside the slot box`);
    if (r.same !== undefined) t.ok(r.same, `seed ${seed}: generating twice gives the same world`);
    t.ok(r.pot && r.tables && r.people && r.cellsOk, `seed ${seed}: the pot stands on a stove, the tables have their wool, people stand on the floor`);
    t.ok(r.toPot && r.toGuests, `seed ${seed}: you can walk from outside to the pot and to every customer`);
    t.ok(r.protect, `seed ${seed}: the pot and walls are protected, a cell 9 outside the door is not`);
    t.ok(r.badgeDish, `seed ${seed}: the badge dish can be made (found: ${r.have}; dishes for rematches: ${r.dishes || 'none'})`);
  }
  t.ok(placed.diff.outside === 0 && placed.diff.inside > 500, `only the slot box changes: ${placed.diff.inside} blocks inside, ${placed.diff.outside} outside`);
  await page0.context().close();

  /* 3. The dish on a map that lacks a source (no browser world needed): the next dish skips what cannot be made. */
  const pageA = await openGame(browser, base);
  const pick = await pageA.evaluate(async () => {
    const R = await import('/src/restaurant.js');
    const { GYMS } = await import('/src/gyms.js');
    const def = GYMS.find(g => g.id === 'food');
    const mk = (have, wins, badge = true) => {
      const game = { badges: badge ? ['food'] : [], rematchWins: { food: wins }, world: { foodSources: new Set(have) } };
      return R.dishIndex(game, def);
    };
    const ALL = Object.keys(def.ingredients), BASE = ['berry', 'honey', 'pinenut'];
    const o = {};
    o.before = mk(ALL, 0, false);
    o.all = [0, 1, 2, 3, 4, 5, 6].map(w => mk(ALL, w)).join();
    o.noDesert = [0, 1, 2, 3, 4].map(w => mk(ALL.filter(k => k !== 'cactus'), w)).join(); // no cactus: Cactus Salad (3) and the Feast (5) are skipped
    o.noCrystal = [0, 1, 2, 3, 4].map(w => mk(ALL.filter(k => k !== 'starsugar'), w)).join();
    o.onlyBase = [0, 1, 2, 3].map(w => mk(BASE, w)).join(); // nothing else can be made: the badge dish again
    o.onlyCave = [0, 1, 2].map(w => mk([...BASE, 'glowcap'], w)).join();
    o.badgeNeeds = def.menu[0].ingredients.every(k => ['berry', 'honey', 'pinenut'].includes(k));
    // A made-up world: ingredients are only counted when natural, breakable blocks of them exist.
    const { World } = await import('/src/world.js');
    const { B } = await import('/src/blocks.js');
    const w = new World(1, null, null); // not generated: empty
    o.emptyWorld = R.availableDishes(w, def).length;
    w.data[w.index(5, 10, 5)] = B.CACTUS;
    w.data[w.index(6, 10, 5)] = B.GLOWCAP;
    w.data[w.index(7, 10, 5)] = B.LEAVES;
    w.edits.set(w.index(7, 10, 5), B.LEAVES); // placed by a player: does not count
    R.sourcesFound.cache = new WeakMap();
    o.found = [...R.sourcesFound(w, def)].sort().join();
    return o;
  });
  t.ok(pick.before === 0, 'before the badge the dish is always the badge dish (Berry Pie)');
  t.ok(pick.badgeNeeds, 'the badge dish only needs berries, honey and pine nuts');
  t.ok(pick.all === '1,2,3,4,5,1,2', `a map with everything: rematch dishes go 1..5 and round again (${pick.all})`);
  t.ok(pick.noDesert === '1,2,4,1,2', `without cactus the next dish skips Cactus Salad and the Feast (${pick.noDesert})`);
  t.ok(pick.noCrystal === '1,2,3,1,2', `without star crystals the next dish skips Star Sundae and the Feast (${pick.noCrystal})`);
  t.ok(pick.onlyBase === '0,0,0,0' && pick.onlyCave === '1,1,1', `with nothing else to find the Chef never gets stuck: badge dish again (${pick.onlyBase}), or the one dish that can be made (${pick.onlyCave})`);
  t.ok(pick.emptyWorld === 0 && pick.found === 'cactus,glowcap', `ingredients count only as natural blocks anywhere on the map (${pick.found})`);
  await pageA.context().close();

  /* 4. The game, world independent */
  const page = await openGame(browser, base);
  await newGame(page, 1);
  await page.evaluate(async () => {
    const g = window.pokecraft;
    g.creatures.clear(); document.exitPointerLock();
    window.__toasts = [];
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) window.__toasts.push(n.textContent); })
      .observe(document.getElementById('toast'), { childList: true });
    const { makeCreature } = await import('/src/species.js');
    const { GYMS } = await import('/src/gyms.js');
    g.party = ['titanox', 'spectrion', 'stormwyvern'].map(s => makeCreature(s, 70));
    g.badges = GYMS.filter(x => x.id !== 'food').map(x => x.id);
    g.world.foodSources = new Set(['berry', 'honey', 'pinenut', 'glowcap', 'snow', 'cactus', 'starsugar']); // every dish can be made
  });
  const toasts = () => page.evaluate(() => window.__toasts.join(' | '));
  const clearToasts = () => page.evaluate(() => { window.__toasts.length = 0; });
  const place = (x, y, z, look = [0, 0], pitch = 0) => page.evaluate(([x, y, z, look, pitch]) => {
    const g = window.pokecraft;
    g.player.pos.set(x, y, z); g.player.vel.set(0, 0, 0);
    g.player.yaw = Math.atan2(-look[0], -look[1]); g.player.pitch = pitch;
  }, [x, y, z, look, pitch]);
  const shot = async (name, wait = 2500) => {
    await page.evaluate(() => { window.pokecraft.time = 0.2; document.getElementById('pause').classList.add('hidden'); });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: SHOTS + name });
    console.log(`  screenshot ${SHOTS + name}`);
  };
  const info = await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'food');
    return { x: gym.x, z: gym.z, fy: gym.fy, front: gym.front, pot: gym.pot, tables: gym.tables, people: gym.people };
  });
  const [fx, fz] = info.front;
  const onGround = (x, z) => page.evaluate(([x, z]) => window.pokecraft.world.surface(Math.floor(x), Math.floor(z)).y + 1, [x, z]);
  const inside = (d, s = 0) => [info.x + 0.5 + fx * d + fz * s, info.z + 0.5 + fz * d + fx * s]; // d towards the door, s sideways (like col())
  const talk = sel => page.evaluate(sel => { const g = window.pokecraft; g.talkTo(g.npcs.list.find(new Function('x', `return ${sel}`))); }, sel);
  const chef = "x.kind === 'leader' && x.gym.def.id === 'food'";
  const guest = name => `x.kind === 'guest' && x.name === '${name}'`;
  const state = () => page.evaluate(async () => {
    const g = window.pokecraft, R = await import('/src/restaurant.js'), def = g.world.gyms.find(x => x.def.id === 'food').def;
    const s = R.orderState(g, def);
    return { keys: g.keys.filter(k => k.startsWith('food:')).join(), stage: s.stage, dish: s.dish.id, edits: g.world.edits.size, wins: g.rematchWins.food || 0, badge: g.badges.includes('food') };
  });
  const potLive = () => page.evaluate(() => window.pokecraft.gymLive.of('food').state());
  const tapPot = () => page.evaluate(() => {
    const g = window.pokecraft, [x, y, z] = g.world.gyms.find(q => q.def.id === 'food').pot;
    g.breakBlock({ x, y, z, id: g.world.get(x, y, z), normal: [0, 1, 0] }); // a click or the touch break button
  });
  let cellNo = 0; // every block gets its own cell: a broken cell keeps its edit
  const breakNatural = async (id, natural = true) => { // a block on the platform
    await page.evaluate(([id, natural, n]) => {
      const g = window.pokecraft, s = g.spawnPoint, x = Math.floor(s.x) - 3 + (n % 8), z = Math.floor(s.z) - 3 + Math.floor(n / 8), y = 43;
      g.world.set(x, y, z, id, !natural); // natural: no edit; placed: an edit
      g.breakBlock({ x, y, z, id, normal: [0, 1, 0] });
    }, [id, natural, cellNo++]);
    };
  const B = await page.evaluate(async () => (await import('/src/blocks.js')).B);

  // 4a. The guide and the welcome.
  await place(inside(40)[0], 40, inside(40)[1]);
  await page.evaluate(() => window.pokecraft.updateGuide());
  const far = await page.evaluate(() => window.pokecraft.ui.guide.textContent);
  t.ok(far.startsWith('Next: Restaurant'), `the guide says: "${far}"`);
  await clearToasts();
  await place(inside(3)[0], info.fy + 1, inside(3)[1], [-fx, -fz]);
  await page.evaluate(() => window.pokecraft.updateGuide());
  await page.waitForTimeout(300);
  t.ok((await toasts()).includes('Welcome to the Restaurant!'), `inside: the welcome (${await toasts()})`);

  // 4b. The Chef refuses first; the two trainers.
  await clearToasts();
  await talk(chef);
  t.ok((await toasts()).includes('Beat Waiter Olive and Cook Benny first'), `the Chef refuses first (${await toasts()})`);
  for (const [i, name] of [[0, 'Waiter Olive'], [1, 'Cook Benny']]) {
    await talk(`x.kind === 'trainer' && x.index === ${i} && x.gym.def.id === 'food'`);
    t.ok(await page.evaluate(() => window.pokecraft.inBattle), `${name} battles`);
    t.ok(await playBattle(page), `beat ${name}`);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.exitPointerLock());
  }

  // 4c. Before the order: the pot says to talk to the Chef, a natural leaf gives nothing.
  await place(inside(-5, -5)[0], info.fy + 1, inside(-5, -5)[1], [-fx, -fz]);
  await clearToasts();
  await tapPot();
  t.ok((await toasts()).includes('Talk to Chef Basil first'), `tapping the pot before the order (${await toasts()})`);
  let st = await state();
  t.ok(st.stage === 'none' && st.keys === '', 'no order yet');
  const prompt0 = await page.evaluate(() => { const g = window.pokecraft; return g.gymLive.talkPrompt(g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'food')); });
  t.ok(prompt0?.action === 'Order!', `the Chef says "${prompt0?.action}" on the button`);
  await platform(page);
  await breakNatural(B.LEAVES);
  st = await state();
  t.ok(st.keys === '', 'before the order a natural leaf gives nothing');

  // 4d. The order.
  await place(inside(-3, 0)[0], info.fy + 1, inside(-3, 0)[1], [-fx, -fz]);
  await clearToasts();
  await talk(chef);
  const orderToast = await toasts();
  st = await state();
  t.ok(st.keys === 'food:order' && st.stage === 'shopping' && st.dish === 'berrypie', `the Chef gives an order (${st.keys}, ${st.stage})`);
  t.ok(orderToast.includes('Table 2 (blue) wants Berry Pie') && orderToast.includes('🫐 🍯 🌰') && orderToast.includes('the leaves of any tree'), `the order toast: ${orderToast}`);
  const after = await page.evaluate(() => { const g = window.pokecraft, c = g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'food'); return { p: g.gymLive.talkPrompt(c), status: g.access.of(g.world.gyms.find(x => x.def.id === 'food')).status() }; });
  t.ok(after.p.verb === 'talk' && after.status.includes('🫐') && after.status.includes('🍯') && after.status.includes('🌰'), `the guide lists the ingredients: ${after.status}`);

  // 4d2. The HUD glow: the order's ingredients, glowing faster when a natural one is near (placed ones don't count).
  await platform(page);
  const sniff = (dx, id, natural) => page.evaluate(([dx, id, natural]) => {
    const g = window.pokecraft, p = g.player.pos, x = Math.floor(p.x) + dx, y = Math.floor(p.y), z = Math.floor(p.z);
    if (id != null) g.world.set(x, y, z, id, !natural);
    const L = g.gymLive.of('food');
    L.sniff();
    const el = document.getElementById('food-compass');
    return { list: L.sniffed, shown: !el.classList.contains('hidden'), html: el.innerHTML };
  }, [dx, id, natural]);
  let sn = await sniff(0, null);
  t.ok(sn.shown && sn.list.map(i => i.emoji).join(' ') === '🫐 🍯 🌰' && sn.list.every(i => !i.got), `the HUD shows the three ingredients (${sn.list.map(i => i.emoji + (i.period ?? '-')).join(' ')})`);
  const honey0 = sn.list[1].period;
  sn = await sniff(2, B.FLOWER_BUSH, false);
  t.ok(sn.list[1].period === honey0, `a placed flower bush 2 blocks away does not glow (${sn.list[1].period})`);
  sn = await sniff(3, B.FLOWER_BUSH, true);
  t.ok(sn.list[1].period != null && sn.list[1].period < 0.6 && (honey0 == null || honey0 > sn.list[1].period), `a natural flower bush 3 blocks away: honey glows fast (${honey0} -> ${sn.list[1].period})`);
  t.ok(sn.html.includes('class="food near"') && sn.html.includes('--glint'), 'the near ingredient blinks in the HUD');
  await page.evaluate(() => { document.getElementById('pause').classList.add('hidden'); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOTS + 't33-ingredient-glow.png', clip: { x: 700, y: 0, width: 400, height: 260 } });
  await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos; g.world.set(Math.floor(p.x) + 3, Math.floor(p.y), Math.floor(p.z), 0, false); });

  // 4e. Ingredients on a platform: only natural blocks count, one of each, and only the ones the dish needs.
  await platform(page);
  await clearToasts();
  await breakNatural(B.LEAVES, false);
  await breakNatural(B.CACTUS);
  t.ok((await state()).keys === 'food:order', 'a placed leaf and a cactus (not in Berry Pie) give nothing');
  await breakNatural(B.LEAVES);
  let msg = await toasts();
  t.ok((await state()).keys.includes('food:berry') && msg.includes('🫐 You found a berry! (1/3 for Berry Pie)'), `a natural leaf is a berry (${msg})`);
  await clearToasts();
  await breakNatural(B.LEAVES);
  msg = await toasts();
  t.ok(!msg.includes('You found'), `a second leaf: nothing new (${msg})`);
  await breakNatural(B.FLOWER_BUSH);
  await breakNatural(B.PINE_LEAVES);
  msg = await toasts();
  st = await state();
  t.ok(st.keys.includes('food:honey') && st.keys.includes('food:pinenut') && st.stage === 'cook' && msg.includes('You have everything for Berry Pie'), `honey and a pine nut: ${msg}`);
  t.ok((await page.evaluate(() => window.pokecraft.world.edits.size)) > 0, 'the broken blocks are normal edits');
  sn = await page.evaluate(() => { window.pokecraft.gymLive.of('food').sniff(); return !document.getElementById('food-compass').classList.contains('hidden'); });
  t.ok(!sn, 'with everything found the HUD glow is gone');

  // 4f. The pot.
  await place(inside(-5, -5)[0], info.fy + 1, inside(-5, -5)[1], [-fx, -fz], -0.15);
  const editsBefore = (await state()).edits;
  await page.evaluate(() => { window.__T = 0; window.pokecraft.gymLive.of('food').now = () => window.__T; });
  const at = async dt => { await page.evaluate(dt => { window.__T += dt; window.pokecraft.gymLive.of('food').update(0); }, dt); };
  const potBlock = () => page.evaluate(() => { const g = window.pokecraft; return g.world.get(...g.world.gyms.find(x => x.def.id === 'food').pot); });
  await clearToasts();
  await tapPot();
  const soundPlayed = () => page.evaluate(async () => (await import('/src/sound.js')).sound.played.join());
  let ps = await potLive();
  t.ok(ps.phase === 'raw' && (await soundPlayed()).includes('potbubble') && (await toasts()).includes('Watch the pot'), `tapping the pot starts the cooking (${ps.phase})`);
  await at(1);
  await clearToasts();
  await tapPot();
  t.ok((await toasts()).includes('Not yet') && (await state()).keys.includes('food:cooked') === false, 'tapping while raw: not yet, no dish');
  await at(2.5);
  t.ok((await potBlock()) === B.POT_GOLDEN && (await soundPlayed()).includes('cookding'), 'after 3 s the pot is golden (and rings)');
  await shot('t33-pot-golden.png', 1500);
  await at(4);
  t.ok((await potBlock()) === B.POT_BURNT && (await toasts()).includes('it burnt') && (await state()).keys.includes('food:berry'), 'too late: the pot burns, the ingredients are safe');
  await clearToasts();
  await tapPot();
  t.ok((await potLive()).phase === 'raw' && (await toasts()).includes("Let's try again"), 'tapping a burnt pot starts again at once');
  await at(3.2);
  t.ok((await potBlock()) === B.POT_GOLDEN, 'golden again');
  await clearToasts();
  await tapPot();
  st = await state();
  t.ok(st.keys.includes('food:cooked') && st.stage === 'cooked' && (await toasts()).includes('Berry Pie is ready'), `a tap while golden: the dish is ready (${(await toasts())})`);
  await page.evaluate(() => window.pokecraft.gymLive.of('food').update(0));
  t.ok((await potBlock()) === B.POT && st.edits === editsBefore, 'the pot is a normal pot again and cooking made no edits');

  // 4g. Serving. Pip is not table 2: his own line. Granny Rosa gets the dish: the Chef battle (first a lost one).
  await place(inside(3)[0], info.fy + 1, inside(3)[1], [-fx, -fz]);
  await clearToasts();
  await talk(guest('Pip'));
  t.ok((await toasts()).includes("Pip: I'm so hungry") && !(await page.evaluate(() => window.pokecraft.inBattle)), `Pip says his own line, no battle (${await toasts()})`);
  const sv = await page.evaluate(() => { const g = window.pokecraft; return { rosa: g.gymLive.talkPrompt(g.npcs.list.find(x => x.name === 'Granny Rosa')), pip: g.gymLive.talkPrompt(g.npcs.list.find(x => x.name === 'Pip')) }; });
  t.ok(sv.rosa.action === 'Serve!' && sv.pip.action === 'Talk', `the button says Serve! for Granny Rosa (${sv.rosa.action}) and Talk for Pip (${sv.pip.action})`);
  await shot('t33-serve.png', 800);
  await page.evaluate(async () => { // a team that will lose
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('fluffin', 2)];
  });
  await clearToasts();
  await talk(guest('Granny Rosa'));
  const bt = await page.evaluate(() => { const g = window.pokecraft; return { inBattle: g.inBattle, trainer: g.battle?.trainer?.kind, name: g.battle?.trainer?.name }; });
  st = await state();
  t.ok(bt.inBattle && bt.trainer === 'leader' && bt.name === 'Chef Basil', `serving the dish starts the Chef battle (${JSON.stringify(bt)})`);
  t.ok((await toasts()).includes('Yum, Berry Pie!') && st.keys.includes('food:served') && !st.keys.includes('food:cooked'), `Granny Rosa: "Yum, Berry Pie!" (${await toasts()})`);
  await playBattle(page, 'zzz'); // the weak team loses
  await page.waitForTimeout(500);
  await page.evaluate(() => document.exitPointerLock());
  st = await state();
  t.ok(!st.badge && st.keys.includes('food:served') && st.keys.includes('food:berry'), `after losing the dish is still served and the ingredients are kept (${st.keys})`);
  await page.evaluate(async () => {
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.party = ['titanox', 'spectrion', 'stormwyvern'].map(s => makeCreature(s, 70));
  });
  await place(inside(-3, 0)[0], info.fy + 1, inside(-3, 0)[1], [-fx, -fz]);
  const pr = await page.evaluate(() => { const g = window.pokecraft; return g.gymLive.talkPrompt(g.npcs.list.find(x => x.kind === 'leader' && x.gym.def.id === 'food')); });
  t.ok(pr.action === 'Battle!', `the Chef's button says Battle! (${pr.action})`);
  await talk(chef);
  t.ok(await page.evaluate(() => window.pokecraft.inBattle), 'talking to the Chef starts the battle again');
  t.ok(await playBattle(page), 'beat Chef Basil');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.exitPointerLock());
  st = await state();
  t.ok(st.badge && st.keys.split(',').sort().join() === 'food:berry,food:honey,food:pinenut' && st.dish === 'glowsoup' && st.stage === 'none', `the Spoon Badge; the order is done, the three ingredients stay, the next dish is Glowcap Soup (${st.keys}, ${st.dish})`);
  t.ok((await toasts()).includes('Spoon Badge') && (await toasts()).includes('new dish on the menu'), 'the badge and the new-dish toast');

  // 4h. Save and Continue; bad entries; an old save.
  await page.evaluate(() => { document.exitPointerLock(); window.pokecraft.save(true); });
  const saveText = await page.evaluate(() => localStorage.getItem('pokecraft-save-v2'));
  const savedKeys = JSON.parse(saveText).keys;
  t.ok(savedKeys.includes('food:berry') && savedKeys.includes('food:honey'), `the save has the found ingredients (${savedKeys})`);
  const fromSave = async edit => {
    const s = JSON.parse(saveText);
    edit(s);
    const p = await openGame(browser, base, { setup: seedSave(s) });
    await continueGame(p);
    const out = await p.evaluate(async () => {
      const g = window.pokecraft, R = await import('/src/restaurant.js'), def = g.world.gyms.find(x => x.def.id === 'food').def;
      g.world.foodSources = new Set(Object.keys(def.ingredients));
      const o = R.orderState(g, def);
      return { keys: g.keys.filter(k => k.startsWith('food:')).join(), stage: o.stage, dish: o.dish.id };
    });
    await p.context().close();
    return out;
  };
  let v = await fromSave(s => { s.badges = s.badges.filter(b => b !== 'food'); delete s.rematchWins; s.keys = ['food:order', 'food:cooked', 'food:nope', 'food:berry', 42]; });
  t.ok(v.keys === 'food:order,food:cooked,food:berry' && v.stage === 'cooked' && v.dish === 'berrypie', `bad key entries are dropped, the dish is still cooked (${JSON.stringify(v)})`);
  v = await fromSave(s => { delete s.keys; s.badges = s.badges.filter(b => b !== 'food'); });
  t.ok(v.keys === '' && v.stage === 'none', 'an old save without keys has no open order');

  // 4i. A rematch is the next dish. Glowcap Soup: the pine nut already counts, only the glowcap is missing.
  await place(inside(-3, 0)[0], info.fy + 1, inside(-3, 0)[1], [-fx, -fz]);
  await clearToasts();
  await talk(chef);
  msg = await toasts();
  t.ok(msg.includes('Table 4 (yellow) wants Glowcap Soup') && msg.includes('🍄') && !msg.includes('🌰 pine'), `the rematch order: ${msg}`);
  await platform(page);
  await breakNatural(B.GLOWCAP);
  t.ok((await state()).stage === 'cook', 'a glowcap is all that was missing');
  await place(inside(-5, -5)[0], info.fy + 1, inside(-5, -5)[1], [-fx, -fz], 0.35);
  await page.evaluate(() => { window.__T = 100; window.pokecraft.gymLive.of('food').now = () => window.__T; });
  await tapPot();
  await at(3.5);
  t.ok((await potBlock()) === B.POT_GOLDEN, 'Glowcap Soup: golden after 3 s');
  await tapPot();
  t.ok((await state()).stage === 'cooked', 'cooked');
  await place(inside(3)[0], info.fy + 1, inside(3)[1], [-fx, -fz]);
  await talk(guest('Granny Rosa'));
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)) && (await toasts()).includes('Is my') === false, 'Granny Rosa is not at table 4: her own line');
  await clearToasts();
  await talk(guest('Tilly'));
  const rb = await page.evaluate(() => { const g = window.pokecraft; return { inBattle: g.inBattle, levels: g.battle?.foes.map(c => c.level), boost: g.battle?.xpBoost }; });
  const expect = await page.evaluate(async () => { const { rematchTeam } = await import('/src/rematch.js'); const g = window.pokecraft; return rematchTeam(g.world.gyms.find(x => x.def.id === 'food').def, 0).map(x => x[1]); });
  t.ok(rb.inBattle && rb.boost === 1.5 && JSON.stringify(rb.levels) === JSON.stringify(expect), `serving Tilly starts the rematch with the tier 1 team (${JSON.stringify(rb)} vs ${JSON.stringify(expect)}, ${await toasts()})`);
  t.ok(await playBattle(page), 'won the rematch');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.exitPointerLock());
  st = await state();
  t.ok(st.wins === 1 && st.dish === 'snowcone' && st.stage === 'none' && !st.keys.includes('food:order'), `rematch win 1; the next dish is Snow Cone (${st.keys}, ${st.dish})`);

  // 4j. On a map without a source the Chef never gets stuck: no glowcap or snow anywhere -> back to Berry Pie, all ingredients known.
  await page.evaluate(() => { window.pokecraft.world.foodSources = new Set(['berry', 'honey', 'pinenut']); });
  st = await state();
  t.ok(st.dish === 'berrypie', `a map with only the base ingredients: the dish is ${st.dish}`);
  await place(inside(-3, 0)[0], info.fy + 1, inside(-3, 0)[1], [-fx, -fz]);
  await clearToasts();
  await talk(chef);
  st = await state();
  t.ok(st.stage === 'cook' && (await toasts()).includes('You already have everything'), `the Chef orders Berry Pie again: nothing to find, just cook (${await toasts()})`);
  // The pot works the same way again.
  await place(inside(-5, -5)[0], info.fy + 1, inside(-5, -5)[1], [-fx, -fz], 0.35);
  await page.evaluate(() => { window.__T = 500; window.pokecraft.gymLive.of('food').now = () => window.__T; });
  await tapPot(); await at(3.5); await tapPot();
  t.ok((await state()).stage === 'cooked', 'and it can be cooked and served again');
  await page.evaluate(() => { window.pokecraft.world.foodSources = new Set(['berry', 'honey', 'pinenut', 'glowcap', 'snow', 'cactus', 'starsugar']); });

  // 4k. Screenshots: the building from outside, the kitchen from the door, and the dish.
  await page.evaluate(async () => {
    const g = window.pokecraft, w = g.world, gym = w.gyms.find(x => x.def.id === 'food'), [fx, fz] = gym.front;
    const { PLANTS } = await import('/src/world.js');
    for (let d = 7; d <= 28; d++) for (let s = -12; s <= 12; s++) {
      const x = gym.x + fx * d + fz * s, z = gym.z + fz * d + fx * s;
      for (let y = 1; y < 47; y++) if (PLANTS.has(w.get(x, y, z))) w.setLive(x, y, z, 0);
    }
  });
  await place(inside(17)[0], info.fy + 6, inside(17)[1], [-fx, -fz], -0.2);
  await shot('t33-restaurant-outside.png');
  await place(inside(7)[0], info.fy + 1, inside(7)[1], [-fx, -fz], 0.0);
  await shot('t33-restaurant-inside.png', 3000);
  await place(inside(-4, -3)[0], info.fy + 1, inside(-4, -3)[1], [-fx, -fz], -0.1);
  await page.evaluate(() => window.pokecraft.gymLive.update(0.3));
  await shot('t33-kitchen.png', 3000);
  t.ok(page.errors.length === 0, `no page errors (${page.errors.join('; ')})`);
  t.ok((await page.evaluate(async () => (await import('/src/sound.js')).sound.errors.length)) === 0, 'no sound errors');
  await page.context().close();

  /* 5. iPad: tap the pot while golden, the Serve! button */
  const pad = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await pad.tap('text=New Game');
  await pad.tap('.starter >> nth=0');
  await pad.waitForTimeout(1500);
  const ipad = await pad.evaluate(async () => {
    const g = window.pokecraft, { GYMS } = await import('/src/gyms.js');
    g.creatures.clear();
    const gym = g.world.gyms.find(x => x.def.id === 'food');
    g.badges = GYMS.filter(x => x.id !== 'food').map(x => x.id);
    g.beaten = ['food:trainer', 'food:trainer2'];
    g.keys = ['food:order', 'food:berry', 'food:honey', 'food:pinenut'];
    g.world.foodSources = new Set(Object.keys(gym.def.ingredients));
    const [fx, fz] = gym.front, [px, py, pz] = gym.pot;
    // stand 3 blocks in front of the pot, in the kitchen, looking at it
    const sx = px + 0.5 - fx * 0 + fx * 3, sz = pz + 0.5 + fz * 3;
    g.player.pos.set(sx, gym.fy + 1, sz); g.player.vel.set(0, 0, 0);
    const dx = px + 0.5 - sx, dz = pz + 0.5 - sz, dy = py + 0.5 - (gym.fy + 1 + 1.6);
    g.player.yaw = Math.atan2(-dx, -dz); g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    window.__T = 0; g.gymLive.of('food').now = () => window.__T;
    return { w: window.innerWidth, h: window.innerHeight, ok: true };
  });
  await pad.waitForTimeout(2500);
  await pad.touchscreen.tap(ipad.w / 2, ipad.h / 2);
  await pad.waitForTimeout(300);
  const c1 = await pad.evaluate(() => window.pokecraft.gymLive.of('food').state());
  t.ok(c1.phase === 'raw', `an iPad tap on the pot starts cooking (${c1.phase})`);
  await pad.evaluate(() => { window.__T += 3.5; window.pokecraft.gymLive.of('food').update(0); });
  await pad.touchscreen.tap(ipad.w / 2, ipad.h / 2);
  await pad.waitForTimeout(300);
  const c2 = await pad.evaluate(() => window.pokecraft.gymLive.of('food').state());
  t.ok(c2.stage === 'cooked', `an iPad tap while golden: the dish is ready (${c2.stage})`);
  const label = await pad.evaluate(() => {
    const g = window.pokecraft, rosa = g.npcs.list.find(x => x.name === 'Granny Rosa');
    return { action: g.gymLive.talkPrompt(rosa).action };
  });
  t.ok(label.action === 'Serve!', `the touch action label for a customer holding the dish is "${label.action}"`);
  // aim at Granny Rosa and read the real button
  await pad.evaluate(() => {
    const g = window.pokecraft, rosa = g.npcs.list.find(x => x.name === 'Granny Rosa'), gym = g.world.gyms.find(x => x.def.id === 'food');
    const [fx, fz] = gym.front;
    g.player.pos.set(rosa.pos.x - fz * 3, gym.fy + 1, rosa.pos.z - fx * 3); // two blocks to her side along the table row (s axis)
    const dx = rosa.pos.x - g.player.pos.x, dz = rosa.pos.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz); g.player.pitch = 0.1;
  });
  await pad.waitForTimeout(2500);
  const real = await pad.evaluate(() => window.pokecraft.touch.actBtn.textContent);
  console.log(`  iPad action button near Granny Rosa: "${real}"`);
  t.ok(pad.errors.length === 0, `no page errors on the iPad (${pad.errors.join('; ')})`);
  await pad.context().close();
}
