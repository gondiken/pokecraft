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
import { KINDS, kindOf } from './movekinds.js'; // owner 2026-11-10: the kinds as objects (word, icon, button group)
import { statsFor, SPECIES, MOVES } from './species.js';

export const STEP = 1 / 120;
export const FIGHT = {
  R: 10,              // the ring's radius (about 20 blocks across, plans/chapter3.md section 5)
  patch: 6.5,         // the scribbled patch before it snaps: step inside it to start
  foePower: 60, foeHp: 10, // (2026-11-11: 8 -> 10 with the kinds by nature, tests/scribblemeasure.mjs length) tougher than the arena's Live (50, x6): buffs really work here, and mashing must never win (tests/scribblebots.mjs)
  squad: 3,           // creatures you can swap between
  climb: 1.05,        // the highest step a creature walks up
  chest: 0.9,         // where shots fly (over the ground a creature stands on)
  water: 0.6,         // speed while swimming
  stompDy: 1.6,       // a stomp reaches only what stands within this height of the monster
  // owner 2026-11-09: creatures with shots won easily, rushers fainted fast (a rush stopped right next to the monster, inside its stomp).
  // Measured with bots (plans/chapter3.md section 7): shorter cool-downs or a rush that always went through let MASHING win, so a rush is a
  // timing skill: hit a monster in the last half of its warning (when the red pulses fastest) and you cancel its attack, knock it back
  // and carry on through to the far side, out of its stomp. Any other rush stops at the monster as in the arena (cool-downs: the arena's).
  // (2026-11-11: a kind's wait and hit strength moved into KIND_NUMBERS below, with the rest of that kind's numbers)
  // Night run 2026-11-09 (plans/chapter3.md section 9, step 2): every move kind measured alone like the rush, and the weak or free ones
  // given a rule that asks for skill (never a plain number a masher also gets):
  //   big blast: the ring on the ground grows while you hold (r0 -> r1); only a full one hits hard (m0 -> m1, by charge^pow), and a
  //              blast that catches a monster in the last half of its warning stops it like the timed rush; the charge counts toward
  //              the cool-down (it starts when you press). Mashing (press and let go) = a small, weak puff.
  //   heal:      your creature sits down to heal for `time` s (it cannot move); a hit in that time spoils it. Heal between attacks.
  //   power up:  lasts while you are not hit: a hit (not a dodged one) takes it away. Keep out of the red to keep it.
  //   tough:     a brace: a hit within `brace` s after you use it bounces off ("Blocked!") and stops the monster that threw it; after that
  //              only a little tougher.

  // 2026-11-10: the monsters' first attacks were at fixed times (1.6, 2.5, 3.4 s) and every cool-down is fixed, so a masher's rushes
  // came at the same moments of a warning every fight, just before the timed rush's window (0.4 s into it, the window opens at 0.475).
  // At 20 fps a press waits for the next frame (up to 50 ms), which tipped them into the window: mashing won 3x as often at 20 fps as
  // at 60. A random start (0..firstJitter s more) breaks that lock; both frame rates now win about the same, about 1 fight in 10.
  firstJitter: 0.8,
  attack: 0.7,        // the monsters' rhythm: x the arena's time between attacks (they strike more often: mashing must never win)
  arc: 2.09,          // the monsters leap out this far apart (rad) round your creature: one in front, two to the sides behind (a tighter arc in front let mashing win)
};

// ---- Every move kind's numbers, ONE place per kind (owner 2026-11-11, plans/chapter3-world.md section 7 and "Decided overnight").
// `wait` = seconds before the move can be used again (it was the arena's LIVE.cool); `hit` = x the damage sum (the same sum as a
// turn-based battle: level, attack / defence, the move's power, same type, the type chart). The rest are the kind's own rules.
// Set with tests/scribblemeasure.mjs kinds (each kind alone at the same power, naive / kid / person / skilled bots) and length.
export const KIND_NUMBERS = {
  // Shot: one ball flies straight at the monster you aim at; a hill or a tree in the way stops it. Safe: from a distance.
  bolt: { wait: 0.65, hit: 1 },
  // Many shots: `bits` small balls in a fan (`spread` rad apart), each `hit` x the sum: easy to land some, hard to land them all.
  volley: { wait: 1.6, hit: 0.68, bits: 4, spread: 0.12 },
  // Rush: your creature runs at the monster. Riskiest (you go in close). Timed in the last half of a monster's warning (`window`) it
  // is a big hit (`hit`), stops its attack, knocks it back `knock` and carries you through to the far side, out of its stomp; any other
  // rush is a plain hit (`plain`) and stops at the monster as in the arena (so mashing rushes gains nothing).
  dash: { wait: 1.8, hit: 2.4, plain: 1, speed: 17, min: 4.8, past: 2.4, max: 8, safe: 0.3, interrupt: true, window: 0.5, throughOnlyInWindow: true, stun: 1.2, knock: 1.6 },
  // Big blast: hold to grow a ring round your creature (r0 -> r1 over LIVE.charge s); everything inside is hit. Only a full one hits
  // hard: x (m0 -> hit) by charge^pow. One that catches a monster in the last half of its warning stops it. The wait counts from the press.
  burst: { wait: 2.8, hit: 2.8, r0: 2.0, r1: 5.0, m0: 0.35, pow: 2, stopWindow: 0.5, fromPress: true },
  // Heal: your creature sits `time` s (it cannot move), then heals `amount` of its HP; a hit in that time spoils it.
  heal: { wait: 9, time: 0.8, amount: 0.45 },
  // Power up: x `atk` until you are hit (or `time` s). Tough (a power-up move that raises defence): a brace: a hit within `brace` s
  // bounces off and stops its thrower, then x `def` for `time` s.
  buff: { wait: 9, atk: 1.5, time: 8, lostOnHit: true },
  tough: { brace: 0.7, def: 1.3, time: 8 },
  // Slow cloud / Sleepy cloud: a puddle where the monster stands.
  cloud: { wait: 6 }, sleep: { wait: 7 },
  // Speed up (owner 2026-11-11: the speed-raising moves are their own help move): x `mult` walking and dodging for `time` s.
  speed: { wait: 9, mult: 1.3, time: 8 },
};
FIGHT.kinds = KIND_NUMBERS;
FIGHT.rush = KIND_NUMBERS.dash; FIGHT.burst = KIND_NUMBERS.burst; FIGHT.heal = KIND_NUMBERS.heal; FIGHT.powerUp = KIND_NUMBERS.buff; FIGHT.tough = KIND_NUMBERS.tough; // (older names)
// A move that hits 1-5 times in a turn-based battle (fx multi) fights with power x its average number of hits there (2.9): its live
// power is its turn-based strength.
export const MULTI_HITS = 2.9;

// ---- Speed counts (owner 2026-11-11): a creature's speed (its species' base speed) sets how fast it walks and dodges, in a narrow
// band so no creature is hopeless: base speed `from` or less = x lo, `to` or more = x hi, in between in a straight line. Monsters too.
export const SPEED = { lo: 0.85, hi: 1.15, from: 40, to: 110 };
FIGHT.pace = SPEED; // (tests tune it as FIGHT.pace)
export function paceOf(species) {
  const b = SPECIES[species]?.base?.spd ?? 70, k = Math.min(1, Math.max(0, (b - SPEED.from) / (SPEED.to - SPEED.from)));
  return SPEED.lo + (SPEED.hi - SPEED.lo) * k;
}
// A move as the fight uses it: the arena's shape with the game's kind (movekinds.js kindOf: by its nature), but a speed-raising move is Speed up, and a multi-hit
// move's power is its turn-based average.
export function liveShape(id) {
  const s = shapeOf(id);
  if (!s) return s;
  const m = MOVES[id];
  s.kind = kindOf(id).id; // the game's kind by nature (the arena's shapeOf keeps its own old rule)
  if (s.kind === 'buff' && s.stat === 'spd') s.kind = 'speed';
  if (m.fx?.kind === 'multi' && s.power) s.power = Math.round(s.power * MULTI_HITS);
  return s;
}
// ---- Patches from data (chapter 3 step 5, plans/chapter3-world.md section 3): a patch names its species; its size says how hard.
// `level`: the monsters take your strongest creature's level plus this step. `patterns`: which fight patterns a size may use (smudges
// only charge; tangles charge and lob; knots add stomps). PATCH_SIZES is the one place for these numbers.
// `hp` x the monsters' HP and `attack` x their time between attacks (FIGHT.attack is the test patch's): fewer monsters each fight harder,
// or mashing wins a small patch (measured, tests/wobblebots.mjs).
export const PATCH_SIZES = {
  smudge: { level: 1, hp: 2.0, attack: 0.44, patterns: ['charge'] },
  tangle: { level: 0, hp: 1.3, attack: 0.6, patterns: ['charge', 'lob'] },
  knot: { level: 2, hp: 1.15, attack: 0.65, patterns: ['charge', 'lob', 'stomp'] },
};
FIGHT.sizes = PATCH_SIZES; // (tests tune it as FIGHT.sizes)
const HEAVY = new Set(['rock', 'metal', 'bone']);
// A species' fight pattern from its nature: heavy Rock / Metal / Bone bodies stomp, creatures whose attacks are mostly rushes charge,
// the rest lob (pure). `allowed` = the size's patterns (a pattern it may not use falls back to the next one in the list).
export function patternOf(species, allowed = ['charge', 'lob', 'stomp']) {
  const sp = SPECIES[species];
  if (!sp) return allowed[0];
  const ids = (sp.learn || []).map(([, id]) => id).filter(id => MOVES[id]?.power > 0);
  const rush = ids.filter(id => kindOf(id)?.id === 'dash').length;
  const want = HEAVY.has(sp.type) ? 'stomp' : rush * 2 > ids.length ? 'charge' : 'lob';
  if (allowed.includes(want)) return want;
  return want === 'stomp' ? (allowed.includes('charge') ? 'charge' : allowed[0]) : allowed[0];
}
// A patch record (wobbleland.js PATCHES) -> what ScribbleFight takes: { centre, foes, levelStep }.
export function patchFight(patch, y) {
  const S = PATCH_SIZES[patch.size] ?? PATCH_SIZES.tangle;
  const foes = patch.species.map(species => ({ species, pattern: patternOf(species, S.patterns) }));
  if (patch.grumble) foes.push({ species: patch.grumble, pattern: GRUMBLE.pattern, grumble: true });
  return { centre: { x: patch.x + 0.5, y, z: patch.z + 0.5 }, levelStep: S.level + (patch.step ?? 0), hp: S.hp, attack: S.attack, foes }; // (step: a later region's patches are a few levels up)
}
// The Grumble (step 7, a knot's big one, plans/chapter3-world.md section 3 lever 6): bigger, tougher, turns slowly toward you (`turn`
// rad/s), and a hit counts fully only on its back (from more than `back` rad off its front) or in the `open` s right after its own
// attack (its back glows then: scribble.js); any other hit does x `front`. Mashing from the front loses; circling round it or
// hitting right after it struck wins.
export const GRUMBLE = { hp: 1.8, r: 1.25, turn: 1.1, back: 1.75, open: 1.3, front: 0.25, pattern: 'stomp' };
FIGHT.grumble = GRUMBLE;
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
// The water twist: everyone swims slowly, Water creatures at full speed (FIGHT.water; the arena's own rule for its places).
const swimOf = f => (f.type === 'water' ? 1 : FIGHT.water);

const waitOf = kind => KIND_NUMBERS[kind]?.wait ?? LIVE.cool[kind] ?? 1;
const WATER = 5;
// Owner 2026-11-10 ("one creature's blast button is another creature's heal ... 5 buttons + directions is A LOT", chose "Attack + Special"):
// three buttons with a fixed meaning. Attack always hurts a monster, Special always helps; each uses the creature's moves of its group in
// turn: the ready one used longest ago (so none gets stuck), shown on the button by its kind's icon. Hold Attack on ◎ to charge a big blast.
export const GROUP = Object.fromEntries(Object.values(KINDS).map(k => [k.id, k.group])); // movekinds.js: each kind knows its button
export const BUTTONS = ['dodge', 'attack', 'special'];
export const ICON = { ...Object.fromEntries(Object.values(KINDS).map(k => [k.id, k.icon])), tough: '🛡' }; // (speed: » from movekinds.js)
export const iconOf = s => (s ? (s.kind === 'buff' && s.stat === 'def' ? ICON.tough : ICON[s.kind]) : '');
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
    // chapter 3 (Slippy Lake): the ground's own rule where something stands (groundrules.js, world.groundAt; null = plain ground)
    rule(x, z, y) { return FIGHT.ground === false ? null : world.groundAt?.({ x, y, z }) ?? null; }, // (FIGHT.ground = false: tests measure a lake fight without the ice)
    // the ground for drawing (a decal, the ring): the first floor from `from` down
    floor(x, z, from) { return this.stand(x, z, from, 0.5, 30) ?? from; },
  };
}

// The fighters: your squad's lead (side 'you') and the scribble monsters (side 'foe').
function fighter(c, side, x, y, z) {
  const f = { c: { species: c.species, level: c.level, moves: c.moves || [] }, side, x, y, z, heading: 0, r: 0.75, pattern: c.pattern,
    hp: 0, maxHp: 0, safeT: 0, buffT: 0, guardT: 0, braceT: 0, slowT: 0, sleepT: 0, speedT: 0, flash: 0, moving: false, vel: { x: 0, z: 0 } };
  f.pace = paceOf(c.species); // its speed in the band (SPEED)
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
    // the monsters match your strongest creature (night run: with a lead weaker than the rest, the monsters took the lead's level and
    // mashing won every fight once the strong ones came out)
    const lvl = Math.max(5, Math.min(100, Math.max(...this.squad.map(m => m.c.level)) + (opts.levelStep || 0))); // (a patch's size: PATCH_SIZES)
    const list = opts.foes || FOES.slice(0, 3);
    this.foes = list.map((d, i) => {
      const [x, z] = opts.spots?.[i] ?? this.spotAround(i, list.length);
      const f = fighter({ species: d.species, level: d.level ?? lvl, pattern: d.pattern }, 'foe', x, this.g.floor(x, z, this.C.y + 6), z);
      f.maxHp = f.hp = Math.round(f.maxHp * FIGHT.foeHp * (opts.hp ?? 1)); // (a patch's size: PATCH_SIZES)
      if (d.grumble) { f.grumble = true; f.r = GRUMBLE.r; f.maxHp = f.hp = Math.round(f.maxHp * GRUMBLE.hp); f.openT = 0; }
      f.heading = Math.atan2(this.you.x - x, this.you.z - z);
      f.timer = 1.6 + i * 0.9 + this.rand() * FIGHT.firstJitter; f.tell = null; f.charging = null;
      return f;
    });
    this.rhythm = opts.attack ?? FIGHT.attack; // the monsters' time between attacks (a patch's size, else the test patch's)
    this.input = { mx: 0, mz: 0 };
    this.moves = this.you.c.moves.map(liveShape);
    this.cd = [0, 0, 0, 0, 0]; this.cdMax = [LIVE.dodge.cool, 1, 1, 1, 1];
    this.charge = { slot: -1, t: 0 };
    this.usedAt = [0, -1e9, -1e9, -1e9, -1e9]; this.held = [0, 0, 0];
    this.shots = []; this.clouds = []; this.events = [];
    this.dash = null; this.healing = null; this.dir = { x: 0, z: 1 }; this.target = null;
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
  // chapter 3 (Slippy Lake): f walks toward the velocity (tx, tz) by the ground's rule (groundrules.js: on ice it eases, so it glides on
  // after letting go; an Ice creature keeps its grip); everywhere else at once, exactly as before. f.skid = it is sliding (skid marks).
  walk(f, tx, tz, dt) {
    const rule = this.g.rule?.(f.x, f.z, f.y), grip = !rule || rule.grips(f.type) || this.g.wet(f.x, f.z, f.y);
    if (grip) { f.vel.x = tx; f.vel.z = tz; f.skid = false; } else { rule.move(f.vel, tx, tz, dt, false); f.skid = Math.hypot(f.vel.x - tx, f.vel.z - tz) > 1.2; }
    if (!f.vel.x && !f.vel.z) return false;
    const stopped = this.move(f, f.vel.x * dt, f.vel.z * dt);
    if (stopped && !grip) { f.vel.x *= 0.3; f.vel.z *= 0.3; } // (a slide that hits a wall or the ring stops there)
    return stopped;
  }
  carryOf(f, kind) { return this.g.rule?.(f.x, f.z, f.y)?.carry(kind, f.type) ?? 0; }
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
    if (t.kind === 'line') { t.len = this.rushLen(f, t.dx, t.dz, t.len + (this.g.rule?.(f.x, f.z, f.y)?.overshoot(f.type) ?? 0)); t.y = f.y; } // (on ice a slipping monster overshoots: its red line is longer)
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
    if (dst.braceT > 0) { // braced: the hit bounces off and the monster that threw it is stopped for a moment
      this.emit({ kind: 'braced', f: dst }); this.stats.braced = (this.stats.braced || 0) + 1;
      if (src.side === 'foe' && src.alive) { src.tell = null; src.charging = null; src.timer = Math.max(src.timer, FIGHT.rush.stun); this.emit({ kind: 'interrupt', f: src }); }
      return 0;
    }
    if (dst.side === 'you') {
      if (this.healing) { this.healing = null; this.emit({ kind: 'healSpoilt', f: dst }); this.stats.spoilt = (this.stats.spoilt || 0) + 1; }
      if (dst.buffT > 0 && FIGHT.powerUp.lostOnHit) { dst.buffT = 0; dst.c.atkUp = 1; this.emit({ kind: 'buffLost', f: dst }); this.stats.buffLost = (this.stats.buffLost || 0) + 1; }
    }
    if (dst.grumble && src.side === 'you') { // the Grumble: full only on its back or just after its own attack
      const off = Math.abs(wrapAngle(Math.atan2(src.x - dst.x, src.z - dst.z) - dst.heading));
      const weak = off > GRUMBLE.back || dst.openT > 0;
      if (!weak) mult *= GRUMBLE.front;
      this.emit({ kind: weak ? 'weakSpot' : 'grumbleBonk', f: dst });
    }
    const { amount, eff } = damage(src.c, dst.c, power, type, mult);
    dst.hp = Math.max(0, dst.hp - amount);
    dst.flash = 0.25;
    if (dst.side === 'foe') dst.litT = this.dark()?.hitLit ?? 0; // Glowcap Caves: a monster you hit lights up for a moment
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
    this.dash = null; this.charge = { slot: -1, t: 0 }; this.healing = null; this.held = [0, 0, 0]; this.usedAt = [0, -1e9, -1e9, -1e9, -1e9];
    this.moves = f.c.moves.map(liveShape);
    if (m.c.livePower) this.moves.forEach(x => { if (x?.power) x.power = m.c.livePower; }); // (measurements only: tests/scribblemeasure.mjs)
    this.cd = this.cd.map((c, k) => (k ? 0 : c));
    this.emit({ kind: 'swap', f, old, auto });
    return true;
  }
  // ---------------------------------------------------------------- input (slot 0 = Dodge, 1-4 = your moves)
  press(slot) {
    if (this.over) return;
    if (slot === 0) return this.tryDodge();
    const s = this.moves[slot - 1];
    if (!s || this.cd[slot] > 0 || this.dash || this.healing) return;
    if (s.kind === 'burst') { this.charge = { slot, t: 0 }; return; }
    this.use(slot, 0);
  }
  // which moves each button holds (owner 2026-11-10: "a creature has 4 types of attacks and zero special. what to do there?"):
  // button 1 = attacks, button 2 = help moves; a creature with no help move puts its close-up attacks (rush, big blast) on button 2,
  // and if all its moves are of one side, the second half of them. No button sits empty while the creature has two moves.
  buttonsOf() {
    const ms = this.moves, sig = ms.map(m => m?.kind).join();
    if (this.layoutFor === sig) return this.layout;
    const att = [], sp = [];
    ms.forEach((s, k) => { if (s) (GROUP[s.kind] === 'special' ? sp : att).push(k + 1); });
    let a = att, b = sp;
    const split = list => { const near = list.filter(i => ['dash', 'burst'].includes(ms[i - 1].kind)), far = list.filter(i => !near.includes(i)); if (near.length && far.length) return [far, near]; const h = Math.ceil(list.length / 2); return [list.slice(0, h), list.slice(h)]; };
    if (!sp.length && att.length > 1) [a, b] = split(att);
    else if (!att.length && sp.length > 1) [a, b] = split(sp);
    this.layoutFor = sig; this.layout = [[], a, b];
    return this.layout;
  }
  // the move a button uses next (a move slot 1-4, 0 = none): the ready one of its moves used longest ago, else the one ready soonest
  nextMove(group) {
    let best = 0;
    const mine = this.buttonsOf()[typeof group === 'number' ? group : BUTTONS.indexOf(group)] || [];
    for (let i = 1; i <= 4; i++) {
      const s = this.moves[i - 1];
      if (!s || !mine.includes(i)) continue;
      if (!best) { best = i; continue; }
      const r = this.cd[i] <= 0, rb = this.cd[best] <= 0;
      if (r && !rb) best = i;
      else if (r === rb && (r ? this.usedAt[i] < this.usedAt[best] : this.cd[i] < this.cd[best])) best = i;
    }
    return best;
  }
  // the buttons (0 Dodge, 1 Attack, 2 Special): down / up
  push(b) {
    if (b === 0) return this.press(0);
    const i = this.nextMove(b);
    if (!i || this.cd[i] > 0) return;
    this.held[b] = i; this.press(i);
  }
  lift(b) { const i = this.held[b]; this.held[b] = 0; if (i) this.release(i); }
  release(slot) {
    if (this.charge.slot === slot) { const held = this.charge.t, k = Math.min(1, held / LIVE.charge); this.charge = { slot: -1, t: 0 }; this.use(slot, k, held); }
  }
  pick(f) { if (f?.alive) this.target = f; }
  tryDodge() {
    if (this.cd[0] > 0 || this.dash) return;
    if (this.healing) { this.healing = null; this.emit({ kind: 'healSpoilt', f: this.you }); }
    let { mx: dx, mz: dz } = this.input;
    if (!dx && !dz) { dx = -Math.sin(this.you.heading); dz = -Math.cos(this.you.heading); } // no stick: hop back
    const d = Math.hypot(dx, dz);
    this.dash = { x: dx / d, z: dz / d, t: LIVE.dodge.time, speed: LIVE.dodge.speed * this.paceNow(this.you), hits: null };
    this.you.safeT = LIVE.dodge.safe;
    this.cd[0] = LIVE.dodge.cool;
    this.emit({ kind: 'dodge' });
  }
  // the monster your moves go to: the one you tapped, else the nearest
  aimAt() {
    const you = this.you;
    if (!this.target?.alive) {
      this.target = null;
      let bd = Infinity;
      for (const f of this.foes) if (f.alive) { const d = len2(f.x - you.x, f.z - you.z); if (d < bd) { bd = d; this.target = f; } }
    }
    return this.target;
  }
  // how fast f walks and dodges now: its speed in the band, x Speed up while it lasts
  paceNow(f) { return f.pace * (f.speedT > 0 ? KIND_NUMBERS.speed.mult : 1); }
  // the big blast's ring for a charge k (0..1)
  blastR(k) { const B = FIGHT.burst; return B.r0 + (B.r1 - B.r0) * k; }
  use(slot, charge, held = 0) {
    const you = this.you, s = this.moves[slot - 1], t = this.aimAt();
    const cool = waitOf(s.kind), K = KIND_NUMBERS[s.kind] || {};
    this.usedAt[slot] = this.clock;
    this.cd[slot] = s.kind === 'burst' && FIGHT.burst.fromPress ? Math.max(0.2, cool - held) : cool; this.cdMax[slot] = cool;
    let dx = Math.sin(you.heading), dz = Math.cos(you.heading), dy = 0;
    if (t) { const d = len2(t.x - you.x, t.z - you.z) || 1; dx = (t.x - you.x) / d; dz = (t.z - you.z) / d; dy = (t.y - you.y) / d; }
    this.emit({ kind: 'move', s, slot });
    if (s.kind === 'bolt') this.fire(s, dx, dy, dz, K.hit);
    else if (s.kind === 'volley') { for (let i = 0; i < K.bits; i++) this.fire(s, dx, dy, dz, K.hit, i * 0.09, (i - (K.bits - 1) / 2) * K.spread); }
    else if (s.kind === 'burst') {
      const B = FIGHT.burst, r = this.blastR(charge), mult = B.m0 + (B.hit - B.m0) * charge ** B.pow;
      this.emit({ kind: 'burst', type: s.type, x: you.x, y: you.y, z: you.z, r, full: charge >= 1 });
      if (charge >= 1 && this.dark()) this.flashLit = { x: you.x, z: you.z, r: this.R * 2, t: this.dark().flash }; // Glowcap Caves: a full big blast lights up the whole ring
      for (const f of this.foes) if (f.alive && len2(f.x - you.x, f.z - you.z) < r + f.r * 0.5 && Math.abs(f.y - you.y) < 2.5) {
        const winding = !!f.tell && f.tell.left <= LIVE.foe.tell * B.stopWindow;
        this.hit(you, f, s.power, s.type, mult, 'burst');
        if (winding && f.alive) { // caught winding up: its attack is stopped and it is pushed away from you
          const d = len2(f.x - you.x, f.z - you.z) || 1;
          f.tell = null; f.timer = Math.max(f.timer, FIGHT.rush.stun);
          this.move(f, (f.x - you.x) / d * FIGHT.rush.knock, (f.z - you.z) / d * FIGHT.rush.knock);
          this.emit({ kind: 'interrupt', f });
        }
      }
    } else if (s.kind === 'dash') {
      // owner 2026-11-09 (rushers fainted fast, shooters won): a rush goes THROUGH the monster it aims at and ends behind it (out of
      // its stomp), as far as it needs (FIGHT.rush); a hit on a monster that is winding up cancels its attack and knocks it back
      const R0 = FIGHT.rush, inWindow = t?.tell && t.tell.left <= LIVE.foe.tell * (R0.window ?? 1);
      const reach = t && (inWindow || !R0.throughOnlyInWindow) ? Math.max(R0.min, Math.min(R0.max, len2(t.x - you.x, t.z - you.z) + R0.past)) : R0.min;
      this.dash = { x: dx, z: dz, t: reach / R0.speed, speed: R0.speed, hits: new Set(), s };
      you.safeT = R0.safe ?? reach / R0.speed + 0.05;
      if (s.recoil) { const n = Math.max(1, Math.round(you.maxHp * 0.06)); you.hp = Math.max(1, you.hp - n); this.emit({ kind: 'hit', f: you, amount: n, eff: 1 }); }
    } else if (s.kind === 'heal') { this.healing = { t: FIGHT.heal.time, of: you }; this.emit({ kind: 'resting' }); }
    else if (s.kind === 'buff') {
      if (s.stat === 'def') { you.guardT = FIGHT.tough.time; you.braceT = FIGHT.tough.brace; } else you.buffT = FIGHT.powerUp.time;
      this.emit({ kind: 'buff', def: s.stat === 'def' });
    } else if (s.kind === 'speed') { you.speedT = KIND_NUMBERS.speed.time; this.emit({ kind: 'speedUp', f: you }); }
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
    if (this.flashLit) { this.flashLit.t -= dt; if (this.flashLit.t <= 0) this.flashLit = null; }
    this.swapCool = Math.max(0, this.swapCool - dt);
    const you = this.you;
    for (let i = 0; i < 5; i++) this.cd[i] = Math.max(0, this.cd[i] - dt);
    for (const f of [you, ...this.foes]) {
      f.safeT = Math.max(0, f.safeT - dt); f.buffT = Math.max(0, f.buffT - dt); f.guardT = Math.max(0, f.guardT - dt);
      f.slowT = Math.max(0, f.slowT - dt); f.sleepT = Math.max(0, f.sleepT - dt); f.flash = Math.max(0, f.flash - dt); f.braceT = Math.max(0, f.braceT - dt);
      f.speedT = Math.max(0, f.speedT - dt); f.litT = Math.max(0, (f.litT || 0) - dt);
      if (f.grumble) f.openT = Math.max(0, f.openT - dt);
      f.c.atkUp = f.buffT > 0 ? FIGHT.powerUp.atk : 1; f.c.defUp = f.guardT > 0 ? FIGHT.tough.def : 1;
    }
    if (this.charge.slot > 0) { this.charge.t += dt; if (this.charge.t >= LIVE.charge) this.release(this.charge.slot); }
    // you
    if (this.healing) { // sitting down to heal: it cannot move; done = healed
      if (this.healing.of !== you) this.healing = null;
      else if ((this.healing.t -= dt) <= 0) { this.healing = null; this.heal(you, FIGHT.heal.amount); }
    }
    if (this.healing && !this.dash) { you.moving = false; }
    else if (this.dash) {
      const d = this.dash;
      const stopped = this.move(you, d.x * d.speed * dt, d.z * d.speed * dt);
      d.t -= dt;
      if (d.hits) for (const f of this.foes) if (f.alive && !d.hits.has(f) && len2(f.x - you.x, f.z - you.z) < f.r + you.r + 0.2 && Math.abs(f.y - you.y) < 1.6) {
        d.hits.add(f);
        const winding = !!f.tell && f.tell.left <= LIVE.foe.tell * (FIGHT.rush.window ?? 1); // (window: only the last part of the warning, when it pulses fastest)
        this.hit(you, f, d.s.power, d.s.type, winding ? FIGHT.rush.hit : FIGHT.rush.plain, 'dash');
        if (winding && f.alive && FIGHT.rush.interrupt) { // cancel its attack and knock it back
          f.tell = null; f.timer = Math.max(f.timer, FIGHT.rush.stun);
          this.move(f, d.x * FIGHT.rush.knock, d.z * FIGHT.rush.knock);
          this.emit({ kind: 'interrupt', f });
        }
      }
      if (stopped || d.t <= 0) { this.dash = null; const c = stopped ? 0 : this.carryOf(you, d.hits ? 'rush' : 'dodge'); you.vel.x = d.x * c; you.vel.z = d.z * c; } // (on ice it skids on)
      you.moving = true;
    } else {
      const { mx, mz } = this.input, m = Math.min(1, Math.hypot(mx, mz));
      you.moving = m > 0.05;
      const sp = LIVE.speed * this.paceNow(you) * m * (this.charge.slot > 0 ? 0.55 : 1) * (this.g.wet(you.x, you.z, you.y) ? swimOf(you) : 1);
      const k = Math.hypot(mx, mz) || 1, y0 = you.y;
      if (this.walk(you, you.moving ? mx / k * sp : 0, you.moving ? mz / k * sp : 0, dt) && you.moving) this.stats.blocked += dt;
      if (you.y !== y0) this.stats.snaps++;
      if (you.moving) this.dir = { x: mx, z: mz };
    }
    const t = this.aimAt();
    if (t) you.heading = Math.atan2(t.x - you.x, t.z - you.z);
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
      if (stopped || c.left <= 0) { f.charging = null; const k = stopped ? 0 : this.carryOf(f, 'rush'); f.vel.x = c.dx * k; f.vel.z = c.dz * k; } // (on ice it skids on)
      f.moving = true;
      return;
    }
    if (f.grumble) { const want = Math.atan2(you.x - f.x, you.z - f.z), d = wrapAngle(want - f.heading), m = GRUMBLE.turn * dt; f.heading = wrapAngle(f.heading + Math.max(-m, Math.min(m, d))); } // it turns slowly: you can get round it
    else f.heading = Math.atan2(you.x - f.x, you.z - f.z);
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
    const sp = F.speed * this.paceNow(f) * slow * (this.g.wet(f.x, f.z, f.y) ? swimOf(f) : 1);
    if (this.walk(f, vx / v * sp, vz / v * sp, dt)) { f.stuck = (f.stuck || 0) + dt; if (f.stuck > 0.6) { f.side2 = -f.side2; f.stuck = 0; } }
    for (const o of this.foes) if (o !== f && o.alive) { const ox = f.x - o.x, oz = f.z - o.z, od = len2(ox, oz); if (od < 1.4 && od > 0.01) this.move(f, ox / od * (1.4 - od) * 0.5, oz / od * (1.4 - od) * 0.5); }
    f.moving = true;
    f.timer -= dt * slow;
    if (f.timer <= 0) {
      const t = this.makeTell(f);
      t.left = F.tell;
      f.tell = t;
      f.timer = (F.every[0] + this.rand() * (F.every[1] - F.every[0])) * this.rhythm; // (the arena's Ice Lake has the same lever)
      this.emit({ kind: 'tell', f, t });
    }
  }
  strike(f, slow) {
    const you = this.you, t = f.tell;
    if (f.grumble) f.openT = GRUMBLE.open; // right after its own attack its back is open
    f.tell = null;
    if (t.kind === 'line') { f.charging = { dx: t.dx, dz: t.dz, left: t.len, hit: false }; this.emit({ kind: 'rush', f }); return; }
    this.emit({ kind: 'thud', f, t });
    if (you.safeT <= 0 && this.inTell(t, you.x, you.y, you.z, you.r)) this.hit(f, you, FIGHT.foePower, f.type, slow, t.kind === 'ring' ? 'stomp' : 'lob');
  }
  // what the HUD and the pad show
  pad() {
    return [
      { label: 'Dodge', icon: '', cd: this.cd[0] / LIVE.dodge.cool, dim: this.cd[0] > 0 },
      ...['attack', 'special'].map((g, k) => {
        const i = this.held[k + 1] || this.nextMove(k + 1), s = i ? this.moves[i - 1] : null;
        if (!s) return { label: g === 'attack' ? 'Attack' : 'Special', group: g, none: true, dim: true, cd: 0 };
        const c = this.cd[i], on = this.charge.slot === i;
        return { label: g === 'attack' ? 'Attack' : 'Special', group: g, move: s, icon: iconOf(s), cd: c / (this.cdMax[i] || 1), dim: c > 0 && !on, on, charge: on ? Math.min(1, this.charge.t / LIVE.charge) : 0 };
      }),
    ];
  }

  // ---------------------------------------------------------------- Glowcap Caves: what you can SEE (groundrules.js Dark). Only the look
  // and the bots read it (scribble.js hides what is not seen, the bots react only to what is seen); the sums never do.
  dark() { const r = this.g.rule?.(this.you.x, this.you.z, this.you.y); return r && r.sight(this.you.type) < Infinity ? r : null; }
  sight() { const r = this.dark(); return r ? r.sight(this.you.type) : Infinity; }
  // is monster f in sight: in your creature's light, glowing itself, just hit, or in a big blast's flash (no dark = always)
  sees(f) {
    const r = this.dark();
    if (!r || f.side !== 'foe') return true;
    if (f.litT > 0 || r.glows(f.type)) return true;
    if (this.flashLit && len2(f.x - this.flashLit.x, f.z - this.flashLit.z) < this.flashLit.r) return true;
    return len2(f.x - this.you.x, f.z - this.you.z) < r.sight(this.you.type) + f.r * 0.5;
  }
  // is f's red warning shown: a monster in sight shows all of it, one in the dark only its last `late` seconds (Ghost and Ninja: all of it)
  seesTell(f) { if (!f.tell) return false; const r = this.dark(); return !r || this.sees(f) || f.tell.left <= r.late || r.senses(this.you.type); } // (Ghost and Ninja sense every warning)

  info() {
    return { dark: this.dark() ? { sight: this.sight(), seen: this.foes.map(f => this.sees(f)) } : null, over: this.over, won: this.won, clock: +this.clock.toFixed(2), lead: this.lead,
      you: { x: this.you.x, y: this.you.y, z: this.you.z, hp: this.you.hp, maxHp: this.you.maxHp, species: this.you.c.species, moves: this.moves.map(s => s && s.kind) },
      squad: this.squad.map((m, i) => ({ species: m.c.species, hp: i === this.lead ? this.you.hp : m.hp })),
      foes: this.foes.map(f => ({ species: f.c.species, x: f.x, y: f.y, z: f.z, hp: f.hp, alive: f.alive, tell: f.tell ? f.tell.kind : null })), stats: this.stats };
  }
}

// ---------------------------------------------------------------- the fight camera (behind your creature), pure
// Night run 2026-11-09 (owner: "steeper camera: yes", plans/chapter3.md section 9): like the test arena's: fov 50, high, further back
// on a portrait screen. Owner 2026-11-10: "a bit too steep, flatten it slightly" (62 -> about 57 degrees down: 12.6 up, 8.2 back) and
// "a slight turn to cover for the scene is ok": the camera never follows your look; it turns by itself, slowly (at most `turnRate`
// rad/s, easing in and out), only while a monster is near the edge of the screen (`edge`) and only the way that brings it back in, so
// the stick's "up" changes slowly and seldom. (Turning toward the monsters' middle kept it turning all the time: they circle you.) A hill between the camera
// and your creature tips the camera up toward straight overhead, eased: it never jumps. scribble.js draws with it; tests/scribblebots.mjs measures what a child sees with it.
export const CAM = { up: 12.6, back: 8.2, fov: 50, ahead: 0.4, follow: 7, turn: 'frame', edge: 0.85, turnRate: 0.25, tip: 3, tall: 1.2 };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
// the living monsters (what the camera keeps in view)
export const foesMiddle = F => F.foes.filter(f => f.alive);
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
  // the pose at the current focus and tilt, for a yaw
  poseAt(yaw, tall) {
    const c = this.c, F = this.focus, y0 = this.yaw;
    this.yaw = yaw; const d = this.dirAt(this.tilt, tall); this.yaw = y0;
    return { x: F.x + d.x, y: F.y + 1 + d.y, z: F.z + d.z, at: { x: F.x - Math.sin(yaw) * c.ahead, y: F.y + 0.5, z: F.z - Math.cos(yaw) * c.ahead }, fov: c.fov };
  }
  // how far the monsters stick out of the frame (0 = all well inside `edge`)
  outOf(pose, aspect, foes) {
    let s = 0;
    for (const f of foes) { const q = onScreen(pose, aspect, f.x, f.y + 0.6, f.z); s += q ? Math.max(0, Math.abs(q.x) - this.c.edge) + Math.max(0, Math.abs(q.y) - this.c.edge) : 2; }
    return s;
  }
  // f: where your creature stands (x, y = its ground, z); look: the yaw to start from; aspect = width / height; foes: the living
  // monsters (turn 'frame': while one is near the edge of the screen the camera turns slowly the way that brings it back in)
  update(dt, f, look, aspect, ground, snap = false, foes = null) {
    const c = this.c;
    if (!this.focus) this.start(look, f.x, f.y, f.z);
    const k = snap ? 1 : 1 - Math.exp(-dt * c.follow), F = this.focus;
    F.x += (f.x - F.x) * k; F.y += (f.y - F.y) * k; F.z += (f.z - F.z) * k;
    const tall = Math.max(1, c.tall / Math.max(0.3, aspect));
    // tip up until the way is clear (eased: it never jumps). Blocked even from overhead (under a tree) = it stays where it is: pulling
    // in made the camera swing 1.5 blocks a frame (measured), and a creature under leaves is rare and brief.
    let wantTilt = this.tilt;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) if (this.clearTo(ground, this.dirAt(t, tall), 1)) { wantTilt = t; break; }
    if (snap) this.tilt = wantTilt;
    else this.tilt += (wantTilt - this.tilt) * (1 - Math.exp(-dt * (wantTilt > this.tilt ? c.tip : c.tip * 0.5)));
    if (c.turn === 'frame' && foes?.length && !snap) {
      const out = this.outOf(this.poseAt(this.yaw, tall), aspect, foes);
      if (out > 0) {
        const h = 0.05, l = this.outOf(this.poseAt(this.yaw - h, tall), aspect, foes), r = this.outOf(this.poseAt(this.yaw + h, tall), aspect, foes);
        const dir = l < out && l <= r ? -1 : r < out ? 1 : 0; // only a way that makes it better (monsters on both sides: it stays)
        this.speed = (this.speed || 0) + (dir * c.turnRate - (this.speed || 0)) * Math.min(1, dt * 3);
      } else this.speed = (this.speed || 0) * Math.max(0, 1 - dt * 3);
      this.yaw = wrapA(this.yaw + this.speed * dt);
    }
    return (this.pose = this.poseAt(this.yaw, tall));
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
