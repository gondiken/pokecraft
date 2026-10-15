// People in the world: gym trainers, gym leaders and the healer.
import * as THREE from 'three';
import { disposeModel } from './species.js';

function box(parent, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// A blocky, Minecraft-style person. Faces +Z.
// look: 'alien' (no hair, big black eyes, antennae with glowing tips in the hair colour) or
// 'star' (a little yellow star on top of the head or hat).
export function buildPerson(c, { cape = null, hat = null, look = null } = {}) {
  const group = new THREE.Group();
  const parts = { legs: [], arms: [] };
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.13, 0.75, 0);
    box(leg, 0.25, 0.75, 0.25, c.pants, 0, -0.375, 0);
    box(leg, 0.26, 0.1, 0.28, 0x2a2a2a, 0, -0.7, 0.01);
    group.add(leg);
    parts.legs.push({ g: leg, phase });
  }
  box(group, 0.52, 0.72, 0.28, c.shirt, 0, 1.11, 0);
  box(group, 0.53, 0.08, 0.29, 0x2a2a2a, 0, 0.8, 0);
  for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.38, 1.44, 0);
    box(arm, 0.22, 0.5, 0.24, c.shirt, 0, -0.22, 0);
    box(arm, 0.2, 0.22, 0.22, c.skin, 0, -0.57, 0);
    group.add(arm);
    parts.arms.push({ g: arm, phase });
  }
  const head = new THREE.Group();
  head.position.set(0, 1.47, 0);
  box(head, 0.5, 0.5, 0.5, c.skin, 0, 0.25, 0);
  if (look === 'alien') {
    for (const s of [-1, 1]) {
      box(head, 0.16, 0.18, 0.02, 0x101018, s * 0.12, 0.28, 0.255);
      box(head, 0.05, 0.05, 0.02, 0xffffff, s * 0.09, 0.32, 0.262);
      const stalk = box(head, 0.04, 0.3, 0.04, c.skin, s * 0.13, 0.62, 0);
      stalk.rotation.z = -s * 0.25;
      box(head, 0.1, 0.1, 0.1, c.hair, s * 0.18, 0.78, 0);
    }
    box(head, 0.12, 0.03, 0.02, 0x2a5a2a, 0, 0.11, 0.255);
  } else {
    box(head, 0.52, 0.14, 0.52, c.hair, 0, 0.46, 0);
    box(head, 0.52, 0.35, 0.12, c.hair, 0, 0.3, -0.21);
    for (const s of [-1, 1]) {
      box(head, 0.1, 0.06, 0.02, 0xffffff, s * 0.12, 0.28, 0.255);
      box(head, 0.05, 0.06, 0.02, 0x2a2a6a, s * 0.1, 0.28, 0.262);
    }
    box(head, 0.16, 0.04, 0.02, 0x8a4a3a, 0, 0.14, 0.255);
  }
  if (look === 'star') {
    const y = hat ? 0.82 : 0.62;
    box(head, 0.24, 0.08, 0.06, 0xffe94a, 0, y, 0);
    box(head, 0.08, 0.24, 0.06, 0xffe94a, 0, y, 0);
    const d = box(head, 0.12, 0.12, 0.05, 0xfff6a0, 0, y, 0);
    d.rotation.z = Math.PI / 4;
  }
  if (hat) {
    box(head, 0.58, 0.08, 0.62, hat, 0, 0.54, 0.03);
    box(head, 0.5, 0.16, 0.5, hat, 0, 0.64, 0);
  }
  group.add(head);
  parts.head = head;
  if (cape) {
    const c2 = box(group, 0.5, 0.95, 0.04, cape, 0, 1.0, -0.17);
    c2.rotation.x = 0.08;
  }
  group.userData.parts = parts;
  return group;
}

class Npc {
  constructor({ kind, name, gym = null, colors, pos, heading, hat, cape, look }) {
    this.kind = kind;
    this.name = name;
    this.gym = gym;
    this.pos = new THREE.Vector3(...pos);
    this.homeHeading = heading;
    this.heading = heading;
    this.model = buildPerson(colors, { hat, cape, look });
    this.model.userData.npc = this;
    this.t = Math.random() * 10;
  }

  get title() {
    if (this.kind === 'healer') return `${this.name} · heals your team`;
    return `${this.name} (${this.gym.def.name})`;
  }
}

export class NpcManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.saucers = [];
    this.night = null;
    this.raycaster = new THREE.Raycaster();
  }

  clear() {
    for (const n of this.list) { this.scene.remove(n.model); disposeModel(n.model); }
    this.list = [];
    for (const s of this.saucers) { this.scene.remove(s.group); disposeModel(s.group); }
    this.saucers = [];
    this.night = null;
  }

  // Gyms with `night: true` (Comet, Saucer) only have their people at night; `saucer: true` also
  // brings a flying saucer.
  setNight(night) {
    night = !!night;
    if (night === this.night) return;
    this.night = night;
    for (const n of this.list) if (n.gym?.def?.night) n.model.visible = night;
    for (const s of this.saucers) { s.night = night; if (night) s.group.visible = true; }
  }

  populate(world, spawnPoint) {
    this.clear();
    for (const gym of world.gyms) {
      const [fx, fz] = gym.front;
      const facing = Math.atan2(fx, fz);
      const typeColor = new THREE.Color(gym.def.leader.colors.shirt).getHex();
      const { leader, trainer } = gym.def;
      this.add(new Npc({
        kind: 'leader', name: leader.name, gym, colors: leader.colors,
        pos: gym.leaderPos, heading: facing, cape: typeColor, look: leader.look,
      }));
      this.add(new Npc({
        kind: 'trainer', name: trainer.name, gym, colors: trainer.colors, look: trainer.look,
        pos: gym.trainerPos, heading: facing, hat: trainer.look === 'alien' ? null : trainer.colors.pants,
      }));
      if (gym.def.saucer) this.addSaucer(gym);
    }
    // The Champion's Tower: nurse, coach, two guards and the champion.
    if (world.tower) {
      const [fx, fz] = world.tower.front;
      for (const p of world.tower.people) {
        const npc = new Npc({
          kind: p.kind || 'tower', name: p.name, gym: p.kind ? null : world.tower, colors: p.colors,
          pos: p.pos, heading: Math.atan2(fx, fz), hat: p.hat, cape: p.cape,
        });
        npc.role = p.role;
        this.add(npc);
      }
    }
    // The healer waits next to where you start.
    const hx = Math.floor(spawnPoint.x) + 3, hz = Math.floor(spawnPoint.z);
    const s = world.surface(hx, hz);
    this.add(new Npc({
      kind: 'healer', name: 'Healer Hana',
      colors: { shirt: 0xf6a8c8, pants: 0xffffff, hair: 0xe0607a, skin: 0xf2d0b0 },
      pos: [hx + 0.5, s.y + 1, hz + 0.5], heading: -Math.PI / 2, hat: 0xffffff,
    }));
  }

  // A flying saucer (a few Three.js meshes, not blocks) that hovers above a night gym.
  addSaucer(gym) {
    const group = new THREE.Group();
    const green = new THREE.MeshLambertMaterial({ color: 0x4acb7a });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a8a55 });
    const glass = new THREE.MeshLambertMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.65 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffe94a });
    const beam = new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.16, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 20), green);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.18, 20), dark);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    dome.position.y = 0.25;
    const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), glow, 8);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m.makeTranslation(Math.cos(a) * 2.7, -0.2, Math.sin(a) * 2.7);
      lights.setMatrixAt(i, m);
    }
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.6, 1, 14, 1, true), beam);
    group.add(disc, rim, dome, lights, cone);
    const base = new THREE.Vector3(gym.x + 0.5, gym.y + 14, gym.z + 0.5);
    group.position.set(base.x, base.y + 40, base.z);
    group.visible = false;
    this.scene.add(group);
    this.saucers.push({ group, cone, base, rise: 40, night: false, t: Math.random() * 6 });
  }

  add(npc) {
    if (npc.gym?.def?.night && this.night !== true) npc.model.visible = false;
    npc.model.position.copy(npc.pos);
    npc.model.rotation.y = npc.heading;
    this.scene.add(npc.model);
    this.list.push(npc);
  }

  update(dt, playerPos) {
    for (const s of this.saucers) {
      s.t += dt;
      // Glide down in about 4 seconds at night, rise again at dawn.
      s.rise = Math.max(0, Math.min(40, s.rise + (s.night ? -10 : 10) * dt));
      s.group.visible = s.rise < 40;
      s.group.position.set(s.base.x, s.base.y + s.rise + Math.sin(s.t * 0.8) * 0.4, s.base.z);
      s.group.rotation.y += dt * 0.4;
      // The beam reaches down to the gym door level.
      const h = Math.max(1, s.rise + 12);
      s.cone.scale.y = h; s.cone.position.y = -h / 2;
      s.cone.visible = s.rise < 1;
    }
    for (const n of this.list) {
      n.t += dt;
      const p = n.model.userData.parts;
      const near = n.pos.distanceTo(playerPos) < 7;
      // Turn to face the player when they come close.
      const want = near ? Math.atan2(playerPos.x - n.pos.x, playerPos.z - n.pos.z) : n.homeHeading;
      let d = want - n.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      n.heading += d * Math.min(1, dt * 4);
      n.model.rotation.y = n.heading;
      for (const a of p.arms) a.g.rotation.x = Math.sin(n.t * 1.6 + a.phase) * 0.06;
      p.head.rotation.x = Math.sin(n.t * 0.9) * 0.04;
    }
  }

  pick(origin, dir, maxDist) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    // Only people within reach (plus their body size) are worth testing.
    const reach = maxDist + 3;
    const hits = this.raycaster.intersectObjects(this.list.filter(n => n.model.visible && n.pos.distanceToSquared(origin) < reach * reach).map(n => n.model), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.npc) o = o.parent;
    return o ? { npc: o.userData.npc, dist: hits[0].distance } : null;
  }
}
