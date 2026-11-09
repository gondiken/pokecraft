// Chapter 3, Test A / B (owner 2026-11-09, `plans/chapter3.md` section 6): the Live fight of the test arena, but on the REAL ground.
// Pure rules (no scene, no DOM): Node-runnable with any world that has `get(x, y, z)` (tests/scribblebots.mjs plays it in Node and in the
// page). The arena's own pieces are reused as they are: `shapeOf` (a battle move's shape from its data), `damage` (battle.js's sum),
// `intentFor` (the red warnings) and the `LIVE` numbers (speeds, cool-downs, the monsters' rhythm). arena.html is not changed.
//
// What the real ground adds (the questions Test A answers):
//   heights: a creature steps up one block, never two; a step of two or more is a wall. Everything stands on the block under it.
//   cover: a shot flies straight from its shooter's chest to the target's and stops in the first solid block (a hill, a tree, a house);
//          a monster's rush stops at a wall, so its red line ends there; a stomp only reaches what stands at about its own height.
//   water: you can swim on it, slowly.
// The ring (radius R round the patch's centre) is the only fence. Fixed 1/120 s steps: the same at 60 and 20 fps.
import { shapeOf, damage, intentFor, FOES } from './arena/core.js';
import { LIVE } from './arena/live.js';
import { statsFor, SPECIES, MOVES } from './species.js';

export const STEP = 1 / 120;
export const FIGHT = {
  R: 10,              // the ring's radius (about 20 blocks across, plans/chapter3.md section 5)
  patch: 6.5,         // the scribbled patch before it snaps: step inside it to start
  foePower: 60, foeHp: 8, // tougher than the arena's Live (50, x6): buffs really work here, and mashing must never win (tests/scribblebots.mjs)
  squad: 3,           // creatures you can swap between
  climb: 1.05,        // the highest step a creature walks up
  chest: 0.9,         // where shots fly (over the ground a creature stands on)
  water: 0.6,         // speed while swimming
  stompDy: 1.6,       // a stomp reaches only what stands within this height of the monster
  cone: 0.6,          // first person: a monster within this angle (rad) of your look is the target
  // owner 2026-11-09: creatures with shots won easily, rushers fainted fast (a rush stopped right next to the monster, inside its stomp).
  // Measured with bots (plans/chapter3.md section 7): shorter cool-downs or a rush that always went through let MASHING win, so a rush is a
  // timing skill: hit a monster in the last half of its warning (when the red pulses fastest) and you cancel its attack, knock it back
  // and carry on through to the far side, out of its stomp. Any other rush stops at the monster as in the arena (cool-downs: the arena's).
  cool: {},
  rush: { speed: 17, min: 4.8, past: 2.4, max: 8, safe: 0.3, interrupt: true, window: 0.5, throughOnlyInWindow: true, stun: 1.2, knock: 1.6 },
  attack: 0.7,        // the monsters' rhythm: x the arena's time between attacks (they strike more often: mashing must never win)
  arc: 2.09,          // the monsters leap out this far apart (rad) round your creature: one in front, two to the sides behind (a tighter arc in front let mashing win)
};
const WATER = 5;
// First person (Test B): your creature runs beside you (a little ahead, to the right) and your moves go the way you look.
export const FOLLOW = { side: 1.6, ahead: 1.1 };
export function follow(F, px, pz, yaw) {
  const fw = [-Math.sin(yaw), -Math.cos(yaw)], rt = [Math.cos(yaw), -Math.sin(yaw)];
  const tx = px + rt[0] * FOLLOW.side + fw[0] * FOLLOW.ahead, tz = pz + rt[1] * FOLLOW.side + fw[1] * FOLLOW.ahead;
  const dx = tx - F.you.x, dz = tz - F.you.z, d = Math.hypot(dx, dz), k = d > 0.25 ? Math.min(1, d / 0.8) / d : 0;
  F.input.mx = dx * k; F.input.mz = dz * k;
  F.aimDir = { x: fw[0], z: fw[1] };
}
const len2 = (x, z) => Math.hypot(x, z);

// The real ground as the fight sees it, from a world with get(x, y, z) (and W / D for its edges).
export function groundOf(world) {
  const H = world.H ?? 48;
  const get = (x, y, z) => (x < 0 || z < 0 || x >= world.W || z >= world.D || y < 0) ? 3 : y >= H ? 0 : world.get(x, y, z);
  const solid = (x, y, z) => { const b = get(x, y, z); return b !== 0 && b !== WATER; };
  return {
    solid: (x, y, z) => solid(Math.floor(x), Math.floor(y), Math.floor(z)),
    // where something standing near height `near` at (x, z) stands: the top of a block with two free blocks over it, at most `up`
    // above `near` (null = a wall). Water counts as a floor (you swim on it).
    stand(x, z, near, up = FIGHT.climb, down = 14) {
      const ix = Math.floor(x), iz = Math.floor(z);
      for (let y = Math.floor(near + up - 1e-6) - 1; y >= Math.floor(near) - down; y--) {
        const b = get(ix, y, iz);
        if (b === 0) continue;
        if (solid(ix, y + 1, iz) || solid(ix, y + 2, iz)) return null; // under something: a wall here
        return y + 1;
      }
      return null;
    },
    wet(x, z, y) { return get(Math.floor(x), Math.floor(y) - 1, Math.floor(z)) === WATER; },
    // the ground for drawing (a decal, the ring): the first floor from `from` down
    floor(x, z, from) { return this.stand(x, z, from, 0.5, 30) ?? from; },
  };
}

// The fighters: your squad's lead (side 'you') and the scribble monsters (side 'foe').
function fighter(c, side, x, y, z) {
  const f = { c: { species: c.species, level: c.level, moves: c.moves || [] }, side, x, y, z, heading: 0, r: 0.75, pattern: c.pattern,
    hp: 0, maxHp: 0, safeT: 0, buffT: 0, guardT: 0, slowT: 0, sleepT: 0, flash: 0, moving: false, vel: { x: 0, z: 0 } };
  f.maxHp = f.hp = statsFor(f.c).maxHp;
  Object.defineProperty(f, 'alive', { get() { return this.hp > 0; } });
  Object.defineProperty(f, 'type', { get() { return SPECIES[this.c.species].type; } });
  return f;
}

// Your team for the fight: copies of your first creatures (never your real ones: nothing here changes a save).
export function squadOf(party) {
  return (party || []).filter(c => c && SPECIES[c.species] && (c.moves || []).some(m => MOVES[m])).slice(0, FIGHT.squad)
    .map(c => ({ species: c.species, level: Math.max(5, Math.min(100, c.level | 0)), moves: c.moves.filter(m => MOVES[m]).slice(0, 4), paint: c.paint }));
}

export class ScribbleFight {
  // opts: { ground, centre: { x, z, y }, squad: [creature], foes?: [{ species, pattern }], start: { x, z, y }, spots?: [[x, z]], rand? }
  constructor(opts) {
    this.g = opts.ground; this.C = opts.centre; this.R = opts.R ?? FIGHT.R;
    this.rand = opts.rand || Math.random;
    this.squad = opts.squad.map(c => ({ c, hp: statsFor(c).maxHp }));
    this.lead = 0;
    const s = opts.start;
    this.you = fighter(this.squad[0].c, 'you', s.x, s.y, s.z);
    const lvl = this.squad[0].c.level;
    const list = opts.foes || FOES.slice(0, 3);
    this.foes = list.map((d, i) => {
      const [x, z] = opts.spots?.[i] ?? this.spotAround(i, list.length);
      const f = fighter({ species: d.species, level: d.level ?? lvl, pattern: d.pattern }, 'foe', x, this.g.floor(x, z, this.C.y + 6), z);
      f.maxHp = f.hp = Math.round(f.maxHp * FIGHT.foeHp);
      f.heading = Math.atan2(this.you.x - x, this.you.z - z);
      f.timer = 1.6 + i * 0.9; f.tell = null; f.charging = null;
      return f;
    });
    this.input = { mx: 0, mz: 0 };
    this.aimDir = null; // first person: the way you look (x, z); null = your creature faces the nearest monster by itself
    this.moves = this.you.c.moves.map(shapeOf);
    this.cd = [0, 0, 0, 0, 0]; this.cdMax = [LIVE.dodge.cool, 1, 1, 1, 1];
    this.charge = { slot: -1, t: 0 };
    this.shots = []; this.clouds = []; this.events = [];
    this.dash = null; this.dir = { x: 0, z: 1 }; this.target = null;
    this.clock = 0; this.acc = 0; this.over = false; this.won = null; this.swapCool = 0; this.pendingSwap = null; this.nextId = 1;
    this.stats = { dealt: 0, taken: 0, dodged: 0, swaps: 0, byKind: {}, snaps: 0, blocked: 0, hitBy: {} };
  }
  // where monster i jumps to when the ring snaps: round your creature (they rush all at once), on ground it can stand on
  spotAround(i, n) {
    const s = this.you, base = Math.atan2(this.C.x - s.x, this.C.z - s.z);
    for (let k = 0; k < 40; k++) {
      const a = base + (i - (n - 1) / 2) * FIGHT.arc + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.15; // round it: they rush from every side
      for (const d of [6, 5.2, 6.8, 4.5]) {
        const x = s.x + Math.sin(a) * d, z = s.z + Math.cos(a) * d;
        if (!this.inRing(x, z, 1.5)) continue;
        const y = this.g.floor(x, z, s.y + 4);
        if (y != null && Math.abs(y - s.y) <= 3 && !this.g.wet(x, z, y)) return [x, z];
      }
    }
    return this.spotNear(i);
  }
  // a walkable spot for monster i, inside the patch
  spotNear(i) {
    for (let k = 0; k < 60; k++) {
      const a = (i * 2.4 + k * 0.9) % (Math.PI * 2), d = 2 + ((i * 1.7 + k * 0.37) % 3.2);
      const x = this.C.x + Math.cos(a) * d, z = this.C.z + Math.sin(a) * d;
      const y = this.g.floor(x, z, this.C.y + 6);
      if (Math.abs(y - this.C.y) <= 3 && !this.g.wet(x, z, y)) return [x, z];
    }
    return [this.C.x + i, this.C.z];
  }
  emit(e) { this.events.push(e); }
  // ---------------------------------------------------------------- moving on the real ground
  // tries to move f by (dx, dz); slides along walls; returns true when something stopped it
  move(f, dx, dz) {
    let stopped = false;
    const tryTo = (nx, nz) => {
      const probe = 0.32, d = len2(nx - f.x, nz - f.z) || 1;
      const px = nx + (nx - f.x) / d * probe, pz = nz + (nz - f.z) / d * probe;
      const y = this.g.stand(nx, nz, f.y), yp = this.g.stand(px, pz, f.y);
      if (y == null || yp == null) return false;
      f.x = nx; f.z = nz; f.y = y;
      return true;
    };
    if (!tryTo(f.x + dx, f.z + dz)) {
      stopped = true;
      if (!tryTo(f.x + dx, f.z)) tryTo(f.x, f.z + dz);
    }
    if (this.fence(f)) stopped = true;
    return stopped;
  }
  // the ring: the only fence. Returns the inward normal when it pushed.
  fence(f) {
    const ox = f.x - this.C.x, oz = f.z - this.C.z, d = len2(ox, oz), lim = this.R - 0.2 - f.r;
    if (d <= lim) return null;
    const nx = this.C.x + ox * lim / d, nz = this.C.z + oz * lim / d;
    const y = this.g.stand(nx, nz, f.y, 3);
    if (y != null) f.y = y;
    f.x = nx; f.z = nz;
    return { nx: -ox / d, nz: -oz / d };
  }
  inRing(x, z, pad = 0) { return len2(x - this.C.x, z - this.C.z) < this.R - 0.2 - pad; }
  // a straight flight from a to b (3D) stops at the first solid block: the share of the way it gets
  reach(ax, ay, az, bx, by, bz) {
    const L = Math.hypot(bx - ax, by - ay, bz - az), n = Math.max(1, Math.ceil(L / 0.2));
    for (let k = 1; k <= n; k++) { const t = k / n; if (this.g.solid(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)) return (k - 1) / n; }
    return 1;
  }
  clearShot(a, b) { return this.reach(a.x, a.y + FIGHT.chest, a.z, b.x, b.y + FIGHT.chest, b.z) >= 0.999; }
  // how far a rush along (dx, dz) gets before a wall or the ring
  rushLen(f, dx, dz, len) {
    let y = f.y;
    for (let s = 0.25; s <= len; s += 0.25) {
      const x = f.x + dx * s, z = f.z + dz * s;
      if (!this.inRing(x, z, f.r)) return s - 0.25;
      const ny = this.g.stand(x, z, y);
      if (ny == null) return Math.max(0, s - 0.5);
      y = ny;
    }
    return len;
  }
  // ---------------------------------------------------------------- the monsters' warnings
  makeTell(f) {
    const t = intentFor(f, this.you);
    if (t.kind === 'line') { t.len = this.rushLen(f, t.dx, t.dz, t.len); t.y = f.y; }
    else t.y = t.kind === 'ring' ? f.y : this.you.y;
    t.id = this.nextId++;
    return t;
  }
  inTell(t, x, y, z, r = 0) {
    if (t.kind === 'circle') return len2(x - t.x, z - t.z) < t.r + r * 0.5;
    if (t.kind === 'ring') return len2(x - t.x, z - t.z) < t.r + r * 0.5 && Math.abs(y - t.y) < FIGHT.stompDy;
    const along = (x - t.x) * t.dx + (z - t.z) * t.dz;
    if (along < -0.5 || along > t.len + 0.5) return false;
    const px = t.x + t.dx * along, pz = t.z + t.dz * along;
    return len2(x - px, z - pz) <= t.w / 2 + r * 0.5;
  }
  // ---------------------------------------------------------------- damage
  hit(src, dst, power, type, mult = 1, kind = null) {
    if (this.over || !dst.alive) return 0;
    if (dst.safeT > 0) { this.emit({ kind: 'dodged', f: dst }); if (dst.side === 'you') this.stats.dodged++; return 0; }
    const { amount, eff } = damage(src.c, dst.c, power, type, mult);
    dst.hp = Math.max(0, dst.hp - amount);
    dst.flash = 0.25;
    this.stats[dst.side === 'you' ? 'taken' : 'dealt'] += amount;
    if (kind) { const k = dst.side === 'you' ? 'hitBy' : 'byKind'; this.stats[k][kind] = (this.stats[k][kind] || 0) + amount; }
    this.emit({ kind: 'hit', f: dst, amount, eff });
    if (!dst.alive) {
      dst.flash = 0.6;
      dst.tell = null; dst.charging = null;
      this.emit({ kind: 'faint', f: dst });
      if (dst === this.you) {
        this.squad[this.lead].hp = 0;
        const next = this.squad.findIndex(m => m.hp > 0);
        if (next >= 0) this.pendingSwap = next; else this.finish(false);
      } else if (this.foes.every(f => !f.alive)) this.finish(true);
    }
    return amount;
  }
  heal(f, frac) { const n = Math.min(f.maxHp - f.hp, Math.round(f.maxHp * frac)); f.hp += n; this.emit({ kind: 'heal', f, amount: n }); }
  finish(won) { if (this.over) return; this.over = true; this.won = won; this.emit({ kind: 'over', won }); }
  // swap the creature in play for another of your squad (it keeps its own HP)
  swap(i, auto = false) {
    const m = this.squad[i];
    if (!m || i === this.lead || m.hp <= 0 || this.over || (!auto && this.swapCool > 0)) return false;
    const old = this.you;
    if (old.alive) this.squad[this.lead].hp = old.hp;
    const f = fighter(m.c, 'you', old.x, old.y, old.z);
    f.hp = m.hp; f.heading = old.heading; f.safeT = 0.6;
    this.you = f; this.lead = i; this.swapCool = 0.8; this.stats.swaps++;
    this.dash = null; this.charge = { slot: -1, t: 0 };
    this.moves = f.c.moves.map(shapeOf);
    this.cd = this.cd.map((c, k) => (k ? 0 : c));
    this.emit({ kind: 'swap', f, old, auto });
    return true;
  }
  // ---------------------------------------------------------------- input (slot 0 = Dodge, 1-4 = your moves)
  press(slot) {
    if (this.over) return;
    if (slot === 0) return this.tryDodge();
    const s = this.moves[slot - 1];
    if (!s || this.cd[slot] > 0 || this.dash) return;
    if (s.kind === 'burst') { this.charge = { slot, t: 0 }; return; }
    this.use(slot, 0);
  }
  release(slot) {
    if (this.charge.slot === slot) { const k = Math.min(1, this.charge.t / LIVE.charge); this.charge = { slot: -1, t: 0 }; this.use(slot, k); }
  }
  pick(f) { if (f?.alive) this.target = f; }
  tryDodge() {
    if (this.cd[0] > 0 || this.dash) return;
    let { mx: dx, mz: dz } = this.input;
    if (!dx && !dz) { dx = -Math.sin(this.you.heading); dz = -Math.cos(this.you.heading); } // no stick: hop back
    const d = Math.hypot(dx, dz);
    this.dash = { x: dx / d, z: dz / d, t: LIVE.dodge.time, speed: LIVE.dodge.speed, hits: null };
    this.you.safeT = LIVE.dodge.safe;
    this.cd[0] = LIVE.dodge.cool;
    this.emit({ kind: 'dodge' });
  }
  // the monster your moves go to: the one you look at (first person), the one you tapped, else the nearest you can see
  aimAt() {
    const you = this.you;
    if (this.aimDir) {
      let best = null, ba = FIGHT.cone;
      for (const f of this.foes) if (f.alive) {
        const dx = f.x - you.x, dz = f.z - you.z, d = len2(dx, dz) || 1;
        const a = Math.acos(Math.max(-1, Math.min(1, (dx * this.aimDir.x + dz * this.aimDir.z) / d)));
        if (a < ba) { ba = a; best = f; }
      }
      return (this.target = best);
    }
    if (!this.target?.alive) {
      this.target = null;
      let bd = Infinity;
      for (const f of this.foes) if (f.alive) { const d = len2(f.x - you.x, f.z - you.z); if (d < bd) { bd = d; this.target = f; } }
    }
    return this.target;
  }
  use(slot, charge) {
    const you = this.you, s = this.moves[slot - 1], t = this.aimAt();
    const cool = FIGHT.cool[s.kind] ?? LIVE.cool[s.kind];
    this.cd[slot] = cool; this.cdMax[slot] = cool;
    let dx = Math.sin(you.heading), dz = Math.cos(you.heading), dy = 0;
    if (t) { const d = len2(t.x - you.x, t.z - you.z) || 1; dx = (t.x - you.x) / d; dz = (t.z - you.z) / d; dy = (t.y - you.y) / d; }
    else if (this.aimDir) { dx = this.aimDir.x; dz = this.aimDir.z; }
    this.emit({ kind: 'move', s, slot });
    if (s.kind === 'bolt') this.fire(s, dx, dy, dz, 1);
    else if (s.kind === 'volley') { for (let i = 0; i < 4; i++) this.fire(s, dx, dy, dz, 1, i * 0.09, (i - 1.5) * 0.09); }
    else if (s.kind === 'burst') {
      const r = 2.2 + 1.6 * charge;
      this.emit({ kind: 'burst', type: s.type, x: you.x, y: you.y, z: you.z, r });
      for (const f of this.foes) if (f.alive && len2(f.x - you.x, f.z - you.z) < r + f.r * 0.5 && Math.abs(f.y - you.y) < 2.5) this.hit(you, f, s.power, s.type, 0.55 + 0.6 * charge, 'burst');
    } else if (s.kind === 'dash') {
      // owner 2026-11-09 (rushers fainted fast, shooters won): a rush goes THROUGH the monster it aims at and ends behind it (out of
      // its stomp), as far as it needs (FIGHT.rush); a hit on a monster that is winding up cancels its attack and knocks it back
      const R0 = FIGHT.rush, inWindow = t?.tell && t.tell.left <= LIVE.foe.tell * (R0.window ?? 1);
      const reach = t && (inWindow || !R0.throughOnlyInWindow) ? Math.max(R0.min, Math.min(R0.max, len2(t.x - you.x, t.z - you.z) + R0.past)) : R0.min;
      this.dash = { x: dx, z: dz, t: reach / R0.speed, speed: R0.speed, hits: new Set(), s };
      you.safeT = R0.safe ?? reach / R0.speed + 0.05;
      if (s.recoil) { const n = Math.max(1, Math.round(you.maxHp * 0.06)); you.hp = Math.max(1, you.hp - n); this.emit({ kind: 'hit', f: you, amount: n, eff: 1 }); }
    } else if (s.kind === 'heal') this.heal(you, 0.35);
    else if (s.kind === 'buff') { if (s.stat === 'def') you.guardT = 8; else you.buffT = 8; this.emit({ kind: 'buff', def: s.stat === 'def' }); }
    else if (s.kind === 'cloud' || s.kind === 'sleep') {
      const x = t ? t.x : you.x + dx * 5, z = t ? t.z : you.z + dz * 5;
      const c = { id: this.nextId++, type: s.type, x, z, y: t ? t.y : you.y, r: 2.3, t: 0, time: s.kind === 'sleep' ? 2.2 : 5, sleep: s.kind === 'sleep', done: new Set() };
      this.clouds.push(c);
      this.emit({ kind: 'cloud', c });
    }
  }
  fire(s, dx, dy, dz, mult, delay = 0, turn = 0) {
    const c = Math.cos(turn), sn = Math.sin(turn), y = this.you.y + FIGHT.chest;
    this.shots.push({ id: this.nextId++, s, x: this.you.x, y, z: this.you.z, dx: dx * c + dz * sn, dy, dz: dz * c - dx * sn, left: LIVE.shotRange, delay, mult });
  }
  // ---------------------------------------------------------------- time
  step(dt) { // any dt: runs the fixed steps
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP - 1e-9 && n++ < 60) { this.acc -= STEP; this.oneStep(STEP); }
    if (this.acc > STEP) this.acc = 0;
  }
  oneStep(dt) {
    if (this.over) return;
    if (this.pendingSwap != null) { const i = this.pendingSwap; this.pendingSwap = null; this.swap(i, true); }
    this.clock += dt;
    this.swapCool = Math.max(0, this.swapCool - dt);
    const you = this.you;
    for (let i = 0; i < 5; i++) this.cd[i] = Math.max(0, this.cd[i] - dt);
    for (const f of [you, ...this.foes]) {
      f.safeT = Math.max(0, f.safeT - dt); f.buffT = Math.max(0, f.buffT - dt); f.guardT = Math.max(0, f.guardT - dt);
      f.slowT = Math.max(0, f.slowT - dt); f.sleepT = Math.max(0, f.sleepT - dt); f.flash = Math.max(0, f.flash - dt);
      f.c.atkUp = f.buffT > 0 ? 1.5 : 1; f.c.defUp = f.guardT > 0 ? 1.6 : 1;
    }
    if (this.charge.slot > 0) { this.charge.t += dt; if (this.charge.t >= LIVE.charge) this.release(this.charge.slot); }
    // you
    if (this.dash) {
      const d = this.dash;
      const stopped = this.move(you, d.x * d.speed * dt, d.z * d.speed * dt);
      d.t -= dt;
      if (d.hits) for (const f of this.foes) if (f.alive && !d.hits.has(f) && len2(f.x - you.x, f.z - you.z) < f.r + you.r + 0.2 && Math.abs(f.y - you.y) < 1.6) {
        d.hits.add(f);
        const winding = !!f.tell && f.tell.left <= LIVE.foe.tell * (FIGHT.rush.window ?? 1); // (window: only the last part of the warning, when it pulses fastest)
        this.hit(you, f, d.s.power, d.s.type, 1, 'dash');
        if (winding && f.alive && FIGHT.rush.interrupt) { // cancel its attack and knock it back
          f.tell = null; f.timer = Math.max(f.timer, FIGHT.rush.stun);
          this.move(f, d.x * FIGHT.rush.knock, d.z * FIGHT.rush.knock);
          this.emit({ kind: 'interrupt', f });
        }
      }
      if (stopped || d.t <= 0) { this.dash = null; you.vel.x = you.vel.z = 0; }
      you.moving = true;
    } else {
      const { mx, mz } = this.input, m = Math.min(1, Math.hypot(mx, mz));
      you.moving = m > 0.05;
      const sp = LIVE.speed * m * (this.charge.slot > 0 ? 0.55 : 1) * (this.g.wet(you.x, you.z, you.y) ? FIGHT.water : 1);
      if (you.moving) {
        const k = Math.hypot(mx, mz), y0 = you.y;
        if (this.move(you, mx / k * sp * dt, mz / k * sp * dt)) this.stats.blocked += dt;
        if (you.y !== y0) this.stats.snaps++;
        this.dir = { x: mx, z: mz };
      }
    }
    const t = this.aimAt();
    if (this.aimDir) you.heading = Math.atan2(this.aimDir.x, this.aimDir.z);
    else if (t) you.heading = Math.atan2(t.x - you.x, t.z - you.z);
    else if (you.moving) you.heading = Math.atan2(this.dir.x, this.dir.z);
    // shots fly straight (3D) and stop in the first solid block
    for (const sh of this.shots) {
      if (sh.delay > 0) { sh.delay -= dt; continue; }
      const st = LIVE.shotSpeed * dt;
      sh.x += sh.dx * st; sh.y += sh.dy * st; sh.z += sh.dz * st; sh.left -= st; sh.live = true;
      if (this.g.solid(sh.x, sh.y, sh.z)) { sh.dead = true; this.emit({ kind: 'blocked', x: sh.x, y: sh.y, z: sh.z, type: sh.s.type }); }
      else if (sh.left <= 0 || !this.inRing(sh.x, sh.z, -1)) sh.dead = true;
      for (const f of this.foes) if (!sh.dead && f.alive && len2(f.x - sh.x, f.z - sh.z) < f.r + 0.2 && Math.abs(f.y + FIGHT.chest - sh.y) < 1.3) { sh.dead = true; this.hit(you, f, sh.s.power, sh.s.type, sh.mult, sh.s.kind); }
    }
    this.shots = this.shots.filter(s => !s.dead);
    // clouds slow monsters or send them to sleep
    for (const c of this.clouds) {
      c.t += dt;
      for (const f of this.foes) {
        if (!f.alive || len2(f.x - c.x, f.z - c.z) > c.r || Math.abs(f.y - c.y) > 3) continue;
        if (c.sleep) { if (!c.done.has(f)) { c.done.add(f); f.sleepT = 2.6; f.tell = null; f.timer = 3.6; } }
        else f.slowT = Math.max(f.slowT, 0.2);
      }
    }
    this.clouds = this.clouds.filter(c => c.t < c.time);
    for (const f of this.foes) if (f.alive) this.foeStep(f, dt);
  }
  foeStep(f, dt) {
    const you = this.you, F = LIVE.foe;
    if (f.sleepT > 0) { f.moving = false; return; }
    const slow = f.slowT > 0 ? 0.45 : 1;
    if (f.charging) { // a rush along its warned line; it stops at a wall
      const c = f.charging, st = Math.min(c.left, F.dash * dt);
      const stopped = this.move(f, c.dx * st, c.dz * st);
      c.left -= st;
      if (!c.hit && you.safeT <= 0 && len2(you.x - f.x, you.z - f.z) < you.r + f.r && Math.abs(you.y - f.y) < 1.6) { c.hit = true; this.hit(f, you, FIGHT.foePower, f.type, slow, 'rush'); }
      if (stopped || c.left <= 0) f.charging = null;
      f.moving = true;
      return;
    }
    f.heading = Math.atan2(you.x - f.x, you.z - f.z);
    if (f.tell) { // stands still while its warning shows
      f.tell.left -= dt * slow;
      f.moving = false;
      if (f.tell.left <= 0) this.strike(f, slow);
      return;
    }
    // walk to its own distance from you, then circle a little; round a wall it tries the other way
    const dx = you.x - f.x, dz = you.z - f.z, d = len2(dx, dz) || 1;
    const want = f.pattern === 'lob' ? 6 : f.pattern === 'stomp' ? 2.4 : 4.5;
    const go = d > want ? 1 : d < want - 1.5 ? -0.6 : 0;
    f.side2 ??= this.rand() < 0.5 ? 1 : -1;
    const side = f.side2 * 0.5;
    const vx = dx / d * go - dz / d * side, vz = dz / d * go + dx / d * side, v = Math.hypot(vx, vz) || 1;
    const sp = F.speed * slow * (this.g.wet(f.x, f.z, f.y) ? FIGHT.water : 1);
    if (this.move(f, vx / v * sp * dt, vz / v * sp * dt)) { f.stuck = (f.stuck || 0) + dt; if (f.stuck > 0.6) { f.side2 = -f.side2; f.stuck = 0; } }
    for (const o of this.foes) if (o !== f && o.alive) { const ox = f.x - o.x, oz = f.z - o.z, od = len2(ox, oz); if (od < 1.4 && od > 0.01) this.move(f, ox / od * (1.4 - od) * 0.5, oz / od * (1.4 - od) * 0.5); }
    f.moving = true;
    f.timer -= dt * slow;
    if (f.timer <= 0) {
      const t = this.makeTell(f);
      t.left = F.tell;
      f.tell = t;
      f.timer = (F.every[0] + this.rand() * (F.every[1] - F.every[0])) * FIGHT.attack; // (the arena's Ice Lake has the same lever)
      this.emit({ kind: 'tell', f, t });
    }
  }
  strike(f, slow) {
    const you = this.you, t = f.tell;
    f.tell = null;
    if (t.kind === 'line') { f.charging = { dx: t.dx, dz: t.dz, left: t.len, hit: false }; this.emit({ kind: 'rush', f }); return; }
    this.emit({ kind: 'thud', f, t });
    if (you.safeT <= 0 && this.inTell(t, you.x, you.y, you.z, you.r)) this.hit(f, you, FIGHT.foePower, f.type, slow, t.kind === 'ring' ? 'stomp' : 'lob');
  }
  // what the HUD and the pad show
  pad() {
    return [
      { label: 'Dodge', cd: this.cd[0] / LIVE.dodge.cool, dim: this.cd[0] > 0 },
      ...[0, 1, 2, 3].map(i => {
        const s = this.moves[i];
        if (!s) return null;
        const c = this.cd[i + 1];
        return { move: s, cd: c / (this.cdMax[i + 1] || 1), dim: c > 0, on: this.charge.slot === i + 1, charge: this.charge.slot === i + 1 ? Math.min(1, this.charge.t / LIVE.charge) : 0 };
      }),
    ];
  }
  info() {
    return { over: this.over, won: this.won, clock: +this.clock.toFixed(2), lead: this.lead,
      you: { x: this.you.x, y: this.you.y, z: this.you.z, hp: this.you.hp, maxHp: this.you.maxHp, species: this.you.c.species, moves: this.moves.map(s => s && s.kind) },
      squad: this.squad.map((m, i) => ({ species: m.c.species, hp: i === this.lead ? this.you.hp : m.hp })),
      foes: this.foes.map(f => ({ species: f.c.species, x: f.x, y: f.y, z: f.z, hp: f.hp, alive: f.alive, tell: f.tell ? f.tell.kind : null })), stats: this.stats };
  }
}

// ---------------------------------------------------------------- the fight camera (behind your creature), pure
// Night run 2026-11-10 (owner: "steeper camera: yes", plans/chapter3.md section 9): like the test arena's: fov 50, high and steep
// (13.5 up, 7 back: about 62 degrees down), further back on a portrait screen, and it does NOT turn with your look during a fight
// (north stays up, stick up = away from the camera; measured: the turning camera only ever showed less). A hill between the camera
// and your creature tips the camera up toward straight overhead, eased: it never jumps. scribble.js draws with it; tests/scribblebots.mjs measures what a child sees with it.
export const CAM = { up: 13.5, back: 7, fov: 50, ahead: 0.4, follow: 7, turn: false, yawRate: 7, tip: 3, tall: 1.2 };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
export class FightCam {
  constructor(o = {}) { this.c = { ...CAM, ...o }; this.yaw = 0; this.focus = null; this.tilt = 0; this.pose = null; }
  start(yaw, x, y, z) { this.yaw = yaw; this.focus = { x, y, z }; this.tilt = 0; this.pose = null; }
  // the line from the focus toward the camera at tilt t (0 = the set view, 1 = straight overhead), length scale s: is it clear?
  dirAt(t, tall) {
    const c = this.c, el0 = Math.atan2(c.up, c.back), el = el0 + (Math.PI / 2 - 0.02 - el0) * t, L = Math.hypot(c.up, c.back) * tall;
    return { x: Math.sin(this.yaw) * Math.cos(el) * L, y: Math.sin(el) * L, z: Math.cos(this.yaw) * Math.cos(el) * L };
  }
  clearTo(ground, d, s) {
    const F = this.focus, n = Math.ceil(Math.hypot(d.x, d.y, d.z) * s / 0.25);
    for (let k = 2; k <= n; k++) { const q = k / n * s; if (ground.solid(F.x + d.x * q, F.y + 1 + d.y * q, F.z + d.z * q)) return false; }
    return true;
  }
  // f: where your creature stands (x, y = its ground, z); look: your look's yaw (only with turn); aspect = width / height
  update(dt, f, look, aspect, ground, snap = false) {
    const c = this.c;
    if (!this.focus) this.start(look, f.x, f.y, f.z);
    if (c.turn) this.yaw = snap ? look : this.yaw + wrapA(look - this.yaw) * (1 - Math.exp(-dt * c.yawRate));
    const k = snap ? 1 : 1 - Math.exp(-dt * c.follow), F = this.focus;
    F.x += (f.x - F.x) * k; F.y += (f.y - F.y) * k; F.z += (f.z - F.z) * k;
    const tall = Math.max(1, c.tall / Math.max(0.3, aspect));
    // tip up until the way is clear (eased: it never jumps). Blocked even from overhead (under a tree) = it stays where it is: pulling
    // in made the camera swing 1.5 blocks a frame (measured), and a creature under leaves is rare and brief.
    let wantTilt = this.tilt;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) if (this.clearTo(ground, this.dirAt(t, tall), 1)) { wantTilt = t; break; }
    if (snap) this.tilt = wantTilt;
    else this.tilt += (wantTilt - this.tilt) * (1 - Math.exp(-dt * (wantTilt > this.tilt ? c.tip : c.tip * 0.5)));
    const d = this.dirAt(this.tilt, tall);
    const at = { x: F.x - Math.sin(this.yaw) * c.ahead, y: F.y + 0.5, z: F.z - Math.cos(this.yaw) * c.ahead };
    return (this.pose = { x: F.x + d.x, y: F.y + 1 + d.y, z: F.z + d.z, at, fov: c.fov });
  }
}
// where a point lands on screen with a pose (-1..1 both ways inside; null = behind the camera)
export function onScreen(pose, aspect, x, y, z) {
  const fx = pose.at.x - pose.x, fy = pose.at.y - pose.y, fz = pose.at.z - pose.z, fl = Math.hypot(fx, fy, fz);
  const f = [fx / fl, fy / fl, fz / fl];
  let r = [f[2], 0, -f[0]]; const rl = Math.hypot(r[0], r[2]) || 1; r = [-r[0] / rl, 0, -r[2] / rl]; // right = forward x up
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const v = [x - pose.x, y - pose.y, z - pose.z], depth = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
  if (depth <= 0.1) return null;
  const th = Math.tan(pose.fov * Math.PI / 360);
  return { x: (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / depth / (th * aspect), y: (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / depth / th, depth };
}
