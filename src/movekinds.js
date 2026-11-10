// Owner 2026-11-10: "rush, shot, blast ... are the types of attacks" (the kinds chapter 3's fights already use), "object orientated".
// One object per KIND of move, decided from the move's own data (never by hand per move): Shot, Many shots, Big blast, Rush, and the
// helping kinds Heal, Power up, Slow cloud, Sleepy cloud. Each kind knows its word, icon and button group (chapter 3's fight reads them)
// and, for the attacking kinds, how its animation can be DESIGNED on the Wizard's drawing board (`slots`: shape, path, trail, size,
// pattern, ring, flash, move, hit... each a list of choices) and how a designed look is drawn in a battle (`recipe`, an fx.js recipe:
// (k, from, to, opts) => { dur, step(p) }, closed form, Math.random only through k.seeds).
// Pure: no imports (guardiankit.js, species.js, fx.js and the arena import this file, never the other way round).
// Every choice list is APPEND-ONLY: a design saves choice numbers.

/* ---- the choices ---- */
// The shape of a shot / its bits: an fx.js bitmap each (drawn large enough to tell apart).
export const SHAPES = [
  { name: 'Ball', icon: '⚪', tex: 'dot' }, { name: 'Star', icon: '⭐', tex: 'star' }, { name: 'Heart', icon: '❤️', tex: 'heart' },
  { name: 'Note', icon: '🎵', tex: 'note' }, { name: 'Drop', icon: '💧', tex: 'drop' }, { name: 'Leaf', icon: '🍃', tex: 'leaf' },
  { name: 'Gem', icon: '💎', tex: 'gem' }, { name: 'Bubble', icon: '🫧', tex: 'bubble' }, { name: 'Arrow', icon: '🏹', tex: 'arrow' },
  { name: 'Moon', icon: '🌙', tex: 'moon' }, { name: 'Zap', icon: '⚡', tex: 'zap' }, { name: 'Flame', icon: '🔥', tex: 'flame' },
  { name: 'Swirl', icon: '🌀', tex: 'swirl' }, { name: 'Flower', icon: '🌸', tex: 'flower' }, { name: 'Paw', icon: '🐾', tex: 'paw' },
  { name: 'Skull', icon: '💀', tex: 'skull' },
];
const opts = (list) => list.map(([name, icon]) => ({ name, icon }));
export const PATHS = opts([['Straight', '➡️'], ['Arc', '🌈'], ['Wiggle', '〰️'], ['Corkscrew', '🌀'], ['Curve', '↪️'], ['Bounce', '🏀']]);
export const TRAILS = opts([['None', '·'], ['Sparkles', '✨'], ['Ribbon', '🎀'], ['Puffs', '☁️'], ['Rainbow', '🌈'], ['Copies', '👯']]);
export const SIZES = opts([['Small', 'S'], ['Medium', 'M'], ['Big', 'L'], ['Huge', 'XL']]);
export const PATTERNS = opts([['Fan', '🪭'], ['Line', '🚂'], ['Zigzag', '⚡'], ['Circle', '⭕'], ['From the sky', '☄️'], ['All at once', '🎆']]);
export const RINGS = opts([['Wave', '🌊'], ['Double', '◎'], ['Star', '✴️'], ['Flower', '🌼'], ['Spiral', '🌀'], ['Spikes', '🦔']]);
export const FLASHES = opts([['None', '·'], ['Flash', '💡'], ['Light beam', '🔦'], ['Shower', '🎊']]);
export const MOVES_RUSH = opts([['Dash', '💨'], ['Hop', '🐇'], ['Spin', '🌪️'], ['Zigzag', '⚡']]);
export const TRAILS_RUSH = opts([['Speed lines', '💨'], ['Ghosts', '👻'], ['Sparkles', '✨'], ['Flames', '🔥'], ['Rainbow', '🌈']]);
export const HITS = opts([['Bonk', '💥'], ['Shock ring', '⭕'], ['Pop', '🎉'], ['Swirl', '🌀']]);

const SLOT = {
  shape: { id: 'shape', label: 'Shape', icon: '🔷', options: SHAPES },
  bits: { id: 'bits', label: 'Bits', icon: '✨', options: SHAPES },
  path: { id: 'path', label: 'Path', icon: '🛤️', options: PATHS },
  trail: { id: 'trail', label: 'Trail', icon: '☄️', options: TRAILS },
  size: { id: 'size', label: 'Size', icon: '📏', options: SIZES },
  pattern: { id: 'pattern', label: 'Pattern', icon: '🎯', options: PATTERNS },
  ring: { id: 'ring', label: 'Ring', icon: '◯', options: RINGS },
  flash: { id: 'flash', label: 'Middle', icon: '💡', options: FLASHES },
  move: { id: 'move', label: 'Move', icon: '🏃', options: MOVES_RUSH },
  rtrail: { id: 'trail', label: 'Trail', icon: '☄️', options: TRAILS_RUSH },
  hit: { id: 'hit', label: 'Hit', icon: '💥', options: HITS },
};
export const RUSH = { reach: 0.92, ms: 460 }; // battle.js: a designed Rush dashes this share of the way (minus both sizes), there and back
export const COLOURS = 2; // a look has two colours (the board's colour numbers; the caller turns them into hex lists)
export const LOOK_MAX = 16; // at most this many moves keep a look

/* ---- small closed-form helpers ---- */
const clamp01 = t => Math.min(1, Math.max(0, t));
const ease = t => 1 - (1 - t) * (1 - t);
const fadeOut = (p, from = 0.6) => (p < from ? 1 : Math.max(0, (1 - p) / (1 - from)));
const V = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
const A = V(), B = V();
const RAINBOW = [0xff6a6a, 0xffb050, 0xffe46b, 0x8fe388, 0x7ab8ff, 0xc99bff];
const pick = (list, i) => list[((i % list.length) + list.length) % list.length];
const SIZE_OF = [0.55, 0.85, 1.2, 1.65];

// A point on the way from the attacker to the target at t (0..1) for a path; phase / side shift one shot from another.
function along(k, path, t, out, phase = 0, side = 0) {
  const s = Math.sin(Math.PI * t);
  k.at(t, out, path === 1 ? 1.4 : path === 5 ? 0 : 0.15);
  let sd = side * s, up = 0;
  if (path === 2) sd += Math.sin(t * 4 * Math.PI + phase) * 0.5 * s;
  else if (path === 3) { sd += Math.cos(t * 14 + phase) * 0.45 * s; up = Math.sin(t * 14 + phase) * 0.45 * s; }
  else if (path === 4) sd += 1.6 * s;
  else if (path === 5) up = Math.abs(Math.sin(t * 3 * Math.PI)) * 0.9 - 0.2;
  out.x += k.side.x * sd; out.y += up; out.z += k.side.z * sd;
  return out;
}
// A burst of bits on the target: a ring flung out and a flash in the middle.
function hitBurst(k, to, look, n = 12, m = 1) {
  const ring = k.points({ n, tex: look.tex('bits'), size: 0.42 * m, glow: true, colors: [...look.c1, ...look.c2] });
  const mid = k.points({ n: 1, tex: 'dot', size: 0.9 * m, glow: true, colors: [0xffffff] });
  return q => {
    if (q <= 0) { for (let i = 0; i < n; i++) ring.hide(i); mid.hide(0); return; }
    const f = ease(clamp01(q));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 6.283 + 0.4, d = (0.2 + f * (0.8 + (i % 3) * 0.25)) * m;
      ring.set(i, to.pos.x + k.side.x * Math.cos(ang) * d, to.pos.y + Math.sin(ang) * d * 0.85, to.pos.z + k.side.z * Math.cos(ang) * d);
    }
    mid.set(0, to.pos.x, to.pos.y, to.pos.z);
    mid.material.size = (0.6 + 0.6 * Math.sin(Math.PI * clamp01(q))) * m;
    ring.fade(fadeOut(q, 0.5)); mid.fade(fadeOut(q, 0.3));
  };
}
// A trail behind a moving head: n points that follow `at(t)` a little later.
function trailOf(k, kind, look, n, at, lag) {
  if (kind === 0) return () => {};
  const tex = kind === 3 ? 'puff' : kind === 5 ? look.tex('shape') : kind === 1 ? 'star' : 'dot';
  const colors = kind === 4 ? RAINBOW : kind === 3 ? [look.c2[0], 0xffffff] : [...look.c2, ...look.c1];
  const size = kind === 3 ? 0.55 : kind === 5 ? 0.4 : kind === 2 ? 0.26 : 0.32;
  const pts = k.points({ n, tex, size, glow: kind !== 3, colors });
  const s = k.seeds(n, 2);
  return (t, p) => {
    for (let i = 0; i < n; i++) {
      const ti = t - (i + 1) * lag;
      if (ti <= 0 || t >= 1) { pts.hide(i); continue; }
      at(ti, B);
      const j = kind === 1 ? 0.35 : kind === 3 ? 0.15 : 0;
      pts.set(i, B.x + (s[i * 2] - 0.5) * j, B.y + (s[i * 2 + 1] - 0.5) * j + (kind === 3 ? (t - ti) * 0.6 : 0), B.z + (s[i * 2] - 0.5) * j);
    }
    pts.fade(0.95 * fadeOut(p, 0.7));
  };
}

/* ---- the kinds ---- */
export class MoveKind {
  constructor({ id, word, icon, group }) { this.id = id; this.word = word; this.icon = icon; this.group = group; }
  get attack() { return this.group === 'attack'; }
  get slots() { return []; }
  get designable() { return this.slots.length > 0; }
  // the look a move gets when it is first designed
  defaultLook(c = [0, 1]) { return { p: this.slots.map(s => (s.id === 'size' ? 1 : 0)), c: [...c] }; }
  // a saved look -> choice numbers that exist (junk -> the first choice)
  cleanLook(look) {
    const p = Array.isArray(look?.p) ? look.p : [];
    return { p: this.slots.map((s, i) => (Number.isInteger(p[i]) && p[i] >= 0 && p[i] < s.options.length ? p[i] : s.id === 'size' ? 1 : 0)), c: Array.isArray(look?.c) ? look.c.slice(0, COLOURS) : [] };
  }
  // the choice of slot `id` in a look (by the slot's id)
  choice(look, id) { const i = this.slots.findIndex(s => s.id === id); return i < 0 ? 0 : look.p[i] ?? 0; }
  // how the attacker moves before the effect (battle.js lunge): null = the usual little lunge
  lunge() { return null; }
  recipe() { return null; }
}

class Shot extends MoveKind {
  get slots() { return [SLOT.shape, SLOT.path, SLOT.trail, SLOT.size]; }
  recipe(k, from, to, look) {
    const sh = look.ch('shape'), path = look.ch('path'), tr = look.ch('trail'), m = SIZE_OF[look.ch('size')] ?? 0.7, fly = 0.62;
    const halo = k.points({ n: 1, tex: 'dot', size: m * 1.5, glow: true, colors: [look.c2[0]], opacity: 0.45 });
    const head = k.points({ n: 1, tex: SHAPES[sh].tex, size: m, glow: true, colors: [look.c1[0]] });
    const at = (t, out) => along(k, path, t, out);
    const trail = trailOf(k, tr, look, tr === 2 ? 16 : 10, at, tr === 2 ? 0.02 : 0.045);
    const hit = hitBurst(k, to, look, 12, Math.max(0.8, m));
    return {
      dur: 720,
      step(p) {
        const t = clamp01(p / fly);
        if (t >= 1) { head.hide(0); halo.hide(0); } else { at(t, A); head.set(0, A.x, A.y, A.z); halo.set(0, A.x, A.y, A.z); }
        if (look.rainbow1) head.color(0, pick(RAINBOW, Math.floor(p * 12)));
        trail(t, p);
        hit((p - fly) / (1 - fly));
      },
    };
  }
}

class Volley extends MoveKind {
  get slots() { return [SLOT.shape, SLOT.pattern, SLOT.trail, SLOT.size]; }
  recipe(k, from, to, look) {
    const N = 5, sh = look.ch('shape'), pat = look.ch('pattern'), tr = look.ch('trail'), m = (SIZE_OF[look.ch('size')] ?? 0.7) * 0.8;
    const heads = k.points({ n: N, tex: SHAPES[sh].tex, size: m, glow: true, colors: look.c1.length > 1 ? look.c1 : [look.c1[0], look.c2[0]] });
    const T = 3, tail = tr ? k.points({ n: N * T, tex: tr === 3 ? 'puff' : tr === 5 ? SHAPES[sh].tex : tr === 1 ? 'star' : 'dot', size: tr === 3 ? 0.4 : 0.24, glow: tr !== 3, colors: tr === 4 ? RAINBOW : [...look.c2, ...look.c1] }) : null;
    const hit = hitBurst(k, to, look, 12, 1.1);
    const delay = i => (pat === 1 ? i * 0.1 : pat === 5 ? 0 : pat === 3 ? 0 : i * 0.06);
    const fly = 0.42;
    const pos = (i, t, out) => {
      if (pat === 3) { // round the attacker first, then off
        const orbit = clamp01(t / 0.35), ang = (i / N) * 6.283 + orbit * 6;
        const ox = from.pos.x + Math.cos(ang) * (from.r + 0.6), oz = from.pos.z + Math.sin(ang) * (from.r + 0.6), oy = from.top + 0.2;
        if (t < 0.35) return out.set(ox, oy, oz);
        const u = (t - 0.35) / 0.65;
        along(k, 0, u, B);
        return out.set(ox + (B.x - ox) * u, oy + (B.y - oy) * u, oz + (B.z - oz) * u);
      }
      if (pat === 4) { // from the sky over the target
        const sx = to.pos.x + k.side.x * (i - 2) * 0.55, sz = to.pos.z + k.side.z * (i - 2) * 0.55;
        return out.set(sx + (to.pos.x - sx) * t, to.top + 3.2 - (to.top + 3.2 - to.pos.y) * t * t, sz + (to.pos.z - sz) * t);
      }
      if (pat === 2) return along(k, 2, t, out, i * Math.PI, 0);
      if (pat === 5) return along(k, 1, t, out, 0, (i - 2) * 0.8);
      return along(k, 0, t, out, 0, pat === 0 ? (i - 2) * 0.7 : 0);
    };
    return {
      dur: 900,
      step(p) {
        let last = 0;
        for (let i = 0; i < N; i++) {
          const t = clamp01((p - delay(i)) / fly);
          last = Math.max(last, delay(i) + fly);
          if (t <= 0 || t >= 1) { heads.hide(i); for (let j = 0; tail && j < T; j++) tail.hide(i * T + j); continue; }
          pos(i, t, A); heads.set(i, A.x, A.y, A.z);
          for (let j = 0; tail && j < T; j++) { const tj = t - (j + 1) * 0.06; if (tj <= 0) tail.hide(i * T + j); else { pos(i, tj, B); tail.set(i * T + j, B.x, B.y, B.z); } }
        }
        tail?.fade(0.9);
        hit((p - last) / (1 - last));
      },
    };
  }
}

class Burst extends MoveKind {
  get slots() { return [SLOT.ring, SLOT.bits, SLOT.flash]; }
  recipe(k, from, to, look) {
    const N = 30, ring = look.ch('ring'), fl = look.ch('flash');
    const pts = k.points({ n: N, tex: look.tex('bits'), size: 0.72, glow: true, colors: look.c1.length > 1 ? look.c1 : [look.c1[0], look.c2[0]] });
    const mid = fl ? k.points({ n: fl === 1 ? 1 : 10, tex: fl === 1 ? 'dot' : fl === 2 ? 'dot' : look.tex('bits'), size: fl === 1 ? 1.4 : 0.45, glow: true, colors: [look.c2[0], 0xffffff] }) : null;
    const s = k.seeds(10, 2);
    const reach = k.dist + 0.6, y0 = 2 * from.pos.y - from.top + 0.3; // round the attacker's feet, out past the target
    const hit = hitBurst(k, to, look, 10, 1);
    const grow = 0.65;
    return {
      dur: 950,
      step(p) {
        const g = ease(clamp01(p / grow)), R = 0.3 + g * reach, spin = p * 1.6;
        for (let i = 0; i < N; i++) {
          let th = (i / N) * 6.283 + spin, r = R, up = 0;
          if (ring === 1) r = i % 2 ? R : R * 0.62;
          else if (ring === 2) r = R * (0.62 + 0.38 * Math.abs(Math.cos(2.5 * (i / N) * 6.283)));
          else if (ring === 3) r = R * (0.55 + 0.45 * Math.abs(Math.sin(3 * (i / N) * 6.283)));
          else if (ring === 4) { const arm = i % 3, j = Math.floor(i / 3) / (N / 3 - 1); r = R * j; th = arm * 2.094 + j * 3 + spin * 2; }
          else if (ring === 5) up = (i % 2) * 1.1 * Math.sin(Math.PI * clamp01(p / grow));
          pts.set(i, from.pos.x + Math.cos(th) * r, y0 + up, from.pos.z + Math.sin(th) * r);
        }
        pts.fade(fadeOut(p, 0.6));
        if (mid) {
          if (fl === 1) { mid.set(0, from.pos.x, from.pos.y, from.pos.z); mid.material.size = 0.4 + 1.6 * Math.sin(Math.PI * clamp01(p / 0.5)); }
          else for (let i = 0; i < 10; i++) {
            if (fl === 2) mid.set(i, from.pos.x, from.pos.y + ((i / 10 + p * 2) % 1) * 3.5, from.pos.z); // a beam of light up out of it
            else { const a = s[i * 2] * 6.283, d = s[i * 2 + 1] * R; mid.set(i, from.pos.x + Math.cos(a) * d, y0 + 3 - ((p * 2 + s[i * 2]) % 1) * 3, from.pos.z + Math.sin(a) * d); }
          }
          mid.fade(fadeOut(p, 0.55));
        }
        // the ring reaches the target: a hit there
        const a = clamp01((k.dist - 0.3) / reach), tHit = (1 - Math.sqrt(1 - a)) * grow; // when the ring's radius reaches the target (ease's inverse)
        hit((p - tHit) / (1 - tHit));
      },
    };
  }
}

class Dash extends MoveKind {
  get slots() { return [SLOT.move, SLOT.rtrail, SLOT.hit, SLOT.bits]; }
  lunge(look) { const m = look.ch('move'); return { far: true, hop: m === 1, spin: m === 2, zig: m === 3 }; }
  recipe(k, from, to, look) {
    const N = 12, tr = look.ch('trail'), ht = look.ch('hit');
    const tex = tr === 0 ? 'streak' : tr === 1 ? 'dot' : tr === 3 ? 'flame' : tr === 4 ? 'dot' : look.tex('bits');
    const trail = k.points({ n: N, tex, size: tr === 1 ? 0.95 : tr === 0 ? 0.6 : 0.42, glow: true, colors: tr === 4 ? RAINBOW : tr === 3 ? [0xff8a2a, 0xffd25a, look.c1[0]] : [...look.c1, ...look.c2], opacity: tr === 1 ? 0.5 : 1 });
    const s = k.seeds(N, 2);
    const R = 14, ring = k.points({ n: R, tex: ht === 0 ? 'star' : look.tex('bits'), size: ht === 0 ? 0.5 : 0.42, glow: true, colors: [...look.c1, ...look.c2] });
    const big = k.points({ n: 1, tex: ht === 0 ? 'star' : 'dot', size: 1, glow: true, colors: [ht === 0 ? 0xfff2a0 : 0xffffff] });
    return {
      dur: 650,
      step(p) {
        for (let i = 0; i < N; i++) { // what it left on the way it went
          const t = 0.08 + 0.85 * (i / N);
          k.at(t, A, 0.1);
          const back = p * 0.7 * (1 - t), j = tr === 2 ? 0.6 : tr === 3 ? 0.3 : 0.2;
          trail.set(i, A.x - k.dir.x * back + k.side.x * (s[i * 2] - 0.5) * j, A.y + (s[i * 2 + 1] - 0.5) * j + (tr === 3 ? p * 0.8 : 0), A.z - k.dir.z * back + k.side.z * (s[i * 2] - 0.5) * j);
        }
        trail.fade(fadeOut(p, 0.35));
        const q = clamp01(p / 0.75), f = ease(q);
        for (let i = 0; i < R; i++) {
          const a = (i / R) * 6.283;
          let x = 0, y = 0, z = 0;
          if (ht === 1) { const d = 0.3 + f * 1.6; x = Math.cos(a) * d; z = Math.sin(a) * d; y = -0.2; } // a flat shock ring on the ground
          else if (ht === 3) { const d = (to.r + 0.4) * (1 - f * 0.5), aa = a + f * 9; x = Math.cos(aa) * d; z = Math.sin(aa) * d; y = -0.4 + f * 1.4; }
          else { const d = 0.2 + f * (0.9 + (i % 3) * 0.3); x = k.side.x * Math.cos(a) * d; y = Math.sin(a) * d * 0.85; z = k.side.z * Math.cos(a) * d; }
          ring.set(i, to.pos.x + x, to.pos.y + y, to.pos.z + z);
        }
        ring.fade(fadeOut(p, 0.6));
        big.set(0, to.pos.x - k.dir.x * to.r, to.top + (ht === 0 ? 0.2 : -0.3), to.pos.z - k.dir.z * to.r);
        big.material.size = (ht === 0 ? 1.4 : 0.9) * Math.sin(Math.PI * clamp01(p / 0.5));
        big.fade(fadeOut(p, 0.45));
      },
    };
  }
}

export const KINDS = {
  bolt: new Shot({ id: 'bolt', word: 'shot', icon: '●', group: 'attack' }), // order = the old ICON / GROUP tables'
  volley: new Volley({ id: 'volley', word: 'many shots', icon: '●●●', group: 'attack' }),
  burst: new Burst({ id: 'burst', word: 'big blast', icon: '◎', group: 'attack' }),
  dash: new Dash({ id: 'dash', word: 'rush', icon: '➜', group: 'attack' }),
  heal: new MoveKind({ id: 'heal', word: 'heal', icon: '✚', group: 'special' }),
  buff: new MoveKind({ id: 'buff', word: 'power up', icon: '▲', group: 'special' }),
  cloud: new MoveKind({ id: 'cloud', word: 'slow cloud', icon: '☁', group: 'special' }),
  sleep: new MoveKind({ id: 'sleep', word: 'sleepy cloud', icon: '☾', group: 'special' }),
};
// Names for the board (a child reads them): "Big blast", "Rush".
export const KIND_NAME = { bolt: 'Shot', volley: 'Many shots', burst: 'Big blast', dash: 'Rush', heal: 'Heal', buff: 'Power up', cloud: 'Slow cloud', sleep: 'Sleepy cloud' };

// A battle move's kind from its data (the one rule; chapter 3's arena `shapeOf` asks it too).
export function kindOfMove(m) {
  if (!m) return null;
  const k = m.fx?.kind;
  if (!m.power) {
    if (k === 'heal') return KINDS.heal;
    if (k === 'sleep') return KINDS.sleep;
    if (k === 'lower' || k === 'curse') return KINDS.cloud;
    return KINDS.buff; // raise, rally, shield, field, anything else
  }
  if (k === 'multi') return KINDS.volley;
  if (m.priority || k === 'recoil') return KINDS.dash;
  if (m.power >= 80 || k === 'risky' || k === 'sacrifice' || k === 'lastword') return KINDS.burst;
  if (k === 'sleep') return KINDS.sleep;
  return KINDS.bolt;
}

// A design's saved looks: { moveId: { p: [choice numbers], c: [colour numbers] } }, cleaned without knowing the moves (the kind cleans
// its own choices when it draws). `okColour(n)` says whether a colour number exists.
export function cleanLooks(a, okColour) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const out = {};
  let n = 0;
  for (const [id, v] of Object.entries(a)) {
    if (n >= LOOK_MAX) break;
    if (!/^[a-z][a-z0-9]{0,31}$/.test(id) || !v || typeof v !== 'object' || !Array.isArray(v.p) || v.p.length > 8) continue;
    const p = v.p.map(x => (Number.isInteger(x) && x >= 0 && x < 64 ? x : 0));
    const c = (Array.isArray(v.c) ? v.c : []).slice(0, COLOURS).filter(okColour);
    out[id] = { p, c };
    n++;
  }
  return n ? out : null;
}

// A look ready to draw: the kind, its choices by slot id, two colour lists (hex; a rainbow colour = the rainbow).
// hexOf(n) -> a hex or null for the rainbow.
export function makeLook(kind, raw, hexOf) {
  if (!kind?.designable) return null;
  const L = kind.cleanLook(raw);
  const col = n => { const h = hexOf(n); return h == null ? RAINBOW : [h]; };
  const c1 = col(L.c[0] ?? 0), c2 = col(L.c[1] ?? L.c[0] ?? 0);
  const look = { kind, p: L.p, c: L.c, c1, c2, rainbow1: c1.length > 1,
    ch: id => kind.choice(L, id),
    tex: id => SHAPES[kind.choice(L, kind.slots.some(sl => sl.id === id) ? id : 'shape')]?.tex ?? 'star' };
  return look;
}
