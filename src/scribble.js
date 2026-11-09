// Chapter 3, Test A and Test B (owner 2026-11-09, `plans/chapter3.md` section 6): ONE scribbled patch in the real game, behind ?preview
// only, near the start. Nothing here is saved, sent or a block; without ?preview this file does nothing at all.
//   Test A: walk up in first person, step in: the scribble snaps into a ring on the real ground, your lead creature jumps out of its
//           cube, and the camera rises from your eyes to just behind and above your creature in one continuous move. You fight with the
//           arena's Live rules (scribblefight.js) on the real terrain; when it is over the camera glides back down into your eyes.
//   Test B: the same fight in first person, a toggle like Cube Planets' camera (V, the pause screen's button). You stay in your own
//           eyes and walk, your creature runs beside you, your moves go where you look, warnings behind you show as arrows round the
//           middle of the screen (ui.setPointers). The toggle also works in the middle of a fight: the camera glides between the two.
// Controls (the five fixed tablet slots, no new buttons; owner 2026-11-09 keys): Jump = Dodge (Space), the round action button = move 1
// (Q, or a click), Place = move 2 (E), Ride = move 3 (R), Down = move 4 (F); 1 2 3 or a tap on a card swaps your creature.
// Behind the creature the stick / WASD move your creature (forward = away from the camera) and a look-drag / the mouse turns the camera.
import * as THREE from 'three';
import { PREVIEW } from './comingsoon.js';
import { SPECIES, TYPE_COLORS, buildModel, animateModel, disposeModel, statsFor } from './species.js';
import { buildPerson } from './npc.js';
import { doodleInk } from './doodleink.js';
import { mulberry32 } from './blocks.js';
import { sound } from './sound.js';
import { KIND_WORD } from './arena/core.js';
import { ScribbleFight, FIGHT, groundOf, squadOf, follow } from './scribblefight.js';

export const SCRIBBLE = {
  on: PREVIEW,            // ?preview only
  key: 'pokecraft-fight-cam',
  cam: { dist: 8.5, elev: 0.78, look: 1.6, yawRate: 7, follow: 7, pitchK: 0.35 },
  enter: { throw: 0.45, grow: 0.35, camFrom: 0.3, cam: 1.6, go: 1.95 }, // seconds: the cube's flight, the creature growing, the camera's move
  exit: { wait: 1.3, cam: 1.6, fade: 1.1 },
  back: 20,               // a cleared patch scribbles itself back after this long, once you are away from it
};
const smooth = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const easeBack = k => { const c = 1.7; k = Math.min(1, Math.max(0, k)); return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const typeHex = t => parseInt((TYPE_COLORS[t] || '#cccccc').match(/#([0-9a-f]{6})/i)?.[1] ?? 'cccccc', 16);
const typeCss = t => `#${typeHex(t).toString(16).padStart(6, '0')}`;
const INK = 0x3b3944, INK2 = 0x6e6b78;
const SLOT_IDS = ['btn-jump', 'btn-act', 'btn-place', 'btn-ride', 'btn-down'];
const KEYS = { Space: 0, KeyQ: 1, KeyE: 2, KeyR: 3, KeyF: 4 };
const KEY_NAMES = ['Space', 'Q', 'E', 'R', 'F'];

// ---------------------------------------------------------------- where the patch goes (pure: the spec checks it on its own)

// The best spot 14-23 blocks from the start: mostly dry land, no gym or tower box, not too steep, a few trees or bumps to hide behind.
export function scribbleSpot(world, sx, sz) {
  const g = groundOf(world), R = FIGHT.R;
  let best = null;
  for (const d of [14, 17, 20, 23]) for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, cx = Math.floor(sx + Math.cos(a) * d) + 0.5, cz = Math.floor(sz + Math.sin(a) * d) + 0.5;
    if (cx < R + 3 || cz < R + 3 || cx > world.W - R - 3 || cz > world.D - R - 3) continue;
    const cy = g.floor(cx, cz, world.ground[Math.floor(cx) + Math.floor(cz) * world.W] + 2.5);
    if (cy == null || g.wet(cx, cz, cy)) continue;
    let land = 0, water = 0, walls = 0, n = 0, lo = cy, hi = cy, bad = false;
    for (let x = -R; x <= R && !bad; x++) for (let z = -R; z <= R; z++) {
      if (x * x + z * z > R * R) continue;
      n++;
      const px = cx + x, pz = cz + z;
      if (world.protectedAt(Math.floor(px), Math.floor(cy), Math.floor(pz))) { bad = true; break; }
      const y = g.floor(px, pz, cy + 3.5);
      if (y == null || y > cy + 3) { walls++; continue; }
      if (g.wet(px, pz, y)) { water++; continue; }
      if (y < cy - 4) { bad = true; break; }
      land++; lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    if (bad || land / n < 0.75) continue;
    const range = hi - lo;
    const score = land / n - 2 * water / n - (range > 5 ? 1 : 0) + 0.04 * Math.min(walls, 8) + 0.03 * Math.min(range, 4) + 0.08 * -Math.sin(a) - d * 0.004;
    if (!best || score > best.score) best = { x: cx, z: cz, y: cy, score, walls, water, range, d };
  }
  return best;
}

// ---------------------------------------------------------------- drawing helpers

// A flat mesh that lies on the blocks (each half-block cell at its own floor height): the scribble, the ring and the red warnings.
function decalGeometry(ground, cx, cz, r, yRef, test, res = 0.5) {
  const pos = [], uv = [], col = [], idx = [];
  for (let gx = cx - r; gx < cx + r; gx += res) for (let gz = cz - r; gz < cz + r; gz += res) {
    const x = gx + res / 2, z = gz + res / 2;
    const a = test(x, z);
    if (!a) continue;
    const y = ground.floor(x, z, yRef + 2.5);
    if (y == null) continue;
    const i = pos.length / 3;
    for (const [ox, oz] of [[0, 0], [res, 0], [res, res], [0, res]]) {
      pos.push(gx + ox, y + 0.035, gz + oz);
      uv.push((gx + ox - cx) / (2 * r) + 0.5, 0.5 - (gz + oz - cz) / (2 * r));
      col.push(1, 1, 1, a);
    }
    idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  return geo;
}

// The pencil scribble on the ground (a canvas of loopy grey strokes, fading at the edge) and the ring's line.
function scribbleTexture(kind) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'), rand = mulberry32(kind === 'ring' ? 77 : 41);
  x.lineCap = 'round'; x.lineJoin = 'round';
  if (kind === 'patch') {
    for (let s = 0; s < 70; s++) {
      let px = 256 + (rand() - 0.5) * 360, py = 256 + (rand() - 0.5) * 360, a = rand() * 6.3;
      x.strokeStyle = `rgba(${rand() < 0.5 ? '59,57,68' : '110,107,120'},${0.35 + rand() * 0.45})`;
      x.lineWidth = 2 + rand() * 4;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 26; k++) { a += (rand() - 0.5) * 1.6; px += Math.cos(a) * 14; py += Math.sin(a) * 14; x.lineTo(px, py); }
      x.stroke();
    }
    const g = x.createRadialGradient(256, 256, 120, 256, 256, 256);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  } else { // the ring: two wobbly pencil circles and short hatching just inside
    for (let loop = 0; loop < 3; loop++) {
      x.strokeStyle = loop === 2 ? 'rgba(110,107,120,0.55)' : 'rgba(59,57,68,0.9)'; x.lineWidth = loop === 2 ? 3 : 6;
      x.beginPath();
      for (let k = 0; k <= 160; k++) { const a = k / 160 * Math.PI * 2, r = 244 - loop * 7 + Math.sin(a * 5 + loop * 2) * 3 + (rand() - 0.5) * 3; x[k ? 'lineTo' : 'moveTo'](256 + Math.cos(a) * r, 256 + Math.sin(a) * r); }
      x.stroke();
    }
    x.strokeStyle = 'rgba(59,57,68,0.45)'; x.lineWidth = 2.5;
    for (let k = 0; k < 120; k++) { const a = k / 120 * Math.PI * 2, r0 = 226, r1 = 212 + rand() * 6; x.beginPath(); x.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0); x.lineTo(256 + Math.cos(a + 0.05) * r1, 256 + Math.sin(a + 0.05) * r1); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cubeMesh() { // a Capture Cube (the battle's own look)
  const g = new THREE.Group();
  const b = (w, h, d, c, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(0, y, z); g.add(m); };
  b(0.3, 0.15, 0.3, 0xe33b3b, 0.075); b(0.3, 0.15, 0.3, 0xf2f2f2, -0.075); b(0.32, 0.03, 0.32, 0x222222); b(0.08, 0.08, 0.04, 0xffffff, 0, 0.16);
  g.userData.keepColour = true;
  return g;
}

// a model scaled like the arena's (big enough to read on a tablet)
function sized(model, want) {
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  const k = want / Math.max(0.6, Math.max(size.x, size.z, size.y * 0.8));
  model.scale.multiplyScalar(k);
  model.userData.base = model.scale.x;
  return size.y * k;
}

// ---------------------------------------------------------------- the patch, the fight and the camera

export function createScribble(game) {
  const S = {
    phase: 'off', // off | idle | enter | fight | exit | cleared
    world: null, spot: null, fight: null, ground: null,
    mode: 'behind', camK: 0, armed: false,
    get on() { return SCRIBBLE.on; },
    get fighting() { return S.phase === 'enter' || S.phase === 'fight' || S.phase === 'exit'; },
    holdsPlayer: () => S.fighting && (S.phase !== 'fight' || S.mode === 'behind' || S.camK > 0.5),
  };
  try { S.mode = localStorage.getItem(SCRIBBLE.key) === 'eyes' ? 'eyes' : 'behind'; } catch { /* private window */ }
  if (!SCRIBBLE.on) { // without ?preview: nothing at all
    Object.assign(S, { update() {}, tap: () => false, can: () => false, info: () => ({ on: false }) });
    return S;
  }
  const scene = game.scene, v3 = () => new THREE.Vector3();
  const tmp = { a: v3(), b: v3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), m: new THREE.Matrix4() };
  const group = new THREE.Group(); group.name = 'scribble';
  scene?.add(group);
  let parts = null; // everything drawn for one patch
  let t = 0, phaseT = 0, boilT = 0, boil = 0, backT = 0, camYaw = 0, camPos = v3(), camFocus = v3(), camPull = 1, firstFight = true;
  const yourModels = new Map(); // squad index -> model (built on first use)
  let you = null, avatar = null, cube = null, ui = null;
  const pressed = new Set();

  // ---- the tangle: one instanced mesh of thin pencil strokes. Idle: a knot over the patch; fight: a scribbly fence round the ring.
  const N = 200;
  function buildTangle(C, ground) {
    const rand = mulberry32(9);
    const idle = [], ring = [], jit = [[], [], []];
    let p = [0, 1.2, 0];
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      p = [p[0] + Math.cos(a) * 0.9, p[1] + (rand() - 0.5) * 0.7, p[2] + Math.sin(a) * 0.9];
      const d = Math.hypot(p[0], p[2]), lim = 4.6;
      if (d > lim) { p[0] *= lim / d * 0.8; p[2] *= lim / d * 0.8; }
      p[1] = Math.max(0.25, Math.min(2.7, p[1]));
      const x = C.x + p[0], z = C.z + p[2];
      idle.push([x, ground.floor(x, z, C.y + 2.5) + p[1], z]);
      const ra = i / (N - 1) * Math.PI * 4 + (rand() - 0.5) * 0.04, rr = FIGHT.R + Math.sin(i * 1.3) * 0.25;
      const rx = C.x + Math.cos(ra) * rr, rz = C.z + Math.sin(ra) * rr;
      ring.push([rx, ground.floor(rx, rz, C.y + 4) + 0.3 + 1.5 * (0.5 + 0.5 * Math.sin(i * 2.1)), rz]);
      for (const j of jit) j.push([(rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12]);
    }
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, N - 1);
    const c = new THREE.Color();
    for (let i = 0; i < N - 1; i++) mesh.setColorAt(i, c.setHex(i % 5 === 2 ? INK2 : INK));
    mesh.frustumCulled = false;
    mesh.userData.keepColour = true;
    return { mesh, idle, ring, jit };
  }
  const Z = new THREE.Vector3(0, 0, 1);
  function drawTangle(tg, snap, thick, j) {
    const P = tg.idle.map((a, i) => { const b = tg.ring[i], k = snap, J = tg.jit[j][i]; return [a[0] + (b[0] - a[0]) * k + J[0], a[1] + (b[1] - a[1]) * k + J[1], a[2] + (b[2] - a[2]) * k + J[2]]; });
    for (let i = 0; i < N - 1; i++) {
      const a = P[i], b = P[i + 1];
      tmp.a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const L = tmp.a.length() || 0.01;
      tmp.q.setFromUnitVectors(Z, tmp.a.divideScalar(L));
      tmp.b.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      tmp.m.compose(tmp.b, tmp.q, tmp.a.set(thick, thick, L + thick));
      tg.mesh.setMatrixAt(i, tmp.m);
    }
    tg.mesh.instanceMatrix.needsUpdate = true;
  }

  function decalMesh(geo, tex, color = 0xffffff, opacity = 1) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color, vertexColors: true, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.renderOrder = 2; m.userData.keepColour = true;
    return m;
  }

  // Builds the patch for this world (its spot is worked out once).
  function build(world) {
    clear();
    S.world = world;
    S.phase = 'off';
    if (!world || world.realm || game.place !== 'main') return;
    const sp = game.spawnPoint;
    S.spot = world.scribbleSpot ??= scribbleSpot(world, sp.x, sp.z);
    if (!S.spot) return;
    S.ground = groundOf(world);
    const C = S.spot, G = S.ground;
    parts = { tangle: buildTangle(C, G), monsters: [], spots: [] };
    group.add(parts.tangle.mesh);
    parts.patch = decalMesh(decalGeometry(G, C.x, C.z, FIGHT.patch + 0.5, C.y, (x, z) => Math.hypot(x - C.x, z - C.z) < FIGHT.patch + 0.5 ? 1 : 0), scribbleTexture('patch'));
    parts.ring = decalMesh(decalGeometry(G, C.x, C.z, FIGHT.R + 0.3, C.y, (x, z) => { const d = Math.hypot(x - C.x, z - C.z); return d < FIGHT.R + 0.3 && d > FIGHT.R - 2 ? 1 : 0; }), scribbleTexture('ring'), 0xffffff, 0);
    group.add(parts.patch, parts.ring);
    // the monsters, drawn in pencil: they are scribbles
    const probe = new ScribbleFight({ ground: G, centre: C, squad: [{ species: 'fluffin', level: 5, moves: [] }], start: { x: C.x, y: C.y, z: C.z } });
    probe.foes.forEach((f, i) => {
      const model = doodleInk(buildModel(f.c.species));
      const h = sized(model, 1.7);
      group.add(model);
      parts.monsters.push({ model, h, species: f.c.species, home: [f.x, f.y, f.z], t: i * 3.1 });
      parts.spots.push([f.x, f.z]);
    });
    drawTangle(parts.tangle, 0, 0.07, 0);
    const p = game.player?.pos;
    S.armed = !p || Math.hypot(p.x - C.x, p.z - C.z) > FIGHT.patch + 1;
    S.phase = 'idle';
  }
  function clear() {
    endFightModels();
    if (parts) {
      for (const m of [parts.tangle.mesh, parts.patch, parts.ring]) { group.remove(m); m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); }
      for (const m of parts.monsters) { group.remove(m.model); disposeModel(m.model); }
    }
    parts = null; S.fight = null;
  }

  // ---- the HUD (bars over the fighters, floating numbers, your squad, the moves bar on a computer, the words)
  function makeUi() {
    if (ui || typeof document === 'undefined') return ui;
    const style = document.createElement('style');
    style.textContent = `
#sc-ui { position: fixed; inset: 0; pointer-events: none; z-index: 4; font-family: inherit; }
#sc-ui .bar { position: absolute; left: 0; top: 0; width: 64px; height: 9px; background: #000a; border: 2px solid #fff; border-radius: 5px; }
#sc-ui .bar i { display: block; height: 100%; background: #5fe05f; border-radius: 2px; }
#sc-ui .bar.you { width: 80px; height: 12px; border-color: #ffd23a; }
#sc-ui .bar.low i { background: #ff5a3c; }
#sc-ui .bar.zzz::after { content: 'zzz'; position: absolute; right: -28px; top: -12px; font-size: 13px; color: #cfe3ff; }
#sc-ui .bar.slow::after { content: 'slow'; position: absolute; right: -34px; top: -8px; font-size: 10px; color: #ffd9a8; }
#sc-ui .float { position: absolute; transform: translate(-50%, -50%); font-size: 18px; color: #fff; text-shadow: 0 2px 0 #000, 0 0 6px #000; animation: sc-up .9s ease-out forwards; white-space: nowrap; }
#sc-ui .float.ouch { color: #ff7b6b; } #sc-ui .float.super { color: #ffe14a; font-size: 15px; } #sc-ui .float.miss { color: #cfe3ff; font-size: 14px; } #sc-ui .float.heal { color: #7dff8a; }
@keyframes sc-up { to { transform: translate(-50%, -150%); opacity: 0; } }
#sc-ui .word { position: absolute; left: 50%; top: 30%; transform: translate(-50%, -50%); font-size: 40px; color: #fff; text-shadow: 0 3px 0 #000, 0 0 10px #000; white-space: nowrap; transition: opacity .3s; }
#sc-ui .hint { position: absolute; left: 50%; top: 12%; transform: translateX(-50%); font-size: 14px; color: #fff; background: #0008; padding: 6px 12px; border-radius: 10px; white-space: nowrap; max-width: 92vw; overflow: hidden; text-overflow: ellipsis; }
#sc-ui .squad { position: absolute; left: calc(10px + env(safe-area-inset-left)); top: calc(12px + env(safe-area-inset-top)); display: flex; flex-direction: column; gap: 6px; pointer-events: auto; }
#sc-ui .mate { --col: #fff; font: inherit; font-size: 11px; color: #fff; text-align: left; width: 140px; padding: 5px 8px 10px; border-radius: 10px; border: 3px solid var(--col); background: #1d2438cc; position: relative; touch-action: none; }
#sc-ui .mate i { position: absolute; left: 6px; bottom: 4px; height: 5px; background: #5fe05f; border-radius: 3px; max-width: calc(100% - 12px); }
#sc-ui .mate.lead { box-shadow: 0 0 0 3px #fff; } #sc-ui .mate.out { opacity: .35; }
#sc-ui .moves { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; gap: 8px; }
body.touch #sc-ui .moves { display: none; }
#sc-ui .mv { --col: #e8eef7; position: relative; min-width: 92px; padding: 6px 8px 4px; border-radius: 10px; border: 3px solid var(--col); background: #1d2438d9; color: #fff; font-size: 11px; text-align: center; overflow: hidden; }
#sc-ui .mv small { display: block; opacity: .75; font-size: 9px; margin-top: 3px; }
#sc-ui .mv kbd { display: block; font: inherit; font-size: 9px; opacity: .6; margin-top: 3px; }
#sc-ui .mv .cd { position: absolute; left: 0; bottom: 0; height: 100%; background: #000a; }
#sc-ui .mv.on { background: color-mix(in srgb, var(--col) 55%, #1d2438); }
body.scribbling #hotbar, body.scribbling #cubes, body.scribbling #party-mini, body.scribbling #crosshair.sc-behind, body.scribbling #prompt { display: none !important; }
#touch.fight #btn-down { display: block !important; }
#touch.fight #touch-buttons button { border-color: var(--sc-col, #fff) !important; }
#touch.fight #touch-buttons button.sc-on { background: rgba(255,255,255,.45) !important; }
`;
    document.head.append(style);
    const root = document.createElement('div'); root.id = 'sc-ui'; root.className = 'hidden';
    root.innerHTML = '<div class="bars"></div><div class="squad"></div><div class="moves"></div><div class="hint hidden"></div><div class="word" style="opacity:0"></div>';
    document.body.append(root);
    ui = { root, bars: root.querySelector('.bars'), squad: root.querySelector('.squad'), moves: root.querySelector('.moves'), hint: root.querySelector('.hint'), word: root.querySelector('.word'), barOf: new Map(), cache: {} };
    return ui;
  }
  function say(text, time = 1.2) { if (!ui) return; ui.word.textContent = text; ui.word.style.opacity = '1'; clearTimeout(ui.wordT); ui.wordT = setTimeout(() => { ui.word.style.opacity = '0'; }, time * 1000); }
  function hint(text) { if (!ui) return; ui.hint.textContent = text || ''; ui.hint.classList.toggle('hidden', !text); }
  function floatText(x, y, z, text, cls = '') {
    if (!ui) return;
    const v = tmp.a.set(x, y, z).project(game.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = `float ${cls}`; el.textContent = text;
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    ui.bars.append(el);
    setTimeout(() => el.remove(), 900);
  }
  function bar(f) {
    let el = ui.barOf.get(f);
    if (!el) { el = document.createElement('div'); el.className = `bar ${f.side}`; el.innerHTML = '<i></i>'; ui.bars.append(el); ui.barOf.set(f, el); }
    return el;
  }
  function drawBars() {
    const F = S.fight, live = new Set();
    for (const f of [F.you, ...F.foes]) {
      const el = bar(f); live.add(el);
      const m = modelOf(f);
      const v = tmp.a.set(f.x, f.y + (m?.userData.h ?? 1.5) + 0.45, f.z).project(game.camera);
      const show = f.alive && v.z < 1 && m?.visible;
      el.style.display = show ? '' : 'none';
      if (!show) continue;
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
      el.firstChild.style.width = `${Math.max(0, f.hp / f.maxHp) * 100}%`;
      el.classList.toggle('low', f.hp < f.maxHp * 0.3);
      el.classList.toggle('zzz', f.sleepT > 0);
      el.classList.toggle('slow', f.slowT > 0 && f.sleepT <= 0);
    }
    for (const [f, el] of ui.barOf) if (!live.has(el)) { el.remove(); ui.barOf.delete(f); }
  }
  function drawSquad() {
    const F = S.fight;
    const key = `${F.lead}:${F.squad.map((m, i) => Math.ceil(i === F.lead ? F.you.hp : m.hp)).join(',')}`;
    if (ui.cache.squad === key) return;
    ui.cache.squad = key;
    ui.squad.replaceChildren(...F.squad.map((m, i) => {
      const b = document.createElement('button'), hp = i === F.lead ? F.you.hp : m.hp, max = statsFor(m.c).maxHp;
      b.className = `mate${i === F.lead ? ' lead' : ''}${hp <= 0 ? ' out' : ''}`;
      b.style.setProperty('--col', typeCss(SPECIES[m.c.species].type));
      b.innerHTML = `${i + 1} ${SPECIES[m.c.species].name}<i style="width:${Math.max(0, hp / max) * 100}%"></i>`;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (S.phase === 'fight') F.swap(i); });
      return b;
    }));
    ui.squad.classList.toggle('hidden', F.squad.length < 2);
  }
  // the moves: the five fixed tablet slots get the fight's words; a computer gets a bar with the keys
  function drawPad() {
    const pad = S.fight.pad();
    const key = JSON.stringify(pad.map(p => p && [p.move?.id, p.dim, p.on, Math.round((p.cd || 0) * 20)]));
    if (ui.cache.pad === key) return;
    ui.cache.pad = key;
    ui.moves.replaceChildren(...pad.map((p, i) => {
      const d = document.createElement('div');
      if (!p) { d.className = 'mv'; d.style.opacity = '.25'; d.innerHTML = `—<kbd>${KEY_NAMES[i]}</kbd>`; return d; }
      d.className = `mv${p.on ? ' on' : ''}`;
      d.style.setProperty('--col', p.move ? typeCss(p.move.type) : '#e8eef7');
      d.innerHTML = `<span class="cd" style="width:${Math.round((p.charge ? 0 : p.cd || 0) * 100)}%"></span><span style="position:relative">${p.move ? p.move.name : p.label}</span><small style="position:relative">${p.move ? KIND_WORD[p.move.kind] : 'hop away'}</small><kbd style="position:relative">${KEY_NAMES[i]}</kbd>`;
      return d;
    }));
    if (!game.isTouch?.() || typeof document === 'undefined') return;
    pad.forEach((p, i) => {
      const el = document.getElementById(SLOT_IDS[i]);
      if (!el) return;
      const word = p ? (p.move ? p.move.name : p.label) : '—';
      if (el.textContent !== word) { el.textContent = word; game.touch?.fit?.(el, true); }
      el.classList.toggle('dim', !p || !!p.dim);
      el.classList.toggle('sc-on', !!p?.on);
      el.style.setProperty('--sc-col', p?.move ? typeCss(p.move.type) : '#ffffff');
    });
  }
  function touchFight(on) {
    if (typeof document === 'undefined') return;
    const t = document.getElementById('touch');
    t?.classList.toggle('fight', on);
    document.body.classList.toggle('scribbling', on);
    document.getElementById('crosshair')?.classList.toggle('sc-behind', on && S.mode === 'behind');
    const ride = document.getElementById('btn-ride');
    if (on) { ride?.classList.remove('hidden'); t?.classList.remove('sky'); }
    else {
      for (const id of SLOT_IDS) { const el = document.getElementById(id); el?.classList.remove('sc-on', 'dim'); el?.style.removeProperty('--sc-col'); }
      if (game.touch) { game.touch.state = {}; game.touch.rideView = {}; } // the next setButtons writes every slot again (touch.js)
    }
  }

  // ---- models in the fight
  function modelOf(f) {
    if (!S.fight) return null;
    if (f.side === 'you') return you;
    return parts?.monsters[S.fight.foes.indexOf(f)]?.model ?? null;
  }
  function yourModel(i) {
    let m = yourModels.get(i);
    if (!m) {
      const c = S.fight.squad[i].c;
      m = buildModel(c.species, c.paint);
      m.userData.h = sized(m, 1.5);
      yourModels.set(i, m);
    }
    return m;
  }
  function endFightModels() {
    for (const m of yourModels.values()) { group.remove(m); disposeModel(m); }
    yourModels.clear(); you = null;
    if (cube) { group.remove(cube); cube = null; }
    for (const k of Object.keys(fxs)) for (const m of fxs[k]) group.remove(m.mesh ?? m);
    fxs.shots.length = fxs.bursts.length = fxs.tells.length = fxs.clouds.length = 0;
    for (const m of shotMeshes.values()) { group.remove(m); m.material.dispose(); }
    shotMeshes.clear();
    if (target) target.visible = false;
  }

  // ---- effects: shots, blasts, clouds, red warnings on the ground, the target mark
  const fxs = { shots: [], bursts: [], tells: [], clouds: [] };
  const shotGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4), discGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
  const shotMeshes = new Map();
  let target = null;
  function shotMesh(sh) {
    let m = shotMeshes.get(sh.id);
    if (!m) { m = new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({ color: typeHex(sh.s.type) })); m.userData.keepColour = true; group.add(m); shotMeshes.set(sh.id, m); }
    return m;
  }
  function burst(type, x, y, z, r, time = 0.45, o = 0.6) {
    const m = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: typeHex(type), transparent: true, opacity: o, depthWrite: false }));
    m.position.set(x, y + 0.1, z); m.userData.keepColour = true; group.add(m);
    fxs.bursts.push({ mesh: m, t: 0, time, r, o });
  }
  function tellMesh(tl) {
    const G = S.ground;
    let test;
    if (tl.kind === 'line') {
      test = (x, z) => { const al = (x - tl.x) * tl.dx + (z - tl.z) * tl.dz; if (al < 0 || al > tl.len) return 0; const d = Math.hypot(x - tl.x - tl.dx * al, z - tl.z - tl.dz * al); return d < tl.w / 2 ? (d > tl.w / 2 - 0.3 || al > tl.len - 0.4 ? 0.9 : 0.4) : 0; };
    } else test = (x, z) => { const d = Math.hypot(x - tl.x, z - tl.z); return d < tl.r ? (d > tl.r - 0.35 ? 0.9 : 0.35) : 0; };
    const r = tl.kind === 'line' ? tl.len + 1 : tl.r + 0.5;
    const geo = decalGeometry(G, tl.x, tl.z, r, tl.y, test, 0.25);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff3b3b, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.renderOrder = 3; m.userData.keepColour = true;
    group.add(m);
    return m;
  }
  function drawFx(dt) {
    const F = S.fight;
    const ids = new Set(F.shots.map(s => s.id));
    for (const [id, m] of shotMeshes) if (!ids.has(id)) { group.remove(m); m.material.dispose(); shotMeshes.delete(id); }
    for (const sh of F.shots) { const m = shotMesh(sh); m.visible = !!sh.live; m.position.set(sh.x, sh.y, sh.z); m.rotation.y += dt * 9; }
    for (const b of fxs.bursts) { b.t += dt; const k = Math.min(1, b.t / b.time); b.mesh.scale.setScalar(b.r * (0.3 + 0.7 * k)); b.mesh.material.opacity = b.o * (1 - k); }
    fxs.bursts = fxs.bursts.filter(b => { if (b.t < b.time) return true; group.remove(b.mesh); b.mesh.material.dispose(); return false; });
    // red warnings: one mesh per warning, pulsing faster as the hit comes
    const tells = new Set(F.foes.filter(f => f.alive && f.tell).map(f => f.tell));
    for (const w of fxs.tells) if (!tells.has(w.t)) { group.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); w.dead = true; }
    fxs.tells = fxs.tells.filter(w => !w.dead);
    for (const tl of tells) if (!fxs.tells.some(w => w.t === tl)) fxs.tells.push({ t: tl, mesh: tellMesh(tl), age: 0 });
    for (const w of fxs.tells) { w.age += dt; w.mesh.material.opacity = 0.65 + 0.35 * Math.sin(w.age * (8 + w.age * 10)); }
    // clouds
    const cl = new Set(F.clouds);
    for (const c of fxs.clouds) if (!cl.has(c.c)) { group.remove(c.mesh); c.mesh.material.dispose(); c.dead = true; }
    fxs.clouds = fxs.clouds.filter(c => !c.dead);
    for (const c of F.clouds) {
      let e = fxs.clouds.find(x => x.c === c);
      if (!e) { const m = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: typeHex(c.type), transparent: true, opacity: 0.35, depthWrite: false })); m.position.set(c.x, c.y + 0.15, c.z); m.scale.setScalar(c.r); m.userData.keepColour = true; group.add(m); e = { c, mesh: m }; fxs.clouds.push(e); }
      e.mesh.material.opacity = 0.35 * Math.min(1, (c.time - c.t) * 2);
    }
    // the target: a gold ring spinning over the monster your moves go to
    if (!target) {
      target = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
      target.rotation.x = Math.PI / 2; target.userData.keepColour = true; group.add(target);
    }
    const tg = F.target?.alive ? F.target : null, tm = tg && modelOf(tg);
    target.visible = !!tm && S.phase === 'fight';
    if (target.visible) { target.position.set(tg.x, tg.y + tm.userData.h + 0.15 + Math.sin(t * 4) * 0.06, tg.z); target.rotation.z += dt * 3; }
  }
  // what happened this step: sounds, numbers, blasts
  function events() {
    const F = S.fight;
    for (const e of F.events) {
      const m = e.f && modelOf(e.f), h = m?.userData.h ?? 1.5;
      if (e.kind === 'hit') {
        floatText(e.f.x, e.f.y + h * 0.7, e.f.z, `-${e.amount}`, e.f.side === 'you' ? 'ouch' : '');
        if (e.eff > 1) floatText(e.f.x + 0.6, e.f.y + h + 0.5, e.f.z, 'Super!', 'super');
        else if (e.eff < 1) floatText(e.f.x + 0.6, e.f.y + h + 0.5, e.f.z, 'Not much...', 'miss');
        sound.play('hit');
      } else if (e.kind === 'dodged') floatText(e.f.x, e.f.y + h, e.f.z, 'Dodged!', 'miss');
      else if (e.kind === 'heal') floatText(e.f.x, e.f.y + h * 0.7, e.f.z, e.amount ? `+${e.amount}` : 'Full!', 'heal');
      else if (e.kind === 'faint') sound.play('faint');
      else if (e.kind === 'dodge') sound.play('whoosh');
      else if (e.kind === 'move') sound.play(`fx:${e.s.type}`);
      else if (e.kind === 'burst') burst(e.type, e.x, e.y, e.z, e.r, 0.5, 0.7);
      else if (e.kind === 'thud') { burst(e.f.type, e.t.x, e.t.y, e.t.z, e.t.r, 0.35, 0.6); sound.play('hit'); }
      else if (e.kind === 'blocked') burst(e.type, e.x, e.y - 0.5, e.z, 0.6, 0.25, 0.8);
      else if (e.kind === 'buff') say(e.def ? 'Tough for 8 s!' : 'Power up for 8 s!', 1);
      else if (e.kind === 'swap') {
        say(`Go, ${SPECIES[e.f.c.species].name}!`, 1);
        sound.play('whoosh');
        if (you) group.remove(you);
        you = yourModel(F.lead); group.add(you);
      } else if (e.kind === 'over') endFight(e.won);
    }
    F.events.length = 0;
  }

  // ---- the fight's life
  function canStart() {
    const p = game.player;
    if (S.phase !== 'idle' || !S.armed || !game.playing?.() || game.ui?.asking || game.hideSeek?.active || game.realms?.busy) return false;
    if (Math.hypot(p.pos.x - S.spot.x, p.pos.z - S.spot.z) > FIGHT.patch || Math.abs(p.pos.y - S.spot.y) > 4) return false;
    return squadOf(game.party).length > 0;
  }
  function start() {
    const p = game.player, C = S.spot, G = S.ground;
    game.riding?.stop?.('quiet');
    makeUi();
    // your creature lands two steps in front of you, inside the ring, on the ground
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let sx = p.pos.x + fx * 3.5, sz = p.pos.z + fz * 3.5;
    if (Math.hypot(sx - C.x, sz - C.z) > FIGHT.R - 1.5) { sx = p.pos.x + (C.x - p.pos.x) * 0.3; sz = p.pos.z + (C.z - p.pos.z) * 0.3; }
    const sy = G.stand(sx, sz, p.pos.y, 2) ?? p.pos.y;
    S.fight = new ScribbleFight({ ground: G, centre: C, squad: squadOf(game.party), start: { x: sx, y: sy, z: sz } }); // the monsters jump out of the knot round your creature
    S.fight.you.heading = Math.atan2(C.x - sx, C.z - sz);
    S.entry = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    S.phase = 'enter'; phaseT = 0;
    camYaw = p.yaw; camFocus.set(sx, sy + 1, sz); camPull = 1;
    p.vel?.set(0, 0, 0);
    for (const w of [...(game.creatures?.list || [])]) if (Math.hypot(w.pos.x - C.x, w.pos.z - C.z) < FIGHT.R + 2) game.creatures.remove(w); // no wild creature inside the ring
    you = yourModel(0); you.scale.setScalar(0.01); you.visible = false; group.add(you);
    cube = cubeMesh(); group.add(cube);
    ui.root.classList.remove('hidden'); ui.cache = {};
    touchFight(true);
    game.ui?.setPrompt?.('');
    sound.play('whoosh');
    hint(firstFight ? (game.isTouch?.() ? 'Stick moves · the round buttons are your moves · Jump = Dodge' : 'WASD moves · Q E R F your moves · Space dodges · V camera') : '');
  }
  function endFight(won) {
    S.result = won; S.exitFrom = null;
    S.phase = 'exit'; phaseT = 0; firstFight = false;
    say(won ? 'Scribble cleared!' : 'Oops! Your team is tired.', 1.6);
    sound.play(won ? 'badge' : 'lose');
    hint('');
  }
  function finishExit() {
    endFightModels();
    touchFight(false);
    ui?.root.classList.add('hidden');
    for (const el of ui?.barOf.values() || []) el.remove();
    ui?.barOf.clear();
    game.ui?.setPointers?.(null);
    const won = S.result;
    S.fight = null; S.armed = false;
    if (won) { S.phase = 'cleared'; backT = SCRIBBLE.back; if (game.ui) game.ui.toast('The scribble is gone! It may scribble itself back later.'); }
    else { S.phase = 'idle'; if (game.ui) game.ui.toast('Walk out and back in to try again!'); }
    const p = game.player;
    if (p && p.pitch > 0.3) p.pitch = 0.3;
  }

  // ---- input (attached once; they act only while a fight runs)
  if (typeof document !== 'undefined') {
    const active = () => S.phase === 'fight' && game.playing?.() && !game.ui?.asking;
    document.addEventListener('keydown', e => {
      if (!game.started || e.target instanceof HTMLInputElement) return;
      if (e.code === 'KeyV' && !e.repeat && !game.cubeCam?.can?.() && S.can() && !game.ui?.asking && (S.fighting || game.playing?.())) { e.stopImmediatePropagation(); S.toggleCam(); return; }
      if (!S.fighting || game.ui?.asking || !game.playing?.()) return;
      if (e.code in KEYS || /^Digit[123]$/.test(e.code)) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.repeat || !active()) return;
        if (e.code.startsWith('Digit')) S.fight.swap(+e.code.slice(5) - 1);
        else { pressed.add(e.code); S.fight.press(KEYS[e.code]); }
      }
    }, true);
    document.addEventListener('keyup', e => {
      if (e.code in KEYS && pressed.has(e.code)) { pressed.delete(e.code); S.fight?.release(KEYS[e.code]); e.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('mousedown', e => {
      if (!S.fighting || document.pointerLockElement == null || game.ui?.asking) return;
      e.stopImmediatePropagation();
      if (e.button === 0 && active()) { pressed.add('mouse'); S.fight.press(1); }
    }, true);
    document.addEventListener('mouseup', e => { if (e.button === 0 && pressed.has('mouse')) { pressed.delete('mouse'); S.fight?.release(1); e.stopImmediatePropagation(); } }, true);
    // the five fixed slots: while a fight runs they are Dodge and your four moves (held: a big blast charges while the finger stays down)
    const hook = () => SLOT_IDS.forEach((id, slot) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.scribble) return;
      el.dataset.scribble = '1';
      let mine = null, lastAt = -1e9;
      el.addEventListener('pointerdown', e => {
        if (!S.fighting) return;
        e.preventDefault(); e.stopImmediatePropagation();
        try { el.setPointerCapture(e.pointerId); } catch { /* gone */ }
        lastAt = performance.now();
        if (!active()) return;
        mine = e.pointerId; el.classList.add('down'); S.fight.press(slot);
      }, true);
      const up = e => { if (mine == null || e.pointerId !== mine) return; mine = null; el.classList.remove('down'); S.fight?.release(slot); e.stopImmediatePropagation(); };
      el.addEventListener('pointerup', up, true); el.addEventListener('pointercancel', up, true);
      el.addEventListener('click', e => { if (S.fighting || performance.now() - lastAt < 600) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  }

  // ---- the camera: one blend between your eyes and the spot behind your creature
  const eyeQ = new THREE.Quaternion(), tpQ = new THREE.Quaternion(), tpPos = v3();
  function thirdPerson(dt, snap) {
    const p = game.player, f = S.fight.you, c = SCRIBBLE.cam;
    camYaw = snap ? p.yaw : camYaw + wrap(p.yaw - camYaw) * (1 - Math.exp(-dt * c.yawRate));
    const k = snap ? 1 : 1 - Math.exp(-dt * c.follow);
    camFocus.lerp(tmp.a.set(f.x, f.y + 1.0, f.z), k);
    const tall = Math.max(1, 1.15 / Math.max(0.3, game.camera.aspect)) ** 0.6;
    const dist = c.dist * tall, elev = Math.max(0.35, Math.min(1.1, c.elev - p.pitch * c.pitchK));
    const back = tmp.b.set(Math.sin(camYaw), 0, Math.cos(camYaw));
    const want = tpPos.copy(camFocus).addScaledVector(back, Math.cos(elev) * dist).add(tmp.a.set(0, Math.sin(elev) * dist, 0));
    // never inside a hill: pull in toward the creature while the way is blocked (eased, so it never jumps)
    const d = tmp.a.subVectors(want, camFocus), L = d.length();
    let pull = 1;
    for (let s = L; s > 1.5; s -= 0.25) { const q = camFocus.clone().addScaledVector(d, s / L); if (!S.ground.solid(q.x, q.y, q.z) && !S.ground.solid(q.x, q.y - 0.4, q.z)) break; pull = (s - 0.25) / L; }
    camPull += (pull - camPull) * (pull < camPull ? 1 : 1 - Math.exp(-dt * 3));
    tpPos.copy(camFocus).addScaledVector(d, camPull);
    tmp.m.lookAt(tpPos, tmp.a.copy(camFocus).addScaledVector(back, -c.look).setY(camFocus.y - 0.3), THREE.Object3D.DEFAULT_UP);
    tpQ.setFromRotationMatrix(tmp.m);
  }
  function placeCamera(camera, dt, snap = false) {
    const p = game.player;
    if (S.fight) thirdPerson(dt, snap);
    const k = smooth(S.camK);
    if (k <= 0) return;
    eyeQ.setFromEuler(tmp.e.set(p.pitch, p.yaw, 0, 'YXZ'));
    camera.position.copy(p.eyePos).lerp(tpPos, k);
    camera.position.y += Math.sin(k * Math.PI) * 0.8; // a little lift on the way: up and over, never through
    camera.quaternion.copy(eyeQ).slerp(tpQ, k);
  }

  // ---- first person: your creature runs beside you; warnings you cannot see show as arrows round the middle
  function followInput() { const p = game.player; follow(S.fight, p.pos.x, p.pos.z, p.yaw); }
  function behindInput() {
    const p = game.player, F = S.fight, k = p.keys || {}, j = game.touch?.joy || { x: 0, y: 0 };
    let f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    if (Math.hypot(j.x, j.y) > 0.15) { f = -j.y; s = j.x; }
    const y = camYaw;
    F.input.mx = -Math.sin(y) * f + Math.cos(y) * s;
    F.input.mz = -Math.cos(y) * f - Math.sin(y) * s;
    F.aimDir = null;
  }
  function pointers() {
    if (!game.ui?.setPointers) return;
    if (S.mode !== 'eyes' || S.phase !== 'fight') { game.ui.setPointers(null); return; }
    const p = game.player, list = [];
    for (const f of S.fight.foes) if (f.alive && (f.tell || f.charging || Math.hypot(f.x - p.pos.x, f.z - p.pos.z) < 6)) {
      const a = wrap(Math.atan2(f.x - p.pos.x, f.z - p.pos.z) - Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw)));
      if (Math.abs(a) < 0.75) continue; // in view: no arrow
      list.push({ angle: -a, colour: f.tell || f.charging ? '#ff4a3c' : '#ffffffcc', size: f.tell || f.charging ? 1 : 0.3 });
    }
    game.ui.setPointers(list);
  }
  function keepInRing() {
    const p = game.player, C = S.spot, d = Math.hypot(p.pos.x - C.x, p.pos.z - C.z), lim = FIGHT.R - 0.6;
    if (d > lim) { p.pos.x = C.x + (p.pos.x - C.x) * lim / d; p.pos.z = C.z + (p.pos.z - C.z) * lim / d; }
  }

  // ---- drawing the creatures each frame
  function drawModels(dt) {
    const F = S.fight;
    if (parts) parts.monsters.forEach((m, i) => {
      m.t += dt;
      const f = F?.foes[i];
      if (f) {
        m.model.position.set(f.x, f.y, f.z); m.model.rotation.y = f.heading;
        if (S.phase === 'enter') { // they leap out of the knot to their places round your creature
          const k = smooth(Math.min(1, phaseT / 0.8)), [hx, hy, hz] = m.home;
          m.model.position.set(hx + (f.x - hx) * k, hy + (f.y - hy) * k + Math.sin(k * Math.PI) * 2, hz + (f.z - hz) * k);
        }
        animateModel(m.model, m.t, f.moving);
        let vis = f.alive || f.flash > 0;
        if (f.flash > 0) vis = f.alive ? Math.floor(f.flash * 20) % 2 === 0 : true;
        if (!f.alive) m.model.scale.setScalar(Math.max(0.01, m.model.userData.base * (f.flash / 0.6)));
        m.model.visible = vis && S.phase !== 'cleared';
      } else { // idle: they shuffle about their spot and turn to watch you
        const p = game.player?.pos;
        const [hx, hy, hz] = m.home;
        m.model.position.set(hx + Math.sin(m.t * 0.4) * 0.6, hy, hz + Math.cos(m.t * 0.33) * 0.6);
        m.model.scale.setScalar(m.model.userData.base);
        if (p) m.model.rotation.y = Math.atan2(p.x - hx, p.z - hz);
        animateModel(m.model, m.t, true);
        m.model.visible = S.phase === 'idle';
      }
      m.model.userData.h = m.h;
    });
    if (!F || !you) return;
    const f = F.you;
    you.rotation.y = f.heading;
    let lift = 0;
    if (S.phase === 'enter') { // the cube flies from your hand, pops, and your creature hops out growing
      const p = game.player, T = SCRIBBLE.enter, k = Math.min(1, phaseT / T.throw);
      const from = tmp.a.copy(p.eyePos).add(tmp.b.set(-Math.sin(p.yaw) * 0.6 + Math.cos(p.yaw) * 0.3, -0.35, -Math.cos(p.yaw) * 0.6 - Math.sin(p.yaw) * 0.3));
      cube.visible = k < 1;
      cube.position.set(from.x + (f.x - from.x) * k, from.y + (f.y + 0.2 - from.y) * k + Math.sin(k * Math.PI) * 1.3, from.z + (f.z - from.z) * k);
      cube.rotation.set(k * 8, k * 6, 0);
      if (k >= 1 && !you.visible) { you.visible = true; sound.play('cube'); burst(f.type, f.x, f.y, f.z, 1.4, 0.4, 0.9); }
      const g = Math.min(1, Math.max(0, (phaseT - T.throw) / T.grow));
      you.scale.setScalar(you.userData.base * Math.max(0.01, easeBack(g)));
      lift = Math.sin(g * Math.PI) * 0.9;
    } else if (S.phase === 'exit' && phaseT > SCRIBBLE.exit.wait * 0.6) { // back into the cube, back to your hand
      const p = game.player, k = Math.min(1, (phaseT - SCRIBBLE.exit.wait * 0.6) / 0.5);
      you.scale.setScalar(you.userData.base * Math.max(0.01, 1 - k));
      cube.visible = k > 0.3 && k < 1;
      if (cube.visible) cube.position.lerpVectors(tmp.a.set(f.x, f.y + 0.4, f.z), p.eyePos, k * k);
      if (k >= 1) you.visible = false;
    } else {
      let vis = f.alive || f.flash > 0;
      if (f.flash > 0 && f.alive) vis = Math.floor(f.flash * 20) % 2 === 0;
      you.visible = vis; you.scale.setScalar(you.userData.base);
    }
    you.position.set(f.x, f.y + lift, f.z);
    animateModel(you, t, f.moving);
    // you, standing at the ring's edge, when the camera is behind your creature (cubecam's blocky avatar)
    if (!avatar) { avatar = buildPerson({ shirt: 0x3b6fd8, pants: 0x2a2a3a, hair: 0x3a2a1a, skin: 0xe8b98a }); avatar.userData.keepColour = true; group.add(avatar); }
    const p = game.player;
    // (hidden while it stands between the camera and your creature: never in the way)
    const cx = game.camera.position.x, cz = game.camera.position.z, sx = f.x - cx, sz = f.z - cz, L = sx * sx + sz * sz || 1;
    const k2 = Math.max(0, Math.min(1, ((p.pos.x - cx) * sx + (p.pos.z - cz) * sz) / L));
    const inWay = Math.hypot(p.pos.x - cx - sx * k2, p.pos.z - cz - sz * k2) < 1.3 && k2 < 0.95;
    avatar.visible = S.camK > 0.35 && !inWay;
    avatar.position.copy(p.pos);
    avatar.rotation.y = Math.atan2(f.x - p.pos.x, f.z - p.pos.z);
    const parts2 = avatar.userData.parts, cheer = S.phase === 'fight' ? Math.sin(t * 6) * 0.5 - 2.4 : 0;
    for (const a of parts2?.arms || []) a.g.rotation.x = S.result && S.phase === 'exit' ? -2.8 : cheer * (a.phase ? 0.2 : 1) * 0.3;
  }

  // ---- every frame (main.js, right after the first-person camera is placed)
  S.update = (dt, camera) => {
    t += dt;
    if (game.world !== S.world) build(game.world);
    if (S.phase === 'off' || !parts) { if (avatar) avatar.visible = false; return; }
    const p = game.player, C = S.spot, playing = game.playing?.();
    // the tangle boils like a pencil drawing
    boilT += dt; if (boilT > 0.12) { boilT = 0; boil = (boil + 1) % 3; }
    const tg = parts.tangle;
    if (S.phase === 'idle' || S.phase === 'cleared') {
      if (S.phase === 'cleared') {
        backT -= playing ? dt : 0;
        const away = Math.hypot(p.pos.x - C.x, p.pos.z - C.z) > FIGHT.R + 6;
        if (backT <= 0 && away) { S.phase = 'idle'; S.armed = true; }
      }
      const shown = S.phase === 'idle' ? 1 : 0;
      tg.mesh.visible = !!shown; parts.patch.visible = !!shown; parts.ring.material.opacity = 0;
      parts.patch.material.opacity = 1;
      if (shown) drawTangle(tg, 0, 0.07, boil);
      if (!S.armed && Math.hypot(p.pos.x - C.x, p.pos.z - C.z) > FIGHT.patch + 1) S.armed = true;
      drawModels(dt);
      if (canStart()) start(); else return;
    }
    const F = S.fight;
    if (S.pinT != null) phaseT = S.pinT; else if (playing) phaseT += dt; // (tests pin a moment of the move for screenshots)
    if (S.phase === 'enter') {
      const T = SCRIBBLE.enter, k = easeBack(Math.min(1, phaseT / 0.7));
      tg.mesh.visible = true; drawTangle(tg, k, 0.07 + 0.03 * Math.min(1, phaseT / 0.7), boil);
      parts.patch.material.opacity = 1 - Math.min(1, phaseT / 0.7); parts.ring.material.opacity = Math.min(1, phaseT / 0.7);
      S.camK = S.mode === 'behind' ? Math.max(0, Math.min(1, (phaseT - T.camFrom) / T.cam)) : 0;
      if (phaseT >= T.go && S.pinT == null) { S.phase = 'fight'; phaseT = 0; say('Go!', 0.7); }
    } else if (S.phase === 'fight') {
      drawTangle(tg, 1, 0.1, boil);
      const want = S.mode === 'behind' ? 1 : 0;
      if (playing) S.camK = want > S.camK ? Math.min(want, S.camK + dt / SCRIBBLE.enter.cam) : Math.max(want, S.camK - dt / SCRIBBLE.enter.cam);
      if (S.mode === 'eyes' && S.camK < 0.5) { keepInRing(); followInput(); } else behindInput();
      if (playing && !S.manual) F.step(dt);
      if (game.creatures) game.creatures.spawnTimer = Math.max(game.creatures.spawnTimer || 0, 1); // no new wild creature while you fight
      if (F.over === false && playing && ((S.dropT = (S.dropT || 0) + dt) > 0.5)) { S.dropT = 0; for (const w of [...(game.creatures?.list || [])]) if (Math.hypot(w.pos.x - C.x, w.pos.z - C.z) < FIGHT.R + 2) game.creatures.remove(w); }
    } else if (S.phase === 'exit') {
      const E = SCRIBBLE.exit, k = Math.max(0, phaseT - E.wait * 0.5);
      S.exitFrom ??= S.camK;
      S.camK = S.exitFrom * (1 - Math.max(0, Math.min(1, (phaseT - E.wait * 0.7) / E.cam)));
      if (S.result) { // the ring fades away: the colours come back
        const fade = Math.max(0, 1 - k / E.fade);
        drawTangle(tg, 1, 0.1 * fade + 0.001, boil); parts.ring.material.opacity = fade; parts.patch.material.opacity = 0;
      } else { // the scribble lets go of the ring and becomes a knot again
        const back = 1 - Math.min(1, k / 0.8);
        drawTangle(tg, back, 0.07, boil); parts.ring.material.opacity = back; parts.patch.material.opacity = 1 - back;
      }
      if (S.camK <= 0 && phaseT > E.wait + 0.5 && S.pinT == null) { S.exitFrom = null; finishExit(); }
    }
    if (!S.fight) { placeCamera(camera, dt); return; }
    events();
    drawModels(dt);
    drawFx(dt);
    placeCamera(camera, dt);
    drawBars(); drawSquad(); drawPad(); pointers();
    if (typeof document !== 'undefined') document.getElementById('crosshair')?.classList.toggle('sc-behind', S.camK > 0.5);
  };

  // ---- the rest of the game asks
  S.can = () => !!parts && S.phase !== 'off';
  S.toggleCam = (say2 = true) => {
    S.mode = S.mode === 'behind' ? 'eyes' : 'behind';
    try { localStorage.setItem(SCRIBBLE.key, S.mode); } catch { /* private window */ }
    if (say2 && game.ui) game.ui.toast(S.mode === 'behind' ? '🎥 Fight camera: behind your creature' : '🎥 Fight camera: in your eyes');
    S.refresh();
    return S.mode;
  };
  S.setMode = m => { if (m !== S.mode) S.toggleCam(false); return S.mode; };
  // a tap during a fight picks the monster under the finger (true = the tap was the fight's)
  S.tap = (x, y) => {
    if (!S.fighting) return false;
    if (S.phase !== 'fight') return true;
    let best = null, bd = 70;
    for (const f of S.fight.foes) if (f.alive) {
      const v = tmp.a.set(f.x, f.y + 0.8, f.z).project(game.camera);
      if (v.z > 1) continue;
      const d = Math.hypot((v.x * 0.5 + 0.5) * innerWidth - x, (-v.y * 0.5 + 0.5) * innerHeight - y);
      if (d < bd) { bd = d; best = f; }
    }
    if (best) S.fight.pick(best);
    return true;
  };
  // the pause screen's camera button (made once, shown only while the patch is here; Cube Planets' own button sits beside it)
  let btn = null;
  S.refresh = () => {
    if (typeof document === 'undefined') return;
    if (!btn) {
      const sound2 = document.getElementById('sound-btn');
      if (!sound2) return;
      btn = document.createElement('button'); btn.id = 'fightcam-btn';
      btn.addEventListener('click', e => { e.stopPropagation(); S.toggleCam(false); });
      sound2.after(btn); sound2.after(document.createTextNode(' '));
    }
    const s = S.can() ? (S.mode === 'behind' ? '🎥 Fight: behind' : '🎥 Fight: eyes') : '';
    btn.textContent = s; btn.classList.toggle('hidden', !s);
  };
  setInterval(() => S.refresh(), 1000);
  // tests and the console
  S.info = () => ({ on: true, phase: S.phase, mode: S.mode, camK: +S.camK.toFixed(3), armed: S.armed, spot: S.spot && { x: S.spot.x, y: S.spot.y, z: S.spot.z, walls: S.spot.walls, range: S.spot.range },
    fight: S.fight?.info() ?? null, avatar: !!avatar?.visible, you: !!you?.visible, cube: !!cube?.visible });
  S.fightOf = () => S.fight;
  S.warp = () => { // tests: stand just outside the patch, facing it, with a clear walk in (the side of the start first)
    const p = game.player, C = S.spot, G = S.ground, a0 = Math.atan2(game.spawnPoint.x - C.x, game.spawnPoint.z - C.z);
    const clear = (x, z) => { let y = G.floor(x, z, C.y + 4); for (let s = 0; s <= 1; s += 0.05) { const ny = G.stand(x + (C.x - x) * s * 0.6, z + (C.z - z) * s * 0.6, y, 0.5, 1); if (ny == null || ny !== y) return false; } return true; };
    let x = 0, z = 0;
    for (let k = 0; k < 24; k++) {
      const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.26;
      x = C.x + Math.sin(a) * (FIGHT.patch + 3); z = C.z + Math.cos(a) * (FIGHT.patch + 3);
      if (clear(x, z)) break;
    }
    p.pos.set(x, G.floor(x, z, C.y + 4), z); p.vel.set(0, 0, 0);
    p.yaw = Math.atan2(-(C.x - x), -(C.z - z)); p.pitch = -0.1;
    return { x, z };
  };
  return S;
}
