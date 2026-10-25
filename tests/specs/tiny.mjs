// T40a (wave 14): the Tiny type and the Giant House. Part A (type data, models, fx), B (the terrain for three seeds: walk graph, secrets, paths,
// keeps), C (live: the whole loop in a browser: fan, train, river and cap, cat, crumbs, nooks, the Boss, the secret ways, iPad, the line-up).
// TINY_ONLY=type|land|live|shots runs one part. Screenshots: t40a-house-arrival.png, t40a-fan.png, t40a-train.png, t40a-river.png, t40a-cat.png,
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
      if (!house.house?.length || !house.house.every(e => e[2] === 'nook' && ids.includes(e[0])) || house.house.length !== 7) bad('house spawns');
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
        // the dry groove and the cap: the groove floor is below the cap's feet; the counter top ends the east line
        const info = G.trackInfo();
        return {
          problems: a.out.problems, info: a.out.info, ms, msStandIn: a.out.info.ms, top, ids150: [...ids150].sort((x, y) => x - y).join(), consecutive, tileNames: tiles.length,
          track, east, west, ride, stops: [info.sOf.S.toFixed(1), info.sOf.N.toFixed(1), info.total.toFixed(1)].join(),
          ride9: (info.sOf.N - info.sOf.S) / 9, nooks: w.nooks.length, parts: w.parts.map(p => p.id).join(), lifts: w.lifts.length, bosses: w.bosses.length, walk: w.walk instanceof Set,
          sameAsStandIn: (() => { const s = H.makeHouse(R.realmSeed(seed, def.seedSalt)); for (let i = 0; i < w.data.length; i++) if (w.data[i] !== s.data[i]) return false; return true; })(),
        };
      }, seed);
      t.ok(!r.problems.length, `seed ${seed}: the house is deterministic, standable, reachable by all ways, nobody stuck, secrets, cat strip, keeps, nooks ${r.problems.join(' | ')}`);
      t.ok(r.info.walkRamp && r.info.fan && r.info.train && r.info.mouseHole && r.info.keyhole && r.info.stripOpen && r.info.stripClosed && r.info.stuck === 0, `seed ${seed}: the Boss by the ramp, by the fan, by the train; the mouse hole and the keyhole lead up; the strip closes with the tail (${r.info.cells} cells)`);
      t.ok(r.ms < 400 && r.top <= 47 && r.ids150 === '150,151,152,153,154,155,156,157,158,160,161,162,163,164,166,167' && r.consecutive, `seed ${seed}: generated in ${r.ms.toFixed(0)} ms (the faster of two runs), nothing above y 47 (top ${r.top}), every block 150-167 used except the two drawn only with setLive (${r.ids150.split(',').length} of 18), the 20 tiles in a row (${r.consecutive})`);
      t.ok(!r.track.badAt && !r.east.badAt && !r.west.badAt && !r.ride.badAt, `seed ${seed}: the train line, the ride and both cap lines have 2 cells of air and nothing solid in the way (${r.track.n + r.east.n + r.west.n} samples) ${r.track.badAt || r.east.badAt || r.west.badAt || r.ride.badAt || ''}`);
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
    t.ok(await said(page, /HUGE/) && await said(page, /Nibbles waits on the cookie/), 'the toasts say you are small and Nibbles waits on the cookie');
    t.ok(/Toy train!/.test(enter.guide), `the guide points at the toy train (${enter.guide})`);
    await shot(page, 'house-arrival', [24.5, 1, 181.5, -1.2, 0.05]);

    // ---- the fan
    const fan = await page.evaluate(() => {
      const g = window.pokecraft, sw = window.__blk(11, 1, 134), live = window.__live();
      window.__at(11.5, 1, 131.5, 0, 0);
      const before = { lifts: g.world.lifts.length, prompt: g.gymLive.prompt(sw, 'click or E'), action: g.gymLive.action(sw) };
      const hit = g.gymLive.hit(sw);
      const after = { lifts: g.world.lifts.length, prompt: g.gymLive.prompt(window.__blk(11, 1, 134), 'click or E'), action: g.gymLive.action(window.__blk(11, 1, 134)), on: live.fanOn, cell: g.world.get(11, 1, 134) };
      return { before, hit, after };
    });
    t.ok(fan.hit && fan.before.lifts === 0 && fan.before.action === 'Fan on!' && /to turn it on/.test(fan.before.prompt), `the fan switch: "${fan.before.prompt}" / "${fan.before.action}"`);
    t.ok(fan.after.lifts === 1 && fan.after.on && fan.after.action === 'Fan off' && /to turn it off/.test(fan.after.prompt) && fan.after.cell === 159, `fan on: the lift is there, the switch lights, "${fan.after.action}"`);
    const up = await page.evaluate(() => {
      window.__at(11.5, 4, 127.5, 0, 0);
      window.__step(120);
      const p = window.pokecraft.player, top = p.pos.y;
      // walk north onto the shelf (jump when a step is in the way)
      const r = window.__walk([[11.5, 118.5]], 200);
      return { top, y: p.pos.y, z: p.pos.z, onGround: p.onGround, r };
    });
    t.ok(up.top >= 33.9 && up.y >= 33.9 && up.y <= 34.8 && up.z < 124 && up.onGround, `the wind lifts you to the shelf (${up.top.toFixed(2)}) and you walk onto it (y ${up.y.toFixed(2)}, z ${up.z.toFixed(1)})`);
    await shot(page, 'fan', [14, 6, 140, -1.57, 0.1], 1500);
    const off = await page.evaluate(() => { const g = window.pokecraft; g.gymLive.hit(window.__blk(12, 1, 134)); return { lifts: g.world.lifts.length, on: window.__live().fanOn }; });
    t.ok(off.lifts === 0 && !off.on, 'the other switch cell turns the fan off again: the lift is gone');

    // ---- the toy train
    const train = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), btnS = window.__blk(40, 1, 178), btnN = window.__blk(116, 15, 95);
      window.__at(40.5, 1, 176.5, 0, 0);
      const act0 = g.gymLive.action(btnS), pr0 = g.gymLive.prompt(btnS, 'click or E');
      const far = (() => { window.__at(40.5, 1, 190 - 6, 0, 0); window.__at(60.5, 1, 183.5, 0, 0); g.gymLive.hit(btnS); return !g.player.carry; })();
      window.__at(40.5, 1, 176.5, 0, 0);
      g.gymLive.hit(btnS);
      const carried = !!g.player.carry, mover = g.player.carry;
      let collided = 0, s = 0;
      for (let i = 0; i < 20; i++) { g.player.update(0.05); g.gymLive.update(0.05); }
      const y1 = g.player.pos.y;
      // one frame screenshot position: remember a mid-ride place
      for (let i = 0; i < 300; i++) { g.player.update(0.05); g.gymLive.update(0.05); }
      const mid = [g.player.pos.x, g.player.pos.y, g.player.pos.z];
      const guideMid = g.world.realm && (g.updateGuide(), document.getElementById('guide')?.textContent || '');
      for (let i = 0; i < 800; i++) { if (g.player.carry && g.player.collides(g.player.pos)) collided++; g.player.update(0.05); g.gymLive.update(0.05); s++; if (!g.player.carry) break; }
      const p = g.player.pos, stop = [116.5, 15.5, 92.5];
      return { act0, pr0, far, carried, y1, mid, guideMid, collided, steps: s, end: [p.x, p.y, p.z], dist: Math.hypot(p.x - stop[0], p.z - stop[2]), carryNull: g.player.carry === null, at: live.train.at, mover: !!mover };
    });
    t.ok(train.act0 === 'Ride!' && /Toy train remote · .* to ride/.test(train.pr0) && train.far && train.carried && train.mover, `remote S says "${train.act0}"; far away the button asks you to stand by the train; pressing it near boards you`);
    t.ok(train.collided === 0 && train.carryNull && train.dist < 0.6 && train.at === 'N' && train.steps + 320 < 640 && train.steps + 320 > 540, `the ride takes ${((train.steps + 320) * 0.05).toFixed(0)} s to stop N (${train.dist.toFixed(2)} away), nothing solid on the way`);
    t.ok(/Choo choo/.test(train.guideMid) || /Toy|Choo|table/.test(train.guideMid), `the guide on the ride says "${train.guideMid}"`);
    const guide2 = await page.evaluate(() => { const g = window.pokecraft; window.__at(110.5, 15, 89.5, 0, 0); g.updateGuide(); return document.getElementById('guide')?.textContent || ''; });
    t.ok(/Tiptoe past the cat/.test(guide2), `on the bench the guide says "${guide2}"`);
    const back = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), btnN = window.__blk(116, 15, 95), btnS = window.__blk(40, 1, 178);
      window.__at(116.5, 15, 93.5, 0, 0);
      const a1 = g.gymLive.action(btnN);
      g.gymLive.hit(btnN);
      const riding = !!g.player.carry;
      // a fresh jump press gets you off mid-ride; the train goes on without you and arrives at S
      g.player.keys.Space = false; window.__step(20); g.player.keys.Space = true; window.__step(2); g.player.keys.Space = false;
      const off = g.player.carry === null, runKind = live.train.run?.kind;
      window.__step(620);
      const atAfter = live.train.at;
      // the train is at S: remote N says "Call train!" (an empty run), then "Ride!" when it is here
      window.__at(116.5, 15, 93.5, 0, 0);
      const a2 = g.gymLive.action(btnN);
      g.gymLive.hit(btnN);
      const calling = live.train.run?.kind, busy = g.gymLive.action(btnN);
      window.__step(700);
      return { a1, riding, off, runKind, atAfter, a2, calling, busy, now: live.train.at, a3: g.gymLive.action(btnN) };
    });
    t.ok(back.a1 === 'Ride!' && back.riding && back.off && back.runKind === 'call', `remote N says "${back.a1}", rides back, a fresh jump press gets you off mid-ride and the empty train goes on`);
    t.ok(back.atAfter === 'S' && back.a2 === 'Call train!' && back.calling === 'call' && back.busy === 'Wait...' && back.now === 'N' && back.a3 === 'Ride!', `the train came home by itself (${back.atAfter}); remote N says "${back.a2}", then "${back.busy}", and when it is here "${back.a3}"`);
    await page.evaluate(() => { const g = window.pokecraft, live = window.__live(); window.__at(116.5, 15, 93.5, 0, 0); g.gymLive.hit(window.__blk(116, 15, 95)); window.__step(300); });
    await shot(page, 'train', null, 1800);

    // ---- the tap, the river and the bottle cap
    const tap = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), h = window.__blk(34, 32, 5);
      window.__at(36.5, 31, 8.5, 0, 0);
      const pr = g.gymLive.prompt(h, 'click or E'), act = g.gymLive.action(h);
      g.gymLive.hit(h);
      window.__step(160); // 8 s
      let dry = 0;
      for (let x = 48; x <= 97; x++) for (let z = 14; z <= 16; z++) if (g.world.get(x, 30, z) !== 5) dry++;
      const basin = g.world.get(30, 29, 15), stream = g.world.get(36, 33, 11);
      return { pr, act, dry, basin, stream, on: live.tapOn };
    });
    t.ok(/Tap · .* to turn it on/.test(tap.pr) && tap.act === 'Turn tap!' && tap.on && tap.dry === 0 && tap.basin === 5 && tap.stream === 5, `the tap: "${tap.act}", after 8 s the stream, the sink and the whole groove are water (${tap.dry} dry cells)`);
    const cap = await page.evaluate(() => {
      const g = window.pokecraft, p = g.player, live = window.__live();
      window.__at(50.5, 30, 15.5, -1.57, 0);
      window.__step(8); const early = !!p.carry; window.__step(6); const boarded = !!p.carry && live.capRider != null;
      window.__step(20);
      const midX = p.pos.x;
      window.__step(400);
      return { early, boarded, midX, carry: p.carry === null, x: p.pos.x, y: p.pos.y, z: p.pos.z, ground: g.world.get(99, 30, 15), above: g.world.get(99, 31, 15), dock: live.dock };
    });
    t.ok(!cap.early && cap.boarded && cap.midX > 52, `standing on the cap boards it after 0.6 s (not before) and it floats you east (x ${cap.midX.toFixed(1)}) ${JSON.stringify(cap)}`);
    t.ok(cap.carry && Math.abs(cap.x - 99.5) < 0.1 && cap.y >= 31 && cap.y < 31.2 && cap.ground === 153 && cap.above === 0 && cap.dock === 'E', `after the river it sets you down on dry counter (${cap.x.toFixed(1)}, ${cap.y.toFixed(1)}); the cap waits at the east dock`);
    await page.evaluate(() => { window.__at(60.5, 31, 20.5, -0.4, -0.5); });
    await shot(page, 'river', [70, 31, 26, 0.15, -0.35], 2000);
    const dry = await page.evaluate(() => { const g = window.pokecraft; g.gymLive.hit(window.__blk(34, 32, 5)); window.__step(170); let wet = 0; for (let x = 48; x <= 97; x++) for (let z = 14; z <= 16; z++) if (g.world.get(x, 30, z) === 5) wet++; return { wet, basin: g.world.get(30, 29, 15) }; });
    t.ok(dry.wet === 0 && dry.basin === 0, 'the tap off: after 8 s the groove and the sink are dry again');

    // ---- the cat
    const cat = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), p = g.player;
      window.__toastsBefore = window.__toasts.length;
      window.__at(104.5, 15, 87.5, 1.57, 0);
      // walking (4.3) never wakes it
      p.keys.KeyW = true; window.__step(30); p.keys.KeyW = false;
      const walkAwake = live.awake;
      window.__at(104.5, 15, 87.5, 1.57, 0);
      p.keys.KeyW = true; p.keys.ShiftLeft = true; window.__step(14); p.keys.KeyW = false; p.keys.ShiftLeft = false;
      const awake = live.awake;
      window.__step(2);
      const tail = [g.world.get(78, 15, 87), g.world.get(79, 16, 88), g.world.get(78, 15, 92)];
      const eye = g.world.get(97, 20, 91);
      const pr = g.gymLive.prompt(window.__blk(97, 20, 91), 'click or E'), act = g.gymLive.action(window.__blk(97, 20, 91));
      const guide = (window.__at(110.5, 15, 89.5, 0, 0), g.updateGuide(), document.getElementById('guide')?.textContent || '');
      return { walkAwake, awake, tail, eye, pr, act, guide };
    });
    t.ok(!cat.walkAwake && cat.awake && cat.tail.join() === '163,163,163' && cat.eye === 165, `walking never wakes the cat; running does: tail up (${cat.tail}), eyes open (${cat.eye}); "${cat.pr}" / "${cat.act}"`);
    t.ok(/wait for the cat to sleep/.test(cat.guide) && await said(page, /Mrrow/), `the guide and a toast say to wait ("${cat.guide}")`);
    const sleep = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live();
      window.__at(110.5, 15, 87.5, 1.57, 0);
      window.__step(40); // 2 s: still awake
      const still = live.awake;
      window.__step(110);
      return { still, awake: live.awake, tail: [g.world.get(78, 15, 87), g.world.get(79, 16, 88)], eye: g.world.get(97, 20, 91) };
    });
    t.ok(sleep.still && !sleep.awake && sleep.tail.join() === '0,0' && sleep.eye === 164 && JSON.stringify(sleep) !== '', `5 s after the last noise the cat sleeps again: the tail is down and the strip is open ${JSON.stringify(sleep)}`);
    const inside = await page.evaluate(() => {
      const g = window.pokecraft, live = window.__live(), p = g.player;
      window.__at(78.5, 15, 87.5, 0, 0);
      live.cat.hearNoise(95, 90); live.noiseT = 0;
      window.__step(4);
      const awake = live.awake, cell = g.world.get(78, 15, 87);
      window.__at(76.5, 15, 87.5, 0, 0);
      window.__step(4);
      return { awake, cell, after: g.world.get(78, 15, 87) };
    });
    t.ok(inside.awake && inside.cell === 0 && inside.after === 163, `a tail cell never closes on you: it stays air while you stand in it and turns to fur when you step out ${JSON.stringify(inside)}`);
    await shot(page, 'cat', [110.5, 15, 89.5, 1.57, 0.15], 1800); // asleep again: the z z z over its head

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
      return { place: g.place, a, b, cubes: g.cubes - cubes0, last: window.__toasts.at(-1), air: G.CRUMBS.slice(1, 11).every(c => g.world.get(...c) === 0) };
    });
    t.ok(reload.place === 'house' && reload.a === 0 && reload.b === 156, `a reload continues in the house: crumb 0 is still gone, crumb 1 is there (${reload.a}, ${reload.b})`);
    t.ok(reload.cubes === 6 && reload.air && /every crumb/.test(reload.last), `the twelfth crumb gives +1 and the +5 bonus (${reload.cubes}): "${reload.last}"`);
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
      return { far, near, kept, hidden, bumped, pick, spawned, off, species: [...species].join(), tiny: [...species].every(s => S.SPECIES[s].type === 'tiny') };
    } catch (e) { return { err: e.stack }; } });
    if (nook.err) console.log(nook.err);
    t.ok(nook.far > 0.1 && nook.far < 0.6, `far away a peeking creature is out only part of the time (${(nook.far * 100).toFixed(0)}%)`);
    t.ok(nook.near.visible && nook.near.turn && nook.kept && nook.hidden, 'close by it stays out and faces you; step away and it hides again after a while');
    t.ok(nook.bumped === 1 && nook.pick, `walking into it starts a battle (one bump) and it can be picked ${JSON.stringify({ b: nook.bumped, p: nook.pick })}`);
    t.ok(nook.spawned >= 3 && nook.off === 0 && nook.tiny, `natural spawns only sit on nook cells (${nook.spawned} wild: ${nook.species})`);
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
      window.__at(8.5, 1, 148.5, 1.57, 0);
      const r = window.__walk([[3.5, 148.5], [2.0, 148.5], [2.0, 120], [2.0, 83.0], [4.5, 83.0]], 1800);
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
  if (want('live') && !only) {
    const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
    await newGame(ip, 0);
    const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    await intoHouse(ip);
    const words = await ip.evaluate(async () => {
      const g = window.pokecraft, out = {};
      const look = async (name, pos, tgt) => {
        window.__at(pos[0], pos[1], pos[2], 0, 0); g.player.lookAt({ x: tgt[0] + 0.5, y: tgt[1] + 0.5, z: tgt[2] + 0.5 });
        for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); const el = document.getElementById('btn-act'); if (el && !el.classList.contains('hidden') && el.textContent) { out[name] = el.textContent; return; } }
        out[name] = document.getElementById('btn-act')?.textContent || '';
      };
      await look('remote', [40.5, 1, 175.5], [40, 1, 178]);
      await look('fan', [11.5, 1, 130.5], [11, 1, 134]);
      await look('tap', [36.5, 31, 8.5], [34, 32, 5]);
      const G = await import('/src/giantland.js'); const c = G.CRUMBS[0];
      await look('crumb', [c[0] + 0.5, c[1], c[2] + 2.5], c);
      return out;
    });
    t.ok(words.remote === 'Ride!' && words.fan === 'Fan on!' && words.tap === 'Turn tap!' && words.crumb === 'Pick up!', `the big button says "${words.remote}" at the remote, "${words.fan}" at the fan, "${words.tap}" at the tap, "${words.crumb}" at a crumb`);
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
