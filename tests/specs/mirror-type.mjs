// Wave 18 stage 2: the Mirror type (plans/wave18-mirror.md section 6). Part `data`: 47 types (46 + the Custom type of wave 19), 7 creatures, 4 own shapes each with ONE sheen mesh
// (and the idle animations), moves, big moves, T1..T4, the chart (no old cell changed against tests/fixtures/chart-before-mirror.json, no
// defender weak to more than 5), fx and sounds, the spawn table, the after-check, the lookup of Lynxlook as rideable. Part `gait`: the
// `mimic` gait in the browser (mirrored copy, meet in the middle, leash, legal floor, same at 20 and 60 steps a second, no Math.random).
// MIRROR_TYPE_ONLY=data|gait. Screenshot: tests/screenshots/mirror-creatures.png. (Stage 1's spec is tests/specs/mirror.mjs.)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, openGame, newGame, pause } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const IDS = ['lookit', 'grandlooker', 'copykit', 'lynxlook', 'wobblet', 'bendabout', 'periscoot'];
const ONLY = process.env.MIRROR_TYPE_ONLY || '';
const want = part => !ONLY || ONLY === part;

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const page = await openGame(browser, base);
  page.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await newGame(page, 0); await pause(page);

  if (want('data')) {
    const A = await page.evaluate(async ids => {
      const Sp = await import('/src/species.js'), R = await import('/src/fxrecipes.js'), Tr = await import('/src/traits.js'), THREE = await import('three');
      const SR = await import('/src/spawnrules.js'), WA = await import('/src/wildafter.js'), SH = await import('/src/shapes.js');
      const fixture = await (await fetch('/tests/fixtures/chart-before-mirror.json')).json();
      const g = window.pokecraft, out = { problems: [] };
      const bad = (id, m) => out.problems.push(`${id}: ${m}`);
      const all = Object.entries(Sp.SPECIES), mine = all.filter(([, s]) => s.type === 'mirror').map(([id]) => id);
      out.mine = mine.slice().sort();
      out.shapes = [...new Set(mine.map(id => Sp.SPECIES[id].model.shape))].sort();
      out.ownShapes = out.shapes.every(sh => all.every(([, s]) => s.model.shape !== sh || s.type === 'mirror'));
      out.evolve = ['lookit', 'copykit', 'wobblet'].map(id => `${id}>${Sp.SPECIES[id].evolve?.into}@${Sp.SPECIES[id].evolve?.level}`);
      out.single = !Sp.SPECIES.periscoot.evolve;
      const names = all.map(([, s]) => s.name.toLowerCase());
      for (const id of ids) {
        const s = Sp.SPECIES[id];
        if (!s) { bad(id, 'missing'); continue; }
        if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(id, 'name is not unique');
        if (!s.desc || s.desc.length > 140) bad(id, `desc is ${s.desc?.length} characters`);
        if (s.gait !== 'mimic') bad(id, 'no mimic gait');
        if (!Sp.makeCreature(id, 20).moves.some(m => Sp.MOVES[m].type === 'mirror')) bad(id, 'no mirror move at Lv 20');
        for (const [, m] of s.learn) if (!Sp.MOVES[m]) bad(id, `move ${m} missing`);
        for (const [biome, list] of Object.entries(Sp.SPAWNS)) if (list.some(e => e[0] === id)) bad(id, `in the main world's ${biome} table`);
        try {
          const m = Sp.buildModel(id);
          Sp.animateModel(m, 0, false);
          const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
          if (size.y < 0.35 || size.y > 2.8) bad(id, `height ${size.y.toFixed(2)}`);
          if (size.x > 2.8 || size.z > 2.8) bad(id, `width/depth ${size.x.toFixed(2)}/${size.z.toFixed(2)}`);
          let min = box.min.y;
          for (const [tm, mv] of [[0.3, false], [0.7, true], [1.1, false], [1.9, true], [2.6, false]]) { Sp.animateModel(m, tm, mv); min = Math.min(min, new THREE.Box3().setFromObject(m).min.y); }
          if (min < -0.1) bad(id, `goes under the ground (${min.toFixed(2)})`);
          const sig = () => { let sum = 0; m.updateMatrixWorld(true); m.traverse(o => { if (o.isMesh && o.visible) for (const v of o.matrixWorld.elements) sum += v; }); return sum; };
          Sp.animateModel(m, 0.3, false); const a = sig(); Sp.animateModel(m, 1.1, false); const b = sig();
          if (Math.abs(a - b) < 1e-6) bad(id, 'no idle animation');
          const sheen = []; m.traverse(o => { if (o.userData.gear === 'sheen') sheen.push(o); });
          if (sheen.length !== 1) bad(id, `${sheen.length} sheen meshes (one merged mesh per model)`);
          else if (sheen[0].material.emissive) bad(id, 'the sheen must be unlit (tintModel skips it)');
          // the glint slides: its holder is somewhere else a moment later
          const p = m.userData.parts, sl = p.slide?.[0];
          if (!sl) bad(id, 'no sliding glint'); else { Sp.animateModel(m, 0.1, false); const x0 = sl.g.position[sl.axis]; Sp.animateModel(m, 0.8, false); if (Math.abs(sl.g.position[sl.axis] - x0) < 1e-4) bad(id, 'the glint does not slide'); }
          Sp.disposeModel(m);
        } catch (e) { bad(id, `model failed: ${e.message}`); }
      }
      // the animations that make them funny
      const parts = id => Sp.buildModel(id).userData.parts;
      out.funny = [!!parts('lookit').swap, !!parts('grandlooker').swap, !!parts('wobblet').squash, !!parts('bendabout').bend, !!parts('bendabout').squash];
      const L = Sp.buildModel('lookit'); L.userData.parts.swap.forEach(f => { f.a.visible = true; });
      Sp.animateModel(L, 0.1, false); const f0 = L.userData.parts.swap[0].a.visible; Sp.animateModel(L, 1.8, false); out.facesSwap = f0 !== L.userData.parts.swap[0].a.visible;
      const Mv = Sp.MOVES, m7 = ['glintshot', 'flashback', 'quickcopy', 'dazzlestare', 'mirrormirror', 'copycatcombo', 'funhousesquish', 'roundthecorner'], m3 = ['shinyshield', 'wobblyfunhouse', 'lastlook'];
      out.moves = [...m7, ...m3].map(id => Mv[id]?.type);
      out.fine = Mv.quickcopy.priority === 1 && Mv.dazzlestare.fx?.kind === 'lower' && Mv.glintshot.power === 40 && Mv.flashback.power === 85 && Mv.roundthecorner.sure && Mv.copycatcombo.fx.kind === 'multi';
      out.sig = ['mirrormirror', 'copycatcombo', 'funhousesquish', 'roundthecorner'].every(id => Mv[id].sig) && [['grandlooker', 'mirrormirror'], ['lynxlook', 'copycatcombo'], ['bendabout', 'funhousesquish'], ['periscoot', 'roundthecorner']].every(([s, mv]) => Sp.SPECIES[s].learn.some(([l, m]) => l === 30 && m === mv));
      out.big = m3.map(id => [Mv[id].fx.kind, !!Mv[id].big]);
      out.funfair = Mv.funhouse.type === 'funfair' && Mv.funhouse.name === 'Fun House'; // the plan's "funhouse" id was taken
      out.t1 = ['T1', 'T2', 'T3', 'T4'].length && [Sp.makeCreature('lookit', 12).moves.includes('glintshot'), Sp.makeCreature('lookit', 14).moves.includes('flashback')];
      const moveNames = Object.values(Mv).map(m => m.name);
      out.dupMoveNames = moveNames.filter((n, i) => moveNames.indexOf(n) !== i);
      const types = Object.keys(Sp.TYPE_COLORS);
      out.types = types.length;
      out.ownRow = types.filter(x => Sp.effectiveness('mirror', x) !== 1).map(x => `${x}:${Sp.effectiveness('mirror', x)}`).sort().join();
      out.vs = types.filter(x => x !== 'mirror' && Sp.effectiveness(x, 'mirror') !== 1).map(x => `${x}:${Sp.effectiveness(x, 'mirror')}`).sort().join();
      // no old cell changed: every cell between two types that are not Mirror equals the fixture, and the fixture lists them all
      const olds = fixture.types;
      out.oldChart = olds.every(a => olds.every(d => Sp.effectiveness(a, d) === (fixture.chart[a]?.[d] ?? 1)));
      out.oldTypes = olds.length === types.length - 2 && olds.every(x => types.includes(x));
      const weak = d => types.filter(a => Sp.effectiveness(a, d) > 1).length;
      out.weak = ['mirror', 'ninja', 'surprise', 'doodle'].filter(d => weak(d) > 5).map(d => `${d}:${weak(d)}`).join(); // the defenders this type touches (ghost, mind, drake, paper were already weak to 6-7 before)
      out.weakCounts = ['mirror', 'ninja', 'surprise', 'doodle'].map(d => `${d}:${weak(d)}`).join();
      out.color = Sp.TYPE_COLORS.mirror;
      out.fxOwn = R.TRAVEL.mirror !== R.TRAVEL.normal && R.IMPACT.mirror !== R.IMPACT.normal && !!R.FX_COLORS.mirror && m7.slice(4).every(id => typeof R.SIG[id] === 'function');
      out.sounds = ['fx:mirror'].map(n => g.sound.has(n));
      try { g.sound.play('fx:mirror'); out.played = true; } catch (e) { out.played = e.message; }
      out.soundClash = [...m7, ...m3].filter(id => g.sound.has(id));
      out.spawns = Sp.MIRROR_SPAWNS.map(e => e.join(':')).join();
      out.conds = Sp.MIRROR_SPAWNS.every(e => e[2] === 'preening' && SR.condOf(e[2])) && !!SR.AFTER_TEXT.mirror && /Mirror Palace/.test(SR.condText('preening'));
      out.rare = Sp.MIRROR_SPAWNS.filter(e => e[3] === 'mirror').map(e => e[0]).sort().join();
      const key = (k, n) => `pw:mirror:${k}${n}`;
      const G = beaten => ({ stars: [], beaten });
      out.after = [WA.wildAfter(G([]), 'mirror'), WA.wildAfter(G([key('court', 1), key('twin', 1)]), 'mirror'), WA.wildAfter(G([key('court', 1), key('twin', 1), key('beam', 3)]), 'mirror'), WA.wildAfter({ stars: ['mirror'], beaten: [] }, 'mirror')];
      out.rideable = Tr.TRAITS.rideable.species.lynxlook;
      out.rideableOnly = Object.keys(Tr.TRAITS.rideable.species).filter(id => Sp.SPECIES[id]?.type === 'mirror').join();
      out.shapeFns = ['handmirror', 'twincat', 'funmirror', 'periscope'].every(s => typeof SH.SHAPES[s] === 'function');
      return out;
    }, IDS);
    t.ok(JSON.stringify(A.mine) === JSON.stringify([...IDS].sort()) && A.evolve.join() === 'lookit>grandlooker@24,copykit>lynxlook@26,wobblet>bendabout@25' && A.single, `seven Mirror species, three families and Periscoot (${A.evolve})`);
    t.ok(A.shapes.join() === 'funmirror,handmirror,periscope,twincat' && A.ownShapes && A.shapeFns, `four own Mirror shapes (${A.shapes}), used by no other type`);
    t.ok(!A.problems.length, `all seven pass the data and model checks (one unlit sheen mesh each that slides, size, animation, the mimic gait, only outside the main world) ${A.problems.join('; ')}`);
    t.ok(A.funny.every(Boolean) && A.facesSwap, `the funny parts animate: the hand mirrors' two faces take turns, Wobblet squashes, Bendabout bends (${A.funny})`);
    t.ok(A.moves.every(m => m === 'mirror') && A.fine && A.sig && JSON.stringify(A.big) === JSON.stringify([['shield', true], ['field', true], ['lastword', true]]), 'the moves: Glint Shot, Flash Back, Quick Copy (first), Dazzle Stare (attack down), the four signatures at 30, the big moves Shiny Shield, Wobbly Funhouse, Last Look');
    t.ok(A.funfair && !A.dupMoveNames.length, `the Funfair's Fun House is untouched and no two moves share a name (${A.dupMoveNames})`);
    t.ok(A.t1.every(Boolean), 'a Lookit knows Glint Shot early and Flash Back by Lv 14');
    t.ok(A.types === 47, `${A.types} types (46 with the Mirror type, 47 with wave 19's Custom)`);
    t.ok(A.ownRow === 'doodle:2,ghost:0.5,metal:0.5,mirror:0.5,ninja:2,surprise:2' && A.vs === 'ball:2,light:0.5,rock:2,sound:2', `the chart: its own row (${A.ownRow}), the cells against it (${A.vs})`);
    t.ok(A.oldChart && A.oldTypes && !A.weak, `no old cell changed (against tests/fixtures/chart-before-mirror.json); no defender it touches weak to more than 5 types (${A.weak || 'none'}; ${A.weakCounts})`);
    t.ok(/gradient/.test(A.color), 'a type colour (a silver sheen gradient)');
    t.ok(A.fxOwn && A.sounds.every(Boolean) && A.played === true && !A.soundClash.length, 'mirror effects, colours, the four signature effects and fx:mirror exist and play; no move is named like a sound');
    t.ok(A.spawns === 'lookit:1.3:preening,copykit:1.2:preening,wobblet:1:preening,grandlooker:0.12:preening:mirror,lynxlook:0.12:preening:mirror,bendabout:0.1:preening:mirror,periscoot:0.15:preening:mirror' && A.conds && A.rare === 'bendabout,grandlooker,lynxlook,periscoot', `MIRROR_SPAWNS: the three small ones free, the four big ones after the Mirror Palace's first rounds; the preening condition is known (${A.spawns})`);
    t.ok(A.after.join() === 'false,false,true,true', `the after-check: 3 won rounds or the star (${A.after})`);
    t.ok(A.rideable === 'land' && A.rideableOnly === 'lynxlook', `only Lynxlook can be ridden (${A.rideable})`);
    // the sheet for the owner
    const shots = await page.evaluate(async ids => {
      const { portrait } = await import('/src/ui.js'), Sp = await import('/src/species.js');
      const W = 220, H = 190, LABEL = 26, COLS = 4, rows = Math.ceil(ids.length / COLS), cv = document.createElement('canvas');
      cv.width = W * COLS; cv.height = (H + LABEL) * rows;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#9ab8d8'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
      for (let i = 0; i < ids.length; i++) {
        const img = new Image(); img.src = portrait(ids[i], W, H);
        await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
        const x = (i % COLS) * W, y = Math.floor(i / COLS) * (H + LABEL);
        ctx.drawImage(img, x, y); ctx.fillText(Sp.SPECIES[ids[i]].name, x + W / 2, y + H + 18);
      }
      return cv.toDataURL();
    }, IDS);
    fs.writeFileSync(path.join(SHOTS, 'mirror-creatures.png'), Buffer.from(shots.split(',')[1], 'base64')); console.log('  screenshot mirror-creatures.png');
  }

  if (want('gait')) {
    const C = await page.evaluate(async () => {
      const g = window.pokecraft, cm = g.creatures, w = g.world;
      const { B } = await import('/src/blocks.js');
      const out = { problems: [] };
      const src = await (await fetch('/src/creatures.js')).text();
      const body = src.slice(src.indexOf('updateMimic(w, dt) {'), src.indexOf('/* ==== end of Mirror ==== */', src.indexOf('updateMimic(w, dt) {')));
      out.noRandom = body.length > 500 && !/Math\.random/.test(body);
      const Y = 40, cx = Math.floor(g.player.pos.x) + 20, cz = Math.floor(g.player.pos.z) - 24;
      const rebuild = () => {
        for (let x = cx - 9; x <= cx + 9; x++) for (let z = cz - 9; z <= cz + 9; z++) {
          for (let y = Y; y <= Y + 6; y++) w.set(x, y, z, B.AIR);
          if (Math.abs(x - cx) <= 8 && Math.abs(z - cz) <= 8) w.set(x, Y, z, B.STONE);
        }
        for (let z = cz - 8; z <= cz + 8; z++) w.set(cx - 2, Y + 1, z, B.STONE); // a wall west of home, 2 high
        for (let z = cz - 8; z <= cz + 8; z++) w.set(cx - 2, Y + 2, z, B.STONE);
      };
      rebuild();
      const mk = id => { cm.clear(); const c = cm.spawnAt(id, cx, Y + 1, cz, { level: 5 }); c.life = 1e9; return c; };
      const V = (x, z, y) => new c0.pos.constructor(x, y, z);
      let c0 = mk('lookit');
      const home = { x: c0.pos.x, z: c0.pos.z }, y = c0.pos.y;
      // run the same story at one step size: returns what the creature did
      const story = dt => {
        const c = mk('lookit'), p = V(home.x + 5, home.z, y), log = {};
        cm.viewer = p;
        const run = secs => { let minD = 99, maxHome = 0, illegal = 0; for (let i = 0; i < Math.round(secs / dt); i++) { const bx = c.pos.x, bz = c.pos.z; cm.updateOne(c, dt); if (Math.hypot(c.pos.x - bx, c.pos.z - bz) > 1e-6) minD = Math.min(minD, Math.hypot(p.x - c.pos.x, p.z - c.pos.z)); maxHome = Math.max(maxHome, Math.hypot(c.pos.x - home.x, c.pos.z - home.z)); const X = Math.floor(c.pos.x), Z = Math.floor(c.pos.z); if (w.get(X, Y + 1, Z) !== B.AIR || w.get(X, Y + 2, Z) !== B.AIR || w.get(X, Y, Z) === B.AIR) illegal++; } return { minD, maxHome, illegal }; };
        run(2); log.start = [c.pos.x - home.x, c.pos.z - home.z];                       // you east at 5: its reflection is home
        p.z = home.z + 2; run(2); log.sideways = [c.pos.x - home.x, c.pos.z - home.z]; // you step 2 sideways: it steps 2 the same world way (its right)
        p.z = home.z; p.x = home.x + 3; run(2); log.closer = [c.pos.x - home.x, c.pos.z - home.z]; // you come 2 closer: it comes 2 toward you
        const m = run(0); void m;
        let minD = 99; for (let x = 3; x >= 2.5; x -= 0.05) { p.x = home.x + x; minD = Math.min(minD, run(0.2).minD); } // you walk to the middle
        log.meet = [c.pos.x - home.x, Math.min(minD, run(2).minD)];                  // you meet in the middle: it stops short of you
        p.x = home.x + 5; p.z = home.z + 4; const r2 = run(3); log.leash = r2.maxHome; log.illegal = r2.illegal; // its spot is 4+ from home: never beyond the leash
        p.x = home.x + 7; p.z = home.z; const r3 = run(3); log.wall = [c.pos.x - home.x, r3.illegal]; // its mirror spot is behind the wall: it stops at it
        p.x = home.x + 30; run(4); log.home = [c.pos.x - home.x, c.pos.z - home.z, !!c.mim]; // you leave: it goes home and forgets
        return log;
      };
      out.s20 = story(0.05); out.s60 = story(1 / 60);
      return out;
    });
    const near = (a, b, e = 0.25) => Math.abs(a - b) < e;
    for (const [k, s] of [['20', C.s20], ['60', C.s60]]) {
      t.ok(near(s.start[0], 0) && near(s.start[1], 0), `@${k}: you stand 5 east: it stays home (${s.start.map(n => n.toFixed(2))})`);
      t.ok(near(s.sideways[0], 0) && near(s.sideways[1], 2), `@${k}: you step 2 sideways: it steps 2 the same way, its other hand (${s.sideways.map(n => n.toFixed(2))})`);
      t.ok(near(s.closer[0], 2) && near(s.closer[1], 0), `@${k}: you step 2 toward it: it steps 2 toward you (${s.closer.map(n => n.toFixed(2))})`);
      t.ok(s.meet[1] >= 0.79 && s.meet[0] > 1 && s.meet[0] < 2.5, `@${k}: you meet in the middle and it never steps into you (${s.meet.map(n => n.toFixed(2))})`);
      t.ok(s.leash <= 4.05 && s.illegal === 0, `@${k}: never further than 4 from home, only over floor with air above (${s.leash.toFixed(2)}, ${s.illegal})`);
      t.ok(s.wall[0] > -1.6 && s.wall[1] === 0, `@${k}: it stops at a wall (${s.wall[0].toFixed(2)})`);
      t.ok(near(s.home[0], 0, 0.1) && near(s.home[1], 0, 0.1) && !s.home[2], `@${k}: you leave and it goes home and forgets the mirror (${s.home.map(n => (typeof n === 'number' ? n.toFixed(2) : n))})`);
    }
    t.ok(Math.abs(C.s20.sideways[1] - C.s60.sideways[1]) < 0.1 && Math.abs(C.s20.closer[0] - C.s60.closer[0]) < 0.1, 'the same places at 20 and 60 steps a second');
    t.ok(C.noRandom, 'updateMimic never uses Math.random');
  }
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
}
