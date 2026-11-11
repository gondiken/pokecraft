// Chapter 3 step 2 (plans/chapter3-world.md section 10): Wobbleland as terrain, checked in Node on a stand-in world (src/wobbleland.js).
//   - every patch is reachable on foot from Inkpot Camp (steps of one block up, the fight's own ground rule: scribblefight.js groundOf)
//   - every patch's ring (radius RING) is at least 75 % walkable from its middle, dry unless it is a water-twist patch (`wet`)
//   - no patch is inside another (rings never touch), none crosses the wall
//   - the Scribble's wall really closes the rest of the page: nothing north of it can be reached from the Camp
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
  for (const p of L.PATCHES) {
    if (!from.has(`${p.x},${p.z}`)) problems.push(`patch ${p.id} cannot be reached on foot from the Camp`);
    const y = G.stand(p.x + 0.5, p.z + 0.5, L.BASE + 8);
    const inRing = (x, z) => Math.hypot(x + 0.5 - p.x - 0.5, z + 0.5 - p.z - 0.5) < L.RING - 0.2;
    let n = 0, wet = 0;
    for (let x = p.x - L.RING; x <= p.x + L.RING; x++) for (let z = p.z - L.RING; z <= p.z + L.RING; z++) if (inRing(x, z)) { n++; if (w.get(x, w.ground[x + z * W], z) === B.WATER) wet++; }
    const ring = walk(p.x, p.z, y, inRing), share = ring.size / n;
    out.rings.push({ id: p.id, walk: Math.round(share * 100), wet });
    if (share < 0.75) problems.push(`patch ${p.id}: only ${Math.round(share * 100)} % of its ring is walkable`);
    if (!p.wet && wet) problems.push(`patch ${p.id}: ${wet} cells of water in a dry ring`);
    if (p.wet && wet < 8) problems.push(`patch ${p.id}: a water twist with only ${wet} wet cells`);
    if (p.z - L.RING <= L.WALL.z1 + 1) problems.push(`patch ${p.id} touches the wall`);
    for (const q of L.PATCHES) if (q.id < p.id && Math.hypot(q.x - p.x, q.z - p.z) < 2 * L.RING + 2) problems.push(`patches ${q.id} and ${p.id} overlap`);
  }
  for (const k of from.keys()) { const z = +k.split(',')[1]; if (z <= L.WALL.z1) { problems.push(`the wall leaks: (${k}) can be reached`); break; } }
  // the other side is real land (Bumpy Hills): reachable from the knot's spot once the wall goes (step 7 melts it)
  out.hills = walk(L.KNOT.x, L.KNOT.z, L.heightAt(L.KNOT.x, L.KNOT.z) + 1).size;
  if (out.hills < 5000) problems.push(`behind the wall only ${out.hills} cells can be walked`);
  return { problems, out, w };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await checkWobble();
  console.log(`reachable from the Camp: ${r.out.reach} cells; Bumpy Hills (behind the wall): ${r.out.hills} cells`);
  for (const q of r.out.rings) console.log(`patch ${q.id}: ring ${q.walk} % walkable, ${q.wet} wet cells`);
  for (const p of r.problems) console.log('PROBLEM', p);
  process.exit(r.problems.length ? 1 : 0);
}
