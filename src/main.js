import * as THREE from 'three';
import { B, HOTBAR, drawAtlas } from './blocks.js';
import { World, WORLD_W, WORLD_D, raycastVoxel } from './world.js';
import { Player } from './player.js';
import { CreatureManager } from './creatures.js';
import { SPECIES, STARTERS, TYPE_COLORS, makeCreature, statsFor, animateModel } from './species.js';
import { Battle } from './battle.js';
import { UI, portrait } from './ui.js';
import { el } from './util.js';

const SAVE_KEY = 'pokecraft-save-v1';
const DAY_LENGTH = 480; // seconds for a full day/night cycle
const REACH = 6;

/* ------------------------------- renderer ------------------------------- */

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const DAY_SKY = new THREE.Color(0x8fd3ff);
const NIGHT_SKY = new THREE.Color(0x0b1030);
scene.background = DAY_SKY.clone();
scene.fog = new THREE.Fog(DAY_SKY.clone(), 40, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);
camera.rotation.order = 'YXZ';

const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 1.3);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(40, 80, 20);
scene.add(hemi, sun);

const atlas = drawAtlas();
const texture = new THREE.CanvasTexture(atlas);
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;
texture.generateMipmaps = false;
texture.colorSpace = THREE.SRGBColorSpace;

const materials = {
  solid: new THREE.MeshBasicMaterial({ map: texture, vertexColors: true }),
  water: new THREE.MeshBasicMaterial({
    map: texture, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide,
  }),
};

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
highlight.visible = false;
scene.add(highlight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------- game state ------------------------------ */

const game = {
  scene, camera,
  world: null, player: null, creatures: null,
  party: [], box: [], cubes: 10, selected: 0,
  time: 0.05, started: false, inBattle: false,
  spawnPoint: new THREE.Vector3(),
};

game.creatures = new CreatureManager(scene, null);
game.ui = new UI(game, atlas);
game.battle = new Battle(game);

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}

function save() {
  if (!game.started) return;
  try {
    const p = game.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      seed: game.world.seed, edits: [...game.world.edits], party: game.party, box: game.box, cubes: game.cubes,
      pos: [p.pos.x, p.pos.y, p.pos.z], yaw: p.yaw, pitch: p.pitch, time: game.time,
    }));
  } catch { /* storage unavailable: progress just won't persist */ }
}

function createWorld(seed, edits) {
  if (game.world) game.world.dispose();
  const world = new World(seed, scene, materials);
  world.generate();
  if (edits) world.applyEdits(edits);
  world.buildAll();
  game.world = world;
  game.player = new Player(world);
  game.creatures.setWorld(world);
  game.spawnPoint.copy(findSpawn(world));
}

function findSpawn(world) {
  const cx = WORLD_W >> 1, cz = WORLD_D >> 1;
  for (let r = 0; r < 60; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const s = world.surface(cx + dx, cz + dz);
        if (s.id === B.GRASS) return new THREE.Vector3(cx + dx + 0.5, s.y + 1, cz + dz + 0.5);
      }
    }
  }
  return new THREE.Vector3(cx + 0.5, world.surface(cx, cz).y + 1, cz + 0.5);
}

/* ------------------------------ title screen ----------------------------- */

const titleEl = document.getElementById('title');
const pauseEl = document.getElementById('pause');
const hudEl = document.getElementById('hud');

function showTitle() {
  const saved = loadSave();
  createWorld(saved?.seed ?? (Math.random() * 1e9) | 0, saved?.edits);
  const buttons = document.getElementById('title-buttons');
  const newGame = () => {
    if (saved && !confirm('Start a new world? Your current save will be overwritten.')) return;
    if (saved) createWorld((Math.random() * 1e9) | 0);
    buttons.classList.add('hidden');
    showStarters();
  };
  buttons.replaceChildren(...[
    saved && el('button', { class: 'primary', onclick: () => continueGame(saved) }, 'Continue'),
    el('button', { class: saved ? '' : 'primary', onclick: newGame }, 'New Game'),
  ].filter(Boolean));
}

function showStarters() {
  document.getElementById('starter-pick').classList.remove('hidden');
  document.getElementById('starters').replaceChildren(...STARTERS.map(id => {
    const sp = SPECIES[id];
    return el('div', { class: 'starter', onclick: () => startNew(id) },
      el('img', { src: portrait(id), width: 140, height: 120, alt: sp.name }),
      el('div', { class: 'name' }, sp.name),
      el('span', { class: 'type', style: `background:${TYPE_COLORS[sp.type]}` }, sp.type),
      el('div', { class: 'desc' }, sp.desc));
  }));
}

function startNew(starterId) {
  game.party = [makeCreature(starterId, 6)];
  game.box = [];
  game.cubes = 10;
  game.time = 0.05;
  const p = game.player;
  p.pos.copy(game.spawnPoint);
  p.yaw = 0; p.pitch = 0;
  begin();
  game.ui.toast(`${SPECIES[starterId].name} joined your team!`);
  game.ui.toast('Find wild creatures and click them to battle.');
}

function continueGame(saved) {
  game.party = saved.party || [];
  game.box = saved.box || [];
  game.cubes = saved.cubes ?? 10;
  game.time = saved.time ?? 0.05;
  const p = game.player;
  if (saved.pos) p.pos.set(...saved.pos); else p.pos.copy(game.spawnPoint);
  p.yaw = saved.yaw || 0; p.pitch = saved.pitch || 0;
  begin();
}

function begin() {
  game.started = true;
  titleEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  game.ui.renderHud();
  lockPointer();
  save();
}

/* --------------------------------- input --------------------------------- */

let locked = false;

function lockPointer() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => pauseEl.classList.remove('hidden'));
  } catch { pauseEl.classList.remove('hidden'); }
}

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) pauseEl.classList.add('hidden');
  else {
    game.player.keys = {};
    if (game.started && !game.inBattle && !game.ui.panelOpen) pauseEl.classList.remove('hidden');
  }
});

pauseEl.addEventListener('click', lockPointer);
canvas.addEventListener('click', () => {
  if (game.started && !locked && !game.inBattle && !game.ui.panelOpen) lockPointer();
});

document.addEventListener('mousemove', e => {
  if (locked && !game.inBattle) game.player.look(e.movementX, e.movementY);
});

document.addEventListener('keydown', e => {
  if (!game.started) return;
  if (e.code === 'KeyP' || e.code === 'Tab' || (e.code === 'Escape' && game.ui.panelOpen)) {
    e.preventDefault();
    if (game.inBattle) return;
    if (game.ui.panelOpen) {
      game.ui.closePanel();
      pauseEl.classList.remove('hidden');
    } else {
      game.ui.openPanel();
      if (locked) document.exitPointerLock();
      pauseEl.classList.add('hidden');
    }
    return;
  }
  if (!locked || game.inBattle) return;
  if (e.code === 'Space') e.preventDefault();
  game.player.keys[e.code] = true;
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5)) - 1;
    if (n >= 0 && n < HOTBAR.length) { game.selected = n; game.ui.renderHud(); }
  }
  if (e.code === 'KeyE' && target.wild) startBattle(target.wild);
});

document.addEventListener('keyup', e => { if (game.player) game.player.keys[e.code] = false; });

document.addEventListener('wheel', e => {
  if (!locked || game.inBattle) return;
  game.selected = (game.selected + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length;
  game.ui.renderHud();
}, { passive: true });

document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('mousedown', e => {
  if (!locked || game.inBattle) return;
  const world = game.world;
  if (e.button === 0) {
    if (target.wild) { startBattle(target.wild); return; }
    const hit = target.block;
    if (!hit || hit.y === 0) return;
    world.set(hit.x, hit.y, hit.z, B.AIR);
    // Water flows into the hole if it borders water.
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
      if (world.get(hit.x + dx, hit.y + dy, hit.z + dz) === B.WATER) { world.set(hit.x, hit.y, hit.z, B.WATER); break; }
    }
    if (hit.id === B.LEAVES && Math.random() < 0.1) {
      game.cubes++;
      game.ui.renderHud();
      game.ui.toast('You found a Capture Cube in the leaves!');
    }
  } else if (e.button === 2) {
    const hit = target.block;
    if (!hit) return;
    const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
    const cur = world.get(x, y, z);
    if (!world.inBounds(x, y, z) || (cur !== B.AIR && cur !== B.WATER)) return;
    if (game.player.overlapsBlock(x, y, z)) return;
    world.set(x, y, z, HOTBAR[game.selected]);
  }
});

/* -------------------------------- battles -------------------------------- */

function startBattle(wild) {
  if (game.inBattle) return;
  if (!game.party.some(c => c.hp > 0)) {
    game.ui.toast('Your team is too tired to battle. Let them rest a moment.');
    return;
  }
  game.inBattle = true;
  document.body.classList.add('in-battle');
  game.player.keys = {};
  highlight.visible = false;
  game.ui.setPrompt('');
  if (locked) document.exitPointerLock();
  game.battle.start(wild);
}

game.onBattleEnd = result => {
  game.inBattle = false;
  document.body.classList.remove('in-battle');
  if (result === 'lost') {
    for (const c of game.party) c.hp = statsFor(c).maxHp;
    game.player.pos.copy(game.spawnPoint);
    game.player.vel.set(0, 0, 0);
  }
  game.ui.renderHud();
  save();
  pauseEl.classList.remove('hidden');
};

/* ------------------------------- main loop ------------------------------- */

const target = { wild: null, block: null };
let regenTimer = 0;
let saveTimer = 0;
let hudTimer = 0;
let last = performance.now();

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function updateSky(dt) {
  game.time = (game.time + dt / DAY_LENGTH) % 1;
  const elevation = Math.sin(game.time * Math.PI * 2);
  const light = smoothstep(-0.2, 0.25, elevation);
  const brightness = 0.25 + 0.75 * light;
  scene.background.copy(NIGHT_SKY).lerp(DAY_SKY, light);
  scene.fog.color.copy(scene.background);
  materials.solid.color.setScalar(brightness);
  materials.water.color.setScalar(brightness);
  hemi.intensity = 0.35 + 1.0 * light;
  sun.intensity = 0.1 + 1.1 * light;
  const hours = (game.time * 24 + 6) % 24;
  const hh = String(Math.floor(hours)).padStart(2, '0');
  const mm = String(Math.floor((hours % 1) * 60 / 10) * 10).padStart(2, '0');
  game.ui.setClock(`${light > 0.5 ? '☀' : '☾'} ${hh}:${mm}`);
}

function updateTarget() {
  const origin = game.player.eyePos;
  const dir = game.player.forward;
  const hitWild = game.creatures.pick(origin, dir, REACH + 1);
  const hitBlock = raycastVoxel(game.world, origin, dir, REACH);
  target.wild = hitWild && (!hitBlock || hitWild.dist < hitBlock.t) ? hitWild.wild : null;
  target.block = target.wild ? null : hitBlock;
  if (target.block) {
    highlight.visible = true;
    highlight.position.set(target.block.x + 0.5, target.block.y + 0.5, target.block.z + 0.5);
  } else highlight.visible = false;
  game.ui.setPrompt(target.wild
    ? `${target.wild.species.name} Lv${target.wild.data.level} · click or E to battle`
    : '');
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const p = game.player;

  if (!game.started) {
    // Slow fly-over for the title screen.
    const t = now / 1000 * 0.05;
    camera.position.set(WORLD_W / 2 + Math.cos(t) * 45, 40, WORLD_D / 2 + Math.sin(t) * 45);
    camera.lookAt(WORLD_W / 2, 14, WORLD_D / 2);
    game.creatures.update(dt, new THREE.Vector3(WORLD_W / 2, 0, WORLD_D / 2), game.spawnPoint);
  } else {
    if (locked && !game.inBattle) p.update(dt);
    if (p.pos.y < -20) { p.pos.copy(game.spawnPoint); p.vel.set(0, 0, 0); }
    game.world.updateDirty();
    game.creatures.update(dt, p.pos, game.spawnPoint);
    if (game.battle.allyModel) animateModel(game.battle.allyModel, now / 1000, false);

    camera.position.copy(p.eyePos);
    camera.rotation.set(p.pitch, p.yaw, 0);
    if (!game.inBattle) updateTarget();
    updateSky(dt);

    regenTimer += dt;
    if (regenTimer > 2 && !game.inBattle) {
      regenTimer = 0;
      for (const c of game.party) {
        const max = statsFor(c).maxHp;
        c.hp = Math.min(max, c.hp + Math.max(1, Math.floor(max * 0.03)));
      }
    }
    hudTimer += dt;
    if (hudTimer > 1) { hudTimer = 0; game.ui.renderHud(); }
    saveTimer += dt;
    if (saveTimer > 15) { saveTimer = 0; save(); }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

showTitle();
requestAnimationFrame(frame);

// Exposed for debugging from the browser console.
window.pokecraft = game;
