// T40c: the live part of the Race Track (LIVE.race): talk to Racer Rio and race him round the track, 3 laps. The race is the gate to his
// Boss battle (the base's pictureboss.js): win it, then talk to him again for the battle. Everything here is per player and in memory:
// nothing is saved or sent, no block is ever edited (lamps and boost pads are drawn with world.setLive through LiveCells).
//
// States: idle (Rio on his stand) -> count (on the grid, lamps 3-2-1-GO) -> race (flags, laps, boost pads) -> done (the result, Rio drives
// on) -> idle. Rio's position is a closed form of one number, bossS (racetrack.js bossSpeed); clocks are summed frame dt and stand still
// in a battle, a question, a panel and the pause screen. With the star, two karts drive laps forever, the pads pulse and the lamps cycle.
import * as THREE from 'three';
import { B } from './blocks.js';
import { LiveCells } from './livecells.js';
import { sound } from './sound.js';
import { RACE, bossSpeed } from './racetrack.js';

export const RACE_LINES = {
  hello: "Vroom! I'm Racer Rio. Nobody has raced here since the festival stopped. Race me? Three laps!",
  win: "Wow, you're fast! Now talk to me for a battle!",   // you won the race
  lose: 'I win! That was close. Race again?',             // you lost the race
  again: 'Race me again? This time I go full speed!',      // with the star
};
const TIPS = ['', 'Tip: hit the boost pads and take the corners on the inside!', 'Tip: ride a creature to go even faster!'];
const ordinal = n => (n === 1 ? '1st' : '2nd');

/* ------------------------------ the karts (a few merged boxes, no creature models) ------------------------------ */

// Boxes [{ w, h, d, x, y, z, c }] merged into one geometry with vertex colours (one draw call).
function mergeBoxes(list) {
  const pos = [], nor = [], col = [], idx = [], c = new THREE.Color();
  let base = 0;
  for (const b of list) {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    g.translate(b.x, b.y, b.z);
    const p = g.attributes.position, n = g.attributes.normal;
    c.setHex(b.c);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    for (const i of g.index.array) idx.push(base + i);
    base += p.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
const bx = (w, h, d, x, y, z, c) => ({ w, h, d, x, y, z, c });

// A go-kart facing +z, feet on y 0: body colour, accent (side pods, wing), optionally a little driver. group.userData.wheels spin round x.
export function buildKart({ body = 0xff8a2a, accent = 0xffffff, driver = null } = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }), group = new THREE.Group();
  const parts = [
    bx(1.0, 0.2, 1.8, 0, 0.3, 0, body), bx(0.6, 0.22, 0.6, 0, 0.36, 1.05, body), bx(0.14, 0.03, 1.7, 0, 0.42, 0.5, 0xffffff),
    bx(0.2, 0.3, 0.9, -0.56, 0.4, 0, accent), bx(0.2, 0.3, 0.9, 0.56, 0.4, 0, accent),
    bx(0.7, 0.5, 0.14, 0, 0.68, -0.62, 0x2a2a34),
    bx(0.06, 0.4, 0.06, -0.3, 0.6, -0.9, 0x2a2a34), bx(0.06, 0.4, 0.06, 0.3, 0.6, -0.9, 0x2a2a34), bx(1.1, 0.06, 0.3, 0, 0.82, -0.9, accent),
    bx(0.5, 0.06, 0.06, 0, 0.5, 0.45, 0x2a2a34), // the steering bar
  ];
  if (driver != null) parts.push(bx(0.42, 0.42, 0.26, 0, 0.7, -0.25, driver), bx(0.36, 0.36, 0.36, 0, 1.1, -0.25, driver), bx(0.3, 0.12, 0.04, 0, 1.1, -0.06, 0x7ac8ff), bx(0.12, 0.03, 0.38, 0, 1.3, -0.25, 0xffffff));
  const hull = new THREE.Mesh(mergeBoxes(parts), mat);
  group.add(hull);
  const wheelGeo = mergeBoxes([bx(0.28, 0.56, 0.4, 0, 0, 0, 0x22222c), bx(0.28, 0.4, 0.56, 0, 0, 0, 0x22222c), bx(0.3, 0.12, 0.34, 0, 0, 0, 0xd8d8e0), bx(0.3, 0.34, 0.12, 0, 0, 0, 0xd8d8e0)]);
  const wheels = [];
  for (const [x, z] of [[-0.62, 0.7], [0.62, 0.7], [-0.62, -0.6], [0.62, -0.6]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.28, z);
    w.add(new THREE.Mesh(wheelGeo, mat));
    group.add(w);
    wheels.push(w);
  }
  group.userData.wheels = wheels;
  group.userData.geos = [hull.geometry, wheelGeo];
  group.userData.mat = mat;
  return group;
}
function disposeKart(g) {
  if (!g) return;
  g.parent?.remove(g);
  for (const geo of g.userData.geos || []) geo.dispose();
  g.userData.mat?.dispose();
}
// Put a kart on the track: position, heading, wheels turning with the distance it has driven.
function placeKart(kart, at, y, dist) {
  kart.position.set(at.x, y, at.z);
  kart.rotation.y = at.heading;
  for (const w of kart.userData.wheels) w.rotation.x = dist / 0.28;
}

/* ------------------------------ the live part ------------------------------ */

// The 2D segment prev -> cur against the gate line a-b: +1 forwards through it, -1 backwards, 0 not through.
export function crossing(prev, cur, gate) {
  const d1x = cur.x - prev.x, d1z = cur.z - prev.z, d2x = gate.b[0] - gate.a[0], d2z = gate.b[1] - gate.a[1];
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return 0;
  const ex = gate.a[0] - prev.x, ez = gate.a[1] - prev.z;
  const t = (ex * d2z - ez * d2x) / den, u = (ex * d1z - ez * d1x) / den;
  if (t < 0 || t >= 1 || u < 0 || u > 1) return 0;
  return d1x * gate.dir[0] + d1z * gate.dir[1] > 0 ? 1 : -1;
}

export class RaceLive {
  constructor(game, part) {
    this.game = game;
    this.part = part;
    this.track = part.track;
    this.cells = new LiveCells(game.world, () => game.player);
    this.playing = () => (game.playing ? game.playing() : true); // tests replace it (no pointer lock there)
    this.manual = false;                                          // tests set it and call step(dt) themselves
    this.state = 'idle';
    this.clock = 0; this.countT = 0; this.doneT = 0;
    this.bossS = RACE.grid; this.P = RACE.grid; this.lap = 0; this.next = 0;
    this.losses = 0; this.won = false;
    this.beeped = 0; this.waitToldAt = -1; this.wrongAt = -1e9; this.missedFor = -1; this.missed = false;
    this.prev = null; this.zoom = null; this.zoomCool = 0;
    this.lamps = null; this.padLit = null;      // what is drawn now (only changes are written)
    this.greenAt = -1;
    this.kart = null; this.paradeKarts = null; this.paradeClock = 0; this.parade = false; this.driven = 0;
    this.result = null;
  }

  /* ---- helpers ---- */
  rio() {
    const list = this.game.npcs?.list;
    if (this.rioNpc && list?.includes(this.rioNpc)) return this.rioNpc;
    return (this.rioNpc = list?.find(n => n.kind === 'boss' && n.def?.id === 'race') ?? null);
  }
  isRio(npc) { return npc?.kind === 'boss' && npc.def?.id === 'race'; }
  paused() {
    const g = this.game;
    return !!(g.inBattle || g.ui?.asking || g.ui?.panelOpen || !this.playing());
  }
  inBox(pos) { const b = this.part.box; return pos.x >= b.x0 && pos.x < b.x1 + 1 && pos.z >= b.z0 && pos.z < b.z1 + 1; }
  toast(m) { this.game.ui?.toast(m); }
  say(m) { this.toast(`Racer Rio: ${m}`); }
  hasStar() { return this.game.stars?.includes('race'); }

  /* ---- hooks of the live-part interface ---- */
  talk(npc) {
    if (!this.isRio(npc)) return false;
    if (this.state === 'count' || this.state === 'race') return true;      // talking does nothing during the race
    if (this.won) return false;                  // the base's Boss battle (or the rematch question), also right after the finish
    if (this.state === 'done') this.backToStand(); // a lost race: Rio comes back at once for the next one
    return this.start();
  }
  talkPrompt(npc) {
    if (!this.isRio(npc)) return null;
    if (this.state === 'count') return { verb: 'wait', action: 'Ready...' };
    if (this.state === 'race') return { verb: 'race', action: 'Go go go!' };
    if (this.won) return null;                   // the base's Challenge! / Rematch!
    return { verb: 'race', action: this.losses > 0 ? 'Race again!' : 'Race!' };
  }
  battleEnded(result, opts) {
    const pic = opts?.picture;
    if (pic?.id !== 'race' || pic.crew != null) return;     // only Rio's own battle (the first one or a rematch)
    if (result === 'won') { this.won = false; this.losses = 0; }
  }
  // The guide arrow (realms.aim asks live parts first). Null outside the race area unless racing.
  aim(p) {
    const racing = this.state === 'count' || this.state === 'race';
    if (!racing && !this.inBox(p)) return null;
    const t = this.track;
    if (this.state === 'count') { const g = t.gates[0]; return { x: g.x, z: g.z, text: () => 'Get ready...' }; }
    if (this.state === 'race') {
      const g = t.gates[this.next % 4];
      const first = this.P >= this.bossS;
      if (this.missed) return { x: g.x, z: g.z, text: (a, m) => `🚩 Go back to the flag! ${a} ${m}m` };
      const last = this.lap >= RACE.laps - 1;
      return { x: g.x, z: g.z, text: (a, m) => `🚩 ${last ? 'Last lap!' : `Lap ${this.lap + 1}/${RACE.laps}`} · You're ${ordinal(first ? 1 : 2)}! ${a} ${m}m` };
    }
    const n = this.rio();
    if (!n) return null;
    const star = this.hasStar();
    return { x: n.pos.x, z: n.pos.z, text: (a, m) => (this.won ? `🏆 You won the race! Talk to Rio to battle ${a} ${m}m` : star ? `⭐ Race Rio again any time! ${a} ${m}m` : `🏎️ Race Racer Rio ${a} ${m}m`) };
  }

  // Standing on a boost pad: zoom 5 blocks along the track.
  stand(x, y, z, id) {
    if ((id !== B.BOOST_PAD && id !== B.BOOST_PAD_LIT) || this.zoom || this.zoomCool > 0 || this.paused()) return;
    const pad = this.part.pads.find(p => p.cells.some(c => c[0] === x && c[1] === z));
    if (!pad) return;
    this.zoom = { axis: pad.dir[0] ? 'x' : 'z', sign: pad.dir[0] || pad.dir[1], left: RACE.boost.dist };
    sound.play('boostzoom');
    const g = this.game;
    if (!g.toldOnce?.has('boost')) { g.toldOnce?.add('boost'); this.toast('Zoom! Boost pads make you fast.'); }
  }

  /* ---- the race ---- */
  start() {
    const g = this.game, p = g.player;
    if (g.hideSeek?.active) { this.toast('Finish hide and seek first!'); return true; }
    const grid = this.part.grid;
    p.pos.set(grid.player[0], grid.player[1], grid.player[2]);
    p.vel.set(0, 0, 0);
    p.yaw = grid.yaw; p.pitch = 0;
    this.zoom = null;
    this.state = 'count';
    this.countT = 0; this.beeped = 0; this.waitToldAt = -1;
    this.bossS = RACE.grid; this.P = RACE.grid; this.lap = 0; this.next = 0; this.clock = 0;
    this.missed = false; this.missedFor = -1; this.prev = null; this.driven = 0;
    const n = this.rio();
    if (n) { n.steer = true; n.moving = false; n.pos.set(grid.boss[0], grid.boss[1] + 0.35, grid.boss[2]); n.heading = n.homeHeading = grid.heading; }
    this.ensureKart();
    this.drawKart();
    this.say(this.hasStar() ? RACE_LINES.again : RACE_LINES.hello);
    return true;
  }

  ensureKart() {
    if (this.kart) return;
    this.kart = buildKart({ body: 0xff8a2a, accent: 0xffffff });
    this.game.scene?.add(this.kart);
  }
  // Rio sits in the kart at his lane: the kart under him (his feet 0.35 up, inside the open tub).
  drawKart() {
    const n = this.rio();
    if (!this.kart || !n) return;
    this.kart.visible = true;
    placeKart(this.kart, { x: n.pos.x, z: n.pos.z, heading: n.heading }, n.pos.y - 0.35, this.driven);
  }
  hideKart() { if (this.kart) this.kart.visible = false; }

  // Rio goes back to his stand, the kart goes away, nothing is left drawn.
  backToStand() {
    const n = this.rio(), b = this.game.world.bosses?.find(q => q.id === 'race');
    if (n && b) { n.steer = false; n.moving = false; n.pos.set(b.pos[0], b.pos[1], b.pos[2]); n.heading = n.homeHeading = b.heading; n.model.position.copy(n.pos); n.model.rotation.y = n.heading; }
    this.hideKart();
    this.state = 'idle';
    this.zoom = null;
    const p = this.game.player; if (p) { p.forceSprint = false; p.speedK = 1; p.speedCap = null; } // the race's pace ends with it
  }

  finish(youWon) {
    this.state = 'done';
    this.doneT = 0;
    if (youWon) {
      this.won = true;
      this.toast('You won the race! 🏆');
      sound.play('win');
      this.say(RACE_LINES.win);
    } else {
      this.losses++;
      this.toast('Rio wins this time! Try again!');
      this.say(RACE_LINES.lose);
      if (TIPS[Math.min(this.losses, 2)]) this.toast(TIPS[Math.min(this.losses, 2)]);
    }
  }

  // Your progress along the lap (6.5): never more than the next flag allows, so cutting over the grass gains nothing.
  progress(pos) {
    const t = this.track, L = t.L, pr = t.project(pos.x, pos.z), k = this.next;
    if (k === 0) return pr.s > L / 2 ? pr.s - L : pr.s;
    let s = pr.s;
    if (k === 1 && s > L / 2) s = 0;
    if (k === 4 && s < t.gates[3].s - L / 2) s += L;
    s = Math.min(Math.max(s, t.gates[k - 1].s), k === 4 ? L : t.gates[k].s);
    return this.lap * L + s;
  }

  // Flags: the segment prev -> now through the gate line, forwards.
  flags(pos) {
    const t = this.track, prev = this.prev;
    this.prev = { x: pos.x, z: pos.z };
    if (!prev || pos.y < this.part.y - 1 || pos.y > this.part.y + 9) return;
    const now = this.clock;
    for (let i = 0; i < 4; i++) {
      const c = crossing(prev, pos, t.gates[i]);
      if (!c) continue;
      if (c < 0) { if (now - this.wrongAt > 5) { this.wrongAt = now; this.toast('Wrong way! Turn around.'); } continue; }
      if (i !== this.next % 4) continue;
      if (i === 0 && this.next === 4) { // the line after flag 3: a lap
        this.lap++;
        if (this.lap >= RACE.laps) { this.finish(true); return; }
        this.next = 1;
        sound.play('lapbell');
        if (this.lap === RACE.laps - 1) this.toast('Last lap!');
      } else if (i === 0) this.next = 1;   // the start line just after GO
      else this.next = i + 1;
      this.missed = false; this.missedFor = -1;
    }
  }

  // The flag you should go to is far behind you: tell once and point back at it.
  checkMissed(pos) {
    if (this.next === 0) return;
    const t = this.track, L = t.L, gs = this.next === 4 ? L : t.gates[this.next].s;
    const ds = ((t.project(pos.x, pos.z).s - gs) % L + L) % L;
    const missed = ds > 25 && ds < L / 2;
    if (missed && !this.missed && this.missedFor !== this.next) {
      this.missedFor = this.next;
      this.toast('Missed a flag! Follow the arrow back to the 🚩');
    }
    this.missed = missed;
  }

  /* ---- drawing (lamps, pads) ---- */
  drawLamps(red, green) {
    const key = `${red}/${green}`;
    if (this.lamps === key) return;
    this.lamps = key;
    this.part.lights.forEach(([x, y, z], i) => this.cells.want(x, y, z, green ? B.START_GREEN : i < red ? B.START_RED : B.START_LIGHT));
  }
  drawPads(lit) {
    if (this.padLit === lit) return;
    this.padLit = lit;
    for (const p of this.part.pads) for (const [x, z] of p.cells) this.cells.want(x, this.part.y, z, lit ? B.BOOST_PAD_LIT : B.BOOST_PAD);
  }

  /* ---- the frame ---- */
  update(dt = 0) { if (!this.manual) this.step(dt); }

  step(dt) {
    const g = this.game, p = g.player;
    if (!p || !g.world) return;
    // owner 2026-10-26: in a race you always run (no Shift, no full stick push on a tablet), on the track at the race's pace, off it a walk
    const racing = this.state === 'race', onTrack = racing && this.track.project(p.pos.x, p.pos.z).d <= RACE.half;
    p.forceSprint = racing;
    p.speedK = onTrack ? RACE.pace : 1;
    p.speedCap = racing && !onTrack ? RACE.offTrack : null;
    const cam = this.game.camera, fov = onTrack ? RACE.fov : 75; // the view widens a little at race speed
    if (cam && Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
    if (racing && !onTrack && !this.toldOff) { this.toldOff = true; this.toast('Off the track! Get back on the road to go fast.'); }
    this.cells.flush();
    const paused = this.paused();
    if (this.zoomCool > 0 && !paused) this.zoomCool -= dt;
    if (this.zoom && !paused) this.stepZoom(dt);
    if (this.state === 'count') this.stepCount(dt, paused);
    else if (this.state === 'race') this.stepRace(dt, paused);
    else if (this.state === 'done') this.stepDone(dt, paused);
    else this.stepIdle(dt, paused);
  }

  stepZoom(dt) {
    const p = this.game.player, z = this.zoom, step = Math.min(z.left, RACE.boost.speed * dt), before = p.pos[z.axis];
    p.moveAxis(z.axis, z.sign * step);
    z.left -= step;
    if (this.state === 'race') this.driven += step;
    if (z.left <= 1e-6 || Math.abs(p.pos[z.axis] - before) < step * 0.5) { this.zoom = null; this.zoomCool = 0.5; }
  }

  stepCount(dt, paused) {
    const g = this.game, p = g.player, grid = this.part.grid;
    if (paused) return;
    this.countT += dt;
    for (let i = this.beeped; i < 3; i++) {
      if (this.countT < i) break;
      this.beeped = i + 1;
      sound.play('racebeep');
      this.toast(String(3 - i));
    }
    this.drawLamps(Math.min(3, this.beeped), false);
    // hold: no moving off the grid before GO
    if (Math.hypot(p.pos.x - grid.player[0], p.pos.z - grid.player[2]) > RACE.hold) {
      p.pos.set(grid.player[0], grid.player[1], grid.player[2]);
      p.vel.set(0, 0, 0);
      if (this.waitToldAt < 0) { this.waitToldAt = this.countT; this.toast('Wait for GO!'); }
    }
    if (this.countT >= RACE.count) {
      this.state = 'race';
      this.clock = 0; this.greenAt = 0;
      this.prev = { x: p.pos.x, z: p.pos.z };
      this.drawLamps(3, true);
      sound.play('racego');
      this.toast('GO!');
    }
  }

  stepRace(dt, paused) {
    const g = this.game, p = g.player, t = this.track, n = this.rio();
    if (paused) { this.prev = null; return; } // a battle may have moved you: no flag is crossed by that
    this.clock += dt;
    if (this.greenAt >= 0 && this.clock - this.greenAt > 2) { this.greenAt = -1; this.drawLamps(0, false); }
    // you: flags, laps, progress
    this.flags(p.pos);
    if (this.state !== 'race') return;
    this.checkMissed(p.pos);
    this.P = this.progress(p.pos);
    // Rio: his track distance grows by his speed (the rubber band looks at the lead)
    const end = RACE.laps * t.L;
    this.bossS += bossSpeed(this.bossS, this.bossS - this.P, this.losses, t) * dt;
    if (n) { const at = t.at(this.bossS, RACE.lane); n.pos.set(at.x, this.part.y + 1.35, at.z); n.heading = at.heading; n.moving = false; this.drawKart(); }
    if (this.bossS >= end) { this.finish(false); return; }
    // walking away from the track ends the race (not a loss)
    if (!this.inBox(p.pos) || t.project(p.pos.x, p.pos.z).d > RACE.leave) {
      this.backToStand();
      this.toast('Race stopped. Talk to Rio to race again.');
    }
  }

  stepDone(dt, paused) {
    if (paused) return;
    this.doneT += dt;
    const t = this.track, n = this.rio(), end = RACE.laps * t.L;
    if (this.bossS < end + 4) { this.bossS = Math.min(end + 4, this.bossS + 4 * dt); }
    if (n) { const at = t.at(this.bossS, RACE.lane); n.pos.set(at.x, this.part.y + 1.35, at.z); n.heading = at.heading; this.drawKart(); }
    if (this.doneT >= 3) this.backToStand();
  }

  stepIdle(dt, paused) {
    const g = this.game, p = g.player, t = this.track;
    const star = this.hasStar();
    // with the star the race zone starts up again: two karts drive laps, the pads pulse, the lamps cycle
    const b = this.part.box, dx = Math.max(b.x0 - p.pos.x, 0, p.pos.x - (b.x1 + 1)), dz = Math.max(b.z0 - p.pos.z, 0, p.pos.z - (b.z1 + 1));
    const show = star && Math.hypot(dx, dz) < 60;
    if (show !== this.parade) this.setParade(show);
    if (!show) return;
    if (!paused) this.paradeClock += dt;
    const c = this.paradeClock;
    this.paradeKarts.forEach((k, i) => {
      const s = c * RACE.parade.speed + (i * t.L) / 2;
      placeKart(k, t.at(s, RACE.parade.lanes[i]), this.part.y + 1, s);
    });
    if (Math.hypot(dx, dz) < 30) this.drawPads(Math.floor(c * 2) % 2 === 1);
    const k = Math.floor(c / 1.2) % 5;
    this.drawLamps(k < 4 ? k : 0, k === 4);
  }

  setParade(on) {
    this.parade = on;
    if (on && !this.paradeKarts) {
      this.paradeKarts = [buildKart({ body: 0x2a8ae8, accent: 0xffffff, driver: 0xffd23a }), buildKart({ body: 0xff7aa8, accent: 0xffffff, driver: 0x7ee08a })];
      for (const k of this.paradeKarts) { k.userData.parade = true; this.game.scene?.add(k); }
    }
    for (const k of this.paradeKarts || []) k.visible = on;
    if (!on) { this.drawPads(false); this.drawLamps(0, false); }
  }

  dispose() {
    const cam = this.game.camera; if (cam && cam.fov !== 75) { cam.fov = 75; cam.updateProjectionMatrix(); }
    if (this.game.player) { this.game.player.forceSprint = false; this.game.player.speedK = 1; this.game.player.speedCap = null; }
    disposeKart(this.kart);
    for (const k of this.paradeKarts || []) disposeKart(k);
    this.kart = null; this.paradeKarts = null;
    const n = this.rioNpc;
    if (n) n.steer = false;
  }

  // For tests.
  info() {
    return { state: this.state, lap: this.lap, next: this.next, P: this.P, bossS: this.bossS, losses: this.losses, won: this.won, clock: this.clock, countT: this.countT,
      zoom: this.zoom ? { ...this.zoom } : null, parade: this.paradeKarts && this.parade ? this.paradeKarts.map(k => [k.position.x, k.position.z]) : null,
      lamps: this.lamps, padLit: this.padLit, missed: this.missed };
  }
}
