// T49: the Castle's models (THREE only, vertex colours or a few plain materials; never world blocks): the pumpkins and arrows (instanced),
// the stones' lamp rings, the practice catapults with their wooden archers (instanced), the practice knight on his trolley with the
// shield, the gold star and your aim dot, the lance and the shield you hold, the drawbridge and the portcullis. Each builder returns a
// Group with userData.parts and userData.dispose(). tests/castle-preview.mjs photographs them for the owner.
import * as THREE from 'three';

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const disposer = g => () => g.traverse(o => { if (o.isMesh || o.isInstancedMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
const hide = m => { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < m.count; i++) m.setMatrixAt(i, z); m.instanceMatrix.needsUpdate = true; };
const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; hide(m); return m; };

// Squishy pumpkins (orange, a green stem) and suction-cup arrows (a wooden shaft, a cream cup, green feathers): n of each.
export function buildThrows(n = 16) {
  const g = new THREE.Group();
  const pg = new THREE.IcosahedronGeometry(0.32, 1); pg.scale(1, 0.82, 1);
  const pumpkins = inst(pg, lam(0xff8a1a, { emissive: 0x401800 }), n);
  const sg = new THREE.BoxGeometry(0.07, 0.16, 0.07); sg.translate(0, 0.3, 0);
  const stems = inst(sg, lam(0x4a8a2a), n);
  const ag = new THREE.BoxGeometry(0.05, 0.05, 0.9);
  const arrows = inst(ag, lam(0xc89a5a), n);
  const cg = new THREE.CylinderGeometry(0.1, 0.06, 0.08, 8); cg.rotateX(Math.PI / 2); cg.translate(0, 0, 0.47);
  const cups = inst(cg, lam(0xf6efe0), n);
  g.add(pumpkins, stems, arrows, cups);
  g.userData.parts = { pumpkins, stems, arrows, cups, n };
  g.userData.dispose = disposer(g);
  return g;
}

// The lamp rings round the two stones: 12 flat segments each (instanced, a colour per segment).
export function buildStoneRings(stones) {
  const g = new THREE.Group(), n = stones.length * 12;
  const geo = new THREE.BoxGeometry(0.9, 0.06, 0.32);
  const seg = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
  seg.frustumCulled = false;
  seg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  stones.forEach((s, j) => { for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; q.setFromAxisAngle(Y, a + Math.PI / 2); m.compose(new THREE.Vector3(s[0] + Math.sin(a) * 2.1, s[1] + 0.04, s[2] - Math.cos(a) * 2.1), q, new THREE.Vector3(1, 1, 1)); seg.setMatrixAt(j * 12 + k, m); seg.setColorAt(j * 12 + k, new THREE.Color(0x5a5a64)); } });
  // the stone's painted top: a round shield (a disc of blue with a gold rim and a star)
  const discs = stones.map(s => { const d = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 20), lam(0x3a5ad8)); d.position.set(s[0], s[1] + 0.03, s[2]); return d; });
  const rims = stones.map(s => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.08, 4, 20), lam(0xf0c84a)); r.rotation.x = Math.PI / 2; r.position.set(s[0], s[1] + 0.06, s[2]); return r; });
  g.add(seg, ...discs, ...rims);
  g.userData.parts = { seg };
  g.userData.dispose = disposer(g);
  return g;
}

// The practice catapults (a frame and an arm that pulls back) and their wooden archers (a body, a round head, a bow): instanced.
export function buildCatapults(n = 12) {
  const g = new THREE.Group();
  const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), lam(0x8a5a30), n);
  const arms = new THREE.InstancedMesh((() => { const a = new THREE.BoxGeometry(0.16, 0.16, 1.8); a.translate(0, 0, -0.8); return a; })(), lam(0x6a4220), n);
  const buckets = new THREE.InstancedMesh((() => { const b = new THREE.BoxGeometry(0.42, 0.22, 0.42); b.translate(0, 0.1, -1.6); return b; })(), lam(0x4a2a14), n);
  const archers = new THREE.InstancedMesh((() => { const b = new THREE.BoxGeometry(0.4, 0.9, 0.3); b.translate(0.9, 0.45, 0); return b; })(), lam(0xc89a5a), n);
  const heads = new THREE.InstancedMesh((() => { const b = new THREE.BoxGeometry(0.34, 0.34, 0.34); b.translate(0.9, 1.08, 0); return b; })(), lam(0xe8c89a), n);
  for (const m of [frames, arms, buckets, archers, heads]) { m.frustumCulled = false; g.add(m); }
  g.userData.parts = { frames, arms, buckets, archers, heads, n };
  g.userData.dispose = disposer(g);
  return g;
}

// Sir Splinter, the practice knight: a wooden knight on a wooden horse on a little trolley, a shield on his arm with a gold star, a wooden lance.
// Faces +x (the group is turned by the live part). The shield's centre is userData.parts.shield (a group at the shield plane).
export function buildPracticeKnight() {
  const g = new THREE.Group(), wood = 0xc89a5a, dark = 0x7a5428;
  const add = (w, h, d, c, x, y, z, p = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); p.add(m); return m; };
  add(1.8, 0.2, 0.9, dark, 0, 0.25, 0);                        // the trolley
  for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), lam(0x3a3a44)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.2, z); g.add(w); }
  const body = new THREE.Group(); g.add(body);
  add(1.4, 0.55, 0.5, wood, 0, 0.75, 0, body);                 // the wooden horse
  add(0.35, 0.6, 0.35, wood, 0.75, 1.15, 0, body);             // its neck and head
  add(0.5, 0.3, 0.3, wood, 0.95, 1.45, 0, body);
  add(0.42, 0.8, 0.36, 0xd8dce6, 0, 1.45, 0, body);            // the knight: a tin body
  add(0.36, 0.36, 0.36, 0xd8dce6, 0, 2.03, 0, body);           // a bucket helm
  add(0.3, 0.05, 0.02, 0x1e1e26, 0.19, 2.05, 0, body).rotation.y = Math.PI / 2;
  add(0.08, 0.2, 0.26, 0xd83a4a, 0, 2.3, 0, body);             // a red plume
  const lance = add(2.4, 0.08, 0.08, dark, 1.2, 1.5, 0.25, body); // his wooden lance
  const shield = new THREE.Group(); shield.position.set(0.3, 1.6, -0.45); body.add(shield);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 20), lam(0x3a5ad8)); face.rotation.z = Math.PI / 2; shield.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 4, 24), lam(0xf0c84a)); rim.rotation.y = Math.PI / 2; shield.add(rim);
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.12 : 0.3; (i ? s.lineTo : s.moveTo).call(s, Math.cos(a) * r, Math.sin(a) * r); }
  const star = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide })); star.rotation.y = Math.PI / 2; star.position.x = 0.05; shield.add(star);
  const dot = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.14, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false, transparent: true }));
  dot.rotation.y = Math.PI / 2; dot.position.x = 0.07; dot.renderOrder = 998; shield.add(dot);
  g.userData.parts = { body, shield, star, dot, lance };
  g.userData.dispose = disposer(g);
  return g;
}

// Your lance (from your right hand, pointing along -z of the group: the live part aims it) and the shield you hold on the stone.
export function buildLance() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 4.2, 8), lam(0xf0ece0)); shaft.rotation.x = -Math.PI / 2; shaft.position.z = -2.1; g.add(shaft);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.075 - i * 0.006, 0.075 - i * 0.006, 0.18, 8), lam(0xd83a4a)); b.rotation.x = -Math.PI / 2; b.position.z = -0.6 - i * 0.6; g.add(b); }
  const guard = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 10), lam(0xd8dce6)); guard.rotation.x = Math.PI / 2; guard.position.z = 0.1; g.add(guard);
  g.userData.parts = { shaft };
  g.userData.dispose = disposer(g);
  return g;
}
export function buildHeldShield() {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 18), lam(0x3a5ad8)); face.rotation.x = Math.PI / 2; g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 4, 20), lam(0xf0c84a)); g.add(rim);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0xf0c84a)); boss.position.z = 0.04; g.add(boss);
  for (const [w, h] of [[0.08, 0.6], [0.6, 0.08]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), lam(0xf6efe0)); c.position.z = 0.03; g.add(c); }
  g.userData.dispose = disposer(g);
  return g;
}

// The drawbridge: planks with iron bands and two chains; it turns round its hinge (x axis): 0 = down (flat over the moat), PI/2 = up.
export function buildDrawbridge(w = 5, len = 5) {
  const g = new THREE.Group(), leaf = new THREE.Group(); g.add(leaf);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, len), lam(0x9a6a3a)); deck.position.set(0, 0, len / 2); leaf.add(deck);
  for (const z of [0.6, len / 2, len - 0.6]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.27, 0.16), lam(0x4a4a54)); b.position.set(0, 0, z); leaf.add(b); }
  const chains = [-1, 1].map(s => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1), lam(0x6a6a74)); c.position.x = s * (w / 2 - 0.2); g.add(c); return c; });
  g.userData.parts = { leaf, chains, w, len };
  g.userData.dispose = disposer(g);
  return g;
}
// The portcullis: an iron grid (instanced bars) that slides up.
export function buildPortcullis(w = 5, h = 5) {
  const g = new THREE.Group(), n = (w + 1) + (h + 1);
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0x3a3a44), n);
  const m = new THREE.Matrix4(); let i = 0;
  for (let x = 0; x <= w; x++) bars.setMatrixAt(i++, m.compose(new THREE.Vector3(x - w / 2, h / 2, 0), new THREE.Quaternion(), new THREE.Vector3(0.12, h, 0.12)));
  for (let y = 0; y <= h; y++) bars.setMatrixAt(i++, m.compose(new THREE.Vector3(0, y + 0.02, 0), new THREE.Quaternion(), new THREE.Vector3(w, 0.1, 0.1)));
  bars.instanceMatrix.needsUpdate = true;
  g.add(bars);
  g.userData.dispose = disposer(g);
  return g;
}
