// T45: the Sketchbook's pencil look, switched on only while a sketch world is loaded (a realm whose look has `sketch`).
//  - game.sketch swaps the block materials' map to the pencil atlas (sketchatlas.js, made once, lazily on the first visit) and back,
//    sets the shared uniforms (caves.js sketchLook) and boils the lines 4 times a second.
//  - sketchModel(group) patches the materials of a creature / person model so it is drawn in pencil too (in place, never swapped:
//    tintModel's hit flashes and the colour code hold references to them). Models are rebuilt for every world and battle, so
//    nothing patched ever reaches another place.
// With the switch off nothing here changes what is drawn (the spec proves it bit for bit).
import * as THREE from 'three';
import { sketchLook } from './caves.js';
import { drawSketchAtlas } from './sketchatlas.js';

let active = false; // a sketch world is loaded (module flag read by sketchModel)

const MODEL_PARS = `varying vec2 vSk;
uniform float uSketchOn;
uniform float uSketchStep;
uniform vec3 uPaper;
uniform vec3 uInk;`;
function modelFrag(box, emissive) {
  return `
  if (uSketchOn > 0.5) {
    float g = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 c = mix(uInk, uPaper, smoothstep(0.08, 0.9, g));
    float hz = fract((gl_FragCoord.x + gl_FragCoord.y) / 6.0 + uSketchStep * 0.3);
    float hatch = g < 0.55 ? (1.0 - smoothstep(0.12, 0.2, hz)) * 0.5 * (0.55 - g) / 0.55 : 0.0;
    c = mix(c, uInk, hatch);
    ${box ? `vec2 wv = max(fwidth(vSk), vec2(0.0001)); vec2 dd = min(vSk, 1.0 - vSk) / wv;
    float face = min(1.0 / wv.x, 1.0 / wv.y); // the face's size in pixels: small boxes (far away, or little parts) get no outline, so they do not turn black
    c = mix(c, uInk, 0.85 * smoothstep(7.0, 16.0, face) * (1.0 - smoothstep(0.8, 1.6, min(dd.x, dd.y))));` : ''}
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
      .replace('#include <common>', '#include <common>\nvarying vec2 vSk;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSk = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MODEL_PARS}`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>${modelFrag(box, emissive)}`);
  };
  m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ''}${box ? 'sketch-model-box' : 'sketch-model'}${emissive ? 'E' : ''}`;
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
      sketchTexture.colorSpace = THREE.SRGBColorSpace;
      api.drawMs = performance.now() - t0;
      return sketchTexture;
    },
    // Called with every new world (createWorld): switches the look on for a sketch world, off for every other.
    reset(world) {
      const look = world?.realm?.look?.sketch;
      active = !!look;
      for (const k of maps) materials[k].map = active ? api.ensureTexture() : texture;
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
