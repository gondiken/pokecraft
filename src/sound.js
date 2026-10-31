// Small, quiet sound effects made with the Web Audio API (no sound files to download).
// Browsers only allow sound after the player clicks, taps or presses a key, so the audio
// starts on the first of those. sound.on is remembered on this device.

const KEY = 'pokecraft-sound';
const VOLUME = 0.18;

let ctx = null;
let master = null;
let noiseBuf = null;
let longNoise = null; // 2 s of noise for thunder and the rain/wind loop
let amb = null; // the looping ambience: { src, filter, gain }
let scale = 1; // quieter for far-away sounds

function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  longNoise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const l = longNoise.getChannelData(0);
  for (let i = 0; i < l.length; i++) l[i] = Math.random() * 2 - 1;
  return ctx;
}

// A soft note: quick fade in, gentle fade out.
function tone(freq, { at = 0, len = 0.12, type = 'sine', vol = 0.5, slide = 0 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * scale, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + len + 0.02);
}

// A short puff of filtered noise (crunches, thuds and swooshes).
function noise({ at = 0, len = 0.08, freq = 800, vol = 0.5, q = 1 } = {}) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * scale, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + len + 0.02);
}

const notes = (list, gap, opts) => list.forEach((f, i) => tone(f, { at: i * gap, ...opts }));

// A bell or gong: a few ringing overtones that fade slowly.
const bell = (f, at = 0, len = 0.9, vol = 0.3) => [[1, 1], [2.01, 0.4], [2.76, 0.25]]
  .forEach(([k, v]) => tone(f * k, { at, len: len / k ** 0.3, vol: vol * v }));
// A drum: a quick low thump with a slap of noise.
const drum = (f, at = 0, vol = 0.4) => { tone(f, { at, len: 0.18, vol, slide: -f * 0.4 }); noise({ at, freq: 400, len: 0.05, vol: vol * 0.6 }); };

// Sound-type creatures each have their own little tune (a "cry").
const CRIES = {
  echobat: () => [1175, 1568, 1319, 1760].forEach((f, i) => tone(f, { at: i * 0.09, len: 0.08, vol: 0.4, type: 'triangle', slide: 250 })),
  boomwing: () => { for (let i = 0; i < 6; i++) drum(150 - i * 8, i * 0.06, 0.25 + i * 0.03); bell(392, 0.4, 0.6, 0.2); },
  drumbo: () => { drum(196, 0); drum(147, 0.14); drum(196, 0.28); },
  bongorilla: () => { drum(110, 0, 0.5); drum(110, 0.12, 0.5); drum(147, 0.3, 0.5); drum(98, 0.42, 0.55); },
  dinglet: () => { bell(1047, 0, 0.6, 0.25); bell(1319, 0.15, 0.7, 0.2); },
  gongolin: () => bell(110, 0, 1.6, 0.45),
  clawdio: () => { noise({ freq: 3000, len: 0.03, vol: 0.3, q: 2 }); [523, 659, 587, 784].forEach((f, i) => tone(f, { at: 0.05 + i * 0.1, len: 0.1, vol: 0.3, type: 'square' })); },
};

// A slow rumble of low noise (thunder).
function rumble({ at = 0, len = 1.8, vol = 0.35 } = {}) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = longNoise;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 150;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * scale, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + len + 0.02);
}

const AMBIENCE = {
  rain: { type: 'lowpass', freq: 1200, q: 0.7, level: 0.10 },
  storm: { type: 'lowpass', freq: 900, q: 0.7, level: 0.15 },
  wind: { type: 'bandpass', freq: 400, q: 0.7, level: 0.06 },
};

const SOUNDS = {
  break: () => { noise({ freq: 500, len: 0.09, vol: 0.6 }); noise({ at: 0.04, freq: 300, len: 0.07, vol: 0.4 }); },
  place: () => { noise({ freq: 1200, len: 0.04, vol: 0.35, q: 2 }); tone(180, { len: 0.06, vol: 0.25 }); },
  cube: () => notes([660, 990], 0.05, { len: 0.06, type: 'triangle', vol: 0.3 }),
  battle: () => notes([392, 523, 659], 0.08, { len: 0.12, type: 'triangle', vol: 0.35 }),
  hit: () => { noise({ freq: 900, len: 0.07, vol: 0.5 }); tone(220, { len: 0.08, vol: 0.3, slide: -80 }); },
  super: () => { noise({ freq: 1400, len: 0.1, vol: 0.5 }); tone(330, { len: 0.12, vol: 0.35, type: 'triangle', slide: 200 }); },
  miss: () => noise({ freq: 2000, len: 0.15, vol: 0.25, q: 0.7 }),
  faint: () => tone(440, { len: 0.4, type: 'triangle', vol: 0.35, slide: -300 }),
  wobble: () => tone(300, { len: 0.07, vol: 0.3, type: 'triangle' }),
  caught: () => notes([523, 659, 784, 1047], 0.09, { len: 0.16, type: 'triangle', vol: 0.35 }),
  escape: () => notes([392, 330], 0.08, { len: 0.1, type: 'triangle', vol: 0.3 }),
  levelup: () => notes([523, 784], 0.1, { len: 0.14, type: 'triangle', vol: 0.3 }),
  evolve: () => notes([392, 494, 587, 784, 988], 0.1, { len: 0.18, type: 'triangle', vol: 0.3 }),
  win: () => notes([523, 659, 784, 659, 1047], 0.1, { len: 0.16, type: 'triangle', vol: 0.3 }),
  badge: () => notes([523, 659, 784, 1047, 784, 1047], 0.11, { len: 0.2, type: 'triangle', vol: 0.32 }),
  lose: () => notes([392, 349, 294], 0.14, { len: 0.2, type: 'triangle', vol: 0.3 }),
  heal: () => notes([659, 880, 1175], 0.08, { len: 0.18, vol: 0.3 }),
  ask: () => notes([784, 988], 0.1, { len: 0.12, type: 'triangle', vol: 0.3 }),
  // Weather.
  thunder: () => { rumble(); rumble({ at: 0.4, vol: 0.2 }); },
  rainbow: () => notes([784, 988, 1175, 1568], 0.09, { len: 0.18, type: 'triangle', vol: 0.25 }),
  star: () => notes([1568, 2093], 0.12, { len: 0.2, vol: 0.18 }),
  // The Champion's Tower.
  boss: () => notes([220, 262, 330, 262, 196], 0.16, { len: 0.24, type: 'triangle', vol: 0.3 }),
  bossloop: () => notes([110, 131, 165, 131], 0.4, { len: 0.35, vol: 0.12 }),
  powerup: () => { tone(300, { len: 0.6, slide: 900, type: 'triangle', vol: 0.25 }); [784, 988, 1175].forEach((f, i) => tone(f, { at: 0.5 + i * 0.12, len: 0.2, type: 'triangle', vol: 0.3 })); },
  champion: () => notes([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.13, { len: 0.26, type: 'triangle', vol: 0.32 }),
  // Sound-type moves.
  echoping: () => [0, 0.16, 0.32, 0.48].forEach((at, i) => tone(1320, { at, len: 0.12, vol: 0.3 * 0.55 ** i })),
  bassblast: () => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.6);
    f.type = 'lowpass'; f.frequency.value = 400;
    lfo.frequency.value = 7; depth.gain.value = 300; // the "wub-wub"
    lfo.connect(depth).connect(f.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6 * scale, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(f).connect(g).connect(master);
    o.start(t); lfo.start(t); o.stop(t + 0.65); lfo.stop(t + 0.65);
    drum(80, 0, 0.4);
  },
  shriek: () => { tone(1500, { len: 0.22, type: 'triangle', vol: 0.25, slide: 700 }); tone(1800, { at: 0.08, len: 0.18, type: 'triangle', vol: 0.18, slide: -500 }); },
  lullaby: () => notes([659, 587, 523, 440], 0.16, { len: 0.28, type: 'triangle', vol: 0.22 }),
  bigbong: () => bell(98, 0, 1.8, 0.45),
  // Attack animation sounds, one per type: 'fx:<type>' (the names can never clash with a move id).
  'fx:normal': () => noise({ freq: 1200, len: 0.14, vol: 0.25, q: 0.8 }),
  'fx:fire': () => { for (let i = 0; i < 3; i++) noise({ at: i * 0.07, freq: 2500 + i * 700, len: 0.04, vol: 0.2, q: 1.5 }); },
  'fx:water': () => notes([500, 650], 0.09, { len: 0.1, vol: 0.2, slide: 300 }),
  'fx:grass': () => noise({ freq: 5000, len: 0.22, vol: 0.18, q: 0.6 }),
  'fx:electric': () => tone(300, { len: 0.16, type: 'square', vol: 0.12, slide: 500 }),
  'fx:rock': () => { tone(90, { len: 0.1, vol: 0.25, slide: -30 }); tone(70, { at: 0.14, len: 0.12, vol: 0.25, slide: -20 }); },
  'fx:ice': () => notes([1800, 2400], 0.08, { len: 0.14, type: 'triangle', vol: 0.18 }),
  'fx:bug': () => tone(220, { len: 0.22, type: 'sawtooth', vol: 0.1, slide: 40 }),
  'fx:ghost': () => tone(600, { len: 0.34, vol: 0.2, slide: -350 }),
  'fx:mind': () => tone(520, { len: 0.34, vol: 0.2, slide: 120 }),
  'fx:metal': () => bell(2200, 0, 0.3, 0.22),
  'fx:toxic': () => tone(260, { len: 0.28, vol: 0.25, slide: -170 }),
  'fx:pixie': () => notes([1568, 2093], 0.1, { len: 0.16, vol: 0.16 }),
  'fx:drake': () => tone(110, { len: 0.34, type: 'sawtooth', vol: 0.2, slide: -35 }),
  'fx:rainbow': () => notes([659, 784, 1047], 0.07, { len: 0.12, type: 'triangle', vol: 0.2 }),
  'fx:cosmic': () => tone(500, { len: 0.34, type: 'triangle', vol: 0.18, slide: 1100 }),
  'fx:sound': () => notes([880, 1175], 0.1, { len: 0.14, vol: 0.2 }),
  'fx:bone': () => { tone(800, { len: 0.05, type: 'square', vol: 0.1 }); tone(600, { at: 0.09, len: 0.05, type: 'square', vol: 0.1 }); },
  'fx:alien': () => tone(700, { len: 0.34, vol: 0.2, slide: -250 }),
  // The four newer types.
  'fx:sky': () => { noise({ freq: 500, len: 0.16, vol: 0.14, q: 0.7 }); noise({ at: 0.12, freq: 1500, len: 0.2, vol: 0.16, q: 0.9 }); },
  'fx:slime': () => { tone(220, { len: 0.12, vol: 0.22, slide: 260 }); tone(300, { at: 0.13, len: 0.1, vol: 0.18, slide: -200 }); },
  'fx:light': () => { notes([1320, 1760, 2349], 0.07, { len: 0.14, type: 'triangle', vol: 0.14 }); },
  'fx:paper': () => { noise({ freq: 4500, len: 0.05, vol: 0.14, q: 1 }); noise({ at: 0.07, freq: 6500, len: 0.06, vol: 0.14, q: 0.8 }); noise({ at: 0.16, freq: 5500, len: 0.1, vol: 0.1, q: 0.6 }); },
  // T18: Time, Camo and Cyber.
  'fx:time': () => { tone(1600, { len: 0.03, type: 'square', vol: 0.1 }); tone(1200, { at: 0.13, len: 0.03, type: 'square', vol: 0.1 }); },
  'fx:camo': () => { noise({ freq: 3000, len: 0.18, vol: 0.12, q: 0.6 }); tone(400, { at: 0.16, len: 0.06, vol: 0.2, slide: 300 }); },
  'fx:cyber': () => notes([880, 1320, 660], 0.05, { len: 0.04, type: 'square', vol: 0.08 }),
  // T21: Cozy (a soft, warm two-note "mmm") and Treasure (a little coin jingle).
  'fx:cozy': () => notes([523, 659], 0.12, { len: 0.2, type: 'triangle', vol: 0.14 }),
  'fx:treasure': () => { bell(1760, 0, 0.25, 0.14); bell(2349, 0.08, 0.3, 0.12); bell(2637, 0.16, 0.35, 0.1); },
  'fx:food': () => { tone(330, { len: 0.06, type: 'square', vol: 0.12 }); tone(262, { at: 0.09, len: 0.08, type: 'square', vol: 0.12 }); }, // T33: a quiet nom nom
  // T36 Obstacle Course: a springy boing when you fall on the mat, two rising notes at a checkpoint flag.
  boing: () => { tone(420, { len: 0.16, vol: 0.28, slide: -260, type: 'triangle' }); tone(220, { at: 0.15, len: 0.16, vol: 0.28, slide: 380, type: 'triangle' }); },
  // T36.5: crumble (a short gravelly crunch), zap (an electric buzz falling in pitch), whoosh (an air puff).
  crumble: () => { noise({ freq: 700, len: 0.1, vol: 0.2, q: 0.7 }); noise({ at: 0.07, freq: 1200, len: 0.08, vol: 0.14, q: 0.7 }); },
  zap: () => { tone(900, { len: 0.3, type: 'sawtooth', vol: 0.1, slide: -700 }); noise({ freq: 3000, len: 0.12, vol: 0.12, q: 0.8 }); },
  whoosh: () => { noise({ freq: 1200, len: 0.25, vol: 0.2, q: 0.5 }); },
  checkpoint: () => notes([784, 1175], 0.1, { len: 0.22, type: 'triangle', vol: 0.24 }),
  // T36 parkour: a quick whoosh (sweeping down) and a soft landing tap.
  'fx:parkour': () => { noise({ freq: 2000, len: 0.06, vol: 0.16, q: 0.9 }); noise({ at: 0.06, freq: 800, len: 0.06, vol: 0.14, q: 0.9 }); tone(110, { at: 0.13, len: 0.1, vol: 0.2, slide: -30 }); },
  // T37 ninja: a quick throwing-star swish (high, sweeping down) and a soft thock; a wild Ninja's smoke puff (a soft hiss).
  'fx:tiny': () => { notes([1760, 1976, 2093], 0.04, { len: 0.03, type: 'square', vol: 0.06 }); tone(2400, { at: 0.13, len: 0.06, type: 'sine', vol: 0.08, slide: 700 }); }, // T40a: a pitter-patter and a tiny squeak
  // T40a Giant House: the toy train (chuff chuff, a whistle), the cat waking (a soft mrrow), the tap and the river (bubbles)
  choochoo: () => { noise({ freq: 900, len: 0.1, vol: 0.2 }); noise({ at: 0.18, freq: 900, len: 0.1, vol: 0.2 }); tone(880, { at: 0.4, len: 0.3, type: 'triangle', vol: 0.18, slide: -120 }); tone(660, { at: 0.4, len: 0.3, type: 'triangle', vol: 0.14 }); },
  mrrow: () => { tone(520, { len: 0.3, type: 'triangle', vol: 0.25, slide: -200 }); tone(700, { at: 0.12, len: 0.25, type: 'sine', vol: 0.16, slide: -300 }); },
  gurgle: () => { notes([300, 420, 360, 500, 420], 0.07, { len: 0.08, type: 'sine', vol: 0.18, slide: 150 }); noise({ freq: 1500, len: 0.3, vol: 0.1, q: 0.5 }); },
  'fx:ninja': () => { noise({ freq: 4000, len: 0.07, vol: 0.14, q: 1.2 }); tone(1400, { at: 0.02, len: 0.08, type: 'triangle', vol: 0.1, slide: -900 }); tone(180, { at: 0.1, len: 0.06, vol: 0.18, slide: -40 }); },
  // T40d ball: a rubbery thump-boing; the stadium's kick (a low thump), a goal cheer (a crowd rising, three notes), a net swish and two whistle chirps.
  'fx:ball': () => { tone(160, { len: 0.08, vol: 0.25, slide: 120 }); tone(320, { at: 0.09, len: 0.12, type: 'triangle', vol: 0.15, slide: 200 }); },
  ballkick: () => { noise({ freq: 220, len: 0.08, vol: 0.4, q: 0.6 }); tone(120, { len: 0.09, vol: 0.3, slide: -40 }); },
  goalcheer: () => { for (const f of [700, 1200, 2000]) noise({ freq: f, len: 0.6, vol: 0.12, q: 0.4 }); notes([523, 659, 784], 0.12, { len: 0.2, type: 'triangle', vol: 0.14 }); },
  netswish: () => { noise({ freq: 5000, len: 0.25, vol: 0.2, q: 0.8 }); tone(1800, { len: 0.2, type: 'sine', vol: 0.05, slide: -1200 }); },
  whistle: () => { tone(2600, { len: 0.12, type: 'square', vol: 0.07 }); tone(2600, { at: 0.18, len: 0.2, type: 'square', vol: 0.07 }); },
  // T40b pirate: a low cannon boom with a short burst of noise; the gadget cannon (deeper, two drums); a falling splash in the sea.
  'fx:pirate': () => { drum(96, 0, 0.3); noise({ freq: 1500, len: 0.1, vol: 0.14, q: 0.7 }); },
  cannonboom: () => { drum(70, 0, 0.45); drum(52, 0.07, 0.4); noise({ freq: 700, len: 0.35, vol: 0.28, q: 0.5 }); },
  seasplash: () => { noise({ freq: 2200, len: 0.35, vol: 0.2, q: 0.6 }); noise({ at: 0.08, freq: 900, len: 0.4, vol: 0.18, q: 0.5 }); tone(300, { len: 0.2, vol: 0.08, slide: -180 }); },
  // T41 atlantis: a soft low bell with a shimmer; the glowfish sounds (a pling when one is caught, a rising chime when a lantern lights, a bubbly kick, a lunge whoosh, a wobbling jar).
  'fx:atlantis': () => { tone(196, { len: 0.4, vol: 0.18, slide: -10 }); tone(392, { at: 0.02, len: 0.3, vol: 0.1 }); tone(1176, { at: 0.08, len: 0.25, type: 'triangle', vol: 0.05 }); },
  atcatch: () => { tone(880, { len: 0.09, type: 'triangle', vol: 0.16 }); tone(1320, { at: 0.07, len: 0.14, type: 'triangle', vol: 0.14 }); },
  atlight: () => { [392, 494, 587, 784].forEach((f, i) => tone(f, { at: i * 0.09, len: 0.4, vol: 0.14 })); tone(98, { len: 0.7, vol: 0.12 }); },
  atkick: () => { noise({ freq: 700, len: 0.18, vol: 0.12, q: 0.5 }); tone(260, { len: 0.18, vol: 0.06, slide: 140 }); },
  atlunge: () => { noise({ freq: 1800, len: 0.14, vol: 0.14, q: 0.8 }); tone(420, { len: 0.12, type: 'triangle', vol: 0.06, slide: -250 }); },
  atwobble: () => { tone(300, { len: 0.1, vol: 0.1, slide: 40 }); tone(330, { at: 0.12, len: 0.1, vol: 0.1, slide: -40 }); tone(300, { at: 0.24, len: 0.1, vol: 0.1, slide: 40 }); },
  // T45 doodle: a quick pencil scribble (filtered noise ticks); the pencil's soft scratch while it draws a line; a rubbery squeak when Rubber rubs it out.
  'fx:doodle': () => { for (let i = 0; i < 4; i++) noise({ at: i * 0.045, freq: 3200 + (i % 2) * 1400, len: 0.035, vol: 0.12, q: 1.6 }); },
  doodlescratch: () => { for (let i = 0; i < 3; i++) noise({ at: i * 0.05, freq: 3600 + i * 500, len: 0.04, vol: 0.05, q: 1.8 }); },
  // T49 knight / the Castle: a short trumpet fanfare; the catapult's creak and thunk; a bow's twang; a shield's clang; a soft pumpkin
  // squelch ("yuck, sticky!", owner 2026-10-28: nothing that sounds like hurting); a lance on a shield; the drawbridge's chains; a bonk on the helm.
  'fx:knight': () => notes([523, 523, 784], 0.1, { len: 0.12, type: 'square', vol: 0.09 }),
  trumpet: () => { notes([523, 659, 784], 0.11, { len: 0.12, type: 'square', vol: 0.1 }); tone(1047, { at: 0.36, len: 0.3, type: 'square', vol: 0.11 }); },
  catapultcreak: () => { for (let i = 0; i < 3; i++) tone(180 + i * 40, { at: i * 0.09, len: 0.07, type: 'sawtooth', vol: 0.05, slide: 30 }); },
  catapultthunk: () => { noise({ freq: 300, len: 0.12, vol: 0.2, q: 0.8 }); tone(110, { len: 0.12, type: 'triangle', vol: 0.18, slide: -40 }); },
  bowtwang: () => tone(300, { len: 0.18, type: 'triangle', vol: 0.12, slide: -120 }),
  shieldclang: () => { bell(1240, 0, 0.3, 0.16); bell(1860, 0.01, 0.22, 0.08); noise({ freq: 4200, len: 0.05, vol: 0.08, q: 1.4 }); },
  pumpkinsplat: () => { noise({ freq: 420, len: 0.24, vol: 0.26, q: 0.5 }); tone(260, { len: 0.2, type: 'sine', vol: 0.14, slide: -170 }); tone(520, { at: 0.12, len: 0.1, type: 'sine', vol: 0.06, slide: 200 }); },
  lanceclang: () => { bell(980, 0, 0.35, 0.2); noise({ freq: 2600, len: 0.08, vol: 0.14, q: 1 }); },
  drawbridge: () => { for (let i = 0; i < 8; i++) noise({ at: i * 0.11, freq: 2200 + (i % 2) * 600, len: 0.05, vol: 0.07, q: 2 }); tone(90, { at: 0.9, len: 0.25, type: 'triangle', vol: 0.2, slide: -30 }); },
  helmbonk: () => { bell(620, 0, 0.18, 0.12); tone(200, { len: 0.1, type: 'triangle', vol: 0.12, slide: -60 }); },
  /* ==== Bubble ==== */
  // The Bubble Well: a bubbly glug for attacks; blowing a bubble (a soft airy whoo), a pop, landing on a bubble (a rubbery boing), soap
  // filling up (a bright little run), a puff on a duckling, a duckling home (a happy squeak-squeak), a puff in the chimney ride, a fizz
  // star, a shield bubble bursting, the fizz lift.
  'fx:bubble': () => { for (let i = 0; i < 4; i++) tone(500 + i * 180, { at: i * 0.05, len: 0.07, type: 'sine', vol: 0.14, slide: 300 }); },
  wandblow: () => { noise({ freq: 1400, len: 0.22, vol: 0.08, q: 0.6 }); tone(420, { at: 0.08, len: 0.16, type: 'sine', vol: 0.1, slide: 240 }); },
  soappop: () => { noise({ freq: 2600, len: 0.04, vol: 0.18, q: 1.2 }); tone(1300, { len: 0.05, type: 'sine', vol: 0.12, slide: -600 }); },
  bubbleland: () => tone(260, { len: 0.16, type: 'sine', vol: 0.16, slide: 160 }),
  // Owner 2026-10-30 "more bouncy / funnier": a cartoon boi-oi-oi-oing for bouncing off a bubble (and a shield's side): a springy sweep
  // up, then a wobble that rings down and fades, plus a little rubbery squeak on top.
  bubblebounce: () => {
    tone(150, { len: 0.12, type: 'triangle', vol: 0.26, slide: 360 });
    [520, 430, 470, 390, 420, 360].forEach((f, i) => tone(f, { at: 0.1 + i * 0.065, len: 0.08, type: 'triangle', vol: 0.2 * (1 - i * 0.13), slide: i % 2 ? 70 : -70 }));
    tone(1300, { at: 0.02, len: 0.06, type: 'sine', vol: 0.06, slide: 500 });
  },
  soapfill: () => notes([784, 988, 1175, 1568], 0.05, { len: 0.08, type: 'triangle', vol: 0.12 }),
  duckpuff: () => { noise({ freq: 900, len: 0.12, vol: 0.1, q: 0.7 }); tone(700, { at: 0.03, len: 0.08, type: 'sine', vol: 0.08, slide: 200 }); },
  duckhome: () => { tone(1200, { len: 0.08, type: 'square', vol: 0.06, slide: 300 }); tone(1300, { at: 0.12, len: 0.08, type: 'square', vol: 0.06, slide: 300 }); tone(784, { at: 0.25, len: 0.12, type: 'triangle', vol: 0.12 }); tone(1047, { at: 0.35, len: 0.14, type: 'triangle', vol: 0.12 }); },
  chimneypuff: () => { noise({ freq: 700, len: 0.1, vol: 0.09, q: 0.6 }); tone(330, { len: 0.1, type: 'sine', vol: 0.08, slide: 180 }); },
  fizzstar: () => { notes([1047, 1319, 1568], 0.06, { len: 0.1, type: 'triangle', vol: 0.12 }); noise({ freq: 6000, len: 0.15, vol: 0.05, q: 1 }); },
  shieldburst: () => { noise({ freq: 1800, len: 0.18, vol: 0.2, q: 0.7 }); tone(900, { len: 0.2, type: 'sine', vol: 0.14, slide: -500 }); bell(1568, 0.12, 0.4, 0.1); },
  fizzlift: () => { for (let i = 0; i < 6; i++) tone(400 + i * 120, { at: i * 0.05, len: 0.06, type: 'sine', vol: 0.08, slide: 200 }); },
  /* ==== end of Bubble ==== */
  /* ==== Gravity ==== */
  // Cube Planets: a wobbly pull for attacks (a tone that sinks and comes back), the Orbikit tagged (a bright chime), seen (a little meep and
  // a zoom), a launch flower (a springy whoosh), landing on a pebble (a soft thump and a twinkle), hopping on the moon (a hollow boop),
  // a ring hit (rising stars).
  'fx:gravity': () => { tone(520, { len: 0.16, type: 'sine', vol: 0.14, slide: -260 }); tone(260, { at: 0.15, len: 0.16, type: 'sine', vol: 0.12, slide: 380 }); },
  orbitag: () => notes([880, 1175, 1568, 2093], 0.06, { len: 0.12, type: 'triangle', vol: 0.12 }),
  orbiseen: () => { tone(1400, { len: 0.06, type: 'square', vol: 0.05, slide: 300 }); noise({ at: 0.06, freq: 2400, len: 0.18, vol: 0.06, q: 0.8 }); },
  flowerpop: () => { tone(220, { len: 0.25, type: 'triangle', vol: 0.14, slide: 520 }); noise({ freq: 1600, len: 0.2, vol: 0.06, q: 0.6 }); },
  pebbleland: () => { tone(140, { len: 0.12, type: 'sine', vol: 0.2, slide: -40 }); bell(1760, 0.06, 0.3, 0.08); },
  moonhop: () => { tone(330, { len: 0.12, type: 'sine', vol: 0.14, slide: -80 }); tone(495, { at: 0.08, len: 0.1, type: 'sine', vol: 0.1 }); },
  ringstar: () => notes([659, 880, 1175, 1568], 0.07, { len: 0.12, type: 'triangle', vol: 0.12 }),
  // Redesign 2026-10-29: a spring flower squashed under your feet (a low creaky squish), and its fling (a big wobbly boing), a lens found
  springsquish: () => { tone(180, { len: 0.14, type: 'triangle', vol: 0.14, slide: -70 }); noise({ freq: 700, len: 0.1, vol: 0.04, q: 1.2 }); },
  springboing: () => { tone(160, { len: 0.18, type: 'triangle', vol: 0.22, slide: 520 }); tone(340, { at: 0.16, len: 0.12, type: 'triangle', vol: 0.12, slide: -160 }); tone(300, { at: 0.27, len: 0.1, type: 'triangle', vol: 0.08, slide: 140 }); },
  lensfound: () => notes([784, 988, 1319, 1568, 1976], 0.06, { len: 0.14, type: 'sine', vol: 0.12 }),
  // Owner 2026-10-30: running feet on a chase planet (a soft pat with each ring) and an Orbikit that heard you (a rising "hm?")
  orbistep: () => { noise({ freq: 500, len: 0.05, vol: 0.05, q: 1.5 }); tone(110, { len: 0.05, type: 'sine', vol: 0.06, slide: -30 }); },
  orbiheard: () => { tone(700, { len: 0.08, type: 'triangle', vol: 0.1, slide: -80 }); tone(760, { at: 0.12, len: 0.16, type: 'triangle', vol: 0.12, slide: 520 }); },
  /* ==== end of Gravity ==== */
  /* ==== Mirror ==== */
  // The Mirror Palace: a bright glassy "ting" up a fifth for attacks (the rest of its sounds come with its games).
  'fx:mirror': () => { bell(1319, 0, 0.5, 0.2); bell(1976, 0.09, 0.6, 0.18); },
  /* ==== end of Mirror ==== */
  doodlerub: () => { tone(900, { len: 0.1, type: 'triangle', vol: 0.12, slide: 500 }); tone(1300, { at: 0.1, len: 0.1, type: 'triangle', vol: 0.1, slide: -400 }); },
  smokepuff: () => { noise({ freq: 900, len: 0.22, vol: 0.14, q: 0.5 }); tone(520, { len: 0.1, type: 'sine', vol: 0.08, slide: 300 }); },
  // T42 portal: a rising "vwoop" and a pop; the House: swirlzip (your swirl sticks to a pad: a quick sparkle up), swirlwarp (through a swirl: a falling-then-rising whoosh and a pop).
  'fx:portal': () => { tone(300, { len: 0.22, type: 'sine', vol: 0.16, slide: 700 }); tone(1100, { at: 0.2, len: 0.06, type: 'triangle', vol: 0.18, slide: -500 }); },
  swirlzip: () => { notes([880, 1175, 1568], 0.045, { len: 0.1, type: 'sine', vol: 0.2 }); noise({ freq: 5000, len: 0.12, vol: 0.06, q: 1 }); },
  swirlwarp: () => { tone(500, { len: 0.18, type: 'sine', vol: 0.2, slide: -300 }); tone(250, { at: 0.16, len: 0.2, type: 'sine', vol: 0.22, slide: 800 }); noise({ at: 0.3, freq: 1800, len: 0.08, vol: 0.14, q: 1 }); },
  // T43 funfair: a little organ arpeggio for attacks; a balloon pop, a gold ring ding, a bumper car honk, a coaster chain click, the
  // golden ticket jingle and a quiet fair tune (the live part plays it every few seconds while the fair is awake).
  'fx:funfair': () => { notes([523, 659, 784, 1047], 0.06, { len: 0.1, type: 'square', vol: 0.08 }); notes([523, 659, 784, 1047], 0.06, { len: 0.12, type: 'triangle', vol: 0.12 }); },
  balloonpop: () => { noise({ freq: 1800, len: 0.06, vol: 0.3, q: 0.6 }); tone(900, { len: 0.05, type: 'square', vol: 0.08, slide: -600 }); },
  ringding: () => { bell(2093, 0, 0.3, 0.2); bell(2637, 0.08, 0.4, 0.2); },
  honkhonk: () => { tone(330, { len: 0.12, type: 'square', vol: 0.1 }); tone(294, { at: 0.15, len: 0.16, type: 'square', vol: 0.1 }); },
  coasterclack: () => { noise({ freq: 3000, len: 0.03, vol: 0.22, q: 2 }); tone(120, { len: 0.05, type: 'square', vol: 0.1, slide: -30 }); },
  ticketprize: () => { notes([784, 988, 1175, 1568], 0.08, { len: 0.16, type: 'triangle', vol: 0.26 }); bell(1568, 0.34, 0.5, 0.2); },
  fairtune: () => notes([523, 659, 784, 659, 523, 784, 1047, 784], 0.17, { len: 0.22, type: 'triangle', vol: 0.09 }),
  // T43 harder games (owner 2026-10-27): a new round (a little rising fanfare), a round to try again (a soft, friendly "wah-wah" up), a combo
  // step (a higher blip each time), a target balloon booped from below, a bumper bot zooming off.
  fairround: () => { notes([659, 784, 1047], 0.09, { len: 0.14, type: 'triangle', vol: 0.22 }); bell(1319, 0.3, 0.4, 0.16); },
  fairagain: () => { tone(392, { len: 0.18, type: 'triangle', vol: 0.16, slide: -40 }); tone(523, { at: 0.2, len: 0.22, type: 'triangle', vol: 0.16, slide: 60 }); },
  faircombo: () => { tone(1047, { len: 0.06, type: 'square', vol: 0.07 }); tone(1568, { at: 0.06, len: 0.1, type: 'triangle', vol: 0.14 }); },
  fairboop: () => tone(260, { len: 0.12, type: 'sine', vol: 0.18, slide: 180 }),
  botzoom: () => { tone(200, { len: 0.25, type: 'sawtooth', vol: 0.06, slide: 500 }); noise({ freq: 2200, len: 0.15, vol: 0.06, q: 1 }); },
  // T40c racer: an engine "vroom" (a sawtooth slide up) with a short skid; the race beeps, GO, a lap bell, a boost whoosh and a wild Racer's quiet dash.
  'fx:racer': () => { tone(90, { len: 0.3, type: 'sawtooth', vol: 0.12, slide: 150 }); noise({ at: 0.22, freq: 2600, len: 0.1, vol: 0.1, q: 1.4 }); },
  // T44 surprise: a tiny drum roll and a ta-da; a gift opening (paper rip + pop), a giggle, a door whoosh, a fanfare for the right door,
  // a rubber duck's honk for a wrong one, a jack springing out and a boop on the nose.
  'fx:surprise': () => { for (let i = 0; i < 4; i++) drum(300 + i * 25, i * 0.03, 0.16); notes([784, 1047], 0.09, { at: 0.16, len: 0.12, type: 'triangle', vol: 0.14 }); },
  giftopen: () => { noise({ freq: 5200, len: 0.16, vol: 0.2, q: 0.7 }); noise({ at: 0.05, freq: 3000, len: 0.1, vol: 0.14, q: 0.8 }); tone(300, { at: 0.16, len: 0.14, type: 'triangle', vol: 0.3, slide: 600 }); },
  giftgiggle: () => notes([880, 1175, 988, 1319], 0.06, { len: 0.06, type: 'triangle', vol: 0.05 }),
  doorwhoosh: () => { noise({ freq: 1200, len: 0.28, vol: 0.14, q: 0.5 }); tone(320, { len: 0.22, type: 'sine', vol: 0.07, slide: 400 }); },
  rightdoor: () => { notes([523, 659, 784, 1047], 0.09, { len: 0.16, type: 'triangle', vol: 0.18 }); bell(1568, 0.36, 0.6, 0.16); },
  sillyhonk: () => { tone(330, { len: 0.12, type: 'sawtooth', vol: 0.12, slide: -60 }); tone(300, { at: 0.16, len: 0.16, type: 'sawtooth', vol: 0.12, slide: 120 }); },
  jackpop: () => { tone(180, { len: 0.2, type: 'triangle', vol: 0.3, slide: 700 }); tone(900, { at: 0.08, len: 0.14, type: 'sine', vol: 0.1, slide: -300 }); },
  // T48 the Surprise Party: the Party Spinner's click, the guests' cheer
  spintick: () => { noise({ freq: 4200, len: 0.02, vol: 0.12, q: 3 }); tone(1500, { len: 0.03, type: 'square', vol: 0.03 }); },
  partyyay: () => { notes([659, 784, 988, 1319], 0.07, { len: 0.12, type: 'triangle', vol: 0.12 }); noise({ at: 0.05, freq: 2400, len: 0.3, vol: 0.06, q: 0.4 }); },
  boop: () => { tone(740, { len: 0.1, type: 'sine', vol: 0.3, slide: -200 }); tone(1100, { at: 0.05, len: 0.1, type: 'triangle', vol: 0.12 }); },
  // T44 rework: a piñata CRACK (a paper thwack), the candy rain, a jack caught in your arms, a cream pie's splat.
  pinatawhack: () => { noise({ freq: 900, len: 0.12, vol: 0.32, q: 0.9 }); tone(160, { len: 0.12, type: 'triangle', vol: 0.3, slide: -60 }); noise({ at: 0.04, freq: 3600, len: 0.08, vol: 0.12, q: 1.2 }); },
  candyrain: () => { for (let i = 0; i < 7; i++) tone(1200 + ((i * 7) % 5) * 180, { at: i * 0.05, len: 0.06, type: 'triangle', vol: 0.08 }); [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: 0.3 + i * 0.08, len: 0.14, type: 'triangle', vol: 0.14 })); },
  jackcatch: () => { tone(520, { len: 0.08, type: 'triangle', vol: 0.2, slide: 300 }); bell(1319, 0.07, 0.25, 0.12); },
  piesplat: () => { noise({ freq: 500, len: 0.22, vol: 0.3, q: 0.6 }); tone(220, { len: 0.18, type: 'sine', vol: 0.18, slide: -140 }); },
  racebeep: () => tone(660, { len: 0.12, type: 'square', vol: 0.14 }),
  racego: () => tone(990, { len: 0.4, type: 'square', vol: 0.16 }),
  lapbell: () => { bell(1568, 0, 0.35, 0.2); bell(2093, 0.14, 0.4, 0.2); },
  boostzoom: () => { tone(200, { len: 0.34, type: 'sawtooth', vol: 0.1, slide: 900 }); noise({ freq: 3500, len: 0.3, vol: 0.08, q: 0.7 }); },
  dashzoom: () => tone(110, { len: 0.2, type: 'sawtooth', vol: 0.06, slide: 120 }),
  // Race Track v2 (owner 2026-10-27): a kart bumping a wall (a rubbery thud), flying off the jump ramp, landing
  kartbonk: () => { noise({ freq: 400, len: 0.16, vol: 0.22, q: 0.8 }); tone(140, { len: 0.14, type: 'triangle', vol: 0.16, slide: -60 }); },
  kartjump: () => tone(330, { len: 0.4, type: 'triangle', vol: 0.14, slide: 520 }),
  kartland: () => { noise({ freq: 700, len: 0.12, vol: 0.16, q: 0.7 }); tone(110, { len: 0.1, type: 'square', vol: 0.08 }); },
  'fx:squad': () => notes([523, 587, 659], 0.07, { len: 0.08, type: 'square', vol: 0.1 }), // T34: hup-hup-hup
  // T35: Dream (a soft wobbly glide up and down on two slightly detuned notes).
  'fx:dream': () => { tone(523, { len: 0.18, type: 'triangle', vol: 0.12, slide: 90 }); tone(528, { len: 0.18, type: 'triangle', vol: 0.1, slide: 70 }); tone(613, { at: 0.17, len: 0.18, type: 'triangle', vol: 0.12, slide: -100 }); tone(618, { at: 0.17, len: 0.18, type: 'triangle', vol: 0.1, slide: -80 }); },
  // T35: a Bounce Block launches you: a quick springy pitch sweep up with a little wobble.
  boing: () => { tone(200, { len: 0.22, type: 'triangle', vol: 0.3, slide: 500 }); tone(420, { at: 0.04, len: 0.18, type: 'sine', vol: 0.12, slide: 280 }); },
  // The golden hour starts: a soft tick-tock, 8 ticks over about 3 seconds, the last two quieter.
  ticktock: () => { for (let i = 0; i < 8; i++) tone(i % 2 ? 1100 : 1500, { at: i * 0.42, len: 0.025, type: 'square', vol: i >= 6 ? 0.04 : 0.08 }); },
  // A Clock Tower door opens: two soft bell notes.
  knock: () => notes([196, 180], 0.18, { len: 0.1, type: 'triangle', vol: 0.32 }), // two soft wooden knocks
  doorchime: () => notes([784, 1047], 0.16, { len: 0.35, type: 'sine', vol: 0.22 }),
  // A camo creature pops out of its disguise.
  popout: () => { noise({ freq: 1500, len: 0.08, vol: 0.25, q: 1 }); tone(300, { len: 0.12, vol: 0.25, slide: 500, type: 'triangle' }); },
  // T19 Firewall Maze: a switch flips the lasers (quick rising blip).
  laserflip: () => { tone(500, { len: 0.1, vol: 0.2, slide: 900, type: 'square' }); tone(1000, { at: 0.09, len: 0.06, vol: 0.12, type: 'square' }); },
  // T23: a golden key chest opens (short rising sparkle).
  keyfound: () => notes([1047, 1319, 1568, 2093], 0.07, { len: 0.2, type: 'sine', vol: 0.22 }),
  // T33 Restaurant: the pot starts to cook, turns golden (kitchen-timer ding), burns, and the dish is served.
  potbubble: () => { for (let i = 0; i < 4; i++) tone(200 + i * 40, { at: i * 0.08, len: 0.05, type: 'sine', vol: 0.15, slide: 120 }); },
  cookding: () => bell(1568, 0, 0.5, 0.2),
  potburnt: () => { noise({ freq: 400, len: 0.3, vol: 0.2 }); tone(300, { at: 0.1, len: 0.3, slide: -200, type: 'triangle', vol: 0.2 }); },
  yum: () => notes([523, 659, 784], 0.08, { len: 0.12, type: 'triangle', vol: 0.25 }),
  // T37b Shadow Dojo: a nightingale board squeaks (two quick chirps up), a puff of smoke takes you back to the lantern.
  squeak: () => { tone(1500, { len: 0.07, type: 'triangle', vol: 0.18, slide: 900 }); tone(1800, { at: 0.08, len: 0.06, type: 'triangle', vol: 0.14, slide: 700 }); },
  puff: () => { noise({ freq: 900, len: 0.3, vol: 0.22, q: 0.5 }); tone(520, { at: 0.05, len: 0.25, type: 'sine', vol: 0.16, slide: -300 }); },
  // Echo Gym dance-off: one note per pad (red, blue, green, yellow), a soft "watch again" and a cheer at the end.
  dancepad0: () => { tone(523, { len: 0.22, type: 'triangle', vol: 0.3 }); drum(196, 0, 0.18); },
  dancepad1: () => { tone(659, { len: 0.22, type: 'triangle', vol: 0.3 }); drum(220, 0, 0.18); },
  dancepad2: () => { tone(784, { len: 0.22, type: 'triangle', vol: 0.3 }); drum(247, 0, 0.18); },
  dancepad3: () => { tone(1047, { len: 0.22, type: 'triangle', vol: 0.28 }); drum(262, 0, 0.18); },
  danceoops: () => tone(392, { len: 0.25, vol: 0.2, slide: -120, type: 'triangle' }),
  danceyay: () => { notes([523, 659, 784, 1047, 784, 1047], 0.09, { len: 0.14, type: 'triangle', vol: 0.28 }); drum(196, 0); drum(196, 0.27); drum(262, 0.45); },
  // T25 big-decision moves (short and quiet).
  'kind:rally': () => notes([392, 523, 659, 784], 0.08, { len: 0.14, type: 'triangle', vol: 0.26 }),
  'kind:shield': () => { bell(660, 0, 0.5, 0.18); tone(440, { at: 0.05, len: 0.35, vol: 0.14, slide: 440, type: 'sine' }); },
  'kind:jackpot': () => { bell(1319, 0, 0.5, 0.18); bell(1568, 0.1, 0.5, 0.18); bell(2093, 0.2, 0.5, 0.2); },
  'kind:oops': () => { tone(500, { len: 0.3, vol: 0.26, slide: -350, type: 'triangle' }); noise({ at: 0.22, freq: 300, len: 0.1, vol: 0.2 }); },
  'kind:gift': () => notes([392, 494, 587, 784, 988], 0.07, { len: 0.16, type: 'sine', vol: 0.24 }),
  'kind:curse': () => notes([440, 370, 294], 0.15, { len: 0.2, type: 'sawtooth', vol: 0.12 }),
  'kind:field': () => tone(220, { len: 0.55, vol: 0.2, slide: 220, type: 'sine' }),
  'kind:lastword': () => { drum(110, 0, 0.3); tone(330, { at: 0.12, len: 0.35, vol: 0.2, slide: 330, type: 'triangle' }); },
  // Move effects in battle.
  statup: () => notes([523, 784], 0.08, { len: 0.12, type: 'triangle', vol: 0.28 }),
  statdown: () => notes([523, 330], 0.08, { len: 0.12, type: 'triangle', vol: 0.28 }),
  snooze: () => notes([440, 392, 330], 0.14, { len: 0.2, type: 'triangle', vol: 0.18 }),
};

function loadOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export const sound = {
  on: loadOn(),
  played: [], // names of the last few sounds (handy for tests)
  errors: [], // sound problems are swallowed so they never break the game; tests check this
  ambient: null, // 'rain' | 'storm' | 'wind' | null: the quiet looping weather sound that should play
  ambientLevel: 0, // the volume actually applied (0 when sound is off)

  has(name) { return !!SOUNDS[name]; },

  play(name) {
    if (!this.on || !SOUNDS[name]) return;
    this.played.push(name);
    if (this.played.length > 30) this.played.shift();
    const a = audio();
    if (!a || a.state !== 'running') return;
    try { SOUNDS[name](); } catch (e) { this.errors.push(`${name}: ${e.message}`); }
  },

  // A creature's own tune (only sound-type creatures have one). volume (0..1) is lower for wild
  // ones further away.
  cry(species, type, volume = 1) {
    if (type !== 'sound') return;
    const name = `cry:${species}`;
    if (!this.on) return;
    this.played.push(name);
    if (this.played.length > 30) this.played.shift();
    const a = audio();
    if (!a || a.state !== 'running') return;
    scale = volume;
    try {
      if (CRIES[species]) CRIES[species]();
      else notes([523, 659, 784].map(f => f * (1 + (species.length % 5) / 10)), 0.09, { len: 0.14, type: 'triangle', vol: 0.3 });
    } catch (e) { this.errors.push(`${name}: ${e.message}`); }
    scale = 1;
  },

  setOn(on) {
    this.on = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
    if (on) { unlock(); this.play('cube'); }
    this.applyAmbience();
  },

  // Rain, storm or wind loop (weather.js). level overrides the usual volume.
  setAmbience(name, level) {
    this.ambient = name && AMBIENCE[name] ? name : null;
    this.ambientWanted = this.ambient ? (level ?? AMBIENCE[name].level) : 0;
    this.applyAmbience();
  },

  applyAmbience() {
    this.ambientLevel = this.on ? this.ambientWanted || 0 : 0;
    try {
      const a = this.ambient || amb ? audio() : null;
      if (!a || a.state !== 'running') return;
      if (!amb) {
        const src = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain();
        src.buffer = longNoise; src.loop = true;
        gain.gain.value = 0;
        src.connect(filter).connect(gain).connect(master);
        src.start();
        amb = { src, filter, gain };
      }
      const cfg = AMBIENCE[this.ambient];
      if (cfg) { amb.filter.type = cfg.type; amb.filter.frequency.value = cfg.freq; amb.filter.Q.value = cfg.q; }
      amb.gain.gain.setTargetAtTime(this.ambientLevel, a.currentTime, 0.8);
    } catch (e) { this.errors.push(`ambience: ${e.message}`); }
  },
};

function unlock() {
  if (!sound.on) return;
  const a = audio();
  if (a && a.state !== 'running') a.resume().then(() => sound.applyAmbience()).catch(() => {});
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { capture: true, passive: true });
