// Chapter 3 test arena (arena.html): model players for the three battle prototypes, through the arena's own fixed steps,
// buttons and pointer. The house rule: a "naive kid" bot must lose, a skilled one must win.
//   node tests/arenabots.mjs            all three modes, 4 games per bot
//   ARENA_ONLY=live node tests/arenabots.mjs
// Live (Meadow, Dark Cave, Ice Lake; three creatures you swap between): naive = mashes every move, never moves;
//   skilled = steps out of the red, dodges, keeps its distance, swaps a tired creature out (decides 60 or 20 times a second).
// Aim: naive = shoots where a monster IS and never hops; skilled = leads the shot to where it WILL be, hops out of the red.
// Timing: naive = taps at random moments; skilled = taps on the bright part, on the beats, lets go in the green, blocks on time.
import { serve, launch } from './helpers.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THREE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/three/build/three.module.js');
const ONLY = process.env.ARENA_ONLY;
const GAMES = +process.env.ARENA_GAMES || 4;

const { server, base } = await serve();
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('https://unpkg.com/**', r => r.fulfill({ path: THREE, contentType: 'application/javascript' }));
await page.route('https://fonts.googleapis.com/**', r => r.abort());
await page.goto(base + '/arena.html');
await page.waitForFunction(() => window.arena?.a?.you, null, { timeout: 60000 });

// Every bot runs inside the page: it reads the arena, presses buttons, moves the pointer and runs the fixed steps.
const BOTS = String.raw`
const core = await import('/src/arena/core.js');
const { len2, inIntent, inPillar, onFloor, segBlocked, PILLARS } = core;
const A = window.arena, a = A.a;
a.hold = true; // the page's own frame loop stops stepping; the bot runs the steps
const alive = () => a.foes.filter(f => f.alive);
const nearest = (x, z) => alive().sort((p, q) => len2(p.x - x, p.z - z) - len2(q.x - x, q.z - z))[0];
const weakest = () => alive().sort((p, q) => p.hp - q.hp)[0];
const tells = () => a.foes.filter(f => f.alive && f.tell).map(f => f.tell.t);
const inRed = (x, z, pad = 0) => tells().some(t => inIntent(t, x, z, a.you.r + pad));
// draw a path with the pointer, the way a finger does
function drawPath(pts) {
  const m = a.mode;
  m.pointer('down', { x: a.you.x, z: a.you.z });
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i], L = len2(q.x - p.x, q.z - p.z), n = Math.max(1, Math.ceil(L / 0.2));
    for (let k = 1; k <= n; k++) m.pointer('move', { x: p.x + (q.x - p.x) * k / n, z: p.z + (q.z - p.z) * k / n });
  }
  m.pointer('up', pts[pts.length - 1]);
}
const ready = i => a.mode.moves[i] && a.mode.cool?.[i] === 0;
async function untilYourTurn(limit = 30) { // run the steps until it is your turn (or the game ends)
  let t = 0;
  while (!a.over && !(a.mode.phase === 'you' && !a.mode.drawing && !a.mode.aiming) && t < limit) { A.step(0.05); t += 0.05; }
}

const LIVE = {
  naive(dt) {
    for (let i = 1; i <= 4; i++) { A.press(i); A.release(i); }
    a.input.mx = a.input.mz = 0;
    A.step(dt);
  },
  skilled(dt) {
    const you = a.you, m = a.mode;
    const charging = a.foes.filter(f => f.alive && f.charging);
    const danger = (x, z) => inRed(x, z, 0.5) || charging.some(f => { const c = f.charging; return core.segDist(x, z, f.x, f.z, f.x + c.dx * c.left, f.z + c.dz * c.left) < f.r + you.r + 0.4; });
    let gx = 0, gz = 0;
    if (danger(you.x, you.z)) {
      let best = null, bd = Infinity;
      for (let k = 0; k < 24; k++) for (const s of [1.2, 2.2, 3.4]) {
        const x = you.x + Math.cos(k * Math.PI / 12) * s, z = you.z + Math.sin(k * Math.PI / 12) * s;
        if (!onFloor(x, z, 0.9) || inPillar(x, z, 0.9) || danger(x, z)) continue;
        if (s < bd) { bd = s; best = { x, z }; }
      }
      if (best) {
        gx = best.x - you.x; gz = best.z - you.z;
        const soon = a.foes.some(f => f.alive && f.tell && f.tell.left < 0.22) || charging.length;
        if (soon && m.cd[0] === 0) { a.input.mx = gx; a.input.mz = gz; A.press(0); A.release(0); }
      }
    } else {
      const f = nearest(you.x, you.z);
      if (f) {
        const dx = you.x - f.x, dz = you.z - f.z, d = len2(dx, dz) || 1;
        const want = 4.6, push = d < want ? 1 : d > want + 2 ? -0.7 : 0;
        gx = dx / d * push - dz / d * 0.45; gz = dz / d * push + dx / d * 0.45; // keep the distance, and circle
        const nx = you.x + gx, nz = you.z + gz;
        if (inPillar(nx, nz, 1.0) || !onFloor(nx, nz, 1.6)) { gx = -you.x * 0.3 + dz / d; gz = -you.z * 0.3 - dx / d; }
      }
    }
    a.input.mx = gx; a.input.mz = gz;
    if (you.hp < you.maxHp * 0.3) { const i = a.squad.findIndex((q, k) => k !== a.lead && q.hp > q.c.level * 1.5); if (i >= 0) A.swap(i); }
    const t = m.aimAt();
    for (let i = 1; i <= 4; i++) {
      const s = m.moves[i - 1];
      if (!s || m.cd[i] > 0 || !t) continue;
      const d = len2(t.x - you.x, t.z - you.z);
      if (s.kind === 'heal' && you.hp > you.maxHp * 0.55) continue;
      if ((s.kind === 'bolt' || s.kind === 'volley') && segBlocked(you.x, you.z, t.x, t.z, 0.1)) continue;
      if (s.kind === 'dash' && (d > 5 || danger(t.x, t.z) || inRed(you.x, you.z) || segBlocked(you.x, you.z, t.x, t.z, 0.5))) continue;
      if (s.kind === 'burst') { if (alive().some(f => len2(f.x - you.x, f.z - you.z) < 3.4)) { A.press(i); A.step(0.4); A.release(i); } continue; }
      A.press(i); A.release(i);
    }
    A.step(dt);
  },
};

const AIM = {
  shots: () => a.mode.moves.map((s, i) => ({ s, i })).filter(o => o.s && a.mode.cool[o.i] === 0),
  fireAt(slot, x, z) { const m = a.mode; m.press(slot); m.pointer('down', { x, z }); m.pointer('up', { x, z }); },
  naive() {
    const m = a.mode, you = a.you;
    if (m.phase !== 'you') return;
    const o = AIM.shots().find(o => o.s.power > 0) || AIM.shots()[0];
    const f = nearest(you.x, you.z);
    AIM.fireAt(o.i + 1, f.x, f.z);
  },
  // where to aim so a straight shot meets f (it keeps running round its patch while the shot flies)
  lead(f) {
    const m = a.mode, you = a.you, P = window.__aimRules;
    let best = null, be = Infinity;
    for (let t = 0.05; t < 2.2; t += 0.01) {
      const q = m.future(f, t), e = Math.abs(len2(q.x - you.x, q.z - you.z) - f.r * 0.6 - P.shot * t);
      if (e < be) { be = e; best = { ...q, t }; }
    }
    return best;
  },
  skilled() {
    const m = a.mode, you = a.you, P = window.__aimRules;
    if (m.phase !== 'you') return;
    const opts = AIM.shots();
    const by = k => opts.find(o => o.s.kind === k);
    if (you.hp < you.maxHp * 0.4 && by('heal')) return A.press(by('heal').i + 1);
    const burst = by('burst');
    if (burst) { // a lob where two or more monsters will be when it lands
      for (const f of alive()) {
        const q = m.future(f, P.lobTime);
        if (len2(q.x - you.x, q.z - you.z) > P.lobReach) continue;
        const n = alive().filter(o => len2(m.future(o, P.lobTime).x - q.x, m.future(o, P.lobTime).z - q.z) < P.lobR).length;
        if (n >= 2 || alive().length === 1) return AIM.fireAt(burst.i + 1, q.x, q.z);
      }
    }
    const shot = by('bolt') || by('volley');
    if (shot) {
      for (const f of alive().sort((p, q) => p.hp - q.hp)) {
        const q = AIM.lead(f);
        if (q && !segBlocked(you.x, you.z, q.x, q.z, 0.25)) return AIM.fireAt(shot.i + 1, q.x, q.z);
      }
    }
    if (burst) { const f = weakest(), q = m.future(f, P.lobTime); return AIM.fireAt(burst.i + 1, q.x, q.z); }
    const dash = by('dash');
    if (dash) {
      for (const f of alive()) { const q = m.future(f, 0.3); if (len2(q.x - you.x, q.z - you.z) < 7 && !segBlocked(you.x, you.z, q.x, q.z, 0.8)) return AIM.fireAt(dash.i + 1, q.x, q.z); }
    }
    const any = opts.find(o => o.s.kind === 'buff') || opts.find(o => o.s.power > 0) || opts[0];
    const f = weakest(), q = AIM.lead(f) || f;
    AIM.fireAt(any.i + 1, q.x, q.z);
  },
  hop() { // the skilled player taps a safe spot near it
    const you = a.you;
    let best = null, bd = Infinity;
    for (let k = 0; k < 32; k++) for (const r of [1.2, 2, 2.6, 3.1]) {
      const x = you.x + Math.cos(k * Math.PI / 16) * r, z = you.z + Math.sin(k * Math.PI / 16) * r;
      if (!onFloor(x, z, 0.9) || inPillar(x, z, 0.9) || segBlocked(you.x, you.z, x, z, 0.5) || inRed(x, z, 0.25)) continue;
      const d = r + alive().filter(f => len2(f.x - x, f.z - z) < 2.5).length * 3;
      if (d < bd) { bd = d; best = { x, z }; }
    }
    if (best) a.mode.pointer('down', best);
  },
};

const TIMING = {
  run(skilled) { // plays one of your turns and the monsters' turn after it
    const m = a.mode, T = window.__timingRules, dt = 1 / 120;
    const opts = m.moves.map((s, i) => ({ s, i })).filter(o => o.s && m.cool[o.i] === 0);
    let o = opts.find(o => o.s.power > 0) || opts[0];
    if (skilled && a.you.hp < a.you.maxHp * 0.4) o = opts.find(o => o.s.kind === 'heal') || o;
    A.press(o.i + 1);
    let n = 0, nextMash = 0.1 + Math.random() * 0.3, held = false;
    while (!a.over && m.phase !== 'pick' && n++ < 120 * 30) {
      if (skilled) {
        const me = m.meter;
        if (m.phase === 'meter' && me && !me.done) {
          if (me.kind === 'needle' && Math.abs(m.needle(m.clock) - m.zone()[2]) < 0.012) A.press(0);
          if (me.kind === 'beats') for (let i = 0; i < T.beats; i++) if (Math.abs(m.clock - m.beatTime(i)) < dt / 2 + 1e-9) A.press(0);
          if (me.kind === 'charge') { if (!held) { A.press(0); held = true; } else if ((m.clock - me.hold0) / T.charge >= 0.83) A.release(0); }
        }
        if (m.phase === 'block' && m.ring && m.ring.tap == null && m.clock >= m.ring.t0 + T.ring - dt / 2) A.press(0);
      } else if (m.phase === 'meter' || m.phase === 'block') { // taps at random moments, sometimes holds
        nextMash -= dt;
        if (nextMash <= 0) { A.press(0); A.step(0.05 + Math.random() * 0.6); A.release(0); nextMash = 0.15 + Math.random() * 0.5; }
      }
      A.step(dt);
    }
  },
};

window.__bots = { LIVE, AIM, TIMING, untilYourTurn };
`;

async function play(mode, bot, opts = {}) {
  return page.evaluate(async ({ BOTS, mode, bot, opts }) => {
    if (!window.__bots) await (async () => { await eval(`(async () => { ${BOTS} })()`); })();
    const A = window.arena, a = A.a, B = window.__bots;
    A.restart(mode, { team: opts.team ?? 0, place: opts.place || 'meadow' });
    window.__log = [];
    a.hold = true;
    const limit = mode === 'live' ? 120 : 60; // seconds / turns
    if (mode === 'live') {
      const dt = 1 / (opts.fps || 60);
      for (let t = 0; t < limit && !a.over; t += dt) B.LIVE[bot](dt);
      return { won: a.won, over: a.over, time: Math.round(a.clock), hp: a.you.hp, left: a.foes.filter(f => f.alive).length };
    }
    if (mode === 'aim') {
      window.__aimRules = (await import('/src/arena/turns.js')).AIM;
      for (let n = 0; n < 60 * 120 && !a.over; n++) {
        if (a.mode.phase === 'you') B.AIM[bot]();
        if (a.mode.phase === 'dodge' && !a.mode.hopped && bot === 'skilled') { B.AIM.hop(); if (opts.log) window.__log.push(`t${a.mode.turn} hop ${a.mode.hopped} you ${a.you.x.toFixed(1)},${a.you.z.toFixed(1)} hp ${a.you.hp} tells ${a.foes.filter(f => f.tell).map(f => f.tell.t.kind).join(',')}`); }
        const hp0 = a.you.hp;
        A.step(0.05);
        if (opts.log && a.you.hp < hp0) window.__log.push(`  hit ${hp0}->${a.you.hp} phase ${a.mode.phase} at ${a.you.x.toFixed(1)},${a.you.z.toFixed(1)}`);
      }
    } else {
      window.__timingRules = (await import('/src/arena/turns.js')).TIMING;
      for (let turn = 0; turn < limit && !a.over; turn++) B.TIMING.run(bot === 'skilled');
    }
    if (opts.log) return window.__log;
    return { won: a.won, over: a.over, turns: a.mode.turn, hp: a.you.hp, left: a.foes.filter(f => f.alive).length };
  }, { BOTS, mode, bot, opts });
}

const team = await page.evaluate(() => window.arena.team.map(c => c.species));
const results = {};
let fails = 0;
if (process.env.ARENA_LOG) { console.log((await play(process.env.ARENA_LOG, 'skilled', { log: true })).join('\n')); process.exit(0); }
const RUNS = [
  ['live', 'naive', 60, 'meadow'], ['live', 'skilled', 60, 'meadow'], ['live', 'skilled', 20, 'meadow'],
  ['live', 'naive', 60, 'cave'], ['live', 'skilled', 60, 'cave'], ['live', 'naive', 60, 'ice'], ['live', 'naive', 20, 'ice'], ['live', 'skilled', 60, 'ice'], ['live', 'skilled', 20, 'ice'],
  ['aim', 'naive'], ['aim', 'skilled'], ['timing', 'naive'], ['timing', 'skilled'],
];
for (const [mode, bot, fps = 60, place] of RUNS) {
  if (ONLY && ONLY !== mode) continue;
  const runs = [];
  for (let g = 0; g < GAMES; g++) runs.push(await play(mode, bot, { fps, place, team: g % team.length }));
  const wins = runs.filter(r => r.won).length;
  const key = `${mode} ${bot}${place ? ` ${place} @${fps}` : ''}`;
  results[key] = runs;
  const ok = bot === 'naive' ? wins <= Math.floor(GAMES / 4) : wins === GAMES;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${key}: ${wins}/${GAMES} won  ${runs.map(r => JSON.stringify(r)).join(' ')}`);
}
console.log('team', team.join(', '), 'errors', errors);
await browser.close();
server.close();
process.exit(fails || errors.length ? 1 : 0);
