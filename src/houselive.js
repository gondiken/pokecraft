// T40a: the Giant House's gadgets (LIVE.house). T40a.5 (owner 2026-10-26: "more puzzles, less walking", "the visuals should say what a
// thing is"): a toy train to the fan; a tea towel over the fan and a wind-up key that runs it for FAN.time seconds (pull the towel off,
// wind the key, run into the wind); a plug and a tap (the plug first, then the tap fills the sink and the deep river; the bottle cap
// floats you along it); a cat asleep on the book stairs (push the yarn off the counter: it jumps down after it and plays for CAT.away
// seconds); a marble you roll down a ruler onto a spoon seesaw (stand in the bowl when it lands: it flings you into Nibbles' fort,
// whose back door opens only from inside); twelve crumbs (all twelve: world.allCrumbs, and Pipsqueak comes out of hiding).
// The puzzle things are models (houseprops.js) over hidden HOUSE_PROP cells.
// Everything is per player (like gym live parts: a friend sees their own train) and every timing is a closed form of `this.clock`
// (summed frame dt, frozen in battles) or of a Mover's own clock. Blocks change only with LiveCells / world.setLive (never an edit);
// the meshes (train 3 draw calls, cap 1, blades 1, wind 1, zzz 3, the props) are made here and removed in dispose().
import * as THREE from 'three';
import { B, WOOL } from './blocks.js';
import { LiveCells } from './livecells.js';
import { Mover, PATHS } from './mover.js';
import { sound } from './sound.js';
import { FAN, TRACK, GROOVE, SINK, TAP, CAT, CRUMBS, CAP_LINES, SEESAW, FORT, BOOK_STAIRS, trackInfo } from './giantland.js';
import { buildCat, buildYarn, buildPlug, buildWindKey, buildTowel, buildSpoonSeesaw, buildMarble, buildRuler, buildNote, NOTES } from './houseprops.js';

export const HOUSE = {
  trainSpeed: 9, capSpeed: 3, flow: 12,              // blocks per second: the train, the cap, the water front
  boardR: 5, capR: 1.0, capWait: 0.6,                // how close you stand to the train's stop / the cap, and how long before the cap takes you
  catJump: 1.1, catWake: 0.6,                        // T40a.5: the cat's jump down / up (s), and how long after the yarn lands it gets up
  flip: 0.25, fling: 1.6, reset: 2.5,                // the spoon's flip, the flight into the fort, the marble's way back to the stack (s)
};
const FULL = 25 + (GROOVE.x[1] - GROOVE.x[0]); // the water front's distance when the whole river is full
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

const flat = (a, b) => Math.hypot(a.x - b[0], a.z - b[2]);
const inBox = (p, x0, x1, z0, z1) => p.x >= x0 && p.x < x1 + 1 && p.z >= z0 && p.z < z1 + 1;
const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
// A jump from a to b with its top `h` above the higher end, at k in 0..1 (the cat's leaps, the yarn's fall).
function hop(a, b, h, k) {
  k = Math.max(0, Math.min(1, k));
  const top = Math.max(a[1], b[1]) + h, y = k < 0.5 ? a[1] + (top - a[1]) * (1 - (1 - 2 * k) ** 2) : b[1] + (top - b[1]) * (1 - (2 * k - 1) ** 2);
  return [a[0] + (b[0] - a[0]) * k, y, a[2] + (b[2] - a[2]) * k];
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
    this.props = [];
    this.boardT = 0;
    this.crumbAcc = 0;
    this.found = new Set();
    this.setupFan(); this.setupTrain(); this.setupWater(); this.setupCap(); this.setupCat(); this.setupSeesaw(); this.setupNotes();
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
  prop(group, [x, y, z], ry = 0) { group.position.set(x, y, z); group.rotation.y = ry; this.game.scene.add(group); this.props.push(group); return group; }
  playerNear(x, z, r) { const p = this.game.player.pos; return Math.hypot(p.x - x, p.z - z) <= r; }
  at(cell, ...list) { return list.some(c => c[0] === cell.x && c[1] === cell.y && c[2] === cell.z); }

  /* ---------------------------------- the fan: a tea towel over it, a wind-up key that runs it ---------------------------------- */
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
    this.towelOn = true; this.towelT = -9; this.runUntil = -9;
    this.towel = this.prop(buildTowel(), [cx, 1, cz], 0.3);
    this.towelFloor = this.prop(buildTowel({ size: 11, steps: [] }), [cx + 9.5, 1, cz + 3], 0.9);
    this.towelFloor.visible = false;
    this.key = this.prop(buildWindKey(), FAN.key.at, 0);
  }
  fanRunning() { return this.clock < this.runUntil || (this.runUntil > 0 && this.inWind()); }
  inWind() { const p = this.game.player.pos, L = FAN.lift; return inBox(p, L.x[0], L.x[1], L.z[0], L.z[1]) && p.y < L.y[1] + 1.5 && p.y >= L.y[0] - 0.5; }
  pullTowel() {
    if (!this.towelOn) return false;
    this.towelOn = false; this.towelT = this.clock;
    sound.play('whoosh');
    this.toast(this.fanRunning() ? 'Whoosh! The towel is off. Quick, into the wind!' : 'The towel is off! Now wind the key and run back to the fan.');
    return true;
  }
  windKey() {
    this.runUntil = this.clock + FAN.time;
    sound.play('ticktock');
    this.toast(this.towelOn ? 'Whirr! The fan runs... but the towel is in the way! Pull it off.' : `Whirr! The fan runs for ${FAN.time} seconds. Run and jump on the grill!`);
    return true;
  }
  updateFan(dt) {
    const run = this.fanRunning(), blow = run && !this.towelOn;
    const lifts = this.world.lifts, at = lifts.indexOf(FAN.lift);
    if (blow && at < 0) { lifts.push(FAN.lift); sound.play('whoosh'); }
    if (!blow && at >= 0) lifts.splice(at, 1);
    if (!run && this.runUntil > 0 && this.clock >= this.runUntil) { this.runUntil = -9; this.toast('The fan ran down. Wind the key again!'); }
    this.wind.visible = blow;
    this.blades.rotation.y += dt * (run ? 14 : 0.3);
    if (blow) this.windTex.offset.y = -(this.clock * 1.2) % 1;
    this.key.userData.parts.key.rotation.y = run ? -this.clock * 3 : 0;
    // the towel slides off to the floor beside the fan
    const k = ease((this.clock - this.towelT) / 0.7);
    this.towel.visible = this.towelOn || k < 1;
    this.towelFloor.visible = !this.towelOn && k >= 1;
    if (!this.towelOn && k < 1) { this.towel.position.set(FAN.c[0] + 9.5 * k, 1 + 3 * Math.sin(Math.PI * k), FAN.c[1] + 3 * k); this.towel.rotation.y = 0.3 + 0.6 * k; }
    if (this.playerNear(FAN.c[0], FAN.c[1], 12) && this.game.player.pos.y < 6) this.say('fan', 'A giant fan under a tea towel! Look at the yellow note.');
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
  stationOf(block) { const b = TRACK.remotes; return Math.hypot(block.x - b.S.button[0], block.z - b.S.button[2]) < Math.hypot(block.x - b.N.button[0], block.z - b.N.button[2]) ? 'S' : 'N'; }
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
    this.toast(station === 'N' ? 'Here we are! The fan is just over there.' : 'Here we are!');
  }
  pressRemote(block) {
    const t = this.train, game = this.game, p = game.player;
    const station = this.stationOf(block);
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

  /* ---------------------------------- the plug, the tap, the river and the bottle cap ---------------------------------- */
  setupWater() {
    this.tapOn = false;
    this.plugged = false;
    this.level = 0; // how far the water front has got (the same scale as each cell's d); it stays while the plug is in
    const stream = [], cells = [];
    for (let y = TAP.stream.y[0]; y <= TAP.stream.y[1]; y++) stream.push({ x: TAP.stream.x, y, z: TAP.stream.z, on: false });
    for (let x = SINK.basin.x[0]; x <= SINK.basin.x[1]; x++) for (let z = SINK.basin.z[0]; z <= SINK.basin.z[1]; z++) for (let y = SINK.basin.y[0]; y <= SINK.basin.y[1]; y++) {
      cells.push({ x, y, z, d: 5 + Math.hypot(x - TAP.stream.x, z - TAP.stream.z), on: false });
    }
    for (let x = GROOVE.x[0]; x <= GROOVE.x[1]; x++) for (let z = GROOVE.z[0]; z <= GROOVE.z[1]; z++) for (let y = GROOVE.floor; y <= GROOVE.y; y++) cells.push({ x, y, z, d: 25 + (x - GROOVE.x[0]), on: false });
    this.stream = stream;
    this.water = cells;
    const hole = SINK.plug.hole, rim = SINK.plug.rim;
    this.plugRim = this.prop(buildPlug({ chainTo: [-3.5, 0, -1.2] }), [rim[0] + 0.5, rim[1], rim[2] + 0.5], 0);
    this.plugHole = this.prop(buildPlug({ chainTo: [rim[0] - hole[0], 1.6, rim[2] - hole[2]] }), [hole[0] + 0.5, hole[1], hole[2] + 0.5], 0);
    this.plugHole.visible = false;
  }
  plugIn() { return this.plugged; }
  wet() { return this.plugged && this.level >= FULL; }
  togglePlug() {
    const w = this.world, rim = SINK.plug.rim, hole = SINK.plug.hole;
    this.plugged = !this.plugged;
    this.cells.want(...rim, this.plugged ? B.AIR : B.HOUSE_PROP);
    this.cells.want(...hole, this.plugged ? B.HOUSE_PROP : B.AIR);
    this.cells.flush();
    this.plugRim.visible = !this.plugged; this.plugHole.visible = this.plugged;
    sound.play('gurgle');
    this.toast(this.plugged ? (this.tapOn ? 'Plop! The plug is in. Look, the water is rising!' : 'Plop! The plug is in the hole. Now turn on the tap!') : 'You pulled the plug. Glug glug, the water runs away!');
    return true;
  }
  toggleTap() {
    this.tapOn = !this.tapOn;
    if (this.tapOn) sound.play('gurgle');
    this.toast(this.tapOn ? (this.plugged ? 'The tap is on! Water is coming...' : 'The tap is on... but the water runs down the plughole!') : this.plugged && this.level > 0 ? 'The tap is off. The plug keeps the water in.' : 'The tap is off.');
    this.updateWater(true);
  }
  updateWater(force = false, dt = 0) {
    const w = this.world;
    if (this.tapOn && this.plugged) this.level = Math.min(FULL + 5, this.level + dt * HOUSE.flow);
    if (!this.plugged) this.level = Math.max(0, this.level - dt * HOUSE.flow * 2);
    const set = (c, wet) => {
      if (wet === c.on && !force) return;
      const cur = w.get(c.x, c.y, c.z);
      if (cur !== B.AIR && cur !== B.WATER) return;
      c.on = wet;
      w.setLive(c.x, c.y, c.z, wet ? B.WATER : B.AIR);
    };
    for (const c of this.stream) set(c, this.tapOn);
    for (const c of this.water) set(c, this.level >= c.d);
    if (this.tapOn && !this.plugged && this.playerNear(36, 15, 16)) this.say('drain', 'Glug glug! The water runs down the plughole. Put the plug in first!');
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
  placeCap() { const d = this.docks[this.dock], wet = this.dockWet(d); this.capMesh.position.set(d[0], wet ? d[1] - 0.1 : GROOVE.floor + 0.1, d[2]); }
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
    this.placeCap(); // floats up and sinks down with the water
    if (!p.carry && this.dockWet(d) && Math.hypot(p.pos.x - d[0], p.pos.z - d[2]) <= HOUSE.capR + 0.4 && p.pos.y >= 28.4 && p.pos.y <= 31.9) { // T40a.5: you may swim to it
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

  /* ---------------------------------- the cat on the book stairs and the ball of yarn ---------------------------------- */
  setupCat() {
    this.catCells = [];
    const cc = CAT.cells;
    for (let x = cc.x[0]; x <= cc.x[1]; x++) for (let z = cc.z[0]; z <= cc.z[1]; z++) {
      const step = BOOK_STAIRS.steps.find(([z0, z1]) => z >= z0 && z <= z1);
      for (let y = step[2] + 1; y <= cc.top; y++) this.catCells.push([x, y, z]);
    }
    this.catPhase = 'sleep'; this.catT = 0;  // sleep | wake | down | play | up (catT = when the phase began)
    this.yarnState = 'top'; this.yarnT = 0;  // top | fall | floor | carried
    this.catSleep = this.prop(buildCat({ pose: 'sleep' }), CAT.at, Math.PI);
    this.catSleep.rotation.order = 'YXZ'; this.catSleep.rotation.x = CAT.tilt; // along the steps, the head up by the counter
    this.catStand = this.prop(buildCat({ pose: 'stand' }), CAT.at, Math.PI);
    this.catStand.visible = false;
    this.yarn = this.prop(buildYarn(), CAT.yarn.at, 0.6);
    const tex = zTexture();
    this.zs = [0, 1, 2].map(() => {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const s = new THREE.Sprite(m);
      s.scale.set(1.3, 1.3, 1);
      return this.add(s);
    });
    this.zTex = tex;
  }
  catAway() { return this.catPhase === 'down' || this.catPhase === 'play' || (this.catPhase === 'up' && this.clock - this.catT < HOUSE.catJump * 0.6); }
  catAwake() { return this.catPhase !== 'sleep'; }
  pushYarn() {
    if (this.yarnState !== 'top' || this.catPhase !== 'sleep') return false;
    this.yarnState = 'fall'; this.yarnT = this.clock;
    this.cells.want(...CAT.yarn.cell, B.AIR);
    this.toast('Whoops! The yarn rolls off the counter...');
    return true;
  }
  setCatCells(on) { for (const c of this.catCells) this.cells.want(...c, on ? B.HOUSE_PROP : B.AIR); }
  catBoxHasPlayer() { const p = this.game.player.pos, cc = CAT.cells; return p.x > cc.x[0] - 0.4 && p.x < cc.x[1] + 1.4 && p.z > cc.z[0] - 0.4 && p.z < cc.z[1] + 1.4 && p.y > 28 && p.y < cc.top + 1; }
  updateCat() {
    const now = this.clock, since = now - this.catT, p = this.game.player.pos;
    const top = CAT.at, floor = [CAT.play[0] + 0.5, CAT.play[1], CAT.play[2] + 0.5];
    // the yarn
    if (this.yarnState === 'fall') {
      const k = (now - this.yarnT) / 0.9;
      this.yarn.position.set(...hop(CAT.yarn.at, CAT.yarn.floor, 1, k));
      this.yarn.rotation.x = k * 6;
      if (k >= 1) { this.yarnState = 'floor'; sound.play('boing'); if (this.catPhase === 'sleep') { this.catPhase = 'wake'; this.catT = now; sound.play('mrrow'); this.toast('Mrrow? The cat saw the yarn!'); } }
    }
    switch (this.catPhase) {
      case 'wake': if (since >= HOUSE.catWake) { this.catPhase = 'down'; this.catT = now; this.setCatCells(false); } break;
      case 'down': if (since >= HOUSE.catJump) { this.catPhase = 'play'; this.catT = now; this.say('catAway', 'The cat is playing! Quick, down the book stairs!'); } break;
      case 'play': if (since >= CAT.away && !this.catBoxHasPlayer()) { this.catPhase = 'up'; this.catT = now; this.yarnState = 'carried'; } break;
      case 'up': if (since >= HOUSE.catJump && !this.catBoxHasPlayer()) {
        this.catPhase = 'sleep'; this.catT = now; this.setCatCells(true);
        this.yarnState = 'top'; this.cells.want(...CAT.yarn.cell, B.HOUSE_PROP);
        this.yarn.position.set(...CAT.yarn.at); this.yarn.rotation.set(0, 0.6, 0);
      } break;
    }
    // the models: asleep on the books, or standing (jumping, playing)
    const asleep = this.catPhase === 'sleep' || this.catPhase === 'wake';
    this.catSleep.visible = asleep; this.catStand.visible = !asleep;
    if (asleep) { const b = this.catSleep.userData.parts.body, breathe = this.catPhase === 'sleep' ? 1 + 0.03 * Math.sin(now * 2) : 1; b.scale.y = 2.7 * breathe; }
    if (this.catPhase === 'down') { this.catStand.position.set(...hop(top, floor, 4, since / HOUSE.catJump)); this.catStand.rotation.y = Math.PI * 0.6; }
    if (this.catPhase === 'play') {
      this.catStand.position.set(...floor); this.catStand.rotation.y = Math.PI * 0.6 + 0.25 * Math.sin(now * 1.7);
      this.catStand.userData.parts.head.rotation.x = 0.3 + 0.15 * Math.sin(now * 5);
      const paw = this.catStand.userData.parts.legs[0]; if (paw) paw.rotation.x = -0.6 + 0.5 * Math.sin(now * 6);
      this.yarn.position.set(CAT.yarn.floor[0] + Math.sin(now * 1.3) * 1.5, CAT.yarn.floor[1], CAT.yarn.floor[2] + Math.cos(now * 0.9)); this.yarn.rotation.x = now * 2;
    }
    if (this.catPhase === 'up') {
      const k = since / HOUSE.catJump;
      this.catStand.position.set(...hop(floor, top, 4, Math.min(1, k))); this.catStand.rotation.y = Math.PI * 1.1;
      const c = this.catStand.position; this.yarn.position.set(c.x, c.y + 6, c.z - 1); // in its mouth
    }
    this.zs.forEach((s, i) => { s.visible = this.catPhase === 'sleep'; const k = (now * 0.5 + i / 3) % 1; s.position.set(top[0] - 1 + k * 0.6, top[1] + 6 + k * 3, top[2] - 5); s.material.opacity = Math.sin(Math.PI * k); });
    if (this.catPhase === 'sleep' && p.y > 30 && inBox(p, 104, 124, 18, 27)) this.say('cat', 'Shh! A big cat is asleep on the book stairs. Cats LOVE yarn...');
  }

  /* ---------------------------------- the marble, the ruler and the spoon seesaw ---------------------------------- */
  setupSeesaw() {
    const ss = SEESAW, [a, b] = ss.ruler;
    this.seesaw = this.prop(buildSpoonSeesaw(), ss.pivot, -Math.PI / 2);
    const ruler = buildRuler({ length: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) });
    ruler.position.set(...a); ruler.lookAt(...b); this.game.scene.add(ruler); this.props.push(ruler);
    this.marble = this.prop(buildMarble(), ss.marble, 0);
    this.marbleState = 'top'; this.marbleT = 0; // top | roll | drop | flip | back
    this.tilt = -0.42;
    this.fling = null;
  }
  marbleRolling() { return this.marbleState === 'roll' || this.marbleState === 'drop'; }
  inBowl() { const p = this.game.player.pos, ss = SEESAW; return Math.hypot(p.x - ss.bowl[0], p.z - ss.bowl[2]) <= ss.bowlR && p.y < ss.bowl[1] + 1.6 && p.y > ss.bowl[1] - 0.5; }
  rollMarble() {
    if (this.marbleState !== 'top') return false;
    this.marbleState = 'roll'; this.marbleT = this.clock;
    this.toast('The marble rolls down the ruler... jump in the spoon, quick!');
    return true;
  }
  flingMover(m) { return !!m && m === this.fling; }
  updateSeesaw(dt) {
    const ss = SEESAW, now = this.clock, since = now - this.marbleT, [a, b] = ss.ruler, r = 0.45;
    if (this.fling) this.fling.update(dt);
    if (this.marbleState === 'roll') {
      const k = Math.min(1, since / ss.roll);
      this.marble.position.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 0.08, a[2] + (b[2] - a[2]) * k);
      this.marble.rotation.x = k * 30;
      if (k >= 1) { this.marbleState = 'drop'; this.marbleT = now; }
    } else if (this.marbleState === 'drop') {
      const k = Math.min(1, since / 0.35);
      this.marble.position.set(b[0], b[1] + (ss.tip[1] - b[1]) * k * k, b[2] + (ss.tip[2] - b[2]) * k);
      if (k >= 1) { // it lands on the handle: the spoon flips
        this.marbleState = 'flip'; this.marbleT = now;
        sound.play('boing');
        if (this.inBowl()) {
          const p = this.game.player, from = [p.pos.x, p.pos.y, p.pos.z];
          this.game.riding?.stop('quiet');
          this.fling = new Mover({ path: PATHS.arc({ from, to: ss.land, height: 7, time: HOUSE.fling }), run: 'ride', canLeave: false, onEnd: () => { this.fling = null; this.toast("Wheee! You flew into Nibbles' fort!"); } });
          this.fling.board(p);
        } else this.toast('Boing! The spoon flipped, but nobody was in it. Stand in the spoon before the marble lands!');
      }
    } else if (this.marbleState === 'flip') {
      const k = Math.min(1, since / HOUSE.flip);
      this.marble.position.set(ss.tip[0] - 2 * k, ss.tip[1] - (ss.tip[1] - 26.2) * k, ss.tip[2] + 1.5 * k); // it bounces off onto the table
      if (since >= HOUSE.reset) { this.marbleState = 'top'; this.marble.position.set(...ss.marble); this.marble.rotation.set(0, 0, 0); this.say('marbleBack', 'Squeak! Nibbles put the marble back. Try again!'); }
    }
    // the spoon: bowl down, then up for a moment when the marble hits the handle
    const up = this.marbleState === 'flip' ? (since < HOUSE.flip ? since / HOUSE.flip : since < HOUSE.reset - 0.6 ? 1 : Math.max(0, (HOUSE.reset - since) / 0.6)) : 0;
    this.tilt = -0.42 + 0.84 * ease(up);
    this.seesaw.userData.parts.spoon.rotation.x = this.tilt;
    if (this.marbleState === 'top') this.marble.position.set(...ss.marble);
    if (this.game.player.pos.y > 25 && this.playerNear(ss.stack.x[0] + 2, ss.stack.z[0] + 2, 10)) this.say('marble', 'A marble on the books and a spoon on a reel... Look at the yellow note!');
  }
  // the back door of the fort: open only while you are inside (and while you walk out through it)
  updateFortDoor() {
    const p = this.game.player.pos, ft = FORT, d = ft.door;
    const inside = Math.hypot(p.x - ft.c[0], p.z - ft.c[1]) < ft.r[0] + 0.3 && p.y > 25;
    const inDoor = p.x > d.x[0] - 0.4 && p.x < d.x[1] + 1.4 && p.z > d.z[0] - 0.4 && p.z < d.z[1] + 1.4 && p.y > 25;
    const open = inside || (!!this.doorOpen && inDoor); // from outside the doorway stays shut; on your way out it stays open
    if (open !== this.doorOpen) {
      this.doorOpen = open;
      for (let x = d.x[0]; x <= d.x[1]; x++) for (let z = d.z[0]; z <= d.z[1]; z++) for (let y = d.y[0]; y <= d.y[1]; y++) this.cells.want(x, y, z, open ? B.AIR : WOOL.paper);
    }
  }

  /* ---------------------------------- Nibbles' notes ---------------------------------- */
  setupNotes() {
    this.prop(buildNote(NOTES.fan), [23.5, 1, 58], 0.4);           // by the wind-up key, facing the train stop
    this.prop(buildNote(NOTES.plug), [21, 31, 24.5], -Math.PI / 2); // on the counter where you come down from the shelf
    this.prop(buildNote(NOTES.yarn), [103.5, 31, 22.5], -Math.PI / 2 - 0.3); // where the cap leaves you
    this.prop(buildNote(NOTES.spoon), [113.5, 26, 47.5], Math.PI);  // at the foot of the book stairs
  }

  /* ---------------------------------- crumbs ---------------------------------- */
  syncCrumbs() {
    const beaten = this.game.beaten;
    CRUMBS.forEach(([x, y, z], i) => {
      if (beaten.includes(crumbKey(i))) { this.found.add(i); if (this.world.get(x, y, z) === B.CRUMB) this.world.setLive(x, y, z, B.AIR); }
    });
    this.world.allCrumbs = this.found.size >= CRUMBS.length; // T40a.5: Pipsqueak's spawn condition reads it
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
    if (n >= CRUMBS.length) { g.cubes += 5; g.ui.toast('You found every crumb in the house! +5 bonus Capture Cubes. Pipsqueak smells them and comes out to play!'); } else g.ui.toast(`A crumb! +1 Capture Cube (${n} of ${CRUMBS.length})`);
    this.world.allCrumbs = n >= CRUMBS.length;
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
    this.updateCat();
    this.updateSeesaw(dt);
    this.updateWater(false, dt);
    this.acc += dt;
    if (this.acc >= 0.2) {
      this.acc = 0;
      this.updateFortDoor();
      if (this.playerNear(36, 16, 12) && g.player.pos.y > 29) this.say('tap', 'A sink with a plug and a tap. Look at the yellow note!');
      if (g.creatures?.list.some(w => w.pos.distanceTo(g.player.pos) < 12)) this.say('tiny', 'Tiny creatures hide in cups, flowers and under leaves. Look closely!');
    }
    this.crumbAcc += dt;
    if (this.crumbAcc >= 0.25) { this.crumbAcc = 0; this.syncCrumbs(); }
  }

  // T40 near / use: the puzzle actions need no aiming (the big button says the word)
  nearWhat(p) {
    const pos = p.pos;
    if (this.towelOn && pos.y < 5 && flat(pos, [FAN.c[0], 0, FAN.c[1]]) < 9) return 'towel';
    if (pos.y < 3 && flat(pos, FAN.key.at) < 2.6) return 'key';
    const rim = SINK.plug.rim, hole = SINK.plug.hole;
    if (!this.plugged && pos.y > 30 && pos.y < 32.5 && flat(pos, [rim[0] + 0.5, 0, rim[2] + 0.5]) < 2.6) return 'plug';
    if (this.plugged && pos.y > 28 && pos.y < 32.5 && flat(pos, [hole[0] + 0.5, 0, hole[2] + 0.5]) < 4.5) return 'unplug'; // in the sink (from the rim: aim at it; never near the tap, where E turns the tap)
    if (this.yarnState === 'top' && this.catPhase === 'sleep' && pos.y > 30 && pos.y < 32.5 && flat(pos, CAT.yarn.at) < 2.6) return 'yarn';
    const ss = SEESAW;
    if (this.marbleState === 'top' && pos.y > 25.5 && pos.y < 27.5 && flat(pos, [ss.stack.x[0] + 2, 0, ss.stack.z[0] + 2.5]) < 4.2) return 'marble';
    return null;
  }
  near(p) { return { towel: 'Pull!', key: 'Wind!', plug: 'Plug in!', unplug: 'Unplug', yarn: 'Push!', marble: 'Roll!' }[this.nearWhat(p)] ?? null; }
  use(p) {
    switch (this.nearWhat(p)) {
      case 'towel': return this.pullTowel();
      case 'key': return this.windKey();
      case 'plug': case 'unplug': return this.togglePlug();
      case 'yarn': return this.pushYarn();
      case 'marble': return this.rollMarble();
      default: return false;
    }
  }

  hit(block) {
    const rim = SINK.plug.rim, hole = SINK.plug.hole;
    if (block.id === B.HOUSE_PROP) {
      if (this.at(block, ...FAN.key.cells)) return this.windKey();
      if (this.at(block, rim, hole)) return this.togglePlug();
      if (this.at(block, CAT.yarn.cell)) return this.pushYarn() || true;
      if (this.catCells.some(c => this.at(block, c))) { this.toast('Shh... the cat is fast asleep. Cats love yarn!'); return true; }
      return false;
    }
    switch (block.id) {
      case B.FAN_GRILL: if (this.towelOn) return this.pullTowel(); return false;
      case B.REMOTE_BUTTON: this.pressRemote(block); return true;
      case B.TAP_HANDLE: this.toggleTap(); return true;
      case B.CRUMB: return this.pickCrumb(block);
      case B.KEYHOLE: this.toast('A brass keyhole. You are small enough to squeeze through!'); return true;
      default: return false;
    }
  }
  prompt(block, how) {
    const rim = SINK.plug.rim, hole = SINK.plug.hole;
    if (block.id === B.HOUSE_PROP) {
      if (this.at(block, ...FAN.key.cells)) return `Wind-up key · ${how} to wind the fan`;
      if (this.at(block, rim)) return `Sink plug · ${how} to put it in`;
      if (this.at(block, hole)) return `Sink plug · ${how} to pull it out`;
      if (this.at(block, CAT.yarn.cell)) return `Ball of yarn · ${how} to push it`;
      if (this.catCells.some(c => this.at(block, c))) return 'Sleeping cat · shh!';
      return null;
    }
    switch (block.id) {
      case B.FAN_GRILL: return this.towelOn ? `Tea towel · ${how} to pull it off` : null;
      case B.REMOTE_BUTTON: {
        const station = this.stationOf(block);
        return this.train.run ? 'Toy train · on its way...' : this.train.at === station ? `Toy train remote · ${how} to ride` : `Toy train remote · ${how} to call the train`;
      }
      case B.TAP_HANDLE: return `Tap · ${how} to turn it ${this.tapOn ? 'off' : 'on'}`;
      case B.CRUMB: return `Cookie crumb · ${how} to pick it up`;
      case B.KEYHOLE: return 'Keyhole · you are small enough to squeeze through!';
      default: return null;
    }
  }
  action(block) {
    if (block.id === B.HOUSE_PROP) {
      if (this.at(block, ...FAN.key.cells)) return 'Wind!';
      if (this.at(block, SINK.plug.rim)) return 'Plug in!';
      if (this.at(block, SINK.plug.hole)) return 'Unplug';
      if (this.at(block, CAT.yarn.cell)) return 'Push!';
      if (this.catCells.some(c => this.at(block, c))) return 'Shh!';
      return null;
    }
    switch (block.id) {
      case B.FAN_GRILL: return this.towelOn ? 'Pull!' : null;
      case B.REMOTE_BUTTON: return this.train.run ? 'Wait...' : this.train.at === this.stationOf(block) ? 'Ride!' : 'Call train!';
      case B.TAP_HANDLE: return this.tapOn ? 'Tap off' : 'Turn tap!';
      case B.CRUMB: return 'Pick up!';
      case B.KEYHOLE: return 'Squeeze!';
      default: return null;
    }
  }

  // for the guide (giantland.js houseAim) and the specs
  trainAt() { return this.train.run ? null : this.train.at; }
  trainMover(m) { return m === this.toN || m === this.toS; }
  capMover(m) { return m === this.east || m === this.west; }

  dispose() {
    const p = this.game.player;
    for (const m of [this.toN, this.toS, this.east, this.west, this.fling]) if (p && m && p.carry === m) p.carry = null;
    const lifts = this.world.lifts, at = lifts ? lifts.indexOf(FAN.lift) : -1;
    if (at >= 0) lifts.splice(at, 1);
    for (const m of this.meshes) {
      this.game.scene.remove(m);
      m.geometry?.dispose();
      if (m.material) { m.material.map?.dispose?.(); m.material.dispose(); }
      for (const c of m.children) { c.geometry?.dispose(); c.material?.dispose(); }
    }
    for (const g of this.props) { this.game.scene.remove(g); g.userData.dispose?.(); }
    this.meshes = []; this.props = [];
    this.windTex?.dispose();
    this.zTex?.dispose();
  }
}
