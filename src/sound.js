// Small, quiet sound effects made with the Web Audio API (no sound files to download).
// Browsers only allow sound after the player clicks, taps or presses a key, so the audio
// starts on the first of those. sound.on is remembered on this device.

const KEY = 'pokecraft-sound';
const VOLUME = 0.18;

let ctx = null;
let master = null;
let noiseBuf = null;

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
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
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
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + len + 0.02);
}

const notes = (list, gap, opts) => list.forEach((f, i) => tone(f, { at: i * gap, ...opts }));

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
};

function loadOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export const sound = {
  on: loadOn(),
  played: [], // names of the last few sounds (handy for tests)

  play(name) {
    if (!this.on || !SOUNDS[name]) return;
    this.played.push(name);
    if (this.played.length > 30) this.played.shift();
    const a = audio();
    if (!a || a.state !== 'running') return;
    try { SOUNDS[name](); } catch { /* sound is a nice-to-have; never break the game */ }
  },

  setOn(on) {
    this.on = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
    if (on) { unlock(); this.play('cube'); }
  },
};

function unlock() {
  if (!sound.on) return;
  const a = audio();
  if (a && a.state !== 'running') a.resume().catch(() => {});
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { capture: true, passive: true });
