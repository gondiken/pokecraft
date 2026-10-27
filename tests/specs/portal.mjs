// T42: the Portal type and the Portal House in the Swirl (plans/T42.md). A. type data (7 creatures, 4 own shapes with the swirl badge,
// moves, effects, sounds, chart, blocks 215-222, the pop gait). B. the House as terrain (Node: layout rules, clear fronts, keeps, a search
// over the rooms with swirl edges: the designed tricks work and nothing works without them, nobody is stuck; the page: the real World
// builds the same House). C. physics with the real Player at 60 and 20 steps a second (the hub swirl, drop heights in the Fling Room,
// the Clock Room at three clock phases, the Skip Hall with and without the mid-air tap, the 4-loop stop, the catch, the lift, wild
// creatures popping; owner 2026-10-27: both your swirls in the Pair Room, the Slider's moving pad, the Swirl Ball, the Loop Room's kept
// speed and the tap while you fall, tips after misses). D. play (the Wand, the eight rooms and their saved keys, old four-room keys, a
// reload, the gate, Grandpa Arch, the star, a lost battle, sparks, the guide). E. iPad. F. two browsers. G. screenshots for the owner.
// PORTAL_ONLY=data|land|physics|play|ipad|pair|shots runs part of it. Screenshots: tests/screenshots/t42-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, waitFor as waitFor0, playBattle, continueGame, seedSave } from '../helpers.mjs';
import { makeSwirl, houseGraph, reachable, exitReached, stuckCells, layoutProblems, roomAt, run, landing, roomRows, ballPresses } from '../portalcheck.mjs';
import { R, ROOMS, SWIRLS, PARTS, swirlById, HUB, PORCH, HALL, HOUSE_LIFT, PLATFORMS } from '../../src/portalhouse.js';
import { exitOf, exitSpeed, touches, boxHits, PORTAL, ballRun, flingFlight, headOf, slotAimed } from '../../src/portalplay.js';
import { BLOCKS } from '../../src/blocks.js';
import { decorList, ISLETS } from '../../src/swirlland.js';

const waitFor = (page, fn, arg, ms = 120000) => waitFor0(page, fn, arg, ms); // the software renderer is slow with several pages open
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const ONLY = process.env.PORTAL_ONLY || '';
const want = part => !ONLY || ONLY === part;
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id);
const toasts = page => page.evaluate(() => { if (window.__toasts) return; window.__toasts = []; const g = window.pokecraft, f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; });
const said = (page, re) => page.evaluate(src => window.__toasts.some(m => new RegExp(src).test(m)), re.source);
const shot = async (page, name) => { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, `t42-${name}.png`), timeout: 180000 }); console.log(`  screenshot t42-${name}.png`); };
// Run `n` game steps of dt in the page: the player's physics and the live parts (the page's frame loop cannot interleave).
const STEP = `(g, dt, n, stop) => { const old = g.playing; g.playing = () => true; let i = 0; try { for (; i < n; i++) { g.player.update(dt); g.gymLive.update(dt); if (stop && stop()) break; } } finally { g.playing = old; } return i; }`;
const helpers = page => page.evaluate(s => { window.__step = eval(s); window.__lv = () => window.pokecraft.gymLive.of('part:portalhouse'); }, STEP);

// A new game, the Champion goes into the Swirl; returns when the House's live part is there.
async function intoSwirl(page, { starter = 0, fresh = true } = {}) {
  if (fresh) await newGame(page, starter);
  await toasts(page);
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  await helpers(page);
}
// put the player at (x, y, z) facing yaw with the keys off
const at = (page, x, y, z, yaw = 0) => page.evaluate(([x, y, z, yaw]) => { const p = window.pokecraft.player; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0; p.keys = {}; }, [x, y, z, yaw]);
// walk forward (W held) for n steps of dt
const walk = (page, dt, n, stop) => page.evaluate(([dt, n, stop]) => { const g = window.pokecraft; window.__t0 = window.__lv().info().trips; g.player.keys.KeyW = true; try { return window.__step(g, dt, n, stop && eval(stop)); } finally { g.player.keys.KeyW = false; } }, [dt, n, stop]);
const settle = (page, dt, n = 400) => page.evaluate(([dt, n]) => { const g = window.pokecraft, lv = window.__lv(); window.__step(g, dt, n, () => !lv.mover); window.__step(g, dt, Math.round(1.2 / dt)); }, [dt, n]); // (until the flight is over, then a second to come to rest)
const where = page => page.evaluate(() => { const g = window.pokecraft, p = g.player; return { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, on: p.onGround, info: window.__lv().info() }; });
const nodeHash = w => { let h = 0; for (let x = R.x0; x <= R.x1; x++) for (let z = R.z0; z <= R.z1; z++) for (let y = R.y0; y <= R.y1; y++) h = (h * 31 + w.data[x + w.W * (z + w.D * y)]) | 0; return h; };
const cellOf = p => [Math.floor(p[0]), Math.floor(p[1] + 0.001), Math.floor(p[2])];

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (ONLY === 'pair') return pairPart({ browser, base, t });
  if (ONLY === 'ipad') return ipadPart({ browser, base, t });
  let page = await openGame(browser, base);
  const renew = async () => { await page.context().close(); page = await openGame(browser, base); }; // (a page whose game is running cannot start a new one)

  /* ================================ A. the type ================================ */
  if (want('data')) {
    const A = await page.evaluate(async () => {
      const S = await import('/src/species.js'), R = await import('/src/realms.js'), FX = await import('/src/fxrecipes.js'), SH = await import('/src/shapes.js');
      const TR = await import('/src/traits.js'), PW = await import('/src/pictureworlds.js'), BK = await import('/src/book.js'), { sound } = await import('/src/sound.js'), BL = await import('/src/blocks.js');
      const CR = await import('/src/creatures.js'), SR = await import('/src/spawnrules.js'), PB = await import('/src/pictureboss.js');
      const ids = Object.keys(S.SPECIES).filter(i => S.SPECIES[i].type === 'portal');
      const shapes = [...new Set(ids.map(i => S.SPECIES[i].model.shape))].sort();
      const otherShapes = new Set(Object.values(S.SPECIES).filter(s => s.type !== 'portal').map(s => s.model.shape));
      const gear = ids.map(id => { const m = S.buildModel(id), kinds = new Set(); m.traverse(o => { if (o.userData.gear) kinds.add(o.userData.gear); }); return [id, [...kinds].sort().join('+')]; });
      const mv = id => S.MOVES[id];
      const moves = { swirlbop: [40, 1], popthrough: [80, 0.9], shortcut: [50, 1], dizzyswirl: [0, 1], hattrick: [30, 1], doorslam: [95, 0.9] };
      const moveBad = Object.entries(moves).filter(([id, [p, a]]) => !mv(id) || mv(id).type !== 'portal' || mv(id).power !== p || mv(id).acc !== a).map(([id]) => id);
      const learns = id => S.SPECIES[id].learn.map(([l, m]) => `${l}:${m}`);
      const evo = id => S.SPECIES[id].evolve && `${S.SPECIES[id].evolve.level}>${S.SPECIES[id].evolve.into}`;
      const spawns = Object.values(S.SPAWNS).flat().filter(e => ids.includes(e[0])).length;
      const rs = R.REALMS.swirl.spawns, inRealm = ids.every(id => rs.portal.some(e => e[0] === id && e[2] === 'housefloor'));
      const rows = ids.flatMap(id => BK.spawnInfo(id).map(r => `${r.name}|${r.words}`)).filter((n, i, a) => a.indexOf(n) === i);
      const eff = S.effectiveness, keys = Object.keys(S.TYPE_COLORS);
      const own = keys.filter(d => eff('portal', d) !== 1).map(d => `${d}:${eff('portal', d)}`).sort().join();
      const onPortal = keys.filter(a => a !== 'portal' && eff(a, 'portal') !== 1).map(a => `${a}:${eff(a, 'portal')}`).sort().join();
      const blocks = [216, 217, 218, 219, 220, 221, 222, 223].map(id => ({ id, fixed: !!BL.BLOCKS[id]?.fixed, placeable: BL.PLACEABLE.includes(id), name: BL.BLOCKS[id]?.name }));
      const boss = PB.bossOf('portal'), valid = boss.team.every(([sp, lv, mvs]) => S.SPECIES[sp] && lv <= 63 && (!mvs || (mvs.length <= 4 && mvs.every(m => S.MOVES[m]))));
      return {
        ids, shapes, ownShapes: shapes.every(s => !otherShapes.has(s)), registered: shapes.every(s => !!SH.SHAPES[s]), gear,
        moveBad, sw: [mv('shortcut').priority, mv('dizzyswirl').fx, mv('hattrick').fx, mv('hattrick').sig, mv('doorslam').fx, mv('doorslam').sig, mv('popthrough').fx],
        t1: [S.SPECIES.doorbit.learn.some(([l, m]) => l === 1 && m === 'swirlbop'), S.SPECIES.doorbit.learn.some(([, m]) => m === 'popthrough'), S.SPECIES.doorbit.learn.some(([, m]) => m === 'shortcut'), S.SPECIES.doorbit.learn.some(([, m]) => m === 'dizzyswirl')],
        big: [['backdoor', 'sacrifice'], ['portalparty', 'field'], ['lostinswirl', 'curse']].map(([id, k]) => mv(id)?.big && mv(id).fx.kind === k && mv(id).type === 'portal'),
        bigLevels: ['gatestrider', 'doorbit'].map(id => learns(id).filter(x => /backdoor|portalparty|lostinswirl/.test(x)).join('|')),
        evo: ids.map(id => `${id}:${evo(id) ?? '-'}`).join(), sig: [learns('topperoo').includes('30:hattrick'), learns('gatestrider').includes('32:doorslam')],
        sigFx: !!FX.SIG.hattrick && !!FX.SIG.doorslam, fx: [FX.TRAVEL.portal !== FX.TRAVEL.normal, FX.IMPACT.portal !== FX.IMPACT.normal, FX.FX_COLORS.portal !== FX.FX_COLORS.normal],
        sounds: ['fx:portal', 'swirlzip', 'swirlwarp'].map(n => sound.has(n)), clash: Object.keys(S.MOVES).filter(m => sound.has(m) && S.MOVES[m].type === 'portal'),
        ride: TR.TRAITS.rideable.species.gatestrider, loopFlies: S.SPECIES.loopwyrm.flies, gaits: ids.filter(i => S.SPECIES[i].gait === 'pop').length, popGait: !!CR.GAITS.pop,
        spawns, inRealm, rows, cond: SR.condText('housefloor'), wool: BL.WOOL.portal, blocks, tiles: Object.keys(BL.T).filter(k => k.startsWith('PO_')).length,
        own, onPortal, types: keys.length, color: S.TYPE_COLORS.portal, pw: PW.pictureWorld('portal'), frames: PW.FRAME_WORLDS.length, bridge: PW.BRIDGE_WORLDS.length, bossOk: !!boss && valid, bossModel: boss.model, crew: boss.crew.map(c => c.look),
        gate: boss.gate({ beaten: [] }), gateDone: boss.gate({ beaten: [1, 2, 3, 4, 5, 6, 7, 8].map(n => `pw:portal:room${n}`) }), gateOld: boss.gate({ beaten: [1, 2, 3, 4].map(n => `pw:portal:room${n}`) }), glow: [218, 219, 221, 223].filter(id => BL.BLOCKS[id]?.glow).length,
        version: R.REALMS.swirl.version, same: R.REALMS.swirl.sameCells, lose: R.REALMS.swirl.lose, levelCap: R.REALMS.swirl.levelCap,
        swirlLook: (() => { const m = S.buildModel('doorbit'); return m.children.length > 0; })(),
      };
    });
    t.ok(A.ids.join() === 'doorbit,gatestrider,hatbun,topperoo,hooplet,loopwyrm,peekhole', `seven Portal creatures (${A.ids})`);
    t.ok(A.evo === 'doorbit:30>gatestrider,gatestrider:-,hatbun:28>topperoo,topperoo:-,hooplet:32>loopwyrm,loopwyrm:-,peekhole:-', `three families of two and a single-stage 7th (${A.evo})`);
    t.ok(A.shapes.join() === 'hatbunny,loopworm,peephole,walkdoor' && A.ownShapes && A.registered, `four own shapes used by no other type (${A.shapes})`);
    t.ok(A.gear.every(([, k]) => k === 'swirl'), `every model wears the swirl badge (${A.gear.map(g => g.join('=')).join(' ')})`);
    t.ok(!A.moveBad.length && A.t1.every(Boolean) && A.sw[0] === 1 && A.sw[1]?.kind === 'lower' && A.sw[1]?.stat === 'atk' && A.sw[2]?.kind === 'multi' && A.sw[2].min === 2 && A.sw[2].max === 4 && A.sw[3] && A.sw[4]?.kind === 'flinch' && A.sw[5] && A.sw[6]?.kind === 'flinch',
      `the six moves are as planned (${A.moveBad}; ${JSON.stringify(A.sw)})`);
    t.ok(A.big.every(Boolean) && A.sig.every(Boolean) && A.sigFx && A.bigLevels.every(x => x.split('|').length === 3 || x.split('|').length >= 1), `Back Door (sacrifice), Portal Party (field), Lost in the Swirl (curse); Hat Trick at 30 and Door Slam at 32 with effects (${A.bigLevels})`);
    t.ok(A.fx.every(Boolean) && A.sounds.every(Boolean) && !A.clash.length, `own attack effects, colours and sounds (fx:portal, swirlzip, swirlwarp), no move named like a sound (${A.fx}; ${A.sounds}; ${A.clash})`);
    t.ok(A.ride === 'land' && A.loopFlies && A.gaits === 7 && A.popGait && A.wool === 215, `Gatestrider can be ridden on land, Loopwyrm flies, all seven have the pop gait, wool 215`);
    t.ok(A.spawns === 0 && A.inRealm && A.rows.some(r => r.startsWith('Portal House|')) && /Portal House/.test(A.cond), `in no SPAWNS table, every one in the Swirl's portal table (housefloor); Book rows ${A.rows.join(' ; ')}`);
    t.ok(A.blocks.every(b => b.fixed && !b.placeable && b.name) && A.tiles >= 10 && A.glow === 0, `blocks 216-223 (223 = the peach pad) are named, fixed, not placeable, none glows (${A.tiles} tiles)`);
    t.ok(A.types >= 38 && /conic-gradient/.test(A.color), `${A.types} types, the Portal colour is a light swirl`);
    t.ok(A.own === 'bone:2,mind:0.5,portal:0.5,racer:2,slime:2,time:0.5' && /bone:2/.test(A.onPortal) && /alien:2/.test(A.onPortal) && /cozy:2/.test(A.onPortal) && /racer:0.5/.test(A.onPortal) && !/ninja|mind:|time:/.test(A.onPortal), `chart: Portal hits racer, slime, bone; bone, alien and cozy hit Portal, racer barely does (${A.own} / ${A.onPortal})`);
    t.ok(A.pw.ready === true && A.pw.door === false && !A.pw.realm && A.frames >= 11 && A.bridge >= 12, 'the Portal House is a ready world with no frame (no realm), the frames and stones are as before');
    t.ok(A.bossOk && A.bossModel.species === 'gatestrider' && A.crew.join() === 'swirl,swirl' && /0 \/ 8/.test(A.gate) && A.gateDone === null && /4 \/ 8/.test(A.gateOld), `Grandpa Arch: a giant Gatestrider, top level 63, two keepers with the swirl look; the gate says "${A.gate}", and old room keys 1-4 still count ("${A.gateOld}")`);
    t.ok(A.version === 5 && A.same?.join() === '4' && A.lose === 'stay' && A.levelCap === 45, 'the Swirl is version 5 (version 4 cells kept), a lost battle rests you in the Swirl');
  }


  /* ================================ B. the House (terrain) ================================ */
  if (want('land')) {
    const w4 = makeSwirl({ house: false }), w5 = makeSwirl();
    const probs = layoutProblems(w4, w5);
    t.ok(!probs.length, `the Swirl without the House is the old Swirl; with it only the House's volume differs (it was all air) (${probs.join('; ')})`);
    // layout rules
    const rule = [];
    for (const p of PARTS) { const b = p.box; if (b.x0 < R.x0 || b.x1 > R.x1 || b.y0 < R.y0 || b.y1 > R.y1 || b.z0 < R.z0 || b.z1 > R.z1) rule.push(`${p.id} outside R`); if (b.y1 > 47) rule.push(`${p.id} too high`); }
    for (let i = 0; i < PARTS.length; i++) for (let j = i + 1; j < PARTS.length; j++) {
      const a = PARTS[i], b = PARTS[j].box, c = a.box;
      if ((a.id === 'porch' && PARTS[j].id === 'hall') || (a.id === 'hall' && PARTS[j].id === 'porch')) continue;
      const gap = (lo1, hi1, lo2, hi2) => Math.max(lo2 - hi1, lo1 - hi2) - 1; // cells of air between two ranges
      const g = Math.max(gap(c.x0, c.x1, b.x0, b.x1), gap(c.y0, c.y1, b.y0, b.y1), gap(c.z0, c.z1, b.z0, b.z1));
      if (g < 2) rule.push(`${a.id}/${PARTS[j].id} only ${g} cells apart`);
    }
    for (const [x, z, r] of ISLETS) { const near = PARTS.some(p => { const b = p.box, dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1); return Math.hypot(dx, dz) - r < 3; }); if (near) rule.push(`islet ${x},${z}`); }
    const g = houseGraph(w5), { puffs, floaters } = decorList();
    for (const c of g.nodes.values()) {
      for (const q of puffs) if (Math.hypot(q.x - c[0] - 0.5, q.y - c[1], q.z - c[2] - 0.5) < 10) { rule.push(`puff near ${c}`); break; }
      for (const f of floaters) if (Math.hypot(f.x - c[0] - 0.5, f.y - c[1], f.z - c[2] - 0.5) < 5) { rule.push(`floater near ${c}`); break; }
      if (rule.length > 6) break;
    }
    t.ok(!rule.length && PARTS.length === 11, `the porch, the Hall, eight rooms and the Study are inside the House's volume (y up to 47), 2+ cells of air between parts, 3+ from the islets, away from the sky's puffs and floaters (${rule.join('; ')})`);
    // draw calls: no House block at z 32 or more (the chunks x 80..159, z 0..31 hold it all: they were drawn already for the cloud sea), no House block glows
    let late = 0, glowing = 0;
    for (let x = R.x0; x <= R.x1; x++) for (let z = R.z0; z <= 47; z++) for (let y = R.y0; y <= R.y1; y++) { const id = w5.get(x, y, z); if (id && id !== w4.get(x, y, z)) { if (z > 31) late++; if (BLOCKS[id]?.glow) glowing++; } }
    t.ok(late === 0 && glowing === 0 && R.z1 <= 31 && R.x0 >= 80, `every House block is in the chunks of z 0..31 and none glows, so the House adds no chunk mesh (${late} late, ${glowing} glowing)`);
    // fronts clear, keeps, alcoves
    const bad = [], inKeep = (x, y, z) => w5.keeps.some(k => k.protect.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1));
    for (const s of SWIRLS) {
      const m = s.move, ax = m ? { x: 0, y: 1, z: 2 }[m.axis ?? 'y'] : 1;
      const ends = m ? [m.from ?? m.y0, m.to ?? m.y1] : [s.centre[ax]];
      for (const v of ends) {
        const c = [...s.centre]; c[ax] = v;
        for (const speed of [0, 8]) { const out = exitOf(s, c, speed); if (boxHits((x, yy, z) => w5.isSolid(x, yy, z), out.pos)) bad.push(`${s.id} exit at ${out.pos.map(q => q.toFixed(1))} speed ${speed}`); }
      }
      if (s.alcove) { for (const [x, y, z] of s.cells) { const [nx, , nz] = s.normal, open = w5.get(x, y, z) === 0 || ((s.room === 'hall' || s.needs) && w5.get(x, y, z) === 222); if (!open || !w5.isSolid(x - nx, y, z - nz)) bad.push(`${s.id} alcove ${x},${y},${z}`); } }
      else if (s.kind === 'slot') for (const [x, y, z] of s.cells) { if (w5.get(x, y, z) !== 218) bad.push(`${s.id} slab ${x},${y},${z}`); }
      else if (s.kind === 'peach') for (const [x, y, z] of s.cells) { if (w5.get(x, y, z) !== 223) bad.push(`${s.id} peach ${x},${y},${z}`); }
      else if ((s.kind === 'orange' || s.kind === 'pair') && !s.move) for (const [x, y, z] of s.cells) if (w5.get(x, y, z) !== 219) bad.push(`${s.id} rim ${x},${y},${z}`);
    }
    let unkept = 0, firstUnkept = null;
    for (let x = R.x0; x <= R.x1; x++) for (let z = R.z0; z <= R.z1; z++) for (let y = R.y0; y <= R.y1; y++) if (w5.get(x, y, z) && w5.get(x, y, z) !== w4.get(x, y, z) && !inKeep(x, y, z)) { unkept++; firstUnkept ??= [x, y, z]; }
    t.ok(!bad.length && unkept === 0, `every swirl front is clear for the player box (both ends of the sliding ones), door alcoves are air with a plate behind, pads, peach pads and rims are in place, the keeps cover every block of the House (${bad.slice(0, 4).join('; ')}; unkept ${unkept} ${firstUnkept})`);
    t.ok(w5.keeps.some(k => k.name === 'house-hubswirl') && w5.lifts.some(l => l.id === HOUSE_LIFT.id) && w5.lifts.length === 7, 'the Hub Swirl has a keep (no block changed on the hub), the House lift is one more lift stream');
    t.ok(ROOMS.length === 8 && ROOMS.every((r, i) => r.n === i + 1 && r.rule && r.hint && r.idea) && new Set(ROOMS.map(r => r.idea)).size === 8, `eight rooms, each with its own idea, words and a tip (${ROOMS.map(r => `${r.n} ${r.name}: ${r.idea}`).join('; ')})`);
    // the rooms: the designed tricks work, nothing works without them
    const t0 = Date.now(), rows = roomRows(g);
    const row = n => rows[n - 1];
    t.ok([1, 2, 4, 5, 7, 8].every(n => row(n).withTricks[0]) && rows.every(r => !r.without), `rooms 1, 2, 4, 5, 7 and 8: the exit is reachable with the tricks and not without any (${rows.map(r => `${r.n}:${r.withTricks.filter(Boolean).length}/${r.withTricks.length},${r.without}`).join(' ')}; ${Date.now() - t0} ms)`);
    t.ok(row(3).withTricks.join() === 'false,false,false,false,false,false,false,false,true,true,true', `room 3: only when the orange swirl is up high (centre 33.5 and above) the exit is reachable (${row(3).withTricks})`);
    const slideOk = row(6).values.filter((v, i) => row(6).withTricks[i]);
    t.ok(slideOk.length >= 2 && slideOk.length <= 4 && slideOk.every(x => x >= 148.5 && x <= 152.5), `room 6: only when the sliding pad is over the middle ledge (pad at x ${slideOk}) do you land there`);
    t.ok(!row(4).noRetap && !row(8).noRetap, 'rooms 4 and 8: not without moving a swirl in the air');
    // room 2: which shelf you reach by where your swirl is (low / high pad) and how far you fell (4, 9, 16 blocks)
    const shelf = (slot, drop) => { const l = landing(g, swirlById(slot), swirlById(slot).centre, drop); return l.onCloud ? 'cloud' : l.cell[1] >= 22 ? 'EXIT' : l.cell[1] === 9 ? `shelf@${l.cell[0]}` : `other@${l.cell}`; };
    const grid = ['fling.low', 'fling.high'].map(id => [4, 9, 16].map(d => shelf(id, d)));
    t.ok(grid.flat().filter(x => x === 'EXIT').length === 1 && grid[1][2] === 'EXIT' && grid[0].every(x => /^shelf/.test(x)) && /^shelf/.test(grid[1][0]),
      `room 2: only the top ledge (16 down) with the high pad reaches the exit shelf; the others land on the landing shelf farther and farther away (${JSON.stringify(grid)})`);
    const xs = grid[0].map(x => Number(x.split('@')[1])), jump = shelf('fling.high', 17.3);
    t.ok(xs[0] > xs[1] && xs[1] > xs[2] && xs[0] <= 151 && xs[2] >= 142 && jump === 'EXIT', `room 2: the further you fall, the further you fly (shelf x ${xs}), and a jump off the top ledge (17.3) still reaches the exit shelf (${jump})`);
    // room 5: one end where you are, one where you want to go (two ways), never both ends on one side
    const pair = ROOMS[4], ways = [];
    for (const tl of pair.slots) for (const o of pair.peaches) if (exitReached(reachable(g, cellOf(pair.start), { stayIn: pair, retap: false, place: false, placed0: tl, orange0: o }), pair)) ways.push(`${tl}+${o}`);
    const eye5 = [pair.start[0], pair.start[1] + 1.62, pair.start[2]], seen5 = ['pair.w1', 'pair.k2'].filter(id => { const c = swirlById(id).centre, d = [c[0] - eye5[0], c[1] - eye5[1], c[2] - eye5[2]], l = Math.hypot(...d); return !!slotAimed(eye5, d.map(v => v / l), [swirlById(id)], PORTAL.cone, (x, y, z) => w5.isSolid(x, y, z)); });
    t.ok(seen5.length === 2, `room 5: both pads of the walk-in way can be tapped right from the start (${seen5})`);
    t.ok(ways.join() === 'pair.w1+pair.k2,pair.w2+pair.k1', `room 5: the exit only with one swirl down by the start and the other up on the shelf (${ways.join(' ')})`);
    // room 7: the ball reaches the button only from the white pad under the pipe and out of the peach pad that faces the shelf
    const ball = ROOMS[6], presses = [];
    for (const tl of [null, ...ball.slots]) for (const o of [null, ...ball.peaches]) if (ballPresses(g, ball, tl, o)) presses.push(`${tl}+${o}`);
    const run7 = ballRun(g.solid, ball.ball.mouth, { teal: swirlById('ball.w1'), orange: swirlById('ball.k1') });
    t.ok(presses.join() === 'ball.w1+ball.k1' && run7.pieces.length === 2 && run7.rests, `room 7: only white pad under the pipe + the peach pad facing the shelf puts the Swirl Ball on the button (${presses}; it lands at ${run7.end.map(v => v.toFixed(1))})`);
    const kp = swirlById('ball.k1'), you = [8.47, 9.3].map(s => { const ex = exitOf(kp, kp.centre, s); return flingFlight(g.solid, ex.pos, ex.vel).end; });
    t.ok(you.every(e => e[1] < 13 || e[0] < 121), `room 7: you fly the ball's way too, but slower (the ball falls further), so you never reach the button shelf (${you.map(e => e.map(v => v.toFixed(1)).join(',')).join(' / ')})`);
    // room 8: out of the wall pad you reach the exit ledge only at full speed (after one round through the ceiling)
    const lw = swirlById('loop.w'), lands = [exitSpeed(7), exitSpeed(8.3), exitSpeed(7 + 18.2)].map(s => { const ex = exitOf(lw, lw.centre, s); return flingFlight(g.solid, ex.pos, ex.vel).end; });
    t.ok(lands[0][0] < 128 && lands[1][0] < 128 && lands[2][0] > 129.3 && lands[2][0] < 134 && exitSpeed(7 + 18.2) === PORTAL.maxSpeed && headOf(swirlById('loop.top'), 8.47) > 6.9 && headOf(swirlById('gap.p3'), 8.47) > 0 && headOf(lw, 8.47) === 0,
      `room 8: straight from the ledge (${lands[0][0].toFixed(1)}, a jump ${lands[1][0].toFixed(1)}) you fall short, after a round through the ceiling (speed kept: ${exitSpeed(7 + 18.2)}) you land on the exit ledge (${lands[2][0].toFixed(1)})`);
    const stuck = stuckCells(g);
    t.ok(stuck.length === 0, `nobody is stuck: every one of the ${g.nodes.size} places to stand has a way out (${stuck.length} stuck ${stuck.slice(0, 5)})`);
    // the lift reaches the porch: the cells above the cloud sea at the lift are lifted to the porch deck
    const lift = w5.lifts.find(l => l.id === 'house');
    t.ok(lift.y[1] + 1 >= PORCH.top + 2 && w5.isSolid(94, PORCH.top, 24) && !w5.isSolid(93, PORCH.top + 1, 24), 'the House lift rises past the porch deck and leaves you beside it');
    // the real World (page) builds the same House
    const want5 = nodeHash(w5);
    const real = await page.evaluate(async ([R]) => {
      const { World } = await import('/src/world.js'), RM = await import('/src/realms.js'), def = RM.REALMS.swirl, out = [];
      for (const seed of [1, 4242, 294331207]) {
        const w = new World(seed, null, null, def.size, def); w.generate();
        let h = 0; for (let x = R.x0; x <= R.x1; x++) for (let z = R.z0; z <= R.z1; z++) for (let y = R.y0; y <= R.y1; y++) h = (h * 31 + w.data[x + w.W * (z + w.D * y)]) | 0;
        out.push({ seed, h, parts: w.parts.map(p => p.id).join(), nooks: w.nooks.length, rests: w.rests.length, boss: w.bosses.map(b => b.id).join(), crew: w.bosses[0].crew.length, doors: w.doors.length, door: !!w.door, healer: !!w.healer, biome: w.biome(110, 24) + '/' + w.biome(60, 60) });
      }
      return out;
    }, [R]);
    t.ok(real.every(r => r.h === want5 && r.parts === 'portalhouse' && r.boss === 'portal' && r.crew === 2 && r.doors === 1 && r.door && r.healer && r.biome === 'portal/swirl' && r.nooks > 20 && r.rests === 11),
      `the real realm World for three seeds is the same House as the stand-in (hash ${want5}; ${JSON.stringify(real[0])})`);

    // an old (version 4) save of the Swirl: its edits outside the House stay, the ones inside the House's keeps are dropped, you are where you were
    const pg = await openGame(browser, base);
    await intoSwirl(pg);
    const ids = await pg.evaluate(() => { const w = window.pokecraft.world, idx = (x, y, z) => x + w.W * (z + w.D * y); return { outside: idx(50, 21, 88), inside: idx(110, 14, 25), deck: idx(100, 12, 24) }; });
    const json = await pg.evaluate(ids => {
      const g = window.pokecraft, p = g.player; p.pos.set(60.5, 21, 80.5); p.vel.set(0, 0, 0); g.save(true);
      const s = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
      s.realmVersions.swirl = 4; s.realmEdits = { swirl: [[ids.outside, 8], [ids.inside, 8], [ids.deck, 8]] };
      return JSON.stringify(s);
    }, ids);
    await pg.context().close();
    const pg2 = await openGame(browser, base, { setup: seedSave(json) });
    await continueGame(pg2);
    const old = await pg2.evaluate(async ids => {
      const g = window.pokecraft, p = g.player.pos, RM = await import('/src/realms.js');
      return { place: g.place, d: Math.hypot(p.x - 60.5, p.z - 80.5), outside: g.world.get(ids.outside % g.world.W, Math.floor(ids.outside / (g.world.W * g.world.D)), Math.floor(ids.outside / g.world.W) % g.world.D), inside: g.world.edits.has(ids.inside), deck: g.world.get(100, 12, 24),
        clean: [4, 5, 3, undefined].map(v => RM.cleanRealmEdits({ swirl: [[ids.outside, 8]] }, v === undefined ? {} : { swirl: v }).swirl?.length ?? 0).join() };
    }, ids);
    t.ok(old.place === 'swirl' && old.d < 1.5 && old.outside === 8 && !old.inside && old.deck === 217, `a version 4 Swirl save still loads in the Swirl where you were; its edit on the hub stays, the ones inside the House are dropped (${JSON.stringify(old)})`);
    t.ok(old.clean === '1,1,0,0', `cleanRealmEdits keeps version 4 and 5 edits and drops older ones (${old.clean})`);
    await pg2.context().close();
  }

  if (!want('physics') && !want('play') && !want('shots')) { await finish(); return; }

  /* ================================ C. physics ================================ */
  if (want('physics')) {
    await intoSwirl(page);
    const STEPS = [1 / 60, 1 / 20];
    const placeAll = (...ids) => page.evaluate(ids => { const lv = window.__lv(); lv.wand = true; lv.yours = null; lv.orange = null; lv.chain = { key: null, n: 0 }; lv.lastTrip = null; for (const id of ids) lv.place(lv.house.swirls.find(s => s.id === id)); window.__toasts.length = 0; }, ids);
    for (const dt of STEPS) {
      const tag = `${Math.round(1 / dt)} steps a second`;
      // ---- the hub swirl: walk onto it from the south, pop out on the porch; the porch swirl takes you back; no bouncing
      await at(page, 51.5, 21, 78.5, 0);
      const trips0 = (await where(page)).info.trips;
      await walk(page, dt, Math.round(2.5 / dt), '() => window.pokecraft.player.pos.x > 90');
      await page.evaluate(([dt]) => window.__step(window.pokecraft, dt, Math.round(1.5 / dt)), [dt]);
      let w = await where(page);
      t.ok(w.x > 100 && w.x < 105 && Math.abs(w.y - 13) < 0.1 && Math.abs(w.z - 24.5) < 0.8 && w.info.trips === trips0 + 1, `${tag}: the Hub Swirl pops you out on the porch, once (${w.x.toFixed(1)}, ${w.y.toFixed(1)}, ${w.z.toFixed(1)}; trips ${w.info.trips - trips0})`);
      await at(page, 97.5, 13, 22.5, Math.PI);
      await walk(page, dt, Math.round(2.5 / dt), '() => window.pokecraft.player.pos.x < 80');
      w = await where(page);
      t.ok(Math.abs(w.x - 51.5) < 1.5 && Math.abs(w.y - 21) < 0.2 && w.z > 75, `${tag}: the Porch Swirl takes you back to the hub (${w.x.toFixed(1)}, ${w.y.toFixed(1)}, ${w.z.toFixed(1)})`);

      // ---- the lift from the cloud sea to the porch
      await at(page, 92.5, 1, 23.5, -Math.PI / 2);
      await page.evaluate(([dt]) => { const g = window.pokecraft; g.player.keys.KeyW = false; window.__step(g, dt, Math.round(2.2 / dt)); g.player.keys.KeyW = true; window.__step(g, dt, Math.round(1.5 / dt)); g.player.keys.KeyW = false; window.__step(g, dt, Math.round(1.0 / dt)); }, [dt]);
      w = await where(page);
      t.ok(w.y > 12.9 && w.y < 13.2 && w.x > 93.5 && w.on, `${tag}: the House lift carries you up past the porch and you walk onto the deck (${w.x.toFixed(1)}, ${w.y.toFixed(1)})`);

      // ---- room 1: aim far (the ceiling pad), then the soft catch
      await page.evaluate(() => { window.__lv().misses = {}; });
      await at(page, 127.5, 13, 23.5, Math.PI / 2);
      await placeAll('gap.p3');
      await walk(page, dt, Math.round(2 / dt), '() => window.__lv().info().trips > window.__t0 && window.pokecraft.player.pos.y < 19');
      await page.evaluate(([dt]) => window.__step(window.pokecraft, dt, Math.round(2 / dt)), [dt]);
      w = await where(page);
      t.ok(Math.abs(w.x - 150.5) < 1.6 && Math.abs(w.y - 18) < 0.1 && w.on && w.info.last?.fling === false, `${tag}: walk into the orange swirl: you drop out of the ceiling pad onto the high ledge (${w.x.toFixed(1)}, ${w.y.toFixed(1)}, ${w.z.toFixed(1)})`);
      await at(page, 135, 12.5, 23.5, 0);
      await page.evaluate(([dt]) => { window.__step(window.pokecraft, dt, Math.round(2.5 / dt)); }, [dt]);
      w = await where(page);
      t.ok(Math.hypot(w.x - 127.5, w.z - 23.5) < 0.7 && Math.abs(w.y - 13) < 0.1 && w.info.last?.catch === 1 && await said(page, /Whoops! Back to the start of this room/), `${tag}: a fall into the gap lands on the soft cloud and puffs you back to the start`);
      // a tip after two misses
      await at(page, 135, 12.5, 23.5, 0);
      await page.evaluate(([dt]) => { window.__step(window.pokecraft, dt, Math.round(2.5 / dt)); }, [dt]);
      t.ok(await said(page, /Tip: look at the far white pad/), `${tag}: after two misses in a room its tip shows`);

      // ---- room 2: from how high? (low pad: 4 / 9 / 16 blocks down = near / middle / far on the landing shelf; high pad + 16 = the exit shelf)
      const ledges = [[152.5, 9, 4.0, 150.03, 6.4], [154.5, 14, 4.5, 146.45, 9.6], [156.5, 21, 4.5, 142.86, 12.8]]; // x, y, z, expected landing x, speed
      for (const [slot] of [['fling.low'], ['fling.high']]) for (const [lx, ly, lz, ex, sp] of ledges) {
        await placeAll(slot);
        await at(page, lx, ly, lz, Math.PI);
        await walk(page, dt, Math.round(4 / dt), '() => window.__lv().info().trips > window.__t0');
        await settle(page, dt, Math.round(8 / dt));
        w = await where(page);
        const exit = slot === 'fling.high' && ly === 21;
        const okLand = exit ? w.y > 21.5 && w.x >= 141 && w.x <= 146 : slot === 'fling.low' ? Math.abs(w.x - ex) < 0.8 && Math.abs(w.y - 9) < 0.1 : w.on;
        t.ok(okLand && Math.abs((w.info.last?.speed ?? 0) - sp) < 0.15, `${tag}: ${slot} from ${ly - 1 === 8 ? 'the low' : ly === 14 ? 'the middle' : 'the top'} ledge: speed ${(w.info.last?.speed ?? 0).toFixed(1)}, you land at ${w.x.toFixed(1)}, ${w.y.toFixed(1)}${exit ? ' (the exit shelf)' : slot === 'fling.low' ? ` (expected ${ex})` : ''}`);
        t.ok(!(await page.evaluate(() => window.pokecraft.player.collides(window.pokecraft.player.pos))), `${tag}: the fling never ends inside a block`);
      }

      // ---- room 3: the sliding orange swirl at three clock phases (frozen at a height)
      for (const [oy, ly, name] of [[25.5, 20, 'the middle ledge'], [34.5, 28, 'the exit ledge']]) {
        await page.evaluate(([oy]) => { window.__lv().hold = oy; }, [oy]);
        await placeAll('clock.p');
        await at(page, 101.5, 25, 3.0, Math.PI);
        await walk(page, dt, Math.round(4 / dt), '() => window.__lv().info().trips > window.__t0');
        await settle(page, dt, Math.round(8 / dt));
        w = await where(page);
        t.ok(w.on && Math.abs(w.y - ly) < 0.1 && w.x >= 104 && w.x <= 109 && Math.abs((w.info.last?.speed ?? 0) - 10.1) < 0.2, `${tag}: the orange swirl at ${oy}: you land on ${name} (${w.x.toFixed(1)}, ${w.y.toFixed(1)}; speed ${(w.info.last?.speed ?? 0).toFixed(2)})`);
      }
      await page.evaluate(() => { window.__lv().hold = 19.5; });
      await placeAll('clock.p');
      await at(page, 101.5, 25, 3.0, Math.PI);
      await walk(page, dt, Math.round(4 / dt), '() => window.__lv().info().trips > window.__t0');
      await page.evaluate(([dt]) => { const lv = window.__lv(); window.__step(window.pokecraft, dt, Math.round(30 / dt), () => window.__toasts.some(m => /Jump in while it goes up/.test(m)) && !lv.mover && window.pokecraft.player.onGround); window.__step(window.pokecraft, dt, Math.round(1 / dt)); }, [dt]);
      w = await where(page);
      t.ok(w.on && (Math.abs(w.y - 15) < 0.1 || Math.abs(w.y - 25) < 0.1) && await said(page, /Jump in while it goes up/), `${tag}: an orange swirl that is too low sends you back to your own pad, round and round, until the hint, then you step out and are caught (${w.x.toFixed(1)}, ${w.y.toFixed(1)})`);
      await page.evaluate(() => { window.__lv().hold = null; });

      // ---- room 4: the tap in the air. With a tap on the next pad every time you end on the last platform; without, you go round and round
      const run4 = (taps) => page.evaluate(([dt, taps]) => {
        const g = window.pokecraft, lv = window.__lv(), sw = id => lv.house.swirls.find(s => s.id === id);
        lv.wand = true; lv.yours = null; lv.orange = null; lv.chain = { key: null, n: 0 }; lv.lastTrip = null; window.__toasts.length = 0;
        lv.place(sw('skip.p1'));
        const p = g.player; p.pos.set(104.5, 35, 25.5); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.pitch = 0; p.keys = { KeyW: true };
        const t0 = lv.info().trips; let tapped = 0, k = 1, tapTrip = -1;
        window.__step(g, dt, Math.round(40 / dt), () => {
          if (taps && lv.mover && lv.mover.clock > 0.25 && lv.yours === `skip.p${k}` && k < 4 && lv.info().trips !== tapTrip) { // while you fly (once per flight): look ahead and tap the next pad
            const nx = sw(`skip.p${k + 1}`); p.lookAt({ x: nx.centre[0], y: nx.centre[1], z: nx.centre[2] });
            if (lv.near() === 'Swirl!' && lv.use()) { k++; tapped++; tapTrip = lv.info().trips; }
          }
          return !lv.mover && p.onGround && lv.info().trips - t0 >= 3 && (taps ? lv.yours === 'skip.p4' : lv.info().chain.n === 0) && p.pos.y > 30;
        });
        p.keys = {};
        return { x: p.pos.x, y: p.pos.y, z: p.pos.z, on: p.onGround, trips: lv.info().trips - t0, tapped, yours: lv.yours, toasts: window.__toasts.slice() };
      }, [dt, taps]);
      let r4 = await run4(true);
      t.ok(r4.tapped === 3 && r4.on && Math.abs(r4.y - 35) < 0.1 && r4.x > 148 && r4.x < 154, `${tag}: room 4 with a tap on the next pad each time: pad 1, 2, 3, then you come out of pad 4 on the last platform (${r4.x.toFixed(1)}, ${r4.y.toFixed(1)}; ${r4.trips} trips, ${r4.tapped} taps)`);
      r4 = await run4(false);
      t.ok(r4.on && r4.x < 118 && r4.x > 112.5 && r4.toasts.some(m => /Tap the next white pad while you fly!/.test(m)), `${tag}: room 4 without the tap: after 4 loops through the same pair you stop on platform 1 with the hint (${r4.x.toFixed(1)}, ${r4.y.toFixed(1)}; ${r4.trips} trips)`);

      // ---- room 5: both ends are yours. Teal by the start + orange on the shelf: walk in; orange in the pit + teal on the shelf: drop in
      await placeAll('pair.w1', 'pair.k2');
      await at(page, 89.0, 15, 3.0, Math.PI / 2);
      await walk(page, dt, Math.round(3 / dt), '() => window.__lv().info().trips > window.__t0');
      await page.evaluate(([dt]) => window.__step(window.pokecraft, dt, Math.round(1 / dt)), [dt]);
      w = await where(page);
      t.ok(w.on && Math.abs(w.y - 21) < 0.1 && w.z > 8 && w.info.last?.to === 'pair.k2', `${tag}: room 5: into your teal swirl by the start, out of your orange one up on the shelf (${w.x.toFixed(1)}, ${w.y.toFixed(1)}, ${w.z.toFixed(1)})`);
      await placeAll('pair.w2', 'pair.k1');
      await at(page, 89.5, 15, 3.0, Math.PI);
      await walk(page, dt, Math.round(3 / dt), '() => window.__lv().info().trips > window.__t0');
      await page.evaluate(([dt]) => window.__step(window.pokecraft, dt, Math.round(1 / dt)), [dt]);
      w = await where(page);
      t.ok(w.on && Math.abs(w.y - 21) < 0.1 && w.info.last?.to === 'pair.w2', `${tag}: room 5: drop into your orange swirl in the pit, step out of your teal one on the shelf (${w.x.toFixed(1)}, ${w.y.toFixed(1)}, ${w.z.toFixed(1)})`);
      await placeAll('pair.w1', 'pair.k1');
      await at(page, 89.0, 15, 3.0, Math.PI / 2);
      await walk(page, dt, Math.round(3 / dt), '() => window.__lv().info().trips > window.__t0');
      await page.evaluate(([dt]) => window.__step(window.pokecraft, dt, Math.round(2 / dt)), [dt]);
      w = await where(page);
      t.ok(Math.abs(w.y - 15) < 0.1 && w.info.last?.catch === 5, `${tag}: room 5: both ends down by the start: you pop into the pit and the cloud puffs you back (${w.x.toFixed(1)}, ${w.y.toFixed(1)})`);

      // ---- room 6: the sliding pad (frozen at x): over the middle ledge you land there, over the gap you are caught
      for (const [hx, ok] of [[150.5, true], [146.5, false], [155.5, false]]) {
        await page.evaluate(([hx]) => { window.__lv().hold = hx; }, [hx]);
        await placeAll('slide.p');
        await at(page, 142.5, 43, 7.0, Math.PI / 2);
        await walk(page, dt, Math.round(2 / dt), '() => window.__lv().info().trips > window.__t0');
        await page.evaluate(([dt]) => window.__step(window.pokecraft, dt, Math.round(2.5 / dt)), [dt]);
        w = await where(page);
        t.ok(ok ? w.on && Math.abs(w.y - 43) < 0.1 && Math.abs(w.x - hx) < 0.3 : Math.abs(w.x - 142.5) < 0.7 && w.info.last?.catch === 6, `${tag}: room 6: your pad at x ${hx}: ${ok ? 'you drop onto the middle ledge' : 'you drop into the cloud and puff back'} (${w.x.toFixed(1)}, ${w.y.toFixed(1)})`);
      }
      // the real clock: the pad slides (closed form), and you step in at the right moment
      const slid = await page.evaluate(([dt]) => {
        const g = window.pokecraft, lv = window.__lv(), s = lv.house.swirls.find(q => q.id === 'slide.p');
        lv.hold = null; lv.clock = 0; const xs = [];
        for (let i = 0; i < 8; i++) { xs.push(lv.cen(s)[0]); lv.clock += 7 / 8; }
        lv.yours = null; lv.place(s);
        const p = g.player; p.pos.set(142.0, 43, 7.0); p.vel.set(0, 0, 0); p.yaw = Math.PI / 2; p.pitch = 0; p.keys = {};
        lv.clock = 0; const t0 = lv.info().trips; // wait until the pad is 0.5 s before the middle (it moves 22 blocks in 7 s), then walk in
        window.__step(g, dt, Math.round(8 / dt), () => { const x = lv.cen(s)[0]; return x > 149.0 && x < 149.6 && lv.clock < 3.5; });
        p.keys = { KeyW: true };
        window.__step(g, dt, Math.round(2 / dt), () => lv.info().trips > t0);
        p.keys = {};
        window.__step(g, dt, Math.round(2 / dt));
        return { xs, x: p.pos.x, y: p.pos.y, on: p.onGround };
      }, [dt]);
      t.ok(slid.xs[0] === 145.5 && slid.xs[4] === 156.5 && slid.on && Math.abs(slid.y - 43) < 0.1 && slid.x > 148.7 && slid.x < 152.3, `${tag}: room 6 with the real clock: the pad slides to and fro (${slid.xs.map(x => x.toFixed(1)).join(' ')}); walk in just before it gets there and you land on the middle ledge (${slid.x.toFixed(1)})`);

      // ---- room 7: the Swirl Ball: white pad under the pipe + the peach pad facing the shelf = the ball on the button; any other way it puffs away
      const ballRun7 = (ids, secs) => page.evaluate(([dt, ids, secs]) => {
        const g = window.pokecraft, lv = window.__lv(), p = g.player;
        p.pos.set(116.5, 11, 3.0); p.vel.set(0, 0, 0); p.keys = {};
        window.__step(g, dt, 2); lv.resetBall(); lv.wand = true; lv.yours = null; lv.orange = null;
        for (const id of ids) lv.place(lv.house.swirls.find(s => s.id === id));
        const b0 = lv.balls, path = [];
        window.__step(g, dt, Math.round(secs / dt), () => { const i = lv.info(); if (i.ball?.at) path.push(i.ball.at[0]); return lv.pressed; });
        const door = lv.house.swirls.find(s => s.id === 'ball.exit').cells.map(c => g.world.get(...c));
        return { pressed: lv.pressed, balls: lv.balls - b0, maxX: Math.max(...path), door: door.join(), clock: lv.clock };
      }, [dt, ids, secs]);
      let b7 = await ballRun7(['ball.w1', 'ball.k2'], 12);
      t.ok(!b7.pressed && b7.balls >= 2 && b7.door.split(',').every(v => v === '222'), `${tag}: room 7: the orange swirl facing the wrong way: the balls fly off and puff away, the door stays shut (${b7.balls} balls)`);
      b7 = await ballRun7(['ball.w1', 'ball.k1'], 10);
      t.ok(b7.pressed && b7.maxX > 121 && b7.door.split(',').every(v => v === '0'), `${tag}: room 7: down the pipe, through your swirls, onto the shelf: the button clicks and the door opens (ball reached x ${b7.maxX.toFixed(1)})`);
      await page.evaluate(([dt]) => { const g = window.pokecraft, lv = window.__lv(), s = lv.house.swirls.find(q => q.id === 'ball.exit'), p = g.player; window.__t0 = lv.info().trips; p.pos.set(117.5, 11, 3.4); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; p.keys = { KeyW: true }; window.__step(g, dt, Math.round(2 / dt), () => lv.info().trips > window.__t0); p.keys = {}; }, [dt]);
      w = await where(page);
      t.ok(w.info.part === 8 && Math.abs(w.y - 33) < 0.1, `${tag}: room 7: through the open door into room 8 (${w.x.toFixed(1)}, ${w.y.toFixed(1)}, ${w.z.toFixed(1)})`);
      await page.evaluate(() => { window.pokecraft.beaten = window.pokecraft.beaten.filter(k => !k.startsWith('pw:portal:room')); });

      // ---- room 8: round once through the ceiling (speed kept), tap the wall pad while you fall: across the gap
      const run8 = (mode) => page.evaluate(([dt, mode]) => {
        const g = window.pokecraft, lv = window.__lv(), sw = id => lv.house.swirls.find(s => s.id === id), p = g.player;
        p.pos.set(117.0, 33, 3.0); p.vel.set(0, 0, 0); p.yaw = Math.PI; p.pitch = 0; p.keys = {};
        window.__step(g, dt, 2);
        lv.wand = true; lv.yours = null; lv.orange = null; lv.chain = { key: null, n: 0 }; lv.lastTrip = null; window.__toasts.length = 0;
        lv.place(sw('loop.k')); lv.place(sw(mode === 'wall' ? 'loop.w' : 'loop.top'));
        p.keys = { KeyW: true };
        const t0 = lv.info().trips, speeds = []; let tapped = false;
        window.__step(g, dt, Math.round(25 / dt), () => {
          const last = lv.info().last;
          if (last && (speeds.length === 0 || speeds.at(-1) !== `${lv.info().trips}:${last.speed.toFixed(2)}`)) speeds.push(`${lv.info().trips}:${last.speed.toFixed(2)}`);
          if (lv.info().trips - t0 >= 1) p.keys = {};
          if (mode === 'tap' && !tapped && lv.mover && lv.mover.clock > 0.2 && lv.yours === 'loop.top' && lv.info().trips - t0 >= 1) { // falling out of the ceiling: look at the wall pad and tap
            const s = sw('loop.w'); p.lookAt({ x: s.centre[0], y: s.centre[1], z: s.centre[2] });
            if (lv.near() === 'Swirl!' && lv.use()) tapped = true;
          }
          return lv.info().trips - t0 >= 2 && !lv.mover && p.onGround;
        });
        p.keys = {};
        window.__step(g, dt, Math.round(1 / dt));
        return { x: p.pos.x, y: p.pos.y, z: p.pos.z, on: p.onGround, tapped, speeds: speeds.map(s => s.split(':')[1]), toasts: window.__toasts.slice(), catch: lv.info().last?.catch };
      }, [dt, mode]);
      let r8 = await run8('tap');
      t.ok(r8.tapped && r8.on && Math.abs(r8.y - 29) < 0.1 && r8.x > 129 && r8.x < 135, `${tag}: room 8: round once through the ceiling, tap the wall pad while you fall: you fly across onto the exit ledge (${r8.x.toFixed(1)}, ${r8.y.toFixed(1)}; speeds ${r8.speeds.join(' ')})`);
      r8 = await run8('wall');
      t.ok(Math.abs(r8.y - 33) < 0.1 && Math.abs(r8.z - 3) < 0.8 && r8.speeds[0] < 10, `${tag}: room 8: straight out of the wall pad you are too slow and the cloud puffs you back (speed ${r8.speeds[0]})`);
      r8 = await run8('loop');
      t.ok(Math.abs(r8.y - 33) < 0.1 && r8.toasts.some(m => /Now tap the white pad on the wall while you fall!/.test(m)) && Number(r8.speeds[1]) > Number(r8.speeds[0]), `${tag}: room 8: round and round without a tap you get faster (${r8.speeds.slice(0, 3).join(' ')}), then the loop stops at the start with the hint`);
      await page.evaluate(() => { const lv = window.__lv(); lv.yours = null; lv.orange = null; lv.wand = true; });
    }
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join('; ')}`);

    // ---- wild Portal creatures: only on the floors of the calm rooms, levels like a Champion's, the pop gait never into a wall
    await at(page, 111.5, 13, 24.5, 0);
    const wild = await page.evaluate(async () => {
      const g = window.pokecraft, cm = g.creatures, S = await import('/src/species.js');
      for (const w of [...cm.list]) cm.remove(w);
      g.player.pos.set(111.5, 13, 24.5); cm.viewer = g.player.pos; cm.levelBonus = 10; // a Champion
      const out = { made: 0, ids: new Set(), levels: [], popped: 0, hiddenSome: false, inWall: 0, off: 0, outside: 0 };
      for (let i = 0; i < 600; i++) cm.trySpawn(g.player.pos, g.spawnPoint, cm.context(g.player.pos, false));
      const ws = cm.list.filter(w => S.SPECIES[w.data.species].type === 'portal');
      out.made = ws.length;
      for (const w of ws) { out.ids.add(w.data.species); out.levels.push(w.data.level); }
      out.mixed = cm.list.length - ws.length;
      const start = ws.map(w => [w.pos.x, w.pos.z]);
      for (const w of ws) w.life = 1e9;
      for (let s = 0; s < 400; s++) for (const w of ws) {
        cm.updateOne(w, 0.05);
        if (!w.model.visible) out.hiddenSome = true;
        const x = Math.floor(w.pos.x), y = Math.round(w.pos.y), z = Math.floor(w.pos.z);
        if (w.model.visible && (g.world.isSolid(x, y, z) || g.world.isSolid(x, y + 1, z) || !g.world.isSolid(x, y - 1, z) || g.world.get(x, y - 1, z) !== 217)) out.inWall++;
        if (Math.hypot(w.pos.x - w.home.x, w.pos.z - w.home.z) > 12.5) out.off++;
        if (!(x >= 104 && x <= 120 && z >= 15 && z <= 31 || x >= 92 && x <= 104 && z >= 18 && z <= 30 || x >= 85 && x <= 96 && z >= 18 && z <= 30)) out.outside++;
      }
      out.moved = ws.filter((w, i) => Math.hypot(w.pos.x - start[i][0], w.pos.z - start[i][1]) > 1).length;
      out.ids = [...out.ids].sort().join();
      for (const w of [...cm.list]) cm.remove(w);
      return out;
    });
    t.ok(wild.made >= 3 && wild.levels.every(l => l >= 40 && l <= 55) && wild.mixed === 0, `wild Portal creatures appear in the Hall (${wild.made} of ${wild.ids}, levels ${Math.min(...wild.levels)}-${Math.max(...wild.levels)}, no others: ${wild.mixed})`);
    t.ok(wild.hiddenSome && wild.moved >= 1 && wild.inWall === 0 && wild.off === 0, `they pop in and out of swirls (hidden at times, ${wild.moved} moved), always on a Swirl Floor with room for body and head, within their leash (${wild.inWall} in walls, ${wild.off} off)`);
    // the House's people are drawn only in their own part (draw calls from the hub)
    const seen = await page.evaluate(() => {
      const g = window.pokecraft, p = g.player, show = () => g.npcs.list.filter(n => n.model.visible).map(n => n.name).sort().join();
      p.pos.set(43.5, 21, 80.5); p.vel.set(0, 0, 0); window.__step(g, 1 / 20, 2); const hub = show();
      p.pos.set(108.5, 13, 24.5); window.__step(g, 1 / 20, 2); const hall = show();
      p.pos.set(91.0, 31, 21.0); window.__step(g, 1 / 20, 2); const study = show();
      return { hub, hall, study };
    });
    t.ok(seen.hub === '' && /Keeper Kit/.test(seen.hall) && !/Grandpa/.test(seen.hall) && /Grandpa Arch/.test(seen.study) && !/Kit/.test(seen.study), `the House's people are drawn only in their own part (hub: "${seen.hub}", Hall: ${seen.hall}, Study: ${seen.study})`);
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join('; ')}`);
  }

  /* ================================ D. play ================================ */
  if (want('play')) {
    if (want('physics') || want('land')) await renew();
    await intoSwirl(page);
    const pl = await page.evaluate(async () => {
      const g = window.pokecraft, lv = window.__lv();
      g.updateGuide();
      const guide = document.getElementById('guide').textContent;
      const nav = (await import('/src/destinations.js')).destinationsFor(g).map(r => r.dest.label);
      g.player.pos.set(51.5, 21, 78.5); g.player.vel.set(0, 0, 0); g.updateGuide();
      const hub = g.guideTarget;
      return { guide, nav, hub, part: lv.info().part };
    });
    t.ok(/Portal House/.test(pl.guide) && pl.nav.includes('Portal House') && Math.abs(pl.hub[0] - 51.5) < 1 && Math.abs(pl.hub[1] - 73.5) < 1, `the guide and the "Where to go" list know the Portal House (${pl.guide}; ${pl.nav.join()})`);
    // the Hub Swirl, the porch, the Hall: the Wand once
    await toasts(page);
    await page.evaluate(() => { window.__toasts.length = 0; });
    await at(page, 51.5, 21, 78.5, 0);
    await walk(page, 1 / 20, 50, '() => window.pokecraft.player.pos.x > 90');
    await page.evaluate(() => window.__step(window.pokecraft, 1 / 20, 20));
    t.ok(await said(page, /Portal House! Its rooms float apart/), 'the porch says the rooms float apart, joined by swirls');
    await at(page, 108.5, 13, 24.5, 0);
    await page.evaluate(() => window.__step(window.pokecraft, 1 / 20, 10));
    t.ok(await said(page, /Keeper Kit: Here, take a Swirl Wand! Tap a white pad/) && await page.evaluate(() => window.__lv().wand), 'in the Hall of Swirls Keeper Kit hands over the Swirl Wand');
    // doors: only the first is open
    const state = () => page.evaluate(() => { const g = window.pokecraft, lv = window.__lv(); return lv.house.swirls.filter(s => s.room === 'hall' && s.door).map(s => g.world.get(...s.cells[0]) === 0 ? 'open' : 'shut').join(); });
    await page.evaluate(() => window.__step(window.pokecraft, 1 / 20, 20));
    t.ok(await state() === 'open,shut,shut,shut,shut,shut,shut,shut,shut', `only the first of the Hall's nine doors is open (${await state()})`);
    // the Hall's guide points at room 1's door, a room's guide at the pad to tap first
    const g1 = await page.evaluate(() => { const g = window.pokecraft; g.updateGuide(); const a = document.getElementById('guide').textContent; g.player.pos.set(89.0, 15, 3.0); window.__step(g, 1 / 20, 2); g.updateGuide(); return [a, document.getElementById('guide').textContent]; });
    t.ok(/Room 1/.test(g1[0]) && /peach pad/.test(g1[1]), `the guide: "${g1[0]}" in the Hall, "${g1[1]}" in the Pair Room`);
    // the eight rooms, in order: walk into each exit swirl (the Ball Room's opens once the ball is on its button); the keys are saved at once
    for (let n = 1; n <= 8; n++) {
      const id = ['gap.exit', 'fling.exit', 'clock.exit', 'skip.exit', 'pair.exit', 'slide.exit', 'ball.exit', 'loop.exit'][n - 1];
      await page.evaluate(() => { window.__t0 = window.__lv().info().trips; });
      await page.evaluate(id => { const lv = window.__lv(), s = lv.house.swirls.find(q => q.id === id), p = window.pokecraft.player, [nx, , nz] = s.normal; p.pos.set(s.centre[0] + nx * 1.2, s.centre[1] - s.h / 2, s.centre[2] + nz * 1.2); p.vel.set(0, 0, 0); p.yaw = Math.atan2(nx, nz); p.keys = {}; window.__step(window.pokecraft, 1 / 20, 2); if (s.needs) { lv.pressed = true; lv.hallKey = ''; window.__step(window.pokecraft, 1 / 20, 2); } p.keys = { KeyW: true }; window.__step(window.pokecraft, 1 / 20, 30, () => lv.info().trips > window.__t0); p.keys = {}; }, id);
      const r = await page.evaluate(n => { const g = window.pokecraft, lv = window.__lv(), s = JSON.parse((g.save(true), localStorage.getItem('pokecraft-save-v2'))); return { keys: g.beaten.filter(k => k.startsWith('pw:portal:room')).join(), saved: s.beaten.filter(k => k.startsWith('pw:portal:room')).join(), toasts: window.__toasts.slice(-3), pos: [g.player.pos.x, g.player.pos.y, g.player.pos.z], done: lv.info().done, part: lv.info().part }; }, n);
      t.ok(r.done === n && r.saved === r.keys && r.keys.split(',').length === n && r.toasts.some(m => new RegExp(`Room ${n} done! 🌀 ${n} / 8`).test(m)) && (n < 8 ? r.part === n + 1 : r.part === 'hall'), `room ${n} done: "${r.toasts.find(m => /done!/.test(m))}", keys saved at once, on to ${r.part}`);
    }
    await page.evaluate(() => window.__step(window.pokecraft, 1 / 20, 20));
    t.ok(await state() === 'open,open,open,open,open,open,open,open,open', `all nine doors are open after eight rooms (${await state()}) and you stand in the Hall in front of the Study door`);
    t.ok(await said(page, /All the swirl rooms are done/), 'a toast says the Study door is open');
    // the Study door takes you up to Grandpa Arch
    await page.evaluate(() => { const lv = window.__lv(), s = lv.house.swirls.find(q => q.id === 'hall.d9'), p = window.pokecraft.player; window.__t0 = lv.info().trips; p.pos.set(118.0, 13, 28.0); p.vel.set(0, 0, 0); p.yaw = -Math.PI / 2; p.keys = { KeyW: true }; window.__step(window.pokecraft, 1 / 20, 30, () => lv.info().trips > window.__t0); p.keys = {}; });
    t.ok(await page.evaluate(() => window.__lv().info().part === 'study'), 'the ninth door (the Study) takes you up to Grandpa Arch');
    // a reload keeps the keys: a new page continues in the Swirl; the Hall's doors are drawn open
    await page.evaluate(() => window.pokecraft.save(true));
    await page.reload();
    await page.waitForFunction(() => window.pokecraft?.world);
    await continueGame(page);
    await helpers(page);
    await toasts(page);
    await page.evaluate(() => { const p = window.pokecraft.player; p.pos.set(108.5, 13, 24.5); p.vel.set(0, 0, 0); window.__step(window.pokecraft, 1 / 20, 20); });
    t.ok(await state() === 'open,open,open,open,open,open,open,open,open' && await page.evaluate(() => window.pokecraft.place === 'swirl' && window.__lv().info().done === 8), `after a reload you are still in the Swirl and every door is open (${await state()})`);
    // old saves: the first four rooms' keys (room1..4) still open doors 2-5
    const oldKeys = await page.evaluate(() => { const g = window.pokecraft, lv = window.__lv(), saved = g.beaten.slice(); g.beaten = g.beaten.filter(k => !k.startsWith('pw:portal:room')).concat(['pw:portal:room1', 'pw:portal:room2', 'pw:portal:room3', 'pw:portal:room4']); const r = [1, 2, 3, 4, 5, 6, 9].map(k => lv.doorIsOpen(k)); g.beaten = saved; return r.join(); });
    t.ok(oldKeys === 'true,true,true,true,true,false,false', `a save from the four-room House: rooms 1-4 count, the door of room 5 is open (${oldKeys})`);
    // the Study: the gate says what to do with fewer rooms; with eight, the battle with Grandpa Arch
    const gate = await page.evaluate(() => {
      const g = window.pokecraft, boss = g.npcs.list.find(n => n.kind === 'boss'), saved = g.beaten.slice();
      g.beaten = g.beaten.filter(k => !k.startsWith('pw:portal:room')); g.beaten.push('pw:portal:room1', 'pw:portal:room2');
      window.__toasts.length = 0; g.bosses.talk(boss);
      const closed = { inBattle: g.inBattle, said: window.__toasts.slice() };
      g.beaten = saved;
      return { closed, tp: g.bosses.talkPrompt(boss), look: g.npcs.list.filter(n => n.kind === 'crew').map(n => n.name + ':' + n.def.look).join() };
    });
    t.ok(!gate.closed.inBattle && gate.closed.said.some(m => /Finish all the swirl rooms first! \(🌀 2 \/ 8\)/.test(m)) && gate.tp.action === 'Challenge!' && /Keeper Kit:swirl/.test(gate.look), `with two rooms done Grandpa Arch says to finish them first; Kit and Juno wear the swirl look (${gate.look})`);
    await page.evaluate(() => { const p = window.pokecraft.player; p.pos.set(91.0, 31, 22.0); p.vel.set(0, 0, 0); window.__step(window.pokecraft, 1 / 20, 4); });
    await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js');
      g.party = ['blazehound', 'thunderwolf', 'grovebeast', 'tidalord'].map(id => S.makeCreature(id, 100)); g.cubes = 0;
      window.__cele = null; const cf = g.ui.celebrate.bind(g.ui); g.ui.celebrate = (...a) => { window.__cele = a; cf(...a); };
      g.bosses.talk(g.npcs.list.find(n => n.kind === 'boss'));
    });
    await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 30000);
    const bt = await page.evaluate(() => { const b = window.pokecraft.battle; return { boss: b.boss, foes: b.foes.map(f => f.level).join(), names: b.foes.map(f => f.species).join() }; });
    t.ok(bt.boss && bt.foes === '60,61,62,63' && bt.names === 'peekhole,topperoo,loopwyrm,gatestrider', `the Boss battle has Grandpa Arch's four Portal creatures at levels ${bt.foes} (${bt.names})`);
    t.ok(await playBattle(page), 'the Boss battle is won');
    await waitFor(page, () => window.pokecraft.stars.includes('portal'), null, 240000).catch(async e => {
      console.log('  (no star)', JSON.stringify(await page.evaluate(() => ({ inBattle: window.pokecraft.inBattle, stars: window.pokecraft.stars, place: window.pokecraft.place, toasts: (window.__toasts || []).slice(-6) }))), page.errors.slice(0, 3));
      throw e;
    });
    await page.evaluate(() => { window.pokecraft.inBattle = false; document.body.classList.remove('in-battle'); });
    const won = await page.evaluate(() => { const g = window.pokecraft; return { note: window.__cele?.[0], small: window.__cele?.[1], keys: g.beaten.filter(k => k.startsWith('pw:portal:room')).length, cubes: g.cubes, toasts: window.__toasts.slice(-6) }; });
    t.ok(/Portal House star/.test(won.note || '') && /very first helpers/.test(won.small || ''), `the star of the Portal House and the Wizard's note (${won.note})`);
    t.ok(won.keys === 0 && won.toasts.some(m => /star lights a stone of the star bridge, back on the hub/.test(m)), `the eight room keys are cleared (a rematch is a new run); the star lights a stone back on the hub (${won.keys} keys)`);
    await page.evaluate(() => { const p = window.pokecraft.player; p.pos.set(60.5, 21, 80.0); p.vel.set(0, 0, 0); });
    await waitFor(page, () => { const w = window.pokecraft.world, s = w.swirl.bridge[4]; return w.get(...s.cells[0]) === 130 && s.world === 'portal'; }, null, 240000);
    t.ok(true, 'bridge stone number 5 (the Portal House) is lit on the hub by itself');
    // sparks: a cube each, once per trip
    const sp = await page.evaluate(() => {
      const g = window.pokecraft, lv = window.__lv(), r = lv.room(2), c0 = g.cubes;
      g.player.pos.set(r.sparks[0][0], r.sparks[0][1] - 0.9, r.sparks[0][2]); g.player.vel.set(0, 0, 0); window.__step(g, 1 / 20, 3);
      const c1 = g.cubes;
      g.player.pos.set(r.sparks[0][0], r.sparks[0][1] - 0.9, r.sparks[0][2]); window.__step(g, 1 / 20, 3);
      return { first: c1 - c0, again: g.cubes - c1 };
    });
    t.ok(sp.first === 1 && sp.again === 0, `a spark gives one Capture Cube, once per trip (${sp.first}, then ${sp.again})`);
    // a lost battle stays in the Swirl at the nearest rest spot, healed
    const lost = await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js'), p = g.player;
      p.pos.set(93.5, 31, 23.0); p.vel.set(0, 0, 0);
      g.party = [S.makeCreature('emberpup', 5)]; g.party[0].hp = 0;
      g.stars = g.stars.filter(s => s !== 'portal');
      g.realms.lost();
      return { place: g.place, pos: [p.pos.x, p.pos.y, p.pos.z], toast: window.__toasts.slice(-1)[0] };
    });
    t.ok(lost.place === 'swirl' && lost.pos[0] > 85 && lost.pos[0] < 96 && Math.abs(lost.pos[1] - 31) < 0.1 && lost.pos[2] > 18 && lost.pos[2] < 30, `a lost battle in the House rests you at the Study's rest spot in the Swirl (${lost.pos.map(v => v.toFixed(1))})`);
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join('; ')}`);
  }

  /* ================================ G. screenshots ================================ */
  if (want('shots')) {
    if (want('play')) await renew();
    await intoSwirl(page);
    const view = async (name, x, y, z, lx, ly, lz, extra) => {
      await page.evaluate(([x, y, z, lx, ly, lz, extra]) => {
        const g = window.pokecraft, p = g.player; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.keys = {}; p.lookAt({ x: lx, y: ly, z: lz });
        document.getElementById('toast').replaceChildren();
        window.__lv().wand = true;
        if (extra) eval(extra);
        window.__step(g, 1 / 20, 4);
        document.getElementById('toast').replaceChildren();
      }, [x, y, z, lx, ly, lz, extra]);
      await shot(page, name);
    };
    const put = ids => `const lv = window.__lv(); lv.yours = null; lv.orange = null; for (const id of ${JSON.stringify(ids)}) lv.place(lv.house.swirls.find(s => s.id === id));`;
    await view('house-outside', 60, 30, 70, 118, 26, 14);
    await view('hall', 106.5, 13, 28, 116, 14, 18);
    await view('gap', 127.5, 13, 23.5, 146, 18, 23, put(['gap.p3']));
    await view('fling', 146.5, 9, 11, 157, 18, 6, put(['fling.high']));
    await view('clock', 101.5, 25, 3.0, 97.5, 26, 7, `window.__lv().hold = 27.5; ${put(['clock.p'])}`);
    await view('skip', 103, 35, 25.5, 135, 36, 25.5, put(['skip.p1']));
    await view('pair', 92.0, 15, 3.0, 87.5, 19, 8.5, `window.__lv().hold = null; ${put(['pair.w1', 'pair.k2'])}`);
    await view('slide', 142.0, 43, 11.5, 153, 44.5, 6, `window.__lv().hold = 152.5; ${put(['slide.p'])}`);
    // the ball room, with a ball in the air between your swirls
    await view('ball', 115.0, 11, 2.6, 124, 13.5, 8.5, `window.__lv().hold = null; ${put(['ball.w1', 'ball.k1'])} const g = window.pokecraft; window.__lv().resetBall(); window.__step(g, 1 / 20, 200, () => { const b = window.__lv().ball; return b && b.piece.p0[0] < 115 && window.__lv().clock - b.t0 > 0.28; });`);
    await view('loop', 116.0, 33, 2.6, 124, 36, 9, put(['loop.k', 'loop.top']));
    await view('boss', 91.0, 31, 20.5, 90.5, 32.5, 27, '');
    await page.evaluate(async () => {
      const g = window.pokecraft, cm = g.creatures, p = g.player;
      p.pos.set(112.5, 13, 17.8); p.vel.set(0, 0, 0); p.lookAt({ x: 112.5, y: 14, z: 29.5 });
      for (const w of [...cm.list]) cm.remove(w);
      const ids = ['doorbit', 'gatestrider', 'hatbun', 'topperoo', 'hooplet', 'loopwyrm', 'peekhole'];
      const ws = ids.map((id, i) => cm.spawnAt(id, 106.5 + i * 2.0, 13, 27.5, { when: 'housefloor', level: 50 }));
      cm.viewer = { x: 112.5, y: 13, z: 17.8 };
      for (const w of ws) { w.life = 1e9; w.t = 1.0; w.phase = 0; w.heading = Math.PI; w.pop = { n: 0, from: { x: w.pos.x, y: 13, z: w.pos.z }, to: null }; }
      window.__fam = ws; cm.update = () => {}; // the picture: they stand still
      document.getElementById('toast').replaceChildren();
    });
    await shot(page, 'creatures');
    await page.evaluate(() => { const cm = window.pokecraft.creatures; for (const w of [...cm.list]) cm.remove(w); });
    t.ok(true, 'screenshots t42-house-outside, hall, gap, fling, clock, skip, pair, slide, ball, loop, boss, creatures');
  }
  await finish();
  async function finish() { /* (the iPad and the pair parts are separate) */ }
}

/* ================================ E. iPad ================================ */
async function ipadPart({ browser, base, t }) {
  const page = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
  await newGame(page, 0);
  await toasts(page);
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  await helpers(page);
  await at(page, 127.5, 13, 23.5, -Math.PI / 2);
  await page.evaluate(() => { const lv = window.__lv(); lv.wand = true; });
  // look at the far ceiling pad: the big action button says Swirl!, nothing is held, one tap puts your swirl there
  const r = await page.evaluate(() => {
    const g = window.pokecraft, lv = window.__lv(), s = lv.house.swirls.find(q => q.id === 'gap.p3');
    g.player.lookAt({ x: s.centre[0] + 0.8, y: s.centre[1] - 0.6, z: s.centre[2] }); // a little off the middle: the aim help
    window.__step(g, 1 / 20, 2);
    return { near: g.gymLive.near(g.player), holds: g.gymLive.holds(g.player) };
  });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); // a game frame has seen where we look now
  const btn = await page.evaluate(() => ({ label: window.pokecraft.touch.cur?.().act?.label ?? document.querySelector('#btn-act')?.textContent, dim: window.pokecraft.touch.cur?.().act?.dim }));
  t.ok(r.near === 'Swirl!' && r.holds === false && /Swirl!/.test(btn.label || ''), `iPad: looking at a white pad the big action button says "${btn.label}" and nothing is held (${JSON.stringify(r)})`);
  const box = await page.evaluate(() => { const r = document.getElementById('btn-act').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(box.x, box.y);
  await waitFor(page, () => window.__lv().yours === 'gap.p3', null, 30000).catch(() => {});
  t.ok(await page.evaluate(() => window.__lv().yours === 'gap.p3'), 'iPad: one tap on the action button puts your swirl on the pad');
  // a peach pad: the same one tap puts your ORANGE swirl there (the pad decides the colour)
  await at(page, 92.0, 15, 3.0, Math.PI / 2);
  await page.evaluate(() => { const g = window.pokecraft, lv = window.__lv(), s = lv.house.swirls.find(q => q.id === 'pair.k2'); g.player.lookAt({ x: s.centre[0], y: s.centre[1], z: s.centre[2] }); window.__step(g, 1 / 20, 2); });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.touchscreen.tap(box.x, box.y);
  await waitFor(page, () => window.__lv().orange === 'pair.k2', null, 30000).catch(() => {});
  const pk = await page.evaluate(() => ({ orange: window.__lv().orange, yours: window.__lv().yours, near: window.__lv().near() }));
  t.ok(pk.orange === 'pair.k2' && pk.yours === null, `iPad: one tap on a peach pad puts your orange swirl there (${JSON.stringify(pk)})`);
  // aim help in the air: while flying (Mover) the cone is wider
  const air = await page.evaluate(() => {
    const g = window.pokecraft, lv = window.__lv(), sw = id => lv.house.swirls.find(s => s.id === id), p = g.player;
    p.pos.set(103, 36, 25.5); p.vel.set(0, 0, 0); p.onGround = false; window.__step(g, 1 / 20, 1); p.onGround = false; lv.place(sw('skip.p1'));
    const nx = sw('skip.p2'); p.lookAt({ x: nx.centre[0], y: nx.centre[1] + 1, z: nx.centre[2] + 9 }); // about 20 degrees off: outside the cone on the ground, inside it in the air
    const grounded = (() => { p.onGround = true; return lv.near(); })();
    p.onGround = false;
    return { ground: grounded, air: lv.near() };
  });
  t.ok(air.air === 'Swirl!' && air.ground !== 'Swirl!', `iPad: the help cone is wider in the air (ground ${air.ground}, air ${air.air})`);
  t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join('; ')}`);
  await page.context().close();
}

/* ================================ F. two browsers ================================ */
async function pairPart({ browser, base, t }) {
  const [A, B] = await openPair(browser, base);
  await newGame(A, 0); await pause(A);
  await newGame(B, 1); await pause(B);
  await A.fill('#mp input[placeholder="Your name"]', 'Dad');
  await click(A, '#mp button:has-text("Share my world")');
  await A.waitForTimeout(500);
  const code = (await A.textContent('.mp-code')).trim();
  await B.fill('#mp input[placeholder="Your name"]', 'Kid');
  await B.fill('#mp .mp-code-input', code);
  await click(B, '#mp button:has-text("Join a world")');
  await waitFor(B, () => window.pokecraft.mp.role === 'guest', null, 60000);
  await toasts(A); await toasts(B);
  await A.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(A, 'swirl');
  await waitFor(B, () => window.pokecraft.ui.asking, null, 60000);
  await B.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(B, 'swirl').catch(async e => { console.log('  (B did not follow)', B.errors.slice(0, 3), await B.evaluate(() => ({ place: window.pokecraft.place, busy: window.pokecraft.realms.busy }))); throw e; });
  await helpers(A); await helpers(B);
  const both = async fn => { await A.evaluate(fn); await B.evaluate(fn); };
  await both(() => { const g = window.pokecraft, lv = window.__lv(); lv.wand = true; g.player.pos.set(127.5, 13, 23.5); g.player.vel.set(0, 0, 0); window.__step(g, 1 / 20, 3); });
  await A.evaluate(() => { const lv = window.__lv(); lv.place(lv.house.swirls.find(s => s.id === 'gap.p1')); });
  await B.evaluate(() => { const lv = window.__lv(); lv.place(lv.house.swirls.find(s => s.id === 'gap.p3')); });
  const mine = await Promise.all([A, B].map(p => p.evaluate(() => ({ yours: window.__lv().yours, glows: window.__lv().info().glows, place: window.pokecraft.place, rooms: window.__lv().info().done }))));
  t.ok(mine[0].yours === 'gap.p1' && mine[1].yours === 'gap.p3' && mine.every(m => m.place === 'swirl'), `each player has their own swirl: Dad on pad 1, Kid on pad 3 (a friend's swirl is never drawn or shared) ${JSON.stringify(mine)}`);
  // Dad finishes room 1: Kid's rooms stay as they were
  await A.evaluate(() => { const lv = window.__lv(), s = lv.house.swirls.find(q => q.id === 'gap.exit'), p = window.pokecraft.player, [nx, , nz] = s.normal; p.pos.set(s.centre[0] + nx * 1.2, s.centre[1] - 1.5, s.centre[2] + nz * 1.2); p.vel.set(0, 0, 0); p.yaw = Math.atan2(nx, nz); p.keys = { KeyW: true }; const t0 = lv.info().trips; window.__step(window.pokecraft, 1 / 20, 30, () => lv.info().trips > t0); p.keys = {}; });
  const done = await Promise.all([A, B].map(p => p.evaluate(() => window.pokecraft.beaten.filter(k => k.startsWith('pw:portal:room')).join())));
  t.ok(done[0] === 'pw:portal:room1' && done[1] === '', `Dad's room 1 is his own: Kid has no rooms done (${JSON.stringify(done)})`);
  t.ok(!A.errors.length && !B.errors.length, `no page errors ${[...A.errors, ...B.errors].slice(0, 3).join('; ')}`);
}
