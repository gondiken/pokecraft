// Chapter 3, step A (plans/chapter3-abilities-build.md section 2): 22 creatures got new bodies (and some new names) so no body
// contradicts its type. Their ids, stats, learn sets, evolutions, types, catch rates and gaits are unchanged (compared with
// tests/fixtures/redesign-before.json, recorded before the change); no redesigned walker flies or floats; each new body has its own
// builder; an old save holding them loads with the new names and models in the team, the box and the Book; Spectrascale is ridden
// on land. Pictures for the owner: `node tests/redesign-preview.mjs`.
import fs from 'node:fs';
import { openGame, seedSave, continueGame, waitFor, ROOT } from '../helpers.mjs';

const BEFORE = JSON.parse(fs.readFileSync(`${ROOT}/tests/fixtures/redesign-before.json`, 'utf8'));
const NAMES = { voltwing: 'Voltrunner', flarehawk: 'Flaremu', peekaw: 'Peekko', ravenshade: 'Ninjecko', parroteer: 'Monkeer', featherbeard: 'Bananabeard',
  shimmerfin: 'Shimmerscale', spectrafin: 'Spectrascale', gullop: 'Wallop', wifly: 'Wiflow', wifly2: 'Wiflow 2.0' };
const FLYING = ['twirlshell']; // a bug with dragonfly wings: still flies
const LOOKS = ['zorbit', 'moonhop', 'orbikit', 'thinkit', 'hopfold', 'pagelet', 'pompet', 'prismkit', 'drumbo'];

export default async function ({ browser, base, t }) {
  const page = await openGame(browser, base);
  const D = await page.evaluate(async ({ ids, LOOKS }) => {
    const S = await import('/src/species.js'), SH = await import('/src/shapes.js'), { TRAITS } = await import('/src/traits.js'), THREE = await import('three');
    const { REALMS } = await import('/src/realms.js');
    const out = {};
    const tables = { ...S.SPAWNS, ...Object.fromEntries(Object.values(REALMS).flatMap(r => Object.entries(r.spawns || {}).map(([b, l]) => [`${r.id}:${b}`, l]))) };
    for (const id of ids) {
      const s = S.SPECIES[id];
      const m = S.buildModel(id);
      let moved = false, low = Infinity;
      const sig = () => { let x = 0; m.updateMatrixWorld(true); m.traverse(o => { if (o.isMesh && o.visible) x += o.matrixWorld.elements.reduce((a, b) => a + b, 0); }); return x; };
      S.animateModel(m, 0.3, false); const a = sig();
      for (let k = 0.3; k < 2.3; k += 1 / 30) S.animateModel(m, k, true);
      moved = Math.abs(sig() - a) > 1e-6;
      const bb = new THREE.Box3().setFromObject(m); low = bb.min.y;
      S.disposeModel(m);
      out[id] = { name: s.name, desc: s.desc, type: s.type, base: s.base, baseXp: s.baseXp, catchRate: s.catchRate, learn: s.learn, evolve: s.evolve || null,
        from: Object.keys(S.SPECIES).filter(o => S.SPECIES[o].evolve?.into === id), gait: s.gait || null, ride: TRAITS.rideable.species[id] || null,
        flies: !!s.flies, floats: !!s.floats, swims: !!s.swims, waterOnly: !!s.waterOnly, shape: s.model.shape, builder: typeof SH.SHAPES[s.model.shape] === 'function',
        moved, low, water: Object.entries(tables).filter(([b, l]) => /(^|:)(water|pirateSea)$/.test(b) && l.some(e => e[0] === id && !/^home:/.test(e[2] || ''))).map(([b]) => b), // a home spawn appears at the home
        spawns: Object.entries(tables).filter(([, l]) => l.some(e => e[0] === id)).map(([b]) => b) };
    }
    const shapeUsers = {};
    for (const [id, s] of Object.entries(S.SPECIES)) (shapeUsers[s.model.shape] ||= []).push(id);
    const looks = LOOKS.map(id => { const m = S.buildModel(id); const n = m.userData.parts.looks?.length || (id === 'pompet' ? m.userData.parts.wings?.length : 0); S.disposeModel(m); return [id, n]; });
    return { out, shapeUsers, looks, typeOf: Object.fromEntries(ids.map(id => [id, S.SPECIES[id].type])) };
  }, { ids: Object.keys(BEFORE), LOOKS });

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const [id, b] of Object.entries(BEFORE)) {
    const n = D.out[id];
    const keep = ['type', 'base', 'baseXp', 'catchRate', 'learn', 'evolve', 'from', 'gait'].filter(k => !same(n[k], b[k]));
    t.ok(!keep.length, `${id}: type, stats, learn set, evolution, catch rate and gait unchanged${keep.length ? ` (changed: ${keep})` : ''}`);
  }
  const named = Object.entries(NAMES).filter(([id, nm]) => D.out[id].name !== nm);
  t.ok(!named.length, `the decided new names: ${Object.entries(NAMES).map(([id, nm]) => `${BEFORE[id].name} -> ${nm}`).join(', ')}${named.length ? ` (wrong: ${named})` : ''}`);
  const kept = Object.keys(BEFORE).filter(id => !NAMES[id] && D.out[id].name !== BEFORE[id].name);
  t.ok(!kept.length, `the other eleven keep their names (${kept})`);
  const fly = Object.keys(BEFORE).filter(id => !FLYING.includes(id) && (D.out[id].flies || D.out[id].floats || D.out[id].swims || D.out[id].waterOnly));
  t.ok(!fly.length && D.out.twirlshell.flies, `no redesigned walker flies, floats or swims (${fly}); Twirlshell has dragonfly wings and flies`);
  const wet = Object.keys(BEFORE).filter(id => D.out[id].water.length);
  const nowhere = Object.keys(BEFORE).filter(id => !D.out[id].spawns.length && !Object.keys(BEFORE).some(o => BEFORE[o].evolve?.into === id && D.out[o].spawns.length));
  t.ok(!wet.length && !nowhere.length, `none of them spawns on water any more (${wet}), every one can still be found (${nowhere})`);
  const shared = Object.keys(BEFORE).filter(id => {
    const users = D.shapeUsers[D.out[id].shape].filter(u => u !== id);
    return !D.out[id].builder || users.some(u => !(BEFORE[u] && (BEFORE[u].evolve?.into === id || BEFORE[id].evolve?.into === u)) && u !== 'crownguard' && u !== 'looplet');
  });
  t.ok(!shared.length, `each new family has its own body builder, shared only within the family (${Object.keys(BEFORE).map(id => `${id}=${D.out[id].shape}`).join(' ')}) ${shared}`);
  const still = Object.keys(BEFORE).filter(id => !D.out[id].moved);
  const under = Object.keys(BEFORE).filter(id => D.out[id].low < -0.12);
  t.ok(!still.length && !under.length, `every new body animates (${still}) and none sinks under the ground (${under})`);
  t.ok(D.out.spectrafin.ride === 'land', `Spectrascale is ridden on land (${D.out.spectrafin.ride})`);
  t.ok(D.looks.every(([, n]) => n > 0), `the type looks are drawn (${D.looks.map(l => l.join('=')).join(' ')})`);

  // An old save holding Flarehawk, Spectrafin (rideable) and Wifly 2.0 loads with the new names and models in the team, the box and the Book.
  const old = (species, level, extra = {}) => ({ species, level, xp: level ** 3, hp: 60, moves: ['tackle'], ...extra });
  const save = {
    seed: 4242, edits: [], pos: [100.5, 31, 102.5], yaw: 0, pitch: 0, time: 0.3, size: [224, 224], cubes: 5, badges: [], beaten: [], savedAt: 1,
    party: [old('flarehawk', 30, { uid: 'r1' }), old('spectrafin', 40, { uid: 'r2', traits: ['rideable'] })],
    box: [old('wifly2', 35, { uid: 'r3' }), old('parroteer', 12, { uid: 'r4' })],
    seen: ['flarehawk', 'spectrafin', 'wifly2', 'parroteer', 'gullop'], caught: ['flarehawk', 'spectrafin', 'wifly2', 'parroteer'],
  };
  const p = await openGame(browser, base, { setup: seedSave(save) });
  await continueGame(p);
  await waitFor(p, () => window.pokecraft.started);
  const L = await p.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js'), R = await import('/src/riding.js');
    const out = { team: g.party.map(c => [c.species, c.uid, S.SPECIES[c.species].name, S.SPECIES[c.species].model.shape]), box: g.box.map(c => [c.species, S.SPECIES[c.species].name]) };
    g.ui.openPanel('team');
    out.teamText = g.ui.partyPanel.textContent;
    g.ui.closePanels?.() ?? g.ui.partyPanel.classList.add('hidden');
    g.book.open({ species: 'spectrafin' });
    await new Promise(r => setTimeout(r, 200));
    out.bookText = document.getElementById('book').textContent;
    g.book.open({ species: 'featherbeard' }); await new Promise(r => setTimeout(r, 200));
    out.unseen = document.getElementById('book').textContent;
    g.book.close?.();
    out.kind = R.rideKind(g.party[1]);
    out.rode = g.riding.start(g.party[1]);
    out.rideModel = g.riding.model?.userData?.species || null;
    out.playerRide = g.player.ride ? { speed: g.player.ride.speed, swim: !!g.player.ride.water } : null;
    g.riding.stop?.('quiet');
    const saved = JSON.parse(localStorage.getItem('pokecraft-save-v2'));
    out.saved = [...saved.party, ...saved.box].map(c => c.species);
    return out;
  });
  t.ok(same(L.team.map(c => c[0]), ['flarehawk', 'spectrafin']) && L.team[0][2] === 'Flaremu' && L.team[0][3] === 'emu' && L.team[1][2] === 'Spectrascale' && L.team[1][3] === 'pangolin',
    `the team keeps its creatures by id, with new names and bodies (${L.team.map(c => c.join(':'))})`);
  t.ok(/Flaremu/.test(L.teamText) && /Spectrascale/.test(L.teamText) && !/Flarehawk|Spectrafin/.test(L.teamText), 'the team screen shows the new names');
  t.ok(L.box.map(c => c[1]).join() === 'Wiflow 2.0,Monkeer', `the box shows Wiflow 2.0 and Monkeer (${L.box})`);
  t.ok(/Spectrascale/.test(L.bookText) && /pangolin/.test(L.bookText) && !/Spectrafin|Sailors/.test(L.bookText), 'the Book page shows the new name and words');
  t.ok(!/Featherbeard/.test(L.unseen), 'no old name anywhere in the Book');
  t.ok(L.kind === 'land' && L.rode && L.rideModel === 'spectrafin', `Spectrascale is ridden on land (${L.kind}, rode ${L.rode})`);
  t.ok(same(L.saved, ['flarehawk', 'spectrafin', 'wifly2', 'parroteer']), `the save keeps the same ids (${L.saved})`);
  t.ok(!page.errors.length && !p.errors.length, `no page errors ${page.errors.concat(p.errors).join('; ')}`);
  await p.context().close();
  await page.context().close();
}
