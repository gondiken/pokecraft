// Creature data (types, moves, species), stat/XP math and blocky 3D models.
import * as THREE from 'three';
import { B } from './blocks.js';
import { TRAITS, drawTraits, gainTraits } from './traits.js';
import { SHAPES, box, pivot, eyes, glow, zigzag, addWings, gem, mushroomCap, sparkleGeometry } from './shapes.js';

export const TYPE_COLORS = {
  normal: '#c6c59a', fire: '#f2914a', water: '#7aa4f5', grass: '#8fd166', electric: '#f7d84a', rock: '#c9b45a',
  ice: '#9fe0f0', bug: '#b5c84a', ghost: '#a48ad0',
  mind: '#f584b8', metal: '#b8c4cf', toxic: '#b36ad6', pixie: '#ffb8e6', drake: '#7f6cf0',
  rainbow: 'linear-gradient(90deg,#ff7a7a,#ffd36b,#8fe388,#7ab8ff,#c99bff)',
  cosmic: 'linear-gradient(90deg,#8e9bff,#e7c6ff)', sound: '#4fd8c4',
  bone: '#e9e0c9', alien: 'linear-gradient(90deg,#8dff6a,#b98cff)',
  sky: 'linear-gradient(180deg,#8fd0ff,#e8f6ff)', slime: 'linear-gradient(180deg,#b4f56a,#52d08a)',
  light: 'radial-gradient(circle,#ffffff 20%,#ffe27a)',
  paper: 'repeating-linear-gradient(180deg,#fffdf6 0 4px,#cfe0f7 4px 5px)',
  time: 'linear-gradient(180deg,#ffe08a,#ff9a5a)',
  camo: 'radial-gradient(circle at 30% 35%,#5f8f45 22%,transparent 23%),radial-gradient(circle at 72% 68%,#8a7a4a 20%,transparent 21%),#a8c07a',
  cyber: 'repeating-linear-gradient(90deg,#8ff4ff 0 6px,#5ab8ff 6px 7px)',
  cozy: 'repeating-linear-gradient(45deg,#ffb48a 0 6px,#ffd8b8 6px 12px)',
  treasure: 'linear-gradient(135deg,#fff3a8,#ffd23a 45%,#ffb020 55%,#fff0a0)',
  // Wave 11 (T33-T36)
  food: 'linear-gradient(90deg,#ff6a4a 50%,#ffd24a 50%)',
  squad: 'repeating-linear-gradient(90deg,#ff9f5a 0 5px,#5ab0e0 5px 10px,#8ad46a 10px 15px)',
  dream: 'linear-gradient(135deg,#b49cff,#ffb3e6,#9ce8ff)',
  parkour: 'linear-gradient(180deg,#ff5a4a 0 40%,#ffffff 40% 55%,#ff5a4a 55%)',
};

// attacker type -> defender type -> multiplier (missing = 1)
const EFFECTIVENESS = {
  normal: { rock: 0.5, metal: 0.5, ghost: 0, bone: 0.5, slime: 0.5, camo: 0.5, treasure: 0.5 },
  fire: { grass: 2, ice: 2, bug: 2, metal: 2, fire: 0.5, water: 0.5, rock: 0.5, drake: 0.5, rainbow: 0.5, paper: 2, food: 2 },
  water: { fire: 2, rock: 2, bone: 2, water: 0.5, grass: 0.5, drake: 0.5, rainbow: 0.5, cyber: 2 },
  grass: { water: 2, rock: 2, fire: 0.5, grass: 0.5, bug: 0.5, metal: 0.5, toxic: 0.5, drake: 0.5, slime: 2, sky: 0.5, camo: 0.5 },
  electric: { water: 2, sound: 2, alien: 2, bone: 0.5, electric: 0.5, grass: 0.5, rock: 0.5, drake: 0.5, sky: 2, light: 0.5, cyber: 0.5, squad: 2 },
  rock: { fire: 2, electric: 2, ice: 2, bug: 2, grass: 0.5, metal: 0.5, slime: 0.5, paper: 0.5, parkour: 0.5 },
  ice: { grass: 2, bug: 2, drake: 2, fire: 0.5, water: 0.5, ice: 0.5, metal: 0.5, sky: 2, cozy: 0.5, food: 0.5 },
  bug: { grass: 2, mind: 2, ghost: 0.5, fire: 0.5, rock: 0.5, metal: 0.5, pixie: 0.5, sky: 0.5, time: 2, cyber: 2, cozy: 2, food: 2 },
  ghost: { ghost: 2, mind: 2, rainbow: 2, cosmic: 2, normal: 0, squad: 0.5 },
  // New types
  mind: { toxic: 2, drake: 2, cosmic: 2, mind: 0.5, metal: 0.5, alien: 0.5, camo: 0.5, dream: 0.5 },
  metal: { ice: 2, rock: 2, pixie: 2, metal: 0.5, fire: 0.5, water: 0.5, electric: 0.5, paper: 2 },
  toxic: { grass: 2, pixie: 2, toxic: 0.5, rock: 0.5, ghost: 0.5, bone: 0.5, metal: 0, light: 2, cozy: 2, treasure: 2, food: 2 },
  pixie: { drake: 2, ghost: 2, fire: 0.5, metal: 0.5, toxic: 0.5, light: 0.5 },
  drake: { drake: 2, bone: 2, metal: 0.5, pixie: 0 },
  rainbow: { ghost: 2, toxic: 2, mind: 2, metal: 0.5, rainbow: 0.5 },
  // Cosmic beats sound, sound beats mind, mind beats cosmic.
  cosmic: { rock: 2, drake: 2, sound: 2, metal: 0.5, cosmic: 0.5, rainbow: 0.5, alien: 0.5, light: 2, time: 2 },
  sound: { ice: 2, bug: 2, mind: 2, alien: 2, metal: 0.5, sound: 0.5, cosmic: 0.5, camo: 2, squad: 2 },
  // Bone and Alien: skeletons are not scared of ghosts or aliens; aliens love normal creatures' surprise.
  bone: { ghost: 2, electric: 2, alien: 2, metal: 0.5, grass: 0.5 },
  alien: { normal: 2, metal: 2, toxic: 2, cosmic: 0.5, alien: 0.5 },
  // Sky, Slime, Light, Paper: wind blows paper away, paper shades light, light dries slime, slime glues wings.
  sky: { fire: 2, paper: 2, pixie: 2, rock: 0.5, metal: 0.5 },
  slime: { metal: 2, sky: 2, sound: 2, slime: 0.5, toxic: 0.5, paper: 0.5, treasure: 2, parkour: 2 },
  light: { ghost: 2, slime: 2, cosmic: 2, light: 0.5, rainbow: 0.5, paper: 0.5, camo: 2, dream: 2 },
  paper: { rock: 2, slime: 2, light: 2, fire: 0.5, metal: 0.5, paper: 0.5 },
  // Time, Camo, Cyber: time rusts metal, crumbles old paper and dries up slime; camo sneaks up on bugs and
  // minds can't find it; cyber hacks metal and minds and goes paperless.
  time: { metal: 2, paper: 2, slime: 2, time: 0.5, cosmic: 0.5, ghost: 0.5, dream: 2 },
  camo: { bug: 2, mind: 2, camo: 0.5, light: 0.5, metal: 0.5 },
  cyber: { metal: 2, mind: 2, paper: 2, cyber: 0.5, grass: 0.5, water: 0.5, treasure: 2 },
  // Cozy and Treasure: cozy warms up ice, nothing is scary at home, and you put the screens away to cuddle;
  // treasure distracts drakes and pixies with gold and outshines a blanket.
  // Cozy beats cyber, cyber beats treasure, treasure beats cozy.
  cozy: { ice: 2, ghost: 2, cyber: 2, cozy: 0.5, dream: 0.5 },
  treasure: { drake: 2, pixie: 2, cozy: 2, treasure: 0.5 },
  // Wave 11: Food, Squad, Parkour, Dream. A pizza party breaks up the squad, a crowd blocks the runner, a runner
  // jumps right out of a dream, and dream food is gone when you wake up. Many eyes find a camo creature;
  // a real runner beats a video game; dreams are more colourful than rainbows.
  // Food beats squad, squad beats parkour, parkour beats dream, dream beats food.
  food: { squad: 2, alien: 2, treasure: 2, food: 0.5, bug: 0.5, toxic: 0.5, metal: 0.5 },
  squad: { parkour: 2, camo: 2, normal: 2, squad: 0.5, sky: 0.5, slime: 0.5 },
  parkour: { dream: 2, bone: 2, cyber: 2, parkour: 0.5, sky: 0.5, ghost: 0.5, slime: 0.5 },
  dream: { food: 2, time: 2, rainbow: 2, dream: 0.5, light: 0.5, cyber: 0.5 },
};
export const effectiveness = (moveType, defType) => EFFECTIVENESS[moveType]?.[defType] ?? 1;

// Moves. One small effect each (fx), shown in the battle log and on the move buttons:
//   heal {amount} (status, user) · raise {stat:'atk'|'def', chance?} (user) · lower {stat:'atk'|'spd', chance?} (foe)
//   flinch {chance} · sleep {chance?} · multi {min, max} · recoil {amount}
// power 0 = status move (no damage). sure: true = never misses. sig: true = signature move.
// Some names changed on screen; the ids stay the same so old saves keep working.
const mv = (name, type, power, acc, extra = {}) => ({ name, type, power, acc, ...extra });
// Multi-hit moves: how often they hit 1, 2, 3, 4, 5 times (out of 10). 2 or 3 is most common.
export const HITS_1_5 = [1, 3, 3, 2, 1];

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
  seedvolley: mv('Seed Volley', 'grass', 20, 1, { fx: { kind: 'multi', min: 1, max: 5, weights: HITS_1_5 } }),
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
  rivetshot: mv('Rivet Shot', 'metal', 20, 1, { fx: { kind: 'multi', min: 1, max: 5, weights: HITS_1_5 } }),
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
  meteorshower: mv('Meteor Shower', 'cosmic', 20, 1, { fx: { kind: 'multi', min: 1, max: 5, weights: HITS_1_5 } }),
  cometcrash: mv('Comet Crash', 'cosmic', 75, 0.9),
  supernova: mv('Supernova', 'cosmic', 100, 0.85),
  echoping: mv('Echo Ping', 'sound', 40, 1),
  shriek: mv('Shriek', 'sound', 55, 1, { fx: { kind: 'flinch', chance: 0.3 } }),
  bassblast: mv('Bass Blast', 'sound', 75, 0.9),
  lullaby: mv('Lullaby', 'sound', 0, 0.75, { fx: { kind: 'sleep' } }),
  bonebonk: mv('Bone Bonk', 'bone', 40, 1),
  bonetoss: mv('Bone Toss', 'bone', 20, 1, { fx: { kind: 'multi', min: 1, max: 5, weights: HITS_1_5 } }),
  fossilcrush: mv('Fossil Crush', 'bone', 75, 0.9),
  dinostomp: mv('Dino Stomp', 'bone', 95, 0.85, { fx: { kind: 'flinch', chance: 0.2 } }),
  rattledance: mv('Rattle Dance', 'bone', 80, 1, { fx: { kind: 'raise', stat: 'atk', chance: 0.5 }, sig: true }),
  beepbeam: mv('Beep Beam', 'alien', 40, 1),
  tractorbeam: mv('Tractor Beam', 'alien', 55, 1, { fx: { kind: 'lower', stat: 'spd', chance: 0.5 } }),
  ufoblast: mv('UFO Blast', 'alien', 75, 0.9),
  gravityflip: mv('Gravity Flip', 'alien', 90, 0.9, { fx: { kind: 'flinch', chance: 0.2 } }),
  mothership: mv('Mothership', 'alien', 90, 1, { sure: true, sig: true }),
  bigbong: mv('Big Bong', 'sound', 85, 0.9, { fx: { kind: 'sleep', chance: 0.3 }, sig: true }),
  breezepuff: mv('Breeze Puff', 'sky', 40, 1),
  swoop: mv('Swoop', 'sky', 50, 1, { priority: 1 }),
  cloudburst: mv('Cloud Burst', 'sky', 75, 0.9),
  tornadospin: mv('Tornado Spin', 'sky', 95, 0.85, { fx: { kind: 'flinch', chance: 0.2 } }),
  jetstream: mv('Jet Stream', 'sky', 80, 1, { priority: 1, sig: true }),
  slimeshot: mv('Slime Shot', 'slime', 40, 1),
  stickygoo: mv('Sticky Goo', 'slime', 55, 1, { fx: { kind: 'lower', stat: 'spd', chance: 0.5 } }),
  slimeslam: mv('Slime Slam', 'slime', 75, 0.9),
  goopatch: mv('Goo Patch', 'slime', 0, 1, { fx: { kind: 'heal', amount: 0.5 } }),
  megasplat: mv('Mega Splat', 'slime', 90, 0.95, { fx: { kind: 'lower', stat: 'spd', chance: 0.3 }, sig: true }),
  glint: mv('Glint', 'light', 40, 1),
  flashbulb: mv('Flash Bulb', 'light', 55, 1, { fx: { kind: 'flinch', chance: 0.3 } }),
  sunbeam: mv('Sunbeam', 'light', 75, 0.9),
  sunburst: mv('Sun Burst', 'light', 100, 0.85),
  beaconbeam: mv('Beacon Beam', 'light', 90, 1, { sure: true, sig: true }),
  paperflick: mv('Paper Flick', 'paper', 40, 1),
  confetti: mv('Confetti', 'paper', 20, 1, { fx: { kind: 'multi', min: 1, max: 5, weights: HITS_1_5 } }),
  foldslam: mv('Fold Slam', 'paper', 75, 0.9),
  inksplat: mv('Ink Splat', 'paper', 0, 0.95, { fx: { kind: 'lower', stat: 'atk' } }),
  thousandcranes: mv('Thousand Cranes', 'paper', 22, 1, { fx: { kind: 'multi', min: 3, max: 5 }, sure: true, sig: true }),
  secondhand: mv('Second Hand', 'time', 40, 1),
  fastforward: mv('Fast Forward', 'time', 50, 1, { priority: 1 }),
  hourstrike: mv('Hour Strike', 'time', 75, 0.9),
  rewind: mv('Rewind', 'time', 0, 1, { fx: { kind: 'heal', amount: 0.5 } }),
  snoozebutton: mv('Snooze', 'time', 0, 0.75, { fx: { kind: 'sleep' } }), // id is not 'snooze': that is a sound effect
  wakeupcall: mv('Wake-Up Call', 'time', 90, 1, { fx: { kind: 'flinch', chance: 0.3 }, sig: true }),
  peekaboo: mv('Peekaboo', 'camo', 40, 1),
  surprise: mv('Surprise!', 'camo', 55, 1, { fx: { kind: 'flinch', chance: 0.3 } }),
  blendbash: mv('Blend Bash', 'camo', 75, 0.9),
  lielow: mv('Lie Low', 'camo', 0, 1, { fx: { kind: 'raise', stat: 'def' } }),
  statueslam: mv('Statue Slam', 'camo', 90, 1, { sure: true, sig: true }),
  pixelpop: mv('Pixel Pop', 'cyber', 40, 1),
  rapidclick: mv('Rapid Click', 'cyber', 20, 1, { fx: { kind: 'multi', min: 1, max: 5, weights: HITS_1_5 } }),
  glitchbeam: mv('Glitch Beam', 'cyber', 75, 0.9),
  firewall: mv('Firewall', 'cyber', 0, 1, { fx: { kind: 'raise', stat: 'def' } }),
  megabyte: mv('Mega Byte', 'cyber', 90, 0.95, { fx: { kind: 'flinch', chance: 0.2 }, sig: true }),
  snuggle: mv('Snuggle', 'cozy', 40, 1),
  pillowfight: mv('Pillow Fight', 'cozy', 20, 1, { fx: { kind: 'multi', min: 1, max: 5, weights: HITS_1_5 } }),
  warmhug: mv('Warm Hug', 'cozy', 75, 0.9),
  hotcocoa: mv('Hot Cocoa', 'cozy', 0, 1, { fx: { kind: 'heal', amount: 0.5 } }),
  bedtimestory: mv('Bedtime Story', 'cozy', 0, 0.75, { fx: { kind: 'sleep' } }),
  lightsout: mv('Lights Out', 'cozy', 85, 0.9, { fx: { kind: 'sleep', chance: 0.3 }, sig: true }),
  coinflip: mv('Coin Flip', 'treasure', 40, 1),
  gemtoss: mv('Gem Toss', 'treasure', 20, 1, { fx: { kind: 'multi', min: 1, max: 5, weights: HITS_1_5 } }),
  goldrush: mv('Gold Rush', 'treasure', 75, 0.9),
  bling: mv('Bling!', 'treasure', 0, 0.95, { fx: { kind: 'lower', stat: 'atk' } }),
  crownjewel: mv('Crown Jewel', 'treasure', 90, 1, { sure: true, sig: true }),
};

// T25 big-decision moves: one kind (the mechanic) each, a name per type. Learned at these levels:
export const BIG_LEVEL = { shield: 21, rally: 22, curse: 24, field: 26, risky: 29, sacrifice: 32, lastword: 34 };
export const BIG_KINDS = Object.keys(BIG_LEVEL);
const BIG_FX = {
  rally: { atk: 1, def: -2 },          // whole team +1 attack (bench too) until the battle ends; user -2 defence
  shield: { turns: 3, cut: 0.3 },      // whole team takes 30% less for 3 turns; user rests its next move
  risky: { odds: 0.5, times: 3 },      // 50%: x3, else the user hits itself with power 60
  sacrifice: { atk: 1 },               // user faints; the next one in gets full HP and +1 attack
  curse: { odds: 0.4, spd: -1 },       // 40%: foe team -1 speed (bench too)
  field: { turns: 5, boost: 1.5 },     // one type x1.5 for 5 turns, both sides
  lastword: { below: 0.25 },           // only usable below 1/4 HP
};
// [id, name, kind, book text] per type (plans/T25-table.md)
const BIG_MOVES = {
  normal: [
    ['goteamgo', 'Go Team Go!', 'rally', 'Whole team hits harder. You get softer.'],
    ['standtogether', 'Stand Together', 'shield', 'Team takes less damage. You rest next turn.'],
    ['nevergiveup', 'Never Give Up', 'lastword', 'A huge hit! Only when you are almost out.'],
  ],
  fire: [
    ['wildblaze', 'Wild Blaze', 'risky', 'Half the time: triple hit! Or it burns you.'],
    ['lastember', 'Last Ember', 'lastword', 'A huge fire hit, only when almost out.'],
  ],
  water: [
    ['wavegoodbye', 'Wave Goodbye', 'sacrifice', 'You leave. Next friend comes in fresh and strong.'],
    ['hightide', 'High Tide', 'field', 'Water moves are stronger for 5 turns. Foes too!'],
  ],
  grass: [
    ['leafyroof', 'Leafy Roof', 'shield', 'Leaves cover the team. You rest next turn.'],
    ['seedgift', 'Seed Gift', 'sacrifice', 'You leave. Next friend comes in fresh and strong.'],
    ['gardenbloom', 'Garden Bloom', 'field', 'Grass moves are stronger for 5 turns. Foes too!'],
  ],
  electric: [
    ['livewire', 'Live Wire', 'risky', 'Half the time: triple hit! Or it zaps you.'],
    ['staticfuzz', 'Static Fuzz', 'curse', 'Might slow down the whole foe team.'],
  ],
  rock: [
    ['stonefort', 'Stone Fort', 'shield', 'Team takes less damage. You rest next turn.'],
    ['cliffcrash', 'Cliff Crash', 'lastword', 'A huge rock hit, only when almost out.'],
  ],
  ice: [
    ['bigfreeze', 'Big Freeze', 'curse', 'Might make the whole foe team slow and chilly.'],
    ['snowday', 'Snow Day', 'field', 'Ice moves are stronger for 5 turns. Foes too!'],
  ],
  bug: [
    ['hivehum', 'Hive Hum', 'rally', 'Whole team hits harder. You get softer.'],
    ['cobwebtangle', 'Cobweb Tangle', 'curse', 'Might slow down the whole foe team.'],
  ],
  ghost: [
    ['poof', 'Poof!', 'sacrifice', 'You go poof! Next friend comes in fresh.'],
    ['spookyshiver', 'Spooky Shiver', 'curse', 'Might make the whole foe team slow.'],
  ],
  mind: [
    ['mindbubble', 'Mind Bubble', 'shield', 'A bubble guards the team. You rest next turn.'],
    ['slowthoughts', 'Slow Thoughts', 'curse', 'Might slow down the whole foe team.'],
    ['thinktank', 'Think Tank', 'field', 'Mind moves are stronger for 5 turns. Foes too!'],
  ],
  metal: [
    ['metalumbrella', 'Metal Umbrella', 'shield', 'Team takes less damage. You rest next turn.'],
    ['wreckingball', 'Wrecking Ball', 'risky', 'Half the time: triple hit! Or it bonks you.'],
  ],
  toxic: [
    ['fizzypotion', 'Fizzy Potion', 'risky', 'Half the time: triple hit! Or you drink it.'],
    ['stinkyfog', 'Stinky Fog', 'curse', 'Might slow down the whole foe team.'],
  ],
  pixie: [
    ['sparklecheer', 'Sparkle Cheer', 'rally', 'Whole team hits harder. You get softer.'],
    ['daisyring', 'Daisy Ring', 'shield', 'Flowers guard the team. You rest next turn.'],
  ],
  drake: [
    ['bravebellow', 'Brave Bellow', 'rally', 'Whole team hits harder. You get softer.'],
    ['scalestorm', 'Scale Storm', 'lastword', 'A huge drake hit, only when almost out.'],
  ],
  rainbow: [
    ['prismdome', 'Prism Dome', 'shield', 'Colors guard the team. You rest next turn.'],
    ['colorcarnival', 'Color Carnival', 'field', 'Rainbow moves are stronger for 5 turns. Foes too!'],
  ],
  cosmic: [
    ['luckystar', 'Lucky Star', 'risky', 'Half the time: triple hit! Or it hits you.'],
    ['starrynight', 'Starry Night', 'field', 'Cosmic moves are stronger for 5 turns. Foes too!'],
    ['bigbang', 'Big Bang', 'lastword', 'A huge space hit, only when almost out.'],
  ],
  sound: [
    ['battlesong', 'Battle Song', 'rally', 'Whole team hits harder. You get softer.'],
    ['earringer', 'Ear Ringer', 'curse', 'Might slow down the whole foe team.'],
  ],
  bone: [
    ['falltopieces', 'Fall to Pieces', 'sacrifice', 'You fall apart. Next friend comes in fresh.'],
    ['dinocomeback', 'Dino Comeback', 'lastword', 'A huge bone hit, only when almost out.'],
  ],
  alien: [
    ['mysterybutton', 'Mystery Button', 'risky', 'Half the time: triple hit! Or it hits you.'],
    ['slowmoray', 'Slow-Mo Ray', 'curse', 'Might slow down the whole foe team.'],
  ],
  sky: [
    ['cloudcushion', 'Cloud Cushion', 'shield', 'Clouds guard the team. You rest next turn.'],
    ['windyday', 'Windy Day', 'field', 'Sky moves are stronger for 5 turns. Foes too!'],
  ],
  slime: [
    ['jellywall', 'Jelly Wall', 'shield', 'Jelly guards the team. You rest next turn.'],
    ['meltaway', 'Melt Away', 'sacrifice', 'You melt away. Next friend comes in fresh.'],
  ],
  light: [
    ['shinebright', 'Shine Bright', 'rally', 'Whole team hits harder. You get softer.'],
    ['daylightglow', 'Daylight Glow', 'field', 'Light moves are stronger for 5 turns. Foes too!'],
  ],
  paper: [
    ['pepposter', 'Pep Poster', 'rally', 'Whole team hits harder. You get softer.'],
    ['foldaway', 'Fold Away', 'sacrifice', 'You fold up. Next friend comes in fresh.'],
  ],
  time: [
    ['rushhour', 'Rush Hour', 'field', 'Time moves are stronger for 5 turns. Foes too!'],
    ['lastsecond', 'Last Second', 'lastword', 'A huge hit, only when almost out.'],
  ],
  camo: [
    ['sneakyleap', 'Sneaky Leap', 'risky', 'Half the time: triple hit! Or you trip.'],
    ['decoyswap', 'Decoy Swap', 'sacrifice', 'You leave. Next friend comes in fresh and strong.'],
  ],
  cyber: [
    ['levelboost', 'Level Up!', 'rally', 'Whole team hits harder. You get softer.'],
    ['lagspike', 'Lag Spike', 'curse', 'Might slow down the whole foe team.'],
    ['wifizone', 'Wi-Fi Zone', 'field', 'Cyber moves are stronger for 5 turns. Foes too!'],
  ],
  cozy: [
    ['grouphug', 'Group Hug', 'shield', 'A hug guards the team. You rest next turn.'],
    ['tuckin', 'Tuck In', 'sacrifice', 'You go to bed. Next friend comes in fresh.'],
  ],
  treasure: [
    ['jackpot', 'Jackpot', 'risky', 'Half the time: triple hit! Or it hits you.'],
    ['treasurehunt', 'Treasure Hunt', 'field', 'Treasure moves are stronger for 5 turns. Foes too!'],
  ],
};
/* ==== T36 parkour ==== */
Object.assign(MOVES, {
  wallhop: mv('Wall Hop', 'parkour', 40, 1),
  flipkick: mv('Flip Kick', 'parkour', 75, 0.9),
  quickvault: mv('Quick Vault', 'parkour', 50, 1, { priority: 1 }),
  warmup: mv('Warm Up', 'parkour', 0, 1, { fx: { kind: 'raise', stat: 'atk' } }),
  rooftoprun: mv('Rooftop Run', 'parkour', 85, 1, { priority: 1, sig: true }),
});
BIG_MOVES.parkour = [
  ['tripleflip', 'Triple Flip', 'risky', 'Half the time: triple hit! Or you land on your bottom.'],
  ['finalsprint', 'Final Sprint', 'lastword', 'A huge hit, only when almost out.'],
];
/* ==== end of T36 parkour ==== */
for (const [type, list] of Object.entries(BIG_MOVES)) for (const [id, name, kind, book] of list) {
  const power = kind === 'risky' ? 60 : kind === 'lastword' ? 140 : 0;
  MOVES[id] = mv(name, type, power, 1, { fx: { kind, ...BIG_FX[kind] }, sure: kind !== 'risky', big: true, book });
}
const BIG = Object.fromEntries(Object.entries(BIG_MOVES).map(([t, list]) => [t, list.map(([id, , kind]) => [BIG_LEVEL[kind], id])]));
export const isBig = id => !!MOVES[id]?.big;

// Extra tags and the Book note per big kind (T is the capitalised type name).
const BIG_NOTES = {
  rally: { tags: () => ['team attack up', 'lowers your defence'], note: () => 'Attack +1 for every creature on your team, also the ones waiting, until the battle ends. Your defence goes down 2.' },
  shield: { tags: () => ['team shield for 3 turns', 'you rest next turn'], note: () => 'For 3 turns your whole team takes 30% less damage. The user has to rest on its next turn.' },
  risky: { tags: () => ['half the time x3, or it hits you'], note: () => 'Half the time it hits 3 times as hard. The other half it hits the user instead!' },
  sacrifice: { tags: () => ['you faint', 'next friend comes in fresh'], note: () => 'The user faints. The next creature comes in with full HP and more attack. Only works when a friend can come in.' },
  curse: { tags: () => ['may slow the whole foe team'], note: () => 'Works 4 times out of 10. Then every foe, also the ones waiting, is slower until the battle ends.' },
  field: { tags: T => [`${T} moves stronger for 5 turns`], note: T => `For 5 turns ${T} moves are 50% stronger. For the foe too!` },
  lastword: { tags: () => ['only below 1/4 HP'], note: () => 'Only works when the user has less than 1/4 of its HP left.' },
};

// Short, kid-friendly words for what a move does. Used on battle buttons, the forget prompt and the Book.
export function moveInfo(id) {
  const m = MOVES[id];
  const tags = [];
  if (!m) return { tags, text: '', note: '' };
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
  let note = '';
  const big = m.big && BIG_NOTES[fx.kind];
  if (big) {
    const T = m.type[0].toUpperCase() + m.type.slice(1);
    tags.push(...big.tags(T));
    note = `${m.book} ${big.note(T)}`;
  } else if (fx?.kind === 'sleep') note = 'A sleeping creature skips 2 or 3 turns and gets hurt a bit more. Three hits in a row wake it up!';
  else if (fx?.kind === 'multi') note = fx.weights
    ? 'Hits 1 to 5 times, most often 2 or 3. The third hit wakes up a sleeping foe!'
    : `Hits ${fx.min} to ${fx.max} times. The third hit wakes up a sleeping foe!`;
  return { tags, text: tags.join(' · '), note };
}

// How many times a multi-hit move hits, from ONE random number r in [0, 1).
export function multiHits(fx, r) {
  if (fx.weights) {
    let x = r * fx.weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < fx.weights.length; i++) { x -= fx.weights[i]; if (x < 0) return fx.min + i; }
    return fx.max;
  }
  return fx.min + Math.floor(r * (fx.max - fx.min + 1));
}

// Standard learnset for a type: a weak move at first, then stronger and more varied ones. Every
// creature also gets a move from a "second" type so two creatures of one type are not the same.
const T1 = {
  fire: 'ember', water: 'bubble', grass: 'leafcut', electric: 'spark', rock: 'pebbleshot', ice: 'icebreath', bug: 'bugbite',
  ghost: 'shadowsneak', mind: 'mindpulse', metal: 'clank', toxic: 'sludgespit', pixie: 'pixiedust', drake: 'scaleswipe', rainbow: 'prismray',
  cosmic: 'starshard', sound: 'echoping', bone: 'bonebonk', alien: 'beepbeam',
  sky: 'breezepuff', slime: 'slimeshot', light: 'glint', paper: 'paperflick',
  time: 'secondhand', camo: 'peekaboo', cyber: 'pixelpop', cozy: 'snuggle', treasure: 'coinflip',
};
const T2 = {
  fire: 'flameburst', water: 'tidecrash', grass: 'vinelash', electric: 'thunderjolt', rock: 'rockslam', ice: 'blizzard', bug: 'stingbarrage',
  ghost: 'phantomstrike', mind: 'brainwave', metal: 'ironbash', toxic: 'toxiccloud', pixie: 'moonbeam', drake: 'drakeroar', rainbow: 'rainbowburst',
  cosmic: 'cometcrash', sound: 'bassblast', bone: 'fossilcrush', alien: 'ufoblast',
  sky: 'cloudburst', slime: 'slimeslam', light: 'sunbeam', paper: 'foldslam',
  time: 'hourstrike', camo: 'blendbash', cyber: 'glitchbeam', cozy: 'warmhug', treasure: 'goldrush',
};
const T3 = {
  fire: 'flarekick', water: 'soakshot', grass: 'seedvolley', electric: 'staticsnap', rock: 'rumblerock',
  ice: 'chillwind', bug: 'buzzdive', ghost: 'boo', mind: 'mindtrick', metal: 'rivetshot', toxic: 'goopshot',
  pixie: 'glitterpuff', drake: 'clawrake', rainbow: 'colorsplash', cosmic: 'meteorshower', sound: 'shriek', bone: 'bonetoss', alien: 'tractorbeam',
  sky: 'swoop', slime: 'stickygoo', light: 'flashbulb', paper: 'confetti',
  time: 'fastforward', camo: 'surprise', cyber: 'rapidclick', cozy: 'pillowfight', treasure: 'gemtoss',
};
const T4 = {
  fire: 'infernodash', water: 'bigwave', grass: 'sapsip', electric: 'stormcall', rock: 'boulderdrop',
  ice: 'glacierslam', bug: 'silkwrap', ghost: 'gloomwave', mind: 'deepfocus', metal: 'ironwall', toxic: 'stinkbomb',
  pixie: 'sweetdreams', drake: 'drakecharge', rainbow: 'shimmer', cosmic: 'supernova', sound: 'lullaby', bone: 'dinostomp', alien: 'gravityflip',
  sky: 'tornadospin', slime: 'goopatch', light: 'sunburst', paper: 'inksplat',
  time: 'rewind', camo: 'lielow', cyber: 'firewall', cozy: 'hotcocoa', treasure: 'bling',
};
// Types whose T4 is a big hit get a normal helper move at 23; the others get Belly Bash.
const UTIL = { fire: 'pumpup', water: 'restup', electric: 'grumble', rock: 'hunker', ice: 'hunker',
  ghost: 'grumble', toxic: 'hunker', drake: 'pumpup', cosmic: 'restup', bone: 'hunker', alien: 'pumpup', sky: 'pumpup', light: 'restup' };
const SNZ = [[16, 'snoozebutton']]; // Time creatures can learn Snooze
const BTS = [[16, 'bedtimestory']]; // sleepy Cozy creatures learn Bedtime Story
/* ==== T36 parkour ==== */
T1.parkour = 'wallhop'; T2.parkour = 'flipkick'; T3.parkour = 'quickvault'; T4.parkour = 'warmup';
/* ==== end of T36 parkour ==== */
function L(type, second, extra = []) {
  const base = type === 'normal'
    ? [[1, 'tackle'], [1, 'quickjab'], [8, T1[second]], [12, 'bodyslam'], [19, T3[second]], [23, 'restup'], [28, 'hyperstrike']]
    : [[1, 'tackle'], [1, T1[type]], [7, 'quickjab'], [10, T3[type]], [13, T2[type]], [19, T3[second]],
       [23, UTIL[type] || 'bodyslam'], [28, T4[type]]];
  return [...base, ...extra, ...(BIG[type] || [])].filter(([, m]) => m).sort((a, b) => a[0] - b[0]); // no slot for a type = no move
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
  twirlshell: {
    name: 'Twirlshell', type: 'bug', desc: 'A snail with a swirly shell. It is never in a hurry and leaves a shiny trail.',
    base: { hp: 55, atk: 55, def: 95, spd: 25 }, baseXp: 85, catchRate: 0.4, learn: L('bug', 'toxic', [[15, 'hunker']]),
    model: { shape: 'snail', scale: 0.85, body: 0xb8d86a, accent: 0xffa040, dark: 0x6a4a2a, belly: 0xe0f0a0, extras: [] },
  },
  lanterboo: {
    name: 'Lanterboo', type: 'ghost', desc: 'A friendly paper lantern with a little ghost inside. It lights the way for lost travellers.',
    base: { hp: 50, atk: 65, def: 50, spd: 75 }, baseXp: 95, catchRate: 0.3, learn: L('ghost', 'fire'), floats: true,
    model: { shape: 'lantern', scale: 0.8, body: 0xffe0a0, accent: 0xffa84a, dark: 0x5a3a6a, belly: 0xfff4d8, extras: [] },
  },
  origrane: {
    name: 'Origrane', type: 'paper', desc: 'A paper bird folded by a wish. It thinks so hard that its forehead glows.',
    base: { hp: 50, atk: 70, def: 50, spd: 85 }, baseXp: 100, catchRate: 0.3, learn: L('paper', 'mind', [[30, 'thousandcranes']]), flies: true,
    model: { shape: 'crane', scale: 1.15, body: 0xfff4f4, accent: 0xf0386a, dark: 0xd8708f, belly: 0xffd0dc, extras: [] },
  },
  tickatin: {
    name: 'Tickatin', type: 'metal', desc: 'A tin wind-up mouse. When its key stops turning, it sits down for a little nap.',
    base: { hp: 55, atk: 70, def: 85, spd: 45 }, baseXp: 100, catchRate: 0.3, learn: L('metal', 'electric'),
    model: { shape: 'windup', scale: 0.8, body: 0x6ab0e0, accent: 0xe04a4a, dark: 0x5a6070, belly: 0xd8dde4, extras: [] },
  },
  gurglepot: {
    name: 'Gurglepot', type: 'toxic', desc: 'A jug-shaped plant full of bubbly goo. It burps loudly, then says sorry.',
    base: { hp: 70, atk: 70, def: 65, spd: 35 }, baseXp: 95, catchRate: 0.35, learn: L('toxic', 'grass'),
    model: { shape: 'pitcher', scale: 0.9, body: 0x7ac04a, accent: 0xd04a7a, dark: 0x3a6a2a, belly: 0xb06ad6, extras: [] },
  },
  cuppix: {
    name: 'Cuppix', type: 'pixie', desc: 'A teacup with fairy wings. It sloshes warm tea at anyone who is mean.',
    base: { hp: 55, atk: 55, def: 60, spd: 70 }, baseXp: 95, catchRate: 0.35, learn: L('pixie', 'fire'), floats: true,
    model: { shape: 'teacup', scale: 0.75, body: 0xfff6fa, accent: 0xff8ac8, dark: 0x8a5a3a, belly: 0xffd8ec, extras: [] },
  },
  /* ==== end of T4b group B ==== */

  /* ==== T4b group C (drake rainbow cosmic sound bone alien): builder C only ==== */
  nimbrake: {
    name: 'Nimbrake', type: 'drake', desc: 'A drake made of fluffy clouds. When it sneezes, tiny lightning bolts come out.',
    base: { hp: 60, atk: 80, def: 60, spd: 75 }, baseXp: 110, catchRate: 0.2, learn: L('drake', 'electric'), flies: true,
    model: { shape: 'nimbus', scale: 0.85, body: 0xf4f8ff, accent: 0xffe060, dark: 0x6a7aa0, belly: 0xc8d8f0, extras: [] },
  },
  chromacurl: {
    name: 'Chromacurl', type: 'rainbow', desc: 'A curly-tailed lizard whose colours slowly change. It is very hard to spot!',
    base: { hp: 55, atk: 70, def: 60, spd: 85 }, baseXp: 110, catchRate: 0.2, learn: L('rainbow', 'bug'),
    model: { shape: 'chameleon', scale: 0.85, body: 0x6ad06a, accent: 0xffd84a, dark: 0x2a6a3a, belly: 0xd8f0a0, extras: [] },
  },
  voidle: {
    name: 'Voidle', type: 'cosmic', desc: 'A soft little black hole. It pulls in socks and crumbs, but always gives them back.',
    base: { hp: 50, atk: 65, def: 60, spd: 70 }, baseXp: 100, catchRate: 0.3, learn: L('cosmic', 'ghost'), floats: true,
    model: { shape: 'blackhole', scale: 0.8, body: 0x2a1a4a, accent: 0xb08aff, dark: 0x120a20, belly: 0x4a2a7a, extras: [] },
  },
  clawdio: {
    name: 'Clawdio', type: 'sound', desc: 'A crab with a jukebox shell. It snaps its claws to the beat of its own songs.',
    base: { hp: 60, atk: 70, def: 80, spd: 45 }, baseXp: 100, catchRate: 0.3, learn: L('sound', 'water'),
    model: { shape: 'jukebox', scale: 0.85, body: 0xd0603a, accent: 0x4ae0d0, dark: 0x5a2a1a, belly: 0xffd890, extras: ['notes'] },
  },
  finnibone: {
    name: 'Finnibone', type: 'bone', desc: 'A fish skeleton that swims through dark cave lakes as if it were still alive. It loves a splashy race.',
    base: { hp: 50, atk: 70, def: 55, spd: 75 }, baseXp: 95, catchRate: 0.35, learn: L('bone', 'water'), floats: true,
    model: { shape: 'fishbone', scale: 0.85, body: 0xf2ead6, accent: 0x7fe0ff, dark: 0x3a3040, belly: 0xe0d6bc, extras: [] },
  },
  zorbit: {
    name: 'Zorbit', type: 'alien', desc: 'A space hamster rolling around in a glass ball. It came to Earth to find the best snacks.',
    base: { hp: 50, atk: 60, def: 70, spd: 80 }, baseXp: 100, catchRate: 0.3, learn: L('alien', 'cosmic'),
    model: { shape: 'zorb', scale: 0.8, body: 0x9de07a, accent: 0xc08cff, dark: 0x3a6a2a, belly: 0xd8f0ff, extras: [] },
  },
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
    name: 'Skullossal', type: 'bone', desc: 'A giant skull with a bony crown. It rolls down cave slopes and giggles all the way.',
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

  /* ==== T9 sky: builder SKY only ==== */
  kiteling: {
    name: 'Kiteling', type: 'sky', desc: 'A little diamond kite with a ribbon tail. It giggles when the wind tickles it.',
    base: { hp: 40, atk: 50, def: 40, spd: 75 }, baseXp: 64, catchRate: 0.45, learn: L('sky', 'electric'), flies: true,
    evolve: { level: 22, into: 'kitegale' },
    model: { shape: 'kite', scale: 0.75, body: 0x6ab8ff, accent: 0xffd84a, dark: 0x2a4a80, belly: 0xffffff, extras: [] },
  },
  kitegale: {
    name: 'Kitegale', type: 'sky', desc: 'A grand dragon kite. It dances in the strongest winds and never gets its string tangled.',
    base: { hp: 70, atk: 90, def: 60, spd: 110 }, baseXp: 160, catchRate: 0.12, learn: L('sky', 'electric', [[30, 'jetstream']]), flies: true,
    model: { shape: 'kite', scale: 1.2, body: 0xe04a4a, accent: 0xffc23d, dark: 0x5a1a1a, belly: 0xfff0d0, extras: ['dragon'] },
  },
  balloony: {
    name: 'Balloony', type: 'sky', desc: 'A tiny hot-air balloon with a picnic basket for feet. It puffs warm air to float higher.',
    base: { hp: 55, atk: 45, def: 50, spd: 45 }, baseXp: 64, catchRate: 0.45, learn: L('sky', 'fire'), floats: true,
    evolve: { level: 22, into: 'zeppeluff' },
    model: { shape: 'balloon', scale: 0.8, body: 0xff9a4a, accent: 0xffffff, dark: 0x8a4a2a, belly: 0xc8a060, extras: [] },
  },
  zeppeluff: {
    name: 'Zeppeluff', type: 'sky', desc: 'A big, fluffy airship. Its little propeller hums a happy tune as it drifts over the hills.',
    base: { hp: 95, atk: 80, def: 80, spd: 60 }, baseXp: 160, catchRate: 0.12, learn: L('sky', 'fire'), floats: true,
    model: { shape: 'balloon', scale: 1.1, body: 0xb8a0ff, accent: 0xffe08a, dark: 0x4a3a7a, belly: 0xc8a060, extras: ['blimp'] },
  },
  skyfin: {
    name: 'Skyfin', type: 'sky', desc: 'A baby whale that swims through the clouds. It blows puffs of cloud from its blowhole.',
    base: { hp: 60, atk: 55, def: 50, spd: 55 }, baseXp: 66, catchRate: 0.4, learn: L('sky', 'water'), flies: true,
    evolve: { level: 24, into: 'whaloft' },
    model: { shape: 'skywhale', scale: 0.8, body: 0x7ab8e8, accent: 0xffffff, dark: 0x2a4a7a, belly: 0xe8f4ff, extras: [] },
  },
  whaloft: {
    name: 'Whaloft', type: 'sky', desc: 'A huge whale that sails across the sky. Its song can be heard above the mountains.',
    base: { hp: 110, atk: 90, def: 80, spd: 55 }, baseXp: 170, catchRate: 0.1, learn: L('sky', 'water'), flies: true,
    model: { shape: 'skywhale', scale: 1.05, body: 0x4a7ac8, accent: 0xffffff, dark: 0x1a2a5a, belly: 0xd8ecff, extras: ['clouds'] },
  },
  pinwhirl: {
    name: 'Pinwhirl', type: 'sky', desc: 'A pinwheel flower that spins in the breeze. The faster it spins, the happier it is.',
    base: { hp: 55, atk: 70, def: 55, spd: 80 }, baseXp: 100, catchRate: 0.3, learn: L('sky', 'grass'),
    model: { shape: 'pinwheel', scale: 0.9, body: 0x6ac850, accent: 0xff6a8a, dark: 0x2a5a2a, belly: 0x6ab8ff, extras: [] },
  },
  /* ==== end of T9 sky ==== */

  /* ==== T9 slime: builder SLIME only ==== */
  wobblock: {
    name: 'Wobblock', type: 'slime', desc: 'A wobbly jelly cube. You can see a lost marble floating inside it.',
    base: { hp: 55, atk: 45, def: 70, spd: 35 }, baseXp: 64, catchRate: 0.45, learn: L('slime', 'pixie'),
    evolve: { level: 22, into: 'jigglestack' },
    model: { shape: 'gelcube', scale: 0.75, body: 0x8af0b0, accent: 0xff5a7a, dark: 0x2a7a5a, belly: 0xd8ffe8, extras: [] },
  },
  jigglestack: {
    name: 'Jigglestack', type: 'slime', desc: 'Three jelly cubes stacked up like a tower. Each one jiggles to its own beat.',
    base: { hp: 90, atk: 80, def: 105, spd: 45 }, baseXp: 160, catchRate: 0.12, learn: L('slime', 'pixie'),
    model: { shape: 'gelcube', scale: 1.1, body: 0xb08aff, accent: 0xffd84a, dark: 0x4a2a8a, belly: 0xf0e0ff, extras: ['stack'] },
  },
  dripple: {
    name: 'Dripple', type: 'slime', desc: 'A drop of slime with a curly top. It leaves a sparkly, sticky trail.',
    base: { hp: 50, atk: 55, def: 50, spd: 55 }, baseXp: 64, catchRate: 0.45, learn: L('slime', 'water'),
    evolve: { level: 24, into: 'slimperor' },
    model: { shape: 'drip', scale: 0.75, body: 0x9cf06a, accent: 0xff8ad8, dark: 0x3a7a2a, belly: 0xe0ffc0, extras: [] },
  },
  slimperor: {
    name: 'Slimperor', type: 'slime', desc: 'The king of all slimes. It wears a crown and a cape made of goo, and loves bubble baths.',
    base: { hp: 95, atk: 95, def: 85, spd: 55 }, baseXp: 170, catchRate: 0.1, learn: L('slime', 'water', [[30, 'megasplat']]),
    model: { shape: 'drip', scale: 1.3, body: 0x6ad0a0, accent: 0xffd84a, dark: 0x1a5a4a, belly: 0xc0f0e0, extras: ['crown', 'cape'] },
  },
  goopup: {
    name: 'Goopup', type: 'slime', desc: 'A gooey puppy. It drips a little when it wags, so watch your shoes!',
    base: { hp: 50, atk: 60, def: 45, spd: 65 }, baseXp: 66, catchRate: 0.4, learn: L('slime', 'toxic'),
    evolve: { level: 22, into: 'slimehound' },
    model: { shape: 'slimedog', scale: 0.8, body: 0x7ae070, accent: 0xc07af0, dark: 0x2a6a2a, belly: 0xd0ffc8, extras: [] },
  },
  slimehound: {
    name: 'Slimehound', type: 'slime', desc: 'A big slime dog that bounces instead of running. It can squeeze under any door.',
    base: { hp: 80, atk: 100, def: 70, spd: 90 }, baseXp: 165, catchRate: 0.12, learn: L('slime', 'toxic'),
    model: { shape: 'slimedog', scale: 1.25, body: 0x4ac8a0, accent: 0xffd84a, dark: 0x1a5a4a, belly: 0xc0f0e0, extras: ['spikes'] },
  },
  gumbear: {
    name: 'Gumbear', type: 'slime', desc: 'A jelly bear that smells like strawberries. It wobbles when it walks.',
    base: { hp: 70, atk: 70, def: 65, spd: 45 }, baseXp: 95, catchRate: 0.35, learn: L('slime', 'pixie'),
    model: { shape: 'gummy', scale: 0.85, body: 0xff6a7a, accent: 0xffd8e0, dark: 0x8a2a3a, belly: 0xffb0c0, extras: [] },
  },
  /* ==== end of T9 slime ==== */

  /* ==== T9 light: builder LIGHT only ==== */
  sunnykit: {
    name: 'Sunnykit', type: 'light', desc: 'A fox kit with a little sun on its tail. It naps in sunny spots all day long.',
    base: { hp: 40, atk: 55, def: 40, spd: 70 }, baseXp: 62, catchRate: 0.45, learn: L('light', 'fire'),
    evolve: { level: 20, into: 'solvixen' },
    model: { shape: 'sunfox', scale: 0.75, body: 0xffb84a, accent: 0xfff27a, dark: 0x8a4a1a, belly: 0xfff0d0, extras: [] },
  },
  solvixen: {
    name: 'Solvixen', type: 'light', desc: 'A proud fox with a mane of sunbeams. It lights the way at dawn.',
    base: { hp: 70, atk: 90, def: 60, spd: 100 }, baseXp: 155, catchRate: 0.15, learn: L('light', 'fire'),
    model: { shape: 'sunfox', scale: 1.25, body: 0xff9a2a, accent: 0xffe060, dark: 0x6a3010, belly: 0xfff4d8, extras: ['mane'] },
  },
  beacub: {
    name: 'Beacub', type: 'light', desc: 'A little lighthouse on two feet. Its lamp blinks hello to passing boats.',
    base: { hp: 55, atk: 45, def: 65, spd: 40 }, baseXp: 66, catchRate: 0.4, learn: L('light', 'water'),
    evolve: { level: 24, into: 'lumitower' },
    model: { shape: 'lighthouse', scale: 0.75, body: 0xffffff, accent: 0xe04a4a, dark: 0x3a3a4a, belly: 0xfff6a0, extras: [] },
  },
  lumitower: {
    name: 'Lumitower', type: 'light', desc: 'A tall lighthouse creature. Its turning light guides lost travellers home.',
    base: { hp: 90, atk: 85, def: 100, spd: 50 }, baseXp: 170, catchRate: 0.1, learn: L('light', 'water', [[30, 'beaconbeam']]),
    model: { shape: 'lighthouse', scale: 1.25, body: 0xf4f4f4, accent: 0x3a7ae0, dark: 0x2a2a3a, belly: 0xfff6a0, extras: ['beam', 'gallery'] },
  },
  dawnchick: {
    name: 'Dawnchick', type: 'light', desc: 'A fluffy chick with a sunrise on its head. It peeps to wake the sun up.',
    base: { hp: 45, atk: 55, def: 40, spd: 60 }, baseXp: 62, catchRate: 0.45, learn: L('light', 'sound'),
    evolve: { level: 22, into: 'sunrooster' },
    model: { shape: 'rooster', scale: 0.7, body: 0xffe07a, accent: 0xff8a3a, dark: 0x8a5a1a, belly: 0xfff6d0, extras: [] },
  },
  sunrooster: {
    name: 'Sunrooster', type: 'light', desc: 'It crows at sunrise and the whole sky lights up. Its tail feathers shine like rays.',
    base: { hp: 80, atk: 95, def: 65, spd: 85 }, baseXp: 160, catchRate: 0.12, learn: L('light', 'sound'),
    model: { shape: 'rooster', scale: 1.2, body: 0xfff0d8, accent: 0xff6a2a, dark: 0x8a3a10, belly: 0xffe0a0, extras: ['tailfan'] },
  },
  glitterbop: {
    name: 'Glitterbop', type: 'light', desc: 'A dancing mirror ball. It throws little spots of light everywhere it bops.',
    base: { hp: 55, atk: 65, def: 60, spd: 75 }, baseXp: 100, catchRate: 0.3, learn: L('light', 'rainbow'), floats: true,
    model: { shape: 'mirrorball', scale: 0.85, body: 0xd8e0e8, accent: 0xff8ad8, dark: 0x4a5060, belly: 0x7ad8ff, extras: [] },
  },
  /* ==== end of T9 light ==== */

  /* ==== T9 paper (+ Puzzlet, mind): builder PAPER only ==== */
  darto: {
    name: 'Darto', type: 'paper', desc: 'A paper plane that folded itself. It loves gliding off high places.',
    base: { hp: 40, atk: 55, def: 35, spd: 80 }, baseXp: 62, catchRate: 0.45, learn: L('paper', 'sky'), flies: true,
    evolve: { level: 22, into: 'jetfold' },
    model: { shape: 'paperplane', scale: 0.8, body: 0xffffff, accent: 0x7ab8ff, dark: 0x8a9ab0, belly: 0xf0f4ff, extras: [] },
  },
  jetfold: {
    name: 'Jetfold', type: 'paper', desc: 'A sleek paper jet with sharp folds. It can glide all the way across a lake.',
    base: { hp: 65, atk: 90, def: 55, spd: 115 }, baseXp: 160, catchRate: 0.12, learn: L('paper', 'sky'), flies: true,
    model: { shape: 'paperplane', scale: 1.2, body: 0xfff0d0, accent: 0xe04a4a, dark: 0x8a6a4a, belly: 0xffffff, extras: ['jet'] },
  },
  hopfold: {
    name: 'Hopfold', type: 'paper', desc: 'A little folded frog. It hops in the rain and never gets soggy. Well, hardly ever.',
    base: { hp: 50, atk: 55, def: 45, spd: 65 }, baseXp: 64, catchRate: 0.45, learn: L('paper', 'grass'),
    evolve: { level: 20, into: 'frogami' },
    model: { shape: 'origamifrog', scale: 0.75, body: 0x6ad06a, accent: 0xd8f0a0, dark: 0x2a6a2a, belly: 0xffffff, extras: [] },
  },
  frogami: {
    name: 'Frogami', type: 'paper', desc: 'A big folded frog with patterned paper. It can jump over a house.',
    base: { hp: 80, atk: 90, def: 70, spd: 90 }, baseXp: 155, catchRate: 0.15, learn: L('paper', 'grass'),
    model: { shape: 'origamifrog', scale: 1.15, body: 0x4ab8e0, accent: 0xffd84a, dark: 0x1a4a7a, belly: 0xfff6e0, extras: ['pattern'] },
  },
  pagelet: {
    name: 'Pagelet', type: 'paper', desc: 'A tiny storybook. It whispers the beginning of a story, then forgets the rest.',
    base: { hp: 55, atk: 45, def: 65, spd: 40 }, baseXp: 64, catchRate: 0.45, learn: L('paper', 'pixie'),
    evolve: { level: 24, into: 'grandtome' },
    model: { shape: 'book', scale: 0.75, body: 0xd04a4a, accent: 0xffd84a, dark: 0x5a1a1a, belly: 0xfff8e8, extras: [] },
  },
  grandtome: {
    name: 'Grandtome', type: 'paper', desc: 'A huge old storybook with a golden clasp. Every page tells a fairy tale.',
    base: { hp: 95, atk: 85, def: 100, spd: 50 }, baseXp: 170, catchRate: 0.1, learn: L('paper', 'pixie'),
    model: { shape: 'book', scale: 1.25, body: 0x4a3a8a, accent: 0xffd84a, dark: 0x2a1a4a, belly: 0xfff8e8, extras: ['clasp'] },
  },
  puzzlet: {
    name: 'Puzzlet', type: 'mind', desc: 'A jigsaw piece that thinks very hard. It is always looking for the friend it fits with.',
    base: { hp: 60, atk: 65, def: 65, spd: 60 }, baseXp: 100, catchRate: 0.3, learn: L('mind', 'paper'),
    model: { shape: 'puzzle', scale: 0.85, body: 0xb08aff, accent: 0xff8ad8, dark: 0x4a2a8a, belly: 0xe8d8ff, extras: [] },
  },
  /* ==== end of T9 paper ==== */
  /* ==== T18 time ==== */
  flipsand: {
    name: 'Flipsand', type: 'time', desc: "A little hourglass that walks by flipping itself over. Its sand never runs out.",
    base: { hp: 50, atk: 45, def: 60, spd: 55 }, baseXp: 64, catchRate: 0.45, learn: L('time', 'rock'),
    evolve: { level: 22, into: 'sandtimer' },
    model: { shape: 'hourglass', scale: 0.75, body: 0x8a5a2a, accent: 0xffd27a, dark: 0x4a2a10, belly: 0xd8f4ff, extras: [] },
  },
  sandtimer: {
    name: 'Sandtimer', type: 'time', desc: "A tall hourglass with strong arms. When it gets excited, the sand inside swirls round and round.",
    base: { hp: 85, atk: 80, def: 100, spd: 75 }, baseXp: 165, catchRate: 0.12, learn: L('time', 'rock'),
    model: { shape: 'hourglass', scale: 1.25, body: 0x6a3a1a, accent: 0xffc04a, dark: 0x3a1a08, belly: 0xd8f4ff, extras: ['arms'] },
  },
  pendulo: {
    name: 'Pendulo', type: 'time', desc: "A metronome that hops on one leg. Tick, tock, tick, tock: it never loses the beat.",
    base: { hp: 45, atk: 55, def: 45, spd: 70 }, baseXp: 64, catchRate: 0.45, learn: L('time', 'sound', SNZ),
    evolve: { level: 24, into: 'grandtock' },
    model: { shape: 'pendulum', scale: 0.8, body: 0xc8804a, accent: 0xffd84a, dark: 0x5a2a10, belly: 0xfff0d0, extras: [] },
  },
  grandtock: {
    name: 'Grandtock', type: 'time', desc: "A big grandfather clock that walks very slowly. It bongs once for every new friend.",
    base: { hp: 100, atk: 85, def: 105, spd: 45 }, baseXp: 170, catchRate: 0.1, learn: L('time', 'sound', SNZ),
    model: { shape: 'pendulum', scale: 1.35, body: 0x6a3a1a, accent: 0xffd84a, dark: 0x2a1408, belly: 0xfff6e0, extras: ['grand'] },
  },
  ringaling: {
    name: 'Ringaling', type: 'time', desc: "A little alarm clock with two bells for ears. It rings when it is hungry, and that is often!",
    base: { hp: 50, atk: 60, def: 45, spd: 60 }, baseXp: 64, catchRate: 0.45, learn: L('time', 'metal', SNZ),
    evolve: { level: 22, into: 'clangalarm' },
    model: { shape: 'alarmclock', scale: 0.75, body: 0xe04a4a, accent: 0xffd84a, dark: 0x5a1a1a, belly: 0xffffff, extras: [] },
  },
  clangalarm: {
    name: 'Clangalarm', type: 'time', desc: "A huge alarm clock that stomps on hammer legs. Nobody sleeps in when it is around.",
    base: { hp: 90, atk: 105, def: 80, spd: 60 }, baseXp: 165, catchRate: 0.12, learn: L('time', 'metal', [...SNZ, [30, 'wakeupcall']]),
    model: { shape: 'alarmclock', scale: 1.3, body: 0x4a7ae0, accent: 0xffd84a, dark: 0x1a2a5a, belly: 0xffffff, extras: ['hammers'] },
  },
  twilorb: {
    name: 'Twilorb', type: 'time', desc: "A slowly spinning ball, half sun and half moon. It only wakes up when day and night meet.",
    base: { hp: 65, atk: 65, def: 60, spd: 70 }, baseXp: 100, catchRate: 0.3, learn: L('time', 'cosmic', SNZ), floats: true,
    model: { shape: 'sunmoon', scale: 0.85, body: 0xffc23d, accent: 0x3a4a8a, dark: 0x1a1a3a, belly: 0xfff6c0, extras: [] },
  },
  /* ==== end of T18 time ==== */
  /* ==== T18 camo ==== */
  bushling: {
    name: 'Bushling', type: 'camo', desc: "A leaf block with a sleepy face. It sits very still in the forest and blinks when nobody is looking.",
    base: { hp: 60, atk: 50, def: 70, spd: 35 }, baseXp: 64, catchRate: 0.45, learn: L('camo', 'grass'),
    evolve: { level: 22, into: 'topiphant' },
    disguise: { blocks: [B.LEAVES, B.PINE_LEAVES] },
    model: { shape: 'bushblock', scale: 0.75, body: 0x4a9a3a, accent: 0x7ac85a, dark: 0x1a4a1a, belly: 0x6ab04a, extras: [] },
  },
  topiphant: {
    name: 'Topiphant', type: 'camo', desc: "A big hedge trimmed into an elephant. When it sneezes, leaves fly everywhere.",
    base: { hp: 110, atk: 90, def: 110, spd: 40 }, baseXp: 170, catchRate: 0.1, learn: L('camo', 'grass'),
    disguise: { blocks: [B.LEAVES, B.PINE_LEAVES], size: 2 },
    model: { shape: 'bushblock', scale: 1.4, body: 0x3a8a3a, accent: 0x6ac050, dark: 0x1a3a1a, belly: 0x5aa040, extras: ['elephant'] },
  },
  castlet: {
    name: 'Castlet', type: 'camo', desc: "A sand block with a tiny flag on top. Waves make it giggle, but they also make it smaller.",
    base: { hp: 50, atk: 50, def: 75, spd: 40 }, baseXp: 64, catchRate: 0.45, learn: L('camo', 'water'),
    evolve: { level: 22, into: 'fortsand' },
    disguise: { blocks: [B.SAND, B.SANDSTONE] },
    model: { shape: 'sandcastle', scale: 0.75, body: 0xe8d090, accent: 0xd04a4a, dark: 0x8a6a3a, belly: 0xf4e4b0, extras: [] },
  },
  fortsand: {
    name: 'Fortsand', type: 'camo', desc: "A walking sandcastle with towers and a little gate. Crabs like to visit its windows.",
    base: { hp: 85, atk: 85, def: 125, spd: 45 }, baseXp: 165, catchRate: 0.12, learn: L('camo', 'water'),
    disguise: { blocks: [B.SAND, B.SANDSTONE], size: 2 },
    model: { shape: 'sandcastle', scale: 1.35, body: 0xe0c880, accent: 0x4a8ae0, dark: 0x7a5a2a, belly: 0xf0dca0, extras: ['towers'] },
  },
  cubble: {
    name: 'Cubble', type: 'camo', desc: "A cobblestone with a hidden mouth. It waits very still for snacks to roll past.",
    base: { hp: 55, atk: 60, def: 70, spd: 30 }, baseXp: 64, catchRate: 0.45, learn: L('camo', 'rock'),
    evolve: { level: 24, into: 'statuo' },
    disguise: { blocks: [B.STONE, B.COBBLE, B.GRAVEL] },
    model: { shape: 'stonecube', scale: 0.75, body: 0x8a8a8a, accent: 0xb0b0b0, dark: 0x3a3a3a, belly: 0x5a2a2a, extras: [] },
  },
  statuo: {
    name: 'Statuo', type: 'camo', desc: "A stone statue that only moves when you are not looking. Turn around and it is a bit closer!",
    base: { hp: 90, atk: 100, def: 110, spd: 40 }, baseXp: 170, catchRate: 0.1, learn: L('camo', 'rock', [[30, 'statueslam']]),
    disguise: { blocks: [B.STONE, B.COBBLE, B.GRAVEL], size: 2 },
    model: { shape: 'stonecube', scale: 1.4, body: 0xa8a49a, accent: 0xd8d4c8, dark: 0x4a4840, belly: 0x6a6458, extras: ['statue'] },
  },
  igloop: {
    name: 'Igloop', type: 'camo', desc: "A snow block that is secretly a tiny igloo. Peek through its little door to see it smile.",
    base: { hp: 70, atk: 55, def: 80, spd: 50 }, baseXp: 100, catchRate: 0.3, learn: L('camo', 'ice'),
    disguise: { blocks: [B.SNOW] },
    model: { shape: 'igloo', scale: 0.8, body: 0xf4f8ff, accent: 0xa8d8f0, dark: 0x3a5a7a, belly: 0x2a3a5a, extras: [] },
  },
  /* ==== end of T18 camo ==== */
  /* ==== T18 cyber ==== */
  pixbit: {
    name: 'Pixbit', type: 'cyber', desc: "A blob made of chunky pixels. It hops from screen to screen and leaves a little sparkle.",
    base: { hp: 45, atk: 55, def: 40, spd: 75 }, baseXp: 64, catchRate: 0.45, learn: L('cyber', 'electric'),
    evolve: { level: 22, into: 'pixbit2' },
    model: { shape: 'pixelblob', scale: 0.75, body: 0x5ae0ff, accent: 0xff6ad8, dark: 0x1a3a6a, belly: 0xb0f8ff, extras: [] },
  },
  pixbit2: {
    name: 'Pixbit 2.0', type: 'cyber', desc: "An upgraded Pixbit with sharp, shiny pixels. It changes colour faster than you can blink.",
    base: { hp: 75, atk: 95, def: 65, spd: 115 }, baseXp: 165, catchRate: 0.12, learn: L('cyber', 'electric', [[30, 'megabyte']]),
    model: { shape: 'pixelblob', scale: 1.2, body: 0x7a5aff, accent: 0x5af0ff, dark: 0x1a1a5a, belly: 0xd8d0ff, extras: ['v2'] },
  },
  clickit: {
    name: 'Clickit', type: 'cyber', desc: "A mouse pointer with legs. It taps on everything just to see what happens.",
    base: { hp: 45, atk: 60, def: 45, spd: 70 }, baseXp: 64, catchRate: 0.45, learn: L('cyber', 'metal'),
    evolve: { level: 22, into: 'clickit2' },
    model: { shape: 'cursor', scale: 0.8, body: 0xffffff, accent: 0x1a1a1a, dark: 0x3a3a3a, belly: 0xe0e0e0, extras: [] },
  },
  clickit2: {
    name: 'Clickit 2.0', type: 'cyber', desc: "A sleek, speedy pointer. It double-clicks so fast that it makes a little breeze.",
    base: { hp: 75, atk: 100, def: 70, spd: 105 }, baseXp: 165, catchRate: 0.12, learn: L('cyber', 'metal'),
    model: { shape: 'cursor', scale: 1.25, body: 0xd8f0ff, accent: 0x2a7aff, dark: 0x0a1a3a, belly: 0xffffff, extras: ['v2'] },
  },
  wifly: {
    name: 'Wifly', type: 'cyber', desc: "A butterfly with Wi-Fi wings. The closer friends play, the brighter its signal bars glow.",
    base: { hp: 45, atk: 50, def: 40, spd: 80 }, baseXp: 64, catchRate: 0.45, learn: L('cyber', 'sky'), flies: true,
    evolve: { level: 24, into: 'wifly2' },
    model: { shape: 'wifiwing', scale: 0.75, body: 0x4a4a6a, accent: 0x5af0a0, dark: 0x1a1a2a, belly: 0xa0ffd0, extras: [] },
  },
  wifly2: {
    name: 'Wifly 2.0', type: 'cyber', desc: "Its wings shine with full signal bars. It carries messages between friends playing together.",
    base: { hp: 75, atk: 85, def: 65, spd: 115 }, baseXp: 170, catchRate: 0.1, learn: L('cyber', 'sky'), flies: true,
    model: { shape: 'wifiwing', scale: 1.2, body: 0x2a2a4a, accent: 0x5af0ff, dark: 0x0a0a1a, belly: 0xd0fff8, extras: ['v2'] },
  },
  error404: {
    name: 'Error 404', type: 'cyber', desc: "A small glitchy ghost that can never be found... except when two friends play close together.",
    base: { hp: 60, atk: 75, def: 55, spd: 70 }, baseXp: 100, catchRate: 0.3, learn: L('cyber', 'ghost'), floats: true,
    model: { shape: 'glitchghost', scale: 0.85, body: 0xf0f0ff, accent: 0xff4ad8, dark: 0x1a1a3a, belly: 0x5af0ff, extras: [] },
  },
  /* ==== end of T18 cyber ==== */
  /* ==== T21 cozy ==== */
  snugbun: {
    name: 'Snugbun', type: 'cozy', desc: "A little bunny rolled up in a blanket. It only pokes out its ears when it feels safe.",
    base: { hp: 55, atk: 45, def: 55, spd: 60 }, baseXp: 64, catchRate: 0.45, learn: L('cozy', 'pixie'),
    evolve: { level: 22, into: 'quiltbun' },
    model: { shape: 'blanketbun', scale: 0.75, body: 0x8ab8e8, accent: 0xffd0e0, dark: 0x3a3040, belly: 0xfff4e8, extras: [] },
  },
  quiltbun: {
    name: 'Quiltbun', type: 'cozy', desc: "It wears a patchwork quilt as a cape. Every patch is from a friend it has hugged.",
    base: { hp: 90, atk: 75, def: 90, spd: 85 }, baseXp: 165, catchRate: 0.12, learn: L('cozy', 'pixie'),
    model: { shape: 'blanketbun', scale: 1.25, body: 0xe8a0b8, accent: 0xffe08a, dark: 0x4a3040, belly: 0xfff6ee, extras: ['quilt'] },
  },
  purrmit: {
    name: 'Purrmit', type: 'cozy', desc: "A kitten curled up inside a warm mitten. It purrs so loudly that the whole mitten wiggles.",
    base: { hp: 50, atk: 55, def: 45, spd: 65 }, baseXp: 64, catchRate: 0.45, learn: L('cozy', 'fire'),
    evolve: { level: 22, into: 'knitcat' },
    model: { shape: 'mittencat', scale: 0.75, body: 0xe05a5a, accent: 0xffffff, dark: 0x4a2a2a, belly: 0xffc890, extras: [] },
  },
  knitcat: {
    name: 'Knitcat', type: 'cozy', desc: "A cat in a knitted sweater. If you pull a loose thread, it will chase it for hours.",
    base: { hp: 80, atk: 95, def: 70, spd: 100 }, baseXp: 165, catchRate: 0.12, learn: L('cozy', 'fire'),
    model: { shape: 'mittencat', scale: 1.2, body: 0x5a8ae0, accent: 0xfff0d0, dark: 0x2a2a4a, belly: 0xa8a8a8, extras: ['sweater'] },
  },
  pillowlamb: {
    name: 'Pillowlamb', type: 'cozy', desc: "A sheep made of soft pillows. Lean on it and you will be asleep in a minute.",
    base: { hp: 65, atk: 45, def: 65, spd: 40 }, baseXp: 64, catchRate: 0.45, learn: L('cozy', 'mind', BTS),
    evolve: { level: 24, into: 'dozeram' },
    model: { shape: 'pillowsheep', scale: 0.8, body: 0xfff8f0, accent: 0xb8d8ff, dark: 0x3a3a4a, belly: 0xf0d8c0, extras: [] },
  },
  dozeram: {
    name: 'Dozeram', type: 'cozy', desc: "A sleepy ram with pillow horns. Its head-bonks are soft, but nobody stays awake after one.",
    base: { hp: 105, atk: 90, def: 105, spd: 45 }, baseXp: 170, catchRate: 0.1, learn: L('cozy', 'mind', [...BTS, [30, 'lightsout']]),
    model: { shape: 'pillowsheep', scale: 1.25, body: 0xf4eaff, accent: 0xc8a8ff, dark: 0x3a3050, belly: 0xe8d0b8, extras: ['ram'] },
  },
  snoozebear: {
    name: 'Snoozebear', type: 'cozy', desc: "A bear in pyjamas and fluffy slippers. It shuffles from bed to fireplace and back again.",
    base: { hp: 85, atk: 65, def: 70, spd: 35 }, baseXp: 100, catchRate: 0.3, learn: L('cozy', 'ice', BTS),
    model: { shape: 'pajamabear', scale: 0.95, body: 0x7ab8e8, accent: 0xffffff, dark: 0x3a2a1a, belly: 0xa0704a, extras: [] },
  },
  /* ==== end of T21 cozy ==== */
  /* ==== T21 treasure ==== */
  coinlet: {
    name: 'Coinlet', type: 'treasure', desc: "A gold coin that rolls everywhere. Heads means happy, tails means very happy.",
    base: { hp: 45, atk: 55, def: 60, spd: 55 }, baseXp: 64, catchRate: 0.45, learn: L('treasure', 'rock'),
    evolve: { level: 22, into: 'kingcoin' },
    model: { shape: 'coin', scale: 0.7, body: 0xffcf3a, accent: 0xfff0a0, dark: 0x8a5a10, belly: 0xffe680, extras: [] },
  },
  kingcoin: {
    name: 'Kingcoin', type: 'treasure', desc: "A tall stack of coins wearing a tiny crown. It jingles proudly with every step.",
    base: { hp: 80, atk: 90, def: 105, spd: 65 }, baseXp: 165, catchRate: 0.12, learn: L('treasure', 'rock'),
    model: { shape: 'coin', scale: 1.25, body: 0xffc02a, accent: 0xe0303a, dark: 0x7a4a08, belly: 0xffe680, extras: ['stack'] },
  },
  crystafox: {
    name: 'Crystafox', type: 'treasure', desc: "A fox with fur made of clear crystal. It tinkles softly when it runs.",
    base: { hp: 45, atk: 60, def: 40, spd: 70 }, baseXp: 64, catchRate: 0.45, learn: L('treasure', 'light'),
    evolve: { level: 22, into: 'prismfox' },
    model: { shape: 'crystalfox', scale: 0.8, body: 0xa8e8ff, accent: 0xffffff, dark: 0x2a4a6a, belly: 0xe8f8ff, extras: [] },
  },
  prismfox: {
    name: 'Prismfox', type: 'treasure', desc: "Its crystal fur throws little rainbows all around. It loves sunny windows.",
    base: { hp: 70, atk: 100, def: 65, spd: 110 }, baseXp: 165, catchRate: 0.12, learn: L('treasure', 'light'),
    model: { shape: 'crystalfox', scale: 1.25, body: 0xd8c8ff, accent: 0xffffff, dark: 0x3a2a6a, belly: 0xf4f0ff, extras: ['prism'] },
  },
  ringlet: {
    name: 'Ringlet', type: 'treasure', desc: "A floating gold ring with a gem for an eye. It spins slowly while it watches you.",
    base: { hp: 50, atk: 50, def: 55, spd: 60 }, baseXp: 64, catchRate: 0.45, floats: true, learn: L('treasure', 'metal'),
    evolve: { level: 24, into: 'crownguard' },
    model: { shape: 'gemring', scale: 0.75, body: 0xffd23a, accent: 0x3ac8ff, dark: 0x7a5a10, belly: 0xffffff, extras: [] },
  },
  crownguard: {
    name: 'Crownguard', type: 'treasure', desc: "A walking crown in shiny gem armour. It guards treasure and shares it with friends.",
    base: { hp: 95, atk: 95, def: 115, spd: 40 }, baseXp: 170, catchRate: 0.1, learn: L('treasure', 'metal', [[30, 'crownjewel']]),
    model: { shape: 'gemring', scale: 1.35, body: 0xffc83a, accent: 0xe0304a, dark: 0x6a4a08, belly: 0x4a8aff, extras: ['crown'] },
  },
  lustrelle: {
    name: 'Lustrelle', type: 'treasure', desc: "A floating chandelier covered in glittering gems. Its little candles never go out.",
    base: { hp: 60, atk: 70, def: 55, spd: 75 }, baseXp: 100, catchRate: 0.3, floats: true, learn: L('treasure', 'fire'),
    model: { shape: 'chandelier', scale: 0.9, body: 0xffd23a, accent: 0xffb030, dark: 0x6a4a10, belly: 0xfff4e0, extras: [] },
  },
  /* ==== end of T21 treasure ==== */
  /* ==== T36 parkour ==== */
  teetail: {
    name: 'Teetail', type: 'parkour', desc: "A little lemur that walks on ropes. Its striped tail helps it balance, so it never falls.", gait: 'hopaway',
    base: { hp: 45, atk: 50, def: 40, spd: 80 }, baseXp: 64, catchRate: 0.45, learn: L('parkour', 'sky'),
    evolve: { level: 22, into: 'tightropa' },
    model: { shape: 'lemur', scale: 0.8, body: 0xb7b7c7, accent: 0xffb020, dark: 0x3a3a48, belly: 0xf4f4f8, extras: [] },
  },
  tightropa: {
    name: 'Tightropa', type: 'parkour', desc: "It crosses rope bridges holding a tiny umbrella. Once it balanced on a rope for a whole day.", gait: 'hopaway',
    base: { hp: 70, atk: 85, def: 60, spd: 125 }, baseXp: 165, catchRate: 0.12, learn: L('parkour', 'sky'),
    model: { shape: 'lemur', scale: 1.2, body: 0xc8c0d8, accent: 0xff8a3a, dark: 0x3a3a48, belly: 0xf4f4f8, extras: ['umbrella'] },
  },
  zippet: {
    name: 'Zippet', type: 'parkour', desc: "A ferret that never walks when it can leap. It jumps from rock to rock just for fun.", gait: 'hopaway',
    base: { hp: 40, atk: 60, def: 35, spd: 85 }, baseXp: 64, catchRate: 0.45, learn: L('parkour', 'electric'),
    evolve: { level: 22, into: 'ferrocket' },
    model: { shape: 'ferret', scale: 0.75, body: 0xc98a4a, accent: 0x3ad0ff, dark: 0x5a3a20, belly: 0xffe7c4, extras: [] },
  },
  ferrocket: {
    name: 'Ferrocket', type: 'parkour', desc: "It leaps so far that it seems to fly. Its sneakers have the fastest soles in the land.", gait: 'hopaway',
    base: { hp: 65, atk: 110, def: 50, spd: 120 }, baseXp: 165, catchRate: 0.12, learn: L('parkour', 'electric'),
    model: { shape: 'ferret', scale: 1.2, body: 0xd06a3a, accent: 0x3ad0ff, dark: 0x5a3a20, belly: 0xffe7c4, extras: ['goggles'] },
  },
  vaultling: {
    name: 'Vaultling', type: 'parkour', desc: "It carries a short stick everywhere. One push and it vaults over fences, logs and you.", gait: 'hopaway',
    base: { hp: 50, atk: 60, def: 45, spd: 65 }, baseXp: 64, catchRate: 0.45, learn: L('parkour', 'metal'),
    evolve: { level: 24, into: 'highvault' },
    model: { shape: 'vaulter', scale: 0.8, body: 0x6ad0c8, accent: 0xffcf3a, dark: 0x2a7a74, belly: 0xe0fff8, extras: [] },
  },
  highvault: {
    name: 'Highvault', type: 'parkour', desc: "A tall, lanky jumper with a race number. It clears rooftops with one bounce of its pole.", gait: 'hopaway',
    base: { hp: 80, atk: 105, def: 70, spd: 95 }, baseXp: 170, catchRate: 0.1, learn: L('parkour', 'metal', [[30, 'rooftoprun']]),
    model: { shape: 'vaulter', scale: 1.2, body: 0x4ab0e0, accent: 0xffcf3a, dark: 0x2a7a74, belly: 0xe0fff8, extras: ['medal'] },
  },
  zoomstick: {
    name: 'Zoomstick', type: 'parkour', desc: "A thin little runner with pointy ears. You only ever see a streak and a red headband.", gait: 'hopaway',
    base: { hp: 55, atk: 75, def: 40, spd: 100 }, baseXp: 100, catchRate: 0.3, learn: L('parkour', 'time'),
    model: { shape: 'stickrunner', scale: 0.9, body: 0x3a3a5a, accent: 0xff9a4a, dark: 0x2a2a40, belly: 0xffe0c0, extras: [] },
  },
  /* ==== end of T36 parkour ==== */
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
    ['saucerling', 1, 'night'], ['blipling', 0.8, 'night']],
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
    ['slumbergeist', 0.2, 'night'], ['echobat', 1, 'night']],
  beach: [['bubbuck', 4], ['shellby', 4], ['gullop', 3], ['emberpup', 2], ['sparkitten', 2], ['zapple', 1],
    ['clanklet', 1], ['dinglet', 1], ['gongolin', 0.3], ['rainwing', 0.3, 'day']],
  water: [['bubbuck', 2], ['ripplet', 3], ['joltail', 2], ['shellby', 1], ['gullop', 1], ['torrentide', 0.3],
    ['shimmerfin', 0.5], ['spectrafin', 0.08]],
  desert: [['magmole', 3], ['sparkitten', 3], ['emberpup', 2], ['cragling', 3], ['pebblor', 2], ['zapple', 2],
    ['ampup', 2], ['nutlet', 2], ['clanklet', 1], ['hissyfang', 1], ['flarehawk', 1], ['voltwing', 1],
    ['pyrolynx', 0.3], ['cragtusk', 0.5], ['thundapple', 0.2], ['venomamba', 0.2],
    ['wispurr', 1, 'night'], ['starmite', 1, 'night'], ['meteorb', 1, 'night'],
    ['podlet', 1.5], ['saucerling', 0.8, 'night'], ['tallipod', 0.2, 'night']],
  mountain: [['pebblor', 4], ['magmole', 2], ['cragtusk', 2], ['geodrake', 2], ['cragling', 2], ['quartzle', 2],
    ['monolor', 0.4], ['flarehawk', 2], ['voltwing', 1], ['clanklet', 3], ['ironhorn', 2], ['nutlet', 2],
    ['mechanox', 0.3], ['titanox', 0.2], ['rivetron', 0.2], ['thinkit', 1], ['cerebrix', 0.2], ['visionelk', 0.3],
    ['scalekin', 1], ['wyvlet', 1], ['wyrmlet', 0.5], ['scalewing', 0.1], ['stormwyvern', 0.1], ['skywyrm', 0.1],
    ['echobat', 2], ['boomwing', 0.2], ['snoozle', 1, 'night'],
    ['starmite', 2, 'night'], ['meteorb', 2, 'night'], ['galaxor', 0.2, 'night'],
    ['saucerling', 1, 'night'], ['podlet', 1, 'night'], ['tallipod', 0.15, 'night']],
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
    ['skullop', 3], ['rattlepup', 2.5], ['dinobit', 2.5], ['podlet', 0.5], ['howlbone', 0.3], ['skullossal', 0.25], ['stompasaur', 0.25]],
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
  forest: [['twirlshell', 1], ['lanterboo', 0.8, 'night'], ['gurglepot', 0.6]],
  swamp: [['twirlshell', 1], ['lanterboo', 1, 'night'], ['gurglepot', 1.2]],
  cave: [['lanterboo', 0.6], ['tickatin', 0.6]],
  meadow: [['cuppix', 1, 'day']],
  mountain: [['tickatin', 1]],
  beach: [['tickatin', 0.4]],
};

const SEVENTH_C = {
  mountain: [['nimbrake', 0.3], ['voidle', 0.5, 'night']],
  peak: [['nimbrake', 0.3], ['voidle', 0.3, 'night']],
  forest: [['chromacurl', 0.25, 'day']],
  meadow: [['chromacurl', 0.2, 'day']],
  snow: [['voidle', 0.4, 'night']],
  desert: [['voidle', 0.4, 'night'], ['zorbit', 0.6]],
  beach: [['clawdio', 1.2]],
  cave: [['clawdio', 0.3], ['finnibone', 1.2]],
  plains: [['zorbit', 0.6, 'night']],
};

// T9: Sky, Slime, Light, Paper. One object per type so four builders never edit the same lines.
const SPAWN_SKY = {
  peak: [['kiteling', 1.2, 'day'], ['balloony', 1], ['skyfin', 1], ['pinwhirl', 0.8], ['kitegale', 0.2, 'day'], ['zeppeluff', 0.2], ['whaloft', 0.15]],
  mountain: [['kiteling', 1.2, 'day'], ['balloony', 1, 'day'], ['pinwhirl', 1], ['skyfin', 0.8], ['kitegale', 0.15, 'day']],
  plains: [['kiteling', 0.8, 'day'], ['pinwhirl', 0.6, 'day'], ['balloony', 0.6, 'day']],
  beach: [['kiteling', 0.8, 'day'], ['skyfin', 0.6]],
};

const SPAWN_SLIME = {
  swamp: [['dripple', 1.2], ['goopup', 1], ['wobblock', 0.8], ['gumbear', 0.4], ['slimperor', 0.15], ['slimehound', 0.15], ['jigglestack', 0.12]],
  // modest cave weights: bone creatures already fill about a quarter of the cave table
  cave: [['wobblock', 0.7], ['dripple', 0.6], ['gumbear', 0.3], ['jigglestack', 0.12], ['slimperor', 0.06]],
  forest: [['goopup', 0.8, 'night'], ['dripple', 0.6, 'night']],
  meadow: [['gumbear', 0.6, 'day']],
};

const SPAWN_LIGHT = {
  meadow: [['sunnykit', 1.5, 'day'], ['dawnchick', 1.2, 'day'], ['glitterbop', 0.8], ['solvixen', 0.2, 'day'], ['sunrooster', 0.2, 'day']],
  plains: [['dawnchick', 1.2, 'day'], ['sunnykit', 0.8, 'day'], ['sunrooster', 0.15, 'day']],
  beach: [['beacub', 1.5], ['lumitower', 0.2]],
  cave: [['beacub', 0.6], ['glitterbop', 0.6]],
  desert: [['sunnykit', 0.8, 'day']],
};

// Origrane (Paper, moved here from Mind) keeps its old spots; Puzzlet takes them over in Mind.
const SPAWN_PAPER = {
  plains: [['origrane', 0.6, 'day'], ['darto', 1.2, 'day'], ['hopfold', 1], ['pagelet', 0.8], ['jetfold', 0.15, 'day'], ['frogami', 0.2], ['grandtome', 0.15], ['puzzlet', 0.6, 'day']],
  forest: [['origrane', 0.4, 'day'], ['pagelet', 1.2], ['hopfold', 1], ['grandtome', 0.2]],
  meadow: [['origrane', 0.8, 'day'], ['hopfold', 0.8], ['darto', 0.8, 'day'], ['puzzlet', 0.8, 'day']],
  mountain: [['darto', 0.8], ['jetfold', 0.2], ['puzzlet', 0.4]],
  taiga: [['pagelet', 0.6, 'night']],
};

// T18: Time creatures come out only in the golden hour (dawn or dusk), each in its own window.
const SPAWN_TIME = {
  plains:   [['ringaling', 1.5, 'dawn'], ['flipsand', 0.8, 'dawn'], ['clangalarm', 0.15, 'dawn'], ['pendulo', 1.2, 'dusk'], ['twilorb', 0.6, 'dusk'], ['grandtock', 0.15, 'dusk']],
  meadow:   [['ringaling', 1.5, 'dawn'], ['clangalarm', 0.2, 'dawn'], ['twilorb', 1, 'dusk'], ['pendulo', 0.8, 'dusk']],
  forest:   [['ringaling', 1, 'dawn'], ['pendulo', 1.5, 'dusk'], ['grandtock', 0.2, 'dusk']],
  swamp:    [['ringaling', 0.8, 'dawn'], ['pendulo', 1, 'dusk']],
  beach:    [['flipsand', 1.2, 'dawn'], ['sandtimer', 0.15, 'dawn'], ['twilorb', 1, 'dusk']],
  desert:   [['flipsand', 1.5, 'dawn'], ['sandtimer', 0.2, 'dawn'], ['twilorb', 1, 'dusk'], ['pendulo', 0.6, 'dusk']],
  mountain: [['ringaling', 1, 'dawn'], ['flipsand', 0.6, 'dawn'], ['twilorb', 1.2, 'dusk'], ['pendulo', 0.6, 'dusk']],
  snow:     [['ringaling', 0.8, 'dawn'], ['pendulo', 1, 'dusk']],
  taiga:    [['ringaling', 1, 'dawn'], ['pendulo', 1.2, 'dusk'], ['grandtock', 0.15, 'dusk']],
  peak:     [['flipsand', 0.6, 'dawn'], ['ringaling', 0.6, 'dawn'], ['twilorb', 1.5, 'dusk'], ['grandtock', 0.1, 'dusk']],
};
// Camo creatures wear a disguise (species.disguise): plain entries, any time of day.
const SPAWN_CAMO = {
  forest: [['bushling', 1.2], ['topiphant', 0.15]],
  taiga: [['bushling', 0.8], ['topiphant', 0.1], ['igloop', 0.6]],
  beach: [['castlet', 1.2], ['fortsand', 0.15]],
  desert: [['castlet', 1], ['fortsand', 0.15]],
  mountain: [['cubble', 1.2], ['statuo', 0.15]],
  peak: [['cubble', 0.6]],
  cave: [['cubble', 1], ['statuo', 0.1]],
  snow: [['igloop', 1.2]],
};
// Cyber creatures: anywhere, but only with a friend close by (the 'together' condition).
const CYBER = [['pixbit', 1, 'together'], ['clickit', 1, 'together'], ['wifly', 1, 'together'], ['error404', 0.6, 'together'],
  ['pixbit2', 0.12, 'together'], ['clickit2', 0.12, 'together'], ['wifly2', 0.1, 'together']];
const SPAWN_CYBER = Object.fromEntries(Object.keys(SPAWNS).map(b => [b, CYBER]));

// T21: Cozy and Treasure creatures only come to a finished home of their type (the 'home:<type>' condition; T22).
const HOME = [['snugbun', 1, 'home:cozy'], ['purrmit', 1, 'home:cozy'], ['pillowlamb', 1, 'home:cozy'], ['snoozebear', 0.6, 'home:cozy'],
  ['quiltbun', 0.15, 'home:cozy'], ['knitcat', 0.15, 'home:cozy'], ['dozeram', 0.12, 'home:cozy'],
  ['coinlet', 0.4, 'home:treasure'], ['crystafox', 0.4, 'home:treasure'], ['ringlet', 0.4, 'home:treasure'], ['lustrelle', 0.3, 'home:treasure'],
  ['kingcoin', 0.08, 'home:treasure'], ['prismfox', 0.08, 'home:treasure'], ['crownguard', 0.06, 'home:treasure']];
const SPAWN_HOME = Object.fromEntries(Object.keys(SPAWNS).map(b => [b, HOME]));
// T36: Parkour creatures sit up high (the 'high' condition: treetops, roofs, pillars), in every biome above ground.
const PARKOUR = [['teetail', 1, 'high'], ['zippet', 1, 'high'], ['vaultling', 1, 'high'], ['zoomstick', 0.6, 'high'],
  ['tightropa', 0.12, 'high'], ['ferrocket', 0.12, 'high'], ['highvault', 0.1, 'high']];
const SPAWN_PARKOUR = Object.fromEntries(Object.keys(SPAWNS).filter(b => b !== 'cave').map(b => [b, PARKOUR]));

for (const extra of [SEVENTH_A, SEVENTH_B, SEVENTH_C, SPAWN_SKY, SPAWN_SLIME, SPAWN_LIGHT, SPAWN_PAPER, SPAWN_TIME, SPAWN_CAMO, SPAWN_CYBER, SPAWN_HOME, SPAWN_PARKOUR]) for (const [biome, list] of Object.entries(extra)) SPAWNS[biome].push(...list);

export const xpForLevel = L => Math.floor(0.6 * L * L * L);

export function statsFor(c) {
  const b = SPECIES[c.species].base, L = c.level;
  const hp = Math.floor((b.hp * 2 * L) / 100) + L + 10;
  return {
    maxHp: c.giant ? Math.floor(hp * c.giant) : hp, // T29: only the boss of a co-op battle has `giant`
    atk: Math.floor((b.atk * 2 * L) / 100) + 5,
    def: Math.floor((b.def * 2 * L) / 100) + 5,
    spd: Math.floor((b.spd * 2 * L) / 100) + 5,
  };
}

export const nameOf = c => SPECIES[c.species].name;

// The moves a wild or trainer creature gets by level: the last 4 learned, big moves left out, a damaging move first.
export function autoMoves(species, level) {
  const moves = SPECIES[species].learn.filter(([l, m]) => l <= level && !isBig(m)).map(([, m]) => m);
  const picked = [...new Set(moves)].slice(-4);
  const hit = picked.findIndex(m => MOVES[m].power > 0);
  if (hit > 0) [picked[0], picked[hit]] = [picked[hit], picked[0]];
  return picked;
}

// autoMoves plus these named moves (gym leaders): each replaces the weakest move at index >= 1
// (lowest power, the later on a tie), never one of `ids`; with fewer than 4 it is added.
export function movesWith(species, level, ...ids) {
  const moves = autoMoves(species, level);
  for (const id of ids) {
    if (moves.includes(id)) continue;
    if (moves.length < 4) { moves.push(id); continue; }
    let weakest = -1;
    for (let i = 1; i < moves.length; i++) {
      if (ids.includes(moves[i])) continue;
      if (weakest < 0 || MOVES[moves[i]].power <= MOVES[moves[weakest]].power) weakest = i;
    }
    if (weakest > 0) moves[weakest] = id;
  }
  return moves;
}

// knownMoves: keep these moves (for copies of an existing creature) instead of the usual ones.
export function makeCreature(species, level, knownMoves) {
  const sp = SPECIES[species];
  const moves = sp.learn.filter(([l, m]) => l <= level && !isBig(m)).map(([, m]) => m);
  const keep = (knownMoves || []).filter(m => MOVES[m]);
  const c = {
    uid: Math.random().toString(36).slice(2, 10),
    species, level, xp: xpForLevel(level), hp: 0,
    moves: keep.length ? [...new Set(keep)].slice(0, 4) : autoMoves(species, level),
  };
  c.learned = keep.length ? [...c.moves] : [...new Set(moves)]; // moves already offered (see gainXp)
  c.hp = statsFor(c).maxHp;
  c.traits = drawTraits(c); // T26: drawn once from the uid, then saved
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
      for (const id of gainTraits(c)) msgs.push(TRAITS[id].grown(nameOf(c)));
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
  // Treasure creatures sparkle all the time: SPARKLES glints twinkle in turn at spots around the body. They are unlit
  // (MeshBasic), so they shine just as bright at night and in dark caves.
  if (sp.type === 'treasure') {
    const bb = new THREE.Box3().setFromObject(root);
    const c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
    parts.sparkle = [];
    for (let k = 0; k < SPARKLES; k++) {
      const mat = new THREE.MeshBasicMaterial({ color: k % 2 ? 0xffffff : 0xfff2b0, side: THREE.DoubleSide });
      const g = new THREE.Mesh(sparkleGeometry(0.2), mat);
      const spots = [0, 1, 2].map(j => {
        const a = k * 1.3 + j * 2.4, h = 0.2 + 0.2 * ((k + j * 2) % 4);
        return new THREE.Vector3(c.x + Math.sin(a) * (size.x / 2 + 0.06), bb.min.y + size.y * h, c.z + Math.cos(a) * (size.z / 2 + 0.06));
      });
      g.position.copy(spots[0]);
      root.add(g);
      parts.sparkle.push({ g, spots, phase: k * 0.37, period: 1.1 + (k % 3) * 0.2 });
    }
  }
  root.scale.setScalar(m.scale);
  group.userData.parts = parts;
  group.userData.species = species;
  return group;
}

// Treasure sparkle: how many glints, and how long one twinkle lasts (s).
const SPARKLES = 5, SPARKLE_TIME = 0.6;

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
  for (const s of p.sparkle || []) {
    const u = (t + s.phase) / s.period, n = Math.floor(u);
    const k = ((u - n) * s.period) / SPARKLE_TIME; // each twinkle lasts SPARKLE_TIME s of its period
    const a = k < 1 ? Math.sin(k * Math.PI) * 1.1 : 0;
    s.g.visible = a > 0.03;
    if (!s.g.visible) continue;
    s.g.position.copy(s.spots[((n % 3) + 3) % 3]);
    s.g.scale.setScalar(a);
    s.g.rotation.z = k * 0.8;
  }
  if (p.root && !p.bounce) p.root.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.03 : 0;
}

// Tint a model for hit flashes (pass null to restore).
export function tintModel(group, color) {
  group.traverse(o => {
    if (!o.isMesh || !o.material.emissive) return; // unlit parts (the Treasure sparkle glints) have no emissive: leave them as they are
    if (o.userData.baseEmissive === undefined) o.userData.baseEmissive = o.material.emissive.getHex();
    o.material.emissive.setHex(color ?? o.userData.baseEmissive);
  });
}

export function disposeModel(group) {
  group.traverse(o => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
}
