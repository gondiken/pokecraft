// T38d: the Swirl's atmosphere. A paint-box sky dome (one mesh, vertex colours redone a few times a second from where you are),
// fog / brightness / sky colour that follow the zone you stand in (swirlland.js ZONES), glowing nebula puffs, sparkles, and floating
// oddities (tumbling empty frames, spinning swirl-wheels). All of it is meshes: never blocks, never saved, never solid. 5 draw calls.
// The gradient on the Swirl's blocks is a tint in the shared shader (caves.js swirlTint); this file only feeds its uniforms.
import * as THREE from 'three';
import { T } from './blocks.js';
import { swirlTint } from './caves.js';
import { ZONES, PALETTES, PARSED, zoneWeights, FRAME_COLORS, hexRgb } from './swirlland.js';

const IDS = PALETTES.map(p => p.id);
const clamp01 = v => Math.max(0, Math.min(1, v));
const ss = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
// The sky's glowing clouds: [azimuth, elevation, power].
export const SKY_BLOBS = [[0.8, 0.35, 10], [2.6, 0.2, 12], [4.4, 0.5, 8], [5.6, 0.15, 14]];
const BLOB_DIRS = SKY_BLOBS.map(([az, el]) => [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)]);
const MAX_PUFFS = 80, MAX_SPARKS = 400;

const srgb = (c, rgb) => c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);

function spiralTexture() { // pastel arms for the swirl-wheels
  const n = 64, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n);
  const cols = [[255, 168, 207], [255, 246, 214], [158, 232, 200], [200, 180, 255]];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x - n / 2 + 0.5, dy = y - n / 2 + 0.5, d = Math.hypot(dx, dy) / (n / 2), a = Math.atan2(dy, dx);
    const v = ((a / (Math.PI * 2) * 4 + d * 2.2) % 1 + 1) % 1, col = d < 0.12 ? [255, 255, 255] : cols[Math.floor(v * 4)], i = (y * n + x) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// One empty picture frame, 3 x 4 blocks, four bars.
function frameGeometry() {
  const parts = [], t = 0.4, d = 0.4, w = 3, h = 4;
  for (const [sx, sy, px, py] of [[w, t, 0, h / 2 - t / 2], [w, t, 0, -h / 2 + t / 2], [t, h - 2 * t, w / 2 - t / 2, 0], [t, h - 2 * t, -w / 2 + t / 2, 0]]) {
    const g = new THREE.BoxGeometry(sx, sy, d); g.translate(px, py, 0); parts.push(g);
  }
  const pos = [], nor = [], idx = []; let base = 0;
  for (const g of parts) {
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (const i of g.index.array) idx.push(i + base);
    base += g.attributes.position.count; g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setIndex(idx);
  return geo;
}

// A mesh of camera-facing quads for a list of { x, y, z, color, size?, phase, kind? }. `motion` is GLSL that may change `c` (the
// centre) and `s` (the size); fade = [from, to] distances over which a sprite appears; additive ones fade out with the fog instead of
// tinting to it. One draw call, no per-frame buffer uploads.
function sprites(list, { maxAngle = 99, size, opacity, additive = false, motion, fade, uTime }) {
  const n = list.length, pos = new Float32Array(n * 12), col = new Float32Array(n * 12), cor = new Float32Array(n * 8), siz = new Float32Array(n * 4), ph = new Float32Array(n * 4), kind = new Float32Array(n * 4), idx = [];
  const C = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  list.forEach((p, i) => {
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      pos.set([p.x, p.y, p.z], v * 3); col.set(p.color, v * 3); cor.set(C[k], v * 2);
      siz[v] = size(p); ph[v] = p.phase; kind[v] = p.kind ?? 0;
    }
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(cor, 2)); geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1)); geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime, uOpacity: { value: opacity } }]),
    vertexShader: `
      attribute vec3 color;
      attribute vec2 aCorner; attribute float aSize; attribute float aPhase; attribute float aKind;
      uniform float uTime;
      varying vec2 vUv; varying vec3 vCol; varying float vDist; varying float vFade; varying float vFogDepth;
      void main() {
        vec3 c = position; float s = aSize; vFade = 1.0;
        ${motion}
        vec4 mvPosition = viewMatrix * vec4(c, 1.0);
        vDist = length(mvPosition.xyz); vFogDepth = -mvPosition.z;
        mvPosition.xy += aCorner * min(s, ${maxAngle.toFixed(2)} * vDist) * 0.5; // never bigger than a part of the screen: big blends cost a lot on software GL
        vUv = aCorner * 0.5 + 0.5; vCol = color;
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `
      uniform float uOpacity; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying vec2 vUv; varying vec3 vCol; varying float vDist; varying float vFade; varying float vFogDepth;
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        if (r >= 1.0) discard;
        float k = 1.0 - r;
        float a = k * k * (0.6 + 0.8 * k) * uOpacity * smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, vDist);
        if (a < 0.01) discard;
        float f = smoothstep(fogNear, fogFar, vFogDepth);
        ${additive ? 'a *= 1.0 - f; gl_FragColor = vec4(vCol, a);' : 'gl_FragColor = vec4(mix(vCol, pow(fogColor, vec3(0.4545)), f), a);'}
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

export function createSwirlSky(game, { scene, camera }) {
  let st = null; // everything of the current Swirl, or null
  const toldZone = new Set();

  function dispose() {
    if (!st) return;
    for (const o of st.objects) { scene.remove(o); o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); }
    st.spiral?.dispose();
    st = null;
    swirlTint.uTintOn.value = 0;
  }

  // Put the palettes into the shared shader's uniforms.
  function feedTint() {
    ZONES.forEach((z, i) => swirlTint.uZone.value[i].set(z.x, z.z, z.r, 0));
    PARSED.forEach((p, i) => { srgb(swirlTint.uLo.value[i], p.lo); srgb(swirlTint.uHi.value[i], p.hi); srgb(swirlTint.uSea.value[i], p.sea); });
    swirlTint.uTintU.value.set(T.SWIRL_STONE_TOP, T.SWIRL_STONE + 1, T.SWIRL_PAINT, T.SWIRL_CLOUD + 1);
    swirlTint.uHaze.value = PALETTES.at(-1).w;
    swirlTint.uTintOn.value = 1;
  }

  function build(world) {
    const decor = world.swirl.decor;
    st = { world, objects: [], w: Object.fromEntries(IDS.map(i => [i, 0])), fog: new THREE.Color(), near: 44, far: 125, lit: 1, acc: 99, phase: 0, t: 0,
      dome: null, puffs: null, sparks: null, frames: null, wheels: null, uniforms: { uTime: { value: 0 } }, wheelBase: [], frameBase: [], spiral: null, first: true };
    feedTint();
    const add = (o, order) => { o.userData.swirlSky = true; o.frustumCulled = false; if (order != null) o.renderOrder = order; scene.add(o); st.objects.push(o); return o; };

    // 1. The dome
    const dg = new THREE.SphereGeometry(180, 48, 24);
    dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dg.attributes.position.count * 3), 3));
    st.dome = add(new THREE.Mesh(dg, new THREE.ShaderMaterial({ // plain colours, no lighting, no colour-space work: the cheapest full-screen pass (the values are screen colours already)
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'attribute vec3 color; varying vec3 vC; void main() { vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vC; void main() { gl_FragColor = vec4(vC, 1.0); }',
    })), 100); // drawn after the blocks: only the sky pixels are shaded
    st.dir = Array.from({ length: dg.attributes.position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(dg.attributes.position, i).normalize());

    // 2. Glowing nebula puffs: one mesh of camera-facing quads (not GL points: their size is capped on many GPUs), a bob and a soft fade up close
    const puffs = decor.puffs.slice(0, MAX_PUFFS);
    st.puffs = add(sprites(puffs, {
      size: p => 20 * p.size, opacity: 0.8, maxAngle: 0.3,
      motion: 'c.y += sin(uTime * 0.3 + aPhase * 6.2831) * 1.5;', fade: [16, 32], uTime: st.uniforms.uTime,
    }), 3);
    st.puffs.userData.count = puffs.length;

    // 3. Sparkles: fireflies wander, paint drops rise (all motion in the shader)
    const sparks = decor.sparks.slice(0, MAX_SPARKS);
    st.sparks = add(sprites(sparks, {
      size: () => 0.36, opacity: 1, additive: true,
      motion: `float rise = mod(uTime * 0.7 + aPhase * 14.0, 14.0);
        if (aKind > 0.5) { c.y += rise; vFade = 1.0 - rise / 14.0; }
        else c += vec3(sin(uTime * 0.5 + aPhase * 40.0), sin(uTime * 0.7 + aPhase * 23.0) * 0.7, cos(uTime * 0.4 + aPhase * 31.0)) * 0.6;
        s *= (0.65 + 0.35 * sin(uTime * 2.0 + aPhase * 50.0)) * (0.3 + 0.7 * vFade);`,
      fade: [1.5, 6], uTime: st.uniforms.uTime,
    }), 4);
    st.sparks.userData.count = sparks.length;

    // 4. Escaped frames (one instanced mesh) and spinning swirl-wheels (another)
    const fl = decor.floaters.filter(f => f.kind === 'frame'), wl = decor.floaters.filter(f => f.kind === 'wheel');
    st.frames = add(new THREE.InstancedMesh(frameGeometry(), new THREE.MeshLambertMaterial({ emissive: 0x2a2a30, fog: true }), fl.length), 2);
    fl.forEach((f, i) => { st.frames.setColorAt(i, new THREE.Color(FRAME_COLORS[f.c % FRAME_COLORS.length])); st.frameBase.push({ ...f, s: Math.max(f.w, f.h) / 4, roll: f.w > f.h ? Math.PI / 2 : 0, ax: new THREE.Vector3(Math.sin(i * 1.7), 1, Math.cos(i * 2.3)).normalize(), sp: 0.15 + (i % 4) * 0.05, ph: i * 0.9 }); });
    st.frames.userData.count = fl.length;
    st.spiral = spiralTexture();
    st.wheels = add(new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.15, 24), new THREE.MeshBasicMaterial({ map: st.spiral, fog: true }), wl.length), 2);
    const centre = new THREE.Vector3(80, 0, 80);
    wl.forEach(w => {
      const dir = new THREE.Vector3(centre.x - w.x, 0, centre.z - w.z).normalize();
      st.wheelBase.push({ ...w, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir) });
    });
    st.wheels.userData.count = wl.length;
    updateFloaters(0);
  }

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  function updateFloaters(t) {
    st.frameBase.forEach((f, i) => {
      Q.setFromAxisAngle(f.ax, t * f.sp + f.ph); Q2.setFromAxisAngle(new THREE.Vector3(0, 0, 1), f.roll); Q.multiply(Q2);
      P.set(f.x, f.y + Math.sin(t * 0.4 + f.ph) * 0.6, f.z); S.setScalar(f.s);
      st.frames.setMatrixAt(i, M.compose(P, Q, S));
    });
    st.frames.instanceMatrix.needsUpdate = true;
    st.wheelBase.forEach((w, i) => {
      Q2.setFromAxisAngle(Y, t * 0.6 + i); Q.copy(w.q).multiply(Q2);
      P.set(w.x, w.y + Math.sin(t * 0.5 + i) * 0.5, w.z); S.setScalar(w.r);
      st.wheels.setMatrixAt(i, M.compose(P, Q, S));
    });
    st.wheels.instanceMatrix.needsUpdate = true;
  }

  const c3 = [0, 0, 0];
  // The dome's colours for a camera at (cx, cz): the horizon is the fog colour, the sky above takes the palettes of the places it looks towards.
  function paintDome(cx, cz) {
    const col = st.dome.geometry.attributes.color, F = st.fogRgb, ph = st.phase;
    for (let i = 0; i < st.dir.length; i++) {
      const d = st.dir[i], h = d.y;
      let r;
      if (h <= 0.04) r = F;
      else {
        const hz = Math.hypot(d.x, d.z) || 1, k = 70 * (1 - clamp01(h));
        const w = zoneWeights(cx + d.x / hz * k, cz + d.z / hz * k);
        const P = key => { c3[0] = c3[1] = c3[2] = 0; PARSED.forEach((p, j) => { const a = w[IDS[j]]; c3[0] += p[key][0] * a; c3[1] += p[key][1] * a; c3[2] += p[key][2] * a; }); return c3.slice(); };
        const top = P('top'), mid = P('mid'), band = P('band'), bA = P('blobA'), bB = P('blobB');
        r = mixc(F, mid, ss(0.04, 0.3, h)); r = mixc(r, top, ss(0.3, 0.9, h));
        const az = Math.atan2(d.z, d.x), b = 0.5 + 0.5 * Math.sin(3 * az + 10 * h * h + ph);
        r = mixc(r, band, 0.3 * ss(0.55, 1, b) * (1 - ss(0.75, 1, h)) * ss(0.02, 0.12, h));
        BLOB_DIRS.forEach((B, j) => { const dot = Math.max(0, d.x * B[0] + h * B[1] + d.z * B[2]); r = mixc(r, j % 2 ? bB : bA, 0.55 * dot ** SKY_BLOBS[j][2] * ss(0.02, 0.1, h)); });
      }
      col.setXYZ(i, r[0], r[1], r[2]);
    }
    col.needsUpdate = true;
  }

  // The eased zone weights, fog, brightness (call every frame, right after updateSky).
  function target() {
    const p = camera.position, tw = zoneWeights(p.x, p.z);
    return tw;
  }
  function blend(w) {
    const fog = [0, 0, 0]; let lit = 0, near = 0, far = 0;
    PARSED.forEach((p, j) => { const a = w[IDS[j]]; fog[0] += p.fog[0] * a; fog[1] += p.fog[1] * a; fog[2] += p.fog[2] * a; lit += p.lit * a; near += p.fogNear * a; far += p.fogFar * a; });
    st.fogRgb = fog; srgb(st.fog, fog); st.lit = lit; st.near = near; st.far = far;
  }

  const self = {
    // A new world was made: build the Swirl's sky if it is the Swirl (a realm look with zones), else make sure nothing is left.
    reset(world) {
      dispose();
      toldZone.clear();
      if (!world?.realm?.look?.zones || !world.swirl || !scene) return;
      build(world);
      self.snap();
    },
    // Jump to the weights of where the camera is (no easing), repaint the sky.
    snap() {
      if (!st) return;
      Object.assign(st.w, target());
      blend(st.w); paintDome(camera.position.x, camera.position.z);
      st.acc = 0; st.dominant = IDS.reduce((a, k) => (st.w[k] > st.w[a] ? k : a), 'haze');
    },
    update(dt, now) {
      if (!st) return;
      const cp = camera.position; // a jump (the arrival, a lift's top, a teleport): no easing, the sky is right at once
      if (st.first || !st.last || Math.hypot(cp.x - st.last.x, cp.z - st.last.z) > 12) { self.snap(); if (st.first) { st.first = false; toldZone.add(st.dominant); } } // the zone you arrive in is not announced
      st.last = st.last || new THREE.Vector3(); st.last.copy(cp);
      st.t += dt; st.uniforms.uTime.value = now / 1000; swirlTint.uTime.value = now / 1000;
      const tw = target(), e = Math.min(1, dt * 1.5);
      let moved = 0;
      for (const k of IDS) { const d = (tw[k] - st.w[k]) * e; st.w[k] += d; moved += Math.abs(d); }
      blend(st.w);
      st.phase += dt * 0.03; st.acc += dt;
      if (st.acc > 0.25 || moved > 0.01) { st.acc = 0; paintDome(camera.position.x, camera.position.z); }
      st.dome.position.copy(camera.position);
      updateFloaters(st.t);
      // zone names, once per trip
      for (const z of ZONES) {
        if (st.w[z.id] > 0.6 && !toldZone.has(z.id)) { toldZone.add(z.id); if (game.started && !game.inBattle) game.ui.toast(z.name); }
      }
    },
    get fog() { return st ? st.fog : null; },
    get near() { return st ? st.near : null; },
    get far() { return st ? st.far : null; },
    get lit() { return st ? st.lit : null; },
    info() {
      if (!st) return null;
      const zone = IDS.reduce((a, k) => (st.w[k] > st.w[a] ? k : a), 'haze');
      return { zone, weights: { ...st.w }, lit: st.lit, fog: st.fog.getHex(), near: st.near, far: st.far,
        objects: { dome: 1, puffs: st.puffs.userData.count, sparks: st.sparks.userData.count, frames: st.frames.userData.count, wheels: st.wheels.userData.count } };
    },
  };
  return self;
}
