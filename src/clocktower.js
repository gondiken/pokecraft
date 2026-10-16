// The Clock Tower (T19, Time gym, slot 0): a tall tower with a 24-hour clock face on the front, stairs that wind up
// the outside, and three doors (morning, afternoon, night) that open by game time. Plan: plans/T19.md section 4.1.
//
// Local coordinates: `d` steps along `front` (the door side), `s` steps across (`side`). Every block stays inside
// the slot box. The doors are LIVE blocks (world.setLive, this player only, never saved or sent).
import * as THREE from 'three';
import { B, WOOL, isSolid } from './blocks.js';
import { WORLD_H, WATER_LEVEL } from './world.js';
import { trainersOf } from './gyms.js';
import { WINDOWS, windowAt } from './daytime.js';
import { sound } from './sound.js';

const R = 5; // the core's half size (walls at Chebyshev 5)
const FACE_R = 5.5; // radius of the clock face (blocks)
const HAND_LEN = 4.4;
const WINDOW_WOOL = { morning: WOOL.light, afternoon: WOOL.fire, night: WOOL.cosmic };

// The stairs outside: every cell is { d, s, i }; i = walk order (both cells of the band share it), the step block's
// height is fy + 1 + floor(i / 2), so one step up every 2 blocks, with flat landings in front of the three doors.
function stairCells() {
  const out = [];
  for (let d = 7; d >= -R; d--) for (const s of [-6, -7]) out.push({ d, s, i: 7 - d }); // left side, from the front
  for (const d of [-6, -7]) for (let s = -7; s <= 7; s++) out.push({ d, s, i: 13 + (s + 7) }); // back
  for (let d = -R; d <= 2; d++) for (const s of [6, 7]) out.push({ d, s, i: 28 + (d + R) }); // right side, up to floor 3
  return out;
}
export const stairHeight = (fy, i) => fy + 1 + Math.floor(i / 2);

export function buildClockTower(world, def, slot) {
  const box = slot.box;
  const x0 = slot.x, z0 = slot.z;
  // The door faces the middle of the map, along whichever axis is closer (like placeGym).
  const dx = 112 - x0, dz = 112 - z0;
  const front = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1];
  const side = [front[1], front[0]];
  const right = [front[1], -front[0]]; // the viewer's right when looking at the front
  const fy = Math.max(WATER_LEVEL + 1, Math.min(world.terrainHeight(x0, z0), 20));
  const cell = (d, s) => [x0 + front[0] * d + side[0] * s, z0 + front[1] * d + side[1] * s];
  const put = (x, y, z, id) => {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1 || y < 1 || y >= WORLD_H) throw new Error(`clock tower: block outside its slot box (${x}, ${y}, ${z})`);
    world.set(x, y, z, id, false);
  };
  const putDS = (d, s, y, id) => { const [x, z] = cell(d, s); put(x, y, z, id); };
  const cheb = (d, s) => Math.max(Math.abs(d), Math.abs(s));

  // Level ground, a stone-brick plaza round the tower.
  world.levelSite({ x0: x0 - 9, x1: x0 + 9, z0: z0 - 9, z1: z0 + 9 }, fy, box, 2);
  for (let d = -9; d <= 9; d++) for (let s = -9; s <= 9; s++) putDS(d, s, fy, B.STONE_BRICKS);

  // Core: walls, floors, roof.
  const TIME = WOOL.time;
  for (let d = -R; d <= R; d++) for (let s = -R; s <= R; s++) {
    const wall = cheb(d, s) === R, corner = Math.abs(d) === R && Math.abs(s) === R;
    for (let k = 0; k <= 3; k++) { // floors (k = 0 is the lobby floor)
      if (wall) continue;
      putDS(d, s, fy + 6 * k, B.PLANKS);
    }
    if (wall) {
      for (let y = fy + 1; y <= fy + 23; y++) putDS(d, s, y, corner ? TIME : B.STONE_BRICKS);
      for (const k of [0, 1, 2, 3]) putDS(d, s, fy + 6 * k, TIME); // a brass band at every floor level
    }
    putDS(d, s, fy + 24, TIME); // roof slab
    if (cheb(d, s) <= 3) putDS(d, s, fy + 25, TIME);
    if (cheb(d, s) <= 1) putDS(d, s, fy + 26, TIME);
  }
  putDS(0, 0, fy + 27, B.LAMP);

  // Lobby: a 3 x 3 door in the front wall, a carpet, and a legend: 1 yellow, 2 orange, 3 dark blue = floors 1, 2, 3.
  for (let s = -1; s <= 1; s++) for (let y = fy + 1; y <= fy + 3; y++) putDS(R, s, y, B.AIR);
  for (let d = -4; d <= 4; d++) for (let s = -1; s <= 1; s++) putDS(d, s, fy, TIME);
  [[-2, WOOL.light, 1], [0, WOOL.fire, 2], [2, WOOL.cosmic, 3]].forEach(([s, id, n]) => {
    for (let y = 1; y <= n; y++) putDS(-4, s, fy + y, id);
  });

  // Lamps (two in the ceiling corners of every room) .
  for (let k = 0; k <= 3; k++) for (const s of [-4, 4]) putDS(-4, s, fy + 6 * k + 5, B.LAMP);

  // Floor doors: beside each landing, 2 wide x 3 tall, generated closed, with a frame in the window's colour.
  const trainers = trainersOf(def);
  const opens = [...trainers.map(t => t.opens), def.leader.opens]; // by floor (1, 2, 3)
  // wall: 'L' (s = -5), 'B' (d = -5), 'R' (s = 5); a0, a1 = the door's two cells along the wall.
  const DOORS = [{ wall: 'L', a: [-3, -4] }, { wall: 'B', a: [2, 3] }, { wall: 'R', a: [1, 2] }];
  const onWall = (wall, a) => (wall === 'L' ? [a, -R] : wall === 'B' ? [-R, a] : [a, R]);
  const floors = DOORS.map(({ wall, a }, n) => {
    const k = n + 1, y0 = fy + 6 * k + 1, win = opens[n];
    const frame = WINDOW_WOOL[win];
    const lo = Math.min(...a), hi = Math.max(...a);
    for (let y = y0; y <= y0 + 3; y++) for (let al = lo - 1; al <= hi + 1; al++) {
      const [d, s] = onWall(wall, al);
      if (y === y0 + 3 || al < lo || al > hi) putDS(d, s, y, frame); // lintel and the two sides
    }
    const door = [];
    for (const al of a) for (let y = y0; y <= y0 + 2; y++) {
      const [d, s] = onWall(wall, al);
      putDS(d, s, y, B.CLOCK_DOOR);
      const [x, z] = cell(d, s);
      door.push([x, y, z]);
    }
    // Windows (2 wide, 2 high) on the same wall, away from the door.
    const wins = wall === 'L' ? [0, 1] : [-3, -2];
    for (const al of wins) for (let y = fy + 6 * k + 3; y <= fy + 6 * k + 4; y++) { const [d, s] = onWall(wall, al); putDS(d, s, y, B.GLASS); }
    // Where the person stands (centred on the doorway, 3 cells in) and which way they face (out of the door).
    const mid = (lo + hi) / 2;
    const [pd, ps] = wall === 'L' ? [mid, -2] : wall === 'B' ? [-2, mid] : [mid, 2];
    const out = wall === 'L' ? [-side[0], -side[1]] : wall === 'B' ? [-front[0], -front[1]] : side;
    const pos = [x0 + 0.5 + front[0] * pd + side[0] * ps, fy + 6 * k + 1, z0 + 0.5 + front[1] * pd + side[1] * ps];
    const xs = [x0 - R, x0 + R], zs = [z0 - R, z0 + R];
    return {
      window: win, door, pos, heading: Math.atan2(out[0], out[1]),
      // inside the room or doorway: the door stays open while the player is here
      room: { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: fy + 6 * k + 1, y1: fy + 6 * k + 6 },
    };
  });

  // Stairs outside, with glass railings.
  const cells = stairCells();
  const hAt = new Map(cells.map(c => [`${c.d},${c.s}`, stairHeight(fy, c.i)]));
  for (const c of cells) {
    const h = hAt.get(`${c.d},${c.s}`);
    for (let y = fy + 1; y < h; y++) putDS(c.d, c.s, y, B.STONE_BRICKS);
    putDS(c.d, c.s, h, B.PLANKS);
  }
  const rails = new Map(); // 'd,s' -> [min height, max height] of the stair cells beside it
  for (const c of cells) {
    const h = hAt.get(`${c.d},${c.s}`);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const d = c.d + a, s = c.s + b, key = `${d},${s}`;
      if (hAt.has(key) || cheb(d, s) <= R) continue; // stairs and the core walls
      if (d >= 8 || d < -8 || Math.abs(s) > 8 || (d >= 6 && Math.abs(s) <= 5)) continue; // the entrance and the face stay open
      const r = rails.get(key);
      rails.set(key, r ? [Math.min(r[0], h), Math.max(r[1], h)] : [h, h]);
    }
  }
  for (const [key, [lo, hi]] of rails) {
    const [d, s] = key.split(',').map(Number);
    for (let y = lo + 1; y <= hi + 2; y++) {
      const [x, z] = cell(d, s);
      if (world.get(x, y, z) === B.AIR) putDS(d, s, y, B.GLASS);
    }
  }

  // The clock face: 24-hour dial one block in front of the front wall. 06:00 is on the left, noon at the top,
  // 18:00 on the right, midnight at the bottom; the day half is light, the night half dark.
  const cy = fy + 14;
  const faceCell = (sr, y) => [x0 + front[0] * 6 + right[0] * sr, z0 + front[1] * 6 + right[1] * sr];
  for (let sr = -5; sr <= 5; sr++) for (let dy = -5; dy <= 5; dy++) {
    const r2 = sr * sr + dy * dy;
    if (r2 > FACE_R * FACE_R) continue;
    let id = WOOL.paper;
    if (r2 === 0) id = TIME;
    else if (r2 > 4.2 * 4.2) {
      const a = Math.atan2(sr, dy);
      id = a >= -Math.PI / 2 && a < 0 ? WINDOW_WOOL.morning : a >= 0 && a < Math.PI / 2 ? WINDOW_WOOL.afternoon : WINDOW_WOOL.night;
      if ((sr === 0 || dy === 0) && r2 === 25) id = B.LAMP; // 06, 12, 18, 24
    }
    const [x, z] = faceCell(sr);
    put(x, cy + dy, z, id);
  }

  world.markLit(x0, z0);
  const pbox = { x0: x0 - 9, x1: x0 + 9, y0: 1, y1: WORLD_H - 1, z0: z0 - 9, z1: z0 + 9 };
  const y0g = fy + 1;
  const poses = floors.map(f => f.pos);
  return {
    def, x: x0, z: z0, y: y0g, front, fy,
    leaderPos: poses[2], trainerPos: poses[0], trainerPositions: [poses[0], poses[1]],
    trainerHeadings: [floors[0].heading, floors[1].heading], leaderHeading: floors[2].heading,
    floors, face: { centre: [x0 + front[0] * 6 + 0.5, cy + 0.5, z0 + front[1] * 6 + 0.5], front, right },
    protect: [pbox],
    area: { x0: x0 - 8, x1: x0 + 8, z0: z0 - 8, z1: z0 + 8, y0: fy, y1: fy + 26 },
  };
}

// A door cell that should change, waiting while the player stands in it (a door never closes on you). Same idea as
// LiveCells in gymlive.js, kept here because gymlive.js imports this file (importing back would be a cycle that
// breaks at load time).
class WaitingCells {
  constructor(world, player) { this.world = world; this.player = player; this.waiting = new Map(); }
  want(x, y, z, id) {
    const key = `${x},${y},${z}`;
    if (this.world.get(x, y, z) === id) { this.waiting.delete(key); return; }
    if (isSolid(id) && this.player()?.overlapsBlock(x, y, z)) { this.waiting.set(key, [x, y, z, id]); return; }
    this.waiting.delete(key);
    this.world.setLive(x, y, z, id);
  }
}

// Runtime part: the clock's hand and the three doors (see src/gymlive.js for the interface).
export class ClockLive {
  constructor(game, gym) {
    this.game = game;
    this.gym = gym;
    this.cells = new WaitingCells(game.world, () => game.player);
    this.open = gym.floors.map(() => false);
    const { centre, front } = gym.face;
    this.hand = new THREE.Group();
    this.hand.position.set(centre[0] + front[0] * 1.1, centre[1], centre[2] + front[1] * 1.1);
    this.hand.rotation.y = Math.atan2(front[0], front[1]);
    this.pivot = new THREE.Group();
    const gold = new THREE.MeshBasicMaterial({ color: 0xffd84a }), dark = new THREE.MeshBasicMaterial({ color: 0x3a2a10 });
    this.geos = [new THREE.BoxGeometry(0.35, HAND_LEN, 0.15), new THREE.BoxGeometry(0.7, 0.7, 0.3)];
    const bar = new THREE.Mesh(this.geos[0], gold), cap = new THREE.Mesh(this.geos[1], dark);
    bar.position.y = HAND_LEN / 2;
    cap.position.z = 0.05;
    this.pivot.add(bar, cap);
    this.hand.add(this.pivot);
    this.mats = [gold, dark];
    game.world.scene.add(this.hand);
    this.update(0);
  }

  inRoom(f) {
    const p = this.game.player?.pos, r = f.room;
    return !!p && p.x >= r.x0 && p.x < r.x1 + 1 && p.z >= r.z0 && p.z < r.z1 + 1 && p.y >= r.y0 - 1 && p.y < r.y1 + 1;
  }

  update() {
    const g = this.game;
    this.pivot.rotation.z = -(g.time - 0.25) * Math.PI * 2; // clockwise, noon straight up
    const win = windowAt(g.time);
    this.gym.floors.forEach((f, n) => {
      const open = f.window === win || this.inRoom(f); // a door never closes while you are inside
      for (const [x, y, z] of f.door) this.cells.want(x, y, z, open ? B.AIR : B.CLOCK_DOOR);
      if (open && !this.open[n]) {
        const p = g.player?.pos;
        if (p && this.started && Math.hypot(p.x - this.gym.x, p.z - this.gym.z) < 30) sound.play('doorchime');
      }
      this.open[n] = open;
    });
    this.started = true;
  }

  dispose() {
    this.game.world.scene.remove(this.hand);
    for (const geo of this.geos) geo.dispose();
    for (const m of this.mats) m.dispose();
  }
}

export { WINDOWS };
