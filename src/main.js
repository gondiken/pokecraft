import * as THREE from 'three';
import { B, BLOCKS, HOTBAR, PLACEABLE, drawAtlas } from './blocks.js';
import { World, WORLD_W, WORLD_D, raycastVoxel, convertEdits } from './world.js';
import { Player } from './player.js';
import { CreatureManager } from './creatures.js';
import { SPECIES, STARTERS, TYPE_COLORS, makeCreature, statsFor, animateModel } from './species.js';
import { Battle } from './battle.js';
import { Book } from './book.js';
import { NpcManager } from './npc.js';
import { GYMS, TOWER, ORIGINAL_GYMS } from './gyms.js';
import { TouchControls } from './touch.js';
import * as cloud from './cloud.js';
import { Multiplayer, cleanCode } from './multiplayer.js';
import { Duels } from './duel.js';
import { UI, portrait } from './ui.js';
import { el } from './util.js';
import { sound } from './sound.js';
import { Fx } from './fx.js';
import { Weather } from './weather.js';
import { caveLight, patchMaterial } from './caves.js';

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
const FLASH = new THREE.Color(0xe8eeff);
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
  // alphaTest: glass has see-through pixels.
  solid: new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, alphaTest: 0.5 }),
  // Lamps and star crystals keep their full brightness at night.
  glow: new THREE.MeshBasicMaterial({ map: texture, vertexColors: true }),
  water: new THREE.MeshBasicMaterial({
    map: texture, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide,
  }),
};

// Darkness under cover: vertex colours carry the sky and block light, the shader mixes them (see caves.js).
patchMaterial(materials.solid);
patchMaterial(materials.water);

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
  party: [], box: [], cubes: 10, selected: 0, hotbar: [...HOTBAR], badges: [], beaten: [], champion: false,
  time: 0.05, started: false, inBattle: false,
  spawnPoint: new THREE.Vector3(),
  renderer, underground: false,
};

game.creatures = new CreatureManager(scene, null);
game.npcs = new NpcManager(scene);
game.creatures.onSing = (wild, volume) => {
  if (!game.started || game.inBattle) return;
  sound.cry(wild.data.species, 'sound', volume);
  if (!game.heardSinging) {
    game.heardSinging = true;
    game.ui.toast(`♪ Listen! A ${wild.species.name} is singing nearby.`);
  }
};
game.creatures.onSpawn = wild => {
  if (game.started && wild.species.type === 'rainbow') game.ui.toast('Something shimmering is nearby... a rainbow creature!');
};
game.ui = new UI(game, atlas);
game.fx = new Fx(scene);
game.battle = new Battle(game);
game.weather = new Weather(game, {
  toast: t => { if (game.started && !game.inBattle) game.ui.toast(t); },
  changed: () => { if (game.mp?.role === 'host') game.mp.sendState(); },
});
game.creatures.weather = game.weather;
game.book = new Book(game);

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

function snapshot() {
  game.book.syncTeam();
  const p = game.player;
  // While visiting someone else's world, keep saving your own world and position, not theirs.
  const home = game.homeWorld ?? {
    seed: game.world.seed, edits: [...game.world.edits], size: [WORLD_W, WORLD_D],
    pos: [p.pos.x, p.pos.y, p.pos.z], yaw: p.yaw, pitch: p.pitch, time: game.time,
  };
  return {
    ...home, party: game.party, box: game.box, cubes: game.cubes, badges: game.badges, beaten: game.beaten,
    hotbar: game.hotbar,
    champion: game.champion,
    toldCaveGym: true,
    ...game.book.toSave(),
    savedAt: Date.now(),
  };
}

// Saves to this device, and (when signed in) online. `important` uploads right away
// instead of waiting for the next regular cloud save.
function save(important = false) {
  if (!game.started) return;
  const data = snapshot();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
  pendingCloud = data;
  if (important) pushCloud();
}

/* ------------------------------ cloud saves ------------------------------ */

let pendingCloud = null; // newest save not yet uploaded
let cloudBusy = false;
const cloudState = { text: '', error: false };

async function pushCloud() {
  if (!game.user || !pendingCloud || cloudBusy) return;
  const data = pendingCloud;
  pendingCloud = null;
  cloudBusy = true;
  try {
    await cloud.saveCloud(data);
    const t = new Date();
    setCloudState(`Saved online at ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
  } catch (e) {
    pendingCloud ??= data; // retry with the next cloud save
    setCloudState(`Couldn't save online: ${e.message} Progress is still saved on this device.`, true);
  }
  cloudBusy = false;
}

function setCloudState(text, error = false) {
  cloudState.text = text;
  cloudState.error = error;
  renderCloudStatus();
}

function renderCloudStatus() {
  const box = document.getElementById('cloud-status');
  const text = game.user ? (cloudState.text || `Signed in as ${game.user.email}`)
    : 'Not signed in: progress is only saved on this device.';
  box.textContent = text;
  box.classList.toggle('error', game.user && cloudState.error);
}

// After signing in: use whichever save is newer, the one online or the one on this device.
async function syncFromCloud() {
  try {
    const online = await cloud.loadCloud();
    const local = loadSave();
    if (online && (!local || (online.savedAt || 0) > (local.savedAt || 0))) {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(online)); } catch { /* storage unavailable */ }
      if (!game.started) showTitle();
      setCloudState('Loaded your online save.');
    } else if (local && local.seed !== undefined) {
      await cloud.saveCloud(local);
      setCloudState('Your progress is saved online.');
    }
  } catch (e) {
    setCloudState(`Couldn't reach your online save: ${e.message}`, true);
  }
}

let typedEmail = ''; // kept across re-renders so a typo doesn't mean retyping everything

function renderAccount(mode = 'idle', message = '', isError = false) {
  const box = document.getElementById('account');
  const msg = message && el('div', { class: `acct-msg${isError ? ' error' : ''}` }, message);
  if (game.user) {
    box.replaceChildren(
      el('div', {}, '☁ Signed in as ', el('b', {}, game.user.email), ' · your game saves online'),
      el('button', { class: 'small', onclick: async () => {
        await cloud.signOut();
        game.user = null;
        renderAccount('idle', 'Signed out. Progress is still saved on this device.');
        renderCloudStatus();
      } }, 'Sign out'),
      msg);
    return;
  }
  if (mode !== 'form') {
    box.replaceChildren(
      el('div', {}, 'Want to play on another device too?'),
      el('button', { class: 'small', onclick: () => renderAccount('form') }, 'Sign in / Create account'),
      msg);
    return;
  }
  if (mode === 'newPassword') {
    const pw = el('input', { type: 'password', placeholder: 'New password (6+ characters)', autocomplete: 'new-password' });
    const setIt = async () => {
      if (pw.value.length < 6) { renderAccount('newPassword', 'The password needs at least 6 characters.', true); return; }
      box.querySelectorAll('button,input').forEach(b => { b.disabled = true; });
      const res = await cloud.setNewPassword(pw.value);
      if (res.error) { renderAccount('newPassword', res.error, true); return; }
      game.user = res.user;
      renderAccount('idle', 'Password changed! You are signed in.');
      await syncFromCloud();
    };
    box.replaceChildren(
      el('div', {}, 'Choose a new password'),
      el('form', { class: 'acct-form', onsubmit: e => { e.preventDefault(); setIt(); } },
        pw, el('div', { class: 'acct-btns' }, el('button', { class: 'small primary', type: 'submit' }, 'Save password'))),
      msg);
    pw.focus();
    return;
  }
  const email = el('input', { type: 'email', placeholder: 'Email', autocomplete: 'email', value: typedEmail });
  email.addEventListener('input', () => { typedEmail = email.value; });
  const password = el('input', { type: 'password', placeholder: 'Password (6+ characters)', autocomplete: 'current-password' });
  const go = async create => {
    if (!email.value || !password.value) { renderAccount('form', 'Enter an email and a password.', true); return; }
    box.querySelectorAll('button,input').forEach(b => { b.disabled = true; });
    const res = create ? await cloud.signUp(email.value.trim(), password.value) : await cloud.signIn(email.value.trim(), password.value);
    if (res.error) { renderAccount('form', res.error, true); return; }
    if (res.needsConfirm) {
      renderAccount('idle', `Almost done! We sent an email to ${email.value.trim()}. Click the link in it, then sign in here.`);
      return;
    }
    game.user = res.user;
    renderAccount('idle', 'Signed in! Syncing your save...');
    await syncFromCloud();
    renderAccount('idle', cloudState.text, cloudState.error);
  };
  const forgot = async () => {
    const address = email.value.trim();
    if (!address) { renderAccount('form', 'Type your email first, then press "Forgot password?".', true); return; }
    const res = await cloud.sendPasswordReset(address);
    renderAccount('form', res.error || `We sent a link to ${address}. Open it on this device to choose a new password.`, !!res.error);
  };
  box.replaceChildren(
    el('form', { class: 'acct-form', onsubmit: e => { e.preventDefault(); go(false); } },
      email, password,
      el('div', { class: 'acct-btns' },
        el('button', { class: 'small primary', type: 'submit' }, 'Sign in'),
        el('button', { class: 'small', type: 'button', onclick: () => go(true) }, 'Create account'),
        el('button', { class: 'small', type: 'button', onclick: () => renderAccount('idle') }, 'Cancel')),
      el('div', { class: 'acct-btns' },
        el('button', { class: 'small link', type: 'button', onclick: forgot }, 'Forgot password?'))),
    msg);
  (typedEmail ? password : email).focus();
}

async function initAccount() {
  // Opened from a "reset password" email: ask for the new password straight away.
  let recovering = false;
  cloud.onAuthChange((event, user) => {
    if (event !== 'PASSWORD_RECOVERY') return;
    recovering = true;
    game.user = user;
    if (game.started) pause();
    titleEl.classList.remove('hidden');
    renderAccount('newPassword');
  });
  game.user = await cloud.currentUser();
  if (recovering) return; // the new-password form is showing; don't replace it
  renderAccount();
  renderCloudStatus();
  if (game.user) {
    await syncFromCloud();
    renderAccount('idle', cloudState.error ? cloudState.text : '', cloudState.error);
  }
}

// size: the map size the edits were saved with (missing in saves from before the map grew).
function createWorld(seed, edits, size) {
  if (game.world) game.world.dispose();
  const world = new World(seed, scene, materials);
  world.generate();
  if (edits) world.applyEdits(convertEdits(edits, size));
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
  createWorld(saved?.seed ?? (Math.random() * 1e9) | 0, saved?.edits, saved?.size);
  const buttons = document.getElementById('title-buttons');
  buttons.classList.remove('hidden');
  document.getElementById('starter-pick').classList.add('hidden');
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
  game.book.reset(); game.book.syncTeam();
  game.cubes = 10;
  game.time = 0.05;
  game.badges = [];
  game.beaten = [];
  game.champion = false;
  game.hotbar = [...HOTBAR];
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
  game.book.load(saved);
  game.cubes = saved.cubes ?? 10;
  game.time = saved.time ?? 0.05;
  game.badges = saved.badges || [];
  game.beaten = saved.beaten || [];
  game.champion = !!saved.champion;
  // Saves from before the Blocks panel have no hotbar; unknown blocks fall back to the default.
  game.hotbar = HOTBAR.map((id, i) => (BLOCKS[saved.hotbar?.[i]] && PLACEABLE.includes(saved.hotbar[i]) ? saved.hotbar[i] : id));
  const p = game.player;
  if (saved.pos) p.pos.set(...saved.pos); else p.pos.copy(game.spawnPoint);
  // Buildings can move between versions; never start inside a wall.
  if (p.collides(p.pos)) p.pos.copy(game.spawnPoint);
  p.yaw = saved.yaw || 0; p.pitch = saved.pitch || 0;
  begin();
  // Old players with the first 16 badges: tell them about the gyms they have not seen yet.
  const old = GYMS.slice(0, ORIGINAL_GYMS);
  if (old.every(g => game.badges.includes(g.id))) {
    const missing = GYMS.slice(ORIGINAL_GYMS).filter(g => !game.badges.includes(g.id));
    if (missing.length && missing.length <= 4) {
      const names = missing.map(g => g.name.replace(/ Gym$/, ' Gym'));
      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      game.ui.toast(`New gyms have appeared: the ${list}! Follow the arrow.`);
    } else if (missing.length) {
      game.ui.toast(`${missing.length} new gyms have appeared! Follow the arrow to find them.`);
    }
  }
  // Players who haven't beaten the Fossil Gym yet: it moved into a cave.
  if (!game.badges.includes('bone') && !saved.toldCaveGym) {
    game.ui.toast('The Fossil Gym moved into a big cave! Follow the arrow to the stairs.');
  }
}

function begin() {
  game.started = true;
  game.weather.reset();
  titleEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  game.ui.renderHud();
  if (touchMode) {
    document.getElementById('touch').classList.remove('hidden');
    goFullscreen();
  }
  resume();
  save(true);
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
  // Touch: carry on straight away. Mouse: try to take the mouse back (works right after a click
  // or key press); if the browser says no, the pause screen asks for a click.
  resume();
}

function pause() {
  save(true);
  if (locked) document.exitPointerLock();
  game.player.keys = {};
  game.touch.reset();
  pauseEl.classList.remove('hidden');
}

// Pause menu -> title screen (Continue / New Game / Sign in).
async function goToMenu() {
  if (game.mp.role === 'guest') { await goHome(); return; } // reloads into your own world's title screen
  save(true);
  game.mp.close();
  game.fx.clear();
  game.started = false;
  game.weather.reset();
  if (locked) document.exitPointerLock();
  game.player.keys = {};
  game.touch.reset();
  pauseEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  document.getElementById('touch').classList.add('hidden');
  titleEl.classList.remove('hidden');
  showTitle();
  renderAccount();
}

// The team panel (P) and the Blocks panel (B): the same key or button opens and closes them.
function togglePanel(which = 'team') {
  if (game.inBattle) return;
  if (game.ui.panelOpen) {
    game.ui.closePanel();
    afterOverlay();
  } else {
    game.player.keys = {};
    game.touch.reset();
    game.ui.openPanel(which);
    if (locked) document.exitPointerLock();
    pauseEl.classList.add('hidden');
  }
}
const toggleTeam = () => togglePanel('team');
const toggleBlocks = () => togglePanel('blocks');
const toggleBook = () => togglePanel('book');
game.openBlocks = () => { if (!game.ui.panelOpen) toggleBlocks(); };
game.closeBlocks = () => { if (game.ui.panelOpen) togglePanel(); };

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) pauseEl.classList.add('hidden');
  else {
    game.player.keys = {};
    if (game.started && !game.inBattle && !game.ui.panelOpen) {
      pauseEl.classList.remove('hidden');
      save(true);
    }
  }
});

window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setTouchMode(true); }, true);
if (window.matchMedia('(pointer: coarse)').matches) setTouchMode(true);

document.addEventListener('pointerlockerror', () => {
  if (game.started && !game.inBattle && !game.ui.panelOpen) pauseEl.classList.remove('hidden');
});

pauseEl.addEventListener('click', resume);
const soundBtn = document.getElementById('sound-btn');
const showSound = () => { soundBtn.textContent = sound.on ? '🔊 Sound on' : '🔇 Sound off'; };
soundBtn.addEventListener('click', e => { e.stopPropagation(); sound.setOn(!sound.on); showSound(); });
showSound();
const fxBtn = document.getElementById('fx-btn');
const showFx = () => { fxBtn.textContent = game.fx.on ? '✨ Effects on' : '✨ Effects off'; };
fxBtn.addEventListener('click', e => { e.stopPropagation(); game.fx.setOn(!game.fx.on); showFx(); });
showFx();
document.getElementById('menu').addEventListener('click', e => { e.stopPropagation(); goToMenu(); });
game.isTouch = () => touchMode;
document.getElementById('party-close').addEventListener('click', toggleTeam);
document.getElementById('blocks-close').addEventListener('click', toggleBlocks);
document.getElementById('book-close').addEventListener('click', toggleBook);
canvas.addEventListener('click', () => {
  if (!touchMode && game.started && !locked && !game.inBattle && !game.ui.panelOpen) resume();
});

document.addEventListener('mousemove', e => {
  if (locked && !game.inBattle) game.player.look(e.movementX, e.movementY);
});

document.addEventListener('keydown', e => {
  if (!game.started) return;
  if (e.target instanceof HTMLInputElement) return; // typing a name or code, not playing
  if (game.duels.incoming && (e.code === 'KeyY' || e.code === 'KeyN')) {
    if (e.code === 'KeyY') game.duels.accept(); else game.duels.decline();
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Tab' || e.code === 'KeyB' || e.code === 'KeyC' || (e.code === 'Escape' && game.ui.panelOpen)) {
    e.preventDefault();
    togglePanel(e.code === 'KeyB' ? 'blocks' : e.code === 'KeyC' ? 'book' : 'team');
    return;
  }
  if (!playing()) return;
  if (e.code === 'Space') e.preventDefault();
  game.player.keys[e.code] = true;
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5)) - 1;
    if (n >= 0 && n < game.hotbar.length) { game.selected = n; game.ui.renderHud(); }
  }
  if (e.code === 'KeyE') interact();
});

document.addEventListener('keyup', e => { if (game.player) game.player.keys[e.code] = false; });

document.addEventListener('wheel', e => {
  if (!locked || game.inBattle) return;
  game.selected = (game.selected + (e.deltaY > 0 ? 1 : -1) + game.hotbar.length) % game.hotbar.length;
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

// Battle the targeted creature or player, or talk to the targeted person. Returns false if nothing is targeted.
function interact() {
  if (target.player) { game.duels.challenge(target.player); return true; }
  if (target.npc) { talkTo(target.npc); return true; }
  if (target.wild) { startBattle({ wild: target.wild }); return true; }
  if (target.block?.id === B.CHEST) { openChest(target.block); return true; }
  return false;
}

function breakBlock() {
  const world = game.world;
  const hit = target.block;
  if (!hit || hit.y === 0) return;
  if (hit.id === B.CHEST) { openChest(hit); return; } // a closed chest opens instead of breaking
  world.set(hit.x, hit.y, hit.z, B.AIR);
  // Water flows into the hole if it borders water.
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
    if (world.get(hit.x + dx, hit.y + dy, hit.z + dz) === B.WATER) { world.set(hit.x, hit.y, hit.z, B.WATER); break; }
  }
  game.mp.sendBlock(hit.x, hit.y, hit.z, world.get(hit.x, hit.y, hit.z));
  sound.play('break');
  // Leaves and gold ore sometimes hide a Capture Cube.
  const find = hit.id === B.LEAVES ? 0.1 : hit.id === B.GOLD_ORE ? 0.35 : 0;
  if (Math.random() < find) {
    game.cubes++;
    game.ui.renderHud();
    sound.play('cube');
    game.ui.toast(hit.id === B.GOLD_ORE ? 'You found a Capture Cube in the gold!' : 'You found a Capture Cube in the leaves!');
  }
}

// A treasure chest from the caves: opens (for everyone playing together) and gives 3 Capture Cubes.
function openChest(hit) {
  const world = game.world;
  if (world.get(hit.x, hit.y, hit.z) !== B.CHEST) return;
  world.set(hit.x, hit.y, hit.z, B.CHEST_OPEN);
  game.mp.sendBlock(hit.x, hit.y, hit.z, B.CHEST_OPEN);
  game.cubes += 3;
  game.ui.renderHud();
  sound.play('cube');
  game.ui.toast('Treasure! You found 3 Capture Cubes.');
  save();
}

function placeBlock() {
  const world = game.world;
  const hit = target.block;
  if (!hit) return;
  const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
  const cur = world.get(x, y, z);
  if (!world.inBounds(x, y, z) || (cur !== B.AIR && cur !== B.WATER)) return;
  if (game.player.overlapsBlock(x, y, z)) return;
  world.set(x, y, z, game.hotbar[game.selected]);
  game.mp.sendBlock(x, y, z, game.hotbar[game.selected]);
  sound.play('place');
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
  const other = game.mp.pick(origin, direction, reach);
  const block = raycastVoxel(game.world, origin, direction, reach);
  const wall = block ? block.t : Infinity;
  if (other && other.dist < wall && (!npc || other.dist < npc.dist) && (!wild || other.dist < wild.dist)) game.duels.challenge(other.player);
  else if (npc && npc.dist < wall && (!wild || npc.dist < wild.dist)) talkTo(npc.npc);
  else if (wild && wild.dist < wall) startBattle({ wild: wild.wild });
  else if (block?.id === B.CHEST && block.t <= REACH) openChest(block);
}

game.touch = new TouchControls(game, canvas, {
  canPlay: playing,
  jump: down => { game.player.keys.Space = down && playing(); },
  breakBlock: () => { if (playing()) breakBlock(); },
  place: () => { if (playing()) placeBlock(); },
  interact: () => { if (playing()) interact(); },
  team: toggleTeam,
  blocks: toggleBlocks,
  book: toggleBook,
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
    sound.play('heal');
    ui.toast(`${npc.name}: Your team is fully healed. Good luck out there!`);
    return;
  }
  if (npc.kind === 'tower') { talkTower(npc); return; }
  const gym = npc.gym.def;
  if (gym.night && !game.night) { ui.toast(nightGymClosed(gym)); return; }
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

// People in the Champion's Tower: two guards, Coach Dex and the Champion. All wait for every badge (old champions keep their access).
function talkTower(npc) {
  const ui = game.ui;
  if (game.badges.length < GYMS.length && !game.champion) {
    ui.toast(`${npc.name}: ${TOWER.locked(game.badges.length)}`);
    return;
  }
  const p = game.world.tower.people.find(q => q.role === npc.role);
  if (npc.role === 'coach') {
    const top = Math.max(...game.party.map(c => c.level));
    const lv = Math.max(25, Math.min(44, top));
    const ids = p.teams[Math.floor(Math.random() * p.teams.length)];
    startBattle({ trainer: npc, team: ids.map((id, i) => [id, i === 0 ? lv - 1 : lv]), intro: p.intro, xpBoost: 2 });
    return;
  }
  if (npc.role === 'guard1' || npc.role === 'guard2') {
    if (game.beaten.includes(`tower:${npc.role}`)) {
      ui.toast(`${npc.name}: You already beat me! Go on up.`);
      return;
    }
    if (npc.role === 'guard2' && !game.beaten.includes('tower:guard1')) {
      ui.toast(`${npc.name}: Beat Guard Bram first, then come back to me!`);
      return;
    }
    startBattle({ trainer: npc, team: p.team, intro: p.intro });
    return;
  }
  if (!game.beaten.includes('tower:guard2')) {
    ui.toast(`${npc.name}: Beat my guards first, then come back!`);
    return;
  }
  const team = p.team.map(([s, l]) => [s, Math.min(50, l + (game.champion ? 3 : 0))]);
  startBattle({ trainer: npc, team, intro: game.champion ? p.rematch : p.intro, boss: true });
}

// Rewards after beating someone in the tower.
function towerWon(npc) {
  const ui = game.ui;
  const p = game.world.tower.people.find(q => q.role === npc.role);
  if (npc.role === 'coach') {
    sound.play('win');
    game.cubes += 1;
    ui.toast(`${npc.name}: ${p.win}`);
  } else if (npc.role === 'champion') {
    const first = !game.champion;
    game.champion = true;
    sound.play('champion');
    game.cubes += first ? 20 : 5;
    ui.toast(`${npc.name}: ${p.lose}`);
    ui.toast(first ? 'You are the Champion! +20 Capture Cubes' : 'Another win! +5 Capture Cubes');
    if (first) ui.celebrate();
  } else {
    const key = `tower:${npc.role}`;
    if (!game.beaten.includes(key)) game.beaten.push(key);
    sound.play('win');
    game.cubes += 3;
    ui.toast(`${npc.name}: ${p.lose}`);
    ui.toast('You got 3 Capture Cubes.');
  }
}

function startBattle(opts) {
  if (game.inBattle) return;
  if (!opts.duel && !game.party.some(c => c.hp > 0)) {
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
  if (opts.duel) {
    // Battles between players: nobody's team gets hurt, and the winner gets 3 Capture Cubes.
    const name = opts.duel.name;
    game.duels.finish();
    game.duels.lastResult = result;
    if (result === 'won') {
      game.cubes += 3;
      sound.play('win');
      game.ui.toast(`You won the battle with ${name}! +3 Capture Cubes`);
    } else if (result === 'lost' || result === 'gaveup') {
      game.ui.toast(`${name} won this time. Good battle!`);
    }
    game.ui.renderHud();
    save(true);
    afterOverlay();
    return;
  }
  if (result === 'lost') {
    sound.play('lose');
    healTeam();
    game.player.pos.copy(game.spawnPoint);
    game.player.vel.set(0, 0, 0);
    if (opts.trainer?.kind === 'tower') game.ui.toast(TOWER.people.at(-1).hint);
  }
  const npc = opts.trainer;
  if (result === 'won' && npc?.kind === 'tower') towerWon(npc);
  else if (result === 'won' && npc) {
    const gym = npc.gym.def;
    if (npc.kind === 'trainer') {
      game.beaten.push(`${gym.id}:trainer`);
      sound.play('win');
      game.cubes += 2;
      game.ui.toast(`${npc.name}: Nice battle! ${gym.leader.name} is waiting at the back.`);
      game.ui.toast('You got 2 Capture Cubes.');
    } else if (!game.badges.includes(gym.id)) {
      game.badges.push(gym.id);
      sound.play('badge');
      game.cubes += 5;
      game.ui.toast(`${npc.name}: ${gym.lose}`);
      game.ui.toast(`You earned the ${gym.badge}! (${game.badges.length}/${GYMS.length}) +5 Capture Cubes`);
      if (game.badges.length === GYMS.length) {
        game.ui.toast(game.champion ? 'You collected every badge! Champion Solenne would love a rematch.'
          : 'You collected every badge! The Champion\'s Tower is open. Follow the arrow!');
      }
    } else {
      sound.play('win');
      game.ui.toast(`${npc.name}: You are as strong as ever!`);
    }
  }
  game.ui.renderHud();
  save(true);
  afterOverlay();
};

/* ------------------------------- main loop ------------------------------- */

const target = { wild: null, npc: null, player: null, block: null };
let currentGym = null;
let regenTimer = 0;
let saveTimer = 0;
let cloudTimer = 0;
let hudTimer = 0;
let last = performance.now();
let underFade = 0; // 0 on the surface, 1 underground (eased)
const CAVE_DARK = new THREE.Color(0x07080c);

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function updateSky(dt) {
  game.time = (game.time + dt / DAY_LENGTH) % 1;
  const elevation = Math.sin(game.time * Math.PI * 2);
  const light = smoothstep(-0.2, 0.25, elevation);
  const brightness = 0.25 + 0.75 * light;
  const wx = game.weather.sky(light);
  scene.background.copy(NIGHT_SKY).lerp(DAY_SKY, light).lerp(wx.tint, wx.amount);
  if (wx.flash) scene.background.lerp(FLASH, wx.flash * 0.7);
  // Under cover and below the ground it is dark, and the lead creature glows to light the way.
  const under = game.world.underground(game.player.pos);
  if (under && !game.underground) {
    game.underground = true;
    if (!game.toldDark) {
      game.toldDark = true;
      const lead = game.party[0] && SPECIES[game.party[0].species];
      game.ui.toast(`It's dark down here! ${lead ? lead.name : 'Your friend'} glows to light the way.`);
    }
  } else if (!under) game.underground = false;
  underFade += ((under ? 1 : 0) - underFade) * Math.min(1, dt * 1.5);
  scene.background.lerp(CAVE_DARK, underFade);
  scene.fog.color.copy(scene.background);
  scene.fog.near = wx.fogNear; scene.fog.far = wx.fogFar + (40 - wx.fogFar) * underFade;
  const lit = Math.min(1, brightness * wx.dim + wx.flash * 0.4);
  caveLight.uLit.value = lit;
  caveLight.uLantern.value = 0.75 * underFade;
  caveLight.uPlayer.value.copy(game.player.eyePos);
  hemi.intensity = (0.35 + 1.0 * light) * (1 - 0.6 * underFade);
  sun.intensity = (0.1 + 1.1 * light) * (1 - 0.6 * underFade);
  const hours = (game.time * 24 + 6) % 24;
  const hh = String(Math.floor(hours)).padStart(2, '0');
  const mm = String(Math.floor((hours % 1) * 60 / 10) * 10).padStart(2, '0');
  game.ui.setClock(`${light > 0.5 ? '☀' : '☾'} ${hh}:${mm}${game.weather.icon}${under ? ' · Cave' : ''}`);
  game.night = light < 0.3;
  game.npcs.setNight(game.night); // the Saucer Gym's people come and go with the night
}

// Minutes of real time until it gets dark (0 if it already is).
function minutesToNight() {
  if (game.night) return 0;
  const lightAt = t => smoothstep(-0.2, 0.25, Math.sin(t * Math.PI * 2));
  let t = game.time, steps = 0;
  while (lightAt(t) >= 0.3 && steps < 600) { t = (t + 0.002) % 1; steps++; }
  return Math.max(1, Math.ceil(steps * 0.002 * DAY_LENGTH / 60));
}

function nightGymClosed(def) {
  const m = minutesToNight();
  return `The ${def.name} is empty... the aliens only visit at night! Night comes in about ${m} minute${m === 1 ? '' : 's'}.`;
}

let skyToldNear = false, skyToldPad = false, skyNearest = null;

// Points the player towards the next gym they haven't beaten yet.
function updateGuide() {
  const p = game.player.pos;
  game.npcs.setNight(game.night);
  const unbeaten = game.world.gyms.filter(g => !game.badges.includes(g.def.id));
  let next = unbeaten[0];
  let nightNote = '';
  if (next?.def.night && !game.night) {
    const other = unbeaten.find(g => !g.def.night);
    if (other) { next = other; nightNote = ` · ${unbeaten[0].def.name} opens at night ☾`; }
    else nightNote = ' (opens at night ☾)';
  }
  if (!next && !game.champion && game.world.tower) next = game.world.tower;
  if (!next) game.ui.setGuide('★ Champion! ★');
  else updateArrow(p, next, nightNote);

  // Sky gym hints (Cloud and Saucer): they float above the ground, so tell the player to build up.
  const dist = g => Math.hypot(g.x + 0.5 - p.x, g.z + 0.5 - p.z);
  const sky = game.world.gyms.filter(g => g.sky && !game.badges.includes(g.def.id)).sort((a, b) => dist(a) - dist(b))[0];
  if (sky !== skyNearest) { skyNearest = sky; skyToldNear = skyToldPad = false; }
  if (sky) {
    const h = Math.hypot(sky.x + 0.5 - p.x, sky.z + 0.5 - p.z);
    if (h > 24) skyToldNear = false;
    else if (h <= 14 && p.y < sky.y - 1 && !skyToldNear) {
      skyToldNear = true;
      game.ui.toast(`The ${sky.def.name} floats high in the sky! Build a tower of blocks on the ${sky.padColor || 'blue'} pad and jump across.`);
    }
    if (!skyToldPad && sky.pad && Math.hypot(p.x - (sky.pad[0] + 0.5), p.z - (sky.pad[2] + 0.5)) < 2 && p.y < sky.y - 1) {
      skyToldPad = true;
      game.ui.toast('Tip: look down, jump and place a block under you. Keep going up!');
    }
  }

  const inside = game.world.gymAt(p.x, p.z, p.y) || game.world.towerAt(p.x, p.z);
  if (inside !== currentGym) {
    currentGym = inside;
    if (inside?.tower) game.ui.toast("Welcome to the Champion's Tower!");
    else if (inside?.def.night && !game.night) game.ui.toast(nightGymClosed(inside.def));
    else if (inside) game.ui.toast(`Welcome to the ${inside.def.name}! (${inside.def.type} type)`);
  }
}

function updateArrow(p, next, note = '') {
  let tx = next.x + 0.5, tz = next.z + 0.5, where = '';
  const cave = next.cave;
  let above = false, onIsland = false;
  if (next.sky) {
    const h = Math.hypot(tx - p.x, tz - p.z);
    onIsland = p.y >= next.y - 1 && h < 12;
    above = h < 14 && p.y < next.y - 1;
    if (above && next.pad) { tx = next.pad[0] + 0.5; tz = next.pad[2] + 0.5; }
  }
  if (cave) {
    const [mx, , mz] = cave.mouth;
    const [fx, fz] = next.front;
    // On the way in: close to the line from the arch to the door and below the hill, or in the cavern.
    const along = (p.x - (mx + 0.5)) * -fx + (p.z - (mz + 0.5)) * -fz; // distance from the arch towards the gym
    const total = Math.abs(mx - next.x) + Math.abs(mz - next.z);
    const across = Math.abs((p.x - next.x - 0.5) * fz) + Math.abs((p.z - next.z - 0.5) * fx);
    const ground = game.world.ground[Math.floor(p.x) + Math.floor(p.z) * WORLD_W] ?? 99;
    const onTheWay = along >= -1 && along <= total + 1 && across <= 3 && p.y < ground + 1;
    const inCavern = Math.max(Math.abs(p.x - next.x - 0.5), Math.abs(p.z - next.z - 0.5)) <= 14 && p.y < next.y + 9;
    if (onTheWay || inCavern) where = 'in';
    else { tx = mx + 0.5; tz = mz + 0.5; where = 'out'; }
  }
  game.guideTarget = [tx, tz];
  const dx = tx - p.x, dz = tz - p.z;
  const dist = Math.round(Math.hypot(dx, dz));
  // Angle of the target relative to where the player is looking.
  let rel = Math.atan2(-dx, -dz) - game.player.yaw;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const arrows = ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'];
  const arrow = arrows[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8];
  let text;
  if (where === 'out') text = dist < 6 ? `The ${next.def.name} is down these stairs!` : `Next: ${next.def.name} (in a cave) ${arrow} ${dist}m`;
  else if (where === 'in') text = Math.hypot(next.x + 0.5 - p.x, next.z + 0.5 - p.z) < 8 ? `${next.def.name} is here!` : `Next: ${next.def.name} ↓ ${Math.round(Math.hypot(next.x + 0.5 - p.x, next.z + 0.5 - p.z))}m`;
  else if (next.sky) {
    text = above ? `The ${next.def.name} is right above you! ⬆`
      : onIsland ? `${next.def.name} is here!` : `Next: ${next.def.name} (up in the sky!) ${arrow} ${dist}m`;
  } else text = dist < 8 ? `${next.def.name} is here!` : `Next: ${next.def.name} ${arrow} ${dist}m`;
  game.ui.setGuide(text + note);
}

function updateTarget() {
  const origin = game.player.eyePos;
  const dir = game.player.forward;
  const hitWild = game.creatures.pick(origin, dir, REACH + 1);
  const hitNpc = game.npcs.pick(origin, dir, REACH + 1);
  const hitPlayer = game.mp.pick(origin, dir, REACH + 1);
  const hitBlock = raycastVoxel(game.world, origin, dir, REACH);
  const blockDist = hitBlock ? hitBlock.t : Infinity;
  target.player = hitPlayer && hitPlayer.dist < blockDist && (!hitNpc || hitPlayer.dist < hitNpc.dist)
    && (!hitWild || hitPlayer.dist < hitWild.dist) ? hitPlayer.player : null;
  target.npc = !target.player && hitNpc && hitNpc.dist < blockDist && (!hitWild || hitNpc.dist < hitWild.dist) ? hitNpc.npc : null;
  target.wild = !target.player && !target.npc && hitWild && hitWild.dist < blockDist ? hitWild.wild : null;
  target.block = target.wild || target.npc || target.player ? null : hitBlock;
  if (target.block) {
    highlight.visible = true;
    highlight.position.set(target.block.x + 0.5, target.block.y + 0.5, target.block.z + 0.5);
  } else highlight.visible = false;
  const how = touchMode ? 'tap' : 'click or E';
  game.ui.setPrompt(target.player ? `${target.player.name} · ${how} to ask for a battle`
    : target.npc ? `${target.npc.title} · ${how} to ${target.npc.kind === 'healer' ? 'heal' : 'challenge'}`
    : target.wild ? `${target.wild.species.name} Lv${target.wild.data.level} · ${how} to battle`
      : target.block?.id === B.CHEST ? `Treasure chest · ${how} to open`
      : '');
  game.touch.setAction(target.player ? `Battle ${target.player.name}!`
    : target.npc ? (target.npc.kind === 'healer' ? 'Heal team' : 'Challenge!')
    : target.wild ? `Battle ${target.wild.species.name}!`
      : target.block?.id === B.CHEST ? 'Open chest!' : '');
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
    game.creatures.update(dt, new THREE.Vector3(WORLD_W / 2, 0, WORLD_D / 2), game.spawnPoint, false, false);
  } else {
    p.joy = game.touch.joy;
    if (playing()) p.update(dt);
    if (p.pos.y < -20) { p.pos.copy(game.spawnPoint); p.vel.set(0, 0, 0); }
    game.world.updateDirty();
    game.creatures.update(dt, p.pos, game.spawnPoint, game.night);
    game.npcs.update(dt, p.pos);
    game.mp.update(dt);
    if (game.battle.allyModel) animateModel(game.battle.allyModel, now / 1000, false);
    if (game.battle.trainer && game.battle.foeModel) animateModel(game.battle.foeModel, now / 1000 + 1, false);

    camera.position.copy(p.eyePos);
    camera.rotation.set(p.pitch, p.yaw, 0);
    if (!game.inBattle) updateTarget();
    game.weather.update(dt, now);
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
    if (hudTimer > 0.5) {
      hudTimer = 0;
      game.ui.renderHud();
      updateGuide();
      game.creatures.levelBonus = game.badges.length >= ORIGINAL_GYMS || game.champion ? 10 : 0;
      const hud = document.getElementById('mp-hud');
      const mp = game.mp;
      const text = mp.role === 'host' ? `👥 Sharing · code ${mp.code} · ${mp.players.length + 1} playing`
        : mp.role === 'guest' ? `👥 In ${mp.hostName || 'a friend'}'s world · ${mp.players.length + 1} playing` : '';
      if (hud.textContent !== text) hud.textContent = text;
    }
    saveTimer += dt;
    if (saveTimer > 15) { saveTimer = 0; save(); }
    cloudTimer += dt;
    if (cloudTimer > 60) { cloudTimer = 0; pushCloud(); }
  }

  game.fx.update(now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => save());
document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });

/* ----------------------------- play together ----------------------------- */

const NAME_KEY = 'pokecraft-name';
const mpBox = document.getElementById('mp');
let mpMessage = { text: '', error: false };

game.mp = new Multiplayer(game, {
  toast: text => { game.ui.toast(text); renderMp(); },
  // Joining: swap in the host's world, keeping your own team, badges and items.
  loadWorld: data => {
    const p = game.player;
    game.homeWorld = {
      seed: game.world.seed, edits: [...game.world.edits], size: [WORLD_W, WORLD_D],
      pos: [p.pos.x, p.pos.y, p.pos.z], yaw: p.yaw, pitch: p.pitch, time: game.time,
    };
    createWorld(data.seed, data.edits, data.size);
    game.time = data.time;
    if (data.weather) game.weather.apply(data.weather);
    const np = game.player;
    np.pos.set(data.hostPos[0] + 1.5, data.hostPos[1], data.hostPos[2] + 1.5);
    for (let i = 0; i < 20 && np.collides(np.pos); i++) np.pos.y += 1;
    game.ui.renderHud();
  },
  duel: p => game.duels.onMessage(p),
  left: id => game.duels.left(id),
  ended: reason => {
    if (reason !== 'host-left') return;
    game.ui.toast('The host left, so you are going back to your own world.');
    setTimeout(goHome, 2500);
  },
});

game.duels = new Duels(game, {
  start: duel => startBattle({ duel }),
  toast: text => game.ui.toast(text),
});

function playerName() {
  let name = '';
  try { name = localStorage.getItem(NAME_KEY) || ''; } catch { /* ignore */ }
  return name || game.user?.email?.split('@')[0] || '';
}

// Leave someone else's world: save your own progress, then reload into your own world.
async function goHome() {
  save();
  await pushCloud();
  game.mp.close();
  // Keep homeWorld set: the save that runs while the page unloads must still save your own world.
  location.reload();
}

function setMpMessage(text, error = false) {
  mpMessage = { text, error };
  renderMp();
}

function renderMp() {
  const mp = game.mp;
  const msg = mpMessage.text && el('div', { class: `acct-msg${mpMessage.error ? ' error' : ''}` }, mpMessage.text);
  const others = mp.players;
  const who = others.length ? `Playing with: ${others.join(', ')}` : 'Nobody else is here yet.';
  if (mp.role === 'host') {
    mpBox.replaceChildren(
      el('h3', {}, 'Play together'),
      el('div', {}, 'Your world code is'),
      el('div', { class: 'mp-code' }, mp.code),
      el('div', {}, 'The other player picks "Join a world" and types this code.'),
      el('div', { class: 'mp-who' }, who),
      el('button', { class: 'small', onclick: () => { mp.close(); setMpMessage('You stopped sharing your world.'); } }, 'Stop sharing'),
      msg);
    return;
  }
  if (mp.role === 'guest') {
    mpBox.replaceChildren(
      el('h3', {}, 'Play together'),
      el('div', {}, `You are visiting ${mp.hostName || 'a friend'}'s world.`),
      el('div', { class: 'mp-who' }, who),
      el('div', {}, 'Your team, badges and items are still yours and keep saving.'),
      el('button', { class: 'small', onclick: goHome }, 'Go back to my world'),
      msg);
    return;
  }
  if (mp.role === 'joining') {
    mpBox.replaceChildren(el('h3', {}, 'Play together'), el('div', {}, 'Joining...'));
    return;
  }
  const name = el('input', { type: 'text', placeholder: 'Your name', maxlength: 16, value: playerName() });
  const code = el('input', { type: 'text', placeholder: 'World code', maxlength: 5, class: 'mp-code-input' });
  code.addEventListener('input', () => { code.value = cleanCode(code.value); });
  const checkName = () => {
    const n = name.value.trim();
    if (!n) { setMpMessage('Type your name first, so the other player knows who you are.', true); return null; }
    try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ }
    return n;
  };
  const host = async () => {
    const n = checkName(); if (!n) return;
    setMpMessage('Connecting...');
    const res = await mp.host(n);
    setMpMessage(res.error || '', !!res.error);
  };
  const join = async () => {
    const n = checkName(); if (!n) return;
    if (code.value.length !== 5) { setMpMessage('Type the 5-letter world code first.', true); return; }
    save();
    mpMessage = { text: '', error: false };
    const pending = mp.join(code.value, n);
    renderMp();
    const res = await pending;
    if (res.error) { setMpMessage(res.error, true); return; }
    setMpMessage(`Welcome to ${res.hostName}'s world! Tap or click outside this box to play.`);
  };
  mpBox.replaceChildren(
    el('h3', {}, 'Play together'),
    el('div', { class: 'acct-form' },
      name,
      el('div', { class: 'acct-btns' }, el('button', { class: 'small primary', onclick: host }, 'Share my world')),
      el('div', { class: 'mp-or' }, 'or join someone else'),
      code,
      el('div', { class: 'acct-btns' }, el('button', { class: 'small', onclick: join }, 'Join a world'))),
    msg);
}

// Clicks inside the box shouldn't count as "click anywhere to resume".
mpBox.addEventListener('click', e => e.stopPropagation());
mpBox.addEventListener('pointerdown', e => e.stopPropagation());
new MutationObserver(() => { if (!pauseEl.classList.contains('hidden')) renderMp(); })
  .observe(pauseEl, { attributes: true, attributeFilter: ['class'] });

showTitle();
requestAnimationFrame(frame);
initAccount();

// Exposed for debugging from the browser console.
window.pokecraft = game;
game.sound = sound;
game.updateGuide = updateGuide;
game.talkTo = talkTo;
game.interact = interact;
game.breakBlock = breakBlock;
game.placeBlock = placeBlock;
