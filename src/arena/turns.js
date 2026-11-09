// Prototype 2 (owner 2026-11-09: Draw and Flick had "no real aim"; Aim was "very basic" and is gone):
//   TimingMode (⏱️): the battle menu you know, but every attack and every block is a timing tap: stop the needle in the
//     bright zone, hit the beats, let go of a charge in the green, and tap Block as the ring closes on you.
import * as THREE from 'three';
import { shapeOf, len2, R } from './core.js';

export const TURN = { cools: { heal: 3, buff: 3, cloud: 2, sleep: 3, burst: 1 } }; // turns before a move can be used again

function setCool(mode, slot, s) { mode.cool[slot - 1] = (TURN.cools[s.kind] || 0) + 1; }
function movePad(mode, dimAll, armed = -1) {
  return [0, 1, 2, 3].map(i => {
    const s = mode.moves[i];
    if (!s) return null;
    const c = mode.cool[i];
    return { move: s, key: String(i + 1), dim: dimAll || c > 0, cd: c > 0 ? Math.min(1, c / ((TURN.cools[s.kind] || 0) + 1)) : 0, turns: c, on: armed === i + 1 };
  });
}
// heal / power up / slow cloud / sleepy cloud, the same in both modes
function status(a, s, x, z) {
  const you = a.you;
  if (s.kind === 'heal') { a.heal(you, 0.4); return; }
  if (s.kind === 'buff') { you.buffTurns = 2; you.c.atkUp = 1.5; a.say('Power up for 2 turns!'); return; }
  const r = s.kind === 'cloud' ? 2.6 : 2.3;
  a.fx.cloud(s.type, x, z, r, 1.2);
  let n = 0;
  for (const f of a.foes) if (f.alive && len2(f.x - x, f.z - z) < r + f.r * 0.5) {
    n++;
    if (s.kind === 'cloud') f.slowTurns = 2;
    else { f.sleepTurns = 1; if (f.tell) { a.fx.untell(f.tell); f.tell = null; } }
  }
  a.say(n ? (s.kind === 'cloud' ? 'Slowed down!' : 'Fast asleep!') : 'Missed them!');
}

// ================================================================ ⏱️ Timing

export const TIMING = {
  sweep: 1.15, // the needle goes across and back in this long
  zone: 0.24, perfect: 0.07, // the bright zone's width and its perfect middle (parts of the bar)
  weak: 0.4, good: 1, best: 1.6, // damage x
  beats: 4, beatGap: 0.52, beatTravel: 1.0, beatWin: 0.11, // the beats slide into the line
  charge: 1.5, green: [0.74, 0.9], // a charge fills in charge s; let go in the green (past it = fizzle)
  ring: 1.0, block: { perfect: 0.075, good: 0.17 }, // the ring closes on you in ring s; tap Block when it lands
};

export class TimingMode {
  constructor(a) {
    this.a = a; this.name = 'timing'; this.cam = 'whole';
    this.hint = 'Pick a move, then TAP at the right moment! When a monster attacks, tap as the ring closes.';
  }
  start() {
    const a = this.a;
    this.moves = a.you.c.moves.map(shapeOf);
    this.cool = [0, 0, 0, 0];
    this.clock = 0; this.turn = 1; this.anims = []; this.q = [];
    a.you.buffTurns = 0;
    for (const f of a.foes) { f.sleepTurns = 0; f.slowTurns = 0; }
    this.meterEl = document.getElementById('meter');
    this.ctx = this.meterEl.getContext('2d');
    this.ring = null;
    this.yourTurn();
  }
  yourTurn() { this.phase = 'pick'; this.meter = null; this.a.say(`Turn ${this.turn}: pick a move!`); }
  get target() {
    const a = this.a;
    if (!this.aimAt?.alive) this.aimAt = a.foes.filter(f => f.alive).sort((p, q) => p.hp - q.hp)[0];
    return this.aimAt;
  }
  pointer(kind, p) { // a tap on a monster picks it; any other tap is the Tap! button
    if (this.a.over) return;
    if (kind === 'down' && p && this.phase === 'pick') {
      const f = this.a.foes.find(f => f.alive && len2(f.x - p.x, f.z - p.z) < 1.8);
      if (f) { this.aimAt = f; this.a.say(`Target: ${this.a.nameOf(f)}`); return; }
    }
    if (kind === 'down') this.tapDown(); else if (kind === 'up') this.tapUp();
  }
  press(slot) {
    if (this.a.over) return;
    if (slot === 0) return this.tapDown();
    if (this.phase !== 'pick') return;
    const s = this.moves[slot - 1];
    if (!s || this.cool[slot - 1] > 0) return;
    setCool(this, slot, s);
    this.s = s;
    const kind = s.kind === 'volley' ? 'beats' : s.kind === 'burst' ? 'charge' : 'needle';
    this.meter = { kind, t0: this.clock, taps: [], held: false, done: false, phase0: (this.turn * 0.37) % 1 };
    this.phase = 'meter';
    this.a.say({ needle: 'Tap when the needle is in the bright part!', beats: 'Tap as each beat hits the line!', charge: 'Hold Tap!, let go in the green!' }[kind]);
  }
  release(slot) { if (slot === 0) this.tapUp(); }
  tapDown() {
    const m = this.meter, t = this.clock;
    if (this.phase === 'block' && this.ring && this.ring.tap == null) { this.ring.tap = t; return; }
    if (this.phase !== 'meter' || !m || m.done) return;
    if (m.kind === 'needle') { m.done = true; m.at = this.needle(t); this.later(0.35, () => this.attack(this.judgeNeedle(m.at))); }
    else if (m.kind === 'beats') m.taps.push(t);
    else if (m.kind === 'charge' && !m.held) { m.held = true; m.hold0 = t; }
  }
  tapUp() {
    const m = this.meter;
    if (this.phase !== 'meter' || !m || m.done || m.kind !== 'charge' || !m.held) return;
    m.done = true; m.at = Math.min(1.2, (this.clock - m.hold0) / TIMING.charge);
    this.later(0.3, () => this.attack(m.at >= TIMING.green[0] && m.at <= TIMING.green[1] ? (m.at > 0.8 && m.at < 0.86 ? 'best' : 'good') : 'weak'));
  }
  // the needle: 0..1..0 across the bar; the bright zone moves a little every turn
  needle(t) { const u = ((t - this.meter.t0) / TIMING.sweep) % 1; return u < 0.5 ? u * 2 : 2 - u * 2; }
  zone() { const c = 0.25 + 0.5 * this.meter.phase0; return [c - TIMING.zone / 2, c + TIMING.zone / 2, c]; }
  judgeNeedle(x) { const [z0, z1, c] = this.zone(); return Math.abs(x - c) < TIMING.perfect / 2 ? 'best' : x >= z0 && x <= z1 ? 'good' : 'weak'; }
  beatTime(i) { return this.meter.t0 + 0.6 + i * TIMING.beatGap + TIMING.beatTravel; } // when beat i reaches the line
  attack(q) {
    const a = this.a, s = this.s, you = a.you, f = this.target, mult = TIMING[q] * a.youMult;
    a.sound(`fx:${s.type}`);
    a.say({ best: 'Perfect!', good: 'Good!', weak: 'Weak...' }[q]);
    this.phase = 'act';
    if (s.kind === 'heal' || s.kind === 'buff') {
      if (q === 'weak') a.say('It fizzled...'); else status(a, s);
    } else if (s.kind === 'cloud' || s.kind === 'sleep') {
      if (q === 'weak') a.say('It missed!'); else status(a, s, f.x, f.z);
    } else if (s.kind === 'burst') {
      this.lunge(you, f);
      a.fx.burst(s.type, f.x, f.z, 3, 0.5, 0.7);
      for (const o of a.foes) if (o.alive) a.hit(you, o, s.power, s.type, mult * (o === f ? 1 : 0.6));
    } else {
      if (s.recoil) a.hurtSelf(0.06);
      this.lunge(you, f);
      a.hit(you, f, s.power, s.type, mult);
    }
    this.later(0.8, () => this.foesTurn());
  }
  beatsDone() {
    const m = this.meter;
    m.done = true;
    let good = 0;
    for (let i = 0; i < TIMING.beats; i++) { // each beat counts once, with the tap nearest to it
      const bt = this.beatTime(i);
      if (m.taps.some(t => Math.abs(t - bt) < TIMING.beatWin)) good++;
    }
    m.good = good;
    const extra = m.taps.length - good; // mashing: every tap that hit no beat cancels a good one
    good = Math.max(0, good - Math.max(0, extra - 1));
    const a = this.a, s = this.s, you = a.you, f = this.target;
    a.say(good ? `${good} hit${good > 1 ? 's' : ''}!` : 'All missed...');
    this.phase = 'act';
    for (let i = 0; i < good; i++) this.later(i * 0.15, () => { if (f.alive) { this.lunge(you, f); a.hit(you, f, s.power, s.type, a.youMult * 1.1); } });
    this.later(0.8 + good * 0.15, () => this.foesTurn());
  }
  foesTurn() {
    const a = this.a;
    if (a.over) return;
    this.cool = this.cool.map(c => Math.max(0, c - 1));
    a.you.buffTurns = Math.max(0, a.you.buffTurns - 1);
    this.order = a.foes.filter(f => f.alive);
    this.next(0);
  }
  next(i) {
    const a = this.a;
    if (a.over) return;
    if (i >= this.order.length) { this.turn++; return this.yourTurn(); }
    const f = this.order[i];
    if (!f.alive) return this.next(i + 1);
    if (f.sleepTurns > 0) { f.sleepTurns--; a.say(`${a.nameOf(f)} is asleep... zzz`); return this.later(0.7, () => this.next(i + 1)); }
    this.phase = 'block';
    this.ring = { f, t0: this.clock, tap: null, i };
    a.say(i === 0 && this.turn <= 2 ? 'Tap as the ring touches you!' : `${a.nameOf(f)} attacks!`);
  }
  blockLands() {
    const a = this.a, r = this.ring, land = r.t0 + TIMING.ring, f = r.f;
    const off = r.tap == null ? 9 : Math.abs(r.tap - land);
    const early = r.tap != null && r.tap < land - TIMING.block.good;
    const q = off <= TIMING.block.perfect ? 'perfect' : off <= TIMING.block.good ? 'good' : 'none';
    this.ring = null;
    this.lunge(f, a.you);
    if (q === 'perfect') { a.say('Blocked!'); a.sound('bump'); }
    else a.hit(f, a.you, a.foePower, f.type, (q === 'good' ? 0.4 : 1) * (f.slowTurns > 0 ? 0.7 : 1));
    if (q !== 'perfect' && early) a.say('Too early!');
    if (f.slowTurns > 0) f.slowTurns--;
    this.phase = 'busy';
    this.later(0.6, () => this.next(r.i + 1));
  }
  lunge(f, to) {
    const x0 = f.x, z0 = f.z, d = len2(to.x - x0, to.z - z0) || 1, L = Math.min(1.6, d - 1.6);
    f.heading = Math.atan2(to.x - x0, to.z - z0);
    this.anim(0.35, k => { const s = Math.sin(k * Math.PI) * L; f.x = x0 + (to.x - x0) / d * s; f.z = z0 + (to.z - z0) / d * s; });
  }
  later(sec, fn) { this.q.push({ at: this.clock + sec, fn }); }
  anim(time, fn) { this.anims.push({ t0: this.clock, time, fn }); }
  step(dt) {
    this.clock += dt;
    for (const n of this.anims) { const k = Math.min(1, (this.clock - n.t0) / n.time); n.fn(k); n.done = k >= 1; }
    this.anims = this.anims.filter(n => !n.done);
    const due = this.q.filter(e => e.at <= this.clock);
    this.q = this.q.filter(e => e.at > this.clock);
    for (const e of due) if (!this.a.over) e.fn();
    const m = this.meter;
    if (this.phase === 'meter' && m && !m.done) {
      if (m.kind === 'beats' && this.clock > this.beatTime(TIMING.beats - 1) + 0.3) this.beatsDone();
      if (m.kind === 'charge' && m.held && (this.clock - m.hold0) / TIMING.charge > 1.15) this.tapUp();
      if (m.kind === 'charge' && !m.held && this.clock - m.t0 > 6) { m.held = true; m.hold0 = this.clock; } // never stuck
    }
    if (this.phase === 'block' && this.ring && this.clock >= this.ring.t0 + TIMING.ring + TIMING.block.good) this.blockLands();
  }
  // drawn every frame: the meter (needle / beats / charge) and the closing ring round you
  frame() {
    const c = this.ctx, W = this.meterEl.width, H = this.meterEl.height, m = this.meter;
    const show = this.phase === 'meter' || (this.phase === 'act' && m) ;
    this.meterEl.classList.toggle('on', !!show);
    if (show) {
      c.clearRect(0, 0, W, H);
      const x0 = 30, x1 = W - 30, y = H / 2, bw = x1 - x0;
      c.fillStyle = '#000a'; c.fillRect(x0 - 10, y - 30, bw + 20, 60);
      if (m.kind === 'needle') {
        const [z0, z1, cc] = this.zone();
        c.fillStyle = '#ffd23a99'; c.fillRect(x0 + z0 * bw, y - 24, (z1 - z0) * bw, 48);
        c.fillStyle = '#fff'; c.fillRect(x0 + (cc - TIMING.perfect / 2) * bw, y - 24, TIMING.perfect * bw, 48);
        const at = m.done ? m.at : this.needle(this.clock);
        c.fillStyle = '#ff4a4a'; c.fillRect(x0 + at * bw - 4, y - 30, 8, 60);
      } else if (m.kind === 'beats') {
        const lx = x1 - 40;
        c.fillStyle = '#fff'; c.fillRect(lx - 3, y - 28, 6, 56);
        for (let i = 0; i < TIMING.beats; i++) {
          const bt = this.beatTime(i), k = 1 - (bt - this.clock) / TIMING.beatTravel;
          if (k < 0 || k > 1.25) continue;
          const hit = m.taps.some(t => Math.abs(t - bt) < TIMING.beatWin);
          c.fillStyle = hit ? '#6fe06f' : '#ffd23a';
          c.beginPath(); c.arc(x0 + k * (lx - x0), y, 14, 0, 7); c.fill();
        }
      } else {
        const k = m.done ? m.at : m.held ? (this.clock - m.hold0) / TIMING.charge : 0;
        c.fillStyle = '#6fe06f88'; c.fillRect(x0 + TIMING.green[0] * bw, y - 24, (TIMING.green[1] - TIMING.green[0]) * bw, 48);
        c.fillStyle = '#ff4a4a55'; c.fillRect(x0 + TIMING.green[1] * bw, y - 24, (1.2 - TIMING.green[1]) * bw / 1.2, 48);
        c.fillStyle = k > TIMING.green[1] ? '#ff4a4a' : '#fff'; c.fillRect(x0, y - 12, Math.min(1.2, k) / 1.2 * bw, 24);
      }
    }
    this.drawRing();
  }
  drawRing() {
    const a = this.a, r = this.ring;
    if (!r) { if (this.ringMesh) this.ringMesh.forEach(m => { m.visible = false; }); return; }
    if (!this.ringMesh) {
      const geo = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
      this.ringMesh = [0xff4a4a, 0xffffff].map(col => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false })); a.scene.add(m); return m; });
    }
    const k = Math.min(1.2, (this.clock - r.t0) / TIMING.ring), you = a.you, rr = you.r + 0.25;
    const [closing, target] = this.ringMesh;
    closing.visible = target.visible = true;
    closing.position.set(you.x, 0.12, you.z); closing.scale.setScalar(rr + (1 - k) * 4.5);
    target.position.set(you.x, 0.1, you.z); target.scale.setScalar(rr);
  }
  pad() {
    const tap = this.phase === 'meter' || this.phase === 'block';
    return [{ label: this.phase === 'block' ? 'Block!' : 'Tap!', key: 'Space', dim: !tap, on: tap }, ...movePad(this, this.phase !== 'pick' || this.a.over)];
  }
  dispose() { this.ringMesh?.forEach(m => this.a.scene.remove(m)); this.meterEl?.classList.remove('on'); }
}

export const turnsInfo = { R };
