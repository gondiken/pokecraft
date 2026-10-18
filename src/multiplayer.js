// Play together: one player hosts their world and shares a code; others join and everyone
// sees each other move and build live. Teams and wild creatures stay per player; players can
// challenge each other to battles (see duel.js).
import * as THREE from 'three';
import { buildPerson } from './npc.js';
import { buildModel, animateModel, disposeModel } from './species.js';
import { isSolid } from './blocks.js';
import { rideSpecies, fitRide } from './riding.js';
import { WORLD_W, WORLD_D } from './world.js';
import { realtimeChannel } from './cloud.js';

const SEND_EVERY = 0.2;   // seconds between position updates (5 per second)
const GONE_AFTER = 8;     // seconds without news before a player counts as gone
const JOIN_TIMEOUT = 12;  // seconds to wait for the host to send their world
const EDITS_PER_MESSAGE = 3000;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L mix-ups
// Bumped when the world's blocks change for the same seed (T8: big caves, the Fossil Gym in a cave; T10: four new gyms;
// 4: the Saucer Gym floats in the sky; 6: T19 three slot gyms and blocks 57-64).
const WORLD_VERSION = 9; // 7: T20 treasure blocks, 8: T22 home blocks, 9: T23 Treasure Vault, blocks 73-74
const EVENTS = ['hello', 'world', 'state', 'block', 'bye', 'duel', 'home'];

const OUTFITS = [
  { shirt: 0x3b6fd8, pants: 0x2a2a3a, hair: 0x3a2a1a, skin: 0xe8b98a },
  { shirt: 0xe04a4a, pants: 0x2a3a5a, hair: 0x1a1a1a, skin: 0xc68a5a },
  { shirt: 0x4ab04a, pants: 0x4a3a2a, hair: 0xe0c060, skin: 0xf2c79a },
  { shirt: 0xf0a020, pants: 0x3a3a50, hair: 0x7a4a2a, skin: 0xd9a066 },
  { shirt: 0x9a5ac0, pants: 0x2a2a2a, hair: 0x2a1a10, skin: 0xf0d0b0 },
];

const randomId = () => Math.random().toString(36).slice(2, 10);
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function makeCode() {
  return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

export const cleanCode = code => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

// Normally Supabase Realtime. Adding ?mp=local to the address connects browser tabs on the same
// computer to each other instead, which is handy for testing without a server.
async function openTransport(code) {
  const name = `pokecraft-world-${code}`;
  if (new URLSearchParams(location.search).get('mp') === 'local') {
    const bc = new BroadcastChannel(name);
    const handlers = {};
    bc.onmessage = e => handlers[e.data.event]?.(e.data.payload);
    return {
      send: (event, payload) => bc.postMessage({ event, payload }),
      on: (event, fn) => { handlers[event] = fn; },
      close: () => bc.close(),
    };
  }
  return realtimeChannel(name, EVENTS);
}

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '36px VT323, monospace';
  const w = Math.min(248, g.measureText(text).width + 24);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect((256 - w) / 2, 8, w, 48);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.y = 2.35;
  sprite.renderOrder = 10;
  return sprite;
}

// Another player as seen in this world: a blocky person, a name tag and their lead creature.
class Avatar {
  constructor(scene, info) {
    this.scene = scene;
    this.id = info.id;
    this.name = info.name;
    this.isHost = !!info.host;
    this.model = buildPerson(OUTFITS[hash(info.id) % OUTFITS.length]);
    this.model.add(nameTag(info.name));
    this.model.userData.avatar = this;
    this.pos = new THREE.Vector3(info.x, info.y, info.z);
    this.target = this.pos.clone();
    this.yaw = info.yaw || 0;
    this.model.position.copy(this.pos);
    scene.add(this.model);
    this.lead = null;
    this.leadSpecies = null;
    this.rideModel = null;
    this.rideFit = null;
    this.rideSpecies = null;
    this.isDueling = false;
    this.heard = 0;
    this.t = 0;
  }

  update(info) {
    this.target.set(info.x, info.y, info.z);
    this.yaw = info.yaw;
    this.heard = 0;
    if (info.lead !== this.leadSpecies) this.setLead(info.lead);
    const r = rideSpecies(info.ride);
    if (r !== this.rideSpecies) this.setRide(r);
  }

  // The lead creature hides while this player is in a battle with you (their creature is out).
  set dueling(on) { this.isDueling = on; if (this.lead) this.lead.visible = !on && !this.rideModel; }

  // T27: the creature this player is riding (null = walking). Not a child of the person, so picks only hit the person.
  setRide(species) {
    if (this.rideModel) { this.scene.remove(this.rideModel); disposeModel(this.rideModel); this.rideModel = null; }
    this.rideSpecies = null;
    if (species) {
      try {
        this.rideModel = buildModel(species);
        this.rideFit = fitRide(this.rideModel);
        this.scene.add(this.rideModel);
        this.rideSpecies = species;
      } catch { this.rideModel = null; this.rideSpecies = species; }
    }
    if (this.lead) this.lead.visible = !this.isDueling && !this.rideModel;
  }

  setLead(species) {
    if (this.lead) { this.scene.remove(this.lead); disposeModel(this.lead); this.lead = null; }
    this.leadSpecies = species;
    if (!species) return;
    try {
      this.lead = buildModel(species);
      this.lead.scale.setScalar(0.8);
      this.lead.position.copy(this.pos);
      this.scene.add(this.lead);
    } catch { this.lead = null; }
  }

  tick(dt, world) {
    this.t += dt;
    this.heard += dt;
    const before = this.pos.clone();
    this.pos.lerp(this.target, Math.min(1, dt * 10));
    const moving = before.distanceTo(this.pos) / Math.max(dt, 1e-3) > 0.5;
    this.model.position.copy(this.pos);
    // Players' cameras face -Z at yaw 0, but people models face +Z.
    this.model.rotation.y = this.yaw + Math.PI;
    const p = this.model.userData.parts;
    const riding = !!this.rideModel;
    if (riding) {
      // Sitting on a creature: raised, legs apart, no swing.
      this.model.position.y += this.rideFit.seat - 0.75;
      p.legs.forEach((l, i) => { l.g.rotation.x = 0; l.g.rotation.z = i % 2 ? 0.5 : -0.5; });
      for (const a of p.arms) a.g.rotation.x = 0;
      const f = this.rideFit;
      this.rideModel.position.set(this.pos.x - Math.sin(this.yaw) * f.shift, this.pos.y + f.lift, this.pos.z - Math.cos(this.yaw) * f.shift);
      this.rideModel.rotation.y = this.yaw + Math.PI;
      animateModel(this.rideModel, this.t, moving);
    } else {
      for (const l of p.legs) { l.g.rotation.z = 0; l.g.rotation.x = moving ? Math.sin(this.t * 9 + l.phase) * 0.7 : 0; }
      for (const a of p.arms) a.g.rotation.x = moving ? Math.sin(this.t * 9 + a.phase) * 0.6 : 0;
    }
    if (this.lead) {
      // The lead creature trots along behind and to the side.
      const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(1.4);
      const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.9);
      const want = this.pos.clone().add(back).add(side);
      want.y = groundBelow(world, want.x, want.z, this.pos.y + 1);
      this.lead.position.lerp(want, Math.min(1, dt * 4));
      this.lead.rotation.y = this.yaw + Math.PI;
      animateModel(this.lead, this.t, moving);
    }
  }

  dispose() {
    this.scene.remove(this.model);
    disposeModel(this.model);
    this.setLead(null);
    this.setRide(null);
  }
}

function groundBelow(world, x, z, fromY) {
  const xi = Math.floor(x), zi = Math.floor(z);
  for (let y = Math.floor(fromY); y >= 0; y--) if (isSolid(world.get(xi, y, zi))) return y + 1;
  return fromY;
}

export class Multiplayer {
  // hooks: { loadWorld(data), toast(text), ended(reason) }
  constructor(game, hooks) {
    this.game = game;
    this.hooks = hooks;
    this.id = randomId();
    this.role = null; // 'host' | 'joining' | 'guest'
    this.code = null;
    this.t = null;
    this.others = new Map();
    this.sendTimer = 0;
    this.raycaster = new THREE.Raycaster();
  }

  get active() { return this.role === 'host' || this.role === 'guest'; }
  get players() { return [...this.others.values()].map(a => a.name); }
  get hostName() { return [...this.others.values()].find(a => a.isHost)?.name; }

  async host(name) {
    this.name = name;
    for (let tries = 0; tries < 3 && !this.t; tries++) {
      this.code = makeCode();
      this.t = await openTransport(this.code);
    }
    if (!this.t) return { error: "Couldn't connect to the game server. Check the internet connection." };
    this.role = 'host';
    this.listen();
    return { code: this.code };
  }

  async join(code, name) {
    this.name = name;
    this.code = cleanCode(code);
    if (this.code.length !== 5) return { error: 'World codes have 5 letters and numbers.' };
    this.role = 'joining';
    this.t = await openTransport(this.code);
    if (!this.t) { this.role = null; return { error: "Couldn't connect to the game server. Check the internet connection." }; }
    this.listen();
    const world = await new Promise(resolve => {
      this.parts = [];
      this.gotWorld = resolve;
      setTimeout(() => resolve(null), JOIN_TIMEOUT * 1000);
      this.t.send('hello', { id: this.id, name });
    });
    this.gotWorld = null;
    if (world?.wrongVersion) {
      this.close();
      return { error: 'Your friend has a newer game. Please reload the page!' };
    }
    if (!world) {
      this.close();
      return { error: `No world found with code ${this.code}. Check the code, and that the other player is hosting.` };
    }
    this.role = 'guest';
    this.hooks.loadWorld(world);
    this.sendState();
    return { hostName: world.hostName };
  }

  listen() {
    const t = this.t;
    t.on('hello', p => { if (this.role === 'host') this.sendWorld(p.id); });
    t.on('world', p => {
      if (this.role !== 'joining' || p.to !== this.id || !this.gotWorld) return;
      if ((p.wv || 1) !== WORLD_VERSION) { this.gotWorld({ wrongVersion: true }); return; }
      this.parts[p.part] = p;
      if (this.parts.filter(Boolean).length < p.parts) return;
      const edits = this.parts.flatMap(x => x.edits);
      const { seed, time, hostPos, hostName, size, weather, homes, owner } = p;
      this.gotWorld({ seed, time, hostPos, hostName, edits, size, weather, homes, owner });
    });
    t.on('state', p => {
      if (!this.active || p.id === this.id) return;
      let a = this.others.get(p.id);
      if (!a) {
        a = new Avatar(this.game.scene, p);
        this.others.set(p.id, a);
        this.hooks.toast(`${p.name} ${p.host ? 'is hosting this world' : 'joined the world'}!`);
      }
      a.update(p);
      if (p.host && this.role === 'guest' && typeof p.time === 'number') this.game.time = p.time;
      if (p.host && this.role === 'guest' && p.weather) this.game.weather?.apply(p.weather);
    });
    t.on('block', p => {
      if (!this.active || p.id === this.id) return;
      if (!this.game.world.editAllowed(p.x, p.y, p.z, p.b)) return; // gyms stay whole (T17)
      this.game.world.set(p.x, p.y, p.z, p.b);
    });
    t.on('home', p => { // T22: another player placed / changed their home
      if (this.active && p.id !== this.id) this.hooks.home?.(p.home);
    });
    t.on('bye', p => this.removePlayer(p.id, true));
    t.on('duel', p => {
      if (this.active && p.to === this.id && p.from !== this.id) this.hooks.duel?.(p);
    });
  }

  sendDuel(to, data) {
    if (this.active) this.t.send('duel', { ...data, from: this.id, to, name: this.name });
  }

  // The other player under a ray (for challenging them), like NpcManager.pick.
  pick(origin, dir, maxDist) {
    if (!this.others.size) return null;
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const meshes = [];
    const reach = maxDist + 3;
    for (const a of this.others.values()) if (a.pos.distanceToSquared(origin) < reach * reach) a.model.traverse(o => { if (o.isMesh) meshes.push(o); }); // not the name tag sprite
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.avatar) o = o.parent;
    return o ? { player: o.userData.avatar, dist: hits[0].distance } : null;
  }

  sendWorld(to) {
    const g = this.game;
    const edits = [...g.world.edits];
    const parts = Math.max(1, Math.ceil(edits.length / EDITS_PER_MESSAGE));
    const p = g.player.pos;
    for (let i = 0; i < parts; i++) {
      this.t.send('world', {
        to, wv: WORLD_VERSION, part: i, parts, seed: g.world.seed, time: g.time, weather: g.weather?.state(), hostName: this.name, size: [WORLD_W, WORLD_D],
        hostPos: [p.x, p.y, p.z], homes: g.homes.toSave(), owner: g.homes.worldOwner, edits: edits.slice(i * EDITS_PER_MESSAGE, (i + 1) * EDITS_PER_MESSAGE),
      });
    }
  }

  sendState() {
    if (!this.active) return;
    const g = this.game, p = g.player.pos;
    this.t.send('state', {
      id: this.id, name: this.name, host: this.role === 'host',
      x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +g.player.yaw.toFixed(2),
      ride: g.riding?.species ?? null,
      lead: g.party.find(c => c.hp > 0)?.species ?? g.party[0]?.species ?? null,
      time: this.role === 'host' ? +g.time.toFixed(4) : undefined,
      weather: this.role === 'host' ? g.weather?.state() : undefined,
    });
  }

  // T22: a home record { owner, name, x, y, z, type } (Home.toSave()).
  sendHome(record) {
    if (this.active) this.t.send('home', { id: this.id, home: record });
  }

  sendBlock(x, y, z, b) {
    if (this.active) this.t.send('block', { id: this.id, x, y, z, b });
  }

  removePlayer(id, said) {
    const a = this.others.get(id);
    if (!a) return;
    a.dispose();
    this.others.delete(id);
    this.hooks.left?.(id);
    this.hooks.toast(`${a.name} ${said ? 'left' : 'lost connection'}.`);
    if (a.isHost && this.role === 'guest') this.hooks.ended('host-left');
  }

  update(dt) {
    if (!this.active) return;
    this.sendTimer += dt;
    if (this.sendTimer >= SEND_EVERY) { this.sendTimer = 0; this.sendState(); }
    for (const a of [...this.others.values()]) {
      a.tick(dt, this.game.world);
      if (a.heard > GONE_AFTER) this.removePlayer(a.id, false);
    }
  }

  close() {
    this.game.duels?.reset();
    if (this.t) {
      if (this.active) this.t.send('bye', { id: this.id });
      // Give the goodbye a moment to go out before closing.
      const t = this.t;
      setTimeout(() => t.close(), 300);
    }
    for (const a of this.others.values()) a.dispose();
    this.others.clear();
    this.t = null;
    this.role = null;
    this.code = null;
  }
}
