// The Bubble Well's models (THREE only; never world blocks, never saved or sent): the soap bubbles (one rainbow soap-film shader, instanced),
// the ghost bubble that shows where your next bubble appears, the wand in your hand, drips and their shadows, little rising bubble streams
// (the side wind, the gusts, the current, the fizz lifts), the soap flowers, the garden's thorny coral and the nest, the chimney's spike plates, fan, bar
// and fizz stars, the golden ride bubble and its sign, the Puff! arrow, the bank shot's cushions, gold pads and aim dots, and Captain Suds' three shield bubbles. Each builder returns a Group with userData.parts and
// userData.dispose(). The bubble spec's screenshots (tests/screenshots/bubble-*.png) show them for the owner.
import * as THREE from 'three';

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const disposer = g => () => g.traverse(o => { if (o.isMesh || o.isInstancedMesh || o.isPoints) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export const hideAll = m => { for (let i = 0; i < m.count; i++) m.setMatrixAt(i, ZERO); m.instanceMatrix.needsUpdate = true; };
const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; hideAll(m); return m; };

// The soap film: white in the middle, rainbow at the edges (fresnel), a bright shine; it slowly shifts colour (uTime).
const VERT = `
varying vec3 vN; varying vec3 vV; varying float vH;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
  #endif
  vec4 mv = modelViewMatrix * p;
  vN = normalize(normalMatrix * n); vV = normalize(-mv.xyz); vH = position.y;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform float uTime; uniform float uAlpha;
varying vec3 vN; varying vec3 vV; varying float vH;
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float f = 1.0 - abs(dot(n, v));
  vec3 col = mix(vec3(0.92, 0.97, 1.0), hue(f * 1.4 + vH * 0.6 + uTime * 0.12), 0.6 * f + 0.15);
  float spec = pow(max(0.0, dot(reflect(-v, n), normalize(vec3(-0.4, 0.8, 0.45)))), 30.0);
  gl_FragColor = vec4(col + spec, clamp((0.1 + 0.8 * f * f + spec) * uAlpha, 0.0, 1.0));
}`;
export function soapMaterial(alpha = 1) {
  return new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uAlpha: { value: alpha } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
}

// n soap bubbles (radius 1: scale each instance to its radius) with a white shine dot each.
export function buildBubbles(n = 4) {
  const g = new THREE.Group();
  const film = inst(new THREE.SphereGeometry(1, 20, 14), soapMaterial(1), n);
  const sg = new THREE.SphereGeometry(0.16, 8, 6); sg.translate(-0.42, 0.5, 0.42);
  const shine = inst(sg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }), n);
  film.renderOrder = 2; shine.renderOrder = 3;
  g.add(film, shine);
  g.userData.parts = { film, shine, n };
  g.userData.dispose = disposer(g);
  return g;
}

// The bubble wand in your hand: a gold stick with a rainbow ring (held at the bottom right of the view).
export function buildWand() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 6), lam(0xf0c84a, { emissive: 0x302000 }));
  stick.position.y = -0.21;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 6, 18), lam(0xff9ac8, { emissive: 0x402030 }));
  ring.position.y = 0.06;
  // the soap film (only while the wand is wet): a shimmering pale disc with a bright shine, so it reads face on (the fresnel film of
  // the bubbles is nearly clear face on)
  const film = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), new THREE.MeshBasicMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  film.position.y = 0.06;
  const glint = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
  glint.position.set(-0.03, 0.035, 0.002); film.add(glint);
  const sheen = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.08, 18), new THREE.MeshBasicMaterial({ color: 0xff9ae0, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  sheen.position.z = 0.001; film.add(sheen);
  g.add(stick, ring, film);
  g.traverse(o => { if (o.isMesh) o.renderOrder = o.parent === g ? 10 : 11; });
  g.userData.parts = { stick, ring, film };
  g.userData.dispose = disposer(g);
  return g;
}

// Drips (little blue drops) and their dark shadows on the ledge below.
export function buildDrips(n) {
  const g = new THREE.Group();
  const dg = new THREE.SphereGeometry(0.13, 8, 6); dg.scale(1, 1.5, 1);
  const drops = inst(dg, lam(0x6ac8ff, { emissive: 0x103050 }), n);
  const cg = new THREE.CircleGeometry(0.45, 16); cg.rotateX(-Math.PI / 2);
  const shadows = inst(cg, new THREE.MeshBasicMaterial({ color: 0x203050, transparent: true, opacity: 0.35, depthWrite: false }), n);
  g.add(drops, shadows);
  g.userData.parts = { drops, shadows, n };
  g.userData.dispose = disposer(g);
  return g;
}

// Little bubbles that rise or flow inside boxes: boxes = [{ x0, x1, y0, y1, z0, z1, vx, vy, vz, n, colour }] (closed form of a clock).
export function buildStreams(boxes, size = 0.07) {
  const g = new THREE.Group(), total = boxes.reduce((a, b) => a + (b.n || 20), 0);
  const dots = inst(new THREE.SphereGeometry(size, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), Math.max(1, total));
  dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, total) * 3), 3);
  let i = 0;
  const col = new THREE.Color();
  for (const b of boxes) for (let k = 0; k < (b.n || 20); k++) dots.setColorAt(i++, col.setHex(b.colour ?? [0xffffff, 0xbfefff, 0xffc8ec][k % 3]));
  g.add(dots);
  g.userData.parts = { dots, boxes };
  g.userData.dispose = disposer(g);
  return g;
}
// Places the stream's dots at clock t (on: a list of booleans, one per box: a box that is off shows nothing).
export function drawStreams(g, t, on = null) {
  const { dots, boxes } = g.userData.parts, M = new THREE.Matrix4();
  let i = 0;
  boxes.forEach((b, j) => {
    const n = b.n || 20, show = !on || on[j];
    const sx = b.x1 + 1 - b.x0, sy = b.y1 + 1 - b.y0, sz = b.z1 + 1 - b.z0;
    for (let k = 0; k < n; k++) {
      if (!show) { dots.setMatrixAt(i++, ZERO); continue; }
      const h1 = ((k * 0.618) % 1), h2 = ((k * 0.377 + 0.13) % 1), h3 = ((k * 0.291 + 0.71) % 1);
      // each dot moves along the box's flow and wraps round inside it
      const len = Math.max(0.5, Math.hypot(b.vx || 0, b.vy || 0, b.vz || 0)), period = (b.vy ? sy : b.vx ? sx : sz) / len;
      const u = ((t / period + h3) % 1);
      const x = b.x0 + (b.vx ? (b.vx > 0 ? u : 1 - u) * sx : h1 * sx);
      const y = b.y0 + (b.vy ? (b.vy > 0 ? u : 1 - u) * sy : h2 * sy);
      const z = b.z0 + (b.vz ? (b.vz > 0 ? u : 1 - u) * sz : (b.vx ? h2 : h1) * sz);
      M.makeTranslation(x + Math.sin(t * 3 + k) * 0.05, y, z + Math.cos(t * 2.6 + k) * 0.05);
      dots.setMatrixAt(i++, M);
    }
  });
  dots.instanceMatrix.needsUpdate = true;
}

// The garden's thorny coral: three pink spikes in a little clump per thorn (instanced). y = the floor's top.
export function buildThorns(list, y) {
  const g = new THREE.Group(), n = list.length * 3, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  const cg = new THREE.ConeGeometry(0.12, 0.9, 5); cg.translate(0, 0.45, 0);
  const spikes = new THREE.InstancedMesh(cg, lam(0xff6aa0, { emissive: 0x401020 }), n);
  const bases = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 8, 6), lam(0xd84a80), list.length);
  list.forEach(([x, z], i) => {
    bases.setMatrixAt(i, M.makeTranslation(x, y + 0.1, z));
    for (let k = 0; k < 3; k++) { E.set(0.3 * Math.cos(k * 2.1 + i), 0, 0.3 * Math.sin(k * 2.1 + i)); Q.setFromEuler(E); P.set(x + Math.cos(k * 2.1) * 0.12, y, z + Math.sin(k * 2.1) * 0.12); spikes.setMatrixAt(i * 3 + k, M.compose(P, Q, S)); }
  });
  for (const m of [spikes, bases]) { m.frustumCulled = false; g.add(m); }
  g.userData.parts = { spikes, bases };
  g.userData.dispose = disposer(g);
  return g;
}

// The ducklings' nest: a woven straw ring with a soft lining.
export function buildNest(nest, y) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(nest.r, 0.22, 6, 20), lam(0xd8b46a));
  ring.rotation.x = Math.PI / 2; ring.position.set(nest.x, y + 0.2, nest.z);
  const lining = new THREE.Mesh(new THREE.CircleGeometry(nest.r, 20), lam(0xfff2e0));
  lining.rotation.x = -Math.PI / 2; lining.position.set(nest.x, y + 0.03, nest.z);
  g.add(ring, lining);
  g.userData.parts = { ring, lining };
  g.userData.dispose = disposer(g);
  return g;
}

// The chimney's spike plates (a disc with one round gap, spikes up and down on it), the fan, the spinning bar and the fizz stars.
// chim from bubbleland.js; gapR = the gap's radius drawn (the kind help widens it).
export function buildChimney(chim, gapOf) {
  const g = new THREE.Group(), plates = [];
  for (const p of chim.plates) {
    const gp = gapOf(chim, p), shape = new THREE.Shape(), hole = new THREE.Path();
    shape.absarc(0, 0, chim.r, 0, Math.PI * 2, false);
    hole.absarc(gp.x - chim.x, -(gp.z - chim.z), 1.35, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(geo, lam(0x9a6ad8, { emissive: 0x201030 }));
    disc.position.set(0, p.y, 0);
    // spikes: up and down, on a ring of spots that keep out of the gap
    const spots = [];
    for (let rr = 0.8; rr < chim.r - 0.2; rr += 0.9) for (let a = 0; a < Math.PI * 2; a += 0.9 / rr) { const x = chim.x + Math.cos(a) * rr, z = chim.z + Math.sin(a) * rr; if (Math.hypot(x - gp.x, z - gp.z) > 1.6) spots.push([x, z]); }
    const cg = new THREE.ConeGeometry(0.12, 0.45, 5);
    const spikes = new THREE.InstancedMesh(cg, lam(0xf0f0f8, { emissive: 0x202028 }), spots.length * 2);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
    spots.forEach(([x, z], i) => {
      spikes.setMatrixAt(i * 2, M.compose(new THREE.Vector3(x, p.y + 0.52, z), Q.identity(), S));
      spikes.setMatrixAt(i * 2 + 1, M.compose(new THREE.Vector3(x, p.y - 0.22, z), Q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI), S));
    });
    spikes.frustumCulled = false; spikes.position.set(-chim.x, 0, -chim.z);
    // the gold ring round the gap (rework 2026-10-29: fat and bright, so "fly through the gold rings" reads at a glance), a soft halo and a
    // beam of light under it (the live part shows the beam and pulses the ring only for the next ring)
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.16, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
    glowRing.rotation.x = Math.PI / 2; glowRing.position.set(gp.x, p.y + 0.36, gp.z);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.42, 6, 32), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.rotation.x = Math.PI / 2; halo.position.copy(glowRing.position); halo.renderOrder = 5;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.set(gp.x, p.y - 1.6, gp.z); beam.renderOrder = 5; beam.visible = false;
    for (const o of [glowRing, halo, beam]) { o.position.x -= chim.x; o.position.z -= chim.z; }
    // (redesign 2026-10-29: each plate is a group round the chimney's middle, so a turning plate turns as one: rotation.y = -spin x t)
    const pg = new THREE.Group(); pg.position.set(chim.x, 0, chim.z);
    pg.add(disc, spikes, glowRing, halo, beam);
    g.add(pg);
    plates.push({ g: pg, disc, spikes, glowRing, halo, beam, spin: p.spin || 0 });
  }
  // the fans: four blades on a hub on the wall, turning (redesign 2026-10-29: two of them)
  const fans = (chim.fans || [chim.fan]).map(f => {
    const fan = new THREE.Group(), side = Math.atan2(f.vz, f.vx);
    fan.position.set(chim.x - Math.cos(side) * (chim.r - 0.25), (f.y0 + f.y1) / 2, chim.z - Math.sin(side) * (chim.r - 0.25));
    fan.rotation.y = -side + Math.PI / 2;
    const blades = new THREE.Group();
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.85, 0.05), lam(0x8ad8ff)); b.position.y = 0.45; const h = new THREE.Group(); h.rotation.z = k * Math.PI / 2; h.add(b); blades.add(h); }
    blades.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), lam(0xf0c84a)));
    fan.add(blades);
    g.add(fan);
    return blades;
  });
  // the spinning arm: a striped arm from the middle to the wall (like a clock hand) with soft spikes
  const bar = new THREE.Group();
  bar.position.set(chim.x, chim.bar.y + 0.2, chim.z);
  const beam = new THREE.Mesh((() => { const b = new THREE.BoxGeometry(chim.r, 0.4, 0.5); b.translate(chim.r / 2, 0, 0); return b; })(), lam(0xff7aa8, { emissive: 0x301020 }));
  bar.add(beam);
  for (let k = 1; k <= 6; k++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 5), lam(0xffffff)); s.position.set(k * 0.6, 0.36, 0); bar.add(s); const d = s.clone(); d.position.y = -0.36; d.rotation.x = Math.PI; bar.add(d); }
  bar.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 10), lam(0xf0c84a)));
  g.add(bar);
  // fizz stars: flat gold stars that turn
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.16 : 0.38; if (i) starShape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else starShape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const sg = new THREE.ExtrudeGeometry(starShape, { depth: 0.08, bevelEnabled: false });
  const stars = chim.stars.map(s => { const m = new THREE.Mesh(sg.clone(), new THREE.MeshBasicMaterial({ color: 0xffd23a })); m.position.set(s.x, s.y, s.z); g.add(m); return m; });
  sg.dispose();
  g.userData.parts = { plates, fan: fans[0], fans, bar, stars };
  g.userData.dispose = disposer(g);
  return g;
}

// One big bubble (the ride bubble, a duckling's bubble or a shield): radius r.
export function buildBigBubble(r = 1, alpha = 1) {
  const g = new THREE.Group();
  const film = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), soapMaterial(alpha));
  film.renderOrder = 2;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
  shine.position.set(-r * 0.42, r * 0.52, r * 0.42); shine.renderOrder = 3;
  g.add(film, shine);
  g.userData.parts = { film, shine };
  g.userData.dispose = disposer(g);
  return g;
}

// Captain Suds' three shield bubbles (redesign 2026-10-29: each bobs on its own over the rim; the live part places them), each with a
// slowly turning ring of sparkles and a little gold star on top (where a stomp pops it).
export function buildShields(list0) {
  const g = new THREE.Group(), list = [];
  list0.forEach((sh, i) => {
    const r = sh.r, s = buildBigBubble(r, 0.85);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 4, 32), new THREE.MeshBasicMaterial({ color: [0xbfefff, 0xffc8ec, 0xfff2a8][i % 3], transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2 - 0.3 * i;
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
    cap.position.y = r + 0.12;
    s.add(ring, cap);
    g.add(s); list.push({ g: s, ring, cap, r });
  });
  g.userData.parts = { list };
  g.userData.dispose = disposer(g);
  return g;
}

// The soap pots (redesign 2026-10-29: a real wand must be dipped): a round lilac tub, a heap of white foam with a few bubbles on it and a
// wand leaning in it. list = [[x, y, z]] (feet height: the pot stands on that floor). One merged look per pot (a handful of meshes).
export function buildPots(list) {
  const g = new THREE.Group(), pots = [];
  const tubG = new THREE.CylinderGeometry(0.42, 0.34, 0.5, 18), rimG = new THREE.TorusGeometry(0.42, 0.06, 6, 20), foamG = new THREE.SphereGeometry(0.4, 14, 8);
  const tubM = lam(0xc8a0ff, { emissive: 0x2a1a40 }), rimM = lam(0xffffff, { emissive: 0x303030 }), foamM = lam(0xffffff, { emissive: 0x505058 });
  for (const [x, y, z] of list) {
    const pot = new THREE.Group(); pot.position.set(x, y, z);
    const tub = new THREE.Mesh(tubG, tubM); tub.position.y = 0.25;
    const rim = new THREE.Mesh(rimG, rimM); rim.rotation.x = Math.PI / 2; rim.position.y = 0.5;
    const foam = new THREE.Mesh(foamG, foamM); foam.scale.set(1, 0.45, 1); foam.position.y = 0.52;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), lam(0xf0c84a)); stick.position.set(0.18, 0.75, 0); stick.rotation.z = -0.4;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 5, 14), lam(0xff9ac8)); loop.position.set(0.31, 1.05, 0); loop.rotation.y = Math.PI / 2;
    const bubs = [0, 1, 2].map(k => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07 + 0.03 * k, 8, 6), soapMaterial(1)); b.position.set(-0.15 + 0.12 * k, 0.7, 0.1 - 0.1 * k); b.renderOrder = 2; return b; });
    pot.add(tub, rim, foam, stick, loop, ...bubs);
    g.add(pot); pots.push({ g: pot, bubs });
  }
  g.userData.parts = { pots };
  g.userData.dispose = disposer(g);
  return g;
}
// A puff of air out of a dry wand: a few soft white wisps that fly forward and fade (the live part places them by the puff's age).
export function buildPuff(n = 7) {
  const g = new THREE.Group();
  const wisps = inst(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }), n);
  wisps.renderOrder = 6;
  g.add(wisps);
  g.userData.parts = { wisps, n };
  g.userData.dispose = disposer(g);
  return g;
}
/* ---------------------------------------------- rework 2026-10-29: each game's key object stands out ---------------------------------------------- */
// A canvas word on a sprite (always faces you): the "Ride!" sign over the ride bubble.
export function buildSign(text, { color = '#ff4f9a', w = 2.2, h = 1.1, arrow = true } = {}) {
  if (typeof document === 'undefined') { const g = new THREE.Group(); g.userData.parts = {}; g.userData.dispose = () => {}; return g; } // (Node: tests/bubblenode.mjs)
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.92)'; x.strokeStyle = color; x.lineWidth = 10;
  x.beginPath(); if (x.roundRect) x.roundRect(8, 8, 240, arrow ? 84 : 112, 30); else x.rect(8, 8, 240, arrow ? 84 : 112); x.fill(); x.stroke();
  x.fillStyle = color; x.font = 'bold 60px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, arrow ? 52 : 66);
  if (arrow) { x.beginPath(); x.moveTo(104, 96); x.lineTo(152, 96); x.lineTo(128, 124); x.closePath(); x.fill(); }
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(w, h, 1); sprite.renderOrder = 6;
  const g = new THREE.Group(); g.add(sprite);
  g.userData.parts = { sprite };
  g.userData.dispose = () => { tex.dispose(); sprite.material.dispose(); };
  return g;
}
// The Chimney Ride's bubble (owner 2026-10-29: "the bubble didn't look like a different, nice-looking bubble"): a big golden-rainbow
// bubble with a soft glow round it, a gold band and a foam seat inside (the live part sits a little rubber duck on it while nobody rides).
export function buildRideBubble(r = 1) {
  const g = new THREE.Group();
  const film = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), soapMaterial(0.8));
  film.renderOrder = 2;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(r * 0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
  shine.position.set(-r * 0.42, r * 0.52, r * 0.42); shine.renderOrder = 3;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(r * 1.3, 24, 14), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
  glow.renderOrder = 1;
  const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
  band.rotation.x = Math.PI / 2; band.position.y = -r * 0.72; band.scale.setScalar(0.7); // (a gold rim low round it, under the duck)
  const seat = new THREE.Mesh(new THREE.TorusGeometry(r * 0.42, r * 0.13, 8, 20), lam(0xffffff, { emissive: 0x404048 }));
  seat.rotation.x = Math.PI / 2; seat.position.y = -r * 0.62;
  // a warm gold body (not the stairs' clear soap look) and gold sparkles circling it (the live part turns `sparks`)
  const gold = new THREE.Mesh(new THREE.SphereGeometry(r * 0.98, 28, 18), new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.22, depthWrite: false }));
  gold.renderOrder = 1;
  const sparks = new THREE.Group(), sg = new THREE.OctahedronGeometry(r * 0.07);
  for (let i = 0; i < 16; i++) {
    const a = i * 2.399, y = Math.sin(i * 1.7) * r * 0.8, rr = r * 1.18 + 0.08 * (i % 3);
    const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: i % 3 ? 0xffe066 : 0xffffff }));
    m.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); sparks.add(m);
  }
  g.add(glow, gold, film, shine, band, seat, sparks);
  g.userData.parts = { film, shine, glow, band, seat, gold, sparks };
  g.userData.dispose = disposer(g);
  return g;
}
// Where Blow! will put your next bubble (the Bubble Stairs): a faint ghost bubble with a ring round its middle.
export function buildGhost(r = 0.55) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
  ring.rotation.x = Math.PI / 2;
  ball.renderOrder = 4; ring.renderOrder = 4;
  g.add(ball, ring);
  g.userData.parts = { ball, ring };
  g.userData.dispose = disposer(g);
  return g;
}
// The Puff! arrow on the floor: which way and how far a puff sends the duckling (length 1 along +x: the live part scales and turns it).
export function buildArrow(color = 0xfff28a) {
  const g = new THREE.Group(), sh = new THREE.Shape();
  sh.moveTo(0, -0.12); sh.lineTo(0.8, -0.12); sh.lineTo(0.8, -0.3); sh.lineTo(1, 0); sh.lineTo(0.8, 0.3); sh.lineTo(0.8, 0.12); sh.lineTo(0, 0.12); sh.closePath();
  const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 4;
  g.add(mesh);
  g.userData.parts = { mesh };
  g.userData.dispose = disposer(g);
  return g;
}
