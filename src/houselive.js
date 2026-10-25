// T40a: the Giant House's gadgets (LIVE.house): a fan that blows you up to the shelf, a toy train you ride (and call), a tap that fills
// the sink and a river groove with a bottle cap to float on, a sleeping cat you tiptoe past, and twelve crumbs to pick up.
// Everything is per player (like gym live parts: a friend sees their own train) and every timing is a closed form of `this.clock`
// (summed frame dt, frozen in battles) or of a Mover's own clock. Blocks change only with LiveCells / world.setLive (never an edit);
// the meshes (train 3 draw calls, cap 1, blades 1, wind 1, zzz 3) are made here and removed in dispose().
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { Watcher } from './sneak.js';
import { Mover, PATHS } from './mover.js';
import { sound } from './sound.js';
import { FAN, TRACK, GROOVE, SINK, TAP, CAT, CRUMBS, CAP_LINES, trackInfo } from './giantland.js';

export const HOUSE = {
  trainSpeed: 9, capSpeed: 3, flow: 12,              // blocks per second: the train, the cap, the water front
  boardR: 5, capR: 1.0, capWait: 0.6,                // how close you stand to the train's stop / the cap, and how long before the cap takes you
  catWake: 5, catHear: 9, runSpeed: 5, noiseEvery: 0.5,
};
export const crumbKey = i => `pw:house:crumb${i}`;

// Boxes [w, h, d, colour, x, y, z] -> one geometry with vertex colours (one draw call per car).
function merged(boxes) {
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color();
  for (const [w, h, d, color, x, y, z] of boxes) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    const base = pos.length / 3;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    c.setHex(color);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
    idx.push(...Array.from(g.index.array, i => i + base));
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
const BLACK = 0x22222a;
const engineBoxes = () => [
  [1.5, 0.3, 3.0, 0x2a2a34, 0, 0.35, 0], [1.1, 0.9, 1.9, 0xd83a3a, 0, 0.95, -0.5], [1.5, 1.3, 1.0, 0xffd23a, 0, 1.15, 0.95], [1.8, 0.12, 1.3, 0xd83a3a, 0, 1.85, 0.95],
  [0.38, 0.6, 0.38, 0x222228, 0, 1.65, -1.05], [0.5, 0.12, 0.5, 0x444450, 0, 1.97, -1.05], [0.9, 0.5, 0.06, 0xffffff, 0, 0.95, -1.48],
  ...[[-1, -0.9], [1, -0.9], [-1, 0.5], [1, 0.5]].map(([s, z]) => [0.12, 0.6, 0.6, BLACK, s * 0.78, 0.3, z]),
];
const wagonBoxes = color => [
  [1.7, 0.15, 3.0, 0x3a3a44, 0, 0.3, 0], [0.12, 0.8, 3.0, color, -0.79, 0.75, 0], [0.12, 0.8, 3.0, color, 0.79, 0.75, 0], [1.7, 0.8, 0.12, color, 0, 0.75, -1.44], [1.7, 0.8, 0.12, color, 0, 0.75, 1.44],
  ...[[-1, -0.9], [1, -0.9], [-1, 0.9], [1, 0.9]].map(([s, z]) => [0.12, 0.5, 0.5, BLACK, s * 0.88, 0.25, z]),
];

// A stripy texture for the wind (light streaks running up).
function windTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 32, 64);
  for (const [x, w, a] of [[3, 3, 0.7], [11, 2, 0.5], [18, 4, 0.8], [26, 2, 0.5]]) { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, `rgba(255,255,255,0)`); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, 64); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}
function zTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(60,70,150,0.9)'; g.strokeText('z', 32, 34);
  g.fillStyle = '#ffffff'; g.fillText('z', 32, 34);
  return new THREE.CanvasTexture(c);
}

export class HouseLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    this.world = game.world;
    this.h = this.world.house;
    this.clock = 0;
    this.cells = new LiveCells(this.world, () => game.player);
    this.told = new Set();
    this.lastSay = -9;
    this.acc = 0;
    this.meshes = [];
    this.fanOn = false;
    this.tapOn = false; this.tOn = -99; this.tOff = -99;
    this.boardT = 0;
    this.noiseT = 0;
    this.awake = false;
    this.crumbAcc = 0;
    this.found = new Set();
    this.setupFan(); this.setupTrain(); this.setupWater(); this.setupCap(); this.setupCat();
    this.syncCrumbs();
  }

  /* ---------------------------------- small helpers ---------------------------------- */
  say(key, text) { // a hint toast, once per visit, never two in the same second (of the house's own clock)
    if (this.told.has(key)) return false;
    if (this.clock - this.lastSay < 1) return false;
    this.told.add(key);
    this.lastSay = this.clock;
    this.game.ui.toast(text);
    return true;
  }
  toast(text) { this.lastSay = this.clock; this.game.ui.toast(text); }
  add(mesh) { this.game.scene.add(mesh); this.meshes.push(mesh); return mesh; }
  playerNear(x, z, r) { const p = this.game.player.pos; return Math.hypot(p.x - x, p.z - z) <= r; }

  /* ---------------------------------- the fan ---------------------------------- */
  setupFan() {
    const [cx, cz] = FAN.c;
    const blades = [];
    for (let k = 0; k < 4; k++) {
      const g = new THREE.BoxGeometry(2.4, 0.06, 0.9);
      g.translate(1.5, 0, 0);
      g.rotateY((k * Math.PI) / 2);
      blades.push(g);
    }
    const hub = new THREE.BoxGeometry(0.8, 0.14, 0.8);
    const geos = [...blades, hub];
    const pos = [], nor = [], idx = [];
    for (const g of geos) { const base = pos.length / 3; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); idx.push(...Array.from(g.index.array, i => i + base)); g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    this.blades = this.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xbfe4ff, side: THREE.DoubleSide })));
    this.blades.position.set(cx, 4.08, cz);
    const L = FAN.lift, sx = L.x[1] - L.x[0] + 1, sz = L.z[1] - L.z[0] + 1, sy = L.y[1] - L.y[0] + 1;
    this.windTex = windTexture();
    this.wind = this.add(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ map: this.windTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    this.wind.position.set(L.x[0] + sx / 2, L.y[0] + sy / 2, L.z[0] + sz / 2);
    this.wind.visible = false;
    this.drawSwitch();
  }
  drawSwitch() { for (const [x, y, z] of FAN.switch) this.world.setLive(x, y, z, this.fanOn ? B.FAN_SWITCH_ON : B.FAN_SWITCH); }
  toggleFan() {
    this.fanOn = !this.fanOn;
    const lifts = this.world.lifts;
    const at = lifts.indexOf(FAN.lift);
    if (this.fanOn && at < 0) lifts.push(FAN.lift);
    if (!this.fanOn && at >= 0) lifts.splice(at, 1);
    this.wind.visible = this.fanOn;
    this.drawSwitch();
    if (this.fanOn) sound.play('whoosh');
    this.toast(this.fanOn ? 'Fan on! Step on the grill and ride the wind up!' : 'Fan off.');
  }
  updateFan(dt) {
    this.blades.rotation.y += dt * (this.fanOn ? 14 : 0.5);
    if (this.fanOn) this.windTex.offset.y = -(this.clock * 1.2) % 1;
    if (this.playerNear(FAN.c[0], FAN.c[1], 10)) this.say('fan', 'A giant fan! Turn it on and ride the wind up to the shelf.');
  }

  /* ---------------------------------- the toy train ---------------------------------- */
  setupTrain() {
    this.line = PATHS.line({ points: TRACK.points, speed: 1 });         // at(s) = the point s blocks along the whole track
    const info = trackInfo();
    this.cum = info.cum; this.total = info.total; this.sOf = info.sOf;
    const toN = info.toN;
    const speed = HOUSE.trainSpeed;
    this.toN = new Mover({ path: PATHS.line({ points: toN, speed }), run: 'ride', canLeave: true, mesh: null, onEnd: () => this.arrived('N') });
    this.toS = new Mover({ path: PATHS.line({ points: [...toN].reverse(), speed }), run: 'ride', canLeave: true, mesh: null, onEnd: () => this.arrived('S') });
    this.train = { at: 'S', s: this.sOf.S, dir: 1, run: null };
    this.cars = [0xd83a3a, 0x3a7ad8, 0x4ab84a].map((color, i) => {
      const geo = merged(i === 0 ? engineBoxes() : wagonBoxes(color));
      const m = this.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
      m.rotation.order = 'YXZ';
      return m;
    });
    this.drawTrain();
  }
  trainS() { // where the train is now (arc length) and which way it faces
    const t = this.train, r = t.run;
    if (!r) return t.s;
    const travelled = r.mover ? r.mover.clock * HOUSE.trainSpeed : (this.clock - r.t0) * HOUSE.trainSpeed;
    return Math.max(0, Math.min(this.total, r.sFrom + r.dir * travelled));
  }
  drawTrain() {
    const t = this.train, s = this.trainS(), dir = t.run ? t.run.dir : t.dir;
    this.cars.forEach((m, i) => {
      const cs = Math.max(0, Math.min(this.total, s + dir * (i === 0 ? 5 : i === 1 ? 0 : -5)));
      const a = this.line.at(cs), b = this.line.at(Math.min(this.total, cs + 0.5)), a2 = this.line.at(Math.max(0, cs - 0.5));
      const run = Math.hypot(b.x - a2.x, b.z - a2.z) || 1, rise = b.y - a2.y;
      m.position.set(a.x, a.y - (a.y > 5 ? 0.7 : 0.5), a.z);
      m.rotation.y = a.yaw + (dir < 0 ? Math.PI : 0);
      m.rotation.x = Math.atan2(rise, run) * (dir < 0 ? -1 : 1);
    });
  }
  arrived(station) {
    const t = this.train;
    t.at = station; t.s = this.sOf[station]; t.run = null;
    this.toast('Here we are!');
  }
  pressRemote(block) {
    const t = this.train, game = this.game, p = game.player;
    const station = block.x < 100 ? 'S' : 'N';
    if (t.run) { this.toast('The train is on its way!'); return; }
    if (t.at === station) {
      const stop = TRACK.stops[station];
      if (Math.hypot(p.pos.x - stop[0], p.pos.z - stop[2]) > HOUSE.boardR) { this.toast('Stand by the train, then press the button!'); return; }
      const mover = station === 'S' ? this.toN : this.toS;
      game.riding?.stop('quiet');
      mover.board(p);
      const dir = station === 'S' ? 1 : -1;
      t.run = { kind: 'ride', dir, sFrom: this.sOf[station], mover, t0: this.clock };
      this.toast('All aboard! Choo choo!');
      sound.play('choochoo');
    } else { // call it: an empty run to this station
      const other = station === 'S' ? 'N' : 'S';
      t.run = { kind: 'call', dir: this.sOf[station] > this.sOf[other] ? 1 : -1, sFrom: this.sOf[other], mover: null, t0: this.clock };
      this.toast('Here it comes!');
      sound.play('choochoo');
    }
  }
  updateTrain(dt) {
    const t = this.train, r = t.run;
    if (r?.mover) {
      r.mover.update(dt);
      if (!r.mover.rider && t.run === r && r.mover.clock > 0) { // you jumped off: the train goes on without you
        const sNow = this.trainS();
        r.mover.clock = 0;
        t.run = { kind: 'call', dir: r.dir, sFrom: sNow, mover: null, t0: this.clock };
      }
    } else if (r) {
      const sNow = r.sFrom + r.dir * (this.clock - r.t0) * HOUSE.trainSpeed, dest = r.dir > 0 ? this.sOf.N : this.sOf.S;
      if ((r.dir > 0 && sNow >= dest) || (r.dir < 0 && sNow <= dest)) this.arrived(r.dir > 0 ? 'N' : 'S');
    }
    if (t.run) t.dir = t.run.dir;
    this.drawTrain();
  }

  /* ---------------------------------- the tap, the river and the bottle cap ---------------------------------- */
  setupWater() {
    const cells = [];
    for (let y = TAP.stream.y[0]; y <= TAP.stream.y[1]; y++) cells.push({ x: TAP.stream.x, y, z: TAP.stream.z, d: TAP.stream.y[1] - y, on: false });
    for (let x = SINK.basin.x[0]; x <= SINK.basin.x[1]; x++) for (let z = SINK.basin.z[0]; z <= SINK.basin.z[1]; z++) for (let y = SINK.basin.y[0]; y <= SINK.basin.y[1]; y++) {
      cells.push({ x, y, z, d: 5 + Math.hypot(x - TAP.stream.x, z - TAP.stream.z), on: false });
    }
    for (let x = GROOVE.x[0]; x <= GROOVE.x[1]; x++) for (let z = GROOVE.z[0]; z <= GROOVE.z[1]; z++) cells.push({ x, y: GROOVE.y, z, d: 25 + (x - GROOVE.x[0]), on: false });
    this.water = cells;
  }
  toggleTap() {
    this.tapOn = !this.tapOn;
    if (this.tapOn) { this.tOn = this.clock; sound.play('gurgle'); } else this.tOff = this.clock;
    this.toast(this.tapOn ? 'The tap is on! Water is coming...' : 'The tap is off.');
    this.updateWater(true);
  }
  updateWater(force = false) {
    const w = this.world;
    const front = (this.clock - this.tOn) * HOUSE.flow, drain = (this.clock - this.tOff) * HOUSE.flow;
    for (const c of this.water) {
      const wet = this.tOn > -90 && front >= c.d && !(this.tOff > this.tOn && drain >= c.d);
      if (wet === c.on && !force) continue;
      const cur = w.get(c.x, c.y, c.z);
      if (cur !== B.AIR && cur !== B.WATER) continue;
      c.on = wet;
      w.setLive(c.x, c.y, c.z, wet ? B.WATER : B.AIR);
    }
  }
  setupCap() {
    const z = 15.5;
    this.east = new Mover({ path: PATHS.line({ points: CAP_LINES.east, speed: HOUSE.capSpeed }), run: 'ride', canLeave: true, mesh: null, onEnd: () => this.capEnded('E') });
    this.west = new Mover({ path: PATHS.line({ points: CAP_LINES.west, speed: HOUSE.capSpeed }), run: 'ride', canLeave: true, mesh: null, onEnd: () => this.capEnded('W') });
    this.dock = 'W';
    this.docks = { W: [50.5, 30.9, z], E: [96.5, 30.9, z] };
    const geo = new THREE.CylinderGeometry(1.3, 1.3, 0.35, 12);
    const cap = this.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xd83a3a, flatShading: true })));
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.04, 12), new THREE.MeshLambertMaterial({ color: 0xffd0d0 }));
    lid.position.y = 0.19;
    cap.add(lid);
    this.capMesh = cap;
    this.capRider = null;
    this.placeCap();
  }
  placeCap() { const d = this.docks[this.dock]; this.capMesh.position.set(d[0], d[1] - 0.1, d[2]); }
  capEnded(dock) { this.dock = dock === 'E' ? 'E' : 'W'; this.capRider = null; this.placeCap(); this.toast(dock === 'E' ? 'Dry land! Jump back in to float again.' : 'Back at the tap!'); }
  dockWet(d) { const w = this.world; for (let dz = -1; dz <= 1; dz++) if (w.get(Math.floor(d[0]), GROOVE.y, Math.floor(d[2]) + dz) !== B.WATER) return false; return true; }
  updateCap(dt) {
    const g = this.game, p = g.player, rider = this.capRider;
    if (rider) {
      rider.update(dt);
      if (!rider.rider && rider.clock > 0) { // jumped off mid-river: the cap goes back to the nearer dock
        this.dock = p.pos.x < 73 ? 'W' : 'E'; rider.clock = 0; this.capRider = null; this.placeCap();
      } else if (this.capRider) { const w = rider.where(); this.capMesh.position.set(w.x, w.y - 0.2, w.z); }
      return;
    }
    const d = this.docks[this.dock];
    if (!p.carry && this.dockWet(d) && Math.hypot(p.pos.x - d[0], p.pos.z - d[2]) <= HOUSE.capR && p.pos.y >= 29.9 && p.pos.y <= 31.9) {
      this.boardT += dt;
      if (this.boardT >= HOUSE.capWait) {
        this.boardT = 0;
        g.riding?.stop('quiet');
        const m = this.dock === 'W' ? this.east : this.west;
        m.board(p);
        this.capRider = m;
        this.say('cap', 'Wheee! You float on the bottle cap. Jump to hop off.');
        sound.play('gurgle');
      }
    } else this.boardT = 0;
  }

  /* ---------------------------------- the sleeping cat ---------------------------------- */
  setupCat() {
    this.cat = new Watcher({ id: 'cat', path: [CAT.ear], hear: HOUSE.catHear, turn: HOUSE.catWake, range: 6, angle: 0.9, y: 15 });
    this.tail = [];
    for (const [x0, x1, z0, z1, y0, y1] of CAT.tailUp) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) this.tail.push([x, y, z]);
    const tex = zTexture();
    this.zs = [0, 1, 2].map(() => {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const s = new THREE.Sprite(m);
      s.scale.set(1.3, 1.3, 1);
      return this.add(s);
    });
    this.zTex = tex;
    this.drawCat();
  }
  drawCat() {
    const awake = this.awake, w = this.world;
    for (const [x, y, z] of CAT.eyes) w.setLive(x, y, z, awake ? B.CAT_EYE_OPEN : B.CAT_EYE);
    for (const [x, y, z] of this.tail) this.cells.want(x, y, z, awake ? B.CAT_FUR : B.AIR);
    this.zs.forEach(s => { s.visible = !awake; });
  }
  updateCat(dt) {
    const g = this.game, p = g.player, pos = p.pos;
    const onBench = Math.abs(pos.y - 15) < 2.5 && pos.x >= 56 && pos.x <= 136 && pos.z >= 84 && pos.z <= 99;
    if (onBench) this.say('bench', "A sleeping cat! Tiptoe past it. Walk, don't run.");
    this.noiseT += dt;
    if (onBench && Math.hypot(p.vel.x, p.vel.z) > HOUSE.runSpeed && this.noiseT >= HOUSE.noiseEvery) {
      this.noiseT = 0;
      this.cat.hearNoise(pos.x, pos.z);
    }
    this.cat.update(dt);
    const awake = !!this.cat.noise;
    if (awake !== this.awake) {
      this.awake = awake;
      this.drawCat();
      if (awake) {
        sound.play('mrrow');
        if (!this.told.has('woke')) this.say('woke', g.isTouch?.() ? 'Mrrow? The cat woke up a bit! Wait until it falls asleep again. Push the stick only a little to tiptoe.' : "Mrrow? The cat woke up a bit! Wait until it falls asleep again. Walk, don't run!");
      }
    }
    if (!this.awake) this.zs.forEach((s, i) => { const k = (this.clock * 0.5 + i / 3) % 1; s.position.set(94.5 + k * 0.6, 23 + k * 3, 93.5); s.material.opacity = Math.sin(Math.PI * k); });
  }

  /* ---------------------------------- crumbs ---------------------------------- */
  syncCrumbs() {
    const beaten = this.game.beaten;
    CRUMBS.forEach(([x, y, z], i) => {
      if (beaten.includes(crumbKey(i))) { this.found.add(i); if (this.world.get(x, y, z) === B.CRUMB) this.world.setLive(x, y, z, B.AIR); }
    });
  }
  crumbAt(block) { return CRUMBS.findIndex(([x, y, z]) => x === block.x && y === block.y && z === block.z); }
  pickCrumb(block) {
    const i = this.crumbAt(block), g = this.game;
    if (i < 0) return false;
    if (g.beaten.includes(crumbKey(i))) { this.world.setLive(block.x, block.y, block.z, B.AIR); return true; }
    g.beaten.push(crumbKey(i));
    this.found.add(i);
    g.cubes++;
    this.world.setLive(block.x, block.y, block.z, B.AIR);
    const n = CRUMBS.filter((_, k) => g.beaten.includes(crumbKey(k))).length;
    sound.play('cube');
    if (n >= CRUMBS.length) { g.cubes += 5; g.ui.toast('You found every crumb in the house! +5 bonus Capture Cubes'); } else g.ui.toast(`A crumb! +1 Capture Cube (${n} of ${CRUMBS.length})`);
    g.ui.renderHud();
    g.save?.();
    return true;
  }

  /* ---------------------------------- the gymLive interface ---------------------------------- */
  update(dt) {
    const g = this.game;
    if (g.inBattle) return;
    this.clock += dt;
    this.cells.flush();
    this.updateFan(dt);
    this.updateTrain(dt);
    this.updateCap(dt);
    this.updateCat(dt);
    this.acc += dt;
    if (this.acc >= 0.2) {
      this.acc = 0;
      this.updateWater();
      if (this.playerNear(36, 14, 8)) this.say('tap', 'Turn on the tap! Then float down the river on the bottle cap.');
      if (g.creatures?.list.some(w => w.pos.distanceTo(g.player.pos) < 12)) this.say('tiny', 'Tiny creatures hide in cups, flowers and under leaves. Look closely!');
    }
    this.crumbAcc += dt;
    if (this.crumbAcc >= 0.25) { this.crumbAcc = 0; this.syncCrumbs(); }
  }

  hit(block) {
    switch (block.id) {
      case B.FAN_SWITCH: case B.FAN_SWITCH_ON: this.toggleFan(); return true;
      case B.REMOTE_BUTTON: this.pressRemote(block); return true;
      case B.TAP_HANDLE: this.toggleTap(); return true;
      case B.CRUMB: return this.pickCrumb(block);
      case B.KEYHOLE: this.toast('A brass keyhole. You are small enough to squeeze through!'); return true;
      case B.CAT_FUR: case B.CAT_EYE: case B.CAT_EYE_OPEN: this.toast('Shh... let it sleep. Tiptoe past!'); return true;
      default: return false;
    }
  }
  prompt(block, how) {
    switch (block.id) {
      case B.FAN_SWITCH: case B.FAN_SWITCH_ON: return `Fan switch · ${how} to turn it ${this.fanOn ? 'off' : 'on'}`;
      case B.REMOTE_BUTTON: {
        const station = block.x < 100 ? 'S' : 'N';
        return this.train.run ? 'Toy train · on its way...' : this.train.at === station ? `Toy train remote · ${how} to ride` : `Toy train remote · ${how} to call the train`;
      }
      case B.TAP_HANDLE: return `Tap · ${how} to turn it ${this.tapOn ? 'off' : 'on'}`;
      case B.CRUMB: return `Cookie crumb · ${how} to pick it up`;
      case B.KEYHOLE: return 'Keyhole · you are small enough to squeeze through!';
      case B.CAT_FUR: case B.CAT_EYE: case B.CAT_EYE_OPEN: return this.awake ? 'Cat · shh, wait...' : 'Sleeping cat · shh!';
      default: return null;
    }
  }
  action(block) {
    switch (block.id) {
      case B.FAN_SWITCH: case B.FAN_SWITCH_ON: return this.fanOn ? 'Fan off' : 'Fan on!';
      case B.REMOTE_BUTTON: return this.train.run ? 'Wait...' : this.train.at === (block.x < 100 ? 'S' : 'N') ? 'Ride!' : 'Call train!';
      case B.TAP_HANDLE: return this.tapOn ? 'Tap off' : 'Turn tap!';
      case B.CRUMB: return 'Pick up!';
      case B.KEYHOLE: return 'Squeeze!';
      case B.CAT_FUR: case B.CAT_EYE: case B.CAT_EYE_OPEN: return 'Shh!';
      default: return null;
    }
  }

  // for the guide (giantland.js houseAim) and the specs
  trainAt() { return this.train.run ? null : this.train.at; }
  trainMover(m) { return m === this.toN || m === this.toS; }
  capMover(m) { return m === this.east || m === this.west; }
  catAwake() { return this.awake; }

  dispose() {
    const p = this.game.player;
    for (const m of [this.toN, this.toS, this.east, this.west]) if (p && p.carry === m) p.carry = null;
    const lifts = this.world.lifts, at = lifts ? lifts.indexOf(FAN.lift) : -1;
    if (at >= 0) lifts.splice(at, 1);
    for (const m of this.meshes) {
      this.game.scene.remove(m);
      m.geometry?.dispose();
      if (m.material) { m.material.map?.dispose?.(); m.material.dispose(); }
      for (const c of m.children) { c.geometry?.dispose(); c.material?.dispose(); }
    }
    this.meshes = [];
    this.windTex?.dispose();
    this.zTex?.dispose();
  }
}
