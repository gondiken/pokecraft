// The Treasure Vault (T23, slot 4 of the new land): a tall golden-brick vault with a locked Vault Door, and three
// Golden Key Chests hidden around it: Dig (under a gold X), Build (on the roof) and Explore (at the end of a tunnel).
// plans/T23.md section 4. The building is the same in every world; the keys are per player (game.keys).
import { B, WOOL, isSolid } from './blocks.js';
import { WORLD_H, WATER_LEVEL, MID_X, MID_Z, PLANTS } from './world.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';
import { NEAR } from './glint.js';

const R = 6; // the vault is 13 x 13 (walls at +-6), roof layer at fy + HEIGHT
const HEIGHT = 14;
const DIG_SPOTS = [[-1, 17], [-1, -17], [-16, 0], [-16, 12], [-16, -12]]; // (d, s) candidates for the gold X
const DIG_DEPTH = 10;
const COMPASS_R = 40; // the compass shows within this many blocks (Chebyshev) of the vault

export function buildTreasureVault(world, def, slot) {
  const { x: x0, z: z0, box } = slot;
  const fy = Math.max(WATER_LEVEL + 1, Math.min(world.terrainHeight(x0, z0), 24));
  const ddx = MID_X - x0, ddz = MID_Z - z0; // the door faces the middle of the map, like the other gyms
  const front = Math.abs(ddx) > Math.abs(ddz) ? [Math.sign(ddx), 0] : [0, Math.sign(ddz) || 1];
  const col = (d, s) => [x0 + front[0] * d + front[1] * s, z0 + front[1] * d + front[0] * s];
  const inBox = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
  const put = (x, y, z, id) => {
    if (!inBox(x, z)) throw new Error(`Treasure Vault wrote outside its slot box at ${x},${y},${z}`);
    world.set(x, y, z, id, false);
  };
  const putD = (d, s, y, id) => { const [x, z] = col(d, s); put(x, y, z, id); };
  const bbox = (d0, d1, s0, s1) => {
    const a = col(d0, s0), b = col(d1, s1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  };
  const TW = WOOL.treasure;

  world.levelSite(bbox(-R - 2, R + 2, -R - 2, R + 2), fy, box, 2);

  // 1. The shell, room, ceiling and roof.
  for (let d = -R; d <= R; d++) for (let s = -R; s <= R; s++) {
    const ring = Math.max(Math.abs(d), Math.abs(s));
    const [x, z] = col(d, s);
    for (let y = 1; y < fy; y++) if (!isSolid(world.get(x, y, z))) put(x, y, z, B.STONE);
    if (ring === R) {
      const corner = Math.abs(d) === R && Math.abs(s) === R;
      put(x, fy, z, B.STONE_BRICKS);
      for (let y = fy + 1; y <= fy + HEIGHT - 1; y++) put(x, y, z, corner || y === fy + 5 || y === fy + HEIGHT - 1 ? TW : B.STONE_BRICKS);
    } else {
      put(x, fy, z, s === 0 && d >= -4 && d <= R - 1 ? TW : B.SANDSTONE); // a gold carpet from the door to the leader
      for (let y = fy + 1; y <= fy + 5; y++) put(x, y, z, B.AIR);
      put(x, fy + 6, z, B.STONE_BRICKS);
      for (let y = fy + 7; y <= fy + HEIGHT - 1; y++) put(x, y, z, B.STONE);
    }
    put(x, fy + HEIGHT, z, TW);
  }
  for (const [d, s] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) putD(d, s, fy + 6, B.LAMP);
  for (const [d, s] of [[-R, -R], [-R, R], [R, -R], [R, R]]) putD(d, s, fy + HEIGHT + 1, B.LAMP);
  for (const [d, s] of [[-3, -3], [-3, 3], [3, -3], [3, 3]]) for (let y = fy + 1; y <= fy + 5; y++) putD(d, s, y, TW); // gold pillars
  for (const s of [-5, 5]) putD(-5, s, fy + 1, TW); // little gold piles in the back corners

  // 2. The door (3 x 3 in the front wall) and the three key lights above it.
  const door = [], lights = [];
  for (let s = -1; s <= 1; s++) {
    const [x, z] = col(R, s);
    for (let y = fy + 1; y <= fy + 3; y++) { put(x, y, z, B.VAULT_DOOR); door.push([x, y, z]); }
    put(x, fy + 4, z, B.COBBLE);
    lights.push([x, fy + 4, z]);
  }

  // 3. Helpers for the hidden parts: the real ground (plants don't count) and clearing plants.
  const ground = (x, z) => { for (let y = WORLD_H - 1; y >= 0; y--) { const id = world.get(x, y, z); if (isSolid(id) && !PLANTS.has(id)) return y; } return -1; };
  const wet = (x, z) => {
    for (let y = WORLD_H - 1; y >= 0; y--) { const id = world.get(x, y, z); if (id === B.WATER) return true; if (isSolid(id) && !PLANTS.has(id)) return false; }
    return false;
  };
  const clearVeg = (x, z) => { if (!inBox(x, z)) return; for (let y = 1; y < WORLD_H; y++) if (PLANTS.has(world.get(x, y, z))) put(x, y, z, B.AIR); };

  // 4. Dig: a gold X on the ground (the diagonals of a 5 x 5) and the key chest DIG_DEPTH below its middle.
  const fits = ([d, s]) => {
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const [x, z] = col(d + a, s + b), g = ground(x, z);
      if (!inBox(x, z) || wet(x, z) || g < fy - 6 || g > fy + 6) return false;
    }
    const [x, z] = col(d, s);
    return ground(x, z) >= DIG_DEPTH + 3;
  };
  const spot = DIG_SPOTS.find(fits) || DIG_SPOTS[0];
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) clearVeg(...col(spot[0] + a, spot[1] + b));
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { // water (only when no spot was dry) becomes sand
    const [x, z] = col(spot[0] + a, spot[1] + b);
    if (!wet(x, z)) continue;
    for (let y = Math.max(1, ground(x, z) + 1); y <= WATER_LEVEL + 1; y++) put(x, y, z, B.SAND);
    for (let y = WATER_LEVEL + 2; y < WORLD_H; y++) if (world.get(x, y, z) === B.WATER) put(x, y, z, B.AIR);
  }
  const [dx, dz] = col(spot[0], spot[1]);
  const sy = ground(dx, dz);
  const mark = [];
  for (let a = -2; a <= 2; a++) for (const b of a ? [a, -a] : [0]) {
    const [x, z] = col(spot[0] + a, spot[1] + b), g = ground(x, z);
    put(x, g, z, TW);
    mark.push([x, g, z]);
  }
  const digY = Math.max(3, sy - DIG_DEPTH);
  for (let y = digY - 1; y < sy; y++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const [x, z] = col(spot[0] + a, spot[1] + b);
    if (y <= ground(x, z) && !isSolid(world.get(x, y, z))) put(x, y, z, B.STONE); // only below this column's own ground
  }
  put(dx, digY, dz, B.KEY_CHEST);

  // 5. Explore: a tunnel on the side away from the X, down, round a corner, to a little chamber with the chest.
  const side = spot[1] > 0 ? -1 : 1;
  const [mx, mz] = col(12, 18 * side);
  for (let d = -17; d <= 15; d++) for (let b = -3; b <= 3; b++) clearVeg(...col(d, 18 * side + b));
  const mouthFeet = ground(mx, mz) + 1;
  const feetOf = i => Math.max(4, mouthFeet - Math.min(8, i < 4 ? i : 4 + Math.floor((i - 4) / 2)));
  const cells = []; // { d, s, feet, top, deep }: air from feet up to top (inclusive)
  const LEN = 25; // cells 0..25 run from d = 12 to d = -13
  for (let i = 0; i <= LEN; i++) {
    const feet = feetOf(i), prev = i ? feetOf(i - 1) : feet;
    cells.push({ d: 12 - i, s: 18 * side, feet, top: Math.max(feet, prev) + 1, deep: i >= 6 }); // a step down needs 3 air
  }
  const turnFeet = feetOf(LEN);
  for (let j = 1; j <= 6; j++) cells.push({ d: -13, s: (18 - j) * side, feet: turnFeet, top: turnFeet + 1, deep: true });
  for (let d = -15; d <= -11; d++) for (let b = 7; b <= 11; b++) cells.push({ d, s: b * side, feet: turnFeet, top: turnFeet + 2, deep: true });
  const air = new Set();
  for (const c of cells) { const [x, z] = col(c.d, c.s); for (let y = c.feet; y <= c.top; y++) air.add(`${x},${y},${z}`); }
  for (const c of cells) {
    const [x, z] = col(c.d, c.s);
    for (let y = c.feet; y <= c.top; y++) put(x, y, z, B.AIR);
  }
  for (const c of cells) { // walls, floor and roof: whatever is not solid becomes stone (no water leaks in); near the mouth only below the sky
    const [x, z] = col(c.d, c.s);
    const around = [[x, c.feet - 1, z], [x, c.top + 1, z]];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let y = c.feet; y <= c.top; y++) around.push([x + a, y, z + b]);
    for (const [ax, ay, az] of around) {
      if (air.has(`${ax},${ay},${az}`) || isSolid(world.get(ax, ay, az))) continue;
      if (c.deep || ay <= ground(ax, az) || ay < c.feet) put(ax, ay, az, B.STONE);
    }
  }
  const [ex, ez] = col(-13, 7 * side);
  put(ex, turnFeet, ez, B.KEY_CHEST);
  for (const [d, b] of [[-11, 7], [-15, 7], [-15, 11]]) putD(d, b * side, turnFeet, B.GLOWCAP);
  putD(-13, 18 * side, turnFeet + 2, B.LAMP);

  // 6. Build: the chest sits in the middle of the roof (the roof is protected: build a pillar outside and step across).
  const [bx, bz] = col(0, 0);
  put(bx, fy + HEIGHT + 1, bz, B.KEY_CHEST);

  world.markLit(x0, z0);
  const cell = (d, s) => { const [x, z] = col(d, s); return [x + 0.5, fy + 1, z + 0.5]; };
  const one = ([x, y, z]) => ({ x0: x, x1: x, y0: y, y1: y, z0: z, z1: z });
  const keys = [
    { id: 'dig', chest: [dx, digY, dz], mark, spot },
    { id: 'build', chest: [bx, fy + HEIGHT + 1, bz] },
    { id: 'explore', chest: [ex, turnFeet, ez], mouth: [mx, mouthFeet, mz], side },
  ];
  const near = bbox(-10, 10, -10, 10);
  return {
    def, x: x0, z: z0, y: fy + 1, front, fy,
    leaderPos: cell(-4, 0), trainerPos: cell(1, -3), trainerPositions: [cell(1, -3), cell(-1, 3)],
    // The vault (walls, roof and the build chest) and the two buried chests; the X, the shaft and the tunnel stay open.
    protect: [{ ...bbox(-R, R, -R, R), y0: 1, y1: WORLD_H - 1 }, one(keys[0].chest), one(keys[2].chest)],
    area: { x0: near.x0, x1: near.x1, z0: near.z0, z1: near.z1, y0: fy - 1, y1: fy + HEIGHT + 2 },
    door, lights, keys,
  };
}

// The live part of the vault (LIVE.vault): the key chests, key lights, door and compass. Everything comes from
// game.keys (per player, saved); blocks change only with setLive (this player only: never an edit, never sent).
export class VaultLive {
  constructor(game, gym) {
    this.game = game;
    this.gym = gym;
    this.cells = new LiveCells(game.world, () => game.player);
    this.acc = 1; // work at once
    this.compass = { shown: false, period: 0 };
    this.update(0);
  }

  has(k) { return this.game.keys.includes(`${this.gym.def.id}:${k}`); }
  count() { return this.gym.keys.filter(k => this.has(k.id)).length; }
  keyAt(b) { return this.gym.keys.find(k => k.chest[0] === b.x && k.chest[1] === b.y && k.chest[2] === b.z); }
  doorAt(b) { return b.id === B.VAULT_DOOR && this.gym.door.some(([x, y, z]) => x === b.x && y === b.y && z === b.z); }

  update(dt) {
    this.cells.flush();
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;
    const g = this.gym;
    g.keys.forEach((k, i) => {
      const got = this.has(k.id), [x, y, z] = k.chest, [lx, ly, lz] = g.lights[i];
      this.cells.want(x, y, z, got ? B.CHEST_OPEN : B.KEY_CHEST);
      this.cells.want(lx, ly, lz, got ? WOOL.treasure : B.COBBLE);
    });
    const all = this.count() >= g.keys.length;
    for (const [x, y, z] of g.door) this.cells.want(x, y, z, all ? B.AIR : B.VAULT_DOOR);
    this.updateCompass();
  }

  // The HUD key glints faster the nearer the closest missing key is; only near the vault, and no direction.
  updateCompass() {
    const p = this.game.player?.pos, g = this.gym;
    let want = null;
    if (p && this.game.started && this.count() < g.keys.length && Math.max(Math.abs(p.x - g.x), Math.abs(p.z - g.z)) <= COMPASS_R) {
      let best = Infinity;
      for (const k of g.keys) {
        if (!this.has(k.id)) best = Math.min(best, Math.hypot(p.x - (k.chest[0] + 0.5), p.y - k.chest[1], p.z - (k.chest[2] + 0.5)));
      }
      want = { period: NEAR.period(best), found: this.count() };
    }
    this.compass = { shown: !!want, period: want ? want.period : 0 };
    this.game.ui?.setKeyCompass(want);
  }

  hit(block) {
    const k = this.keyAt(block);
    const ui = this.game.ui, total = this.gym.keys.length;
    if (k) {
      if (this.has(k.id)) { ui.toast('You already have this key.'); return true; }
      this.game.keys.push(`${this.gym.def.id}:${k.id}`);
      sound.play('keyfound');
      const n = this.count();
      ui.toast(`You found a golden key! (${n}/${total})`);
      if (k.id === 'dig') ui.toast('Tip: jump and place a block under you to climb out!');
      if (n >= total) { ui.toast('You have all 3 golden keys! The vault door is open.'); sound.play('doorchime'); }
      this.acc = 1;
      this.update(0);
      this.game.save?.();
      return true;
    }
    if (this.doorAt(block)) { ui.toast(`The vault is locked. Find the 3 golden keys! (${this.count()}/${total})`); return true; }
    return false;
  }

  prompt(block, how) {
    if (this.keyAt(block)) return `Golden key chest · ${how} to open`;
    if (this.doorAt(block)) return `Vault door · ${this.count()}/${this.gym.keys.length} golden keys`;
    return null;
  }

  dispose() { this.game.ui?.setKeyCompass(null); }
}
