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

// A faint dashed ring: where your next bubble will appear (turned to face you each frame).
export function buildAimRing(r = 0.55) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 24, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
  ring.renderOrder = 4;
  g.add(ring);
  g.userData.parts = { ring };
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
  const film = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), soapMaterial(0.9));
  film.position.y = 0.06;
  g.add(stick, ring, film);
  for (const o of g.children) o.renderOrder = 10;
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

// Soap flowers: a stem, six pink-and-white petals, a yellow middle and a little bubble on top (they fill your wand). Instanced.
export function buildFlowers(list) {
  const g = new THREE.Group(), n = list.length, M = new THREE.Matrix4();
  const stems = new THREE.InstancedMesh((() => { const s = new THREE.BoxGeometry(0.06, 0.5, 0.06); s.translate(0, 0.25, 0); return s; })(), lam(0x6ac85a), n);
  const petals = new THREE.InstancedMesh((() => { const p = new THREE.SphereGeometry(0.12, 8, 6); p.scale(1, 0.5, 1); return p; })(), lam(0xffc8ec, { emissive: 0x301020 }), n * 6);
  const middles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0xffe24a, { emissive: 0x403000 }), n);
  const tops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 12, 8), soapMaterial(1), n);
  list.forEach(([x, y, z], i) => {
    stems.setMatrixAt(i, M.makeTranslation(x, y, z));
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; petals.setMatrixAt(i * 6 + k, M.makeTranslation(x + Math.cos(a) * 0.15, y + 0.52, z + Math.sin(a) * 0.15)); }
    middles.setMatrixAt(i, M.makeTranslation(x, y + 0.54, z));
    tops.setMatrixAt(i, M.makeTranslation(x, y + 0.85, z));
  });
  for (const m of [stems, petals, middles, tops]) { m.frustumCulled = false; g.add(m); }
  g.userData.parts = { stems, petals, middles, tops };
  g.userData.dispose = disposer(g);
  return g;
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
    disc.position.set(chim.x, p.y, chim.z);
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
    spikes.frustumCulled = false;
    // the gold ring round the gap (rework 2026-10-29: fat and bright, so "fly through the gold rings" reads at a glance), a soft halo and a
    // beam of light under it (the live part shows the beam and pulses the ring only for the next ring)
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.16, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
    glowRing.rotation.x = Math.PI / 2; glowRing.position.set(gp.x, p.y + 0.36, gp.z);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.42, 6, 32), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.rotation.x = Math.PI / 2; halo.position.copy(glowRing.position); halo.renderOrder = 5;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.set(gp.x, p.y - 1.6, gp.z); beam.renderOrder = 5; beam.visible = false;
    g.add(disc, spikes, glowRing, halo, beam);
    plates.push({ disc, spikes, glowRing, halo, beam });
  }
  // the fan: four blades on a hub on the wall, turning
  const fan = new THREE.Group(), side = Math.atan2(chim.fan.vz, chim.fan.vx);
  fan.position.set(chim.x - Math.cos(side) * (chim.r - 0.25), (chim.fan.y0 + chim.fan.y1) / 2, chim.z - Math.sin(side) * (chim.r - 0.25));
  fan.rotation.y = -side + Math.PI / 2;
  const blades = new THREE.Group();
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.85, 0.05), lam(0x8ad8ff)); b.position.y = 0.45; const h = new THREE.Group(); h.rotation.z = k * Math.PI / 2; h.add(b); blades.add(h); }
  blades.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), lam(0xf0c84a)));
  fan.add(blades);
  g.add(fan);
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
  g.userData.parts = { plates, fan: blades, bar, stars };
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

// Captain Suds' three shield bubbles round his throne (outermost first), each with a slowly turning ring of sparkles.
export function buildShields(shield) {
  const g = new THREE.Group(), list = [];
  shield.radii.forEach((r, i) => {
    const s = buildBigBubble(r, 0.8 + i * 0.1);
    s.position.set(shield.x, shield.y, shield.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 4, 32), new THREE.MeshBasicMaterial({ color: [0xbfefff, 0xffc8ec, 0xfff2a8][i], transparent: true, opacity: 0.7 }));
    ring.rotation.x = Math.PI / 2 - 0.3 * i;
    s.add(ring);
    g.add(s); list.push({ g: s, ring, r });
  });
  g.userData.parts = { list };
  g.userData.dispose = disposer(g);
  return g;
}

/* ---------------------------------------------- rework 2026-10-29: each game's key object stands out ---------------------------------------------- */
// A canvas word on a sprite (always faces you): the "Ride!" sign over the ride bubble.
export function buildSign(text, { color = '#ff4f9a', w = 2.2, h = 1.1, arrow = true } = {}) {
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
  const film = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), soapMaterial(1.25));
  film.renderOrder = 2;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(r * 0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
  shine.position.set(-r * 0.42, r * 0.52, r * 0.42); shine.renderOrder = 3;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 24, 14), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
  glow.renderOrder = 1;
  const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
  band.rotation.x = Math.PI / 2;
  const seat = new THREE.Mesh(new THREE.TorusGeometry(r * 0.42, r * 0.13, 8, 20), lam(0xffffff, { emissive: 0x404048 }));
  seat.rotation.x = Math.PI / 2; seat.position.y = -r * 0.62;
  g.add(glow, film, shine, band, seat);
  g.userData.parts = { film, shine, glow, band, seat };
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
// n little dots (a dotted aim line: the shields' bank shot).
export function buildDots(n = 40, color = 0xffffff, size = 0.07) {
  const g = new THREE.Group();
  const dots = inst(new THREE.SphereGeometry(size, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }), n);
  dots.renderOrder = 6;
  g.add(dots);
  g.userData.parts = { dots, n };
  g.userData.dispose = disposer(g);
  return g;
}
// Puts the dots along a polyline [[x, z]...] at height y, one every `gap` blocks (the rest hidden); shift slides them along (a march).
export function drawDots(g, pts, y, gap = 0.4, shift = 0) {
  const { dots, n } = g.userData.parts, M = new THREE.Matrix4();
  let i = 0;
  for (let k = 1; k < pts.length && i < n; k++) {
    const [ax, az] = pts[k - 1], [bx, bz] = pts[k], len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-6) continue;
    for (let s = (k === 1 ? shift % gap : 0); s <= len && i < n; s += gap) dots.setMatrixAt(i++, M.makeTranslation(ax + (bx - ax) * s / len, y, az + (bz - az) * s / len));
  }
  for (; i < n; i++) dots.setMatrixAt(i, ZERO);
  dots.instanceMatrix.needsUpdate = true;
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
// The shield game's soap cushions: plump pink pillows with white stripes (a box in world units from bubbleland.js COURT), y0 its floor.
export function buildCushion(box, y0, h = 2) {
  const g = new THREE.Group(), w = box.x1 - box.x0, d = box.z1 - box.z0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(0xff7ab8, { emissive: 0x501030 }));
  body.position.set(w / 2, h / 2, d / 2);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), lam(0xffa0cc, { emissive: 0x401028 }));
  puff.scale.set(w * 0.62, h * 0.55, d * 0.55); puff.position.copy(body.position);
  g.add(body, puff);
  const long = d >= w;
  for (let s = 0.5; s < (long ? d : w); s += 1.4) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(long ? w + 0.04 : 0.16, h * 0.9, long ? 0.16 : d + 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    st.position.set(long ? w / 2 : s, h / 2, long ? s : d / 2); g.add(st);
  }
  g.position.set(box.x0, y0, box.z0);
  g.userData.parts = { body, puff };
  g.userData.dispose = disposer(g);
  return g;
}
// A gold pad on the floor (the shield game): a gold ring with a pale middle; y its floor's top.
export function buildPad(x, y, z, r = 1.0) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r, 32), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 32), new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  fill.rotation.x = -Math.PI / 2; fill.position.y = -0.005;
  g.add(ring, fill);
  g.position.set(x, y + 0.03, z);
  g.userData.parts = { ring, fill };
  g.userData.dispose = disposer(g);
  return g;
}
