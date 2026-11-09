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
const { ScribbleFight, groundOf, squadOf, follow, FIGHT } = await import('/src/scribblefight.js');
const S = await import('/src/species.js');
const g = window.pokecraft, C = g.scribble.spot, G = groundOf(g.world);
const len2 = Math.hypot;
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0; return len2(px - ax - dx * t, pz - az - dz * t); };
const TEAM = [['blazehound', 30], ['tidalord', 30], ['thunderwolf', 30], ['phantomaw', 30]];
// a fight as the game starts it: you at the patch's edge on the side of the start, your creature 3.5 blocks ahead
function newFight(lead) {
  const team = TEAM.map(([s, l]) => S.makeCreature(s, l));
  const order = [team[lead % team.length], ...team.filter((_, i) => i !== lead % team.length)];
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
    for (let k = 0; k < 24; k++) for (const s of [1.2, 2.2, 3.4]) {
      const x = you.x + Math.cos(k * Math.PI / 12) * s, z = you.z + Math.sin(k * Math.PI / 12) * s;
      if (!walkable(F, you.x, you.z, you.y, x, z)) continue;
      const y = G.stand(x, z, you.y, 3);
      if (y == null || danger(F, x, z, y)) continue;
      if (s < bd) { bd = s; best = { x, z }; }
    }
    if (!best) return { gx: 0, gz: 0, flee: true };
    const soon = F.foes.some(f => f.alive && ((f.tell && f.tell.left < 0.22) || f.charging));
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
  const t = F.aimAt();
  for (let i = 1; i <= 4; i++) {
    const s = F.moves[i - 1];
    if (!s || F.cd[i] > 0 || !t) continue;
    const d = len2(t.x - you.x, t.z - you.z);
    if (s.kind === 'heal' && you.hp > you.maxHp * 0.55) continue;
    if ((s.kind === 'bolt' || s.kind === 'volley') && !F.clearShot(you, t)) continue;
    if (s.kind === 'dash' && (d > 5 || danger(F, t.x, t.z, t.y) || danger(F, you.x, you.z, you.y) || !walkable(F, you.x, you.z, you.y, t.x, t.z, 0.5))) continue;
    if (s.kind === 'burst') { if (F.foes.some(f => f.alive && len2(f.x - you.x, f.z - you.z) < 3.4)) { F.press(i); F.step(0.4); F.release(i); } continue; }
    F.press(i); F.release(i);
  }
}
const BOT = {
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
window.__scribbleBots = { newFight, BOT };
`;

export async function play(page, bot, { eyes = false, fps = 60, lead = 0, limit = 150 } = {}) {
  return page.evaluate(async ({ BOTS, bot, eyes, fps, lead, limit }) => {
    if (!window.__scribbleBots) await eval(`(async () => { ${BOTS} })()`);
    const { newFight, BOT } = window.__scribbleBots;
    const F = newFight(lead), dt = 1 / fps;
    for (let t = 0; t < limit && !F.over; t += dt) BOT[bot](F, dt, eyes);
    return { won: F.won, time: Math.round(F.clock), left: F.foes.filter(f => f.alive).length, team: F.squad.filter((m, i) => (i === F.lead ? F.you.hp : m.hp) > 0).length, dodged: F.stats.dodged };
  }, { BOTS, bot, eyes, fps, lead, limit });
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
    for (let g = 0; g < games; g++) runs.push(await play(page, bot, { eyes, fps, lead: g }));
    const wins = runs.filter(r => r.won).length;
    const ok = bot === 'naive' ? wins <= Math.floor(games / 4) : wins === games;
    if (!ok) fails++;
    const line = `${ok ? 'ok  ' : 'FAIL'} ${bot} ${eyes ? 'eyes  ' : 'behind'} @${fps}: ${wins}/${games} won  ${runs.map(r => JSON.stringify(r)).join(' ')}`;
    lines.push(line); log(line);
  }
  return { lines, fails };
}

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
