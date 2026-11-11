// Chapter 3 C3 (owner 2026-11-11, "more different than our regular world"): Wobbleland's sky, drawn by a child: a sky coloured in with
// streaky crayon (one dome that follows the camera), a big sun with rays and a smile, and flat cotton clouds hanging on strings from the
// top of the page. Only in Wobbleland (wobblelook.js adds it on reset and takes it away everywhere else); never a block, never saved.
// Every mesh carries userData.noCurl (the page's curl must not lift the sky) and fog: false. 4 draw calls: dome, sun, clouds, strings.
import * as THREE from 'three';

export const SKY = {
  r: 240,                     // the dome's radius (the camera's far plane is 300)
  page: '#fff3c4',            // the page colour at the horizon (= the realm's fog colour, realms.js look.sky)
  blue: ['#7cc4f2', '#5fb2ec', '#8fd0f6', '#6cbdf0'], // crayon blues
  sun: { yaw: 0.3, up: 0.27, size: 46 },             // where the sun hangs (yaw from north, how high) and how big
  clouds: [[-0.6, 0.30, 40], [0.2, 0.36, 34], [1.4, 0.26, 44], [2.3, 0.33, 36], [3.2, 0.28, 42], [4.3, 0.34, 32], [5.3, 0.27, 38]], // yaw, up, size
  drift: 0.012,               // the clouds swing on their strings (radians a second, a slow sway; never a fall)
};

// a seeded random (the same sky every time)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function domeTexture() {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = rng(7);
  x.fillStyle = SKY.page; x.fillRect(0, 0, W, H);
  // crayon strokes: long slanted strokes, thick, with gaps where the paper shows, thinning toward the horizon (v 0.5)
  x.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const v = Math.pow(r(), 1.4) * 0.5, y = v * H;
    const along = 1 - v / 0.5;
    if (r() > 0.35 + along * 0.65) continue;
    const x0 = r() * W, len = 30 + r() * 70, a = -0.35 + r() * 0.12;
    x.strokeStyle = SKY.blue[(r() * SKY.blue.length) | 0];
    x.globalAlpha = 0.35 + along * 0.5;
    x.lineWidth = 5 + r() * 7;
    x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + Math.cos(a) * len, y + Math.sin(a) * len); x.stroke();
    if (x0 + len > W) { x.beginPath(); x.moveTo(x0 - W, y); x.lineTo(x0 - W + Math.cos(a) * len, y + Math.sin(a) * len); x.stroke(); }
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}

function sunTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), m = S / 2, r = rng(3);
  x.lineCap = 'round'; x.lineJoin = 'round';
  // rays: wobbly crayon lines, some long, some short
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + (r() - 0.5) * 0.12, r0 = 62, r1 = 92 + (i % 2) * 22 + r() * 8;
    x.strokeStyle = i % 2 ? '#ffb020' : '#ffd23a'; x.lineWidth = 9;
    x.beginPath(); x.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0);
    x.quadraticCurveTo(m + Math.cos(a + 0.08) * (r0 + r1) / 2, m + Math.sin(a + 0.08) * (r0 + r1) / 2, m + Math.cos(a) * r1, m + Math.sin(a) * r1); x.stroke();
  }
  // the face: a round coloured in yellow (strokes over the line), a smile and two dots
  x.fillStyle = '#ffd84a'; x.beginPath(); x.arc(m, m, 58, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#ffc21a'; x.lineWidth = 6;
  for (let i = 0; i < 16; i++) { const y = m - 52 + i * 7; x.beginPath(); x.moveTo(m - 52 + r() * 8, y); x.lineTo(m + 52 - r() * 8, y + 4); x.stroke(); }
  x.strokeStyle = '#e8901a'; x.lineWidth = 5; x.beginPath(); x.arc(m, m, 58, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#4a3020'; x.beginPath(); x.arc(m - 20, m - 12, 6, 0, Math.PI * 2); x.arc(m + 20, m - 12, 6, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#4a3020'; x.lineWidth = 6; x.beginPath(); x.arc(m, m + 2, 26, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
  x.fillStyle = 'rgba(255,120,120,0.55)'; x.beginPath(); x.arc(m - 34, m + 12, 9, 0, Math.PI * 2); x.arc(m + 34, m + 12, 9, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function cloudTexture() {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), puffs = [[70, 78, 40], [118, 58, 48], [170, 74, 40], [205, 88, 26], [44, 92, 24], [128, 92, 36]];
  x.fillStyle = '#ffffff';
  for (const [px, py, pr] of puffs) { x.beginPath(); x.arc(px, py, pr, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = '#8aa6c8'; x.lineWidth = 4; // the outline of every puff, drawn round the outside only
  x.save(); x.globalCompositeOperation = 'destination-over';
  for (const [px, py, pr] of puffs) { x.beginPath(); x.arc(px, py, pr + 3, 0, Math.PI * 2); x.fillStyle = '#8aa6c8'; x.fill(); }
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const dirOf = (yaw, up) => new THREE.Vector3(-Math.sin(yaw) * Math.cos(up * Math.PI / 2), Math.sin(up * Math.PI / 2), -Math.cos(yaw) * Math.cos(up * Math.PI / 2));

export function createWobbleSky(scene) {
  if (typeof document === 'undefined') return { update() {}, dispose() {}, info: () => ({ on: false }) };
  const group = new THREE.Group(); group.name = 'wobble-sky'; group.userData.noCurl = true;
  const mk = (geo, mat, order) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; m.frustumCulled = false; m.userData.noCurl = true; group.add(m); return m; };
  const dome = mk(new THREE.SphereGeometry(SKY.r, 32, 16), new THREE.MeshBasicMaterial({ map: domeTexture(), side: THREE.BackSide, fog: false, depthWrite: false }), -10);
  const sunDir = dirOf(SKY.sun.yaw, SKY.sun.up);
  const sun = mk(new THREE.PlaneGeometry(SKY.sun.size, SKY.sun.size), new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, fog: false, depthWrite: false }), -9);
  // the clouds: one mesh of flat quads (each faces the middle), and their strings as one line set up to the top of the page
  const cloudTex = cloudTexture(), quads = [], strings = [];
  for (const [yaw, up, size] of SKY.clouds) {
    const d = dirOf(yaw, up), p = d.clone().multiplyScalar(SKY.r * 0.82), w = size, h = size / 2;
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(w / 2), upV = new THREE.Vector3(0, h / 2, 0);
    quads.push({ p, right, upV });
    strings.push(p.clone().add(new THREE.Vector3(0, h * 0.35, 0)), p.clone().add(new THREE.Vector3(0, SKY.r, 0)));
  }
  const pos = new Float32Array(quads.length * 18), uv = new Float32Array(quads.length * 12);
  quads.forEach((q, i) => {
    const a = q.p.clone().sub(q.right).sub(q.upV), b = q.p.clone().add(q.right).sub(q.upV), c = q.p.clone().add(q.right).add(q.upV), d = q.p.clone().sub(q.right).add(q.upV);
    [a, b, c, a, c, d].forEach((v, k) => pos.set([v.x, v.y, v.z], i * 18 + k * 3));
    uv.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], i * 12);
  });
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); cg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const clouds = mk(cg, new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, fog: false, depthWrite: false, side: THREE.DoubleSide }), -8);
  const sg = new THREE.BufferGeometry().setFromPoints(strings);
  const lines = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0x6a7a90, fog: false, depthWrite: false }));
  lines.renderOrder = -8; lines.frustumCulled = false; lines.userData.noCurl = true; group.add(lines);
  scene.add(group);
  let t = 0;
  return {
    group,
    update(dt, camera) {
      t += dt;
      group.position.copy(camera.position);
      sun.position.copy(sunDir).multiplyScalar(SKY.r * 0.9);
      group.updateMatrixWorld(); sun.lookAt(camera.position); // (lookAt takes a world place: the group's middle is the camera)
      sun.rotateZ(Math.sin(t * 0.4) * 0.06); // (it nods a little)
      const sway = Math.sin(t * 0.5) * SKY.drift * 20;
      clouds.rotation.y = sway; lines.rotation.y = sway;
    },
    dispose() {
      scene.remove(group);
      group.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
    },
    info() { return { on: true, calls: group.children.length }; },
  };
}
