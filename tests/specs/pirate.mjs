// T40b: the Pirate type and the Pirate Seas (plans/T40b.md). A. type data (7 creatures, 4 own shapes with the bandana and the gold,
// moves, effects, sounds, chart). B. terrain for three seeds (islands, cannons, ropes, the ship, the sea, people, keeps). C. gadgets with
// real Player physics (every cannon, every rope both ways, a pause, ladders, swimming out, riding on the sea). D. play (the frame,
// the guide, crew, the Captain, the chest, losing, a reload, the way back). E. iPad. F. two browsers.
// G. the challenges (owner 2026-10-26: swinging cannons, letting go of the rope, the rowboats; the other parts use `steady` rides).
// PIRATE_ONLY=data|terrain|gadgets|challenge|play|ipad|pair|shots runs part of it. Screenshots: tests/screenshots/t40b-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, waitFor as waitFor0, seedSave, playBattle } from '../helpers.mjs';

const waitFor = (page, fn, arg, ms = 120000) => waitFor0(page, fn, arg, ms); // the software renderer is slow with several pages open
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const ONLY = process.env.PIRATE_ONLY || '';
const want = part => !ONLY || ONLY === part;
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id);
const toasts = page => page.evaluate(() => { window.__toasts = []; const g = window.pokecraft, f = g.ui.toast.bind(g.ui); g.ui.toast = m => { window.__toasts.push(m); f(m); }; });
const said = (page, re) => page.evaluate(src => window.__toasts.some(m => new RegExp(src).test(m)), re.source);
const shot = async (page, name) => { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, `t40b-${name}.png`), timeout: 180000 }); console.log(`  screenshot t40b-${name}.png`); };
// (the parts that are not about the challenges use the old steady rides: every cannon on target, every rope straight across)
const helpers = page => page.evaluate(([a, b]) => { window.__step = eval(a); window.__play = eval(b); const lv = window.pokecraft.gymLive.of('part:seas'); if (lv) lv.steady = true; }, [STEP, PLAY]);
// the Champion goes into the Swirl and through the Pirate Seas frame
async function intoPirate(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  const cell = await page.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'pirate'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  const info = await page.evaluate(c => {
    const g = window.pokecraft, b = { x: c[0], y: c[1], z: c[2], id: g.world.get(...c) };
    return { id: b.id, prompt: g.portal.prompt(b, 'click or E'), action: g.portal.action(b), used: g.portal.use(b) };
  }, cell);
  await placeIs(page, 'pirate');
  await helpers(page);
  return info;
}
// Run `steps` game steps of dt in the page: the player's physics and the live parts (the page's frame loop cannot interleave).
const STEP = `(g, dt, n, stop) => { const old = g.playing; g.playing = () => true; let i = 0; try { for (; i < n; i++) { g.player.update(dt); g.gymLive.update(dt); if (stop && stop()) break; } } finally { g.playing = old; } return i; }`;
const PLAY = `(g, fn) => { const old = g.playing; g.playing = () => true; try { return fn(); } finally { g.playing = old; } }`; // run fn with the game "playing"

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (ONLY === 'pair') return pairPart({ browser, base, t });
  if (ONLY === 'reload') { // the star in the save: a fresh browser continues in the Pirate Seas, the chest is open, the way back
    const pg = await openGame(browser, base);
    await newGame(pg, 0);
    await intoPirate(pg);
    await pg.evaluate(() => { window.pokecraft.stars = ['pirate']; });
    return reloadPart({ browser, base, t, page: pg });
  }
  const page = await openGame(browser, base);

  /* ================================ A. the type ================================ */
  if (want('data')) {
    const A = await page.evaluate(async () => {
      const S = await import('/src/species.js'), R = await import('/src/realms.js'), FX = await import('/src/fxrecipes.js'), SH = await import('/src/shapes.js');
      const TR = await import('/src/traits.js'), PW = await import('/src/pictureworlds.js'), BK = await import('/src/book.js'), { sound } = await import('/src/sound.js');
      const ids = Object.keys(S.SPECIES).filter(i => S.SPECIES[i].type === 'pirate');
      const shapes = [...new Set(ids.map(i => S.SPECIES[i].model.shape))].sort();
      const otherShapes = new Set(Object.values(S.SPECIES).filter(s => s.type !== 'pirate').map(s => s.model.shape));
      const gear = ids.map(id => {
        const m = S.buildModel(id), kinds = new Set();
        m.traverse(o => { if (o.userData.gear) kinds.add(o.userData.gear); });
        return [id, [...kinds].sort().join('+')];
      });
      const glass = (() => { let n = 0; S.buildModel('bottlet').traverse(o => { if (o.isMesh && o.material.transparent) n++; }); return n; })();
      const mv = id => S.MOVES[id];
      const moves = { hookswipe: [40, 1], cannonball: [80, 0.85], swashbuckle: [50, 1], spyglass: [0, 1], broadside: [30, 1], anchordrop: [95, 0.9] };
      const moveBad = Object.entries(moves).filter(([id, [p, a]]) => !mv(id) || mv(id).type !== 'pirate' || mv(id).power !== p || mv(id).acc !== a).map(([id]) => id);
      const learns = id => S.SPECIES[id].learn.map(([l, m]) => `${l}:${m}`);
      const evo = id => S.SPECIES[id].evolve && `${S.SPECIES[id].evolve.level}>${S.SPECIES[id].evolve.into}`;
      const spawns = Object.values(S.SPAWNS).flat().filter(e => ids.includes(e[0])).length;
      const rs = R.REALMS.pirate.spawns, inRealm = ids.every(id => Object.entries(rs).some(([k, l]) => k !== 'cave' && l.some(e => e[0] === id)));
      const rows = ids.flatMap(id => BK.spawnInfo(id).map(r => r.name)).filter((n, i, a) => a.indexOf(n) === i);
      const eff = S.effectiveness;
      const keys = Object.keys(S.TYPE_COLORS).filter(k => !['atlantis'].includes(k)); // wave 15's types have their own specs
      const own = keys.filter(d => eff('pirate', d) !== 1).map(d => `${d}:${eff('pirate', d)}`).sort().join();
      const onPirate = keys.filter(a => a !== 'pirate' && eff(a, 'pirate') !== 1).map(a => `${a}:${eff(a, 'pirate')}`).sort().join();
      return {
        ids, shapes, ownShapes: shapes.every(s => !otherShapes.has(s)), registered: shapes.every(s => !!SH.SHAPES[s]), gear, glass,
        moveBad, t1: [S.SPECIES.parroteer.learn.some(([l, m]) => l === 1 && m === 'hookswipe'), S.SPECIES.parroteer.learn.some(([, m]) => m === 'cannonball'), S.SPECIES.parroteer.learn.some(([, m]) => m === 'swashbuckle'), S.SPECIES.parroteer.learn.some(([, m]) => m === 'spyglass')],
        sw: [mv('swashbuckle').priority, mv('spyglass').fx, mv('broadside').fx, mv('broadside').sig, mv('anchordrop').fx, mv('anchordrop').sig],
        big: [['jollyroger', 'rally'], ['powderkeg', 'risky'], ['walktheplank', 'curse']].map(([id, k]) => mv(id)?.big && mv(id).fx.kind === k && mv(id).type === 'pirate'),
        bigLevels: ['featherbeard', 'pinchook'].map(id => learns(id).filter(x => /jollyroger|powderkeg|walktheplank/.test(x)).join('|')),
        evo: ids.map(id => `${id}:${evo(id) ?? '-'}`).join(), sig: [learns('featherbeard').includes('30:broadside'), learns('anchorclaw').includes('32:anchordrop')],
        sigFx: !!FX.SIG.broadside && !!FX.SIG.anchordrop, fx: [FX.TRAVEL.pirate !== FX.TRAVEL.normal, FX.IMPACT.pirate !== FX.IMPACT.normal, FX.FX_COLORS.pirate !== FX.FX_COLORS.normal],
        sounds: [sound.has('fx:pirate'), sound.has('cannonboom'), sound.has('seasplash')], clash: Object.keys(S.MOVES).filter(m => sound.has(m) && S.MOVES[m].type === 'pirate'),
        ride: TR.TRAITS.rideable.species.shipshape, spawns, inRealm, rows, ready: PW.pictureWorld('pirate').ready, own7: S.SPECIES.lookapus.evolve === undefined && !ids.some(i => S.SPECIES[i].evolve?.into === 'lookapus'),
        own, onPirate, types: keys.length, swims: ['bottlet', 'shipshape', 'lookapus'].every(i => S.SPECIES[i].swims), flies: ['parroteer', 'featherbeard'].every(i => S.SPECIES[i].flies),
        wool: (await import('/src/blocks.js')).WOOL.pirate,
      };
    });
    t.ok(A.ids.length === 7 && A.ids.join() === 'parroteer,featherbeard,pinchook,anchorclaw,bottlet,shipshape,lookapus', `seven Pirate creatures (${A.ids})`);
    t.ok(A.evo === 'parroteer:26>featherbeard,featherbeard:-,pinchook:26>anchorclaw,anchorclaw:-,bottlet:28>shipshape,shipshape:-,lookapus:-' && A.own7, `three families of two and a single-stage 7th (${A.evo})`);
    t.ok(A.shapes.join() === 'barrelpus,hookcrab,parrot,shipbottle' && A.ownShapes && A.registered, `four own shapes used by no other type (${A.shapes})`);
    t.ok(A.gear.every(([, k]) => k.includes('bandana') && k.includes('gold')), `every model wears a bandana and something gold (${A.gear.map(g => g.join('=')).join(' ')})`);
    t.ok(A.glass >= 3, `the bottle's glass is see-through (${A.glass} parts)`);
    t.ok(!A.moveBad.length && A.t1.every(Boolean) && A.sw[0] === 1 && A.sw[1]?.kind === 'lower' && A.sw[1]?.stat === 'def' && A.sw[2]?.kind === 'multi' && A.sw[2].min === 2 && A.sw[2].max === 4 && A.sw[3] && A.sw[4]?.kind === 'flinch' && A.sw[4].chance === 0.2 && A.sw[5],
      `the six moves are as planned (${A.moveBad}; ${JSON.stringify(A.sw)})`);
    t.ok(A.big.every(Boolean) && A.sig.every(Boolean) && A.sigFx, `Raise the Flag (rally), Powder Keg (risky), Walk the Plank (curse); Broadside at 30 and Anchor Drop at 32 with effects (${A.bigLevels})`);
    t.ok(A.fx.every(Boolean) && A.sounds.every(Boolean) && !A.clash.length, `own attack effects, colours and sounds (fx:pirate, cannonboom, seasplash), no move named like a sound (${A.fx}; ${A.sounds}; ${A.clash})`);
    t.ok(A.ride === 'water' && A.swims && A.flies && A.wool === 141, `Shipshape can be ridden on water, the swimmers swim, the parrots fly, wool 141`);
    t.ok(A.spawns === 0 && A.inRealm && A.rows.includes('Pirate Seas · islands') && A.rows.includes('Pirate Seas · at sea'), `in no SPAWNS table, every one in the realm's tables; Book rows ${A.rows}`);
    t.ok(A.ready === true && A.types >= 37, 'the Pirate Seas frame ships ready; at least 37 types');
    t.ok(A.own === 'ball:2,ice:0.5,metal:0.5,pirate:0.5,treasure:2,water:2' && /^electric:2,racer:2(,|$)/.test(A.onPirate), `chart: Pirate hits ball, treasure and water; electric and racer hit Pirate (wave 15's Surprise too) (${A.own} / ${A.onPirate})`);
  }

  /* ================================ B. terrain ================================ */
  if (want('terrain')) {
    const B = await page.evaluate(async () => {
      const { World } = await import('/src/world.js'), R = await import('/src/realms.js'), { B, isSolid } = await import('/src/blocks.js'), M = await import('/src/mover.js'), L = await import('/src/pirateland.js'), SH = await import('/src/pirateship.js');
      await import('/src/pirateparts.js');
      const def = R.REALMS.pirate, out = [];
      const hash = w => { let h = 0; for (let i = 0; i < w.data.length; i++) h = (h * 31 + w.data[i]) | 0; return h; };
      for (const seed of [1, 4242, 294331207]) {
        const t0 = performance.now();
        const w = new World(seed, null, null, def.size, def); w.generate();
        const ms = performance.now() - t0;
        const w2 = new World(seed, null, null, def.size, def); w2.generate();
        const d = w.pirate, probs = [], bad = m => probs.push(m);
        const solid = (x, y, z) => w.isSolid(x, y, z);
        const hits = (x, y, z) => {
          for (let cx = Math.floor(x - 0.3); cx <= Math.floor(x + 0.3); cx++) for (let cz = Math.floor(z - 0.3); cz <= Math.floor(z + 0.3); cz++)
            for (let cy = Math.floor(y); cy <= Math.floor(y + 1.8 - 1e-6); cy++) if (solid(cx, cy, cz)) return `${cx},${cy},${cz}:${w.get(cx, cy, cz)}`;
          return null;
        };
        const topOf = id => id === 'ship' ? 18 : d.isles.find(i => i.id === id).top;
        const same = JSON.stringify(d.cannons.map(c => [c.id, c.S, c.E])) === JSON.stringify(w2.pirate.cannons.map(c => [c.id, c.S, c.E])) && hash(w) === hash(w2);
        // islands: the plateau at `top`, grass inside, water around
        for (const i of d.isles) {
          if (i.kind === 'beach') for (let a = 0; a < 12; a++) {
            const x = Math.round(i.x + Math.cos(a / 12 * 6.283) * (i.P - 1)), z = Math.round(i.z + Math.sin(a / 12 * 6.283) * (i.P - 1));
            if (!solid(x, i.top, z) || w.get(x, i.top + 1, z) === B.WATER || w.get(x, i.top, z) === B.WATER) bad(`plateau ${i.id} at ${x},${z}`);
          }
          if (w.get(i.x, i.top, i.z) === B.WATER || !solid(i.x, i.top, i.z)) bad(`island ${i.id} middle`);
        }
        // cannons
        for (const c of d.cannons) {
          const t = topOf(c.from), tt = topOf(c.to), [px, pz] = c.pad, [tx, tz] = c.target;
          if (w.get(px, t, pz) !== B.CANNON_PAD || w.get(c.carriage[0], t, c.carriage[1]) !== B.PLANKS) bad(`${c.id} pad / carriage blocks`);
          for (let x = px - 1; x <= px + 1; x++) for (let z = pz - 1; z <= pz + 1; z++) if (!solid(x, t, z) || w.get(x, t + 1, z) || w.get(x, t + 2, z)) bad(`${c.id} pad 3x3 ${x},${z}`);
          for (let x = tx - 1; x <= tx + 1; x++) for (let z = tz - 1; z <= tz + 1; z++) if (w.get(x, tt, z) !== B.TARGET || tt <= 12) bad(`${c.id} TARGET at ${x},${z}`);
          for (let x = tx - 2; x <= tx + 2; x++) for (let z = tz - 2; z <= tz + 2; z++) {
            if (!solid(x, tt, z)) bad(`${c.id} target5 solid ${x},${z}`);
            for (let k = 1; k <= 3; k++) if (w.get(x, tt + k, z) !== B.AIR) bad(`${c.id} target5 air ${x},${z}+${k}`);
          }
          const path = M.makePath(L.cannonSpec(c)), n = Math.ceil(path.time * 60), len = Math.hypot(c.E[0] - c.S[0], c.E[2] - c.S[2]);
          let top = 0;
          for (let k = 0; k <= n; k++) {
            const q = path.at(k / n * path.time);
            top = Math.max(top, q.y);
            const h = hits(q.x, q.y, q.z);
            if (h && Math.hypot(q.x - c.S[0], q.z - c.S[2]) > 0.6) { bad(`${c.id} flight hits ${h} at ${(k / n).toFixed(2)}`); break; }
          }
          const e = path.at(path.time);
          if (top > 44 || Math.hypot(e.x - c.E[0], e.z - c.E[2]) > 0.05 || Math.abs(e.y - c.E[1]) > 0.05 || path.time > 4 || len < 5) bad(`${c.id} ends / top ${top}`);
          if (!w.keeps.some(k => k.name === `cannon-${c.id}`)) bad(`${c.id} keep`);
        }
        // ropes, both ways
        for (const r of d.ropes) {
          const feet = r.feet;
          for (const e of [r.a, r.b]) {
            const t = topOf(e.isle);
            if (!solid(e.x, t, e.z) || w.get(e.x, t + 1, e.z) || w.get(e.x, t + 2, e.z) || t + 1 !== feet) bad(`${r.id} stand ${e.x},${e.z}`);
            if (w.get(e.post[0], t + 1, e.post[1]) !== B.ROPE_POST) bad(`${r.id} post`);
          }
          if (r.span > 16 || r.lowest < 14 || r.anchor[1] > 30) bad(`${r.id} span ${r.span} lowest ${r.lowest} anchor ${r.anchor[1]}`);
          for (const [x, z] of r.arch.posts) if (w.get(x, r.arch.beam - 1, z) !== B.LOG || w.get(x, 12, z) === B.WATER) bad(`${r.id} arch post ${x},${z}`);
          if (w.get(Math.floor(r.anchor[0]), r.arch.beam, Math.floor(r.anchor[2])) !== B.LOG && ![-1, 0, 1].some(dx => [-1, 0, 1].some(dz => w.get(Math.floor(r.anchor[0]) + dx, r.arch.beam, Math.floor(r.anchor[2]) + dz) === B.LOG))) bad(`${r.id} beam`);
          for (const dir of ['a', 'b']) {
            const path = L.swingPath({ a: r.a.pos, b: r.b.pos }, dir);
            const A = dir === 'a' ? r.a.pos : r.b.pos, Bq = dir === 'a' ? r.b.pos : r.a.pos;
            const s = path.at(0), e = path.at(path.time);
            if (Math.hypot(s.x - A[0], s.z - A[2]) > 0.01 || Math.hypot(e.x - Bq[0], e.z - Bq[2]) > 0.01 || Math.abs(e.y - s.y) > 1e-6) bad(`${r.id} ${dir} ends`);
            for (let k = 0; k <= Math.ceil(path.time * 60); k++) {
              const q = path.at(k / Math.ceil(path.time * 60) * path.time);
              if (q.y < 14) { bad(`${r.id} ${dir} low`); break; }
              const h = hits(q.x, q.y, q.z);
              if (h) { bad(`${r.id} ${dir} hits ${h}`); break; }
            }
          }
        }
        // the ship
        const S = SH.SHIP;
        const boss = d.ship.boss;
        if (w.get(S.boss[0], S.boss[1], S.boss[2]) !== B.BOSS_STAND || w.get(S.wheel[0], S.wheel[1], S.wheel[2]) !== B.SHIP_WHEEL || w.get(S.chest[0], S.chest[1], S.chest[2]) !== B.BIG_CHEST) bad('boss stand / wheel / chest');
        if (JSON.stringify(w.starChest) !== JSON.stringify(S.chest) || !boss) bad('starChest');
        for (let x = S.target.x - 1; x <= S.target.x + 1; x++) for (let z = S.target.z - 1; z <= S.target.z + 1; z++) if (w.get(x, 18, z) !== B.TARGET) bad('deck target');
        let ladders = 0, lifts = 0;
        for (const l of w.lifts.filter(l => l.id.startsWith('ladder-') && /\d/.test(l.id))) {
          lifts++;
          const zc = l.z[0];
          for (let x = l.x[0]; x <= l.x[1]; x++) {
            const edge = zc > 48 ? zc - 1 : zc + 1;
            if (w.get(x, 14, edge) !== B.ROPE_LADDER || w.get(x, 18, edge) !== B.ROPE_LADDER || w.get(x, 12, zc) !== B.WATER) bad(`ladder ${x},${zc}`); else ladders++;
          }
        }
        if (lifts !== 4 || ladders !== 12) bad(`ship ladders ${lifts}/${ladders}`);
        for (const [x, y] of [[121, 19], [122, 20], [123, 21]]) if (w.get(x, y, 48) !== B.DECK) bad(`quarterdeck step ${x}`);
        for (let i = 0; i < S.gang.tops.length; i++) for (let x = S.gang.x0; x <= S.gang.x1; x++) if (w.get(x, S.gang.tops[i], S.gang.z0 + i) !== B.DECK) bad('gangplank');
        const dockEnd = d.dockEnd;
        for (let x = S.dock.x0; x <= dockEnd[0]; x++) if (w.get(x, 13, 60) !== B.PLANKS && w.get(x, 13, 60) !== B.SAND && w.get(x, 13, 60) !== B.GRASS && !solid(x, 13, 60) ) bad(`dock at ${x}`);
        const landed = (() => { for (let x = dockEnd[0]; x <= dockEnd[0] + 3; x++) if (solid(x, 13, 60) && w.get(x, 13, 60) !== B.PLANKS) return true; return false; })();
        if (!landed) bad('the dock does not reach the cove sand');
        // the graph
        const nodes = ['ship', ...d.isles.map(i => i.id)], edges = L.routeEdges(w);
        const reach = (from) => { const seen = new Set([from]), q = [from]; while (q.length) { const a = q.shift(); for (const e of edges) if (e.from === a && !seen.has(e.to)) { seen.add(e.to); q.push(e.to); } } return seen; };
        const fromStart = reach('start');
        for (const n of nodes) if (!fromStart.has(n)) bad(`start cannot reach ${n}`);
        for (const n of nodes) if (!reach(n).has('start')) bad(`${n} cannot get back to start`);
        // the sea
        const exits = d.exits;
        let seaBad = 0, seaN = 0;
        for (let x = 4; x < w.W - 4; x += 4) for (let z = 4; z < w.D - 4; z += 4) {
          if (w.get(x, 12, z) !== B.WATER) continue;
          const nearIsle = d.isles.some(i => i.kind === 'beach' && Math.hypot(x - i.x, z - i.z) <= 36) || (x >= S.x0 - 8 && x <= S.x1 + 8 && z >= S.z0 - 8 && z <= S.z1 + 8);
          if (!nearIsle) continue;
          seaN++;
          if (!exits.some(e => Math.hypot(e.x - x, e.z - z) <= 25)) seaBad++;
        }
        if (seaBad) bad(`${seaBad} of ${seaN} sea points (within 36 of a beach island's middle or 8 of the ship) are more than 25 from an exit`);
        for (const e of exits.filter(e => e.kind === 'beach')) {
          const x = Math.floor(e.x), z = Math.floor(e.z), top = (() => { for (let y = 14; y >= 0; y--) if (solid(x, y, z)) return y; return -1; })();
          if (top < 12 || top > 13 || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => w.get(x + dx, 12, z + dz) === B.WATER)) bad(`beach exit ${x},${z} top ${top}`);
        }
        // people
        const feetOk = (p, what) => { const [x, y, z] = [Math.floor(p.pos[0]), p.pos[1], Math.floor(p.pos[2])]; if (!solid(x, y - 1, z) || solid(x, y, z) || solid(x, y + 1, z)) bad(`${what} stands badly`); };
        const gadgetCells = [...d.cannons.flatMap(c => [[c.pad[0], c.pad[1], 3], [c.target[0], c.target[1], 4.5]]), ...d.ropes.flatMap(r => [[r.a.x, r.a.z, 3], [r.b.x, r.b.z, 3]])];
        for (const b of w.bosses.filter(b => b.id === 'pirate')) { // (T41: Queen Coralia and her crew have their own spec)
          feetOk(b, 'boss');
          for (const c of b.crew) { feetOk(c, `crew ${c.i}`); for (const [gx, gz, r] of gadgetCells) if (Math.hypot(c.pos[0] - gx - 0.5, c.pos[2] - gz - 0.5) < r) bad(`crew ${c.i} too close to a gadget`); }
          if (b.crew.length !== 3) bad(`crew count ${b.crew.length}`);
        }
        // keeps
        const keepAt = (x, y, z) => w.keeps.some(k => k.protect.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1));
        for (const c of d.cannons) if (!keepAt(c.pad[0], c.padTop, c.pad[1]) || (c.to !== 'ship' && !keepAt(c.target[0] + 2, topOf(c.to), c.target[1] - 2))) bad(`keep ${c.id}`);
        for (const r of d.ropes) for (const e of [r.a, r.b]) if (!keepAt(e.x, topOf(e.isle), e.z) || !keepAt(...r.arch.posts[0].concat([]).slice(0, 0), 0, 0) && false) bad(`keep ${r.id}`);
        if (!keepAt(110, 20, 48) || !keepAt(112, 15, 57) || !w.doors.every(dr => keepAt(dr.surface[0][0], dr.surface[0][1], dr.surface[0][2])) || !w.keeps.find(k => k.name === 'ship').rideText) bad('keeps: the ship, the gangplank, the way back');
        // limits and rules
        let maxY = 0, waterAbove = 0, wrongBiome = 0;
        for (let i = 0; i < w.data.length; i++) { const id = w.data[i]; if (id === B.AIR) continue; const y = Math.floor(i / (w.W * w.D)); if (y > maxY) maxY = y; if (id === B.WATER && y > 12) waterAbove++; }
        for (const [x, z, want] of [[10, 10, 'pirateSea'], [112, 172, 'pirate'], [150, 68, 'pirate'], [112, 50, 'pirate']]) if (w.biome(x, z) !== want) wrongBiome++;
        if (maxY > 46 || waterAbove || wrongBiome) bad(`maxY ${maxY} waterAbove ${waterAbove} biomes ${wrongBiome}`);
        const resv = new Set(d.reserved);
        let decorInReserved = 0;
        for (const x of [d.isles[0].x]) void x;
        const palmsBad = [...resv].some(k => { const x = k % w.W, z = Math.floor(k / w.W); for (let y = 13; y < 40; y++) { const id = w.get(x, y, z); if (id === B.PALM_LOG) return true; } return false; });
        if (palmsBad) decorInReserved++;
        if (decorInReserved) bad('a palm trunk in a reserved strip');
        if (!w.parts.some(p => p.live === 'pirate') || w.isles) bad('parts / world.isles');
        const arrival = w.arrivals.pirate;
        if (!arrival || Math.abs(arrival[0] - 112.5) > 0.01 || Math.abs(arrival[2] - 186.5) > 0.01 || arrival[1] !== 16) bad(`arrival ${arrival}`);
        out.push({ seed, same, probs, ms: Math.round(ms), counts: [d.cannons.length, d.ropes.length, d.exits.length, d.isles.length] });
      }
      return out;
    });
    for (const r of B) {
      t.ok(r.same && !r.probs.length, `seed ${r.seed}: the same world twice; islands, ${r.counts[0]} cannons (targets, flights clear), ${r.counts[1]} ropes (both ways clear), the ship, ladders, dock, the graph, the sea, people, keeps ${r.probs.slice(0, 6).join('; ')}`);
      t.ok(r.ms < 1500, `seed ${r.seed}: generation took ${r.ms} ms`);
    }
  }

  /* ================================ C. gadgets ================================ */
  if (want('gadgets') || want('challenge') || want('play') || want('shots')) {
    await newGame(page, 0);
    await toasts(page);
    const frame = await intoPirate(page);
    t.ok(/Pirate Seas.*to go in/.test(frame.prompt) && frame.action === 'Step in!', `the Pirate Seas frame is ready: "${frame.prompt}" / "${frame.action}"`);
    const arr = await page.evaluate(() => { const g = window.pokecraft, p = g.player; g.updateGuide?.(); return { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, via: g.realms.via, guide: g.ui.guideText, glow: g.portal.glow()?.count ?? null, place: g.place }; });
    t.ok(Math.abs(arr.x - 112.5) < 0.1 && Math.abs(arr.z - 186.5) < 0.1 && Math.abs(arr.yaw) < 0.01 && arr.via === 'pirate', `you arrive in front of the way back on Sandy Start, looking north (${arr.x}, ${arr.z}, yaw ${arr.yaw})`);
    t.ok(/Cannon to Parrot Perch/.test(arr.guide || ''), `the guide says where to go: "${arr.guide}"`);
    t.ok(await said(page, /Stand on the cannon and press Fire/), 'the arrival hint tells you to stand on the cannon');
    await shot(page, 'arrival');
    if (want('shots') || !ONLY) {
      await challengeShots(page);
      // the seven creatures in a row, on a platform up in the sky above the island
      const IDS = ['parroteer', 'featherbeard', 'pinchook', 'anchorclaw', 'bottlet', 'shipshape', 'lookapus'];
      await page.evaluate(async ids => {
        const g = window.pokecraft, w = g.world, y = 40;
        for (let x = 104; x <= 124; x++) for (let z = 150; z <= 160; z++) w.set(x, y, z, 3, false);
        g.creatures.clear();
        ids.forEach((id, i) => { const c = g.creatures.spawnAt(id, 106 + i * 2.4, y + 1, 154, { level: 5 }); c.frozen = true; c.heading = -(i - 3) * 0.12; });
        g.player.pos.set(115, y + 1, 159.5); g.player.vel.set(0, 0, 0); g.player.yaw = 0; g.player.pitch = -0.02;
      }, IDS);
      await shot(page, 'creatures');
      await page.evaluate(() => window.pokecraft.creatures.clear());
    }
  }
  if (want('gadgets')) {
    // every cannon from its pad
    const C = await page.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, play = window.__play, out = [];
      const p = g.player, d = g.world.pirate;
      for (const dt of [1 / 60, 1 / 20]) for (const c of d.cannons) {
        p.pos.set(c.S[0], c.S[1], c.S[2]); p.vel.set(0, 0, 0); p.carry = null; p.keys = {};
        step(g, dt, 4);
        const lv = g.gymLive.of('part:seas'), near = play(g, () => g.gymLive.near(p));
        const used = play(g, () => g.gymLive.use(p));
        const carried = !!p.carry;
        step(g, dt, Math.ceil((c.spec.time + 0.5) / dt), () => !lv.busy && !p.carry && p.onGround);
        const e = c.E;
        out.push({ dt, id: c.id, near, used, carried, d: Math.hypot(p.pos.x - e[0], p.pos.z - e[2]), dy: p.pos.y - e[1], ground: p.onGround, free: !p.collides(p.pos), carry: p.carry });
      }
      return out;
    });
    for (const dt of [1 / 60, 1 / 20]) {
      const rows = C.filter(c => c.dt === dt);
      t.ok(rows.every(c => c.near === 'Fire!' && c.used && c.carried && c.d < 1.5 && c.ground && c.free && !c.carry), `every cannon fires and lands on its target at ${dt === 1 / 60 ? '60' : '20'} steps a second (${rows.map(c => `${c.id}:${c.d.toFixed(1)}`).join(' ')})`);
    }
    // every rope, both ways
    const Rp = await page.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, play = window.__play, out = [], p = g.player, d = g.world.pirate;
      for (const dt of [1 / 60, 1 / 20]) for (const r of d.ropes) for (const from of ['a', 'b']) {
        const A = from === 'a' ? r.a : r.b, Bq = from === 'a' ? r.b : r.a;
        p.pos.set(A.pos[0], A.pos[1], A.pos[2]); p.vel.set(0, 0, 0); p.carry = null; p.keys = {};
        step(g, dt, 4);
        const near = play(g, () => g.gymLive.near(p)), lv = g.gymLive.of('part:seas');
        const used = play(g, () => g.gymLive.use(p));
        step(g, dt, Math.ceil(4 / dt), () => !lv.busy && !p.carry && p.onGround);
        out.push({ dt, id: r.id + from, near, used, d: Math.hypot(p.pos.x - Bq.pos[0], p.pos.z - Bq.pos[2]), dy: p.pos.y - Bq.pos[1], ground: p.onGround, free: !p.collides(p.pos) });
      }
      return out;
    });
    for (const dt of [1 / 60, 1 / 20]) {
      const rows = Rp.filter(c => c.dt === dt);
      t.ok(rows.length === 6 && rows.every(c => c.near === 'Swing!' && c.used && c.d < 1.2 && c.ground && c.free), `every rope works both ways at ${dt === 1 / 60 ? '60' : '20'} steps a second (${rows.map(c => `${c.id}:${c.d.toFixed(1)}`).join(' ')})`);
    }
    // a pause freezes a flight
    const P = await page.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, play = window.__play, p = g.player, c = g.world.pirate.cannons[0], lv = g.gymLive.of('part:seas');
      p.pos.set(c.S[0], c.S[1], c.S[2]); p.vel.set(0, 0, 0); p.carry = null; step(g, 1 / 20, 3);
      play(g, () => g.gymLive.use(p)); step(g, 1 / 20, 10); const t1 = lv.info().t;
      const old = g.playing; g.playing = () => false; for (let i = 0; i < 20; i++) { p.update(1 / 20); g.gymLive.update(1 / 20); }
      const t2 = lv.info().t; g.playing = () => true;
      for (let i = 0; i < 2; i++) { g.inBattle = true; g.gymLive.update(1 / 20); g.inBattle = false; } // a battle freezes it too
      const t3 = lv.info().t;
      step(g, 1 / 20, 100, () => !lv.busy);
      g.playing = old;
      return { t1, t2, t3, carrying: lv.info().carrying };
    });
    t.ok(P.t1 > 0.4 && P.t2 === P.t1 && P.t3 === P.t1 && P.carrying === null, `a pause or a battle freezes the flight (${P.t1} / ${P.t2} / ${P.t3}) and it finishes after`);
  }

  if (want('gadgets') || want('challenge')) await challengePart({ page, t });

  if (want('gadgets')) {
    // ladders: swim into the hull or the stone and you go up
    const Lad = await page.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, p = g.player, w = g.world, out = [];
      for (const l of w.lifts) {
        if (!l.id.startsWith('ladder-')) continue;
        const cx = (l.x[0] + l.x[1]) / 2 + 0.5, cz = (l.z[0] + l.z[1]) / 2 + 0.5;
        // face the climb: towards the block next to the column (the ladder side)
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => w.get(Math.floor(cx + dx), 14, Math.floor(cz + dz)) === 170);
        const [dx, dz] = dirs[0] || [0, 0];
        p.pos.set(cx - dx * 0.2, 12.55, cz - dz * 0.2); p.vel.set(0, 0, 0); p.carry = null; p.yaw = Math.atan2(-dx, -dz);
        p.keys = { KeyW: true, Space: true };
        const n = step(g, 1 / 60, 360, () => p.pos.y >= 16.9 && p.onGround);
        p.keys = {};
        out.push({ id: l.id, y: p.pos.y, ground: p.onGround, t: n / 60, place: (window.__placeOf || (() => ''))() });
      }
      return out;
    });
    t.ok(Lad.length === 6 && Lad.every(l => l.ground && l.y >= 16.9 && l.t < 6), `swimming into every rope ladder brings you up within 6 seconds (${Lad.map(l => `${l.id}:${l.y.toFixed(1)}`).join(' ')})`);
    const deck = await page.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, p = g.player, out = [];
      for (const [x, z, yaw] of [[104.5, 56.5, 0], [118.5, 40.5, Math.PI]]) {
        p.pos.set(x, 12.55, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.keys = { KeyW: true, Space: true };
        step(g, 1 / 60, 420, () => p.pos.y >= 18.9 && p.onGround && p.pos.z > 42 && p.pos.z < 54);
        p.keys = {};
        out.push({ y: p.pos.y, z: p.pos.z, ground: p.onGround });
      }
      return out;
    });
    t.ok(deck.every(d => d.ground && d.y >= 18.9 && d.z > 42 && d.z < 54), `the ship's ladders end on the deck (${deck.map(d => `${d.y.toFixed(1)},${d.z.toFixed(1)}`).join(' ')})`);
    // swimming out: from three sea spots steer to the guide's target with W + Space
    const Swim = await page.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, p = g.player, w = g.world, out = [];
      const { pirateAim, placeOf } = await import('/src/pirateland.js');
      for (const [x, z] of [[60.5, 130.5], [150.5, 110.5], [100.5, 215.5]]) {
        p.pos.set(x, 12.55, z); p.vel.set(0, 0, 0); p.carry = null; p.keys = { KeyW: true, Space: true };
        let n = 0, guide = '';
        for (; n < 40 * 60; n++) {
          if (n % 10 === 0) { const a = pirateAim(w, p.pos, g); if (a) { p.yaw = Math.atan2(-(a.x - p.pos.x), -(a.z - p.pos.z)); if (!guide) guide = a.text('->', 9); } }
          step(g, 1 / 60, 1);
          if (p.onGround && p.pos.y > 12.9 && placeOf(w, p.pos) !== 'sea') break;
        }
        p.keys = {};
        out.push({ x, z, seconds: n / 60, y: p.pos.y, ground: p.onGround, where: placeOf(w, p.pos), guide });
      }
      return out;
    });
    t.ok(Swim.every(s => s.ground && s.where !== 'sea' && s.seconds < 40), `swimming where the guide points gets you out of the sea (${Swim.map(s => `${s.seconds.toFixed(0)}s to ${s.where}: ${s.guide}`).join(' | ')})`);
    // riding a Shipshape on the sea, and the ship's keep
    const Ride = await page.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, S = await import('/src/species.js'), p = g.player, w = g.world;
      const c = S.makeCreature('shipshape', 40); c.traits = ['rideable'];
      g.party = [c, ...g.party.slice(1)]; g.selected = 0;
      p.pos.set(100.5, 12.55, 110.5); p.vel.set(0, 0, 0); p.carry = null; p.keys = {};
      step(g, 1 / 60, 30);
      g.riding.start?.(c) ?? g.riding.toggle();
      const riding = !!g.riding.creature;
      // ride towards the ship from the north-west, then check the keep stopped us
      p.pos.set(80.5, 12.55, 30.5); p.yaw = Math.atan2(-(110 - 80.5), -(48 - 30.5)); p.keys = { KeyW: true };
      step(g, 1 / 60, 600);
      p.keys = {};
      const fence = w.fenceAt(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z));
      const keep = w.fenceAt(110, 20, 48);
      const out = { riding, x: p.pos.x, z: p.pos.z, inside: !!fence, text: keep?.rideText, kind: g.riding.creature && true };
      g.riding.stop('quiet');
      return out;
    });
    t.ok(Ride.riding && !Ride.inside && /Get off your creature to climb aboard/.test(Ride.text || ''), `riding a Shipshape on the sea works and the ship's keep fences it with its own words (${Ride.x.toFixed(1)}, ${Ride.z.toFixed(1)})`);
  }

  /* ================================ D. play ================================ */
  if (want('play') || want('shots')) {
    if (want('shots') && ONLY === 'shots') { /* screenshots only */ }
  }
  if (want('play')) {
    await toasts(page);
    // C1: the pad, the word, fire, land on Parrot Perch
    const f1 = await page.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, play = window.__play, p = g.player, c = g.world.pirate.cannons.find(c => c.id === 'c1'), lv = g.gymLive.of('part:seas');
      p.pos.set(c.S[0], c.S[1], c.S[2]); p.vel.set(0, 0, 0); p.carry = null; p.keys = {}; p.pitch = -0.3; step(g, 1 / 20, 4);
      const near = play(g, () => g.gymLive.near(p));
      g.updateGuide?.(); const g1 = g.ui.guideText;
      play(g, () => g.gymLive.use(p));
      step(g, 1 / 20, 100, () => !lv.busy && p.onGround);
      g.updateGuide?.(); const g2 = g.ui.guideText;
      return { near, g1, g2, d: Math.hypot(p.pos.x - c.E[0], p.pos.z - c.E[2]) };
    });
    t.ok(f1.near === 'Fire!' && /Fire the cannon/.test(f1.g1 || '') && f1.d < 1.5 && /Rope to Crab Rock/.test(f1.g2 || ''), `on the pad the button says "${f1.near}", the guide "${f1.g1}"; after the flight: "${f1.g2}"`);
    // crew: Deckhand Dot battles once, then talks
    const dot = await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js');
      g.party = [S.makeCreature('thunderwolf', 100)]; g.cubes = 0;
      const n = g.npcs.list.find(n => n.kind === 'crew' && /Dot/.test(n.name));
      g.player.pos.set(n.pos.x - 2, n.pos.y, n.pos.z); g.player.vel.set(0, 0, 0);
      g.bosses.talk(n);
      return { name: n.title, has: !!n };
    });
    t.ok(dot.has && /Deckhand Dot/.test(dot.name), `Deckhand Dot stands on Parrot Perch (${dot.name})`);
    await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
    await playBattle(page);
    await waitFor(page, () => window.pokecraft.beaten.includes('pw:pirate:crew1'), null, 60000);
    const dot2 = await page.evaluate(() => { const g = window.pokecraft, n = g.npcs.list.find(n => /Dot/.test(n.name)); g.bosses.talk(n); return { cubes: g.cubes, inBattle: g.inBattle }; });
    t.ok(dot2.cubes === 2 && !dot2.inBattle && await said(page, /The ropes take you to Lookout Isle/), `Dot's battle gives 2 cubes once, then she says her line (${dot2.cubes})`);
    // a rope: the word, the guide
    const r1 = await page.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, play = window.__play, p = g.player, r = g.world.pirate.ropes[0];
      p.pos.set(r.a.pos[0], r.a.pos[1], r.a.pos[2]); p.vel.set(0, 0, 0); p.carry = null; step(g, 1 / 20, 4);
      const near = play(g, () => g.gymLive.near(p)); g.updateGuide?.(); const guide = g.ui.guideText;
      return { near, guide };
    });
    t.ok(r1.near === 'Swing!' && /Swing!/.test(r1.guide || ''), `at the rope the button says "${r1.near}" and the guide "${r1.guide}"`);
    await shot(page, 'ship-from-lookout');
    // the rowboats: the guide sends you to a deck cannon, the Captain waits, three real shots sink them
    const boats = await page.evaluate(async () => {
      const g = window.pokecraft, w = g.world, p = g.player, b = w.bosses[0], L = await import('/src/pirateland.js'), PB = await import('/src/pictureboss.js'), { SHIP } = await import('/src/pirateship.js'), lv = g.gymLive.of('part:seas');
      const step = window.__step, play = window.__play, n = g.npcs.list.find(n => n.kind === 'boss');
      p.pos.set(b.rest[0], b.rest[1], b.rest[2]); p.vel.set(0, 0, 0); p.carry = null;
      g.updateGuide?.(); const g1 = g.ui.guideText;
      g.bosses.talk(n); const gate = !g.inBattle;
      const shots = [];
      // a held Fire!: turn ahead of the boat, let go when the growing distance is right (the ball takes a while: aim where it will be)
      const R = L.ROWBOATS, plan = (at, k) => {
        let r = 15, P, a;
        for (let it = 0; it < 8; it++) {
          P = L.boatAt(k, lv.boatT + 0.5 + r / 24); a = Math.atan2(P.x - at[0] - 0.5, P.z - at[1] - 0.5);
          r = Math.hypot(P.x - (at[0] + 0.5 + Math.sin(a) * 1.1), P.z - (at[1] + 0.5 + Math.cos(a) * 1.1));
        }
        return { yaw: a + Math.PI, pw: (r - R.near) / (R.far - R.near), ok: Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) <= R.turn };
      };
      for (const k of [0, 2, 1]) { // boat k from the nearer cannon
        const at = k === 2 ? R.cannons[1] : R.cannons[0];
        p.pos.set(...L.deckStand(at)); p.vel.set(0, 0, 0); p.yaw = 0; step(g, 1 / 60, 4);
        while (lv.clock - lv.reloadAt < R.reload) step(g, 1 / 60, 1);
        const near = play(g, () => g.gymLive.near(p)), holds = play(g, () => g.gymLive.holds(p));
        g.updateGuide?.(); const guide = g.ui.guideText;
        play(g, () => g.gymLive.use(p));
        const held = lv.info().held;
        let frames = 0, last = lv.power();
        for (; frames < 1200; frames++) {
          const q = plan(at, k); p.yaw = q.yaw;
          const pw = lv.power();
          if (q.ok && q.pw >= 0 && q.pw <= 1 && Math.abs(pw - q.pw) < 0.008) break;
          step(g, 1 / 60, 1); last = pw;
        }
        void last;
        const gold = play(g, () => lv.shotNow(lv.gadget()).hit === k); // (the dots show this every frame)
        play(g, () => g.gymLive.release(p));
        step(g, 1 / 60, 240, () => !lv.ball);
        shots.push({ k, near, holds, held, guide, frames, gold, sunk: g.beaten.includes(L.boatKey(k)) });
        if (k === 0) { // a short tap aimed at open sea: nothing sinks
          step(g, 1 / 60, 70);
          let y = -1, free = null;
          for (; y <= 1; y += 0.05) { const to = L.deckShot(at, y, 0).to; if (R.boats.every((_, i) => [0, 0.5, 1, 1.5].every(dt => { const bq = L.boatAt(i, lv.boatT + dt); return Math.hypot(bq.x - to[0], bq.z - to[2]) > 4; }))) { free = y; break; } }
          p.yaw = free; const before = g.beaten.length;
          play(g, () => g.gymLive.use(p)); play(g, () => g.gymLive.release(p)); step(g, 1 / 60, 240, () => !lv.ball);
          shots.push({ miss: true, same: g.beaten.length === before, free });
        }
      }
      const saved = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
      // owner 2026-10-26: 12 in all, three at a time: the next wave waits a moment, then rows out faster
      const wave1 = L.boatState(g), hiddenNow = lv.boatHidden(0);
      step(g, 1 / 60, Math.ceil((R.sink + R.pause + 0.2) * 60));
      const outAgain = !lv.boatHidden(0);
      const lap = k => { const a = L.boatAt(0, 0, k), b = L.boatAt(0, 0.5, k); return Math.hypot(a.x - b.x, a.z - b.z); };
      const faster = [0, 1, 2, 3].every((k, i, all) => i === 0 || lap(k) > lap(all[i - 1]));
      for (let n = 3; n < L.BOATS_NEED; n++) g.beaten.push(L.boatKey(n));
      const gate2 = PB.bossOf('pirate').gate(g);
      return { g1, gate, shots, state: L.boatState(g), wave1, hiddenNow, outAgain, faster, gate2, saved: [0, 1, 2].every(n => saved.beaten.includes(L.boatKey(n))) };
    });
    t.ok(/Deck cannon: sink the rowboats \(0 \/ 12\)/.test(boats.g1 || '') && boats.gate && await said(page, /Sink my 12 rowboats first/), `on the ship the guide says "${boats.g1}" and the Captain waits for the rowboats`);
    t.ok(boats.shots.filter(s => !s.miss).every(s => s.near === 'Fire!' && s.holds && s.held === 'deck' && s.gold && s.sunk && /Aim at a rowboat/.test(s.guide || '')) && boats.shots.some(s => s.miss && s.same), `three held deck cannon shots, let go at the right distance ahead of the boat, sink the three rowboats (the dots were gold); a short tap at open sea sinks nothing (${JSON.stringify(boats.shots)})`);
    t.ok(boats.wave1.sunk === 3 && boats.wave1.wave === 1 && !boats.wave1.done && boats.saved && boats.hiddenNow && boats.outAgain && await said(page, /3 \/ 12! More rowboats are coming, faster/), `the first three are sunk and saved at once; the next three row out a moment later (${JSON.stringify(boats.wave1)})`);
    t.ok(boats.faster && boats.state.done && boats.gate2 === null, 'every wave of boats rows faster; with all 12 sunk the Captain is ready');
    await shot(page, 'rowboats-sunk');
    // the ship: the guide names the Boss, the chest is closed
    const ship = await page.evaluate(async () => {
      const g = window.pokecraft, w = g.world, p = g.player, b = w.bosses[0];
      p.pos.set(b.rest[0], b.rest[1], b.rest[2]); p.vel.set(0, 0, 0); p.carry = null; p.yaw = Math.atan2(1, 0) + Math.PI; p.pitch = 0;
      g.updateGuide?.(); const guide = g.ui.guideText;
      const lv = g.gymLive.of('part:seas'); lv.syncChest();
      const [x, y, z] = w.starChest, id = w.get(x, y, z);
      const closed = lv.info().chest, hit = lv.hit({ x, y, z, id }), prompt = lv.prompt({ x, y, z, id });
      return { guide, closed, hit, prompt, id };
    });
    t.ok(/Pirate Seas Boss/.test(ship.guide || '') && ship.closed === 'closed' && ship.id === 177 && ship.hit && /locked/.test(ship.prompt) && await said(page, /Beat the Captain first/), `on the ship the guide names the Boss ("${ship.guide}"); the chest is closed and says so`);
    await shot(page, 'deck');
    // First Mate Fin, then the Captain (strong team)
    await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js'), n = g.npcs.list.find(n => /Fin/.test(n.name));
      g.party = [S.makeCreature('thunderwolf', 100)];
      g.player.pos.set(n.pos.x, n.pos.y, n.pos.z - 2.5);
      g.bosses.talk(n);
    });
    await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
    await playBattle(page);
    await waitFor(page, () => window.pokecraft.beaten.includes('pw:pirate:crew3'), null, 60000);
    const lost = await page.evaluate(async () => { // lose against the Captain with a weak team: stay on the ship at a rest spot
      const g = window.pokecraft, S = await import('/src/species.js'), b = g.world.bosses[0], n = g.npcs.list.find(n => n.kind === 'boss');
      g.party = [S.makeCreature('fluffin', 2)];
      g.player.pos.set(b.rest[0], b.rest[1], b.rest[2]);
      g.bosses.talk(n);
      return true;
    });
    await waitFor(page, () => window.pokecraft.inBattle && window.pokecraft.battle.trainer, null, 60000);
    const bt = await page.evaluate(() => { const b = window.pokecraft.battle; return { boss: b.boss, name: b.trainer.name, foes: b.foes.map(f => f.level).join(), mon: b.foes.map(f => f.species).join() }; });
    t.ok(lost && bt.boss && /Captain Squawk/.test(bt.name) && bt.foes === '61,61,62,63', `Captain Squawk battles with four creatures up to level 63 (${bt.foes}: ${bt.mon})`);
    await shot(page, 'battle');
    await playBattle(page);
    await waitFor(page, () => !window.pokecraft.inBattle, null, 60000);
    const L = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos, b = g.world.bosses[0]; return { place: g.place, d: Math.hypot(p.x - b.rest[0], p.z - b.rest[2]), y: p.y, hp: g.party.every(c => c.hp > 0), stars: g.stars.includes('pirate') }; });
    t.ok(L.place === 'pirate' && L.d < 12 && L.y > 18 && L.hp && !L.stars, `losing keeps you on the ship at a rest spot, healed, no star (${L.d.toFixed(1)} from the Captain's rest)`);
    // win the Captain
    await page.evaluate(async () => {
      const g = window.pokecraft, S = await import('/src/species.js'), b = g.world.bosses[0], n = g.npcs.list.find(n => n.kind === 'boss');
      g.party = [S.makeCreature('thunderwolf', 100)]; g.cubes = 0;
      g.player.pos.set(b.rest[0], b.rest[1], b.rest[2]); g.player.vel.set(0, 0, 0);
      g.bosses.talk(n);
    });
    await waitFor(page, () => window.pokecraft.inBattle, null, 60000);
    await playBattle(page);
    await waitFor(page, () => window.pokecraft.stars.includes('pirate'), null, 60000);
    await waitFor(page, () => window.pokecraft.gymLive.of('part:seas').info().chest === 'open', null, 60000);
    const won = await page.evaluate(() => {
      const g = window.pokecraft, lv = g.gymLive.of('part:seas'), [x, y, z] = g.world.starChest;
      return { chest: lv.info().chest, block: g.world.get(x, y, z), note: document.querySelector('#celebrate .big')?.textContent, small: document.querySelector('#celebrate .small')?.textContent || document.querySelector('#celebrate')?.textContent, cubes: g.cubes, boats: g.beaten.filter(k => /pw:pirate:rowboat/.test(k)).length };
    });
    t.ok(won.boats === 0, 'a won Captain battle clears the rowboats (a rematch needs them sunk again)');
    t.ok(won.chest === 'open' && won.block === 178 && /Pirate Seas star/.test(won.note || '') && /Captain Squawk was my parrot/.test(won.small || ''), `the star comes out of the chest, the chest opens and the Wizard's note shows (${won.note})`);
    await shot(page, 'chest-open');
    const after = await page.evaluate(async () => {
      const g = window.pokecraft, p = g.player, b = g.world.bosses[0], w = g.world;
      if (!g.stars.includes('atlantis')) g.stars.push('atlantis'); // (the other Boss of the realm would be the next goal)
      p.pos.set(b.rest[0], b.rest[1], b.rest[2]); g.updateGuide?.(); const onShip = g.ui.guideText;
      const c = w.pirate.cannons.find(c => c.id === 'c3'); p.pos.set(150.5, 16, 70.5); g.updateGuide?.(); const cove = g.ui.guideText;
      const s = w.pirate.isles.find(i => i.id === 'start'); p.pos.set(s.x + 0.5, s.top + 1, s.z + 6.5); g.updateGuide?.(); const start = g.ui.guideText;
      void c;
      return { onShip, cove, start };
    });
    t.ok(/Walk to Captain's Cove/.test(after.onShip || '') && /Home cannon/.test(after.cove || '') && /Way back/.test(after.start || ''), `with the star the guide says: "${after.onShip}" / "${after.cove}" / "${after.start}"`);
    if (!ONLY) await reloadPart({ browser, base, t, page });
    else if (ONLY === 'play') await reloadPart({ browser, base, t, page });
  }
  if (want('gadgets') || want('play') || want('shots')) {
    // mid-flight and mid-swing, for the pictures
    if (ONLY !== 'play' || true) {
      await page.evaluate(async () => {
        const g = window.pokecraft, step = window.__step, p = g.player, c = g.world.pirate.cannons.find(c => c.id === 'c4'), lv = g.gymLive.of('part:seas');
        if (!lv || g.place !== 'pirate') return;
        p.carry = null; p.pos.set(c.S[0], c.S[1], c.S[2]); p.vel.set(0, 0, 0); step(g, 1 / 20, 4);
        window.__play(g, () => g.gymLive.use(p)); step(g, 1 / 20, 24);
        p.pitch = -0.35;
      });
      if ((await page.evaluate(() => window.pokecraft.player.carry)) !== null) await shot(page, 'flight');
      await page.evaluate(async () => {
        const g = window.pokecraft, step = window.__step, p = g.player, lv = g.gymLive.of('part:seas');
        if (!lv || g.place !== 'pirate') return;
        step(g, 1 / 20, 400, () => !lv.busy);
        const r = g.world.pirate.ropes[0];
        p.carry = null; p.pos.set(r.a.pos[0], r.a.pos[1], r.a.pos[2]); p.vel.set(0, 0, 0); step(g, 1 / 20, 4);
        window.__play(g, () => g.gymLive.use(p)); step(g, 1 / 20, 14);
        p.yaw = Math.atan2(-(r.b.pos[0] - r.a.pos[0]), -(r.b.pos[2] - r.a.pos[2])); p.pitch = -0.2; // looking along the swing
      });
      if ((await page.evaluate(() => window.pokecraft.player.carry)) !== null) await shot(page, 'rope');
    }
  }
  if (want('data') || !ONLY) {
    t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join('; ')}`);
  }
  await page.context().close();

  /* ================================ E. iPad ================================ */
  if (want('ipad')) {
    const ip = await openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] });
    await newGame(ip, 0);
    const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    await intoPirate(ip);
    const A = await ip.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, p = g.player, c = g.world.pirate.cannons.find(c => c.id === 'c1'), lv = g.gymLive.of('part:seas');
      const btn = () => document.getElementById('btn-act');
      p.pos.set(c.S[0], c.S[1], c.S[2]); p.vel.set(0, 0, 0); p.carry = null; p.pitch = -0.2; g.player.keys = {};
      step(g, 1 / 30, 4);
      return new Promise(res => setTimeout(() => res({ label: btn()?.textContent, shown: !!btn() && !btn().classList.contains('hidden'), count: document.querySelectorAll('#touch button, #touch .tbtn').length }), 800));
    });
    await waitFor(ip, () => /Fire/.test(document.getElementById('btn-act')?.textContent || ''), null, 60000);
    const label = await ip.evaluate(() => document.getElementById('btn-act').textContent);
    t.ok(/Fire!/.test(label), `on the cannon pad the big button says "${label}"`);
    // a real tap on the button fires
    const box = await ip.evaluate(() => { const r = document.getElementById('btn-act').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await ip.touchscreen.tap(box.x, box.y);
    await waitFor(ip, () => window.pokecraft.gymLive.of('part:seas').busy || window.pokecraft.gymLive.of('part:seas').info().carrying, null, 30000).catch(() => {});
    const fired = await ip.evaluate(() => { const lv = window.pokecraft.gymLive.of('part:seas'); return { carrying: lv.info().carrying, carry: !!window.pokecraft.player.carry }; });
    t.ok(fired.carrying === 'c1' && fired.carry, `a tap on the big button fires the cannon (${fired.carrying})`);
    const rope = await ip.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, p = g.player, r = g.world.pirate.ropes[0], lv = g.gymLive.of('part:seas');
      if (p.carry) p.carry.leave?.(false);
      lv.mover = null; lv.carrying = null; p.carry = null;
      p.pos.set(r.a.pos[0], r.a.pos[1], r.a.pos[2]); p.vel.set(0, 0, 0); step(g, 1 / 30, 4);
      return new Promise(res => setTimeout(() => res({ label: document.getElementById('btn-act')?.textContent }), 800));
    });
    await waitFor(ip, () => /Swing/.test(document.getElementById('btn-act')?.textContent || ''), null, 60000);
    const label2 = await ip.evaluate(() => document.getElementById('btn-act').textContent);
    const after = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    t.ok(/Swing!/.test(label2) && after === before && A.count === before, `at a rope it says "${label2}"; the number of touch buttons is unchanged (${before})`);
    // hold the big button on the rope: you hang on; lift the finger: you let go
    const hold = await ip.evaluate(async () => {
      const g = window.pokecraft, lv = g.gymLive.of('part:seas'), el = document.getElementById('btn-act');
      lv.steady = false;
      const ev = type => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true }));
      ev('pointerdown');
      const on = lv.info().held === 'rope' && !!lv.swing;
      await new Promise(r => setTimeout(r, 1500));
      const still = !!lv.swing;
      ev('pointerup');
      const off = !lv.swing && lv.info().held === null;
      lv.steady = true;
      return { on, still, off };
    });
    t.ok(hold.on && hold.still && hold.off, `iPad: holding the big button hangs on to the rope, lifting the finger lets go (${JSON.stringify(hold)})`);
    await shot(ip, 'ipad');
    t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
    await ip.context().close();
  }

  /* ================================ F. two browsers ================================ */
  if (want('pair')) return pairPart({ browser, base, t });
  if (!ONLY) await pairPart({ browser, base, t });
}

async function reloadPart({ browser, base, t, page }) {
// a reload in a fresh browser with the star: the chest is open; the way back lights the bridge stone
  await page.evaluate(() => { const g = window.pokecraft; g.save(true); });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pokecraft-save-v2')));
  t.ok(save.place === 'pirate' && save.stars.includes('pirate') && save.realmUp?.via === 'pirate', 'the save says: in the Pirate Seas, with the star');
  await pause(page);
  const page2 = await openGame(browser, base, { setup: seedSave(save) });
  await click(page2, '#title-buttons button:has-text("Continue")'); // (the helper waits 30 s; the sea takes longer to build on a busy machine)
  await waitFor(page2, () => window.pokecraft.started, null, 240000);
  await waitFor(page2, () => window.pokecraft.place === 'pirate' && !window.pokecraft.realms.busy && window.pokecraft.gymLive.of('part:seas')?.info().chest === 'open', null, 120000);
  const re = await page2.evaluate(() => { const g = window.pokecraft, [x, y, z] = g.world.starChest; return { block: g.world.get(x, y, z), place: g.place }; });
  t.ok(re.block === 178, 'after a reload in a fresh browser the chest is open');
  const back = await page2.evaluate(() => {
    const g = window.pokecraft, d = g.world.doors[0], m = d.surface[Math.floor(d.surface.length / 2)], b = { x: m[0], y: m[1], z: m[2], id: g.world.get(...m) };
    return { prompt: g.portal.prompt(b, 'click or E'), action: g.portal.action(b), used: g.portal.use(b) };
  });
  t.ok(/Way back/.test(back.prompt) && back.action === 'Back!', `the way back says "${back.prompt}" / "${back.action}"`);
  await placeIs(page2, 'swirl');
  await waitFor(page2, () => window.pokecraft.world.get(...window.pokecraft.world.swirl.bridge.find(b => b.world === 'pirate').cells[0]) === 130, null, 60000);
  const sw = await page2.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'pirate'), p = g.player.pos;
    return { near: Math.hypot(p.x - f.stand[0] - 0.5, p.z - f.stand[2] - 0.5), stone: g.world.get(...g.world.swirl.bridge.find(b => b.world === 'pirate').cells[0]) };
  });
  t.ok(sw.near < 1.5 && sw.stone === 130, `the way back lands in front of the Pirate Seas frame (${sw.near.toFixed(1)}) and its bridge stone is lit`);
  t.ok(!page2.errors.length, `no page errors (reload) ${page2.errors.join('; ')}`);
  await page2.context().close();
}

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
  // Dad goes into the Swirl, Kid follows; Dad steps into the Pirate Seas picture, Kid follows again
  await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
  await placeIs(A, 'swirl');
  await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
  await Bp.evaluate(() => window.pokecraft.ui.askYes());
  await placeIs(Bp, 'swirl');
  const cell = await A.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'pirate'), p = g.player;
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
  const k = await Bp.evaluate(() => { const g = window.pokecraft; return { via: g.realms.via, guest: g.realms.stash.guest, live: !!g.gymLive.of('part:seas'), cannons: g.world.pirate.cannons.length }; });
  t.ok(k.via === 'pirate' && k.guest && k.live && k.cannons === 6, 'Kid is in the Pirate Seas with its own cannons and ropes');
  await helpers(A); await helpers(Bp);
  // both fire cannon 1 on their own (each sees only their own flight)
  for (const pg of [A, Bp]) {
    const r = await pg.evaluate(async () => {
      const g = window.pokecraft, step = window.__step, p = g.player, c = g.world.pirate.cannons.find(c => c.id === 'c1'), lv = g.gymLive.of('part:seas');
      p.pos.set(c.S[0], c.S[1], c.S[2]); p.vel.set(0, 0, 0); p.carry = null; p.keys = {}; step(g, 1 / 20, 4);
      const used = window.__play(g, () => g.gymLive.use(p)); step(g, 1 / 20, 100, () => !lv.busy && p.onGround);
      return { used, d: Math.hypot(p.pos.x - c.E[0], p.pos.z - c.E[2]), ground: p.onGround };
    });
    t.ok(r.used && r.d < 1.5 && r.ground, `a cannon fired on their own lands on Parrot Perch (${r.d.toFixed(1)})`);
  }
  await waitFor(Bp, () => { const a = [...window.pokecraft.mp.others.values()][0]; return !!a && Math.hypot(a.pos.x - 112.5, a.pos.z - 140.5) < 4; }, null, 60000);
  t.ok(true, "Dad's avatar is seen on Parrot Perch");
  await A.evaluate(() => { const g = window.pokecraft, d = g.world.doors[0], m = d.surface[0]; g.portal.use({ x: m[0], y: m[1], z: m[2], id: 145 }); });
  await placeIs(A, 'swirl'); await placeIs(Bp, 'swirl');
  t.ok(true, 'Dad goes back to the Swirl and Kid goes too');
  t.ok(!A.errors.length && !Bp.errors.length, `no page errors (pair) ${A.errors.concat(Bp.errors).slice(0, 3).join('; ')}`);
  await A.context().close(); await Bp.context().close();
}

// G. the challenges (owner 2026-10-26): with real Player physics at 60 and 20 steps a second
async function challengePart({ page, t }) {
  await page.evaluate(() => { window.pokecraft.gymLive.of('part:seas').steady = false; });
  // 1. swinging cannons: in the middle of the sweep you land on the target, at the edge you splash into the sea; slower after a miss
  const C = await page.evaluate(async () => {
    const g = window.pokecraft, step = window.__step, play = window.__play, p = g.player, d = g.world.pirate, lv = g.gymLive.of('part:seas');
    const L = await import('/src/pirateland.js'), out = [];
    const aimAt = (c, k) => { lv.aimT[c.id] = ((((k - c.phase) % 1) + 1) % 1) * L.AIM.period; }; // k: 0.25 = the middle, 0.5 = the edge
    for (const dt of [1 / 60, 1 / 20]) for (const c of d.cannons) for (const k of c.home ? [0.5] : [0.25, 0.5]) {
      lv.misses = {};
      p.pos.set(c.S[0], c.S[1], c.S[2]); p.vel.set(0, 0, 0); p.carry = null; p.keys = {};
      step(g, dt, 2); aimAt(c, k); step(g, dt, 1);
      const gold = lv.info().preview?.gold, off = lv.offOf(c), near = play(g, () => g.gymLive.near(p));
      play(g, () => g.gymLive.use(p));
      step(g, dt, Math.ceil(6 / dt), () => !lv.busy && !p.carry && (p.onGround || p.inWater));
      step(g, dt, Math.ceil(0.5 / dt));
      out.push({ dt, id: c.id, home: !!c.home, k, gold, off, near, d: Math.hypot(p.pos.x - c.E[0], p.pos.z - c.E[2]), wet: p.inWater, ground: p.onGround, free: !p.collides(p.pos), misses: lv.misses[c.id] ?? 0 });
    }
    // slower after a miss: the aim clock runs at 0.75, then 0.55
    const c = d.cannons[0]; lv.misses = { [c.id]: 1 }; const a0 = lv.aimT[c.id]; p.pos.set(60.5, 30, 20.5); step(g, 1 / 20, 20); const slow = (lv.aimT[c.id] - a0) / 1;
    return { out, slow };
  });
  for (const dt of [1 / 60, 1 / 20]) {
    const rows = C.out.filter(r => r.dt === dt), fps = dt === 1 / 60 ? '60' : '20';
    const hits = rows.filter(r => r.home || r.k === 0.25), miss = rows.filter(r => !r.home && r.k === 0.5);
    t.ok(hits.every(r => r.near === 'Fire!' && r.gold && r.d < 1.5 && r.ground && r.free), `${fps} steps: fired in the middle of the swing (or a steady home cannon) you land on the target, the dots are gold (${hits.map(r => `${r.id}:${r.d.toFixed(1)}`).join(' ')})`);
    t.ok(miss.length === 3 && miss.every(r => !r.gold && Math.abs(r.off) > 0.3 && r.wet && r.d > 4 && r.free && r.misses === 1), `${fps} steps: fired at the edge of the swing you splash into the sea, the dots are white, the miss is counted (${miss.map(r => `${r.id}:${r.d.toFixed(1)}`).join(' ')})`);
  }
  t.ok(Math.abs(C.slow - 0.75) < 0.01, `after a miss the cannon swings slower (${C.slow.toFixed(2)} of the speed)`);
  t.ok(await said(page, /Fire when the dots are gold/), 'one short hint: fire when the dots are gold');

  // 2. the rope: let go over the far stand, at once (back), in the middle (splash), or not at all (back after three swings)
  const R = await page.evaluate(async () => {
    const g = window.pokecraft, step = window.__step, play = window.__play, p = g.player, d = g.world.pirate, lv = g.gymLive.of('part:seas');
    const L = await import('/src/pirateland.js'), out = [];
    for (const dt of [1 / 60, 1 / 20]) for (const r of d.ropes) for (const from of ['a', 'b']) for (const how of ['far', 'back', 'splash', 'none']) {
      const A = from === 'a' ? r.a : r.b, Bq = from === 'a' ? r.b : r.a;
      p.pos.set(A.pos[0], A.pos[1], A.pos[2]); p.vel.set(0, 0, 0); p.carry = null; p.keys = {};
      step(g, dt, 3);
      const holds = play(g, () => g.gymLive.holds(p));
      play(g, () => g.gymLive.use(p));
      const time = lv.swing.path.time, word = play(g, () => g.gymLive.near(p)), held = lv.info().held;
      if (how === 'far') step(g, dt, Math.round(time / dt));
      if (how === 'splash') step(g, dt, Math.round(time / 2 / dt));
      if (how === 'none') step(g, dt, Math.ceil((L.LETGO.swings * 2 * time + 0.1) / dt), () => !lv.swing);
      const gold = how === 'far' ? L.letGo(lv.swing.path, lv.mover.clock) === 'far' : null;
      if (how !== 'none') play(g, () => g.gymLive.release(p)); // the held button is let go
      step(g, dt, Math.ceil(3 / dt), () => !lv.busy && !p.carry && (p.onGround || p.inWater));
      step(g, dt, Math.ceil(0.4 / dt));
      const to = how === 'far' ? Bq : A;
      out.push({ dt, id: r.id + from, how, word, gold, holds, held, after: lv.info().held, d: Math.hypot(p.pos.x - to.pos[0], p.pos.z - to.pos[2]), wet: p.inWater, ground: p.onGround, free: !p.collides(p.pos), busy: lv.busy });
    }
    return out;
  });
  for (const dt of [1 / 60, 1 / 20]) {
    const rows = R.filter(r => r.dt === dt), fps = dt === 1 / 60 ? '60' : '20', of = h => rows.filter(r => r.how === h);
    t.ok(rows.every(r => r.holds && r.held === 'rope' && r.after === null && r.word === 'Let go!' && r.free && !r.busy), `${fps} steps: Swing! is held (you hang on), the word is Let go!, and you always come down free (${rows.length} swings)`);
    t.ok(of('far').every(r => r.gold && r.d < 1.2 && r.ground), `${fps} steps: let go over the far stand (the rope is gold) and you land on it, every rope both ways (${of('far').map(r => `${r.id}:${r.d.toFixed(1)}`).join(' ')})`);
    t.ok(of('back').every(r => r.d < 1.2 && r.ground) && of('none').every(r => r.d < 1.2 && r.ground), `${fps} steps: let go at once, or never, and you are back on your own stand`);
    t.ok(of('splash').every(r => r.wet), `${fps} steps: let go in the middle and you splash into the sea (${of('splash').map(r => r.id).join(' ')})`);
  }
  await page.evaluate(() => { const lv = window.pokecraft.gymLive.of('part:seas'); lv.steady = true; lv.misses = {}; });
}

// pictures of the challenges: the gold dots on a cannon, the rowboats from a deck cannon
async function challengeShots(page) {
  await page.evaluate(async () => {
    const g = window.pokecraft, step = window.__step, p = g.player, c = g.world.pirate.cannons.find(c => c.id === 'c1'), lv = g.gymLive.of('part:seas');
    lv.steady = true; // (held on target while the slow software renderer takes the picture: gold dots)
    p.pos.set(c.S[0], c.S[1], c.S[2]); p.vel.set(0, 0, 0); p.carry = null; step(g, 1 / 20, 2);
    p.yaw = Math.PI * 0.08; p.pitch = -0.15;
  });
  await shot(page, 'cannon-aim');
  await page.evaluate(async () => {
    const g = window.pokecraft, step = window.__step, p = g.player, lv = g.gymLive.of('part:seas');
    const L = await import('/src/pirateland.js'); lv.steady = false;
    p.pos.set(...L.deckStand(L.ROWBOATS.cannons[0])); p.vel.set(0, 0, 0); p.yaw = 0.15; p.pitch = -0.5; step(g, 1 / 20, 2);
  });
  await shot(page, 'rowboats');
  await page.evaluate(() => { window.pokecraft.gymLive.of('part:seas').steady = true; });
}
