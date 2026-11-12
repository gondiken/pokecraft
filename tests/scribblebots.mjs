// Chapter 3 Test A / B (src/scribble.js, src/scribblefight.js): model players for the scribble fight on the REAL ground near the start
// (the game's own world in the page, ?preview). The house rule: a "naive kid" bot must lose, a skilled one must win, behind your
// creature (Test A) and in first person (Test B), at 60 and 20 decisions a second (fixed 1/120 s steps either way).
//   naive:   mashes every move, never moves (first person: stands where it came in, looking at the middle)
//   skilled: steps out of the red (only to ground it can walk to), dodges just before a hit, keeps its distance, shoots only along a
//            clear line (hills and trees block shots), swaps a tired creature out. (First person was removed 2026-11-10.)
//   node tests/scribblebots.mjs                 every bot, 4 games each
//   SCRIBBLE_GAMES=8 node tests/scribblebots.mjs
// tests/specs/scribble.mjs runs these (part `bots`) and the real keys / iPad / screenshots parts.
import { serve, launch, openGame, newGame, click } from './helpers.mjs';
import { pathToFileURL } from 'node:url';

export const BOTS = String.raw`
const { ScribbleFight, groundOf, squadOf, FIGHT, FightCam, onScreen, foesMiddle } = await import('/src/scribblefight.js');
const LIVE_TELL = (await import('/src/arena/live.js')).LIVE.foe.tell, LIVE_FULL = (await import('/src/arena/live.js')).LIVE.charge;
const S = await import('/src/species.js');
const g = window.pokecraft, G = groundOf(g.world);
let C = g.scribble.spot;
const len2 = Math.hypot;
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0; return len2(px - ax - dx * t, pz - az - dz * t); };
const TEAM = [['blazehound', 30], ['tidalord', 30], ['thunderwolf', 30], ['phantomaw', 30]];
// a fight as the game starts it: you at the patch's edge on the side of the start, your creature 3.5 blocks ahead
function newFight(lead, solo = null) {
  C = window.__botPatch?.centre ?? g.scribble.spot;
  const team = TEAM.map(([s, l]) => S.makeCreature(s, l));
  const order = Array.isArray(solo?.[0]) ? solo.map(([sp, l]) => S.makeCreature(sp, l)) : solo ? Array.from({ length: solo[3] || 1 }, () => Object.assign(S.makeCreature(solo[0], solo[1]), solo[2] ? { moves: solo[2] } : {})) : [team[lead % team.length], ...team.filter((_, i) => i !== lead % team.length)];
  const a = Math.atan2(g.spawnPoint.x - C.x, g.spawnPoint.z - C.z), dx = Math.sin(a), dz = Math.cos(a);
  const px = C.x + dx * (FIGHT.patch - 0.3), pz = C.z + dz * (FIGHT.patch - 0.3);
  const sx = px - dx * 3.5, sz = pz - dz * 3.5;
  const P = window.__botPatch; // chapter 3 step 5: a Wobbleland patch (its centre, monsters and level step from data)
  const probe = new ScribbleFight({ ground: G, centre: C, squad: squadOf(order), start: { x: sx, y: G.floor(sx, sz, C.y + 4), z: sz }, foes: P?.foes, levelStep: P?.levelStep, hp: P?.hp, attack: P?.attack });
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
    if (f.tell && f.tell.left <= LIVE_TELL && F.seesTell(f) && F.inTell(f.tell, x, y, z, you.r + 0.5)) return true; // (Glowcap Caves: only the warnings it can see; Easy: a faint early warning still follows, so nobody runs from it yet)
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
  if (f.grumble && alive.length === 1) { // chapter 3 step 7: alone with the Grumble: get round to its back (it turns slowly)
    const bx = f.x - Math.sin(f.heading) * 4.2, bz = f.z - Math.cos(f.heading) * 4.2;
    if (walkable(F, you.x, you.z, you.y, you.x + (bx - you.x) * 0.3, you.z + (bz - you.z) * 0.3, 1.2)) return { gx: bx - you.x, gz: bz - you.z };
  }
  const dx = you.x - f.x, dz = you.z - f.z, d = len2(dx, dz) || 1;
  const want = 4.6, push = d < want ? 1 : d > want + 2 ? -0.7 : 0;
  let gx = dx / d * push - dz / d * 0.45, gz = dz / d * push + dx / d * 0.45;
  const L = len2(gx, gz) || 1;
  if (!walkable(F, you.x, you.z, you.y, you.x + gx / L * 1.2, you.z + gz / L * 1.2, 1.4)) { // a wall or the ring: toward the middle instead
    gx = C.x - you.x + dz / d * 2; gz = C.z - you.z - dx / d * 2;
  }
  return { gx, gz };
}
// chapter 3, Slippy Lake: a skilled player on ice who slides (groundrules.js) steers so that where it would glide to if it let go now is
// the safe spot: it lets go early and counter-steers (an Ice creature keeps its grip: nothing to do)
function iceSteer(F, g) {
  const you = F.you, rule = G.rule?.(you.x, you.z, you.y);
  if (!rule || rule.grips(you.type) || !g.flee || F.dash) return g;
  const k = rule.k, gx = g.gx - you.vel.x / k, gz = g.gz - you.vel.z / k, L = Math.hypot(gx, gz);
  return { ...g, gx: L < 0.3 ? 0 : gx, gz: L < 0.3 ? 0 : gz };
}
// its moves (skilled): a clear line for shots, blasts when they are close, a heal when low, a rush only when it is safe
function skilledMoves(F) {
  const you = F.you;
  if (you.hp < you.maxHp * 0.3) { const i = F.squad.findIndex((q, k) => k !== F.lead && q.hp > q.c.level * 1.5); if (i >= 0) F.swap(i); }
  { // the small ones first (the Grumble only takes full hits on its back or right after it struck)
    const small = F.foes.filter(f => f.alive && !f.grumble);
    if (F.target?.grumble && small.length) F.pick(small.sort((p, q) => len2(p.x - you.x, p.z - you.z) - len2(q.x - you.x, q.z - you.z))[0]);
  }
  { // pick a monster it can hit
    const t = F.aimAt();
    if (t && !F.clearShot(F.you, t)) { const o = F.foes.find(f => f.alive && F.clearShot(F.you, f)); if (o) F.pick(o); }
  }
  // a rush at a monster in the last part of its warning cancels its attack (FIGHT.rush): aim one there when a rush is ready
  const win = LIVE_TELL * (FIGHT.rush.window ?? 1);
  // (owner 2026-11-10: only two buttons; Attack and Special each use their group's next move, shown by its icon)
  if (F.charge.slot <= 0) { if (F.held[1]) F.lift(1); if (F.held[2]) F.lift(2); } // a big blast that went by itself: let go of the button
  for (const b of [1, 2]) { // a rush on either button
    const na = F.nextMove(b);
    if (!(na && F.moves[na - 1].kind === 'dash' && F.cd[na] === 0)) continue;
    const w = F.foes.filter(f => f.alive && f.tell && F.seesTell(f) && f.tell.left <= win && f.tell.left > 0.05 && len2(f.x - you.x, f.z - you.z) < 7 && walkable(F, you.x, you.z, you.y, f.x, f.z, 0.5))[0];
    if (w) { F.pick(w); F.push(b); F.lift(b); }
  }
  const t = F.aimAt();
  // a big blast in hand: let go when a monster inside the ring is in the last part of its warning (it is stopped), else at full
  if (F.charge.slot > 0) {
    const k = Math.min(1, F.charge.t / LIVE_FULL), r = F.blastR(k);
    if (k > 0.75 && F.foes.some(f => f.alive && f.tell && f.tell.left <= win && len2(f.x - you.x, f.z - you.z) < r)) { F.lift(1); F.lift(2); }
    return;
  }
  const foeSoon = F.foes.some(f => f.alive && (f.charging || (f.tell && f.tell.left <= LIVE_TELL && F.inTell(f.tell, you.x, you.y, you.z, you.r + 0.3))));
  for (const b of [1, 2]) {
    const i = F.nextMove(b), s = i ? F.moves[i - 1] : null;
    if (!s || F.cd[i] > 0 || !t) continue;
    const d = len2(t.x - you.x, t.z - you.z);
    if (s.kind === 'heal' && (you.hp > you.maxHp * 0.55 || F.foes.some(f => f.alive && (f.tell || f.charging)))) continue; // heal between attacks
    if (s.kind === 'buff' && s.stat === 'def') { // brace just before a hit you cannot step out of
      if (!F.foes.some(f => f.alive && ((f.tell && f.tell.left < 0.45 && F.inTell(f.tell, you.x, you.y, you.z, you.r)) || (f.charging && len2(f.x - you.x, f.z - you.z) < 4)))) continue;
    }
    if ((s.kind === 'bolt' || s.kind === 'volley') && !F.clearShot(you, t)) continue;
    if (t.grumble && s.group !== 'special' && !['heal', 'buff', 'speed', 'cloud', 'sleep'].includes(s.kind) && !(t.openT > 0 || Math.abs(Math.atan2(Math.sin(Math.atan2(you.x - t.x, you.z - t.z) - t.heading), Math.cos(Math.atan2(you.x - t.x, you.z - t.z) - t.heading))) > 1.85)) continue; // only on its weak side
    if (s.kind === 'dash' && (d > 5 || danger(F, t.x, t.z, t.y) || danger(F, you.x, you.z, you.y) || !walkable(F, you.x, you.z, you.y, t.x, t.z, 0.5))) continue;
    if (s.kind === 'burst') { if (!foeSoon && F.foes.some(f => f.alive && len2(f.x - you.x, f.z - you.z) < F.blastR(1) + 1.5)) F.push(b); continue; }
    F.push(b); F.lift(b);
  }
}
// kid: like a child who gets it but is not quick: sees a red warning 0.35 s late and walks out of it (no dodge), keeps a few blocks
// away, presses every move that is ready (no line-of-sight thinking), never swaps by itself
function kidStep(F, dt) {
  const you = F.you;
  F.kid ??= { seen: new Map(), goal: null };
  const now = F.clock;
  for (const f of F.foes) if (f.alive && f.tell && F.seesTell(f) && !F.kid.seen.has(f.tell)) F.kid.seen.set(f.tell, now); // (Glowcap Caves: from when it can see it)
  const late = F.foes.some(f => f.alive && f.tell && F.kid.seen.has(f.tell) && now - F.kid.seen.get(f.tell) > 0.35 && f.tell.left <= LIVE_TELL && F.inTell(f.tell, you.x, you.y, you.z, you.r + 0.3));
  let g = { gx: 0, gz: 0 };
  if (late) { const s = skilledGoal(F); g = { gx: s.gx, gz: s.gz }; }
  else { const s = skilledGoal(F); if (!s.flee) g = s; }
  F.input.mx = g.gx; F.input.mz = g.gz;
  // (a big blast: it holds the button until the ring is full, then it goes by itself)
  if (F.charge.slot <= 0) { if (F.held[1]) F.lift(1); if (F.held[2]) F.lift(2); }
  if (F.charge.slot <= 0) for (const b of [1, 2]) { const i = F.nextMove(b), s = i ? F.moves[i - 1] : null; if (!s || F.cd[i] > 0) continue; if (s.kind === 'heal' && you.hp > you.maxHp * 0.5) continue; F.push(b); if (s.kind !== 'burst') F.lift(b); }
  F.step(dt);
}
// person (step 3, night run): closer to a real child on a tablet than the kid: sees a warning 0.3-0.6 s late, walks out of it with a
// wobbly thumb (up to 35 degrees off), dodges only half the time when it is late, taps a move about every 0.4-1.1 s (one at a time, a
// shot whether or not a hill is in the way), holds a big blast 0.5-1.1 s, now and then taps another monster, heals under 40 %, swaps a
// tired creature only sometimes. Its numbers: seeded per fight, so a run is the same at 60 and 20 fps.
function personStep(F, dt) {
  const you = F.you;
  if (!F.ps) { let seed = 1234 + (F.foes[0].x * 1000 | 0); const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); F.ps = { r, seen: new Map(), next: 0.6, wob: 0, wobT: 0, hold: 0, dodgeLate: r() < 0.5 }; }
  const P = F.ps, now = F.clock;
  for (const f of F.foes) if (f.alive && f.tell && F.seesTell(f) && !P.seen.has(f.tell)) P.seen.set(f.tell, now + 0.3 + P.r() * 0.3); // (Glowcap Caves: from when it can see it)
  const lateNow = F.foes.some(f => f.alive && f.tell && P.seen.has(f.tell) && now > P.seen.get(f.tell) && f.tell.left <= LIVE_TELL && F.inTell(f.tell, you.x, you.y, you.z, you.r + 0.3));
  if ((P.wobT -= dt) <= 0) { P.wobT = 0.4 + P.r() * 0.6; P.wob = (P.r() - 0.5) * 1.2; }
  const s = skilledGoal(F);
  let gx = 0, gz = 0;
  if (lateNow || !s.flee) { const c = Math.cos(P.wob), sn = Math.sin(P.wob); gx = s.gx * c - s.gz * sn; gz = s.gz * c + s.gx * sn; }
  if (lateNow && F.cd[0] === 0 && F.foes.some(f => f.alive && f.tell && f.tell.left < 0.25) && P.r() < dt * 30 * 0.5) F.push(0);
  F.input.mx = gx; F.input.mz = gz;
  if (F.charge.slot > 0) { if ((P.hold -= dt) <= 0) { F.lift(1); F.lift(2); } F.step(dt); return; }
  if (F.held[1]) F.lift(1);
  if (F.held[2]) F.lift(2);
  if (you.hp < you.maxHp * 0.25 && P.r() < dt * 0.6) { const i = F.squad.findIndex((q, k) => k !== F.lead && q.hp > 0); if (i >= 0) F.swap(i); }
  if ((P.next -= dt) <= 0) {
    P.next = 0.4 + P.r() * 0.7;
    if (P.r() < 0.15) { const o = F.foes.filter(f => f.alive); F.pick(o[Math.floor(P.r() * o.length)]); }
    const next = b => { const i = F.nextMove(b); return i && F.cd[i] === 0 ? F.moves[i - 1] : null; };
    const ready = [1, 2].filter(b => next(b) && !(next(b).kind === 'heal' && you.hp > you.maxHp * 0.4));
    if (ready.length) { const b = ready[Math.floor(P.r() * ready.length)], s = next(b); F.push(b); if (s.kind === 'burst') P.hold = 0.5 + P.r() * 0.6; else F.lift(b); }
  }
  F.step(dt);
}
const BOT = {
  kid: kidStep,
  person: personStep,
  naive(F, dt) {
    for (const b of [1, 2]) { F.push(b); F.lift(b); }
    F.input.mx = F.input.mz = 0;
    F.step(dt);
  },
  skilled(F, dt) {
    const goal = iceSteer(F, skilledGoal(F));
    F.input.mx = goal.gx; F.input.mz = goal.gz;
    if (goal.dodge && F.cd[0] === 0) F.push(0);
    skilledMoves(F);
    F.step(dt);
  },
};
// what a child sees behind its creature (FightCam): the share of moments a monster / a red warning / your creature is on screen,
// and the camera's jumps (a move of more than 0.6 blocks in 1/60 s) and moments with a block between camera and creature
const CAMS = {
  old: { up: 8.5 * Math.sin(0.78), back: 8.5 * Math.cos(0.78), fov: 75, ahead: 1.6, turn: false }, // the first try (turned with your look; the bots never turn it)
  steep: { up: 13.5, back: 7, turn: false }, // the night run's: 62 degrees, never turning
  flat: { turn: false },                     // today's angle (about 57 degrees), never turning
  new: {},                                   // today's: about 57 degrees, a slow turn toward the monsters
};
function camWatch(F, which, aspect) {
  const cam = new FightCam(CAMS[which]), you = F.you;
  cam.start(F.me.yaw, you.x, you.y, you.z);
  const w = { n: 0, foe: 0, foeN: 0, tell: 0, tellN: 0, you: 0, jumps: 0, hidden: 0, turn: 0, t: 0, last: null, aspect };
  w.tick = dt => {
    w.t += dt; const y0 = cam.yaw, p = cam.update(dt, F.you, F.me.yaw, aspect, G, false, foesMiddle(F)); w.turn += Math.abs(Math.atan2(Math.sin(cam.yaw - y0), Math.cos(cam.yaw - y0)));
    const inS = q => q && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95;
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
  w.out = () => ({ cam: which, aspect: +aspect.toFixed(2), foe: Math.round(100 * w.foe / Math.max(1, w.foeN)), tell: Math.round(100 * w.tell / Math.max(1, w.tellN)), you: Math.round(100 * w.you / Math.max(1, w.n)), jumps: w.jumps, turnPerMin: Math.round(w.turn * 180 / Math.PI / Math.max(1, w.t) * 60), hidden: Math.round(100 * w.hidden / Math.max(1, w.n)) });
  return w;
}
window.__scribbleBots = { newFight, BOT, camWatch };
`;

export async function play(page, bot, { fps = 60, lead = 0, limit = 150, solo = null, cams = null, power = null, patch = null } = {}) {
  return page.evaluate(async ({ BOTS, bot, fps, lead, limit, solo, cams, power, patch }) => {
    if (patch != null) { const SF = await import('/src/scribblefight.js'), q = window.pokecraft.world.wobble.patches.find(r => r.id === patch); window.__botPatch = SF.patchFight(q, q.y); } else window.__botPatch = null;
    if (!window.__scribbleBots) await eval(`(async () => { ${BOTS} })()`);
    const { newFight, BOT, camWatch } = window.__scribbleBots, S = await import('/src/species.js');
    const F = newFight(lead, solo), dt = 1 / fps;
    if (power) for (const m of F.squad) m.c.livePower = power; // (measurements: every attack at the same power, see liveShape)
    if (power) F.moves.forEach(m => { if (m?.power) m.power = power; });
    const W = (cams || []).map(([c, a]) => camWatch(F, c, a));
    for (let t = 0; t < limit && !F.over; t += dt) { BOT[bot](F, dt); for (const w of W) w.tick(dt); }
    return { won: F.won, time: Math.round(F.clock), left: F.foes.filter(f => f.alive).length, team: F.squad.filter((m, i) => (i === F.lead ? F.you.hp : m.hp) > 0).length, dodged: F.stats.dodged,
      hp: Math.round(100 * F.you.hp / F.you.maxHp), foeHp: Math.round(100 * F.foes.reduce((a, f) => a + Math.max(0, f.hp), 0) / F.foes.reduce((a, f) => a + f.maxHp, 0)),
      byKind: F.stats.byKind, hitBy: F.stats.hitBy, takenPerMin: Math.round(F.stats.taken / Math.max(1, F.clock) * 60 / F.squad.reduce((a, m) => a + S.statsFor(m.c).maxHp, 0) * 100), extra: { braced: F.stats.braced || 0, spoilt: F.stats.spoilt || 0, buffLost: F.stats.buffLost || 0 }, snapsPerMin: Math.round(F.stats.snaps / Math.max(1, F.clock) * 60), blocked: +(F.stats.blocked / Math.max(1, F.clock)).toFixed(2), ...(W.length ? { cams: W.map(w => w.out()) } : {}) };
  }, { BOTS, bot, fps, lead, limit, solo, cams, power, patch });
}

export const RUNS = [['naive', 60], ['naive', 20], ['skilled', 60], ['skilled', 20]];

// -> { lines, fails }
export async function runBots(page, games = 4, log = console.log) {
  let fails = 0;
  const lines = [];
  // mashing is judged over many fights (owner 2026-11-10: with two buttons it wins about 1 fight in 10; four fights were too few to tell
  // that from a quarter): NAIVE_GAMES at each frame rate, all together under a quarter. (It used to win 3x as often at 20 fps: the
  // monsters' first attacks were at fixed times, see FIGHT.firstJitter; now both frame rates win about the same.)
  const naive = [];
  for (const [bot, fps] of RUNS) {
    const runs = [], n = bot === 'naive' ? Math.max(games, NAIVE_GAMES) : games;
    for (let g = 0; g < n; g++) runs.push(await play(page, bot, { fps, lead: bot === 'naive' ? g % 3 : g })); // (naive: see MATCHED)
    const wins = runs.filter(r => r.won).length;
    if (bot === 'naive') { naive.push(...runs); const line = `info naive @${fps}: ${wins}/${n} won`; lines.push(line); log(line); continue; }
    const ok = wins === games;
    if (!ok) fails++;
    const line = `${ok ? 'ok  ' : 'FAIL'} ${bot} @${fps}: ${wins}/${games} won  ${runs.map(r => JSON.stringify(r)).join(' ')}`;
    lines.push(line); log(line);
  }
  { const w = naive.filter(r => r.won).length, ok = w <= Math.floor(naive.length / 4);
    if (!ok) fails++;
    const line = `${ok ? 'ok  ' : 'FAIL'} naive (mashing) at 60 and 20 fps: ${w}/${naive.length} won (under a quarter)`; lines.push(line); log(line); }
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
export const NAIVE_GAMES = 12;
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
  await pageLevel(page);
  return page;
}
export const SEEDS = [1, 22, 122];
// PC_DIFFICULTY=easy|hard (run.mjs sets it for Node): the page's fights play at that level too (difficulty.js `scribble`)
export async function pageLevel(page, id = process.env.PC_DIFFICULTY) {
  if (id) await page.evaluate(async id => (await import('/src/difficulty.js')).setDifficulty(id), id);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server, base } = await serve();
  const browser = await launch();
  let fails = 0;
  for (const seed of process.env.SCRIBBLE_SEED ? [+process.env.SCRIBBLE_SEED] : SEEDS) {
    const page = await scribblePage(browser, base, { seed });
    if (process.env.SCRIBBLE_TUNE) await page.evaluate(async t => { const M = await import('/src/scribblefight.js'), deep = (o, v) => { for (const [k, x] of Object.entries(v)) if (x && typeof x === 'object' && o[k] && typeof o[k] === 'object') deep(o[k], x); else o[k] = x; }; deep(M.FIGHT, JSON.parse(t)); }, process.env.SCRIBBLE_TUNE); // (deep: '{"kinds":{"dash":{"hit":2}}}')
    const spot = await page.evaluate(() => window.pokecraft.scribble.info().spot);
    console.log(`seed ${seed}: patch`, JSON.stringify(spot));
    fails += (await runBots(page, +process.env.SCRIBBLE_GAMES || 4)).fails;
    if (page.errors.length) { console.log('errors', page.errors); fails++; }
    await page.context().close();
  }
  await browser.close(); server.close();
  process.exit(fails ? 1 : 0);
}
