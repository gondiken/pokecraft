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
// See-through material helper for the glass and jelly parts.
function seeThroughA(mesh, opacity) {
  mesh.material.transparent = true;
  mesh.material.opacity = opacity;
  mesh.material.depthWrite = false;
  return mesh;
}

// A see-through ball (the three crossed boxes of `ball`).
function glassBallA(parent, r, color, opacity, x, y, z) {
  const g = ball(parent, r, color, x, y, z);
  box(g, r * 1.9, r * 1.6, r * 1.9, color).rotation.y = Math.PI / 4;
  box(g, r * 1.6, r * 1.9, r * 1.6, color).rotation.y = Math.PI / 4;
  g.children.forEach(c => seeThroughA(c, opacity));
  return g;
}

// Little dashes around a rectangle on a front face: stitches.
function stitchA(parent, cx, cy, z, w, h, color) {
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) box(parent, 0.05, 0.015, 0.012, color, cx + (k - 1) * w * 0.3, cy + s * h / 2, z);
    for (let k = 0; k < 2; k++) box(parent, 0.015, 0.05, 0.012, color, cx + s * w / 2, cy + (k - 0.5) * h * 0.5, z);
  }
}

// A patchwork teddy with one floppy ear and button eyes.
function plushie(root, m, parts) {
  const fur = m.body;
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const leg = pivot(root, s * 0.16, 0.26, 0);
    box(leg, 0.2, 0.26, 0.24, fur, 0, -0.13, 0.02);
    box(leg, 0.16, 0.04, 0.12, m.belly, 0, -0.24, 0.1);
    if (s > 0) {
      box(leg, 0.21, 0.12, 0.25, m.accent, 0, -0.1, 0.02);
      stitchA(leg, 0, -0.1, 0.148, 0.2, 0.12, m.dark);
    }
    parts.legs.push({ g: leg, phase });
  }
  // body with a pink tummy patch edged in stitches
  box(root, 0.5, 0.5, 0.4, fur, 0, 0.5, 0);
  box(root, 0.3, 0.28, 0.02, m.belly, 0, 0.47, 0.205);
  stitchA(root, 0, 0.47, 0.218, 0.3, 0.28, m.dark);
  box(root, 0.03, 0.03, 0.03, m.dark, 0, 0.47, 0.22); // a button
  box(root, 0.03, 0.1, 0.07, 0xffffff, 0.26, 0.3, 0.05); // cloth tag on the hip
  box(root, 0.16, 0.16, 0.12, fur, 0, 0.34, -0.25); // round tail
  // head
  const head = pivot(root, 0, 0.78, 0);
  parts.head = head;
  box(head, 0.6, 0.5, 0.5, fur, 0, 0.25, 0);
  box(head, 0.04, 0.02, 0.5, m.dark, 0, 0.51, 0); // seam strip
  box(head, 0.2, 0.12, 0.02, m.accent, 0.17, 0.43, 0.255);
  stitchA(head, 0.17, 0.43, 0.266, 0.2, 0.12, m.dark);
  box(head, 0.26, 0.16, 0.1, 0xf6e2c0, 0, 0.17, 0.28);
  box(head, 0.1, 0.07, 0.04, m.dark, 0, 0.22, 0.33);
  for (const s of [-1, 1]) {
    // button eyes: dark square with four tiny light dots
    box(head, 0.13, 0.13, 0.03, m.dark, s * 0.16, 0.3, 0.26).userData.eye = true;
    for (const [dx, dy] of [[-0.02, -0.02], [0.02, -0.02], [-0.02, 0.02], [0.02, 0.02]]) {
      box(head, 0.025, 0.025, 0.02, 0xfff4e0, s * 0.16 + dx, 0.3 + dy, 0.28).userData.eye = true;
    }
  }
  // stitched V smile
  box(head, 0.08, 0.03, 0.03, m.dark, -0.09, 0.07, 0.26).rotation.z = -0.5;
  box(head, 0.08, 0.03, 0.03, m.dark, 0.09, 0.07, 0.26).rotation.z = 0.5;
  box(head, 0.08, 0.03, 0.03, m.dark, 0, 0.04, 0.26);
  // one upright round ear, one floppy ear
  box(head, 0.2, 0.2, 0.1, fur, 0.23, 0.56, 0);
  box(head, 0.11, 0.11, 0.04, m.belly, 0.23, 0.56, 0.05);
  const ear = pivot(head, -0.25, 0.5, 0);
  box(ear, 0.2, 0.22, 0.1, fur, -0.1, 0.0, 0);
  box(ear, 0.12, 0.12, 0.04, m.accent, -0.1, -0.02, 0.05);
  swing(parts, ear, 'z', 0.3, 2);
  // stubby arms
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(root, s * 0.32, 0.7, 0);
    box(arm, 0.16, 0.3, 0.18, fur, 0, -0.12, 0.02);
    parts.arms.push({ g: arm, phase });
  }
}

// A little candle on a brass dish, with a flickering flame.
function candle(root, m, parts) {
  // brass dish with a ring handle (stays on the ground)
  box(root, 0.8, 0.08, 0.8, 0xd0a040, 0, 0.04, 0);
  box(root, 0.7, 0.03, 0.7, 0xb08828, 0, 0.095, 0);
  box(root, 0.16, 0.03, 0.03, 0xd0a040, 0.5, 0.06, 0.1);
  box(root, 0.16, 0.03, 0.03, 0xd0a040, 0.5, 0.06, -0.1);
  box(root, 0.03, 0.03, 0.23, 0xd0a040, 0.58, 0.06, 0);
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  box(body, 0.44, 0.68, 0.44, m.body, 0, 0.45, 0);
  box(body, 0.4, 0.66, 0.4, m.body, 0, 0.45, 0).rotation.y = Math.PI / 4;
  box(body, 0.52, 0.06, 0.52, m.belly, 0, 0.8, 0); // melted lip
  box(body, 0.34, 0.02, 0.34, 0xffd890, 0, 0.835, 0);
  // drips of different lengths
  for (const [x, z, len] of [[-0.2, 0.235, 0.3], [0.2, 0.235, 0.2], [-0.235, 0.05, 0.36], [0.235, -0.08, 0.26], [0.1, -0.235, 0.32]]) {
    const side = Math.abs(x) > 0.22;
    box(body, side ? 0.05 : 0.07, len, side ? 0.08 : 0.05, m.belly, x, 0.8 - len / 2, z);
  }
  // face plate with a friendly face
  box(body, 0.3, 0.3, 0.04, 0xffe6c0, 0, 0.5, 0.31);
  eyes(body, 0.56, 0.335, 0.07, 0.09);
  for (const s of [-1, 1]) box(body, 0.07, 0.04, 0.02, 0xff9a9a, s * 0.11, 0.47, 0.335);
  box(body, 0.1, 0.035, 0.02, 0x7a3a2a, 0, 0.44, 0.335);
  // wick and flame
  box(body, 0.04, 0.14, 0.04, m.dark, 0, 0.9, 0);
  const flame = pivot(body, 0, 0.97, 0);
  parts.tip = glow(box(flame, 0.16, 0.24, 0.16, m.accent, 0, 0.12, 0), m.accent);
  glow(box(flame, 0.08, 0.14, 0.1, 0xfff6c0, 0, 0.08, 0.04), 0xfff6c0);
  glow(box(flame, 0.07, 0.1, 0.07, m.accent, 0, 0.28, 0), m.accent);
  swing(parts, flame, 'z', 0.2, 7);
}

// A flat see-through jellyfish dome with long ribbon tentacles.
function jelly(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  seeThroughA(box(body, 0.9, 0.3, 0.9, m.body, 0, 0.5, 0), 0.6);
  seeThroughA(box(body, 0.66, 0.18, 0.66, m.body, 0, 0.74, 0), 0.6);
  seeThroughA(box(body, 0.4, 0.1, 0.4, m.body, 0, 0.88, 0), 0.6);
  // glowing clover inside the dome
  for (const [x, z] of [[-0.16, 0], [0.16, 0], [0, -0.16], [0, 0.16]]) glow(box(body, 0.1, 0.1, 0.1, m.accent, x, 0.62, z), m.accent);
  // frilly rim
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    box(body, 0.17, 0.08, 0.17, m.belly, Math.sin(a) * 0.43, 0.33, Math.cos(a) * 0.43);
  }
  // face on the front of the dome
  eyes(body, 0.52, 0.46, 0.14, 0.12);
  for (const s of [-1, 1]) box(body, 0.08, 0.05, 0.02, m.accent, s * 0.26, 0.43, 0.46);
  box(body, 0.12, 0.04, 0.02, m.dark, 0, 0.42, 0.46);
  // six ribbon tentacles
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + 0.3;
    const t = pivot(body, Math.sin(a) * 0.3, 0.34, Math.cos(a) * 0.3);
    box(t, 0.1, 0.18, 0.03, m.accent, 0, -0.09, 0).rotation.y = a;
    box(t, 0.08, 0.16, 0.03, m.belly, 0, -0.26, 0).rotation.y = a;
    box(t, 0.06, 0.14, 0.03, m.accent, 0, -0.41, 0).rotation.y = a;
    glow(box(t, 0.07, 0.07, 0.07, 0xfff0ff, 0, -0.51, 0), 0xff8ad8);
    swing(parts, t, k % 2 ? 'x' : 'z', 0.4, 2.5, k);
  }
}

// A tortoise whose shell is a flowerpot with a little bonsai tree.
function bonsai(root, m, parts) {
  parts.legs = [];
  for (const [sx, sz, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
    const leg = pivot(root, sx * 0.27, 0.22, sz * 0.3);
    box(leg, 0.2, 0.22, 0.2, m.body, 0, -0.11, 0);
    box(leg, 0.2, 0.05, 0.1, 0xe8e0b0, 0, -0.2, 0.08);
    parts.legs.push({ g: leg, phase });
  }
  // flowerpot shell
  box(root, 0.8, 0.35, 0.9, m.belly, 0, 0.38, 0);
  box(root, 0.82, 0.06, 0.92, 0xa04a28, 0, 0.3, 0);
  box(root, 0.9, 0.08, 1.0, m.belly, 0, 0.59, 0);
  box(root, 0.76, 0.03, 0.86, 0x4a3020, 0, 0.64, 0);
  // head on a short neck
  const head = pivot(root, 0, 0.36, 0.5);
  parts.head = head;
  box(head, 0.18, 0.18, 0.2, m.body, 0, -0.02, -0.04);
  box(head, 0.3, 0.28, 0.32, m.body, 0, 0.04, 0.12);
  eyes(head, 0.1, 0.285, 0.08, 0.09);
  box(head, 0.1, 0.035, 0.02, m.dark, 0, -0.02, 0.285);
  for (const s of [-1, 1]) box(head, 0.06, 0.04, 0.02, 0xff9a9a, s * 0.12, 0.0, 0.285);
  const tail = pivot(root, 0, 0.3, -0.5);
  parts.tail = tail;
  box(tail, 0.1, 0.1, 0.14, m.body, 0, 0, -0.05);
  // the tree
  const tree = pivot(root, 0, 0.66, -0.05);
  box(tree, 0.1, 0.18, 0.1, m.dark, 0, 0.09, 0);
  box(tree, 0.1, 0.16, 0.1, m.dark, 0.06, 0.25, 0);
  box(tree, 0.1, 0.16, 0.1, m.dark, -0.02, 0.4, 0);
  for (const [x, y, z, w, d] of [[-0.15, 0.22, 0.04, 0.44, 0.36], [0.15, 0.38, -0.05, 0.4, 0.34], [0, 0.54, 0, 0.3, 0.28]]) {
    box(tree, w, 0.1, d, 0x4a9a3a, x, y, z);
    box(tree, w * 0.8, 0.06, d * 0.8, 0x62b84c, x, y + 0.07, z);
  }
  for (const [x, y, z] of [[-0.32, 0.26, 0.12], [0.3, 0.42, 0.08], [0.1, 0.6, 0.08], [-0.1, 0.62, -0.06]]) box(tree, 0.08, 0.08, 0.08, m.accent, x, y, z);
  swing(parts, tree, 'z', 0.06, 1.2);
}

// A firefly with a light bulb for a tail.
function bulbfly(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  const head = pivot(body, 0, 0.45, 0.4);
  parts.head = head;
  ball(head, 0.17, m.body);
  eyes(head, 0.02, 0.18, 0.09, 0.13);
  box(head, 0.09, 0.035, 0.02, m.accent, 0, -0.09, 0.18);
  for (const s of [-1, 1]) {
    const an = pivot(head, s * 0.07, 0.14, 0.05);
    an.rotation.z = -s * 0.35;
    box(an, 0.025, 0.24, 0.025, m.dark, 0, 0.12, 0);
    glow(box(an, 0.07, 0.07, 0.07, m.accent, 0, 0.26, 0), m.accent);
  }
  // thorax with a yellow stripe
  box(body, 0.28, 0.26, 0.36, m.body, 0, 0.45, 0.06);
  box(body, 0.3, 0.06, 0.12, m.accent, 0, 0.45, 0.06);
  // metal screw base
  [0.32, 0.28, 0.32].forEach((w, i) => box(body, w, w, 0.06, i === 1 ? 0x606070 : 0xd0d0e0, 0, 0.45, -0.2 - i * 0.065));
  // glass bulb with a glowing filament and blinking core
  const bulb = pivot(body, 0, 0.45, -0.66);
  glassBallA(bulb, 0.3, 0xd8ecff, 0.3, 0, 0, 0).children.forEach(c => c.material.emissive.setHex(0x303818));
  const fil = pivot(bulb, 0, -0.2, 0.08);
  zigzag(fil, m.accent, 0, 0, 0, 1.6);
  fil.children.forEach(c => glow(c, m.accent));
  parts.tip = glow(box(bulb, 0.16, 0.16, 0.16, 0xfff8a0, 0, 0.1, -0.02), 0xfff8a0);
  // two pairs of pale wings
  addWings(parts, body, m, 0.14, 0.6, 0.16, 0.5, 0.26, 0xc8d4ea, 0xe8f0ff, { lift: 0.3 });
  addWings(parts, body, m, 0.12, 0.6, -0.02, 0.4, 0.22, 0xc8d4ea, 0xe8f0ff, { lift: 0.3 });
  // six tiny legs
  for (const s of [-1, 1]) for (const z of [0.18, 0.06, -0.06]) {
    const lg = box(body, 0.03, 0.2, 0.03, m.body, s * 0.13, 0.3, z);
    lg.rotation.z = s * 0.4;
  }
}

// A rock that opens like a clam to show glowing purple crystals.
function geode(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const leg = pivot(body, s * 0.22, 0.12, 0.15);
    box(leg, 0.2, 0.12, 0.24, m.dark, 0, -0.06, 0.02);
    parts.legs.push({ g: leg, phase });
  }
  // lower half
  box(body, 0.72, 0.2, 0.72, m.body, 0, 0.2, 0);
  box(body, 0.8, 0.18, 0.8, m.body, 0, 0.36, 0);
  box(body, 0.2, 0.15, 0.2, 0xa89888, -0.3, 0.22, 0.3);
  box(body, 0.18, 0.2, 0.18, m.dark, 0.32, 0.3, -0.3);
  box(body, 0.14, 0.1, 0.14, 0xb8a898, 0.28, 0.2, 0.34);
  box(body, 0.7, 0.04, 0.7, m.belly, 0, 0.46, 0);
  eyes(body, 0.38, 0.405, 0.14, 0.11);
  box(body, 0.14, 0.04, 0.02, m.dark, 0, 0.29, 0.405);
  for (const s of [-1, 1]) box(body, 0.07, 0.04, 0.02, 0xd09090, s * 0.27, 0.31, 0.405);
  // crystals on the floor
  [[-0.22, -0.1, 0.4, 0.2], [-0.1, 0.1, 0.3, -0.15], [0.12, 0, 0.46, 0.1], [0.25, 0.15, 0.28, -0.3], [0.2, -0.2, 0.36, 0.25], [-0.2, 0.2, 0.22, 0.3], [0, -0.22, 0.38, -0.1]].forEach(([x, z, h, tilt]) => {
    const c = glow(box(body, 0.11, h, 0.11, m.accent, x, 0.47 + h / 2 - 0.02, z), m.accent);
    c.rotation.z = tilt;
  });
  // the lid, hinged at the back
  const hinge = pivot(body, 0, 0.45, -0.4);
  hinge.rotation.x = -0.5;
  const lid = pivot(hinge, 0, 0, 0);
  swing(parts, lid, 'x', 0.2, 1.5);
  box(lid, 0.8, 0.16, 0.8, m.body, 0, 0.08, 0.4);
  box(lid, 0.68, 0.14, 0.68, m.body, 0, 0.23, 0.4);
  box(lid, 0.46, 0.1, 0.46, m.body, 0, 0.35, 0.4);
  box(lid, 0.2, 0.14, 0.2, 0xa89888, 0.22, 0.3, 0.3);
  box(lid, 0.22, 0.16, 0.2, m.dark, -0.25, 0.26, 0.55);
  box(lid, 0.7, 0.03, 0.7, m.belly, 0, 0.0, 0.4);
  [[-0.22, 0.25, 0.2, 0.2], [0, 0.35, 0.26, -0.15], [0.22, 0.25, 0.2, 0.25], [-0.1, 0.6, 0.16, 0.1], [0.12, 0.55, 0.18, -0.2], [0.0, 0.2, 0.14, 0.3]].forEach(([x, z, h, tilt]) => {
    const c = glow(box(lid, 0.1, h, 0.1, m.accent, x, -h / 2 + 0.01, z), m.accent);
    c.rotation.z = tilt;
  });
}

// A hopping snow globe with a face on its wooden base.
function globe(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const leg = pivot(body, s * 0.2, 0.11, 0.05);
    box(leg, 0.16, 0.11, 0.2, m.dark, 0, -0.055, 0.02);
    parts.legs.push({ g: leg, phase });
  }
  box(body, 0.78, 0.12, 0.78, m.body, 0, 0.16, 0);
  box(body, 0.66, 0.18, 0.66, m.body, 0, 0.31, 0);
  box(body, 0.7, 0.05, 0.7, 0xd8b040, 0, 0.43, 0);
  box(body, 0.8, 0.03, 0.8, 0xd8b040, 0, 0.1, 0);
  eyes(body, 0.32, 0.335, 0.14, 0.1);
  for (const s of [-1, 1]) box(body, 0.08, 0.05, 0.02, 0xff9a9a, s * 0.25, 0.25, 0.335);
  box(body, 0.12, 0.04, 0.02, 0xf6e6d0, 0, 0.24, 0.335);
  // the glass ball with a snowy scene inside
  box(body, 0.56, 0.12, 0.56, 0xe6f2ff, 0, 0.52, 0);
  box(body, 0.06, 0.1, 0.06, 0x6a4a2a, 0, 0.63, 0);
  box(body, 0.28, 0.12, 0.28, 0x2f8a4a, 0, 0.7, 0);
  box(body, 0.2, 0.12, 0.2, 0x2f8a4a, 0, 0.81, 0);
  box(body, 0.1, 0.1, 0.1, 0x2f8a4a, 0, 0.91, 0);
  box(body, 0.07, 0.05, 0.07, 0xffffff, 0, 0.98, 0);
  glassBallA(body, 0.42, 0xbfe4ff, 0.2, 0, 0.88, 0);
  const snow = pivot(body, 0, 0.88, 0);
  for (let k = 0; k < 10; k++) {
    const a = k * 2.4, r = 0.16 + (k % 4) * 0.05;
    box(snow, 0.05, 0.05, 0.05, 0xdaeeff, Math.cos(a) * r, -0.2 + (k * 0.047) % 0.5, Math.sin(a) * r);
  }
  spin(parts, snow, 'y', 1.2);
}

const SHAPES_A = { plushie, candle, jelly, bonsai, bulbfly, geode, globe };
/* ==== end of T4b group A shapes ==== */

/* ==== T4b group B shapes ==== */
const seeB = (mesh, opacity) => { mesh.material.transparent = true; mesh.material.opacity = opacity; mesh.material.depthWrite = false; return mesh; };

// A snail: soft foot, two wiggly eye stalks and a swirly shell on its back.
function snail(root, m, parts) {
  box(root, 0.36, 0.14, 0.7, m.body, 0, 0.07, -0.15);
  box(root, 0.26, 0.1, 0.25, m.body, 0, 0.05, -0.6);
  box(root, 0.14, 0.07, 0.2, m.body, 0, 0.04, -0.78);
  box(root, 0.3, 0.03, 0.9, m.belly, 0, 0.015, -0.1);
  const front = pivot(root, 0, 0.07, 0.2);
  box(front, 0.36, 0.14, 0.3, m.body, 0, 0, 0.12);
  swing(parts, front, 'x', 0.08, 3);
  box(root, 0.26, 0.4, 0.26, m.body, 0, 0.3, 0.38);
  const head = pivot(root, 0, 0.5, 0.4);
  parts.head = head;
  box(head, 0.32, 0.26, 0.3, m.body, 0, 0.06, 0.02);
  box(head, 0.2, 0.12, 0.04, m.belly, 0, -0.02, 0.17);
  eyes(head, 0.1, 0.18, 0.09, 0.1);
  box(head, 0.14, 0.04, 0.03, 0x2a2a2a, 0, -0.04, 0.2);
  for (const s of [-1, 1]) box(head, 0.06, 0.05, 0.03, 0xff9aa8, s * 0.15, 0.0, 0.18);
  [[-1, 0], [1, 2]].forEach(([s, ph]) => {
    const st = pivot(head, s * 0.1, 0.19, 0.0);
    box(st, 0.04, 0.3, 0.04, m.body, 0, 0.15, 0);
    box(st, 0.12, 0.12, 0.12, 0xffffff, 0, 0.34, 0).userData.eye = true;
    box(st, 0.06, 0.07, 0.04, 0x111111, 0, 0.34, 0.07).userData.eye = true;
    swing(parts, st, s > 0 ? 'x' : 'z', 0.25, 1.4, ph);
  });
  // spiral shell: a round core with a dark swirl drawn on both sides
  const shell = pivot(root, 0, 0.5, -0.12);
  swing(parts, shell, 'z', 0.05, 1.3);
  box(shell, 0.34, 0.66, 0.5, m.accent);
  box(shell, 0.34, 0.5, 0.66, m.accent);
  box(shell, 0.34, 0.58, 0.58, m.accent);
  const N = 22;
  for (let k = 0; k < N; k++) {
    const a = k * 0.5, r = 0.31 * (1 - k / (N + 3));
    for (const s of [-1, 1]) box(shell, 0.04, 0.09, 0.09, m.dark, s * 0.18, Math.sin(a) * r, Math.cos(a) * r);
  }
  box(shell, 0.4, 0.04, 0.4, m.dark, 0, -0.34, -0.02);
}

// A friendly paper lantern with a ghost inside. It sways and glows.
function lantern(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  const sway = pivot(body, 0, 0.9, 0);
  swing(parts, sway, 'z', 0.12, 1.5);
  const l = pivot(sway, 0, -0.9, 0);
  const paper = (w, h, d, y) => { const b = box(l, w, h, d, m.body, 0, y, 0); glow(b, m.accent); b.material.emissiveIntensity = 0.35; return b; };
  paper(0.5, 0.1, 0.5, 0.43);
  paper(0.64, 0.4, 0.64, 0.68);
  paper(0.5, 0.1, 0.5, 0.93);
  box(l, 0.52, 0.07, 0.52, m.dark, 0, 0.36, 0);
  box(l, 0.52, 0.07, 0.52, m.dark, 0, 1.0, 0);
  for (const y of [0.5, 0.86]) box(l, 0.67, 0.035, 0.67, m.dark, 0, y, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(l, 0.04, 0.4, 0.04, m.dark, sx * 0.33, 0.68, sz * 0.33);
  box(l, 0.04, 0.2, 0.04, m.dark, -0.17, 1.14, 0);
  box(l, 0.04, 0.2, 0.04, m.dark, 0.17, 1.14, 0);
  box(l, 0.38, 0.04, 0.04, m.dark, 0, 1.25, 0);
  eyes(l, 0.74, 0.325, 0.13, 0.13);
  box(l, 0.1, 0.12, 0.03, 0x4a2a5a, 0, 0.6, 0.325);
  for (const s of [-1, 1]) box(l, 0.07, 0.05, 0.03, 0xff9a8a, s * 0.23, 0.64, 0.325);
  for (const s of [-1, 1]) box(l, 0.12, 0.1, 0.12, m.belly, s * 0.38, 0.62, 0.08);
  parts.tip = glow(box(l, 0.14, 0.16, 0.14, m.accent, 0, 0.28, 0), m.accent);
  const tail = pivot(l, 0, 0.26, -0.04);
  swing(parts, tail, 'z', 0.3, 3);
  seeB(box(tail, 0.4, 0.16, 0.4, m.belly, 0, -0.03, -0.02), 0.85);
  seeB(box(tail, 0.28, 0.16, 0.28, m.belly, 0, -0.17, -0.08), 0.7);
  seeB(box(tail, 0.16, 0.14, 0.16, m.belly, 0, -0.3, -0.16), 0.55);
}

// A paper crane folded from one sheet, with a glowing wish on its forehead.
function crane(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  // chunky diamond body: a box turned 45 degrees, with a pink fold line along the top and bottom
  const d1 = box(body, 0.36, 0.36, 0.9, m.body, 0, 0.5, 0);
  d1.rotation.z = Math.PI / 4;
  const d2 = box(body, 0.2, 0.2, 0.96, m.belly, 0, 0.5, 0);
  d2.rotation.z = 0;
  box(body, 0.06, 0.06, 0.94, m.accent, 0, 0.77, 0);
  box(body, 0.06, 0.06, 0.94, m.accent, 0, 0.23, 0);
  for (const s of [-1, 1]) box(body, 0.05, 0.05, 0.94, m.dark, s * 0.26, 0.5, 0);
  // long neck with a pointed beak
  const neck = pivot(body, 0, 0.6, 0.38);
  neck.rotation.x = 0.4;
  box(neck, 0.16, 0.75, 0.16, m.body, 0, 0.37, 0);
  box(neck, 0.05, 0.7, 0.19, m.accent, 0, 0.37, 0);
  const head = pivot(neck, 0, 0.78, 0);
  head.rotation.x = -0.4;
  parts.head = head;
  box(head, 0.26, 0.24, 0.26, m.body, 0, 0.05, 0.02);
  box(head, 0.12, 0.12, 0.3, m.accent, 0, -0.02, 0.26);
  box(head, 0.06, 0.06, 0.14, m.accent, 0, -0.03, 0.46);
  eyes(head, 0.08, 0.155, 0.07, 0.09);
  glow(box(head, 0.1, 0.1, 0.05, m.accent, 0, 0.22, 0.1), m.accent);
  // pointed tail
  const tail = pivot(body, 0, 0.5, -0.42);
  tail.rotation.x = 0.55;
  box(tail, 0.14, 0.14, 0.4, m.body, 0, 0, -0.2);
  box(tail, 0.08, 0.08, 0.2, m.accent, 0, 0, -0.45);
  box(tail, 0.04, 0.16, 0.5, m.dark, 0, 0, -0.25);
  // big flat triangular wings: wide at the body, pointed at the tip
  parts.wings = parts.wings || [];
  for (const s of [-1, 1]) {
    const g = pivot(body, s * 0.2, 0.6, 0.0);
    box(g, 0.34, 0.04, 0.75, m.belly, s * 0.17, 0, 0);
    box(g, 0.3, 0.04, 0.62, m.belly, s * 0.47, 0, -0.1);
    box(g, 0.24, 0.04, 0.36, m.belly, s * 0.74, 0, -0.2);
    box(g, 0.14, 0.04, 0.16, m.accent, s * 0.93, 0, -0.28);
    box(g, 0.7, 0.05, 0.05, m.accent, s * 0.4, 0.01, 0.37);
    box(g, 0.34, 0.05, 0.05, m.accent, s * 0.78, 0.01, 0.1);
    box(g, 0.05, 0.05, 0.75, m.dark, s * 0.02, 0.01, 0);
    box(g, 0.05, 0.05, 0.55, m.dark, s * 0.34, 0.01, -0.12);
    g.rotation.z = s * 0.5;
    parts.wings.push({ g, s, lift: 0.5 });
  }
}

// A tin wind-up mouse on little wheels, with a key in its back.
function windup(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  box(body, 0.5, 0.3, 0.7, m.body, 0, 0.38, 0);
  box(body, 0.4, 0.16, 0.55, m.body, 0, 0.6, -0.03);
  box(body, 0.52, 0.07, 0.72, m.accent, 0, 0.42, 0);
  for (const s of [-1, 1]) for (const z of [-0.2, 0, 0.2]) box(body, 0.03, 0.05, 0.05, m.belly, s * 0.26, 0.5, z);
  box(body, 0.26, 0.2, 0.18, m.belly, 0, 0.4, 0.43);
  box(body, 0.14, 0.12, 0.1, m.belly, 0, 0.38, 0.55);
  box(body, 0.07, 0.07, 0.04, 0x111111, 0, 0.4, 0.61);
  box(body, 0.1, 0.03, 0.03, 0x2a2a2a, 0, 0.3, 0.52);
  eyes(body, 0.56, 0.36, 0.14, 0.13);
  for (const s of [-1, 1]) for (const dy of [-0.02, 0.04]) box(body, 0.2, 0.015, 0.015, 0x2a2a2a, s * 0.2, 0.36 + dy, 0.55);
  for (const s of [-1, 1]) {
    const e = pivot(body, s * 0.22, 0.74, 0.12);
    box(e, 0.22, 0.2, 0.04, m.belly, 0, 0, 0);
    box(e, 0.16, 0.26, 0.04, m.belly, 0, 0, 0);
    box(e, 0.13, 0.15, 0.05, m.accent, 0, 0, 0.02);
  }
  for (const [x, z] of [[-0.3, 0.22], [0.3, 0.22], [-0.3, -0.22], [0.3, -0.22]]) {
    const w = pivot(body, x, 0.15, z);
    box(w, 0.08, 0.3, 0.2, m.dark);
    box(w, 0.08, 0.2, 0.3, m.dark);
    box(w, 0.1, 0.1, 0.1, m.belly, 0, 0.1, 0.1);
    spin(parts, w, 'x', 6);
  }
  const key = pivot(body, 0, 0.5, -0.36);
  box(key, 0.05, 0.05, 0.14, m.belly, 0, 0, -0.07);
  const loops = pivot(key, 0, 0, -0.16);
  box(loops, 0.26, 0.05, 0.04, m.belly);
  for (const s of [-1, 1]) box(loops, 0.08, 0.16, 0.04, m.belly, s * 0.14, 0, 0);
  spin(parts, loops, 'z', 2.5);
  const tail = pivot(body, 0, 0.3, -0.38);
  swing(parts, tail, 'y', 0.4, 3);
  for (let k = 0; k < 6; k++) box(tail, 0.06, 0.06, 0.06, m.belly, Math.cos(k * 1.4) * 0.07, Math.sin(k * 1.4) * 0.07 + k * 0.02, -0.04 - k * 0.07);
}

// A jug-shaped pitcher plant full of goo, with a leaf lid that burps.
function pitcher(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  for (const [w, y] of [[0.4, 0.25], [0.46, 0.4], [0.52, 0.6], [0.58, 0.8]]) {
    box(body, w, 0.22, w, m.body, 0, y, 0);
    for (const s of [-1, 1]) for (const z of [-0.1, 0.1]) box(body, 0.03, 0.21, 0.05, m.accent, s * (w / 2 + 0.005), y, z);
  }
  box(body, 0.68, 0.06, 0.08, m.accent, 0, 0.93, 0.3);
  box(body, 0.68, 0.06, 0.08, m.accent, 0, 0.93, -0.3);
  for (const s of [-1, 1]) box(body, 0.08, 0.06, 0.68, m.accent, s * 0.3, 0.93, 0);
  glow(box(body, 0.54, 0.04, 0.54, m.belly, 0, 0.92, 0), m.belly);
  const bub = pivot(body, 0, 0.96, 0);
  swing(parts, bub, 'y', 0.6, 1.5);
  glow(box(bub, 0.1, 0.1, 0.1, m.belly, 0.1, 0.06, 0.05), m.belly);
  glow(box(bub, 0.07, 0.07, 0.07, m.belly, -0.12, 0.12, -0.05), m.belly);
  const hinge = pivot(body, 0, 0.96, -0.3);
  hinge.rotation.x = -0.55;
  const lid = pivot(hinge, 0, 0, 0);
  swing(parts, lid, 'x', 0.25, 2);
  box(lid, 0.6, 0.04, 0.55, m.accent, 0, 0, 0.27);
  box(lid, 0.46, 0.04, 0.12, m.accent, 0, 0, 0.58);
  box(lid, 0.05, 0.05, 0.55, m.dark, 0, 0.02, 0.28);
  eyes(body, 0.72, 0.295, 0.12, 0.14);
  box(body, 0.26, 0.05, 0.03, 0x2a2a2a, 0, 0.53, 0.265);
  for (const s of [-1, 1]) box(body, 0.04, 0.07, 0.03, 0x2a2a2a, s * 0.14, 0.56, 0.265);
  for (const s of [-1, 1]) box(body, 0.08, 0.06, 0.03, 0xff9aa8, s * 0.21, 0.63, 0.295);
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const a = pivot(body, s * 0.33, 0.66, 0);
    box(a, 0.1, 0.32, 0.05, m.dark, s * 0.05, -0.15, 0);
    box(a, 0.12, 0.1, 0.07, m.body, s * 0.07, -0.34, 0);
    parts.arms.push({ g: a, phase });
  }
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const l = pivot(body, s * 0.13, 0.2, 0.08);
    box(l, 0.13, 0.2, 0.16, m.dark, 0, -0.1, 0.02);
    box(l, 0.17, 0.05, 0.22, m.body, 0, -0.18, 0.05);
    parts.legs.push({ g: l, phase });
  }
  box(body, 0.14, 0.16, 0.14, m.dark, 0, 0.08, -0.15);
}

// A porcelain teacup with pixie wings and a curl of steam.
function teacup(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  box(body, 0.9, 0.05, 0.9, m.body, 0, 0.03, 0);
  for (const s of [-1, 1]) {
    box(body, 0.92, 0.03, 0.04, m.accent, 0, 0.065, s * 0.45);
    box(body, 0.04, 0.03, 0.92, m.accent, s * 0.45, 0.065, 0);
  }
  box(body, 0.34, 0.06, 0.34, m.accent, 0, 0.1, 0);
  box(body, 0.4, 0.14, 0.4, m.body, 0, 0.2, 0);
  box(body, 0.5, 0.18, 0.5, m.body, 0, 0.36, 0);
  box(body, 0.58, 0.2, 0.58, m.body, 0, 0.55, 0);
  box(body, 0.66, 0.06, 0.07, m.accent, 0, 0.67, 0.295);
  box(body, 0.66, 0.06, 0.07, m.accent, 0, 0.67, -0.295);
  for (const s of [-1, 1]) box(body, 0.07, 0.06, 0.66, m.accent, s * 0.295, 0.67, 0);
  box(body, 0.54, 0.03, 0.54, m.dark, 0, 0.66, 0);
  for (const s of [-1, 1]) for (const z of [-0.12, 0.12]) {
    box(body, 0.02, 0.05, 0.05, m.accent, s * 0.3, 0.52, z - 0.03);
    box(body, 0.02, 0.05, 0.05, m.accent, s * 0.3, 0.52, z + 0.03);
    box(body, 0.02, 0.05, 0.05, m.accent, s * 0.3, 0.47, z);
  }
  box(body, 0.14, 0.05, 0.06, m.body, 0.37, 0.52, 0);
  box(body, 0.05, 0.22, 0.06, m.body, 0.44, 0.42, 0);
  box(body, 0.14, 0.05, 0.06, m.body, 0.37, 0.31, 0);
  eyes(body, 0.55, 0.3, 0.12, 0.12);
  box(body, 0.1, 0.04, 0.03, 0x2a2a2a, 0, 0.42, 0.27);
  for (const s of [-1, 1]) box(body, 0.09, 0.06, 0.03, m.accent, s * 0.2, 0.47, 0.295);
  addWings(parts, body, m, 0.2, 0.5, -0.3, 0.32, 0.5, m.belly, m.accent, { upright: true });
  for (const [x, ph] of [[-0.1, 0], [0.12, 2]]) {
    const st = pivot(body, x, 0.7, 0);
    swing(parts, st, 'z', 0.25, 2, ph);
    [0.1, 0.09, 0.07].forEach((sz, i) => seeB(box(st, sz, sz, sz, 0xffffff, (i % 2 ? 1 : -1) * 0.03, 0.1 + i * 0.12, 0), 0.6 - i * 0.12));
  }
}

const SHAPES_B = { snail, lantern, crane, windup, pitcher, teacup };
/* ==== end of T4b group B shapes ==== */

/* ==== T4b group C shapes ==== */
// A drake made of fluffy cloud puffs, with whiskers and a lightning tail tip.
function nimbus(root, m, parts) {
  const b = pivot(root, 0, 0, 0);
  parts.bounce = b;
  parts.hover = true;
  const head = pivot(b, 0, 1.3, 0.78);
  parts.head = head;
  box(head, 0.38, 0.32, 0.4, m.body);
  box(head, 0.28, 0.17, 0.22, m.body, 0, -0.06, 0.28);
  box(head, 0.2, 0.03, 0.04, m.dark, 0, -0.12, 0.39);
  box(head, 0.1, 0.06, 0.03, 0xffa0a8, -0.17, -0.06, 0.2);
  box(head, 0.1, 0.06, 0.03, 0xffa0a8, 0.17, -0.06, 0.2);
  eyes(head, 0.06, 0.205, 0.1, 0.11);
  box(head, 0.2, 0.1, 0.2, m.body, 0, 0.2, 0.0);
  for (const s of [-1, 1]) {
    box(head, 0.07, 0.3, 0.07, m.dark, s * 0.13, 0.3, -0.12).rotation.x = -0.7;
    const wh = pivot(head, s * 0.14, -0.06, 0.1);
    box(wh, 0.04, 0.04, 0.4, m.accent, s * 0.1, 0, -0.1).rotation.y = s * -0.3;
    glow(box(wh, 0.07, 0.07, 0.07, m.accent, s * 0.15, 0, -0.3), m.accent);
    swing(parts, wh, 'y', 0.3, 2.5, s);
  }
  parts.segments = [];
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const r = 0.27 - i * 0.02;
    const seg = pivot(b, 0, [0, 1.0, 0.72, 0.44, 0.36, 0.52, 0.72][i], 0.6 - i * 0.3);
    ball(seg, r, i % 2 ? m.body : m.belly);
    ball(seg, r * 0.65, m.body, r * 0.75, r * 0.45, 0.04);
    ball(seg, r * 0.6, m.belly, -r * 0.75, r * 0.2, -0.04);
    ball(seg, r * 0.5, m.dark, 0, -r * 0.85, 0);
    parts.segments.push({ g: seg, i, x0: 0 });
    if (i === n) {
      const tip = pivot(seg, 0, 0, -0.18);
      parts.tail = tip;
      [[0, 0, 0, 0.1, 0.22, 0.08], [0, 0.13, -0.07, 0.1, 0.08, 0.22], [0, 0.25, -0.15, 0.1, 0.22, 0.08]].forEach(([x, y, z, w, h, d], k) => {
        const bx = glow(box(tip, w, h, d, m.accent, x, y, z - 0.05), m.accent);
        if (k === 0) parts.tip = bx;
      });
    }
  }
  for (const s of [-1, 1]) {
    const paw = ball(b, 0.09, m.body, s * 0.27, 0.92, 0.5);
    swing(parts, paw, 'x', 0.3, 3, s);
  }
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
  box(head, 0.12, 0.2, 0.3, m.belly, 0, 0.2, -0.04).rotation.x = 0.3;
  box(head, 0.08, 0.12, 0.2, m.accent, 0, 0.3, -0.12).rotation.x = 0.5;
  box(head, 0.22, 0.1, 0.1, m.belly, 0, -0.06, 0.3);
  box(head, 0.1, 0.03, 0.03, 0x2a2a2a, 0, -0.08, 0.355).userData.eye = true;
  for (const s of [-1, 1]) box(head, 0.04, 0.04, 0.03, 0x2a2a2a, s * 0.07, -0.06, 0.355).userData.eye = true;
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
  const cy = -0.1, cz = -0.32;
  for (let k = 0; k < 8; k++) {
    const rad = 0.4 - k * 0.035, phi = 1.2 + k * 0.85, sz = 0.19 - k * 0.016;
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
  const sw = pivot(b, 0, 0.55, -0.2);
  spin(parts, sw, 'z', 1.5);
  for (let arm = 0; arm < 3; arm++) for (let j = 0; j < 9; j++) {
    const a = arm * 2.094 + j * 0.36, r = 0.34 + j * 0.075, sz = 0.21 - j * 0.014;
    glow(box(sw, sz, sz, 0.08, m.accent, Math.cos(a) * r, Math.sin(a) * r, 0), m.accent);
  }
  const sp = pivot(b, 0, 0.55, -0.2);
  spin(parts, sp, 'z', 3);
  for (let k = 0; k < 4; k++) {
    const r = 0.6 + (k % 2) * 0.25;
    glow(box(sp, 0.08, 0.08, 0.08, 0xffffff, Math.cos(k * 1.57 + 0.5) * r, Math.sin(k * 1.57 + 0.5) * r, 0), 0xffffff);
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
    box(claw, 0.18, 0.08, 0.26, m.dark, 0, -0.06, 0.12);
    const up = pivot(claw, 0, 0, 0);
    box(up, 0.18, 0.08, 0.26, m.body, 0, 0.04, 0.12);
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
      box(v, 0.05, 0.16 * f, 0.05, m.body, s * 0.09 * f, -0.08 * f, 0).rotation.z = s * 0.5;
      box(v, 0.05, 0.16 * f, 0.05, m.belly, s * 0.17 * f, -0.22 * f, 0).rotation.z = -s * 0.3;
    }
    if (i <= 4) box(v, 0.03, 0.18, 0.05, m.belly, 0, 0.14, 0).rotation.x = -0.3;
    parts.segments.push({ g: v, i, x0: 0 });
  }
  const tail = pivot(b, 0, 0.5, -0.95);
  parts.tail = tail;
  box(tail, 0.05, 0.05, 0.3, m.body, 0, 0, -0.05);
  for (const s of [-1, 1]) {
    box(tail, 0.05, 0.42, 0.05, m.body, 0, s * 0.2, -0.12).rotation.x = s * 0.55;
    box(tail, 0.04, 0.3, 0.04, m.belly, 0, s * 0.1, -0.06).rotation.x = s * 1.0;
  }
}

// A glass ball with crossing bands that rolls, and a one-eyed alien hamster inside.
function zorb(root, m, parts) {
  const b = pivot(root, 0, 0, 0);
  parts.bounce = b;
  const al = pivot(b, 0, 0.4, 0);
  al.scale.setScalar(1.2);
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
  for (const w of [[0.86, 0.64, 0.64], [0.64, 0.86, 0.64]]) box(shell, w[0], w[1], w[2], m.belly).rotation.y = Math.PI / 4;
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
  shell.children.forEach(c => { c.material.transparent = true; c.material.opacity = 0.13; c.material.depthWrite = false; });
}

const SHAPES_C = { nimbus, chameleon, blackhole, jukebox, fishbone, zorb };
/* ==== end of T4b group C shapes ==== */

/* ==== T9 sky shapes ==== */
const SHAPES_SKY = {};
/* ==== end of T9 sky shapes ==== */

/* ==== T9 slime shapes ==== */
// Goo helper: makes a part see-through and soft.
function gooSlime(mesh, opacity = 0.8) {
  mesh.material.transparent = true;
  mesh.material.opacity = opacity;
  mesh.material.depthWrite = false;
  return mesh;
}

// A see-through goo box.
function gooBoxSlime(parent, w, h, d, color, x, y, z, opacity = 0.8) {
  return gooSlime(box(parent, w, h, d, color, x, y, z), opacity);
}

// A see-through round goo lump.
function gooBallSlime(parent, r, color, x, y, z, opacity = 0.8) {
  const g = ball(parent, r, color, x, y, z);
  box(g, r * 1.9, r * 1.6, r * 1.9, color).rotation.y = Math.PI / 4;
  g.children.forEach(c => gooSlime(c, opacity));
  return g;
}

// A shiny cherry (red ball with a little stem).
function cherrySlime(parent, color, x, y, z, s = 1) {
  ball(parent, 0.09 * s, color, x, y + 0.09 * s, z);
  box(parent, 0.02 * s, 0.14 * s, 0.02 * s, 0x2a6a2a, x, y + 0.22 * s, z).rotation.z = 0.3;
  box(parent, 0.04 * s, 0.03 * s, 0.03 * s, 0xffffff, x - 0.03 * s, y + 0.13 * s, z + 0.06 * s);
}

// A jelly cube with a marble inside (stack = three of them in a tower).
function gelcube(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const stack = has(m, 'stack');
  const tiers = stack
    ? [{ s: 0.7, y: 0, face: false, marble: m.belly }, { s: 0.52, y: 0.7, face: true, marble: m.accent }, { s: 0.36, y: 1.22, face: false, marble: m.dark }]
    : [{ s: 0.62, y: 0.02, face: true, marble: m.accent }];
  tiers.forEach((t, i) => {
    const g = pivot(body, 0, t.y, 0);
    swing(parts, g, 'z', 0.1, 2.4 + i * 0.7, i * 1.7);
    swing(parts, g, 'x', 0.07, 3.1 + i * 0.5, i * 0.9);
    const h = t.s / 2;
    gooBoxSlime(g, t.s, t.s, t.s, m.body, 0, h, 0, 0.72);
    gooBoxSlime(g, t.s * 0.82, t.s * 1.04, t.s * 0.82, m.body, 0, h, 0, 0.45);
    // marble inside
    ball(g, t.s * 0.17, t.marble, t.s * 0.12, h * 0.8, -t.s * 0.05);
    box(g, t.s * 0.06, t.s * 0.06, t.s * 0.06, 0xffffff, t.s * 0.14, h * 0.8 + t.s * 0.1, t.s * 0.04);
    // shine
    box(g, t.s * 0.05, t.s * 0.28, 0.02, 0xffffff, -t.s * 0.36, h * 1.2, t.s / 2 + 0.01);
    box(g, t.s * 0.05, t.s * 0.05, 0.02, 0xffffff, -t.s * 0.36, h * 1.75, t.s / 2 + 0.01);
    if (t.face) {
      eyes(g, h * 1.15, t.s / 2 + 0.02, t.s * 0.22, t.s * 0.24);
      box(g, t.s * 0.22, 0.04, 0.03, m.dark, 0, h * 0.78, t.s / 2 + 0.02);
      box(g, t.s * 0.08, 0.04, 0.03, m.dark, -t.s * 0.14, h * 0.82, t.s / 2 + 0.02);
      box(g, t.s * 0.08, 0.04, 0.03, m.dark, t.s * 0.14, h * 0.82, t.s / 2 + 0.02);
      for (const s of [-1, 1]) box(g, t.s * 0.14, t.s * 0.08, 0.02, m.accent, s * t.s * 0.36, h * 0.92, t.s / 2 + 0.02);
    }
  });
  const top = tiers[tiers.length - 1];
  const topPivot = pivot(body, 0, top.y + top.s, 0);
  swing(parts, topPivot, 'z', 0.1, 2.4 + (tiers.length - 1) * 0.7, (tiers.length - 1) * 1.7);
  cherrySlime(topPivot, m.accent, 0, 0, 0, stack ? 0.8 : 1);
  // wobbly puddle under the cube
  gooSlime(disc(body, stack ? 0.5 : 0.45, 0.03, m.body, 0, 0.015, 0), 0.5);
}

// A drop of slime with a curly tip, a puddle, a sliding drip and (for the king) a crown and cape.
function drip(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  gooSlime(disc(body, 0.62, 0.03, m.body, 0, 0.015, 0), 0.5);
  gooBoxSlime(body, 0.92, 0.2, 0.84, m.body, 0, 0.1, 0, 0.82);
  gooBoxSlime(body, 0.76, 0.3, 0.7, m.body, 0, 0.33, 0, 0.8);
  gooBoxSlime(body, 0.54, 0.24, 0.5, m.body, 0, 0.58, 0, 0.8);
  gooBoxSlime(body, 0.34, 0.2, 0.32, m.body, 0, 0.78, 0, 0.82);
  // the curl
  gooBoxSlime(body, 0.18, 0.16, 0.18, m.body, 0, 0.94, 0.02, 0.85);
  gooBoxSlime(body, 0.14, 0.12, 0.16, m.body, 0, 1.04, 0.12, 0.85);
  gooBoxSlime(body, 0.1, 0.12, 0.12, m.body, 0, 0.96, 0.22, 0.85);
  glow(box(body, 0.05, 0.05, 0.05, m.accent, 0, 0.9, 0.24), m.accent);
  // shine and sparkly bubbles inside
  box(body, 0.06, 0.26, 0.02, 0xffffff, -0.28, 0.4, 0.36);
  box(body, 0.06, 0.06, 0.02, 0xffffff, -0.28, 0.56, 0.36);
  for (const [x, y, z, s] of [[0.18, 0.2, -0.1, 0.1], [-0.12, 0.45, -0.1, 0.07], [0.1, 0.62, 0, 0.06]]) {
    box(body, s, s, s, m.belly, x, y, z);
  }
  // face: low and wide
  eyes(body, 0.38, 0.36, 0.17, 0.16);
  for (const s of [-1, 1]) box(body, 0.14, 0.08, 0.02, m.accent, s * 0.3, 0.26, 0.36);
  box(body, 0.2, 0.04, 0.03, m.dark, 0, 0.23, 0.36);
  box(body, 0.06, 0.04, 0.03, m.dark, -0.12, 0.26, 0.36);
  box(body, 0.06, 0.04, 0.03, m.dark, 0.12, 0.26, 0.36);
  // a drip sliding down the side
  for (const [s, ph] of [[1, 0], [-1, 2.2]]) {
    const d = pivot(body, s * 0.4, 0.5, 0.05);
    gooBoxSlime(d, 0.07, 0.22, 0.07, m.body, s * 0.04, -0.1, 0, 0.8);
    gooBoxSlime(d, 0.1, 0.1, 0.1, m.accent, s * 0.04, -0.26, 0, 0.85);
    swing(parts, d, 'z', 0.25, 2.2, ph);
  }
  if (has(m, 'crown')) {
    const c = pivot(body, 0, 0.8, 0);
    box(c, 0.38, 0.08, 0.36, m.accent, 0, 0, 0);
    for (const [x, z, h] of [[-0.14, 0.12, 0.14], [0.14, 0.12, 0.14], [0, 0.14, 0.2], [-0.14, -0.12, 0.12], [0.14, -0.12, 0.12]]) {
      box(c, 0.07, h, 0.07, m.accent, x, h / 2 + 0.04, z);
      glow(box(c, 0.06, 0.06, 0.06, 0xff4a6a, x, h + 0.07, z), 0xff4a6a);
    }
    glow(box(c, 0.08, 0.08, 0.04, 0x4ad0ff, 0, 0, 0.19), 0x4ad0ff);
  }
  if (has(m, 'cape')) {
    const c = pivot(body, 0, 0.7, -0.3);
    swing(parts, c, 'x', 0.1, 1.6);
    gooBoxSlime(c, 0.74, 0.46, 0.05, m.accent, 0, -0.25, -0.04, 0.85);
    gooBoxSlime(c, 0.6, 0.2, 0.05, m.accent, 0, -0.56, -0.04, 0.85);
    box(c, 0.84, 0.07, 0.08, 0xffffff, 0, 0.0, -0.02);
    for (const x of [-0.2, 0, 0.2]) box(c, 0.06, 0.06, 0.03, 0xffffff, x, -0.3, -0.08);
  }
}

// A melty goo puppy (the grown-up one has soft spikes and big ears).
function slimedog(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  const spiky = has(m, 'spikes');
  gooBoxSlime(body, 0.5, 0.38, 0.84, m.body, 0, 0.52, -0.02, 0.8);
  gooBoxSlime(body, 0.42, 0.3, 0.7, m.body, 0, 0.55, -0.02, 0.5);
  for (const [x, y, z, s] of [[-0.1, 0.78, -0.15, 0.2], [0.12, 0.8, 0.1, 0.18], [0, 0.76, -0.32, 0.16]]) gooBallSlime(body, s / 2, m.body, x, y, z, 0.8);
  // the belly shows a little bubble
  box(body, 0.1, 0.1, 0.1, m.belly, 0.05, 0.5, -0.1);
  box(body, 0.06, 0.06, 0.06, m.belly, -0.1, 0.58, 0.12);
  // head
  const head = pivot(body, 0, 0.72, 0.5);
  parts.head = head;
  gooBoxSlime(head, 0.5, 0.42, 0.42, m.body, 0, 0, 0, 0.85);
  gooBoxSlime(head, 0.3, 0.2, 0.2, m.belly, 0, -0.1, 0.28, 0.9);
  box(head, 0.12, 0.08, 0.06, m.dark, 0, -0.02, 0.4);
  eyes(head, 0.08, 0.22, 0.14, 0.14);
  // tongue
  box(head, 0.1, 0.03, 0.14, m.accent, 0, -0.22, 0.34);
  box(head, 0.1, 0.05, 0.05, m.accent, 0, -0.2, 0.42);
  // floppy ears
  for (const s of [-1, 1]) {
    const e = pivot(head, s * (spiky ? 0.3 : 0.27), 0.2, 0);
    const ew = spiky ? 0.16 : 0.12, eh = spiky ? 0.34 : 0.24;
    gooBoxSlime(e, ew, eh, 0.2, m.body, s * 0.04, -eh / 2, 0, 0.85);
    gooBoxSlime(e, ew * 0.8, 0.1, 0.2, m.body, s * 0.07, -eh - 0.03, 0, 0.85);
    swing(parts, e, 'z', 0.18, 2.6, s);
  }
  // legs that melt into puddle feet
  parts.legs = [];
  [[-0.2, 0.3, 0], [0.2, 0.3, Math.PI], [-0.2, -0.3, Math.PI], [0.2, -0.3, 0]].forEach(([x, z, phase]) => {
    const leg = pivot(body, x, 0.36, z);
    gooBoxSlime(leg, 0.16, 0.3, 0.16, m.body, 0, -0.17, 0, 0.85);
    gooSlime(disc(leg, 0.15, 0.06, m.body, 0, -0.33, 0), 0.8);
    parts.legs.push({ g: leg, phase });
  });
  // drippy tail
  const tail = pivot(body, 0, 0.62, -0.45);
  parts.tail = tail;
  gooBoxSlime(tail, 0.12, 0.12, 0.2, m.body, 0, 0.04, -0.1, 0.85);
  gooBallSlime(tail, 0.1, m.body, 0, 0.1, -0.24, 0.85);
  box(tail, 0.05, 0.1, 0.05, m.body, 0, -0.03, -0.24);
  // drips under the belly
  for (const [x, z, ph] of [[-0.05, 0.1, 0], [0.08, -0.15, 2]]) {
    const d = pivot(body, x, 0.34, z);
    gooBoxSlime(d, 0.05, 0.14, 0.05, m.body, 0, -0.07, 0, 0.85);
    gooBoxSlime(d, 0.08, 0.08, 0.08, m.body, 0, -0.17, 0, 0.9);
    swing(parts, d, 'x', 0.3, 2.8, ph);
  }
  if (spiky) {
    for (let k = 0; k < 4; k++) {
      const sp = pivot(body, 0, 0.74, 0.3 - k * 0.22);
      gooBoxSlime(sp, 0.1, 0.2 - k * 0.02, 0.1, m.accent, 0, 0.12, 0, 0.9);
      box(sp, 0.05, 0.08, 0.05, m.accent, 0, 0.26 - k * 0.02, 0);
      swing(parts, sp, 'z', 0.12, 2 + k * 0.4, k);
    }
  }
}

// A jelly bear made of strawberry gummy.
function gummy(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  // belly and head
  gooBallSlime(body, 0.32, m.body, 0, 0.55, 0, 0.82);
  gooBoxSlime(body, 0.5, 0.4, 0.5, m.belly, 0, 0.52, 0.08, 0.5);
  const head = pivot(body, 0, 1.0, 0.02);
  parts.head = head;
  gooBallSlime(head, 0.28, m.body, 0, 0, 0, 0.82);
  gooBoxSlime(head, 0.26, 0.2, 0.18, m.belly, 0, -0.08, 0.24, 0.9);
  box(head, 0.1, 0.07, 0.05, m.dark, 0, -0.01, 0.34);
  box(head, 0.12, 0.03, 0.03, m.dark, 0, -0.13, 0.34);
  box(head, 0.04, 0.05, 0.03, m.dark, -0.07, -0.11, 0.34);
  box(head, 0.04, 0.05, 0.03, m.dark, 0.07, -0.11, 0.34);
  eyes(head, 0.1, 0.25, 0.13, 0.12);
  for (const s of [-1, 1]) {
    box(head, 0.1, 0.06, 0.02, 0xff2a4a, s * 0.2, -0.05, 0.27);
    gooBallSlime(head, 0.1, m.body, s * 0.22, 0.28, -0.02, 0.85);
    ball(head, 0.05, m.belly, s * 0.22, 0.28, 0.07);
  }
  // shine
  box(head, 0.05, 0.14, 0.02, 0xffffff, -0.17, 0.12, 0.27);
  box(body, 0.05, 0.16, 0.02, 0xffffff, -0.2, 0.62, 0.3);
  // arms
  parts.arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(body, s * 0.36, 0.7, 0);
    gooBoxSlime(arm, 0.14, 0.3, 0.14, m.body, s * 0.04, -0.12, 0.02, 0.85);
    gooBallSlime(arm, 0.09, m.body, s * 0.04, -0.28, 0.02, 0.85);
    parts.arms.push({ g: arm, phase: s > 0 ? 0 : Math.PI });
  }
  // legs
  parts.legs = [];
  for (const s of [-1, 1]) {
    const leg = pivot(body, s * 0.18, 0.28, 0);
    gooBoxSlime(leg, 0.18, 0.22, 0.2, m.body, 0, -0.1, 0.02, 0.85);
    gooBoxSlime(leg, 0.2, 0.08, 0.28, m.body, 0, -0.24, 0.05, 0.85);
    parts.legs.push({ g: leg, phase: s > 0 ? 0 : Math.PI });
  }
  swing(parts, body, 'z', 0.06, 3);
}

const SHAPES_SLIME = { gelcube, drip, slimedog, gummy };
/* ==== end of T9 slime shapes ==== */

/* ==== T9 light shapes ==== */
const SHAPES_LIGHT = {};
/* ==== end of T9 light shapes ==== */

/* ==== T9 paper shapes ==== */
const SHAPES_PAPER = {};
/* ==== end of T9 paper shapes ==== */

export const SHAPES = {
  skull, bonedog, dino, ufo, visitor, tripod,
  guardian, butterfly, moth, star, robe, hopper, planet, comet, cloud, tall, squid, bat, drum, ape, bell, armadillo, wyvern, fish, nut, drone, wisp, puff, crystal,
  ...SHAPES_A, ...SHAPES_B, ...SHAPES_C,
  ...SHAPES_SKY, ...SHAPES_SLIME, ...SHAPES_LIGHT, ...SHAPES_PAPER,
};
