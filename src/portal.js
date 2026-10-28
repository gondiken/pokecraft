// T38a: the Portal Door beside the Champion's Tower door, and the live part of the Swirl's doors.
// The door is built into the main world when the tower is (gymplace.js placeTower): a frame and a dim surface that
// only a Champion sees swirling (setLive: never an edit, never saved or sent). Using it travels to the Swirl realm
// (realms.js); the door back in the Swirl travels home. `createPortal(game)` -> `game.portal`.
// Imports only blocks.js (world.js and gymplace.js import this file, so it must not import them back).
import * as THREE from 'three';
import { B } from './blocks.js';
import { PICTURE_WORLDS, FRAME_WORLDS, fullName } from './pictureworlds.js';

// The door stands flat against the tower's front wall, right of the rainbow pillar, in the row d = 7 (the tower's own
// protected box, +-7, already holds it: no player build can be lost). d = distance in front of the tower centre,
// s = sideways ([front[1], front[0]]). Surface s 4..6 x y fy+1..fy+5 (3 wide, 5 tall), posts at s 3 and 7, lintel fy+6, crown fy+7.
export const PORTAL_AT = { d: 7, s0: 3, s1: 7, surface: [4, 6], h: 5, stand: [8, 5] };

// Builds the Portal Door into the world next to `tower` (world.tower). Returns (and sets) world.portal:
// { x, y, z, front, side, surface: [[x, y, z] x 15], frame: [[x, y, z]...], stand: [x, y, z, yaw], box }.
export function buildPortalDoor(world, tower) {
  const fy = tower.y - 1, front = tower.front, side = [front[1], front[0]];
  const at = (d, s) => [tower.x + front[0] * d + side[0] * s, tower.z + front[1] * d + side[1] * s];
  const { d, s0, s1, surface, h } = PORTAL_AT;
  const put = (s, y, id, list) => { const [x, z] = at(d, s); world.set(x, y, z, id, false); list.push([x, y, z]); };
  const frame = [], cells = [];
  for (let y = fy + 1; y <= fy + h + 1; y++) { put(s0, y, B.PORTAL_FRAME, frame); put(s1, y, B.PORTAL_FRAME, frame); }
  for (let s = s0 + 1; s < s1; s++) put(s, fy + h + 1, B.PORTAL_FRAME, frame); // lintel
  put((s0 + s1) / 2, fy + h + 2, B.PORTAL_FRAME, frame); // crown
  for (let s = surface[0]; s <= surface[1]; s++) for (let y = fy + 1; y <= fy + h; y++) put(s, y, B.PORTAL_DIM, cells);
  const [a, b] = [at(d, s0), at(d, s1)];
  const box = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: fy, y1: fy + h + 2, z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  const [sx, sz] = at(PORTAL_AT.stand[0], PORTAL_AT.stand[1]);
  // You come back standing in front of the door (on the tower's stone ring), looking away from it.
  world.portal = { x: tower.x, y: fy + 1, z: tower.z, front, side, surface: cells, frame, stand: [sx + 0.5, fy + 1, sz + 0.5, Math.atan2(-front[0], -front[1])], box };
  return world.portal;
}

// A door's magic (owner 2026-10-25: "more magical, portal-ish, swirly"): a turning spiral vortex with a bright heart
// over the door's surface, sparkles drawn into it and a soft halo round the frame. Shaders only (3 draw calls, no
// textures, nothing per frame but two uniforms). `open` eases between 0 (closed: a faint grey breath) and 1.
// Works for any door: its surface cells and the spot you stand on in front of it (that side is the front).
export class DoorGlow {
  // T42: an optional 4th argument { normal, centre, w, h, lite, colours } lays the vortex on a plane you name (a floor or ceiling swirl,
  // or a wall swirl of the Portal House): `centre` = the middle of the front face, `normal` = the way it looks. `lite` builds only the
  // vortex (1 draw call instead of 3). `colours` = [[r, g, b], [r, g, b]] (0..1) for the bright arms (default violet and pink).
  constructor(scene, cells, stand, opts = null) {
    let w, h, pos, rotY = 0, rotX = 0;
    if (opts?.normal) {
      const [nx, ny, nz] = opts.normal;
      w = opts.w; h = opts.h;
      pos = [opts.centre[0] + nx * 0.03, opts.centre[1] + ny * 0.03, opts.centre[2] + nz * 0.03];
      if (ny > 0.5) rotX = -Math.PI / 2; else if (ny < -0.5) rotX = Math.PI / 2; else rotY = Math.atan2(nx, nz);
    } else {
      const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]), zs = cells.map(c => c[2]);
      const [x0, x1, y0, y1, z0, z1] = [Math.min(...xs), Math.max(...xs) + 1, Math.min(...ys), Math.max(...ys) + 1, Math.min(...zs), Math.max(...zs) + 1];
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
      const alongX = x1 - x0 > z1 - z0; // the door's width runs along x (so it faces z) or along z
      w = alongX ? x1 - x0 : z1 - z0; h = y1 - y0;
      const toward = alongX ? Math.sign(stand[2] - cz) || 1 : Math.sign(stand[0] - cx) || 1;
      pos = [cx + (alongX ? 0 : toward * 0.52), cy, cz + (alongX ? toward * 0.52 : 0)];
      rotY = alongX ? (toward > 0 ? 0 : Math.PI) : (toward > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    this.group = new THREE.Group();
    this.group.position.set(...pos);
    this.group.rotation.set(rotX, rotY, 0);
    const cols = opts?.colours;
    this.u = { t: { value: 0 }, open: { value: 0 }, size: { value: new THREE.Vector2(w, h) },
      colA: { value: new THREE.Vector3(...(cols?.[0] ?? [0.62, 0.30, 1.0])) }, colB: { value: new THREE.Vector3(...(cols?.[1] ?? [1.0, 0.45, 0.85])) }, tint: { value: cols ? 1 : 0 } }; // tint 1: the whole swirl in its own colours (owner 2026-10-28: the House's swirls looked alike)
    const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: this.u };
    const vortex = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({ ...add, blending: THREE.NormalBlending, vertexShader: DOOR_VERT, fragmentShader: VORTEX_FRAG })); // covers the tile: dark gaps make the arms read
    if (opts?.lite) {
      vortex.renderOrder = 7; this.group.add(vortex);
    } else {
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(w + 3, h + 3), new THREE.ShaderMaterial({ ...add, vertexShader: DOOR_VERT, fragmentShader: HALO_FRAG }));
      halo.position.z = -0.01; // just behind the vortex, glowing over the frame
      const n = 48, seed = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { seed[i * 3] = (i * 0.618034) % 1; seed[i * 3 + 1] = (i * 0.414214) % 1; seed[i * 3 + 2] = (i * 0.732051) % 1; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // placed in the shader
      g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
      const sparks = new THREE.Points(g, new THREE.ShaderMaterial({ ...add, vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG }));
      sparks.frustumCulled = false;
      for (const m of [halo, vortex, sparks]) { m.renderOrder = 7; this.group.add(m); }
    }
    this.scene = scene;
    scene.add(this.group);
  }
  update(dt, open) {
    this.u.t.value += dt;
    this.u.open.value += (open - this.u.open.value) * Math.min(1, dt * 2);
  }
  dispose() {
    this.scene.remove(this.group);
    for (const m of this.group.children) { m.geometry.dispose(); m.material.dispose(); }
  }
}
const DOOR_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const VORTEX_FRAG = `uniform float t, open, tint; uniform vec2 size; uniform vec3 colA, colB; varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * size / (0.5 * size.x); float r = length(p), a = atan(p.y, p.x);
  float sp = t * mix(0.35, 2.4, open);
  float arms = pow(0.5 + 0.5 * sin(a * 3.0 - r * 6.5 + sp * 2.0), 2.2);   // three bright arms winding in
  float fine = pow(0.5 + 0.5 * sin(a * 6.0 + r * 11.0 - sp * 3.0), 3.0);  // thin streaks turning the other way
  vec3 deep = mix(vec3(0.10, 0.02, 0.24), colA * 0.16, tint);
  vec3 col = mix(deep, mix(colA, colB, 0.5 + 0.5 * sin(a + t)), arms);
  col += mix(vec3(0.35, 0.95, 1.0), colB, tint) * fine * 0.55 * smoothstep(1.7, 0.4, r);
  col += mix(vec3(1.0, 0.95, 1.0), mix(colB, vec3(1.0), 0.45), tint) * smoothstep(0.42, 0.0, r) * (0.85 + 0.25 * sin(t * 3.0)); // the bright heart
  col = mix(vec3(dot(col, vec3(0.3))) * 0.8 + vec3(0.06, 0.04, 0.1), col, open);
  float e = min(min(vUv.x, 1.0 - vUv.x) * size.x, min(vUv.y, 1.0 - vUv.y) * size.y);
  float alpha = smoothstep(0.0, 0.45, e) * mix(0.35 + 0.08 * sin(t * 1.3), 0.96, open);
  gl_FragColor = vec4(col, alpha);
}`;
const HALO_FRAG = `uniform float t, open, tint; uniform vec2 size; uniform vec3 colA, colB; varying vec2 vUv;
void main() {
  vec2 q = (vUv - 0.5) * (size + 3.0); vec2 d = max(abs(q) - size * 0.5, 0.0);
  float g = exp(-length(d) * 1.6) * (1.0 - step(length(d), 0.001) * 0.6);
  float pulse = 0.75 + 0.25 * sin(t * 2.2);
  vec3 col = mix(mix(vec3(0.75, 0.4, 1.0), vec3(1.0, 0.55, 0.85), 0.5 + 0.5 * sin(t * 0.7)), mix(colA, colB, 0.5 + 0.5 * sin(t * 0.7)), tint);
  gl_FragColor = vec4(col * g * pulse * mix(0.1, 0.8, open), 1.0);
}`;
const SPARK_VERT = `uniform float t, open; uniform vec2 size; attribute vec3 seed; varying float vK;
void main() {
  float life = fract(seed.x - t * mix(0.05, 0.28, open));      // 1 = far out, 0 = swallowed by the door
  float ang = seed.y * 6.2832 + life * 4.0 + t * 0.4;
  float rad = life * (0.5 * size.x + 1.4);
  vec3 pos = vec3(cos(ang) * rad, sin(ang) * rad * size.y / size.x, 0.15 + life * 1.6 * seed.z);
  vK = seed.z;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp((2.0 + 4.0 * seed.z) * (1.0 - life * 0.4) * 60.0 / -mv.z, 1.0, 14.0) * step(0.02, open);
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = `uniform float open, tint; uniform vec3 colA, colB; varying float vK;
void main() {
  float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
  vec3 col = mix(mix(vec3(1.0, 0.6, 0.95), vec3(0.6, 0.95, 1.0), vK), mix(colB, vec3(1.0), 0.3 * vK), tint);
  gl_FragColor = vec4(col * (1.0 - d * 2.0) * open, 1.0);
}`;

const DOOR_IDS = new Set([B.PORTAL, B.PORTAL_DIM, B.PORTAL_FRAME]);
// T40: the blocks of a way back (the Swirl's door home, and the picture frame you step into in a Picture World)
const BACK_IDS = new Set([B.PORTAL, B.PORTAL_FRAME, B.WAY_BACK, B.PICTURE_FRAME]);
// T38b: a guest can use the door only while the host is in the Swirl (and then needs no title)
const openFor = game => game.mp?.role === 'guest' ? game.realms.followableAt('portal') : game.champion;
const inBox = (b, k) => k.x >= b.x0 && k.x <= b.x1 && k.y >= b.y0 && k.y <= b.y1 && k.z >= b.z0 && k.z <= b.z1;

export function createPortal(game) {
  let acc = 0, wanted = null, glows = []; // glows: the DoorGlows of the doors in this world (main, the Swirl's door home, or a Picture World's ways back)

  // Which door (if any) is this block? 'main' = the Portal Door beside the tower, 'back' = the Swirl's door home.
  function kindOf(block) {
    const w = game.world;
    if (!block || !w) return null;
    if (game.place === 'main') return w.portal && DOOR_IDS.has(block.id) && inBox(w.portal.box, block) ? 'main' : null;
    for (const d of w.doors ?? (w.door ? [w.door] : [])) if (BACK_IDS.has(block.id) && inBox(d.box, block)) return 'back';
    return null;
  }

  const self = {
    kindOf,

    // Every frame (the main loop): a Champion sees the door swirling; everybody else sees it dim.
    update(dt) {
      const w = game.world;
      for (const g of glows) g.update(dt, game.place !== 'main' || openFor(game) ? 1 : 0);
      if (!w || game.place !== 'main') { swirlUpdate(game, dt); return; }
      if (!w.portal) return;
      acc += dt;
      if (acc < 0.25) return;
      acc = 0;
      const id = game.champion ? B.PORTAL : B.PORTAL_DIM;
      if (id !== wanted || w.get(...w.portal.surface[0]) !== id) {
        for (const [x, y, z] of w.portal.surface) w.setLive(x, y, z, id);
        wanted = id;
      }
      if (game.champion && game.started && !game.inBattle && !game.toldOnce.has('portal-near')) { // once per session
        const p = game.player.pos, c = w.portal;
        if (Math.hypot(p.x - (c.stand[0]), p.z - (c.stand[2])) < 12) { game.toldOnce.add('portal-near'); game.ui.toast('The Portal Door is swirling. Step in!'); }
      }
    },

    // The player used (E / tap / click) a block: true when it was a door and something was said or done.
    use(block) {
      const k = kindOf(block);
      if (k === 'main') {
        if (game.mp?.role === 'guest') { // T38b: a guest goes where the host is (no title needed), never on their own
          if (game.champion || game.realms.followableAt('portal')) game.realms.guestEntrance('portal');
          else game.ui.toast('Only a Champion can open this door. Win in the tower first!');
          return true;
        }
        if (!game.champion) { game.ui.toast('Only a Champion can open this door. Win in the tower first!'); return true; }
        game.realms.enter('swirl', { back: game.world.portal.stand });
        return true;
      }
      if (k === 'back') { const d = (game.world.doors || []).find(o => inBox(o.box, block)); game.realms.leave('door', { via: d?.key }); return true; } // the door you use decides which frame you come out at
      return swirlUse(game, block);
    },

    // The words under the crosshair: '' = not mine.
    prompt(block, how) {
      const k = kindOf(block);
      if (k === 'main') return openFor(game) ? `Portal Door · ${how} to step in` : 'Portal Door · closed';
      if (k === 'back') { const r = game.world.realm; return `${r?.doorName ?? 'Portal Door'} · ${how} to ${r?.doorVerb ?? 'go home'}`; } // T40: the words are the realm's
      return swirlPrompt(game, block, how);
    },
    action(block) {
      const k = kindOf(block);
      if (k === 'main') return openFor(game) ? 'Step in!' : '';
      if (k === 'back') return game.world.realm?.doorAction ?? 'Go home!';
      return swirlAction(game, block);
    },

    // A new world was made (createWorld): forget what was drawn.
    reset(world) {
      acc = 0; wanted = null;
      for (const g of glows) g.dispose();
      glows = [];
      const doors = [world?.portal, ...(world?.doors ?? [world?.door])].filter(Boolean); // the main world's Portal Door, the Swirl's door home, or a Picture World's ways back
      for (const door of doors) if (door.surface?.length && game.scene) glows.push(new DoorGlow(game.scene, door.surface, door.stand));
      swirlReset(game, world);
    },
    glow: () => glows[0] && { open: glows[0].u.open.value, t: glows[0].u.t.value, parts: glows[0].group.children.length, count: glows.length }, // for tests
    // For tests and the HUD: what the Swirl is showing right now.
    info() {
      const st = SWIRL.get(game);
      return st && game.place !== 'main' ? { lifts: st.lifts.length, outline: !!st.outline, outlineBoxes: st.outline ? st.outline.geometry.attributes.position.count / 24 : 0, lit: st.lit, told: { ...st.told } } : null;
    },
    // The board the HUD shows: one entry per Picture World.
    stars() { return PICTURE_WORLDS.map(w => ({ id: w.id, name: w.name, won: game.stars.includes(w.id) })); },
  };
  return self;
}

/* ---- The Swirl's own parts: picture frames, star stones and their outlines, the Wizard's door, the lift rivers. ---- */
const SWIRL = new WeakMap(); // game -> { world, lifts: [mesh], tex, outline, lit: 'key', told: {}, frameAt: Map, acc, t }
const WIZARD_IDS = new Set([B.WIZARD_STONE, B.STAR_STONE, B.PICTURE_FRAME]);
const keyOf = b => `${b.x},${b.y},${b.z}`;

function stateOf(game) {
  const w = game.world;
  if (game.place === 'main' || !w?.swirl) return null;
  let st = SWIRL.get(game);
  if (!st || st.world !== w) { swirlReset(game, w); st = SWIRL.get(game); }
  return st ?? null;
}

// The picture of a stream of light that runs up (the texture scrolls).
function liftTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64;
  const g = c.getContext('2d');
  for (let y = 0; y < 64; y++) {
    const v = (Math.sin(y / 64 * Math.PI * 4) + 1) / 2;
    g.fillStyle = `rgba(${Math.round(150 + 105 * v)}, ${Math.round(200 + 40 * v)}, 255, ${0.25 + 0.75 * v})`;
    g.fillRect(0, y, 16, 1);
  }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255, 190, 240, 0.95)'; g.fillRect(2 + (i * 7) % 12, (i * 29) % 60, 2, 4); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// The 12 edges of every unlit star stone, one geometry for all of them.
function outlineGeometry(boxes) {
  const pos = [];
  for (const b of boxes) {
    const x0 = b.x0, x1 = b.x1 + 1, y0 = b.y0, y1 = b.y1 + 1, z0 = b.z0, z1 = b.z1 + 1;
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (const [a, d] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pos.push(...c[a], ...c[d]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

// T40: the picture of a ready frame (one canvas plane each, drawn by the entry's own `picture(ctx, size)` or a default).
function drawPicture(pw) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (pw.picture) { pw.picture(g, 128); return banner(g, pw, c); }
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, `#${pw.frame[0].toString(16).padStart(6, '0')}`); grad.addColorStop(1, '#ffffff');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.font = '84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
  g.fillText(pw.emoji, 64, 70);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [x, y] of [[16, 18], [108, 24], [22, 108], [104, 104], [64, 10]]) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
  return banner(g, pw, c);
}
// A place inside a shared world (owner 2026-10-26): its world's name on a strip at the top ('PLAYLAND').
function banner(g, pw, c) {
  if (!pw.place) return c;
  g.fillStyle = 'rgba(30,20,60,0.82)'; g.fillRect(0, 0, 128, 26);
  g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  g.fillText(pw.place.toUpperCase(), 64, 14);
  return c;
}
function dropPictures(game, st) {
  for (const m of st.pictures || []) { game.scene?.remove(m); m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); }
  st.pictures = [];
}
// Ready frames show their picture, the others stay covered with cloth (cells drawn with setLive: never an edit).
function updateFrames(game, st) {
  const w = st.world, key = FRAME_WORLDS.map(p => (p.ready ? 1 : 0)).join('');
  const first = w.swirl.frames.find(f => FRAME_WORLDS.find(p => p.id === f.world)?.ready);
  const drawn = first ? w.get(...first.cloth[0]) === B.PICTURE : true;
  if (key === st.ready && drawn) return;
  st.ready = key;
  dropPictures(game, st);
  for (const f of w.swirl.frames) {
    const pw = FRAME_WORLDS.find(p => p.id === f.world);
    for (const [x, y, z] of f.cloth) w.setLive(x, y, z, pw?.ready ? B.PICTURE : B.CLOTH);
    if (!pw?.ready || !game.scene) continue;
    const [fx, fz] = f.spot.facing, tex = new THREE.CanvasTexture(drawPicture(pw));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(f.spot.x + 0.5, f.spot.y + 3.5, f.spot.z + 0.5 + 0.52 * fz);
    m.rotation.y = fz > 0 ? 0 : Math.PI; // the plane's front looks along +z
    m.userData.swirlSky = true;
    game.scene.add(m);
    st.pictures.push(m);
  }
}

function dropOutline(game, st) {
  if (!st.outline) return;
  game.scene?.remove(st.outline); st.outline.geometry.dispose(); st.outline.material.dispose(); st.outline = null;
}

// A new world was made: take the old world's meshes out of the scene and (in the Swirl) make the new ones.
function swirlReset(game, world) {
  const old = SWIRL.get(game);
  if (old) {
    for (const m of old.lifts) { game.scene?.remove(m); m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); }
    dropOutline(game, old);
    dropPictures(game, old);
    old.tex?.dispose();
    SWIRL.delete(game);
  }
  if (!world?.swirl || !game.scene) return;
  const st = { world, lifts: [], tex: liftTexture(), outline: null, lit: null, told: {}, acc: 0, t: 0, frameAt: new Map(), pictures: [], ready: null };
  for (const l of world.lifts || []) {
    const w = l.x[1] - l.x[0] + 1, d = l.z[1] - l.z[0] + 1, h = l.y[1] + 1 - l.y[0];
    const map = st.tex.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1, h / 6); map.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(l.x[0] + w / 2, l.y[0] + h / 2, l.z[0] + d / 2);
    m.renderOrder = 5;
    game.scene.add(m);
    st.lifts.push(m);
  }
  for (const f of world.swirl.frames) for (const c of f.cells) st.frameAt.set(`${c[0]},${c[1]},${c[2]}`, f);
  updateFrames(game, st); // drawn at once, not on the next frame (a paused game still shows the right cloth or picture)
  SWIRL.set(game, st);
}

// Every frame while you are in the Swirl: the rivers run up, won stars light the bridge, two one-time hints.
function swirlUpdate(game, dt) {
  const st = stateOf(game);
  if (!st) return;
  const w = game.world;
  st.t += dt;
  st.lifts.forEach((m, i) => { m.material.map.offset.y = -(st.t * 0.8) % 1; m.material.color.setHSL((st.t * 0.04 + i / 6) % 1, 0.9, 0.5); }); // T38d: each stream slowly changes pastel colour
  st.acc += dt;
  if (st.acc < 0.25 && st.lit !== null) return;
  st.acc = 0;
  updateFrames(game, st); // T40
  const stars = game.stars || [], key = stars.join();
  if (key !== st.lit || (w.swirl.bridge[0] && w.get(...w.swirl.bridge[0].cells[0]) === (stars.includes(w.swirl.bridge[0].world) ? B.AIR : B.STAR_STONE))) {
    st.lit = key;
    const unlit = [];
    for (const s of w.swirl.bridge) {
      const lit = stars.includes(s.world);
      for (const [x, y, z] of s.cells) w.setLive(x, y, z, lit ? B.STAR_STONE : B.AIR);
      if (!lit) unlit.push(s.box);
    }
    dropOutline(game, st);
    if (unlit.length) {
      st.outline = new THREE.LineSegments(outlineGeometry(unlit), new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.85, depthWrite: false }));
      st.outline.renderOrder = 6;
      game.scene.add(st.outline);
    }
  }
  if (game.started && !game.inBattle) {
    const p = game.player.pos;
    if (!st.told.bridge && p.x >= 57 && p.x < 61 && p.z >= 77 && p.z < 84 && p.y > 18) { st.told.bridge = true; game.ui.toast('A star bridge will grow here: one stone for every star from a Picture World.'); }
    else if (!st.told.loop && Math.hypot(p.x - 60, p.z - 88) < 6 && p.y > 21.5) { st.told.loop = true; game.ui.toast('These stairs go round and round... and round!'); }
  }
}

function frameOf(game, block) {
  const st = stateOf(game);
  return st && block ? st.frameAt.get(keyOf(block)) ?? null : null;
}
function inWizard(game, b) {
  const wz = game.world?.swirl?.wizard;
  return !!wz && WIZARD_IDS.has(b.id) && inBox({ ...wz.box, x0: wz.box.x0 - 1 }, b);
}

function swirlUse(game, block) {
  if (game.place === 'main' || !game.world?.swirl) return false;
  const f = frameOf(game, block);
  if (f) {
    const pw = PICTURE_WORLDS.find(p => p.id === f.world);
    if (pw.ready && pw.realm) { // T40: step into the picture
      if (game.mp?.role === 'guest') { game.realms.guestEntrance('frame'); return true; } // a guest follows the host, never steps in alone
      const [fx, fz] = f.spot.facing;
      game.realms.enter(pw.realm, { back: [f.stand[0] + 0.5, f.stand[1], f.stand[2] + 0.5, Math.atan2(-fx, -fz)], arrive: pw.id });
      return true;
    }
    if (pw.secret && !pw.ready) { game.ui.toast('❓ A secret world! Nobody knows what is behind this cloth yet.'); return true; }
    game.ui.toast(`${pw.emoji} ${pw.name}: this world isn't open yet. Come back soon!`);
    return true;
  }
  if (inWizard(game, block)) { game.ui.toast('The Wizard is inside, holding the Swirl together. Bring him stars!'); return true; }
  return false;
}
function swirlPrompt(game, block, how) {
  const f = frameOf(game, block);
  if (f) { const pw = PICTURE_WORLDS.find(p => p.id === f.world); return `${pw.ready ? `${pw.emoji} ${fullName(pw)}` : pw.secret ? 'A secret world' : pw.name} · ${pw.ready ? `${how} to go in${game.stars.includes(pw.id) ? ' · ★' : ''}` : 'covered'}`; }
  if (game.place !== 'main' && game.world?.swirl && inWizard(game, block)) return "The Wizard's tower · sealed";
  return '';
}
function swirlAction(game, block) {
  const f = frameOf(game, block);
  return f && PICTURE_WORLDS.find(p => p.id === f.world)?.ready ? 'Step in!' : '';
}
