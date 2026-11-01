// Owner 2026-11-01: Doodle creatures look like drawings everywhere, not only in the Sketchbook. `doodleInk(group)` patches a Doodle model's
// materials once (buildModel calls it for every Doodle species) so they keep their own colours but get bold wobbly pencil outlines on
// the box edges (round the silhouette of non-box parts) and light pencil hatching on their shady side: half way between a normal model
// and the Sketchbook's full pencil drawing. In the Sketchbook sketch.js chains its full pencil patch over this one and switches this one
// off (`DOODLE_INK.uDoodleInk` = 0) while the sketch look is on, so it is drawn exactly as before there. Imports only three.
import * as THREE from 'three';

export const DOODLE_INK = { uDoodleInk: { value: 1 } }; // 1 = draw the ink; sketch.js sets 0 while a sketch world is loaded

const PARS = `varying vec2 vDk;
varying vec3 vDkN;
varying vec3 vDkV;
uniform float uDoodleInk;
float dkH(float a, float b) { return fract(sin(a * 127.1 + b * 311.7) * 43758.5453); }
// one layer of screen-space hatching (pixels): broken, tapered strokes across q.x; frac = the share of strokes drawn
float dkHatch(vec2 q, float per, float frac) {
  if (frac <= 0.0) return 0.0;
  float i = floor(q.x / per), hi = dkH(i, 1.0);
  if (hi > frac) return 0.0;
  float along = q.y / 22.0 + hi * 5.0, t = fract(along), j = floor(along), hj = dkH(i + j * 17.0, 3.0);
  float a0 = 0.03 + 0.3 * hj, a1 = 0.6 + 0.38 * dkH(j + 3.0, i + 1.0);
  float taper = smoothstep(a0, a0 + 0.1, t) * (1.0 - smoothstep(a1 - 0.1, a1, t));
  float c = (i + 0.5 + 0.3 * (hj - 0.5)) * per;
  return clamp((0.55 + 0.35 * hj) * taper + 0.5 - abs(q.x - c), 0.0, 1.0);
}`;

function frag(box) {
  return `
  if (uDoodleInk > 0.5) {
    vec3 ink = vec3(0.17, 0.17, 0.21);
    float base = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float lit = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    float shade = clamp(lit / max(base, 0.02), 0.0, 1.4);
    vec2 sp = gl_FragCoord.xy, q = vec2(sp.x + sp.y, sp.x - sp.y) * 0.7071;
    float hatch = dkHatch(q, 4.5, smoothstep(0.2, 0.6, 0.9 - shade));
    vec3 c = mix(gl_FragColor.rgb, ink, 0.5 * hatch);
    float edge = 0.0;
    ${box ? `vec2 wv = max(fwidth(vDk), vec2(0.0001));
    float face = min(1.0 / wv.x, 1.0 / wv.y); // the face's size in pixels: little or far boxes get only a thin line, or none
    vec2 dd = min(vDk, 1.0 - vDk) / wv - 0.7 * sin(vec2(vDk.y, vDk.x) * 9.0);
    float lw = clamp(face * 0.04, 0.6, 3.0);
    edge = (1.0 - smoothstep(lw, lw + 1.0, min(dd.x, dd.y))) * smoothstep(3.0, 9.0, face);` : `float ndv = abs(dot(normalize(vDkN), normalize(vDkV)));
    edge = 1.0 - smoothstep(0.2, 0.36, ndv);`}
    c = mix(c, ink, 0.9 * edge);
    gl_FragColor.rgb = c;
  }`;
}

function patch(m, box) {
  if (!m || m.userData.doodleInk) return;
  m.userData.doodleInk = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    Object.assign(shader.uniforms, DOODLE_INK);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDk;\nvarying vec3 vDkN;\nvarying vec3 vDkV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDk = uv;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDkV = -mvPosition.xyz;\nvDkN = normalize(normalMatrix * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>${frag(box)}`);
  };
  m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ''}${box ? 'doodle-ink-box' : 'doodle-ink'}`;
  m.needsUpdate = true;
}

// Patches every lit mesh of a model (lines, points, sprites and unlit materials are left as they are).
export function doodleInk(group) {
  const boxy = new Map();
  group.traverse(o => {
    if (!o.isMesh || o.isLine || o.isPoints || o.isSprite) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || m.isShaderMaterial || m.isMeshBasicMaterial) continue;
      boxy.set(m, boxy.get(m) || o.geometry?.type === 'BoxGeometry');
    }
  });
  for (const [m, box] of boxy) patch(m, box);
  return group;
}
