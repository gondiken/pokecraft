// Cube Planets: the live part (LIVE.gravity, world.parts from cubeland.js). The starry sky (one Points, never a block, never saved) and the
// three skill games (rules: orbits.js; owner 2026-10-29: "easy to understand, hard to master", every rule natural space physics with a
// reason in Professor Orbit's observatory, and as little text as can be: the scene says how, the helpers tell the story):
//  - the Orbikit Chase (the Crystal Cube, the Tree Cube, the Long Rock): the Professor's comet cheetahs got loose. Each runs round its
//    planet, its way dotted faintly on the faces and a sparkly trail behind it. Touch it (or Tag! within reach): pw:gravity:tag1..3.
//  - the Planet Hop (the Flower Cube, then four pebbles): spring flowers. Standing on one squashes its coil; Jump and it flings you
//    (player.js launchAt). Land on the next pebble; a flight that lands anywhere else (or floats off into space) is a miss and a puff takes
//    you back. The Last Pebble saves pw:gravity:hop. Blue home flowers puff you home.
//  - the Moon Ferry (the Moon Dock and three Lens Rocks): a little moon goes round a little sun on a real orbit (orbits.js ferryAt) and
//    never stops. Walk or jump onto it as it passes (it scoops you up), Jump to let go: you keep its speed. Land on a Lens Rock: its lens
//    is found (pw:gravity:lens1..3, any order). A jump that floats off into space is puffed back to the dock.
// Never a fail (a miss tries again), kind help only through orbits.js gravityHelp (= kindhelp.js), a harder rematch when you hold the star
// (orbits.js HARD). Once all are won every game plays on just for fun (forfun.js) and saves nothing new. A won battle with Professor Orbit
// clears the seven keys (battleEnded). The redesign's one-time reset is worldreset.js's (mark pw:gravity:redesign1). Clocks are summed
// frame dt with fixed sub-steps (orbits.js STEP) and stand still in a battle, an ask, a panel or the pause. `manual` + step(dt) for tests; info() for tests.
import * as THREE from 'three';
import { sound } from './sound.js';
import { buildModel, animateModel, disposeModel } from './species.js';
import { sketchModel } from './sketch.js';
import { PLANETS, P, PUPS, FLOWERS, HOME_FLOWERS, MOON, SUN, LENSES, BOXES, tagKey, HOP_KEY, lensKey, GRAVITY_KEYS, gravityState } from './cubeland.js';
import { GRAV, upOf, frameOf, toLocal } from './gravity.js';
import { PupRun, PUP, loopNearest, loopAt, ferryAt, jumpOff, gravityHelp, HARD } from './orbits.js';
import { FUN } from './forfun.js';
import { buildFlower, buildSpring, buildMoon, buildSun, buildLens, buildDots } from './cubeprops.js';

const STARS = 700, R = 240;
// dtMax: the longest frame step; sayGap: the same words again after; back: a missed hop puffs you back after; lost: a game flight floating
// outside every planet's field this long is a miss; homeAfter: stand on a home flower this long; retagAfter: a new Orbikit round after a tag;
// boardR: Hop on! reaches this far; trail / trailGap: the Orbikit's sparkles; dotGap: its way's dots; orbitDots: dots on the moon's way.
export const CUBE_RULES = { dtMax: 0.1, sayGap: 3, back: 1.0, lost: 1.5, homeAfter: 0.6, retagAfter: 3, boardR: 2.2, trail: 14, trailGap: 0.32, dotGap: 0.9, orbitDots: 90 };
// Owner 2026-10-29: "too much instruction text". Only results, never rules (the scene and the helpers say how).
const WORDS = {
  tagged: n => `🐱 Tagged! ${n} / 3`,
  seen: '🐱 It saw you!',
  hopLand: name => `🌸 ${name}!`,
  hopDone: '🌸 Every pebble!',
  home: '💠 Home!',
  lens: n => `🔭 A lens! ${n} / 3`,
  lost: '🌌 Poof!',
};
const CSS_FUN = ` ${FUN.tag}`;
const TMP = new THREE.Matrix4();

export class CubeLive {
  constructor(game, part) {
    this.game = game; this.part = part; this.world = game.world; this.scene = game.scene;
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;
    this.told = {}; this.said = new Map(); this.clock = 0;
    this.caught = 0;
    // the Orbikit Chase
    this.pups = PUPS.map(() => ({ run: null, tagT: -99 }));
    this.pMiss = [0, 0, 0]; this.tagPress = false;
    // the Planet Hop
    this.flight = null; this.hMiss = FLOWERS.map(() => 0); this.backT = 0; this.backTo = null; this.homeT = 0; this.hopLast = -1; this.padsFor = -2;
    this.onSpring = -1; this.boing = FLOWERS.map(() => 9);
    // the Moon Ferry
    this.phase = 0.5; this.moonK = 1; this.onMoon = false; this.jump = null; this.fMiss = 0; this.moonBackT = 0; this.spaceWas = false;
    this.M = MOON;
    this.moonObj = this.makeMoonObj();
    this.groups = [];
    this.buildSky();
    this.build();
  }
  get hard() { return !!this.game.stars?.includes('gravity'); }
  state() { return gravityState(this.game); }
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  toast(m) { this.game.ui?.toast(m); }
  say(key, m, gap = CUBE_RULES.sayGap) { const t = this.clock; if (t - (this.said.get(key) ?? -1e9) < gap) return; this.said.set(key, t); this.toast(m); }
  play(name) { try { sound.play(name); } catch { /* sound is optional */ } }
  save() { this.game.save?.(); }
  has(k) { return !!this.game.beaten?.includes(k); }
  addKey(k) { const g = this.game; if (!g.beaten.includes(k)) g.beaten.push(k); this.save(); }

  /* ---------------------------------------------- meshes ---------------------------------------------- */
  buildSky() {
    // the sky: soft stars on a big sphere that follows the camera (fog off, so they stay bright far away)
    const pos = new Float32Array(STARS * 3), col = new Float32Array(STARS * 3);
    let a = 0x51a75;
    const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < STARS; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * s * R, u * R, Math.sin(th) * s * R], i * 3);
      const warm = rnd(), b = 0.6 + rnd() * 0.4;
      col.set(warm < 0.2 ? [b, b * 0.9, b * 0.6] : warm < 0.35 ? [b * 0.7, b * 0.8, b] : [b, b, b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
    this.stars.renderOrder = -1;
    this.stars.frustumCulled = false;
    this.stars.userData.keepColour = true;
    this.scene?.add(this.stars);
  }
  build() {
    const add = o => { this.groups.push(o); this.scene?.add(o); return o; };
    const Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    // the Orbikits (the species' own model, so they look like the wild ones), their loops (faint dots), their trails (bright)
    this.pupModels = PUPS.map(() => { try { const m = buildModel('orbikit'); sketchModel(m); this.scene?.add(m); return m; } catch { return null; } });
    let nDots = 0; const loopDots = [];
    this.loops = PUPS.map(q => new PupRun(q.loop, BOXES[q.planet]).L);
    for (const L of this.loops) { for (let s = 0; s < L.total; s += CUBE_RULES.dotGap) { const a = loopAt(L, s); loopDots.push([a.pos, a.up]); nDots++; } }
    this.loopDots = add(buildDots(nDots, 0xb8a8f0, 0.09, 0.55));
    loopDots.forEach(([p, u], i) => this.loopDots.userData.mesh.setMatrixAt(i, TMP.makeTranslation(p[0] + u[0] * 0.04, p[1] + u[1] * 0.04, p[2] + u[2] * 0.04)));
    this.loopDots.userData.mesh.instanceMatrix.needsUpdate = true;
    this.trail = add(buildDots(PUPS.length * CUBE_RULES.trail, 0xffd84a, 0.14));
    // the spring flowers (on their pads, turned to their face's up) and the blue home flowers
    this.springs = FLOWERS.map(f => {
      const g = add(buildSpring()), up = [0, 0, 0]; up[f.axis] = f.sign;
      const c = f.cell.map(v => v + 0.5); c[f.axis] = f.sign > 0 ? f.cell[f.axis] + 1 : f.cell[f.axis];
      g.position.set(c[0], c[1], c[2]); g.quaternion.copy(Q.setFromUnitVectors(Y, new THREE.Vector3(...up)));
      return g;
    });
    this.homeMeshes = HOME_FLOWERS.map(h => { const g = add(buildFlower(true)); g.position.set(h.cell[0] + 0.5, h.cell[1] + 1, h.cell[2] + 0.5); return g; });
    // the moon, the little sun it goes round, its way (faint dots), the lenses
    this.moonMesh = add(buildMoon(MOON.half, MOON.thick));
    this.sunMesh = add(buildSun());
    this.sunMesh.position.set(SUN[0], SUN[1] + 1.5, SUN[2]);
    const od = add(buildDots(CUBE_RULES.orbitDots, 0xf0e4b0, 0.12, 0.45));
    for (let i = 0; i < CUBE_RULES.orbitDots; i++) { const m = ferryAt(MOON, i / CUBE_RULES.orbitDots); od.userData.mesh.setMatrixAt(i, TMP.makeTranslation(m.pos[0], m.pos[1] - MOON.thick - 0.4, m.pos[2])); }
    od.userData.mesh.instanceMatrix.needsUpdate = true;
    this.lensMeshes = LENSES.map(L => { const g = add(buildLens()); g.position.set(...L.at); return g; });
  }
  dispose() {
    this.getOff(false);
    this.game.ui?.setScore?.(null);
    this.scene?.remove(this.stars);
    this.stars.geometry.dispose(); this.stars.material.dispose();
    for (const g of this.groups) { this.scene?.remove(g); g.userData.dispose?.(); }
    this.groups = [];
    for (const m of this.pupModels) if (m) { this.scene?.remove(m); disposeModel(m); }
    this.pupModels = [];
    for (const w of this.world.planets || []) w.pad = 0;
  }

  /* ---------------------------------------------- the moon you ride ---------------------------------------------- */
  makeMoonObj() {
    const me = this;
    return {
      where: () => { const m = me.moonNow(); return { x: m.pos[0], y: m.pos[1], z: m.pos[2] }; },
      wantsLeave(space) { const fresh = !!space && !me.spaceWas; me.spaceWas = !!space; return fresh; },
      leave() { me.jumpOffMoon(); },
      safe: () => me.dockSpot(),
    };
  }
  moonNow() { return ferryAt(this.M, this.phase, this.moonK); }
  // on the dock's top right under the moon's far end (it scoops you up there; a miss puffs you back there)
  dockSpot() { return { x: this.M.cx + (this.M.sx ?? 1) * (this.M.a - 0.5), y: BOXES[MOON.dock].y1, z: this.M.cz }; }
  nearMoon(pos) { const m = this.moonNow(); return Math.hypot(pos.x - m.pos[0], pos.z - m.pos[2]) < CUBE_RULES.boardR && pos.y - m.pos[1] < 1 && m.pos[1] - pos.y < 2.6; }
  // the moon's box meets your body (it sweeps you up as it passes), or you come down onto its top
  scoops(p) {
    const m = this.moonNow(), h = this.M.half + 0.3, dx = Math.abs(p.pos.x - m.pos[0]), dz = Math.abs(p.pos.z - m.pos[2]);
    if (dx > h || dz > h || (p.frameNo?.() ?? 0) !== 0) return false;
    const feet = p.pos.y, top = m.pos[1], bottom = top - this.M.thick;
    return feet < top + 0.25 && feet + 1.8 > bottom && (p.onGround || p.vel.y <= 0.5);
  }
  board() {
    const g = this.game, p = g.player;
    g.riding?.stop?.('quiet');
    this.onMoon = true; this.spaceWas = true; this.jump = null; this.moonBackT = 0;
    p.carry = this.moonObj; p.vel.set(0, 0, 0);
    const w = this.moonObj.where(); p.pos.set(w.x, w.y, w.z);
    this.play('moonhop');
  }
  // Jump off: you keep the moon's speed (orbits.js jumpOff); where you land is judged in stepMoon
  jumpOffMoon() {
    const p = this.game.player, m = this.moonNow(), v = jumpOff(m.vel, GRAV.jump);
    if (p.carry === this.moonObj) p.carry = null;
    p.vel.set(v[0], v[1], v[2]); p.onGround = false;
    this.onMoon = false;
    this.jump = { t: 0, lost: 0, from: m.pos.slice() };
    this.play('flowerpop');
  }
  getOff(safe = true) {
    const p = this.game.player;
    if (p?.carry === this.moonObj) { p.carry = null; if (safe) { const s = this.dockSpot(); p.pos.set(s.x, s.y, s.z); } p.vel.set(0, 0, 0); }
    this.onMoon = false;
  }

  /* ---------------------------------------------- the live-part hooks ---------------------------------------------- */
  near(p = this.game.player) {
    if (!p || this.game.inBattle || this.game.world !== this.world) return null;
    if (this.onMoon || p.carry) return null; // (on the moon the Jump button lets go)
    if (this.pupNear(p) >= 0) return 'Tag!';
    if (this.nearMoon(p.pos)) return 'Hop on!';
    return null;
  }
  use(p = this.game.player) {
    const w = this.near(p);
    if (w === 'Tag!') { this.tagPress = true; return true; }
    if (w === 'Hop on!') { this.board(); return true; }
    return false;
  }
  // the pup on your planet within Tag! reach (its index), or -1
  pupNear(p) {
    const gd = p.grav;
    if (!gd) return -1;
    const i = PUPS.findIndex(q => q.planet === gd.planet), r = this.pups[i]?.run;
    if (i < 0 || !r || r.tagged) return -1;
    const a = r.at, mid = a.pos.map((v, k) => v + a.up[k] * PUP.sit), u = upOf(p.frame ?? 0);
    const feet = [p.pos.x, p.pos.y, p.pos.z], d = Math.min(...[0, 0.9, 1.8].map(h => Math.hypot(mid[0] - feet[0] - u[0] * h, mid[1] - feet[1] - u[1] * h, mid[2] - feet[2] - u[2] * h)));
    return d <= r.button ? i : -1;
  }
  // The guide while a game is going on (cubeland.js cubeAim asks first). `at(worldPoint, text)` makes an arrow on your face. Only where,
  // never how (owner 2026-10-29).
  aim(p, at) {
    const pl = this.game.player, gd = pl?.grav;
    if (!gd || !at) return null;
    const st = this.state();
    const pi = PUPS.findIndex(q => q.planet === gd.planet);
    if (pi >= 0 && (!st.tag[pi] || this.pups[pi].run)) return { text: () => `🐱 Orbikit${st.tag[pi] ? CSS_FUN : ''}` };
    const f = FLOWERS.find(x => x.planet === gd.planet);
    if (f && (!st.hop || this.flight || this.hopLast >= 0)) {
      const c = f.cell.map(v => v + 0.5); c[f.axis] = f.sign > 0 ? f.cell[f.axis] + 1 : f.cell[f.axis];
      if (Math.hypot(c[0] - p.x, c[1] - p.y, c[2] - p.z) < 1.2) return { text: () => `🌸 ${PLANETS[f.to].emoji}${st.hop ? CSS_FUN : ''}` };
      return at(c, (a, m) => `🌸 ${a} ${m}m${st.hop ? CSS_FUN : ''}`);
    }
    const lensLeft = LENSES.filter(L => !st.lens[L.n]), fun = !lensLeft.length;
    if (this.onMoon) { const L = (fun ? LENSES : lensLeft).reduce((b, L) => (!b || Math.hypot(L.at[0] - p.x, L.at[2] - p.z) < Math.hypot(b.at[0] - p.x, b.at[2] - p.z) ? L : b), null); return at(L.at, (a, m) => `🔭 ${a} ${m}m${fun ? CSS_FUN : ''}`); }
    if (gd.planet === MOON.dock && (lensLeft.length || this.jump)) { const m = this.moonNow(); return at(m.pos, (a, d) => `🌙 ${a} ${d}m`); }
    return null;
  }
  battleEnded(result, opts) {
    const pic = opts?.picture, g = this.game;
    if (pic?.id !== 'gravity' || pic.crew != null || result !== 'won') return;
    for (const k of GRAVITY_KEYS) { const at = g.beaten.indexOf(k); if (at >= 0) g.beaten.splice(at, 1); } // a won battle with Professor Orbit clears the seven keys: a rematch plays the games again (harder)
    this.pMiss = [0, 0, 0]; this.hMiss = FLOWERS.map(() => 0); this.fMiss = 0;
    this.pups.forEach(q => { q.run = null; });
    this.save();
  }

  /* ---------------------------------------------- the Orbikit Chase ---------------------------------------------- */
  seen(from, to) { // nothing solid between the Orbikit's eyes and you (trees and the planet's own edge hide you)
    const w = this.world, d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], L = Math.hypot(...d), n = Math.ceil(L / 0.25);
    for (let i = 1; i < n; i++) { const k = i / n; if (w.isSolid(Math.floor(from[0] + d[0] * k), Math.floor(from[1] + d[1] * k), Math.floor(from[2] + d[2] * k))) return false; }
    return true;
  }
  stepPups(dt) {
    const p = this.game.player, gd = p.grav, st = this.state(), up = upOf(p.frameNo?.() ?? 0);
    const press = this.tagPress; this.tagPress = false;
    PUPS.forEach((q, i) => {
      const P_ = this.pups[i], mine = !!gd && gd.planet === q.planet && gd.field && !p.carry;
      const opts = () => ({ base: q.base, boost: q.boost, see: q.see, tagR: q.tagR, flip: q.flip, help: this.pMiss[i], hard: this.hard, seen: (a, b) => this.seen(a, b) });
      if (!P_.run && mine && this.clock - P_.tagT >= CUBE_RULES.retagAfter) { // a new round: it starts on the far side of its loop from you
        const box = BOXES[q.planet], tmp = new PupRun(q.loop, box), s0 = loopNearest(tmp.L, [p.pos.x, p.pos.y, p.pos.z]).s;
        P_.run = new PupRun(q.loop, box, { ...opts(), start: s0 + tmp.L.total / 2 });
      }
      const r = P_.run;
      if (!r) return;
      const ev = r.update(dt, { mine, feet: [p.pos.x, p.pos.y, p.pos.z], up, face: gd ? [gd.axis, gd.sign] : null, press: press && mine });
      for (const e of ev) {
        if (e.type === 'tag') {
          P_.tagT = this.clock; P_.run = null; this.pMiss[i] = 0;
          this.play('orbitag');
          if (st.tag[i]) this.toast(`🐱 Tagged!${CSS_FUN}`);
          else { this.addKey(tagKey(i + 1)); this.toast(WORDS.tagged(this.state().tags)); }
        } else if (e.type === 'spotted') {
          this.pMiss[i]++; this.play('orbiseen');
          this.say('seen', WORDS.seen, 8);
          const h = gravityHelp(this.pMiss[i]); // (the kind help grows within the round)
          r.boost = q.boost * (this.hard ? HARD.pup : 1) * h.sprint; r.tagR = q.tagR * h.tag; r.button = PUP.button * h.tag;
        }
      }
    });
  }
  drawPups() {
    const Z = new THREE.Matrix4().makeScale(0, 0, 0), T = this.trail.userData.mesh, n = CUBE_RULES.trail;
    const X = new THREE.Vector3(), Yv = new THREE.Vector3(), Zv = new THREE.Vector3();
    PUPS.forEach((q, i) => {
      const r = this.pups[i].run, m = this.pupModels[i];
      const at = r ? r.at : null;
      for (let k = 0; k < n; k++) {
        if (!r) { T.setMatrixAt(i * n + k, Z); continue; }
        const b = loopAt(r.L, r.s - r.dir * (k + 1) * CUBE_RULES.trailGap), lift = 0.12 + 0.05 * Math.sin(this.clock * 9 + k);
        const sc = 1 - k / n;
        TMP.makeScale(sc, sc, sc).setPosition(b.pos[0] + b.up[0] * lift, b.pos[1] + b.up[1] * lift, b.pos[2] + b.up[2] * lift);
        T.setMatrixAt(i * n + k, TMP);
      }
      if (!m) return;
      if (!r) { // napping on its loop's start until you come to its planet (or right after a tag)
        const a = loopAt(this.loops[i], 0);
        Yv.set(...a.up); Zv.set(...a.dir); X.crossVectors(Yv, Zv);
        m.position.set(...a.pos); m.quaternion.setFromRotationMatrix(TMP.makeBasis(X, Yv, Zv));
        animateModel(m, this.clock + i, false);
        return;
      }
      const h = r.heading();
      Yv.set(...at.up); Zv.set(h[0], h[1], h[2]); X.crossVectors(Yv, Zv);
      m.position.set(...at.pos); m.quaternion.setFromRotationMatrix(TMP.makeBasis(X, Yv, Zv));
      animateModel(m, this.clock * (r.speed / 4) + i, true);
    });
    T.instanceMatrix.needsUpdate = true;
  }

  /* ---------------------------------------------- the Planet Hop ---------------------------------------------- */
  flowerUnder(pos) { // the spring flower whose pad you stand on (or stood on last)
    return FLOWERS.findIndex(f => { const c = f.cell.map(v => v + 0.5); c[f.axis] = f.sign > 0 ? f.cell[f.axis] + 1 : f.cell[f.axis]; return Math.hypot(c[0] - pos.x, c[1] - pos.y, c[2] - pos.z) < 1.0; });
  }
  // The kind help (and the rematch's smaller catch) as a planet's `pad` (gravity.js downAt): the next pebble of flower k while you hop,
  // the Lens Rocks while you are on the dock or the moon or flying off it.
  setPads() {
    const pl = this.world.planets, p = this.game.player, hard = this.hard ? HARD.pad : 0;
    for (const w of pl) w.pad = 0;
    const k = this.flight ? this.flight.k : FLOWERS.findIndex(f => f.planet === p.grav?.planet);
    if (k >= 0) pl[FLOWERS[k].to].pad = gravityHelp(this.hMiss[k]).pad + hard;
    if (this.onMoon || this.jump || p.grav?.planet === MOON.dock) for (const L of LENSES) pl[L.planet].pad = gravityHelp(this.fMiss).lens + hard;
  }
  stepHop(dt) {
    const p = this.game.player, st = this.state();
    // a spring flower squashes under you (and creaks); Jump on it and it boings
    const under = p.onGround && !p.carry ? this.flowerUnder(p.pos) : -1;
    if (under >= 0 && under !== this.onSpring) this.play('springsquish');
    this.onSpring = under;
    if (p.launched) {
      const k = this.flowerUnder(p.lastFace?.pos ?? p.pos);
      p.launched = 0;
      if (k >= 0) { this.flight = { k, t: 0, lost: 0 }; this.play('springboing'); this.boing[k] = 0; }
    }
    if (this.flight) {
      const f = FLOWERS[this.flight.k];
      this.flight.t += dt;
      this.flight.lost = p.grav?.soft ? this.flight.lost + dt : 0;
      if (this.flight.t > 0.15 && p.onGround) {
        const k = this.flight.k, on = p.grav?.planet;
        this.flight = null;
        if (on === f.to) {
          this.hMiss[k] = 0; this.play('pebbleland'); this.hopLast = k;
          const last = k === FLOWERS.length - 1;
          if (last && !st.hop) { this.addKey(HOP_KEY); this.toast(WORDS.hopDone); }
          else if (last) this.toast(`🌸${CSS_FUN}`);
          else this.toast(WORDS.hopLand(PLANETS[f.to].name));
        } else if (on !== f.planet) this.hopMiss(k); // (back on its own pebble: simply try again)
      } else if (this.flight && (this.flight.lost > CUBE_RULES.lost || this.flight.t > 8)) { const k = this.flight.k; this.flight = null; this.hopMiss(k); }
    }
    if (this.backT > 0 && typeof this.backTo === 'number') {
      this.backT -= dt;
      if (this.backT <= 0) this.puffTo(this.flowerStand(this.backTo));
    }
    // a home flower: stand on it a moment and you are puffed home
    const home = this.world.homeAt?.(p.pos, p.frameNo?.() ?? 0);
    if (home && p.onGround) { this.homeT += dt; if (this.homeT >= CUBE_RULES.homeAfter) { this.homeT = 0; this.flight = null; this.toast(WORDS.home); this.puffTo(this.homeStand()); } } else this.homeT = 0;
  }
  hopMiss(k) { this.hMiss[k]++; this.backT = CUBE_RULES.back; this.backTo = k; this.play('puff'); }
  // where to put you back for flower k: 2 blocks before it on its face, facing the way its run goes
  flowerStand(k) {
    const f = FLOWERS[k], d = f.solution.dir, o = [0, 1, 2].filter(a => a !== f.axis), pos = f.cell.map(v => v + 0.5);
    pos[f.axis] = f.sign > 0 ? f.cell[f.axis] + 1 : f.cell[f.axis];
    pos[o[0]] -= d[0] * 2; pos[o[1]] -= d[1] * 2;
    const down = [0, 0, 0]; down[f.axis] = -f.sign;
    return { pos, frame: frameOf(down), look: [pos[0] + (o[0] === 0 ? d[0] : 0) * 4, pos[1], pos[2] + (o[1] === 2 ? d[1] : 0) * 4] };
  }
  homeStand() { const r = this.world.rests[0]; return { pos: [r[0], r[1], r[2]], frame: 0 }; }
  puffTo(spot) {
    const p = this.game.player;
    this.getOff(false);
    p.pos.set(spot.pos[0], spot.pos[1], spot.pos[2]); p.vel.set(0, 0, 0); p.onGround = false;
    p.setFrame?.(spot.frame);
    if (spot.look && p.frameLookAt) { const l = toLocal(spot.frame, [spot.look[0] - spot.pos[0], 0, spot.look[2] - spot.pos[2]]); if (Math.hypot(l[0], l[2]) > 0.1) p.yaw = Math.atan2(-l[0], -l[2]); p.pitch = 0; }
    p._fLast?.copy?.(p.pos);
    this.play('puff');
  }

  /* ---------------------------------------------- the Moon Ferry ---------------------------------------------- */
  stepMoon(dt) {
    const p = this.game.player, st = this.state();
    if (!this.onMoon) this.moonK = (this.hard ? HARD.moon : 1) * gravityHelp(this.fMiss).moon; // (the speed only changes while you are off it)
    this.phase = (this.phase + dt * this.moonK / this.M.period) % 1;
    if (this.onMoon && p.carry !== this.moonObj) this.onMoon = false;
    if (!this.onMoon && !p.carry && !this.jump && this.moonBackT <= 0 && this.scoops(p)) this.board();
    if (this.jump) {
      this.jump.t += dt;
      this.jump.lost = p.grav?.soft ? this.jump.lost + dt : 0;
      if (this.jump.t > 0.15 && p.onGround) {
        const on = p.grav?.planet, L = LENSES.find(x => x.planet === on);
        this.jump = null;
        if (L) {
          this.fMiss = 0; this.play('lensfound');
          if (st.lens[L.n]) this.toast(`🔭${CSS_FUN}`);
          else { this.addKey(lensKey(L.n + 1)); this.toast(WORDS.lens(this.state().lenses)); }
        } else this.fMiss++; // (back on the dock, or the Meadow Cube: walk back and ride again)
      } else if (this.jump && (this.jump.lost > CUBE_RULES.lost || this.jump.t > 8)) { this.jump = null; this.fMiss++; this.moonBackT = 0.3; }
    }
    if (this.moonBackT > 0) { this.moonBackT -= dt; if (this.moonBackT <= 0) { const s = this.dockSpot(); this.toast(WORDS.lost); this.puffTo({ pos: [s.x, s.y, s.z], frame: 0, look: [s.x - 5, s.y, s.z] }); } }
  }
  drawMoon() {
    const m = this.moonNow(), st = this.state();
    this.moonMesh.position.set(m.pos[0], m.pos[1], m.pos[2]);
    this.moonMesh.rotation.y = this.clock * 0.3;
    this.sunMesh.rotation.y = this.clock * 0.2;
    const all = st.lenses >= 3;
    LENSES.forEach((L, i) => { const g = this.lensMeshes[i]; g.visible = all || !st.lens[L.n]; g.userData.spin.rotation.y = this.clock * 1.2 + i; });
  }
  drawSprings(dt) {
    this.springs.forEach((g, k) => {
      this.boing[k] += dt;
      const t = this.boing[k], lift = t < 1.2 ? 0.55 * Math.exp(-t * 3.5) * Math.cos(t * 16) + 0.2 * Math.exp(-t * 3.5) : 0;
      g.userData.set(this.onSpring === k && t > 0.3 ? 1 : 0, lift);
    });
  }

  /* ---------------------------------------------- the frame ---------------------------------------------- */
  update(dt = 0) { if (!this.manual) this.step(dt); }
  step(dt) {
    const g = this.game, p = g.player;
    if (!p || g.world !== this.world) return;
    this.stars.position.copy(p.pos);
    if (g.inBattle && this.onMoon) this.getOff(true);
    const h = Math.min(dt, CUBE_RULES.dtMax);
    if (!this.paused()) {
      this.clock += h;
      this.stepPups(h);
      this.stepHop(h);
      this.stepMoon(h);
      this.setPads();
    }
    if ((p.caught || 0) > this.caught) { this.caught = p.caught; this.play('puff'); this.toast(WORDS.lost); }
    this.drawPups();
    this.drawMoon();
    this.drawSprings(h);
    this.refreshChip();
  }
  refreshChip() {
    const ui = this.game.ui;
    if (!ui?.setScore || this.game.world !== this.world) return;
    const st = this.state();
    const ready = st.done && !st.star;
    ui.setScore({ text: ready ? '⭐ Professor Orbit!' : `🐱 ${st.tags} / 3 · 🌸 ${st.hop ? 1 : 0} / 1 · 🔭 ${st.lenses} / 3`, done: ready });
  }

  // For tests: marks games as won (saved keys).
  winUpTo(tags, hop, lenses) {
    for (let n = 1; n <= tags; n++) this.addKey(tagKey(n));
    if (hop) this.addKey(HOP_KEY);
    for (let n = 1; n <= lenses; n++) this.addKey(lensKey(n));
  }
  info() {
    const p = this.game.player, m = this.moonNow();
    return {
      caught: this.caught, frame: p?.frameNo?.() ?? null,
      pups: this.pups.map(q => (q.run ? { s: q.run.s, dir: q.run.dir, speed: q.run.speed, spots: q.run.spots, tagR: q.run.tagR } : null)), pMiss: this.pMiss.slice(),
      flight: this.flight ? { ...this.flight } : null, hMiss: this.hMiss.slice(), hopLast: this.hopLast, pads: this.world.planets.map(w => w.pad || 0),
      moon: { pos: m.pos, vel: m.vel, speed: m.speed, phase: this.phase, k: this.moonK }, onMoon: this.onMoon, jump: this.jump ? { ...this.jump } : null, fMiss: this.fMiss,
      state: this.state(),
    };
  }
}
