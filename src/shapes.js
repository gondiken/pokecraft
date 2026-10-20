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
// Sky: kite (Kiteling, Kitegale), balloon (Balloony, Zeppeluff), skywhale (Skyfin, Whaloft), pinwheel (Pinwhirl).

// A hanging ribbon: nested pivots that each sway a bit later than the one above, so it waves.
function ribbonSky(parent, parts, m, x, y, n, len, phase = 0, amp = 0.2) {
  let g = pivot(parent, x, y, -0.03);
  for (let i = 0; i < n; i++) {
    box(g, 0.03, len, 0.03, m.dark, 0, -len / 2, 0);
    const bowColor = i % 2 ? m.body : m.accent;
    const bow = pivot(g, 0, -len, 0);
    for (const s of [-1, 1]) box(bow, 0.13, 0.1, 0.03, bowColor, s * 0.07, 0, 0).rotation.z = s * 0.45;
    box(bow, 0.05, 0.05, 0.04, m.dark, 0, 0, 0.005);
    swing(parts, g, 'x', amp, 2.4, phase + i * 0.7);
    swing(parts, g, 'z', amp * 1.3, 2.0, phase + i * 0.9 + 1);
    g = bow;
  }
}

// A rounded envelope made of layers (each a square plus a turned, smaller one = an octagon).
// layers: [y, height, width]; stripes: [x offsets] of colour bands that follow the shape.
function roundSky(parent, color, layers, z = 0, stripeColor, stripes = []) {
  for (const [y, h, w] of layers) {
    box(parent, w * 0.88, h, w * 0.88, color, 0, y, z);
    box(parent, w, h, w * 0.8, color, 0, y, z);
    box(parent, w * 0.8, h, w, color, 0, y, z);
    for (const x of stripes) {
      box(parent, 0.1, h, w + 0.02, stripeColor, x * w / 0.88, y, z);
      box(parent, w + 0.02, h, 0.1, stripeColor, 0, y, z + x * w / 0.88);
    }
  }
}

// A flat diamond kite with a ribbon tail. Kitegale is a dragon kite with a head, whiskers and wing flaps.
function kite(root, m, parts) {
  const dragon = has(m, 'dragon');
  const b = pivot(root, 0, 0, 0);
  parts.bounce = b;
  parts.hover = true;
  const d = pivot(b, 0, 1.05, 0);
  // Four panels: a rotated square tiled by four smaller ones.
  for (const [x, y, c] of [[0, 0.2475, m.body], [0, -0.2475, m.body], [-0.2475, 0, m.accent], [0.2475, 0, m.accent]]) {
    box(d, 0.35, 0.35, 0.06, c, x, y, 0).rotation.z = Math.PI / 4;
  }
  box(d, 0.04, 1.2, 0.03, m.dark, 0, 0, -0.045);
  box(d, 1.2, 0.04, 0.03, m.dark, 0, 0, -0.045);
  ribbonSky(d, parts, m, 0, -0.5, 5, 0.15);
  for (const s of [-1, 1]) {
    const arm = pivot(d, s * 0.5, -0.02, 0.04);
    box(arm, 0.12, 0.12, 0.12, m.dark, s * 0.04, 0, 0);
    box(arm, 0.07, 0.07, 0.07, m.belly, s * 0.1, 0, 0);
    (parts.arms ||= []).push({ g: arm, phase: s * 1.5 });
  }
  if (!dragon) {
    box(d, 0.34, 0.34, 0.03, m.belly, 0, 0, 0.045).rotation.z = Math.PI / 4;
    eyes(d, 0.05, 0.07, 0.085, 0.1);
    mouth(d, -0.09, 0.07, 0.1);
    for (const s of [-1, 1]) box(d, 0.07, 0.05, 0.02, 0xff9ab0, s * 0.15, -0.045, 0.07);
  } else {
    box(d, 0.3, 0.3, 0.03, m.belly, 0, -0.02, 0.045).rotation.z = Math.PI / 4;
    const head = pivot(d, 0, 0.1, 0.2);
    parts.head = head;
    box(head, 0.36, 0.3, 0.34, m.body);
    box(head, 0.26, 0.15, 0.22, m.belly, 0, -0.09, 0.24);
    box(head, 0.05, 0.05, 0.03, m.dark, -0.06, -0.03, 0.355);
    box(head, 0.05, 0.05, 0.03, m.dark, 0.06, -0.03, 0.355);
    eyes(head, 0.07, 0.175, 0.095, 0.11);
    mouth(head, -0.15, 0.355, 0.16);
    box(head, 0.08, 0.1, 0.1, m.accent, 0, 0.23, -0.05);
    for (const s of [-1, 1]) {
      box(head, 0.06, 0.24, 0.06, m.accent, s * 0.12, 0.25, -0.08).rotation.z = -s * 0.35;
      for (const k of [0, 1]) {
        const w = pivot(head, s * 0.13, -0.1 - k * 0.04, 0.3);
        box(w, 0.04, 0.03, 0.34, m.accent, s * 0.04, 0, 0.15).rotation.y = s * (0.35 + k * 0.2);
        swing(parts, w, 'y', 0.25, 2.2, s + k);
      }
      ribbonSky(d, parts, m, s * 0.37, -0.2, 3, 0.15, s * 1.3, 0.25);
    }
    addWings(parts, d, m, 0.4, -0.05, -0.08, 0.3, 0.22, m.accent, m.belly, { upright: true, lift: 0.3 });
  }
}

// A hot-air balloon with a picnic basket and little feet. Zeppeluff is a fluffy blimp with a propeller.
function balloon(root, m, parts) {
  const blimp = has(m, 'blimp');
  const b = pivot(root, 0, 0, 0);
  parts.bounce = b;
  parts.hover = true;
  if (!blimp) {
    const env = pivot(b, 0, 1.3, 0);
    roundSky(env, m.body, [[0.4, 0.1, 0.32], [0.3, 0.1, 0.58], [0.05, 0.4, 0.88], [-0.22, 0.14, 0.7], [-0.36, 0.12, 0.5]], 0, m.accent, [-0.27, 0.27]);
    box(env, 0.36, 0.1, 0.36, m.dark, 0, -0.47, 0);
    box(env, 0.2, 0.05, 0.2, m.dark, 0, 0.47, 0);
    eyes(env, 0.1, 0.455, 0.12, 0.12);
    mouth(env, -0.07, 0.455, 0.14);
    for (const s of [-1, 1]) box(env, 0.08, 0.06, 0.02, 0xff9ab0, s * 0.19, -0.02, 0.455);
    parts.tip = glow(box(b, 0.14, 0.2, 0.14, 0xffb030, 0, 0.74, 0), 0xffb030);
    box(b, 0.34, 0.22, 0.3, m.belly, 0, 0.42, 0);
    box(b, 0.38, 0.05, 0.34, m.dark, 0, 0.55, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(b, 0.025, 0.34, 0.025, m.dark, sx * 0.16, 0.71, sz * 0.12).rotation.z = -sx * 0.1;
    }
    parts.legs = [];
    for (const s of [-1, 1]) {
      const leg = pivot(b, s * 0.09, 0.3, 0.02);
      box(leg, 0.09, 0.22, 0.1, m.dark, 0, -0.11, 0);
      box(leg, 0.13, 0.05, 0.17, m.dark, 0, -0.24, 0.03);
      parts.legs.push({ g: leg, phase: s > 0 ? 0 : Math.PI });
    }
  } else {
    const env = pivot(b, 0, 1.0, 0);
    for (const [z, w] of [[-0.95, 0.3], [-0.78, 0.52], [-0.55, 0.72], [-0.25, 0.86], [0.1, 0.9], [0.4, 0.84], [0.65, 0.72], [0.85, 0.66]]) {
      box(env, w, w * 0.8, 0.32, m.body, 0, 0, z);
      box(env, w * 0.8, w, 0.32, m.body, 0, 0, z);
      box(env, w * 0.9, w * 0.9, 0.32, m.body, 0, 0, z);
    }
    box(env, 0.14, 0.05, 1.5, m.accent, 0, 0.455, -0.1);
    for (const sx of [-1, 1]) box(env, 0.05, 0.14, 1.3, m.accent, sx * 0.455, 0.05, -0.05);
    eyes(env, 0.07, 1.015, 0.13, 0.13);
    mouth(env, -0.1, 1.015, 0.16);
    for (const s of [-1, 1]) box(env, 0.09, 0.06, 0.02, 0xff9ab0, s * 0.22, -0.04, 1.015);
    for (const [w, h, d, y, z] of [[0.06, 0.6, 0.4, 0.3, -1.0], [0.8, 0.06, 0.4, 0.0, -1.0]]) box(env, w, h, d, m.dark, 0, y, z);
    const prop = pivot(env, 0, 0.0, -1.2);
    box(prop, 0.12, 0.12, 0.1, m.dark);
    box(prop, 0.8, 0.09, 0.03, m.accent);
    box(prop, 0.09, 0.8, 0.03, m.accent);
    spin(parts, prop, 'z', 11);
    box(b, 0.5, 0.2, 0.34, m.belly, 0, 0.5, 0.05);
    box(b, 0.54, 0.05, 0.38, m.dark, 0, 0.62, 0.05);
    for (const s of [-1, 0, 1]) glow(box(b, 0.1, 0.09, 0.03, 0xfff0a0, s * 0.15, 0.52, 0.23), 0xfff0a0);
    parts.tip = glow(box(b, 0.12, 0.12, 0.12, 0xffb030, 0, 0.5, 0.42), 0xffb030);
    parts.legs = [];
    for (const s of [-1, 1]) {
      const leg = pivot(b, s * 0.14, 0.4, 0.05);
      box(leg, 0.09, 0.3, 0.1, m.dark, 0, -0.15, 0);
      box(leg, 0.14, 0.05, 0.18, m.dark, 0, -0.33, 0.03);
      parts.legs.push({ g: leg, phase: s > 0 ? 0 : Math.PI });
    }
  }
}

// A whale that swims through the sky: flippers, tail flukes and a blowhole that spouts little clouds.
function skywhale(root, m, parts) {
  const b = pivot(root, 0, 0, 0);
  parts.bounce = b;
  parts.hover = true;
  box(b, 0.8, 0.64, 1.0, m.body, 0, 0.62, 0);
  box(b, 0.7, 0.74, 0.9, m.body, 0, 0.62, 0);
  box(b, 0.78, 0.6, 0.3, m.body, 0, 0.6, 0.6);
  box(b, 0.72, 0.22, 1.0, m.belly, 0, 0.34, 0.05);
  box(b, 0.66, 0.24, 0.3, m.belly, 0, 0.36, 0.6);
  for (const z of [-0.3, -0.1, 0.1, 0.3]) for (const s of [-1, 1]) box(b, 0.02, 0.16, 0.03, 0xa8c8e8, s * 0.365, 0.32, z);
  eyes(b, 0.72, 0.755, 0.25, 0.15);
  for (const s of [-1, 1]) {
    box(b, 0.1, 0.07, 0.03, 0xff9ab0, s * 0.33, 0.53, 0.76);
    box(b, 0.04, 0.05, 0.03, m.dark, s * 0.19, 0.5, 0.76);
  }
  mouth(b, 0.46, 0.76, 0.34);
  addWings(parts, b, m, 0.4, 0.4, 0.15, 0.48, 0.26, m.dark, m.body, { lift: 0.2 });
  const tail = pivot(b, 0, 0.62, -0.5);
  parts.tail = tail;
  tail.rotation.x = 0.3;
  box(tail, 0.5, 0.45, 0.35, m.body, 0, 0, -0.2);
  box(tail, 0.3, 0.3, 0.3, m.body, 0, 0.04, -0.45);
  const fl = pivot(tail, 0, 0.06, -0.62);
  swing(parts, fl, 'x', 0.4, 2.6);
  for (const s of [-1, 1]) {
    box(fl, 0.42, 0.06, 0.28, m.body, s * 0.22, 0, -0.1).rotation.y = -s * 0.4;
    box(fl, 0.16, 0.05, 0.16, m.belly, s * 0.42, 0, -0.17);
  }
  box(b, 0.1, 0.04, 0.1, m.dark, 0, 0.995, 0.25);
  let pv = pivot(b, 0, 1.0, 0.25);
  for (const [s, dx, dy] of [[0.18, 0.0, 0.1], [0.24, 0.07, 0.2], [0.28, -0.06, 0.24]]) {
    ball(pv, s / 2, 0xffffff, 0, 0.08, 0);
    swing(parts, pv, 'z', 0.5, 3.1, dx * 20);
    swing(parts, pv, 'x', 0.3, 2.3, dy * 9);
    const nx = pivot(pv, dx, dy, 0);
    pv = nx;
  }
  if (has(m, 'clouds')) {
    for (const s of [-1, 1]) {
      ball(b, 0.2, 0xffffff, s * 0.42, 0.28, -0.15);
      ball(b, 0.22, 0xffffff, s * 0.4, 0.3, 0.3);
      ball(b, 0.17, 0xf0f8ff, s * 0.5, 0.2, 0.05);
      ball(b, 0.15, 0xffffff, s * 0.2, 1.0, -0.2);
    }
    ball(b, 0.26, 0xffffff, 0, 1.0, -0.2);
    ball(b, 0.18, 0xf0f8ff, 0, 1.18, -0.2);
  }
}

// A pinwheel flower: a spinning four-colour wheel with a smiling hub, on a sway-y stem with leaf feet.
function pinwheel(root, m, parts) {
  const sway = pivot(root, 0, 0, 0);
  swing(parts, sway, 'z', 0.07, 2.2);
  box(sway, 0.3, 0.62, 0.26, m.body, 0, 0.55, -0.02);
  box(sway, 0.2, 0.3, 0.2, m.body, 0, 0.95, -0.05);
  box(sway, 0.18, 0.2, 0.02, 0x9ae080, 0, 0.5, 0.125);
  parts.legs = [];
  for (const s of [-1, 1]) {
    const leg = pivot(sway, s * 0.1, 0.2, 0);
    box(leg, 0.1, 0.18, 0.1, m.body, 0, -0.09, 0);
    box(leg, 0.2, 0.05, 0.3, 0x8ae070, s * 0.02, -0.18, 0.06);
    box(leg, 0.12, 0.04, 0.12, m.dark, s * 0.02, -0.17, 0.2);
    parts.legs.push({ g: leg, phase: s > 0 ? 0 : Math.PI });
  }
  parts.arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(sway, s * 0.17, 0.72, 0);
    box(arm, 0.28, 0.05, 0.14, 0x8ae070, s * 0.14, -0.04, 0).rotation.z = -s * 0.35;
    parts.arms.push({ g: arm, phase: s * 1.5 });
  }
  const wheel = pivot(sway, 0, 1.2, 0.0);
  const blades = pivot(wheel, 0, 0, 0);
  const cols = [m.accent, m.belly, 0xffd84a, 0xffffff];
  for (let k = 0; k < 4; k++) {
    const bl = pivot(blades, 0, 0, 0);
    bl.rotation.z = k * Math.PI / 2;
    const c = cols[k];
    const dk = new THREE.Color(c).multiplyScalar(0.8).getHex();
    [[0.56, 0.14], [0.42, 0.14], [0.28, 0.14], [0.14, 0.12]].forEach(([w, h], r) => {
      box(bl, w, h, 0.05, c, 0.03 + w / 2, 0.02 + r * 0.14 + h / 2, 0);
      box(bl, w * 0.55, h, 0.03, dk, 0.03 + w * 0.6, 0.02 + r * 0.14 + h / 2, 0.04);
    });
  }
  spin(parts, blades, 'z', 2.4);
  const hub = pivot(wheel, 0, 0, 0.04);
  ball(hub, 0.2, 0xfffbe8);
  box(hub, 0.44, 0.44, 0.03, m.dark, 0, 0, -0.1);
  eyes(hub, 0.04, 0.205, 0.08, 0.1);
  mouth(hub, -0.09, 0.205, 0.1);
  for (const s of [-1, 1]) box(hub, 0.06, 0.04, 0.02, 0xff9ab0, s * 0.15, -0.04, 0.2);
}

const SHAPES_SKY = { kite, balloon, skywhale, pinwheel };
/* ==== end of T9 sky shapes ==== */

/* ==== T9 slime shapes ==== */
// Goo helper: makes a part see-through and soft.
function gooSlime(mesh, opacity = 0.8) {
  mesh.traverse(o => {
    if (!o.isMesh) return;
    o.material.transparent = true;
    o.material.opacity = opacity;
    o.material.depthWrite = false;
  });
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
  gooBoxSlime(body, 0.74, 0.3, 0.68, m.body, 0, 0.33, 0, 0.8);
  gooBoxSlime(body, 0.46, 0.26, 0.44, m.body, 0, 0.59, 0, 0.8);
  gooBoxSlime(body, 0.26, 0.24, 0.26, m.body, 0, 0.8, 0, 0.82);
  // the curl
  gooBoxSlime(body, 0.16, 0.2, 0.16, m.body, 0, 1.02, 0, 0.85);
  gooBoxSlime(body, 0.12, 0.14, 0.16, m.body, 0, 1.17, 0.1, 0.85);
  gooBoxSlime(body, 0.1, 0.14, 0.12, m.body, 0, 1.08, 0.2, 0.85);
  glow(box(body, 0.06, 0.06, 0.06, m.accent, 0, 1.0, 0.22), m.accent);
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
    const c = pivot(body, 0, 0.74, 0);
    box(c, 0.38, 0.08, 0.36, m.accent, 0, 0, 0);
    for (const [x, z, h] of [[-0.14, 0.12, 0.14], [0.14, 0.12, 0.14], [0, 0.14, 0.2], [-0.14, -0.12, 0.12], [0.14, -0.12, 0.12]]) {
      box(c, 0.07, h, 0.07, m.accent, x, h / 2 + 0.04, z);
      glow(box(c, 0.06, 0.06, 0.06, 0xff4a6a, x, h + 0.07, z), 0xff4a6a);
    }
    glow(box(c, 0.08, 0.08, 0.04, 0x4ad0ff, 0, 0, 0.19), 0x4ad0ff);
  }
  if (has(m, 'cape')) {
    const c = pivot(body, 0, 0.62, -0.32);
    swing(parts, c, 'x', 0.1, 1.6);
    gooBoxSlime(c, 0.74, 0.46, 0.05, m.accent, 0, -0.25, -0.04, 0.85);
    gooBoxSlime(c, 0.6, 0.2, 0.05, m.accent, 0, -0.56, -0.04, 0.85);
    box(c, 0.5, 0.07, 0.08, 0xffffff, 0, 0.0, -0.02);
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
const seeLight = (mesh, opacity) => { mesh.material.transparent = true; mesh.material.opacity = opacity; mesh.material.depthWrite = false; return mesh; };

// A fox with a little sun on the end of its tail (Solvixen also gets a spinning sunray mane).
function sunfoxLight(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  box(body, 0.46, 0.4, 0.8, m.body, 0, 0.5, 0);
  box(body, 0.34, 0.2, 0.62, m.belly, 0, 0.36, 0.02);
  parts.legs = [];
  for (const [x, z, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
    const leg = pivot(body, x * 0.15, 0.32, z * 0.26);
    box(leg, 0.13, 0.32, 0.14, m.dark, 0, -0.16, 0);
    box(leg, 0.15, 0.05, 0.18, m.belly, 0, -0.3, 0.02);
    parts.legs.push({ g: leg, phase });
  }
  const head = pivot(body, 0, 0.72, 0.4);
  parts.head = head;
  box(head, 0.42, 0.34, 0.36, m.body, 0, 0, 0.04);
  box(head, 0.26, 0.17, 0.2, m.belly, 0, -0.08, 0.26);
  box(head, 0.09, 0.07, 0.05, 0x2a2a2a, 0, -0.03, 0.37);
  box(head, 0.1, 0.03, 0.03, 0x2a2a2a, 0, -0.14, 0.36);
  eyes(head, 0.06, 0.225, 0.12, 0.11);
  for (const s of [-1, 1]) {
    box(head, 0.06, 0.04, 0.02, 0xff9a9a, s * 0.19, -0.05, 0.225);
    box(head, 0.12, 0.2, 0.08, m.body, s * 0.14, 0.26, 0);
    box(head, 0.06, 0.13, 0.05, m.dark, s * 0.14, 0.24, 0.035);
  }
  glow(box(head, 0.1, 0.1, 0.04, m.accent, 0, 0.2, 0.185), m.accent);
  if (has(m, 'mane')) {
    const ring = pivot(body, 0, 0.74, 0.34);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      const ray = glow(box(ring, 0.12, 0.24, 0.1, m.accent, 0, 0, 0), m.accent);
      ray.position.set(Math.sin(a) * 0.36, Math.cos(a) * 0.36, -0.12);
      ray.rotation.z = -a;
    }
    spin(parts, ring, 'z', 0.5);
  }
  const tail = pivot(body, 0, 0.58, -0.4);
  parts.tail = tail;
  const long = has(m, 'mane') ? 1.05 : 1;
  box(tail, 0.2, 0.2, 0.4 * long, m.body, 0, 0.08, -0.2 * long);
  box(tail, 0.12, 0.12, 0.12, m.belly, 0, 0.08, -0.46 * long);
  const sun = pivot(tail, 0, 0.1, -0.58 * long);
  glow(box(sun, 0.22, 0.22, 0.22, m.accent, 0, 0, 0), m.accent);
  glow(box(sun, 0.12, 0.12, 0.24, 0xffffff, 0, 0, 0), 0xffffff);
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3;
    const ray = glow(box(sun, 0.07, 0.16, 0.07, m.accent, 0, 0, 0), m.accent);
    ray.position.set(Math.sin(a) * 0.2, Math.cos(a) * 0.2, 0);
    ray.rotation.z = -a;
  }
  spin(parts, sun, 'z', 1.6);
}

// A little lighthouse on two feet, with a lamp and a turning beam.
function lighthouseLight(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const big = has(m, 'beam');
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const leg = pivot(body, s * 0.17, 0.14, 0.04);
    box(leg, 0.2, 0.14, 0.3, m.dark, 0, -0.07, 0.05);
    parts.legs.push({ g: leg, phase });
  }
  const rows = [[0.7, m.body], [0.62, m.accent], [0.54, m.body], [0.47, m.accent]];
  let y = 0.14;
  const ys = [];
  for (const [w, c] of rows) { box(body, w, 0.24, w, c, 0, y + 0.12, 0); ys.push(y + 0.12); y += 0.24; }
  eyes(body, ys[1] + 0.03, 0.315, 0.12, 0.12);
  for (const s of [-1, 1]) box(body, 0.07, 0.05, 0.02, 0xff9a9a, s * 0.21, ys[1] - 0.06, 0.315);
  box(body, 0.14, 0.04, 0.02, 0x2a2a2a, 0, ys[1] - 0.08, 0.315);
  if (has(m, 'gallery')) {
    box(body, 0.14, 0.26, 0.04, m.dark, 0, 0.27, 0.355);
    box(body, 0.78, 0.05, 0.78, m.dark, 0, y + 0.02, 0);
    for (const s of [-1, 1]) { box(body, 0.78, 0.12, 0.04, m.dark, 0, y + 0.1, s * 0.37); box(body, 0.04, 0.12, 0.78, m.dark, s * 0.37, y + 0.1, 0); }
  } else box(body, 0.58, 0.05, 0.58, m.dark, 0, y + 0.02, 0);
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(body, s * 0.36, 0.5, 0.0);
    box(arm, 0.1, 0.3, 0.12, m.body, s * 0.04, -0.12, 0);
    parts.arms.push({ g: arm, phase });
  }
  const top = y + 0.05;
  seeLight(box(body, 0.4, 0.34, 0.4, 0xdff6ff, 0, top + 0.17, 0), 0.35);
  parts.tip = glow(box(body, 0.2, 0.2, 0.2, m.belly, 0, top + 0.17, 0), m.belly);
  box(body, 0.5, 0.07, 0.5, m.dark, 0, top + 0.37, 0);
  box(body, 0.34, 0.1, 0.34, m.dark, 0, top + 0.45, 0);
  box(body, 0.1, 0.1, 0.1, m.dark, 0, top + 0.55, 0);
  const beam = pivot(body, 0, top + 0.17, 0);
  const len = big ? 1.0 : 0.8;
  glow(seeLight(box(beam, 0.12, 0.12, len * 2, m.belly, 0, 0, 0), 0.6), m.belly);
  glow(seeLight(box(beam, 0.07, 0.07, len * 2, 0xffffff, 0, 0, 0), 0.5), 0xffffff);
  spin(parts, beam, 'y', 1.8);
}

// A fluffy chick (Sunrooster: a grown-up rooster) with a half-sun comb.
function roosterLight(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const big = has(m, 'tailfan');
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const leg = pivot(body, s * 0.14, 0.3, 0.02);
    box(leg, 0.06, 0.3, 0.06, m.accent, 0, -0.15, 0);
    for (const t of [-1, 0, 1]) box(leg, 0.04, 0.04, 0.16, m.accent, t * 0.06, -0.29, 0.06).rotation.y = t * 0.3;
    parts.legs.push({ g: leg, phase });
  }
  box(body, 0.62, 0.5, 0.66, m.body, 0, 0.55, 0);
  box(body, 0.5, 0.2, 0.5, m.belly, 0, 0.4, 0.1);
  box(body, 0.5, 0.2, 0.3, m.body, 0, 0.88, 0.05);
  const head = pivot(body, 0, 0.98, 0.18);
  parts.head = head;
  box(head, 0.4, 0.36, 0.38, m.body, 0, 0.1, 0.05);
  eyes(head, 0.14, 0.245, 0.12, 0.12);
  for (const s of [-1, 1]) box(head, 0.07, 0.05, 0.02, 0xff9a9a, s * 0.19, 0.04, 0.245);
  box(head, 0.16, 0.08, 0.14, m.accent, 0, 0.06, 0.3);
  box(head, 0.12, 0.06, 0.12, m.accent, 0, 0.0, 0.3);
  box(head, 0.06, 0.12, 0.05, 0xe03a3a, 0, -0.08, 0.28);
  // half-sun comb: a glowing semi-disc with rays that sway
  const sunCol = big ? 0xff8a2a : 0xffc84a;
  const comb = pivot(head, 0, 0.28, 0.02);
  glow(box(comb, 0.3, 0.08, 0.12, sunCol, 0, 0.04, 0), sunCol);
  glow(box(comb, 0.2, 0.08, 0.12, 0xffe680, 0, 0.12, 0), 0xffe680);
  const rays = pivot(comb, 0, 0.14, 0);
  for (let k = 0; k < 5; k++) {
    const d = k - 2;
    const r = glow(box(rays, 0.06, 0.14, 0.06, sunCol, d * 0.13, 0.04 - Math.abs(d) * 0.03, 0), sunCol);
    r.rotation.z = -d * 0.4;
  }
  swing(parts, rays, 'z', 0.1, 3);
  parts.wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, s * 0.33, 0.62, 0);
    box(w, 0.1, 0.34, 0.4, m.body, s * 0.05, -0.12, 0);
    box(w, 0.08, 0.14, 0.34, m.belly, s * 0.07, -0.3, 0);
    parts.wings.push({ g: w, s, lift: 0 });
  }
  if (!big) {
    box(body, 0.24, 0.3, 0.14, m.body, 0, 0.68, -0.38).rotation.x = -0.4;
    box(body, 0.12, 0.2, 0.1, m.belly, 0, 0.8, -0.44).rotation.x = -0.4;
  } else {
    const fan = pivot(body, 0, 0.7, -0.34);
    fan.rotation.x = -0.5;
    const cols = [0xe03a2a, 0xff6a2a, 0xffa030, 0xffc84a, 0xffe680];
    cols.forEach((c, k) => {
      const lean = pivot(fan, 0, 0, 0);
      lean.rotation.z = (k - 2) * 0.42;
      const f = pivot(lean, 0, 0, 0);
      glow(box(f, 0.14, 0.7, 0.07, c, 0, 0.36, 0), c);
      glow(box(f, 0.08, 0.14, 0.08, 0xfff6c0, 0, 0.72, 0), 0xfff6c0);
      swing(parts, f, 'x', 0.12, 2 + k * 0.3, k);
    });
  }
}

// A disco mirror ball: spinning tiles, a face that stays put, a dancing little body.
function mirrorballLight(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  const ballG = pivot(body, 0, 0.55, 0);
  box(body, 0.05, 0.14, 0.05, m.dark, 0, 1.03, 0);
  box(body, 0.16, 0.04, 0.04, m.dark, 0, 1.1, 0);
  const greys = [0xd8e0e8, 0xf0f4f8, 0xbcc8d4, 0xe4eaf0];
  const spots = [0xff8ad8, 0x7ad8ff, 0xffe07a];
  box(ballG, 0.5, 0.5, 0.5, 0x8a94a4, 0, 0, 0);
  let n = 0;
  for (const [y, r, count] of [[0.3, 0.3, 8], [0.1, 0.37, 10], [-0.1, 0.37, 10], [-0.3, 0.3, 8]]) {
    for (let k = 0; k < count; k++) {
      const a = k * Math.PI * 2 / count + (y === 0 ? 0 : 0.3);
      const lit = (n % 4) === 2;
      const tile = box(ballG, 0.2, 0.22, 0.07, lit ? spots[n % 3] : greys[n % 4], Math.sin(a) * r, y, Math.cos(a) * r);
      tile.rotation.y = a;
      if (lit) glow(tile, spots[n % 3]);
      n++;
    }
  }
  box(ballG, 0.3, 0.07, 0.3, greys[1], 0, 0.42, 0);
  box(ballG, 0.3, 0.07, 0.3, greys[2], 0, -0.42, 0);
  spin(parts, ballG, 'y', 0.9);
  // sparkles circling the ball
  const sp = pivot(body, 0, 0.55, 0);
  for (const [x, y, z, c] of [[0.52, 0.3, 0.1, 0xffffff], [-0.52, -0.1, 0.1, 0xffe07a], [0.0, 0.55, 0.3, 0x7ad8ff]]) {
    glow(box(sp, 0.07, 0.07, 0.07, c, x, y, z), c);
  }
  swing(parts, sp, 'y', 0.9, 2.2);
  // face, on its own so it does not spin
  const face = pivot(body, 0, 0.55, 0.4);
  box(face, 0.34, 0.26, 0.05, 0xf4f4fa, 0, 0, 0.02);
  eyes(face, 0.05, 0.06, 0.08, 0.1);
  for (const s of [-1, 1]) box(face, 0.06, 0.04, 0.02, 0xff9ad8, s * 0.14, -0.04, 0.055);
  box(face, 0.14, 0.05, 0.02, 0x2a2a2a, 0, -0.06, 0.055);
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const a = pivot(body, s * 0.5, 0.5, 0.05);
    box(a, 0.1, 0.3, 0.1, m.dark, s * 0.05, -0.1, 0.03);
    box(a, 0.12, 0.1, 0.12, greys[1], s * 0.06, -0.28, 0.03);
    parts.arms.push({ g: a, phase });
  }
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const l = pivot(body, s * 0.14, 0.2, 0);
    box(l, 0.1, 0.2, 0.1, m.dark, 0, -0.1, 0);
    box(l, 0.16, 0.05, 0.22, m.accent, 0, -0.2, 0.04);
    parts.legs.push({ g: l, phase });
  }
}

const SHAPES_LIGHT = { sunfox: sunfoxLight, lighthouse: lighthouseLight, rooster: roosterLight, mirrorball: mirrorballLight };
/* ==== end of T9 light shapes ==== */

/* ==== T9 paper shapes ==== */
// A folded paper plane: keel, swept wings with fold lines, a friendly face on the nose.
function paperplane(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  const jet = m.extras.includes('jet');
  box(body, 0.24, 0.26, 0.8, m.body, 0, 0.5, -0.1);
  box(body, 0.06, 0.06, 0.82, m.accent, 0, 0.66, -0.1);
  box(body, 0.06, 0.06, 0.82, m.accent, 0, 0.34, -0.1);
  const head = pivot(body, 0, 0.5, 0.36);
  parts.head = head;
  box(head, 0.32, 0.3, 0.26, m.body, 0, 0, 0);
  box(head, 0.1, 0.1, 0.22, m.accent, 0, -0.07, 0.23);
  box(head, 0.04, 0.3, 0.04, m.dark, 0, 0, 0.14);
  eyes(head, 0.06, 0.135, 0.08, 0.1);
  box(head, 0.12, 0.03, 0.03, m.dark, 0, -0.1, 0.14);
  // wings: wide at the back, tapering toward the nose; fold lines along the edges
  parts.wings = parts.wings || [];
  const wing = (z, s, scale, lift) => {
    const g = pivot(body, s * 0.1, 0.52, z);
    box(g, 0.5 * scale, 0.03, 0.7 * scale, m.body, s * 0.25 * scale, 0, -0.05);
    box(g, 0.4 * scale, 0.03, 0.5 * scale, m.belly, s * 0.62 * scale, 0, -0.15 * scale);
    box(g, 0.24 * scale, 0.03, 0.26 * scale, m.body, s * 0.92 * scale, 0, -0.26 * scale);
    box(g, 0.9 * scale, 0.04, 0.04, m.accent, s * 0.5 * scale, 0.01, 0.3 * scale);
    box(g, 0.04, 0.04, 0.6 * scale, m.dark, s * 0.18 * scale, 0.02, -0.05);
    g.rotation.z = s * lift;
    parts.wings.push({ g, s, lift });
  };
  for (const s of [-1, 1]) wing(-0.05, s, 0.9, 0.18);
  box(body, 0.04, 0.3, 0.3, m.accent, 0, 0.72, -0.4);
  if (jet) {
    for (const s of [-1, 1]) wing(-0.4, s, 0.55, 0.12);
    for (const s of [-1, 1]) box(body, 0.03, 0.27, 0.5, m.accent, s * 0.125, 0.5, -0.1);
    box(body, 0.26, 0.2, 0.1, m.dark, 0, 0.5, -0.55);
    glow(box(body, 0.12, 0.12, 0.08, 0xffb040, 0, 0.5, -0.62), 0xff9020);
  }
}

// A folded origami frog: diamond body, crease down the back, strong folded back legs.
function origamifrog(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const pattern = m.extras.includes('pattern');
  const d = box(body, 0.6, 0.34, 0.6, m.body, 0, 0.38, -0.05);
  d.rotation.y = Math.PI / 4;
  const top = box(body, 0.4, 0.14, 0.4, m.belly, 0, 0.58, -0.05);
  top.rotation.y = Math.PI / 4;
  box(body, 0.05, 0.05, 0.8, m.accent, 0, 0.66, -0.05);
  box(body, 0.05, 0.05, 0.8, m.dark, 0, 0.21, -0.05);
  if (pattern) {
    for (const [x, z] of [[-0.18, -0.2], [0.16, -0.12], [-0.1, 0.05], [0.2, 0.08]]) box(body, 0.1, 0.03, 0.1, m.accent, x, 0.67, z).rotation.y = Math.PI / 4;
    for (const s of [-1, 1]) box(body, 0.03, 0.12, 0.12, m.accent, s * 0.3, 0.45, -0.05);
  }
  const head = pivot(body, 0, 0.45, 0.3);
  parts.head = head;
  box(head, 0.44, 0.26, 0.28, m.body, 0, 0, 0);
  box(head, 0.44, 0.04, 0.04, m.accent, 0, 0.14, 0.12);
  for (const s of [-1, 1]) box(head, 0.16, 0.14, 0.16, m.belly, s * 0.13, 0.19, 0.0);
  eyes(head, 0.2, 0.085, 0.13, 0.11);
  box(head, 0.3, 0.035, 0.03, m.dark, 0, -0.06, 0.145);
  for (const s of [-1, 1]) box(head, 0.04, 0.05, 0.03, m.dark, s * 0.17, -0.04, 0.145);
  parts.legs = parts.legs || [];
  for (const s of [-1, 1]) {
    const g = pivot(body, s * 0.33, 0.3, -0.2);
    const th = box(g, 0.14, 0.34, 0.3, m.body, s * 0.04, 0, -0.04);
    th.rotation.x = -0.4;
    box(g, 0.12, 0.05, 0.36, m.accent, s * 0.04, -0.18, 0.08);
    box(g, 0.2, 0.05, 0.3, m.belly, s * 0.05, -0.3, 0.2);
    parts.legs.push({ g, side: 0, phase: s > 0 ? 0 : 0.4 });
    const f = pivot(body, s * 0.2, 0.28, 0.4);
    box(f, 0.1, 0.3, 0.1, m.body, 0, -0.12, 0);
    box(f, 0.16, 0.04, 0.2, m.belly, 0, -0.28, 0.05);
    parts.legs.push({ g: f, side: 0, phase: s > 0 ? 3 : 3.4 });
  }
  parts.wobble = parts.wobble || [];
  parts.wobble.push({ g: head, axis: 'z', speed: 1.8, phase: 0, amp: 0.05 });
}

// A talking storybook that opens and closes like a mouth, with a page that flutters.
function book(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const grand = m.extras.includes('clasp');
  box(body, 0.72, 0.06, 0.62, m.body, 0, 0.3, 0);
  box(body, 0.72, 0.66, 0.1, m.body, 0, 0.6, -0.3);
  box(body, 0.74, 0.05, 0.12, m.accent, 0, 0.8, -0.3);
  box(body, 0.74, 0.05, 0.12, m.accent, 0, 0.4, -0.3);
  box(body, 0.64, 0.5, 0.5, m.belly, 0, 0.58, 0.0);
  for (const y of [0.45, 0.58, 0.71]) box(body, 0.65, 0.015, 0.51, 0xe0d4b8, 0, y, 0.0);
  eyes(body, 0.62, 0.255, 0.14, 0.13);
  box(body, 0.26, 0.04, 0.03, m.dark, 0, 0.47, 0.255);
  for (const s of [-1, 1]) box(body, 0.1, 0.05, 0.03, 0xff9aa8, s * 0.24, 0.5, 0.255);
  const lid = pivot(body, 0, 0.88, -0.25);
  box(lid, 0.72, 0.06, 0.62, m.body, 0, 0, 0.31);
  box(lid, 0.6, 0.02, 0.5, m.accent, 0, 0.035, 0.31);
  parts.wobble = parts.wobble || [];
  parts.wobble.push({ g: lid, axis: 'x', speed: 2.2, phase: 0, amp: 0.1 });
  const page = pivot(body, 0.15, 0.93, 0.0);
  box(page, 0.3, 0.02, 0.36, m.belly, 0.15, 0.03, 0);
  box(page, 0.2, 0.02, 0.02, 0xc0b498, 0.15, 0.045, 0.06);
  parts.wobble.push({ g: page, axis: 'z', speed: 5, phase: 1, amp: 0.35 });
  parts.legs = parts.legs || [];
  for (const s of [-1, 1]) {
    const g = pivot(body, s * 0.2, 0.3, 0.05);
    box(g, 0.14, 0.2, 0.14, m.dark, 0, -0.1, 0);
    box(g, 0.2, 0.05, 0.26, m.dark, 0, -0.22, 0.05);
    parts.legs.push({ g, side: 0, phase: s > 0 ? 0 : Math.PI });
  }
  if (grand) {
    for (const [x, z] of [[-0.36, 0.3], [0.36, 0.3], [-0.36, -0.3], [0.36, -0.3]]) box(body, 0.06, 0.06, 0.06, m.accent, x, 0.3, z);
    box(lid, 0.1, 0.12, 0.04, m.accent, 0, -0.04, 0.63);
    const rib = pivot(body, 0.08, 0.45, 0.26);
    box(rib, 0.07, 0.2, 0.02, 0xe04a4a, 0, -0.1, 0);
    box(rib, 0.035, 0.05, 0.02, 0xe04a4a, -0.02, -0.22, 0);
    box(rib, 0.035, 0.05, 0.02, 0xe04a4a, 0.02, -0.22, 0);
    parts.wobble.push({ g: rib, axis: 'z', speed: 3, phase: 0, amp: 0.15 });
  }
}

// A jigsaw piece with knobs and dents that sways as it thinks, with a spinning idea sparkle.
function puzzle(root, m, parts) {
  const outer = pivot(root, 0, 0, 0);
  parts.bounce = outer;
  const sway = pivot(outer, 0, 0.62, 0);
  parts.wobble = parts.wobble || [];
  parts.wobble.push({ g: sway, axis: 'z', speed: 1.6, phase: 0, amp: 0.12 });
  box(sway, 0.7, 0.7, 0.18, m.body, 0, 0, 0);
  box(sway, 0.7, 0.04, 0.2, m.dark, 0, 0.33, 0);
  box(sway, 0.04, 0.7, 0.2, m.dark, -0.33, 0, 0);
  box(sway, 0.1, 0.12, 0.18, m.body, 0.12, 0.4, 0);
  box(sway, 0.26, 0.2, 0.18, m.body, 0.12, 0.52, 0);
  box(sway, 0.12, 0.1, 0.18, m.body, 0.4, -0.1, 0);
  box(sway, 0.2, 0.26, 0.18, m.body, 0.52, -0.1, 0);
  box(sway, 0.1, 0.22, 0.2, m.dark, -0.32, 0.12, 0);
  box(sway, 0.22, 0.1, 0.2, m.dark, -0.1, -0.32, 0);
  eyes(sway, 0.1, 0.095, 0.15, 0.15);
  box(sway, 0.2, 0.035, 0.03, m.dark, 0, -0.13, 0.1);
  box(sway, 0.07, 0.07, 0.03, m.accent, 0.22, -0.02, 0.1);
  box(sway, 0.07, 0.07, 0.03, m.accent, -0.22, -0.02, 0.1);
  for (const s of [-1, 1]) {
    box(outer, 0.18, 0.14, 0.2, m.accent, s * 0.2, 0.07, 0.04);
    box(outer, 0.1, 0.12, 0.1, m.accent, s * 0.2, 0.2, 0.0);
  }
  const idea = pivot(sway, 0.0, 0.88, 0);
  parts.spin = parts.spin || [];
  parts.spin.push({ g: idea, axis: 'y', speed: 2.5 });
  glow(box(idea, 0.12, 0.12, 0.12, m.accent, 0, 0, 0), m.accent);
  glow(box(idea, 0.06, 0.2, 0.06, m.accent, 0, 0, 0), m.accent);
  glow(box(idea, 0.2, 0.06, 0.06, m.accent, 0, 0, 0), m.accent);
  glow(box(idea, 0.06, 0.06, 0.2, m.accent, 0, 0, 0), m.accent);
}

const SHAPES_PAPER = { paperplane, origamifrog, book, puzzle };
/* ==== end of T9 paper shapes ==== */

/* ==== T18 time shapes ==== */
const glassTime = mesh => { mesh.material.transparent = true; mesh.material.opacity = 0.5; return mesh; };
// A round-ish (octagon) flat plate: two crossed flat boxes.
const octTime = (parent, d, thick, color, x, y, z) => {
  box(parent, d, d * 0.42, thick, color, x, y, z);
  box(parent, d * 0.42, d, thick, color, x, y, z);
  const a = box(parent, d * 0.8, d * 0.8, thick, color, x, y, z);
  a.rotation.z = Math.PI / 4;
};
// A clock dial: plate, 12 tick marks and two hands that turn (minute fast, hour slow).
function dialTime(parent, parts, m, x, y, z, r, color = 0xffffff) {
  octTime(parent, r * 2, 0.04, color, x, y, z);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, big = i % 3 === 0;
    const t = box(parent, big ? 0.045 : 0.03, big ? r * 0.2 : r * 0.12, 0.03, m.dark, x + Math.sin(a) * r * 0.82, y + Math.cos(a) * r * 0.82, z + 0.025);
    t.rotation.z = -a;
  }
  const hour = pivot(parent, x, y, z + 0.05), minute = pivot(parent, x, y, z + 0.07);
  box(hour, 0.05, r * 0.45, 0.025, m.dark, 0, r * 0.2, 0);
  box(minute, 0.035, r * 0.68, 0.025, m.dark, 0, r * 0.3, 0);
  box(parent, 0.07, 0.07, 0.04, m.accent, x, y, z + 0.08);
  parts.spin = parts.spin || [];
  parts.spin.push({ g: hour, axis: 'z', speed: -0.15 }, { g: minute, axis: 'z', speed: -1.3 });
}

// Two wooden plates, thin pillars and two glass bulbs of sand; it rocks on the spot as if about to flip.
function hourglass(root, m, parts) {
  const big = has(m, 'arms');
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const rock = pivot(body, 0, 0, 0);
  swing(parts, rock, 'z', 0.22, 1.3);
  const o = 0.14;
  const sand = m.accent, wood = m.body;
  box(rock, 0.96, 0.1, 0.96, wood, 0, o + 0.05, 0);
  box(rock, 0.96, 0.1, 0.96, wood, 0, o + 1.25, 0);
  box(rock, 1.02, 0.04, 1.02, m.dark, 0, o + 0.12, 0);
  box(rock, 1.02, 0.04, 1.02, m.dark, 0, o + 1.18, 0);
  for (const [x, z] of [[-0.43, 0.0], [0.43, 0.0], [0, -0.42]]) box(rock, 0.08, 1.2, 0.08, wood, x, o + 0.65, z);
  // lower and upper bulbs: three stacked boxes each, narrowing to the neck
  const lower = [[0.74, 0.22, 0.24], [0.54, 0.44, 0.2], [0.3, 0.6, 0.12]];
  for (const [w, y, h] of lower) {
    glassTime(box(rock, w, h, w, m.belly, 0, o + y, 0));
    glassTime(box(rock, w, h, w, m.belly, 0, o + 1.3 - y, 0));
  }
  box(rock, 0.1, 0.1, 0.1, m.belly, 0, o + 0.65, 0);
  // sand: a pile below, a smaller heap above and a thin stream through the neck
  box(rock, 0.6, 0.2, 0.6, sand, 0, o + 0.21, 0);
  box(rock, 0.36, 0.12, 0.36, sand, 0, o + 0.36, 0);
  box(rock, 0.46, 0.16, 0.46, sand, 0, o + 0.98, 0);
  swing(parts, rock, 'x', 0.04, 0.9);
  box(rock, 0.05, 0.32, 0.05, sand, 0, o + 0.5, 0);
  // face on the lower glass
  eyes(rock, o + 0.43, 0.285, 0.14, 0.12);
  box(rock, 0.14, 0.04, 0.03, m.dark, 0, o + 0.3, 0.375);
  // little walking feet
  parts.legs = parts.legs || [];
  for (const s of [-1, 1]) {
    const g = pivot(body, s * 0.26, o, 0.28);
    box(g, 0.2, 0.14, 0.26, m.dark, 0, -0.07, 0.03);
    parts.legs.push({ g, side: 0, phase: s > 0 ? 0 : Math.PI });
  }
  if (big) {
    rock.scale.y = 1.05;
    parts.arms = [];
    for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
      const arm = pivot(rock, s * 0.56, o + 0.8, 0.04);
      box(arm, 0.14, 0.5, 0.16, wood, 0, -0.22, 0);
      box(arm, 0.22, 0.2, 0.22, m.dark, 0, -0.52, 0.02);
      parts.arms.push({ g: arm, phase });
    }
    // a swirl of sand in the upper bulb
    for (let k = 0; k < 4; k++) {
      const sw = pivot(rock, 0, o + 1.0 + (k % 2) * 0.07, 0);
      glow(box(sw, 0.07, 0.07, 0.07, sand, 0.2 + (k % 2) * 0.05, 0, 0), sand);
      sw.rotation.y = k * 1.57;
      spin(parts, sw, 'y', 2.4 + (k % 2) * 0.8);
    }
  }
}

// A metronome on one hopping leg with a ticking pendulum; the evolved one is a tall grandfather clock.
function pendulum(root, m, parts) {
  const grand = has(m, 'grand');
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.legs = parts.legs || [];
  if (!grand) {
    const leg = pivot(body, 0, 0.3, 0.02);
    box(leg, 0.14, 0.3, 0.14, m.dark, 0, -0.15, 0);
    box(leg, 0.3, 0.06, 0.42, m.dark, 0, -0.3, 0.07);
    parts.legs.push({ g: leg, side: 0, phase: 0 });
    box(body, 0.8, 0.36, 0.7, m.body, 0, 0.48, 0);
    box(body, 0.62, 0.34, 0.54, m.body, 0, 0.83, 0);
    box(body, 0.44, 0.32, 0.38, m.body, 0, 1.16, 0);
    for (const [y, w, d] of [[0.31, 0.82, 0.72], [0.66, 0.64, 0.56], [0.99, 0.46, 0.4]]) box(body, w, 0.045, d, m.accent, 0, y, 0);
    box(body, 0.46, 0.08, 0.32, m.accent, 0, 1.34, 0);
    box(body, 0.6, 0.3, 0.03, m.belly, 0, 0.48, 0.355);
    eyes(body, 0.52, 0.375, 0.15, 0.12);
    box(body, 0.14, 0.04, 0.03, m.dark, 0, 0.4, 0.38);
    // the slot on the upper part, and the pendulum rod that ticks across it
    box(body, 0.08, 0.6, 0.03, m.dark, 0, 0.92, 0.275);
    const arm = pivot(body, 0, 0.7, 0.3);
    box(arm, 0.04, 0.8, 0.04, m.accent, 0, 0.4, 0);
    box(arm, 0.17, 0.14, 0.08, m.accent, 0, 0.62, 0);
    box(arm, 0.08, 0.08, 0.07, m.dark, 0, 0.0, 0);
    swing(parts, arm, 'z', 0.45, 3.2);
    return;
  }
  for (const s of [-1, 1]) {
    const g = pivot(body, s * 0.26, 0.2, 0.05);
    box(g, 0.2, 0.2, 0.34, m.dark, 0, -0.1, 0.04);
    parts.legs.push({ g, side: 0, phase: s > 0 ? 0 : Math.PI });
  }
  box(body, 0.92, 0.12, 0.74, m.dark, 0, 0.26, 0);
  box(body, 0.74, 0.8, 0.6, m.body, 0, 0.72, 0);
  box(body, 0.78, 0.04, 0.64, m.accent, 0, 1.14, 0);
  // glass door with the pendulum swinging behind it
  box(body, 0.54, 0.64, 0.03, m.dark, 0, 0.72, 0.305);
  glassTime(box(body, 0.46, 0.56, 0.03, m.belly, 0, 0.72, 0.32));
  const arm = pivot(body, 0, 0.98, 0.25);
  box(arm, 0.04, 0.46, 0.03, m.accent, 0, -0.23, 0);
  box(arm, 0.18, 0.18, 0.04, m.accent, 0, -0.47, 0);
  swing(parts, arm, 'z', 0.5, 2.4);
  // the clock head with a round dial, eyes above it
  box(body, 0.84, 0.6, 0.66, m.body, 0, 1.44, 0);
  box(body, 0.96, 0.1, 0.78, m.dark, 0, 1.79, 0);
  dialTime(body, parts, m, 0, 1.36, 0.33, 0.22, m.belly);
  eyes(body, 1.66, 0.34, 0.2, 0.12);
  box(body, 0.14, 0.12, 0.03, m.accent, 0, 1.9, 0.0);
}

// A round alarm clock with a dial face, two ringing bells for ears and a little hammer between them.
function alarmclock(root, m, parts) {
  const big = has(m, 'hammers');
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const cy = 0.66;
  const shell = ball(body, 0.44, m.body, 0, cy, 0);
  shell.scale.z = 0.72;
  const rim = ball(body, 0.47, m.dark, 0, cy, -0.04);
  rim.scale.z = 0.6;
  dialTime(body, parts, m, 0, cy, 0.31, 0.3, m.belly);
  eyes(body, cy + 0.15, 0.36, 0.1, 0.1);
  box(body, 0.16, 0.035, 0.03, m.dark, 0, cy - 0.2, 0.355);
  // two bells on tilted stems that shake while ringing
  const br = big ? 0.22 : 0.17;
  for (const [s, ph] of [[-1, 0], [1, 1.6]]) {
    const stem = pivot(body, s * 0.3, cy + 0.38, 0);
    stem.rotation.z = -s * 0.6;
    box(stem, 0.06, 0.1, 0.06, m.dark, 0, 0.05, 0);
    const bell = pivot(stem, 0, 0.1, 0);
    ball(bell, br, m.accent, 0, br * 0.85, 0);
    box(bell, br * 0.5, br * 0.4, br * 0.5, m.dark, 0, br * 1.9, 0);
    swing(parts, bell, 'z', 0.28, 11, ph);
  }
  const ham = pivot(body, 0, cy + 0.45, 0);
  box(ham, 0.05, 0.22, 0.05, m.dark, 0, 0.11, 0);
  box(ham, 0.16, 0.08, 0.1, m.dark, 0, 0.24, 0);
  swing(parts, ham, 'z', 0.5, 11, 3);
  parts.legs = parts.legs || [];
  for (const s of [-1, 1]) {
    const g = pivot(body, s * (big ? 0.26 : 0.2), big ? 0.42 : 0.28, 0.05);
    if (big) {
      box(g, 0.09, 0.36, 0.09, m.dark, 0, -0.18, 0);
      box(g, 0.34, 0.16, 0.24, m.accent, 0, -0.38, 0.02);
    } else {
      box(g, 0.16, 0.2, 0.18, m.dark, 0, -0.1, 0);
      box(g, 0.22, 0.06, 0.3, m.dark, 0, -0.26, 0.05);
    }
    parts.legs.push({ g, side: 0, phase: s > 0 ? 0 : Math.PI });
  }
  if (big) {
    // a carry handle over the top
    box(body, 0.06, 0.2, 0.06, m.accent, -0.2, cy + 0.56, 0);
    box(body, 0.06, 0.2, 0.06, m.accent, 0.2, cy + 0.56, 0);
    box(body, 0.46, 0.06, 0.06, m.accent, 0, cy + 0.68, 0);
  }
}

// A ball that is half sunny day and half starry night, turning slowly, with a sleepy face that does not.
function sunmoon(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  const cy = 0.55;
  const ballG = pivot(body, 0, cy, 0);
  spin(parts, ballG, 'y', 0.5);
  for (const s of [-1, 1]) {
    const c = s < 0 ? m.body : m.accent;
    box(ballG, 0.4, 0.62, 0.62, c, s * 0.2, 0, 0);
    box(ballG, 0.36, 0.8, 0.46, c, s * 0.2, 0, 0);
    box(ballG, 0.36, 0.46, 0.8, c, s * 0.2, 0, 0);
    box(ballG, 0.14, 0.5, 0.5, c, s * 0.42, 0, 0);
  }
  // rays on the sun side
  for (let k = 0; k < 7; k++) {
    const a = Math.PI / 2 + (k / 6) * Math.PI;
    const ray = box(ballG, 0.26, 0.08, 0.08, 0xfff0a0, Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0);
    ray.rotation.z = a;
    glow(ray, 0xffc23d);
  }
  // stars on the moon side
  for (const [x, y, z] of [[0.42, 0.18, 0.2], [0.36, -0.2, -0.28], [0.48, 0.0, -0.14], [0.3, 0.3, -0.2]]) glow(box(ballG, 0.08, 0.08, 0.08, 0xfff6c0, x, y, z), 0xfff6c0);
  // the face stays put in front
  const face = pivot(body, 0, cy, 0.58);
  box(face, 0.44, 0.3, 0.04, m.belly, 0, 0, 0);
  box(face, 0.13, 0.14, 0.04, 0xffffff, -0.1, 0.04, 0.03).userData.eye = true;
  box(face, 0.07, 0.09, 0.03, 0x111111, -0.09, 0.03, 0.06).userData.eye = true;
  box(face, 0.15, 0.035, 0.03, 0x222222, 0.1, 0.03, 0.04).userData.eye = true;
  box(face, 0.1, 0.035, 0.03, m.dark, 0, -0.1, 0.04);
  box(face, 0.06, 0.06, 0.03, 0xff9a7a, -0.17, -0.08, 0.03);
  box(face, 0.06, 0.06, 0.03, 0xff9a7a, 0.17, -0.08, 0.03);
  swing(parts, face, 'z', 0.06, 1.5);
}
const SHAPES_TIME = { hourglass, pendulum, alarmclock, sunmoon };
/* ==== end of T18 time shapes ==== */

/* ==== T18 camo shapes ==== */
// A cube of leaves with lighter clumps, a sleepy face and a twig; the evolved one is a hedge elephant.
function bushblock(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  if (!has(m, 'elephant')) {
    box(body, 0.82, 0.74, 0.82, m.body, 0, 0.5, 0);
    for (const [x, y, z, s] of [[-0.3, 0.8, 0.2, 0.28], [0.3, 0.82, -0.1, 0.3], [0, 0.88, 0.3, 0.22], [-0.42, 0.55, -0.1, 0.24], [0.43, 0.6, 0.2, 0.26],
      [-0.2, 0.9, -0.25, 0.26], [0.22, 0.28, 0.4, 0.2], [-0.35, 0.3, 0.4, 0.22], [0.1, 0.5, -0.43, 0.26]]) box(body, s, s * 0.8, s, m.accent, x, y, z);
    box(body, 0.5, 0.26, 0.03, m.belly, 0, 0.4, 0.415);
    for (const s of [-1, 1]) {
      box(body, 0.14, 0.15, 0.04, 0xffffff, s * 0.17, 0.55, 0.42).userData.eye = true;
      box(body, 0.08, 0.09, 0.03, 0x111111, s * 0.17 + s * 0.015, 0.53, 0.45).userData.eye = true;
      const lid = pivot(body, s * 0.17, 0.63, 0.46);
      box(lid, 0.19, 0.1, 0.04, m.dark, 0, -0.04, 0);
      swing(parts, lid, 'x', 0.45, 0.9, s > 0 ? 0 : 0.5);
    }
    box(body, 0.12, 0.03, 0.03, m.dark, 0, 0.4, 0.44);
    for (const s of [-1, 1]) box(body, 0.2, 0.12, 0.26, m.dark, s * 0.24, 0.06, 0.12);
    box(body, 0.05, 0.28, 0.05, 0x6a4a2a, 0.05, 1.01, 0);
    box(body, 0.14, 0.04, 0.09, m.accent, 0.14, 1.12, 0);
    box(body, 0.12, 0.04, 0.08, m.accent, -0.04, 1.06, 0);
    return;
  }
  // hedge elephant
  box(body, 0.92, 0.8, 0.9, m.body, 0, 0.95, -0.2);
  for (const [x, y, z, s] of [[-0.3, 1.4, -0.3, 0.3], [0.28, 1.4, 0.0, 0.3], [0.0, 1.42, -0.5, 0.28], [-0.5, 1.0, -0.1, 0.26], [0.5, 1.1, -0.4, 0.26], [-0.45, 1.2, -0.45, 0.24]]) box(body, s, s * 0.8, s, m.accent, x, y, z);
  parts.legs = parts.legs || [];
  for (const [x, z, ph] of [[-0.3, 0.2, 0], [0.3, 0.2, Math.PI], [-0.3, -0.5, Math.PI], [0.3, -0.5, 0]]) {
    const g = pivot(body, x, 0.55, z);
    box(g, 0.28, 0.55, 0.28, m.dark, 0, -0.27, 0);
    parts.legs.push({ g, side: 0, phase: ph });
  }
  const head = pivot(body, 0, 1.2, 0.55);
  parts.head = head;
  box(head, 0.76, 0.7, 0.56, m.body, 0, 0, 0);
  box(head, 0.26, 0.24, 0.26, m.accent, -0.2, 0.42, -0.1);
  box(head, 0.28, 0.2, 0.26, m.accent, 0.18, 0.4, 0.0);
  eyes(head, 0.1, 0.285, 0.22, 0.12);
  for (const s of [-1, 1]) {
    const ear = pivot(head, s * 0.4, 0.1, -0.05);
    box(ear, 0.07, 0.62, 0.5, m.accent, s * 0.2, 0, 0);
    box(ear, 0.05, 0.4, 0.34, m.belly, s * 0.22, -0.02, 0);
    swing(parts, ear, 'y', 0.3, 2.2, s > 0 ? 0 : Math.PI);
    box(head, 0.08, 0.18, 0.08, 0xfff6e0, s * 0.22, -0.2, 0.31);
    box(head, 0.14, 0.14, 0.06, 0xffffff, s * 0.22, -0.31, 0.31);
  }
  let parent = pivot(head, 0, -0.1, 0.3);
  for (let k = 0; k < 4; k++) {
    const w = 0.22 - k * 0.03;
    box(parent, w, 0.24, w, m.body, 0, -0.1, 0.0);
    const next = pivot(parent, 0, -0.2, 0.0);
    swing(parts, next, 'x', 0.1 + k * 0.04, 1.7, 0);
    parent = next;
  }
  box(body, 0.1, 0.18, 0.1, m.accent, 0, 1.0, -0.68);
}

// A block of sand with towers on the corners (the evolved one is a whole walking castle) and a flapping flag.
function sandcastle(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const keep = has(m, 'towers');
  const flag = (parent, x, y, z, ph) => {
    box(parent, 0.04, 0.4, 0.04, 0x8a6a3a, x, y + 0.2, z);
    const f = pivot(parent, x, y + 0.34, z);
    box(f, 0.3, 0.17, 0.03, m.accent, 0.17, 0, 0);
    swing(parts, f, 'y', 0.4, 4.5, ph);
  };
  parts.legs = parts.legs || [];
  if (!keep) {
    box(body, 0.84, 0.72, 0.84, m.body, 0, 0.5, 0);
    box(body, 0.86, 0.05, 0.86, m.dark, 0, 0.3, 0);
    box(body, 0.86, 0.04, 0.86, m.belly, 0, 0.68, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(body, 0.2, 0.2, 0.2, m.body, sx * 0.32, 0.96, sz * 0.32);
    for (const [x, z] of [[0, 0.32], [0, -0.32], [0.32, 0], [-0.32, 0]]) box(body, 0.18, 0.12, 0.18, m.body, x, 0.93, z);
    flag(body, 0, 0.86, 0, 0);
    box(body, 0.5, 0.32, 0.03, m.belly, 0, 0.5, 0.43);
    eyes(body, 0.56, 0.45, 0.14, 0.12);
    box(body, 0.2, 0.04, 0.03, m.dark, 0, 0.4, 0.45);
    for (const s of [-1, 1]) {
      const g = pivot(body, s * 0.22, 0.16, 0.12);
      box(g, 0.2, 0.16, 0.26, m.dark, 0, -0.07, 0.04);
      parts.legs.push({ g, side: 0, phase: s > 0 ? 0 : Math.PI });
    }
    return;
  }
  box(body, 1.04, 0.8, 0.92, m.body, 0, 0.62, 0);
  box(body, 1.06, 0.05, 0.94, m.dark, 0, 0.4, 0);
  box(body, 1.06, 0.04, 0.94, m.belly, 0, 0.86, 0);
  for (const [i, [sx, sz]] of [[-1, -1], [1, -1], [-1, 1], [1, 1]].entries()) {
    const tx = sx * 0.55, tz = sz * 0.47;
    box(body, 0.32, 1.08, 0.32, m.body, tx, 0.74, tz);
    box(body, 0.38, 0.1, 0.38, m.belly, tx, 1.3, tz);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(body, 0.1, 0.1, 0.1, m.body, tx + dx * 0.14, 1.4, tz + dz * 0.14);
    box(body, 0.1, 0.16, 0.03, m.dark, tx, 0.95, tz + sz * 0.165);
    if (i === 0 || i === 3) flag(body, tx, 1.35, tz, i);
    const g = pivot(body, tx * 0.8, 0.26, tz * 0.8);
    box(g, 0.22, 0.26, 0.22, m.dark, 0, -0.1, 0);
    parts.legs.push({ g, side: 0, phase: i % 3 === 0 ? 0 : Math.PI });
  }
  // gate with an arch, and the face above it
  box(body, 0.34, 0.34, 0.05, m.dark, 0, 0.58, 0.465);
  box(body, 0.24, 0.1, 0.05, m.dark, 0, 0.8, 0.465);
  box(body, 0.04, 0.34, 0.06, m.accent, 0, 0.58, 0.47);
  box(body, 0.66, 0.2, 0.03, m.belly, 0, 1.03, 0.465);
  eyes(body, 1.04, 0.485, 0.17, 0.13);
}

// A cobblestone cube with a hidden mouth that opens; the evolved one is a stern statue on a plinth.
function stonecube(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  if (!has(m, 'statue')) {
    box(body, 0.84, 0.8, 0.84, m.body, 0, 0.52, 0);
    for (const [x, y, z, w, h, c] of [[-0.3, 0.86, 0.43, 0.24, 0.12, m.accent], [0.3, 0.52, 0.43, 0.24, 0.12, m.accent], [0.3, 0.9, 0.2, 0.28, 0.06, m.accent],
      [-0.43, 0.6, -0.1, 0.03, 0.26, m.accent], [-0.43, 0.8, 0.2, 0.03, 0.2, m.dark], [0.43, 0.7, 0.0, 0.03, 0.28, m.accent], [-0.2, 0.92, -0.2, 0.3, 0.06, m.dark],
      [0.0, 0.5, -0.43, 0.3, 0.26, m.accent]]) {
      box(body, w, h, w < 0.05 ? 0.28 : 0.03, c, x, y, z);
    }
    // the hidden mouth: a dark slit with teeth, and a lower jaw that swings open
    box(body, 0.62, 0.14, 0.04, m.belly, 0, 0.36, 0.425);
    for (const x of [-0.2, 0, 0.2]) box(body, 0.07, 0.07, 0.03, 0xf0f0e0, x, 0.4, 0.45);
    const jaw = pivot(body, 0, 0.3, 0.42);
    box(jaw, 0.66, 0.1, 0.07, m.body, 0, -0.04, 0);
    for (const x of [-0.1, 0.1]) box(jaw, 0.06, 0.06, 0.03, 0xf0f0e0, x, 0.03, 0.04);
    swing(parts, jaw, 'x', 0.4, 1.5);
    eyes(body, 0.72, 0.43, 0.2, 0.1);
    for (const s of [-1, 1]) box(body, 0.16, 0.03, 0.03, m.dark, s * 0.2, 0.82, 0.43);
    for (const s of [-1, 1]) box(body, 0.22, 0.14, 0.28, m.dark, s * 0.24, 0.07, 0.1);
    return;
  }
  // statue on a plinth
  box(body, 1.0, 0.24, 0.84, m.dark, 0, 0.12, 0);
  box(body, 1.04, 0.05, 0.88, m.accent, 0, 0.26, 0);
  box(body, 0.52, 0.32, 0.36, m.body, 0, 0.44, 0);
  box(body, 0.66, 0.54, 0.44, m.body, 0, 0.87, 0);
  box(body, 0.72, 0.12, 0.46, m.accent, 0, 1.14, 0);
  box(body, 0.5, 0.06, 0.04, m.dark, 0, 0.74, 0.225);
  const head = pivot(body, 0, 1.4, 0);
  swing(parts, head, 'y', 0.3, 0.6);
  box(head, 0.46, 0.44, 0.42, m.body, 0, 0, 0);
  box(head, 0.5, 0.1, 0.46, m.accent, 0, 0.24, 0);
  box(head, 0.46, 0.06, 0.05, m.dark, 0, 0.1, 0.215);
  eyes(head, 0.02, 0.215, 0.11, 0.1);
  box(head, 0.18, 0.04, 0.03, m.dark, 0, -0.14, 0.22);
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const pose = pivot(body, s * 0.42, 1.08, 0);
    pose.rotation.z = s * 0.35;
    const arm = pivot(pose, 0, 0, 0);
    box(arm, 0.18, 0.52, 0.2, m.body, s * 0.03, -0.24, 0.04);
    box(arm, 0.2, 0.16, 0.22, m.accent, s * 0.03, -0.54, 0.06);
    parts.arms.push({ g: arm, phase });
  }
  // cracks and a patch of moss
  for (const [x, y, z, h, r] of [[-0.2, 0.9, 0.225, 0.28, 0.3], [0.15, 0.55, 0.19, 0.2, -0.4], [0.3, 1.38, 0.2, 0.18, 0.2]]) box(body, 0.03, h, 0.03, m.belly, x, y, z).rotation.z = r;
  box(body, 0.26, 0.05, 0.22, 0x5a9a3a, -0.3, 1.2, 0.05);
  box(body, 0.2, 0.04, 0.18, 0x5a9a3a, 0.32, 0.26, 0.25);
}

// A snow cube with a stepped dome, ice-brick lines, a dark doorway and a smile looking out of it.
function igloo(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  box(body, 0.92, 0.56, 0.92, m.body, 0, 0.34, 0);
  box(body, 0.78, 0.22, 0.78, m.body, 0, 0.73, 0);
  box(body, 0.58, 0.2, 0.58, m.body, 0, 0.94, 0);
  box(body, 0.34, 0.16, 0.34, m.body, 0, 1.12, 0);
  box(body, 0.1, 0.1, 0.1, m.accent, 0, 1.24, 0);
  // brick lines
  for (const y of [0.24, 0.44]) box(body, 0.94, 0.03, 0.94, m.accent, 0, y, 0);
  for (const y of [0.66, 0.84]) box(body, 0.8, 0.03, 0.8, m.accent, 0, y, 0);
  for (const x of [-0.3, 0.1, 0.4]) box(body, 0.03, 0.2, 0.94, m.accent, x, 0.34, 0);
  // doorway with the face inside
  box(body, 0.46, 0.4, 0.05, m.belly, 0, 0.3, 0.465);
  box(body, 0.34, 0.12, 0.05, m.belly, 0, 0.56, 0.465);
  box(body, 0.5, 0.05, 0.07, m.accent, 0, 0.115, 0.48);
  eyes(body, 0.36, 0.5, 0.09, 0.09);
  box(body, 0.08, 0.035, 0.03, 0xffffff, -0.08, 0.2, 0.5);
  box(body, 0.2, 0.04, 0.03, 0xffffff, 0, 0.2, 0.5);
  box(body, 0.08, 0.035, 0.03, 0xffffff, 0.08, 0.2, 0.5);
  parts.arms = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const arm = pivot(body, s * 0.52, 0.4, 0.12);
    box(arm, 0.1, 0.24, 0.1, m.accent, s * 0.03, -0.1, 0);
    box(arm, 0.2, 0.2, 0.2, 0xd04a4a, s * 0.04, -0.25, 0.02);
    parts.arms.push({ g: arm, phase });
  }
  for (const s of [-1, 1]) box(body, 0.22, 0.1, 0.26, m.dark, s * 0.26, 0.05, 0.14);
}
const SHAPES_CAMO = { bushblock, sandcastle, stonecube, igloo };
/* ==== end of T18 camo shapes ==== */

/* ==== T18 cyber shapes ==== */
// A blob of chunky 0.26 cubes with stair-stepped corners and loose pixels above (the 2.0 is a crisp glowing diamond).
function pixelblob(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  if (has(m, 'v2')) {
    // sharper and thinner: a framed core, a glowing diamond crest, tilted spikes and orbiting pixels
    box(body, 0.62, 0.5, 0.46, m.body, 0, 0.45, 0);
    const crest = box(body, 0.36, 0.36, 0.4, m.belly, 0, 0.88, 0);
    crest.rotation.z = Math.PI / 4;
    glow(box(body, 0.14, 0.14, 0.14, m.accent, 0, 1.2, 0), m.accent).rotation.set(0, 0.6, Math.PI / 4);
    for (const x of [-0.2, 0.2]) {
      const sp = box(body, 0.05, 0.3, 0.05, m.accent, x, 0.82, -0.05);
      sp.rotation.z = -Math.sign(x) * 0.5;
      glow(sp, m.accent);
    }
    for (const y of [0.2, 0.7]) glow(box(body, 0.66, 0.04, 0.05, m.accent, 0, y, 0.24), m.accent);
    for (const x of [-0.32, 0.32]) glow(box(body, 0.04, 0.54, 0.05, m.accent, x, 0.45, 0.24), m.accent);
    box(body, 0.46, 0.2, 0.04, m.dark, 0, 0.5, 0.245);
    for (const s of [-1, 1]) glow(box(body, 0.1, 0.1, 0.03, m.accent, s * 0.1, 0.51, 0.27), m.accent).userData.eye = true;
    box(body, 0.16, 0.035, 0.03, m.accent, 0, 0.34, 0.255);
    for (const [i, h] of [0.9, 1.05, 0.78].entries()) {
      const orb = pivot(body, 0, h, 0);
      glow(box(orb, 0.1, 0.1, 0.1, i === 1 ? m.belly : m.accent, 0.58 - i * 0.04, 0, 0), m.accent);
      orb.rotation.y = i * 2.1;
      spin(parts, orb, 'y', 2.2 - i * 0.5);
    }
    for (const s of [-1, 1]) box(body, 0.2, 0.12, 0.26, m.accent, s * 0.2, 0.1, 0.1);
    return;
  }
  const c = 0.26, lift = 0.1;
  for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 3; iy++) for (let iz = 0; iz < 3; iz++) {
    if (iy === 2 && (ix === 0 || ix === 3)) continue;
    if (iy === 0 && (ix === 0 || ix === 3) && iz === 0) continue;
    const pick = (ix + iy * 2 + iz) % 5, col = pick === 0 ? m.belly : pick === 3 ? m.accent : m.body;
    box(body, c * 0.96, c * 0.96, c * 0.96, col, (ix - 1.5) * c, lift + c / 2 + iy * c, (iz - 1) * c);
  }
  const fz = c * 1.5 + 0.01, ey = lift + c * 2.5;
  for (const s of [-1, 1]) {
    box(body, 0.16, 0.16, 0.03, 0x111111, s * c * 0.5, ey, fz);
    box(body, 0.06, 0.06, 0.03, 0xffffff, s * c * 0.5 + s * 0.03, ey + 0.03, fz + 0.02);
  }
  for (const [x, y] of [[-1.5, 1.5], [-0.5, 1.0], [0.5, 1.0], [1.5, 1.5]]) box(body, 0.1, 0.1, 0.03, m.dark, x * c, lift + c * y * 0.8 + 0.02, fz);
  for (const [i, x] of [-0.4, 0.05, 0.4].entries()) {
    const px = pivot(body, x, 1.0 + (i % 2) * 0.1, (i - 1) * 0.1);
    glow(box(px, 0.1, 0.1, 0.1, i === 1 ? m.body : m.accent, 0, 0.12, 0), i === 1 ? m.body : m.accent);
    swing(parts, px, 'z', 0.7, 1.8 + i * 0.6, i * 1.7);
  }
}

// The classic mouse pointer built from stair-stepped blocks over a black outline, on two legs and a tail.
function cursor(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const v2 = has(m, 'v2');
  const click = pivot(body, 0, 0.05, 0);
  swing(parts, click, 'x', 0.2, 2.6);
  parts.legs = parts.legs || [];
  parts.arms = [];
  if (!v2) {
    const s = 0.14, rows = ['#.....', '##....', '###...', '####..', '#####.', '######', '..##..', '..##..', '..##..'];
    const base = 0.0;
    const cell = (r, c) => rows[r]?.[c] === '#';
    const cx = c => (c - 2.5) * s, cy = r => base + (rows.length - r - 0.5) * s;
    for (let r = -1; r <= rows.length; r++) for (let c = -1; c <= 6; c++) {
      if (cell(r, c)) box(click, s * 0.99, s * 0.99, 0.12, m.body, cx(c), cy(r), 0);
      else if ([[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dr, dc]) => cell(r + dr, c + dc))) box(click, s * 0.99, s * 0.99, 0.14, m.dark, cx(c), cy(r), -0.04);
    }
    const eyeY = cy(3.2);
    const ep = pivot(click, -0.12, eyeY, 0.065);
    eyes(ep, 0, 0, 0.09, 0.1);
    box(ep, 0.12, 0.035, 0.03, 0x222222, 0, -0.13, 0);
    for (const sd of [-1, 1]) {
      const g = pivot(click, sd * 0.3, cy(5.5), 0.0);
      box(g, 0.1, 0.42, 0.1, m.dark, 0, -0.21, 0);
      box(g, 0.16, 0.05, 0.22, m.dark, 0, -0.4, 0.04);
      parts.legs.push({ g, side: 0, phase: sd > 0 ? 0 : Math.PI });
      const arm = pivot(click, sd * 0.5, cy(4), 0.0);
      box(arm, 0.09, 0.26, 0.09, m.dark, 0, -0.1, 0);
      box(arm, 0.14, 0.12, 0.14, 0xffffff, 0, -0.26, 0);
      parts.arms.push({ g: arm, phase: sd > 0 ? 0 : Math.PI });
    }
    return;
  }
  // 2.0: thin slabs, a glowing outline, a sharp tip and a pointing glove
  const H = 1.0, W = 0.6, x0 = -0.3, y0 = 0.42;
  for (let i = 0; i < 10; i++) {
    const w = ((i + 1) / 10) * W;
    box(click, w, H / 10 * 0.98, 0.07, m.body, x0 + w / 2, y0 + H - (i + 0.5) * (H / 10), 0);
  }
  glow(box(click, 0.045, H, 0.1, m.accent, x0 - 0.01, y0 + H / 2, 0), m.accent);
  glow(box(click, W + 0.05, 0.045, 0.1, m.accent, x0 + W / 2, y0, 0), m.accent);
  const hy = box(click, 0.045, Math.hypot(W, H), 0.1, m.accent, x0 + W / 2, y0 + H / 2, 0);
  hy.rotation.z = Math.atan2(W, H);
  glow(hy, m.accent);
  glow(box(click, 0.1, 0.1, 0.1, 0xffffff, x0, y0 + H + 0.02, 0), 0xffffff).rotation.z = Math.PI / 4;
  const tail = box(click, 0.12, 0.45, 0.07, m.body, 0.04, y0 - 0.12, 0);
  tail.rotation.z = 0.3;
  const tl = box(click, 0.04, 0.45, 0.09, m.accent, 0.12, y0 - 0.12, 0);
  tl.rotation.z = 0.3;
  glow(tl, m.accent);
  const ep = pivot(click, -0.14, y0 + H * 0.62, 0.05);
  eyes(ep, 0, 0, 0.07, 0.09);
  box(ep, 0.1, 0.03, 0.03, 0x222222, 0.0, -0.12, 0);
  for (const sd of [-1, 1]) {
    const g = pivot(click, sd * 0.16, y0 - 0.04, 0.0);
    box(g, 0.06, 0.34, 0.06, m.dark, 0, -0.17, 0);
    box(g, 0.1, 0.04, 0.2, m.accent, 0, -0.34, 0.04);
    parts.legs.push({ g, side: 0, phase: sd > 0 ? 0 : Math.PI });
  }
  const arm1 = pivot(click, -0.46, y0 + 0.5, 0.0);
  box(arm1, 0.06, 0.26, 0.06, m.dark, 0, -0.1, 0);
  box(arm1, 0.14, 0.12, 0.12, m.belly, 0, -0.26, 0);
  parts.arms.push({ g: arm1, phase: 0 });
  // the glove: palm, a pointing finger and three knuckles
  const arm2 = pivot(click, 0.34, y0 + 0.3, 0.0);
  box(arm2, 0.06, 0.26, 0.06, m.dark, 0, -0.1, 0);
  box(arm2, 0.18, 0.14, 0.14, 0xffffff, 0, -0.28, 0);
  box(arm2, 0.05, 0.2, 0.06, 0xffffff, -0.04, -0.1, 0);
  for (const x of [-0.02, 0.04, 0.09]) box(arm2, 0.05, 0.05, 0.14, m.accent, x, -0.34, 0.04);
  parts.arms.push({ g: arm2, phase: Math.PI });
}

// A little round bug whose wings are Wi-Fi symbols: nested arcs of glowing bars.
function wifiwing(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  const v2 = has(m, 'v2');
  const cy = 0.55;
  ball(body, 0.3, m.body, 0, cy, 0);
  box(body, 0.34, 0.22, 0.03, m.belly, 0, cy - 0.08, 0.3);
  eyes(body, cy + 0.08, 0.31, 0.1, 0.12);
  box(body, 0.1, 0.035, 0.03, m.dark, 0, cy - 0.12, 0.33);
  for (const s of [-1, 1]) {
    const an = pivot(body, s * 0.1, cy + 0.3, 0.05);
    an.rotation.z = -s * 0.4;
    box(an, 0.035, 0.34, 0.035, m.dark, 0, 0.17, 0);
    glow(box(an, 0.09, 0.09, 0.09, m.accent, 0, 0.36, 0), m.accent);
    swing(parts, an, 'x', 0.2, 2.5, s);
    box(body, 0.1, 0.18, 0.1, m.dark, s * 0.15, 0.09, 0.05);
  }
  const wingColor = v2 ? 0x5af0ff : 0x5af0a0;
  const arcWing = (s, z, y, radii, rot, ph0) => {
    parts.wings = parts.wings || [];
    const g = pivot(body, s * 0.3, y, z);
    for (const [k, r] of radii.entries()) {
      const arc = pivot(g, 0, 0, 0);
      const n = 3 + k * 2, span = 0.5 + k * 0.1;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / (n - 1) - 0.5) * span * Math.PI;
        const piece = box(arc, 0.07, (r * span * Math.PI) / (n - 1) * 1.1, 0.05, wingColor, s * Math.cos(a) * r, Math.sin(a) * r, 0);
        piece.rotation.z = s > 0 ? a : Math.PI - a;
        glow(piece, wingColor);
      }
      swing(parts, arc, 'x', 0.3, 3.5, ph0 + k * 1.1);
    }
    glow(box(g, 0.1, 0.1, 0.06, wingColor, 0, 0, 0), wingColor);
    parts.wings.push({ g, s, lift: 0.25 });
  };
  if (!v2) {
    for (const s of [-1, 1]) arcWing(s, -0.05, cy + 0.05, [0.24, 0.44, 0.64], 0.35, s);
  } else {
    for (const s of [-1, 1]) {
      arcWing(s, -0.08, cy + 0.14, [0.22, 0.4, 0.58], 0.6, s);
      arcWing(s, 0.0, cy - 0.12, [0.2, 0.34], -0.4, s + 2);
    }
    for (const [i, h] of [0.14, 0.24, 0.34].entries()) glow(box(body, 0.07, h, 0.07, m.accent, -0.12 + i * 0.12, cy + 0.3 + h / 2, -0.12), m.accent);
  }
}

// A glitchy little ghost made of jittering slices, with a magenta and a cyan copy peeking out.
function glitchghost(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  const slabs = [];
  for (let k = 0; k < 4; k++) {
    const s = pivot(body, 0, 0.32 + k * 0.22, 0);
    box(s, 0.72 - (k === 3 ? 0.1 : 0), 0.22, 0.5, m.body, 0, 0, 0);
    swing(parts, s, 'y', 0.1, 6 + k * 2.3, k * 1.9);
    slabs.push(s);
  }
  // wavy bottom
  for (const [i, x] of [-0.27, -0.09, 0.09, 0.27].entries()) box(body, 0.16, 0.12 + (i % 2) * 0.06, 0.46, m.body, x, 0.2 - (i % 2) * 0.03, 0);
  // glitch copies
  glow(box(slabs[1], 0.14, 0.22, 0.46, m.accent, -0.43, 0, 0.02), m.accent);
  glow(box(slabs[2], 0.14, 0.22, 0.46, m.belly, 0.43, 0, -0.02), m.belly);
  glow(box(slabs[0], 0.12, 0.2, 0.44, m.belly, 0.42, 0, 0.0), m.belly);
  glow(box(slabs[3], 0.1, 0.2, 0.44, m.accent, -0.38, 0, 0.0), m.accent);
  // two black square eyes and an "o" mouth
  for (const s of [-1, 1]) {
    box(slabs[3], 0.15, 0.15, 0.04, 0x111111, s * 0.16, 0.0, 0.26).userData.eye = true;
    box(slabs[3], 0.05, 0.05, 0.03, 0xffffff, s * 0.16 + 0.03, 0.03, 0.29).userData.eye = true;
  }
  for (const [x, y, w, h] of [[0, 0.06, 0.12, 0.04], [0, -0.06, 0.12, 0.04], [-0.06, 0, 0.04, 0.1], [0.06, 0, 0.04, 0.1]]) box(slabs[2], w, h, 0.03, m.dark, x, y, 0.26);
  // a tiny belly label: four dots
  for (const x of [-0.12, -0.04, 0.04, 0.12]) glow(box(slabs[1], 0.05, 0.05, 0.03, m.belly, x, -0.02, 0.26), m.belly);
}
const SHAPES_CYBER = { pixelblob, cursor, wifiwing, glitchghost };
/* ==== end of T18 cyber shapes ==== */

/* ==== T21 cozy shapes ==== */
// Snugbun: a bunny rolled up in a blanket like a burrito, with its head and long ears poking out of the front.
// Quiltbun: the bunny stands up in a patchwork quilt cape.
function blanketbun(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body; // breathing
  if (has(m, 'quilt')) {
    parts.legs = [];
    for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
      const leg = pivot(body, s * 0.14, 0.34, 0);
      box(leg, 0.17, 0.26, 0.19, m.belly, 0, -0.13, 0);
      box(leg, 0.19, 0.08, 0.3, m.belly, 0, -0.3, 0.06);
      parts.legs.push({ g: leg, phase });
    }
    box(body, 0.52, 0.5, 0.36, m.belly, 0, 0.58, 0);
    box(body, 0.3, 0.3, 0.02, 0xffffff, 0, 0.52, 0.19);
    for (const s of [-1, 1]) box(body, 0.09, 0.14, 0.03, 0xe03060, s * 0.05, 0.54, 0.2).rotation.z = s * Math.PI / 6; // a little heart
    parts.arms = [];
    for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
      const arm = pivot(body, s * 0.33, 0.8, 0.03);
      box(arm, 0.12, 0.34, 0.13, m.belly, 0, -0.15, 0);
      parts.arms.push({ g: arm, phase });
    }
    const head = pivot(body, 0, 1.1, 0.03);
    parts.head = head;
    box(head, 0.54, 0.44, 0.46, m.belly, 0, 0, 0);
    eyes(head, 0.04, 0.235, 0.12, 0.12);
    box(head, 0.09, 0.07, 0.04, 0xff8aa0, 0, -0.06, 0.24);
    mouth(head, -0.13, 0.235, 0.1);
    for (const s of [-1, 1]) box(head, 0.1, 0.07, 0.03, 0xffb0c0, s * 0.2, -0.07, 0.235);
    for (const [i, s] of [-1, 1].entries()) {
      const ear = pivot(head, s * 0.15, 0.2, 0);
      box(ear, 0.13, 0.56, 0.07, m.belly, 0, 0.28, 0);
      box(ear, 0.07, 0.44, 0.02, m.accent, 0, 0.27, 0.04);
      swing(parts, ear, 'x', 0.14, 1.4, i * 1.9);
    }
    // the patchwork quilt cape: a 3x3 grid of squares hanging from the shoulders
    const cape = pivot(body, 0, 0.9, -0.2);
    cape.rotation.x = 0.1;
    const q = 0.34;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      box(cape, q * 0.96, 0.27, 0.05, (i + j) % 2 ? m.body : m.accent, (i - 1) * q, -(j + 0.5) * 0.28, 0);
    }
    for (const s of [-1, 1]) box(cape, 0.1, 0.1, 0.03, 0xe03060, 0, -0.42, 0.03).rotation.z = s * Math.PI / 4;
    box(cape, 0.06, 0.06, 0.03, 0xe03060, 0, -0.46, 0.03);
    box(body, 0.24, 0.08, 0.1, m.accent, 0, 0.86, 0.12); // clasp ribbon
    swing(parts, cape, 'x', 0.1, 2, 0.5);
    return;
  }
  // the blanket roll lies along x with rounded ends and two bands
  const roll = pivot(body, 0, 0.26, -0.1);
  box(roll, 0.76, 0.46, 0.46, m.body, 0, 0, 0);
  for (const s of [-1, 1]) box(roll, 0.06, 0.36, 0.36, m.body, s * 0.4, 0, 0);
  for (const x of [-0.26, 0.28]) box(roll, 0.08, 0.48, 0.48, m.accent, x, 0, 0);
  box(roll, 0.76, 0.04, 0.5, 0xffffff, 0, 0.16, 0.0).scale.set(1, 1, 0.96);
  // two tiny feet at the back
  for (const s of [-1, 1]) box(body, 0.12, 0.1, 0.16, m.belly, s * 0.12 - 0.15, 0.09, -0.4);
  // the bunny's head peeks out of the front
  const head = pivot(body, 0.12, 0.55, 0.2);
  parts.head = head;
  box(head, 0.42, 0.38, 0.38, m.belly, 0, 0, 0);
  eyes(head, 0.04, 0.195, 0.1, 0.1, true);
  box(head, 0.08, 0.06, 0.04, 0xff8aa0, 0, -0.05, 0.2);
  for (const s of [-1, 1]) box(head, 0.09, 0.06, 0.03, 0xffb0c0, s * 0.16, -0.06, 0.195);
  for (const [i, s] of [-1, 1].entries()) {
    const ear = pivot(head, s * 0.12, 0.17, -0.02);
    box(ear, 0.11, 0.5, 0.06, m.belly, 0, 0.25, 0);
    box(ear, 0.06, 0.38, 0.02, m.accent, 0, 0.24, 0.035);
    ear.rotation.z = -s * 0.1;
    swing(parts, ear, 'x', 0.2, 1.3, i * 2.2);
  }
}

// Purrmit: a big knitted mitten lying with its cuff towards you and a kitten peeking out of it.
// Knitcat: a cat on four legs in a knitted sweater, chasing a loose thread.
function mittencat(root, m, parts) {
  if (has(m, 'sweater')) {
    const body = pivot(root, 0, 0, 0);
    parts.legs = [];
    for (const [sx, sz, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
      const leg = pivot(body, sx * 0.18, 0.4, sz * 0.28);
      box(leg, 0.13, 0.4, 0.13, m.belly, 0, -0.2, 0);
      box(leg, 0.15, 0.08, 0.2, 0xffffff, 0, -0.36, 0.03);
      if (sz > 0) box(leg, 0.17, 0.08, 0.17, m.accent, 0, -0.02, 0); // sweater cuffs
      parts.legs.push({ g: leg, phase });
    }
    box(body, 0.5, 0.42, 0.84, m.body, 0, 0.6, 0);
    box(body, 0.52, 0.44, 0.1, m.accent, 0, 0.6, -0.4); // hem
    for (const x of [-0.2, 0, 0.2]) box(body, 0.05, 0.43, 0.84, m.accent, x, 0.605, 0).scale.set(1, 1, 1.0);
    box(body, 0.3, 0.2, 0.2, m.accent, 0, 0.78, 0.42); // turtleneck
    const head = pivot(body, 0, 0.9, 0.55);
    parts.head = head;
    box(head, 0.36, 0.3, 0.3, m.belly, 0, 0, 0);
    eyes(head, 0.03, 0.155, 0.09, 0.1);
    box(head, 0.07, 0.05, 0.03, 0xff8aa0, 0, -0.04, 0.16);
    mouth(head, -0.09, 0.155, 0.08);
    for (const s of [-1, 1]) {
      box(head, 0.1, 0.1, 0.06, m.belly, s * 0.13, 0.18, 0).rotation.z = Math.PI / 4;
      for (const dy of [-0.02, 0.03]) box(head, 0.18, 0.015, 0.015, 0xffffff, s * 0.27, -0.05 + dy, 0.12).rotation.z = s * dy * 4;
    }
    const tail = pivot(body, 0, 0.66, -0.42);
    parts.tail = tail;
    box(tail, 0.09, 0.09, 0.5, m.belly, 0, 0.1, -0.25).rotation.x = 0.5;
    box(tail, 0.1, 0.1, 0.12, m.accent, 0, 0.3, -0.45);
    // a loose thread from the hem to a ball of yarn at its front feet
    box(body, 0.025, 0.4, 0.025, m.body, -0.2, 0.22, -0.46);
    box(body, 0.025, 0.025, 0.96, m.body, -0.2, 0.02, 0.02);
    box(body, 0.54, 0.025, 0.025, m.body, 0.08, 0.02, 0.5);
    ball(body, 0.1, m.body, 0.38, 0.1, 0.5);
    box(body, 0.2, 0.02, 0.02, m.accent, 0.38, 0.1, 0.61);
    return;
  }
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  swing(parts, body, 'z', 0.08, 5); // purring: the whole mitten wiggles
  box(body, 0.5, 0.4, 0.66, m.body, 0, 0.22, -0.1); // palm
  box(body, 0.2, 0.36, 0.34, m.body, 0.34, 0.32, -0.12).rotation.z = -0.4; // thumb
  for (const z of [-0.36, -0.22, -0.08, 0.06]) box(body, 0.52, 0.04, 0.06, m.accent, 0, 0.42, z); // knitted rows
  // fluffy cuff round the opening
  box(body, 0.6, 0.09, 0.16, m.accent, 0, 0.46, 0.25);
  box(body, 0.6, 0.09, 0.16, m.accent, 0, 0.0 + 0.04, 0.25);
  for (const s of [-1, 1]) box(body, 0.1, 0.4, 0.16, m.accent, s * 0.26, 0.25, 0.25);
  // the kitten
  const head = pivot(body, 0, 0.26, 0.3);
  parts.head = head;
  box(head, 0.38, 0.3, 0.26, m.belly, 0, 0, 0);
  eyes(head, 0.03, 0.135, 0.09, 0.1);
  box(head, 0.07, 0.05, 0.03, 0xff8aa0, 0, -0.04, 0.14);
  for (const s of [-1, 1]) {
    box(head, 0.11, 0.11, 0.06, m.belly, s * 0.14, 0.19, 0).rotation.z = Math.PI / 4;
    box(head, 0.05, 0.05, 0.03, 0xffb0c0, s * 0.14, 0.18, 0.035).rotation.z = Math.PI / 4;
    for (const dy of [-0.02, 0.03]) box(head, 0.16, 0.015, 0.015, 0xffffff, s * 0.26, -0.05 + dy, 0.1).rotation.z = s * dy * 4;
  }
  const tail = pivot(body, -0.3, 0.28, 0.24);
  parts.tail = tail;
  box(tail, 0.08, 0.34, 0.08, m.belly, 0, 0.17, 0).rotation.z = 0.3;
}

// Pillowlamb: a sheep made of stacked square pillows. Dozeram: a ram with long bed pillows and curled pillow horns.
function pillowsheep(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const ram = has(m, 'ram');
  const legH = ram ? 0.42 : 0.3;
  parts.legs = [];
  for (const [sx, sz, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
    const leg = pivot(body, sx * (ram ? 0.26 : 0.19), legH, sz * (ram ? 0.4 : 0.26));
    box(leg, 0.14, legH, 0.14, m.dark, 0, -legH / 2, 0);
    box(leg, 0.17, 0.07, 0.2, m.dark, 0, -legH + 0.035, 0.02);
    parts.legs.push({ g: leg, phase });
  }
  const pillow = (w, h, d, x, y, z, rz, ry) => {
    const p = pivot(body, x, y, z);
    p.rotation.set(0, ry, rz);
    box(p, w, h, d, m.body, 0, 0, 0);
    box(p, w * 0.22, h + 0.01, d + 0.01, m.accent, w * 0.2, 0, 0); // pillowcase stripe
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(p, 0.07, 0.07, 0.07, m.body, sx * (w / 2 + 0.01), 0, sz * (d / 2 + 0.01));
    return p;
  };
  if (ram) {
    pillow(0.7, 0.54, 0.46, 0, legH + 0.3, -0.4, 0.05, 0.04);
    pillow(0.74, 0.58, 0.48, 0, legH + 0.32, 0, -0.04, -0.03);
    pillow(0.7, 0.54, 0.46, 0, legH + 0.3, 0.4, 0.05, 0.05);
  } else {
    for (const [z, rz, ry] of [[-0.24, 0.07, 0.05], [0.24, -0.06, -0.06]]) {
      pillow(0.5, 0.26, 0.46, 0, legH + 0.15, z, rz, ry);
      pillow(0.46, 0.26, 0.44, 0.01, legH + 0.4, z * 0.9, -rz, -ry);
    }
  }
  const head = pivot(body, 0, ram ? legH + 0.55 : legH + 0.3, ram ? 0.74 : 0.58);
  parts.head = head;
  if (ram) {
    box(head, 0.5, 0.44, 0.42, m.belly, 0, 0, 0);
    box(head, 0.26, 0.2, 0.1, m.belly, 0, -0.1, 0.24);
    eyes(head, 0.06, 0.215, 0.11, 0.11, true);
    box(head, 0.08, 0.05, 0.03, 0x4a3a3a, 0, -0.08, 0.3);
    for (const s of [-1, 1]) {
      const horn = pivot(head, s * 0.3, 0.1, 0);
      for (let k = 0; k < 4; k++) {
        const a = k * 1.1;
        const piece = box(horn, 0.19 - k * 0.02, 0.12, 0.19 - k * 0.02, k % 2 ? m.accent : m.body, s * (0.08 + 0.18 * Math.sin(a)), 0.06 + 0.15 * (1 - Math.cos(a)), 0);
        piece.rotation.z = -s * a * 0.5;
      }
      box(head, 0.12, 0.2, 0.07, m.belly, s * 0.3, -0.08, 0.02).rotation.z = s * 0.5; // floppy ears
    }
    box(body, 0.22, 0.22, 0.2, m.body, 0, legH + 0.45, -0.72); // tail tuft
  } else {
    box(head, 0.4, 0.32, 0.3, m.belly, 0, 0, 0);
    eyes(head, 0.04, 0.155, 0.09, 0.1, true);
    box(head, 0.08, 0.05, 0.03, 0x4a3a3a, 0, -0.06, 0.16);
    for (const s of [-1, 1]) box(head, 0.12, 0.22, 0.07, m.belly, s * 0.26, 0.0, 0).rotation.z = s * 0.5; // floppy ears
    box(body, 0.2, 0.2, 0.18, m.body, 0, legH + 0.35, -0.5); // tail tuft
  }
  // a sleepy "z" floats above the head
  const z = pivot(head, ram ? 0.0 : 0.05, ram ? 0.6 : 0.4, 0);
  glow(box(z, 0.14, 0.04, 0.04, m.accent, 0, 0.1, 0), m.accent);
  glow(box(z, 0.14, 0.04, 0.04, m.accent, 0, -0.04, 0), m.accent);
  glow(box(z, 0.04, 0.16, 0.04, m.accent, 0, 0.03, 0), m.accent).rotation.z = 0.9;
  swing(parts, z, 'z', 0.25, 2);
}

// Snoozebear: a bear in stripy pyjamas, fluffy slippers and a nightcap.
function pajamabear(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const leg = pivot(body, s * 0.16, 0.32, 0);
    box(leg, 0.18, 0.22, 0.2, m.body, 0, -0.1, 0);
    box(leg, 0.22, 0.13, 0.32, 0xffb8d0, 0, -0.25, 0.05); // slipper
    ball(leg, 0.05, 0xffffff, 0, -0.17, 0.17); // pom
    parts.legs.push({ g: leg, phase });
  }
  box(body, 0.56, 0.56, 0.42, m.body, 0, 0.6, 0);
  for (const x of [-0.2, 0.2]) box(body, 0.07, 0.57, 0.43, m.accent, x, 0.6, 0);
  box(body, 0.09, 0.57, 0.43, m.accent, 0, 0.6, 0);
  for (const y of [0.74, 0.6, 0.46]) box(body, 0.06, 0.06, 0.03, m.dark, 0, y, 0.22);
  parts.arms = [];
  for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
    const arm = pivot(body, s * 0.36, 0.82, 0.02);
    box(arm, 0.15, 0.38, 0.15, m.body, 0, -0.16, 0);
    box(arm, 0.16, 0.06, 0.16, m.accent, 0, -0.34, 0);
    box(arm, 0.15, 0.1, 0.15, m.belly, 0, -0.41, 0);
    parts.arms.push({ g: arm, phase });
  }
  const head = pivot(body, 0, 1.12, 0.03);
  parts.head = head;
  swing(parts, head, 'z', 0.08, 1.2);
  ball(head, 0.27, m.belly, 0, 0, 0);
  for (const s of [-1, 1]) {
    ball(head, 0.09, m.belly, s * 0.22, 0.2, -0.02);
    ball(head, 0.045, 0xe8b8a0, s * 0.22, 0.2, 0.05);
  }
  box(head, 0.22, 0.15, 0.08, 0xf0d0a8, 0, -0.08, 0.26); // muzzle
  box(head, 0.08, 0.06, 0.04, m.dark, 0, -0.03, 0.3);
  eyes(head, 0.06, 0.275, 0.1, 0.1, true);
  // nightcap leaning back with a pom-pom
  const cap = pivot(head, 0, 0.2, -0.02);
  cap.rotation.x = -0.15;
  box(cap, 0.5, 0.1, 0.5, m.accent, 0, 0.0, 0);
  box(cap, 0.42, 0.14, 0.42, m.body, 0, 0.12, -0.03);
  box(cap, 0.32, 0.14, 0.32, m.body, 0, 0.25, -0.1);
  box(cap, 0.2, 0.14, 0.2, m.body, 0, 0.36, -0.2);
  ball(cap, 0.07, m.accent, 0, 0.38, -0.34);
  swing(parts, cap, 'z', 0.1, 1.8);
}
const SHAPES_COZY = { blanketbun, mittencat, pillowsheep, pajamabear };
/* ==== end of T21 cozy shapes ==== */

/* ==== T21 treasure shapes ==== */
// A twinkle: two crossed flat four-pointed stars (one mesh, 16 triangles).
export function sparkleGeometry(r) {
  const q = r * 0.16, pos = [];
  const tips = [[r, 0], [0, r], [-r, 0], [0, -r]], ins = [[q, q], [-q, q], [-q, -q], [q, -q]];
  for (const plane of [(a, b) => [a, b, 0], (a, b) => [0, b, a]]) {
    for (let i = 0; i < 4; i++) {
      pos.push(...plane(0, 0), ...plane(...ins[(i + 3) % 4]), ...plane(...tips[i]),
               ...plane(0, 0), ...plane(...tips[i]), ...plane(...ins[i]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Glow, but only a little (crystals catch the light rather than make it).
const weakGlowTreasure = (mesh, color, k = 0.35) => {
  glow(mesh, color);
  mesh.material.emissive.multiplyScalar(k);
  return mesh;
};
// An octagon of two crossed boxes.
const octagonTreasure = (parent, w, h, d, color, x = 0, y = 0, z = 0, flat = false) => {
  const g = pivot(parent, x, y, z);
  const cut = 0.72;
  if (flat) { // lying down: w x w, d high
    box(g, w, h, w * cut, color, 0, 0, 0);
    box(g, w * cut, h, w, color, 0, 0, 0);
  } else { // standing, facing +z
    box(g, w * cut, w, d, color, 0, 0, 0);
    box(g, w, w * cut, d, color, 0, 0, 0);
  }
  return g;
};

// Coinlet: a gold coin standing on its edge, rocking from side to side. Kingcoin: a stack of coins with a crown.
function coin(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  if (has(m, 'stack')) {
    parts.legs = [];
    for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
      const leg = pivot(body, s * 0.2, 0.34, 0);
      box(leg, 0.15, 0.3, 0.15, m.body, 0, -0.15, 0);
      box(leg, 0.19, 0.07, 0.26, m.dark, 0, -0.31, 0.04);
      parts.legs.push({ g: leg, phase });
    }
    parts.arms = [];
    for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
      const arm = pivot(body, s * 0.52, 0.8, 0);
      box(arm, 0.09, 0.34, 0.09, m.body, 0, -0.15, 0);
      box(arm, 0.12, 0.1, 0.12, m.belly, 0, -0.34, 0);
      parts.arms.push({ g: arm, phase });
    }
    for (let i = 0; i < 4; i++) {
      const y = 0.38 + i * 0.16, x = i % 2 ? 0.04 : -0.04;
      octagonTreasure(body, 0.92, 0.15, 0, i % 2 ? m.belly : m.body, x, y, 0, true);
    }
    eyes(body, 0.38 + 3 * 0.16 + 0.005, 0.465, 0.13, 0.1);
    box(body, 0.14, 0.03, 0.03, m.dark, 0, 0.38 + 2 * 0.16 + 0.1, 0.47);
    // the top coin spins slowly, wearing a small crown
    const top = pivot(body, 0, 0.38 + 4 * 0.16, 0);
    octagonTreasure(top, 0.92, 0.15, 0, m.body, 0, 0, 0, true);
    box(top, 0.4, 0.1, 0.3, m.belly, 0, 0.12, 0);
    for (const x of [-0.15, 0, 0.15]) box(top, 0.08, 0.14, 0.08, m.belly, x, 0.24, 0);
    glow(box(top, 0.09, 0.09, 0.05, m.accent, 0, 0.12, 0.16), m.accent);
    spin(parts, top, 'y', 0.9);
    return;
  }
  const disc = pivot(body, 0, 0.47, 0);
  swing(parts, disc, 'z', 0.25, 1.8);
  octagonTreasure(disc, 0.88, 0, 0.1, m.accent, 0, 0, -0.03); // rim, a little bigger and behind
  octagonTreasure(disc, 0.8, 0, 0.14, m.body, 0, 0, 0.02);
  octagonTreasure(disc, 0.6, 0, 0.02, m.belly, 0, 0, 0.1); // lighter face
  eyes(disc, 0.08, 0.125, 0.12, 0.13);
  box(disc, 0.05, 0.04, 0.03, m.dark, -0.11, -0.1, 0.125);
  box(disc, 0.05, 0.04, 0.03, m.dark, 0.11, -0.1, 0.125);
  box(disc, 0.17, 0.04, 0.03, m.dark, 0, -0.14, 0.125);
  glow(box(disc, 0.05, 0.3, 0.02, 0xffffff, -0.28, 0.2, 0.13), 0xffffff).rotation.z = -0.7; // shine
  // an embossed star on the back
  for (const r of [0, Math.PI / 4]) {
    for (const [w, h] of [[0.26, 0.07], [0.07, 0.26]]) box(disc, w, h, 0.02, m.accent, 0, 0, -0.1).rotation.z = r;
  }
  for (const s of [-1, 1]) box(body, 0.16, 0.1, 0.2, m.dark, s * 0.18, 0.05, 0.04); // little feet
}

// Crystafox: a fox with crystal fur and spikes. Prismfox: bigger, with a fan of shards and spinning rainbows.
function crystalfox(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  const prism = has(m, 'prism');
  parts.legs = [];
  for (const [sx, sz, phase] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) {
    const leg = pivot(body, sx * 0.14, 0.36, sz * 0.27);
    box(leg, 0.1, 0.36, 0.1, m.body, 0, -0.18, 0);
    box(leg, 0.13, 0.07, 0.17, m.belly, 0, -0.33, 0.03);
    parts.legs.push({ g: leg, phase });
  }
  box(body, 0.4, 0.34, 0.82, m.body, 0, 0.53, 0);
  box(body, 0.3, 0.2, 0.7, m.belly, 0, 0.42, 0);
  const spikes = prism ? 6 : 5;
  for (let k = 0; k < spikes; k++) {
    const z = -0.32 + k * (0.64 / (spikes - 1));
    const sp = weakGlowTreasure(box(body, 0.1, 0.24 + (k % 2) * 0.06, 0.1, m.accent, (k % 2 ? 0.05 : -0.05), 0.76, z), m.accent);
    sp.rotation.set(0.7, 0.4, 0.7);
  }
  const head = pivot(body, 0, 0.78, 0.5);
  parts.head = head;
  box(head, 0.32, 0.3, 0.28, m.body, 0, 0, 0);
  box(head, 0.2, 0.15, 0.14, m.belly, 0, -0.06, 0.2);
  box(head, 0.12, 0.1, 0.1, m.belly, 0, -0.07, 0.3);
  box(head, 0.07, 0.06, 0.05, m.dark, 0, -0.03, 0.36);
  eyes(head, 0.06, 0.145, 0.09, 0.09);
  for (const s of [-1, 1]) {
    box(head, 0.12, 0.2, 0.07, m.body, s * 0.1, 0.24, -0.02);
    weakGlowTreasure(box(head, 0.08, 0.14, 0.06, m.accent, s * 0.1, 0.38, -0.02), m.accent).rotation.z = -s * 0.15;
  }
  if (prism) {
    box(body, 0.34, 0.1, 0.1, m.accent, 0, 0.66, 0.3);
    const chest = glow(box(body, 0.17, 0.17, 0.09, m.accent, 0, 0.5, 0.42), 0xb0d8ff);
    chest.rotation.z = Math.PI / 4;
    // the rainbows it throws
    const ring = pivot(body, 0, 0.95, -0.1);
    [0xff6a6a, 0xffb84a, 0xffe84a, 0x6ad86a, 0x6aa8ff].forEach((c, i) => {
      const a = (i / 5) * Math.PI * 2;
      glow(box(ring, 0.1, 0.1, 0.1, c, Math.cos(a) * 0.5, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.5), c);
    });
    spin(parts, ring, 'y', 1.4);
  }
  const tail = pivot(body, 0, 0.62, -0.42);
  parts.tail = tail;
  if (prism) {
    for (let k = 0; k < 5; k++) {
      const shard = pivot(tail, 0, 0, 0);
      shard.rotation.set(-0.7, 0, (k - 2) * 0.38);
      weakGlowTreasure(box(shard, 0.1, 0.55 - Math.abs(k - 2) * 0.05, 0.1, k % 2 ? m.accent : m.body, 0, 0.3, 0), m.accent, 0.2).rotation.y = 0.6;
    }
  } else {
    for (const [y, z, s] of [[0.04, -0.14, 0.16], [0.12, -0.34, 0.2], [0.2, -0.56, 0.14]]) {
      const c = box(tail, s, s, s * 1.8, m.body, 0, y, z);
      c.rotation.set(0.5, 0.6, 0.5);
    }
    weakGlowTreasure(box(tail, 0.1, 0.1, 0.1, m.accent, 0, 0.26, -0.7), m.accent).rotation.set(0.6, 0.6, 0.6);
  }
}

// Ringlet: a floating gold ring with a gem eye. Crownguard: a walking crown in gem armour.
function gemring(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  if (has(m, 'crown')) {
    parts.legs = [];
    for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
      const leg = pivot(body, s * 0.28, 0.38, 0);
      box(leg, 0.2, 0.38, 0.22, m.body, 0, -0.19, 0);
      box(leg, 0.24, 0.08, 0.32, m.dark, 0, -0.34, 0.05);
      parts.legs.push({ g: leg, phase });
    }
    const y0 = 0.38, h = 0.46, yc = y0 + h / 2;
    box(body, 1.0, h, 0.1, m.body, 0, yc, 0.4);
    box(body, 1.0, h, 0.1, m.body, 0, yc, -0.4);
    for (const s of [-1, 1]) box(body, 0.1, h, 0.9, m.body, s * 0.45, yc, 0);
    box(body, 0.84, 0.1, 0.7, 0x8a1a3a, 0, y0 + h - 0.05, 0); // velvet cushion
    for (const z of [0.4, -0.4]) {
      for (let i = 0; i < 5; i++) {
        const x = -0.4 + i * 0.2, ph = i % 2 ? 0.2 : 0.32;
        box(body, 0.14, ph, 0.1, m.body, x, y0 + h + ph / 2, z);
        if (z > 0) glow(box(body, 0.09, 0.09, 0.09, i % 2 ? m.accent : m.belly, x, y0 + h + ph + 0.04, z), i % 2 ? m.accent : m.belly);
      }
    }
    for (const s of [-1, 1]) for (const z of [0.4, -0.4]) box(body, 0.1, 0.26, 0.1, m.body, s * 0.45, y0 + h + 0.13, z * 0.9);
    // gem armour on the front band
    for (const [x, c] of [[-0.3, m.accent], [0, m.belly], [0.3, m.accent]]) {
      const g = glow(box(body, 0.2, 0.2, 0.08, c, x, yc - 0.06, 0.47), c);
      g.rotation.z = Math.PI / 4;
    }
    eyes(body, yc + 0.12, 0.455, 0.16, 0.1);
    parts.arms = [];
    for (const [s, phase] of [[-1, Math.PI], [1, 0]]) {
      const arm = pivot(body, s * 0.58, 0.72, 0.05);
      box(arm, 0.12, 0.4, 0.12, m.body, 0, -0.18, 0);
      box(arm, 0.14, 0.1, 0.14, m.dark, 0, -0.4, 0);
      if (s > 0) {
        ball(arm, 0.17, m.belly, 0.08, -0.32, 0.14);
        glow(box(arm, 0.08, 0.08, 0.04, m.accent, 0.08, -0.32, 0.31), m.accent);
      }
      parts.arms.push({ g: arm, phase });
    }
    return;
  }
  parts.hover = true;
  const ring = pivot(body, 0, 0.5, 0);
  swing(parts, ring, 'y', 0.4, 1.1);
  const R = 0.38;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const seg = box(ring, 0.29, 0.13, 0.18, i % 2 ? m.body : 0xe8b428, Math.cos(a) * R, Math.sin(a) * R, 0);
    seg.rotation.z = a + Math.PI / 2;
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    glow(box(ring, 0.07, 0.07, 0.07, m.belly, Math.cos(a) * (R + 0.08), Math.sin(a) * (R + 0.08), 0.1), m.belly).material.emissive.multiplyScalar(0.3);
  }
  const eye = glow(box(ring, 0.28, 0.28, 0.14, m.accent, 0, R, 0), m.accent);
  eye.rotation.z = Math.PI / 4;
  box(ring, 0.1, 0.16, 0.03, m.dark, 0, R - 0.01, 0.08);
  box(ring, 0.05, 0.05, 0.03, 0xffffff, 0.04, R + 0.05, 0.1);
  for (const s of [-1, 1]) box(ring, 0.07, 0.07, 0.03, 0xffffff, s * 0.16, -R + 0.0, 0.1); // smiling dots on the bottom of the ring
}

// Lustrelle: a floating gold chandelier with a spinning ring of flickering candles and a smiling medallion.
function chandelier(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.hover = true;
  box(body, 0.1, 0.95, 0.1, m.body, 0, 0.65, 0); // stem
  ball(body, 0.09, m.body, 0, 1.17, 0);
  box(body, 0.04, 0.12, 0.04, m.body, 0, 1.3, 0);
  weakGlowTreasure(box(body, 0.12, 0.26, 0.12, 0xbfefff, 0, 0.1, 0), 0xbfefff, 0.5).rotation.y = Math.PI / 4;
  const ring = pivot(body, 0, 0.98, 0);
  spin(parts, ring, 'y', 0.4);
  for (let k = 0; k < 6; k++) {
    const arm = pivot(ring, 0, 0, 0);
    arm.rotation.y = (k / 6) * Math.PI * 2;
    box(arm, 0.4, 0.06, 0.06, m.body, 0.2, 0, 0);
    box(arm, 0.16, 0.08, 0.16, m.body, 0.4, 0.03, 0);
    box(arm, 0.09, 0.2, 0.09, m.belly, 0.4, 0.17, 0);
    const flame = pivot(arm, 0.4, 0.27, 0);
    glow(box(flame, 0.07, 0.13, 0.07, m.accent, 0, 0.06, 0), m.accent);
    swing(parts, flame, 'z', 0.15, 9, k);
    const drop = pivot(ring, 0, 0, 0);
    drop.rotation.y = ((k + 0.5) / 6) * Math.PI * 2;
    weakGlowTreasure(box(drop, 0.08, 0.2, 0.08, 0xbfefff, 0.3, -0.14, 0), 0xbfefff, 0.6).rotation.y = Math.PI / 4;
    box(drop, 0.02, 0.1, 0.02, m.body, 0.3, -0.02, 0);
  }
  // the face on a round gold medallion in front of the stem
  const med = pivot(body, 0, 0.55, 0.17);
  ball(med, 0.22, m.body, 0, 0, 0);
  box(med, 0.34, 0.3, 0.04, m.belly, 0, 0, 0.215);
  eyes(med, 0.05, 0.225, 0.09, 0.1);
  mouth(med, -0.09, 0.225, 0.11);
  swing(parts, med, 'z', 0.05, 1.4);
}
const SHAPES_TREASURE = { coin, crystalfox, gemring, chandelier };
/* ==== end of T21 treasure shapes ==== */

/* ==== T33 food shapes ==== */
// One sushi roll standing on its end (Makiroll, and the two on Sushisail's deck). k scales it, nori is the seaweed colour.
function rollFood(parent, m, k, nori, eyeSize) {
  const g = pivot(parent, 0, 0, 0);
  box(g, 0.7 * k, 0.55 * k, 0.5 * k, nori, 0, 0.33 * k, 0);
  box(g, 0.5 * k, 0.55 * k, 0.7 * k, nori, 0, 0.33 * k, 0);
  box(g, 0.62 * k, 0.06 * k, 0.44 * k, m.belly, 0, 0.63 * k, 0);
  box(g, 0.44 * k, 0.06 * k, 0.62 * k, m.belly, 0, 0.63 * k, 0);
  box(g, 0.24 * k, 0.07 * k, 0.24 * k, m.accent, 0, 0.665 * k, 0);
  for (const [x, z] of [[-0.3, 0.1], [0.3, -0.1], [0.1, 0.3], [-0.12, -0.3], [0.28, 0.2], [-0.25, -0.2]]) box(g, 0.05 * k, 0.04 * k, 0.05 * k, m.belly, x * k, 0.67 * k, z * k);
  eyes(g, 0.4 * k, 0.37 * k, 0.12 * k, eyeSize);
  mouth(g, 0.25 * k, 0.36 * k, 0.1 * k);
  for (const s of [-1, 1]) box(g, 0.07 * k, 0.05 * k, 0.03, 0xff9aa8, s * 0.2 * k, 0.3 * k, 0.36 * k);
  return g;
}

// Makiroll: a maki roll that rocks as if about to roll. Sushisail: a wooden sushi boat with a nori sail and two rolls on deck.
function sushi(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  if (has(m, 'boat')) {
    const hull = pivot(body, 0, 0, 0);
    swing(parts, hull, 'z', 0.08, 1.4);
    const dark = 0x7a5028;
    box(hull, 0.8, 0.3, 1.2, m.body, 0, 0.25, 0);
    box(hull, 0.86, 0.06, 1.26, dark, 0, 0.42, 0);
    box(hull, 0.62, 0.26, 0.2, m.body, 0, 0.33, 0.7);
    box(hull, 0.44, 0.22, 0.16, m.body, 0, 0.39, 0.88);
    box(hull, 0.5, 0.05, 0.2, dark, 0, 0.51, 0.88);
    eyes(hull, 0.43, 0.97, 0.1, 0.09);
    mouth(hull, 0.31, 0.97, 0.12);
    box(hull, 0.05, 0.8, 0.05, dark, 0, 0.8, -0.38);
    const sail = pivot(hull, 0, 0.82, -0.38);
    swing(parts, sail, 'y', 0.2, 1.2);
    box(sail, 0.5, 0.5, 0.03, m.dark, 0, 0.1, 0);
    box(sail, 0.34, 0.07, 0.04, m.belly, 0, 0.16, 0);
    [-0.2, 0.2].forEach((x, i) => {
      const deck = pivot(hull, x, 0.45, 0.12);
      swing(parts, deck, 'x', 0.12, 2.4, i * 1.5);
      rollFood(deck, m, 0.62, m.dark, 0.08);
    });
    return;
  }
  const rock = pivot(body, 0, 0.05, 0);
  swing(parts, rock, 'z', 0.15, 1.8);
  rollFood(rock, m, 1, m.body, 0.12);
  for (const s of [-1, 1]) box(body, 0.14, 0.1, 0.2, m.dark, s * 0.18, 0.05, 0.05);
}

// Bitesize: a tiny burger whose top bun is a flapping jaw. Bigbite: a double-decker with a cheese cape and little arms.
function burger(root, m, parts) {
  const dbl = has(m, 'double');
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  parts.legs = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
    const leg = pivot(body, s * 0.2, 0.09, 0.1);
    box(leg, 0.18, 0.08, 0.26, 0x6aa83a, 0, -0.04, 0.03);
    parts.legs.push({ g: leg, phase });
  }
  box(body, 0.7, 0.18, 0.7, m.body, 0, 0.18, 0);
  box(body, 0.62, 0.04, 0.78, m.body, 0, 0.18, 0);
  let y = 0.27;
  const layers = dbl ? 2 : 1;
  for (let i = 0; i < layers; i++) {
    box(body, 0.76, 0.14, 0.76, m.dark, 0, y + 0.07, 0);
    y += 0.14;
    box(body, 0.78, 0.04, 0.78, m.accent, 0, y + 0.02, 0);
    for (const s of [-1, 1]) box(body, 0.1, 0.12, 0.05, m.accent, s * 0.3, y - 0.05, 0.4);
    y += 0.04;
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(body, 0.14, 0.05, 0.14, m.belly, Math.cos(a) * 0.38, y + 0.02 + (i % 2 ? 0.02 : -0.02), Math.sin(a) * 0.38);
  }
  box(body, 0.2, 0.04, 0.18, 0xff7a8a, 0, y - 0.05, 0.4); // tongue
  const hinge = pivot(body, 0, y + 0.02, -0.35);
  hinge.rotation.x = -0.18;
  const jaw = pivot(hinge, 0, 0, 0);
  swing(parts, jaw, 'x', 0.18, dbl ? 4 : 3);
  box(jaw, 0.74, 0.26, 0.74, m.body, 0, 0.13, 0.37);
  box(jaw, 0.56, 0.08, 0.56, m.body, 0, 0.3, 0.37);
  for (const [x, z] of [[-0.18, 0.2], [0.15, 0.25], [0, 0.45], [-0.12, 0.55], [0.2, 0.5], [-0.2, 0.4]]) box(jaw, 0.05, 0.02, 0.08, 0xfff4d8, x, 0.35, z);
  eyes(jaw, 0.14, 0.75, 0.17, 0.12);
  mouth(jaw, 0.04, 0.75, 0.16);
  if (dbl) {
    for (const s of [-1, 1]) {
      const b = box(jaw, 0.14, 0.04, 0.04, m.dark, s * 0.17, 0.24, 0.76);
      b.rotation.z = s * 0.35;
    }
    const cape = pivot(body, 0, y + 0.1, -0.42);
    swing(parts, cape, 'x', 0.1, 1.6);
    box(cape, 0.6, 0.55, 0.03, m.accent, 0, -0.25, 0);
    box(cape, 0.6, 0.06, 0.04, 0xe0302a, 0, 0.0, 0);
    parts.arms = [];
    for (const [s, phase] of [[-1, 0], [1, Math.PI]]) {
      const arm = pivot(body, s * 0.46, 0.5, 0.05);
      box(arm, 0.1, 0.3, 0.1, m.body, 0, -0.15, 0);
      box(arm, 0.16, 0.14, 0.16, 0xe0302a, 0, -0.34, 0);
      parts.arms.push({ g: arm, phase });
    }
  }
}

// Noodlet: a bowl of spaghetti with a meatball nose and wiggly noodle strands. Pastapus: the same bowl on six noodle legs.
function noodlebowl(root, m, parts) {
  const octo = has(m, 'octo');
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  const bowl = pivot(body, 0, octo ? 0.75 : 0, 0);
  box(bowl, 0.5, 0.08, 0.5, m.body, 0, 0.04, 0);
  for (const [w, d, x, z] of [[0.7, 0.06, 0, 0.32], [0.7, 0.06, 0, -0.32], [0.06, 0.7, 0.32, 0], [0.06, 0.7, -0.32, 0]]) {
    box(bowl, w, 0.32, d, m.body, x, 0.24, z);
    box(bowl, w + (w > d ? 0.04 : 0), 0.07, d + (d > w ? 0.04 : 0), m.accent, x, 0.34, z);
  }
  if (!octo) for (const s of [-1, 1]) box(bowl, 0.14, 0.05, 0.2, m.dark, s * 0.16, 0.02, 0);
  box(bowl, 0.6, 0.14, 0.6, m.belly, 0, 0.47, 0);
  box(bowl, 0.5, 0.12, 0.5, m.belly, 0, 0.6, 0);
  box(bowl, 0.32, 0.05, 0.32, m.accent, 0, 0.665, 0);
  ball(bowl, 0.1, m.dark, 0, 0.42, 0.33);
  eyes(bowl, 0.54, 0.31, 0.12, octo ? 0.13 : 0.1);
  mouth(bowl, 0.24, 0.355, 0.16);
  [[0.37, 0.2, 'z'], [0.37, -0.2, 'z'], [-0.37, 0.2, 'z'], [-0.37, -0.2, 'z'], [0.15, -0.37, 'x'], [-0.15, -0.37, 'x']].forEach(([x, z, axis], k) => {
    const strand = pivot(bowl, x, 0.4, z);
    swing(parts, strand, axis, 0.25, 2.5, k);
    box(strand, 0.04, 0.18, 0.04, m.belly, 0, -0.09, 0);
    box(strand, 0.04, 0.1, 0.04, m.belly, 0.01, -0.22, 0);
  });
  if (!octo) return;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const out = pivot(body, Math.sin(a) * 0.22, 0.78, Math.cos(a) * 0.22);
    out.rotation.y = a;
    const tilt = pivot(out, 0, 0, 0);
    tilt.rotation.x = -0.5;
    let parent = tilt;
    for (let seg = 0; seg < 3; seg++) {
      const g = pivot(parent, 0, seg ? -0.26 : 0, 0);
      swing(parts, g, 'x', 0.25, 2, i + seg * 0.6);
      box(g, 0.07, 0.26, 0.07, m.belly, 0, -0.13, 0);
      parent = g;
    }
  }
  const fork = pivot(bowl, 0.2, 0.62, -0.1);
  fork.rotation.set(-0.4, 0, 0.2);
  box(fork, 0.04, 0.5, 0.04, 0xc8d0d8, 0, 0.25, 0);
  for (const x of [-0.05, 0, 0.05]) box(fork, 0.02, 0.14, 0.02, 0xc8d0d8, x, 0.55, 0);
  box(fork, 0.14, 0.03, 0.03, 0xc8d0d8, 0, 0.5, 0);
}

// Scoopsy: three scoops on a waffle cone, a wobbly stack with a face on the strawberry scoop and a bobbing cherry.
function icecream(root, m, parts) {
  const body = pivot(root, 0, 0, 0);
  parts.bounce = body;
  [0.42, 0.32, 0.22, 0.12].forEach((w, i) => {
    const y = 0.48 - i * 0.14;
    box(body, w, 0.14, w, m.body, 0, y, 0);
    for (const s of [-1, 1]) {
      box(body, 0.03, Math.min(0.1, w * 0.6), 0.02, m.dark, s * w * 0.2, y, w / 2 + 0.005).rotation.z = s * 0.6;
      box(body, 0.02, Math.min(0.1, w * 0.6), 0.03, m.dark, s * (w / 2 + 0.005), y, s * w * 0.15).rotation.x = s * 0.6;
    }
  });
  const stack = pivot(body, 0, 0.55, 0);
  swing(parts, stack, 'z', 0.08, 2);
  ball(stack, 0.27, 0x7a4a2a, 0, 0.17, 0);
  ball(stack, 0.25, m.accent, 0, 0.49, 0);
  ball(stack, 0.22, m.belly, 0, 0.78, 0);
  for (const s of [-1, 1]) {
    box(stack, 0.07, 0.14, 0.07, 0x7a4a2a, s * 0.22, 0.0, 0.12);
    box(stack, 0.07, 0.12, 0.07, m.accent, s * 0.2, 0.33, 0.1);
  }
  box(stack, 0.07, 0.16, 0.07, m.accent, 0, 0.32, 0.2);
  eyes(stack, 0.52, 0.26, 0.09, 0.1);
  mouth(stack, 0.42, 0.26, 0.1);
  for (const s of [-1, 1]) box(stack, 0.07, 0.05, 0.03, 0xff5a7a, s * 0.17, 0.44, 0.23);
  [[0xff4a4a, -0.1, 0.96, 0.1, 0.3], [0x4ab0ff, 0.1, 0.97, 0.08, -0.5], [0xffe84a, 0, 0.99, -0.1, 1.0], [0x6ad84a, -0.14, 0.9, -0.08, -0.2],
   [0xffffff, 0.14, 0.9, 0.06, 0.8], [0xb06aff, 0.03, 0.88, 0.17, 0.1]].forEach(([c, x, y, z, r]) => box(stack, 0.05, 0.02, 0.1, c, x, y, z).rotation.y = r);
  const cherry = pivot(stack, 0, 1.0, 0);
  swing(parts, cherry, 'z', 0.3, 3);
  ball(cherry, 0.07, 0xe0203a, 0, 0.07, 0);
  box(cherry, 0.02, 0.12, 0.02, 0x2a3a1a, 0.02, 0.19, 0).rotation.z = -0.3;
}
const SHAPES_FOOD = { sushi, burger, noodlebowl, icecream };
/* ==== end of T33 food shapes ==== */

export const SHAPES = {
  skull, bonedog, dino, ufo, visitor, tripod,
  guardian, butterfly, moth, star, robe, hopper, planet, comet, cloud, tall, squid, bat, drum, ape, bell, armadillo, wyvern, fish, nut, drone, wisp, puff, crystal,
  ...SHAPES_A, ...SHAPES_B, ...SHAPES_C,
  ...SHAPES_SKY, ...SHAPES_SLIME, ...SHAPES_LIGHT, ...SHAPES_PAPER,
  ...SHAPES_TIME, ...SHAPES_CAMO, ...SHAPES_CYBER,
  ...SHAPES_COZY, ...SHAPES_TREASURE,
  ...SHAPES_FOOD, // T33
};

/* ==== T36 parkour shapes ==== */
// Parkour look: a red sweatband and white sneakers with blue soles, long thin limbs, an action pose. The meshes are
// tagged (userData.gear = 'band' / 'shoe') so a spec can check that every Parkour model wears both.
// animateModel sets rotations absolutely, so every posed limb sits inside a plain pivot and the OUTER pivot is the one
// that swings (parts.wobble); nothing here sets root.position.
const PK_BAND = 0xff3b3b, PK_SHOE = 0xffffff, PK_SOLE = 0x2a8cff;
function pkHeadband(head, y, w, d, tails = true) {
  box(head, w, 0.06, d, PK_BAND, 0, y, 0).userData.gear = 'band';
  if (tails) {
    box(head, 0.06, 0.15, 0.04, PK_BAND, -0.05, y - 0.06, -d / 2 - 0.02).userData.gear = 'band';
    box(head, 0.06, 0.1, 0.04, PK_BAND, 0.05, y - 0.05, -d / 2 - 0.05).userData.gear = 'band';
  }
}
function pkSneaker(parent, x, y, z, rx = 0) {
  const g = pivot(parent, x, y, z);
  g.rotation.x = rx;
  box(g, 0.13, 0.08, 0.22, PK_SHOE, 0, 0, 0.04).userData.gear = 'shoe';
  box(g, 0.14, 0.03, 0.24, PK_SOLE, 0, -0.05, 0.04);
  box(g, 0.135, 0.02, 0.06, PK_BAND, 0, 0.03, 0.1);
  return g;
}
// A thin limb hanging from a pivot, posed by rx / rz (the pose lives in this inner pivot).
function pkLimb(parent, x, y, z, len, color, rx = 0, rz = 0, w = 0.07) {
  const g = pivot(parent, x, y, z);
  g.rotation.x = rx;
  g.rotation.z = rz;
  box(g, w, len, w, color, 0, -len / 2, 0);
  return g;
}

// Teetail / Tightropa: a lemur balancing on one foot on a short slackline, arms out, a long striped tail.
function lemur(root, m, parts) {
  const LINE = 0.3;
  box(root, 0.05, 0.04, 1.4, 0xffe14a, 0.04, LINE, 0);
  for (const z of [-0.7, 0.7]) box(root, 0.1, LINE, 0.1, 0x8a5a36, 0.04, LINE / 2, z);
  const lift = pivot(root, 0, 0.285, 0);
  const sway = pivot(lift, 0, 0.82, 0);
  swing(parts, sway, 'z', 0.05, 2.2);
  const body = pivot(sway, 0, 0, 0);
  body.rotation.z = 0.12;
  box(body, 0.3, 0.42, 0.24, m.body, 0, 0, 0);
  box(body, 0.2, 0.3, 0.02, m.belly, 0, -0.03, 0.125);
  const head = pivot(body, 0, 0.36, 0.02);
  box(head, 0.32, 0.28, 0.28, m.body, 0, 0, 0);
  box(head, 0.2, 0.16, 0.08, m.belly, 0, -0.04, 0.15);
  pkHeadband(head, 0.08, 0.34, 0.3);
  for (const s of [-1, 1]) {
    box(head, 0.09, 0.09, 0.03, m.dark, s * 0.08, 0, 0.19);
    box(head, 0.05, 0.05, 0.03, 0xffb020, s * 0.08, 0, 0.2);
    box(head, 0.1, 0.14, 0.06, m.dark, s * 0.17, 0.16, -0.02); // ears
    // arms straight out, wobbling to keep the balance
    const outer = pivot(body, s * 0.17, 0.16, 0);
    swing(parts, outer, 'z', 0.18, 2.6, s > 0 ? 0 : 1.6);
    const arm = pkLimb(outer, 0, 0, 0, 0.42, m.body, 0, s * 1.45, 0.08);
    box(arm, 0.1, 0.08, 0.1, m.dark, 0, -0.42, 0);
    if (s > 0 && has(m, 'umbrella')) { // Tightropa holds a tiny open umbrella
      const hx = 0.42 * Math.sin(1.45), hy = -0.42 * Math.cos(1.45);
      box(outer, 0.03, 0.55, 0.03, 0x6a4a30, hx, hy + 0.27, 0);
      box(outer, 0.62, 0.05, 0.62, m.accent, hx, hy + 0.56, 0);
      box(outer, 0.2, 0.06, 0.64, 0xffffff, hx, hy + 0.575, 0);
      box(outer, 0.4, 0.04, 0.4, m.accent, hx, hy + 0.61, 0);
    }
  }
  box(head, 0.06, 0.04, 0.03, m.dark, 0, -0.08, 0.2);
  // the standing leg on the line, the other leg bent up
  const l1 = pkLimb(lift, 0.04, 0.62, 0, 0.5, m.body, 0, 0.02, 0.1);
  pkSneaker(l1, 0, -0.52, 0.02, 0);
  const l2 = pkLimb(lift, -0.1, 0.62, 0, 0.3, m.body, -1.2, -0.3, 0.1);
  pkSneaker(l2, 0, -0.32, 0, 1.1);
  // the striped tail, curling up behind, longer than the body
  const tail = pivot(lift, -0.02, 0.62, -0.18);
  swing(parts, tail, 'x', 0.12, 1.8);
  for (let i = 0; i < 9; i++) {
    const a = i * 0.24;
    box(tail, 0.13, 0.13, 0.13, i % 2 ? m.dark : m.belly, -Math.sin(a) * 0.08, 0.06 + i * 0.115, -Math.sin(a * 0.9) * 0.4);
  }
}

// Zippet / Ferrocket: a long lean ferret stretched out mid-leap, front paws reaching, back legs pushing off.
function ferret(root, m, parts) {
  const spring = pivot(root, 0, 0.1, 0);
  parts.bounce = spring; // a springy bob (leaping in place when it moves)
  const b = pivot(spring, 0, 0.5, 0);
  b.rotation.x = -0.2; // nose up: leaping forward and up
  box(b, 0.26, 0.24, 1.1, m.body, 0, 0, 0);
  box(b, 0.2, 0.04, 0.9, m.belly, 0, -0.13, 0.02);
  const h = pivot(b, 0, 0.04, 0.66);
  parts.head = h;
  box(h, 0.3, 0.26, 0.28, m.body, 0, 0, 0);
  box(h, 0.31, 0.09, 0.12, m.dark, 0, 0.03, 0.09); // the mask
  box(h, 0.14, 0.12, 0.14, m.belly, 0, -0.07, 0.18);
  box(h, 0.06, 0.05, 0.04, 0x2a1a10, 0, -0.03, 0.26);
  pkHeadband(h, 0.12, 0.32, 0.3);
  for (const s of [-1, 1]) {
    box(h, 0.05, 0.06, 0.03, 0xffffff, s * 0.08, 0.04, 0.145);
    box(h, 0.03, 0.04, 0.02, 0x111111, s * 0.08, 0.04, 0.16);
    box(h, 0.08, 0.08, 0.06, m.body, s * 0.11, 0.16, -0.05);
    if (has(m, 'goggles')) { // Ferrocket: two goggles on the band
      box(h, 0.12, 0.1, 0.06, m.accent, s * 0.085, 0.17, 0.12);
      box(h, 0.08, 0.06, 0.03, 0xffffff, s * 0.085, 0.17, 0.155);
    }
    const f = pivot(b, s * 0.1, -0.08, 0.42); // front paws reaching forward
    swing(parts, f, 'x', 0.22, 6, s > 0 ? 0 : 1.2);
    const fl = pkLimb(f, 0, 0, 0, 0.28, m.body, -1.25, 0, 0.08);
    pkSneaker(fl, 0, -0.3, 0, 1.3);
    const k = pivot(b, s * 0.1, -0.08, -0.42); // back legs pushing off
    swing(parts, k, 'x', 0.2, 6, s > 0 ? 1.2 : 0);
    const kl = pkLimb(k, 0, 0, 0, 0.3, m.body, 1.1, 0, 0.09);
    pkSneaker(kl, 0, -0.32, 0, -1.0);
  }
  if (has(m, 'goggles')) box(h, 0.34, 0.04, 0.1, m.accent, 0, 0.17, 0.05);
  // the long tail streaming behind
  const t = pivot(b, 0, 0.04, -0.55);
  t.rotation.x = 0.2;
  swing(parts, t, 'y', 0.25, 3);
  box(t, 0.12, 0.12, 0.5, m.dark, 0, 0, -0.25);
}

// Vaultling / Highvault: a lanky jumper with a race number and long ears, holding its pole upright beside it.
function vaulter(root, m, parts) {
  const big = has(m, 'medal');
  const body = pivot(root, 0, 0.9, 0);
  body.rotation.x = 0.12;
  box(body, 0.26, 0.5, 0.22, m.body, 0, 0, 0);
  box(body, 0.18, 0.36, 0.02, m.belly, 0, 0, 0.115);
  box(body, 0.16, 0.1, 0.02, 0xffffff, 0, 0.08, 0.13); // the race number
  box(body, 0.04, 0.06, 0.02, PK_BAND, 0, 0.08, 0.14);
  if (big) { // Highvault: a gold medal on a ribbon
    box(body, 0.06, 0.2, 0.02, PK_BAND, 0, 0.2, 0.125);
    box(body, 0.12, 0.12, 0.03, m.accent, 0, -0.03, 0.14);
    box(body, 0.06, 0.06, 0.03, 0xfff0a0, 0, -0.03, 0.155);
  }
  const head = pivot(body, 0, 0.4, 0.04);
  parts.head = head;
  box(head, 0.26, 0.3, 0.26, m.body, 0, 0, 0);
  box(head, 0.18, 0.12, 0.12, m.belly, 0, -0.06, 0.15);
  pkHeadband(head, 0.09, 0.28, 0.28);
  eyes(head, 0.03, 0.135, 0.07, 0.09);
  box(head, 0.1, 0.03, 0.03, 0x5a2a3a, 0, -0.08, 0.215);
  for (const [i, s] of [-1, 1].entries()) {
    const ear = pivot(head, s * 0.08, 0.15, -0.04);
    box(ear, 0.05, 0.22, 0.05, m.dark, 0, 0.11, 0);
    swing(parts, ear, 'z', 0.12, 2, i * 1.5);
  }
  // long legs, mid-stride
  for (const [s, rx, ph] of [[-1, 0.5, 0], [1, -0.45, Math.PI]]) {
    const o = pivot(root, s * 0.07, 0.68, 0);
    swing(parts, o, 'x', 0.25, 5, ph);
    const l = pkLimb(o, 0, 0, 0, 0.6, m.body, rx);
    pkSneaker(l, 0, -0.62, 0.02, -rx);
  }
  // the free arm swings, the other holds the pole upright beside the body
  const freeArm = pivot(body, -0.15, 0.18, 0.04);
  swing(parts, freeArm, 'x', 0.4, 5, 0);
  pkLimb(freeArm, 0, 0, 0, 0.34, m.body, -0.5, 0, 0.07);
  const hold = pivot(body, 0.15, 0.18, 0.04);
  swing(parts, hold, 'z', 0.04, 2.5);
  pkLimb(hold, 0, 0, 0, 0.34, m.body, 0, 0.75, 0.07);
  const len = big ? 1.45 : 0.9;
  const pole = pivot(root, 0.4, 0, 0.12);
  swing(parts, pole, 'z', 0.03, 2.5);
  box(pole, 0.05, len, 0.05, m.accent, 0, len / 2, 0);
  box(pole, 0.07, 0.06, 0.07, PK_BAND, 0, len - 0.03, 0);
}

// Zoomstick: a stick-figure runner mid-sprint, with a creature face (two pointy ears and a snout).
function stickrunner(root, m, parts) {
  const hip = pivot(root, 0, 0.78, 0);
  hip.rotation.x = 0.25;
  box(hip, 0.08, 0.5, 0.08, m.body, 0, 0.25, 0); // spine
  const head = pivot(hip, 0, 0.62, 0.05);
  parts.head = head;
  box(head, 0.3, 0.3, 0.3, m.accent, 0, 0, 0);
  box(head, 0.14, 0.12, 0.12, m.belly, 0, -0.06, 0.18); // snout
  box(head, 0.06, 0.05, 0.04, 0x2a1a10, 0, -0.03, 0.25);
  pkHeadband(head, 0.07, 0.32, 0.32);
  eyes(head, 0.04, 0.155, 0.07, 0.09);
  for (const s of [-1, 1]) { // pointy ears
    const ear = box(head, 0.09, 0.22, 0.06, m.accent, s * 0.1, 0.24, -0.02);
    ear.rotation.z = -s * 0.2;
    box(head, 0.04, 0.14, 0.03, m.belly, s * 0.1, 0.23, 0.01).rotation.z = -s * 0.2;
  }
  // arms swinging, legs mid-stride: running on the spot
  for (const [s, rx, ph] of [[-1, -0.9, 0], [1, 0.9, Math.PI]]) {
    const o = pivot(hip, s * 0.08, 0.46, 0);
    swing(parts, o, 'x', 0.35, 8, ph);
    const a = pkLimb(o, 0, 0, 0, 0.36, m.body, rx, s * -0.1);
    box(a, 0.1, 0.08, 0.1, PK_BAND, 0, -0.3, 0);
  }
  const o1 = pivot(root, -0.06, 0.78, 0);
  swing(parts, o1, 'x', 0.3, 8, Math.PI);
  pkSneaker(pkLimb(o1, 0, 0, 0, 0.42, m.body, 0.7), 0, -0.44, 0.02, -0.7);
  const o2 = pivot(root, 0.06, 0.78, 0);
  swing(parts, o2, 'x', 0.3, 8, 0);
  const l2 = pkLimb(o2, 0, 0, 0, 0.42, m.body, -0.6);
  pkSneaker(pkLimb(l2, 0, -0.42, 0, 0.36, m.body, -0.9), 0, -0.38, 0, 1.5);
}
const SHAPES_PARKOUR = { lemur, ferret, vaulter, stickrunner };
Object.assign(SHAPES, SHAPES_PARKOUR);
/* ==== end of T36 parkour shapes ==== */
