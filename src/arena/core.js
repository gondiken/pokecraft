// Chapter 3 test arena (owner 2026-11-09): the shared parts of the three battle prototypes (live action, draw the move,
// flick and bounce). A separate page (arena.html); nothing here is used by the game or touches a save.
// Units are blocks; the arena is a round floor of radius R with three stone pillars.
import * as THREE from 'three';
import { SPECIES, MOVES, TYPE_COLORS, statsFor, effectiveness, makeCreature, buildModel, animateModel } from '../species.js';

export const R = 11; // the arena floor's radius
export const PILLARS = [{ x: -4.5, z: 1.5, r: 1.0 }, { x: 4.5, z: 1.5, r: 1.0 }, { x: 0, z: -4.5, r: 1.0 }];
export const STEP = 1 / 120; // every prototype runs in fixed steps: the same at 60 and 20 fps

// ---------------------------------------------------------------- creatures and moves

export const typeHex = t => parseInt((TYPE_COLORS[t] || '#cccccc').match(/#([0-9a-f]{6})/i)?.[1] ?? 'cccccc', 16);
export const typeCss = t => `#${typeHex(t).toString(16).padStart(6, '0')}`;
export const typeName = t => t[0].toUpperCase() + t.slice(1);

// What a battle move becomes out in the arena, from its own data (never by hand per move):
// bolt (a shot), volley (many small shots), burst (a big blast, held to charge), dash (a rush), heal, buff, cloud (slows), sleep.
export function shapeOf(id) {
  const m = MOVES[id];
  if (!m) return null;
  const k = m.fx?.kind;
  let kind;
  if (!m.power) {
    if (k === 'heal') kind = 'heal';
    else if (k === 'sleep') kind = 'sleep';
    else if (k === 'lower' || k === 'curse') kind = 'cloud';
    else kind = 'buff'; // raise, rally, shield, field, anything else
  } else if (k === 'multi') kind = 'volley';
  else if (m.priority || k === 'recoil') kind = 'dash';
  else if (m.power >= 80 || k === 'risky' || k === 'sacrifice' || k === 'lastword') kind = 'burst';
  else if (k === 'sleep') kind = 'sleep';
  else kind = 'bolt';
  const power = m.power || 0;
  return { id, kind, power, type: m.type, name: m.name, recoil: k === 'recoil', stat: m.fx?.stat };
}
export const KIND_WORD = { bolt: 'shot', volley: 'many shots', burst: 'big blast', dash: 'rush', heal: 'heal', buff: 'power up', cloud: 'slow cloud', sleep: 'sleepy cloud' };

// The damage sum of battle.js (no crit, no roll): level, attack / defence, same-type bonus, the type chart.
export function damage(atk, def, power, type, mult = 1) {
  const as = statsFor(atk), ds = statsFor(def);
  const eff = effectiveness(type, SPECIES[def.species].type);
  const stab = type === SPECIES[atk.species].type ? 1.5 : 1;
  const base = Math.floor((((2 * atk.level) / 5 + 2) * power * as.atk * (atk.atkUp || 1) / (ds.def * (def.defUp || 1))) / 50) + 2;
  return { amount: Math.max(1, Math.floor(base * stab * eff * mult)), eff };
}

// Your team from this browser's own save (read only, never written); a ready-made team if there is none.
export function loadTeam() {
  let party = [];
  try { party = JSON.parse(localStorage.getItem('pokecraft-save-v2') || '{}').party || []; } catch { party = []; }
  const team = party.filter(c => c && SPECIES[c.species] && Array.isArray(c.moves) && c.moves.some(m => MOVES[m]))
    .map(c => ({ species: c.species, level: Math.max(5, Math.min(100, c.level | 0)), moves: c.moves.filter(m => MOVES[m]).slice(0, 4), paint: c.paint, own: true }));
  if (team.length) return team;
  return [['blazehound', 30], ['tidalord', 30], ['thunderwolf', 30], ['phantomaw', 30]].map(([s, l]) => {
    const c = makeCreature(s, l);
    return { species: s, level: l, moves: c.moves, own: false };
  });
}

// The same three monsters in every prototype (more for the "lots of monsters" test). pattern = how it attacks.
export const FOES = [
  { species: 'thornox', pattern: 'charge' }, { species: 'cragtusk', pattern: 'stomp' }, { species: 'phantomaw', pattern: 'lob' },
  { species: 'glacieron', pattern: 'charge' }, { species: 'gloopor', pattern: 'lob' }, { species: 'mechanox', pattern: 'stomp' },
  { species: 'voltwing', pattern: 'lob' }, { species: 'boomwing', pattern: 'charge' },
];
export const FOE_POWER = 50; // the power of a monster's attack (a mid battle move of its own type)
export const START_SPOTS = [[0, 6.5], [-6.5, -3], [6.5, -3], [-8, 5], [8, 5], [-3, -8.5], [3, -8.5], [0, 9.5]];

// ---------------------------------------------------------------- geometry

export const len2 = (x, z) => Math.hypot(x, z);
// Keep a circle (x, z, r) on the floor and out of the pillars; returns the wall it touched (for bounces) or null.
export function pushOut(e, r = e.r) {
  let hit = null;
  const d = len2(e.x, e.z), lim = R - 0.2 - r;
  if (d > lim) { e.x *= lim / d; e.z *= lim / d; hit = { nx: -e.x / lim, nz: -e.z / lim }; }
  for (const p of PILLARS) {
    const dx = e.x - p.x, dz = e.z - p.z, dd = len2(dx, dz), min = p.r + r;
    if (dd < min && dd > 1e-6) { e.x = p.x + dx / dd * min; e.z = p.z + dz / dd * min; hit = { nx: dx / dd, nz: dz / dd }; }
  }
  return hit;
}
export const inPillar = (x, z, pad = 0) => PILLARS.some(p => len2(x - p.x, z - p.z) < p.r + pad);
export const onFloor = (x, z, pad = 0) => len2(x, z) < R - 0.2 - pad;
// Does the segment a -> b pass through a pillar? (a shot or a line attack is blocked by it)
export function segBlocked(ax, az, bx, bz, pad = 0) {
  for (const p of PILLARS) if (segDist(p.x, p.z, ax, az, bx, bz) < p.r + pad) return true;
  return false;
}
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return len2(px - ax - dx * t, pz - az - dz * t);
}

// Monster attacks, shown first as a red warning on the ground (a "tell"). One shape list for all three prototypes.
//   line: from the monster through where you are; circle: where you stand now; ring: all round the monster.
export function intentFor(foe, you, opts = {}) {
  const dx = you.x - foe.x, dz = you.z - foe.z, d = len2(dx, dz) || 1;
  const p = foe.pattern;
  if (p === 'charge') {
    const L = opts.lineLen ?? 9;
    return { kind: 'line', x: foe.x, z: foe.z, dx: dx / d, dz: dz / d, len: L, w: 1.5 };
  }
  if (p === 'stomp' && (opts.stompAlways || d < (opts.stompReach ?? 5.5))) return { kind: 'ring', x: foe.x, z: foe.z, r: opts.stompR ?? 3.4 };
  return { kind: 'circle', x: you.x, z: you.z, r: opts.lobR ?? 2.0 };
}
// Is a point inside an attack? (a line stops at a pillar: hide behind one)
export function inIntent(t, x, z, r = 0) {
  if (t.kind === 'circle' || t.kind === 'ring') return len2(x - t.x, z - t.z) < t.r + r * 0.5;
  const ex = t.x + t.dx * t.len, ez = t.z + t.dz * t.len;
  const along = (x - t.x) * t.dx + (z - t.z) * t.dz;
  if (along < -0.5 || along > t.len + 0.5) return false;
  if (segDist(x, z, t.x, t.z, ex, ez) > t.w / 2 + r * 0.5) return false;
  const px = t.x + t.dx * along, pz = t.z + t.dz * along;
  return !segBlocked(t.x, t.z, px, pz, -0.15);
}

// ---------------------------------------------------------------- the scene

// The arena's places (the Live twists, owner 2026-11-09): the same floor and pillars, other colours and rules.
//   slide: how fast speed eases on ice (none = you stop at once); dark: you only see inside your own light.
export const PLACES = {
  meadow: { name: 'Meadow', icon: '🌿', floor: [0x7fc35a, 0x74b852], wall: [0x9a9a9a, 0x858585], sky: 0x9fd4ff, light: 1 },
  cave: { name: 'Dark Cave', icon: '🕯️', floor: [0x55505e, 0x4b4754], wall: [0x5d5866, 0x4f4a58], sky: 0x07070c, light: 0.025, dark: true,
    hint: 'A dark cave! You only see near you. Fire, Light, Electric and Cosmic creatures see further.' },
  ice: { name: 'Ice Lake', icon: '🧊', floor: [0xc9ecf8, 0xb3e0f2], wall: [0xe9f6fb, 0xd2ebf4], sky: 0xbfe3f7, light: 1.05, slide: 1.6, attack: 0.6,
    hint: 'Ice! You slide, and so do the monsters. Stop early!' },
};
export const SEE = { near: 4.6, far: 7.5, bright: ['fire', 'light', 'electric', 'cosmic'] }; // how far you see in the dark

export function buildArena(scene) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const cells = [];
  for (let x = -R - 2; x <= R + 2; x++) for (let z = -R - 2; z <= R + 2; z++) {
    const d = Math.hypot(x, z);
    if (d <= R + 0.3) cells.push([x, -0.5, z, 'floor', (x + z) & 1]);
    else if (d <= R + 1.6) { cells.push([x, -0.5, z, 'wall', 0]); cells.push([x, 0.5, z, 'wall', (x * 7 + z * 3) % 3 ? 0 : 1]); }
  }
  for (const p of PILLARS) for (let y = 0; y < 2; y++) for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) cells.push([p.x + ox, y + 0.5, p.z + oz, 'pillar', y]);
  const mat = new THREE.MeshLambertMaterial();
  const inst = new THREE.InstancedMesh(geo, mat, cells.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  cells.forEach(([x, y, z], i) => { m.makeTranslation(x, y, z); inst.setMatrixAt(i, m); });
  g.add(inst);
  scene.add(g);
  const hemi = new THREE.HemisphereLight(0xdff2ff, 0x5d6b4a, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(6, 14, 8);
  scene.add(hemi, sun);
  return {
    hemi, sun,
    paint(place) { // the place's colours and light
      const P = PLACES[place];
      cells.forEach(([, , , kind, k], i) => inst.setColorAt(i, c.setHex(kind === 'floor' ? P.floor[k] : kind === 'wall' ? P.wall[k] : (k ? 0x9da3a8 : 0x8a9096))));
      inst.instanceColor.needsUpdate = true;
      scene.background = new THREE.Color(P.sky);
      hemi.intensity = 1.1 * P.light; sun.intensity = 1.2 * P.light;
    },
  };
}

const shadowGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });

// A creature in the arena: its model, place, HP and timers. side 'you' | 'foe'.
export class Fighter {
  constructor(scene, c, side, x, z) {
    this.c = { species: c.species, level: c.level, moves: c.moves };
    this.side = side; this.x = x; this.z = z; this.heading = 0;
    this.pattern = c.pattern;
    this.maxHp = statsFor(this.c).maxHp; this.hp = this.maxHp;
    this.model = buildModel(c.species, c.paint);
    const box = new THREE.Box3().setFromObject(this.model), size = box.getSize(new THREE.Vector3());
    const want = side === 'you' ? 1.5 : 1.7; // big enough to read on a tablet
    const k = want / Math.max(0.6, Math.max(size.x, size.z, size.y * 0.8));
    this.model.scale.multiplyScalar(k);
    this.r = 0.75; this.h = size.y * k;
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.scale.setScalar(this.r * 1.1);
    scene.add(this.model, this.shadow);
    this.t = Math.random() * 10; this.moving = false; this.flash = 0; this.lift = 0;
    this.slowT = 0; this.sleepT = 0; this.buffT = 0; this.guardT = 0; this.safeT = 0;
    this.bar = document.createElement('div');
    this.bar.className = `hpbar ${side}`;
    this.bar.innerHTML = `<i></i>${side === 'foe' ? `<b>${SPECIES[c.species].name}</b>` : ''}`;
    document.getElementById('bars').append(this.bar);
  }
  get alive() { return this.hp > 0; }
  get type() { return SPECIES[this.c.species].type; }
  draw(dt, camera, W, H) {
    this.t += dt;
    this.model.position.set(this.x, this.lift, this.z);
    this.model.rotation.y = this.heading;
    animateModel(this.model, this.t, this.moving);
    this.shadow.position.set(this.x, 0.02, this.z);
    this.model.visible = this.shadow.visible = this.alive || this.flash > 0;
    if (this.flash > 0) {
      this.flash -= dt;
      this.model.visible = this.alive ? Math.floor(this.flash * 20) % 2 === 0 : this.flash > 0;
      if (!this.alive) this.model.scale.multiplyScalar(0.92);
    }
    this.c.atkUp = this.buffT > 0 || this.buffTurns > 0 ? 1.5 : 1;
    this.c.defUp = this.guardT > 0 ? 1.6 : 1;
    const v = new THREE.Vector3(this.x, this.h + 0.5 + this.lift, this.z).project(camera);
    const show = this.alive && v.z < 1;
    this.bar.style.display = show ? '' : 'none';
    if (show) {
      this.bar.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
      this.bar.firstChild.style.width = `${Math.max(0, this.hp / this.maxHp) * 100}%`;
      this.bar.classList.toggle('low', this.hp < this.maxHp * 0.3);
      this.bar.classList.toggle('zzz', this.sleepT > 0);
      this.bar.classList.toggle('slow', this.slowT > 0 && this.sleepT <= 0);
    }
  }
  dispose(scene) {
    scene.remove(this.model, this.shadow);
    this.bar.remove();
  }
}

// ---------------------------------------------------------------- effects (a small pool; nothing here changes the battle)

const glowGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const ringGeo = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
const planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);

export class Fx {
  constructor(scene) { this.scene = scene; this.list = []; this.tells = []; this.pool = []; }
  mesh(geo, color, opacity) {
    let m = this.pool.find(p => p.geometry === geo && !p.parent);
    if (!m) { m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); this.pool.push(m); }
    m.material.color.setHex(color); m.material.opacity = opacity;
    m.rotation.set(0, 0, 0); m.scale.setScalar(1);
    this.scene.add(m);
    return m;
  }
  // A shot: a glowing cube in the move's type colour.
  shot(type, x, z) { const m = this.mesh(glowGeo, typeHex(type), 1); m.position.set(x, 0.8, z); return m; }
  free(m) { if (m) this.scene.remove(m); }
  // A blast or cloud that grows and fades by itself.
  burst(type, x, z, r, time = 0.45, opacity = 0.55) {
    const m = this.mesh(discGeo, typeHex(type), opacity);
    m.position.set(x, 0.06, z);
    this.list.push({ m, t: 0, time, r, kind: 'grow', o: opacity });
  }
  cloud(type, x, z, r, time) {
    const m = this.mesh(discGeo, typeHex(type), 0.35);
    m.position.set(x, 0.05, z); m.scale.setScalar(r);
    const e = { m, t: 0, time, r, kind: 'cloud', x, z };
    this.list.push(e);
    return e;
  }
  // A red warning on the ground; returns it so its owner can remove it when the attack lands.
  tell(t) {
    const col = 0xff3b3b;
    const parts = [];
    if (t.kind === 'line') {
      const m = this.mesh(planeGeo, col, 0.38);
      m.position.set(t.x, 0.05, t.z); m.rotation.y = Math.atan2(t.dx, t.dz);
      m.scale.set(t.w, 1, t.len);
      parts.push(m);
    } else {
      const m = this.mesh(discGeo, col, 0.3); m.position.set(t.x, 0.05, t.z); m.scale.setScalar(t.r); parts.push(m);
      const e = this.mesh(ringGeo, col, 0.8); e.position.set(t.x, 0.07, t.z); e.scale.setScalar(t.r); parts.push(e);
    }
    const w = { t, parts, age: 0 };
    this.tells.push(w);
    return w;
  }
  untell(w) { for (const m of w.parts) this.scene.remove(m); this.tells = this.tells.filter(x => x !== w); }
  clear() { for (const e of this.list) this.scene.remove(e.m); this.list = []; for (const w of [...this.tells]) this.untell(w); }
  update(dt) {
    for (const e of this.list) {
      e.t += dt;
      const k = Math.min(1, e.t / e.time);
      if (e.kind === 'grow') { e.m.scale.setScalar(e.r * (0.3 + 0.7 * k)); e.m.material.opacity = e.o * (1 - k); }
      else e.m.material.opacity = 0.35 * Math.min(1, (e.time - e.t) * 2);
    }
    this.list = this.list.filter(e => { if (e.t < e.time) return true; this.scene.remove(e.m); return false; });
    for (const w of this.tells) { // the warning pulses faster as the hit comes
      w.age += dt;
      const p = 0.55 + 0.45 * Math.sin(w.age * (8 + w.age * 10));
      for (const m of w.parts) m.material.opacity = (m.geometry === ringGeo ? 0.85 : 0.32) * (0.6 + 0.4 * p);
    }
  }
}

// Floating words over a creature: "-23", "Super!", "Healed!".
export function floatText(camera, x, y, z, text, cls = '') {
  const v = new THREE.Vector3(x, y, z).project(camera);
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  document.getElementById('bars').append(el);
  setTimeout(() => el.remove(), 900);
}
export const maxHpOf = c => statsFor(c).maxHp;
