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

/* ==== T18: time, camo, cyber ==== */
Object.assign(FX_COLORS, {
  time: [0xffc25a, 0xfff0c0, 0x8a5a2a], camo: [0x6aa84a, 0xb8d890, 0x4a6a3a], cyber: [0x5af0ff, 0x2a7aff, 0xffffff],
});

const snap = (v, g) => Math.round(v / g) * g;
// A spot on a screen-facing plane (the target's "side" direction and up) around a centre.
const planeAt = (out, c, side, x, y) => out.set(c.x + side.x * x, c.y + y, c.z + side.z * x);
// A box lying along the horizontal direction `side` (for the cyber jaws).
const turnTo = (m, side) => { m.rotation.y = Math.atan2(-side.z, side.x); };

/* -------------------------------- time -------------------------------- */

// A little clock face (12 ticks, a minute hand that spins four turns) arcs over, trailed by gear dots.
TRAVEL.time = k => {
  const ring = k.points({ n: 12, tex: 'square', size: 0.13, glow: true, colors: [0xffe9a0, 0xffc25a] });
  const hands = k.points({ n: 6, tex: 'dot', size: 0.17, colors: [0x8a5a2a, 0x5a3a18] });
  const N = 6;
  const gears = k.points({ n: N, tex: 'gear', size: 0.26, colors: [0xffc25a, 0xd89a3a, 0xfff0c0] });
  const R = 0.38;
  return {
    dur: 420,
    step(p) {
      k.at(p, A, 0.8);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.283;
        planeAt(B, A, k.side, Math.sin(a) * R, Math.cos(a) * R);
        ring.set(i, B.x, B.y, B.z);
      }
      const minute = p * 4 * 6.283, hour = minute / 12;
      for (let i = 0; i < 6; i++) {
        const long = i < 4, a = long ? minute : hour, d = long ? (i + 1) * 0.085 : (i - 3) * 0.07;
        planeAt(B, A, k.side, Math.sin(a) * d, Math.cos(a) * d);
        hands.set(i, B.x, B.y, B.z);
      }
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.5);
        if (t < 0.02 || i === 0) { gears.hide(i); continue; }
        k.at(t, C, 0.8);
        gears.set(i, C.x, C.y + Math.sin(p * 20 + i) * 0.05 - 0.05, C.z);
      }
      ring.fade(fadeOut(p, 0.85));
    },
  };
};

// A ring of 12 tick marks spreads out while one clock hand sweeps a full circle.
IMPACT.time = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1;
  const ticks = k.points({ n: 12, tex: 'square', size: 0.16 * m, glow: true, colors: [0xffc25a, 0xfff0c0] });
  const hand = k.points({ n: 5, tex: 'dot', size: 0.2 * m, glow: true, colors: [0xfff0c0, 0xffc25a] });
  return {
    dur: 400,
    step(p) {
      const rad = (to.r * 0.7 + 0.2) * (0.5 + k.ease(p) * 0.9) * m;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.283;
        planeAt(B, to.pos, k.side, Math.sin(a) * rad, Math.cos(a) * rad);
        ticks.set(i, B.x, B.y, B.z);
      }
      const a = p * 6.283;
      for (let i = 0; i < 5; i++) {
        const d = (rad * (i + 1)) / 5;
        planeAt(B, to.pos, k.side, Math.sin(a) * d, Math.cos(a) * d);
        hand.set(i, B.x, B.y, B.z);
      }
      ticks.fade(fadeOut(p, 0.5));
      hand.fade(fadeOut(p, 0.7));
    },
  };
};

// Wake-Up Call: a big alarm clock shakes above the target, RIIING, with "!" marks and two shock rings.
SIG.wakeupcall = (k, from, to) => {
  const clock = k.sprite('clock', { color: 0xffc25a, size: 0.1, glow: true });
  const bangs = [0, 1, 2].map(i => k.sprite('bang', { color: i === 1 ? 0xfff0c0 : 0xffe14a, size: 0.1, glow: true }));
  const rings = [0, 1].map(i => k.mesh('ring', { color: i ? 0xfff0c0 : 0xffc25a, glow: true }));
  const ground = feetOf(to);
  return {
    dur: 650,
    step(p) {
      const grow = clamp01(p / 0.15), sz = 0.9 + to.r * 0.4;
      const shake = p > 0.12 ? Math.sin(p * 90) * 0.12 : 0;
      clock.position.set(to.pos.x + k.side.x * shake * 0.4, to.top + 0.9 + (1 - k.ease(grow)) * 1.5, to.pos.z + k.side.z * shake * 0.4);
      clock.scale.setScalar(Math.max(0.01, sz * (0.5 + 0.5 * grow)));
      clock.material.rotation = shake;
      clock.material.opacity = fadeOut(p, 0.8);
      for (let i = 0; i < 3; i++) {
        const q = clamp01((p - 0.2 - i * 0.08) / 0.3), a = (i - 1) * 0.8;
        planeAt(B, clock.position, k.side, Math.sin(a) * sz * 0.8, Math.cos(a) * sz * 0.5 + 0.1);
        bangs[i].position.copy(B);
        bangs[i].scale.setScalar(Math.max(0.01, 0.6 * Math.sin(Math.PI * q)));
        bangs[i].material.opacity = q > 0 && q < 1 ? 1 : 0;
      }
      for (let i = 0; i < 2; i++) {
        const q = clamp01((p - 0.25 - i * 0.2) / 0.5);
        lay(rings[i], to.pos.x, ground + 0.06, to.pos.z, Math.max(0.01, (to.r + 0.3) * (0.4 + q * 2.4)));
        rings[i].material.opacity = q > 0 ? 0.8 * (1 - q) : 0;
      }
    },
  };
};

/* -------------------------------- camo -------------------------------- */

// Leaves and block bits come out of nowhere: invisible at first, they only show up near the target.
TRAVEL.camo = k => {
  const N = 9;
  const leaves = k.points({ n: N, tex: 'leaf', size: 0.3, colors: [0x6aa84a, 0x8cc86a, 0x4a6a3a] });
  const bits = k.points({ n: N, tex: 'square', size: 0.2, colors: [0xb8d890, 0x8a7a4a, 0x7a8a5a] });
  const s = k.seeds(N, 2);
  return {
    dur: 400,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.35);
        if (t < 0) { leaves.hide(i); bits.hide(i); continue; }
        k.at(t, A, 0.25);
        const w = Math.sin(t * 12 + i * 2) * 0.16, h = (s[i * 2] - 0.5) * 0.3;
        leaves.set(i, A.x + k.side.x * w, A.y + h, A.z + k.side.z * w);
        bits.set(i, A.x - k.side.x * w * 0.8, A.y - h + 0.05, A.z - k.side.z * w * 0.8);
      }
      const vis = clamp01((p - 0.4) / 0.3) * fadeOut(p, 0.9);
      leaves.fade(vis);
      bits.fade(vis);
    },
  };
};

// A "poof": leaves and puffs pop out all round.
IMPACT.camo = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1;
  const leaves = k.points({ n: 4, tex: 'leaf', size: 0.36 * m, colors: [0x6aa84a, 0x8cc86a] });
  const puffs = k.points({ n: 4, tex: 'puff', size: 0.55 * m, colors: [0xcfe0b0, 0xb8d890] });
  const s = k.seeds(8, 2);
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * 6.283 + s[i * 2] * 0.5, d = (to.r * 0.6 + 0.15 + s[i * 2 + 1] * 0.4) * k.ease(p) * m;
        (i % 2 ? puffs : leaves).set(i >> 1, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.1 + p * 0.5, to.pos.z + Math.sin(ang) * d);
      }
      leaves.fade(fadeOut(p, 0.5));
      puffs.fade(1 - p);
    },
  };
};

// Statue Slam: a big grey stone block falls from three blocks up, dust rings out and chips fly.
SIG.statueslam = (k, from, to) => {
  const stone = k.mesh('box', { color: 0x9a968c });
  const band = k.mesh('box', { color: 0x6a665c });
  const dust = k.points({ n: 8, tex: 'puff', size: 0.6, colors: [0xd8d4c8, 0xb0aca0] });
  const chips = k.points({ n: 4, tex: 'shard', size: 0.3, colors: [0x8a867c, 0xb0aca0] });
  const s = k.seeds(8, 2), ground = feetOf(to);
  const size = Math.max(0.9, to.r * 1.6);
  return {
    dur: 650,
    step(p) {
      const f = clamp01(p / 0.45), y0 = to.top + 3, y1 = ground + size / 2 + 0.05;
      const y = lerp(y0, y1, f * f);
      const squash = p > 0.45 ? 1 - Math.max(0, 0.15 - (p - 0.45) * 0.4) : 1;
      stone.position.set(to.pos.x, y, to.pos.z);
      stone.scale.set(size, size * squash, size);
      band.position.set(to.pos.x, y, to.pos.z);
      band.scale.set(size * 1.04, size * squash * 0.3, size * 1.04);
      stone.material.opacity = band.material.opacity = fadeOut(p, 0.8);
      const d = clamp01((p - 0.45) / 0.55);
      for (let i = 0; i < 8; i++) {
        if (d <= 0) { dust.hide(i); continue; }
        const ang = (i / 8) * 6.283 + s[i * 2], rad = (to.r + 0.2 + s[i * 2 + 1] * 0.4) * k.ease(d);
        dust.set(i, to.pos.x + Math.cos(ang) * rad, ground + 0.15 + d * 0.4, to.pos.z + Math.sin(ang) * rad);
      }
      dust.fade(1 - d);
      for (let i = 0; i < 4; i++) {
        if (d <= 0) { chips.hide(i); continue; }
        const ang = i * 1.7 + s[i * 2] * 2, far = 0.9 * d * (1 + s[i * 2 + 1]);
        chips.set(i, to.pos.x + Math.cos(ang) * far, ground + 0.2 + Math.sin(d * Math.PI) * (0.9 + s[i * 2 + 1]), to.pos.z + Math.sin(ang) * far);
      }
      chips.fade(fadeOut(d, 0.6));
    },
  };
};

/* -------------------------------- cyber -------------------------------- */

// A stream of pixels that jumps in steps on a coarse grid, like a low frame rate.
TRAVEL.cyber = k => {
  const N = 10;
  const px = k.points({ n: N, tex: 'square', size: 0.2, glow: true, colors: [0x5af0ff, 0x2a7aff, 0xffffff, 0x5af0ff] });
  const s = k.seeds(N, 2);
  return {
    dur: 400,
    step(p) {
      const q = Math.floor(p * 8) / 8;
      for (let i = 0; i < N; i++) {
        const t = trailT(q, i, N, 0.4);
        if (t < 0) { px.hide(i); continue; }
        k.at(t, A, 0.2);
        const w = snap((s[i * 2] - 0.5) * 0.4, 0.15);
        px.set(i, snap(A.x + k.side.x * w, 0.15), snap(A.y + (s[i * 2 + 1] - 0.5) * 0.3, 0.15), snap(A.z + k.side.z * w, 0.15));
      }
      px.fade(fadeOut(p, 0.9));
    },
  };
};

// A glitch: three streaks jump sideways every sixth of the effect while pixels scatter on the grid.
IMPACT.cyber = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1;
  const streaks = [0x5af0ff, 0xff4ad8, 0xffffff].map(c => k.sprite('streak', { color: c, size: 0.1, glow: true }));
  const px = k.points({ n: 8, tex: 'square', size: 0.2 * m, glow: true, colors: [0x5af0ff, 0x2a7aff, 0xffffff] });
  const s = k.seeds(24, 2);
  return {
    dur: 380,
    step(p) {
      const step = Math.min(5, Math.floor(p * 6));
      for (let i = 0; i < 3; i++) {
        const off = (s[(step * 3 + i) % 24] - 0.5) * 1.1 * m;
        streaks[i].position.set(to.pos.x + k.side.x * off, to.pos.y + (i - 1) * 0.28 * m, to.pos.z + k.side.z * off);
        streaks[i].scale.set((1.0 + s[(step * 3 + i + 7) % 24]) * m * (to.r + 0.4), 0.3 * m, 1);
        streaks[i].material.opacity = fadeOut(p, 0.7);
      }
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * 6.283 + s[i * 2], d = (to.r * 0.5 + 0.2 + s[i * 2 + 1] * 0.5) * k.ease(p) * m;
        px.set(i, snap(to.pos.x + Math.cos(ang) * d, 0.15), snap(to.pos.y + 0.1 + s[i * 2 + 1] * 0.4, 0.15), snap(to.pos.z + Math.sin(ang) * d, 0.15));
      }
      px.fade(fadeOut(p, 0.5));
    },
  };
};

// Mega Byte: a pixel mouth opens over the target and chomps shut twice, then pixels burst out.
SIG.megabyte = (k, from, to) => {
  const jaws = [0, 1].map(r => k.mesh('box', { color: r ? 0x2a7aff : 0x5af0ff, glow: true }));
  const teeth = k.points({ n: 10, tex: 'square', size: 0.3, glow: true, colors: [0xffffff, 0xd8fbff] });
  const burst = k.points({ n: 14, tex: 'square', size: 0.24, glow: true, colors: [0x5af0ff, 0x2a7aff, 0xffffff] });
  const s = k.seeds(14, 3);
  const w = Math.max(0.3, to.r * 0.6), mid = (to.pos.y + to.top) / 2, reach = (to.top - to.pos.y + 0.4) * 0.75;
  return {
    dur: 700,
    step(p) {
      const q = clamp01((p - 0.2) / 0.5);
      const open = p < 0.2 ? k.ease(p / 0.2) : 0.5 + 0.5 * Math.cos(q * 4 * Math.PI);
      const gap = 0.05 + open * reach, shown = p <= 0.72;
      for (let r = 0; r < 2; r++) {
        const dy = (r ? -1 : 1) * (gap + w * 0.3);
        planeAt(jaws[r].position, to.pos, k.side, 0, mid - to.pos.y + dy + (r ? -1 : 1) * w * 0.12);
        turnTo(jaws[r], k.side);
        jaws[r].scale.set(w * 5.4, w * 0.45, w * 0.9);
        jaws[r].material.opacity = shown ? clamp01(p / 0.1) : 0;
        for (let i = 0; i < 5; i++) {
          const x = (i - 2) * w * 1.05;
          if (!shown) { teeth.hide(r * 5 + i); continue; }
          planeAt(B, to.pos, k.side, x, mid - to.pos.y + dy - (r ? -1 : 1) * w * 0.28);
          teeth.set(r * 5 + i, B.x, B.y, B.z);
        }
      }
      teeth.fade(clamp01(p / 0.1));
      const b = clamp01((p - 0.7) / 0.3);
      for (let i = 0; i < 14; i++) {
        if (b <= 0) { burst.hide(i); continue; }
        const ang = s[i * 3] * 6.283, d = (0.3 + s[i * 3 + 1]) * (to.r + 0.4) * k.ease(b);
        burst.set(i, snap(to.pos.x + Math.cos(ang) * d, 0.15), snap(mid + (s[i * 3 + 2] - 0.5) * 1.4 * k.ease(b), 0.15), snap(to.pos.z + Math.sin(ang) * d, 0.15));
      }
      burst.fade(1 - b);
    },
  };
};
/* ==== end of T18 ==== */

/* ==== T21: cozy, treasure ==== */
Object.assign(FX_COLORS, {
  cozy: [0xffa080, 0xfff0d8, 0xe0607a], treasure: [0xffd23a, 0xfff6c0, 0xe0304a, 0x3a8aff],
});

const wave21 = t => Math.sin(Math.PI * t);

/* -------------------------------- cozy -------------------------------- */

// Warm puffs drift over in a gentle wave with three little hearts.
TRAVEL.cozy = k => {
  const N = 6;
  const puffs = k.points({ n: N, tex: 'puff', size: 0.42, colors: [0xffd8b8, 0xfff0d8, 0xffb48a] });
  const hearts = k.points({ n: 3, tex: 'heart', size: 0.3, glow: true, colors: [0xe0607a, 0xff8aa0, 0xffb0c0] });
  return {
    dur: 420,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.4);
        if (t < 0) { puffs.hide(i); continue; }
        k.at(t, A, 0.3);
        const w = Math.sin(t * 9 + i) * 0.12;
        puffs.set(i, A.x + k.side.x * w, A.y + Math.cos(t * 7 + i) * 0.08, A.z + k.side.z * w);
      }
      puffs.fade(fadeOut(p, 0.8));
      for (let i = 0; i < 3; i++) {
        const t = trailT(p, i * 2, N, 0.4);
        if (t < 0) { hearts.hide(i); continue; }
        k.at(t, A, 0.5);
        const w = Math.sin(t * 8 + i * 2) * 0.18;
        hearts.set(i, A.x + k.side.x * w, A.y + 0.12, A.z + k.side.z * w);
      }
      hearts.fade(fadeOut(p, 0.8));
    },
  };
};

// Eight hearts ring out and float up, over a soft cushion of puff.
IMPACT.cozy = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 8;
  const hearts = k.points({ n: N, tex: 'heart', size: 0.34 * m, glow: true, colors: [0xe0607a, 0xff8aa0, 0xffb0c0, 0xffa080] });
  const cushion = k.points({ n: 5, tex: 'puff', size: 0.7 * m, colors: [0xfff0d8, 0xffd8b8] });
  const s = k.seeds(N, 2);
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + s[i * 2] * 0.5, d = (to.r * 0.4 + 0.15 + s[i * 2 + 1] * 0.2) * k.ease(p) * m;
        hearts.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.1 + k.ease(p) * (0.5 + s[i * 2 + 1] * 0.4), to.pos.z + Math.sin(ang) * d);
      }
      hearts.fade(fadeOut(p, 0.5));
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * 6.283, d = to.r * 0.5 * k.ease(p);
        cushion.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y - 0.05 + p * 0.15, to.pos.z + Math.sin(ang) * d);
      }
      cushion.fade(fadeOut(p, 0.3) * 0.9);
    },
  };
};

// Lights Out: a dark blue blanket grows over the target, a pale moon rises above it and three z drift up.
SIG.lightsout = (k, from, to) => {
  const blanket = k.mesh('disc', { color: 0x1a2a6a, opacity: 0.5 });
  const moon = k.sprite('dot', { color: 0xfff6c8, size: 0.1, glow: true });
  const zs = [0, 1, 2].map(() => k.sprite('z', { color: 0xdfe8ff, size: 0.1, glow: true }));
  const stars = k.points({ n: 6, tex: 'star', size: 0.2, glow: true, colors: [0xfff6c8, 0xffffff] });
  const s = k.seeds(6, 2);
  return {
    dur: 650,
    step(p) {
      const g = k.ease(clamp01(p / 0.45)), top = to.top + 0.05;
      blanket.rotation.set(-Math.PI / 2, 0, 0);
      blanket.position.set(to.pos.x, lerp(top + 0.8, top, g), to.pos.z);
      blanket.scale.setScalar(Math.max(0.01, (to.r + 0.35) * g));
      blanket.material.opacity = 0.5 * fadeOut(p, 0.75) * clamp01(p / 0.1);
      const up = clamp01((p - 0.25) / 0.5);
      moon.position.set(to.pos.x + k.side.x * 0.5, top + 0.5 + up * 0.5, to.pos.z + k.side.z * 0.5);
      moon.scale.setScalar(Math.max(0.01, 0.55 * k.ease(up)));
      moon.material.opacity = fadeOut(p, 0.8) * (up > 0 ? 1 : 0);
      for (let i = 0; i < 3; i++) {
        const q = clamp01((p - 0.3 - i * 0.1) / 0.5);
        zs[i].position.set(to.pos.x - k.side.x * (0.2 + i * 0.15), top + 0.1 + q * 0.7, to.pos.z - k.side.z * (0.2 + i * 0.15));
        zs[i].scale.setScalar(Math.max(0.01, (0.25 + i * 0.08) * (q > 0 ? 1 : 0)));
        zs[i].material.opacity = q > 0 ? wave21(q) : 0;
      }
      for (let i = 0; i < 6; i++) {
        if (up <= 0) { stars.hide(i); continue; }
        const ang = s[i * 2] * 6.283, d = to.r + 0.3 + s[i * 2 + 1] * 0.4;
        stars.set(i, to.pos.x + Math.cos(ang) * d, top + 0.2 + s[i * 2 + 1] * 0.8, to.pos.z + Math.sin(ang) * d);
      }
      stars.fade(fadeOut(p, 0.7) * wave21(clamp01(up)));
    },
  };
};

/* ------------------------------- treasure ------------------------------- */

// Gold coins spin along the arc (a coin turning: its size flips) with a few star glints.
TRAVEL.treasure = k => {
  const N = 8;
  const coins = k.points({ n: N, tex: 'coin', size: 0.3, glow: true, colors: [0xffd23a, 0xfff0a0, 0xffb020] });
  const glints = k.points({ n: 4, tex: 'star', size: 0.22, glow: true, colors: [0xffffff, 0xfff6c0] });
  const s = k.seeds(N, 2);
  return {
    dur: 420,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.4);
        if (t < 0) { coins.hide(i); continue; }
        k.at(t, A, 0.5);
        coins.set(i, A.x + (s[i * 2] - 0.5) * 0.2, A.y + (s[i * 2 + 1] - 0.5) * 0.2, A.z);
      }
      coins.material.size = 0.1 + 0.26 * Math.abs(Math.sin(p * 20));
      coins.fade(fadeOut(p, 0.8));
      for (let i = 0; i < 4; i++) {
        const t = trailT(p, i * 2 + 0.5, N, 0.4);
        if (t < 0) { glints.hide(i); continue; }
        k.at(t, A, 0.5);
        glints.set(i, A.x + Math.sin(p * 14 + i * 2) * 0.22, A.y + Math.cos(p * 11 + i) * 0.18, A.z);
      }
      glints.fade(fadeOut(p, 0.8));
    },
  };
};

// Ten gems burst up and fall back on a parabola, with four star twinkles.
IMPACT.treasure = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 10;
  const gems = k.points({ n: N, tex: 'gem', size: 0.3 * m, glow: true, colors: [0xe0304a, 0x3a8aff, 0xffd23a] });
  const stars = k.points({ n: 4, tex: 'star', size: 0.26 * m, glow: true, colors: [0xffffff, 0xfff6c0] });
  const s = k.seeds(N, 3);
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283, v = (0.3 + s[i * 3 + 1] * 0.5) * m, up = (1.6 + s[i * 3 + 2] * 1.2) * m;
        const t = p * 0.55;
        gems.set(i, to.pos.x + Math.cos(ang) * v * p * 1.5, to.pos.y + 0.1 + up * t * 1.2 - 9 * t * t, to.pos.z + Math.sin(ang) * v * p * 1.5);
      }
      gems.fade(fadeOut(p, 0.6));
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * 6.283 + 0.7, d = (to.r * 0.5 + 0.2) * m;
        const tw = wave21(clamp01(p * 1.4 - i * 0.12));
        if (tw <= 0.02) { stars.hide(i); continue; }
        stars.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.15 + (i % 2) * 0.35, to.pos.z + Math.sin(ang) * d);
      }
      stars.fade(0.95);
    },
  };
};

// Crown Jewel: a big gem drops onto the target, a gold ring spreads at its feet and five stars flash in a crown shape.
SIG.crownjewel = (k, from, to) => {
  const jewel = k.sprite('gem', { color: 0xe0304a, size: 0.1, glow: true });
  const shine = k.sprite('star', { color: 0xffffff, size: 0.1, glow: true });
  const ring = k.mesh('ring', { color: 0xffd23a, opacity: 0.8 });
  const crown = [0, 1, 2, 3, 4].map(() => k.sprite('star', { color: 0xffd23a, size: 0.1, glow: true }));
  const sparks = k.points({ n: 12, tex: 'coin', size: 0.24, glow: true, colors: [0xffd23a, 0xfff0a0] });
  const s = k.seeds(12, 2);
  const feet = feetOf(to);
  return {
    dur: 650,
    step(p) {
      const d = clamp01(p / 0.45), drop = d * d, hit = clamp01((p - 0.45) / 0.55);
      const y = lerp(to.pos.y + 2.5, to.pos.y + 0.1, drop);
      jewel.position.set(to.pos.x, y, to.pos.z);
      jewel.scale.setScalar(Math.max(0.01, p < 0.5 ? 0.9 : 0.9 * (1 - clamp01((p - 0.5) / 0.15))));
      jewel.material.opacity = p < 0.5 ? clamp01(p / 0.08) : 1 - clamp01((p - 0.5) / 0.15);
      shine.position.set(to.pos.x + 0.12, y + 0.1, to.pos.z);
      shine.scale.setScalar(Math.max(0.01, 0.4 * (1 + Math.sin(p * 40) * 0.3) * (p < 0.5 ? 1 : 0)));
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.position.set(to.pos.x, feet + 0.06, to.pos.z);
      ring.scale.setScalar(Math.max(0.01, (to.r * 0.5 + k.ease(hit) * 1.2) * (hit > 0 ? 1 : 0)));
      ring.material.opacity = hit > 0 ? 0.8 * (1 - hit) : 0;
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.32, h = 0.2 + (i % 2 === 0 ? 0.28 : 0) + (i === 2 ? 0.15 : 0);
        const f = clamp01((hit - 0.1 - i * 0.05) / 0.3);
        planeAt(crown[i].position, to.pos, k.side, x, to.top - to.pos.y + 0.3 + h);
        crown[i].scale.setScalar(Math.max(0.01, 0.38 * wave21(f)));
        crown[i].material.opacity = f > 0 && f < 1 ? 1 : 0;
      }
      for (let i = 0; i < 12; i++) {
        if (hit <= 0) { sparks.hide(i); continue; }
        const ang = s[i * 2] * 6.283, dd = (to.r + 0.2 + s[i * 2 + 1] * 0.6) * k.ease(hit);
        sparks.set(i, to.pos.x + Math.cos(ang) * dd, feet + 0.2 + s[i * 2 + 1] * 0.9 * k.ease(hit), to.pos.z + Math.sin(ang) * dd);
      }
      sparks.fade(1 - hit);
    },
  };
};
/* ==== end of T21 ==== */

/* ==== T33: food ==== */
Object.assign(FX_COLORS, { food: [0xff6a4a, 0xffd24a, 0x8ad46a, 0xfff0d8] });
const SPRINKLES = [0xff4a4a, 0x4ab0ff, 0xffe84a, 0x6ad84a, 0xffffff, 0xb06aff];

// Sprinkles wiggle along the arc with a few bun crumbs trailing behind.
TRAVEL.food = k => {
  const N = 7;
  const dots = k.points({ n: N, tex: 'dot', size: 0.26, glow: true, colors: SPRINKLES });
  const crumbs = k.points({ n: 3, tex: 'puff', size: 0.34, colors: [0xe0a050, 0xf4d08a] });
  return {
    dur: 400,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.4);
        if (t < 0) { dots.hide(i); continue; }
        k.at(t, A, 0.5);
        dots.set(i, A.x, A.y + Math.sin(p * 18 + i * 1.7) * 0.16, A.z);
      }
      dots.fade(fadeOut(p, 0.85));
      for (let i = 0; i < 3; i++) {
        const t = trailT(p, i * 2 + 1, N, 0.6);
        if (t < 0) { crumbs.hide(i); continue; }
        k.at(t, A, 0.3);
        crumbs.set(i, A.x, A.y - 0.1 - t * 0.1, A.z);
      }
      crumbs.fade(fadeOut(p, 0.7));
    },
  };
};

// Tomato and cheese splats burst out; sprinkles are thrown up and fall back.
IMPACT.food = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 8;
  const splats = k.points({ n: 6, tex: 'splat', size: 0.4 * m, glow: true, colors: [0xff5a3a, 0xffd23a] });
  const dots = k.points({ n: N, tex: 'dot', size: 0.24 * m, glow: true, colors: SPRINKLES });
  const s = k.seeds(N + 6, 3);
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * 6.283 + s[i * 3] * 0.8, d = (to.r * 0.4 + 0.1 + k.ease(p) * 0.7) * m;
        splats.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.1 + s[i * 3 + 1] * 0.5, to.pos.z + Math.sin(ang) * d);
      }
      splats.fade(fadeOut(p, 0.5));
      for (let i = 0; i < N; i++) {
        const ang = s[(i + 6) * 3] * 6.283, v = (0.3 + s[(i + 6) * 3 + 1] * 0.5) * m, up = (1.6 + s[(i + 6) * 3 + 2] * 1.2) * m;
        const t = p * 0.55;
        dots.set(i, to.pos.x + Math.cos(ang) * v * p * 1.5, to.pos.y + 0.1 + up * t * 1.2 - 9 * t * t, to.pos.z + Math.sin(ang) * v * p * 1.5);
      }
      dots.fade(fadeOut(p, 0.6));
    },
  };
};

// Mega Munch: two rows of four white teeth close on the target twice; every chomp throws crumbs and a star flash.
SIG.megamunch = (k, from, to) => {
  const top = [0, 1, 2, 3].map(() => k.sprite('square', { color: 0xffffff, size: 0.1, glow: true }));
  const bot = [0, 1, 2, 3].map(() => k.sprite('square', { color: 0xfff4e0, size: 0.1, glow: true }));
  const flash = k.sprite('star', { color: 0xffe14a, size: 0.1, glow: true });
  const crumbs = k.points({ n: 12, tex: 'puff', size: 0.34, colors: [0xe0a050, 0xf4d08a] });
  const s = k.seeds(12, 2);
  const mid = to.pos.y + 0.2, reach = (to.top - to.pos.y) + 0.7;
  return {
    dur: 650,
    step(p) {
      // wide open at first, shut at p 0.35, open again, shut at p 0.7
      const gap = p < 0.35 ? 1 - k.ease(p / 0.35) : p < 0.5 ? k.ease((p - 0.35) / 0.15) : p < 0.7 ? 1 - k.ease((p - 0.5) / 0.2) : 0;
      const open = reach * (0.05 + 0.95 * gap);
      const fade = p > 0.85 ? clamp01((1 - p) / 0.15) : clamp01(p / 0.1);
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 0.34;
        planeAt(top[i].position, to.pos, k.side, x, mid - to.pos.y + open);
        planeAt(bot[i].position, to.pos, k.side, x, mid - to.pos.y - open * 0.7);
        top[i].scale.setScalar(Math.max(0.01, 0.3 * fade));
        bot[i].scale.setScalar(Math.max(0.01, 0.3 * fade));
        top[i].material.opacity = bot[i].material.opacity = fade;
      }
      const c1 = clamp01((p - 0.35) / 0.2), c2 = clamp01((p - 0.7) / 0.2);
      const burst = p < 0.7 ? c1 : c2;
      flash.position.set(to.pos.x, mid, to.pos.z);
      flash.scale.setScalar(Math.max(0.01, 0.9 * wave21(burst)));
      flash.material.opacity = burst > 0 && burst < 1 ? 1 : 0;
      for (let i = 0; i < 12; i++) {
        const b = i < 6 ? (p < 0.7 ? c1 : 0) : c2;
        if (b <= 0 || b >= 1) { crumbs.hide(i); continue; }
        const ang = s[i * 2] * 6.283, d = (0.2 + s[i * 2 + 1] * 0.8) * k.ease(b);
        crumbs.set(i, to.pos.x + Math.cos(ang) * d, mid + 0.2 + s[i * 2 + 1] * 0.8 * b - 1.2 * b * b, to.pos.z + Math.sin(ang) * d);
      }
      crumbs.fade(0.9);
    },
  };
};
/* ==== end of T33 ==== */

/* ==== T36 parkour ==== */
// Band red, shoe white, sole blue.
FX_COLORS.parkour = [0xff3b3b, 0xffffff, 0x2a8cff];
const wave36 = t => Math.sin(Math.PI * t);

// A parkour run: five dust puffs bounce along the arc in three little hops, with three speed lines trailing behind.
TRAVEL.parkour = k => {
  const N = 5;
  const dust = k.points({ n: N, tex: 'puff', size: 0.4, colors: [0xe8e0d0, 0xc8c0b0] });
  const lines = k.points({ n: 3, tex: 'streak', size: 0.36, glow: true, colors: [0xff3b3b, 0xffffff, 0x2a8cff] });
  return {
    dur: 400,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.3);
        if (t < 0) { dust.hide(i); continue; }
        k.at(t, A, 0.15);
        dust.set(i, A.x, A.y + Math.abs(Math.sin(t * 3 * Math.PI)) * 0.35, A.z);
      }
      dust.fade(fadeOut(p, 0.8));
      for (let i = 0; i < 3; i++) {
        const t = clamp01(p * 1.3 - 0.08 - i * 0.1);
        if (t <= 0 || p >= 1) { lines.hide(i); continue; }
        k.at(t, A, 0.15);
        lines.set(i, A.x + k.side.x * (i - 1) * 0.16, A.y + Math.abs(Math.sin(t * 3 * Math.PI)) * 0.35 + (i - 1) * 0.06, A.z + k.side.z * (i - 1) * 0.16);
      }
      lines.fade(fadeOut(p, 0.7));
    },
  };
};

// A landing: a bang star on the target and a ring of eight dust clouds rolling out at its feet.
IMPACT.parkour = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 8;
  const dust = k.points({ n: N, tex: 'puff', size: 0.5 * m, colors: [0xe8e0d0, 0xc8c0b0] });
  const bang = k.sprite('bang', { color: 0xff3b3b, size: 0.1, glow: true });
  return {
    dur: 340,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283, d = (to.r * 0.4 + 0.1) * m + k.ease(p) * (0.6 + to.r * 0.5) * m;
        dust.set(i, to.pos.x + Math.cos(ang) * d, feetOf(to) + 0.15 + p * 0.2, to.pos.z + Math.sin(ang) * d);
      }
      dust.fade(1 - p);
      bang.position.set(to.pos.x, to.pos.y + 0.1, to.pos.z);
      bang.scale.setScalar(Math.max(0.01, 0.9 * m * wave36(clamp01(p * 1.4))));
      bang.material.opacity = fadeOut(p, 0.5);
    },
  };
};

// Rooftop Run: a red trail zigzags up three steps beside the target (a wall run), arcs over it and drops down; a dust ring and
// five stars flash at its feet on landing.
SIG.rooftoprun = (k, from, to) => {
  const trail = k.points({ n: 12, tex: 'streak', size: 0.3, glow: true, colors: [0xff3b3b, 0xffffff] });
  const runner = k.sprite('star', { color: 0xffffff, size: 0.1, glow: true });
  const ring = k.mesh('ring', { color: 0xe8e0d0, opacity: 0.8 });
  const stars = k.points({ n: 5, tex: 'star', size: 0.3, glow: true, colors: [0xff3b3b, 0xffffff, 0x2a8cff] });
  const feet = feetOf(to), top = to.top - feet + 0.5;
  // the path for u in 0..1: three zigzag steps up the side, an arc over the target, a drop
  const at = (u, out) => {
    const sx = k.side.x, sz = k.side.z;
    if (u < 0.45) { // three steps, each a little diagonal
      const q = u / 0.45, st = Math.min(2, Math.floor(q * 3)), f = q * 3 - st;
      const off = 0.55 + (st % 2 ? 0.1 : -0.1) * (f - 0.5);
      return out.set(to.pos.x + sx * off, feet + ((st + f) / 3) * top, to.pos.z + sz * off);
    }
    if (u < 0.75) { // over the top
      const q = (u - 0.45) / 0.3;
      return out.set(to.pos.x + sx * lerp(0.55, -0.1, q), feet + top + Math.sin(q * Math.PI) * 0.5, to.pos.z + sz * lerp(0.55, -0.1, q));
    }
    const q = (u - 0.75) / 0.25; // drop to the feet
    return out.set(to.pos.x - sx * 0.1 * (1 - q), lerp(feet + top, feet + 0.1, q * q), to.pos.z - sz * 0.1 * (1 - q));
  };
  const s = k.seeds(5, 2);
  return {
    dur: 650,
    step(p) {
      const u = clamp01(p / 0.8);
      for (let i = 0; i < 12; i++) {
        const t = u - i * 0.045;
        if (t <= 0 || u >= 1) { trail.hide(i); continue; }
        at(t, A);
        trail.set(i, A.x, A.y, A.z);
      }
      trail.fade(fadeOut(p, 0.8));
      at(u, A);
      runner.position.copy(A);
      runner.scale.setScalar(Math.max(0.01, 0.3 * (p < 0.8 ? 1 : 0)));
      runner.material.opacity = p < 0.8 ? 1 : 0;
      const hit = clamp01((p - 0.8) / 0.2);
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.position.set(to.pos.x, feet + 0.06, to.pos.z);
      ring.scale.setScalar(Math.max(0.01, (to.r * 0.5 + k.ease(hit) * 1.1) * (hit > 0 ? 1 : 0)));
      ring.material.opacity = hit > 0 ? 0.8 * (1 - hit) : 0;
      for (let i = 0; i < 5; i++) {
        if (hit <= 0) { stars.hide(i); continue; }
        const ang = (i / 5) * 6.283 + s[i * 2], d = (to.r * 0.4 + 0.1 + s[i * 2 + 1] * 0.3) * k.ease(hit);
        stars.set(i, to.pos.x + Math.cos(ang) * d, feet + 0.2 + k.ease(hit) * 0.5, to.pos.z + Math.sin(ang) * d);
      }
      stars.fade(1 - hit);
    },
  };
};
/* ==== end of T36 parkour ==== */

/* ==== T34: squad ==== */
Object.assign(FX_COLORS, { squad: [0xff9f5a, 0x5ab0e0, 0x8ad46a] });

// A conga line of six little buddies hops along the arc in single file.
TRAVEL.squad = k => {
  const N = 6;
  const line = k.points({ n: N, tex: 'buddy', size: 0.42, glow: true, colors: [0xff9f5a, 0x5ab0e0, 0x8ad46a] });
  return {
    dur: 420,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.5);
        if (t < 0) { line.hide(i); continue; }
        k.at(t, A, 0.3);
        line.set(i, A.x, A.y + Math.abs(Math.sin(p * 16 + i * 0.9)) * 0.28, A.z);
      }
      line.fade(fadeOut(p, 0.85));
    },
  };
};

// Six buddies drop onto the target into a little 3-2-1 pyramid, then scatter and fade; four stars twinkle.
IMPACT.squad = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 6;
  const crew = k.points({ n: N, tex: 'buddy', size: 0.4 * m, glow: true, colors: [0xff9f5a, 0x5ab0e0, 0x8ad46a] });
  const stars = k.points({ n: 4, tex: 'star', size: 0.24 * m, glow: true, colors: [0xffffff, 0xfff6c0] });
  const slots = [[-0.3, 0], [0, 0], [0.3, 0], [-0.15, 0.3], [0.15, 0.3], [0, 0.6]];
  const s = k.seeds(N, 1);
  return {
    dur: 380,
    step(p) {
      const land = clamp01(p / 0.4), go = clamp01((p - 0.6) / 0.4);
      for (let i = 0; i < N; i++) {
        const [x, y] = slots[i];
        const drop = (1 - land) * (1 - land) * (1.4 + i * 0.25);
        const ang = (i / N) * 6.283 + s[i] * 0.8;
        const out = go * go * (0.8 + s[i] * 0.5) * m;
        planeAt(B, to.pos, k.side, x * m + Math.cos(ang) * out, 0.1 + y * m + drop + Math.abs(Math.sin(ang)) * out);
        crew.set(i, B.x, B.y, B.z);
      }
      crew.fade(1 - go);
      for (let i = 0; i < 4; i++) {
        const tw = wave21(clamp01(p * 1.5 - 0.35 - i * 0.1));
        if (tw <= 0.02) { stars.hide(i); continue; }
        const ang = (i / 4) * 6.283 + 0.5, d = (to.r * 0.5 + 0.25) * m;
        stars.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.2 + (i % 2) * 0.35, to.pos.z + Math.sin(ang) * d);
      }
      stars.fade(0.95);
    },
  };
};

// Tower Topple: a column of five buddies grows above the user, tips over like a tree towards the target and lands with a ring and puffs.
SIG.towertopple = (k, from, to) => {
  const N = 5;
  const column = k.points({ n: N, tex: 'buddy', size: 0.5, glow: true, colors: [0xff9f5a, 0x5ab0e0, 0x8ad46a, 0xff9f5a, 0x5ab0e0] });
  const puffs = k.points({ n: 8, tex: 'puff', size: 0.5, colors: [0xe8e4d8, 0xb8b4a8] });
  const ring = k.mesh('ring', { color: 0xffd23a, opacity: 0.7 });
  const s = k.seeds(8, 2);
  const feet = feetOf(to);
  const dx = to.pos.x - from.pos.x, dz = to.pos.z - from.pos.z, dist = Math.hypot(dx, dz) || 1;
  const ux = dx / dist, uz = dz / dist;
  const L = Math.min(6, Math.max(2.4, dist - to.r * 0.4)); // the column is long enough to reach the target
  const foot = feetOf(from) + 0.2;
  return {
    dur: 650,
    step(p) {
      const grow = clamp01(p / 0.3), tip = clamp01((p - 0.3) / 0.4), hit = clamp01((p - 0.7) / 0.3);
      const th = tip * tip * (Math.PI / 2); // slow start, then it falls
      for (let i = 0; i < N; i++) {
        if (grow < (i + 0.5) / N && tip === 0) { column.hide(i); continue; }
        const h = ((i + 1) / N) * L;
        column.set(i, from.pos.x + ux * Math.sin(th) * h, foot + Math.cos(th) * h, from.pos.z + uz * Math.sin(th) * h);
      }
      column.fade(fadeOut(p, 0.85));
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.position.set(to.pos.x, feet + 0.06, to.pos.z);
      ring.scale.setScalar(Math.max(0.01, (to.r * 0.5 + k.ease(hit) * 1.4) * (hit > 0 ? 1 : 0)));
      ring.material.opacity = hit > 0 ? 0.7 * (1 - hit) : 0;
      for (let i = 0; i < 8; i++) {
        if (hit <= 0) { puffs.hide(i); continue; }
        const ang = s[i * 2] * 6.283, d = (to.r * 0.4 + 0.2 + s[i * 2 + 1] * 0.7) * k.ease(hit);
        puffs.set(i, to.pos.x + Math.cos(ang) * d, feet + 0.2 + s[i * 2 + 1] * 0.6 * k.ease(hit), to.pos.z + Math.sin(ang) * d);
      }
      puffs.fade(1 - hit);
    },
  };
};

// Count Off!: four buddies pop up above the target one at a time, left to right, each with a star flash; then all jump together.
SIG.countoff = (k, from, to) => {
  const N = 4;
  const crew = k.points({ n: N, tex: 'buddy', size: 0.5, glow: true, colors: [0xff9f5a, 0x5ab0e0, 0x8ad46a, 0xff9f5a] });
  const flash = k.points({ n: N, tex: 'star', size: 0.3, glow: true, colors: [0xffffff, 0xfff6c0] });
  return {
    dur: 650,
    step(p) {
      const jump = clamp01((p - 0.7) / 0.3);
      for (let i = 0; i < N; i++) {
        const at = 0.08 + i * 0.15;
        if (p < at) { crew.hide(i); flash.hide(i); continue; }
        const up = clamp01((p - at) / 0.1);
        planeAt(B, to.pos, k.side, (i - 1.5) * 0.55, to.top - to.pos.y + 0.25 + Math.sin(up * Math.PI * 0.5) * 0.2 + Math.abs(Math.sin(jump * Math.PI * 2)) * 0.35);
        crew.set(i, B.x, B.y, B.z);
        const f = clamp01((p - at) / 0.14);
        if (f >= 1) flash.hide(i); else flash.set(i, B.x + 0.28, B.y + 0.28, B.z);
      }
      crew.fade(fadeOut(p, 0.9));
      flash.fade(0.95);
    },
  };
};
/* ==== end of T34 ==== */

/* ==== T35 dream ==== */
Object.assign(FX_COLORS, { dream: [0xb49cff, 0xffb3e6, 0x9ce8ff] });
const DREAM_COLS = [0xb49cff, 0xffb3e6, 0x9ce8ff];

/* -------------------------------- dream -------------------------------- */

// Six pastel bits and two balloons float over on a slow wobbly arc, each bobbing on its own.
TRAVEL.dream = k => {
  const N = 6;
  const bits = k.points({ n: N, tex: 'square', size: 0.26, glow: true, colors: DREAM_COLS });
  const balloons = k.points({ n: 2, tex: 'bubble', size: 0.4, colors: [0xffb3e6, 0x9ce8ff] });
  return {
    dur: 400,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = trailT(p, i, N, 0.45);
        if (t < 0) { bits.hide(i); continue; }
        k.at(t, A, 0.55);
        const w = Math.sin(t * 8 + i) * 0.16;
        bits.set(i, A.x + k.side.x * w, A.y + Math.sin(p * 7 + i) * 0.12, A.z + k.side.z * w);
      }
      bits.fade(fadeOut(p, 0.8));
      for (let i = 0; i < 2; i++) {
        const t = trailT(p, i * 3 + 1, N, 0.45);
        if (t < 0) { balloons.hide(i); continue; }
        k.at(t, A, 0.7);
        const w = Math.sin(t * 6 + i * 3) * 0.2;
        balloons.set(i, A.x + k.side.x * w, A.y + 0.1 + Math.sin(p * 7 + i * 2) * 0.14, A.z + k.side.z * w);
      }
      balloons.fade(fadeOut(p, 0.8));
    },
  };
};

// The bits burst out from the target and drift back in: held together by nothing.
IMPACT.dream = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 10;
  const bits = k.points({ n: N, tex: 'square', size: 0.28 * m, glow: true, colors: DREAM_COLS });
  const stars = k.points({ n: 4, tex: 'star', size: 0.26 * m, glow: true, colors: [0xffffff, 0xffe6fa] });
  const s = k.seeds(N, 3);
  return {
    dur: 360,
    step(p) {
      const out = p < 0.5 ? k.ease(p / 0.5) : 1 - k.ease((p - 0.5) / 0.5);
      for (let i = 0; i < N; i++) {
        const ang = s[i * 3] * 6.283, d = (to.r * 0.5 + 0.15 + s[i * 3 + 1] * 0.6) * out * m;
        bits.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.1 + s[i * 3 + 2] * 0.5 * out * m + Math.sin(p * 9 + i) * 0.05, to.pos.z + Math.sin(ang) * d);
      }
      bits.fade(fadeOut(p, 0.7));
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * 6.283 + 0.5, d = (to.r * 0.5 + 0.2) * m;
        const tw = wave21(clamp01(p * 1.4 - i * 0.12));
        if (tw <= 0.02) { stars.hide(i); continue; }
        stars.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.15 + (i % 2) * 0.35, to.pos.z + Math.sin(ang) * d);
      }
      stars.fade(0.95);
    },
  };
};

// Head Over Heels: an up and a down arrow swap places over the target while a ring of stars cartwheels round it.
SIG.headoverheels = (k, from, to) => {
  const up = k.sprite('up', { color: 0xb49cff, size: 0.1, glow: true });
  const down = k.sprite('down', { color: 0xffb3e6, size: 0.1, glow: true });
  const ring = k.points({ n: 8, tex: 'star', size: 0.3, glow: true, colors: DREAM_COLS });
  const axis = new THREE.Vector3(to.pos.x - from.pos.x, 0, to.pos.z - from.pos.z).normalize();
  const perp = new THREE.Vector3(-axis.z, 0, axis.x), Q = new THREE.Quaternion();
  return {
    dur: 600,
    step(p) {
      const sw = k.ease(clamp01(p / 0.7)), top = to.top + 0.5;
      const a = lerp(top, to.pos.y - 0.1, sw), b = lerp(to.pos.y - 0.1, top, sw);
      up.position.set(to.pos.x - k.side.x * 0.3, a, to.pos.z - k.side.z * 0.3);
      down.position.set(to.pos.x + k.side.x * 0.3, b, to.pos.z + k.side.z * 0.3);
      const sz = Math.max(0.01, 0.6 * wave21(clamp01(p * 1.05)));
      up.scale.setScalar(sz); down.scale.setScalar(sz);
      up.material.opacity = down.material.opacity = fadeOut(p, 0.8);
      Q.setFromAxisAngle(axis, p * 6.283 * 1.2);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * 6.283, R = to.r + 0.35;
        A.copy(perp).multiplyScalar(Math.cos(ang) * R);
        A.y = Math.sin(ang) * R;
        A.applyQuaternion(Q);
        ring.set(i, to.pos.x + A.x, to.pos.y + 0.1 + A.y, to.pos.z + A.z);
      }
      ring.fade(wave21(clamp01(p)));
    },
  };
};

// Crayon Storm: five crayon strokes zigzag across the target one after another, each leaving three scribbles.
SIG.crayonstorm = (k, from, to) => {
  const CRAYONS = [0xe03a3a, 0xffd23a, 0x3a7aff, 0x4cc84c, 0xa050e0];
  const strokes = CRAYONS.map(c => k.sprite('streak', { color: c, size: 0.1, glow: true }));
  const scribbles = CRAYONS.map(c => k.points({ n: 3, tex: 'dot', size: 0.2, glow: true, colors: [c] }));
  return {
    dur: 650,
    step(p) {
      for (let i = 0; i < 5; i++) {
        const q = clamp01((p - i * 0.12) / 0.3);
        const x = lerp(-0.55, 0.55, q) * (i % 2 ? -1 : 1), y = to.pos.y + 0.55 - i * 0.18 + Math.sin(q * 12) * 0.08;
        strokes[i].position.set(to.pos.x + k.side.x * x, y, to.pos.z + k.side.z * x);
        strokes[i].scale.setScalar(Math.max(0.01, 0.5 * (q > 0 && q < 1 ? 1 : 0)));
        strokes[i].material.opacity = q > 0 && q < 1 ? 1 : 0;
        strokes[i].material.rotation = (i % 2 ? 0.5 : -0.5) + Math.sin(q * 12) * 0.4;
        for (let j = 0; j < 3; j++) {
          const f = clamp01((q - 0.3 - j * 0.2) * 3);
          if (q < 0.3 || f <= 0) { scribbles[i].hide(j); continue; }
          const sx = lerp(-0.55, 0.55, 0.3 + j * 0.25) * (i % 2 ? -1 : 1);
          scribbles[i].set(j, to.pos.x + k.side.x * sx, to.pos.y + 0.55 - i * 0.18 + (j - 1) * 0.1, to.pos.z + k.side.z * sx);
        }
        scribbles[i].fade(fadeOut(p, 0.75));
      }
    },
  };
};
/* ==== end of T35 ==== */

/* ==== T40d ball ==== */
// White, sky blue and basketball orange.
FX_COLORS.ball = [0xffffff, 0x9fd6ff, 0xff7a2a];

// A ball that bounces along the path: two hops, squashing at each touch (wider and flatter for a moment), with a dark spot inside.
TRAVEL.ball = k => {
  const ball = k.sprite('dot', { color: 0xffffff, size: 0.4 });
  const spot = k.sprite('dot', { color: 0x2a2a34, size: 0.18 });
  return {
    dur: 420,
    step(p) {
      const hop = Math.abs(Math.sin(p * Math.PI * 2)), sq = 1 - clamp01(hop / 0.25); // 1 at a touch, 0 in the air
      k.at(p, A, 0.1);
      ball.position.set(A.x, A.y + hop * 0.5, A.z);
      ball.scale.set(0.4 * (1 + 0.3 * sq), 0.4 * (1 - 0.3 * sq), 1);
      spot.position.set(A.x + k.dir.x * 0.01, A.y + hop * 0.5, A.z + k.dir.z * 0.01);
      spot.scale.set(0.18 * (1 + 0.3 * sq), 0.18 * (1 - 0.3 * sq), 1);
      ball.material.opacity = spot.material.opacity = p > 0.97 ? 0 : 1;
    },
  };
};

// A ball hit: a white squash flash, a sky-blue ring on the ground under the target and six little balls that bounce out once.
IMPACT.ball = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 6;
  const flash = k.sprite('dot', { color: 0xffffff, size: 0.1, glow: true });
  const ring = k.mesh('ring', { color: 0x9fd6ff, opacity: 0.8 });
  const dots = k.points({ n: N, tex: 'dot', size: 0.3 * m, colors: [0xffffff, 0x9fd6ff, 0xff7a2a] });
  const feet = feetOf(to);
  return {
    dur: 380,
    step(p) {
      const sq = Math.sin(Math.PI * clamp01(p * 1.8)); // squashes flat, then pops
      flash.position.copy(to.pos);
      flash.scale.set(Math.max(0.01, (0.4 + sq * 0.8) * m * 1.3), Math.max(0.01, (0.4 + sq * 0.8) * m * 0.7), 1);
      flash.material.opacity = fadeOut(p, 0.4);
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.position.set(to.pos.x, feet + 0.06, to.pos.z);
      ring.scale.setScalar(Math.max(0.01, (to.r * 0.5 + 0.2 + k.ease(p) * 0.9) * m));
      ring.material.opacity = 0.8 * (1 - p);
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283, d = (0.2 + k.ease(p) * 0.9) * to.r * 1.6 * m;
        dots.set(i, to.pos.x + Math.cos(ang) * d, feet + 0.25 + Math.abs(Math.sin(p * Math.PI)) * 0.9 * m, to.pos.z + Math.sin(ang) * d);
      }
      dots.fade(fadeOut(p, 0.7));
    },
  };
};

// Golden Goal: a white goal frame stands up behind the target, the ball flies in, the net ripples (a grid of dots bulging back) and a
// golden star bursts out.
SIG.goldengoal = (k, from, to) => {
  const feet = feetOf(to), h = Math.max(1.2, to.top - feet + 0.5), w = Math.max(1.4, to.r * 3);
  const bx = to.pos.x + k.dir.x * (to.r + 0.8), bz = to.pos.z + k.dir.z * (to.r + 0.8);
  const posts = [-1, 1].map(() => k.sprite('square', { color: 0xffffff, size: 0.1 }));
  const bar = k.sprite('square', { color: 0xffffff, size: 0.1 });
  const ball = k.sprite('dot', { color: 0xffffff, size: 0.38 });
  const COLS = 4, ROWS = 3, N = COLS * ROWS;
  const net = k.points({ n: N, tex: 'dot', size: 0.16, colors: [0xffffff, 0xcfe8ff] });
  const star = k.sprite('star', { color: 0xffd23a, size: 0.1, glow: true });
  const bits = k.points({ n: 8, tex: 'star', size: 0.3, glow: true, colors: [0xffd23a, 0xfff08a] });
  return {
    dur: 750,
    step(p) {
      const up = clamp01(p / 0.25), fly = clamp01((p - 0.2) / 0.4), rip = clamp01((p - 0.55) / 0.3), out = clamp01((p - 0.55) / 0.45);
      posts.forEach((s, i) => {
        s.position.set(bx + k.side.x * (i ? w / 2 : -w / 2), feet + (h * up) / 2, bz + k.side.z * (i ? w / 2 : -w / 2));
        s.scale.set(0.12, Math.max(0.01, h * up), 1);
        s.material.opacity = fadeOut(p, 0.75);
      });
      bar.position.set(bx, feet + h * up, bz);
      bar.scale.set(Math.max(0.01, w * up), 0.12, 1);
      bar.material.opacity = fadeOut(p, 0.75);
      // the ball: from the attacker, into the goal's middle
      ball.position.set(lerp(from.pos.x, bx, fly), lerp(from.pos.y, feet + h * 0.45, fly) + Math.sin(Math.PI * fly) * 0.5, lerp(from.pos.z, bz, fly));
      ball.material.opacity = fly > 0 && p < 0.8 ? 1 : 0;
      // the net: dots in a grid that bulge back (away from the attacker) when the ball hits
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (up < 1) { net.hide(i); continue; }
        const u = (c / (COLS - 1) - 0.5) * w * 0.8, v = (r / (ROWS - 1)) * h * 0.85 + 0.1;
        const bulge = Math.sin(Math.PI * rip) * (1 - Math.hypot(c / (COLS - 1) - 0.5, r / (ROWS - 1) - 0.5)) * 0.7;
        net.set(i, bx + k.side.x * u + k.dir.x * bulge, feet + v, bz + k.side.z * u + k.dir.z * bulge);
      }
      net.fade(fadeOut(p, 0.8));
      star.position.set(bx - k.dir.x * 0.1, feet + h * 0.45, bz - k.dir.z * 0.1);
      star.scale.setScalar(Math.max(0.01, Math.sin(Math.PI * rip) * 1.2));
      star.material.rotation = p * 4;
      for (let i = 0; i < 8; i++) {
        if (out <= 0) { bits.hide(i); continue; }
        const a = (i / 8) * 6.283, d = out * (0.5 + (i % 2) * 0.3);
        bits.set(i, bx + Math.cos(a) * d * 0.8, feet + h * 0.45 + Math.sin(a) * d, bz + Math.sin(a) * d * 0.8);
      }
      bits.fade(1 - out);
    },
  };
};

// Ace Smash: a fast streaked ball drops from high above the user onto the target, then a flash like a bang.
SIG.acesmash = (k, from, to) => {
  const N = 6;
  const streak = k.points({ n: N, tex: 'streak', size: 0.4, glow: true, colors: [0xff9a2a, 0xffd23a, 0xffffff] });
  const ball = k.sprite('dot', { color: 0xffe14a, size: 0.42 });
  const bang = k.sprite('bang', { color: 0xffffff, size: 0.1, glow: true });
  const ring = k.mesh('ring', { color: 0xff9a2a, opacity: 0.8 });
  const feet = feetOf(to);
  return {
    dur: 450,
    step(p) {
      const fall = clamp01(p / 0.6), hit = clamp01((p - 0.6) / 0.4);
      const x = lerp(from.pos.x, to.pos.x, fall * fall), z = lerp(from.pos.z, to.pos.z, fall * fall);
      const y = lerp(from.top + 2.2, to.pos.y, fall * fall);
      ball.position.set(x, y, z);
      ball.material.opacity = hit > 0 ? 0 : 1;
      for (let i = 0; i < N; i++) {
        const f2 = clamp01(fall - i * 0.04);
        if (fall <= 0 || hit > 0 || f2 <= 0) { streak.hide(i); continue; }
        streak.set(i, lerp(from.pos.x, to.pos.x, f2 * f2), lerp(from.top + 2.2, to.pos.y, f2 * f2), lerp(from.pos.z, to.pos.z, f2 * f2));
      }
      streak.fade(0.9);
      bang.position.set(to.pos.x, to.pos.y + 0.2, to.pos.z);
      bang.scale.setScalar(Math.max(0.01, Math.sin(Math.PI * hit) * 1.4));
      bang.material.opacity = hit > 0 ? 1 : 0;
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.position.set(to.pos.x, feet + 0.06, to.pos.z);
      ring.scale.setScalar(Math.max(0.01, to.r * 0.5 + hit * 1.3));
      ring.material.opacity = hit > 0 ? 0.8 * (1 - hit) : 0;
    },
  };
};
/* ==== end of T40d ball ==== */
/* ==== T37 ninja ==== */
// Mask dark, band red, leaf green.
FX_COLORS.ninja = [0x2a2440, 0xd83a4a, 0x6fd35a];

// Leaf stars: three spinning leaves fly in a little fan along a flat arc, each with a short dark streak behind it.
TRAVEL.ninja = k => {
  const leaves = [0, 1, 2].map(i => k.sprite('leaf', { color: [0x6fd35a, 0x9ae070, 0x4ab84a][i], size: 0.34 }));
  const streaks = k.points({ n: 6, tex: 'streak', size: 0.3, colors: [0x2a2440, 0x5a5070] });
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < 3; i++) {
        const t = clamp01(p * 1.25 - i * 0.12), fan = (i - 1) * 0.28 * Math.sin(Math.PI * t);
        const s = leaves[i];
        if (t <= 0 || t >= 1) { s.material.opacity = 0; streaks.hide(i * 2); streaks.hide(i * 2 + 1); continue; }
        k.at(t, A, 0.12);
        s.position.set(A.x + k.side.x * fan, A.y + (i - 1) * 0.08, A.z + k.side.z * fan);
        s.material.opacity = 1;
        s.material.rotation = p * 30 + i * 2;
        for (let j = 0; j < 2; j++) {
          k.at(Math.max(0, t - 0.07 * (j + 1)), B, 0.12);
          streaks.set(i * 2 + j, B.x + k.side.x * fan, B.y + (i - 1) * 0.08, B.z + k.side.z * fan);
        }
      }
      streaks.fade(fadeOut(p, 0.7) * 0.8);
    },
  };
};

// A ninja hit: a red flash star and a ring of dark smoke puffs, two leaves twirling off.
IMPACT.ninja = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 8;
  const smoke = k.points({ n: N, tex: 'puff', size: 0.55 * m, colors: [0x4a4460, 0x6a6480, 0x2a2440] });
  const leaves = k.points({ n: 2, tex: 'leaf', size: 0.32 * m, colors: [0x6fd35a, 0x9ae070] });
  const flash = k.sprite('star', { color: 0xd83a4a, size: 0.1, glow: true });
  return {
    dur: 360,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283, d = (to.r * 0.4 + 0.1 + k.ease(p) * 0.7) * m;
        smoke.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y - 0.1 + p * 0.4 + (i % 2) * 0.15, to.pos.z + Math.sin(ang) * d);
      }
      smoke.fade((1 - p) * 0.9);
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        leaves.set(i, to.pos.x + k.side.x * s * (0.2 + p * 0.8) * m, to.pos.y + 0.3 + Math.sin(p * Math.PI) * 0.5, to.pos.z + k.side.z * s * (0.2 + p * 0.8) * m);
      }
      leaves.fade(fadeOut(p, 0.6));
      flash.position.copy(to.pos);
      flash.scale.setScalar(Math.max(0.01, 0.9 * m * Math.sin(Math.PI * clamp01(p * 1.6))));
      flash.material.rotation = p * 3;
      flash.material.opacity = fadeOut(p, 0.5);
    },
  };
};

// Leaf Whirlwind: fourteen leaves spiral up round the target in a whirlwind, then burst out; a green ring on the ground.
SIG.leafwhirl = (k, from, to) => {
  const N = 14;
  const leaves = k.points({ n: N, tex: 'leaf', size: 0.34, colors: [0x6fd35a, 0x9ae070, 0x4ab84a, 0xd8f0b0] });
  const ring = k.mesh('ring', { color: 0x6fd35a, opacity: 0.7 });
  const feet = feetOf(to), h = to.top - feet + 0.4;
  return {
    dur: 700,
    step(p) {
      const spin = clamp01(p / 0.75), out = clamp01((p - 0.75) / 0.25);
      for (let i = 0; i < N; i++) {
        const u = clamp01(spin * 1.3 - (i / N) * 0.3);
        if (u <= 0) { leaves.hide(i); continue; }
        const ang = u * 12 + (i / N) * 6.283, r = (to.r * 0.6 + 0.35) * (1 - u * 0.3) + out * 1.4;
        leaves.set(i, to.pos.x + Math.cos(ang) * r, feet + 0.1 + u * h + out * 0.3, to.pos.z + Math.sin(ang) * r);
      }
      leaves.fade(1 - out);
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.position.set(to.pos.x, feet + 0.06, to.pos.z);
      ring.scale.setScalar(Math.max(0.01, to.r * 0.6 + 0.4 + out * 1.2));
      ring.material.opacity = 0.7 * (1 - out) * clamp01(p * 4);
    },
  };
};
/* ==== end of T37 ninja ==== */
/* ==== T40c racer ==== */
// Racer: orange paint, white stripes, dark tyre smoke.
FX_COLORS.racer = [0xff8a2a, 0xffffff, 0x2a2a34];

// A bright orange streak zips straight at the target with three white speed lines beside it and a tiny chequered flag at the head.
TRAVEL.racer = k => {
  const streak = k.mesh('box', { color: 0xff8a2a, glow: true });
  const lines = k.points({ n: 9, tex: 'streak', size: 0.34, colors: [0xffffff, 0xfff0d0] });
  const flag = k.sprite('chequer', { color: 0xffffff, size: 0.36 });
  const yaw = Math.atan2(k.dir.x, k.dir.z);
  return {
    dur: 340,
    step(p) {
      const t = clamp01(p * 1.15);
      k.at(t, A, 0.05);
      const len = 0.9 + 0.5 * Math.sin(Math.PI * t);
      streak.position.set(A.x - k.dir.x * len / 2, A.y, A.z - k.dir.z * len / 2);
      streak.scale.set(0.14, 0.14, len);
      streak.rotation.y = yaw;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const u = clamp01(t - 0.08 * (j + 1)), off = (i - 1) * 0.3;
        if (t <= 0.02) { lines.hide(i * 3 + j); continue; }
        k.at(u, B, 0.05);
        lines.set(i * 3 + j, B.x + k.side.x * off, B.y + (i - 1) * 0.04, B.z + k.side.z * off);
      }
      lines.fade(fadeOut(p, 0.7));
      flag.position.set(A.x, A.y + 0.28, A.z);
      flag.material.rotation = Math.sin(p * 30) * 0.2;
      flag.material.opacity = fadeOut(p, 0.85);
    },
  };
};

// A racer hit: a white flash, a ring of grey tyre smoke and two skid marks on the ground that fade (big: two rings).
IMPACT.racer = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = big ? 12 : 8;
  const smoke = k.points({ n: N, tex: 'puff', size: 0.5 * m, colors: [0x8a8a92, 0xb0b0b8, 0x4a4a52] });
  const flash = k.sprite('dot', { color: 0xffffff, size: 0.1, glow: true });
  const skids = [0, 1].map(() => k.mesh('box', { color: 0x2a2a34, opacity: 0.6 }));
  const feet = feetOf(to), yaw = Math.atan2(k.dir.x, k.dir.z);
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ring = big && i >= N / 2 ? 1 : 0, ang = (i / (N / (ring ? 2 : 1))) * 6.283 + ring * 0.4;
        const d = (to.r * 0.4 + 0.1 + k.ease(p) * (0.6 + ring * 0.5)) * m;
        smoke.set(i, to.pos.x + Math.cos(ang) * d, feet + 0.15 + p * 0.35 + ring * 0.1, to.pos.z + Math.sin(ang) * d);
      }
      smoke.fade((1 - p) * 0.85);
      flash.position.copy(to.pos);
      flash.scale.setScalar(Math.max(0.01, 1.1 * m * Math.sin(Math.PI * clamp01(p * 2.2))));
      flash.material.opacity = fadeOut(p, 0.4);
      skids.forEach((s, i) => {
        const o = (i ? 1 : -1) * 0.18;
        s.position.set(to.pos.x + k.side.x * o, feet + 0.03, to.pos.z + k.side.z * o);
        s.rotation.y = yaw;
        s.scale.set(0.1, 0.02, (0.4 + 0.9 * k.ease(clamp01(p * 2))) * m);
        s.material.opacity = 0.6 * fadeOut(p, 0.5);
      });
    },
  };
};

// Photo Finish: a camera flash on the target (a big white burst), then a chequered banner waves over it.
SIG.photofinish = (k, from, to) => {
  const flash = k.sprite('dot', { color: 0xffffff, size: 0.1, glow: true });
  const banner = k.sprite('chequer', { color: 0xffffff, size: 0.1 });
  const bits = k.points({ n: 8, tex: 'chequer', size: 0.26, colors: [0xffffff, 0xff8a2a] });
  const top = to.top;
  return {
    dur: 700,
    step(p) {
      const f = clamp01(p / 0.22);
      flash.position.set(to.pos.x, to.pos.y, to.pos.z);
      flash.scale.setScalar(Math.max(0.01, (f < 1 ? f : 1) * 3.2 * to.r + 0.4));
      flash.material.opacity = p < 0.22 ? 1 : fadeOut(p, 0.3) * clamp01((0.4 - p) * 6);
      const b = clamp01((p - 0.18) / 0.82), sz = Math.min(1, b * 4) * (1.0 + to.r * 0.6);
      banner.visible = b > 0;
      banner.position.set(to.pos.x, top + 0.45 + Math.sin(p * 18) * 0.06, to.pos.z);
      banner.scale.setScalar(Math.max(0.01, sz));
      banner.material.rotation = Math.sin(p * 14) * 0.3;
      banner.material.opacity = fadeOut(p, 0.8);
      for (let i = 0; i < 8; i++) {
        if (b <= 0) { bits.hide(i); continue; }
        const ang = (i / 8) * 6.283 + p * 4;
        bits.set(i, to.pos.x + Math.cos(ang) * (0.4 + b * 0.8), top + 0.2 + b * 0.5 + (i % 3) * 0.1, to.pos.z + Math.sin(ang) * (0.4 + b * 0.8));
      }
      bits.fade(fadeOut(p, 0.7));
    },
  };
};

// Nitro Blast: four blue-white rocket flames shoot at the target one after the other, each with a small flash where it lands.
SIG.nitroblast = (k, from, to) => {
  const N = 4;
  const jets = [], cores = [];
  for (let i = 0; i < N; i++) { jets.push(k.mesh('cone', { color: 0x4ab8ff, glow: true, opacity: 0.9 })); cores.push(k.mesh('cone', { color: 0xffffff, glow: true })); }
  const sparks = k.sprite('star', { color: 0x9ad8ff, size: 0.1, glow: true });
  const yaw = Math.atan2(k.dir.x, k.dir.z);
  return {
    dur: 800,
    step(p) {
      let hit = 0;
      for (let i = 0; i < N; i++) {
        const u = clamp01((p - i * 0.17) / 0.34), j = jets[i], c = cores[i];
        const off = (i % 2 ? 1 : -1) * (0.12 + i * 0.05), lift = 0.1 + i * 0.1;
        if (u <= 0 || u >= 1) { j.visible = c.visible = false; continue; }
        j.visible = c.visible = true;
        k.at(u, A, lift);
        for (const [m, w, l] of [[j, 0.2, 1.3], [c, 0.1, 1.0]]) {
          m.position.set(A.x + k.side.x * off - k.dir.x * l / 2, A.y, A.z + k.side.z * off - k.dir.z * l / 2);
          m.rotation.y = yaw + Math.PI;
          m.scale.set(w, w, l);
        }
        if (u > 0.85) hit = Math.max(hit, (u - 0.85) / 0.15);
      }
      sparks.visible = hit > 0 || p > 0.6;
      sparks.position.copy(to.pos);
      sparks.scale.setScalar(Math.max(0.01, (0.5 + 0.5 * Math.sin(p * 40)) * 0.9 * (1 + to.r * 0.5) * fadeOut(p, 0.8)));
      sparks.material.rotation = p * 8;
    },
  };
};
/* ==== end of T40c racer ==== */
/* ==== T40a tiny ==== */
// Crumb tan, cookie brown, sugar white.
FX_COLORS.tiny = [0xe6c08a, 0x7a4a2a, 0xffffff];

// A marching line of six tiny dots ("ants") along a low arc, each a little later, each bobbing on its way.
TRAVEL.tiny = k => {
  const N = 6;
  const ants = k.points({ n: N, tex: 'dot', size: 0.2, colors: [0x3a1a12, 0x7a4a2a] });
  return {
    dur: 420,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = clamp01(p * 1.4 - i * 0.08);
        if (t <= 0 || t >= 1) { ants.hide(i); continue; }
        k.at(t, A, 0.05);
        ants.set(i, A.x, A.y - 0.1 + 0.04 * Math.abs(Math.sin(t * 40 + i)), A.z);
      }
      ants.fade(fadeOut(p, 0.85));
    },
  };
};

// A tiny hit: eight crumbs jump out low and land once, a small star flash.
IMPACT.tiny = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 8;
  const crumbs = k.points({ n: N, tex: 'square', size: 0.2 * m, colors: [0xe6c08a, 0xc08a50, 0x7a4a2a] });
  const s = k.seeds(N, 2);
  const flash = k.sprite('star', { color: 0xffffff, size: 0.1, glow: true });
  return {
    dur: 340,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + s[i * 2], d = (to.r * 0.4 + 0.15 + s[i * 2 + 1] * 0.4) * k.ease(p) * m, h = 0.7 * m * (0.6 + s[i * 2 + 1] * 0.4);
        crumbs.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.5 * 4 * h * p * (1 - p) - 0.2, to.pos.z + Math.sin(ang) * d);
      }
      crumbs.fade(fadeOut(p, 0.7));
      flash.position.copy(to.pos);
      flash.scale.setScalar(Math.max(0.01, 0.7 * m * Math.sin(Math.PI * clamp01(p * 1.8))));
      flash.material.rotation = p * 2;
      flash.material.opacity = fadeOut(p, 0.5);
    },
  };
};

// Sugar Lift: a big white sugar cube rises over the attacker, flies over on a high arc, drops on the target; sparkles pop out.
SIG.sugarlift = (k, from, to) => {
  const cube = k.sprite('square', { color: 0xffffff, size: 0.1, glow: true });
  const sparks = k.points({ n: 6, tex: 'dot', size: 0.22, glow: true, colors: [0xffffff, 0xfff8c0] });
  const fFeet = feetOf(from);
  return {
    dur: 620,
    step(p) {
      const rise = clamp01(p / 0.35), fly = clamp01((p - 0.35) / 0.45), pop = clamp01((p - 0.8) / 0.2);
      if (p < 0.35) cube.position.set(from.pos.x, fFeet + 0.3 + rise * (from.top - fFeet + 0.5), from.pos.z);
      else if (p < 0.8) {
        k.at(fly, A, 0.2);
        cube.position.set(A.x, A.y + Math.sin(Math.PI * fly) * 1.2 + (1 - fly) * 0.6, A.z);
      } else cube.position.copy(to.pos);
      cube.scale.setScalar(Math.max(0.01, p < 0.8 ? 0.5 + rise * 0.3 : 0.8 * (1 - pop)));
      cube.material.rotation = p * 3;
      cube.material.opacity = p < 0.8 ? 1 : 1 - pop;
      for (let i = 0; i < 6; i++) {
        if (pop <= 0) { sparks.hide(i); continue; }
        const ang = (i / 6) * 6.283, d = (0.2 + pop * 0.8) * (to.r * 0.6 + 0.4);
        sparks.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.15 + pop * 0.5, to.pos.z + Math.sin(ang) * d);
      }
      sparks.fade(1 - pop);
    },
  };
};

// Fluff Storm: ten grey puffs spiral up round the target, then fade.
SIG.fluffstorm = (k, from, to) => {
  const N = 10;
  const puffs = k.points({ n: N, tex: 'puff', size: 0.4, colors: [0xb8b4c0, 0xdcd8e2, 0xf2a6c0] });
  const feet = feetOf(to);
  return {
    dur: 650,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + p * 9, r = (to.r * 0.5 + 0.3) * (1 + 0.2 * Math.sin(p * 6 + i));
        puffs.set(i, to.pos.x + Math.cos(ang) * r, feet + 0.15 + p * 0.9 + (i % 3) * 0.12, to.pos.z + Math.sin(ang) * r);
      }
      puffs.fade(fadeOut(p, 0.7));
    },
  };
};
/* ==== end of T40a tiny ==== */
/* ==== T40b pirate ==== */
// Iron grey, stripe red, gold.
FX_COLORS.pirate = [0x2a2a30, 0xe07a6a, 0xf6d55a];

// A cannonball: a dark ball on a flat arc with three grey smoke puffs trailing it and a little flash at the muzzle.
TRAVEL.pirate = k => {
  const ball = k.sprite('dot', { color: 0x23232b, size: 0.32 });
  const trail = k.points({ n: 3, tex: 'puff', size: 0.38, colors: [0xc8c8cc, 0x9a9aa4, 0xb4b4bc] });
  const flash = k.sprite('star', { color: 0xffd23c, size: 0.1, glow: true });
  return {
    dur: 360,
    step(p) {
      k.at(p, A, 0.25);
      ball.position.copy(A);
      for (let i = 0; i < 3; i++) {
        const t = p - 0.09 * (i + 1);
        if (t <= 0) { trail.hide(i); continue; }
        k.at(t, B, 0.25);
        trail.set(i, B.x, B.y + 0.04 * i, B.z);
      }
      trail.fade(fadeOut(p, 0.7) * 0.85);
      k.at(0, C, 0);
      flash.position.copy(C);
      flash.scale.setScalar(Math.max(0.01, 0.7 * Math.sin(Math.PI * clamp01(p * 5))));
      flash.material.opacity = p < 0.2 ? 1 : 0;
    },
  };
};

// A cannonball hit: a flash, a ring of smoke puffs and three gold coins hopping out.
IMPACT.pirate = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 6;
  const smoke = k.points({ n: N, tex: 'puff', size: 0.55 * m, colors: [0x6a6a74, 0x8a8a94, 0x4a4a54] });
  const coins = k.points({ n: 3, tex: 'coin', size: 0.3 * m, colors: [0xffd23c, 0xffe680] });
  const flash = k.sprite('star', { color: 0xffd23c, size: 0.1, glow: true });
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283, d = (to.r * 0.4 + 0.1 + k.ease(p) * 0.7) * m;
        smoke.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y - 0.05 + p * 0.35 + (i % 2) * 0.12, to.pos.z + Math.sin(ang) * d);
      }
      smoke.fade((1 - p) * 0.9);
      for (let i = 0; i < 3; i++) {
        const s = (i - 1) * 0.5, hop = Math.abs(Math.sin(p * Math.PI * 1.5 + i)) * (0.6 - p * 0.3);
        coins.set(i, to.pos.x + k.side.x * s * (0.3 + p) * m, to.pos.y + 0.2 + hop * m, to.pos.z + k.side.z * s * (0.3 + p) * m);
      }
      coins.fade(fadeOut(p, 0.6));
      flash.position.copy(to.pos);
      flash.scale.setScalar(Math.max(0.01, 1.0 * m * Math.sin(Math.PI * clamp01(p * 1.7))));
      flash.material.rotation = p * 2;
      flash.material.opacity = fadeOut(p, 0.5);
    },
  };
};

// Broadside: three cannonballs one after the other from three spots beside the user, three flashes on the target.
SIG.broadside = (k, from, to) => {
  const balls = [0, 1, 2].map(() => k.sprite('dot', { color: 0x23232b, size: 0.34 }));
  const flashes = [0, 1, 2].map(i => k.sprite('star', { color: i === 1 ? 0xffd23c : 0xffb830, size: 0.1, glow: true }));
  const puffs = k.points({ n: 6, tex: 'puff', size: 0.42, colors: [0xb4b4bc, 0x8a8a94] });
  return {
    dur: 700,
    step(p) {
      for (let i = 0; i < 3; i++) {
        const t = clamp01((p - i * 0.12) / 0.4), off = (i - 1) * 0.7;
        const b = balls[i];
        if (t <= 0 || t >= 1) { b.material.opacity = 0; puffs.hide(i * 2); puffs.hide(i * 2 + 1); } else {
          k.at(t, A, 0.3);
          b.position.set(A.x + k.side.x * off * (1 - t), A.y, A.z + k.side.z * off * (1 - t));
          b.material.opacity = 1;
          for (let j = 0; j < 2; j++) {
            k.at(Math.max(0, t - 0.1 * (j + 1)), B, 0.3);
            puffs.set(i * 2 + j, B.x + k.side.x * off * (1 - t), B.y, B.z + k.side.z * off * (1 - t));
          }
        }
        const u = clamp01((p - i * 0.12 - 0.4) / 0.25), f = flashes[i];
        f.position.set(to.pos.x + k.side.x * off * 0.5, to.pos.y + 0.1 * i, to.pos.z + k.side.z * off * 0.5);
        f.scale.setScalar(Math.max(0.01, 1.0 * Math.sin(Math.PI * u)));
        f.material.opacity = u > 0 && u < 1 ? 1 : 0;
        f.material.rotation = u * 2 + i;
      }
      puffs.fade(fadeOut(p, 0.6) * 0.8);
    },
  };
};

// Anchor Drop: a big anchor falls from above onto the target, a ring spreads on the ground and six drops splash up.
SIG.anchordrop = (k, from, to) => {
  const anchor = k.sprite('anchor', { color: 0x4a4e5a, size: 1.3 });
  const ring = k.mesh('ring', { color: 0xbfe0ff, opacity: 0.7 });
  const N = 6;
  const drops = k.points({ n: N, tex: 'drop', size: 0.3, colors: [0x7ab8ff, 0xbfe0ff] });
  const feet = feetOf(to);
  return {
    dur: 650,
    step(p) {
      const fall = clamp01(p / 0.4), hit = clamp01((p - 0.4) / 0.6);
      const y = lerp(to.top + 3.2, feet + 0.7, fall * fall);
      anchor.position.set(to.pos.x, y, to.pos.z);
      anchor.material.opacity = p < 0.4 ? 1 : fadeOut((p - 0.4) / 0.6, 0.5);
      anchor.material.rotation = (1 - fall) * 0.5;
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.position.set(to.pos.x, feet + 0.06, to.pos.z);
      ring.scale.setScalar(Math.max(0.01, hit * (to.r + 1.1)));
      ring.material.opacity = hit > 0 ? 0.7 * (1 - hit) : 0;
      for (let i = 0; i < N; i++) {
        if (hit <= 0) { drops.hide(i); continue; }
        const ang = (i / N) * 6.283, d = 0.3 + hit * (to.r * 0.7 + 0.5);
        drops.set(i, to.pos.x + Math.cos(ang) * d, feet + 0.15 + Math.sin(hit * Math.PI) * (0.5 + 0.1 * (i % 3)), to.pos.z + Math.sin(ang) * d);
      }
      drops.fade(fadeOut(hit, 0.5));
    },
  };
};
/* ==== end of T40b pirate ==== */
/* ==== T44 surprise ==== */
// Gift orange, party pink, cream.
FX_COLORS.surprise = [0xffb04a, 0xff6a8a, 0xfff0d0];

// A little wrapped box tumbles along a high arc (a square with a bow knot), with a streamer trail behind it.
TRAVEL.surprise = k => {
  const box = k.sprite('square', { color: 0xff6a8a, size: 0.42, glow: true });
  const knot = k.sprite('dot', { color: 0xffd23a, size: 0.2, glow: true });
  const N = 4;
  const trail = k.points({ n: N, tex: 'square', size: 0.14, glow: true, colors: [0xffd23a, 0x3ac8e8, 0x6ae86a, 0xb05ae8] });
  return {
    dur: 400,
    step(p) {
      k.at(p, A, 0.7);
      box.position.copy(A);
      box.material.rotation = p * 9;
      knot.position.set(A.x, A.y + 0.03, A.z);
      for (let i = 0; i < N; i++) {
        const t = p - 0.07 * (i + 1);
        if (t <= 0) { trail.hide(i); continue; }
        k.at(t, B, 0.7);
        trail.set(i, B.x + Math.sin(t * 30 + i) * 0.08, B.y + 0.02 * i, B.z);
      }
      trail.fade(fadeOut(p, 0.75));
    },
  };
};

// The box bursts: a confetti puff and four streamers that curl out and fall.
IMPACT.surprise = (k, from, to, { big }) => {
  const m = big ? 1.4 : 1, N = 10;
  const conf = k.points({ n: N, tex: 'square', size: 0.16 * m, glow: true, colors: [0xff6a8a, 0xffd23a, 0x3ac8e8, 0x6ae86a, 0xb05ae8] });
  const streamers = k.points({ n: 4, tex: 'square', size: 0.2 * m, glow: true, colors: [0xff6a8a, 0x3ac8e8, 0xffd23a, 0x6ae86a] });
  const s = k.seeds(N, 2);
  const flash = k.sprite('star', { color: 0xfff0d0, size: 0.1, glow: true });
  return {
    dur: 380,
    step(p) {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283 + s[i * 2], d = (to.r * 0.4 + 0.1 + s[i * 2 + 1] * 0.6) * k.ease(p) * m;
        conf.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.2 + 0.9 * m * 4 * p * (1 - p) * (0.5 + s[i * 2 + 1] * 0.5) - p * 0.2, to.pos.z + Math.sin(ang) * d);
      }
      conf.fade(fadeOut(p, 0.7));
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * 6.283 + 0.6, d = (0.3 + 0.7 * k.ease(p)) * m;
        streamers.set(i, to.pos.x + Math.cos(ang) * d, to.pos.y + 0.55 * m * Math.sin(p * Math.PI) - p * 0.1 + Math.sin(p * 18 + i) * 0.05, to.pos.z + Math.sin(ang) * d);
      }
      streamers.fade(fadeOut(p, 0.6));
      flash.position.copy(to.pos);
      flash.scale.setScalar(Math.max(0.01, 0.8 * m * Math.sin(Math.PI * clamp01(p * 1.8))));
      flash.material.rotation = p * 2;
      flash.material.opacity = fadeOut(p, 0.5);
    },
  };
};

// Ta-Daa!: a curtain of stars sweeps open beside the target with a big star in the middle that bursts out.
SIG.tadaa = (k, from, to) => {
  const N = 8;
  const stars = k.points({ n: N, tex: 'star', size: 0.34, glow: true, colors: [0xffd23a, 0xff6a8a, 0xfff0d0] });
  const big = k.sprite('star', { color: 0xffe14a, size: 0.1, glow: true });
  const feet = feetOf(to);
  return {
    dur: 640,
    step(p) {
      const open = clamp01(p / 0.5), pop = clamp01((p - 0.5) / 0.5);
      for (let i = 0; i < N; i++) {
        const side = i < N / 2 ? -1 : 1, row = i % (N / 2), spread = (1 - open) * 0.35 + 0.35 + pop * 0.7;
        stars.set(i, to.pos.x + k.side.x * side * spread, feet + 0.3 + row * 0.28 + pop * 0.3, to.pos.z + k.side.z * side * spread);
      }
      stars.fade(fadeOut(p, 0.8));
      big.position.set(to.pos.x, to.pos.y + 0.2, to.pos.z);
      big.scale.setScalar(Math.max(0.01, (p < 0.5 ? open : 1 + pop * 1.2) * 1.1 * (p > 0.85 ? (1 - p) / 0.15 : 1)));
      big.material.rotation = p * 4;
    },
  };
};

// Candy Burst: a piñata spray of sweets flies from the user at the target in a fan and bounces down.
SIG.candyburst = (k, from, to) => {
  const N = 12;
  const sweets = k.points({ n: N, tex: 'dot', size: 0.26, glow: true, colors: [0xff6a8a, 0xffd23a, 0x3ac8e8, 0x6ae86a, 0xb05ae8] });
  const s = k.seeds(N, 2);
  return {
    dur: 650,
    step(p) {
      for (let i = 0; i < N; i++) {
        const t = clamp01((p - i * 0.025) / 0.6);
        if (t <= 0) { sweets.hide(i); continue; }
        k.at(t, A, 0.5 + s[i * 2] * 0.6);
        const fan = (s[i * 2 + 1] - 0.5) * 0.8 * Math.sin(Math.PI * t);
        sweets.set(i, A.x + k.side.x * fan, A.y + (t > 0.9 ? Math.abs(Math.sin(p * 30 + i)) * 0.15 : 0), A.z + k.side.z * fan);
      }
      sweets.fade(fadeOut(p, 0.85));
    },
  };
};
/* ==== end of T44 surprise ==== */
