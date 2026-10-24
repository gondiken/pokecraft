// T38a / T38 builder A: the Swirl's terrain, STAND-IN version. One round hub deck over a soft cloud sea, the door back,
// `world.door`, `world.keeps` and `world.swirl`. Builder B replaces `swirlLand` with the real thing (decks, galleries,
// stairs, lifts, frames, the star bridge, the Wizard's tower; plans/T38a.md section 3.2) and keeps these exports.
// Node-runnable like dreamland.js: needs only a world with W / D / seed / data / ground / index / inBounds / get.
import { B } from './blocks.js';

export const SEA = 0; // B.CLOUD at y 0 everywhere, ground 0: a soft landing
export const DECKS = [ // round: { cx, cz, r }; the top block is at y (you stand at y + 1)
  { id: 'hub', round: [48, 80, 11], y: 20 }, // arrival, door back, start of the star bridge (B adds the others)
];
export const DOOR = { x: 39, z: [78, 82], y: [21, 25], facing: [1, 0] }; // PORTAL 5 wide x 5 tall, frame round it (z 77/83, y 26)

export function swirlLand(world, def) {
  const { W, D } = world;
  const put = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) { put(x, SEA, z, B.CLOUD); world.ground[x + z * W] = SEA; }

  // The hub: a round deck, 3 thick.
  for (const deck of DECKS) {
    const [cx, cz, r] = deck.round;
    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r) continue;
        for (let y = deck.y - 2; y <= deck.y; y++) put(x, y, z, B.SWIRL_STONE);
        world.ground[x + z * W] = deck.y;
      }
    }
  }

  // The door back: a frame round a 5 x 5 Portal, facing east (+x).
  const surface = [];
  const [z0, z1] = DOOR.z, [y0, y1] = DOOR.y;
  for (let z = z0 - 1; z <= z1 + 1; z++) {
    for (let y = y0; y <= y1 + 1; y++) {
      const frame = z === z0 - 1 || z === z1 + 1 || y === y1 + 1;
      put(DOOR.x, y, z, frame ? B.PORTAL_FRAME : B.PORTAL);
      if (!frame) surface.push([DOOR.x, y, z]);
    }
  }
  const box = { x0: DOOR.x - 1, x1: DOOR.x + 1, z0: z0 - 2, z1: z1 + 2, y0: y0 - 1, y1: y1 + 2 };
  world.door = { surface, box, stand: [44.5, y0, 80.5, -Math.PI / 2] };
  world.keeps = [{ name: 'door', protect: [box], wallText: "The Portal Door is made of magic. You can't build here!" }];
  world.swirl = { decks: DECKS, lifts: [], frames: [], bridge: [], wizard: null };
}

// The guide in the Swirl: { x, z, text(arrow, distance) }. B adds lifts (on the cloud sea), ready frames and the bridge.
export function swirlAim(world, p) {
  const d = world.door, c = d.surface[Math.floor(d.surface.length / 2)];
  const x = c[0] + 0.5, z = c[2] + 0.5;
  if (Math.hypot(x - p.x, z - p.z) < 3) return { x, z, text: () => 'Portal Door: step in to go home' };
  return { x, z, text: (a, m) => `Portal Door home ${a} ${m}m` };
}
