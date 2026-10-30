// T48 (plans/T48-surprise-party.md): the Surprise Party's things as real models (a crane, a party plate on the wall, balloons and
// bunting are not blocks). Blocks still do the walking (the floor, the table, the cake, the pop-up boxes); these meshes only show what a
// thing IS. Merged geometries with vertex colours, instanced where there are many, like fairprops.js.
// Every builder returns a THREE.Group with `userData.parts` (named pieces the live part moves) and `userData.dispose()`; the box lists
// (piñatas, jacks, pies...) are shared with partylive.js. No Math.random: anything scattered comes from a hash.
import * as THREE from 'three';
import { GAMES } from './spinner.js';

const GOLD = 0xffd23a, WHITE = 0xffffff, INK = 0x16121a;
const _c = new THREE.Color(), _o = new THREE.Object3D();
const rand01 = (i, salt) => { let h = 2166136261; const s = `${salt}|${i}`; for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; };

// Boxes [w, h, d, colour, x, y, z, (rotY)] -> one geometry with vertex colours.
export function merged(boxes) {
  const pos = [], nor = [], col = [], idx = [];
  for (const [w, h, d, color, x, y, z, ry = 0] of boxes) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    const base = pos.length / 3;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    _c.setHex(color);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(_c.r, _c.g, _c.b);
    idx.push(...Array.from(g.index.array, i => i + base));
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
function finish(group, parts = {}) {
  group.userData.parts = parts;
  group.userData.party = true;
  group.userData.dispose = () => group.traverse(o => {
    if (o.isMesh) { o.geometry?.dispose(); for (const m of [o.material].flat()) { m?.map?.dispose(); m?.dispose(); } }
  });
  return group;
}
const lambert = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });

/* ---------------------------------------- the shared box lists (from the Room of Doors) ---------------------------------------- */

// The golden bow: two loops, a knot and two tails (origin = the middle of the knot).
export const bowBoxes = (s = 1) => [[0.5 * s, 0.34 * s, 0.14 * s, GOLD, -0.3 * s, 0.12 * s, 0], [0.5 * s, 0.34 * s, 0.14 * s, GOLD, 0.3 * s, 0.12 * s, 0], [0.24 * s, 0.24 * s, 0.2 * s, 0xe8a81a, 0, 0.1 * s, 0],
  [0.12 * s, 0.4 * s, 0.1 * s, GOLD, -0.12 * s, -0.22 * s, 0], [0.12 * s, 0.4 * s, 0.1 * s, GOLD, 0.12 * s, -0.22 * s, 0], [0.2 * s, 0.16 * s, 0.08 * s, WHITE, -0.34 * s, 0.14 * s, 0.08], [0.2 * s, 0.16 * s, 0.08 * s, WHITE, 0.34 * s, 0.14 * s, 0.08]];
// A pop-up jack: a spring of three grey discs, a cream head with a grin, a red nose and a striped cap (origin = the middle of the jack; the head at +0.33).
export const jackBoxes = ({ nose = true } = {}) => [[0.5, 0.12, 0.5, 0x9094a2, 0, -0.55, 0], [0.5, 0.12, 0.5, 0xc8ccd8, 0, -0.35, 0], [0.5, 0.12, 0.5, 0x9094a2, 0, -0.15, 0], [0.7, 0.62, 0.7, 0xfff0d8, 0, 0.33, 0],
  [0.1, 0.1, 0.1, INK, -0.17, 0.43, 0.36], [0.1, 0.1, 0.1, INK, 0.17, 0.43, 0.36], ...(nose ? [[0.16, 0.14, 0.12, 0xff4a6a, 0, 0.29, 0.4]] : []), [0.34, 0.06, 0.06, INK, 0, 0.13, 0.36],
  [0.76, 0.12, 0.76, 0xe8384a, 0, 0.69, 0], [0.46, 0.22, 0.46, 0xffd23a, 0, 0.85, 0], [0.12, 0.12, 0.12, 0xffffff, 0, 1.01, 0]];
export const noseBoxes = () => [[0.2, 0.18, 0.16, 0xff3a5a, 0, 0.29, 0.41]];
// A cream pie: a tin, the cream, a cherry.
export const pieBoxes = () => [[0.8, 0.16, 0.8, 0xb8b8c8, 0, -0.1, 0], [0.72, 0.2, 0.72, 0xfff6e0, 0, 0.06, 0], [0.4, 0.14, 0.4, 0xffffff, 0, 0.2, 0], [0.14, 0.14, 0.14, 0xe8243a, 0, 0.32, 0]];
// The three piñatas (crepe-paper stripes; origin = the middle, the rope's knot on top at y 0.7).
export const PINATAS = {
  llama: [[0.9, 0.5, 0.5, 0xff6a8a, 0, 0, 0], [0.9, 0.12, 0.52, 0xffd23a, 0, 0.12, 0], [0.9, 0.12, 0.52, 0x3ac8e8, 0, -0.12, 0], [0.26, 0.6, 0.26, 0xff6a8a, 0.38, 0.38, 0], [0.36, 0.22, 0.3, 0xffd23a, 0.5, 0.66, 0],
    [0.08, 0.16, 0.08, 0xff6a8a, 0.36, 0.84, 0.08], [0.08, 0.16, 0.08, 0xff6a8a, 0.36, 0.84, -0.08], [0.06, 0.06, 0.06, INK, 0.6, 0.7, 0.12], [0.06, 0.06, 0.06, INK, 0.6, 0.7, -0.12],
    [0.12, 0.34, 0.12, 0x6ae86a, -0.32, -0.38, 0.14], [0.12, 0.34, 0.12, 0xb05ae8, -0.32, -0.38, -0.14], [0.12, 0.34, 0.12, 0x6ae86a, 0.3, -0.38, 0.14], [0.12, 0.34, 0.12, 0xb05ae8, 0.3, -0.38, -0.14],
    [0.12, 0.22, 0.12, 0xffd23a, -0.5, 0.12, 0], [0.04, 0.4, 0.04, 0xfff0d0, 0, 0.45, 0]],
  // the 'star' round's piñata is a fish (owner 2026-10-30: only the Wizard's star is a star; the round's id stays 'star')
  star: [[0.9, 0.5, 0.34, 0x3ac8e8, 0, 0, 0], [0.9, 0.12, 0.36, 0xffd23a, 0, -0.13, 0], [0.9, 0.1, 0.36, 0xff6a8a, 0, 0.14, 0], [0.24, 0.38, 0.3, 0x3ac8e8, 0.55, 0, 0],
    [0.18, 0.62, 0.08, 0xff8a1a, -0.56, 0, 0], [0.12, 0.3, 0.08, 0xffd23a, -0.68, 0.16, 0], [0.12, 0.3, 0.08, 0xffd23a, -0.68, -0.16, 0], [0.34, 0.18, 0.08, 0xff8a1a, -0.05, 0.33, 0],
    [0.2, 0.12, 0.08, 0xff8a1a, 0.1, -0.31, 0], [0.07, 0.07, 0.07, INK, 0.6, 0.08, 0.16], [0.07, 0.07, 0.07, INK, 0.6, 0.08, -0.16], [0.05, 0.06, 0.14, INK, 0.68, -0.08, 0],
    [0.04, 0.3, 0.04, 0xfff0d0, 0, 0.55, 0]],
  rocket: [[0.44, 0.9, 0.44, 0xe8384a, 0, 0, 0], [0.46, 0.12, 0.46, WHITE, 0, 0.2, 0], [0.46, 0.12, 0.46, WHITE, 0, -0.16, 0], [0.3, 0.24, 0.3, 0x3ac8e8, 0, 0.56, 0], [0.14, 0.14, 0.14, 0x3ac8e8, 0, 0.72, 0],
    [0.18, 0.18, 0.06, 0xbfe8ff, 0, 0.12, 0.23], [0.16, 0.28, 0.12, 0xffd23a, 0.3, -0.36, 0], [0.16, 0.28, 0.12, 0xffd23a, -0.3, -0.36, 0], [0.24, 0.16, 0.24, 0xff8a1a, 0, -0.52, 0], [0.12, 0.14, 0.12, 0xffd23a, 0, -0.64, 0]],
};
// The balloons that hold the rope (origin = the rope's top), the party stick (origin = your hand, pointing along -z).
export const balloonBoxes = () => [[0.7, 0.8, 0.7, 0xff6a8a, -0.35, 0.75, 0], [0.7, 0.8, 0.7, 0x3ac8e8, 0.35, 0.8, 0.1], [0.66, 0.76, 0.66, 0xffd23a, 0, 1.25, -0.1], [0.04, 0.5, 0.04, WHITE, 0, 0.2, 0]];
export const stickBoxes = () => { const out = []; for (let i = 0; i < 6; i++) out.push([0.07, 0.07, 0.22, i % 2 ? 0xff6a8a : 0xfff0d0, 0, 0, -0.11 - i * 0.22]); out.push([0.14, 0.14, 0.14, GOLD, 0, 0, -1.38]); return out; };
// The silly surprise that falls out of a piñata with the candy.
export const SILLY_BOXES = {
  duck: [[0.7, 0.45, 0.8, 0xffd23a, 0, 0.3, 0], [0.5, 0.45, 0.5, 0xffd23a, 0, 0.75, 0.2], [0.3, 0.12, 0.3, 0xff8a1a, 0, 0.7, 0.55], [0.1, 0.1, 0.1, INK, -0.14, 0.85, 0.42], [0.1, 0.1, 0.1, INK, 0.14, 0.85, 0.42]],
  bubbles: [[0.5, 0.5, 0.5, 0xbfe8ff, -0.5, 0.5, 0], [0.4, 0.4, 0.4, 0xdff4ff, 0.4, 1.0, 0.1], [0.55, 0.55, 0.55, 0xbfe8ff, 0.1, 1.7, 0], [0.3, 0.3, 0.3, 0xdff4ff, -0.3, 1.3, 0.2], [0.3, 0.3, 0.3, 0xbfe8ff, 0.6, 0.3, 0.3]],
  sock: [[0.2, 0.2, 0.2, 0x9094a2, 0, 0.1, 0], [0.2, 0.2, 0.2, 0xc8ccd8, 0, 0.35, 0], [0.2, 0.2, 0.2, 0x9094a2, 0, 0.6, 0], [0.5, 0.9, 0.5, 0xff6a8a, 0, 1.2, 0], [0.5, 0.2, 0.5, 0xffffff, 0, 1.4, 0], [0.7, 0.28, 0.5, 0xff6a8a, 0.3, 0.9, 0]],
  cloud: [[1.1, 0.5, 0.7, WHITE, 0, 0.6, 0], [0.7, 0.5, 0.6, WHITE, -0.5, 0.9, 0], [0.7, 0.55, 0.6, WHITE, 0.45, 1.0, 0], [0.5, 0.4, 0.5, 0xdff4ff, 0, 1.25, 0]],
};
// A present for Gift Stack: a unit box (1 x 1 x 1, scaled per present) with a ribbon cross and a little bow; white parts take the instance colour.
export const presentBoxes = () => [[1, 1, 1, WHITE, 0, 0, 0], [1.02, 1.02, 0.16, 0xfff4c0, 0, 0, 0], [0.16, 1.02, 1.02, 0xfff4c0, 0, 0, 0], [0.18, 0.14, 0.32, GOLD, -0.1, 0.56, 0], [0.18, 0.14, 0.32, GOLD, 0.1, 0.56, 0]];

/* ---------------------------------------- the Party Spinner ---------------------------------------- */

const SLICE_COLOURS = ['#ff8ab0', '#6ac8ff', '#ffd23a', '#7ae07a'];
// One slice's picture (cx, cy = the middle of the picture, s = its size). A piñata, a jack-in-the-box, a stack of presents, a pop-up box.
function drawPicture(x, game, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.scale(s / 100, s / 100); x.lineWidth = 4; x.strokeStyle = '#3a2a3a'; x.lineJoin = 'round';
  const rect = (rx, ry, w, h, fill) => { x.fillStyle = fill; x.fillRect(rx, ry, w, h); x.strokeRect(rx, ry, w, h); };
  if (game === 'pinata') { // a llama piñata: a striped body, a neck, a head with ears, four legs
    rect(-40, -6, 62, 30, '#ff6a8a'); x.fillStyle = '#ffd23a'; x.fillRect(-40, 2, 62, 6); x.fillStyle = '#3ac8e8'; x.fillRect(-40, 12, 62, 6); x.strokeRect(-40, -6, 62, 30);
    rect(12, -38, 14, 34, '#ff6a8a'); rect(8, -50, 28, 16, '#ffd23a'); rect(14, -58, 5, 9, '#ff6a8a'); rect(24, -58, 5, 9, '#ff6a8a');
    for (const lx of [-36, -24, 2, 14]) rect(lx, 24, 7, 20, lx < 0 ? '#6ae86a' : '#b05ae8');
    x.fillStyle = '#16121a'; x.fillRect(28, -45, 4, 4);
    x.beginPath(); x.moveTo(-10, -6); x.lineTo(-10, -60); x.stroke();
  } else if (game === 'catch') { // a jack-in-the-box: a box, a zigzag spring, a grinning head with a cap
    rect(-34, 10, 68, 44, '#3a8ce8'); x.fillStyle = '#ffd23a'; x.fillRect(-34, 28, 68, 7); x.strokeRect(-34, 10, 68, 44);
    x.beginPath(); x.moveTo(0, 10); for (let k = 1; k <= 5; k++) x.lineTo(k % 2 ? -12 : 12, 10 - k * 6); x.lineTo(0, -24); x.stroke();
    x.fillStyle = '#fff0d8'; x.beginPath(); x.arc(0, -38, 16, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#e8384a'; x.beginPath(); x.moveTo(-16, -48); x.lineTo(16, -48); x.lineTo(0, -70); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#ff4a6a'; x.beginPath(); x.arc(0, -36, 4, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#16121a'; x.fillRect(-8, -44, 4, 4); x.fillRect(4, -44, 4, 4); x.beginPath(); x.arc(0, -32, 7, 0.2, Math.PI - 0.2); x.stroke();
  } else if (game === 'stack') { // a stack of three presents, smaller to the top, a crane hook above
    const box = (w, y, fill) => { rect(-w / 2, y, w, 22, fill); x.fillStyle = '#fff4c0'; x.fillRect(-4, y, 8, 22); };
    box(70, 32, '#e8384a'); box(52, 10, '#3ac8e8'); box(36, -12, '#7ae07a');
    x.beginPath(); x.moveTo(0, -60); x.lineTo(0, -26); x.stroke(); x.beginPath(); x.arc(0, -20, 6, Math.PI, Math.PI * 2.6); x.stroke();
    rect(-40, -66, 80, 6, '#ffd23a');
  } else { // a pop-up box: an open lid, a jack peeking out, a party hammer
    rect(-30, 6, 60, 44, '#e8384a'); x.fillStyle = '#fff4a0'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.fillText('?', 0, 38);
    x.save(); x.translate(-30, 6); x.rotate(-0.7); rect(0, -8, 60, 8, '#ff6a8a'); x.restore();
    x.fillStyle = '#fff0d8'; x.beginPath(); x.arc(4, -6, 14, Math.PI, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#16121a'; x.fillRect(-2, -12, 3, 3); x.fillRect(8, -12, 3, 3);
    x.save(); x.translate(38, -20); x.rotate(0.5); rect(-4, 0, 8, 40, '#b07a3a'); rect(-16, -14, 32, 16, '#ffd23a'); x.restore();
  }
  x.restore();
}
// The plate's face on a canvas: four slices (slice k from k x 90 degrees clockwise from the top), each with its picture; a won slice
// gets a golden bow and a paler colour.
export function drawSpinnerFace(canvas, won = []) {
  const x = canvas.getContext('2d'), S = canvas.width, c = S / 2, R = S / 2 - 6;
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#fff8ee'; x.beginPath(); x.arc(c, c, R + 4, 0, Math.PI * 2); x.fill();
  GAMES.forEach((g, k) => {
    const a0 = -Math.PI / 2 + (k * Math.PI) / 2, a1 = a0 + Math.PI / 2, mid = (a0 + a1) / 2;
    x.fillStyle = SLICE_COLOURS[k]; x.globalAlpha = won[k] ? 0.45 : 1;
    x.beginPath(); x.moveTo(c, c); x.arc(c, c, R, a0, a1); x.closePath(); x.fill(); x.globalAlpha = 1;
    x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.stroke();
    drawPicture(x, g, c + Math.cos(mid) * R * 0.55, c + Math.sin(mid) * R * 0.55, R * 0.62);
    if (won[k]) { // a golden bow on a won slice
      const bx = c + Math.cos(mid) * R * 0.86, by = c + Math.sin(mid) * R * 0.86;
      x.fillStyle = '#ffd23a'; x.strokeStyle = '#a8780a'; x.lineWidth = 3;
      for (const sx of [-1, 1]) { x.beginPath(); x.ellipse(bx + sx * 14, by, 14, 9, 0, 0, Math.PI * 2); x.fill(); x.stroke(); }
      x.beginPath(); x.arc(bx, by, 7, 0, Math.PI * 2); x.fill(); x.stroke();
    }
  });
  x.fillStyle = '#ffd23a'; x.strokeStyle = '#a8780a'; x.lineWidth = 5; x.beginPath(); x.arc(c, c, R * 0.12, 0, Math.PI * 2); x.fill(); x.stroke();
  x.strokeStyle = '#e8384a'; x.lineWidth = 10; x.beginPath(); x.arc(c, c, R + 1, 0, Math.PI * 2); x.stroke();
}
// The Spinner: a plate facing -x (into the room), `wheel` turns (rotation.z = -angle: clockwise as you look at it), a gold arrow at the top,
// little lights round the rim. `userData.redraw(won)` repaints the face.
export function buildSpinner(r = 2.6) {
  const group = new THREE.Group(), face = new THREE.Group();
  face.rotation.y = -Math.PI / 2;
  group.add(face);
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let tex = null;
  if (canvas) { canvas.width = canvas.height = 512; drawSpinnerFace(canvas, []); tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; }
  const wheel = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshLambertMaterial({ map: tex, color: tex ? 0xffffff : 0xff8ab0 }));
  wheel.position.z = 0.12;
  face.add(wheel);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.14, 40).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe8384a }));
  face.add(back);
  const arrow = new THREE.Mesh(merged([[0.5, 0.7, 0.2, GOLD, 0, 0.1, 0], [0.26, 0.3, 0.22, 0xe8a81a, 0, -0.32, 0]]), lambert());
  arrow.position.set(0, r + 0.25, 0.3);
  face.add(arrow);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 4).rotateZ(Math.PI), new THREE.MeshLambertMaterial({ color: GOLD }));
  tip.position.set(0, r - 0.05, 0.3); face.add(tip);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 20);
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; _o.position.set(Math.cos(a) * (r + 0.12), Math.sin(a) * (r + 0.12), 0.16); _o.updateMatrix(); bulbs.setMatrixAt(i, _o.matrix); bulbs.setColorAt(i, _c.setHex(i % 2 ? 0xffd23a : 0xffffff)); }
  face.add(bulbs);
  finish(group, { wheel, arrow, bulbs, face });
  group.userData.redraw = won => { if (!canvas) return; drawSpinnerFace(canvas, won); tex.needsUpdate = true; };
  group.userData.setAngle = a => { wheel.rotation.z = -a; };
  return group;
}

/* ---------------------------------------- Gift Stack: the toy crane ---------------------------------------- */

// A yellow toy crane: a post at the origin, an arm along -x to over the table (`reach`), a red trolley that slides along it and a cable
// with a hook. parts.trolley.position.x moves it; parts.cable.scale.y = cable length (from the arm down).
export function buildCrane({ reach = 8, top = 9 } = {}) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(merged([
    [0.7, top, 0.7, 0xffd23a, 0, top / 2, 0], [0.9, 0.3, 0.9, 0xe8a81a, 0, 0.15, 0], [1.4, 0.3, 1.4, 0x8a8a96, 0, 0.05, 0],
    [reach + 1.6, 0.4, 0.5, 0xffd23a, -reach / 2 + 0.4, top + 0.2, 0], [1.2, 0.8, 0.9, 0x3a8ce8, 0.9, top + 0.1, 0], [0.5, 0.5, 0.5, 0xe8384a, 1.4, top + 0.3, 0],
    [0.12, 1.4, 0.12, 0x8a8a96, 0, top + 1, 0], [reach * 0.55, 0.06, 0.06, 0x8a8a96, -reach * 0.27, top + 1.1, 0],
  ]), lambert());
  group.add(frame);
  const trolley = new THREE.Group();
  trolley.add(new THREE.Mesh(merged([[0.7, 0.3, 0.7, 0xe8384a, 0, top - 0.15, 0]]), lambert()));
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.05).translate(0, -0.5, 0), new THREE.MeshLambertMaterial({ color: 0x3a3a46 }));
  cable.position.y = top - 0.3; trolley.add(cable);
  const hook = new THREE.Mesh(merged([[0.4, 0.1, 0.1, 0x8a8a96, 0, 0, 0], [0.1, 0.25, 0.1, 0x8a8a96, -0.15, -0.12, 0], [0.1, 0.25, 0.1, 0x8a8a96, 0.15, -0.12, 0]]), lambert());
  trolley.add(hook);
  group.add(trolley);
  return finish(group, { frame, trolley, cable, hook, top });
}

/* ---------------------------------------- the room: bunting, balloons, cups and plates ---------------------------------------- */

// Bunting: strings of triangle flags between pairs of points ([[x, y, z], [x, y, z]]), sagging in the middle. One mesh.
export function buildBunting(lines) {
  const pos = [], col = [], cols = [0xff6a8a, 0xffd23a, 0x3ac8e8, 0x6ae86a, 0xb05ae8, 0xff8a1a];
  let k = 0;
  for (const [a, b] of lines) {
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(2, Math.floor(len / 0.9));
    const at = s => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s - Math.sin(Math.PI * s) * Math.min(2.2, len * 0.08), a[2] + (b[2] - a[2]) * s];
    for (let i = 0; i < n; i++) {
      const p = at((i + 0.15) / n), q = at((i + 0.85) / n), m = at((i + 0.5) / n);
      const tri = [p, q, [m[0], m[1] - 0.7, m[2]]];
      _c.setHex(cols[k++ % cols.length]);
      for (const v of [...tri, tri[0], tri[2], tri[1]]) { pos.push(...v); col.push(_c.r, _c.g, _c.b); } // both sides
    }
    _c.setHex(0xfff0d0);
    for (let i = 0; i < 24; i++) { const p = at(i / 24), q = at((i + 1) / 24); for (const v of [p, q, [q[0], q[1] - 0.05, q[2]], p, [q[0], q[1] - 0.05, q[2]], [p[0], p[1] - 0.05, p[2]]]) { pos.push(...v); col.push(_c.r, _c.g, _c.b); } }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const group = new THREE.Group(); group.add(mesh);
  return finish(group, { mesh });
}
// Balloon bunches (three round balloons on strings) at spots [x, y, z] (the knot on the floor or a table); parts.bunches bobs them.
export function buildBalloons(spots) {
  const geo = (() => {
    const cols = [0xff6a8a, 0x3ac8e8, 0xffd23a];
    const pos = [], nor = [], col = [];
    const add = (g, hex) => { const p = g.attributes.position, n = g.attributes.normal; _c.setHex(hex); for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(_c.r, _c.g, _c.b); } g.dispose(); };
    [[-0.35, 3.1, 0], [0.35, 3.25, 0.15], [0, 3.6, -0.2]].forEach(([x, y, z], i) => add(new THREE.SphereGeometry(0.42, 12, 9).scale(1, 1.15, 1).translate(x, y, z).toNonIndexed(), cols[i]));
    for (const [x, y, z] of [[-0.35, 3.1, 0], [0.35, 3.25, 0.15], [0, 3.6, -0.2]]) { const g = new THREE.CylinderGeometry(0.015, 0.015, y, 4).translate(x / 2, y / 2 - 0.2, z / 2).toNonIndexed(); add(g, 0xffffff); }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  })();
  const bunches = new THREE.InstancedMesh(geo, lambert(), spots.length);
  bunches.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bunches.frustumCulled = false;
  const group = new THREE.Group(); group.add(bunches);
  const place = t => spots.forEach(([x, y, z], i) => { _o.position.set(x, y + Math.sin(t * 1.3 + i) * 0.12, z); _o.rotation.set(Math.sin(t * 0.9 + i) * 0.06, i * 1.7, Math.cos(t * 1.1 + i) * 0.06); _o.updateMatrix(); bunches.setMatrixAt(i, _o.matrix); });
  place(0);
  group.userData.update = t => { place(t); bunches.instanceMatrix.needsUpdate = true; };
  return finish(group, { bunches });
}
// Cups, plates and party hats down the long table (its top at y; x0..x1 across, z0..z1 along). One mesh.
export function buildTableware({ x0, x1, z0, z1, y }) {
  const boxes = [], cols = [0xff6a8a, 0x3ac8e8, 0xffd23a, 0x6ae86a, 0xb05ae8];
  const midX = (x0 + x1 + 1) / 2;
  for (let z = z0 + 1, i = 0; z <= z1 - 1; z += 2, i++) for (const side of [-1, 1]) {
    const px = midX + side * 0.9, pz = z + 0.5, c = cols[(i + (side > 0 ? 2 : 0)) % cols.length];
    boxes.push([0.62, 0.05, 0.62, 0xffffff, px, y + 0.03, pz], [0.4, 0.04, 0.4, c, px, y + 0.07, pz]);            // a plate with a party napkin
    boxes.push([0.18, 0.28, 0.18, c, px + side * -0.45, y + 0.14, pz + 0.3], [0.2, 0.04, 0.2, 0xffffff, px + side * -0.45, y + 0.3, pz + 0.3]); // a cup
    if ((i + (side > 0 ? 1 : 0)) % 3 === 0) boxes.push([0.3, 0.2, 0.3, cols[(i + 3) % cols.length], px, y + 0.19, pz], [0.18, 0.16, 0.18, cols[(i + 3) % cols.length], px, y + 0.37, pz], [0.08, 0.08, 0.08, 0xffffff, px, y + 0.49, pz]); // a party hat on the plate
  }
  for (let z = z0 + 3; z < z1 - 1; z += 6) boxes.push([0.9, 0.4, 0.9, 0xfff0d0, midX, y + 0.2, z + 0.5], [0.94, 0.08, 0.94, 0xff8ab0, midX, y + 0.38, z + 0.5], [0.08, 0.2, 0.08, 0xff3a3a, midX, y + 0.5, z + 0.5]); // little cakes
  const mesh = new THREE.Mesh(merged(boxes), lambert());
  const group = new THREE.Group(); group.add(mesh);
  return finish(group, { mesh });
}
// The cake's frosting: blobs of cream along every tier's top edge and a "SURPRISE" ring of sprinkles (one mesh). tiers = CAKE.tiers.
export function buildCakeDeco({ x, z, tiers }) {
  const boxes = [], cols = [0xffd23a, 0x3ac8e8, 0x6ae86a, 0xffffff];
  tiers.forEach((t, k) => {
    const r = t.r + 0.5, top = t.y1 + 1;
    for (let i = 0; i < 8 * (t.r + 1); i++) {
      const a = (i / (8 * (t.r + 1))) * Math.PI * 2, s = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      boxes.push([0.3, 0.22, 0.3, 0xfff6ec, x + 0.5 + Math.cos(a) * r * s * 0.98, top + 0.05, z + 0.5 + Math.sin(a) * r * s * 0.98]);
      if (i % 2 === 0) boxes.push([0.1, 0.1, 0.1, cols[(i + k) % cols.length], x + 0.5 + Math.cos(a) * (r - 0.4) * s, top + 0.03, z + 0.5 + Math.sin(a) * (r - 0.4) * s]);
    }
  });
  const mesh = new THREE.Mesh(merged(boxes), lambert());
  const group = new THREE.Group(); group.add(mesh);
  return finish(group, { mesh });
}

/* ---------------------------------------- confetti ---------------------------------------- */

// Camera-facing confetti quads (one instanced mesh); burst(...) is drawn by the live part with confettiAt.
export function buildConfetti(n = 160) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
  mesh.frustumCulled = false; mesh.count = 0;
  const pal = [0xff6a8a, 0xffd23a, 0x3ac8e8, 0x6ae86a, 0xb05ae8, 0xffffff];
  for (let i = 0; i < n; i++) mesh.setColorAt(i, _c.setHex(pal[i % pal.length]));
  const group = new THREE.Group(); group.add(mesh);
  return finish(group, { mesh, n });
}
// Where confetto i of a burst { x, y, z, age, scale } is (closed form; it rests on the floor at `floor`).
export function confettiAt(b, i, floor = 11.05) {
  const vx = (rand01(i, 'vx') - 0.5) * 8 * b.scale, vz = (rand01(i, 'vz') - 0.5) * 8 * b.scale, vy = (3 + rand01(i, 'vy') * 6) * Math.sqrt(b.scale);
  const t = b.age * (0.6 + rand01(i, 'sp') * 0.5);
  const y = Math.max(floor, b.y + vy * t - 4.2 * t * t);
  return { x: b.x + vx * t * (1 - 0.15 * t) + Math.sin(b.age * 5 + i) * 0.15, y, z: b.z + vz * t * (1 - 0.15 * t) + Math.cos(b.age * 4 + i) * 0.15 };
}
