// The Firewall Maze (Cyber gym, T19 slot 2): a long cyber-wool building with three laser rooms, then the server room.
// Red and blue lasers block the way; stepping on a switch turns one colour off and the other on. A purple "friend"
// lane opens when another player stands on a friend pad (optional, never needed). Lasers are per player, never
// saved or sent; they sit inside the gym's protected box. See plans/T19.md section 4.3.
import { B, WOOL } from './blocks.js';
import { WORLD_H, WATER_LEVEL, MID_X, MID_Z } from './world.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';

// Legend: . floor  # maze wall (glass)  R red laser  B blue laser  r red switch (red off, blue on)  b blue switch
// (blue off, red on)  P friend laser  p friend pad. Start state: red on, blue off. Row 0 is the entry side (door above
// column 5), the exit door is below row 8 at column 5.
export const ROOMS = [
  [
    '........p..',
    '.........#P',
    '..r......#.',
    '####RRR###.',
    '.........#.',
    '.B.....B.#.',
    '.........#.',
    '.........#.',
    '........p..',
  ],
  [
    '........p..',
    '.........#P',
    '.......r.#.',
    '#####R####.',
    '.........#.',
    '.b.......#.',
    '.........#.',
    '####BBB###.',
    '........p..',
  ],
  [
    '........p..',
    '.......r.#P',
    '#####R####.',
    '..#....###.',
    'r.B.b..###.',
    '..#....###.',
    '#R########.',
    '.........#.',
    '........p..',
  ],
];

// Solves a room grid: BFS over (row, column, phase) from the entry cell. phase 0 = red on / blue off, 1 = the other
// way round. Walking onto `r` makes phase 1, onto `b` phase 0. `friend` = the purple lane is open.
// Returns { solvable, presses (fewest switch flips to the exit, or -1), trap (a reachable state that cannot reach the exit) }.
export function solveRoom(rows, { friend = false } = {}) {
  const H = rows.length, W = rows[0].length;
  const open = (r, c, ph) => {
    const ch = rows[r]?.[c];
    if (ch === undefined || ch === '#') return false;
    if (ch === 'R') return ph === 1;
    if (ch === 'B') return ph === 0;
    if (ch === 'P') return friend;
    return true;
  };
  const after = (r, c, ph) => (rows[r][c] === 'r' ? 1 : rows[r][c] === 'b' ? 0 : ph);
  const key = (r, c, ph) => (r * W + c) * 2 + ph;
  const next = (r, c, ph) => {
    const out = [];
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (open(nr, nc, ph)) out.push([nr, nc, after(nr, nc, ph)]);
    }
    return out;
  };
  const isExit = r => r === H - 1;
  // Fewest flips: Dijkstra with cost 1 when the phase changes, 0 otherwise.
  const dist = new Map();
  const start = [0, 5, after(0, 5, 0)];
  dist.set(key(...start), 0);
  const queue = [[0, start]];
  const reach = [];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, s] = queue.shift();
    if (d > dist.get(key(...s))) continue;
    reach.push(s);
    for (const n of next(...s)) {
      const nd = d + (n[2] !== s[2] ? 1 : 0), k = key(...n);
      if (!dist.has(k) || nd < dist.get(k)) { dist.set(k, nd); queue.push([nd, n]); }
    }
  }
  let presses = -1;
  for (const s of reach) if (isExit(s[0]) && (presses < 0 || dist.get(key(...s)) < presses)) presses = dist.get(key(...s));
  // Trap check: every reachable state must still be able to reach an exit cell.
  const canExit = new Map();
  const reaches = s => {
    const seen = new Set([key(...s)]), st = [s];
    while (st.length) {
      const cur = st.pop();
      if (isExit(cur[0])) return true;
      for (const n of next(...cur)) if (!seen.has(key(...n))) { seen.add(key(...n)); st.push(n); }
    }
    return false;
  };
  let trap = false;
  for (const s of reach) { if (!reaches(s)) { trap = true; break; } canExit.set(key(...s), true); }
  return { solvable: presses >= 0, presses, trap };
}

const COLS = { red: WOOL.fire, blue: WOOL.water, friend: WOOL.toxic };

// Where each room is: grid (r, c) -> local (d, s). Rotations, no mirror (plans/T19.md 4.3).
export const ROOM_AT = [
  (r, c) => [5 - r, -17 + c], // room 1 (A)
  (r, c) => [-3 + r, 5 - c], // room 2 (B)
  (r, c) => [5 - r, 7 + c], // room 3 (C)
];
// Reset button wall cell (local d, s) next to each room's entry door.
export const RESET_AT = [[6, -11], [-4, 1], [6, 13]];

const inFoot = (d, s) => Math.abs(s) <= 18 && d <= 10 && (d >= -8 || s >= 6);

// Is the wall at local (d, s) a wall (not air inside a space)?
function isWall(d, s) {
  if (!inFoot(d, s)) return false;
  if (Math.abs(s) === 18 || d === 10 || d === 6 || d === -4) return true;
  if (d === -8 && s <= 5) return true;
  if (d === -14) return true;
  if (s === 6 && d >= -14 && d <= 6) return true;
  if (s === -6 && d >= -4 && d <= 9) return true;
  return false;
}
// 1-wide doors in the inner walls and the 3-wide entrance.
const DOORS = [[6, -12], [-4, -12], [-4, 0], [6, 0], [6, 12], [-4, 12], [10, -13], [10, -12], [10, -11]];
const isDoor = (d, s) => DOORS.some(([a, b]) => a === d && b === s);

// Local (d, s) of a gym -> world column (d steps towards the door, s sideways).
export const mazeCol = (g, d, s) => [g.x + g.front[0] * d + g.front[1] * s, g.z + g.front[1] * d + g.front[0] * s];

export function buildFirewallMaze(world, def, slot) {
  const x0 = slot.x, z0 = slot.z, box = slot.box;
  const ddx = MID_X - x0, ddz = MID_Z - z0; // the door faces the middle of the map, like the other gyms
  const front = Math.abs(ddx) > Math.abs(ddz) ? [Math.sign(ddx), 0] : [0, Math.sign(ddz) || 1];
  const col = (d, s) => mazeCol({ x: x0, z: z0, front }, d, s);
  const fy = Math.max(WATER_LEVEL + 1, Math.min(world.terrainHeight(x0, z0), 26));

  const put = (d, s, y, id) => {
    const [x, z] = col(d, s);
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) throw new Error(`Firewall Maze: write outside the slot box at ${x},${y},${z}`);
    world.set(x, y, z, id, false);
  };
  const bbox = (d0, d1, s0, s1) => {
    const a = col(d0, s0), b = col(d1, s1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  };

  world.levelSite(bbox(-14, 10, -18, 18), fy, box, 2);
  const CY = WOOL.cyber;

  // The shell: floor, walls (glass band on the outside), ceiling and roof.
  for (let d = -14; d <= 10; d++) for (let s = -18; s <= 18; s++) {
    if (!inFoot(d, s)) continue;
    put(d, s, fy, B.STONE_BRICKS);
    const wall = isWall(d, s) && !isDoor(d, s);
    const outer = Math.abs(s) === 18 || d === 10 || d === -14 || (d === -8 && s <= 5);
    const corner = Math.abs(s) === 18 && (d === 10 || d === -14 || d === -8);
    const glass = wall && outer && !corner && (Math.abs(s) === 18 ? d % 2 !== 0 : s % 2 !== 0); // a glass window every other block
    for (let y = fy + 1; y <= fy + 3; y++) {
      if (wall) put(d, s, y, glass && y === fy + 2 ? B.GLASS : CY);
      else put(d, s, y, B.AIR);
    }
    put(d, s, fy + 4, CY);
    put(d, s, fy + 5, CY);
  }
  // Corners and the entrance: lamps beside the door, a wool frame above it.
  for (const s of [-14, -10]) put(10, s, fy + 3, B.LAMP);
  for (const s of [-13, -12, -11]) put(10, s, fy + 4, WOOL.fire);
  // Lamp posts in front.
  for (const s of [-16, -8]) { put(11, s, fy + 1, B.STONE_BRICKS); put(11, s, fy + 2, B.STONE_BRICKS); put(11, s, fy + 3, B.LAMP); }
  // Antenna masts on the roof, each with a lamp on top.
  for (const [d, s] of [[8, -16], [8, 16], [-6, -16], [-12, 16], [-12, 8]]) {
    for (let y = fy + 6; y <= fy + 8; y++) put(d, s, y, CY);
    put(d, s, fy + 9, B.LAMP);
  }
  // Ceiling lamps: corridors and the lobby every 4 blocks, the server room in rows.
  for (let s = -16; s <= 16; s += 4) put(8, s, fy + 4, B.LAMP);
  for (let s = -16; s <= 4; s += 4) put(-6, s, fy + 4, B.LAMP);
  for (const d of [-7, -11]) for (const s of [9, 15]) put(d, s, fy + 4, B.LAMP);

  // Server room: racks of cyber wool with lamps for blinking lights, rows along both side walls.
  for (const s of [8, 16]) for (const d of [-12, -10, -8, -6]) {
    put(d, s, fy + 1, CY); put(d, s, fy + 2, B.LAMP); put(d, s, fy + 3, CY);
  }

  // The three laser rooms.
  const rooms = [];
  ROOMS.forEach((rows, k) => {
    const at = ROOM_AT[k];
    const room = { red: [], blue: [], friend: [], switches: new Map(), pads: new Set(), reset: null, box: null };
    const cells = [];
    rows.forEach((line, r) => [...line].forEach((ch, c) => {
      const [d, s] = at(r, c), [x, z] = col(d, s);
      cells.push([x, z]);
      if (ch === '#') { for (let y = fy + 1; y <= fy + 3; y++) put(d, s, y, B.GLASS); return; }
      if (ch === 'r') { put(d, s, fy, B.SWITCH_RED); room.switches.set(`${x},${fy},${z}`, 'red'); return; }
      if (ch === 'b') { put(d, s, fy, B.SWITCH_BLUE); room.switches.set(`${x},${fy},${z}`, 'blue'); return; }
      if (ch === 'p') { put(d, s, fy, B.FRIEND_PAD); room.pads.add(`${x},${z}`); return; }
      const kind = ch === 'R' ? 'red' : ch === 'B' ? 'blue' : ch === 'P' ? 'friend' : null;
      if (!kind) return;
      put(d, s, fy, COLS[kind]);
      put(d, s, fy + 4, COLS[kind]);
      for (let y = fy + 1; y <= fy + 3; y++) {
        room[kind].push([x, y, z]);
        put(d, s, y, kind === 'red' ? B.LASER_RED : kind === 'friend' ? B.LASER_FRIEND : B.AIR); // red and friend start on
      }
    }));
    const [rd, rs] = RESET_AT[k], [rx, rz] = col(rd, rs);
    put(rd, rs, fy + 2, B.RESET_BUTTON);
    room.reset = [rx, fy + 2, rz];
    room.box = {
      x0: Math.min(...cells.map(c => c[0])), x1: Math.max(...cells.map(c => c[0])),
      z0: Math.min(...cells.map(c => c[1])), z1: Math.max(...cells.map(c => c[1])),
      y0: fy + 1, y1: fy + 3,
    };
    rooms.push(room);
  });

  // People: trainer 1 in the back corridor, trainer 2 in the front corridor, the leader in the server room.
  const at = (d, s) => { const [x, z] = col(d, s); return [x + 0.5, fy + 1, z + 0.5]; };
  const pr = bbox(-15, 11, -19, 19);
  const inner = bbox(-13, 9, -17, 17);
  world.markLitBox(pr.x0, pr.x1, pr.z0, pr.z1);
  return {
    def, x: x0, z: z0, y: fy + 1, front,
    leaderPos: at(-11, 12), trainerPos: at(-6, -6), trainerPositions: [at(-6, -6), at(8, 6)],
    protect: [{ ...pr, y0: 1, y1: WORLD_H - 1 }], // everything: lasers, switches, buttons, roof
    area: { ...inner, y0: fy, y1: fy + 5 },
    rooms, fy,
  };
}

// Runtime part of the gym: switches, reset buttons and friend pads. State is per player and never saved or sent.
export class MazeLive {
  constructor(game, gym) {
    this.game = game;
    this.gym = gym;
    this.cells = new LiveCells(game.world, () => game.player);
    this.phase = gym.rooms.map(() => 0); // 0 = red on, 1 = blue on
    this.friend = gym.rooms.map(() => false);
    this.acc = 0;
    gym.rooms.forEach((_, i) => this.apply(i));
  }

  // Put the lasers of room i in the state it should be in (a laser never turns on inside you: LiveCells waits).
  apply(i) {
    const room = this.gym.rooms[i], ph = this.phase[i], fr = this.friend[i];
    for (const [x, y, z] of room.red) this.cells.want(x, y, z, ph ? B.AIR : B.LASER_RED);
    for (const [x, y, z] of room.blue) this.cells.want(x, y, z, ph ? B.LASER_BLUE : B.AIR);
    for (const [x, y, z] of room.friend) this.cells.want(x, y, z, fr ? B.AIR : B.LASER_FRIEND);
  }

  set(i, phase) {
    if (this.phase[i] === phase) return;
    this.phase[i] = phase;
    this.apply(i);
    sound.play('laserflip');
  }

  // The player stands on a block: a switch flips its room.
  stand(x, y, z, id) {
    if (id !== B.SWITCH_RED && id !== B.SWITCH_BLUE) return;
    const key = `${x},${y},${z}`;
    const i = this.gym.rooms.findIndex(r => r.switches.has(key));
    if (i >= 0) this.set(i, id === B.SWITCH_RED ? 1 : 0);
  }

  roomOfReset(block) {
    return this.gym.rooms.findIndex(r => r.reset[0] === block.x && r.reset[1] === block.y && r.reset[2] === block.z);
  }

  hit(block) {
    const i = block.id === B.RESET_BUTTON ? this.roomOfReset(block) : -1;
    if (i < 0) return false;
    this.phase[i] = 0;
    this.apply(i);
    sound.play('laserflip');
    this.game.ui.toast('Room reset!');
    return true;
  }

  prompt(block, how) {
    return block.id === B.RESET_BUTTON && this.roomOfReset(block) >= 0 ? `Reset button · ${how} to reset the room` : null;
  }

  update(dt) {
    this.acc += dt;
    if (this.acc >= 0.25) {
      this.acc = 0;
      const others = this.game.mp?.active ? [...this.game.mp.others.values()] : [];
      this.gym.rooms.forEach((room, i) => {
        const on = others.some(a => a.pos && room.pads.has(`${Math.floor(a.pos.x)},${Math.floor(a.pos.z)}`) && Math.abs(a.pos.y - (this.gym.fy + 1)) < 0.6);
        if (on !== this.friend[i]) { this.friend[i] = on; this.apply(i); }
      });
    }
    this.cells.flush();
  }
}
