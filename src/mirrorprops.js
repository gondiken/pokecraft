// Wave 18: the Mirror Palace's models (THREE only; never world blocks): the hand mirror you hold, the shine ball, Cleo's mirror, the spinner bar and the rail plate
// (Bounce-Back), the gold pads, ink puddles, bonk balls, the mop and your silver twin (Looking-Glass Rooms), the sun mirror on its swivel, the sunbeam, the spot of
// light and the Gloomies with their googly eyes (Moonlit Gallery), and the funny mirrors' alcoves with their reflections. Each builder returns a Group with
// userData.parts and userData.dispose(). tests/mirror-preview.mjs photographs them for the owner. Nothing here looks like a star (only the Wizard's star is one).
import * as THREE from 'three';
import { buildPerson } from './npc.js';

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const disposer = g => () => g.traverse(o => { if (o.isMesh || o.isInstancedMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); }); } });
const SILVER = 0xdfe3f2, GOLD = 0xf0c84a;
const hide = m => { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < m.count; i++) m.setMatrixAt(i, z); m.instanceMatrix.needsUpdate = true; };
const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; hide(m); return m; };
const wrap = (g, parts) => { g.userData.parts = parts; g.userData.dispose = disposer(g); return g; };
// a soft round glow texture (white in the middle, clear at the edge)
const glowTex = (inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(0.55, 'rgba(255,255,255,0.45)'); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
};
// a hand mirror: a round silver glass in a gold rim on a handle. Faces +z, the handle hangs below. `r` = the glass's radius.
export function buildHandMirror(r = 0.4) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 24), [lam(0xb8bcd0), basic(0xf4f6ff), lam(0xb8bcd0)]); glass.rotation.x = Math.PI / 2; g.add(glass);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.13, 6, 24), lam(GOLD, { emissive: 0x403000 })); rim.position.z = 0.0; g.add(rim);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(r * 0.28, r * 1.3, r * 0.2), lam(GOLD, { emissive: 0x403000 })); handle.position.set(0, -r * 1.5, 0); g.add(handle);
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.32, r * 1.5), basic(0xffffff, { transparent: true, opacity: 0.55 })); sheen.rotation.z = -0.6; sheen.position.set(-r * 0.2, r * 0.1, 0.03); g.add(sheen);
  return wrap(g, { glass, rim, handle, sheen });
}
// the shine ball: a glowing pearl with a soft halo (flat at knee height)
export function buildShineBall(r = 0.35) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), basic(0xfffaf0)); g.add(core);
  const tex = glowTex('rgba(255,240,250,1)'), halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd8f0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(r * 5); g.add(halo);
  return wrap(g, { core, halo });
}
// the spinner bar: a silver bar with gold ends and a gold hub (the court's round-3 surprise). len = its whole length.
export function buildSpinner(len = 3) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.24), lam(SILVER, { emissive: 0x303848 })); bar.position.y = 0.6; g.add(bar);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.34), lam(GOLD, { emissive: 0x403000 })); cap.position.set(s * len / 2, 0.6, 0); g.add(cap); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.2, 12), lam(GOLD, { emissive: 0x403000 })); hub.position.y = 0.6; g.add(hub);
  return wrap(g, { bar });
}
// your rail (a low gold bar along the court's near end) and the Play! plate (a gold disc with a ball painted on it)
export function buildRail(width = 16) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.2), lam(GOLD, { emissive: 0x403000 })); bar.position.set(width / 2, 0.08, 0); g.add(bar);
  for (const x of [0, width]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), lam(GOLD, { emissive: 0x403000 })); post.position.set(x, 0.25, 0); g.add(post); }
  return wrap(g, { bar });
}
export function buildPlate(r = 1.0) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.06, 24), lam(GOLD, { emissive: 0x504010 })); g.add(disc);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 12, 8), basic(0xfffaf0)); ball.position.y = 0.2; g.add(ball);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, 0.05, 4, 24), basic(0xfffaf0)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  return wrap(g, { disc, ball, ring });
}
// a gold pad: a disc that glows once it counts (the live part changes `lit`); `its` pads are cooler silver-gold so you can tell them apart through the glass
export function buildPad(r = 0.7) {
  const g = new THREE.Group();
  const mat = lam(GOLD, { emissive: 0x6a4a00 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.06, 20), mat); g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, 0.045, 4, 20), basic(0xfff6c8)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  const tex = glowTex('rgba(255,250,200,1)'), halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xfff0a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(r * 4); halo.position.y = 0.35; g.add(halo);
  return wrap(g, { disc, ring, halo, mat, r });
}
// the Scribble's ink: a black puddle with a shine and a few bubbles
export function buildPuddle(r = 1.2) {
  const g = new THREE.Group();
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.07, 18), lam(0x14101c)); g.add(pool);
  const shine = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.075, 12), basic(0x3a3050)); shine.position.set(r * 0.12, 0, -r * 0.1); g.add(shine);
  const glint = new THREE.Mesh(new THREE.CircleGeometry(r * 0.13, 8), basic(0xffffff)); glint.rotation.x = -Math.PI / 2; glint.position.set(-r * 0.3, 0.045, -r * 0.35); g.add(glint);
  const bubbles = [0, 1, 2].map(i => { const b = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 6, 5), lam(0x2a2040)); b.position.set(Math.cos(i * 2.1) * r * 0.5, 0.1, Math.sin(i * 2.1) * r * 0.5); g.add(b); return b; });
  return wrap(g, { pool, bubbles });
}
// a bonk ball: a big soft rubber ball (pink with two white stripes)
export function buildBonkBall(r = 0.9) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), lam(0xff7aa8, { emissive: 0x401020 })); g.add(ball);
  for (const a of [0, Math.PI / 2]) { const stripe = new THREE.Mesh(new THREE.TorusGeometry(r * 1.002, r * 0.07, 4, 24), lam(0xffffff, { emissive: 0x303030 })); stripe.rotation.y = a; g.add(stripe); }
  return wrap(g, { ball });
}
// the mop: a pole with a long arm and a yellow fringe at its tip. Turns round y.
export function buildMop(len = 3) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.8, 8), lam(0x8a5a30)); pole.position.y = 0.9; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.18), lam(0x8a5a30)); arm.position.set(len / 2, 0.8, 0); g.add(arm);
  const head = new THREE.Group(); head.position.set(len, 0.55, 0);
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), lam(i % 2 ? 0xffe070 : 0xffd040)); s.position.set(0, 0, (i - 3) * 0.13); s.rotation.z = (i - 3) * 0.06; head.add(s); }
  g.add(head);
  return wrap(g, { pole, arm, head });
}
// your silver twin: a person in a silvery sheen (your colours' shape; the page gives its outfit)
export const TWIN_OUTFIT = { shirt: 0xcfd6ee, pants: 0x9aa4c4, hair: 0xe9ecf8, skin: 0xe6ecfa };
export function buildTwin(outfit = TWIN_OUTFIT) {
  const g = buildPerson(outfit);
  g.traverse(o => { if (o.isMesh && o.material?.emissive) o.material.emissive.setHex(0x2a3250); });
  g.userData.keepColour = true;
  return g;
}
// the sun mirror on its swivel: a pole, a ring and a big round mirror (turned to face along `normal` by the live part)
export function buildSunMirror() {
  const g = new THREE.Group();
  const chain = new THREE.Mesh(new THREE.BoxGeometry(0.1, 15, 0.1), lam(GOLD, { emissive: 0x403000 })); chain.position.y = 8.2; g.add(chain); // hangs from the ceiling: nothing in the way of your view
  const face = new THREE.Group(); g.add(face);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 28), [lam(0xb8bcd0), basic(0xfffbe8), lam(0xb8bcd0)]); glass.rotation.x = Math.PI / 2; face.add(glass);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.1, 6, 28), lam(GOLD, { emissive: 0x403000 })); face.add(rim);
  const tex = glowTex('rgba(255,244,200,1)'), glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffe9a0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(3.2); face.add(glow);
  return wrap(g, { face, glass, rim, glow, chain });
}
// a shaft of light between two points (a thin additive box, re-aimed by `setShaft`)
export function buildShaft(color = 0xfff0b0, width = 0.22) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(width, width, 1); geo.translate(0, 0, 0.5);
  const m = new THREE.Mesh(geo, basic(color, { transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending })); m.frustumCulled = false; g.add(m);
  return wrap(g, { m });
}
export const setShaft = (shaft, a, b, width = null) => {
  const m = shaft.userData.parts.m, d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  m.position.set(a[0], a[1], a[2]); m.scale.set(width ?? 1, width ?? 1, Math.max(0.001, len)); m.lookAt(b[0], b[1], b[2]); m.visible = len > 0.01;
};
// the spot of light on the wall (a soft disc facing +z); `r` = its radius
export function buildSpot(r = 1.2) {
  const g = new THREE.Group();
  const tex = glowTex('rgba(255,222,70,1)', 'rgba(255,200,40,0)'), m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.8, r * 2.8), basic(0xffffff, { map: tex, transparent: true, opacity: 0.95, depthWrite: false }));
  g.add(m);
  const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 20), basic(0xfffbe0, { transparent: true, opacity: 0.8, depthWrite: false })); core.position.z = 0.01; g.add(core);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.95, r * 1.08, 28), basic(0xe8a010, { transparent: true, opacity: 0.9, depthWrite: false })); ring.position.z = 0.02; g.add(ring);
  return wrap(g, { m, core, ring });
}
// the Gloomies: fuzzy grey scribble-balls with googly eyes (instanced: bodies, eye whites, pupils); n of them
export function buildGloomies(n = 4, r = 0.6) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(r, 1), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = 1 + 0.22 * Math.sin(i * 12.9898) * Math.cos(i * 4.1414); pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
  geo.computeVertexNormals();
  const bodies = inst(geo, lam(0x55556a, { emissive: 0x15151f }), n);
  const whites = inst(new THREE.SphereGeometry(r * 0.26, 8, 6), basic(0xffffff), n * 2);
  const pupils = inst(new THREE.SphereGeometry(r * 0.12, 6, 5), basic(0x101018), n * 2);
  const tufts = inst(new THREE.ConeGeometry(r * 0.13, r * 0.5, 4), lam(0x3a3a4c), n * 3);
  g.add(bodies, whites, pupils, tufts);
  return wrap(g, { bodies, whites, pupils, tufts, n, r });
}
// poof sparkles: little spinning glints (not stars: tiny diamonds) that fly out and fade (instanced; the live part moves them)
export function buildPoofs(n = 40) {
  const g = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(0.1, 0), m = inst(geo, basic(0xfff4c0), n);
  g.add(m);
  return wrap(g, { m, n });
}
// owner 2026-10-31: a "!" over a Gloomy while the light is on it (it shivers and squeaks): you see your banked shot worked without sound
export function buildBangs(n = 4) {
  const g = new THREE.Group(), list = [];
  let map = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
    x.font = 'bold 112px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 14; x.strokeStyle = '#3a2a10'; x.strokeText('!', 32, 68); x.fillStyle = '#ffe14a'; x.fillText('!', 32, 68);
    map = new THREE.CanvasTexture(c);
  }
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(0.8, 1.6, 1); sp.visible = false; sp.renderOrder = 5; g.add(sp); list.push(sp);
  }
  g.userData.parts = { list };
  g.userData.dispose = () => { map?.dispose(); list.forEach(sp => sp.material.dispose()); };
  return g;
}
// owner 2026-10-31 ("we can do way better than this"): a REAL funny mirror. The hall is drawn again from the mirror's side into a texture (like three's
// Reflector, with the oblique clip plane), and the shader bends where it reads that picture: tall, wide, tiny, wobbly, upside down, two of you. Only the
// one mirror you face draws (`active`); the others show a silver sheen. w x h blocks, its local x across, y up, the floor `floorY` below its middle.
export const FUN_BEND = { tall: 1, wide: 2, tiny: 3, wobbly: 4, upside: 5, twins: 6 };
let funDrawing = false; // a mirror seen inside another's reflection shows its last picture (no mirror draws inside another)
export const FUN_RES = { hi: 512, lo: 256 }; // the mirror you look at most / the second one and the still pictures
export function buildFunMirror(kind, w, h, floorY) {
  const g = new THREE.Group();
  const rts = {}, rtOf = k => typeof document === 'undefined' ? null : (rts[k] ||= new THREE.WebGLRenderTarget(FUN_RES[k], FUN_RES[k]));
  const tm = new THREE.Matrix4();
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, textureMatrix: { value: tm }, bend: { value: FUN_BEND[kind] || 0 }, size: { value: new THREE.Vector2(w, h) }, floorY: { value: floorY }, time: { value: 0 }, tint: { value: new THREE.Color(0xeef2ff) } },
    vertexShader: 'varying vec2 vLocal; void main() { vLocal = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform mat4 textureMatrix; uniform float bend; uniform vec2 size; uniform float floorY; uniform float time; uniform vec3 tint; varying vec2 vLocal;
      void main() {
        vec2 p = vLocal, q = p; float fy = floorY;
        if (bend == 1.0) { q.x = p.x * 1.3; q.y = fy + (p.y - fy) / 1.65; }
        else if (bend == 2.0) { q.x = p.x / 1.8; q.y = fy + (p.y - fy) * 1.45; }
        else if (bend == 3.0) { q.x = p.x * 2.1; q.y = fy + (p.y - fy) * 2.1; }
        else if (bend == 4.0) { q.x = p.x + 0.35 * sin(p.y * 2.2 + time * 2.3); q.y = p.y + 0.22 * sin(p.x * 2.8 + time * 1.7); }
        else if (bend == 5.0) { q.y = -p.y; }
        else if (bend == 6.0) { float u = (p.x + size.x * 0.5) / size.x; q.x = (fract(u * 2.0) - 0.5) * size.x * 0.55; }
        vec4 c = textureMatrix * vec4(q, 0.0, 1.0);
        vec2 uv = clamp(c.xy / c.w, 0.002, 0.998);
        vec3 col = texture2D(tDiffuse, uv).rgb * tint;
        vec2 e = abs(p) / (size * 0.5); float edge = smoothstep(0.82, 1.0, max(e.x, e.y));
        float sheen = smoothstep(0.06, 0.0, abs(p.x * 0.55 + p.y * 0.35 - size.x * 0.12)) * 0.12;
        gl_FragColor = vec4(mix(col, vec3(0.86, 0.88, 0.96), edge * 0.35) + sheen, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); glass.position.y = h / 2; g.add(glass);
  // what an idle mirror shows: a silver face with two soft streaks (still looks like a mirror from across the hall)
  const idle = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(0xc9cfe4)); idle.position.set(0, h / 2, -0.005); g.add(idle);
  for (const [dx, sw, o] of [[-0.18, 0.2, 0.35], [0.06, 0.09, 0.25]]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(w * sw, h * 1.05), basic(0xffffff, { transparent: true, opacity: o, depthWrite: false })); st.rotation.z = -0.5; st.position.set(w * dx, h / 2, 0.004); idle.add(st); st.position.set(w * dx, 0, 0.004); }
  // the gold frame: a moulding all round (it covers the wall's frame blocks), round knobs at the corners, a gem on a crest
  const goldM = lam(GOLD, { emissive: 0x3a2a00 }), lipM = lam(0xfff0b0, { emissive: 0x403010 }), side = 0.55, bot = 0.25, d = 0.3;
  for (const [x, y, bw, bh] of [[0, h + side / 2, w + 2 * side, side], [0, -bot / 2, w + 2 * side, bot], [-(w + side) / 2, h / 2, side, h], [(w + side) / 2, h / 2, side, h]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), goldM); bar.position.set(x, y, d / 2 - 0.1); g.add(bar);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(bw > bh ? bw - 0.1 : bh * 0 + 0.12, bh > bw ? bh : Math.min(0.12, bh), 0.05), lipM); lip.position.set(x, y, d - 0.08); g.add(lip);
  }
  const knob = new THREE.SphereGeometry(0.3, 12, 8);
  for (const [x, y] of [[-1, -bot / 2], [1, -bot / 2], [-1, h + side / 2], [1, h + side / 2]]) { const k = new THREE.Mesh(knob, goldM); k.position.set(x * (w / 2 + side / 2), y, d / 2 + 0.05); g.add(k); }
  const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 20, 1, false, -Math.PI / 2, Math.PI), goldM); crest.rotation.x = Math.PI / 2; crest.position.set(0, h + side, d / 2); g.add(crest);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), lam(0xa8e8ff, { emissive: 0x2a6080 })); gem.position.set(0, h + side + 0.25, d / 2 + 0.2); g.add(gem);
  // the reflection: drawn from the mirror image of a camera into a texture. `mode` (set by the live part each frame): 'hi' / 'lo' = live from your
  // camera at that size; 'still' = once from `stillCam` (straight in front, no you in it) at 'lo', then kept: a still picture of the hall that
  // stays right for any angle (the texture matrix is kept with it)
  const P = { plane: new THREE.Plane(), n: new THREE.Vector3(), at: new THREE.Vector3(), cam: new THREE.Vector3(), rot: new THREE.Matrix4(), look: new THREE.Vector3(), clip: new THREE.Vector4(), view: new THREE.Vector3(), target: new THREE.Vector3(), q: new THREE.Vector4(), vc: new THREE.PerspectiveCamera() };
  const parts = { glass, idle, mat, gem, mode: null, still: false, stillCam: null, before: null, after: null, renders: 0, lastSize: 0 };
  const draw = (renderer, scene, camera, rt) => {
    const { plane, n, at, cam, rot, look, clip, view, target, q, vc } = P;
    at.setFromMatrixPosition(glass.matrixWorld); cam.setFromMatrixPosition(camera.matrixWorld);
    rot.extractRotation(glass.matrixWorld); n.set(0, 0, 1).applyMatrix4(rot);
    view.subVectors(at, cam); if (view.dot(n) > 0) return false;
    view.reflect(n).negate().add(at);
    rot.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cam);
    target.subVectors(at, look).reflect(n).negate().add(at);
    vc.position.copy(view); vc.up.set(0, 1, 0).applyMatrix4(rot).reflect(n); vc.lookAt(target);
    vc.far = camera.far; vc.updateMatrixWorld(); vc.projectionMatrix.copy(camera.projectionMatrix);
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse).multiply(glass.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(n, at).applyMatrix4(vc.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = vc.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1; e[14] = clip.w;
    const was = renderer.getRenderTarget(), vis = g.visible;
    g.visible = false;
    renderer.setRenderTarget(rt); renderer.state.buffers.depth.setMask(true); if (renderer.autoClear === false) renderer.clear();
    renderer.render(scene, vc);
    renderer.setRenderTarget(was); if (camera.viewport) renderer.state.viewport(camera.viewport);
    g.visible = vis; mat.uniforms.tDiffuse.value = rt.texture; parts.renders++; parts.lastSize = rt.width;
    return true;
  };
  glass.onBeforeRender = (renderer, scene, camera) => {
    if (funDrawing) return;
    funDrawing = true; try { drawNow(renderer, scene, camera); } finally { funDrawing = false; }
  };
  const drawNow = (renderer, scene, camera) => {
    if (parts.mode === 'hi' || parts.mode === 'lo') { const rt = rtOf(parts.mode); if (!rt) return; parts.before?.(); draw(renderer, scene, camera, rt); parts.after?.(); return; }
    if (parts.mode === 'still' && !parts.still && parts.stillCam) { const rt = rtOf('lo'); if (rt && draw(renderer, scene, parts.stillCam, rt)) parts.still = true; }
  };
  wrap(g, parts); const d0 = g.userData.dispose; g.userData.dispose = () => { d0(); for (const k in rts) rts[k].dispose(); };
  return g;
}
// the reflections: how each funny mirror draws you. sx / sy / sz = scale of the person (1 = you), flip = upside down, twin = a second one beside, wobble = it bends.
export const FUNNY_LOOKS = {
  tall: { sx: 0.75, sy: 1.55 }, wide: { sx: 1.7, sy: 0.7 }, tiny: { sx: 0.45, sy: 0.45 }, wobbly: { sx: 1, sy: 1, wobble: true },
  upside: { sx: 1, sy: 1, flip: true }, twins: { sx: 0.9, sy: 0.9, twin: true },
};
