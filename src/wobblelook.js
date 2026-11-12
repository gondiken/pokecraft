// Chapter 3 (plans/chapter3-world.md section 2, step 4): Wobbleland's look. Everything is behind the WOBBLE material define, which this
// file sets only while Wobbleland is loaded (like the Sketchbook's SKETCH), so every other world renders exactly as before.
//   the curl:   the page bends up with distance, like a sheet of paper curling at its edges (the opposite of a planet). Near you the
//               ground is flat (nothing before `curlFrom` blocks moves), so walking, aiming and the fight are unchanged. ONE switch:
//               WOBBLE_LOOK.curl (false = a flat page; the pause screen's 📄 button flips it for this session, ?preview only).
//   first-draft colours: louder, a bit lemony, chunky outlines on block edges (WOBBLE_LOOK.draft / sat / line).
//   the Scribble's grey: grey with scribble strokes wherever it still is; a cleared patch floods its colours back out in a circle that
//               grows over `flood` s; the Camp is always in colour; the whole region once its knot is cleared.
// Models (creatures, people, the patches' tangles) are lifted by the same curl just before each frame is drawn (beforeRender /
// afterRender in main.js), so nothing far away sinks into the curled ground.
import * as THREE from 'three';
import { wobbleLook as U, caveLight } from './caves.js';
import { PATCHES, CAMP, patchKey, REGIONS, SIZE, regionState, regionAt, RIVER_UP, CHUTES, LEADS, inCave, darkIn, CAVE } from './wobbleland.js';
import { GROUND } from './groundrules.js'; // Glowcap Caves: how far your light reaches (Dark.sight)
import { SPECIES } from './species.js';
import { B } from './blocks.js';
import { createWobbleSky } from './wobblesky.js'; // C3: a child's sky

export const WOBBLE_LOOK = {
  curl: true,          // the curling horizon: the one on/off switch
  curlFrom: 28,        // blocks from you where the page starts to bend up
  curlK: 0.0025,
  sky: true,           // C3: the child's sky (wobblesky.js): crayon dome, smiling sun, clouds on strings
  jig: 0.12,           // C1: every block corner moves up to this far sideways (half that up or down): hand-drawn edges (0 = straight)       // lift = curlK x (distance - curlFrom)^2: at 60 blocks 2.6 up, at 100 about 13, at 150 about 37
  draft: [1.07, 1.05, 0.86], sat: 1.45, line: 0.35,
  crayon: 0.4,         // C2: how much paper shows through the crayon on coloured-in land (0 = flat colour) // the first-draft colours: tint, saturation, outline darkness
  cell: 4,             // the colour map: one texel per cell x cell blocks
  cleared: 17,         // a cleared patch colours a circle this big round its middle
  camp: CAMP.r + 6,    // the Camp is always in colour
  splat: 4.5,          // A2: a popped scribble bug colours a circle this big (this visit only)
  flood: 2,            // seconds the colour takes to flood out
  // Glowcap Caves (owner 2026-11-11: "properly dark", like the test arena's Dark Cave): no daylight inside (wobbleland.js skyDim), only
  // your creature's light (`light` = its strength, 0 = none: the cave is then black but for glowing things) in its type's colour
  // (`colours`; `plain` for a creature that does not glow); the fog closes in black while you are inside (`fog`: colour, near, far)
  light: 1.1, plain: 0xffe2b8, colours: { fire: 0xffa860, light: 0xfff0b0, electric: 0xbfe0ff, cosmic: 0xd4b0ff },
  fog: [0x06060a, 10, 46], fogEase: 0.8,
  caveLit: 0.55,       // a cleared part of the cave has this much light of its own (owner 2026-11-12: "like how the regular caves were")
};
export const curlLift = d => (WOBBLE_LOOK.curl ? WOBBLE_LOOK.curlK * Math.max(0, d - WOBBLE_LOOK.curlFrom) ** 2 : 0);

export function createWobbleLook(game, { materials, scene, camera }) {
  const N = SIZE / WOBBLE_LOOK.cell, data = new Uint8Array(N * N * 4);
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.NoColorSpace;
  U.uWobColour.value = tex;
  let active = false, world = null, floods = [], sig = '', lifted = [], ice = new Uint8Array(N * N), shade = new Uint8Array(N * N), under = 0;
  const FOG = new THREE.Color();
  // Glowcap Caves: the share of each cell's columns inside the cave (where your creature's light shines)
  function shadeMap() {
    shade.fill(0);
    for (let x = CAVE.x0; x <= CAVE.x1; x++) for (let z = CAVE.z0; z <= CAVE.z1; z++) if (inCave(x, z)) shade[Math.floor(x / WOBBLE_LOOK.cell) + Math.floor(z / WOBBLE_LOOK.cell) * N] += 255 / (WOBBLE_LOOK.cell * WOBBLE_LOOK.cell);
  }
  // Slippy Lake: which cells have ice on top (the shader draws it as ice even under the Scribble's grey)
  function iceMap() {
    ice.fill(0);
    if (!world?.get) return;
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
      const y = world.ground?.[x + z * world.W];
      if (y != null && world.get(x, y, z) === B.ICE) ice[Math.floor(x / WOBBLE_LOOK.cell) + Math.floor(z / WOBBLE_LOOK.cell) * N] = 255;
    }
  }
  let btn = null, shown = null, sky = null, splats = [];
  const mats = ['solid', 'water', 'glow'];
  // how coloured a texel's middle is (0..1): the Camp, cleared patches (a flood grows from 0 to its radius), cleared regions
  function paint() {
    const keys = new Set(game.beaten || []);
    const bright = new Set(PATCHES.filter(p => p.last && keys.has(patchKey(p.id))).map(p => p.region)); // a region whose knot is cleared is all in colour
    const river = []; // the floating river is always in colour (a child must see it is water to step in)
    for (let z = RIVER_UP.z1; z <= RIVER_UP.z0; z += 4) river.push([(RIVER_UP.x0 + RIVER_UP.x1 + 1) / 2, z, 4]);
    for (const c of [...CHUTES, ...LEADS]) for (let z = Math.min(c.z0, c.z1); z <= Math.max(c.z0, c.z1); z += 4) river.push([(c.x0 + c.x1 + 1) / 2, z, 3.5]); // (Slippy Lake's chutes and leads too)
    const circles = [[CAMP.x, CAMP.z, WOBBLE_LOOK.camp], ...river, ...splats.map(([x, z]) => [x, z, WOBBLE_LOOK.splat])];
    for (const p of PATCHES) if (keys.has(patchKey(p.id))) {
      const f = floods.find(q => q.id === p.id);
      circles.push([p.x, p.z, WOBBLE_LOOK.cleared * (f ? Math.min(1, f.t / WOBBLE_LOOK.flood) : 1)]);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * WOBBLE_LOOK.cell, z = (j + 0.5) * WOBBLE_LOOK.cell;
      let v = bright.has(regionAt(x, z)) ? 1 : 0;
      for (const [cx, cz, r] of circles) if (r > 0) v = Math.max(v, Math.min(1, Math.max(0, (r - Math.hypot(x - cx, z - cz)) / 3)));
      const k = (i + j * N) * 4;
      data[k] = Math.round(v * 255); data[k + 1] = ice[i + j * N]; data[k + 2] = shade[i + j * N]; data[k + 3] = 255; // (g: Slippy Lake's ice, b: Glowcap Caves' inside, for their looks)
    }
    tex.needsUpdate = true;
  }
  function setDefine(on) {
    for (const k of mats) {
      const m = materials[k];
      if (!m || on === !!m.defines?.WOBBLE) continue;
      if (on) m.defines = { ...(m.defines || {}), WOBBLE: 1 };
      else { const { WOBBLE, ...rest } = m.defines; m.defines = rest; }
      m.needsUpdate = true;
    }
  }
  function uniforms() {
    U.uCurl.value = active && WOBBLE_LOOK.curl ? WOBBLE_LOOK.curlK : 0;
    U.uCurlFrom.value = WOBBLE_LOOK.curlFrom;
    U.uWobJig.value = active ? WOBBLE_LOOK.jig : 0;
    U.uDraft.value.set(...WOBBLE_LOOK.draft); U.uWobSat.value = WOBBLE_LOOK.sat; U.uWobLine.value = WOBBLE_LOOK.line; U.uWobCrayon.value = WOBBLE_LOOK.crayon;
    U.uWobSize.value.set(SIZE, SIZE);
    if (!active) { U.uWobLight.value.w = 0; U.uWobFlash.value.w = 0; return; }
    // the light: round your creature in a fight in the dark (scribble.js), else round you; its radius = your creature's sight, its
    // colour your creature's type's
    const L = game.scribble?.light?.(), p = game.player?.pos;
    if (L) { U.uWobLight.value.set(L.x, L.z, L.r, WOBBLE_LOOK.light); U.uWobFlash.value.set(L.flash?.x ?? 0, L.flash?.z ?? 0, L.flash?.r ?? 0, L.flash ? L.flash.k : 0); }
    else { U.uWobLight.value.set(p?.x ?? 0, p?.z ?? 0, api.sight(), WOBBLE_LOOK.light); U.uWobFlash.value.w = 0; }
    U.uWobCleared.value = WOBBLE_LOOK.caveLit;
    U.uWobWarm.value.setHex(WOBBLE_LOOK.colours[L ? L.type : api.lightType()] ?? WOBBLE_LOOK.plain);
  }
  const api = {
    get on() { return active; },
    // with every new world (createWorld): on in Wobbleland, off everywhere else
    reset(w) {
      if (active && !w?.realm?.look?.wobble) game.ui?.setScore?.(null); // leaving: the meter goes
      world = w; active = !!w?.realm?.look?.wobble;
      setDefine(active); floods = []; sig = ''; splats = [];
      sky?.dispose(); sky = null;
      if (active && WOBBLE_LOOK.sky) sky = createWobbleSky(scene);
      uniforms();
      if (active) { iceMap(); shadeMap(); paint(); }
      under = 0;
    },
    // a patch was just cleared: its colour floods out (the key is already in game.beaten)
    flood(id) { if (!active) return; floods = floods.filter(f => f.id !== id); floods.push({ id, t: 0 }); },
    // A2: a popped scribble bug leaves a little splash of colour on the grey (this visit only)
    splat(x, z) { if (!active) return; splats.push([x, z]); paint(); },
    // the pause screen's switch (made once, shown only in Wobbleland): 📄 Page: curls / flat
    refresh() {
      if (typeof document === 'undefined') return;
      if (!btn) {
        const sound = document.getElementById('sound-btn');
        if (!sound) return;
        btn = document.createElement('button'); btn.id = 'curl-btn';
        btn.addEventListener('click', e => { e.stopPropagation(); api.toggleCurl(); api.refresh(); });
        sound.after(btn); sound.after(document.createTextNode(' '));
      }
      const s = active ? (WOBBLE_LOOK.curl ? '📄 Page: curls' : '📄 Page: flat') : '';
      if (s !== shown) { shown = s; btn.textContent = s; btn.classList.toggle('hidden', !s); }
    },
    // Glowcap Caves: whose light you carry on foot: your ride's type, else your first creature's; how far it reaches (Fire, Light,
    // Electric and Cosmic glow: twice as far)
    lightType() { return game.player?.ride?.type ?? SPECIES[game.party?.find(c => c && c.hp > 0)?.species ?? game.party?.[0]?.species]?.type ?? null; },
    sight() { return GROUND.dark.sight(api.lightType()); },
    update(dt) {
      api.refresh();
      if (!active) return;
      uniforms();
      const p = game.scribble?.fighting && game.scribble.light?.() ? game.scribble.light() : game.player?.pos;
      under += ((p && darkIn(p) ? 1 : 0) - under) * Math.min(1, dt / WOBBLE_LOOK.fogEase);
      sky?.update(dt, camera);
      const here = game.player ? regionAt(game.player.pos.x, game.player.pos.z) : 'meadow';
      if (REGIONS[here]?.soon && !game.toldOnce?.has(`wobble-${here}`)) { game.toldOnce?.add(`wobble-${here}`); game.ui?.toast(`🧙 ${REGIONS[here].name} is still being drawn. Coming soon!`); }
      const reg = REGIONS[here]?.soon ? 'meadow' : here, m = regionState(game.beaten, reg); // the region's meter (step 6): the one you are in
      if (!game.inBattle && !game.scribble?.fighting) game.ui?.setScore?.({ text: `🎨 ${m.name} ${m.n} / ${m.of}`, done: m.n >= m.of });
      const s = (game.beaten || []).filter(k => k.startsWith('pw:wobble:')).join();
      if (floods.length) { for (const f of floods) f.t += dt; paint(); floods = floods.filter(f => f.t < WOBBLE_LOOK.flood); }
      else if (s !== sig) paint();
      sig = s;
    },
    // models far away bend up with the page: lifted for one frame's drawing, put back right after it
    beforeRender() {
      lifted = [];
      if (active) caveLight.uLantern.value = 0; // (in Wobbleland the light is your creature's: wobLan in caves.js, not main.js' lantern)
      if (active && under > 0.01 && scene.fog) { // Glowcap Caves: inside, the fog closes in, black (main.js sets it again every frame)
        const pp = game.player?.pos, lit = pp ? api.colourAt(pp.x, pp.z) : 0; // (in a cleared part the fog is lighter and further: you see across it)
        const [c, n, f] = WOBBLE_LOOK.fog, k = Math.min(1, under * 1.25) * (1 - 0.6 * lit);
        scene.fog.color.lerp(FOG.setHex(c), k); scene.fog.near += (n - scene.fog.near) * k; scene.fog.far += (f - scene.fog.far) * k;
        if (scene.background?.isColor) scene.background.lerp(FOG, k);
      }
      if (sky?.group) sky.group.visible = !(active && under > 0.6); // (inside the cave: no sunny sky)
      if (!active || !WOBBLE_LOOK.curl) return;
      const cx = camera.position.x, cz = camera.position.z, own = new Set(mats.map(k => materials[k]));
      const lift = (o, depth) => {
        if (o.isCamera || o.isLight || o.userData?.noCurl || (o.isMesh && own.has(o.material))) return;
        // a container group left at the origin (the scribble fight, effects...): its children are where things are
        if (depth < 2 && o.children.length && !o.isMesh && Math.abs(o.position.x) + Math.abs(o.position.z) < 1e-6) { for (const c of o.children) lift(c, depth + 1); return; }
        // where the thing really is: a mesh left at the origin with its shape in world places (the fight's red warnings, the ring, the
        // patch decal) is where its geometry is, not at the map's corner (owner 2026-11-11: the warnings and the ring had vanished)
        // (many are rebuilt every frame, so their stored centre is stale): such a mesh is never lifted
        if (o.geometry && Math.abs(o.position.x) + Math.abs(o.position.z) < 1e-6) return;
        const l = curlLift(Math.hypot(o.position.x - cx, o.position.z - cz));
        if (l > 0.001) { o.position.y += l; lifted.push([o, l]); }
      };
      for (const o of scene.children) lift(o, 0);
    },
    afterRender() { for (const [o, l] of lifted) o.position.y -= l; lifted = []; },
    // ?preview: the pause screen's switch
    toggleCurl() { WOBBLE_LOOK.curl = !WOBBLE_LOOK.curl; uniforms(); return WOBBLE_LOOK.curl; },
    colourAt(x, z) { const i = Math.floor(x / WOBBLE_LOOK.cell), j = Math.floor(z / WOBBLE_LOOK.cell); return i < 0 || j < 0 || i >= N || j >= N ? 0 : data[(i + j * N) * 4] / 255; },
    info() { return { on: active, under: +under.toFixed(2), light: active ? U.uWobLight.value.toArray().map(v => +v.toFixed(2)) : null, curl: WOBBLE_LOOK.curl && active, jig: active ? WOBBLE_LOOK.jig : 0, sky: !!sky, floods: floods.length, defines: mats.map(k => !!materials[k]?.defines?.WOBBLE) }; },
  };
  return api;
}
