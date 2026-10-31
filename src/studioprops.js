// Wave 19 stage B: the Wizard's studio models (plans/wave19-wizard-tower.md sections 5 and 6): the picture on the easel (drawn from FLOORS, also the
// `#easel` card in the HUD), the easel, the paint pots' dark rims and the brush you hold. Nothing here is a block, nothing is saved or sent.
import * as THREE from 'three';
import { PAINTS } from './custom.js';
import { targetOf } from './wizardtower.js';

const hex = n => `#${n.toString(16).padStart(6, '0')}`;
const RAINBOW = ['#e13c3c', '#ff963c', '#f0c828', '#50aa46', '#3c6edc', '#8c46b4'];

// Draws floor `f`'s little picture on a 2D context of `size` px: the paints as plain squares, blanks as paper, and a free group as a rainbow thing
// that looks different per group (owner plan: group 1 a big ?, 2 dots, 3 stripes) so a child sees "any colour you like, all the same". `cells` (optional,
// the canvas as painted so far) draws that instead of the target (the card can also show your own progress).
export function drawPicture(g, f, size, cells = null) {
  const T = targetOf(f), m = size * 0.07, cs = (size - 2 * m) / Math.max(f.w, f.h);
  const ox = (size - cs * f.w) / 2, oy = (size - cs * f.h) / 2;
  g.fillStyle = '#f6efdc'; g.fillRect(0, 0, size, size);
  g.strokeStyle = '#8a6a44'; g.lineWidth = Math.max(2, size * 0.035); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, size - g.lineWidth, size - g.lineWidth);
  T.forEach((t, i) => {
    const x = ox + (i % f.w) * cs, y = oy + Math.floor(i / f.w) * cs;
    if (cells) { if (cells[i] >= 0) { g.fillStyle = hex(PAINTS[cells[i]].hex); g.fillRect(x, y, cs + 0.5, cs + 0.5); } return; }
    if (t.kind === 'paint' || t.kind === 'given') { g.fillStyle = hex(PAINTS[t.paint].hex); g.fillRect(x, y, cs + 0.5, cs + 0.5); return; }
    if (t.kind !== 'group') return;
    const rb = g.createLinearGradient(x, y, x + cs, y + cs);
    RAINBOW.forEach((c, k) => rb.addColorStop(k / (RAINBOW.length - 1), c));
    g.save(); g.beginPath(); g.rect(x, y, cs + 0.5, cs + 0.5); g.clip();
    g.fillStyle = rb; g.fillRect(x, y, cs + 0.5, cs + 0.5);
    if (t.group === 0) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `bold ${cs * 0.95}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', x + cs / 2, y + cs / 2 + cs * 0.04); }
    else if (t.group === 1) { g.fillStyle = 'rgba(255,255,255,0.8)'; for (const [a, b] of [[0.3, 0.3], [0.7, 0.3], [0.5, 0.7]]) { g.beginPath(); g.arc(x + cs * a, y + cs * b, cs * 0.14, 0, 7); g.fill(); } }
    else { g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = cs * 0.14; for (let k = -1; k < 4; k++) { g.beginPath(); g.moveTo(x + k * cs * 0.4, y + cs); g.lineTo(x + k * cs * 0.4 + cs, y); g.stroke(); } }
    g.restore();
  });
}
export function pictureCanvas(f, size = 128, cells = null) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  drawPicture(c.getContext('2d'), f, size, cells);
  return c;
}

// The easel: three wooden legs, a ledge and a board with the picture, facing +z (the live part turns it toward the mat). About 1.7 tall, 1.2 wide.
export function buildEasel(f) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0xb07a40 }), dark = new THREE.MeshLambertMaterial({ color: 0x6a4524 });
  const box = (w, h, d, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  box(0.08, 1.7, 0.08, wood, -0.5, 0.85, 0.12, -0.1); box(0.08, 1.7, 0.08, wood, 0.5, 0.85, 0.12, -0.1); box(0.08, 1.6, 0.08, wood, 0, 0.8, -0.28, 0.2);
  box(1.3, 0.1, 0.22, dark, 0, 0.6, 0.2);
  const tex = new THREE.CanvasTexture(pictureCanvas(f, 128));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: tex }));
  pic.position.set(0, 1.18, 0.2); pic.rotation.x = -0.1; g.add(pic);
  box(1.12, 1.12, 0.05, dark, 0, 1.18, 0.16, -0.1);
  g.userData.dispose = () => { tex.dispose(); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } }); };
  return g;
}

// A dark rim on top of every paint pot (the pot is the paint's own wool block): four thin boards round the top face, one merged mesh.
export function buildPotRims(pots) {
  const pos = [], nor = [];
  const add = (w, h, d, x, y, z) => {
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const P = geo.attributes.position, N = geo.attributes.normal;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i) + x, P.getY(i) + y, P.getZ(i) + z); nor.push(N.getX(i), N.getY(i), N.getZ(i)); }
    geo.dispose();
  };
  for (const p of pots) {
    const x = p.x + 0.5, y = p.y + 1.04, z = p.z + 0.5, t = 0.12;
    add(1.04, 0.1, t, x, y, z - 0.46); add(1.04, 0.1, t, x, y, z + 0.46); add(t, 0.1, 0.8, x - 0.46, y, z); add(t, 0.1, 0.8, x + 0.46, y, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x4a3426 }));
  m.userData.dispose = () => { geo.dispose(); m.material.dispose(); };
  return m;
}

// The brush you hold (three meshes drawn over the world like the Swirl Wand: no wall can hide it). Built along +y with its grip at the origin; the
// bristles take the colour of the paint on the brush (`setPaint(hex | null)`), a plain pale tuft when it is dry.
export function buildBrush() {
  const over = { depthTest: false, depthWrite: false };
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.42, 8), new THREE.MeshBasicMaterial({ color: 0xc08848, ...over })); handle.position.y = 0.21;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.1, 8), new THREE.MeshBasicMaterial({ color: 0xc8ccd4, ...over })); ferrule.position.y = 0.47;
  const bristles = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.15, 8), new THREE.MeshBasicMaterial({ color: 0xf0e6cc, ...over })); bristles.position.y = 0.595;
  const group = new THREE.Group();
  group.add(handle, ferrule, bristles);
  handle.renderOrder = 60; ferrule.renderOrder = 61; bristles.renderOrder = 62;
  group.userData.setPaint = h => bristles.material.color.setHex(h == null ? 0xf0e6cc : h);
  group.userData.tip = new THREE.Vector3(0, 0.67, 0);
  group.userData.dispose = () => group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return group;
}

// The painter's mat: a 2 x 2 rug (a pink one with a gold edge) lying on the floor where you stand to paint.
export function buildRug() {
  const g = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xe8b83a })), inner = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 1.78), new THREE.MeshBasicMaterial({ color: 0xff9fc4 }));
  for (const m of [edge, inner]) { m.rotation.x = -Math.PI / 2; g.add(m); }
  inner.position.y = 0.004;
  g.userData.dispose = () => g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return g;
}
