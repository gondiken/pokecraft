// T45: the Sketchbook's pencil look, switched on only while a sketch world is loaded (a realm whose look has `sketch`).
//  - game.sketch swaps the block materials' map to the pencil atlas (sketchatlas.js, made once, lazily on the first visit) and back,
//    sets the shared uniforms (caves.js sketchLook) and boils the lines 4 times a second.
//  - sketchModel(group) patches the materials of a creature / person model so it is drawn in pencil too (in place, never swapped:
//    tintModel's hit flashes and the colour code hold references to them). Models are rebuilt for every world and battle, so
//    nothing patched ever reaches another place.
// With the switch off nothing here changes what is drawn (the spec proves it bit for bit).
import * as THREE from 'three';
import { sketchLook } from './caves.js';
import { drawSketchAtlas, drawSketchMarks, ROTATE_KINDS } from './sketchatlas.js';

let active = false; // a sketch world is loaded (module flag read by sketchModel)

const MODEL_PARS = `varying vec2 vSk;
varying vec3 vSkN;
varying vec3 vSkV;
uniform float uSketchOn;
uniform float uSketchStep;
uniform vec3 uPaper;
uniform vec3 uInk;
float skmH(float a, float b) { return fract(sin(a * 127.1 + b * 311.7) * 43758.5453); }
// one layer of screen-space hatching (pixels): broken, tapered pencil strokes across q.x; frac = the share of strokes drawn
float skmHatch(vec2 q, float per, float frac, float seed, float st) {
  if (frac <= 0.0) return 0.0;
  float i = floor(q.x / per), hi = skmH(i, seed);
  if (hi > frac) return 0.0;
  float along = q.y / 22.0 + hi * 5.0 + st * 0.13, t = fract(along), j = floor(along), hj = skmH(i + j * 17.0, seed + 2.0);
  float a0 = 0.03 + 0.3 * hj, a1 = 0.6 + 0.38 * skmH(j + 3.0, i + seed);
  float taper = smoothstep(a0, a0 + 0.1, t) * (1.0 - smoothstep(a1 - 0.1, a1, t));
  float c = (i + 0.5 + 0.3 * (hj - 0.5)) * per;
  return clamp((0.55 + 0.35 * hj) * taper + 0.5 - abs(q.x - c), 0.0, 1.0);
}`;
// Look v2: paper fill, hatching where the model is darker (its own colour and the light on it), solid graphite for very dark parts (eyes),
// bold wobbly outlines on box edges (from the box's uv) and round the silhouette of round parts (where the surface turns away from you).
function modelFrag(box, emissive) {
  return `
  if (uSketchOn > 0.5) {
    float base = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float lit = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    float shade = clamp(lit / max(base, 0.02), 0.0, 1.4);
    float D = clamp((0.62 - base) * 0.95 + (0.92 - shade) * 0.95, 0.0, 1.0);
    vec2 sp = gl_FragCoord.xy, q1 = vec2(sp.x + sp.y, sp.x - sp.y) * 0.7071, q2 = vec2(sp.x - sp.y, sp.x + sp.y) * 0.7071;
    float hatch = max(skmHatch(q1, 4.5, smoothstep(0.12, 0.5, D), 1.0, uSketchStep), skmHatch(q2, 5.0, smoothstep(0.55, 0.85, D), 2.0, uSketchStep));
    vec3 c = mix(uPaper, uInk, 0.7 * hatch);
    float solid = smoothstep(0.075, 0.03, base); // eyes, mouths, very dark small parts: solid graphite
    float edge = 0.0;
    ${box ? `vec2 wv = max(fwidth(vSk), vec2(0.0001));
    float face = min(1.0 / wv.x, 1.0 / wv.y); // the face's size in pixels: tiny boxes (far away, or little parts) get only a thin line
    solid *= 1.0 - 0.75 * smoothstep(16.0, 40.0, face); // a big dark part (a hat, boots) is cross-hatched, not filled in
    vec2 dd = min(vSk, 1.0 - vSk) / wv - 0.7 * sin(vec2(vSk.y, vSk.x) * 9.0 + uSketchStep * 1.7);
    float lw = clamp(face * 0.045, 0.6, 3.4);
    edge = (1.0 - smoothstep(lw, lw + 1.0, min(dd.x, dd.y))) * smoothstep(3.0, 9.0, face);` : `float ndv = abs(dot(normalize(vSkN), normalize(vSkV)));
    edge = 1.0 - smoothstep(0.2, 0.36, ndv);`}
    c = mix(c, uInk * 1.05, solid);
    c = mix(c, uInk * 0.95, 0.92 * edge);
    ${emissive ? 'c += totalEmissiveRadiance * 0.8;' : ''}
    gl_FragColor.rgb = c;
  }`;
}

function patchModelMaterial(m, box) {
  if (!m || m.userData.sketched) return;
  m.userData.sketched = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  const emissive = !!m.emissive;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    Object.assign(shader.uniforms, sketchLook);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSk;\nvarying vec3 vSkN;\nvarying vec3 vSkV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSk = uv;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSkV = -mvPosition.xyz;\nvSkN = normalize(normalMatrix * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MODEL_PARS}`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>${modelFrag(box, emissive)}`);
  };
  m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ''}${box ? 'sketch-model-box-2' : 'sketch-model-2'}${emissive ? 'E' : ''}`;
  m.needsUpdate = true;
}

// Draws a creature / person model in pencil (a no-op unless a sketch world is loaded). Skips lines, points, sprites, meshes marked
// `userData.keepColour` (the yellow crayon star) and materials without lighting maths we can patch.
export function sketchModel(group) {
  if (!active || !group) return;
  const boxy = new Map(); // material -> true when a BoxGeometry mesh uses it (outlines from the box's uv)
  group.traverse(o => {
    if (!o.isMesh || o.isLine || o.isPoints || o.isSprite || o.userData?.keepColour) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || m.isShaderMaterial) continue;
      boxy.set(m, boxy.get(m) || o.geometry?.type === 'BoxGeometry');
    }
  });
  for (const [m, box] of boxy) patchModelMaterial(m, box);
}

export function createSketch(game, { materials, texture, atlas }) {
  let sketchTexture = null;
  let hold = false, step = 0;
  const maps = ['solid', 'water', 'glow'];
  const api = {
    get on() { return active; },
    get hold() { return hold; },
    set hold(v) { hold = !!v; },
    get texture() { return sketchTexture; },
    // The pencil atlas: made once, the first time a sketch world is loaded.
    ensureTexture() {
      if (sketchTexture) return sketchTexture;
      const t0 = performance.now();
      sketchTexture = new THREE.CanvasTexture(drawSketchAtlas(atlas));
      sketchTexture.magFilter = THREE.NearestFilter;
      sketchTexture.minFilter = THREE.NearestFilter;
      sketchTexture.generateMipmaps = false;
      sketchTexture.colorSpace = THREE.NoColorSpace; // look v2: a data atlas (kind, tone, detail, alpha): the bytes as they are
      // look v2: the doodled marks of every kind (one 96 px cell each, alpha only), smooth and mipmapped so they fade with distance
      const marks = new THREE.CanvasTexture(drawSketchMarks());
      marks.colorSpace = THREE.NoColorSpace;
      marks.minFilter = THREE.LinearMipmapLinearFilter;
      marks.magFilter = THREE.LinearFilter;
      marks.generateMipmaps = true;
      sketchLook.uSketchMarks.value = marks;
      sketchLook.uSketchRot.value = ROTATE_KINDS;
      api.drawMs = performance.now() - t0;
      return sketchTexture;
    },
    // Called with every new world (createWorld): switches the look on for a sketch world, off for every other.
    reset(world) {
      const look = world?.realm?.look?.sketch;
      active = !!look;
      for (const k of maps) {
        const m = materials[k];
        m.map = active ? api.ensureTexture() : texture;
        // look v2: the pencil code is compiled in only here (the SKETCH define), so every other world runs the plain, short shader.
        // Its program is made on the first visit and dropped again when you leave (three.js keeps a program while it is used).
        if (active !== !!m.defines?.SKETCH) {
          if (active) m.defines = { ...(m.defines || {}), SKETCH: 1 };
          else { const { SKETCH, ...rest } = m.defines; m.defines = rest; }
          m.needsUpdate = true;
        }
      }
      sketchLook.uSketchOn.value = active ? 1 : 0;
      if (active) {
        sketchLook.uPaper.value.setHex(look.paper);
        sketchLook.uInk.value.setHex(look.ink);
        const [x, z, r0, r1] = look.edge;
        sketchLook.uSketchEdge.value.set(x, z, r0, r1);
        step = 0; sketchLook.uSketchStep.value = 0;
      } else sketchLook.uSketchEdge.value.set(0, 0, 1e9, 1e9);
    },
    // The boil: the lines jump a little 4 times a second; frozen while paused (and with hold, for tests).
    update(dt, now) {
      if (!active || hold) return;
      if (!(game.playing?.() || game.inBattle)) return;
      const s = Math.floor(now / 250) % 64;
      if (s !== step) { step = s; sketchLook.uSketchStep.value = s; }
    },
    info() { return { on: active, step: sketchLook.uSketchStep.value, drawMs: api.drawMs ?? null, texture: sketchTexture ? (materials.solid.map === sketchTexture ? 'sketch' : 'colour') : 'colour' }; },
  };
  return api;
}
