// T45: the live part of the Sketchbook (LIVE.doodle): Draw! (owner 2026-10-27, plans/T45.md "Challenge rework"). Stand on a star pad,
// press Draw!, and the giant pencil draws your bridge the way you face (owner 2026-10-29) while you walk on it: limited ink (star dots fill it and keep the
// line safe up to them), ink blots, doodle bees, wind and, on the Eraser Hill, Rubber the Eraser coming along the line behind you.
// tracing.js has the rules (pure). Everything is per player and in memory except the finished lines, which are saved `beaten` keys
// (pw:doodle:line1..8; a later visit draws them as the neat bridges of doodleland.js). The ink is never an edit: it is drawn with
// world.setLive through LiveCells (never inside the player). Never a fail: a fall, a catch or an empty pencil puffs you back to the
// last star dot (or the pad) and the line stays up to there.
import * as THREE from 'three';
import { B, isSolid } from './blocks.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';
import { DRAW, newDraw, drawStep, cellInk, pointAt, beeAt } from './tracing.js';
import { lineKey, lineState, LINE_COUNT, courseOf, COURSES } from './doodleland.js';

export const DOODLE = { fall: 0.5, scratch: 0.35, nag: 3, waitHint: 2.5, inkBar: 8 };
const WORDS = {
  hint: 'The pencil draws the way you face! Turn to steer it.',
  first: 'Draw the line before this one first!',
  intro: {
    2: 'Ink blot ahead! Steer round it.',
    3: 'Not much ink! Draw through the star ⭐',
    4: 'A doodle bee! Stop, wait, then go.',
    5: 'Draw round and round the tower to climb up!',
    6: 'Uh oh, Rubber the Eraser! Keep walking! The wind pushes: turn into it.',
    7: 'Two bees and Rubber! Watch the bees.',
    8: 'Last line! Wind, a bee and Rubber.',
  },
  blocked: {
    blot: 'Ink blot! Turn to go round it.',
    page: 'Not that page! Turn to face the next one.',
    land: 'Land on the dotted strip of the page!',
    edge: 'Too far out! Turn round: the pencil turns with you.',
    low: 'Too low! Go round to climb.',
    solid: 'Something is in the way! Turn to go round it.',
  },
  back: {
    caught: 'Hee hee! Rubber rubbed it out.',
    fell: 'Whoops!',
    overrun: 'Stay behind your pencil!',
    dry: 'Out of ink!',
  },
  star: '⭐ Star! Full of ink.',
  nibble: 'Bzz! A bee nibbled your line!',
  rubberGo: 'Here comes Rubber the Eraser! Keep walking!',
  low: 'Ink is low! Find a star ⭐',
  wait: 'The pencil waits for you. Walk on your line!',
  stop: 'The pencil rests. Press Draw! to try again.',
  fell: 'Whoops! Back up onto your page.',
};

const PENCIL = 0xffd23a;
export function buildPencil() { // nib at the origin pointing down, 3.2 long, yellow (it keeps its colour: the one big colour in the drawing)
  const g = new THREE.Group();
  const yellow = new THREE.MeshLambertMaterial({ color: PENCIL, emissive: 0x403000 });
  const wood = new THREE.MeshLambertMaterial({ color: 0xe6c08a });
  const lead = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
  const pink = new THREE.MeshLambertMaterial({ color: 0xf0a8b8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.4, 6), yellow); body.position.y = 1.9;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 6), wood); cone.rotation.x = Math.PI; cone.position.y = 0.35;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), lead); tip.rotation.x = Math.PI; tip.position.y = 0.11;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.32, 6), pink); cap.position.y = 3.26;
  g.add(body, cone, tip, cap);
  for (const m of g.children) m.userData.keepColour = true;
  g.userData.dispose = () => { for (const m of g.children) { m.geometry.dispose(); m.material.dispose(); } };
  return g;
}
export function buildRubber() { // Rubber the Eraser: a pink eraser block with a paper sleeve and two drawn eyes; in colour (keepColour) and big, so he reads from far away
  const g = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), new THREE.MeshLambertMaterial({ color: 0xf27fa0, emissive: 0x401020 }));
  block.position.y = 0.5;
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.06, 1.06), new THREE.MeshLambertMaterial({ color: 0xf4efe0 }));
  sleeve.position.set(-0.2, 0.5, 0);
  g.add(block, sleeve);
  for (const s of [-1, 1]) { // eyes
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.04), new THREE.MeshLambertMaterial({ color: 0x24222c }));
    e.position.set(0.42, 0.68, s * 0.22);
    e.rotation.y = Math.PI / 2;
    g.add(e);
  }
  g.traverse(o => { if (o.isMesh) o.userData.keepColour = true; });
  g.scale.setScalar(1.7);
  g.userData.dispose = () => g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return g;
}
function starGeometry() { // a flat five-point star, standing up (it spins round y)
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.26 : 0.6; (i ? s.lineTo : s.moveTo).call(s, Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.ShapeGeometry(s);
}
// owner 2026-10-28: line 3 has 4 blots and only 3 were drawn, so the last one (by the landing strip) stopped the pencil unseen
const MAX_OF = k => Math.max(1, ...COURSES.map(c => (c[k] || []).length));
const MAX_STARS = MAX_OF('stars'), MAX_BLOTS = MAX_OF('blots'), MAX_BEES = MAX_OF('bees');

export class DoodleLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    const world = game.world;
    this.world = world;
    this.lines = world.doodle.lines;
    this.pads = world.doodle.pads;
    this.cells = new LiveCells(world, () => game.player);
    this.solid = (x, y, z) => { const id = world.get(x, y, z); return id !== B.DO_INK && isSolid(id); };
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;            // tests set it and call step(dt, aim) themselves
    this.cur = null;                // { k, course, st, applied: Map, said: Set }
    this.drawnNow = new Set();      // line indices drawn (this trip: includes those a rematch cleared from the keys)
    this.keepInk = new Set();       // cells of lines drawn this trip (a new try never rubs them out)
    this.neatGiven = new Set();
    this.fellFor = 0; this.clock = 0;
    this.told = new Set();
    this.makeMeshes();
    const st = lineState(game); // saved lines are drawn at once (the neat bridges)
    this.lines.forEach((l, i) => { if (st.drawn[i]) this.inkAll(i); });
    this.syncDashes();
  }

  courseOf(k) { return courseOf(k + 1, this.solid); }

  /* ---- meshes ---- */
  makeMeshes() {
    const scene = this.game.scene, g = new THREE.Group();
    this.group = g;
    this.pencil = buildPencil();
    this.pencil.visible = false;
    // where the pencil heads: a flat ring on the line's floor, on the way you face (tracing.js FaceSteer)
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 20), new THREE.MeshBasicMaterial({ color: PENCIL, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.rubber = buildRubber();
    this.rubber.visible = false;
    const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = n; return m; };
    this.stars = inst(starGeometry(), new THREE.MeshBasicMaterial({ color: PENCIL, side: THREE.DoubleSide }), MAX_STARS);
    this.stars.userData.keepColour = true;
    this.blots = inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x24222c }), MAX_BLOTS);
    this.bees = inst(new THREE.BoxGeometry(0.7, 0.45, 0.45), new THREE.MeshBasicMaterial({ color: 0xffc83a }), MAX_BEES);
    this.wings = inst(new THREE.BoxGeometry(0.2, 0.05, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }), MAX_BEES);
    for (const m of [this.stars, this.blots, this.bees, this.wings]) this.hideAll(m);
    // the dotted guide: the neat bridge of every line not drawn yet (one instanced mesh of flat dashes)
    let n = 0;
    for (const l of this.lines) n += Math.ceil(l.line.len / 1.1) + 1 + 60;
    this.dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.05, 0.1), new THREE.MeshBasicMaterial({ color: 0x3e3c46, transparent: true, opacity: 0.85 }), n);
    this.dashes.frustumCulled = false;
    this.dashLines = [];
    let at = 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    this.lines.forEach((l, li) => {
      const list = [], course = this.courseOf(li), blots = course.blots;
      // the landing strip on the next page: a dotted outline (owner 2026-10-27: a line lands only there)
      { const [x0, x1, z0, z1] = course.target, y = course.rowB + 1.06, edge = [];
        for (let x = x0; x <= x1 + 1; x += 1) { edge.push([x, z0, 0]); edge.push([x, z1 + 1, 0]); }
        for (let z = z0 + 0.5; z <= z1 + 0.5; z += 1) { edge.push([x0, z, 1]); edge.push([x1 + 1, z, 1]); }
        for (const [x, z, rot] of edge) {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot ? Math.PI / 2 : 0); pos.set(x, y, z);
          this.dashes.setMatrixAt(at, m.compose(pos, q, sc)); list.push({ s: -1, idx: at, pos: pos.clone(), q: q.clone() }); at++;
        } }
      for (let s = 0; li < 2 && s <= l.line.len; s += 1.1) { // the dotted way only on the first two lines (learning); later you find your own
        const p = l.line.at(s), [dx, dz] = l.line.dirAt(s);
        if (blots.some(b => Math.hypot(p[0] - b.x, p[2] - b.z) < b.r + 0.6)) continue; // the dots stop at a blot: go round it
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-dz, dx));
        pos.set(p[0], p[1] + 1.04, p[2]);
        this.dashes.setMatrixAt(at, m.compose(pos, q, sc));
        list.push({ s, idx: at, pos: pos.clone(), q: q.clone() });
        at++;
      }
      this.dashLines.push(list);
    });
    this.dashes.count = at;
    g.add(this.pencil, this.ring, this.rubber, this.dashes, this.stars, this.blots, this.bees, this.wings);
    scene?.add(g);
  }
  hideAll(m) { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < m.count; i++) m.setMatrixAt(i, z); m.instanceMatrix.needsUpdate = true; }
  // The dashes of the lines that are not drawn and not being drawn.
  syncDashes() {
    const m = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0), sc = new THREE.Vector3(1, 1, 1);
    this.dashLines.forEach((list, li) => {
      const drawn = this.drawnNow.has(li), drawing = this.cur?.k === li; // while you draw, the landing outline (s -1) stays
      for (const d of list) this.dashes.setMatrixAt(d.idx, drawn || (drawing && d.s >= 0) ? zero : m.compose(d.pos, d.q, sc));
    });
    this.dashes.instanceMatrix.needsUpdate = true;
    this.dashesKey = this.key();
  }
  key() { return `${[...this.drawnNow].join()}|${this.cur ? this.cur.k : ''}`; }

  /* ---- ink ---- */
  inkableOf(i) { // the cells of a line's neat bridge that are air in the world (the page cells under it are solid already)
    const l = this.lines[i];
    return l.inkable ??= l.line.cells.filter(c => this.world.get(c.x, c.y, c.z) === B.AIR || this.world.get(c.x, c.y, c.z) === B.DO_INK);
  }
  inkAll(i) { for (const c of this.inkableOf(i)) { this.cells.want(c.x, c.y, c.z, B.DO_INK); this.keepInk.add(`${c.x},${c.y},${c.z}`); } this.drawnNow.add(i); }
  // The drawn line as blocks: ink where the line is (and Rubber has not rubbed it), air where a cell went (a nibble, a setback).
  applyInk() {
    const c = this.cur, st = c.st, seen = new Set();
    for (const [key, cell] of st.cells) {
      seen.add(key);
      const id = cellInk(st, cell) || this.keepInk.has(key) ? B.DO_INK : B.AIR;
      if (c.applied.get(key) !== id) { c.applied.set(key, id); this.cells.want(cell.x, cell.y, cell.z, id); }
    }
    for (const [key, id] of c.applied) {
      if (seen.has(key)) continue;
      c.applied.delete(key);
      if (id === B.DO_INK && !this.keepInk.has(key)) { const [x, y, z] = key.split(',').map(Number); this.cells.want(x, y, z, B.AIR); }
    }
  }
  rubAll() { // a try ends without a bridge: its ink goes
    const c = this.cur;
    for (const [key, id] of c.applied) if (id === B.DO_INK && !this.keepInk.has(key)) { const [x, y, z] = key.split(',').map(Number); this.cells.want(x, y, z, B.AIR); }
    c.applied.clear();
  }

  // Marks lines 1..n as drawn (saved keys, the neat bridges at once). For tests.
  drawUpTo(n) {
    const g = this.game;
    for (let i = 0; i < n; i++) { const key = lineKey(i + 1); if (!g.beaten.includes(key)) g.beaten.push(key); this.inkAll(i); }
    this.syncDashes(); this.refreshChip();
  }

  /* ---- helpers ---- */
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  toast(m) { this.game.ui?.toast(m); }
  once(key, m) { if (this.told.has(key)) return; this.told.add(key); this.toast(m); }
  state() { return lineState(this.game); }
  padAt(pos) { // the pad (index) the player stands on, or -1
    for (let i = 0; i < this.pads.length; i++) {
      const p = this.pads[i];
      if (p.cells.some(([x, y, z]) => Math.abs(pos.x - (x + 0.5)) <= 0.95 && Math.abs(pos.z - (z + 0.5)) <= 0.95 && Math.abs(pos.y - (y + 1)) < 1.3)) return i;
    }
    return -1;
  }
  shownLine() { if (this.cur) return this.cur.k; const st = this.state(); return st.done ? -1 : st.next; }

  /* ---- hooks of the live-part interface ---- */
  near(p) {
    if (this.cur) return 'Stop';
    const i = this.padAt(p.pos), st = this.state();
    if (i < 0 || st.drawn[i]) return null;
    return 'Draw!';
  }
  use(p) {
    if (this.cur) { this.stop(); this.toast(WORDS.stop); return true; }
    const i = this.padAt(p.pos), st = this.state();
    if (i < 0 || st.drawn[i]) return false;
    if (i > st.next) { this.toast(WORDS.first); return true; }
    this.start(i);
    return true;
  }
  aimTip() { // the guide while you draw: the next star, else the next page
    const c = this.cur;
    if (!c) return null;
    const star = c.course.stars.find((s, i) => !c.st.taken.has(i));
    if (star) return { x: star.x, z: star.z, text: () => 'Draw through the star ⭐ for more ink!' };
    const t = c.course.target;
    return { x: (t[0] + t[1] + 1) / 2, z: (t[2] + t[3] + 1) / 2, text: () => '✏️ Draw your line to the next page!' };
  }
  battleEnded(result, opts) {
    const pic = opts?.picture;
    if (pic?.id !== 'doodle' || pic.crew != null || result !== 'won') return;
    const g = this.game; // a won battle with Arlo clears lines 6-8 (a rematch is a new race); the drawn lines stay for this trip
    for (let n = 6; n <= LINE_COUNT; n++) { const at = g.beaten.indexOf(lineKey(n)); if (at >= 0) g.beaten.splice(at, 1); }
    g.save?.();
    this.refreshChip();
  }

  /* ---- drawing ---- */
  start(i) {
    this.stop(true);
    const course = this.courseOf(i), wins = this.game.bossWins?.doodle || 0;
    const st = newDraw(course, wins);
    st.clock = this.clock; // the bees keep flying where they were
    this.lastPos = null; this.lastGround = null; this.guarded = 0;
    this.cur = { k: i, course, st, t0: st.clock, applied: new Map(), said: new Map(), scratchAt: 0, waitFor: 0, low: false };
    this.applyInk();
    this.once('hint', WORDS.hint);
    if (WORDS.intro[i + 1]) this.once(`intro${i}`, WORDS.intro[i + 1]);
    this.syncDashes();
  }
  stop(quiet = false) {
    if (!this.cur) return;
    this.rubAll();
    const k = this.cur.k, p = this.game.player;
    this.cur = null;
    this.pencil.visible = false; this.ring.visible = false; this.rubber.visible = false;
    if (!quiet) {
      this.syncDashes();
      if (p && this.world.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z)) === B.AIR) this.puffTo(this.pads[k].stand, null); // you stood on the line: back to the pad
    }
  }
  finish() {
    const g = this.game, { k, st } = this.cur, n = k + 1;
    this.applyInk();
    for (const [key, id] of this.cur.applied) if (id === B.DO_INK) this.keepInk.add(key);
    this.drawnNow.add(k);
    const key = lineKey(n);
    if (!g.beaten.includes(key)) g.beaten.push(key);
    g.save?.();
    sound.play('goalcheer');
    this.toast(`You drew a bridge! ✏️ ${this.state().count} / ${LINE_COUNT}`);
    if (st.setbacks === 0 && !this.neatGiven.has(k)) { this.neatGiven.add(k); g.cubes += 1; this.toast('Neat line! +1 Capture Cube'); }
    this.lastDone = { n, setbacks: st.setbacks, nibbles: st.nibbles, time: st.clock - this.cur.t0, len: st.s };
    this.cur = null;
    this.pencil.visible = false; this.ring.visible = false; this.rubber.visible = false;
    this.syncDashes();
    this.refreshChip();
    if (this.state().done) this.toast('All the lines are drawn! Go to the Desk and meet Artist Arlo.');
  }
  aimNow() { // where you look and where you stand (tests drive step() with their own)
    const p = this.game.player, e = p.eyePos, f = p.forward;
    return { eye: [e.x, e.y, e.z], dir: [f.x, f.y, f.z], player: [p.pos.x, p.pos.y, p.pos.z] };
  }
  puffTo(stand, heading) {
    const p = this.game.player;
    this.game.creatures?.puff?.({ x: p.pos.x, y: p.pos.y, z: p.pos.z }, { color: 0xf4efe0 });
    p.pos.set(stand[0], stand[1], stand[2]); p.vel.set(0, 0, 0); this.lastPos = null; this.lastGround = null;
    if (heading != null) p.yaw = Math.atan2(-Math.cos(heading), -Math.sin(heading)); // face along the line
    this.game.creatures?.puff?.({ x: stand[0], y: stand[1], z: stand[2] }, { color: 0xf4efe0, sound: null });
  }
  say(key, m, every = DOODLE.nag) { // a toast at most every few seconds per kind (of the drawing clock)
    const c = this.cur, t = c.st.clock;
    if (t - (c.said.get(key) ?? -1e9) < every) return;
    c.said.set(key, t); this.toast(m);
  }

  /* ---- the frame ---- */
  update(dt = 0) { if (!this.manual) this.step(dt); }
  step(dt, aim) {
    const g = this.game, p = g.player;
    if (!p || !g.world || g.world !== this.world) return;
    this.cells.flush();
    const paused = this.paused();
    if (!paused) {
      this.clock += Math.min(dt, DRAW.dtMax);
      if (this.cur) this.stepDraw(dt, aim ?? this.aimNow());
      else this.stepFall(dt, p);
    }
    this.stepMeshes(p);
    if (this.key() !== this.dashesKey) this.syncDashes();
    this.refreshChip();
  }
  // Not drawing: falling onto the blank page puffs you back up (summed dt: a pause or a slow device counts the same).
  stepFall(dt, p) {
    const under = this.world.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z));
    if (p.onGround && under === B.DO_PAPER) this.fellFor += dt; else this.fellFor = 0;
    if (this.fellFor < DOODLE.fall) return;
    this.fellFor = 0;
    const st = this.state(), i = Math.min(st.next, this.pads.length - 1);
    this.puffTo(st.done ? this.world.bosses[0].rest : this.pads[i].stand, null);
    this.toast(WORDS.fell);
  }
  // While you draw, your line is sticky: walking off its side (or its end) stops you at the edge, sliding along it where it can
  // (owner 2026-10-27 second pass: the skill is steering while you walk, not balancing). Falls still come from Rubber and the bees.
  guard(p) {
    const last = this.lastPos, sup = (x, y, z) => isSolid(this.world.get(Math.floor(x), Math.floor(y - 0.05), Math.floor(z)));
    if (last && !p.onGround && p.vel.y <= 0.01 && Math.abs(p.pos.y - last.y) < 0.3 && Math.hypot(p.pos.x - last.x, p.pos.z - last.z) < 1 && !sup(p.pos.x, p.pos.y, p.pos.z) && sup(last.x, last.y, last.z)) {
      const y = last.y, along = this.alongLine(last, p.pos.x - last.x, p.pos.z - last.z);
      const slid = along?.find(q => sup(q[0], y, q[1]));
      if (slid) p.pos.set(slid[0], y, slid[1]); // owner 2026-10-29: you face where you want the line, not always along it: your step slides along your line
      else if (sup(p.pos.x, y, last.z)) p.pos.set(p.pos.x, y, last.z);
      else if (sup(last.x, y, p.pos.z)) p.pos.set(last.x, y, p.pos.z);
      else p.pos.set(last.x, y, last.z);
      p.vel.y = 0; p.onGround = true; this.guarded = (this.guarded || 0) + 1;
    }
    // a hop up a step that came down beside the line: back where you last stood (if it is still there: Rubber may have rubbed it)
    const lg = this.lastGround;
    if (lg && !p.onGround && p.pos.y < lg.y - 0.3 && Math.hypot(p.pos.x - lg.x, p.pos.z - lg.z) < 2.5 && !sup(p.pos.x, p.pos.y, p.pos.z) && !sup(p.pos.x, p.pos.y - 1, p.pos.z) && !sup(p.pos.x, p.pos.y - 2, p.pos.z) && sup(lg.x, lg.y, lg.z)) { // (a step down is fine)
      const slid = this.alongLine(lg, p.pos.x - lg.x, p.pos.z - lg.z)?.find(q => sup(q[0], lg.y, q[1])); // (owner 2026-10-29) slid along your line if it can
      p.pos.set(slid ? slid[0] : lg.x, lg.y, slid ? slid[1] : lg.z); p.vel.set(0, 0, 0); p.onGround = true; this.guarded = (this.guarded || 0) + 1;
    }
    if (p.onGround && sup(p.pos.x, p.pos.y, p.pos.z)) this.lastGround = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    this.lastPos = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
  }
  // Your step (dx, dz) from `from` slid along your line there (its heading at the nearest drawn point): places to try, or null.
  alongLine(from, dx, dz) {
    let best = null, bd = 3;
    for (const q of this.cur?.st.pts ?? []) { const d = Math.hypot(q.x - from.x, q.z - from.z); if (d < bd) { bd = d; best = q; } }
    if (!best) return null;
    const ux = Math.cos(best.h), uz = Math.sin(best.h), k = dx * ux + dz * uz;
    if (Math.abs(k) < 1e-4) return null;
    const e = (from.x - best.x) * -uz + (from.z - best.z) * ux; // how far you are off its middle (at its edge: a little toward the middle)
    return [0, 0.25, 0.5, 0.8].map(m => Math.sign(e) * Math.min(Math.abs(e), m)).map(pull => [from.x + ux * k + uz * pull, from.z + uz * k - ux * pull]);
  }
  stepDraw(dt, inp) {
    const c = this.cur, st = c.st, before = st.s;
    if (!this.manual || this.guardInTests) this.guard(this.game.player); // (tests that move the player by hand switch it off)
    drawStep(st, dt, inp);
    for (const e of st.events) {
      if (e.kind === 'star') { sound.play('star'); this.toast(WORDS.star); c.low = false; }
      else if (e.kind === 'nibble') { sound.play('doodlerub'); this.say('nibble', WORDS.nibble, 1); }
      else if (e.kind === 'rubber') { sound.play('doodlerub'); this.toast(WORDS.rubberGo); }
      else if (e.kind === 'back') {
        const atPad = st.ckpt.s === 0;
        if (e.reason === 'caught') sound.play('doodlerub'); // (the puff has its own sound)
        this.toast(`${WORDS.back[e.reason]} Back to the ${atPad ? 'pad' : 'star'}.`);
        this.applyInk();
        this.puffTo(e.stand, st.tip.h);
        c.low = false;
      }
    }
    if (st.done) return this.finish();
    this.stepUp(this.game.player);
    if (st.blocked) this.say(`b:${st.blocked}`, c.course.tower && st.blocked === 'low' ? WORDS.intro[5] : WORDS.blocked[st.blocked]);
    if (!c.low && st.ink <= DRAW.lowInk && c.course.stars.some((s, i) => !st.taken.has(i))) { c.low = true; this.toast(WORDS.low); }
    c.waitFor = st.waiting ? c.waitFor + dt : 0;
    if (c.waitFor > DOODLE.waitHint) this.say('wait', WORDS.wait, 8);
    if (st.s > before) { c.scratchAt += dt; if (c.scratchAt >= DOODLE.scratch) { c.scratchAt = 0; sound.play('doodlescratch'); } }
    this.applyInk();
  }
  // Walking into a step of your own line lifts you onto it (a small hop): the line climbs one block at a time and a child on a
  // tablet should not need the Jump button for every step.
  stepUp(p) {
    if (!p?.onGround || !p.hitWall || !this.cur) return;
    // (owner 2026-10-29: you face where you want the line to go, not always along it, so the step may be a little to one side)
    const f = p.forward, y = Math.floor(p.pos.y + 0.05), a0 = Math.atan2(f.z, f.x);
    const step = [0, 0.5, -0.5, 0.9, -0.9].some(da => {
      const x = Math.floor(p.pos.x + Math.cos(a0 + da) * 0.6), z = Math.floor(p.pos.z + Math.sin(a0 + da) * 0.6);
      return this.cur.applied.get(`${x},${y},${z}`) === B.DO_INK && !isSolid(this.world.get(x, y + 1, z)) && !isSolid(this.world.get(x, y + 2, z));
    });
    if (step) p.vel.y = Math.max(p.vel.y, 8.6); // a normal jump (one block up)
  }
  stepMeshes(p) {
    const c = this.cur, st = this.state();
    // the pencil: at the tip while drawing (leaning a little away from you); else resting at the start of the next line
    let at = null;
    if (c) at = [c.st.tip.x, c.st.tip.row, c.st.tip.z];
    else if (!st.done) { const l = this.lines[st.next], s0 = l.line.at(0); if (Math.hypot(s0[0] - p.pos.x, s0[2] - p.pos.z) < 70) at = s0; }
    if (at) {
      this.pencil.visible = true;
      this.pencil.position.set(at[0], at[1] + 1, at[2]);
      const dx = at[0] - p.pos.x, dz = at[2] - p.pos.z, m = Math.hypot(dx, dz) || 1;
      this.pencil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / m * 0.4, 1, dz / m * 0.4).normalize());
      this.pencil.scale.setScalar(c ? 1 : 0.9);
    } else this.pencil.visible = false;
    // where the pencil heads (on the way you face)
    if (c && c.st.aim) {
      const a = c.st.aim;
      this.ring.visible = true;
      this.ring.position.set(a[0], c.st.tip.row + 1.03, a[1]);
    } else this.ring.visible = false;
    // Rubber: on the Eraser Hill while you draw, waiting at the last star (or the pad), then on his way along your line
    if (c && c.st.rubber) {
      const r = c.st.rubber, q = pointAt(c.st, r.on ? r.s : c.st.ckpt.s);
      this.rubber.visible = true;
      this.rubber.position.set(q[0], q[1] + 1, q[2]);
      this.rubber.rotation.y = -q[3];
    } else this.rubber.visible = false;
    // the stars, blots and bees of the line you draw (or the next one)
    const k = this.shownLine(), course = k >= 0 ? this.courseOf(k) : null, clock = c ? c.st.clock : this.clock;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const put = (mesh, i, show, x, y, z, s, yaw = 0) => { Q.setFromAxisAngle(Y, yaw); P.set(x, y, z); S.set(show ? s[0] : 0, show ? s[1] : 0, show ? s[2] : 0); mesh.setMatrixAt(i, M.compose(P, Q, S)); };
    for (let i = 0; i < MAX_STARS; i++) { const sd = course?.stars[i]; put(this.stars, i, !!sd && !(c && c.st.taken.has(i)), sd?.x ?? 0, (sd?.y ?? 0) + 0.6 + 0.15 * Math.sin(clock * 3 + i), sd?.z ?? 0, [1, 1, 1], clock * 2 + i); }
    for (let i = 0; i < MAX_BLOTS; i++) { const b = course?.blots[i]; put(this.blots, i, !!b, b?.x ?? 0, b?.y ?? 0, b?.z ?? 0, b ? [b.r, 0.9 + 0.08 * Math.sin(clock * 2 + i), b.r] : [0, 0, 0]); }
    for (let i = 0; i < MAX_BEES; i++) {
      const b = course?.bees[i], q = b ? beeAt(b, clock) : [0, 0], q2 = b ? beeAt(b, clock + 0.05) : [0, 1], yaw = Math.atan2(-(q2[1] - q[1]), q2[0] - q[0]), y = (b?.y ?? 0) + 0.25 * Math.sin(clock * 6 + i);
      put(this.bees, i, !!b, q[0], y, q[1], [1, 1, 1], yaw);
      put(this.wings, i, !!b, q[0], y + 0.3, q[1], [1, 1, 0.5 + 0.5 * Math.abs(Math.sin(clock * 30))], yaw);
    }
    for (const m of [this.stars, this.blots, this.bees, this.wings]) m.instanceMatrix.needsUpdate = true;
  }
  refreshChip() {
    const ui = this.game.ui;
    if (!ui?.setScore || this.game.world !== this.world) return;
    const st = this.state(), c = this.cur;
    if (c) {
      const k = Math.ceil(Math.max(0, c.st.ink) / c.course.ink * DOODLE.inkBar);
      ui.setScore({ text: `✏️ Line ${c.k + 1} / ${LINE_COUNT} · Ink ${'▮'.repeat(k)}${'▯'.repeat(DOODLE.inkBar - k)}`, done: false });
      return;
    }
    ui.setScore({ text: st.done ? `✏️ Lines ${st.count} / ${LINE_COUNT} · To the Desk!` : `✏️ Lines ${st.count} / ${LINE_COUNT}`, done: st.done });
  }

  dispose() {
    this.game.ui?.setScore?.(null);
    this.pencil?.userData.dispose?.();
    this.rubber?.userData.dispose?.();
    for (const m of [this.ring, this.dashes, this.stars, this.blots, this.bees, this.wings]) { m?.geometry.dispose(); m?.material.dispose(); m?.dispose?.(); }
    this.group?.parent?.remove(this.group);
  }

  // For tests.
  info() {
    const c = this.cur, s = c?.st;
    return {
      drawing: !!c, line: c ? c.k + 1 : null, s: s ? s.s : 0, ink: s ? s.ink : 0, setbacks: s ? s.setbacks : 0, nibbles: s ? s.nibbles : 0,
      rubber: s?.rubber ? { s: s.rubber.s, on: s.rubber.on } : null, blocked: s?.blocked ?? null, waiting: !!s?.waiting, playerS: s ? s.playerS : 0,
      taken: s ? [...s.taken] : [], tip: s ? { ...s.tip } : null, aim: s?.aim ?? null, drawn: this.state().drawn, neat: [...this.neatGiven], last: this.lastDone ?? null,
      fellFor: this.fellFor, cells: s ? s.cells.size : 0,
    };
  }
}
