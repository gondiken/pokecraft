// T34 Squad: 7 crew creatures (data, shapes, members), the weakensWithHp rule (hpPower, multi-hit bonus, exact numbers and
// draw counts), members that fall off in a real battle, a mirrored duel run, the Big Top Gym (world, protection, tiers, a BFS
// walk, battles) and the Book line. Screenshots: tests/screenshots/t34-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, newGame, pause, platform, playBattle, waitFor, ROOT } from '../helpers.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const IDS = ['teetertot', 'teetertower', 'sockhop', 'socktacular', 'bucketeer', 'bucketeam', 'tallcoat'];
const MEMBERS = { teetertot: 3, teetertower: 5, sockhop: 3, socktacular: 6, bucketeer: 3, bucketeam: 5, tallcoat: 3 };

const save = (name, url) => {
  const file = path.join(SHOTS, name);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`  screenshot ${file}`);
};

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  let page = await openGame(browser, base);

  // ---- 1. data ----
  const D = await page.evaluate(async ({ IDS, MEMBERS }) => {
    const S = await import('/src/species.js');
    const SH = await import('/src/shapes.js');
    const FX = await import('/src/fxrecipes.js');
    const { sound } = await import('/src/sound.js');
    const { VERSION } = await import('/src/duel.js');
    const THREE = await import('three');
    const out = { problems: [] };
    const bad = (id, msg) => out.problems.push(`${id}: ${msg}`);
    const all = Object.entries(S.SPECIES);
    out.flagged = all.filter(([, s]) => s.weakensWithHp).map(([id]) => id).sort().join();
    const squad = all.filter(([, s]) => s.type === 'squad' && !s.legendary);
    out.squadCount = squad.length;
    out.shapes = new Set(squad.map(([, s]) => s.model.shape)).size;
    const shapeUse = {};
    for (const [, s] of all) shapeUse[s.model.shape] = (shapeUse[s.model.shape] || 0) + 1;
    out.tallcoatOnly = shapeUse[S.SPECIES.tallcoat.model.shape] === 1 && !S.SPECIES.tallcoat.evolve;
    const names = all.map(([, s]) => s.name.toLowerCase());
    const sigOf = m => {
      let sum = 0;
      m.updateMatrixWorld(true);
      m.traverse(o => {
        if (!o.isMesh) return;
        for (const v of o.matrixWorld.elements) sum += v;
        if (o.material.color) sum += o.material.color.r * 3 + o.material.color.g * 5 + o.material.color.b * 7;
      });
      return sum;
    };
    const evolvesInto = new Set(all.map(([, s]) => s.evolve?.into).filter(Boolean));
    for (const id of IDS) {
      const s = S.SPECIES[id];
      if (!s) { bad(id, 'missing'); continue; }
      if (s.type !== 'squad' || s.weakensWithHp !== true) bad(id, 'not squad / no weakensWithHp');
      if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(id, 'name not unique');
      if (!s.desc || s.desc.length > 110) bad(id, `desc is ${s.desc?.length} characters`);
      const where = Object.entries(S.SPAWNS).flatMap(([biome, list]) => list.filter(e => e[0] === id).map(e => ({ biome, w: e[1] })));
      const from = Object.entries(S.SPECIES).find(([, x]) => x.evolve?.into === id)?.[0];
      if (!where.length && !(from && Object.values(S.SPAWNS).some(l => l.some(e => e[0] === from)))) bad(id, 'is in no SPAWNS table');
      for (const e of where) if (e.w > 1.5) bad(id, `weight ${e.w} over 1.5`);
      if (s.floats || S.SPECIES[id].legendary) bad(id, 'floats/legendary');
      // model
      const m = S.buildModel(id);
      const members = m.userData.parts.members;
      if (!members || members.length !== MEMBERS[id]) bad(id, `members ${members?.length} (want ${MEMBERS[id]})`);
      else {
        for (let i = 1; i < members.length; i++) if (members[i].base.y < members[i - 1].base.y) bad(id, 'members not bottom to top');
        if (members.some(x => !x.on || !x.g.visible)) bad(id, 'a member is off in a fresh model');
      }
      S.animateModel(m, 0);
      const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
      if (size.y < 0.35 || size.y > 2.6) bad(id, `height ${size.y.toFixed(2)}`);
      if (size.x > 2.6 || size.z > 2.6) bad(id, `width ${size.x.toFixed(2)}/${size.z.toFixed(2)}`);
      if (box.min.y < -0.1) bad(id, `under the ground (${box.min.y.toFixed(2)})`);
      S.animateModel(m, 0.3, false); const a = sigOf(m);
      S.animateModel(m, 1.1, false); const b = sigOf(m);
      if (Math.abs(a - b) < 1e-6) bad(id, 'no idle animation');
      if (!(S.makeCreature(id, 12).hp > 0)) bad(id, 'no HP');
      S.disposeModel(m);
    }
    // non-crew models have no members and are left alone
    out.plain = [];
    for (const id of ['fluffin', 'kingcoin']) {
      const m = S.buildModel(id);
      const before = []; m.traverse(o => before.push(o.visible));
      S.setModelHealth(m, 0.1);
      const after = []; m.traverse(o => after.push(o.visible));
      out.plain.push(!m.userData.parts.members && before.join() === after.join());
    }
    try { S.setModelHealth(null, 0.5); S.setModelHealth(undefined, 0.5); out.nullOk = true; } catch (e) { out.nullOk = false; }
    // setModelHealth counts
    const m6 = S.buildModel('socktacular');
    const counts = {};
    for (const f of [1, 0.84, 0.83, 0.67, 0.5, 0.34, 0.17, 0.01, 0]) { S.setModelHealth(m6, f, { instant: true }); counts[f] = m6.userData.parts.members.filter(x => x.g.visible).length; }
    out.counts = JSON.stringify(counts);
    const m3 = S.buildModel('sockhop');
    S.setModelHealth(m3, 2 / 3, { instant: true });
    out.twoThirds = m3.userData.parts.members.filter(x => x.g.visible).length;
    // moves
    out.moves = ['onetwo', 'highfives', 'pileon', 'teamcheer', 'towertopple', 'countoff'].every(id => S.MOVES[id] && S.MOVES[id].type === 'squad');
    const c30 = S.makeCreature('teetertot', 30);
    out.t30 = c30.moves.join();
    out.t30ok = ['onetwo', 'highfives', 'pileon', 'teamcheer'].every(m => S.autoMoves('teetertot', 30).concat(c30.moves).includes(m)) || c30.moves.some(m => S.MOVES[m].type === 'squad');
    out.sig = S.SPECIES.teetertower.learn.some(([l, m]) => l === 30 && m === 'towertopple') && S.SPECIES.socktacular.learn.some(([l, m]) => l === 30 && m === 'countoff');
    out.sigOnlyThose = squadSig(S);
    out.noCoverage = IDS.every(id => S.makeCreature(id, 30).moves.some(m => S.MOVES[m].type !== 'squad'));
    out.big = ['allhandsin', 'squadhuddle', 'tagteam'].map(id => [S.MOVES[id]?.fx.kind, IDS.every(sid => S.SPECIES[sid].learn.some(([, m]) => m === id))].join(':')).join();
    out.fx = !!(FX.TRAVEL.squad && FX.IMPACT.squad && FX.SIG.towertopple && FX.SIG.countoff && FX.FX_COLORS.squad) && sound.has('fx:squad');
    out.duel = VERSION;
    out.crew = [S.hpPower({ species: 'fluffin', hp: 1, level: 5 }), S.CREW.floor, S.CREW.multi];
    function squadSig(S) { return Object.entries(S.MOVES).filter(([, m]) => m.type === 'squad' && m.sig).map(([id]) => id).sort().join(); }
    return out;
  }, { IDS, MEMBERS });
  t.ok(!D.problems.length, `the 7 squad creatures pass the data and model checks ${D.problems.join('; ')}`);
  t.ok(D.flagged === [...IDS].sort().join(), `exactly the 7 squad species have weakensWithHp (${D.flagged})`);
  t.ok(D.squadCount === 7 && D.shapes >= 3 && D.tallcoatOnly, `7 squad species, ${D.shapes} shapes, Tallcoat is a single-stage with its own shape`);
  t.ok(D.plain.every(Boolean) && D.nullOk, 'non-crew models have no members and setModelHealth leaves them alone; null does not throw');
  t.ok(JSON.stringify(Object.entries(JSON.parse(D.counts)).sort((a, b) => a[0] - b[0])) === JSON.stringify([[0, 1], [0.01, 1], [0.17, 2], [0.34, 3], [0.5, 3], [0.67, 5], [0.83, 5], [0.84, 6], [1, 6]].map(([k, v]) => [String(k), v])) && D.twoThirds === 2, `members shown for health (${D.counts}; 2/3 of 3 = ${D.twoThirds})`);
  t.ok(D.moves && D.sig && D.sigOnlyThose === 'countoff,towertopple' && D.noCoverage, `6 squad moves, signature moves at Lv 30, every crew knows another type's move (${D.t30})`);
  t.ok(D.big === 'rally:true,shield:true,sacrifice:true', `big moves rally/shield/sacrifice learned by all (${D.big})`);
  t.ok(D.fx, 'fx recipes (travel, impact, two signature moves, colours) and the sound exist');
  t.ok(D.duel === 10, `duel VERSION is ${D.duel}`);
  const wv = await page.evaluate(() => fetch('/src/multiplayer.js').then(r => r.text()));
  t.ok(/WORLD_VERSION = 15/.test(wv), 'WORLD_VERSION is 15');
  t.ok(D.crew[0] === 1 && D.crew[1] === 0.6 && D.crew[2] === 1.2, 'CREW numbers and hpPower of a non-crew');

  // ---- portraits: full, half and nearly gone ----
  const shots = await page.evaluate(async ({ IDS }) => {
    const S = await import('/src/species.js');
    const THREE = await import('three');
    const W = 220, H = 200, LABEL = 22;
    const cv = document.createElement('canvas');
    cv.width = W * IDS.length; cv.height = (H + LABEL) * 3;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(W, H, false);
    for (let row = 0; row < 3; row++) for (let i = 0; i < IDS.length; i++) {
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(2, 4, 3); scene.add(sun);
      const model = S.buildModel(IDS[i]);
      S.setModelHealth(model, [1, 0.5, 0.05][row], { instant: true });
      scene.add(model);
      // size the camera from the FULL model so the three rows are comparable
      const full = S.buildModel(IDS[i]);
      const fb = new THREE.Box3().setFromObject(full);
      const c = fb.getCenter(new THREE.Vector3()), size = fb.getSize(new THREE.Vector3()).length();
      const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 50);
      cam.position.set(c.x + size * 0.95, c.y + size * 0.5, c.z + size * 1.45);
      cam.lookAt(c);
      r.render(scene, cam);
      ctx.drawImage(r.domElement, i * W, row * (H + LABEL));
      ctx.fillText(`${S.SPECIES[IDS[i]].name} ${['100%', '50%', '5%'][row]}`, i * W + W / 2, row * (H + LABEL) + H + 16);
      S.disposeModel(model); S.disposeModel(full);
    }
    return cv.toDataURL();
  }, { IDS });
  save('t34-squad-models.png', shots);
  t.ok(shots.length > 20000, 'model sheet drawn (full, half and nearly gone)');

  // ---- 2 + 3. numbers: hpPower and damage ----
  const N = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const g = window.pokecraft, b = g.battle;
    await new Promise(r => setTimeout(r, 200));
    const R = {};
    const crew = S.makeCreature('teetertower', 50);
    const max = S.statsFor(crew).maxHp;
    R.hp = [];
    for (const [f, want] of [[1, 1], [0.75, 0.9], [0.5, 0.8], [0.25, 0.7]]) {
      crew.hp = Math.round(max * f);
      R.hp.push(Math.abs(S.hpPower(crew) - (0.6 + 0.4 * crew.hp / max)) < 1e-9 && Math.abs(S.hpPower(crew) - want) < 0.02);
    }
    crew.hp = 1; R.hp.push(Math.abs(S.hpPower(crew) - (0.6 + 0.4 / max)) < 1e-9);
    const flu = S.makeCreature('fluffin', 50); flu.hp = 1; R.hp.push(S.hpPower(flu) === 1);
    const team = list => list.map(([sp, lv, mv]) => S.makeCreature(sp, lv, mv));
    const make = (allyList, foeList) => {
      b.say = async () => {}; b.lunge = async () => {}; b.flash = async () => {}; b.refresh = () => {};
      b.allies = team(allyList); b.foes = team(foeList);
      b.allyIdx = b.foeIdx = 0; b.trainer = null; b.duel = null; b.boss = false; b.modMap = new Map(); b.resetSides();
    };
    const seq = list => { const s = { n: 0 }; b.rng = () => { s.n++; return list.length ? list.shift() : 0.5; }; return s; };
    // expected damage in the code's own multiplication order
    const expect = (atkC, defC, mvId, { roll = 0.5, hit = 1 } = {}) => {
      const mv = S.MOVES[mvId], as = S.statsFor(atkC), ds = S.statsFor(defC);
      const eff = S.effectiveness(mv.type, S.SPECIES[defC.species].type);
      const stab = mv.type === S.SPECIES[atkC.species].type ? 1.5 : 1;
      const atkPower = as.atk * 1 * 1 * S.hpPower(atkC), defPower = ds.def * 1;
      const base = Math.floor((((2 * atkC.level) / 5 + 2) * mv.power * atkPower / defPower) / 50) + 2;
      const r = 0.85 + roll * 0.15;
      return Math.max(1, Math.floor(base * stab * eff * hit * 1 * 1 * 1 * 1 * r));
    };
    R.dmg = [];
    for (const f of [1, 0.5, 0.25]) {
      make([['teetertower', 50, ['pileon']]], [['thunderwolf', 50, ['tackle']]]);
      b.ally.hp = Math.round(S.statsFor(b.ally).maxHp * f);
      const exp = expect(b.ally, b.foe, 'pileon');
      const s = seq([0, 0.5, 0.5]);
      const h = b.foe.hp;
      await b.useMove('ally', 'pileon', { first: false });
      R.dmg.push({ f, drop: h - b.foe.hp, exp, draws: s.n });
    }
    // a non-crew is the same at 100% and 50%
    R.plain = [];
    for (const f of [1, 0.5]) {
      make([['fluffin', 50, ['tackle']]], [['thunderwolf', 50, ['tackle']]]);
      b.ally.hp = Math.round(S.statsFor(b.ally).maxHp * f);
      seq([0, 0.5, 0.5]);
      const h = b.foe.hp;
      await b.useMove('ally', 'tackle', { first: false });
      R.plain.push(h - b.foe.hp);
    }
    // multi-hit bonus: one hit of Rapid Click on a crew, with and without the flag
    const oneHit = async () => {
      make([['thunderwolf', 50, ['rapidclick']]], [['teetertower', 50, ['pileon']]]);
      const mvx = S.MOVES.rapidclick, as = S.statsFor(b.ally), ds = S.statsFor(b.foe);
      const eff = S.effectiveness('cyber', 'squad');
      const base = Math.floor((((2 * 50) / 5 + 2) * mvx.power * (as.atk * 1 * 1) / (ds.def * 1)) / 50) + 2;
      const s = seq([0, 0, 0.5, 0.5]);
      const h = b.foe.hp;
      await b.useMove('ally', 'rapidclick', { first: false });
      return { drop: h - b.foe.hp, base, eff, draws: s.n };
    };
    const withFlag = await oneHit();
    const flag = S.SPECIES.teetertower.weakensWithHp;
    delete S.SPECIES.teetertower.weakensWithHp;
    let without;
    try { without = await oneHit(); } finally { S.SPECIES.teetertower.weakensWithHp = flag; }
    const r = 0.85 + 0.5 * 0.15;
    R.multi = {
      withFlag: withFlag.drop, expWith: Math.max(1, Math.floor(withFlag.base * 1 * withFlag.eff * 1.2 * 1 * 1 * 1 * 1 * r)),
      without: without.drop, expWithout: Math.max(1, Math.floor(without.base * 1 * without.eff * 1 * 1 * 1 * 1 * 1 * r)),
      draws: [withFlag.draws, without.draws],
    };
    return R;
  });
  t.ok(N.hp.every(Boolean), `hpPower: 1, 0.9, 0.8, 0.7 at 100/75/50/25% and 0.6 + 0.4/max at 1 HP; 1 for a Fluffin (${N.hp.join()})`);
  t.ok(N.dmg.every(x => x.drop === x.exp && x.draws === 3), `Pile On damage matches the formula at 100/50/25% HP, 3 draws each (${N.dmg.map(x => `${x.f}: ${x.drop}/${x.exp}`).join(', ')})`);
  t.ok(N.dmg[1].drop < N.dmg[0].drop && N.dmg[2].drop < N.dmg[1].drop, `a hurt crew hits softer (${N.dmg.map(x => x.drop).join(' > ')})`);
  t.ok(N.plain[0] === N.plain[1], `a Fluffin hits the same at 100% and 50% HP (${N.plain.join(' / ')})`);
  t.ok(N.multi.withFlag === N.multi.expWith && N.multi.without === N.multi.expWithout && N.multi.withFlag >= N.multi.without && N.multi.draws.join() === '4,4',
    `multi-hit x1.2 against a crew (${N.multi.withFlag} vs ${N.multi.without} without; draws ${N.multi.draws})`);

  // ---- 5. duel mirror ----
  const M = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const { mulberry32 } = await import('/src/blocks.js');
    const b = window.pokecraft.battle;
    const team = list => list.map(([sp, lv, mv]) => S.makeCreature(sp, lv, mv));
    const make = (allyList, foeList) => {
      b.say = async () => {}; b.lunge = async () => {}; b.flash = async () => {}; b.refresh = () => {};
      b.allies = team(allyList); b.foes = team(foeList);
      b.allyIdx = b.foeIdx = 0; b.trainer = null; b.duel = null; b.boss = false; b.modMap = new Map(); b.resetSides();
    };
    const mirror = async swap => {
      const A = [['socktacular', 40, ['countoff', 'allhandsin', 'pileon', 'tagteam']], ['teetertower', 40, ['towertopple', 'squadhuddle', 'highfives', 'pileon']]];
      const Fz = [['thunderwolf', 40, ['rapidclick', 'thunderjolt', 'tackle', 'quickjab']], ['bucketeam', 40, ['highfives', 'pileon', 'teamcheer', 'onetwo']]];
      if (swap) make(Fz, A); else make(A, Fz);
      const rng = mulberry32(77); let calls = 0; b.rng = () => { calls++; return rng(); };
      const SA = swap ? 'foe' : 'ally', SF = swap ? 'ally' : 'foe';
      const idx = (side, i) => { if (side === 'ally') b.allyIdx = i; else b.foeIdx = i; b.modMap.delete(side === 'ally' ? b.ally : b.foe); };
      const mv = async (side, id, first = false) => { await b.useMove(side, id, { first }); };
      const tick = async () => { b.round++; await b.tickEffects(); };
      await tick();
      await mv(SA, 'countoff', true); await mv(SF, 'rapidclick');
      await tick();
      await mv(SF, 'rapidclick', true); await mv(SA, 'pileon');
      await tick();
      await mv(SA, 'allhandsin', true); await mv(SF, 'thunderjolt');
      await tick();
      await mv(SA, 'tagteam', true);
      idx(SA, 1); await b.giftArrives(SA);
      await mv(SF, 'rapidclick');
      await tick();
      await mv(SA, 'squadhuddle', true); await mv(SF, 'tackle');
      await tick();
      await mv(SA, 'highfives', true); await mv(SF, 'rapidclick');
      await tick();
      idx(SF, 1);
      await mv(SF, 'highfives', true); await mv(SA, 'towertopple');
      await tick();
      await mv(SA, 'pileon', true); await mv(SF, 'pileon');
      const sA = swap ? b.foes : b.allies, sF = swap ? b.allies : b.foes;
      const act = side => (side === 'ally' ? b.ally : b.foe);
      return JSON.stringify({
        hpA: sA.map(c => c.hp), hpF: sF.map(c => c.hp), mA: b.mods(act(SA)), mF: b.mods(act(SF)), sidesA: b.sides[SA], sidesF: b.sides[SF],
        field: b.field, round: b.round, calls,
      });
    };
    const m1 = await mirror(false), m2 = await mirror(true);
    return { same: m1 === m2, calls: JSON.parse(m1).calls, m1 };
  });
  t.ok(M.same && M.calls > 20, `duel mirror: swapped sides give the same battle with crews in it (${M.calls} draws; ${M.m1.slice(0, 120)})`);

  // ---- 4. members in a real battle (a fresh page: the number tests above stubbed the battle's refresh and say) ----
  t.ok(!page.errors.length, `no page errors in the data and number checks ${page.errors.join('; ')}`);
  await page.context().close();
  page = await openGame(browser, base);
  await newGame(page, 0);
  await platform(page, { day: true });
  await page.evaluate(async () => {
    const g = window.pokecraft;
    const S = await import('/src/species.js');
    const { Wild } = await import('/src/creatures.js');
    g.party = [S.makeCreature('thunderwolf', 40, ['rapidclick', 'thunderjolt', 'tackle', 'quickjab']), S.makeCreature('sockhop', 30)];
    const wild = new Wild(S.makeCreature('socktacular', 30), S.buildModel('socktacular'), g.player.pos.clone().setX(g.player.pos.x + 3));
    g.creatures.list.push(wild);
    g.scene.add(wild.model);
    wild.model.position.copy(wild.pos);
    g.inBattle = true; document.body.classList.add('in-battle');
    document.getElementById('pause').classList.add('hidden');
    g.battle.start({ wild });
  });
  const ready = () => waitFor(page, () => document.querySelector('#b-actions button:not([disabled])'), null, 90000);
  await ready();
  const full = await page.evaluate(() => {
    const m = window.pokecraft.battle.foeModel;
    const ms = m.userData.parts.members;
    return { n: ms.length, on: ms.every(x => x.on), vis: ms.every(x => x.g.visible), who: m.userData.who === window.pokecraft.battle.foe };
  });
  t.ok(full.n === 6 && full.on && full.vis && full.who, 'a full wild Socktacular shows all 6 members');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 't34-full.png'), timeout: 120000 });
  console.log('  screenshot t34-full.png');
  await page.evaluate(() => [...document.querySelectorAll('#b-actions button:not([disabled])')].find(b => b.firstChild.textContent === 'Rapid Click').click());
  await page.waitForTimeout(800);
  await ready();
  const exp = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const b = window.pokecraft.battle, m = b.foeModel;
    const frac = b.foe.hp / S.statsFor(b.foe).maxHp;
    return { frac, want: Math.max(1, Math.min(6, Math.ceil(frac * 6 - 1e-9))), on: m.userData.parts.membersOn, hit: frac < 1 };
  });
  t.ok(exp.hit && exp.on === exp.want, `after Rapid Click the foe shows ${exp.on} members (HP ${(exp.frac * 100).toFixed(0)}% wants ${exp.want})`);
  await waitFor(page, () => {
    const m = window.pokecraft.battle.foeModel, ms = m.userData.parts.members;
    return ms.filter(x => x.g.visible).length === m.userData.parts.membersOn;
  }, null, 30000);
  t.ok(true, 'the fallen members tumbled off and hid');
  await page.screenshot({ path: path.join(SHOTS, 't34-hurt.png'), timeout: 120000 });
  console.log('  screenshot t34-hurt.png');
  // frozen frames of the squad effects (look at t34-fx-*.png)
  for (const [name, kind, move, p] of [['travel', 'attack', 'onetwo', 0.5], ['impact', 'impact', 'onetwo', 0.5], ['towertopple', 'attack', 'towertopple', 0.5], ['towertopple-hit', 'attack', 'towertopple', 0.85], ['countoff', 'attack', 'countoff', 0.6]]) {
    await page.evaluate(({ kind, move, p }) => {
      const g = window.pokecraft, b = g.battle, fx = g.fx;
      fx.hold = p;
      if (kind === 'impact') fx.impact('squad', b.spot('foe'), { big: false });
      else fx.attack(move, b.spot('ally'), b.spot('foe'));
    }, { kind, move, p });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, `t34-fx-${name}.png`), timeout: 120000 });
    await page.evaluate(() => { const fx = window.pokecraft.fx; fx.clear(); fx.hold = null; });
  }
  const rest = await page.evaluate(async () => {
    const S = await import('/src/species.js');
    const b = window.pokecraft.battle, R = {};
    const vis = m => m.userData.parts.members.filter(x => x.g.visible).length;
    // heal: everyone back at once
    const fm = b.foeModel;
    const keep = b.foe.hp;
    b.foe.hp = S.statsFor(b.foe).maxHp; b.refresh();
    R.healed = [fm.userData.parts.membersOn, vis(fm)];
    // zero HP: one member is left
    b.foe.hp = 0; b.refresh();
    R.zero = fm.userData.parts.membersOn;
    b.foe.hp = Math.max(1, keep); b.refresh();
    // ally side: a hurt bench creature comes in with its members already off
    b.allies[1].hp = Math.round(S.statsFor(b.allies[1]).maxHp * 0.4);
    b.allyIdx = 1; await b.placeAlly();
    const am = b.allyModel;
    R.ally = [am.userData.parts.membersOn, vis(am), am.userData.who === b.ally];
    // refresh() leaves a model alone when it shows another creature
    b.allies[1].hp = S.statsFor(b.allies[1]).maxHp;
    b.allyIdx = 0; b.refresh();
    R.other = am.userData.parts.membersOn;
    await b.placeAlly();
    R.again = b.allyModel.userData.who === b.ally;
    R.fresh = (() => { const m = S.buildModel('sockhop'); return m.userData.parts.members.every(x => x.on && x.g.visible); })();
    return R;
  });
  t.ok(rest.healed.join() === '6,6', `healing shows all members again at once (${rest.healed})`);
  t.ok(rest.zero === 1, `at 0 HP exactly one member is left (${rest.zero})`);
  t.ok(rest.ally.join() === '2,2,true', `a hurt bench Sockhop comes in with 2 of 3 members (${rest.ally})`);
  t.ok(rest.other === 2 && rest.again && rest.fresh, `refresh() leaves a model of another creature alone; a fresh model is whole (${rest.other})`);
  t.ok(await playBattle(page), 'the battle with the crew finishes');
  await pause(page);

  // ---- 6. the gym in worlds ----
  const W = await page.evaluate(async () => {
    const { World, WORLD_H } = await import('/src/world.js');
    const { GYMS } = await import('/src/gyms.js');
    const { B, WOOL, isSolid } = await import('/src/blocks.js');
    const out = {};
    for (const seed of [1, 4242, 777]) {
      const w = new World(seed, null, null); w.generate();
      const g = w.gyms.find(x => x.def.id === 'squad');
      const r = { found: !!g };
      if (!g) { out[seed] = r; continue; }
      const slots = w.gymSlots();
      r.slot = g.slot.k === 6 && g.x === slots[6].x && g.z === slots[6].z;
      const box = g.slot.box;
      r.protectIn = g.protect.every(b => b.x0 >= box.x0 && b.x1 <= box.x1 && b.z0 >= box.z0 && b.z1 <= box.z1) && !!g.area;
      const [fx, fz] = g.front;
      r.wall = w.protectedAt(g.x + (fx ? fx * 10 : 10), g.y + 2, g.z + (fz ? fz * 10 : 0)) === g;
      // spliced-out world
      const i = GYMS.findIndex(d => d.id === 'squad');
      const def = GYMS.splice(i, 1)[0];
      let bare;
      try { bare = new World(seed, null, null); bare.generate(); } finally { GYMS.splice(i, 0, def); }
      let outside = 0, inside = 0;
      for (let y = 0; y < WORLD_H; y++) for (let z = 0; z < w.D; z++) for (let x = 0; x < w.W; x++) {
        if (w.get(x, y, z) === bare.get(x, y, z)) continue;
        if (x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1) inside++; else outside++;
      }
      r.outside = outside; r.inside = inside;
      // tiers
      const under = p => w.get(Math.floor(p[0]), Math.round(p[1]) - 1, Math.floor(p[2]));
      const people = [g.trainerPositions[0], g.trainerPositions[1], g.leaderPos];
      r.under = people.map(under).join();
      r.wantUnder = [WOOL.fire, WOOL.squad, WOOL.grass].join();
      r.ys = people.map(p => p[1]);
      r.air = people.every(p => w.get(Math.floor(p[0]), Math.round(p[1]), Math.floor(p[2])) === B.AIR && w.get(Math.floor(p[0]), Math.round(p[1]) + 1, Math.floor(p[2])) === B.AIR);
      // BFS from the path cell
      const solid = (x, y, z) => isSolid(w.get(x, y, z));
      const area = g.area;
      const inAr = (x, z) => x >= area.x0 - 1 && x <= area.x1 + 1 && z >= area.z0 - 1 && z <= area.z1 + 1;
      const stand = (x, y, z) => y > 1 && solid(x, y - 1, z) && !solid(x, y, z) && !solid(x, y + 1, z);
      const startX = g.x + fx * 12, startZ = g.z + fz * 12, startY = g.fy + 1;
      const seen = new Set([`${startX},${startY},${startZ}`]);
      const queue = [[startX, startY, startZ]];
      while (queue.length) {
        const [x, y, z] = queue.shift();
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (!inAr(nx, nz) && Math.max(Math.abs(nx - startX), Math.abs(nz - startZ)) > 3) continue;
          for (let ny = y + 1; ny >= y - 3; ny--) {
            if (!stand(nx, ny, nz)) continue;
            // moving up needs headroom above the start cell too
            if (ny > y && solid(x, y + 2, z)) continue;
            const k = `${nx},${ny},${nz}`;
            if (!seen.has(k)) { seen.add(k); queue.push([nx, ny, nz]); }
            break;
          }
        }
      }
      r.reach = people.map(p => seen.has(`${Math.floor(p[0])},${Math.round(p[1])},${Math.floor(p[2])}`));
      r.levels = [g.def.trainers[0].team, g.def.trainers[1].team].map(tm => tm.map(e => e[1])).flat().every(l => l >= 48 && l <= 49) && g.def.leaderTeam.every(e => e[1] >= 49 && e[1] <= 50);
      out[seed] = r;
    }
    return out;
  });
  for (const seed of [1, 4242, 777]) {
    const r = W[seed];
    t.ok(r.found && r.slot && r.protectIn && r.wall, `seed ${seed}: the Big Top is at the centre of slot 6, protected inside its box, its wall is protected`);
    t.ok(r.outside === 0 && r.inside > 500, `seed ${seed}: it changes nothing outside the slot 6 box (${r.outside} outside, ${r.inside} inside)`);
    t.ok(r.under === r.wantUnder && r.ys[0] < r.ys[1] && r.ys[1] < r.ys[2] && r.air, `seed ${seed}: orange, blue and green tiers under trainer 1, trainer 2 and the leader, feet and head free (${r.under} / ${r.ys})`);
    t.ok(r.reach.every(Boolean) && r.levels, `seed ${seed}: a walk from the path reaches all three people (${r.reach})`);
  }

  // ---- 7. gym battles in the real world ----
  const pre = await page.evaluate(async () => {
    const g = window.pokecraft, { makeCreature } = await import('/src/species.js');
    g.party = [makeCreature('thunderwolf', 70), makeCreature('tidalord', 70), makeCreature('grovebeast', 70)];
    const gym = g.world.gyms.find(x => x.def.id === 'squad');
    const [fx, fz] = gym.front;
    const npcs = g.npcs.list.filter(n => n.gym === gym);
    g.player.pos.set(gym.x + 0.5 + fx * 8, gym.fy + 1, gym.z + 0.5 + fz * 8);
    g.player.vel.set(0, 0, 0);
    document.exitPointerLock();
    return { n: npcs.length, kinds: npcs.map(n => n.kind + (n.index ?? '')).sort().join() };
  });
  t.ok(pre.n === 3, `three people in the Big Top (${pre.kinds})`);
  const sq = (kind, i = 0) => `window.pokecraft.npcs.list.find(n => n.kind === '${kind}' && n.gym.def.id === 'squad' && n.index === ${i})`;
  await page.evaluate(`window.pokecraft.talkTo(${sq('leader')})`);
  t.ok(!(await page.evaluate(() => window.pokecraft.inBattle)) && (await page.locator('#toast').innerText()).includes('Beat Acrobat Lulu'), 'the leader asks for both trainers first');
  await pause(page);
  await page.evaluate(() => {
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'squad'), [fx, fz] = gym.front;
    g.player.pos.set(gym.x + 0.5 + fx * 9, gym.fy + 1, gym.z + 0.5 + fz * 9);
    g.player.vel.set(0, 0, 0);
  });
  await page.evaluate(async () => {
    const THREE = await import('three');
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'squad'), [fx, fz] = gym.front;
    g.player.lookAt(new THREE.Vector3(gym.x + 0.5 - fx * 2, gym.fy + 4, gym.z + 0.5 - fz * 2));
  });
  await page.evaluate(() => { document.getElementById('pause').classList.add('hidden'); document.getElementById('toast').replaceChildren(); document.getElementById('toast').classList.add('hidden'); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOTS, 't34-bigtop.png'), timeout: 120000 });
  console.log('  screenshot t34-bigtop.png');
  await page.evaluate(async () => { // and the tent from outside, a little above the ground
    const THREE = await import('three');
    const g = window.pokecraft, gym = g.world.gyms.find(x => x.def.id === 'squad'), [fx, fz] = gym.front;
    g.player.pos.set(gym.x + 0.5 + fx * 24, gym.fy + 9, gym.z + 0.5 + fz * 24);
    g.player.lookAt(new THREE.Vector3(gym.x + 0.5, gym.fy + 6, gym.z + 0.5));
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOTS, 't34-bigtop-outside.png'), timeout: 120000 });
  console.log('  screenshot t34-bigtop-outside.png');
  await page.evaluate(`window.pokecraft.talkTo(${sq('trainer')})`);
  t.ok(await playBattle(page), 'Acrobat Lulu battle finishes');
  await page.evaluate(`window.pokecraft.talkTo(${sq('trainer', 1)})`);
  t.ok(await playBattle(page), 'Tumbler Ned battle finishes');
  t.ok(await page.evaluate(() => ['squad:trainer', 'squad:trainer2'].every(k => window.pokecraft.beaten.includes(k))), 'both Big Top trainers are remembered');
  await page.evaluate(async () => {
    const { statsFor } = await import('/src/species.js');
    for (const c of window.pokecraft.party) c.hp = statsFor(c).maxHp;
  });
  await page.evaluate(`window.pokecraft.talkTo(${sq('leader')})`);
  t.ok(await playBattle(page), 'Leader Topsy battle finishes');
  t.ok(await page.evaluate(() => window.pokecraft.badges.includes('squad')), 'Pyramid Badge awarded');

  // ---- 8. the Book ----
  const bk = await page.evaluate(async () => {
    const g = window.pokecraft, { CREW } = await import('/src/species.js');
    g.book.markCaught('teetertot'); g.book.markCaught('fluffin');
    g.book.open({ species: 'teetertot' });
    await new Promise(r => setTimeout(r, 500));
    const crew = document.querySelector('#book .book-crew')?.textContent;
    g.book.open({ species: 'fluffin' });
    await new Promise(r => setTimeout(r, 500));
    return { crew, text: CREW.book, plain: !!document.querySelector('#book .book-crew') };
  });
  t.ok(bk.crew === bk.text && !bk.plain, 'the Book page of Teetertot has the crew line; Fluffin has none');
  t.ok(!page.errors.length, `no page errors ${page.errors.join('; ')}`);
  await page.context().close();
}
