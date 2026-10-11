// Creature data (types, moves, species), stat/XP math and blocky 3D models.
import * as THREE from 'three';

export const TYPE_COLORS = {
  normal: '#c6c59a', fire: '#f2914a', water: '#7aa4f5', grass: '#8fd166', electric: '#f7d84a', rock: '#c9b45a',
  ice: '#9fe0f0', bug: '#b5c84a', ghost: '#a48ad0',
  mind: '#f584b8', metal: '#b8c4cf', toxic: '#b36ad6', pixie: '#ffb8e6', drake: '#7f6cf0',
  rainbow: 'linear-gradient(90deg,#ff7a7a,#ffd36b,#8fe388,#7ab8ff,#c99bff)',
};

// attacker type -> defender type -> multiplier (missing = 1)
const EFFECTIVENESS = {
  normal: { rock: 0.5, metal: 0.5, ghost: 0 },
  fire: { grass: 2, ice: 2, bug: 2, metal: 2, fire: 0.5, water: 0.5, rock: 0.5, drake: 0.5, rainbow: 0.5 },
  water: { fire: 2, rock: 2, water: 0.5, grass: 0.5, drake: 0.5, rainbow: 0.5 },
  grass: { water: 2, rock: 2, fire: 0.5, grass: 0.5, bug: 0.5, metal: 0.5, toxic: 0.5, drake: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, rock: 0.5, drake: 0.5 },
  rock: { fire: 2, electric: 2, ice: 2, bug: 2, grass: 0.5, metal: 0.5 },
  ice: { grass: 2, bug: 2, drake: 2, fire: 0.5, water: 0.5, ice: 0.5, metal: 0.5 },
  bug: { grass: 2, mind: 2, ghost: 0.5, fire: 0.5, rock: 0.5, metal: 0.5, pixie: 0.5 },
  ghost: { ghost: 2, mind: 2, rainbow: 2, normal: 0 },
  // New types
  mind: { toxic: 2, drake: 2, mind: 0.5, metal: 0.5 },
  metal: { ice: 2, rock: 2, pixie: 2, metal: 0.5, fire: 0.5, water: 0.5, electric: 0.5 },
  toxic: { grass: 2, pixie: 2, toxic: 0.5, rock: 0.5, ghost: 0.5, metal: 0 },
  pixie: { drake: 2, ghost: 2, fire: 0.5, metal: 0.5, toxic: 0.5 },
  drake: { drake: 2, metal: 0.5, pixie: 0 },
  rainbow: { ghost: 2, toxic: 2, mind: 2, metal: 0.5, rainbow: 0.5 },
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
  hyperstrike: { name: 'Hyper Strike', type: 'normal', power: 90, acc: 0.85 },
  icebreath: { name: 'Ice Breath', type: 'ice', power: 40, acc: 1 },
  blizzard: { name: 'Blizzard', type: 'ice', power: 75, acc: 0.9 },
  bugbite: { name: 'Bug Bite', type: 'bug', power: 40, acc: 1 },
  stingbarrage: { name: 'Sting Barrage', type: 'bug', power: 75, acc: 0.9 },
  shadowsneak: { name: 'Shadow Sneak', type: 'ghost', power: 40, acc: 1, priority: 1 },
  phantomstrike: { name: 'Phantom Strike', type: 'ghost', power: 75, acc: 0.9 },
  mindpulse: { name: 'Mind Pulse', type: 'mind', power: 40, acc: 1 },
  brainwave: { name: 'Brain Wave', type: 'mind', power: 75, acc: 0.9 },
  clank: { name: 'Clank', type: 'metal', power: 40, acc: 1 },
  ironbash: { name: 'Iron Bash', type: 'metal', power: 75, acc: 0.9 },
  sludgespit: { name: 'Sludge Spit', type: 'toxic', power: 40, acc: 1 },
  toxiccloud: { name: 'Toxic Cloud', type: 'toxic', power: 75, acc: 0.9 },
  pixiedust: { name: 'Pixie Dust', type: 'pixie', power: 40, acc: 1 },
  moonbeam: { name: 'Moonbeam', type: 'pixie', power: 75, acc: 0.9 },
  scaleswipe: { name: 'Scale Swipe', type: 'drake', power: 40, acc: 1 },
  drakeroar: { name: 'Drake Roar', type: 'drake', power: 80, acc: 0.9 },
  prismray: { name: 'Prism Ray', type: 'rainbow', power: 45, acc: 1 },
  rainbowburst: { name: 'Rainbow Burst', type: 'rainbow', power: 80, acc: 0.9 },
};

// Standard learnset for a type: a weak move at first, a strong one at 13, and normal moves for coverage.
const T1 = {
  fire: 'ember', water: 'bubble', grass: 'leafcut', electric: 'spark', rock: 'pebbleshot', ice: 'icebreath', bug: 'bugbite',
  ghost: 'shadowsneak', mind: 'mindpulse', metal: 'clank', toxic: 'sludgespit', pixie: 'pixiedust', drake: 'scaleswipe', rainbow: 'prismray',
};
const T2 = {
  fire: 'flameburst', water: 'tidecrash', grass: 'vinelash', electric: 'thunderjolt', rock: 'rockslam', ice: 'blizzard', bug: 'stingbarrage',
  ghost: 'phantomstrike', mind: 'brainwave', metal: 'ironbash', toxic: 'toxiccloud', pixie: 'moonbeam', drake: 'drakeroar', rainbow: 'rainbowburst',
};
function L(type, extra = []) {
  const base = type === 'normal'
    ? [[1, 'tackle'], [1, 'quickjab'], [12, 'bodyslam'], [24, 'hyperstrike']]
    : [[1, 'tackle'], [1, T1[type]], [7, 'quickjab'], [13, T2[type]], [24, 'bodyslam']];
  return [...base, ...extra].sort((a, b) => a[0] - b[0]);
}

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
    evolve: { level: 20, into: 'monolor' },
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

  /* ----------------------------- fire ----------------------------- */
  sparkitten: {
    name: 'Sparkitten', type: 'fire', desc: 'A playful kitten. Its whiskers throw sparks when it sneezes.',
    base: { hp: 40, atk: 55, def: 38, spd: 70 }, baseXp: 60, catchRate: 0.45, learn: L('fire'),
    evolve: { level: 18, into: 'pyrolynx' },
    model: { shape: 'quad', scale: 0.7, body: 0xf07a3a, accent: 0xffd060, dark: 0x7a3010, belly: 0xffe8c0, extras: ['ears', 'fluffyTail', 'whiskers'] },
  },
  pyrolynx: {
    name: 'Pyrolynx', type: 'fire', desc: 'A proud lynx that leaves glowing paw prints behind it.',
    base: { hp: 70, atk: 88, def: 58, spd: 98 }, baseXp: 150, catchRate: 0.15, learn: L('fire'),
    model: { shape: 'quad', scale: 1.2, body: 0xd0501a, accent: 0xffd060, dark: 0x5a200a, belly: 0xffd8a0, extras: ['ears', 'fluffyTail', 'whiskers', 'mane'] },
  },
  magmole: {
    name: 'Magmole', type: 'fire', desc: 'Digs tunnels through volcanoes. Lava drips from its claws.',
    base: { hp: 60, atk: 72, def: 70, spd: 35 }, baseXp: 90, catchRate: 0.35, learn: L('fire', [[10, 'pebbleshot']]),
    model: { shape: 'biped', scale: 0.75, body: 0x5a3a30, accent: 0xff6a1a, dark: 0x2a1a15, belly: 0xffa040, extras: ['claws', 'lava'] },
  },

  /* ----------------------------- water ---------------------------- */
  ripplet: {
    name: 'Ripplet', type: 'water', desc: 'A little sea serpent that loves racing the waves.',
    base: { hp: 42, atk: 50, def: 45, spd: 62 }, baseXp: 62, catchRate: 0.45, learn: L('water'), swims: true,
    evolve: { level: 20, into: 'torrentide' },
    model: { shape: 'serpent', scale: 0.8, body: 0x4ab0e0, accent: 0xe0f8ff, dark: 0x206080, belly: 0xc8f0ff, extras: ['fins'] },
  },
  torrentide: {
    name: 'Torrentide', type: 'water', desc: 'A huge sea dragon. A flick of its tail can cause a whirlpool.',
    base: { hp: 85, atk: 90, def: 80, spd: 75 }, baseXp: 165, catchRate: 0.12, learn: L('water'), swims: true,
    model: { shape: 'serpent', scale: 1.4, body: 0x2060b0, accent: 0xa0e0ff, dark: 0x0a2a5a, belly: 0xc8f0ff, extras: ['fins', 'spikes', 'whiskers'] },
  },
  shellby: {
    name: 'Shellby', type: 'water', desc: 'A sleepy turtle. It hides in its shell when it is shy.',
    base: { hp: 50, atk: 45, def: 80, spd: 30 }, baseXp: 66, catchRate: 0.45, learn: L('water'), swims: true,
    model: { shape: 'quad', scale: 0.8, body: 0x6ab07a, accent: 0x3a70c0, dark: 0x2a5a3a, belly: 0xd8e8b0, extras: ['shell', 'frog'] },
  },
  gullop: {
    name: 'Gullop', type: 'water', desc: 'A noisy seabird that steals snacks from beach picnics.',
    base: { hp: 45, atk: 55, def: 40, spd: 80 }, baseXp: 70, catchRate: 0.4, learn: L('water'), flies: true,
    model: { shape: 'bird', scale: 0.8, body: 0xf0f0f0, accent: 0xffb030, dark: 0x6080a0, belly: 0xffffff, extras: [] },
  },

  /* ----------------------------- grass ---------------------------- */
  budling: {
    name: 'Budling', type: 'grass', desc: 'The flower on its head opens up on sunny days.',
    base: { hp: 40, atk: 42, def: 48, spd: 50 }, baseXp: 58, catchRate: 0.5, learn: L('grass'),
    evolve: { level: 18, into: 'bloomora' },
    model: { shape: 'blob', scale: 0.7, body: 0x8ad070, accent: 0xff70a0, dark: 0x3a7a3a, belly: 0xe0f8c8, extras: ['flower'] },
  },
  bloomora: {
    name: 'Bloomora', type: 'grass', desc: 'Its flower crown smells so sweet that angry creatures calm down.',
    base: { hp: 75, atk: 80, def: 75, spd: 70 }, baseXp: 150, catchRate: 0.15, learn: L('grass'),
    model: { shape: 'biped', scale: 0.95, body: 0x6ab06a, accent: 0xff70a0, dark: 0x2a6a3a, belly: 0xd0f0c0, extras: ['flowerHead', 'leafy'] },
  },
  mossloth: {
    name: 'Mossloth', type: 'grass', desc: 'Moves so slowly that moss grows all over its fur.',
    base: { hp: 80, atk: 60, def: 85, spd: 25 }, baseXp: 95, catchRate: 0.35, learn: L('grass'),
    model: { shape: 'biped', scale: 0.9, body: 0x7a6a50, accent: 0x5c9a40, dark: 0x4a3a2a, belly: 0xa89a80, extras: ['moss', 'claws'] },
  },

  /* --------------------------- electric --------------------------- */
  voltwing: {
    name: 'Voltwing', type: 'electric', desc: 'Flies into thunderstorms to recharge its feathers.',
    base: { hp: 45, atk: 65, def: 40, spd: 95 }, baseXp: 95, catchRate: 0.35, learn: L('electric'), flies: true,
    model: { shape: 'bird', scale: 0.8, body: 0xf5d63d, accent: 0x2a2a2a, dark: 0xc09a10, belly: 0xfff4b0, extras: ['bolt'] },
  },
  joltail: {
    name: 'Joltail', type: 'electric', desc: 'An eel that lights up lakes at night with little zaps.',
    base: { hp: 55, atk: 70, def: 50, spd: 75 }, baseXp: 100, catchRate: 0.3, learn: L('electric'), swims: true,
    model: { shape: 'serpent', scale: 0.95, body: 0x3a4a8a, accent: 0xf5e040, dark: 0x1a2050, belly: 0x8090c0, extras: ['bolt', 'whiskers'] },
  },
  ampup: {
    name: 'Ampup', type: 'electric', desc: 'A puppy that wags its lightning-bolt tail when excited.',
    base: { hp: 40, atk: 55, def: 40, spd: 72 }, baseXp: 62, catchRate: 0.45, learn: L('electric'),
    evolve: { level: 20, into: 'thunderwolf' },
    model: { shape: 'quad', scale: 0.75, body: 0xf0c030, accent: 0x2a2a2a, dark: 0x8a6a10, belly: 0xfff0b0, extras: ['ears', 'boltTail'] },
  },
  thunderwolf: {
    name: 'Thunderwolf', type: 'electric', desc: 'Its howl sounds like rolling thunder.',
    base: { hp: 70, atk: 90, def: 65, spd: 100 }, baseXp: 160, catchRate: 0.12, learn: L('electric'),
    model: { shape: 'quad', scale: 1.25, body: 0x4a5aa0, accent: 0xf5e040, dark: 0x202a50, belly: 0xc0c8f0, extras: ['ears', 'boltTail', 'mane'] },
  },

  /* ----------------------------- rock ----------------------------- */
  cragtusk: {
    name: 'Cragtusk', type: 'rock', desc: 'A rocky boar. Its tusks can split boulders in half.',
    base: { hp: 75, atk: 85, def: 95, spd: 30 }, baseXp: 120, catchRate: 0.25, learn: L('rock'),
    model: { shape: 'quad', scale: 1.1, body: 0x7a7468, accent: 0xf0e8d0, dark: 0x4a453e, belly: 0x9a9488, extras: ['tusks', 'spikes'] },
  },
  monolor: {
    name: 'Monolor', type: 'rock', desc: 'Pebblor grown into a walking mountain. Birds nest on its head.',
    base: { hp: 70, atk: 105, def: 125, spd: 30 }, baseXp: 165, catchRate: 0.1, learn: [[1, 'tackle'], [1, 'pebbleshot'], [12, 'rockslam'], [18, 'bodyslam']],
    model: { shape: 'biped', scale: 1.2, body: 0x6a645a, accent: 0x5c9a40, dark: 0x403c36, belly: 0x8a8478, extras: ['moss', 'spikes'] },
  },
  geodrake: {
    name: 'Geodrake', type: 'rock', desc: 'A stone serpent that burrows through mountains like they are sand.',
    base: { hp: 55, atk: 75, def: 85, spd: 50 }, baseXp: 105, catchRate: 0.3, learn: L('rock'),
    model: { shape: 'serpent', scale: 1.0, body: 0x9a8a6a, accent: 0xd0a040, dark: 0x5a4a30, belly: 0xc0b090, extras: ['spikes'] },
  },

  /* ---------------------------- normal ---------------------------- */
  hopsy: {
    name: 'Hopsy', type: 'normal', desc: 'A bunny that can hop higher than a tree.',
    base: { hp: 45, atk: 50, def: 40, spd: 75 }, baseXp: 55, catchRate: 0.55, learn: L('normal'),
    evolve: { level: 18, into: 'bounceroo' },
    model: { shape: 'quad', scale: 0.65, body: 0xe8d8c0, accent: 0xffb0c0, dark: 0x8a7a6a, belly: 0xffffff, extras: ['longEars', 'puffTail'] },
  },
  bounceroo: {
    name: 'Bounceroo', type: 'normal', desc: 'A boxing kangaroo with a mighty kick.',
    base: { hp: 80, atk: 85, def: 60, spd: 90 }, baseXp: 145, catchRate: 0.15, learn: L('normal'),
    model: { shape: 'biped', scale: 1.0, body: 0xc89a6a, accent: 0xe04040, dark: 0x6a4a2a, belly: 0xf0e0c0, extras: ['longEars', 'tail', 'gloves'] },
  },
  chirpit: {
    name: 'Chirpit', type: 'normal', desc: 'A tiny bird that sings at sunrise to wake everyone up.',
    base: { hp: 40, atk: 45, def: 40, spd: 70 }, baseXp: 50, catchRate: 0.55, learn: L('normal'), flies: true,
    model: { shape: 'bird', scale: 0.6, body: 0xa07a50, accent: 0xffa040, dark: 0x5a4030, belly: 0xf0e0c0, extras: [] },
  },

  /* ------------------------------ ice ----------------------------- */
  frostling: {
    name: 'Frostling', type: 'ice', desc: 'A chilly little blob. Its sneeze makes snowflakes.',
    base: { hp: 40, atk: 45, def: 50, spd: 55 }, baseXp: 62, catchRate: 0.45, learn: L('ice'),
    evolve: { level: 20, into: 'glacieron' },
    model: { shape: 'blob', scale: 0.7, body: 0xd8f4ff, accent: 0x80d0f0, dark: 0x4a8ab0, belly: 0xffffff, extras: ['iceSpikes'] },
  },
  glacieron: {
    name: 'Glacieron', type: 'ice', desc: 'A giant made of ancient glacier ice that never melts.',
    base: { hp: 80, atk: 90, def: 95, spd: 55 }, baseXp: 165, catchRate: 0.12, learn: L('ice'),
    model: { shape: 'biped', scale: 1.25, body: 0xa8e0f0, accent: 0xe8fbff, dark: 0x4a8ab0, belly: 0xd8f4ff, extras: ['crystal'] },
  },
  snowpaw: {
    name: 'Snowpaw', type: 'ice', desc: 'A snow fox that is almost invisible in a blizzard.',
    base: { hp: 50, atk: 62, def: 48, spd: 80 }, baseXp: 95, catchRate: 0.35, learn: L('ice'),
    model: { shape: 'quad', scale: 0.8, body: 0xf8fcff, accent: 0x9ad8f0, dark: 0x8aa0b0, belly: 0xffffff, extras: ['ears', 'fluffyTail'] },
  },
  waddlice: {
    name: 'Waddlice', type: 'ice', desc: 'A penguin that slides down mountains on its belly.',
    base: { hp: 55, atk: 58, def: 62, spd: 45 }, baseXp: 85, catchRate: 0.4, learn: L('ice', [[10, 'bubble']]),
    model: { shape: 'biped', scale: 0.7, body: 0x2a3a5a, accent: 0xffb030, dark: 0x1a2030, belly: 0xf8f8ff, extras: ['beak'] },
  },

  /* ------------------------------ bug ----------------------------- */
  beetlet: {
    name: 'Beetlet', type: 'bug', desc: 'A small beetle that dreams of growing a big horn.',
    base: { hp: 40, atk: 50, def: 55, spd: 40 }, baseXp: 55, catchRate: 0.5, learn: L('bug'),
    evolve: { level: 16, into: 'hornbeetle' },
    model: { shape: 'bug', scale: 0.7, body: 0x6a8a20, accent: 0xd0e060, dark: 0x2a3a10, belly: 0xa0b860, extras: [] },
  },
  hornbeetle: {
    name: 'Hornbeetle', type: 'bug', desc: 'Strong enough to lift a whole tree with its horn.',
    base: { hp: 70, atk: 95, def: 90, spd: 55 }, baseXp: 150, catchRate: 0.15, learn: L('bug', [[18, 'pebbleshot']]),
    model: { shape: 'bug', scale: 1.2, body: 0x2a4a8a, accent: 0xc0c0d0, dark: 0x101a30, belly: 0x5a7ab0, extras: ['horn'] },
  },
  flutterby: {
    name: 'Flutterby', type: 'bug', desc: 'Its wings sparkle with every colour of the rainbow.',
    base: { hp: 45, atk: 50, def: 40, spd: 85 }, baseXp: 75, catchRate: 0.4, learn: L('bug'), flies: true,
    model: { shape: 'bug', scale: 0.8, body: 0x3a3a3a, accent: 0xff9ad0, dark: 0x8a40c0, belly: 0x5a5a5a, extras: ['wings'] },
  },
  glowbug: {
    name: 'Glowbug', type: 'bug', desc: 'Its glowing tail lights the way for lost travellers.',
    base: { hp: 50, atk: 55, def: 50, spd: 70 }, baseXp: 80, catchRate: 0.4, learn: L('bug', [[12, 'spark']]), flies: true,
    model: { shape: 'bug', scale: 0.7, body: 0x3a3020, accent: 0xd0ff60, dark: 0x1a1a10, belly: 0x5a5030, extras: ['glow', 'wings'] },
  },

  /* ----------------------------- ghost ---------------------------- */
  wispurr: {
    name: 'Wispurr', type: 'ghost', desc: 'A ghostly cat that purrs in empty houses at night.',
    base: { hp: 40, atk: 60, def: 40, spd: 80 }, baseXp: 80, catchRate: 0.35, learn: L('ghost'), floats: true,
    evolve: { level: 22, into: 'phantomaw' },
    model: { shape: 'blob', scale: 0.7, body: 0x7a5aa0, accent: 0xc0a0ff, dark: 0x3a2a5a, belly: 0xb8a0e0, extras: ['ghost', 'catEars'] },
  },
  phantomaw: {
    name: 'Phantomaw', type: 'ghost', desc: 'A giant phantom with a huge grin. It loves to play tricks.',
    base: { hp: 70, atk: 100, def: 65, spd: 95 }, baseXp: 170, catchRate: 0.1, learn: L('ghost'), floats: true,
    model: { shape: 'blob', scale: 1.3, body: 0x4a2a6a, accent: 0xff60a0, dark: 0x1a0a2a, belly: 0x8a6ab0, extras: ['ghost', 'horns', 'grin'] },
  },
  snoozle: {
    name: 'Snoozle', type: 'ghost', desc: 'A sleepy spirit that drifts around while it dreams.',
    base: { hp: 60, atk: 50, def: 65, spd: 30 }, baseXp: 85, catchRate: 0.35, learn: L('ghost'), floats: true,
    model: { shape: 'blob', scale: 0.9, body: 0x9a8ac0, accent: 0xe0d8ff, dark: 0x4a3a6a, belly: 0xd8d0f0, extras: ['ghost', 'sleepy'] },
  },

  /* ------------------------------ mind ---------------------------- */
  thinkit: {
    name: 'Thinkit', type: 'mind', desc: 'Its big brain glows when it is solving a puzzle.',
    base: { hp: 40, atk: 58, def: 42, spd: 62 }, baseXp: 66, catchRate: 0.4, learn: L('mind'),
    evolve: { level: 20, into: 'cerebrix' },
    model: { shape: 'blob', scale: 0.7, body: 0xf3a6c8, accent: 0xff6fae, dark: 0x8a3a64, belly: 0xffe0ee, extras: ['brain', 'gem'] },
  },
  cerebrix: {
    name: 'Cerebrix', type: 'mind', desc: 'Can move boulders just by thinking about them.',
    base: { hp: 70, atk: 98, def: 65, spd: 92 }, baseXp: 165, catchRate: 0.12, learn: L('mind'),
    model: { shape: 'biped', scale: 1.1, body: 0xd97ab0, accent: 0xff6fae, dark: 0x6a2a50, belly: 0xffd0e6, extras: ['brain', 'gem'] },
  },
  owlucid: {
    name: 'Owlucid', type: 'mind', desc: 'A wise owl that always seems to know what you will do next.',
    base: { hp: 55, atk: 65, def: 55, spd: 75 }, baseXp: 95, catchRate: 0.35, learn: L('mind'), flies: true,
    model: { shape: 'bird', scale: 0.85, body: 0x8a6ab0, accent: 0xffd84a, dark: 0x4a3a6a, belly: 0xe8dcf8, extras: ['owl'] },
  },

  /* ------------------------------ metal --------------------------- */
  clanklet: {
    name: 'Clanklet', type: 'metal', desc: 'A tiny robot that collects lost screws and bolts.',
    base: { hp: 45, atk: 50, def: 70, spd: 35 }, baseXp: 66, catchRate: 0.4, learn: L('metal', [[10, 'spark']]),
    evolve: { level: 22, into: 'mechanox' },
    model: { shape: 'blob', scale: 0.7, body: 0xaab4be, accent: 0x4ad0ff, dark: 0x5a646e, belly: 0xd8dee4, extras: ['robot'] },
  },
  mechanox: {
    name: 'Mechanox', type: 'metal', desc: 'A giant robot guardian with armour no attack can dent.',
    base: { hp: 75, atk: 95, def: 120, spd: 40 }, baseXp: 170, catchRate: 0.1, learn: L('metal', [[10, 'spark']]),
    model: { shape: 'biped', scale: 1.25, body: 0x8a96a2, accent: 0x4ad0ff, dark: 0x4a545e, belly: 0xc8d0d8, extras: ['robot'] },
  },
  ironhorn: {
    name: 'Ironhorn', type: 'metal', desc: 'A rhino with skin of iron. It charges straight through walls.',
    base: { hp: 70, atk: 80, def: 95, spd: 35 }, baseXp: 115, catchRate: 0.25, learn: L('metal', [[16, 'rockslam']]),
    model: { shape: 'quad', scale: 1.05, body: 0x9aa6b2, accent: 0xe0e6ec, dark: 0x5a646e, belly: 0xb8c2cc, extras: ['rhinoHorn', 'ears'] },
  },

  /* ------------------------------ toxic --------------------------- */
  sludgy: {
    name: 'Sludgy', type: 'toxic', desc: 'A gooey blob. Do not let it hug you, it is very sticky.',
    base: { hp: 55, atk: 50, def: 50, spd: 30 }, baseXp: 62, catchRate: 0.45, learn: L('toxic'),
    evolve: { level: 20, into: 'gloopor' },
    model: { shape: 'blob', scale: 0.75, body: 0x9a5ac0, accent: 0xc8ff5a, dark: 0x4a2a6a, belly: 0xc89ae0, extras: ['slime'] },
  },
  gloopor: {
    name: 'Gloopor', type: 'toxic', desc: 'A huge pile of goo with a crown of bubbles. Flowers wilt near it.',
    base: { hp: 95, atk: 85, def: 75, spd: 45 }, baseXp: 160, catchRate: 0.12, learn: L('toxic'),
    model: { shape: 'blob', scale: 1.35, body: 0x7a3aa0, accent: 0xc8ff5a, dark: 0x3a1a5a, belly: 0xb07ad0, extras: ['slime', 'bubbles'] },
  },
  hissyfang: {
    name: 'Hissyfang', type: 'toxic', desc: 'A grumpy snake with glowing green fangs.',
    base: { hp: 50, atk: 75, def: 50, spd: 75 }, baseXp: 100, catchRate: 0.3, learn: L('toxic'),
    model: { shape: 'serpent', scale: 0.9, body: 0x6a3a8a, accent: 0xa8f040, dark: 0x2a1a3a, belly: 0xc8a8e0, extras: ['fangs', 'spikes'] },
  },

  /* ------------------------------ pixie --------------------------- */
  twinklet: {
    name: 'Twinklet', type: 'pixie', desc: 'A tiny sprite that sprinkles glitter wherever it flies.',
    base: { hp: 45, atk: 45, def: 50, spd: 65 }, baseXp: 64, catchRate: 0.4, learn: L('pixie'), floats: true,
    evolve: { level: 18, into: 'starbelle' },
    model: { shape: 'blob', scale: 0.6, body: 0xffd0ec, accent: 0xfff0a0, dark: 0xc06aa0, belly: 0xffffff, extras: ['pixieWings', 'gem'] },
  },
  starbelle: {
    name: 'Starbelle', type: 'pixie', desc: 'Dances under the moon. Its wand can grant small wishes.',
    base: { hp: 75, atk: 80, def: 75, spd: 85 }, baseXp: 155, catchRate: 0.12, learn: L('pixie'),
    model: { shape: 'biped', scale: 0.95, body: 0xffb8e6, accent: 0xfff0a0, dark: 0xd070b0, belly: 0xffe8f6, extras: ['pixieWings', 'starHead'] },
  },
  petalfae: {
    name: 'Petalfae', type: 'pixie', desc: 'Hides inside flowers and giggles at people walking by.',
    base: { hp: 45, atk: 55, def: 45, spd: 85 }, baseXp: 85, catchRate: 0.35, learn: L('pixie', [[10, 'leafcut']]), flies: true,
    model: { shape: 'bug', scale: 0.75, body: 0x7ac06a, accent: 0xffa8d8, dark: 0x3a6a3a, belly: 0xa8e098, extras: ['wings'] },
  },

  /* ------------------------------ drake --------------------------- */
  scalekin: {
    name: 'Scalekin', type: 'drake', desc: 'A baby drake. It practises roaring but only manages a squeak.',
    base: { hp: 45, atk: 65, def: 50, spd: 50 }, baseXp: 70, catchRate: 0.3, learn: L('drake'),
    evolve: { level: 24, into: 'scalewing' },
    model: { shape: 'quad', scale: 0.8, body: 0x6a7ae0, accent: 0xffd84a, dark: 0x2a3a8a, belly: 0xc8d0ff, extras: ['dragonHorns', 'spikes', 'smallWings'] },
  },
  scalewing: {
    name: 'Scalewing', type: 'drake', desc: 'A mighty drake. Its wings stir up storms when it takes off.',
    base: { hp: 90, atk: 110, def: 85, spd: 85 }, baseXp: 185, catchRate: 0.08, learn: L('drake'),
    model: { shape: 'quad', scale: 1.45, body: 0x4a5ac8, accent: 0xffd84a, dark: 0x1a2a6a, belly: 0xb0c0ff, extras: ['dragonHorns', 'spikes', 'bigWings'] },
  },
  skywyrm: {
    name: 'Skywyrm', type: 'drake', desc: 'A legendary sky serpent said to live above the clouds.',
    base: { hp: 80, atk: 100, def: 80, spd: 100 }, baseXp: 180, catchRate: 0.08, learn: L('drake'), flies: true,
    model: { shape: 'serpent', scale: 1.3, body: 0x3ab0a0, accent: 0xffd84a, dark: 0x1a5a50, belly: 0xc0f0e8, extras: ['whiskers', 'spikes', 'dragonHorns'] },
  },

  /* ----------------------------- rainbow -------------------------- */
  prismkit: {
    name: 'Prismkit', type: 'rainbow', desc: 'A very rare kitten whose fur shimmers in every colour.',
    base: { hp: 50, atk: 60, def: 50, spd: 75 }, baseXp: 90, catchRate: 0.25, learn: L('rainbow'),
    evolve: { level: 25, into: 'spectrion' },
    model: { shape: 'quad', scale: 0.7, body: 0xffffff, accent: 0xffffff, dark: 0xdddddd, belly: 0xffffff, extras: ['ears', 'fluffyTail', 'whiskers', 'rainbow'] },
  },
  spectrion: {
    name: 'Spectrion', type: 'rainbow', desc: 'Legends say a rainbow appears in the sky wherever it runs.',
    base: { hp: 85, atk: 100, def: 80, spd: 105 }, baseXp: 190, catchRate: 0.06, learn: L('rainbow'),
    model: { shape: 'quad', scale: 1.3, body: 0xffffff, accent: 0xffffff, dark: 0xdddddd, belly: 0xffffff, extras: ['ears', 'fluffyTail', 'mane', 'rainbow'] },
  },
  rainwing: {
    name: 'Rainwing', type: 'rainbow', desc: 'A shy bird that only comes out when the sun is shining.',
    base: { hp: 60, atk: 70, def: 55, spd: 95 }, baseXp: 120, catchRate: 0.2, learn: L('rainbow'), flies: true,
    model: { shape: 'bird', scale: 0.9, body: 0xffffff, accent: 0xffffff, dark: 0xdddddd, belly: 0xffffff, extras: ['rainbow'] },
  },
};

export const STARTERS = ['emberpup', 'sproutle', 'bubbuck'];

// Weighted spawn tables per biome. A third entry limits a spawn to 'day' or 'night'.
export const SPAWNS = {
  plains: [['fluffin', 5], ['zapple', 3], ['sproutle', 2], ['emberpup', 1], ['hopsy', 4], ['chirpit', 4, 'day'],
    ['ampup', 2], ['beetlet', 2, 'day'], ['voltwing', 1], ['sparkitten', 1], ['bounceroo', 0.3],
    ['wispurr', 3, 'night'], ['snoozle', 2, 'night'], ['glowbug', 2, 'night'],
    ['thinkit', 2], ['owlucid', 2, 'night'], ['twinklet', 2, 'day'], ['sludgy', 1], ['prismkit', 0.25, 'day'], ['rainwing', 0.2, 'day']],
  forest: [['sproutle', 4], ['thornox', 2], ['fluffin', 1], ['zapple', 1], ['budling', 3], ['mossloth', 2],
    ['beetlet', 3], ['flutterby', 3, 'day'], ['chirpit', 2, 'day'], ['hornbeetle', 0.4], ['bloomora', 0.3],
    ['wispurr', 3, 'night'], ['glowbug', 3, 'night'], ['phantomaw', 0.4, 'night'],
    ['sludgy', 3], ['hissyfang', 2], ['gloopor', 0.3], ['twinklet', 2, 'day'], ['petalfae', 3, 'day'],
    ['owlucid', 3, 'night'], ['starbelle', 0.3, 'night'], ['prismkit', 0.25, 'day']],
  beach: [['bubbuck', 4], ['emberpup', 2], ['zapple', 1], ['shellby', 4], ['gullop', 3], ['sparkitten', 2],
    ['clanklet', 1], ['rainwing', 0.3, 'day']],
  water: [['bubbuck', 2], ['ripplet', 3], ['joltail', 2], ['shellby', 1], ['gullop', 1], ['torrentide', 0.3]],
  mountain: [['pebblor', 5], ['flarehawk', 2], ['zapple', 1], ['magmole', 3], ['cragtusk', 2], ['geodrake', 2],
    ['monolor', 0.4], ['pyrolynx', 0.3], ['snoozle', 2, 'night'],
    ['clanklet', 3], ['ironhorn', 2], ['mechanox', 0.3], ['thinkit', 1], ['cerebrix', 0.2],
    ['scalekin', 1], ['scalewing', 0.1], ['skywyrm', 0.15], ['rainwing', 0.2, 'day']],
  snow: [['frostling', 4], ['snowpaw', 3], ['waddlice', 3], ['geodrake', 1], ['glacieron', 0.5], ['wispurr', 1, 'night'],
    ['ironhorn', 1], ['scalekin', 1.5], ['skywyrm', 0.3], ['prismkit', 0.2, 'day']],
};

export const xpForLevel = L => Math.floor(0.6 * L * L * L);

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

function eyes(parent, y, z, spread, size = 0.13, closed = false) {
  for (const s of [-1, 1]) {
    if (closed) {
      box(parent, size * 1.1, 0.03, 0.03, 0x222222, s * spread, y - 0.02, z + 0.01).userData.eye = true;
      continue;
    }
    box(parent, size, size * 1.15, 0.04, 0xffffff, s * spread, y, z).userData.eye = true;
    box(parent, size * 0.55, size * 0.7, 0.03, 0x111111, s * spread + s * size * 0.12, y - 0.01, z + 0.03).userData.eye = true;
  }
}

function glow(mesh, color) {
  mesh.material.emissive = new THREE.Color(color);
  return mesh;
}

function zigzag(parent, color, x, y, z, size = 1) {
  box(parent, 0.1 * size, 0.22 * size, 0.08 * size, color, x, y, z);
  box(parent, 0.1 * size, 0.08 * size, 0.22 * size, color, x, y + 0.13 * size, z - 0.07 * size);
  box(parent, 0.1 * size, 0.22 * size, 0.08 * size, color, x, y + 0.25 * size, z - 0.15 * size);
}

// A pair of flat wings on pivots so they can flap.
// Upright wings (pixies) stand in the x-y plane; others are flat and raised by `lift` radians.
function addWings(parts, parent, m, x, y, z, w, d, color, tipColor, { lift = 0, upright = false } = {}) {
  parts.wings = parts.wings || [];
  for (const s of [-1, 1]) {
    const g = pivot(parent, s * x, y, z);
    if (upright) {
      box(g, w, d, 0.04, color, s * w / 2, d / 3, 0);
      if (tipColor !== undefined) box(g, w * 0.6, d * 0.5, 0.03, tipColor, s * w * 0.4, -d * 0.25, 0.01);
    } else {
      box(g, w, 0.05, d, color, s * w / 2, 0, 0);
      if (tipColor !== undefined) box(g, w * 0.45, 0.04, d * 0.7, tipColor, s * w * 0.85, 0.01, -d * 0.1);
    }
    g.rotation.z = s * lift;
    parts.wings.push({ g, s, lift });
  }
}

// Glowing gem on the forehead.
function gem(parent, m, y, z) {
  return glow(box(parent, 0.12, 0.12, 0.05, m.accent, 0, y, z), m.accent);
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
  if (has('longEars')) {
    for (const s of [-1, 1]) {
      box(head, 0.12, 0.5, 0.08, m.body, s * 0.13, 0.46, -0.05);
      box(head, 0.06, 0.38, 0.02, m.accent, s * 0.13, 0.46, -0.004);
    }
  }
  if (has('whiskers')) {
    for (const s of [-1, 1]) for (const dy of [-0.08, -0.14]) box(head, 0.22, 0.02, 0.02, 0x222222, s * 0.3, dy, 0.38);
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
  if (has('rhinoHorn')) {
    const h = box(head, 0.12, 0.34, 0.12, m.accent, 0, 0.08, 0.42);
    h.rotation.x = 0.5;
    box(head, 0.08, 0.16, 0.08, m.accent, 0, 0.26, 0.28);
  }
  if (has('dragonHorns')) {
    for (const s of [-1, 1]) {
      const h = box(head, 0.08, 0.3, 0.08, m.accent, s * 0.16, 0.32, -0.12);
      h.rotation.x = -0.6;
    }
  }
  if (has('smallWings')) addWings(parts, root, m, 0.3, bodyY + 0.25, 0.05, 0.4, 0.32, m.dark, m.accent, { lift: 0.6 });
  if (has('bigWings')) addWings(parts, root, m, 0.3, bodyY + 0.3, 0, 0.95, 0.65, m.dark, m.accent, { lift: 0.55 });
  if (has('tusks')) {
    for (const s of [-1, 1]) {
      const t = box(head, 0.07, 0.24, 0.07, m.accent, s * 0.16, -0.08, 0.46);
      t.rotation.x = -0.5;
    }
  }
  if (has('mane')) {
    box(root, 0.86, 0.62, 0.3, m.accent, 0, bodyY + 0.12, 0.38);
    box(head, 0.6, 0.12, 0.3, m.accent, 0, 0.3, -0.05);
  }
  if (has('spikes')) {
    for (const z of [0.25, 0, -0.25]) box(root, 0.12, 0.2, 0.12, m.accent, 0, bodyY + 0.32, z);
  }
  if (has('shell')) {
    box(root, 0.86, 0.36, 1.0, m.accent, 0, bodyY + 0.22, -0.02);
    box(root, 0.6, 0.1, 0.7, m.dark, 0, bodyY + 0.42, -0.02);
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
  } else if (has('fluffyTail')) {
    const t = box(tail, 0.26, 0.26, 0.55, m.body, 0, 0.15, -0.25);
    t.rotation.x = -0.5;
    box(tail, 0.2, 0.2, 0.2, m.accent, 0, 0.36, -0.5);
  } else if (has('boltTail')) {
    zigzag(tail, m.accent, 0, 0, -0.05, 1.4);
  } else if (has('puffTail') || has('wool')) {
    box(tail, 0.22, 0.22, 0.16, has('puffTail') ? m.belly : m.body, 0, 0.05, -0.04);
  } else if (!frog) {
    const t = box(tail, 0.12, 0.12, 0.38, m.dark, 0, 0.05, -0.18);
    t.rotation.x = -0.5;
  }
}

function buildBlob(root, m, parts) {
  const has = e => m.extras.includes(e);
  const ghost = has('ghost');
  const bodyGroup = pivot(root, 0, 0, 0);
  parts.bounce = bodyGroup;
  box(bodyGroup, 0.72, 0.64, 0.72, m.body, 0, 0.4, 0);
  box(bodyGroup, 0.5, 0.3, 0.04, m.belly, 0, 0.3, 0.36);
  eyes(bodyGroup, 0.5, 0.37, 0.16, 0.15, has('sleepy'));
  if (has('grin')) {
    box(bodyGroup, 0.44, 0.1, 0.03, 0x111111, 0, 0.3, 0.37);
    for (const x of [-0.15, -0.05, 0.05, 0.15]) box(bodyGroup, 0.06, 0.05, 0.03, 0xffffff, x, 0.33, 0.38);
  } else {
    box(bodyGroup, 0.14, 0.04, 0.03, 0x2a2a2a, 0, 0.36, 0.38);
  }
  if (ghost) {
    // Wavy, foot-less bottom.
    for (const [x, z] of [[-0.24, 0.2], [0.24, 0.2], [0, -0.22], [-0.24, -0.2], [0.24, -0.2]]) {
      box(bodyGroup, 0.2, 0.16, 0.2, m.body, x, 0.02, z);
    }
  } else {
    for (const s of [-1, 1]) box(bodyGroup, 0.2, 0.1, 0.28, m.dark, s * 0.2, 0.05, 0.04);
  }

  if (has('fin')) {
    box(bodyGroup, 0.08, 0.3, 0.34, m.accent, 0, 0.82, -0.05);
    parts.tail = box(bodyGroup, 0.36, 0.3, 0.06, m.accent, 0, 0.42, -0.42);
  }
  if (has('crown')) {
    for (const x of [-0.22, 0, 0.22]) box(bodyGroup, 0.1, x === 0 ? 0.3 : 0.2, 0.1, 0xffd34a, x, 0.82 + (x === 0 ? 0.05 : 0), 0.15);
  }
  if (has('antenna')) {
    box(bodyGroup, 0.05, 0.32, 0.05, m.dark, 0, 0.87, 0);
    parts.tip = glow(box(bodyGroup, 0.13, 0.13, 0.13, 0xfff7c0, 0, 1.06, 0), 0x998800);
    zigzag(bodyGroup, m.dark, 0, 0.35, -0.4);
  }
  if (has('cheeks')) {
    for (const s of [-1, 1]) box(bodyGroup, 0.12, 0.09, 0.03, m.accent, s * 0.25, 0.36, 0.37);
  }
  if (has('flower')) {
    box(bodyGroup, 0.05, 0.2, 0.05, m.dark, 0, 0.82, 0);
    for (const [x, z] of [[0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]]) box(bodyGroup, 0.14, 0.05, 0.14, m.accent, x, 0.94, z);
    box(bodyGroup, 0.1, 0.07, 0.1, 0xffe040, 0, 0.96, 0);
  }
  if (has('iceSpikes')) {
    for (const [x, z, h] of [[-0.2, 0, 0.26], [0, 0.05, 0.38], [0.2, -0.05, 0.22], [0.05, -0.2, 0.28]]) {
      box(bodyGroup, 0.1, h, 0.1, m.accent, x, 0.72 + h / 2, z);
    }
  }
  if (has('catEars')) {
    for (const s of [-1, 1]) box(bodyGroup, 0.16, 0.18, 0.08, m.dark, s * 0.22, 0.8, 0.1);
    const tail = box(bodyGroup, 0.08, 0.36, 0.08, m.body, 0.1, 0.45, -0.42);
    tail.rotation.z = 0.4;
    parts.tail = tail;
  }
  if (has('horns')) {
    for (const s of [-1, 1]) {
      const h = box(bodyGroup, 0.1, 0.32, 0.1, m.accent, s * 0.26, 0.86, 0);
      h.rotation.z = -s * 0.35;
    }
  }
  if (has('brain')) {
    for (const [x, z, w] of [[-0.16, 0, 0.3], [0.16, 0, 0.3], [0, -0.12, 0.34], [0, 0.12, 0.3]]) box(bodyGroup, w, 0.18, w, m.accent, x, 0.8, z);
  }
  if (has('gem')) gem(bodyGroup, m, 0.66, 0.37);
  if (has('robot')) {
    box(bodyGroup, 0.5, 0.16, 0.03, 0x1a2a3a, 0, 0.5, 0.365);
    for (const sx of [-0.12, 0.12]) glow(box(bodyGroup, 0.12, 0.07, 0.02, m.accent, sx, 0.5, 0.38), m.accent);
    box(bodyGroup, 0.04, 0.26, 0.04, m.dark, 0, 0.85, 0);
    parts.tip = glow(box(bodyGroup, 0.1, 0.1, 0.1, 0xff4a4a, 0, 1.0, 0), 0x880000);
    for (const [x, y] of [[-0.3, 0.2], [0.3, 0.2], [-0.3, 0.6], [0.3, 0.6]]) box(bodyGroup, 0.05, 0.05, 0.03, m.dark, x, y, 0.365);
  }
  if (has('slime')) {
    for (const [x, z, h] of [[-0.3, 0.3, 0.18], [0.28, 0.32, 0.24], [0.1, 0.36, 0.14], [-0.2, -0.34, 0.2]]) {
      box(bodyGroup, 0.12, h, 0.08, m.body, x, 0.12 + h / 2 - 0.1, z);
    }
    box(bodyGroup, 0.86, 0.12, 0.86, m.body, 0, 0.08, 0);
  }
  if (has('bubbles')) {
    for (const [x, z, sz] of [[-0.2, 0.05, 0.16], [0.18, -0.05, 0.2], [0, 0.18, 0.12]]) glow(box(bodyGroup, sz, sz, sz, m.accent, x, 0.82 + sz / 2, z), 0x446600);
  }
  if (has('pixieWings')) addWings(parts, bodyGroup, m, 0.2, 0.55, -0.38, 0.45, 0.5, m.accent, m.dark, { upright: true });
  if (ghost) parts.float = true;
}

function buildBiped(root, m, parts) {
  const has = e => m.extras.includes(e);
  box(root, 0.8, 0.7, 0.62, m.body, 0, 0.85, 0);
  box(root, 0.5, 0.36, 0.04, m.belly, 0, 0.8, 0.32);
  const head = pivot(root, 0, 1.38, 0.04);
  parts.head = head;
  box(head, 0.52, 0.4, 0.46, m.body, 0, 0, 0);
  eyes(head, 0.03, 0.24, 0.12, 0.11);
  if (has('beak')) {
    box(head, 0.18, 0.08, 0.16, m.accent, 0, -0.08, 0.3);
    box(head, 0.42, 0.24, 0.04, m.belly, 0, -0.02, 0.23);
    eyes(head, 0.03, 0.26, 0.12, 0.11);
  } else {
    box(head, 0.3, 0.06, 0.04, 0x3a3630, 0, -0.1, 0.24);
  }
  if (has('moss')) {
    box(head, 0.4, 0.08, 0.36, m.accent, 0, 0.23, 0);
    box(root, 0.3, 0.1, 0.3, m.accent, 0.2, 1.24, -0.1);
  }
  if (has('lava')) {
    for (const [x, y] of [[-0.2, 1.0], [0.15, 0.75], [0.25, 1.05]]) glow(box(root, 0.18, 0.06, 0.04, m.accent, x, y, 0.32), 0xff4400);
    glow(box(head, 0.2, 0.05, 0.04, m.accent, 0.1, 0.12, 0.235), 0xff4400);
  }
  if (has('flowerHead')) {
    for (const [x, z] of [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18], [0.13, 0.13], [-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13]]) {
      box(head, 0.16, 0.06, 0.16, m.accent, x, 0.25, z);
    }
    box(head, 0.14, 0.08, 0.14, 0xffe040, 0, 0.28, 0);
  }
  if (has('longEars')) {
    for (const s of [-1, 1]) box(head, 0.12, 0.42, 0.08, m.body, s * 0.15, 0.38, -0.05);
  }
  if (has('spikes')) {
    for (const [x, y] of [[-0.25, 1.25], [0.25, 1.25], [0, 1.3]]) box(root, 0.14, 0.2, 0.14, m.dark, x, y, -0.24);
  }
  if (has('brain')) {
    for (const [x, z, w] of [[-0.12, 0, 0.24], [0.12, 0, 0.24], [0, -0.1, 0.28]]) box(head, w, 0.16, w, m.accent, x, 0.27, z);
  }
  if (has('gem')) gem(head, m, 0.12, 0.25);
  if (has('robot')) {
    box(head, 0.44, 0.12, 0.03, 0x1a2a3a, 0, 0.04, 0.24);
    glow(box(head, 0.36, 0.05, 0.02, m.accent, 0, 0.04, 0.255), m.accent);
    box(head, 0.04, 0.22, 0.04, m.dark, 0.16, 0.3, 0);
    parts.tip = glow(box(head, 0.09, 0.09, 0.09, 0xff4a4a, 0.16, 0.44, 0), 0x880000);
    glow(box(root, 0.24, 0.24, 0.04, m.accent, 0, 0.92, 0.33), m.accent);
  }
  if (has('pixieWings')) addWings(parts, root, m, 0.15, 1.05, -0.33, 0.55, 0.6, m.accent, m.dark, { upright: true });
  if (has('starHead')) {
    for (const [x, y] of [[0, 0.36], [-0.14, 0.28], [0.14, 0.28]]) glow(box(head, 0.12, 0.12, 0.06, m.accent, x, y, 0), 0x666600);
  }
  if (has('crystal')) {
    for (const s of [-1, 1]) {
      const c = box(root, 0.16, 0.42, 0.16, m.accent, s * 0.42, 1.38, -0.05);
      c.rotation.z = -s * 0.3;
    }
    box(head, 0.12, 0.3, 0.12, m.accent, 0, 0.3, 0);
  }
  if (has('tail')) {
    const t = box(root, 0.2, 0.2, 0.7, m.body, 0, 0.45, -0.55);
    t.rotation.x = 0.5;
  }
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(root, s * 0.52, 1.12, 0);
    box(arm, 0.26, 0.62, 0.28, has('leafy') ? m.accent : m.dark, 0, -0.27, 0);
    if (has('claws')) for (const dx of [-0.07, 0.07]) box(arm, 0.05, 0.12, 0.05, 0xeeeeee, dx, -0.63, 0.1);
    if (has('gloves')) box(arm, 0.32, 0.26, 0.32, m.accent, 0, -0.62, 0);
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
  const has = e => m.extras.includes(e);
  const bodyGroup = pivot(root, 0, 0, 0);
  parts.bounce = bodyGroup;
  box(bodyGroup, 0.46, 0.42, 0.62, m.body, 0, 0.7, 0);
  box(bodyGroup, 0.36, 0.3, 0.04, m.belly, 0, 0.66, 0.31);
  const head = pivot(bodyGroup, 0, 1.0, 0.28);
  box(head, 0.36, 0.34, 0.34, m.body, 0, 0, 0);
  box(head, 0.12, 0.1, 0.18, m.accent, 0, -0.04, 0.24);
  eyes(head, 0.05, 0.175, 0.1, 0.1);
  if (has('owl')) {
    for (const s of [-1, 1]) box(head, 0.08, 0.16, 0.06, m.dark, s * 0.13, 0.22, 0);
    for (const s of [-1, 1]) box(head, 0.14, 0.14, 0.02, m.accent, s * 0.09, 0.05, 0.172);
  } else {
    box(head, 0.08, 0.2, 0.22, m.accent, 0, 0.22, -0.08);
  }
  parts.wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(bodyGroup, s * 0.23, 0.8, 0);
    box(w, 0.55, 0.06, 0.42, m.dark, s * 0.27, 0, 0);
    box(w, 0.25, 0.05, 0.3, m.accent, s * 0.6, 0, -0.05);
    if (has('bolt')) box(w, 0.4, 0.07, 0.06, m.accent, s * 0.3, 0.01, 0.1);
    parts.wings.push({ g: w, s });
  }
  const tail = box(bodyGroup, 0.32, 0.06, 0.34, m.accent, 0, 0.72, -0.44);
  tail.rotation.x = 0.25;
  for (const s of [-1, 1]) box(bodyGroup, 0.06, 0.5, 0.06, 0x6b4a2b, s * 0.12, 0.25, 0);
}

function buildSerpent(root, m, parts) {
  const has = e => m.extras.includes(e);
  parts.segments = [];
  for (let i = 0; i < 5; i++) {
    const size = 0.42 - i * 0.05;
    const seg = pivot(root, 0, size / 2 + 0.02, -0.05 - i * 0.3);
    box(seg, size, size, 0.34, m.body, 0, 0, 0);
    box(seg, size * 0.8, 0.04, 0.32, m.belly, 0, -size / 2, 0);
    if (has('spikes')) box(seg, 0.08, 0.16, 0.12, m.accent, 0, size / 2 + 0.06, 0);
    if (has('bolt') && i % 2 === 0) for (const s of [-1, 1]) box(seg, 0.02, size * 0.5, 0.2, m.accent, s * size / 2, 0, 0);
    if (i === 4) {
      const fin = box(seg, 0.06, 0.34, 0.3, has('fins') ? m.accent : m.dark, 0, 0.08, -0.25);
      fin.rotation.x = -0.3;
    }
    parts.segments.push({ g: seg, i, x0: 0 });
  }
  const head = pivot(root, 0, 0.42, 0.3);
  parts.head = head;
  box(head, 0.5, 0.42, 0.5, m.body, 0, 0, 0);
  box(head, 0.36, 0.12, 0.2, m.belly, 0, -0.14, 0.26);
  eyes(head, 0.08, 0.26, 0.14, 0.13);
  if (has('fins')) for (const s of [-1, 1]) {
    const f = box(head, 0.06, 0.26, 0.24, m.accent, s * 0.28, 0.12, -0.1);
    f.rotation.z = -s * 0.5;
  }
  if (has('whiskers')) for (const s of [-1, 1]) {
    const w = box(head, 0.36, 0.03, 0.03, m.accent, s * 0.36, -0.1, 0.2);
    w.rotation.z = s * 0.3;
  }
  if (has('bolt')) zigzag(head, m.accent, 0, 0.24, 0.05);
  if (has('fangs')) for (const s of [-1, 1]) glow(box(head, 0.05, 0.12, 0.05, m.accent, s * 0.1, -0.24, 0.24), 0x335500);
  if (has('dragonHorns')) for (const s of [-1, 1]) {
    const h = box(head, 0.08, 0.3, 0.08, m.accent, s * 0.15, 0.3, -0.15);
    h.rotation.x = -0.6;
  }
  if (has('spikes')) for (const s of [-1, 1]) box(head, 0.08, 0.22, 0.08, m.accent, s * 0.14, 0.3, -0.1);
}

function buildBug(root, m, parts) {
  const has = e => m.extras.includes(e);
  const abdomen = box(root, 0.55, 0.4, 0.6, m.body, 0, 0.42, -0.35);
  box(root, 0.5, 0.06, 0.56, m.accent, 0, 0.64, -0.35);
  box(root, 0.45, 0.35, 0.4, m.body, 0, 0.42, 0.1);
  const head = pivot(root, 0, 0.48, 0.42);
  parts.head = head;
  box(head, 0.38, 0.32, 0.3, m.dark, 0, 0, 0);
  eyes(head, 0.04, 0.16, 0.1, 0.11);
  for (const s of [-1, 1]) {
    const a = box(head, 0.03, 0.3, 0.03, m.dark, s * 0.1, 0.28, 0.05);
    a.rotation.x = 0.4;
    box(head, 0.07, 0.07, 0.07, m.accent, s * 0.1, 0.42, 0.11);
  }
  if (has('horn')) {
    const h = box(head, 0.1, 0.45, 0.1, m.accent, 0, 0.25, 0.18);
    h.rotation.x = 0.5;
    box(head, 0.18, 0.08, 0.08, m.accent, 0, 0.45, 0.3);
  }
  if (has('glow')) parts.tip = glow(box(root, 0.4, 0.3, 0.12, m.accent, 0, 0.42, -0.7), 0x88aa00);
  if (has('wings')) {
    parts.wings = [];
    for (const s of [-1, 1]) {
      const w = pivot(root, s * 0.15, 0.68, -0.05);
      box(w, 0.7, 0.04, 0.55, m.accent, s * 0.38, 0, 0.05);
      box(w, 0.4, 0.04, 0.35, m.dark, s * 0.3, -0.01, -0.35);
      parts.wings.push({ g: w, s });
    }
  }
  parts.legs = [];
  for (const [sz, phase] of [[0.2, 0], [0, Math.PI], [-0.25, 0]]) {
    for (const s of [-1, 1]) {
      const leg = pivot(root, s * 0.25, 0.32, sz);
      const b = box(leg, 0.28, 0.06, 0.06, m.dark, s * 0.12, -0.08, 0);
      b.rotation.z = s * -0.6;
      parts.legs.push({ g: leg, phase: phase + (s > 0 ? Math.PI : 0), side: true });
    }
  }
  parts.abdomen = abdomen;
}

export function buildModel(species) {
  const sp = SPECIES[species];
  const m = sp.model;
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  const parts = { root };
  ({ quad: buildQuad, blob: buildBlob, biped: buildBiped, bird: buildBird, serpent: buildSerpent, bug: buildBug })[m.shape](root, m, parts);
  if (m.extras.includes('rainbow')) {
    // Each block gets its own colour from the rainbow; animateModel makes the colours flow.
    parts.rainbow = [];
    let i = 0;
    group.traverse(o => {
      if (o.isMesh && !o.userData.eye) parts.rainbow.push({ mat: o.material, offset: (i++ * 0.13) % 1 });
    });
    for (const r of parts.rainbow) r.mat.color.setHSL(r.offset, 0.75, 0.62);
  }
  if (parts.float) {
    group.traverse(o => {
      if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.82; }
    });
  }
  root.scale.setScalar(m.scale);
  group.userData.parts = parts;
  group.userData.species = species;
  return group;
}

// Procedural idle/walk animation.
export function animateModel(group, t, moving) {
  const p = group.userData.parts;
  for (const leg of p.legs || []) {
    const a = Math.sin(t * (leg.side ? 16 : 10) + leg.phase) * (moving ? 0.6 : 0);
    if (leg.side) leg.g.rotation.y = a * 0.6; else leg.g.rotation.x = a;
  }
  for (const arm of p.arms || []) arm.g.rotation.x = Math.sin(t * 6 + arm.phase) * (moving ? 0.5 : 0.08);
  if (p.tail) p.tail.rotation.y = Math.sin(t * (moving ? 12 : 4)) * 0.35;
  if (p.head) p.head.rotation.x = moving ? 0 : Math.sin(t * 1.5) * 0.06;
  if (p.bounce) {
    if (p.float) {
      p.bounce.position.y = 0.35 + Math.sin(t * 2) * 0.12;
    } else {
      const hop = moving ? Math.abs(Math.sin(t * 7)) * 0.18 : Math.abs(Math.sin(t * 2.2)) * 0.04;
      p.bounce.position.y = hop;
      p.bounce.scale.set(1 + (0.18 - hop) * 0.2, 1 - (0.18 - hop) * 0.15, 1 + (0.18 - hop) * 0.2);
    }
  }
  for (const s of p.segments || []) s.g.position.x = Math.sin(t * (moving ? 8 : 3) - s.i * 0.9) * (moving ? 0.14 : 0.05) * s.i * 0.5;
  for (const w of p.wings || []) w.g.rotation.z = w.s * ((w.lift || 0) + Math.sin(t * (moving ? 14 : 4)) * (moving ? 0.7 : 0.25));
  if (p.tip) p.tip.material.emissive.setScalar(0.4 + 0.4 * Math.abs(Math.sin(t * 5)));
  for (const r of p.rainbow || []) r.mat.color.setHSL((r.offset + t * 0.15) % 1, 0.75, 0.62);
  if (p.root && !p.bounce) p.root.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.03 : 0;
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
