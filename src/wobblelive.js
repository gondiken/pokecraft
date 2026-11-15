// Chapter 3 (plans/chapter3-world.md, "Built from the owner's first play"): Wobbleland's live part (LIVE.wobble, world.parts from
// wobbleland.js), ?preview only like the realm. Nothing here is saved or sent; it draws from game.beaten (the patches' keys).
//   A3 paint-pot hops: every cleared patch leaves a paint pot of its own colour in its middle, the Camp has one from the start. Stand in a
//      pot and look the way you want to go: a beam of colour stands over the pot you would hop to, the big button says "Hop to blue!".
//      One look, no list: the pot nearest to where you look is the one (`hopOf`).
//   C5 drawn springs: a crayon coil over each Bounce Block beside a floating hill (wobbleland.js FLOATERS); it squashes while you stand on it.
//   A2 scribble bugs (scribblebugs.js, pure rules): four round every patch not cleared yet; walk into one and it pops into colour.
import * as THREE from 'three';
import { sound } from './sound.js';
import { PATCHES, CAMP_POT, patchKey, heightAt, FLOATERS, RIVER_UP, riverY, inCave, FLY_CEILING, SIZE } from './wobbleland.js';
import { BugField, bugsFor } from './scribblebugs.js';
import { curlLift } from './wobblelook.js';
import { SkidMarks } from './skidmarks.js'; // Slippy Lake
import { DIFFICULTY } from './difficulty.js'; // the bugs on Easy / Hard
import { SHAFT, dripsAt } from './wayland.js'; // chapter 3: the Drip Tower (plans/chapter3-ways.md)
import { SLUICE, rowsShut } from './sluice.js'; // step D: the Sluice Gate (Swim)
import { THINGS, aimedThing, thingAt } from './things.js'; // step D: things an ability acts on (Dig, Push...)
import { DIG_PATCH } from './earthworks.js';
import { windAt, RAPID, WIND } from './fireice.js';
import { bouldersAt, smudgeAt } from './slipthrough.js';
import { ABILITIES } from './abilities.js';
import { abilitySvg } from './abilityicons.js';
import { portrait } from './ui.js';
import { nameOf } from './species.js';

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


// Chapter 3: the ability places' live side. The rules are wayland.js Trials (the Drip Tower's drips, sluice.js SluiceRun; stepped here each frame after you moved, its clock standing still while the game is paused: the islands and the gate move
// their blocks through LiveCells). This draws the rest: the drips; the Sluice Gate's gold plate with its
// three gate lights (one per row of the gate: lit = still open; one light also over the gate itself), the kelp and the bubble jets.
class WayPlaces extends Piece {
  constructor(scene) {
    super(scene);
    this.trials = this.s.world.trials ?? null; this.told = new Set(); this.clock = 0;
    if (!this.trials) return;
    this.drips = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(SHAFT.r, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3a2a6e })); m.scale.y = 1.4; m.visible = false; this.group.add(m); return m; });
    // the Drip Tower's ice, made obvious (owner 2026-11-14): a glossy blue skin over its outside, shine streaks and icicles under the roof
    const T = SHAFT, ih = T.roof - T.floor, ice = new THREE.Mesh(new THREE.BoxGeometry(5.12, ih, 5.12), new THREE.MeshLambertMaterial({ color: 0x9fe4ff, emissive: 0x3a8ab0, emissiveIntensity: 0.35, transparent: true, opacity: 0.55, depthWrite: false }));
    ice.position.set(T.x + 0.5, T.floor + ih / 2, T.z + 0.5); this.group.add(ice);
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 0; k < 3; k++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 3 + k * 1.5), shineMat);
      sh.position.set(T.x + 0.5 + nx * 2.58 + (nz ? (k - 1) * 1.4 : 0), T.floor + 3 + k * 4, T.z + 0.5 + nz * 2.58 + (nx ? (k - 1) * 1.4 : 0));
      sh.rotation.set(0, Math.atan2(nx, nz), 0.35); this.group.add(sh);
    }
    const icicle = new THREE.ConeGeometry(0.16, 0.9, 5), icicleMat = new THREE.MeshLambertMaterial({ color: 0xd6f4ff, emissive: 0x5aa8d0, emissiveIntensity: 0.3 });
    for (let k = 0; k < 20; k++) {
      const side = k % 4, u = (Math.floor(k / 4) / 4 - 0.5) * 4.6, nx = [1, -1, 0, 0][side], nz = [0, 0, 1, -1][side];
      const c = new THREE.Mesh(icicle, icicleMat); c.rotation.x = Math.PI; c.scale.y = 0.7 + ((k * 7) % 5) / 6;
      c.position.set(T.x + 0.5 + nx * 2.62 + (nz ? u : 0), T.roof - 0.45 * c.scale.y, T.z + 0.5 + nz * 2.62 + (nx ? u : 0)); this.group.add(c);
    }
    // the Sluice Gate: the plate, its post of three lights (top row first), a light over the gate
    const S = SLUICE, gold = new THREE.MeshLambertMaterial({ color: 0xf2c418, emissive: 0x6a4a00 });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.12, 20), gold); plate.position.set(S.plate.x + 0.5, 11.06, S.plate.z + 0.5); this.plate = plate;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), new THREE.MeshLambertMaterial({ color: 0x8a6a44 })); post.position.set(S.plate.x + 1.9, 12.3, S.plate.z + 0.5);
    this.group.add(plate, post);
    this.lamps = [];
    const lampAt = (x, y, z) => [0, 1, 2].map(r => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshBasicMaterial({ color: 0x46d0e0 })); m.position.set(x, y + (2 - r) * 0.62, z); this.group.add(m); this.lamps.push({ m, r }); return m; });
    lampAt(S.plate.x + 1.9, 12.4, S.plate.z + 0.5);
    lampAt((S.gate.x0 + S.gate.x1 + 1) / 2, 11.4, S.gate.z + 0.5); // (over the gate, seen through the glass)
    // kelp: swaying ribbons in the kelp beds (instanced); bubble jets: streams of little bubbles along each jet
    this.kelp = []; const kelpMat = new THREE.MeshLambertMaterial({ color: 0x2e8b3a }), kelpGeo = new THREE.BoxGeometry(0.12, 2.6, 0.32);
    for (const k of S.kelp) for (let x = k.x0; x <= k.x1; x++) for (let z = k.z0; z <= k.z1; z++) if ((x * 7 + z * 3) % 2 === 0) this.kelp.push([x + 0.5 + Math.sin(x * 3.1 + z) * 0.3, z + 0.5 + Math.cos(x + z * 2.3) * 0.3, x * 1.7 + z]);
    this.kelpMesh = new THREE.InstancedMesh(kelpGeo, kelpMat, this.kelp.length); this.group.add(this.kelpMesh);
    this.jets = S.jets.map(j => { const n = Math.round(((j.x1 - j.x0 + 1) * (j.z1 - j.z0 + 1)) * 1.6); const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.8 }), n); this.group.add(mesh); return { j, mesh, n }; });
    this.dummy = new THREE.Object3D();
  }
  update(dt, p) {
    if (!this.trials) return;
    if (this.s.playing() && p) { this.clock += dt; for (const e of this.trials.step(p, dt)) this.event(e, p); }
    const ys = dripsAt(this.trials.t);
    this.drips.forEach((m, k) => { m.visible = k < ys.length; if (m.visible) m.position.set(SHAFT.x + 0.5, ys[k] + SHAFT.r, SHAFT.z + 0.5); });
    const R = this.trials.sluice, shut = R.since == null ? (R.wasOn ? 0 : 3) : rowsShut(R.since);
    for (const L of this.lamps) L.m.material.color.setHex(L.r < shut ? 0x3a2a20 : R.wasOn || R.since != null ? 0x7fe0a0 : 0x46d0e0);
    this.plate.position.y = R.wasOn ? 11.0 : 11.06;
    const t = this.clock, d = this.dummy, S = SLUICE;
    this.kelp.forEach(([x, z, ph], i) => { d.position.set(x, S.y0 + 1.3, z); d.rotation.set(Math.sin(t * 1.3 + ph) * 0.25, ph, Math.cos(t * 1.1 + ph) * 0.2); d.updateMatrix(); this.kelpMesh.setMatrixAt(i, d.matrix); });
    this.kelpMesh.instanceMatrix.needsUpdate = true;
    for (const { j, mesh, n } of this.jets) {
      const lx = j.x1 - j.x0 + 1, lz = j.z1 - j.z0 + 1, along = j.v[0] ? lx : lz;
      for (let i = 0; i < n; i++) {
        const u = ((i * 0.618 + t * 0.9) % 1) * along, w = ((i * 0.377) % 1), h = S.y0 + ((i * 0.733) % 1) * 2.8;
        d.position.set(j.v[0] ? j.x0 + u : j.x0 + w * lx, h, j.v[0] ? j.z0 + w * lz : j.z0 + u); d.rotation.set(0, 0, 0); d.scale.setScalar(0.6 + ((i * 0.29) % 1)); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      }
      d.scale.setScalar(1);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  event(e, p) {
    const say = (id, text, small = false) => this.once(id, text, small);
    if (e.kind === 'knocked') { try { sound.play('pumpkinsplat'); } catch { /* optional */ } say('knocked', 'Splat! A drip knocked you off.'); }
    else if (e.kind === 'open') { try { sound.play('doorchime'); } catch { /* optional */ } say('open', 'The gate is open! Swim before it shuts!'); }
    else if (e.kind === 'shut') { try { sound.play('drawbridge'); } catch { /* optional */ } }
    else if (e.kind === 'through') { try { sound.play('win'); } catch { /* optional */ } say('through', 'You made it through the gate!'); }
  }
  once(id, text) { if (this.told.has(id)) return; this.told.add(id); this.game.ui?.toast(text); }
  info() {
    if (!this.trials) return {};
    const R = this.trials.sluice;
    return { trialsT: +this.trials.t.toFixed(2), drips: dripsAt(this.trials.t).length, gateShut: R.shown, gateSince: R.since == null ? null : +R.since.toFixed(2), through: R.through };
  }
}

// Step D's second pair (earthworks.js, things.js): Dig and Push. The rules are wayland.js Trials' EarthRun; this draws the boulders and
// the stone balls (round rocks with a drawn ink outline: the land is a drawing), the gold key, the warm-or-cold glow in each hole, the
// little flags of the Warm-or-Cold Dig (one falls with each wrong hole), and is the big button's "Dig!" (things.js aimedThing: only when
// the creature you are can dig and looks at soft earth). Without the ability a tap on soft earth says why once (THINGS.why).
const FAR = 56; // (blocks: a place's models further away than this are not drawn)
// the one line a creature without the ability is told, once a session (things.js THINGS[kind].why)
function whyOnce(game, kind, text = THINGS[kind]?.why) { const id = 'thing:' + kind; if (!text || game.toldOnce?.has(id)) return; game.toldOnce?.add(id); game.ui?.toast(text); }
const EARTH_KINDS = new Set(['soft']), FIRE_KINDS = new Set(['thorns', 'icewall', 'water', 'falls']);
const WARM_COLOURS = [0xffd84a, 0xff3a2a, 0xff9a2a, 0xffe14a, 0x4aa8ff]; // 0 the key (gold), 1 red, 2 orange, 3 yellow, 4 cold blue
function outlined(geo, colour) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: colour, flatShading: true })));
  const ink = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x2a2018, side: THREE.BackSide })); ink.scale.setScalar(1.07); g.add(ink);
  return g;
}
class Earthworks extends Piece {
  constructor(scene) {
    super(scene);
    this.run = this.s.world.trials?.earth ?? null;
    if (!this.run) return;
    this.rocks = new Map();
    for (const r of this.run.boulders) {
      const m = outlined(new THREE.IcosahedronGeometry(1.0, 1), 0x8f8a80); m.scale.set(1, 0.95, 1);
      const moss = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshLambertMaterial({ color: 0x6a8a4a })); moss.position.set(0.3, 0.75, 0.2); moss.scale.y = 0.35; m.add(moss);
      this.group.add(m); this.rocks.set(r, m);
    }
    for (const r of this.run.balls) {
      const m = outlined(new THREE.SphereGeometry(0.48, 16, 12), 0xa8a294);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.485, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: 0x4a4038 })); m.add(band);
      const band2 = band.clone(); band2.rotation.y = Math.PI / 2; m.add(band2);
      this.group.add(m); this.rocks.set(r, m);
    }
    // the Warm-or-Cold Dig: a glow in each hole, the flags on its south rim, the gold key
    const P = this.s.world.earth.patch;
    this.glows = Array.from({ length: DIG_PATCH.digs + 1 }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })); m.visible = false; this.group.add(m); return m; });
    this.flags = Array.from({ length: DIG_PATCH.digs }, (_, i) => {
      const g = new THREE.Group(), stick = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), new THREE.MeshLambertMaterial({ color: 0x9a6a3a }));
      stick.position.y = 0.55; g.add(stick);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshBasicMaterial({ color: 0xe8402a, side: THREE.DoubleSide })); flag.position.set(0.27, 0.92, 0); g.add(flag);
      g.position.set(P.x0 + 0.5 + i * (P.n - 1) / (DIG_PATCH.digs - 1), P.g + 1, P.z0 + P.n + 0.5); this.group.add(g); return g;
    });
    this.key = new THREE.Group();
    const gold = new THREE.MeshLambertMaterial({ color: 0xf2c418, emissive: 0x8a6a00 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), gold); ring.position.y = 0.5; this.key.add(ring);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.6, 0.09), gold); shaft.position.y = 0.05; this.key.add(shaft);
    const bit = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.09), gold); bit.position.set(0.1, -0.15, 0); this.key.add(bit);
    this.key.visible = false; this.group.add(this.key); this.keyT = 0;
    this.clock = 0;
  }
  // the big button's word: Dig! when the creature you are can dig the soft earth you look at
  near(p) { const a = this.run && aimedThing(this.s.world, p, p.be?.abilities ?? []); return a && EARTH_KINDS.has(a.kind) ? a.word : null; }
  use(p) { const a = this.run && aimedThing(this.s.world, p, p.be?.abilities ?? []); if (!a || !EARTH_KINDS.has(a.kind)) return false; this.run.dig(a.cell, p.be.abilities); return true; }
  // a tap on soft earth you cannot dig: why (once)
  hit(block) {
    if (!this.run) return false;
    const th = thingAt(this.s.world, block.x, block.y, block.z), k = th && THINGS[th.kind];
    if (!k || !EARTH_KINDS.has(th.kind)) return false;
    const p = this.game.player;
    if ((p?.be?.abilities ?? []).includes(k.needs)) { this.run.dig(block, p.be.abilities); return true; }
    whyOnce(this.game, th.kind);
    return true;
  }
  why(kind) { whyOnce(this.game, kind); }
  update(dt) {
    if (!this.run) return;
    this.clock += dt;
    for (const e of this.run.log.splice(0)) this.event(e); // (everything since the last frame; Trials steps first, in WayPlaces)
    const me = this.game.player?.pos, far = (x, z) => !me || Math.hypot(me.x - x, me.z - z) > FAR; // (draw calls: things far away are not drawn)
    for (const [r, m] of this.rocks) {
      m.visible = !far(r.at[0], r.at[2]);
      const s = r.size / 2, k = r.from ? r.k : 1, a = r.from ?? r.at, b = r.at;
      m.position.set(a[0] + (b[0] - a[0]) * k + s, a[1] + (b[1] - a[1]) * k + s, a[2] + (b[2] - a[2]) * k + s);
      if (r.kind === 'ball' && r.from) { m.rotation.x += (b[2] - a[2]) * dt * 14; m.rotation.z -= (b[0] - a[0]) * dt * 14; }
      else if (r.kind === 'boulder' && r.from) { m.rotation.x += (b[2] - a[2]) * dt * 2.6; m.rotation.z -= (b[0] - a[0]) * dt * 2.6; }
    }
    const R = this.run, P = this.s.world.earth.patch, near = !far(P.x0 + 3, P.z0 + 3);
    for (const f of this.flags) f.visible = near;
    R.holesDug.forEach(([u, v, l], i) => { const m = this.glows[i]; m.visible = true; m.material.color.setHex(WARM_COLOURS[l]); m.position.set(P.x0 + u + 0.5, P.g - 1 + 0.06, P.z0 + v + 0.5); m.material.opacity = 0.65 + 0.3 * Math.sin(this.clock * 4 + i); });
    for (let i = R.holesDug.length; i < this.glows.length; i++) this.glows[i].visible = false;
    this.flags.forEach((f, i) => { const down = i >= R.digsLeft; f.rotation.z += ((down ? -1.45 : 0) - f.rotation.z) * Math.min(1, dt * 8); });
    if (R.found) { this.keyT += dt; this.key.visible = true; this.key.position.y = P.g - 0.6 + Math.min(1, this.keyT * 1.5) * 2.2; this.key.rotation.y = this.clock * 2.5; }
    else { this.key.visible = false; this.keyT = 0; }
  }
  event(e) {
    const say = t => this.game.ui?.toast(t), snd = n => { try { sound.play(n); } catch { /* optional */ } };
    if (e.kind === 'dug') { snd('break'); this.s.puff({ x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5, colour: 0x6a4a2a }); }
    else if (e.kind === 'warm') { snd('break'); this.s.puff({ x: e.x + 0.5, y: e.y + 1, z: e.z + 0.5, colour: WARM_COLOURS[e.level] }, e.level < 4 ? 3 - e.level : 0); }
    else if (e.kind === 'found') { this.key.position.set(e.x + 0.5, e.y, e.z + 0.5); snd('win'); this.s.puff({ x: e.x + 0.5, y: e.y + 1.5, z: e.z + 0.5, colour: 0xffd84a }, 3); }
    else if (e.kind === 'case') { snd('doorchime'); say('The glass case is open!'); }
    else if (e.kind === 'rumble') { snd('drawbridge'); say('Rumble! The earth shuts and the key moves.'); }
    else if (e.kind === 'heavy') this.why(e.what);
    else if (e.kind === 'push') snd('break');
    else if (e.kind === 'roll') snd('boing');
    else if (e.kind === 'drop') { snd('cube'); }
  }
  info() { return this.run ? { earth: this.run.info() } : {}; }
}

// Step D's third pair (fireice.js): Burn and Freeze. The rules are wayland.js Trials' FireIceRun; this draws the brambles (a tangle of
// dark twigs with thorns over each hidden solid cell, instanced), flames (leaning the way the wind blows), the windsock at the Windy
// Bramble Tunnel's mouth and leaves blowing through it, foam rushing down the rapids, and the Frozen Falls' rough ice column.
// one bramble's geometry (cell-centred, about 1 block): 7 dark twigs crossing each other, two red thorns on each; vertex colours, merged
function brambleGeometry() {
  const pos = [], nor = [], col = [], tw = new THREE.Color(0x3e4a22), th = new THREE.Color(0xa83a2a), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const add = (geo, matrix, c) => {
    const g = geo.toNonIndexed(); g.applyMatrix4(matrix);
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) col.push(c.r, c.g, c.b);
  };
  const twig = new THREE.BoxGeometry(0.09, 1.25, 0.09), thorn = new THREE.ConeGeometry(0.06, 0.2, 4);
  for (let k = 0; k < 7; k++) {
    const h = n => ((Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    e.set((h(3) - 0.5) * 2.2, h(4) * 3, (h(5) - 0.5) * 2.2); q.setFromEuler(e);
    const at = new THREE.Vector3(h(1) * 0.6 - 0.3, 0, h(2) * 0.6 - 0.3);
    add(twig, m.compose(at, q, new THREE.Vector3(1, 1, 1)), tw);
    for (let j = 0; j < 2; j++) {
      const v = new THREE.Vector3(0, j ? 0.3 : -0.25, 0.07).applyEuler(e).add(at), q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(e.x + Math.PI / 2, e.y + j * 2, e.z));
      add(thorn, m.compose(v, q2, new THREE.Vector3(1, 1, 1)), th);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
class FireIce extends Piece {
  constructor(scene) {
    super(scene);
    this.run = this.s.world.trials?.fireice ?? null;
    if (!this.run) return;
    const w = this.s.world, d = this.dummy = new THREE.Object3D();
    // brambles: one tangle per thorns cell (instanced: twigs + thorns)
    this.cells = [];
    for (const [i, o] of w.things) if (o.kind === 'thorns') { const y = Math.floor(i / (w.W * w.D)), r = i - y * w.W * w.D; this.cells.push([r % w.W, y, Math.floor(r / w.W), i]); }
    // a bramble = one merged geometry (a tangle of 7 twigs with thorns on each), one instance per cell: one draw call for all of them
    this.twigs = new THREE.InstancedMesh(brambleGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), this.cells.length);
    this.shown = this.cells.map(() => false); this.redraw = true;
    this.group.add(this.twigs);
    // flames: a few cones per burning spot
    this.flameMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85 }), 40);
    this.flameMesh.count = 0; this.group.add(this.flameMesh);
    this.fires = []; // { x, y, z, t, lean }
    // the windsock at the tunnel's mouth and leaves in the tunnel
    const T = w.fireice.tunnel;
    if (T) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), new THREE.MeshLambertMaterial({ color: 0x8a6a44 })); pole.position.set(T.x0 - 1.5, T.g + 2.6, T.z - 1.2);
      this.sock = new THREE.Group(); this.sock.position.set(T.x0 - 1.5, T.g + 4.0, T.z - 1.2);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.12, 1.6, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xff6a2a, side: THREE.DoubleSide }));
      cone.rotation.z = Math.PI / 2; cone.position.x = 0.8; this.sock.add(cone);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })); band.rotation.z = Math.PI / 2; band.position.x = 0.9; this.sock.add(band);
      this.group.add(pole, this.sock); this.pole = pole;
      this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshLambertMaterial({ color: 0x7a9a3a, side: THREE.DoubleSide }), 24); this.group.add(this.leaves);
      this.leafX = Array.from({ length: 24 }, (_, i) => T.x0 - 2 + ((i * 0.618) % 1) * (T.x1 - T.x0 + 4));
    }
    // foam on the rapids
    this.foam = w.fireice.rapids.map(r => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.06, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }), 30); this.group.add(m); return { r, m }; });
    // the frozen falls: rough ice, one block per frozen row
    const Fa = w.fireice.falls;
    if (Fa) {
      this.ice = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 0), new THREE.MeshLambertMaterial({ color: 0xf4fbff, emissive: 0x9ad0f0, emissiveIntensity: 0.45, flatShading: true }), Fa.cells.length * 2);
      this.ice.count = 0; this.group.add(this.ice);
      // the running falls: white streaks pouring down its column (so a child sees it is a waterfall, not more of the cliff's ice)
      this.pour = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.9, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), 36);
      this.group.add(this.pour);
    }
    this.group.traverse(o => { if (o.isInstancedMesh) o.frustumCulled = false; }); // (instances move after the bounds were taken)
    this.clock = 0;
  }
  // the big button: "Burn!" at brambles / an ice door, "Freeze!" at water (things.js; only when the creature you are can)
  near(p) { const a = this.run && aimedThing(this.s.world, p, p.be?.abilities ?? []); return a && FIRE_KINDS.has(a.kind) && !(a.kind === 'falls' && this.run.fallsT != null) ? a.word : null; }
  use(p) { const a = this.run && aimedThing(this.s.world, p, p.be?.abilities ?? []); if (!a || !FIRE_KINDS.has(a.kind)) return false; this.run.act(a.cell, p.be.abilities); return true; }
  hit(block) {
    if (!this.run) return false;
    const th = thingAt(this.s.world, block.x, block.y, block.z), k = th && THINGS[th.kind];
    if (!k || !FIRE_KINDS.has(th.kind)) return false;
    const p = this.game.player;
    if ((p?.be?.abilities ?? []).includes(k.needs)) { this.run.act(block, p.be.abilities); return true; }
    whyOnce(this.game, th.kind);
    return true;
  }
  update(dt) {
    if (!this.run) return;
    this.clock += dt;
    const R = this.run, w = this.s.world, d = this.dummy, me = this.game.player?.pos, far = (x, z) => !me || Math.hypot(me.x - x, me.z - z) > FAR;
    for (const e of R.log.splice(0)) this.event(e);
    const T0 = w.fireice.tunnel, Fa0 = w.fireice.falls;
    if (this.sock) this.sock.visible = this.pole.visible = this.leaves.visible = !far((T0.x0 + T0.x1) / 2, T0.z);
    for (const f of this.foam) f.m.visible = !far(f.r.x, (f.r.z0 + f.r.z1) / 2);
    if (this.ice) this.ice.visible = !far(Fa0.fx, Fa0.z);
    // brambles that are burnt away are not drawn
    let changed = this.redraw; this.redraw = false;
    this.cells.forEach(([x, y, z], c) => {
      const on = w.get(x, y, z) !== 0;
      if (on === this.shown[c] && !changed) return;
      this.shown[c] = on; changed = true;
      if (on) { d.position.set(x + 0.5, y + 0.5, z + 0.5); d.rotation.set(0, c * 1.7, 0); d.scale.setScalar(1); d.updateMatrix(); this.twigs.setMatrixAt(c, d.matrix); } else this.twigs.setMatrixAt(c, ZERO);
    });
    if (changed) this.twigs.instanceMatrix.needsUpdate = true;
    // flames
    this.fires = this.fires.filter(f => this.clock - f.t < (f.life ?? 1.1));
    let n = 0;
    const lean = windAt(R.t).way;
    for (const f of this.fires) for (let k = 0; k < 5 && n < 40; k++, n++) {
      if (f.tunnel) f.lean = lean;
      const a = this.clock - f.t, life = f.life ?? 1.1, s = Math.max(0.05, f.life ? 1 : 1 - a / life) * (0.7 + ((k * 0.37) % 0.6));
      d.position.set(f.x + Math.sin(k * 2.1) * 0.3 + f.lean * a * 1.6, f.y + a * 0.8 + ((k * 0.29) % 0.4), f.z + Math.cos(k * 1.7) * 0.3);
      d.rotation.set(0, 0, -f.lean * 0.7); d.scale.set(s, s * (1 + Math.sin(this.clock * 18 + k) * 0.2), s); d.updateMatrix(); this.flameMesh.setMatrixAt(n, d.matrix);
    }
    this.flameMesh.count = n; this.flameMesh.visible = n > 0; this.flameMesh.instanceMatrix.needsUpdate = true;
    // the wind: the windsock and the leaves
    const T = w.fireice.tunnel;
    if (T && this.sock) {
      const wind = windAt(R.t), way = wind.way;
      this.sockYaw = (this.sockYaw ?? 0) + (((way < 0 ? Math.PI : 0)) - (this.sockYaw ?? 0)) * Math.min(1, dt * 4);
      this.sock.rotation.set(0, this.sockYaw, way === 0 ? -1.1 : -0.1 + Math.sin(this.clock * 9) * 0.06);
      this.leafX.forEach((x0, i) => {
        this.leafX[i] += way * dt * 6;
        if (this.leafX[i] > T.x1 + 2) this.leafX[i] -= T.x1 - T.x0 + 4; if (this.leafX[i] < T.x0 - 2) this.leafX[i] += T.x1 - T.x0 + 4;
        d.position.set(this.leafX[i], T.g + 1.2 + ((i * 0.53) % 0.9) + Math.sin(this.clock * 5 + i) * 0.1, T.z + 0.2 + ((i * 0.71) % 0.6));
        d.rotation.set(this.clock * 3 + i, i, way * 0.5); d.scale.setScalar(way === 0 ? 0 : 1); d.updateMatrix(); this.leaves.setMatrixAt(i, d.matrix);
      });
      this.leaves.instanceMatrix.needsUpdate = true;
    }
    // foam rushing down the rapids (none where frozen)
    for (const { r, m } of this.foam) {
      for (let i = 0; i < 30; i++) {
        const z = r.z0 + 2 + (((i * 0.618) + this.clock * RAPID.speed / (r.z1 + 4 - r.z0)) % 1) * (r.z1 + 2 - r.z0), x = r.x - 0.8 + ((i * 0.377) % 1) * 2.6;
        const frozen = R.frozen.has(w.index(Math.floor(x), r.w, Math.floor(z)));
        d.position.set(x, r.w + 1.02, z); d.rotation.set(0, 0, 0); d.scale.setScalar(frozen ? 0 : 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    // the frozen falls
    const Fa = w.fireice.falls;
    if (Fa && this.ice) {
      const rows = R.fallsRows();
      for (let k = 0; k < rows; k++) for (let j = 0; j < 2; j++) { const [x, y, z] = Fa.cells[k]; d.position.set(x + 0.5 + (j ? 0.18 : -0.18), y + 0.5 + j * 0.25, z + 0.55); d.rotation.set(k * 1.3 + j, k * 0.7 + j * 2, 0); d.scale.set(0.85, 0.9, 0.75); d.updateMatrix(); this.ice.setMatrixAt(k * 2 + j, d.matrix); }
      this.ice.count = rows * 2; this.ice.instanceMatrix.needsUpdate = true;
      this.pour.visible = this.ice.visible && rows === 0;
      if (this.pour.visible) {
        const H = Fa.cells.length;
        for (let i = 0; i < 36; i++) { const u = ((i * 0.618) + this.clock * 1.4) % 1; d.position.set(Fa.fx + 0.15 + ((i * 0.377) % 1) * 0.7, Fa.g + 1 + (1 - u) * H, Fa.z + Fa.d + 1.02); d.rotation.set(0, 0, 0); d.scale.set(1, 1 + (i % 3) * 0.4, 1); d.updateMatrix(); this.pour.setMatrixAt(i, d.matrix); }
        this.pour.instanceMatrix.needsUpdate = true;
      }
    }
  }
  event(e) {
    const say = t => this.game.ui?.toast(t), snd = n => { try { sound.play(n); } catch { /* optional */ } };
    if (e.kind === 'burnt' || e.kind === 'melted') { snd('fx:fire'); this.fires.push({ x: e.x + 0.5, y: e.y + 0.3, z: e.z + 0.5, t: this.clock, lean: 0 }); }
    else if (e.kind === 'backfire') { snd('fx:fire'); this.fires = this.fires.filter(f => !f.tunnel); this.fires.push({ x: e.x + 0.5, y: this.s.world.fireice.tunnel.g + 1.3, z: e.z + 0.5, t: this.clock, lean: -1 }); }
    else if (e.kind === 'lit') { snd('fx:fire'); this.fires.push({ x: e.x + 0.5, y: e.y + 0.3, z: e.z + 0.5, t: this.clock, lean: 0, life: WIND.burn, tunnel: true }); }
    else if (e.kind === 'whoosh') { snd('pumpkinsplat'); whyOnce(this.game, 'wind', 'Whoosh! The wind blew the fire back at you.'); }
    else if (e.kind === 'frozen' || e.kind === 'falls') { snd('fx:ice'); this.s.puff({ x: e.x + 0.5, y: e.y + 1, z: e.z + 0.5, colour: 0xd6f4ff }, 1); }
    else if (e.kind === 'melting') { snd('drawbridge'); say('Drip, drip... the ice is melting!'); }
    else if (e.kind === 'heavy') whyOnce(this.game, e.what);
  }
  info() { return this.run ? { fireice: this.run.info() } : {}; }
}

// Step D's fourth pair (slipthrough.js): Squeeze and Pass through. The rules are wayland.js Trials' SlipRun (and player.js: squashing
// flat, ghostly creatures through faded cells); this draws the cracks (jagged ink lines round each one, one instanced mesh), the Boulder
// Run's rolling stone wheels, the pencil houses' half-erased walls (faint paper with broken pencil lines) and the Sliding Smudge's inked
// walls with their rubbed-out patch and the pink eraser on top.
function pencilTexture(faded) { // a canvas: hatching (dark, inked) or a few broken pencil lines on paper (faded)
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = faded ? 'rgba(248,244,232,0.35)' : '#3a3a44'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = faded ? 'rgba(90,90,100,0.55)' : 'rgba(20,20,26,0.9)'; g.lineWidth = faded ? 1.5 : 2;
  for (let i = -64; i < 64; i += faded ? 14 : 7) { if (faded && (i / 14) % 2) g.setLineDash([6, 7]); else g.setLineDash(faded ? [10, 5] : []); g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
class SlipPieces extends Piece {
  constructor(scene) {
    super(scene);
    this.run = this.s.world.trials?.slip ?? null;
    const S = this.s.world.slip;
    if (!this.run || !S) return;
    const d = this.dummy = new THREE.Object3D();
    // cracks: a few jagged ink strokes round each crack's opening (the cracked rocks' and the Boulder Run's)
    const cracks = [];
    for (const c of S.cracked) cracks.push({ x: c.x + 2.5, y: c.g + 1, z: c.z + 6.01, nx: 0, nz: 1 });
    for (const n of S.run?.nooks ?? []) cracks.push({ x: S.run.x + 0.01, y: S.run.g + 1, z: n + 1, nx: 1, nz: 0 });
    const strokes = [[-0.55, 0.15, 0.6, 0.4], [0.5, 0.2, -0.5, 0.5], [-0.35, 1.05, 0.9, 0.2], [0.3, 1.2, -0.7, 0.35], [-0.05, 1.45, 0.2, 0.3], [0.62, 0.7, 1.2, 0.3]]; // [u, v, angle, length] round the opening
    this.cracks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: 0x1a1a22 }), cracks.length * strokes.length);
    cracks.forEach((c, i) => strokes.forEach(([u, v, a, l], k) => {
      d.position.set(c.x + (c.nz ? u : 0), c.y + v, c.z + (c.nx ? u : 0)); d.rotation.set(0, c.nx ? Math.PI / 2 : 0, a); d.scale.set(l, 1, 1); d.updateMatrix(); this.cracks.setMatrixAt(i * strokes.length + k, d.matrix);
    }));
    this.group.add(this.cracks);
    // the Boulder Run: stone wheels
    const wheelGeo = new THREE.CylinderGeometry(0.92, 0.92, 0.8, 16), wheelMat = new THREE.MeshLambertMaterial({ color: 0x8f8a80, flatShading: true });
    this.wheels = [0, 1, 2].map(() => { const m = new THREE.Mesh(wheelGeo, wheelMat); m.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(m); const ink = new THREE.Mesh(wheelGeo, new THREE.MeshBasicMaterial({ color: 0x2a2018, side: THREE.BackSide })); ink.rotation.z = Math.PI / 2; ink.scale.setScalar(1.06); g.add(ink); g.visible = false; this.group.add(g); return g; });
    // the pencil houses' faded walls: faint paper with broken pencil lines
    const fadedMat = new THREE.MeshBasicMaterial({ map: pencilTexture(true), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xffffff });
    this.fadedWalls = S.pencil.map(c => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), fadedMat); m.position.set(c.x + 4.5, c.g + 2, c.z + 2.5); this.group.add(m); return { m, x: c.x, z: c.z }; });
    // the Sliding Smudge: each wall drawn as an inked part each side of its rubbed-out patch, and a pink eraser riding along its top
    const M = S.smudge, inkMat = new THREE.MeshLambertMaterial({ map: pencilTexture(false), color: 0xffffff }), box = new THREE.BoxGeometry(1, 3, M.thick);
    this.smudge = M.walls.map(z0 => {
      const a = new THREE.Mesh(box, inkMat), b = new THREE.Mesh(box, inkMat), f = new THREE.Mesh(box, fadedMat);
      const er = new THREE.Mesh(new THREE.BoxGeometry(M.w * 0.8, 0.6, 1.2), new THREE.MeshLambertMaterial({ color: 0xf08aa8 }));
      this.group.add(a, b, f, er); return { z0, a, b, f, er };
    });
    this.group.traverse(o => { if (o.isInstancedMesh) o.frustumCulled = false; });
  }
  update(dt) {
    if (!this.run) return;
    const S = this.s.world.slip, R = this.run, me = this.game.player?.pos, far = (x, z) => !me || Math.hypot(me.x - x, me.z - z) > FAR;
    for (const e of R.log.splice(0)) this.event(e);
    const run = S.run, bs = run ? (far(run.x, (run.z0 + run.z1) / 2) ? [] : bouldersAt(R.t)) : [];
    this.wheels.forEach((g, i) => { g.visible = i < bs.length; if (g.visible) { g.position.set(run.x + 0.5, run.g + 1.95, bs[i]); g.children.forEach(m => { m.rotation.x = bs[i] * 1.1; }); } });
    for (const w of this.fadedWalls) w.m.visible = !far(w.x, w.z);
    const M = S.smudge, mv = !far((M.x0 + M.x1) / 2, (M.z0 + M.room) / 2);
    this.smudge.forEach(({ z0, a, b, f, er }, k) => {
      for (const o of [a, b, f, er]) o.visible = mv;
      if (!mv) return;
      const s0 = smudgeAt(k, R.t), x0 = M.x0, x1 = M.x1 + 1, y = M.g + 2.5, z = z0 + M.thick / 2;
      const la = Math.max(0.001, s0 - x0), lb = Math.max(0.001, x1 - (s0 + M.w));
      a.scale.x = la; a.position.set(x0 + la / 2, y, z);
      b.scale.x = lb; b.position.set(x1 - lb / 2, y, z);
      f.scale.x = M.w; f.position.set(s0 + M.w / 2, y, z);
      er.position.set(s0 + M.w / 2, M.g + 4.3, z); er.rotation.z = Math.sin(R.t * 9) * 0.08;
    });
  }
  event(e) {
    const snd = n => { try { sound.play(n); } catch { /* optional */ } };
    if (e.kind === 'squished') { snd('pumpkinsplat'); whyOnce(this.game, 'boulder-run', 'Bonk! A rolling boulder pushed you back. Hide in a crack!'); }
    else if (e.kind === 'inked') { snd('twinplop'); whyOnce(this.game, 'inked', 'Inked in! Stay inside the rubbed-out patch.'); }
    else if (e.kind === 'heavy') whyOnce(this.game, e.what);
  }
  info() { return this.run ? { slip: this.run.info() } : {}; }
}

// Step C (plans/chapter3-abilities-build.md): "the world says what it needs", generic: it reads `game.being.need()` (abilityplaces.js:
// `world.needPlaces` data + the tries) and knows no ability. Owner 2026-11-14: discovery first, so nothing shows at first (no badges,
// no button word: abilities work with the usual controls). Only after a few tries without what a place needs (being.js `hints`) a card
// shows at the top: the badge, "Needs Climb", and your three, the ones that can lit, the one Swap goes to ringed.
class NeedPlaces extends Piece {
  constructor(scene) { super(scene); this.cardKey = null; this.card = null; this.cur = null; }
  update() {
    const need = this.s.playing() ? this.game.being?.need?.() ?? null : null;
    this.cur = need;
    this.showCard(need && need.shown && !need.has ? need : null);
  }
  // the card (DOM, browser only): redrawn only when what it says changes
  showCard(n) {
    if (typeof document === 'undefined') return;
    const squad = this.game.being?.squad?.() ?? [];
    const swapTo = n ? this.game.being?.swapTarget?.() ?? null : null;
    const key = n ? `${n.needs}|${n.who.join()}|${swapTo}|${squad.map(c => c.uid ?? c.species).join()}` : '';
    if (key === this.cardKey) return;
    this.cardKey = key;
    if (!this.card) { this.card = document.createElement('div'); this.card.id = 'need'; document.body.appendChild(this.card); }
    this.card.classList.toggle('hidden', !n);
    if (!n) { this.card.replaceChildren(); return; }
    const a = ABILITIES[n.needs], line = n.who.length ? '' : ' none';
    this.card.innerHTML = `<div class="need-badge">${abilitySvg(n.needs, 56)}</div><div class="need-text">Needs ${a.name}</div><div class="need-who${line}"></div>`;
    const who = this.card.querySelector('.need-who');
    squad.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = `need-mon${n.who.includes(i) ? ' can' : ''}${i === swapTo ? ' next' : ''}`;
      d.innerHTML = `<img src="${portrait(c.species, 64, 54, false, c.paint)}" width="48" height="40" alt=""><span>${nameOf(c)}</span>`;
      if (n.who.includes(i)) d.insertAdjacentHTML('beforeend', `<i>${abilitySvg(n.needs, 18)}</i>`);
      who.appendChild(d);
    });
  }
  info() { const n = this.cur; return { needAt: n?.place.id ?? null, needs: n?.needs ?? null, needHas: !!n?.has, needWho: n?.who ?? [], needShown: !!n?.shown, needTries: n ? this.game.being?.hints?.tries(n.place.id) ?? 0 : 0, needCard: !!this.card && !this.card.classList.contains('hidden') }; }
  dispose() { this.card?.remove(); this.card = null; super.dispose(); }
}
// Owner 2026-11-14 (a fixed sky ceiling): the cloud layer where wings stop (FLY_CEILING), drawn as flat cotton puffs over all of
// Wobbleland, so a child sees why a flier goes no higher; the crags and the Drip Tower poke up through it. One instanced mesh.
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
class CloudLayer extends Piece {
  constructor(scene) {
    super(scene);
    if (!this.s.world.flyCeiling) return;
    this.puffs = []; this.hidden = new Set();
    const n = 110, per = 4, geo = new THREE.SphereGeometry(1, 12, 8), mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xe8eef6, emissiveIntensity: 0.55 });
    const mesh = new THREE.InstancedMesh(geo, mat, n * per), d = new THREE.Object3D(), y = this.s.world.flyCeiling + 2.6; // (puffy cotton just over where wings stop)
    for (let i = 0; i < n; i++) {
      const h = (a, b) => ((Math.sin(i * a + b) * 43758.5453) % 1 + 1) % 1;
      const cx = h(12.9, 1) * SIZE, cz = h(78.2, 3) * SIZE, big = 2.2 + h(5.7, 2) * 2.4;
      for (let k = 0; k < per; k++) {
        const g = (a) => ((Math.sin(i * 31.7 + k * a) * 9187.13) % 1 + 1) % 1;
        d.position.set(cx + (g(1.3) - 0.5) * big * 2.4, y + g(2.9) * 0.8, cz + (g(4.1) - 0.5) * big * 1.6);
        const r = big * (0.6 + g(5.3) * 0.5);
        d.scale.set(r * 1.3, r * 0.55, r); d.updateMatrix(); mesh.setMatrixAt(i * per + k, d.matrix);
        this.puffs.push({ x: d.position.x, y: d.position.y, z: d.position.z, r: r * 1.3, m: d.matrix.clone() });
      }
    }
    mesh.renderOrder = 2; this.group.add(mesh); this.mesh = mesh;
  }
  // a puff the camera is in or close to is not drawn (the camera behind a flier at the clouds would sit inside one: a grey screen)
  update() {
    const cam = this.game.camera?.position;
    if (!this.mesh || !cam) return;
    let changed = false;
    this.puffs.forEach((q, i) => {
      const near = Math.abs(cam.y - q.y) < q.r + 4 && Math.hypot(cam.x - q.x, cam.z - q.z) < q.r + 6;
      if (near === this.hidden.has(i)) return;
      changed = true;
      if (near) { this.hidden.add(i); this.mesh.setMatrixAt(i, ZERO); } else { this.hidden.delete(i); this.mesh.setMatrixAt(i, q.m); }
    });
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
  info() { return { cloudLayer: this.mesh ? this.mesh.count : 0, cloudsHidden: this.hidden?.size ?? 0 }; }
}

const PIECES = [Puffs, PaintPots, Bugs, Springs, RiverMarks, HillStrings, Skids, NightEyes, Fireflies, WayPlaces, Earthworks, FireIce, SlipPieces, NeedPlaces, CloudLayer];

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
  holds(p) { return this.playing() && p === this.game.player && this.pieces.some(x => x.near?.(p) && x.holds?.(p)); }
  release(p) { return this.pieces.some(x => x.release?.(p)); }
  hit(block) { return this.playing() && this.pieces.some(x => x.hit?.(block)); } // (step D: a tap on a thing you cannot act on says why)
  info() { return Object.assign({}, ...this.pieces.map(x => x.info?.() ?? {})); }
  dispose() {
    for (const x of this.pieces) x.dispose();
    this.scene?.remove(this.group);
  }
}
