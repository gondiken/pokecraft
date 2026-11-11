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

// A wobbly closed loop round (cx, cy): the radius drifts by up to `amp` (a child's hand), never a perfect circle.
function wobblyLoop(x, cx, cy, r, r2, amp, rnd, turns = 1.06) {
  const n = 40, ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  x.beginPath();
  for (let i = 0; i <= n * turns; i++) {
    const a = i / n * Math.PI * 2, k = 1 + amp * (Math.sin(a * 2 + ph[0]) * 0.5 + Math.sin(a * 3 + ph[1]) * 0.3 + Math.sin(a * 5 + ph[2]) * 0.2);
    const px = cx + Math.cos(a) * r * k, py = cy + Math.sin(a) * r2 * k;
    if (i) x.lineTo(px, py); else x.moveTo(px, py);
  }
}
// A crayon line: drawn twice, a little apart, thinner at the ends (a stroke a child goes over again)
function crayonLine(x, pts, width, colour, rnd) {
  x.strokeStyle = colour; x.lineCap = 'round'; x.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    x.lineWidth = width * (pass ? 0.6 : 1); x.globalAlpha = pass ? 0.7 : 0.95;
    x.beginPath();
    pts.forEach(([px, py], i) => { const jx = (rnd() - 0.5) * width * 0.5, jy = (rnd() - 0.5) * width * 0.5; if (i) x.lineTo(px + jx, py + jy); else x.moveTo(px + jx, py + jy); });
    x.stroke();
  }
  x.globalAlpha = 1;
}

function sunTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), m = S / 2, r = rng(3);
  // rays: wobbly crayon strokes of uneven length, not evenly spaced, some bent
  for (let i = 0; i < 13; i++) {
    const a = (i + (r() - 0.5) * 0.45) / 13 * Math.PI * 2, r0 = 60 + r() * 6, r1 = 88 + r() * 34, bend = (r() - 0.5) * 0.25;
    const pts = [0, 0.33, 0.66, 1].map(t => { const rr = r0 + (r1 - r0) * t, aa = a + bend * Math.sin(t * Math.PI); return [m + Math.cos(aa) * rr, m + Math.sin(aa) * rr]; });
    crayonLine(x, pts, 8 + r() * 4, i % 3 ? '#ffc12a' : '#ff9d1c', r);
  }
  // the face: coloured in with crayon strokes that go over the line, then the outline drawn round once and a bit more
  x.save(); wobblyLoop(x, m, m, 58, 56, 0.06, r); x.clip();
  x.fillStyle = '#ffe26a'; x.fillRect(0, 0, S, S);
  x.restore();
  for (let i = 0; i < 18; i++) { const y = m - 60 + i * 7 + r() * 3; crayonLine(x, [[m - 60 + r() * 14, y], [m + 60 - r() * 10, y + 6 + r() * 4]], 5, 'rgba(255,196,30,0.75)', r); }
  wobblyLoop(x, m, m, 58, 56, 0.06, r, 1.12); x.strokeStyle = '#e8881a'; x.lineWidth = 5; x.stroke();
  // eyes (not the same size), a lopsided smile, cheeks
  x.fillStyle = '#4a3020';
  x.beginPath(); x.ellipse(m - 21, m - 13, 5.5, 7, 0.1, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(m + 19, m - 11, 6.5, 6, -0.2, 0, Math.PI * 2); x.fill();
  crayonLine(x, [[m - 26, m + 6], [m - 14, m + 20], [m + 2, m + 25], [m + 16, m + 19], [m + 27, m + 4]], 5, '#4a3020', r);
  x.fillStyle = 'rgba(255,120,120,0.5)'; x.beginPath(); x.ellipse(m - 35, m + 11, 10, 7, 0.3, 0, Math.PI * 2); x.ellipse(m + 34, m + 14, 9, 8, -0.2, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Clouds: lumpy, every one a bit different (seeded), the outline goes round the outside in a wobbly crayon line
function cloudTexture() {
  const W = 512, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = rng(11);
  for (let k = 0; k < 2; k++) { // two different clouds side by side in the texture (the quads pick one)
    const ox = k * 256, puffs = [];
    for (let i = 0; i < 6; i++) puffs.push([ox + 40 + i * 32 + (r() - 0.5) * 14, 70 + (r() - 0.5) * 26 - Math.sin(i / 5 * Math.PI) * 14, 22 + r() * 22]);
    x.fillStyle = '#7f9cc4'; // outline: every puff a little bigger, underneath
    for (const [px, py, pr] of puffs) { wobblyLoop(x, px, py, pr + 4, pr * 0.85 + 4, 0.12, r); x.fill(); }
    x.fillStyle = '#ffffff';
    for (const [px, py, pr] of puffs) { wobblyLoop(x, px, py, pr, pr * 0.85, 0.12, r); x.fill(); }
    x.globalAlpha = 0.35; // a few scribbles of blue shading under it
    for (let i = 0; i < 6; i++) crayonLine(x, [[ox + 50 + i * 28, 92 + r() * 6], [ox + 70 + i * 28, 86 + r() * 6]], 4, '#a8c4e8', r);
    x.globalAlpha = 1;
  }
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
    const u0 = (i % 2) * 0.5, u1 = u0 + 0.5; // (two different clouds in the texture)
    uv.set([u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1], i * 12);
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
