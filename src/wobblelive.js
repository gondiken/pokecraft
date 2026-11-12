// Chapter 3 (plans/chapter3-world.md, "Built from the owner's first play"): Wobbleland's live part (LIVE.wobble, world.parts from
// wobbleland.js), ?preview only like the realm. Nothing here is saved or sent; it draws from game.beaten (the patches' keys).
//   A3 paint-pot hops: every cleared patch leaves a paint pot of its own colour in its middle, the Camp has one from the start. Stand in a
//      pot and look the way you want to go: a beam of colour stands over the pot you would hop to, the big button says "Hop to blue!".
//      One look, no list: the pot nearest to where you look is the one (`hopOf`).
//   C5 drawn springs: a crayon coil over each Bounce Block beside a floating hill (wobbleland.js FLOATERS); it squashes while you stand on it.
//   A2 scribble bugs (scribblebugs.js, pure rules): four round every patch not cleared yet; walk into one and it pops into colour.
import * as THREE from 'three';
import { sound } from './sound.js';
import { PATCHES, CAMP_POT, patchKey, heightAt, FLOATERS, RIVER_UP, riverY, inCave } from './wobbleland.js';
import { BugField, bugsFor } from './scribblebugs.js';
import { curlLift } from './wobblelook.js';
import { SkidMarks } from './skidmarks.js'; // Slippy Lake
import { DIFFICULTY } from './difficulty.js'; // the bugs on Easy / Hard

export const POT = {
  r: 1.3,          // stand within this of a pot's middle to hop from it
  land: 1.7,       // you land this far south of the pot you hop to, facing north (so you are not standing in it)
  beam: 28,        // the beam over the pot you would hop to: its height
  puff: 0.7,       // seconds a puff of colour lasts
};
const NAMES = { 0xe8402a: 'red', 0xf2c418: 'yellow', 0x2f9be8: 'blue', 0x3fc04a: 'green', 0xf07ab8: 'pink', 0x8a4ee0: 'purple', 0x46d0e0: 'ice blue', 0x9be36a: 'lime', 0x1a9e8f: 'teal', 0x2a3fae: 'navy', 0xd6f4ff: 'snow white', 0x3a2a6e: 'night', 0xffe14a: 'firefly', 0x2e8b3a: 'forest', 0xff9d2e: 'amber', 0x7fe0a0: 'mint', 0xb04ad8: 'plum', 0x1b1340: 'midnight' };
// The pots there are now: the Camp's, then one per cleared patch (pure: tests read it). { id, x, z, y, colour, name }
export function potsOf(beaten) {
  const keys = new Set(beaten || []);
  const out = [{ id: 'camp', x: CAMP_POT.x + 0.5, z: CAMP_POT.z + 0.5, y: heightAt(CAMP_POT.x, CAMP_POT.z) + 1, colour: CAMP_POT.colour, name: 'Camp' }];
  for (const p of PATCHES) if (keys.has(patchKey(p.id))) out.push({ id: p.id, x: p.x + 0.5, z: p.z + 0.5, y: heightAt(p.x, p.z) + 1, colour: p.pot, name: NAMES[p.pot] ?? 'pot' });
  return out;
}
// The pot you stand in (or null) and the one you would hop to: of the others, the one closest to the way you look (yaw: forward is
// (-sin yaw, -cos yaw), the game's own rule).
export function hopOf(pots, pos, yaw) {
  const here = pots.find(q => Math.hypot(pos.x - q.x, pos.z - q.z) < POT.r && Math.abs(pos.y - q.y) < 1.6) ?? null;
  if (!here || pots.length < 2) return { here, to: null };
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let to = null, best = -Infinity;
  for (const q of pots) {
    if (q === here) continue;
    const dx = q.x - here.x, dz = q.z - here.z, d = Math.hypot(dx, dz) || 1, dot = (dx * fx + dz * fz) / d;
    if (dot > best) { best = dot; to = q; }
  }
  return { here, to };
}

function buildPot(colour) {
  const g = new THREE.Group();
  const tin = new THREE.MeshLambertMaterial({ color: 0xd8d4cc }), paint = new THREE.MeshLambertMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.25 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.47, 0.75, 14), tin); body.position.y = 0.375; g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 14), paint); top.position.y = 0.73; g.add(top);
  const drip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.06), paint); drip.position.set(0.18, 0.55, 0.53); g.add(drip);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.04, 6, 18), tin); rim.rotation.x = Math.PI / 2; rim.position.y = 0.75; g.add(rim);
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), new THREE.MeshLambertMaterial({ color: 0x9a6a3a })); stick.position.set(-0.15, 1.0, 0.05); stick.rotation.z = 0.35; g.add(stick);
  const brush = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.1), paint); brush.position.set(0.0, 0.62, 0.05); brush.rotation.z = 0.35; g.add(brush);
  return g;
}

// The live part is made of small pieces, each one thing (owner 2026-11-11: "object-oriented", no bloat). A piece gets the shared
// `Scene` (game, world, its own group, `puff`, `playing()`, `sig` = the cleared patches' keys) and may have update(dt, p),
// keysChanged(), near(p) / use(p), info() and dispose(). A new thing in Wobbleland = one more piece in PIECES.
class Piece {
  constructor(scene) { this.s = scene; this.group = new THREE.Group(); scene.group.add(this.group); }
  get game() { return this.s.game; }
  dispose() { this.group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
}

// A puff of colour (a pot, a popped bug): little cubes flying out and shrinking
class Puffs extends Piece {
  constructor(scene) { super(scene); this.list = []; this.geo = new THREE.BoxGeometry(0.22, 0.22, 0.22); }
  add(q, big = 0) {
    const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: q.colour });
    for (let i = 0; i < 10 + big * 6; i++) g.add(new THREE.Mesh(this.geo, mat));
    g.position.set(q.x, q.y, q.z); this.group.add(g); this.list.push({ g, t: 0 });
  }
  update(dt) {
    for (const f of this.list) {
      f.t += dt; const k = f.t / POT.puff;
      f.g.children.forEach((c, i) => { const a = i / f.g.children.length * Math.PI * 2; c.position.set(Math.cos(a) * k * 1.6, 0.4 + Math.sin(k * Math.PI) * 1.2, Math.sin(a) * k * 1.6); c.scale.setScalar(Math.max(0.01, 1 - k)); });
    }
    this.list = this.list.filter(f => { if (f.t < POT.puff) return true; this.group.remove(f.g); f.g.children[0]?.material.dispose(); return false; });
  }
}

// A3: paint-pot hops
class PaintPots extends Piece {
  constructor(scene) {
    super(scene); this.pots = []; this.meshes = new Map(); this.t = 0; this.hop = { here: null, to: null };
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, POT.beam, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.visible = false; this.group.add(this.beam);
  }
  keysChanged(fresh) {
    this.pots = potsOf(this.game.beaten);
    for (const q of this.pots) if (!this.meshes.has(q.id)) {
      const m = buildPot(q.colour); m.position.set(q.x, q.y, q.z); m.userData.born = fresh ? this.t : -9; this.group.add(m); this.meshes.set(q.id, m);
      if (fresh && q.id !== 'camp') this.s.puff(q, 1);
    }
  }
  update(dt, p) {
    this.t += dt;
    this.hop = p && this.s.playing() ? hopOf(this.pots, p.pos, p.yaw) : { here: null, to: null };
    const to = this.hop.to;
    this.beam.visible = !!to;
    if (to) { this.beam.position.set(to.x, to.y + POT.beam / 2 + 0.8, to.z); this.beam.material.color.setHex(to.colour); this.beam.material.opacity = 0.35 + 0.15 * Math.sin(this.t * 5); }
    for (const [, m] of this.meshes) { const a = this.t - m.userData.born; m.scale.setScalar(a < 0.5 ? Math.max(0.01, Math.sin(a / 0.5 * Math.PI / 2) * 1.15) : 1); m.rotation.y = Math.sin(this.t * 0.8 + m.position.x) * 0.15; }
  }
  near(p) { const h = hopOf(this.pots, p.pos, p.yaw); return h.to ? `Hop to ${h.to.name}!` : null; }
  use(p) {
    const { here, to } = hopOf(this.pots, p.pos, p.yaw);
    if (!to) return false;
    this.s.puff(here);
    p.pos.set(to.x, to.y, to.z + POT.land); p.vel?.set(0, 0, 0); p.yaw = 0;
    this.s.puff(to);
    try { sound.play('whoosh'); } catch { /* sound is optional */ }
    this.game.mp?.sendState?.();
    return true;
  }
  info() { return { pots: this.pots.map(q => q.id), here: this.hop.here?.id ?? null, to: this.hop.to?.id ?? null, beam: this.beam.visible }; }
}

// A2: scribble bugs (the rules are scribblebugs.js): one instanced scribble (a little torus knot) and two eyes each
class Bugs extends Piece {
  constructor(scene) {
    super(scene); this.field = new BugField([]); this.last = null; this.popped = 0; this.started = false;
    const NB = PATCHES.length * 4; // (room for every patch's bugs)
    this.bodies = new THREE.InstancedMesh(new THREE.TorusKnotGeometry(0.2, 0.05, 40, 5, 2, 3), new THREE.MeshLambertMaterial({ color: 0x3a3a44 }), NB);
    this.eyes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), NB * 2);
    for (const m of [this.bodies, this.eyes]) { m.count = 0; m.frustumCulled = false; this.group.add(m); }
  }
  keysChanged() { // a cleared patch's bugs go
    const keys = new Set(this.game.beaten || []), have = new Set(this.field.bugs.map(b => b.patch));
    const live = p => !keys.has(patchKey(p.id));
    this.field.bugs = [...this.field.bugs.filter(b => live(PATCHES.find(p => p.id === b.patch))), ...PATCHES.filter(p => live(p) && !have.has(p.id)).flatMap(p => bugsFor(p))];
  }
  update(dt, p) {
    if (p && this.s.playing() && dt > 0) {
      this.field.level = DIFFICULTY.current.bugs; // (the pause screen may change it any time)
      const speed = this.last ? Math.hypot(p.pos.x - this.last[0], p.pos.z - this.last[1]) / dt : 0;
      for (const e of this.field.step(dt, { x: p.pos.x, z: p.pos.z, speed: Math.min(speed, 12) })) if (e.kind === 'pop') this.pop(e.bug);
      this.last = [p.pos.x, p.pos.z];
    } else this.last = null;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler(), V = new THREE.Vector3();
    const cam = this.game.camera?.position ?? p?.pos;
    let n = 0, e = 0;
    for (const b of this.field.bugs) {
      if (b.popped) continue;
      const y = heightAt(Math.floor(b.x), Math.floor(b.z)) + 1.25 + Math.abs(Math.sin(b.t * (b.run ? 18 : 4))) * 0.12 + (cam ? curlLift(Math.hypot(b.x - cam.x, b.z - cam.z)) : 0);
      const face = b.run ? Math.atan2(b.vx, b.vz) : b.t * 0.3;
      E.set(b.t * 3, face, 0); Q.setFromEuler(E);
      M.compose(V.set(b.x, y, b.z), Q, S); this.bodies.setMatrixAt(n++, M);
      for (const side of [-1, 1]) { M.makeTranslation(b.x + Math.sin(face) * 0.2 + Math.cos(face) * side * 0.09, y + 0.1, b.z + Math.cos(face) * 0.2 - Math.sin(face) * side * 0.09); this.eyes.setMatrixAt(e++, M); }
    }
    this.bodies.count = n; this.eyes.count = e;
    this.bodies.instanceMatrix.needsUpdate = true; this.eyes.instanceMatrix.needsUpdate = true;
  }
  pop(b) {
    const colours = PATCHES.map(q => q.pot), colour = colours[(b.patch * 3 + this.popped++) % colours.length];
    this.s.puff({ x: b.x, y: heightAt(Math.floor(b.x), Math.floor(b.z)) + 1, z: b.z, colour }, 1);
    this.game.wobbleLook?.splat(b.x, b.z);
    try { sound.play('soappop'); } catch { /* sound is optional */ }
  }
  info() { return { bugs: this.field.bugs.filter(b => !b.popped).length, popped: this.popped }; }
}

// C5: a crayon coil over each spring's Bounce Block; it squashes while you stand on it
class Springs extends Piece {
  constructor(scene) {
    super(scene);
    const pts = [];
    for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2 * 5; pts.push(new THREE.Vector3(Math.cos(a) * 0.42, i / 120, Math.sin(a) * 0.42)); }
    const coilGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.06, 5), capGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12);
    const red = new THREE.MeshLambertMaterial({ color: 0xe0402a }), yellow = new THREE.MeshLambertMaterial({ color: 0xffd23a });
    this.coils = FLOATERS.filter(f => f.spring).map(f => {
      const [sx, sz] = f.spring, g = new THREE.Group(), coil = new THREE.Mesh(coilGeo, red), cap = new THREE.Mesh(capGeo, yellow);
      g.add(coil, cap); g.position.set(sx + 0.5, heightAt(sx, sz) + 1, sz + 0.5); this.group.add(g);
      return { g, coil, cap, k: 1 };
    });
  }
  update(dt, p) {
    for (const c of this.coils) {
      const on = p && Math.abs(p.pos.x - c.g.position.x) < 0.8 && Math.abs(p.pos.z - c.g.position.z) < 0.8 && Math.abs(p.pos.y - c.g.position.y) < 0.3;
      c.k = on ? 0.45 : Math.min(1, c.k + dt * 4);
      c.coil.scale.y = 0.35 + 0.65 * c.k; c.cap.position.y = 0.35 + 0.65 * c.k;
    }
  }
}

// The floating river (wobbleland.js RIVER_UP): drawn current marks (little white chevrons) running uphill on its water
class RiverMarks extends Piece {
  constructor(scene) {
    super(scene);
    const shape = new THREE.Shape(); shape.moveTo(-0.35, 0.1); shape.lineTo(0, -0.25); shape.lineTo(0.35, 0.1); shape.lineTo(0.25, 0.18); shape.lineTo(0, -0.05); shape.lineTo(-0.25, 0.18);
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
    this.n = Math.floor((RIVER_UP.z0 - RIVER_UP.z1) / 2.2);
    this.marks = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }), this.n);
    this.marks.frustumCulled = false; this.group.add(this.marks); this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const M = new THREE.Matrix4(), len = RIVER_UP.z0 - RIVER_UP.z1, x = (RIVER_UP.x0 + RIVER_UP.x1 + 1) / 2;
    for (let i = 0; i < this.n; i++) {
      const z = RIVER_UP.z0 + 1 - ((i * 2.2 + this.t * RIVER_UP.speed) % len), y = riverY(Math.floor(z)) + 0.93;
      M.makeTranslation(x + Math.sin(i * 2.3) * 0.3, y, z); this.marks.setMatrixAt(i, M);
    }
    this.marks.instanceMatrix.needsUpdate = true;
  }
}

// The floating hills hang on strings: thin drawn lines up out of sight (like the clouds' in wobblesky.js)
class HillStrings extends Piece {
  constructor(scene) {
    super(scene);
    const pts = FLOATERS.flatMap(f => [new THREE.Vector3(f.x + 1.5, f.y + 1, f.z + 0.5), new THREE.Vector3(f.x + 1.5, f.y + 90, f.z + 0.5)]);
    this.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5a6070 })));
  }
}

// Slippy Lake: skid marks where you slide on the ice (player.js sets player.skid; riding an Ice creature never skids)
class Skids extends Piece {
  constructor(scene) { super(scene); this.marks = new SkidMarks(this.group); }
  update(dt, p) {
    if (p?.skid && p.onGround && this.s.playing()) this.marks.track(p, p.pos.x, p.pos.y, p.pos.z, p.vel.x, p.vel.z, dt);
    this.marks.update(dt);
  }
  info() { return { skids: this.marks.info().marks }; }
}

// Glowcap Caves: a wild creature out in the dark beyond your light shows only its two glowing eyes (as a scribble monster does in a fight)
class NightEyes extends Piece {
  constructor(scene) {
    super(scene);
    this.eyes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.15, 0.05), new THREE.MeshBasicMaterial({ color: 0xfff27a }), 64);
    this.eyes.count = 0; this.eyes.frustumCulled = false; this.group.add(this.eyes); this.t = 0; this.hidden = new Set(); this.shown = 0;
  }
  update(dt, p) {
    this.t += dt;
    const list = this.game.creatures?.list ?? [], r = this.game.wobbleLook?.sight?.() ?? Infinity, M = new THREE.Matrix4(), hide = new Set();
    let n = 0;
    for (const w of list) {
      const m = w.model, q = w.pos ?? m?.position;
      if (!m || !q || !p || this.game.scribble?.fighting) continue;
      if (!inCave(Math.floor(q.x), Math.floor(q.z)) || Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < r + 0.5 || (this.game.wobbleLook?.colourAt?.(q.x, q.z) ?? 0) > 0.5) continue; // (a cleared part of the cave has its own light)
      hide.add(m); m.visible = false;
      if (n < 62 && Math.sin(this.t * 2.1 + q.x) > -0.8) {
        const yaw = m.rotation.y, h = (m.userData.h ?? 1) * 0.7 + 0.4;
        for (const side of [-1, 1]) { M.makeRotationY(yaw); M.setPosition(q.x + Math.sin(yaw) * 0.45 + Math.cos(yaw) * side * 0.17, q.y + h, q.z + Math.cos(yaw) * 0.45 - Math.sin(yaw) * side * 0.17); this.eyes.setMatrixAt(n++, M); }
      }
    }
    for (const m of this.hidden) if (!hide.has(m)) m.visible = true; // (back in your light: seen again)
    this.hidden = hide; this.shown = n / 2;
    this.eyes.count = n; this.eyes.instanceMatrix.needsUpdate = true;
  }
  info() { return { eyes: this.shown, hiddenWild: this.hidden.size }; }
  dispose() { for (const m of this.hidden) m.visible = true; super.dispose(); }
}

// Glowcap Caves: glow-worms drifting in the dark round you (little glowing specks; they make the dark feel alive, not scary)
class Fireflies extends Piece {
  constructor(scene) {
    super(scene);
    this.n = 48; this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), new THREE.MeshBasicMaterial({ color: 0xd8ff6a }), this.n);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.group.add(this.mesh); this.t = 0;
    this.seed = Array.from({ length: this.n }, (_, i) => [Math.sin(i * 12.9) * 0.5 + 0.5, Math.sin(i * 78.2) * 0.5 + 0.5, Math.sin(i * 39.4) * 0.5 + 0.5]);
  }
  update(dt, p) {
    this.t += dt;
    if (!p) return;
    const M = new THREE.Matrix4(), R = 22;
    let n = 0;
    for (const [a, b, c] of this.seed) {
      // each one wanders round a home that is fixed on a grid of 2R, so they stay put as you walk among them
      const gx = Math.floor((p.pos.x + (a - 0.5) * 2 * R) / (2 * R)) * 2 * R + a * 2 * R, gz = Math.floor((p.pos.z + (b - 0.5) * 2 * R) / (2 * R)) * 2 * R + b * 2 * R;
      const x = gx + Math.sin(this.t * (0.3 + c * 0.3) + a * 9) * 2.5, z = gz + Math.cos(this.t * (0.25 + a * 0.3) + b * 7) * 2.5;
      if (!inCave(Math.floor(x), Math.floor(z)) || Math.hypot(x - p.pos.x, z - p.pos.z) > R) continue;
      const blink = Math.sin(this.t * (1.5 + c * 2) + b * 11);
      if (blink < -0.3) continue;
      M.makeTranslation(x, heightAt(Math.floor(x), Math.floor(z)) + 1.2 + c * 3 + Math.sin(this.t * 1.3 + c * 5) * 0.4, z);
      this.mesh.setMatrixAt(n++, M);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
  info() { return { fireflies: this.mesh.count }; }
}

const PIECES = [Puffs, PaintPots, Bugs, Springs, RiverMarks, HillStrings, Skids, NightEyes, Fireflies];

export class WobbleLive {
  constructor(game, part) {
    this.game = game; this.part = part; this.world = game.world; this.scene = game.scene;
    this.group = new THREE.Group(); this.group.name = 'wobble-live';
    this.scene?.add(this.group);
    this.sig = null;
    this.pieces = PIECES.map(P => new P(this));
    [this.puffs, this.pots, this.bugs] = this.pieces;
    this.sync();
  }
  get field() { return this.bugs.field; } // (tests)
  puff(q, big) { this.puffs.add(q, big); }
  playing() { const g = this.game; return !g.inBattle && !g.scribble?.fighting && g.world === this.world && (g.playing?.() ?? true); }
  // the cleared patches' keys: a win adds a pot and takes its bugs away, a reload draws them all
  sync() {
    const sig = (this.game.beaten || []).filter(k => k.startsWith('pw:wobble:patch')).sort().join();
    if (sig === this.sig) return;
    const fresh = this.sig !== null;
    this.sig = sig;
    for (const x of this.pieces) x.keysChanged?.(fresh);
  }
  update(dt) {
    this.sync();
    const p = this.game.player;
    for (const x of this.pieces) x.update?.(dt, p);
  }
  // the live-part hooks: the big button's word and what it does (the first piece with a word)
  near(p) {
    if (!this.playing() || p !== this.game.player) return null;
    for (const x of this.pieces) { const w = x.near?.(p); if (w) return w; }
    return null;
  }
  use(p) { return this.playing() && this.pieces.some(x => x.near?.(p) && x.use(p)); }
  info() { return Object.assign({}, ...this.pieces.map(x => x.info?.() ?? {})); }
  dispose() {
    for (const x of this.pieces) x.dispose();
    this.scene?.remove(this.group);
  }
}
