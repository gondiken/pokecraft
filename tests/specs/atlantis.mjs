// T41: the Atlantis type and the Sunken City in the Pirate Seas (plans/T41.md). Part 1 runs in Node on glowfish.js alone (the net, the
// three kinds of fish, the lights, 60 fps against 20 fps). Part 2 runs in the browser: A. the type (data, shapes with their rune lines,
// moves, effects, sounds, chart, the frame), B. terrain for three seeds (the old sea unchanged, the crater, the bell, the palace, every
// district reachable by swimming, every dead end traps a darter), C. swimming with real Player physics, D. the real part: each kind of
// fish caught by its own trick and not by the wrong one, 60 / 20 fps the same, E. lights, lanterns, saved keys, the gate, Queen Coralia,
// the star, losing, a reload, F. old Pirate Seas saves convert, G. iPad, H. two browsers. ATLANTIS_ONLY=node|data|terrain|swim|play|lights|old|ipad|pair|shots
// runs part of it. Screenshots: tests/screenshots/t41-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, waitFor as waitFor0, seedSave, playBattle } from '../helpers.mjs';

const waitFor = (page, fn, arg, ms = 120000) => waitFor0(page, fn, arg, ms);
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const ONLY = process.env.ATLANTIS_ONLY || '';
const want = part => !ONLY || ONLY === part;
const src = f => import(pathToFileURL(path.join(ROOT, 'src', f)).href);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id);
const toasts = page => page.evaluate(() => { window.__toasts = []; const g = window.pokecraft, f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; });
const said = (page, re) => page.evaluate(src => window.__toasts.some(m => new RegExp(src).test(m)), re.source);
const shot = async (page, name) => { await page.evaluate(() => window.pokecraft.ui.toastBox?.replaceChildren()); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(SHOTS, `t41-${name}.png`), timeout: 180000 }); console.log(`  screenshot t41-${name}.png`); };
// Run `n` game steps of dt: the player's physics and the live parts (the page's frame loop cannot interleave); `stop` ends early.
const STEP = `(g, dt, n, stop) => { const old = g.playing; g.playing = () => true; let i = 0; try { for (; i < n; i++) { g.player.update(dt); g.gymLive.update(dt); if (stop && stop()) break; } } finally { g.playing = old; } return i; }`;
const PLAY = `(g, fn) => { const old = g.playing; g.playing = () => true; try { return fn(); } finally { g.playing = old; } }`; // run fn with the game "playing" (no pointer lock in a test)
const helpers = page => page.evaluate(([a, b]) => { window.__step = eval(a); window.__play = eval(b); }, [STEP, PLAY]);

// the Champion goes into the Swirl and through the Atlantis frame (it arrives in the diving bell)
async function intoAtlantis(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  await toasts(page);
  const info = await page.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'atlantis'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    const c = f.cloth[Math.floor(f.cloth.length / 2)], b = { x: c[0], y: c[1], z: c[2], id: g.world.get(...c) };
    return { id: b.id, prompt: g.portal.prompt(b, 'click or E'), action: g.portal.action(b), used: g.portal.use(b) };
  });
  await placeIs(page, 'pirate');
  await helpers(page);
  return info;
}

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (want('node')) await nodePart(t);
  if (ONLY === 'node') return;
  if (ONLY === 'pair') return pairPart({ browser, base, t });
  const page = await openGame(browser, base);
  if (want('data')) await dataPart(page, t);
  if (want('terrain')) await terrainPart(page, t);
  const needsGame = ['swim', 'play', 'lights', 'shots'].some(want) || !ONLY;
  if (needsGame) {
    await newGame(page, 0);
    const info = await intoAtlantis(page);
    t.ok(info.id === 144 && /Pirate Seas · Atlantis/.test(info.prompt) && info.used, `the Atlantis frame is ready and says "${info.prompt}"`);
    if (want('swim')) await swimPart(page, t);
    if (want('play')) await playPart(page, t);
    if (want('shots') || !ONLY) await shotsPart(page, t);
    if (want('lights')) await lightsPart(page, t);
    t.ok(!page.errors.length, `no page errors (Atlantis) ${page.errors.slice(0, 3).join('; ')}`);
  }
  await page.context().close();
  if (want('old')) await oldPart(browser, base, t);
  if (want('ipad')) await ipadPart(browser, base, t);
  if (!ONLY) await pairPart({ browser, base, t });
}

/* ======================================================= Node: glowfish.js on its own ======================================================= */

async function nodePart(t) {
  const G = await src('glowfish.js'), { FISH } = G;
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
  // 1. the lunge: 1.5 blocks for a tap, 4 for a long coil, in between by how long you held
  t.ok(near(G.lungeLength(0), 1.5) && near(G.lungeLength(0.9), 4) && near(G.lungeLength(5), 4) && near(G.lungeLength(0.45), 2.75), `1: a lunge is 1.5 blocks for a tap, 4 for a full coil, 2.75 for half (${G.lungeLength(0)}, ${G.lungeLength(0.45)}, ${G.lungeLength(0.9)})`);
  // 2. the lights: 12 saved keys, 4 per district, two school fish make one light
  const st = G.lightState({ beaten: [G.lightKey(1), G.lightKey(2), G.lightKey(5), 'tower:guard1', G.lightKey(12)] });
  t.ok(st.lit.join() === '2,1,1' && st.total === 4 && !st.done && G.lightState({ beaten: Array.from({ length: 12 }, (_, i) => G.lightKey(i + 1)) }).done, `2: lightState reads the keys (${st.lit}); 12 keys = done`);
  t.ok(G.lightsFor('school', 8) === 4 && G.lightsFor('school', 1) === 0 && G.lightsFor('shy', 3) === 3 && G.fishFor('school', 4) === 8 && G.nextLights({ beaten: [G.lightKey(5)] }, 1, 2).join() === `${G.lightKey(6)},${G.lightKey(7)}`, '2: one light per shy fish and per darter, two school fish make one light, nextLights skips the lit ones');
  // 3. shy fish: a closed form of the clock. a wobble, then out (S.run blocks at S.speed, then drifting), home after stay + back
  const S = FISH.shy, home = [10, 5, 10], dir = [0, 0, 1], pop = { t0: 2, dir };
  const at = u => G.shyAt(home, 2 + u, pop), tr = S.run / S.speed;
  t.ok(G.shyAt(home, 5, null).state === 'home' && at(S.wobble / 2).state === 'wobble' && !at(S.wobble / 2).catchable && at(S.wobble / 2).pos === home, '3: a fish in its jar stays home; a bumped jar wobbles first and cannot be caught yet');
  const s1 = at(S.wobble + tr / 2), s2 = at(S.wobble + tr + 0.3), s3 = at(S.wobble + S.stay - 0.1), s4 = at(S.wobble + S.stay + S.back / 2), s5 = at(S.wobble + S.stay + S.back + 0.1);
  t.ok(s1.state === 'out' && near(s1.pos[2] - 10, S.run / 2, 0.01) && near(s2.pos[2] - 10, S.run + S.drift * 0.3, 0.01) && s3.catchable && s4.state === 'back' && s4.pos[2] < s3.pos[2] && s5.state === 'home' && s5.over, `3: it shoots out at ${S.speed} blocks a second to ${S.run} blocks, drifts on, swims back home after ${S.stay} s (${s1.pos[2] - 10}, ${s2.pos[2] - 10}, ${s4.pos[2] - 10})`);
  const open = (x, y, z) => !(x > 9 && x < 11 && z > 10 && z < 14); // a wall right in front of the fish
  const pd = G.popDir(home, [10, 5, 6], 0, open);
  let clear = true; for (let s = 0.5; s <= 6.8; s += 0.5) if (!open(10 + pd[0] * s, 5 + pd[1] * s, 10 + pd[2] * s)) clear = false;
  t.ok(clear && Math.abs(Math.hypot(pd[0], pd[2]) - 0.96) < 0.01, `3: a popped fish never shoots into a wall (it turns on until the way is open): ${pd.map(v => v.toFixed(2))}`);
  // 4. the school: 8 fish round a point that breathes between 0.6 and 2.2; a lunge catches everyone inside the net
  const spec = { a: [0, 0], b: [10, 10], y: () => 8 };
  const SC = FISH.school, tight = SC.first + SC.cycle, spread = SC.first + 1.5 * SC.cycle;
  t.ok(near(G.schoolRadius(tight), SC.rMin, 1e-9) && near(G.schoolRadius(spread), SC.rMax, 1e-9) && near(G.schoolRadius(0), SC.rMin, 1e-9) && near(G.schoolRadius(SC.first / 2), SC.rMax, 1e-9) && near(G.schoolRadius(SC.first), SC.rMin, 1e-9), `4: the school breathes between ${SC.rMin} and ${SC.rMax} (the first breath is slower: ${SC.first} s, then ${SC.cycle} s, no jump between them)`);
  const caught = tt => { const c = G.schoolCentre(spec, tt); let n = 0; for (let i = 0; i < FISH.school.n; i++) if (G.inNet(c, G.schoolFish(spec, tt, i))) n++; return n; };
  t.ok(caught(tight) === 8 && caught(spread) <= 2, `4: a net on a tight school catches all 8, on a spread one ${caught(spread)} (tight ${caught(tight)})`);
  let few = 0, many = 0; for (let k = 0; k < 40; k++) { const tt = 6 + k * 0.075; const n = caught(tt); if (n >= 6) many++; if (n <= 2) few++; }
  t.ok(many >= 5 && few >= 10, `4: over one breath the net catches 6 or more ${many} times of 40 and 2 or fewer ${few} times (a tight school is the moment)`);
  // 5. the darter: faster than you swim, never caught in open water
  const grid = (x0, x1, z0, z1) => (x, y, z) => x > x0 && x < x1 && z > z0 && z < z1;
  const chase = (openF, from, plStart, secs, dtFrame, trigger = 7.2) => { // a player who swims at the fish, kicks, and lunges whenever it is close
    const D = new G.Darter({ id: 'd', index: 3, home: from, y: 3.3 }), pl = { x: plStart[0], y: 3.3, z: plStart[1] }, h = FISH.step;
    let acc = 0, t0 = 0, lunge = null, cool = 0, kick = null, caughtAt = -1, minD = 99, stuck = 0;
    for (let f = 0; f < secs / dtFrame && caughtAt < 0; f++) {
      acc += dtFrame;
      while (acc >= h && caughtAt < 0) {
        acc -= h; t0 += h; cool = Math.max(0, cool - h);
        const dx = D.pos[0] - pl.x, dz = D.pos[1] - pl.z, d = Math.hypot(dx, dz) || 1;
        minD = Math.min(minD, d);
        if (!lunge && d < trigger && cool <= 0) lunge = { t: 0, ux: dx / d, uz: dz / d };
        if (lunge) { // a full lunge of 4 blocks in 0.25 s
          pl.x += lunge.ux * 16 * h; pl.z += lunge.uz * 16 * h; lunge.t += h;
          const cx = pl.x + lunge.ux * 1.2, cz = pl.z + lunge.uz * 1.2;
          if (Math.hypot(D.pos[0] - cx, D.pos[1] - cz) <= FISH.net.r) caughtAt = t0;
          if (lunge.t >= 0.25) { lunge = null; cool = FISH.lunge.rest; }
        } else { // swim at it at 3.2 blocks a second, plus a kick now and then
          if (!kick && Math.floor(t0 * 2) !== Math.floor((t0 - h) * 2)) kick = { t: 0 };
          let v = 3.2;
          if (kick) { v += 7 * (1 - kick.t / 0.8) ** 2; kick.t += h; if (kick.t >= 0.8) kick = null; }
          pl.x += (dx / d) * v * h; pl.z += (dz / d) * v * h;
        }
        D.step(h, [pl.x, 3.3, pl.z], openF);
        if (D.state === 'stuck') stuck += h;
      }
    }
    return { caughtAt, minD, stuck, state: D.state, pos: D.pos.map(v => +v.toFixed(2)) };
  };
  const wide = grid(-2000, 2000, -2000, 2000);
  const ow = chase(wide, [0, 0], [-8, 0], 40, 1 / 60), ow20 = chase(wide, [0, 0], [-8, 0], 40, 1 / 20);
  t.ok(ow.caughtAt < 0 && ow20.caughtAt < 0 && ow.stuck === 0, `5: in open water a darter is never caught in 40 s, with kicks and a full lunge each time it is within 7 blocks (closest ${ow.minD.toFixed(1)} blocks; at 20 fps ${ow20.minD.toFixed(1)})`);
  t.ok(ow.minD > 2.4 && ow20.minD > 2.4, `5: it flees at 7 blocks a second from 7 blocks away: after a full lunge it is still beyond the net's reach (1.2 + 1.1 = 2.3 blocks ahead of you), closest ${ow.minD.toFixed(2)}`);
  // a dead end: a 3 wide corridor closed at x = 12; the fish at the far end; the player comes in from the mouth
  const dead = grid(-200, 12, -1.5, 1.5);
  const ran = chase(dead, [10, 0], [2, 0], 12, 1 / 60, 5);
  t.ok(ran.caughtAt > 0 && ran.caughtAt < 12, `5: a darter cornered in a dead end is caught (at ${ran.caughtAt.toFixed(2)} s; it trembled ${ran.stuck.toFixed(2)} s)`);
  const D2 = new G.Darter({ id: 'd', index: 0, home: [11, 0], y: 3.3 });
  let was = null, moved = 0; for (let i = 0; i < 120 * 1.4; i++) { D2.step(FISH.step, [5.5, 3.3, 0], dead); if (i === 60) was = [...D2.pos]; if (i > 60) moved += Math.hypot(D2.pos[0] - was[0], D2.pos[1] - was[1]); }
  t.ok(D2.state === 'stuck' && moved < 1e-6, `5: cornered it stands still and trembles (${D2.state}), for ${FISH.darter.stuck} s, then bolts past you`);
  let bolted = false; for (let i = 0; i < 120 * 4; i++) { D2.step(FISH.step, [5.5, 3.3, 0], dead); if (D2.state === 'bolt') bolted = true; }
  t.ok(bolted, '5: after the 2.5 s it bolts, so a missed catch is never the end');
  // 60 fps against 20 fps: the same sub-steps give the same fish
  const walk = dtFrame => { const D = new G.Darter({ id: 'w', index: 1, home: [0, 0], y: 3.3 }); let acc = 0; for (let f = 0; f < 10 / dtFrame; f++) { acc += dtFrame; while (acc >= FISH.step) { acc -= FISH.step; D.step(FISH.step, [30, 3.3, 30], wide); } } return D.pos.map(v => +v.toFixed(3)).join(); };
  t.ok(walk(1 / 60) === walk(1 / 20), `5: 60 and 20 frames a second move a wandering darter the same (${walk(1 / 60)})`);
  // 6. the net's reach: fish in front of the player at 5.1 blocks is inside a full lunge, at 6.5 it is not
  const eye = [0, 5, 0], look = [0, 0, 1], c0 = G.netCentre(eye, look);
  t.ok(near(c0[2], 1.2) && G.inNet([0, 5, 1.2 + 4 + 1.0], [0, 5, 6.2]) && !G.inNet(G.netCentre(eye, look), [0, 5, 6.5]), '6: the net sits 1.2 blocks in front of the eyes and has a radius of 1.1');
}

/* ======================================================= browser: A. the type ======================================================= */

async function dataPart(page, t) {
  const A = await page.evaluate(async () => {
    const S = await import('/src/species.js'), R = await import('/src/realms.js'), FX = await import('/src/fxrecipes.js'), SH = await import('/src/shapes.js');
    const TR = await import('/src/traits.js'), PW = await import('/src/pictureworlds.js'), BK = await import('/src/book.js'), { sound } = await import('/src/sound.js'), BL = await import('/src/blocks.js');
    const ids = Object.keys(S.SPECIES).filter(i => S.SPECIES[i].type === 'atlantis');
    const shapes = [...new Set(ids.map(i => S.SPECIES[i].model.shape))].sort();
    const otherShapes = new Set(Object.values(S.SPECIES).filter(s => s.type !== 'atlantis').map(s => s.model.shape));
    const gear = ids.map(id => { const m = S.buildModel(id), kinds = new Set(); m.traverse(o => { if (o.userData.gear) kinds.add(o.userData.gear); }); let glowing = 0; m.traverse(o => { if (o.userData.gear === 'rune' && o.material.emissive && o.material.emissive.getHex() > 0) glowing++; }); return [id, [...kinds].join(), glowing]; });
    const mv = id => S.MOVES[id];
    const moves = { jarbonk: [40, 1], tiletoss: [80, 0.85], runeglow: [50, 1], stoneroar: [0, 1], ancientecho: [0, 1], sunkenbell: [90, 0.9], mosaicstorm: [30, 1] };
    const moveBad = Object.entries(moves).filter(([id, [p, a]]) => !mv(id) || mv(id).type !== 'atlantis' || mv(id).power !== p || mv(id).acc !== a).map(([id]) => id);
    const learns = id => S.SPECIES[id].learn.map(([l, m]) => `${l}:${m}`);
    const evo = id => S.SPECIES[id].evolve && `${S.SPECIES[id].evolve.level}>${S.SPECIES[id].evolve.into}`;
    const eff = S.effectiveness, keys = Object.keys(S.TYPE_COLORS);
    const own = keys.filter(d => eff('atlantis', d) !== 1).map(d => `${d}:${eff('atlantis', d)}`).sort().join();
    const onIt = keys.filter(a => a !== 'atlantis' && eff(a, 'atlantis') !== 1).map(a => `${a}:${eff(a, 'atlantis')}`).sort().join();
    const old = { fire: eff('fire', 'grass'), pirate: eff('pirate', 'ball'), cyber: eff('cyber', 'metal'), water: eff('water', 'fire'), normal: eff('normal', 'ghost'), cross: eff('electric', 'pirate') };
    const spawns = Object.values(S.SPAWNS).flat().filter(e => ids.includes(e[0])).length;
    const rs = R.REALMS.pirate.spawns, inRealm = ids.every(id => rs.atlantis.some(e => e[0] === id));
    const rows = ids.flatMap(id => BK.spawnInfo(id).map(r => r.name)).filter((n, i, a) => a.indexOf(n) === i);
    const bl = ['AT_BRICK', 'AT_MOSAIC', 'AT_COLUMN', 'AT_JAR', 'AT_LANTERN_OFF', 'AT_LANTERN_ON', 'AT_DOME', 'AT_RIM_CORAL', 'AT_LAMP_OFF', 'AT_LAMP_ON'].map(n => [n, BL.B[n], !!BL.BLOCKS[BL.B[n]]]);
    return {
      ids, shapes, ownShapes: shapes.every(s => !otherShapes.has(s)), registered: shapes.every(s => !!SH.SHAPES[s]), gear,
      moveBad, sw: [mv('runeglow').priority, mv('stoneroar').fx, mv('ancientecho').fx, mv('mosaicstorm').fx, mv('mosaicstorm').sig, mv('sunkenbell').fx, mv('sunkenbell').sig],
      big: [['runeward', 'shield'], ['citywakes', 'field'], ['lastlight', 'lastword']].map(([id, k]) => mv(id)?.big && mv(id).fx.kind === k && mv(id).type === 'atlantis'),
      evo: ids.map(id => `${id}:${evo(id) ?? '-'}`).join(), sig: [learns('guardlion').includes('32:sunkenbell'), learns('mosaicoil').includes('30:mosaicstorm')],
      sigFx: !!FX.SIG.sunkenbell && !!FX.SIG.mosaicstorm, fx: [FX.TRAVEL.atlantis !== FX.TRAVEL.normal, FX.IMPACT.atlantis !== FX.IMPACT.normal, FX.FX_COLORS.atlantis !== FX.FX_COLORS.normal],
      sounds: ['fx:atlantis', 'atcatch', 'atlight', 'atkick', 'atlunge', 'atwobble'].map(n => sound.has(n)), clash: Object.keys(S.MOVES).filter(m => sound.has(m) && S.MOVES[m].type === 'atlantis'),
      ride: TR.TRAITS.rideable.species.guardlion, spawns, inRealm, rows, ready: PW.pictureWorld('atlantis')?.ready, name: PW.fullName(PW.pictureWorld('atlantis')), secret2: !!PW.pictureWorld('secret2'),
      stars: PW.PICTURE_WORLDS.length, own, onIt, old, own7: S.SPECIES.runestone.evolve === undefined && !ids.some(i => S.SPECIES[i].evolve?.into === 'runestone'),
      wool: BL.WOOL.atlantis, bl, noFish: !ids.some(i => /fish|crab|sailor/i.test(S.SPECIES[i].name)), types: keys.length,
      realm: { size: R.REALMS.pirate.size, version: R.REALMS.pirate.version, convert: R.REALMS.pirate.convert, uw: R.REALMS.pirate.look.underwater },
      conv: R.convertRealmEdits([[5 + 224 * (7 + 224 * 3), 9], [223 + 224 * (223 + 224 * 40), 4], [50, 3], [5 + 224 * (7 + 224 * 48), 1]], [224, 224], [320, 224]),
    };
  });
  t.ok(A.ids.join() === 'jarling,grandurnling,statuecub,guardlion,tilesnek,mosaicoil,runestone', `seven Atlantis creatures (${A.ids})`);
  t.ok(A.evo === 'jarling:26>grandurnling,grandurnling:-,statuecub:28>guardlion,guardlion:-,tilesnek:27>mosaicoil,mosaicoil:-,runestone:-' && A.own7, `three families of two and a single-stage 7th (${A.evo})`);
  t.ok(A.shapes.join() === 'runestone,stonelion,tilesnake,urn' && A.ownShapes && A.registered, `four own shapes used by no other type (${A.shapes})`);
  t.ok(A.gear.every(([, k, n]) => k === 'rune' && n >= 3) && A.noFish, `every model has glowing teal rune lines (${A.gear.map(g => `${g[0]}=${g[2]}`).join(' ')}), none is a fish, a crab or a sailor`);
  t.ok(!A.moveBad.length && A.sw[0] === 1 && A.sw[1]?.kind === 'lower' && A.sw[2]?.kind === 'raise' && A.sw[3]?.kind === 'multi' && A.sw[3].min === 2 && A.sw[3].max === 5 && A.sw[4] && A.sw[5]?.kind === 'flinch' && A.sw[6], `the seven moves are as planned (${A.moveBad})`);
  t.ok(A.big.every(Boolean) && A.sig.every(Boolean) && A.sigFx, 'Rune Ward (shield), The City Wakes (field), Last Light (lastword); Sunken Bell at 32 and Mosaic Storm at 30 with effects');
  t.ok(A.fx.every(Boolean) && A.sounds.every(Boolean) && !A.clash.length, `own attack effects, colours and sounds, no move named like a sound (${A.fx}; ${A.sounds}; ${A.clash})`);
  t.ok(A.ride === 'land' && A.wool === 204, 'Guardlion can be ridden on land; wool 204');
  t.ok(A.bl.every(([, id, ok]) => id >= 205 && id <= 214 && ok), `blocks 205-214 are defined (${A.bl.map(b => b[1])})`);
  t.ok(A.spawns === 0 && A.inRealm && A.rows.includes('The Sunken City'), `in no SPAWNS table, every one in the Pirate Seas' Atlantis table; Book rows ${A.rows}`);
  t.ok(A.ready === true && A.name === 'Pirate Seas · Atlantis' && !A.secret2 && A.stars === 12 && A.types >= 38, `the Atlantis frame (the old secret2) is ready, "${A.name}", still 12 stars, ${A.types} types`);
  t.ok(A.own === 'pirate:2,time:2,camo:2,atlantis:0.5'.split(',').sort().join() && A.onIt.includes('mind:2') && A.onIt.includes('ninja:2') && A.onIt.includes('pirate:0.5') && A.onIt.includes('ball:0.5') && !/water|fire/.test(A.onIt), `chart: Atlantis hits pirate, camo and time; mind and ninja hit it; pirate and ball resist; water stays neutral (${A.own} / ${A.onIt})`);
  t.ok(A.old.fire === 2 && A.old.pirate === 2 && A.old.cyber === 2 && A.old.water === 2 && A.old.normal === 0 && A.old.cross === 2, 'the old chart cells are as they were');
  t.ok(A.realm.size.join() === '320,224' && A.realm.version === 2 && A.realm.convert[1].join() === '224,224' && A.realm.uw === true, `the Pirate Seas are 320 x 224, version 2, converting version 1 (${JSON.stringify(A.realm)})`);
  t.ok(JSON.stringify(A.conv) === JSON.stringify([[5 + 320 * (7 + 224 * 3), 9], [223 + 320 * (223 + 224 * 40), 4], [50, 3]]), `old edits move to the new indexes (the one above the map is dropped): ${JSON.stringify(A.conv)}`);
  // the portraits of the seven creatures, for the owner
  const grid = await page.evaluate(async ids => {
    const { portrait } = await import('/src/ui.js');
    const W = 300, H = 250, cv = document.createElement('canvas');
    cv.width = W * 4; cv.height = H * 2;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#2a7a90'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < ids.length; i++) {
      const img = new Image(); img.src = portrait(ids[i], W, H);
      await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
      ctx.drawImage(img, (i % 4) * W, Math.floor(i / 4) * H);
    }
    return cv.toDataURL();
  }, A.ids);
  fs.writeFileSync(path.join(SHOTS, 't41-creatures.png'), Buffer.from(grid.split(',')[1], 'base64'));
  console.log('  screenshot t41-creatures.png');
  t.ok(grid.length > 20000, 'portrait grid drawn');
}

/* ======================================================= browser: B. terrain ======================================================= */

async function terrainPart(page, t) {
  const B = await page.evaluate(async () => {
    const { World } = await import('/src/world.js'), R = await import('/src/realms.js'), { B, isSolid } = await import('/src/blocks.js'), L = await import('/src/atlantisland.js'), G = await import('/src/glowfish.js');
    await import('/src/pirateparts.js');
    const def = R.REALMS.pirate, out = [];
    const hash = (w, W) => { let h = 0; for (let y = 0; y < 48; y++) for (let z = 0; z < 224; z++) for (let x = 0; x < W; x++) h = (h * 31 + w.data[w.index(x, y, z)]) | 0; return h; };
    const hashAll = w => { let h = 0; for (let i = 0; i < w.data.length; i++) h = (h * 31 + w.data[i]) | 0; return h; };
    for (const seed of [1, 4242, 294331207]) {
      const t0 = performance.now();
      const w = new World(seed, null, null, def.size, def); w.generate();
      const ms = performance.now() - t0;
      const w2 = new World(seed, null, null, def.size, def); w2.generate();
      const oldDef = { ...def, size: [224, 224] }, wo = new World(seed, null, null, oldDef.size, oldDef); wo.generate();
      const probs = [], bad = m => probs.push(m);
      const A = w.atlantis, C = L.CITY;
      const sameOld = hash(wo, 224) === hash(w, 224) && wo.pirate.cannons.length === w.pirate.cannons.length;
      const free = (x, y, z) => !w.isSolid(Math.floor(x), Math.floor(y), Math.floor(z)) && !w.isSolid(Math.floor(x), Math.floor(y) + 1, Math.floor(z));
      // the crater: flat floor at y 1, water to y 12 above it (outside the buildings)
      let floorOk = 0, floorBad = 0;
      for (let a = 0; a < 60; a++) { const ang = a / 60 * 6.283, r = 36; const x = Math.floor(C.x + Math.cos(ang) * r), z = Math.floor(C.z + Math.sin(ang) * r); if (w.get(x, 6, z) !== B.WATER) continue; /* a building stands here */ if (w.get(x, 1, z) !== 0 && w.get(x, 2, z) === B.WATER && w.get(x, 12, z) === B.WATER && w.ground[x + z * w.W] === 1) floorOk++; else floorBad++; }
      if (floorBad) bad(`crater floor ${floorBad} columns`);
      let coral = 0; for (let x = 224; x < 316; x++) for (let z = 66; z < 158; z++) for (let y = 3; y < 12; y++) if (w.get(x, y, z) === B.AT_RIM_CORAL) coral++;
      // the bell: dry, a way back with an arrival inside it, a door out
      const bl = L.BELL, dry = [];
      for (let x = bl.x0 + 1; x < bl.x1; x++) for (let z = bl.z0 + 1; z < bl.z1; z++) for (let y = bl.floor + 1; y < bl.roof; y++) if (w.get(x, y, z) === B.WATER) dry.push(`${x},${y},${z}`);
      const stand = w.arrivals.atlantis, standOk = !w.isSolid(Math.floor(stand[0]), Math.floor(stand[1]), Math.floor(stand[2])) && !w.isSolid(Math.floor(stand[0]), Math.floor(stand[1]) + 1, Math.floor(stand[2])) && w.get(Math.floor(stand[0]), Math.floor(stand[1]) - 1, Math.floor(stand[2])) === B.AT_BRICK;
      const doorOpen = [0, 1, 2].every(k => [5, 6, 7].every(y => w.get(bl.door.x, y, bl.door.z[0] + k) === B.AIR));
      const doorKey = w.doors.find(d => d.key === 'atlantis');
      // the palace: dry inside, a glass dome, a gate in the tunnel, the Boss on a stand
      const P = L.PALACE, dryP = [];
      for (const [u, v, y] of [[0, 0, 5], [3, 3, 6], [-4, 0, 7], [0, -5, 4], [5, 0, 5], [-6, 0, 5], [-10, 0, 5], [-8, 1, 4]]) if (w.get(C.x + u, y, C.z + v) !== B.AIR) dryP.push(`${u},${v},${y}:${w.get(C.x + u, y, C.z + v)}`);
      let dome = 0; for (let x = C.x - 10; x <= C.x + 10; x++) for (let z = C.z - 10; z <= C.z + 10; z++) for (let y = 4; y <= 12; y++) if (w.get(x, y, z) === B.AT_DOME) dome++;
      const gate = A.palace.gate.map(([x, y, z]) => w.get(x, y, z));
      const boss = A.boss, bstand = w.get(Math.floor(boss.pos[0]), Math.floor(boss.pos[1]) - 1, Math.floor(boss.pos[2]));
      const restDry = w.rests.some(r => Math.abs(r[0] - (C.x + 0.5)) < 0.1 && w.get(Math.floor(r[0]), Math.floor(r[1]), Math.floor(r[2])) === B.AIR);
      // the lanterns and lamps are dark, the jars are in place, the fish have room
      const lan = A.districts.map(d => [d.lantern.cells.length, d.lantern.cells.every(([x, y, z]) => w.get(x, y, z) === B.AT_LANTERN_OFF), d.lamps.length, d.lamps.every(([x, y, z]) => w.get(x, y, z) === B.AT_LAMP_OFF)]);
      const jarsOk = A.jars.every(j => w.get(...j.cell) === B.AT_JAR && free(...j.home)) && A.jars.length === 8 && A.shy.length === 4;
      const darters = A.darters.map(d => free(d.home[0], d.y, d.home[1]) && w.get(Math.floor(d.home[0]), Math.floor(d.y) + 1, Math.floor(d.home[1])) !== 0 ? 1 : 1).length;
      // a 3D swim: every place that matters can be reached from the bell door through water (a body that is 0.6 wide and 1.8 tall)
      const key = (x, y, z) => `${x},${y},${z}`, seen = new Set(), q = [], start = [bl.door.x + 1, 5, bl.door.z[0] + 1];
      const okc = (x, y, z) => y >= 2 && y <= 12 && x >= 224 && x < 319 && z > 0 && z < 223 && !w.isSolid(x, y, z) && !w.isSolid(x, y + 1, z);
      seen.add(key(...start)); q.push(start);
      while (q.length) { const [x, y, z] = q.shift(); for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const n = [x + dx, y + dy, z + dz]; if (seen.has(key(...n)) || !okc(...n)) continue; if (Math.hypot(n[0] - C.x, n[2] - C.z) > 50) continue; seen.add(key(...n)); q.push(n); } }
      const reach = (x, y, z) => seen.has(key(Math.floor(x), Math.floor(y), Math.floor(z)));
      const unreached = [];
      for (const d of A.districts) { const c = d.lantern.centre, b = d.lantern.box; if (![[b.x0 - 1, c[1], c[2]], [b.x1 + 1, c[1], c[2]], [c[0], b.y1 + 1, c[2]]].some(p => reach(...p))) unreached.push(`lantern ${d.id}`); }
      for (const j of A.jars) if (!reach(...j.home)) unreached.push(`jar ${j.id}`);
      for (const d of A.darters) if (!reach(d.home[0], d.y, d.home[1])) unreached.push(d.id);
      for (const i of [0, 1, 2, 3, 4, 5, 6, 7]) { const tt = 6 + i; const c = G.schoolCentre(A.school, tt); if (!reach(...c)) unreached.push(`school@${tt}`); }
      const gm = A.palace.mouth; if (![3, 4, 5, 6].some(y => reach(gm[0], y, gm[1]))) unreached.push('palace gate');
      for (const [x, z] of A.bubbles) if (![3, 6, 11].every(y => reach(x, y, z))) unreached.push(`bubbles ${x}`);
      if (!reach(L.WHIRL.x, 8, L.WHIRL.z)) unreached.push('whirlpool');
      // every dead end really traps a darter: the fish at the deep end, the player at the mouth (all 7)
      const trapped = [];
      for (const de of A.deadEnds) {
        const D = new G.Darter({ id: de.id, index: 0, home: de.deep, y: 3.3 }), pl = [de.mouth[0] + de.dir[0] * -0.5, 3.3, de.mouth[1] + de.dir[1] * -0.5];
        const open = (x, y, z) => !w.isSolid(Math.floor(x), Math.floor(y), Math.floor(z));
        let was = null, moved = 0, first = -1;
        for (let i = 0; i < 120 * 3; i++) { D.step(G.FISH.step, pl, open); if (D.state === 'stuck' && first < 0) first = i / 120; if (first >= 0 && i / 120 > first + 0.3 && i / 120 < first + Math.min(2.0, G.FISH.darter.stuck - 0.05)) { if (!was) was = [...D.pos]; moved = Math.max(moved, Math.hypot(D.pos[0] - was[0], D.pos[1] - was[1])); } }
        trapped.push([de.id, first >= 0 && first < 1.5, +moved.toFixed(2)]);
      }
      // closed corridors and houses: all in the gardens
      const lifts = w.lifts.filter(l => /bubbles/.test(l.id)).map(l => [l.x[1] - l.x[0], l.y[0], l.y[1]]);
      const sunk = [w.sinkAt({ x: L.WHIRL.x + 0.5, y: 8, z: L.WHIRL.z + 0.5 }), w.sinkAt({ x: 100, y: 8, z: 100 })];
      const dive = [w.deepAt({ x: C.x + 0.5, y: 6, z: C.z + 0.5 }), w.deepAt({ x: 100, y: 6, z: 100 }), w.deepAt({ x: 180, y: 8, z: 150 }), w.deepAt({ x: C.x + 0.5, y: 20, z: C.z + 0.5 })];
      const keeps = w.keeps.filter(k => /^atlantis-/.test(k.name)).map(k => k.name + (k.rideIn ? '*' : '')).sort().join();
      const sunken = [w.sunkenY(240.5, 104.5, { type: 'atlantis' }), w.sunkenY(240.5, 104.5, { type: 'water' }), w.sunkenY(150, 100, { type: 'atlantis' }), w.sunkenY(251.5, 112.5, { type: 'atlantis' })].map(v => (v === undefined ? 'u' : v)); // (u = not for this creature, the last: inside the lantern's pedestal: no room)
      const dim = [L.dimAt(250, 5, 112, [0, 0, 0]), L.dimAt(250, 5, 112, [4, 0, 0]), L.dimAt(150, 5, 112, [0, 0, 0]), L.dimAt(C.x, 5, C.z, [0, 0, 0]), L.dimAt(236, 5, 112, [0, 0, 0])];
      const bio = [w.biome(C.x, C.z + 20), w.biome(150, 100), w.biome(168, 150)];
      const people = w.bosses.map(b => [b.id, b.crew.length]);
      // nobody is stuck in a wall: every Boss, helper and rest spot has room for a body, and something to stand on or water around it
      const roomy = ([x, y, z]) => !w.isSolid(Math.floor(x), Math.floor(y), Math.floor(z)) && !w.isSolid(Math.floor(x), Math.floor(y) + 1, Math.floor(z));
      const stuckAt = [...w.bosses.flatMap(b => [['boss ' + b.id, b.pos], ['rest ' + b.id, b.rest], ...b.crew.map(c => ['crew ' + b.id + c.i, c.pos])]), ...w.rests.map((r, i) => ['rest' + i, r])].filter(([, p]) => !roomy(p)).map(([n]) => n);
      out.push({ seed, ms: Math.round(ms), same: hashAll(w) === hashAll(w2), sameOld, floorOk, coral, dry: dry.length, standOk, doorOpen, doorKey: !!doorKey, doorSurface: doorKey?.surface.length, dryP, dome, gate: gate.join(), bstand, restDry, lan, jarsOk, darters, unreached, trapped, lifts, sunk, dive, keeps, sunken, dim, bio, people, stuckAt, de: A.deadEnds.length, reached: seen.size, probs });
    }
    return out;
  });
  for (const b of B) {
    const L = `seed ${b.seed}`;
    t.ok(b.same && b.probs.length === 0, `${L}: the same world twice, no problems (${b.probs.slice(0, 3)}) in ${b.ms} ms`);
    t.ok(b.sameOld, `${L}: the Pirate Seas inside x < 224 are block for block the same as before (the 224 x 224 sea hashes equal)`);
    t.ok(b.floorOk >= 30 && b.coral >= 20, `${L}: the crater floor is y 1 with water to y 12 above it all round, glowing coral on the rim (${b.coral} blocks)`);
    t.ok(b.dry === 0 && b.standOk && b.doorOpen && b.doorKey && b.doorSurface === 12, `${L}: the diving bell is dry, the arrival is in it, there is a way back and a door out`);
    t.ok(b.dryP.length === 0 && b.dome > 150 && b.gate === '211,211,211,211,211,211,211,211,211' && b.bstand === 146 && b.restDry, `${L}: the palace is dry under a glass dome (${b.dome} glass), the gate is shut, the Boss is on a stand (${b.dryP})`);
    t.ok(b.lan.every(l => l[0] === 27 && l[1] && l[2] === 8 && l[3]) && b.jarsOk && b.de === 7, `${L}: three dark lanterns with 8 dark lamps each, 8 jars (4 with a fish), 7 dead ends`);
    t.ok(b.unreached.length === 0, `${L}: every lantern, jar, darter home, the school's path, the palace gate, the bubbles and the whirlpool can be swum to from the bell door (${b.reached} cells; not reached: ${b.unreached})`);
    t.ok(b.trapped.every(([, ok, moved]) => ok && moved < 0.2), `${L}: every dead end traps a darter within 1.5 s and it stays put: ${b.trapped.map(x => `${x[0]}${x[1] ? '' : '!'}`).join(' ')}`);
    t.ok(b.lifts.length === 6 && b.lifts.every(l => l[0] === 2 && l[1] === 2) && b.sunk[0] && !b.sunk[1], `${L}: six bubble columns carry you up, the whirlpool pulls you down`);
    t.ok(b.dive[0] && !b.dive[1] && !b.dive[2] && !b.dive[3], `${L}: dive swimming only in the crater (${b.dive})`);
    t.ok(b.keeps === 'atlantis-bell,atlantis-city*,atlantis-palace' && b.sunken[0] === 2 && b.sunken[1] === 'u' && b.sunken[2] === 'u' && b.sunken[3] === null, `${L}: keeps ${b.keeps}; a guardian stands on the city floor (${b.sunken})`);
    t.ok(b.dim[0] < b.dim[1] && b.dim[0] > 0.18 && b.dim[2] === 1 && b.dim[3] > b.dim[0] && b.dim[4] === 1 && b.bio[0] === 'atlantis' && b.bio[1] === 'pirateSea', `${L}: a dark district is dim, not black, and a lit one is bright; the sea outside is not touched; the crater has its own wild creatures (${b.dim.map(v => v.toFixed(2))}; ${b.bio})`);
    t.ok(b.stuckAt.length === 0, `${L}: nobody and no rest spot is inside a wall (${b.stuckAt})`);
    t.ok(b.people.map(p => p.join(':')).join() === 'pirate:3,atlantis:2', `${L}: Captain Squawk and Queen Coralia, with their crews (${b.people.map(p => p.join(':'))})`);
  }
}

/* ======================================================= browser: C. swimming ======================================================= */

async function swimPart(page, t) {
  const S = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player, step = window.__step, w = g.world;
    const place = (x, y, z, yaw = 0, pitch = 0) => { p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.keys = {}; p.kick = null; p.kickCool = 0; p.spaceWas = false; p.noSwim = false; step(g, 1 / 60, 2); p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.kick = null; };
    const out = {};
    // forward at 3.2 blocks a second, where you look, up and down too
    const run = (dt, secs, setup) => { place(258.5, 7, 100.5, 0, 0); const x0 = p.pos.clone(); setup?.(); step(g, dt, Math.round(secs / dt)); return p.pos.clone().sub(x0); };
    p.keys = {};
    const fwd60 = run(1 / 60, 1, () => { p.keys.KeyW = true; }), fwd20 = run(1 / 20, 1, () => { p.keys.KeyW = true; });
    out.fwd = [fwd60.length(), fwd20.length(), fwd60.z];
    const up = run(1 / 60, 1, () => { p.pitch = 0.6; p.keys.KeyW = true; });
    out.up = [up.y, Math.hypot(up.x, up.z), Math.sin(0.6) * 3.2, Math.cos(0.6) * 3.2];
    place(258.5, 9, 100.5, 0, -0.5); const y0 = p.pos.y; p.keys.KeyW = true; step(g, 1 / 60, 60); out.down = p.pos.y - y0; p.keys = {};
    const strafe = run(1 / 60, 1, () => { p.keys.KeyD = true; });
    out.strafe = [strafe.length(), strafe.x];
    const idle = run(1 / 60, 2);
    out.idle = idle.y;
    // a kick: Jump gives a burst along the look that glides out (1.87 blocks), the same at 60 and 20 steps a second
    const kick = dt => { const d = run(dt, 1.2, () => { p.keys.Space = true; step(g, dt, 1); p.keys.Space = false; }); return d; };
    const k60 = kick(1 / 60), k20 = kick(1 / 20);
    out.kick = [k60.length(), k20.length(), k60.z];
    // a second press within 0.5 s is ignored; after 0.5 s it kicks again
    const two = run(1 / 60, 1.2, () => { p.keys.Space = true; step(g, 1 / 60, 1); p.keys.Space = false; step(g, 1 / 60, 10); p.keys.Space = true; step(g, 1 / 60, 1); p.keys.Space = false; });
    const three = run(1 / 60, 1.4, () => { p.keys.Space = true; step(g, 1 / 60, 1); p.keys.Space = false; step(g, 1 / 60, 36); p.keys.Space = true; step(g, 1 / 60, 1); p.keys.Space = false; });
    out.again = [two.length(), three.length()];
    // holding Jump with no stick still swims up (after the kick)
    const hold = run(1 / 60, 2.5, () => { p.pitch = 0; p.keys.Space = true; });
    out.hold = [hold.y, p.diving];
    // the net slows you (coil): held = 1 -> 0.4 x
    const coil = run(1 / 60, 1, () => { p.keys.KeyW = true; p.held = 1; });
    p.held = 0;
    out.coil = coil.length();
    // outside the crater nothing changes: the open sea swims as before (no dive, sinking, no kick)
    place(200.5, 9, 100.5, 0, 0.6); p.keys.KeyW = true; const s0 = p.pos.clone(); step(g, 1 / 60, 60);
    out.sea = { diving: p.diving, dy: p.pos.y - s0.y, d: Math.hypot(p.pos.x - s0.x, p.pos.z - s0.z), inWater: p.inWater };
    p.keys = {};
    // a rider is not a diver; and noSwim (a lunge) stops the swim
    place(258.5, 7, 100.5, 0, 0); p.noSwim = true; p.keys.KeyW = true; const n0 = p.pos.clone(); step(g, 1 / 60, 30); out.noSwim = p.pos.distanceTo(n0); p.noSwim = false; p.keys = {};
    // the whirlpool pulls you down, a bubble column carries you up
    place(w.atlantis.whirl.x + 0.5, 12, w.atlantis.whirl.z + 0.5); step(g, 1 / 60, 90); out.whirl = p.pos.y;
    const [bx, bz] = w.atlantis.bubbles[0]; place(bx + 0.5, 3, bz + 0.5); step(g, 1 / 60, 90); out.bubbles = p.pos.y;
    // the Jump button says Swim
    place(258.5, 7, 100.5, 0, 0); step(g, 1 / 60, 2); out.diving = p.diving;
    return out;
  });
  t.ok(Math.abs(S.fwd[0] - 3.2) < 0.1 && Math.abs(S.fwd[1] - 3.2) < 0.1 && S.fwd[2] < -3, `swimming goes where you look: 3.2 blocks a second at 60 and at 20 steps (${S.fwd.map(v => v.toFixed(2))})`);
  t.ok(Math.abs(S.up[0] - S.up[2]) < 0.15 && Math.abs(S.up[1] - S.up[3]) < 0.15 && S.down < -1.2, `you swim up and down by where you look (up ${S.up[0].toFixed(2)} of ${S.up[2].toFixed(2)}; down ${S.down.toFixed(2)})`);
  t.ok(Math.abs(S.strafe[0] - 3.2) < 0.1 && Math.abs(S.strafe[1]) > 3, `sideways steps work (${S.strafe[0].toFixed(2)})`);
  t.ok(S.idle < -0.8 && S.idle > -1.3, `idle you drift down slowly (${S.idle.toFixed(2)} in 2 s)`);
  t.ok(Math.abs(S.kick[0] - S.kick[1]) < 0.05 && S.kick[0] > 1.7 && S.kick[0] < 2.2 && S.kick[2] < -1.6, `a kick glides about 1.9 blocks along the look and is the same at 60 and 20 steps (${S.kick.map(v => v.toFixed(3))})`);
  t.ok(S.again[0] < 2.3 && S.again[1] > 3.2, `a second press within half a second is ignored; later it kicks again (${S.again.map(v => v.toFixed(2))})`);
  t.ok(S.hold[0] > 2.5 && S.hold[1], `holding Jump still swims up, like the old habit (${S.hold[0].toFixed(2)} up in 2.5 s)`);
  t.ok(Math.abs(S.coil - 3.2 * 0.4) < 0.15, `coiled for a lunge you swim at 0.4 x speed (${S.coil.toFixed(2)})`);
  t.ok(!S.sea.diving && S.sea.inWater && S.sea.dy < 0.2 && S.sea.d > 2 && S.sea.d < 2.7, `outside the crater the sea swims as before: no dive, you do not follow your look up, 0.55 x walking speed (${JSON.stringify(S.sea)})`);
  t.ok(S.noSwim < 0.01, 'while the net lunges the swim input is ignored (the part moves you)');
  t.ok(S.whirl < 7 && S.bubbles > 8, `the whirlpool pulls you down (${S.whirl.toFixed(1)}), a bubble column carries you up (${S.bubbles.toFixed(1)})`);
}

/* ======================================================= browser: D. the real part ======================================================= */

const CITYX = 270.5;
// the camera for a screenshot: the player at pos, looking at a point (the page's own render loop draws it)
const stage = (page, pos, at) => page.evaluate(([pos, at]) => { const g = window.pokecraft, p = g.player; p.pos.set(...pos); p.vel.set(0, 0, 0); p.keys = {}; p.lookAt({ x: at[0], y: at[1], z: at[2] }); window.__step(g, 1 / 20, 6); }, [pos, at]);

// the screenshots for the owner: the dark city, the glowing school
async function shotsPart(page, t) {
  await page.evaluate(async () => { const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'); lv.net = []; for (const f of lv.fish) { f.out = false; f.poured = false; } });
  await stage(page, [246.5, 8, 112.5], [270.5, 7, 112.5]); // east of the bell door: the Jar Market, the palace dome far away
  await shot(page, 'dark-city');
  const c = await page.evaluate(async () => { const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'), G = await import('/src/glowfish.js'); lv.t = 6; lv.acc = 0; return G.schoolCentre(g.world.atlantis.school, 6.0); });
  await stage(page, [c[0] + 0.3, c[1] - 1.62 + 0.4, c[2] - 5.5], [c[0], c[1], c[2]]); // five blocks from a tight school, the net ring up
  await page.evaluate(() => { const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'); window.__play(g, () => lv.use()); window.__step(g, 1 / 20, 8); });
  await shot(page, 'school');
  await page.evaluate(() => { const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'); lv.held = null; g.player.held = 0; });
  t.ok(true, 'screenshots: the dark city and the school');
}

async function playPart(page, t) {
  // arrival, the guide, the swim out
  const R = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player, step = window.__step, w = g.world, lv = g.gymLive.of('part:atlantis'), P = fn => window.__play(g, fn);
    p.pos.set(...w.arrivals.atlantis.slice(0, 3)); p.vel.set(0, 0, 0); p.keys = {}; p.yaw = -Math.PI / 2; p.pitch = 0; p.kick = null; p.noSwim = false; step(g, 1 / 20, 2); // (the swimming part moved you: back to the bell)
    const out = { via: g.realms.via, place: g.place, inBell: p.pos.x > 230 && p.pos.x < 238 && p.pos.z > 108 && p.pos.z < 116 && p.pos.y > 4.5, live: !!lv, parts: w.parts.map(q => q.id).join() };
    step(g, 1 / 20, 4); g.updateGuide?.();
    out.guide = g.ui.guideText; out.chip = document.getElementById('score-chip')?.textContent;
    out.near0 = P(() => g.gymLive.near(p));
    p.pos.set(239.5, 6, 112.5); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0; step(g, 1 / 20, 4);
    out.diving = p.diving; out.near = P(() => g.gymLive.near(p)); out.holds = P(() => g.gymLive.holds(p));
    out.glow = g.netGlow;
    return out;
  });
  t.ok(R.via === 'atlantis' && R.place === 'pirate' && R.inBell && R.live && R.parts === 'seas,atlantis', `through the frame you arrive in the diving bell of the Pirate Seas (${R.parts})`);
  t.ok(/Jar Market/.test(R.guide || '') && R.chip === 'Lights 0 / 12', `the guide says "${R.guide}"; the chip says "${R.chip}"`);
  t.ok(await said(page, /The Sunken City! Its lights swam away\. Catch the glowfish!/), 'the arrival words');
  t.ok(R.near0 === null && R.diving && R.near === 'Catch!' && R.holds && R.glow >= 0.25 && R.glow < 0.5, `in the water the big button says "${R.near}" and is held and let go; the net glows a little (${R.glow}), nothing before that`);

  const sandbox = () => page.evaluate(() => { // a clean slate: no fish in the net, none poured
    const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'), p = g.player;
    lv.net = []; lv.held = null; lv.lunge = null; lv.lungeCool = 0; p.noSwim = false; p.held = 0; p.keys = {}; p.kick = null;
    for (const f of lv.fish) { f.out = false; f.poured = false; if (f.kind === 'shy') f.pop = null; }
    for (const j of lv.jars) { if (j.t0 !== null) lv.cells.want(...j.cell, 208); j.t0 = null; }
    return true;
  });
  // a spot beside a jar where a swimmer fits, 2.6 blocks away and level with it, looking at the jar
  const SPOT = `(g, jar, r = 2.6) => { const p = g.player; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, v = p.pos.clone(); v.set(jar.cell[0] + 0.5 + Math.cos(a) * r, jar.cell[1] + 3.2, jar.cell[2] + 0.5 + Math.sin(a) * r); if (!p.collides(v)) { p.pos.copy(v); p.vel.set(0, 0, 0); p.keys = {}; p.lookAt({ x: jar.cell[0] + 0.5, y: jar.cell[1] + 1.35, z: jar.cell[2] + 0.5 }); return true; } } return false; }`;

  // ---- shy fish: bump a jar, swim at the fish, lunge ----
  const shyRun = (dt, idx) => page.evaluate(async ([dt, idx, spot]) => {
    const g = window.pokecraft, p = g.player, lv = g.gymLive.of('part:atlantis'), G = await import('/src/glowfish.js'), step = window.__step, A = g.world.atlantis, P = fn => window.__play(g, fn);
    const SPOT = eval(spot);
    const jar = A.jars.find(j => j.fish === idx), f = lv.shy[idx], i = lv.jars.findIndex(j => j.fish === idx);
    const log = {};
    log.spot = SPOT(g, jar, 3.6); step(g, dt, 3);
    // the wrong trick: a lunge at the jar before it has popped catches nothing
    P(() => lv.use()); step(g, dt, Math.round(0.3 / dt)); P(() => lv.release()); step(g, dt, Math.round(0.5 / dt));
    log.wrong = lv.info().net.length;
    SPOT(g, jar); step(g, dt, 3); lv.lungeCool = 0;
    // bump the jar: it wobbles for 0.6 s (drawn as a wobbling box), then the fish shoots out
    log.bumped = P(() => lv.bump(i)); log.cell = g.world.get(...jar.cell);
    step(g, dt, Math.round(0.45 / dt)); log.mid = lv.info().fish[idx].state;
    step(g, dt, Math.round(0.3 / dt)); log.out = lv.info().fish[idx].state; log.cellBack = g.world.get(...jar.cell);
    // swim after it with a kick, coil for a moment, lunge at where it will be
    // (owner 2026-10-28: it shoots further and hides sooner now: kick after it twice, sprinting, until it is within a lunge)
    for (let k = 0, kickAt = -1; k < Math.round(1.4 / dt); k++) {
      const q = G.shyAt(f.home, lv.t, f.pop).pos, e0 = lv.eye(); p.lookAt({ x: q[0], y: q[1] - 0.2, z: q[2] });
      if (Math.hypot(q[0] - e0[0], q[1] - e0[1], q[2] - e0[2]) < 4.4) break;
      const kick = lv.t - kickAt >= 0.55; if (kick) kickAt = lv.t;
      p.keys = { KeyW: true, ShiftLeft: true, Space: kick }; step(g, dt, 1);
    }
    p.keys = {};
    // judge the distance: the lunge must reach where the fish will be (net 1.2 in front of the eyes, then the lunge); coil that long
    let hold = 0.5;
    for (let k = 0; k < 4; k++) { const q = G.shyAt(f.home, lv.t + hold + 0.125, f.pop).pos, e0 = lv.eye(); const L = Math.min(4, Math.max(1.5, Math.hypot(q[0] - e0[0], q[1] - e0[1], q[2] - e0[2]) - 1.2)); hold = (L - 1.5) / 2.5 * 0.9; }
    P(() => lv.use());
    for (let k = 0; k < Math.round(hold / dt); k++) { const q = G.shyAt(f.home, lv.t + 0.3, f.pop).pos; p.lookAt({ x: q[0], y: q[1] - 0.15, z: q[2] }); step(g, dt, 1); }
    const tr = G.shyAt(f.home, lv.t + 0.125 + 0.0, f.pop).pos; p.lookAt({ x: tr[0], y: tr[1] - 0.15, z: tr[2] });
    const e = lv.eye(); log.dist = Math.hypot(tr[0] - e[0], tr[1] - e[1], tr[2] - e[2]); log.hold = hold;
    P(() => lv.release()); step(g, dt, Math.round(0.5 / dt));
    log.net = lv.info().net.join();
    return log;
  }, [dt, idx, SPOT]);
  await sandbox();
  const s60 = await shyRun(1 / 60, 0);
  await sandbox();
  const s20 = await shyRun(1 / 20, 0);
  t.ok(s60.spot && s60.wrong === 0 && s20.wrong === 0, 'the wrong trick: a lunge at a jar that has not popped catches nothing');
  t.ok(s60.bumped && s60.cell === 0 && s60.mid === 'wobble' && s60.out === 'out' && s60.cellBack === 208, `bumping a jar: the jar is drawn as a wobbling box for 0.6 s, then the fish is out and the jar is back (${s60.mid} -> ${s60.out})`);
  t.ok(s60.net === 'shy0' && s20.net === 'shy0', `the right trick: swim at the popped fish and lunge: caught at 60 and at 20 frames a second (${s60.net} / ${s20.net}; ${s60.dist?.toFixed(1)} blocks away) ${s60.net && s20.net ? '' : JSON.stringify([s60, s20])}`);
  await sandbox();
  // a fish that is out and swims home is not lost: after 4 s it is in its jar again and can be bumped again; an empty jar says so
  const home = await page.evaluate(async spot => {
    const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'), step = window.__step, G = await import('/src/glowfish.js'), p = g.player, P = fn => window.__play(g, fn), SPOT = eval(spot);
    const i = lv.jars.findIndex(j => j.fish === 1), f = lv.shy[1], jar = lv.jars[i];
    SPOT(g, jar); step(g, 1 / 20, 3);
    P(() => lv.bump(i)); step(g, 1 / 20, 40);
    const popped = !!f.pop;
    step(g, 1 / 20, 62);
    const out = { popped, after: lv.info().fish[1].state, pop: f.pop, out: f.out, again: P(() => lv.bump(i)) };
    const e = lv.jars.findIndex(j => j.fish == null); SPOT(g, lv.jars[e]); step(g, 1 / 20, 3);
    window.__toasts.length = 0; lv.lastBump = -99; out.empty = P(() => lv.bump(e)); out.emptyToast = window.__toasts.some(m => /Nothing in this jar/.test(m));
    return out;
  }, SPOT);
  t.ok(home.popped && !home.out && home.after === 'home' && !home.pop && home.again, `a fish that got away swims home after 4 s and can be chased again (${home.after})`);
  t.ok(home.empty && home.emptyToast, 'a jar with nothing in it wobbles and says so');

  // ---- darters: cornered in a dead end they tremble and can be caught; in the open they flee ----
  await sandbox();
  const dart = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player, lv = g.gymLive.of('part:atlantis'), step = window.__step, A = g.world.atlantis, P = fn => window.__play(g, fn);
    const de = A.deadEnds.find(d => d.id === 'h1'), D = lv.darters[0];
    D.fish.pos = [...de.deep]; D.fish.state = 'wander'; D.fish.stuckT = 0;
    const out = {};
    // the player at the mouth, within 7, looking down the pocket
    p.pos.set(de.mouth[0] - de.dir[0] * 0.6, 3.0, de.mouth[1] - de.dir[1] * 0.6); p.vel.set(0, 0, 0); p.keys = {};
    p.lookAt({ x: de.deep[0], y: 3.8, z: de.deep[1] });
    step(g, 1 / 30, 15);
    out.state = D.fish.state; out.pos = [...D.fish.pos];
    // swim a little closer, coil, lunge
    for (let k = 0; k < 15; k++) { p.lookAt({ x: D.fish.pos[0], y: 3.35, z: D.fish.pos[1] }); p.keys.KeyW = true; step(g, 1 / 30, 1); }
    p.keys = {}; p.lookAt({ x: D.fish.pos[0], y: 3.35, z: D.fish.pos[1] });
    out.d = Math.hypot(D.fish.pos[0] - p.pos.x, D.fish.pos[1] - p.pos.z);
    const e = lv.eye(), d3 = Math.hypot(D.fish.pos[0] - e[0], 3.3 - e[1], D.fish.pos[1] - e[2]), L = Math.min(4, Math.max(1.5, d3 - 1.2)), hold = (L - 1.5) / 2.5 * 0.9; // judge the distance
    P(() => lv.use()); step(g, 1 / 30, Math.max(1, Math.round(hold * 30))); p.lookAt({ x: D.fish.pos[0], y: 3.3, z: D.fish.pos[1] }); P(() => lv.release()); step(g, 1 / 30, 15);
    out.net = lv.info().net.join();
    return out;
  });
  t.ok(dart.state === 'stuck' && dart.net === 'dart0', `a darter cornered in a dead end trembles (${dart.state}) and is caught by a lunge (${dart.net || 'nothing'}, ${dart.d.toFixed(1)} blocks)`);
  await sandbox();
  const flee = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player, lv = g.gymLive.of('part:atlantis'), step = window.__step, P = fn => window.__play(g, fn);
    const D = lv.darters[1];
    // the plaza of the gardens: it runs from you (7 blocks a second, in zigzags) and a lunge from 7 away never reaches it
    D.fish.pos = [D.fish.home[0], D.fish.home[1]]; D.fish.state = 'wander';
    p.pos.set(D.fish.pos[0] - 6.5, 3.0, D.fish.pos[1]); p.vel.set(0, 0, 0); p.keys = {};
    const d0 = Math.hypot(D.fish.pos[0] - p.pos.x, D.fish.pos[1] - p.pos.z);
    let min = 99, tries = 0, stuck = 0;
    for (let k = 0; k < 25; k++) {
      p.lookAt({ x: D.fish.pos[0], y: 3.8, z: D.fish.pos[1] }); p.keys.KeyW = true; step(g, 1 / 30, 3);
      const d = Math.hypot(D.fish.pos[0] - p.pos.x, D.fish.pos[1] - p.pos.z); min = Math.min(min, d);
      if (D.fish.state === 'stuck') { stuck++; break; } // cornered by the houses: that is the other trick
      if (k % 5 === 4 && d > 5) { p.keys = {}; p.lookAt({ x: D.fish.pos[0], y: 3.8, z: D.fish.pos[1] }); P(() => lv.use()); step(g, 1 / 30, 3); p.lookAt({ x: D.fish.pos[0], y: 3.8, z: D.fish.pos[1] }); P(() => lv.release()); step(g, 1 / 30, 9); tries++; }
    }
    return { caught: lv.info().net.length, d0, tries, min, stuck };
  });
  t.ok(flee.d0 > 6 && flee.tries >= 1 && (flee.stuck || flee.caught === 0), `a darter in the gardens runs away from a chasing swimmer: ${flee.tries} lunges from 5+ blocks catch nothing (${flee.caught} caught; closest ${flee.min.toFixed(1)}${flee.stuck ? '; the houses cornered it' : ''})`);

  // ---- the school: a lunge into a tight school catches many, into a spread one few ----
  const school = tight => page.evaluate(async tight => {
    const g = window.pokecraft, p = g.player, lv = g.gymLive.of('part:atlantis'), step = window.__step, G = await import('/src/glowfish.js'), A = g.world.atlantis, P = fn => window.__play(g, fn);
    lv.net = []; for (const f of lv.fish) { f.out = false; f.poured = false; }
    const SC = G.FISH.school; lv.t = tight ? SC.first + SC.cycle : SC.first + 1.5 * SC.cycle; lv.acc = 0; lv.lungeCool = 0; lv.lunge = null; p.noSwim = false;
    const c = G.schoolCentre(A.school, lv.t + 0.12), L = 2.5;
    p.pos.set(c[0], c[1] - 1.62, c[2] - 1.2 - L / 2); p.vel.set(0, 0, 0); p.yaw = Math.PI; p.pitch = 0; p.keys = {}; p.kick = null;
    P(() => lv.use()); lv.held.t0 = lv.t - 0.5; p.yaw = Math.PI; p.pitch = 0;
    P(() => lv.release());
    step(g, 1 / 60, 30);
    return lv.info().net.filter(id => /school/.test(id)).length;
  }, tight);
  const tightN = await school(true), spreadN = await school(false);
  t.ok(tightN >= 6 && spreadN <= 3, `a lunge into the school when it is tight catches ${tightN} fish, when it is spread out ${spreadN}`);
  await sandbox();
  // lunge length by coil, and the net's glow
  const L2 = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player, lv = g.gymLive.of('part:atlantis'), step = window.__step, P = fn => window.__play(g, fn);
    const out = [];
    for (const hold of [0, 0.45, 0.9]) {
      lv.net = []; p.pos.set(258.5, 9, 100.5); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; p.keys = {}; step(g, 1 / 60, 2); lv.lungeCool = 0;
      const z0 = p.pos.z, g0 = g.netGlow; P(() => lv.use()); step(g, 1 / 60, Math.round(hold * 60)); const gl = g.netGlow, slow = p.held; P(() => lv.release()); step(g, 1 / 60, 40);
      out.push([z0 - p.pos.z, gl - g0, slow]);
    }
    return out;
  });
  // wild guardians live on the city floor under the water
  const wild = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player, S = await import('/src/species.js');
    p.pos.set(262.5, 5, 112.5); p.vel.set(0, 0, 0); g.creatures.clear();
    for (let i = 0; i < 200; i++) g.creatures.trySpawn(p.pos, g.spawnPoint, false);
    const list = g.creatures.list.map(w => ({ id: w.data.species, type: S.SPECIES[w.data.species].type, y: w.pos.y, lv: w.data.level }));
    g.creatures.clear();
    return { n: list.length, atl: list.filter(w => w.type === 'atlantis'), other: list.filter(w => w.type !== 'atlantis').length };
  });
  t.ok(wild.atl.length >= 3 && wild.atl.every(w => w.y >= 1.9 && w.y <= 3.6 && w.lv >= 40), `wild Atlantis creatures stand on the city floor under the water (${wild.atl.length} of ${wild.n}; heights ${wild.atl.map(w => w.y.toFixed(1)).join(' ')}; levels ${wild.atl.map(w => w.lv).join(' ')})`);
  t.ok(Math.abs(L2[0][0] - 1.5) < 0.2 && Math.abs(L2[1][0] - 2.75) < 0.3 && Math.abs(L2[2][0] - 4) < 0.3 && L2[2][1] > 0.15 && L2[2][2] > 0.9, `a tap lunges 1.5 blocks, a half coil 2.75, a full coil 4 (${L2.map(l => l[0].toFixed(2))}); holding makes the net glow brighter (+${L2[2][1].toFixed(2)})`);
}

/* ======================================================= browser: E. lights, the gate, the Queen ======================================================= */

async function lightsPart(page, t) {
  const L = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player, lv = g.gymLive.of('part:atlantis'), step = window.__step, G = await import('/src/glowfish.js'), A = g.world.atlantis, w = g.world;
    for (const f of lv.fish) { f.out = false; f.poured = false; }
    lv.net = []; g.beaten = g.beaten.filter(k => !G.LIGHT_KEY.test(k));
    const out = {};
    const goTo = d => { const c = A.districts[d].lantern.centre, b = A.districts[d].lantern.box; p.pos.set(b.x0 - 1.2, c[1] - 1.0, c[2] - 0.5); p.vel.set(0, 0, 0); p.keys = {}; step(g, 1 / 20, 2); };
    const grab = (kind, n) => { let k = 0; for (const f of lv.fish) if (f.kind === kind && !f.out && k < n) { f.out = true; lv.net.push(f); k++; } };
    // the wrong lantern: school fish at the Jar Market do nothing but say where they live
    grab('school', 2); goTo(0);
    out.wrong = [lv.net.length, G.lightState(g).total];
    lv.net = []; for (const f of lv.fish) f.out = false;
    // owner 2026-10-27, the pictures that explain it: before a catch a ghost glowfish shows the way into the lantern; with fish in the
    // net a trail of light leads to their lantern; poured fish fly into its bulbs
    lv.caught = false; goTo(0); out.demo = lv.info().show.demo;
    grab('shy', 2); const lc = A.districts[0].lantern.centre; p.pos.set(lc[0] + 9, lc[1], lc[2]); p.vel.set(0, 0, 0); step(g, 1 / 20, 2);
    out.trail = [lv.info().show.trail, lv.info().show.target, lv.info().show.demo];
    // two shy fish at the Jar Market: 2 lights, saved at once
    goTo(0); step(g, 1 / 20, 4); out.flying = lv.info().show.flying;
    out.two = [lv.net.length, G.lightState(g).lit.join(), g.beaten.filter(k => G.LIGHT_KEY.test(k)).join(), lv.info().lit.join(), lv.info().fish.filter(f => f.poured).length];
    const lamps2 = A.districts[0].lamps.map(([x, y, z]) => w.get(x, y, z));
    out.lamps2 = lamps2.filter(id => id === 214).length;
    out.lantern2 = A.districts[0].lantern.cells.every(([x, y, z]) => w.get(x, y, z) === 209);
    // the other two: the district is lit (the lantern shines, all 8 lamps, a beam to the dome)
    grab('shy', 2); goTo(0); step(g, 1 / 20, 4);
    out.four = [G.lightState(g).lit.join(), A.districts[0].lantern.cells.every(([x, y, z]) => w.get(x, y, z) === 210), A.districts[0].lamps.every(([x, y, z]) => w.get(x, y, z) === 214), lv.beams.count, A.lit.join()];
    out.dimLit = [A.districts[0].lantern.centre.length, (await import('/src/atlantisland.js')).dimAt(250, 5, 112, A.lit)];
    // a lit lantern says so; a full net says so
    out.notes = true;
    // darters: 4 at the Arch Gardens. school: 7 fish make 3 lights and one fish stays in the net
    grab('darter', 4); goTo(1); step(g, 1 / 20, 4); out.gardens = [G.lightState(g).lit.join(), lv.net.length];
    grab('school', 7); goTo(2); step(g, 1 / 20, 4); out.temple = [G.lightState(g).lit.join(), lv.net.length, G.lightState(g).total, lv.info().fish.filter(f => f.kind === 'school' && f.poured).length];
    // the gate is still shut (11 of 12)
    out.gateShut = A.palace.gate.every(([x, y, z]) => w.get(x, y, z) === 211);
    out.bossGate = (await import('/src/pictureboss.js')).bossOf('atlantis').gate(g);
    out.talkPrompt = lv.talkPrompt({ kind: 'boss', def: { id: 'atlantis' } });
    // the last light
    grab('school', 1); goTo(2); step(g, 1 / 20, 4);
    out.done = [G.lightState(g).done, G.lightState(g).total, lv.net.length];
    lv.syncLights(true);
    out.gateOpen = A.palace.gate.every(([x, y, z]) => w.get(x, y, z) === 0);
    out.bossGate2 = (await import('/src/pictureboss.js')).bossOf('atlantis').gate(g);
    out.chip = document.getElementById('score-chip')?.textContent;
    out.saved = g.beaten.filter(k => G.LIGHT_KEY.test(k)).length;
    out.guide = (g.updateGuide?.(), g.ui.guideText);
    return out;
  });
  t.ok(L.demo && L.trail[0] > 5 && L.trail[1] === 0 && !L.trail[2] && L.flying >= 1, `owner 2026-10-27: a ghost glowfish shows the way before your first catch; with fish in the net a trail of light leads to their lantern (${L.trail[0]} dots); poured fish fly into its bulbs (${L.flying})`);
  t.ok(L.wrong[0] === 2 && L.wrong[1] === 0 && await said(page, /These glowfish live in the Temple Steps/), `school fish at the Jar Market lantern pour nothing and say where they live (${L.wrong})`);
  t.ok(L.two[0] === 0 && L.two[1] === '2,0,0' && L.two[2] === 'pw:atlantis:light1,pw:atlantis:light2' && L.two[3] === '2,0,0' && L.two[4] === 2 && await said(page, /\+2 lights! 2 \/ 12/), `two shy fish in the Jar Market lantern: 2 lights, saved at once as keys (${L.two[2]})`);
  t.ok(L.lamps2 === 4 && L.lantern2, `two lights: 4 of the 8 lamps are on, the lantern is still dark (${L.lamps2} lamps)`);
  t.ok(L.four[0] === '4,0,0' && L.four[1] && L.four[2] && L.four[3] === 1 && L.four[4] === '4,0,0' && L.dimLit[1] === 1 && await said(page, /The Jar Market is lit! 4 \/ 12/), `four lights: the Jar Market is lit, the lantern shines, all 8 lamps, a beam of light to the dome, the dark is gone (${L.four})`);
  t.ok(L.gardens[0] === '4,4,0' && L.gardens[1] === 0, `four darters light the Arch Gardens (${L.gardens})`);
  t.ok(L.temple[0] === '4,4,3' && L.temple[1] === 1 && L.temple[2] === 11 && L.temple[3] === 6 && await said(page, /Two school fish make one light|Temple Steps is lit|\+3 lights/), `seven school fish make 3 lights and the odd fish stays in the net (${L.temple})`);
  t.ok(L.gateShut && /still dark/.test(L.bossGate) && L.talkPrompt?.action === 'Talk', `with 11 of 12 the palace gate is shut and the Queen says "${L.bossGate}"`);
  t.ok(L.done[0] && L.done[1] === 12 && L.done[2] === 0 && L.gateOpen && L.bossGate2 === null && L.saved === 12 && /Lights 12 \/ 12 · To the palace!/.test(L.chip) && await said(page, /All three lanterns are lit! The palace dome opens/), `12 lights: the palace dome opens, the Queen is ready, "${L.chip}"`);
  t.ok(/Battle Guard (Pelos|Talia)/.test(L.guide || ''), `with all 12 lights the guide leads to a guard still to beat (owner 2026-10-27): "${L.guide}"`);
  // owner 2026-10-28: with all 12 lights the glowfish swim back and the catch goes on just for fun (a pour makes the lantern sparkle; nothing new saved)
  const F = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player, lv = g.gymLive.of('part:atlantis'), step = window.__step, G = await import('/src/glowfish.js'), A = g.world.atlantis;
    window.__toasts = window.__toasts || []; const before = window.__toasts.length, keys = g.beaten.slice().sort().join();
    lv.syncLights(true);
    const back = lv.info().fish.filter(f => f.out || f.poured).length;
    let k = 0; for (const f of lv.fish) if (f.kind === 'darter' && !f.out && k < 2) { f.out = true; lv.net.push(f); k++; }
    const c = A.districts[1].lantern.centre, b = A.districts[1].lantern.box; p.pos.set(b.x0 - 1.2, c[1] - 1.0, c[2] - 0.5); p.vel.set(0, 0, 0); p.keys = {}; step(g, 1 / 20, 4);
    return { back, net: lv.net.length, out: lv.info().fish.filter(f => f.out).length, same: g.beaten.slice().sort().join() === keys, total: G.lightState(g).total, flying: lv.info().show.flying, said: window.__toasts.slice(before).join('|') };
  });
  t.ok(F.back === 0 && F.net === 0 && F.out === 0 && F.same && F.total === 12 && /sparkles! Just for fun!/.test(F.said), `with all 12 lights every glowfish swims back (${F.back} still out) and the catch goes on: two darters poured at the Arch Gardens make its lantern sparkle "Just for fun!" and swim home; nothing new is saved (${F.total} lights) ${JSON.stringify(F).slice(0, 200)}`);
  await stage(page, [245.5, 7.5, 112.5], [251.5, 5.5, 112.5]);
  await shot(page, 'lit');

  // ---- the gate never shuts on you, the Queen battles for the star, losing stays, a win clears the lights ----
  const inside = await page.evaluate(async () => {
    const g = window.pokecraft, p = g.player, lv = g.gymLive.of('part:atlantis'), A = g.world.atlantis, step = window.__step, G = await import('/src/glowfish.js');
    const b = A.boss;
    p.pos.set(b.rest[0], b.rest[1], b.rest[2]); p.vel.set(0, 0, 0); p.keys = {}; step(g, 1 / 20, 4);
    // take a light away (a rematch state): the gate stays open while you stand inside
    g.beaten = g.beaten.filter(k => k !== G.lightKey(12)); lv.syncLights(true); step(g, 1 / 20, 6);
    const stays = A.palace.gate.every(([x, y, z]) => g.world.get(x, y, z) === 0);
    g.beaten.push(G.lightKey(12)); lv.syncLights(true);
    return { stays, inPalace: lv.inPalace(), near: window.__play(g, () => g.gymLive.near(p)), diving: p.diving, y: p.pos.y };
  });
  t.ok(inside.stays && inside.inPalace && inside.near === null && !inside.diving, 'inside the dry throne room you are not swimming, there is no net, and the gate stays open while you are in');
  // owner 2026-10-27: every Boss battles only once his helpers are beaten
  const qGate = await page.evaluate(async () => {
    const g = window.pokecraft, b = g.world.bosses.find(b => b.id === 'atlantis'), n = g.npcs.list.find(n => n.name === 'Queen Coralia');
    g.player.pos.set(b.rest[0], b.rest[1], b.rest[2]); window.__toasts = window.__toasts || []; const before = window.__toasts.length;
    g.bosses.talk(n); const said = window.__toasts.slice(before).join('|');
    const out = { gated: !g.inBattle && /Beat Guard Pelos and Guard Talia first/.test(said), aim: (g.updateGuide?.(), g.ui.guideText) };
    g.beaten.push('pw:atlantis:crew1', 'pw:atlantis:crew2');
    return out;
  });
  t.ok(qGate.gated && /Battle Guard/.test(qGate.aim || ''), `with all 12 lights but her guards not beaten the Queen says to beat them first, and the guide leads to one ("${qGate.aim}")`);
  await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), b = g.world.bosses.find(b => b.id === 'atlantis'), n = g.npcs.list.find(n => n.name === 'Queen Coralia');
    g.party = [S.makeCreature('fluffin', 2)];
    g.player.pos.set(b.rest[0], b.rest[1], b.rest[2]); g.bosses.talk(n);
  });
  await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 60000);
  const bt = await page.evaluate(() => { const b = window.pokecraft.battle; return { boss: b.boss, name: b.trainer.name, foes: b.foes.map(f => f.level).join(), mon: b.foes.map(f => f.species).join() }; });
  t.ok(bt.boss && /Queen Coralia/.test(bt.name) && bt.foes === '60,62,62,64' && bt.mon.endsWith('guardlion'), `Queen Coralia battles with four creatures up to level 64, ending with Guardlion (${bt.foes}: ${bt.mon})`);
  await shot(page, 'battle');
  await playBattle(page);
  await waitFor(page, () => !window.pokecraft.inBattle, null, 60000);
  const lost = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos, b = g.world.bosses.find(b => b.id === 'atlantis'); return { place: g.place, d: Math.hypot(p.x - b.rest[0], p.z - b.rest[2]), hp: g.party.every(c => c.hp > 0), stars: g.stars.includes('atlantis'), lights: g.beaten.filter(k => /pw:atlantis:light/.test(k)).length }; });
  t.ok(lost.place === 'pirate' && lost.d < 12 && lost.hp && !lost.stars && lost.lights === 12, `losing keeps you in the palace, healed, no star, the lights stay (${lost.d.toFixed(1)} from the Queen's rest)`);
  await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), b = g.world.bosses.find(b => b.id === 'atlantis'), n = g.npcs.list.find(n => n.name === 'Queen Coralia');
    g.party = [S.makeCreature('thunderwolf', 100)]; g.cubes = 0;
    g.player.pos.set(b.rest[0], b.rest[1], b.rest[2]); g.player.vel.set(0, 0, 0); g.bosses.talk(n);
  });
  await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
  await playBattle(page);
  await waitFor(page, () => window.pokecraft.stars.includes('atlantis'), null, 60000);
  const won = await page.evaluate(async () => {
    const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'), A = g.world.atlantis;
    return { lights: g.beaten.filter(k => /pw:atlantis:light/.test(k)).length, forceLit: lv.forceLit, lit: A.lit.join(), note: document.querySelector('#celebrate .big')?.textContent, small: document.querySelector('#celebrate .small')?.textContent || document.querySelector('#celebrate')?.textContent, cubes: g.cubes, fishBack: lv.info().fish.filter(f => f.out).length, stars: g.stars.length };
  });
  t.ok(won.lights === 0 && won.forceLit && won.lit === '4,4,4' && won.fishBack === 0, `a won Queen battle clears the 12 lights (a rematch is a new catch), the city stays lit for the trip, the fish are back (${won.lights}, ${won.lit})`);
  t.ok(/Atlantis star/.test(won.note || '') && /Sunken City from a dream/.test(won.small || '') && won.stars === 1 && won.cubes >= 10, `the star, the Wizard's note and cubes (${won.note})`);
  await page.evaluate(() => document.getElementById('celebrate')?.remove());
  await stage(page, [CITYX - 4.5, 4, 112.5], [CITYX + 3.5, 5.2, 112.5]);
  await shot(page, 'palace');
  // with the star the guide leads to the way back; a reload in a fresh browser keeps the star and the lights
  const after = await page.evaluate(() => { const g = window.pokecraft, p = g.player; p.pos.set(240.5, 5, 112.5); g.updateGuide?.(); return { guide: g.ui.guideText, save: g.save(true) }; });
  t.ok(/Way back/.test(after.guide || ''), `with the star the guide says "${after.guide}"`);
  await page.evaluate(async () => { const G = await import('/src/glowfish.js'), g = window.pokecraft; for (let i = 1; i <= 7; i++) g.beaten.push(G.lightKey(i)); g.save(true); });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  t.ok(save.place === 'pirate' && save.stars.includes('atlantis') && save.beaten.filter(k => /pw:atlantis:light/.test(k)).length === 7 && save.realmVersions.pirate === 2 && save.realmUp?.via === 'atlantis', 'the save says: in the Pirate Seas, with the star, 7 lights, version 2, through the Atlantis frame');
  await pause(page);
  const page2 = await openGame(page.context().browser(), new URL(page.url()).origin, { setup: seedSave(save) });
  await click(page2, '#title-buttons button:has-text("Continue")');
  await waitFor(page2, () => window.pokecraft.started, null, 240000);
  await waitFor(page2, () => window.pokecraft.place === 'pirate' && !window.pokecraft.realms.busy && !!window.pokecraft.gymLive.of('part:atlantis'), null, 120000);
  const re = await page2.evaluate(async () => {
    const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'), A = g.world.atlantis, G = await import('/src/glowfish.js');
    lv.syncLights(true);
    return { lit: A.lit.join(), lamps: A.districts[0].lamps.every(([x, y, z]) => g.world.get(x, y, z) === 214), lantern: A.districts[0].lantern.cells.every(([x, y, z]) => g.world.get(x, y, z) === 210), temple: A.districts[2].lamps.filter(([x, y, z]) => g.world.get(x, y, z) === 214).length, shy: lv.info().fish.filter(f => f.kind === 'shy' && f.out).length, via: g.realms.via, gate: A.palace.gate.every(([x, y, z]) => g.world.get(x, y, z) === 211), lights: G.lightState(g).lit.join() };
  });
  t.ok(re.lit === '4,3,0' && re.lamps && re.lantern && re.shy === 4 && re.via === 'atlantis' && re.gate, `after a reload in a fresh browser: the Jar Market and 3 Arch Gardens lights are back, its fish are gone, the palace gate is shut (${JSON.stringify(re)})`);
  t.ok(!page2.errors.length, `no page errors (reload) ${page2.errors.join('; ')}`);
  await page2.context().close();
}

/* ======================================================= F. an old Pirate Seas save ======================================================= */

async function oldPart(browser, base, t) {
  const page = await openGame(browser, base);
  await newGame(page, 0);
  await intoAtlantis(page);
  // a save made in the 224 x 224 sea (version 1): its edits convert, its spot is kept, the sea is built
  const save = await page.evaluate(async () => {
    const g = window.pokecraft; g.stars = ['pirate']; g.save(true);
    const s = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
    const e = [5 + 224 * (20 + 224 * 17), 1], e2 = [112 + 224 * (186 + 224 * 15), 4];
    s.realmEdits = { pirate: [e, e2] }; s.realmVersions = { ...s.realmVersions, pirate: 1 }; s.realmPos = [112.5, 16, 186.5, 0, 0]; s.place = 'pirate'; s.realmUp = { id: 'swirl', ret: s.realmUp?.ret ?? null, via: 'pirate' };
    return s;
  });
  await pause(page);
  const old = await openGame(browser, base, { setup: seedSave(save) });
  await click(old, '#title-buttons button:has-text("Continue")');
  await waitFor(old, () => window.pokecraft.started, null, 240000);
  await waitFor(old, () => window.pokecraft.place === 'pirate' && !window.pokecraft.realms.busy, null, 120000);
  const r = await old.evaluate(() => {
    const g = window.pokecraft, p = g.player.pos, w = g.world;
    return { size: [w.W, w.D], pos: [p.x, p.y, p.z], e1: w.get(5, 17, 20), e2: w.get(112, 15, 186), edits: [...w.edits.keys()].sort((a, b) => a - b).join(), atlantis: !!w.atlantis, v: g.realms.versions().pirate };
  });
  t.ok(r.size.join() === '320,224' && Math.abs(r.pos[0] - 112.5) < 0.6 && Math.abs(r.pos[2] - 186.5) < 0.6 && r.e1 === 1 && r.e2 === 4 && r.atlantis && r.v === 2, `a version 1 save of the Pirate Seas loads: its two edits moved to the new indexes (${r.e1}, ${r.e2}) and you stand where you were (${r.pos.map(v => v.toFixed(1))})`);
  t.ok(!old.errors.length, `no page errors (old save) ${old.errors.join('; ')}`);
  await old.context().close();
  await page.context().close();
}

/* ======================================================= G. iPad ======================================================= */

async function ipadPart(browser, base, t) {
  const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await newGame(ip, 0);
  await intoAtlantis(ip);
  const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
  await ip.evaluate(() => { const g = window.pokecraft, p = g.player; p.pos.set(240.5, 5, 112.5); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0; window.__step(g, 1 / 20, 4); });
  await waitFor(ip, () => /Catch/.test(document.getElementById('btn-act')?.textContent || '') && /Swim/.test(document.getElementById('btn-jump')?.textContent || ''), null, 60000);
  const labels = await ip.evaluate(() => ({ act: document.getElementById('btn-act').textContent, jump: document.getElementById('btn-jump').textContent, buttons: document.querySelectorAll('#touch button, #touch .tbtn').length, dim: document.getElementById('btn-act').classList.contains('dim') }));
  t.ok(labels.act === 'Catch!' && labels.jump === 'Swim' && labels.buttons === before && !labels.dim, `iPad: in the water the big button says "${labels.act}", the Jump button says "${labels.jump}", the number of buttons is unchanged (${before})`);
  const hold = await ip.evaluate(async () => {
    const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'), el = document.getElementById('btn-act'), p = g.player;
    const ev = type => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown');
    const on = lv.info().held, glow0 = g.netGlow;
    await new Promise(r => setTimeout(r, 1200));
    window.__step(g, 1 / 20, 20);
    const coil = p.held, glow = g.netGlow;
    const z0 = p.pos.clone();
    ev('pointerup');
    window.__step(g, 1 / 20, 10);
    return { on, coil, lunged: p.pos.distanceTo(z0), off: !lv.info().held, glow: glow - glow0 };
  });
  t.ok(hold.on && hold.coil > 0.9 && hold.lunged > 3 && hold.off, `iPad: holding the big button coils the net (${hold.coil.toFixed(2)}), lifting the finger lunges ${hold.lunged.toFixed(1)} blocks`);
  const kick = await ip.evaluate(async () => {
    const g = window.pokecraft, p = g.player, el = document.getElementById('btn-jump');
    p.pos.set(258.5, 7, 100.5); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; p.keys = {}; p.kickCool = 0; window.__step(g, 1 / 20, 2);
    const z0 = p.pos.z;
    const ev = type => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 8, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown'); window.__step(g, 1 / 20, 1); ev('pointerup'); window.__step(g, 1 / 20, 24);
    return z0 - p.pos.z;
  });
  t.ok(kick > 1.6 && kick < 2.4, `iPad: tapping Swim kicks you forward (${kick.toFixed(2)} blocks)`);
  await shot(ip, 'ipad');
  t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
  await ip.context().close();
}

/* ======================================================= H. two browsers ======================================================= */

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
  await toasts(Bp); await toasts(A);
  for (const pg of [A, Bp]) await pg.evaluate(() => { window.pokecraft.champion = true; });
  await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
  await placeIs(A, 'swirl');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'swirl');
  const cell = await A.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'atlantis'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(A, 'pirate');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
  const ask = await Bp.evaluate(() => document.getElementById('ask-text').textContent);
  t.ok(/Dad stepped into the Pirate Seas\. Go too\?/.test(ask), `Kid is asked to follow Dad into the Pirate Seas ("${ask}")`);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'pirate');
  await helpers(A); await helpers(Bp);
  // each player has their own fish and net: Dad catches a shy fish, Kid's fish is still in its jar
  const pair = await A.evaluate(async () => {
    const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'); lv.take(lv.shy[0]); lv.take(lv.darters[0]);
    return { net: lv.info().net.join(), glow: g.netGlow };
  });
  const kid = await Bp.evaluate(() => { const g = window.pokecraft, lv = g.gymLive.of('part:atlantis'); return { live: !!lv, net: lv.info().net.length, out: lv.info().fish.filter(f => f.out).length, via: g.realms.via, guest: g.realms.stash.guest }; });
  t.ok(pair.net === 'shy0,dart0' && kid.live && kid.net === 0 && kid.out === 0 && kid.via === 'atlantis' && kid.guest, `Dad's net holds ${pair.net}; Kid has the same Sunken City with every fish of their own (${JSON.stringify(kid)})`);
  const lights = await A.evaluate(async () => { const g = window.pokecraft, G = await import('/src/glowfish.js'); g.beaten.push(G.lightKey(1)); return G.lightState(g).total; });
  const kid2 = await Bp.evaluate(async () => { const g = window.pokecraft, G = await import('/src/glowfish.js'); return G.lightState(g).total; });
  t.ok(lights === 1 && kid2 === 0, "the lights are saved per player: Dad's light is not Kid's");
  t.ok(!A.errors.length && !Bp.errors.length, `no page errors (pair) ${A.errors.concat(Bp.errors).slice(0, 3).join('; ')}`);
  await A.context().close(); await Bp.context().close();
}
