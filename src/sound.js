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
