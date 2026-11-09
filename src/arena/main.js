// Chapter 3 test arena: the page glue (renderer, camera, controls, the five fixed buttons, the HUD) for the three
// battle prototypes. Nothing is saved; your team is only read from this browser's save.
import * as THREE from 'three';
import { SPECIES } from '../species.js';
import { sound } from '../sound.js';
import { R, STEP, FOES, START_SPOTS, Fighter, Fx, buildArena, damage, loadTeam, typeHex, typeCss, typeName, floatText, KIND_WORD } from './core.js';
import { LiveMode } from './live.js';
import { DrawMode, FlickMode } from './turns.js';

const MODES = { live: LiveMode, draw: DrawMode, flick: FlickMode };
// foeHp: monsters' HP x (live battles need longer fights than one shot a second allows)
const TUNE = { live: { foePower: 32, youMult: 1, foeHp: 4 }, draw: { foePower: 32, youMult: 1.5, foeHp: 1 }, flick: { foePower: 45, youMult: 1, foeHp: 1.4 } };
const $ = id => document.getElementById(id);

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd4ff);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
buildArena(scene);
const fx = new Fx(scene);

const team = loadTeam();
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- the arena object the modes talk to

const a = {
  scene, camera, fx, you: null, foes: [], over: false, input: { mx: 0, mz: 0 },
  foePower: 40, youMult: 1, clock: 0, teamIndex: 0, count: 3, modeName: params.get('mode') in MODES ? params.get('mode') : 'live',
  typeHex,
  nameOf: f => SPECIES[f.c.species].name,
  sound: n => sound.play(n),
  say(text) {
    const el = $('toast');
    el.textContent = text; el.classList.add('on');
    clearTimeout(a.sayT); a.sayT = setTimeout(() => el.classList.remove('on'), 1600);
  },
  timer(k) {
    const el = $('timer');
    el.classList.toggle('on', k != null);
    if (k != null) { el.firstChild.style.width = `${Math.max(0, k) * 100}%`; el.classList.toggle('late', k < 0.35); }
  },
  hit(src, dst, power, type, mult = 1) {
    if (a.over || !dst.alive) return 0;
    if (dst.safeT > 0) { floatText(camera, dst.x, dst.h + 0.6, dst.z, 'Dodged!', 'miss'); return 0; }
    const { amount, eff } = damage(src.c, dst.c, power, type, mult);
    dst.hp = Math.max(0, dst.hp - amount);
    dst.flash = 0.25;
    floatText(camera, dst.x, dst.h + 0.3, dst.z, `-${amount}`, dst.side === 'you' ? 'ouch' : '');
    if (eff > 1) floatText(camera, dst.x + 0.6, dst.h + 1.1, dst.z, 'Super!', 'super');
    else if (eff < 1) floatText(camera, dst.x + 0.6, dst.h + 1.1, dst.z, 'Not much...', 'miss');
    sound.play('hit');
    a.stats[dst.side === 'you' ? 'taken' : 'dealt'] += amount;
    if (!dst.alive) {
      dst.flash = 0.6;
      sound.play('faint');
      if (dst.tell) { fx.untell(dst.tell); dst.tell = null; }
      if (dst === a.you) a.finish(false);
      else if (a.foes.every(f => !f.alive)) a.finish(true);
    }
    return amount;
  },
  heal(f, frac) {
    const n = Math.min(f.maxHp - f.hp, Math.round(f.maxHp * frac));
    f.hp += n;
    floatText(camera, f.x, f.h + 0.3, f.z, n ? `+${n}` : 'Full!', 'heal');
  },
  hurtSelf(frac) { const n = Math.max(1, Math.round(a.you.maxHp * frac)); a.you.hp = Math.max(1, a.you.hp - n); floatText(camera, a.you.x, a.you.h + 0.3, a.you.z, `-${n}`, 'ouch'); },
  finish(won) {
    if (a.over) return;
    a.over = true; a.won = won;
    a.timer(null);
    const turns = a.mode.turn, secs = Math.round(a.clock);
    $('end-title').textContent = won ? 'You won!' : 'Oops! Your creature is tired.';
    $('end-text').textContent = won
      ? (turns ? `All three beaten in ${turns} turns.` : `All monsters beaten in ${secs} seconds.`) + ` HP left: ${a.you.hp} / ${a.you.maxHp}`
      : 'Try again!';
    setTimeout(() => $('end').classList.remove('hidden'), 700);
    sound.play(won ? 'badge' : 'miss');
  },
};
window.arena = { a, team, step, press: s => a.mode.press(s), release: s => a.mode.release(s), restart, info };

function restart(modeName = a.modeName, opts = {}) {
  a.mode?.dispose?.();
  for (const f of [a.you, ...a.foes]) f?.dispose(scene);
  fx.clear();
  a.modeName = modeName;
  if (opts.count) a.count = opts.count;
  if (opts.team != null) a.teamIndex = opts.team;
  Object.assign(a, TUNE[modeName]);
  a.over = false; a.won = null; a.clock = 0; a.stats = { dealt: 0, taken: 0 };
  const c = team[a.teamIndex] || team[0];
  a.you = new Fighter(scene, c, 'you', 0, -1);
  const lvl = c.level;
  const n = modeName === 'live' ? a.count : 3;
  a.foes = FOES.slice(0, n).map((d, i) => {
    const f = new Fighter(scene, { species: d.species, level: lvl, moves: [], pattern: d.pattern }, 'foe', START_SPOTS[i][0], START_SPOTS[i][1]);
    f.heading = Math.atan2(-f.x, -1 - f.z);
    f.maxHp = f.hp = Math.round(f.maxHp * a.foeHp);
    return f;
  });
  a.you.heading = Math.PI;
  a.mode = new MODES[modeName](a);
  a.mode.start();
  $('hint').textContent = a.mode.hint;
  $('end').classList.add('hidden');
  $('stick').classList.add('hidden');
  a.input.mx = a.input.mz = 0;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === modeName));
  $('lots').classList.toggle('hidden', modeName !== 'live');
  $('lots').textContent = a.count > 3 ? '8 monsters' : '3 monsters';
  padCache.length = 0;
  a.camSnap = true; // the camera jumps to its place: a finger never lands on a gliding view
}

// Runs the game's fixed steps (the frame loop calls it; tests call it to play fast).
function step(sec) {
  let n = Math.round(sec / STEP);
  while (n-- > 0) {
    if (!a.over) { a.mode.step(STEP); a.clock += STEP; }
  }
}
function info() {
  return { mode: a.modeName, over: a.over, won: a.won, clock: a.clock, turn: a.mode.turn, phase: a.mode.phase, step2: a.mode.step2,
    you: { x: a.you.x, z: a.you.z, hp: a.you.hp, maxHp: a.you.maxHp, species: a.you.c.species, moves: a.mode.moves.map(s => s && s.kind) },
    foes: a.foes.map(f => ({ x: f.x, z: f.z, hp: f.hp, alive: f.alive, tell: f.tell ? f.tell.t : null, sleep: f.sleepTurns || f.sleepT || 0 })),
    stats: a.stats, fps: perf.fps, calls: perf.calls };
}

// ---------------------------------------------------------------- the five fixed buttons (Dodge + four moves)

const pad = $('pad');
const padCache = [];
const slots = [0, 1, 2, 3, 4].map(i => {
  const b = document.createElement('button');
  b.className = `slot s${i}`;
  b.innerHTML = '<span class="cd"></span><span class="nm"></span><span class="sub"></span><kbd></kbd>';
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); a.mode.press(i); });
  const up = e => { e.preventDefault(); a.mode.release(i); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
  pad.append(b);
  return b;
});
function drawPad() {
  const spec = a.mode.pad();
  spec.forEach((p, i) => {
    const key = JSON.stringify(p && { ...p, move: p.move?.id, cd: p.cd ? Math.round(p.cd * 30) : 0, charge: p.charge ? Math.round(p.charge * 20) : 0 });
    if (padCache[i] === key) return;
    padCache[i] = key;
    const b = slots[i];
    b.classList.toggle('none', !p);
    if (!p) { b.querySelector('.nm').textContent = ''; b.querySelector('.sub').textContent = ''; return; }
    b.classList.toggle('dim', !!p.dim);
    b.classList.toggle('on', !!p.on);
    const col = p.move ? typeCss(p.move.type) : '#e8eef7';
    b.style.setProperty('--col', col);
    const nm = p.move ? p.move.name : p.label;
    b.querySelector('.nm').textContent = nm;
    b.querySelector('.nm').style.fontSize = nm.length > 11 ? '13px' : nm.length > 9 ? '14px' : '';
    b.querySelector('.sub').textContent = p.move ? (p.turns ? `in ${p.turns}` : KIND_WORD[p.move.kind]) : '';
    b.querySelector('kbd').textContent = p.key || '';
    const k = p.charge || p.cd || 0;
    b.querySelector('.cd').style.background = p.charge
      ? `conic-gradient(rgba(255,255,255,.75) ${k * 360}deg, transparent 0)`
      : k ? `conic-gradient(rgba(0,0,0,.55) ${k * 360}deg, transparent 0)` : 'none';
  });
}

// ---------------------------------------------------------------- input: keys, the stick, taps and drags

const keys = new Set();
const KEYS = { ' ': 0, '1': 1, '2': 2, '3': 3, '4': 4 };
addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k in KEYS) { e.preventDefault(); if (!e.repeat) a.mode.press(KEYS[k]); return; }
  keys.add(k);
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k in KEYS) { a.mode.release(KEYS[k]); return; }
  keys.delete(k);
});
function keyInput() {
  const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const z = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  return { x, z };
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
function ground(e) {
  ray.setFromCamera({ x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, camera);
  return ray.ray.intersectPlane(plane, hitP) ? { x: hitP.x, z: hitP.z } : null;
}
const stick = { id: null, x: 0, y: 0, mx: 0, mz: 0 };
let drawId = null;
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (a.modeName === 'live' && e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.45 && stick.id == null) {
    stick.id = e.pointerId; stick.x = e.clientX; stick.y = e.clientY; stick.mx = stick.mz = 0;
    const s = $('stick'); s.classList.remove('hidden'); s.style.left = `${e.clientX}px`; s.style.top = `${e.clientY}px`;
    $('knob').style.transform = 'translate(-50%, -50%)';
    return;
  }
  if (drawId != null) return;
  drawId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  a.mode.pointer('down', ground(e));
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId === stick.id) {
    let dx = e.clientX - stick.x, dy = e.clientY - stick.y; const d = Math.hypot(dx, dy), max = 56;
    if (d > max) { dx *= max / d; dy *= max / d; }
    stick.mx = dx / max; stick.mz = dy / max;
    $('knob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  } else if (e.pointerId === drawId) a.mode.pointer('move', ground(e));
});
const pointerUp = e => {
  if (e.pointerId === stick.id) { stick.id = null; stick.mx = stick.mz = 0; $('stick').classList.add('hidden'); }
  else if (e.pointerId === drawId) { drawId = null; a.mode.pointer('up', ground(e)); }
};
canvas.addEventListener('pointerup', pointerUp);
canvas.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---------------------------------------------------------------- top bar

$('tabs').addEventListener('click', e => { const m = e.target.closest('button')?.dataset.mode; if (m) restart(m); });
$('again').addEventListener('click', () => restart());
$('end-again').addEventListener('click', () => restart());
$('lots').addEventListener('click', () => restart('live', { count: a.count > 3 ? 3 : 8 }));
const pick = $('pick');
team.forEach((c, i) => {
  const o = document.createElement('option');
  o.value = i; o.textContent = `${SPECIES[c.species].name} Lv ${c.level} (${typeName(SPECIES[c.species].type)})`;
  pick.append(o);
});
if (!team[0].own) $('own').textContent = 'No save found in this browser: a ready-made team.';
pick.addEventListener('change', () => { pick.blur(); restart(a.modeName, { team: +pick.value }); });

// ---------------------------------------------------------------- frame loop

const perf = { fps: 60, calls: 0, frames: 0, t: 0 };
let last = performance.now(), acc = 0;
const camPos = new THREE.Vector3(), camAt = new THREE.Vector3();
function resize() {
  $('hint').style.top = `${$('top').getBoundingClientRect().bottom + 4}px`; // under the top bar, however it wraps
  $('timer').style.top = `${$('top').getBoundingClientRect().bottom + 40}px`;
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
function placeCamera(dt) {
  const tall = Math.max(1, 1.2 / camera.aspect);
  if (a.mode.cam === 'follow') {
    camPos.set(a.you.x, 13.5 * tall, a.you.z + 7 * tall); // steep: a big monster never hides you
    camAt.set(a.you.x, 0, a.you.z - 0.3);
  } else {
    camPos.set(0, 19.5 * tall, 13.5 * tall);
    camAt.set(0, 0, 0.8);
  }
  const k = 1 - Math.exp(-dt * 6);
  camera.position.lerp(camPos, a.camSnap ? 1 : k);
  a.camAt = (a.camAt || camAt.clone()).lerp(camAt, a.camSnap ? 1 : k);
  a.camSnap = false;
  camera.lookAt(a.camAt);
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const kx = keyInput();
  a.input.mx = stick.id != null ? stick.mx : kx.x;
  a.input.mz = stick.id != null ? stick.mz : kx.z;
  if (!a.hold) { acc += dt; let n = 0; while (acc >= STEP && n++ < 14) { if (!a.over) { a.mode.step(STEP); a.clock += STEP; } acc -= STEP; } if (acc > STEP) acc = 0; }
  fx.update(dt);
  placeCamera(dt);
  for (const f of [a.you, ...a.foes]) f.draw(dt, camera, innerWidth, innerHeight);
  drawPad();
  renderer.render(scene, camera);
  perf.frames++; perf.t += dt;
  if (perf.t >= 0.5) {
    perf.fps = Math.round(perf.frames / perf.t); perf.frames = 0; perf.t = 0;
    perf.calls = renderer.info.render.calls;
    $('fps').textContent = `${perf.fps} fps · ${perf.calls} draws`;
  }
  requestAnimationFrame(frame);
}
restart(a.modeName, { count: +params.get('n') || 3 });
a.camSnap = true;
requestAnimationFrame(frame);
void R;
