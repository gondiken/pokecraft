import * as THREE from 'three';
import { B, HOTBAR, drawAtlas } from './blocks.js';
import { World, WORLD_W, WORLD_D, raycastVoxel } from './world.js';
import { Player } from './player.js';
import { CreatureManager } from './creatures.js';
import { SPECIES, STARTERS, TYPE_COLORS, makeCreature, statsFor, animateModel } from './species.js';
import { Battle } from './battle.js';
import { NpcManager } from './npc.js';
import { GYMS } from './gyms.js';
import { TouchControls } from './touch.js';
import { UI, portrait } from './ui.js';
import { el } from './util.js';

const SAVE_KEY = 'pokecraft-save-v2';
const OLD_SAVE_KEY = 'pokecraft-save-v1';
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
  party: [], box: [], cubes: 10, selected: 0, badges: [], beaten: [],
  time: 0.05, started: false, inBattle: false,
  spawnPoint: new THREE.Vector3(),
};

game.creatures = new CreatureManager(scene, null);
game.npcs = new NpcManager(scene);
game.creatures.onSpawn = wild => {
  if (game.started && wild.species.type === 'rainbow') game.ui.toast('Something shimmering is nearby... a rainbow creature!');
};
game.ui = new UI(game, atlas);
game.battle = new Battle(game);

function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved) return saved;
    // Saves from before gyms: the map got bigger, so keep the team but start in a fresh world.
    const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY));
    if (old) return { party: old.party, box: old.box, cubes: old.cubes, time: old.time };
  } catch { /* unreadable save: start fresh */ }
  return null;
}

function save() {
  if (!game.started) return;
  try {
    const p = game.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      seed: game.world.seed, edits: [...game.world.edits], party: game.party, box: game.box, cubes: game.cubes,
      badges: game.badges, beaten: game.beaten,
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
  game.npcs.populate(world, game.spawnPoint);
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
  game.badges = [];
  game.beaten = [];
  const p = game.player;
  p.pos.copy(game.spawnPoint);
  p.yaw = 0; p.pitch = 0;
  begin();
  game.ui.toast(`${SPECIES[starterId].name} joined your team!`);
  game.ui.toast('Find wild creatures and click them to battle.');
  game.ui.toast('Healer Hana is right next to you if your team gets tired.');
}

function continueGame(saved) {
  game.party = saved.party || [];
  game.box = saved.box || [];
  game.cubes = saved.cubes ?? 10;
  game.time = saved.time ?? 0.05;
  game.badges = saved.badges || [];
  game.beaten = saved.beaten || [];
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
  if (touchMode) {
    document.getElementById('touch').classList.remove('hidden');
    goFullscreen();
  }
  resume();
  save();
}

/* --------------------------------- input --------------------------------- */

let locked = false;
// Touch mode: on-screen controls instead of pointer lock. Turns on for touch screens,
// or the first time someone touches the screen.
let touchMode = false;

function setTouchMode(on) {
  if (touchMode === on) return;
  touchMode = on;
  document.body.classList.toggle('touch', on);
  document.getElementById('touch').classList.toggle('hidden', !on || !game.started);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, on ? 1.5 : 2));
}

function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement || document.webkitFullscreenElement) return;
  try {
    const r = req.call(el);
    if (r && r.catch) r.catch(() => {});
  } catch { /* not allowed here; the game works without it */ }
}

// True while the player is walking around (not paused, in a menu or in a battle).
function playing() {
  if (!game.started || game.inBattle || game.ui.panelOpen) return false;
  return touchMode ? pauseEl.classList.contains('hidden') : locked;
}

function resume() {
  if (touchMode) { pauseEl.classList.add('hidden'); return; }
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => pauseEl.classList.remove('hidden'));
  } catch { pauseEl.classList.remove('hidden'); }
}

// After a menu or battle: touch players carry on straight away, mouse players click to re-lock.
function afterOverlay() {
  if (touchMode) pauseEl.classList.add('hidden');
  else pauseEl.classList.remove('hidden');
}

function pause() {
  if (locked) document.exitPointerLock();
  game.player.keys = {};
  game.touch.reset();
  pauseEl.classList.remove('hidden');
}

function toggleTeam() {
  if (game.inBattle) return;
  if (game.ui.panelOpen) {
    game.ui.closePanel();
    afterOverlay();
  } else {
    game.player.keys = {};
    game.touch.reset();
    game.ui.openPanel();
    if (locked) document.exitPointerLock();
    pauseEl.classList.add('hidden');
  }
}

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) pauseEl.classList.add('hidden');
  else {
    game.player.keys = {};
    if (game.started && !game.inBattle && !game.ui.panelOpen) pauseEl.classList.remove('hidden');
  }
});

window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setTouchMode(true); }, true);
if (window.matchMedia('(pointer: coarse)').matches) setTouchMode(true);

pauseEl.addEventListener('click', resume);
document.getElementById('party-close').addEventListener('click', toggleTeam);
canvas.addEventListener('click', () => {
  if (!touchMode && game.started && !locked && !game.inBattle && !game.ui.panelOpen) resume();
});

document.addEventListener('mousemove', e => {
  if (locked && !game.inBattle) game.player.look(e.movementX, e.movementY);
});

document.addEventListener('keydown', e => {
  if (!game.started) return;
  if (e.code === 'KeyP' || e.code === 'Tab' || (e.code === 'Escape' && game.ui.panelOpen)) {
    e.preventDefault();
    toggleTeam();
    return;
  }
  if (!playing()) return;
  if (e.code === 'Space') e.preventDefault();
  game.player.keys[e.code] = true;
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5)) - 1;
    if (n >= 0 && n < HOTBAR.length) { game.selected = n; game.ui.renderHud(); }
  }
  if (e.code === 'KeyE') interact();
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
  if (e.button === 0) {
    if (!interact()) breakBlock();
  } else if (e.button === 2) {
    placeBlock();
  }
});

// Battle the targeted creature or talk to the targeted person. Returns false if nothing is targeted.
function interact() {
  if (target.npc) { talkTo(target.npc); return true; }
  if (target.wild) { startBattle({ wild: target.wild }); return true; }
  return false;
}

function breakBlock() {
  const world = game.world;
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
}

function placeBlock() {
  const world = game.world;
  const hit = target.block;
  if (!hit) return;
  const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
  const cur = world.get(x, y, z);
  if (!world.inBounds(x, y, z) || (cur !== B.AIR && cur !== B.WATER)) return;
  if (game.player.overlapsBlock(x, y, z)) return;
  world.set(x, y, z, HOTBAR[game.selected]);
}

// Tapping the screen: battle or talk to whatever creature or person is under the finger.
const tapRay = new THREE.Raycaster();
function tapAt(x, y) {
  if (!playing()) return;
  tapRay.setFromCamera(new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1), camera);
  const { origin, direction } = tapRay.ray;
  const reach = REACH + 4;
  const npc = game.npcs.pick(origin, direction, reach);
  const wild = game.creatures.pick(origin, direction, reach);
  const block = raycastVoxel(game.world, origin, direction, reach);
  const wall = block ? block.t : Infinity;
  if (npc && npc.dist < wall && (!wild || npc.dist < wild.dist)) talkTo(npc.npc);
  else if (wild && wild.dist < wall) startBattle({ wild: wild.wild });
}

game.touch = new TouchControls(game, canvas, {
  canPlay: playing,
  jump: down => { game.player.keys.Space = down && playing(); },
  breakBlock: () => { if (playing()) breakBlock(); },
  place: () => { if (playing()) placeBlock(); },
  interact: () => { if (playing()) interact(); },
  team: toggleTeam,
  pause,
  tapAt,
});

/* -------------------------------- battles -------------------------------- */

function healTeam() {
  for (const c of game.party) c.hp = statsFor(c).maxHp;
  game.ui.renderHud();
}

function talkTo(npc) {
  const ui = game.ui;
  if (npc.kind === 'healer') {
    healTeam();
    ui.toast(`${npc.name}: Your team is fully healed. Good luck out there!`);
    return;
  }
  const gym = npc.gym.def;
  const trainerKey = `${gym.id}:trainer`;
  if (npc.kind === 'trainer') {
    if (game.beaten.includes(trainerKey)) {
      ui.toast(`${npc.name}: You already beat me! ${gym.leader.name} is waiting at the back.`);
      return;
    }
    startBattle({ trainer: npc, team: gym.trainerTeam, intro: [`You want to see ${gym.leader.name}? Get past me first!`] });
    return;
  }
  if (!game.beaten.includes(trainerKey)) {
    ui.toast(`${npc.name}: Beat ${gym.trainer.name} first, then come back to me!`);
    return;
  }
  const rematch = game.badges.includes(gym.id);
  startBattle({
    trainer: npc, team: gym.leaderTeam,
    intro: rematch ? ['Back for a rematch? I have been training too!'] : gym.intro,
  });
}

function startBattle(opts) {
  if (game.inBattle) return;
  if (!game.party.some(c => c.hp > 0)) {
    game.ui.toast('Your team is too tired to battle. Let them rest a moment.');
    return;
  }
  game.inBattle = true;
  pauseEl.classList.add('hidden');
  document.body.classList.add('in-battle');
  game.player.keys = {};
  game.touch.reset();
  highlight.visible = false;
  game.ui.setPrompt('');
  if (locked) document.exitPointerLock();
  game.battle.start(opts);
}

game.onBattleEnd = (result, opts) => {
  game.inBattle = false;
  document.body.classList.remove('in-battle');
  if (result === 'lost') {
    healTeam();
    game.player.pos.copy(game.spawnPoint);
    game.player.vel.set(0, 0, 0);
  }
  const npc = opts.trainer;
  if (result === 'won' && npc) {
    const gym = npc.gym.def;
    if (npc.kind === 'trainer') {
      game.beaten.push(`${gym.id}:trainer`);
      game.cubes += 2;
      game.ui.toast(`${npc.name}: Nice battle! ${gym.leader.name} is waiting at the back.`);
      game.ui.toast('You got 2 Capture Cubes.');
    } else if (!game.badges.includes(gym.id)) {
      game.badges.push(gym.id);
      game.cubes += 5;
      game.ui.toast(`${npc.name}: ${gym.lose}`);
      game.ui.toast(`You earned the ${gym.badge}! (${game.badges.length}/${GYMS.length}) +5 Capture Cubes`);
      if (game.badges.length === GYMS.length) game.ui.toast('You collected every badge. You are the PokeCraft Champion!');
    } else {
      game.ui.toast(`${npc.name}: You are as strong as ever!`);
    }
  }
  game.ui.renderHud();
  save();
  afterOverlay();
};

/* ------------------------------- main loop ------------------------------- */

const target = { wild: null, npc: null, block: null };
let currentGym = null;
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
  game.night = light < 0.3;
}

// Points the player towards the next gym they haven't beaten yet.
function updateGuide() {
  const p = game.player.pos;
  const next = game.world.gyms.find(g => !game.badges.includes(g.def.id));
  if (!next) { game.ui.setGuide('All badges collected!'); return; }
  const dx = next.x + 0.5 - p.x, dz = next.z + 0.5 - p.z;
  const dist = Math.round(Math.hypot(dx, dz));
  // Angle of the gym relative to where the player is looking.
  let rel = Math.atan2(-dx, -dz) - game.player.yaw;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const arrows = ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'];
  const arrow = arrows[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8];
  game.ui.setGuide(dist < 8 ? `${next.def.name} is here!` : `Next: ${next.def.name} ${arrow} ${dist}m`);

  const inside = game.world.gymAt(p.x, p.z);
  if (inside !== currentGym) {
    currentGym = inside;
    if (inside) game.ui.toast(`Welcome to the ${inside.def.name}! (${inside.def.type} type)`);
  }
}

function updateTarget() {
  const origin = game.player.eyePos;
  const dir = game.player.forward;
  const hitWild = game.creatures.pick(origin, dir, REACH + 1);
  const hitNpc = game.npcs.pick(origin, dir, REACH + 1);
  const hitBlock = raycastVoxel(game.world, origin, dir, REACH);
  const blockDist = hitBlock ? hitBlock.t : Infinity;
  target.npc = hitNpc && hitNpc.dist < blockDist && (!hitWild || hitNpc.dist < hitWild.dist) ? hitNpc.npc : null;
  target.wild = !target.npc && hitWild && hitWild.dist < blockDist ? hitWild.wild : null;
  target.block = target.wild || target.npc ? null : hitBlock;
  if (target.block) {
    highlight.visible = true;
    highlight.position.set(target.block.x + 0.5, target.block.y + 0.5, target.block.z + 0.5);
  } else highlight.visible = false;
  const how = touchMode ? 'tap' : 'click or E';
  game.ui.setPrompt(target.npc ? `${target.npc.title} · ${how} to ${target.npc.kind === 'healer' ? 'heal' : 'challenge'}`
    : target.wild ? `${target.wild.species.name} Lv${target.wild.data.level} · ${how} to battle`
      : '');
  game.touch.setAction(target.npc ? (target.npc.kind === 'healer' ? 'Heal team' : 'Challenge!')
    : target.wild ? `Battle ${target.wild.species.name}!` : '');
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
    p.joy = game.touch.joy;
    if (playing()) p.update(dt);
    if (p.pos.y < -20) { p.pos.copy(game.spawnPoint); p.vel.set(0, 0, 0); }
    game.world.updateDirty();
    game.creatures.update(dt, p.pos, game.spawnPoint, game.night);
    game.npcs.update(dt, p.pos);
    if (game.battle.allyModel) animateModel(game.battle.allyModel, now / 1000, false);
    if (game.battle.trainer && game.battle.foeModel) animateModel(game.battle.foeModel, now / 1000 + 1, false);

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
    if (hudTimer > 0.5) { hudTimer = 0; game.ui.renderHud(); updateGuide(); }
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
game.talkTo = talkTo;
