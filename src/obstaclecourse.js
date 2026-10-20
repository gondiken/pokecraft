// The Obstacle Course (T36, slot 7 of the south strip): a parkour gym in the open air. Platforms float over a soft blue mat;
// you jump from block to block and walk along balance beams. Fall onto the mat and you go back to your last checkpoint
// flag. Two trainers stand on the two landings, the leader at the finish. plans/T36.md section B.
// The course is the same in every world; checkpoints live in memory only (never saved or sent).
import { B, WOOL } from './blocks.js';
import { WORLD_H, WATER_LEVEL, MID_X, MID_Z } from './world.js';
import { trainerKey } from './gyms.js';
import { sound } from './sound.js';

const HALF_D = 21, HALF_S = 19; // the whole site: flat ground and the protected box
const MAT_R = 17;               // the soft mat: Chebyshev distance <= 17 from the middle
const CURB_R = 18;              // a low ring of wool round the mat

// Pieces: [id, d0, d1, s0, s1, h, kind]. A piece's top block is at P + h (P = fy + 3). kind 'beam' = a 1-wide balance beam.
// Each joins the one before by a jump the plan allows (gap 1; gap 2 flat three times; 1 up with gap 1; 1 down with gap 1).
export const PIECES = [
  ['S0', 11, 18, -13, -9, 0],
  ['A1', 8, 9, -12, -10, 0],
  ['A2', 5, 6, -12, -10, 0],
  ['A3', 2, 3, -12, -10, 1],
  ['A4', -4, 1, -11, -11, 1, 'beam'],
  ['L1', -14, -6, -14, -8, 1],
  ['B1', -14, -11, -5, -4, 1],
  ['B2', -14, -11, -2, 2, 2],
  ['B3', -10, -4, 0, 0, 2, 'beam'],
  ['B4', -2, -1, -1, 1, 2],
  ['B5', 2, 3, -1, 1, 2],
  ['B6', 5, 6, -1, 1, 1],
  ['B7', 7, 10, 0, 0, 1, 'beam'],
  ['L2', 12, 14, -2, 6, 1],
  ['C1', 12, 14, 8, 10, 2],
  ['C2', 4, 11, 9, 9, 2, 'beam'],
  ['C3', 0, 2, 8, 10, 3],
  ['C4', -4, -3, 8, 10, 3],
  ['C5', -9, -5, 9, 9, 3, 'beam'],
  ['F', -14, -11, 8, 14, 3],
  ['E', -18, -16, 10, 12, 0],
];
// Checkpoints (local d, s, piece) and the way on from each (local direction), trainer = index in the gym's trainers.
const FLAGS = [
  { at: [12, -11], piece: 'S0', way: [-1, 0], trainer: null },
  { at: [-7, -11], piece: 'L1', way: [0, 1], trainer: 0 },
  { at: [12, 0], piece: 'L2', way: [0, 1], trainer: 1 },
  { at: [-11, 9], piece: 'F', way: [-1, 0], trainer: null },
];
const LAMP_PIECES = ['S0', 'L1', 'L2', 'F'];

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
  const bbox = (d0, d1, s0, s1) => {
    const a = col(d0, s0), b = col(d1, s1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  };
  const site = bbox(-HALF_D, HALF_D, -HALF_S, HALF_S);
  world.levelSite(site, fy, box, 0);

  // 1. The soft mat and the curb round it.
  for (let d = -CURB_R; d <= CURB_R; d++) for (let s = -CURB_R; s <= CURB_R; s++) {
    const ring = Math.max(Math.abs(d), Math.abs(s));
    if (ring <= MAT_R) putD(d, s, fy, B.SOFT_MAT);
    else putD(d, s, fy + 1, WOOL.parkour);
  }

  // 2. Stairs up to the start (d 20 = one step, d 19 = two steps) and down from the end ledge (d -19, d -20).
  const solidTo = (d, s, top) => { for (let y = fy; y <= top; y++) putD(d, s, y, WOOL.parkour); };
  for (let s = -12; s <= -10; s++) { solidTo(20, s, fy + 1); solidTo(19, s, fy + 2); }
  for (let s = 10; s <= 12; s++) { solidTo(-19, s, fy + 2); solidTo(-20, s, fy + 1); }

  // 3. The pieces: platforms two blocks thick (parkour wool, white edges so they read from afar), beams one block of BEAM.
  const boxes = {};
  for (const [id, d0, d1, s0, s1, h, kind] of PIECES) {
    const top = P + h;
    for (let d = d0; d <= d1; d++) for (let s = s0; s <= s1; s++) {
      if (kind === 'beam') { putD(d, s, top, B.BEAM); continue; }
      const edge = d === d0 || d === d1 || s === s0 || s === s1;
      putD(d, s, top, edge ? WOOL.paper : WOOL.parkour);
      putD(d, s, top - 1, WOOL.parkour);
    }
    boxes[id] = { d0, d1, s0, s1, top };
  }
  // Lamps in two corners of the start, the landings and the finish (they replace the top block, so nothing sticks up).
  for (const id of LAMP_PIECES) {
    const b = boxes[id];
    putD(b.d0, b.s0, b.top, B.LAMP);
    putD(b.d1, b.s1, b.top, B.LAMP);
  }
  // The finish arch: two posts at the back corners and a checkered bar 5 above (4 would bump your head) the platform.
  {
    const b = boxes.F;
    for (const s of [b.s0, b.s1]) for (let y = 1; y <= 5; y++) putD(b.d0, s, b.top + y, y === 5 ? WOOL.paper : WOOL.parkour);
    for (let s = b.s0 + 1; s < b.s1; s++) putD(b.d0, s, b.top + 5, (s - b.s0) % 2 ? WOOL.parkour : WOOL.paper);
  }

  // 4. Checkpoint flags (on the top of a platform) and the people.
  const cell = (d, s, y) => { const [x, z] = col(d, s); return [x + 0.5, y + 1, z + 0.5]; };
  const checkpoints = FLAGS.map(f => {
    const [x, z] = col(...f.at), y = boxes[f.piece].top;
    put(x, y, z, B.CHECKPOINT);
    const [wx, wz] = dir(...f.way);
    return { cell: [x, y, z], stand: [x + 0.5, y + 1, z + 0.5], yaw: Math.atan2(-wx, -wz), trainer: f.trainer };
  });
  const heading = (dd, ds) => { const [wx, wz] = dir(dd, ds); return Math.atan2(wx, wz); };
  const trainerPositions = [cell(-12, -13, boxes.L1.top), cell(14, -2, boxes.L2.top)];
  const leaderPos = cell(-13, 12, boxes.F.top);
  const mat = bbox(-CURB_R, CURB_R, -CURB_R, CURB_R);
  const pieces = Object.fromEntries(Object.entries(boxes).map(([id, b]) => [id, { ...bbox(b.d0, b.d1, b.s0, b.s1), y: b.top, beam: PIECES.find(p => p[0] === id)[6] === 'beam' }]));
  const [ex, ez] = col(21, -11), [xx, xz] = col(-21, 11);
  return {
    def, x: x0, z: z0, y: P + 1, fy, P, front, side,
    entry: [ex, fy + 1, ez], exit: [xx, fy + 1, xz],
    checkpoints, pieces,
    course: { ...mat, y0: fy, y1: fy + 12 }, // a fall = standing on a SOFT_MAT in here
    leaderPos, leaderHeading: heading(1, 0), trainerPos: trainerPositions[0], trainerPositions,
    trainerHeadings: [heading(1, 0), heading(-1, 0)],
    protect: [{ ...site, y0: 1, y1: WORLD_H - 1 }],
    area: { ...site, y0: fy, y1: fy + 12 },
  };
}

// The live part (LIVE.course): checkpoints and the fall onto the mat. State is per player, in memory only.
export class CourseLive {
  constructor(game, gym) {
    this.game = game;
    this.gym = gym;
    this.reached = 0; // highest checkpoint stood on this session
    this.falls = 0;
    this.last = -1;   // the flag the player stood on last frame (a toast once per visit)
    this.lit = -1;    // flags 0..lit are drawn green
    this.update(0);
  }

  beaten(i) { return i == null || this.game.beaten.includes(trainerKey(this.gym.def, i)); }

  // Where a fall sends you: the furthest flag you stood on, but never past a landing whose trainer is not beaten yet.
  target() {
    const cps = this.gym.checkpoints;
    for (let j = 1; j <= this.reached; j++) if (!this.beaten(cps[j].trainer)) return j;
    return this.reached;
  }

  indexAt(x, y, z) { return this.gym.checkpoints.findIndex(c => c.cell[0] === x && c.cell[1] === y && c.cell[2] === z); }

  draw() {
    const want = Math.max(this.reached, 0);
    if (this.lit === want) return;
    this.lit = want;
    this.gym.checkpoints.forEach((c, k) => this.game.world.setLive(c.cell[0], c.cell[1], c.cell[2], k <= want ? B.CHECKPOINT_ON : B.CHECKPOINT));
  }

  update() { this.draw(); }

  stand(x, y, z, id) {
    const g = this.gym, ui = this.game.ui;
    if (id === B.CHECKPOINT || id === B.CHECKPOINT_ON) {
      const k = this.indexAt(x, y, z);
      if (k < 0 || k === this.last) return;
      this.last = k;
      const cp = g.checkpoints[k];
      if (k > this.reached) {
        this.reached = k;
        this.draw();
        sound.play('checkpoint');
        const who = cp.trainer != null && !this.beaten(cp.trainer) ? ` ${(g.def.trainers[cp.trainer]).name} wants to battle you!` : '';
        ui?.toast(`Checkpoint! If you fall, you come back here.${who}`);
      } else if (k === 0 && this.reached > 0) {
        ui?.toast('Your flag is waiting! Hop onto the soft mat to go back to it.');
      }
      return;
    }
    this.last = -1;
    if (id !== B.SOFT_MAT) return;
    const c = g.course;
    if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1 || y < c.y0 || y > c.y1) return;
    const k = this.target(), cp = g.checkpoints[k], p = this.game.player;
    p.pos.set(...cp.stand);
    p.vel.set(0, 0, 0);
    p.yaw = cp.yaw;
    p.pitch = 0;
    this.falls++;
    sound.play('boing');
    ui?.toast(k === 0 ? 'Boing! Back to the start.' : 'Boing! Back to your last flag.');
  }

  prompt(block) {
    return block.id === B.CHECKPOINT || block.id === B.CHECKPOINT_ON ? 'Checkpoint flag' : null;
  }
}
