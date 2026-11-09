// Chapter 3 test arena (arena.html): model players for the three battle prototypes, through the arena's own fixed steps,
// buttons and pointer. The house rule: a "naive kid" bot must lose, a skilled one must win.
//   node tests/arenabots.mjs            all three modes, 4 games per bot
//   ARENA_ONLY=live node tests/arenabots.mjs
// Live: naive = mashes every move, never moves; skilled = steps out of the red, dodges, keeps its distance (decides 60 or 20 times a second).
// Draw: naive = stays put, draws straight lines at the nearest monster; skilled = walks out of the red, curves shots round pillars.
// Flick: naive = flicks straight at the nearest monster at full power; skilled = tries many flicks (simulate) and picks one
//   that hits a lot and stops outside the red.
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

const DRAW = {
  naive() {
    const m = a.mode, you = a.you;
    A.press(0); // Stay
    const i = m.moves.findIndex((s, k) => s && s.power > 0 && m.cool[k] === 0);
    const k = i >= 0 ? i : m.moves.findIndex((s, k) => s && m.cool[k] === 0);
    A.press(k + 1);
    if (m.phase === 'you' && m.step2 === 'aim') {
      const f = nearest(you.x, you.z), dx = f.x - you.x, dz = f.z - you.z, d = len2(dx, dz);
      drawPath([{ x: you.x, z: you.z }, { x: you.x + dx / d * 16, z: you.z + dz / d * 16 }]);
    }
  },
  skilled() {
    const m = a.mode, you = a.you;
    const target = weakest();
    // 1) walk: the safe spot within reach with a clear shot at the weakest monster, not too close
    let best = null, bs = -Infinity;
    for (let x = -10; x <= 10; x += 0.5) for (let z = -10; z <= 10; z += 0.5) {
      const d = len2(x - you.x, z - you.z);
      if (d > 4.8 || !onFloor(x, z, 0.8) || inPillar(x, z, 0.8) || segBlocked(you.x, you.z, x, z, 0.65)) continue;
      let s = inRed(x, z, 0.6) ? -100 : 0;
      const td = len2(target.x - x, target.z - z);
      if (!segBlocked(x, z, target.x, target.z, 0.2)) s += 6;
      s -= Math.abs(td - 4.5) * 0.8;
      for (const f of alive()) if (len2(f.x - x, f.z - z) < 2.8) s -= 3;
      s -= d * 0.15;
      if (s > bs) { bs = s; best = { x, z }; }
    }
    if (best && len2(best.x - you.x, best.z - you.z) > 0.4) drawPath([{ x: you.x, z: you.z }, best]);
    else A.press(0);
    let n = 0;
    while (!(m.phase === 'you' && m.step2 === 'pick') && n++ < 400) A.step(0.02);
    if (a.over) return;
    // 2) the move
    const moves = m.moves.map((s, i) => ({ s, i })).filter(o => o.s && m.cool[o.i] === 0);
    const by = k => moves.find(o => o.s.kind === k);
    if (you.hp < you.maxHp * 0.45 && by('heal')) return A.press(by('heal').i + 1);
    const lob = by('burst') || by('sleep') || by('cloud');
    if (lob) {
      let spot = null, cnt = 0;
      for (const f of alive()) { const c = alive().filter(o => len2(o.x - f.x, o.z - f.z) < 2.4).length; if (len2(f.x - you.x, f.z - you.z) < 8.5 && c > cnt) { cnt = c; spot = f; } }
      if (spot && (cnt >= 2 || lob.s.kind === 'burst')) { A.press(lob.i + 1); return drawPath([{ x: you.x, z: you.z }, { x: spot.x, z: spot.z }]); }
    }
    const dash = by('dash');
    if (dash) {
      for (const f of alive()) { // rush through a monster, but never end the rush in the red
        const dx = f.x - you.x, dz = f.z - you.z, d = len2(dx, dz);
        if (d > 6.8 || segBlocked(you.x, you.z, f.x, f.z, 0.7)) continue;
        for (const L of [7.4, 6.4, 5.4, d + 1.2]) {
          const ex = you.x + dx / d * L, ez = you.z + dz / d * L;
          if (L < d + 1 || !onFloor(ex, ez, 0.8) || inPillar(ex, ez, 0.8) || inRed(ex, ez, 0.6) || segBlocked(you.x, you.z, ex, ez, 0.6)) continue;
          A.press(dash.i + 1);
          return drawPath([{ x: you.x, z: you.z }, { x: ex, z: ez }]);
        }
      }
    }
    const shot = by('bolt') || by('volley') || moves.find(o => o.s.power > 0);
    if (shot) {
      A.press(shot.i + 1);
      if (m.step2 !== 'aim') return;
      if (!segBlocked(you.x, you.z, target.x, target.z, 0.2)) return drawPath([{ x: you.x, z: you.z }, { x: target.x, z: target.z }]);
      let w = null, wl = Infinity; // curve round the pillar: one bend
      for (let x = -10; x <= 10; x += 0.5) for (let z = -10; z <= 10; z += 0.5) {
        if (!onFloor(x, z, 0.3) || inPillar(x, z, 0.4) || segBlocked(you.x, you.z, x, z, 0.25) || segBlocked(x, z, target.x, target.z, 0.25)) continue;
        const L = len2(x - you.x, z - you.z) + len2(target.x - x, target.z - z);
        if (L < wl && L < 15.5) { wl = L; w = { x, z }; }
      }
      return drawPath(w ? [{ x: you.x, z: you.z }, w, { x: target.x, z: target.z }] : [{ x: you.x, z: you.z }, { x: target.x, z: target.z }]);
    }
    const any = moves[0];
    if (any) { A.press(any.i + 1); if (m.step2 === 'aim') drawPath([{ x: you.x, z: you.z }, { x: target.x, z: target.z }]); }
  },
};

const FLICK = {
  flick(dx, dz, power) {
    const you = a.you, d = len2(dx, dz) || 1, pull = 4.5 * power;
    a.mode.pointer('down', { x: you.x, z: you.z });
    a.mode.pointer('move', { x: you.x - dx / d * pull, z: you.z - dz / d * pull });
    a.mode.pointer('up', { x: you.x - dx / d * pull, z: you.z - dz / d * pull });
  },
  naive() {
    const you = a.you, f = nearest(you.x, you.z);
    FLICK.flick(f.x - you.x, f.z - you.z, 1);
  },
  skilled() {
    const m = a.mode, you = a.you;
    let best = null, bs = -Infinity;
    const options = m.moves.map((s, i) => ({ s, i })).filter(o => o.s && m.cool[o.i] === 0);
    for (const o of options) {
      if (o.s.kind === 'heal' && you.hp > you.maxHp * 0.5) continue;
      m.armed = o.i + 1;
      for (let k = 0; k < 72; k++) for (const p of [0.45, 0.7, 1]) {
        const dx = Math.cos(k * Math.PI / 36), dz = Math.sin(k * Math.PI / 36);
        const r = m.simulate(dx, dz, p);
        const n = new Set(r.hits).size;
        let s = n * (o.s.power || 30) * (o.s.kind === 'volley' ? 2 : 1) + (o.s.kind === 'burst' && n ? 60 : 0);
        if (o.s.kind === 'heal') s += 40;
        if (tells().some(t => inIntent(t, r.x, r.z, you.r + 0.4))) s -= 400;
        if (s > bs) { bs = s; best = { i: o.i, dx, dz, p }; }
      }
    }
    m.armed = best.i + 1;
    FLICK.flick(best.dx, best.dz, best.p);
  },
};

window.__bots = { LIVE, DRAW, FLICK, untilYourTurn };
`;

async function play(mode, bot, opts = {}) {
  return page.evaluate(async ({ BOTS, mode, bot, opts }) => {
    if (!window.__bots) await (async () => { await eval(`(async () => { ${BOTS} })()`); })();
    const A = window.arena, a = A.a, B = window.__bots;
    A.restart(mode, { team: opts.team ?? 0 });
    a.hold = true;
    const limit = mode === 'live' ? 120 : 60; // seconds / turns
    if (mode === 'live') {
      const dt = 1 / (opts.fps || 60);
      for (let t = 0; t < limit && !a.over; t += dt) B.LIVE[bot](dt);
      return { won: a.won, over: a.over, time: Math.round(a.clock), hp: a.you.hp, left: a.foes.filter(f => f.alive).length };
    }
    const P = mode === 'draw' ? B.DRAW : B.FLICK;
    for (let turn = 0; turn < limit && !a.over; turn++) {
      await B.untilYourTurn();
      if (a.over) break;
      P[bot]();
      await B.untilYourTurn();
    }
    return { won: a.won, over: a.over, turns: a.mode.turn, hp: a.you.hp, left: a.foes.filter(f => f.alive).length };
  }, { BOTS, mode, bot, opts });
}

const team = await page.evaluate(() => window.arena.team.map(c => c.species));
const results = {};
let fails = 0;
for (const mode of ['live', 'draw', 'flick']) {
  if (ONLY && ONLY !== mode) continue;
  for (const [bot, fps] of [['naive', 60], ['skilled', 60], ...(mode === 'live' ? [['skilled', 20]] : [])]) {
    const runs = [];
    for (let g = 0; g < GAMES; g++) runs.push(await play(mode, bot, { fps, team: g % team.length }));
    const wins = runs.filter(r => r.won).length;
    const key = `${mode} ${bot}${mode === 'live' ? ` @${fps}` : ''}`;
    results[key] = runs;
    const ok = bot === 'naive' ? wins <= Math.floor(GAMES / 4) : wins === GAMES;
    if (!ok) fails++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${key}: ${wins}/${GAMES} won  ${runs.map(r => JSON.stringify(r)).join(' ')}`);
  }
}
console.log('team', team.join(', '), 'errors', errors);
await browser.close();
server.close();
process.exit(fails || errors.length ? 1 : 0);
