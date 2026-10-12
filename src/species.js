// Creature data (types, moves, species), stat/XP math and blocky 3D models.
import * as THREE from 'three';
import { SHAPES, box, pivot, eyes, glow, zigzag, addWings, gem, mushroomCap } from './shapes.js';

export const TYPE_COLORS = {
  normal: '#c6c59a', fire: '#f2914a', water: '#7aa4f5', grass: '#8fd166', electric: '#f7d84a', rock: '#c9b45a',
  ice: '#9fe0f0', bug: '#b5c84a', ghost: '#a48ad0',
  mind: '#f584b8', metal: '#b8c4cf', toxic: '#b36ad6', pixie: '#ffb8e6', drake: '#7f6cf0',
  rainbow: 'linear-gradient(90deg,#ff7a7a,#ffd36b,#8fe388,#7ab8ff,#c99bff)',
  cosmic: 'linear-gradient(90deg,#8e9bff,#e7c6ff)', sound: '#4fd8c4',
  bone: '#e9e0c9', alien: 'linear-gradient(90deg,#8dff6a,#b98cff)',
};

// attacker type -> defender type -> multiplier (missing = 1)
const EFFECTIVENESS = {
  normal: { rock: 0.5, metal: 0.5, ghost: 0, bone: 0.5 },
  fire: { grass: 2, ice: 2, bug: 2, metal: 2, fire: 0.5, water: 0.5, rock: 0.5, drake: 0.5, rainbow: 0.5 },
  water: { fire: 2, rock: 2, bone: 2, water: 0.5, grass: 0.5, drake: 0.5, rainbow: 0.5 },
  grass: { water: 2, rock: 2, fire: 0.5, grass: 0.5, bug: 0.5, metal: 0.5, toxic: 0.5, drake: 0.5 },
  electric: { water: 2, sound: 2, alien: 2, bone: 0.5, electric: 0.5, grass: 0.5, rock: 0.5, drake: 0.5 },
  rock: { fire: 2, electric: 2, ice: 2, bug: 2, grass: 0.5, metal: 0.5 },
  ice: { grass: 2, bug: 2, drake: 2, fire: 0.5, water: 0.5, ice: 0.5, metal: 0.5 },
  bug: { grass: 2, mind: 2, ghost: 0.5, fire: 0.5, rock: 0.5, metal: 0.5, pixie: 0.5 },
  ghost: { ghost: 2, mind: 2, rainbow: 2, cosmic: 2, normal: 0 },
  // New types
  mind: { toxic: 2, drake: 2, cosmic: 2, mind: 0.5, metal: 0.5, alien: 0.5 },
  metal: { ice: 2, rock: 2, pixie: 2, metal: 0.5, fire: 0.5, water: 0.5, electric: 0.5 },
  toxic: { grass: 2, pixie: 2, toxic: 0.5, rock: 0.5, ghost: 0.5, bone: 0.5, metal: 0 },
  pixie: { drake: 2, ghost: 2, fire: 0.5, metal: 0.5, toxic: 0.5 },
  drake: { drake: 2, bone: 2, metal: 0.5, pixie: 0 },
  rainbow: { ghost: 2, toxic: 2, mind: 2, metal: 0.5, rainbow: 0.5 },
  // Cosmic beats sound, sound beats mind, mind beats cosmic.
  cosmic: { rock: 2, drake: 2, sound: 2, metal: 0.5, cosmic: 0.5, rainbow: 0.5, alien: 0.5 },
  sound: { ice: 2, bug: 2, mind: 2, alien: 2, metal: 0.5, sound: 0.5, cosmic: 0.5 },
  // Bone and Alien: skeletons are not scared of ghosts or aliens; aliens love normal creatures' surprise.
  bone: { ghost: 2, electric: 2, alien: 2, metal: 0.5, grass: 0.5 },
  alien: { normal: 2, metal: 2, toxic: 2, cosmic: 0.5, alien: 0.5 },
};
export const effectiveness = (moveType, defType) => EFFECTIVENESS[moveType]?.[defType] ?? 1;

// Moves. One small effect each (fx), shown in the battle log and on the move buttons:
//   heal {amount} (status, user) · raise {stat:'atk'|'def', chance?} (user) · lower {stat:'atk'|'spd', chance?} (foe)
//   flinch {chance} · sleep {chance?} · multi {min, max} · recoil {amount}
// power 0 = status move (no damage). sure: true = never misses. sig: true = signature move.
// Some names changed on screen; the ids stay the same so old saves keep working.
const mv = (name, type, power, acc, extra = {}) => ({ name, type, power, acc, ...extra });
export const MOVES = {
  tackle: mv('Bump', 'normal', 40, 1),
  quickjab: mv('Quick Jab', 'normal', 35, 1, { priority: 1 }),
  bodyslam: mv('Belly Bash', 'normal', 70, 0.95),
  hyperstrike: mv('Hyper Strike', 'normal', 90, 0.85),
  restup: mv('Rest Up', 'normal', 0, 1, { fx: { kind: 'heal', amount: 0.5 } }),
  pumpup: mv('Pump Up', 'normal', 0, 1, { fx: { kind: 'raise', stat: 'atk' } }),
  hunker: mv('Hunker Down', 'normal', 0, 1, { fx: { kind: 'raise', stat: 'def' } }),
  grumble: mv('Grumble', 'normal', 0, 1, { fx: { kind: 'lower', stat: 'atk' } }),
  ember: mv('Cinder', 'fire', 40, 1),
  flarekick: mv('Flare Kick', 'fire', 60, 0.95, { fx: { kind: 'flinch', chance: 0.3 } }),
  flameburst: mv('Blaze Burst', 'fire', 75, 0.9),
  infernodash: mv('Inferno Dash', 'fire', 100, 0.95, { fx: { kind: 'recoil', amount: 0.25 } }),
  blazedash: mv('Blaze Dash', 'fire', 70, 1, { priority: 1, sig: true }),
  bubble: mv('Bubble Pop', 'water', 40, 1),
  soakshot: mv('Soak Shot', 'water', 55, 1, { fx: { kind: 'lower', stat: 'spd', chance: 0.5 } }),
  tidecrash: mv('Tide Crash', 'water', 75, 0.9),
  bigwave: mv('Big Wave', 'water', 95, 0.85),
  royaltide: mv('Royal Tide', 'water', 90, 0.95, { fx: { kind: 'lower', stat: 'spd', chance: 0.3 }, sig: true }),
  leafcut: mv('Leaf Cut', 'grass', 40, 1),
  seedvolley: mv('Seed Volley', 'grass', 20, 1, { fx: { kind: 'multi', min: 2, max: 4 } }),
  vinelash: mv('Vine Lash', 'grass', 75, 0.9),
  sapsip: mv('Sap Sip', 'grass', 0, 1, { fx: { kind: 'heal', amount: 0.5 } }),
  rootslam: mv('Root Slam', 'grass', 90, 1, { sure: true, sig: true }),
  spark: mv('Zap', 'electric', 40, 1),
  staticsnap: mv('Static Snap', 'electric', 55, 1, { fx: { kind: 'lower', stat: 'spd', chance: 0.5 } }),
  thunderjolt: mv('Thunder Jolt', 'electric', 75, 0.9),
  stormcall: mv('Storm Call', 'electric', 95, 0.8),
  pebbleshot: mv('Pebble Shot', 'rock', 40, 1),
  rumblerock: mv('Rumble Rock', 'rock', 60, 0.95, { fx: { kind: 'flinch', chance: 0.3 } }),
  rockslam: mv('Rock Slam', 'rock', 75, 0.9),
  boulderdrop: mv('Boulder Drop', 'rock', 100, 0.8),
  icebreath: mv('Ice Breath', 'ice', 40, 1),
  chillwind: mv('Chill Wind', 'ice', 50, 1, { fx: { kind: 'lower', stat: 'spd', chance: 0.5 } }),
  blizzard: mv('Snow Storm', 'ice', 75, 0.9),
  glacierslam: mv('Glacier Slam', 'ice', 95, 0.85),
  bugbite: mv('Nibble', 'bug', 40, 1),
  buzzdive: mv('Buzz Dive', 'bug', 50, 1, { priority: 1 }),
  stingbarrage: mv('Sting Barrage', 'bug', 75, 0.9),
  silkwrap: mv('Silk Wrap', 'bug', 0, 0.95, { fx: { kind: 'lower', stat: 'spd' } }),
  shadowsneak: mv('Shadow Dash', 'ghost', 40, 1, { priority: 1 }),
  boo: mv('Boo!', 'ghost', 50, 1, { fx: { kind: 'flinch', chance: 0.3 } }),
  phantomstrike: mv('Phantom Strike', 'ghost', 75, 0.9),
  gloomwave: mv('Gloom Wave', 'ghost', 90, 0.9, { fx: { kind: 'lower', stat: 'atk', chance: 0.3 } }),
  mindpulse: mv('Mind Pulse', 'mind', 40, 1),
  mindtrick: mv('Mind Trick', 'mind', 60, 1, { sure: true }),
  brainwave: mv('Brain Wave', 'mind', 75, 0.9),
  deepfocus: mv('Deep Focus', 'mind', 0, 1, { fx: { kind: 'raise', stat: 'atk' } }),
  clank: mv('Clank', 'metal', 40, 1),
  rivetshot: mv('Rivet Shot', 'metal', 20, 1, { fx: { kind: 'multi', min: 2, max: 4 } }),
  ironbash: mv('Iron Bash', 'metal', 75, 0.9),
  ironwall: mv('Iron Wall', 'metal', 0, 1, { fx: { kind: 'raise', stat: 'def' } }),
  sludgespit: mv('Sludge Spit', 'toxic', 40, 1),
  goopshot: mv('Goop Shot', 'toxic', 55, 1, { fx: { kind: 'lower', stat: 'atk', chance: 0.3 } }),
  toxiccloud: mv('Toxic Cloud', 'toxic', 75, 0.9),
  stinkbomb: mv('Stink Bomb', 'toxic', 90, 0.9, { fx: { kind: 'flinch', chance: 0.2 } }),
  pixiedust: mv('Pixie Dust', 'pixie', 40, 1),
  glitterpuff: mv('Glitter Puff', 'pixie', 55, 1, { fx: { kind: 'lower', stat: 'atk', chance: 0.3 } }),
  moonbeam: mv('Moonbeam', 'pixie', 75, 0.9),
  sweetdreams: mv('Sweet Dreams', 'pixie', 0, 0.75, { fx: { kind: 'sleep' } }),
  scaleswipe: mv('Scale Swipe', 'drake', 40, 1),
  clawrake: mv('Claw Rake', 'drake', 60, 0.95, { fx: { kind: 'raise', stat: 'atk', chance: 0.3 } }),
  drakeroar: mv('Drake Roar', 'drake', 80, 0.9),
  drakecharge: mv('Drake Charge', 'drake', 100, 0.95, { fx: { kind: 'recoil', amount: 0.25 } }),
  prismray: mv('Prism Ray', 'rainbow', 45, 1),
  colorsplash: mv('Color Splash', 'rainbow', 60, 1, { sure: true }),
  rainbowburst: mv('Rainbow Burst', 'rainbow', 80, 0.9),
  shimmer: mv('Shimmer', 'rainbow', 0, 1, { fx: { kind: 'heal', amount: 0.5 } }),
  zenithray: mv('Zenith Ray', 'rainbow', 90, 1, { sure: true, sig: true }),
  starshard: mv('Star Shard', 'cosmic', 40, 1),
  meteorshower: mv('Meteor Shower', 'cosmic', 20, 1, { fx: { kind: 'multi', min: 2, max: 4 } }),
  cometcrash: mv('Comet Crash', 'cosmic', 75, 0.9),
  supernova: mv('Supernova', 'cosmic', 100, 0.85),
  echoping: mv('Echo Ping', 'sound', 40, 1),
  shriek: mv('Shriek', 'sound', 55, 1, { fx: { kind: 'flinch', chance: 0.3 } }),
  bassblast: mv('Bass Blast', 'sound', 75, 0.9),
  lullaby: mv('Lullaby', 'sound', 0, 0.75, { fx: { kind: 'sleep' } }),
  bonebonk: mv('Bone Bonk', 'bone', 40, 1),
  bonetoss: mv('Bone Toss', 'bone', 20, 1, { fx: { kind: 'multi', min: 2, max: 4 } }),
  fossilcrush: mv('Fossil Crush', 'bone', 75, 0.9),
  dinostomp: mv('Dino Stomp', 'bone', 95, 0.85, { fx: { kind: 'flinch', chance: 0.2 } }),
  rattledance: mv('Rattle Dance', 'bone', 80, 1, { fx: { kind: 'raise', stat: 'atk', chance: 0.5 }, sig: true }),
  beepbeam: mv('Beep Beam', 'alien', 40, 1),
  tractorbeam: mv('Tractor Beam', 'alien', 55, 1, { fx: { kind: 'lower', stat: 'spd', chance: 0.5 } }),
  ufoblast: mv('UFO Blast', 'alien', 75, 0.9),
  gravityflip: mv('Gravity Flip', 'alien', 90, 0.9, { fx: { kind: 'flinch', chance: 0.2 } }),
  mothership: mv('Mothership', 'alien', 90, 1, { sure: true, sig: true }),
  bigbong: mv('Big Bong', 'sound', 85, 0.9, { fx: { kind: 'sleep', chance: 0.3 }, sig: true }),
};

// Short, kid-friendly words for what a move does. Used on battle buttons, the forget prompt and the Book.
export function moveInfo(id) {
  const m = MOVES[id];
  const tags = [];
  if (!m) return { tags, text: '' };
  const fx = m.fx;
  if (m.power > 0) tags.push(`power ${m.power}`);
  if (m.priority) tags.push('goes first');
  if (m.sure) tags.push('never misses');
  if (fx) {
    const stat = { atk: 'attack', def: 'defence', spd: 'speed' };
    if (fx.kind === 'heal') tags.push('heals you');
    else if (fx.kind === 'raise') tags.push(fx.chance ? `may raise your ${stat[fx.stat]}` : `raises your ${stat[fx.stat]}`);
    else if (fx.kind === 'lower') tags.push(fx.stat === 'spd' ? `${fx.chance ? 'may slow' : 'slows'} the foe` : `${fx.chance ? 'may lower' : 'lowers'} the foe's attack`);
    else if (fx.kind === 'flinch') tags.push('may make the foe flinch');
    else if (fx.kind === 'sleep') tags.push(fx.chance ? 'may put the foe to sleep' : 'puts the foe to sleep');
    else if (fx.kind === 'multi') tags.push(`hits ${fx.min} to ${fx.max} times`);
    else if (fx.kind === 'recoil') tags.push('hurts you a little too');
  }
  if (m.sig) tags.push('special move');
  return { tags, text: tags.join(' · ') };
}

// Standard learnset for a type: a weak move at first, then stronger and more varied ones. Every
// creature also gets a move from a "second" type so two creatures of one type are not the same.
const T1 = {
  fire: 'ember', water: 'bubble', grass: 'leafcut', electric: 'spark', rock: 'pebbleshot', ice: 'icebreath', bug: 'bugbite',
  ghost: 'shadowsneak', mind: 'mindpulse', metal: 'clank', toxic: 'sludgespit', pixie: 'pixiedust', drake: 'scaleswipe', rainbow: 'prismray',
  cosmic: 'starshard', sound: 'echoping', bone: 'bonebonk', alien: 'beepbeam',
};
const T2 = {
  fire: 'flameburst', water: 'tidecrash', grass: 'vinelash', electric: 'thunderjolt', rock: 'rockslam', ice: 'blizzard', bug: 'stingbarrage',
  ghost: 'phantomstrike', mind: 'brainwave', metal: 'ironbash', toxic: 'toxiccloud', pixie: 'moonbeam', drake: 'drakeroar', rainbow: 'rainbowburst',
  cosmic: 'cometcrash', sound: 'bassblast', bone: 'fossilcrush', alien: 'ufoblast',
};
const T3 = {
  fire: 'flarekick', water: 'soakshot', grass: 'seedvolley', electric: 'staticsnap', rock: 'rumblerock',
  ice: 'chillwind', bug: 'buzzdive', ghost: 'boo', mind: 'mindtrick', metal: 'rivetshot', toxic: 'goopshot',
  pixie: 'glitterpuff', drake: 'clawrake', rainbow: 'colorsplash', cosmic: 'meteorshower', sound: 'shriek', bone: 'bonetoss', alien: 'tractorbeam',
};
const T4 = {
  fire: 'infernodash', water: 'bigwave', grass: 'sapsip', electric: 'stormcall', rock: 'boulderdrop',
  ice: 'glacierslam', bug: 'silkwrap', ghost: 'gloomwave', mind: 'deepfocus', metal: 'ironwall', toxic: 'stinkbomb',
  pixie: 'sweetdreams', drake: 'drakecharge', rainbow: 'shimmer', cosmic: 'supernova', sound: 'lullaby', bone: 'dinostomp', alien: 'gravityflip',
};
// Types whose T4 is a big hit get a normal helper move at 23; the others get Belly Bash.
const UTIL = { fire: 'pumpup', water: 'restup', electric: 'grumble', rock: 'hunker', ice: 'hunker',
  ghost: 'grumble', toxic: 'hunker', drake: 'pumpup', cosmic: 'restup', bone: 'hunker', alien: 'pumpup' };
function L(type, second, extra = []) {
  const base = type === 'normal'
    ? [[1, 'tackle'], [1, 'quickjab'], [8, T1[second]], [12, 'bodyslam'], [19, T3[second]], [23, 'restup'], [28, 'hyperstrike']]
    : [[1, 'tackle'], [1, T1[type]], [7, 'quickjab'], [10, T3[type]], [13, T2[type]], [19, T3[second]],
       [23, UTIL[type] || 'bodyslam'], [28, T4[type]]];
  return [...base, ...extra].sort((a, b) => a[0] - b[0]);
}

export const SPECIES = {
  emberpup: {
    name: 'Emberpup', type: 'fire', desc: 'A loyal pup whose tail burns brighter when it is happy.',
    base: { hp: 39, atk: 56, def: 40, spd: 62 }, baseXp: 62, catchRate: 0.45,
    learn: L('fire', 'rock'),
    evolve: { level: 16, into: 'blazehound' },
    model: { shape: 'quad', scale: 0.85, body: 0xe2572c, accent: 0xffc840, dark: 0x7a2a12, belly: 0xffe0b0, extras: ['flameTail', 'ears'] },
  },
  blazehound: {
    name: 'Blazehound', type: 'fire', desc: 'Its burning mane can be seen from far across the plains.',
    base: { hp: 65, atk: 85, def: 60, spd: 85 }, baseXp: 150, catchRate: 0.15,
    learn: L('fire', 'rock', [[30, 'blazedash']]),
    model: { shape: 'quad', scale: 1.3, body: 0xb83a1c, accent: 0xffc840, dark: 0x4a1608, belly: 0xffd08a, extras: ['flameTail', 'ears', 'mane'] },
  },
  sproutle: {
    name: 'Sproutle', type: 'grass', desc: 'A calm frog-like creature that naps in the sun to grow its leaf.',
    base: { hp: 45, atk: 49, def: 49, spd: 45 }, baseXp: 64, catchRate: 0.45,
    learn: L('grass', 'rock'),
    evolve: { level: 16, into: 'grovebeast' },
    model: { shape: 'quad', scale: 0.8, body: 0x5fbf7f, accent: 0x2f8f3a, dark: 0x2f6e46, belly: 0xd9f2c4, extras: ['frog', 'leafHead'] },
  },
  grovebeast: {
    name: 'Grovebeast', type: 'grass', desc: 'A small tree grows on its back. Forests flourish where it walks.',
    base: { hp: 80, atk: 82, def: 83, spd: 60 }, baseXp: 155, catchRate: 0.15,
    learn: L('grass', 'rock', [[30, 'rootslam']]),
    model: { shape: 'quad', scale: 1.35, body: 0x4a9e66, accent: 0x2f8f3a, dark: 0x6b4a2b, belly: 0xc9e8b0, extras: ['frog', 'backTree'] },
  },
  bubbuck: {
    name: 'Bubbuck', type: 'water', desc: 'A bouncy blob that blows bubbles when startled.',
    base: { hp: 44, atk: 48, def: 65, spd: 43 }, baseXp: 63, catchRate: 0.45,
    learn: L('water', 'ice'),
    evolve: { level: 16, into: 'tidalord' }, swims: true,
    model: { shape: 'blob', scale: 0.85, body: 0x4f8fe0, accent: 0xa8e0ff, dark: 0x234a80, belly: 0xd8f0ff, extras: ['fin'] },
  },
  tidalord: {
    name: 'Tidalord', type: 'water', desc: 'Rules the lakes. Its crown is said to control the tides.',
    base: { hp: 79, atk: 83, def: 100, spd: 78 }, baseXp: 160, catchRate: 0.15, swims: true,
    learn: L('water', 'ice', [[30, 'royaltide']]),
    model: { shape: 'blob', scale: 1.4, body: 0x2f6fc0, accent: 0xa8e0ff, dark: 0x16345e, belly: 0xd8f0ff, extras: ['fin', 'crown'] },
  },
  zapple: {
    name: 'Zapple', type: 'electric', desc: 'Stores static in its antenna. Touching it is a shocking idea.',
    base: { hp: 35, atk: 55, def: 40, spd: 90 }, baseXp: 82, catchRate: 0.4,
    evolve: { level: 20, into: 'thundapple' },
    learn: L('electric', 'grass'),
    model: { shape: 'blob', scale: 0.7, body: 0xf5d63d, accent: 0xff5a4a, dark: 0x6b5a14, belly: 0xfff4b0, extras: ['antenna', 'cheeks'] },
  },
  pebblor: {
    name: 'Pebblor', type: 'rock', desc: 'Sleeps for weeks on mountaintops and is often mistaken for a boulder.',
    base: { hp: 40, atk: 80, def: 100, spd: 20 }, baseXp: 86, catchRate: 0.4,
    learn: L('rock', 'metal'),
    evolve: { level: 20, into: 'monolor' },
    model: { shape: 'biped', scale: 0.8, body: 0x8c8478, accent: 0x5c9a40, dark: 0x5a544c, belly: 0xa8a092, extras: ['moss'] },
  },
  fluffin: {
    name: 'Fluffin', type: 'normal', desc: 'A woolly grazer. Its fleece makes the softest pillows.',
    base: { hp: 55, atk: 45, def: 50, spd: 40 }, baseXp: 58, catchRate: 0.55,
    evolve: { level: 18, into: 'woolumph' },
    learn: L('normal', 'pixie'),
    model: { shape: 'quad', scale: 0.85, body: 0xf4f1ea, accent: 0xffb6c8, dark: 0x3b3430, belly: 0xffffff, extras: ['wool', 'ears'] },
  },
  thornox: {
    name: 'Thornox', type: 'grass', desc: 'A stubborn forest guardian with thorny horns.',
    base: { hp: 60, atk: 75, def: 70, spd: 55 }, baseXp: 120, catchRate: 0.25,
    learn: L('grass', 'bug'),
    model: { shape: 'quad', scale: 1.15, body: 0x6b8e3a, accent: 0xd8d0a0, dark: 0x3e4f1f, belly: 0x9fbf6a, extras: ['horns'] },
  },
  flarehawk: {
    name: 'Flarehawk', type: 'fire', desc: 'Circles mountain peaks riding hot air currents.',
    base: { hp: 50, atk: 70, def: 45, spd: 95 }, baseXp: 125, catchRate: 0.25, flies: true,
    learn: L('fire', 'drake'),
    model: { shape: 'bird', scale: 0.9, body: 0xd9482b, accent: 0xffc23d, dark: 0x5a1e10, belly: 0xffe2a8, extras: [] },
  },

  /* ----------------------------- fire ----------------------------- */
  sparkitten: {
    name: 'Sparkitten', type: 'fire', desc: 'A playful kitten. Its whiskers throw sparks when it sneezes.',
    base: { hp: 40, atk: 55, def: 38, spd: 70 }, baseXp: 60, catchRate: 0.45, learn: L('fire', 'electric'),
    evolve: { level: 18, into: 'pyrolynx' },
    model: { shape: 'quad', scale: 0.7, body: 0xf07a3a, accent: 0xffd060, dark: 0x7a3010, belly: 0xffe8c0, extras: ['ears', 'fluffyTail', 'whiskers'] },
  },
  pyrolynx: {
    name: 'Pyrolynx', type: 'fire', desc: 'A proud lynx that leaves glowing paw prints behind it.',
    base: { hp: 70, atk: 88, def: 58, spd: 98 }, baseXp: 150, catchRate: 0.15, learn: L('fire', 'electric'),
    model: { shape: 'quad', scale: 1.2, body: 0xd0501a, accent: 0xffd060, dark: 0x5a200a, belly: 0xffd8a0, extras: ['ears', 'fluffyTail', 'whiskers', 'mane'] },
  },
  magmole: {
    name: 'Magmole', type: 'fire', desc: 'Digs tunnels through volcanoes. Lava drips from its claws.',
    base: { hp: 60, atk: 72, def: 70, spd: 35 }, baseXp: 90, catchRate: 0.35, learn: L('fire', 'rock'),
    model: { shape: 'biped', scale: 0.75, body: 0x5a3a30, accent: 0xff6a1a, dark: 0x2a1a15, belly: 0xffa040, extras: ['claws', 'lava'] },
  },

  /* ----------------------------- water ---------------------------- */
  ripplet: {
    name: 'Ripplet', type: 'water', desc: 'A little sea serpent that loves racing the waves.',
    base: { hp: 42, atk: 50, def: 45, spd: 62 }, baseXp: 62, catchRate: 0.45, learn: L('water', 'pixie'), swims: true,
    evolve: { level: 20, into: 'torrentide' },
    model: { shape: 'serpent', scale: 0.8, body: 0x4ab0e0, accent: 0xe0f8ff, dark: 0x206080, belly: 0xc8f0ff, extras: ['fins'] },
  },
  torrentide: {
    name: 'Torrentide', type: 'water', desc: 'A huge sea dragon. A flick of its tail can cause a whirlpool.',
    base: { hp: 85, atk: 90, def: 80, spd: 75 }, baseXp: 165, catchRate: 0.12, learn: L('water', 'pixie'), swims: true,
    model: { shape: 'serpent', scale: 1.4, body: 0x2060b0, accent: 0xa0e0ff, dark: 0x0a2a5a, belly: 0xc8f0ff, extras: ['fins', 'spikes', 'whiskers'] },
  },
  shellby: {
    name: 'Shellby', type: 'water', desc: 'A sleepy turtle. It hides in its shell when it is shy.',
    base: { hp: 50, atk: 45, def: 80, spd: 30 }, baseXp: 66, catchRate: 0.45, learn: L('water', 'rock'), swims: true,
    model: { shape: 'quad', scale: 0.8, body: 0x6ab07a, accent: 0x3a70c0, dark: 0x2a5a3a, belly: 0xd8e8b0, extras: ['shell', 'frog'] },
  },
  gullop: {
    name: 'Gullop', type: 'water', desc: 'A noisy seabird that steals snacks from beach picnics.',
    base: { hp: 45, atk: 55, def: 40, spd: 80 }, baseXp: 70, catchRate: 0.4, learn: L('water', 'sound'), flies: true,
    model: { shape: 'bird', scale: 0.8, body: 0xf0f0f0, accent: 0xffb030, dark: 0x6080a0, belly: 0xffffff, extras: [] },
  },

  /* ----------------------------- grass ---------------------------- */
  budling: {
    name: 'Budling', type: 'grass', desc: 'The flower on its head opens up on sunny days.',
    base: { hp: 40, atk: 42, def: 48, spd: 50 }, baseXp: 58, catchRate: 0.5, learn: L('grass', 'pixie'),
    evolve: { level: 18, into: 'bloomora' },
    model: { shape: 'blob', scale: 0.7, body: 0x8ad070, accent: 0xff70a0, dark: 0x3a7a3a, belly: 0xe0f8c8, extras: ['flower'] },
  },
  bloomora: {
    name: 'Bloomora', type: 'grass', desc: 'Its flower crown smells so sweet that angry creatures calm down.',
    base: { hp: 75, atk: 80, def: 75, spd: 70 }, baseXp: 150, catchRate: 0.15, learn: L('grass', 'pixie'),
    model: { shape: 'biped', scale: 0.95, body: 0x6ab06a, accent: 0xff70a0, dark: 0x2a6a3a, belly: 0xd0f0c0, extras: ['flowerHead', 'leafy'] },
  },
  mossloth: {
    name: 'Mossloth', type: 'grass', desc: 'Moves so slowly that moss grows all over its fur.',
    base: { hp: 80, atk: 60, def: 85, spd: 25 }, baseXp: 95, catchRate: 0.35, learn: L('grass', 'toxic'),
    model: { shape: 'biped', scale: 0.9, body: 0x7a6a50, accent: 0x5c9a40, dark: 0x4a3a2a, belly: 0xa89a80, extras: ['moss', 'claws'] },
  },

  /* --------------------------- electric --------------------------- */
  voltwing: {
    name: 'Voltwing', type: 'electric', desc: 'Flies into thunderstorms to recharge its feathers.',
    base: { hp: 45, atk: 65, def: 40, spd: 95 }, baseXp: 95, catchRate: 0.35, learn: L('electric', 'cosmic'), flies: true,
    model: { shape: 'bird', scale: 0.8, body: 0xf5d63d, accent: 0x2a2a2a, dark: 0xc09a10, belly: 0xfff4b0, extras: ['bolt'] },
  },
  joltail: {
    name: 'Joltail', type: 'electric', desc: 'An eel that lights up lakes at night with little zaps.',
    base: { hp: 55, atk: 70, def: 50, spd: 75 }, baseXp: 100, catchRate: 0.3, learn: L('electric', 'water'), swims: true,
    model: { shape: 'serpent', scale: 0.95, body: 0x3a4a8a, accent: 0xf5e040, dark: 0x1a2050, belly: 0x8090c0, extras: ['bolt', 'whiskers'] },
  },
  ampup: {
    name: 'Ampup', type: 'electric', desc: 'A puppy that wags its lightning-bolt tail when excited.',
    base: { hp: 40, atk: 55, def: 40, spd: 72 }, baseXp: 62, catchRate: 0.45, learn: L('electric', 'metal'),
    evolve: { level: 20, into: 'thunderwolf' },
    model: { shape: 'quad', scale: 0.75, body: 0xf0c030, accent: 0x2a2a2a, dark: 0x8a6a10, belly: 0xfff0b0, extras: ['ears', 'boltTail'] },
  },
  thunderwolf: {
    name: 'Thunderwolf', type: 'electric', desc: 'Its howl sounds like rolling thunder.',
    base: { hp: 70, atk: 90, def: 65, spd: 100 }, baseXp: 160, catchRate: 0.12, learn: L('electric', 'metal'),
    model: { shape: 'quad', scale: 1.25, body: 0x4a5aa0, accent: 0xf5e040, dark: 0x202a50, belly: 0xc0c8f0, extras: ['ears', 'boltTail', 'mane'] },
  },

  /* ----------------------------- rock ----------------------------- */
  cragtusk: {
    name: 'Cragtusk', type: 'rock', desc: 'A rocky boar. Its tusks can split boulders in half.',
    base: { hp: 75, atk: 85, def: 95, spd: 30 }, baseXp: 120, catchRate: 0.25, learn: L('rock', 'ice'),
    model: { shape: 'quad', scale: 1.1, body: 0x7a7468, accent: 0xf0e8d0, dark: 0x4a453e, belly: 0x9a9488, extras: ['tusks', 'spikes'] },
  },
  monolor: {
    name: 'Monolor', type: 'rock', desc: 'Pebblor grown into a walking mountain. Birds nest on its head.',
    base: { hp: 70, atk: 105, def: 125, spd: 30 }, baseXp: 165, catchRate: 0.1, learn: L('rock', 'metal'),
    model: { shape: 'biped', scale: 1.2, body: 0x6a645a, accent: 0x5c9a40, dark: 0x403c36, belly: 0x8a8478, extras: ['moss', 'spikes'] },
  },
  geodrake: {
    name: 'Geodrake', type: 'rock', desc: 'A stone serpent that burrows through mountains like they are sand.',
    base: { hp: 55, atk: 75, def: 85, spd: 50 }, baseXp: 105, catchRate: 0.3, learn: L('rock', 'drake'),
    model: { shape: 'serpent', scale: 1.0, body: 0x9a8a6a, accent: 0xd0a040, dark: 0x5a4a30, belly: 0xc0b090, extras: ['spikes'] },
  },

  /* ---------------------------- normal ---------------------------- */
  hopsy: {
    name: 'Hopsy', type: 'normal', desc: 'A bunny that can hop higher than a tree.',
    base: { hp: 45, atk: 50, def: 40, spd: 75 }, baseXp: 55, catchRate: 0.55, learn: L('normal', 'grass'),
    evolve: { level: 18, into: 'bounceroo' },
    model: { shape: 'quad', scale: 0.65, body: 0xe8d8c0, accent: 0xffb0c0, dark: 0x8a7a6a, belly: 0xffffff, extras: ['longEars', 'puffTail'] },
  },
  bounceroo: {
    name: 'Bounceroo', type: 'normal', desc: 'A boxing kangaroo with a mighty kick.',
    base: { hp: 80, atk: 85, def: 60, spd: 90 }, baseXp: 145, catchRate: 0.15, learn: L('normal', 'grass'),
    model: { shape: 'biped', scale: 1.0, body: 0xc89a6a, accent: 0xe04040, dark: 0x6a4a2a, belly: 0xf0e0c0, extras: ['longEars', 'tail', 'gloves'] },
  },
  chirpit: {
    name: 'Chirpit', type: 'normal', desc: 'A tiny bird that sings at sunrise to wake everyone up.',
    base: { hp: 40, atk: 45, def: 40, spd: 70 }, baseXp: 50, catchRate: 0.55, learn: L('normal', 'sound'), flies: true,
    evolve: { level: 16, into: 'loudbeak' },
    model: { shape: 'bird', scale: 0.6, body: 0xa07a50, accent: 0xffa040, dark: 0x5a4030, belly: 0xf0e0c0, extras: [] },
  },

  /* ------------------------------ ice ----------------------------- */
  frostling: {
    name: 'Frostling', type: 'ice', desc: 'A chilly little blob. Its sneeze makes snowflakes.',
    base: { hp: 40, atk: 45, def: 50, spd: 55 }, baseXp: 62, catchRate: 0.45, learn: L('ice', 'mind'),
    evolve: { level: 20, into: 'glacieron' },
    model: { shape: 'blob', scale: 0.7, body: 0xd8f4ff, accent: 0x80d0f0, dark: 0x4a8ab0, belly: 0xffffff, extras: ['iceSpikes'] },
  },
  glacieron: {
    name: 'Glacieron', type: 'ice', desc: 'A giant made of ancient glacier ice that never melts.',
    base: { hp: 80, atk: 90, def: 95, spd: 55 }, baseXp: 165, catchRate: 0.12, learn: L('ice', 'mind'),
    model: { shape: 'biped', scale: 1.25, body: 0xa8e0f0, accent: 0xe8fbff, dark: 0x4a8ab0, belly: 0xd8f4ff, extras: ['crystal'] },
  },
  snowpaw: {
    name: 'Snowpaw', type: 'ice', desc: 'A snow fox that is almost invisible in a blizzard.',
    base: { hp: 50, atk: 62, def: 48, spd: 80 }, baseXp: 95, catchRate: 0.35, learn: L('ice', 'rock'),
    evolve: { level: 22, into: 'blizzbear' },
    model: { shape: 'quad', scale: 0.8, body: 0xf8fcff, accent: 0x9ad8f0, dark: 0x8aa0b0, belly: 0xffffff, extras: ['ears', 'fluffyTail'] },
  },
  waddlice: {
    name: 'Waddlice', type: 'ice', desc: 'A penguin that slides down mountains on its belly.',
    base: { hp: 55, atk: 58, def: 62, spd: 45 }, baseXp: 85, catchRate: 0.4, learn: L('ice', 'water'),
    evolve: { level: 22, into: 'emperice' },
    model: { shape: 'biped', scale: 0.7, body: 0x2a3a5a, accent: 0xffb030, dark: 0x1a2030, belly: 0xf8f8ff, extras: ['beak'] },
  },

  /* ------------------------------ bug ----------------------------- */
  beetlet: {
    name: 'Beetlet', type: 'bug', desc: 'A small beetle that dreams of growing a big horn.',
    base: { hp: 40, atk: 50, def: 55, spd: 40 }, baseXp: 55, catchRate: 0.5, learn: L('bug', 'rock'),
    evolve: { level: 16, into: 'hornbeetle' },
    model: { shape: 'bug', scale: 0.7, body: 0x6a8a20, accent: 0xd0e060, dark: 0x2a3a10, belly: 0xa0b860, extras: [] },
  },
  hornbeetle: {
    name: 'Hornbeetle', type: 'bug', desc: 'Strong enough to lift a whole tree with its horn.',
    base: { hp: 70, atk: 95, def: 90, spd: 55 }, baseXp: 150, catchRate: 0.15, learn: L('bug', 'rock'),
    model: { shape: 'bug', scale: 1.2, body: 0x2a4a8a, accent: 0xc0c0d0, dark: 0x101a30, belly: 0x5a7ab0, extras: ['horn'] },
  },
  flutterby: {
    name: 'Flutterby', type: 'bug', desc: 'Its wings sparkle with every colour of the rainbow.',
    base: { hp: 45, atk: 50, def: 40, spd: 85 }, baseXp: 75, catchRate: 0.4, learn: L('bug', 'pixie'), flies: true,
    evolve: { level: 18, into: 'monarchwing' },
    model: { shape: 'butterfly', scale: 0.85, body: 0x3a3a3a, accent: 0xff9ad0, dark: 0x8a40c0, belly: 0x5a5a5a, extras: ['wings'] },
  },
  glowbug: {
    name: 'Glowbug', type: 'bug', desc: 'Its glowing tail lights the way for lost travellers.',
    base: { hp: 50, atk: 55, def: 50, spd: 70 }, baseXp: 80, catchRate: 0.4, learn: L('bug', 'electric'), flies: true,
    evolve: { level: 20, into: 'lumimoth' },
    model: { shape: 'moth', scale: 0.75, body: 0x5a4a30, accent: 0xd0ff60, dark: 0x2a2418, belly: 0xc8b488, extras: ['glow', 'wings'] },
  },

  /* ----------------------------- ghost ---------------------------- */
  wispurr: {
    name: 'Wispurr', type: 'ghost', desc: 'A ghostly cat that purrs in empty houses at night.',
    base: { hp: 40, atk: 60, def: 40, spd: 80 }, baseXp: 80, catchRate: 0.35, learn: L('ghost', 'fire'), floats: true,
    evolve: { level: 22, into: 'phantomaw' },
    model: { shape: 'blob', scale: 0.7, body: 0x7a5aa0, accent: 0xc0a0ff, dark: 0x3a2a5a, belly: 0xb8a0e0, extras: ['ghost', 'catEars'] },
  },
  phantomaw: {
    name: 'Phantomaw', type: 'ghost', desc: 'A giant phantom with a huge grin. It loves to play tricks.',
    base: { hp: 70, atk: 100, def: 65, spd: 95 }, baseXp: 170, catchRate: 0.1, learn: L('ghost', 'fire'), floats: true,
    model: { shape: 'blob', scale: 1.3, body: 0x4a2a6a, accent: 0xff60a0, dark: 0x1a0a2a, belly: 0x8a6ab0, extras: ['ghost', 'horns', 'grin'] },
  },
  snoozle: {
    name: 'Snoozle', type: 'ghost', desc: 'A sleepy spirit that drifts around while it dreams.',
    base: { hp: 60, atk: 50, def: 65, spd: 30 }, baseXp: 85, catchRate: 0.35, learn: L('ghost', 'mind'), floats: true,
    evolve: { level: 24, into: 'slumbergeist' },
    model: { shape: 'blob', scale: 0.9, body: 0x9a8ac0, accent: 0xe0d8ff, dark: 0x4a3a6a, belly: 0xd8d0f0, extras: ['ghost', 'sleepy'] },
  },

  /* ------------------------------ mind ---------------------------- */
  thinkit: {
    name: 'Thinkit', type: 'mind', desc: 'Its big brain glows when it is solving a puzzle.',
    base: { hp: 40, atk: 58, def: 42, spd: 62 }, baseXp: 66, catchRate: 0.4, learn: L('mind', 'electric'),
    evolve: { level: 20, into: 'cerebrix' },
    model: { shape: 'blob', scale: 0.7, body: 0xf3a6c8, accent: 0xff6fae, dark: 0x8a3a64, belly: 0xffe0ee, extras: ['brain', 'gem'] },
  },
  cerebrix: {
    name: 'Cerebrix', type: 'mind', desc: 'Can move boulders just by thinking about them.',
    base: { hp: 70, atk: 98, def: 65, spd: 92 }, baseXp: 165, catchRate: 0.12, learn: L('mind', 'electric'), floats: true,
    model: { shape: 'squid', scale: 1.05, body: 0xd97ab0, accent: 0xff6fae, dark: 0x6a2a50, belly: 0xffd0e6, extras: [] },
  },
  owlucid: {
    name: 'Owlucid', type: 'mind', desc: 'A wise owl that always seems to know what you will do next.',
    base: { hp: 55, atk: 65, def: 55, spd: 75 }, baseXp: 95, catchRate: 0.35, learn: L('mind', 'cosmic'), flies: true,
    evolve: { level: 22, into: 'sageowl' },
    model: { shape: 'bird', scale: 0.85, body: 0x8a6ab0, accent: 0xffd84a, dark: 0x4a3a6a, belly: 0xe8dcf8, extras: ['owl'] },
  },

  /* ------------------------------ metal --------------------------- */
  clanklet: {
    name: 'Clanklet', type: 'metal', desc: 'A tiny robot that collects lost screws and bolts.',
    base: { hp: 45, atk: 50, def: 70, spd: 35 }, baseXp: 66, catchRate: 0.4, learn: L('metal', 'electric'),
    evolve: { level: 22, into: 'mechanox' },
    model: { shape: 'blob', scale: 0.7, body: 0xaab4be, accent: 0x4ad0ff, dark: 0x5a646e, belly: 0xd8dee4, extras: ['robot'] },
  },
  mechanox: {
    name: 'Mechanox', type: 'metal', desc: 'A giant robot guardian with armour no attack can dent.',
    base: { hp: 75, atk: 95, def: 120, spd: 40 }, baseXp: 170, catchRate: 0.1, learn: L('metal', 'electric'),
    model: { shape: 'biped', scale: 1.25, body: 0x8a96a2, accent: 0x4ad0ff, dark: 0x4a545e, belly: 0xc8d0d8, extras: ['robot'] },
  },
  ironhorn: {
    name: 'Ironhorn', type: 'metal', desc: 'A rhino with skin of iron. It charges straight through walls.',
    base: { hp: 70, atk: 80, def: 95, spd: 35 }, baseXp: 115, catchRate: 0.25, learn: L('metal', 'rock'),
    evolve: { level: 24, into: 'titanox' },
    model: { shape: 'quad', scale: 1.05, body: 0x9aa6b2, accent: 0xe0e6ec, dark: 0x5a646e, belly: 0xb8c2cc, extras: ['rhinoHorn', 'ears'] },
  },

  /* ------------------------------ toxic --------------------------- */
  sludgy: {
    name: 'Sludgy', type: 'toxic', desc: 'A gooey blob. Do not let it hug you, it is very sticky.',
    base: { hp: 55, atk: 50, def: 50, spd: 30 }, baseXp: 62, catchRate: 0.45, learn: L('toxic', 'water'),
    evolve: { level: 20, into: 'gloopor' },
    model: { shape: 'blob', scale: 0.75, body: 0x9a5ac0, accent: 0xc8ff5a, dark: 0x4a2a6a, belly: 0xc89ae0, extras: ['slime'] },
  },
  gloopor: {
    name: 'Gloopor', type: 'toxic', desc: 'A huge pile of goo with a crown of bubbles. Flowers wilt near it.',
    base: { hp: 95, atk: 85, def: 75, spd: 45 }, baseXp: 160, catchRate: 0.12, learn: L('toxic', 'water'),
    model: { shape: 'blob', scale: 1.35, body: 0x7a3aa0, accent: 0xc8ff5a, dark: 0x3a1a5a, belly: 0xb07ad0, extras: ['slime', 'bubbles'] },
  },
  hissyfang: {
    name: 'Hissyfang', type: 'toxic', desc: 'A grumpy snake with glowing green fangs.',
    base: { hp: 50, atk: 75, def: 50, spd: 75 }, baseXp: 100, catchRate: 0.3, learn: L('toxic', 'drake'),
    evolve: { level: 22, into: 'venomamba' },
    model: { shape: 'serpent', scale: 0.9, body: 0x6a3a8a, accent: 0xa8f040, dark: 0x2a1a3a, belly: 0xc8a8e0, extras: ['fangs', 'spikes'] },
  },

  /* ------------------------------ pixie --------------------------- */
  twinklet: {
    name: 'Twinklet', type: 'pixie', desc: 'A tiny sprite that sprinkles glitter wherever it flies.',
    base: { hp: 45, atk: 45, def: 50, spd: 65 }, baseXp: 64, catchRate: 0.4, learn: L('pixie', 'cosmic'), floats: true,
    evolve: { level: 18, into: 'starbelle' },
    model: { shape: 'blob', scale: 0.6, body: 0xffd0ec, accent: 0xfff0a0, dark: 0xc06aa0, belly: 0xffffff, extras: ['pixieWings', 'gem'] },
  },
  starbelle: {
    name: 'Starbelle', type: 'pixie', desc: 'Dances under the moon. Its wand can grant small wishes.',
    base: { hp: 75, atk: 80, def: 75, spd: 85 }, baseXp: 155, catchRate: 0.12, learn: L('pixie', 'cosmic'),
    model: { shape: 'biped', scale: 0.95, body: 0xffb8e6, accent: 0xfff0a0, dark: 0xd070b0, belly: 0xffe8f6, extras: ['pixieWings', 'starHead'] },
  },
  petalfae: {
    name: 'Petalfae', type: 'pixie', desc: 'Hides inside flowers and giggles at people walking by.',
    base: { hp: 45, atk: 55, def: 45, spd: 85 }, baseXp: 85, catchRate: 0.35, learn: L('pixie', 'grass'), flies: true,
    evolve: { level: 18, into: 'blossprite' },
    model: { shape: 'bug', scale: 0.75, body: 0x7ac06a, accent: 0xffa8d8, dark: 0x3a6a3a, belly: 0xa8e098, extras: ['wings'] },
  },

  /* ------------------------------ drake --------------------------- */
  scalekin: {
    name: 'Scalekin', type: 'drake', desc: 'A baby drake. It practises roaring but only manages a squeak.',
    base: { hp: 45, atk: 65, def: 50, spd: 50 }, baseXp: 70, catchRate: 0.3, learn: L('drake', 'fire'),
    evolve: { level: 24, into: 'scalewing' },
    model: { shape: 'quad', scale: 0.8, body: 0x6a7ae0, accent: 0xffd84a, dark: 0x2a3a8a, belly: 0xc8d0ff, extras: ['dragonHorns', 'spikes', 'smallWings'] },
  },
  scalewing: {
    name: 'Scalewing', type: 'drake', desc: 'A mighty drake. Its wings stir up storms when it takes off.',
    base: { hp: 90, atk: 110, def: 85, spd: 85 }, baseXp: 185, catchRate: 0.08, learn: L('drake', 'fire'),
    model: { shape: 'quad', scale: 1.45, body: 0x4a5ac8, accent: 0xffd84a, dark: 0x1a2a6a, belly: 0xb0c0ff, extras: ['dragonHorns', 'spikes', 'bigWings'] },
  },
  skywyrm: {
    name: 'Skywyrm', type: 'drake', desc: 'A legendary sky serpent said to live above the clouds.',
    base: { hp: 80, atk: 100, def: 80, spd: 100 }, baseXp: 180, catchRate: 0.08, learn: L('drake', 'ice'), flies: true,
    model: { shape: 'serpent', scale: 1.3, body: 0x3ab0a0, accent: 0xffd84a, dark: 0x1a5a50, belly: 0xc0f0e8, extras: ['whiskers', 'spikes', 'dragonHorns'] },
  },

  /* ----------------------------- rainbow -------------------------- */
  prismkit: {
    name: 'Prismkit', type: 'rainbow', desc: 'A very rare kitten whose fur shimmers in every colour.',
    base: { hp: 50, atk: 60, def: 50, spd: 75 }, baseXp: 90, catchRate: 0.25, learn: L('rainbow', 'mind'),
    evolve: { level: 25, into: 'spectrion' },
    model: { shape: 'quad', scale: 0.7, body: 0xffffff, accent: 0xffffff, dark: 0xdddddd, belly: 0xffffff, extras: ['ears', 'fluffyTail', 'whiskers', 'rainbow'] },
  },
  spectrion: {
    name: 'Spectrion', type: 'rainbow', desc: 'Legends say a rainbow appears in the sky wherever it runs.',
    base: { hp: 85, atk: 100, def: 80, spd: 105 }, baseXp: 190, catchRate: 0.06, learn: L('rainbow', 'mind'),
    model: { shape: 'quad', scale: 1.3, body: 0xffffff, accent: 0xffffff, dark: 0xdddddd, belly: 0xffffff, extras: ['ears', 'fluffyTail', 'mane', 'rainbow'] },
  },
  rainwing: {
    name: 'Rainwing', type: 'rainbow', desc: 'A shy bird that only comes out when the sun is shining.',
    base: { hp: 60, atk: 70, def: 55, spd: 95 }, baseXp: 120, catchRate: 0.2, learn: L('rainbow', 'cosmic'), flies: true,
    evolve: { level: 26, into: 'auroraptor' },
    model: { shape: 'bird', scale: 0.9, body: 0xffffff, accent: 0xffffff, dark: 0xdddddd, belly: 0xffffff, extras: ['rainbow'] },
  },

  /* ------------------------------ cosmic -------------------------- */
  starmite: {
    name: 'Starmite', type: 'cosmic', desc: 'Fell from the sky as a shooting star. It glows brighter at night.',
    base: { hp: 45, atk: 50, def: 45, spd: 60 }, baseXp: 66, catchRate: 0.4, learn: L('cosmic', 'mind'), floats: true,
    evolve: { level: 22, into: 'galaxor' },
    model: { shape: 'star', scale: 0.75, body: 0x2e3478, accent: 0xffe680, dark: 0x181c48, belly: 0x6a72d0, extras: ['stars'] },
  },
  galaxor: {
    name: 'Galaxor', type: 'cosmic', desc: 'A whole galaxy swirls inside its body. It hums softly to the stars.',
    base: { hp: 80, atk: 90, def: 75, spd: 85 }, baseXp: 165, catchRate: 0.12, learn: L('cosmic', 'mind'), floats: true,
    model: { shape: 'robe', scale: 1.0, body: 0x2e3478, accent: 0xffe680, dark: 0x181c48, belly: 0x8a7ae0, extras: ['stars'] },
  },
  moonhop: {
    name: 'Moonhop', type: 'cosmic', desc: 'A bunny that bounces so high it once landed on the moon.',
    base: { hp: 55, atk: 60, def: 50, spd: 80 }, baseXp: 90, catchRate: 0.35, learn: L('cosmic', 'pixie'),
    evolve: { level: 22, into: 'lunaroo' },
    model: { shape: 'hopper', scale: 0.75, body: 0xdfe2f4, accent: 0x9aa6ff, dark: 0x6a6f90, belly: 0xf6f7ff, extras: [] },
  },

  /* ------------------------------ sound --------------------------- */
  echobat: {
    name: 'Echobat', type: 'sound', desc: 'Finds its way in the dark by listening to its own squeaks.',
    base: { hp: 45, atk: 55, def: 40, spd: 75 }, baseXp: 64, catchRate: 0.4, learn: L('sound', 'ghost'), flies: true,
    evolve: { level: 22, into: 'boomwing' },
    model: { shape: 'bat', scale: 0.8, body: 0x2f8f86, accent: 0xffd84a, dark: 0x1f4f4a, belly: 0x8fe8d8, extras: [] },
  },
  boomwing: {
    name: 'Boomwing', type: 'sound', desc: 'When it flaps its huge wings, you can hear a drum roll for miles.',
    base: { hp: 75, atk: 90, def: 70, spd: 95 }, baseXp: 160, catchRate: 0.12, learn: L('sound', 'ghost'), flies: true,
    model: { shape: 'bat', scale: 1.3, body: 0x1f7a72, accent: 0xffd84a, dark: 0x123a36, belly: 0x8fe8d8, extras: ['speakers'] },
  },
  drumbo: {
    name: 'Drumbo', type: 'sound', desc: 'Drums on its round belly to make friends. Everyone dances along.',
    base: { hp: 70, atk: 65, def: 65, spd: 40 }, baseXp: 95, catchRate: 0.35, learn: L('sound', 'grass'),
    evolve: { level: 22, into: 'bongorilla' },
    model: { shape: 'drum', scale: 0.95, body: 0xe0a050, accent: 0x4fd8c4, dark: 0x8a5a2a, belly: 0xf6e0b0, extras: ['notes'] },
  },

  /* --------- more creatures, so every type has six --------- */
  thundapple: {
    name: 'Thundapple', type: 'electric', desc: 'A big, crackling apple. Its crown of leaves stands up during storms.',
    base: { hp: 70, atk: 85, def: 65, spd: 95 }, baseXp: 155, catchRate: 0.15, learn: L('electric', 'grass'),
    model: { shape: 'blob', scale: 1.15, body: 0xf5d63d, accent: 0xff5a4a, dark: 0x6b5a14, belly: 0xfff4b0, extras: ['antenna', 'cheeks', 'crown'] },
  },
  cragling: {
    name: 'Cragling', type: 'rock', desc: 'A little rock piglet. It sharpens its tiny tusks on pebbles.',
    base: { hp: 45, atk: 65, def: 70, spd: 30 }, baseXp: 64, catchRate: 0.45, learn: L('rock', 'ice'),
    evolve: { level: 18, into: 'cragtusk' },
    model: { shape: 'quad', scale: 0.75, body: 0x9a8a70, accent: 0xf0ead0, dark: 0x5a5040, belly: 0xc0b498, extras: ['tusks', 'ears'] },
  },
  quartzle: {
    name: 'Quartzle', type: 'rock', desc: 'Crystals grow on its shoulders. They ring like bells when it walks.',
    base: { hp: 65, atk: 70, def: 95, spd: 45 }, baseXp: 110, catchRate: 0.3, learn: L('rock', 'rainbow'),
    model: { shape: 'crystal', scale: 1.0, body: 0xa8a0b8, accent: 0xe0c0ff, dark: 0x6a6478, belly: 0xd0c8e0, extras: [] },
  },
  woolumph: {
    name: 'Woolumph', type: 'normal', desc: 'So fluffy that birds build nests in its wool.',
    base: { hp: 90, atk: 70, def: 80, spd: 45 }, baseXp: 145, catchRate: 0.15, learn: L('normal', 'pixie'),
    model: { shape: 'quad', scale: 1.3, body: 0xf4f1ea, accent: 0xffb6c8, dark: 0x3b3430, belly: 0xffffff, extras: ['wool', 'ears', 'horns'] },
  },
  loudbeak: {
    name: 'Loudbeak', type: 'normal', desc: 'Its morning call can wake up a whole village.',
    base: { hp: 65, atk: 80, def: 60, spd: 95 }, baseXp: 140, catchRate: 0.2, learn: L('normal', 'sound'), flies: true,
    model: { shape: 'bird', scale: 1.15, body: 0xc8a070, accent: 0xffb030, dark: 0x6b4a2b, belly: 0xf0e0c0, extras: [] },
  },
  blizzbear: {
    name: 'Blizzbear', type: 'ice', desc: 'A huge polar bear that loves sliding down snowy hills.',
    base: { hp: 95, atk: 95, def: 80, spd: 55 }, baseXp: 165, catchRate: 0.12, learn: L('ice', 'rock'),
    model: { shape: 'quad', scale: 1.4, body: 0xf0f8ff, accent: 0x9fe0f0, dark: 0x7090a0, belly: 0xffffff, extras: ['ears', 'mane'] },
  },
  emperice: {
    name: 'Emperice', type: 'ice', desc: 'A proud bird that marches across the ice with its head held high.',
    base: { hp: 85, atk: 80, def: 90, spd: 60 }, baseXp: 160, catchRate: 0.12, learn: L('ice', 'water'),
    model: { shape: 'biped', scale: 1.15, body: 0x2a3a5a, accent: 0xffc040, dark: 0x1a2030, belly: 0xf0f8ff, extras: ['beak'] },
  },
  monarchwing: {
    name: 'Monarchwing', type: 'bug', desc: 'Its huge orange wings are covered in beautiful patterns.',
    base: { hp: 70, atk: 75, def: 60, spd: 100 }, baseXp: 150, catchRate: 0.15, learn: L('bug', 'pixie'), flies: true,
    model: { shape: 'butterfly', scale: 1.25, body: 0x3a2a1a, accent: 0xff9a2a, dark: 0x1a1a1a, belly: 0x5a4a3a, extras: ['wings'] },
  },
  lumimoth: {
    name: 'Lumimoth', type: 'bug', desc: 'A gentle moth whose glowing wings light up the forest at night.',
    base: { hp: 75, atk: 70, def: 70, spd: 90 }, baseXp: 155, catchRate: 0.12, learn: L('bug', 'electric'), flies: true,
    model: { shape: 'moth', scale: 1.2, body: 0x5a6a40, accent: 0xe0ff70, dark: 0x2a3018, belly: 0xc8e8a0, extras: ['wings', 'glow'] },
  },
  slumbergeist: {
    name: 'Slumbergeist', type: 'ghost', desc: 'The king of naps. Anyone nearby starts yawning.',
    base: { hp: 90, atk: 85, def: 85, spd: 60 }, baseXp: 170, catchRate: 0.1, learn: L('ghost', 'mind'), floats: true,
    model: { shape: 'blob', scale: 1.3, body: 0x8a7ab0, accent: 0xffd34a, dark: 0x4a3a6a, belly: 0xc0b0e0, extras: ['ghost', 'sleepy', 'crown'] },
  },
  shadeling: {
    name: 'Shadeling', type: 'ghost', desc: 'A small shadow that giggles and hides behind your back.',
    base: { hp: 40, atk: 60, def: 40, spd: 75 }, baseXp: 66, catchRate: 0.4, learn: L('ghost', 'cosmic'), floats: true,
    evolve: { level: 22, into: 'duskmare' },
    model: { shape: 'wisp', scale: 0.8, body: 0x3a2a5a, accent: 0xa070ff, dark: 0x1a1030, belly: 0x6a5a8a, extras: [] },
  },
  duskmare: {
    name: 'Duskmare', type: 'ghost', desc: 'A shadowy horse that gallops through the sky at sunset.',
    base: { hp: 75, atk: 95, def: 65, spd: 100 }, baseXp: 170, catchRate: 0.1, learn: L('ghost', 'cosmic'),
    model: { shape: 'tall', scale: 1.15, body: 0x3a2a5a, accent: 0xa070ff, dark: 0x1a1030, belly: 0x6a5a8a, extras: ['mane'] },
  },
  sageowl: {
    name: 'Sageowl', type: 'mind', desc: 'A wise old owl. It reads the stars to know what tomorrow brings.',
    base: { hp: 80, atk: 85, def: 75, spd: 90 }, baseXp: 160, catchRate: 0.12, learn: L('mind', 'cosmic'), flies: true,
    model: { shape: 'bird', scale: 1.25, body: 0x7a5aa0, accent: 0xffd84a, dark: 0x3a2a5a, belly: 0xd0c0f0, extras: ['owl'] },
  },
  dreamlet: {
    name: 'Dreamlet', type: 'mind', desc: 'It floats around while you sleep and gives you happy dreams.',
    base: { hp: 45, atk: 55, def: 45, spd: 60 }, baseXp: 66, catchRate: 0.4, learn: L('mind', 'pixie'), floats: true,
    evolve: { level: 20, into: 'visionelk' },
    model: { shape: 'cloud', scale: 0.75, body: 0xf0b0e0, accent: 0x8ae0ff, dark: 0xb070a0, belly: 0xffe0f6, extras: ['gem'] },
  },
  visionelk: {
    name: 'Visionelk', type: 'mind', desc: 'Its glowing antlers can see things far, far away.',
    base: { hp: 80, atk: 90, def: 75, spd: 90 }, baseXp: 165, catchRate: 0.12, learn: L('mind', 'pixie'),
    model: { shape: 'tall', scale: 1.0, body: 0xd0a0d0, accent: 0x8ae0ff, dark: 0x7a4a7a, belly: 0xf0d8f0, extras: ['antlers', 'thirdEye'] },
  },
  titanox: {
    name: 'Titanox', type: 'metal', desc: 'Its metal horn is stronger than any wall.',
    base: { hp: 95, atk: 100, def: 115, spd: 40 }, baseXp: 175, catchRate: 0.1, learn: L('metal', 'rock'),
    model: { shape: 'quad', scale: 1.4, body: 0x8a96a2, accent: 0xe0e8f0, dark: 0x3a424a, belly: 0xb8c4cf, extras: ['rhinoHorn', 'spikes'] },
  },
  nutlet: {
    name: 'Nutlet', type: 'metal', desc: 'A tiny metal beetle that collects lost screws and bolts.',
    base: { hp: 40, atk: 60, def: 80, spd: 35 }, baseXp: 64, catchRate: 0.45, learn: L('metal', 'grass'),
    evolve: { level: 20, into: 'rivetron' },
    model: { shape: 'nut', scale: 0.8, body: 0x9aa6b2, accent: 0xffc040, dark: 0x4a525a, belly: 0xc0c8d0, extras: ['horn'] },
  },
  rivetron: {
    name: 'Rivetron', type: 'metal', desc: 'A flying metal beetle. Its wings sound like tiny engines.',
    base: { hp: 70, atk: 90, def: 110, spd: 70 }, baseXp: 165, catchRate: 0.12, learn: L('metal', 'grass'), flies: true,
    model: { shape: 'drone', scale: 1.1, body: 0x7a8692, accent: 0xffc040, dark: 0x3a424a, belly: 0xb0b8c0, extras: ['horn'] },
  },
  venomamba: {
    name: 'Venomamba', type: 'toxic', desc: 'A long, fast snake. Its scales shine purple and green.',
    base: { hp: 75, atk: 100, def: 70, spd: 100 }, baseXp: 165, catchRate: 0.12, learn: L('toxic', 'drake'),
    model: { shape: 'serpent', scale: 1.3, body: 0x5a2a7a, accent: 0xa8f040, dark: 0x2a1a3a, belly: 0xc8a8e0, extras: ['fangs', 'spikes'] },
  },
  sporelet: {
    name: 'Sporelet', type: 'toxic', desc: 'A little mushroom that puffs out sleepy spores when it sneezes.',
    base: { hp: 50, atk: 50, def: 55, spd: 35 }, baseXp: 62, catchRate: 0.45, learn: L('toxic', 'grass'),
    evolve: { level: 18, into: 'fungrump' },
    model: { shape: 'blob', scale: 0.65, body: 0xf0e6d6, accent: 0xb040c0, dark: 0x7a5a4a, belly: 0xfff0e0, extras: ['cap'] },
  },
  fungrump: {
    name: 'Fungrump', type: 'toxic', desc: 'A grumpy giant mushroom. It stomps when it does not get its nap.',
    base: { hp: 90, atk: 85, def: 85, spd: 40 }, baseXp: 160, catchRate: 0.12, learn: L('toxic', 'grass'),
    model: { shape: 'biped', scale: 1.2, body: 0xf0e6d6, accent: 0x9a30b0, dark: 0x7a5a4a, belly: 0xfff0e0, extras: ['cap'] },
  },
  blossprite: {
    name: 'Blossprite', type: 'pixie', desc: 'A flower fairy. Gardens bloom wherever it dances.',
    base: { hp: 70, atk: 80, def: 65, spd: 105 }, baseXp: 150, catchRate: 0.15, learn: L('pixie', 'grass'), flies: true,
    model: { shape: 'bug', scale: 1.1, body: 0x7ac06a, accent: 0xff8ac8, dark: 0x3a6a3a, belly: 0xa8e098, extras: ['wings'] },
  },
  pompet: {
    name: 'Pompet', type: 'pixie', desc: 'A soft pink puffball. Hugging it makes you feel happy.',
    base: { hp: 50, atk: 45, def: 55, spd: 55 }, baseXp: 62, catchRate: 0.45, learn: L('pixie', 'sound'),
    evolve: { level: 18, into: 'pomperina' },
    model: { shape: 'puff', scale: 0.8, body: 0xffc0e0, accent: 0xffffff, dark: 0xd070a0, belly: 0xfff0f8, extras: [] },
  },
  pomperina: {
    name: 'Pomperina', type: 'pixie', desc: 'A graceful dancer that twirls on the tips of its toes.',
    base: { hp: 80, atk: 80, def: 75, spd: 90 }, baseXp: 155, catchRate: 0.12, learn: L('pixie', 'sound'),
    model: { shape: 'biped', scale: 1.0, body: 0xffc0e0, accent: 0xfff0a0, dark: 0xd070a0, belly: 0xfff0f8, extras: ['pixieWings', 'starHead'] },
  },
  wyrmlet: {
    name: 'Wyrmlet', type: 'drake', desc: 'A baby sky serpent that naps on top of clouds.',
    base: { hp: 45, atk: 60, def: 45, spd: 65 }, baseXp: 70, catchRate: 0.3, learn: L('drake', 'ice'),
    evolve: { level: 26, into: 'skywyrm' },
    model: { shape: 'serpent', scale: 0.8, body: 0x3ab0a0, accent: 0xffd84a, dark: 0x1a5a50, belly: 0xc0f0e8, extras: ['whiskers'] },
  },
  wyvlet: {
    name: 'Wyvlet', type: 'drake', desc: 'A little drake that practises flying by jumping off rocks.',
    base: { hp: 50, atk: 65, def: 55, spd: 55 }, baseXp: 72, catchRate: 0.3, learn: L('drake', 'electric'),
    evolve: { level: 26, into: 'stormwyvern' },
    model: { shape: 'wyvern', scale: 0.75, body: 0x5ac07a, accent: 0xffe060, dark: 0x2a6a3a, belly: 0xc0f0c0, extras: [] },
  },
  stormwyvern: {
    name: 'Stormwyvern', type: 'drake', desc: 'When it beats its wings, thunder rolls across the mountains.',
    base: { hp: 90, atk: 110, def: 80, spd: 95 }, baseXp: 185, catchRate: 0.08, learn: L('drake', 'electric'),
    model: { shape: 'wyvern', scale: 1.3, body: 0x3a9a5a, accent: 0xffe060, dark: 0x1a4a2a, belly: 0xb0e8b0, extras: ['big', 'spikes', 'bolt'] },
  },
  auroraptor: {
    name: 'Auroraptor', type: 'rainbow', desc: 'Its wings leave a glowing trail of colours across the night sky.',
    base: { hp: 85, atk: 95, def: 75, spd: 110 }, baseXp: 190, catchRate: 0.06, learn: L('rainbow', 'cosmic'), flies: true,
    model: { shape: 'bird', scale: 1.3, body: 0xffffff, accent: 0xffffff, dark: 0xdddddd, belly: 0xffffff, extras: ['rainbow'] },
  },
  shimmerfin: {
    name: 'Shimmerfin', type: 'rainbow', desc: 'A rare fish whose scales sparkle in every colour.',
    base: { hp: 50, atk: 60, def: 55, spd: 80 }, baseXp: 90, catchRate: 0.25, learn: L('rainbow', 'water'), swims: true, waterOnly: true,
    evolve: { level: 26, into: 'spectrafin' },
    model: { shape: 'fish', scale: 0.8, body: 0xffffff, accent: 0xffffff, dark: 0xdddddd, belly: 0xffffff, extras: ['rainbow'] },
  },
  spectrafin: {
    name: 'Spectrafin', type: 'rainbow', desc: 'Sailors say seeing one means good luck for a whole year.',
    base: { hp: 90, atk: 95, def: 85, spd: 95 }, baseXp: 190, catchRate: 0.06, learn: L('rainbow', 'water'), swims: true, waterOnly: true,
    model: { shape: 'fish', scale: 1.3, body: 0xffffff, accent: 0xffffff, dark: 0xdddddd, belly: 0xffffff, extras: ['longFins', 'rainbow'] },
  },
  lunaroo: {
    name: 'Lunaroo', type: 'cosmic', desc: 'It hops from mountain top to mountain top on moonlit nights.',
    base: { hp: 85, atk: 90, def: 70, spd: 100 }, baseXp: 160, catchRate: 0.12, learn: L('cosmic', 'pixie'),
    model: { shape: 'hopper', scale: 1.25, body: 0x5a64b8, accent: 0xffe680, dark: 0x2a3070, belly: 0xc8d0ff, extras: ['cape', 'crescentHorns'] },
  },
  meteorb: {
    name: 'Meteorb', type: 'cosmic', desc: 'A little rock that fell from space. It is still warm.',
    base: { hp: 45, atk: 55, def: 70, spd: 45 }, baseXp: 66, catchRate: 0.4, learn: L('cosmic', 'rock'), floats: true,
    evolve: { level: 24, into: 'comethorn' },
    model: { shape: 'planet', scale: 0.75, body: 0x6a5a7a, accent: 0xffb050, dark: 0x3a3048, belly: 0x8a7a9a, extras: [] },
  },
  comethorn: {
    name: 'Comethorn', type: 'cosmic', desc: 'It zooms across the sky with a long, glowing tail.',
    base: { hp: 80, atk: 100, def: 75, spd: 105 }, baseXp: 170, catchRate: 0.1, learn: L('cosmic', 'rock'), flies: true,
    model: { shape: 'comet', scale: 1.1, body: 0x4a4a8a, accent: 0xffb050, dark: 0x24244a, belly: 0x8a8ad0, extras: [] },
  },
  bongorilla: {
    name: 'Bongorilla', type: 'sound', desc: 'Drums on its chest so loudly that the trees shake.',
    base: { hp: 100, atk: 100, def: 80, spd: 50 }, baseXp: 165, catchRate: 0.12, learn: L('sound', 'grass'),
    model: { shape: 'ape', scale: 1.2, body: 0xc08040, accent: 0x4fd8c4, dark: 0x6a4020, belly: 0xf0d0a0, extras: ['drum', 'notes'] },
  },
  dinglet: {
    name: 'Dinglet', type: 'sound', desc: 'A tiny bell creature. It rings when it is happy.',
    base: { hp: 45, atk: 50, def: 60, spd: 55 }, baseXp: 64, catchRate: 0.45, learn: L('sound', 'metal'), floats: true,
    evolve: { level: 22, into: 'gongolin' },
    model: { shape: 'bell', scale: 0.75, body: 0xffd060, accent: 0x4fd8c4, dark: 0xa08020, belly: 0xfff0b0, extras: [] },
  },
  gongolin: {
    name: 'Gongolin', type: 'sound', desc: 'Its shell is a big golden gong. BONG!',
    base: { hp: 85, atk: 85, def: 100, spd: 50 }, baseXp: 160, catchRate: 0.12, learn: L('sound', 'metal', [[30, 'bigbong']]),
    model: { shape: 'armadillo', scale: 1.15, body: 0xc0a040, accent: 0xffe080, dark: 0x6a5020, belly: 0xf0e0a0, extras: ['notes'] },
  },

  /* ==== T4b group A (normal fire water grass electric rock ice): builder A only ==== */
  stitchums: {
    name: 'Stitchums', type: 'normal', desc: 'A patchwork teddy that came to life. Every patch is a hug it got from a friend.',
    base: { hp: 70, atk: 60, def: 60, spd: 50 }, baseXp: 85, catchRate: 0.4, learn: L('normal', 'pixie'),
    model: { shape: 'plushie', scale: 0.85, body: 0xc89a6a, accent: 0x7ac0e8, dark: 0x5a3a2a, belly: 0xf2c4d4, extras: [] },
  },
  waxwobble: {
    name: 'Waxwobble', type: 'fire', desc: 'A little candle that waddles around at night. Its flame flickers when it giggles.',
    base: { hp: 50, atk: 75, def: 50, spd: 65 }, baseXp: 90, catchRate: 0.35, learn: L('fire', 'ghost'),
    model: { shape: 'candle', scale: 0.8, body: 0xfff0d8, accent: 0xffb030, dark: 0x8a5a2a, belly: 0xffe6b8, extras: [] },
  },
  jellume: {
    name: 'Jellume', type: 'water', desc: 'A glowing jellyfish that bobs along the waves. Its tickly tentacles give tiny zaps.',
    base: { hp: 60, atk: 55, def: 65, spd: 60 }, baseXp: 90, catchRate: 0.35, learn: L('water', 'electric'), swims: true, waterOnly: true,
    model: { shape: 'jelly', scale: 0.85, body: 0x9ad8ff, accent: 0xff8ad8, dark: 0x4a7ab0, belly: 0xd8f2ff, extras: [] },
  },
  bonzoise: {
    name: 'Bonzoise', type: 'grass', desc: 'A slow tortoise with a tiny tree growing in its flowerpot shell. It trims the leaves itself.',
    base: { hp: 75, atk: 60, def: 85, spd: 25 }, baseXp: 95, catchRate: 0.35, learn: L('grass', 'water', [[15, 'hunker']]),
    model: { shape: 'bonsai', scale: 0.9, body: 0x8ab86a, accent: 0xff9ac0, dark: 0x5a3a20, belly: 0xc8683a, extras: [] },
  },
  wattwink: {
    name: 'Wattwink', type: 'electric', desc: 'A firefly whose tail is a light bulb. It blinks to say hello on warm nights.',
    base: { hp: 45, atk: 60, def: 45, spd: 95 }, baseXp: 95, catchRate: 0.35, learn: L('electric', 'bug'), flies: true,
    model: { shape: 'bulbfly', scale: 0.75, body: 0x3a3a5a, accent: 0xfff27a, dark: 0x8a8a98, belly: 0xfff8d0, extras: [] },
  },
  amethump: {
    name: 'Amethump', type: 'rock', desc: 'It looks like a plain round rock, until it opens up to show the purple crystals inside.',
    base: { hp: 55, atk: 70, def: 100, spd: 25 }, baseXp: 100, catchRate: 0.3, learn: L('rock', 'mind'),
    model: { shape: 'geode', scale: 0.85, body: 0x8a7a6a, accent: 0xc080ff, dark: 0x4a3a3a, belly: 0x6a4a8a, extras: [] },
  },
  flurrydome: {
    name: 'Flurrydome', type: 'ice', desc: 'A snow globe that hops about. Shake it gently and it fills with dancing snow.',
    base: { hp: 65, atk: 60, def: 80, spd: 40 }, baseXp: 95, catchRate: 0.35, learn: L('ice', 'rainbow', [[30, 'lullaby']]),
    model: { shape: 'globe', scale: 0.85, body: 0x6a4a3a, accent: 0xffffff, dark: 0x3a2a1a, belly: 0xdff6ff, extras: [] },
  },
  /* ==== end of T4b group A ==== */

  /* ==== T4b group B (bug ghost mind metal toxic pixie): builder B only ==== */
  /* ==== end of T4b group B ==== */

  /* ==== T4b group C (drake rainbow cosmic sound bone alien): builder C only ==== */
  /* ==== end of T4b group C ==== */

  /* legendary: one of a kind, never wild, never catchable */
  zenithar: {
    name: 'Zenithar', type: 'rainbow', legendary: true,
    desc: "A one-of-a-kind guardian. It lives at the top of the Champion's Tower.",
    base: { hp: 110, atk: 112, def: 100, spd: 100 }, baseXp: 250, catchRate: 0, flies: true,
    learn: [[1, 'prismray'], [1, 'starshard'], [30, 'rainbowburst'], [35, 'cometcrash'], [40, 'moonbeam'], [45, 'zenithray']],
    model: { shape: 'guardian', scale: 1.2, body: 0xfffaf0, accent: 0xffd84a, dark: 0x6a4ac8, belly: 0xffffff, extras: ['stars'] },
  },
  /* ------------------------------ bone ---------------------------- */
  skullop: {
    name: 'Skullop', type: 'bone', desc: 'A happy little skull that hops around clacking its jaw, as if it is always laughing.',
    base: { hp: 45, atk: 55, def: 60, spd: 50 }, baseXp: 64, catchRate: 0.45, learn: L('bone', 'ghost'),
    evolve: { level: 22, into: 'skullossal' },
    model: { shape: 'skull', scale: 0.75, body: 0xf2ead6, accent: 0x7fe0ff, dark: 0x3a3040, belly: 0xe0d6bc, extras: [] },
  },
  skullossal: {
    name: 'Skullossal', type: 'bone', desc: 'A giant skull with a bony crown. It rolls down hills and giggles all the way.',
    base: { hp: 80, atk: 95, def: 95, spd: 60 }, baseXp: 160, catchRate: 0.12, learn: L('bone', 'ghost'),
    model: { shape: 'skull', scale: 1.25, body: 0xe8dcc0, accent: 0xffb84a, dark: 0x2a2030, belly: 0xd8ccb0, extras: ['crown', 'horns'] },
  },
  rattlepup: {
    name: 'Rattlepup', type: 'bone', desc: 'A skeleton puppy. It wags its bony tail so hard that it rattles.',
    base: { hp: 50, atk: 60, def: 45, spd: 70 }, baseXp: 66, catchRate: 0.4, learn: L('bone', 'fire'),
    evolve: { level: 22, into: 'howlbone' },
    model: { shape: 'bonedog', scale: 0.85, body: 0xf4ecd8, accent: 0xe04a4a, dark: 0x4a3a30, belly: 0xd8ccb0, extras: [] },
  },
  howlbone: {
    name: 'Howlbone', type: 'bone', desc: 'A loyal skeleton hound. It guards old ruins and howls a song at the moon.',
    base: { hp: 80, atk: 100, def: 70, spd: 100 }, baseXp: 165, catchRate: 0.12, learn: L('bone', 'fire', [[30, 'rattledance']]),
    model: { shape: 'bonedog', scale: 1.3, body: 0xe6dcc4, accent: 0x4a7ae0, dark: 0x2a2228, belly: 0xcfc2a4, extras: ['bandana', 'spines'] },
  },
  dinobit: {
    name: 'Dinobit', type: 'bone', desc: 'A tiny fossil dino that hatched from a stone egg. It still wears a bit of the shell.',
    base: { hp: 55, atk: 60, def: 65, spd: 40 }, baseXp: 70, catchRate: 0.4, learn: L('bone', 'rock'),
    evolve: { level: 24, into: 'stompasaur' },
    model: { shape: 'dino', scale: 0.8, body: 0xeee2c4, accent: 0x8ad06a, dark: 0x5a4a36, belly: 0xffffff, extras: ['shell'] },
  },
  stompasaur: {
    name: 'Stompasaur', type: 'bone', desc: 'A huge dinosaur skeleton from long, long ago. It stomps gently so nobody gets scared.',
    base: { hp: 95, atk: 105, def: 90, spd: 50 }, baseXp: 170, catchRate: 0.1, learn: L('bone', 'rock'),
    model: { shape: 'dino', scale: 1.35, body: 0xe0d0aa, accent: 0xc0703a, dark: 0x3a2e22, belly: 0xf0e6d0, extras: ['plates'] },
  },

  /* ------------------------------ alien --------------------------- */
  saucerling: {
    name: 'Saucerling', type: 'alien', desc: 'A tiny flying saucer. A shy green pilot peeks out of the glass bubble.',
    base: { hp: 45, atk: 50, def: 50, spd: 70 }, baseXp: 66, catchRate: 0.4, learn: L('alien', 'electric'), flies: true,
    evolve: { level: 22, into: 'ufomax' },
    model: { shape: 'ufo', scale: 0.75, body: 0xc8d0dc, accent: 0x7dff6a, dark: 0x6a7080, belly: 0x8de060, extras: [] },
  },
  ufomax: {
    name: 'Ufomax', type: 'alien', desc: 'A big saucer with a gentle beam. It lifts lost toys back to their owners.',
    base: { hp: 75, atk: 90, def: 80, spd: 100 }, baseXp: 165, catchRate: 0.12, learn: L('alien', 'electric', [[30, 'mothership']]), flies: true,
    model: { shape: 'ufo', scale: 1.3, body: 0xb0b8c8, accent: 0xff6ad8, dark: 0x4a5060, belly: 0xa070e0, extras: ['beam', 'fins'] },
  },
  blipling: {
    name: 'Blipling', type: 'alien', desc: "A little visitor from space with three eyes. It says 'blip!' to say hello.",
    base: { hp: 45, atk: 55, def: 45, spd: 60 }, baseXp: 64, catchRate: 0.45, learn: L('alien', 'mind'),
    evolve: { level: 22, into: 'blipstar' },
    model: { shape: 'visitor', scale: 0.75, body: 0x8de060, accent: 0xc08cff, dark: 0x3a6a2a, belly: 0xd8ffc0, extras: [] },
  },
  blipstar: {
    name: 'Blipstar', type: 'alien', desc: 'It leads little visitors on trips across the stars. Its ray gun only blows bubbles.',
    base: { hp: 80, atk: 95, def: 70, spd: 90 }, baseXp: 160, catchRate: 0.12, learn: L('alien', 'mind'),
    model: { shape: 'visitor', scale: 1.15, body: 0x6ac850, accent: 0xb070ff, dark: 0x2a5a20, belly: 0xc8f8b0, extras: ['helmet', 'cape', 'raygun'] },
  },
  podlet: {
    name: 'Podlet', type: 'alien', desc: 'A wobbly space pod that landed in a crater. Its eyes pop up on stalks to look around.',
    base: { hp: 55, atk: 50, def: 65, spd: 40 }, baseXp: 66, catchRate: 0.4, learn: L('alien', 'toxic'),
    evolve: { level: 24, into: 'tallipod' },
    model: { shape: 'tripod', scale: 0.75, body: 0xa070e0, accent: 0x7dff6a, dark: 0x5a3a8a, belly: 0xd8c0ff, extras: ['stubby'] },
  },
  tallipod: {
    name: 'Tallipod', type: 'alien', desc: 'It walks on three long legs to peek over the trees. It collects shiny pebbles.',
    base: { hp: 90, atk: 90, def: 85, spd: 75 }, baseXp: 165, catchRate: 0.12, learn: L('alien', 'toxic'),
    model: { shape: 'tripod', scale: 1.1, body: 0x8a5ad0, accent: 0x9dff7a, dark: 0x4a2a7a, belly: 0xc8b0f0, extras: ['long'] },
  },
};

export const STARTERS = ['emberpup', 'sproutle', 'bubbuck'];

// Weighted spawn tables per biome (see World.biome). A third entry limits a spawn to 'day' or
// 'night'. Creatures live where they fit: ice ones in snowy places, cosmic ones out at night up
// high, toxic ones in swamps, pixies in flower meadows, fire and rock ones in the desert.
export const SPAWNS = {
  plains: [['fluffin', 5], ['hopsy', 4], ['chirpit', 4, 'day'], ['zapple', 3], ['ampup', 2], ['sproutle', 2],
    ['emberpup', 1], ['voltwing', 1], ['sparkitten', 1], ['bounceroo', 0.3], ['woolumph', 0.3], ['loudbeak', 0.3, 'day'],
    ['thundapple', 0.2], ['beetlet', 2, 'day'], ['thinkit', 2], ['dreamlet', 1.5, 'night'], ['owlucid', 1, 'night'],
    ['wispurr', 3, 'night'], ['snoozle', 2, 'night'], ['shadeling', 1, 'night'], ['glowbug', 2, 'night'],
    ['moonhop', 2, 'night'], ['starmite', 1, 'night'], ['drumbo', 1.5], ['sludgy', 1],
    ['prismkit', 0.25, 'day'], ['rainwing', 0.2, 'day'],
    ['saucerling', 1, 'night'], ['blipling', 0.8, 'night'], ['rattlepup', 0.8, 'night']],
  meadow: [['twinklet', 3, 'day'], ['pompet', 3, 'day'], ['petalfae', 3, 'day'], ['budling', 3], ['flutterby', 3, 'day'],
    ['dinglet', 2.5], ['hopsy', 2], ['fluffin', 2], ['chirpit', 2, 'day'], ['beetlet', 1], ['bloomora', 0.3],
    ['blossprite', 0.3, 'day'], ['pomperina', 0.2, 'day'], ['starbelle', 0.2, 'night'], ['monarchwing', 0.3, 'day'],
    ['glowbug', 2, 'night'], ['lumimoth', 0.3, 'night'], ['moonhop', 2, 'night'], ['dreamlet', 2, 'night'],
    ['woolumph', 0.2], ['prismkit', 0.3, 'day'], ['rainwing', 0.3, 'day'], ['auroraptor', 0.05, 'day'],
    ['blipling', 1.5, 'night'], ['blipstar', 0.2, 'night']],
  forest: [['sproutle', 4], ['thornox', 2], ['budling', 2], ['mossloth', 2], ['beetlet', 3], ['flutterby', 2, 'day'],
    ['hornbeetle', 0.4], ['chirpit', 1, 'day'], ['sludgy', 2], ['sporelet', 3], ['hissyfang', 1], ['fungrump', 0.3],
    ['twinklet', 1, 'day'], ['petalfae', 1, 'day'], ['wispurr', 3, 'night'], ['phantomaw', 0.4, 'night'],
    ['shadeling', 2, 'night'], ['duskmare', 0.2, 'night'], ['owlucid', 3, 'night'], ['sageowl', 0.2, 'night'],
    ['echobat', 2, 'night'], ['glowbug', 2, 'night'], ['drumbo', 1], ['bongorilla', 0.2]],
  swamp: [['sludgy', 4], ['gloopor', 0.4], ['hissyfang', 3], ['venomamba', 0.2], ['sporelet', 2], ['fungrump', 0.3],
    ['bubbuck', 2], ['shellby', 2], ['ripplet', 1], ['joltail', 1], ['beetlet', 2], ['mossloth', 1],
    ['glowbug', 2, 'night'], ['lumimoth', 0.3, 'night'], ['wispurr', 2, 'night'], ['snoozle', 1, 'night'],
    ['slumbergeist', 0.2, 'night'], ['echobat', 1, 'night'],
    ['skullop', 1.5, 'night'], ['rattlepup', 1, 'night']],
  beach: [['bubbuck', 4], ['shellby', 4], ['gullop', 3], ['emberpup', 2], ['sparkitten', 2], ['zapple', 1],
    ['clanklet', 1], ['dinglet', 1], ['gongolin', 0.3], ['rainwing', 0.3, 'day'],
    ['dinobit', 0.8]],
  water: [['bubbuck', 2], ['ripplet', 3], ['joltail', 2], ['shellby', 1], ['gullop', 1], ['torrentide', 0.3],
    ['shimmerfin', 0.5], ['spectrafin', 0.08]],
  desert: [['magmole', 3], ['sparkitten', 3], ['emberpup', 2], ['cragling', 3], ['pebblor', 2], ['zapple', 2],
    ['ampup', 2], ['nutlet', 2], ['clanklet', 1], ['hissyfang', 1], ['flarehawk', 1], ['voltwing', 1],
    ['pyrolynx', 0.3], ['cragtusk', 0.5], ['thundapple', 0.2], ['venomamba', 0.2],
    ['wispurr', 1, 'night'], ['starmite', 1, 'night'], ['meteorb', 1, 'night'],
    ['rattlepup', 2], ['dinobit', 2], ['podlet', 1.5], ['skullop', 1.5, 'night'], ['saucerling', 0.8, 'night'], ['howlbone', 0.2],
    ['stompasaur', 0.15], ['skullossal', 0.15, 'night'], ['tallipod', 0.2, 'night']],
  mountain: [['pebblor', 4], ['magmole', 2], ['cragtusk', 2], ['geodrake', 2], ['cragling', 2], ['quartzle', 2],
    ['monolor', 0.4], ['flarehawk', 2], ['voltwing', 1], ['clanklet', 3], ['ironhorn', 2], ['nutlet', 2],
    ['mechanox', 0.3], ['titanox', 0.2], ['rivetron', 0.2], ['thinkit', 1], ['cerebrix', 0.2], ['visionelk', 0.3],
    ['scalekin', 1], ['wyvlet', 1], ['wyrmlet', 0.5], ['scalewing', 0.1], ['stormwyvern', 0.1], ['skywyrm', 0.1],
    ['echobat', 2], ['boomwing', 0.2], ['snoozle', 1, 'night'],
    ['starmite', 2, 'night'], ['meteorb', 2, 'night'], ['galaxor', 0.2, 'night'],
    ['dinobit', 1], ['saucerling', 1, 'night'], ['podlet', 1, 'night'], ['tallipod', 0.15, 'night']],
  snow: [['frostling', 4], ['snowpaw', 3], ['waddlice', 3], ['blizzbear', 0.4], ['emperice', 0.4], ['glacieron', 0.5],
    ['geodrake', 1], ['ironhorn', 1], ['scalekin', 1], ['quartzle', 1], ['skywyrm', 0.2], ['prismkit', 0.2, 'day'],
    ['wispurr', 1, 'night'], ['moonhop', 1.5, 'night'], ['starmite', 2, 'night'], ['meteorb', 1.5, 'night'],
    ['blipling', 1, 'night']],
  taiga: [['frostling', 3], ['snowpaw', 3], ['waddlice', 2], ['blizzbear', 0.3], ['emperice', 0.3], ['glacieron', 0.2],
    ['fluffin', 1], ['woolumph', 0.3], ['hopsy', 1], ['owlucid', 2, 'night'], ['sageowl', 0.2, 'night'],
    ['wispurr', 2, 'night'], ['duskmare', 0.2, 'night'], ['phantomaw', 0.2, 'night'], ['echobat', 1, 'night'],
    ['moonhop', 2, 'night'], ['lunaroo', 0.2, 'night'], ['dreamlet', 1, 'night'], ['starmite', 1, 'night']],
  // The highest peaks, where star crystals grow: cosmic creatures come out here at night.
  peak: [['quartzle', 3], ['frostling', 2], ['wyrmlet', 2], ['skywyrm', 0.3], ['scalewing', 0.1], ['stormwyvern', 0.2],
    ['glacieron', 0.4], ['rivetron', 0.3], ['titanox', 0.2], ['monolor', 0.3], ['cerebrix', 0.2], ['visionelk', 0.3],
    ['boomwing', 0.3], ['rainwing', 0.4, 'day'], ['auroraptor', 0.1, 'day'],
    ['starmite', 3, 'night'], ['meteorb', 3, 'night'], ['galaxor', 0.3, 'night'], ['comethorn', 0.3, 'night'],
    ['lunaroo', 0.3, 'night'],
    ['saucerling', 1, 'night'], ['blipling', 0.8, 'night'], ['ufomax', 0.2, 'night']],
  // Caves under the hills: rock, metal and ghost creatures, bats and glowing bugs.
  cave: [['echobat', 4], ['pebblor', 3], ['cragling', 3], ['magmole', 2], ['quartzle', 2], ['nutlet', 2],
    ['clanklet', 1], ['sporelet', 2], ['glowbug', 2], ['wispurr', 2], ['shadeling', 1.5], ['geodrake', 0.5],
    ['starmite', 0.5, 'night'], ['fungrump', 0.2], ['monolor', 0.2], ['lumimoth', 0.2], ['boomwing', 0.15], ['phantomaw', 0.1],
    ['skullop', 2], ['dinobit', 1.5], ['rattlepup', 1], ['podlet', 0.5], ['skullossal', 0.15], ['stompasaur', 0.1]],
};

// T4b: each type's 7th creature. Kept per group so three builders never edit the same lines.
const SEVENTH_A = {
  plains: [['stitchums', 1.2], ['wattwink', 0.8, 'night']],
  meadow: [['stitchums', 0.8, 'day'], ['wattwink', 1, 'night']],
  cave: [['waxwobble', 1], ['amethump', 1.5]],
  desert: [['waxwobble', 0.6, 'night']],
  water: [['jellume', 1.2]],
  forest: [['bonzoise', 1]],
  swamp: [['bonzoise', 0.8], ['wattwink', 0.6, 'night']],
  mountain: [['amethump', 1]],
  snow: [['flurrydome', 1]],
  taiga: [['flurrydome', 0.8]],
  peak: [['flurrydome', 0.4]],
};

const SEVENTH_B = {
};

const SEVENTH_C = {
};

for (const extra of [SEVENTH_A, SEVENTH_B, SEVENTH_C]) for (const [biome, list] of Object.entries(extra)) SPAWNS[biome].push(...list);

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

// knownMoves: keep these moves (for copies of an existing creature) instead of the usual ones.
export function makeCreature(species, level, knownMoves) {
  const sp = SPECIES[species];
  const moves = sp.learn.filter(([l]) => l <= level).map(([, m]) => m);
  const keep = (knownMoves || []).filter(m => MOVES[m]);
  const c = {
    uid: Math.random().toString(36).slice(2, 10),
    species, level, xp: xpForLevel(level), hp: 0,
    moves: keep.length ? [...new Set(keep)].slice(0, 4) : [...new Set(moves)].slice(-4),
  };
  c.learned = keep.length ? [...c.moves] : [...new Set(moves)]; // moves already offered (see gainXp)
  c.hp = statsFor(c).maxHp;
  return c;
}

// The 36 moves that existed before the big move update (old saves have no `learned` list).
const OLD_MOVE_IDS = ['tackle', 'quickjab', 'bodyslam', 'ember', 'flameburst', 'bubble', 'tidecrash', 'leafcut', 'vinelash',
  'spark', 'thunderjolt', 'pebbleshot', 'rockslam', 'hyperstrike', 'icebreath', 'blizzard', 'bugbite', 'stingbarrage',
  'shadowsneak', 'phantomstrike', 'mindpulse', 'brainwave', 'clank', 'ironbash', 'sludgespit', 'toxiccloud', 'pixiedust',
  'moonbeam', 'scaleswipe', 'drakeroar', 'prismray', 'rainbowburst', 'starshard', 'cometcrash', 'echoping', 'bassblast'];

function offerMove(c, m, msgs, ask, offered) {
  if (c.moves.includes(m) || offered.has(m)) return;
  offered.add(m);
  if (c.moves.length < 4) {
    c.moves.push(m);
    if (!c.learned.includes(m)) c.learned.push(m);
    msgs.push(`${nameOf(c)} learned ${MOVES[m].name}!`);
  } else if (ask) {
    msgs.push({ learn: m }); // the battle asks which move to forget and records it in c.learned
  } else {
    c.moves.push(m);
    if (!c.learned.includes(m)) c.learned.push(m);
    msgs.push(`${nameOf(c)} forgot ${MOVES[c.moves.shift()].name}...`);
    msgs.push(`${nameOf(c)} learned ${MOVES[m].name}!`);
  }
}

// Adds XP and handles level-ups, new moves and evolution. Returns messages to show.
// With { ask: true } (in battles) a full move list does not forget anything by itself: the message
// list gets { learn: moveId } and the battle asks which move to forget (see Battle.askForget).
export function gainXp(c, amount, { ask = false } = {}) {
  const msgs = [];
  let evolved = false;
  const offered = new Set();
  // Creatures saved before the new moves existed: the old moves count as already offered.
  c.learned ??= [...new Set([...c.moves, ...OLD_MOVE_IDS])];
  c.xp += amount;
  while (c.level < 60 && c.xp >= xpForLevel(c.level + 1)) {
    const before = statsFor(c).maxHp;
    c.level++;
    c.hp += statsFor(c).maxHp - before;
    msgs.push(`${nameOf(c)} grew to Lv ${c.level}!`);
    // 1. moves for this exact level; 2. catch-up: one older move this creature never had a chance at
    for (const [l, m] of SPECIES[c.species].learn) if (l === c.level) offerMove(c, m, msgs, ask, offered);
    const older = SPECIES[c.species].learn.filter(([l, m]) => l < c.level && !c.moves.includes(m) && !c.learned.includes(m) && !offered.has(m));
    if (older.length) offerMove(c, older.sort((a, b) => a[0] - b[0])[0][1], msgs, ask, offered);
    const evo = SPECIES[c.species].evolve;
    if (evo && c.level >= evo.level) {
      const oldName = nameOf(c);
      const oldMax = statsFor(c).maxHp;
      c.species = evo.into;
      c.hp += statsFor(c).maxHp - oldMax;
      msgs.push(`What? ${oldName} is evolving...`);
      msgs.push(`${oldName} evolved into ${nameOf(c)}!`);
      evolved = true;
      // a move waiting at this level for the new species must not be lost
      for (const [l, m] of SPECIES[c.species].learn) if (l === c.level) offerMove(c, m, msgs, ask, offered);
    }
  }
  return { msgs, evolved };
}

/* ------------------------------------------------------------------ */
/* Blocky models. Every model faces +Z and stands on y = 0.            */
/* ------------------------------------------------------------------ */

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
  if (has('cap')) mushroomCap(bodyGroup, m, 0.72, 1.05);
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
  if (has('cap')) mushroomCap(head, m, 0.2, 0.85);
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
  if (has('drum')) {
    box(root, 0.6, 0.42, 0.14, m.accent, 0, 0.8, 0.36);
    box(root, 0.5, 0.32, 0.02, 0xfdf6e8, 0, 0.8, 0.44);
    for (const y of [0.6, 1.0]) box(root, 0.64, 0.05, 0.16, 0xffffff, 0, y, 0.36);
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
  } else if (has('batEars')) {
    for (const s of [-1, 1]) {
      const ear = box(head, 0.14, 0.32, 0.06, m.dark, s * 0.13, 0.28, -0.02);
      ear.rotation.z = -s * 0.25;
      box(ear, 0.07, 0.2, 0.02, m.belly, 0, -0.02, 0.035);
    }
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
  ({ quad: buildQuad, blob: buildBlob, biped: buildBiped, bird: buildBird, serpent: buildSerpent, bug: buildBug, ...SHAPES })[m.shape](root, m, parts);
  if (m.extras.includes('rainbow')) {
    // Each block gets its own colour from the rainbow; animateModel makes the colours flow.
    parts.rainbow = [];
    let i = 0;
    group.traverse(o => {
      if (o.isMesh && !o.userData.eye) parts.rainbow.push({ mat: o.material, offset: (i++ * 0.13) % 1 });
    });
    for (const r of parts.rainbow) r.mat.color.setHSL(r.offset, 0.75, 0.62);
  }
  if (m.extras.includes('stars') || m.extras.includes('notes')) {
    const bb = new THREE.Box3().setFromObject(root);
    const c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
    // Little glowing stars floating around the body.
    if (m.extras.includes('stars')) {
      for (let k = 0; k < 6; k++) {
        const a = k * 2.4;
        glow(box(root, 0.08, 0.08, 0.08, m.accent, c.x + Math.cos(a) * (size.x / 2 + 0.12),
          bb.min.y + size.y * (0.3 + 0.12 * (k % 4)), c.z + Math.sin(a) * (size.z / 2 + 0.12)), m.accent);
      }
    }
    // Two music notes above the head.
    if (m.extras.includes('notes')) {
      for (const [dx, dy] of [[-0.22, 0.12], [0.2, 0.26]]) {
        const note = pivot(root, c.x + dx, bb.max.y + dy, c.z);
        glow(box(note, 0.12, 0.09, 0.05, m.accent, 0, 0, 0), m.accent);
        box(note, 0.03, 0.22, 0.03, m.accent, 0.045, 0.11, 0);
        box(note, 0.08, 0.04, 0.03, m.accent, 0.08, 0.2, 0);
      }
    }
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
  for (const s of p.spin || []) s.g.rotation[s.axis] = t * s.speed;
  for (const w of p.wobble || []) w.g.rotation[w.axis] = Math.sin(t * w.speed + w.phase) * w.amp;
  if (p.bounce) {
    if (p.float || p.hover) {
      p.bounce.position.y = 0.35 + Math.sin(t * 2) * 0.12;
    } else {
      const hop = moving ? Math.abs(Math.sin(t * 7)) * 0.18 : Math.abs(Math.sin(t * 2.2)) * 0.04;
      p.bounce.position.y = hop;
      p.bounce.scale.set(1 + (0.18 - hop) * 0.2, 1 - (0.18 - hop) * 0.15, 1 + (0.18 - hop) * 0.2);
    }
  }
  for (const s of p.segments || []) s.g.position.x = Math.sin(t * (moving ? 8 : 3) - s.i * 0.9) * (moving ? 0.14 : 0.05) * s.i * 0.5;
  for (const f of p.flap || []) f.g.rotation.z = -f.s * (0.5 + Math.abs(Math.sin(t * (moving ? 9 : 3))) * 0.9);
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
