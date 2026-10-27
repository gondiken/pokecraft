// T45: the live part of the Sketchbook (LIVE.doodle): Trace! Stand on a star pad, press Draw!, and a giant pencil draws the next line while you
// keep your eye on its tip (tracing.js has the rules). Everything is per player and in memory except the finished lines, which are saved
// `beaten` keys (pw:doodle:line1..8). The ink is never an edit: it is drawn with world.setLive through LiveCells (never inside the player).
// Never a fail: when your aim leaves the tip the pencil waits. On the Eraser Hill Rubber the Eraser chases the pencil and rubs the line back
// to the last star dot if he catches it.
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';
import { TRACE, newTrace, traceStep, neatFraction } from './tracing.js';
import { lineKey, lineState, LINES, LINE_COUNT, FLOOR } from './doodleland.js';
import { sketchModel } from './sketch.js';

export const DOODLE = { fall: 0.5, scratch: 0.35, hintEvery: 6 };
const WORDS = {
  hint: 'Keep your eyes on the pencil tip!',
  wait: 'The pencil is waiting for you. Look at its tip!',
  first: 'Draw the line before this one first!',
  tower: 'Round and round! Follow the pencil up the tower.',
  eraser: 'Uh oh, Rubber the Eraser! Draw fast and steady!',
  rubbed: 'Hee hee! Rubber rubbed it out. Back to the star!',
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
export function buildRubber() { // Rubber the Eraser: a pink-grey block with a paper sleeve and two drawn eyes (2 meshes)
  const g = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), new THREE.MeshLambertMaterial({ color: 0xe9a9b8 }));
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
  g.userData.dispose = () => g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return g;
}

export class DoodleLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    const world = game.world;
    this.world = world;
    this.lines = world.doodle.lines;
    this.pads = world.doodle.pads;
    this.cells = new LiveCells(world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;            // tests set it and call step(dt, aim) themselves
    this.cur = null;                // { k, line, st, inkable, neatDone }
    this.drawnNow = new Set();      // line indices drawn (this trip: includes those a rematch cleared from the keys)
    this.neatGiven = new Set();
    this.rubbedAt = -1;
    this.fellFor = 0; this.scratchT = 0; this.hintT = 0;
    this.told = new Set();
    this.dashes = null; this.dashLines = [];
    this.guide = null;
    this.makeMeshes();
    // saved lines are drawn at once
    const st = lineState(game);
    this.lines.forEach((l, i) => { if (st.drawn[i]) this.inkAll(i); });
    this.syncDashes();
    this.shown = null;
  }

  /* ---- meshes ---- */
  makeMeshes() {
    const scene = this.game.scene, g = new THREE.Group();
    this.group = g;
    this.pencil = buildPencil();
    this.pencil.visible = false;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.visible = false;
    this.rubber = buildRubber();
    this.rubber.visible = false;
    sketchModel(this.rubber);
    // the dotted guide: one instanced mesh of flat dashes along every line
    let n = 0;
    for (const l of this.lines) n += Math.ceil(l.line.len / 1.1) + 1;
    this.dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.05, 0.1), new THREE.MeshBasicMaterial({ color: 0x3e3c46, transparent: true, opacity: 0.85 }), n);
    this.dashes.frustumCulled = false;
    this.dashLines = [];
    let at = 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    this.lines.forEach((l, li) => {
      const list = [];
      for (let s = 0; s <= l.line.len; s += 1.1) {
        const p = l.line.at(s), [dx, dz] = l.line.dirAt(s);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-dz, dx));
        pos.set(p[0], p[1] + 1.04, p[2]);
        this.dashes.setMatrixAt(at, m.compose(pos, q, sc));
        list.push({ s, idx: at, pos: pos.clone(), q: q.clone() });
        at++;
      }
      this.dashLines.push(list);
    });
    this.dashes.count = at;
    g.add(this.pencil, this.ring, this.rubber, this.dashes);
    scene?.add(g);
  }
  // Show the dashes of lines that are not drawn (and, while drawing, only the part ahead of the pencil).
  syncDashes() {
    const m = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0), sc = new THREE.Vector3(1, 1, 1);
    this.dashLines.forEach((list, li) => {
      const drawn = this.drawnNow.has(li), cur = this.cur?.k === li ? this.cur.st.s : -1;
      for (const d of list) this.dashes.setMatrixAt(d.idx, drawn || d.s <= cur ? zero : m.compose(d.pos, d.q, sc));
    });
    this.dashes.instanceMatrix.needsUpdate = true;
    this.dashesKey = this.key();
  }
  key() { return `${[...this.drawnNow].join()}|${this.cur ? this.cur.k + ':' + Math.floor(this.cur.st.s * 1.1) : ''}`; }

  /* ---- ink ---- */
  inkableOf(i) { // the cells of a line that are air in the world (the page cells under the line are solid already)
    const l = this.lines[i];
    return l.inkable ??= l.line.cells.filter(c => this.world.get(c.x, c.y, c.z) === B.AIR || this.world.get(c.x, c.y, c.z) === B.DO_INK);
  }
  inkAll(i) { for (const c of this.inkableOf(i)) this.cells.want(c.x, c.y, c.z, B.DO_INK); this.drawnNow.add(i); }
  // The wanted state of the cells of the line being drawn: ink up to the tip, except what Rubber has rubbed (after the last star dot).
  applyInk() {
    const { k, st, line } = this.cur;
    const protect = line.line.stars.filter(s => s <= st.s).pop() ?? 0;
    for (const c of this.cur.inkable) {
      const rubbed = st.eraser > 0 && c.s < st.eraser && c.s > protect;
      this.cells.want(c.x, c.y, c.z, st.done || (c.s <= st.s && !rubbed) ? B.DO_INK : B.AIR);
    }
  }

  // Marks lines 1..n as drawn (saved keys, ink at once). For the rematch reset and for tests.
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
  // The pad (index) the player stands on, or -1.
  padAt(pos) {
    for (let i = 0; i < this.pads.length; i++) {
      const p = this.pads[i];
      if (p.cells.some(([x, y, z]) => Math.abs(pos.x - (x + 0.5)) <= 0.95 && Math.abs(pos.z - (z + 0.5)) <= 0.95 && Math.abs(pos.y - (y + 1)) < 1.3)) return i; // on a pad cell or half a block beside it
    }
    return -1;
  }

  /* ---- hooks of the live-part interface ---- */
  near(p) {
    if (this.cur) return 'Stop';
    const i = this.padAt(p.pos), st = this.state();
    if (i < 0 || st.drawn[i]) return null;
    return 'Draw!';
  }
  use(p) {
    if (this.cur) { this.stop(); this.toast('The pencil rests. Press Draw! to go on.'); return true; }
    const i = this.padAt(p.pos), st = this.state();
    if (i < 0 || st.drawn[i]) return false;
    if (i > st.next) { this.toast(WORDS.first); return true; }
    this.start(i);
    return true;
  }
  aimTip() {
    if (!this.cur) return null;
    const t = this.cur.line.line.at(this.cur.st.s);
    return { x: t[0], z: t[2], text: () => WORDS.hint };
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
    const g = this.game, line = this.lines[i];
    this.stop(true);
    const race = line.kind === 'race';
    this.cur = { k: i, line, st: newTrace(line.kind, race ? i - 5 : 0), inkable: this.inkableOf(i), scratchAt: 0 };
    this.neatDone = false; this.hintT = 0;
    this.applyInk();
    this.once('hint', WORDS.hint);
    if (i === 4) this.toast(WORDS.tower);
    if (race) this.toast(WORDS.eraser);
    this.syncDashes();
  }
  stop(quiet = false) {
    if (!this.cur) return;
    this.cur = null;
    this.pencil.visible = false; this.ring.visible = false; this.rubber.visible = false;
    if (!quiet) this.syncDashes();
  }
  finish() {
    const g = this.game, { k, st } = this.cur, n = k + 1;
    const frac = neatFraction(st);
    this.applyInk();
    this.drawnNow.add(k);
    const key = lineKey(n);
    if (!g.beaten.includes(key)) g.beaten.push(key);
    g.save?.();
    sound.play('goalcheer');
    this.toast(`You drew a bridge! ✏️ ${this.state().count} / ${LINE_COUNT}`);
    if (frac >= TRACE.neat && !this.neatGiven.has(k)) { this.neatGiven.add(k); g.cubes += 1; this.toast('Neat line! +1 Capture Cube'); }
    this.lastDone = { n, frac, rubbed: st.rubbed };
    this.cur = null;
    this.pencil.visible = false; this.ring.visible = false; this.rubber.visible = false;
    this.syncDashes();
    this.refreshChip();
    if (this.state().done) this.toast('All the lines are drawn! Go to the Desk and meet Artist Arlo.');
  }
  aimNow() { // where you look: the eye and the view direction, from the player (tests drive step() with their own)
    const p = this.game.player, e = p.eyePos, f = p.forward;
    return { eye: [e.x, e.y, e.z], dir: [f.x, f.y, f.z], touch: typeof document !== 'undefined' && document.body.classList.contains('touch') };
  }

  /* ---- the frame ---- */
  update(dt = 0) { if (!this.manual) this.step(dt); }
  step(dt, aim) {
    const g = this.game, p = g.player;
    if (!p || !g.world || g.world !== this.world) return;
    this.cells.flush();
    const paused = this.paused();
    // falling onto the blank page puffs you back up (summed dt: a pause or a slow device counts the same)
    if (!paused) this.stepFall(dt, p);
    if (this.cur && !paused) this.stepDraw(dt, aim ?? this.aimNow());
    this.stepMeshes(p);
    if (this.key() !== this.dashesKey) this.syncDashes();
    this.refreshChip();
  }
  stepFall(dt, p) {
    const under = this.world.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z));
    if (p.onGround && under === B.DO_PAPER) this.fellFor += dt; else this.fellFor = 0;
    if (this.fellFor < DOODLE.fall) return;
    this.fellFor = 0;
    const st = this.state(), i = this.cur ? this.cur.k : Math.min(st.next, this.pads.length - 1);
    const stand = st.done && !this.cur ? this.world.bosses[0].rest : this.pads[i].stand;
    this.game.creatures?.puff?.({ x: p.pos.x, y: p.pos.y, z: p.pos.z }, { color: 0xf4efe0 });
    p.pos.set(stand[0], stand[1], stand[2]); p.vel.set(0, 0, 0);
    this.game.creatures?.puff?.({ x: stand[0], y: stand[1], z: stand[2] }, { color: 0xf4efe0 });
    this.toast(WORDS.fell);
  }
  stepDraw(dt, aim) {
    const c = this.cur, st = c.st, kind = c.line.kind, before = st.s, rubbed = st.rubbed;
    const wins = this.game.bossWins?.doodle || 0;
    traceStep(st, dt, aim, c.line.line, kind, wins);
    if (st.rubbed > rubbed) { sound.play('doodlerub'); this.toast(WORDS.rubbed); }
    // a star dot passed: a little chime
    for (const s of c.line.line.stars) if (before < s && st.s >= s) sound.play('checkpoint');
    if (st.on && st.s > before) { // the pencil scratches (quietly) while it draws
      c.scratchAt += dt;
      if (c.scratchAt >= DOODLE.scratch) { c.scratchAt = 0; sound.play('doodlescratch'); }
    }
    if (!st.on && st.offFor > TRACE.wait) { this.hintT += dt; if (this.hintT >= DOODLE.hintEvery || this.hintT === dt) { this.hintT = 0.001; this.toast(WORDS.wait); } }
    else if (st.on) this.hintT = 0;
    this.applyInk();
    if (st.done) this.finish();
  }
  stepMeshes(p) {
    const c = this.cur, st = this.state();
    // the pencil: leaning at the tip while drawing; else resting at the start of the next line when you are near it
    let at = null, lean = [0, 1];
    if (c) at = c.line.line.at(c.st.s);
    else if (!st.done) { const l = this.lines[st.next], s0 = l.line.at(0); if (Math.hypot(s0[0] - p.pos.x, s0[2] - p.pos.z) < 70) at = s0; }
    if (at) {
      this.pencil.visible = true;
      this.pencil.position.set(at[0], at[1] + TRACE.lift - 0.05, at[2]);
      const dx = at[0] - p.pos.x, dz = at[2] - p.pos.z, m = Math.hypot(dx, dz) || 1;
      this.pencil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / m * 0.4, 1, dz / m * 0.4).normalize());
      this.pencil.scale.setScalar(c ? 1 : 0.9);
    } else this.pencil.visible = false;
    // the ring at the tip: dashed-looking and pale when you are off, solid yellow and a bit bigger when you are on it
    if (c) {
      const t = c.line.line.at(c.st.s), cfg = TRACE[c.line.kind], ring = cfg.ring * (document.body.classList.contains('touch') ? TRACE.touch : 1);
      const cam = this.game.camera;
      this.ring.visible = true;
      this.ring.position.set(t[0], t[1] + TRACE.lift, t[2]);
      if (cam) this.ring.quaternion.copy(cam.quaternion);
      this.ring.scale.setScalar(ring * (c.st.on ? 1.08 : 1));
      this.ring.material.color.setHex(c.st.on ? PENCIL : 0xffffff);
      this.ring.material.opacity = c.st.on ? 0.95 : c.st.offFor > TRACE.wait ? 0.55 + 0.4 * Math.abs(Math.sin(c.st.offFor * 5)) : 0.55;
    } else this.ring.visible = false;
    // Rubber, only on the Eraser Hill while a race line is being drawn: at the start while he waits, then on his way
    if (c && c.line.kind === 'race' && c.st.wait !== null) {
      const r = c.line.line.at(Math.max(0, c.st.wait > 0 ? 0 : c.st.eraser)), [dx, dz] = c.line.line.dirAt(Math.max(0, c.st.eraser));
      this.rubber.visible = true;
      this.rubber.position.set(r[0], r[1] + 1, r[2]);
      this.rubber.rotation.y = Math.atan2(-dz, dx);
    } else this.rubber.visible = false;
  }
  refreshChip() {
    const ui = this.game.ui;
    if (!ui?.setScore || this.game.world !== this.world) return;
    const st = this.state();
    ui.setScore({ text: st.done ? `✏️ Lines ${st.count} / ${LINE_COUNT} · To the Desk!` : `✏️ Lines ${st.count} / ${LINE_COUNT}`, done: st.done });
  }

  dispose() {
    this.game.ui?.setScore?.(null);
    this.pencil?.userData.dispose?.();
    this.rubber?.userData.dispose?.();
    this.ring?.geometry.dispose(); this.ring?.material.dispose();
    this.dashes?.geometry.dispose(); this.dashes?.material.dispose(); this.dashes?.dispose();
    this.group?.parent?.remove(this.group);
  }

  // For tests.
  info() {
    const c = this.cur;
    return { drawing: !!c, line: c ? c.k + 1 : null, s: c ? c.st.s : 0, on: c ? c.st.on : false, speed: c ? c.st.speed : 0, eraser: c ? c.st.eraser : 0, rubbed: c ? c.st.rubbed : 0,
      drawn: this.state().drawn, neat: [...this.neatGiven], last: this.lastDone ?? null, off: c ? c.st.off : null, fellFor: this.fellFor, wait: c ? c.st.wait : null };
  }
}
void LINES; void FLOOR;
