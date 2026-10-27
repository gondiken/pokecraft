// T45: the Sketchbook's lines (pure, no imports, Node-runnable).
// 1. lineOf(def): a fixed line (the neat bridge a saved line is drawn as on a later visit; doodleland.js LINES).
// 2. Draw! (owner 2026-10-27, "Challenge rework" in plans/T45.md): the child draws the bridge themselves. The pencil draws where you
//    look, a little faster than walking but never more than DRAW.leash ahead of you (you walk on your own line), with limited ink
//    (refilled by star dots, which are also checkpoints), round ink blots and pages that are not the next one, past doodle bees that
//    nibble the line, in the wind, and on the Eraser Hill with Rubber the Eraser coming along the line behind you. Never a fail: a fall,
//    a catch or an empty pencil puffs you back to the last star dot and the line stays up to there.
//    Everything is a function of the inputs and the drawing clock (summed dt, fixed 1/60 s sub-steps): 60 and 20 frames a second draw
//    the same line (spec F).
export const TRACE = { step: 0.5, star: 8 }; // fixed lines: cells every half block; star dots every 8 blocks on race lines (old checkpoints)

// def = { pts: [[x, y, z], ...], kind } -> a line you can ask for a place at any distance along it.
// pts: the line's middle in world x / z, y = the block row of the ink cells (you stand at y + 1). cells: the 2-wide ink cells in order
// of s ({ x, y, z, s }, each cell once, first come first kept); 3 wide since the owner's 2026-10-27 rework (the routes turn sharply).
export function lineOf(def) {
  const pts = def.pts, cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const len = cum[cum.length - 1];
  const seg = s => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; return i; };
  const at = s => {
    s = Math.max(0, Math.min(len, s));
    const i = seg(s), a = pts[i - 1], b = pts[i], k = cum[i] === cum[i - 1] ? 0 : (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  const dirAt = s => { // the heading in x / z (unit)
    const a = at(Math.max(0, s - 0.25)), b = at(Math.min(len, s + 0.25)), dx = b[0] - a[0], dz = b[2] - a[2], m = Math.hypot(dx, dz) || 1;
    return [dx / m, dz / m];
  };
  const cells = [], seen = new Map(); // xz -> rows already used there (a spiral stair passes over the same x / z 8 rows higher)
  for (let s = 0; s <= len + 1e-9; s += TRACE.step) {
    const p = at(s), [tx, tz] = dirAt(s), y = Math.round(p[1]);
    for (const w of [-1, -0.5, 0, 0.5, 1]) { // 3 wide like a drawn line (sharp turns stay joined)
      const x = Math.floor(p[0] - tz * w), z = Math.floor(p[2] + tx * w), key = x + ',' + z, rows = seen.get(key) ?? [];
      if (rows.some(r => Math.abs(r - y) <= 3)) continue;
      rows.push(y); seen.set(key, rows);
      cells.push({ x, y, z, s });
    }
  }
  const stars = [];
  if (def.kind === 'race') for (let s = TRACE.star; s < len - 2; s += TRACE.star) stars.push(s);
  return { pts, len, at, dirAt, cells, stars, kind: def.kind };
}

/* ================================ Draw! ================================ */
export const DRAW = {
  h: 1 / 60, dtMax: 0.25,  // fixed sub-steps; a frame longer than dtMax only counts dtMax (a hiccup never jumps the pencil)
  sample: 0.5,             // a point of the line every half block
  across: [-1, -0.5, 0, 0.5, 1], // the line is 3 blocks wide (samples across, so a diagonal line has no holes)
  head: 2,                 // air needed above the line (you walk on it)
  leash: 5,                // the pencil waits when you are more than this far behind it (in x / z)
  turn: 2.0,               // rad / s: the most the pencil turns toward where you look
  stuckTurn: 3.0,          // owner 2026-10-27 ("the pencil gets stuck at the edge"): a blocked pencil turns this fast, toward any point you look at
  near: 1.0,               // looking at a point this close to the pencil: it keeps its heading
  farAim: 40,              // a view ray that meets the line's floor further than this (or never) does not steer
  fence: 1,                // other pages (not the one you leave or the next one), grown by this: the pencil cannot draw there
  roam: 10,                // how far round the two pages the pencil may wander
  blotPad: 1.0,            // a blot of radius r stops the pencil within r + blotPad (the line is 3 wide)
  starR: 1.5, starDy: 4,   // a star dot is taken within 1.5 blocks (x / z) and 4 rows
  beeR: 1.3, nibble: 3, beeRest: 1.5, // a bee touching the pencil tip nibbles up to 3 blocks of line (never where you stand), then rests 1.5 s
  dry: 1.2,                // out of ink for this long: back to the last star
  lowInk: 3,
  fallDrop: 2.5,           // 2.5 below the line where you last stood = you fell off
  onLine: [2.0, 1.3],      // you stand on your line within 2 blocks (x / z) and 1.3 (y) of one of its points
  rubberDelay: 2.5, rubberWin: 0.15, rubberCap: 4.2, catchGap: 0.4,
  gust: [0.5, 0.8, 5],     // wind x (0.5 + 0.8 sin(2 pi t / 5)), never below 0.1: calm, then a gust 1.3 x the wind to lean against
};

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const inRect = (r, x, z, m = 0) => x >= r[0] - m && x < r[1] + 1 + m && z >= r[2] - m && z < r[3] + 1 + m; // r = [x0, x1, z0, z1] inclusive cells
export const beeAt = (b, t) => { const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / b.T + (b.phase || 0))); return [b.a[0] + (b.b[0] - b.a[0]) * k, b.a[1] + (b.b[1] - b.a[1]) * k]; };
export const gustAt = t => Math.max(0.1, DRAW.gust[0] + DRAW.gust[1] * Math.sin(2 * Math.PI * t / DRAW.gust[2]));
export const rubberSpeed = (course, wins = 0) => (course.rubber ? Math.min(DRAW.rubberCap, course.rubber + DRAW.rubberWin * wins) : 0);

// A fresh try at a course (doodleland.js courseOf: { n, rowA, rowB, flatA, target, start: [x, z], dir: [dx, dz], pad: [x, y, z],
// speed, ink, climb, rubber, wind, stars, blots, bees, fence, roam }).
export function newDraw(course, wins = 0) {
  const h = Math.atan2(course.dir[1], course.dir[0]);
  const first = { x: course.start[0], z: course.start[1], row: course.rowA, h, s: 0, climbAcc: 0, off: false };
  const st = {
    course, wins, clock: 0, acc: 0, tip: { ...first }, s: 0, since: 0, ink: course.ink, pts: [first], cells: new Map(),
    taken: new Set(), ckpt: null, rubber: course.rubber ? { s: 0, wait: DRAW.rubberDelay, on: false } : null,
    setbacks: 0, nibbles: 0, events: [], done: false, blocked: null, dryFor: 0, waiting: false, playerS: 0, playerRow: course.rowA,
    beeRest: course.bees.map(() => 0), aim: null, started: false,
  };
  st.ckpt = snap(st, course.pad);
  addCells(st, first);
  return st;
}
const snap = (st, stand) => ({ s: st.s, ink: st.ink, n: st.pts.length, stand });

// The cells under one point of the line (only air or our own ink becomes ink; the pages' grass stays grass).
function addCells(st, p) {
  const c = st.course, nx = -Math.sin(p.h), nz = Math.cos(p.h);
  for (const w of DRAW.across) {
    const x = Math.floor(p.x + nx * w), z = Math.floor(p.z + nz * w), key = `${x},${p.row},${z}`;
    if (st.cells.has(key)) continue;
    if (c.solid(x, p.row, z)) continue; // a page under the line (the start and the end)
    st.cells.set(key, { x, y: p.row, z, s: p.s });
  }
}

// Why the pencil may not be at (x, z) on `row` with heading h: null = it may.
export function blockedAt(st, x, z, row, h) {
  const c = st.course;
  if (!inRect(c.roam, x, z)) return 'edge';
  for (const r of c.fence) if (inRect(r, x, z, DRAW.fence)) return 'page';
  for (const b of c.blots) if (Math.hypot(x - b.x, z - b.z) < b.r + DRAW.blotPad) return 'blot';
  const nx = -Math.sin(h), nz = Math.cos(h);
  for (const w of DRAW.across) {
    const cx = Math.floor(x + nx * w), cz = Math.floor(z + nz * w), own = st.cells.has(`${cx},${row},${cz}`);
    const floorOk = own || !c.solid(cx, row, cz) || (row === c.rowA && inRect(c.fromRect, cx, cz)) || (row === c.rowB && inRect(c.target, cx, cz));
    if (!floorOk) return inRect(c.target, cx, cz) || c.tower ? 'low' : c.toRect && inRect(c.toRect, cx, cz) ? 'land' : 'solid'; // 'low': the next page (or the tower) is still above the line; 'land': the next page, but not its landing strip
    for (let k = 1; k <= DRAW.head; k++) if (c.solid(cx, row + k, cz)) return c.tower ? 'low' : 'solid'; // round the tower it is always 'go round and climb'
  }
  return null;
}
export const inTarget = (c, x, z, row) => row >= c.rowB && inRect(c.target, x, z);

// Where the view ray meets the line's floor (row + 1) beyond the pencil, or null: then the pencil keeps its heading. Looking at the
// pencil, short of it (at your feet, where you walk) or up at the sky never turns it: you look past the pencil to steer.
// Owner 2026-10-27: a pencil that is stuck (st.blocked: an edge, a page, the side of an island) also follows a point short of it, so you
// can turn it back the way you came (before, it could only turn toward points beyond it and stayed stuck facing the edge).
export function aimPoint(st, eye, dir, player) {
  const t = st.tip, y = Math.min(t.row + 1, eye[1] - 0.6); // (owner 2026-10-27: a climbing line's tip can be above your eyes: then aim at a level just below them, else no look could steer it)
  if (dir[1] >= -0.02) return null;
  const k = (y - eye[1]) / dir[1];
  if (!(k > 0 && k < DRAW.farAim)) return null;
  const P = [eye[0] + dir[0] * k, eye[2] + dir[2] * k];
  const tx = t.x - player[0], tz = t.z - player[2], tl = Math.hypot(tx, tz);
  if (!st.blocked && Math.hypot(P[0] - player[0], P[1] - player[2]) < tl - 0.5) return null; // nearer to you than the pencil: you look where you walk
  return P;
}

// Back along the line to distance s (a nibble or a setback): later points and cells go.
function backTo(st, s) {
  while (st.pts.length > 1 && st.pts[st.pts.length - 1].s > s + 1e-9) st.pts.pop();
  const p = st.pts[st.pts.length - 1];
  st.tip = { ...p }; st.s = p.s; st.since = 0;
  for (const [k, cell] of st.cells) if (cell.s > p.s + 1e-9) st.cells.delete(k);
}
function setback(st, reason, extra = {}) {
  const k = st.ckpt;
  st.pts.length = Math.max(1, Math.min(st.pts.length, k.n));
  backTo(st, k.s);
  st.ink = k.ink; st.dryFor = 0; st.playerS = k.s; st.playerRow = st.tip.row;
  if (st.rubber) { st.rubber.s = k.s; st.rubber.wait = DRAW.rubberDelay; st.rubber.on = false; }
  st.setbacks++;
  st.events.push({ kind: 'back', reason, stand: k.stand ?? [st.tip.x, st.tip.row + 1, st.tip.z], ...extra });
}

// Is this cell of the line ink now? (Rubber rubs what lies between the last star and himself.)
export const cellInk = (st, cell) => !(st.rubber && st.rubber.on && !st.done && cell.s > st.ckpt.s + 1e-9 && cell.s < st.rubber.s);

// Advance by dt. inp = { eye: [x, y, z], dir: [x, y, z] (unit), player: [x, y, z] (feet) }. Events of this step are in st.events.
export function drawStep(st, dt, inp) {
  st.events = [];
  if (st.done) return st;
  const c = st.course;
  // where you stand on your line (the nearest point under your feet), and falling off it
  let best = null, bd = Infinity;
  for (const p of st.pts) {
    const d = Math.hypot(p.x - inp.player[0], p.z - inp.player[2]);
    if (d < DRAW.onLine[0] && Math.abs(inp.player[1] - (p.row + 1)) <= DRAW.onLine[1] && d < bd) { bd = d; best = p; }
  }
  if (best) { st.playerS = best.s; st.playerRow = best.row; }
  if (inp.player[1] < st.playerRow + 1 - DRAW.fallDrop) { setback(st, st.s - st.playerS < 1.5 ? 'overrun' : 'fell'); return st; }
  st.acc += Math.min(Math.max(dt, 0), DRAW.dtMax);
  while (st.acc >= DRAW.h - 1e-9 && !st.done) { st.acc -= DRAW.h; sub(st, inp); if (st.events.some(e => e.kind === 'back')) { st.acc = 0; break; } }
  return st;
}

function sub(st, inp) {
  const c = st.course, h = DRAW.h, t = st.tip;
  st.clock += h;
  // 1. steer toward where you look
  const P = aimPoint(st, inp.eye, inp.dir, inp.player);
  st.aim = P;
  const dx = P ? P[0] - t.x : 0, dz = P ? P[1] - t.z : 0;
  if (P && Math.hypot(dx, dz) > DRAW.near) { const d = wrap(Math.atan2(dz, dx) - t.h), m = (st.blocked ? DRAW.stuckTurn : DRAW.turn) * h; t.h = wrap(t.h + Math.max(-m, Math.min(m, d))); }
  // 2. move (only while you are close behind and there is ink)
  st.waiting = Math.hypot(t.x - inp.player[0], t.z - inp.player[2]) > DRAW.leash;
  st.blocked = null;
  if (!st.waiting) {
    if (st.ink <= 0) st.dryFor += h;
    else {
      const g = gustAt(st.clock), vx = Math.cos(t.h) * c.speed + (c.wind?.[0] || 0) * g, vz = Math.sin(t.h) * c.speed + (c.wind?.[1] || 0) * g;
      const nx = t.x + vx * h, nz = t.z + vz * h, step = Math.hypot(vx, vz) * h;
      const why = inTarget(c, nx, nz, t.row) ? null : blockedAt(st, nx, nz, t.row, t.h);
      if (why) st.blocked = why;
      else {
        t.x = nx; t.z = nz; st.s += step; st.ink = Math.max(0, st.ink - step); st.since += step;
        if (!t.off && !inRect(c.flatA, t.x, t.z)) t.off = true;
        while (st.since >= DRAW.sample - 1e-9) {
          st.since -= DRAW.sample;
          if (t.off && t.row !== c.rowB) { t.climbAcc += DRAW.sample; const need = c.rowB > t.row ? c.climb : c.climbDown ?? c.climb * 0.75; if (t.climbAcc >= need - 1e-9) { t.climbAcc -= need; t.row += Math.sign(c.rowB - t.row); } }
          const p = { x: t.x, z: t.z, row: t.row, h: t.h, s: st.s, climbAcc: t.climbAcc, off: t.off };
          st.pts.push(p); addCells(st, p);
        }
        if (inTarget(c, t.x, t.z, t.row)) {
          const p = { x: t.x, z: t.z, row: t.row, h: t.h, s: st.s, climbAcc: t.climbAcc, off: t.off };
          st.pts.push(p); addCells(st, p);
          st.done = true; st.events.push({ kind: 'done' }); return;
        }
      }
    }
  }
  // 3. star dots: full ink, and the line is safe up to here
  c.stars.forEach((sd, i) => {
    if (st.taken.has(i) || Math.hypot(t.x - sd.x, t.z - sd.z) > DRAW.starR || Math.abs(t.row + 1 - sd.y) > DRAW.starDy) return;
    st.taken.add(i); st.ink = c.ink; st.dryFor = 0;
    const p = { x: t.x, z: t.z, row: t.row, h: t.h, s: st.s, climbAcc: t.climbAcc, off: t.off };
    if (st.pts[st.pts.length - 1].s < st.s - 1e-9) { st.pts.push(p); addCells(st, p); }
    st.ckpt = snap(st, [t.x, t.row + 1, t.z]);
    st.events.push({ kind: 'star', i });
  });
  // 4. doodle bees nibble the line at the pencil
  c.bees.forEach((b, i) => {
    if (st.beeRest[i] > 0) { st.beeRest[i] -= h; return; }
    const [bx, bz] = beeAt(b, st.clock);
    if (Math.hypot(t.x - bx, t.z - bz) > DRAW.beeR) return;
    st.beeRest[i] = DRAW.beeRest; st.nibbles++;
    backTo(st, Math.max(st.ckpt.s, st.s - DRAW.nibble, Math.min(st.s, st.playerS + 1.5))); // never the bit you stand on
    st.events.push({ kind: 'nibble', i });
  });
  // 5. Rubber comes along the line (2.5 s after the first ink, and after every setback)
  const r = st.rubber;
  if (r && !st.started && st.playerS >= 1.5) st.started = true; // he sets off once you walk onto your line
  if (r && st.started) {
    if (r.wait > 0) r.wait -= h;
    else {
      if (!r.on) { r.on = true; st.events.push({ kind: 'rubber' }); } // he sets off (a warning sound and a toast)
      r.s = Math.min(r.s + rubberSpeed(c, st.wins) * h, st.s);
      if (r.s >= Math.min(st.playerS, st.s) - DRAW.catchGap) return setback(st, 'caught');
    }
  }
  // 6. out of ink for a while
  if (st.dryFor >= DRAW.dry) setback(st, 'dry');
}

// The place on the drawn line at distance s (for Rubber and the tests).
export function pointAt(st, s) {
  const pts = st.pts;
  let i = 1; while (i < pts.length - 1 && pts[i].s < s) i++;
  if (pts.length < 2) return [pts[0].x, pts[0].row, pts[0].z, pts[0].h];
  const a = pts[i - 1], b = pts[i], k = b.s === a.s ? 0 : Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s)));
  return [a.x + (b.x - a.x) * k, a.row + (b.row - a.row) * k, a.z + (b.z - a.z) * k, b.h];
}
