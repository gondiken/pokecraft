// Building blocks for the blocky creature models, and the newer body shapes.
// Every model faces +Z and stands on y = 0. A builder gets (root, m, parts): root is the group to
// build into, m the species' model recipe, and parts collects pieces for animateModel in species.js.
import * as THREE from 'three';

export function box(parent, w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function eyes(parent, y, z, spread, size = 0.13, closed = false) {
  for (const s of [-1, 1]) {
    if (closed) {
      box(parent, size * 1.1, 0.03, 0.03, 0x222222, s * spread, y - 0.02, z + 0.01).userData.eye = true;
      continue;
    }
    box(parent, size, size * 1.15, 0.04, 0xffffff, s * spread, y, z).userData.eye = true;
    box(parent, size * 0.55, size * 0.7, 0.03, 0x111111, s * spread + s * size * 0.12, y - 0.01, z + 0.03).userData.eye = true;
  }
}

export function glow(mesh, color) {
  mesh.material.emissive = new THREE.Color(color);
  return mesh;
}

export function zigzag(parent, color, x, y, z, size = 1) {
  box(parent, 0.1 * size, 0.22 * size, 0.08 * size, color, x, y, z);
  box(parent, 0.1 * size, 0.08 * size, 0.22 * size, color, x, y + 0.13 * size, z - 0.07 * size);
  box(parent, 0.1 * size, 0.22 * size, 0.08 * size, color, x, y + 0.25 * size, z - 0.15 * size);
}

// A pair of flat wings on pivots so they can flap.
// Upright wings (pixies) stand in the x-y plane; others are flat and raised by `lift` radians.
export function addWings(parts, parent, m, x, y, z, w, d, color, tipColor, { lift = 0, upright = false } = {}) {
  parts.wings = parts.wings || [];
  for (const s of [-1, 1]) {
    const g = pivot(parent, s * x, y, z);
    if (upright) {
      box(g, w, d, 0.04, color, s * w / 2, d / 3, 0);
      if (tipColor !== undefined) box(g, w * 0.6, d * 0.5, 0.03, tipColor, s * w * 0.4, -d * 0.25, 0.01);
    } else {
      box(g, w, 0.05, d, color, s * w / 2, 0, 0);
      if (tipColor !== undefined) box(g, w * 0.45, 0.04, d * 0.7, tipColor, s * w * 0.85, 0.01, -d * 0.1);
    }
    g.rotation.z = s * lift;
    parts.wings.push({ g, s, lift });
  }
}

// Glowing gem on the forehead.
export function gem(parent, m, y, z) {
  return glow(box(parent, 0.12, 0.12, 0.05, m.accent, 0, y, z), m.accent);
}

// A wide, spotted mushroom cap sitting at height y.
export function mushroomCap(parent, m, y, w) {
  box(parent, w, 0.22, w, m.accent, 0, y + 0.11, 0);
  box(parent, w * 0.7, 0.14, w * 0.7, m.accent, 0, y + 0.29, 0);
  for (const [x, z] of [[-0.25, 0.2], [0.22, -0.15], [0.05, 0.3], [-0.15, -0.28]]) {
    box(parent, 0.12, 0.04, 0.12, 0xffffff, x * w, y + 0.37, z * w);
  }
  for (const s of [-1, 1]) box(parent, 0.12, 0.1, 0.02, 0xffffff, s * w * 0.25, y + 0.14, w / 2 + 0.005);
}

/* ------------------------------------------------------------------ */
/* More helpers                                                         */
/* ------------------------------------------------------------------ */

// A roundish lump: three crossed boxes read as a ball from every side.
export function ball(parent, r, color, x = 0, y = 0, z = 0) {
  const g = pivot(parent, x, y, z);
  box(g, r * 2, r * 1.5, r * 1.5, color);
  box(g, r * 1.5, r * 2, r * 1.5, color);
  box(g, r * 1.5, r * 1.5, r * 2, color);
  return g;
}

const has = (m, e) => m.extras.includes(e);
const swing = (parts, g, axis, amp, speed, phase = 0) => (parts.wobble ||= []).push({ g, axis, amp, speed, phase });
const spin = (parts, g, axis, speed) => (parts.spin ||= []).push({ g, axis, speed });
const mouth = (parent, y, z, w = 0.12) => box(parent, w, 0.04, 0.03, 0x2a2a2a, 0, y, z);

/* ------------------------------------------------------------------ */
/* Body shapes                                                          */
/* ------------------------------------------------------------------ */

// A five-pointed star with a face, floating and gently rocking.
function star(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body; // the hover bob moves this, so the star's own height sits on the face below
  parts.hover = true;
  const face = pivot(body, 0, 0.55, 0);
  box(face, 0.5, 0.5, 0.3, m.body);
  for (let k = 0; k < 5; k++) {
    const arm = pivot(face, 0, 0, 0);
    arm.rotation.z = (k * Math.PI * 2) / 5;
    box(arm, 0.26, 0.4, 0.26, m.body, 0, 0.4, 0);
    glow(box(arm, 0.14, 0.16, 0.2, m.accent, 0, 0.66, 0), m.accent);
  }
  box(face, 0.36, 0.3, 0.02, m.belly, 0, -0.02, 0.155);
  eyes(face, 0.04, 0.17, 0.09, 0.1);
  mouth(face, -0.09, 0.175, 0.08);
  swing(parts, face, 'z', 0.35, 1.6);
}

// A floating star wizard in a long robe, with little planets circling around it.
function robe(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  box(body, 0.9, 0.22, 0.9, m.dark, 0, 0.2, 0);
  box(body, 0.78, 0.35, 0.78, m.body, 0, 0.45, 0);
  box(body, 0.64, 0.4, 0.64, m.body, 0, 0.8, 0);
  box(body, 0.5, 0.06, 0.66, m.accent, 0, 0.62, 0);
  for (const [x, y] of [[-0.2, 0.42], [0.25, 0.75], [-0.1, 0.9], [0.18, 0.35]]) glow(box(body, 0.07, 0.07, 0.02, m.accent, x, y, 0.4 - (y - 0.4) * 0.2), m.accent);
  const head = pivot(body, 0, 1.25, 0.02);
  parts.head = head;
  box(head, 0.5, 0.44, 0.46, m.dark);
  box(head, 0.38, 0.32, 0.04, m.belly, 0, -0.02, 0.23);
  eyes(head, 0.0, 0.255, 0.09, 0.1);
  // A tall pointy hat with a glowing star on top.
  box(head, 0.62, 0.08, 0.62, m.dark, 0, 0.25, 0);
  box(head, 0.42, 0.22, 0.42, m.body, 0, 0.4, -0.02);
  box(head, 0.26, 0.2, 0.26, m.body, 0, 0.6, -0.06);
  parts.tip = glow(box(head, 0.16, 0.16, 0.16, m.accent, 0, 0.78, -0.1), m.accent);
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(body, s * 0.4, 1.0, 0.05);
    box(arm, 0.2, 0.42, 0.22, m.body, s * 0.04, -0.18, 0);
    glow(box(arm, 0.14, 0.14, 0.14, m.accent, s * 0.04, -0.44, 0.06), m.accent);
    parts.arms.push({ g: arm, phase });
  }
  const orbit = pivot(body, 0, 0.9, 0);
  for (const [k, col, r] of [[0, 0xff9a5a, 0.11], [2.1, 0x7ad0ff, 0.09], [4.2, 0xb0f07a, 0.08]]) {
    glow(box(orbit, r * 2, r * 2, r * 2, col, Math.cos(k) * 0.75, Math.sin(k * 2) * 0.15, Math.sin(k) * 0.75), col);
  }
  spin(parts, orbit, 'y', 1.2);
}

// A round moon-bunny on big feet: it hops everywhere.
function hopper(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  ball(body, 0.36, m.body, 0, 0.5, 0);
  box(body, 0.42, 0.34, 0.04, m.belly, 0, 0.42, 0.36);
  eyes(body, 0.58, 0.37, 0.13, 0.13);
  box(body, 0.08, 0.05, 0.03, 0xff9ab0, 0, 0.5, 0.385);
  // A glowing crescent moon on the forehead.
  for (const [x, y] of [[-0.07, 0.8], [0, 0.76], [0.07, 0.8], [0.11, 0.86]]) glow(box(body, 0.06, 0.05, 0.03, m.accent, x, y, 0.33), m.accent);
  parts.ears = [];
  for (const s of [-1, 1]) {
    const ear = pivot(body, s * 0.14, 0.82, -0.05);
    box(ear, 0.13, 0.55, 0.08, m.body, 0, 0.27, 0);
    box(ear, 0.06, 0.42, 0.02, m.accent, 0, 0.27, 0.045);
    ear.rotation.z = -s * 0.15;
    swing(parts, ear, 'x', 0.15, 3, s);
  }
  for (const s of [-1, 1]) box(body, 0.2, 0.12, 0.5, m.dark, s * 0.2, 0.06, 0.1); // big feet
  for (const s of [-1, 1]) box(body, 0.1, 0.18, 0.1, m.body, s * 0.3, 0.35, 0.25); // little arms
  box(body, 0.2, 0.2, 0.16, m.belly, 0, 0.36, -0.38); // tail
  if (has(m, 'cape')) {
    box(body, 0.66, 0.6, 0.06, m.dark, 0, 0.5, -0.4);
    glow(box(body, 0.1, 0.1, 0.02, m.accent, 0, 0.6, -0.44), m.accent);
  }
  if (has(m, 'crescentHorns')) {
    // A glowing crescent moon floating over its head.
    const halo = pivot(body, 0, 1.55, -0.1);
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (0.15 + 0.7 * k / 8);
      glow(box(halo, 0.1, 0.1, 0.06, m.accent, Math.cos(a) * -0.32, Math.sin(a) * -0.32 + 0.1, 0), m.accent);
    }
    swing(parts, halo, 'z', 0.2, 1.2);
  }
}

// A little planet with craters and a spinning ring.
function planet(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  ball(body, 0.36, m.body, 0, 0.5, 0);
  for (const [x, y, z] of [[-0.2, 0.7, 0.3], [0.25, 0.4, 0.3], [0.33, 0.68, -0.1], [-0.3, 0.35, -0.2]]) box(body, 0.12, 0.12, 0.12, m.dark, x, y, z);
  eyes(body, 0.52, 0.37, 0.12, 0.12);
  mouth(body, 0.38, 0.375, 0.1);
  const tilt = pivot(body, 0, 0.5, 0);
  tilt.rotation.set(0.45, 0, 0.25);
  const ring = pivot(tilt, 0, 0, 0);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    glow(box(ring, 0.14, 0.04, 0.14, m.accent, Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62), m.accent);
  }
  spin(parts, ring, 'y', 1.5);
}

// A comet: a glowing head with a long, wavy tail.
function comet(root, m, parts) {
  const head = pivot(root, 0, 0.5, 0.25);
  parts.head = head;
  ball(head, 0.28, m.body);
  glow(box(head, 0.4, 0.4, 0.06, m.accent, 0, 0, -0.18), m.accent);
  eyes(head, 0.06, 0.29, 0.1, 0.11);
  mouth(head, -0.08, 0.29, 0.08);
  for (const [x, y] of [[-0.2, 0.25], [0.2, 0.25], [0, 0.32]]) glow(box(head, 0.08, 0.18, 0.08, m.accent, x, y, -0.05), m.accent);
  parts.segments = [];
  for (let i = 0; i < 7; i++) {
    const size = 0.42 - i * 0.05;
    const seg = pivot(root, 0, 0.5 + i * 0.04, -0.15 - i * 0.24);
    const col = new THREE.Color(m.accent).lerp(new THREE.Color(m.body), i / 7).getHex();
    const b = glow(box(seg, size, size, 0.22, col), col);
    b.material.transparent = true;
    b.material.opacity = 1 - i * 0.1;
    parts.segments.push({ g: seg, i, x0: 0 });
  }
}

// A sleepy little cloud.
function cloud(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  box(body, 0.8, 0.42, 0.56, m.body, 0, 0.45, 0);
  for (const [x, y, z, r] of [[-0.42, 0.42, 0, 0.22], [0.42, 0.42, 0, 0.22], [-0.18, 0.68, 0, 0.24], [0.18, 0.7, -0.02, 0.27], [0, 0.45, -0.2, 0.25]]) {
    box(body, r * 2, r * 1.6, r * 1.8, m.body, x, y, z);
  }
  box(body, 0.6, 0.12, 0.5, m.belly, 0, 0.26, 0);
  eyes(body, 0.5, 0.285, 0.14, 0.13, true);
  for (const s of [-1, 1]) box(body, 0.1, 0.06, 0.02, 0xff9ac8, s * 0.24, 0.42, 0.285);
  mouth(body, 0.4, 0.285, 0.08);
  if (has(m, 'gem')) gem(body, m, 0.72, 0.25);
  // Floating "z z" above its head.
  for (const [x, y, sz] of [[0.35, 0.98, 0.1], [0.5, 1.14, 0.07]]) {
    glow(box(body, sz, 0.025, 0.02, m.accent, x, y + sz / 2, 0), m.accent);
    glow(box(body, sz, 0.025, 0.02, m.accent, x, y - sz / 2, 0), m.accent);
    glow(box(body, 0.025, sz * 1.1, 0.02, m.accent, x, y, 0), m.accent).rotation.z = -0.8;
  }
}

// A long-legged animal with a long neck: an elk with antlers, or a horse with a flowing mane.
function tall(root, m, parts) {
  const legLen = 0.75;
  box(root, 0.52, 0.42, 1.0, m.body, 0, legLen + 0.2, 0);
  box(root, 0.44, 0.06, 0.86, m.belly, 0, legLen, 0);
  const neck = pivot(root, 0, legLen + 0.32, 0.42);
  box(neck, 0.22, 0.62, 0.24, m.body, 0, 0.28, 0).rotation.x = 0.35;
  const head = pivot(neck, 0, 0.62, 0.12);
  parts.head = head;
  box(head, 0.3, 0.3, 0.34, m.body, 0, 0, 0);
  box(head, 0.22, 0.2, 0.24, m.belly, 0, -0.06, 0.26);
  box(head, 0.1, 0.05, 0.03, 0x222222, 0, -0.06, 0.385);
  eyes(head, 0.06, 0.175, 0.1, 0.09);
  for (const s of [-1, 1]) box(head, 0.06, 0.14, 0.05, m.dark, s * 0.13, 0.2, -0.08).rotation.z = -s * 0.4;
  if (has(m, 'antlers')) {
    for (const s of [-1, 1]) {
      const a = pivot(head, s * 0.1, 0.16, -0.06);
      box(a, 0.05, 0.4, 0.05, m.accent, s * 0.1, 0.2, 0).rotation.z = -s * 0.5;
      box(a, 0.05, 0.2, 0.05, m.accent, s * 0.14, 0.34, 0.06).rotation.x = 0.6;
      box(a, 0.05, 0.22, 0.05, m.accent, s * 0.26, 0.42, 0).rotation.z = -s * 0.2;
      glow(box(a, 0.07, 0.07, 0.07, m.accent, s * 0.27, 0.55, 0), m.accent);
    }
  }
  if (has(m, 'thirdEye')) {
    box(head, 0.11, 0.13, 0.03, 0xffffff, 0, 0.11, 0.175).userData.eye = true;
    glow(box(head, 0.06, 0.08, 0.03, m.accent, 0, 0.11, 0.19), m.accent).userData.eye = true;
  }
  if (has(m, 'mane')) {
    for (let i = 0; i < 4; i++) glow(box(neck, 0.1, 0.22, 0.16, m.accent, 0, 0.12 + i * 0.16, -0.12 - i * 0.04), m.accent);
    glow(box(head, 0.1, 0.16, 0.2, m.accent, 0, 0.2, -0.1), m.accent);
  }
  parts.legs = [];
  for (const [sx, sz, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
    const leg = pivot(root, sx * 0.17, legLen, sz * 0.36);
    box(leg, 0.13, legLen, 0.13, m.dark, 0, -legLen / 2, 0);
    box(leg, 0.15, 0.1, 0.17, has(m, 'mane') ? m.accent : 0x3a2a1a, 0, -legLen + 0.05, 0.01);
    parts.legs.push({ g: leg, phase });
  }
  const tail = pivot(root, 0, legLen + 0.3, -0.5);
  parts.tail = tail;
  if (has(m, 'mane')) glow(box(tail, 0.12, 0.5, 0.12, m.accent, 0, -0.2, -0.1), m.accent).rotation.x = 0.4;
  else box(tail, 0.14, 0.16, 0.1, m.belly, 0, 0, -0.03);
}

// A floating brain with tentacles.
function squid(root, m, parts) {
  const body = pivot(root, 0, 0.35, 0);
  parts.bounce = body;
  parts.hover = true;
  box(body, 0.78, 0.6, 0.72, m.body, 0, 0.45, 0);
  for (const [x, z, w] of [[-0.18, 0, 0.36], [0.18, 0, 0.36], [0, -0.16, 0.42], [0, 0.16, 0.34]]) box(body, w, 0.2, w, m.accent, x, 0.8, z);
  for (const x of [-0.18, 0.18]) box(body, 0.02, 0.22, 0.6, m.dark, x * 0.1, 0.8, 0);
  eyes(body, 0.42, 0.365, 0.16, 0.16);
  mouth(body, 0.24, 0.365, 0.1);
  glow(box(body, 0.1, 0.1, 0.03, m.accent, 0, 0.62, 0.365), m.accent);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const t = pivot(body, Math.cos(a) * 0.26, 0.16, Math.sin(a) * 0.24);
    box(t, 0.1, 0.24, 0.1, m.body, 0, -0.1, 0);
    const t2 = pivot(t, 0, -0.22, 0);
    box(t2, 0.08, 0.22, 0.08, m.body, 0, -0.1, 0);
    box(t2, 0.07, 0.04, 0.07, m.belly, 0, -0.22, 0);
    swing(parts, t, 'x', 0.25, 2.5, k);
    swing(parts, t2, 'z', 0.35, 3, k + 1);
  }
}

// A round, fuzzy bat with huge ears and webbed wings.
function bat(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  ball(body, 0.26, m.body, 0, 0.6, 0);
  box(body, 0.3, 0.26, 0.04, m.belly, 0, 0.52, 0.255);
  eyes(body, 0.66, 0.265, 0.09, 0.11);
  for (const s of [-1, 1]) box(body, 0.04, 0.06, 0.03, 0xffffff, s * 0.05, 0.5, 0.27);
  for (const s of [-1, 1]) {
    const ear = pivot(body, s * 0.14, 0.84, 0);
    box(ear, 0.16, 0.36, 0.06, m.body, 0, 0.16, 0);
    box(ear, 0.08, 0.24, 0.02, m.belly, 0, 0.14, 0.035);
    ear.rotation.z = -s * 0.3;
  }
  parts.wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, s * 0.22, 0.66, 0);
    box(w, 0.75, 0.04, 0.42, m.dark, s * 0.4, 0, -0.04);
    for (const [x, z] of [[0.35, 0.18], [0.55, 0.0], [0.72, -0.18]]) box(w, 0.04, 0.06, 0.46, m.body, s * x, 0.02, z - 0.05).rotation.y = s * 0.3;
    box(w, 0.75, 0.06, 0.05, m.body, s * 0.4, 0.02, 0.17);
    if (has(m, 'speakers')) {
      for (const [x, r] of [[0.3, 0.2], [0.58, 0.15]]) {
        box(w, r * 2, 0.05, r * 2, m.accent, s * x, 0.03, -0.04);
        box(w, r, 0.06, r, 0x1a1a1a, s * x, 0.04, -0.04);
      }
    }
    w.rotation.z = s * 0.2;
    parts.wings.push({ g: w, s, lift: 0.2 });
  }
  for (const s of [-1, 1]) box(body, 0.06, 0.16, 0.06, m.dark, s * 0.1, 0.32, 0);
}

// A walking drum with drumsticks.
function drum(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  for (const r of [0, Math.PI / 4]) box(body, 0.78, 0.62, 0.62, m.body, 0, 0.72, 0).rotation.y = r;
  box(body, 0.8, 0.04, 0.8, 0xfdf6e8, 0, 1.04, 0).rotation.y = Math.PI / 8;
  for (const y of [0.43, 1.0]) for (const r of [0, Math.PI / 4]) box(body, 0.82, 0.07, 0.66, m.accent, 0, y, 0).rotation.y = r;
  for (let k = 0; k < 5; k++) box(body, 0.04, 0.5, 0.03, m.accent, -0.24 + k * 0.12, 0.72, 0.4).rotation.z = k % 2 ? 0.5 : -0.5;
  box(body, 0.42, 0.24, 0.03, m.belly, 0, 0.78, 0.41);
  eyes(body, 0.82, 0.43, 0.1, 0.11);
  mouth(body, 0.7, 0.43, 0.12);
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(body, s * 0.42, 0.82, 0.05);
    box(arm, 0.12, 0.34, 0.12, m.dark, 0, -0.14, 0);
    const stick = box(arm, 0.04, 0.04, 0.42, 0xd8b070, 0, -0.3, 0.18);
    box(stick, 0.1, 0.1, 0.1, 0xfdf6e8, 0, 0, 0.22);
    parts.arms.push({ g: arm, phase });
  }
  parts.legs = [];
  for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
    const leg = pivot(body, s * 0.18, 0.4, 0);
    box(leg, 0.14, 0.4, 0.16, m.dark, 0, -0.2, 0);
    box(leg, 0.18, 0.08, 0.24, m.dark, 0, -0.38, 0.04);
    parts.legs.push({ g: leg, phase });
  }
}

// A big gorilla that knuckle-walks, with bongo drums on its belly.
function ape(root, m, parts) {
  const torso = pivot(root, 0, 0.95, 0);
  torso.rotation.x = 0.25;
  box(torso, 1.0, 0.7, 0.62, m.body, 0, 0.1, 0);
  box(torso, 0.6, 0.45, 0.04, m.belly, 0, 0.0, 0.32);
  const head = pivot(root, 0, 1.3, 0.38);
  parts.head = head;
  box(head, 0.42, 0.4, 0.38, m.body);
  box(head, 0.32, 0.26, 0.06, m.belly, 0, -0.04, 0.2);
  box(head, 0.44, 0.08, 0.08, m.dark, 0, 0.12, 0.2);
  eyes(head, 0.04, 0.235, 0.08, 0.09);
  box(head, 0.14, 0.04, 0.03, 0x2a2a2a, 0, -0.1, 0.24);
  if (has(m, 'drum')) {
    for (const s of [-1, 1]) {
      box(root, 0.26, 0.3, 0.26, m.accent, s * 0.17, 0.62, 0.42);
      box(root, 0.24, 0.03, 0.24, 0xfdf6e8, s * 0.17, 0.78, 0.42);
    }
  }
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(root, s * 0.6, 1.2, 0.1);
    box(arm, 0.3, 0.95, 0.32, m.body, 0, -0.45, 0);
    box(arm, 0.32, 0.2, 0.36, m.dark, 0, -0.95, 0.02);
    parts.arms.push({ g: arm, phase });
  }
  parts.legs = [];
  for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
    const leg = pivot(root, s * 0.25, 0.5, -0.1);
    box(leg, 0.28, 0.5, 0.3, m.dark, 0, -0.25, 0);
    parts.legs.push({ g: leg, phase });
  }
}

// A floating bell that swings and rings.
function bell(root, m, parts) {
  const body = pivot(root, 0, 0.3, 0);
  parts.bounce = body;
  parts.hover = true;
  const swingG = pivot(body, 0, 0.95, 0);
  const b = pivot(swingG, 0, -0.95, 0);
  box(b, 0.08, 0.16, 0.08, m.accent, -0.1, 1.06, 0);
  box(b, 0.08, 0.16, 0.08, m.accent, 0.1, 1.06, 0);
  box(b, 0.28, 0.07, 0.08, m.accent, 0, 1.15, 0);
  box(b, 0.36, 0.14, 0.36, m.body, 0, 0.95, 0);
  box(b, 0.5, 0.22, 0.5, m.body, 0, 0.8, 0);
  box(b, 0.62, 0.26, 0.62, m.body, 0, 0.56, 0);
  box(b, 0.78, 0.12, 0.78, m.body, 0, 0.38, 0);
  box(b, 0.64, 0.05, 0.64, m.accent, 0, 0.68, 0);
  box(b, 0.8, 0.04, 0.8, m.accent, 0, 0.33, 0);
  eyes(b, 0.56, 0.315, 0.12, 0.12);
  box(b, 0.12, 0.08, 0.03, 0x2a2a2a, 0, 0.44, 0.395);
  box(b, 0.14, 0.14, 0.14, m.dark, 0, 0.24, 0); // the clapper
  swing(parts, swingG, 'z', 0.18, 3);
}

// A plated armadillo with a big golden gong on its tail.
function armadillo(root, m, parts) {
  for (let i = 0; i < 5; i++) {
    const z = 0.36 - i * 0.18;
    const hgt = 0.42 - Math.abs(i - 2) * 0.05;
    box(root, 0.74, hgt, 0.2, i % 2 ? m.body : m.dark, 0, 0.32 + hgt / 2, z);
  }
  box(root, 0.6, 0.06, 0.8, m.belly, 0, 0.3, 0);
  const head = pivot(root, 0, 0.5, 0.5);
  parts.head = head;
  box(head, 0.36, 0.3, 0.3, m.belly);
  box(head, 0.16, 0.14, 0.24, m.belly, 0, -0.06, 0.24);
  box(head, 0.06, 0.05, 0.03, 0x222222, 0, -0.04, 0.365);
  eyes(head, 0.05, 0.155, 0.09, 0.09);
  for (const s of [-1, 1]) box(head, 0.08, 0.1, 0.04, m.dark, s * 0.14, 0.18, -0.06);
  parts.legs = [];
  for (const [sx, sz, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
    const leg = pivot(root, sx * 0.28, 0.32, sz * 0.26);
    box(leg, 0.14, 0.32, 0.14, m.dark, 0, -0.16, 0);
    parts.legs.push({ g: leg, phase });
  }
  const tail = pivot(root, 0, 0.5, -0.5);
  parts.tail = tail;
  box(tail, 0.12, 0.12, 0.4, m.body, 0, 0.1, -0.15).rotation.x = -0.6;
  const gong = pivot(tail, 0, 0.55, -0.32);
  for (const [w, h] of [[0.7, 0.36], [0.36, 0.7], [0.56, 0.56]]) box(gong, w, h, 0.05, m.accent);
  box(gong, 0.4, 0.4, 0.06, m.body);
  glow(box(gong, 0.16, 0.16, 0.08, m.accent), m.accent);
}

// An upright dragon on two strong legs, with big wings and a long tail.
function wyvern(root, m, parts) {
  const torso = pivot(root, 0, 0.85, 0);
  torso.rotation.x = -0.35;
  box(torso, 0.5, 0.62, 0.48, m.body);
  box(torso, 0.36, 0.5, 0.04, m.belly, 0, -0.02, 0.25);
  const head = pivot(root, 0, 1.38, 0.22);
  parts.head = head;
  box(head, 0.36, 0.32, 0.4, m.body);
  box(head, 0.28, 0.16, 0.24, m.body, 0, -0.06, 0.28);
  box(head, 0.24, 0.04, 0.2, 0x2a2a2a, 0, -0.12, 0.3);
  eyes(head, 0.06, 0.205, 0.11, 0.1);
  for (const s of [-1, 1]) box(head, 0.07, 0.3, 0.07, m.accent, s * 0.12, 0.24, -0.12).rotation.x = -0.7;
  if (has(m, 'spikes')) for (let i = 0; i < 3; i++) box(torso, 0.1, 0.16, 0.1, m.accent, 0, 0.2 - i * 0.2, -0.28);
  if (has(m, 'bolt')) zigzag(torso, m.accent, 0, -0.1, 0.27, 1.1);
  addWings(parts, torso, m, 0.22, 0.15, -0.26, has(m, 'big') ? 0.95 : 0.6, has(m, 'big') ? 0.75 : 0.5, m.dark, m.accent, { lift: 0.25, upright: true });
  for (const s of [-1, 1]) box(torso, 0.1, 0.24, 0.1, m.dark, s * 0.24, -0.08, 0.2).rotation.x = -0.5; // little arms
  parts.legs = [];
  for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
    const leg = pivot(root, s * 0.2, 0.55, -0.05);
    box(leg, 0.22, 0.36, 0.28, m.body, 0, -0.14, 0);
    box(leg, 0.14, 0.24, 0.14, m.dark, 0, -0.42, 0.02);
    box(leg, 0.2, 0.06, 0.26, m.dark, 0, -0.52, 0.08);
    parts.legs.push({ g: leg, phase });
  }
  const tail = pivot(root, 0, 0.62, -0.3);
  parts.tail = tail;
  box(tail, 0.24, 0.22, 0.4, m.body, 0, -0.06, -0.18).rotation.x = 0.4;
  box(tail, 0.16, 0.14, 0.4, m.body, 0, -0.24, -0.5).rotation.x = 0.2;
  box(tail, 0.2, 0.12, 0.14, m.accent, 0, -0.3, -0.74);
}

// A fish with a swishing tail and fins.
function fish(root, m, parts) {
  const body = pivot(root, 0, 0.35, 0);
  parts.bounce = body;
  const big = has(m, 'longFins');
  box(body, 0.36, 0.52, 0.62, m.body, 0, 0, 0.05);
  box(body, 0.28, 0.38, 0.3, m.body, 0, 0, -0.38);
  box(body, 0.3, 0.3, 0.06, m.belly, 0, -0.06, 0.37);
  eyes(body, 0.08, 0.38, 0.1, 0.1);
  box(body, 0.12, 0.06, 0.03, 0x2a2a2a, 0, -0.1, 0.39);
  box(body, 0.06, big ? 0.5 : 0.26, big ? 0.6 : 0.36, m.accent, 0, big ? 0.48 : 0.36, -0.05).rotation.x = -0.3;
  for (const s of [-1, 1]) {
    const fin = box(body, 0.04, 0.16, big ? 0.42 : 0.24, m.accent, s * 0.2, -0.12, 0.05);
    fin.rotation.y = s * 0.5;
  }
  const tail = pivot(body, 0, 0, -0.52);
  parts.tail = tail;
  for (const s of [-1, 1]) box(tail, 0.05, big ? 0.6 : 0.36, big ? 0.6 : 0.36, m.accent, 0, s * (big ? 0.22 : 0.14), -0.16).rotation.x = s * 0.6;
}

// A walking hex nut that peeks out through its hole.
function nut(root, m, parts) {
  const body = pivot(root, 0, 0.62, 0);
  for (let k = 0; k < 6; k++) {
    const side = pivot(body, 0, 0, 0);
    side.rotation.z = (k * Math.PI) / 3;
    box(side, 0.36, 0.22, 0.32, k % 2 ? m.body : m.belly, 0, 0.36, 0);
  }
  box(body, 0.42, 0.42, 0.06, 0x2a2e36, 0, 0, -0.02);
  eyes(body, 0.02, 0.03, 0.09, 0.12);
  if (has(m, 'horn')) {
    box(body, 0.08, 0.26, 0.08, m.accent, 0, 0.6, 0);
    box(body, 0.18, 0.08, 0.18, m.accent, 0, 0.74, 0);
  }
  parts.legs = [];
  for (const [sx, sz, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
    const leg = pivot(root, sx * 0.22, 0.2, sz * 0.12);
    box(leg, 0.08, 0.22, 0.08, m.dark, 0, -0.1, 0);
    parts.legs.push({ g: leg, phase, side: true });
  }
}

// A flying robot drone with four spinning propellers.
function drone(root, m, parts) {
  const body = pivot(root, 0, 0.3, 0);
  parts.bounce = body;
  parts.hover = true;
  box(body, 0.6, 0.34, 0.56, m.body, 0, 0.4, 0);
  box(body, 0.44, 0.2, 0.04, 0x1a2a3a, 0, 0.42, 0.29);
  for (const s of [-1, 1]) glow(box(body, 0.1, 0.08, 0.02, m.accent, s * 0.1, 0.43, 0.315), m.accent).userData.eye = true;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const arm = box(body, 0.42, 0.06, 0.08, m.dark, sx * 0.4, 0.55, sz * 0.36);
    arm.rotation.y = sx * sz * -0.6;
    const hub = pivot(body, sx * 0.55, 0.62, sz * 0.48);
    box(hub, 0.08, 0.1, 0.08, m.dark);
    const prop = pivot(hub, 0, 0.07, 0);
    box(prop, 0.5, 0.02, 0.07, m.accent);
    box(prop, 0.07, 0.02, 0.5, m.accent);
    spin(parts, prop, 'y', 18 + sx * 2);
  }
  for (const s of [-1, 1]) box(body, 0.05, 0.05, 0.5, m.dark, s * 0.2, 0.18, 0);
  if (has(m, 'horn')) box(body, 0.1, 0.22, 0.1, m.accent, 0, 0.66, 0.1).rotation.x = 0.4;
}

// A flickering little flame of shadow.
function wisp(root, m, parts) {
  const body = pivot(root, 0, 0.1, 0);
  parts.bounce = body;
  parts.float = true;
  const layers = [[0.6, 0.3], [0.5, 0.28], [0.38, 0.24], [0.26, 0.2], [0.14, 0.18]];
  let y = 0.2;
  layers.forEach(([w, h], i) => {
    const layer = pivot(body, 0, y + h / 2, 0);
    box(layer, w, h, w * 0.9, i === 0 ? m.dark : m.body);
    swing(parts, layer, 'z', 0.08 + i * 0.05, 5, i * 0.8);
    y += h * 0.85;
  });
  glow(box(body, 0.2, 0.2, 0.2, m.accent, 0, 0.35, 0), m.accent);
  eyes(body, 0.45, 0.275, 0.11, 0.14);
  box(body, 0.2, 0.05, 0.03, 0xffffff, 0, 0.3, 0.275);
}

// A fluffy pom-pom with a bow.
function puff(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  ball(body, 0.3, m.body, 0, 0.45, 0);
  for (let k = 0; k < 14; k++) {
    const a = k * 2.4, b = (k / 14) * Math.PI;
    const col = k % 3 ? m.body : m.belly;
    box(body, 0.16, 0.16, 0.16, col, Math.cos(a) * Math.sin(b) * 0.36, 0.45 + Math.cos(b) * 0.36, Math.sin(a) * Math.sin(b) * 0.36);
  }
  eyes(body, 0.5, 0.36, 0.11, 0.12);
  for (const s of [-1, 1]) box(body, 0.08, 0.05, 0.02, 0xff7ab0, s * 0.2, 0.4, 0.36);
  mouth(body, 0.38, 0.365, 0.07);
  for (const s of [-1, 1]) box(body, 0.2, 0.16, 0.06, m.accent, s * 0.13, 0.86, 0).rotation.z = s * 0.3;
  box(body, 0.08, 0.08, 0.08, m.accent, 0, 0.86, 0);
  for (const s of [-1, 1]) box(body, 0.14, 0.08, 0.2, m.dark, s * 0.14, 0.05, 0.05);
}

// A walking cluster of crystals with a face.
function crystal(root, m, parts) {
  const body = pivot(root, 0, 0.25, 0);
  const main = box(body, 0.42, 0.9, 0.42, m.body, 0, 0.5, 0);
  main.rotation.y = Math.PI / 4;
  box(body, 0.3, 0.2, 0.3, m.belly, 0, 1.0, 0).rotation.y = Math.PI / 4;
  for (const [x, z, h, r] of [[-0.3, 0.05, 0.6, 0.5], [0.32, -0.05, 0.5, -0.45], [0.05, -0.32, 0.55, 0.3], [-0.15, -0.25, 0.4, 0.6]]) {
    const c = box(body, 0.2, h, 0.2, m.accent, x, 0.3 + h / 2 - 0.1, z);
    c.rotation.z = r; c.rotation.y = 0.5;
    glow(c, m.accent).material.emissiveIntensity = 0.25;
  }
  box(body, 0.34, 0.3, 0.04, m.belly, 0, 0.55, 0.3);
  eyes(body, 0.6, 0.32, 0.08, 0.1);
  mouth(body, 0.48, 0.32, 0.08);
  parts.legs = [];
  for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
    const leg = pivot(root, s * 0.14, 0.3, 0);
    box(leg, 0.16, 0.3, 0.18, m.dark, 0, -0.15, 0);
    parts.legs.push({ g: leg, phase });
  }
}

// A fuzzy moth with feathery antennae, big patterned wings and a glowing tail.
function moth(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  ball(body, 0.22, m.body, 0, 0.6, 0.12);
  box(body, 0.34, 0.3, 0.5, m.dark, 0, 0.55, -0.22);
  parts.tip = glow(box(body, 0.26, 0.24, 0.16, m.accent, 0, 0.52, -0.52), m.accent);
  box(body, 0.36, 0.12, 0.12, 0xf8f0e0, 0, 0.72, 0.26); // fluffy collar
  eyes(body, 0.62, 0.345, 0.1, 0.12);
  for (const s of [-1, 1]) {
    const a = pivot(body, s * 0.08, 0.8, 0.22);
    box(a, 0.03, 0.3, 0.03, m.dark, 0, 0.14, 0).rotation.z = -s * 0.3;
    for (let i = 0; i < 3; i++) box(a, 0.12, 0.03, 0.02, m.dark, s * (0.05 + i * 0.04), 0.08 + i * 0.08, 0).rotation.z = -s * 0.3;
  }
  parts.wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, s * 0.15, 0.62, -0.05);
    box(w, 0.6, 0.5, 0.04, m.belly, s * 0.32, 0.12, 0);
    box(w, 0.4, 0.3, 0.04, m.belly, s * 0.26, -0.24, 0);
    box(w, 0.16, 0.16, 0.05, m.dark, s * 0.36, 0.14, 0.005);
    glow(box(w, 0.08, 0.08, 0.06, m.accent, s * 0.36, 0.14, 0.01), m.accent);
    w.rotation.y = -s * 0.5;
    parts.wings.push({ g: w, s, lift: 0 });
  }
  for (const s of [-1, 1]) box(body, 0.04, 0.2, 0.04, m.dark, s * 0.1, 0.4, 0.1);
}

// A slim butterfly whose two pairs of tall wings open and close.
function butterfly(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  for (let i = 0; i < 4; i++) box(body, 0.14 - i * 0.015, 0.14 - i * 0.015, 0.16, i % 2 ? m.dark : m.body, 0, 0.62, 0.08 - i * 0.15);
  const head = pivot(body, 0, 0.66, 0.24);
  parts.head = head;
  box(head, 0.22, 0.2, 0.2, m.body);
  eyes(head, 0.02, 0.105, 0.06, 0.08);
  for (const s of [-1, 1]) {
    box(head, 0.02, 0.32, 0.02, m.dark, s * 0.06, 0.24, 0.02).rotation.z = -s * 0.35;
    box(head, 0.06, 0.06, 0.06, m.accent, s * 0.12, 0.4, 0.02);
  }
  for (const s of [-1, 1]) {
    const w = pivot(body, s * 0.07, 0.66, 0);
    box(w, 0.04, 0.6, 0.46, m.accent, 0, 0.28, 0.08);
    box(w, 0.045, 0.36, 0.28, m.dark, 0, 0.36, 0.1);
    box(w, 0.05, 0.12, 0.12, m.belly, 0, 0.4, 0.1);
    box(w, 0.04, 0.34, 0.34, m.accent, 0, -0.12, -0.18);
    w.rotation.z = -s * 0.9;
    swing(parts, w, 'x', 0.15, 3, s);
    (parts.flap ||= []).push({ g: w, s });
  }
}

// A proud four-legged sky guardian: crystal crown, flowing mane, two pairs of wings, a spinning
// halo and a star-tipped tail.
function guardian(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  box(body, 0.7, 0.6, 1.1, m.body, 0, 0.9, 0);
  box(body, 0.5, 0.1, 0.9, m.belly, 0, 0.62, 0);
  box(body, 0.72, 0.12, 0.5, m.dark, 0, 1.22, -0.1); // saddle stripe
  box(body, 0.3, 0.4, 0.2, m.dark, 0, 1.0, -0.6); // rump
  parts.legs = [];
  for (const [z, phase] of [[0.4, 0], [-0.4, Math.PI]]) {
    for (const s of [-1, 1]) {
      const leg = pivot(root, s * 0.25, 0.65, z);
      box(leg, 0.2, 0.5, 0.22, m.body, 0, -0.25, 0);
      box(leg, 0.24, 0.12, 0.28, m.accent, 0, -0.6, 0.03);
      parts.legs.push({ g: leg, phase: s > 0 ? phase : phase + Math.PI });
    }
  }
  // Head with a crystal crown.
  const head = pivot(root, 0, 1.45, 0.62);
  parts.head = head;
  box(head, 0.42, 0.4, 0.42, m.body, 0, 0, 0);
  box(head, 0.3, 0.2, 0.26, m.belly, 0, -0.1, 0.28); // muzzle
  eyes(head, 0.06, 0.215, 0.12, 0.11);
  gem(head, m, 0.2, 0.215);
  for (let i = 0; i < 5; i++) {
    const h = i === 2 ? 0.36 : i % 2 ? 0.22 : 0.28;
    glow(box(head, 0.07, h, 0.07, m.accent, (i - 2) * 0.09, 0.2 + h / 2, -0.02), m.accent);
  }
  for (const s of [-1, 1]) box(head, 0.08, 0.2, 0.08, m.dark, s * 0.17, 0.3, -0.14).rotation.z = -s * 0.3; // ears
  // Mane flowing down the neck.
  box(body, 0.34, 0.3, 0.3, m.dark, 0, 1.3, 0.45); // neck
  for (let i = 0; i < 4; i++) box(body, 0.2 - i * 0.02, 0.22, 0.2, i % 2 ? m.accent : m.dark, 0, 1.5 - i * 0.12, 0.3 - i * 0.2);
  // Two pairs of wings: a big upper pair and a smaller lower pair.
  addWings(parts, body, m, 0.34, 1.25, 0.05, 1.1, 0.6, m.body, m.accent, { lift: 0.3 });
  addWings(parts, body, m, 0.34, 1.12, -0.3, 0.7, 0.4, m.dark, m.accent, { lift: 0.15 });
  // A spinning halo above the head.
  const halo = pivot(root, 0, 2.0, 0.62);
  for (const [w, d, x, z] of [[0.6, 0.06, 0, 0.27], [0.6, 0.06, 0, -0.27], [0.06, 0.6, 0.27, 0], [0.06, 0.6, -0.27, 0]]) {
    glow(box(halo, w, 0.05, d, m.accent, x, 0, z), m.accent);
  }
  (parts.spin ||= []).push({ g: halo, axis: 'y', speed: 1.5 });
  // Tail of three boxes ending in a glowing star.
  const tail = pivot(root, 0, 1.0, -0.55);
  parts.tail = tail;
  for (let i = 0; i < 3; i++) box(tail, 0.18 - i * 0.03, 0.18 - i * 0.03, 0.34, i % 2 ? m.accent : m.body, 0, i * 0.1, -0.17 - i * 0.3);
  parts.tip = glow(box(tail, 0.26, 0.26, 0.26, m.accent, 0, 0.34, -1.1), m.accent);
}

/* ------------------------------------------------------------------ */
/* Bone and Alien shapes                                                */
/* ------------------------------------------------------------------ */

// Two glowing pupils in dark square sockets (skulls).
function sockets(parent, m, y, z, spread, w = 0.17, h = 0.19) {
  for (const s of [-1, 1]) {
    box(parent, w, h, 0.05, m.dark, s * spread, y, z);
    glow(box(parent, w * 0.5, h * 0.5, 0.04, m.accent, s * spread + s * 0.01, y - 0.01, z + 0.03), m.accent).userData.eye = true;
  }
}

// A flattened round disc (an octagon from above): three crossed boxes.
function disc(parent, r, h, color, x = 0, y = 0, z = 0) {
  const g = pivot(parent, x, y, z);
  box(g, r * 2, h, r * 1.4, color);
  box(g, r * 1.4, h, r * 2, color);
  const d = box(g, r * 1.5, h, r * 1.5, color);
  d.rotation.y = Math.PI / 4;
  return g;
}

// A happy skull that hops around clacking its jaw.
function skull(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  // little bone feet
  for (const s of [-1, 1]) {
    box(body, 0.14, 0.1, 0.3, m.belly, s * 0.2, 0.06, 0.05);
    box(body, 0.2, 0.1, 0.1, m.belly, s * 0.2, 0.07, 0.2);
    box(body, 0.2, 0.1, 0.1, m.belly, s * 0.2, 0.07, -0.1);
  }
  // cranium and face plate
  ball(body, 0.4, m.body, 0, 0.66, 0);
  box(body, 0.5, 0.1, 0.5, m.body, 0, 1.06, 0);
  box(body, 0.62, 0.46, 0.06, m.belly, 0, 0.62, 0.36);
  sockets(body, m, 0.68, 0.4, 0.17);
  box(body, 0.09, 0.09, 0.05, m.dark, 0, 0.5, 0.4); // nose
  box(body, 0.05, 0.06, 0.05, m.dark, 0, 0.45, 0.4);
  for (const s of [-1, 1]) box(body, 0.1, 0.06, 0.03, 0xffa0a8, s * 0.3, 0.52, 0.4); // blush
  // upper teeth + clacking jaw
  for (const x of [-0.18, -0.06, 0.06, 0.18]) box(body, 0.09, 0.08, 0.06, 0xffffff, x, 0.4, 0.37);
  const jaw = pivot(body, 0, 0.36, 0.12);
  box(jaw, 0.52, 0.12, 0.42, m.belly, 0, -0.04, 0.2);
  for (const x of [-0.18, -0.06, 0.06, 0.18]) box(jaw, 0.09, 0.08, 0.06, 0xffffff, x, 0.04, 0.4);
  swing(parts, jaw, 'x', 0.25, 6);
  parts.head = body;
  if (has(m, 'crown')) {
    for (const [x, h] of [[-0.2, 0.2], [0, 0.3], [0.2, 0.2]]) box(body, 0.1, h, 0.1, m.accent, x, 1.1 + h / 2, 0);
    box(body, 0.46, 0.08, 0.34, m.accent, 0, 1.12, 0);
    gem(body, m, 1.14, 0.2).material.emissive.set(0xff5a7a);
  }
  if (has(m, 'horns')) {
    for (const s of [-1, 1]) {
      box(body, 0.12, 0.3, 0.12, m.belly, s * 0.45, 0.98, 0).rotation.z = -s * 0.3;
      box(body, 0.1, 0.22, 0.1, m.belly, s * 0.58, 1.22, 0).rotation.z = s * 0.2;
    }
  }
}

// A skeleton puppy: ribs, bony legs, a collar and a wagging tail.
function bonedog(root, m, parts) {
  box(root, 0.1, 0.1, 0.9, m.body, 0, 0.82, 0); // spine
  box(root, 0.4, 0.24, 0.2, m.body, 0, 0.78, -0.5); // hips
  box(root, 0.4, 0.24, 0.2, m.body, 0, 0.78, 0.46); // shoulders
  for (const z of [0.22, 0.02, -0.18]) {
    for (const s of [-1, 1]) box(root, 0.05, 0.3, 0.07, m.body, s * 0.19, 0.66, z);
    box(root, 0.43, 0.05, 0.07, m.body, 0, 0.5, z);
  }
  parts.legs = [];
  for (const [sx, sz, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
    const leg = pivot(root, sx * 0.17, 0.72, sz * 0.46);
    box(leg, 0.1, 0.5, 0.1, m.body, 0, -0.25, 0);
    box(leg, 0.16, 0.12, 0.16, m.belly, 0, -0.04, 0); // knee knob
    box(leg, 0.16, 0.08, 0.24, m.belly, 0, -0.5, 0.05); // paw
    parts.legs.push({ g: leg, phase });
  }
  const head = pivot(root, 0, 0.98, 0.62);
  parts.head = head;
  box(head, 0.44, 0.4, 0.42, m.body);
  box(head, 0.28, 0.2, 0.26, m.belly, 0, -0.1, 0.3); // snout
  box(head, 0.1, 0.07, 0.04, m.dark, 0, -0.02, 0.44); // nose
  box(head, 0.2, 0.05, 0.03, 0xff8a9a, 0, -0.17, 0.4); // tongue
  sockets(head, m, 0.08, 0.22, 0.12, 0.15, 0.17);
  for (const s of [-1, 1]) {
    box(head, 0.1, 0.22, 0.1, m.body, s * 0.17, 0.3, -0.08).rotation.z = -s * 0.25;
    box(head, 0.06, 0.12, 0.06, m.dark, s * 0.17, 0.3, -0.04).rotation.z = -s * 0.25;
  }
  // collar and tag
  box(root, 0.3, 0.1, 0.3, m.accent, 0, 0.86, 0.55);
  box(root, 0.1, 0.12, 0.04, 0xffd84a, 0, 0.76, 0.7);
  // wagging tail: bone segments and a knob
  const tail = pivot(root, 0, 0.84, -0.58);
  parts.tail = tail;
  for (let i = 0; i < 3; i++) box(tail, 0.09 - i * 0.015, 0.09 - i * 0.015, 0.2, m.body, 0, i * 0.07, -0.1 - i * 0.2).rotation.x = 0.35;
  box(tail, 0.14, 0.14, 0.14, m.belly, 0, 0.26, -0.7);
  if (has(m, 'bandana')) {
    box(root, 0.36, 0.1, 0.34, m.accent, 0, 0.88, 0.55);
    const t = box(root, 0.22, 0.22, 0.05, m.accent, 0, 0.74, 0.7);
    t.rotation.z = Math.PI / 4;
  }
  if (has(m, 'spines')) {
    for (let i = 0; i < 5; i++) box(root, 0.07, 0.16, 0.07, m.belly, 0, 0.95, 0.35 - i * 0.2);
  }
}

// A fossil dinosaur skeleton on two legs, with a chomping jaw and a long tail.
function dino(root, m, parts) {
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const leg = pivot(root, s * 0.22, 0.72, -0.05);
    box(leg, 0.22, 0.7, 0.24, m.body, 0, -0.36, 0);
    box(leg, 0.28, 0.2, 0.3, m.belly, 0, -0.04, 0); // knee
    for (const dx of [-0.08, 0, 0.08]) box(leg, 0.06, 0.07, 0.2, m.belly, dx, -0.68, 0.14); // toes
    parts.legs.push({ g: leg, phase });
  }
  // body: tilted spine, ribs and a solid chest
  const trunk = pivot(root, 0, 0.9, 0);
  trunk.rotation.x = -0.18;
  box(trunk, 0.12, 0.12, 1.0, m.body, 0, 0.18, 0);
  box(trunk, 0.34, 0.26, 0.7, m.dark, 0, -0.02, 0.05);
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) box(trunk, 0.05, 0.4, 0.07, m.belly, s * 0.19, 0.0, 0.3 - i * 0.2);
  }
  box(trunk, 0.4, 0.22, 0.28, m.body, 0, 0.0, -0.4); // hips
  // two tiny arms
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(root, s * 0.24, 1.0, 0.36);
    box(arm, 0.08, 0.24, 0.08, m.body, 0, -0.1, 0.04).rotation.x = -0.3;
    for (const dx of [-0.03, 0.03]) box(arm, 0.03, 0.08, 0.03, m.belly, dx, -0.24, 0.1);
    parts.arms.push({ g: arm, phase });
  }
  // neck and the big friendly skull
  box(root, 0.22, 0.4, 0.22, m.body, 0, 1.2, 0.5).rotation.x = 0.35;
  const head = pivot(root, 0, 1.45, 0.62);
  parts.head = head;
  box(head, 0.42, 0.34, 0.5, m.body, 0, 0.03, 0.05);
  box(head, 0.34, 0.2, 0.34, m.body, 0, -0.02, 0.4);
  sockets(head, m, 0.1, 0.2, 0.14, 0.14, 0.14);
  box(head, 0.06, 0.05, 0.03, m.dark, -0.07, 0.03, 0.58);
  box(head, 0.06, 0.05, 0.03, m.dark, 0.07, 0.03, 0.58);
  for (const x of [-0.12, 0, 0.12]) box(head, 0.06, 0.07, 0.05, 0xffffff, x, -0.14, 0.55);
  const jaw = pivot(head, 0, -0.16, 0.12);
  box(jaw, 0.3, 0.08, 0.5, m.belly, 0, -0.02, 0.22);
  for (const x of [-0.1, 0.1]) box(jaw, 0.06, 0.07, 0.05, 0xffffff, x, 0.04, 0.46);
  swing(parts, jaw, 'x', 0.18, 2.2);
  // long tail
  const tail = pivot(root, 0, 0.88, -0.5);
  parts.tail = tail;
  for (let i = 0; i < 5; i++) {
    const w = 0.24 - i * 0.04;
    box(tail, w, w * 0.8, 0.32, i % 2 ? m.belly : m.body, 0, -i * 0.05, -0.16 - i * 0.3);
  }
  if (has(m, 'shell')) {
    for (const [x, y, h] of [[-0.18, 0.3, 0.16], [0, 0.32, 0.24], [0.18, 0.3, 0.14]]) box(head, 0.14, h, 0.14, 0xffffff, x, y, -0.02);
    box(head, 0.44, 0.08, 0.38, 0xffffff, 0, 0.22, 0);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      box(root, 0.18, k % 2 ? 0.2 : 0.3, 0.1, 0xffffff, Math.cos(a) * 0.5, 0.2 + (k % 2 ? 0 : 0.05), Math.sin(a) * 0.45 - 0.05).rotation.y = -a;
    }
  }
  if (has(m, 'plates')) {
    for (let i = 0; i < 4; i++) {
      const pl = box(trunk, 0.1, 0.3 - Math.abs(i - 1.2) * 0.04, 0.2, m.accent, 0, 0.38, 0.3 - i * 0.28);
      pl.rotation.z = i % 2 ? 0.2 : -0.2;
    }
    for (let i = 0; i < 4; i++) box(tail, 0.07, 0.15 - i * 0.025, 0.18, m.accent, 0, 0.1 - i * 0.05, -0.2 - i * 0.3);
  }
}

// A cute flying saucer with a pilot in a glass bubble.
function ufo(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  disc(body, 0.36, 0.12, m.dark, 0, 0.34, 0);
  disc(body, 0.5, 0.14, m.body, 0, 0.46, 0);
  box(body, 0.5, 0.05, 0.5, m.dark, 0, 0.55, 0);
  const ring = pivot(body, 0, 0.46, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    glow(box(ring, 0.1, 0.09, 0.1, m.accent, Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52), m.accent);
  }
  spin(parts, ring, 'y', 2);
  // the pilot
  const pilot = pivot(body, 0, 0.68, 0);
  box(pilot, 0.22, 0.2, 0.2, m.belly, 0, 0, 0);
  box(pilot, 0.18, 0.12, 0.16, m.belly, 0, -0.14, 0);
  eyes(pilot, 0.02, 0.105, 0.06, 0.08);
  box(pilot, 0.07, 0.025, 0.02, 0x2a2a2a, 0, -0.07, 0.105);
  for (const s of [-1, 1]) {
    box(pilot, 0.025, 0.12, 0.025, m.belly, s * 0.07, 0.15, 0);
    glow(box(pilot, 0.06, 0.06, 0.06, m.accent, s * 0.07, 0.22, 0), m.accent);
  }
  swing(parts, pilot, 'z', 0.1, 2);
  // glass bubble
  for (const [w, h, y] of [[0.52, 0.3, 0.7], [0.36, 0.1, 0.9]]) {
    const g = box(body, w, h, w, 0xcfeeff, 0, y, 0);
    g.material.transparent = true;
    g.material.opacity = 0.42;
    g.material.depthWrite = false;
  }
  // landing legs
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    const hold = pivot(body, 0, 0.3, 0);
    hold.rotation.y = a;
    box(hold, 0.06, 0.22, 0.06, m.dark, 0, -0.06, 0.28).rotation.x = 0.3;
    box(hold, 0.14, 0.04, 0.14, m.dark, 0, -0.18, 0.33);
  }
  if (has(m, 'beam')) {
    for (const [w, y, op] of [[0.5, 0.18, 0.4], [0.72, -0.02, 0.32], [0.94, -0.22, 0.24]]) {
      const b = glow(box(body, w, 0.2, w, m.accent, 0, y, 0), m.accent);
      b.material.transparent = true;
      b.material.opacity = op;
      b.material.depthWrite = false;
    }
  }
  if (has(m, 'fins')) {
    for (const s of [-1, 1]) {
      box(body, 0.06, 0.34, 0.3, m.accent, s * 0.22, 0.58, -0.5).rotation.z = s * 0.25;
    }
    box(body, 0.1, 0.1, 0.18, m.accent, 0, 0.5, -0.56);
  }
}

// A small three-eyed visitor from space.
function visitor(root, m, parts) {
  parts.legs = [];
  for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
    const leg = pivot(root, s * 0.12, 0.34, 0);
    box(leg, 0.14, 0.34, 0.16, m.dark, 0, -0.17, 0);
    box(leg, 0.18, 0.07, 0.26, m.dark, 0, -0.32, 0.05);
    parts.legs.push({ g: leg, phase });
  }
  box(root, 0.4, 0.4, 0.3, m.body, 0, 0.54, 0);
  box(root, 0.3, 0.26, 0.04, m.belly, 0, 0.56, 0.16);
  box(root, 0.42, 0.07, 0.32, m.accent, 0, 0.42, 0);
  glow(box(root, 0.1, 0.1, 0.04, m.accent, 0, 0.58, 0.19), m.accent); // badge
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(root, s * 0.27, 0.7, 0);
    box(arm, 0.1, 0.32, 0.12, m.body, 0, -0.14, 0);
    for (const dx of [-0.035, 0, 0.035]) box(arm, 0.03, 0.1, 0.04, m.body, dx, -0.34, 0.02);
    if (s === 1 && has(m, 'raygun')) {
      box(arm, 0.1, 0.12, 0.3, m.dark, 0, -0.3, 0.18);
      glow(box(arm, 0.12, 0.12, 0.12, 0xbfefff, 0, -0.3, 0.38), 0xbfefff);
    }
    parts.arms.push({ g: arm, phase });
  }
  if (has(m, 'cape')) {
    box(root, 0.46, 0.6, 0.05, m.accent, 0, 0.5, -0.19);
    box(root, 0.5, 0.1, 0.32, m.accent, 0, 0.78, -0.02);
  }
  const head = pivot(root, 0, 1.08, 0);
  parts.head = head;
  box(head, 0.62, 0.5, 0.5, m.body);
  box(head, 0.5, 0.18, 0.04, m.belly, 0, -0.16, 0.26);
  for (const s of [-1, 1]) {
    box(head, 0.14, 0.16, 0.04, 0xffffff, s * 0.17, 0.0, 0.26).userData.eye = true;
    box(head, 0.08, 0.1, 0.03, 0x111111, s * 0.17 + s * 0.01, -0.01, 0.285).userData.eye = true;
  }
  box(head, 0.14, 0.16, 0.04, 0xffffff, 0, 0.14, 0.26).userData.eye = true; // the third eye
  box(head, 0.08, 0.1, 0.03, 0x111111, 0, 0.14, 0.285).userData.eye = true;
  box(head, 0.2, 0.04, 0.03, 0x2a2a2a, 0, -0.14, 0.285);
  box(head, 0.05, 0.04, 0.03, 0x2a2a2a, -0.12, -0.12, 0.285);
  box(head, 0.05, 0.04, 0.03, 0x2a2a2a, 0.12, -0.12, 0.285);
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const ant = pivot(head, s * 0.18, 0.25, 0);
    box(ant, 0.04, 0.3, 0.04, m.dark, 0, 0.15, 0);
    glow(box(ant, 0.12, 0.12, 0.12, m.accent, 0, 0.34, 0), m.accent);
    swing(parts, ant, 'z', 0.25, 3, phase);
  }
  if (has(m, 'helmet')) {
    const g = box(head, 0.78, 0.7, 0.7, 0xcfeeff, 0, 0.05, 0);
    g.material.transparent = true;
    g.material.opacity = 0.28;
    g.material.depthWrite = false;
    box(head, 0.82, 0.06, 0.74, m.accent, 0, -0.3, 0);
  }
}

// A wobbly space pod standing on three legs, with eyes on stalks.
function tripod(root, m, parts) {
  const long = has(m, 'long');
  const len = long ? 1.0 : 0.32;
  const tilt = -0.5;
  const hipY = len * Math.cos(-tilt) + 0.04;
  const podY = hipY + (long ? 0.3 : 0.26);
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.legs = [];
  for (let k = 0; k < 3; k++) {
    const hold = pivot(body, 0, hipY, 0);
    hold.rotation.y = (k / 3) * Math.PI * 2;
    const hip = pivot(hold, 0, 0, 0.08);
    const shin = pivot(hip, 0, 0, 0);
    shin.rotation.x = tilt;
    box(shin, 0.1, len, 0.1, m.dark, 0, -len / 2, 0);
    box(shin, 0.18, 0.06, 0.24, m.dark, 0, -len, 0.05);
    if (long) box(shin, 0.16, 0.12, 0.16, m.accent, 0, -len * 0.5, 0);
    parts.legs.push({ g: hip, phase: k * 2.1 });
  }
  // pod with glowing spots
  const r = long ? 0.3 : 0.34;
  ball(body, r, m.body, 0, podY, 0);
  box(body, r * 1.4, 0.07, r * 1.4, m.dark, 0, podY - r * 0.9, 0);
  for (const [x, y] of [[-0.45, 0.35], [0.4, 0.5], [0.0, 0.1], [-0.5, -0.2], [0.5, -0.1]]) {
    glow(box(body, 0.1, 0.1, 0.04, m.accent, x * r, podY + y * r, r + 0.01), m.accent);
  }
  for (const s of [-1, 1]) for (const [y, z] of [[0.3, 0.1], [-0.25, -0.2]]) glow(box(body, 0.04, 0.1, 0.1, m.accent, s * (r + 0.01), podY + y * r, z * r), m.accent);
  box(body, 0.24, 0.04, 0.03, 0x2a2a2a, 0, podY - r * 0.5, r + 0.01); // smile
  box(body, 0.05, 0.04, 0.03, 0x2a2a2a, -0.13, podY - r * 0.42, r + 0.01);
  box(body, 0.05, 0.04, 0.03, 0x2a2a2a, 0.13, podY - r * 0.42, r + 0.01);
  // two eye stalks
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const st = pivot(body, s * 0.13, podY + r * 0.85, 0);
    box(st, 0.04, 0.3, 0.04, m.belly, 0, 0.15, 0);
    box(st, 0.17, 0.18, 0.04, 0xffffff, 0, 0.36, 0.06).userData.eye = true;
    box(st, 0.09, 0.11, 0.03, 0x111111, 0, 0.36, 0.09).userData.eye = true;
    box(st, 0.17, 0.18, 0.12, m.belly, 0, 0.36, -0.04);
    swing(parts, st, 'z', 0.25, 2.5, phase);
  }
  if (long) {
    box(body, 0.03, 0.2, 0.03, m.dark, 0, podY + r + 0.1, -0.1);
    glow(box(body, 0.09, 0.09, 0.09, m.accent, 0, podY + r + 0.24, -0.1), m.accent);
  }
}

/* ==== T4b group A shapes ==== */
const SHAPES_A = {};
/* ==== end of T4b group A shapes ==== */

/* ==== T4b group B shapes ==== */
const SHAPES_B = {};
/* ==== end of T4b group B shapes ==== */

/* ==== T4b group C shapes ==== */
// A drake made of fluffy cloud puffs, with whiskers and a lightning tail tip.
function nimbus(root, m, parts) {
  const b = pivot(root, 0, 0, 0);
  parts.bounce = b;
  parts.hover = true;
  const head = pivot(b, 0, 0.62, 0.62);
  parts.head = head;
  box(head, 0.36, 0.3, 0.4, m.body);
  box(head, 0.26, 0.16, 0.22, m.body, 0, -0.06, 0.28);
  box(head, 0.2, 0.03, 0.04, m.dark, 0, -0.12, 0.38);
  box(head, 0.1, 0.06, 0.03, 0xffa0a8, -0.16, -0.05, 0.2);
  box(head, 0.1, 0.06, 0.03, 0xffa0a8, 0.16, -0.05, 0.2);
  eyes(head, 0.05, 0.205, 0.1, 0.1);
  for (const s of [-1, 1]) {
    box(head, 0.07, 0.26, 0.07, m.dark, s * 0.13, 0.22, -0.1).rotation.x = -0.7;
    const wh = pivot(head, s * 0.14, -0.06, 0.1);
    box(wh, 0.04, 0.04, 0.4, m.accent, s * 0.12, 0, -0.1).rotation.y = s * -0.3;
    glow(box(wh, 0.07, 0.07, 0.07, m.accent, s * 0.17, 0, -0.3), m.accent);
    swing(parts, wh, 'y', 0.3, 2.5, s);
  }
  parts.segments = [];
  for (let i = 1; i <= 6; i++) {
    const r = 0.34 - i * 0.027;
    const seg = pivot(b, 0, 0.5 + Math.sin(i * 0.9) * 0.09, 0.4 - i * 0.26);
    ball(seg, r, i % 2 ? m.body : m.belly);
    ball(seg, r * 0.6, m.body, r * 0.8, r * 0.2, 0.04);
    ball(seg, r * 0.55, m.belly, -r * 0.8, -r * 0.1, -0.04);
    if (i === 2 || i === 4) ball(seg, r * 0.45, m.dark, 0, -r * 0.8, 0);
    parts.segments.push({ g: seg, i, x0: 0 });
  }
  for (const [z, ph] of [[0.25, 0], [-0.55, 1]]) for (const s of [-1, 1]) {
    const paw = ball(b, 0.1, m.body, s * 0.2, 0.2, z);
    swing(parts, paw, 'x', 0.2, 3, ph + s);
  }
  const tip = pivot(b, 0, 0.42, -1.2);
  parts.tail = tip;
  const bolt = [[0, 0, 0, 0.1, 0.22, 0.08], [0, 0.13, -0.07, 0.1, 0.08, 0.22], [0, 0.25, -0.15, 0.1, 0.22, 0.08]];
  bolt.forEach(([x, y, z, w, h, d], k) => {
    const bx = glow(box(tip, w, h, d, m.accent, x, y, z - 0.1), m.accent);
    if (k === 0) parts.tip = bx;
  });
}

// A lizard with turret eyes and a curled tail; the whole body slowly changes colour.
function chameleon(root, m, parts) {
  const bodyG = pivot(root, 0, 0, 0);
  box(bodyG, 0.36, 0.4, 0.7, m.body, 0, 0.5, 0);
  box(bodyG, 0.3, 0.2, 0.5, m.belly, 0, 0.36, 0.04);
  box(bodyG, 0.1, 0.1, 0.12, m.accent, 0.19, 0.55, 0.05);
  box(bodyG, 0.1, 0.1, 0.12, m.accent, -0.19, 0.5, -0.12);
  for (let i = 0; i < 5; i++) box(bodyG, 0.06, 0.1 + (i % 2) * 0.05, 0.1, m.belly, 0, 0.74 + (i % 2) * 0.02, 0.26 - i * 0.14);
  const head = pivot(root, 0, 0.68, 0.4);
  parts.head = head;
  box(head, 0.3, 0.28, 0.36, m.body, 0, 0, 0.1);
  box(head, 0.16, 0.14, 0.34, m.belly, 0, 0.17, -0.02).rotation.x = 0.2;
  box(head, 0.22, 0.1, 0.1, m.belly, 0, -0.06, 0.3);
  box(head, 0.16, 0.03, 0.03, 0x2a2a2a, 0, -0.07, 0.355).userData.eye = true;
  for (const s of [-1, 1]) box(head, 0.05, 0.04, 0.03, 0x2a2a2a, s * 0.09, -0.04, 0.355).userData.eye = true;
  const eyeSpeed = [1.3, 1.9];
  [-1, 1].forEach((s, k) => {
    const e = pivot(head, s * 0.18, 0.08, 0.14);
    const eb = ball(e, 0.09, 0xf4f0d0, s * 0.03, 0, 0.02);
    eb.children.forEach(c => { c.userData.eye = true; });
    box(e, 0.06, 0.07, 0.03, 0x111111, s * 0.03, 0, 0.11).userData.eye = true;
    swing(parts, e, 'y', 0.5, eyeSpeed[k], k * 2);
  });
  parts.legs = [];
  for (const [sx, z, ph] of [[-1, 0.22, 0], [1, 0.22, Math.PI], [-1, -0.22, Math.PI], [1, -0.22, 0]]) {
    const leg = pivot(root, sx * 0.22, 0.4, z);
    box(leg, 0.1, 0.24, 0.12, m.body, sx * 0.03, -0.1, 0);
    box(leg, 0.2, 0.06, 0.16, m.dark, sx * 0.02, -0.24, 0.03);
    parts.legs.push({ g: leg, phase: ph });
  }
  const tail = pivot(root, 0, 0.5, -0.35);
  parts.tail = tail;
  const cy = -0.12, cz = -0.28;
  for (let k = 0; k < 8; k++) {
    const rad = 0.3 - k * 0.028, phi = 1.2 + k * 0.85, sz = 0.14 - k * 0.012;
    box(tail, sz, sz, sz * 1.2, k % 3 === 2 ? m.accent : m.body, 0, cy + Math.cos(phi) * rad, cz + Math.sin(phi) * rad).rotation.x = -phi + 1.57;
  }
  parts.rainbow = [];
  root.traverse(o => {
    if (!o.isMesh || o.userData.eye) return;
    const c = o.material.color.getHex();
    const offset = (c === m.belly || c === m.accent) ? 0.36 : 0.30;
    parts.rainbow.push({ mat: o.material, offset });
    o.material.color.setHSL(offset, 0.75, 0.62);
  });
}

// A soft dark puff with a glowing galaxy swirl behind it.
function blackhole(root, m, parts) {
  const b = pivot(root, 0, 0, 0);
  parts.bounce = b;
  parts.hover = true;
  const sw = pivot(b, 0, 0.55, -0.3);
  spin(parts, sw, 'z', 1.5);
  for (let arm = 0; arm < 3; arm++) for (let j = 0; j < 4; j++) {
    const a = arm * 2.094 + j * 0.6, r = 0.32 + j * 0.17, sz = 0.17 - j * 0.03;
    glow(box(sw, sz, sz, 0.06, m.accent, Math.cos(a) * r, Math.sin(a) * r, 0), m.accent);
  }
  const sp = pivot(b, 0, 0.55, -0.2);
  spin(parts, sp, 'z', 3);
  for (let k = 0; k < 4; k++) {
    const r = 0.5 + (k % 2) * 0.2;
    glow(box(sp, 0.06, 0.06, 0.06, 0xffffff, Math.cos(k * 1.57 + 0.5) * r, Math.sin(k * 1.57 + 0.5) * r, 0), 0xffffff);
  }
  ball(b, 0.32, m.body, 0, 0.55, 0);
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05;
    box(b, 0.12, 0.12, 0.12, m.belly, Math.cos(a) * 0.34, 0.55 + Math.sin(a) * 0.34, -0.05);
  }
  const face = pivot(b, 0, 0.55, 0);
  parts.head = face;
  box(face, 0.5, 0.3, 0.04, m.belly, 0, -0.02, 0.29);
  eyes(face, 0.05, 0.32, 0.14, 0.17);
  for (const s of [-1, 1]) box(face, 0.05, 0.05, 0.03, 0xffffff, s * 0.14 + 0.02, 0.1, 0.35).userData.eye = true;
  box(face, 0.08, 0.08, 0.03, m.dark, 0, -0.12, 0.33);
}

// A crab with a jukebox for a shell, a spinning record and snapping claws.
function jukebox(root, m, parts) {
  const b = pivot(root, 0, 0, 0);
  box(b, 0.7, 0.5, 0.45, m.body, 0, 0.5, 0);
  box(b, 0.56, 0.16, 0.45, m.body, 0, 0.83, 0);
  box(b, 0.4, 0.14, 0.45, m.body, 0, 0.97, 0);
  glow(box(b, 0.62, 0.05, 0.03, m.accent, 0, 0.66, 0.235), m.accent);
  glow(box(b, 0.5, 0.05, 0.03, 0xff6ad8, 0, 0.82, 0.235), 0xff6ad8);
  glow(box(b, 0.36, 0.05, 0.03, 0xffe060, 0, 0.97, 0.235), 0xffe060);
  box(b, 0.5, 0.26, 0.03, m.belly, 0, 0.44, 0.235);
  for (let i = -2; i <= 2; i++) box(b, 0.03, 0.1, 0.03, m.dark, i * 0.09, 0.5, 0.25);
  box(b, 0.14, 0.03, 0.03, m.dark, 0, 0.35, 0.25);
  for (const s of [-1, 1]) box(b, 0.04, 0.05, 0.03, m.dark, s * 0.09, 0.37, 0.25);
  const rec = pivot(b, 0, 1.06, 0);
  spin(parts, rec, 'y', 3);
  box(rec, 0.36, 0.04, 0.26, 0x2a2a30);
  box(rec, 0.26, 0.04, 0.36, 0x2a2a30);
  box(rec, 0.28, 0.04, 0.28, 0x2a2a30).rotation.y = Math.PI / 4;
  glow(box(rec, 0.12, 0.06, 0.12, m.accent, 0, 0.01, 0), m.accent);
  for (const s of [-1, 1]) {
    const st = pivot(b, s * 0.3, 0.9, 0.08);
    box(st, 0.05, 0.3, 0.05, m.dark, 0, 0.15, 0);
    box(st, 0.16, 0.16, 0.16, 0xf4f0d0, 0, 0.34, 0.02).userData.eye = true;
    box(st, 0.08, 0.1, 0.03, 0x111111, s * 0.01, 0.34, 0.11).userData.eye = true;
    swing(parts, st, 'z', 0.12, 2, s);
  }
  parts.arms = [];
  for (const [s, ph] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(b, s * 0.42, 0.5, 0.1);
    box(arm, 0.09, 0.09, 0.3, m.body, s * 0.04, 0, 0.15).rotation.y = s * -0.2;
    const claw = pivot(arm, s * 0.1, 0, 0.32);
    box(claw, 0.14, 0.07, 0.22, m.dark, 0, -0.05, 0.1);
    const up = pivot(claw, 0, 0, 0);
    box(up, 0.14, 0.07, 0.22, m.body, 0, 0.04, 0.1);
    swing(parts, up, 'x', 0.3, 4, ph);
    parts.arms.push({ g: arm, phase: ph });
  }
  parts.legs = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const leg = pivot(b, s * 0.33, 0.26, -0.14 + k * 0.14);
    box(leg, 0.22, 0.05, 0.05, m.dark, s * 0.11, -0.05, 0).rotation.z = -s * 0.4;
    box(leg, 0.05, 0.16, 0.05, m.dark, s * 0.23, -0.15, 0);
    parts.legs.push({ g: leg, phase: (k % 2) * Math.PI, side: true });
  }
}

// A friendly fish skeleton with a skull face, ribs and a V tail.
function fishbone(root, m, parts) {
  const b = pivot(root, 0, 0, 0);
  parts.bounce = b;
  parts.hover = true;
  const head = pivot(b, 0, 0.5, 0.62);
  parts.head = head;
  box(head, 0.34, 0.3, 0.32, m.body);
  box(head, 0.24, 0.14, 0.2, m.body, 0, -0.07, 0.24);
  sockets(head, m, 0.04, 0.165, 0.1, 0.12, 0.13);
  box(head, 0.22, 0.03, 0.04, m.dark, 0, -0.12, 0.35);
  for (const x of [-0.08, 0, 0.08]) box(head, 0.05, 0.06, 0.04, 0xffffff, x, -0.09, 0.355);
  box(head, 0.2, 0.08, 0.2, m.belly, 0, -0.17, 0.2);
  parts.segments = [];
  for (let i = 1; i <= 5; i++) {
    const v = pivot(b, 0, 0.5, 0.34 - i * 0.24);
    box(v, 0.1, 0.1, 0.14, m.body);
    const f = 1 - i * 0.13;
    for (const s of [-1, 1]) {
      box(v, 0.04, 0.16 * f, 0.04, m.body, s * 0.09 * f, -0.08 * f, 0).rotation.z = s * 0.5;
      box(v, 0.04, 0.16 * f, 0.04, m.belly, s * 0.17 * f, -0.22 * f, 0).rotation.z = -s * 0.3;
    }
    if (i <= 4) box(v, 0.03, 0.18, 0.05, m.belly, 0, 0.14, 0).rotation.x = -0.3;
    parts.segments.push({ g: v, i, x0: 0 });
  }
  const tail = pivot(b, 0, 0.5, -0.95);
  parts.tail = tail;
  for (const s of [-1, 1]) {
    box(tail, 0.03, 0.3, 0.04, m.body, 0, s * 0.15, -0.08).rotation.x = s * 0.5;
    box(tail, 0.03, 0.18, 0.03, m.belly, 0, s * 0.08, -0.04).rotation.x = s * 0.9;
  }
}

// A glass ball with crossing bands that rolls, and a one-eyed alien hamster inside.
function zorb(root, m, parts) {
  const b = pivot(root, 0, 0, 0);
  parts.bounce = b;
  const al = pivot(b, 0, 0.4, 0);
  ball(al, 0.2, m.body, 0, 0.02, 0);
  box(al, 0.2, 0.2, 0.04, m.belly, 0, -0.04, 0.17);
  box(al, 0.17, 0.19, 0.04, 0xffffff, 0, 0.04, 0.19).userData.eye = true;
  box(al, 0.09, 0.11, 0.03, 0x111111, 0, 0.04, 0.22).userData.eye = true;
  box(al, 0.04, 0.04, 0.03, 0xffffff, 0.02, 0.07, 0.235).userData.eye = true;
  box(al, 0.1, 0.03, 0.03, m.dark, 0, -0.08, 0.2);
  parts.legs = [];
  for (const [s, ph] of [[-1, 0], [1, Math.PI]]) {
    const an = pivot(al, s * 0.1, 0.17, 0);
    box(an, 0.03, 0.17, 0.03, m.dark, 0, 0.08, 0);
    glow(box(an, 0.07, 0.07, 0.07, m.accent, 0, 0.19, 0), m.accent);
    swing(parts, an, 'z', 0.35, 3, ph);
    const lg = pivot(al, s * 0.08, -0.15, 0.02);
    box(lg, 0.07, 0.1, 0.09, m.dark, 0, -0.04, 0.02);
    parts.legs.push({ g: lg, phase: ph });
  }
  const shell = ball(b, 0.43, m.belly, 0, 0.45, 0);
  const band = pivot(b, 0, 0.45, 0);
  spin(parts, band, 'x', 2);
  for (const rz of [0, Math.PI / 2]) {
    const ring = pivot(band, 0, 0, 0);
    ring.rotation.z = rz;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, r = 0.43;
      const bd = glow(box(ring, 0.06, 0.07, 0.33, m.accent, 0, Math.cos(a) * r, Math.sin(a) * r), m.accent);
      bd.rotation.x = a;
    }
  }
  shell.children.forEach(c => { c.material.transparent = true; c.material.opacity = 0.22; c.material.depthWrite = false; });
}

const SHAPES_C = { nimbus, chameleon, blackhole, jukebox, fishbone, zorb };
/* ==== end of T4b group C shapes ==== */

export const SHAPES = {
  skull, bonedog, dino, ufo, visitor, tripod,
  guardian, butterfly, moth, star, robe, hopper, planet, comet, cloud, tall, squid, bat, drum, ape, bell, armadillo, wyvern, fish, nut, drone, wisp, puff, crystal,
  ...SHAPES_A, ...SHAPES_B, ...SHAPES_C,
};
