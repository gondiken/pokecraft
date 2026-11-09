// Chapter 3 test arena: the page glue (renderer, camera, controls, the five fixed buttons, the HUD) for the three
// battle prototypes. Nothing is saved; your team is only read from this browser's save.
//   ⚡ Live: real time, in three places (Meadow, Dark Cave, Ice Lake), with up to three of your creatures to swap between.
//   🎯 Aim and ⏱️ Timing: turn-based (turns.js).
import * as THREE from 'three';
import { SPECIES } from '../species.js';
import { sound } from '../sound.js';
import { R, STEP, FOES, START_SPOTS, PLACES, SEE, Fighter, Fx, buildArena, damage, loadTeam, typeHex, typeCss, typeName, floatText, KIND_WORD, len2, maxHpOf } from './core.js';
import { LiveMode } from './live.js';
import { AimMode, TimingMode } from './turns.js';

const MODES = { live: LiveMode, aim: AimMode, timing: TimingMode };
// foeHp: monsters' HP x (live battles need longer fights than one shot a second allows, and you have three creatures there)
const TUNE = { live: { foePower: 50, youMult: 1, foeHp: 6 }, aim: { foePower: 24, youMult: 1.25, foeHp: 1.2 }, timing: { foePower: 28, youMult: 1.5, foeHp: 1.4 } };
const TEAM_MAX = 3; // creatures you can swap between in Live
const $ = id => document.getElementById(id);

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
const arena = buildArena(scene);
const fx = new Fx(scene);
const lantern = new THREE.PointLight(0xffd9a0, 0, 10, 1.4); // your own light in the Dark Cave
scene.add(lantern);

const team = loadTeam();
const params = new URLSearchParams(location.search);
const oldBurst = fx.burst.bind(fx);
fx.burst = (type, x, z, r, ...rest) => { oldBurst(type, x, z, r, ...rest); a.flashes.push({ x, z, r: r + 2, t: 0.7 }); }; // a blast lights the cave for a moment

// ---------------------------------------------------------------- the arena object the modes talk to

const a = {
  scene, camera, fx, you: null, foes: [], over: false, input: { mx: 0, mz: 0 }, flashes: [],
  foePower: 40, youMult: 1, clock: 0, teamIndex: 0, count: 3,
  modeName: params.get('mode') in MODES ? params.get('mode') : 'live',
  placeName: params.get('place') in PLACES ? params.get('place') : 'meadow',
  get place() { return a.modeName === 'live' ? PLACES[a.placeName] : PLACES.meadow; },
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
  bullseye(x, z) { floatText(camera, x, 2.6, z, 'Bullseye!', 'super'); sound.play('badge'); a.stats.bulls++; },
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
      if (dst === a.you) {
        a.squad[a.lead].hp = 0;
        const next = a.squad.findIndex(m => m.hp > 0);
        if (next >= 0) a.pendingSwap = next; // the next creature jumps in
        else a.finish(false);
      } else if (a.foes.every(f => !f.alive)) a.finish(true);
    }
    return amount;
  },
  heal(f, frac) {
    const n = Math.min(f.maxHp - f.hp, Math.round(f.maxHp * frac));
    f.hp += n;
    floatText(camera, f.x, f.h + 0.3, f.z, n ? `+${n}` : 'Full!', 'heal');
  },
  hurtSelf(frac) { const n = Math.max(1, Math.round(a.you.maxHp * frac)); a.you.hp = Math.max(1, a.you.hp - n); floatText(camera, a.you.x, a.you.h + 0.3, a.you.z, `-${n}`, 'ouch'); },
  // Live: swap the creature in play for another of your squad (it keeps its own HP)
  swap(i, auto = false) {
    const m = a.squad[i];
    if (!m || i === a.lead || m.hp <= 0 || a.over || (!auto && a.swapCool > 0)) return false;
    const old = a.you;
    if (old.alive) a.squad[a.lead].hp = old.hp;
    const f = new Fighter(scene, m.c, 'you', old.x, old.z);
    f.hp = m.hp; f.heading = old.heading; f.safeT = 0.6;
    old.dispose(scene);
    a.you = f; a.lead = i; a.swapCool = 0.8;
    a.mode.onSwap?.();
    a.say(`Go, ${SPECIES[m.c.species].name}!`);
    sound.play('dodge');
    drawSquad();
    return true;
  },
  finish(won) {
    if (a.over) return;
    a.over = true; a.won = won;
    a.timer(null);
    const turns = a.mode.turn, secs = Math.round(a.clock);
    $('end-title').textContent = won ? 'You won!' : 'Oops! Your team is tired.';
    $('end-text').textContent = won
      ? (turns ? `All three beaten in ${turns} turns.` : `All monsters beaten in ${secs} seconds.`) + (a.stats.bulls ? ` Bullseyes: ${a.stats.bulls}.` : '')
      : 'Try again!';
    setTimeout(() => $('end').classList.remove('hidden'), 700);
    sound.play(won ? 'badge' : 'miss');
  },
};
window.arena = { a, team, step, press: s => a.mode.press(s), release: s => a.mode.release(s), restart, info, swap: i => a.swap(i) };

function restart(modeName = a.modeName, opts = {}) {
  a.mode?.dispose?.();
  for (const f of [a.you, ...a.foes]) f?.dispose(scene);
  fx.clear();
  a.modeName = modeName;
  if (opts.count) a.count = opts.count;
  if (opts.team != null) a.teamIndex = opts.team;
  if (opts.place) a.placeName = opts.place;
  Object.assign(a, TUNE[modeName]);
  a.over = false; a.won = null; a.clock = 0; a.stats = { dealt: 0, taken: 0, bulls: 0 }; a.flashes = []; a.pendingSwap = null; a.swapCool = 0;
  const first = team[a.teamIndex] || team[0];
  // the squad: your picked creature first, then the next ones of your team (Live only; the turn modes play one)
  const order = [first, ...team.filter(c => c !== first)].slice(0, modeName === 'live' ? TEAM_MAX : 1);
  a.squad = order.map(c => ({ c, hp: null }));
  a.lead = 0;
  a.you = new Fighter(scene, first, 'you', 0, -1);
  a.squad.forEach(m => { m.hp = maxHpOf(m.c); });
  const lvl = first.level;
  const n = modeName === 'live' ? a.count : 3;
  a.foes = FOES.slice(0, n).map((d, i) => {
    const f = new Fighter(scene, { species: d.species, level: lvl, moves: [], pattern: d.pattern }, 'foe', START_SPOTS[i][0], START_SPOTS[i][1]);
    f.heading = Math.atan2(-f.x, -1 - f.z);
    f.maxHp = f.hp = Math.round(f.maxHp * a.foeHp);
    return f;
  });
  a.you.heading = Math.PI;
  arena.paint(modeName === 'live' ? a.placeName : 'meadow');
  a.mode = new MODES[modeName](a);
  a.mode.start();
  $('hint').textContent = a.place.hint || a.mode.hint;
  $('end').classList.add('hidden');
  $('stick').classList.add('hidden');
  a.input.mx = a.input.mz = 0;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === modeName));
  for (const id of ['lots', 'place']) $(id).classList.toggle('hidden', modeName !== 'live');
  $('lots').textContent = a.count > 3 ? '8 monsters' : '3 monsters';
  $('place').textContent = `${a.place.icon} ${a.place.name}`;
  padCache.length = 0;
  drawSquad();
  a.camSnap = true; // the camera jumps to its place: a finger never lands on a gliding view
  if (a.place.hint) setTimeout(() => { if (a.mode && $('hint').textContent === a.place.hint) $('hint').textContent = a.mode.hint; }, 6000);
}

// Runs the game's fixed steps (the frame loop calls it; tests call it to play fast).
function step(sec) {
  let n = Math.round(sec / STEP);
  while (n-- > 0) oneStep();
}
function oneStep() {
  if (a.over) return;
  if (a.pendingSwap != null) { const i = a.pendingSwap; a.pendingSwap = null; a.swap(i, true); }
  a.swapCool = Math.max(0, a.swapCool - STEP);
  for (const f of a.flashes) f.t -= STEP;
  a.flashes = a.flashes.filter(f => f.t > 0);
  a.mode.step(STEP); a.clock += STEP;
}
function info() {
  return { mode: a.modeName, place: a.placeName, over: a.over, won: a.won, clock: a.clock, turn: a.mode.turn, phase: a.mode.phase,
    you: { x: a.you.x, z: a.you.z, hp: a.you.hp, maxHp: a.you.maxHp, species: a.you.c.species, moves: a.mode.moves.map(s => s && s.kind) },
    squad: a.squad.map(m => ({ species: m.c.species, hp: m === a.squad[a.lead] ? a.you.hp : m.hp })), lead: a.lead,
    foes: a.foes.map(f => ({ x: f.x, z: f.z, hp: f.hp, alive: f.alive, seen: f.seen !== false, tell: f.tell ? f.tell.t : null, sleep: f.sleepTurns || f.sleepT || 0 })),
    stats: a.stats, fps: perf.fps, calls: perf.calls };
}

// ---------------------------------------------------------------- your squad (Live): tap one to swap, or Q

function drawSquad() {
  const el = $('squad');
  el.classList.toggle('hidden', a.squad.length < 2);
  el.innerHTML = '';
  a.squad.forEach((m, i) => {
    const b = document.createElement('button');
    const hp = i === a.lead ? a.you.hp : m.hp, max = maxHpOf(m.c);
    b.className = `mate${i === a.lead ? ' lead' : ''}${hp <= 0 ? ' out' : ''}`;
    b.style.setProperty('--col', typeCss(SPECIES[m.c.species].type));
    b.innerHTML = `<b>${SPECIES[m.c.species].name}</b><i style="width:${Math.max(0, hp / max) * 100}%"></i>`;
    b.addEventListener('pointerdown', e => { e.preventDefault(); a.swap(i); });
    el.append(b);
  });
}
let squadKey = '';
function updateSquad() {
  const k = `${a.lead}:${a.squad.map((m, i) => (i === a.lead ? a.you.hp : m.hp)).join(',')}`;
  if (k !== squadKey) { squadKey = k; drawSquad(); }
}

// ---------------------------------------------------------------- the Dark Cave: only what is near you (or in a blast's flash)

const eyeGeo = new THREE.BoxGeometry(0.13, 0.13, 0.05), eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff27a });
function seeRange() { return SEE.bright.includes(a.you.type) ? SEE.far : SEE.near; }
function darkness() {
  const dark = !!a.place.dark;
  lantern.intensity = dark ? 30 : 0;
  lantern.distance = dark ? seeRange() + 2.5 : 10;
  lantern.position.set(a.you.x, 2.4, a.you.z);
  const range = seeRange();
  for (const f of a.foes) {
    const lit = !dark || len2(f.x - a.you.x, f.z - a.you.z) < range + 0.6 || a.flashes.some(l => len2(f.x - l.x, f.z - l.z) < l.r);
    f.seen = lit;
    if (!lit && f.alive) { f.model.visible = false; f.shadow.visible = false; f.bar.style.display = 'none'; }
    if (!f.eyes) { // two glowing eyes: all you see of a monster in the dark
      f.eyes = new THREE.Group();
      for (const s of [-1, 1]) { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(s * 0.17, 0, 0); f.eyes.add(e); }
      scene.add(f.eyes);
      const old = f.dispose.bind(f);
      f.dispose = sc => { sc.remove(f.eyes); old(sc); };
    }
    f.eyes.visible = dark && !lit && f.alive && Math.sin(a.clock * 2.3 + f.x) > -0.85; // they blink now and then
    f.eyes.position.set(f.x + Math.sin(f.heading) * 0.5, f.h * 0.7, f.z + Math.cos(f.heading) * 0.5);
    f.eyes.rotation.y = f.heading;
  }
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
  if (k === 'q' && !e.repeat) { for (let s = 1; s < a.squad.length; s++) if (a.swap((a.lead + s) % a.squad.length)) break; return; }
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
$('place').addEventListener('click', () => { const ids = Object.keys(PLACES); restart('live', { place: ids[(ids.indexOf(a.placeName) + 1) % ids.length] }); });
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
  const top = $('top').getBoundingClientRect().bottom;
  $('hint').style.top = `${top + 4}px`; // under the top bar, however it wraps
  $('timer').style.top = `${top + 40}px`;
  $('squad').style.top = `${top + 40}px`;
  $('toast').style.top = `${top + 96}px`;
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
  if (!a.hold) { acc += dt; let n = 0; while (acc >= STEP && n++ < 14) { oneStep(); acc -= STEP; } if (acc > STEP) acc = 0; }
  fx.update(dt);
  placeCamera(dt);
  for (const f of [a.you, ...a.foes]) f.draw(dt, camera, innerWidth, innerHeight);
  darkness();
  a.mode.frame?.(dt);
  drawPad();
  updateSquad();
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
requestAnimationFrame(frame);
void R;
