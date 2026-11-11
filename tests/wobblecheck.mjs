// Chapter 3 step 2 (plans/chapter3-world.md section 10): Wobbleland as terrain, checked in Node on a stand-in world (src/wobbleland.js).
//   - every patch is reachable on foot from Inkpot Camp (steps of one block up, the fight's own ground rule: scribblefight.js groundOf)
//   - every patch's ring (radius RING) is at least 75 % walkable from its middle, dry unless it is a water-twist patch (`wet`)
//   - no patch is inside another (rings never touch), none leaves its region
//   - every region is open (owner 2026-11-11 evening): the whole page is walkable from the Camp, no walls
//   - Glowcap Caves: its rings are wholly inside the cave (the dark), high enough for the fight's camera; skylights lit; the river is water
//   - Slippy Lake: its rings are mostly ice (snow drifts are allowed), no rock or log in a ring; the chutes and leads are where they say
//   node tests/wobblecheck.mjs      (exit 1 on a problem); tests/specs/scribble.mjs part `land` runs it
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const THREE_URL = import.meta.resolve('three');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { return next(s === 'three' ? ${JSON.stringify(THREE_URL)} : s, c); }`));

export async function checkWobble() {
  const { B } = await import('../src/blocks.js');
  const L = await import('../src/wobbleland.js');
  const { groundOf } = await import('../src/scribblefight.js');
  const W = L.SIZE, D = L.SIZE, H = 48;
  const w = { W, D, H, data: new Uint8Array(W * D * H), ground: new Uint8Array(W * D), index: (x, y, z) => x + W * (z + D * y),
    inBounds: (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < H };
  w.get = (x, y, z) => (w.inBounds(x, y, z) ? w.data[w.index(x, y, z)] : B.AIR);
  L.wobbleLand(w, { id: 'wobble', size: [W, D] });
  const G = groundOf(w), problems = [], out = { rings: [] };
  // a walk over cells (x, z, y = where you stand): the fight's stand rule (one block up, any drop up to 14)
  const key = (x, z, y) => `${x},${z},${y}`;
  function walk(x0, z0, y0, inside = () => true) {
    const seen = new Map(), todo = [[x0, z0, y0]];
    seen.set(`${x0},${z0}`, y0);
    while (todo.length) {
      const [x, z, y] = todo.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= D || !inside(nx, nz) || seen.has(`${nx},${nz}`)) continue;
        const ny = G.stand(nx + 0.5, nz + 0.5, y);
        if (ny == null) continue;
        seen.set(`${nx},${nz}`, ny); todo.push([nx, nz, ny]);
      }
    }
    return seen;
  }
  const a = w.arrivals.wobble, from = walk(Math.floor(a[0]), Math.floor(a[2]), a[1]);
  out.reach = from.size;
  const lakeBox = L.LAKE.box;
  for (const p of L.PATCHES) {
    if (!from.has(`${p.x},${p.z}`)) problems.push(`patch ${p.id} cannot be reached on foot from the Camp`);
    const y = G.stand(p.x + 0.5, p.z + 0.5, L.heightAt(p.x, p.z) + 3);
    const inRing = (x, z) => Math.hypot(x + 0.5 - p.x - 0.5, z + 0.5 - p.z - 0.5) < L.RING - 0.2;
    let n = 0, wet = 0;
    for (let x = p.x - L.RING; x <= p.x + L.RING; x++) for (let z = p.z - L.RING; z <= p.z + L.RING; z++) if (inRing(x, z)) { n++; if (w.get(x, w.ground[x + z * W], z) === B.WATER) wet++; }
    const ring = walk(p.x, p.z, y, inRing), share = ring.size / n;
    out.rings.push({ id: p.id, walk: Math.round(share * 100), wet });
    if (share < 0.75) problems.push(`patch ${p.id}: only ${Math.round(share * 100)} % of its ring is walkable`);
    if (!p.wet && wet) problems.push(`patch ${p.id}: ${wet} cells of water in a dry ring`);
    if (p.wet && wet < 8) problems.push(`patch ${p.id}: a water twist with only ${wet} wet cells`);
    if (p.region === 'meadow' && (p.x - L.RING < L.MEADOW.x0 + 1 || p.x + L.RING > L.MEADOW.x1 - 1 || p.z - L.RING < L.MEADOW.z0 + 1)) problems.push(`patch ${p.id} touches the wall`);
    if (p.region === 'lake') {
      if (p.x - L.RING < lakeBox.x0 || p.x + L.RING > lakeBox.x1 - 1 || p.z - L.RING < lakeBox.z0 + 1 || p.z + L.RING > lakeBox.z1) problems.push(`patch ${p.id} leaves the lake`);
      let ice = 0, all = 0; // the ground decides: a lake ring is on the ice (its holes count as the lake)
      for (let x = p.x - L.RING; x <= p.x + L.RING; x++) for (let z = p.z - L.RING; z <= p.z + L.RING; z++) if (inRing(x, z)) { all++; const b = w.get(x, w.ground[x + z * W], z); if (b === B.ICE || b === B.WATER) ice++; }
      out.rings[out.rings.length - 1].ice = Math.round(100 * ice / all);
      if (ice < all * 0.75) problems.push(`patch ${p.id}: only ${Math.round(100 * ice / all)} % of its ring is ice`);
      for (const [rx, rz, r] of L.ROCKS) if (Math.hypot(rx - p.x, rz - p.z) < L.RING + r + 0.5) problems.push(`patch ${p.id}: a rock at ${rx}, ${rz} in its ring`);
      for (const [lx, lz, n, ax] of L.LOGS) for (let k = 0; k < n; k++) if (Math.hypot((ax ? lx + k : lx) - p.x, (ax ? lz : lz + k) - p.z) < L.RING + 0.5) problems.push(`patch ${p.id}: a log at ${lx}, ${lz} in its ring`);
    }
    if (p.region === 'cave') {
      const box = L.CAVE;
      if (p.x - L.RING < box.x0 + 1 || p.x + L.RING > box.x1 || p.z - L.RING < box.z0 || p.z + L.RING > box.z1) problems.push(`patch ${p.id} leaves Glowcap Caves`);
      let dark = 0, all = 0, low = 0;
      for (let x = p.x - L.RING; x <= p.x + L.RING; x++) for (let z = p.z - L.RING; z <= p.z + L.RING; z++) if (inRing(x, z)) {
        all++; const g = w.ground[x + z * W] + 1;
        if (L.darkIn({ x: x + 0.5, y: g, z: z + 0.5 })) dark++;
        if (box.roof - g < 16) low++; // the fight's camera rises about 13.6 over the creature (scribblefight.js CAM) and tips higher over a hill
      }
      out.rings[out.rings.length - 1].dark = Math.round(100 * dark / all);
      if (dark < all) problems.push(`patch ${p.id}: only ${Math.round(100 * dark / all)} % of its ring is inside the cave`);
      if (low) problems.push(`patch ${p.id}: ${low} cells where the roof is too low for the fight's camera`);
    }
    for (const q of L.PATCHES) if (q.id < p.id && Math.hypot(q.x - p.x, q.z - p.z) < 2 * L.RING + 2) problems.push(`patches ${q.id} and ${p.id} overlap`);
  }
  // every region can be walked into from the Camp (no walls), and the lake is about as big as the meadow
  out.regions = {};
  for (const k of from.keys()) { const [x, z] = k.split(',').map(Number), r = L.regionAt(x, z); out.regions[r] = (out.regions[r] || 0) + 1; }
  for (const r of Object.keys(L.REGIONS)) if (!(out.regions[r] > 1000)) problems.push(`region ${r}: only ${out.regions[r] || 0} cells can be walked from the Camp`);
  if (out.regions.lake < out.regions.meadow * 0.8) problems.push(`Slippy Lake (${out.regions.lake} cells) is much smaller than Puddle Meadow (${out.regions.meadow})`);
  if (out.regions.cave < out.regions.meadow * 0.8) problems.push(`Glowcap Caves (${out.regions.cave} cells) is much smaller than Puddle Meadow (${out.regions.meadow})`);
  // Glowcap Caves: the skylights are lit (no roof), the dark river is water all the way, its banks walkable, the big mushrooms' chests
  // out of a plain jump's reach (only their Bounce Block gets you up)
  for (const c of L.SKYLIGHTS) if (L.darkIn({ x: c.x + 0.5, y: L.BASE + 1, z: c.z + 0.5 })) problems.push(`the skylight at ${c.x}, ${c.z} is dark`);
  { const R = L.CAVE_RIVER; let bad = 0; for (let z = R.z1; z <= R.z0; z++) for (let x = R.x0; x <= R.x1; x++) if (w.get(x, w.ground[x + z * W], z) !== B.WATER || w.get(x, w.ground[x + z * W] + 1, z) !== B.AIR) bad++; if (bad) problems.push(`the dark river has ${bad} cells that are not open water`); }
  for (const m of L.BIG_SHROOMS) { const g = L.heightAt(m.x, m.z); if (m.stalk < 4) problems.push(`the big mushroom at ${m.x}, ${m.z} can be jumped onto`); if (w.get(m.x, g + m.stalk + 2, m.z) !== B.CHEST) problems.push(`the big mushroom at ${m.x}, ${m.z} has no chest`); }
  out.trunks = L.CAVE_PILLARS.length;
  // the chutes: an ice floor going down, stepping at most one block at a time, its top on a hill and its foot at a lead
  for (const c of L.CHUTES) {
    let last = null, bad = 0;
    for (let k = 0; k <= Math.abs(c.z1 - c.z0); k++) { const z = c.z0 + k * c.dir, f = L.chuteFloor(c, z); for (let x = c.x0; x <= c.x1; x++) if (w.get(x, f, z) !== B.ICE || w.get(x, f + 1, z) !== B.AIR) bad++; if (last != null && (last - f > 1 || f > last)) bad++; last = f; }
    if (bad) problems.push(`the chute from ${c.x0}, ${c.z0} has ${bad} bad cells`);
    if (c.from - c.to < 5) problems.push(`the chute from ${c.x0}, ${c.z0} drops only ${c.from - c.to}`);
  }
  for (const l of L.LEADS) {
    let bad = 0;
    for (let k = 0; k <= Math.abs(l.z1 - l.z0); k++) for (let x = l.x0; x <= l.x1; x++) if (w.get(x, L.LAKE.y, l.z0 + k * l.dir) !== B.WATER) bad++;
    const end = l.z1 + l.dir, isle = L.LAKE.isles.find(i => Math.hypot(l.x0 + 1 - i.x - 0.5, end + 0.5 - i.z - 0.5) <= i.r + 0.8);
    if (bad || !isle) problems.push(`the lead from ${l.x0}, ${l.z0}: ${bad} dry cells${isle ? '' : ', and it does not end at an island'}`);
  }
  // A1 (owner 2026-11-11): a packed meadow: from one patch to the nearest other is a short walk (centres 22-32 apart), and the walk
  // from the Camp to the farthest patch along the ground is short too (the lake: the same within the lake)
  for (const p of L.PATCHES) {
    const near = Math.min(...L.PATCHES.filter(q => q !== p && q.region === p.region).map(q => Math.hypot(q.x - p.x, q.z - p.z)));
    if (near > 32) problems.push(`patch ${p.id}: the nearest other patch is ${Math.round(near)} away`);
  }
  out.span = Math.round(Math.max(...L.PATCHES.filter(p => p.region === 'meadow').map(p => Math.hypot(p.x - L.CAMP.x, p.z - L.CAMP.z))));
  if (out.span > 60) problems.push(`the farthest patch is ${out.span} from the Camp`);
  // nothing built (trees, the flower, the house...) stands in a ring or in the Camp: every block above the ground there is air
  for (const p of [...L.PATCHES.map(q => ({ x: q.x, z: q.z, r: L.RING })), { x: L.CAMP.x, z: L.CAMP.z, r: L.CAMP.r - 1, camp: true }]) {
    let n = 0;
    for (let x = p.x - p.r; x <= p.x + p.r; x++) for (let z = p.z - p.r; z <= p.z + p.r; z++) {
      if (Math.hypot(x + 0.5 - p.x - 0.5, z + 0.5 - p.z - 0.5) > p.r || (p.camp && Math.abs(x - L.STAIR.x) <= 3 && z >= L.STAIR.z - 6)) continue;
      for (let y = w.ground[x + z * W] + 1; y < (L.inCave(x, z) ? L.CAVE.roof - 1 : H); y++) if (w.get(x, y, z) !== B.AIR) n++; // (Glowcap Caves: the canopy is the ring's roof)
    }
    if (n) problems.push(`${p.camp ? 'the Camp' : `the ring at ${p.x}, ${p.z}`} has ${n} blocks standing in it`);
  }
  // step 6: a naive kid who only follows the guide arrow (wobbleAim: the nearest patch not cleared yet), walking straight the way it
  // points, jumping up one block when it bumps into a step, sliding along what it cannot climb, reaches every patch from the Camp
  {
    const game = { beaten: [] };
    let x = a[0], z = a[2], y = a[1], steps = 0, stuck = 0;
    const order = [];
    while (order.length < L.PATCHES.length && steps < 30000) {
      const aim = L.wobbleAim(w, { x, y, z }, game), q = L.openPatches(game.beaten).find(r => Math.hypot(r.x + 0.5 - x, r.z + 0.5 - z) < 5);
      if (q) { game.beaten.push(L.patchKey(q.id)); order.push(q.id); continue; }
      const dx = aim.x - x, dz = aim.z - z, d = Math.hypot(dx, dz) || 1;
      let moved = false;
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
        const c = Math.cos(turn), sn = Math.sin(turn), nx = x + (dx * c - dz * sn) / d * 0.3, nz = z + (dz * c + dx * sn) / d * 0.3;
        const ny = G.stand(nx, nz, y, 1.25);
        if (ny != null) { x = nx; z = nz; y = ny; moved = true; break; }
      }
      if (!moved) stuck++;
      steps++;
    }
    out.kid = { order, steps, stuck, at: [x, z, y].map(v => +v.toFixed(1)) };
    if (order.length < L.PATCHES.length) problems.push(`the arrow-following kid reached only patches ${order.join(', ')} (${stuck} stuck steps)`);
  }
  return { problems, out, w };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await checkWobble();
  console.log(`the arrow-following kid: patches in the order ${r.out.kid.order.join(', ')} in ${r.out.kid.steps} steps of 0.3 (${r.out.kid.stuck} stuck, ends at ${r.out.kid.at})`);
  console.log(`reachable from the Camp: ${r.out.reach} cells (${Object.entries(r.out.regions).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  for (const q of r.out.rings) console.log(`patch ${q.id}: ring ${q.walk} % walkable, ${q.wet} wet cells${q.ice != null ? `, ${q.ice} % ice` : ''}${q.dark != null ? `, ${q.dark} % dark` : ''}`);
  for (const p of r.problems) console.log('PROBLEM', p);
  process.exit(r.problems.length ? 1 : 0);
}
