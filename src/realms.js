// T31 realms: small separate worlds (own seed-made terrain) you travel to and back from; only one place is loaded at a
// time. The registry is data; the first realm is a bare-bones Dream (T35 adds creatures, a gym and polish). You reach it
// by sleeping at night in the Bed of your own finished cozy home, and wake up beside that Bed: at the Wake Stone, in
// the morning, or after losing a battle. The main world never changes (realms only ever build their own World).
import { B, WOOL, mulberry32 } from './blocks.js';

export const MAIN = 'main';
export const REALMS = {
  dream: {
    id: 'dream', name: 'Dream realm', size: [64, 64],
    seedSalt: 0xd2ea,                   // realm seed = realmSeed(mainSeed, salt)
    terrain: 'dreamIsland',             // key into TERRAINS
    biome: 'dream',                     // world.biome() everywhere in the realm
    spawns: { dream: [['dreamlet', 3], ['snoozle', 3], ['moonhop', 2], ['twinklet', 1]] }, // T35 adds its own creatures
    walk: [WOOL.pixie, WOOL.mind, B.CLOUD], // blocks wild creatures walk on here
    gyms: [],                           // realm gyms (each with `protect`), none yet
    look: { sky: 0x6a4fb0, fog: [28, 70], time: null /* null = the main clock */, weather: false },
    arrive: [32, 32],
    enterText: 'You fall asleep... and dream!',
  },
};
REALMS.dream.spawns.cave = REALMS.dream.spawns.dream; // digging into the island: the same dreamers

export function realmSeed(mainSeed, salt) { return Math.imul((mainSeed ^ salt) | 0, 2654435761) >>> 0; }
// Night by the clock (the same moment main.js's game.night turns on: light < 0.3); read straight from game.time,
// so a game loaded in a realm by day wakes up only after the clock is known.
export const isNight = t => Math.sin(t * Math.PI * 2) < -0.04;
export function realmOf(id) { return Object.hasOwn(REALMS, id) ? REALMS[id] : null; }

// Small value noise of its own (world.js imports this file, so no import back).
function hash(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed), c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Terrain builders: (world, def) fill world.data / world.ground and set world.wake (the Wake Stone cell). Writes go
// straight into data (not edits), like the main terrain.
export const TERRAINS = {
  // A floating island of pink and purple wool over a cloud underside, crystal flowers, candy trees, cloud puffs.
  dreamIsland(world, def) {
    const { W, D, seed } = world, [cx, cz] = def.arrive, TOP = 22;
    const put = (x, y, z, id) => { if (world.inBounds(x, y, z)) world.data[world.index(x, y, z)] = id; };
    const rand = mulberry32(seed);
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const d = Math.hypot(x - cx, z - cz), edge = 19 + noise(x / 7, z / 7, seed + 1) * 9;
        if (d > edge) continue;
        const k = 1 - d / edge;
        const h = TOP + Math.round(noise(x / 9, z / 9, seed + 2) * 3 * k);
        const depth = 2 + Math.round(k * 10 + noise(x / 5, z / 5, seed + 3) * 3);
        world.ground[x + z * W] = h;
        const top = noise(x / 6 + 50, z / 6 + 50, seed + 4) > 0.55 ? WOOL.mind : WOOL.pixie;
        for (let y = h - depth; y <= h; y++) put(x, y, z, y === h ? top : y > h - 3 ? WOOL.sky : B.CLOUD);
      }
    }
    const surf = (x, z) => world.ground[x + z * W];
    const onTop = (x, z) => world.get(x, surf(x, z), z) !== B.AIR && Math.hypot(x - cx, z - cz) > 4;
    for (let x = 2; x < W - 2; x++) {
      for (let z = 2; z < D - 2; z++) {
        if (!onTop(x, z)) continue;
        const r = hash(x, z, seed + 9), y = surf(x, z) + 1;
        if (r < 0.012) { // a candy tree: a light trunk and a ball of pixie and light wool
          const t = 3 + Math.floor(r * 200);
          for (let i = 0; i < t; i++) put(x, y + i, z, WOOL.paper);
          for (let a = -2; a <= 2; a++) for (let b = -1; b <= 2; b++) for (let c = -2; c <= 2; c++) {
            if (a * a + (b - 0.5) ** 2 + c * c <= 5.5 && world.get(x + a, y + t + b, z + c) === B.AIR) put(x + a, y + t + b, z + c, (a + b + c) & 1 ? WOOL.pixie : WOOL.light);
          }
        } else if (r < 0.04) put(x, y, z, B.CRYSTAL);
        else if (r < 0.055) put(x, y, z, B.GLOWCAP);
      }
    }
    for (let i = 0; i < 9; i++) { // cloud puffs around the island
      const a = rand() * Math.PI * 2, d = 24 + rand() * 6, px = Math.round(cx + Math.cos(a) * d), pz = Math.round(cz + Math.sin(a) * d), py = 16 + Math.floor(rand() * 16);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) + Math.abs(dz) < 3 && px + dx > 0 && pz + dz > 0 && px + dx < W - 1 && pz + dz < D - 1) put(px + dx, py, pz + dz, B.CLOUD);
    }
    // The Wake Stone: 5 blocks east of where you arrive, on the ground, with two lamps beside it.
    const wx = cx + 5, wz = cz, wy = surf(wx, wz) + 1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = wy; y < wy + 4; y++) put(wx + dx, y, wz + dz, B.AIR);
    put(wx, wy, wz, B.WAKE_STONE);
    world.wake = [wx, wy, wz];
  },
};

// Builds a realm's terrain into a World whose `realm` is set (world.generate() calls this).
export function generateRealm(world) {
  const def = world.realm;
  TERRAINS[def.terrain](world, def);
  world.gyms = [];
  world.tower = null;
  world.caves = null;
  world.walk = new Set(def.walk || []);
}

// Which home Bed lets you dream: a Bed inside one of YOUR homes that is finished as a cozy home.
function bedHome(game, x, y, z) {
  return game.homes.list.find(h => h.owner === game.playerId && h.types.includes('cozy') && h.report?.inside?.some(([ix, iz]) => ix === x && iz === z)
    && y > h.report.f && y <= h.report.f + 3) ?? null;
}

// Where you wake up: a free cell beside the Bed (or on it).
function besideBed(game, [x, y, z]) {
  const p = game.player, v = p.pos.clone();
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    v.set(x + dx + 0.5, y, z + dz + 0.5);
    if (!p.collides(v)) return [v.x, v.y, v.z];
  }
  return [x + 0.5, y + 1, z + 0.5];
}

// deps: createWorld(seed, edits, size, { realm }), save(important), WORLD size [W, D] of the main world.
export function createRealms(game, { createWorld, save, size }) {
  let stash = null;      // the main world while you are in a realm: { seed, edits, homes, owner, ret: [x, y, z, yaw, pitch] }
  let busy = false;      // travelling right now
  let asked = false;     // our 'Go to sleep?' box is showing
  const overlay = () => document.getElementById('travel');
  const show = text => { const o = overlay(); if (!o) return; o.querySelector('.travel-text').textContent = text; o.classList.remove('hidden'); };
  const hide = () => overlay()?.classList.add('hidden');
  const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));

  function why() { // the reason travel is not possible now, or ''
    if (busy) return 'Wait a moment...';
    if (game.inBattle || game.duels?.incoming) return 'Finish the battle first!';
    if (game.hideSeek?.active) return 'Not during hide and seek!';
    return '';
  }

  const self = {
    get place() { return game.place; },
    get stash() { return stash; },
    get busy() { return busy; },
    realm() { return realmOf(game.place); },

    // The main world's save part while in a realm (snapshot, and the host's `world` message).
    mainPart() {
      if (!stash) return null;
      const [x, y, z, yaw, pitch] = stash.ret;
      return { seed: stash.seed, edits: stash.edits, size, pos: [x, y, z], yaw, pitch, homes: stash.homes, owner: stash.owner };
    },
    // Edits of every realm, the current one up to date.
    edits() {
      const out = { ...game.realmEdits };
      if (game.place !== MAIN && game.world?.realm) out[game.place] = [...game.world.edits];
      return out;
    },
    // A home message from a friend while you are away: keep it for the main world.
    stashHome(rec) {
      if (!stash || !rec || typeof rec.owner !== 'string') return;
      stash.homes = [...stash.homes.filter(h => h.owner !== rec.owner && !(h.x === rec.x && h.y === rec.y && h.z === rec.z)), rec];
    },

    // A friend's block edit in the main world while you are away (applyEdits drops gym cells when you wake up).
    stashBlock({ x, y, z, b }) {
      if (!stash || ![x, y, z, b].every(Number.isInteger) || x < 0 || z < 0 || y < 0 || x >= size[0] || z >= size[1] || y >= 48) return;
      const i = x + size[0] * (z + size[1] * y);
      stash.edits = stash.edits.filter(e => e[0] !== i);
      stash.edits.push([i, b]);
    },

    // The prompt / action for a Bed you look at ('' = nothing to say).
    bedPrompt(how) { return game.place === MAIN ? `Bed · ${how} to sleep` : ''; },

    // You used a Bed: dream (night, your own cozy home's bed) or a toast that says why not.
    useBed(hit) {
      if (game.place !== MAIN) return false;
      if (game.mp?.role === 'guest') { game.ui.toast('You can dream in your own world. Sleep tight!'); return true; }
      const home = bedHome(game, hit.x, hit.y, hit.z);
      if (!home) { game.ui.toast('To dream, sleep in the Bed of your own cozy home.'); return true; }
      if (!isNight(game.time)) { game.ui.toast('You can only dream at night.'); return true; }
      const no = why();
      if (no) { game.ui.toast(no); return true; }
      if (asked && game.ui.asking) { game.ui.askYes(); return true; } // use the bed again = yes
      asked = true;
      game.ui.ask({ text: 'Go to sleep and dream?', yes: 'Sleep', no: 'Not now', hint: 'press Y / N', onYes: () => { asked = false; self.enter('dream', { bed: [hit.x, hit.y, hit.z] }); }, onNo: () => { asked = false; } });
      return true;
    },

    // Travel to a realm. opts.bed: the Bed cell (you wake up beside it). Returns a promise of true when you arrived.
    async enter(id, { bed } = {}) {
      const def = realmOf(id);
      const no = !def ? 'There is no such place.' : game.place !== MAIN ? 'You are already away!' : why();
      if (no) { game.ui.toast(no); return false; }
      busy = true;
      const p = game.player, w = game.world;
      const back = bed ? besideBed(game, bed) : [p.pos.x, p.pos.y, p.pos.z];
      stash = { seed: w.seed, edits: [...w.edits], homes: game.homes.toSave(), owner: game.homes.worldOwner, ret: [...back, p.yaw, p.pitch] };
      game.riding?.stop('quiet');
      game.ui.closeAsk?.();
      show(id === 'dream' ? 'Dreaming...' : 'Travelling...');
      await frame();
      try {
        createWorld(realmSeed(stash.seed, def.seedSalt), game.realmEdits[id], def.size, { realm: def });
        game.place = id;
        game.player.pos.copy(game.spawnPoint);
        game.player.yaw = -Math.PI / 2; game.player.pitch = 0; // facing the Wake Stone
        game.weather.snap?.();
      } finally { busy = false; hide(); }
      game.ui.toast(def.enterText || `Welcome to the ${def.name}!`);
      game.ui.toast('Touch the glowing Wake Stone to wake up.');
      game.mp?.sendState();
      save(true);
      return true;
    },

    // Back to the main world, beside the Bed. reason: 'stone' | 'morning' | 'lost' | 'quiet'.
    async leave(reason = 'stone') {
      if (game.place === MAIN || !stash || busy) return false;
      busy = true;
      game.realmEdits = self.edits();
      game.riding?.stop('quiet');
      show('Waking up...');
      await frame();
      const s = stash;
      try {
        createWorld(s.seed, s.edits, size);
        game.homes.load(s.homes, s.owner);
        game.npcs.undisguise(key => game.beaten.includes(key));
        game.place = MAIN;
        stash = null;
        const p = game.player, [x, y, z, yaw, pitch] = s.ret;
        p.pos.set(x, y, z); p.vel.set(0, 0, 0);
        if (p.collides(p.pos)) p.pos.copy(game.spawnPoint);
        p.yaw = yaw; p.pitch = pitch;
        game.weather.snap?.();
      } finally { busy = false; hide(); }
      const words = { stone: 'You woke up in your bed. What a dream!', morning: 'Good morning! You woke up in your bed.', lost: 'Oh! You woke up in your bed. Your team is rested.' };
      if (words[reason]) game.ui.toast(words[reason]);
      game.mp?.sendState();
      save(true);
      return true;
    },

    // From a save: { place, realmPos, realmEdits } plus the main part. Loads the realm when the save was made in one.
    // Call after the main world exists and the player stands at the main return spot.
    restore(saved) {
      game.realmEdits = cleanRealmEdits(saved?.realmEdits);
      const def = realmOf(saved?.place);
      game.place = MAIN;
      stash = null;
      if (!def || saved.place === MAIN) return false;
      const p = game.player, w = game.world;
      stash = { seed: w.seed, edits: [...w.edits], homes: game.homes.toSave(), owner: game.homes.worldOwner, ret: [p.pos.x, p.pos.y, p.pos.z, p.yaw, p.pitch] };
      createWorld(realmSeed(w.seed, def.seedSalt), game.realmEdits[def.id], def.size, { realm: def });
      game.place = def.id;
      const rp = saved.realmPos;
      const np = game.player;
      if (Array.isArray(rp) && rp.slice(0, 3).every(Number.isFinite)) { np.pos.set(rp[0], rp[1], rp[2]); np.yaw = rp[3] || 0; np.pitch = rp[4] || 0; }
      else np.pos.copy(game.spawnPoint);
      if (np.collides(np.pos)) np.pos.copy(game.spawnPoint);
      return true;
    },

    // Every frame: morning wakes you up.
    update() {
      if (game.place === MAIN || busy || game.inBattle || !game.started) return;
      if (!isNight(game.time)) self.leave('morning');
    },

    // The title screen / a new game: forget everything.
    reset() { stash = null; busy = false; game.place = MAIN; hide(); },
  };
  game.place = MAIN;
  game.realmEdits = {};
  return self;
}

// realmEdits from a save: only known realms, only [index, block] pairs of whole numbers.
export function cleanRealmEdits(saved) {
  const out = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const [id, list] of Object.entries(saved)) {
    const def = realmOf(id);
    if (!def || !Array.isArray(list)) continue;
    const max = def.size[0] * def.size[1] * 48;
    out[id] = list.filter(e => Array.isArray(e) && Number.isInteger(e[0]) && Number.isInteger(e[1]) && e[0] >= 0 && e[0] < max && e[1] >= 0 && e[1] < 256);
  }
  return out;
}
