// People in the world: gym trainers, gym leaders and the healer.
import * as THREE from 'three';
import { disposeModel, buildModel, animateModel } from './species.js';
import { trainersOf, trainerKey } from './gyms.js';
import { Disguise } from './disguise.js';
import { B } from './blocks.js';
import { sound } from './sound.js';
import { bossOf } from './pictureboss.js'; // T40
import { sketchModel } from './sketch.js'; // T45

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
  } else if (look === 'mouse') { // T40a: Nibbles, the Wizard's Mouse: two big round ears, shiny eyes, a pink nose, whiskers, a thin tail (no hair, no hat)
    for (const s of [-1, 1]) {
      box(head, 0.3, 0.3, 0.08, c.hair, s * 0.2, 0.62, -0.02);
      box(head, 0.2, 0.2, 0.05, 0xf2a6c0, s * 0.2, 0.62, 0.02);
      box(head, 0.14, 0.17, 0.02, 0x14101a, s * 0.12, 0.3, 0.255);
      box(head, 0.05, 0.05, 0.02, 0xffffff, s * 0.09, 0.35, 0.265);
      for (let k = -1; k <= 1; k++) { const w = box(head, 0.22, 0.012, 0.012, 0xffffff, s * 0.27, 0.15 + k * 0.04, 0.2); w.rotation.z = s * k * 0.2; }
    }
    box(head, 0.1, 0.08, 0.05, 0xf08aa0, 0, 0.17, 0.27);
    box(head, 0.12, 0.03, 0.02, 0x4a3a3a, 0, 0.08, 0.255);
    const tail = box(group, 0.06, 0.06, 0.7, c.skin, 0, 0.7, -0.5);
    tail.rotation.x = 0.35;
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
  if (look === 'ninja') { // T37b: a dark mask over the nose and mouth and a red headband with two tails at the back
    box(head, 0.54, 0.2, 0.54, 0x24202e, 0, 0.11, 0);
    box(head, 0.55, 0.07, 0.55, 0xc0303a, 0, 0.4, 0);
    box(head, 0.06, 0.22, 0.04, 0xc0303a, -0.06, 0.3, -0.3);
    box(head, 0.06, 0.16, 0.04, 0xc0303a, 0.06, 0.28, -0.33);
  }
  if (look === 'helmet') { // T40c: a round racing helmet in the shirt colour, a light visor over the eyes, a white stripe over the top
    box(head, 0.6, 0.36, 0.6, c.shirt, 0, 0.4, 0);
    box(head, 0.5, 0.1, 0.5, c.shirt, 0, 0.62, 0);
    box(head, 0.5, 0.17, 0.04, 0x7ac8ff, 0, 0.29, 0.31);
    box(head, 0.5, 0.03, 0.05, 0x2a2a34, 0, 0.39, 0.31);
    box(head, 0.12, 0.03, 0.62, 0xffffff, 0, 0.68, 0);
    box(head, 0.12, 0.4, 0.03, 0xffffff, 0, 0.45, -0.31);
  }
  if (look === 'pirate') { // T40b: a red-and-cream striped bandana with a knot at the back, and a black eye patch on one eye
    box(head, 0.55, 0.14, 0.55, 0xe03a3a, 0, 0.46, 0);
    for (const x of [-0.18, 0, 0.18]) box(head, 0.06, 0.15, 0.56, 0xf6efe0, x, 0.46, 0);
    box(head, 0.1, 0.1, 0.06, 0xe03a3a, 0, 0.42, -0.3);
    box(head, 0.06, 0.2, 0.04, 0xf6efe0, -0.06, 0.3, -0.33);
    box(head, 0.06, 0.14, 0.04, 0xe03a3a, 0.06, 0.28, -0.34);
    box(head, 0.54, 0.025, 0.54, 0x1a1a1a, 0, 0.35, 0); // the eye patch's strap
    box(head, 0.14, 0.13, 0.03, 0x1a1a1a, -0.11, 0.28, 0.268);
  }
  if (look === 'swirl') { // T42: a teal-and-orange swirl badge on the chest and a violet headband (the Portal keepers)
    box(head, 0.55, 0.08, 0.55, 0x9a6aff, 0, 0.4, 0);
    box(head, 0.1, 0.1, 0.04, 0xff9a3a, 0, 0.4, 0.29);
    const sw = [[0, 0, 0xff9a3a], [0.07, 0.03, 0x5ae8e0], [0.03, 0.1, 0x9a6aff], [-0.07, 0.07, 0x5ae8e0], [-0.09, -0.03, 0x9a6aff]];
    for (const [x, y, c] of sw) box(group, 0.07, 0.07, 0.03, c, 0.1 + x, 1.2 + y, 0.155);
  }
  if (look === 'fair') { // T43: Merry Mae's red-and-white striped straw boater (a flat brim, a stripy crown, a red band) with a pink flower
    box(head, 0.7, 0.05, 0.7, 0xf2dc9a, 0, 0.5, 0);
    for (const x of [-0.18, 0, 0.18]) box(head, 0.09, 0.2, 0.46, x === 0 ? 0xf6efe0 : 0xe03a4a, x, 0.62, 0);
    box(head, 0.48, 0.2, 0.09, 0xe03a4a, 0, 0.62, 0.18);
    box(head, 0.48, 0.2, 0.09, 0xf6efe0, 0, 0.62, -0.18);
    box(head, 0.5, 0.05, 0.5, 0xe03a4a, 0, 0.55, 0);
    box(head, 0.12, 0.12, 0.05, 0xff7ac0, 0.2, 0.58, 0.27);
    box(head, 0.05, 0.05, 0.06, 0xffe94a, 0.2, 0.58, 0.28);
  }
  if (look === 'party') { // T44: a cone party hat (three stacked boxes, shirt-coloured) with a pompom and a thin chin strap
    box(head, 0.4, 0.14, 0.4, c.shirt, 0, 0.57, 0);
    box(head, 0.3, 0.14, 0.3, 0xffd23a, 0, 0.71, 0);
    box(head, 0.2, 0.14, 0.2, c.shirt, 0, 0.85, 0);
    box(head, 0.1, 0.1, 0.1, 0xffffff, 0, 0.97, 0);
    box(head, 0.025, 0.2, 0.025, 0xffd23a, -0.2, 0.42, 0.1);
  }
  if (look === 'crown') { // T41: Queen Coralia's gold crown (a band with five points and a teal gem); her trident is added below
    box(head, 0.56, 0.1, 0.56, 0xf2c23c, 0, 0.55, 0);
    for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) box(head, 0.07, x === 0 ? 0.22 : 0.15, 0.07, 0xf2c23c, x, 0.67 + (x === 0 ? 0.03 : 0), 0);
    box(head, 0.1, 0.1, 0.04, 0x5af0e0, 0, 0.55, 0.29);
  }
  if (look === 'star') {
    const y = hat ? 0.82 : 0.62;
    box(head, 0.24, 0.08, 0.06, 0xffe94a, 0, y, 0);
    box(head, 0.08, 0.24, 0.06, 0xffe94a, 0, y, 0);
    const d = box(head, 0.12, 0.12, 0.05, 0xfff6a0, 0, y, 0);
    d.rotation.z = Math.PI / 4;
  }
  if (look === 'beret') { // T45: Artist Arlo: a flat black beret with a little stalk, and a pencil behind the ear
    box(head, 0.62, 0.1, 0.6, 0x24222c, 0.02, 0.54, 0);
    box(head, 0.5, 0.08, 0.5, 0x24222c, 0.04, 0.62, 0);
    box(head, 0.06, 0.08, 0.06, 0x24222c, 0.04, 0.69, 0);
    box(head, 0.05, 0.05, 0.3, 0xffd23a, 0.3, 0.3, 0.06);
    box(head, 0.05, 0.05, 0.05, 0xf0a8b8, 0.3, 0.3, 0.22);
  }
  if (look === 'knight') { // T49: Sir Clanksalot: a steel bucket helm over the head (a dark visor slit, rivets), a red plume, a gold star on the tabard
    box(head, 0.58, 0.6, 0.58, 0xc8ccd8, 0, 0.27, 0);
    box(head, 0.46, 0.06, 0.02, 0x1e1e26, 0, 0.34, 0.295);
    box(head, 0.05, 0.2, 0.02, 0x1e1e26, 0, 0.2, 0.295);
    for (const sx of [-1, 1]) box(head, 0.05, 0.05, 0.02, 0xf0c84a, sx * 0.2, 0.12, 0.3);
    box(head, 0.1, 0.22, 0.32, 0xd83a4a, 0, 0.66, -0.04);
    box(head, 0.09, 0.14, 0.16, 0xd83a4a, 0, 0.62, -0.26);
    box(group, 0.16, 0.16, 0.03, 0xf0c84a, 0, 1.18, 0.155);
    box(group, 0.06, 0.26, 0.03, 0xf0c84a, 0, 1.18, 0.158); box(group, 0.26, 0.06, 0.03, 0xf0c84a, 0, 1.18, 0.158);
  }
  if (look === 'squire') { // T49: the Castle's helpers and herald: a small round steel cap with a feather
    box(head, 0.54, 0.12, 0.54, 0xb8c0cc, 0, 0.55, 0);
    box(head, 0.42, 0.1, 0.42, 0xb8c0cc, 0, 0.64, 0);
    box(head, 0.05, 0.24, 0.1, c.shirt, 0.22, 0.7, -0.12);
  }
  /* ==== Bubble ==== */
  if (look === 'bubble') { // the Bubble Well's people: a puffy hat of soap foam and a big bubble wand (a ring on a stick) on the back
    for (const [x, y, z, w] of [[0, 0.56, 0, 0.5], [-0.14, 0.66, 0.06, 0.26], [0.13, 0.68, -0.04, 0.28], [0.02, 0.76, 0.02, 0.22]]) box(head, w, w * 0.6, w, 0xffffff, x, y, z);
    box(group, 0.05, 0.7, 0.05, 0xf0c84a, 0.12, 1.15, -0.2);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; box(group, 0.06, 0.06, 0.04, [0x8ad8ff, 0xff9ac8, 0xfff28a][k % 3], 0.12 + Math.cos(a) * 0.16, 1.62 + Math.sin(a) * 0.16, -0.2); }
  }
  /* ==== end of Bubble ==== */
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
  if (look === 'crown') { // T41: a gold trident in her right hand: a staff and three prongs
    const hand = parts.arms[1].g;
    box(hand, 0.06, 1.5, 0.06, 0xf2c23c, 0, -0.3, 0.18);
    box(hand, 0.34, 0.06, 0.06, 0xf2c23c, 0, 0.42, 0.18);
    for (const x of [-0.14, 0, 0.14]) box(hand, 0.05, 0.26, 0.05, 0xfbe27a, x, 0.58, 0.18);
  }
  group.userData.parts = parts;
  return group;
}

class Npc {
  constructor({ kind, name, gym = null, colors, pos, heading, hat, cape, look, index = 0, def = null, model = null }) {
    this.kind = kind;
    this.index = index; // which trainer of the gym (T19: gyms may have two)
    this.def = def; // the person's entry in the gym def (`opens`, `disguise`...)
    this.name = name;
    this.gym = gym;
    this.pos = new THREE.Vector3(...pos);
    this.homeHeading = heading;
    this.heading = heading;
    this.model = model ?? buildPerson(colors, { hat, cape, look });
    sketchModel(this.model); // T45: drawn in pencil in the Sketchbook (a no-op everywhere else)
    this.creature = !!model; // T40: a Picture World Boss may be a big creature (no limbs to move)
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
          pos: spots[i] || AWAY, heading: gym.trainerHeadings?.[i] ?? facing, hat: ['alien', 'chef', 'sport', 'ninja', 'pirate'].includes(trainer.look) ? null : trainer.colors.pants, index: i, def: trainer,
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
    // T40: the Bosses of a Picture World (and their crews): world.bosses from picturelands.js, defs from pictureboss.js
    for (const b of world.bosses || []) {
      const def = bossOf(b.id);
      if (!def) continue;
      const mk = d => { if (!d.model) return {}; const model = buildModel(d.model.species); model.scale.setScalar(d.model.scale ?? 2); return { model }; };
      this.add(new Npc({ kind: 'boss', name: def.name, colors: def.colors, pos: b.pos, heading: b.heading, hat: def.hat, cape: def.cape, look: def.look, def, ...mk(def) }));
      const pw = def.title.split(' · ').pop();
      (def.crew || []).forEach((c, i) => {
        const at = b.crew.find(q => q.i === i);
        if (at) this.add(new Npc({ kind: 'crew', name: c.name, colors: c.colors, pos: at.pos, heading: at.heading, hat: c.hat, look: c.look, def: { ...c, title: `${c.name} · ${pw}`, boss: def.id, index: i } }));
      });
    }
    // T43: people of a Picture World who only talk (Ticket Tess): world.people = [{ name, title, colors, look, hat, line, pos, heading }]
    for (const p of world.people || []) this.add(new Npc({ kind: 'guest', name: p.name, colors: p.colors, pos: p.pos, heading: p.heading ?? 0, hat: p.hat, look: p.look, def: p }));
    if (world.realm) { // T31: no Healer Hana in a realm (losing there wakes you up, rested); T35: a realm may have its own healer
      if (world.healer) this.add(new Npc({ kind: 'healer', name: 'Healer Stella', look: 'star', colors: { shirt: 0xc8b4ff, pants: 0xffffff, hair: 0xfff0a0, skin: 0xf2d0b0 }, pos: world.healer.slice(0, 3), heading: world.healer[3] }));
      return;
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
      if (n.creature) { // T40: a creature Boss turns to the player and idles
        const want = n.pos.distanceTo(playerPos) < 9 ? Math.atan2(playerPos.x - n.pos.x, playerPos.z - n.pos.z) : n.homeHeading;
        let d = want - n.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        n.heading += d * Math.min(1, dt * 4);
        n.model.rotation.y = n.heading;
        animateModel(n.model, n.t, false);
        continue;
      }
      const p = n.model.userData.parts;
      if (n.steer) { // T37b: a live gym part walks this person (the Shadow Dojo's watchers): no turning to the player
        n.model.position.copy(n.pos);
        n.model.rotation.y = n.heading;
        for (const l of p.legs) l.g.rotation.x = n.moving ? Math.sin(n.t * 7 + l.phase) * 0.5 : 0;
        for (const a of p.arms) a.g.rotation.x = n.moving ? Math.sin(n.t * 7 + a.phase) * 0.25 : 0;
        continue;
      }
      const near = !n.lookout && n.pos.distanceTo(playerPos) < 7; // a lookout (a Shadow Dojo master) keeps looking out
      // Turn to face the player when they come close.
      const want = near ? Math.atan2(playerPos.x - n.pos.x, playerPos.z - n.pos.z) : n.homeHeading;
      let d = want - n.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      n.heading += d * Math.min(1, dt * 4);
      n.model.rotation.y = n.heading;
      if (n.cheer > 0) { // T48: a party guest cheers (arms up, waving, a little hop) for a while
        n.cheer -= dt;
        for (const a of p.arms) a.g.rotation.x = -2.7 + Math.sin(n.t * 14 + a.phase * 3) * 0.35;
        n.model.position.y = n.pos.y + (n.cheer > 0 ? Math.abs(Math.sin(n.t * 9)) * 0.18 : 0);
      } else for (const a of p.arms) a.g.rotation.x = Math.sin(n.t * 1.6 + a.phase) * 0.06;
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
