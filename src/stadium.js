// T40d: Playland's Ball Stadium, the part of the Playland zone table behind the Stadium's way back door. The layout is data;
// buildStadium writes only inside the zone box, the same in every world (no seed, like the Obstacle Course). Node-runnable:
// needs only a world with W / D / data / ground / index / inBounds / get (the spec runs it on a stand-in).
//
// From north to south, all centred on x 58 (the gate): an entry strip, the football stadium (pitch with stands and a tunnel in
// each), a walkway and the basketball court (a gap in its north wall). Two local frames keep the cell tables short:
//   pitch frame  x = 26 + u, z = 136 + v   (u 0..63, v 0..51)      court frame  x = 43 + cu, z = 190 + cv   (cu 0..29, cv 0..25)
// All `y` in the tables are relative to the ground G = 10 (y 1 = the first block above it).
import { B, WOOL } from './blocks.js';
import { placeBoss, placeCrew } from './picturelands.js';

const WORLD_H = 48;
export const G = 10;
export const GOALS = { first: 2, rematch: 3 };      // goals the captain wants: the first star, then every rematch
export const BALL_R = 0.4;
// Shoot!: from 3.2 to 15 blocks away; the arc clears the rim (a square sticking out 2 from the hole's middle, 3.4 on the diagonal with the ball's size) by 1 block.
export const SHOT = { min: 3.6, max: 15, rim: 3.5, clear: 1.0, behind: 1.0, under: 3.6 }; // `behind`: a ball more than 1 behind the hole's middle (under the backboard) lobs instead
// A ball may be shot when it is not behind the backboard and not under the rim (the rim sticks out 2 from the hole's middle, plus the ball's size).
export const shootable = (h, p) => (p.x - h.hole[0]) * h.front > -SHOT.behind && Math.max(Math.abs(p.x - h.hole[0]), Math.abs(p.z - h.hole[1])) >= SHOT.under;
// Wild Ball creatures of the stadium zone (playland.js reads this through PLAYLAND_PARTS.stadium.spawns): never in the main SPAWNS.
export const STADIUM_SPAWNS = [['boinkle', 1.2], ['sealbop', 1], ['fuzzchick', 1.2], ['strikehorn', 0.7], ['goalhound', 0.1], ['beachboomer', 0.1], ['smashbird', 0.1]];

export const STADIUM = {
  pitch: { x: 26, z: 136, field: { u0: 4, u1: 59, v0: 7, v1: 44 }, stripe: 4, centre: [32, 26], circle: 6, boxes: { v0: 17, v1: 34, w: 8 } },
  stand: { rows: [1, 2, 3, 4, 5], tunnel: [30, 33] },       // rows from the pitch outwards: heights 1..5
  goal: { post: 3, back: 1, v0: 21, v1: 30, h: 3 },        // west goal in the pitch frame; the east one is mirrored (u -> 63 - u)
  court: { x: 43, z: 190, floor: { cu0: 1, cu1: 28, cv0: 1, cv1: 24 }, gap: [13, 16], circle: 3, centre: [15, 13], key: { cv0: 10, cv1: 15, w: 6 },
    hoop: { pole: 1, board: 2, rim: [3, 6], hole: [4, 5], rows: [11, 14], holeRows: [12, 13], poleH: 8, boardY: [5, 8], rimY: 5, board_v: [10, 15] } },
  boss: { x: 53, z: 134, facing: [1, 0] },
  crew: [{ x: 46, z: 181, facing: [0, -1] }, { x: 57, z: 192, facing: [0, 1] }],
  keepers: [{ name: 'Keeper Gus', colors: { shirt: 0x3aa84a, pants: 0x2a2a2a, hair: 0x3a2a1a, skin: 0xf0c8a0 }, x: 30.5, phase: 0, side: -1 },
    { name: 'Keeper Gail', colors: { shirt: 0x2a9a8a, pants: 0x2a2a2a, hair: 0x1a1a1a, skin: 0xc68a5a }, x: 85.5, phase: Math.PI / 2, side: 1 }],
  // owner 2026-10-26, "a bit harder": a defender who runs at the football near a goal and kicks it back to the middle (slower than
  // you walk, so you can keep it away from him), and a blocker who guards the basketball and jumps (shoot while he is landing).
  defender: { name: 'Defender Dee', colors: { shirt: 0xe04a3a, pants: 0x2a2a2a, hair: 0x6a3a1a, skin: 0xf0c8a0 }, speed: 3.4, hardSpeed: 3.9, zone: 14, reach: 0.9, kick: 9, rest: 1.5 },
  blocker: { name: 'Blocker Bo', colors: { shirt: 0x8a4ad8, pants: 0x2a2a2a, hair: 0x1a1a1a, skin: 0xc68a5a }, speed: 3, guard: 1.6, period: 2, hardPeriod: 1.5, up: 1.4, half: 0.45, height: 2.1, longShot: 9 },
};

export const goalKey = i => `pw:stadium:goal${i}`;   // saved in `beaten`, like the helpers' keys
// Goals scored for the next match: how many, how many are needed (2 for the star, 3 for a rematch) and whether that is enough.
export function goalState(game) {
  const need = game.stars.includes('stadium') ? GOALS.rematch : GOALS.first;
  const n = [1, 2, 3].filter(i => game.beaten.includes(goalKey(i))).length;
  return { n, need, done: n >= need };
}
export const inBox = (b, p) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y > b.y0 && p.y < b.y1;

// Which goal (index into part.goals) has the ball centre in it? -1 = none. Past the line by r, between the posts, under the bar.
export function goalOf(part, pos) {
  for (let k = 0; k < part.goals.length; k++) {
    const g = part.goals[k];
    const past = g.side < 0 ? pos.x < g.line - BALL_R : pos.x > g.line + BALL_R;
    if (past && pos.z > g.z[0] && pos.z < g.z[1] && pos.y < g.top && pos.y > G) return k;
  }
  return -1;
}
// Did the court ball just drop through a hoop? (its centre crossed the rim's middle going down, within 1 of the hole's middle)
export function basketCross(part, prevY, pos) {
  for (const h of part.hoops) {
    if (prevY >= h.rimMid && pos.y < h.rimMid && Math.abs(pos.x - h.hole[0]) < 1 && Math.abs(pos.z - h.hole[1]) < 1) return true;
  }
  return false;
}

// The stadium's chalk circle test: is the cell (u, v) on the circle round (cu, cv) of radius rad?
const onCircle = (u, v, cu, cv, rad) => Math.abs(Math.hypot(u + 0.5 - cu, v + 0.5 - cv) - rad) < 0.5;

export function buildStadium(world, zone) {
  const box = zone.box;
  const put = (x, y, z, id) => {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) throw new Error(`stadium: cell ${x},${y},${z} is outside the zone`);
    if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id;
  };
  const S = STADIUM, P = S.pitch, C = S.court;
  const px = u => P.x + u, pz = v => P.z + v, cx = u => C.x + u, cz = v => C.z + v;
  const pit = (u, v, y, id) => put(px(u), G + y, pz(v), id);
  const crt = (u, v, y, id) => put(cx(u), G + y, cz(v), id);

  // the whole zone: dark turf floor, air above
  for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) {
    put(x, G, z, B.PITCH_DARK);
    for (let y = G + 1; y <= G + 12; y++) put(x, y, z, B.AIR);
  }
  // the pitch: mown stripes and chalk
  const f = P.field;
  for (let u = f.u0; u <= f.u1; u++) for (let v = f.v0; v <= f.v1; v++) pit(u, v, 0, Math.floor((u - f.u0) / P.stripe) % 2 === 0 ? B.PITCH_LIGHT : B.PITCH_DARK);
  const line = (u, v) => pit(u, v, 0, B.PITCH_LINE);
  for (let u = f.u0; u <= f.u1; u++) { line(u, f.v0); line(u, f.v1); }
  for (let v = f.v0; v <= f.v1; v++) { line(f.u0, v); line(f.u1, v); line(31, v); line(32, v); }
  for (let u = f.u0; u <= f.u1; u++) for (let v = f.v0; v <= f.v1; v++) if (onCircle(u, v, P.centre[0], P.centre[1], P.circle)) line(u, v);
  const bx = P.boxes;
  for (const [a, b, inner] of [[f.u0, f.u0 + bx.w - 1, f.u0 + bx.w - 1], [f.u1 - bx.w + 1, f.u1, f.u1 - bx.w + 1]]) { // penalty boxes
    for (let u = a; u <= b; u++) { line(u, bx.v0); line(u, bx.v1); }
    for (let v = bx.v0; v <= bx.v1; v++) line(inner, v);
  }
  for (const u of [10, 53]) for (const v of [25, 26]) line(u, v); // penalty spots

  // the stands: five rows rising away from the pitch, a tunnel in the middle of each, under-seat wool of the four Playland types
  const WOOLS = [WOOL.tiny, WOOL.pirate, WOOL.racer, WOOL.ball];
  const [t0, t1] = S.stand.tunnel;
  for (let u = 0; u <= 63; u++) {
    if (u >= t0 && u <= t1) continue;
    for (let r = 0; r < 5; r++) { // r = 0 is the row nearest the pitch (height 1)
      for (const v of [4 - r, 47 + r]) {
        for (let y = 1; y <= r + 1; y++) pit(u, v, y, y === r + 1 ? B.STAND_SEAT : WOOLS[(u + v + y) % 4]);
      }
    }
  }
  for (let v = 5; v <= 46; v++) { pit(0, v, 1, B.STAND_SEAT); pit(63, v, 1, B.STAND_SEAT); } // end walls

  // the goals: posts, bar, net (west; the east one is the mirror image)
  const g = S.goal;
  const goalAt = (mirror) => {
    const U = u => (mirror ? 63 - u : u);
    for (let y = 1; y <= g.h; y++) { pit(U(g.post), g.v0, y, B.GOAL_POST); pit(U(g.post), g.v1, y, B.GOAL_POST); }
    for (let v = g.v0; v <= g.v1; v++) pit(U(g.post), v, g.h + 1, B.GOAL_POST);
    for (let y = 1; y <= g.h + 1; y++) for (let v = g.v0; v <= g.v1; v++) pit(U(g.back), v, y, B.GOAL_NET);
    for (let u = 1; u <= 2; u++) for (let y = 1; y <= g.h + 1; y++) { pit(U(u), g.v0, y, B.GOAL_NET); pit(U(u), g.v1, y, B.GOAL_NET); }
    for (let u = 1; u <= 2; u++) for (let v = g.v0 + 1; v <= g.v1 - 1; v++) pit(U(u), v, g.h + 1, B.GOAL_NET);
  };
  goalAt(false); goalAt(true);

  // the court: wooden floor, lines, wall with a gap, two hoops
  const cf = C.floor;
  for (let u = 0; u <= 29; u++) for (let v = 0; v <= 25; v++) crt(u, v, 0, B.COURT_FLOOR);
  const cl = (u, v) => crt(u, v, 0, B.COURT_LINE);
  for (let u = cf.cu0; u <= cf.cu1; u++) { cl(u, cf.cv0); cl(u, cf.cv1); }
  for (let v = cf.cv0; v <= cf.cv1; v++) { cl(cf.cu0, v); cl(cf.cu1, v); cl(14, v); cl(15, v); }
  for (let u = cf.cu0; u <= cf.cu1; u++) for (let v = cf.cv0; v <= cf.cv1; v++) if (onCircle(u, v, C.centre[0], C.centre[1], C.circle)) cl(u, v);
  const k = C.key;
  for (const [a, b] of [[1, k.w], [29 - k.w, 28]]) {
    for (let u = a; u <= b; u++) { cl(u, k.cv0); cl(u, k.cv1); }
    for (let v = k.cv0; v <= k.cv1; v++) cl(a === 1 ? b : a, v);
  }
  for (let u = 0; u <= 29; u++) for (const v of [0, 25]) if (!(v === 0 && u >= C.gap[0] && u <= C.gap[1])) crt(u, v, 1, B.STAND_SEAT);
  for (let v = 0; v <= 25; v++) for (const u of [0, 29]) crt(u, v, 1, B.STAND_SEAT);
  const h = C.hoop;
  const hoopAt = (mirror) => {
    const U = u => (mirror ? 29 - u : u);
    for (let y = 1; y <= h.poleH; y++) for (const v of [12, 13]) crt(U(h.pole), v, y, B.GOAL_POST);
    for (let y = h.boardY[0]; y <= h.boardY[1]; y++) for (let v = h.board_v[0]; v <= h.board_v[1]; v++) crt(U(h.board), v, y, B.BACKBOARD);
    for (let u = h.rim[0]; u <= h.rim[1]; u++) for (let v = h.rows[0]; v <= h.rows[1]; v++) {
      const hole = u >= h.hole[0] && u <= h.hole[1] && v >= h.holeRows[0] && v <= h.holeRows[1];
      if (!hole) crt(U(u), v, h.rimY, B.HOOP_RIM);
    }
  };
  hoopAt(false); hoopAt(true);

  // the Captain on his stand, the two helpers, the rest spots
  const boss = placeBoss(world, 'stadium', { x: S.boss.x, y: G, z: S.boss.z, facing: S.boss.facing });
  S.crew.forEach((c, i) => placeCrew(world, 'stadium', i, { x: c.x, y: G, z: c.z, facing: c.facing }));
  const rests = [[58.5, G + 1, 170.5, Math.PI], [57.5, G + 1, 194.5, Math.PI]];
  world.rests.push(...rests);

  // points and boxes for StadiumLive and the guide (world coordinates)
  const mid = pz(26), top = G + g.h + 1;
  const goals = [-1, 1].map(side => ({ side, line: side < 0 ? px(4) : px(60), z: [pz(g.v0 + 1), pz(g.v1)], top, keeperX: side < 0 ? 30.5 : 85.5, mid: [side < 0 ? px(4) : px(60), mid] }));
  const hoops = [h.hole[0], 29 - h.hole[1]].map((u, i) => ({ hole: [cx(u) + 1, cz(h.holeRows[0]) + 1], half: 1, rimMid: G + h.rimY + 0.5, front: i ? -1 : 1 })); // x 48 and 68, z 203; front = the side of the court it faces
  const part = {
    id: 'stadium', live: 'stadium',
    ballSpot: [px(32), G + 1 + BALL_R + 0.001, pz(26)], courtSpot: [cx(15), G + 1 + BALL_R + 0.001, cz(13)],
    pitchBox: { x0: px(1), x1: px(63), z0: pz(5), z1: pz(47), y0: G + 1, y1: G + 8 },
    courtBox: { x0: cx(1), x1: cx(29), z0: cz(1), z1: cz(25), y0: G + 1, y1: WORLD_H },
    goals, hoops, rests, area: { ...box, y0: 0, y1: WORLD_H },
    keepers: S.keepers.map(kp => ({ name: kp.name, colors: kp.colors, x: kp.x, c: mid, phase: kp.phase, y: G + 1, side: kp.side })),
    bossRest: boss.rest, tunnels: { north: { x0: px(t0), x1: px(t1) + 1, z0: pz(0), z1: pz(5) }, south: { x0: px(t0), x1: px(t1) + 1, z0: pz(47), z1: pz(52) } },
    entry: [58.5, G + 1, 133.5],
  };
  world.parts.push(part);
  world.keeps.push({ name: 'stadium', protect: [{ x0: box.x0, x1: box.x1, y0: 0, y1: WORLD_H, z0: box.z0, z1: box.z1 }], wallText: 'This is the stadium! Kick the ball instead.' });
  return part;
}
