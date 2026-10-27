// T43: the Funfair, the part of the Playland zone table behind the Funfair's way back door (Picture World `fair`). The layout is data
// (the numbers the games use live in fairgames.js); buildFunfair writes only inside the zone box, the same in every world (no seed).
// Node-runnable: needs only a world with W / D / data / ground / index / inBounds / get (the spec runs it on a stand-in).
//
// From north to south (z grows southwards), 1 char about 3 blocks:
//   hub hedge z 131 (the gap x 163..169) | striped arch z 133..134 with the ticket board | the entry plaza x 156..176, z 135..141 (Ticket Tess)
//   bumper arena x 120..148, z 142..164 | the carousel (centre 166.5, 153.5, r 9.5) | the trampoline x 188..207, z 146..161
//   the walkway z 166..169 | the coaster station x 160..172, z 170..176 | three stalls | the Star Stage x 196..206, z 196..206 (top y 23)
//   the Ferris wheel is a mesh in the plane x = 118; the coaster runs west (lift hill), down the big drop, along z 209 and up to the stage.
import { B, WOOL } from './blocks.js';
import { placeBoss, placeCrew, kit } from './picturelands.js';
import { ARENA, BAYS, TRAMP, CAROUSEL, COASTER, STATION, STAGE, SLIDE, makeCoaster } from './fairgames.js';

const WORLD_H = 48;
export const G = 10;
export const TICKETS = 3;
export const ticketKey = i => `pw:fair:ticket${i}`;            // i = 1..3, saved in `beaten`, like the stadium's goals
// How many golden tickets you hold for the next ride: { have: [b, b, b], n, need, done }.
export function ticketState(game) {
  const have = [1, 2, 3].map(i => game.beaten.includes(ticketKey(i)));
  const n = have.filter(Boolean).length;
  return { have, n, need: TICKETS, done: n >= TICKETS };
}
// Wild Funfair creatures of the fair zone (playland.js reads this through PLAYLAND_PARTS.fair.spawns): never in the main SPAWNS.
export const FUNFAIR_SPAWNS = [['merrycolt', 1.2], ['flufflamb', 1.2], ['twistpup', 1.2], ['galloprance', 0.12], ['candyram', 0.12], ['balloodle', 0.12], ['tixit', 0.15]];
export const FAIR_WALK = [B.FAIR_FLOOR];

export const FAIR = {
  arch: { postsX: [[157, 158], [174, 175]], z: [133, 134], top: [16, 17], slots: [[161, 163], [165, 167], [169, 171]], slotY: [16, 17] },
  plaza: { x0: 156, x1: 176, z0: 135, z1: 141 },
  tess: { name: 'Ticket Tess', x: 166, z: 138, facing: [0, -1], colors: { shirt: 0xff7ac0, pants: 0xffffff, hair: 0xc8902a, skin: 0xf2d0b0 }, look: 'fair', line: 'Three games, three golden tickets, one big coaster!' },
  boss: { x: 201, z: 201, facing: [1, 0] },
  crew: [{ x: 150, z: 153, facing: [-1, 0] }, { x: 186, z: 153, facing: [1, 0] }],
  walkway: { z0: 166, z1: 169 },
  stalls: [{ x: 130, z: 177, wool: 'pixie' }, { x: 138, z: 177, wool: 'funfair' }, { x: 146, z: 177, wool: 'water' }], // 4 x 3 each, facing north
  wheel: { c: [118, 24, 152], r: 12, legs: [116, 119] },
  benches: [[192, 163], [200, 163]],
  rests: [[166.5, G + 1, 138.5, Math.PI]],
};

export function buildFunfair(world, zone) {
  const box = zone.box;
  const put = (x, y, z, id) => {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) throw new Error(`funfair: cell ${x},${y},${z} is outside the zone`);
    if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id;
  };
  const fill = (x0, x1, y0, y1, z0, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, id); };
  kit(world);
  world.people ??= [];

  // the whole zone: the pastel fair floor (air above is already there)
  fill(box.x0, box.x1, G, G, box.z0, box.z1, B.FAIR_FLOOR);

  // the striped arch with the ticket board: four posts, a beam, three slots of unlit fair lights
  const A = FAIR.arch;
  for (const [x0, x1] of A.postsX) fill(x0, x1, G + 1, A.top[1], A.z[0], A.z[1], B.CANDY_STRIPE);
  fill(A.postsX[0][0], A.postsX[1][1], A.top[0], A.top[1], A.z[0], A.z[1], B.CANDY_STRIPE);
  const board = A.slots.map(([x0, x1]) => ({ x0, x1, y0: A.slotY[0], y1: A.slotY[1], z: A.z[0] }));
  for (const s of board) fill(s.x0, s.x1, s.y0, s.y1, s.z, s.z, B.MARQUEE);

  // the bumper arena: dark floor, a two-high rubber rail all round with the gate gap in the east side
  fill(ARENA.x0, ARENA.x1 - 1, G, G, ARENA.z0, ARENA.z1 - 1, B.BUMPER_FLOOR);
  fill(ARENA.x0 - 1, ARENA.x1, G + 1, G + 2, ARENA.z0 - 1, ARENA.z0 - 1, B.BUMPER_RAIL);
  fill(ARENA.x0 - 1, ARENA.x1, G + 1, G + 2, ARENA.z1, ARENA.z1, B.BUMPER_RAIL);
  fill(ARENA.x0 - 1, ARENA.x0 - 1, G + 1, G + 2, ARENA.z0, ARENA.z1 - 1, B.BUMPER_RAIL);
  for (let z = ARENA.z0; z < ARENA.z1; z++) if (z < ARENA.gap[0] || z >= ARENA.gap[1]) fill(ARENA.x1, ARENA.x1, G + 1, G + 2, z, z, B.BUMPER_RAIL);

  // the carousel deck: a round raised floor (the canopy, pole and horses are meshes)
  const C = CAROUSEL, deck = [];
  for (let x = Math.floor(C.c[0] - C.deckR); x <= Math.ceil(C.c[0] + C.deckR); x++) for (let z = Math.floor(C.c[1] - C.deckR); z <= Math.ceil(C.c[1] + C.deckR); z++) {
    if (Math.hypot(x + 0.5 - C.c[0], z + 0.5 - C.c[1]) <= C.deckR) { put(x, C.deck, z, B.CAROUSEL_DECK); deck.push([x, z]); }
  }

  // the trampoline (flush with the floor) and two benches
  fill(TRAMP.x0, TRAMP.x1, G, G, TRAMP.z0, TRAMP.z1, B.TRAMPOLINE);
  for (const [bx, bz] of FAIR.benches) fill(bx, bx + 2, G + 1, G + 1, bz, bz, B.CANDY_STRIPE);

  // the coaster station: a raised platform, four posts and a striped roof with fair lights along its edge
  const S = STATION;
  fill(S.x0, S.x1, S.y, S.y, S.z0, S.z1, B.FAIR_FLOOR);
  for (const [x, z] of [[S.x0, S.z0], [S.x1, S.z0], [S.x0, S.z1], [S.x1, S.z1]]) fill(x, x, S.y + 1, S.y + 4, z, z, B.CANDY_STRIPE);
  fill(S.x0, S.x1, S.y + 5, S.y + 5, S.z0, S.z1, B.CANDY_STRIPE);
  fill(S.x0, S.x1, S.y + 5, S.y + 5, S.z0, S.z0, B.MARQUEE);

  // the roller coaster: a rail block under every sample of the track, white supports to the floor every 3 blocks, fair lights on posts
  const track = makeCoaster(COASTER), rails = new Map(), supports = [], lights = [], path = [];
  const railY = y => Math.floor(y - 0.999);
  const onStage = (x, y, z) => x >= STAGE.x0 && x <= STAGE.x1 && z >= STAGE.z0 && z <= STAGE.z1 && y === STAGE.top;
  track.samples.forEach((p, i) => {
    const cell = [Math.floor(p[0]), railY(p[1]), Math.floor(p[2])], key = cell.join(',');
    path.push(cell);
    if (!rails.has(key) && !onStage(...cell)) rails.set(key, cell); // (the last blocks of the ride are the stage itself)
  });
  for (const [x, y, z] of rails.values()) put(x, y, z, B.COASTER_RAIL);
  // vertical gaps between neighbouring rail cells of a steep run: fill them so the track looks joined
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (a[0] === b[0] && a[2] === b[2]) for (let y = Math.min(a[1], b[1]) + 1; y < Math.max(a[1], b[1]); y++) put(a[0], y, a[2], B.COASTER_RAIL);
  }
  const taken = new Set([...rails.keys()]);
  track.samples.forEach((p, i) => {
    if (i % 12 !== 0 || i < 4) return;
    const [x, y, z] = path[i];
    if (y <= G + 1) return;
    if (!(x >= S.x0 && x <= S.x1 && z >= S.z0 && z <= S.z1)) for (let k = G + 1; k < y; k++) if (!taken.has(`${x},${k},${z}`)) { put(x, k, z, B.COASTER_SUPPORT); supports.push([x, k, z]); }
    if (i % 24 === 12) { // a light post beside the rail (2 cells to the side, a lattice pole under a fair light): the lights come on one third at a time
      const q = track.samples[Math.min(track.samples.length - 1, i + 1)], dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz) || 1;
      for (const side of [2, -2]) {
        const lx = Math.floor(p[0] + (-dz / l) * side), lz = Math.floor(p[2] + (dx / l) * side), cx = lx + 0.5, cz = lz + 0.5;
        if (lx < box.x0 + 1 || lx > box.x1 - 1 || lz < box.z0 + 1 || lz > box.z1 - 1) continue;
        if (lx >= STAGE.x0 - 1 && lx <= STAGE.x1 + 1 && lz >= STAGE.z0 - 1 && lz <= STAGE.z1 + 1) continue; // (the stage is built after the rails and would cover it)
        if (track.samples.some(r => Math.hypot(r[0] - cx, r[2] - cz) < 1.9 && Math.abs(r[1] - p[1]) < 6)) continue;
        if (world.get(lx, y + 1, lz) !== 0) continue;
        for (let k = G + 1; k <= y; k++) put(lx, k, lz, B.COASTER_SUPPORT);
        put(lx, y + 1, lz, B.MARQUEE); lights.push([lx, y + 1, lz]);
        break;
      }
    }
  });

  // the coaster's gate: a striped shutter across the track at the platform's west end. Closed, it keeps walkers off the track (the rails
  // are a staircase up to the sky); the live part opens it (setLive) while the car goes through.
  const gate = [];
  for (let z = 172; z <= 174; z++) for (let y = G + 3; y <= G + 5; y++) { put(156, y, z, B.CANDY_STRIPE); gate.push([156, y, z]); } // (the rails west of x 156 are at stand 13 and up, so they can be walked up only from the track itself)

  // the Star Stage: a deck on four legs, a rail all round except the coaster's way in (east) and the slide's way out (north-west)
  const T = STAGE;
  fill(T.x0, T.x1, T.top, T.top, T.z0, T.z1, B.STAR_STAGE);
  for (const [x, z] of T.legs) fill(x, x, G + 1, T.top - 1, z, z, B.COASTER_SUPPORT);
  for (let x = T.x0; x <= T.x1; x++) for (let z = T.z0; z <= T.z1; z++) {
    if (x !== T.x0 && x !== T.x1 && z !== T.z0 && z !== T.z1) continue;
    if (x === T.x1 && z >= 199 && z <= 204) continue;           // the coaster arrives here
    if (x <= T.x0 + 2 && z <= T.z0 + 2) continue;                // the slide starts here
    fill(x, x, T.top + 1, T.top + 2, z, z, B.CANDY_STRIPE);
  }

  // three stalls along the south (candy floss, balloons, hook-a-duck): a counter, two posts and a pink-striped roof
  for (const st of FAIR.stalls) {
    fill(st.x, st.x + 3, G + 1, G + 2, st.z, st.z, B.CANDY_STRIPE);
    for (const x of [st.x, st.x + 3]) fill(x, x, G + 3, G + 4, st.z + 2, st.z + 2, WOOL[st.wool]);
    fill(st.x, st.x + 3, G + 5, G + 5, st.z, st.z + 2, WOOL[st.wool]);
    fill(st.x, st.x + 3, G + 5, G + 5, st.z, st.z, B.MARQUEE);
  }

  // the Ferris wheel is a mesh; its two A-frame legs are blocks on both sides of the wheel's plane
  const W = FAIR.wheel;
  for (const x of W.legs) for (const z0 of [145, 159]) {
    const steps = W.c[1] - 1 - G;
    for (let k = 0; k <= steps; k++) put(x, G + 1 + k, Math.round(z0 + ((W.c[2] - z0) * k) / steps), B.COASTER_SUPPORT);
  }

  // Merry Mae and her crew, Ticket Tess, the rest spots
  const boss = placeBoss(world, 'fair', { x: FAIR.boss.x, y: T.top, z: FAIR.boss.z, facing: FAIR.boss.facing });
  FAIR.crew.forEach((c, i) => placeCrew(world, 'fair', i, { x: c.x, y: G, z: c.z, facing: c.facing }));
  const ts = FAIR.tess;
  world.people.push({ name: ts.name, title: `${ts.name} · Funfair`, colors: ts.colors, look: ts.look, line: ts.line, pos: [ts.x + 0.5, G + 1, ts.z + 0.5], heading: Math.atan2(ts.facing[0], ts.facing[1]) });
  world.rests.push(...FAIR.rests);

  const part = {
    id: 'fair', live: 'fair',
    area: { ...box, y0: 0, y1: WORLD_H },
    arena: ARENA, bays: BAYS, trampoline: TRAMP, carousel: { ...CAROUSEL, deck }, station: STATION, stage: STAGE, slide: SLIDE, board, wheel: W,
    coaster: { spec: COASTER, rails: [...rails.values()], supports, lights, path, gate },
    arrival: [166.5, G + 1, 126.5], bossRest: boss.rest, tess: [ts.x + 0.5, G + 1, ts.z + 0.5],
    entry: [166.5, G + 1, 138.5],
  };
  world.parts.push(part);
  world.keeps.push({ name: 'fair', protect: [{ x0: box.x0, x1: box.x1, y0: 0, y1: WORLD_H, z0: box.z0, z1: box.z1 }], wallText: 'This is the fair! Play the games instead.', rideText: 'Hop off! Rides at the fair are for people.' });
  return part;
}
