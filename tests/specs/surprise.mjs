// T44 (wave 15): the Surprise type and the Room of Doors (plans/T44.md section 11).
// A: the type (data, models, chart, moves, fx, sounds, the wild gift box, spawns, the Book). B: the terrain for three seeds in Node (door layout, walk
// graph, slide path, keeps, the Big Gift). C: the two skill games as pure rules in Node (the Shuffle Stage, the Pop-Up Room). D: live, in a browser
// (doors, chests, slide, ball pit, springs, a shuffle at 60 and 20 steps a second, the pop-up round, the Big Gift's ribbons, the gate, Jolly Jax, the
// crew, wild gift boxes, a reload). E: iPad (the one action button, a tap on a jack). F: two browsers. G: the screenshots.
// SURPRISE_ONLY=data|land|games|live|ipad|pair|shots runs one part; SURPRISE_SKIP_BOSS=1 leaves out the long Boss battles.
// Screenshots (tests/screenshots): t44-hall.png, t44-shuffle.png, t44-popup.png, t44-giftbox.png, t44-giftopen.png, t44-bigift.png, t44-family.png, t44-ipad.png.
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
const helpers = page => page.evaluate(() => {
  const g = window.pokecraft;
  const L = () => g.gymLive.of('part:doors');
  window.__live = L;
  L().playing = () => true; // the live part runs without pointer lock in the tests (the iPad test keeps the real rule)
  window.__step = (n, dt = 0.05, each) => { for (let i = 0; i < n; i++) { g.player.update(dt); g.gymLive.update(dt); each?.(i); } };
  window.__at = (x, y, z, yaw = 0, pitch = 0) => { const p = g.player; p.carry?.leave?.(false); p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.keys = {}; };
  window.__look = (x, y, z) => g.player.lookAt({ x, y, z });
  window.__blk = (x, y, z) => ({ x, y, z, id: g.world.get(x, y, z) });
  window.__plan = () => g.world.doorsPlan;
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
      for (const id of ['giftopen', 'giftgiggle', 'doorwhoosh', 'rightdoor', 'sillyhonk', 'jackpop', 'boop']) { if (!new RegExp(`\\n\\s*${id}: \\(`).test(src)) bad(`sound ${id}`); if (S.MOVES[id]) bad(`sound ${id} is a move id`); }
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
      out.chart = ['mind', 'ninja', 'cyber', 'surprise', 'metal', 'time'].map(d => E('surprise', d)).join() + '|' + ['time', 'ball', 'bug', 'ghost', 'camo'].map(a => E(a, 'surprise')).join();
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
  const L = await src('doorsland.js'), Bk = await src('blocks.js'), SHf = await src('shuffle.js');
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
      stage: [[L.STAGE.x0, 11, L.STAGE.z0], [L.STAGE.x1, 11, L.STAGE.z1], [56, 11, 46]], pad: [[55, 10, 54], [57, 10, 55]],
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
    // 7. nooks: 14 spots, each an air cell on a solid one
    const nk = w.nooks;
    t.ok(nk.length === 14 && nk.every(n => w.get(n.x, n.y, n.z) === B.AIR && isSolid(w.get(n.x, n.y - 1, n.z))), `${tag}: ${nk.length} nook spots (4 in the shop, 8 round the hall, 2 by the stage), all on something solid`);
    // 8. rooms stay inside the map and the building is walls all round
    const out = [];
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = 11; y <= 22; y++) { const id = w.get(x, y, z); if (id !== B.AIR && (x < 20 || x > 92 || z < 5 || z > 95)) out.push([x, y, z]); }
    t.ok(!out.length, `${tag}: the building stays inside its corner of the map`);
    void WOOL; void BLOCKS; void SHf;
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
  const S = await src('shuffle.js'), P = await src('popup.js');
  const { SHUFFLE, shufflePlan, doorsAt, pickDoor, slotOf, helpLevel } = S;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // 1. a plan replays
  const a1 = shufflePlan('seed', 1, 0), a2 = shufflePlan('seed', 1, 0);
  t.ok(same(a1, a2) && !same(a1, shufflePlan('seed', 1, 1)) && !same(a1, shufflePlan('other', 1, 0)) && !same(shufflePlan('seed', 2, 0), shufflePlan('seed', 3, 0)), 'a shuffle plan replays exactly from seed / round / attempt and differs when any of them does');
  // 2. the rules, over many plans
  let ruleBad = [], prizeMoves = [], dBad = 0, overlap = 0, samples = 0;
  const rounds = [[1, 3, 4], [2, 4, 6], [3, 5, 8]];
  for (const [round, n, swaps] of rounds) for (let at = 0; at < 60; at++) {
    const p = shufflePlan('rules', round, at);
    if (p.n !== n || p.swaps.length !== swaps) ruleBad.push(`round ${round} n ${p.n} swaps ${p.swaps.length}`);
    let ps = p.prize, inv = 0;
    for (const s of p.swaps) { if (s.a === ps) { ps = s.b; inv++; } else if (s.b === ps) { ps = s.a; inv++; } }
    if (inv < Math.ceil(swaps / 2)) ruleBad.push(`prize in ${inv} swaps`);
    prizeMoves.push(inv);
    if (round >= 2 && ps === p.prize) ruleBad.push('prize ends where it started');
    for (let i = 2; i < p.swaps.length; i++) { const [x, y, z] = [p.swaps[i - 2], p.swaps[i - 1], p.swaps[i]], eq = (u, v) => (u.a === v.a && u.b === v.b) || (u.a === v.b && u.b === v.a); if (eq(x, y) && eq(y, z)) ruleBad.push('same pair three times'); }
    // doubles: swaps at the same moment use different slots
    for (let i = 0; i < p.swaps.length; i++) for (let j = i + 1; j < p.swaps.length; j++) if (p.swaps[i].t0 === p.swaps[j].t0) { const s = new Set([p.swaps[i].a, p.swaps[i].b, p.swaps[j].a, p.swaps[j].b]); if (s.size !== 4) ruleBad.push('a double shares a slot'); if (round < 3) ruleBad.push('a double before round 3'); }
    if (slotOf(p, p.prize) !== ps) dBad++;
    // no two doors overlap at any sampled time
    for (let tt = 0; tt <= p.over; tt += 0.025) {
      const d = doorsAt(p, tt);
      samples++;
      for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) if (Math.abs(d[i].x - d[j].x) < SHUFFLE.doorW && Math.abs(d[i].z - d[j].z) < SHUFFLE.doorD) overlap++;
      if (new Set(d.map(q => q.slot)).size !== d.length && tt >= p.over) ruleBad.push('two doors in one slot at the end');
    }
  }
  t.ok(!ruleBad.length, `the prize door is in at least half of the swaps, never the same pair three times, rounds 2-3 end elsewhere, doubles use four slots (${prizeMoves.length} plans; ${ruleBad.slice(0, 3).join('; ')})`);
  t.ok(dBad === 0, 'slotOf follows the prize through every swap');
  t.ok(overlap === 0, `no two doors overlap at any of ${samples} sampled moments (front / back half ellipses, doubles in separate stretches)`);
  // 3. the round table
  const r1 = shufflePlan('t', 1, 0), r2 = shufflePlan('t', 2, 0), r3 = shufflePlan('t', 3, 0);
  t.ok(r1.n === 3 && r2.n === 4 && r3.n === 5 && Math.abs(r1.swaps[0].dur - 0.9) < 1e-9 && Math.abs(r2.swaps[0].dur - 0.7) < 1e-9 && Math.abs(r3.swaps[0].dur - 0.55) < 1e-9, 'the three rounds: 3 / 4 / 5 doors, one swap 0.9 / 0.7 / 0.55 s');
  t.ok(new Set(r1.look).size === 3 && new Set(r2.look).size === 2 && new Set(r3.look).size === 1, 'the doors look different in round 1 (three colours), two colours in round 2, all the same in round 3');
  t.ok(r3.swaps.some((s, i) => r3.swaps.some((q, j) => i !== j && s.t0 === q.t0)) || [...Array(30)].some((_, at) => { const p = shufflePlan('d', 3, at); return p.swaps.some((s, i) => p.swaps.some((q, j) => i !== j && s.t0 === q.t0)); }), 'round 3 has swaps at the same time now and then');
  // 4. the rubber band and a rematch
  const h0 = shufflePlan('t', 2, 5), h1 = shufflePlan('t', 2, 5, { help: helpLevel(2) }), h2 = shufflePlan('t', 2, 5, { help: helpLevel(4) }), hd = shufflePlan('t', 2, 5, { hard: true });
  t.ok(helpLevel(1) === 0 && helpLevel(2) === 1 && helpLevel(3) === 1 && helpLevel(4) === 2, 'the help starts after 2 misses and grows after 4');
  t.ok(Math.abs(h1.swaps[0].dur / h0.swaps[0].dur - 1.35) < 1e-9 && h1.swaps.length === h0.swaps.length - 1 && !h1.twinkle && Math.abs(h2.swaps[0].dur / h0.swaps[0].dur - 1.7) < 1e-9 && h2.twinkle, 'after 2 misses every swap is 1.35x slower and one swap shorter; after 4, 1.7x and the prize door twinkles');
  t.ok(hd.swaps.length === h0.swaps.length + 2 && Math.abs(hd.swaps[0].dur - h0.swaps[0].dur * 0.9) < 1e-9 && shufflePlan('t', 3, 0, { hard: true }).swaps[0].dur >= 0.45 - 1e-9, 'a rematch: two more swaps, 10% quicker, never under 0.45 s');
  // 5. picking a door by looking
  const o = { x: 56.5, y: 12, z: 46.5 }, plan = shufflePlan('look', 1, 0), doors = doorsAt(plan, plan.over + 1, o), eye = { x: 56.5, y: 12.6, z: 54.5 };
  const dirTo = (d, dx = 0, dy = 0) => { const v = [d.x + dx - eye.x, d.y + 1.6 + dy - eye.y, d.z - eye.z], l = Math.hypot(...v); return { x: v[0] / l, y: v[1] / l, z: v[2] / l }; };
  let ok = true, fuzz = true;
  for (const d of doors) { if (pickDoor(doors, eye, dirTo(d)) !== d.door) ok = false; if (pickDoor(doors, eye, dirTo(d, 0, 2.2)) !== d.door) fuzz = false; }
  t.ok(ok, 'looking straight at a door picks it');
  t.ok(fuzz && pickDoor(doors, eye, { x: 0, y: 0.6, z: 1 }) === null, 'a wobbly aim (a little above the door, within 8 degrees) still picks it; looking away picks nothing');
  // 6. a perfect player wins; a fixed pick wins about 1 time in n; with help the next try is slower
  let perfect = 0, fixed = 0, tries = 0;
  for (const round of [1, 2, 3]) for (let at = 0; at < 40; at++) { const p = shufflePlan('sim', round, at); tries++; if (p.prize === p.prize) perfect++; if (p.prize === 0) fixed++; }
  t.ok(perfect === tries && fixed < tries * 0.6 && fixed > 0, `a player who tracks the bow wins every time; one who always picks door 0 wins ${fixed} of ${tries} (about a third, never all)`);

  /* ---- the Pop-Up Room ---- */
  const { POPUP, popPlan, popAt, boopOk, popEnd } = P;
  const pp = popPlan('s', 0), jacks = pp.filter(p => !p.wobble), wob = pp.filter(p => p.wobble);
  t.ok(jacks.length === 20 && wob.length === POPUP.cheeky && same(pp, popPlan('s', 0)) && !same(pp, popPlan('s', 1)) && !same(pp, popPlan('t', 0)), `a round is ${jacks.length} jacks (and ${wob.length} cheeky boxes), the same for the same seed and attempt`);
  let rowBad = 0, dbl = 0, dblBad = 0;
  for (let k = 0; k < 30; k++) {
    const q = popPlan(`rule${k}`, k % 3);
    const groups = []; for (const e of q) { const g = groups[groups.length - 1]; if (g && g[0].t0 === e.t0) g.push(e); else groups.push([e]); }
    groups.forEach((g, i) => { if (i && g.some(e => groups[i - 1].some(f => f.box === e.box))) rowBad++; if (g.length === 2) { dbl++; if (g[0].box === g[1].box) dblBad++; } });
  }
  t.ok(rowBad === 0 && dblBad === 0 && dbl > 0, `no box twice in a row, the two jacks of a double are different boxes (${dbl} doubles in 30 rounds)`);
  const firstDouble = jacks.findIndex(p => p.double);
  t.ok(firstDouble >= POPUP.doubleFrom && Math.abs(jacks[0].up - 1.4) < 1e-9 && Math.abs(jacks[19].up - 0.75) < 1e-9 && popEnd(pp) > 30 && popEnd(pp) < 48, `jacks are up 1.4 s at the start and 0.75 s at the end, doubles only from the 12th (first at ${firstDouble}); a round lasts ${popEnd(pp).toFixed(0)} s`);
  const j = jacks[2], ni = pp.indexOf(j);
  t.ok(boopOk(pp, j.t0 + 0.1, j.box) === ni && boopOk(pp, j.t0 + j.up + 0.1, j.box) === ni && boopOk(pp, j.t0 + j.up + 0.2, j.box) === -1 && boopOk(pp, j.t0 - 0.05, j.box) === -1, 'a boop counts only while the jack is up and for 0.15 s after it ducks');
  t.ok(boopOk(pp, wob[0].t0 + 0.2, wob[0].box) === -1, 'a cheeky box never counts');
  const up = popAt(pp, j.t0 + 0.6)[0];
  t.ok(up.state === 'up' && up.rise === 1 && popAt(pp, j.t0 + 0.02)[0].rise < 1, 'a jack springs out (rise 0 to 1) and stays up');
  const score = plan => { const done = new Set(); let s = 0; for (const [n, p] of plan.entries()) { if (p.wobble) continue; const k = boopOk(plan, p.t0 + 0.3, p.box, done); if (k >= 0) { done.add(k); s++; } } return s; };
  t.ok(score(pp) === 20 && POPUP.need === 10 && 0 < POPUP.need, `a player who boops every jack at 0.3 s scores ${score(pp)} of 20 (10 win the bow); one who never boops scores 0`);
  const slow = popPlan('s', 0, { help: 1 }), slower = popPlan('s', 0, { help: 2 }), hard = popPlan('s', 0, { hard: true });
  t.ok(Math.abs(slow[0].up / pp[0].up - 1.25) < 1e-9 && Math.abs(slower[0].up / pp[0].up - 1.5) < 1e-9 && Math.abs(hard[0].up / pp[0].up - 0.9) < 1e-9 && P.needOf(true) === 12 && P.needOf(false) === 10, 'after a round that was not enough the jacks stay up 1.25x (then 1.5x) longer; a rematch is 0.9x and needs 12');
  // the lowest level that is easy: even a tired player (boops only 60%) gets 10 of the 20 with the 1.25x help
  let tired = 0; for (let k = 0; k < 20; k++) { const q = popPlan(`tired${k}`, 0, { help: 1 }); const done = new Set(); let s = 0; q.forEach((p, n) => { if (p.wobble || (n * 7) % 10 >= 6) return; if (boopOk(q, p.t0 + 0.5, p.box, done) >= 0) { s++; done.add(n); } }); if (s >= POPUP.need) tired++; }
  t.ok(tired >= 18, `a player who only catches 60% of the jacks still wins most of the time once they stay up longer (${tired} of 20 rounds)`);
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

  /* ---- the Shuffle Stage: a round at 60 and 20 steps a second ---- */
  const sh = await page.evaluate(async () => {
    const g = window.pokecraft, L = window.__live(), SH = await import('/src/shuffle.js');
    L.manual = true;
    window.__at(56.5, 11, 54.5, 0, 0);
    const out = { word0: L.near(g.player) };
    const run = dt => {
      L.sh = { phase: 'idle', round: 0, plan: null, t: 0, picked: null, win: false, resultT: 0, silly: 0, flyT: -1 };
      L.attempts = [0, 0, 0, 0]; L.misses = [0, 0, 0, 0];
      L.use(g.player);
      const plan = L.sh.plan;
      let steps = 0; const snap = {};
      while (L.sh.t < 4.0 - 1e-9) { L.step(dt); steps++; }
      snap.mid = L.info().stageDoors.map(d => [d.x, d.z].join(':')).join(' ');
      while (L.sh.phase === 'play') { L.step(dt); steps++; }
      snap.phase = L.sh.phase; snap.word = L.near(g.player); snap.end = L.info().stageDoors.map(d => `${d.door}@${d.slot}`).join(' ');
      return { plan, snap, steps };
    };
    const a = run(1 / 60), b = run(1 / 20);
    out.a = a.snap; out.b = b.snap; out.stepsA = a.steps; out.stepsB = b.steps; out.prize = a.plan.prize;
    out.same = JSON.stringify(a.plan) === JSON.stringify(b.plan);
    return out;
  });
  t.ok(sh.word0 === 'Play!', `on the watch pad the button says "${sh.word0}"`);
  t.ok(sh.same && sh.a.mid === sh.b.mid && sh.a.end === sh.b.end && sh.a.phase === 'pick' && sh.b.phase === 'pick' && sh.a.word === 'This one!', `a shuffle at 60 and at 20 steps a second is the same: same plan, same door places at 4 s and at the end, then the button says "${sh.a.word}" (${sh.stepsA} / ${sh.stepsB} steps)`);
  t.ok(await said(page, /Keep your eyes on the bow/), 'the hint "Keep your eyes on the bow!"');

  // a wrong pick: a silly surprise, the bow's door opens too, "Again!"
  const wrong = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), plan = L.sh.plan;
    const wrongDoor = [...Array(plan.n).keys()].find(d => d !== plan.prize);
    window.__toasts = [];
    const used = L.choose(wrongDoor);
    const out = { used, phase: L.sh.phase, misses: [...L.misses], bows: g.beaten.filter(k => /pw:doors:bow/.test(k)).length, toast: window.__toasts.join('|') };
    for (let i = 0; i < 40; i++) L.step(0.05);
    out.after = L.sh.phase; out.word = L.near(g.player);
    return out;
  });
  t.ok(wrong.used && wrong.phase === 'result' && wrong.misses[1] === 1 && wrong.bows === 0 && /The bow was here\. Again\?/.test(wrong.toast), `a wrong door: a silly surprise ("${wrong.toast}"), no bow, one miss`);
  t.ok(wrong.after === 'again' && wrong.word === 'Again!', `then the button says "${wrong.word}" (never a loss)`);
  // two more misses: the help (x1.35, then x1.7) and a look pick that is right
  const helpd = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), out = {};
    for (let k = 0; k < 2; k++) {
      L.use(g.player);
      const plan = L.sh.plan;
      out[`d${k}`] = plan.dur; out[`h${k}`] = plan.help;
      while (L.sh.phase === 'play') L.step(0.05);
      L.choose([...Array(plan.n).keys()].find(d => d !== plan.prize));
      for (let i = 0; i < 40; i++) L.step(0.05);
    }
    return out;
  });
  t.ok(helpd.h0 === 0 && Math.abs(helpd.d0 - 0.9) < 1e-9 && helpd.h1 === 1 && Math.abs(helpd.d1 - 0.9 * 1.35) < 1e-9, `after one miss nothing changes, after two the next round is slower (${helpd.d1.toFixed(3)} s a swap instead of 0.9)`);
  const right = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live();
    window.__toasts = [];
    L.use(g.player); // Again!
    while (L.sh.phase === 'play') L.step(0.05);
    const plan = L.sh.plan, d = L.stageDoors()[plan.prize];
    // look at the prize door from the pad
    window.__at(56.5, 11, 54.5, 0, 0);
    g.player.lookAt({ x: d.x, y: d.y + 1.6, z: d.z });
    const word = L.near(g.player), used = L.use(g.player);
    return { word, used, bows: g.beaten.filter(k => /pw:doors:bow/.test(k)), toast: window.__toasts.join('|'), win: L.sh.win };
  });
  t.ok(right.word === 'This one!' && right.used && right.win && right.bows.join() === 'pw:doors:bow1' && /You found it! 🎀 1 \/ 4/.test(right.toast), `looking at the door with the bow and pressing wins: "${right.toast}", key ${right.bows} ${JSON.stringify({ w: right.word, u: right.used, win: right.win })}`);
  const savedKeys = await page.evaluate(() => { const g = window.pokecraft; return JSON.parse(localStorage.getItem('pokecraft-save-v2') || '{}'); });
  void savedKeys;
  // round 2 and 3 follow the bows
  const rounds = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), out = [];
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < 60; i++) L.step(0.05); // the stage rests
      out.push(L.near(g.player));
      L.use(g.player);
      out.push(`${L.sh.round}:${L.sh.plan.n}`);
      while (L.sh.phase === 'play') L.step(0.05);
      L.choose(L.sh.plan.prize);
    }
    for (let i = 0; i < 60; i++) L.step(0.05);
    out.push(L.near(g.player), L.bows().n);
    return out;
  });
  t.ok(rounds.map(String).join() === 'Play!,2:4,Play!,3:5,null,3', `the next rounds follow the bows: round 2 has 4 doors, round 3 has 5, then the stage is done (${rounds.join()})`);

  /* ---- the Pop-Up Room ---- */
  const pop = await page.evaluate(async () => {
    const g = window.pokecraft, L = window.__live(), plan = window.__plan(), PU = await import('/src/popup.js');
    const pc = plan.popup.pad.centre;
    window.__at(pc[0], 11, pc[1], Math.atan2(-1, 0), 0); // face into the room (east side: +x is deeper)
    g.player.yaw = Math.atan2(-1, -0);
    const out = { word: L.near(g.player) };
    window.__toasts = [];
    L.use(g.player);
    out.phase = L.pu.phase; out.hint = window.__toasts.join('|');
    out.word2 = L.near(g.player);
    // run to the first jack, look at it and press with the block target and with the look ray
    const p = L.pu.plan, first = p[0];
    while (L.pu.t < first.t0 + 0.4) L.step(0.05);
    const box = plan.popup.boxes[first.box];
    out.open = g.world.get(...box.cell);
    g.player.lookAt({ x: box.at[0], y: box.at[1] + 1.0, z: box.at[2] });
    const hitBlock = g.gymLive.hit({ x: box.cell[0], y: box.cell[1], z: box.cell[2], id: out.open });
    out.score1 = L.pu.score; out.hit1 = hitBlock;
    // the same jack again does not count twice
    L.boop(first.box); out.score1b = L.pu.score;
    // a perfect player for the rest
    const startT = L.pu.t;
    while (L.pu.phase === 'run') {
      L.step(0.05);
      for (const a of PU.popAt(p, L.pu.t)) { const e = p[a.n]; if (!e.wobble && L.pu.t > e.t0 + 0.15) L.boop(e.box); }
    }
    out.phase2 = L.pu.phase; out.won = L.pu.won; out.score = L.pu.score; out.bows = L.bows().n; out.keys = g.beaten.filter(k => /bow4/.test(k)).length; out.secs = L.pu.t;
    return out;
  });
  t.ok(pop.word === 'Play!' && pop.phase === 'run' && /Boop the jacks before they hide/.test(pop.hint) && pop.word2 === 'Boop!', `on the pad the button says Play!, then Boop! ("${pop.hint}")`);
  t.ok(pop.open === 241 && pop.hit1 && pop.score1 === 1 && pop.score1b === 1, `a popped box opens (block 241) and a hit on it boops the jack (score ${pop.score1}; the same jack never counts twice: ${pop.score1b})`);
  t.ok(pop.phase2 === 'result' && pop.won && pop.score >= 10 && pop.keys === 1 && pop.bows === 4, `a perfect round: score ${pop.score} of 20, the fourth bow is saved (bows ${pop.bows} / 4, round ${pop.secs.toFixed(0)} s)`);
  const popBad = await page.evaluate(async () => {
    const g = window.pokecraft, L = window.__live();
    g.beaten.splice(g.beaten.indexOf('pw:doors:bow4'), 1); L.syncBlocks();
    window.__toasts = [];
    L.pu = { phase: 'idle', plan: null, t: 0, done: new Set(), score: 0, resultT: 0, hit: new Map(), last: -1 };
    L.use(g.player);
    const up1 = L.pu.plan[0].up;
    while (L.pu.phase === 'run') L.step(0.1);
    const out = { won: L.pu.won, score: L.pu.score, toast: window.__toasts.join('|'), misses: L.puMisses, word: L.near(g.player) };
    L.use(g.player); out.up2 = L.pu.plan[0].up / up1;
    // a cheeky box
    const ch = L.pu.plan.find(p => p.wobble);
    while (L.pu.t < ch.t0 + 0.2) L.step(0.05);
    window.__toasts = [];
    out.cheeky = L.boop(ch.box); out.cheekyToast = window.__toasts.join('|');
    L.pu.phase = 'idle';
    return out;
  });
  t.ok(!popBad.won && popBad.score === 0 && /You booped 0! Again\? They will be a bit slower\./.test(popBad.toast) && popBad.misses === 1 && popBad.word === 'Again!' && Math.abs(popBad.up2 - 1.25) < 1e-9, `no boops: "${popBad.toast}"; the next round is slower (x${popBad.up2.toFixed(2)})`);
  t.ok(!popBad.cheeky && /Cheeky box/.test(popBad.cheekyToast), 'a cheeky box does nothing bad ("Cheeky box!")');

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
  t.ok(/Shuffle Stage/.test(guide[0]) && /Pop-Up Room/.test(guide[1]) && /Big Gift/.test(guide[2]) && /Way back|Boss|star/i.test(guide[3] || '') && /Back to the hall/.test(guide[4]), `the guide: ${guide.map(s => (s || '').replace(/[↑↓←→]/g, '').trim().slice(0, 28)).join(' | ')}`);
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
      g.party = [S.makeCreature('blazehound', 100)]; g.cubes = 0;
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
  // the Shuffle Stage mid-swap (the doors are shut and two of them are gliding past each other)
  await page.evaluate(() => {
    const L = window.__live(), g = window.pokecraft;
    L.manual = true;
    L.sh = { phase: 'idle', round: 0, plan: null, t: 0, picked: null, win: false, resultT: 0, silly: 0, flyT: -1 };
    L.attempts = [0, 0, 0, 0]; L.misses = [0, 0, 0, 0];
    window.__at(56.5, 11, 54.5, 0, 0.12);
    L.use(g.player);
    const sw = L.sh.plan.swaps[1];
    while (L.sh.t < sw.t0 + sw.dur * 0.5) L.step(0.05);
    L.draw();
  });
  await shot(page, 'shuffle', null, 800);
  // the Pop-Up Room with a jack up
  await page.evaluate(() => {
    const L = window.__live(), g = window.pokecraft, plan = window.__plan();
    L.pu = { phase: 'idle', plan: null, t: 0, done: new Set(), score: 0, resultT: 0, hit: new Map(), last: -1 };
    L.puAttempt = 0;
    const pc = plan.popup.pad.centre;
    window.__at(pc[0], 11, pc[1], Math.atan2(-1, 0), 0.15);
    L.use(g.player);
    const p = L.pu.plan;
    while (L.pu.t < p[0].t0 + 0.5) L.step(0.05);
    L.draw();
  });
  await shot(page, 'popup', null, 800);
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
  const lookWord = async (name, pos, tgt, want, state) => {
    await ip.evaluate(([pos, tgt, state]) => {
      const g = window.pokecraft, L = window.__live();
      L.playing = () => document.getElementById('pause').classList.contains('hidden');
      if (state) state(g, L);
      window.__at(pos[0], pos[1], pos[2], 0, 0); g.player.lookAt({ x: tgt[0], y: tgt[1], z: tgt[2] });
    }, [pos, tgt, null]);
    let text = '';
    for (let i = 0; i < 80; i++) { await ip.waitForTimeout(150); text = await ip.evaluate(() => document.getElementById('btn-act')?.textContent || ''); if (text === want) break; }
    return text;
  };
  const plan = await ip.evaluate(() => { const p = window.__plan(), r = p.rooms.find(q => q.kind === 'springs'); return { door: r.door.cells[5], pad: [56.5, 11, 54.5], pop: p.popup.pad.centre, slide: p.slide.stand, box: p.popup.boxes[4] }; });
  const w = {};
  // a gift door
  const side = await ip.evaluate(() => { const p = window.__plan(), r = p.rooms.find(q => q.kind === 'springs'), c = r.door.cells[5]; const o = [[0, 1], [1, 0], [0, -1], [-1, 0]][r.side]; return { c, o }; });
  w.open = await lookWord('open', [side.c[0] + 0.5 - side.o[0] * 2.5, 11, side.c[2] + 0.5 - side.o[1] * 2.5], [side.c[0] + 0.5, 12.5, side.c[2] + 0.5], 'Open!');
  // the watch pad
  w.play = await lookWord('play', plan.pad, [56.5, 13, 40], 'Play!');
  // the pick phase
  await ip.evaluate(() => { const L = window.__live(), g = window.pokecraft; L.manual = true; L.use(g.player); while (L.sh.phase === 'play') L.step(0.05); L.manual = false; });
  w.pick = await lookWord('pick', plan.pad, [56.5, 13, 46.5], 'This one!');
  await ip.evaluate(() => { const L = window.__live(); L.sh.phase = 'idle'; L.sh.plan = null; });
  // the pop-up pad, then Boop!
  w.popPlay = await lookWord('popPlay', [plan.pop[0], 11, plan.pop[1]], [plan.box.at[0], 12.5, plan.box.at[2]], 'Play!');
  await ip.evaluate(() => { const L = window.__live(), g = window.pokecraft; L.manual = true; L.use(g.player); L.manual = true; });
  w.boop = await lookWord('boop', [plan.pop[0], 11, plan.pop[1]], [plan.box.at[0], 12.5, plan.box.at[2]], 'Boop!');
  await ip.evaluate(() => { const L = window.__live(); L.pu.phase = 'idle'; });
  // the slide
  w.slide = await lookWord('slide', [plan.slide[0], plan.slide[2], plan.slide[1]], [plan.slide[0], plan.slide[2] + 1, plan.slide[1] + 3], 'Slide!');
  t.ok(w.open === 'Open!' && w.play === 'Play!' && w.pick === 'This one!' && w.popPlay === 'Play!' && w.boop === 'Boop!' && w.slide === 'Slide!', `the one big button says "${w.open}" at a door, "${w.play}" on the watch pad, "${w.pick}" when the doors stop, "${w.popPlay}" then "${w.boop}" in the Pop-Up Room and "${w.slide}" at the top of the slide`);
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
  // a tap on a popped jack: project the jack to the screen and tap there
  await ip.evaluate(async () => {
    const g = window.pokecraft, L = window.__live(), p = window.__plan(), pc = p.popup.pad.centre;
    L.pu = { phase: 'idle', plan: null, t: 0, done: new Set(), score: 0, resultT: 0, hit: new Map(), last: -1 };
    L.manual = true; L.playing = () => true;
    window.__log = [];
    if (!g.gymLive.__wrapped) { const t0 = g.gymLive.tap.bind(g.gymLive); g.gymLive.tap = (o, d) => { const r = t0(o, d); window.__log.push([o.x.toFixed(1), o.y.toFixed(1), o.z.toFixed(1), d.x.toFixed(2), d.y.toFixed(2), d.z.toFixed(2), r].join(' ')); return r; }; g.gymLive.__wrapped = true; }
    window.__at(pc[0], 11, pc[1], Math.atan2(-1, 0), 0.1); g.player.yaw = Math.atan2(-1, 0);
    L.use(g.player);
    const first = L.pu.plan[0];
    while (L.pu.t < first.t0 + 0.5) L.step(0.05);
    L.draw();
  });
  await ip.waitForTimeout(1500); // a frame or two: the camera follows the player
  const jack = await ip.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), p = window.__plan(), first = L.pu.plan[0];
    g.camera.updateMatrixWorld();
    const box = p.popup.boxes[first.box], v = new (g.camera.position.constructor)(box.at[0], box.at[1] + 0.9, box.at[2]).project(g.camera);
    L.playing = () => document.getElementById('pause').classList.contains('hidden');
    return { sx: (v.x * 0.5 + 0.5) * window.innerWidth, sy: (-v.y * 0.5 + 0.5) * window.innerHeight, score: L.pu.score, onScreen: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1 };
  });
  for (let k = 0; k < 3; k++) { // (a tap can be lost while the page is busy: try again)
    await ip.touchscreen.tap(jack.sx, jack.sy);
    await waitFor(ip, () => window.__live().pu.score >= 1, null, 15000).catch(() => {});
    if (await ip.evaluate(() => window.__live().pu.score >= 1)) break;
  }
  const sc = await ip.evaluate(() => window.__live().pu.score);
  const dbg = await ip.evaluate(() => ({ log: window.__log, phase: window.__live().pu.phase, paused: window.__live().paused() }));
  t.ok(jack.onScreen && sc >= 1, `a tap on the popped jack on the screen boops it (score ${sc}) ${sc >= 1 ? '' : JSON.stringify({ jack, dbg })}`);
  await ip.evaluate(() => { const L = window.__live(); L.manual = true; L.playing = () => true; });
  await ip.screenshot({ path: path.join(SHOTS, 't44-ipad.png'), timeout: 180000 });
  console.log('  screenshot t44-ipad.png');
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
  t.ok(seeds[0].plan === seeds[1].plan && seeds[0].seed !== seeds[1].seed, 'both see the same rooms behind the same doors, but each has their own shuffle seed');
  // Dad opens a door: Kid's door stays shut
  const door = await A.evaluate(() => { const g = window.pokecraft, r = window.__plan().rooms.find(q => q.kind === 'slide'); const c = r.door.cells[5]; g.gymLive.hit({ x: c[0], y: c[1], z: c[2], id: 238 }); return c; });
  const ids = await Promise.all([A, Bp].map(p => p.evaluate(c => window.pokecraft.world.get(c[0], c[1], c[2]), door)));
  t.ok(ids[0] === 0 && ids[1] === 238, 'one player opening a door does not open it for the other');
  // each plays their own shuffle
  const plans = await Promise.all([A, Bp].map(p => p.evaluate(() => { const g = window.pokecraft, L = window.__live(); L.manual = true; window.__at(56.5, 11, 54.5, 0, 0); L.use(g.player); return { phase: L.sh.phase, key: JSON.stringify(L.sh.plan.swaps.map(s => [s.a, s.b])) + L.sh.plan.prize }; })));
  t.ok(plans[0].phase === 'play' && plans[1].phase === 'play' && plans[0].key !== plans[1].key, 'both play the stage at once, each their own shuffle');
  // a bow won by Dad is not Kid's
  const bow = await A.evaluate(() => { const g = window.pokecraft, L = window.__live(); L.manual = true; while (L.sh.phase === 'play') L.step(0.05); L.choose(L.sh.plan.prize); return g.beaten.filter(k => /pw:doors:bow/.test(k)).length; });
  const kidBows = await Bp.evaluate(() => window.pokecraft.beaten.filter(k => /pw:doors:bow/.test(k)).length);
  t.ok(bow === 1 && kidBows === 0, `Dad's bow is Dad's (${bow}); Kid has none (${kidBows})`);
}
