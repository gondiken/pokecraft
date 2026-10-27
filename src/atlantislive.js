// T41: the live part of the Sunken City (LIVE.atlantis, made by gymLive.reset for the world.parts entry `atlantis`): Glowfish Catch.
// You swim in 3D (player.js dive swimming), hold Catch! to coil (you slow down, the net glows) and let go to LUNGE with the net (the
// longer you held, the further: 1.5 to 4 blocks). Three kinds of fish, three tricks (glowfish.js has the rules): shy fish pop out of
// clay jars when you bump them, darters must be herded into a dead end, a golden school is caught many at once when it bunches up.
// Swim into a district's lantern with fish in your net and they light the district; every light is a saved `beaten` key
// (pw:atlantis:light1..12). With all 12 the palace gate opens and Queen Coralia battles for the star. Nothing is ever lost: a fish that
// gets away swims home. Everything here is this player's own (meshes, fish, the net); only the lights are saved.
// The fish are stepped in fixed 1/120 s sub-steps (like the Ball Stadium), so 60 and 20 frames a second give the same result.
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';
import { FISH, Darter, shyAt, popDir, schoolFish, lungeLength, netCentre, inNet, lightState, nextLights, lightsFor, fishFor, lightKey, LIGHT_KEY, PER_DISTRICT, LIGHTS } from './glowfish.js';
import { CITY, WHIRL, BUBBLES, DISTRICTS, craterR, districtAt } from './atlantisland.js';

export const LIVE_RULES = { jarMargin: 0.3, pourReach: 1.4, hintGap: 8, active: 80, saveGap: 0.25 };
// The pictures that explain the game (owner 2026-10-27): bulbs over the lanterns, the trail to the lantern, the flight into a bulb, the ghost fish.
export const VIS = { bulbR: 1.25, bulbUp: 1.4, trail: 16, trailLen: 26, fly: 12, flyTime: 0.8, demo: { period: 6, swim: 3.2, glow: 1.6, near: 30 } };
// The bulb k (0..3) of a lantern: on a ring over its top.
export const bulbAt = (lantern, k) => { const a = Math.PI / 4 + (k * Math.PI) / 2, c = lantern.centre; return [c[0] + Math.cos(a) * VIS.bulbR, lantern.box.y1 + 1 + VIS.bulbUp, c[2] + Math.sin(a) * VIS.bulbR]; };
const COLORS = { shy: 0xffb36a, darter: 0x8af4ff, school: 0xffe27a };
const SIZE = { shy: 0.5, darter: 0.62, school: 0.44 };
const NICE = { shy: 'Jar Market', darter: 'Arch Gardens', school: 'Temple Steps' };

// One glowfish: a little body, a tail, a fin and two dark eyes in a single geometry with vertex colours (white = the kind's colour).
function fishGeometry() {
  const parts = [[0.22, 0.26, 0.46, 0, 0, 0, 1], [0.05, 0.34, 0.2, 0, 0, -0.32, 1], [0.04, 0.14, 0.22, 0, 0.18, -0.02, 1], [0.04, 0.05, 0.05, 0.12, 0.05, 0.16, 0], [0.04, 0.05, 0.05, -0.12, 0.05, 0.16, 0]];
  const pos = [], nor = [], col = [], idx = [];
  for (const [w, h, d, x, y, z, c] of parts) {
    const g = new THREE.BoxGeometry(w, h, d), base = pos.length / 3;
    for (let i = 0; i < g.attributes.position.count; i++) {
      pos.push(g.attributes.position.getX(i) + x, g.attributes.position.getY(i) + y, g.attributes.position.getZ(i) + z);
      nor.push(g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i));
      col.push(c ? 1 : 0.08, c ? 1 : 0.1, c ? 1 : 0.14);
    }
    for (const i of g.index.array) idx.push(base + i);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

export class AtlantisLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    this.world = game.world;
    this.A = this.world.atlantis;
    this.cells = new LiveCells(this.world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true);
    this.open = (x, y, z) => !this.world.isSolid(Math.floor(x), Math.floor(y), Math.floor(z));
    this.t = 0; this.acc = 0; this.clock = 0;
    this.told = new Set();           // one-time hints, per trip
    this.lastHint = -99; this.lastSync = -99;
    this.held = null;                // Catch! held: { t0 }
    this.lunge = null;               // a lunge in progress: { t, L, dir }
    this.lungeCool = 0;
    this.forceLit = false;           // after the Queen's defeat the city stays lit for the trip
    this.shown = null;
    // the fish
    this.shy = this.A.shy.map((j, i) => ({ id: `shy${i}`, kind: 'shy', index: i, jar: j, home: j.home, pop: null, out: false, pos: [...j.home], prev: [...j.home], yaw: 0 }));
    this.darters = this.A.darters.map((d, i) => { const fish = new Darter({ id: d.id, index: i, home: d.home, y: d.y }); return { id: d.id, kind: 'darter', index: i, fish, out: false, pos: fish.pos3, prev: fish.pos3, yaw: 0 }; });
    this.school = Array.from({ length: FISH.school.n }, (_, i) => ({ id: `school${i}`, kind: 'school', index: i, out: false, pos: [0, 0, 0], prev: [0, 0, 0], yaw: 0 }));
    this.fish = [...this.shy, ...this.darters, ...this.school];
    this.lists = { shy: this.shy, darter: this.darters, school: this.school };
    this.net = [];                   // the fish in the net, in the order they were caught
    this.jars = this.A.jars.map(j => ({ ...j, t0: null }));
    this.lastBump = -99;
    this.state = { lit: [0, 0, 0] };
    this.meshes = [];
    this.build();
    this.syncLights(true);
    this.place();
  }

  /* ---------- meshes (all with userData.atlantis, removed in dispose) ---------- */
  mark(m) { m.userData.atlantis = true; m.frustumCulled = false; this.game.scene?.add(m); this.meshes.push(m); return m; }
  build() {
    const fishGeo = fishGeometry();
    this.fishMesh = {};
    for (const kind of ['shy', 'darter', 'school']) {
      const n = this.lists[kind].length;
      this.fishMesh[kind] = this.mark(new THREE.InstancedMesh(fishGeo, new THREE.MeshBasicMaterial({ color: COLORS[kind], vertexColors: true }), n));
    }
    this.ring = this.mark(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0x5af0e0, transparent: true, opacity: 0.8, depthTest: false, fog: false })));
    this.ring.renderOrder = 20; this.ring.visible = false;
    this.carry = this.mark(new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, fog: false }), FISH.carry));
    this.carry.renderOrder = 21; this.carry.visible = false;
    for (let i = 0; i < FISH.carry; i++) this.carry.setColorAt(i, new THREE.Color(0xffffff));
    this.beams = this.mark(new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.35, 1), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.35, depthWrite: false }), 3));
    this.beams.count = 0;
    const NB = 24 + BUBBLES.length * 8;
    this.bubbles = this.mark(new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xcff8ff, transparent: true, opacity: 0.55, depthWrite: false }), NB));
    this.wobbles = Array.from({ length: 4 }, () => { const m = this.mark(new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), new THREE.MeshLambertMaterial({ color: 0xc4683f }))); m.visible = false; return m; });
    // owner 2026-10-27 ("I didn't know which ones were glowfish and what was the point"): show it, don't tell it.
    // A soft glow round every glowfish; four glass bulbs on each lantern that light up one by one; the fish in your net glowing round
    // you and a trail of light from you to the lantern they belong to; poured fish flying into their bulb; and, until you catch your
    // first one, a ghost glowfish that swims from the district's fish into the lantern and lights a bulb, over and over.
    const glowMat = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    this.halo = {};
    for (const kind of ['shy', 'darter', 'school']) this.halo[kind] = this.mark(new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 8), glowMat(COLORS[kind]), this.lists[kind].length));
    const n = DISTRICTS.length * PER_DISTRICT;
    this.bulbs = this.mark(new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), n));
    this.bulbGlow = this.mark(new THREE.InstancedMesh(new THREE.SphereGeometry(0.75, 12, 8), glowMat(0xffffff), n));
    for (let i = 0; i < n; i++) { this.bulbs.setColorAt(i, new THREE.Color(0x30414a)); this.bulbGlow.setColorAt(i, new THREE.Color(0x000000)); }
    this.trail = this.mark(new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), glowMat(0xffffff), VIS.trail));
    this.trail.material.opacity = 0.75; this.trail.count = 0;
    this.flyMesh = this.mark(new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), VIS.fly));
    this.flyGlow = this.mark(new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 10, 8), glowMat(0xffffff), VIS.fly));
    this.flyMesh.count = 0; this.flyGlow.count = 0;
    this.flying = [];                // { from, to, t0, d, k, kind } fish on their way into a bulb (drawn by the part's clock)
    this.dummy = new THREE.Object3D();
    this.eul = new THREE.Euler();
    this.school.forEach(f => { f.pos = schoolFish(this.A.school, 0, f.index); f.prev = f.pos; });
  }
  dispose() {
    const g = this.game;
    g.ui?.setScore?.(null);
    g.netGlow = 0;
    if (g.player) { g.player.noSwim = false; g.player.held = 0; }
    for (const m of this.meshes) { g.scene?.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.meshes = [];
  }

  /* ---------- helpers ---------- */
  toast(m) { this.game.ui.toast(m); }
  hint(key, text) { if (this.told.has(key)) return; this.told.add(key); this.toast(text); }
  frozen() { const g = this.game; return !!(g.inBattle || g.ui.asking || g.ui.panelOpen || !this.playing()); }
  get diving() { return !!this.game.player.diving; }
  inPalace(p = this.game.player.pos) { const b = this.A.palace.inside; return p.x >= b.x0 && p.x <= b.x1 + 1 && p.z >= b.z0 && p.z <= b.z1 + 1 && p.y >= b.y0 && p.y <= b.y1; }
  inCity(p = this.game.player.pos) { return craterR(p.x, p.z) <= CITY.dive + 1 && p.y < 14.5; }
  centre(p = this.game.player) { return [p.pos.x, p.pos.y + 0.9, p.pos.z]; }
  eye(p = this.game.player) { return [p.pos.x, p.pos.y + p.eye, p.pos.z]; }
  carriedKinds() { return [...new Set(this.net.map(f => f.kind))]; }
  fishPos(f) {
    if (f.kind === 'shy') return shyAt(f.home, this.t, f.pop).pos;
    if (f.kind === 'darter') return f.fish.pos3;
    return schoolFish(this.A.school, this.t, f.index);
  }
  // can this fish be caught right now (not in the net, not gone; a shy fish only while it is out of its jar)
  catchable(f) { return !f.out && (f.kind !== 'shy' || shyAt(f.home, this.t, f.pop).catchable); }

  /* ---------- the lights (saved keys) and what they show ---------- */
  // Every 0.25 s (or at once): the saved lights -> the dim of each district, the lamps, the lanterns, the palace gate.
  syncLights(force = false) {
    if (!force && this.t - this.lastSync < LIVE_RULES.saveGap) return;
    this.lastSync = this.t;
    const g = this.game, st = lightState(g), A = this.A, world = this.world;
    // fish already poured away: the first ones by index (a reload, or the keys cleared after the Queen)
    DISTRICTS.forEach((d, i) => {
      const gone = fishFor(d.kind, st.lit[i]), list = this.lists[d.kind];
      const poured = list.filter(f => f.poured).length;
      if (poured !== gone) list.forEach((f, k) => { f.poured = k < gone; f.out = f.poured || this.net.includes(f); });
    });
    const shown = this.forceLit ? [PER_DISTRICT, PER_DISTRICT, PER_DISTRICT] : st.lit;
    const open = this.forceLit || st.done || this.inPalace();
    const key = `${shown.join()}|${open}`;
    if (key === this.shown) { this.cells.flush(); return; }
    const old = A.lit;
    A.lit = [...shown];
    shown.forEach((n, i) => {
      const d = A.districts[i];
      if (n !== old[i]) { // redraw the chunks round the district: the dim changes
        const x0 = Math.floor((CITY.x + d.c[0] - d.r) / 16), x1 = Math.floor((CITY.x + d.c[0] + d.r) / 16), z0 = Math.floor((CITY.z + d.c[1] - d.r) / 16), z1 = Math.floor((CITY.z + d.c[1] + d.r) / 16);
        for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) world.dirty.add(`${cx},${cz}`);
      }
      d.lamps.forEach(([x, y, z], k) => this.cells.want(x, y, z, k < n * 2 ? B.AT_LAMP_ON : B.AT_LAMP_OFF));
      for (const [x, y, z] of d.lantern.cells) this.cells.want(x, y, z, n >= PER_DISTRICT ? B.AT_LANTERN_ON : B.AT_LANTERN_OFF);
    });
    for (const [x, y, z] of A.palace.gate) this.cells.want(x, y, z, open ? B.AIR : B.AT_DOME);
    this.shown = key;
    this.beamsDirty = true;
    this.cells.flush();
  }

  /* ---------- every frame ---------- */
  update(dt) {
    const g = this.game, pl = g.player;
    this.clock += Math.min(dt, 0.1);
    const city = this.inCity() || this.inPalace();
    this.showScore(city);
    if (this.frozen()) { this.held = null; pl.held = 0; this.endLunge(); g.netGlow = this.glow(); this.draw(); return; }
    this.cells.flush();
    if (!city) { this.leave(); g.netGlow = 0; this.draw(); return; }
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= FISH.step) { this.acc -= FISH.step; this.step(FISH.step); }
    this.syncLights();
    this.pour();
    this.hints();
    if (pl.kicked) { pl.kicked = false; sound.play('atkick'); }
    g.netGlow = this.glow();
    this.draw();
  }

  glow() { return Math.min(1, 0.25 + 0.09 * this.net.length + 0.25 * (this.held ? Math.min(1, (this.t - this.held.t0) / FISH.lunge.hold) : 0) + (this.lunge ? 0.2 : 0)); }

  // the player left the city (up and away, or a battle): the glowfish in the net swim home
  leave() {
    if (this.held || this.lunge) { this.held = null; this.game.player.held = 0; this.endLunge(); }
    if (this.net.length) { for (const f of this.net) f.out = false; this.net = []; this.toast('The glowfish in your net swam home.'); }
  }
  endLunge() { if (this.lunge) { this.lunge = null; this.lungeCool = FISH.lunge.rest; } this.game.player.noSwim = false; }

  step(h) {
    const pl = this.game.player;
    this.t += h;
    this.lungeCool = Math.max(0, this.lungeCool - h);
    for (const f of this.fish) f.prev = f.pos;
    if (this.held) pl.held = Math.min(1, (this.t - this.held.t0) / FISH.lunge.hold);
    // the darters: they run from you, closed forms for the others
    const c = this.centre();
    for (const f of this.darters) if (!f.out) { f.fish.step(h, c, this.open); f.pos = f.fish.pos3; }
    for (const f of this.shy) {
      if (f.out) continue;
      const s = shyAt(f.home, this.t, f.pop);
      if (s.over) f.pop = null;
      f.pos = s.pos;
    }
    for (const f of this.school) if (!f.out) f.pos = schoolFish(this.A.school, this.t, f.index);
    this.bumps(c);
    if (this.lunge) this.stepLunge(h);
  }

  /* ---------- the lunge ---------- */
  stepLunge(h) {
    const L = this.lunge, pl = this.game.player, T = FISH.lunge.time;
    const ds = Math.min(L.L / T * h, L.L - L.moved), dx = L.dir[0] * ds, dy = L.dir[1] * ds, dz = L.dir[2] * ds;
    pl.moveAxis('x', dx); pl.moveAxis('z', dz); pl.moveAxis('y', dy);
    L.moved += ds;
    L.t += h;
    this.catchAt(netCentre(this.eye(), L.dir));
    if (L.t >= T) this.endLunge();
  }
  catchAt(c) {
    for (const f of this.fish) if (this.catchable(f) && inNet(c, f.pos)) this.take(f);
  }
  take(f) {
    if (this.net.length >= FISH.carry) { this.hint('full', 'Your net is full! Take the glowfish to a lantern.'); return; }
    f.out = true; f.pop = null;
    this.net.push(f);
    sound.play('atcatch');
    this.caught = true; // (the ghost fish stops showing the way)
    this.hint('first', 'You caught a glowfish! Follow its light to the lantern.');
  }

  /* ---------- jars ---------- */
  bumps(c) {
    const pl = this.game.player, m = LIVE_RULES.jarMargin, p = pl.pos;
    this.jars.forEach((j, i) => {
      if (j.t0 !== null) { // wobbling
        const u = this.t - j.t0;
        if (u >= FISH.shy.wobble) { j.t0 = null; this.cells.want(...j.cell, B.AT_JAR); }
        return;
      }
      const [x, y, z] = j.cell;
      if (p.x + 0.3 + m < x || p.x - 0.3 - m > x + 1 || p.y + 1.8 + m < y || p.y - m > y + 1 || p.z + 0.3 + m < z || p.z - 0.3 - m > z + 1) return;
      this.bump(i, c);
    });
  }
  bump(i, c = this.centre()) {
    const j = this.jars[i];
    if (!j || j.t0 !== null || this.frozen()) return false;
    const f = j.fish != null ? this.shy[j.fish] : null;
    if (f && f.pop) return false;                      // its fish is out already
    j.t0 = this.t;
    this.cells.want(...j.cell, B.AIR);                 // the jar is drawn as a wobbling box for 0.6 s
    sound.play('atwobble');
    if (f && !f.out) {
      f.pop = { t0: this.t, dir: popDir(f.home, c, f.index, this.open) };
      this.hint('pop', 'It wobbles... get ready to catch it!');
    } else if (this.t - this.lastBump > 4) { this.lastBump = this.t; this.toast('Nothing in this jar. Try another one!'); }
    return true;
  }

  /* ---------- the lanterns ---------- */
  pour() {
    if (!this.net.length) return;
    const g = this.game, c = this.centre(), r = LIVE_RULES.pourReach, st = lightState(g);
    DISTRICTS.forEach((d, i) => {
      const b = this.A.districts[i].lantern.box;
      if (c[0] < b.x0 - r || c[0] > b.x1 + 1 + r || c[2] < b.z0 - r || c[2] > b.z1 + 1 + r || c[1] < b.y0 - r - 1 || c[1] > b.y1 + 1 + r) return;
      const mine = this.net.filter(f => f.kind === d.kind);
      if (!mine.length) {
        if (this.t - this.lastHint > LIVE_RULES.hintGap) { this.lastHint = this.t; this.toast(`These glowfish live in the ${NICE[this.net[0].kind]}. Take them to its lantern!`); }
        return;
      }
      const need = PER_DISTRICT - st.lit[i];
      if (need <= 0) { if (this.t - this.lastHint > LIVE_RULES.hintGap) { this.lastHint = this.t; this.toast(`The ${d.name} is lit already. Try another lantern!`); } return; }
      const gain = Math.min(lightsFor(d.kind, mine.length), need);
      if (gain <= 0) { if (this.t - this.lastHint > LIVE_RULES.hintGap) { this.lastHint = this.t; this.toast('Two school fish make one light. Catch one more!'); } return; }
      const used = mine.slice(0, fishFor(d.kind, gain));
      this.net = this.net.filter(f => !used.includes(f));
      for (let k = 0; k < gain; k++) this.flying.push({ from: [...c], to: bulbAt(this.A.districts[i].lantern, st.lit[i] + k), t0: this.clock + k * 0.15, d: i, k: st.lit[i] + k, kind: d.kind }); // they fly into their bulbs
      for (const f of used) f.poured = true;           // out stays true: they are in the lantern now
      for (const key of nextLights(g, i, gain)) g.beaten.push(key);
      const total = st.total + gain;
      sound.play('atlight');
      if (st.lit[i] + gain >= PER_DISTRICT) this.toast(`The ${d.name} is lit! ${total} / ${LIGHTS}`);
      else this.toast(`+${gain} light${gain > 1 ? 's' : ''}! ${total} / ${LIGHTS}`);
      if (total >= LIGHTS) { this.toast('All three lanterns are lit! The palace dome opens. Swim in!'); }
      g.save?.(true);
      this.syncLights(true);
    });
  }

  /* ---------- the net: Catch! (gymLive near / holds / use / release) ---------- */
  active() { return !this.frozen() && this.diving; }
  near() { return this.active() ? 'Catch!' : null; }
  holds() { return this.active() || !!this.held; }
  use() {
    if (!this.active()) return false;
    if (this.held || this.lunge) return true;            // a key repeat
    if (this.knock()) return true;                       // Catch! at a jar right in front of you knocks it
    this.held = { t0: this.t };
    this.hint('catch', 'Hold Catch! to coil. Let go to lunge with the net!');
    return true;
  }
  release() {
    const h = this.held;
    if (!h) return false;
    this.held = null;
    const pl = this.game.player;
    pl.held = 0;
    if (this.frozen() || !this.diving || this.lungeCool > 0 || this.lunge) return true;
    const f = pl.forward, dir = [f.x, f.y, f.z], L = lungeLength(this.t - h.t0);
    this.lunge = { t: 0, L, dir, moved: 0, held: this.t - h.t0 };
    pl.noSwim = true;
    sound.play('atlunge');
    return true;
  }
  // the jar you are looking at within 2.4 blocks (null when none): pressing Catch! there knocks it instead of coiling
  knock() {
    const e = this.eye(), f = this.game.player.forward;
    let best = -1, bd = 1e9;
    this.jars.forEach((j, i) => {
      const dx = j.cell[0] + 0.5 - e[0], dy = j.cell[1] + 0.5 - e[1], dz = j.cell[2] + 0.5 - e[2], d = Math.hypot(dx, dy, dz);
      if (d <= 2.4 && (dx * f.x + dy * f.y + dz * f.z) / (d || 1) > 0.85 && d < bd) { best = i; bd = d; }
    });
    return best >= 0 && this.bump(best);
  }
  // a click on a jar (gymLive.hit): knock it
  hit(block) {
    if (block.id !== B.AT_JAR || this.frozen()) return false;
    const i = this.jars.findIndex(j => j.cell[0] === block.x && j.cell[1] === block.y && j.cell[2] === block.z);
    if (i < 0) return false;
    this.bump(i);
    return true;
  }
  prompt(block, how) {
    if (block.id === B.AT_JAR) return `Clay jar · ${how} to knock`;
    if (block.id === B.AT_LANTERN_OFF || block.id === B.AT_LANTERN_ON) return 'Lantern · swim into it with glowfish in your net';
    return null;
  }
  action(block) { return block.id === B.AT_JAR ? 'Knock!' : null; }

  /* ---------- the Queen ---------- */
  talkPrompt(npc) {
    if (npc.kind === 'boss' && npc.def?.id === 'atlantis' && !lightState(this.game).done) return { verb: 'talk', action: 'Talk' };
    return null;
  }
  // A won Boss battle (the star, or a rematch): the keys are cleared (the next match is a new catch), the city stays lit for the trip.
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.picture?.id !== 'atlantis' || opts.picture.crew != null) return;
    const g = this.game;
    for (let k = g.beaten.length - 1; k >= 0; k--) if (LIGHT_KEY.test(g.beaten[k])) g.beaten.splice(k, 1);
    this.forceLit = true;
    this.syncLights(true);
  }

  /* ---------- the score chip, hints ---------- */
  showScore(city) {
    const ui = this.game.ui, st = lightState(this.game);
    ui.setScore?.(city ? { text: st.done ? `Lights ${LIGHTS} / ${LIGHTS} · To the palace!` : `Lights ${st.total} / ${LIGHTS}`, done: st.done } : null);
  }
  hints() {
    const pl = this.game.player, p = pl.pos;
    this.hint('arrive', 'The Sunken City! Its lights swam away. Catch the glowfish!');
    if (this.t > 5) this.hint('swim', `Look where you want to go. Press ${document.body.classList.contains('touch') ? 'Swim' : 'Space'} to kick!`);
    const d = districtAt(p.x, p.z);
    if (d >= 0 && this.t > 2) this.hint(`d${d}`, DISTRICTS[d].say);
    if (lightState(this.game).done && this.inPalace(p)) this.hint('queen', 'Queen Coralia is waiting. Talk to her!');
    const m = this.A.palace.mouth;
    if (!lightState(this.game).done && Math.hypot(p.x - m[0], p.z - m[1]) < 6) this.hint('gate', 'Light all three lanterns to open the palace.');
  }
  place() { // a world made when the player is already deep in the crater (a reload): nothing else to set
    this.t = 0;
  }

  /* ---------- drawing ---------- */
  draw() {
    const d = this.dummy, pl = this.game.player, t = this.clock;
    // the fish
    for (const kind of ['shy', 'darter', 'school']) {
      const list = this.lists[kind], mesh = this.fishMesh[kind];
      list.forEach((f, i) => {
        const hide = f.out;
        const p = f.pos, dx = p[0] - f.prev[0], dz = p[2] - f.prev[2];
        if (Math.abs(dx) + Math.abs(dz) > 1e-4) f.yaw = Math.atan2(dx, dz);
        d.position.set(p[0], p[1], p[2]);
        d.rotation.set(0, f.yaw, Math.sin(t * 9 + i) * 0.25);
        const trem = kind === 'darter' && f.fish.state === 'stuck' ? 1 + 0.15 * Math.sin(t * 60) : 1;
        d.scale.setScalar(hide ? 0.0001 : SIZE[kind] * 2 * trem);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    // the wobbling jars
    let w = 0;
    for (const j of this.jars) {
      if (j.t0 === null) continue;
      const m = this.wobbles[w++];
      if (!m) break;
      const u = this.t - j.t0;
      m.visible = true;
      m.position.set(j.cell[0] + 0.5, j.cell[1] + 0.5, j.cell[2] + 0.5);
      m.rotation.set(0, 0, Math.sin(u * 40) * 0.22 * (1 - u / FISH.shy.wobble));
      m.scale.setScalar(0.98);
    }
    for (; w < this.wobbles.length; w++) this.wobbles[w].visible = false;
    this.drawNet(pl);
    this.drawWater();
    this.drawBeams();
    this.drawShow(pl);
  }
  // the halos, the bulbs, the trail, the flights and the ghost fish (owner 2026-10-27: the game should explain itself)
  drawShow(pl) {
    const d = this.dummy, t = this.clock, near = craterR(pl.pos.x, pl.pos.z) <= LIVE_RULES.active;
    for (const kind of ['shy', 'darter', 'school']) {
      const mesh = this.halo[kind];
      mesh.visible = near;
      this.lists[kind].forEach((f, i) => {
        const p = f.pos, catchable = !f.out && this.catchable(f), peek = !f.out && kind === 'shy';
        d.position.set(p[0], p[1], p[2]); d.rotation.set(0, 0, 0);
        d.scale.setScalar(f.out ? 0.0001 : (catchable ? 2.2 : peek ? 1.3 : 1.8) * (1 + 0.18 * Math.sin(t * 4 + i * 1.3)));
        d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    // the bulbs: lit = the saved lights, but a bulb a fish is still flying into waits for it
    const busy = new Set(this.flying.filter(f => this.clock < f.t0 + VIS.flyTime).map(f => `${f.d}:${f.k}`));
    const demo = this.demo(pl);
    const col = new THREE.Color();
    this.bulbs.visible = this.bulbGlow.visible = near;
    this.A.districts.forEach((dist, i) => {
      for (let k = 0; k < PER_DISTRICT; k++) {
        const j = i * PER_DISTRICT + k, at = bulbAt(dist.lantern, k), lit = k < this.A.lit[i] && !busy.has(`${i}:${k}`), ghost = demo && demo.d === i && k === this.A.lit[i] && demo.glow;
        d.position.set(...at); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix();
        this.bulbs.setMatrixAt(j, d.matrix); this.bulbs.setColorAt(j, col.setHex(lit ? COLORS[dist.kind] : ghost ? 0x7a8a90 : 0x30414a));
        d.scale.setScalar(lit ? 1 + 0.1 * Math.sin(t * 3 + j) : ghost ? 0.8 * demo.glow : 0.0001); d.updateMatrix();
        this.bulbGlow.setMatrixAt(j, d.matrix); this.bulbGlow.setColorAt(j, col.setHex(COLORS[dist.kind]));
      }
    });
    for (const m of [this.bulbs, this.bulbGlow]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // the trail: from you to the lantern of the first fish in your net (dots drifting towards it)
    const target = this.trailTarget();
    let n = 0;
    if (target && this.inCity()) {
      const a = this.centre(), b = target.at, dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz), shown = Math.min(len, VIS.trailLen);
      this.trail.material.color.setHex(COLORS[target.kind]);
      for (let k = 0; k < VIS.trail && len > 2; k++) {
        const f = ((t * 0.5 + k / VIS.trail) % 1), s = 1.2 + f * (shown - 1.2), u = s / len;
        d.position.set(a[0] + dx * u, a[1] + dy * u + Math.sin(t * 3 + k) * 0.15, a[2] + dz * u); d.rotation.set(t + k, t * 0.7, 0);
        d.scale.setScalar(Math.sin(Math.PI * f) * (s > shown - 2 && shown < len ? 0.4 : 1)); d.updateMatrix();
        this.trail.setMatrixAt(n++, d.matrix);
      }
    }
    this.trail.count = n; this.trail.instanceMatrix.needsUpdate = true;
    // the flights into the bulbs, and the ghost fish
    this.flying = this.flying.filter(f => this.clock < f.t0 + VIS.flyTime + 0.1);
    const fl = this.flying.filter(f => this.clock >= f.t0).map(f => ({ k: Math.min(1, (this.clock - f.t0) / VIS.flyTime), from: f.from, to: f.to, kind: f.kind, a: 1 }));
    if (demo && demo.swim != null) fl.push({ k: demo.swim, from: demo.from, to: demo.to, kind: demo.kind, a: 0.6 });
    n = 0;
    for (const f of fl.slice(0, VIS.fly)) {
      const e = f.k * f.k * (3 - 2 * f.k), arc = Math.sin(Math.PI * f.k) * 1.5;
      d.position.set(f.from[0] + (f.to[0] - f.from[0]) * e, f.from[1] + (f.to[1] - f.from[1]) * e + arc, f.from[2] + (f.to[2] - f.from[2]) * e);
      d.rotation.set(0, 0, 0); d.scale.setScalar(f.a); d.updateMatrix();
      this.flyMesh.setMatrixAt(n, d.matrix); this.flyMesh.setColorAt(n, col.setHex(COLORS[f.kind]));
      d.scale.setScalar(f.a * (1.2 + 0.2 * Math.sin(t * 8))); d.updateMatrix();
      this.flyGlow.setMatrixAt(n, d.matrix); this.flyGlow.setColorAt(n, col.setHex(COLORS[f.kind]));
      n++;
    }
    for (const m of [this.flyMesh, this.flyGlow]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  // Where the trail leads: the lantern of the first fish in the net whose district still needs lights (null = no trail).
  trailTarget() {
    const st = lightState(this.game);
    for (const f of this.net) {
      const i = DISTRICTS.findIndex(d => d.kind === f.kind);
      if (i >= 0 && st.lit[i] < PER_DISTRICT) return { at: bulbAt(this.A.districts[i].lantern, st.lit[i]), kind: f.kind, d: i };
    }
    return null;
  }
  // The ghost fish: before your first catch, in a dark district near its lantern, a ghost glowfish swims from the district's fish into
  // the next bulb and lights it for a moment, every VIS.demo.period seconds. -> null or { d, kind, from, to, swim (0..1 or null), glow (0..1) }
  demo(pl) {
    const D = VIS.demo;
    if (this.caught || this.net.length || this.forceLit || !this.inCity()) return null;
    const st = lightState(this.game);
    const i = this.A.districts.findIndex((dist, k) => st.lit[k] < PER_DISTRICT && Math.hypot(dist.lantern.centre[0] - pl.pos.x, dist.lantern.centre[2] - pl.pos.z) < D.near);
    if (i < 0) return null;
    const dist = this.A.districts[i], kind = dist.kind, list = this.lists[kind], f = list.find(q => !q.out) ?? list[0];
    const from = kind === 'shy' ? f.home : f.pos, to = bulbAt(dist.lantern, st.lit[i]), u = this.clock % D.period;
    return { d: i, kind, from, to, swim: u < D.swim ? u / D.swim : null, glow: u >= D.swim && u < D.swim + D.glow ? Math.sin(Math.PI * (u - D.swim) / D.glow) : 0 };
  }
  drawNet(pl) {
    const near = this.inCity() && this.diving, r = this.ring;
    r.visible = near;
    this.carry.visible = near && this.net.length > 0;
    if (!near) return;
    const f = pl.forward, e = this.eye(), coil = this.held ? Math.min(1, (this.t - this.held.t0) / FISH.lunge.hold) : 0;
    const c = netCentre(e, [f.x, f.y, f.z]);
    r.position.set(c[0], c[1], c[2]);
    r.quaternion.setFromEuler(this.eul.set(pl.pitch, pl.yaw, 0, 'YXZ'));
    r.scale.setScalar(this.lunge ? 1.35 : 1 - 0.4 * coil);
    r.material.color.setHex(this.lunge ? 0xffffff : coil > 0.95 ? 0xfff2a0 : 0x5af0e0);
    r.material.opacity = 0.55 + 0.4 * Math.max(coil, this.net.length / FISH.carry);
    const d = this.dummy;
    this.net.forEach((fish, i) => {
      const a = this.clock * 2.4 + (i / FISH.carry) * Math.PI * 2, rr = 0.5 * r.scale.x;
      d.position.set(c[0], c[1], c[2]);
      const q = r.quaternion;
      const off = new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0.02).applyQuaternion(q);
      d.position.add(off);
      d.rotation.set(0, 0, 0); d.scale.setScalar(1);
      d.updateMatrix();
      this.carry.setMatrixAt(i, d.matrix);
      this.carry.setColorAt(i, new THREE.Color(COLORS[fish.kind]));
    });
    this.carry.count = this.net.length;
    this.carry.instanceMatrix.needsUpdate = true;
    if (this.carry.instanceColor) this.carry.instanceColor.needsUpdate = true;
  }
  // the whirlpool's spiral and the bubble columns (closed forms of the clock; only near the crater)
  drawWater() {
    const p = this.game.player.pos;
    if (craterR(p.x, p.z) > LIVE_RULES.active) { this.bubbles.visible = false; return; }
    this.bubbles.visible = true;
    const d = this.dummy, t = this.clock;
    let k = 0;
    for (let i = 0; i < 24; i++) {
      const f = (t * 0.45 + i / 24) % 1, a = t * 2 + i * 0.7 + f * 6, rad = WHIRL.r * (0.3 + 0.7 * (1 - f));
      d.position.set(WHIRL.x + 0.5 + Math.cos(a) * rad, 12.5 - 10.5 * f, WHIRL.z + 0.5 + Math.sin(a) * rad);
      d.rotation.set(a, a, 0); d.scale.setScalar(0.6 + 0.8 * (1 - f)); d.updateMatrix();
      this.bubbles.setMatrixAt(k++, d.matrix);
    }
    this.A.bubbles.forEach(([x, z], c) => {
      for (let i = 0; i < 8; i++) {
        const f = (t * 0.6 + i / 8 + c * 0.13) % 1;
        d.position.set(x + 0.5 + Math.sin(t * 1.7 + i * 2 + c) * 0.7, 2 + 10.5 * f, z + 0.5 + Math.cos(t * 1.3 + i * 3) * 0.7);
        d.rotation.set(0, 0, 0); d.scale.setScalar(0.5 + 0.7 * ((i * 7) % 5) / 5); d.updateMatrix();
        this.bubbles.setMatrixAt(k++, d.matrix);
      }
    });
    this.bubbles.instanceMatrix.needsUpdate = true;
  }
  // a beam of light from each finished lantern to the palace dome
  drawBeams() {
    if (!this.beamsDirty) return;
    this.beamsDirty = false;
    const d = this.dummy, top = new THREE.Vector3(CITY.x + 0.5, 12, CITY.z + 0.5);
    let n = 0;
    this.A.districts.forEach((dist, i) => {
      if (this.A.lit[i] < PER_DISTRICT) return;
      const a = new THREE.Vector3(dist.lantern.centre[0], dist.lantern.box.y1 + 1, dist.lantern.centre[2]);
      const len = a.distanceTo(top);
      d.position.copy(a).add(top).multiplyScalar(0.5);
      d.lookAt(top);
      d.scale.set(1, 1, len); d.updateMatrix();
      this.beams.setMatrixAt(n++, d.matrix);
    });
    this.beams.count = n;
    this.beams.instanceMatrix.needsUpdate = true;
  }

  /* ---------- for the specs ---------- */
  info() {
    return {
      t: this.t, net: this.net.map(f => f.id), held: !!this.held, lunge: this.lunge ? { t: this.lunge.t, L: this.lunge.L } : null, lit: [...this.A.lit], forceLit: this.forceLit,
      fish: this.fish.map(f => ({ id: f.id, kind: f.kind, out: f.out, poured: !!f.poured, pos: [...f.pos], state: f.kind === 'darter' ? f.fish.state : f.kind === 'shy' ? shyAt(f.home, this.t, f.pop).state : 'school' })),
      jars: this.jars.map(j => ({ cell: j.cell, fish: j.fish, wobble: j.t0 !== null })),
      glow: this.glow(), gate: this.A.palace.gate.map(([x, y, z]) => this.world.get(x, y, z)),
      show: { trail: this.trail.count, flying: this.flyMesh.count, demo: !!this.demo(this.game.player), target: this.trailTarget()?.d ?? null },
    };
  }
}
