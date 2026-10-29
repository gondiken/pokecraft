// Cube Planets: the live part (LIVE.gravity, world.parts from cubeland.js). The starry sky (one Points, never a block, never saved), which
// planets you stood on this visit, and the three skill games (rules: orbits.js; owner 2026-10-29 "easy to understand, hard to master"):
//  - the Orbikit Chase (the Crystal Cube, the Tree Cube, the Long Rock): a little comet cheetah runs its loop round the planet, its whole
//    loop dotted faintly on the faces and a bright sparkly trail behind it. Touch it (or Tag! within reach) to tag it: pw:gravity:tag1..3.
//  - the Planet Hop (the Flower Cube, then four pebbles): Jump on a launch flower (player.js launchAt) and land on the next pebble; a flight
//    that lands anywhere else is a miss and a puff takes you back. The last pebble saves pw:gravity:hop. Blue home flowers puff you home.
//  - the Moon Ride (the Moon Base): Hop on! the moon at its stop, Jump to get off with the moon's speed; land in the gold ring:
//    pw:gravity:ring1..3, one ring at a time.
// Never a fail (a miss tries again), kind help only through orbits.js gravityHelp (= kindhelp.js), a harder rematch when you hold the star
// (orbits.js HARD). Once all are won every game plays on just for fun (forfun.js) and saves nothing new. A won battle with Professor Orbit
// clears the seven keys (battleEnded). Clocks are summed frame dt with fixed sub-steps (orbits.js STEP) and stand still in a battle, an
// ask, a panel or the pause. `manual` + step(dt) for tests; info() for tests.
import * as THREE from 'three';
import { sound } from './sound.js';
import { buildModel, animateModel, disposeModel } from './species.js';
import { sketchModel } from './sketch.js';
import { PLANETS, P, PUPS, FLOWERS, HOME_FLOWERS, MOON, RINGS, BOXES, tagKey, HOP_KEY, ringKey, GRAVITY_KEYS, gravityState, sizeOf } from './cubeland.js';
import { GRAV, upOf, downOf, frameOf, toLocal } from './gravity.js';
import { PupRun, PUP, loopNearest, loopAt, moonAt, jumpOff, ringHit, gravityHelp, HARD, STEP } from './orbits.js';
import { ForFun, FUN } from './forfun.js';
import { kindHelp } from './kindhelp.js';
import { buildFlower, buildMoon, buildRing, buildDots } from './cubeprops.js';

const STARS = 700, R = 240;
export const CUBE_RULES = { dtMax: 0.1, sayGap: 3, back: 1.0, homeAfter: 0.6, retagAfter: 3, boardR: 2.6, trail: 14, trailGap: 0.32, dotGap: 0.9 };
const WORDS = {
  side: 'You walked round the edge! Down is wherever your feet are.',
  bottom: 'Upside down under a planet! Look: the sky is below you.',
  pup: '🐱 Tag the Orbikit! Too fast to chase: wait round a corner on its sparkly trail.',
  seen: 'It saw you and ran back! Hide round a corner on its trail.',
  sprint: 'Too fast to chase! Get ahead of it round a corner.',
  tagged: n => `🐱 Tagged! You caught the Orbikit. (🐱 ${n} / 3)`,
  flower: '🌸 Stand on the flower and jump! Land on the next pebble.',
  flowerHow: 'Stand still, walk or run onto the flower, then Jump. Each pebble needs its own!',
  hopMiss: 'Whoosh! Not that one. Back you go. Try a different run!',
  hopLand: name => `🌸 You landed on the ${name}!`,
  hopDone: '🌸 You hopped every pebble! Captain Comet is on the Last Pebble.',
  home: 'Whoosh! Home to the Meadow Cube.',
  moon: '🌙 Hop on the moon at its stop! Jump off into the gold ring.',
  ride: 'You keep the moon\'s speed! Jump BEFORE you are over the ring.',
  ringMiss: 'Missed! The moon was still moving you. Try jumping earlier or later.',
  ringHit: (n, done) => (done ? '🌙 Bullseye! Every ring done! Moon Mechanic Milo wants to see you.' : `🌙 Bullseye! (🌙 ${n} / 3) Hop on for the next ring.`),
};
const CSS_FUN = ` ${FUN.tag}`;

export class CubeLive {
  constructor(game, part) {
    this.game = game; this.part = part; this.world = game.world; this.scene = game.scene;
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;
    this.visited = new Set();
    this.told = {}; this.said = new Map(); this.clock = 0;
    this.caught = 0;
    // the Orbikit Chase
    this.pups = PUPS.map(() => ({ run: null, tagT: -99 }));
    this.pMiss = [0, 0, 0]; this.tagPress = false;
    // the Planet Hop
    this.flight = null; this.hMiss = FLOWERS.map(() => 0); this.backT = 0; this.backTo = null; this.moonBackT = 0; this.homeT = 0; this.hopLast = -1;
    // the Moon Ride
    this.moonT = 0; this.moonK = 1; this.onMoon = false; this.jump = null; this.mMiss = [0, 0, 0]; this.mFun = new ForFun(RINGS.length); this.ringNow = 0;
    this.M = { ...MOON, top: BOXES[MOON.base].y1 };
    this.moonObj = this.makeMoonObj();
    this.groups = [];
    this.buildSky();
    this.build();
  }
  get hard() { return !!this.game.stars?.includes('gravity'); }
  state() { return gravityState(this.game); }
  paused() { const g = this.game; return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing()); }
  toast(m) { this.game.ui?.toast(m); }
  once(key, m) { if (this.told[key]) return; this.told[key] = true; this.toast(m); }
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
    const M4 = new THREE.Matrix4();
    loopDots.forEach(([p, u], i) => this.loopDots.userData.mesh.setMatrixAt(i, M4.makeTranslation(p[0] + u[0] * 0.04, p[1] + u[1] * 0.04, p[2] + u[2] * 0.04)));
    this.loopDots.userData.mesh.instanceMatrix.needsUpdate = true;
    this.trail = add(buildDots(PUPS.length * CUBE_RULES.trail, 0xffd84a, 0.14));
    // the flowers (pink: launch; blue: home), turned to their face's up
    this.flowerMeshes = FLOWERS.map(f => {
      const g = add(buildFlower(false)), up = [0, 0, 0]; up[f.axis] = f.sign;
      const c = f.cell.map(v => v + 0.5); c[f.axis] = f.sign > 0 ? f.cell[f.axis] + 1 : f.cell[f.axis];
      g.position.set(c[0], c[1], c[2]); g.quaternion.copy(Q.setFromUnitVectors(Y, new THREE.Vector3(...up)));
      return g;
    });
    this.homeMeshes = HOME_FLOWERS.map(h => { const g = add(buildFlower(true)); g.position.set(h.cell[0] + 0.5, h.cell[1] + 1, h.cell[2] + 0.5); return g; });
    // the moon and the ring
    this.moonMesh = add(buildMoon(MOON.half));
    this.ringMesh = add(buildRing(RINGS[0].r));
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
    for (const b of BOXES) { const w = this.world.planets?.find(x => x.id === b.id); if (w) w.pad = 0; }
  }

  /* ---------------------------------------------- the moon you ride ---------------------------------------------- */
  makeMoonObj() {
    const me = this;
    return {
      where: () => { const m = me.moonNow(); return { x: m.pos[0], y: m.pos[1], z: m.pos[2] }; },
      wantsLeave(space) { const fresh = !!space && !me.spaceWas; me.spaceWas = !!space; return fresh; },
      leave() { me.jumpOffMoon(); },
      jumpWord: () => 'Jump!',
      safe: () => ({ x: me.M.cx + me.M.rx + 2.5, y: me.M.top, z: me.M.cz }),
    };
  }
  moonNow() { return moonAt(this.M, this.moonT, this.moonK); }
  nearMoon(pos) { const m = this.moonNow(); return m.stopped && Math.hypot(pos.x - m.pos[0], pos.z - m.pos[2]) < CUBE_RULES.boardR && Math.abs(pos.y - m.pos[1]) < 3; }
  board() {
    const g = this.game, p = g.player;
    g.riding?.stop?.('quiet');
    this.onMoon = true; this.spaceWas = true; this.jump = null;
    p.carry = this.moonObj; p.vel.set(0, 0, 0);
    const w = this.moonObj.where(); p.pos.set(w.x, w.y, w.z);
    this.play('moonhop');
    this.say('ride', WORDS.ride, 6);
  }
  // Jump off: you keep the moon's speed (orbits.js jumpOff); the next landing is judged (stepMoon)
  jumpOffMoon() {
    const p = this.game.player, m = this.moonNow(), v = jumpOff(m.vel, GRAV.jump);
    if (p.carry === this.moonObj) p.carry = null;
    p.vel.set(v[0], v[1], v[2]); p.onGround = false;
    this.onMoon = false;
    this.jump = { ring: this.ringRound(), t: 0, from: m.pos.slice() };
    this.play('flowerpop');
  }
  getOff(safe = true) {
    const p = this.game.player;
    if (p?.carry === this.moonObj) { p.carry = null; if (safe) { const s = this.moonObj.safe(); p.pos.set(s.x, s.y, s.z); } p.vel.set(0, 0, 0); }
    this.onMoon = false;
  }
  ringRound() { return this.mFun.round(this.state().rings); }

  /* ---------------------------------------------- the live-part hooks ---------------------------------------------- */
  near(p = this.game.player) {
    if (!p || this.game.inBattle || this.game.world !== this.world) return null;
    if (this.onMoon) return this.moonNow().stopped ? 'Hop off' : null;
    if (p.carry) return null;
    if (this.pupNear(p) >= 0) return 'Tag!';
    if (this.nearMoon(p.pos)) return 'Hop on!';
    return null;
  }
  use(p = this.game.player) {
    const w = this.near(p);
    if (w === 'Tag!') { this.tagPress = true; return true; }
    if (w === 'Hop on!') { this.board(); return true; }
    if (w === 'Hop off') { this.getOff(true); return true; }
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
  // The guide's words while a game is going on (cubeland.js cubeAim asks first). `at(worldPoint, text)` makes an arrow on your face.
  aim(p, at) {
    const pl = this.game.player, gd = pl?.grav;
    if (!gd || !at) return null;
    const st = this.state();
    const pi = PUPS.findIndex(q => q.planet === gd.planet);
    if (pi >= 0 && (!st.tag[pi] || this.pups[pi].run)) return { text: () => `${WORDS.pup}${st.tag[pi] ? CSS_FUN : ''}` };
    const f = FLOWERS.find(x => x.planet === gd.planet);
    if (f && (!st.hop || this.flight || this.hopLast >= 0)) {
      const c = f.cell.map(v => v + 0.5); c[f.axis] = f.sign > 0 ? f.cell[f.axis] + 1 : f.cell[f.axis];
      if (Math.hypot(c[0] - p.x, c[1] - p.y, c[2] - p.z) < 1.2) return { text: () => `🌸 ${WORDS.flowerHow}` };
      return at(c, (a, m) => `🌸 Jump on the flower! Land on the ${PLANETS[f.to].name} ${a} ${m}m${st.hop ? CSS_FUN : ''}`);
    }
    if (gd.planet === P.base && (st.rings < 3 || this.onMoon || this.jump)) {
      if (this.onMoon) return { text: () => `🌙 ${WORDS.ride}` };
      const m = this.moonNow(), stop = [this.M.cx + this.M.rx, this.M.top, this.M.cz];
      if (Math.hypot(stop[0] - p.x, stop[2] - p.z) < 3.5) return { text: () => (m.stopped ? '🌙 Hop on! (the moon is at its stop)' : '🌙 Wait here: the moon stops right here.') };
      return at(stop, (a, m2) => `🌙 The moon stop: hop on the moon ${a} ${m2}m${st.rings >= 3 ? CSS_FUN : ''}`);
    }
    return null;
  }
  battleEnded(result, opts) {
    const pic = opts?.picture;
    if (pic?.id !== 'gravity' || pic.crew != null || result !== 'won') return;
    const g = this.game; // a won battle with Professor Orbit clears the seven keys: a rematch plays the games again (harder)
    for (const k of GRAVITY_KEYS) { const at = g.beaten.indexOf(k); if (at >= 0) g.beaten.splice(at, 1); }
    this.pMiss = [0, 0, 0]; this.hMiss = FLOWERS.map(() => 0); this.mMiss = [0, 0, 0];
    this.pups.forEach(q => { q.run = null; });
    this.save();
  }

  /* ---------------------------------------------- the Orbikit Chase ---------------------------------------------- */
  seen(from, to) { // nothing solid between the Orbikit's eyes and you (trees hide you)
    const w = this.world, d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], L = Math.hypot(...d), n = Math.ceil(L / 0.25);
    for (let i = 1; i < n; i++) { const k = i / n; if (w.isSolid(Math.floor(from[0] + d[0] * k), Math.floor(from[1] + d[1] * k), Math.floor(from[2] + d[2] * k))) return false; }
    return true;
  }
  stepPups(dt) {
    const p = this.game.player, gd = p.grav, st = this.state(), up = upOf(p.frameNo?.() ?? 0);
    const press = this.tagPress; this.tagPress = false;
    PUPS.forEach((q, i) => {
      const P_ = this.pups[i], mine = !!gd && gd.planet === q.planet && gd.field && !p.carry;
      if (!P_.run && mine && this.clock - P_.tagT >= CUBE_RULES.retagAfter) { // a new round: it starts on the far side of its loop from you
        const box = BOXES[q.planet], tmp = new PupRun(q.loop, box), s0 = loopNearest(tmp.L, [p.pos.x, p.pos.y, p.pos.z]).s;
        P_.run = new PupRun(q.loop, box, { base: q.base, boost: q.boost, help: this.pMiss[i], hard: this.hard, start: s0 + tmp.L.total / 2, seen: (a, b) => this.seen(a, b) });
        this.say(`pup${i}`, `${WORDS.pup}${st.tag[i] ? CSS_FUN : ''}`, 30);
      }
      const r = P_.run;
      if (!r) return;
      const ev = r.update(dt, { mine, feet: [p.pos.x, p.pos.y, p.pos.z], up, face: gd ? [gd.axis, gd.sign] : null, press: press && mine });
      for (const e of ev) {
        if (e.type === 'tag') {
          P_.tagT = this.clock; P_.run = null; this.pMiss[i] = 0;
          this.play('orbitag');
          if (st.tag[i]) this.toast(`🐱 Tagged again!${CSS_FUN}`);
          else { this.addKey(tagKey(i + 1)); const n = this.state().tags; this.toast(WORDS.tagged(n)); if (n === 3) this.toast('🐱 All three! Stargazer Stella is on the Long Rock.'); }
        } else if (e.type === 'spotted') {
          this.pMiss[i]++; this.play('orbiseen');
          this.say('seen', `${WORDS.seen}${kindHelp(this.pMiss[i]).on ? ' (It is a little slower now.)' : ''}`);
          r.boost = q.boost * (this.hard ? HARD.pup : 1) * gravityHelp(this.pMiss[i]).sprint; r.tagR = PUP.tagR * gravityHelp(this.pMiss[i]).tag; r.button = PUP.button * gravityHelp(this.pMiss[i]).tag; // (the kind help grows within the round)
        } else if (e.type === 'sprint') this.say('sprint', WORDS.sprint, 8);
      }
    });
  }
  drawPups(dt) {
    const M4 = new THREE.Matrix4(), Z = new THREE.Matrix4().makeScale(0, 0, 0), T = this.trail.userData.mesh, n = CUBE_RULES.trail;
    const X = new THREE.Vector3(), Yv = new THREE.Vector3(), Zv = new THREE.Vector3();
    PUPS.forEach((q, i) => {
      const r = this.pups[i].run, m = this.pupModels[i];
      const at = r ? r.at : null;
      for (let k = 0; k < n; k++) {
        if (!r) { T.setMatrixAt(i * n + k, Z); continue; }
        const b = loopAt(r.L, r.s - r.dir * (k + 1) * CUBE_RULES.trailGap), lift = 0.12 + 0.05 * Math.sin(this.clock * 9 + k);
        const sc = 1 - k / n;
        M4.makeScale(sc, sc, sc).setPosition(b.pos[0] + b.up[0] * lift, b.pos[1] + b.up[1] * lift, b.pos[2] + b.up[2] * lift);
        T.setMatrixAt(i * n + k, M4);
      }
      if (!m) return;
      if (!r) { // napping on its loop's start until you come to its planet (or right after a tag)
        const a = loopAt(this.loops[i], 0);
        Yv.set(...a.up); Zv.set(...a.dir); X.crossVectors(Yv, Zv);
        m.position.set(...a.pos); m.quaternion.setFromRotationMatrix(M4.makeBasis(X, Yv, Zv));
        animateModel(m, this.clock + i, false);
        return;
      }
      const h = r.heading();
      Yv.set(...at.up); Zv.set(h[0], h[1], h[2]); X.crossVectors(Yv, Zv);
      m.position.set(...at.pos); m.quaternion.setFromRotationMatrix(M4.makeBasis(X, Yv, Zv));
      animateModel(m, this.clock * (r.speed / 4) + i, true);
    });
    T.instanceMatrix.needsUpdate = true;
  }

  /* ---------------------------------------------- the Planet Hop ---------------------------------------------- */
  flowerUnder(pos) { // the launch flower whose pad you stand on (or stood on last)
    return FLOWERS.findIndex(f => { const c = f.cell.map(v => v + 0.5); c[f.axis] = f.sign > 0 ? f.cell[f.axis] + 1 : f.cell[f.axis]; return Math.hypot(c[0] - pos.x, c[1] - pos.y, c[2] - pos.z) < 1.3; });
  }
  setPads(k) { // the kind help (and the rematch's harder pull) on the target of flower k only
    for (const w of this.world.planets) w.pad = 0;
    if (k < 0) return;
    const t = this.world.planets[FLOWERS[k].to];
    t.pad = gravityHelp(this.hMiss[k]).pad + (this.hard ? HARD.pad : 0);
  }
  stepHop(dt) {
    const p = this.game.player, st = this.state();
    if (p.launched) {
      const k = this.flowerUnder(p.lastFace?.pos ?? p.pos);
      p.launched = 0;
      if (k >= 0) { this.flight = { k, t: 0 }; this.play('flowerpop'); this.flowerMeshes[k].userData.boing = 0.4; }
    }
    if (this.flight) {
      const f = FLOWERS[this.flight.k];
      this.flight.t += dt;
      if (this.flight.t > 0.15 && p.onGround) {
        const k = this.flight.k, on = p.grav?.planet;
        this.flight = null;
        if (on === f.to) {
          this.hMiss[k] = 0; this.play('pebbleland'); this.hopLast = k;
          const last = k === FLOWERS.length - 1;
          if (last && !st.hop) { this.addKey(HOP_KEY); this.toast(WORDS.hopDone); }
          else if (last) this.toast(`🌸 Every pebble again!${CSS_FUN}`);
          else this.toast(WORDS.hopLand(PLANETS[f.to].name));
          this.setPads(FLOWERS.findIndex(x => x.planet === f.to));
        } else {
          this.hMiss[k]++;
          if (on === f.planet) this.say('hopback', `You came down on the same pebble. ${WORDS.flowerHow}`);
          else { this.backT = CUBE_RULES.back; this.backTo = k; this.toast(`${WORDS.hopMiss}${kindHelp(this.hMiss[k]).on ? ' (The pebble pulls a little harder now.)' : ''}`); }
          this.setPads(k);
        }
      } else if (this.flight && this.flight.t > 6) { this.flight = null; }
    } else {
      const k = FLOWERS.findIndex(f => f.planet === p.grav?.planet);
      if (k !== this.padsFor) { this.padsFor = k; this.setPads(k); }
    }
    if (this.backT > 0 && typeof this.backTo === 'number') {
      this.backT -= dt;
      if (this.backT <= 0) this.puffTo(this.flowerStand(this.backTo));
    }
    // a home flower: stand on it a moment and you are puffed home
    const home = this.world.homeAt?.(p.pos, p.frameNo?.() ?? 0);
    if (home && p.onGround) { this.homeT += dt; if (this.homeT >= CUBE_RULES.homeAfter) { this.homeT = 0; this.flight = null; this.toast(WORDS.home); this.puffTo(this.homeStand()); } } else this.homeT = 0;
  }
  // where to put you back for flower k: 2 blocks before it on its face, facing it
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

  /* ---------------------------------------------- the Moon Ride ---------------------------------------------- */
  stepMoon(dt) {
    const p = this.game.player, st = this.state();
    this.moonT += dt;
    const now = this.moonNow();
    if (now.stopped) { // a new lap: the kind help / the rematch's speed only change while it waits at its stop
      const k = (this.hard ? HARD.moon : 1) * gravityHelp(this.mMiss[this.ringRound()]).moon;
      if (k !== this.moonK) { const v = ((this.moonT % now.cycle) + now.cycle) % now.cycle; this.moonK = k; this.moonT = Math.min(v, this.M.stop - 1e-6); } // (a fresh lap from the stop)
    }
    if (this.onMoon && p.carry !== this.moonObj) this.onMoon = false;
    if (this.jump) {
      this.jump.t += dt;
      if (this.jump.t > 0.15 && p.onGround) {
        const r = this.jump.ring, ring = RINGS[r], gd = p.grav, k = gravityHelp(this.mMiss[r]).ring;
        const hit = gd?.planet === P.base && gd.axis === 1 && gd.sign === 1 && ringHit(ring, [p.pos.x, p.pos.y, p.pos.z], k);
        this.jump = null;
        if (hit) {
          this.mMiss[r] = 0; this.play('ringstar');
          if (this.mFun.done(st.rings)) { this.mFun.won(r, st.rings); this.toast(`🌙 Bullseye!${CSS_FUN}`); }
          else { this.addKey(ringKey(r + 1)); const n = this.state().rings; this.toast(WORDS.ringHit(n, n >= 3)); }
        } else {
          this.mMiss[r]++;
          this.toast(`${WORDS.ringMiss}${kindHelp(this.mMiss[r]).on ? ' (The moon is a little slower now.)' : ''}`);
          this.moonBackT = CUBE_RULES.back + 0.3;
        }
      } else if (this.jump && this.jump.t > 6) this.jump = null;
    }
    if (this.moonBackT > 0) { this.moonBackT -= dt; if (this.moonBackT <= 0) { const s = this.moonObj.safe(); this.puffTo({ pos: [s.x, s.y, s.z], frame: 0, look: [this.M.cx + this.M.rx, s.y, this.M.cz] }); } }
  }
  drawMoon() {
    const m = this.moonNow();
    this.moonMesh.position.set(m.pos[0], m.pos[1], m.pos[2]);
    this.moonMesh.rotation.y = -m.phi;
    const st = this.state(), r = this.ringRound(), ring = RINGS[r], show = st.rings < 3 || this.mFun.done(st.rings);
    this.ringMesh.visible = show;
    if (show) {
      const k = gravityHelp(this.mMiss[r]).ring;
      this.ringMesh.position.set(ring.x, this.M.top, ring.z); this.ringMesh.scale.set(k, 1, k);
      this.ringMesh.userData.glow.opacity = 0.2 + 0.12 * Math.sin(this.clock * 4);
    }
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
    }
    this.visit(p);
    this.drawPups(h);
    this.drawMoon();
    for (const fm of this.flowerMeshes) { const b = fm.userData.boing ?? 0; fm.userData.boing = Math.max(0, b - h); fm.userData.head.position.y = 0.52 + Math.sin(b * 20) * b * 0.4; }
    this.refreshChip();
  }
  visit(p) {
    const g = this.game, gd = p.grav;
    if (gd && p.onGround && gd.field) {
      if (!this.visited.has(gd.planet)) {
        const first = this.visited.size > 0;
        this.visited.add(gd.planet);
        if (first && !PLANETS[gd.planet].role.startsWith('hop')) { const Pl = PLANETS[gd.planet]; g.ui?.toast(`${Pl.emoji} You hopped to the ${Pl.name}! Its pull caught you.`); }
      }
      if ((gd.axis !== 1 || gd.sign !== 1)) this.once('side', WORDS.side);
      if (gd.axis === 1 && gd.sign === -1) this.once('bottom', WORDS.bottom);
    }
    if ((p.caught || 0) > this.caught) {
      this.caught = p.caught;
      this.play('puff');
      g.ui?.toast('Poof! Space caught you and put you back where you stood.');
    }
  }
  refreshChip() {
    const ui = this.game.ui;
    if (!ui?.setScore || this.game.world !== this.world) return;
    const st = this.state();
    const ready = st.done && !st.star;
    ui.setScore({ text: ready ? '🪐 Professor Orbit is waiting on the Great Cube!' : `🐱 ${st.tags} / 3 · 🌸 ${st.hop ? 1 : 0} / 1 · 🌙 ${st.rings} / 3`, done: ready });
  }

  // For tests: marks games as won (saved keys).
  winUpTo(tags, hop, rings) {
    for (let n = 1; n <= tags; n++) this.addKey(tagKey(n));
    if (hop) this.addKey(HOP_KEY);
    for (let n = 1; n <= rings; n++) this.addKey(ringKey(n));
  }
  info() {
    const p = this.game.player, m = this.moonNow();
    return {
      visited: [...this.visited], caught: this.caught, frame: p?.frameNo?.() ?? null,
      pups: this.pups.map(q => (q.run ? { s: q.run.s, dir: q.run.dir, speed: q.run.speed, spots: q.run.spots, tagR: q.run.tagR } : null)), pMiss: this.pMiss.slice(),
      flight: this.flight ? { ...this.flight } : null, hMiss: this.hMiss.slice(), hopLast: this.hopLast, pads: this.world.planets.map(w => w.pad || 0),
      moon: { pos: m.pos, vel: m.vel, stopped: m.stopped, t: this.moonT, k: this.moonK }, onMoon: this.onMoon, jump: this.jump ? { ...this.jump } : null, mMiss: this.mMiss.slice(), ring: this.ringRound(),
      state: this.state(),
    };
  }
}
