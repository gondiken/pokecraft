// A disguise: a creature (or a person) drawn as a plain world block that blinks now and then.
// Made like World.buildChunk's faces (same atlas tiles, shades and light), so it matches the blocks around it.
// Never changes the world, is never saved or sent. Used by Camo creatures; T19's Hidden Hill trainers can
// reuse it: new Disguise(world, B.STONE, { w: 1, h: 2 }).
import * as THREE from 'three';
import { B, BLOCKS, TILE_COUNT } from './blocks.js';

// dir, shade, kind, corners [x, y, z, u, v] (same numbers as the faces in world.js)
const FACES = [
  { dir: [-1, 0, 0], shade: 0.62, kind: 'side', corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], shade: 0.62, kind: 'side', corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.32, kind: 'bottom', corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], shade: 1.0, kind: 'top', corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], shade: 0.45, kind: 'side', corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], shade: 0.45, kind: 'side', corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const SIDES = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // x, z normals of the faces that can show eyes
const EYE_GAP = 0.005, OPEN_TIME = 0.25, SHUT_TIME = 0.1;

const GEO = {
  white: new THREE.BoxGeometry(0.16, 0.14, 0.01),
  pupil: new THREE.BoxGeometry(0.08, 0.1, 0.012),
  line: new THREE.BoxGeometry(0.2, 0.03, 0.012),
};
// Seconds to the next blink: about twice a minute; the first one comes sooner and at a random time.
const nextBlink = first => (first ? 3 + Math.random() * 27 : 22 + Math.random() * 16);

export class Disguise {
  // A w x h x w box of `block` (h counts blocks, default w); its local minimum corner is (-w/2, 0, -w/2).
  constructor(world, block, { w = 1, h = w } = {}) {
    this.world = world;
    this.block = block;
    this.w = w;
    this.h = h;
    this.group = new THREE.Group();
    this.blinkIn = nextBlink(true);
    this.phase = 'none'; // 'none' | 'open' | 'shut'
    this.t = 0;
    this.eyeMats = [new THREE.MeshBasicMaterial({ color: 0xffffff }), new THREE.MeshBasicMaterial({ color: 0x111111 })];
    this.cells = []; // one entry per quad: [local cell x, y, z, face]
    this.geo = this.buildFaces();
    this.group.add(new THREE.Mesh(this.geo, world.materials.solid));
    this.eyes = this.buildEyes();
    this.eyes.visible = false;
    this.group.add(this.eyes);
    this.group.userData.disguise = this;
  }

  get blinking() { return this.phase !== 'none'; }

  // One quad per block of each outside face, so the tile repeats exactly like it would on real blocks.
  buildFaces() {
    const { w, h } = this;
    const def = BLOCKS[this.block];
    const pos = [], uv = [], col = [], idx = [];
    for (const f of FACES) {
      const tile = f.kind === 'top' ? def.top : f.kind === 'bottom' ? def.bottom : def.side;
      const na = w, nb = f.dir[1] ? w : h;
      for (let a = 0; a < na; a++) {
        for (let b = 0; b < nb; b++) {
          let cx, cy, cz;
          if (f.dir[0]) { cx = f.dir[0] > 0 ? w - 1 : 0; cz = a; cy = b; }
          else if (f.dir[1]) { cy = f.dir[1] > 0 ? h - 1 : 0; cx = a; cz = b; }
          else { cz = f.dir[2] > 0 ? w - 1 : 0; cx = a; cy = b; }
          const base = pos.length / 3;
          this.cells.push([cx, cy, cz, f]);
          for (const [qx, qy, qz, u, v] of f.corners) {
            pos.push(-w / 2 + cx + qx, cy + qy, -w / 2 + cz + qz);
            uv.push((tile + (u ? 0.999 : 0.001)) / TILE_COUNT, v);
            col.push(f.shade, f.shade, f.shade);
          }
          idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  }

  // Block light of a cell: glow blocks within 4 steps give 0.9 - 0.18 x distance (as World.stampLight).
  blockLight(x, y, z) {
    let best = 0;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dz = -4; dz <= 4; dz++) {
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
          if (d > 4) continue;
          const id = this.world.get(x + dx, y + dy, z + dz);
          if (id && BLOCKS[id]?.glow) best = Math.max(best, 0.9 - 0.18 * d);
        }
      }
    }
    return best;
  }

  // Bakes the light of the cells around the disguise into the vertex colours, like chunk meshes do:
  // r = shade x sky, g = shade x block light, b = shade. (x, y, z) is the world cell of its minimum corner.
  // Done once when it is placed; light changes while it sits there are fine.
  setLight(x, y, z) {
    const col = this.geo.getAttribute('color');
    const cache = new Map();
    const light = (nx, ny, nz) => {
      const k = `${nx},${ny},${nz}`;
      let v = cache.get(k);
      if (!v) cache.set(k, v = [this.world.skyAt(nx, ny, nz), this.blockLight(nx, ny, nz)]);
      return v;
    };
    this.cells.forEach(([cx, cy, cz, f], q) => {
      const [s, g] = light(x + cx + f.dir[0], y + cy + f.dir[1], z + cz + f.dir[2]);
      for (let i = 0; i < 4; i++) col.setXYZ(q * 4 + i, f.shade * s, f.shade * g, f.shade);
    });
    col.needsUpdate = true;
  }

  // Eyes for each of the four sides; a blink shows only the side that looks most towards the viewer.
  buildEyes() {
    const eyes = new THREE.Group();
    this.eyeSets = SIDES.map(([nx, nz]) => {
      const set = new THREE.Group();
      set.position.set(nx * (this.w / 2 + EYE_GAP), this.h * 0.6, nz * (this.w / 2 + EYE_GAP));
      set.rotation.y = Math.atan2(nx, nz);
      set.userData.normal = { x: nx, z: nz };
      const open = new THREE.Group(), shut = new THREE.Group();
      for (const sx of [-0.125, 0.125]) {
        const white = new THREE.Mesh(GEO.white, this.eyeMats[0]);
        white.position.x = sx;
        const pupil = new THREE.Mesh(GEO.pupil, this.eyeMats[1]);
        pupil.position.set(sx, 0, 0.004);
        open.add(white, pupil);
        const line = new THREE.Mesh(GEO.line, this.eyeMats[1]);
        line.position.x = sx;
        shut.add(line);
      }
      shut.visible = false;
      set.add(open, shut);
      set.userData.open = open;
      set.userData.shut = shut;
      set.visible = false;
      eyes.add(set);
      return set;
    });
    return eyes;
  }

  // Starts a blink now (also used by tests).
  blink(viewer) {
    const p = this.group.getWorldPosition(new THREE.Vector3());
    let best = this.eyeSets[3], score = -Infinity;
    for (const s of this.eyeSets) {
      const n = s.userData.normal;
      const toward = viewer ? (viewer.x - p.x) * n.x + (viewer.z - p.z) * n.z : n.z;
      if (toward > score) { score = toward; best = s; }
    }
    for (const s of this.eyeSets) s.visible = s === best;
    best.userData.open.visible = true;
    best.userData.shut.visible = false;
    this.eyes.visible = true;
    this.current = best;
    this.phase = 'open';
    this.t = 0;
  }

  update(dt, viewer) {
    if (this.phase === 'none') {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) this.blink(viewer);
      return;
    }
    this.t += dt;
    if (this.phase === 'open' && this.t >= OPEN_TIME) {
      this.phase = 'shut';
      this.current.userData.open.visible = false;
      this.current.userData.shut.visible = true;
    }
    if (this.phase === 'shut' && this.t >= OPEN_TIME + SHUT_TIME) {
      this.phase = 'none';
      this.eyes.visible = false;
      this.blinkIn = nextBlink(false);
    }
  }

  // Removes the group and frees what it owns (its geometry and eye materials), never the world's shared material.
  dispose() {
    this.group.parent?.remove(this.group);
    this.geo.dispose();
    for (const m of this.eyeMats) m.dispose();
  }

  // The candidate block found most often in x +-4, y-3..y+6, z +-4; null if fewer than 3 of them.
  static pick(world, x, y, z, blocks) {
    const counts = new Map(blocks.map(b => [b, 0]));
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        for (let dy = -3; dy <= 6; dy++) {
          const id = world.get(x + dx, y + dy, z + dz);
          if (counts.has(id)) counts.set(id, counts.get(id) + 1);
        }
      }
    }
    let best = null, most = 2;
    for (const [b, c] of counts) if (c > most) { best = b; most = c; }
    return best;
  }

  // Does a w x w footprint with its minimum corner at cell (x, y, z) fit: solid below, air for h cells above?
  static fits(world, x, y, z, w, h = w) {
    for (let dz = 0; dz < w; dz++) {
      for (let dx = 0; dx < w; dx++) {
        if (!world.isSolid(x + dx, y - 1, z + dz)) return false;
        for (let dy = 0; dy < h; dy++) if (world.get(x + dx, y + dy, z + dz) !== B.AIR) return false;
      }
    }
    return true;
  }
}
