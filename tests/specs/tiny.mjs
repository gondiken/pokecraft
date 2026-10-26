// T40a (wave 14): the Tiny type and the Giant House. Part A (type data, models, fx), B (the terrain for three seeds: walk graph, secrets, paths,
// keeps), C (live: the whole loop in a browser: fan, train, river and cap, cat, crumbs, nooks, the Boss, the secret ways, iPad, the line-up).
// TINY_ONLY=type|land|live|shots runs one part. T40a.5: the live part plays the four puzzles (towel + key, plug + tap, yarn + cat,
// marble + spoon) with real physics. Screenshots: t40a-house-arrival.png, t40a-train.png, t40a-fan.png, t40a-river.png, t40a-cat.png, t40a-spoon.png,
// t40a-cookie-boss.png, t40a-ipad.png, t40a-tiny-family.png (+ t40a-nooks.png).
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, newGame, pause, continueGame, waitFor as waitFor0, seedSave, playBattle } from '../helpers.mjs';
const waitFor = (page, fn, arg, ms = 90000) => waitFor0(page, fn, arg, ms); // the software renderer is slow when other browsers are open
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const only = process.env.TINY_ONLY;
const want = part => !only || only === part || (only === 'shots' && part === 'live');
const IDS = ['antsy', 'antlas', 'thimbit', 'spoolmouse', 'dustbun', 'fluffnado', 'pipsqueak'];

const toasts = page => page.evaluate(() => { window.__toasts = []; const g = window.pokecraft, f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; });
const said = (page, re) => page.evaluate(src => window.__toasts.some(m => new RegExp(src).test(m)), re.source);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id);
// the Swirl, then the house frame (the real way in)
async function intoHouse(page) {
  await page.evaluate(async () => { const { pictureWorld } = await import('/src/pictureworlds.js'); pictureWorld('house').ready = true; }); // covered while T40a.5 rebuilds it
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  await waitFor(page, () => { const f = window.pokecraft.world.swirl.frames.find(f => f.world === 'house'); return window.pokecraft.world.get(...f.cloth[0]) === 144; }, null, 30000);
  await page.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'house'), c = f.cloth[0]; g.portal.use({ x: c[0], y: c[1], z: c[2], id: 144 }); });
  await placeIs(page, 'house');
  await helpers(page);
}
// in-page helpers: step the player and the live part by hand (the frame loop does not move the player while the page has no pointer lock)
const helpers = page => page.evaluate(() => {
  const g = window.pokecraft;
  window.__step = (n, dt = 0.05, each) => { for (let i = 0; i < n; i++) { g.player.update(dt); g.gymLive.update(dt); each?.(i); } };
  window.__walk = (pts, max = 1500) => {
    const p = g.player; let i = 0, steps = 0;
    while (i < pts.length && steps < max) {
      const [x, z] = pts[i], dx = x - p.pos.x, dz = z - p.pos.z;
      if (Math.hypot(dx, dz) < 0.45) { i++; continue; }
      p.yaw = Math.atan2(-dx, -dz);
      p.keys.KeyW = true; p.keys.Space = p.hitWall; // jump when a step is in the way
      p.update(0.05); g.gymLive.update(0.05); steps++;
    }
    p.keys.KeyW = false; p.keys.Space = false;
    return { i, steps, x: p.pos.x, y: p.pos.y, z: p.pos.z };
  };
  window.__at = (x, y, z, yaw = 0, pitch = 0) => { const p = g.player; p.carry?.leave?.(false); p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.keys = {}; };
  window.__live = () => g.gymLive.of('part:house');
  window.__blk = (x, y, z) => ({ x, y, z, id: g.world.get(x, y, z) });
});
async function shot(page, name, spot, wait = 2500) {
  if (spot) await page.evaluate(([x, y, z, yaw, pitch]) => window.__at(x, y, z, yaw, pitch), spot);
  await page.evaluate(() => document.getElementById('pause')?.classList.add('hidden'));
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(SHOTS, `t40a-${name}.png`) });
}

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);

  /* ======================================== A. the type ======================================== */
  if (want('type')) {
    const a = await page.evaluate(async ids => {
      const S = await import('/src/species.js'), SH = await import('/src/shapes.js'), FX = await import('/src/fxrecipes.js'), R = await import('/src/realms.js');
      const SR = await import('/src/spawnrules.js'), THREE = await import('three');
      const src = await (await fetch('/src/sound.js')).text();
      const out = { problems: [] };
      const bad = m => out.problems.push(m);
      const tiny = Object.entries(S.SPECIES).filter(([, s]) => s.type === 'tiny').map(([id]) => id);
      out.tiny = tiny.sort().join();
      const fam = { antsy: ['antlas', 22], thimbit: ['spoolmouse', 22], dustbun: ['fluffnado', 24] };
      for (const [id, [into, lv]] of Object.entries(fam)) { const e = S.SPECIES[id].evolve; if (!e || e.into !== into || e.level !== lv) bad(`${id} evolves into ${into} at ${lv}`); }
      if (S.SPECIES.pipsqueak.evolve) bad('pipsqueak is single-stage');
      const shapes = ['ant', 'thimblemouse', 'dustbunny', 'seedling'];
      for (const sh of shapes) {
        if (typeof SH.SHAPES[sh] !== 'function') bad(`no shape ${sh}`);
        const users = Object.values(S.SPECIES).filter(s => s.model.shape === sh);
        if (users.some(s => s.type !== 'tiny')) bad(`shape ${sh} is used by another type`);
      }
      out.shapesUsed = new Set(tiny.map(id => S.SPECIES[id].model.shape)).size;
      for (const id of ids) { const s = S.SPECIES[id]; if (!s || s.type !== 'tiny') { bad(`${id} is not tiny`); continue; } if (!s.desc || s.desc.length > 110) bad(`${id} desc ${s.desc?.length}`); if (s.gait !== 'peek') bad(`${id} gait`); }
      const M = S.MOVES;
      const m = (id, power, acc) => { if (!M[id] || M[id].type !== 'tiny' || M[id].power !== power || Math.abs(M[id].acc - acc) > 1e-9) bad(`move ${id} ${JSON.stringify(M[id])}`); };
      m('teenytap', 40, 1); m('mightymite', 75, 0.9); m('tinysteps', 20, 1); m('tuckaway', 0, 1); m('sugarlift', 90, 0.95); m('fluffstorm', 22, 1);
      if (M.tinysteps.fx.kind !== 'multi' || M.tinysteps.fx.max !== 5 || M.tuckaway.fx.kind !== 'raise' || M.sugarlift.fx.kind !== 'flinch' || !M.sugarlift.sig || !M.fluffstorm.sig || !M.fluffstorm.sure) bad('move effects');
      for (const id of ['antsy', 'thimbit', 'dustbun', 'pipsqueak']) { const lm = S.SPECIES[id].learn.map(e => e[1]); for (const need of ['teenytap', 'mightymite', 'tinysteps', 'tuckaway']) if (!lm.includes(need)) bad(`${id} does not learn ${need}`); }
      const bigs = ['cuphide', 'antarmy', 'smallworld'];
      out.big = bigs.map(id => [id, S.isBig(id), S.MOVES[id]?.fx?.kind]).join(';');
      for (const id of IDS_FOR(ids)) { const lm = S.SPECIES[id].learn; for (const [lv, mv] of lm) if (bigs.includes(mv) && lv !== S.BIG_LEVEL[S.MOVES[mv].fx.kind]) bad(`${id} learns ${mv} at ${lv}`); if (!bigs.every(b => lm.some(e => e[1] === b))) bad(`${id} lacks big moves`); }
      for (const id of [...Object.keys(M)].filter(k => M[k].type === 'tiny')) if (new RegExp(`['"]${id}['"]\\s*:|\\b${id}:`).test(src) && !/fx:tiny/.test(id)) bad(`move id ${id} is a sound name`);
      for (const id of ['teenytap', 'mightymite', 'tinysteps', 'tuckaway', 'sugarlift', 'fluffstorm', 'cuphide', 'antarmy', 'smallworld']) if (new RegExp(`\\n\\s*${id}:`).test(src)) bad(`${id} is named like a sound`);
      // fx and sound: its own entries
      if (FX.TRAVEL.tiny === FX.TRAVEL.normal || FX.IMPACT.tiny === FX.IMPACT.normal || FX.FX_COLORS.tiny === FX.FX_COLORS.normal) bad('fx falls back to normal');
      if (!FX.SIG.sugarlift || !FX.SIG.fluffstorm) bad('no signature fx');
      if (!/'fx:tiny': \(\) =>/.test(src)) bad('no own fx:tiny sound');
      for (const id of ['choochoo', 'mrrow', 'gurgle']) if (!new RegExp(`\\n\\s*${id}: \\(\\)`).test(src)) bad(`sound ${id}`);
      // models: build, fit, animate
      const sig = g => { let sum = 0; g.updateMatrixWorld(true); g.traverse(o => { if (o.isMesh) { for (const v of o.matrixWorld.elements) sum += v; } }); return sum; };
      out.sizes = {};
      for (const id of ids) {
        const mdl = S.buildModel(id); S.animateModel(mdl, 0);
        const box = new THREE.Box3().setFromObject(mdl), size = box.getSize(new THREE.Vector3());
        out.sizes[id] = [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)].join('x');
        if (size.y < 0.35 || size.y > 1.4) bad(`${id} height ${size.y.toFixed(2)} (Tiny is small)`);
        if (size.x > 2.6 || size.z > 2.6) bad(`${id} width ${size.x.toFixed(2)}`);
        if (box.min.y < -0.1) bad(`${id} under the ground ${box.min.y.toFixed(2)}`);
        S.animateModel(mdl, 0.3, false); const a1 = sig(mdl); S.animateModel(mdl, 1.1, false); const a2 = sig(mdl);
        if (Math.abs(a1 - a2) < 1e-6) bad(`${id} does not animate`);
        let eyes = 0; mdl.traverse(o => { if (o.userData.eye) eyes++; });
        if (eyes < 4) bad(`${id} has no big shiny eyes (${eyes} eye parts)`);
        S.disposeModel(mdl);
      }
      // spawns: only the house's own table, only on the nook condition
      const inMain = Object.values(S.SPAWNS).flat().filter(e => ids.includes(e[0])).length;
      const house = R.REALMS.house.spawns;
      if (inMain) bad('Tiny creatures are in the main SPAWNS');
      if (!house.house?.length || !house.house.every(e => e[2] === (e[0] === 'pipsqueak' ? 'crumbs' : 'nook') && ids.includes(e[0])) || house.house.length !== 7) bad('house spawns'); // T40a.5: Pipsqueak after all 12 crumbs
      if (!SR.CONDITIONS.crumbs?.place || SR.CONDITIONS.crumbs.share || !/crumbs/.test(SR.CONDITIONS.crumbs.text)) bad('crumbs condition');
      if (!SR.CONDITIONS.nook || SR.CONDITIONS.nook.share || !SR.CONDITIONS.nook.place || !SR.CONDITIONS.nook.text) bad('nook condition');
      out.chart = ['racer', 'food', 'cyber', 'tiny', 'fire', 'sky'].map(b => S.effectiveness('tiny', b)).join() + '|' + [S.effectiveness('fire', 'tiny'), S.effectiveness('sky', 'tiny'), S.effectiveness('ball', 'tiny')].join();
      return out;
      function IDS_FOR(list) { return list; }
    }, IDS);
    t.ok(a.tiny === [...IDS].sort().join(), `7 Tiny creatures (${a.tiny})`);
    t.ok(a.shapesUsed === 4, `4 body shapes, none used by another type (${a.shapesUsed})`);
    t.ok(!a.problems.length, `Tiny data: families, moves, big moves, fx, sound, models with big eyes, spawns ${a.problems.join('; ')}`);
    t.ok(a.chart === '2,2,2,0.5,0.5,0.5|2,2,2', `the chart cells of the base are unchanged (${a.chart})`);
    t.ok(a.big === 'cuphide,true,shield;antarmy,true,rally;smallworld,true,field', `the three big moves are shield / rally / field (${a.big})`);
    console.log('  sizes', JSON.stringify(a.sizes));
  }

  /* ======================================== B. the terrain ======================================== */
  if (want('land')) {
    for (const seed of [1, 4242, 294331207]) {
      const r = await page.evaluate(async seed => {
        const H = await import('/tests/housecheck.mjs'), G = await import('/src/giantland.js'), R = await import('/src/realms.js'), Bk = await import('/src/blocks.js');
        const { World } = await import('/src/world.js'), M = await import('/src/mover.js');
        const a = H.analyze(seed);
        // the real World class (null scene), like the dream spec: the same blocks as the stand-in, quick enough
        const def = R.REALMS.house;
        let ms = Infinity, w;
        for (let k = 0; k < 2; k++) { const t0 = performance.now(); w = new World(R.realmSeed(seed, def.seedSalt), null, null, def.size, def); w.generate(); ms = Math.min(ms, performance.now() - t0); } // the faster of two runs: other browsers load the machine
        let top = 0, ids150 = new Set();
        for (let i = 0; i < w.data.length; i++) { const id = w.data[i]; if (id >= 150 && id <= 167) ids150.add(id); }
        for (let y = 47; y >= 0; y--) { let any = false; for (let x = 0; x < w.W && !any; x += 3) for (let z = 0; z < w.D; z += 3) if (w.get(x, y, z) !== 0) { any = true; break; } if (any) { top = y; break; } }
        const tiles = ['FLOOR_TILE', 'FLOOR_TILE_DARK', 'WALLPAPER', 'COUNTER_TOP', 'CUPBOARD_SIDE', 'TABLE_WOOD', 'COOKIE_TOP', 'COOKIE_SIDE', 'CRUMB', 'FAN_GRILL', 'CHROME', 'FAN_SWITCH', 'FAN_SWITCH_ON', 'TRACK_TOP', 'REMOTE_BUTTON', 'TAP_HANDLE', 'CAT_FUR', 'CAT_EYE', 'CAT_EYE_OPEN', 'KEYHOLE'].map(n => Bk.T[n]);
        const consecutive = tiles.every((v, i) => i === 0 || v === tiles[i - 1] + 1);
        // the paths: the whole track line and both cap lines, every 0.25 blocks
        const solid = (x, y, z) => w.isSolid(x, y, z);
        const clear = ([x, feet, z]) => {
          for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) for (let yy = Math.floor(feet + 1e-6); yy <= Math.floor(feet + 1.8); yy++) if (solid(Math.floor(x + dx), yy, Math.floor(z + dz))) return false;
          return true;
        };
        const sample = pts => { const line = M.PATHS.line({ points: pts, speed: 1 }); let n = 0, badAt = null; for (let s = 0; s <= line.time; s += 0.25) { const p = line.at(s); n++; if (!clear([p.x, p.y, p.z])) { badAt ??= [p.x, p.y, p.z].map(v => +v.toFixed(2)).join(','); } } return { n, badAt }; };
        const track = sample(G.TRACK.points), east = sample(G.CAP_LINES.east), west = sample(G.CAP_LINES.west), ride = sample(G.trackInfo().toN);
        const fling = (() => { const ss = G.SEESAW, a = M.PATHS.arc({ from: [ss.bowl[0], 26, ss.bowl[2]], to: ss.land, height: 7, time: 1.6 }); let n = 0, badAt = null; for (let q = 0; q <= a.time + 1e-9; q += 0.02) { const p = a.at(q); n++; if (!clear([p.x, p.y, p.z])) badAt ??= [p.x, p.y, p.z].map(v => +v.toFixed(2)).join(','); } return { n, badAt }; })(); // T40a.5: the spoon's flight over the fort wall
        // the dry groove and the cap: the groove floor is below the cap's feet; the counter top ends the east line
        const info = G.trackInfo();
        return {
          problems: a.out.problems, info: a.out.info, ms, msStandIn: a.out.info.ms, top, ids150: [...ids150].sort((x, y) => x - y).join(), consecutive, tileNames: tiles.length,
          track, east, west, ride, fling, stops: [info.sOf.S.toFixed(1), info.sOf.N.toFixed(1), info.total.toFixed(1)].join(),
          ride9: (info.sOf.N - info.sOf.S) / 9, nooks: w.nooks.length, parts: w.parts.map(p => p.id).join(), lifts: w.lifts.length, bosses: w.bosses.length, walk: w.walk instanceof Set,
          sameAsStandIn: (() => { const s = H.makeHouse(R.realmSeed(seed, def.seedSalt)); for (let i = 0; i < w.data.length; i++) if (w.data[i] !== s.data[i]) return false; return true; })(),
        };
      }, seed);
      t.ok(!r.problems.length, `seed ${seed}: the house is deterministic, standable, reachable by all ways, nobody stuck, secrets, cat strip, keeps, nooks ${r.problems.join(' | ')}`);
      t.ok(r.info.all4 && !r.info.noFan && !r.info.noCap && !r.info.noCat && !r.info.noFling && r.info.mouseNoFan && r.info.mouseHole && r.info.keyhole && r.info.dryStuckEast && r.info.dryBack && r.info.stuck === 0, `seed ${seed}: the Boss with the four puzzles and not without any one of them (fan, water, cat, spoon); the mouse hole skips the fan; the keyhole leads up; the dry river is a dead end with steps back (${r.info.cells} cells)`);
      t.ok(r.ms < 400 && r.top <= 47 && r.ids150 === '150,151,152,153,154,155,156,157,160,161,162,166,167' && r.consecutive, `seed ${seed}: generated in ${r.ms.toFixed(0)} ms (the faster of two runs), nothing above y 47 (top ${r.top}), the blocks 150-167 the puzzle house still uses (T40a.5: no fan switch, no block cat; ${r.ids150.split(',').length} of 18), the 20 tiles in a row (${r.consecutive})`);
      t.ok(!r.track.badAt && !r.east.badAt && !r.west.badAt && !r.ride.badAt && !r.fling.badAt, `seed ${seed}: the train line, the ride, both cap lines and the spoon's flight have 2 cells of air and nothing solid in the way (${r.track.n + r.east.n + r.west.n + r.fling.n} samples) ${r.track.badAt || r.east.badAt || r.west.badAt || r.ride.badAt || r.fling.badAt || ''}`);
      t.ok(r.nooks === 22 && r.parts === 'house' && r.lifts === 0 && r.bosses === 1 && r.walk && r.sameAsStandIn, `seed ${seed}: 22 nooks, the house part, no lifts yet, one Boss; the real World gives the same blocks as the stand-in`);
      if (seed === 1) console.log('  ride', r.stops, `${r.ride9.toFixed(1)} s`, 'standIn', r.msStandIn, 'ms');
    }
    const small = await page.evaluate(async () => { const Bk = await import('/src/blocks.js'); return { n: Bk.TILE_COUNT, free: Math.max(...Object.values(Bk.B)) + 1 }; });
    t.ok(small.n <= 256 && small.free >= 168, `the atlas has ${small.n} tiles (of 256)`);
  }

  /* ======================================== C. live ======================================== */
  if (want('live')) {
    await newGame(page, 0); await pause(page);
    await toasts(page);
    await intoHouse(page);
    const enter = await page.evaluate(() => {
      const g = window.pokecraft, w = g.world, p = g.player.pos, a = w.arrivals.house;
      g.updateGuide();
      return { place: g.place, stand: [p.x, p.y, p.z].map(v => +v.toFixed(1)).join(), want: a.slice(0, 3).map(v => +v.toFixed(1)).join(), glow: !!g.portal.glow(), part: !!g.gymLive.of('part:house'), guide: document.getElementById('guide')?.textContent || '', size: [w.W, w.D].join('x'), bosses: g.npcs.list.filter(n => n.kind === 'boss').map(n => n.name).join() };
    });
    t.ok(enter.place === 'house' && enter.stand === enter.want && enter.glow && enter.part && enter.size === '192x192' && enter.bosses === 'Nibbles', `the frame leads into the 192 x 192 house, to the arrival (${enter.stand}), with the live part and Nibbles`);
    t.ok(await said(page, /HUGE/) && await said(page, /sugar fort/), 'the toasts say you are small and Nibbles is in a sugar fort');
    t.ok(/Toy train!/.test(enter.guide), `the guide points at the toy train (${enter.guide})`);
    await shot(page, 'house-arrival', [24.5, 1, 181.5, -1.2, 0.05]);

    // ---- the toy train: from the arrival to the fan (T40a.5)
    const train = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), btnS = window.__blk(40, 1, 178);
      window.__at(40.5, 1, 176.5, 0, 0);
      const act0 = g.gymLive.action(btnS), pr0 = g.gymLive.prompt(btnS, 'click or E');
      const far = (() => { window.__at(60.5, 1, 183.5, 0, 0); g.gymLive.hit(btnS); return !g.player.carry; })();
      window.__at(40.5, 1, 176.5, 0, 0);
      g.gymLive.hit(btnS);
      const carried = !!g.player.carry;
      let collided = 0, s = 0, guideMid = '';
      for (let i = 0; i < 800; i++) {
        if (g.player.carry && g.player.collides(g.player.pos)) collided++;
        g.player.update(0.05); g.gymLive.update(0.05); s++;
        if (i === 100) { g.updateGuide(); guideMid = document.getElementById('guide')?.textContent || ''; }
        if (!g.player.carry) break;
      }
      const p = g.player.pos, stop = [26.5, 1.5, 64.5];
      g.updateGuide();
      return { act0, pr0, far, carried, collided, steps: s, dist: Math.hypot(p.x - stop[0], p.z - stop[2]), at: live.train.at, guideMid, guideEnd: document.getElementById('guide')?.textContent || '' };
    });
    t.ok(train.act0 === 'Ride!' && /Toy train remote · .* to ride/.test(train.pr0) && train.far && train.carried, `remote S says "${train.act0}"; far away the button asks you to stand by the train; pressing it near boards you`);
    t.ok(train.collided === 0 && train.dist < 0.6 && train.at === 'N' && train.steps * 0.05 > 10 && train.steps * 0.05 < 18, `the ride takes ${(train.steps * 0.05).toFixed(1)} s to the stop by the fan (${train.dist.toFixed(2)} from it), never inside a block`);
    t.ok(/Off to the fan/.test(train.guideMid) && /towel/.test(train.guideEnd), `the guide on the ride: "${train.guideMid}", at the stop: "${train.guideEnd}"`);
    const back = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), btnN = window.__blk(29, 1, 64);
      window.__at(26.5, 1, 65.5, 0, 0);
      const a1 = g.gymLive.action(btnN);
      g.gymLive.hit(btnN);
      const riding = !!g.player.carry;
      g.player.keys.Space = false; window.__step(20); g.player.keys.Space = true; window.__step(2); g.player.keys.Space = false; // a fresh jump: off mid-ride
      const off = g.player.carry === null, runKind = live.train.run?.kind;
      window.__step(400);
      const atAfter = live.train.at;
      window.__at(26.5, 1, 65.5, 0, 0);
      const a2 = g.gymLive.action(btnN);
      g.gymLive.hit(btnN);
      const calling = live.train.run?.kind, busy = g.gymLive.action(btnN);
      window.__step(400);
      return { a1, riding, off, runKind, atAfter, a2, calling, busy, now: live.train.at, a3: g.gymLive.action(btnN) };
    });
    t.ok(back.a1 === 'Ride!' && back.riding && back.off && back.runKind === 'call', `remote N says "${back.a1}", rides back, a fresh jump press gets you off mid-ride and the empty train goes on`);
    t.ok(back.atAfter === 'S' && back.a2 === 'Call train!' && back.calling === 'call' && back.busy === 'Wait...' && back.now === 'N' && back.a3 === 'Ride!', `the train came home by itself (${back.atAfter}); remote N says "${back.a2}", then "${back.busy}", then "${back.a3}"`);
    await shot(page, 'train', [30.5, 1, 72.5, 0.3, 0.05], 1800);

    // ---- puzzle 1: the tea towel and the wind-up key
    const fan = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), p = g.player;
      window.__at(26.5, 1, 57.5, 0, 0);
      const keyWord = g.gymLive.near(p), keyPr = g.gymLive.prompt(window.__blk(25, 1, 55), 'click or E');
      g.gymLive.use(p); // wind it with the towel still on: it runs, but no wind comes through
      window.__step(4);
      const covered = { running: live.fanRunning(), lifts: g.world.lifts.length, toast: window.__toasts.at(-1) };
      window.__at(11.5, 1, 61.5, 0, 0);
      const towelWord = g.gymLive.near(p);
      g.gymLive.use(p);
      window.__step(4);
      const off = { towel: live.towelOn, lifts: g.world.lifts.length, word: g.gymLive.near(p) };
      return { keyWord, keyPr, covered, towelWord, off };
    });
    t.ok(fan.keyWord === 'Wind!' && /Wind-up key/.test(fan.keyPr), `by the key box the big button says "${fan.keyWord}" ("${fan.keyPr}")`);
    t.ok(fan.covered.running && fan.covered.lifts === 0 && /towel is in the way/.test(fan.covered.toast), `with the towel on, the fan runs but blows nobody up ("${fan.covered.toast}")`);
    t.ok(fan.towelWord === 'Pull!' && !fan.off.towel && fan.off.lifts === 1 && fan.off.word !== 'Pull!', `"${fan.towelWord}" pulls the towel off: now the wind blows (a lift)`);
    const timer = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), p = g.player;
      window.__step(260); // the 12 s run down
      const ran = { running: live.fanRunning(), lifts: g.world.lifts.length };
      // wind it, then run (real walking) to the grill and ride up
      window.__at(26.5, 1, 57.5, 0, 0);
      g.gymLive.use(p);
      const t0 = live.clock;
      const r = window.__walk([[17.5, 55.5], [11.5, 53.5]], 400);
      const tGrill = live.clock - t0;
      window.__step(140);
      const top = p.pos.y;
      const r2 = window.__walk([[11.5, 47.5]], 200);
      return { ran, r, tGrill, top, y: p.pos.y, z: p.pos.z, onGround: p.onGround };
    });
    t.ok(!timer.ran.running && timer.ran.lifts === 0, 'after its 12 seconds the fan runs down and the wind stops');
    t.ok(timer.tGrill < 8 && timer.top >= 33.9 && timer.y >= 33.9 && timer.y <= 34.8 && timer.z < 51 && timer.onGround, `wind the key, walk to the grill (${timer.tGrill.toFixed(1)} s of 12), ride the wind up (${timer.top.toFixed(2)}) and step onto the shelf (y ${timer.y.toFixed(2)}, z ${timer.z.toFixed(1)})`);
    const hold = await page.evaluate(() => { // the wind never stops under you: it waits until you are out of it
      const g = window.pokecraft, live = window.__live(), p = g.player;
      window.__at(26.5, 1, 57.5, 0, 0); g.gymLive.use(p);
      window.__at(11.5, 4, 53.5, 0, 0);
      live.runUntil = live.clock + 0.5; // almost run down
      window.__step(60);
      return { lifts: g.world.lifts.length, y: p.pos.y };
    });
    t.ok(hold.lifts === 1 && hold.y > 20, `a fan that runs down while you ride keeps blowing until you are off (y ${hold.y.toFixed(1)})`);
    await page.evaluate(() => window.__step(200));
    await shot(page, 'fan', [24.5, 6, 62.5, 0.95, -0.25], 1500);

    // ---- puzzle 2: the plug, the tap, the deep river and the bottle cap
    const tap = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), h = window.__blk(34, 32, 5), p = g.player;
      window.__at(36.5, 31, 8.5, 0, 0);
      const pr = g.gymLive.prompt(h, 'click or E'), act = g.gymLive.action(h);
      g.gymLive.hit(h); // the tap first: the water runs away
      window.__step(160);
      const noPlug = { stream: g.world.get(36, 33, 11), basin: g.world.get(30, 29, 15), groove: g.world.get(60, 28, 15), toast: window.__toasts.some(m => /plughole/.test(m)) };
      window.__at(44.5, 31, 24.5, 0, 0);
      const word = g.gymLive.near(p);
      g.gymLive.use(p);
      const plugged = { in: live.plugIn(), rim: g.world.get(44, 31, 22), hole: g.world.get(36, 29, 15) };
      window.__at(36.5, 31, 8.5, 0, 0); plugged.atTap = g.gymLive.near(p); // by the tap the big button never says Unplug (E turns the tap)
      window.__step(160);
      let dry = 0;
      for (let x = 48; x <= 96; x++) for (let z = 14; z <= 16; z++) for (let y = 27; y <= 30; y++) { const id = g.world.get(x, y, z); if (id !== 5 && id === 0) dry++; }
      return { pr, act, noPlug, word, plugged, dry, basin: g.world.get(30, 29, 15), wet: live.wet() };
    });
    t.ok(/Tap · .* to turn it on/.test(tap.pr) && tap.act === 'Turn tap!' && tap.noPlug.stream === 5 && tap.noPlug.basin === 0 && tap.noPlug.groove === 0 && tap.noPlug.toast, 'the tap without the plug: water runs from the tap, but the sink and the river stay dry (a toast says why)');
    t.ok(tap.word === 'Plug in!' && tap.plugged.in && tap.plugged.rim === 0 && tap.plugged.hole === 250 && tap.plugged.atTap === null, `"${tap.word}": the plug moves from the rim into the plughole`);
    t.ok(tap.dry === 0 && tap.basin === 5 && tap.wet, `with the plug in, after 8 s the sink and the whole deep river are water (${tap.dry} dry cells)`);
    const cap = await page.evaluate(() => {
      const g = window.pokecraft, p = g.player, live = window.__live();
      window.__at(50.5, 30, 15.5, -1.57, 0);
      window.__step(8); const early = !!p.carry; window.__step(6); const boarded = !!p.carry && live.capRider != null;
      window.__step(20);
      const midX = p.pos.x;
      window.__step(400);
      return { early, boarded, midX, carry: p.carry === null, x: p.pos.x, y: p.pos.y, ground: g.world.get(99, 30, 15), above: g.world.get(99, 31, 15), dock: live.dock };
    });
    t.ok(!cap.early && cap.boarded && cap.midX > 52, `the cap boards after 0.6 s (not before) and floats you east (x ${cap.midX.toFixed(1)})`);
    t.ok(cap.carry && Math.abs(cap.x - 99.5) < 0.1 && cap.y >= 31 && cap.y < 31.2 && cap.ground === 153 && cap.above === 0 && cap.dock === 'E', `after the river it sets you down on the counter (${cap.x.toFixed(1)}, ${cap.y.toFixed(1)})`);
    await shot(page, 'river', [99.5, 31, 15.5, 1.57, -0.32], 2000);
    const drain = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), p = g.player;
      g.gymLive.hit(window.__blk(34, 32, 5)); window.__step(60); // the tap off: the plug keeps the water in
      const kept = g.world.get(70, 28, 15);
      window.__at(36.5, 30, 18.5, 0, 0); const word = g.gymLive.near(p); g.gymLive.use(p); window.__step(200); // pull the plug
      let wet = 0; for (let x = 48; x <= 96; x++) for (let z = 14; z <= 16; z++) for (let y = 27; y <= 30; y++) if (g.world.get(x, y, z) === 5) wet++;
      return { kept, word, wet, rim: g.world.get(44, 31, 22), basin: g.world.get(30, 29, 15) };
    });
    t.ok(drain.kept === 5 && drain.word === 'Unplug' && drain.wet === 0 && drain.rim === 250 && drain.basin === 0, `the tap off keeps the water (the plug is in); "${drain.word}" lets it all run away and the plug goes back on the rim`);
    const dryWalk = await page.evaluate(() => { // in the dry river you are stuck: walking east ends at a wall, the steps by the sink lead back up
      const g = window.pokecraft, p = g.player;
      window.__at(60.5, 27, 15.5, 0, 0);
      window.__walk([[96.5, 15.5]], 300);
      const east = { x: p.pos.x, y: p.pos.y };
      const r = window.__walk([[49.5, 15.5], [48.5, 15.5], [46.5, 15.5], [30.5, 15.5], [26.5, 10.5], [24.5, 10.5], [22.5, 12.5]], 900);
      return { east, back: { i: r.i, x: p.pos.x, y: p.pos.y } };
    });
    t.ok(dryWalk.east.y < 28 && dryWalk.back.y >= 30.9, `the dry river: walking east you stay at the bottom (y ${dryWalk.east.y.toFixed(1)}); the steps by the sink and the sponge take you back up (y ${dryWalk.back.y.toFixed(1)})`);

    // ---- puzzle 3: the yarn and the cat on the book stairs
    const cat = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), p = g.player;
      window.__at(113.5, 31, 26.5, 0, 0); // at the top of the books: the cat is in the way
      const blocked = window.__walk([[113.5, 45.5]], 120);
      const stuck = { z: p.pos.z, y: p.pos.y, cell: g.world.get(113, 31, 30), pr: g.gymLive.prompt(window.__blk(113, 31, 29), 'click or E') };
      window.__at(119.5, 31, 23.5, 0, 0);
      const word = g.gymLive.near(p);
      g.gymLive.use(p);
      window.__step(50); // the yarn falls, the cat wakes and jumps down
      const away = { phase: live.catPhase, cell: g.world.get(113, 31, 30), away: live.catAway() };
      g.updateGuide(); const guide = document.getElementById('guide')?.textContent || '';
      window.__at(113.5, 31, 26.5, 0, 0);
      const down = window.__walk([[113.5, 46.5]], 400);
      const onTable = { y: p.pos.y, z: p.pos.z };
      return { stuck, word, away, guide, onTable, steps: down.steps };
    });
    t.ok(cat.stuck.z < 29 && cat.stuck.cell === 250 && /Sleeping cat/.test(cat.stuck.pr), `the cat asleep on the book stairs blocks the way (you stop at z ${cat.stuck.z.toFixed(1)}): "${cat.stuck.pr}"`);
    t.ok(cat.word === 'Push!' && cat.away.phase === 'play' && cat.away.cell === 0 && cat.away.away && /Quick! Down the books/.test(cat.guide), `"${cat.word}" pushes the yarn off: the cat jumps down after it and plays (the books are free; "${cat.guide}")`);
    t.ok(cat.onTable.y >= 25.9 && cat.onTable.y < 26.6 && cat.onTable.z > 44, `down the book stairs onto the table (y ${cat.onTable.y.toFixed(1)}, ${(cat.steps * 0.05).toFixed(1)} s)`);
    const comeBack = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live();
      window.__at(113.5, 30, 32.5, 0, 0); window.__step(300); // standing where it sleeps: it waits on the floor
      const waits = live.catPhase;
      window.__at(113.5, 26, 50.5, 0, 0); window.__step(60);
      return { waits, phase: live.catPhase, cell: g.world.get(113, 31, 30), yarn: g.world.get(119, 31, 25) };
    });
    t.ok(comeBack.waits === 'play' && comeBack.phase === 'sleep' && comeBack.cell === 250 && comeBack.yarn === 250, `after its game the cat waits while you stand on its spot, then brings the yarn back up and sleeps again`);
    await shot(page, 'cat', [113.5, 31, 22.5, Math.PI, -0.2], 1800);

    // ---- puzzle 4: the marble, the spoon seesaw and the fort
    const fling = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), p = g.player, ss = live.h.seesaw;
      // the fort is closed from outside
      window.__at(96.5, 26, 79.5, 0, 0);
      const outside = window.__walk([[96.5, 70.5]], 120);
      const shut = { z: p.pos.z, door: g.world.get(96, 26, 75) };
      // roll the marble but stay out of the spoon: it flips empty, the marble comes back
      window.__at(109.5, 26, 52.5, 0, 0);
      const word = g.gymLive.near(p);
      g.gymLive.use(p);
      window.__step(10); const rolling = live.marbleRolling();
      window.__step(170);
      const empty = { carry: !!p.carry, toast: window.__toasts.at(-1) };
      window.__step(60);
      const backTop = live.marbleState;
      // roll it, walk to the bowl, wait
      window.__at(109.5, 26, 52.5, 0, 0);
      g.gymLive.use(p);
      const r = window.__walk([[118.5, 56.5], [121.1, 64.5]], 400);
      const walkT = r.steps * 0.05;
      let flew = false, inWall = 0;
      for (let i = 0; i < 300; i++) { window.__step(1); if (p.carry && live.flingMover(p.carry)) { flew = true; if (p.collides(p.pos)) inWall++; } if (flew && !p.carry) break; }
      window.__step(10);
      const land = [p.pos.x, p.pos.y, p.pos.z];
      const inside = Math.hypot(p.pos.x - 96, p.pos.z - 64) < 10;
      g.updateGuide();
      return { shut, word, rolling, empty, backTop, walkT, flew, inWall, land, inside, guide: document.getElementById('guide')?.textContent || '' };
    });
    t.ok(fling.shut.z > 76 && fling.shut.door !== 0, `the fort is closed from outside: you stop at the wall (z ${fling.shut.z.toFixed(1)})`);
    t.ok(fling.word === 'Roll!' && fling.rolling && !fling.empty.carry && /nobody was in it/.test(fling.empty.toast) && fling.backTop === 'top', `"${fling.word}": the marble rolls down the ruler; with nobody in the bowl the spoon flips empty and the marble comes back`);
    t.ok(fling.walkT < 8 && fling.flew && fling.inWall === 0 && fling.inside && Math.abs(fling.land[1] - 27) < 0.1, `roll it, walk into the bowl (${fling.walkT.toFixed(1)} s of 8): the spoon flings you over the wall onto the cookie (${fling.land.map(v => v.toFixed(1))})`);
    t.ok(/Nibbles!/.test(fling.guide), `inside the fort the guide points at Nibbles ("${fling.guide}")`);
    const door = await page.evaluate(() => { // the back door opens from inside and shuts behind you
      const g = window.pokecraft, p = g.player;
      const r = window.__walk([[96.5, 72.5], [96.5, 79.5]], 300);
      window.__step(10);
      return { z: p.pos.z, y: p.pos.y, shut: g.world.get(96, 26, 75) !== 0 };
    });
    t.ok(door.z > 77 && door.y < 26.5 && door.shut, `the fort's back door opens from inside, you walk out (z ${door.z.toFixed(1)}) and it shuts behind you`);
    await page.evaluate(() => window.__at(124.5, 26, 72.5, 0, 0));
    await shot(page, 'spoon', [126.5, 30, 76.5, Math.atan2(28, 10), -0.32], 1800);

    // ---- the crumbs
    const crumbs = await page.evaluate(async () => {
      const g = window.pokecraft, live = window.__live(), G = await import('/src/giantland.js'), Hl = await import('/src/houselive.js');
      const cubes0 = g.cubes, c0 = G.CRUMBS[0];
      window.__at(c0[0] + 0.5, c0[1], c0[2] + 1.5, 0, 0);
      const blk = window.__blk(...c0), pr = g.gymLive.prompt(blk, 'tap'), act = g.gymLive.action(blk);
      const hit = g.gymLive.hit(blk);
      const n1 = { cubes: g.cubes - cubes0, key: g.beaten.includes(Hl.crumbKey(0)), cell: g.world.get(...c0), toast: window.__toasts.at(-1) };
      const again = g.gymLive.hit(window.__blk(...c0)), n2 = g.cubes - cubes0;
      return { pr, act, hit, n1, again, n2, total: G.CRUMBS.length };
    });
    t.ok(/Cookie crumb · .* to pick it up/.test(crumbs.pr) && crumbs.act === 'Pick up!' && crumbs.hit, `a crumb: "${crumbs.pr}" / "${crumbs.act}"`);
    t.ok(crumbs.n1.cubes === 1 && crumbs.n1.key && crumbs.n1.cell === 0 && /1 of 12/.test(crumbs.n1.toast) && crumbs.n2 === 1, `picking it up: +1 cube, the key pw:house:crumb0 is in beaten, the cell is air, "${crumbs.n1.toast}"; again: nothing`);
    const saved = await page.evaluate(() => { const g = window.pokecraft; g.save(true); return JSON.parse(localStorage.getItem('pokecraft-save-v2')); });
    t.ok(saved.place === 'house' && saved.beaten.includes('pw:house:crumb0'), 'the save is in the house and holds the crumb key');
    const page2 = await openGame(browser, base, { setup: seedSave(saved) });
    await continueGame(page2);
    await placeIs(page2, 'house');
    await helpers(page2); await toasts(page2);
    await waitFor(page2, () => window.pokecraft.world.get(30, 1, 166) === 0, null, 30000);
    const reload = await page2.evaluate(async () => {
      const g = window.pokecraft, G = await import('/src/giantland.js'), Hl = await import('/src/houselive.js');
      const cubes0 = g.cubes, a = g.world.get(...G.CRUMBS[0]), b = g.world.get(...G.CRUMBS[1]);
      for (let i = 1; i < 11; i++) g.beaten.push(Hl.crumbKey(i));
      window.__live().syncCrumbs();
      const c11 = G.CRUMBS[11];
      window.__at(c11[0] + 0.5, c11[1], c11[2] + 1.5, 0, 0);
      g.gymLive.hit(window.__blk(...c11));
      const ctx = g.creatures.context(g.player.pos, false, false), SR = await import('/src/spawnrules.js');
      return { place: g.place, a, b, cubes: g.cubes - cubes0, last: window.__toasts.at(-1), air: G.CRUMBS.slice(1, 11).every(c => g.world.get(...c) === 0), all: g.world.allCrumbs, pip: SR.condOk('crumbs', ctx) };
    });
    t.ok(reload.place === 'house' && reload.a === 0 && reload.b === 156, `a reload continues in the house: crumb 0 is still gone, crumb 1 is there (${reload.a}, ${reload.b})`);
    t.ok(reload.cubes === 6 && reload.air && /every crumb/.test(reload.last), `the twelfth crumb gives +1 and the +5 bonus (${reload.cubes}): "${reload.last}"`);
    t.ok(reload.all && reload.pip, 'with all twelve crumbs the house says so and Pipsqueak\'s condition (crumbs) is true');
    await page2.context().close();

    // ---- the nooks and the peek gait
    const nook = await page.evaluate(async () => { try {
      const g = window.pokecraft, S = await import('/src/species.js'), cm = g.creatures, n = g.world.nooks.find(n => n.kind === 'leaf');
      for (const w of [...cm.list]) cm.remove(w);
      const w = cm.spawnAt('thimbit', n.x, n.y, n.z, { when: 'nook' });
      const view = d => { cm.viewer = { x: n.x + 0.5 + d, y: n.y, z: n.z + 0.5 + 6 + d * 0 }; };
      view(0); cm.viewer = { x: n.x + 0.5, y: n.y, z: n.z + 12.5 };
      let vis = 0, steps = 90;
      for (let i = 0; i < steps; i++) { cm.updateOne(w, 0.05); if (w.model.visible) vis++; }
      const far = vis / steps;
      cm.viewer = { x: n.x + 0.5, y: n.y, z: n.z + 3.5 };
      for (let i = 0; i < 40; i++) cm.updateOne(w, 0.05);
      const near = { visible: w.model.visible, turn: Math.abs(Math.atan2(Math.sin(w.heading - 0), Math.cos(w.heading - 0))) < 0.3, y: w.model.position.y - w.pos.y };
      // it stays out a while after you step away, then hides again
      cm.viewer = { x: n.x + 0.5, y: n.y, z: n.z + 30.5 };
      for (let i = 0; i < 20; i++) cm.updateOne(w, 0.05);
      const kept = w.model.visible;
      let hidden = false; for (let i = 0; i < 160; i++) { cm.updateOne(w, 0.05); if (!w.model.visible) hidden = true; }
      // walk into it: a battle
      let bumped = 0; cm.onBump = () => { bumped++; };
      cm.viewer = { x: n.x + 0.5, y: n.y, z: n.z + 3.5 }; for (let i = 0; i < 10; i++) cm.updateOne(w, 0.05);
      const pp = { x: n.x + 0.5, y: n.y, z: n.z + 0.7 };
      cm.update(0.05, pp, g.spawnPoint, false, false);
      w.model.updateMatrixWorld(true); // (the game's render does this each frame)
      const pick = !!cm.pick({ x: n.x + 0.5, y: n.y + 0.25, z: n.z + 3.0 }, { x: 0, y: 0, z: -1 }, 5);
      cm.remove(w);
      // natural spawns land only on nook cells
      for (const x of [...cm.list]) cm.remove(x);
      const around = g.world.nooks.filter(q => q.kind === 'shadow')[0], ctr = { x: around.x + 0.5, y: around.y, z: around.z + 0.5 + 12 };
      const set = new Set(g.world.nooks.map(q => `${q.x},${q.y},${q.z}`)); let spawned = 0, off = 0, species = new Set();
      for (let i = 0; i < 300; i++) { cm.trySpawn(ctr, g.spawnPoint, cm.context(ctr, false, false)); if (cm.list.length > 12) break; }
      for (const x of cm.list) { spawned++; species.add(x.data.species); if (!set.has(`${Math.floor(x.pos.x)},${Math.round(x.pos.y)},${Math.floor(x.pos.z)}`)) off++; }
      for (const x of [...cm.list]) cm.remove(x);
      return { far, near, kept, hidden, bumped, pick, spawned, off, species: [...species].join(), tiny: [...species].every(s => S.SPECIES[s].type === 'tiny'), pip: species.has('pipsqueak'), all: !!g.world.allCrumbs };
    } catch (e) { return { err: e.stack }; } });
    if (nook.err) console.log(nook.err);
    t.ok(nook.far > 0.1 && nook.far < 0.6, `far away a peeking creature is out only part of the time (${(nook.far * 100).toFixed(0)}%)`);
    t.ok(nook.near.visible && nook.near.turn && nook.kept && nook.hidden, 'close by it stays out and faces you; step away and it hides again after a while');
    t.ok(nook.bumped === 1 && nook.pick, `walking into it starts a battle (one bump) and it can be picked ${JSON.stringify({ b: nook.bumped, p: nook.pick })}`);
    t.ok(nook.spawned >= 3 && nook.off === 0 && nook.tiny, `natural spawns only sit on nook cells (${nook.spawned} wild: ${nook.species})`);
    t.ok(!nook.all && !nook.pip, 'before all twelve crumbs are found Pipsqueak never comes out');
    // the Book page
    const book = await page.evaluate(async () => {
      const g = window.pokecraft;
      g.book.markSeen('antsy'); g.book.markCaught('antsy');
      g.book.open({ species: 'antsy' });
      await new Promise(r => setTimeout(r, 400));
      const txt = document.getElementById('book-detail')?.textContent || '';
      g.book.close?.();
      return txt;
    });
    t.ok(/Giant House/.test(book) && /hiding in tiny places/.test(book), `the Creature Book page of Antsy says "Giant House" and "hiding in tiny places" (${book.slice(0, 200)})`);

    // ---- the Boss (TINY_SKIP_BOSS=1 leaves out the long battle)
    const boss = await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js'), PB = await import('/src/pictureboss.js');
      const bs = g.world.bosses[0], npc = g.npcs.list.find(n => n.kind === 'boss');
      window.__at(bs.rest[0], bs.rest[1], bs.rest[2], 0, 0);
      const tp = g.bosses.talkPrompt(npc), def = PB.bossOf('house');
      const team = def.team.map(([sp, lv, mv]) => ({ sp, lv, mv, want: S.movesWith(sp, lv, ...(sp === 'fluffnado' ? ['cuphide'] : sp === 'antlas' ? ['antarmy', 'sugarlift'] : [])) }));
      return { tp, levels: def.team.map(t => t[1]).join(), movesOk: team.filter(t => t.mv).every(t => JSON.stringify(t.mv) === JSON.stringify(t.want)), look: npc.def.look, type: def.type, names: def.team.map(t => t[0]).join(), title: npc.title, blockUnder: g.world.get(Math.floor(bs.pos[0]), bs.pos[1] - 1, Math.floor(bs.pos[2])) };
    });
    t.ok(boss.tp.verb === 'challenge' && boss.tp.action === 'Challenge!' && boss.levels === '59,60,61,62' && boss.movesOk && boss.look === 'mouse' && boss.blockUnder === 146, `Nibbles stands on the Boss stand on the cookie: "${boss.tp.action}", levels ${boss.levels}, the written-out move lists equal movesWith (${boss.title})`);
    await page.evaluate(() => { const bs = window.pokecraft.world.bosses[0]; const x = bs.pos[0], z = bs.pos[2]; window.__at(x, bs.pos[1], z + 4.2, 0, 0.0); const p = window.pokecraft.player; p.lookAt({ x, y: bs.pos[1] + 1.2, z }); });
    await shot(page, 'cookie-boss', null, 2500);
    if (!process.env.TINY_SKIP_BOSS) {
      await page.evaluate(async () => {
        const g = window.pokecraft, S = await import('/src/species.js');
        g.party = [S.makeCreature('blazehound', 100)]; g.cubes = 0;
        window.__cele = null; const cf = g.ui.celebrate.bind(g.ui); g.ui.celebrate = (...a) => { window.__cele = a; cf(...a); };
        g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
      });
      await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 30000);
      const bt = await page.evaluate(() => { const b = window.pokecraft.battle; return { boss: b.boss, foes: b.foes.map(f => f.level).join(), moves: b.foes.map(f => f.moves.join('+')).join('|') }; });
      t.ok(bt.boss && bt.foes === '59,60,61,62', `the Boss battle has Nibbles' four creatures at levels ${bt.foes}`);
      t.ok(await playBattle(page), 'the Boss battle is won');
      await waitFor(page, () => window.pokecraft.stars.includes('house'), null, 60000);
      const won = await page.evaluate(() => ({ stars: window.pokecraft.stars.join(), note: window.__cele?.[0], small: window.__cele?.[1] }));
      t.ok(/Giant House star/.test(won.note || '') && /Everything looks big when you are small/.test(won.small || ''), `the star of the Giant House and the Wizard's note (${won.note})`);
    }

    // ---- the secret ways, with real physics
    const hole = await page.evaluate(() => {
      window.pokecraft.inBattle = false;
      window.__at(8.5, 1, 114.5, 1.57, 0);
      const r = window.__walk([[3.5, 114.5], [2.0, 114.5], [2.0, 90], [2.0, 49.0], [4.5, 49.0]], 1800);
      const p = window.pokecraft.player.pos;
      return { r, x: p.x, y: p.y, z: p.z };
    });
    t.ok(hole.r.i === 5 && hole.y >= 33.9 && hole.y <= 35 && hole.x >= 4, `the mouse hole: you walk in, up the tunnel (it climbs 1 per 2 blocks) and out onto the shelf (${hole.x.toFixed(1)}, ${hole.y.toFixed(1)}, ${hole.z.toFixed(1)}; ${hole.r.steps} steps)`);
    const key = await page.evaluate(() => {
      window.__at(110.5, 1, 30.5, 0, 0);
      const r = window.__walk([[110.5, 25.0], [98.5, 25.0], [98.5, 8.0], [98.5, 7.0], [124.0, 7.0], [124.0, 5.5], [124.0, 3.5]], 2500);
      const p = window.pokecraft.player.pos;
      return { r, x: p.x, y: p.y, z: p.z };
    });
    t.ok(key.r.i >= 6 && key.y >= 30.9 && key.y <= 33 && key.z < 6, `the keyhole: squeeze in, climb the cans round the room and out through the hatch onto the counter (${key.x.toFixed(1)}, ${key.y.toFixed(1)}, ${key.z.toFixed(1)}; ${key.r.steps} steps)`);

    // ---- the line-up of all seven
    await page.evaluate(() => window.__at(100.5, 1, 146.5, 0, -0.05));
    const fam = await page.evaluate(async ids => {
      const g = window.pokecraft, cm = g.creatures, C = await import('/src/creatures.js');
      for (const w of [...cm.list]) cm.remove(w);
      window.__peekWas = C.GAITS.peek.notice; C.GAITS.peek.notice = 12; // they all stand out for the picture
      const ws = ids.map((id, i) => cm.spawnAt(id, 94 + i * 2, 1, 140, { when: 'nook' }));
      cm.viewer = { x: 100.5, y: 1, z: 146.5 };
      for (let i = 0; i < 10; i++) for (const w of ws) cm.updateOne(w, 0.05);
      for (const w of ws) w.life = 1e9; // the real loop must not send them away while the picture is taken
      return ws.every(w => w && w.model.visible);
    }, IDS);
    t.ok(fam, 'all seven Tiny creatures stand in a row and peek out when you are close');
    await shot(page, 'tiny-family', null, 2500);
    await page.evaluate(async () => { const cm = window.pokecraft.creatures, C = await import('/src/creatures.js'); C.GAITS.peek.notice = window.__peekWas; for (const w of [...cm.list]) cm.remove(w); });
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join('; ')}`);
  }

  /* ======================================== D. iPad ======================================== */
  if (!only || only === 'ipad') {
    const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
    await newGame(ip, 0);
    const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    await intoHouse(ip);
    const words = await ip.evaluate(async () => {
      const g = window.pokecraft, out = {};
      const want = { remote: 'Ride!', fan: 'Wind!', tap: 'Turn tap!', crumb: 'Pick up!' };
      const look = async (name, pos, tgt) => { // wait for the word (the button follows the target on the next frames)
        window.__at(pos[0], pos[1], pos[2], 0, 0); g.player.lookAt({ x: tgt[0] + 0.5, y: tgt[1] + 0.5, z: tgt[2] + 0.5 });
        for (let i = 0; i < 100; i++) { await new Promise(r => setTimeout(r, 100)); const el = document.getElementById('btn-act'); if (el && el.textContent === want[name]) { out[name] = el.textContent; return; } }
        out[name] = document.getElementById('btn-act')?.textContent || '';
      };
      await look('remote', [40.5, 1, 175.5], [40, 1, 178]);
      await look('fan', [26.5, 1, 57.5], [25, 1, 55]); // the wind-up key: a near word (T40a.5)
      await look('tap', [34.5, 31, 8.5], [34, 32, 5]);
      const G = await import('/src/giantland.js'); const c = G.CRUMBS[0];
      await look('crumb', [c[0] + 0.5, c[1], c[2] + 2.5], c);
      return out;
    });
    t.ok(words.remote === 'Ride!' && words.fan === 'Wind!' && words.tap === 'Turn tap!' && words.crumb === 'Pick up!', `the big button says "${words.remote}" at the remote, "${words.fan}" at the wind-up key, "${words.tap}" at the tap, "${words.crumb}" at a crumb`);
    const buttons = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    t.ok(buttons === before, `the number of touch buttons did not change (${before})`);
    const tapRide = await ip.evaluate(async () => {
      const g = window.pokecraft; window.__at(40.5, 1, 175.5, 0, 0); g.player.lookAt({ x: 40.5, y: 1.5, z: 178.5 });
      await new Promise(r => setTimeout(r, 1500));
      const el = document.getElementById('btn-act'), r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: el.textContent };
    });
    await ip.touchscreen.tap(tapRide.x, tapRide.y);
    await waitFor(ip, () => !!window.pokecraft.player.carry, null, 30000);
    t.ok(true, 'a tap on the big button starts the ride');
    await shot(ip, 'ipad', null, 1500);
    t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
    await ip.context().close();
  }

  await page.context().close();
}
