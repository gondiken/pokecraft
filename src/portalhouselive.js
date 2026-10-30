// T42: the live part of the Portal House (LIVE.portalhouse in gymlive.js, made for the world.parts entry `portalhouse` of the Swirl).
// Everything is per player and in memory: your two swirls, the Swirl Wand, the sparks, the room clock and the Swirl Ball are never
// saved or sent (only the ten room keys `pw:portal:room1..10` in game.beaten are). A swirl trip is "set the player's position"; a
// fling is a Mover on the closed-form PATHS.fling (portalplay.js), so 60 and 20 frames a second land on the same spot. The big action
// button is "Swirl!" (gymLive near / use): one quick tap, nothing is held. The clock only runs while the game is playing (not paused,
// not in a battle).
//
// Your swirls (owner 2026-10-27): the teal one sticks on white pads, the orange one on peach pads (rooms 5-8; the pad decides the
// colour, so a tap is still just a tap). Rooms 1-4 and 6 have fixed orange swirls instead. Room 6's white pad slides along the
// ceiling; room 7's pipe drops a Swirl Ball (a mesh: its flight is a chain of closed-form pieces, each worked out when the ball gets
// there, with your swirls as they are then); room 8's ceiling swirl keeps your speed (portalplay.js headOf).
//
// Meshes: the swirls of the part you are in (DoorGlow vortices, lite: 1 call each), your two swirls, the Hub / Porch swirl, an aim
// glow on the pad you look at, the sparks (one instanced mesh), the sliding pad, the ball and its button: all with
// userData.portalHouse, removed in dispose(). The House's people are drawn only while you are in their part (draw calls).
// Owner 2026-10-29 (portalprops.js): you hold the Swirl Wand (a wizard's wand with a star, drawn over the world in front of the camera:
// 3 calls, only in the Hall and the rooms) and a tap shoots a bolt from its star to the pad; doors are wooden door frames with warm
// light (one merged frame mesh per part, one light per open door), no longer swirls. Owner 2026-10-29 too: room 9's button opens its
// door for a moment (the door's light fades as the time runs out), room 10's bridge of light (portalplay.js bridgeCells) is drawn as
// a mesh over hidden solid cells (B.HOUSE_PROP with LiveCells, never saved), and the guide never points at the right white pad (decoys).
import * as THREE from 'three';
import { B } from './blocks.js';
import { DoorGlow } from './portal.js';
import { buildWand, buildBolt, buildDoorFrames, DoorLight, WAND_COLOURS, buildMiniCube } from './portalprops.js';
import { LiveCells } from './livecells.js';
import { Mover, makePath } from './mover.js';
import { FUN } from './forfun.js';
import { PORTAL, BALL, exitOf, exitSpeed, centreAt, touches, flingFlight, flightDrop, headOf, boxHits, slotAimed, roomKey, roomState,
  ROOMS_NEED, flingPoint, ballStart, ballNext, inCup, bridgeCells } from './portalplay.js';
import { R, ROOMS, STUDY_ROOM, STUDY, PORCH, HALL, DOORS, SWIRLS, swirlById, doorTarget, exitTarget, LAST_ROOM } from './portalhouse.js';
import { pictureWorld } from './pictureworlds.js';
import { sound } from './sound.js';

// Owner 2026-10-28: the swirls must not look alike. Yours is blue, the orange one a deep orange, the pair pink; violet (null =
// DoorGlow's own colours) stays for the ways home and back, like the main world's. Owner 2026-10-29: the doors between rooms were
// green swirls, too like your blue one: now they are no swirl at all but wooden door frames with warm light (portalprops.js).
const COLOURS = { orange: [[1.0, 0.42, 0.02], [1.0, 0.68, 0.18]], teal: [[0.12, 0.38, 1.0], [0.5, 0.78, 1.0]], pink: [[1.0, 0.35, 0.65], [1.0, 0.7, 0.9]], violet: null };
// The wand in front of the camera (camera space: x right, y up, -z ahead): the grip low on the right, the star up and a little left.
const WAND_AT = { x: 0.37, y: -0.42, z: -0.62, tilt: -0.45, lean: 0.35, size: 0.62, flick: 0.6, flickTime: 0.32 }; // (the star stays clear of the crosshair)
const BOLT = { fly: 0.16, fade: 0.32 }; // seconds: the star flies to the pad, then the beam fades
const inBox = (b, p) => p.x >= b.x0 && p.x <= b.x1 + 1 && p.z >= b.z0 && p.z <= b.z1 + 1 && p.y >= b.bottom && p.y <= b.top + 2;
const SPARK_MAX = 4;
const BRIDGE_MAX = 60; // cells of the bridge of light drawn at once (room 10)
const QUICK = 9, BRIDGE = 10; // the rooms with a button (a door open for a moment) and with the bridge of light
const isOrangeEnd = s => s.kind === 'orange' || s.kind === 'peach';

export class PortalHouseLive {
  constructor(game, part) {
    this.game = game;
    this.world = game.world;
    this.part = part;
    this.house = part.house;
    this.cells = new LiveCells(this.world, () => game.player);
    this.clock = 0;               // the room clock: summed frame dt while playing
    this.manual = false;          // tests: only step(dt) moves the clock
    this.wand = false;            // the Swirl Wand (given in the Hall)
    this.yours = null;            // the id of the white pad your blue swirl is on
    this.orange = null;           // the id of the peach pad your orange swirl is on (rooms 5-8)
    this.lastOrange = null;       // the fixed orange swirl you went through last (the one your swirl leads to)
    this.mover = null; this.flight = null; this.flightHead = 0;
    this.armed = {}; this.ignoreUntil = {};
    this.peak = -1;               // the highest feet y since you last stood on the ground
    this.chain = { key: null, n: 0 };
    this.sparksGot = new Set();   // 'room:i', per trip
    this.misses = {};             // soft catches per room, this trip (the room's tip after PORTAL.misses)
    this.trips = 0;
    this.told = new Set();
    this.hallKey = '';            // which hall doors are drawn open
    this.partKey = null;
    this.glows = new Map();       // swirl id | 'yours' | 'mine' -> DoorGlow
    this.meshes = [];
    this.shutToastAt = -9;
    this.lastTrip = null;
    this.ball = null;             // the Swirl Ball: { piece, t0, rest, puffAt } (room 7)
    this.nextBall = 0;
    this.pressed = false;         // the Ball Room's button (this trip)
    this.balls = 0;               // balls dropped (tests)
    this.hold = null;             // tests: a moving swirl or pad stays at this value along its rail (the Clock Room's y, the Slider's x)
    this.frames = new Map();      // part -> its merged door frames (owner 2026-10-29)
    this.bolt = null;             // the bolt from the wand to a pad: { from, to, colour, t }
    this.flick = 9;               // seconds since the wand last cast (its flick)
    this.wandShown = false;
    this.gateUntil = -1;          // room 9: the door is open until this room clock (the button)
    this.onButton = false;
    this.bridge = [];             // room 10: the cells of the bridge of light now ([x, y, z])
    this.bridgeSet = new Set();
    this.bridgeKey = '';
    this.build();
  }

  /* ---------- meshes ---------- */
  mark(m) { m.userData.portalHouse = true; m.frustumCulled = false; this.game.scene?.add(m); this.meshes.push(m); return m; }
  build() {
    if (!this.game.scene) return;
    this.aimMesh = this.mark(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x4a8cff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })));
    this.aimMesh.visible = false; this.aimMesh.renderOrder = 8;
    // owner 2026-10-30: a star is only ever the Wizard's star (the bridge), so a "spark" is a little spinning Capture Cube (what it gives you)
    this.sparkMesh = this.mark(new THREE.InstancedMesh(buildMiniCube(), new THREE.MeshBasicMaterial({ vertexColors: true }), SPARK_MAX));
    this.sparkMesh.count = 0; this.sparkMesh.visible = false;
    this.dummy = new THREE.Object3D();
    // the sliding white pad (room 6): a white square with a grey ring, drawn under the ceiling
    const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let map = null;
    if (cv) {
      cv.width = cv.height = 64; const c = cv.getContext('2d');
      c.fillStyle = '#fbfbff'; c.fillRect(0, 0, 64, 64); c.strokeStyle = '#a8a8be'; c.lineWidth = 5; c.beginPath(); c.arc(32, 32, 22, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#c8c8d4'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 61, 61);
      map = new THREE.CanvasTexture(cv);
    }
    this.padMesh = this.mark(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, map, side: THREE.DoubleSide })));
    this.padMesh.visible = false;
    // the Swirl Ball and the button on the shelf (room 7)
    this.ballMesh = this.mark(new THREE.Mesh(new THREE.SphereGeometry(BALL.hw, 14, 10), new THREE.MeshBasicMaterial({ color: 0x9a6aff })));
    this.ballMesh.visible = false;
    this.buttonMesh = this.mark(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.3, 18), new THREE.MeshBasicMaterial({ color: 0xff7a3a })));
    this.buttonMesh.visible = false;
    // the Swirl Wand, held in front of the camera (its matrices are set just before it is drawn, from the camera of that frame)
    this.wandModel = buildWand();
    this.wandMat = new THREE.Matrix4();
    const self = this;
    for (const m of this.wandModel.children) {
      const local = new THREE.Matrix4().compose(m.position, m.quaternion, m.scale);
      m.matrixAutoUpdate = false; m.frustumCulled = false; m.visible = false; m.userData.portalHouse = true;
      m.onBeforeRender = function (renderer, scene, cam) { this.matrixWorld.multiplyMatrices(cam.matrixWorld, self.wandMat).multiply(local); };
    }
    this.wandParts = [...this.wandModel.children];
    for (const m of this.wandParts) this.game.scene.add(m);
    const { beam, head } = buildBolt();
    this.boltBeam = this.mark(beam); this.boltHead = this.mark(head);
    beam.visible = head.visible = false;
    // room 9: the big button on the floor (red, green while the door is open)
    this.quickButton = this.mark(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.3, 20), new THREE.MeshBasicMaterial({ color: 0xff4a3a })));
    this.quickButton.visible = false;
    // room 10: the bridge of light (one instanced mesh of glowing tiles) and the strip it comes out of
    this.bridgeMesh = this.mark(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.12, 1), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.62, depthWrite: false }), BRIDGE_MAX));
    this.bridgeMesh.count = 0; this.bridgeMesh.visible = false;
    const b = ROOMS[BRIDGE - 1].bridge, zs = b.lane.map(c => c[1]), xs = b.lane.map(c => c[0]);
    this.emitter = this.mark(new THREE.Mesh(new THREE.BoxGeometry(b.dir[0] ? 0.2 : xs.length, 0.3, b.dir[0] ? zs.length : 0.2), new THREE.MeshBasicMaterial({ color: 0xdffaff })));
    this.emitter.position.set(Math.min(...xs) + (b.dir[0] ? 0 : xs.length / 2), b.level + 1.0, Math.min(...zs) + (b.dir[0] ? zs.length / 2 : 0));
    this.emitter.visible = false;
  }
  // The wand's star in the world now (for the bolt), from the camera of the last frame.
  wandTip() {
    const cam = this.game.camera;
    if (!cam || !this.wandModel) return null;
    this.wandPose(this.flick);
    const v = this.wandModel.userData.tip.clone().applyMatrix4(this.wandMat).applyMatrix4(cam.matrixWorld);
    return [v.x, v.y, v.z];
  }
  wandPose(since) {
    const k = since < WAND_AT.flickTime ? Math.sin((since / WAND_AT.flickTime) * Math.PI) : 0; // a quick flick forward and back
    const v = this.p?.vel, bob = this.p?.onGround && v ? Math.sin(this.clock * 9) * Math.min(1, Math.hypot(v.x, v.z) / 4) * 0.012 : 0;
    this.wandMat.compose(new THREE.Vector3(WAND_AT.x, WAND_AT.y + bob, WAND_AT.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(WAND_AT.tilt - k * WAND_AT.flick, 0, WAND_AT.lean, 'XYZ')), new THREE.Vector3(WAND_AT.size, WAND_AT.size, WAND_AT.size));
  }
  drop(id) { const g = this.glows.get(id); if (g) { g.dispose(); this.glows.delete(id); } }
  glow(id, sw, opts = {}) {
    let g = this.glows.get(id);
    if (!g && this.game.scene && sw.kind === 'door') { g = new DoorLight(this.game.scene, sw); this.glows.set(id, g); return g; } // a door: warm light, no swirl
    if (!g && this.game.scene) {
      const lite = !(sw.kind === 'warp' && !sw.back);
      g = new DoorGlow(this.game.scene, null, null, { normal: sw.normal, centre: this.cen(sw), w: sw.w, h: sw.h, lite, colours: COLOURS[opts.colour ?? sw.colour] });
      g.group.userData.portalHouse = true;
      this.glows.set(id, g);
    }
    if (g && sw.move) { const c = this.cen(sw), [nx, ny, nz] = sw.normal; g.group.position.set(c[0] + nx * 0.03, c[1] + ny * 0.03, c[2] + nz * 0.03); }
    return g;
  }

  /* ---------- helpers ---------- */
  get p() { return this.game.player; }
  // the middle of a swirl now (a moving one slides along its rail with the room clock; `hold` = where tests freeze it)
  cen(sw) {
    if (!sw.move) return sw.centre;
    if (this.hold != null) { const c = [...sw.centre], ax = { x: 0, y: 1, z: 2 }[sw.move.axis ?? 'y']; c[ax] = this.hold; return c; }
    return centreAt(sw, this.clock);
  }
  running() { return !!this.game.playing?.() && !this.game.inBattle; }
  say(m) { this.game.ui.toast(m); }
  once(key, m) { if (this.told.has(key)) return; this.told.add(key); this.say(m); }
  solid = (x, y, z) => this.world.isSolid(x, y, z);
  feet() { const p = this.p.pos; return [p.x, p.y, p.z]; }
  puff(at, color) { this.game.creatures?.puff?.({ x: at[0], y: at[1], z: at[2] }, { color, sound: null }); }
  get done() { return roomState(this.game); }
  room(n) { return ROOMS[n - 1]; }
  isRoom(n) { return typeof n === 'number' && n >= 1 && n <= LAST_ROOM; }

  // Which part of the House a point is in: 'porch' | 'hall' | 1..10 (a swirl room) | 'study' | 'hub' (near the Hub Swirl) | null.
  where(p = this.p.pos) {
    for (const r of ROOMS) if (inBox(r.box, p)) return r.n;
    if (inBox(STUDY_ROOM.box, p)) return 'study';
    const H = HALL.box;
    if (p.x >= H.x0 && p.x <= H.x1 + 1 && p.z >= H.z0 && p.z <= H.z1 + 1 && p.y >= 12 && p.y <= 22) return 'hall';
    if (Math.hypot(p.x - PORCH.c[0], p.z - PORCH.c[1]) < 7 && p.y >= 8 && p.y <= 20) return 'porch';
    if (Math.hypot(p.x - 51.5, p.z - 73.5) < 45 && p.y > 14) return 'hub';
    return null;
  }
  inHouse(p = this.p.pos) { const w = this.where(p); return w !== null && w !== 'hub'; }

  /* ---------- aiming and the big button ---------- */
  padsHere(n = this.where()) { return this.isRoom(n) ? [...this.room(n).slots, ...this.room(n).peaches].map(swirlById) : []; }
  aimed() {
    const n = this.where();
    if (!this.wand || !this.isRoom(n)) return null;
    const pads = this.padsHere(n);
    if (!pads.length) return null;
    const p = this.p, air = !p.onGround || !!p.carry, eye = p.eyePos, f = p.forward;
    const hit = slotAimed([eye.x, eye.y, eye.z], [f.x, f.y, f.z], pads, air ? PORTAL.coneAir : PORTAL.cone, this.solid, [this.yours, this.orange], s => this.cen(s));
    return hit?.slot ?? null;
  }
  near() {
    if (!this.running() || !this.world.swirl?.house) return null;
    if (!this.wand && this.isRoom(this.where())) return null;
    const s = this.aimed();
    this.aimShown = s;
    return s ? 'Swirl!' : null;
  }
  use() {
    if (!this.running()) return false;
    const s = this.aimed();
    if (!s) return false;
    this.place(s);
    return true;
  }
  // Your blue swirl onto a white pad, or your orange swirl onto a peach pad.
  place(s) {
    const peach = s.kind === 'peach';
    if ((peach ? this.orange : this.yours) === s.id) return;
    const c = this.cen(s);
    if (peach) this.orange = s.id; else this.yours = s.id;
    this.chain = { key: null, n: 0 };
    this.armed[s.id] = !touches(s, c, this.feet(), true); // stepping onto a pad you just chose does not send you at once
    sound.play('swirlzip');
    this.puff([c[0] + s.normal[0] * 0.5, c[1] + s.normal[1] * 0.5, c[2] + s.normal[2] * 0.5], peach ? 0xff8a30 : 0x4a8cff);
    this.flick = 0;
    const from = this.wandTip();
    if (from) this.bolt = { from, to: [c[0] + s.normal[0] * 0.1, c[1] + s.normal[1] * 0.1, c[2] + s.normal[2] * 0.1], colour: peach ? WAND_COLOURS.orange : WAND_COLOURS.teal, t: 0 };
    this.drop(peach ? 'mine' : 'yours');
    const room = this.isRoom(this.where()) ? this.room(this.where()) : null;
    if (peach) this.once('placedPeach', this.yours ? 'Your orange swirl is on the peach pad! Both ends are yours now.' : 'Your orange swirl is on the peach pad! Now put your blue swirl on a white pad.');
    else if (room?.peaches.length) this.once('placedTeal2', this.orange ? 'Both swirls are yours! In one, out the other.' : 'Your blue swirl is on! Now tap a peach pad for your orange swirl.');
    else this.once('placed', 'Your swirl is on the pad! Now walk into the orange swirl.');
  }
  // a tapped / clicked block: a white pad or a peach pad
  hit(block) {
    if (!block || (block.id !== B.PO_PANEL && block.id !== B.PO_PEACH)) return false;
    if (!this.running()) return false;
    const n = this.where();
    if (!this.wand) { this.say('Find Keeper Kit in the Hall to get a Swirl Wand!'); return true; }
    const s = this.padsHere(n).find(sw => sw.cells.some(([x, y, z]) => x === block.x && y === block.y && z === block.z));
    if (!s) { this.once('nopad', 'That pad belongs to another room.'); return true; }
    this.place(s);
    return true;
  }
  prompt(block, how) {
    if (!block) return null;
    if (block.id === B.PO_PANEL) return this.wand ? `White pad · ${how} to put your blue swirl here` : 'White pad · get a Swirl Wand from Keeper Kit first';
    if (block.id === B.PO_PEACH) return this.wand ? `Peach pad · ${how} to put your orange swirl here` : 'Peach pad · get a Swirl Wand from Keeper Kit first';
    return null;
  }
  action(block) { return block?.id === B.PO_PANEL || block?.id === B.PO_PEACH ? 'Swirl!' : null; }
  talk(npc) {
    if (npc.kind === 'crew' && npc.def?.boss === 'portal' && npc.def.index === 0) this.giveWand();
    return false;
  }
  giveWand() {
    if (this.wand) return;
    this.wand = true;
    this.once('wand', 'Keeper Kit: Here, take a Swirl Wand! Tap a white pad to put your own swirl there.');
  }

  /* ---------- going through ---------- */
  // The orange end your blue swirl leads to: your own orange swirl in a room with peach pads, else the fixed orange swirl you went
  // through last (else the room's first).
  orangeFor(room) {
    if (room.peaches.length) return this.orange ? swirlById(this.orange) : null;
    const list = room.oranges.map(swirlById);
    return list.find(o => o.id === this.lastOrange) ?? list[0] ?? null;
  }

  // You touched swirl `sw` (coming from a walk, a fall or a flight that ended in it) with `drop` blocks of fall.
  through(sw, drop) {
    const n = this.where(), room = this.isRoom(n) ? this.room(n) : null;
    this.game.riding?.stop?.('quiet');
    if (sw.kind === 'warp') { if (sw.back) this.once('back', 'Back to the start of this room!'); return this.warp(sw.to); } // (a back swirl keeps your swirls)
    if (sw.kind === 'door') return this.door(sw);
    if (sw.kind === 'pair') {
      const other = swirlById(sw.pair), out = exitOf(other, other.centre, 0);
      return this.land(out, other, sw, 0);
    }
    if (!room) return;
    let target;
    if (isOrangeEnd(sw)) {
      const yours = this.yours && swirlById(this.yours);
      if (!yours) { this.once('noswirl', 'Put your blue swirl on a white pad first! Look at a white pad and tap.'); this.armed[sw.id] = false; return; }
      if (sw.kind === 'orange') this.lastOrange = sw.id;
      target = yours;
    } else {
      target = this.orangeFor(room); // you went into your blue swirl: out of the orange end
      if (!target) { this.once('noorange', 'Put your orange swirl on a peach pad too! Then in one, out the other.'); this.armed[sw.id] = false; return; }
    }
    const key = `${sw.id}>${target.id}`;
    this.chain = this.chain.key === key ? { key, n: this.chain.n + 1 } : { key, n: 1 };
    // the same pair 4 times without touching the ground: the loop stops gently, with a hint
    const loop = this.chain.n >= PORTAL.loops;
    if (loop && room.loopBack) { this.chain = { key: null, n: 0 }; return this.catchBack(room, room.hintLoop); }
    const speed = loop ? 0 : exitSpeed(drop);
    const out = exitOf(target, this.cen(target), speed);
    if (loop) { this.chain = { key: null, n: 0 }; this.say(room.hintLoop ?? room.rule); }
    this.trips++;
    this.lastTrip = { from: sw.id, to: target.id, drop, speed, fling: !!out.vel };
    this.land(out, target, sw, speed);
  }

  // Put the player at the exit; start the fling if there is one.
  land(out, exitSwirl, entered, speed) {
    const p = this.p;
    sound.play('swirlwarp');
    this.puff(this.feet(), 0xc9a8ff);
    let pos = [...out.pos];
    for (let i = 0; i < 4 && boxHits(this.solid, pos); i++) pos[1] += 0.5; // never inside a block
    if (this.mover) { this.mover.leave(false); this.mover = null; }
    p.pos.set(pos[0], pos[1], pos[2]);
    p.vel.set(0, 0, 0);
    if (out.yaw !== null) { p.yaw = out.yaw; p.pitch = 0; }
    this.puff(pos, 0xff9a3a);
    this.armed[exitSwirl.id] = false;
    this.ignoreUntil[exitSwirl.id] = this.clock + PORTAL.ignore;
    this.peak = pos[1];
    if (out.vel) this.fling(pos, out.vel, exitSwirl, headOf(exitSwirl, speed));
  }
  fling(pos, vel, from, head = 0) {
    const p = this.p;
    const seek = (q) => {
      for (const s of this.seekList(from)) if (touches(s, this.cen(s), q, true)) return s;
      return null;
    };
    const f = flingFlight(this.solid, pos, vel, PORTAL.flingG, seek);
    this.flight = f; this.flightHead = head;
    const path = makePath({ kind: 'fling', from: pos, v: vel, g: PORTAL.flingG, time: f.time, yaw: p.yaw });
    this.mover = new Mover({ path, run: 'ride', canLeave: false, onEnd: () => this.flightEnded(f, from, head) });
    this.mover.board(p);
  }
  // the swirls a flight may run into: the fixed oranges, your two swirls (not the one you came out of)
  seekList(from) {
    const n = this.where(), room = this.isRoom(n) ? this.room(n) : null;
    if (!room) return [];
    const list = room.oranges.map(swirlById);
    if (this.yours) list.push(swirlById(this.yours));
    if (this.orange) list.push(swirlById(this.orange));
    return list.filter(s => s.id !== from.id);
  }
  flightEnded(f, from, head = 0) {
    this.mover = null; this.flight = null; this.flightHead = 0;
    const p = this.p;
    p.vel.set(0, Math.min(0, f.vEnd[1]), 0);
    this.peak = f.peak;
    if (f.hit) this.through(f.hit, flightDrop(f, this.cen(f.hit)[1], head)); // the flight ran into a swirl: through it, with the speed of the whole fall
  }

  forget() { this.yours = null; this.orange = null; this.chain = { key: null, n: 0 }; }
  door(sw) {
    if (sw.home) { this.forget(); return this.warp(sw.to); } // back to the Hall
    if (sw.exit) { // the room is done
      const n = sw.room;
      const key = roomKey(n);
      if (!this.game.beaten.includes(key)) {
        this.game.beaten.push(key);
        const d = roomState(this.game);
        sound.play('win');
        this.say(`Room ${n} done! 🌀 ${d.n} / ${d.need}`);
        if (d.ready) this.say('All the swirl rooms are done! The Study door is open: Grandpa Arch is waiting.');
        this.game.save?.(true);
      } else { sound.play('win'); this.say(`Room ${n} done again! ${FUN.tag}`); } // (owner 2026-10-28: a done room plays again, nothing new is saved)
      this.forget();
      return this.warp(exitTarget(n));
    }
    // a Hall door: into the room (or the Study)
    this.forget();
    this.warp(doorTarget(sw.door));
  }
  warp(to) {
    const p = this.p;
    sound.play('swirlwarp');
    this.puff(this.feet(), 0xc9a8ff);
    if (this.mover) { this.mover.leave(false); this.mover = null; }
    p.pos.set(to[0], to[1], to[2]);
    p.vel.set(0, 0, 0);
    if (Number.isFinite(to[3])) { p.yaw = to[3]; p.pitch = 0; }
    this.puff(to, 0xff9a3a);
    this.peak = to[1];
    this.armed = {}; // every swirl wakes up again; the ones you stand in are disarmed below
    for (const s of SWIRLS) if (touches(s, this.cen(s), this.feet(), true)) this.armed[s.id] = false;
    this.trips++;
    this.game.mp?.sendState?.();
  }
  catchBack(room, extra = null) {
    sound.play('puff');
    this.puff(this.feet(), 0xffffff);
    this.say(extra ?? 'Whoops! Back to the start of this room.');
    this.lastTrip = { from: null, to: null, drop: 0, speed: 0, fling: false, catch: room.n };
    this.warp(room.start);
    this.chain = { key: null, n: 0 };
    const m = this.misses[room.n] = (this.misses[room.n] ?? 0) + 1;
    if (room.hint && m >= PORTAL.misses && (m - PORTAL.misses) % 3 === 0) this.say(room.hint); // a tip after a few misses (and now and then after that)
  }

  /* ---------- every frame ---------- */
  step(dt) { this.advance(dt); } // tests drive the clock (manual = true)
  update(dt) {
    if (!this.game.scene && !this.manual) return;
    if (!this.manual && this.running()) this.advance(dt);
    this.cells.flush();
    this.draw(dt);
  }
  advance(dt) {
    const p = this.p;
    this.clock += dt;
    if (this.mover) this.mover.update(dt);
    const n = this.where();
    if (n !== this.lastPart) this.enterPart(n, this.lastPart);
    if (n === null || n === 'hub') this.leaveHouse();
    // the Hall hands out the Wand
    if (n === 'hall' || this.isRoom(n)) {
      if (!this.wand) { if (n === 'hall') this.giveWand(); else this.wand = true; }
      if (n === 'hall' && !this.told.has('hall')) { this.told.add('hall'); this.say('The Hall of Swirls! Your swirl and the orange swirl are joined: in one, out the other.'); }
    }
    if (n === 'porch' && !this.told.has('porch')) { this.told.add('porch'); this.say('The Portal House! Its rooms float apart, joined by swirls.'); }
    if (n === 7) this.ballTick();
    if (n === QUICK) this.buttonTick();
    if (n === BRIDGE || this.bridge.length) this.bridgeTick(n);
    this.hallDoors(n);
    if (p.carry || this.mover) return;
    // re-arm the swirls you left
    for (const id of Object.keys(this.armed)) if (!this.armed[id]) {
      const s = swirlById(id);
      if (!s || !touches(s, this.cen(s), this.feet(), true)) this.armed[id] = true;
    }
    const pos = this.feet();
    // the swirls of this part
    const hit = this.touched(n, pos);
    if (hit) {
      const drop = Math.max(0, this.peak - pos[1]);
      this.through(hit, drop);
      return;
    }
    // falls: the soft cloud floor catches you (resting below the room's catch line: a swirl in the floor takes you first)
    if (this.isRoom(n)) {
      const r = this.room(n);
      if (p.onGround && pos[1] < r.catchY) { this.catchBack(r); return; }
    }
    // sparks
    this.pickSparks(n, pos);
    // the peak of the fall
    if (p.onGround) this.peak = pos[1]; else this.peak = Math.max(this.peak, pos[1]);
  }
  // You went from part `from` into part `n`: say the room's rule, start the Ball Room afresh when you leave it.
  enterPart(n, from) {
    this.lastPart = n;
    if (from === 7 && n !== 7) this.resetBall();
    if (from === QUICK && n !== QUICK) this.gateUntil = -1; // the door shuts behind you
    if (this.isRoom(n)) { // your swirls stay in the room they were made in
      if (this.yours && swirlById(this.yours).room !== n) this.yours = null;
      if (this.orange && swirlById(this.orange).room !== n) this.orange = null;
    }
    if (this.isRoom(n)) this.once(`rule${n}`, this.room(n).rule);
  }

  // The swirl the player is touching (and may go through), or null.
  touched(n, pos) {
    const ready = pictureWorld('portal')?.ready;
    const list = [];
    if (n === 'hub') list.push(swirlById('hub'));
    else if (n === 'porch') list.push(swirlById('porch'));
    else if (n === 'hall') list.push(...SWIRLS.filter(s => s.room === 'hall'));
    else if (n != null) list.push(...SWIRLS.filter(s => s.room === n));
    for (const s of list) {
      if (this.armed[s.id] === false || (this.ignoreUntil[s.id] ?? -1) > this.clock) continue;
      if (s.kind === 'slot' && s.id !== this.yours) continue;
      if (s.kind === 'peach' && s.id !== this.orange) continue;
      if (s.kind === 'door' && s.door && !this.doorIsOpen(s.door)) { if (touches(s, s.centre, pos, false)) this.shutHint(); continue; }
      if (s.kind === 'door' && s.needs === 'ball' && !this.pressed) continue;
      if (s.kind === 'door' && s.needs === 'button' && !this.gateOpen()) continue;
      if (s.id === 'hub' && !ready) continue;
      if (!touches(s, this.cen(s), pos, false)) continue;
      return s;
    }
    return null;
  }
  shutHint() { if (this.clock - this.shutToastAt > 4) { this.shutToastAt = this.clock; this.say('Finish the room before it to open this door!'); } }
  // Hall door k (1..DOORS): room 1's is always open, room k's once room k - 1 is done, the Study's (the last) once every room is done.
  doorIsOpen(k) { const d = this.done; return k === 1 || (k === DOORS ? d.ready : d.done[k - 2] === true); }
  leaveHouse() {
    this.game.ui.setScore?.(null);
    this.misses = {};
  }
  hallDoors(n) {
    const key = `${this.done.done.join('')}|${this.pressed}|${this.gateOpen()}`;
    if (key === this.hallKey && n !== 'hall' && n !== 7 && n !== QUICK) return;
    this.hallKey = key;
    SWIRLS.filter(s => s.room === 'hall' && s.door).forEach(s => {
      const open = this.doorIsOpen(s.door);
      for (const [x, y, z] of s.cells) this.cells.want(x, y, z, open ? B.AIR : B.PO_SHUT);
    });
    for (const s of SWIRLS) if (s.needs === 'ball') for (const [x, y, z] of s.cells) this.cells.want(x, y, z, this.pressed ? B.AIR : B.PO_SHUT);
    for (const s of SWIRLS) if (s.needs === 'button') for (const [x, y, z] of s.cells) this.cells.want(x, y, z, this.gateOpen() ? B.AIR : B.PO_SHUT);
  }

  /* ---------- the button (room 9) ---------- */
  // Standing on the button keeps the door open; it shuts `open` seconds after you step off.
  gateOpen() { return this.clock < this.gateUntil; }
  gateLeft() { return Math.max(0, this.gateUntil - this.clock) / this.room(QUICK).button.open; } // 1 -> 0 while it is open
  buttonTick() {
    const b = this.room(QUICK).button, p = this.p.pos;
    const on = this.p.onGround && Math.hypot(p.x - b.at[0], p.z - b.at[2]) <= b.r && Math.abs(p.y - b.at[1]) < 0.4;
    if (on) {
      if (!this.onButton) { sound.play('checkpoint'); this.once('button', 'The door up there is open! Quick!'); }
      this.gateUntil = this.clock + b.open;
    }
    this.onButton = on;
  }

  /* ---------- the bridge of light (room 10) ---------- */
  // The bridge for your swirls as they are: hidden solid cells (B.HOUSE_PROP through LiveCells) under a mesh. Only the world's own
  // blocks stop it, never the bridge itself (solidNoBridge).
  solidNoBridge = (x, y, z) => !this.bridgeSet.has(`${x},${y},${z}`) && this.world.isSolid(x, y, z);
  bridgeTick(n) {
    const here = n === BRIDGE, key = here ? `${this.yours}|${this.orange}` : '';
    if (key === this.bridgeKey) return;
    this.bridgeKey = key;
    const ends = [this.yours && swirlById(this.yours), this.orange && swirlById(this.orange)].map(s => (s && s.room === BRIDGE ? s : null));
    const next = here ? bridgeCells(this.solidNoBridge, this.room(BRIDGE).bridge, ends) : [];
    const nextSet = new Set(next.map(c => c.join(',')));
    for (const [x, y, z] of this.bridge) if (!nextSet.has(`${x},${y},${z}`)) this.cells.want(x, y, z, B.AIR);
    for (const [x, y, z] of next) this.cells.want(x, y, z, B.HOUSE_PROP);
    if (here && next.length > this.bridge.length && this.bridge.length) { sound.play('swirlzip'); this.once('bridge', 'The bridge goes through your swirls!'); }
    this.bridge = next; this.bridgeSet = nextSet;
  }
  // gymLive hook (owner 2026-10-30): no block outline round a doorway (its back plate showed through the warm light as thin lines, and
  // the blocks behind the wooden frame drew lines round the posts): the opening, its back plate, the alcove's sides and the wall round it.
  noOutline(b) {
    if (!this.plates) {
      this.plates = new Set();
      for (const s of SWIRLS) if (s.alcove) {
        const [nx, , nz] = s.normal, lx = nx ? 0 : 1, lz = nx ? 1 : 0;
        for (const [x, y, z] of s.cells) for (const d of [0, 1]) for (const l of [-1, 0, 1]) for (const dy of [0, 1]) this.plates.add(`${x - nx * d + lx * l},${y + dy},${z - nz * d + lz * l}`);
      }
    }
    return this.plates.has(`${b.x},${b.y},${b.z}`);
  }
  // A room's sparks are out (sparksOpen: only while its door is open, the Quick Room).
  sparksOut(n) { return !this.room(n).sparksOpen || this.gateOpen(); }
  pickSparks(n, pos) {
    if (!this.isRoom(n) || !this.sparksOut(n)) return;
    this.room(n).sparks.forEach((s, i) => {
      const k = `${n}:${i}`;
      if (this.sparksGot.has(k)) return;
      if (Math.hypot(pos[0] - s[0], pos[1] + 0.9 - s[1], pos[2] - s[2]) > 1.4) return;
      this.sparksGot.add(k);
      this.game.cubes += 1;
      sound.play('keyfound');
      this.say('A Capture Cube! +1');
      this.game.ui.renderHud?.();
    });
  }

  /* ---------- the Swirl Ball (room 7) ---------- */
  ballPair() {
    const room = this.room(7);
    const teal = this.yours && room.slots.includes(this.yours) ? swirlById(this.yours) : null;
    const orange = this.orange && room.peaches.includes(this.orange) ? swirlById(this.orange) : null;
    return { teal, orange };
  }
  ballAt() { const b = this.ball; if (!b) return null; const t = Math.min(this.clock - b.t0, b.piece.time); return flingPoint(b.piece.p0, b.piece.v, PORTAL.flingG, t); }
  ballTick() {
    const room = this.room(7), spec = room.ball;
    if (this.pressed) return; // the ball sits on the button
    if (!this.ball) {
      if (this.clock < this.nextBall) return;
      this.ball = { piece: ballStart(this.solid, spec.mouth, this.ballPair()), t0: this.clock, rest: null };
      this.balls++;
      return;
    }
    const b = this.ball;
    if (b.rest != null) { // resting: on the button it rolls there, anywhere else it puffs away
      if (this.clock - b.rest < BALL.rest) return;
      this.puff(this.ballAt(), 0xc9a8ff);
      this.ball = null;
      this.nextBall = Math.ceil(this.clock / BALL.every) * BALL.every;
      return;
    }
    // the next pieces whose start time has come (several in one slow frame: same result as at 60 frames a second)
    for (let k = 0; k < 10 && this.clock - b.t0 >= b.piece.time; k++) {
      const end = b.t0 + b.piece.time, next = ballNext(this.solid, b.piece, this.ballPair());
      if (b.piece.hit) { sound.play('swirlzip'); this.puff(b.piece.end, 0x9a6aff); }
      if (!next) { // it stays at the end of this piece
        if (inCup(spec.cup, b.piece.end)) return this.pressButton();
        b.rest = end;
        return;
      }
      b.piece = next; b.t0 = end;
    }
  }
  pressButton() {
    this.pressed = true;
    sound.play('keyfound');
    this.say('The Swirl Ball is on the button! The door is open.');
    this.hallKey = '';
  }
  resetBall() {
    this.ball = null; this.pressed = false; this.nextBall = Math.ceil(this.clock / BALL.every) * BALL.every; this.hallKey = '';
  }

  /* ---------- drawing ---------- */
  draw(dt) {
    const n = this.where();
    this.partKey = n;
    const want = new Set();
    const show = (id, sw, open = 1, colour = null) => {
      want.add(id);
      const gl = this.glow(id, sw, { colour });
      if (gl) gl.update(dt, open);
    };
    if (n === 'hub') { if (pictureWorld('portal')?.ready) show('hub', swirlById('hub')); }
    else if (n === 'porch') show('porch', swirlById('porch'));
    else if (n === 'hall') {
      for (const s of SWIRLS.filter(q => q.room === 'hall')) {
        if (s.door) { if (this.doorIsOpen(s.door)) show(s.id, s); } else show(s.id, s);
      }
    } else if (n != null) {
      for (const s of SWIRLS.filter(q => q.room === n)) {
        if (s.kind === 'slot' || s.kind === 'peach') continue;
        if (s.needs === 'ball' && !this.pressed) continue;
        if (s.needs === 'button') { if (this.gateOpen()) show(s.id, s, this.gateLeft()); continue; } // its light fades as the time runs out
        show(s.id, s, s.kind === 'orange' ? (this.yours ? 1 : 0.3) : 1);
      }
    }
    if (this.isRoom(n) && this.yours) { const y = swirlById(this.yours); if (y.room === n) show('yours', y, 1, 'teal'); }
    if (this.isRoom(n) && this.orange) { const o = swirlById(this.orange); if (o.room === n) show('mine', o, this.yours ? 1 : 0.4, 'orange'); }
    for (const id of [...this.glows.keys()]) if (!want.has(id)) this.drop(id);
    this.drawFrames(n);
    // the aim glow on the pad you look at
    const aimedNow = this.isRoom(n) && this.wand && this.running() ? this.aimed() : null;
    this.drawWand(dt, n, aimedNow);
    if (this.aimMesh) {
      const s = aimedNow;
      this.aimMesh.visible = !!s;
      if (s) {
        const [nx, ny, nz] = s.normal, c = this.cen(s);
        this.aimMesh.position.set(c[0] + nx * 0.07, c[1] + ny * 0.07, c[2] + nz * 0.07);
        this.aimMesh.rotation.set(ny > 0.5 ? -Math.PI / 2 : ny < -0.5 ? Math.PI / 2 : 0, ny === 0 ? Math.atan2(nx, nz) : 0, 0);
        this.aimMesh.scale.set(s.w, s.h, 1);
        this.aimMesh.material.color.setHex(s.kind === 'peach' ? 0xff8a30 : 0x4a8cff);
        this.aimMesh.material.opacity = 0.18; // owner 2026-10-28: a calm tint on the pad you aim at, no blinking (it gave the puzzles away)
      }
    }
    // the sliding white pad (it has no blocks)
    if (this.padMesh) {
      const s = this.isRoom(n) ? this.room(n).slots.map(swirlById).find(q => q.move) : null;
      this.padMesh.visible = !!s;
      if (s) { const c = this.cen(s); this.padMesh.position.set(c[0], c[1] - 0.02, c[2]); this.padMesh.rotation.set(Math.PI / 2, 0, 0); this.padMesh.scale.set(s.w, s.h, 1); }
    }
    // the Swirl Ball and its button
    if (this.ballMesh) {
      const at = n === 7 ? this.ballAt() : null, spec = this.room(7).ball;
      this.ballMesh.visible = !!at;
      if (at) {
        let q = at;
        if (this.pressed) { const b = spec.button; q = [b[0], b[1] + 0.3, b[2]]; } // it rolled into the button's cup
        this.ballMesh.position.set(q[0], q[1] + BALL.hw, q[2]);
      }
      this.buttonMesh.visible = n === 7;
      if (n === 7) { const b = spec.button; this.buttonMesh.position.set(b[0], b[1] + (this.pressed ? 0.06 : 0.15), b[2]); this.buttonMesh.material.color.setHex(this.pressed ? 0x6ae86a : 0xff7a3a); }
    }
    // room 9's button and room 10's bridge of light
    if (this.quickButton) {
      this.quickButton.visible = n === QUICK;
      if (n === QUICK) { const b = this.room(QUICK).button.at, open = this.gateOpen(); this.quickButton.position.set(b[0], b[1] + (open ? 0.06 : 0.15), b[2]); this.quickButton.material.color.setHex(open ? 0x6ae86a : 0xff4a3a); }
    }
    if (this.bridgeMesh) {
      const show = n === BRIDGE, list = show ? this.bridge.slice(0, BRIDGE_MAX) : [];
      list.forEach(([x, y, z], i) => { this.dummy.position.set(x + 0.5, y + 0.94, z + 0.5); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix(); this.bridgeMesh.setMatrixAt(i, this.dummy.matrix); });
      this.bridgeMesh.count = list.length;
      this.bridgeMesh.visible = list.length > 0;
      this.bridgeMesh.instanceMatrix.needsUpdate = true;
      this.bridgeMesh.material.opacity = 0.55 + 0.1 * Math.sin(this.clock * 3);
      this.emitter.visible = show;
    }
    // the sparks
    if (this.sparkMesh) {
      let c = 0;
      if (this.isRoom(n) && this.sparksOut(n)) this.room(n).sparks.forEach((s, i) => {
        if (this.sparksGot.has(`${n}:${i}`) || c >= SPARK_MAX) return;
        this.dummy.position.set(s[0], s[1] + Math.sin(this.clock * 2 + i) * 0.15, s[2]);
        this.dummy.rotation.set(0.35, this.clock * 1.5 + i, 0.2);
        this.dummy.scale.setScalar(1 + 0.08 * Math.sin(this.clock * 5 + i));
        this.dummy.updateMatrix();
        this.sparkMesh.setMatrixAt(c++, this.dummy.matrix);
      });
      this.sparkMesh.count = c;
      this.sparkMesh.visible = c > 0;
      this.sparkMesh.instanceMatrix.needsUpdate = true;
    }
    this.people(n);
    this.score(n);
  }
  // The door frames of the part you are in: built once per part, one merged mesh each, always drawn (a shut door shows its frame).
  drawFrames(n) {
    if (!this.game.scene) return;
    const key = n === 'hall' || n === 'study' || this.isRoom(n) ? String(n) : null;
    if (key && !this.frames.has(key)) {
      const m = buildDoorFrames(SWIRLS.filter(s => s.kind === 'door' && s.alcove && String(s.room) === key));
      if (m) this.mark(m);
      this.frames.set(key, m);
    }
    for (const [k, m] of this.frames) if (m) m.visible = k === key;
  }
  // The Swirl Wand in your hand (in the Hall and the rooms, while you play) and the bolt it shot.
  drawWand(dt, n, aimed) {
    if (!this.wandParts) return;
    this.flick += dt;
    const show = this.wand && (n === 'hall' || this.isRoom(n)) && !this.game.inBattle && !!this.game.camera;
    this.wandShown = show;
    for (const m of this.wandParts) m.visible = show;
    if (show) {
      this.wandPose(this.flick);
      const { star, halo } = this.wandModel.userData.parts;
      const col = aimed ? (aimed.kind === 'peach' ? WAND_COLOURS.orange : WAND_COLOURS.teal) : WAND_COLOURS.idle;
      star.material.color.setHex(col); halo.material.color.setHex(col);
      halo.material.opacity = (aimed ? 0.5 : 0.25) + 0.12 * Math.sin(this.clock * 5);
    }
    const b = this.bolt;
    if (!b) { this.boltBeam.visible = this.boltHead.visible = false; return; }
    b.t = this.boltHold ?? b.t + dt; // (boltHold: tests freeze the bolt for a picture)
    if (b.t > BOLT.fly + BOLT.fade) { this.bolt = null; this.boltBeam.visible = this.boltHead.visible = false; return; }
    const k = Math.min(1, b.t / BOLT.fly), F = new THREE.Vector3(...b.from), T = new THREE.Vector3(...b.to), H = F.clone().lerp(T, k);
    const len = F.distanceTo(H);
    this.boltBeam.visible = len > 0.05;
    if (len > 0.05) {
      this.boltBeam.position.copy(F).lerp(H, 0.5);
      this.boltBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), H.clone().sub(F).normalize());
      this.boltBeam.scale.set(1, len, 1);
      this.boltBeam.material.color.setHex(b.colour);
      this.boltBeam.material.opacity = 0.85 * (b.t < BOLT.fly ? 1 : 1 - (b.t - BOLT.fly) / BOLT.fade);
    }
    this.boltHead.visible = b.t < BOLT.fly + 0.05;
    this.boltHead.position.copy(H);
    this.boltHead.lookAt(this.game.camera.position);
    this.boltHead.rotateZ(this.clock * 12);
    this.boltHead.material.color.setHex(b.t < BOLT.fly ? 0xffffff : b.colour);
  }
  // The House's people (Grandpa Arch is a giant model of 38 meshes, each keeper about 25) are drawn only in their own part: from the
  // hub they would be far-off specks costing 100 draw calls. From the porch you see into the Hall.
  people(n) {
    const npcs = this.game.npcs?.list;
    if (!npcs) return;
    for (const npc of npcs) {
      if (npc.away || !npc.model || !npc.pos) continue;
      const q = npc.pos;
      if (q.x < R.x0 - 1 || q.x > R.x1 + 1 || q.z < R.z0 - 1 || q.z > R.z1 + 1) continue;
      const at = this.where(q);
      npc.model.visible = at != null && (at === n || (n === 'porch' && at === 'hall'));
    }
  }
  score(n) {
    const ui = this.game.ui;
    if (!this.isRoom(n) && n !== 'hall' && n !== 'porch' && n !== 'study') { ui.setScore?.(null); return; }
    const d = this.done;
    const cubes = this.sparksGot.size ? ` · +${this.sparksGot.size} Cubes` : ''; // owner 2026-10-30: no star here but the Wizard's
    ui.setScore?.(d.ready ? { text: `🌀 ${d.n} / ${d.need}${cubes} · To Grandpa Arch!`, done: true } : { text: `🌀 Rooms ${d.n} / ${d.need}${cubes}`, done: false });
  }

  /* ---------- the guide arrow ---------- */
  aim(p) {
    const n = this.where(p);
    if (n === null || n === 'hub') return null;
    const d = this.done;
    const pt = (x, z, text) => ({ x, z, text });
    if (n === 'porch') return pt(HALL.entrance.x + 0.5, 24.5, (a, m) => `Into the Hall of Swirls ${a} ${m}m`);
    if (n === 'hall') {
      const k = d.ready ? DOORS : d.done.findIndex(v => !v) + 1;
      const door = swirlById(`hall.d${k}`);
      return pt(door.centre[0], door.centre[2], (a, m) => (k === DOORS ? `Grandpa Arch is in the Study ${a} ${m}m` : `Room ${k} ${a} ${m}m`));
    }
    if (n === 'study') return pt(STUDY.boss.x + 0.5, STUDY.boss.z + 0.5, (a, m) => `Grandpa Arch ${a} ${m}m`);
    // Owner 2026-10-29 (decoy pads): the arrow never points at the right white pad. It shows the door; the words say what to do.
    const room = this.room(n), y = this.yours && swirlById(this.yours), o = this.orange && swirlById(this.orange), ex = swirlById(room.exit);
    if (room.peaches.length && (!o || o.room !== n)) return pt(ex.centre[0], ex.centre[2], () => 'Tap a peach pad for your orange swirl!');
    if (!y || y.room !== n) return pt(ex.centre[0], ex.centre[2], () => 'Tap a white pad to put your blue swirl there!');
    if (room.ball && !this.pressed) { const b = room.ball.button; return pt(b[0], b[2], () => 'Get the Swirl Ball onto the button!'); }
    if (room.button && !this.gateOpen()) { const b = room.button.at; return pt(b[0], b[2], () => 'Step on the button, then quick!'); }
    return pt(ex.centre[0], ex.centre[2], (a, m) => `Reach the door ${a} ${m}m`);
  }

  /* ---------- the Boss ---------- */
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.picture?.id !== 'portal' || opts.picture.crew != null) return;
    const keys = Array.from({ length: ROOMS_NEED }, (_, i) => roomKey(i + 1)); // a new run for the next battle (like the Captain's boats)
    for (let k = this.game.beaten.length - 1; k >= 0; k--) if (keys.includes(this.game.beaten[k])) this.game.beaten.splice(k, 1);
    this.hallKey = '';
    this.say('The swirl doors closed again. Play the swirl rooms for a rematch!');
  }

  info() {
    return { part: this.partKey, wand: this.wand, yours: this.yours, orange: this.orange, clock: this.clock, trips: this.trips, sparks: this.sparksGot.size, done: this.done.n, chain: { ...this.chain }, flying: !!this.mover, last: this.lastTrip, glows: this.glows.size, meshes: this.meshes.length, peak: this.peak,
      ball: this.ball ? { at: this.ballAt(), rest: this.ball.rest != null } : null, pressed: this.pressed, balls: this.balls, misses: { ...this.misses }, wandShown: this.wandShown, bolt: !!this.bolt, frames: [...this.frames.keys()],
      gate: this.gateOpen(), bridge: this.bridge.length };
  }

  dispose() {
    if (this.mover) this.mover.leave(false);
    this.mover = null;
    this.game.ui?.setScore?.(null);
    for (const id of [...this.glows.keys()]) this.drop(id);
    for (const m of this.meshes) { this.game.scene?.remove(m); m.geometry?.dispose(); m.material?.map?.dispose?.(); m.material?.dispose(); }
    this.meshes = [];
    for (const m of this.wandParts ?? []) this.game.scene?.remove(m);
    this.wandModel?.userData.dispose();
    this.wandParts = null;
  }
}
