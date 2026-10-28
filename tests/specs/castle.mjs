// T49 Knight type and the Castle (plans/T49-castle.md). A: the Knight type data (7 creatures, 4 own shapes with the pennant, moves, big moves,
// fx, sounds, the chart's new cells only, Sir Clanksalot and his helpers, the frame that was secret3); B: the Castle as terrain in Node
// (castlecheck.mjs: the drawbridge keeps the castle shut, swimming too; the Tilt Yard only through the hedge maze; the portcullis; nobody stuck;
// the maze's numbers; every throw's flight clear; the lanes; keeps; nooks; block ids); C: the two challenges as pure rules in Node with the
// model players of castlebots.mjs at 60 and 20 steps a second (skilled wins, still / spinner / jumpy / random never, a slow child wins round 3
// with the kind help; replays; the plan rules) and the shared gates (castlegate.js); D: playing in a browser (the frame, the guide, Shield Up!
// through the live part, the drawbridge, the maze's gentle guide, the Joust, the portcullis, a reload, the gate words, the helpers, the Boss,
// a lost battle, the star and the keys cleared, a wild Knight's sentry march, the Book); E: an iPad; F: two browsers (the drawbridge one
// player lowers is down for both, a guest who joins later gets it); G: closed without ?preview. CASTLE_ONLY=data|land|rules|play|ipad|pair|closed|shots.
// Screenshots: tests/screenshots/t49-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, waitFor as waitFor0, playBattle, continueGame } from '../helpers.mjs';
import * as S from '../../src/siege.js';
import * as J from '../../src/joust.js';
import * as M from '../../src/hedgemaze.js';
import * as CL from '../../src/castleland.js';
import { createCastleGates } from '../../src/castlegate.js';
import { analyze } from '../castlecheck.mjs';
import { SIEGE_BOTS, JOUST_BOTS, playSiege, playJoust } from '../castlebots.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const IDS = ['pricklet', 'bristleguard', 'visnail', 'ramparsnail', 'clipclop', 'gallantrot', 'turrock'];
const ONLY = process.env.CASTLE_ONLY || '';
const want = part => !ONLY || ONLY === part;
const waitFor = (page, fn, arg, timeout = 90000) => waitFor0(page, fn, arg, timeout);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const frames = (page, n = 2) => page.evaluate(async n => {
  const g = window.pokecraft;
  for (let i = 0; i < n; i++) { const t0 = g.time; await new Promise(res => { const f = () => (g.time !== t0 ? res() : requestAnimationFrame(f)); f(); }); }
}, n);
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); }); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };
const retry = async (fn, n = 3) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || !/Timeout/.test(e.message)) throw e; console.log('  (the page was slow to start: trying again)'); } } };

// A Champion in the Castle, through its frame in the Swirl.
async function intoCastle(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  const cell = await page.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'castle'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(page, 'castle');
}
// The live part driven by hand (a manual clock), toasts collected, model players from castlebots.mjs.
const arm = page => page.evaluate(async () => {
  const g = window.pokecraft, Sg = await import('/src/siege.js'), Jo = await import('/src/joust.js'), CLm = await import('/src/castleland.js'), Bots = await import('/tests/castlebots.mjs'), { B } = await import('/src/blocks.js');
  const live = g.gymLive.of('part:castle');
  live.manual = true; live.playing = () => true;
  window.__toasts = [];
  const f = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...r) => { window.__toasts.push(m); return f(m, ...r); };
  const p = g.player;
  window.__R = {
    g, live, S: Sg, J: Jo, CL: CLm, Bots, B, p,
    said: re => window.__toasts.some(m => new RegExp(re).test(m)),
    put(x, y, z) { p.carry = null; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.keys = {}; p.joy = null; p.onGround = false; p.update(0.02); },
    // a whole Shield Up! round through the live part, with a model player deciding the shield once per frame
    siege(bot = 'skilled', dt = 1 / 30, arg) { const b = Bots.SIEGE_BOTS[bot](arg); let n = 0; while (live.sg && !live.sg.done && n++ < 20000) live.step(dt, { shield: b(live.sg) }); return live.info(); },
    // a whole joust round (4 passes): Charge! at the start of each pass, the model player steers the tip
    joust(bot = 'skilled', dt = 1 / 30) {
      const b = Jo && Bots.JOUST_BOTS[bot](); let n = 0;
      do { if (live.ride?.phase === 'idle') live.charge(); const jr = live.jr; live.step(dt, { lance: jr && live.ride?.phase === 'pass' ? { ...b(jr), du: 0, dv: 0 } : { su: 0, sv: 0 } }); } while (!(live.jr?.done && live.ride?.phase === 'idle') && n++ < 40000);
      return live.info();
    },
    boss: () => g.npcs.list.find(n => n.kind === 'boss' && n.def?.id === 'castle'),
    crew: i => g.npcs.list.find(n => n.kind === 'crew' && n.def?.boss === 'castle' && n.def.index === i),
    herald: () => g.npcs.list.find(n => n.kind === 'guest' && n.name === 'Herald Hugo'),
  };
  return true;
});

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });

  /* ---------------------------------------------------------------- B. The Castle as terrain (Node) */
  if (want('land')) {
    for (const seed of [1, 2, 3]) {
      const t0 = Date.now(), r = analyze(seed);
      t.ok(!r.problems.length, `seed ${seed}: the drawbridge keeps the castle shut (swimming too), the Tilt Yard only through the maze, the portcullis keeps the keep shut, Wren / Pip / the pads / the stones reachable, nobody stuck (${r.info.reach} places), every throw's flight clear, the lanes clear, keeps, nooks, ids ${r.info.ids.filter(i => i > 100)} (${Date.now() - t0} ms) ${r.problems.join('; ')}`);
      if (seed === 1) t.ok(r.info.maze.cells >= M.MAZE.minPath && r.info.maze.cells <= M.MAZE.maxPath && r.info.maze.deadEnds === M.MAZE.deadEnds && r.info.maze.loops >= 2, `the hedge maze is middle difficulty: the shortest way ${r.info.maze.cells} cells (${r.info.maze.blocks} blocks of walking; band ${M.MAZE.minPath}-${M.MAZE.maxPath}), ${r.info.maze.deadEnds} dead ends, ${r.info.maze.loops} loops, no switches`);
    }
    const a = M.mazeOf(), b = M.mazeOf(M.MAZE.seed);
    t.ok(a === b && JSON.stringify(M.mazeCells().hedge) === JSON.stringify(M.mazeCells(M.MAZE.seed).hedge), 'the maze is the same in every world (a fixed seed)');
  }

  /* ---------------------------------------------------------------- C. The challenges' rules (Node) */
  if (want('rules')) {
    // plans are pure, and keep their rules
    const p1 = S.siegePlan(7, 1, 0), p2 = S.siegePlan(7, 1, 0), p3 = S.siegePlan(7, 1, 1);
    t.ok(JSON.stringify(p1) === JSON.stringify(p2) && JSON.stringify(p1.throws) !== JSON.stringify(p3.throws), 'Shield Up!: the same seed gives the same throws, a new try new ones (no Math.random)');
    let rules = [];
    for (let seed = 1; seed <= 40; seed++) for (let r = 0; r < 3; r++) for (const hard of [false, true]) {
      const pl = S.siegePlan(seed, r, 0, { hard }), th = pl.throws;
      if (r === 0 && th.some(x => !S.SIEGE.front.includes(x.k))) rules.push(`r1 seed ${seed}: a throw from behind`);
      if (r === 1 && th.filter(x => S.SIEGE.behind.includes(x.k)).length < 4) rules.push(`r2 seed ${seed}: fewer than 4 from behind`);
      for (let i = 1; i < th.length; i++) {
        if (th[i].k === th[i - 1].k) rules.push(`seed ${seed} r${r + 1}: a spot twice in a row`);
        if (th[i].pair && Math.abs(Math.atan2(Math.sin((th[i].k - th[i - 1].k) * Math.PI / 6), Math.cos((th[i].k - th[i - 1].k) * Math.PI / 6))) < Math.PI / 2 - 0.02) rules.push(`seed ${seed} r${r + 1}: a pair from close sides`);
        if ((th[i].kind === 'sky' || th[i - 1].kind === 'sky') && th[i].at - th[i - 1].at < 0.6 - 1e-9) rules.push(`seed ${seed} r${r + 1}: a sky one too close to another`);
        if (th[i].at < th[i - 1].at) rules.push(`seed ${seed}: out of order`);
      }
      if (th.some(x => x.at - x.flight - x.tell < 0.29)) rules.push(`seed ${seed}: a tell before the round starts`);
      if (pl.n !== S.SIEGE.rounds[r].n + (hard ? 2 : 0) || pl.need !== S.SIEGE.rounds[r].need + (hard ? 1 : 0)) rules.push('the counts');
      if (r === 2 && !hard && (th.filter(x => x.kind === 'sky').length !== 2 || th.filter(x => x.kind === 'big').length !== 2)) rules.push(`seed ${seed}: round 3 has not 2 sky and 2 big ones`);
    }
    t.ok(!rules.length, `Shield Up!'s plans keep their rules for 40 seeds (round 1 only from the castle side, round 2 at least 4 from behind, pairs from sides 90 degrees apart, a sky one never close to another, the counts) ${rules.slice(0, 4).join('; ')}`);
    // the judge
    const st = S.SIEGE.stones[0], tk = { k: 3, kind: 'pumpkin' }, d = S.dirTo(st, 3);
    t.ok(S.judge(tk, st, d, false) === 'perfect' && S.judge(tk, st, d + 0.4, false) === 'block' && S.judge(tk, st, d + 0.8, false) === 'splat' && S.judge(tk, st, d, true) === 'splat'
      && S.judge({ kind: 'sky', k: 0 }, st, 0, true) === 'block' && S.judge({ kind: 'sky', k: 0 }, st, 0, false) === 'splat' && S.judge({ k: 3, kind: 'big' }, st, d + 0.3, false) === 'splat' && S.judge({ k: 3, kind: 'big' }, st, d + 0.1, false) === 'perfect',
    'the judge: the shield on it is Perfect, within 35 degrees a block, else a splat; held up only stops sky ones; a big one needs a Perfect');
    // model players, 20 seeds, 60 and 20 steps a second
    const sum = (bot, opts) => { let w = 0; for (let seed = 1; seed <= 20; seed++) w += playSiege(SIEGE_BOTS[bot](), { seed, ...opts }).won; return w; };
    for (const fps of [60, 20]) {
      const sk = [0, 1, 2].map(round => sum('skilled', { round, fps })), skH = [0, 1, 2].map(round => sum('skilled', { round, fps, hard: true }));
      const never = ['still', 'spinner', 'jumpy'].map(b => [0, 1, 2].map(round => sum(b, { round, fps }) + sum(b, { round, fps, help: 3 })).reduce((a, c) => a + c, 0));
      const slow = [sum('slow', { round: 2, fps }), sum('slow', { round: 2, fps, help: 3 }), sum('slow', { round: 0, fps })];
      t.ok(sk.every(n => n === 20) && skH.every(n => n === 20), `Shield Up! @${fps}: a skilled player (0.35 s to react) wins all three rounds, also the rematch's (${sk} / ${skH})`);
      t.ok(never.every(n => n === 0), `Shield Up! @${fps}: standing still, spinning the stick or holding Jump never wins, not even with the help (${never})`);
      t.ok(slow[0] <= 14 && slow[1] === 20 && slow[2] === 20, `Shield Up! @${fps}: a slow child (1.5 s) wins round 1, often misses round 3 (${slow[0]} / 20) and wins it with the kind help (${slow[1]} / 20)`);
    }
    // replays: the same inputs (decided on a 20 Hz grid) give the same result at 60 and 20 frames a second
    const grid = (bot) => { let last = -1, held = null; return g => { const k = Math.floor(g.time * 20 + 1e-9); if (k !== last) { last = k; held = bot(g); } return held; }; };
    let same = 0;
    for (let seed = 1; seed <= 10; seed++) { const a = playSiege(grid(SIEGE_BOTS.skilled(0.6)), { seed, round: 2, fps: 60 }), b = playSiege(grid(SIEGE_BOTS.skilled(0.6)), { seed, round: 2, fps: 20 }); if (a.score === b.score && a.won === b.won) same++; }
    t.ok(same === 10, `Shield Up!: the same presses give the same result at 60 and 20 frames a second (${same} / 10)`);
    // the Joust
    const q1 = J.joustPlan(5, 2, 0), q2 = J.joustPlan(5, 2, 0), q3 = J.joustPlan(5, 2, 1);
    t.ok(JSON.stringify(q1) === JSON.stringify(q2) && JSON.stringify(q1.passes) !== JSON.stringify(q3.passes) && J.JOUST.spots.every(s => Math.hypot(...s) >= 0.45), 'the Joust: plans are pure; round 1\'s star is never in the middle');
    const jsum = (bot, opts) => { let w = 0; for (let seed = 1; seed <= 20; seed++) w += playJoust(JOUST_BOTS[bot](), { seed, ...opts }).won; return w; };
    for (const fps of [60, 20]) {
      const sk = [0, 1, 2].map(round => jsum('skilled', { round, fps })), skH = [0, 1, 2].map(round => jsum('skilled', { round, fps, hard: true }));
      const still = [0, 1, 2].map(round => jsum('still', { round, fps })), rnd = [1, 2].map(round => jsum('random', { round, fps }));
      const tr = [jsum('tracker', { round: 0, fps }), jsum('tracker', { round: 2, fps }), jsum('tracker', { round: 2, fps, help: 3 })];
      t.ok(sk.every(n => n === 20) && skH.every(n => n >= 19), `the Joust @${fps}: a skilled rider wins all three rounds (${sk}), also the rematch's (${skH})`);
      t.ok(still.every(n => n === 0) && rnd.every(n => n <= 2), `the Joust @${fps}: holding still never wins (${still}), a random stick almost never (${rnd} of 20 in rounds 2 and 3)`);
      t.ok(tr[0] === 20 && tr[1] <= 4 && tr[2] >= 10, `the Joust @${fps}: a child who follows the star (but does not lead it) wins round 1, rarely round 3 (${tr[1]}), often with the help (${tr[2]})`);
    }
    const jgrid = bot => { let last = -1, held = null; return g => { const k = Math.floor((g.pass * 100 + g.tau) * 20 + 1e-9); if (k !== last) { last = k; held = bot(g); } return held; }; };
    let jsame = 0;
    for (let seed = 1; seed <= 10; seed++) { const a = playJoust(jgrid(JOUST_BOTS.tracker()), { seed, round: 1, fps: 60 }), b = playJoust(jgrid(JOUST_BOTS.tracker()), { seed, round: 1, fps: 20 }); if (a.results === b.results) jsame++; }
    t.ok(jsame >= 9, `the Joust: the same stick on a 20 Hz grid gives the same meetings at 60 and 20 frames a second (${jsame} / 10)`);
    const m0 = J.meetResult(q1, 0, J.starAt(q1, 0, q1.meet).at.map((v, i) => v - J.bobAt(q1, 0, q1.meet)[i]));
    t.ok(m0.kind === 'bullseye' && m0.points === 2 && J.meetResult(q1, 0, [5, 5]).kind === 'whoosh' && J.meetResult(q1, 0, [0, 0]).points <= 1, 'a tip on the star (with the bob) is a Bullseye (2), far off a Whoosh (0)');
    // the shared gates (castlegate.js) with a stand-in channel: a guest's lowered drawbridge reaches the host and from there everybody
    const net = [];
    const mk = role => { const g = { mp: { active: true, role, code: 'ABCDE', sendCastle: d => net.push({ from: role, d }) } }; createCastleGates(g); return g; };
    const host = mk('host'), guest = mk('guest'), late = mk('guest');
    const deliver = () => { while (net.length) { const { from, d } = net.shift(); for (const g of [host, guest, late]) if (g.mp.role !== from || (from === 'guest' && g === host) ? true : false) { if (from === 'host' && g === host) continue; if (from === 'guest' && g !== host) continue; g.castleGates.onMessage(d); } } };
    guest.castleGates.open('bridge'); deliver();
    const h1 = host.castleGates.shared(), g1 = guest.castleGates.shared();
    late.castleGates.joined(); deliver();
    const l1 = late.castleGates.shared();
    guest.mp.active = false; const off = guest.castleGates.shared();
    t.ok(h1.bridge && !h1.port && g1.bridge && l1.bridge && !l1.port && !off.bridge, `the shared gates: a guest lowers the drawbridge, the host merges it and tells everyone, a guest who joins later asks and gets it; alone nothing is shared (${JSON.stringify([h1, l1, off])})`);
  }

  if (ONLY === 'land' || ONLY === 'rules') return;
  const page = await retry(() => openGame(browser, base));
  page.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await newGame(page, 0); await pause(page);
  await page.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });

  /* ---------------------------------------------------------------- A. Data */
  if (want('data')) {
    const A = await page.evaluate(async ids => {
      const Sp = await import('/src/species.js'), R = await import('/src/fxrecipes.js'), RL = await import('/src/realms.js'), Tr = await import('/src/traits.js'), THREE = await import('three');
      const Bk = await import('/src/blocks.js'), Pb = await import('/src/pictureboss.js'), PW = await import('/src/pictureworlds.js'), SR = await import('/src/spawnrules.js');
      const old = await (await fetch('/tests/fixtures/old-chart.json')).json();
      const g = window.pokecraft, out = { problems: [] };
      const bad = (id, m) => out.problems.push(`${id}: ${m}`);
      const all = Object.entries(Sp.SPECIES), mine = all.filter(([, s]) => s.type === 'knight').map(([id]) => id);
      out.mine = mine.slice().sort();
      out.shapes = [...new Set(mine.map(id => Sp.SPECIES[id].model.shape))].sort();
      out.ownShapes = out.shapes.every(sh => all.every(([, s]) => s.model.shape !== sh || s.type === 'knight'));
      out.evolve = ['pricklet', 'visnail', 'clipclop'].map(id => `${id}>${Sp.SPECIES[id].evolve?.into}@${Sp.SPECIES[id].evolve?.level}`);
      out.single = !Sp.SPECIES.turrock.evolve;
      const names = all.map(([, s]) => s.name.toLowerCase());
      for (const id of ids) {
        const s = Sp.SPECIES[id];
        if (!s) { bad(id, 'missing'); continue; }
        if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(id, 'name is not unique');
        if (!s.desc || s.desc.length > 125) bad(id, `desc is ${s.desc?.length} characters`);
        if (s.gait !== 'sentry') bad(id, 'no sentry gait');
        if (!Sp.makeCreature(id, 20).moves.some(m => Sp.MOVES[m].type === 'knight')) bad(id, 'no knight move at Lv 20');
        for (const [, m] of s.learn) if (!Sp.MOVES[m]) bad(id, `move ${m} missing`);
        for (const [biome, list] of Object.entries(Sp.SPAWNS)) if (list.some(e => e[0] === id)) bad(id, `in the main world's ${biome} table`);
        try {
          const m = Sp.buildModel(id);
          Sp.animateModel(m, 0, false);
          const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
          if (size.y < 0.35 || size.y > 2.8) bad(id, `height ${size.y.toFixed(2)}`);
          if (size.x > 2.8 || size.z > 2.8) bad(id, `width/depth ${size.x.toFixed(2)}/${size.z.toFixed(2)}`);
          let min = box.min.y;
          for (const [tm, mv] of [[0.3, false], [0.7, true], [1.1, false], [1.9, true]]) { Sp.animateModel(m, tm, mv); min = Math.min(min, new THREE.Box3().setFromObject(m).min.y); }
          if (min < -0.1) bad(id, `goes under the ground (${min.toFixed(2)})`);
          const sig = () => { let sum = 0; m.updateMatrixWorld(true); m.traverse(o => { if (o.isMesh) for (const v of o.matrixWorld.elements) sum += v; }); return sum; };
          Sp.animateModel(m, 0.3, false); const a = sig(); Sp.animateModel(m, 1.1, false); const b = sig();
          if (Math.abs(a - b) < 1e-6) bad(id, 'no idle animation');
          const gear = []; m.traverse(o => { if (o.userData.gear === 'pennant') gear.push(o); });
          if (gear.length !== 1) bad(id, `${gear.length} pennant meshes (one merged mesh per model)`);
          Sp.disposeModel(m);
        } catch (e) { bad(id, `model failed: ${e.message}`); }
      }
      const Mv = Sp.MOVES, m6 = ['shieldbash', 'lancecharge', 'quickparry', 'bannerwave', 'grandjoust', 'quillvolley'], m3 = ['roundtable', 'holdthegate', 'lastcharge'];
      out.moves = [...m6, ...m3].map(id => Mv[id]?.type);
      out.fine = Mv.quickparry.priority === 1 && Mv.bannerwave.fx?.kind === 'raise' && Mv.lancecharge.fx?.kind === 'recoil' && Mv.shieldbash.power === 40;
      out.sig = !!Mv.grandjoust.sig && !!Mv.quillvolley.sig && Sp.SPECIES.gallantrot.learn.some(([l, m]) => l === 30 && m === 'grandjoust') && Sp.SPECIES.bristleguard.learn.some(([l, m]) => l === 30 && m === 'quillvolley');
      out.big = m3.map(id => [Mv[id].fx.kind, !!Mv[id].big]);
      const types = Object.keys(Sp.TYPE_COLORS), olds = Object.keys(old);
      out.types = types.length;
      out.ownRow = types.filter(x => Sp.effectiveness('knight', x) !== 1).map(x => `${x}:${Sp.effectiveness('knight', x)}`).sort().join();
      out.vs = types.filter(x => x !== 'knight' && Sp.effectiveness(x, 'knight') !== 1).map(x => `${x}:${Sp.effectiveness(x, 'knight')}`).sort().join();
      out.oldChart = olds.every(a => olds.every(d => Sp.effectiveness(a, d) === (old[a][d] ?? 1)));
      const weak = d => types.filter(a => Sp.effectiveness(a, d) > 1).length;
      out.weak = ['knight', 'pirate', 'ninja', 'alien'].filter(d => weak(d) > 5).join(); // (the defenders that gained a weakness)
      out.color = Sp.TYPE_COLORS.knight;
      out.wool = [Bk.WOOL.knight, Bk.BLOCKS[Bk.WOOL.knight]?.name, Bk.PLACEABLE.includes(Bk.WOOL.knight)];
      out.hedge = [Bk.B.HEDGE, Bk.BLOCKS[Bk.B.HEDGE]?.name, !!Bk.BLOCKS[Bk.B.HEDGE]?.fixed, !!Bk.BLOCKS[Bk.B.HEDGE]?.wallText, Bk.PLACEABLE.includes(Bk.B.HEDGE), Bk.isSolid(Bk.B.HEDGE)];
      out.fxOwn = R.TRAVEL.knight !== R.TRAVEL.normal && R.IMPACT.knight !== R.IMPACT.normal && !!R.FX_COLORS.knight && typeof R.SIG.grandjoust === 'function' && typeof R.SIG.quillvolley === 'function';
      const sounds = ['fx:knight', 'trumpet', 'catapultcreak', 'catapultthunk', 'bowtwang', 'shieldclang', 'pumpkinsplat', 'lanceclang', 'drawbridge', 'helmbonk'];
      out.sounds = sounds.map(n => g.sound.has(n));
      try { for (const n of sounds) g.sound.play(n); out.played = true; } catch (e) { out.played = e.message; }
      out.soundClash = [...m6, ...m3].filter(id => g.sound.has(id));
      const spawns = RL.REALMS.castle.spawns;
      out.realm = [...new Set([...spawns.castle, ...spawns.castleMeadow].map(e => e[0]))].sort().join();
      out.rare = spawns.castle.filter(e => e[3] === 'castle').map(e => e[0]).sort().join();
      out.cond = [SR.CONDITIONS.guardpost?.text, SR.AFTER_TEXT.castle];
      out.rideable = Tr.TRAITS.rideable.species.gallantrot;
      out.levels = [RL.REALMS.castle.levelBonus, RL.REALMS.castle.levelCap, RL.REALMS.castle.parent, RL.REALMS.castle.lose];
      const boss = Pb.bossOf('castle');
      out.boss = { name: boss.name, title: boss.title, top: Math.max(...boss.team.map(x => x[1])), n: boss.team.length, type: boss.type, look: boss.look, crew: boss.crew.map(c => c.name).join(), gate: typeof boss.gate, notes: !!boss.note && !!boss.lose && !!boss.win && !!boss.rematchIntro };
      out.bossMoves = boss.team.filter(x => x[2]).every(([id, lv, mv]) => JSON.stringify(Sp.movesWith(id, lv, ...mv).slice().sort()) === JSON.stringify(mv.slice().sort()));
      const pw = PW.pictureWorld('castle');
      out.frame = { ready: pw?.ready, realm: pw?.realm, name: pw?.name, idx: PW.PICTURE_WORLDS.findIndex(w => w.id === 'castle'), frame: pw?.frame?.map(c => c.toString(16)).join(), secret3: !!PW.pictureWorld('secret3'), stars: PW.loadStars(['castle', 'secret3', 'fair']).join() };
      return out;
    }, IDS);
    t.ok(JSON.stringify(A.mine) === JSON.stringify([...IDS].sort()) && A.evolve.join() === 'pricklet>bristleguard@24,visnail>ramparsnail@22,clipclop>gallantrot@26' && A.single, `seven Knight species, three families and Turrock (${A.evolve})`);
    t.ok(A.shapes.join() === 'armourhorse,helmsnail,shieldhog,walkturret' && A.ownShapes, `four own Knight shapes (${A.shapes}), used by no other type`);
    t.ok(!A.problems.length, `all seven pass the data and model checks (one pennant mesh each, size, animation, the sentry walk, only in the Castle) ${A.problems.join('; ')}`);
    t.ok(A.moves.every(m => m === 'knight') && A.fine && A.sig && JSON.stringify(A.big) === JSON.stringify([['rally', true], ['shield', true], ['lastword', true]]), 'the moves: Shield Bash, Lance Charge (recoil), Quick Parry (first), Banner Wave (attack up), the signatures Grand Joust and Quill Volley at 30, the big moves Round Table, Hold the Gate, Last Charge');
    t.ok(A.ownRow === 'alien:2,knight:0.5,metal:0.5,ninja:2,pirate:2,rock:0.5' && A.vs === 'bug:0.5,drake:0.5,electric:2,tiny:2,water:2' && A.oldChart && !A.weak, `the chart: its own row (${A.ownRow}), the cells against it (${A.vs}); the old chart unchanged; no defender too weak (${A.weak || 'none'})`);
    t.ok(/gradient/.test(A.color) && A.wool.join() === '254,Knight Wool,false' && A.hedge.join() === '182,Castle Hedge,true,true,false,true', `a type colour, the knight wool 254 and the hedge 182 (fixed, a wall text, not placeable): the only new block ids (${A.wool} / ${A.hedge})`);
    t.ok(A.fxOwn && A.sounds.every(Boolean) && A.played === true && !A.soundClash.length, 'knight effects, colours, the two signature effects and the Castle\'s sounds exist and play; no move is named like a sound');
    t.ok(A.realm === [...IDS].sort().join() && A.rare === 'bristleguard,gallantrot,ramparsnail,turrock' && A.cond[0] === 'on guard at the castle' && !!A.cond[1], `all seven live only in the Castle on guard posts; the big ones only after some progress ("${A.cond[1]}")`);
    t.ok(A.rideable === 'land' && A.levels.join() === '33,45,swirl,stay', `Gallantrot can be ridden (land); a Picture World of the Swirl (${A.levels})`);
    t.ok(A.boss.name === 'Sir Clanksalot' && A.boss.title === 'Sir Clanksalot · Castle Boss' && A.boss.top === 64 && A.boss.n === 4 && A.boss.type === 'knight' && A.boss.look === 'knight' && A.boss.crew === 'Squire Pip,Archer Wren' && A.boss.gate === 'function' && A.boss.notes && A.bossMoves, `Sir Clanksalot: top level 64, four creatures, a gate, Squire Pip and Archer Wren (${JSON.stringify(A.boss)})`);
    t.ok(A.frame.ready && A.frame.realm === 'castle' && A.frame.name === 'Castle' && A.frame.idx === 9 && A.frame.frame === 'f8b8a0,e8f0f8' && !A.frame.secret3 && A.frame.stars === 'fair,castle', `the frame that was secret3 is the Castle (same place ${A.frame.idx}, same colours), ready with ?preview; an old secret3 in a save is dropped (${A.frame.stars})`);
    const shots = await page.evaluate(async ids => {
      const { portrait } = await import('/src/ui.js'), Sp = await import('/src/species.js');
      const W = 220, H = 190, LABEL = 26, COLS = 4, rows = Math.ceil(ids.length / COLS), cv = document.createElement('canvas');
      cv.width = W * COLS; cv.height = (H + LABEL) * rows;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
      for (let i = 0; i < ids.length; i++) {
        const img = new Image(); img.src = portrait(ids[i], W, H);
        await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
        const x = (i % COLS) * W, y = Math.floor(i / COLS) * (H + LABEL);
        ctx.drawImage(img, x, y); ctx.fillText(Sp.SPECIES[ids[i]].name, x + W / 2, y + H + 18);
      }
      return cv.toDataURL();
    }, IDS);
    fs.writeFileSync(path.join(SHOTS, 't49-creatures.png'), Buffer.from(shots.split(',')[1], 'base64')); console.log('  screenshot t49-creatures.png');
    if (ONLY === 'data') return;
  }

  /* ---------------------------------------------------------------- D. Playing the Castle */
  if (want('play') || want('shots')) {
    await intoCastle(page);
    await arm(page);
    const D0 = await page.evaluate(() => {
      const R = window.__R, { g, live, p } = R;
      live.step(0.05);
      const aim = live.aim(p.pos)?.text('↑', 20);
      const st = R.CL.castleState(g);
      const deck = live.L.deck.every(c => g.world.get(...c) === R.B.AIR), raised = live.L.raised.every(c => g.world.get(...c) === R.B.HOUSE_PROP), port = live.L.port.every(c => g.world.get(...c) === R.B.HOUSE_PROP);
      return { place: g.place, parts: g.world.parts.map(x => x.id).join(), aim, st, deck, raised, port, herald: !!R.herald(), boss: !!R.boss(), crew: [R.crew(0)?.name, R.crew(1)?.name].join(), chip: document.getElementById('score-chip')?.textContent, said: R.said('Ta-ta-taa! Welcome to the Castle!') || true };
    });
    t.ok(D0.place === 'castle' && D0.parts === 'castle' && D0.herald && D0.boss && D0.crew === 'Squire Pip,Archer Wren', `the Castle frame opens the Castle; Herald Hugo, Sir Clanksalot and his helpers are there (${D0.crew})`);
    t.ok(D0.deck && D0.raised && D0.port && /Shield Stone/.test(D0.aim) && /🛡️ 0 \/ 3 · 🐴 0 \/ 3/.test(D0.chip), `at the start the drawbridge is up and the portcullis down (live cells), the guide leads to the Shield Stone ("${D0.aim}"), the chip says ${D0.chip}`);
    if (want('play')) {
      // Shield Up!: the words, a round lost by standing still, a round won by a skilled player, the key saved
      const D1 = await page.evaluate(() => {
        const R = window.__R, { g, live, p, S } = R, s = S.SIEGE.stones[0], out = {};
        R.put(s[0], s[1], s[2] + 4); out.away = live.near(p);
        R.put(s[0], s[1], s[2]); out.word = live.near(p);
        out.used = live.use(p); out.carry = p.carry === live.stanceObj; out.running = live.running(); out.stop = live.near(p); out.jump = p.carry?.jumpWord?.();
        out.still = R.siege('still'); out.again = R.said('So close!');
        out.word2 = live.near(p); live.use(p);
        out.won = R.siege('skilled'); out.key = g.beaten.includes('pw:castle:shield1');
        out.splatNoRed = !document.getElementById('castle-goo') || [...document.getElementById('castle-goo').children].every(b => !/rgb\(2[0-9]{2}, [0-9]{1,2}, [0-9]{1,2}\)/.test(getComputedStyle(b).backgroundColor) || /255, 1[3-9][0-9]|255, 18[0-9]/.test(getComputedStyle(b).backgroundColor));
        out.gooColours = document.getElementById('castle-goo') ? [...document.getElementById('castle-goo').children].map(b => getComputedStyle(b).backgroundColor) : [];
        return out;
      });
      t.ok(D1.away === null && D1.word === 'Shield!' && D1.used && D1.carry && D1.running && D1.stop === 'Stop' && D1.jump === 'Shield', `on the Shield Stone the big button says Shield!, you stand your ground (Stop / Jump = Shield) (${JSON.stringify([D1.away, D1.word, D1.stop, D1.jump])})`);
      t.ok(!D1.still.won && D1.again && D1.word2 === 'Shield!' && D1.won.won && D1.key, `standing still loses a round softly ("So close!", ${D1.still.blocks} blocks), a skilled player wins round 1 (${D1.won.blocks} / ${D1.won.need}) and the key is saved`);
      const red = D1.gooColours.filter(c => { const m = c.match(/\d+/g)?.map(Number); return m && m[0] > 180 && m[1] < 90 && m[2] < 90; });
      t.ok(D1.gooColours.length > 0 && !red.length, `a splat is orange and green goo, never red (${[...new Set(D1.gooColours)].join(' ')})`);
      // a reload keeps the key
      await page.evaluate(() => window.pokecraft.save());
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page);
      await placeIs(page, 'castle'); await arm(page);
      const D2 = await page.evaluate(() => { const R = window.__R, { g } = R; return { st: R.CL.castleState(g), place: g.place }; });
      t.ok(D2.place === 'castle' && D2.st.shield === 1, `a reload keeps the round won (🛡️ ${D2.st.shield} / 3) and you are still in the Castle`);
      // rounds 2 and 3, the drawbridge comes down
      const D3 = await page.evaluate(() => {
        const R = window.__R, { g, live, p, S } = R, s = S.SIEGE.stones[1], out = {};
        R.put(s[0], s[1], s[2]); live.use(p); out.r2 = R.siege('skilled'); live.use(p); out.r3 = R.siege('skilled');
        out.st = R.CL.castleState(g); out.bridgeSaid = R.said('The drawbridge is coming down');
        live.step(0.3);
        out.deck = live.L.deck.every(c => g.world.get(...c) === R.B.PLANKS); out.gate = live.L.raised.every(c => g.world.get(...c) === R.B.AIR);
        out.word = live.near(p); p.keys = {}; p.update(0.03); p.keys = { Space: true }; p.update(0.03); p.keys = {}; out.off = p.carry === null && live.stance === -1;
        return out;
      });
      t.ok(D3.r2.won && D3.r3.won && D3.st.shield === 3 && D3.bridgeSaid && D3.deck && D3.gate && D3.word === null && D3.off, `rounds 2 and 3 won; the drawbridge comes down (planks over the moat, the gate open); Jump steps off the stone ${JSON.stringify(D3).slice(0, 400)}`);
      // walk over the drawbridge with real physics, into the courtyard; the maze's gentle guide
      const D4 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, out = {};
        R.put(80.5, 11, 112.5); p.yaw = 0; // facing -z
        p.keys = { KeyW: true };
        for (let i = 0; i < 30 * 6; i++) { p.update(1 / 30); live.step(1 / 30); }
        p.keys = {}; out.z = p.pos.z; out.y = p.pos.y;
        out.aimCourt = live.aim(p.pos)?.text('↑', 10);
        R.put(103.5, 11, 89.5); live.step(0.05); out.inMaze = R.CL && live.mazeTime > 0;
        out.aim0 = live.aim(p.pos); out.aim0t = out.aim0?.text('↑', 3); out.aim0x = out.aim0?.x;
        for (let i = 0; i < 500; i++) live.step(0.1); out.aim1t = live.aim(p.pos)?.text('↑', 3); out.aim1x = live.aim(p.pos)?.x;
        for (let i = 0; i < 500; i++) live.step(0.1); out.aim2 = live.aim(p.pos); out.aim2t = out.aim2?.text('↑', 3);
        return out;
      });
      t.ok(D4.z < 100 && Math.abs(D4.y - 11) < 0.1 && /hedge maze/.test(D4.aimCourt), `walking over the drawbridge leads into the castle (z ${D4.z.toFixed(1)}); the guide points at the hedge maze ("${D4.aimCourt}")`);
      t.ok(D4.inMaze && D4.aim0x === undefined && /hedge maze/.test(D4.aim0t) && D4.aim1x === undefined && /hand on the hedge/.test(D4.aim1t) && D4.aim2?.x !== undefined && /way out/.test(D4.aim2t), `in the maze the guide is gentle: words only ("${D4.aim0t}"), then a tip ("${D4.aim1t}"), then after 90 s an arrow to the way out ("${D4.aim2t}")`);
      // the hedge maze's fun (owner 2026-10-28): a lucky horseshoe in a dead end gives one cube once per trip, a critter peeks when you
      // come near, Gardener Gwen stands by the fountain
      const M4 = await page.evaluate(() => {
        const R = window.__R, { g, live } = R, fx = live.fun, h = fx.treats[0], c = fx.peeks[0], out = {};
        const c0 = g.cubes; R.put(h.x, 11, h.z); live.step(0.05); out.got = g.cubes - c0; live.step(0.05); R.put(h.x, 11, h.z); live.step(0.05); out.again = g.cubes - c0;
        out.toast = R.said('lucky horseshoe'); out.hidden = !live.shoes.userData.parts.list[0].visible;
        R.put(c.x + 2.5, 11, c.z + 2.5); live.step(0.05); live.step(0.3); out.peek = live.info().peeking; out.critter = live.critters.userData.parts.list[0].visible;
        out.gwen = !!g.npcs.list.find(n => n.kind === 'guest' && n.name === 'Gardener Gwen');
        const F = fx.fountain; out.fountain = g.world.get(F.x, 11, F.z) === R.B.COBBLE && g.world.get(F.x + 1, 10, F.z) === R.B.WATER && g.world.get(F.x, 12, F.z) === R.B.AIR;
        return out;
      });
      t.ok(M4.got === 1 && M4.again === 1 && M4.toast && M4.hidden && M4.peek > 0 && M4.critter && M4.gwen && M4.fountain, `the hedge maze's fun: a lucky horseshoe gives +1 cube once per trip; a hedge critter peeks when you come near; Gardener Gwen stands by the fountain ${JSON.stringify(M4)}`);
      // the Joust's view (owner 2026-10-28: the target was small and at the side): the camera keeps his big shield in the middle while
      // you charge, zooms in while he is far, and the stick still moves the tip the other way on screen (the "reverse thinking"), both ways down the lane
      const V5 = await page.evaluate(() => {
        const R = window.__R, { g, live, p, CL } = R, cam = g.camera, K = live.knight.userData.parts, out = { passes: [] };
        const ndc = v => { cam.position.copy(p.eyePos); cam.rotation.set(p.pitch, p.yaw, 0); cam.updateMatrixWorld(true); return v.clone().project(cam); };
        const dotAt = () => { live.shieldRig.updateMatrixWorld(true); return ndc(K.dot.getWorldPosition(K.dot.position.clone())); };
        R.put(66.5, 11, 32.5); live.use(p);
        for (let pass = 0; pass < 2; pass++) {
          live.charge(); out.passes.push({ dir: live.horse.dir, call: live.lastCall?.big });
          const o = out.passes[pass];
          for (let i = 0; i < 30; i++) live.step(1 / 30, { lance: { su: 0, sv: 0 } });
          const s0 = ndc(live.shieldPos()); o.centre = Math.hypot(s0.x, s0.y); o.fov = cam.fov;
          const d0 = dotAt(), u0 = live.jr.tip[0];
          for (let i = 0; i < 9; i++) live.step(1 / 30, { lance: { su: 1, sv: 0 } });
          const d1 = dotAt(); o.du = live.jr.tip[0] - u0; o.dx = d1.x - d0.x;
          for (let i = 0; i < 9; i++) live.step(1 / 30, { lance: { su: 0, sv: 1 } });
          o.dy = dotAt().y - d1.y;
          let n = 0; while (!live.lastMeet || live.jr.pass !== pass || live.jr.results.length <= pass) { live.step(1 / 30, { lance: { su: 0, sv: 0 } }); if (n++ > 400) break; }
          o.meet = live.lastCall?.big; o.small = live.lastCall?.small; o.marks = K.marks.filter(m => m.visible).length;
          n = 0; while (live.ride?.phase !== 'idle' && n++ < 600) live.step(1 / 30, { lance: { su: 0, sv: 0 } });
          o.fovBack = cam.fov;
        }
        out.ring = K.ring.scale.x; out.r = live.jr.plan.r;
        live.giveBack(); live.jr = null; live.horse.dir = 1; live.horse.x = CL.TILT.x0; out.fovOff = cam.fov;
        return out;
      });
      const V5ok = V5.passes.every(o => o.centre < 0.25 && o.fov < 70 && o.du > 0 && o.dx < -0.01 && o.dy > 0.01 && /Bullseye|Clang|Whoosh/.test(o.meet) && o.fovBack > 74) && V5.passes[0].dir !== V5.passes[1].dir && V5.passes[0].call === 'Charge!' && Math.abs(V5.ring - V5.r) < 1e-9 && V5.fovOff === 75;
      t.ok(V5ok, `the Joust's view: Charge! frames his shield in the middle (${V5.passes.map(o => o.centre.toFixed(2)).join(' / ')} from the centre, zoomed to ${V5.passes.map(o => o.fov.toFixed(0)).join(' / ')} degrees) both ways down the lane; stick right moves the tip left on screen as before (${V5.passes.map(o => o.dx.toFixed(3)).join(' / ')}), forward moves it up; the meeting says "${V5.passes.map(o => `${o.meet} ${o.small}`).join('" / "')}"; the bullseye ring is the round's radius ${V5.r}`);
      // the Joust
      const D5 = await page.evaluate(() => {
        const R = window.__R, { g, live, p, CL } = R, out = {};
        R.put(66.5, 11, 32.5); out.word = live.near(p); live.use(p); out.mounted = live.mounted && p.carry === live.steedObj; out.ride = g.rideShow;
        out.charge = live.near(p); out.offWord = p.carry?.jumpWord?.();
        out.still = R.joust('still'); out.again = R.said('So close!');
        out.r1 = R.joust('skilled'); out.r2 = R.joust('skilled'); out.r3 = R.joust('skilled');
        out.st = CL.castleState(g); out.portSaid = R.said('The portcullis is up'); live.step(0.3);
        out.port = live.L.port.every(c => g.world.get(...c) === R.B.AIR);
        out.bull = R.said('Bullseye!'); out.clang = R.said('Clang!'); out.whoosh = R.said('Whoosh!');
        p.keys = {}; p.update(0.03); p.keys = { Space: true }; p.update(0.03); p.keys = {}; out.off = !live.mounted && p.carry === null && g.rideShow == null;
        return out;
      });
      t.ok(D5.word === 'Mount!' && D5.mounted && D5.ride === 'gallantrot' && D5.charge === 'Charge!' && D5.offWord === 'Off', `by the castle horse the big button says Mount!, then Charge! (Jump = Off); friends see you on a Gallantrot ${JSON.stringify(D5).slice(0, 300)}`);
      t.ok(!D5.still.joust.won && D5.again && D5.r1.joust.won && D5.r2.joust.won && D5.r3.joust.won && D5.st.lance === 3 && D5.bull && D5.clang, `holding still loses softly (${D5.still.joust.points} points: only Clangs); a skilled rider wins the three rounds (Bullseye! said)`);
      t.ok(D5.portSaid && D5.port && D5.off, 'with the Joust won the portcullis rises; Jump gets you off the horse');
      // the Boss: the crew first, a lost battle stays in the throne room, the star clears the six keys
      const B1 = await page.evaluate(async () => {
        const R = window.__R, { g } = R, Sp = await import('/src/species.js'), out = {};
        g.beaten = g.beaten.filter(k => !/pw:castle:crew/.test(k));
        g.talkTo(R.boss()); out.crewFirst = !g.inBattle && R.said('Beat Squire Pip and Archer Wren first');
        g.party = [Sp.makeCreature('thunderwolf', 100)];
        g.talkTo(R.crew(0));
        return out;
      });
      t.ok(B1.crewFirst, 'Sir Clanksalot waits until his helpers are beaten');
      t.ok(await playBattle(page), "Squire Pip's battle is won");
      await page.evaluate(() => { const R = window.__R, { g } = R; g.talkTo(R.crew(1)); });
      t.ok(await playBattle(page), "Archer Wren's battle is won");
      await page.evaluate(async () => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('fluffin', 2)]; const b = R.boss(); g.player.pos.set(b.pos.x, b.pos.y, b.pos.z + 2.5); g.talkTo(b); });
      t.ok(await playBattle(page), 'a weak team loses the Boss battle');
      const L1 = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos, b = g.world.bosses[0]; return { place: g.place, d: Math.hypot(p.x - b.rest[0], p.z - b.rest[2]), star: g.stars.includes('castle'), said: window.__R.said('Bravely done!') }; });
      t.ok(L1.place === 'castle' && L1.d < 2 && !L1.star && L1.said, `losing keeps you in the throne room (${L1.d.toFixed(1)} from the rest spot)`);
      await page.evaluate(async () => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('thunderwolf', 100)]; g.talkTo(R.boss()); });
      t.ok(await playBattle(page), 'the Boss battle is won');
      const W1 = await page.evaluate(() => { const R = window.__R, { g, live } = R; live.step(0.3); const st = R.CL.castleState(g); return { star: g.stars.includes('castle'), keys: g.beaten.filter(k => /pw:castle:(shield|lance)/.test(k)).length, crew: g.beaten.filter(k => /pw:castle:crew/.test(k)).length, bridge: live.L.deck.every(c => g.world.get(...c) === R.B.PLANKS), port: live.L.port.every(c => g.world.get(...c) === R.B.AIR), note: R.said('toy knights') }; });
      t.ok(W1.star && W1.keys === 0 && W1.crew === 2 && W1.bridge && W1.port && W1.note, 'the star and the Wizard\'s note; the six rounds are cleared for a rematch (the helpers stay beaten), the drawbridge and portcullis stay open for a star holder');
      // a wild Knight on its beat
      const S1 = await page.evaluate(() => {
        const g = window.pokecraft, n = g.world.nooks[0];
        g.creatures.clear();
        const w = g.creatures.spawnAt('pricklet', n.x + 0.5, n.y, n.z + 0.5, { level: 5 });
        g.player.pos.set(n.x + 20, n.y, n.z + 20);
        const xs = [];
        for (let i = 0; i < 60; i++) { g.creatures.updateOne(w, 0.1); xs.push(w.beat.ax === 'x' ? w.pos.x : w.pos.z); }
        const moved = Math.max(...xs) - Math.min(...xs);
        g.player.pos.set(w.pos.x + 2, w.pos.y, w.pos.z);
        const before = [w.pos.x, w.pos.z]; for (let i = 0; i < 20; i++) g.creatures.updateOne(w, 0.1);
        return { len: w.beat.len, moved, still: Math.hypot(w.pos.x - before[0], w.pos.z - before[1]) < 1e-6, faces: Math.abs(Math.atan2(Math.sin(w.heading - Math.atan2(2, 0)), Math.cos(w.heading - Math.atan2(2, 0)))) < 0.3 };
      });
      t.ok(S1.len > 0 && S1.moved > 1 && S1.still && S1.faces, `a wild Pricklet marches its beat (${S1.moved.toFixed(1)} blocks) and stands to attention facing you when you come near`);
      t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join(' | ')}`);
    }
    if (want('shots') || !ONLY) {
      await page.evaluate(() => { const R = window.__R, { p } = R; R.put(86.5, 11, 153.5); p.lookAt({ x: 80.5, y: 17, z: 104 }); R.live.step(0.05); });
      await frames(page, 3); await shot(page, 't49-arrival.png');
      await page.evaluate(() => { const R = window.__R, { g, live, p, S } = R, s = S.SIEGE.stones[0]; g.beaten = g.beaten.filter(k => !/shield/.test(k)); live.sync(true); R.put(s[0], s[1], s[2]); live.use(p); const b = R.Bots.SIEGE_BOTS.skilled(); for (let i = 0; i < 64; i++) live.step(1 / 30, { shield: b(live.sg) }); p.lookAt({ x: 80.5, y: 16, z: 104 }); window.__shieldB = b; });
      await frames(page, 2); await page.evaluate(() => { const R = window.__R; R.live.step(1 / 30, { shield: window.__shieldB(R.live.sg) }); }); await frames(page, 1); await shot(page, 't49-shield.png');
      await page.evaluate(() => { const R = window.__R, { live, p } = R; live.giveBack(); R.put(87.5, 23, 98.5); p.lookAt({ x: 112, y: 11, z: 70 }); live.step(0.05); });
      await frames(page, 3); await shot(page, 't49-maze.png');
      await page.evaluate(() => { const R = window.__R, { live, p } = R, F = live.fun.fountain; R.put(F.x + 3.5, 11, F.z + 3.5); p.lookAt({ x: F.x - 2, y: 12.2, z: F.z - 2.5 }); live.step(0.05); });
      await frames(page, 3); await shot(page, 't49-maze-fountain.png');
      await page.evaluate(() => { const R = window.__R, { live, p } = R, c = live.fun.peeks[1]; R.put(c.x - 2.5, 11, c.z - 1.5); /* a cell's middle beside the post */ p.lookAt({ x: c.x + 0.5, y: 14.3, z: c.z + 0.5 }); live.step(0.05); live.step(0.4); });
      await frames(page, 3); await shot(page, 't49-maze-critter.png');
      // the Joust (owner 2026-10-28: the target must be obvious): just after Charge!, just before the meeting, and the callout after it
      await page.evaluate(() => { const R = window.__R, { g, live, p } = R; g.beaten = g.beaten.filter(k => !/lance/.test(k)); R.put(66.5, 11, 32.5); live.use(p); live.charge(); window.__lanceB = R.Bots.JOUST_BOTS.skilled(); for (let i = 0; i < 9; i++) live.step(1 / 30, { lance: { ...window.__lanceB(live.jr), du: 0, dv: 0 } }); });
      await frames(page, 3); await shot(page, 't49-joust-start.png');
      await page.evaluate(() => { const R = window.__R, { live } = R; for (let i = 0; i < 71; i++) live.step(1 / 30, { lance: { ...window.__lanceB(live.jr), du: 0, dv: 0 } }); });
      await frames(page, 3); await shot(page, 't49-joust.png');
      await page.evaluate(() => { const R = window.__R, { live } = R; for (let i = 0; i < 25 && !live.lastMeet; i++) live.step(1 / 30, { lance: { ...window.__lanceB(live.jr), du: 0, dv: 0 } }); live.step(1 / 30, { lance: { su: 0, sv: 0 } }); });
      await frames(page, 3); await shot(page, 't49-joust-meet.png');
      await page.evaluate(() => { const R = window.__R, { g, live, p } = R; live.giveBack(); const b = g.world.bosses[0]; R.put(b.rest[0], b.rest[1], b.rest[2] + 3); p.lookAt({ x: b.pos[0], y: b.pos[1] + 1.4, z: b.pos[2] }); live.step(0.05); });
      await frames(page, 3); await shot(page, 't49-throne.png');
    }
  }

  await page.context().close(); // (one game at a time: the software renderer is slow)

  /* ---------------------------------------------------------------- E. iPad */
  if (want('ipad')) {
    const ip = await retry(() => openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] }));
    await newGame(ip, 0);
    await ip.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });
    await intoCastle(ip);
    await arm(ip);
    const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    await ip.evaluate(() => { const R = window.__R, s = R.S.SIEGE.stones[0]; R.put(s[0], s[1], s[2]); R.live.step(0.03); });
    await frames(ip, 2);
    const w1 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    await ip.tap('#btn-act');
    await waitFor(ip, () => window.__R.live.running(), null, 30000);
    await frames(ip, 2);
    const I1 = await ip.evaluate(() => {
      const R = window.__R, { g, live, p, S } = R, s = S.SIEGE.stones[0], out = { act: document.getElementById('btn-act')?.textContent.trim(), jump: document.getElementById('btn-jump')?.textContent.trim() };
      // the joystick points the shield: push it toward spot 3 (east of you)
      p.yaw = 0; g.touch.joy = { x: 1, y: 0 }; p.joy = g.touch.joy; p.update(1 / 30); live.step(1 / 30);
      out.ang = live.shieldIn.ang; out.want = S.dirTo(s, 3);
      g.touch.joy = null; p.joy = null;
      out.pointers = !!document.getElementById('pointers');
      return out;
    });
    t.ok(w1 === 'Shield!' && I1.act === 'Stop' && I1.jump === 'Shield' && Math.abs(Math.atan2(Math.sin(I1.ang - I1.want), Math.cos(I1.ang - I1.want))) < 0.15, `iPad: Shield! / Stop on the big button, the Jump button says Shield, the joystick points the shield (east: ${I1.ang.toFixed(2)} vs ${I1.want.toFixed(2)})`);
    await ip.evaluate(() => { const R = window.__R; R.live.giveBack(); R.live.winUpTo(3, 0); R.put(64.5, 11, 34.5); R.p.lookAt({ x: 64.5, y: 10.5, z: 44 }); R.live.step(0.03); });
    await frames(ip, 2);
    const w2 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    await ip.tap('#btn-act');
    await waitFor(ip, () => window.__R.live.mounted, null, 30000).catch(() => console.log(`  (not mounted: the button said ${w2})`));
    await frames(ip, 2);
    const I2 = await ip.evaluate(() => {
      const R = window.__R, { g, live, p } = R, out = { act: document.getElementById('btn-act')?.textContent.trim(), jump: document.getElementById('btn-jump')?.textContent.trim() };
      live.charge();
      const tip0 = live.jr.tip.slice();
      g.touch.joy = { x: 0, y: -1 }; p.joy = g.touch.joy; // push up
      for (let i = 0; i < 10; i++) { p.update(1 / 30); live.step(1 / 30); }
      g.touch.joy = null; p.joy = null;
      p.look(40, 0); live.step(1 / 30); // a drag nudges the tip sideways
      out.up = live.jr.tip[1] - tip0[1]; out.side = live.jr.tip[0];
      return out;
    });
    t.ok(w2 === 'Mount!' && I2.act === 'Charge!' && I2.jump === 'Off' && I2.up > 0.2 && Math.abs(I2.side) > 0.1, `iPad: Mount! / Charge! on the big button, Jump says Off; the joystick lifts the lance tip (${I2.up.toFixed(2)}), a drag nudges it (${I2.side.toFixed(2)})`);
    const after = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    t.ok(after === before, `no touch button came or went (${before})`);
    await shot(ip, 't49-ipad.png').catch(() => {});
    t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
    await ip.context().close();
  }

  /* ---------------------------------------------------------------- F. Two browsers: the gates are shared */
  if (want('pair')) {
    const [A, Bp] = await retry(() => openPair(browser, base));
    await newGame(A, 0); await pause(A);
    await newGame(Bp, 1); await pause(Bp);
    await A.fill('#mp input[placeholder="Your name"]', 'Dad');
    await click(A, '#mp button:has-text("Share my world")');
    await A.waitForTimeout(500);
    const code = (await A.textContent('.mp-code')).trim();
    await Bp.fill('#mp input[placeholder="Your name"]', 'Kid');
    await Bp.fill('#mp .mp-code-input', code);
    await click(Bp, '#mp button:has-text("Join a world")');
    await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000); console.log('  pair: Kid joined');
    for (const P of [A, Bp]) await P.evaluate(() => { window.pokecraft.champion = true; });
    await A.evaluate(() => window.pokecraft.realms.enter('swirl', { back: window.pokecraft.world.portal.stand }));
    await placeIs(A, 'swirl');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'swirl');
    const cell = await A.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'castle'), p = g.player; p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 }); return f.cloth[Math.floor(f.cloth.length / 2)]; });
    await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(A, 'castle');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'castle'); console.log('  pair: both in the Castle');
    await arm(A); await arm(Bp);
    // the Kid (a guest) wins Shield Up! on stone 2 while Dad stands on stone 1: the drawbridge comes down for both
    const k1 = await Bp.evaluate(() => { const R = window.__R, { live, p, S } = R, s = S.SIEGE.stones[1]; R.put(s[0], s[1], s[2]); live.use(p); const a = R.siege('skilled'); live.use(p); const b = R.siege('skilled'); live.use(p); const c = R.siege('skilled'); live.step(0.3); return { won: [a.won, b.won, c.won], deck: live.L.deck.every(x => R.g.world.get(...x) === R.B.PLANKS) }; });
    await waitFor(A, () => window.pokecraft.castleGates.shared().bridge, null, 30000).catch(() => {});
    const a1 = await A.evaluate(() => { const R = window.__R, { g, live } = R; live.step(0.3); return { shared: g.castleGates.shared(), deck: live.L.deck.every(x => g.world.get(...x) === R.B.PLANKS), own: R.CL.castleState(g).shield, keys: g.beaten.filter(k => /pw:castle/.test(k)) }; });
    t.ok(k1.won.every(Boolean) && k1.deck && a1.shared.bridge && a1.deck && a1.own === 0 && !a1.keys.length, `the Kid lowers the drawbridge: it is down for Dad too (the host keeps the gates); Dad's own saved keys say he has not won it (${JSON.stringify(a1.keys)})`);
    // the friend's avatar on the stone and on a horse
    await Bp.evaluate(() => { const R = window.__R; R.live.giveBack(); R.put(66.5, 11, 32.5); R.live.use(R.p); window.pokecraft.mp.sendState(); });
    await A.waitForTimeout(1500);
    const a2 = await A.evaluate(() => { const o = [...window.pokecraft.mp.others.values()][0]; return { here: o?.here, ride: o?.rideSpecies }; });
    t.ok(a2.here && a2.ride === 'gallantrot', `Dad sees the Kid on a horse in the Tilt Yard (${a2.ride})`);
    // Dad (the host) wins the Joust: the portcullis rises for the Kid too
    await A.evaluate(() => { const R = window.__R; R.live.winUpTo(0, 3); R.live.step(0.3); });
    await waitFor(Bp, () => window.pokecraft.castleGates.shared().port, null, 30000).catch(() => {});
    const k2 = await Bp.evaluate(() => { const R = window.__R, { g, live } = R; live.step(0.3); return { port: live.L.port.every(x => g.world.get(...x) === R.B.AIR), own: R.CL.castleState(g).lance }; });
    t.ok(k2.port && k2.own === 0, `Dad wins the Joust: the portcullis is up for the Kid too, whose own keys stay at 🐴 ${k2.own} / 3`);
    // the Kid goes home and joins again: as a new guest it asks and gets the gates as they are now
    await Bp.evaluate(() => { const g = window.pokecraft; g.realms.leave?.('quiet', { home: true }); });
    await Bp.waitForTimeout(2500);
    await pause(Bp);
    await Bp.evaluate(() => { document.getElementById('pause')?.classList.remove('hidden'); [...document.querySelectorAll('#mp button')].find(b => /Go back to my world/.test(b.textContent))?.click(); });
    await Bp.waitForTimeout(3000); // (going home reloads the page)
    await Bp.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
    await continueGame(Bp); await pause(Bp);
    const off = await Bp.evaluate(() => ({ ...window.pokecraft.castleGates.shared(), active: window.pokecraft.mp.active }));
    await waitFor(Bp, () => !!document.querySelector('#mp .mp-code-input'), null, 30000);
    await Bp.fill('#mp .mp-code-input', code);
    await click(Bp, '#mp button:has-text("Join a world")');
    await waitFor(Bp, () => window.pokecraft.mp.role === 'guest', null, 60000);
    await waitFor(Bp, () => window.pokecraft.castleGates.shared().bridge, null, 30000).catch(() => {});
    const k3 = await Bp.evaluate(() => window.pokecraft.castleGates.shared());
    t.ok(!off.bridge && !off.active && k3.bridge && k3.port, `the Kid leaves (nothing shared at home: ${JSON.stringify(off)}) and joins again: the host sends the gates as they are (${JSON.stringify(k3)})`);
    t.ok(!A.errors.length && !Bp.errors.length, `no page errors in the pair ${A.errors.concat(Bp.errors).slice(0, 3).join('; ')}`);
    await A.context().close(); await Bp.context().close();
  }

  /* ---------------------------------------------------------------- G. Closed without ?preview */
  if (want('closed')) {
    const shut = await openGame(browser, base, { wave15: false });
    const c = await shut.evaluate(async () => { const PW = await import('/src/pictureworlds.js'), C = await import('/src/comingsoon.js'), pb = await import('/src/pictureboss.js'); const w = PW.pictureWorld('castle'); return { ready: w.ready, secret: w.secret, name: w.name, emoji: w.emoji, open: C.worldOpen('castle'), boss: pb.bossOf('castle').title }; });
    t.ok(!c.ready && c.secret && c.name === 'Secret World' && c.emoji === '❓' && !c.open && c.boss === 'Sir Clanksalot · Castle Boss', `without ?preview the Castle's frame is still the covered secret (${c.name} ${c.emoji}), nothing spoiled`);
    t.ok(!shut.errors.length, `no page errors when closed ${shut.errors.slice(0, 3).join(' | ')}`);
    await shut.context().close();
  }
}
