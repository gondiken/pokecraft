// T22: the home UI (game.homeUi): meter in the HUD, red glow + floor outline in the world, the home panel
// ('What can my home be?' / home / preview) and the spinning example model. Everything here reads game.homes (active home,
// results, report) and HOME_TYPES (a home is every type it qualifies for, T30.5); there are no home type ids in this file.
//
// Contract used by the rest of the game (keep these names):
//   homeUi.open(view, typeId)   view = 'types' | 'home' | 'preview' (default 'home'; typeId only for 'preview'; 'choose' = 'types'); called by ui.openPanel('home') AFTER #home is shown
//   homeUi.close()      called by ui.closePanel() (always, whatever is open); stop rendering the preview here
//   homeUi.update(now)  every frame from main.js frame() (now = ms); meter / glow / pulse / preview render
//   homeUi.state()      for tests: { view, yaw, pitch, zoom, blinkOn, missing: [...] }
//   homeUi.sparkles()   for tests: [{ owner, x, y, z, count }] (homes that sparkle right now)
//   homeUi.want         view that game.openHome(view) asked for before the panel opened (read it in open(), default 'home')
// DOM: #home-meter (in #hud, hidden by default), #home (overlay, .panel inside), #home-body (render into it), #home-close.
import * as THREE from 'three';
import { BLOCKS, TILE_COUNT, isOccluder, drawBlockIcon } from './blocks.js';
import { FACES } from './world.js';
import { HOME_TYPES } from './hometypes.js';
import { TYPE_COLORS } from './species.js';
import { sparkleGeometry } from './shapes.js';

const GLOW_MAX = 64;
const el = (tag, cls = '', attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'on') for (const [n, f] of Object.entries(v)) e.addEventListener(n, f);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};

/* ---------------------------- example model mesh ---------------------------- */

// Blocks [x, y, z, id, tag] -> one Mesh per tag, hidden faces left out. Returns { groups: Map(tag -> Mesh), size: [w, h, d] }.
export function blockMesh(blocks, texture) {
  const at = new Map(blocks.map(b => [`${b[0]},${b[1]},${b[2]}`, b[3]]));
  const bufs = new Map();
  let mx = 0, my = 0, mz = 0;
  for (const [x, y, z, id, tag] of blocks) {
    mx = Math.max(mx, x + 1); my = Math.max(my, y + 1); mz = Math.max(mz, z + 1);
    const def = BLOCKS[id];
    if (!def) continue;
    let buf = bufs.get(tag);
    if (!buf) bufs.set(tag, buf = { pos: [], uv: [], col: [], idx: [] });
    for (const f of FACES) {
      const n = at.get(`${x + f.dir[0]},${y + f.dir[1]},${z + f.dir[2]}`);
      if (n !== undefined && isOccluder(n)) continue;
      const tile = f.kind === 'top' ? def.top : f.kind === 'bottom' ? def.bottom : def.side;
      const base = buf.pos.length / 3;
      for (const [cx, cy, cz, u, v] of f.corners) {
        buf.pos.push(x + cx, y + cy, z + cz);
        buf.uv.push((tile + (u ? 0.999 : 0.001)) / TILE_COUNT, v);
        buf.col.push(f.shade, f.shade, f.shade);
      }
      buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  const material = new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, alphaTest: 0.5 });
  const groups = new Map();
  for (const [tag, b] of bufs) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx);
    groups.set(tag, new THREE.Mesh(geo, material));
  }
  return { groups, size: [mx, my, mz], material };
}

/* ------------------------------- the meter ------------------------------- */

const NO_CHECKS = { walls: false, roof: null, size: null, floor: null };

// A type is on the meter when it is done or has started (its rule or any feature has have > 0).
const started = res => res.finished || (res.rule?.have ?? 0) > 0 || res.features.some(f => f.have > 0);
const shownTypes = home => Object.values(HOME_TYPES).filter(t => home.resultOf(t.id) && started(home.resultOf(t.id)));
const countText = f => `${f.have}/${f.need}`;

// How far along a started type is (for the hint): rule done counts 1, then done/need.
const progress = res => (res.rule?.done ? 1 : 0) + res.done / Math.max(1, res.need);

// What the room report says, as one short line. Generic: reads the report and the results only.
export function hintFor(home) {
  const r = home.report, c = r?.checks ?? NO_CHECKS;
  if (!r?.found) return 'Put the Doormat inside, by the door.';
  if (!c.walls) {
    if (!r.door) return 'Make a door: 1 or 2 wide, 2 high.';
    return r.holes.wall.length ? 'Close the red gaps in the walls.' : 'Close the walls all round.';
  }
  if (c.roof === false) return 'Fill the red holes in the roof.';
  if (c.size === 'small') return 'Make the room at least 8 by 8.';
  if (c.floor === false) return 'Fill the red holes in the floor.';
  if (c.roof == null || c.size == null) return 'Close the walls all round.';
  const done = home.types.map(id => HOME_TYPES[id]).filter(Boolean);
  const open = shownTypes(home).filter(t => !home.is(t.id));
  const next = open.sort((a, b) => progress(home.resultOf(b.id)) - progress(home.resultOf(a.id)))[0];
  if (!done.length && !next) return 'What can it be? Open "What can my home be?" to see.';
  if (!next && done.every(t => home.resultOf(t.id).full)) return 'All done! Creatures love it.';
  const parts = [];
  if (done.length) parts.push(`It is ${done.map(t => `a ${t.name.split(' ')[0]} home`).join(' and ')}!`);
  if (next) {
    const res = home.resultOf(next.id);
    if (res.rule && !res.rule.done) parts.push(`${next.name}: needs ${res.rule.name}.`);
    else parts.push(`Add more for a ${next.name}: ${res.features.filter(f => !f.done).map(f => (res.show === 'counter' ? `${f.name} (${countText(f)})` : f.name)).join(', ')}.`);
  }
  return parts.join(' ');
}

function meterKey(game, home) {
  const r = home.report;
  return JSON.stringify([home.owner, home.name, game.playerId, r?.found, r?.size, r?.doorRuns, r?.checks, home.types,
    Object.values(HOME_TYPES).map(t => { const s = home.resultOf(t.id); return s && [t.id, s.rule && [s.rule.have, s.rule.need], s.features.map(f => [f.have, f.need]), s.finished, s.full]; })]);
}

// One type's progress: [emoji (+ name when big)] [rule] [features: hearts or "have/need"] [tick when done]. Meter and cards use it.
function typeLine(atlas, t, res, { big = false, name = true } = {}) {
  const icon = id => { const c = drawBlockIcon(atlas, id, 48); c.className = 'bi'; return c; };
  const line = el('div', `hm-line${res.finished ? ' done' : ''}`, { 'data-type': t.id },
    name ? el('span', 'hm-tname', { text: big ? `${t.emoji} ${t.name}` : t.emoji }) : null);
  if (res.rule) {
    line.append(el('div', `feat rule${res.rule.done ? ' done' : ''}`, { 'data-key': res.rule.key },
      icon(res.rule.icon), el('span', `badge ${res.rule.done ? 'ok' : 'bad'}`, { text: res.rule.done ? '✅' : '❌' }),
      el('span', 'count', { text: countText(res.rule) }), big ? el('span', 'lbl', { text: res.rule.name }) : null));
  }
  for (const f of res.features) {
    const under = res.show === 'counter' ? el('span', 'count', { text: countText(f) }) : el('span', `heart${f.done ? ' on' : ''}`, { text: '♥' });
    line.append(el('div', `feat${f.done ? ' done' : ''}`, { 'data-key': f.key }, icon(f.icon), under, big ? el('span', 'lbl', { text: f.name }) : null));
  }
  if (res.finished) line.append(el('span', 'hm-tick', { text: '✅' }));
  return line;
}

function meterEl(game, atlas, home, { big = false } = {}) {
  const root = el('div', `hm${big ? ' big' : ''}`);
  const mine = home.owner === game.playerId;
  const who = mine ? 'Your home' : `${home.name || 'A friend'}'s home`;
  if (home.finished) root.classList.add('ready');
  root.append(el('div', 'hm-title', {}, el('b', '', { text: who }),
    ...home.types.map(id => HOME_TYPES[id]).filter(Boolean).map(t => el('span', 'hm-type', { text: `${t.emoji} ${t.name}` }))));
  const row = el('div', 'hm-row room');
  const chk = (cls, icon, label, v, extra = '') => {
    const st = v === true || v === 'ok' ? 'ok' : v === false || v === 'small' ? 'bad' : 'unk';
    return el('div', `chk ${cls} ${st}`, {}, el('span', 'ico', { text: icon }), el('span', 'badge', { text: st === 'ok' ? '✅' : st === 'bad' ? '❌' : '❔' }),
      extra ? el('span', 'sub', { text: extra }) : null, big ? el('span', 'lbl', { text: label }) : null);
  };
  const c = home.report?.checks ?? NO_CHECKS, size = home.report?.size;
  row.append(chk('walls', '🧱', 'Walls', c.walls), chk('roof', '🏠', 'Roof', c.roof), chk('size', '📏', 'Size', c.size, size ? `${size[0]}x${size[1]}` : ''));
  root.append(row);
  for (const t of shownTypes(home)) root.append(typeLine(atlas, t, home.resultOf(t.id), { big }));
  return root;
}

/* --------------------------- sparkle on treasure homes --------------------------- */

// A home whose type has `sparkle` glitters (never a block, never saved or sent): one InstancedMesh of 10 four-point
// stars per such home within SPARK_RANGE, twinkling like the creature sparkle.
const SPARK_GEO = sparkleGeometry(0.22);
const SPARK_MAT = new THREE.MeshBasicMaterial({ color: 0xfff2b0, side: THREE.DoubleSide });
const SPARK_RANGE = 32, SPARK_N = 10;
function sparkSpots(report) { // inside cells next to the walls, 10 evenly spread, moved a bit towards the wall
  const inside = new Set(report.inside.map(([x, z]) => `${x},${z}`)), cells = [];
  for (const [x, z] of report.inside) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inside.has(`${x + dx},${z + dz}`)) { cells.push({ x, z, dx, dz }); break; }
    }
  }
  cells.sort((a, b) => (a.x * 1000 + a.z) - (b.x * 1000 + b.z));
  const n = Math.min(SPARK_N, cells.length);
  return Array.from({ length: n }, (_, i) => {
    const c = cells[Math.floor(i * cells.length / n)];
    return [c.x + 0.5 + c.dx * 0.42, report.f + 1.4 + (i * 7 % 3) * 0.7, c.z + 0.5 + c.dz * 0.42];
  });
}

/* --------------------------------- the UI --------------------------------- */

export function createHomeUi(game, { atlas, texture }) {
  const state = { view: null, yaw: 0, pitch: 0, zoom: 1, blinkOn: true, missing: [] };
  const body = document.getElementById('home-body');
  const meterBox = document.getElementById('home-meter');
  const touchMode = () => document.body.classList.contains('touch');

  /* ---- meter in the HUD ---- */
  let meterShown = null; // key of what is drawn
  if (meterBox) {
    meterBox.addEventListener('pointerdown', e => { e.stopPropagation(); });
    meterBox.addEventListener('click', e => { e.stopPropagation(); if (touchMode()) game.openHome(); });
  }
  function updateMeter() {
    if (!meterBox) return;
    const home = game.homes.active;
    const show = !!home && game.started && !game.inBattle && !game.ui.panelOpen;
    meterBox.classList.toggle('hidden', !show);
    if (!show) { meterShown = null; return; }
    const key = meterKey(game, home);
    if (key === meterShown) return;
    meterShown = key;
    meterBox.replaceChildren(meterEl(game, atlas, home));
  }

  /* ---- red glow + floor outline: 2 draw calls ---- */
  let glow = null, outline = null, glowFor = null, glowActive = null;
  function ensureGlow() {
    if (glow) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.4, depthWrite: false });
    glow = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), mat, GLOW_MAX);
    glow.count = 0; glow.frustumCulled = false; glow.visible = false; glow.renderOrder = 5;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Array(24).fill(0), 3));
    outline = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.9 }));
    outline.frustumCulled = false; outline.visible = false; outline.renderOrder = 5;
    game.scene.add(glow, outline);
  }
  const m4 = new THREE.Matrix4();
  function refreshGlow(home, pos) {
    const r = home?.report;
    glowFor = r ?? null; glowActive = home ?? null;
    let cells = [];
    if (r?.found) cells = [...r.holes.wall, ...r.holes.roof, ...r.holes.floor];
    if (cells.length > GLOW_MAX && pos) {
      cells.sort((a, b) => Math.hypot(a[0] + .5 - pos.x, a[2] + .5 - pos.z) - Math.hypot(b[0] + .5 - pos.x, b[2] + .5 - pos.z));
    }
    cells = cells.slice(0, GLOW_MAX);
    glow.count = cells.length;
    cells.forEach(([x, y, z], i) => { m4.makeTranslation(x + .5, y + .5, z + .5); glow.setMatrixAt(i, m4); });
    glow.instanceMatrix.needsUpdate = true;
    const small = r?.found && r.checks.size === 'small' && r.box;
    if (small) {
      const { x0, x1, z0, z1 } = r.box, y = r.f + 1.02, X1 = x1 + 1, Z1 = z1 + 1;
      outline.geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        x0, y, z0, X1, y, z0, X1, y, z0, X1, y, Z1, X1, y, Z1, x0, y, Z1, x0, y, Z1, x0, y, z0], 3));
    }
    outline.visible = !!small;
  }
  function updateGlow(now) {
    const home = game.homes.active;
    const on = !!home && game.started && !game.inBattle;
    if (!on) { if (glow) { glow.visible = false; outline.visible = false; glowFor = null; glowActive = null; } return; }
    ensureGlow();
    if (home.report !== glowFor || home !== glowActive) refreshGlow(home, game.player?.pos);
    glow.visible = glow.count > 0;
    const pulse = 0.425 + 0.175 * Math.sin(now / 1000 * Math.PI * 2);
    glow.material.opacity = pulse;
    outline.material.opacity = 0.5 + pulse;
  }

  /* ---- sparkle (T30.5) ---- */
  const sparks = new Map(); // home -> { mesh, spots, report }
  const sm = new THREE.Matrix4(), sq = new THREE.Quaternion(), sp = new THREE.Vector3(), ss = new THREE.Vector3(), sz = new THREE.Vector3(0, 0, 1);
  function updateSparkle(now) {
    const pos = game.player?.pos, want = new Set();
    if (pos && game.started) {
      for (const h of game.homes.list) {
        if (h.report?.found && Object.values(HOME_TYPES).some(t => t.sparkle && h.is(t.id)) && Math.hypot(pos.x - h.x, pos.z - h.z) <= SPARK_RANGE) want.add(h);
      }
    }
    for (const [h, e] of sparks) if (!want.has(h)) { game.scene.remove(e.mesh); e.mesh.dispose?.(); sparks.delete(h); }
    for (const h of want) {
      let e = sparks.get(h);
      if (!e) {
        const mesh = new THREE.InstancedMesh(SPARK_GEO, SPARK_MAT, SPARK_N);
        mesh.frustumCulled = false;
        game.scene.add(mesh);
        sparks.set(h, e = { mesh, spots: [], report: null });
      }
      if (e.report !== h.report) { e.report = h.report; e.spots = sparkSpots(h.report); e.mesh.count = e.spots.length; }
      const t = now / 1000;
      e.spots.forEach(([x, y, z], i) => {
        const period = 1.5 + (i % 3) * 0.3, k = ((t + i * 0.37) % period) / 0.45;
        const a = k < 1 ? Math.sin(k * Math.PI) : 0.001;
        sq.setFromAxisAngle(sz, k < 1 ? k * 0.8 : 0);
        sm.compose(sp.set(x, y, z), sq, ss.set(a, a, a));
        e.mesh.setMatrixAt(i, sm);
      });
      e.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /* ---- the small renderer (preview + chooser pictures), made on first use and kept ---- */
  let renderer = null, canvas = null;
  const scene = new THREE.Scene();
  const pivot = new THREE.Group();
  scene.add(pivot);
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 400);
  let model = null; // { groups, size, material, type, lastMissing }
  function ensureRenderer() {
    if (renderer) return;
    canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
  }
  function clearModel() {
    if (!model) return;
    pivot.remove(...pivot.children);
    for (const m of model.groups.values()) m.geometry.dispose();
    model.material.dispose();
    model = null;
  }
  function loadModel(type) {
    clearModel();
    const m = blockMesh(type.example.blocks, texture);
    const [w, h, d] = m.size;
    for (const mesh of m.groups.values()) { mesh.position.set(-w / 2, -h / 2, -d / 2); pivot.add(mesh); }
    model = { ...m, type, lastMissing: null };
  }
  function drawModel(yaw, pitch, zoom) {
    const [w, h, d] = model.size, R = Math.hypot(w, h, d) / 2, dist = R * 3.1 / zoom;
    pivot.rotation.y = yaw;
    camera.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  const pics = new Map();
  function picture(type) {
    if (pics.has(type.id)) return pics.get(type.id);
    ensureRenderer();
    loadModel(type);
    renderer.setPixelRatio(1);
    renderer.setSize(240, 180, false);
    camera.aspect = 240 / 180; camera.updateProjectionMatrix();
    drawModel(Math.PI + 0.5, 0.4, 1.15);
    const url = canvas.toDataURL('image/png');
    pics.set(type.id, url);
    clearModel();
    return url;
  }

  /* ---- panel ---- */
  const ui = { atlas, texture, want: null };
  let drag = false; // a finger or the mouse is turning the model
  let resumeAt = 0, lastNow = 0, lastDraw = 0, roofOn = false, panelKey = null, previewEl = null, previewType = null, previewId = null;

  const viewHome = () => game.homes.active ?? game.homes.onMat ?? game.homes.mine();
  const closePanel = () => document.getElementById('home-close')?.click();

  // 'What can my home be?': one card per type with its own progress and a house to look at. Nothing to pick.
  function renderTypes() {
    const home = viewHome();
    panelKey = home ? meterKey(game, home) : 'none';
    const cards = el('div', 'hm-cards');
    for (const t of Object.values(HOME_TYPES)) {
      const col = TYPE_COLORS[t.creature] ?? '#888';
      const img = el('img', 'hm-pic', { alt: t.name, width: 240, height: 180 });
      img.src = picture(t);
      const res = home?.resultOf(t.id);
      cards.append(el('div', 'card hm-card', { 'data-type': t.id }, img,
        el('b', '', { text: home?.is(t.id) ? `${t.emoji} ${t.name} ✅` : `${t.emoji} ${t.name}` }),
        el('span', 'chip', { text: t.creature, style: `background:${col}` }), el('small', '', { text: t.blurb }),
        res ? el('div', 'hm in-card', {}, typeLine(atlas, t, res, { big: true, name: false })) : null,
        el('button', 'hm-show', { 'data-act': 'preview', 'data-type': t.id, type: 'button', on: { click: () => ui.open('preview', t.id) } }, '🏠 Show me a house')));
    }
    body.replaceChildren(...[el('h2', '', { text: 'What can my home be?' }),
      home ? el('p', 'hm-hint', { text: hintFor(home) }) : el('p', 'hm-hint', { text: 'Put a Doormat in the floor to make a home. Find it in the Blocks panel.' }),
      cards,
      home ? el('div', 'hm-btns', {}, el('button', '', { 'data-act': 'back', type: 'button', on: { click: () => ui.open('home') } }, 'My home')) : null].filter(Boolean));
  }

  function renderHome() {
    const home = viewHome();
    panelKey = home ? meterKey(game, home) : 'none';
    const typesBtn = el('button', 'primary', { 'data-act': 'types', type: 'button', on: { click: () => ui.open('types') } }, '✨ What can my home be?');
    if (!home) {
      body.replaceChildren(el('h2', '', { text: 'Homes' }), el('p', 'hm-hint', { text: 'Put a Doormat in the floor to make a home. Find it in the Blocks panel.' }),
        el('div', 'hm-btns', {}, typesBtn));
      return;
    }
    body.replaceChildren(meterEl(game, atlas, home, { big: true }), el('p', 'hm-hint', { text: hintFor(home) }), el('div', 'hm-btns', {}, typesBtn));
  }

  // Failing room checks + the rule + features not done, of the home you are looking at (if it is the shown type).
  function missingKeys(home) {
    const res = previewType && home?.resultOf(previewType.id);
    if (!res) return [];
    const m = [];
    if (!res.room.walls) m.push('walls');
    if (res.room.roof === false) m.push('roof');
    if (res.room.floor === false) m.push('floor');
    if (res.rule && !res.rule.done) m.push(res.rule.key);
    for (const f of res.features) if (!f.done) m.push(f.key);
    return m;
  }

  function renderPreview() {
    const home = viewHome();
    const type = HOME_TYPES[previewId] ?? Object.values(HOME_TYPES)[0];
    if (!type) { renderHome(); return; }
    previewType = type;
    ensureRenderer();
    loadModel(type);
    const w = Math.max(220, Math.min(window.innerWidth - 90, 420)), h = Math.round(w * 0.76);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, true);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    canvas.className = 'hm-canvas';
    Object.assign(state, { yaw: Math.PI + 0.5, pitch: 0.85, zoom: 1, blinkOn: true, missing: [] });
    resumeAt = 0; drag = false; lastDraw = 0;
    wireCanvas();
    const icons = el('div', 'hm-icons');
    icons.append(el('span', 'pv', { 'data-key': 'walls' }, '🧱'), el('span', 'pv', { 'data-key': 'roof' }, '🏠'));
    if (type.rule) icons.append(el('span', 'pv', { 'data-key': type.rule.key }, drawBlockIcon(atlas, type.rule.icon, 40)));
    for (const f of type.features) icons.append(el('span', 'pv', { 'data-key': f.key, title: f.name }, drawBlockIcon(atlas, f.icon, 40)));
    const roofBtn = el('button', '', { 'data-act': 'roof', type: 'button' }, roofOn ? '🏠 Roof: on' : '🏠 Roof: off');
    roofBtn.addEventListener('click', () => { roofOn = !roofOn; roofBtn.textContent = roofOn ? '🏠 Roof: on' : '🏠 Roof: off'; applyVisibility(); });
    previewEl = el('div', 'hm-stage', {}, canvas);
    body.replaceChildren(el('h2', '', { text: type.name }), previewEl, icons, el('p', 'hm-hint', { text: 'Drag to turn. Pinch or scroll to zoom.' }),
      el('div', 'hm-btns', {}, el('button', '', { 'data-act': 'back', type: 'button', on: { click: () => ui.open('types') } }, 'Back'), roofBtn));
    applyVisibility();
  }

  function applyVisibility() {
    if (!model) return;
    const miss = new Set(state.missing);
    for (const [tag, mesh] of model.groups) {
      mesh.visible = tag === 'roof' && !roofOn ? false : (miss.has(tag) ? state.blinkOn : true);
    }
    for (const p of body.querySelectorAll('.pv')) {
      p.classList.toggle('miss', miss.has(p.dataset.key));
      p.classList.toggle('off', miss.has(p.dataset.key) && !state.blinkOn);
    }
    lastDraw = 0;
  }

  // Drag turns, two fingers pinch, the wheel zooms. Pointer events with capture, so it works with mouse and touch.
  function wireCanvas() {
    if (canvas._wired) return;
    canvas._wired = true;
    const ptrs = new Map();
    let pinch = 0;
    const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    canvas.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag = true;
      if (ptrs.size === 2) pinch = dist();
    });
    canvas.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      e.stopPropagation();
      if (ptrs.size === 1) {
        state.yaw += (e.clientX - p.x) * 0.012;
        state.pitch = Math.min(1.4, Math.max(0.1, state.pitch + (e.clientY - p.y) * 0.01));
        p.x = e.clientX; p.y = e.clientY;
      } else {
        p.x = e.clientX; p.y = e.clientY;
        const d = dist();
        if (pinch > 0 && d > 0) state.zoom = Math.min(2, Math.max(0.6, state.zoom * d / pinch));
        pinch = d;
      }
      lastDraw = 0;
    });
    const up = e => {
      if (!ptrs.delete(e.pointerId)) return;
      e.stopPropagation();
      pinch = ptrs.size === 2 ? dist() : 0;
      if (!ptrs.size) { drag = false; resumeAt = lastNow + 2000; }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      state.zoom = Math.min(2, Math.max(0.6, state.zoom * Math.exp(-e.deltaY * 0.0015)));
      lastDraw = 0;
    }, { passive: false });
  }

  ui.open = (view = 'home', typeId = null) => {
    if (!body) return;
    if (view === 'choose') view = 'types';
    if (view === 'preview') previewId = typeId ?? previewId;
    state.view = view;
    if (view !== 'preview') { clearModel(); previewEl = null; }
    if (view === 'types') renderTypes();
    else if (view === 'preview') renderPreview();
    else renderHome();
  };
  ui.close = () => { state.view = null; clearModel(); previewEl = null; drag = false; meterShown = null; };

  ui.update = now => {
    const dt = Math.min(1, Math.max(0, (now - lastNow) / 1000)); // real time: frames can be slow on tablets and in tests lastNow = now;
    updateMeter();
    updateGlow(now);
    updateSparkle(now);
    if (state.view === 'home' || state.view === 'types') {
      const home = viewHome();
      if ((home ? meterKey(game, home) : 'none') !== panelKey) (state.view === 'home' ? renderHome : renderTypes)();
    }
    if (state.view !== 'preview' || !model) return;
    state.missing = missingKeys(viewHome());
    const blink = Math.floor(now / 400) % 2 === 0, miss = state.missing.join();
    if (blink !== state.blinkOn || miss !== model.lastMissing) { state.blinkOn = blink; model.lastMissing = miss; applyVisibility(); }
    if (!drag && now >= resumeAt) state.yaw += 0.35 * dt;
    if (now - lastDraw < 33) return;
    lastDraw = now;
    drawModel(state.yaw, state.pitch, state.zoom);
  };
  ui.sparkles = () => [...sparks].map(([h, e]) => ({ owner: h.owner, x: h.x, y: h.y, z: h.z, count: e.mesh.count }));
  ui.state = () => ({ ...state, missing: [...state.missing] });
  return ui;
}
