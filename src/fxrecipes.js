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
      star.scale.setScalar(Math.max(0.01, (p < 0.25 ? p / 0.25 * 0.8 : 0.8 - (p - 0.25) * 1.0) * m));
      star.material.opacity = fadeOut(p, 0.5);
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
        k.at(t, A, 0.7);
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
        sh.scale.setScalar(0.4 * m);
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
  const shadow = k.sprite('soft', { color: 0x2a1a44, size: 1.1, opacity: 0.85 });
  const wisps = k.points({ n: 8, tex: 'dot', size: 0.3, glow: true, colors: [0xb08aff, 0x7a5ac0] });
  return {
    dur: 450,
    step(p) {
      k.at(k.ease(p), A, 0.9);
      shadow.position.copy(A);
      shadow.scale.setScalar(1.0 + 0.2 * Math.sin(p * 20));
      for (let i = 0; i < 8; i++) {
        const t = p - (i + 1) * 0.045;
        if (t < 0) { wisps.hide(i); continue; }
        k.at(k.ease(t), B, 0.9);
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

/* -------------------------------- metal -------------------------------- */

TRAVEL.metal = k => {
  const N = 12;
  const pts = k.points({ n: N, tex: 'star', size: 0.34, glow: true, colors: [0xe8eef4, 0xaab8c8, 0xffffff] });
  const s = k.seeds(N, 2);
  return {
    dur: 330,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.25);
        if (t < 0) { pts.hide(i); continue; }
        k.at(t, A, 0.05);
        pts.set(i, A.x + (s[i * 2] - 0.5) * 0.12, A.y + (s[i * 2 + 1] - 0.5) * 0.12, A.z);
      }
    },
  };
};

IMPACT.metal = (k, from, to, { big }) => {
  const N = big ? 22 : 14, m = big ? 1.4 : 1;
  const pts = k.points({ n: N, tex: 'star', size: 0.26 * m, glow: true, colors: [0xffffff, 0xd8e0e8, 0xffe9a0] });
  const ring = k.mesh('ring', { color: 0xb8c4d0 });
  const s = k.seeds(N, 3);
  return {
    dur: 350,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283, el = (s[i * 3 + 1] - 0.4) * 1.5, d = (to.r * 0.4 + 0.1 + s[i * 3 + 2] * 0.9) * k.ease(p) * m;
        pts.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + el * d - p * p * 0.3, to.pos.z + Math.sin(ang) * d);
      }
      pts.fade(fadeOut(p, 0.5));
      ring.position.copy(to.pos);
      C.copy(to.pos).add(k.dir);
      ring.lookAt(C);
      ring.scale.setScalar((0.2 + k.ease(p) * 0.9) * m * Math.max(0.8, to.r));
      ring.material.opacity = 1 - p;
    },
  };
};

/* -------------------------------- toxic -------------------------------- */

TRAVEL.toxic = k => {
  const N = 14;
  const pts = k.points({ n: N, tex: 'bubble', size: 0.4, colors: [0xb36ad6, 0x8a40b0, 0xd6a0f0] });
  return {
    dur: 450,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.5);
        if (t < 0) { pts.hide(i); continue; }
        k.at(t, A, 0.5);
        pts.set(i, A.x + k.side.x * Math.sin(i * 2.3 + t * 5) * 0.15, A.y + Math.sin(i * 1.7 + t * 6) * 0.1, A.z + k.side.z * Math.sin(i * 2.3 + t * 5) * 0.15);
      }
    },
  };
};

IMPACT.toxic = (k, from, to, { big }) => {
  const N = big ? 14 : 9, m = big ? 1.3 : 1;
  const cloud = k.points({ n: N, tex: 'puff', size: 0.7 * m, colors: [0x9a52c0, 0x7a3a9c, 0xb36ad6] });
  const bub = k.points({ n: 6, tex: 'bubble', size: 0.34 * m, colors: [0xd6a0f0, 0xb36ad6] });
  const s = k.seeds(N, 2);
  return {
    dur: 400,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + s[i * 2], d = (to.r * 0.3 + s[i * 2 + 1] * 0.5) * k.ease(p) * m;
        cloud.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + p * 0.4, to.pos.z + Math.sin(ang) * d);
      }
      cloud.fade(fadeOut(p, 0.4) * 0.9);
      for (let i = 0; i < 6; i++) {
        const q = p * 1.5;
        if (q > 1) { bub.hide(i); continue; }
        bub.set(i, to.pos.x + Math.cos(i * 1.05) * to.r * 0.7, to.pos.y + 0.1 + q * 0.7 + i * 0.05, to.pos.z + Math.sin(i * 1.05) * to.r * 0.7);
      }
    },
  };
};

/* -------------------------------- pixie -------------------------------- */

TRAVEL.pixie = k => {
  const N = 22;
  const pts = k.points({ n: N, tex: 'star', size: 0.3, glow: true, colors: [0xffb8e6, 0xffffff, 0xffd0f0] });
  const s = k.seeds(N, 3);
  return {
    dur: 430,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.5);
        if (t < 0) { pts.hide(i); continue; }
        k.at(t, A, 0.4);
        pts.set(i, A.x + (s[i * 3] - 0.5) * 0.4, A.y + (s[i * 3 + 1] - 0.5) * 0.4 - t * 0.1, A.z + (s[i * 3 + 2] - 0.5) * 0.4);
      }
      pts.material.size = 0.3 + 0.08 * Math.sin(p * 40);
    },
  };
};

IMPACT.pixie = (k, from, to, { big }) => {
  const N = big ? 18 : 12, m = big ? 1.3 : 1;
  const pts = k.points({ n: N, tex: 'star', size: 0.3 * m, glow: true, colors: [0xffb8e6, 0xffffff, 0xffe0f6] });
  return {
    dur: 420,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + p * 2, d = (to.r + 0.1 + k.ease(p) * 0.6) * m;
        pts.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + Math.sin(i * 2.4) * 0.5 + p * 0.3, to.pos.z + Math.sin(ang) * d);
      }
      pts.fade(fadeOut(p, 0.5) * (0.65 + 0.35 * Math.sin(p * 30)));
    },
  };
};

/* -------------------------------- drake -------------------------------- */

TRAVEL.drake = k => {
  const rings = [0, 1, 2].map(i => k.mesh('ring', { color: i % 2 ? 0x5a48c8 : 0x8f7cff }));
  return {
    dur: 450,
    step(p) {
      rings.forEach((r, i) => {
        const t = p * 1.3 - i * 0.14;
        if (t < 0 || t > 1) { r.visible = false; return; }
        r.visible = true;
        k.at(t, A, 0.1);
        r.position.copy(A);
        C.copy(A).add(k.dir);
        r.lookAt(C);
        r.scale.setScalar(0.25 + t * 0.6 + i * 0.08);
        r.material.opacity = 0.95 - t * 0.5;
      });
    },
  };
};

IMPACT.drake = (k, from, to, { big }) => {
  const N = big ? 14 : 9, m = big ? 1.4 : 1;
  const ring = k.mesh('ring', { color: 0x8f7cff });
  const dust = k.points({ n: N, tex: 'puff', size: 0.5 * m, colors: [0x7a68e0, 0x5a48c8] });
  const s = k.seeds(N, 2);
  return {
    dur: 400,
    step(p) {
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.position.set(to.pos.x, feetOf(to) + 0.1, to.pos.z);
      ring.scale.setScalar((to.r * 0.5 + k.ease(p) * 1.6) * m);
      ring.material.opacity = 1 - p;
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + s[i * 2], d = (to.r * 0.6 + k.ease(p) * (0.5 + s[i * 2 + 1] * 0.6)) * m;
        dust.set(i, to.pos.x + Math.cos(ang) * d, feetOf(to) + 0.2 + p * 0.5, to.pos.z + Math.sin(ang) * d);
      }
      dust.fade(fadeOut(p, 0.4));
    },
  };
};

/* ------------------------------- rainbow ------------------------------- */

const BANDS = [0xff6a6a, 0xffc24a, 0x8fe388, 0x6aaeff, 0xc99bff];

// A beam of coloured bars from the attacker to the target. It fades in and out smoothly (no hard flash).
function beam(k, thick, peak) {
  const bars = BANDS.map(c => k.mesh('box', { color: c, glow: true }));
  return (grow, fade) => {
    k.at(0, A, 0); k.at(1, B, 0);
    const len = A.distanceTo(B) * grow;
    bars.forEach((bar, i) => {
      const dy = (i - 2) * thick;
      bar.position.set(A.x + (B.x - A.x) * grow / 2, A.y + dy + (B.y - A.y) * grow / 2, A.z + (B.z - A.z) * grow / 2);
      C.set(B.x, B.y + dy, B.z);
      bar.lookAt(C);
      bar.scale.set(thick * 0.95, thick * 0.95, Math.max(0.01, len));
      bar.material.opacity = peak * fade;
    });
  };
}

TRAVEL.rainbow = k => {
  const put = beam(k, 0.07, 0.8);
  return { dur: 450, step(p) { put(Math.min(1, p / 0.5), Math.min(1, p / 0.2) * fadeOut(p, 0.55)); } };
};

IMPACT.rainbow = (k, from, to, { big }) => {
  const N = big ? 20 : 14, m = big ? 1.4 : 1;
  const pts = k.points({ n: N, tex: 'star', size: 0.3 * m, glow: true, colors: BANDS });
  const s = k.seeds(N, 3);
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283, el = (s[i * 3 + 1] - 0.4) * 1.4, d = (to.r * 0.4 + 0.1 + s[i * 3 + 2] * 0.8) * k.ease(p) * m;
        pts.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + el * d, to.pos.z + Math.sin(ang) * d);
      }
      pts.fade(fadeOut(p, 0.5));
    },
  };
};

/* -------------------------------- cosmic -------------------------------- */

TRAVEL.cosmic = k => {
  const N = 16;
  const head = k.sprite('soft', { color: 0xe7c6ff, size: 0.9, glow: true, opacity: 0.9 });
  const core = k.sprite('dot', { color: 0xffffff, size: 0.4, glow: true });
  const tail = k.points({ n: N, tex: 'star', size: 0.26, glow: true, colors: [0x8e9bff, 0xe7c6ff, 0xffffff] });
  const s = k.seeds(N, 2);
  return {
    dur: 450,
    step(p) {
      const t = k.ease(Math.min(1, p / 0.9));
      k.at(t, A, 0.5);
      head.position.copy(A); core.position.copy(A);
      head.material.opacity = fadeOut(p, 0.85) * 0.9;
      core.material.opacity = fadeOut(p, 0.85);
      for (let i = 0; i < N; i++) {
        const tt = t - (i + 1) * 0.04;
        if (tt < 0) { tail.hide(i); continue; }
        k.at(tt, B, 0.5);
        tail.set(i, B.x + (s[i * 2] - 0.5) * 0.25, B.y + (s[i * 2 + 1] - 0.5) * 0.25, B.z);
      }
      tail.fade(fadeOut(p, 0.8));
    },
  };
};

IMPACT.cosmic = (k, from, to, { big }) => {
  const N = big ? 16 : 10, m = big ? 1.4 : 1;
  const pts = k.points({ n: N, tex: 'star', size: 0.24 * m, glow: true, colors: [0x8e9bff, 0xe7c6ff, 0xffffff] });
  const s = k.seeds(N, 3);
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283, el = (s[i * 3 + 1] - 0.5) * 1.6, d = (to.r * 0.3 + s[i * 3 + 2] * 0.9) * k.ease(p) * m;
        pts.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + el * d, to.pos.z + Math.sin(ang) * d);
      }
      pts.fade(fadeOut(p, 0.45));
    },
  };
};

/* -------------------------------- sound -------------------------------- */

TRAVEL.sound = k => {
  const N = 6;
  const notes = k.points({ n: N, tex: 'note', size: 0.45, colors: [0x4fd8c4, 0xb8fff0, 0x7ae8d8] });
  const rings = [0, 1].map(() => k.mesh('ring', { color: 0x4fd8c4 }));
  return {
    dur: 450,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.5);
        if (t < 0) { notes.hide(i); continue; }
        k.at(t, A, 0.3);
        notes.set(i, A.x, A.y + Math.sin(t * 12 + i * 1.5) * 0.25, A.z);
      }
      rings.forEach((r, i) => {
        const t = p * 1.3 - i * 0.2;
        if (t < 0 || t > 1) { r.visible = false; return; }
        r.visible = true;
        k.at(t, A, 0.1);
        r.position.copy(A);
        C.copy(A).add(k.dir);
        r.lookAt(C);
        r.scale.setScalar(0.25 + t * 0.6);
        r.material.opacity = 1 - t * 0.5;
      });
    },
  };
};

IMPACT.sound = (k, from, to, { big }) => {
  const N = big ? 8 : 6, m = big ? 1.3 : 1;
  const notes = k.points({ n: N, tex: 'note', size: 0.42 * m, colors: [0x4fd8c4, 0xb8fff0] });
  const s = k.seeds(N, 2);
  return {
    dur: 420,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + s[i * 2], d = (to.r + 0.1) * (0.6 + k.ease(p) * 0.8) * m;
        const hop = Math.abs(Math.sin(p * 7 + s[i * 2 + 1] * 3)) * 0.6 * (1 - p);
        notes.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.1 + hop, to.pos.z + Math.sin(ang) * d);
      }
      notes.fade(fadeOut(p, 0.6));
    },
  };
};

/* --------------------------------- bone --------------------------------- */

TRAVEL.bone = k => {
  const N = 3;
  const bones = [];
  for (let i = 0; i < N; i++) bones.push(k.sprite('bone', { color: 0xf2ead4, size: 0.7 }));
  return {
    dur: 430,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.4), b = bones[i];
        if (t < 0) { b.visible = false; continue; }
        b.visible = true;
        k.at(t, A, 0.5);
        b.position.set(A.x, A.y + (i - 1) * 0.2, A.z);
        b.material.rotation = t * 14 + i * 2;
      }
    },
  };
};

IMPACT.bone = (k, from, to, { big }) => {
  const N = big ? 12 : 8, m = big ? 1.3 : 1;
  const bones = k.points({ n: N, tex: 'bone', size: 0.5 * m, colors: [0xf2ead4, 0xd8cfb4] });
  const skull = k.sprite('skull', { color: 0xf2ead4, size: 0.1 });
  const s = k.seeds(N, 3);
  return {
    dur: 400,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283, out = (0.2 + s[i * 3 + 1] * 0.8) * to.r * 2 * k.ease(p) * m;
        const y = feetOf(to) + 0.2 + Math.abs(Math.sin(p * 5 + s[i * 3 + 2] * 3)) * 0.6 * (1 - p);
        bones.set(i, to.pos.x + Math.cos(ang) * out, y, to.pos.z + Math.sin(ang) * out);
      }
      bones.fade(fadeOut(p, 0.7));
      skull.position.set(to.pos.x, to.top + 0.3 + p * 0.5, to.pos.z);
      skull.scale.setScalar(Math.max(0.01, (0.2 + Math.sin(Math.PI * Math.min(1, p * 1.3))) * 0.8 * m));
      skull.material.opacity = fadeOut(p, 0.4);
    },
  };
};

/* -------------------------------- alien -------------------------------- */

TRAVEL.alien = k => {
  const cone = k.mesh('cone', { color: 0x8dff6a, glow: true, opacity: 0.3 });
  const rings = [0, 1, 2].map(i => k.mesh('ring', { color: i % 2 ? 0xb98cff : 0x8dff6a }));
  return {
    dur: 450,
    step(p) {
      k.at(0, B, 0); k.at(1, A, 0); // B = attacker end, A = target end
      const g = Math.min(1, p / 0.4);
      // The cone's wide base sits at the far end of the beam and its point at the attacker.
      cone.position.set(B.x + (A.x - B.x) * g, B.y + (A.y - B.y) * g, B.z + (A.z - B.z) * g);
      cone.lookAt(B);
      cone.scale.set(0.5, 0.5, Math.max(0.01, B.distanceTo(cone.position)));
      cone.material.opacity = 0.32 * fadeOut(p, 0.7);
      rings.forEach((r, i) => {
        const t = p * 1.4 - i * 0.18;
        if (t < 0 || t > 1) { r.visible = false; return; }
        r.visible = true;
        k.at(t, C, 0);
        r.position.copy(C);
        r.lookAt(A);
        r.scale.setScalar(0.18 + t * 0.55);
        r.material.opacity = 0.95 - t * 0.4;
      });
    },
  };
};

IMPACT.alien = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1;
  const rings = [0, 1, 2].map(i => k.mesh('ring', { color: i % 2 ? 0xb98cff : 0x8dff6a }));
  const pts = k.points({ n: 8, tex: 'star', size: 0.26 * m, glow: true, colors: [0x8dff6a, 0xb98cff] });
  return {
    dur: 420,
    step(p) {
      rings.forEach((r, i) => {
        const q = clamp01(p * 1.3 - i * 0.15);
        r.rotation.set(-Math.PI / 2, 0, 0);
        r.position.set(to.pos.x, feetOf(to) + 0.1 + i * (to.top - feetOf(to)) / 2.5, to.pos.z);
        r.scale.setScalar((to.r + 0.8) * (1 - q * 0.7) * m);
        r.material.opacity = q <= 0 ? 0 : 1 - q * 0.6;
      });
      for (let i = 0; i < 8; i++) {
        const ang = i * 0.785 + p * 4, rad = (to.r + 0.2) * (1 - p * 0.5);
        pts.set(i, to.pos.x + Math.cos(ang) * rad, to.pos.y + Math.sin(i * 2) * 0.4, to.pos.z + Math.sin(ang) * rad);
      }
      pts.fade(fadeOut(p, 0.6));
    },
  };
};

/* ---------------------------- signature moves ---------------------------- */

SIG.blazedash = (k, from, to) => {
  const N = 30, R = 20;
  const trail = k.points({ n: N, tex: 'dot', size: 0.38, glow: true, colors: [0xff7a1a, 0xffc83a, 0xff4a10] });
  const ring = k.points({ n: R, tex: 'dot', size: 0.38, glow: true, colors: [0xff7a1a, 0xffc83a, 0xff4a10] });
  const s = k.seeds(N, 2);
  return {
    dur: 650,
    step(p) {
      const q = clamp01(p / 0.55);
      for (let i = 0; i < N; i++) {
        const t = trailT(q, i, N, 0.5);
        if (t < 0) { trail.hide(i); continue; }
        k.at(t, A, 0.1);
        trail.set(i, A.x + (s[i * 2] - 0.5) * 0.4, A.y + (s[i * 2 + 1] - 0.5) * 0.4 - 0.1, A.z);
      }
      trail.fade(p < 0.55 ? 1 : clamp01(1 - (p - 0.55) / 0.2));
      const r = clamp01((p - 0.5) / 0.5);
      for (let i = 0; i < R; i++) {
        if (r <= 0) { ring.hide(i); continue; }
        const ang = (i / R) * 6.283 + r * 3, rad = to.r + 0.1 + k.ease(r) * 0.7;
        ring.set(i, to.pos.x + Math.cos(ang) * rad, feetOf(to) + 0.2 + (i % 5) * 0.12 + r * 0.7, to.pos.z + Math.sin(ang) * rad);
      }
      ring.fade(r < 0.6 ? 1 : (1 - r) / 0.4);
    },
  };
};

SIG.royaltide = (k, from, to) => {
  const wall = k.mesh('box', { color: 0x4a94f0, opacity: 0.75 });
  const crest = k.mesh('box', { color: 0xcfe8ff, opacity: 0.8 });
  const gold = k.points({ n: 14, tex: 'star', size: 0.3, glow: true, colors: [0xffd84a, 0xfff2a0] });
  const s = k.seeds(14, 2);
  return {
    dur: 680,
    step(p) {
      const g = Math.min(1, p / 0.25), t = k.ease(clamp01((p - 0.1) / 0.8));
      k.at(t, A, 0);
      const h = Math.max(0.01, 0.7 * g), fy = feetOf(from);
      C.set(A.x + k.dir.x, fy, A.z + k.dir.z);
      wall.position.set(A.x, fy + h / 2, A.z);
      wall.lookAt(C.x, fy + h / 2, C.z);
      wall.scale.set(1.8, h, 0.35);
      crest.position.set(A.x, fy + h, A.z);
      crest.lookAt(C.x, fy + h, C.z);
      crest.scale.set(1.8, 0.12, 0.4);
      wall.material.opacity = 0.55 * fadeOut(p, 0.8);
      crest.material.opacity = 0.8 * fadeOut(p, 0.8);
      for (let i = 0; i < 14; i++) {
        const w = (s[i * 2] - 0.5) * 1.6;
        gold.set(i, A.x + k.side.x * w, fy + h + 0.2 + Math.abs(Math.sin(p * 9 + i)) * 0.4 * s[i * 2 + 1], A.z + k.side.z * w);
      }
      gold.fade(fadeOut(p, 0.8));
    },
  };
};

SIG.rootslam = (k, from, to) => {
  const V = 7;
  const vines = [];
  for (let i = 0; i < V; i++) vines.push(k.mesh('box', { color: i % 2 ? 0x3f9a34 : 0x5cc04a }));
  const leaves = k.points({ n: 14, tex: 'leaf', size: 0.4, colors: [0x6fd35a, 0x4cae3e, 0xb8f090] });
  const s = k.seeds(V, 3);
  const sl = k.seeds(14, 2);
  return {
    dur: 650,
    step(p) {
      const g = clamp01((p - 0.1) / 0.4), ground = feetOf(to);
      for (let i = 0; i < V; i++) {
        const v = vines[i], ang = (i / V) * 6.283 + s[i * 3], rad = i === 0 ? 0 : to.r * (0.5 + s[i * 3 + 1] * 0.6);
        const h = Math.max(0.01, (to.top - ground) * 0.75 * g * (0.8 + s[i * 3 + 2] * 0.5));
        v.position.set(to.pos.x + Math.cos(ang) * rad, ground + h / 2, to.pos.z + Math.sin(ang) * rad);
        v.rotation.set(Math.sin(ang) * 0.3 * g, 0, Math.cos(ang) * 0.3 * g);
        v.scale.set(0.14, h, 0.14);
        v.material.opacity = fadeOut(p, 0.8);
      }
      const l = clamp01((p - 0.3) / 0.7);
      for (let i = 0; i < 14; i++) {
        if (l <= 0) { leaves.hide(i); continue; }
        const ang = sl[i * 2] * 6.283, d = (0.3 + sl[i * 2 + 1]) * (to.r + 0.3) * k.ease(l);
        leaves.set(i, to.pos.x + Math.cos(ang) * d, ground + 0.3 + Math.sin(l * Math.PI) * 1.2 * (0.5 + sl[i * 2 + 1] * 0.6), to.pos.z + Math.sin(ang) * d);
      }
      leaves.fade(fadeOut(p, 0.75));
    },
  };
};

SIG.zenithray = (k, from, to) => {
  const put = beam(k, 0.16, 0.75);
  const N = 16;
  const gold = k.points({ n: N, tex: 'star', size: 0.34, glow: true, colors: [0xffd84a, 0xfff2a0, 0xffffff] });
  const s = k.seeds(N, 3);
  return {
    dur: 700,
    step(p) {
      put(Math.min(1, p / 0.4), Math.min(1, p / 0.2) * fadeOut(p, 0.6));
      const r = clamp01((p - 0.4) / 0.6);
      for (let i = 0; i < N; i++) {
        if (r <= 0) { gold.hide(i); continue; }
        const ang = s[i * 3] * 6.283, el = (s[i * 3 + 1] - 0.4) * 1.4, d = (to.r * 0.4 + 0.2 + s[i * 3 + 2] * 0.9) * k.ease(r);
        gold.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + el * d, to.pos.z + Math.sin(ang) * d);
      }
      gold.fade(fadeOut(r, 0.4));
    },
  };
};

SIG.rattledance = (k, from, to) => {
  const N = 5;
  const bones = [];
  for (let i = 0; i < N; i++) bones.push(k.sprite('bone', { color: 0xf2ead4, size: 0.5 }));
  return {
    dur: 700,
    step(p) {
      const orbit = clamp01(p / 0.5), fly = clamp01((p - 0.45) / 0.55);
      for (let i = 0; i < N; i++) {
        const b = bones[i], ang = (i / N) * 6.283 + p * 14;
        const ox = from.pos.x + Math.cos(ang) * (from.r + 0.4), oy = from.pos.y + 0.2 + Math.sin(i * 2) * 0.3 + orbit * 0.3, oz = from.pos.z + Math.sin(ang) * (from.r + 0.4);
        if (fly <= 0) b.position.set(ox, oy, oz);
        else {
          const f = clamp01(fly * 1.2 - (i / N) * 0.2), e = k.ease(f);
          b.position.set(lerp(ox, to.pos.x, e), lerp(oy, to.pos.y, e) + Math.sin(Math.PI * f) * 0.4, lerp(oz, to.pos.z, e));
        }
        b.material.rotation = p * 16 + i;
        b.material.opacity = p < 0.5 ? clamp01(p / 0.15) : 1;
      }
    },
  };
};

SIG.mothership = (k, from, to) => {
  const hull = k.mesh('box', { color: 0x9aa4b8 });
  const dome = k.mesh('box', { color: 0xa8f0ff, opacity: 0.9 });
  const beamM = k.mesh('cone', { color: 0x8dff6a, glow: true, opacity: 0.3 });
  const rings = [0, 1].map(i => k.mesh('ring', { color: i ? 0xb98cff : 0x8dff6a }));
  const lights = k.points({ n: 6, tex: 'dot', size: 0.2, glow: true, colors: [0x8dff6a, 0xb98cff] });
  return {
    dur: 700,
    step(p) {
      const drop = k.ease(clamp01(p / 0.3)), fo = fadeOut(p, 0.8);
      const y = lerp(to.top + 5, to.top + 2, drop), ground = feetOf(to);
      hull.position.set(to.pos.x, y, to.pos.z);
      hull.rotation.y = p * 3;
      hull.scale.set(1.8, 0.28, 1.8);
      hull.material.opacity = fo;
      dome.position.set(to.pos.x, y + 0.28, to.pos.z);
      dome.scale.set(0.8, 0.35, 0.8);
      dome.material.opacity = 0.9 * fo;
      const bp = clamp01((p - 0.25) / 0.2);
      beamM.position.set(to.pos.x, ground, to.pos.z);
      A.set(to.pos.x, y, to.pos.z);
      beamM.lookAt(A);
      beamM.scale.set(to.r + 0.4, to.r + 0.4, Math.max(0.01, (y - ground) * bp));
      beamM.material.opacity = 0.3 * fo * bp;
      rings.forEach((r, i) => {
        const t = clamp01((p - 0.4) / 0.5 - i * 0.2);
        r.visible = t > 0 && t < 1;
        r.rotation.set(-Math.PI / 2, 0, 0);
        r.position.set(to.pos.x, lerp(y - 0.2, ground + 0.1, t), to.pos.z);
        r.scale.setScalar(to.r * 0.5 + 0.7 * (1 - t) + 0.2);
        r.material.opacity = 1 - t * 0.5;
      });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * 6.283 + p * 5;
        lights.set(i, to.pos.x + Math.cos(ang) * 0.8, y, to.pos.z + Math.sin(ang) * 0.8);
      }
      lights.fade(fo);
    },
  };
};

SIG.bigbong = (k, from, to) => {
  const flatRing = k.mesh('ring', { color: 0xffd24a });
  const upRing = k.mesh('ring', { color: 0xfff2a0 });
  const N = 10;
  const notes = k.points({ n: N, tex: 'note', size: 0.46, colors: [0xffd24a, 0xfff2a0, 0x4fd8c4] });
  const s = k.seeds(N, 2);
  return {
    dur: 700,
    step(p) {
      const e = k.ease(clamp01(p / 0.8));
      flatRing.rotation.set(-Math.PI / 2, 0, 0);
      flatRing.position.copy(from.pos);
      flatRing.scale.setScalar(0.4 + e * 2.6);
      flatRing.material.opacity = 1 - e * 0.7;
      upRing.position.copy(from.pos);
      A.copy(from.pos).add(k.side);
      upRing.lookAt(A);
      upRing.scale.setScalar(0.3 + e * 2.0);
      upRing.material.opacity = 1 - e * 0.7;
      for (let i = 0; i < N; i++) {
        const q = clamp01(p * 1.3 - (i / N) * 0.3);
        if (q <= 0) { notes.hide(i); continue; }
        const ang = s[i * 2] * 6.283, d = (0.2 + s[i * 2 + 1] * 0.8) * q;
        notes.set(i, from.pos.x + Math.cos(ang) * d, from.top + 0.2 + 1.6 * q - 1.4 * q * q, from.pos.z + Math.sin(ang) * d);
      }
      notes.fade(fadeOut(p, 0.7));
    },
  };
};

/* ======================= the four newer types: sky, slime, light, paper ======================= */

Object.assign(FX_COLORS, {
  sky: [0x8fd0ff, 0xffffff, 0xd8f0ff], slime: [0x9cf06a, 0x52d08a, 0xe0ffc0],
  light: [0xfff6c0, 0xffffff, 0xffd84a], paper: [0xffffff, 0xcfe0f7, 0xf0386a],
});

const easeOut = t => 1 - (1 - t) * (1 - t);
// Lay a flat ring/disc on the ground.
const lay = (m, x, y, z, s) => { m.rotation.set(-Math.PI / 2, 0, 0); m.position.set(x, y, z); m.scale.setScalar(Math.max(0.01, s)); };
// A droplet thrown out at angle `ang`: where it is after `q` (0..1) of its flight (closed form, with gravity). Result in A.
const spray = (to, ang, out, vy, q) => {
  const sec = q * 0.55, o = out * easeOut(q);
  return A.set(to.pos.x + Math.cos(ang) * o, to.pos.y + vy * sec - 7 * sec * sec, to.pos.z + Math.sin(ang) * o);
};
// A soft halo sprite (kept under half opacity, so it never blinds).
const halo = (sp, x, y, z, size, op) => { sp.position.set(x, y, z); sp.scale.setScalar(Math.max(0.01, size)); sp.material.opacity = Math.max(0, op); };

/* --------------------------------- sky --------------------------------- */

// Gusts: three curved streaks of wind with a few leaves caught in them.
TRAVEL.sky = k => {
  const R = 3, L = 7;
  const wind = k.points({ n: R * L, tex: 'streak', size: 0.42, colors: [0xffffff, 0xcfe8ff, 0xa8d4ff] });
  const leaves = k.points({ n: R, tex: 'leaf', size: 0.3, colors: [0x7bd35a, 0xb8f090] });
  const s = k.seeds(R, 1);
  return {
    dur: 420,
    step(p) {
      for (let r = 0; r < R; r++) {
        const base = (r - 1) * 0.42, ph = s[r] * 6;
        for (let j = 0; j < L; j++) {
          const t = trailT(p, j, L, 0.5 + r * 0.05);
          if (t < 0) { wind.hide(r * L + j); continue; }
          k.at(t, A, 0.2 + r * 0.15);
          const w = base + Math.sin(t * 7 + ph) * 0.3 * (1 - t * 0.4);
          wind.set(r * L + j, A.x + k.side.x * w, A.y + (r - 1) * 0.28 + Math.cos(t * 6 + ph) * 0.12, A.z + k.side.z * w);
        }
        const lt = trailT(p, 2, 6, 0.4);
        if (lt < 0) leaves.hide(r); else {
          k.at(lt, A, 0.5);
          const w = Math.sin(lt * 14 + r * 2) * 0.35;
          leaves.set(r, A.x + k.side.x * w, A.y + Math.cos(lt * 12 + r) * 0.3, A.z + k.side.z * w);
        }
      }
      wind.fade(fadeOut(p, 0.8));
    },
  };
};

// A little tornado spins up round the target (n points from the feet to above the head).
const tornado = (k, to, n, m, pts, p) => {
  for (let i = 0; i < n; i++) {
    const h = i / n, ang = h * 14 + p * 9, rad = (to.r * 0.4 + 0.15 + h * to.r * 0.9) * (0.4 + 0.6 * k.ease(p)) * m;
    pts.set(i, to.pos.x + Math.cos(ang) * rad, feetOf(to) + 0.1 + h * (to.top - feetOf(to) + 0.5) * m, to.pos.z + Math.sin(ang) * rad);
  }
};

IMPACT.sky = (k, from, to, { big }) => {
  const N = big ? 30 : 20, m = big ? 1.3 : 1;
  const pts = k.points({ n: N, tex: 'puff', size: 0.42 * m, colors: [0xffffff, 0xd8f0ff, 0xa8d4ff] });
  const ring = k.mesh('ring', { color: 0xdff2ff, opacity: 0.7 });
  return {
    dur: 400,
    step(p) {
      tornado(k, to, N, m, pts, p);
      pts.fade(fadeOut(p, 0.5));
      lay(ring, to.pos.x, feetOf(to) + 0.08, to.pos.z, (to.r + 0.2 + p * 0.9) * m);
      ring.material.opacity = 0.7 * (1 - p);
    },
  };
};

// Jet Stream: a fast wind tunnel (rings rushing along the path, air streaks inside) that ends in a twister.
SIG.jetstream = (k, from, to) => {
  const R = 5, N = 30, T = 14;
  const rings = [];
  for (let i = 0; i < R; i++) rings.push(k.mesh('ring', { color: i % 2 ? 0xcfe8ff : 0xffffff, opacity: 0.8 }));
  const air = k.points({ n: N, tex: 'streak', size: 0.45, colors: [0xffffff, 0xa8d4ff, 0xd8f0ff] });
  const twist = k.points({ n: T, tex: 'puff', size: 0.45, colors: [0xffffff, 0xd8f0ff] });
  const s = k.seeds(N, 2);
  return {
    dur: 650,
    step(p) {
      const run = clamp01(p / 0.7), fo = fadeOut(p, 0.75);
      k.at(1, C, 0);
      for (let i = 0; i < R; i++) {
        const t = clamp01(run * 1.5 - i * 0.14), r = rings[i];
        r.visible = t > 0 && t < 1;
        k.at(t, A, 0.1);
        r.position.copy(A);
        r.lookAt(C);
        r.scale.setScalar(0.35 + 0.6 * t + (i % 2) * 0.1);
        r.material.opacity = 0.8 * Math.sin(Math.PI * t);
      }
      for (let i = 0; i < N; i++) {
        const t = trailT(run, i, N, 0.8);
        if (t < 0) { air.hide(i); continue; }
        const a = s[i * 2] * 6.283 + t * 8, rad = 0.2 + s[i * 2 + 1] * 0.55 * (0.5 + t * 0.5);
        k.at(t, A, 0.1);
        air.set(i, A.x + k.side.x * Math.cos(a) * rad, A.y + Math.sin(a) * rad, A.z + k.side.z * Math.cos(a) * rad);
      }
      air.fade(fo);
      const q = clamp01((p - 0.55) / 0.45);
      if (q <= 0) { for (let i = 0; i < T; i++) twist.hide(i); } else tornado(k, to, T, 1.1, twist, q);
      twist.fade(fadeOut(q, 0.4));
    },
  };
};

/* -------------------------------- slime -------------------------------- */

// Goo blobs lobbed in an arc, dripping as they go.
TRAVEL.slime = k => {
  const B_N = 4, D_N = 12;
  const blobs = k.points({ n: B_N, tex: 'dot', size: 0.6, colors: [0x7be04a, 0x9cf06a, 0x52d08a] });
  const drips = k.points({ n: D_N, tex: 'drop', size: 0.26, colors: [0x9cf06a, 0x52d08a] });
  const s = k.seeds(D_N, 2);
  return {
    dur: 430,
    step(p) {
      for (let i = 0; i < B_N; i++) {
        const t = trailT(p, i, B_N, 0.3);
        if (t < 0) { blobs.hide(i); continue; }
        k.at(t, A, 0.7);
        const w = (i - 1.5) * 0.1;
        blobs.set(i, A.x + k.side.x * w, A.y + Math.sin(p * 30 + i * 2) * 0.05, A.z + k.side.z * w);
      }
      blobs.material.size = 0.6 + 0.08 * Math.sin(p * 40);
      for (let i = 0; i < D_N; i++) {
        const t = trailT(p, i * 0.7, D_N, 0.55);
        if (t < 0) { drips.hide(i); continue; }
        k.at(t, A, 0.7);
        const fall = (p - t) * (0.8 + s[i * 2] * 1.5) + 0.05;
        drips.set(i, A.x + (s[i * 2 + 1] - 0.5) * 0.3, A.y - Math.max(0, fall) * 0.9, A.z + (s[i * 2] - 0.5) * 0.2);
      }
      drips.fade(fadeOut(p, 0.8));
    },
  };
};

// Splat: a goo star pops on the target, drops fly out and fall, a puddle spreads.
const splat = (to, p, parts, m) => {
  const { pop, dots, drops, pud, s } = parts;
  const sc = (p < 0.2 ? easeOut(p / 0.2) : 1 - (p - 0.2) * 0.25) * m;
  pop.position.copy(to.pos);
  pop.scale.setScalar(Math.max(0.01, (to.r * 1.2 + 0.3) * sc));
  pop.material.opacity = 0.75 * fadeOut(p, 0.55);
  const nD = dots.n, nR = drops.n;
  for (let i = 0; i < nD; i++) {
    const ang = s[i * 3] * 6.283, out = (0.35 + s[i * 3 + 1] * 0.9) * (to.r + 0.3) * m;
    spray(to, ang, out, 1.5 + s[i * 3 + 2] * 1.5, p);
    dots.set(i, A.x, A.y, A.z);
  }
  dots.fade(fadeOut(p, 0.6));
  for (let i = 0; i < nR; i++) {
    const j = nD + i, ang = s[j * 3] * 6.283, q = clamp01(p * 1.2 - 0.15), out = (0.2 + s[j * 3 + 1] * 0.5) * (to.r + 0.1) * m;
    if (q <= 0) { drops.hide(i); continue; }
    drops.set(i, to.pos.x + Math.cos(ang) * out, to.top - 0.1 - q * (to.top - feetOf(to)) * (0.5 + s[j * 3 + 2] * 0.5), to.pos.z + Math.sin(ang) * out);
  }
  drops.fade(fadeOut(p, 0.7));
  lay(pud, to.pos.x, feetOf(to) + 0.06, to.pos.z, (to.r * 0.5 + easeOut(clamp01(p * 1.5)) * (to.r + 0.4)) * m);
  pud.material.opacity = 0.65 * fadeOut(p, 0.5);
};

const splatParts = (k, nD, nR, size) => ({
  pop: k.sprite('splat', { color: 0x7be04a, size: 0.1, opacity: 0.9 }),
  dots: k.points({ n: nD, tex: 'dot', size, colors: [0x7be04a, 0x9cf06a, 0x52d08a] }),
  drops: k.points({ n: nR, tex: 'drop', size: size * 0.8, colors: [0x9cf06a, 0x52d08a] }),
  pud: k.mesh('disc', { color: 0x6ad04a, opacity: 0.65 }),
  s: k.seeds(nD + nR, 3),
});

IMPACT.slime = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1;
  const parts = splatParts(k, big ? 24 : 14, 6, 0.3 * m);
  return { dur: 420, step(p) { splat(to, p, parts, m); } };
};

// Mega Splat: one huge blob arcs in, then bursts into a big splash with drips and a puddle.
SIG.megasplat = (k, from, to) => {
  const blob = k.sprite('dot', { color: 0x7be04a, size: 0.1 });
  const parts = splatParts(k, 40, 10, 0.34);
  return {
    dur: 700,
    step(p) {
      const fly = clamp01(p / 0.4);
      k.at(fly, A, 1.4);
      blob.position.copy(A);
      blob.scale.setScalar(fly >= 1 ? 0.01 : 0.8 + fly * 0.9 + 0.1 * Math.sin(p * 40));
      splat(to, clamp01((p - 0.4) / 0.6), parts, 1.4);
      if (fly < 1) { parts.pop.material.opacity = 0; parts.pud.material.opacity = 0; }
    },
  };
};

/* -------------------------------- light -------------------------------- */

// A bright ray with sparkles and a soft glowing head.
TRAVEL.light = k => {
  const core = k.mesh('box', { color: 0xffffff, opacity: 0.9 });
  const glow = k.mesh('box', { color: 0xffe680, opacity: 0.35 });
  const head = k.sprite('soft', { color: 0xfff3a0, size: 0.1, opacity: 0.55 });
  const N = 10;
  const sparks = k.points({ n: N, tex: 'star', size: 0.3, colors: [0xffffff, 0xffe680, 0xfff6c0] });
  const s = k.seeds(N, 2);
  return {
    dur: 400,
    step(p) {
      const grow = clamp01(p / 0.55), fade = fadeOut(p, 0.6);
      k.at(0, A, 0); k.at(1, B, 0);
      C.copy(B);
      const len = A.distanceTo(B) * grow;
      for (const [m, th, op] of [[core, 0.08, 0.9], [glow, 0.26, 0.35]]) {
        m.position.set(A.x + (B.x - A.x) * grow / 2, A.y + (B.y - A.y) * grow / 2, A.z + (B.z - A.z) * grow / 2);
        m.lookAt(C);
        m.scale.set(th, th, Math.max(0.01, len));
        m.material.opacity = op * fade;
      }
      k.at(grow, A, 0);
      halo(head, A.x, A.y, A.z, 0.7 + 0.1 * Math.sin(p * 30), 0.55 * fade);
      for (let i = 0; i < N; i++) {
        if (grow <= 0.05) { sparks.hide(i); continue; }
        k.at(s[i * 2] * grow, A, 0);
        sparks.set(i, A.x + (s[i * 2 + 1] - 0.5) * 0.5, A.y + Math.sin(p * 20 + i * 3) * 0.25, A.z + (s[i * 2] - 0.5) * 0.3);
      }
      sparks.fade(fade);
    },
  };
};

IMPACT.light = (k, from, to, { big }) => {
  const N = big ? 12 : 8, m = big ? 1.4 : 1;
  const glo = k.sprite('soft', { color: 0xfff3a0, size: 0.1, opacity: 0.5 });
  const rays = k.points({ n: N, tex: 'star', size: 0.34 * m, colors: [0xffffff, 0xffe680] });
  return {
    dur: 400,
    step(p) {
      halo(glo, to.pos.x, to.pos.y, to.pos.z, (to.r * 2 + 0.5) * m * (0.6 + 0.6 * k.ease(p)), 0.5 * Math.sin(Math.PI * clamp01(p * 1.1)));
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + 0.4, d = (to.r * 0.5 + 0.2 + 0.9 * k.ease(p)) * m;
        rays.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + Math.sin(ang) * d * 0.9, to.pos.z + Math.sin(ang * 2) * 0.2);
      }
      rays.fade(fadeOut(p, 0.4));
    },
  };
};

// Beacon Beam: like a lighthouse, a wide beam turns round and settles on the target.
SIG.beaconbeam = (k, from, to) => {
  const cones = [k.mesh('cone', { color: 0xfff0a0, opacity: 0.32 }), k.mesh('cone', { color: 0xfff0a0, opacity: 0.2 }), k.mesh('cone', { color: 0xffffff, opacity: 0.3 })];
  const lamp = k.sprite('soft', { color: 0xfff3a0, size: 0.1, opacity: 0.55 });
  const tgt = k.sprite('soft', { color: 0xfff3a0, size: 0.1, opacity: 0.5 });
  const N = 14;
  const sparks = k.points({ n: N, tex: 'star', size: 0.28, colors: [0xffffff, 0xffe680] });
  const s = k.seeds(N, 1);
  const ox = from.pos.x, oy = from.pos.y + 0.2, oz = from.pos.z;
  const baseAng = Math.atan2(to.pos.z - oz, to.pos.x - ox);
  const len = Math.max(2, Math.hypot(to.pos.x - ox, to.pos.z - oz));
  return {
    dur: 700,
    step(p) {
      const sweep = (1 - k.ease(clamp01(p / 0.7))) * 2.4, fo = fadeOut(p, 0.75), on = clamp01(p / 0.08);
      for (let i = 0; i < 3; i++) {
        // 0 = the main beam; 1 = a faint twin on the far side of the lamp; 2 = a narrow bright core
        const ang = baseAng + sweep + (i === 1 ? Math.PI : 0), L = i === 1 ? len * 0.7 : len;
        const c = cones[i];
        c.position.set(ox + Math.cos(ang) * L, oy + (i === 1 ? 0 : to.pos.y - oy), oz + Math.sin(ang) * L);
        c.lookAt(B.set(ox, oy, oz));
        const w = i === 2 ? 0.14 : i === 1 ? 0.5 : 0.55;
        c.scale.set(w, w, L);
        c.material.opacity = [0.32, 0.18, 0.3][i] * fo * on;
      }
      halo(lamp, ox, oy, oz, 0.9 + 0.1 * Math.sin(p * 25), 0.55 * fo * on);
      const hit = clamp01((p - 0.55) / 0.3);
      halo(tgt, to.pos.x, to.pos.y, to.pos.z, (to.r * 2 + 0.4) * (0.5 + hit * 0.5), 0.5 * Math.sin(Math.PI * hit) * fo);
      for (let i = 0; i < N; i++) {
        if (p < 0.1) { sparks.hide(i); continue; }
        const t = s[i], ang = baseAng + sweep * (0.4 + 0.6 * t);
        sparks.set(i, ox + Math.cos(ang) * t * len, oy + (to.pos.y - oy) * t + Math.sin(p * 18 + i) * 0.2, oz + Math.sin(ang) * t * len);
      }
      sparks.fade(fo);
    },
  };
};

/* -------------------------------- paper -------------------------------- */

const CONFETTI = [0xf0386a, 0x4aa8ff, 0xffd84a, 0x6bdc7a, 0xffffff];

// Paper planes sailing along with a stream of confetti.
TRAVEL.paper = k => {
  const P = 4, N = 14;
  const planes = [];
  for (let i = 0; i < P; i++) planes.push(k.sprite('plane', { color: i % 2 ? 0xcfe0f7 : 0xffffff, size: 0.62 }));
  const bits = k.points({ n: N, tex: 'square', size: 0.2, colors: CONFETTI });
  const s = k.seeds(N, 2);
  return {
    dur: 430,
    step(p) {
      for (let i = 0; i < P; i++) {
        const t = trailT(p, i, P, 0.35), pl = planes[i];
        pl.visible = t >= 0;
        if (t < 0) continue;
        k.at(t, A, 0.3 + i * 0.1);
        const w = (i - 1.5) * 0.28 + Math.sin(t * 9 + i) * 0.12;
        pl.position.set(A.x + k.side.x * w, A.y + Math.cos(t * 8 + i) * 0.12, A.z + k.side.z * w);
        pl.material.rotation = Math.sin(t * 9 + i) * 0.35;
      }
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.55);
        if (t < 0) { bits.hide(i); continue; }
        k.at(t, A, 0.3);
        const w = (s[i * 2] - 0.5) * 0.8;
        bits.set(i, A.x + k.side.x * w, A.y + (s[i * 2 + 1] - 0.5) * 0.5 - (p - t) * 1.2, A.z + k.side.z * w);
      }
      bits.material.size = 0.2 + 0.06 * Math.sin(p * 40);
      bits.fade(fadeOut(p, 0.8));
    },
  };
};

// Confetti burst: coloured squares pop up and flutter down.
const confetti = (to, pts, n, p, s, m) => {
  for (let i = 0; i < n; i++) {
    const ang = s[i * 3] * 6.283, out = (0.3 + s[i * 3 + 1] * 0.9) * (to.r + 0.4) * m * easeOut(p), sec = p * 0.55;
    pts.set(i, to.pos.x + Math.cos(ang) * out + Math.sin(p * 12 + i) * 0.08,
      to.pos.y + (2 + s[i * 3 + 2] * 1.6) * sec - 4.5 * sec * sec, to.pos.z + Math.sin(ang) * out);
  }
  pts.material.size = 0.22 * m * (0.7 + 0.3 * Math.abs(Math.cos(p * 14)));
  pts.fade(fadeOut(p, 0.6));
};

IMPACT.paper = (k, from, to, { big }) => {
  const N = big ? 36 : 24, m = big ? 1.3 : 1;
  const bits = k.points({ n: N, tex: 'square', size: 0.22 * m, colors: CONFETTI });
  const sheets = k.points({ n: 4, tex: 'square', size: 0.5 * m, colors: [0xffffff, 0xeaf0fa] });
  const s = k.seeds(N, 3);
  return {
    dur: 420,
    step(p) {
      confetti(to, bits, N, p, s, m);
      for (let i = 0; i < 4; i++) {
        const ang = i * 1.57 + 0.6, d = (to.r + 0.15) * k.ease(p);
        sheets.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.3 + p * 0.6 - p * p * 0.9, to.pos.z + Math.sin(ang) * d);
      }
      sheets.material.size = 0.5 * m * (0.5 + 0.5 * Math.abs(Math.cos(p * 9)));
      sheets.fade(fadeOut(p, 0.5));
    },
  };
};

// Thousand Cranes: a flock of little paper cranes flies in a V, circles the target and bursts into confetti.
SIG.thousandcranes = (k, from, to) => {
  const N = 24, F = 14, cols = [0xffffff, 0xf0386a, 0xcfe0f7, 0xffd84a];
  const up = k.points({ n: N, tex: 'craneup', size: 0.42, colors: cols });
  const down = k.points({ n: N, tex: 'cranedown', size: 0.42, colors: cols });
  const bits = k.points({ n: F, tex: 'square', size: 0.22, colors: CONFETTI });
  const s = k.seeds(F, 3);
  return {
    dur: 700,
    step(p) {
      const fly = clamp01(p / 0.55), circ = clamp01((p - 0.45) / 0.55);
      for (let i = 0; i < N; i++) {
        const row = Math.floor((i + 1) / 2), sgn = i % 2 ? 1 : -1, t = clamp01(fly * 1.25 - row * 0.05);
        let x, y, z;
        if (circ <= 0 || t < 1) {
          k.at(t, A, 0.9);
          const spread = row * 0.17 * (1 - fly * 0.35);
          x = A.x + k.side.x * sgn * spread; y = A.y + Math.sin(p * 20 + i) * 0.06; z = A.z + k.side.z * sgn * spread;
        } else {
          const ang = (i / N) * 6.283 + circ * 5, rad = (to.r + 0.7) * (1 - circ * 0.4);
          x = to.pos.x + Math.cos(ang) * rad; y = to.pos.y + 0.3 + circ * 0.5 + Math.sin(i) * 0.3; z = to.pos.z + Math.sin(ang) * rad;
        }
        if ((Math.floor(p * 22 + i * 0.5) & 1) === 0) { up.set(i, x, y, z); down.hide(i); } else { down.set(i, x, y, z); up.hide(i); }
      }
      const fo = fadeOut(p, 0.8);
      up.fade(fo); down.fade(fo);
      const q = clamp01((p - 0.6) / 0.4);
      if (q <= 0) { for (let i = 0; i < F; i++) bits.hide(i); } else confetti(to, bits, F, q, s, 1.1);
    },
  };
};

/* ==== end of the four newer types ==== */
