// T44 + T48 (wave 15): the Surprise type and Jolly Jax's Surprise Party (plans/T44.md for the type, plans/T48-surprise-party.md for the party
// that replaced the Room of Doors).
// A: the type (data, models, chart, moves, fx, sounds, the wild gift box, spawns, the blocks). B: the party terrain for three seeds in Node
// (the room, the sets, the walk graph, keeps, the cake), the old-bow mapping, the Spinner and the party surprises. C: the four games as pure
// rules in Node with model players at 60 and 20 steps a second (tests/partybots.mjs). D: live, in a browser (the frame, the Spinner, each
// game's three rounds played through the live part, the twists, the crashers, the sweets, the cake finale, the guide, the chip, an old
// Room of Doors save, Jolly Jax, a rematch party, a reload). E: iPad (one big button: Spin! / Stop! / Play! / Whack! / Drop!, a tap on a
// jack). F: two browsers. G: the screenshots.
// SURPRISE_ONLY=data|land|games|live|ipad|pair|shots runs one part; SURPRISE_SKIP_BOSS=1 leaves out the long Boss battles.
// Screenshots (tests/screenshots): t48-party.png, t48-spinner.png, t48-pinata.png, t48-catch.png, t48-stack.png, t48-whack.png, t48-finale.png,
// t48-giftbox.png, t48-family.png, t48-ipad.png.
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
async function intoParty(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  await waitFor(page, () => { const f = window.pokecraft.world.swirl.frames.find(f => f.world === 'doors'); return window.pokecraft.world.get(...f.cloth[0]) === 144; }, null, 150000);
  await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'doors'), c = f.cloth[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: 144 }); });
  await placeIs(page, 'doors');
  await helpers(page);
}
// in-page helpers: step the player and the live part by hand (the frame loop does not move the player while the page has no pointer lock)
const helpers = page => page.evaluate(async () => {
  const g = window.pokecraft, Bt = await import('/tests/partybots.mjs'), SP = await import('/src/spinner.js'), PL = await import('/src/partyland.js'), PN = await import('/src/pinata.js'), PW = await import('/src/popupwhack.js');
  window.__bots = Bt; window.__pinAt = (run, tt) => PN.pinataAt(run, tt); window.__headOf = (boxes, p) => PW.headOf(boxes, p, 1);
  const L = () => g.gymLive.of('part:doors');
  window.__live = L;
  L().playing = () => true; // the live part runs without pointer lock in the tests (the iPad test keeps the real rule)
  window.__at = (x, y, z, yaw = 0, pitch = 0) => { const p = g.player; p.carry?.leave?.(false); p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.keys = {}; };
  window.__clearBows = () => { for (let i = 1; i <= 4; i++) { const k = `pw:doors:bow${i}`; const j = g.beaten.indexOf(k); if (j >= 0) g.beaten.splice(j, 1); } };
  window.__setBows = list => { window.__clearBows(); for (const i of list) g.beaten.push(`pw:doors:bow${i}`); };
  window.__reset = () => { const lv = L(); lv.gm = null; lv.sp.phase = 'idle'; lv.sp.spin = null; lv.finale = null; lv.restoreNooks(); lv.unslow(); for (const id of SP.GAMES) { lv.misses[id] = [0, 0, 0, 0]; } lv.sweetsReady = true; lv.dim = 1; g.lightsDim = 1; const s = lv.sets; for (const id of SP.GAMES) for (const c of lv.order[id]) lv.cells.want(c.x, c.y, c.z, c.base); lv.cells.flush(); };
  window.__toPad = () => { const s = PL.SPINNER.stand; window.__at(s[0], s[1], s[2], s[3], 0.25); };
  // Spin! and Stop! when slice k is under the arrow (its middle within 0.25 rad), then step until the game builds and is ready
  window.__spinTo = (k, dt = 0.02) => {
    const lv = L();
    window.__toPad();
    const w0 = lv.near(g.player);
    if (w0 !== 'Spin!') return { w0 };
    lv.use(g.player);
    let n = 0;
    const mid = (k + 0.5) * Math.PI / 2, off = () => { const th = ((-lv.wheelAngle()) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return Math.abs(Math.atan2(Math.sin(th - mid), Math.cos(th - mid))); };
    while (n++ < 400 && !(n > 5 && off() < 0.25)) lv.step(dt);
    const w1 = lv.near(g.player);
    lv.use(g.player);
    for (let i = 0; i < 400 && lv.sp.phase !== 'idle'; i++) lv.step(dt);
    return { w0, w1, slice: lv.sp.slice };
  };
  window.__ready = () => { const lv = L(); for (let i = 0; i < 400 && lv.gm && lv.gm.phase !== 'ready'; i++) lv.step(0.05); return lv.gm?.phase; };
  // Play one round of the current game through the live part with a model player. -> { start, out: 'won' | 'missed' | phase, ... }
  window.__playRound = (kind, dt) => {
    const lv = L(), gm = lv.gm, set = lv.sets[gm.game], p = g.player;
    window.__at(set.standAt[0], 11, set.standAt[1], 0, 0);
    const start = lv.near(p);
    if (start !== 'Play!' && start !== 'Again!') return { start, phase: gm.phase };
    lv.use(p);
    const game = gm.game, words = new Set();
    let steps = 0, presses = 0;
    const mind = game === 'pinata' ? Bt.pinataMind(kind) : game === 'catch' ? Bt.catchMind(kind) : game === 'stack' ? Bt.stackMind(kind) : Bt.whackMind(kind);
    while (lv.gm && lv.gm.phase === 'run' && steps < 6000) {
      const r = lv.gm.run;
      if (game === 'pinata') {
        const run = r.runs.find(q => !q.done) ?? r.runs[0], m = mind(run, r.t + dt, p.pos);
        if (m.to) { const dx = m.to.x - p.pos.x, dz = m.to.z - p.pos.z, d = Math.hypot(dx, dz), s = Math.min(d, Bt.WALK * dt); if (d > 1e-6) { p.pos.x += (dx / d) * s; p.pos.z += (dz / d) * s; } }
        p.yaw = Math.atan2(-m.face.x, -m.face.z); p.pitch = 0;
        lv.step(dt); steps++;
        const w = lv.near(p); words.add(w);
        if (m.press && w === 'Whack!' && lv.gm?.phase === 'run') { if (lv.use(p)) presses++; }
      } else if (game === 'catch') {
        const to = mind(r.run, r.t, p.pos), x0 = p.pos.x, z0 = p.pos.z;
        if (to) { const sp = Math.min(p.speedCap ?? 99, 4.6), dx = to.x - p.pos.x, dz = to.z - p.pos.z, d = Math.hypot(dx, dz), s = Math.min(d, sp * dt); if (d > 1e-6) { p.pos.x += (dx / d) * s; p.pos.z += (dz / d) * s; } }
        p.vel.set((p.pos.x - x0) / dt, 0, (p.pos.z - z0) / dt);
        lv.step(dt); steps++;
      } else if (game === 'stack') {
        lv.step(dt); steps++;
        const w = lv.near(p); words.add(w);
        if (lv.gm?.phase === 'run' && mind(lv.gm.run.st, lv.gm.run.t, dt) && w === 'Drop!') { if (lv.use(p)) presses++; }
      } else {
        lv.step(dt); steps++;
        if (lv.gm?.phase !== 'run') break;
        const e = p.eyePos, eye = { x: e.x, y: e.y, z: e.z }, dir = mind(lv.gm.run.st, lv.gm.run.t, set.boxes, eye);
        const w = lv.near(p); words.add(w);
        if (dir) { p.lookAt({ x: eye.x + dir.x, y: eye.y + dir.y, z: eye.z + dir.z }); if (w === 'Whack!' && lv.use(p)) presses++; }
      }
    }
    p.vel.set(0, 0, 0);
    const out = lv.gm?.phase;
    return { start, out, words: [...words].join(), presses, steps, t: +(steps * dt).toFixed(2), info: lv.info() };
  };
  // Play a whole game (three rounds) with a model player; misses are retried. -> [round results]
  window.__playGame = (kind, dt, maxTries = 4) => {
    const lv = L(), game = lv.gm?.game, res = [];
    for (let k = 0; k < 3 * maxTries && lv.gm && lv.gm.game === game && lv.gm.phase !== 'clear'; k++) {
      window.__ready();
      if (!lv.gm || lv.gm.phase !== 'ready') break;
      const round = lv.gm.round, r = window.__playRound(kind, dt);
      res.push(`${round}:${r.out}`);
      for (let i = 0; i < 80 && lv.gm && (lv.gm.phase === 'won' || lv.gm.phase === 'missed'); i++) lv.step(0.05);
    }
    for (let i = 0; i < 60 && lv.gm; i++) lv.step(0.05); // the set goes back into the floor
    return res;
  };
});
async function shot(page, name, spot, wait = 2500) {
  if (spot) await page.evaluate(([x, y, z, yaw, pitch]) => window.__at(x, y, z, yaw, pitch), spot);
  await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren?.(); });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `t48-${name}.png`), timeout: 180000 });
  console.log(`  screenshot t48-${name}.png`);
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
      // blocks: still 235-243 (T48 took no new id: the Room of Doors' ids got new jobs), the tiles
      const B = BK.B, W = BK.WOOL;
      const ids2 = { 235: W.surprise, 236: B.GIFT_WALL, 237: B.PARTY_FLOOR, 238: B.PRESENT, 239: B.GOLD_PRESENT, 240: B.POP_BOX, 241: B.POP_BOX_OPEN, 242: B.CAKE, 243: B.CANDLE };
      for (const [k, v] of Object.entries(ids2)) if (+k !== v) bad(`block id ${k} is ${v}`);
      for (const id of [236, 237, 238, 239, 240, 241, 242, 243]) { const d = BK.BLOCKS[id]; if (!d || !d.fixed || BK.PLACEABLE.includes(id)) bad(`block ${id} is not fixed / is placeable`); }
      if (BK.BLOCKS[B.CAKE].bounce || !BK.BLOCKS[B.GOLD_PRESENT].glow || !BK.BLOCKS[B.CANDLE].glow || BK.BLOCKS[B.CAKE].name !== 'Birthday Cake' || BK.BLOCKS[B.PRESENT].name !== 'Present') bad('block flags and names');
      if (!BK.BLOCKS[W.surprise] || BK.BLOCKS[W.surprise].name !== 'Surprise Wool') bad('wool');
      out.tiles = ['SU_WRAP', 'SU_FLOOR', 'SU_PRESENT', 'SU_PRESENT_TOP', 'SU_GOLD_PRESENT', 'SU_BOX_TOP', 'SU_BOX_SIDE', 'SU_BOX_OPEN', 'SU_CAKE', 'SU_FLAME', 'SU_CAKE_TOP'].every(n => BK.T[n] != null);
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

  /* ======================================== B. the terrain, the old bows, the Spinner (Node) ======================================== */
  if (want('land')) await landPart(t);

  /* ======================================== C. the four games (Node) ======================================== */
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
  const L = await src('partyland.js'), Bk = await src('blocks.js'), SP = await src('spinner.js'), P = await src('pinata.js');
  const { B, WOOL, isSolid } = Bk;
  const W = 112, D = 112, H = 48;
  const standIn = seed => {
    const w = { W, D, H, data: new Uint8Array(W * D * H), ground: new Int16Array(W * D), seed };
    w.index = (x, y, z) => x + W * (z + D * y);
    w.inBounds = (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < H;
    w.get = (x, y, z) => (w.inBounds(x, y, z) ? w.data[w.index(x, y, z)] : 0);
    return w;
  };
  const hashes = [];
  const R = L.ROOM, S = L.SQUARE;
  const inSq = (x, z) => x >= S.x0 && x <= S.x1 && z >= S.z0 && z <= S.z1;
  for (const seed of SEEDS) {
    const w = standIn(seed);
    L.partyLand(w, { id: 'doors' });
    const tag = `seed ${seed}`;
    let h = 0; for (let i = 0; i < w.data.length; i++) h = (Math.imul(h, 31) + w.data[i]) | 0; hashes.push(h);
    // 1. one room: gift-paper walls all round (no gap), the party floor inside, no ceiling (open lid), the frame home by the south wall
    let gaps = 0, floorOk = true, roof = 0;
    for (let x = R.x0 - 1; x <= R.x1 + 1; x++) for (let z = R.z0 - 1; z <= R.z1 + 1; z++) {
      const wall = x < R.x0 || x > R.x1 || z < R.z0 || z > R.z1;
      if (wall) { for (let y = 11; y <= L.WALL_TOP; y++) if (!isSolid(w.get(x, y, z))) gaps++; }
      else { if (!isSolid(w.get(x, 10, z))) floorOk = false; for (let y = L.WALL_TOP + 1; y < H; y++) if (w.get(x, y, z) !== B.AIR) roof++; }
    }
    t.ok(!gaps && floorOk && !roof && w.doors.length === 1 && w.doors[0].key === 'doors', `${tag}: one room ${R.x1 - R.x0 + 1} x ${R.z1 - R.z0 + 1} inside, walls all round (${gaps} gaps), a floor everywhere, the lid open, one frame home`);
    // 2. the party floor: flat, nothing over it (the Piñata Party's rug and 3.5 blocks round it), its middle is the piñata's
    let bumps = 0;
    for (let x = S.x0; x <= S.x1; x++) for (let z = S.z0; z <= S.z1; z++) { if (!isSolid(w.get(x, 10, z))) bumps++; for (let y = 11; y <= 24; y++) if (w.get(x, y, z) !== B.AIR) bumps++; }
    const ring = P.PINATA.ring;
    t.ok(!bumps && Math.abs((S.x0 + S.x1 + 1) / 2 - ring.x) < 0.01 && Math.abs((S.z0 + S.z1 + 1) / 2 - ring.z) < 0.01 && S.x1 - S.x0 + 1 >= 2 * (ring.r + 3.5), `${tag}: the party floor (${S.x1 - S.x0 + 1} x ${S.z1 - S.z0 + 1}) is flat with open air above (${bumps} bumps), round the piñata's rug middle`);
    // 3. the four sets: inside the party floor, only floor cells and blocks on air; the boxes and pads
    const sets = w.parts[0].sets, setBad = [];
    for (const id of SP.GAMES) {
      const s = sets[id];
      for (const [x, z] of [...s.floor, ...s.pad]) { if (!inSq(x, z) || w.get(x, 10, z) !== B.PARTY_FLOOR) setBad.push(`${id} floor ${x},${z}`); }
      for (const [x, y, z] of s.up) if (!inSq(x, z) || y !== 11 || w.get(x, y, z) !== B.AIR) setBad.push(`${id} up ${x},${y},${z}`);
      if (!inSq(Math.floor(s.standAt[0]), Math.floor(s.standAt[1]))) setBad.push(`${id} stand`);
    }
    const rim = sets.pinata.floor.filter(c => c[2] === WOOL.surprise).length;
    t.ok(!setBad.length && sets.catch.boxes.length === 9 && sets.whack.boxes.length === 9 && sets.catch.catchFloor.length === 72 && rim >= 36 && sets.stack.up.length === 9, `${tag}: the four sets fit the party floor (the rug's rim ${rim} cells, Jack Catch 9 boxes and 72 free floor cells, Pop-Up Whack 9 boxes, the Gift Stack table 3 x 3) ${setBad.slice(0, 4).join('; ')}`);
    // 4. the walk graph: from the arrival every set pad, the spinner pad, the cake's front, the rest, the crashers' and guests' spots; nobody stuck
    const graph = buildGraph(w, Bk);
    const node = (x, y, z) => `${Math.floor(x)},${y},${Math.floor(z)}`, arrival = w.arrivals.doors, start = node(arrival[0], 11, arrival[2]);
    const seen = bfs(graph, [start]);
    const goals = { spinner: node(L.SPINNER.stand[0], 11, L.SPINNER.stand[2]), rest: node(L.REST[0], 11, L.REST[2]), cakeFront: node(L.CAKE.x, 11, L.CAKE.z + 6), ...Object.fromEntries(SP.GAMES.map(id => [id, node(sets[id].standAt[0], 11, sets[id].standAt[1])])),
      ...Object.fromEntries(L.CRASHERS.map(c => [`crasher${c.i}`, node(c.x, 11, c.z)])), ...Object.fromEntries(L.GUESTS.map((gst, i) => [`guest${i}`, node(gst.at[0], 11, gst.at[2])])), ...Object.fromEntries(L.GUESTS.map((gst, i) => [`cake${i}`, node(gst.cake[0], 11, gst.cake[2])])) };
    const missing = Object.entries(goals).filter(([, k]) => !seen.has(k)).map(([n]) => n);
    t.ok(!missing.length, `${tag}: from the arrival you walk to the Spinner, every game's pad, the cake, the rest spot and every person's spot ${missing.join(', ')}`);
    const rev = new Map();
    for (const [a, bs] of graph) for (const b of bs) { if (!rev.has(b)) rev.set(b, []); rev.get(b).push(a); }
    const back = bfs(rev, [start]);
    const stuck = [...seen].filter(k => !back.has(k));
    t.ok(!stuck.length, `${tag}: nobody is stuck anywhere (the presents, the table, the cake's plate) (${stuck.length} places with no way back${stuck.length ? ': ' + stuck.slice(0, 3).join(' ') : ''})`);
    // with every set up the arrival can still reach the spinner and each set's pad
    for (const id of SP.GAMES) {
      const g2 = buildGraph(w, Bk, sets[id].up), s2 = bfs(g2, [start]);
      if (!s2.has(goals.spinner) || !s2.has(goals[id])) t.ok(false, `${tag}: with the ${id} set up the pad or the Spinner cannot be reached`);
    }
    // 5. the cake: three tiers of cake blocks, eight candles with air over them (the flames are setLive), Jolly Jax's stand on top, out of reach on foot
    const C = L.CAKE, tierOk = C.tiers.every(tr => w.get(C.x + tr.r, tr.y0, C.z) === B.CAKE && w.get(C.x + tr.r + 1, tr.y0, C.z) !== B.CAKE);
    const candles = C.candles.every(([dx, dz]) => isSolid(w.get(C.x + dx, C.candleY, C.z + dz)) && w.get(C.x + dx, C.candleY + 1, C.z + dz) === B.AIR);
    const boss = w.bosses[0];
    t.ok(tierOk && candles && w.get(C.x, C.stand, C.z) === B.BOSS_STAND && boss.id === 'doors' && boss.pos[1] === C.stand + 1 && !seen.has(node(C.x, C.stand + 1, C.z)) && boss.crew.length === 2, `${tag}: the cake has three tiers and eight candles; Jolly Jax's stand is on its top (y ${boss.pos[1]}), not reachable on foot; two crew spots`);
    t.ok(boss.rest.join() === L.REST.join() && w.rests.length === 1 && w.rests[0].join() === L.REST.join(), `${tag}: a lost battle rests you by the table (${boss.rest.slice(0, 3)}), never on the cake`);
    // 6. keeps: nobody builds at the party
    const covered = (x, y, z) => w.keeps.some(k => k.protect.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1));
    const keepOk = [[R.x0, 11, R.z0], [R.x1, 11, R.z1], [56, 11, 53], [C.x, 16, C.z], [R.x0 - 1, 15, 50], [70, 11, 53]].every(c => covered(...c));
    t.ok(keepOk, `${tag}: keeps cover the room, the walls, the party floor and the cake`);
    // 7. nooks: wild gift boxes by the walls and the table, all far from the party floor's middle (a game keeps them away within 17)
    const nk = w.nooks;
    t.ok(nk.length === 12 && nk.every(n => w.get(n.x, n.y, n.z) === B.AIR && isSolid(w.get(n.x, n.y - 1, n.z)) && Math.hypot(n.x + 0.5 - ring.x, n.z + 0.5 - ring.z) > 17), `${tag}: ${nk.length} nook spots for wild gift boxes, on something solid, all over 17 blocks from the party floor's middle`);
    // 8. people: four guests in party hats (look party), on the floor, outside the party floor
    t.ok(w.people.length === 4 && w.people.every(pp => pp.look === 'party' && pp.party && !inSq(Math.floor(pp.pos[0]), Math.floor(pp.pos[2]))), `${tag}: four party guests in party hats, none on the party floor`);
  }
  t.ok(new Set(hashes).size === 1, 'the party is the same for every seed (only the games and the Spinner use the seed)');

  /* ---- the old Room of Doors' bows: the same NUMBER of bows, a won Jack Catch stays Jack Catch ---- */
  const cases = [[[], []], [[1], [1]], [[2], [1]], [[4], [2]], [[1, 2], [1, 2]], [[1, 4], [1, 2]], [[2, 3], [1, 2]], [[1, 2, 3], [1, 2, 3]], [[1, 2, 4], [1, 2, 3]], [[3, 4], [1, 2]], [[1, 2, 3, 4], [1, 2, 3, 4]]];
  const wrong = cases.filter(([o, n]) => JSON.stringify(L.partyBows(o)) !== JSON.stringify(n));
  t.ok(!wrong.length, `old bows -> party bows: ${cases.map(([o, n]) => `[${o}]->[${L.partyBows(o)}]`).join(' ')} ${wrong.map(x => x[0]).join('|')}`);
  const m1 = L.migrateBows(['x', 'pw:doors:bow4', 'pw:doors:crew1', 'pw:doors:gift2']), m2 = L.migrateBows(m1.beaten), m3 = L.migrateBows(['pw:doors:bow2', L.PARTY_MARK]);
  t.ok(m1.changed && m1.beaten.includes('pw:doors:bow2') && !m1.beaten.includes('pw:doors:bow4') && m1.beaten.includes('pw:doors:crew1') && m1.beaten.includes('pw:doors:gift2') && m1.beaten.includes(L.PARTY_MARK) && !m2.changed && JSON.stringify(m2.beaten) === JSON.stringify(m1.beaten) && !m3.changed && m3.beaten.includes('pw:doors:bow2'),
    'an old save is moved over once (old bow4 = Jack Catch = bow2 now; the crew and gift keys stay; the party mark is written), a second visit changes nothing, and a party save is never moved again');
  for (let n = 0; n <= 4; n++) for (const set of combos(n)) if (L.partyBows(set).length !== n) t.ok(false, `old bows ${set} keep their number`);

  /* ---- the Party Spinner (pure) ---- */
  const half = Math.PI / 4;
  let hits = 0, tries = 0, same = 0;
  for (let seed = 1; seed <= 40; seed++) for (let k = 0; k < 4; k++) for (const press of [0, 0.37, 1.9]) {
    // the moment slice k's middle is under the arrow (the wheel at angle a shows local -a under the arrow)
    const want = (k + 0.5) * (Math.PI / 2), a0 = 0.3, s = SP.newSpin(a0, press, seed, 0), period = (2 * Math.PI) / SP.SPIN.turn;
    let stop = press + (((-want - a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / SP.SPIN.turn;
    if (stop - press < 0.5) stop += period;
    const res = SP.spinStop(press, stop, seed, { a0, n: 0 }); tries++; if (res.slice === k) hits++;
    if (SP.spinStop(press, stop, seed, { a0, n: 0 }).angle === res.angle && SP.spinAngle(s, press) === a0) same++;
  }
  t.ok(hits === tries && same === tries, `Stop! when a slice's middle is under the arrow always lands on it (${hits} / ${tries} for 40 seeds, 4 slices, 3 press times), and the same presses give the same stop`);
  {
    const s = SP.newSpin(0, 1, 5, 2); s.stop = 3;
    let jumps = 0, last = SP.spinAngle(s, 0);
    for (let tt = 0; tt <= 3 + SP.SPIN.slow + 0.5; tt += 1 / 120) { const a = SP.spinAngle(s, tt); if (Math.abs(a - last) > SP.SPIN.turn / 100) jumps++; last = a; }
    const rest = SP.restAngle(s), moved = rest - SP.spinAngle(s, 3);
    t.ok(!jumps && Math.abs(moved - 2 * Math.PI) <= SP.SPIN.wobble + 1e-9 && SP.spinDone(s, 3 + SP.SPIN.slow) && !SP.spinDone(s, 3 + SP.SPIN.slow - 0.01), `the wheel turns smoothly (no jumps in 1/120 s steps), slows down over ${SP.SPIN.slow} s and turns one more round (${(moved / (2 * Math.PI)).toFixed(3)}) plus at most a ${SP.SPIN.wobble} rad wobble`);
    t.ok(SP.GAMES.join() === 'pinata,catch,stack,whack' && SP.spinStop(0, 1.2, 9).slice === SP.spinStop(0, 1.2, 9).slice, `the four slices are ${SP.GAMES.join(', ')} (bows 1-4); a stop is a closed form of the press times`);
  }
  /* ---- the party surprises ---- */
  const tw = {};
  for (const g of SP.GAMES) for (const round of [1, 2, 3]) for (let seed = 0; seed < 60; seed++) { const x = SP.twistOf(g, round, seed, 0); const k = `${g}${round}`; (tw[k] ||= new Set()).add(x?.id ?? 'none'); }
  const fmt = k => [...tw[k]].sort().join('/');
  t.ok(SP.GAMES.every(g => fmt(`${g}1`) === 'none') && !tw.pinata2.has('two') && tw.pinata3.has('two') && SP.GAMES.every(g => [2, 3].every(r => tw[`${g}${r}`].size >= 2 && !tw[`${g}${r}`].has('none'))), `round 1 never has a surprise; two piñatas only in round 3; round 2 and 3 always one (${SP.GAMES.map(g => `${g}: ${fmt(`${g}2`)} | ${fmt(`${g}3`)}`).join('; ')})`);
  t.ok(SP.twistOf('stack', 2, 5, 1)?.id === SP.twistOf('stack', 2, 5, 1)?.id && Object.values(SP.TWISTS).flat().every(x => /^Surprise! /.test(x.say)), 'a surprise is a pure function of game, round, seed and party; every one says "Surprise! ..."');

  /* ---- the graph helpers (a player box walking: up one block with a jump, down any way) ---- */
  function combos(n) { const out = []; for (let m = 0; m < 16; m++) { const s = [1, 2, 3, 4].filter((_, i) => m & (1 << i)); if (s.length === n) out.push(s); } return out; }
  function bfs(graph, starts) {
    const seen = new Set(starts), q = [...starts];
    while (q.length) { const a = q.pop(); for (const b of graph.get(a) || []) if (!seen.has(b)) { seen.add(b); q.push(b); } }
    return seen;
  }
  function buildGraph(w, { isSolid }, extra = []) {
    const more = new Set(extra.map(([x, y, z]) => `${x},${y},${z}`));
    const solid = (x, y, z) => more.has(`${x},${y},${z}`) || isSolid(w.get(x, y, z));
    const stand = (x, y, z) => solid(x, y - 1, z) && !solid(x, y, z) && !solid(x, y + 1, z);
    const graph = new Map(), node = (x, y, z) => `${x},${y},${z}`;
    const add = (a, b) => { if (!graph.has(a)) graph.set(a, []); graph.get(a).push(b); };
    for (let x = R.x0 - 2; x <= R.x1 + 2; x++) for (let z = R.z0 - 2; z <= R.z1 + 2; z++) for (let y = 11; y <= 20; y++) {
      if (!stand(x, y, z)) continue;
      const a = node(x, y, z);
      if (!graph.has(a)) graph.set(a, []);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (stand(nx, y, nz)) add(a, node(nx, y, nz));
        else if (!solid(nx, y, nz) && !solid(nx, y + 1, nz)) { for (let d = 1; d <= 8; d++) { if (solid(nx, y - d, nz)) { if (stand(nx, y - d + 1, nz)) add(a, node(nx, y - d + 1, nz)); break; } } }
        if (stand(nx, y + 1, nz) && !solid(x, y + 2, z)) add(a, node(nx, y + 1, nz));
      }
    }
    return graph;
  }
}

/* ============================================================================================ */
/* C. the four games                                                                             */
/* ============================================================================================ */

async function gamesPart(t) {
  const P = await src('pinata.js'), J = await src('jackcatch.js'), L = await src('partyland.js'), PR = await src('partyrounds.js'), GS = await src('giftstack.js'), PW = await src('popupwhack.js'), FG = await src('fairgames.js'), SP = await src('spinner.js');
  const Bt = await import(pathToFileURL(path.join(ROOT, 'tests', 'partybots.mjs')).href);
  const { PINATA } = P, sets = L.setsOf();
  const both = f => [1 / 60, 1 / 20].map(f);

  /* ---- the Piñata Party: pinata.js as it was, its three piñatas are the three rounds ---- */
  const a = JSON.stringify(P.pinataPlan(11, 2, 3)), b = JSON.stringify(P.pinataPlan(11, 2, 3)), c = JSON.stringify(P.pinataPlan(11, 2, 4));
  t.ok(a === b && a !== c && PINATA.rounds.map(r => r.id).join() === 'llama,star,rocket' && PINATA.rounds.map(r => r.hp).join() === '5,7,9' && PINATA.ring.x === 56.5 && PINATA.ring.z === 53.5, 'pinata.js is unchanged: a try is a pure function of seed / piñata / try; llama, star, rocket with 5 / 7 / 9 CRACKs; the rug in the middle of the party floor');
  t.ok(JSON.stringify(PR.pinataRound(5, 2, 1)) === JSON.stringify([P.pinataPlan(5, 2, 1)]) && JSON.stringify(PR.pinataRound(5, 3, 0, { help: 1 })) === JSON.stringify([P.pinataPlan(5, 3, 0, { help: 1 })]), 'a round without a surprise is exactly pinata.js\'s plan (round 1 the llama, 2 the star, 3 the rocket)');
  // the stick: a CRACK only when it swings at you, a Bonk from behind, a whiff costs 2 s (the old rules, unchanged)
  {
    const plan = P.pinataPlan(5, 1, 0), run = P.newRun(plan);
    let tl = 0; for (let tt = 0; tt < 6; tt += 0.01) { const q = P.pinataAt(run, tt); if (q.y < PINATA.low + 0.05) { tl = tt; break; } }
    const q = P.pinataAt(run, tl), v = Math.hypot(q.vx, q.vz), ux = q.vx / v, uz = q.vz / v;
    const front = { x: q.x + ux * 1.5, y: 11 + Bt.EYE, z: q.z + uz * 1.5 }, back = { x: q.x - ux * 1.5, y: 11 + Bt.EYE, z: q.z - uz * 1.5 };
    const toQ = e => ({ x: q.x - e.x, z: q.z - e.z }), away = e => ({ x: e.x - q.x, z: e.z - q.z });
    const r1 = P.newRun(plan), w1 = P.whack(r1, tl, front, toQ(front)), r2 = P.newRun(plan), w2 = P.whack(r2, tl, back, toQ(back));
    const r3 = P.newRun(plan), miss = P.whack(r3, tl, back, away(back)), again = P.whack(r3, tl + 1.0, front, toQ(front));
    t.ok(w1.big && r1.hp === plan.hp - 1 && w2.hit && !w2.big && miss.swung && !miss.hit && !again.swung, 'the stick: whacked as it swings at you = CRACK; from behind = Bonk; a whiff spins you round for 2 s');
  }
  // the rounds with model players, at 60 and 20 steps a second
  const win = (kind, round, opts = {}, n = 8, dt = 1 / 60) => { let w = 0; for (let k = 0; k < n; k++) if (Bt.playPinata(kind, PR.pinataRound(1000 + k, round, k, opts), dt).won) w++; return w; };
  const pin = both(dt => [1, 2, 3].map(r => win('kid', r, {}, 8, dt)));
  const still = [1, 2, 3].map(r => win('still', r)), mash = [1, 2, 3].map(r => win('masher', r));
  t.ok(pin.every(l => l.every(n => n >= 7)) && still.every(n => n === 0) && mash[1] === 0 && mash[2] === 0, `Piñata Party: a skilled kid wins every round (60: ${pin[0]}, 20: ${pin[1]} of 8); standing still and whacking never (${still}); mashing under it only the llama (${mash})`);
  // the surprises: two piñatas (both must burst, the second slower, 15 s more), a wobbly rope (it swings further)
  {
    const two = PR.pinataRound(3, 3, 0, { twist: 'two' }), one = PR.pinataRound(3, 3, 0);
    const wob = PR.pinataRound(3, 2, 0, { twist: 'wobbly' })[0], plain = P.pinataPlan(3, 2, 0);
    const twoWins = both(dt => win('kid', 3, { twist: 'two' }, 8, dt)), wobWins = both(dt => win('kid', 3, { twist: 'wobbly' }, 8, dt));
    const r = two.map(P.newRun);
    t.ok(two.length === 2 && two[1].period > two[0].period && two[1].hp === 3 && two[0].time === one[0].time + 15 && wob.first.amp > plain.first.amp && wob.hitAmp > plain.hitAmp, `"Two piñatas!": a second, slower llama (${two[1].hp} CRACKs, a ${two[1].period.toFixed(2)} s swing) and ${two[0].time} s; "Wobbly rope!": it swings out ${(wob.first.amp / plain.first.amp).toFixed(2)} x further`);
    t.ok(twoWins.every(n => n >= 7) && wobWins.every(n => n >= 7), `a skilled kid still wins with two piñatas (${twoWins} of 8) and a wobbly rope (${wobWins} of 8), at 60 and 20 steps a second`);
    // a press hits whichever piñata is in reach; the stick's rest is shared
    const q0 = P.pinataAt(r[0], 2), eye = { x: q0.x + 1, y: q0.y, z: q0.z }, res = PR.whackRuns(r, 2, eye, { x: -1, y: 0, z: 0 });
    t.ok(res.swung && r[0].ready === r[1].ready, 'with two piñatas one press swings at the one in reach, and the stick rests for both');
  }

  /* ---- Jack Catch: jackcatch.js as it was, three rounds of rising need ---- */
  const cs = sets.catch, opts = (x = {}) => ({ boxes: cs.boxes, floor: cs.catchFloor, start: cs.start, ...x });
  const c1 = J.catchPlan(5, 0, opts()), c2 = J.catchPlan(5, 0, opts());
  t.ok(JSON.stringify(c1) === JSON.stringify(c2) && J.CATCH.need === 12 && J.CATCH.jacks === 16, 'jackcatch.js is unchanged: a round is a pure function of seed / try, 16 jacks and 12 to win');
  const rounds = [1, 2, 3].map(r => PR.catchRound(9, r, 0, opts()));
  t.ok(rounds.map(p => p.jacks).join() === '10,13,16' && rounds.map(p => p.need).join() === '6,9,12' && PR.catchRound(9, 3, 0, opts({ hard: true })).need === 14 && rounds.every(p => p.launches.every(l => l.kind === 'pie' || cs.catchFloor.some(f => Math.hypot(f[0] - l.to[0], f[1] - l.to[1]) < 0.9))), `three rounds: ${rounds.map(p => `${p.jacks} jacks, ${p.need} to win`).join('; ')} (a rematch party 14 in round 3); every jack lands on the carpet`);
  {
    const g0 = PR.catchRound(4, 2, 0, opts()), gg = PR.catchRound(4, 2, 0, opts({ twist: 'gold' })), gp = PR.catchRound(4, 3, 0, opts({ twist: 'pies' })), g3 = PR.catchRound(4, 3, 0, opts()), gs = PR.catchRound(4, 3, 0, opts({ twist: 'sticky' }));
    const golds = p => p.launches.filter(l => l.kind === 'gold').length, pies = p => p.launches.filter(l => l.kind === 'pie'), fl = p => p.launches.filter(l => l.kind !== 'pie')[0].flight;
    t.ok(golds(gg) > golds(g0) && pies(gp).length > pies(g3).length && pies(gp).every(l => l.flight > J.CATCH.pies.flight * 1.2) && fl(gs) > fl(g3) && gs.end > g3.end && gs.cap === 3.6 && g3.cap == null, `the surprises: Double gold (${golds(g0)} -> ${golds(gg)} gold jacks), Pie party (${pies(g3).length} -> ${pies(gp).length} pies, slower), Sticky floor (flights ${fl(g3).toFixed(2)} -> ${fl(gs).toFixed(2)} s, you run at 3.6)`);
  }
  const cWin = (kind, round, x = {}, dt = 1 / 60) => { let w = 0; for (let s = 0; s < 10; s++) if (Bt.playCatch(kind, PR.catchRound(300 + s, round, s, opts(x)), dt, cs.start).won) w++; return w; };
  const cat = both(dt => [1, 2, 3].map(r => cWin('kid', r, {}, dt))), catStill = [1, 2, 3].map(r => cWin('still', r));
  const catTw = ['gold', 'pies', 'sticky'].map(tw => cWin('kid', 3, { twist: tw }));
  t.ok(cat.every(l => l.every(n => n >= 8)) && catStill.every(n => n === 0) && catTw.every(n => n >= 7), `Jack Catch: a skilled kid wins every round (60: ${cat[0]}, 20: ${cat[1]} of 10) and with every surprise in round 3 (${catTw}); standing still never (${catStill})`);

  /* ---- Gift Stack ---- */
  {
    const plan = GS.stackPlan(1, 1, 0), st = GS.newStack(plan);
    // a drop right over the middle is Perfect! (it keeps its size), one off by 1 is cut, one that misses topples
    let tt = 0; while (Math.abs(GS.craneAt(plan, tt).x) > 0.02) tt += 0.0005;
    const p1 = GS.drop(st, tt), w1 = st.size.w;
    let t2 = tt + GS.STACK.reload; while (Math.abs(GS.craneAt(plan, t2).x - 1) > 0.02) t2 += 0.0005;
    const p2 = GS.drop(st, t2), w2 = st.size.w;
    const early = GS.drop(st, t2 + 0.1);
    t.ok(p1.perfect && w1 === GS.STACK.start && !p2.perfect && Math.abs(w2 - (GS.STACK.start - 1)) < 0.05 && p2.cut.length === 1 && Math.abs(p2.cut[0].w - 1) < 0.05 && !early.dropped, `Perfect! keeps the size (${w1}); a drop 1 off cuts 1 off (now ${w2.toFixed(2)} wide, the bit that hung over falls off); no present on the hook = nothing to drop`);
    const st2 = GS.newStack(plan); let t3 = 0; while (Math.abs(GS.craneAt(plan, t3).x) < GS.STACK.amp - 0.05) t3 += 0.001;
    GS.drop(st2, 0.0001); const bad = GS.newStack(GS.stackPlan(1, 1, 0)); bad.top = { x: 0, z: 0, w: 0.3, d: 3 }; const mres = GS.drop(bad, t3);
    t.ok(mres.miss && bad.over === 'toppled', 'a present that misses the stack (or is cut thinner than the smallest) topples it: the round starts again');
    const plans = [1, 2, 3].map(r => GS.stackPlan(2, r, 0));
    t.ok(plans.map(p => p.need).join() === '5,7,9' && plans[0].period > plans[1].period && plans[1].period > plans[2].period && GS.stackPlan(2, 3, 0, { hard: true }).need === 10 && GS.stackPlan(2, 2, 0, { slow: FG.fairHelp(2).slow }).period > plans[1].period, `5 / 7 / 9 presents, the crane faster each round (${plans.map(p => p.period.toFixed(2))} s a swing); after two misses the Funfair's kind help slows it; a rematch needs one more`);
    const wob = GS.stackPlan(2, 2, 0, { twist: 'wobbly' }), tiny = GS.stackPlan(2, 2, 0, { twist: 'tiny' }), windy = GS.stackPlan(2, 2, 0, { twist: 'windy' });
    let zmax = 0, centres = new Set(); for (let tt2 = 0; tt2 < 20; tt2 += 0.05) { zmax = Math.max(zmax, Math.abs(GS.craneAt(wob, tt2).z)); centres.add(Math.round(GS.craneAt(windy, tt2).x - GS.STACK.amp * Math.sin((2 * Math.PI / windy.period) * tt2 + windy.phase))); }
    t.ok(zmax > 0.5 && tiny.start < GS.STACK.start && centres.size >= 2 && Math.abs(GS.craneAt(plans[1], 3).z) < 1e-9, `the surprises: Wobbly crane (swings in and out too, up to ${zmax.toFixed(2)}), Tiny presents (they start ${tiny.start} wide), Windy (the middle of the swing drifts)`);
    const sWin = (kind, r, x = {}, dt = 1 / 60) => { let w = 0; for (let s = 0; s < 12; s++) if (Bt.playStack(kind, GS.stackPlan(100 + s, r, 0, x), dt).won) w++; return w; };
    const pro = both(dt => [1, 2, 3].map(r => sWin('pro', r, {}, dt))), kid = both(dt => [1, 2, 3].map(r => sWin('kid', r, {}, dt))), kidTw = ['wobbly', 'tiny', 'windy'].map(tw => sWin('kid', 3, { twist: tw }));
    const mash = [1, 2, 3].map(r => sWin('masher', r)), stillS = Bt.playStack('still', GS.stackPlan(1, 1, 0), 1 / 60, 30);
    t.ok(pro.every(l => l.every(n => n === 12)) && kid.every(l => l.every(n => n >= 10)) && kidTw.every(n => n >= 9) && mash.every(n => n === 0) && !stillS.won && stillS.placed === 0, `Gift Stack: a skilled player wins every round (60: ${pro[0]}, 20: ${pro[1]} of 12), a kid who is a bit off too (60: ${kid[0]}, 20: ${kid[1]}; with the surprises ${kidTw}); dropping at once never (${mash}); never dropping never`);
    // the same presses give the same stack (a replay), at any frame rate
    const r60 = Bt.playStack('kid', GS.stackPlan(7, 3, 0), 1 / 60), replay = GS.newStack(GS.stackPlan(7, 3, 0));
    for (const tp of r60.drops) GS.drop(replay, tp);
    t.ok(replay.placed === r60.placed && Math.abs(replay.size.w - r60.width) < 1e-12 && replay.over === r60.over, `replaying a round's drops gives the same stack (${r60.placed} presents, ${r60.width.toFixed(2)} wide at the top)`);
  }

  /* ---- Pop-Up Whack ---- */
  {
    const wb = sets.whack.boxes, eye = { x: sets.whack.standAt[0], y: 11 + Bt.EYE, z: sets.whack.standAt[1] };
    const p1 = PW.whackPlan(3, 1, 0), p1b = PW.whackPlan(3, 1, 0), p2 = PW.whackPlan(3, 1, 1);
    const plans = [1, 2, 3].map(r => PW.whackPlan(3, r, 0));
    t.ok(JSON.stringify(p1) === JSON.stringify(p1b) && JSON.stringify(p1) !== JSON.stringify(p2) && plans.map(p => p.need).join() === '8,11,14' && plans[0].up > plans[1].up && plans[1].up > plans[2].up && plans.every(p => p.time === 30 && p.pops.every(q => q.box >= 0 && q.box < 9) && p.pops.some(q => q.kind === 'pie') && p.pops.some(q => q.kind === 'gold') && p.most >= p.need + 4), `a round is a pure function of seed / round / try; 8 / 11 / 14 points in 30 s, the jacks stay up ${plans.map(p => p.up.toFixed(2))} s; pie jacks and gold jacks in every round`);
    // no box pops twice at once
    let overlap = 0; for (const p of plans) for (const a of p.pops) for (const b of p.pops) if (a !== b && a.box === b.box && a.t0 < b.t0 + b.up && b.t0 < a.t0 + a.up) overlap++;
    t.ok(!overlap, 'a box never has two jacks at once');
    // a whack: a plain jack +1, a gold one +2, a pie jack -1 (a splat), at nothing = a whiff and the stick needs a moment
    const st = PW.newWhack(plans[0]), j = plans[0].pops.find(q => q.kind === 'jack'), pie = plans[0].pops.find(q => q.kind === 'pie'), gold = plans[0].pops.find(q => q.kind === 'gold');
    const dirTo = (p, tt) => { const h = PW.headOf(wb, p, 1); return { x: h.x - eye.x, y: h.y - eye.y, z: h.z - eye.z }; };
    const r1 = PW.whackAt(st, j.t0 + 0.3, wb, eye, dirTo(j));
    const st2 = PW.newWhack(plans[0]); st2.score = 3; const r2 = PW.whackAt(st2, pie.t0 + 0.3, wb, eye, dirTo(pie));
    const st3 = PW.newWhack(plans[0]), r3 = PW.whackAt(st3, gold.t0 + 0.3, wb, eye, dirTo(gold));
    const st4 = PW.newWhack(plans[0]), r4 = PW.whackAt(st4, j.t0 - 0.6, wb, eye, dirTo(j)), r5 = PW.whackAt(st4, j.t0 - 0.6 + 0.5, wb, eye, dirTo(j));
    t.ok(r1.hit && st.score === 1 && r2.pie && st2.score === 2 && st2.splats === 1 && r3.gold && st3.score === 2 && !r4.hit && r4.swung && !r5.swung, `whack a jack +1, a gold one +2, a pie jack is a splat -1, a whack at nothing makes the stick rest ${PW.WHACK.cool.miss} s`);
    const mir = PW.whackPlan(3, 2, 0, { twist: 'mirror' }), speedy = PW.whackPlan(3, 2, 0, { twist: 'speedy' });
    t.ok(mir.pops.some(q => q.shook === 8 - q.box && q.box !== 4) && plans[1].pops.every(q => q.shook === q.box) && speedy.up < plans[1].up && speedy.pops.length > plans[1].pops.length, `the surprises: Mirror (${mir.pops.filter(q => q.shook !== q.box).length} jacks come out of the box opposite the one that shook), Speedy (${speedy.pops.length} shorter pops instead of ${plans[1].pops.length}), Lights out (looks only)`);
    const helped = PW.whackPlan(3, 2, 0, { help: FG.fairHelp(2) });
    t.ok(helped.up > plans[1].up && helped.time === 40, `after two misses the jacks stay up longer (${plans[1].up.toFixed(2)} -> ${helped.up.toFixed(2)} s) and there are 10 s more`);
    const wWin = (kind, r, x = {}, dt = 1 / 60) => { let w = 0; for (let s = 0; s < 12; s++) if (Bt.playWhack(kind, PW.whackPlan(100 + s, r, 0, x), dt, wb, eye).won) w++; return w; };
    const kid = both(dt => [1, 2, 3].map(r => wWin('kid', r, {}, dt))), tw = ['dark', 'mirror', 'speedy'].map(x => wWin('kid', 3, { twist: x }));
    const mash = [1, 2, 3].map(r => wWin('masher', r)), stillW = [1, 2, 3].map(r => wWin('still', r));
    let allThree = 0; for (let s = 0; s < 12; s++) if ([1, 2, 3].every(r => Bt.playWhack('masher', PW.whackPlan(100 + s, r, 0), 1 / 60, wb, eye).won)) allThree++;
    t.ok(kid.every(l => l.every(n => n >= 11)) && tw.every(n => n >= 11) && mash.every(n => n <= 5) && mash[2] <= 2 && !allThree && stillW.every(n => n === 0), `Pop-Up Whack: a kid who watches wins every round (60: ${kid[0]}, 20: ${kid[1]} of 12; with the surprises ${tw}); whacking all the time without looking rarely (${mash}) and never all three rounds; never whacking never`);
  }
  void SP;
}

/* ============================================================================================ */
/* D. live                                                                                       */
/* ============================================================================================ */

async function livePart({ browser, base, t, page }) {
  await newGame(page, 0); await pause(page);
  await toasts(page);
  // an old Room of Doors save: bow1 (a piñata) and bow4 (Jack Catch) won there, a helper beaten and a gift opened
  await page.evaluate(() => { const g = window.pokecraft; g.beaten.push('pw:doors:bow1', 'pw:doors:bow4', 'pw:doors:gift3'); });
  await intoParty(page);
  await waitFor(page, () => /Surprise Party/.test(document.getElementById('clock')?.textContent || ''), null, 60000).catch(() => {});
  const clk = await page.evaluate(() => { const g = window.pokecraft; return { clock: document.getElementById('clock')?.textContent || '', place: g.place, realm: g.world.realm.id, name: g.world.realm.name, version: g.world.realm.version, parts: g.world.parts.map(p => p.live), keys: g.beaten.filter(k => /pw:doors/.test(k)).sort().join() }; });
  t.ok(clk.place === 'doors' && clk.realm === 'doors' && clk.name === 'Surprise Party' && clk.version === 2 && clk.parts.join() === 'doors' && /Surprise Party/.test(clk.clock), `through the gift-wrapped frame into the Surprise Party (realm doors, version ${clk.version}, clock "${clk.clock}")`);
  t.ok(clk.keys === 'pw:doors:bow1,pw:doors:bow2,pw:doors:gift3,pw:doors:party', `the old save's two bows are two bows now: the piñata's and Jack Catch's (${clk.keys}); the old gift key stays`);
  const frame = await page.evaluate(async () => { const { pictureWorld } = await import('/src/pictureworlds.js'), R = await import('/src/realms.js'), w = pictureWorld('doors'); return { ready: w.ready, name: w.name, pic: typeof w.picture, clean: JSON.stringify(R.cleanRealmEdits({ doors: [[5, 1]] }, { doors: 1 })), keep: JSON.stringify(R.cleanRealmEdits({ doors: [[5, 1]] }, { doors: 2 })) }; });
  t.ok(frame.ready && frame.name === 'Surprise Party' && frame.pic === 'function' && frame.clean === '{}' && frame.keep === '{"doors":[[5,1]]}', `the frame is ready and called Surprise Party; the Room of Doors' old edits (version 1) are dropped, the party's kept (${frame.clean} / ${frame.keep})`);
  const arrive = await page.evaluate(() => { const p = window.pokecraft.player.pos; return [p.x, p.y, p.z]; });
  t.ok(Math.abs(arrive[0] - 56.5) < 0.01 && Math.abs(arrive[2] - 72.5) < 0.01 && arrive[1] === 11, `you arrive by the frame home at the south wall (${arrive.map(v => v.toFixed(1))})`);
  t.ok(await said(page, /SURPRISE! Welcome to the party!/) && await said(page, /Win 4 party games for 4 golden bows! Spin the Party Spinner to pick one\./), 'the arrival words are said');
  // the people: guests at the party, Ribbon Rosa crashed in already (one bow), Confetti Kit and Jax not yet
  await page.evaluate(() => { const L = window.__live(); L.manual = true; for (let i = 0; i < 4; i++) { window.pokecraft.gymLive.update(0.3); } });
  const ppl = await page.evaluate(() => { const g = window.pokecraft; return g.npcs.list.map(n => `${n.kind}:${n.name}:${n.away ? 'away' : 'here'}`).join(); });
  t.ok(/guest:Party Polly:here/.test(ppl) && /crew:Ribbon Rosa:here/.test(ppl) && /crew:Confetti Kit:away/.test(ppl) && /boss:Jolly Jax:away/.test(ppl), `guests in party hats; with 2 bows Ribbon Rosa has crashed the party, Confetti Kit and Jolly Jax are not here yet (${ppl})`);

  /* ---- the Spinner: Spin! / Stop!, good timing picks the game, a won slice gives sweets once ---- */
  const sw = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), out = {};
    window.__toasts = []; g.cubes = 0;
    out.spinWon = window.__spinTo(0); // the piñata: won already
    out.cubes1 = g.cubes; out.gm1 = !!L.gm;
    out.again = window.__spinTo(1);   // Jack Catch: won too
    out.cubes2 = g.cubes; out.gm2 = !!L.gm;
    out.toasts = window.__toasts.join('|');
    out.real = window.__spinTo(2);    // Gift Stack: a real game
    out.gm = L.gm?.game; out.phase = window.__ready();
    out.toasts2 = window.__toasts.join('|');
    // the set is up: the table, its pad
    const set = L.sets.stack; out.table = set.up.every(([x, y, z]) => g.world.get(x, y, z) === 236); out.pad = set.pad.every(([x, z]) => g.world.get(x, 10, z) === 69);
    out.chip = document.getElementById('score-chip')?.textContent;
    return out;
  });
  t.ok(sw.spinWon.w0 === 'Spin!' && sw.spinWon.w1 === 'Stop!' && sw.spinWon.slice === 0 && sw.cubes1 === 2 && !sw.gm1 && /Party sweets! \+2 Capture Cubes/.test(sw.toasts), `on the pad the big button says Spin!, then Stop!; stopped with the piñata under the arrow it lands there, a game already won: party sweets (+${sw.cubes1} Capture Cubes)`);
  t.ok(sw.again.slice === 1 && sw.cubes2 === 2 && !sw.gm2 && /You won Jack Catch already\. Spin again!/.test(sw.toasts), 'a second won slice gives no more sweets (only once until the next game is won): "Spin again!"');
  t.ok(sw.real.slice === 2 && sw.gm === 'stack' && sw.phase === 'ready' && sw.table && sw.pad && /Surprise! It's Gift Stack!/.test(sw.toasts2) && /round 1 of 3/.test(sw.toasts2), `stopped on Gift Stack: "Surprise! It's Gift Stack!", the set whooshes up out of the floor (a table, a gold pad) and round 1 is ready ("${sw.chip}")`);

  /* ---- Gift Stack, all three rounds with a skilled player through the big button ---- */
  const gs = await page.evaluate(() => { window.__toasts = []; const r = window.__playGame('pro', 1 / 60); const g = window.pokecraft, L = window.__live(); return { r, bows: L.bows().n, bow3: g.beaten.includes('pw:doors:bow3'), toasts: window.__toasts.join('|'), gm: L.gm, set: L.sets.stack.up.every(([x, y, z]) => g.world.get(x, y, z) === 0) }; });
  t.ok(gs.r.join() === '1:won,2:won,3:won' && gs.bow3 && gs.bows === 3 && /A golden bow for Gift Stack! \(3 \/ 4\)/.test(gs.toasts) && /Yay!/.test(gs.toasts) && !gs.gm && gs.set, `Gift Stack: three rounds won with Drop! (${gs.r}), the third golden bow, the guests cheer, the set goes back into the floor`);
  t.ok(/Surprise! (Wobbly crane|Tiny presents|Windy)!/.test(gs.toasts), `round 2 and 3 came with a party surprise ("${(gs.toasts.match(/Jolly Jax: Surprise! [^|]*/g) || []).join('" "')}")`);
  // the third bow: Confetti Kit crashes the party
  const kit = await page.evaluate(() => { const g = window.pokecraft; for (let i = 0; i < 3; i++) g.gymLive.update(0.3); return { kit: !g.npcs.list.find(n => n.name === 'Confetti Kit').away, toasts: window.__toasts.join('|') }; });
  t.ok(kit.kit && /Surprise! A party crasher! Confetti Kit wants a battle!/.test(kit.toasts), 'after the third bow Confetti Kit crashes the party ("Surprise! A party crasher! ...")');

  /* ---- each game's rounds at 60 and 20 steps a second (Piñata Party, Jack Catch, Pop-Up Whack); a careless player misses ---- */
  const games = [];
  for (const [k, kind] of [[0, 'kid'], [1, 'pro'], [3, 'pro']]) for (const dt of [1 / 60, 1 / 20]) {
    games.push(await page.evaluate(([k, kind, dt]) => {
      const g = window.pokecraft, L = window.__live(), id = ['pinata', 'catch', 'stack', 'whack'][k];
      window.__reset(); window.__setBows([1, 2, 3, 4].filter(i => i !== k + 1)); window.__toasts = [];
      const spin = window.__spinTo(k), r = window.__playGame(kind, dt);
      return { id, dt, slice: spin.slice, r: r.join(), bow: g.beaten.includes(`pw:doors:bow${k + 1}`), toasts: window.__toasts.join('|') };
    }, [k, kind, dt]));
  }
  for (const r of games) t.ok(r.slice === ['pinata', 'catch', 'stack', 'whack'].indexOf(r.id) && r.r.replace(/\d:missed,/g, '') === '1:won,2:won,3:won' && (r.r.match(/missed/g) || []).length <= 1 && r.bow, `${r.id} at ${Math.round(1 / r.dt)} steps a second: a good player wins round 1, 2 and 3 through the live part, at most one miss (the seed comes from a random player id) (${r.r}) and the bow`);
  const words = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), out = {};
    for (const [k, id] of [[0, 'pinata'], [3, 'whack'], [1, 'catch']]) {
      window.__reset(); window.__setBows([]); window.__spinTo(k); window.__ready();
      const set = L.sets[id]; window.__at(set.standAt[0], 11, set.standAt[1], 0, 0);
      const play = L.near(g.player); L.use(g.player); L.step(0.05);
      out[id] = `${play}/${L.near(g.player)}`;
    }
    return out;
  });
  t.ok(words.pinata === 'Play!/Whack!' && words.whack === 'Play!/Whack!' && words.catch === 'Play!/null', `the big button: Play! on the gold pad, then Whack! (Piñata Party ${words.pinata}, Pop-Up Whack ${words.whack}; Jack Catch has no button, you run: ${words.catch})`);
  // careless: whacking all the time in Pop-Up Whack misses the round, "Again!", and after two misses the jacks stay up longer
  const careless = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live();
    window.__reset(); window.__setBows([]); window.__toasts = [];
    window.__spinTo(3); window.__ready();
    const a = window.__playRound('still', 0.05); for (let i = 0; i < 60 && L.gm.phase === 'missed'; i++) L.step(0.05);
    const up0 = L.gm && window.__playRound('still', 0.05); for (let i = 0; i < 60 && L.gm.phase === 'missed'; i++) L.step(0.05);
    const word = L.near(g.player);
    L.use(g.player);
    const up = L.gm.run.st.plan.up, time = L.gm.run.st.plan.time;
    return { a: a.out, b: up0.out, word, misses: L.misses.whack[1], up, time, toasts: window.__toasts.join('|') };
  });
  t.ok(careless.a === 'missed' && careless.b === 'missed' && careless.misses === 2 && careless.word === 'Again!' && careless.time === 40 && careless.up > 1.3 && /You got \d+! Again\?/.test(careless.toasts) && /It will be a bit slower now/.test(careless.toasts), `Pop-Up Whack: never whacking misses the round (${careless.a}, ${careless.b}); "Again!", and after two misses the jacks stay up ${careless.up.toFixed(2)} s with ${careless.time} s on the clock`);
  // leaving the party floor in the middle of a round: it waits (not a miss)
  const leave = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(); window.__toasts = [];
    const set = L.sets.whack; window.__at(set.standAt[0], 11, set.standAt[1], 0, 0);
    if (L.gm.phase !== 'run') L.use(g.player);
    window.__at(40.5, 11, 53.5); L.step(0.05);
    return { phase: L.gm.phase, misses: L.misses.whack[1], toast: window.__toasts.join('|') };
  });
  t.ok(leave.phase === 'ready' && /The game waits for you on the party floor!/.test(leave.toast), `walking off the party floor in a round: "${leave.toast}" (no miss)`);
  // the Piñata Party with "Two piñatas!" in round 3; "Lights out!" dims the room and the piñata glows
  const twists = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), out = {};
    window.__reset(); window.__setBows([]);
    window.__spinTo(0); window.__ready();
    L.gm.round = 3; L.gm.twistRound = 3; L.gm.twist = { id: 'two', say: 'Surprise! Two piñatas!' };
    const r = window.__playRound('kid', 0.05); out.two = `${r.out} ${r.info.game?.phase}`; out.runs = L.gm.run?.runs.length;
    window.__reset(); window.__spinTo(0); window.__ready();
    L.gm.twist = { id: 'dark', say: 'Surprise! Lights out!' };
    const set = L.sets.pinata; window.__at(set.standAt[0], 11, set.standAt[1], 0, 0); L.use(g.player);
    for (let i = 0; i < 40; i++) L.step(0.05);
    L.draw(); out.dim = +L.dim.toFixed(2); out.lights = +g.lightsDim.toFixed(2); out.glow = L.pin[0].body.material === L.pinataGlow;
    window.__reset(); L.step(0.05); out.after = g.lightsDim;
    return out;
  });
  t.ok(/^won/.test(twists.two) && twists.runs === 2, `"Two piñatas!": two piñatas swing on the rug and a kid pops both (${twists.two})`);
  t.ok(twists.dim < 0.4 && twists.lights === twists.dim && twists.glow && twists.after === 1, `"Lights out!": the room dims to ${twists.dim} and the piñata glows; the lights come back after (${JSON.stringify(twists)})`);
  // a wild gift box near the party floor leaves while a game runs, the nooks come back after
  const wild = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live();
    window.__reset(); window.__setBows([]);
    for (const w of [...g.creatures.list]) g.creatures.remove(w);
    const near = g.creatures.spawnAt('giftle', 60, 11, 46, { level: 40, when: 'gift' });
    const nooks0 = g.world.nooks.length;
    window.__spinTo(3); window.__ready();
    const set = L.sets.whack; window.__at(set.standAt[0], 11, set.standAt[1], 0, 0); L.use(g.player);
    for (let i = 0; i < 12; i++) L.step(0.05);
    const out = { gone: !g.creatures.list.includes(near), nooksDuring: g.world.nooks.length, nooks0 };
    window.__reset(); out.nooksAfter = g.world.nooks.length;
    return out;
  });
  t.ok(wild.gone && wild.nooksAfter === wild.nooks0 && wild.nooksDuring <= wild.nooks0, `a wild gift box near the party floor goes away while a game runs, and the nooks are back after (${wild.nooks0} -> ${wild.nooksDuring} -> ${wild.nooksAfter})`);

  // wild gift boxes: label, "Open!", the reveal text, seen in the Book only after
  const wildT = await page.evaluate(() => {
    const g = window.pokecraft;
    for (const w of [...g.creatures.list]) g.creatures.remove(w);
    window.__at(40.5, 11, 72.5, 0, 0);
    const w = g.creatures.spawnAt('popjack', 40, 11, 68, { level: 40, when: 'gift' });
    g.player.lookAt({ x: 40.5, y: 11.5, z: 68.5 });
    return { wrapped: w.wrapped, seenBefore: g.book.seen.has('popjack') };
  });
  await waitFor(page, () => /A gift box!/.test(document.getElementById('prompt').textContent), null, 60000);
  const lab = await page.evaluate(() => ({ prompt: document.getElementById('prompt').textContent }));
  t.ok(wildT.wrapped && !wildT.seenBefore && /A gift box! 🎁 · (tap|click or E) to open/.test(lab.prompt), `a wild Surprise creature: "${lab.prompt}"`);
  await page.evaluate(() => window.pokecraft.interact());
  await waitFor(page, () => window.pokecraft.inBattle && /Surprise! The gift was a wild Popjack!/.test(document.getElementById('b-log').textContent), null, 180000);
  const rev = await page.evaluate(() => { const g = window.pokecraft, w = g.creatures.list.find(x => x.data.species === 'popjack'); return { wrapped: w.wrapped, root: w.model.userData.parts.root.visible, seen: g.book.seen.has('popjack') }; });
  t.ok(!rev.wrapped && rev.root && rev.seen, 'opening it starts the battle, the creature shows, and only now is it in the Book');
  await waitFor(page, () => !!document.querySelector('#b-actions button'), null, 180000);
  await page.evaluate(() => document.querySelector('#b-actions button:last-child').click()); // Run
  await waitFor(page, () => !window.pokecraft.inBattle, null, 120000).catch(() => {});
  if (await page.evaluate(() => window.pokecraft.inBattle)) await page.evaluate(() => { window.pokecraft.battle.active = false; });
  await page.evaluate(() => { const g = window.pokecraft; for (const w of [...g.creatures.list]) g.creatures.remove(w); g.inBattle = false; });
  const book = await page.evaluate(async () => {
    const g = window.pokecraft;
    g.book.markSeen('giftle'); g.book.markCaught('giftle');
    g.book.open({ species: 'giftle' });
    await new Promise(r => setTimeout(r, 400));
    const txt = document.getElementById('book-detail')?.textContent || '';
    g.book.close?.();
    return txt;
  });
  t.ok(/Surprise Party/.test(book) && /wrapped in a gift box/.test(book), `the Creature Book page of Giftle says "Surprise Party" and "wrapped in a gift box" (${book.slice(0, 120).replace(/\s+/g, ' ')})`);

  /* ---- the guide and the score chip ---- */
  const guide = await page.evaluate(async () => {
    const g = window.pokecraft, L = window.__live(), A = await import('/src/partyland.js'), out = [];
    const txt = a => (a ? a.text('↑', 5) : null);
    window.__reset(); window.__setBows([]);
    const crew = ['pw:doors:crew1', 'pw:doors:crew2'], had = crew.filter(k => g.beaten.includes(k));
    for (const k of crew) { const j = g.beaten.indexOf(k); if (j >= 0) g.beaten.splice(j, 1); }
    for (const n of g.npcs.list) if (n.kind === 'crew') g.npcs.sendAway(n);
    L.crashed.clear(); L.sync();
    window.__at(56.5, 11, 72.5);
    out.push(txt(A.partyAim(g.world, g.player.pos, g)));
    window.__setBows([1]); L.sync(); // Rosa crashes in
    out.push(txt(A.partyAim(g.world, g.player.pos, g)));
    g.beaten.push('pw:doors:crew1', 'pw:doors:crew2'); L.sync();
    out.push(txt(A.partyAim(g.world, g.player.pos, g)));
    window.__spinTo(1); window.__at(40.5, 11, 72.5);
    out.push(txt(A.partyAim(g.world, g.player.pos, g)));
    window.__reset(); window.__setBows([1, 2, 3, 4]); L.sync();
    out.push(txt(A.partyAim(g.world, g.player.pos, g)));
    g.stars.push('doors'); out.push(txt(A.partyAim(g.world, g.player.pos, g))); g.stars.pop();
    L.chip(); const chip = document.getElementById('score-chip')?.textContent;
    window.__setBows([]); L.sync();
    return { list: out, chip };
  });
  const gl = guide.list;
  t.ok(/Party Spinner/.test(gl[0]) && /Party crasher Ribbon Rosa/.test(gl[1]) && /Party Spinner .*1 \/ 4/.test(gl[2]) && /Jack Catch/.test(gl[3]) && /Jolly Jax on the cake/.test(gl[4]) && /Way back/.test(gl[5] || ''), `the guide: ${gl.slice(0, 6).map(s => (s || '').replace(/[↑↓←→]/g, '').trim().slice(0, 30)).join(' | ')}`);
  t.ok(/Battle Jolly Jax on the cake!/.test(guide.chip), `the chip with four bows: "${guide.chip}"`);

  /* ---- the finale: four bows light the candles, the guests gather, SURPRISE!, Jax bursts out of the cake ---- */
  const fin = await page.evaluate(() => {
    const g = window.pokecraft, L = window.__live();
    window.__reset(); window.__setBows([1, 2, 3]); L.sync(); window.__toasts = [];
    const cells = [[54, 16, 29], [58, 16, 33]];
    const before = { candles: cells.map(c => g.world.get(...c)).join(), jax: g.npcs.list.find(n => n.kind === 'boss').away };
    // win the last game for real: Pop-Up Whack
    window.__spinTo(3);
    const r = window.__playGame('pro', 0.05);
    for (let i = 0; i < 6; i++) g.gymLive.update(0.3);
    const mid = { finale: L.finale ? L.finale.t : null };
    for (let i = 0; i < 80; i++) L.step(0.05);
    const jax = g.npcs.list.find(n => n.kind === 'boss'), guests = g.npcs.list.filter(n => n.kind === 'guest');
    return { r: r.join(), before, mid, candles: cells.map(c => g.world.get(...c)).join(), jax: !jax.away && jax.model.visible && Math.abs(jax.model.position.y - 16) < 0.01, guestsZ: guests.map(n => n.pos.z.toFixed(1)).join(), toasts: window.__toasts.join('|') };
  });
  t.ok(fin.r === '1:won,2:won,3:won' && fin.before.candles === '0,0' && fin.before.jax && fin.mid.finale != null && fin.candles === '243,243' && fin.jax && /SURPRISE!/.test(fin.toasts) && /This party is for YOU/.test(fin.toasts) && fin.guestsZ.split(',').every(z => +z < 40), `the fourth bow: the candles light (${fin.before.candles} -> ${fin.candles}), the guests gather round the cake (z ${fin.guestsZ}), everybody shouts SURPRISE! and Jolly Jax bursts out of the top of the cake`);

  /* ---- Jolly Jax and the helpers ---- */
  const crew = await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), PB = await import('/src/pictureboss.js');
    const def = PB.bossOf('doors');
    const out = { levels: def.team.map(t => t[1]).join(), names: def.team.map(t => t[0]).join(), look: def.crew.map(c => c.look).join(), crewLv: def.crew.map(c => c.team.map(t => t[1]).join('-')).join('/'), title: def.title };
    out.movesOk = def.team.filter(t => t[2]).every(t => JSON.stringify(t[2]) === JSON.stringify(S.movesWith(t[0], t[1], ...(t[0] === 'fiestallama' ? ['candyburst', 'springpunch', 'surpriseparty'] : t[0] === 'jestergrin' ? ['tadaa', 'springpunch', 'surpriseparty', 'peekapop'] : []))));
    out.type = def.type; out.model = JSON.stringify(def.model);
    const save = g.beaten.slice(); window.__setBows([]); out.gate0 = def.gate(g); window.__setBows([1, 2, 3]); out.gate3 = def.gate(g); window.__setBows([1, 2, 3, 4]); out.gate4 = def.gate(g); g.beaten.splice(0, g.beaten.length, ...save);
    return out;
  });
  t.ok(crew.levels === '61,62,62,63' && crew.names === 'bowtower,fiestallama,partypop,jestergrin' && crew.type === 'surprise' && crew.movesOk && crew.model === '{"species":"jestergrin","scale":2.1}' && crew.title === 'Jolly Jax · Surprise Party Boss', `Jolly Jax is a giant Jestergrin with levels ${crew.levels} (${crew.title}); his move lists equal movesWith`);
  t.ok(/Win 4 more golden bows at my party games first! \(🎀 0 \/ 4\)/.test(crew.gate0) && /Win 1 more golden bow/.test(crew.gate3) && crew.gate4 === null && crew.look === 'party,party' && crew.crewLv === '59-60/60-61-61', `his gate: "${crew.gate0}"; Ribbon Rosa and Confetti Kit in party hats (${crew.crewLv})`);
  if (!process.env.SURPRISE_SKIP_BOSS) {
    // the helpers not beaten: Jax says so; beaten: the battle; a win gives the star and uses the four bows up (a rematch is a new party)
    await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js');
      window.__setBows([1, 2, 3, 4]); window.__live().sync();
      for (const k of ['pw:doors:crew1', 'pw:doors:crew2']) { const j = g.beaten.indexOf(k); if (j >= 0) g.beaten.splice(j, 1); }
      window.__toasts = []; g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
      window.__crewGate = !g.inBattle && /Beat Ribbon Rosa and Confetti Kit first/.test(window.__toasts.join('|'));
      g.beaten.push('pw:doors:crew1', 'pw:doors:crew2');
      g.party = [S.makeCreature('blazehound', 100), S.makeCreature('thunderwolf', 100)]; g.cubes = 0;
      window.__cele = null; const cf = g.ui.celebrate.bind(g.ui); g.ui.celebrate = (...a) => { window.__cele = a; cf(...a); };
      g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
    });
    await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 30000);
    const bt = await page.evaluate(() => { const b = window.pokecraft.battle; return { boss: b.boss, foes: b.foes.map(f => f.level).join(), crewGate: window.__crewGate }; });
    t.ok(bt.crewGate, 'with the four bows but his helpers not beaten Jax says to beat Ribbon Rosa and Confetti Kit first');
    t.ok(bt.boss && bt.foes === '61,62,62,63', `the Boss battle has Jax's four creatures at levels ${bt.foes}`);
    t.ok(await playBattle(page), 'the Boss battle is won');
    await waitFor(page, () => window.pokecraft.stars.includes('doors'), null, 180000).catch(() => {});
    await page.waitForTimeout(500);
    const won = await page.evaluate(() => { const g = window.pokecraft; for (let i = 0; i < 4; i++) g.gymLive.update(0.3); return { stars: g.stars.join(), note: window.__cele?.[0], small: window.__cele?.[1], bows: g.beaten.filter(k => /pw:doors:bow/.test(k)).length, crew: g.beaten.filter(k => /pw:doors:crew/.test(k)).length, jax: g.npcs.list.find(n => n.kind === 'boss').away, candles: g.world.get(54, 16, 29) }; });
    t.ok(/Surprise Party star/.test(won.note || '') && /Jax was my favourite toy/.test(won.small || ''), `the star of the Surprise Party and the Wizard's note (${won.note})`);
    t.ok(won.bows === 0 && won.crew === 2 && won.jax && won.candles === 0, `a won battle uses the four bows up (${won.bows} left; Jax back in his cake, the candles out); the helpers stay beaten (${won.crew})`);
    // a rematch party is harder
    const hard = await page.evaluate(() => { const L = window.__live(); window.__reset(); window.__spinTo(2); window.__ready(); const g = window.pokecraft; const set = L.sets.stack; window.__at(set.standAt[0], 11, set.standAt[1], 0, 0); L.use(g.player); const out = { hard: L.hard(), need: L.gm.run.st.plan.need }; window.__reset(); return out; });
    t.ok(hard.hard && hard.need === 6, `with the star the party's games are a bit harder (Gift Stack round 1 needs ${hard.need})`);
    // losing: you stay at the party, rested by the table
    await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js');
      g.inBattle = false; document.body.classList.remove('in-battle');
      g.party = [S.makeCreature('fluffin', 3)];
      window.__setBows([1, 2, 3, 4]); window.__live().sync();
      g.stars = g.stars.filter(s => s !== 'doors'); g.bossWins.doors = 0;
      g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
    });
    await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 30000);
    await playBattle(page);
    await waitFor(page, () => !window.pokecraft.inBattle && !window.pokecraft.realms.busy, null, 60000);
    const lost = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos; return { place: g.place, hp: g.party[0].hp, star: g.stars.includes('doors'), at: [p.x, p.y, p.z] }; });
    t.ok(lost.place === 'doors' && lost.hp > 0 && !lost.star && Math.abs(lost.at[0] - 38.5) < 0.01 && Math.abs(lost.at[2] - 53.5) < 0.01, `losing keeps you at the party, rested by the table (${lost.at.map(v => v.toFixed(1))})`);
    await page.evaluate(() => { const g = window.pokecraft; g.inBattle = false; });
  }

  /* ---- a reload: the bows, the crew and the mark are kept ---- */
  const before = await page.evaluate(() => { const g = window.pokecraft; window.__reset(); window.__setBows([1, 3]); g.save(true); return g.beaten.filter(k => /pw:doors/.test(k)).sort().join(); });
  await page.reload();
  await page.waitForFunction(() => window.pokecraft && window.pokecraft.world);
  await continueGame(page);
  const reloaded = await page.evaluate(() => { const g = window.pokecraft; return { keys: g.beaten.filter(k => /pw:doors/.test(k)).sort().join(), place: g.place }; });
  t.ok(reloaded.keys === before && reloaded.place === 'doors', `after a reload you are at the party and the bows are still there (${reloaded.keys})`);
  if (reloaded.place !== 'doors') await intoParty(page); else await helpers(page);
  await toasts(page);
  const face = await page.evaluate(() => { const L = window.__live(); for (let i = 0; i < 3; i++) window.pokecraft.gymLive.update(0.3); return L.faceKey; });
  t.ok(face === 'true,false,true,false', `the Spinner's face shows a bow on the won games (${face})`);

  /* ---- screenshots ---- */
  await page.evaluate(() => { const g = window.pokecraft, L = window.__live(); window.__reset(); window.__setBows([1, 3]); L.sync(); L.manual = false; for (const w of [...g.creatures.list]) g.creatures.remove(w); });
  await shot(page, 'party', [56.5, 11, 74.2, 0, 0.12]);
  await page.evaluate(() => { const L = window.__live(); L.manual = true; window.__toPad(); L.use(window.pokecraft.player); for (let i = 0; i < 9; i++) L.step(0.05); window.__at(65.5, 11.6, 53.5, -Math.PI / 2, 0.36); L.draw(); });
  await shot(page, 'spinner', null, 1200);
  // the Piñata Party: the llama swinging at you, the stick in your hand
  await page.evaluate(() => {
    const L = window.__live(), g = window.pokecraft;
    window.__reset(); window.__setBows([]); window.__spinTo(0); window.__ready();
    const set = L.sets.pinata; window.__at(set.standAt[0], 11, set.standAt[1], 0, 0); L.use(g.player);
    const run = L.gm.run.runs[0];
    let tt = 0.6; for (; tt < 8; tt += 0.05) { const q = window.__pinAt(run, tt); if (q.y < 13.15 && Math.hypot(q.vx, q.vz) > 2) break; }
    while (L.gm.run.t < tt) L.step(0.05);
    const q = window.__pinAt(run, L.gm.run.t), v = Math.hypot(q.vx, q.vz);
    window.__at(q.x + (q.vx / v) * 2.6, 11, q.z + (q.vz / v) * 2.6, 0, 0.05);
    g.player.lookAt({ x: q.x, y: q.y + 0.2, z: q.z });
    L.gm.run.swingT = 0.09; L.draw();
  });
  await shot(page, 'pinata', null, 800);
  // Jack Catch: jacks in the air with their shadows, a pie and its pink ring
  await page.evaluate(() => {
    const L = window.__live(), g = window.pokecraft;
    window.__reset(); window.__setBows([]); window.__spinTo(1); window.__ready();
    const set = L.sets.catch; window.__at(set.standAt[0], 11, set.standAt[1], 0, 0.15); L.use(g.player);
    const run = L.gm.run.run, pie = run.plan.launches.find(l => l.kind === 'pie' && l.t0 > 4) || run.plan.launches.find(l => l.kind === 'pie');
    const until = pie ? pie.t0 + pie.flight * 0.45 : 6;
    while (L.gm.run.t < until && L.gm.phase === 'run') L.step(0.05);
    window.__at(set.standAt[0], 11, set.standAt[1] + 1.5, 0, 0.25); L.draw();
  });
  await shot(page, 'catch', null, 800);
  // Gift Stack: a few presents stacked, one on the hook
  await page.evaluate(() => {
    const L = window.__live(), g = window.pokecraft;
    window.__reset(); window.__setBows([]); window.__spinTo(2); window.__ready(); L.gm.round = 3;
    const set = L.sets.stack; window.__at(set.standAt[0], 11, set.standAt[1] + 1, 0, 0.45); L.use(g.player);
    const Bt = window.__bots, mind = Bt.stackMind('kid');
    for (let i = 0; i < 2000 && L.gm.run.st.placed < 5; i++) { L.step(1 / 30); if (mind(L.gm.run.st, L.gm.run.t, 1 / 30)) L.use(g.player); }
    for (let i = 0; i < 20; i++) L.step(1 / 30);
    g.player.lookAt({ x: 56.5, y: 16.5, z: 52.5 }); L.draw();
  });
  await shot(page, 'stack', null, 800);
  // Pop-Up Whack: jacks up, one with a pie, a lid jiggling
  await page.evaluate(() => {
    const L = window.__live(), g = window.pokecraft;
    window.__reset(); window.__setBows([]); window.__spinTo(3); window.__ready(); L.gm.round = 2;
    const set = L.sets.whack; window.__at(set.standAt[0], 11, set.standAt[1] + 1, 0, 0.1); L.use(g.player);
    const st = L.gm.run.st, pie = st.plan.pops.find(p => p.kind === 'pie' && p.t0 > 2);
    while (L.gm.run.t < pie.t0 + 0.3) L.step(0.05);
    g.player.lookAt({ x: 56.5, y: 12.2, z: 53 }); L.draw();
  });
  await shot(page, 'whack', null, 800);
  // the finale: candles lit, Jolly Jax on the cake, the guests round it
  await page.evaluate(() => { const L = window.__live(); window.__reset(); window.__setBows([1, 2, 3, 4]); L.sync(); for (let i = 0; i < 80; i++) L.step(0.05); L.chip(); window.__at(56.5, 11, 45.5, 0, 0.32); });
  await shot(page, 'finale', null, 2500);
  // a wild gift box, then the family
  await page.evaluate(() => { const g = window.pokecraft; window.__setBows([]); window.__live().sync(); for (const w of [...g.creatures.list]) g.creatures.remove(w); g.creatures.spawnAt('popjack', 58, 11, 62, { level: 40, when: 'gift' }); g.creatures.spawnAt('giftle', 55, 11, 62, { level: 40, when: 'gift' }); window.__at(56.5, 11, 66.5, 0, 0.05); g.creatures.viewer = g.player.pos; });
  await shot(page, 'giftbox', null, 1500);
  await page.evaluate(async () => {
    const g = window.pokecraft, ids = ['giftle', 'bowtower', 'popjack', 'jestergrin', 'pinpop', 'fiestallama', 'partypop'];
    for (const w of [...g.creatures.list]) g.creatures.remove(w);
    ids.forEach((id, i) => { const w = g.creatures.spawnAt(id, 47 + i * 2.2, 11, 60, { level: 40, when: 'gift' }); w.heading = 0; w.unwrap(); w.life = 1e9; });
    g.creatures.updateGifts(5);
    window.__at(56.5, 11, 71.5, 0, 0.08);
    g.creatures.viewer = new (g.player.pos.constructor)(80, 11, 80);
  });
  await shot(page, 'family', null, 1200);
  await page.evaluate(() => { const g = window.pokecraft; for (const w of [...g.creatures.list]) g.creatures.remove(w); window.__reset(); });
}

/* ============================================================================================ */
/* E. iPad                                                                                       */
/* ============================================================================================ */

async function ipadPart({ browser, base, t }) {
  const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await newGame(ip, 0);
  const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  await intoParty(ip);
  const real = () => ip.evaluate(() => { window.__live().playing = () => document.getElementById('pause').classList.contains('hidden'); });
  // the word on the big button at a spot (the real rule: the live part runs only while the game is not paused)
  const word = async want => { let text = ''; for (let i = 0; i < 80; i++) { await ip.waitForTimeout(150); text = await ip.evaluate(() => document.getElementById('btn-act')?.textContent || ''); if (text === want) break; } return text; };
  const tapButton = async () => { const b = await ip.evaluate(() => { const r = document.getElementById('btn-act').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await ip.touchscreen.tap(b.x, b.y); };
  const w = {};
  await ip.evaluate(() => { const g = window.pokecraft; for (const c of [...g.creatures.list]) g.creatures.remove(c); window.__toPad(); });
  await real();
  w.spin = await word('Spin!');
  await tapButton();
  await waitFor(ip, () => window.__live().sp.phase === 'spin', null, 20000);
  w.stop = await word('Stop!');
  await tapButton();
  await waitFor(ip, () => window.__live().sp.phase !== 'spin', null, 20000);
  // a game: Play! on its pad, then Drop! (Gift Stack) and Whack! (Pop-Up Whack)
  await ip.evaluate(() => { const L = window.__live(); L.playing = () => true; window.__reset(); window.__spinTo(2); window.__ready(); const s = L.sets.stack; window.__at(s.standAt[0], 11, s.standAt[1], 0, 0.3); });
  await real();
  w.play = await word('Play!');
  await tapButton();
  await waitFor(ip, () => window.__live().gm?.phase === 'run', null, 20000);
  w.drop = await word('Drop!');
  const placed0 = await ip.evaluate(() => window.__live().gm.run.st.drops.length);
  await tapButton();
  await waitFor(ip, n => window.__live().gm?.run?.st.drops.length > n, placed0, 20000).catch(() => {});
  w.dropped = await ip.evaluate(n => window.__live().gm?.run?.st.drops.length > n, placed0);
  await ip.evaluate(() => { const L = window.__live(); L.playing = () => true; window.__reset(); window.__spinTo(3); window.__ready(); const s = L.sets.whack; window.__at(s.standAt[0], 11, s.standAt[1], 0, 0.1); L.manual = true; L.use(window.pokecraft.player); L.manual = true; });
  await real();
  w.whack = await word('Whack!');
  t.ok(w.spin === 'Spin!' && w.stop === 'Stop!' && w.play === 'Play!' && w.drop === 'Drop!' && w.dropped && w.whack === 'Whack!', `the one big button says "${w.spin}" and "${w.stop}" at the Spinner (a tap spins and stops it), "${w.play}" on a game's pad, "${w.drop}" in Gift Stack (a tap drops) and "${w.whack}" in Pop-Up Whack`);
  t.ok((await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length)) === before, `the number of touch buttons did not change (${before})`);
  // a tap on a jack on the screen whacks it (gymLive.tap); the clock is held (manual)
  const at = await ip.evaluate(() => {
    const g = window.pokecraft, L = window.__live(), st = L.gm.run.st, p = st.plan.pops.find(q => q.kind !== 'pie' && q.t0 > 1.5);
    while (L.gm.run.t < p.t0 + 0.3) L.step(0.02);
    L.gm.run.st.ready = 0;
    const PW = window.__headOf(L.sets.whack.boxes, p);
    g.player.lookAt({ x: 56.5, y: 12, z: 53 });
    g.camera.updateMatrixWorld();
    window.__score0 = st.score; window.__hits0 = st.hits.size;
    return { head: PW, kind: p.kind };
  });
  await ip.waitForTimeout(1200);
  const scr = await ip.evaluate(h => { const g = window.pokecraft; g.camera.updateMatrixWorld(); const v = new (g.camera.position.constructor)(h.x, h.y - 0.1, h.z).project(g.camera); return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight }; }, at.head);
  let hit = false;
  for (let k = 0; k < 3 && !hit; k++) { await ip.touchscreen.tap(scr.x, scr.y); await ip.waitForTimeout(600); hit = await ip.evaluate(() => window.__live().gm.run.st.hits.size > window.__hits0); }
  t.ok(hit, `a tap on a jack on the screen whacks it (${at.kind})`);
  await ip.screenshot({ path: path.join(SHOTS, 't48-ipad.png'), timeout: 180000 });
  console.log('  screenshot t48-ipad.png');
  await ip.evaluate(() => window.__reset());
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
  await intoParty(A);
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 120000).catch(() => {});
  const ask = await Bp.evaluate(() => (window.pokecraft.ui.asking ? document.getElementById('ask-text').textContent : ''));
  t.ok(/Dad .*(Swirl|Surprise Party)/.test(ask), `Kid is asked to follow ("${ask}")`);
  if (await Bp.evaluate(() => window.pokecraft.ui.asking)) await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await waitFor(Bp, () => !window.pokecraft.realms.busy && window.pokecraft.place !== 'main', null, 60000).catch(() => {});
  if ((await Bp.evaluate(() => window.pokecraft.place)) !== 'doors') { await Bp.evaluate(() => window.pokecraft.realms.follow()); await placeIs(Bp, 'doors'); }
  await helpers(Bp);
  t.ok((await Bp.evaluate(() => window.pokecraft.place)) === 'doors', 'Kid followed Dad to the party');
  const seeds = await Promise.all([A, Bp].map(p => p.evaluate(() => window.__live().seed)));
  t.ok(seeds[0] !== seeds[1], 'each player has their own game seed (their own Spinner wobble, piñatas, jacks, presents)');
  // Dad spins and plays: Kid's party floor stays empty
  const dad = await A.evaluate(() => { const L = window.__live(); L.manual = true; window.__spinTo(3); window.__ready(); const s = L.sets.whack; return s.up.map(([x, y, z]) => window.pokecraft.world.get(x, y, z)).every(id => id === 240); });
  const kid = await Bp.evaluate(() => { const L = window.__live(), s = L.sets.whack; return { up: s.up.map(([x, y, z]) => window.pokecraft.world.get(x, y, z)).every(id => id === 0), gm: !!L.gm }; });
  t.ok(dad && kid.up && !kid.gm, 'a game Dad spun builds its set on his party floor only; Kid sees none and can spin his own');
  const bow = await A.evaluate(() => { const g = window.pokecraft, L = window.__live(); window.__playGame('pro', 0.05); return g.beaten.filter(k => /pw:doors:bow/.test(k)).length; });
  const kidBows = await Bp.evaluate(() => window.pokecraft.beaten.filter(k => /pw:doors:bow/.test(k)).length);
  t.ok(bow === 1 && kidBows === 0, `Dad's bow is Dad's (${bow}); Kid has none (${kidBows})`);
}
