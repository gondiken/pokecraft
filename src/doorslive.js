// T44: the live part of the Room of Doors (LIVE.doors, plans/T44.md section 4). Surprise doors that open on a hit, twelve rooms (a slide,
// a ball pit, a confetti shower, springs, doors in doors, a gift shop, Healer Stella, two trainers), the Shuffle Stage (follow the bow with
// your eyes), the Pop-Up Room (boop the jacks), the Big Gift that four golden bows untie, and the gift chests.
//
// Everything is per player and in memory except the bows (`beaten` keys pw:doors:bow1..4, saved at once) and the gift chests (pw:doors:gift*).
// Blocks change only through LiveCells / world.setLive (never an edit). Clocks are summed frame dt (frozen in a battle, a question, a panel
// and the pause screen); every motion is a closed form of a clock, so 60 fps and 1 fps agree. `manual` + `step(dt)` are for tests.
// No hold, no release: the Shuffle Stage and the Pop-Up Room take one press of the action button (E, a click, a tap, the big button).
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { Mover, PATHS } from './mover.js';
import { sound } from './sound.js';
import { SHUFFLE, shufflePlan, doorsAt, restDoors, pickDoor, helpLevel, lookOf, hashStr } from './shuffle.js';
import { POPUP, popPlan, popAt, boopOk, popEnd, needOf } from './popup.js';
import { STAGE, SIDES, bowKey, bowState } from './doorsland.js';

export const DOORS = {
  cubes: 3,            // a gift chest
  hop: 0.3,            // a trainer jumps out of its door
  resultShow: 1.4,     // a wrong door shows its surprise this long before "Again!"
  win: 2.2,            // the bow flies to you, confetti, then the stage rests
  boopR: 1.25,         // how close (blocks) a look ray must pass a jack to boop it
  popRange: 30, stageRange: 48,
  confetti: 160, balls: 120,
};
const SILLY = [
  { id: 'duck', say: 'Quack! A rubber duck! The bow was here. Again?', sound: 'sillyhonk' },
  { id: 'bubbles', say: 'Bubbles! Pop pop pop! The bow was here. Again?', sound: 'popout' },
  { id: 'sock', say: 'Boing! A sock on a spring! The bow was here. Again?', sound: 'boing' },
  { id: 'cloud', say: 'A little cloud! Puff! The bow was here. Again?', sound: 'smokepuff' },
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
const HOT = new THREE.Color(2, 2, 0.6), PLAIN = new THREE.Color(1, 1, 1); // a booped jack's nose flashes
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
const GOLD = 0xffd23a, CREAM = 0xfff0d0, WHITE = 0xffffff;
// The golden bow: two loops, a knot and two tails (origin = the middle of the knot).
const bowBoxes = (s = 1) => [[0.5 * s, 0.34 * s, 0.14 * s, GOLD, -0.3 * s, 0.12 * s, 0], [0.5 * s, 0.34 * s, 0.14 * s, GOLD, 0.3 * s, 0.12 * s, 0], [0.24 * s, 0.24 * s, 0.2 * s, 0xe8a81a, 0, 0.1 * s, 0],
  [0.12 * s, 0.4 * s, 0.1 * s, GOLD, -0.12 * s, -0.22 * s, 0], [0.12 * s, 0.4 * s, 0.1 * s, GOLD, 0.12 * s, -0.22 * s, 0], [0.2 * s, 0.16 * s, 0.08 * s, WHITE, -0.34 * s, 0.14 * s, 0.08], [0.2 * s, 0.16 * s, 0.08 * s, WHITE, 0.34 * s, 0.14 * s, 0.08]];
// A stage door: a frame of gold (posts, lintel, a dark back so the bow shows) and a panel that swings on its left hinge.
const frameBoxes = () => [[0.22, 3.2, 0.5, GOLD, -1.09, 1.6, 0], [0.22, 3.2, 0.5, GOLD, 1.09, 1.6, 0], [2.4, 0.22, 0.5, GOLD, 0, 3.09, 0], [2.0, 2.98, 0.06, 0x3a2a5a, 0, 1.49, -0.2], [2.4, 0.14, 0.6, 0xb8861a, 0, 0.07, 0]];
const panelBoxes = () => [[2.0, 2.98, 0.12, WHITE, 1.0, 1.49, 0], [0.34, 2.98, 0.14, CREAM, 1.0, 1.49, 0.01], [2.0, 0.34, 0.14, CREAM, 1.0, 1.7, 0.01], [0.5, 0.4, 0.16, GOLD, 1.0, 1.7, 0.03], [0.14, 0.14, 0.2, 0xffffff, 1.7, 1.5, 0.04]];
// A pop-up jack: a spring of three grey discs, a cream head with a grin, a red nose and a striped cap (origin = the top of its box).
const jackBoxes = () => [[0.5, 0.12, 0.5, 0x9094a2, 0, 0.1, 0], [0.5, 0.12, 0.5, 0xc8ccd8, 0, 0.3, 0], [0.5, 0.12, 0.5, 0x9094a2, 0, 0.5, 0], [0.7, 0.62, 0.7, 0xfff0d8, 0, 0.98, 0],
  [0.1, 0.1, 0.1, 0x16121a, -0.17, 1.08, 0.36], [0.1, 0.1, 0.1, 0x16121a, 0.17, 1.08, 0.36], [0.16, 0.14, 0.12, 0xff4a6a, 0, 0.94, 0.4], [0.34, 0.06, 0.06, 0x16121a, 0, 0.78, 0.36],
  [0.76, 0.12, 0.76, 0xe8384a, 0, 1.34, 0], [0.46, 0.22, 0.46, 0xffd23a, 0, 1.5, 0], [0.12, 0.12, 0.12, 0xffffff, 0, 1.66, 0]];
const propBoxes = {
  duck: [[0.7, 0.45, 0.8, 0xffd23a, 0, 0.3, 0], [0.5, 0.45, 0.5, 0xffd23a, 0, 0.75, 0.2], [0.3, 0.12, 0.3, 0xff8a1a, 0, 0.7, 0.55], [0.1, 0.1, 0.1, 0x16121a, -0.14, 0.85, 0.42], [0.1, 0.1, 0.1, 0x16121a, 0.14, 0.85, 0.42]],
  bubbles: [[0.5, 0.5, 0.5, 0xbfe8ff, -0.5, 0.5, 0], [0.4, 0.4, 0.4, 0xdff4ff, 0.4, 1.0, 0.1], [0.55, 0.55, 0.55, 0xbfe8ff, 0.1, 1.7, 0], [0.3, 0.3, 0.3, 0xdff4ff, -0.3, 1.3, 0.2], [0.3, 0.3, 0.3, 0xbfe8ff, 0.6, 0.3, 0.3]],
  sock: [[0.2, 0.2, 0.2, 0x9094a2, 0, 0.1, 0], [0.2, 0.2, 0.2, 0xc8ccd8, 0, 0.35, 0], [0.2, 0.2, 0.2, 0x9094a2, 0, 0.6, 0], [0.5, 0.9, 0.5, 0xff6a8a, 0, 1.2, 0], [0.5, 0.2, 0.5, 0xffffff, 0, 1.4, 0], [0.7, 0.28, 0.5, 0xff6a8a, 0.3, 0.9, 0]],
  cloud: [[1.1, 0.5, 0.7, WHITE, 0, 0.6, 0], [0.7, 0.5, 0.6, WHITE, -0.5, 0.9, 0], [0.7, 0.55, 0.6, WHITE, 0.45, 1.0, 0], [0.5, 0.4, 0.5, 0xdff4ff, 0, 1.25, 0]],
};

export class DoorsLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    this.world = game.world;
    this.plan = part.plan;
    this.cells = new LiveCells(game.world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;                                          // tests set it and call step(dt) themselves
    this.clock = 0; this.syncAcc = 1; this.chipAcc = 1;
    this.seed = hashStr(`${game.playerId ?? 'p'}|${game.world.seed ?? 1}`);
    this.meshes = []; this.geos = []; this.mats = [];
    this.said = new Set();                         // hints given this trip
    this.hops = [];                                // trainers jumping out of their doors
    this.doorList = []; this.doorOf = new Map();
    for (const r of this.plan.rooms) this.addDoor({ id: `r${r.k}`, k: r.k, kind: r.kind, cells: r.door.cells, centre: r.door.centre, open: r.door.open });
    this.plan.nested.doors.forEach((d, i) => this.addDoor({ id: `n${i}`, k: this.plan.nested.k, kind: 'nested', cells: d.cells, centre: d.centre, nestedIndex: i }));
    this.chestAt = new Map(this.plan.chests.map(c => [key(...c.cell), c]));
    this.giftAt = new Set(this.plan.gift.surface.map(c => key(...c)));
    this.popAt = new Map(this.plan.popup.boxes.map(b => [key(...b.cell), b]));
    // the Shuffle Stage
    this.sh = { phase: 'idle', round: 0, plan: null, t: 0, picked: null, win: false, resultT: 0, silly: 0, flyT: -1 };
    this.attempts = [0, 0, 0, 0]; this.misses = [0, 0, 0, 0];
    // the Pop-Up Room
    this.pu = { phase: 'idle', plan: null, t: 0, done: new Set(), score: 0, resultT: 0, hit: new Map(), last: -1 };
    this.puAttempt = 0; this.puMisses = 0;
    // the slide
    this.slide = new Mover({ path: PATHS.line({ points: this.plan.slide.path, speed: this.pathLength() / this.plan.slide.time }), canLeave: false, run: 'ride', onEnd: () => this.slideEnd() });
    this.burst = null;
    this.inConfetti = false; this.giftWasDone = false; this.bossBounce = -1;
    this.pitBalls = this.makePitBalls();
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
  onPad(p = this.pos(), pad = STAGE.pad, r = 1.6) { return p.x >= pad.x0 - r && p.x < pad.x1 + 1 + r && p.z >= pad.z0 - r && p.z < pad.z1 + 1 + r && Math.abs(p.y - 11) < 1.5; }
  onPopPad(p = this.pos()) { const c = this.plan.popup.pad.centre; return Math.abs(p.x - c[0]) < 3 && Math.abs(p.z - c[1]) < 2.4 && Math.abs(p.y - 11) < 1.5; }
  inPopRoom(p = this.pos()) { return this.inBoxXZ({ ...this.plan.popup.room, y0: 10, y1: 24 }, p); }
  eye() { return this.game.player.eyePos; }
  look() { const f = this.game.player.forward; return { x: f.x, y: f.y, z: f.z }; }

  /* ---------------------------------- meshes ---------------------------------- */
  buildMeshes() {
    const scene = this.game.scene;
    if (!scene) return;
    const lam = () => { const m = new THREE.MeshLambertMaterial({ vertexColors: true }); this.mats.push(m); return m; };
    const add = (mesh, geo) => { scene.add(mesh); this.meshes.push(mesh); if (geo) this.geos.push(geo); return mesh; };
    // the stage doors: a frame and a swinging panel, 5 instances each
    const fg = merged(frameBoxes()), pg = merged(panelBoxes());
    this.frames = add(new THREE.InstancedMesh(fg, lam(), 5), fg);
    this.panels = add(new THREE.InstancedMesh(pg, lam(), 5), pg);
    for (const m of [this.frames, this.panels]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; }
    this.panels.setColorAt(0, new THREE.Color(1, 1, 1));
    // the bow (stage) and the Big Gift's bow
    const bg = merged(bowBoxes(1)), bigG = merged(bowBoxes(4));
    this.bow = add(new THREE.Mesh(bg, lam()), bg); this.bow.visible = false;
    this.bigBow = add(new THREE.Mesh(bigG, lam()), bigG);
    this.bigBow.position.set(this.plan.gift.bow[0], this.plan.gift.bow[2] + 0.4, this.plan.gift.bow[1]);
    // the look outline of the door you are looking at
    const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.7, 3.5, 0.9));
    const em = new THREE.LineBasicMaterial({ color: 0xffffff }); this.mats.push(em);
    this.outline = add(new THREE.LineSegments(eg, em), eg); this.outline.visible = false;
    // the silly surprise behind a wrong door (one mesh, its geometry swapped)
    this.propGeos = Object.fromEntries(Object.entries(propBoxes).map(([id, b]) => [id, merged(b)]));
    for (const g of Object.values(this.propGeos)) this.geos.push(g);
    this.prop = add(new THREE.Mesh(this.propGeos.duck, lam())); this.prop.visible = false;
    // jacks: 9 instances
    const jg = merged(jackBoxes());
    this.jacks = add(new THREE.InstancedMesh(jg, lam(), 9), jg);
    this.jacks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.jacks.frustumCulled = false; this.jacks.count = 0;
    for (let i = 0; i < 9; i++) this.jacks.setColorAt(i, new THREE.Color(1, 1, 1));
    // confetti: camera-facing quads, one instanced mesh
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
    this.tmp = new THREE.Object3D(); this.tmpQ = new THREE.Quaternion();
  }

  dispose() {
    this.game.ui?.setScore?.(null);
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
    if (this.popAt.has(k)) return this.pu.phase === 'run' ? `Boop the jack! · ${how}` : 'A pop-up box · stand on the pad and press Play!';
    if (this.giftAt.has(k)) return this.bows().done ? 'The Big Gift is open!' : `The Big Gift · ${how} to look`;
    return null;
  }
  action(block) {
    const k = key(block.x, block.y, block.z);
    if (this.doorOf.has(k)) return 'Open!';
    if (this.popAt.has(k)) return 'Boop!';
    if (this.giftAt.has(k)) return 'Look!';
    return null;
  }

  hit(block) {
    const k = key(block.x, block.y, block.z);
    const d = this.doorOf.get(k);
    if (d) { this.openDoor(d); return true; }
    const chest = this.chestAt.get(k);
    if (chest) { this.openChest(chest); return true; }
    if (this.popAt.has(k) && this.pu.phase === 'run') { this.boopRay(this.eye(), this.look(), this.popAt.get(k)); return true; }
    if (this.giftAt.has(k)) {
      const st = this.bows();
      this.toast(st.done ? 'All the ribbons are untied! Open the Big Gift!' : `Jolly Jax: My gift has 4 ribbons. Win the golden bows to untie them! (🎀 ${st.n} / 4)`);
      return true;
    }
    return false;
  }

  // A tap on the screen (touch.js tapAt, before it looks for blocks): a stage door in the pick phase, a popped jack.
  tap(origin, dir) {
    if (this.paused()) return false;
    if (this.sh.phase === 'pick') { const d = pickDoor(this.stageDoors(), origin, dir); if (d != null) { this.choose(d); return true; } }
    if (this.pu.phase === 'run' && this.inPopRoom()) return this.boopRay(origin, dir) !== false;
    return false;
  }

  // The word on the big button (null = nothing here).
  near(p) {
    if (this.paused() || this.slide.rider) return null;
    const pos = p.pos ?? p, sh = this.sh, st = this.bows();
    if (this.slideSpot(p)) return 'Slide!';
    if (this.onPad(pos)) {
      if (sh.phase === 'pick') return 'This one!';
      if (sh.phase === 'again') return 'Again!';
      if (sh.phase === 'idle' && this.nextRound() > 0) return 'Play!';
    }
    if (this.inPopRoom(pos)) {
      if (this.pu.phase === 'run') return 'Boop!';
      if (this.onPopPad(pos) && !st.bows[3]) return this.pu.phase === 'result' ? 'Again!' : 'Play!';
    }
    return null;
  }
  use(p) {
    const w = this.near(p);
    if (!w) return false;
    if (w === 'Slide!') return this.rideSlide();
    if (w === 'Play!' || w === 'Again!') {
      if (this.inPopRoom(p.pos ?? p)) return this.startPopup();
      return this.startShuffle();
    }
    if (w === 'This one!') {
      const d = pickDoor(this.stageDoors(), this.eye(), this.look());
      if (d == null) { this.toast('Look at a door and press!'); return true; }
      return this.choose(d);
    }
    if (w === 'Boop!') { this.boopRay(this.eye(), this.look()); return true; }
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
    else if (ROOM_SAY[d.kind]) this.toast(d.kind === 'healer' ? ROOM_SAY.healer : ROOM_SAY[d.kind]);
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

  /* ---------------------------------- the Shuffle Stage ---------------------------------- */
  nextRound() { const b = this.bows().bows; for (let i = 0; i < 3; i++) if (!b[i]) return i + 1; return 0; }
  // The doors now: a running or finished shuffle, else the next round's doors standing shut in a row.
  stageDoors() {
    const sh = this.sh, o = STAGE.origin;
    if (sh.plan && sh.phase !== 'idle') return doorsAt(sh.plan, sh.phase === 'play' ? sh.t : sh.plan.over + 1, o);
    return restDoors(SHUFFLE.rounds[(this.nextRound() || 3) - 1].n, o, 0);
  }
  // The colour of each door index (the round's look).
  stageColours() {
    const sh = this.sh, round = sh.plan && sh.phase !== 'idle' ? sh.round : this.nextRound() || 3, n = SHUFFLE.rounds[round - 1].n;
    const same = SHUFFLE.rounds[round - 1].look === 'same';
    return lookOf(round, n).map(k => (same ? 0xb05ae8 : SHUFFLE.colours[k % SHUFFLE.colours.length]));
  }
  startShuffle() {
    const sh = this.sh;
    const round = sh.phase === 'again' ? sh.round : this.nextRound();
    if (!round) return false;
    const attempt = this.attempts[round]++;
    const plan = shufflePlan(this.seed, round, attempt, { help: helpLevel(this.misses[round]), hard: this.hard() });
    Object.assign(sh, { phase: 'play', round, plan, t: 0, picked: null, win: false, resultT: 0, flyT: -1 });
    this.bow.visible = true;
    this.once('doors-eyes', 'Keep your eyes on the bow!');
    sound.play('doorwhoosh');
    return true;
  }
  choose(d) {
    const sh = this.sh;
    if (sh.phase !== 'pick' || !sh.plan) return false;
    sh.picked = d; sh.win = d === sh.plan.prize; sh.phase = 'result'; sh.resultT = 0; sh.silly = (sh.round + sh.plan.attempt) % SILLY.length;
    if (sh.win) {
      const keyName = bowKey(sh.round);
      if (!this.game.beaten.includes(keyName)) this.game.beaten.push(keyName);
      this.misses[sh.round] = 0;
      sound.play('rightdoor');
      const st = this.bows();
      this.toast(`You found it! 🎀 ${st.n} / 4`);
      const dd = this.stageDoors()[sh.plan.prize];
      this.doBurst([dd.x, dd.y + 2, dd.z + 1], 0.8);
      sh.flyT = 0;
      this.game.save?.();
      this.syncBlocks();
    } else {
      this.misses[sh.round]++;
      const s = SILLY[sh.silly];
      sound.play(s.sound);
      this.toast(s.say);
    }
    return true;
  }
  stepShuffle(dt) {
    const sh = this.sh;
    if (sh.phase === 'play') {
      sh.t += dt;
      if (sh.t >= sh.plan.stopped) { sh.phase = 'pick'; this.once('doors-pick', 'Which door? Look at it and press!'); }
    } else if (sh.phase === 'result') {
      sh.resultT += dt;
      if (sh.flyT >= 0) sh.flyT += dt;
      if (sh.resultT >= (sh.win ? DOORS.win : DOORS.resultShow)) {
        if (sh.win) { sh.phase = 'idle'; sh.plan = null; this.bow.visible = false; } else sh.phase = 'again';
      }
    }
  }

  /* ---------------------------------- the Pop-Up Room ---------------------------------- */
  startPopup() {
    const pu = this.pu;
    if (this.bows().bows[3]) return false;
    const plan = popPlan(this.seed, this.puAttempt++, { help: Math.min(2, this.puMisses), hard: this.hard() });
    Object.assign(pu, { phase: 'run', plan, t: 0, done: new Set(), score: 0, resultT: 0, hit: new Map(), last: -1 });
    this.once('doors-boop', 'Boop the jacks before they hide!');
    sound.play('doorwhoosh');
    return true;
  }
  // Which popped jack does this look ray pass closest to (within DOORS.boopR)? Boop it. `fallback` = a pop-up box block that was clicked.
  boopRay(origin, dir, fallback = null) {
    const pu = this.pu;
    if (pu.phase !== 'run') return false;
    let best = null, bd = DOORS.boopR + 0.0001;
    for (const a of popAt(pu.plan, pu.t)) {
      const box = this.plan.popup.boxes[pu.plan[a.n].box];
      const cy = box.at[1] + (a.state === 'up' ? 0.9 * a.rise + 0.4 : 0.4);
      const vx = box.at[0] - origin.x, vy = cy - origin.y, vz = box.at[2] - origin.z, t = vx * dir.x + vy * dir.y + vz * dir.z;
      if (t < 0) continue;
      const d = Math.hypot(vx - dir.x * t, vy - dir.y * t, vz - dir.z * t);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best && fallback) { // a click right on a box block counts for that box
      const a = popAt(pu.plan, pu.t).find(q => q.box === fallback.i); if (a) best = a;
    }
    if (!best) return false;
    return this.boop(pu.plan[best.n].box);
  }
  boop(boxIndex) {
    const pu = this.pu, n = boopOk(pu.plan, pu.t, boxIndex, pu.done);
    if (n < 0) {
      const wob = popAt(pu.plan, pu.t).find(a => a.box === boxIndex && a.state === 'wobble');
      if (wob) this.once('doors-cheeky', 'Cheeky box! Nothing in there.');
      return false;
    }
    pu.done.add(n);
    pu.score++;
    pu.hit.set(n, pu.t);
    sound.play('boop');
    return true;
  }
  stepPopup(dt) {
    const pu = this.pu;
    if (pu.phase === 'run') {
      pu.t += dt;
      // the boxes: open while a jack is out (or a cheeky box wobbles)
      this.syncPopBoxes();
      if (pu.t >= popEnd(pu.plan) + 0.2) this.endPopup();
    } else if (pu.phase === 'result') pu.resultT += dt;
  }
  syncPopBoxes() {
    const pu = this.pu, up = new Map();
    if (pu.phase === 'run') for (const a of popAt(pu.plan, pu.t)) up.set(a.box, a.state === 'up' ? true : Math.sin(pu.t * 28) > 0);
    for (const b of this.plan.popup.boxes) this.cells.want(...b.cell, up.get(b.i) ? B.POP_BOX_OPEN : B.POP_BOX);
  }
  endPopup() {
    const pu = this.pu, need = needOf(this.hard());
    const won = pu.score >= need;
    pu.phase = 'result'; pu.resultT = 0; pu.won = won;
    this.syncPopBoxes();
    if (won) {
      this.puMisses = 0;
      if (!this.game.beaten.includes(bowKey(4))) this.game.beaten.push(bowKey(4));
      sound.play('rightdoor');
      this.toast(`You booped ${pu.score}! 🎀 ${this.bows().n} / 4`);
      const c = this.plan.popup.pad.centre;
      this.doBurst([c[0], 14, c[1]], 1);
      this.game.save?.();
      this.syncBlocks();
    } else {
      this.puMisses++;
      sound.play('sillyhonk');
      this.toast(`You booped ${pu.score}! Again? They will be a bit slower.`);
    }
  }
  popLeft() { const pu = this.pu; return pu.plan ? pu.plan.filter((p, n) => !p.wobble && !pu.done.has(n) && p.t0 + p.up + POPUP.grace >= pu.t).length : 0; }

  /* ---------------------------------- confetti, the pit, the Boss ---------------------------------- */
  doBurst(at, scale = 1) { this.burst = { x: at[0], y: at[1], z: at[2], age: 0, scale }; }
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
    this.stepShuffle(dt); this.stepPopup(dt); this.slide.update(dt); this.stepRooms(dt); this.stepHops(dt);
    this.cells.flush();
    if ((this.chipAcc += dt) >= 0.2) { this.chipAcc = 0; this.chip(); }
  }
  chip() {
    const ui = this.game.ui;
    if (!ui?.setScore) return;
    const st = this.bows(), pos = this.pos();
    let s = null;
    if (this.inPopRoom(pos) && this.pu.phase === 'run') s = { text: `🤡 ${this.pu.score} / ${needOf(this.hard())} · ${this.popLeft()} left`, done: false };
    else if (st.done) s = { text: 'Open the Big Gift!', done: true };
    else if (this.roomAt(pos) || this.onHall(pos)) s = { text: `🎀 ${st.n} / 4`, done: false };
    ui.setScore(s);
  }
  onHall(p) { return p.x >= 40 && p.x < 73 && p.z >= 40 && p.z < 73; }

  /* ---------------------------------- drawing ---------------------------------- */
  draw() {
    if (!this.frames) return;
    const p = this.pos(), near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
    // stage doors
    const so = STAGE.origin;
    const stageNear = near(so.x, so.z, DOORS.stageRange);
    this.frames.visible = this.panels.visible = stageNear;
    if (stageNear) this.drawStage();
    else this.bow.visible = false;
    // jacks
    const pn = near(this.plan.popup.pad.centre[0], this.plan.popup.pad.centre[1], DOORS.popRange);
    this.jacks.visible = pn;
    if (pn) this.drawJacks();
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

  drawStage() {
    const sh = this.sh, doors = this.stageDoors(), o = this.tmp, plan = sh.plan;
    const colours = this.stageColours(), col = new THREE.Color();
    this.frames.count = this.panels.count = doors.length;
    doors.forEach((d, i) => {
      let open = d.open;
      if (sh.phase === 'result' || sh.phase === 'again') {
        const k = ease(Math.min(1, sh.resultT / 0.35));
        if (d.door === sh.plan.prize || d.door === sh.picked) open = k;
      }
      const wig = d.wiggle ? Math.sin(this.clock * 34) * 0.08 * d.wiggle : 0, tw = plan?.twinkle && d.door === plan?.prize && d.moving ? 1 + 0.06 * Math.sin(this.clock * 14) : 1;
      o.position.set(d.x, d.y, d.z); o.rotation.set(0, wig, 0); o.scale.setScalar(tw); o.updateMatrix();
      this.frames.setMatrixAt(i, o.matrix);
      // the panel hinges on its left edge (local x -1) and swings out towards the player
      const hx = -1.0 * Math.cos(wig), hz = 1.0 * Math.sin(wig);
      o.position.set(d.x + hx * tw, d.y, d.z + 0.2 + hz * tw); o.rotation.set(0, wig - open * 1.75, 0); o.updateMatrix();
      this.panels.setMatrixAt(i, o.matrix);
      this.panels.setColorAt(i, col.setHex(colours[d.door]));
    });
    this.frames.instanceMatrix.needsUpdate = this.panels.instanceMatrix.needsUpdate = true;
    if (this.panels.instanceColor) this.panels.instanceColor.needsUpdate = true;
    // the bow: bobbing behind the prize door while the doors are open, flying to you when you found it
    if (plan && sh.phase !== 'idle') {
      const d = doors[plan.prize];
      const showing = sh.phase === 'play' && sh.t < plan.closedAt, revealed = sh.phase === 'again' || (sh.phase === 'result' && !sh.win);
      if (sh.phase === 'result' && sh.win && sh.flyT >= 0) {
        const k = ease(Math.min(1, sh.flyT / 1.0)), eye = this.eye();
        this.bow.visible = sh.flyT < 1.0;
        this.bow.position.set(d.x + (eye.x - d.x) * k, d.y + 1.4 + (eye.y - d.y - 1.4) * k + Math.sin(Math.PI * k) * 1.2, d.z + 0.3 + (eye.z - d.z - 0.3) * k);
        this.bow.scale.setScalar(1 + 0.5 * k);
      } else if (showing || revealed) {
        this.bow.visible = true;
        this.bow.position.set(d.x, d.y + 1.3 + Math.sin(this.clock * 4) * 0.12, d.z - 0.05);
        this.bow.scale.setScalar(1);
        this.bow.rotation.y = Math.sin(this.clock * 2) * 0.2;
      } else this.bow.visible = false;
      // a silly surprise behind a wrong door
      const wrong = sh.phase !== 'play' && !sh.win && sh.picked != null && (sh.phase === 'result' || sh.phase === 'again');
      this.prop.visible = wrong;
      if (wrong) {
        const dd = doors[sh.picked];
        this.prop.geometry = this.propGeos[SILLY[sh.silly].id];
        const k = ease(Math.min(1, sh.resultT / 0.35));
        this.prop.position.set(dd.x, dd.y + 0.1 + Math.abs(Math.sin(this.clock * 7)) * 0.2 * k, dd.z + 0.05);
        this.prop.scale.setScalar(Math.max(0.01, k));
      }
    } else { this.bow.visible = false; this.prop.visible = false; }
    // the door you look at in the pick phase
    const look2 = sh.phase === 'pick' && this.onPad(this.pos());
    if (look2) {
      const d = pickDoor(doors, this.eye(), this.look());
      this.outline.visible = d != null;
      if (d != null) this.outline.position.set(doors[d].x, doors[d].y + 1.6, doors[d].z + 0.1);
    } else this.outline.visible = false;
  }

  drawJacks() {
    const pu = this.pu, o = this.tmp, boxes = this.plan.popup.boxes;
    const active = pu.phase === 'run' ? popAt(pu.plan, pu.t) : [];
    let n = 0;
    for (const a of active) {
      const b = boxes[pu.plan[a.n].box];
      if (a.state === 'wobble') continue;
      const hitAt = pu.hit.get(a.n), hitK = hitAt != null ? Math.min(1, (pu.t - hitAt) / 0.35) : 1;
      const bob = hitAt != null ? 1 + 0.25 * Math.sin(hitK * Math.PI) : 1 + 0.04 * Math.sin(pu.t * 14);
      o.position.set(b.at[0], b.at[1], b.at[2]); o.rotation.set(0, Math.sin(pu.t * 3 + a.n) * 0.3, 0);
      o.scale.set(1, Math.max(0.01, a.rise * bob), 1); o.updateMatrix();
      this.jacks.setMatrixAt(n, o.matrix);
      this.jacks.setColorAt(n, hitAt != null && hitK < 1 ? HOT : PLAIN);
      n++;
    }
    this.jacks.count = n;
    this.jacks.instanceMatrix.needsUpdate = true;
    if (this.jacks.instanceColor) this.jacks.instanceColor.needsUpdate = true;
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
  // A won Boss battle uses the four bows up (a rematch is a new shuffle and a new pop-up round, a bit harder).
  battleEnded(result, opts) {
    if (result !== 'won' || opts?.picture?.id !== 'doors' || opts.picture.crew != null) return;
    const g = this.game;
    for (let i = 1; i <= 4; i++) { const k = g.beaten.indexOf(bowKey(i)); if (k >= 0) g.beaten.splice(k, 1); }
    this.attempts = [0, 0, 0, 0]; this.misses = [0, 0, 0, 0]; this.puMisses = 0;
    this.syncBlocks();
  }

  info() {
    const sh = this.sh, pu = this.pu;
    return { clock: this.clock, bows: this.bows(), shuffle: { phase: sh.phase, round: sh.round, attempt: sh.plan?.attempt, t: sh.t, prize: sh.plan?.prize, picked: sh.picked, win: sh.win, misses: [...this.misses] },
      popup: { phase: pu.phase, t: pu.t, score: pu.score, left: pu.plan ? this.popLeft() : null, won: pu.won, misses: this.puMisses }, opened: this.doorList.filter(d => d.opened).map(d => d.id), sliding: !!this.slide.rider,
      stageDoors: this.stageDoors().map(d => ({ door: d.door, slot: d.slot, x: +d.x.toFixed(2), z: +d.z.toFixed(2), open: +d.open.toFixed(2) })) };
  }
}
