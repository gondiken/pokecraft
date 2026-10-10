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
export function buildPerson(c, { cape = null, hat = null } = {}) {
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
  box(head, 0.52, 0.14, 0.52, c.hair, 0, 0.46, 0);
  box(head, 0.52, 0.35, 0.12, c.hair, 0, 0.3, -0.21);
  for (const s of [-1, 1]) {
    box(head, 0.1, 0.06, 0.02, 0xffffff, s * 0.12, 0.28, 0.255);
    box(head, 0.05, 0.06, 0.02, 0x2a2a6a, s * 0.1, 0.28, 0.262);
  }
  box(head, 0.16, 0.04, 0.02, 0x8a4a3a, 0, 0.14, 0.255);
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

export class Npc {
  constructor({ kind, name, gym = null, colors, pos, heading, hat, cape }) {
    this.kind = kind;
    this.name = name;
    this.gym = gym;
    this.pos = new THREE.Vector3(...pos);
    this.homeHeading = heading;
    this.heading = heading;
    this.model = buildPerson(colors, { hat, cape });
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
    this.raycaster = new THREE.Raycaster();
  }

  clear() {
    for (const n of this.list) { this.scene.remove(n.model); disposeModel(n.model); }
    this.list = [];
  }

  populate(world, spawnPoint) {
    this.clear();
    for (const gym of world.gyms) {
      const [fx, fz] = gym.front;
      const facing = Math.atan2(fx, fz);
      const typeColor = new THREE.Color(gym.def.leader.colors.shirt).getHex();
      this.add(new Npc({
        kind: 'leader', name: gym.def.leader.name, gym, colors: gym.def.leader.colors,
        pos: gym.leaderPos, heading: facing, cape: typeColor,
      }));
      this.add(new Npc({
        kind: 'trainer', name: gym.def.trainer.name, gym, colors: gym.def.trainer.colors,
        pos: gym.trainerPos, heading: facing, hat: gym.def.trainer.colors.pants,
      }));
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

  add(npc) {
    npc.model.position.copy(npc.pos);
    npc.model.rotation.y = npc.heading;
    this.scene.add(npc.model);
    this.list.push(npc);
  }

  update(dt, playerPos) {
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
    const hits = this.raycaster.intersectObjects(this.list.map(n => n.model), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.npc) o = o.parent;
    return o ? { npc: o.userData.npc, dist: hits[0].distance } : null;
  }
}
