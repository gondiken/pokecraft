// T44 (wave 15): the Surprise type and the Room of Doors (plans/T44.md section 11).
// A: the type (data, models, chart, moves, fx, sounds, the wild gift box, spawns, the Book). B: the terrain for three seeds in Node (door layout, walk
// graph, slide path, keeps, the Big Gift). C: the two skill games as pure rules in Node (the Piñata Party, Jack Catch; the bots are in
// tests/doorsbots.mjs). D: live, in a browser (doors, chests, slide, ball pit, springs, a piñata and Jack Catch played by a skilled and a careless
// bot at 60 and 20 steps a second, the Big Gift's ribbons, the gate, Jolly Jax, the crew, wild gift boxes, a reload). E: iPad (the one action
// button, a whack by the big button and by a tap on the piñata). F: two browsers. G: the screenshots.
// SURPRISE_ONLY=data|land|games|live|ipad|pair|shots runs one part; SURPRISE_SKIP_BOSS=1 leaves out the long Boss battles.
// Screenshots (tests/screenshots): t44-hall.png, t44-pinata.png, t44-catch.png, t44-giftbox.png, t44-giftopen.png, t44-bigift.png, t44-family.png, t44-ipad.png.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, continueGame, waitFor as waitFor0, playBattle } from '../helpers.mjs';
const waitFor = (page, fn, arg, ms = 90000) => waitFor0(page, fn, arg, ms); // the software renderer is slow when several browsers are open
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const src = f => import(pathToFileURL(path.join(ROOT, 'src', f)).href);
const only = process.env.SURPRISE_ONLY;
const want = part => !only || only === part || (only === 'shots' && part === 'live');
const IDS = ['giftle', 'bowtower', 'popjack', 'jestergrin', 'pinpop', 'fiestallama', 'partypop'];
const SEEDS = [7, 42, 1234];

const toasts = page => page.evaluate(() => { window.__toasts = []; const g = window.pokecraft, f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; });
const said = (page, re) => page.evaluate(src => window.__toasts.some(m => new RegExp(src).test(m)), re.source);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id);
// the Swirl, then the gift-wrapped frame (the real way in)
async function intoDoors(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  await waitFor(page, () => { const f = window.pokecraft.world.swirl.frames.find(f => f.world === 'doors'); return window.pokecraft.world.get(...f.cloth[0]) === 144; }, null, 150000);
  await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'doors'), c = f.cloth[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: 144 }); });
  await placeIs(page, 'doors');
  await helpers(page);
}
// in-page helpers: step the player and the live part by hand (the frame loop does not move the player while the page has no pointer lock)
const helpers = page => page.evaluate(async () => {
  const g = window.pokecraft, PN = await import('/src/pinata.js');
  const L = () => g.gymLive.of('part:doors');
  window.__live = L;
  L().playing = () => true; // the live part runs without pointer lock in the tests (the iPad test keeps the real rule)
  window.__step = (n, dt = 0.05, each) => { for (let i = 0; i < n; i++) { g.player.update(dt); g.gymLive.update(dt); each?.(i); } };
  window.__at = (x, y, z, yaw = 0, pitch = 0) => { const p = g.player; p.carry?.leave?.(false); p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.keys = {}; };
  window.__look = (x, y, z) => g.player.lookAt({ x, y, z });
  window.__blk = (x, y, z) => ({ x, y, z, id: g.world.get(x, y, z) });
  window.__plan = () => g.world.doorsPlan;
  window.__pinAt = tt => PN.pinataAt(L().pn.run, tt);
  window.__clearBows = () => { for (let i = 1; i <= 4; i++) { const k = `pw:doors:bow${i}`; const j = g.beaten.indexOf(k); if (j >= 0) g.beaten.splice(j, 1); } };
  window.__resetGames = () => { const lv = L(); lv.pn = { phase: 'idle', round: 0, run: null, t: 0, resultT: 0, swingT: 9, silly: 0, burstAt: null }; lv.attempts = [0, 0, 0, 0]; lv.misses = [0, 0, 0, 0]; lv.jc = { phase: 'idle', run: null, t: 0, resultT: 0, splatT: 9, won: false, open: new Map() }; lv.jcAttempt = 0; lv.jcMisses = 0; lv.restoreNooks(); lv.unslow(); lv.syncPopBoxes(); };
});
async function shot(page, name, spot, wait = 2500) {
  if (spot) await page.evaluate(([x, y, z, yaw, pitch]) => window.__at(x, y, z, yaw, pitch), spot);
  await page.evaluate(() => document.getElementById('pause')?.classList.add('hidden'));
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `t44-${name}.png`), timeout: 180000 });
  console.log(`  screenshot t44-${name}.png`);
}

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);

  /* ======================================== A. the type ======================================== */
  if (want('data')) {
    const a = await page.evaluate(async ids => {
      const S = await import('/src/species.js'), SH = await import('/src/shapes.js'), FX = await import('/src/fxrecipes.js'), R = await import('/src/realms.js');
      const SR = await import('/src/spawnrules.js'), THREE = await import('three'), BK = await import('/src/blocks.js');
      const src = await (await fetch('/src/sound.js')).text();
      const fixture = await (await fetch('/tests/fixtures/chart-before-t44.json')).json();
      const out = { problems: [] };
      const bad = m => out.problems.push(m);
      const sur = Object.entries(S.SPECIES).filter(([, s]) => s.type === 'surprise').map(([id]) => id).sort();
      out.sur = sur.join();
      const fam = { giftle: ['bowtower', 22], popjack: ['jestergrin', 22], pinpop: ['fiestallama', 24] };
      for (const [id, [into, lv]] of Object.entries(fam)) { const e = S.SPECIES[id].evolve; if (!e || e.into !== into || e.level !== lv) bad(`${id} evolves into ${into} at ${lv}`); }
      if (S.SPECIES.partypop.evolve) bad('partypop is single-stage');
      const shapes = ['giftbox', 'jackbox', 'pinata', 'partypopper'];
      for (const sh of shapes) {
        if (typeof SH.SHAPES[sh] !== 'function') bad(`no shape ${sh}`);
        if (Object.values(S.SPECIES).some(s => s.model.shape === sh && s.type !== 'surprise')) bad(`shape ${sh} is used by another type`);
      }
      out.shapesUsed = new Set(sur.map(id => S.SPECIES[id].model.shape)).size;
      for (const id of ids) { const s = S.SPECIES[id]; if (!s || s.type !== 'surprise') { bad(`${id} is not surprise`); continue; } if (!s.desc || s.desc.length > 110) bad(`${id} desc ${s.desc?.length}`); if (s.gait !== 'gift') bad(`${id} gait`); }
      // moves and big moves
      const M = S.MOVES;
      const m = (id, power, acc) => { if (!M[id] || M[id].type !== 'surprise' || M[id].power !== power || Math.abs(M[id].acc - acc) > 1e-9) bad(`move ${id} ${JSON.stringify(M[id])}`); };
      m('ribbonwhip', 40, 1); m('springpunch', 80, 0.9); m('peekapop', 50, 1); m('guesswhat', 0, 0.95); m('tadaa', 95, 0.95); m('candyburst', 22, 1);
      if (!M.peekapop.priority || M.guesswhat.fx.kind !== 'lower' || M.tadaa.fx.kind !== 'flinch' || !M.tadaa.sig || M.candyburst.fx.kind !== 'multi' || M.candyburst.fx.min !== 3 || M.candyburst.fx.max !== 5 || !M.candyburst.sig || !M.candyburst.sure) bad('move effects');
      for (const id of ['giftle', 'popjack', 'pinpop', 'partypop']) { const lm = S.SPECIES[id].learn.map(e => e[1]); for (const need of ['ribbonwhip', 'springpunch', 'peekapop', 'guesswhat']) if (!lm.includes(need)) bad(`${id} does not learn ${need}`); }
      const bigs = { surpriseparty: 'rally', mysterybox: 'risky', wrapitup: 'shield' };
      out.big = Object.entries(bigs).map(([id, k]) => [id, S.isBig(id), S.MOVES[id]?.fx?.kind === k]).join(';');
      for (const id of ids) { const lm = S.SPECIES[id].learn; for (const [lv, mv] of lm) if (bigs[mv] && lv !== S.BIG_LEVEL[bigs[mv]]) bad(`${id} learns ${mv} at ${lv}`); if (!Object.keys(bigs).every(b => lm.some(e => e[1] === b))) bad(`${id} lacks big moves`); }
      if (!S.SPECIES.jestergrin.learn.some(e => e[1] === 'tadaa') || !S.SPECIES.fiestallama.learn.some(e => e[1] === 'candyburst')) bad('signature moves');
      const names = [...Object.keys(M)].filter(k => M[k].type === 'surprise');
      for (const id of names) if (new RegExp(`(^|\\n)\\s*['"]?${id}['"]?\\s*:\\s*\\(`).test(src)) bad(`move id ${id} is a sound name`);
      // fx and sound: its own entries
      if (!FX.TRAVEL.surprise || FX.TRAVEL.surprise === FX.TRAVEL.normal || FX.IMPACT.surprise === FX.IMPACT.normal || FX.FX_COLORS.surprise === FX.FX_COLORS.normal || !FX.FX_COLORS.surprise) bad('fx falls back to normal');
      if (!FX.SIG.tadaa || !FX.SIG.candyburst) bad('no signature fx');
      if (!/'fx:surprise': \(\) =>/.test(src)) bad('no own fx:surprise sound');
      for (const id of ['giftopen', 'giftgiggle', 'doorwhoosh', 'rightdoor', 'sillyhonk', 'jackpop', 'boop', 'pinatawhack', 'candyrain', 'jackcatch', 'piesplat']) { if (!new RegExp(`\\n\\s*${id}: \\(`).test(src)) bad(`sound ${id}`); if (S.MOVES[id]) bad(`sound ${id} is a move id`); }
      // models: build, fit, animate, wear the bow
      const sig = g => { let sum = 0; g.updateMatrixWorld(true); g.traverse(o => { if (o.isMesh) { for (const v of o.matrixWorld.elements) sum += v; } }); return sum; };
      out.sizes = {};
      for (const id of ids) {
        const mdl = S.buildModel(id); S.animateModel(mdl, 0);
        const box = new THREE.Box3().setFromObject(mdl), size = box.getSize(new THREE.Vector3());
        out.sizes[id] = [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)].join('x');
        if (size.y < 0.5 || size.y > 2.4) bad(`${id} height ${size.y.toFixed(2)}`);
        if (size.x > 2.4 || size.z > 2.4) bad(`${id} width ${size.x.toFixed(2)}`);
        if (box.min.y < -0.1) bad(`${id} under the ground ${box.min.y.toFixed(2)}`);
        S.animateModel(mdl, 0.3, false); const a1 = sig(mdl); S.animateModel(mdl, 1.1, false); const a2 = sig(mdl);
        if (Math.abs(a1 - a2) < 1e-6) bad(`${id} does not animate`);
        let bows = 0, eyes = 0; mdl.traverse(o => { if (o.userData.gear === 'bow') bows++; if (o.userData.eye) eyes++; });
        if (bows < 3) bad(`${id} wears no ribbon bow (${bows} bow meshes)`);
        if (eyes < 2) bad(`${id} has no eyes`);
        S.disposeModel(mdl);
      }
      // spawns: only the room's own table, only on the gift condition, never in the main SPAWNS
      const inMain = Object.values(S.SPAWNS).flat().filter(e => ids.includes(e[0])).length;
      const doors = R.REALMS.doors.spawns;
      if (inMain) bad('Surprise creatures are in the main SPAWNS');
      if (!doors.doors?.length || doors.doors.length !== 7 || !doors.doors.every(e => e[2] === 'gift' && ids.includes(e[0]))) bad('doors spawns');
      if (!SR.CONDITIONS.gift?.place || SR.CONDITIONS.gift.share || !/gift box/.test(SR.CONDITIONS.gift.text)) bad('gift condition');
      // the chart: its own row, the five lines, no old cell changed
      const E = S.effectiveness;
      out.chart = ['parkour', 'pirate', 'dream', 'surprise', 'metal', 'time'].map(d => E('surprise', d)).join() + '|' + ['paper', 'ball', 'bug', 'ghost', 'camo'].map(a => E(a, 'surprise')).join();
      const old = fixture.types; let changed = 0, cells = 0;
      for (const a of old) for (const d of old) { cells++; if (E(a, d) !== (fixture.chart[a][d] ?? 1)) changed++; }
      out.cells = cells; out.changed = changed;
      out.types = Object.keys(S.TYPE_COLORS).length;
      if (!S.TYPE_COLORS.surprise) bad('no type colour');
      // blocks: 235-243, the tiles
      const B = BK.B, W = BK.WOOL;
      const ids2 = { 235: W.surprise, 236: B.GIFT_WALL, 237: B.PARTY_FLOOR, 238: B.GIFT_DOOR, 239: B.GOLD_DOOR, 240: B.POP_BOX, 241: B.POP_BOX_OPEN, 242: B.BALL_PIT, 243: B.RIBBON };
      for (const [k, v] of Object.entries(ids2)) if (+k !== v) bad(`block id ${k} is ${v}`);
      for (const id of [236, 237, 238, 239, 240, 241, 242, 243]) { const d = BK.BLOCKS[id]; if (!d || !d.fixed || BK.PLACEABLE.includes(id)) bad(`block ${id} is not fixed / is placeable`); }
      if (BK.BLOCKS[B.BALL_PIT].bounce !== 3 || !BK.BLOCKS[B.GOLD_DOOR].glow || !BK.BLOCKS[B.RIBBON].glow) bad('block flags');
      if (!BK.BLOCKS[W.surprise] || BK.BLOCKS[W.surprise].name !== 'Surprise Wool') bad('wool');
      out.tiles = ['SU_WRAP', 'SU_FLOOR', 'SU_DOOR', 'SU_DOOR_TOP', 'SU_GOLD_DOOR', 'SU_BOX_TOP', 'SU_BOX_SIDE', 'SU_BOX_OPEN', 'SU_BALLS', 'SU_RIBBON'].every(n => BK.T[n] != null);
      return out;
    }, IDS);
    t.ok(a.sur === [...IDS].sort().join(), `seven Surprise creatures (${a.sur})`);
    t.ok(a.shapesUsed >= 3, `at least 3 own body shapes (${a.shapesUsed})`);
    t.ok(!a.problems.length, `species, shapes (own, bow on every model), moves, big moves, fx, sounds, spawns and blocks are all in place ${a.problems.join('; ')}`);
    t.ok(a.big === 'surpriseparty,true,true;mysterybox,true,true;wrapitup,true,true', `the three big moves (${a.big})`);
    t.ok(a.chart === '2,2,2,0.5,0.5,0.5|2,2,2,0.5,0.5', `the chart: its own row and the five separate lines (${a.chart})`);
    t.ok(a.changed === 0 && a.cells > 1300, `no old chart cell changed (${a.cells} cells of the ${a.types - 1} old types compared with the chart before T44)`);
    t.ok(a.tiles, 'every SU_ tile is in the atlas');
    console.log('  sizes ' + JSON.stringify(a.sizes));

    // the wild gift box
    const w = await page.evaluate(async ids => {
      const g = window.pokecraft, S = await import('/src/species.js'), SH = await import('/src/shapes.js');
      const out = { problems: [], papers: {} };
      const bad = m => out.problems.push(m);
      const p = g.player.pos, sx = Math.floor(p.x), sz = Math.floor(p.z), y = g.world.surface(sx, sz).y + 1;
      const wilds = ids.map((id, i) => g.creatures.spawnAt(id, sx + 2 + i, y, sz + 4, { level: 5, when: 'gift' }));
      wilds.forEach((wd, i) => {
        if (!wd?.wrapped || !wd.wrapBox || wd.model.userData.parts.root.visible) bad(`${ids[i]} is not wrapped`);
        let wrap = 0; wd.wrapBox.traverse(o => { if (o.userData.gear === 'wrap') wrap++; });
        if (wrap !== 2) bad(`${ids[i]} box meshes ${wrap}`);
        out.papers[ids[i]] = wd.paper;
        const rare = S.SPECIES[ids[i]].baseXp >= 100;
        if (rare !== (wd.paper === 'gold')) bad(`${ids[i]}: gold paper only for a rarer one (${wd.paper})`);
      });
      // the same paper = the same geometry (the look does not depend on the species)
      const byPaper = {};
      for (const wd of wilds) { const gg = wd.wrapBox.userData.body.geometry; (byPaper[wd.paper] ||= new Set()).add(gg); }
      if (Object.values(byPaper).some(s => s.size !== 1)) bad('one paper, two geometries');
      // 40 common creatures: the paper comes from the uid and is stable; five common papers are all used
      const seen = new Set();
      for (let i = 0; i < 40; i++) { const pp = SH.giftPaperOf(`u${i}`, false); if (pp !== SH.giftPaperOf(`u${i}`, false) || pp.gold) bad('paper not stable / gold for a common one'); seen.add(pp.name); }
      out.commonPapers = seen.size;
      // a gold box is a rarer one
      if (!SH.giftPaperOf('x', true).gold) bad('rare is gold');
      // the wobble and the giggle (closed form): near it hops
      const wd = wilds[0]; g.creatures.viewer = new (p.constructor)(sx + 2.5, y, sz + 4.5); // 0.5 away
      out.near0 = wd.wrapBox.position.y;
      g.creatures.updateOne(wd, 0.016);
      out.nearHop = wd.wrapBox.position.y;
      for (const w2 of wilds) g.creatures.remove(w2);
      out.left = g.creatures.list.length;
      return out;
    }, IDS);
    t.ok(!w.problems.length, `a wild Surprise creature is a gift box with its creature hidden; gold paper only for a rarer one (${JSON.stringify(w.papers)}) ${w.problems.join('; ')}`);
    t.ok(w.commonPapers === 5, `the paper comes from the uid and is stable; all five common papers occur (${w.commonPapers})`);
    t.ok(w.nearHop > 0, 'close to a box it hops (and giggles)');
  }

  /* ======================================== B. the terrain (Node) ======================================== */
  if (want('land')) await landPart(t);

  /* ======================================== C. the two games (Node) ======================================== */
  if (want('games')) await gamesPart(t);

  /* ======================================== D. live ======================================== */
  if (want('live')) await livePart({ browser, base, t, page });

  /* ======================================== E. iPad ======================================== */
  if (want('ipad')) await ipadPart({ browser, base, t });

  /* ======================================== F. two browsers ======================================== */
  if (want('pair')) await pairPart({ browser, base, t });

  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
}

/* ============================================================================================ */
/* B. the terrain                                                                                */
/* ============================================================================================ */

async function landPart(t) {
  const L = await src('doorsland.js'), Bk = await src('blocks.js');
  const { B, WOOL, isSolid, BLOCKS } = Bk;
  const W = 112, D = 112, H = 48;
  const standIn = seed => {
    const w = { W, D, H, data: new Uint8Array(W * D * H), ground: new Int16Array(W * D), seed };
    w.index = (x, y, z) => x + W * (z + D * y);
    w.inBounds = (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < H;
    w.get = (x, y, z) => (w.inBounds(x, y, z) ? w.data[w.index(x, y, z)] : 0);
    return w;
  };
  const layouts = [];
  for (const seed of SEEDS) {
    const w = standIn(seed);
    L.doorsLand(w, { id: 'doors' });
    const plan = w.doorsPlan;
    layouts.push(plan.kinds.join());
    const tag = `seed ${seed}`;

    // 1. the door layout: fixed gold doors, every kind once
    const kinds = plan.kinds;
    t.ok(kinds[1] === 'wrapping' && kinds[4] === 'popup' && kinds[7] === 'gift' && L.KINDS.every(k => kinds.filter(x => x === k).length === 1) && kinds.length === 12, `${tag}: slot 1 the Wrapping Room, 4 the Pop-Up Room, 7 the Big Gift, the nine kinds once each (${kinds.join(' ')})`);
    // 2. the doors
    let doorsOk = true, frames = new Set();
    for (const r of plan.rooms) {
      const want = r.kind === 'wrapping' ? B.AIR : r.gold ? B.GOLD_DOOR : B.GIFT_DOOR;
      for (const [x, y, z] of r.door.cells) if (w.get(x, y, z) !== want) doorsOk = false;
      if (r.door.cells.length !== 12) doorsOk = false;
      if (!r.gold) frames.add(r.frame);
    }
    t.ok(doorsOk && frames.size === 9, `${tag}: every door is 3 wide x 4 high (the Wrapping Room's stands open, the gold ones are gold, the other nine each have their own frame colour: ${frames.size})`);

    // 3. the walk graph: a player box can reach every room with its door open, nobody is stuck, the Boss only through the opened Big Gift
    const walk = buildGraph(w, plan, { Bk, L }, true);
    const arrival = w.arrivals.doors, startKey = node(Math.floor(arrival[0]), Math.floor(arrival[1]), Math.floor(arrival[2]));
    const seen = bfs(walk, [startKey]);
    t.ok(seen.has(startKey), `${tag}: the arrival is a place you can stand`);
    const missing = [];
    for (const r of plan.rooms) { if (![...seen].some(k => inRoom(k, r))) missing.push(`${r.k}:${r.kind}`); }
    const slideTop = node(Math.floor(plan.slide.stand[0]), plan.slide.stand[2], Math.floor(plan.slide.stand[1]));
    const ledge = plan.springs.ledge[0], ledgeStand = node(ledge[0], 14, ledge[2]);
    const pit = plan.pit.cells[0], pitStand = node(pit[0], 10, pit[1]);
    t.ok(!missing.length, `${tag}: every room is reachable from the arrival ${missing.join(', ')}`);
    t.ok(seen.has(slideTop) && seen.has(ledgeStand) && seen.has(pitStand), `${tag}: the slide's platform (up the stairs), the springs' balcony (bouncing) and the ball pit floor can be reached`);
    const g = plan.gift, bossNode = node(Math.floor(g.bossAt[0]), 11, Math.floor(g.bossAt[1])); // bossAt = [x, z]
    t.ok(!seen.has(bossNode), `${tag}: with the Big Gift shut nobody reaches the Boss`);
    const open = buildGraph(w, plan, { Bk, L }, true, { giftOpen: true });
    const seenOpen = bfs(open, [startKey]);
    t.ok(seenOpen.has(bossNode), `${tag}: with the front open (4 bows) the Boss's stand can be reached`);
    // nobody stuck: from every reachable place there is a way back to the hall (reverse graph)
    const rev = new Map();
    for (const [a, bs] of seenOpen.size ? open : walk) for (const b of bs) { if (!rev.has(b)) rev.set(b, []); rev.get(b).push(a); }
    const hallKey = node(56, 11, 60);
    const back = bfs(rev, [hallKey]);
    const stuck = [...seenOpen].filter(k => !back.has(k));
    t.ok(!stuck.length, `${tag}: nobody is stuck in any room, the slide's end, the pit, the balcony or the Big Gift (${stuck.length} places with no way back${stuck.length ? ': ' + stuck.slice(0, 3).join(' ') : ''})`);

    // 4. the slide: the path is clear for the player box at every 0.05 s and ends on the floor
    const slide = plan.slide, N = 1;
    void N;
    const { PATHS } = await src('mover.js');
    let len = 0; for (let i = 0; i + 1 < slide.path.length; i++) len += Math.hypot(...[0, 1, 2].map(a => slide.path[i + 1][a] - slide.path[i][a]));
    const path_ = PATHS.line({ points: slide.path, speed: len / slide.time });
    let hit = 0, last = null;
    for (let s = 0; s <= path_.time + 1e-9; s += 0.05) {
      const q = path_.at(s); last = q;
      for (let x = Math.floor(q.x - 0.3); x <= Math.floor(q.x + 0.3); x++) for (let z = Math.floor(q.z - 0.3); z <= Math.floor(q.z + 0.3); z++) for (let y = Math.floor(q.y + 1e-6); y <= Math.floor(q.y + 1.8); y++) if (isSolid(w.get(x, y, z))) hit++;
    }
    t.ok(hit === 0 && Math.abs(last.y - 11) < 1e-6 && Math.abs(path_.time - 2.2) < 1e-6, `${tag}: the slide path is clear for the player box every 0.05 s, takes ${path_.time.toFixed(2)} s and ends on the floor (y ${last.y.toFixed(2)})`);

    // 5. keeps cover the doors' frames, the stage, the pad, the gift, the grid, the slide, the springs and the pit
    const covered = (x, y, z) => w.keeps.some(k => k.protect.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1));
    const lists = {
      frames: plan.rooms.flatMap(r => [-2, 2].map(u => { const [x, z] = L.cellOf(r.k, u, 0); return [x, 12, z]; })),
      ring: [[Math.floor(L.RING.x), 10, Math.floor(L.RING.z)], [Math.floor(L.RING.x - L.RING.r) + 1, 12, Math.floor(L.RING.z)], [Math.floor(L.RING.x), 18, Math.floor(L.RING.z + L.RING.r) - 1]], pad: [[L.RING.pad.x0, 10, L.RING.pad.z0], [L.RING.pad.x1, 10, L.RING.pad.z1]],
      gift: g.surface.slice(0, 30), grid: plan.popup.boxes.map(b => b.cell), slide: [...plan.slide.blocks.slice(0, 20), ...plan.slide.platform.slice(0, 10)], springs: plan.springs.pads.slice(0, 10), pit: plan.pit.cells.map(([x, z]) => [x, 9, z]),
    };
    const unc = Object.entries(lists).filter(([, l]) => l.some(c => !covered(...c))).map(([k]) => k);
    t.ok(!unc.length, `${tag}: keeps cover ${Object.keys(lists).join(', ')} ${unc.join(', ')}`);

    // 6. the Big Gift's ribbons and front
    const cellsOf = list => list.every(([x, y, z]) => w.get(x, y, z) === B.RIBBON);
    t.ok(g.ribbons.every(l => l.length > 6 && cellsOf(l)) && new Set(g.ribbons.flat().map(c => c.join())).size === g.ribbons.flat().length, `${tag}: four ribbons (${g.ribbons.map(l => l.length).join('/')} cells, all RIBBON, none shared)`);
    t.ok(g.front.length === 25 && g.front.every(([x, y, z]) => w.get(x, y, z) === B.GIFT_WALL || w.get(x, y, z) === B.RIBBON), `${tag}: the front is 5 x 5 cells of wrap (${g.front.length})`);
    const boss = w.bosses[0];
    t.ok(boss.id === 'doors' && w.get(Math.floor(boss.pos[0]), 10, Math.floor(boss.pos[2])) === B.BOSS_STAND && boss.crew.length === 2, `${tag}: Jolly Jax stands on a Boss stand inside the gift, two helpers behind surprise doors`);
    const crewRooms = boss.crew.map(c => plan.rooms.find(r => ['trainer1', 'trainer2'].includes(r.kind) && L.inBox({ ...r.inner, y0: 10, y1: 30 }, Math.floor(c.pos[0]), 11, Math.floor(c.pos[2]))));
    t.ok(crewRooms.every(Boolean) && crewRooms[0] !== crewRooms[1], `${tag}: the two helpers stand in the two trainer rooms`);
    // 7. nooks: 12 spots, each an air cell on a solid one, none near the piñata's rug
    const nk = w.nooks;
    t.ok(nk.length === 12 && nk.every(n => w.get(n.x, n.y, n.z) === B.AIR && isSolid(w.get(n.x, n.y - 1, n.z)) && Math.hypot(n.x + 0.5 - L.RING.x, n.z + 0.5 - L.RING.z) > L.RING.r + 3), `${tag}: ${nk.length} nook spots (4 in the shop, 8 by the hall's walls, all far from the rug), all on something solid`);
    // 7b. the rug: flat floor, nothing to trip over, open sky for the balloons; the pad is on it
    let bumps = 0, rimWool = 0;
    for (let x = Math.floor(L.RING.x - L.RING.r) - 1; x <= Math.ceil(L.RING.x + L.RING.r); x++) for (let z = Math.floor(L.RING.z - L.RING.r) - 1; z <= Math.ceil(L.RING.z + L.RING.r); z++) {
      const d = Math.hypot(x + 0.5 - L.RING.x, z + 0.5 - L.RING.z);
      if (d > L.RING.r + 3.5) continue;
      if (!isSolid(w.get(x, 10, z))) bumps++;
      for (let y = 11; y <= 24; y++) if (w.get(x, y, z) !== B.AIR) bumps++;
      if (d <= L.RING.r && d > L.RING.r - 0.9 && w.get(x, 10, z) === WOOL.surprise) rimWool++;
    }
    t.ok(!bumps && rimWool >= 36 && w.get(L.RING.pad.x0, 10, L.RING.pad.z0) === WOOL.treasure, `${tag}: the piñata's rug and 3.5 blocks round it are flat floor with open air above (${bumps} bumps), a wool rim of ${rimWool}, a gold start pad`);
    // 8. rooms stay inside the map and the building is walls all round
    const out = [];
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = 11; y <= 22; y++) { const id = w.get(x, y, z); if (id !== B.AIR && (x < 20 || x > 92 || z < 5 || z > 95)) out.push([x, y, z]); }
    t.ok(!out.length, `${tag}: the building stays inside its corner of the map`);
    void WOOL; void BLOCKS;
  }
  t.ok(new Set(layouts).size >= 2, `the door layout differs between seeds (${new Set(layouts).size} different of ${SEEDS.length})`);
  t.ok(JSON.stringify(L.doorLayout(7)) === JSON.stringify(L.doorLayout(7)) && L.doorLayout(7).length === 12, 'the layout is a pure function of the seed');

  /* ---- the graph helpers (a player box walking: step up 1 with a jump, down any way, springs and the slide as gadgets) ---- */
  function node(x, y, z) { return `${x},${y},${z}`; }
  function parse(k) { return k.split(',').map(Number); }
  function inRoom(k, r) { const [x, y, z] = parse(k); return x >= r.inner.x0 && x <= r.inner.x1 && z >= r.inner.z0 && z <= r.inner.z1 && y >= 10 && y <= 20; }
  function bfs(graph, starts) {
    const seen = new Set(starts.filter(s => graph.has(s) || true)), q = [...starts];
    while (q.length) { const a = q.pop(); for (const b of graph.get(a) || []) if (!seen.has(b)) { seen.add(b); q.push(b); } }
    return seen;
  }
  function buildGraph(w, plan, { Bk }, doorsOpen, { giftOpen = false } = {}) {
    const { B, isSolid, BLOCKS } = Bk;
    const get = (x, y, z) => {
      const id = w.get(x, y, z);
      if (doorsOpen && (id === B.GIFT_DOOR || id === B.GOLD_DOOR)) return B.AIR;
      if (giftOpen && plan.gift.front.some(c => c[0] === x && c[1] === y && c[2] === z)) return B.AIR;
      return id;
    };
    const solid = (x, y, z) => isSolid(get(x, y, z));
    const stand = (x, y, z) => solid(x, y - 1, z) && !solid(x, y, z) && !solid(x, y + 1, z);
    const graph = new Map();
    const add = (a, b) => { if (!graph.has(a)) graph.set(a, []); graph.get(a).push(b); };
    for (let x = 20; x < 93; x++) for (let z = 5; z < 96; z++) for (let y = 10; y <= 19; y++) {
      if (!stand(x, y, z)) continue;
      const a = node(x, y, z);
      if (!graph.has(a)) graph.set(a, []);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (stand(nx, y, nz)) add(a, node(nx, y, nz));                                           // along
        else if (!solid(nx, y, nz) && !solid(nx, y + 1, nz)) { for (let d = 1; d <= 6; d++) { if (solid(nx, y - d, nz)) { if (stand(nx, y - d + 1, nz)) add(a, node(nx, y - d + 1, nz)); break; } if (solid(nx, y - d + 1, nz)) break; } } // down
        if (stand(nx, y + 1, nz) && !solid(x, y + 2, z)) add(a, node(nx, y + 1, nz));            // up one (a jump)
      }
      const below = get(x, y - 1, z);
      if (BLOCKS[below]?.bounce) { // a bounce pad: a jump reaches up to `bounce` - 0.5 blocks over the next few cells
        const up = BLOCKS[below].bounce - 0.5;
        for (let ddx = -4; ddx <= 4; ddx++) for (let ddz = -4; ddz <= 4; ddz++) for (let yy = y; yy <= y + up; yy++) {
          if (Math.hypot(ddx, ddz) > 4 || !stand(x + ddx, yy, z + ddz)) continue;
          let clear = true; for (let c = y; c <= yy + 2; c++) if (solid(x, c, z)) clear = false;
          for (const f of [0.25, 0.5, 0.75]) for (let c = yy + 1; c <= yy + 2; c++) if (solid(Math.round(x + ddx * f), c, Math.round(z + ddz * f))) clear = false; // no jumping through a wall
          if (clear) add(a, node(x + ddx, yy, z + ddz));
        }
      }
    }
    // the slide: from the platform to the floor at the end of its path
    const s = plan.slide, end = s.path[s.path.length - 1];
    add(node(Math.floor(s.stand[0]), s.stand[2], Math.floor(s.stand[1])), node(Math.floor(end[0]), Math.round(end[1]), Math.floor(end[2])));
    return graph;
  }
}

/* ============================================================================================ */
/* C. the two games                                                                              */
/* ============================================================================================ */

async function gamesPart(t) {
  const P = await src('pinata.js'), J = await src('jackcatch.js'), L = await src('doorsland.js');
  const Bt = await import(pathToFileURL(path.join(ROOT, 'tests', 'doorsbots.mjs')).href);
  const { PINATA } = P;

  /* ---- the Piñata Party ---- */
  // 1. a plan replays; another try or another player is another piñata
  const a = JSON.stringify(P.pinataPlan(11, 2, 3)), b = JSON.stringify(P.pinataPlan(11, 2, 3)), c = JSON.stringify(P.pinataPlan(11, 2, 4)), d = JSON.stringify(P.pinataPlan(12, 2, 3));
  t.ok(a === b && a !== c && a !== d, 'a piñata try is a pure function of seed / piñata / try (the same twice, another try or seed is another path and swing)');
  t.ok(PINATA.rounds.map(r => r.id).join() === 'llama,star,rocket' && PINATA.rounds.map(r => r.hp).join() === '5,7,9', `three piñatas, harder each time (CRACKs ${PINATA.rounds.map(r => r.hp)}, swings ${PINATA.rounds.map(r => r.period)} s, balloons ${PINATA.rounds.map(r => r.speed)} b/s, dodge ${PINATA.rounds.map(r => r.dodge)})`);
  // 2. the closed form: smooth, inside the rug, low in the middle of a swing and high at its ends; the hits and zips change it smoothly too
  let jumps = 0, outside = 0, lowest = 99, highest = 0;
  for (const seed of [1, 2, 3]) for (const round of [1, 2, 3]) {
    const res = Bt.playPinata('kid', P.pinataPlan(seed, round, 0), 1 / 60), run = P.newRun(P.pinataPlan(seed, round, 0));
    for (const [tp, eye, dir] of res.presses) P.whack(run, tp, eye, dir);
    let last = null;
    for (let tt = 0; tt <= res.t; tt += 1 / 120) {
      const q = P.pinataAt(run, tt);
      if (last && Math.hypot(q.x - last.x, q.y - last.y, q.z - last.z) > 0.25) jumps++;
      if (Math.hypot(q.x - PINATA.ring.x, q.z - PINATA.ring.z) > PINATA.ring.r) outside++;
      lowest = Math.min(lowest, q.y); highest = Math.max(highest, q.y); last = q;
    }
  }
  t.ok(!jumps && !outside && Math.abs(lowest - PINATA.low) < 0.05 && highest > PINATA.low + 0.9 && highest < PINATA.low + PINATA.rope, `the piñata moves smoothly (no jumps in 1/120 s steps, hits and zips included), stays over the rug and swings from y ${lowest.toFixed(2)} up to ${highest.toFixed(2)}`);
  // 3. a replay of the same presses gives the same piñata (the presses of a 60 fps try, replayed)
  const plan3 = P.pinataPlan(42, 3, 1), r60 = Bt.playPinata('kid', plan3, 1 / 60), replay = P.newRun(plan3);
  for (const [tp, eye, dir] of r60.presses) P.whack(replay, tp, eye, dir);
  t.ok(JSON.stringify(replay.log) === JSON.stringify(r60.log) && replay.done === r60.won, `replaying a try's presses gives the same hits (${r60.hits} hits, ${r60.big} CRACKs)`);
  // 4. the stick: in front and close = a hit; behind you, too far or too high = nothing; a whiff spins you round for 2 s
  {
    const plan = P.pinataPlan(5, 1, 0), run = P.newRun(plan);
    let tl = 0; for (let tt = 0; tt < 6; tt += 0.01) { const q = P.pinataAt(run, tt); if (q.y < PINATA.low + 0.05) { tl = tt; break; } }
    const q = P.pinataAt(run, tl), v = Math.hypot(q.vx, q.vz), ux = q.vx / v, uz = q.vz / v;
    const front = { x: q.x + ux * 1.5, y: 11 + Bt.EYE, z: q.z + uz * 1.5 }, back = { x: q.x - ux * 1.5, y: 11 + Bt.EYE, z: q.z - uz * 1.5 };
    const toQ = e => ({ x: q.x - e.x, z: q.z - e.z }), away = e => ({ x: e.x - q.x, z: e.z - q.z });
    const checks = [P.inReach(q, front, toQ(front)), !P.inReach(q, front, away(front)), !P.inReach(q, { x: q.x + ux * 3, y: front.y, z: q.z + uz * 3 }, toQ({ x: q.x + ux * 3, z: q.z + uz * 3 })), !P.inReach({ ...q, y: q.y + 2 }, front, toQ(front))];
    const towardsFront = P.towards(q, front), towardsBack = P.towards(q, back);
    t.ok(checks.every(Boolean) && towardsFront > PINATA.bigV && towardsBack < 0, `the stick hits in front within ${PINATA.reach} (not looking away, not 3 away, not 2 too high); it is coming at the one it swings towards (${towardsFront.toFixed(1)} b/s) and going away from the other (${towardsBack.toFixed(1)})`);
    // a CRACK for the one it swings at, a Bonk (no crack) for the one behind it
    const r1 = P.newRun(plan), w1 = P.whack(r1, tl, front, toQ(front));
    const r2 = P.newRun(plan), w2 = P.whack(r2, tl, back, toQ(back));
    t.ok(w1.hit && w1.big && r1.hp === plan.hp - 1 && w2.hit && !w2.big && r2.hp === plan.hp, `whacked as it swings at you = CRACK (${r1.hp} left of ${plan.hp}); whacked from behind = Bonk, no crack (${r2.hp})`);
    // the knock goes the way you hit it, and the balloons zip on
    const after = P.pinataAt(r1, tl + 0.3), top0 = P.topAt(P.newRun(plan), tl + 0.8), top1 = P.topAt(r1, tl + 0.8);
    const kd = toQ(front), kl = Math.hypot(kd.x, kd.z), dot = ((after.x - P.pinataAt(r1, tl).x) * kd.x + (after.z - P.pinataAt(r1, tl).z) * kd.z) / kl;
    const zip = Math.hypot(top1.x - top0.x, top1.z - top0.z);
    t.ok(dot > 0.3 && zip > 1.5, `a hit knocks it the way you whack (${dot.toFixed(2)} blocks that way in 0.3 s) and the balloons zip on (${zip.toFixed(1)} blocks)`);
    const r3 = P.newRun(plan), miss = P.whack(r3, tl, back, away(back)), again = P.whack(r3, tl + 1.0, front, toQ(front)), later = P.whack(r3, tl + PINATA.cool.miss + 0.01, front, toQ(front));
    t.ok(miss.swung && !miss.hit && !again.swung && later.swung, `a whiff: the stick needs ${PINATA.cool.miss} s to come back (a press 1 s later does nothing, after ${PINATA.cool.miss} s it swings again)`);
  }
  // 5. dodges turn the knock (stars and rockets), never the llama
  {
    let llama = 0, star = 0, n = 0;
    for (let s = 0; s < 30; s++) for (const round of [1, 2]) { const res = Bt.playPinata('kid', P.pinataPlan(100 + s, round, 0), 1 / 30); const d = res.log.filter(e => e.dodge).length; if (round === 1) llama += d; else { star += d; n += res.hits; } }
    t.ok(llama === 0 && star > 0 && star < n, `the llama never dodges, the star sometimes does (${star} of ${n} hits)`);
  }
  // 6. who wins: a kid who watches and moves wins all three; whacking all the time standing still never; mashing under it only the first
  const table = {};
  for (const kind of ['kid', 'masher', 'still']) for (const round of [1, 2, 3]) {
    let w = 0, secs = 0;
    for (let k = 0; k < 8; k++) { const res = Bt.playPinata(kind, P.pinataPlan(1000 + k, round, k), 1 / 60); if (res.won) { w++; secs += res.t; } }
    table[`${kind}${round}`] = [w, w ? Math.round(secs / w) : 0];
  }
  const fmt = k => `${table[k][0]}/8${table[k][0] ? ' ~' + table[k][1] + 's' : ''}`;
  t.ok([1, 2, 3].every(r => table[`kid${r}`][0] >= 7) && [1, 2, 3].every(r => table[`still${r}`][0] === 0) && table.masher2[0] === 0 && table.masher3[0] === 0, `a skilled kid wins every piñata (${[1, 2, 3].map(r => fmt('kid' + r))}); standing still and whacking never (${[1, 2, 3].map(r => fmt('still' + r))}); mashing under it wins only the llama (${[1, 2, 3].map(r => fmt('masher' + r))})`);
  // at 60 and 20 steps a second the kid wins the same piñatas
  const fps = [1 / 60, 1 / 20].map(dt => [1, 2, 3].map(r => Bt.playPinata('kid', P.pinataPlan(7, r, 0), dt).won).join());
  t.ok(fps[0] === fps[1] && fps[0] === 'true,true,true', `at 60 and 20 steps a second the kid pops all three (${fps.join(' | ')})`);
  // 7. help after a time-up and a rematch
  const h0 = P.pinataPlan(1, 1, 0), h1 = P.pinataPlan(1, 1, 1, { help: 1 }), h2 = P.pinataPlan(1, 1, 2, { help: 2 }), hd = P.pinataPlan(1, 1, 0, { hard: true });
  t.ok(h1.period > h0.period && h2.period > h1.period && h1.speed < h0.speed && h2.hp === h0.hp - 2 && hd.hp === h0.hp + 2 && hd.period < h0.period, `after a time-up it swings slower (${h0.period} -> ${h1.period.toFixed(2)} -> ${h2.period.toFixed(2)} s), drifts slower and needs fewer CRACKs (${h0.hp} -> ${h1.hp} -> ${h2.hp}); a rematch needs ${hd.hp} and swings faster`);
  let helped = 0; for (let k = 0; k < 8; k++) if (Bt.playPinata('masher', P.pinataPlan(2000 + k, 2, k, { help: 2 }), 1 / 60).won) helped++;
  t.ok(helped >= 1, `with the most help even a whacker who does not watch pops the star sometimes (${helped} of 8)`);

  /* ---- Jack Catch ---- */
  const plan = L.doorsPlan(7), pu = plan.popup, opts = (x = {}) => ({ boxes: pu.boxes, floor: pu.floor, start: pu.pad.centre, ...x });
  const c1 = J.catchPlan(5, 0, opts()), c2 = J.catchPlan(5, 0, opts()), c3 = J.catchPlan(5, 1, opts());
  t.ok(JSON.stringify(c1) === JSON.stringify(c2) && JSON.stringify(c1) !== JSON.stringify(c3), 'a Jack Catch round is a pure function of seed / try');
  const floorSet = new Set(pu.floor.map(([x, z]) => `${Math.floor(x)},${Math.floor(z)}`)), boxSet = new Set(pu.boxes.map(bx => `${bx.cell[0]},${bx.cell[2]}`));
  let bad = 0, maxJump = 0, doubles = 0, closeDoubles = 0, gold = 0, pies = 0, jacks = 0, lastTo = null, firstF = 0, lastF = 0;
  for (let s = 0; s < 20; s++) {
    const cp = J.catchPlan(s, 0, opts()), js = cp.launches.filter(l => l.kind !== 'pie');
    jacks += js.length; gold += js.filter(l => l.kind === 'gold').length; pies += cp.launches.length - js.length;
    firstF += js[0].flight; lastF += js[js.length - 1].flight;
    for (const l of js) { const k = `${Math.floor(l.to[0])},${Math.floor(l.to[1])}`; if (!floorSet.has(k) || boxSet.has(k)) bad++; }
    for (let i = 1; i < js.length; i++) if (Math.abs(js[i].t0 - js[i - 1].t0) < 1e-9) { doubles++; if (Math.hypot(js[i].to[0] - js[i - 1].to[0], js[i].to[1] - js[i - 1].to[1]) < J.CATCH.doubleGap - 0.75) closeDoubles++; }
    void lastTo; void maxJump;
    if (js.length !== J.CATCH.jacks) bad++;
  }
  t.ok(!bad && doubles > 20 && !closeDoubles && gold > 20 && pies > 30 && lastF < firstF * 0.75, `every jack lands on the free floor (never in a box), 16 a round; two at once ${doubles} times (always apart), ${gold} gold jacks, ${pies} pies in 20 rounds; the flights get shorter (${(firstF / 20).toFixed(2)} -> ${(lastF / 20).toFixed(2)} s)`);
  // a pie flies at where you will be: standing still it lands on you, a step aside and it misses
  {
    const cp = J.catchPlan(3, 0, opts()), pie = cp.launches.find(l => l.kind === 'pie');
    const rm = pu.room, mid = [(rm.x0 + rm.x1 + 1) / 2, (rm.z0 + rm.z1 + 1) / 2];
    const free = pu.floor.filter(f => pu.boxes.every(bx => Math.hypot(bx.at[0] - f[0], bx.at[2] - f[1]) > 1.2)).sort((p1, p2) => Math.hypot(p1[0] - mid[0], p1[1] - mid[1]) - Math.hypot(p2[0] - mid[0], p2[1] - mid[1]))[0];
    const stay = J.newCatch(cp), at = { x: free[0], y: 11, z: free[1] };
    let ev = []; for (let tt = 0; tt <= pie.t0 + pie.flight + 0.05; tt += 1 / 60) ev.push(...J.stepCatch(stay, tt, at));
    const moved = J.newCatch(cp), at2 = { x: at.x, y: 11, z: at.z };
    let ev2 = []; for (let tt = 0; tt <= pie.t0 + pie.flight + 0.05; tt += 1 / 60) { if (tt > pie.t0 + 0.3) at2.z = Math.min(at.z + 2, at2.z + 4.3 / 60); ev2.push(...J.stepCatch(moved, tt, at2, { x: 0, z: 0 })); }
    const lead = J.newCatch(cp), at3 = { x: at.x, y: 11, z: at.z }, run3 = [];
    for (let tt = 0; tt <= pie.t0 + 0.02; tt += 1 / 60) run3.push(...J.stepCatch(lead, tt, at3, { x: 0, y: 0, z: 2 }));
    const aim = lead.pieTo.get(pie.n);
    t.ok(ev.some(e => e.type === 'splat' && e.n === pie.n) && J.slowed(stay, pie.t0 + pie.flight + 0.5) && ev2.some(e => e.type === 'plop' && e.n === pie.n) && aim && Math.abs(aim[1] - Math.min(cp.box.z1, at.z + 2 * J.CATCH.pies.lead)) < 0.05 && Math.abs(aim[0] - at.x) < 0.05, `a pie lands on you if you stand still (SPLAT, sticky shoes for ${J.CATCH.pies.slow} s), a step aside and it plops on the floor; running, it aims ${J.CATCH.pies.lead} s ahead of you`);
  }
  // who wins: a kid who runs under the shadows wins nearly always, standing on the pad never (and gets splatted)
  let kid = 0, still = 0, splats = 0, kidScores = [];
  for (let s = 0; s < 10; s++) {
    const cp = J.catchPlan(500 + s, s, opts());
    const k = Bt.playCatch('kid', cp, 1 / 60, pu.pad.centre), st = Bt.playCatch('still', cp, 1 / 60, pu.pad.centre);
    if (k.won) kid++; if (st.won) still++; splats += st.splats; kidScores.push(k.score);
  }
  t.ok(kid >= 7 && still === 0 && splats >= 10, `a skilled kid catches enough in ${kid} of 10 rounds (${kidScores.join(' ')} of about 18, ${J.CATCH.need} win); standing still never (${splats} splats)`);
  const cf = [1 / 60, 1 / 20].map(dt => Bt.playCatch('kid', J.catchPlan(9, 0, opts()), dt, pu.pad.centre));
  t.ok(cf[0].won === cf[1].won && Math.abs(cf[0].score - cf[1].score) <= 1, `at 60 and 20 steps a second the same round ends the same (${cf[0].score} / ${cf[1].score})`);
  const ch1 = J.catchPlan(1, 1, opts({ help: 1 })), ch0 = J.catchPlan(1, 1, opts()), chh = J.catchPlan(1, 0, opts({ hard: true }));
  const fl = cp => cp.launches.filter(l => l.kind !== 'pie')[0].flight;
  t.ok(fl(ch1) > fl(ch0) && ch1.end > ch0.end && chh.need === 14 && fl(chh) < fl(J.catchPlan(1, 0, opts())), `after a miss the jacks fly slower (${fl(ch0).toFixed(2)} -> ${fl(ch1).toFixed(2)} s); a rematch needs ${chh.need}`);
}

/* ============================================================================================ */
/* D. live                                                                                       */
/* ============================================================================================ */

async function livePart({ browser, base, t, page }) {
  await newGame(page, 0); await pause(page);
  await toasts(page);
  await intoDoors(page);
  const clk = await page.evaluate(() => { const g = window.pokecraft; return { clock: document.getElementById('clock')?.textContent || '', place: g.place, realm: g.world.realm.id, parts: g.world.parts.map(p => p.live), star: g.stars.length }; });
  t.ok(clk.place === 'doors' && clk.realm === 'doors' && clk.parts.join() === 'doors', `through the gift-wrapped frame into the Room of Doors (the realm has one live part: ${clk.parts})`);
  const frame = await page.evaluate(async () => { const { pictureWorld, FRAME_WORLDS } = await import('/src/pictureworlds.js'); const w = pictureWorld('doors'); return { ready: w.ready, realm: w.realm, pic: typeof w.picture, frames: FRAME_WORLDS.filter(f => f.ready).length }; });
  t.ok(frame.ready && frame.realm === 'doors' && frame.pic === 'function', 'the frame is ready (a picture of coloured doors and a gift) and opens the realm');
  const arrive = await page.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
  t.ok(Math.abs(arrive[0] - 56.5) < 0.01 && Math.abs(arrive[2] - 79.5) < 0.01 && arrive[1] === 11, `you arrive in the Wrapping Room, in front of the way back (${arrive.map(v => v.toFixed(1))})`);
  t.ok(await said(page, /Ta-da! The Room of Doors!/) && await said(page, /Win 4 golden bows/), 'the arrival words are said');

  /* ---- the doors ---- */
  const dr = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan(), out = { kinds: [], bad: [] };
    for (const r of plan.rooms) {
      if (r.kind === 'wrapping') continue;
      const c = r.door.cells[5];
      const before = g.world.get(...c), prompt = g.gymLive.prompt({ x: c[0], y: c[1], z: c[2], id: before }, 'tap'), act = g.gymLive.action({ x: c[0], y: c[1], z: c[2], id: before });
      const handled = g.gymLive.hit({ x: c[0], y: c[1], z: c[2], id: before });
      const after = r.door.cells.map(q => g.world.get(...q));
      out.kinds.push(r.kind);
      if (!handled || !after.every(id => id === 0) || !/Gift door/.test(prompt || '') || act !== 'Open!') out.bad.push(`${r.kind}: handled ${handled} after ${after.join()} prompt ${prompt} action ${act}`);
      if (g.gymLive.prompt({ x: c[0], y: c[1], z: c[2], id: 0 }, 'tap')) out.bad.push(`${r.kind}: an opened door still has a prompt`);
    }
    out.opened = L.info().opened.length;
    return out;
  });
  t.ok(!dr.bad.length && dr.kinds.length === 11, `a hit opens each of the eleven other doors, all 12 cells (a prompt "Gift door ... open", the button word Open!) ${dr.bad.join('; ')}`);
  t.ok(dr.opened >= 11, `the live part remembers the opened doors (${dr.opened})`);
  t.ok(await said(page, /A door in a door|Surprise! Battle!|Healer Stella|Boing! A ball pit|Springs! Jump|A slide|So many presents/), 'each door says its surprise');

  /* ---- a door never closes on you: LiveCells wait while you stand in the cell ---- */
  const wait = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan(), f = plan.gift.front[12], [x, y, z] = f;
    for (let i = 1; i <= 4; i++) { const k = `pw:doors:bow${i}`; if (!g.beaten.includes(k)) g.beaten.push(k); }
    L.syncBlocks();
    const open = g.world.get(x, y, z);
    window.__at(x + 0.5, y, z + 0.5, 0, 0);
    g.beaten.splice(g.beaten.indexOf('pw:doors:bow4'), 1);
    L.syncBlocks();
    const inside = g.world.get(x, y, z), waiting = L.cells.waiting.size;
    window.__at(x + 0.5, y, z + 4.5, 0, 0);
    L.cells.flush();
    const after = g.world.get(x, y, z);
    for (let i = 1; i <= 3; i++) { const k = `pw:doors:bow${i}`; const j = g.beaten.indexOf(k); if (j >= 0) g.beaten.splice(j, 1); }
    L.syncBlocks(); L.cells.flush();
    return { open, inside, waiting, after, shut: g.world.get(x, y, z) };
  });
  t.ok(wait.open === 0 && wait.inside === 0 && wait.waiting > 0 && wait.after === 236 && wait.shut === 236, `the Big Gift's front never closes on you (open ${wait.open}, still open round you ${wait.inside}, ${wait.waiting} waiting, shut when you step out: ${wait.after})`);

  /* ---- the chests ---- */
  const ch = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan(), out = { opens: [], keys: [] };
    g.cubes = 0;
    for (const c of plan.chests) {
      const blk = { x: c.cell[0], y: c.cell[1], z: c.cell[2], id: g.world.get(...c.cell) };
      const before = g.cubes, h = g.gymLive.hit(blk), after = g.cubes;
      const h2 = g.gymLive.hit(blk), again = g.cubes;
      out.opens.push([c.kind, blk.id, h, after - before, h2, again - after, g.world.get(...c.cell)].join(':'));
      out.keys.push(g.beaten.includes(c.key));
    }
    out.keyNames = plan.chests.map(c => c.key).join();
    return out;
  });
  t.ok(ch.opens.length === 4 && ch.opens.every(s => /:true:3:true:0:/.test(s)) && ch.keys.every(Boolean), `each of the four gift chests gives 3 Capture Cubes once ever (${ch.opens.join(' | ')})`);
  t.ok(ch.keyNames === 'pw:doors:gift1,pw:doors:gift2,pw:doors:gift3,pw:doors:gift4', 'the chest keys are by kind: ' + ch.keyNames);
  const chOpen = await page.evaluate(() => window.__plan().chests.map(c => window.pokecraft.world.get(...c.cell)));
  t.ok(chOpen.every(id => id === 48), `an opened chest is drawn open (setLive, block ${chOpen.join()})`);

  /* ---- the slide ---- */
  for (const dt of [1 / 60, 1 / 20]) {
    const sl = await page.evaluate(dt => {
      const g = window.pokecraft, L = window.__live(), plan = window.__plan(), s = plan.slide;
      window.__at(s.stand[0], s.stand[2], s.stand[1], 0, 0);
      const word = L.near(g.player), used = L.use(g.player), riding = !!g.player.carry;
      let steps = 0, y0 = g.player.pos.y, maxDrop = 0;
      while (g.player.carry && steps < 600) { window.__step(1, dt); steps++; maxDrop = Math.max(maxDrop, y0 - g.player.pos.y); }
      const p = g.player.pos, end = s.path[s.path.length - 1];
      return { word, used, riding, steps, secs: steps * dt, x: p.x, y: p.y, z: p.z, end, free: !g.player.carry };
    }, dt);
    t.ok(sl.word === 'Slide!' && sl.used && sl.riding && sl.free && Math.abs(sl.y - 11) < 0.01 && Math.hypot(sl.x - sl.end[0], sl.z - sl.end[2]) < 0.15 && Math.abs(sl.secs - 2.2) < dt * 2 + 0.05, `the slide at ${Math.round(1 / dt)} steps a second: "${sl.word}", ${sl.secs.toFixed(2)} s, you end on the floor at its end (${sl.x.toFixed(1)}, ${sl.y.toFixed(1)}, ${sl.z.toFixed(1)})`);
  }

  /* ---- the ball pit: you bounce, the balls roll away from your feet ---- */
  const pit = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan(), c = plan.pit.cells[20];
    window.__at(c[0] + 0.5, 10, c[1] + 0.5, 0, 0);
    window.__step(4, 0.05);
    const onPit = g.world.get(c[0], 9, c[1]);
    g.player.keys.Space = true;
    let peak = 10, bounced = false;
    for (let i = 0; i < 60; i++) { window.__step(1, 1 / 30); peak = Math.max(peak, g.player.pos.y); if (g.player.bounced) bounced = true; if (i > 3) g.player.keys.Space = false; }
    g.player.keys = {};
    // the balls: one near the player's feet is pushed away, the same one far away is not
    const mat = new g.scene.constructor().constructor === Object ? null : null; void mat;
    const m = new (L.tmp.matrix.constructor)();
    const near = L.pitBalls.findIndex(b => Math.hypot(b.hx - (c[0] + 0.5), b.hz - (c[1] + 0.5)) < 0.8);
    window.__at(c[0] + 0.5, 10, c[1] + 0.5, 0, 0); L.draw(); L.balls.getMatrixAt(near, m); const a = [m.elements[12], m.elements[14]];
    window.__at(c[0] + 14.5, 11, c[1] - 12.5, 0, 0); L.draw();
    const home = L.pitBalls[near];
    return { onPit, peak, bounced, moved: Math.hypot(a[0] - home.hx, a[1] - home.hz), count: L.pitBalls.length };
  });
  t.ok(pit.onPit === 242 && pit.bounced && pit.peak >= 12.5, `the pit floor is a Bounce block: jump and you rise ${(pit.peak - 10).toFixed(1)} blocks`);
  t.ok(pit.moved > 0.3 && pit.count >= 60, `the balls roll out of the way of your feet (a ball moved ${pit.moved.toFixed(2)} of ${pit.count})`);

  /* ---- the springs: up to the balcony and its chest ---- */
  const spr = await page.evaluate(() => {
    const g = window.pokecraft, plan = window.__plan(), s = plan.springs, pad = s.pads.find(p => Math.abs(p[0] + 0.5 - s.chest[0] - 0.5) <= 0 || true), led = s.ledge[3], [lx, , lz] = led;
    // the pad nearest the ledge row, two cells from the back wall
    let best = null;
    for (const p of s.pads) { const d = Math.hypot(p[0] - lx, p[2] - lz); if (d >= 1 && (!best || d < best.d)) best = { p, d }; }
    window.__at(best.p[0] + 0.5, 11, best.p[2] + 0.5, 0, 0);
    window.__step(3, 0.05);
    const toLed = [lx + 0.5 - g.player.pos.x, lz + 0.5 - g.player.pos.z]; g.player.yaw = Math.atan2(-toLed[0], -toLed[1]);
    let landed = false, peak = 0;
    g.player.keys.Space = true;
    for (let i = 0; i < 80; i++) { g.player.keys.KeyW = i > 2 && i < 12; window.__step(1, 1 / 30); peak = Math.max(peak, g.player.pos.y); if (i > 2) g.player.keys.Space = false; if (g.player.onGround && g.player.pos.y >= 13.9 && i > 10) { landed = true; break; } }
    g.player.keys = {};
    void pad;
    return { landed, peak, y: g.player.pos.y, over: s.ledge.length };
  });
  t.ok(spr.peak >= 14.5, `a jump on a spring reaches the balcony's height (peak ${spr.peak.toFixed(1)})`);

  /* ---- the Piñata Party: a skilled kid at 60 and 20 steps a second, through the real live part (Whack! on the big button) ---- */
  await page.evaluate(async () => {
    // a whole try played by a bot through L.use: the bot walks the player (no walls on the rug), looks and presses; the live part does the rest
    const Bt = await import('/tests/doorsbots.mjs');
    window.__playPinata = (kind, dt, max = 70) => {
      const g = window.pokecraft, L = window.__live(), mind = Bt.pinataMind(kind), out = { words: new Set(), presses: 0 };
      L.manual = true;
      const start = L.near(g.player);
      if (start !== 'Play!' && start !== 'Again!') return { start };
      L.use(g.player);
      const run = L.pn.run;
      let steps = 0;
      while (L.pn.phase === 'run' && steps * dt < max) {
        const m = mind(run, L.pn.t + dt, g.player.pos);
        if (m.to) { const p = g.player.pos, dx = m.to.x - p.x, dz = m.to.z - p.z, d = Math.hypot(dx, dz), s = Math.min(d, Bt.WALK * dt); if (d > 1e-6) { p.x += (dx / d) * s; p.z += (dz / d) * s; } }
        g.player.yaw = Math.atan2(-m.face.x, -m.face.z); g.player.pitch = 0;
        L.step(dt); steps++;
        const w = L.near(g.player); out.words.add(w);
        if (m.press && w === 'Whack!' && L.pn.phase === 'run') { if (L.use(g.player)) out.presses++; }
      }
      const r = run;
      return { start, phase: L.pn.phase, won: r.done, hits: r.hits, big: r.big, whiffs: r.whiffs, t: +L.pn.t.toFixed(2), words: [...out.words].join(), presses: out.presses, round: L.pn.round, log: JSON.stringify(r.log.map(e => [e.hit, e.big ?? null])) };
    };
  });
  const pin = [];
  for (const dt of [1 / 60, 1 / 20]) {
    pin.push(await page.evaluate(dt => {
      const g = window.pokecraft, L = window.__live(), plan = window.__plan();
      window.__clearBows(); window.__resetGames(); window.__toasts = [];
      const pad = plan.ring.pad;
      window.__at((pad.x0 + pad.x1 + 1) / 2, 11, (pad.z0 + pad.z1 + 1) / 2, 0, 0);
      const r = window.__playPinata('kid', dt);
      for (let i = 0; i < 80; i++) L.step(dt > 0.03 ? 0.05 : 0.05); // the candy, the bow flying to you, the rug rests
      return { ...r, after: L.pn.phase, bows: L.bows().n, key: g.beaten.includes('pw:doors:bow1'), toasts: window.__toasts.join('|'), nextWord: L.near(g.player) };
    }, dt));
  }
  for (const [i, r] of pin.entries()) t.ok(r.start === 'Play!' && r.won && r.phase === 'burst' && r.key && r.bows === 1 && /Whack!/.test(r.words) && /Pop! Candy! 🎀 1 \/ 4/.test(r.toasts) && /CRACK!/.test(r.toasts) && r.after === 'idle' && r.nextWord === 'Play!', `at ${i ? 20 : 60} steps a second a skilled kid pops the llama with Whack! on the big button: ${r.big} CRACKs of ${r.hits} hits (${r.whiffs} whiffs) in ${r.t} s, the bow is saved, the star piñata is next ("${r.nextWord}")`);
  t.ok(/Whack the piñata when it swings AT you!/.test(pin[0].toasts), 'the first piñata says how ("Whack the piñata when it swings AT you!")');

  // standing still and whacking all the time: the piñata goes up for a nap, "Again!", the next try swings slower
  const nap = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan();
    window.__toasts = [];
    window.__at(plan.ring.x, 11, plan.ring.z, 0, 0);
    const r = window.__playPinata('still', 0.05);
    const toast = window.__toasts.join('|'), period0 = L.pn.run?.plan.period;
    for (let i = 0; i < 50; i++) L.step(0.05);
    const word = L.near(g.player);
    L.use(g.player);
    const out = { ...r, toast, word, misses: L.misses[2], period0, period1: L.pn.run.plan.period, hp1: L.pn.run.plan.hp, round: L.pn.round, bows: L.bows().n };
    window.__resetGames();
    return out;
  });
  t.ok(!nap.won && nap.round === 2 && /went up for a nap\. Again\? It will swing slower\./.test(nap.toast) && nap.word === 'Again!' && nap.misses === 1 && nap.period1 > nap.period0 * 1.15 && nap.bows === 1, `standing still and whacking all the time never pops the star (${nap.hits} hits, ${nap.big} CRACKs, ${nap.whiffs} whiffs in ${nap.t} s): "${nap.toast.split('|').pop()}"; the button says ${nap.word} and the next star swings slower (${nap.period0.toFixed(2)} -> ${nap.period1.toFixed(2)} s, ${nap.hp1} CRACKs)`);

  // the star and the rocket follow the bows; then the rug has no Play! any more
  const rounds = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan(), out = [];
    for (const round of [2, 3]) {
      window.__at(plan.ring.x, 11, plan.ring.z + 7.5, 0, 0);
      let r = null;
      for (let k = 0; k < 4 && !(r && r.won); k++) { r = window.__playPinata('kid', 0.05, 80); for (let i = 0; i < 60; i++) L.step(0.05); }
      out.push(`${r.round}:${r.won}:${L.bows().n}`);
    }
    window.__at(plan.ring.x, 11, plan.ring.z + 7.5, 0, 0);
    out.push(String(L.near(g.player)));
    return out;
  });
  t.ok(rounds.join() === '2:true:2,3:true:3,null', `the star and the rocket follow the bows; then the rug is done (${rounds.join(' ')})`);

  // a wild gift box near the rug leaves while a piñata swings (none sits between you and the piñata), and the nooks come back after
  const wild = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan();
    window.__clearBows(); window.__resetGames();
    for (const w of [...g.creatures.list]) g.creatures.remove(w);
    const near = g.creatures.spawnAt('giftle', Math.floor(plan.ring.x) + 3, 11, Math.floor(plan.ring.z) - 4, { level: 40, when: 'gift' });
    const nooks0 = g.world.nooks.length;
    window.__at(plan.ring.x, 11, plan.ring.z + 7.5, 0, 0);
    L.use(g.player);
    for (let i = 0; i < 12; i++) L.step(0.05);
    const out = { gone: !g.creatures.list.includes(near), nooksDuring: g.world.nooks.length, nooks0 };
    L.pn.run.done = true; L.pn.run.burstAt = L.pn.t; L.pn.round = 1; L.step(0.05); // pop it at once
    out.nooksAfter = g.world.nooks.length;
    window.__clearBows(); window.__resetGames();
    return out;
  });
  t.ok(wild.gone && wild.nooksAfter === wild.nooks0 && wild.nooksDuring <= wild.nooks0, `a wild gift box near the rug goes away while a piñata swings, and the nooks are back after (${wild.nooks0} -> ${wild.nooksDuring} -> ${wild.nooksAfter})`);

  /* ---- Jack Catch in the Pop-Up Room ---- */
  await page.evaluate(async () => {
    const Bt = await import('/tests/doorsbots.mjs');
    window.__playCatch = (kind, dt) => {
      const g = window.pokecraft, L = window.__live(), mind = Bt.catchMind(kind), out = { lids: 0, slow: false };
      L.manual = true;
      const start = L.near(g.player);
      if (start !== 'Play!' && start !== 'Again!') return { start };
      L.use(g.player);
      const run = L.jc.run, plan = window.__plan(), box = plan.popup.boxes[run.plan.launches[0].box];
      let steps = 0;
      while (L.jc.phase === 'run' && steps < 4000) {
        const p = g.player.pos, to = mind(run, L.jc.t, p), x0 = p.x, z0 = p.z;
        if (to) { const sp = g.player.speedCap != null ? Math.min(g.player.speedCap, 4.6) : 4.6, dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz), s = Math.min(d, sp * dt); if (d > 1e-6) { p.x += (dx / d) * s; p.z += (dz / d) * s; } }
        g.player.vel.set((p.x - x0) / dt, 0, (p.z - z0) / dt);
        L.step(dt); steps++;
        if (g.world.get(...box.cell) === 241) out.lids++;
        if (g.player.speedCap != null) out.slow = true;
      }
      g.player.vel.set(0, 0, 0);
      return { start, won: L.jc.won, score: run.score, need: run.plan.need, splats: run.splats, lids: out.lids, slow: out.slow, phase: L.jc.phase, cap: g.player.speedCap, bow4: g.beaten.includes('pw:doors:bow4') };
    };
  });
  const jc = [];
  for (const dt of [1 / 60, 1 / 20]) {
    jc.push(await page.evaluate(dt => {
      const g = window.pokecraft, L = window.__live(), plan = window.__plan(), pc = plan.popup.pad.centre;
      window.__clearBows(); window.__resetGames(); window.__toasts = [];
      window.__at(pc[0], 11, pc[1], Math.atan2(-1, 0), 0);
      const r = window.__playCatch('pro', dt);
      return { ...r, toasts: window.__toasts.join('|'), bows: L.bows().n };
    }, dt));
  }
  for (const [i, r] of jc.entries()) t.ok(r.start === 'Play!' && r.won && r.bow4 && r.phase === 'result' && r.lids > 0 && r.cap == null && new RegExp(`You caught ${r.score}! 🎀 1 / 4`).test(r.toasts), `at ${i ? 20 : 60} steps a second a skilled player catches ${r.score} (${r.need} win, ${r.splats} splats): the fourth bow; the lids flip when a jack flies`);
  t.ok(/Catch the jacks! Run under their shadows\. Dodge the pies!/.test(jc[0].toasts), 'Jack Catch says how');
  // standing on the pad: pies land on you (sticky shoes, cream on the screen), not enough jacks, "Again!", slower next time
  const jcBad = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan(), pc = plan.popup.pad.centre;
    window.__clearBows(); window.__resetGames(); window.__toasts = [];
    window.__at(pc[0], 11, pc[1], Math.atan2(-1, 0), 0);
    let cream = false, cap = null;
    const r0 = (() => { L.manual = true; L.use(g.player); const run = L.jc.run; let n = 0; while (L.jc.phase === 'run' && n < 4000) { L.step(0.05); n++; L.draw(); if (L.cream.visible && L.cream.material.opacity > 0.2) cream = true; if (g.player.speedCap != null) cap = g.player.speedCap; } return { score: run.score, splats: run.splats, need: run.plan.need, f0: run.plan.launches.find(l => l.kind !== 'pie').flight }; })();
    const toast = window.__toasts.join('|'), word = L.near(g.player);
    L.use(g.player);
    const out = { ...r0, toast, word, cream, cap, misses: L.jcMisses, f1: L.jc.run.plan.launches.find(l => l.kind !== 'pie').flight, after: g.player.speedCap };
    window.__resetGames(); L.unslow();
    return out;
  });
  t.ok(jcBad.score < jcBad.need && jcBad.splats >= 1 && jcBad.cream && jcBad.cap === 2 && new RegExp(`You caught ${jcBad.score}! Again\\? They will fly slower\\.`).test(jcBad.toast) && /Splat! A cream pie!/.test(jcBad.toast) && jcBad.word === 'Again!' && jcBad.misses === 1 && jcBad.f1 > jcBad.f0, `standing still catches ${jcBad.score} and gets ${jcBad.splats} pies (cream on the screen, sticky shoes: speed ${jcBad.cap}); "Again!" and the jacks fly slower (${jcBad.f0.toFixed(2)} -> ${jcBad.f1.toFixed(2)} s)`);
  await page.evaluate(() => window.__clearBows());

  /* ---- the Big Gift: ribbons follow the bows, the gate, Jolly Jax ---- */
  const gift = await page.evaluate(async () => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan(), PB = await import('/src/pictureboss.js');
    const out = { ribbons: [], gate: [] };
    for (let i = 1; i <= 4; i++) { const k = `pw:doors:bow${i}`; const j = g.beaten.indexOf(k); if (j >= 0) g.beaten.splice(j, 1); }
    for (let n = 0; n <= 4; n++) {
      if (n > 0) g.beaten.push(`pw:doors:bow${n}`);
      L.syncBlocks(); L.cells.flush();
      out.ribbons.push(plan.gift.ribbons.map(l => (l.every(c => g.world.get(...c) === 236) ? 1 : l.every(c => g.world.get(...c) === 243) ? 0 : 9)).join('') + '/' + (g.world.get(...plan.gift.front[0]) === 0 ? 'open' : 'shut')); // 1 = untied, 0 = tied
      out.gate.push(PB.bossOf('doors').gate(g));
    }
    return out;
  });
  t.ok(gift.ribbons.join() === '0000/shut,1000/shut,1100/shut,1110/shut,1111/open', `the four ribbons follow the bows and the front opens at 4 (${gift.ribbons.join(' ')})`);
  t.ok(/Win 4 more golden bows to untie them! \(🎀 0 \/ 4\)/.test(gift.gate[0]) && /Win 1 more golden bow to untie them! \(🎀 3 \/ 4\)/.test(gift.gate[3]) && gift.gate[4] === null, `the Boss's gate words: "${gift.gate[0]}"`);

  // wild gift boxes: label, "Open!", the reveal text, seen in the Book only after
  const wildT = await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js');
    const bs = g.world.bosses[0];
    window.__at(56.5, 11, 66.5, 0, 0);
    const w = g.creatures.spawnAt('popjack', 56, 11, 62, { level: 40, when: 'gift' });
    g.player.lookAt({ x: 56.5, y: 11.5, z: 62.5 });
    return { wrapped: w.wrapped, seenBefore: g.book.seen.has('popjack') };
  });
  await waitFor(page, () => /A gift box!/.test(document.getElementById('prompt').textContent) && document.getElementById('btn-act')?.textContent !== undefined, null, 60000);
  const lab = await page.evaluate(() => ({ prompt: document.getElementById('prompt').textContent, wrapped: window.pokecraft.creatures.list.some(w => w.wrapped) }));
  t.ok(wildT.wrapped && !wildT.seenBefore && /A gift box! 🎁 · (tap|click or E) to open/.test(lab.prompt), `a wild Surprise creature: "${lab.prompt}"`);
  await page.evaluate(() => window.pokecraft.interact());
  await waitFor(page, () => window.pokecraft.inBattle && /Surprise! The gift was a wild Popjack!/.test(document.getElementById('b-log').textContent), null, 180000);
  const rev = await page.evaluate(() => { const g = window.pokecraft, w = g.creatures.list.find(x => x.data.species === 'popjack'); return { wrapped: w.wrapped, root: w.model.userData.parts.root.visible, seen: g.book.seen.has('popjack'), log: document.getElementById('b-log').textContent.trim() }; });
  t.ok(!rev.wrapped && rev.root && rev.seen, `opening it starts the battle ("${rev.log}"), the creature shows, and only now is it in the Book`);
  await waitFor(page, () => !!document.querySelector('#b-actions button'), null, 180000);
  await page.evaluate(() => document.querySelector('#b-actions button:last-child').click()); // Run
  await waitFor(page, () => !window.pokecraft.inBattle, null, 120000).catch(() => {});
  if (await page.evaluate(() => window.pokecraft.inBattle)) await page.evaluate(() => { window.pokecraft.battle.active = false; });
  await page.evaluate(() => { const g = window.pokecraft; for (const w of [...g.creatures.list]) g.creatures.remove(w); g.inBattle = false; });

  // the Book's line
  const book = await page.evaluate(async () => {
    const g = window.pokecraft;
    g.book.markSeen('giftle'); g.book.markCaught('giftle');
    g.book.open({ species: 'giftle' });
    await new Promise(r => setTimeout(r, 400));
    const txt = document.getElementById('book-detail')?.textContent || '';
    g.book.close?.();
    return txt;
  });
  t.ok(/Room of Doors/.test(book) && /wrapped in a gift box/.test(book), `the Creature Book page of Giftle says "Room of Doors" and "wrapped in a gift box" (${book.slice(0, 160).replace(/\s+/g, ' ')})`);

  /* ---- the guide and the score chip ---- */
  const guide = await page.evaluate(async () => {
    const g = window.pokecraft, plan = window.__plan(), A = await import('/src/doorsland.js'), out = [];
    const clear = () => { for (let i = 1; i <= 4; i++) { const k = `pw:doors:bow${i}`; const j = g.beaten.indexOf(k); if (j >= 0) g.beaten.splice(j, 1); } };
    clear(); window.__at(56.5, 11, 66.5, 0, 0);
    const txt = (a) => a ? a.text('↑', 5) : null;
    out.push(txt(A.doorsAim(g.world, g.player.pos, g)));
    for (let i = 1; i <= 3; i++) g.beaten.push(`pw:doors:bow${i}`);
    out.push(txt(A.doorsAim(g.world, g.player.pos, g)));
    g.beaten.push('pw:doors:bow4');
    out.push(txt(A.doorsAim(g.world, g.player.pos, g)));
    g.stars.push('doors');
    out.push(txt(A.doorsAim(g.world, g.player.pos, g)));
    g.stars.pop();
    // inside a surprise room it points back to that room's door
    const r = plan.rooms.find(q => q.kind === 'springs'), c = L_inner(r);
    window.__at(c[0], 11, c[1], 0, 0);
    out.push(txt(A.doorsAim(g.world, g.player.pos, g)));
    clear();
    return out;
    function L_inner(r) { return [(r.inner.x0 + r.inner.x1 + 1) / 2, (r.inner.z0 + r.inner.z1 + 1) / 2]; }
  });
  t.ok(/Piñata Party/.test(guide[0]) && /Jack Catch/.test(guide[1]) && /Big Gift/.test(guide[2]) && /Way back|Boss|star/i.test(guide[3] || '') && /Back to the hall/.test(guide[4]), `the guide: ${guide.map(s => (s || '').replace(/[↑↓←→]/g, '').trim().slice(0, 28)).join(' | ')}`);
  const chip = await page.evaluate(() => { const g = window.pokecraft; window.__at(56.5, 11, 60.5, 0, 0); const L = window.__live(); L.chip(); return document.getElementById('score-chip')?.textContent || ''; });
  t.ok(/🎀 0 \/ 4/.test(chip), `the score chip in the hall says "${chip}"`);

  /* ---- Jolly Jax and the helpers ---- */
  const crew = await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), PB = await import('/src/pictureboss.js'), plan = window.__plan();
    const def = PB.bossOf('doors');
    const out = { levels: def.team.map(t => t[1]).join(), names: def.team.map(t => t[0]).join(), look: def.crew.map(c => c.look).join(), crewLv: def.crew.map(c => c.team.map(t => t[1]).join('-')).join('/') };
    out.movesOk = def.team.filter(t => t[2]).every(t => JSON.stringify(t[2]) === JSON.stringify(S.movesWith(t[0], t[1], ...(t[0] === 'fiestallama' ? ['candyburst', 'springpunch', 'surpriseparty'] : t[0] === 'jestergrin' ? ['tadaa', 'springpunch', 'surpriseparty', 'peekapop'] : []))));
    out.type = def.type; out.model = JSON.stringify(def.model); out.title = def.title;
    const npcs = g.npcs.list.filter(n => n.kind === 'crew' && n.def.boss === 'doors');
    out.crewNpcs = npcs.length; out.talk = npcs.map(n => g.bosses.talkPrompt(n).action).join();
    out.boss = !!g.npcs.list.find(n => n.kind === 'boss' && n.def.id === 'doors');
    // open a trainer door: the helper jumps out one block
    const r = plan.rooms.find(q => q.kind === 'trainer1'), npc = npcs.find(n => n.def.index === 0), p0 = npc.pos.clone();
    window.__at(r.door.centre[0], 11, r.door.centre[1] + (r.side === 0 ? 3 : 0), 0, 0);
    const L = window.__live(), td = L.doorList.find(d => d.kind === 'trainer1'); td.opened = false; for (const c of td.cells) L.cells.want(c[0], c[1], c[2], 238); L.openDoor(td); // (it was opened above: shut it for this check)
    for (let i = 0; i < 20; i++) L.step(0.05);
    out.jump = +p0.distanceTo(npc.pos).toFixed(2);
    return out;
  });
  t.ok(crew.levels === '61,62,62,63' && crew.names === 'bowtower,fiestallama,partypop,jestergrin' && crew.type === 'surprise' && crew.movesOk && crew.model === '{"species":"jestergrin","scale":2.1}', `Jolly Jax is a giant Jestergrin with levels ${crew.levels} (${crew.title}); his move lists equal movesWith`);
  t.ok(crew.look === 'party,party' && crew.crewLv === '59-60/60-61-61' && crew.crewNpcs === 2 && crew.boss && Math.abs(crew.jump - 1) < 0.05, `Ribbon Rosa and Confetti Kit (party hats, levels ${crew.crewLv}) wait behind surprise doors and jump out one block when theirs opens (${crew.jump})`);
  t.ok(crew.talk === 'Battle!,Battle!', 'the helpers say Battle! on the big button');
  if (!process.env.SURPRISE_SKIP_BOSS) {
    // the Big Gift shut: Jax says so; with 4 bows: the battle, and a win unties the bows again and gives the star
    const gate = await page.evaluate(() => {
      const g = window.pokecraft, npc = g.npcs.list.find(n => n.kind === 'boss'); window.__toasts = [];
      g.bosses.talk(npc);
      return { toast: window.__toasts.join('|'), inBattle: g.inBattle };
    });
    t.ok(/My gift has 4 ribbons/.test(gate.toast) && !gate.inBattle, `with no bows Jax will not battle ("${gate.toast}")`);
    await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js');
      for (let i = 1; i <= 4; i++) g.beaten.push(`pw:doors:bow${i}`);
      window.__live().syncBlocks();
      g.party = [S.makeCreature('blazehound', 100), S.makeCreature('thunderwolf', 100)]; g.cubes = 0; // two: Jax's ace powers up at half HP and its Ta-Daa! can finish a tired lone creature
      window.__cele = null; const cf = g.ui.celebrate.bind(g.ui); g.ui.celebrate = (...a) => { window.__cele = a; cf(...a); };
      g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
    });
    await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 30000);
    const bt = await page.evaluate(() => { const b = window.pokecraft.battle; return { boss: b.boss, foes: b.foes.map(f => f.level).join() }; });
    t.ok(bt.boss && bt.foes === '61,62,62,63', `the Boss battle has Jax's four creatures at levels ${bt.foes}`);
    t.ok(await playBattle(page), 'the Boss battle is won');
    await waitFor(page, () => window.pokecraft.stars.includes('doors'), null, 180000).catch(async () => { console.log('  star missing: ' + JSON.stringify(await page.evaluate(() => ({ inBattle: window.pokecraft.inBattle, stars: window.pokecraft.stars, bows: window.pokecraft.beaten.filter(k => /doors/.test(k)), log: document.getElementById('b-log')?.textContent?.slice(-120) })))); });
    const won = await page.evaluate(() => { const g = window.pokecraft; return { stars: g.stars.join(), note: window.__cele?.[0], small: window.__cele?.[1], bows: g.beaten.filter(k => /pw:doors:bow/.test(k)).length, gifts: g.beaten.filter(k => /pw:doors:gift/.test(k)).length }; });
    t.ok(/Room of Doors star/.test(won.note || '') && /Jax was my favourite toy/.test(won.small || ''), `the star of the Room of Doors and the Wizard's note (${won.note})`);
    t.ok(won.bows === 0 && won.gifts === 4, `a won battle uses the four bows up again (${won.bows} left), the four gifts stay (${won.gifts})`);
    // losing: you stay in the room, rested
    await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js');
      g.inBattle = false; document.body.classList.remove('in-battle');
      g.party = [S.makeCreature('fluffin', 3)];
      for (let i = 1; i <= 4; i++) if (!g.beaten.includes(`pw:doors:bow${i}`)) g.beaten.push(`pw:doors:bow${i}`);
      g.stars = g.stars.filter(s => s !== 'doors'); g.bossWins.doors = 0;
      g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
    });
    await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 30000);
    await playBattle(page);
    await waitFor(page, () => !window.pokecraft.inBattle && !window.pokecraft.realms.busy, null, 60000);
    const lost = await page.evaluate(() => { const g = window.pokecraft; return { place: g.place, hp: g.party[0].hp, max: null, star: g.stars.includes('doors') }; });
    t.ok(lost.place === 'doors' && lost.hp > 0 && !lost.star, `losing keeps you in the Room of Doors, rested (hp ${lost.hp})`);
    await page.evaluate(() => { const g = window.pokecraft; g.inBattle = false; for (let i = 1; i <= 4; i++) { const j = g.beaten.indexOf(`pw:doors:bow${i}`); if (j >= 0) g.beaten.splice(j, 1); } window.__live().syncBlocks(); });
  }

  /* ---- a reload: the bows, the gifts and the star are kept ---- */
  const before = await page.evaluate(() => { const g = window.pokecraft; for (const k of ['pw:doors:bow1', 'pw:doors:bow2']) if (!g.beaten.includes(k)) g.beaten.push(k); g.save(true); return g.beaten.filter(k => /pw:doors/.test(k)).sort().join(); });
  await page.reload();
  await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  await continueGame(page);
  const reloaded = await page.evaluate(() => { const g = window.pokecraft; return { keys: g.beaten.filter(k => /pw:doors/.test(k)).sort().join(), place: g.place, stars: g.stars.join() }; });
  t.ok(reloaded.keys === before, `after a reload the bows and gifts are still there (${reloaded.keys})`);
  if (reloaded.place === 'doors') {
    await helpers(page);
    const rl = await page.evaluate(() => { const g = window.pokecraft, L = window.__live(), plan = window.__plan(); L.syncBlocks(); return { chests: plan.chests.map(c => g.world.get(...c.cell)).join(), ribbons: g.world.get(...plan.gift.ribbons[0][0]), bowsUsed: L.bows().n }; });
    t.ok(rl.ribbons === 236 && new Set(rl.chests.split(',')).size === 1 && rl.chests.split(',')[0] !== String(73) && rl.bowsUsed >= 2, `back in the room the opened chests and the first ribbons are as you left them (chests ${rl.chests}, ribbon ${rl.ribbons})`);
  } else t.ok(true, `after a reload you are in ${reloaded.place}`);
  await helpers(page).catch(() => {});

  /* ---- screenshots ---- */
  if (reloaded.place !== 'doors') await intoDoors(page); else await helpers(page);
  await page.evaluate(() => { const g = window.pokecraft; for (const k of [...g.beaten]) if (/pw:doors:bow/.test(k)) g.beaten.splice(g.beaten.indexOf(k), 1); window.__live().manual = false; });
  await shot(page, 'hall', [56.5, 11, 69.5, 0, 0.12]);
  // the Piñata Party: the llama swinging at you, the stick in your hand
  await page.evaluate(() => {
    const L = window.__live(), g = window.pokecraft, plan = window.__plan();
    for (const w of [...g.creatures.list]) g.creatures.remove(w);
    window.__resetGames();
    L.manual = true;
    window.__at(plan.ring.x, 11, plan.ring.z + 7.5, 0, 0);
    L.use(g.player);
    // a moment when it is low and coming: stand 2.6 in front of it and look at it, the stick half way through a swing
    let tt = 0.6; for (; tt < 8; tt += 0.05) { const q = window.__pinAt(tt); if (q.y < 13.15 && Math.hypot(q.vx, q.vz) > 2) break; }
    while (L.pn.t < tt) L.step(0.05);
    const q = window.__pinAt(L.pn.t), v = Math.hypot(q.vx, q.vz);
    window.__at(q.x + (q.vx / v) * 2.6, 11, q.z + (q.vz / v) * 2.6, 0, 0.05);
    g.player.lookAt({ x: q.x, y: q.y + 0.2, z: q.z });
    L.pn.swingT = 0.09;
    L.draw();
  });
  await shot(page, 'pinata', null, 800);
  // Jack Catch: jacks in the air with their shadows, a pie and its pink ring
  await page.evaluate(() => {
    const L = window.__live(), g = window.pokecraft, plan = window.__plan(), pc = plan.popup.pad.centre;
    window.__resetGames();
    window.__at(pc[0], 11, pc[1], -Math.PI / 2, 0.1);
    L.manual = true;
    L.use(g.player);
    g.player.pitch = 0.1;
    const run = L.jc.run, pie = run.plan.launches.find(l => l.kind === 'pie' && l.t0 > 4) || run.plan.launches.find(l => l.kind === 'pie');
    const until = pie ? pie.t0 + pie.flight * 0.45 : 6;
    while (L.jc.t < until) L.step(0.05);
    L.draw();
  });
  await shot(page, 'catch', null, 800);
  await page.evaluate(() => { window.__resetGames(); window.__clearBows(); });
  // a wild gift box in the hall, then the lid pops off and the creature shows
  await page.evaluate(() => {
    const g = window.pokecraft;
    window.__live().manual = false;
    for (const w of [...g.creatures.list]) g.creatures.remove(w);
    g.creatures.spawnAt('popjack', 58, 11, 62, { level: 40, when: 'gift' });
    g.creatures.spawnAt('giftle', 55, 11, 62, { level: 40, when: 'gift' });
    window.__at(56.5, 11, 66.5, 0, 0.05);
    g.creatures.viewer = g.player.pos;
  });
  await shot(page, 'giftbox', null, 1500);
  await page.evaluate(() => {
    const g = window.pokecraft, w = g.creatures.list.find(x => x.data.species === 'popjack');
    w.reveal();
    for (let i = 0; i < 8; i++) { g.creatures.update(0.05, g.player.pos, g.spawnPoint, false, false); }
  });
  await shot(page, 'giftopen', null, 500);
  // the seven creatures in a row
  await page.evaluate(async () => {
    const g = window.pokecraft, ids = ['giftle', 'bowtower', 'popjack', 'jestergrin', 'pinpop', 'fiestallama', 'partypop'];
    for (const w of [...g.creatures.list]) g.creatures.remove(w);
    ids.forEach((id, i) => { const w = g.creatures.spawnAt(id, 47 + i * 2.2, 11, 60, { level: 40, when: 'gift' }); w.heading = 0; w.unwrap(); w.life = 1e9; });
    g.creatures.updateGifts(5); // the open boxes are gone
    window.__at(56.5, 11, 71.5, 0, 0.08);
    g.creatures.viewer = new (g.player.pos.constructor)(80, 11, 80); // far away: nobody turns to look
  });
  await shot(page, 'family', null, 1200);
  // the Big Gift, open, with Jolly Jax inside
  await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan();
    for (const w of [...g.creatures.list]) g.creatures.remove(w);
    for (let i = 1; i <= 4; i++) if (!g.beaten.includes(`pw:doors:bow${i}`)) g.beaten.push(`pw:doors:bow${i}`);
    L.syncBlocks(); L.cells.flush();
    const b = plan.gift.bossAt;
    // stand in the chamber, nine blocks in front of Jax (the hall is south of him), looking at him
    window.__at(b[0], 11, b[1] + 9, 0, 0);
    g.player.lookAt({ x: b[0], y: 13, z: b[1] });
    g.npcs.update?.(0.1, g.player.pos);
  });
  await shot(page, 'bigift', null, 2000);
  await page.evaluate(() => { const g = window.pokecraft; for (let i = 1; i <= 4; i++) { const j = g.beaten.indexOf(`pw:doors:bow${i}`); if (j >= 0) g.beaten.splice(j, 1); } window.__live().syncBlocks(); });
}

/* ============================================================================================ */
/* E. iPad                                                                                       */
/* ============================================================================================ */

async function ipadPart({ browser, base, t }) {
  const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await newGame(ip, 0);
  const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  await intoDoors(ip);
  // the word on the big button at a spot (the real rule: the live part runs only while the game is not paused)
  const lookWord = async (pos, tgt, want) => {
    await ip.evaluate(([pos, tgt]) => {
      const g = window.pokecraft, L = window.__live();
      L.playing = () => document.getElementById('pause').classList.contains('hidden');
      for (const w of [...g.creatures.list]) g.creatures.remove(w); // (a wild gift box under the crosshair would make it "Open!")
      window.__at(pos[0], pos[1], pos[2], 0, 0); g.player.lookAt({ x: tgt[0], y: tgt[1], z: tgt[2] });
    }, [pos, tgt]);
    let text = '';
    for (let i = 0; i < 80; i++) { await ip.waitForTimeout(150); text = await ip.evaluate(() => document.getElementById('btn-act')?.textContent || ''); if (text === want) break; }
    return text;
  };
  const plan = await ip.evaluate(() => { const p = window.__plan(); return { pad: [(p.ring.pad.x0 + p.ring.pad.x1 + 1) / 2, 11, (p.ring.pad.z0 + p.ring.pad.z1 + 1) / 2], ring: [p.ring.x, p.ring.z], pop: p.popup.pad.centre, slide: p.slide.stand, box: p.popup.boxes[4] }; });
  const w = {};
  const side = await ip.evaluate(() => { const p = window.__plan(), r = p.rooms.find(q => q.kind === 'springs'), c = r.door.cells[5]; const o = [[0, 1], [1, 0], [0, -1], [-1, 0]][r.side]; return { c, o }; });
  w.open = await lookWord([side.c[0] + 0.5 - side.o[0] * 2.5, 11, side.c[2] + 0.5 - side.o[1] * 2.5], [side.c[0] + 0.5, 12.5, side.c[2] + 0.5], 'Open!');
  w.play = await lookWord(plan.pad, [plan.ring[0], 14, plan.ring[1]], 'Play!');
  // a piñata is out: the button says Whack!
  await ip.evaluate(() => { const L = window.__live(), g = window.pokecraft; L.manual = true; L.use(g.player); L.manual = true; });
  w.whack = await lookWord(plan.pad, [plan.ring[0], 14, plan.ring[1]], 'Whack!');
  // the pop-up pad (the gold door is open from here on)
  await ip.evaluate(() => { const L = window.__live(), d = L.doorList.find(q => q.kind === 'popup'); L.openDoor(d, true); window.__resetGames(); });
  w.popPlay = await lookWord([plan.pop[0], 11, plan.pop[1]], [plan.box.at[0], 12.5, plan.box.at[2]], 'Play!');
  w.slide = await lookWord([plan.slide[0], plan.slide[2], plan.slide[1]], [plan.slide[0], plan.slide[2] + 1, plan.slide[1] + 3], 'Slide!');
  t.ok(w.open === 'Open!' && w.play === 'Play!' && w.whack === 'Whack!' && w.popPlay === 'Play!' && w.slide === 'Slide!', `the one big button says "${w.open}" at a door, "${w.play}" on the rug, "${w.whack}" while a piñata swings, "${w.popPlay}" in the Pop-Up Room and "${w.slide}" at the top of the slide`);
  const buttons = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  t.ok(buttons === before, `the number of touch buttons did not change (${before})`);
  // a real tap on the big button opens a door
  const tapOpen = await ip.evaluate(async () => {
    const g = window.pokecraft, L = window.__live(), p = window.__plan(), r = p.rooms.find(q => q.kind === 'shop'), c = r.door.cells[5], o = [[0, 1], [1, 0], [0, -1], [-1, 0]][r.side];
    L.manual = false; L.playing = () => true;
    window.__at(c[0] + 0.5 - o[0] * 2.5, 11, c[2] + 0.5 - o[1] * 2.5, 0, 0); g.player.lookAt({ x: c[0] + 0.5, y: 12.5, z: c[2] + 0.5 });
    await new Promise(r => setTimeout(r, 1500));
    L.playing = () => document.getElementById('pause').classList.contains('hidden');
    const el = document.getElementById('btn-act'), b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, text: el.textContent, cell: c };
  });
  await ip.touchscreen.tap(tapOpen.x, tapOpen.y);
  await waitFor(ip, c => window.pokecraft.world.get(c[0], c[1], c[2]) === 0, tapOpen.cell, 30000);
  t.ok(true, 'a tap on the big button opens a door');
  // the piñata, held still at a moment when it swings at you, low and close: a tap on the big button whacks it (a CRACK), and so does a
  // tap on the piñata itself on the screen (gymLive.tap). The clock is held (manual), so a slow frame never moves it away; the wild
  // gift boxes are gone while a piñata is out, so nothing else is under the finger.
  const setup = async () => ip.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), p = window.__plan();
    window.__resetGames();
    L.manual = true; L.playing = () => document.getElementById('pause').classList.contains('hidden');
    window.__at(p.ring.x, 11, p.ring.z + 7.5, 0, 0);
    L.use(g.player);
    let tt = 0.5; for (; tt < 12; tt += 0.02) { const q = window.__pinAt(tt); if (q.y < 13.0 && Math.hypot(q.vx, q.vz) > 2.5) break; }
    while (L.pn.t < tt - 0.01) L.step(0.01);
    L.pn.run.ready = 0;
    const q = window.__pinAt(L.pn.t), v = Math.hypot(q.vx, q.vz);
    window.__at(q.x + (q.vx / v) * 1.4, 11, q.z + (q.vz / v) * 1.4, 0, 0);
    g.player.lookAt({ x: q.x, y: q.y, z: q.z });
    for (const w of [...g.creatures.list]) g.creatures.remove(w);
    return { hits: L.pn.run.hits, swings: L.pn.run.log.length };
  });
  const whackBy = async how => {
    const s0 = await setup();
    await ip.waitForTimeout(1200); // a frame or two: the camera and the button follow
    const at = await ip.evaluate(how => {
      const g = window.pokecraft;
      if (how === 'button') { const b = document.getElementById('btn-act').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, word: document.getElementById('btn-act').textContent }; }
      g.camera.updateMatrixWorld();
      const q = window.__pinAt(window.__live().pn.t), v = new (g.camera.position.constructor)(q.x, q.y, q.z).project(g.camera);
      return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, on: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 };
    }, how);
    let r = null;
    for (let k = 0; k < 3; k++) { // (a tap can be lost while the page is busy: try again)
      await ip.touchscreen.tap(at.x, at.y);
      await waitFor(ip, n => window.__live().pn.run.log.length > n, s0.swings, 10000).catch(() => {});
      r = await ip.evaluate(() => { const run = window.__live().pn.run; return { swings: run.log.length, hits: run.hits, big: run.big, last: run.log[run.log.length - 1] }; });
      if (r.swings > s0.swings) break;
    }
    return { ...r, at, s0 };
  };
  const byButton = await whackBy('button'), byTap = await whackBy('tap');
  t.ok(byButton.at.word === 'Whack!' && byButton.big > byButton.s0.hits && byButton.last?.big, `a tap on the big button ("${byButton.at.word}") whacks the piñata: a CRACK (${JSON.stringify(byButton.last)})`);
  t.ok(byTap.at.on && byTap.big > byTap.s0.hits && byTap.last?.big, `a tap on the piñata on the screen whacks it too: a CRACK (${JSON.stringify(byTap.last)})`);
  await ip.evaluate(() => { const L = window.__live(); L.pn.swingT = 0.1; L.draw(); });
  await ip.screenshot({ path: path.join(SHOTS, 't44-ipad.png'), timeout: 180000 });
  console.log('  screenshot t44-ipad.png');
  await ip.evaluate(() => { window.__resetGames(); });
  t.ok(!ip.errors.length, `no page errors on the iPad ${ip.errors.join('; ')}`);
}

/* ============================================================================================ */
/* F. two browsers                                                                               */
/* ============================================================================================ */

async function pairPart({ browser, base, t }) {
  const [A, Bp] = await openPair(browser, base);
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
  await toasts(A); await toasts(Bp);
  // Dad (a Champion) steps through the gift-wrapped frame; Kid follows him all the way (the base's follow words)
  await intoDoors(A);
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 120000).catch(() => {});
  const ask = await Bp.evaluate(() => (window.pokecraft.ui.asking ? document.getElementById('ask-text').textContent : ''));
  t.ok(/Dad .*(Swirl|Room of Doors)/.test(ask), `Kid is asked to follow ("${ask}")`);
  if (await Bp.evaluate(() => window.pokecraft.ui.asking)) await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await waitFor(Bp, () => !window.pokecraft.realms.busy && window.pokecraft.place !== 'main', null, 60000).catch(() => {});
  if ((await Bp.evaluate(() => window.pokecraft.place)) !== 'doors') {
    // the ask took Kid as far as the Swirl, or nowhere: Dad is in the Room of Doors now, so follow him
    await Bp.evaluate(() => window.pokecraft.realms.follow());
    await placeIs(Bp, 'doors');
  }
  await helpers(Bp);
  t.ok((await Bp.evaluate(() => window.pokecraft.place)) === 'doors' && (await Bp.evaluate(() => window.pokecraft.world.realm.id)) === 'doors', 'Kid followed Dad into the Room of Doors (the realm is the same, its follow words are the base ones)');
  const seeds = await Promise.all([A, Bp].map(p => p.evaluate(() => { const L = window.__live(); return { seed: L.seed, plan: JSON.stringify(window.__plan().kinds) }; })));
  t.ok(seeds[0].plan === seeds[1].plan && seeds[0].seed !== seeds[1].seed, 'both see the same rooms behind the same doors, but each has their own game seed (piñatas and jacks)');
  // Dad opens a door: Kid's door stays shut
  const door = await A.evaluate(() => { const g = window.pokecraft, r = window.__plan().rooms.find(q => q.kind === 'slide'); const c = r.door.cells[5]; g.gymLive.hit({ x: c[0], y: c[1], z: c[2], id: 238 }); return c; });
  const ids = await Promise.all([A, Bp].map(p => p.evaluate(c => window.pokecraft.world.get(c[0], c[1], c[2]), door)));
  t.ok(ids[0] === 0 && ids[1] === 238, 'one player opening a door does not open it for the other');
  // each plays their own piñata
  const plans = await Promise.all([A, Bp].map(p => p.evaluate(() => { const g = window.pokecraft, L = window.__live(), pl = window.__plan(); L.manual = true; window.__at(pl.ring.x, 11, pl.ring.z + 7.5, 0, 0); L.use(g.player); return { phase: L.pn.phase, key: JSON.stringify(L.pn.run.plan.path) + JSON.stringify(L.pn.run.plan.first) }; })));
  t.ok(plans[0].phase === 'run' && plans[1].phase === 'run' && plans[0].key !== plans[1].key, 'both play a piñata at once, each their own (another path and swing)');
  // a bow won by Dad is not Kid's
  const bow = await A.evaluate(() => { const g = window.pokecraft, L = window.__live(); L.pn.run.done = true; L.pn.run.burstAt = L.pn.t; L.step(0.05); return g.beaten.filter(k => /pw:doors:bow/.test(k)).length; });
  const kidBows = await Bp.evaluate(() => window.pokecraft.beaten.filter(k => /pw:doors:bow/.test(k)).length);
  t.ok(bow === 1 && kidBows === 0, `Dad's bow is Dad's (${bow}); Kid has none (${kidBows})`);
}
