// Attack animation recipes for fx.js. One TRAVEL (the part that flies from attacker to target, awaited
// by the battle, 350-450 ms) and one IMPACT (the burst on the target, 300-400 ms) per type, plus SIG
// for signature moves and FX_COLORS (used by the aura of status moves).
//
// A recipe is (k, from, to, opts) => ({ dur, step(p) }). `k` is the kit from fx.js (k.points, k.mesh,
// k.sprite, k.seeds, k.at, k.dir, k.side, k.dist), `from`/`to` are spots { pos, top, r } and opts has
// { type, big }. step(p) must place everything for progress p in 0..1 (closed form, no state carried
// between frames) and may only use Math.random through k.seeds() when the effect starts.
// A type without a recipe uses the normal one. To add a type: add its entries to all four tables.
import * as THREE from 'three';

export const TRAVEL = {};
export const IMPACT = {};
export const SIG = {};

export const FX_COLORS = {
  normal: [0xffffff, 0xf2e8a0], fire: [0xff7a1a, 0xffc83a], water: [0x5aa4ff, 0xbfe0ff], grass: [0x6fd35a, 0xb8f090],
  electric: [0xfff25a, 0xffffff], rock: [0xa08050, 0xd8c080], ice: [0xbff0ff, 0xffffff], bug: [0xd8e04a, 0x8a9a30],
  ghost: [0xb08aff, 0x7a5ac0], mind: [0xf584b8, 0xffc0e0], metal: [0xd8e0e8, 0x9aa8b8], toxic: [0xb36ad6, 0x8a40b0],
  pixie: [0xffb8e6, 0xffffff], drake: [0x8f7cff, 0x5a48c8], rainbow: [0xff6a6a, 0xffd36b, 0x8fe388, 0x7ab8ff, 0xc99bff],
  cosmic: [0x8e9bff, 0xe7c6ff, 0xffffff], sound: [0x4fd8c4, 0xb8fff0], bone: [0xe9e0c9, 0xffffff], alien: [0x8dff6a, 0xb98cff],
};

const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.min(1, Math.max(0, t));
const fadeOut = (p, from = 0.6) => (p < from ? 1 : (1 - p) / (1 - from));
const feetOf = s => 2 * s.pos.y - s.top;

// Head of a stream of N particles: particle i trails the head by `lag` of the path. Returns t or -1.
const trailT = (p, i, n, lag) => {
  const t = p * (1 + lag) - (i / n) * lag;
  return t < 0 || t > 1 ? -1 : t;
};

/* ------------------------------- normal ------------------------------- */

TRAVEL.normal = k => {
  const N = 6;
  const pts = k.points({ n: N, tex: 'dot', size: 0.32, glow: true, colors: [0xffffff, 0xfff4c0] });
  return {
    dur: 350,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.3);
        if (t < 0) pts.hide(i); else { k.at(t, A, 0.15); pts.set(i, A.x, A.y, A.z); }
      }
    },
  };
};

IMPACT.normal = (k, from, to, { big }) => {
  const N = big ? 12 : 8, m = big ? 1.5 : 1;
  const puff = k.points({ n: N, tex: 'puff', size: 0.5 * m, colors: [0xd8d4c8, 0xb0aca0] });
  const star = k.sprite('star', { color: 0xffe14a, size: 0.1, glow: true });
  const s = k.seeds(N, 2);
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + s[i * 2], d = (to.r * 0.5 + 0.1 + s[i * 2 + 1] * 0.5) * k.ease(p) * m;
        puff.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + p * 0.3, to.pos.z + Math.sin(ang) * d);
      }
      puff.fade(1 - p);
      star.position.copy(to.pos);
      star.scale.setScalar(Math.max(0.01, (p < 0.3 ? p / 0.3 * 1.2 : 1.2 - (p - 0.3) * 1.2) * m));
      star.material.opacity = fadeOut(p, 0.7);
    },
  };
};

/* -------------------------------- fire -------------------------------- */

TRAVEL.fire = k => {
  const N = 30;
  const pts = k.points({ n: N, tex: 'dot', size: 0.34, glow: true, colors: [0xff7a1a, 0xffc83a, 0xff4a10] });
  const s = k.seeds(N, 3);
  return {
    dur: 420,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.35);
        if (t < 0) { pts.hide(i); continue; }
        k.at(t, A, 0.45);
        const w = Math.sin(p * 25 + i) * 0.08;
        pts.set(i, A.x + (s[i * 3] - 0.5) * 0.3 + k.side.x * w, A.y + (s[i * 3 + 1] - 0.5) * 0.3, A.z + (s[i * 3 + 2] - 0.5) * 0.3 + k.side.z * w);
      }
      pts.material.size = 0.34 + 0.1 * Math.sin(p * 50);
    },
  };
};

IMPACT.fire = (k, from, to, { big }) => {
  const N = big ? 36 : 24, m = big ? 1.4 : 1;
  const pts = k.points({ n: N, tex: 'dot', size: 0.36 * m, glow: true, colors: [0xff7a1a, 0xffc83a, 0xff4a10] });
  const s = k.seeds(N, 3);
  return {
    dur: 400,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283, rad = to.r * (0.2 + s[i * 3 + 1] * 0.9);
        pts.set(i, to.pos.x + Math.cos(ang) * rad, feetOf(to) + 0.2 + k.ease(p) * (0.6 + s[i * 3 + 2] * 1.6) * m, to.pos.z + Math.sin(ang) * rad);
      }
      pts.fade(1 - p);
      pts.material.size = (0.36 - p * 0.18) * m;
    },
  };
};

/* -------------------------------- water -------------------------------- */

TRAVEL.water = k => {
  const N = 20;
  const pts = k.points({ n: N, tex: 'bubble', size: 0.36, colors: [0xbfe0ff, 0x8cc4ff, 0xffffff] });
  return {
    dur: 430,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.45);
        if (t < 0) { pts.hide(i); continue; }
        k.at(t, A, 0.3);
        const w = Math.sin(t * 14 + i * 1.7) * 0.18;
        pts.set(i, A.x + k.side.x * w, A.y + Math.cos(t * 11 + i) * 0.1, A.z + k.side.z * w);
      }
    },
  };
};

IMPACT.water = (k, from, to, { big }) => {
  const N = big ? 24 : 16, m = big ? 1.4 : 1;
  const pts = k.points({ n: N, tex: 'dot', size: 0.3 * m, colors: [0x6cb4ff, 0xbfe0ff, 0x4a90e8] });
  const s = k.seeds(N, 3);
  return {
    dur: 400,
    step(p) {
      const sec = p * 0.5;
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283, out = (0.3 + s[i * 3 + 1] * 0.8) * to.r * 2 * k.ease(p) * m, vy = 2.2 + s[i * 3 + 2] * 1.6;
        pts.set(i, to.pos.x + Math.cos(ang) * out, to.pos.y + vy * sec - 7 * sec * sec, to.pos.z + Math.sin(ang) * out);
      }
      pts.fade(fadeOut(p, 0.7));
    },
  };
};

/* -------------------------------- grass -------------------------------- */

TRAVEL.grass = k => {
  const N = 14;
  const pts = k.points({ n: N, tex: 'leaf', size: 0.4, colors: [0x6fd35a, 0x4cae3e, 0xb8f090] });
  return {
    dur: 450,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.5);
        if (t < 0) { pts.hide(i); continue; }
        k.at(t, A, 0.2);
        const ang = t * 11 + i * 0.9;
        pts.set(i, A.x + k.side.x * Math.cos(ang) * 0.38, A.y + Math.sin(ang) * 0.38, A.z + k.side.z * Math.cos(ang) * 0.38);
      }
    },
  };
};

IMPACT.grass = (k, from, to, { big }) => {
  const N = big ? 20 : 14, m = big ? 1.3 : 1;
  const pts = k.points({ n: N, tex: 'leaf', size: 0.42 * m, colors: [0x6fd35a, 0x4cae3e, 0xb8f090] });
  return {
    dur: 420,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + p * 5, rad = (to.r + 0.15 + 0.3 * p) * m;
        const y = lerp(to.top + 0.3, feetOf(to) + 0.1, clamp01(p * 0.8 + (i % 4) * 0.05));
        pts.set(i, to.pos.x + Math.cos(ang) * rad, y, to.pos.z + Math.sin(ang) * rad);
      }
      pts.fade(fadeOut(p, 0.7));
    },
  };
};

/* ------------------------------- electric ------------------------------- */

const JAG = 90; // ms between new bolt shapes: no strobing

TRAVEL.electric = k => {
  const SEG = 7, DUR = 400, FRAMES = Math.ceil(DUR / JAG) + 1;
  const boxes = [];
  for (let i = 0; i < SEG; i++) boxes.push(k.mesh('box', { color: i % 2 ? 0xfff8a0 : 0xfff25a, glow: true }));
  const s = k.seeds(FRAMES, SEG * 2);
  const P = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
  return {
    dur: DUR,
    step(p) {
      const f = Math.min(FRAMES - 1, Math.floor(p * DUR / JAG));
      const head = clamp01(p / 0.35);
      for (let j = 0; j <= SEG; j++) {
        k.at(j / SEG * head, P[j], 0.2);
        if (j > 0 && j < SEG) {
          P[j].x += k.side.x * (s[f * SEG * 2 + j] - 0.5) * 0.7;
          P[j].z += k.side.z * (s[f * SEG * 2 + j] - 0.5) * 0.7;
          P[j].y += (s[f * SEG * 2 + SEG + j] - 0.5) * 0.7;
        }
      }
      for (let j = 0; j < SEG; j++) {
        const b = boxes[j];
        A.copy(P[j]).add(P[j + 1]).multiplyScalar(0.5);
        b.position.copy(A);
        b.lookAt(P[j + 1]);
        b.scale.set(0.1, 0.1, Math.max(0.01, P[j].distanceTo(P[j + 1])));
        b.material.opacity = fadeOut(p, 0.7);
      }
    },
  };
};

IMPACT.electric = (k, from, to, { big }) => {
  const N = big ? 18 : 12, m = big ? 1.4 : 1;
  const pts = k.points({ n: N, tex: 'star', size: 0.3 * m, glow: true, colors: [0xfff25a, 0xffffff] });
  const s = k.seeds(N, 3);
  return {
    dur: 350,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283, el = (s[i * 3 + 1] - 0.3) * 1.4, d = (to.r + 0.2 + s[i * 3 + 2] * 0.7) * k.ease(p) * m;
        pts.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + el * d, to.pos.z + Math.sin(ang) * d);
      }
      pts.fade(fadeOut(p, 0.5));
    },
  };
};

/* -------------------------------- rock -------------------------------- */

TRAVEL.rock = k => {
  const N = 6;
  const rocks = [];
  for (let i = 0; i < N; i++) rocks.push(k.mesh('box', { color: i % 2 ? 0x8a6a3a : 0xa08050 }));
  const s = k.seeds(N, 3);
  return {
    dur: 450,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.3), r = rocks[i];
        if (t < 0) { r.visible = false; continue; }
        r.visible = true;
        k.at(t, A, 1.2);
        r.position.set(A.x + k.side.x * (s[i * 3] - 0.5) * 0.5, A.y + (s[i * 3 + 1] - 0.5) * 0.3, A.z + k.side.z * (s[i * 3] - 0.5) * 0.5);
        r.rotation.set(t * 9 + i, t * 7, t * 5);
        r.scale.setScalar(0.2 + s[i * 3 + 2] * 0.12);
      }
    },
  };
};

IMPACT.rock = (k, from, to, { big }) => {
  const N = big ? 9 : 6, m = big ? 1.3 : 1;
  const rocks = [];
  for (let i = 0; i < N; i++) rocks.push(k.mesh('box', { color: i % 2 ? 0x8a6a3a : 0xa08050 }));
  const s = k.seeds(N, 2);
  return {
    dur: 420,
    step(p) {
      const ground = feetOf(to) + 0.15, top = to.top + 1.4;
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + s[i * 2], rad = to.r * 0.8 + s[i * 2 + 1] * 0.3;
        const fall = clamp01(p / 0.6);
        const y = p < 0.6 ? lerp(top, ground, fall * fall) : ground + Math.abs(Math.sin((p - 0.6) / 0.4 * Math.PI)) * 0.25;
        const r = rocks[i];
        r.position.set(to.pos.x + Math.cos(ang) * rad, y, to.pos.z + Math.sin(ang) * rad);
        r.rotation.set(p * 6 + i, p * 4, 0);
        r.scale.setScalar((0.22 + s[i * 2] * 0.1) * m);
        r.material.opacity = fadeOut(p, 0.85);
      }
    },
  };
};

/* --------------------------------- ice --------------------------------- */

TRAVEL.ice = k => {
  const N = 5;
  const shards = [];
  for (let i = 0; i < N; i++) shards.push(k.sprite('shard', { color: i % 2 ? 0xbff0ff : 0xe8fbff, size: 0.5, glow: true }));
  const frost = k.points({ n: 8, tex: 'dot', size: 0.22, glow: true, colors: [0xffffff, 0xcdf3ff] });
  return {
    dur: 400,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.25), sh = shards[i];
        if (t < 0) { sh.visible = false; continue; }
        sh.visible = true;
        k.at(t, A, 0);
        sh.position.set(A.x + k.side.x * (i - 2) * 0.12, A.y + (i % 2 ? 0.1 : -0.1), A.z + k.side.z * (i - 2) * 0.12);
        sh.material.rotation = t * 10 + i;
      }
      for (let i = 0; i < 8; i++) {
        const t = trailT(p, i, 8, 0.6);
        if (t < 0) frost.hide(i); else { k.at(t, A, 0); frost.set(i, A.x, A.y + Math.sin(i * 2) * 0.2, A.z); }
      }
    },
  };
};

IMPACT.ice = (k, from, to, { big }) => {
  const N = big ? 4 : 4, FN = big ? 16 : 10, m = big ? 1.4 : 1;
  const shards = [];
  for (let i = 0; i < N; i++) shards.push(k.sprite('shard', { color: 0xcdf3ff, size: 0.5, glow: true }));
  const frost = k.points({ n: FN, tex: 'dot', size: 0.22 * m, glow: true, colors: [0xffffff, 0xcdf3ff] });
  const s = k.seeds(FN, 2);
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + 0.6, d = (to.r + 0.1 + k.ease(p) * 0.8) * m;
        const sh = shards[i];
        sh.position.set(to.pos.x + Math.cos(ang) * d, to.pos.y + Math.sin(i * 3) * 0.3, to.pos.z + Math.sin(ang) * d);
        sh.material.rotation = p * 6 + i;
        sh.scale.setScalar(0.55 * m);
        sh.material.opacity = fadeOut(p, 0.5);
      }
      for (let i = 0; i < FN; i++) {
        const ang = s[i * 2] * 6.283, d = (to.r * 0.5 + s[i * 2 + 1] * 0.8) * k.ease(p) * m;
        frost.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + (s[i * 2 + 1] - 0.4) * 0.9 - p * 0.2, to.pos.z + Math.sin(ang) * d);
      }
      frost.fade(1 - p);
    },
  };
};

/* --------------------------------- bug --------------------------------- */

TRAVEL.bug = k => {
  const N = 24;
  const pts = k.points({ n: N, tex: 'dot', size: 0.2, colors: [0xd8e04a, 0x4a4a28, 0xb8c84a] });
  const s = k.seeds(N, 3);
  return {
    dur: 450,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.3);
        if (t < 0) { pts.hide(i); continue; }
        k.at(t, A, 0.2);
        const j = p * 40 + s[i * 3] * 20;
        pts.set(i, A.x + Math.sin(j) * 0.3, A.y + Math.cos(j * 1.3) * 0.3, A.z + Math.sin(j * 0.8 + 2) * 0.3);
      }
    },
  };
};

IMPACT.bug = (k, from, to, { big }) => {
  const N = big ? 30 : 20, m = big ? 1.3 : 1;
  const pts = k.points({ n: N, tex: 'dot', size: 0.2, colors: [0xd8e04a, 0x4a4a28, 0xb8c84a] });
  const s = k.seeds(N, 3);
  return {
    dur: 400,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283 + p * (5 + s[i * 3 + 1] * 3), rad = (to.r + 0.15 + s[i * 3 + 2] * 0.35) * m;
        pts.set(i, to.pos.x + Math.cos(ang) * rad, to.pos.y + (s[i * 3 + 1] - 0.5) * (to.top - feetOf(to)), to.pos.z + Math.sin(ang) * rad);
      }
      pts.fade(fadeOut(p, 0.7));
    },
  };
};

/* -------------------------------- ghost -------------------------------- */

TRAVEL.ghost = k => {
  const shadow = k.sprite('dot', { color: 0x2a1a44, size: 1.1, opacity: 0.85 });
  const wisps = k.points({ n: 8, tex: 'dot', size: 0.3, glow: true, colors: [0xb08aff, 0x7a5ac0] });
  return {
    dur: 450,
    step(p) {
      k.at(k.ease(p), A, 1.5);
      shadow.position.copy(A);
      shadow.scale.setScalar(1.0 + 0.2 * Math.sin(p * 20));
      for (let i = 0; i < 8; i++) {
        const t = p - (i + 1) * 0.045;
        if (t < 0) { wisps.hide(i); continue; }
        k.at(k.ease(t), B, 1.5);
        wisps.set(i, B.x + Math.sin(i * 2 + p * 12) * 0.15, B.y + Math.cos(i) * 0.15, B.z);
      }
      wisps.fade(fadeOut(p, 0.8));
    },
  };
};

IMPACT.ghost = (k, from, to, { big }) => {
  const N = big ? 20 : 14, m = big ? 1.3 : 1;
  const pts = k.points({ n: N, tex: 'dot', size: 0.34 * m, glow: true, colors: [0xb08aff, 0x7a5ac0, 0xd8c4ff] });
  return {
    dur: 420,
    step(p) {
      for (let i = 0; i < N; i++) {
        const q = clamp01(p * 1.2 - (i / N) * 0.2), ang = i * 0.9 + q * 6, rad = (to.r + 0.1) * (1 - q * 0.4) * m;
        pts.set(i, to.pos.x + Math.cos(ang) * rad, feetOf(to) + q * (to.top - feetOf(to) + 0.6), to.pos.z + Math.sin(ang) * rad);
      }
      pts.fade(fadeOut(p, 0.6));
    },
  };
};

/* -------------------------------- mind -------------------------------- */

TRAVEL.mind = k => {
  const rings = [0, 1, 2].map(() => k.mesh('ring', { color: 0xf584b8, glow: true }));
  return {
    dur: 450,
    step(p) {
      rings.forEach((r, i) => {
        const t = p * 1.25 - i * 0.12;
        if (t < 0 || t > 1) { r.visible = false; return; }
        r.visible = true;
        k.at(t, A, 0.2);
        r.position.copy(A);
        C.copy(A).add(k.dir);
        r.lookAt(C);
        r.scale.setScalar(0.25 + t * 0.55);
        r.material.opacity = 1 - t * 0.5;
      });
    },
  };
};

IMPACT.mind = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1;
  const rings = [0, 1].map(i => k.mesh('ring', { color: i ? 0xffc0e0 : 0xf584b8, glow: true }));
  const pts = k.points({ n: 8, tex: 'star', size: 0.26, glow: true, colors: [0xf584b8, 0xffffff] });
  return {
    dur: 420,
    step(p) {
      rings.forEach((r, i) => {
        const q = clamp01(p * 1.3 - i * 0.2);
        r.rotation.set(-Math.PI / 2, 0, 0);
        r.position.set(to.pos.x, to.top + 0.25 + i * 0.12, to.pos.z);
        r.scale.setScalar((to.r * 0.6 + q * 0.9) * m);
        r.material.opacity = 1 - q;
      });
      for (let i = 0; i < 8; i++) {
        const ang = i * 0.785 + p * 5, rad = (to.r + 0.1) * m;
        pts.set(i, to.pos.x + Math.cos(ang) * rad, to.top + 0.3 + Math.sin(ang * 2) * 0.1, to.pos.z + Math.sin(ang) * rad);
      }
      pts.fade(fadeOut(p, 0.6));
    },
  };
};
