// Owner 2026-11-01: "I'd even prefer full drawing (same version as in sketchbook)": Doodle creatures are drawn in pencil in EVERY world,
// exactly as in the Sketchbook (paper fill, hatching, solid graphite for dark parts, bold wobbly outlines), only lit by the world's light
// outside it (`uDim`: shady sides and night are darker). This file holds the pencil model shader; sketch.js uses it for every model in the
// Sketchbook (`always` false: only while `uSketchOn`), buildModel for Doodle creatures (`doodleInk`, `always` true; sketchModel then skips
// them: one patch per material). The crayon star on their bodies is gone. Imports only three.
import * as THREE from 'three';

// The models' own uniform objects (block shaders keep caves.js sketchLook): sketch.js sets them on world changes and boils the step.
export const MODEL_LOOK = {
  uSketchOn: { value: 0 },
  uSketchStep: { value: 0 },
  uPaper: { value: new THREE.Color(0xf6f2e8) }, // the Sketchbook's paper and ink (REALMS.doodle.look.sketch)
  uInk: { value: new THREE.Color(0x3e3c46) },
  uDim: { value: 1 },                           // 1 outside the Sketchbook: the world's light darkens the drawing
};

const MODEL_PARS = `varying vec2 vSk;
varying vec3 vSkN;
varying vec3 vSkV;
uniform float uSketchOn;
uniform float uSketchStep;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform float uDim;
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
function modelFrag(box, emissive, always) {
  return `
  if (${always ? 'true' : 'uSketchOn > 0.5'}) {
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
    c *= mix(1.0, clamp(0.3 + 0.7 * shade, 0.3, 1.0), uDim); // outside the Sketchbook the drawing sits in the world's light (shady sides, night)
    ${emissive ? 'c += totalEmissiveRadiance * 0.8;' : ''}
    gl_FragColor.rgb = c;
  }`;
}

export function patchModelMaterial(m, box, always) {
  if (!m || m.userData.sketched) return;
  m.userData.sketched = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  const emissive = !!m.emissive;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    Object.assign(shader.uniforms, MODEL_LOOK);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSk;\nvarying vec3 vSkN;\nvarying vec3 vSkV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSk = uv;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSkV = -mvPosition.xyz;\nvSkN = normalize(normalMatrix * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MODEL_PARS}`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>${modelFrag(box, emissive, always)}`);
  };
  m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ''}${box ? 'sketch-model-box-2' : 'sketch-model-2'}${emissive ? 'E' : ''}${always ? 'A' : ''}`;
  m.needsUpdate = true;
}


// Draws a Doodle model in pencil (buildModel calls it for every Doodle species): lit meshes only; lines, points, sprites stay as they are.
export function doodleInk(group) {
  const boxy = new Map();
  group.traverse(o => {
    if (!o.isMesh || o.isLine || o.isPoints || o.isSprite || o.userData?.keepColour) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || m.isShaderMaterial) continue;
      boxy.set(m, boxy.get(m) || o.geometry?.type === 'BoxGeometry');
    }
  });
  for (const [m, box] of boxy) { patchModelMaterial(m, box, true); m.userData.doodleInk = true; }
  return group;
}
