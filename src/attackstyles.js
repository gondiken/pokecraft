// Owner 2026-11-09 ("we should also be able to design custom creature's attack animation ... a rush, a shot, a blast"): the guardian's
// Attack Studio (?preview for now). Pure, no imports: the styles, the sparkle shapes and their fx recipes (fx.js runs them like any
// TRAVEL recipe: (k, from, to, opts) => { dur, step(p) }, closed form, Math.random only through k.seeds).
// A guardian's design may carry `a: { moveId: style }` (style 1.. ; 0 = Paint, the Custom type's own look, never stored) and
// `s: sparkle` (0 = star, never stored); guardiankit.js cleanDesign keeps them, `lookOf` (guardiankit.js) turns them into
// { style, tex, colours } for fx.attack. Purely a look: nothing in a battle's sums or draws changes, so duels stay in step.

// Ids are saved by index: append only.
export const STYLES = [
  { id: 'paint', name: 'Paint', icon: '🎨' },  // the Custom type's paint blobs (or the move's own signature look)
  { id: 'rush', name: 'Rush', icon: '💨' },    // it dashes all the way to the foe (battle.js lunge) and bursts on it
  { id: 'shot', name: 'Shot', icon: '🎯' },    // one big glowing ball flies straight, a tail of sparkles behind
  { id: 'blast', name: 'Blast', icon: '💥' },  // sparkles gather in front of it, then a wide beam bursts at the foe
  { id: 'rain', name: 'Rain', icon: '🌧️' },    // sparkles pour down on the foe from above
  { id: 'spin', name: 'Spin', icon: '🌀' },    // two corkscrews of sparkles twist their way over
];
// The sparkle every style is made of (fx.js BITMAPS names). Append only.
export const SPARKLES = [
  { tex: 'star', name: 'Stars', icon: '⭐' },
  { tex: 'heart', name: 'Hearts', icon: '❤️' },
  { tex: 'note', name: 'Notes', icon: '🎵' },
  { tex: 'drop', name: 'Drops', icon: '💧' },
  { tex: 'leaf', name: 'Leaves', icon: '🍃' },
  { tex: 'coin', name: 'Coins', icon: '🪙' },
  { tex: 'bubble', name: 'Bubbles', icon: '🫧' },
  { tex: 'gem', name: 'Gems', icon: '💎' },
];
export const STYLE_MAX = 16; // at most this many moves keep a style (a guardian knows 4, learned ones come and go)
export const RUSH = { reach: 0.92, ms: 460 }; // battle.js: a Rush dashes this share of the way (minus both sizes), there and back

const clamp01 = t => Math.min(1, Math.max(0, t));
const fadeOut = (p, from = 0.6) => (p < from ? 1 : (1 - p) / (1 - from));
const ease = t => 1 - (1 - t) * (1 - t);
const V = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
const A = V(), B = V();

// The burst on the target every style ends with: sparkles thrown out in a ring, a big one in the middle.
function burst(k, to, look, p, ring, mid, N, m = 1) {
  const f = ease(clamp01(p));
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * 6.283 + 0.4, d = (0.15 + f * (0.7 + (i % 3) * 0.2)) * m;
    ring.set(i, to.pos.x + k.side.x * Math.cos(ang) * d, to.pos.y + Math.sin(ang) * d * 0.85, to.pos.z + k.side.z * Math.cos(ang) * d);
  }
  mid.set(0, to.pos.x, to.pos.y, to.pos.z);
  mid.material.size = (0.5 + 0.5 * Math.sin(Math.PI * clamp01(p))) * m;
}

export const STYLE_FX = {
  // the creature has already dashed (battle.js lunge with RUSH): streaks along the way it went and a big bonk on the foe
  rush(k, from, to, { look }) {
    const N = 10, R = 12;
    const trail = k.points({ n: N, tex: look.tex, size: 0.3, glow: true, colors: look.colours });
    const ring = k.points({ n: R, tex: look.tex, size: 0.32, glow: true, colors: look.colours });
    const mid = k.points({ n: 1, tex: 'star', size: 0.6, glow: true, colors: [0xffffff] });
    const s = k.seeds(N, 1);
    return {
      dur: 520,
      step(p) {
        for (let i = 0; i < N; i++) { // the speed lines: left behind along the path, drifting back and fading
          const t = 0.15 + 0.85 * (i / N);
          k.at(t, A, 0.1);
          const back = p * 0.6 * (1 - t);
          trail.set(i, A.x - k.dir.x * back + k.side.x * (s[i] - 0.5) * 0.5, A.y + (s[i] - 0.5) * 0.5, A.z - k.dir.z * back + k.side.z * (s[i] - 0.5) * 0.5);
        }
        trail.fade(fadeOut(p, 0.3));
        burst(k, to, look, p / 0.7, ring, mid, R, 1.2);
        ring.fade(fadeOut(p, 0.55)); mid.fade(fadeOut(p, 0.4));
      },
    };
  },
  // one big ball in its colours, straight and quick, with a tail; a burst when it lands
  shot(k, from, to, { look }) {
    const T = 8, R = 10, fly = 0.62;
    const ball = k.points({ n: 1, tex: 'dot', size: 0.7, glow: true, colors: [look.colours[0]] });
    const core = k.points({ n: 1, tex: look.tex, size: 0.45, glow: true, colors: [look.colours[1] ?? 0xffffff] });
    const tail = k.points({ n: T, tex: look.tex, size: 0.26, glow: true, colors: look.colours });
    const ring = k.points({ n: R, tex: look.tex, size: 0.3, glow: true, colors: look.colours });
    const mid = k.points({ n: 1, tex: 'dot', size: 0.6, glow: true, colors: [0xffffff] });
    return {
      dur: 640,
      step(p) {
        const t = clamp01(p / fly);
        if (t >= 1) { ball.hide(0); core.hide(0); } else { k.at(t, A, 0.15); ball.set(0, A.x, A.y, A.z); core.set(0, A.x, A.y, A.z); }
        for (let i = 0; i < T; i++) {
          const ti = t - (i + 1) * 0.05;
          if (ti <= 0 || t >= 1) { tail.hide(i); continue; }
          k.at(ti, B, 0.15);
          tail.set(i, B.x, B.y + Math.sin(i * 1.7 + p * 20) * 0.08, B.z);
        }
        tail.fade(0.9);
        const q = (p - fly) / (1 - fly);
        if (q <= 0) { for (let i = 0; i < R; i++) ring.hide(i); mid.hide(0); return; }
        burst(k, to, look, q, ring, mid, R);
        ring.fade(fadeOut(q, 0.5)); mid.fade(fadeOut(q, 0.3));
      },
    };
  },
  // gather (sparkles swirl into a point in front of it), then a beam of them streams to the foe and bursts
  blast(k, from, to, { look }) {
    const G = 10, S = 16, R = 12, charge = 0.35;
    const gather = k.points({ n: G, tex: look.tex, size: 0.28, glow: true, colors: look.colours });
    const beam = k.points({ n: S, tex: look.tex, size: 0.34, glow: true, colors: look.colours });
    const ring = k.points({ n: R, tex: look.tex, size: 0.36, glow: true, colors: look.colours });
    const mid = k.points({ n: 1, tex: 'dot', size: 0.7, glow: true, colors: [0xffffff] });
    const s = k.seeds(S, 2);
    return {
      dur: 820,
      step(p) {
        k.at(0, A, 0);
        const c = clamp01(p / charge);
        for (let i = 0; i < G; i++) { // closing in on the muzzle
          if (c >= 1) { gather.hide(i); continue; }
          const ang = (i / G) * 6.283 + c * 6, r = 0.9 * (1 - c);
          gather.set(i, A.x + k.side.x * Math.cos(ang) * r, A.y + Math.sin(ang) * r, A.z + k.side.z * Math.cos(ang) * r);
        }
        gather.fade(0.4 + 0.6 * c);
        const b = (p - charge) / (1 - charge);
        for (let i = 0; i < S; i++) { // a stream, a little wider towards the foe
          const t = b * 1.6 - (i / S) * 0.6;
          if (b <= 0 || t <= 0 || t >= 1) { beam.hide(i); continue; }
          k.at(t, B, 0);
          const w = 0.1 + t * 0.45;
          beam.set(i, B.x + k.side.x * (s[i * 2] - 0.5) * w * 2, B.y + (s[i * 2 + 1] - 0.5) * w * 2, B.z + k.side.z * (s[i * 2] - 0.5) * w * 2);
        }
        beam.fade(b <= 0 ? 0 : fadeOut(b, 0.7));
        const q = (b - 0.45) / 0.55;
        if (q <= 0) { for (let i = 0; i < R; i++) ring.hide(i); mid.hide(0); return; }
        burst(k, to, look, q, ring, mid, R, 1.4);
        ring.fade(fadeOut(q, 0.5)); mid.fade(fadeOut(q, 0.3));
      },
    };
  },
  // a little cloud of its sparkles over the foe, pouring down on it
  rain(k, from, to, { look }) {
    const N = 18, top = to.top + 1.6;
    const drops = k.points({ n: N, tex: look.tex, size: 0.3, glow: true, colors: look.colours });
    const cloud = k.points({ n: 5, tex: 'puff', size: 0.75, colors: [look.colours[0], 0xffffff] });
    const s = k.seeds(N, 3);
    return {
      dur: 900,
      step(p) {
        const up = clamp01(p / 0.2);
        for (let i = 0; i < 5; i++) cloud.set(i, to.pos.x + k.side.x * (i - 2) * 0.32, top + 0.15 + (i % 2) * 0.12, to.pos.z + k.side.z * (i - 2) * 0.32);
        cloud.fade(0.85 * up * fadeOut(p, 0.75));
        for (let i = 0; i < N; i++) {
          const t = (p - 0.15 - s[i * 3] * 0.45) / 0.35;
          if (t <= 0 || t >= 1) { drops.hide(i); continue; }
          const ox = (s[i * 3 + 1] - 0.5) * (to.r + 0.5) * 2, oz = (s[i * 3 + 2] - 0.5) * 0.6;
          drops.set(i, to.pos.x + k.side.x * ox + k.dir.x * oz, top - t * t * (top - to.pos.y + 0.2), to.pos.z + k.side.z * ox + k.dir.z * oz);
        }
        drops.fade(fadeOut(p, 0.85));
      },
    };
  },
  // two corkscrews of sparkles twisting round the line between them
  spin(k, from, to, { look }) {
    const N = 16, R = 10;
    const twist = k.points({ n: N, tex: look.tex, size: 0.3, glow: true, colors: look.colours });
    const ring = k.points({ n: R, tex: look.tex, size: 0.3, glow: true, colors: look.colours });
    const mid = k.points({ n: 1, tex: 'dot', size: 0.5, glow: true, colors: [0xffffff] });
    return {
      dur: 760,
      step(p) {
        for (let i = 0; i < N; i++) {
          const arm = i % 2, j = (i - arm) / 2, t = p * 1.4 - (j / (N / 2)) * 0.4;
          if (t <= 0 || t >= 1) { twist.hide(i); continue; }
          k.at(t, A, 0.3);
          const ang = t * 14 + arm * Math.PI, r = 0.45 * Math.sin(Math.PI * t) + 0.1;
          twist.set(i, A.x + k.side.x * Math.cos(ang) * r, A.y + Math.sin(ang) * r, A.z + k.side.z * Math.cos(ang) * r);
        }
        twist.fade(fadeOut(p, 0.75));
        const q = (p - 0.6) / 0.4;
        if (q <= 0) { for (let i = 0; i < R; i++) ring.hide(i); mid.hide(0); return; }
        burst(k, to, look, q, ring, mid, R);
        ring.fade(fadeOut(q, 0.5)); mid.fade(fadeOut(q, 0.3));
      },
    };
  },
};

// Junk -> a clean `a` (or null when empty) and `s` (or null for the default star).
export function cleanStyles(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const out = {};
  let n = 0;
  for (const [id, v] of Object.entries(a)) {
    if (n >= STYLE_MAX) break;
    if (!/^[a-z][a-z0-9]{0,31}$/.test(id) || !Number.isInteger(v) || v < 1 || v >= STYLES.length) continue;
    out[id] = v; n++;
  }
  return n ? out : null;
}
export const cleanSparkle = s => (Number.isInteger(s) && s > 0 && s < SPARKLES.length ? s : null);
