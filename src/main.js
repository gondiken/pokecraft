import * as THREE from 'three';
import { wildAfter } from './wildafter.js';
import { B, BLOCKS, HOTBAR, PLACEABLE, drawAtlas, flickerFire, swirlPortal, isLimited } from './blocks.js';
import { World, WORLD_W, WORLD_D, MID_X, MID_Z, raycastVoxel, convertEdits } from './world.js';
import { Player } from './player.js';
import { CreatureManager } from './creatures.js';
import { TRAITS, fixTraits } from './traits.js';
import { SPECIES, STARTERS, TYPE_COLORS, makeCreature, statsFor, animateModel } from './species.js';
import { Battle } from './battle.js';
import { Book } from './book.js';
import { NpcManager } from './npc.js';
import { GYMS, TOWER, ORIGINAL_GYMS, REMATCH_CAP, trainersOf, trainerKey } from './gyms.js';
import { createRematch, loadWins } from './rematch.js';
import { createBosses, loadBossWins } from './pictureboss.js'; // T40
import { createMissions, loadMissions } from './missions.js'; // T29
import { createMissionUi } from './missionui.js'; // T29
import { createNavUi } from './navui.js'; // T39a
import { createNav } from './destinations.js'; // T39a
import { TouchControls } from './touch.js';
import { createRiding, rideKind } from './riding.js';
import { createHideSeek } from './hideseek.js'; // T30
import { createPlayTogether } from './playtogether.js';
import { UI, portrait } from './ui.js';
import { el } from './util.js';
import { sound } from './sound.js';
import { Fx } from './fx.js';
import { Weather } from './weather.js';
import { createGuide } from './guide.js';
import { createAccess } from './access.js';
import { createGymLive } from './gymlive.js';
import { createAccounts } from './accounts.js';
import { goldenHour, condToast, condOf } from './spawnrules.js';
import { caveLight, patchMaterial, patchSketch } from './caves.js';
import { createSketch } from './sketch.js'; // T45
import { HomeManager } from './homes.js';
import { createHomeUi } from './homeui.js';
import { createRealms, MAIN, nightProgress } from './realms.js'; // T31
import { createPortal } from './portal.js'; // T38a
import { createSwirlSky } from './swirlsky.js'; // T38d
import { loadStars, PICTURE_WORLDS } from './pictureworlds.js'; // T38a

const randomId = () => Math.random().toString(36).slice(2, 10);
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
const GOLDEN_SKY = new THREE.Color(0xffa060); // sunrise and sunset
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
const portalTiles = new Map(), portalPos = new THREE.Vector2(); // T38a: the Portal Door's spiral frames
const fireTiles = new Map(), firePos = new THREE.Vector2(); // T22: Fireplace flame frames as small textures
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
patchSketch(materials.glow); // T45: only the pencil part (the output is unchanged while the sketch switch is off)

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
  party: [], box: [], cubes: 10, selected: 0, hotbar: [...HOTBAR], badges: [], beaten: [], champion: false, stars: [], // T38a: Picture World ids whose Boss you beat
  rematchWins: {}, // T28 gym rematch wins per gym id, per player like badges
  bossWins: {}, // T40 Picture World Boss rematch wins per Picture World id, per player
  keys: [], // T23 golden keys found ('<gymId>:<key>'), per player like badges
  blockCounts: {}, // limited blocks (T20 treasure) you have: { [block id]: count }
  missionState: loadMissions(), // T29 Champion missions: { active, done: [ids], last }, per player like badges
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
  const tip = condToast(wild.when); // e.g. a Cyber creature, or a visitor at a home
  if (game.started && tip && !(condOf(wild.when)?.once && game.toldOnce.has(wild.when))) { // T36: 'once' toasts (Look up!) show once per session
    game.ui.toast(tip);
    game.toldOnce.add(wild.when);
  }
};
game.toldOnce = new Set();
game.creatures.onTired = w => { if (game.started && !game.inBattle) game.ui.toast(`${w.species.name} is out of breath! Walk into it to battle.`); }; // T36
game.creatures.onBlink = w => { if (game.started && !game.inBattle && !game.toldOnce.has('blink')) { game.toldOnce.add('blink'); game.ui.toast(`Poof! ${w.species.name} blinked away. Ninjas run from fast feet: walk up slowly!`); } }; // T37
// Spawn conditions look at the time of day and at the other players (see spawnrules.js).
game.creatures.env = { time: () => game.time, homes: () => game.homes.ready(), friends: () => (game.mp?.active ? [...game.mp.others.values()].filter(a => a.here).map(a => a.pos) : []), // T31: only friends in the same place
  after: id => wildAfter(game, id) }; // owner 2026-10-27: a Picture World's rare creatures wait for your progress there
// Walking into a disguised Camo creature finds it (else you would walk through a "block"). Owner 2026-10-26: walking into any other
// creature (a tired Racer, Parkour or Ninja creature, a Tiny peeker) never starts a battle: press E or tap it, like every creature.
game.creatures.onBump = wild => { if (playing() && wild.disguise) startBattle({ wild }); };
game.npcs.onBump = npc => { if (playing()) talkTo(npc); }; // walked into a disguised trainer (Hidden Hill)
game.homes = new HomeManager(game); // T22
game.ui = new UI(game, atlas);
game.homeUi = createHomeUi(game, { atlas, texture });
game.missionUi = createMissionUi(game, { atlas }); // T29
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
  // T31: in a realm, the main world's part is the one kept aside (pos = where you wake up), plus where you are in the realm.
  const main = game.realms?.mainPart();
  const at = p.carry?.safe?.() ?? p.pos; // T43: a ride (the Funfair's carousel, coaster, slide) may say where to save you instead of in the air
  const away = !game.homeWorld && main ? { place: game.place, realmPos: [at.x, at.y, at.z, p.yaw, p.pitch], ...(game.realms.upPart() ? { realmUp: game.realms.upPart() } : {}) /* T40 */ } : {};
  if (away.realmPos && p.frameNo?.() != null) away.realmPos.push(p.frameNo()); // Cube Planets: the frame (0-23) as a 6th value (old saves: 5 values = upright)
  const home = game.homeWorld ?? (main ? {
    seed: main.seed, edits: main.edits, size: main.size, pos: main.pos, yaw: main.yaw, pitch: main.pitch, time: game.time, homes: main.homes,
  } : {
    seed: game.world.seed, edits: [...game.world.edits], size: [WORLD_W, WORLD_D],
    pos: [p.pos.x, p.pos.y, p.pos.z], yaw: p.yaw, pitch: p.pitch, time: game.time,
    homes: game.homes.toSave(), // T22
  });
  return {
    ...home, ...away, realmEdits: game.realms ? game.realms.edits() : game.realmEdits, realmVersions: game.realms?.versions() /* T35 */, /* T31 */ playerId: game.playerId, toldHomes: true, party: game.party, box: game.box, cubes: game.cubes, badges: game.badges, beaten: game.beaten,
    hotbar: game.hotbar,
    champion: game.champion,
    stars: game.stars, // T38a
    rematchWins: game.rematchWins,
    bossWins: game.bossWins, // T40
    blockCounts: game.blockCounts,
    missions: game.missionState, // T29
    keys: game.keys,
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
  accounts.queue(data);
  if (important) pushCloud();
}

/* ------------------------------ cloud saves ------------------------------ */

const accounts = createAccounts(game, { loadSave, saveKey: SAVE_KEY, showTitle, pause });
const { pushCloud, renderAccount, initAccount } = accounts;

// size: the map size the edits were saved with (missing in saves from before the map grew).
// opts.realm (T31): a realm def; the world is that realm (its own size, terrain and edits).
function createWorld(seed, edits, size, opts = {}) {
  game.riding?.stop('quiet');
  if (game.world) game.world.dispose();
  const realm = opts.realm ?? null;
  const world = realm ? new World(seed, scene, materials, realm.size, realm) : new World(seed, scene, materials);
  world.generate();
  if (edits) world.applyEdits(realm ? edits : convertEdits(edits, size));
  world.buildAll();
  game.world = world;
  game.sketch?.reset(world); // T45: the pencil look, only in a sketch world (before the people and creatures are made: they are drawn in pencil too)
  game.player = new Player(world);
  game.creatures.setWorld(world);
  game.spawnPoint.copy(findSpawn(world));
  game.npcs.populate(world, game.spawnPoint);
  game.gymLive.reset(world);
  game.homes.reset(world);
  game.portal?.reset(world); // T38a
  game.swirlSky?.reset(world); // T38d
}

function findSpawn(world) {
  if (world.realm) { const [x, z] = world.realm.arrive; return new THREE.Vector3(x + 0.5, world.surface(x, z).y + 1, z + 0.5); } // T31
  const cx = MID_X, cz = MID_Z; // the old middle (T17: the map grew, the start did not move)
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
  game.hideSeek?.reset(); // T30
  game.realms?.reset(); // T31: the title fly-over is always the main world
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
  game.stars = []; // T38a
  game.rematchWins = {};
  game.bossWins = {}; // T40
  game.blockCounts = {};
  game.missionState = loadMissions(); // T29
  game.keys = [];
  game.playerId = game.playerId || randomId();
  game.homes.load([], game.playerId);
  game.realmEdits = {}; // T31
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
  const drawn = fixTraits(game.party, 'party') + fixTraits(game.box, 'box'); // T26: old saves get a uid + traits
  game.book.load(saved);
  game.cubes = saved.cubes ?? 10;
  game.time = saved.time ?? 0.05;
  game.badges = saved.badges || [];
  game.beaten = saved.beaten || [];
  game.champion = !!saved.champion;
  game.stars = loadStars(saved.stars); // T38a: old saves have none
  game.rematchWins = loadWins(saved.rematchWins); // old saves have none
  game.bossWins = loadBossWins(saved.bossWins); // T40: old saves have none
  game.blockCounts = loadCounts(saved.blockCounts); // old saves have none
  game.missionState = loadMissions(saved.missions); // T29: old saves have none
  game.keys = loadKeys(saved.keys); // old saves have none
  game.playerId = saved.playerId || game.playerId || randomId(); // T22: the same on every device with this save
  game.homes.load(saved.homes, game.playerId); // old saves have none
  // Saves from before the Blocks panel have no hotbar; unknown blocks fall back to the default.
  game.hotbar = HOTBAR.map((id, i) => (BLOCKS[saved.hotbar?.[i]] && PLACEABLE.includes(saved.hotbar[i]) ? saved.hotbar[i] : id));
  const p = game.player;
  if (saved.pos) p.pos.set(...saved.pos); else p.pos.copy(game.spawnPoint);
  // Buildings can move between versions; never start inside a wall.
  if (p.collides(p.pos)) p.pos.copy(game.spawnPoint);
  p.yaw = saved.yaw || 0; p.pitch = saved.pitch || 0;
  game.realms.restore(saved); // T31: a save made in a realm loads that realm (old saves: main)
  begin();
  if (drawn) save();
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
  if (!saved.toldHomes) game.ui.toast('New! Put a Doormat in the floor to build a home. Find it in the Blocks panel.');
  // Players who haven't beaten the Fossil Gym yet: it moved into a cave.
  if (!game.badges.includes('bone') && !saved.toldCaveGym) {
    game.ui.toast('The Fossil Gym moved into a big cave! Follow the arrow to the stairs.');
  }
}

// Golden keys from a save (T23): only '<gymId>:<key>' strings that a gym def names, each once.
const ALL_KEYS = new Set(GYMS.flatMap(def => (def.keys || []).map(k => `${def.id}:${k}`)));
function loadKeys(saved) {
  // T40: a Picture World may keep its own keys too ('<Picture World id>:<name>', e.g. 'stadium:goal1')
  const pictureKey = k => /^[a-z0-9]{1,16}:[a-z0-9_-]{1,24}$/.test(k) && PICTURE_WORLDS.some(w => k.startsWith(`${w.id}:`));
  return [...new Set(Array.isArray(saved) ? saved : [])].filter(k => typeof k === 'string' && (ALL_KEYS.has(k) || pictureKey(k)));
}

// Limited blocks from a save: only known limited ids with a whole count above 0.
function loadCounts(saved) {
  const out = {};
  for (const [id, n] of Object.entries(saved || {})) if (isLimited(Number(id)) && Number.isInteger(n) && n > 0) out[id] = n;
  return out;
}

function begin() {
  game.started = true;
  game.riding.sync();
  game.weather.reset();
  titleEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  game.ui.renderHud();
  if (touchMode) {
    document.getElementById('touch').classList.remove('hidden');
    goFullscreen();
  }
  game.npcs.undisguise(key => game.beaten.includes(key)); // beaten Hidden Hill trainers stay revealed
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
  if (!game.started || game.inBattle || game.ui.panelOpen || game.hideSeek?.frozen) return false; // T30: the seeker waits
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

// T39c: the pause screen's big buttons (touch): each opens its panel; Missions only for Champions, My home on a mat.
function showPauseButtons() {
  document.getElementById('pb-missions').classList.toggle('hidden', !game.champion);
  document.getElementById('pb-home').classList.toggle('hidden', !game.homes.matPos);
}
function pause() {
  showPauseButtons();
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
  game.hideSeek.reset(); // T30
  game.fx.clear();
  game.riding.stop('quiet');
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
  if (game.inBattle) { game.ui.closePanel(); return; } // a panel left open over a battle can always be closed
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
// T22: the home panel. game.openHome('types' | 'home' | 'preview') opens it (or switches view when it is open).
game.openHome = view => {
  game.homeUi.want = view ?? 'home'; // T30.5
  if (!game.ui.panelOpen) togglePanel('home');
  else if (game.ui.homeOpen) { game.homeUi.open(game.homeUi.want); game.homeUi.want = null; }
};
// T29: the missions panel. game.openMissions('desk' | 'view') opens it (or switches mode when it is open).
game.openMissions = mode => {
  game.missionUi.want = mode;
  if (!game.ui.panelOpen) togglePanel('missions');
  else if (game.ui.missionsOpen) { game.missionUi.open(mode); game.missionUi.want = null; }
};
game.closeMissions = () => { if (game.ui.missionsOpen) togglePanel(); };
game.openBlocks = () => { if (!game.ui.panelOpen) toggleBlocks(); };
game.closeBlocks = () => { if (game.ui.panelOpen) togglePanel(); };
// T39a: the "Where to go" panel (G, or a tap on the guide line)
game.openNav = () => {
  const dark = !document.getElementById('hs-dark')?.classList.contains('hidden');
  if (game.started && !game.inBattle && !game.ui.panelOpen && !game.ui.asking && !game.hideSeek?.frozen && !dark && !game.realms.busy) togglePanel('nav');
};
game.closeNav = () => { if (game.ui.navOpen) togglePanel(); };
document.getElementById('nav-close').addEventListener('click', () => togglePanel('nav'));

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  // a lock asked for when a panel closed can arrive after the next panel opened: let go again
  if (locked && game.ui.panelOpen) { document.exitPointerLock(); return; }
  if (locked) pauseEl.classList.add('hidden');
  else {
    game.player.keys = {};
    if (game.ui.asking && !game.ui.panelOpen) game.ui.askNo(); // T39b: Esc while the mouse is captured is "Not now"
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
for (const [id, fn] of [['pb-team', toggleTeam], ['pb-blocks', toggleBlocks], ['pb-book', toggleBook],
  ['pb-missions', () => game.openMissions('view')], ['pb-where', () => game.openNav()], ['pb-home', () => game.openHome()]]) {
  document.getElementById(id).addEventListener('click', e => { e.stopPropagation(); pauseEl.classList.add('hidden'); fn(); });
}
game.isTouch = () => touchMode;
document.getElementById('party-close').addEventListener('click', toggleTeam);
document.getElementById('blocks-close').addEventListener('click', toggleBlocks);
document.getElementById('home-close').addEventListener('click', () => togglePanel('home'));
document.getElementById('missions-close').addEventListener('click', () => togglePanel('missions')); // T29
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
  // T39b: a question is open (bed, rematch, follow, duel, giant, hide and seek): the key that asked also answers.
  // E / Enter = yes (a fresh press, not too quick), Y = yes, Esc / N / Backspace = no. E never also talks or breaks.
  if (game.ui.asking) {
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); game.ui.askYes('key', e); return; }
    if (e.code === 'KeyY') { game.ui.askYes('y'); return; }
    if (e.code === 'KeyN' || e.code === 'Backspace' || e.code === 'Escape') { e.preventDefault(); game.ui.askNo(); return; }
  }
  // T39b: the "Let go" question in the box panel: Enter = yes, Esc = keep it
  if (game.ui.confirmYes && (e.code === 'Enter' || e.code === 'Escape')) {
    e.preventDefault();
    if (e.code === 'Enter' && !e.repeat) game.ui.confirmYes(); else if (e.code === 'Escape') game.ui.closeConfirm();
    return;
  }
  // "Continue exploring" after a battle: a key press works too (and lets the game take the mouse back).
  if (game.inBattle && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE')) {
    const btn = document.querySelector('#b-actions button.continue');
    if (btn) { e.preventDefault(); btn.click(); }
    return;
  }
  if (e.code === 'KeyG' && !e.repeat && !game.inBattle) { // T39a: Go
    if (game.ui.navOpen) { e.preventDefault(); togglePanel('nav'); return; }
    if (!game.ui.panelOpen) { e.preventDefault(); game.openNav(); return; }
  }
  if (e.code === 'KeyP' || e.code === 'Tab' || e.code === 'KeyB' || e.code === 'KeyC' || e.code === 'KeyM' || (e.code === 'Escape' && game.ui.panelOpen)) {
    e.preventDefault();
    togglePanel(e.code === 'KeyB' ? 'blocks' : e.code === 'KeyC' ? 'book' : e.code === 'KeyM' ? 'missions' : 'team');
    return;
  }
  if (e.code === 'KeyH' && !game.inBattle && (game.ui.homeOpen || (!game.ui.panelOpen && game.homes.matPos && playing()))) {
    e.preventDefault();
    togglePanel('home'); // T22: H on a Doormat, or to close the home panel
    return;
  }
  if (!playing()) return;
  if (e.code === 'Space') e.preventDefault();
  game.player.keys[e.code] = true;
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5)) - 1;
    if (n >= 0 && n < game.hotbar.length) { game.selected = n; game.ui.renderHud(); }
  }
  if (e.code === 'KeyR' && !e.repeat) game.riding.toggle(); // T27
  if (e.code === 'KeyE' && !interact(true) && game.homes.matPos) game.openHome(); // T22: E with nothing targeted, on a Doormat
});

document.addEventListener('keyup', e => {
  if (game.player) game.player.keys[e.code] = false;
  if (e.code === 'KeyE' && game.player) game.gymLive?.release(game.player); // a held Kick! / Shoot! is let go
});
window.addEventListener('blur', () => { if (game.player) game.gymLive?.release(game.player); });

document.addEventListener('wheel', e => {
  if (!locked || game.inBattle) return;
  game.selected = (game.selected + (e.deltaY > 0 ? 1 : -1) + game.hotbar.length) % game.hotbar.length;
  game.ui.renderHud();
}, { passive: true });

document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('mousedown', e => {
  if (!locked || game.inBattle || game.hideSeek?.frozen) return; // T30
  if (game.ui.asking) { if (e.button === 0) game.ui.askYes('click'); return; } // T39b: a click answers the question, nothing else
  if (e.button === 0) {
    if (!interact()) breakBlock();
  } else if (e.button === 2) {
    placeBlock();
  }
});
document.addEventListener('mouseup', e => { if (e.button === 0 && game.player) game.gymLive?.release(game.player); }); // a held Kick! / Shoot!

// Battle the targeted creature or player, or talk to the targeted person. Returns false if nothing is targeted.
// use (T31): E / tap / the touch action button, not a mouse click (a click on a Bed breaks it, a use sleeps in it).
function interact(use = false) {
  if (target.player) { if (!game.hideSeek.tag(target.player)) game.duels.challenge(target.player); return true; } // T30
  if (target.npc) { talkTo(target.npc); return true; }
  if (target.wild) { startBattle({ wild: target.wild }); return true; }
  if (target.near && game.gymLive.use(game.player)) return true; // T40: a live part's own action ("Fire!", "Kick!")
  if (target.block && game.gymLive.hit(target.block)) return true;
  if (target.block?.id === B.CHEST) { openChest(target.block); return true; }
  if (target.block && game.portal.use(target.block)) return true; // T38a
  if (target.block?.id === B.WAKE_STONE) { game.realms.leave('stone'); return true; } // T31
  if (use && target.block?.id === B.BED && game.realms.useBed(target.block)) return true;
  return false;
}

// Gyms can't be broken into or built in (T17). One short toast, at most every 2 seconds.
let wallToastAt = 0;
function wallToast(text) {
  const t = performance.now();
  if (t - wallToastAt < 2000) return;
  wallToastAt = t;
  game.ui.toast(text);
}

function breakBlock(hit = target.block) {
  const world = game.world;
  if (!hit || hit.y === 0) return;
  if (game.gymLive.hit(hit)) return; // T23: key chests open, reset buttons press (the touch break button comes here)
  if (hit.id === B.CHEST) { openChest(hit); return; } // a closed chest opens instead of breaking
  if (game.portal.use(hit)) return; // T38a: a click on a door uses it, like the Wake Stone
  if (hit.id === B.WAKE_STONE) { game.realms.leave('stone'); return; } // T31: touching it wakes you up
  if (!world.editAllowed(hit.x, hit.y, hit.z, B.AIR)) { wallToast(BLOCKS[hit.id]?.wallText || world.protectedAt(hit.x, hit.y, hit.z)?.wallText || 'Gym walls are too strong to break!'); return; }
  // Natural blocks have no edit yet; a placed block does (T20: so placed gold ore and leaves never give cubes).
  const natural = !world.edits.has(world.index(hit.x, hit.y, hit.z));
  world.set(hit.x, hit.y, hit.z, B.AIR);
  // Water flows into the hole if it borders water.
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
    if (world.get(hit.x + dx, hit.y + dy, hit.z + dz) === B.WATER) { world.set(hit.x, hit.y, hit.z, B.WATER); break; }
  }
  game.mp.sendBlock(hit.x, hit.y, hit.z, world.get(hit.x, hit.y, hit.z));
  sound.play('break');
  // Limited blocks (T20 treasure) go into your bag.
  if (isLimited(hit.id)) {
    const n = (game.blockCounts[hit.id] || 0) + 1;
    game.blockCounts[hit.id] = n;
    game.ui.renderHud();
    sound.play('cube');
    game.ui.toast(`You got a ${BLOCKS[hit.id].name}! You have ${n}.`);
  }
  if (natural) game.gymLive.broke(hit); // T33: ingredients for an open Restaurant order
  // Natural leaves and gold ore sometimes hide a Capture Cube.
  const find = !natural ? 0 : hit.id === B.LEAVES ? 0.1 : hit.id === B.GOLD_ORE ? 0.35 : 0;
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

function placeBlock(hit = target.block) {
  const world = game.world;
  if (!hit) return;
  const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
  const cur = world.get(x, y, z);
  if (!world.inBounds(x, y, z) || (cur !== B.AIR && cur !== B.WATER)) return;
  const id = game.hotbar[game.selected];
  if (!world.editAllowed(x, y, z, id)) { wallToast(world.protectedAt(x, y, z)?.wallText || "You can't build inside a gym!"); return; } // T38a: a keep says its own words
  if (id === B.DOORMAT && world.realm) { wallToast(world.realm.noHomeText || 'No homes in dreams! Build your home in your own world.'); return; } // T31
  if (isLimited(id) && !game.blockCounts[id]) { wallToast(`No ${BLOCKS[id].name} left! ${BLOCKS[id].getMore || 'Mine one in a cave wall, or break one you placed.'}`); return; }
  if (game.player.overlapsBlock(x, y, z)) return;
  world.set(x, y, z, id);
  game.mp.sendBlock(x, y, z, id);
  sound.play('place');
  if (id === B.DOORMAT) game.homes.place(x, y, z); // T22: your home moves here
  if (isLimited(id)) { game.blockCounts[id]--; game.ui.renderHud(); }
}

// Tapping the screen: battle or talk to whatever creature or person is under the finger.
const tapRay = new THREE.Raycaster();
function tapAt(x, y) {
  if (!playing() || game.ui.asking) return; // T39b: a tap on the world never answers a question
  tapRay.setFromCamera(new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1), camera);
  const { origin, direction } = tapRay.ray;
  const reach = REACH + 4;
  const npc = game.npcs.pick(origin, direction, reach);
  const wild = game.creatures.pick(origin, direction, reach);
  const other = game.mp.pick(origin, direction, reach);
  const block = raycastVoxel(game.world, origin, direction, reach);
  const wall = block ? block.t : Infinity;
  if (other && other.dist < wall && (!npc || other.dist < npc.dist) && (!wild || other.dist < wild.dist)) { if (!game.hideSeek.tag(other.player)) game.duels.challenge(other.player); } // T30
  else if (npc && npc.dist < wall && (!wild || npc.dist < wild.dist)) talkTo(npc.npc);
  else if (wild && wild.dist < wall) startBattle({ wild: wild.wild });
  else if (game.gymLive.tap(origin, direction)) { /* T44: a whack at the piñata */ }
  else if (block && block.t <= REACH && game.gymLive.hit(block)) { /* a reset button */ }
  else if (block?.id === B.CHEST && block.t <= REACH) openChest(block);
  else if (block && block.t <= REACH && game.portal.use(block)) { /* a door (T38a) */ }
  else if (block?.id === B.WAKE_STONE && block.t <= REACH) game.realms.leave('stone'); // T31
  else if (block?.id === B.BED && block.t <= REACH) game.realms.useBed(block);
}

game.touchWhy = { place: '', ride: '' };
game.touch = new TouchControls(game, canvas, {
  canPlay: playing,
  jump: down => { game.player.keys.Space = down && playing(); },
  ride: () => { if (!playing()) return; if (game.touchWhy.ride && !game.riding.on) game.ui.toast(game.touchWhy.ride); else game.riding.toggle(); },
  down: d => { game.player.keys.ShiftLeft = d && playing(); },
  place: () => { if (!playing() || game.ui.asking) return; if (game.touchWhy.place) game.ui.toast(game.touchWhy.place); else placeBlock(); },
  // T39c: one button = "do the thing I look at": answer a question, else use the target, else break the block, else My home
  interact: () => {
    if (game.ui.asking) { game.ui.askYes('tap'); return; } // T39b
    if (!playing() || interact(true)) return;
    if (target.block) breakBlock(); else if (game.homes.matPos) game.openHome(); // T22
    else game.ui.toast('Look at something to use this button!');
  },
  // a held Kick! / Shoot! starts when the finger goes down on the big button and flies when it comes up (touch.js)
  actPress: () => !game.ui.asking && playing() && !!target.near && game.gymLive.holds(game.player) && game.gymLive.use(game.player),
  actRelease: () => game.gymLive.release(game.player),
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
    ui.toast(`${npc.name}: Your team is fully healed. ${game.world.realm ? 'Sweet dreams... I mean, good luck!' : 'Good luck out there!'}`); // T35
    return;
  }
  if (npc.kind === 'tower') { talkTower(npc); return; }
  if (npc.kind === 'boss' || npc.kind === 'crew') { if (!game.gymLive.talk(npc)) game.bosses.talk(npc); return; } // T40: a live part (the race) may take the talk first
  if (npc.kind === 'guest' && !npc.gym) { if (!game.gymLive.talk(npc)) ui.toast(`${npc.name}: ${npc.def?.line || 'Hello!'}`); return; } // T43: a Picture World guest (Ticket Tess)
  const gym = npc.gym.def;
  const closed = game.access.of(npc.gym).closedText(npc);
  if (closed) { ui.toast(closed); return; }
  if (npc.disguise && game.npcs.reveal(npc)) ui.toast(`That stone pillar was ${npc.name}!`);
  if (game.gymLive.talk(npc)) return; // T33: the Restaurant's Chef and customers
  if (npc.kind === 'guest') { ui.toast(`${npc.name}: ${npc.def?.line || 'Hello!'}`); return; } // T33: people with one line
  const list = trainersOf(gym), where = gym.leaderWhere || 'at the back';
  if (npc.kind === 'trainer') {
    const i = npc.index || 0;
    if (game.beaten.includes(trainerKey(gym, i))) {
      ui.toast(`${npc.name}: You already beat me! ${gym.leader.name} is waiting ${where}.`);
      return;
    }
    startBattle({ trainer: npc, team: list[i].team, intro: list[i].intro || [`You want to see ${gym.leader.name}? Get past me first!`] });
    return;
  }
  const todo = list.filter((p, i) => !game.beaten.includes(trainerKey(gym, i))).map(p => p.name);
  if (todo.length) {
    ui.toast(`${npc.name}: Beat ${todo.join(' and ')} first, then come back to me!`);
    return;
  }
  if (game.badges.includes(gym.id)) { game.rematch.offer(npc); return; } // T28: asked first, then a harder team
  startBattle({ trainer: npc, team: gym.leaderTeam, intro: gym.intro });
}

// People in the Champion's Tower: two guards, Coach Dex and the Champion. All wait for every badge (since T19 also old Champions).
function talkTower(npc) {
  const ui = game.ui;
  if (game.badges.length < GYMS.length) {
    ui.toast(`${npc.name}: ${TOWER.locked(game.badges.length, game.champion)}`);
    return;
  }
  const p = game.world.tower.people.find(q => q.role === npc.role);
  if (npc.role === 'coach') {
    const top = Math.max(...game.party.map(c => c.level));
    const lv = Math.max(25, Math.min(64, top)); // wave 14: up to the Picture World Bosses' levels (62-65)
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
  if (npc.role === 'champion' && game.champion) { game.missions.desk(() => championBattle(npc, p)); return; } // T29: missions + rematch
  championBattle(npc, p);
}

function championBattle(npc, p) {
  const team = p.team.map(([s, l]) => [s, Math.min(REMATCH_CAP, l + (game.champion ? 3 : 0))]);
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
    if (first) ui.toast('Talk to Champion Solenne again: she has missions for you!'); // T29
    if (first) ui.toast('A Portal Door opened beside the tower door! Step through it.'); // T38a
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
  if (game.hideSeek?.blocksBattle(opts)) return; // T30
  if (!opts.duel && !game.party.some(c => c.hp > 0)) {
    game.ui.toast('Your team is too tired to battle. Let them rest a moment.');
    return;
  }
  game.riding.stop('battle');
  game.inBattle = true;
  // Close anything that could cover the battle (the team screen, Blocks, the Book), and answer
  // "busy" to a battle invite that is still showing.
  game.ui.closePanel();
  game.ui.closeAsk();
  if (!opts.duel) game.duels.busy();
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
  if (game.hostLeft) setTimeout(goHome, 2500); // the host left during the battle
  if (opts.duel) {
    if (opts.duel.coop) { game.duels.finish(); game.duels.lastResult = result; game.missions.coopEnded(result, opts.duel); game.ui.renderHud(); save(true); afterOverlay(); return; } // T29: co-op boss
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
    if (game.place !== MAIN) game.realms.lost(); // T31: losing in a realm wakes you up in your bed (T40: a Picture World keeps you there)
    else {
      game.player.pos.copy(game.spawnPoint);
      game.player.vel.set(0, 0, 0);
    }
    if (opts.trainer?.kind === 'tower') game.ui.toast(TOWER.people.at(-1).hint);
    if (opts.rematch) game.rematch.lost(opts.trainer);
    if (opts.picture) game.bosses.lost(opts.trainer, opts); // T40
  }
  if (result === 'caught' && opts.wild) for (const id of opts.wild.data.traits || []) if (TRAITS[id]?.caught) game.ui.toast(TRAITS[id].caught(SPECIES[opts.wild.data.species].name));
  const npc = opts.trainer;
  if (result === 'won' && npc?.kind === 'tower') towerWon(npc);
  else if (result === 'won' && opts.picture) game.bosses.won(npc, opts); // T40: a Picture World Boss or helper
  else if (result === 'won' && npc) {
    const gym = npc.gym.def;
    if (npc.kind === 'trainer') {
      game.beaten.push(trainerKey(gym, npc.index || 0));
      sound.play('win');
      game.cubes += 2;
      game.ui.toast(`${npc.name}: Nice battle! ${gym.leader.name} is waiting ${gym.leaderWhere || 'at the back'}.`);
      game.ui.toast('You got 2 Capture Cubes.');
    } else if (opts.rematch) {
      game.rematch.won(npc, opts);
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
    }
  }
  game.gymLive.battleEnded(result, opts); // T33
  game.ui.renderHud();
  save(true);
  afterOverlay();
};

/* ------------------------------- main loop ------------------------------- */

const target = { wild: null, npc: null, player: null, block: null, near: null };
let regenTimer = 0;
let saveTimer = 0;
let cloudTimer = 0;
let hudTimer = 0;
let last = performance.now();
let underFade = 0; // 0 on the surface, 1 underground (eased)
const CAVE_DARK = new THREE.Color(0x07080c);
const REALM_SKY = new THREE.Color(); // T31

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

let cityDimE = 1; // (eased: swimming from a dark district into a lit one fades)
let uwFade = 0; // T41
const UW_COLOR = new THREE.Color(), UW_DEEP = new THREE.Color();
function updateSky(dt) {
  game.time = (game.time + dt / DAY_LENGTH * (game.world?.realm?.timeSpeed ?? 1)) % 1; // a realm may run its clock slower (Dream nights last twice as long)
  const elevation = Math.sin(game.time * Math.PI * 2);
  const light = smoothstep(-0.2, 0.25, elevation);
  const brightness = 0.25 + 0.75 * light;
  const wx = game.weather.sky(light);
  scene.background.copy(NIGHT_SKY).lerp(DAY_SKY, light);
  scene.background.lerp(GOLDEN_SKY, 0.55 * (1 - smoothstep(0.35, 0.6, Math.abs(elevation)))); // orange around sunrise and sunset
  scene.background.lerp(wx.tint, wx.amount);
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
  // A soft tick-tock when the golden hour starts (no text).
  const gh = under ? null : goldenHour(game.time);
  if (gh && gh !== game.golden && game.started && !game.inBattle) sound.play('ticktock');
  game.golden = gh;
  underFade += ((under ? 1 : 0) - underFade) * Math.min(1, dt * 1.5);
  scene.background.lerp(CAVE_DARK, underFade);
  scene.fog.color.copy(scene.background);
  scene.fog.near = wx.fogNear; scene.fog.far = wx.fogFar + (40 - wx.fogFar) * underFade;
  const look = game.world.realm?.look; // T31: a realm's own sky colour and fog
  if (look) {
    if (look.still) scene.background.copy(game.swirlSky?.fog ?? REALM_SKY.setHex(look.sky)); // T38a: the Swirl's sky never changes (the main clock keeps running); T38d: it follows the zone
    else scene.background.lerp(REALM_SKY.setHex(look.sky).multiplyScalar(0.4 + 0.6 * light), 0.7);
    scene.fog.color.copy(scene.background);
    if (game.swirlSky?.fog) { scene.fog.near = game.swirlSky.near; scene.fog.far = game.swirlSky.far; }
    else if (look.fog) { scene.fog.near = look.fog[0]; scene.fog.far = look.fog[1]; }
  }
  // T41: under water in the Sunken City the fog turns blue-green and closes in with depth (the rest of the Pirate Seas swims as before)
  const eyeY = game.player.pos.y + game.player.eye;
  const uwNow = look?.underwater && game.world.deepAt?.(game.player.pos) && game.world.get(Math.floor(game.player.pos.x), Math.floor(eyeY), Math.floor(game.player.pos.z)) === B.WATER;
  uwFade += ((uwNow ? 1 : 0) - uwFade) * Math.min(1, dt * 6);
  const depth = Math.min(1, Math.max(0, (13 - eyeY) / 11));
  if (uwFade > 0.01) {
    UW_COLOR.setHex(0x2aa0b0).lerp(UW_DEEP.setHex(0x0e4a62), depth);
    scene.background.lerp(UW_COLOR, uwFade);
    const cityDim = game.world.skyDim ? game.world.skyDim(Math.floor(game.player.pos.x), Math.floor(game.player.pos.y), Math.floor(game.player.pos.z)) : 1; // owner 2026-10-27: the dark districts' water is dark too
    cityDimE += (cityDim - cityDimE) * Math.min(1, dt * 2);
    if (cityDimE < 0.999) scene.background.multiplyScalar(1 - (1 - cityDimE) * 0.75 * uwFade);
    scene.fog.color.copy(scene.background);
    scene.fog.near += (1.5 - scene.fog.near) * uwFade;
    scene.fog.far += ((34 - 12 * depth) - scene.fog.far) * uwFade;
  }
  const floor = game.swirlSky?.lit ?? look?.light ?? 0; // T35: a realm's lowest brightness (the Dream is only visited at night: keep it bright)
  const roomDim = game.lightsDim ?? 1; // T48: a live part may dim the lights for a moment (the Surprise Party's "Lights out!")
  const lit = (look?.still ? floor : Math.max(floor, Math.min(1, brightness * wx.dim + wx.flash * 0.4))) * roomDim; // T38a: a still realm is always the same brightness
  caveLight.uLit.value = lit;
  caveLight.uLantern.value = Math.max(0.75 * underFade, game.netGlow ?? 0); // T41: the net's glow lights the Sunken City
  caveLight.uPlayer.value.copy(game.player.eyePos);
  const lightF = look?.still ? floor : Math.max(light, floor);
  const uwDim = 1 - 0.45 * uwFade * (0.4 + 0.6 * depth); // T41: the deeper in the Sunken City, the dimmer the light
  hemi.intensity = (0.35 + 1.0 * lightF) * (1 - 0.6 * underFade) * uwDim * roomDim;
  sun.intensity = (0.1 + 1.1 * lightF) * (1 - 0.6 * underFade) * uwDim * roomDim;
  if (roomDim < 0.999) { scene.background.multiplyScalar(0.3 + 0.7 * roomDim); scene.fog.color.copy(scene.background); }
  const hours = (game.time * 24 + 6) % 24;
  const hh = String(Math.floor(hours)).padStart(2, '0');
  const mm = String(Math.floor((hours % 1) * 60 / 10) * 10).padStart(2, '0');
  game.ui.setClock(game.world.realm ? (game.world.realm.clock || '☾ Dream') : `${light > 0.5 ? '☀' : '☾'} ${hh}:${mm}${game.weather.icon}${under ? ' · Cave' : ''}`); // T35: no hours in a dream, the moon shows how long the night lasts
  game.ui.setMoon(game.world.realm?.moon ? nightProgress(game.time) : null); // T38a: only the Dream has the moon
  game.night = light < 0.3;
  game.npcs.setNight(game.night); // the night gyms' people (Comet, Saucer) come and go with the night
}

let mpHud = null;
game.access = createAccess(game, { dayLength: DAY_LENGTH, smoothstep });
game.rematch = createRematch(game, { startBattle }); // T28
createBosses(game, { startBattle, save }); // T40 -> game.bosses
game.missions = createMissions(game, { save }); // T29
game.missionSeed = () => game.homeWorld?.seed ?? game.realms?.mainPart()?.seed ?? game.world.seed; // T38c: the maker's seed is your own main world's, never a visited world's or a realm's
game.riding = createRiding(game, { scene, closePanel: () => { if (game.ui.panelOpen) togglePanel(); } }); // T27
game.hideSeek = createHideSeek(game); // T30
game.realms = createRealms(game, { createWorld, save, size: [WORLD_W, WORLD_D] }); // T31
game.portal = createPortal(game); // T38a: the Portal Door and the Swirl's doors
game.swirlSky = createSwirlSky(game, { scene, camera }); // T38d: the Swirl's sky, puffs and oddities
game.sketch = createSketch(game, { materials, texture, atlas }); // T45: the Sketchbook's pencil look
game.gymLive = createGymLive(game); // doors and lasers that change while you play (T19)
const { updateGuide } = createGuide(game);
game.nav = createNav(game); // T39a: the place the guide follows (no choice = the next gym)
game.navUi = createNavUi(game); // T39a

// T22: the prompt while you stand on a Doormat and look at nothing else.
function homePrompt() {
  if (!game.homes.matPos) return '';
  const h = game.homes.onMat;
  const who = !h || h.owner === game.playerId ? 'Your home' : `${h.name || 'A friend'}'s home`;
  return touchMode ? who : `${who} · press H`;
}

// T28: a gym leader whose badge you already hold offers a rematch.
const isChampDesk = npc => npc.kind === 'tower' && npc.role === 'champion' && game.champion && game.badges.length >= GYMS.length; // T29
const isRematch = npc => npc.kind === 'leader' && !!npc.gym && game.badges.includes(npc.gym.def.id);

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
  target.near = !target.player && !target.npc && !target.wild ? game.gymLive.near(game.player) : null; // T40: a live part's word, e.g. "Fire!"
  const dis = target.wild?.disguise; // a disguised creature gets the same outline as a real block (no tell)
  if (dis) {
    highlight.visible = true;
    highlight.scale.setScalar(target.wild.size);
    highlight.position.set(target.wild.pos.x, target.wild.pos.y + target.wild.size / 2, target.wild.pos.z);
  } else if (target.npc?.disguise) { // a disguised trainer is outlined like the stone it pretends to be
    highlight.visible = true;
    highlight.scale.set(1, 2, 1);
    highlight.position.set(target.npc.pos.x, target.npc.pos.y + 1, target.npc.pos.z);
  } else if (target.block && !BLOCKS[target.block.id]?.hidden) { // T40a.5: a hidden block is under a model: no box outline
    highlight.visible = true;
    highlight.scale.setScalar(1);
    highlight.position.set(target.block.x + 0.5, target.block.y + 0.5, target.block.z + 0.5);
  } else highlight.visible = false;
  const how = touchMode ? 'tap' : 'click or E';
  const talk = target.npc && (game.gymLive.talkPrompt(target.npc) ?? game.bosses.talkPrompt(target.npc)); // T33, T40
  const door = target.block && game.portal.prompt(target.block, how); // T38a: a Portal Door, a picture frame...
  game.ui.setPrompt(target.player ? (game.hideSeek.prompt(target.player, how) ?? `${target.player.name} · ${how} to ask for a battle`)
    : target.npc ? `${target.npc.title} · ${how} to ${talk?.verb ?? (target.npc.kind === 'healer' ? 'heal' : isChampDesk(target.npc) ? 'get missions' : isRematch(target.npc) ? 'ask for a rematch' : 'challenge')}`
    : target.wild?.wrapped ? `A gift box! 🎁 · ${how} to open` // T44
    : target.wild ? `${target.wild.species.name} Lv${target.wild.data.level} · ${how} to battle`
      : target.near ? `${game.gymLive.holds(game.player) ? (touchMode ? 'Hold and let go' : 'Hold E and let go') : touchMode ? 'Tap' : 'Press E'} to ${target.near.replace(/!$/, '').toLowerCase()}` // T40 (Kick! / Shoot! are held)
      : target.block?.id === B.CHEST ? `Treasure chest · ${how} to open`
      : target.block?.id === B.WAKE_STONE ? `Wake Stone · ${how} to wake up` // T31
      : door ? door // T38a
      : target.block?.id === B.BED && game.place === MAIN ? `Bed · ${touchMode ? 'tap' : 'press E'} to sleep`
      : (target.block && game.gymLive.prompt(target.block, how)) || homePrompt());
  // T39c: the fixed-slot buttons. The action button's word says what it will do; the rest dim, never hide.
  const p = game.player;
  const reach = target.block && target.block.t <= REACH;
  let act = target.player ? (game.hideSeek.action(target.player) ?? 'Battle!')
    : target.npc ? (talk?.action ?? (target.npc.kind === 'healer' ? 'Heal' : isChampDesk(target.npc) ? 'Missions!' : isRematch(target.npc) ? 'Rematch!' : target.npc.kind === 'guest' || target.npc.kind === 'tower' ? 'Talk' : 'Battle!'))
    : target.wild?.wrapped ? 'Open!' // T44
    : target.wild ? 'Battle!'
      : target.near ? target.near // T40: a live part's own word ("Fire!", "Kick!")
      : target.block?.id === B.CHEST ? 'Open'
      : target.block?.id === B.WAKE_STONE ? 'Wake up'
      : door ? game.portal.action(target.block) // T38a
      : target.block?.id === B.BED && game.place === MAIN ? 'Sleep' // T31
      : (target.block && game.gymLive.prompt(target.block, 'tap') && (game.gymLive.action(target.block) || 'Press')) || (reach ? 'Break' : game.homes.matPos ? 'My home' : 'Break');
  let dim = !(target.player || target.npc || target.wild || target.near || reach || game.homes.matPos);
  if (game.ui.asking) { act = game.ui.asked.yes; dim = false; } // T39b: the action button answers yes and says so
  const id = game.hotbar[game.selected];
  const noneLeft = isLimited(id) && !game.blockCounts[id];
  const placeWhy = !target.block ? 'Look at a block to build on it!' : noneLeft ? `No ${BLOCKS[id].name} left! ${BLOCKS[id].getMore || 'Mine one in a cave wall, or break one you placed.'}` : '';
  game.touchWhy.place = placeWhy;
  const riding = game.riding, have = game.party.some(c => rideKind(c));
  const rideWhy = riding.on ? '' : game.world.realm?.noRide ? game.world.realm.noRide : game.hideSeek?.active ? 'No riding in hide and seek!'
    : !riding.first() ? 'Your rideable friends are too tired. Visit Healer Hana!'
    : game.world.fenceAt(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)) ? 'No riding right here. Walk a little further first!' : '';
  game.touchWhy.ride = rideWhy;
  game.touch.setButtons({
    act: { label: act, dim },
    place: { dim: !!placeWhy, why: placeWhy },
    ride: { have: have || riding.on, dim: !!rideWhy, why: rideWhy, on: riding.on },
    sky: riding.on && riding.kind === 'sky',
    swim: !!p.diving, // T41: Jump says Swim in the Sunken City
    jump: p.carry?.jumpWord?.() ?? null, // T49: a ride may name the Jump button (the Castle: Shield, Off)
  });
}

let fireAt = 0, fireK = 0, portalAt = 0, portalK = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const p = game.player;

  if (!game.started) {
    // Slow fly-over for the title screen.
    const t = now / 1000 * 0.05;
    camera.position.set(MID_X + Math.cos(t) * 45, 40, MID_Z + Math.sin(t) * 45);
    camera.lookAt(MID_X, 14, MID_Z);
    game.creatures.update(dt, new THREE.Vector3(MID_X, 0, MID_Z), game.spawnPoint, false, false);
  } else {
    p.joy = game.touch.joy;
    const before = p.pos.clone(); // T30
    if (playing()) p.update(dt);
    if (p.bounced) { p.bounced = false; sound.play('boing'); game.realms.onBounce(); } // T35: launched by a Bounce Block
    if (p.trampolined) { p.trampolined = false; sound.play('boing'); } // T43: a trampoline of the Funfair (no Dream hint)
    game.hideSeek.fence(p.pos, before, p.vel); // T30
    game.riding.update(dt, now);
    game.gymLive.update(dt);
    game.rematch.update();
    game.bosses.update(); // T40
    game.missions.update(dt); // T29
    game.realms.update(); // T31: morning wakes you up
    game.portal.update(dt); // T38a
    if (p.onGround) {
      const fx = Math.floor(p.pos.x), fy = Math.floor(p.pos.y - 0.05), fz = Math.floor(p.pos.z);
      const under = game.world.get(fx, fy, fz);
      game.gymLive.stand(fx, fy, fz, under);
      const st = game.homes.stand(fx, fy, fz, under); // T30.5: no chooser; an orphan mat becomes your home
      if (st && playing()) { if (st === 'orphan') game.homes.claim(fx, fy, fz); game.openHome('types'); }
    }
    game.homes.update(dt, p.pos);
    if (p.pos.y < -20) { p.pos.copy(game.spawnPoint); p.vel.set(0, 0, 0); }
    game.world.updateDirty();
    game.creatures.update(dt, p.pos, game.spawnPoint, game.night);
    game.npcs.update(dt, p.pos);
    game.mp.update(dt);
    game.hideSeek.update(dt); // T30
    if (game.battle.allyModel) animateModel(game.battle.allyModel, now / 1000, false);
    if (game.battle.friendModel) animateModel(game.battle.friendModel, now / 1000 + 2, false); // T29: the co-op friend's creature
    if (game.battle.trainer && game.battle.foeModel) animateModel(game.battle.foeModel, now / 1000 + 1, false);

    camera.position.copy(p.eyePos);
    camera.rotation.set(p.pitch, p.yaw, 0);
    const viewQ = p.viewQuat?.(); if (viewQ) camera.quaternion.premultiply(viewQ); // Cube Planets: the camera's up eases to the face you stand on (null everywhere else)
    if (!game.inBattle) updateTarget();
    game.weather.update(dt, now);
    updateSky(dt);
    game.swirlSky.update(dt, now); // T38d
    game.sketch.update(dt, now); // T45

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
      const hud = mpHud || (mpHud = document.getElementById('mp-hud'));
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

  if (game.world?.hasFire && !game.sketch?.on && now - fireAt > 140) { // T22: flames; only the 16x16 Fireplace tile goes to the GPU
    fireAt = now;
    const f = flickerFire(atlas, ++fireK);
    if (f) {
      const src = fireTiles.get(f.frame) ?? new THREE.DataTexture(f.frame.data, f.frame.width, f.frame.height);
      fireTiles.set(f.frame, src);
      firePos.set(f.x, f.y);
      renderer.copyTextureToTexture(firePos, src, texture);
    }
  }
  if (game.world?.hasPortal && !game.sketch?.on && now - portalAt > 160) { // T38a: the Portal Door's spiral turns; only its 16x16 tile goes to the GPU
    portalAt = now;
    const f = swirlPortal(atlas, ++portalK);
    if (f) {
      const src = portalTiles.get(f.frame) ?? new THREE.DataTexture(f.frame.data, f.frame.width, f.frame.height);
      portalTiles.set(f.frame, src);
      portalPos.set(f.x, f.y);
      renderer.copyTextureToTexture(portalPos, src, texture);
    }
  }
  game.homeUi.update(now);
  game.fx.update(now);
  game.world?.cull(camera.position, scene.fog.far);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => save());
document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });

/* ----------------------------- play together ----------------------------- */

const { goHome } = createPlayTogether(game, { createWorld, save, pushCloud, startBattle, pauseEl, resume });

showTitle();
requestAnimationFrame(frame);
initAccount();

// Exposed for debugging from the browser console.
game.playing = playing; // T30 (a function; T40: live parts call game.playing() to freeze their own clocks while paused)
window.pokecraft = game;
game.sound = sound;
game.updateGuide = updateGuide;
game.save = save;
game.talkTo = talkTo;
game.startBattle = startBattle;
game.interact = interact;
game.breakBlock = breakBlock;
game.placeBlock = placeBlock;
