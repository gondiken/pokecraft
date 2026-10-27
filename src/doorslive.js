// T44: the live part of the Room of Doors (LIVE.doors, plans/T44.md section 4 and "Rework"). Surprise doors that open on a hit, twelve rooms
// (a slide, a ball pit, a confetti shower, springs, doors in doors, a gift shop, Healer Stella, two trainers), the Piñata Party in the middle
// of the hall (bows 1-3: whack a swinging piñata when it swings at you), Jack Catch in the Pop-Up Room (bow 4: run under the flying jacks,
// dodge the pies), the Big Gift that four golden bows untie, and the gift chests.
//
// Everything is per player and in memory except the bows (`beaten` keys pw:doors:bow1..4, saved at once) and the gift chests (pw:doors:gift*).
// Blocks change only through LiveCells / world.setLive (never an edit). Clocks are summed frame dt (frozen in a battle, a question, a panel
// and the pause screen); every motion is a closed form of a clock (pinata.js, jackcatch.js), so 60 fps and 1 fps agree. `manual` + `step(dt)`
// are for tests. One press (Whack!), no hold: E, a click, the big button, or a tap on the screen (gymLive.tap: the stick swings that way).
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { Mover, PATHS } from './mover.js';
import { sound } from './sound.js';
import { PINATA, pinataPlan, newRun, pinataAt, topAt, whack, timeUp, hashStr } from './pinata.js';
import { CATCH, catchPlan, newCatch, stepCatch, inAir, slowed, jacksLeft } from './jackcatch.js';
import { RING, SIDES, bowKey, bowState } from './doorsland.js';

export const DOORS = {
  cubes: 3,            // a gift chest
  hop: 0.3,            // a trainer jumps out of its door
  burst: 2.6,          // a popped piñata: candy, the surprise, the bow flies to you, then the rug rests
  nap: 2.0,            // time up: the piñata floats up for a nap
  stickSwing: 0.28,    // the party stick's swing (looks)
  splat: 1.6,          // the cream on the screen fades in this long
  clearR: 17,          // during a game no wild gift box stays this close to the rug (one never sits between you and the piñata)
  hallRange: 40, popRange: 30,
  confetti: 160, balls: 120,
};
const SILLY = [
  { id: 'duck', say: 'Quack! A rubber duck fell out too!', sound: 'sillyhonk' },
  { id: 'bubbles', say: 'Bubbles fell out too! Pop pop pop!', sound: 'popout' },
  { id: 'sock', say: 'Boing! A sock on a spring fell out too!', sound: 'boing' },
  { id: 'cloud', say: 'A little cloud fell out too! Puff!', sound: 'smokepuff' },
];
const ROOM_SAY = {
  slide: 'A slide! Climb the stairs and press Slide!',
  ballpit: 'Boing! A ball pit!',
  confetti: 'A big empty room... step in!',
  springs: 'Springs! Jump!',
  nested: 'A door in a door in a door!',
  shop: 'So many presents... some of them are wiggling!',
  healer: 'Surprise! Healer Stella came to help!',
  trainer1: 'Surprise! Battle!',
  trainer2: 'Surprise! Battle!',
  wrapping: 'The Wrapping Room.', popup: 'The Pop-Up Room! Stand on the pad and press Play!', gift: 'The Big Gift room!',
};
const key = (x, y, z) => `${x},${y},${z}`;
const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const rand01 = (i, salt) => (hashStr(`${salt}|${i}`) % 10007) / 10007;

// Boxes [w, h, d, colour, x, y, z] -> one geometry with vertex colours.
function merged(boxes) {
  const pos = [], nor = [], col = [], idx = [], c = new THREE.Color();
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
const GOLD = 0xffd23a, WHITE = 0xffffff, INK = 0x16121a;
// The golden bow: two loops, a knot and two tails (origin = the middle of the knot).
const bowBoxes = (s = 1) => [[0.5 * s, 0.34 * s, 0.14 * s, GOLD, -0.3 * s, 0.12 * s, 0], [0.5 * s, 0.34 * s, 0.14 * s, GOLD, 0.3 * s, 0.12 * s, 0], [0.24 * s, 0.24 * s, 0.2 * s, 0xe8a81a, 0, 0.1 * s, 0],
  [0.12 * s, 0.4 * s, 0.1 * s, GOLD, -0.12 * s, -0.22 * s, 0], [0.12 * s, 0.4 * s, 0.1 * s, GOLD, 0.12 * s, -0.22 * s, 0], [0.2 * s, 0.16 * s, 0.08 * s, WHITE, -0.34 * s, 0.14 * s, 0.08], [0.2 * s, 0.16 * s, 0.08 * s, WHITE, 0.34 * s, 0.14 * s, 0.08]];
// A pop-up jack: a spring of three grey discs, a cream head with a grin, a red nose and a striped cap (origin = the middle of the jack).
const jackBoxes = () => [[0.5, 0.12, 0.5, 0x9094a2, 0, -0.55, 0], [0.5, 0.12, 0.5, 0xc8ccd8, 0, -0.35, 0], [0.5, 0.12, 0.5, 0x9094a2, 0, -0.15, 0], [0.7, 0.62, 0.7, 0xfff0d8, 0, 0.33, 0],
  [0.1, 0.1, 0.1, INK, -0.17, 0.43, 0.36], [0.1, 0.1, 0.1, INK, 0.17, 0.43, 0.36], [0.16, 0.14, 0.12, 0xff4a6a, 0, 0.29, 0.4], [0.34, 0.06, 0.06, INK, 0, 0.13, 0.36],
  [0.76, 0.12, 0.76, 0xe8384a, 0, 0.69, 0], [0.46, 0.22, 0.46, 0xffd23a, 0, 0.85, 0], [0.12, 0.12, 0.12, 0xffffff, 0, 1.01, 0]];
// A cream pie: a tin, the cream, a cherry.
const pieBoxes = () => [[0.8, 0.16, 0.8, 0xb8b8c8, 0, -0.1, 0], [0.72, 0.2, 0.72, 0xfff6e0, 0, 0.06, 0], [0.4, 0.14, 0.4, 0xffffff, 0, 0.2, 0], [0.14, 0.14, 0.14, 0xe8243a, 0, 0.32, 0]];
// The three piñatas (crepe-paper stripes; origin = the middle, the rope's knot on top at y 0.7).
const PINATAS = {
  llama: [[0.9, 0.5, 0.5, 0xff6a8a, 0, 0, 0], [0.9, 0.12, 0.52, 0xffd23a, 0, 0.12, 0], [0.9, 0.12, 0.52, 0x3ac8e8, 0, -0.12, 0], [0.26, 0.6, 0.26, 0xff6a8a, 0.38, 0.38, 0], [0.36, 0.22, 0.3, 0xffd23a, 0.5, 0.66, 0],
    [0.08, 0.16, 0.08, 0xff6a8a, 0.36, 0.84, 0.08], [0.08, 0.16, 0.08, 0xff6a8a, 0.36, 0.84, -0.08], [0.06, 0.06, 0.06, INK, 0.6, 0.7, 0.12], [0.06, 0.06, 0.06, INK, 0.6, 0.7, -0.12],
    [0.12, 0.34, 0.12, 0x6ae86a, -0.32, -0.38, 0.14], [0.12, 0.34, 0.12, 0xb05ae8, -0.32, -0.38, -0.14], [0.12, 0.34, 0.12, 0x6ae86a, 0.3, -0.38, 0.14], [0.12, 0.34, 0.12, 0xb05ae8, 0.3, -0.38, -0.14],
    [0.12, 0.22, 0.12, 0xffd23a, -0.5, 0.12, 0], [0.04, 0.4, 0.04, 0xfff0d0, 0, 0.45, 0]],
  star: [[0.4, 0.4, 0.3, 0xffd23a, 0, 0, 0], [0.3, 0.36, 0.26, 0xffd23a, 0, 0.36, 0], [0.3, 0.36, 0.26, 0xff8a1a, 0, -0.36, 0], [0.36, 0.3, 0.26, 0xffd23a, 0.36, 0.06, 0], [0.36, 0.3, 0.26, 0xff8a1a, -0.36, 0.06, 0],
    [0.2, 0.2, 0.24, 0xff6a8a, 0.28, -0.32, 0], [0.2, 0.2, 0.24, 0xff6a8a, -0.28, -0.32, 0], [0.06, 0.06, 0.06, INK, -0.08, 0.06, 0.16], [0.06, 0.06, 0.06, INK, 0.08, 0.06, 0.16], [0.16, 0.04, 0.04, INK, 0, -0.06, 0.16],
    [0.06, 0.3, 0.06, 0x3ac8e8, 0.5, -0.24, 0.06], [0.06, 0.3, 0.06, 0x6ae86a, -0.5, -0.24, 0.06], [0.04, 0.3, 0.04, 0xfff0d0, 0, 0.6, 0]],
  rocket: [[0.44, 0.9, 0.44, 0xe8384a, 0, 0, 0], [0.46, 0.12, 0.46, WHITE, 0, 0.2, 0], [0.46, 0.12, 0.46, WHITE, 0, -0.16, 0], [0.3, 0.24, 0.3, 0x3ac8e8, 0, 0.56, 0], [0.14, 0.14, 0.14, 0x3ac8e8, 0, 0.72, 0],
    [0.18, 0.18, 0.06, 0xbfe8ff, 0, 0.12, 0.23], [0.16, 0.28, 0.12, 0xffd23a, 0.3, -0.36, 0], [0.16, 0.28, 0.12, 0xffd23a, -0.3, -0.36, 0], [0.24, 0.16, 0.24, 0xff8a1a, 0, -0.52, 0], [0.12, 0.14, 0.12, 0xffd23a, 0, -0.64, 0]],
};
// The balloons that hold the rope (origin = the rope's top), the party stick (origin = your hand, pointing along -z).
const balloonBoxes = () => [[0.7, 0.8, 0.7, 0xff6a8a, -0.35, 0.75, 0], [0.7, 0.8, 0.7, 0x3ac8e8, 0.35, 0.8, 0.1], [0.66, 0.76, 0.66, 0xffd23a, 0, 1.25, -0.1], [0.04, 0.5, 0.04, WHITE, 0, 0.2, 0]];
const stickBoxes = () => { const out = []; for (let i = 0; i < 6; i++) out.push([0.07, 0.07, 0.22, i % 2 ? 0xff6a8a : 0xfff0d0, 0, 0, -0.11 - i * 0.22]); out.push([0.14, 0.14, 0.14, GOLD, 0, 0, -1.38]); return out; };
const propBoxes = {
  duck: [[0.7, 0.45, 0.8, 0xffd23a, 0, 0.3, 0], [0.5, 0.45, 0.5, 0xffd23a, 0, 0.75, 0.2], [0.3, 0.12, 0.3, 0xff8a1a, 0, 0.7, 0.55], [0.1, 0.1, 0.1, INK, -0.14, 0.85, 0.42], [0.1, 0.1, 0.1, INK, 0.14, 0.85, 0.42]],
  bubbles: [[0.5, 0.5, 0.5, 0xbfe8ff, -0.5, 0.5, 0], [0.4, 0.4, 0.4, 0xdff4ff, 0.4, 1.0, 0.1], [0.55, 0.55, 0.55, 0xbfe8ff, 0.1, 1.7, 0], [0.3, 0.3, 0.3, 0xdff4ff, -0.3, 1.3, 0.2], [0.3, 0.3, 0.3, 0xbfe8ff, 0.6, 0.3, 0.3]],
  sock: [[0.2, 0.2, 0.2, 0x9094a2, 0, 0.1, 0], [0.2, 0.2, 0.2, 0xc8ccd8, 0, 0.35, 0], [0.2, 0.2, 0.2, 0x9094a2, 0, 0.6, 0], [0.5, 0.9, 0.5, 0xff6a8a, 0, 1.2, 0], [0.5, 0.2, 0.5, 0xffffff, 0, 1.4, 0], [0.7, 0.28, 0.5, 0xff6a8a, 0.3, 0.9, 0]],
  cloud: [[1.1, 0.5, 0.7, WHITE, 0, 0.6, 0], [0.7, 0.5, 0.6, WHITE, -0.5, 0.9, 0], [0.7, 0.55, 0.6, WHITE, 0.45, 1.0, 0], [0.5, 0.4, 0.5, 0xdff4ff, 0, 1.25, 0]],
};
const SHADOW_DARK = new THREE.Color(0.08, 0.05, 0.12), RING_PINK = new THREE.Color(1, 0.35, 0.6), RING_GOLD = new THREE.Color(1, 0.82, 0.2);
const JACK_PLAIN = new THREE.Color(1, 1, 1), JACK_GOLD = new THREE.Color(1.5, 1.2, 0.35);

export class DoorsLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    this.world = game.world;
    this.plan = part.plan;
    this.cells = new LiveCells(game.world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;                                          // tests set it and call step(dt) themselves
    this.clock = 0; this.syncAcc = 1; this.chipAcc = 1; this.clearAcc = 0;
    this.seed = hashStr(`${game.playerId ?? 'p'}|${game.world.seed ?? 1}`);
    this.meshes = []; this.geos = []; this.mats = [];
    this.hops = [];                                // trainers jumping out of their doors
    this.doorList = []; this.doorOf = new Map();
    for (const r of this.plan.rooms) this.addDoor({ id: `r${r.k}`, k: r.k, kind: r.kind, cells: r.door.cells, centre: r.door.centre, open: r.door.open });
    this.plan.nested.doors.forEach((d, i) => this.addDoor({ id: `n${i}`, k: this.plan.nested.k, kind: 'nested', cells: d.cells, centre: d.centre, nestedIndex: i }));
    this.chestAt = new Map(this.plan.chests.map(c => [key(...c.cell), c]));
    this.giftAt = new Set(this.plan.gift.surface.map(c => key(...c)));
    this.popAt = new Map(this.plan.popup.boxes.map(b => [key(...b.cell), b]));
    // the Piñata Party (bows 1-3)
    this.pn = { phase: 'idle', round: 0, run: null, t: 0, resultT: 0, swingT: 9, silly: 0, burstAt: null };
    this.attempts = [0, 0, 0, 0]; this.misses = [0, 0, 0, 0];
    // Jack Catch (bow 4)
    this.jc = { phase: 'idle', run: null, t: 0, resultT: 0, splatT: 9, won: false, open: new Map() };
    this.jcAttempt = 0; this.jcMisses = 0;
    // the slide
    this.slide = new Mover({ path: PATHS.line({ points: this.plan.slide.path, speed: this.pathLength() / this.plan.slide.time }), canLeave: false, run: 'ride', onEnd: () => this.slideEnd() });
    this.burst = null;
    this.inConfetti = false; this.giftWasDone = false; this.bossBounce = -1;
    this.pitBalls = this.makePitBalls();
    this.savedNooks = null;
    this.buildMeshes();
    this.syncBlocks();
  }

  /* ---------------------------------- small helpers ---------------------------------- */
  pathLength() { const p = this.plan.slide.path; let s = 0; for (let i = 0; i + 1 < p.length; i++) s += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1], p[i + 1][2] - p[i][2]); return s; }
  addDoor(d) { d.opened = !!d.open; this.doorList.push(d); for (const c of d.cells) this.doorOf.set(key(...c), d); }
  toast(m) { this.game.ui?.toast(m); }
  once(id, m) { if (this.game.toldOnce?.has(id)) return; this.game.toldOnce?.add(id); this.toast(m); }
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  pos() { return this.game.player.pos; }
  hard() { return (this.game.bossWins?.doors || 0) > 0; }
  bows() { return bowState(this.game); }
  inBoxXZ(b, p = this.pos()) { return p.x >= b.x0 && p.x < b.x1 + 1 && p.z >= b.z0 && p.z < b.z1 + 1 && p.y >= b.y0 - 1 && p.y <= b.y1 + 2; }
  roomAt(p = this.pos()) { return this.plan.rooms.find(r => this.inBoxXZ({ ...r.inner, y0: 10, y1: 24 }, p)) ?? null; }
  onRing(p = this.pos(), r = RING.r + 0.5) { return Math.hypot(p.x - RING.x, p.z - RING.z) <= r && Math.abs(p.y - 11) < 2.5; }
  onPopPad(p = this.pos()) { const c = this.plan.popup.pad.centre; return Math.abs(p.x - c[0]) < 3 && Math.abs(p.z - c[1]) < 2.4 && Math.abs(p.y - 11) < 1.5; }
  inPopRoom(p = this.pos()) { return this.inBoxXZ({ ...this.plan.popup.room, y0: 10, y1: 24 }, p); }
  onHall(p = this.pos()) { return p.x >= 40 && p.x < 73 && p.z >= 40 && p.z < 73; }
  eye() { const e = this.game.player.eyePos; return { x: e.x, y: e.y, z: e.z }; }
  look() { const f = this.game.player.forward; return { x: f.x, y: f.y, z: f.z }; }

  /* ---------------------------------- meshes ---------------------------------- */
  buildMeshes() {
    const scene = this.game.scene;
    if (!scene) return;
    const lam = () => { const m = new THREE.MeshLambertMaterial({ vertexColors: true }); this.mats.push(m); return m; };
    const add = (mesh, geo) => { scene.add(mesh); this.meshes.push(mesh); if (geo) this.geos.push(geo); return mesh; };
    const inst = (geo, mat, n) => { const m = add(new THREE.InstancedMesh(geo, mat, n), geo); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; return m; };
    // the piñata (one mesh, its geometry swapped per round), its rope, the balloons, the party stick
    this.pinataGeos = Object.fromEntries(Object.entries(PINATAS).map(([id, b]) => [id, merged(b)]));
    for (const g of Object.values(this.pinataGeos)) this.geos.push(g);
    this.pinata = add(new THREE.Mesh(this.pinataGeos.llama, lam())); this.pinata.visible = false;
    const rg = new THREE.BoxGeometry(0.05, 1, 0.05); rg.translate(0, 0.5, 0);
    const rm = new THREE.MeshLambertMaterial({ color: 0xfff0d0 }); this.mats.push(rm);
    this.rope = add(new THREE.Mesh(rg, rm), rg); this.rope.visible = false;
    const blg = merged(balloonBoxes());
    this.balloons = add(new THREE.Mesh(blg, lam()), blg); this.balloons.visible = false;
    const sg0 = merged(stickBoxes());
    this.stick = add(new THREE.Mesh(sg0, lam()), sg0); this.stick.visible = false;
    // shadows on the floor (the piñata's, each flying jack's) and rings (where a pie lands; where a jack lands, as help)
    const shg = new THREE.CircleGeometry(0.55, 18); shg.rotateX(-Math.PI / 2);
    const shm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }); this.mats.push(shm);
    this.shadows = inst(shg, shm, 8);
    const rng = new THREE.RingGeometry(0.62, 0.9, 24); rng.rotateX(-Math.PI / 2);
    const rngm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }); this.mats.push(rngm);
    this.rings = inst(rng, rngm, 8);
    for (let i = 0; i < 8; i++) { this.shadows.setColorAt(i, SHADOW_DARK); this.rings.setColorAt(i, RING_PINK); }
    // the bow (from a piñata) and the Big Gift's bow
    const bg = merged(bowBoxes(1)), bigG = merged(bowBoxes(4));
    this.bow = add(new THREE.Mesh(bg, lam()), bg); this.bow.visible = false;
    this.bigBow = add(new THREE.Mesh(bigG, lam()), bigG);
    this.bigBow.position.set(this.plan.gift.bow[0], this.plan.gift.bow[2] + 0.4, this.plan.gift.bow[1]);
    // the silly surprise that falls out of a piñata with the candy (one mesh, its geometry swapped)
    this.propGeos = Object.fromEntries(Object.entries(propBoxes).map(([id, b]) => [id, merged(b)]));
    for (const g of Object.values(this.propGeos)) this.geos.push(g);
    this.prop = add(new THREE.Mesh(this.propGeos.duck, lam())); this.prop.visible = false;
    // flying jacks and pies
    const jg = merged(jackBoxes()), pg = merged(pieBoxes());
    this.jacks = inst(jg, lam(), 6);
    for (let i = 0; i < 6; i++) this.jacks.setColorAt(i, JACK_PLAIN);
    this.pies = inst(pg, lam(), 4);
    // the cream on the screen after a splat (in front of the camera)
    const spg = new THREE.CircleGeometry(1, 20);
    const spm = new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0, depthTest: false, depthWrite: false }); this.mats.push(spm);
    this.cream = add(new THREE.Mesh(spg, spm), spg); this.cream.visible = false; this.cream.renderOrder = 999;
    // confetti (and candy): camera-facing quads, one instanced mesh
    const cg = new THREE.PlaneGeometry(0.2, 0.2);
    const cm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); this.mats.push(cm);
    this.confetti = add(new THREE.InstancedMesh(cg, cm, DOORS.confetti), cg);
    this.confetti.frustumCulled = false; this.confetti.count = 0;
    const pal = [0xff6a8a, 0xffd23a, 0x3ac8e8, 0x6ae86a, 0xb05ae8, 0xffffff], c = new THREE.Color();
    for (let i = 0; i < DOORS.confetti; i++) this.confetti.setColorAt(i, c.setHex(pal[i % pal.length]));
    // ball pit balls
    const sg = new THREE.SphereGeometry(0.3, 6, 4);
    const sm = new THREE.MeshLambertMaterial(); this.mats.push(sm);
    this.balls = add(new THREE.InstancedMesh(sg, sm, DOORS.balls), sg);
    this.balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.balls.frustumCulled = false; this.balls.count = 0;
    const bc = [0xe8384a, 0x3a8ce8, 0xffd23a, 0x46c86e, 0xb05ae8];
    for (let i = 0; i < DOORS.balls; i++) this.balls.setColorAt(i, c.setHex(bc[i % bc.length]));
    this.tmp = new THREE.Object3D(); this.tmpV = new THREE.Vector3(); this.tmpQ = new THREE.Quaternion(); this.up = new THREE.Vector3(0, 1, 0);
  }

  dispose() {
    this.game.ui?.setScore?.(null);
    this.unslow();
    this.restoreNooks();
    if (this.slide.rider) this.slide.leave(false);
    for (const m of this.meshes) { m.parent?.remove(m); m.dispose?.(); }
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.meshes = []; this.geos = []; this.mats = [];
  }

  /* ---------------------------------- blocks: ribbons, the Big Gift's front, chests ---------------------------------- */
  syncBlocks() {
    const g = this.plan.gift, st = this.bows();
    g.ribbons.forEach((list, i) => { const want = st.bows[i] ? B.GIFT_WALL : B.RIBBON; for (const [x, y, z] of list) this.cells.want(x, y, z, want); });
    for (const [x, y, z] of g.front) this.cells.want(x, y, z, st.done ? B.AIR : B.GIFT_WALL);
    for (const c of this.plan.chests) this.cells.want(...c.cell, (this.game.beaten || []).includes(c.key) ? B.CHEST_OPEN : B.CHEST);
    if (st.done && !this.giftWasDone) { // the Big Gift bursts open (once a trip)
      this.giftWasDone = true;
      this.doBurst([g.bossAt[0], 13, g.bossAt[1] - 2.5]);
      sound.play('jackpop');
      this.bossBounce = 0;
    } else if (!st.done) this.giftWasDone = false;
  }

  /* ---------------------------------- the hooks of the live-part interface ---------------------------------- */
  prompt(block, how) {
    const k = key(block.x, block.y, block.z);
    const d = this.doorOf.get(k);
    if (d) return d.opened ? null : `Gift door · ${how} to open`;
    if (this.chestAt.has(k)) return null;
    if (this.popAt.has(k)) return this.jc.phase === 'run' ? 'Run under the jacks!' : 'A pop-up box · stand on the pad and press Play!';
    if (this.giftAt.has(k)) return this.bows().done ? 'The Big Gift is open!' : `The Big Gift · ${how} to look`;
    return null;
  }
  action(block) {
    const k = key(block.x, block.y, block.z);
    if (this.doorOf.has(k)) return 'Open!';
    if (this.giftAt.has(k)) return 'Look!';
    return null;
  }

  hit(block) {
    const k = key(block.x, block.y, block.z);
    const d = this.doorOf.get(k);
    if (d) { this.openDoor(d); return true; }
    const chest = this.chestAt.get(k);
    if (chest) { this.openChest(chest); return true; }
    if (this.popAt.has(k)) { this.toast(this.jc.phase === 'run' ? 'Run under the jacks to catch them!' : 'Stand on the pad and press Play!'); return true; }
    if (this.giftAt.has(k)) {
      const st = this.bows();
      this.toast(st.done ? 'All the ribbons are untied! Open the Big Gift!' : `Jolly Jax: My gift has 4 ribbons. Win the golden bows to untie them! (🎀 ${st.n} / 4)`);
      return true;
    }
    return false;
  }

  // A tap on the screen (main.js tapAt, before it looks for blocks): while a piñata swings, the stick swings the way you tapped.
  tap(origin, dir) {
    if (this.paused() || this.pn.phase !== 'run' || !this.onHall()) return false;
    this.whackNow(origin, dir);
    return true;
  }

  // The word on the big button (null = nothing here).
  near(p) {
    if (this.paused() || this.slide.rider) return null;
    const pos = p.pos ?? p, pn = this.pn, st = this.bows();
    if (this.slideSpot(p)) return 'Slide!';
    if (pn.phase === 'run' && this.onHall(pos)) return 'Whack!';
    if (this.onRing(pos) && pn.phase === 'idle' && this.nextRound() > 0) return this.misses[this.nextRound()] ? 'Again!' : 'Play!';
    if (this.inPopRoom(pos) && this.onPopPad(pos) && !st.bows[3] && this.jc.phase !== 'run') return this.jcMisses ? 'Again!' : 'Play!';
    return null;
  }
  use(p) {
    const w = this.near(p);
    if (!w) return false;
    if (w === 'Slide!') return this.rideSlide();
    if (w === 'Whack!') { this.whackNow(this.eye(), this.look()); return true; }
    if (w === 'Play!' || w === 'Again!') return this.inPopRoom(p.pos ?? p) ? this.startCatch() : this.startPinata();
    return false;
  }

  /* ---------------------------------- doors, rooms, chests ---------------------------------- */
  openDoor(d, quiet = false) {
    if (d.opened) return;
    d.opened = true;
    for (const [x, y, z] of d.cells) this.cells.want(x, y, z, B.AIR);
    sound.play('giftopen');
    const c = d.centre;
    this.doBurst([c[0], 12.5, c[1]], 0.35);
    if (quiet) return;
    if (d.kind === 'nested') this.toast(d.nestedIndex === 2 ? 'The smallest door! What is behind it?' : ROOM_SAY.nested);
    else if (ROOM_SAY[d.kind]) this.toast(ROOM_SAY[d.kind]);
    if (d.kind === 'trainer1' || d.kind === 'trainer2') this.jumpOut(d);
  }
  jumpOut(d) {
    const i = d.kind === 'trainer1' ? 0 : 1;
    const npc = this.game.npcs?.list?.find(n => n.kind === 'crew' && n.def?.boss === 'doors' && n.def.index === i);
    if (!npc) return;
    const o = SIDES[Math.floor(d.k / 3)].o;
    this.hops.push({ npc, t: 0, from: npc.pos.clone(), to: npc.pos.clone().add(new THREE.Vector3(-o[0], 0, -o[1])) });
  }
  stepHops(dt) {
    for (const h of this.hops) {
      h.t += dt;
      const k = Math.min(1, h.t / DOORS.hop);
      h.npc.steer = true; h.npc.moving = k < 1;
      h.npc.pos.set(h.from.x + (h.to.x - h.from.x) * k, h.from.y + Math.sin(Math.PI * k) * 0.7, h.from.z + (h.to.z - h.from.z) * k);
      if (k >= 1) { h.npc.pos.copy(h.to); h.npc.steer = false; h.npc.moving = false; }
    }
    this.hops = this.hops.filter(h => h.t < DOORS.hop);
  }
  openChest(c) {
    const g = this.game;
    if ((g.beaten || []).includes(c.key)) { this.toast('The gift box is empty now. Thank you for opening it!'); return; }
    g.beaten.push(c.key);
    g.cubes += DOORS.cubes;
    g.ui?.renderHud?.();
    this.cells.want(...c.cell, B.CHEST_OPEN);
    sound.play('cube');
    this.doBurst([c.cell[0] + 0.5, c.cell[1] + 1, c.cell[2] + 0.5], 0.5);
    this.toast(`Ta-da! +${DOORS.cubes} Capture Cubes`);
    g.save?.();
  }

  /* ---------------------------------- the slide ---------------------------------- */
  slideSpot(p) {
    const s = this.plan.slide, pos = p.pos ?? p;
    return Math.hypot(pos.x - s.stand[0], pos.z - s.stand[1]) < 1.6 && Math.abs(pos.y - s.stand[2]) < 0.8 && !this.slide.rider;
  }
  rideSlide() {
    this.slide.board(this.game.player);
    sound.play('boing');
    this.toast('Wheee!');
    return true;
  }
  slideEnd() { sound.play('popout'); }

  /* ---------------------------------- a game is on: keep the wild gift boxes away ---------------------------------- */
  // While a piñata swings or the jacks fly, no wild creature spawns or stays near (so the crosshair, a tap or a bump never finds a gift box
  // instead of the game). The nooks come back when the game ends.
  gameOn() { return this.pn.phase === 'run' || this.jc.phase === 'run'; }
  hideNooks() { if (this.savedNooks || !this.world.nooks) return; this.savedNooks = this.world.nooks; this.world.nooks = this.savedNooks.filter(n => !this.nearGame(n)); }
  restoreNooks() { if (this.savedNooks) { if (this.world === this.game.world) this.world.nooks = this.savedNooks; this.savedNooks = null; } }
  nearGame(q) { return (this.pn.phase === 'run' && Math.hypot(q.x - RING.x, q.z - RING.z) < DOORS.clearR) || (this.jc.phase === 'run' && this.inBoxXZ({ ...this.plan.popup.room, x0: this.plan.popup.room.x0 - 2, x1: this.plan.popup.room.x1 + 2, z0: this.plan.popup.room.z0 - 2, z1: this.plan.popup.room.z1 + 2, y0: 10, y1: 24 }, q)); }
  clearWilds() {
    const cm = this.game.creatures;
    if (!cm?.list) return;
    for (const w of [...cm.list]) if (!w.frozen && this.nearGame(w.pos)) cm.remove(w);
  }

  /* ---------------------------------- the Piñata Party (bows 1-3) ---------------------------------- */
  nextRound() { const b = this.bows().bows; for (let i = 0; i < 3; i++) if (!b[i]) return i + 1; return 0; }
  startPinata() {
    const pn = this.pn, round = this.nextRound();
    if (!round || pn.phase !== 'idle') return false;
    const attempt = this.attempts[round]++;
    const plan = pinataPlan(this.seed, round, attempt, { help: this.misses[round], hard: this.hard() });
    Object.assign(pn, { phase: 'run', round, run: newRun(plan), t: 0, resultT: 0, swingT: 9, burstAt: null });
    this.pinata.geometry = this.pinataGeos[plan.id];
    this.once('doors-whack', 'Whack the piñata when it swings AT you!');
    this.toast(`${plan.name}! ⏱ ${plan.time} s`);
    sound.play('doorwhoosh');
    this.hideNooks(); this.clearWilds();
    return true;
  }
  // One swing of the stick from `eye` towards `dir` (only its sideways part counts).
  whackNow(eye, dir) {
    const pn = this.pn;
    if (pn.phase !== 'run') return false;
    const res = whack(pn.run, pn.t, eye, dir);
    if (!res.swung) return false;
    pn.swingT = 0;
    if (!res.hit) { sound.play('doorwhoosh'); this.once('doors-whoosh', 'Whoosh! Too soon. Wait for it to swing close.'); return true; }
    if (res.big) {
      sound.play('pinatawhack');
      const left = pn.run.hp;
      if (!res.burst) this.toast(left === 1 ? 'CRACK! 1 more!' : `CRACK! ${left} more!`);
      const p = pinataAt(pn.run, res.tau);
      this.doBurst([p.x, p.y, p.z], 0.25);
    } else { sound.play('boop'); this.once('doors-bonk', 'Bonk! Whack it when it swings AT you, low down.'); }
    if (res.dodge) this.toast('It dodged!');
    return true;
  }
  stepPinata(dt) {
    const pn = this.pn;
    if (pn.phase === 'run') {
      pn.t += dt;
      const run = pn.run;
      if (!this.onHall()) { this.endPinata(false, true); return; } // you went into a room: the piñata waits
      if (run.done && pn.t >= run.burstAt) this.popPinata();
      else if (timeUp(run, pn.t)) this.endPinata(false);
    } else if (pn.phase === 'burst' || pn.phase === 'nap') {
      pn.resultT += dt;
      if (pn.resultT >= (pn.phase === 'burst' ? DOORS.burst : DOORS.nap)) { pn.phase = 'idle'; pn.run = null; }
    }
  }
  popPinata() {
    const pn = this.pn, run = pn.run, g = this.game;
    pn.phase = 'burst'; pn.resultT = 0; pn.burstAt = pinataAt(run, run.burstAt);
    pn.silly = hashStr(`silly|${this.seed}|${pn.round}|${run.plan.attempt}`) % SILLY.length;
    const k = bowKey(pn.round);
    if (!g.beaten.includes(k)) g.beaten.push(k);
    this.misses[pn.round] = 0;
    sound.play('candyrain');
    const s = SILLY[pn.silly];
    setTimeout(() => sound.play(s.sound), 450);
    this.toast(`Pop! Candy! 🎀 ${this.bows().n} / 4`);
    setTimeout(() => this.toast(s.say), 900);
    this.doBurst([pn.burstAt.x, pn.burstAt.y, pn.burstAt.z], 1.2);
    g.save?.();
    this.syncBlocks();
    this.restoreNooks();
  }
  endPinata(won, quiet = false) {
    const pn = this.pn;
    if (!quiet) {
      this.misses[pn.round]++;
      sound.play('sillyhonk');
      this.toast('The piñata went up for a nap. Again? It will swing slower.');
    }
    pn.phase = quiet ? 'idle' : 'nap'; pn.resultT = 0;
    if (quiet) pn.run = null;
    this.restoreNooks();
  }

  /* ---------------------------------- Jack Catch in the Pop-Up Room (bow 4) ---------------------------------- */
  startCatch() {
    const jc = this.jc, pu = this.plan.popup;
    if (this.bows().bows[3] || jc.phase === 'run') return false;
    const plan = catchPlan(this.seed, this.jcAttempt++, { help: this.jcMisses, hard: this.hard(), boxes: pu.boxes, floor: pu.floor, start: pu.pad.centre });
    Object.assign(jc, { phase: 'run', run: newCatch(plan), t: 0, resultT: 0, splatT: 9, won: false, open: new Map() });
    this.once('doors-catch', 'Catch the jacks! Run under their shadows. Dodge the pies!');
    sound.play('doorwhoosh');
    this.hideNooks(); this.clearWilds();
    return true;
  }
  stepJacks(dt) {
    const jc = this.jc;
    if (jc.phase === 'run') {
      if (!this.inPopRoom()) { jc.phase = 'idle'; jc.run = null; this.unslow(); this.syncPopBoxes(); this.restoreNooks(); return; } // you left: the jacks wait
      jc.t += dt;
      const p = this.game.player, events = stepCatch(jc.run, jc.t, p.pos, p.vel);
      for (const e of events) this.onCatchEvent(e);
      if (jc.splatT < 9) jc.splatT += dt;
      // sticky shoes after a splat
      if (slowed(jc.run, jc.t)) p.speedCap = CATCH.pies.cap; else this.unslow();
      this.syncPopBoxes();
    } else if (jc.phase === 'result') { jc.resultT += dt; if (jc.splatT < 9) jc.splatT += dt; }
  }
  onCatchEvent(e) {
    const jc = this.jc, l = jc.run.plan.launches.find(q => q.n === e.n);
    if (e.type === 'launch') { jc.open.set(l.box, jc.t); sound.play(l.kind === 'pie' ? 'sillyhonk' : 'jackpop'); }
    else if (e.type === 'catch') { sound.play('jackcatch'); if (e.gold) this.toast('Gold jack! +2'); }
    else if (e.type === 'miss') sound.play('popout');
    else if (e.type === 'splat') { sound.play('piesplat'); jc.splatT = 0; this.toast('Splat! A cream pie! Sticky shoes...'); }
    else if (e.type === 'end') this.endCatch(e.won, e.score);
  }
  endCatch(won, score) {
    const jc = this.jc, g = this.game;
    jc.phase = 'result'; jc.resultT = 0; jc.won = won;
    this.unslow();
    this.syncPopBoxes();
    this.restoreNooks();
    if (won) {
      this.jcMisses = 0;
      if (!g.beaten.includes(bowKey(4))) g.beaten.push(bowKey(4));
      sound.play('rightdoor');
      this.toast(`You caught ${score}! 🎀 ${this.bows().n} / 4`);
      const c = this.plan.popup.pad.centre;
      this.doBurst([c[0], 14, c[1]], 1);
      g.save?.();
      this.syncBlocks();
    } else {
      this.jcMisses++;
      sound.play('sillyhonk');
      this.toast(`You caught ${score}! Again? They will fly slower.`);
    }
  }
  unslow() { const p = this.game.player; if (p && p.speedCap === CATCH.pies.cap) p.speedCap = null; }
  syncPopBoxes() {
    const jc = this.jc;
    for (const b of this.plan.popup.boxes) {
      const at = jc.phase === 'run' ? jc.open.get(b.i) : null;
      this.cells.want(...b.cell, at != null && jc.t - at < 0.4 ? B.POP_BOX_OPEN : B.POP_BOX);
    }
  }

  /* ---------------------------------- confetti, the pit, the Boss ---------------------------------- */
  doBurst(at, scale = 1) { this.burst = { x: at[0] ?? at.x, y: at[1] ?? at.y, z: at[2] ?? at.z, age: 0, scale }; }
  stepRooms(dt) {
    const room = this.roomAt();
    const inConf = room?.kind === 'confetti';
    if (inConf && !this.inConfetti) {
      const c = this.plan.confetti.centre;
      this.doBurst([c[0], 20, c[1]], 1.3);
      sound.play('rightdoor');
      this.toast('Ta-da!');
    }
    this.inConfetti = inConf;
    if (this.burst) { this.burst.age += dt; if (this.burst.age > 3.4) this.burst = null; }
    if (this.bossBounce >= 0) { this.bossBounce += dt; if (this.bossBounce > 0.6) { this.bossBounce = -1; this.setBossScale(1); } else this.setBossScale(1 + 0.25 * Math.sin((this.bossBounce / 0.6) * Math.PI)); }
  }
  setBossScale(k) {
    const n = this.game.npcs?.list?.find(q => q.kind === 'boss' && q.def?.id === 'doors');
    if (n?.model) n.model.scale.y = (n.model.userData.baseScale ??= n.model.scale.x) * k;
  }

  makePitBalls() {
    const p = this.plan.pit, out = [];
    let i = 0;
    for (const [x, z] of p.cells) {
      if (x === p.chest[0] && z === p.chest[2]) continue; // the chest's own cell stays clear
      for (let n = 0; n < 2 && out.length < DOORS.balls; n++, i++) out.push({ hx: x + 0.15 + rand01(i, 'bx') * 0.7, hz: z + 0.15 + rand01(i, 'bz') * 0.7, y: p.floorY + 1 + 0.3 });
    }
    return out;
  }

  /* ---------------------------------- the clock ---------------------------------- */
  update(dt) {
    this.cells.flush();
    if ((this.syncAcc += dt) >= 0.25) { this.syncAcc = 0; this.syncBlocks(); }
    if (!this.manual && !this.paused()) this.step(dt);
    this.draw();
  }
  step(dt) {
    this.clock += dt;
    this.stepPinata(dt); this.stepJacks(dt); this.slide.update(dt); this.stepRooms(dt); this.stepHops(dt);
    if (this.gameOn() && (this.clearAcc += dt) >= 0.5) { this.clearAcc = 0; this.clearWilds(); }
    if (this.pn.swingT < 9) this.pn.swingT += dt;
    this.cells.flush();
    if ((this.chipAcc += dt) >= 0.2) { this.chipAcc = 0; this.chip(); }
  }
  chip() {
    const ui = this.game.ui;
    if (!ui?.setScore) return;
    const st = this.bows(), pos = this.pos(), pn = this.pn, jc = this.jc;
    let s = null;
    if (jc.phase === 'run' && this.inPopRoom(pos)) s = { text: `🤡 ${jc.run.score} / ${jc.run.plan.need} · ${jacksLeft(jc.run)} left`, done: false };
    else if (pn.phase === 'run' && this.onHall(pos)) { const r = pn.run; s = { text: `🪅 CRACKs ${r.plan.hp - r.hp} / ${r.plan.hp} · ⏱ ${Math.max(0, Math.ceil(r.plan.time - pn.t))}`, done: false }; }
    else if (st.done) s = { text: 'Open the Big Gift!', done: true };
    else if (this.roomAt(pos) || this.onHall(pos)) s = { text: `🎀 ${st.n} / 4`, done: false };
    ui.setScore(s);
  }

  /* ---------------------------------- drawing ---------------------------------- */
  draw() {
    if (!this.pinata) return;
    const p = this.pos(), near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
    let nShadow = 0, nRing = 0;
    const shadow = (x, z, size, col = SHADOW_DARK) => { if (nShadow >= 8) return; const o = this.tmp; o.position.set(x, 11.03, z); o.rotation.set(0, 0, 0); o.scale.setScalar(Math.max(0.05, size)); o.updateMatrix(); this.shadows.setMatrixAt(nShadow, o.matrix); this.shadows.setColorAt(nShadow, col); nShadow++; };
    const ring = (x, z, size, col) => { if (nRing >= 8) return; const o = this.tmp; o.position.set(x, 11.05, z); o.rotation.set(0, this.clock * 2, 0); o.scale.setScalar(size); o.updateMatrix(); this.rings.setMatrixAt(nRing, o.matrix); this.rings.setColorAt(nRing, col); nRing++; };
    // the piñata
    if (near(RING.x, RING.z, DOORS.hallRange)) this.drawPinata(shadow);
    else { this.pinata.visible = this.rope.visible = this.balloons.visible = this.bow.visible = this.prop.visible = false; }
    this.drawStick();
    // the flying jacks and pies
    if (near(this.plan.popup.pad.centre[0], this.plan.popup.pad.centre[1], DOORS.popRange)) this.drawJacks(shadow, ring);
    else this.jacks.count = this.pies.count = 0;
    this.shadows.count = nShadow; this.rings.count = nRing;
    this.shadows.instanceMatrix.needsUpdate = this.rings.instanceMatrix.needsUpdate = true;
    if (this.shadows.instanceColor) this.shadows.instanceColor.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    this.drawCream();
    // pit balls
    const pit = this.plan.pit, bn = near(pit.chest[0], pit.chest[2], 24);
    this.balls.visible = bn;
    if (bn) this.drawBalls(p);
    // confetti
    this.drawConfetti();
    // the Big Gift's bow
    this.bigBow.visible = !this.bows().done;
    if (this.bigBow.visible) this.bigBow.rotation.y = Math.sin(this.clock * 1.5) * 0.15;
  }

  // The piñata, its rope and balloons: swinging in a game; resting high over the rug while you may press Play!; floating up for a nap.
  drawPinata(shadow) {
    const pn = this.pn, round = pn.round || this.nextRound();
    const show = pn.phase !== 'idle' || round > 0;
    this.pinata.visible = this.rope.visible = this.balloons.visible = show && pn.phase !== 'burst';
    this.bow.visible = false; this.prop.visible = false;
    if (!show) return;
    let pos, top;
    if (pn.phase === 'run' || pn.phase === 'nap') {
      const t = pn.phase === 'run' ? pn.t : pn.run.plan.time;
      const q = pinataAt(pn.run, t), up = pn.phase === 'nap' ? ease(pn.resultT / DOORS.nap) * 7 : 0;
      pos = { x: q.x, y: q.y + up, z: q.z }; top = { x: q.top.x, y: PINATA.low + PINATA.rope + up, z: q.top.z };
      this.pinata.geometry = this.pinataGeos[pn.run.plan.id];
    } else if (pn.phase === 'idle') { // waiting: the next piñata hangs high over the middle of the rug and turns gently
      const sway = Math.sin(this.clock * 1.3) * 0.5;
      top = { x: RING.x, y: PINATA.low + PINATA.rope + 2.5, z: RING.z };
      pos = { x: RING.x + sway, y: top.y - PINATA.rope + 0.03, z: RING.z };
      this.pinata.geometry = this.pinataGeos[PINATA.rounds[round - 1].id];
    }
    if (pos) {
      const dx = pos.x - top.x, dy = pos.y + 0.7 - top.y, dz = pos.z - top.z;
      this.balloons.position.set(top.x, top.y, top.z); this.balloons.rotation.y = Math.sin(this.clock * 0.7) * 0.3;
      // the piñata hangs along its rope and spins a bit; a fresh hit makes it wobble
      const lastHit = pn.run?.log?.length ? pn.run.log[pn.run.log.length - 1] : null, since = lastHit?.hit && pn.phase === 'run' ? pn.t - lastHit.tau : 9;
      const wob = since >= 0 && since < 0.4 ? Math.sin(since * 40) * 0.25 * (1 - since / 0.4) : 0;
      this.pinata.position.set(pos.x, pos.y, pos.z);
      this.pinata.rotation.set(Math.atan2(dz, -dy) * 0.6 + wob, this.clock * 0.6, -Math.atan2(dx, -dy) * 0.6);
      const dmg = pn.run ? 1 - pn.run.hp / pn.run.plan.hp : 0;
      this.pinata.scale.set(1 + dmg * 0.12, 1 - dmg * 0.18, 1 + dmg * 0.12);
      // the rope: from the balloons to the piñata's knot (wherever its tilt puts it)
      this.pinata.updateMatrix(); this.tmpV.set(0, 0.6, 0).applyMatrix4(this.pinata.matrix);
      const kx = this.tmpV.x - top.x, ky = this.tmpV.y - top.y, kz = this.tmpV.z - top.z, len = Math.hypot(kx, ky, kz) || 1;
      this.rope.position.set(top.x, top.y, top.z);
      this.tmpV.set(kx / len, ky / len, kz / len); this.rope.quaternion.setFromUnitVectors(this.up, this.tmpV);
      this.rope.scale.set(1, len, 1);
      shadow(pos.x, pos.z, 1.3 - Math.min(0.8, (pos.y - PINATA.low) * 0.3));
    }
    if (pn.phase === 'burst') { // the bow drops out of the candy and flies to you; the silly surprise falls to the floor
      const b = pn.burstAt, k = pn.resultT;
      this.prop.visible = true;
      this.prop.geometry = this.propGeos[SILLY[pn.silly].id];
      const fall = Math.min(1, k / 0.7), py = b.y + (11.05 - b.y) * fall * fall;
      this.prop.position.set(b.x + 0.8, py, b.z); this.prop.scale.setScalar(Math.max(0.01, Math.min(1, k * 3))); this.prop.rotation.set(0, k * 2, 0);
      const fly = ease(Math.max(0, (k - 0.5) / 1.0)), eye = this.eye();
      this.bow.visible = k < 1.5;
      this.bow.position.set(b.x + (eye.x - b.x) * fly, b.y + (eye.y - b.y) * fly + Math.sin(Math.PI * fly) * 1.2, b.z + (eye.z - b.z) * fly);
      this.bow.scale.setScalar(1 + 0.5 * fly); this.bow.rotation.set(0, k * 3, 0);
    }
  }

  // The party stick in your hand (only while a piñata is out): it rests to the right and swings across when you whack.
  drawStick() {
    const pn = this.pn, cam = this.game.camera;
    const on = pn.phase === 'run' && this.onHall() && cam;
    this.stick.visible = !!on;
    if (!on) return;
    const k = Math.min(1, pn.swingT / DOORS.stickSwing), arc = k < 1 ? Math.sin(k * Math.PI) : 0;
    const o = this.tmp;
    o.position.copy(cam.position); o.quaternion.copy(cam.quaternion);
    o.translateX(0.3 - arc * 0.4); o.translateY(-0.26 + arc * 0.08); o.translateZ(-0.6);
    o.rotateY(0.45 + arc * 1.0); o.rotateX(0.85 - arc * 0.7);
    this.stick.position.copy(o.position); this.stick.quaternion.copy(o.quaternion); this.stick.scale.setScalar(0.32);
  }

  drawJacks(shadow, ring) {
    const jc = this.jc, o = this.tmp;
    let nj = 0, np = 0;
    if (jc.phase === 'run') {
      const helpRing = jc.run.plan.help >= 2;
      for (const { l, q, to } of inAir(jc.run, jc.t)) {
        const spin = (jc.t - l.t0) * 7 + l.n;
        if (l.kind === 'pie') {
          if (np >= 4) continue;
          o.position.set(q.x, q.y, q.z); o.rotation.set(Math.sin(spin) * 0.3, spin * 0.5, 0); o.scale.setScalar(1); o.updateMatrix();
          this.pies.setMatrixAt(np++, o.matrix);
          ring(to[0], to[1], 0.9 + 0.3 * Math.sin(this.clock * 9), RING_PINK);
        } else {
          if (nj >= 6) continue;
          o.position.set(q.x, q.y, q.z); o.rotation.set(spin * 0.6, spin, 0); o.scale.setScalar(l.kind === 'gold' ? 1.1 : 1); o.updateMatrix();
          this.jacks.setMatrixAt(nj, o.matrix); this.jacks.setColorAt(nj, l.kind === 'gold' ? JACK_GOLD : JACK_PLAIN); nj++;
          shadow(q.x, q.z, 0.35 + 0.65 * q.s);            // the real shadow: right under it, bigger as it comes down
          if (helpRing) ring(to[0], to[1], 0.8, RING_GOLD); // help: where it will land
        }
      }
    }
    this.jacks.count = nj; this.pies.count = np;
    this.jacks.instanceMatrix.needsUpdate = this.pies.instanceMatrix.needsUpdate = true;
    if (this.jacks.instanceColor) this.jacks.instanceColor.needsUpdate = true;
  }

  drawCream() {
    const jc = this.jc, cam = this.game.camera, k = jc.splatT;
    const on = cam && k < DOORS.splat && (jc.phase === 'run' || jc.phase === 'result');
    this.cream.visible = !!on;
    if (!on) return;
    const o = this.tmp;
    o.position.copy(cam.position); o.quaternion.copy(cam.quaternion); o.translateZ(-0.5); o.translateX(0.06); o.translateY(0.03);
    this.cream.position.copy(o.position); this.cream.quaternion.copy(o.quaternion);
    this.cream.scale.setScalar(0.18 + 0.05 * Math.min(1, k * 8));
    this.cream.material.opacity = 0.85 * (1 - ease(k / DOORS.splat));
  }

  drawBalls(p) {
    const o = this.tmp, R = 1.4;
    const xs = this.pitBalls;
    this.balls.count = xs.length;
    xs.forEach((b, i) => {
      let x = b.hx, z = b.hz, y = b.y;
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < R && Math.abs(p.y - 10) < 3) {
        const push = (R - d) * 0.85, ux = d > 1e-4 ? dx / d : Math.cos(i), uz = d > 1e-4 ? dz / d : Math.sin(i);
        x += ux * push; z += uz * push; y += Math.max(0, 1 - d / R) * 0.35;
      }
      o.position.set(x, y, z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix();
      this.balls.setMatrixAt(i, o.matrix);
    });
    this.balls.instanceMatrix.needsUpdate = true;
  }

  drawConfetti() {
    const b = this.burst, cam = this.game.camera;
    if (!b || !cam) { this.confetti.count = 0; return; }
    const o = this.tmp, a = b.age, N = DOORS.confetti, fade = a > 2.6 ? Math.max(0, 1 - (a - 2.6) / 0.8) : 1;
    this.confetti.count = N;
    for (let i = 0; i < N; i++) {
      const vx = (rand01(i, 'vx') - 0.5) * 8 * b.scale, vz = (rand01(i, 'vz') - 0.5) * 8 * b.scale, vy = (3 + rand01(i, 'vy') * 6) * Math.sqrt(b.scale);
      const t = a * (0.6 + rand01(i, 'sp') * 0.5);
      let y = b.y + vy * t - 4.2 * t * t;
      const floor = 11.05;
      if (y < floor) y = floor;
      o.position.set(b.x + vx * t * (1 - 0.15 * t) + Math.sin(a * 5 + i) * 0.15, y, b.z + vz * t * (1 - 0.15 * t) + Math.cos(a * 4 + i) * 0.15);
      o.quaternion.copy(cam.quaternion); o.rotateZ(a * 6 + i);
      o.scale.setScalar(Math.max(0.01, fade));
      o.updateMatrix();
      this.confetti.setMatrixAt(i, o.matrix);
    }
    this.confetti.instanceMatrix.needsUpdate = true;
  }

  /* ---------------------------------- after a Boss battle, tests ---------------------------------- */
  // A won Boss battle uses the four bows up (a rematch is three new piñatas and a new Jack Catch, a bit harder).
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.picture?.id !== 'doors' || opts.picture.crew != null) return;
    const g = this.game;
    for (let i = 1; i <= 4; i++) { const k = g.beaten.indexOf(bowKey(i)); if (k >= 0) g.beaten.splice(k, 1); }
    this.attempts = [0, 0, 0, 0]; this.misses = [0, 0, 0, 0]; this.jcMisses = 0;
    this.syncBlocks();
  }

  info() {
    const pn = this.pn, jc = this.jc, r = pn.run;
    const q = r && pn.phase === 'run' ? pinataAt(r, pn.t) : null;
    return { clock: this.clock, bows: this.bows(),
      pinata: { phase: pn.phase, round: pn.round, attempt: r?.plan.attempt, t: pn.t, hp: r?.hp, need: r?.plan.hp, hits: r?.hits, big: r?.big, whiffs: r?.whiffs, time: r?.plan.time, misses: [...this.misses], at: q && { x: +q.x.toFixed(2), y: +q.y.toFixed(2), z: +q.z.toFixed(2) } },
      catch: { phase: jc.phase, t: jc.t, score: jc.run?.score, need: jc.run?.plan.need, left: jc.run ? jacksLeft(jc.run) : null, splats: jc.run?.splats, won: jc.won, misses: this.jcMisses },
      opened: this.doorList.filter(d => d.opened).map(d => d.id), sliding: !!this.slide.rider };
  }
  topNow() { return this.pn.run ? topAt(this.pn.run, this.pn.t) : null; }
}
