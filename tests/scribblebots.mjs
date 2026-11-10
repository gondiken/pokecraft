// Chapter 3 Test A / B (src/scribble.js, src/scribblefight.js): model players for the scribble fight on the REAL ground near the start
// (the game's own world in the page, ?preview). The house rule: a "naive kid" bot must lose, a skilled one must win, behind your
// creature (Test A) and in first person (Test B), at 60 and 20 decisions a second (fixed 1/120 s steps either way).
//   naive:   mashes every move, never moves (first person: stands where it came in, looking at the middle)
//   skilled: steps out of the red (only to ground it can walk to), dodges just before a hit, keeps its distance, shoots only along a
//            clear line (hills and trees block shots), swaps a tired creature out. First person: it walks YOU, your creature follows
//            (scribblefight.js follow), and it looks at its target.
//   node tests/scribblebots.mjs                 every bot, 4 games each
//   SCRIBBLE_GAMES=8 node tests/scribblebots.mjs
// tests/specs/scribble.mjs runs these (part `bots`) and the real keys / iPad / screenshots parts.
import { serve, launch, openGame, newGame, click } from './helpers.mjs';
import { pathToFileURL } from 'node:url';

export const BOTS = String.raw`
const { ScribbleFight, groundOf, squadOf, follow, FIGHT, FightCam, onScreen } = await import('/src/scribblefight.js');
const LIVE_TELL = (await import('/src/arena/live.js')).LIVE.foe.tell, LIVE_FULL = (await import('/src/arena/live.js')).LIVE.charge;
const S = await import('/src/species.js');
const g = window.pokecraft, C = g.scribble.spot, G = groundOf(g.world);
const len2 = Math.hypot;
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0; return len2(px - ax - dx * t, pz - az - dz * t); };
const TEAM = [['blazehound', 30], ['tidalord', 30], ['thunderwolf', 30], ['phantomaw', 30]];
// a fight as the game starts it: you at the patch's edge on the side of the start, your creature 3.5 blocks ahead
function newFight(lead, solo = null) {
  const team = TEAM.map(([s, l]) => S.makeCreature(s, l));
  const order = Array.isArray(solo?.[0]) ? solo.map(([sp, l]) => S.makeCreature(sp, l)) : solo ? Array.from({ length: solo[3] || 1 }, () => Object.assign(S.makeCreature(solo[0], solo[1]), solo[2] ? { moves: solo[2] } : {})) : [team[lead % team.length], ...team.filter((_, i) => i !== lead % team.length)];
  const a = Math.atan2(g.spawnPoint.x - C.x, g.spawnPoint.z - C.z), dx = Math.sin(a), dz = Math.cos(a);
  const px = C.x + dx * (FIGHT.patch - 0.3), pz = C.z + dz * (FIGHT.patch - 0.3);
  const sx = px - dx * 3.5, sz = pz - dz * 3.5;
  const probe = new ScribbleFight({ ground: G, centre: C, squad: squadOf(order), start: { x: sx, y: G.floor(sx, sz, C.y + 4), z: sz } });
  probe.me = { x: px, z: pz, y: G.floor(px, pz, C.y + 4), yaw: Math.atan2(-(C.x - px), -(C.z - pz)) };
  return probe;
}
// is a straight walk from (x, z) to (nx, nz) possible for something standing at y (steps of one block, inside the ring)?
function walkable(F, x, z, y, nx, nz, pad = 0.9) {
  if (!F.inRing(nx, nz, pad)) return false;
  const n = Math.max(1, Math.ceil(len2(nx - x, nz - z) / 0.4));
  for (let k = 1; k <= n; k++) { const ny = G.stand(x + (nx - x) * k / n, z + (nz - z) * k / n, y); if (ny == null) return false; y = ny; }
  return true;
}
function danger(F, x, z, y) {
  const you = F.you;
  for (const f of F.foes) {
    if (!f.alive) continue;
    if (f.tell && F.inTell(f.tell, x, y, z, you.r + 0.5)) return true;
    const c = f.charging;
    if (c && segDist(x, z, f.x, f.z, f.x + c.dx * c.left, f.z + c.dz * c.left) < f.r + you.r + 0.4) return true;
  }
  return false;
}
// where the creature should go now (skilled): out of the red, else at its distance from the nearest monster, circling
function skilledGoal(F) {
  const you = F.you;
  if (danger(F, you.x, you.z, you.y)) {
    let best = null, bd = Infinity;
    for (let k = 0; k < 24; k++) for (const s of [1.2, 2.2, 3.4, 4.6]) {
      const x = you.x + Math.cos(k * Math.PI / 12) * s, z = you.z + Math.sin(k * Math.PI / 12) * s;
      if (!walkable(F, you.x, you.z, you.y, x, z)) continue;
      const y = G.stand(x, z, you.y, 3);
      if (y == null || danger(F, x, z, y)) continue;
      if (s < bd) { bd = s; best = { x, z }; }
    }
    const soon = F.foes.some(f => f.alive && ((f.tell && f.tell.left < 0.22) || f.charging));
    if (!best) return { gx: 0, gz: 0, flee: true, dodge: soon }; // cornered: a well-timed dodge (its moment of safety) is the way out
    return { gx: best.x - you.x, gz: best.z - you.z, flee: true, dodge: soon };
  }
  const alive = F.foes.filter(f => f.alive).sort((p, q) => len2(p.x - you.x, p.z - you.z) - len2(q.x - you.x, q.z - you.z));
  const f = alive[0];
  if (!f) return { gx: 0, gz: 0 };
  const dx = you.x - f.x, dz = you.z - f.z, d = len2(dx, dz) || 1;
  const want = 4.6, push = d < want ? 1 : d > want + 2 ? -0.7 : 0;
  let gx = dx / d * push - dz / d * 0.45, gz = dz / d * push + dx / d * 0.45;
  const L = len2(gx, gz) || 1;
  if (!walkable(F, you.x, you.z, you.y, you.x + gx / L * 1.2, you.z + gz / L * 1.2, 1.4)) { // a wall or the ring: toward the middle instead
    gx = C.x - you.x + dz / d * 2; gz = C.z - you.z - dx / d * 2;
  }
  return { gx, gz };
}
// its moves (skilled): a clear line for shots, blasts when they are close, a heal when low, a rush only when it is safe
function skilledMoves(F) {
  const you = F.you;
  if (you.hp < you.maxHp * 0.3) { const i = F.squad.findIndex((q, k) => k !== F.lead && q.hp > q.c.level * 1.5); if (i >= 0) F.swap(i); }
  if (!F.aimDir) { // behind: pick a monster it can hit
    const t = F.aimAt();
    if (t && !F.clearShot(F.you, t)) { const o = F.foes.find(f => f.alive && F.clearShot(F.you, f)); if (o) F.pick(o); }
  }
  // a rush at a monster in the last part of its warning cancels its attack (FIGHT.rush): aim one there when a rush is ready
  const win = LIVE_TELL * (FIGHT.rush.window ?? 1);
  const dashSlot = F.moves.findIndex((s, i) => s?.kind === 'dash' && F.cd[i + 1] === 0) + 1;
  if (dashSlot && !F.aimDir) {
    const w = F.foes.filter(f => f.alive && f.tell && f.tell.left <= win && f.tell.left > 0.05 && len2(f.x - you.x, f.z - you.z) < 7 && walkable(F, you.x, you.z, you.y, f.x, f.z, 0.5))[0];
    if (w) { F.pick(w); F.press(dashSlot); F.release(dashSlot); }
  }
  const t = F.aimAt();
  // a big blast in hand: let go when a monster inside the ring is in the last part of its warning (it is stopped), else at full
  if (F.charge.slot > 0) {
    const k = Math.min(1, F.charge.t / LIVE_FULL), r = F.blastR(k);
    if (k > 0.75 && F.foes.some(f => f.alive && f.tell && f.tell.left <= win && len2(f.x - you.x, f.z - you.z) < r)) F.release(F.charge.slot);
    return;
  }
  const foeSoon = F.foes.some(f => f.alive && (f.charging || (f.tell && F.inTell(f.tell, you.x, you.y, you.z, you.r + 0.3))));
  for (let i = 1; i <= 4; i++) {
    const s = F.moves[i - 1];
    if (!s || F.cd[i] > 0 || !t) continue;
    const d = len2(t.x - you.x, t.z - you.z);
    if (s.kind === 'heal' && (you.hp > you.maxHp * 0.55 || F.foes.some(f => f.alive && (f.tell || f.charging)))) continue; // heal between attacks
    if (s.kind === 'buff' && s.stat === 'def') { // brace just before a hit you cannot step out of
      if (!F.foes.some(f => f.alive && ((f.tell && f.tell.left < 0.45 && F.inTell(f.tell, you.x, you.y, you.z, you.r)) || (f.charging && len2(f.x - you.x, f.z - you.z) < 4)))) continue;
    }
    if ((s.kind === 'bolt' || s.kind === 'volley') && !F.clearShot(you, t)) continue;
    if (s.kind === 'dash' && (d > 5 || danger(F, t.x, t.z, t.y) || danger(F, you.x, you.z, you.y) || !walkable(F, you.x, you.z, you.y, t.x, t.z, 0.5))) continue;
    if (s.kind === 'burst') { if (!foeSoon && F.foes.some(f => f.alive && len2(f.x - you.x, f.z - you.z) < F.blastR(1) + 1.5)) F.press(i); continue; }
    F.press(i); F.release(i);
  }
}
// kid: like a child who gets it but is not quick: sees a red warning 0.35 s late and walks out of it (no dodge), keeps a few blocks
// away, presses every move that is ready (no line-of-sight thinking), never swaps by itself
function kidStep(F, dt, eyes) {
  const you = F.you;
  F.kid ??= { seen: new Map(), goal: null };
  const now = F.clock;
  for (const f of F.foes) if (f.alive && f.tell && !F.kid.seen.has(f.tell)) F.kid.seen.set(f.tell, now);
  const late = F.foes.some(f => f.alive && f.tell && now - F.kid.seen.get(f.tell) > 0.35 && F.inTell(f.tell, you.x, you.y, you.z, you.r + 0.3));
  let g = { gx: 0, gz: 0 };
  if (late) { const s = skilledGoal(F); g = { gx: s.gx, gz: s.gz }; }
  else { const s = skilledGoal(F); if (!s.flee) g = s; }
  if (!eyes) { F.input.mx = g.gx; F.input.mz = g.gz; }
  else {
    const me = F.me, L = len2(g.gx, g.gz);
    if (L > 0.05) { const st = Math.min(L, 4.3 * dt), nx = me.x + g.gx / L * st, nz = me.z + g.gz / L * st; if (walkable(F, me.x, me.z, me.y, nx, nz, 0.6)) { me.x = nx; me.z = nz; me.y = G.stand(nx, nz, me.y) ?? me.y; } }
    const t = F.foes.filter(f => f.alive).sort((p, q) => len2(p.x - me.x, p.z - me.z) - len2(q.x - me.x, q.z - me.z))[0];
    if (t) me.yaw = Math.atan2(-(t.x - me.x), -(t.z - me.z));
    follow(F, me.x, me.z, me.yaw);
  }
  // (a big blast: it holds the button until the ring is full, then it goes by itself)
  if (F.charge.slot <= 0) for (let i = 1; i <= 4; i++) { const s = F.moves[i - 1]; if (!s || F.cd[i] > 0) continue; if (s.kind === 'heal' && you.hp > you.maxHp * 0.5) continue; F.press(i); if (s.kind !== 'burst') F.release(i); }
  F.step(dt);
}
// person (step 3, night run): closer to a real child on a tablet than the kid: sees a warning 0.3-0.6 s late, walks out of it with a
// wobbly thumb (up to 35 degrees off), dodges only half the time when it is late, taps a move about every 0.4-1.1 s (one at a time, a
// shot whether or not a hill is in the way), holds a big blast 0.5-1.1 s, now and then taps another monster, heals under 40 %, swaps a
// tired creature only sometimes. Its numbers: seeded per fight, so a run is the same at 60 and 20 fps.
function personStep(F, dt, eyes) {
  const you = F.you;
  if (!F.ps) { let seed = 1234 + (F.foes[0].x * 1000 | 0); const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); F.ps = { r, seen: new Map(), next: 0.6, wob: 0, wobT: 0, hold: 0, dodgeLate: r() < 0.5 }; }
  const P = F.ps, now = F.clock;
  for (const f of F.foes) if (f.alive && f.tell && !P.seen.has(f.tell)) P.seen.set(f.tell, now + 0.3 + P.r() * 0.3);
  const lateNow = F.foes.some(f => f.alive && f.tell && now > P.seen.get(f.tell) && F.inTell(f.tell, you.x, you.y, you.z, you.r + 0.3));
  if ((P.wobT -= dt) <= 0) { P.wobT = 0.4 + P.r() * 0.6; P.wob = (P.r() - 0.5) * 1.2; }
  const s = skilledGoal(F);
  let gx = 0, gz = 0;
  if (lateNow || !s.flee) { const c = Math.cos(P.wob), sn = Math.sin(P.wob); gx = s.gx * c - s.gz * sn; gz = s.gz * c + s.gx * sn; }
  if (lateNow && F.cd[0] === 0 && F.foes.some(f => f.alive && f.tell && f.tell.left < 0.25) && P.r() < dt * 30 * 0.5) F.press(0);
  if (!eyes) { F.input.mx = gx; F.input.mz = gz; }
  else {
    const me = F.me, L = len2(gx, gz);
    if (L > 0.05) { const st = Math.min(L, 4.3 * dt), nx = me.x + gx / L * st, nz = me.z + gz / L * st; if (walkable(F, me.x, me.z, me.y, nx, nz, 0.6)) { me.x = nx; me.z = nz; me.y = G.stand(nx, nz, me.y) ?? me.y; } }
    const t = F.target?.alive ? F.target : F.foes.find(f => f.alive);
    if (t) me.yaw += Math.atan2(Math.sin(Math.atan2(-(t.x - me.x), -(t.z - me.z)) - me.yaw), Math.cos(Math.atan2(-(t.x - me.x), -(t.z - me.z)) - me.yaw)) * Math.min(1, dt * 4);
    follow(F, me.x, me.z, me.yaw);
  }
  if (F.charge.slot > 0) { if ((P.hold -= dt) <= 0) F.release(F.charge.slot); F.step(dt); return; }
  if (you.hp < you.maxHp * 0.25 && P.r() < dt * 0.6) { const i = F.squad.findIndex((q, k) => k !== F.lead && q.hp > 0); if (i >= 0) F.swap(i); }
  if ((P.next -= dt) <= 0) {
    P.next = 0.4 + P.r() * 0.7;
    if (P.r() < 0.15) { const o = F.foes.filter(f => f.alive); F.pick(o[Math.floor(P.r() * o.length)]); }
    const ready = [1, 2, 3, 4].filter(i => F.moves[i - 1] && F.cd[i] === 0 && !(F.moves[i - 1].kind === 'heal' && you.hp > you.maxHp * 0.4));
    if (ready.length) { const i = ready[Math.floor(P.r() * ready.length)]; F.press(i); if (F.moves[i - 1].kind === 'burst') P.hold = 0.5 + P.r() * 0.6; else F.release(i); }
  }
  F.step(dt);
}
const BOT = {
  kid: kidStep,
  person: personStep,
  naive(F, dt, eyes) {
    for (let i = 1; i <= 4; i++) { F.press(i); F.release(i); }
    if (eyes) follow(F, F.me.x, F.me.z, F.me.yaw); else { F.input.mx = F.input.mz = 0; }
    F.step(dt);
  },
  skilled(F, dt, eyes) {
    const goal = skilledGoal(F);
    if (!eyes) {
      F.input.mx = goal.gx; F.input.mz = goal.gz;
    } else { // you walk (4.3 a second, like the game's walk), your creature follows; you look at the target
      const me = F.me, L = len2(goal.gx, goal.gz);
      if (L > 0.05) {
        const st = Math.min(L, 4.3 * dt), nx = me.x + goal.gx / L * st, nz = me.z + goal.gz / L * st;
        if (walkable(F, me.x, me.z, me.y, nx, nz, 0.6)) { me.x = nx; me.z = nz; me.y = G.stand(nx, nz, me.y) ?? me.y; }
      }
      const t = F.foes.filter(f => f.alive).sort((p, q) => (F.clearShot(F.you, q) - F.clearShot(F.you, p)) || len2(p.x - me.x, p.z - me.z) - len2(q.x - me.x, q.z - me.z))[0];
      if (t) me.yaw = Math.atan2(-(t.x - me.x), -(t.z - me.z));
      follow(F, me.x, me.z, me.yaw);
      if (goal.flee && L > 0.05) { F.input.mx = goal.gx; F.input.mz = goal.gz; } // a warning: your creature runs out of it with you
    }
    if (goal.dodge && F.cd[0] === 0) F.press(0);
    skilledMoves(F);
    F.step(dt);
  },
};
// what a child sees behind its creature (FightCam): the share of moments a monster / a red warning / your creature is on screen,
// and the camera's jumps (a move of more than 0.6 blocks in 1/60 s) and moments with a block between camera and creature
const CAMS = {
  old: { up: 8.5 * Math.sin(0.78), back: 8.5 * Math.cos(0.78), fov: 75, ahead: 1.6 }, // the first try (turned with your look; the bots never turn it)
  new: {},
};
function camWatch(F, which, aspect) {
  const cam = new FightCam(CAMS[which]), you = F.you;
  cam.start(F.me.yaw, you.x, you.y, you.z);
  const w = { n: 0, foe: 0, foeN: 0, tell: 0, tellN: 0, you: 0, jumps: 0, hidden: 0, last: null, aspect };
  w.tick = dt => {
    const p = cam.update(dt, F.you, F.me.yaw, aspect, G), inS = q => q && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95;
    if (w.last && Math.hypot(p.x - w.last[0], p.y - w.last[1], p.z - w.last[2]) > 0.6 * Math.max(1, dt * 60)) w.jumps++;
    w.last = [p.x, p.y, p.z]; w.n++;
    if (inS(onScreen(p, aspect, F.you.x, F.you.y + 0.6, F.you.z))) w.you++;
    const fx = F.you.x - p.x, fy = F.you.y + 0.8 - p.y, fz = F.you.z - p.z;
    for (let k = 0.15; k < 0.9; k += 0.05) if (G.solid(p.x + fx * k, p.y + fy * k, p.z + fz * k)) { w.hidden++; break; }
    for (const f of F.foes) if (f.alive) {
      w.foeN++; if (inS(onScreen(p, aspect, f.x, f.y + 0.6, f.z))) w.foe++;
      if (f.tell) { w.tellN++; const t = f.tell, pts = t.kind === 'line' ? [[t.x, t.z], [t.x + t.dx * t.len, t.z + t.dz * t.len]] : [[t.x - t.r, t.z], [t.x + t.r, t.z], [t.x, t.z - t.r], [t.x, t.z + t.r]];
        if (pts.every(([x, z]) => inS(onScreen(p, aspect, x, t.y, z)))) w.tell++; }
    }
  };
  w.out = () => ({ cam: which, aspect: +aspect.toFixed(2), foe: Math.round(100 * w.foe / Math.max(1, w.foeN)), tell: Math.round(100 * w.tell / Math.max(1, w.tellN)), you: Math.round(100 * w.you / Math.max(1, w.n)), jumps: w.jumps, hidden: Math.round(100 * w.hidden / Math.max(1, w.n)) });
  return w;
}
window.__scribbleBots = { newFight, BOT, camWatch };
`;

export async function play(page, bot, { eyes = false, fps = 60, lead = 0, limit = 150, solo = null, cams = null } = {}) {
  return page.evaluate(async ({ BOTS, bot, eyes, fps, lead, limit, solo, cams }) => {
    if (!window.__scribbleBots) await eval(`(async () => { ${BOTS} })()`);
    const { newFight, BOT, camWatch } = window.__scribbleBots, S = await import('/src/species.js');
    const F = newFight(lead, solo), dt = 1 / fps;
    const W = (cams || []).map(([c, a]) => camWatch(F, c, a));
    for (let t = 0; t < limit && !F.over; t += dt) { BOT[bot](F, dt, eyes); for (const w of W) w.tick(dt); }
    return { won: F.won, time: Math.round(F.clock), left: F.foes.filter(f => f.alive).length, team: F.squad.filter((m, i) => (i === F.lead ? F.you.hp : m.hp) > 0).length, dodged: F.stats.dodged,
      hp: Math.round(100 * F.you.hp / F.you.maxHp), foeHp: Math.round(100 * F.foes.reduce((a, f) => a + Math.max(0, f.hp), 0) / F.foes.reduce((a, f) => a + f.maxHp, 0)),
      byKind: F.stats.byKind, hitBy: F.stats.hitBy, takenPerMin: Math.round(F.stats.taken / Math.max(1, F.clock) * 60 / F.squad.reduce((a, m) => a + S.statsFor(m.c).maxHp, 0) * 100), extra: { braced: F.stats.braced || 0, spoilt: F.stats.spoilt || 0, buffLost: F.stats.buffLost || 0 }, snapsPerMin: Math.round(F.stats.snaps / Math.max(1, F.clock) * 60), blocked: +(F.stats.blocked / Math.max(1, F.clock)).toFixed(2), ...(W.length ? { cams: W.map(w => w.out()) } : {}) };
  }, { BOTS, bot, eyes, fps, lead, limit, solo, cams });
}

export const RUNS = [
  ['naive', false, 60], ['skilled', false, 60], ['skilled', false, 20],
  ['naive', true, 60], ['naive', true, 20], ['skilled', true, 60], ['skilled', true, 20],
];

// -> { lines, fails }
export async function runBots(page, games = 4, log = console.log) {
  let fails = 0;
  const lines = [];
  for (const [bot, eyes, fps] of RUNS) {
    const runs = [];
    for (let g = 0; g < games; g++) runs.push(await play(page, bot, { eyes, fps, lead: bot === 'naive' ? g % 3 : g })); // (naive: see MATCHED)
    const wins = runs.filter(r => r.won).length;
    const ok = bot === 'naive' ? wins <= Math.floor(games / 4) : wins === games;
    if (!ok) fails++;
    const line = `${ok ? 'ok  ' : 'FAIL'} ${bot} ${eyes ? 'eyes  ' : 'behind'} @${fps}: ${wins}/${games} won  ${runs.map(r => JSON.stringify(r)).join(' ')}`;
    lines.push(line); log(line);
  }
  // Reported, never failed: mashing with a lead whose types beat all three monsters (Phantomaw: Ghost moves hit the Ghost monster x2,
  // its Fire move the Grass one, and nothing hits it x2) wins most fights. That is the type chart working, not a hole in the rules.
  const m = []; for (let g = 0; g < games; g++) m.push(await play(page, 'naive', { lead: MATCHED }));
  const line = `info naive behind @60 with a type-matched lead (phantomaw): ${m.filter(r => r.won).length}/${games} won`;
  lines.push(line); log(line);
  // step 3 (night run): how long a person takes (reported; plans/chapter3.md: about 1-2 minutes)
  const pr = []; for (let g = 0; g < games; g++) pr.push(await play(page, 'person', { lead: g, fps: g % 2 ? 20 : 60, limit: 400 }));
  const pt = pr.filter(r => r.won).map(r => r.time).sort((a, b) => a - b);
  const line2 = `info person behind: ${pt.length}/${games} won in ${pt.join(', ')} s`;
  lines.push(line2); log(line2);
  // the owner's own team (a weaker lead in front of two strong ones): mashing must lose with it too
  const ow = []; for (let g = 0; g < games; g++) ow.push(await play(page, 'naive', { solo: OWNER_TEAM, fps: g % 2 ? 20 : 60 }));
  const okO = ow.filter(r => r.won).length <= Math.floor(games / 4);
  if (!okO) fails++;
  const line3 = `${okO ? 'ok  ' : 'FAIL'} naive with a mixed-level team (Graphitan 56, Kitegale 91, Blazehound 89): ${ow.filter(r => r.won).length}/${games} won`;
  lines.push(line3); log(line3);
  return { lines, fails };
}
export const MATCHED = 3;
export const OWNER_TEAM = [['graphitan', 56], ['kitegale', 91], ['blazehound', 89]];

// The page: ?preview and a game in the world of `seed` (none = a New Game in a random world) with a team of three at level 30
// (the arena's ready-made team).
export async function scribblePage(browser, base, { seed = null, ...opts } = {}) {
  const page = await openGame(browser, base, { query: '?preview', ...opts });
  if (seed == null) await newGame(page, 0);
  else {
    await page.evaluate(async seed => {
      const S = await import('/src/species.js');
      const party = [S.makeCreature('blazehound', 30), S.makeCreature('tidalord', 30), S.makeCreature('thunderwolf', 30)];
      localStorage.setItem('pokecraft-save-v2', JSON.stringify({ seed, edits: [], size: [288, 368], party, box: [], cubes: 10, time: 0.25, badges: [], beaten: [] }));
    }, seed);
    await page.reload();
    await page.waitForFunction(() => window.pokecraft?.world, null, { timeout: 120000 });
    await click(page, '#title-buttons button:has-text("Continue")');
    await page.waitForTimeout(1500);
  }
  await page.evaluate(async () => {
    const g = window.pokecraft, S = await import('/src/species.js');
    g.party = [S.makeCreature('blazehound', 30), S.makeCreature('tidalord', 30), S.makeCreature('thunderwolf', 30)];
  });
  await page.waitForFunction(() => window.pokecraft.scribble.info().phase === 'idle', null, { timeout: 60000 });
  return page;
}
export const SEEDS = [1, 22, 122];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server, base } = await serve();
  const browser = await launch();
  let fails = 0;
  for (const seed of process.env.SCRIBBLE_SEED ? [+process.env.SCRIBBLE_SEED] : SEEDS) {
    const page = await scribblePage(browser, base, { seed });
    if (process.env.SCRIBBLE_TUNE) await page.evaluate(async t => Object.assign((await import('/src/scribblefight.js')).FIGHT, JSON.parse(t)), process.env.SCRIBBLE_TUNE);
    const spot = await page.evaluate(() => window.pokecraft.scribble.info().spot);
    console.log(`seed ${seed}: patch`, JSON.stringify(spot));
    fails += (await runBots(page, +process.env.SCRIBBLE_GAMES || 4)).fails;
    if (page.errors.length) { console.log('errors', page.errors); fails++; }
    await page.context().close();
  }
  await browser.close(); server.close();
  process.exit(fails ? 1 : 0);
}
