// T31 realms: small separate worlds (own seed-made terrain) you travel to and back from; only one place is loaded at a
// time. The registry is data; the first realm is a bare-bones Dream (T35 adds creatures, a gym and polish). You reach it
// by sleeping at night in the Bed of your own finished cozy home, and wake up beside that Bed: at the Wake Stone, in
// the morning, or after losing a battle. The main world never changes (realms only ever build their own World).
import { B, WOOL } from './blocks.js';
import { GYMS } from './gyms.js';
import { dreamLand } from './dreamland.js';
import { buildDreamHouse } from './dreamhouse.js';
import { swirlLand, swirlAim } from './swirlland.js'; // T38a

export const MAIN = 'main';
export const REALMS = {
  dream: {
    id: 'dream', name: 'Dream realm', version: 2, // T35: v1 = T31's 64 x 64 island (its saved edits are dropped once)
    size: [256, 256],                   // fallback [192, 192] (plans/T35.md 2.3)
    seedSalt: 0xd2ea,                   // realm seed = realmSeed(mainSeed, salt)
    terrain: 'dreamLand',               // key into TERRAINS
    biome: 'dream',                     // world.biome() everywhere in the realm
    gravity: 0.5,                       // moon jumps everywhere here (World.gravity -> Player)
    timeSpeed: 0.5,                     // the clock runs at half speed here, so a dream night lasts twice as long (updateSky)
    levelBonus: 6,                      // wild Dream creatures are a bit tougher (creatures.wildLevel)
    spawns: { dream: [['flipsy', 1.2], ['scribbit', 1.2], ['bobbloon', 1.2], ['drizzup', 0.8], ['topsyturvy', 0.12], ['scrawlbert', 0.12], ['bobblimp', 0.1]] }, // T35
    walk: [B.DREAM_GRASS, WOOL.dream, WOOL.paper, WOOL.pixie, WOOL.mind], // blocks wild creatures walk on here (NOT the cloud sea)
    gyms: ['dream'],                    // GYMS ids built in this realm (REALM_BUILDERS)
    look: { sky: 0x6a4fb0, fog: [30, 90], time: null /* null = the main clock */, weather: false, light: 0.8 /* lowest brightness: the Dream is only visited at night */ },
    arrive: [128, 128],
    enterText: 'You fall asleep... and dream!',
    // T38a: per-realm words and rules, so no code has to name a realm
    arriveYaw: -Math.PI / 2,            // facing the Wake Stone
    morning: true,                      // the morning wakes you up
    clock: '☾ Dream', moon: true,       // the HUD clock text; the moon shows how long the night lasts
    travelText: 'Dreaming...',
    backText: 'You woke up in your bed. What a dream!',
    noHomeText: 'No homes in dreams! Build your home in your own world.',
    away: n => `${n} fell asleep and is in the Dream realm.`,
    hostAway: n => `${n} is asleep in the Dream realm. Look around until they wake up!`,
    // T38b: following a friend (the host's trip is the key: no Bed, night or title needed)
    returned: n => `${n} woke up!`,
    askFollow: n => `${n} is dreaming. Dream together?`, followText: 'Follow',
    joined: n => `You followed ${n} into the dream!`,
    too: n => `${n} woke up, so you wake up too!`,
    guide: n => `in ${n}'s dream`,
    entrance: 'bed', guestNote: () => 'You can dream in your own world. Sleep tight!', // how you get in on your own, and what a guest who cannot follow is told
  },
  // T38a: the Swirl, a purple sky with floating decks, lift streams, stairs, seven covered picture frames and the sealed
  // Wizard's tower behind an empty row of star-bridge spots. You get there through the Portal Door (Champions only).
  swirl: {
    id: 'swirl', name: 'Swirl', version: 3, size: [160, 160], seedSalt: 0x5317,
    terrain: 'swirlLand', biome: 'swirl',
    gravity: 1,                         // normal jumps: every way is walkable (stairs, decks, lifts)
    spawns: { swirl: [], cave: [] },    // no wild creatures in wave 13
    walk: [], gyms: [],
    look: { sky: 0xd8c8ff, fog: [44, 125], time: null, weather: false, light: 0.85, still: true, stars: false, zones: true }, // T38d: the zones' sky, fog and light come from swirlsky.js
    arrive: [43, 80], arriveYaw: -Math.PI / 2, // 4 in front of the door back, facing east
    morning: false,                     // the morning never wakes you here
    clock: '✦ Swirl', travelText: 'Swirling...', travelIcon: '🌀', enterText: 'Whoosh! Welcome to the Swirl!',
    backText: 'You stepped back through the Portal Door.',
    noHomeText: 'No homes in the Swirl! Build your home in your own world.',
    away: n => `${n} stepped through the Portal Door.`,
    hostAway: n => `${n} is in the Swirl. Look around until they come back!`,
    returned: n => `${n} is back!`,
    askFollow: n => `${n} went into the Swirl. Go too?`, followText: 'Go too',
    joined: n => `Your friend ${n} is a Champion, so the door opens for you too!`,
    too: n => `${n} went back through the Portal Door, so you go too!`,
    guide: n => `in the Swirl with ${n}`,
    entrance: 'portal', guestNote: n => `You can go to the Swirl in your own world, or follow ${n} when they go.`,
  },
};
REALMS.dream.spawns.cave = REALMS.dream.spawns.dream; // digging into the island: the same dreamers

export function realmSeed(mainSeed, salt) { return Math.imul((mainSeed ^ salt) | 0, 2654435761) >>> 0; }
// Night by the clock (the same moment main.js's game.night turns on: light < 0.3); read straight from game.time,
// so a game loaded in a realm by day wakes up only after the clock is known.
export const isNight = t => Math.sin(t * Math.PI * 2) < -0.04;
export function realmOf(id) { return Object.hasOwn(REALMS, id) ? REALMS[id] : null; }

// Terrain builders: (world, def) fill world.data / world.ground and set world.wake (the Wake Stone cell) and world.isles.
// Writes go straight into data (not edits), like the main terrain.
export const TERRAINS = { dreamLand, swirlLand };
// The guide arrow of a terrain when no realm gym is left: (world, p, game) => { x, z, text(arrow, distance) } (T38a). The Dream's is in aim() below.
export const TERRAIN_AIMS = { swirlLand: swirlAim };

// Realm gym builders, by GYMS def.build: (world, def, isles) => gym object (with `protect`, like every gym).
export const REALM_BUILDERS = { dreamHouse: buildDreamHouse };

// Builds a realm's terrain and its gyms into a World whose `realm` is set (world.generate() calls this).
export function generateRealm(world) {
  const def = world.realm;
  TERRAINS[def.terrain](world, def);
  world.gyms = GYMS.filter(d => d.realm === def.id).map(d => REALM_BUILDERS[d.build](world, d, world.isles));
  world.tower = null;
  world.caves = null;
  world.walk = new Set(def.walk || []);
  if (def.look?.light) world.litCol.fill(1); // bright everywhere: no cave darkness under the islands or inside the house
}

// Night progress for the Dream moon: 0 when the night starts (the moment isNight turns true), 1 when it ends.
const NIGHT_EDGE = Math.asin(0.04) / (2 * Math.PI);
export const nightProgress = t => Math.min(1, Math.max(0, (t - 0.5 - NIGHT_EDGE) / (0.5 - 2 * NIGHT_EDGE)));

// Your own home that is finished as a cozy home (the one whose Bed lets you dream), or null.
export function dreamHome(game) {
  return game.homes?.list.find(h => h.owner === game.playerId && h.types.includes('cozy')) ?? null;
}

// The way between the islands: where the player is and what to do next to reach island `to`. Used by the guide arrow.
// kind: 'here' (on the target island) | 'pad' (walk to the pad towards the next island) | 'jump' (on that pad) | 'air' (flying) | 'sea'.
export function routeOf(world, p, to, entrance = null) {
  const I = world.isles;
  if (!I) return null;
  const byId = Object.fromEntries(I.list.map(i => [i.id, i]));
  if (p.y < 4) { // on the cloud sea: the nearest sea pad
    let best = null, bd = Infinity;
    for (const [x, , z] of I.seaPads) { const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z); if (d < bd) { bd = d; best = [x, z]; } }
    return best ? { kind: 'sea', x: best[0] + 0.5, z: best[1] + 0.5 } : null;
  }
  let here = null;
  for (const i of I.list) {
    if (Math.hypot(p.x - i.x, p.z - i.z) > i.r + 1.5 || p.y < i.top - 0.5 || p.y > i.top + 14) continue;
    if (!here || Math.abs(p.y - i.top) < Math.abs(p.y - here.top)) here = i;
  }
  let flying = false;
  if (!here) { // in the air: route from the island nearest to you
    flying = true;
    let bd = Infinity;
    for (const i of I.list) { const d = Math.hypot(p.x - i.x, p.z - i.z) - i.r; if (d < bd) { bd = d; here = i; } }
  }
  if (here.id === to) {
    if (!entrance) return { kind: 'here', x: here.x + 0.5, z: here.z + 0.5 };
    const near = Math.hypot(p.x - entrance[0] - 0.5, p.z - entrance[2] - 0.5) < 2.2 && !flying;
    return { kind: flying ? 'air' : near ? 'jump' : 'here', x: entrance[0] + 0.5, z: entrance[2] + 0.5 };
  }
  // breadth-first search over the links, from the target back to `here`
  const next = new Map([[to, null]]), queue = [to];
  while (queue.length) {
    const a = queue.shift();
    for (const [x, y] of I.links) {
      const other = x === a ? y : y === a ? x : null;
      if (other && !next.has(other)) { next.set(other, a); queue.push(other); }
    }
  }
  const step = next.get(here.id);
  if (!step) return null;
  const link = I.links.find(([a, b]) => (a === here.id && b === step) || (b === here.id && a === step));
  const pad = link[0] === here.id ? link[2] : link[3];
  const N = byId[step];
  if (flying) return { kind: 'air', x: N.x + 0.5, z: N.z + 0.5, to: step };
  const onPad = Math.hypot(p.x - pad[0] - 0.5, p.z - pad[2] - 0.5) < 2.2;
  return onPad ? { kind: 'jump', x: N.x + 0.5, z: N.z + 0.5, to: step } : { kind: 'pad', x: pad[0] + 0.5, z: pad[2] + 0.5, to: step };
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
  let told = {};         // T35: the Dream's one-time hints (bounce block, steering, the cloud sea)
  let following = false; // T38b: a guest is waiting for the host's realm (askRealm)
  let offered = false;   // T38b: the follow ask was shown for the host's current trip
  let followBox = null;  // T38b: our follow box (ui.asked) while it is showing
  let seenHost = null;   // T38b: where the host was last time we looked (a change = a new trip)
  let lastGround = null; // T38b: host in a realm: the last spot on the ground ([x, y, z])
  const overlay = () => document.getElementById('travel');
  const show = (text, icon = '☾') => { const o = overlay(); if (!o) return; o.querySelector('.travel-text').textContent = text; o.querySelector('.travel-moon').textContent = icon; o.classList.remove('hidden'); };
  const hide = () => overlay()?.classList.add('hidden');
  const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));

  // T38b: the realm id the host is in (null = main or unknown); only for guests
  function hostPlace() {
    if (game.mp?.role !== 'guest') return null;
    const a = game.mp.hostAvatar;
    return a && realmOf(a.place) ? a.place : null;
  }
  const hostName = () => game.mp?.hostName || 'Your friend';

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
    get following() { return following; },
    get lastGround() { return lastGround; },
    hostPlace,
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
      if (stash?.guest) return out; // T38b: a guest in the host's realm: only the guest's own lists are theirs to save
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

    // T38b: a guest's block in a realm while I (the host) am not there: keep it in that realm's edits.
    stashRealmBlock({ x, y, z, b, place }) {
      const def = realmOf(place);
      if (!def || ![x, y, z, b].every(Number.isInteger) || x < 0 || z < 0 || y < 0 || x >= def.size[0] || z >= def.size[1] || y >= 48 || b < 0 || b >= 256) return;
      const i = x + def.size[0] * (z + def.size[1] * y);
      game.realmEdits[place] = (game.realmEdits[place] || []).filter(e => e[0] !== i).concat([[i, b]]);
    },

    // T38b, host: a guest asks for my realm (p = { id, from, realm }).
    answer(p) {
      const def = realmOf(p.realm);
      if (!def || game.place !== p.realm || busy || !stash || stash.guest) { game.mp.sendRealm(p.from, { type: 'no', id: p.id, why: 'gone' }); return; }
      game.mp.sendRealm(p.from, { type: 'part', id: p.id, realm: def.id, rv: def.version ?? 1, edits: [...game.world.edits], ret: stash.ret, spot: lastGround });
    },

    // T38b, guest: a friend's trip to a realm. Asks the host for the realm's edits, then goes there.
    async follow() {
      if (game.mp?.role !== 'guest') return false;
      if (game.place !== MAIN || following) return false;
      const no = why();
      if (no) { game.ui.toast(no); return false; }
      const id = hostPlace(), def = realmOf(id);
      if (!def) { game.ui.toast(`${hostName()} is not away. Follow them when they go to sleep!`); return false; }
      following = true;
      game.ui.closeAsk?.();
      show(def.travelText || 'Travelling...', def.travelIcon);
      let res;
      try { res = await game.mp.askRealm(id); } finally { hide(); following = false; }
      if (res.error) { game.ui.toast(res.error); return false; }
      return self.enter(id, { follow: { ...res, host: hostName() } });
    },

    // T38b, guest: is the host in a realm whose entrance is of this kind (`def.entrance`)? Then the guest may follow through it.
    followableAt(kind) { return realmOf(hostPlace())?.entrance === kind; },
    // T38b, guest used an entrance (a Bed, the Portal Door...): follow the host when he went through this kind, else say why not
    // with the realm's own words (`guestNote`). The entrance rules (bed + night, Champion title) are the host's; a guest skips them.
    guestEntrance(kind) {
      if (self.followableAt(kind)) { self.offerFollow(true); return true; } // T39b: you started it
      const def = Object.values(REALMS).find(r => r.entrance === kind);
      if (def?.guestNote) game.ui.toast(def.guestNote(hostName()));
      return !!def?.guestNote;
    },

    // T38b, guest: the "Dad is dreaming. Dream together?" box (once per host trip, or when asked for).
    offerFollow(byYou = false) { // T39b: byYou = you used a Bed / door ('mine'), else it popped up by itself ('incoming')
      const id = hostPlace(), def = realmOf(id);
      if (!def || game.place !== MAIN) return false;
      if (followBox && game.ui.asked === followBox) return true;
      const no = why();
      if (no) { game.ui.toast(no); return true; }
      offered = true;
      const name = hostName();
      game.ui.ask({ text: def.askFollow?.(name) ?? `${name} went to the ${def.name}. Go too?`, yes: def.followText || 'Follow', no: 'Not now', kind: byYou ? 'mine' : 'incoming',
        onYes: () => { self.follow(); } });
      followBox = game.ui.asked;
      return true;
    },

    // The prompt / action for a Bed you look at ('' = nothing to say).
    bedPrompt(how) { return game.place === MAIN ? `Bed · ${how} to sleep` : ''; },

    // You used a Bed: dream (night, your own cozy home's bed) or a toast that says why not.
    useBed(hit) {
      if (game.place !== MAIN) return false;
      if (game.mp?.role === 'guest') return self.guestEntrance('bed'); // T38b: a guest goes where the host is
      const home = bedHome(game, hit.x, hit.y, hit.z);
      if (!home) { game.ui.toast('To dream, sleep in the Bed of your own cozy home.'); return true; }
      if (!isNight(game.time)) { game.ui.toast('You can only dream at night.'); return true; }
      const no = why();
      if (no) { game.ui.toast(no); return true; }
      asked = true;
      game.ui.ask({ text: 'Go to sleep and dream?', yes: 'Sleep', no: 'Not now', onYes: () => { asked = false; self.enter('dream', { bed: [hit.x, hit.y, hit.z] }); }, onNo: () => { asked = false; } });
      return true;
    },

    // Travel to a realm. opts.bed: the Bed cell (you wake up beside it). Returns a promise of true when you arrived.
    async enter(id, { bed, back: backAt, follow } = {}) {
      const def = realmOf(id);
      const no = !def ? 'There is no such place.' : game.place !== MAIN ? 'You are already away!' : why();
      if (no) { game.ui.toast(no); return false; }
      busy = true;
      if (game.hideSeek?.active) game.hideSeek.stop();
      const p = game.player, w = game.world;
      const back = bed ? besideBed(game, bed) : [p.pos.x, p.pos.y, p.pos.z];
      // backAt (T38a): a ready [x, y, z, yaw] to wake up / come back at (the Portal Door's stand)
      stash = { seed: w.seed, edits: [...w.edits], homes: game.homes.toSave(), owner: game.homes.worldOwner, ret: backAt ? [backAt[0], backAt[1], backAt[2], backAt[3] ?? p.yaw, 0] : [...back, p.yaw, p.pitch] };
      if (follow) { // T38b: the host's trip: wake up where the host wakes up, and the realm is the host's (never my realmEdits)
        stash.guest = true;
        const r = follow.ret;
        if (Array.isArray(r) && r.length >= 3 && r.slice(0, 5).every(Number.isFinite)) stash.ret = [r[0], r[1], r[2], r[3] ?? 0, r[4] ?? 0];
      }
      game.riding?.stop('quiet');
      game.ui.closeAsk?.();
      show(def.travelText || 'Travelling...', def.travelIcon);
      await frame();
      try {
        createWorld(realmSeed(stash.seed, def.seedSalt), follow ? follow.edits : game.realmEdits[id], def.size, { realm: def });
        game.place = id;
        game.player.pos.copy(game.spawnPoint);
        const sp = follow?.spot, np = game.player;
        if (Array.isArray(sp) && sp.slice(0, 3).every(Number.isFinite)) { // beside the host
          np.pos.set(sp[0] + 1.5, sp[1], sp[2] + 1.5);
          for (let i = 0; i < 20 && np.collides(np.pos); i++) np.pos.y += 1;
          if (np.collides(np.pos)) np.pos.copy(game.spawnPoint);
        }
        game.player.yaw = def.arriveYaw ?? -Math.PI / 2; game.player.pitch = 0; // facing the Wake Stone (T38a: or the realm's own way)
        game.weather.snap?.();
      } finally { busy = false; hide(); }
      told = {};
      lastGround = null; offered = true;
      game.ui.toast(follow ? (def.joined?.(follow.host) ?? `You followed ${follow.host} into the ${def.name}!`) : def.enterText || `Welcome to the ${def.name}!`);
      if (game.world.gyms.some(g => !game.badges.includes(g.def.id))) game.ui.toast('Everything is light here: jump high! An upside-down house floats somewhere. Follow the arrow.');
      else if (game.world.wake) game.ui.toast('Touch the glowing Wake Stone to wake up.');
      game.mp?.sendState();
      save(true);
      return true;
    },

    // Back to the main world, beside the Bed. reason: 'stone' | 'morning' | 'lost' | 'quiet'.
    async leave(reason = 'stone') {
      if (game.place === MAIN || !stash || busy) return false;
      busy = true;
      if (game.hideSeek?.active) game.hideSeek.stop();
      const left = game.place;
      if (!stash.guest) game.realmEdits = self.edits(); // T38b: a guest's realm is the host's
      lastGround = null;
      game.riding?.stop('quiet');
      show(realmOf(left)?.morning === false ? 'Swirling...' : 'Waking up...', realmOf(left)?.travelIcon); // T38a
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
      const waits = (realmOf(left)?.gyms || []).some(id => !game.badges.includes(id)); // T35: a gym of that realm is still unbeaten
      const words = { stone: realmOf(left)?.backText || 'You woke up in your bed. What a dream!', door: realmOf(left)?.backText || 'You stepped back through the Portal Door.', morning: waits ? 'Good morning! The gym will wait for you tonight.' : 'Good morning! You woke up in your bed.', lost: 'Oh! You woke up in your bed. Your team is rested.', friend: realmOf(left)?.too?.(hostName()) ?? `${hostName()} went back, so you go too!` };
      if (words[reason]) game.ui.toast(words[reason]);
      game.mp?.sendState();
      save(true);
      return true;
    },

    // From a save: { place, realmPos, realmEdits } plus the main part. Loads the realm when the save was made in one.
    // Call after the main world exists and the player stands at the main return spot.
    restore(saved) {
      game.realmEdits = cleanRealmEdits(saved?.realmEdits, saved?.realmVersions);
      const def = realmOf(saved?.place);
      game.place = MAIN;
      stash = null;
      if (!def || saved.place === MAIN) return false;
      const p = game.player, w = game.world;
      stash = { seed: w.seed, edits: [...w.edits], homes: game.homes.toSave(), owner: game.homes.worldOwner, ret: [p.pos.x, p.pos.y, p.pos.z, p.yaw, p.pitch] };
      createWorld(realmSeed(w.seed, def.seedSalt), game.realmEdits[def.id], def.size, { realm: def });
      game.place = def.id;
      const rp = (saved.realmVersions?.[def.id] ?? 1) === (def.version ?? 1) ? saved.realmPos : null; // T35: another version of the realm: arrive at the start
      const np = game.player;
      if (Array.isArray(rp) && rp.slice(0, 3).every(Number.isFinite)) { np.pos.set(rp[0], rp[1], rp[2]); np.yaw = rp[3] || 0; np.pitch = rp[4] || 0; }
      else np.pos.copy(game.spawnPoint);
      if (np.collides(np.pos)) np.pos.copy(game.spawnPoint);
      return true;
    },

    // Every frame: morning wakes you up (never in the middle of a battle or a duel invite); one-time hints.
    // T38b: the host's trip decides for a guest (follow ask in main, come back when the host does).
    update() {
      if (game.place !== MAIN && game.mp?.role !== 'guest' && !busy && game.player.onGround) lastGround = [game.player.pos.x, game.player.pos.y, game.player.pos.z];
      if (busy || following || game.inBattle || game.duels?.incoming || !game.started) return;
      if (game.mp?.role === 'guest') {
        const a = game.mp.hostAvatar, hp = hostPlace();
        if (a && (a.place || 'main') !== seenHost) { seenHost = a.place || 'main'; offered = false; }
        if (a && game.place !== MAIN && hp !== game.place) { self.leave('friend'); return; }
        if (!hp && followBox && game.ui.asked === followBox) { game.ui.closeAsk?.(); followBox = null; } // the host is back: the question is old
        if (a && game.place === MAIN && hp && !offered && !game.hideSeek?.active && !game.ui.asking) self.offerFollow();
      }
      if (game.place === MAIN) return;
      if (game.world.realm?.morning && !isNight(game.time)) { self.leave('morning'); return; }
      const p = game.player;
      if (!game.world.isles) return; // T38a: the hints below are the Dream's
      if (p.onBounce && !told.pad) { told.pad = true; game.ui.toast('A bounce block! Jump on it to fly up high. Boing!'); }
      else if (p.pos.y < 3 && p.onGround && !told.sea) { told.sea = true; game.ui.toast('You fell into the cloud sea! Find a bounce block to jump back up.'); }
    },
    // The player just launched from a Bounce Block (main.js).
    onBounce() { if (!told.steer && game.place !== MAIN) { told.steer = true; game.ui.toast('Steer while you fly to land on the next island!'); } },

    // Where to go next in this realm (see routeOf): the island you are on, and the next pad.
    route(p, isleId, entrance) { return game.world?.isles ? routeOf(game.world, p, isleId, entrance) : null; },
    // The realm's own guide arrow when no realm gym is left: to the home island, then the Wake Stone.
    aim(p) {
      const w = game.world, wake = w?.wake;
      const own = TERRAIN_AIMS[w?.realm?.terrain]?.(w, p, game); // T38a
      if (own) return own;
      if (!wake) return null;
      const r = routeOf(w, p, w.isles?.home ?? 'home');
      if (!r || r.kind === 'here') return { x: wake[0] + 0.5, z: wake[2] + 0.5, text: (a, d) => `${a} Wake Stone · ${d} m` };
      return { x: r.x, z: r.z, text: (a, d) => (r.kind === 'sea' ? `Bounce back up! ${a} ${d}m` : r.kind === 'jump' ? `Jump! Then fly this way ${a}` : r.kind === 'air' ? `Fly this way ${a}` : `Bounce to the next island ${a} ${d}m`) };
    },
    // realmVersions for a save: every realm's version (missing in a save = 1).
    versions() { return Object.fromEntries(Object.values(REALMS).map(r => [r.id, r.version ?? 1])); },

    // The title screen / a new game: forget everything.
    reset() { stash = null; busy = false; following = false; offered = false; followBox = null; seenHost = null; lastGround = null; told = {}; game.place = MAIN; hide(); },
  };
  game.place = MAIN;
  game.realmEdits = {};
  return self;
}

// realmEdits from a save: only known realms, only [index, block] pairs of whole numbers. T35: a realm's list is dropped
// when the save was made in another version of that realm (versions[id], missing = 1; the Dream is version 2).
export function cleanRealmEdits(saved, versions) {
  const out = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const [id, list] of Object.entries(saved)) {
    const def = realmOf(id);
    if (!def || !Array.isArray(list)) continue;
    if ((versions?.[id] ?? 1) !== (def.version ?? 1)) continue;
    const max = def.size[0] * def.size[1] * 48;
    out[id] = list.filter(e => Array.isArray(e) && Number.isInteger(e[0]) && Number.isInteger(e[1]) && e[0] >= 0 && e[0] < max && e[1] >= 0 && e[1] < 256);
  }
  return out;
}
