// Cube Planets: the games' models (cubelive.js). Plain three.js, no game imports. Every builder returns a Group whose userData.dispose()
// frees its geometry and materials; nothing here is a block, nothing is saved.
import * as THREE from 'three';

const lam = (color, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });
const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
function disposer(g) { g.userData.dispose = () => g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } }); return g; }
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

// A launch flower (pink, the Planet Hop) or a home flower (blue): a short stem, six round petals and a yellow middle, standing on +y.
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

// The little moon of the Moon Ride: a pale cube with craters and a tiny flag; the group's origin is the middle of its top (where you stand).
export function buildMoon(half = 1.25) {
  const g = new THREE.Group(), s = half * 2;
  add(g, new THREE.BoxGeometry(s, s, s), lam(0xd8d4e8, 0x24222e), 0, -half, 0);
  const crater = new THREE.BoxGeometry(0.42, 0.06, 0.42), cm = lam(0xa8a2bc);
  for (const [x, z] of [[-0.5, 0.4], [0.55, -0.35], [0.1, 0.75]]) add(g, crater, cm, x * half / 1.25, 0.02, z * half / 1.25);
  for (const [x, y, z, r] of [[half + 0.02, -0.6, 0.3, 0], [-half - 0.02, -1.0, -0.4, 0], [0.3, -0.7, half + 0.02, 1]]) { const m = add(g, new THREE.BoxGeometry(0.06, 0.4, 0.4), cm, x, y * half / 1.25, z); if (r) m.rotation.y = Math.PI / 2; }
  add(g, new THREE.BoxGeometry(0.05, 0.7, 0.05), lam(0x8a8a96), half - 0.3, 0.35, -half + 0.3);       // the flag pole
  add(g, new THREE.BoxGeometry(0.34, 0.22, 0.03), lam(0xf2d27a, 0x403010), half - 0.12, 0.58, -half + 0.3); // a gold flag
  return disposer(g);
}

// A landing ring on the Moon Base: a glowing gold ring flat on the ground, a soft disc inside. userData.glow = the disc's material.
export function buildRing(r = 1.6) {
  const g = new THREE.Group();
  const ring = add(g, new THREE.TorusGeometry(r, 0.09, 6, 36), basic(0xffd84a), 0, 0.06, 0);
  ring.rotation.x = Math.PI / 2;
  const disc = add(g, new THREE.CircleGeometry(r - 0.1, 28), basic(0xfff2a0, 0.25), 0, 0.03, 0);
  disc.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, m = add(g, new THREE.BoxGeometry(0.16, 0.16, 0.16), basic(0xfff4c0), Math.cos(a) * r, 0.2, Math.sin(a) * r); m.rotation.y = a; }
  g.userData.glow = disc.material;
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
