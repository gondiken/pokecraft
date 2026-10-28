// Cube Planets (spec `cube`, part off): records how a Player class moves in the main world, the Dream and the Swirl with a fixed script
// of keys, joystick and uneven frame times (walk, sprint, jumps, a swim, a bounce pad, a lift stream). Runs in the page (it imports the
// game's modules by URL). tests/fixtures/cube-off-golden.json holds what the player.js from before Cube Planets did; the spec checks the
// player.js of now gives exactly the same numbers (bit for bit: every float is written out in full).
const DTS = [1 / 60, 1 / 60, 1 / 30, 0.05, 1 / 45, 1 / 60, 0.012, 1 / 20];
// The script: [frames, keys, joy]
const SCRIPT = [
  [20, {}, null], [40, { KeyW: true }, null], [30, { KeyW: true, ShiftLeft: true }, null], [12, { KeyW: true, Space: true }, null],
  [25, { KeyA: true }, null], [20, { KeyD: true, KeyS: true }, null], [30, {}, { x: 0.4, y: -0.9 }], [20, { Space: true }, null],
  [30, {}, { x: -1, y: 0 }], [40, { KeyW: true, Space: true, ShiftRight: true }, null], [30, {}, null],
];
const PAD = [[10, {}, null], [6, { Space: true }, null], [90, { KeyW: true }, null], [20, { Space: true }, null], [60, {}, null]]; // jump on a Bounce pad
const LIFT = [[150, {}, null], [60, { KeyW: true }, null], [40, {}, null]]; // ride a lift stream up, then walk
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }

function run(Player, world, start, { yaw = 0.3, look = 0, script = SCRIPT } = {}) {
  const p = new Player(world);
  p.pos.set(start[0], start[1], start[2]); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0;
  const rows = [];
  let n = 0, maxY = -Infinity, bounces = 0, dives = 0;
  for (const [frames, keys, joy] of script) for (let i = 0; i < frames; i++, n++) {
    p.keys = keys; p.joy = joy;
    p.yaw += look * 0.01; // turning while moving
    p.update(DTS[n % DTS.length]);
    rows.push([p.pos.x, p.pos.y, p.pos.z, p.vel.x, p.vel.y, p.vel.z, p.onGround ? 1 : 0, p.diving ? 1 : 0, p.bounced ? 1 : 0].join(','));
    maxY = Math.max(maxY, p.pos.y); bounces += p.bounced ? 1 : 0; dives += p.diving ? 1 : 0;
    p.bounced = false;
  }
  const all = rows.join(';');
  return { hash: fnv(all), frames: rows.length, end: rows[rows.length - 1], maxY, bounces };
}

// -> { main: { walk, swim }, dream: { walk, pad }, swirl: { walk, lift } }
export async function recordOff(Player) {
  const { World } = await import('/src/world.js');
  const { REALMS } = await import('/src/realms.js');
  const { B } = await import('/src/blocks.js');
  const { LIFTS, liftCenter } = await import('/src/swirlland.js');
  const out = {};
  // the main world (seed 4242, no caves: faster, and the walk stays on the surface)
  const m = new World(4242, null, null); m.generate({ caves: false });
  const s = m.surface(112, 112);
  let water = null;
  for (let r = 1; r < 90 && !water; r++) for (let dx = -r; dx <= r && !water; dx++) for (const dz of [-r, r]) {
    const t = m.surface(112 + dx, 112 + dz);
    if (t.id === B.WATER && m.get(112 + dx, t.y - 1, 112 + dz) === B.WATER) { water = [112 + dx + 0.5, t.y - 0.6, 112 + dz + 0.5]; break; }
  }
  out.main = { walk: run(Player, m, [112.5, s.y + 1, 112.5], { look: 1 }), swim: water ? run(Player, m, water) : null, water };
  // the Dream (gravity 0.5, Bounce pads)
  const d = new World(777, null, null, REALMS.dream.size, REALMS.dream); d.generate();
  const [ax, az] = REALMS.dream.arrive, pad = d.isles.seaPads[0];
  out.dream = { walk: run(Player, d, [ax + 0.5, d.surface(ax, az).y + 1, az + 0.5], { look: -1 }), pad: run(Player, d, [pad[0] + 0.5, pad[1] + 1, pad[2] + 0.5], { script: PAD }) };
  // the Swirl (lift streams)
  const sw = new World(99, null, null, REALMS.swirl.size, REALMS.swirl); sw.generate();
  const [sx, sz] = REALMS.swirl.arrive, L = LIFTS[0], [lx, lz] = liftCenter(L);
  out.swirl = { walk: run(Player, sw, [sx + 0.5, sw.surface(sx, sz).y + 1, sz + 0.5], { look: 1 }), lift: run(Player, sw, [lx, L.y[0] + 1, lz], { script: LIFT }) };
  return out;
}
