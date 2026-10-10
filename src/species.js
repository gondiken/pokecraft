// Creature data (types, moves, species), stat/XP math and blocky 3D models.
import * as THREE from 'three';

export const TYPE_COLORS = {
  normal: '#c6c59a', fire: '#f2914a', water: '#7aa4f5', grass: '#8fd166', electric: '#f7d84a', rock: '#c9b45a',
};

// attacker type -> defender type -> multiplier (missing = 1)
const EFFECTIVENESS = {
  normal: { rock: 0.5 },
  fire: { grass: 2, fire: 0.5, water: 0.5, rock: 0.5 },
  water: { fire: 2, rock: 2, water: 0.5, grass: 0.5 },
  grass: { water: 2, rock: 2, fire: 0.5, grass: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, rock: 0.5 },
  rock: { fire: 2, electric: 2, grass: 0.5 },
};
export const effectiveness = (moveType, defType) => EFFECTIVENESS[moveType]?.[defType] ?? 1;

export const MOVES = {
  tackle: { name: 'Tackle', type: 'normal', power: 40, acc: 1 },
  quickjab: { name: 'Quick Jab', type: 'normal', power: 35, acc: 1, priority: 1 },
  bodyslam: { name: 'Body Slam', type: 'normal', power: 70, acc: 0.95 },
  ember: { name: 'Ember', type: 'fire', power: 40, acc: 1 },
  flameburst: { name: 'Flame Burst', type: 'fire', power: 75, acc: 0.9 },
  bubble: { name: 'Bubble', type: 'water', power: 40, acc: 1 },
  tidecrash: { name: 'Tide Crash', type: 'water', power: 75, acc: 0.9 },
  leafcut: { name: 'Leaf Cut', type: 'grass', power: 40, acc: 1 },
  vinelash: { name: 'Vine Lash', type: 'grass', power: 75, acc: 0.9 },
  spark: { name: 'Spark', type: 'electric', power: 40, acc: 1 },
  thunderjolt: { name: 'Thunder Jolt', type: 'electric', power: 75, acc: 0.9 },
  pebbleshot: { name: 'Pebble Shot', type: 'rock', power: 40, acc: 1 },
  rockslam: { name: 'Rock Slam', type: 'rock', power: 75, acc: 0.9 },
};

export const SPECIES = {
  emberpup: {
    name: 'Emberpup', type: 'fire', desc: 'A loyal pup whose tail burns brighter when it is happy.',
    base: { hp: 39, atk: 56, def: 40, spd: 62 }, baseXp: 62, catchRate: 0.45,
    learn: [[1, 'tackle'], [1, 'ember'], [8, 'quickjab'], [13, 'flameburst'], [20, 'bodyslam']],
    evolve: { level: 16, into: 'blazehound' },
    model: { shape: 'quad', scale: 0.85, body: 0xe2572c, accent: 0xffc840, dark: 0x7a2a12, belly: 0xffe0b0, extras: ['flameTail', 'ears'] },
  },
  blazehound: {
    name: 'Blazehound', type: 'fire', desc: 'Its burning mane can be seen from far across the plains.',
    base: { hp: 65, atk: 85, def: 60, spd: 85 }, baseXp: 150, catchRate: 0.15,
    learn: [[1, 'tackle'], [1, 'ember'], [8, 'quickjab'], [13, 'flameburst'], [20, 'bodyslam']],
    model: { shape: 'quad', scale: 1.3, body: 0xb83a1c, accent: 0xffc840, dark: 0x4a1608, belly: 0xffd08a, extras: ['flameTail', 'ears', 'mane'] },
  },
  sproutle: {
    name: 'Sproutle', type: 'grass', desc: 'A calm frog-like creature that naps in the sun to grow its leaf.',
    base: { hp: 45, atk: 49, def: 49, spd: 45 }, baseXp: 64, catchRate: 0.45,
    learn: [[1, 'tackle'], [1, 'leafcut'], [9, 'quickjab'], [13, 'vinelash'], [20, 'bodyslam']],
    evolve: { level: 16, into: 'grovebeast' },
    model: { shape: 'quad', scale: 0.8, body: 0x5fbf7f, accent: 0x2f8f3a, dark: 0x2f6e46, belly: 0xd9f2c4, extras: ['frog', 'leafHead'] },
  },
  grovebeast: {
    name: 'Grovebeast', type: 'grass', desc: 'A small tree grows on its back. Forests flourish where it walks.',
    base: { hp: 80, atk: 82, def: 83, spd: 60 }, baseXp: 155, catchRate: 0.15,
    learn: [[1, 'tackle'], [1, 'leafcut'], [9, 'quickjab'], [13, 'vinelash'], [20, 'bodyslam']],
    model: { shape: 'quad', scale: 1.35, body: 0x4a9e66, accent: 0x2f8f3a, dark: 0x6b4a2b, belly: 0xc9e8b0, extras: ['frog', 'backTree'] },
  },
  bubbuck: {
    name: 'Bubbuck', type: 'water', desc: 'A bouncy blob that blows bubbles when startled.',
    base: { hp: 44, atk: 48, def: 65, spd: 43 }, baseXp: 63, catchRate: 0.45,
    learn: [[1, 'tackle'], [1, 'bubble'], [8, 'quickjab'], [13, 'tidecrash'], [20, 'bodyslam']],
    evolve: { level: 16, into: 'tidalord' }, swims: true,
    model: { shape: 'blob', scale: 0.85, body: 0x4f8fe0, accent: 0xa8e0ff, dark: 0x234a80, belly: 0xd8f0ff, extras: ['fin'] },
  },
  tidalord: {
    name: 'Tidalord', type: 'water', desc: 'Rules the lakes. Its crown is said to control the tides.',
    base: { hp: 79, atk: 83, def: 100, spd: 78 }, baseXp: 160, catchRate: 0.15, swims: true,
    learn: [[1, 'tackle'], [1, 'bubble'], [8, 'quickjab'], [13, 'tidecrash'], [20, 'bodyslam']],
    model: { shape: 'blob', scale: 1.4, body: 0x2f6fc0, accent: 0xa8e0ff, dark: 0x16345e, belly: 0xd8f0ff, extras: ['fin', 'crown'] },
  },
  zapple: {
    name: 'Zapple', type: 'electric', desc: 'Stores static in its antenna. Touching it is a shocking idea.',
    base: { hp: 35, atk: 55, def: 40, spd: 90 }, baseXp: 82, catchRate: 0.4,
    learn: [[1, 'tackle'], [1, 'spark'], [6, 'quickjab'], [12, 'thunderjolt'], [18, 'bodyslam']],
    model: { shape: 'blob', scale: 0.7, body: 0xf5d63d, accent: 0xff5a4a, dark: 0x6b5a14, belly: 0xfff4b0, extras: ['antenna', 'cheeks'] },
  },
  pebblor: {
    name: 'Pebblor', type: 'rock', desc: 'Sleeps for weeks on mountaintops and is often mistaken for a boulder.',
    base: { hp: 40, atk: 80, def: 100, spd: 20 }, baseXp: 86, catchRate: 0.4,
    learn: [[1, 'tackle'], [1, 'pebbleshot'], [12, 'rockslam'], [18, 'bodyslam']],
    model: { shape: 'biped', scale: 0.8, body: 0x8c8478, accent: 0x5c9a40, dark: 0x5a544c, belly: 0xa8a092, extras: ['moss'] },
  },
  fluffin: {
    name: 'Fluffin', type: 'normal', desc: 'A woolly grazer. Its fleece makes the softest pillows.',
    base: { hp: 55, atk: 45, def: 50, spd: 40 }, baseXp: 58, catchRate: 0.55,
    learn: [[1, 'tackle'], [4, 'quickjab'], [10, 'bodyslam']],
    model: { shape: 'quad', scale: 0.85, body: 0xf4f1ea, accent: 0xffb6c8, dark: 0x3b3430, belly: 0xffffff, extras: ['wool', 'ears'] },
  },
  thornox: {
    name: 'Thornox', type: 'grass', desc: 'A stubborn forest guardian with thorny horns.',
    base: { hp: 60, atk: 75, def: 70, spd: 55 }, baseXp: 120, catchRate: 0.25,
    learn: [[1, 'tackle'], [1, 'leafcut'], [10, 'vinelash'], [16, 'bodyslam']],
    model: { shape: 'quad', scale: 1.15, body: 0x6b8e3a, accent: 0xd8d0a0, dark: 0x3e4f1f, belly: 0x9fbf6a, extras: ['horns'] },
  },
  flarehawk: {
    name: 'Flarehawk', type: 'fire', desc: 'Circles mountain peaks riding hot air currents.',
    base: { hp: 50, atk: 70, def: 45, spd: 95 }, baseXp: 125, catchRate: 0.25, flies: true,
    learn: [[1, 'quickjab'], [1, 'ember'], [10, 'flameburst'], [16, 'bodyslam']],
    model: { shape: 'bird', scale: 0.9, body: 0xd9482b, accent: 0xffc23d, dark: 0x5a1e10, belly: 0xffe2a8, extras: [] },
  },
};

export const STARTERS = ['emberpup', 'sproutle', 'bubbuck'];

// Weighted spawn tables per biome.
export const SPAWNS = {
  plains: [['fluffin', 5], ['zapple', 3], ['sproutle', 2], ['emberpup', 1]],
  forest: [['sproutle', 4], ['thornox', 2], ['fluffin', 1], ['zapple', 1]],
  beach: [['bubbuck', 4], ['emberpup', 2], ['zapple', 1]],
  water: [['bubbuck', 1]],
  mountain: [['pebblor', 5], ['flarehawk', 2], ['zapple', 1]],
};

export const xpForLevel = L => Math.floor(0.8 * L * L * L);

export function statsFor(c) {
  const b = SPECIES[c.species].base, L = c.level;
  return {
    maxHp: Math.floor((b.hp * 2 * L) / 100) + L + 10,
    atk: Math.floor((b.atk * 2 * L) / 100) + 5,
    def: Math.floor((b.def * 2 * L) / 100) + 5,
    spd: Math.floor((b.spd * 2 * L) / 100) + 5,
  };
}

export const nameOf = c => SPECIES[c.species].name;

export function makeCreature(species, level) {
  const sp = SPECIES[species];
  const moves = sp.learn.filter(([l]) => l <= level).map(([, m]) => m);
  const c = {
    uid: Math.random().toString(36).slice(2, 10),
    species, level, xp: xpForLevel(level), hp: 0,
    moves: [...new Set(moves)].slice(-4),
  };
  c.hp = statsFor(c).maxHp;
  return c;
}

// Adds XP and handles level-ups, new moves and evolution. Returns messages to show.
export function gainXp(c, amount) {
  const msgs = [];
  let evolved = false;
  c.xp += amount;
  while (c.level < 60 && c.xp >= xpForLevel(c.level + 1)) {
    const before = statsFor(c).maxHp;
    c.level++;
    c.hp += statsFor(c).maxHp - before;
    msgs.push(`${nameOf(c)} grew to Lv ${c.level}!`);
    for (const [l, m] of SPECIES[c.species].learn) {
      if (l !== c.level || c.moves.includes(m)) continue;
      c.moves.push(m);
      if (c.moves.length > 4) msgs.push(`${nameOf(c)} forgot ${MOVES[c.moves.shift()].name}...`);
      msgs.push(`${nameOf(c)} learned ${MOVES[m].name}!`);
    }
    const evo = SPECIES[c.species].evolve;
    if (evo && c.level >= evo.level) {
      const oldName = nameOf(c);
      const oldMax = statsFor(c).maxHp;
      c.species = evo.into;
      c.hp += statsFor(c).maxHp - oldMax;
      msgs.push(`What? ${oldName} is evolving...`);
      msgs.push(`${oldName} evolved into ${nameOf(c)}!`);
      evolved = true;
    }
  }
  return { msgs, evolved };
}

/* ------------------------------------------------------------------ */
/* Blocky models. Every model faces +Z and stands on y = 0.            */
/* ------------------------------------------------------------------ */

function box(parent, w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function eyes(parent, y, z, spread, size = 0.13) {
  for (const s of [-1, 1]) {
    box(parent, size, size * 1.15, 0.04, 0xffffff, s * spread, y, z);
    box(parent, size * 0.55, size * 0.7, 0.03, 0x111111, s * spread + s * size * 0.12, y - 0.01, z + 0.03);
  }
}

function buildQuad(root, m, parts) {
  const has = e => m.extras.includes(e);
  const frog = has('frog');
  const legLen = frog ? 0.25 : 0.4;
  const bodyY = legLen + 0.22;
  const body = has('wool')
    ? box(root, 0.9, 0.65, 1.05, m.body, 0, bodyY + 0.05, 0)
    : box(root, 0.7, 0.48, 0.92, m.body, 0, bodyY, 0);
  if (!has('wool')) box(root, 0.6, 0.06, 0.8, m.belly, 0, bodyY - 0.24, 0);
  parts.body = body;

  const head = pivot(root, 0, bodyY + 0.3, 0.5);
  parts.head = head;
  const headColor = has('wool') ? m.dark : m.body;
  const hw = frog ? 0.68 : 0.52;
  box(head, hw, frog ? 0.4 : 0.48, 0.48, headColor, 0, 0, 0.05);
  if (!frog) {
    box(head, 0.28, 0.18, 0.16, has('wool') ? m.dark : m.belly, 0, -0.11, 0.36);
    box(head, 0.1, 0.07, 0.04, 0x111111, 0, -0.06, 0.45);
  } else {
    box(head, 0.4, 0.04, 0.03, 0x2a2a2a, 0, -0.1, 0.3);
  }
  eyes(head, frog ? 0.12 : 0.07, 0.3, frog ? 0.2 : 0.14, frog ? 0.16 : 0.13);

  if (has('ears')) {
    for (const s of [-1, 1]) box(head, 0.12, 0.2, 0.08, has('wool') ? m.accent : m.dark, s * 0.18, 0.31, -0.05);
  }
  if (has('leafHead')) {
    const stem = box(head, 0.05, 0.18, 0.05, m.accent, 0, 0.29, 0);
    const leaf = box(head, 0.32, 0.04, 0.2, m.accent, 0.12, 0.38, 0);
    leaf.rotation.z = 0.35;
    parts.sway = [stem, leaf];
  }
  if (has('horns')) {
    for (const s of [-1, 1]) {
      const h = box(head, 0.09, 0.32, 0.09, m.accent, s * 0.22, 0.32, 0);
      h.rotation.z = -s * 0.45;
    }
  }
  if (has('mane')) {
    box(root, 0.86, 0.62, 0.3, m.accent, 0, bodyY + 0.12, 0.38);
    box(head, 0.6, 0.12, 0.3, m.accent, 0, 0.3, -0.05);
  }
  if (has('backTree')) {
    box(root, 0.14, 0.5, 0.14, m.dark, 0, bodyY + 0.45, -0.1);
    box(root, 0.6, 0.45, 0.6, m.accent, 0, bodyY + 0.85, -0.1);
    box(root, 0.36, 0.25, 0.36, m.accent, 0, bodyY + 1.15, -0.1);
  }

  parts.legs = [];
  for (const [sx, sz, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
    const leg = pivot(root, sx * 0.24, legLen, sz * 0.3);
    box(leg, 0.18, legLen, 0.18, frog ? m.body : m.dark, 0, -legLen / 2, 0);
    parts.legs.push({ g: leg, phase });
  }

  const tail = pivot(root, 0, bodyY + 0.1, -0.46);
  parts.tail = tail;
  if (has('flameTail')) {
    const t1 = box(tail, 0.14, 0.14, 0.34, m.body, 0, 0.05, -0.15);
    t1.rotation.x = -0.6;
    box(tail, 0.26, 0.3, 0.26, m.accent, 0, 0.28, -0.3);
    box(tail, 0.14, 0.2, 0.14, 0xff7a1a, 0, 0.42, -0.3);
    parts.glow = tail;
  } else if (has('wool')) {
    box(tail, 0.22, 0.22, 0.16, m.body, 0, 0.05, -0.04);
  } else if (!frog) {
    const t = box(tail, 0.12, 0.12, 0.38, m.dark, 0, 0.05, -0.18);
    t.rotation.x = -0.5;
  }
}

function buildBlob(root, m, parts) {
  const has = e => m.extras.includes(e);
  const bodyGroup = pivot(root, 0, 0, 0);
  parts.bounce = bodyGroup;
  box(bodyGroup, 0.72, 0.64, 0.72, m.body, 0, 0.4, 0);
  box(bodyGroup, 0.5, 0.3, 0.04, m.belly, 0, 0.3, 0.36);
  eyes(bodyGroup, 0.5, 0.37, 0.16, 0.15);
  box(bodyGroup, 0.14, 0.04, 0.03, 0x2a2a2a, 0, 0.36, 0.38);
  for (const s of [-1, 1]) box(bodyGroup, 0.2, 0.1, 0.28, m.dark, s * 0.2, 0.05, 0.04);

  if (has('fin')) {
    box(bodyGroup, 0.08, 0.3, 0.34, m.accent, 0, 0.82, -0.05);
    const tail = box(bodyGroup, 0.36, 0.3, 0.06, m.accent, 0, 0.42, -0.42);
    parts.tail = tail;
  }
  if (has('crown')) {
    for (const x of [-0.22, 0, 0.22]) box(bodyGroup, 0.1, x === 0 ? 0.3 : 0.2, 0.1, 0xffd34a, x, 0.82 + (x === 0 ? 0.05 : 0), 0.15);
  }
  if (has('antenna')) {
    box(bodyGroup, 0.05, 0.32, 0.05, m.dark, 0, 0.87, 0);
    const tip = box(bodyGroup, 0.13, 0.13, 0.13, 0xfff7c0, 0, 1.06, 0);
    tip.material.emissive = new THREE.Color(0x998800);
    parts.tip = tip;
    // Zig-zag tail
    box(bodyGroup, 0.1, 0.22, 0.08, m.dark, 0, 0.35, -0.4);
    box(bodyGroup, 0.1, 0.08, 0.22, m.dark, 0, 0.48, -0.47);
    box(bodyGroup, 0.1, 0.22, 0.08, m.body, 0, 0.6, -0.55);
  }
  if (has('cheeks')) {
    for (const s of [-1, 1]) box(bodyGroup, 0.12, 0.09, 0.03, m.accent, s * 0.25, 0.36, 0.37);
  }
}

function buildBiped(root, m, parts) {
  box(root, 0.8, 0.7, 0.62, m.body, 0, 0.85, 0);
  box(root, 0.5, 0.36, 0.04, m.belly, 0, 0.8, 0.32);
  const head = pivot(root, 0, 1.38, 0.04);
  parts.head = head;
  box(head, 0.52, 0.4, 0.46, m.body, 0, 0, 0);
  eyes(head, 0.03, 0.24, 0.12, 0.11);
  box(head, 0.3, 0.06, 0.04, 0x3a3630, 0, -0.1, 0.24);
  if (m.extras.includes('moss')) {
    box(head, 0.4, 0.08, 0.36, m.accent, 0, 0.23, 0);
    box(root, 0.3, 0.1, 0.3, m.accent, 0.2, 1.24, -0.1);
  }
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(root, s * 0.52, 1.12, 0);
    box(arm, 0.26, 0.62, 0.28, m.dark, 0, -0.27, 0);
    parts.arms.push({ g: arm, phase });
  }
  parts.legs = [];
  for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
    const leg = pivot(root, s * 0.2, 0.5, 0);
    box(leg, 0.28, 0.5, 0.32, m.dark, 0, -0.25, 0);
    parts.legs.push({ g: leg, phase });
  }
}

function buildBird(root, m, parts) {
  const bodyGroup = pivot(root, 0, 0, 0);
  parts.bounce = bodyGroup;
  box(bodyGroup, 0.46, 0.42, 0.62, m.body, 0, 0.7, 0);
  box(bodyGroup, 0.36, 0.3, 0.04, m.belly, 0, 0.66, 0.31);
  const head = pivot(bodyGroup, 0, 1.0, 0.28);
  box(head, 0.36, 0.34, 0.34, m.body, 0, 0, 0);
  box(head, 0.12, 0.1, 0.18, m.accent, 0, -0.04, 0.24);
  eyes(head, 0.05, 0.175, 0.1, 0.1);
  box(head, 0.08, 0.2, 0.22, m.accent, 0, 0.22, -0.08);
  parts.wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(bodyGroup, s * 0.23, 0.8, 0);
    box(w, 0.55, 0.06, 0.42, m.dark, s * 0.27, 0, 0);
    box(w, 0.25, 0.05, 0.3, m.accent, s * 0.6, 0, -0.05);
    parts.wings.push({ g: w, s });
  }
  const tail = box(bodyGroup, 0.32, 0.06, 0.34, m.accent, 0, 0.72, -0.44);
  tail.rotation.x = 0.25;
  for (const s of [-1, 1]) box(bodyGroup, 0.06, 0.5, 0.06, 0x6b4a2b, s * 0.12, 0.25, 0);
}

export function buildModel(species) {
  const sp = SPECIES[species];
  const m = sp.model;
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  const parts = { root };
  ({ quad: buildQuad, blob: buildBlob, biped: buildBiped, bird: buildBird })[m.shape](root, m, parts);
  root.scale.setScalar(m.scale);
  group.userData.parts = parts;
  group.userData.species = species;
  return group;
}

// Procedural idle/walk animation.
export function animateModel(group, t, moving) {
  const p = group.userData.parts;
  const swing = moving ? Math.sin(t * 10) * 0.6 : 0;
  for (const leg of p.legs || []) leg.g.rotation.x = Math.sin(t * 10 + leg.phase) * (moving ? 0.6 : 0);
  for (const arm of p.arms || []) arm.g.rotation.x = Math.sin(t * 6 + arm.phase) * (moving ? 0.5 : 0.08);
  if (p.tail) p.tail.rotation.y = Math.sin(t * (moving ? 12 : 4)) * 0.35;
  if (p.head) p.head.rotation.x = moving ? 0 : Math.sin(t * 1.5) * 0.06;
  if (p.bounce) {
    const hop = moving ? Math.abs(Math.sin(t * 7)) * 0.18 : Math.abs(Math.sin(t * 2.2)) * 0.04;
    p.bounce.position.y = hop;
    p.bounce.scale.set(1 + (0.18 - hop) * 0.2, 1 - (0.18 - hop) * 0.15, 1 + (0.18 - hop) * 0.2);
  }
  for (const w of p.wings || []) w.g.rotation.z = w.s * Math.sin(t * (moving ? 14 : 4)) * (moving ? 0.7 : 0.25);
  if (p.tip) p.tip.material.emissive.setScalar(0.4 + 0.4 * Math.abs(Math.sin(t * 5)));
  if (p.root && !p.bounce) p.root.position.y = moving ? Math.abs(swing) * 0.04 : 0;
}

// Tint a model for hit flashes (pass null to restore).
export function tintModel(group, color) {
  group.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.baseEmissive === undefined) o.userData.baseEmissive = o.material.emissive.getHex();
    o.material.emissive.setHex(color ?? o.userData.baseEmissive);
  });
}

export function disposeModel(group) {
  group.traverse(o => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
}
