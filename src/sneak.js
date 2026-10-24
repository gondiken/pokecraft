// Sneaking (T37b): small reusable pieces for places where you sneak past someone. The Shadow Dojo uses them (shadowdojo.js),
// later places can too (a sleeping cat in a Picture World is a Watcher that never walks).
//   Watcher    walks a set path (a loop of points) with a lantern; sees(pos) = you are in its light cone.
//   Hideout    a box; hides(pos) = you are inside it and nobody can see you.
//   FLOORS     floor kinds: `quiet` (tatami) and `squeak` (nightingale boards squeak when you run on them).
//   FloorMap   which cell has which floor kind.
//   Checkpoint a lantern you walk past; spotted = back to the last one you passed.
// No imports of the game: plain data and maths, so the spec can use them on their own. Everything is a closed form of a
// clock that the owner sums from the game's frame dt (like the Obstacle Course): the same path at 60 or 20 frames per second.

const TAU = Math.PI * 2;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)); // -PI..PI
// Heading as people use it (npc.js): 0 faces +z, PI / 2 faces +x.
export const headingOf = (dx, dz) => Math.atan2(dx, dz);

export class Watcher {
  // path: [[x, z], ...] world points (a loop; two points = back and forth). speed: blocks per second. pause: seconds standing
  // at each point (turning to the next leg while standing). range: how far the light reaches; angle: half the cone in radians.
  // y: the feet height of the floor it walks on. eye: lantern height above the feet (for the line of sight).
  constructor({ id, path, speed = 1.1, pause = 1.6, range = 5.5, angle = 0.6, y = 0, eye = 1.3, hear = 8, turn = 3 }) {
    if (!path?.length) throw new Error(`Watcher ${id}: no path`);
    this.id = id;
    this.path = path.map(([x, z]) => [x, z]);
    this.speed = speed;
    this.pause = pause;
    this.range = range;
    this.angle = angle;
    this.y = y;
    this.eye = eye;
    this.hear = hear; // a squeak within this many blocks makes it turn
    this.turnFor = turn; // and look there for this many seconds
    this.clock = 0; // its own clock: walks only while it is not looking at a noise
    this.noise = null; // { x, z, left }: looking at a noise
    this.stopped = false; // beaten trainers stand still (no cone)
    this.legs = [];
    const n = this.path.length;
    for (let i = 0; i < (n === 1 ? 0 : n); i++) {
      const [ax, az] = this.path[i], [bx, bz] = this.path[(i + 1) % n];
      const len = Math.hypot(bx - ax, bz - az);
      this.legs.push({ ax, az, bx, bz, len, walk: len / speed, h: headingOf(bx - ax, bz - az) });
    }
    this.period = this.legs.reduce((a, l) => a + l.walk + pause, 0);
    this.home = this.legs.length ? this.legs[0].h : 0; // a watcher with one point looks along +z unless told otherwise
    this.set(this.at(0));
  }

  // Where it is at clock t (closed form): { x, z, heading, moving }. Walks leg i, then stands `pause` s at its end while
  // turning from leg i's heading to leg i + 1's.
  at(t) {
    if (!this.legs.length) return { x: this.path[0][0], z: this.path[0][1], heading: this.home, moving: false };
    let u = ((t % this.period) + this.period) % this.period;
    for (let i = 0; i < this.legs.length; i++) {
      const l = this.legs[i];
      if (u < l.walk) { const k = u / l.walk; return { x: l.ax + (l.bx - l.ax) * k, z: l.az + (l.bz - l.az) * k, heading: l.h, moving: true }; }
      u -= l.walk;
      if (u < this.pause) {
        const next = this.legs[(i + 1) % this.legs.length];
        const k = Math.min(1, u / Math.max(0.01, this.pause * 0.6)); // turn in the first 60% of the pause, then look
        return { x: l.bx, z: l.bz, heading: l.h + wrap(next.h - l.h) * k, moving: false };
      }
      u -= this.pause;
    }
    const l = this.legs[0];
    return { x: l.ax, z: l.az, heading: l.h, moving: false };
  }

  set(s) { this.x = s.x; this.z = s.z; this.heading = s.heading; this.moving = s.moving; }

  // Moves the clock on by dt (the owner calls it with the frame dt). While it looks at a noise the clock waits.
  update(dt) {
    if (this.stopped) { this.moving = false; return; }
    if (this.noise) {
      const want = headingOf(this.noise.x - this.x, this.noise.z - this.z);
      this.heading += wrap(want - this.heading) * Math.min(1, dt * 8);
      this.moving = false;
      this.noise.left -= dt;
      if (this.noise.left <= 0) this.noise = null;
      return;
    }
    this.clock += dt;
    this.set(this.at(this.clock));
  }

  // A noise at (x, z): true if it heard it (and turns to look).
  hearNoise(x, z) {
    if (this.stopped || Math.hypot(x - this.x, z - this.z) > this.hear) return false;
    if (this.noise) { this.noise.x = x; this.noise.z = z; this.noise.left = this.turnFor; return true; }
    this.noise = { x, z, left: this.turnFor };
    return true;
  }

  // Is the point (x, y = feet, z) in the light cone? solid(x, y, z) = is that block solid (for the line of sight; optional).
  sees(pos, solid = null) {
    if (this.stopped) return false;
    if (Math.abs(pos.y - this.y) > 1.6) return false; // on a roof or a step above: out of the light
    const dx = pos.x - this.x, dz = pos.z - this.z, d = Math.hypot(dx, dz);
    if (d > this.range) return false;
    if (d > 0.5 && Math.abs(wrap(headingOf(dx, dz) - this.heading)) > this.angle) return false;
    return !solid || this.clear(pos, solid);
  }

  // Nothing solid between the lantern and your middle (samples every quarter block).
  clear(pos, solid) {
    const ax = this.x, ay = this.y + this.eye, az = this.z;
    const bx = pos.x, by = pos.y + 0.9, bz = pos.z;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) * 4));
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if (solid(Math.floor(ax + (bx - ax) * k), Math.floor(ay + (by - ay) * k), Math.floor(az + (bz - az) * k))) return false;
    }
    return true;
  }

  // Behind it: more than a quarter turn away from where it looks (a sneak attack comes from here).
  behind(pos) {
    const a = headingOf(pos.x - this.x, pos.z - this.z);
    return Math.abs(wrap(a - this.heading)) > Math.PI / 2;
  }

  // The floor cells (at feet height y) its light falls on now: [[x, z], ...]. Same test as sees(), so the drawn cone is
  // exactly where you would be spotted (only hideouts hide you in it).
  cone(solid = null) {
    if (this.stopped) return [];
    const out = [], r = Math.ceil(this.range);
    const cx = Math.floor(this.x), cz = Math.floor(this.z);
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) {
      if (this.sees({ x: x + 0.5, y: this.y, z: z + 0.5 }, solid)) out.push([x, z]);
    }
    return out;
  }

  state() { return { id: this.id, x: this.x, z: this.z, heading: this.heading, moving: this.moving, clock: this.clock, noise: !!this.noise, stopped: this.stopped }; }
}

export class Hideout {
  // box: { x0, x1, y0, y1, z0, z1 } inclusive block cells; kind: 'grass' | 'screen' | 'barrel' (only words).
  constructor({ id, box, kind = 'grass' }) {
    this.id = id;
    this.box = box;
    this.kind = kind;
  }

  // Your feet are in one of its cells.
  hides(pos) {
    const b = this.box, x = Math.floor(pos.x), y = Math.floor(pos.y + 0.01), z = Math.floor(pos.z);
    return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= b.y0 && y <= b.y1;
  }
}

// Floor kinds. squeak: running on it makes a noise that watchers within their `hear` range turn to.
export const FLOORS = {
  quiet: { squeak: false, text: 'Tatami mats are always quiet.' },
  squeak: { squeak: true, text: 'Squeak! Walk softly on the golden boards.' },
};

export class FloorMap {
  constructor() { this.cells = new Map(); }
  add(x, y, z, kind) {
    if (!FLOORS[kind]) throw new Error(`Unknown floor kind ${kind}`);
    this.cells.set(`${x},${y},${z}`, kind);
  }
  kindAt(x, y, z) { return this.cells.get(`${x},${y},${z}`) || null; }
  // The floor under the feet at pos (a block position), or null.
  under(pos) { return this.kindAt(Math.floor(pos.x), Math.floor(pos.y - 0.05), Math.floor(pos.z)); }
  count(kind) { let n = 0; for (const k of this.cells.values()) if (k === kind) n++; return n; }
}

export class Checkpoint {
  // cell: the lantern block [x, y, z]; stand: where you come back [x, y, z] (feet); yaw: the way you face; r: how close
  // counts as passing it (sideways, any of the two blocks above the floor); safe: nobody spots you this close to `stand`.
  constructor({ id, cell, stand, yaw = 0, r = 2.5, safe = 1.6 }) {
    this.id = id;
    this.cell = cell;
    this.stand = stand;
    this.yaw = yaw;
    this.r = r;
    this.safe = safe;
  }

  passed(pos) {
    const dx = pos.x - (this.cell[0] + 0.5), dz = pos.z - (this.cell[2] + 0.5);
    return Math.hypot(dx, dz) <= this.r && Math.abs(pos.y - this.stand[1]) < 2;
  }

  isSafe(pos) { return Math.hypot(pos.x - this.stand[0], pos.z - this.stand[2]) <= this.safe && Math.abs(pos.y - this.stand[1]) < 1.5; }
}


