// Cube Planets: the games' models (cubelive.js). Plain three.js, no game imports. Every builder returns a Group whose userData.dispose()
// frees its geometry and materials; nothing here is a block, nothing is saved.
import * as THREE from 'three';

const lam = (color, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });
const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
function disposer(g) { g.userData.dispose = () => g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } }); return g; }
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

// A home flower (blue; the pink launch flowers became springs: buildSpring): a short stem, six round petals and a yellow middle, standing on +y.
// The flower's local +y is turned to the face's up by the caller. `bob` (userData) springs when it launches.
export function buildFlower(home = false) {
  const g = new THREE.Group(), head = new THREE.Group();
  const petal = home ? 0x7ab8ff : 0xff8ac8, mid = home ? 0xe8f4ff : 0xffe14a;
  add(g, new THREE.BoxGeometry(0.1, 0.5, 0.1), lam(0x4aa850), 0, 0.25, 0);
  for (const s of [-1, 1]) { const leaf = add(g, new THREE.BoxGeometry(0.22, 0.04, 0.1), lam(0x5ac460), s * 0.12, 0.2, 0); leaf.rotation.z = s * 0.4; }
  head.position.y = 0.52; g.add(head);
  const pg = new THREE.BoxGeometry(0.22, 0.06, 0.16), pm = lam(petal, home ? 0x1a3050 : 0x401830);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, m = add(head, pg, pm, Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17); m.rotation.y = -a; }
  add(head, new THREE.BoxGeometry(0.16, 0.09, 0.16), lam(mid, home ? 0x203040 : 0x504010), 0, 0.02, 0);
  g.userData.head = head;
  return disposer(g);
}

// A spring flower (the Planet Hop; redesign 2026-10-29: it must look like a spring, so the rule needs no words): a big pink bloom on a
// fat green coil. The group's origin is the face under it (+y = the face's up, turned by the caller). userData.set(squash, lift):
// squash 0..1 presses the coil flat (someone stands on it), lift > 0 stretches it (the boing after a fling).
export function buildSpring() {
  const g = new THREE.Group(), coil = new THREE.Group(), head = new THREE.Group();
  g.add(coil); g.add(head);
  const cm = lam(0x3fa04a, 0x0a2a0c), turns = 4, per = 10, rad = 0.36;
  const seg = new THREE.BoxGeometry(0.24, 0.09, 0.09);
  for (let i = 0; i < turns * per; i++) { const a = i / per * Math.PI * 2, m = add(coil, seg, cm, Math.cos(a) * rad, (i + 0.5) / (turns * per), Math.sin(a) * rad); m.rotation.y = -a + Math.PI / 2; }
  const pm = lam(0xff7ac0, 0x40142c), pg = new THREE.BoxGeometry(0.46, 0.07, 0.32);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, m = add(head, pg, pm, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); m.rotation.y = -a; m.rotation.z = 0.12; }
  add(head, new THREE.CylinderGeometry(0.32, 0.32, 0.12, 12), lam(0xffe14a, 0x504010), 0, 0.03, 0);
  const H = 0.42; // the coil's height at rest: the bloom stands this far up; squashed flat it lies on the face (under your feet)
  g.userData.set = (squash = 0, lift = 0) => { const h = Math.max(0.04, H * (1 - squash) + lift); coil.scale.y = h; head.position.y = h + 0.04; };
  g.userData.set(0, 0);
  g.userData.head = head;
  return disposer(g);
}

// The little moon of the Moon Ferry: a pale slab of moon rock with craters and a tiny flag; the group's origin is the middle of its top
// (where you stand); `thick` below it.
export function buildMoon(half = 1.25, thick = 1.2) {
  const g = new THREE.Group(), s = half * 2;
  add(g, new THREE.BoxGeometry(s, thick, s), lam(0xd8d4e8, 0x24222e), 0, -thick / 2, 0);
  add(g, new THREE.BoxGeometry(s * 0.7, thick * 0.5, s * 0.7), lam(0xc8c2da, 0x1c1a26), 0, -thick - thick * 0.2, 0); // a rounder bottom
  const crater = new THREE.BoxGeometry(0.42, 0.06, 0.42), cm = lam(0xa8a2bc);
  for (const [x, z] of [[-0.5, 0.4], [0.55, -0.35], [0.1, 0.75]]) add(g, crater, cm, x * half / 1.25, 0.02, z * half / 1.25);
  add(g, new THREE.BoxGeometry(0.05, 0.7, 0.05), lam(0x8a8a96), half - 0.3, 0.35, -half + 0.3);       // the flag pole
  add(g, new THREE.BoxGeometry(0.34, 0.22, 0.03), lam(0xf2d27a, 0x403010), half - 0.12, 0.58, -half + 0.3); // a gold flag
  return disposer(g);
}

// The little sun the moon goes round: a warm glowing ball with a soft halo (never a block, nothing pulls you to it).
export function buildSun(r = 1.4) {
  const g = new THREE.Group();
  add(g, new THREE.IcosahedronGeometry(r, 1), basic(0xffd25a));
  add(g, new THREE.IcosahedronGeometry(r * 1.5, 1), basic(0xffb84a, 0.25));
  add(g, new THREE.IcosahedronGeometry(r * 2.2, 1), basic(0xff9a3a, 0.1));
  return disposer(g);
}

// A telescope lens (the Moon Ferry's prize): a glowing glass disc in a brass ring, standing up on its Lens Rock under a soft beam of light
// (you see where it is from the dock); it turns slowly.
export function buildLens() {
  const g = new THREE.Group(), spin = new THREE.Group();
  spin.position.y = 0.95; g.add(spin);
  const ring = add(spin, new THREE.TorusGeometry(0.42, 0.07, 6, 24), lam(0xd8a840, 0x3a2a08));
  const glass = add(spin, new THREE.CircleGeometry(0.38, 24), basic(0xa8e0ff, 0.6));
  glass.material.side = THREE.DoubleSide;
  add(g, new THREE.BoxGeometry(0.12, 0.35, 0.12), lam(0x8a6a30), 0, 0.17, 0);
  add(g, new THREE.CylinderGeometry(0.22, 0.22, 12, 10, 1, true), basic(0xffe68a, 0.22), 0, 6.5, 0); // a soft beam of light: seen from far away
  spin.scale.setScalar(1.5);
  g.userData.spin = spin; void ring;
  return disposer(g);
}

// Dots on the surface (the Orbikit's loops, faint; its sparkly trail, bright): one InstancedMesh each.
export function buildDots(n, color, size = 0.1, opacity = 1) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), basic(color, opacity), n);
  m.frustumCulled = false;
  const Z = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) m.setMatrixAt(i, Z);
  const g = new THREE.Group();
  g.add(m); g.userData.mesh = m;
  return disposer(g);
}
