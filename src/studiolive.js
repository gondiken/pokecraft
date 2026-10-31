// Wave 19 stage B: the live part of the Wizard's Tower (LIVE.studio, plans/wave19-wizard-tower.md section 6). The painting game: tap a paint pot (the
// brush takes its colour), tap a canvas square (it gets painted); the squares are drawn with world.setLive (never an edit, never saved or sent), so
// every player paints their own canvas. When a picture is right a chime plays, the floor's key `wizard:floor<n>` goes into `beaten` (saved at once)
// and the glass door to the stairs slides open (LiveCells: never closes on you). Stuck for 40 s of play time without a new right square = the wrong
// squares blink for 3 s, then again every 25 s (HINT; summed dt, so 60 and 20 fps blink at the same time). No timer, no fail, no trainers.
// Stage B only: the Wizard just says his gate words ("Almost ready for you!"); his battle, the drawing board and the ending are stage C.
// Every clock is summed dt (`manual` + `step(dt)` for tests).
import * as THREE from 'three';
import { B, WOOL } from './blocks.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';
import { raycastVoxel } from './world.js';
import { PAINTS, WASH } from './custom.js';
import { FLOORS, HINT, WORDS, checkCanvas, startCells, targetOf, floorKey, finishedCells, palette } from './wizardtower.js';
import { floorAt, cast, REACH } from './wizardland.js';
import { buildEasel, buildPotRims, buildBrush, buildRug, pictureCanvas } from './studioprops.js';

const BRUSH_AT = { x: 0.34, y: -0.4, z: -0.6, tilt: -0.35, lean: 0.4, size: 0.9 }; // the brush in front of the camera (x right, y up, -z ahead)
const BLINK_PERIOD = 0.3;
const FAR = 40; // a tap on the canvas from far away still answers ("Come a little closer!"); you only paint within REACH
const canvasBlock = paint => (paint < 0 ? WOOL.custom : WOOL[PAINTS[paint].wool]);

export class StudioLive {
  constructor(game, part) {
    this.game = game; this.part = part;
    this.world = game.world;
    this.S = game.world.studio;
    this.cells = new LiveCells(this.world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true);
    this.manual = false;                                       // tests set it and call step(dt) themselves
    this.brush = null;                                         // a PAINTS index, WASH (-1) for the wash jar, null = nothing yet; kept across floors
    this.state = FLOORS.map(f => ({ cells: startCells(f), right: 0, since: 0, nextAt: HINT.after, blinkEnd: -1, told: false, painted: false }));
    this.clock = 0;
    this.paint = null;                                         // floor 5's palette once done: [body, accent, belly]
    this.told = new Set();
    this.shown = 0;                                            // the floor the easel card shows
    this.blinkOn = false;
    this.makeMeshes();
    for (let n = 1; n <= FLOORS.length; n++) if (this.done(n)) this.showFinished(n);
  }

  /* ---- state ---- */
  done(n) { return this.game.beaten.includes(floorKey(n)); }
  floorNow() { const p = this.game.player; return p ? floorAt(p.pos) : 0; }
  // Floor 5's saved palette (stage C keeps it in game.studio.paint), else what was painted this visit.
  groupsOf(n) { return n === 5 ? this.game.studio?.paint ?? this.paint : null; }
  say(text) { this.game.ui.toast(text); }
  once(key, text) { if (this.told.has(key)) return; this.told.add(key); this.say(text); }

  /* ---- drawing (setLive, per player) ---- */
  square(n, i) { const c = this.S.canvases[n - 1]; return [c.x0 + (i % c.w), c.y0 + (c.h - 1 - Math.floor(i / c.w)), c.z]; }
  draw(n, i, paint) { const [x, y, z] = this.square(n, i); this.world.setLive(x, y, z, canvasBlock(paint)); }
  showFinished(n) { // a finished floor shows its picture (free groups: what was painted, else pleasant defaults) and its door open
    const f = FLOORS[n - 1], cells = finishedCells(f, this.groupsOf(n) ?? undefined);
    this.state[n - 1].cells = cells;
    cells.forEach((p, i) => this.draw(n, i, p));
    this.openDoor(n);
  }
  openDoor(n) { const d = this.S.doors.find(o => o.n === n); if (d) for (const [x, y, z] of d.cells) this.cells.want(x, y, z, B.AIR); }

  /* ---- what you point at ---- */
  // One cast from an eye (or a finger's ray) against this floor's canvas and pots. Returns { kind: 'square' | 'pot', i, n } or null.
  pick(o, d) {
    const n = this.floorNow();
    if (!n) return null;
    const hit = cast(this.S.floors[n - 1], o, d, FAR);
    if (!hit) return null;
    const b = raycastVoxel(this.world, o, d, hit.t); // a block in the way (the easel's prop...) wins
    if (b && b.t < hit.t - 0.02) return null;
    return { ...hit, n, far: hit.t > REACH };
  }
  pickEye(p) { const e = p.eyePos, f = p.forward; return this.pick({ x: e.x, y: e.y, z: e.z }, { x: f.x, y: f.y, z: f.z }); }

  /* ---- the hooks (gymlive.js) ---- */
  near(p) {
    if (!this.playing() || this.game.inBattle) return null;
    const h = this.pickEye(p);
    if (!h || h.far) return null;
    if (h.kind === 'pot') return h.i < 0 ? 'Wash!' : 'Dip!';
    return this.locked(h.n) ? null : 'Paint!';
  }
  use(p) { const h = this.pickEye(p); return h ? this.act(h) : false; }
  tap(origin, dir) {
    if (!this.playing() || this.game.inBattle) return false;
    const h = this.pick({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z });
    return h ? this.act(h) : false;
  }
  locked(n) { return this.done(n) && (n < FLOORS.length || !!this.game.studio?.ally); } // floors 1-4 are finished for good; floor 5 stays paintable until you chose your guardian (then its colours are final)

  act(h) {
    if (h.far) { this.say(WORDS.closer); return true; }
    if (h.kind === 'pot') { this.dip(h.i); return true; }
    this.paintSquare(h.n, h.i);
    return true;
  }
  dip(i) {
    this.brush = i;
    sound.play('paintpick');
    this.chip();
  }
  paintSquare(n, i) {
    const f = FLOORS[n - 1], st = this.state[n - 1], t = targetOf(f)[i];
    if (this.locked(n)) { this.say(WORDS.locked); return false; }
    if (t.kind === 'given') { this.say(WORDS.given); return false; }
    if (this.brush === null) { this.say(WORDS.noBrush); return false; }
    const paint = this.brush < 0 ? -1 : this.brush;
    if (st.cells[i] === paint) return false;                      // a square already that paint stays
    st.cells[i] = paint;
    this.draw(n, i, paint);
    sound.play('paintdab');
    st.painted = true;
    this.after(n);
    return true;
  }
  // After a change: progress resets the hint clock; a finished picture opens the door (first time) / updates floor 5's colours.
  after(n) {
    const f = FLOORS[n - 1], st = this.state[n - 1], r = checkCanvas(f, st.cells);
    if (r.right > st.right) { st.since = 0; st.nextAt = HINT.after; st.blinkEnd = -1; this.unblink(n); }
    st.right = r.right;
    if (this.blinkOn) this.blinkDraw(n, false); // a blink in progress follows the new squares
    if (!r.done) return;
    const first = !this.done(n);
    let changed = false;
    if (f.palette) { // floor 5's three colours are your creature's palette (stage C keeps them in the save field `wizard`)
      const pal = palette(f, st.cells);
      changed = !!pal && JSON.stringify(pal) !== JSON.stringify(this.game.studio?.paint ?? this.paint);
      this.paint = pal;
      if (pal && this.game.studio) this.game.studio.paint = pal;
    }
    if (first) {
      this.game.beaten.push(floorKey(n));
      sound.play('paintdone');
      this.openDoor(n);
    }
    if (first || changed) this.game.save?.(true);
    if (f.palette && !first && changed) this.say(WORDS.repaint);
    if (first) this.say(n === FLOORS.length ? 'Lovely colours! Come and talk to me.' : WORDS.done);
  }

  /* ---- the hint: the wrong squares blink ---- */
  unblink(n) { const st = this.state[n - 1]; if (this.blinkOn === n) { this.blinkOn = false; st.cells.forEach((p, i) => this.draw(n, i, p)); this.outline?.parent?.remove(this.outline); } }
  blinkDraw(n, lit) { // lit = the white outline phase: wrong squares drawn as blank canvas; dark phase: their paint
    const st = this.state[n - 1], r = checkCanvas(FLOORS[n - 1], st.cells);
    for (const i of r.wrong) this.draw(n, i, lit ? -1 : st.cells[i]);
    this.showOutline(n, r.wrong);
  }
  showOutline(n, wrong) {
    if (!this.outline) {
      const geo = new THREE.BufferGeometry();
      this.outline = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.95 }));
      this.outline.renderOrder = 50; this.outline.frustumCulled = false;
    }
    const pos = [];
    for (const i of wrong) {
      const [x, y, z] = this.square(n, i), zz = z + 1.02;
      pos.push(x, y, zz, x + 1, y, zz, x + 1, y, zz, x + 1, y + 1, zz, x + 1, y + 1, zz, x, y + 1, zz, x, y + 1, zz, x, y, zz);
    }
    this.outline.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (!this.outline.parent) this.game.scene?.add(this.outline);
  }
  hintStep(dt) {
    const n = this.floorNow();
    if (!n || this.done(n) && n < FLOORS.length) return;
    const st = this.state[n - 1];
    if (!st.painted) return; // nothing painted yet: nothing wrong (and the sign is the hint)
    st.since += dt;
    if (st.blinkEnd < 0 && st.since >= st.nextAt) {
      if (checkCanvas(FLOORS[n - 1], st.cells).wrong.length) { st.blinkEnd = st.since + HINT.blink; this.blinkOn = n; st.phase = 0; }
      else st.nextAt = st.since + HINT.again;
    }
    if (st.blinkEnd >= 0) {
      if (st.since >= st.blinkEnd) { st.blinkEnd = -1; st.nextAt = st.since + HINT.again; this.unblink(n); }
      else { const lit = Math.floor((st.blinkEnd - st.since) / BLINK_PERIOD) % 2 === 0; if (lit !== st.lit) { st.lit = lit; this.blinkDraw(n, lit); } }
    }
  }

  /* ---- the Wizard (stage C: game.studio holds his gate words, the battle, the board and the ending) ---- */
  talk(npc) {
    if (!npc?.def?.wizard) return false;
    if (this.game.studio) return this.game.studio.talk(npc);
    this.say(`The Wizard: ${WORDS.almost}`);
    return true;
  }
  talkPrompt(npc) { return npc?.def?.wizard ? (this.game.studio?.talkPrompt(npc) ?? { verb: 'talk', action: 'Talk' }) : null; }
  aim() { return null; } // the terrain's wizardAim leads the way (realms.js TERRAIN_AIMS)

  /* ---- the HUD: the brush chip and the easel card ---- */
  chip() {
    const ui = this.game.ui, n = this.floorNow();
    if (!ui?.setScore) return;
    const c = ui.scoreChip;
    if (!n || this.game.inBattle) { ui.setScore(null); if (c) c.style.borderLeft = ''; return; }
    const name = this.brush === null ? 'no paint yet' : this.brush < 0 ? 'wash jar' : PAINTS[this.brush].name;
    ui.setScore({ text: `🖌️ ${name} · Floor ${n} / ${FLOORS.length}`, done: this.done(n) });
    if (c) c.style.borderLeft = this.brush !== null && this.brush >= 0 ? `12px solid #${PAINTS[this.brush].hex.toString(16).padStart(6, '0')}` : '';
  }
  card(n) {
    const el = document.getElementById('easel');
    if (!el) return;
    if (!n || this.game.inBattle || !this.playing()) { el.classList.add('hidden'); this.shown = 0; return; }
    if (this.shown === n) return;
    this.shown = n;
    const cv = el.querySelector('canvas'), src = pictureCanvas(FLOORS[n - 1], 128);
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    el.classList.remove('hidden');
    if (!el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('pointerdown', () => { el.classList.add('big'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('big'), 3000); }); }
  }

  /* ---- meshes ---- */
  makeMeshes() {
    const scene = this.game.scene;
    this.group = new THREE.Group();
    this.easels = this.S.easels.map(e => {
      const m = buildEasel(FLOORS[e.floor - 1]);
      m.position.set(e.x, e.y, e.z);
      m.rotation.y = Math.atan2(24 - e.x, 21.5 - e.z); // turned toward the painter's mat
      this.group.add(m);
      return m;
    });
    this.rugs = this.S.mats.map(m => { const r = buildRug(); r.position.set((m.x0 + m.x1 + 1) / 2, m.y + 1.02, (m.z0 + m.z1 + 1) / 2); this.group.add(r); return r; });
    this.rims = buildPotRims(this.S.pots);
    this.group.add(this.rims);
    this.brushModel = buildBrush();
    this.brushMat = new THREE.Matrix4();
    const self = this;
    for (const m of this.brushModel.children) {
      const local = new THREE.Matrix4().compose(m.position, m.quaternion, m.scale);
      m.matrixAutoUpdate = false; m.frustumCulled = false; m.visible = false;
      m.onBeforeRender = function (renderer, sc, cam) { this.matrixWorld.multiplyMatrices(cam.matrixWorld, self.brushMat).multiply(local); };
    }
    this.brushParts = [...this.brushModel.children];
    if (scene) { scene.add(this.group); for (const m of this.brushParts) scene.add(m); }
  }
  brushPose(bob) {
    this.brushMat.compose(new THREE.Vector3(BRUSH_AT.x, BRUSH_AT.y + bob, BRUSH_AT.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(BRUSH_AT.tilt, 0, BRUSH_AT.lean, 'XYZ')), new THREE.Vector3(BRUSH_AT.size, BRUSH_AT.size, BRUSH_AT.size));
  }
  syncBrush() {
    const g = this.game, show = this.floorNow() > 0 && !g.inBattle && g.started && this.playing();
    if (show !== this.brushShown) { this.brushShown = show; for (const m of this.brushParts) m.visible = show; }
    if (!show) return;
    const v = g.player.vel, bob = g.player.onGround && v ? Math.sin(this.clock * 9) * Math.min(1, Math.hypot(v.x, v.z) / 4) * 0.012 : 0;
    this.brushPose(bob);
    this.brushModel.userData.setPaint(this.brush !== null && this.brush >= 0 ? PAINTS[this.brush].hex : null);
  }

  /* ---- time ---- */
  update(dt) {
    if (this.manual) return; // tests call step(dt) themselves
    this.step(dt);
  }
  step(dt) {
    if (this.game.world !== this.world) return;
    const n = this.floorNow();
    this.cells.flush();
    if (this.playing()) { this.clock += dt; this.hintClock(dt); }
    if (n && this.game.started && !this.game.inBattle) {
      const f = FLOORS[n - 1];
      if (!this.told.has(`sign${n}`)) { const L = this.S.floors[n - 1], p = this.game.player.pos; if (Math.hypot(p.x - 24, p.z - (L.mat.z0 + 1)) < 5.5) { this.told.add(`sign${n}`); this.say(f.sign); } }
    }
    this.syncBrush();
    this.chip();
    this.card(n);
  }
  hintClock(dt) { this.hintStep(dt); }

  /* ---- for tests ---- */
  info() {
    const n = this.floorNow();
    return { floor: n, brush: this.brush, done: [1, 2, 3, 4, 5].filter(k => this.done(k)), cells: this.state.map(s => [...s.cells]), blink: this.blinkOn, since: this.state.map(s => s.since), paint: this.paint,
      doorOpen: this.S.doors.map(d => d.cells.every(([x, y, z]) => this.world.get(x, y, z) === B.AIR)), brushShown: !!this.brushShown, easel: this.shown };
  }
  dispose() {
    const scene = this.game.scene;
    scene?.remove(this.group);
    for (const m of this.easels) m.userData.dispose();
    for (const m of this.rugs) m.userData.dispose();
    this.rims.userData.dispose();
    for (const m of this.brushParts ?? []) scene?.remove(m);
    this.brushModel.userData.dispose();
    this.brushParts = null;
    if (this.outline) { this.outline.parent?.remove(this.outline); this.outline.geometry.dispose(); this.outline.material.dispose(); }
    this.game.ui?.setScore?.(null);
    if (this.game.ui?.scoreChip) this.game.ui.scoreChip.style.borderLeft = '';
    document.getElementById('easel')?.classList.add('hidden');
  }
}
