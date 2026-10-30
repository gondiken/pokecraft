// The Portal House's models (owner 2026-10-29): the Swirl Wand you hold, the bolt it shoots onto a pad, and the doorways between
// rooms. Imports only three. Nothing here is a block, nothing is saved or sent.
//   - The Swirl Wand: a little wizard's wand (STORY.md: the Wizard made the Swirl), a twisted wooden stick with a curl at the top
//     holding a star. Never a sci-fi gun. Its star takes the colour of the swirl it will make (blue at a white pad, orange at a
//     peach pad, a soft white when it aims at nothing).
//   - The bolt: a short beam of light with a star that flies from the wand's tip to the pad.
//   - Doorways (owner 2026-10-29: the green door swirls looked like your blue swirl): a door is no longer a swirl but an open wooden
//     door frame with warm light inside it. Swirls are round and turn; doors are tall, square, still and warm.
import * as THREE from 'three';

export const WAND_COLOURS = { teal: 0x4a8cff, orange: 0xff7a1a, idle: 0xfff4c8 };

/* ---------- a tiny merge (no addons in the import map): boxes and other geometries with a vertex colour each ---------- */
function merged(pieces) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const { geo, color, m } of pieces) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal;
    c.set(color);
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      const shade = 0.78 + 0.18 * N.getY(i) + 0.08 * N.getX(i); // baked light: the House is bright everywhere, so no lamps are needed
      col.push(c.r * shade, c.g * shade, c.b * shade);
    }
    g.dispose(); geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

function starShape(r0, r1, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? r1 : r0;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/* ---------- the Swirl Wand ---------- */
// Built along +y (the tip up) with its grip at the origin; the live part lays it in front of the camera.
export function buildWand() {
  const wood = 0x8a5a2e, dark = 0x5e3a1c, gold = 0xffd257, pieces = [];
  // the stick: six short pieces, a little thinner towards the tip, with a dark spiral groove
  for (let i = 0; i < 6; i++) {
    const r = 0.026 - i * 0.002;
    pieces.push({ geo: new THREE.CylinderGeometry(r * 0.92, r, 0.075, 7), color: wood, m: M(0, 0.0375 + i * 0.075, 0, 0, i * 0.5, 0) });
    pieces.push({ geo: new THREE.BoxGeometry(r * 2.1, 0.012, r * 0.7), color: dark, m: M(0, 0.03 + i * 0.075, 0, 0, i * 1.05, 0.35) });
  }
  pieces.push({ geo: new THREE.CylinderGeometry(0.031, 0.031, 0.022, 9), color: gold, m: M(0, 0.12, 0) });   // a gold band at the grip
  pieces.push({ geo: new THREE.SphereGeometry(0.03, 8, 6), color: dark, m: M(0, -0.005, 0) });              // the round end
  // the curl at the top: a little hook of wood that holds the star
  pieces.push({ geo: new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI * 1.25), color: wood, m: M(0.045, 0.47, 0, 0, 0, Math.PI * 0.9) });
  const stick = new THREE.Mesh(merged(pieces), new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false }));
  // the star: flat, a little thick, its own material so its colour can change
  const sg = new THREE.ExtrudeGeometry(starShape(0.075, 0.034), { depth: 0.022, bevelEnabled: false });
  sg.translate(0, 0, -0.011);
  const star = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: WAND_COLOURS.idle, depthTest: false, depthWrite: false }));
  star.position.set(0, 0.56, 0);
  // a soft halo behind the star (additive, so it glows on any wall)
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: WAND_COLOURS.idle, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
  halo.position.set(0, 0.56, -0.015);
  const group = new THREE.Group();
  group.add(stick, star, halo);
  stick.renderOrder = 60; halo.renderOrder = 61; star.renderOrder = 62; // drawn over the world: it is in your hand (no wall can hide it)
  group.userData.parts = { stick, star, halo };
  group.userData.tip = new THREE.Vector3(0, 0.56, 0);
  group.userData.dispose = () => group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return group;
}

/* ---------- the bolt ---------- */
export function buildBolt() {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: WAND_COLOURS.teal, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  const head = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.22, 0.1), { depth: 0.06, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  beam.renderOrder = 9; head.renderOrder = 9;
  return { beam, head };
}

/* ---------- a little Capture Cube (the Portal House's sparks) ---------- */
// Owner 2026-10-30: a star is only ever the Wizard's star (the star bridge), so what you catch in a flight is what it gives: a Capture Cube
// (the battle's cube: red top, white bottom, a dark band, a white button), small, for an InstancedMesh with vertex colours.
export function buildMiniCube(s = 0.42) {
  const h = s / 2, pieces = [];
  pieces.push({ geo: new THREE.BoxGeometry(s, h, s), color: 0xe33b3b, m: M(0, h / 2) });
  pieces.push({ geo: new THREE.BoxGeometry(s, h, s), color: 0xf2f2f2, m: M(0, -h / 2) });
  pieces.push({ geo: new THREE.BoxGeometry(s * 1.06, s * 0.1, s * 1.06), color: 0x262626, m: M() });
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) pieces.push({ geo: new THREE.BoxGeometry(s * 0.26, s * 0.26, s * 0.06), color: 0xffffff, m: M(Math.sin(r) * s * 0.53, 0, Math.cos(r) * s * 0.53, 0, r) });
  return merged(pieces);
}

/* ---------- doorways ---------- */
// The wooden frames of the doors in a list of door swirls (wall swirls with an alcove), merged into one mesh (one draw call per part).
// A door is w wide and h tall; its frame stands on the wall's face round the opening (posts outside it, the lintel and the rounded
// corners inside its top), so it never pokes into a ceiling right above a door. Owner 2026-10-30 (a flicker on a post seen up close):
// no face of the frame lies in the plane of a block face: every piece starts FRONT (in front of the wall) and the posts stand a hair
// outside the opening, so the alcove's side walls never meet a post face.
const FRONT = 0.012; // how far in front of the wall's face every piece of a door frame starts
export function buildDoorFrames(doors) {
  const wood = 0x9a6436, light = 0xc58a4e, gold = 0xffd257, pieces = [];
  for (const s of doors) {
    const [nx, , nz] = s.normal, c = s.centre, w = s.w, h = s.h;
    const yaw = Math.atan2(nx, nz); // local +z = out of the wall, local x = across the door
    const base = M(c[0], c[1], c[2], 0, yaw, 0);
    const add = (geo, color, x, y, z, rz = 0) => pieces.push({ geo, color, m: base.clone().multiply(M(x, y, z, 0, 0, rz)) });
    const back = d => FRONT + d / 2; // a piece d deep, its back face FRONT in front of the wall
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.3, h + 0.05, 0.21), wood, sx * (w / 2 + 0.16), -0.025, back(0.21));   // the posts (a hair outside the opening)
      add(new THREE.BoxGeometry(0.42, 0.14, 0.27), light, sx * (w / 2 + 0.16), -h / 2 + 0.075, back(0.27)); // their feet
      for (let k = 0; k < 3; k++) { // the rounded top corners, three steps inside the opening
        const sz = 0.34 - k * 0.11;
        add(new THREE.BoxGeometry(sz, 0.11, 0.19), wood, sx * (w / 2 - sz / 2), h / 2 - 0.27 - k * 0.11, back(0.19));
      }
    }
    add(new THREE.BoxGeometry(w + 0.74, 0.24, 0.25), light, 0, h / 2 - 0.1, back(0.25));                       // the lintel
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 16).rotateX(Math.PI / 2), gold, 0, h / 2 - 0.1, back(0.25) + 0.17); // a round gold knob on it (owner 2026-10-30: no star but the Wizard's)
  }
  if (!pieces.length) return null;
  return new THREE.Mesh(merged(pieces), new THREE.MeshBasicMaterial({ vertexColors: true }));
}

// The warm light inside an open doorway: still, tall stripes of light drifting up, little motes rising (no spiral: a swirl turns, a
// door does not). One draw call per open door.
const CURTAIN_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const CURTAIN_FRAG = `uniform float t, open; uniform vec2 size; varying vec2 vUv;
float h1(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 q = vUv * size;
  float rays = 0.0;
  for (int i = 0; i < 4; i++) { float f = float(i); rays += 0.5 + 0.5 * sin(q.x * (3.1 + f * 1.7) + f * 2.3 + sin(q.y * 0.6 - t * (0.6 + f * 0.2)) * 0.8); }
  rays /= 4.0;
  float motes = 0.0;
  for (int i = 0; i < 6; i++) { float f = float(i), x = h1(f * 7.1) * size.x, y = mod(h1(f * 3.3) * size.y + t * (0.35 + h1(f) * 0.3), size.y + 0.4) - 0.2;
    motes += smoothstep(0.09, 0.0, length(q - vec2(x + 0.08 * sin(t * 2.0 + f), y))); }
  float lowGlow = smoothstep(size.y, 0.0, q.y) * 0.35;
  vec3 warm = vec3(1.0, 0.84, 0.52), white = vec3(1.0, 0.98, 0.9);
  vec3 col = mix(warm * 0.75, white, rays * 0.55 + lowGlow) + white * motes * 0.8;
  float e = min(min(vUv.x, 1.0 - vUv.x) * size.x, (1.0 - vUv.y) * size.y);
  float alpha = smoothstep(0.0, 0.35, e) * mix(0.0, 0.92, open) * (0.82 + 0.18 * rays);
  gl_FragColor = vec4(col, alpha);
}`;
export class DoorLight {
  constructor(scene, s) {
    this.scene = scene;
    this.u = { t: { value: 0 }, open: { value: 0 }, size: { value: new THREE.Vector2(s.w, s.h) } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: CURTAIN_VERT, fragmentShader: CURTAIN_FRAG, transparent: true, depthWrite: false }));
    const [nx, , nz] = s.normal, c = s.centre;
    this.mesh.position.set(c[0] - nx * 0.35, c[1], c[2] - nz * 0.35); // a little way into the doorway, behind the frame's front
    this.mesh.rotation.set(0, Math.atan2(nx, nz), 0);
    this.mesh.renderOrder = 7;
    this.mesh.userData.portalHouse = true;
    this.group = this.mesh;
    scene.add(this.mesh);
  }
  update(dt, open) { this.u.t.value += dt; this.u.open.value += (open - this.u.open.value) * Math.min(1, dt * 3); }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
