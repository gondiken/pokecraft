// T45: the Sketchbook's pencil look, switched on only while a sketch world is loaded (a realm whose look has `sketch`).
//  - game.sketch swaps the block materials' map to the pencil atlas (sketchatlas.js, made once, lazily on the first visit) and back,
//    sets the shared uniforms (caves.js sketchLook) and boils the lines 4 times a second.
//  - sketchModel(group) patches the materials of a creature / person model so it is drawn in pencil too (in place, never swapped:
//    tintModel's hit flashes and the colour code hold references to them). Models are rebuilt for every world and battle, so
//    nothing patched ever reaches another place.
// With the switch off nothing here changes what is drawn (the spec proves it bit for bit).
import * as THREE from 'three';
import { sketchLook } from './caves.js';
import { MODEL_LOOK, patchModelMaterial } from './doodleink.js'; // the pencil model shader (shared with the Doodle creatures, drawn in pencil everywhere)
import { drawSketchAtlas, drawSketchMarks, ROTATE_KINDS } from './sketchatlas.js';

let active = false; // a sketch world is loaded (module flag read by sketchModel)

// Draws a creature / person model in pencil (a no-op unless a sketch world is loaded). Skips lines, points, sprites, meshes marked
// `userData.keepColour` and materials without lighting maths we can patch.
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
  for (const [m, box] of boxy) patchModelMaterial(m, box, false);
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
      MODEL_LOOK.uSketchOn.value = active ? 1 : 0; MODEL_LOOK.uDim.value = active ? 0 : 1; // models: pencil for everyone here; elsewhere only Doodle creatures, in the world's light
      if (active) {
        sketchLook.uPaper.value.setHex(look.paper);
        sketchLook.uInk.value.setHex(look.ink);
        MODEL_LOOK.uPaper.value.setHex(look.paper); MODEL_LOOK.uInk.value.setHex(look.ink);
        const [x, z, r0, r1] = look.edge;
        sketchLook.uSketchEdge.value.set(x, z, r0, r1);
        step = 0; sketchLook.uSketchStep.value = 0; MODEL_LOOK.uSketchStep.value = 0;
      } else sketchLook.uSketchEdge.value.set(0, 0, 1e9, 1e9);
    },
    // The boil: the lines jump a little 4 times a second; frozen while paused (and with hold, for tests).
    update(dt, now) {
      if (hold || !(game.playing?.() || game.inBattle)) return;
      const s = Math.floor(now / 250) % 64;
      if (s === step) return;
      step = s; MODEL_LOOK.uSketchStep.value = s; // Doodle creatures' lines boil in every world (owner 2026-11-01)
      if (active) sketchLook.uSketchStep.value = s;
    },
    info() { return { on: active, step: sketchLook.uSketchStep.value, drawMs: api.drawMs ?? null, texture: sketchTexture ? (materials.solid.map === sketchTexture ? 'sketch' : 'colour') : 'colour' }; },
  };
  return api;
}
