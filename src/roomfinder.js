// T22: the room finder (plans/T22.md section 2). Knows no home type. findRoom(world, mx, f, mz) looks at the room around
// a Doormat at (mx, f, mz), f = the floor level, and returns a plain report:
// { found, mat, f, escaped, inside: [[x, z]], box, size: [w, d] | null, door: [[x, z]] | null, doorRuns, roofLevel,
//   holes: { wall: [[x, y, z]], roof, floor }, counts: { floor, inside, wall, roof } ({ [id]: n }), wallTotal,
//   checks: { walls, roof, size: 'ok' | 'small' | null, floor }, ok }
import { B, isSolid } from './blocks.js';

const MAX_SIDE = 20;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AROUND = [...DIRS, [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function findRoom(world, mx, f, mz) {
  const k = (x, z) => `${x},${z}`;
  const plugs = new Set(); // virtual blocks at L3 (the leak finder's plugs)
  const L1 = f + 1, L2 = f + 2, L3 = f + 3;
  const solid = (x, y, z) => isSolid(world.get(x, y, z));
  const open3 = (x, z) => !plugs.has(k(x, z)) && !solid(x, L3, z);
  const report = {
    found: false, mat: [mx, f, mz], f, escaped: false, inside: [], box: { x0: mx, x1: mx, z0: mz, z1: mz }, size: null,
    door: null, doorRuns: 0, roofLevel: f + 4,
    holes: { wall: [], roof: [], floor: [] },
    counts: { floor: {}, inside: {}, wall: {}, roof: {} }, wallTotal: 0,
    checks: { walls: false, roof: null, size: null, floor: null },
    ok: false,
  };

  // 4-neighbour flood over columns whose L3 cell is open, stopping when the room gets wider or deeper than 20.
  const flood = (sx, sz) => {
    const seen = new Map([[k(sx, sz), null]]);
    const order = [[sx, sz]];
    const box = { x0: sx, x1: sx, z0: sz, z1: sz };
    for (let i = 0; i < order.length; i++) {
      const [x, z] = order[i];
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz, key = k(nx, nz);
        if (seen.has(key) || !world.inBounds(nx, L3, nz) || !open3(nx, nz)) continue;
        seen.set(key, k(x, z));
        order.push([nx, nz]);
        const b = { x0: Math.min(box.x0, nx), x1: Math.max(box.x1, nx), z0: Math.min(box.z0, nz), z1: Math.max(box.z1, nz) };
        if (b.x1 - b.x0 + 1 > MAX_SIDE || b.z1 - b.z0 + 1 > MAX_SIDE) return { order, seen, box, escaped: true, esc: key };
        Object.assign(box, b);
      }
    }
    return { order, seen, box, escaped: false };
  };

  // 1. Start: the mat column, or (mat in a doorway under the lintel) the first neighbour that is open above.
  const starts = open3(mx, mz) ? [[mx, mz]] : DIRS.map(([dx, dz]) => [mx + dx, mz + dz]).filter(([x, z]) => open3(x, z));
  if (!starts.length) return report;
  let start = starts[0], fl = null;
  for (const st of starts) {
    const r = flood(st[0], st[1]);
    if (!fl) { fl = r; start = st; }
    if (!r.escaped) { fl = r; start = st; break; }
  }

  // 3. Leak finder: plug the first neck on the path to the escape, flood again (at most 4 rounds).
  for (let round = 0; round < 4 && fl.escaped; round++) {
    const path = [];
    for (let c = fl.esc; c != null; c = fl.seen.get(c)) path.unshift(c);
    let plug = null;
    for (let i = 1; i < path.length && !plug; i++) {
      const [cx, cz] = path[i].split(',').map(Number), [px] = path[i - 1].split(',').map(Number);
      const [qx, qz] = cx !== px ? [0, 1] : [1, 0]; // perpendicular to the step into c
      let ok = true, total = 1;
      for (const sgn of [1, -1]) {
        let n = 0;
        while (n <= 3 && open3(cx + sgn * qx * (n + 1), cz + sgn * qz * (n + 1))) n++;
        if (n > 2) ok = false; // no solid block within reach
        total += n;
      }
      if (ok && total <= 3) plug = [cx, cz];
    }
    if (!plug) break;
    plugs.add(k(plug[0], plug[1]));
    report.holes.wall.push([plug[0], L3, plug[1]]);
    fl = flood(start[0], start[1]);
  }
  report.found = true;
  report.escaped = fl.escaped;
  report.inside = fl.order.map(([x, z]) => [x, z]);
  report.box = fl.box;
  if (fl.escaped) return report; // walls not closed, or too big: size / roof / floor stay null ("?")

  const inside = new Set(fl.order.map(([x, z]) => k(x, z)));

  // 4. Ring: every 8-neighbour of an inside column that is not inside.
  const ring = new Map();
  for (const [x, z] of fl.order) for (const [dx, dz] of AROUND) { const nx = x + dx, nz = z + dz; if (!inside.has(k(nx, nz))) ring.set(k(nx, nz), [nx, nz]); }
  const doorLike = new Set();
  for (const [key, [x, z]] of ring) {
    const o1 = !solid(x, L1, z), o2 = !solid(x, L2, z);
    if (open3(x, z)) { for (const y of [L1, L2, L3]) if (!solid(x, y, z)) report.holes.wall.push([x, y, z]); }
    else if (o1 && o2) {
      if (DIRS.some(([dx, dz]) => inside.has(k(x + dx, z + dz)))) doorLike.add(key);
      else report.holes.wall.push([x, L1, z], [x, L2, z]);
    } else if (o1 || o2) report.holes.wall.push([x, o1 ? L1 : L2, z]);
  }
  // Door-like columns group into 4-connected runs; runs of 1-2 are door candidates, the one nearest the mat is the door.
  const runs = [], left = new Set(doorLike);
  for (const key of doorLike) {
    if (!left.has(key)) continue;
    const run = [], stack = [key];
    left.delete(key);
    while (stack.length) {
      const c = stack.pop();
      run.push(c);
      const [x, z] = c.split(',').map(Number);
      for (const [dx, dz] of DIRS) { const n = k(x + dx, z + dz); if (left.delete(n)) stack.push(n); }
    }
    runs.push(run.map(c => c.split(',').map(Number)));
  }
  report.doorRuns = runs.length;
  const dist = run => Math.min(...run.map(([x, z]) => Math.hypot(x - mx, z - mz)));
  const door = runs.filter(r => r.length <= 2).sort((a, b) => dist(a) - dist(b))[0] ?? null;
  report.door = door;
  for (const run of runs) if (run !== door) for (const [x, z] of run) report.holes.wall.push([x, L1, z], [x, L2, z]);

  // 5. Roof: the lowest solid block from f+4 up to f+12 over each inside column.
  const roofY = new Map();
  for (const [x, z] of fl.order) {
    for (let y = f + 4; y <= f + 12; y++) if (solid(x, y, z)) { roofY.set(k(x, z), y); break; }
  }
  const tally = {};
  for (const y of roofY.values()) tally[y] = (tally[y] || 0) + 1;
  let best = f + 4, bestN = 0;
  for (const [y, n] of Object.entries(tally)) if (n > bestN || (n === bestN && Number(y) < best)) { best = Number(y); bestN = n; }
  report.roofLevel = best;
  for (const [x, z] of fl.order) if (!roofY.has(k(x, z))) report.holes.roof.push([x, best, z]);

  // 6. Floor.
  for (const [x, z] of fl.order) if (!solid(x, f, z)) report.holes.floor.push([x, f, z]);

  // 7. Size (door columns are ring columns, so they are not in the box).
  const w = fl.box.x1 - fl.box.x0 + 1, d = fl.box.z1 - fl.box.z0 + 1;
  report.size = [w, d];

  // 8. Zones.
  const add = (zone, id) => { if (id !== B.AIR) report.counts[zone][id] = (report.counts[zone][id] || 0) + 1; };
  for (const [x, z] of fl.order) {
    add('floor', world.get(x, f, z));
    const ry = roofY.get(k(x, z));
    for (let y = L1; y < (ry ?? best); y++) add('inside', world.get(x, y, z));
    if (ry != null) add('roof', world.get(x, ry, z));
  }
  for (const [x, z] of ring.values()) {
    for (let y = L1; y <= Math.max(L3, best - 1); y++) {
      const id = world.get(x, y, z);
      if (id !== B.AIR) { add('wall', id); report.wallTotal++; }
    }
  }

  const c = report.checks;
  c.walls = !report.holes.wall.length && !!door;
  c.roof = report.holes.roof.length === 0;
  c.size = w < 8 || d < 8 ? 'small' : 'ok';
  c.floor = report.holes.floor.length === 0;
  report.ok = c.walls && c.roof && c.size === 'ok' && c.floor;
  return report;
}
