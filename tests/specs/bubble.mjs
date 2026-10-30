// The Bubble type and the Bubble Well (plans/bubble-well.md, its "Rework" and its "Redesign 2026-10-29 (natural rules)": every rule is one
// a child already expects from real bubbles and a real wand). A: the Bubble type data (7 creatures, 4 own shapes with the soap film,
// moves, big moves, fx, sounds, the chart's new cells only, Captain Suds and his crew, the frame that was secret4); B: the well as terrain
// in Node (bubblecheck.mjs: nobody climbs without the wand, every Fizz Ledge is needed (one bubble never lifts you 6), the lifts, the
// chimney and its stack, the low first shield in a jump's reach and the high ones out of it, nobody stuck, block ids); C: the rules in Node
// (a bubble out of the wand, rising, wobbling, popping; a puff of air; the ducklings and the Chimney Ride with the model players of
// bubblebots.mjs at 60 and 20 steps a second; a stomp and a boing; the kind help); K: kids with the real Player and BubbleLive in Node
// (bubblenode.mjs) at 60 and 20 fps, only keys and the big button: the climb leg by leg and the shields (skilled always, naive rarely, a
// pillar kid never, a first-time kid gets the first ledges and pops the low shield by jumping at it; walking into it only boings);
// D: playing in a browser (the pot, the climb, a fall back to the ledge, the ducklings, the ride and its clear view from inside, the bars
// of soap (never a star), Captain Suds sealed in his bubble, the shields, the crew, Captain Suds, a lost battle, the star and the keys
// cleared, a reload, a wild Bubble creature's bubble, for-fun replays); E: an iPad; F: two browsers (each blows their own bubbles); H: real input (real keys and mouse moves through the game's own
// handlers and frame loop: dip, blow, hop on, hop off onto the first ledge; the pillar trick fails; the iPad's buttons); R: the one-time
// reset of the redesign (worldreset.js) and ?preview's "Start this world over"; G: closed without ?preview.
// BUBBLE_ONLY=data|land|rules|kids|play|ipad|pair|real|reset|closed|shots. Screenshots: tests/screenshots/bubble-*.png.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { ROOT, openGame, openPair, newGame, pause, click, waitFor as waitFor0, playBattle, continueGame, seedSave } from '../helpers.mjs';
import * as Bu from '../../src/bubbles.js';
import * as BL from '../../src/bubbleland.js';
import { KIND_HELP } from '../../src/kindhelp.js';
import { analyze } from '../bubblecheck.mjs';
import { DUCK_BOTS, RIDE_BOTS, LEGS, RIM_LEG, makeKid, makeShieldKid, makeLowShieldKid, playDuck, playRide } from '../bubblebots.mjs';

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
const shot = async (page, name) => { await page.evaluate(() => { document.getElementById('pause')?.classList.add('hidden'); window.pokecraft.ui.toastBox?.replaceChildren(); document.getElementById('celebrate')?.remove(); }); await page.screenshot({ path: path.join(SHOTS, name), timeout: 180000 }); console.log(`  screenshot ${name}`); };
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
    put(x, y, z, yaw = null) { live.giveBack(); for (const b of [...live.field.list]) live.field.pop(b); p.carry = null; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.keys = {}; p.joy = null; p.onGround = false; if (yaw !== null) p.yaw = yaw; p.update(0.02); live.ledge = null; live.fromBubble = false; live.prevFeet = p.pos.y; live.wet = false; },
    frame(dt = 1 / 60) { p.update(dt); live.step(dt); },
    run(s, dt = 1 / 60) { for (let i = 0; i < s / dt; i++) { p.update(dt); live.step(dt); } },
    // a kid of bubblebots.mjs (only keys and the big button) with the real Player in the page: { done, t, top }
    kid(tick, { budget = 60, dt = 1 / 60 } = {}) {
      let t = 0, done = false, top = p.pos.y;
      while (t < budget) { const r = tick({ p, live, dt }); if (r) { done = r; break; } p.update(dt); live.step(dt); t += dt; if (p.onGround && !p.carry) top = Math.max(top, p.pos.y); }
      p.keys = {}; this.run(0.2, dt);
      return { done, t: +t.toFixed(1), top: +top.toFixed(1) };
    },
    climb(kind = 'skilled', from = 0, opts = {}) { const L0 = Bots.LEGS[from]; this.put(L0.pot[0], L0.from, L0.pot[2] + 1.5, 0); this.run(0.2); return this.kid(Bots.makeKid(kind, Bots.LEGS.slice(from), { seed: 1 }), opts); },
    // a duckling home through the live part: the robot says where to stand and which way to puff; the big button does it (a wet wand
    // from the garden's soap pot to bubble a sleeping one)
    duck(i, bot = 'skilled', s = 120) {
      const d = live.ducks[i], b = Bots.DUCK_BOTS[bot](i), y = L.MESA.top + 1;
      let t = 0, uses = 0;
      while (t < s && d.state !== 'home') {
        if (d.state === 'sleep') { this.put(d.x + 1.2, y, d.z, Math.PI / 2); p.update(0.01); live.wet = true; if (live.near(p) === 'Blow!') { live.use(p); uses++; } }
        const q = d.state === 'float' ? b(d, t) : null;
        if (q) { const l = Math.hypot(q.dx, q.dz), ux = q.dx / l, uz = q.dz / l; p.carry = null; p.pos.set(d.x - ux * q.dist, y, d.z - uz * q.dist); p.yaw = Math.atan2(-ux, -uz); p.pitch = -0.3; p.vel.set(0, 0, 0); if (live.near(p) === 'Puff!') { live.use(p); uses++; } }
        live.step(1 / 30); t += 1 / 30;
      }
      return { home: d.state === 'home', uses, t };
    },
    // the Chimney Ride through the live part, the robot taps (the big button) and steers
    ride(bot = 'skilled', s = 120) {
      const b = Bots.RIDE_BOTS[bot]();
      let t = 0;
      while (t < s && live.ride) { const r = live.ride, q = b(r); if (q.tap) live.use(p); live.step(1 / 30, { ride: { sx: q.sx, sz: q.sz } }); p.update(1 / 30); t += 1 / 30; }
      return { t, done: !live.ride };
    },
    // a shield popped by a skilled kid from its soap pot on the balcony
    shield(k, kind = 'skilled', budget = 60) { const pot = Bots.RIM_LEG.pots[k]; this.put(pot[0], pot[1], pot[2] + 1, 0); this.run(0.2); return this.kid(Bots.makeShieldKid(kind, k, { seed: 3 }), { budget }); },
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
      t.ok(!r.problems.length, `seed ${seed}: without the wand nobody leaves the floor (up to y ${r.info.walkTop}); one bubble lifts you at most ${r.info.up} (so every Fizz Ledge and its soap pot is needed); the plateau, the fizz lifts, the chimney to the rim, the shields out of a jump's reach, Captain Suds, both ways back, nobody stuck (${r.info.reach} places), the garden clear, ${r.info.nooks} nooks, ids ${r.info.ids.filter(i => i > 100)} (${Date.now() - t0} ms) ${r.problems.join('; ')}`);
    }
  }

  /* ---------------------------------------------------------------- C. The rules (Node) */
  if (want('rules')) {
    const B = Bu.BUBBLE, fwd = { x: 0, y: -0.9, z: -0.4 }; // (looking down: only the flat way you face counts)
    // a bubble comes out of the wand just in front of you (closer when something is in the way, none in a wall)
    const f = new Bu.BubbleField(), feet = { x: 10.5, y: 6, z: 10.5 };
    const r1 = f.blow(feet, fwd), r2 = f.blow(feet, { x: 1, y: 0, z: 0 }, (x, y, z) => x === 12);
    t.ok(r1.ok && Math.abs(r1.b.z - (10.5 - B.ahead)) < 1e-9 && Math.abs(r1.b.y - B.r - 6) < 0.05 && r2.ok && r2.b.x - 10.5 < B.ahead - 0.05 && !f.blow(feet, fwd, (x, y, z) => z === 9 || z === 8 || z === 10).ok,
      `a bubble comes out ${B.ahead} blocks in front of you (the flat way you face), sitting at your feet; closer when something is in the way; never inside a wall`);
    const times = fps => {
      const g = new Bu.BubbleField(), out = [];
      const b = g.blow({ x: 10.5, y: 6, z: 10.5 }, fwd).b, y0 = b.y;
      let t2 = 0, yAt = null; while (t2 < 6) { for (const e of g.step(1 / fps)) out.push(`${e.type}:${e.why ?? ''}@${(Math.round(t2 * 120) / 120).toFixed(2)}`); t2 += 1 / fps; if (yAt === null && t2 >= 1.6 - 1e-9) yAt = b.y - y0; }
      return { out, yAt };
    };
    const a60 = times(60), a20 = times(20);
    t.ok(/^warn:@2\.8\d?,pop:old@3\.6/.test(a60.out.join()) && a60.out.map(x => x.split('@')[0]).join() === a20.out.map(x => x.split('@')[0]).join() && Math.abs(a60.yAt - B.rise * (1.6 - B.hang)) < 0.03 && Math.abs(a60.yAt - a20.yAt) < 0.03,
      `a bubble waits ${B.hang} s, floats up ${B.rise} blocks a second, wobbles ${B.warn} s and pops ${B.life} s after you blew it, the same at 60 and 20 frames a second (${a60.out} / ${a20.out})`);
    const up = Bu.rideUp(), upHelp = Bu.rideUp(1 + KIND_HELP.max), gaps = [BL.FLOOR, ...BL.LEDGES.map(l => l.top), BL.MESA.top].map((y, i, a) => (i ? y - a[i - 1] : null)).slice(1);
    t.ok(upHelp < 6 && gaps.every(d => d <= Math.floor(up)) && gaps.some(d => d >= 5), `one bubble lifts your feet at most ${up.toFixed(2)} (${upHelp.toFixed(2)} with the most kind help): the ledges are ${gaps.join(', ')} up, so no ledge can be skipped and the last one needs a ride to the very end`);
    const top = 5 + B.r, lb = { x: 0, y: 5, z: 0 };
    const L1 = [Bu.landsOn(lb, { x: 0.3, z: 0, feet: top - 0.05, prev: top + 0.2, vy: -3 }), Bu.landsOn(lb, { x: 0, z: 0, feet: 5.4, prev: 5.3, vy: 2 }),
      !Bu.landsOn(lb, { x: 0, z: 0, feet: 5.0, prev: 4.9, vy: 2 }), !Bu.landsOn(lb, { x: 1.0, z: 0, feet: 5.4, prev: 5.4, vy: 0 }), !Bu.landsOn(lb, { x: 0, z: 0, feet: top + 0.4, prev: top + 0.5, vy: -1 })];
    t.ok(L1.every(Boolean), `you land on a bubble from above or by hopping up into its top part, never from its lower half or beside it (${L1.map(Number).join('')})`);
    const drip = BL.DRIPS[0], g4 = new Bu.BubbleField(); g4.blow({ x: drip.x, y: 13.5, z: drip.z + B.ahead }, { x: 0, y: 0, z: -1 });
    let dpop = null; for (let i = 0; i < 600 && !dpop; i++) for (const e of g4.step(1 / 60, { drips: [drip] })) if (e.type === 'pop') dpop = e.why;
    const gw = new Bu.BubbleField(); gw.clock = 3.8; const gb = gw.blow({ x: 115, y: 14, z: 70 }, { x: -1, y: 0, z: 0 }).b, gz = gb.z, gust = BL.WINDS.find(w => w.id === 'gust');
    for (let i = 0; i < 120 * gust.period; i++) gw.step(1 / 120, { winds: [gust] });
    const pf = new Bu.BubbleField(), pb = pf.blow({ x: 0.5, y: 5, z: 0.5 }, { x: 0, y: 0, z: -1 }).b, px = pb.z; pf.puff({ x: 0.5, y: 5, z: 1.0 }, { x: 0, z: -1 }); for (let i = 0; i < 60; i++) pf.step(1 / 60);
    t.ok(dpop === 'drip' && gb.z - gz > 1 && px - pb.z > 0.3, `a drip pops a bubble under its spout (${dpop}); a gust you can see carries a bubble off (${(gb.z - gz).toFixed(1)} blocks); a puff of air from a dry wand pushes a bubble (${(px - pb.z).toFixed(2)})`);
    // the ducklings, model players at 60 and 20 steps a second (each started at 8 moments of the gusty gap's beat)
    const phases = [0, 1, 2, 3, 4, 5, 6, 7].map(k => k * BL.GUSTS[0].period / 8);
    for (const fps of [60, 20]) {
      const sk = [0, 1, 2].map(i => phases.map(c => playDuck(DUCK_BOTS.skilled(i), { i, fps, clock: c, time: 60 }))), skH = [0, 1, 2].map(i => playDuck(DUCK_BOTS.skilled(i), { i, fps, hard: true, time: 60 }));
      t.ok(sk.every(l => l.every(r => r.won && !r.pops && !r.wakes)) && skH.every(r => r.won), `the ducklings @${fps}: a player who reads them gets all three home without a pop, at any moment of the gusts (${sk.map(l => `${Math.max(...l.map(r => r.time)).toFixed(0)} s`).join(', ')} at most), also in a rematch`);
      const push = [0, 1, 2].map(i => playDuck(DUCK_BOTS.pusher(i), { i, fps, help: 6 })), str = [1, 2].map(i => playDuck(DUCK_BOTS.straight(i), { i, fps, help: 6 }));
      t.ok(push[0].won && !push[1].won && !push[2].won && !str.some(r => r.won), `the ducklings @${fps}: big puffs straight at the nest only work for the first; across the stream and through the thorns they never do, not even with the kind help (${push.map(r => `${r.won ? 'home' : 'no'} ${r.pops} pops`).join(', ')})`);
      const ng = phases.map(c => playDuck(DUCK_BOTS.noGust(2), { i: 2, fps, clock: c, time: 120 })), tries = ng.reduce((a, r) => a + r.pops + (r.won ? 1 : 0), 0), wins = ng.filter(r => r.won).length;
      t.ok(wins / tries < 0.3, `the gusty gap @${fps}: a player who knows the way but ignores the gusts gets duckling 3 through only ${wins} times in ${tries} tries (${(100 * wins / tries).toFixed(0)} %)`);
    }
    const lazy = new Bu.Duckling(BL.GARDEN_RULES, BL.ISLANDS[0]); lazy.blow(0); const ev = []; for (let i = 0; i < 60 * 80; i++) ev.push(...lazy.step(1 / 60).map(e => e.type));
    t.ok(ev.includes('hurry') && ev.includes('wake') && ev.includes('asleep') && lazy.state === 'sleep' && lazy.x === BL.ISLANDS[0][0], `a duckling's bubble lasts ${Bu.DUCK.life} s: it wobbles thin, then the duckling wakes and waddles home to its island (${[...new Set(ev)].join(', ')})`);
    // the Chimney Ride (owner 2026-10-29: "it finishes in 10 seconds")
    for (const fps of [60, 20]) {
      const sk = playRide(RIDE_BOTS.skilled(), { fps }), skH = playRide(RIDE_BOTS.skilled(), { fps, hard: true });
      const still = playRide(RIDE_BOTS.still(), { fps, help: 6 }), spam = playRide(RIDE_BOTS.spammer(), { fps, help: 6 });
      t.ok(sk.won && sk.pops === 0 && sk.time > 33 && sk.time < 42 && skH.won, `the Chimney Ride @${fps}: a rider who hovers under each gold ring, goes up through it (the fourth and sixth turn) and waits for each arm gets to the top in ${sk.time.toFixed(0)} s with no pop (owner 2026-10-30: a bit longer, it was 24 s; the best robot, a child takes longer); rematch ${skH.won}`);
      t.ok(!still.won && still.stars === 0 && !spam.won && spam.stars === 1 && spam.pops > 10, `the Chimney Ride @${fps}: never tapping never rises; tapping all the time without steering gets through the first gold ring and always pops on the second (${spam.pops} pops)`);
    }
    const r0 = new Bu.Ride(BL.CHIMNEY); for (let i = 0; i < 120; i++) r0.step(1 / 60);
    t.ok(r0.resting() && Math.abs(r0.y - (BL.CHIMNEY.floor + Bu.RIDE.R)) < 1e-9 && BL.CHIMNEY.plates.length === 6 && BL.CHIMNEY.fans.length === 2 && Bu.barsOf(BL.CHIMNEY).length === 2 && BL.CHIMNEY.stars.length === 7, 'the ride bubble always sinks and rests on the chimney floor; six gold rings with a bar of soap over each, two fans, two arms (the second in the stack over the rim, turning the other way)');
    // a stomp: drop onto a shield bubble from above and it pops; from the side or below it only bumps you
    const c = { x: 0, y: 45, z: 0 }, R = 1.2;
    const st = [Bu.stomp(c, R, { x: 0.3, z: 0, feet: 46.15, prev: 46.3, vy: -4 }) === 'pop', !!Bu.stomp(c, R, { x: 1.3, z: 0, feet: 44.5, prev: 44.5, vy: 0 })?.bump,
      !!Bu.stomp(c, R, { x: 0, z: 0, feet: 42, prev: 42.1, vy: 3 })?.bump || Bu.stomp(c, R, { x: 0, z: 0, feet: 42, prev: 42.1, vy: 3 }) === null, Bu.stomp(c, R, { x: 0.2, z: 0, feet: 46.0, prev: 45.9, vy: 2 }) !== 'pop', Bu.stomp(c, R, { x: 4, z: 0, feet: 46, prev: 46.2, vy: -2 }) === null];
    t.ok(st.every(Boolean), `a shield bubble pops when you drop onto its top, never from the side or from below (${st.map(Number).join('')})`);
    // owner 2026-10-30: from the side or onto its shoulder it boings you away; still above its top it leaves you alone
    const bo = [Bu.stomp(c, R, { x: 1.0, z: 0, feet: c.y + Math.sqrt(R * R - 1) - 0.05, prev: c.y + Math.sqrt(R * R - 1) + 0.1, vy: -3 }), Bu.stomp(c, R, { x: 0.3, z: 0, feet: 46.9, prev: 47, vy: -1 }), Bu.stomp(c, R, { x: 1.45, z: 0, feet: 44.6, prev: 44.6, vy: 0 })];
    t.ok(bo[0]?.bump && bo[0].up && bo[1] === null && bo[2]?.bump && !bo[2].up && Bu.clearOf(c, R, 44.6) > 1.45, 'onto its shoulder or into its side it boings you away (out to where you stand clear); above its top nothing yet');
    // the kind help: only kindHelp, every lever within KIND_HELP.max
    const lev = m => {
      const fld = new Bu.BubbleField({ help: m }), f0 = new Bu.BubbleField(), dk = new Bu.Duckling(BL.GARDEN_RULES, BL.ISLANDS[1], { help: m }), d0 = new Bu.Duckling(BL.GARDEN_RULES, BL.ISLANDS[1]);
      const rd = new Bu.Ride(BL.CHIMNEY, { help: m }), r00 = new Bu.Ride(BL.CHIMNEY);
      return [fld.life / f0.life - 1, 1 - fld.drip / f0.drip, 1 - fld.wind / f0.wind, 1 - dk.current / d0.current, 1 - dk.gust / d0.gust, dk.friction / d0.friction - 1, dk.nestR / d0.nestR - 1, dk.life / d0.life - 1, 1 - rd.sink / r00.sink, rd.gap / r00.gap - 1, 1 - rd.barSpeed / r00.barSpeed, Bu.shieldSize(BL.SHIELDS[0], m) / BL.SHIELDS[0].r - 1, 1 - Bu.shieldSway(m)];
    };
    const e0 = lev(0), e2 = lev(2), e6 = lev(6), e20 = lev(20);
    t.ok(e0.every(x => Math.abs(x) < 1e-12) && e2.every(x => x > 0) && e20.every(x => x <= KIND_HELP.max + 1e-12) && e6.every((x, i) => x >= e2[i]), `the kind help (kindhelp.js only): nothing at first, a little from 2 misses, never more than ${KIND_HELP.max * 100} % (${e20.map(x => (x * 100).toFixed(0)).join('/')} %)`);
  }

  /* ---------------------------------------------------------------- K. Kids with the real Player in Node (keys and the big button only) */
  // Owner 2026-10-29: "Easy to understand, hard to master": a naive kid must fail (or rarely win), a skilled one must win, and the obvious
  // shortcut (the chapter-1 pillar: jump, look down, press) must never work. Each leg starts on its floor; a fall puts the kid back there.
  if (want('kids')) {
    const { bubbleEnv } = await import('../bubblenode.mjs');
    const env = await bubbleEnv(1);
    const leg = (kind, n, fps, s) => { const L = LEGS[n]; env.put(L.pot[0], L.from, L.pot[2], 0); env.live.stairMiss = [0, 0, 0, 0]; env.live.field.clock = s * 1.37; const n0 = env.live.field.n; const r = env.run(makeKid(kind, [L], { seed: s * 7 + n }), { budget: 25, dt: 1 / fps }); return { up: !!r.done, blows: env.live.field.n - n0 }; };
    const rate = (kind, n, fps, runs) => { let up = 0, blows = 0; for (let s = 1; s <= runs; s++) { const r = leg(kind, n, fps, s); up += r.up; blows += r.blows; } return { up, runs, blows, per: up / Math.max(1, blows) }; };
    const fmt = r => `${r.up}/${r.runs} in ${r.blows} bubbles`;
    for (const fps of [60, 20]) {
      const sk = LEGS.map((_, n) => rate('skilled', n, fps, 4));
      t.ok(sk.every(r => r.up === r.runs && r.blows === r.runs), `@${fps} a skilled kid (blows from the right corner, waits for a calm moment, leans its bubble, hops off in time) makes every leg with one bubble each time (${sk.map(fmt).join(', ')})`);
      env.put(LEGS[0].pot[0], LEGS[0].from, LEGS[0].pot[2] + 1.5, 0);
      const whole = env.run(makeKid('skilled', LEGS, { seed: 2 }), { budget: 90, dt: 1 / fps });
      t.ok(whole.done && env.game.beaten.includes(BL.stairsKey), `@${fps} the whole climb, floor to plateau, by a skilled kid in ${whole.t} s: the Fizz Ledges are done`);
      env.game.beaten = [];
      // owner 2026-10-30: "I did climb those ... did I complete it?" (the chip said "Ledges ○"). A kid who hops off its last bubble onto the
      // plateau's very edge (its middle still over the cliff: the old rule only counted a middle over the plateau) is counted now
      const edge = [1, 2, 3].map(s => { env.game.beaten = []; const L = LEGS[3]; env.put(L.pot[0] - 0.8, L.from, L.pot[2] - 0.3); const r = env.run(makeKid('nolean', [L], { seed: s }), { budget: 40, dt: 1 / fps }); return { up: !!r.done, z: +env.player.pos.z.toFixed(2), counted: env.game.beaten.includes(BL.stairsKey) }; });
      // the exact case: off a bubble from ledge 3 onto the plateau's lip, your middle past its end (z 67.2; the old rule wanted z < 67)
      env.game.beaten = []; env.put(114.5, BL.LEDGES[2].top + 1, 69.5); for (let i = 0; i < 6; i++) env.step(1 / fps);
      env.player.pos.set(114.5, BL.MESA.top + 1.6, BL.MESA.z1 + 1.2); env.player.vel.set(0, 0, 0); env.player.onGround = false; env.live.fromBubble = true;
      for (let i = 0; i < 2 * fps && !(env.player.onGround && !env.player.carry); i++) env.step(1 / fps);
      const lip = { y: env.player.pos.y, z: env.player.pos.z, counted: env.game.beaten.includes(BL.stairsKey) };
      t.ok(lip.counted && Math.abs(lip.y - (BL.MESA.top + 1)) < 0.05 && lip.z > BL.MESA.z1 + 1 && edge.every(r => r.up && r.counted), `@${fps} hopping off onto the plateau's very lip counts the climb (the owner's "climbed but not counted": standing at z ${lip.z.toFixed(2)}, past the plateau's last row, never counted before); kids who ride without leaning and hop onto the edge: all counted (feet at z ${edge.map(r => r.z).join(', ')})`);
      // by any route the first time (a lost battle's rest, a reload mid-ride); in a rematch (the star) only a bubble up from a ledge counts
      env.game.beaten = []; env.put(110.5, BL.MESA.top + 1, 60.5); for (let i = 0; i < 12; i++) env.step(1 / fps); const anyRoute = env.game.beaten.includes(BL.stairsKey);
      env.game.beaten = []; env.game.stars = ['bubble']; env.put(110.5, BL.MESA.top + 1, 60.5); for (let i = 0; i < 12; i++) env.step(1 / fps); const rematchWalk = env.game.beaten.includes(BL.stairsKey);
      const L4 = LEGS[3]; env.put(L4.pot[0] - 0.8, L4.from, L4.pot[2] - 0.3); const rem = env.run(makeKid('skilled', [L4], { seed: 1 }), { budget: 40, dt: 1 / fps }); const rematchClimb = !!rem.done && env.game.beaten.includes(BL.stairsKey);
      env.game.stars = [];
      // an old save that already has later progress but no climb key gets it once (never with the star: a rematch climbs again)
      env.game.beaten = [BL.duckKey(1), BL.chimneyKey]; env.live.sync(true); const oldSave = env.game.beaten.includes(BL.stairsKey);
      env.game.beaten = [BL.duckKey(1)]; env.game.stars = ['bubble']; env.live.sync(true); const oldStar = env.game.beaten.includes(BL.stairsKey); env.game.stars = [];
      t.ok(anyRoute && !rematchWalk && rematchClimb && oldSave && !oldStar, `@${fps} up on the plateau by any route counts the first time; in a rematch only a bubble up from a ledge does (a lift ride never); an old save with a duckling and the chimney but no climb key gets it once`);
      env.game.beaten = [];
      const first = [0, 1].map(n => rate('firsttime', n, fps, 3)), firstLate = [2, 3].map(n => rate('firsttime', n, fps, 3));
      t.ok(first.every(r => r.up === r.runs) && firstLate.every(r => r.per < 0.25), `@${fps} a first-time kid who only does the obvious (dip, face the ledge, blow, hop on, hop off once above it) gets onto ledges 1 and 2 at once (${first.map(fmt).join(', ')}); the windy ledges ask for more (${firstLate.map(fmt).join(', ')})`);
      const rnd = [2, 3].map(n => rate('random', n, fps, 5)), nolean = rate('nolean', 3, fps, 5);
      t.ok(rnd.every(r => r.per < 0.12) && nolean.per < 0.8, `@${fps} a kid who blows any old way and hops at a random moment rarely makes the windy ledges (${rnd.map(fmt).join(', ')}); one who knows where to blow but ignores the gust still misses now and then (${fmt(nolean)})`);
      const mash = rate('masher', 0, fps, 2);
      env.put(LEGS[0].pot[0], LEGS[0].from, LEGS[0].pot[2], 0); const pil = env.run(makeKid('pillar', LEGS, { seed: 1 }), { budget: 20, dt: 1 / fps });
      t.ok(!mash.up && !pil.done && pil.top < 5.6, `@${fps} the pillar trick (jump, look down, press, again: a jump shakes the soap off the wand, so nothing but a puff of air) never leaves the floor (top ${pil.top}); hopping straight off the bubble never reaches ledge 1 (${fmt(mash)})`);
      // the shields
      const shRate = (kind, k, runs) => { let up = 0, blows = 0; for (let s = 1; s <= runs; s++) { env.game.beaten = []; env.live.burst = BL.SHIELDS.map(() => 9); env.live.shieldMiss = 0; const pot = RIM_LEG.pots[k]; env.put(pot[0], pot[1], pot[2] + 1, 0); env.live.courtT = s * 2.3; const n0 = env.live.field.n; const r = env.run(makeShieldKid(kind, k, { seed: s * 5 + k }), { budget: 30, dt: 1 / fps }); up += !!r.done; blows += env.live.field.n - n0; } return { up, runs, blows, per: up / Math.max(1, blows) }; };
      // owner 2026-10-30: "let's add 2 more shields": shields 2-5 (4 and 5 a little harder: smaller, swaying more, 5 in a side breeze)
      const ssk = [1, 2, 3, 4].map(k => shRate('skilled', k, 4)), srnd = [1, 2, 3, 4].map(k => shRate('random', k, 6)), smash = [2, 4].map(k => shRate('masher', k, 2)), late = srnd.reduce((a, r) => a + r.up, 0) / srnd.reduce((a, r) => a + r.blows, 0);
      t.ok(ssk.every(r => r.up === r.runs && r.per >= 0.5) && srnd.every(r => r.per < 0.35) && late < 0.2 && srnd[3].per < 0.15 && !smash.some(r => r.up), `@${fps} the high shields 2-5: a skilled kid (blows when its shield comes over, upwind in a breeze, rides up, hops off above it and drops on its top) pops each one every time (${ssk.map(fmt).join(', ')}); a kid who blows and hops at random rarely does (${srnd.map(fmt).join(', ')}; the fifth in its side breeze hardly ever); hopping straight off never (${smash.map(fmt).join(', ')})`);
      // the low first shield (owner 2026-10-30: "land on top" must be found by doing it): a first-time kid who walks at it and jumps
      // (any distance from a step to three, and again after a boing) pops it; a kid who only walks into it gets boinged back, never a pop;
      // jumping under a high one never reaches it
      const low = (kind, s, k = 0) => { env.game.beaten = []; env.live.burst = BL.SHIELDS.map(() => 9); env.live.shieldMiss = 0; env.live.boings = 0; const S = BL.SHIELDS[k]; if (kind === 'underjump') env.put(S.x + 0.5, BL.RIM.y + 1, S.z, 0); else env.put(80.5 + (s % 3 - 1) * 1.5, BL.RIM.y + 1, 36.3, 0); env.live.courtT = s * 1.7; const r = env.run(makeLowShieldKid(kind, { seed: s, k }), { budget: 15, dt: 1 / fps }); return { pop: !!r.done, t: r.t, boings: env.live.boings }; };
      const firstK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => low('firsttime', s)), walk = [1, 2, 3].map(s => low('walker', s)), under = [1, 2, 3, 4].map(k => low('underjump', k, k));
      t.ok(firstK.every(r => r.pop && r.t < 4) && walk.every(r => !r.pop && r.boings >= 5) && under.every(r => !r.pop), `@${fps} the low shield: a first-time kid who walks at it and jumps pops it every time (${firstK.map(r => `${r.t} s/${r.boings} boing`).join(', ')}); walking into it only boings you back (${walk.map(r => r.boings).join(', ')} boings in 15 s); jumping under a high one never reaches it`);
      // Captain Suds' bubble: walking at him you are boinged back, never inside
      env.game.beaten = []; env.put(BL.DOME.x, BL.RIM.y + 1, BL.DOME.z + 6, 0); env.player.keys = { KeyW: true }; let inside = 0; for (let i = 0; i < 4 * fps; i++) { env.step(1 / fps); if (Math.hypot(env.player.pos.x - BL.DOME.x, env.player.pos.z - BL.DOME.z) < BL.DOME.r) inside++; } env.player.keys = {};
      t.ok(!inside && env.live.info().dome.up && env.toasts.some(m => /Hee hee/.test(m)), `@${fps} Captain Suds' bubble boings you back: walking at him for 4 s you never get inside it; he giggles "Hee hee!" from in there`);
      env.game.beaten = [];
    }
  }

  if (ONLY === 'land' || ONLY === 'rules' || ONLY === 'kids') return;
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
  if (want('play') || want('shots') || !ONLY) {
    await intoWell(page);
    await arm(page);
    const D0 = await page.evaluate(() => {
      const R = window.__R, { g, live, p } = R;
      R.put(80.5, 5, 131.5); R.run(0.1);
      const aim = live.aim(p.pos)?.text('↑', 20);
      return { place: g.place, parts: g.world.parts.map(x => x.id).join(), aim, st: R.L.bubbleState(g), bee: !!R.bee(), boss: !!R.boss(), crew: [0, 1, 2].map(i => R.crew(i)?.name).join(), wand: R.said('Dip your wand') || !!live.wand, chip: document.getElementById('score-chip')?.textContent, word: live.near(p), wet: live.wet, lifts: live.info().lifts, keep: g.world.keeps.some(k => k.name === 'well'), edit: g.world.editAllowed?.(80, 5, 120, R.B.STONE), toasts: window.__toasts.length };
    });
    t.ok(D0.place === 'bubble' && D0.parts === 'bubble' && D0.bee && D0.boss && D0.crew === 'Wanda Wand,Duckherd Daisy,Mate Fizz' && D0.wand, `the Bubble Well frame opens the well; a bubble wand; Captain Suds and his crew are there (${D0.crew})`);
    t.ok(D0.word === 'Puff!' && !D0.wet && /Climb 1/.test(D0.aim) && /Climb ○ · 🦆 0 \/ 3 · Chimney ○ · 🛡️ 0 \/ 5/.test(D0.chip) && !/Ledge/.test(D0.chip) && !/●|○○/.test(D0.chip) && D0.lifts.join() === 'false,false' && D0.keep && D0.edit === false, `a dry wand: the big button says Puff! (only air); the guide leads to the first ledge ("${D0.aim}"), the chip has no soap dots (${D0.chip}); the lifts are off; nobody builds in the well`);
    if (want('play') || !ONLY) {
      // the soap pot: walk up to it and the wand dips (Blow!); a bubble; a jump shakes the film off (Puff! again)
      const P1 = await page.evaluate(() => {
        const R = window.__R, { live, p } = R, pot = R.L.SOAP_POTS[0], out = {};
        R.put(pot[0], pot[1], pot[2] + 2.5, 0); R.run(0.2); out.dry = live.near(p);
        p.keys = { KeyW: true }; for (let i = 0; i < 60 && !live.wet; i++) R.frame(); p.keys = {}; R.run(0.1);
        out.wet = live.wet; out.word = live.near(p); out.film = live.wand.userData.parts.film.visible;
        const n = live.field.n; live.use(p); out.blown = live.field.n === n + 1 && !live.wet;
        out.again = (R.run(0.1), live.wet); // still by the pot: it dips again
        p.keys = { Space: true }; R.frame(); p.keys = {}; for (let i = 0; i < 10; i++) R.frame(); out.shook = !live.wet && live.near(p) === 'Puff!';
        R.run(1.2);
        return out;
      });
      t.ok(P1.dry === 'Puff!' && P1.wet && P1.word === 'Blow!' && P1.film && P1.blown && P1.again && P1.shook, 'walk up to a soap pot and the wand dips (a soap film in its ring, the button says Blow!); one dip, one bubble; a jump shakes the film off (Puff! again)');
      // the climb with the real Player (a skilled kid), a fall back to the ledge
      const C1 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, out = {};
        out.l1 = R.climb('skilled', 0, { budget: 40 }); out.y1 = p.pos.y;
        // hop off a bubble too early: back on the ledge you blew from, never on the floor
        const L = R.Bots.LEGS[1]; R.put(L.pot[0], L.from, L.pot[2], -Math.PI / 2); R.run(0.2); live.use(p); const b = live.field.list.at(-1);
        p.keys = { Space: true, KeyW: true }; for (let i = 0; i < 90 && live.stood !== b; i++) { R.frame(); p.keys.Space = false; }
        out.onIt = !!b && live.stood === b; p.keys = {}; R.run(0.3);
        p.keys = { Space: true, KeyW: true }; p.yaw = -Math.PI / 2; R.frame(); p.keys = { KeyW: true }; for (let i = 0; i < 240 && !(p.onGround && !p.carry); i++) R.frame(); p.keys = {}; R.run(0.3);
        out.back = { y: p.pos.y, miss: live.stairMiss.slice() };
        out.rest = R.climb('skilled', 1, { budget: 60 }); out.y2 = p.pos.y;
        out.st = R.L.bubbleState(g); out.lifts = live.info().lifts; out.said = R.said('Up the Fizz Ledges');
        return out;
      });
      t.ok(C1.l1.done && C1.onIt && Math.abs(C1.back.y - 8) < 0.05 && C1.back.miss[1] >= 1, `the climb with the real Player: up from the floor; hop off a bubble too early and you are back on the ledge you blew from (y ${C1.back.y.toFixed(2)}), never on the floor`);
      t.ok(C1.rest.done && C1.y2 > 18.9 && C1.st.stairs && C1.said && C1.lifts[0] === true, `ledge by ledge onto the plateau (the stream, the gust, the drips): the Fizz Ledges are done and the first fizz lift runs (${C1.rest.t} s)`);
      // a reload keeps the ledges
      await page.evaluate(() => window.pokecraft.save());
      await page.reload(); await page.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
      await continueGame(page); await pause(page);
      await placeIs(page, 'bubble'); await arm(page);
      const D2 = await page.evaluate(() => { const R = window.__R, { g, live } = R; R.run(0.1); return { st: R.L.bubbleState(g), place: g.place, lift: live.info().lifts[0], inLifts: g.world.lifts.length, mark: g.beaten.includes('pw:bubble:redesign1') }; });
      t.ok(D2.place === 'bubble' && D2.st.stairs && D2.lift && D2.inLifts === 1 && D2.mark, `a reload keeps the ledges (the one-time reset never runs twice: the mark is saved) and the lift runs (${D2.inLifts})`);
      const L1 = await page.evaluate(() => { const R = window.__R, { p } = R, l = R.L.LIFTS[0]; R.put(l.x[0] + 1, 5, l.z[0] + 1); for (let i = 0; i < 60 * 5 && p.pos.y < 19; i++) R.frame(); p.joy = { x: 0, y: -1 }; p.yaw = 0; for (let i = 0; i < 60 * 3 && !(p.onGround && p.pos.y > 18.9); i++) R.frame(); p.joy = null; return { y: p.pos.y }; });
      t.ok(L1.y > 18.9, `the fizz lift takes you up to the plateau (y ${L1.y.toFixed(1)})`);
      // the ducklings: a dry wand only ruffles a sleeping one; a wet one (the garden's pots) bubbles it; puffs of air push it home
      const D3 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, d = live.ducks[0], y = R.L.MESA.top + 1, out = {};
        R.put(d.x + 1.2, y, d.z, Math.PI / 2); out.dryWord = live.near(p); live.use(p); out.stillAsleep = d.state === 'sleep';
        live.wet = true; out.word = live.near(p); live.use(p); out.state = d.state; out.puffWord = live.near(p); out.dryAfter = !live.wet;
        out.r = [0, 1, 2].map(i => R.duck(i));
        out.st = R.L.bubbleState(g); out.home = R.said('All the ducklings are home');
        R.put(R.L.NEST.x + 2, y, R.L.NEST.z, Math.PI / 2); R.run(0.1); const keys = g.beaten.length; live.use(p); out.again = live.ducks.filter(d => d.state === 'sleep').length === 1 && R.said('Just for fun') && g.beaten.length === keys;
        return out;
      });
      t.ok(D3.dryWord === 'Puff!' && D3.stillAsleep && D3.word === 'Blow!' && D3.state === 'float' && D3.puffWord === 'Puff!' && D3.dryAfter, 'by a sleeping duckling a dry wand only puffs (it sleeps on); with soap the big button says Blow! and a bubble closes round it; then Puff! pushes it');
      t.ok(D3.r.every(r => r.home) && D3.st.ducks === 3 && D3.home && D3.again, `all three ducklings floated home (${D3.r.map(r => `${r.uses} presses, ${r.t.toFixed(0)} s`).join('; ')}); then Blow! by the nest sends one back just for fun (nothing new saved)`);
      // the Chimney Ride: Ride!, the robot's taps on the big button, the top; from inside only a faint rim of the bubble
      const D4 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, C = R.L.CHIMNEY, out = {};
        R.put(C.x + C.wall + 1.2, R.L.MESA.top + 1, C.z, Math.PI / 2); R.run(0.1);
        const RP = live.rideBubble.userData.parts; out.outside = RP.glow.visible && RP.gold.visible;
        out.word = live.near(p); live.use(p); out.riding = p.carry === live.rideObj; out.jump = p.carry?.jumpWord?.(); out.puff = live.near(p);
        live.step(0.02); out.inside = !RP.glow.visible && !RP.gold.visible && !RP.sparks.visible && RP.film.material.uniforms.uAlpha.value < 0.3;
        out.chip = []; const t0 = window.__toasts.length; const f = g.ui.setScore.bind(g.ui); g.ui.setScore = c => { if (c?.text) out.chip.push(c.text); return f(c); };
        out.r = R.ride('skilled');
        g.ui.setScore = f;
        const said = window.__toasts.slice(t0); out.soapSaid = said.find(m => /🧼/.test(m)); out.soap = !!out.soapSaid && out.chip.some(c => /🧼 \d \/ 6/.test(c));
        out.star = [...said, ...out.chip].some(m => /⭐|star/i.test(m));
        out.st = R.L.bubbleState(g); out.y = p.pos.y; out.lifts = live.info().lifts; out.said = R.said('Up the chimney');
        // owner 2026-10-30: "Why did I have to do an entire round walk?": you step out on Captain Suds' balcony, looking at him
        const D = R.L.DOME, fw = p.forward; out.toSuds = Math.hypot(p.pos.x - D.x, p.pos.z - D.z) - D.r; out.toShield = Math.hypot(p.pos.x - R.L.SHIELDS[0].x, p.pos.z - R.L.SHIELDS[0].z);
        out.facing = (fw.x * (D.x - p.pos.x) + fw.z * (D.z - p.pos.z)) / Math.hypot(fw.x, fw.z) / Math.hypot(D.x - p.pos.x, D.z - p.pos.z);
        out.aim = live.aim(p.pos)?.text('↑', 7);
        return out;
      });
      t.ok(D4.word === 'Ride!' && D4.riding && D4.jump === 'Puff' && D4.puff === 'Puff!' && D4.outside && D4.inside, `by the chimney the big button says Ride!, then Puff! (Jump says Puff); golden from outside, only a faint soap rim from inside (no glare)`);
      t.ok(D4.r.done && D4.st.chimney && D4.y > 41.9 && D4.lifts[1] && D4.said && D4.r.t > 30 && D4.soap && !D4.star, `the Chimney Ride to the top in ${D4.r.t.toFixed(0)} s: on the rim, the chimney done, the second fizz lift runs; its checkpoints are bars of soap ("${D4.soapSaid}"), nothing says star`);
      t.ok(D4.toSuds < 8 && D4.toShield < 7 && D4.facing > 0.95, `the ride puts you down on Captain Suds' balcony, looking at him: ${D4.toSuds.toFixed(1)} blocks from his bubble, ${D4.toShield.toFixed(1)} from his first shield (it was a walk of about 60 round the rim); the guide: "${D4.aim}"`);
      // Captain Suds sealed in his bubble (owner 2026-10-30): you can't get in (boing), talking gets a giggle from inside, never a battle
      const D5a = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, D = R.L.DOME, out = {};
        g.beaten = g.beaten.filter(k => !/pw:bubble:crew/.test(k));
        R.put(D.x, R.L.RIM.y + 1, D.z + 5.5, 0); p.keys = { KeyW: true }; R.run(2); p.keys = {};
        out.d = Math.hypot(p.pos.x - D.x, p.pos.z - D.z); out.boings = live.boings; out.hee = R.said('Hee hee'); out.dome = live.info().dome;
        g.talkTo(R.boss()); out.talk = !g.inBattle && /Hee hee|land on top/.test(window.__toasts.at(-1) || ''); out.giggle = live.giggleT < 1;
        return out;
      });
      t.ok(D5a.d >= 3.39 && D5a.boings > 0 && D5a.hee && D5a.dome.up && D5a.dome.skins === 5 && D5a.talk && D5a.giggle, `Captain Suds sits sealed in his bubble (five skins, one per shield): walking at him boings you back (${D5a.d.toFixed(1)} from his middle), he giggles "Hee hee!" from inside; talking to him gets no battle`);
      // the shields: walk at the low first one and it boings you; jump on it: pop, and one skin of his bubble pops; the high ones by a
      // bubble ride from the soap pot under each; the last bursts his bubble
      const D5 = await page.evaluate(() => {
        const R = window.__R, { g, live, p } = R, out = {};
        live.boings = 0; R.put(80.5, R.L.RIM.y + 1, 36.3, 0); out.walk = R.kid(R.Bots.makeLowShieldKid('walker', { seed: 1 }), { budget: 3 }); out.walkBoings = live.boings;
        out.low = R.kid(R.Bots.makeLowShieldKid('firsttime', { seed: 2 }), { budget: 10 }); out.skins1 = live.info().dome.skins;
        out.r = [1, 2, 3, 4].map(k => R.shield(k));
        out.st = R.L.bubbleState(g); out.all = R.said('Captain Suds is ready'); out.dome = live.info().dome;
        R.run(1); out.after = live.info().dome.skins;
        live.burst = R.L.SHIELDS.map(() => 9); const keys = g.beaten.length; const fun = R.shield(1); out.fun = !!fun.done && R.said('Just for fun') && g.beaten.length === keys && !live.info().dome.up; // (all popped: back just for fun)
        return out;
      });
      t.ok(!D5.walk.done && D5.walkBoings > 0 && D5.low.done && D5.skins1 === 4, `walking into the low shield only boings you back (${D5.walkBoings} boings); a jump onto it pops it in ${D5.low.t} s, and one skin of his bubble pops with it`);
      t.ok(D5.r.every(r => r.done) && D5.st.shields === 5 && D5.st.ready && D5.all && !D5.dome.up && D5.after === 0, `ride a bubble up from the soap pot under a high shield, hop off above it and drop onto it: pop! (🛡️ ${D5.st.shields} / 5, ${D5.r.map(r => `${r.t} s`).join(', ')}); the last one bursts Captain Suds' bubble`);
      t.ok(D5.fun, 'with all five popped the shields float back and pop again just for fun (nothing new saved, his bubble stays gone)');
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
      await page.evaluate(async () => { const R = window.__R, { g } = R, Sp = await import('/src/species.js'); g.party = [Sp.makeCreature('thunderwolf', 100), Sp.makeCreature('blazehound', 100)]; g.talkTo(R.boss()); }); // two: a lone creature can lose to four
      t.ok(await playBattle(page), 'the Boss battle is won');
      const W1 = await page.evaluate(() => { const R = window.__R, { g, live } = R; live.step(0.3); return { star: g.stars.includes('bubble'), keys: g.beaten.filter(k => /pw:bubble:(stairs|duck|chimney|shield)/.test(k)).length, crew: g.beaten.filter(k => /pw:bubble:crew/.test(k)).length, lifts: live.info().lifts, ducks: live.ducks.map(d => d.state).join(), note: R.said('bath-time friends'), gate: R.L.bubbleState(g).ready, mark: g.beaten.includes('pw:bubble:redesign1') }; });
      t.ok(W1.star && W1.keys === 0 && W1.crew === 3 && W1.lifts.join() === 'true,true' && W1.ducks === 'sleep,sleep,sleep' && W1.note && !W1.gate && W1.mark, `the star and the Wizard's note; the climb's keys are cleared for a rematch (the crew stays beaten, the lifts keep running for a star holder, the ducklings asleep on their islands again)`);
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
      // the start: the well, the first ledges with their soap pots
      await page.evaluate(() => { const R = window.__R, { p, live } = R; R.put(99.5, 5, 86.5); p.lookAt({ x: 106, y: 9, z: 72 }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-arrival.png');
      // a soap pot and the loaded wand (a film in its ring), the ghost bubble where it comes out
      await page.evaluate(() => { const R = window.__R, { p, live } = R, pot = R.L.SOAP_POTS[0]; R.put(pot[0], pot[1], pot[2] + 0.6, 0); R.run(0.2); R.put(pot[0] - 0.4, pot[1], pot[2] + 2.2, 0); live.wet = true; p.lookAt({ x: pot[0], y: pot[1] + 0.4, z: pot[2] - 1 }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-pot.png');
      // riding a bubble up beside a ledge
      await page.evaluate(() => { const R = window.__R, { p, live } = R, L = R.Bots.LEGS[1]; R.put(L.pot[0], L.from, L.pot[2], -Math.PI / 2); R.run(0.2); live.use(p); const b = live.field.list.at(-1); p.keys = { Space: true, KeyW: true }; for (let i = 0; i < 90 && live.stood !== b; i++) { R.frame(); p.keys.Space = false; } p.keys = {}; R.run(1.2); p.yaw = -1.9; p.pitch = -1.1; live.step(0.01); });
      await frames(page, 3); await shot(page, 'bubble-riding.png');
      await page.evaluate(() => { const R = window.__R, { g, p, live } = R; live.giveBack(); g.beaten = g.beaten.filter(k => !/duck/.test(k)); for (const x of live.ducks) x.backHome(); const d = live.ducks[2]; d.blow(live.gardenT); d.x = 93.4; d.z = 52.6; R.put(95.2, 19, 53.4); p.lookAt({ x: 90, y: 19.2, z: 52 }); live.gardenT = 3.8; live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-garden.png');
      // inside the Chimney Ride: the rings ahead, no glare
      await page.evaluate(() => { const R = window.__R, { p, live } = R, C = R.L.CHIMNEY; R.put(C.x + C.wall + 1.2, 19, C.z, Math.PI / 2); live.startRide(); const b = R.Bots.RIDE_BOTS.skilled(); for (let i = 0; i < 60 * 5; i++) { const q = b(live.ride); if (q.tap) live.puff(); live.step(1 / 60, { ride: { sx: q.sx, sz: q.sz } }); p.update(1 / 60); } const q = C.plates.find(q => live.ride.y < q.y + 1) ?? C.plates.at(-1), g = R.Bu.gapOf(C, q, live.ride.t); p.lookAt({ x: g.x, y: q.y, z: g.z }); live.step(0.01); });
      await frames(page, 3); await shot(page, 'bubble-chimney.png');
      await page.evaluate(() => { const R = window.__R, { p, live } = R, C = R.L.CHIMNEY; live.giveBack(); R.put(C.x + C.wall + 3.5, 19, C.z + 0.5); p.lookAt({ x: C.x, y: 20.6, z: C.z }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-ride-bubble.png');
      // a bar of soap over a gold ring, close up inside the ride (owner 2026-10-30: the ride's checkpoints are no stars)
      await page.evaluate(() => { const R = window.__R, { p, live } = R, C = R.L.CHIMNEY; R.put(C.x + C.wall + 1.2, 19, C.z, Math.PI / 2); live.startRide(); live.step(0.05); p.update(0.05); const s = C.stars[1]; p.lookAt({ x: s.x + 0.4, y: s.y, z: s.z }); live.step(0.01); });
      await frames(page, 3); await shot(page, 'bubble-soap.png');
      // owner 2026-10-30: "slightly dim that light coming from the chimney holes": inside the ride, looking straight up under the next ring
      await page.evaluate(() => { const R = window.__R, { p, live } = R, C = R.L.CHIMNEY; live.giveBack(); R.put(C.x + C.wall + 1.2, 19, C.z, Math.PI / 2); live.startRide(); const b = R.Bots.RIDE_BOTS.skilled(); for (let i = 0; i < 60 * 3; i++) { const q = b(live.ride); if (q.tap) live.puff(); live.step(1 / 60, { ride: { sx: q.sx, sz: q.sz } }); p.update(1 / 60); } const q = C.plates.find(q => live.ride.y < q.y + 1) ?? C.plates.at(-1), g = R.Bu.gapOf(C, q, live.ride.t); p.lookAt({ x: g.x + (g.x - C.x) * 0.6, y: q.y + 1.2, z: g.z + (g.z - C.z) * 0.6 }); live.step(0.01); });
      await frames(page, 3); await shot(page, 'bubble-chimney-up.png');
      // owner 2026-10-30: "Why did I have to do an entire round walk?": the ride ends on Captain Suds' balcony, looking at him (the chip: Climb ✓)
      await page.evaluate(() => { const R = window.__R, { g, live } = R; g.beaten = g.beaten.filter(k => !/pw:bubble:(shield|chimney)/.test(k)); for (const k of ['pw:bubble:stairs', 'pw:bubble:duck1', 'pw:bubble:duck2', 'pw:bubble:duck3']) if (!g.beaten.includes(k)) g.beaten.push(k); live.burst = R.L.SHIELDS.map(() => 9); live.domeBurst = 9; live.chimneyDone(); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-landing.png');
      // the chimney's stack standing up out of the rim (a longer ride), from the rim walk
      await page.evaluate(() => { const R = window.__R, { p, live } = R, C = R.L.CHIMNEY; live.giveBack(); R.put(80.5, 42, 37.3); p.lookAt({ x: C.x, y: 43, z: C.z }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-stack.png');
      // Captain Suds sealed in his bubble, from the rim walk: the low first shield in front of him, the high ones over the soap pots, the
      // trails of little bubbles from each shield into his bubble
      await page.evaluate(() => { const R = window.__R, { g, p, live } = R; live.giveBack(); g.beaten = g.beaten.filter(k => !/shield/.test(k)); live.burst = R.L.SHIELDS.map(() => 9); live.domeBurst = 9; R.put(80.5, 42, 37.4); p.lookAt({ x: 80.5, y: 43.6, z: 26 }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-suds-sealed.png');
      // owner 2026-10-30: "let's add 2 more shields": all five along the balcony (the low one in front of him, four bobbing high over their pots)
      await page.evaluate(() => { const R = window.__R, { p, live } = R; R.put(76.5, 42, 37.4); p.lookAt({ x: 90, y: 44.2, z: 30 }); live.step(0.05); });
      await frames(page, 3); await shot(page, 'bubble-five-shields.png');
      // walking into the low shield: boing (it squashes)
      await page.evaluate(() => { const R = window.__R, { p, live } = R, s = live.shieldNow(0).c; R.put(s.x, 42, s.z + 3.2, 0); p.keys = { KeyW: true }; for (let i = 0; i < 60 && live.wob[0] > 0.1; i++) R.frame(); p.keys = {}; R.frame(); p.lookAt({ x: s.x, y: 42.4, z: s.z }); live.step(0.01); });
      await frames(page, 3); await shot(page, 'bubble-shield-boing.png');
      // jumping onto it: pop! (it bursts, one skin of his bubble goes)
      await page.evaluate(() => { const R = window.__R, { p, live } = R, s = live.shieldNow(0).c; R.put(s.x, 42, s.z + 2.6, 0); R.run(0.1); p.keys = { KeyW: true, Space: true }; for (let i = 0; i < 120 && live.shieldUp(0); i++) { R.frame(); if (p.vel.y > 0) p.keys.Space = false; } p.keys = {}; R.run(0.12); R.put(s.x, 42, s.z + 4.5); p.lookAt({ x: s.x, y: 42.8, z: s.z - 2 }); live.step(0.01); });
      await frames(page, 3); await shot(page, 'bubble-shield-pop.png');
      // riding up to a high shield
      await page.evaluate(() => { const R = window.__R, { p, live } = R, pot = R.Bots.RIM_LEG.pots[1]; R.put(pot[0], pot[1], pot[2] + 0.5, 0); R.run(0.2); live.use(p); const b = live.field.list.at(-1); p.keys = { Space: true, KeyW: true }; for (let i = 0; i < 90 && live.stood !== b; i++) { R.frame(); p.keys.Space = false; } p.keys = {}; R.run(2.0); const s = live.shieldNow(1).c; p.lookAt({ x: s.x, y: s.y - 0.5, z: s.z }); live.step(0.01); });
      await frames(page, 3); await shot(page, 'bubble-shield-ride.png');
      // all three popped: his bubble bursts
      await page.evaluate(() => { const R = window.__R, { g, p, live } = R; live.giveBack(); for (const k of ['pw:bubble:shield2', 'pw:bubble:shield3', 'pw:bubble:shield4', 'pw:bubble:shield5']) if (!g.beaten.includes(k)) g.beaten.push(k); live.burst = R.L.SHIELDS.map(() => 0.3); live.domeBurst = 0.25; live.giggleT = 0.3; R.put(80.5, 42, 36.5); p.lookAt({ x: 80.5, y: 43.6, z: 26 }); live.step(0.01); });
      await frames(page, 3); await shot(page, 'bubble-suds-free.png');
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
    await ip.evaluate(() => { const R = window.__R, pot = R.L.SOAP_POTS[0]; R.put(pot[0], pot[1], pot[2], 0); R.p.pitch = -0.3; R.run(0.1); });
    await frames(ip, 2);
    const w1 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    const n0 = await ip.evaluate(() => window.__R.live.field.n);
    await ip.tap('#btn-act');
    await waitFor(ip, n0 => window.__R.live.field.n > n0, n0, 30000);
    // a tap on the screen does what the big button does (by the pot: another bubble)
    const I1 = await ip.evaluate(() => { const R = window.__R, { g, live } = R; R.run(0.1); const n = live.field.n; R.p.yaw = Math.PI; const ok = g.gymLive.tap(g.camera.position.clone(), R.p.forward.clone()); return { ok, more: live.field.n > n }; });
    t.ok(w1 === 'Blow!' && I1.ok && I1.more, `iPad: by a soap pot the big button says Blow! and blows a bubble; a tap on the screen does too (${w1})`);
    const I2 = await ip.evaluate(() => { const R = window.__R, { live, p } = R; const b = live.field.list.at(-1); live.land(b); live.step(0.02); return { carry: p.carry === live.standObj }; });
    await frames(ip, 2);
    const j1 = await ip.evaluate(() => document.getElementById('btn-jump')?.textContent.trim());
    await ip.evaluate(() => { const R = window.__R, C = R.L.CHIMNEY; R.put(C.x + C.wall + 1.2, 19, C.z, Math.PI / 2); R.live.step(0.03); });
    await frames(ip, 2);
    const w2 = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    await ip.tap('#btn-act');
    await waitFor(ip, () => !!window.__R.live.ride, null, 30000);
    await frames(ip, 2);
    const I3 = await ip.evaluate(() => { const R = window.__R, { g, live } = R, y0 = live.ride.y; const ok = g.gymLive.tap(g.camera.position.clone(), R.p.forward.clone()); for (let i = 0; i < 12; i++) live.step(1 / 30); return { ok, up: live.ride.y - y0, jump: document.getElementById('btn-jump')?.textContent.trim(), act: document.getElementById('btn-act')?.textContent.trim() }; });
    t.ok(I2.carry && j1 === 'Bounce' && w2 === 'Ride!' && I3.ok && I3.up > 0.2 && I3.jump === 'Puff' && I3.act === 'Puff!', `iPad: on a bubble Jump says Bounce; Ride! on the big button; in the ride Jump says Puff and a tap on the screen puffs you up (${I3.up.toFixed(2)})`);
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
    const k1 = await Bp.evaluate(() => { const R = window.__R, { live, p } = R; R.put(100.5, 5, 82.5, 0); R.run(0.2); live.use(p); p.yaw = Math.PI; R.run(0.05); live.use(p); window.pokecraft.mp.sendState(); return { mine: live.field.list.length, sum: (() => { let s = 0; const d = R.g.world.data; for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0; return s; })() }; });
    await A.waitForTimeout(1500);
    const a1 = await A.evaluate(() => { const R = window.__R, { live } = R; live.step(0.1); const o = [...window.pokecraft.mp.others.values()][0]; return { mine: live.field.list.length, here: o?.here, sum: (() => { let s = 0; const d = R.g.world.data; for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0; return s; })() }; });
    t.ok(k1.mine === 2 && a1.mine === 0 && a1.here && a1.sum === k1.sum, `two players: the Kid blows two bubbles, Dad has none of them (bubbles are each player's own, never blocks or messages); the well's blocks are the same for both; Dad sees the Kid in the well`);
    t.ok(!A.errors.length && !Bp.errors.length, `no page errors in the pair ${A.errors.concat(Bp.errors).slice(0, 3).join('; ')}`);
    await A.context().close(); await Bp.context().close();
  }

  /* ---------------------------------------------------------------- H. Real input (owner 2026-10-29: "easy to understand, hard to master") */
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
    const live = pg => pg.evaluate(() => { const g = window.pokecraft, l = g.gymLive.of('part:bubble'), p = g.player; return { stood: l.stood?.id ?? null, on: p.carry === l.standObj, y: p.pos.y, ground: p.onGround && !p.carry, n: l.field.n, wet: l.wet, said: (window.__said || []).join(' | ') }; });
    // the look, by mouse moves through the game's mousemove handler (yaw, pitch in radians)
    const look = (pg, yaw, pitch) => pg.evaluate(([yaw, pitch]) => {
      const p = window.pokecraft.player, k = 0.0022, w = a => Math.atan2(Math.sin(a), Math.cos(a));
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: -w(yaw - p.yaw) / k, movementY: -(pitch - p.pitch) / k }));
      return { yaw: p.yaw, pitch: p.pitch };
    }, [yaw, pitch]);
    const start = (pg, at) => pg.evaluate(at => { // the spot (a dry wand, no bubbles); nothing else is touched
      const g = window.pokecraft, p = g.player, l = g.gymLive.of('part:bubble');
      l.giveBack(); for (const b of [...l.field.list]) l.field.pop(b); l.wet = false;
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
    await page.evaluate(() => { window.__said = []; const ui = window.pokecraft.ui, f = ui.toast.bind(ui); ui.toast = (m, ...r) => { window.__said.push(m); return f(m, ...r); }; });
    // the pillar trick (owner: "I could just jump and build under me"): by the pot, jump, look down, E in the air: only a puff, no bubble
    const pot = [100.5, 5, 82.5];
    await start(page, pot); await look(page, 0, 0); await waitT(page, 0.4);
    const n0 = (await live(page)).n;
    for (let i = 0; i < 3; i++) { await key(page, 'Space', 0.1); await waitT(page, 0.12); await look(page, 0, -1.5); await key(page, 'KeyE'); await waitT(page, 0.6); }
    const H2 = await live(page);
    t.ok(H2.n === n0 && !H2.on && H2.y < 5.1, `real keys: by the pot, jump, look down, E, three times: a jump shakes the soap off the wand, so only a puff of air comes out; you stay on the floor (${H2.n - n0} bubbles)`);
    // dip, blow, hop on, ride, hop off onto the first ledge: real keys only (W to the pot, E, W + Space, wait, W + Space)
    await start(page, [pot[0], pot[1], pot[2] + 2]); await look(page, 0, -0.2); await waitT(page, 0.3);
    await page.keyboard.down('KeyW'); await waitT(page, 0.45); await page.keyboard.up('KeyW'); await waitT(page, 0.2);
    const H3a = await live(page);
    await look(page, 0, -0.35); await waitT(page, 0.1); await shot(page, 'bubble-wet-wand.png'); // (the dipped wand: a soap film in its ring, the ghost bubble where it comes out)
    await look(page, 0, -0.2); await waitT(page, 0.05);
    await key(page, 'KeyE'); await waitT(page, 0.1);
    await page.keyboard.down('KeyW'); await key(page, 'Space', 0.1); await waitT(page, 0.35); await page.keyboard.up('KeyW');
    const H3b = await live(page);
    await waitT(page, 1.4); // let it carry you up
    await page.keyboard.down('KeyW'); await key(page, 'Space', 0.1); await waitT(page, 0.8); await page.keyboard.up('KeyW'); await waitT(page, 0.4);
    const H3c = await live(page);
    t.ok(H3a.wet && H3b.on && H3c.ground && Math.abs(H3c.y - 8) < 0.05, `real keys: walk to the soap pot (the wand dips), E (a bubble), W + Space (on it), wait while it carries you up, W + Space: on the first ledge (wet ${H3a.wet}, on ${H3b.on}, y ${H3c.y.toFixed(2)})`);
    await shot(page, 'bubble-ledge1.png');
    t.ok(!page.errors.length, `no page errors (real keys) ${page.errors.slice(0, 3).join(' | ')}`);
    await page.context().close();
    // the iPad: by the pot tap Blow!, Jump onto the bubble
    const ip = await retry(() => openGame(browser, base, { contextOptions: devices['iPad (gen 7) landscape'] }));
    await newGame(ip, 0);
    await ip.evaluate(() => { const g = window.pokecraft; g.weather.set('clear'); g.time = 0.25; document.getElementById('pause')?.classList.add('hidden'); });
    await intoWell(ip);
    await clockOn(ip);
    const press = (pg, id, down) => pg.evaluate(([id, down]) => { const el = document.getElementById(id), r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent(down ? 'pointerdown' : 'pointerup', { pointerId: 7, pointerType: 'touch', bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); }, [id, down]);
    await start(ip, pot); await ip.evaluate(() => { const p = window.pokecraft.player; p.yaw = 0; p.pitch = -0.2; }); await waitT(ip, 0.4);
    const word = await ip.evaluate(() => document.getElementById('btn-act')?.textContent.trim());
    await ip.tap('#btn-act'); await waitT(ip, 0.1);
    await ip.keyboard.down('KeyW');
    await press(ip, 'btn-jump', true); await waitT(ip, 0.12); await press(ip, 'btn-jump', false); await waitT(ip, 0.3);
    await ip.keyboard.up('KeyW'); await waitT(ip, 0.3);
    const I1 = await live(ip);
    t.ok(word === 'Blow!' && I1.on, `iPad: by the soap pot tap Blow!, walk ahead and tap Jump: on the bubble (${word}, y ${I1.y.toFixed(2)})`);
    t.ok(!ip.errors.length, `no page errors (iPad, real taps) ${ip.errors.slice(0, 3).join(' | ')}`);
    await ip.context().close();
  }

  /* ---------------------------------------------------------------- R. The one-time reset and ?preview's "Start this world over" */
  // Owner 2026-10-29: "reset my progress in ... bubble worlds": a save without the mark loses its old Bubble Well progress once (keys incl.
  // the crew, the star, its bossWins), then keeps the mark; a save with the mark keeps what it won. Nothing else is touched.
  if (want('reset')) {
    const pg0 = await retry(() => openGame(browser, base));
    await newGame(pg0, 0); await pause(pg0);
    const fresh = await pg0.evaluate(() => window.pokecraft.beaten.includes('pw:bubble:redesign1'));
    const old = ['pw:bubble:stairs', 'pw:bubble:duck1', 'pw:bubble:crew1', 'pw:bubble:shield2', 'pw:castle:shield1', 'pw:castle:crew1'];
    const json = await pg0.evaluate(old => { const g = window.pokecraft; g.save(); const s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); s.beaten = [...old, 'ninja:trainer']; s.stars = ['bubble', 'castle']; s.bossWins = { bubble: 2, castle: 1 }; return JSON.stringify(s); }, old);
    await pg0.context().close();
    const pg = await retry(() => openGame(browser, base, { setup: seedSave(json) })); // (a save from before the redesign, in a fresh browser)
    await continueGame(pg); await pause(pg);
    const R1 = await pg.evaluate(() => { const g = window.pokecraft; return { beaten: g.beaten.slice().sort().join(), stars: g.stars.join(), wins: JSON.stringify(g.bossWins), saved: JSON.parse(localStorage.getItem('pokecraft-save-v2')).beaten.includes('pw:bubble:redesign1') }; });
    t.ok(fresh && R1.beaten.split(',').filter(k => !/^pw:\w+:redesign\d+$/.test(k) || k === 'pw:bubble:redesign1').join() === 'ninja:trainer,pw:bubble:redesign1,pw:castle:crew1,pw:castle:shield1' && R1.stars === 'castle' && R1.wins === '{"castle":1}' && R1.saved, `a new game carries the mark; an old save loses its Bubble Well keys, crew, star and Boss wins once (every other world untouched: ${R1.beaten}; stars ${R1.stars}; ${R1.wins})`);
    await pg.evaluate(() => { const g = window.pokecraft; g.beaten.push('pw:bubble:duck2'); g.stars.push('bubble'); g.bossWins.bubble = 1; g.save(); });
    await pg.reload(); await pg.waitForFunction(() => window.pokecraft && window.pokecraft.world, null, { timeout: 120000 });
    await continueGame(pg); await pause(pg);
    const R2 = await pg.evaluate(() => { const g = window.pokecraft; return { duck: g.beaten.includes('pw:bubble:duck2'), star: g.stars.includes('bubble'), wins: g.bossWins.bubble }; });
    t.ok(R2.duck && R2.star && R2.wins === 1, 'with the mark, what you win later is kept for good (the reset never runs again)');
    // no "Start this world over" without ?preview
    await intoWell(pg); await pause(pg);
    const R3 = await pg.evaluate(() => ({ el: !!document.getElementById('world-reset'), hidden: document.getElementById('world-reset')?.classList.contains('hidden') ?? true }));
    t.ok(R3.hidden, `without ?preview the pause screen has no "Start this world over" (${R3.el ? 'hidden' : 'none'})`);
    t.ok(!pg.errors.length, `no page errors (reset) ${pg.errors.slice(0, 3).join(' | ')}`);
    await pg.context().close();
    const pv = await retry(() => openGame(browser, base, { query: '?preview' }));
    await newGame(pv, 0); await pause(pv);
    const R4 = await pv.evaluate(() => ({ hidden: document.getElementById('world-reset')?.classList.contains('hidden') }));
    await intoWell(pv);
    await pv.evaluate(() => { const g = window.pokecraft; g.beaten.push('pw:bubble:stairs', 'pw:bubble:duck1', 'pw:bubble:crew2', 'pw:castle:lance1'); g.stars.push('bubble', 'castle'); g.bossWins.bubble = 3; g.player.pos.set(60, 19, 40); });
    await pv.evaluate(() => { const el = document.getElementById('pause'); el.classList.add('hidden'); el.classList.remove('hidden'); }); // (playing, then the pause screen comes up)
    await pv.waitForTimeout(200);
    const R5 = await pv.evaluate(() => ({ hidden: document.getElementById('world-reset').classList.contains('hidden'), text: document.getElementById('world-reset').textContent }));
    await pv.evaluate(() => document.getElementById('world-reset').click());
    const R6 = await pv.evaluate(() => { const g = window.pokecraft; return { bubble: g.beaten.filter(k => k.startsWith('pw:bubble:')).join(), castle: g.beaten.includes('pw:castle:lance1'), star: g.stars.includes('bubble'), castleStar: g.stars.includes('castle') }; });
    await pv.evaluate(() => document.getElementById('world-reset').click());
    const R7 = await pv.evaluate(() => { const g = window.pokecraft, p = g.player.pos, a = g.world.arrivals.bubble, s = JSON.parse(localStorage.getItem('pokecraft-save-v2')); return { bubble: g.beaten.filter(k => k.startsWith('pw:bubble:')).join(), star: g.stars.includes('bubble'), wins: g.bossWins.bubble ?? null, castle: g.beaten.includes('pw:castle:lance1') && g.stars.includes('castle'), d: Math.hypot(p.x - a[0], p.z - a[2]), saved: !s.beaten.includes('pw:bubble:stairs') && !s.stars.includes('bubble'), place: g.place, live: !!g.gymLive.of('part:bubble') }; });
    t.ok(R4.hidden && !R5.hidden && /Start this world over/.test(R5.text), `?preview: in a Picture World the pause screen offers "${R5.text}" (not in the main world: ${JSON.stringify(R4)})`);
    t.ok(R6.bubble.includes('stairs') && R7.bubble === 'pw:bubble:redesign1' && !R7.star && R7.wins === null && R7.castle && R7.d < 1 && R7.saved && R7.place === 'bubble' && R7.live, `a first tap asks again (nothing changed yet); the second clears only this world (keys, crew, star, Boss wins; the mark stays), saves, and puts you at its arrival (${R7.d.toFixed(1)} away); the Castle is untouched`);
    t.ok(!pv.errors.length, `no page errors (preview reset) ${pv.errors.slice(0, 3).join(' | ')}`);
    await pv.context().close();
  }

  /* ---------------------------------------------------------------- G. Closed without ?preview (it ships closed) */
  if (want('closed')) {
    const shut = await openGame(browser, base, { wave15: false });
    const c = await shut.evaluate(async () => { const PW = await import('/src/pictureworlds.js'), C = await import('/src/comingsoon.js'), pb = await import('/src/pictureboss.js'), sl = await import('/src/swirlland.js'); const w = PW.pictureWorld('bubble'); return { ready: w.ready, secret: w.secret, name: w.name, emoji: w.emoji, open: C.worldOpen('bubble'), later: C.LATER.includes('bubble'), boss: pb.bossOf('bubble').title, castle: C.worldOpen('castle') }; });
    t.ok(c.ready && !c.secret && c.name === 'Bubble Well' && c.open && !c.later && c.boss === 'Captain Suds · Bubble Well Boss' && c.castle, `owner 2026-10-30: the Bubble Well is open for everyone, also without ?preview (${c.name})`);
    // its frame in the Swirl takes you in
    await newGame(shut, 0); await pause(shut);
    const c2 = await shut.evaluate(async () => {
      const g = window.pokecraft; g.champion = true; g.realms.enter('swirl', { back: g.world.portal.stand });
      for (let i = 0; i < 600 && (g.place !== 'swirl' || g.realms.busy); i++) await new Promise(r => setTimeout(r, 100));
      const f = g.world.swirl.frames.find(f => f.world === 'bubble'), cell = f.cells[Math.floor(f.cells.length / 2)];
      const used = g.portal.use({ x: cell[0], y: cell[1], z: cell[2], id: g.world.get(...cell) });
      for (let i = 0; i < 900 && (g.place !== 'bubble' || g.realms.busy); i++) await new Promise(r => setTimeout(r, 100));
      return { used, place: g.place };
    });
    t.ok(c2.used && c2.place === 'bubble', `its frame in the Swirl takes you into the Bubble Well (${c2.place})`);
    t.ok(!shut.errors.length, `no page errors without ?preview ${shut.errors.slice(0, 3).join(' | ')}`);
    await shut.context().close();
    const pre = await openGame(browser, base, { wave15: false, query: '?preview' });
    const o = await pre.evaluate(async () => { const PW = await import('/src/pictureworlds.js'); const w = PW.pictureWorld('bubble'); return { ready: w.ready, name: w.name }; });
    t.ok(o.ready && o.name === 'Bubble Well', `?preview opens it (${o.name})`);
    await pre.context().close();
  }
}
