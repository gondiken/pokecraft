// T43: the Funfair's rides and prizes as real models (a bumper car is not a block, a carousel horse is not a block): the bumper car
// fleet (six parked cars, six bumper bots and their balloons), the carousel (a striped canopy that turns, 24 painted horses on poles),
// the rings, the trampoline balloons, the coaster car, the Ferris wheel, the slide tube and a pool of confetti. Blocks still do the
// walking (the arena floor, the deck, the mat, the rails); these meshes only show what a thing IS. Everything is made of a few merged
// geometries with vertex colours and instanced where there are many (draw calls: cars 1, bot heads 1, bumper balloons 1, carousel 2,
// rings 1, balloons 1, coaster car 1, Ferris wheel 3, slide 1, confetti 1).
// Every builder returns a THREE.Group with `userData.parts` (named pieces the live part moves) and `userData.dispose()`.
// Imports only three and fairgames.js numbers. No Math.random: confetti flies on hashes of its slot.
import * as THREE from 'three';
import { CAROUSEL, RINGS, RINGS_HARD, SILVER, STAGE, SLIDE, makeHelix, BOT_COLORS, BALLOON_COLORS, TRAMP, BAYS } from './fairgames.js';

const TAU = Math.PI * 2;
const lambert = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// A list of [geometry, hex colour, optional matrix] -> one non-indexed geometry with position, normal and colour attributes.
function merge(list) {
  const pos = [], nor = [], col = [];
  for (const [geo0, hex, mx] of list) {
    const geo = geo0.index ? geo0.toNonIndexed() : geo0;
    if (mx) geo.applyMatrix4(mx);
    const p = geo.attributes.position, n = geo.attributes.normal;
    _c.setHex(hex);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(_c.r, _c.g, _c.b); }
    geo.dispose(); if (geo !== geo0) geo0.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const bx = (w, h, d, x, y, z, c, ry = 0, rx = 0) => [new THREE.BoxGeometry(w, h, d), c, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1))];
const cy = (rt, rb, h, x, y, z, c, seg = 10) => [new THREE.CylinderGeometry(rt, rb, h, seg), c, new THREE.Matrix4().makeTranslation(x, y, z)];
const sp = (r, x, y, z, c, sx = 1, sy = 1, sz = 1, seg = 12) => [new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), c, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz))];

function finish(group, parts = {}) {
  group.userData.parts = parts;
  group.userData.fair = true;
  group.userData.dispose = () => group.traverse(o => {
    if (o.isMesh) { o.geometry?.dispose(); for (const m of [o.material].flat()) { m?.map?.dispose(); m?.dispose(); } }
  });
  return group;
}
const tag = (m, parent) => { m.userData.fair = true; m.frustumCulled = false; parent?.add(m); return m; };
const hide = (inst, i) => { _m.makeScale(0, 0, 0); inst.setMatrixAt(i, _m); };

/* ------------------------------------------------ bumper cars ------------------------------------------------ */

// A bumper car facing +z, feet on y 0 (white parts take the instance colour): a round body with a hood, a seat, a steering wheel, a black
// rubber fender all round, a pole at the back (the bot's balloon sits on it) and two headlights.
function carGeometry() {
  return merge([
    bx(1.5, 0.34, 1.7, 0, 0.32, 0, 0xffffff), bx(1.3, 0.22, 0.6, 0, 0.58, 0.55, 0xffffff), bx(1.1, 0.5, 0.18, 0, 0.78, -0.48, 0xffffff), bx(1.0, 0.1, 0.5, 0, 0.55, -0.2, 0x555566),
    bx(1.74, 0.2, 0.2, 0, 0.28, 0.88, 0x1c1c22), bx(1.74, 0.2, 0.2, 0, 0.28, -0.88, 0x1c1c22), bx(0.2, 0.2, 1.7, 0.86, 0.28, 0, 0x1c1c22), bx(0.2, 0.2, 1.7, -0.86, 0.28, 0, 0x1c1c22),
    bx(0.5, 0.05, 0.05, 0, 0.88, 0.2, 0x222228), bx(0.05, 0.3, 0.05, 0, 0.74, 0.28, 0x222228),
    cy(0.035, 0.035, 1.3, 0, 1.4, -0.85, 0x8a8a96, 6),
    bx(0.2, 0.12, 0.05, -0.45, 0.62, 0.86, 0xffe27a), bx(0.2, 0.12, 0.05, 0.45, 0.62, 0.86, 0xffe27a),
  ]);
}
// A bumper bot's round head (sits on the seat): silver, two black eyes, a smile, a little antenna with a red tip.
function headGeometry() {
  return merge([
    sp(0.34, 0, 1.05, -0.12, 0xe8f2ff), bx(0.11, 0.14, 0.05, -0.13, 1.1, 0.2, 0x101018), bx(0.11, 0.14, 0.05, 0.13, 1.1, 0.2, 0x101018), bx(0.04, 0.04, 0.05, -0.1, 1.15, 0.225, 0xffffff), bx(0.04, 0.04, 0.05, 0.16, 1.15, 0.225, 0xffffff),
    bx(0.3, 0.05, 0.05, 0, 0.93, 0.22, 0x101018), bx(0.05, 0.06, 0.05, -0.15, 0.96, 0.22, 0x101018), bx(0.05, 0.06, 0.05, 0.15, 0.96, 0.22, 0x101018), bx(0.1, 0.08, 0.05, -0.24, 1.0, 0.18, 0xff8aa8), bx(0.1, 0.08, 0.05, 0.24, 1.0, 0.18, 0xff8aa8),
    bx(0.04, 0.22, 0.04, 0, 1.45, -0.12, 0x555566), sp(0.07, 0, 1.58, -0.12, 0xff4a4a, 1, 1, 1, 8),
  ]);
}
// A party balloon on a stick (the stick's foot is at the origin; the balloon is white and takes the instance colour).
function balloonGeometry(r = 0.5, stick = 0.9) {
  return merge([sp(r, 0, stick + r * 1.05, 0, 0xffffff, 0.9, 1.1, 0.9, 12), bx(0.1, 0.1, 0.1, 0, stick - 0.02, 0, 0xddddcc, 0.8, 0.8), bx(0.025, stick, 0.025, 0, stick / 2, 0, 0xbbbbbb),
    bx(r * 0.5, r * 0.3, 0.03, -r * 0.25, stick + r * 1.5, r * 0.7, 0xffffff)]);
}

// The fleet: 12 cars (6 bays + 6 bots' cars; the bays hold your car too), 6 bot heads, 6 bumper balloons.
export function buildBumperFleet() {
  const group = new THREE.Group();
  const cars = tag(new THREE.InstancedMesh(carGeometry(), lambert(), 12), group);
  const heads = tag(new THREE.InstancedMesh(headGeometry(), lambert(), 6), group);
  const balloons = tag(new THREE.InstancedMesh(balloonGeometry(0.5, 0.9), lambert({ emissive: 0x303030 }), 6), group); // (a little glow: a balloon is never dull)
  const colors = [0xff5a6a, 0x4aa8ff, 0xffd23a, 0x6ad86a, 0xc88aff, 0xff9a3a];
  for (let i = 0; i < 12; i++) { cars.setColorAt(i, _c.setHex(i < 6 ? colors[i] : BOT_COLORS[i - 6])); hide(cars, i); }
  for (let i = 0; i < 6; i++) { heads.setColorAt(i, _c.setHex(0xffffff)); hide(heads, i); balloons.setColorAt(i, _c.setHex(BOT_COLORS[i])); hide(balloons, i); }
  const put = (inst, i, x, y, z, yaw, wob = 0, s = 1) => {
    _q.setFromEuler(_e.set(wob, yaw, 0, 'YXZ'));
    inst.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s)));
    inst.instanceMatrix.needsUpdate = true;
  };
  const parts = {
    cars, heads, balloons,
    // car slot i: 0..5 the parked ones (bays), 6..11 the bots' cars
    car: (i, x, y, z, yaw, wob = 0) => put(cars, i, x, y, z, yaw, wob),
    hideCar: i => { hide(cars, i); cars.instanceMatrix.needsUpdate = true; },
    head: (i, x, y, z, yaw, wob = 0) => put(heads, i, x, y, z, yaw, wob),
    balloon: (i, x, y, z, s = 1) => put(balloons, i, x, y, z, 0, 0, s),
    hideBalloon: i => { hide(balloons, i); balloons.instanceMatrix.needsUpdate = true; },
  };
  return finish(group, parts);
}

/* ------------------------------------------------ the carousel ------------------------------------------------ */

// A painted carousel horse facing +z, on y 0, about 1.5 long (white parts take the instance colour; the saddle is gold).
function horseGeometry() {
  const L = [
    bx(0.5, 0.5, 1.2, 0, 0.8, 0, 0xffffff), bx(0.52, 0.12, 0.8, 0, 0.62, 0.05, 0xff7aa8), bx(0.55, 0.1, 0.55, 0, 1.08, -0.1, 0xffc83a), bx(0.5, 0.04, 0.1, 0, 1.13, -0.1, 0xe03a4a),
    bx(0.24, 0.7, 0.3, 0, 1.3, 0.58, 0xffffff, 0, -0.35), bx(0.26, 0.3, 0.52, 0, 1.68, 0.88, 0xffffff), bx(0.2, 0.18, 0.2, 0, 1.6, 1.16, 0xffd8e0),
    bx(0.08, 0.18, 0.08, -0.1, 1.9, 0.78, 0xff7aa8), bx(0.08, 0.18, 0.08, 0.1, 1.9, 0.78, 0xff7aa8),
    bx(0.1, 0.5, 0.18, 0, 1.5, 0.4, 0xffc83a, 0, -0.35), bx(0.12, 0.5, 0.12, 0, 0.55, -0.75, 0xe03a4a, 0, 0.35),
    bx(0.12, 0.05, 0.05, -0.1, 1.74, 1.12, 0x101018), bx(0.12, 0.05, 0.05, 0.1, 1.74, 1.12, 0x101018),
    bx(0.14, 0.5, 0.14, -0.16, 0.38, 0.44, 0xffffff), bx(0.14, 0.5, 0.14, 0.16, 0.38, 0.44, 0xffffff), bx(0.14, 0.5, 0.14, -0.16, 0.38, -0.44, 0xffffff), bx(0.14, 0.5, 0.14, 0.16, 0.38, -0.44, 0xffffff),
  ];
  for (const x of [-0.16, 0.16]) for (const z of [0.44, -0.44]) L.push(bx(0.16, 0.1, 0.16, x, 0.1, z, 0x8a3a5a));
  return merge(L);
}
// The canopy and the poles turn as one (rotation.y = the carousel angle): a red-and-white striped cone, a gold rim of warm lights,
// a central column, 24 golden poles from the deck to the canopy. Dimensions from CAROUSEL.
function canopyGeometry() {
  const C = CAROUSEL, deckTop = C.seatY, under = deckTop + 4.8, h = 3.4, R = 10.2, N = 16;
  const L = [];
  const cone = new THREE.CylinderGeometry(0.35, R, h, N, 1, true).toNonIndexed(); // side only
  const p = cone.attributes.position, col = [];
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const sector = Math.floor(((Math.atan2(cz, cx) + Math.PI) / TAU) * N + 1e-6);
    _c.setHex(sector % 2 ? 0xfff6e6 : 0xe03a4a);
    for (let k = 0; k < 3; k++) col.push(_c.r, _c.g, _c.b);
  }
  cone.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  cone.translate(0, under + h / 2, 0);
  const out = merge([
    cy(0.7, 0.7, under - deckTop, 0, (under + deckTop) / 2, 0, 0xffd23a, 12), cy(1.2, 1.2, 0.5, 0, deckTop + 0.25, 0, 0xe84a6a, 12), [new THREE.CylinderGeometry(R + 0.1, R + 0.1, 0.35, 32, 1, true), 0xffd23a, new THREE.Matrix4().makeTranslation(0, under + 0.1, 0)],
    sp(0.3, 0, under + h + 0.15, 0, 0xffe94a, 1, 1.4, 1, 8),
  ]);
  // poles and rim lights
  const extra = [];
  for (let k = 0; k < C.spokes; k++) for (const r of C.lanes) {
    const a = (k / C.spokes) * TAU;
    extra.push(cy(0.05, 0.05, under - deckTop, r * Math.cos(a), (under + deckTop) / 2, -r * Math.sin(a), 0xffd23a, 6));
  }
  for (let k = 0; k < 32; k++) { const a = (k / 32) * TAU; extra.push(bx(0.28, 0.28, 0.28, (R + 0.2) * Math.cos(a), under - 0.1, -(R + 0.2) * Math.sin(a), k % 2 ? 0xfff2b0 : 0xffd23a)); }
  const poles = merge(extra);
  // join the three geometries (cone with colours, the merged parts, poles)
  const geos = [cone, out, poles], pos = [], nor = [], colr = [];
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); colr.push(...g.attributes.color.array);
    g.dispose();
  }
  const all = new THREE.BufferGeometry();
  all.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  all.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  all.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return all;
}
const HORSE_COLORS = [0xfff6e6, 0xffd0e0, 0xd0f0ff];
export function buildCarousel() {
  const C = CAROUSEL, group = new THREE.Group();
  const canopy = tag(new THREE.Mesh(canopyGeometry(), lambert({ side: THREE.DoubleSide, emissive: 0x5a4640 })), group); // (a little glow, so the underside you ride under is not dark)
  canopy.position.set(C.c[0], 0, C.c[1]);
  const horses = tag(new THREE.InstancedMesh(horseGeometry(), lambert(), C.spokes * C.lanes.length), group);
  for (let i = 0; i < C.spokes * C.lanes.length; i++) horses.setColorAt(i, _c.setHex(HORSE_COLORS[i % 3]));
  const parts = {
    canopy, horses,
    // angle = the carousel angle; bob(k, lane) = the horse's lift (fairgames.horseBob)
    set(angle, bob) {
      canopy.rotation.y = angle;
      let i = 0;
      for (let lane = 0; lane < C.lanes.length; lane++) for (let k = 0; k < C.spokes; k++, i++) {
        const a = (k / C.spokes) * TAU + angle, r = C.lanes[lane];
        _q.setFromEuler(_e.set(0, a + Math.PI, 0));
        horses.setMatrixAt(i, _m.compose(_p.set(C.c[0] + r * Math.cos(a), C.seatY - 0.55 + bob(k, lane), C.c[1] - r * Math.sin(a)), _q, _s.set(0.8, 0.8, 0.8)));
      }
      horses.instanceMatrix.needsUpdate = true;
    },
  };
  return finish(group, parts);
}

/* ------------------------------------------------ rings and balloons ------------------------------------------------ */

// Gold rings (one instanced mesh: the ten of a normal round, the twelve of a rematch, then the silver ones). A ring hangs at
// (angle a, lane radius) in the plane that you turn through.
export function buildRings() {
  const C = CAROUSEL, group = new THREE.Group();
  const geo = merge([[new THREE.TorusGeometry(C.ringR, 0.07, 6, 16), 0xffffff], [new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4), 0xaaaaaa, new THREE.Matrix4().makeTranslation(0, 0.75 + C.ringR, 0)]]);
  const list = [...RINGS.map(r => ({ ...r, silver: false })), ...RINGS_HARD.map(r => ({ ...r, silver: false })), ...SILVER.map(r => ({ ...r, silver: true }))];
  const nN = RINGS.length, nH = RINGS_HARD.length, total = list.length;
  const rings = tag(new THREE.InstancedMesh(geo, lambert(), total), group);
  list.forEach((r, i) => {
    rings.setColorAt(i, _c.setHex(r.silver ? 0xd8dce8 : 0xffd23a));
    const rad = C.lanes[r.lane], x = C.c[0] + rad * Math.cos(r.a), z = C.c[1] - rad * Math.sin(r.a), y = r.high && !r.silver ? C.highY : C.ringY;
    // the torus axis (z) turns along the way you travel past it: forward = (-sin a, -cos a)
    _q.setFromEuler(_e.set(0, Math.atan2(-Math.sin(r.a), -Math.cos(r.a)), 0));
    rings.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1)));
  });
  const base = list.map((_, i) => { rings.getMatrixAt(i, _m); return _m.clone(); });
  const parts = {
    rings, total,
    // caught = the gold ring indexes of this round (gone), silver = silver ring indexes (gone); t = a clock for the sway; hard = the rematch's table
    set(caught, silver, t, hard = false) {
      for (let i = 0; i < total; i++) {
        const gold = i < nN + nH, mine = i < nN ? !hard : gold ? hard : true;
        const gone = !mine || (i < nN ? caught.includes(i) : gold ? caught.includes(i - nN) : silver.includes(i - nN - nH));
        if (gone) hide(rings, i);
        else { base[i].decompose(_p, _q, _s); _e.set(Math.sin(t * 1.3 + i) * 0.08, 0, 0); _q.multiply(_q2.setFromEuler(_e)); rings.setMatrixAt(i, _m.compose(_p, _q, _s)); }
      }
      rings.instanceMatrix.needsUpdate = true;
    },
  };
  return finish(group, parts);
}
// The trampoline balloons (up to 8, bobbing in the air): ids by BALLOON_COLORS.
export function buildAirBalloons() {
  const group = new THREE.Group();
  const inst = tag(new THREE.InstancedMesh(balloonGeometry(TRAMP.r, 0.9), lambert({ emissive: 0x383838 }), 8), group);
  for (let i = 0; i < 8; i++) { inst.setColorAt(i, _c.setHex(BALLOON_COLORS[i])); hide(inst, i); }
  const parts = {
    inst,
    // b = { x, y, z } is the balloon's CENTRE; the model's centre sits 0.9 + r * 1.05 above its foot
    set(i, b, on = true, wob = 0) {
      if (!on) hide(inst, i);
      else inst.setMatrixAt(i, _m.compose(_p.set(b.x, b.y - (0.9 + TRAMP.r * 1.05), b.z), _q.setFromEuler(_e.set(0, wob, 0)), _s.set(1, 1, 1)));
      inst.instanceMatrix.needsUpdate = true;
    },
  };
  return finish(group, parts);
}

/* ------------------------------------------------ the coaster car, the wheel, the slide ------------------------------------------------ */

// The coaster car facing +z, feet on y 0: a red nose cone, two seats, a lap bar, white light bulbs along the sides.
export function buildCoasterCar() {
  const group = new THREE.Group();
  const L = [
    bx(1.3, 0.5, 2.6, 0, 0.5, 0, 0xe03a4a), bx(1.1, 0.3, 0.7, 0, 0.55, 1.5, 0xe03a4a), bx(0.8, 0.25, 0.4, 0, 0.5, 2.0, 0xe03a4a), bx(1.34, 0.12, 2.64, 0, 0.78, 0, 0xffd23a),
    bx(1.0, 0.6, 0.18, 0, 1.1, -0.9, 0xfff6e6), bx(1.0, 0.6, 0.18, 0, 1.1, 0.3, 0xfff6e6), bx(1.0, 0.12, 0.5, 0, 0.9, -0.55, 0x4a3a8a), bx(1.0, 0.12, 0.5, 0, 0.9, 0.65, 0x4a3a8a),
    bx(1.1, 0.08, 0.08, 0, 1.2, 0.95, 0x8a8a96), bx(0.08, 0.3, 0.08, -0.4, 1.05, 0.95, 0x8a8a96), bx(0.08, 0.3, 0.08, 0.4, 1.05, 0.95, 0x8a8a96),
  ];
  for (const z of [-1.1, -0.5, 0.1, 0.7, 1.3]) { L.push(bx(0.12, 0.12, 0.12, -0.7, 0.55, z, 0xfff2b0), bx(0.12, 0.12, 0.12, 0.7, 0.55, z, 0xfff2b0)); }
  for (const x of [-0.6, 0.6]) for (const z of [-0.9, 0.9]) L.push(cy(0.28, 0.28, 0.16, x, 0.28, z, 0x22222c, 10));
  const car = tag(new THREE.Mesh(merge(L), lambert()), group);
  car.position.y = -0.6; // its wheels on the rail, under the rider's feet
  return finish(group, { car });
}

// The Ferris wheel: a rim of pink and cream segments with spokes (turns), 8 gondolas that stay upright (instanced), and a string of
// bulbs round the rim that lights up when the fair wakes. The plane is x = c[0]; it turns once in 60 s.
export function buildFerrisWheel(wheel) {
  const [cx, cyy, cz] = wheel.c, R = wheel.r, N = 24, group = new THREE.Group();
  const bulbs = [];
  // build the rim in the wheel's own frame: x = the axle, (y, z) = the plane. A segment's long side follows the tangent.
  const parts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, len = (TAU * R) / N + 0.2;
    for (const dx of [-0.5, 0.5]) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(dx, Math.sin(a) * R, Math.cos(a) * R), new THREE.Quaternion().setFromEuler(new THREE.Euler(-a - Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1));
      parts.push([new THREE.BoxGeometry(0.3, 0.3, len), i % 2 ? 0xfff6e6 : 0xff8ac8, m]);
    }
    if (i % 2 === 0) { // a spoke pair every other segment, a hub
      const m = new THREE.Matrix4().compose(new THREE.Vector3(0, Math.sin(a) * R / 2, Math.cos(a) * R / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(-a, 0, 0)), new THREE.Vector3(1, 1, 1));
      parts.push([new THREE.BoxGeometry(0.2, 0.2, R), 0xc8ccd8, m]);
    }
    const bm = new THREE.Matrix4().makeTranslation(0, Math.sin(a) * (R + 0.35), Math.cos(a) * (R + 0.35));
    bulbs.push([new THREE.BoxGeometry(0.4, 0.4, 0.4), 0xffe27a, bm]);
  }
  parts.push([new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12).rotateZ(Math.PI / 2), 0xffd23a]);
  const spin = new THREE.Group();
  spin.position.set(cx, cyy, cz);
  const rimMesh = tag(new THREE.Mesh(merge(parts), lambert()), spin);
  const lights = tag(new THREE.Mesh(merge(bulbs), new THREE.MeshBasicMaterial({ vertexColors: true })), spin);
  lights.visible = false;
  group.add(spin);
  const cabin = merge([bx(1.7, 0.2, 1.5, 0, 0, 0, 0xffd23a), bx(1.7, 1.0, 0.1, 0, 0.6, 0.7, 0xffffff), bx(1.7, 1.0, 0.1, 0, 0.6, -0.7, 0xffffff), bx(0.1, 1.0, 1.5, 0.8, 0.6, 0, 0xffffff), bx(0.1, 1.0, 1.5, -0.8, 0.6, 0, 0xffffff),
    bx(1.9, 0.14, 1.7, 0, 1.2, 0, 0xe03a4a), bx(0.06, 0.9, 0.06, 0, 1.7, 0, 0x8a8a96)]);
  const cabins = tag(new THREE.InstancedMesh(cabin, lambert(), 8), group);
  for (let i = 0; i < 8; i++) cabins.setColorAt(i, _c.setHex([0x4aa8ff, 0xff8ac8, 0xffd23a, 0x6ad86a][i % 4]));
  const parts2 = {
    spin, rim: rimMesh, lights, cabins,
    // angle = how far it has turned (radians); lit = the bulbs
    set(angle, lit) {
      spin.rotation.x = angle;
      lights.visible = !!lit;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - angle; // (a point of the rim that turns by `angle` sits at the parameter a0 - angle)
        cabins.setMatrixAt(i, _m.compose(_p.set(cx, cyy + Math.sin(a) * R - 1.7, cz + Math.cos(a) * R), _q.identity(), _s.set(1, 1, 1)));
      }
      cabins.instanceMatrix.needsUpdate = true;
    },
  };
  return finish(group, parts2);
}

// The slide: a see-through tube of pink and cream rings round the helix (the player's feet are 0.2 above its floor).
export function buildSlide() {
  const group = new THREE.Group(), h = makeHelix();
  const pts = [];
  for (let i = 0; i <= 240; i++) { const w = h.at((i / 240) * SLIDE.time); pts.push(new THREE.Vector3(w.x, w.y + 0.85, w.z)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 240, 1.25, 10, false).toNonIndexed();
  const col = [], p = geo.attributes.position;
  for (let i = 0; i < p.count; i += 3) { const ring = Math.floor(i / (10 * 6)); _c.setHex(ring % 2 ? 0xfff6e6 : 0xff8ac8); for (let k = 0; k < 3; k++) col.push(_c.r, _c.g, _c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const tube = tag(new THREE.Mesh(geo, lambert({ side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false })), group);
  return finish(group, { tube });
}

/* ------------------------------------------------ confetti ------------------------------------------------ */

// A pool of little paper squares that fly out of a pop and fall (closed forms of their start time and slot; 1 draw call).
const BITS = 72, LIFE = 0.9;
const COLORS = [0xff8ac8, 0xfff2a0, 0x8ad8ff, 0xffffff, 0xff5a6a, 0x6ad86a];
export function buildConfetti() {
  const group = new THREE.Group(), geo = new THREE.PlaneGeometry(0.2, 0.2);
  const inst = tag(new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false }), BITS), group);
  const bits = Array.from({ length: BITS }, () => ({ t0: -9, x: 0, y: 0, z: 0 }));
  let next = 0;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < BITS; i++) { inst.setColorAt(i, _c.setHex(COLORS[i % COLORS.length])); hide(inst, i); }
  const parts = {
    inst,
    burst(x, y, z, now, n = 10) { for (let k = 0; k < n; k++) { const b = bits[next]; next = (next + 1) % BITS; b.t0 = now; b.x = x; b.y = y; b.z = z; b.slot = next; } },
    update(now, cam) {
      for (let i = 0; i < BITS; i++) {
        const b = bits[i], k = (now - b.t0) / LIFE;
        if (k < 0 || k > 1) { hide(inst, i); continue; }
        const a = hash(i * 3.1) * TAU, sp = 1.5 + hash(i * 5.7) * 2.5, up = 2 + hash(i * 7.3) * 3, t = k * LIFE;
        _p.set(b.x + Math.cos(a) * sp * t, b.y + up * t - 5 * t * t, b.z + Math.sin(a) * sp * t);
        _q.copy(cam.quaternion).multiply(_q2.setFromEuler(_e.set(0, 0, t * 6 + i)));
        inst.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(Math.max(0.01, 1 - k * 0.5))));
      }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
  return finish(group, parts);
}

export { BAYS, STAGE };
