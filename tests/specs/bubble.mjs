// The Bubble type and the Bubble Well (plans/bubble-well.md). A: the Bubble type data (7 creatures, 4 own shapes with the soap film,
// moves, big moves, fx, sounds, the chart's new cells only, Captain Suds and his crew, the frame that was secret4); B: the well as terrain
// in Node (bubblecheck.mjs: nobody climbs without the wand, the bench only from in front of it, the plateau only by the narrow shaft, the
// lifts, the chimney, the vents, nobody stuck, block ids); C: the rules in Node with the model players of bubblebots.mjs at 60 and 20
// steps a second (bubbles, the ducklings, the Chimney Ride, the shields, the kind help); D: playing in a browser with the real Player
// (the climb, a fall back to the ledge, the ducklings, the ride, the shields, the crew, Captain Suds, a lost battle, the star and the
// keys cleared, a reload, a wild Bubble creature's bubble); E: an iPad; F: two browsers (each blows their own bubbles); H: real input
// (owner 2026-10-29: real keys and mouse moves through the game's own handlers and frame loop: hop onto a bubble, one blown under you
// mid-jump, up shaft 1; the iPad's buttons); G: closed without ?preview. BUBBLE_ONLY=data|land|rules|play|ipad|pair|real|closed|shots.
// Screenshots: tests/screenshots/bubble-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, waitFor as waitFor0, playBattle, continueGame } from '../helpers.mjs';
import * as Bu from '../../src/bubbles.js';
import * as BL from '../../src/bubbleland.js';
import { KIND_HELP } from '../../src/kindhelp.js';
import { analyze } from '../bubblecheck.mjs';
import { DUCK_BOTS, RIDE_BOTS, playDuck, playRide, shotFrom } from '../bubblebots.mjs';

const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const IDS = ['squeaklet', 'quackmiral', 'suddly', 'lathotter', 'hippip', 'bathemoth', 'fizzbomb'];
const ONLY = process.env.BUBBLE_ONLY || '';
const want = part => !ONLY || ONLY === part;
const waitFor = (page, fn, arg, timeout = 90000) => waitFor0(page, fn, arg, timeout);
const placeIs = (page, id) => waitFor(page, id => window.pokecraft.place === id && !window.pokecraft.realms.busy, id, 120000);
const frames = (page, n = 2) => page.evaluate(async n => {
  const g = window.pokecraft;
  for (let i = 0; i < n; i++) { const t0 = g.time; await new Promise(res => { const f = () => (g.time !== t0 ? res() : requestAnimationFrame(f)); f(); }); }
}, n);
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); }); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };
const retry = async (fn, n = 3) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= n - 1 || !/Timeout/.test(e.message)) throw e; console.log('  (the page was slow to start: trying again)'); } } };

// A Champion in the Bubble Well, through its frame in the Swirl.
async function intoWell(page) {
  await page.evaluate(() => { const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand }); });
  await placeIs(page, 'swirl');
  const cell = await page.evaluate(() => {
    const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'bubble'), p = g.player;
    p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.vel.set(0, 0, 0);
    p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 });
    return f.cloth[Math.floor(f.cloth.length / 2)];
  });
  await page.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
  await placeIs(page, 'bubble');
}
// The live part driven by hand (a manual clock), toasts collected, model players from bubblebots.mjs.
const arm = page => page.evaluate(async () => {
  const g = window.pokecraft, Bub = await import('/src/bubbles.js'), L = await import('/src/bubbleland.js'), Bots = await import('/tests/bubblebots.mjs'), { B } = await import('/src/blocks.js');
  const live = g.gymLive.of('part:bubble');
  live.manual = true; live.playing = () => true;
  window.__toasts = [];
  const f = g.ui.toast.bind(g.ui); g.ui.toast = (m, ...r) => { window.__toasts.push(m); return f(m, ...r); };
  const p = g.player;
  window.__R = {
    g, live, Bu: Bub, L, Bots, B, p,
    said: re => window.__toasts.some(m => new RegExp(re).test(m)),
    put(x, y, z, yaw = null) { live.giveBack(); p.carry = null; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.keys = {}; p.joy = null; p.onGround = false; if (yaw !== null) p.yaw = yaw; p.update(0.02); live.ledge = null; live.fromBubble = false; live.prevFeet = p.pos.y; },
    frame(dt = 1 / 60) { p.update(dt); live.step(dt); },
    run(s, dt = 1 / 60) { for (let i = 0; i < s / dt; i++) { p.update(dt); live.step(dt); } },
    // a whole climb with the real Player and the climber robot: 'done' | 'fail' | 'time'
    climb(name, opts = {}) {
      const c = Bots.CLIMB[name], tick = Bots.makeClimber(c.moves, opts);
      this.put(...c.start); this.run(0.3);
      live.field.refill();
      for (let i = 0; i < 60 * 30; i++) { const r = tick({ p, live, dt: 1 / 60 }); if (r === 'done' || r === 'fail') { p.keys = {}; this.run(0.6); return r; } this.frame(); }
      return 'time';
    },
    // a duckling home through the live part: the robot says where to stand and which way to puff; the big button does it
    duck(i, bot = 'skilled', s = 120) {
      const d = live.ducks[i], b = Bots.DUCK_BOTS[bot](i), y = L.MESA.top + 1;
      let t = 0, uses = 0;
      while (t < s && d.state !== 'home') {
        if (d.state === 'sleep') { const yaw = Math.atan2(-(d.x - (d.x + 1)), -(0)); this.put(d.x + 1.2, y, d.z, Math.PI / 2); p.update(0.01); if (live.near(p) === 'Blow!') { live.use(p); uses++; } }
        const q = d.state === 'float' ? b(d, t) : null;
        if (q) { const l = Math.hypot(q.dx, q.dz), ux = q.dx / l, uz = q.dz / l; p.carry = null; p.pos.set(d.x - ux * q.dist, y, d.z - uz * q.dist); p.yaw = Math.atan2(-ux, -uz); p.pitch = -0.3; p.vel.set(0, 0, 0); if (live.near(p) === 'Puff!') { live.use(p); uses++; } }
        live.step(1 / 30); t += 1 / 30;
      }
      return { home: d.state === 'home', uses, t };
    },
    // the Chimney Ride through the live part, the robot taps (the big button) and steers
    ride(bot = 'skilled', s = 90) {
      const b = Bots.RIDE_BOTS[bot]();
      let t = 0;
      while (t < s && live.ride) { const r = live.ride, q = b(r); if (q.tap) live.use(p); live.step(1 / 30, { ride: { sx: q.sx, sz: q.sz } }); p.update(1 / 30); t += 1 / 30; }
      return { t, done: !live.ride };
    },
    // a bubble blown into vent k from the right spot (or another): the player stands 1.6 back and blows
    vent(k, how = 'right') {
      const e = Bots.VENT_TRIES[how](k), v = L.VENTS[k], a = Math.atan2(e.z - v.z, e.x - v.x), bx = e.x + Math.cos(a) * 1.6, bz = e.z + Math.sin(a) * 1.6;
      this.put(bx, L.RIM.y + 1, bz); this.run(0.2);
      p.lookAt({ x: e.x, y: L.RIM.y + 1 + 1.62, z: e.z });
      live.field.refill();
      const n = live.shots.length, ok = live.use(p);
      for (let i = 0; i < 60 * 5 && (live.shots.length || i < 3); i++) live.step(1 / 60);
      return { ok, captured: live.shots.length > n || live.info().state.shield[k] || live.ventMiss[k] > 0 };
    },
    boss: () => g.npcs.list.find(n => n.kind === 'boss' && n.def?.id === 'bubble'),
    crew: i => g.npcs.list.find(n => n.kind === 'crew' && n.def?.boss === 'bubble' && n.def.index === i),
    bee: () => g.npcs.list.find(n => n.kind === 'guest' && n.name === 'Bubble Bee'),
  };
  return true;
});

export default async function ({ browser, base, t }) {
  fs.mkdirSync(SHOTS, { recursive: true });

  /* ---------------------------------------------------------------- B. The well as terrain (Node) */
  if (want('land')) {
    for (const seed of [1, 2, 3]) {
      const t0 = Date.now(), r = analyze(seed);
      t.ok(!r.problems.length, `seed ${seed}: without the wand nobody leaves the floor (up to y ${r.info.walkTop}), the bench only from in front of it, the plateau only by the narrow shaft (the fizzy breeze blows bubbles off the cliff elsewhere), the fizz lifts, the chimney to the rim, the vents, Captain Suds, both ways back, nobody stuck (${r.info.reach} places), the garden clear, ${r.info.nooks} nooks, ids ${r.info.ids.filter(i => i > 100)} (${Date.now() - t0} ms) ${r.problems.join('; ')}`);
    }
  }

  /* ---------------------------------------------------------------- C. The rules (Node) */
  if (want('rules')) {
    // the bubbles you blow
    const f = new Bu.BubbleField(), eye = { x: 10.5, y: 6.6, z: 10.5 }, fwd = { x: 0, y: 0, z: -1 };
    const r1 = f.blow(eye, fwd), r2 = f.blow(eye, { x: 1, y: 0, z: 0 }), r3 = f.blow(eye, { x: -1, y: 0, z: 0 });
    t.ok(r1.ok && Math.abs(r1.b.z - (10.5 - Bu.BUBBLE.ahead)) < 1e-9 && Math.abs(r1.b.y - 6.6) < 1e-9 && r3.popped === r1.b && f.list.length === 2 && f.soap === 3, `Blow! puts a bubble ${Bu.BUBBLE.ahead} in front of your eyes; at most two (a third pops the oldest); each costs one of the six puffs of soap`);
    const empty = new Bu.BubbleField(); empty.soap = 0;
    t.ok(!empty.blow(eye, fwd).ok && empty.blow(eye, fwd).why === 'soap' && !new Bu.BubbleField().blow(eye, fwd, (x, y, z) => z === 8).ok && empty.refill() && empty.soap === 6, 'no soap, no bubble (a soap flower fills the wand); never a bubble inside a wall');
    // timings at 60 and 20 frames a second: a free bubble rises and pops when old; one you stand on sinks and pops after its time
    const times = fps => {
      const g = new Bu.BubbleField(), out = [];
      g.blow(eye, fwd); const b2 = g.blow({ x: 20.5, y: 6.6, z: 10.5 }, fwd).b; g.standOn(b2);
      let t2 = 0; while (t2 < 6) { for (const e of g.step(1 / fps)) out.push(`${e.type}:${e.why ?? ''}@${(Math.round(t2 * 120) / 120).toFixed(3)}`); t2 += 1 / fps; }
      return out;
    };
    const a60 = times(60), a20 = times(20);
    t.ok(a60.join() === 'warn:@1.400,pop:stood@2.000,pop:old@4.000', `a bubble you stand on wobbles at 1.4 s and pops at 2 s; a free one pops when 4 s old (${a60})`);
    t.ok(a60.map(x => x.split('@')[0]).join() === a20.map(x => x.split('@')[0]).join() && a60.every((x, i) => Math.abs(parseFloat(x.split('@')[1]) - parseFloat(a20[i].split('@')[1])) <= 0.05 + 1e-9), `the same pops at 60 and 20 frames a second (${a60} / ${a20})`);
    const g3 = new Bu.BubbleField(); const b3 = g3.blow(eye, fwd).b; const y3 = []; for (let i = 0; i < 120 * 2; i++) { g3.step(1 / 120); if (i === 119) y3.push(b3.y); }
    y3.push(b3.y);
    t.ok(Math.abs(y3[0] - (6.6 + Bu.BUBBLE.rise * (1 - Bu.BUBBLE.hang))) < 0.01 && Math.abs(y3[1] - y3[0] - Bu.BUBBLE.rise) < 1e-6, `a free bubble waits ${Bu.BUBBLE.hang} s where you blew it (time to hop on), then rises ${Bu.BUBBLE.rise} blocks a second (${(y3[0] - 6.6).toFixed(3)} after 1 s)`);
    // owner 2026-10-29 "I could never jump on a bubble": landing from above, from inside (blown under your feet mid-jump), a bubble blown at the floor sits on it
    const lb = { x: 0, y: 5, z: 0 }, top = 5 + Bu.BUBBLE.r;
    const L1 = [
      Bu.landsOn(lb, { x: 0.3, z: 0, feet: top - 0.05, prev: top + 0.2, vy: -3 }),   // down through its top
      Bu.landsOn(lb, { x: 0, z: 0, feet: 5.02, prev: 5.02, vy: 0 }),                  // blown right under your feet at the top of a jump
      Bu.landsOn(lb, { x: 0, z: 0, feet: 4.9, prev: 4.7, vy: 3 }),                    // hopped up into it
      !Bu.landsOn(lb, { x: 0, z: 0, feet: 4.6, prev: 4.5, vy: 3 }),                   // below its middle: not yet
      !Bu.landsOn(lb, { x: 1.0, z: 0, feet: 5.2, prev: 5.2, vy: 0 }),                 // beside it
      !Bu.landsOn(lb, { x: 0, z: 0, feet: top + 0.4, prev: top + 0.5, vy: -1 }),     // still above it
    ];
    const fl = new Bu.BubbleField(), floor = (x, y, z) => y < 5, fb = fl.blow({ x: 0.5, y: 6.62, z: 0.5 }, { x: 0, y: -1, z: 0 }, floor);
    const hop = Bu.hopHeight({ ground: true }), fe = Bu.BUBBLE;
    t.ok(L1.every(Boolean) && fb.ok && fb.b.y - fe.r >= 5 && fb.b.y - fe.r < 5.15 && fb.b.y - fe.scoop <= 5 + hop && 1.62 - fe.scoop > hop, `you land on a bubble from above, from inside its top half (blown under you mid-jump, or hopped up into), never from beside or below its middle; one blown at your feet sits on the floor (bottom ${(fb.b.y - fe.r - 5).toFixed(2)} up) and a hop (${hop.toFixed(2)}) reaches it; one blown straight ahead stays out of a hop's reach (${L1.map(Number).join('')})`);
    const drip = BL.DRIPS[0], g4 = new Bu.BubbleField(); g4.blow({ x: drip.x, y: 14 + 1.0, z: drip.z + Bu.BUBBLE.ahead }, fwd);
    let dpop = null; for (let i = 0; i < 600 && !dpop; i++) for (const e of g4.step(1 / 60, { drips: [drip] })) if (e.type === 'pop') dpop = e.why;
    t.ok(dpop === 'drip', `a drip pops a bubble under its spout (${dpop})`);
    const g5 = new Bu.BubbleField(); const b5 = g5.blow({ x: 10.5, y: 6.6, z: 10.5 }, fwd).b; for (let i = 0; i < 60; i++) g5.step(1 / 60, { vents: [{ x0: 0, x1: 20, y0: 0, y1: 20, z0: 0, z1: 20, vx: -1, vy: 0, vz: 0 }] });
    t.ok(Math.abs(b5.x - 9.5) < 1e-6, 'a vent\'s wind carries a bubble');
    // the ducklings, model players at 60 and 20 steps a second
    for (const fps of [60, 20]) {
      const sk = [0, 1, 2].map(i => playDuck(DUCK_BOTS.skilled(i), { i, fps })), skH = [0, 1, 2].map(i => playDuck(DUCK_BOTS.skilled(i), { i, fps, hard: true }));
      const push = [0, 1, 2].map(i => playDuck(DUCK_BOTS.pusher(i), { i, fps, help: 6 })), str = [1, 2].map(i => playDuck(DUCK_BOTS.straight(i), { i, fps, help: 6 }));
      t.ok(sk.every(r => r.won && !r.pops) && skH.every(r => r.won), `the ducklings @${fps}: a player who reads them gets all three home without a pop (${sk.map(r => `${r.puffs} puffs ${r.time.toFixed(0)} s`).join(', ')}), also in a rematch`);
      t.ok(push[0].won && !push[1].won && !push[2].won && !str.some(r => r.won), `the ducklings @${fps}: big puffs straight at the nest only work for the first; across the current and through the thorns they never do, not even with the kind help (${push.map(r => `${r.won ? 'home' : 'no'} ${r.pops} pops`).join(', ')}; little straight puffs ${str.map(r => `${r.won ? 'home' : 'no'} ${r.pops} pops`).join(', ')})`);
    }
    // the Chimney Ride
    for (const fps of [60, 20]) {
      const sk = playRide(RIDE_BOTS.skilled(), { fps }), skH = playRide(RIDE_BOTS.skilled(), { fps, hard: true });
      const still = playRide(RIDE_BOTS.still(), { fps, help: 6 }), spam = playRide(RIDE_BOTS.spammer(), { fps, help: 6 });
      t.ok(sk.won && sk.pops === 0 && skH.won, `the Chimney Ride @${fps}: a rider who hovers under each gap, goes up through it and waits for the arm gets to the top (${sk.time.toFixed(0)} s, ${sk.pops} pops; rematch ${skH.won})`);
      t.ok(!still.won && still.stars === 0 && !spam.won && spam.pops > 10, `the Chimney Ride @${fps}: never tapping never rises, tapping all the time without steering always pops on the first plate (${spam.pops} pops), even with the kind help`);
    }
    const r0 = new Bu.Ride(BL.CHIMNEY); for (let i = 0; i < 120; i++) r0.step(1 / 60);
    t.ok(r0.resting() && Math.abs(r0.y - (BL.CHIMNEY.floor + Bu.RIDE.R)) < 1e-9, 'the ride bubble always sinks and rests on the chimney floor');
    // the shields
    const right = [0, 1, 2].map(k => shotFrom(k, 'right').hit), south = [0, 1, 2].map(k => shotFrom(k, 'south').hit), mid = [0, 1, 2].map(k => shotFrom(k, 'middle').hit);
    t.ok(right.every(Boolean) && south.join() === 'false,true,false' && mid.every(h => !h), `the shields: from the right side of each vent the bubble curls round onto the shield (${right}); blowing from the throne's side works only for the middle vent (${south}); the vents' middles never (${mid})`);
    const s0 = shotFrom(0, 'right'), p0 = s0.path(0), p1 = s0.path(s0.time);
    t.ok(p1.y > p0.y + 2 && Math.hypot(p1.x - BL.SHIELD.x, p1.z - BL.SHIELD.z) < Math.hypot(p0.x - BL.SHIELD.x, p0.z - BL.SHIELD.z), 'a shot rises in the vent and flies to the shield');
    // the kind help: only kindHelp, every lever within KIND_HELP.max
    const lev = m => {
      const fld = new Bu.BubbleField({ help: m }), f0 = new Bu.BubbleField(), dk = new Bu.Duckling(BL.GARDEN_RULES, BL.ISLANDS[1], { help: m }), d0 = new Bu.Duckling(BL.GARDEN_RULES, BL.ISLANDS[1]);
      const rd = new Bu.Ride(BL.CHIMNEY, { help: m }), r00 = new Bu.Ride(BL.CHIMNEY);
      const sh = Bu.shieldShot(BL.VENTS[0], BL.VENT_SPOTS[0], BL.SHIELD, { help: m }), sh0 = Bu.shieldShot(BL.VENTS[0], BL.VENT_SPOTS[0], BL.SHIELD);
      return [fld.life / f0.life - 1, fld.standLife / f0.standLife - 1, 1 - fld.drip / f0.drip, 1 - dk.current / d0.current, dk.friction / d0.friction - 1, dk.nestR / d0.nestR - 1, 1 - rd.sink / r00.sink, rd.gap / r00.gap - 1, 1 - rd.barSpeed / r00.barSpeed, sh.catchR / sh0.catchR - 1];
    };
    const e0 = lev(0), e2 = lev(2), e6 = lev(6), e20 = lev(20);
    t.ok(e0.every(x => Math.abs(x) < 1e-12) && e2.every(x => x > 0) && e20.every(x => x <= KIND_HELP.max + 1e-12) && e6.every((x, i) => x >= e2[i]), `the kind help (kindhelp.js only): nothing at first, a little from 2 misses, never more than ${KIND_HELP.max * 100} % (${e20.map(x => (x * 100).toFixed(0)).join('/')} %)`);
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
      const all = Object.entries(Sp.SPECIES), mine = all.filter(([, s]) => s.type === 'bubble').map(([id]) => id);
      out.mine = mine.slice().sort();
      out.shapes = [...new Set(mine.map(id => Sp.SPECIES[id].model.shape))].sort();
      out.ownShapes = out.shapes.every(sh => all.every(([, s]) => s.model.shape !== sh || s.type === 'bubble'));
      out.evolve = ['squeaklet', 'suddly', 'hippip'].map(id => `${id}>${Sp.SPECIES[id].evolve?.into}@${Sp.SPECIES[id].evolve?.level}`);
      out.single = !Sp.SPECIES.fizzbomb.evolve;
      const names = all.map(([, s]) => s.name.toLowerCase());
      for (const id of ids) {
        const s = Sp.SPECIES[id];
        if (!s) { bad(id, 'missing'); continue; }
        if (names.filter(n => n === s.name.toLowerCase()).length !== 1) bad(id, 'name is not unique');
        if (!s.desc || s.desc.length > 125) bad(id, `desc is ${s.desc?.length} characters`);
        if (s.gait !== 'float') bad(id, 'no float gait');
        if (!Sp.makeCreature(id, 20).moves.some(m => Sp.MOVES[m].type === 'bubble')) bad(id, 'no bubble move at Lv 20');
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
          const gear = []; m.traverse(o => { if (o.userData.gear === 'film') gear.push(o); });
          if (gear.length !== 1) bad(id, `${gear.length} soap film meshes (one merged mesh per model)`);
          Sp.disposeModel(m);
        } catch (e) { bad(id, `model failed: ${e.message}`); }
      }
      const Mv = Sp.MOVES, m7 = ['soapbop', 'foamcrash', 'quickfizz', 'fizzup', 'duckfleet', 'bathtubwave', 'soapjuggle'], m3 = ['bubblebath', 'fizzfest', 'lastbubble'];
      out.moves = [...m7, ...m3].map(id => Mv[id]?.type);
      out.fine = Mv.quickfizz.priority === 1 && Mv.fizzup.fx?.kind === 'raise' && Mv.soapbop.power === 40 && Mv.foamcrash.power === 85;
      out.sig = ['duckfleet', 'bathtubwave', 'soapjuggle'].every(id => Mv[id].sig) && [['quackmiral', 'duckfleet'], ['bathemoth', 'bathtubwave'], ['lathotter', 'soapjuggle']].every(([s, mv]) => Sp.SPECIES[s].learn.some(([l, m]) => l === 30 && m === mv));
      out.big = m3.map(id => [Mv[id].fx.kind, !!Mv[id].big]);
      const types = Object.keys(Sp.TYPE_COLORS), olds = Object.keys(old);
      out.types = types.length;
      out.ownRow = types.filter(x => Sp.effectiveness('bubble', x) !== 1).map(x => `${x}:${Sp.effectiveness('bubble', x)}`).sort().join();
      out.vs = types.filter(x => x !== 'bubble' && Sp.effectiveness(x, 'bubble') !== 1).map(x => `${x}:${Sp.effectiveness(x, 'bubble')}`).sort().join();
      out.oldChart = olds.every(a => olds.every(d => Sp.effectiveness(a, d) === (old[a][d] ?? 1)));
      const weak = d => types.filter(a => Sp.effectiveness(a, d) > 1).length;
      out.weak = ['bubble', 'fire', 'toxic', 'tiny'].filter(d => weak(d) > 5).join();
      out.color = Sp.TYPE_COLORS.bubble;
      out.wool = [Bk.WOOL.bubble, Bk.BLOCKS[Bk.WOOL.bubble]?.name, Bk.PLACEABLE.includes(Bk.WOOL.bubble)];
      out.blocks = [['FOAM', 147], ['FIZZ_WALL', 148]].map(([k, n]) => [Bk.B[k] === n, Bk.BLOCKS[n]?.name, !!Bk.BLOCKS[n]?.fixed, !!Bk.BLOCKS[n]?.wallText, Bk.PLACEABLE.includes(n), Bk.isSolid(n), ['top', 'side', 'bottom'].every(f => Bk.BLOCKS[n][f] < Bk.TILE_COUNT)].join());
      out.fxOwn = R.TRAVEL.bubble !== R.TRAVEL.normal && R.IMPACT.bubble !== R.IMPACT.normal && !!R.FX_COLORS.bubble && ['duckfleet', 'bathtubwave', 'soapjuggle'].every(id => typeof R.SIG[id] === 'function');
      const sounds = ['fx:bubble', 'wandblow', 'soappop', 'bubbleland', 'soapfill', 'duckpuff', 'duckhome', 'chimneypuff', 'fizzstar', 'shieldburst', 'fizzlift'];
      out.sounds = sounds.map(n => g.sound.has(n));
      try { for (const n of sounds) g.sound.play(n); out.played = true; } catch (e) { out.played = e.message; }
      out.soundClash = [...m7, ...m3].filter(id => g.sound.has(id));
      const spawns = RL.REALMS.bubble.spawns;
      out.realm = [...new Set(spawns.bubble.map(e => e[0]))].sort().join();
      out.rare = spawns.bubble.filter(e => e[3] === 'bubble').map(e => e[0]).sort().join();
      out.cond = [SR.CONDITIONS.bubbly?.text, SR.AFTER_TEXT.bubble];
      out.rideable = Tr.TRAITS.rideable.species.bathemoth;
      out.levels = [RL.REALMS.bubble.levelBonus, RL.REALMS.bubble.levelCap, RL.REALMS.bubble.parent, RL.REALMS.bubble.lose];
      const boss = Pb.bossOf('bubble');
      out.boss = { name: boss.name, title: boss.title, top: Math.max(...boss.team.map(x => x[1])), n: boss.team.length, type: boss.type, model: boss.model?.species, crew: boss.crew.map(c => c.name).join(), gate: typeof boss.gate, notes: !!boss.note && !!boss.lose && !!boss.win && !!boss.rematchIntro };
      out.bossMoves = boss.team.filter(x => x[2]).every(([id, lv, mv]) => JSON.stringify(Sp.movesWith(id, lv, ...mv).slice().sort()) === JSON.stringify(mv.slice().sort()));
      const pw = PW.pictureWorld('bubble');
      out.frame = { ready: pw?.ready, realm: pw?.realm, name: pw?.name, idx: PW.PICTURE_WORLDS.findIndex(w => w.id === 'bubble'), frame: pw?.frame?.map(c => c.toString(16)).join(), secret4: !!PW.pictureWorld('secret4'), stars: PW.loadStars(['bubble', 'secret4', 'fair']).join() };
      return out;
    }, IDS);
    t.ok(JSON.stringify(A.mine) === JSON.stringify([...IDS].sort()) && A.evolve.join() === 'squeaklet>quackmiral@24,suddly>lathotter@26,hippip>bathemoth@25' && A.single, `seven Bubble species, three families and Fizzbomb (${A.evolve})`);
    t.ok(A.shapes.join() === 'bathbomb,bathotter,rubberduck,tubhippo' && A.ownShapes, `four own Bubble shapes (${A.shapes}), used by no other type`);
    t.ok(!A.problems.length, `all seven pass the data and model checks (one soap film mesh each, size, animation, the float gait, only in the Bubble Well) ${A.problems.join('; ')}`);
    t.ok(A.moves.every(m => m === 'bubble') && A.fine && A.sig && JSON.stringify(A.big) === JSON.stringify([['shield', true], ['field', true], ['lastword', true]]), 'the moves: Soap Bop, Foam Crash, Quick Fizz (first), Fizz Up (speed up), the signatures Duck Fleet, Bathtub Wave and Soap Juggle at 30, the big moves Bubble Bath, Fizz Fest, Last Bubble');
    t.ok(A.ownRow === 'bubble:0.5,fire:2,grass:0.5,metal:0.5,tiny:2,toxic:2' && A.vs === 'electric:2,fire:0.5,metal:2,pirate:2,water:0.5' && A.oldChart && !A.weak, `the chart: its own row (${A.ownRow}), the cells against it (${A.vs}); the old chart unchanged; no defender too weak (${A.weak || 'none'})`);
    t.ok(/gradient/.test(A.color) && A.wool.join() === '255,Bubble Wool,false' && A.blocks.join(' / ') === 'true,Soap Foam,true,true,false,true,true / true,Fizzy Wall,true,true,false,true,true', `a type colour, the bubble wool 255 and Soap Foam 147 / Fizzy Wall 148 (fixed, a wall text, not placeable): the only new block ids (${A.wool} / ${A.blocks.join(' / ')})`);
    t.ok(A.fxOwn && A.sounds.every(Boolean) && A.played === true && !A.soundClash.length, 'bubble effects, colours, the three signature effects and the well\'s sounds exist and play; no move is named like a sound');
    t.ok(A.realm === [...IDS].sort().join() && A.rare === 'bathemoth,fizzbomb,lathotter,quackmiral' && A.cond[0] === 'floating in a bubble in the Bubble Well' && !!A.cond[1], `all seven live only in the Bubble Well, floating in bubbles; the big ones only after the stairs ("${A.cond[1]}")`);
    t.ok(A.rideable === 'water' && A.levels.join() === '33,45,swirl,stay', `Bathemoth can be ridden (water); a Picture World of the Swirl (${A.levels})`);
    t.ok(A.boss.name === 'Captain Suds' && A.boss.title === 'Captain Suds · Bubble Well Boss' && A.boss.top === 63 && A.boss.n === 4 && A.boss.type === 'bubble' && A.boss.model === 'lathotter' && A.boss.crew === 'Wanda Wand,Duckherd Daisy,Mate Fizz' && A.boss.gate === 'function' && A.boss.notes && A.bossMoves, `Captain Suds: a giant Lathotter, top level 63, four creatures, a gate, three crew (${JSON.stringify(A.boss)})`);
    t.ok(A.frame.ready && A.frame.realm === 'bubble' && A.frame.name === 'Bubble Well' && A.frame.idx === 10 && A.frame.frame === 'a0c8f8,f8e0f0' && !A.frame.secret4 && A.frame.stars === 'fair,bubble', `the frame that was secret4 is the Bubble Well (same place ${A.frame.idx}, same colours), ready with ?preview; an old secret4 in a save is dropped (${A.frame.stars})`);
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
    fs.writeFileSync(path.join(SHOTS, 'bubble-creatures.png'), Buffer.from(shots.split(',')[1], 'base64')); console.log('  screenshot bubble-creatures.png');
    if (ONLY === 'data') return;
  }

  /* ---------------------------------------------------------------- D. Playing the Bubble Well */
  if (want('play') || want('shots')) {
    await intoWell(page);
    await arm(page);
    const D0 = await page.evaluate(() => {
      const R = window.__R, { g, live, p } = R;
      R.run(0.1);
      const aim = live.aim(p.pos)?.text('↑', 20);
      return { place: g.place, parts: g.world.parts.map(x => x.id).join(), aim, st: R.L.bubbleState(g), bee: !!R.bee(), boss: !!R.boss(), crew: [0, 1, 2].map(i => R.crew(i)?.name).join(), chip: document.getElementById('score-chip')?.textContent, word: live.near(p), lifts: live.info().lifts, wand: R.said('bubble wand'), keep: g.world.keeps.some(k => k.name === 'well'), edit: g.world.editAllowed?.(80, 5, 120, R.B.STONE) };
    });
    t.ok(D0.place === 'bubble' && D0.parts === 'bubble' && D0.bee && D0.boss && D0.crew === 'Wanda Wand,Duckherd Daisy,Mate Fizz' && D0.wand, `the Bubble Well frame opens the well; Bubble Bee lends you a wand; Captain Suds and his crew are there (${D0.crew})`);
    t.ok(D0.word === 'Blow!' && /Bubble Stairs/.test(D0.aim) && /Stairs ○ · 🦆 0 \/ 3/.test(D0.chip) && D0.lifts.join() === 'false,false' && D0.keep && D0.edit === false, `the big button says Blow!, the guide leads to the Bubble Stairs ("${D0.aim}"), the chip ${D0.chip}; the lifts are off; nobody builds in the well`);
    if (want('play')) {
      // the climb with the real Player: a straight-ahead blower never gets up; the robot that looks down a little climbs both shafts
      const C1 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, out = {};
        out.straight = R.climb('shaft1', { straight: true }); out.straightY = p.pos.y;
        out.s1 = R.climb('shaft1'); out.y1 = p.pos.y; out.z1 = p.pos.z; out.bench = live.ledge?.y;
        out.landed = R.said('You are on a bubble');
        // a step off a bubble over the edge of the bench: back on the bench, never down to the floor
        R.put(110.5, 11, 69.5, Math.PI); R.run(0.3); live.field.refill();
        p.pitch = -0.8; live.use(p); const b = live.field.list[live.field.list.length - 1];
        p.keys = { Space: true, KeyW: true }; for (let i = 0; i < 90 && live.stood !== b; i++) { R.frame(); p.keys.Space = false; }
        out.onIt = live.stood === b;
        p.keys = { KeyS: false }; for (let i = 0; i < 60 * 4 && (p.carry || !p.onGround || p.pos.y < 6); i++) { p.joy = { x: 0, y: -1 }; R.frame(); }
        p.joy = null; R.run(0.5);
        out.back = { y: p.pos.y, said: R.said('Back on the ledge'), miss: live.stairMiss.slice() };
        out.s2 = R.climb('shaft2'); out.y2 = p.pos.y;
        out.st = R.L.bubbleState(g); out.lifts = live.info().lifts; out.stairsSaid = R.said('climbed the Bubble Stairs');
        return out;
      });
      t.ok(C1.straight !== 'done' && C1.straightY < 6, `blowing straight ahead (no looking down) never gets you up: the bubble is too high to hop on (${C1.straight}, y ${C1.straightY.toFixed(1)})`);
      t.ok(C1.s1 === 'done' && Math.abs(C1.y1 - 11) < 0.05 && C1.landed, `shaft 1: blow, hop on, blow, bounce: three bubbles and a bounce up onto the bench (y ${C1.y1.toFixed(2)})`);
      t.ok(C1.onIt && Math.abs(C1.back.y - 11) < 0.05 && C1.back.said, `walking off a bubble over the bench's edge puts you back on the bench (y ${C1.back.y.toFixed(2)}), never down on the floor`);
      t.ok(C1.s2 === 'done' && C1.y2 > 18.9 && C1.st.stairs && C1.stairsSaid && C1.lifts[0] === true, `shaft 2: four bubbles up the narrow shaft (the drips and the side wind) and a bounce onto the plateau: the Bubble Stairs are done and the first fizz lift runs (${C1.s2}, y ${C1.y2.toFixed(1)})`);
      // a reload keeps the stairs
      await page.evaluate(() => window.pokecraft.save());
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page);
      await placeIs(page, 'bubble'); await arm(page);
      const D2 = await page.evaluate(() => { const R = window.__R, { g, live } = R; R.run(0.1); return { st: R.L.bubbleState(g), place: g.place, lift: live.info().lifts[0], inLifts: g.world.lifts.length }; });
      t.ok(D2.place === 'bubble' && D2.st.stairs && D2.lift && D2.inLifts === 1, `a reload keeps the stairs (and the lift runs: ${D2.inLifts}) and you are still in the well`);
      // the fizz lift carries you from the floor to the plateau with the real Player
      const L1 = await page.evaluate(() => { const R = window.__R, { p } = R, l = R.L.LIFTS[0]; R.put(l.x[0] + 1, 5, l.z[0] + 1); for (let i = 0; i < 60 * 5 && p.pos.y < 19; i++) R.frame(); p.joy = { x: 0, y: -1 }; p.yaw = 0; for (let i = 0; i < 60 * 3 && !(p.onGround && p.pos.y > 18.9); i++) R.frame(); p.joy = null; return { y: p.pos.y }; });
      t.ok(L1.y > 18.9, `the fizz lift takes you up to the plateau (y ${L1.y.toFixed(1)})`);
      // the ducklings through the big button: Blow! round one, then Puff! from where the robot stands
      const D3 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, d = live.ducks[0], y = R.L.MESA.top + 1, out = {};
        R.put(d.x + 1.2, y, d.z, Math.PI / 2); out.word = live.near(p); live.use(p); out.state = d.state; out.puffWord = live.near(p);
        out.r = [0, 1, 2].map(i => R.duck(i));
        out.st = R.L.bubbleState(g); out.home = R.said('All the ducklings are home');
        return out;
      });
      t.ok(D3.word === 'Blow!' && D3.state === 'float' && D3.puffWord === 'Puff!', `by a sleeping duckling the big button says Blow! (a bubble closes round it), then Puff! (${D3.word} / ${D3.puffWord})`);
      t.ok(D3.r.every(r => r.home) && D3.st.ducks === 3 && D3.home, `all three ducklings floated home (${D3.r.map(r => `${r.uses} presses, ${r.t.toFixed(0)} s`).join('; ')})`);
      // the Chimney Ride: Ride!, the robot's taps on the big button, the top
      const D4 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, C = R.L.CHIMNEY, out = {};
        R.put(C.x + C.wall + 1.2, R.L.MESA.top + 1, C.z, Math.PI / 2); R.run(0.1);
        out.word = live.near(p); live.use(p); out.riding = p.carry === live.rideObj; out.jump = p.carry?.jumpWord?.(); out.puff = live.near(p);
        out.r = R.ride('skilled');
        out.st = R.L.bubbleState(g); out.y = p.pos.y; out.lifts = live.info().lifts; out.said = R.said('Up the chimney');
        return out;
      });
      t.ok(D4.word === 'Ride!' && D4.riding && D4.jump === 'Puff' && D4.puff === 'Puff!', `by the chimney the big button says Ride!, then Puff! (Jump says Puff)`);
      t.ok(D4.r.done && D4.st.chimney && D4.y > 41.9 && D4.lifts[1] && D4.said, `the Chimney Ride to the top in ${D4.r.t.toFixed(0)} s: on the rim, the chimney done, the second fizz lift runs`);
      // the shields: from the wrong side the bubble flies past (a miss, never a fail), from the right side each vent pops a shield
      const D5 = await page.evaluate(() => {
        const R = window.__R, { g, live } = R, out = {};
        out.wrong = R.vent(0, 'south'); out.missed = live.ventMiss[0] === 1 && !R.L.bubbleState(g).shield[0] && R.said('flew past');
        out.right = [0, 1, 2].map(k => R.vent(k, 'right'));
        out.st = R.L.bubbleState(g); out.all = R.said('All three shields popped');
        return out;
      });
      t.ok(D5.wrong.captured && D5.missed, 'a bubble blown into a vent from the wrong side flies past the shield (a miss to try again)');
      t.ok(D5.right.every(r => r.ok) && D5.st.shields === 3 && D5.st.ready && D5.all, `from the right side every vent pops a shield: 🛡️ ${D5.st.shields} / 3`);
      // Captain Suds: his crew first, a lost battle stays on the rim, the star clears the climb's keys
      const B1 = await page.evaluate(async () => {
        const R = window.__R, { g } = R, Sp = await import('/src/species.js'), out = {};
        g.beaten = g.beaten.filter(k => !/pw:bubble:crew/.test(k));
        g.talkTo(R.boss()); out.crewFirst = !g.inBattle && R.said('Beat Wanda Wand.*Mate Fizz first');
        g.party = [Sp.makeCreature('thunderwolf', 100)];
        g.talkTo(R.crew(0));
        return out;
      });
      t.ok(B1.crewFirst, 'Captain Suds waits until his crew are beaten');
      t.ok(await playBattle(page), "Wanda Wand's battle is won");
      await page.evaluate(() => { const R = window.__R; R.g.talkTo(R.crew(1)); });
      t.ok(await playBattle(page), "Duckherd Daisy's battle is won");
      await page.evaluate(() => { const R = window.__R; R.g.talkTo(R.crew(2)); });
      t.ok(await playBattle(page), "Mate Fizz's battle is won");
      await page.evaluate(async () => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('fluffin', 2)]; const b = R.boss(); g.player.pos.set(b.pos.x, b.pos.y, b.pos.z + 2.5); g.talkTo(b); });
      t.ok(await playBattle(page), 'a weak team loses the Boss battle');
      const L2 = await page.evaluate(() => { const g = window.pokecraft, p = g.player.pos, b = g.world.bosses[0]; return { place: g.place, d: Math.hypot(p.x - b.rest[0], p.z - b.rest[2]), star: g.stars.includes('bubble'), said: window.__R.said('A good try') }; });
      t.ok(L2.place === 'bubble' && L2.d < 2 && !L2.star && L2.said, `losing keeps you on the rim (${L2.d.toFixed(1)} from the rest spot)`);
      await page.evaluate(async () => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('thunderwolf', 100)]; g.talkTo(R.boss()); });
      t.ok(await playBattle(page), 'the Boss battle is won');
      const W1 = await page.evaluate(() => { const R = window.__R, { g, live } = R; live.step(0.3); const st = R.L.bubbleState(g); return { star: g.stars.includes('bubble'), keys: g.beaten.filter(k => /pw:bubble:(stairs|duck|chimney|shield)/.test(k)).length, crew: g.beaten.filter(k => /pw:bubble:crew/.test(k)).length, lifts: live.info().lifts, ducks: live.ducks.map(d => d.state).join(), note: R.said('bath-time friends'), gate: R.L.bubbleState(g).ready }; });
      t.ok(W1.star && W1.keys === 0 && W1.crew === 3 && W1.lifts.join() === 'true,true' && W1.ducks === 'sleep,sleep,sleep' && W1.note && !W1.gate, `the star and the Wizard's note; the climb's keys are cleared for a rematch (the crew stays beaten, the lifts keep running for a star holder, the ducklings asleep on their islands again)`);
      // a wild Bubble creature floats in its bubble; the battle pops it
      const S1 = await page.evaluate(() => {
        const g = window.pokecraft, n = g.world.nooks[0];
        g.creatures.clear();
        const w = g.creatures.spawnAt('squeaklet', n.x + 0.5, n.y, n.z + 0.5, { level: 5 });
        for (let i = 0; i < 10; i++) g.creatures.updateOne(w, 0.1);
        const up = w.model.position.y - w.pos.y, bubbled = w.bubbled && !!w.bubble;
        const was = w.reveal();
        return { up, bubbled, was, after: !w.bubbled && !w.bubble && Math.abs(w.model.position.y - w.pos.y) < 1e-6 };
      });
      t.ok(S1.bubbled && S1.up > 0.4 && S1.was === null && S1.after, `a wild Squeaklet floats ${S1.up.toFixed(2)} up inside its own bubble; the battle pops it and it drops to the ground`);
      t.ok(!page.errors.length, `no page errors ${page.errors.slice(0, 3).join(' | ')}`);
    }
    if (want('shots') || !ONLY) {
      await page.evaluate(() => { const R = window.__R, { p, live } = R; R.put(80.5, 5, 131.5); p.lookAt({ x: 80.5, y: 16, z: 70 }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-arrival.png');
      await page.evaluate(() => { const R = window.__R, { p, live } = R; R.put(104.5, 5, 76.5, 0); R.run(0.2); live.field.refill(); p.pitch = -0.8; live.use(p); p.keys = { Space: true, KeyW: true }; const b = live.field.list.at(-1); for (let i = 0; i < 90 && live.stood !== b; i++) { R.frame(); p.keys.Space = false; } p.keys = {}; p.yaw = 0; p.pitch = -0.36; live.use(p); R.run(0.15); p.yaw = 0.35; p.pitch = 0.15; live.step(0.01); });
      await frames(page, 3); await shot(page, 'bubble-stairs.png');
      await page.evaluate(() => { const R = window.__R, { p, live } = R, d = live.ducks[1]; live.giveBack(); for (const x of live.ducks) x.backHome(); live.ducks[0].blow(); R.put(76.5, 19, 58.5); p.lookAt({ x: 80.5, y: 19.5, z: 46 }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-garden.png');
      await page.evaluate(() => { const R = window.__R, { p, live } = R, C = R.L.CHIMNEY; R.put(C.x + C.wall + 1.2, 19, C.z, Math.PI / 2); live.startRide(); const b = R.Bots.RIDE_BOTS.skilled(); for (let i = 0; i < 60 * 4; i++) { const q = b(live.ride); if (q.tap) live.puff(); live.step(1 / 60, { ride: { sx: q.sx, sz: q.sz } }); p.update(1 / 60); } p.pitch = 0.9; });
      await frames(page, 3); await shot(page, 'bubble-chimney.png');
      await page.evaluate(() => { const R = window.__R, { g, p, live } = R; live.giveBack(); g.beaten = g.beaten.filter(k => !/shield/.test(k)); R.put(80.5, 42, 35.5); p.lookAt({ x: 80.5, y: 43.5, z: 25.5 }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-rim.png');
    }
  }

  await page.context().close(); // (one game at a time: the software renderer is slow)

  /* ---------------------------------------------------------------- E. iPad */
  if (want('ipad')) {
    const ip = await retry(() => openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] }));
    await newGame(ip, 0);
    await ip.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });
    await intoWell(ip);
    await arm(ip);
    const before = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    await ip.evaluate(() => { const R = window.__R; R.put(104.5, 5, 76.5, 0); R.p.pitch = -0.8; R.live.step(0.03); });
    await frames(ip, 2);
    const w1 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    const n0 = await ip.evaluate(() => window.__R.live.field.n);
    await ip.tap('#btn-act');
    await waitFor(ip, n0 => window.__R.live.field.n > n0, n0, 30000);
    // a tap on the screen blows a bubble where you tap
    const I1 = await ip.evaluate(() => { const R = window.__R, { g, live } = R, n = live.field.n; const cam = g.camera; const ok = g.gymLive.tap(cam.position.clone(), R.p.forward.clone()); return { ok, more: live.field.n > n }; });
    t.ok(w1 === 'Blow!' && I1.ok && I1.more, `iPad: Blow! on the big button blows a bubble; a tap on the screen blows one where you tap (${w1})`);
    // on a bubble the Jump button says Bounce; in the ride it says Puff and a tap on the screen puffs
    const I2 = await ip.evaluate(() => {
      const R = window.__R, { g, live, p } = R, out = {};
      const b = live.field.list.at(-1); live.land(b); live.step(0.02); out.carry = p.carry === live.standObj;
      return out;
    });
    await frames(ip, 2);
    const j1 = await ip.evaluate(() => document.getElementById('btn-jump')?.textContent.trim());
    await ip.evaluate(() => { const R = window.__R, C = R.L.CHIMNEY; R.put(C.x + C.wall + 1.2, 19, C.z, Math.PI / 2); R.live.step(0.03); });
    await frames(ip, 2);
    const w2 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    await ip.tap('#btn-act');
    await waitFor(ip, () => !!window.__R.live.ride, null, 30000);
    await frames(ip, 2);
    const I3 = await ip.evaluate(() => { const R = window.__R, { g, live } = R, y0 = live.ride.y; const ok = g.gymLive.tap(g.camera.position.clone(), R.p.forward.clone()); for (let i = 0; i < 12; i++) live.step(1 / 30); return { ok, up: live.ride.y - y0, jump: document.getElementById('btn-jump')?.textContent.trim(), act: document.getElementById('btn-act')?.textContent.trim() }; });
    t.ok(I2.carry && j1 === 'Bounce' && w2 === 'Ride!' && I3.ok && I3.up > 0.3 && I3.jump === 'Puff' && I3.act === 'Puff!', `iPad: on a bubble Jump says Bounce; Ride! on the big button; in the ride Jump says Puff and a tap on the screen puffs you up (${I3.up.toFixed(2)})`);
    const after = await ip.evaluate(() => document.querySelectorAll('#touch button, #touch .tbtn').length);
    t.ok(after === before, `no touch button came or went (${before})`);
    await shot(ip, 'bubble-ipad.png').catch(() => {});
    t.ok(!ip.errors.length, `no page errors (iPad) ${ip.errors.join('; ')}`);
    await ip.context().close();
  }

  /* ---------------------------------------------------------------- F. Two browsers: each blows their own bubbles */
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
    const cell = await A.evaluate(() => { const g = window.pokecraft, f = g.world.swirl.frames.find(f => f.world === 'bubble'), p = g.player; p.pos.set(f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5); p.lookAt({ x: f.spot.x + 0.5, y: f.spot.y + 3.5, z: f.spot.z + 0.5 }); return f.cloth[Math.floor(f.cloth.length / 2)]; });
    await A.evaluate(c => { const g = window.pokecraft; g.portal.use({ x: c[0], y: c[1], z: c[2], id: g.world.get(...c) }); }, cell);
    await placeIs(A, 'bubble');
    await waitFor(Bp, () => window.pokecraft.ui.asking, null, 60000);
    await Bp.evaluate(() => window.pokecraft.ui.askYes());
    await placeIs(Bp, 'bubble'); console.log('  pair: both in the Bubble Well');
    await arm(A); await arm(Bp);
    const k1 = await Bp.evaluate(() => { const R = window.__R, { live, p } = R; R.put(104.5, 5, 76.5, 0); R.run(0.2); p.pitch = -0.8; live.use(p); live.use(p); window.pokecraft.mp.sendState(); return { mine: live.field.list.length, sum: (() => { let s = 0; const d = R.g.world.data; for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0; return s; })() }; });
    await A.waitForTimeout(1500);
    const a1 = await A.evaluate(() => { const R = window.__R, { live } = R; live.step(0.1); const o = [...window.pokecraft.mp.others.values()][0]; return { mine: live.field.list.length, here: o?.here, sum: (() => { let s = 0; const d = R.g.world.data; for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0; return s; })() }; });
    t.ok(k1.mine === 2 && a1.mine === 0 && a1.here && a1.sum === k1.sum, `two players: the Kid blows two bubbles, Dad has none of them (bubbles are each player's own, never blocks or messages); the well's blocks are the same for both; Dad sees the Kid in the well`);
    t.ok(!A.errors.length && !Bp.errors.length, `no page errors in the pair ${A.errors.concat(Bp.errors).slice(0, 3).join('; ')}`);
    await A.context().close(); await Bp.context().close();
  }

  /* ---------------------------------------------------------------- H. Real input (owner 2026-10-29: "I could never jump on a bubble") */
  // Like a child plays: real key presses (E, W, Space) and mouse moves through the game's own handlers, the game's own frame loop and
  // clock (no manual live part, no direct carry, no robot); only the spot you start on is set. The mouse capture is faked (headless
  // Chromium never grants it), so the game's own pointerlockchange handler runs as when a player clicks into the game.
  if (want('real')) {
    const fakeLock = () => {
      Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get() { return window.__lock ? document.getElementById('game') : null; } });
      const change = on => { window.__lock = on; setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0); };
      HTMLCanvasElement.prototype.requestPointerLock = function () { change(true); return Promise.resolve(); };
      Document.prototype.exitPointerLock = function () { change(false); };
    };
    // the game clock: summed frame dt of the live part (waits are in game seconds, whatever the frame rate)
    const clockOn = pg => pg.evaluate(() => {
      const g = window.pokecraft, gl = g.gymLive, up = gl.update.bind(gl);
      window.__T = 0; gl.update = dt => { up(dt); window.__T += dt; };
    });
    const waitT = (pg, s) => pg.evaluate(s => new Promise(r => { const t0 = window.__T, w0 = Date.now(); const f = () => (window.__T - t0 >= s || Date.now() - w0 > 120000 ? r() : requestAnimationFrame(f)); f(); }), s);
    const live = pg => pg.evaluate(() => { const g = window.pokecraft, l = g.gymLive.of('part:bubble'), p = g.player; return { stood: l.stood?.id ?? null, on: p.carry === l.standObj, y: p.pos.y, ground: p.onGround, n: l.field.n, ring: l.aimRing.visible && l.aimRing.userData.parts.ring.material.color.getHex() }; });
    // the look, by mouse moves through the game's mousemove handler (yaw, pitch in radians)
    const look = (pg, yaw, pitch) => pg.evaluate(([yaw, pitch]) => {
      const p = window.pokecraft.player, k = 0.0022, w = a => Math.atan2(Math.sin(a), Math.cos(a));
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: -w(yaw - p.yaw) / k, movementY: -(pitch - p.pitch) / k }));
      return { yaw: p.yaw, pitch: p.pitch };
    }, [yaw, pitch]);
    const start = (pg, at) => pg.evaluate(at => { // the spot (and a fresh wand); nothing else is touched
      const g = window.pokecraft, p = g.player, l = g.gymLive.of('part:bubble');
      l.giveBack(); for (const b of [...l.field.list]) l.field.pop(b); l.field.refill();
      p.pos.set(...at); p.vel.set(0, 0, 0); l.ledge = null; l.fromBubble = false;
    }, at);
    const key = async (pg, k, s = 0) => { await pg.keyboard.down(k); if (s) await waitT(pg, s); await pg.keyboard.up(k); };
    const page = await retry(() => openGame(browser, base, { setup: ctx => ctx.addInitScript(fakeLock) }));
    await newGame(page, 0);
    await page.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; });
    await intoWell(page);
    await page.evaluate(() => document.getElementById('game').requestPointerLock());
    await waitFor(page, () => !!document.pointerLockElement && window.pokecraft.started && document.getElementById('pause').classList.contains('hidden'), null, 20000);
    await clockOn(page);
    const S1 = [104.5, 5, 76.5], hop = async (pitch, delay, name) => {
      await start(page, S1); await look(page, 0, pitch); await waitT(page, 0.3);
      const ring = (await live(page)).ring;
      await key(page, 'KeyE');
      if (delay) await waitT(page, delay);
      await page.keyboard.down('KeyW'); await key(page, 'Space', 0.12); await waitT(page, 0.45); await page.keyboard.up('KeyW');
      await waitT(page, 0.4);
      const r = await live(page);
      return { name, on: r.on && r.stood !== null, y: r.y, ring };
    };
    const H1 = [await hop(-0.5, 0.15, 'look down a little'), await hop(-0.8, 0.5, 'look down more, hop a moment later'), await hop(-1.2, 0.3, 'look at the floor')];
    t.ok(H1.every(h => h.on && h.ring === 0x7dffa0), `real keys: look down a little (or a lot), press E for Blow!, hold W and Space: you land on your bubble every time; the aim ring is green first (${H1.map(h => `${h.name}: ${h.on ? 'on it' : 'missed'} y ${h.y.toFixed(2)}`).join('; ')})`);
    // jump first, then look down and Blow! under your feet: it catches you
    await start(page, S1); await look(page, 0, 0); await waitT(page, 0.3);
    await key(page, 'Space', 0.1); await waitT(page, 0.12); await look(page, 0, -1.5); await key(page, 'KeyE'); await waitT(page, 0.5);
    const H2 = await live(page);
    t.ok(H2.on && H2.y > 5.4, `real keys: jump, look down, press E: the bubble catches you under your feet (y ${H2.y.toFixed(2)})`);
    // straight ahead at the top of a hop: too high, the ring says so (white) and a word says what to do
    await start(page, S1); await look(page, 0, 0); await waitT(page, 0.3);
    const H3 = await live(page);
    await page.evaluate(() => { window.__said = []; const ui = window.pokecraft.ui, f = ui.toast.bind(ui); ui.toast = (m, ...r) => { window.__said.push(m); return f(m, ...r); }; });
    await key(page, 'KeyE'); await waitT(page, 0.1);
    const said = await page.evaluate(() => window.__said.join(' | '));
    t.ok(H3.ring === 0xffffff && /Look down a little/.test(said), `straight ahead from the ground the ring is white (too high to hop on) and Blow! says "${said}"`);
    // up shaft 1 with real keys: three bubbles (Bounce off each) and a hop onto the bench
    await start(page, S1); await waitT(page, 0.3);
    const steps = [];
    for (const [yaw, pitch] of [[0, -0.6], [0, -0.2], [0, -0.2]]) { // (from a bubble: just a little down)
      await look(page, yaw, pitch); await waitT(page, 0.05);
      const n0 = (await live(page)).n;
      await key(page, 'KeyE');
      await page.keyboard.down('KeyW'); await key(page, 'Space', 0.1); await waitT(page, 0.3); await page.keyboard.up('KeyW');
      await waitFor(page, () => { const g = window.pokecraft, l = g.gymLive.of('part:bubble'); return (g.player.carry === l.standObj && l.stood) || g.player.onGround; }, null, 60000);
      const r = await live(page); steps.push(r.on && r.stood > n0 ? 'on' : `missed@${r.y.toFixed(1)}`);
      if (!r.on) break;
      await waitT(page, 0.1);
    }
    await look(page, 0, 0); await waitT(page, 0.1);
    await page.keyboard.down('KeyW'); await key(page, 'Space', 0.1); await waitT(page, 0.6); await page.keyboard.up('KeyW'); await waitT(page, 0.3);
    const H4 = await live(page);
    t.ok(steps.join() === 'on,on,on' && H4.ground && Math.abs(H4.y - 11) < 0.05, `real keys up shaft 1: blow, hop on, blow, Bounce, blow, Bounce, hop onto the bench (${steps.join()}, y ${H4.y.toFixed(2)})`);
    await start(page, S1); await waitT(page, 0.2);
    await look(page, 0, -0.6); await waitT(page, 0.2); await key(page, 'KeyE');
    await page.keyboard.down('KeyW'); await key(page, 'Space', 0.1); await waitT(page, 0.3); await page.keyboard.up('KeyW'); await waitT(page, 0.2);
    const onIt = await live(page);
    await look(page, Math.PI * 0.8, -1.05); await waitT(page, 0.05); // looking back down at the bubble you stand on
    await shot(page, 'bubble-on-a-bubble.png');
    t.ok(onIt.on, `standing on a bubble for the screenshot (y ${onIt.y.toFixed(2)})`);
    t.ok(!page.errors.length, `no page errors (real keys) ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
    // the iPad: hold Jump, look down, tap Blow! on the big button: you land on the bubble
    const ip = await retry(() => openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] }));
    await newGame(ip, 0);
    await ip.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; document.getElementById('pause')?.classList.add('hidden'); });
    await intoWell(ip);
    await clockOn(ip);
    const press = (pg, id, down) => pg.evaluate(([id, down]) => { const el = document.getElementById(id), r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent(down ? 'pointerdown' : 'pointerup', { pointerId: 7, pointerType: 'touch', bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); }, [id, down]);
    await start(ip, S1); await ip.evaluate(() => { const p = window.pokecraft.player; p.yaw = 0; p.pitch = 0; }); await waitT(ip, 0.3);
    await press(ip, 'btn-jump', true); await waitT(ip, 0.12); await press(ip, 'btn-jump', false); await waitT(ip, 0.1);
    await ip.evaluate(() => window.pokecraft.player.look(0, 1.5 / 0.0022)); await waitT(ip, 0.03);
    const word = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    await ip.tap('#btn-act'); await waitT(ip, 0.5);
    const I1 = await live(ip);
    t.ok(word === 'Blow!' && I1.on, `iPad: Jump, look down, tap Blow! on the big button: the bubble catches you (${word}, y ${I1.y.toFixed(2)})`);
    t.ok(!ip.errors.length, `no page errors (iPad, real taps) ${ip.errors.slice(0, 3).join(' | ')}`);
    await ip.context().close();
  }

  /* ---------------------------------------------------------------- G. Closed without ?preview (it ships closed) */
  if (want('closed')) {
    const shut = await openGame(browser, base, { wave15: false });
    const c = await shut.evaluate(async () => { const PW = await import('/src/pictureworlds.js'), C = await import('/src/comingsoon.js'), pb = await import('/src/pictureboss.js'), sl = await import('/src/swirlland.js'); const w = PW.pictureWorld('bubble'); return { ready: w.ready, secret: w.secret, name: w.name, emoji: w.emoji, open: C.worldOpen('bubble'), later: C.LATER.includes('bubble'), boss: pb.bossOf('bubble').title, castle: C.worldOpen('castle') }; });
    t.ok(!c.ready && c.secret && c.name === 'Secret World' && c.emoji === '❓' && !c.open && c.later && c.boss === 'Captain Suds · Bubble Well Boss' && c.castle, `without ?preview the Bubble Well's frame is still the covered secret (${c.name} ${c.emoji}): nothing spoiled, it cannot be entered; the Castle stays open`);
    // the closed frame says it is a secret and opens nothing
    await newGame(shut, 0); await pause(shut);
    const c2 = await shut.evaluate(async () => {
      const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand });
      for (let i = 0; i < 600 && (g.place !== 'swirl' || g.realms.busy); i++) await new Promise(r => setTimeout(r, 100));
      const f = g.world.swirl.frames.find(f => f.world === 'bubble'), cell = f.cloth[Math.floor(f.cloth.length / 2)];
      const used = g.portal.use({ x: cell[0], y: cell[1], z: cell[2], id: g.world.get(...cell) });
      await new Promise(r => setTimeout(r, 1500));
      return { used, place: g.place, cloth: g.world.get(...cell) };
    });
    t.ok(c2.used && c2.place === 'swirl', `the covered frame in the Swirl only says it is a secret: you stay in the Swirl (${c2.place})`);
    t.ok(!shut.errors.length, `no page errors when closed ${shut.errors.slice(0, 3).join(' | ')}`);
    await shut.context().close();
    const pre = await openGame(browser, base, { wave15: false, query: '?preview' });
    const o = await pre.evaluate(async () => { const PW = await import('/src/pictureworlds.js'); const w = PW.pictureWorld('bubble'); return { ready: w.ready, name: w.name }; });
    t.ok(o.ready && o.name === 'Bubble Well', `?preview opens it (${o.name})`);
    await pre.context().close();
  }
}
