// People in the world: gym trainers, gym leaders and the healer.
import * as THREE from 'three';
import { disposeModel } from './species.js';
import { trainersOf, trainerKey } from './gyms.js';
import { Disguise } from './disguise.js';
import { B } from './blocks.js';
import { sound } from './sound.js';

const AWAY = [0, -64, 0]; // where people who are not here yet are parked (T23)

function box(parent, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// A blocky, Minecraft-style person. Faces +Z.
// look: 'alien' (no hair, big black eyes, antennae with glowing tips in the hair colour) or
// 'star' (a little yellow star on top of the head or hat) or 'sport' (a red sweatband, no hat; T36).
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
  if (look === 'sport') { // T36: a red sweatband round the head, with two tails at the back
    box(head, 0.55, 0.08, 0.55, 0xff3b3b, 0, 0.4, 0);
    box(head, 0.06, 0.2, 0.04, 0xff3b3b, -0.06, 0.32, -0.3);
    box(head, 0.06, 0.14, 0.04, 0xff3b3b, 0.06, 0.3, -0.33);
  }
  if (look === 'star') {
    const y = hat ? 0.82 : 0.62;
    box(head, 0.24, 0.08, 0.06, 0xffe94a, 0, y, 0);
    box(head, 0.08, 0.24, 0.06, 0xffe94a, 0, y, 0);
    const d = box(head, 0.12, 0.12, 0.05, 0xfff6a0, 0, y, 0);
    d.rotation.z = Math.PI / 4;
  }
  if (look === 'chef') { // T33: a tall white chef's hat
    box(head, 0.54, 0.12, 0.54, 0xffffff, 0, 0.56, 0);
    box(head, 0.62, 0.34, 0.62, 0xffffff, 0, 0.8, 0);
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
  constructor({ kind, name, gym = null, colors, pos, heading, hat, cape, look, index = 0, def = null }) {
    this.kind = kind;
    this.index = index; // which trainer of the gym (T19: gyms may have two)
    this.def = def; // the person's entry in the gym def (`opens`, `disguise`...)
    this.name = name;
    this.gym = gym;
    this.pos = new THREE.Vector3(...pos);
    this.homeHeading = heading;
    this.heading = heading;
    this.model = buildPerson(colors, { hat, cape, look });
    this.model.userData.npc = this;
    this.t = Math.random() * 10;
    this.disguise = null; // T19: Hidden Hill trainers stand about as a stone pillar until found (NpcManager.disguiseAs)
    this.popT = -1;
    this.away = false; // T23: not here (yet): a home gym's people before they move in (hidden, not pickable)
  }

  get title() {
    if (this.def?.title) return this.def.title; // T33: Restaurant customers
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
    this.onBump = null; // main.js: the player walked into a disguised trainer
  }

  // Dresses a person as a 1x2 block of `block` (T18's Disguise, the same rule as Camo creatures): the person is
  // hidden, the block blinks now and then. Only the disguise is shown; nothing in the world changes.
  disguiseAs(npc, world, block = B.STONE) {
    const d = new Disguise(world, block, { w: 1, h: 2 });
    d.setLight(Math.floor(npc.pos.x), Math.floor(npc.pos.y), Math.floor(npc.pos.z));
    for (const c of npc.model.children) c.visible = false;
    npc.model.add(d.group);
    npc.disguise = d;
    npc.heading = npc.homeHeading = 0;
    npc.model.rotation.y = 0;
  }

  // Pops a disguised person out (0.3 s). Returns true if it was disguised.
  reveal(npc) {
    if (!npc.disguise) return false;
    npc.disguise.dispose();
    npc.disguise = null;
    for (const c of npc.model.children) c.visible = true;
    npc.model.scale.setScalar(0.3);
    npc.popT = 0;
    sound.play('popout');
    return true;
  }

  // Beaten trainers stay revealed: `beaten(key)` says whether a trainer key is in the beaten list.
  undisguise(beaten) {
    for (const n of this.list) {
      if (!n.disguise) continue;
      if (beaten(trainerKey(n.gym.def, n.index || 0))) {
        n.disguise.dispose();
        n.disguise = null;
        for (const c of n.model.children) c.visible = true;
      }
    }
  }

  clear() {
    for (const n of this.list) { n.disguise?.dispose(); this.scene.remove(n.model); disposeModel(n.model); } // a disguise uses the world's shared material: dispose it first
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
    for (const n of this.list) if (n.gym?.def?.night && !n.away) n.model.visible = night;
    for (const s of this.saucers) { s.night = night; if (night) s.group.visible = true; }
  }

  populate(world, spawnPoint) {
    this.clear();
    for (const gym of world.gyms) {
      const [fx, fz] = gym.front;
      const facing = Math.atan2(fx, fz);
      const typeColor = new THREE.Color(gym.def.leader.colors.shirt).getHex();
      const { leader } = gym.def;
      const none = !gym.leaderPos; // T23: a gym with no building yet; its people are away until placeAt
      this.add(new Npc({
        kind: 'leader', name: leader.name, gym, colors: leader.colors,
        pos: gym.leaderPos || AWAY, heading: gym.leaderHeading ?? facing, cape: typeColor, look: leader.look, def: leader,
      }));
      const leaderNpc = this.list[this.list.length - 1];
      if (none) this.sendAway(leaderNpc);
      const spots = gym.trainerPositions || [gym.trainerPos];
      trainersOf(gym.def).forEach((trainer, i) => {
        const npc = new Npc({
          kind: 'trainer', name: trainer.name, gym, colors: trainer.colors, look: trainer.look,
          pos: spots[i] || AWAY, heading: gym.trainerHeadings?.[i] ?? facing, hat: ['alien', 'chef', 'sport'].includes(trainer.look) ? null : trainer.colors.pants, index: i, def: trainer,
        });
        this.add(npc);
        if (none) this.sendAway(npc);
        if (trainer.disguise === 'stone') this.disguiseAs(npc, world, B.STONE);
      });
      // T33: a gym may list more people (the Restaurant's customers: kind 'guest', one line each).
      for (const p of gym.people || []) this.add(new Npc({ kind: p.kind, name: p.name, gym, colors: p.colors, pos: p.pos, heading: p.heading ?? facing, hat: p.hat, look: p.look, def: p }));
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
    if (world.realm) return; // T31: no healer in a realm (losing there wakes you up, rested)
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

  // T23: puts a person (usually one that was away) at [x, y, z] facing `heading`.
  placeAt(npc, [x, y, z], heading = npc.homeHeading) {
    npc.pos.set(x, y, z);
    npc.model.position.copy(npc.pos);
    npc.homeHeading = npc.heading = heading;
    npc.model.rotation.y = heading;
    npc.away = false;
    npc.model.visible = !(npc.gym?.def?.night && this.night !== true);
  }

  // T23: takes a person away (hidden, not pickable, does not move).
  sendAway(npc) {
    npc.away = true;
    npc.model.visible = false;
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
      if (n.away) continue;
      n.t += dt;
      if (n.disguise) { // a stone pillar: it only blinks, and walking into it finds it
        n.disguise.update(dt, playerPos);
        const dy = playerPos.y - n.pos.y;
        if (this.onBump && Math.abs(playerPos.x - n.pos.x) < 0.9 && Math.abs(playerPos.z - n.pos.z) < 0.9 && dy >= -0.1 && dy < 3) this.onBump(n);
        continue;
      }
      if (n.popT >= 0) { // the little pop when a person jumps out of a disguise
        n.popT += dt;
        const k = Math.min(1, n.popT / 0.3);
        n.model.scale.setScalar(k < 0.6 ? 0.3 + 0.8 * (k / 0.6) : 1.1 - 0.1 * ((k - 0.6) / 0.4));
        if (k >= 1) { n.popT = -1; n.model.scale.setScalar(1); }
      }
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
    const hits = this.raycaster.intersectObjects(this.list.filter(n => !n.away && n.model.visible && n.pos.distanceToSquared(origin) < reach * reach).map(n => n.model), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.npc) o = o.parent;
    return o ? { npc: o.userData.npc, dist: hits[0].distance } : null;
  }
}
