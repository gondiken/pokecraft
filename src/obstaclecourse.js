// The Obstacle Course (T36, grown up in T36.5; slot 7 of the south strip): a tall parkour gym in the open air. Platforms and
// beams float over a soft blue mat in three laps. Some blocks crumble after you step on them, blink blocks come and go, zap tiles
// send you back when they light up, pushers push you off the beams and springs throw you up high. Fall and you go back to your
// last checkpoint flag. Two trainers stand on two landings, the leader on the finish. plans/T36.5.md.
// The course is the same in every world; checkpoints live in memory only (never saved or sent). Timing runs on the course clock
// (the sum of the game's clamped frame dt), every state is a closed-form function of it, and only the elements near you animate.
import * as THREE from 'three';
import { B, WOOL } from './blocks.js';
import { WORLD_H, WATER_LEVEL, MID_X, MID_Z } from './world.js';
import { trainerKey } from './gyms.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';

const HALF = 22;   // the whole site: flat ground and the protected box (+-22)
const MAT_R = 19;  // the soft mat: Chebyshev distance <= 19 from the middle
const CURB_R = 20; // a raised soft rim round the mat

// [id, d0, d1, s0, s1, h, kind, extra]: a piece's top block is at P + h (P = fy + 3). Order = the way through.
// kinds: plat, beam (extra.push = [[at, side, offset]]), crumble, blinkA, blinkB, zap (extra.zap = [[a0, a1, offset]]), spring.
export const PIECES = [
  ['S0', 13, 19, -19, -13, 0, 'plat'],                       // the start (CP0)
  // 1. Jumps and crumbles: front row, towards +s
  ['A1', 14, 16, -11, -10, 0, 'plat'],
  ['A2', 14, 16, -8, -7, 0, 'plat'],
  ['A3', 14, 16, -4, -3, 0, 'plat'],                          // running jump: 2 columns of air
  ['A4', 14, 16, -1, 0, 1, 'plat'],                           // up 1
  ['C1', 14, 16, 2, 3, 1, 'crumble'],
  ['C2', 14, 16, 5, 6, 1, 'crumble'],
  ['C3', 14, 16, 8, 9, 1, 'crumble'],
  ['C4', 15, 15, 10, 10, 1, 'crumble'], ['C5', 15, 15, 11, 11, 1, 'crumble'], // the crumble bridge: run!
  ['C6', 15, 15, 12, 12, 1, 'crumble'], ['C7', 15, 15, 13, 13, 1, 'crumble'],
  ['L1', 11, 18, 14, 18, 1, 'plat'],                          // CP1
  // 2. Blink blocks: right column, towards -d
  ['B2', 8, 9, 15, 17, 1, 'plat'],
  ['K1', 5, 6, 15, 17, 1, 'blinkA'],
  ['K2', 2, 3, 15, 17, 1, 'blinkB'],
  ['K3', -1, 0, 15, 17, 1, 'blinkA'],
  ['B3', -4, -3, 15, 17, 1, 'plat'],                          // a rest
  ['K4', -7, -6, 15, 17, 2, 'blinkB'],                        // up 1 onto a blink block
  ['K5', -10, -9, 15, 17, 3, 'blinkA'],
  ['L2', -19, -12, 12, 18, 3, 'plat'],                        // CP2, Runner Remy
  // 3. Zap tiles: back row, towards -s
  ['Z1', -17, -15, 1, 11, 3, 'zap', { zap: [[8, 11, 0], [2, 5, 1.5]] }], // two strips, a safe island (s 6-7) between
  ['B4', -16, -16, -4, 0, 3, 'beam'],
  ['Z2', -17, -15, -10, -5, 3, 'zap', { zap: [[-9, -6, 0.75]] }],
  ['G1', -17, -15, -14, -13, 3, 'plat'],                      // running jump
  ['L3', -19, -14, -19, -16, 4, 'plat'],                      // CP3 (up 1)
  // 4. Pushers: up to the middle ring and along its left side, towards +d
  ['T1', -12, -11, -19, -17, 5, 'plat'],
  ['T2', -12, -11, -15, -15, 6, 'crumble'],                   // a crumbling step up
  ['M1', -12, -6, -13, -7, 6, 'plat'],
  ['P1', -5, 1, -8, -8, 6, 'beam', { push: [[-2, 1, 0]] }],   // one pusher first
  ['M2', 2, 4, -9, -7, 6, 'plat'],
  ['P2', 5, 9, -8, -8, 6, 'beam', { push: [[6, -1, 0], [8, 1, 2.5]] }],
  ['L4', 10, 12, -11, -5, 7, 'plat'],                         // CP4 (up 1 off the beam end)
  // 5. Springs: the middle ring's front side, towards +s
  ['SP1', 10, 12, -3, -2, 7, 'spring'],
  ['H1', 10, 12, 0, 2, 10, 'plat'],                           // 3 up by spring
  ['D1', 10, 12, 4, 5, 10, 'crumble'],
  ['L5', 6, 12, 7, 11, 10, 'plat'],                           // CP5, Gymnast Gigi
  // 6. Mixed: a spring back out to the outer ring, high above the blink blocks, towards -d
  ['SP2', 7, 9, 12, 13, 10, 'spring'],
  ['U1', 7, 9, 15, 17, 13, 'plat'],                           // 3 up by spring
  ['P3', 1, 6, 16, 16, 13, 'beam', { push: [[4, 1, 0], [2, -1, 2.5]] }],
  ['U2', -2, 0, 15, 17, 13, 'plat'],
  ['K6', -5, -4, 15, 17, 13, 'blinkA'],
  ['K7', -8, -7, 15, 17, 14, 'blinkB'],
  ['Z3', -14, -10, 15, 17, 14, 'zap', { zap: [[-14, -11, 0]] }],
  ['L6', -19, -15, 12, 18, 14, 'plat'],                       // CP6
  // 7. High above the zap tiles: back row, towards -s
  ['V1', -17, -15, 9, 10, 15, 'plat'],
  ['V2', -17, -15, 6, 7, 15, 'blinkA'],
  ['V3', -17, -15, 3, 4, 16, 'blinkB'],
  ['V4', -17, -15, 0, 1, 16, 'plat'],
  ['P4', -16, -16, -6, -1, 16, 'beam', { push: [[-2, 1, 0], [-5, -1, 2.5]] }],
  ['V5', -17, -15, -11, -7, 16, 'zap', { zap: [[-10, -8, 0.5]] }],
  ['V6', -17, -15, -13, -13, 17, 'crumble'],                  // up 1 onto a crumble block
  ['L7', -19, -12, -19, -15, 17, 'plat'],                     // CP7
  // 8. The grand finale: left column, towards +d
  ['W1', -10, -9, -19, -17, 17, 'blinkA'],
  ['W2', -7, -6, -19, -17, 17, 'crumble'],
  ['W3', -4, -3, -19, -17, 17, 'plat'],
  ['P5', -2, 4, -18, -18, 17, 'beam', { push: [[-1, 1, 0], [1, -1, 2.5], [3, 1, 0]] }],
  ['W4', 5, 9, -19, -17, 17, 'zap', { zap: [[6, 8, 0]] }],
  ['W5', 11, 12, -19, -17, 17, 'blinkB'],
  ['F', 14, 19, -19, -13, 17, 'plat'],                        // CP8, the finish, Leader Rio
];

// Checkpoints: the landing piece, the spot of the flag, the direction you face when sent back, the trainer (index in the
// gym's trainers) whose landing it is, and a hint shown once per session the first time you stand there.
export const FLAGS = [ // only four (owner: fewer flags make it harder): the start, the two trainers' landings, the finish
  { piece: 'S0', at: [15, -14], way: [0, 1],  trainer: null, hint: 'Run (Shift, or push the stick all the way) for long jumps. Crumbly blocks fall and blink blocks come and go: keep moving!' },
  { piece: 'L2', at: [-13, 15], way: [-1, -1], trainer: 0,   hint: 'Red zap tiles send you back: cross while they are dark. Pushers push: go when they pull back!' },
  { piece: 'L5', at: [10, 8],   way: [-1, 1], trainer: 1,    hint: 'Now everything is mixed up. Take your time!' },
  { piece: 'F',  at: [15, -16], way: [1, 0],  trainer: null, hint: 'You made it to the top! The green pad takes you back down.' },
];
const LAMP_PIECES = ['S0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

// Times in seconds (one object so the owner can tune the course).
export const TIMES = {
  crumble: { shake: 0.9, gone: 3.0 },                  // shakes 0.9 s after your first step, then gone 3 s, then back
  blink: { cycle: 4.0, on: 2.0, warn: 0.8 },           // solid for on + warn (2.8 s), flashing in the last 0.8 s, then 1.2 s gone
  zap: { cycle: 3.0, off: 1.6, warn: 0.5 },            // dark 1.6 s, flashing 0.5 s (still safe), then on 0.9 s
  push: { cycle: 3.0, rest: 1.8, warn: 0.6, dist: 2.5, speed: 10 }, // out for 0.6 s; a shove moves you 2.5 blocks in 0.25 s
};
const phase = (t, offset, cycle) => (((t - offset) % cycle) + cycle) % cycle;
export const blinkState = (t, off) => { const T = TIMES.blink, p = phase(t, off, T.cycle); return p < T.on ? 'on' : p < T.on + T.warn ? 'warn' : 'off'; };
export const zapState = (t, off) => { const T = TIMES.zap, p = phase(t, off, T.cycle); return p < T.off ? 'off' : p < T.off + T.warn ? 'warn' : 'on'; };
export const pushState = (t, off) => { const T = TIMES.push, p = phase(t, off, T.cycle); return p < T.rest ? 'rest' : p < T.rest + T.warn ? 'warn' : 'out'; };
export const crumbleState = (t, at) => { const T = TIMES.crumble; return at == null ? 'whole' : t - at < T.shake ? 'shake' : t - at < T.shake + T.gone ? 'gone' : 'whole'; };

export function buildObstacleCourse(world, def, slot) {
  const { x: x0, z: z0, box } = slot;
  const fy = Math.max(WATER_LEVEL + 1, Math.min(world.terrainHeight(x0, z0), 22));
  const P = fy + 3;
  const ddx = MID_X - x0, ddz = MID_Z - z0; // the way in faces the middle of the map, like the other gyms
  const front = Math.abs(ddx) > Math.abs(ddz) ? [Math.sign(ddx), 0] : [0, Math.sign(ddz) || 1];
  const side = [front[1], front[0]];
  const col = (d, s) => [x0 + front[0] * d + side[0] * s, z0 + front[1] * d + side[1] * s];
  const dir = (dd, ds) => [front[0] * dd + side[0] * ds, front[1] * dd + side[1] * ds]; // a local direction in world terms
  const inBox = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
  const put = (x, y, z, id) => {
    if (!inBox(x, z)) throw new Error(`Obstacle Course wrote outside its slot box at ${x},${y},${z}`);
    world.set(x, y, z, id, false);
  };
  const putD = (d, s, y, id) => { const [x, z] = col(d, s); put(x, y, z, id); };
  const cellD = (d, s, y) => { const [x, z] = col(d, s); return [x, y, z]; };
  const bbox = (d0, d1, s0, s1) => {
    const a = col(d0, s0), b = col(d1, s1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  };
  const site = bbox(-HALF, HALF, -HALF, HALF);
  world.levelSite(site, fy, box, 0);

  // 1. The soft mat and the raised rim round it (the rim counts as the mat).
  for (let d = -CURB_R; d <= CURB_R; d++) for (let s = -CURB_R; s <= CURB_R; s++) {
    putD(d, s, fy, B.SOFT_MAT);
    if (Math.max(Math.abs(d), Math.abs(s)) === CURB_R) putD(d, s, fy + 1, B.SOFT_MAT);
  }

  // 2. Stairs up to the start (d 21 = one step, d 20 = two steps; the start platform is the third).
  const solidTo = (d, s, top) => { for (let y = fy; y <= top; y++) putD(d, s, y, WOOL.parkour); };
  for (let s = -17; s <= -15; s++) { solidTo(21, s, fy + 1); solidTo(20, s, fy + 2); }

  // 3. The pieces: platforms two blocks thick (parkour wool, white edges so they read from afar), beams, crumble, blink and
  // spring blocks, zap pieces like platforms with dark strips.
  const boxes = {}, secOf = {}, secAt = new Map();
  const timed = { crumbles: [], blinks: [], zaps: [], pushers: [] };
  const flagPieces = FLAGS.map(f => f.piece);
  let sec = 0;
  for (const [id, d0, d1, s0, s1, h, kind, extra = {}] of PIECES) {
    if (flagPieces.includes(id)) sec = flagPieces.indexOf(id);
    secOf[id] = sec;
    const top = P + h;
    const cells = [];
    const alongD = d1 - d0 >= s1 - s0; // the longer side (the zap lane runs along it)
    const lane = (d, s) => (alongD ? d : s);
    const strips = kind === 'zap' ? extra.zap : [];
    for (let d = d0; d <= d1; d++) for (let s = s0; s <= s1; s++) {
      const edge = d === d0 || d === d1 || s === s0 || s === s1;
      if (kind === 'beam') putD(d, s, top, B.BEAM);
      else if (kind === 'crumble') putD(d, s, top, B.CRUMBLE);
      else if (kind === 'blinkA' || kind === 'blinkB') putD(d, s, top, B.BLINK);
      else if (kind === 'spring') { putD(d, s, top, B.SPRING); putD(d, s, top - 1, WOOL.parkour); }
      else {
        const inStrip = strips.some(([a0, a1]) => lane(d, s) >= a0 && lane(d, s) <= a1);
        putD(d, s, top, inStrip ? B.ZAP_OFF : edge ? WOOL.paper : WOOL.parkour);
        putD(d, s, top - 1, WOOL.parkour);
      }
      cells.push([d, s]);
      secAt.set(cellD(d, s, top).join(), { sec, start: id === 'S0' });
    }
    boxes[id] = { d0, d1, s0, s1, top, kind };
    const wc = cells.map(([d, s]) => cellD(d, s, top));
    if (kind === 'crumble') timed.crumbles.push({ id, cells: wc });
    if (kind === 'blinkA' || kind === 'blinkB') timed.blinks.push({ id, cells: wc, offset: kind === 'blinkA' ? 0 : 2 });
    strips.forEach(([a0, a1, offset], k) => {
      timed.zaps.push({ id: `${id}#${k}`, offset, cells: cells.filter(([d, s]) => lane(d, s) >= a0 && lane(d, s) <= a1).map(([d, s]) => cellD(d, s, top)) });
    });
    if (kind === 'beam') (extra.push || []).forEach(([at, sd, offset], k) => {
      const bd = alongD ? at : d0, bs = alongD ? s0 : at; // the beam cell the pusher guards
      const away = n => (alongD ? [bd, bs + sd * n] : [bd + sd * n, bs]); // n columns to the pusher's side
      const body = [cellD(...away(2), top + 1), cellD(...away(2), top + 2)];
      const head = [cellD(...away(1), top + 1), cellD(...away(1), top + 2)];
      for (const c of body) put(c[0], c[1], c[2], B.PUSHER);
      const [wx, wz] = dir(...(alongD ? [0, -sd] : [-sd, 0]));
      timed.pushers.push({ id: `${id}#${k}`, body, head, zone: cellD(bd, bs, top + 1), axis: wx ? 'x' : 'z', sign: wx || wz, offset });
      secAt.set(body[1].join(), { sec, start: false });
    });
  }
  // Lamps in two corners of the start and the landings, and the front corners of the finish (they replace the top block).
  for (const id of LAMP_PIECES) {
    const b = boxes[id];
    putD(b.d0, b.s0, b.top, B.LAMP);
    putD(b.d1, b.s1, b.top, B.LAMP);
  }
  {
    const b = boxes.F;
    putD(b.d0, b.s0, b.top, B.LAMP);
    putD(b.d0, b.s1, b.top, B.LAMP);
    // The finish arch: two posts at the back corners and a checkered bar 5 above the platform.
    for (const s of [b.s0, b.s1]) for (let y = 1; y <= 5; y++) putD(b.d1, s, b.top + y, y === 5 ? WOOL.paper : WOOL.parkour);
    for (let s = b.s0 + 1; s < b.s1; s++) putD(b.d1, s, b.top + 5, (s - b.s0) % 2 ? WOOL.parkour : WOOL.paper);
  }

  // 4. Checkpoint flags (on the top of a landing) and the people.
  const cell = (d, s, y) => { const [x, z] = col(d, s); return [x + 0.5, y + 1, z + 0.5]; };
  const checkpoints = FLAGS.map(f => {
    const [x, z] = col(...f.at), y = boxes[f.piece].top;
    put(x, y, z, B.CHECKPOINT);
    const [wx, wz] = dir(...f.way);
    return { cell: [x, y, z], stand: [x + 0.5, y + 1, z + 0.5], yaw: Math.atan2(-wx, -wz), trainer: f.trainer, hint: f.hint };
  });
  const heading = (dd, ds) => { const [wx, wz] = dir(dd, ds); return Math.atan2(wx, wz); };
  const trainerPositions = [cell(-17, 17, boxes.L2.top), cell(6, 9, boxes.L5.top)];
  const leaderPos = cell(17, -16, boxes.F.top);
  const mat = bbox(-CURB_R, CURB_R, -CURB_R, CURB_R);
  const pieces = Object.fromEntries(Object.entries(boxes).map(([id, b]) => [id, { ...bbox(b.d0, b.d1, b.s0, b.s1), y: b.top, kind: b.kind, beam: b.kind === 'beam', sec: secOf[id] }]));
  const [ex, ez] = col(22, -16);
  return {
    def, x: x0, z: z0, y: P + 1, fy, P, front, side,
    entry: [ex, fy + 1, ez],
    checkpoints, pieces, timed, secAt,
    ghost: timed.blinks.flatMap(b => b.cells),
    course: { ...mat, y0: fy, y1: fy + 1 }, // a fall = standing on a SOFT_MAT in here
    leaderPos, leaderHeading: heading(-1, 0), trainerPos: trainerPositions[0], trainerPositions,
    trainerHeadings: [heading(1, 0), heading(1, 0)],
    protect: [{ ...site, y0: 1, y1: WORLD_H - 1 }],
    area: { ...site, y0: fy, y1: WORLD_H - 1 },
  };
}

// The live part (LIVE.course): checkpoints, timed blocks, pushers, falls. State is per player, in memory only.
const REST = { crumble: 'whole', blink: 'on', zap: 'off', pusher: 'rest' };
const BLOCK_OF = {
  crumble: { whole: B.CRUMBLE, shake: B.CRUMBLE_SHAKE, gone: B.AIR },
  blink: { on: B.BLINK, warn: B.BLINK_WARN, off: B.AIR },
  zap: { off: B.ZAP_OFF, warn: B.ZAP_WARN, on: B.ZAP_ON },
};
const GHOST_EDGES = [[0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1], [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0],
  [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1]];

export class CourseLive {
  constructor(game, gym) {
    this.game = game;
    this.gym = gym;
    this.reached = 0; // highest checkpoint stood on this session
    this.falls = 0;
    this.zaps = 0;
    this.last = -1;   // the flag the player stood on last frame (a toast once per visit)
    this.lit = -1;    // flags 0..lit are drawn green
    this.clock = 0;   // the course clock: the sum of the game's frame dt
    this.activeR = 14;
    this.cells = new LiveCells(game.world, () => game.player);
    this.crumbleAt = new Map(); // group id -> clock when it started
    this.crumbleOf = new Map(); // 'x,y,z' -> group id
    this.shove = null;          // { axis, sign, left }
    this.wasAir = false;
    this.lastTop = null;
    // Every timed element with its cells, the middle of its column and the last drawn state.
    const mid = cells => [cells.reduce((a, c) => a + c[0], 0) / cells.length, cells.reduce((a, c) => a + c[2], 0) / cells.length];
    this.els = [];
    const T = gym.timed;
    for (const c of T.crumbles) {
      this.els.push({ kind: 'crumble', ...c, y: c.cells[0][1], mid: mid(c.cells), drawn: 'whole' });
      for (const k of c.cells) this.crumbleOf.set(k.join(), c.id);
    }
    for (const b of T.blinks) this.els.push({ kind: 'blink', ...b, y: b.cells[0][1], mid: mid(b.cells), drawn: 'on' });
    for (const z of T.zaps) this.els.push({ kind: 'zap', ...z, y: z.cells[0][1], mid: mid(z.cells), drawn: 'off' });
    for (const p of T.pushers) this.els.push({ kind: 'pusher', ...p, cells: [...p.body, ...p.head], y: p.zone[1], mid: mid([p.zone]), drawn: 'rest' });
    // A white outline on every blink block's edges (also while it is gone), so you can see where it comes back.
    this.ghost = null;
    const scene = game.world?.scene;
    if (scene && gym.ghost.length) {
      const v = [];
      for (const [x, y, z] of gym.ghost) for (const e of GHOST_EDGES) v.push(x + e[0], y + e[1], z + e[2], x + e[3], y + e[4], z + e[5]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      this.ghost = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
      this.ghost.frustumCulled = false;
      scene.add(this.ghost);
    }
    this.draw();
  }

  beaten(i) { return i == null || this.game.beaten.includes(trainerKey(this.gym.def, i)); }

  // Where a fall sends you: the furthest flag you stood on.
  target() {
    return this.reached; // the leader only battles once both trainers are beaten, so a flag never needs to wait for them
  }

  indexAt(x, y, z) { return this.gym.checkpoints.findIndex(c => c.cell[0] === x && c.cell[1] === y && c.cell[2] === z); }

  draw() {
    const want = Math.max(this.reached, 0);
    if (this.lit === want) return;
    this.lit = want;
    this.gym.checkpoints.forEach((c, k) => this.game.world.setLive(c.cell[0], c.cell[1], c.cell[2], k <= want ? B.CHECKPOINT_ON : B.CHECKPOINT));
  }

  // The state an element should show now (closed form of the clock); inactive ones show their rest state.
  stateOf(el, active) {
    if (el.kind === 'crumble') {
      const at = this.crumbleAt.get(el.id);
      return crumbleState(this.clock, at); // a counting crumble finishes wherever you are
    }
    if (!active) return REST[el.kind];
    if (el.kind === 'blink') return blinkState(this.clock, el.offset);
    if (el.kind === 'zap') return zapState(this.clock, el.offset);
    return pushState(this.clock, el.offset);
  }

  isActive(el, p) {
    if (this.activeR >= 999) return true;
    return Math.max(Math.abs(p.x - el.mid[0] - 0.5), Math.abs(p.z - el.mid[1] - 0.5)) <= this.activeR && Math.abs(p.y - el.y) <= 7;
  }

  paint(el, state) {
    if (el.kind === 'pusher') {
      const [b0, b1, h0, h1] = el.cells;
      const body = state === 'warn' ? B.PUSHER_WARN : B.PUSHER, head = state === 'out' ? B.PUSHER_HEAD : B.AIR;
      this.cells.want(...b0, body);
      this.cells.want(...b1, body);
      this.cells.want(...h0, head);
      this.cells.want(...h1, head);
      return;
    }
    const id = BLOCK_OF[el.kind][state];
    for (const c of el.cells) this.cells.want(c[0], c[1], c[2], id);
  }

  update(dt = 0) {
    const g = this.game, p = g.player;
    this.clock += dt;
    if (!p) return;
    // Walked right out of the course (the mat is inside, so a fall is not leaving): the flags start over.
    const a = this.gym.area;
    if (this.reached > 0 && !g.inBattle && (p.pos.x < a.x0 || p.pos.x >= a.x1 + 1 || p.pos.z < a.z0 || p.pos.z >= a.z1 + 1)) {
      this.reached = 0;
      this.last = -1;
      this.draw();
      g.ui?.toast('You left the Obstacle Course. Next time you start from the beginning!');
    }
    // A shove in progress (walls stop it).
    if (this.shove) {
      const sh = this.shove, step = Math.min(sh.left, TIMES.push.speed * dt);
      const before = p.pos[sh.axis];
      p.moveAxis(sh.axis, sh.sign * step);
      sh.left -= step;
      if (sh.left <= 1e-6 || Math.abs(p.pos[sh.axis] - before) < step * 0.5) this.shove = null;
    }
    // Timed elements: a block is written only when its state changes.
    for (const el of this.els) {
      const want = this.stateOf(el, this.isActive(el, p.pos));
      if (el.kind === 'crumble' && want === 'whole' && this.crumbleAt.has(el.id)) this.crumbleAt.delete(el.id);
      if (want !== el.drawn) { el.drawn = want; this.paint(el, want); }
    }
    this.cells.flush();
    if (g.inBattle) { this.draw(); return; }
    // Crumble footprint (the cells under the corners of your box), then the earlier-section catch.
    if (p.onGround) {
      const hw = p.halfW ?? 0.3, fy = Math.floor(p.pos.y - 0.05);
      for (const dx of [-hw, hw]) for (const dz of [-hw, hw]) {
        const id = this.crumbleOf.get(`${Math.floor(p.pos.x + dx)},${fy},${Math.floor(p.pos.z + dz)}`);
        if (id && !this.crumbleAt.has(id)) { this.crumbleAt.set(id, this.clock); sound.play('crumble'); }
      }
      const e = this.gym.secAt.get(`${Math.floor(p.pos.x)},${fy},${Math.floor(p.pos.z)}`);
      const k = this.target();
      if (e?.start && k > 0) { this.sendBack('start'); return; }
      if (e && e.sec < k && this.wasAir && this.lastTop != null && this.lastTop - fy >= 2) { this.sendBack('fall'); return; }
      if (e || !this.wasAir || this.lastTop == null) this.lastTop = fy;
    }
    // Pushers that are out shove you one way.
    if (!this.shove) {
      for (const el of this.els) {
        if (el.kind !== 'pusher' || el.drawn !== 'out') continue;
        const [x, y, z] = el.zone;
        if (p.overlapsBlock(x, y, z) || p.overlapsBlock(x, y + 1, z)) {
          this.shove = { axis: el.axis, sign: el.sign, left: TIMES.push.dist };
          sound.play('whoosh');
          break;
        }
      }
    }
    this.draw();
    this.wasAir = !p.onGround;
  }

  sendBack(why) {
    const g = this.gym, k = this.target(), cp = g.checkpoints[k], p = this.game.player;
    p.pos.set(...cp.stand);
    p.vel.set(0, 0, 0);
    p.yaw = cp.yaw;
    p.pitch = 0;
    this.shove = null;
    this.lastTop = cp.cell[1];
    this.wasAir = false;
    this.last = k;
    if (why === 'start') { sound.play('boing'); this.game.ui?.toast('Your flag is waiting! Whoosh!'); return; }
    this.falls++;
    if (why === 'zap') this.zaps++;
    sound.play(why === 'zap' ? 'zap' : 'boing');
    this.game.ui?.toast(`${why === 'zap' ? 'Zap!' : 'Boing!'} ${k === 0 ? 'Back to the start.' : 'Back to your last flag.'}`);
  }

  stand(x, y, z, id) {
    const g = this.gym, ui = this.game.ui;
    if (id === B.CHECKPOINT || id === B.CHECKPOINT_ON) {
      const k = this.indexAt(x, y, z);
      if (k < 0 || k === this.last) return;
      this.last = k;
      const cp = g.checkpoints[k], told = this.game.toldOnce;
      if (k > this.reached) {
        this.reached = k;
        this.draw();
        sound.play('checkpoint');
        told?.add(`course:${k}`);
        const who = cp.trainer != null && !this.beaten(cp.trainer) ? ` ${(g.def.trainers[cp.trainer]).name} wants to battle you!` : '';
        ui?.toast(`Checkpoint! ${cp.hint}${who}`);
      } else if (k === 0 && told && !told.has('course:0')) {
        told.add('course:0');
        ui?.toast(cp.hint);
      }
      return;
    }
    this.last = -1;
    if (id === B.ZAP_ON) { this.sendBack('zap'); return; }
    if (id !== B.SOFT_MAT) return;
    const c = g.course;
    if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1 || y < c.y0 || y > c.y1) return;
    // With the badge, jumping down from the finish is the way out (no exit pad: kids stepped on it before the battle).
    if (this.reached === g.checkpoints.length - 1 && this.game.badges?.includes(g.def.id)) {
      this.reached = 0;
      this.last = -1;
      this.draw();
      ui?.toast('Great run! Come back any time.');
      return;
    }
    this.sendBack('fall');
  }

  prompt(block) {
    if (block.id === B.CHECKPOINT || block.id === B.CHECKPOINT_ON) return 'Checkpoint flag';
    return null;
  }

  dispose() {
    if (!this.ghost) return;
    this.ghost.parent?.remove(this.ghost);
    this.ghost.geometry.dispose();
    this.ghost.material.dispose();
    this.ghost = null;
  }
}
