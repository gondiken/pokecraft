// T38a: the terrain of the Swirl realm (TERRAINS.swirlLand in realms.js). A purple sky over a soft cloud sea, with floating
// decks (the hub with the door home, a north and a south gallery, the looping stairs, the Wizard's island), a spiral stair and
// a straight one, lift streams (upward rivers: boxes, no blocks), seven picture frames hanging in the air covered with cloth,
// and far to the east the Wizard's tower behind a row of empty star-stone spots (the star bridge).
// Everything is data (DECKS, STAIRS, LIFTS, FRAME_SPOTS, BRIDGE) and a few loops; the seed changes nothing, so every deck, step
// and frame is always where the table says. Node-runnable like dreamland.js: needs only a world with
// W / D / data / ground / index / inBounds / get (the spec runs it on a stand-in as well).
import { B, WOOL } from './blocks.js';
import { PICTURE_WORLDS } from './pictureworlds.js';

export const SEA = 0; // B.CLOUD at y 0 everywhere, ground 0: a soft landing
export const DECKS = [ // round: [cx, cz, r]; box: [x0, x1, z0, z1]; the top block is at y (you stand at y + 1)
  { id: 'hub', round: [48, 80, 11], y: 20 },        // arrival, door home, start of the star bridge
  { id: 'north', box: [28, 68, 52, 57], y: 26 },    // north gallery: frames N0-N3 hang above its north edge
  { id: 'south', box: [28, 68, 103, 108], y: 14 },  // south gallery: frames S0-S2 hang beyond its south edge
  { id: 'loopbase', box: [56, 64, 84, 92], y: 20 }, // the looping stairs stand here, joined to the hub
  { id: 'wizard', round: [112, 80, 9], y: 20 },     // the Wizard's island (its x moves with the number of Picture Worlds)
];
export const DOOR = { x: 39, z: [78, 82], y: [21, 25], facing: [1, 0] }; // PORTAL 5 wide x 5 tall, frame round it (z 77/83, y 26)
export const STAIRS = [
  { id: 'spiral', kind: 'spiral', core: [46, 50, 60, 64], ring: [45, 51, 59, 65], from: [45, 65], rise: 6 }, // hub -> north gallery, round a 5x5 core
  { id: 'down', kind: 'straight', x: [47, 49], z: [91, 102], from: 19, step: 2 },                           // hub -> south gallery, 2 cells per step
  { id: 'loop', kind: 'loop', ring: [56, 64, 84, 92], rise: 4 },                                             // a 9x9 square ring: up 4 on one half, down 4 on the other
];
export const LIFTS = [ // upward rivers: boxes (cells x0..x1, z0..z1), feet inside rise until y1 + 1, then you bob and walk onto the deck
  { id: 'hubS', x: [50, 51], z: [91, 92], y: [1, 22] },
  { id: 'north', x: [69, 70], z: [54, 55], y: [1, 28] },
  { id: 'northW', x: [26, 27], z: [54, 55], y: [1, 28] },
  { id: 'south', x: [69, 70], z: [105, 106], y: [1, 16] },
  { id: 'southW', x: [26, 27], z: [105, 106], y: [1, 16] },
  { id: 'wizard', x: [59, 60], z: [82, 83], y: [1, 22] }, // beside the bridge's start: a fall from the bridge is never far from here
];
export const FRAME_SPOTS = [ // 8 places; PICTURE_WORLDS[i] -> FRAME_SPOTS[i] (the 8th waits for a world to come)
  ...[32, 42, 52, 62].map((x, k) => ({ id: `N${k}`, x, z: 51, y: 28, facing: [0, 1], stand: [x, 27, 52] })), // hangs 1 above the north deck (y 27 is air)
  ...[32, 42, 52, 62].map((x, k) => ({ id: `S${k}`, x, z: 109, y: 16, facing: [0, -1], stand: [x, 15, 108] })),
];
export const FRAME = { w: 7, h: 7 }; // PICTURE_FRAME border, 5x5 inside: CLOTH, or PORTAL when the world is ready (later waves)
export const BRIDGE = { x0: 61, z: [79, 81], y: 20, len: 5, gap: 1 }; // star stone i: x 61+6i .. 65+6i, two layers (y 19-20)
export const WIZARD = { z: 80, r: 9, y: 20, R: 4, wallTop: 39 };
// Little floating islets: scenery only, nobody needs them.
export const ISLETS = [[14, 20, 3, 30], [24, 128, 4, 22], [86, 36, 3, 34], [90, 122, 4, 18], [126, 40, 3, 26], [132, 118, 5, 30], [10, 82, 3, 24], [150, 82, 3, 34], [78, 14, 4, 20], [76, 148, 3, 26]];
// Corner gems of a frame: the wool nearest to the world's frame colour.
const GEMS = ['electric', 'water', 'fire', 'grass', 'mind', 'pixie', 'rock'];

// The first block of the star bridge for world i, and the Wizard's island x for n worlds.
export const stoneX = i => BRIDGE.x0 + (BRIDGE.len + BRIDGE.gap) * i;
export const wizardX = n => BRIDGE.x0 + (BRIDGE.len + BRIDGE.gap) * n + WIZARD.r;
// Every Swirl x/z cell of a lift, the middle of its box.
export const liftCenter = l => [(l.x[0] + l.x[1] + 1) / 2, (l.z[0] + l.z[1] + 1) / 2];

export function swirlLand(world, def) {
  const { W, D } = world;
  const put = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  const ground = (x, z, y) => { if (x >= 0 && z >= 0 && x < W && z < D) world.ground[x + z * W] = y; };
  const S = B.SWIRL_STONE;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) { put(x, SEA, z, B.CLOUD); ground(x, z, SEA); }

  // A solid column of stone from y0 up to the top.
  const column = (x, z, y0, top) => { for (let y = y0; y <= top; y++) put(x, y, z, S); ground(x, z, Math.max(world.ground[x + z * W], top)); };

  // 1. The decks: 3 thick, then a tapering underside so they look like they float.
  const round = (cx, cz, r, y, thick = 3) => {
    const T = Math.min(7, Math.round(r));
    for (let k = 0; k < thick + T; k++) { // the deck itself, then an underside that shrinks to a point
      const rr = k < thick ? r : r * (1 - (k - thick + 1) / (T + 1));
      for (let x = Math.floor(cx - rr - 1); x <= Math.ceil(cx + rr + 1); x++) for (let z = Math.floor(cz - rr - 1); z <= Math.ceil(cz + rr + 1); z++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > rr) continue;
        put(x, y - k, z, S);
        if (k === 0) ground(x, z, y);
      }
    }
  };
  const box = (x0, x1, z0, z1, y, thick = 3, taper = 2) => {
    for (let k = 0; k < thick + taper; k++) {
      const inset = Math.max(0, k - thick + 1);
      for (let x = x0 + inset; x <= x1 - inset; x++) for (let z = z0 + inset; z <= z1 - inset; z++) {
        put(x, y - k, z, S);
        if (k === 0) ground(x, z, y);
      }
    }
  };
  for (const d of DECKS) {
    if (d.id === 'wizard') continue; // placed below (its x depends on the number of worlds)
    if (d.round) round(d.round[0], d.round[1], d.round[2], d.y); else box(...d.box, d.y);
  }
  const n = PICTURE_WORLDS.length;
  const wx = wizardX(n);
  round(wx, WIZARD.z, WIZARD.r, WIZARD.y);

  // A short post with a lamp on top (fixed stone, a glowing lamp).
  const post = (x, z, y, h = 2) => { for (let i = 1; i <= h; i++) put(x, y + i, z, S); put(x, y + h + 1, z, B.LAMP); };
  const lamps = [];

  // 2. The hub: lamp posts round the edge, the walkways to the stairs and the bridge.
  for (const a of [0.8, 2.4, 3.9, 5.5]) { // four lamp posts round the edge
    const x = Math.floor(48 + Math.cos(a) * 9.5), z = Math.floor(80 + Math.sin(a) * 9.5);
    post(x, z, 20, 2); lamps.push([x, z]);
  }
  for (let x = 59; x <= 60; x++) for (let z = 79; z <= 81; z++) box(x, x, z, z, 20, 3, 0); // the bridgehead
  for (const x of [45, 46]) for (let z = 66; z <= 68; z++) box(x, x, z, z, 20, 3, 0); // the walkway to the spiral stair

  // 3. The spiral stair: a 19-cell path round the 5x5 core, one step up every 3.6 cells, ending on the north gallery.
  const sp = STAIRS[0], [rx0, rx1, rz0, rz1] = sp.ring, [cx0, cx1, cz0, cz1] = sp.core;
  const path = [];
  for (let x = rx0; x <= rx1; x++) path.push([x, rz1]);        // along the south side, east
  for (let z = rz1 - 1; z >= rz0; z--) path.push([rx1, z]);   // up the east side, north
  for (let x = rx1 - 1; x >= rx0; x--) path.push([x, rz0]);   // along the north side, west
  const spiral = [];
  path.forEach(([x, z], i) => { const top = 21 + Math.min(sp.rise - 1, Math.floor(i / 3.6)); spiral.push({ x, z, top }); column(x, z, 18, top); });
  for (let x = cx0; x <= cx1; x++) for (let z = cz0; z <= cz1; z++) { column(x, z, 18, 31); } // the core: a tower you walk round
  put(48, 32, 62, B.CRYSTAL); put(48, 33, 62, B.CRYSTAL);
  const last = spiral.at(-1); // joins the north gallery (y 26) one cell away
  column(last.x, last.z - 1, 22, 26);

  // 4. The straight stair down to the south gallery: 2 cells per step.
  const dn = STAIRS[1];
  for (let z = dn.z[0]; z <= dn.z[1]; z++) for (let x = dn.x[0]; x <= dn.x[1]; x++) column(x, z, 12, dn.from - Math.floor((z - dn.z[0]) / dn.step));

  // 5. The looping stairs: a 1-wide square ring on the base, up 4 on one half and down 4 on the other. Round and round!
  const lp = STAIRS[2], [lx0, lx1, lz0, lz1] = lp.ring;
  const ring = [];
  for (let x = lx0; x <= lx1; x++) ring.push([x, lz0]);
  for (let z = lz0 + 1; z <= lz1; z++) ring.push([lx1, z]);
  for (let x = lx1 - 1; x >= lx0; x--) ring.push([x, lz1]);
  for (let z = lz1 - 1; z > lz0; z--) ring.push([lx0, z]);
  const loopTops = ring.map(([x, z], i) => {
    const top = 20 + Math.floor(Math.min(i, ring.length - i) / (ring.length / 2 / lp.rise));
    if (top > 20) column(x, z, 20, top);
    return { x, z, top };
  });
  const mx = Math.floor((lx0 + lx1) / 2), mz = Math.floor((lz0 + lz1) / 2);
  post(mx, mz, 20, 6); lamps.push([mx, mz]);

  // 6. The galleries: lamp posts at the back, the frames in front.
  for (const x of [37, 47, 57]) { post(x, 53, 26, 2); lamps.push([x, 53]); }
  for (const x of [37, 47, 57]) { post(x, 107, 14, 2); lamps.push([x, 107]); }
  for (const x of [29, 67]) { post(x, 55, 26, 2); post(x, 105, 14, 2); }

  // 7. The picture frames: a PICTURE_FRAME border 7 x 7, two gem corners, CLOTH inside.
  const frames = [];
  PICTURE_WORLDS.forEach((pw, i) => {
    const spot = FRAME_SPOTS[i];
    if (!spot) return;
    const cells = [], border = [], cloth = [];
    for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy < FRAME.h; dy++) {
      const x = spot.x + dx, y = spot.y + dy, edge = Math.abs(dx) === 3 || dy === 0 || dy === FRAME.h - 1;
      const corner = Math.abs(dx) === 3 && (dy === 0 || dy === FRAME.h - 1);
      put(x, y, spot.z, edge ? (corner ? WOOL[GEMS[i % GEMS.length]] : B.PICTURE_FRAME) : B.CLOTH);
      (edge ? border : cloth).push([x, y, spot.z]);
      cells.push([x, y, spot.z]);
    }
    frames.push({ spot, world: pw.id, cells, border, cloth, stand: spot.stand, box: { x0: spot.x - 3, x1: spot.x + 3, z0: spot.z - 1, z1: spot.z + 1, y0: spot.y, y1: spot.y + FRAME.h - 1 } });
  });

  // 8. The star bridge: n stones of air (drawn with setLive when won), the island after them.
  const bridge = PICTURE_WORLDS.map((pw, i) => {
    const x0 = stoneX(i), x1 = x0 + BRIDGE.len - 1, [z0, z1] = BRIDGE.z, cells = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = BRIDGE.y - 1; y <= BRIDGE.y; y++) cells.push([x, y, z]);
    return { world: pw.id, cells, box: { x0, x1, z0, z1, y0: BRIDGE.y - 1, y1: BRIDGE.y } };
  });

  // 9. The Wizard's tower: sealed Wizard Stone, glass windows with lamps behind them, a stepped wool cone, a crystal tip.
  const R = WIZARD.R, wz = WIZARD.z, wy = WIZARD.y, X = B.WIZARD_STONE;
  for (let y = wy + 1; y <= WIZARD.wallTop; y++) {
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) < R) continue;
      const lit = (y === wy + 8 || y === wy + 9 || y === wy + 15 || y === wy + 16) && (dx === 0 || dz === 0) && Math.abs(dx + dz) === R;
      put(wx + dx, y, wz + dz, lit ? B.GLASS : X);
    }
  }
  for (const y of [wy + 8, wy + 9, wy + 15, wy + 16]) for (const [dx, dz] of [[-R + 1, 0], [R - 1, 0], [0, -R + 1], [0, R - 1]]) put(wx + dx, y, wz + dz, B.LAMP);
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) put(wx + dx, WIZARD.wallTop + 1, wz + dz, X); // roof
  const cone = (r, y) => { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) put(wx + dx, y, wz + dz, WOOL.mind); };
  cone(R + 1, WIZARD.wallTop + 2); cone(3, WIZARD.wallTop + 3); cone(3, WIZARD.wallTop + 4); cone(2, WIZARD.wallTop + 5); cone(2, WIZARD.wallTop + 6); cone(1, WIZARD.wallTop + 7);
  put(wx, WIZARD.wallTop + 8, wz, B.CRYSTAL); // y 47, the top of the world
  // The sealed door on the west face: a gold frame round a 2 x 3 panel of Wizard Stone, a star above it.
  const dxw = wx - R, doorCells = [];
  for (let y = wy + 1; y <= wy + 4; y++) for (let z = wz - 2; z <= wz + 1; z++) {
    const inner = z >= wz - 1 && z <= wz && y <= wy + 3;
    put(dxw, y, z, inner ? X : B.PICTURE_FRAME);
    if (inner) doorCells.push([dxw, y, z]);
  }
  const star = [[dxw, wy + 6, wz - 1], [dxw, wy + 6, wz], [dxw, wy + 7, wz - 1], [dxw, wy + 7, wz]];
  for (const [x, y, z] of star) put(x, y, z, B.STAR_STONE); // always lit
  post(wx - 7, wz - 3, wy, 2); post(wx - 7, wz + 3, wy, 2);

  // 10. Scenery: little floating islets.
  for (const [x, z, r, y] of ISLETS) { round(x, z, r + 0.5, y, 2); put(x, y + 1, z, B.CRYSTAL); }

  // 11. The door home: a frame round a 5 x 5 Portal, facing east (+x).
  const surface = [];
  const [z0, z1] = DOOR.z, [y0, y1] = DOOR.y;
  for (let z = z0 - 1; z <= z1 + 1; z++) {
    for (let y = y0; y <= y1 + 1; y++) {
      const frame = z === z0 - 1 || z === z1 + 1 || y === y1 + 1;
      put(DOOR.x, y, z, frame ? B.PORTAL_FRAME : B.PORTAL);
      if (!frame) surface.push([DOOR.x, y, z]);
    }
  }
  const doorBox = { x0: DOOR.x - 1, x1: DOOR.x + 1, z0: z0 - 2, z1: z1 + 2, y0: y0 - 1, y1: y1 + 2 };
  world.door = { surface, box: doorBox, stand: [44.5, y0, 80.5, -Math.PI / 2] };

  // 12. Keep boxes: nobody can build on or into these (the stone itself is fixed anyway).
  const keep = (name, b, wallText) => ({ name, protect: [b], wallText });
  world.keeps = [
    keep('door', doorBox, "The Portal Door is made of magic. You can't build here!"),
    ...frames.map(f => keep(`frame-${f.spot.id}`, f.box, "You can't build here: it's a picture frame!")),
    keep('bridge', { x0: 59, x1: wx - WIZARD.r - 1, z0: 76, z1: 84, y0: 1, y1: 47 }, "You can't build here: it's the star bridge!"),
    keep('wizard', { x0: wx - WIZARD.r - 1, x1: wx + WIZARD.r + 1, z0: wz - WIZARD.r - 1, z1: wz + WIZARD.r + 1, y0: 1, y1: 47 }, "You can't build here: it's the Wizard's island!"),
  ];
  world.lifts = LIFTS;
  world.swirl = {
    decks: DECKS, lifts: LIFTS, frames, bridge, spiral, loop: loopTops, lamps,
    wizard: { x: wx, z: wz, x0: wx - WIZARD.r, door: doorCells, star, box: { x0: wx - R, x1: wx + R, z0: wz - R, z1: wz + R, y0: wy + 1, y1: 47 } },
  };
}

// The guide in the Swirl: { x, z, text(arrow, distance) }. On the cloud sea: the nearest lift; a ready Picture World you have no
// star from: its frame; otherwise the door home.
export function swirlAim(world, p, game) {
  const near = list => list.reduce((best, c) => (!best || Math.hypot(c.x - p.x, c.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? c : best), null);
  if (p.y < 4 && world.lifts?.length) {
    const c = near(world.lifts.map(l => { const [x, z] = liftCenter(l); return { x, z }; }));
    return { x: c.x, z: c.z, text: (a, m) => `Ride the river up! ${a} ${m}m` };
  }
  const open = (world.swirl?.frames || []).map(f => ({ f, w: PICTURE_WORLDS.find(w => w.id === f.world) }))
    .filter(({ w }) => w?.ready && !game?.stars?.includes(w.id)).map(({ f, w }) => ({ x: f.stand[0] + 0.5, z: f.stand[2] + 0.5, w }));
  if (open.length) { const c = near(open); return { x: c.x, z: c.z, text: (a, m) => `${c.w.emoji} ${c.w.name} ${a} ${m}m` }; }
  const d = world.door, c = d.surface[Math.floor(d.surface.length / 2)];
  const x = c[0] + 0.5, z = c[2] + 0.5;
  if (Math.hypot(x - p.x, z - p.z) < 3) return { x, z, text: () => 'Portal Door: step in to go home' };
  return { x, z, text: (a, m) => `Portal Door home ${a} ${m}m` };
}
