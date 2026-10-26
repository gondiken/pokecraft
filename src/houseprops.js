// T40a.5: the Giant House's puzzle things as real models (owner 2026-10-26: "the cat in blocks didn't look like a cat, I didn't
// think that grey thing was the spoon"). Blocks still do the walking and climbing (invisible or plain ones under a model); these
// meshes only show what a thing IS, so a child can guess what it does. 1 block = 3 cm (giantland.js): a cat is about 15 blocks
// long, a serving spoon 12, a ball of yarn 3. Every builder returns a THREE.Group whose origin is the middle of its foot print on
// the floor it stands on, +z = its front, with `userData.parts` (named pieces a live part may move) and `userData.dispose()`.
// Imports only three; textures are small canvases.
import * as THREE from 'three';

const mat = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const shiny = (color, o = {}) => new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0xffffff, ...o });
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function mesh(geo, material, [x, y, z] = [0, 0, 0], parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}
function finish(group, parts = {}) {
  group.userData.parts = parts;
  group.userData.dispose = () => group.traverse(o => {
    o.geometry?.dispose();
    for (const m of [o.material].flat()) { if (!m) continue; m.map?.dispose(); m.dispose(); }
  });
  return group;
}
// A tube along `points` whose radius goes from r0 to r1 (tails, chains of fluff, a yarn strand).
function taperTube(points, r0, r1, segs = 40, sides = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segs, 1, sides, false);
  const pos = geo.attributes.position, nor = geo.attributes.normal, P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const k = i / segs, r = r0 + (r1 - r0) * k, c = curve.getPointAt(k);
    for (let j = 0; j <= sides; j++) {
      const v = i * (sides + 1) + j;
      N.fromBufferAttribute(nor, v);
      P.copy(c).addScaledVector(N, r);
      pos.setXYZ(v, P.x, P.y, P.z);
    }
  }
  pos.needsUpdate = true;
  return geo;
}
const ball = (r, ws = 24, hs = 16) => new THREE.SphereGeometry(r, ws, hs);

/* ---------------------------------- the cat ---------------------------------- */
// A ginger tabby: stripes painted on a canvas that wraps the body and the head (u = round, v = top to bottom).
function tabby(w, h, rows, belly = true) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#e8924a'; g.fillRect(0, 0, w, h);
    if (belly) {
    const grad = g.createLinearGradient(0, h * 0.55, 0, h); grad.addColorStop(0, 'rgba(250,228,196,0)'); grad.addColorStop(0.35, '#f8e4c6'); grad.addColorStop(1, '#f8e4c6');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    }
    g.fillStyle = '#b8642e';
    for (let k = 0; k < rows; k++) { // stripes run from the back down the sides, thinning out
      const x = (k + 0.5) * w / rows;
      g.beginPath(); g.moveTo(x - 5, 0); g.quadraticCurveTo(x + 9, h * 0.25, x - 2, h * 0.5); g.lineTo(x + 3, h * 0.5); g.quadraticCurveTo(x + 13, h * 0.22, x + 5, 0); g.fill();
    }
  });
}
// pose: 'sleep' (curled up, eyes shut, tail round the front) or 'stand' (on four legs, eyes open, tail up).
export function buildCat({ pose = 'sleep' } = {}) {
  const cat = new THREE.Group(), parts = {};
  const glow = { emissive: 0x2a1a0e }; // fur never shades to grey
  const fur = mat(0xffffff, { map: tabby(256, 64, 12), ...glow }), furHead = mat(0xffffff, { map: tabby(128, 64, 6, false), ...glow });
  const rings = canvasTex(128, 16, (c, w, h) => { c.fillStyle = '#e8924a'; c.fillRect(0, 0, w, h); c.fillStyle = '#b8642e'; for (let x = 6; x < w; x += 16) c.fillRect(x, 0, 6, h); });
  const tailFur = mat(0xffffff, { map: rings, emissive: 0x2a1a0e });
  const cream = mat(0xfff0dc, { emissive: 0x3a3028 }), pink = mat(0xf2a0a8, { emissive: 0x3a1a1a }), dark = mat(0x3a2418), ginger = mat(0xe8924a), white = mat(0xffffff);
  const sleep = pose === 'sleep';
  // body: an egg, longer than wide; sleeping it lies low, standing it is lifted on its legs
  const body = mesh(ball(1), fur, [0, sleep ? 2.6 : 5.6, -1], cat);
  body.scale.set(3.8, sleep ? 2.7 : 2.6, sleep ? 6.4 : 6.6);
  parts.body = body;
  // legs: four rounded posts with cream paws; sleeping, only the front paws show, tucked under the chin
  parts.legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 2.2, sleep ? 0.8 : 4.4, sz > 0 ? 3.0 : -5.0);
    if (sleep && sz < 0) continue;
    const len = sleep ? 0 : 4.0;
    if (len) mesh(new THREE.CapsuleGeometry(0.95, len - 1.4, 6, 12), fur, [0, -len / 2 + 0.3, 0], leg);
    const paw = mesh(ball(1.1, 16, 12), cream, [0, -len + 0.15, sleep ? 1.6 : 0.4], leg);
    paw.scale.set(1, 0.6, sleep ? 1.9 : 1.4);
    cat.add(leg); parts.legs.push(leg);
  }
  // head: a ball with cheeks, a muzzle, a pink nose, ears (pink inside), eyes (shut = curved lines, open = green with slits), whiskers
  const head = new THREE.Group();
  head.position.set(sleep ? -0.6 : 0, sleep ? 3.0 : 8.6, sleep ? 5.2 : 6.0);
  if (sleep) head.rotation.set(0.25, -0.35, 0.35); // resting on the paws, tilted
  cat.add(head); parts.head = head;
  const skull = mesh(ball(2.7), furHead, [0, 0, 0], head); skull.scale.set(1.15, 0.95, 1);
  for (const s of [-1, 1]) { const cheek = mesh(ball(0.95, 16, 12), cream, [s * 0.75, -0.95, 2.15], head); cheek.scale.set(1, 0.75, 0.75); }
  const chin = mesh(ball(0.7, 12, 10), cream, [0, -1.55, 2.0], head); chin.scale.set(1, 0.6, 0.8);
  const nose = mesh(new THREE.ConeGeometry(0.42, 0.45, 3), pink, [0, -0.35, 2.75], head); nose.rotation.set(-Math.PI / 2, Math.PI, 0); nose.scale.set(1.2, 1, 0.6);
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * 1.55, 2.0, -0.2); ear.rotation.set(-0.15, 0, -s * 0.38); head.add(ear);
    mesh(new THREE.ConeGeometry(1.05, 2.0, 4), furHead, [0, 0.7, 0], ear).rotation.y = Math.PI / 4;
    const inner = mesh(new THREE.ConeGeometry(0.62, 1.4, 4), pink, [0, 0.55, 0.38], ear); inner.rotation.y = Math.PI / 4;
    if (sleep) { // shut eyes: a soft dark arc, smiling down
      const lid = mesh(new THREE.TorusGeometry(0.55, 0.11, 6, 14, Math.PI), dark, [s * 1.05, 0.55, 2.42], head);
      lid.rotation.set(-0.3, s * 0.35, Math.PI);
    } else {
      const eye = mesh(ball(0.62, 16, 12), mat(0x9ad84a), [s * 1.05, 0.5, 2.25], head); eye.scale.set(1, 1.1, 0.5);
      const slit = mesh(ball(0.5, 10, 8), dark, [s * 1.05, 0.5, 2.52], head); slit.scale.set(0.25, 1.05, 0.2);
      mesh(ball(0.14, 8, 6), white, [s * 1.05 + 0.18, 0.78, 2.6], head);
    }
    for (let k = -1; k <= 1; k++) { // whiskers
      const w = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 4), white, [s * 2.1, -0.7 + k * 0.28, 2.3], head);
      w.rotation.set(0, 0, Math.PI / 2 + k * 0.12 * s); w.rotation.y = -s * 0.25;
    }
  }
  const mouth = mesh(new THREE.TorusGeometry(0.3, 0.06, 4, 10, Math.PI), dark, [0, -0.95, 2.62], head); mouth.rotation.z = Math.PI;
  // tail: a thick tube with a darker tip; sleeping it wraps round the front, standing it rises with a curl at the top
  const tailPts = sleep
    ? [[2.4, 1.4, -6.6], [4.4, 1.0, -4.0], [4.8, 0.9, 0.5], [3.6, 0.9, 4.4], [1.0, 0.9, 7.4], [-2.4, 0.9, 7.6]]
    : [[0, 6.6, -7.2], [0, 8.6, -8.6], [0, 11.6, -8.8], [0, 13.6, -7.8], [0.0, 14.2, -6.6]];
  const tail = mesh(taperTube(tailPts, 1.0, 0.75), tailFur, [0, 0, 0], cat);
  const tipAt = tailPts[tailPts.length - 1];
  mesh(ball(0.85, 14, 10), mat(0xb8642e), tipAt, cat);
  parts.tail = tail;
  if (sleep) { // a breathing belly: live parts scale parts.body by 1 + 0.03 sin(t)
    parts.breathe = body;
  }
  cat.traverse(o => { o.castShadow = false; });
  return finish(cat, parts);
}

/* ---------------------------------- the spoon seesaw ---------------------------------- */
// A silver serving spoon (12 long) lying across a cotton reel: the bowl end down at -z (you stand in it), the handle end up at +z
// (something heavy lands on it and you fly). parts.spoon tilts round x (negative = handle up) (the live part turns it when something lands on the other end).
export function buildSpoonSeesaw({ tilt = -0.42 } = {}) {
  const g = new THREE.Group(), parts = {};
  const silver = shiny(0xd8dce6, { shininess: 120 });
  // the cotton reel: two wooden rims and blue thread wound between them, lying on its side (axis along x)
  const reel = new THREE.Group(); reel.position.set(0, 1.0, 0); g.add(reel);
  const wood = mat(0xd8a868);
  for (const s of [-1, 1]) { const rim = mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 24), wood, [s * 1.25, 0, 0], reel); rim.rotation.z = Math.PI / 2; }
  const thread = canvasTex(64, 32, (c, w, h) => { c.fillStyle = '#3a7ad8'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,0.35)'; for (let y = 1; y < h; y += 3) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + 1); c.stroke(); } });
  const spool = mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.2, 24), mat(0xffffff, { map: thread }), [0, 0, 0], reel); spool.rotation.z = Math.PI / 2;
  // the spoon, pivoting on the reel's top
  const spoon = new THREE.Group(); spoon.position.set(0, 2.05, 0); spoon.rotation.x = tilt; g.add(spoon); parts.spoon = spoon;
  // bowl: a squashed half sphere (inside up), at -z
  const bowl = mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), silver, [0, 0.55, -4.6], spoon);
  bowl.scale.set(2.3, 0.7, 3.0);
  bowl.material.side = THREE.DoubleSide;
  // a thin rim line so the bowl reads as a dish from above
  const rim = mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), shiny(0xf4f6fa), [0, 0.55, -4.6], spoon); rim.rotation.x = Math.PI / 2; rim.scale.set(2.3, 3.0, 1);
  // neck and handle: a flat strip, narrow at the neck, widening to a rounded end at +z
  const outline = new THREE.Shape();
  outline.moveTo(-0.4, -1.8); outline.lineTo(0.4, -1.8); outline.quadraticCurveTo(0.5, 2.0, 1.0, 5.6); outline.absarc(0, 5.6, 1.0, 0, Math.PI, false);
  outline.quadraticCurveTo(-0.5, 2.0, -0.4, -1.8);
  const strip = new THREE.ExtrudeGeometry(outline, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 2 });
  strip.rotateX(Math.PI / 2); // shape y -> z
  mesh(strip, silver, [0, 0.62, 0], spoon);
  return finish(g, parts);
}

/* ---------------------------------- the sink plug ---------------------------------- */
// A black rubber plug with a ring on top and a chain of links to `chainTo` (a point relative to the plug, e.g. the tap).
export function buildPlug({ chainTo = [0, 0, -4] } = {}) {
  const g = new THREE.Group(), parts = {};
  const rubber = mat(0x2a2a30), metal = shiny(0xd8dce6);
  const plug = mesh(new THREE.CylinderGeometry(0.75, 0.62, 0.5, 24), rubber, [0, 0.25, 0], g);
  mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 16), metal, [0, 0.56, 0], g);
  const ring = mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 16), metal, [0, 0.9, 0], g);
  parts.plug = plug;
  // the chain: from the ring down onto the counter, then along it to `chainTo` (lying flat, links touching)
  const end = new THREE.Vector3(...chainTo);
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.15, 0), new THREE.Vector3(0.1, 0.5, -0.5), new THREE.Vector3(end.x * 0.3, 0.08, end.z * 0.3 - 0.6), new THREE.Vector3(end.x, Math.max(0.08, end.y), end.z)]);
  const n = Math.max(4, Math.round(path.getLength() / 0.36));
  for (let i = 0; i < n; i++) {
    const p = path.getPointAt((i + 0.5) / n), q = path.getPointAt(Math.min(1, (i + 0.6) / n));
    const link = mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 12), metal, [p.x, p.y, p.z], g);
    link.lookAt(q); link.rotateY(Math.PI / 2); if (i % 2) link.rotateX(Math.PI / 2);
  }
  ring.rotation.x = 0;
  return finish(g, parts);
}

/* ---------------------------------- the marble ---------------------------------- */
export function buildMarble({ r = 0.45 } = {}) {
  const g = new THREE.Group();
  const swirl = canvasTex(128, 64, (c, w, h) => {
    const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#bfe8ff'); bg.addColorStop(1, '#6ab8f0'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    for (const [col, off] of [['#f84a6a', 0], ['#ffd23a', 0.33], ['#4ad87a', 0.66]]) {
      c.strokeStyle = col; c.lineWidth = 7; c.beginPath();
      for (let x = 0; x <= w; x += 4) { const y = h / 2 + Math.sin((x / w + off) * Math.PI * 4) * h * 0.28; if (x) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
    }
  });
  mesh(ball(r, 24, 16), shiny(0xffffff, { map: swirl, shininess: 140 }), [0, r, 0], g);
  mesh(ball(r * 0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), [-r * 0.4, r * 1.55, r * 0.55], g); // the glint
  return finish(g, { ball: g.children[0] });
}

/* ---------------------------------- the ruler ---------------------------------- */
// A wooden ruler with marks and a groove down the middle, `length` long along +z from the origin (the marble's slide).
export function buildRuler({ length = 14 } = {}) {
  const g = new THREE.Group();
  const marks = canvasTex(32, 256, (c, w, h) => {
    c.fillStyle = '#f2d27a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5a3a1a';
    for (let k = 0; k < 64; k++) { const y = k * 4, long = k % 5 === 0; c.fillRect(0, y, long ? 12 : 6, 1); c.fillRect(w - (long ? 12 : 6), y, long ? 12 : 6, 1); }
    c.fillStyle = 'rgba(120,80,30,0.35)'; c.fillRect(w / 2 - 3, 0, 6, h); // the groove
  });
  marks.wrapT = THREE.RepeatWrapping; marks.repeat.set(1, length / 6);
  const strip = mesh(new THREE.BoxGeometry(1.3, 0.16, length), [mat(0xd8b860), mat(0xd8b860), mat(0xffffff, { map: marks }), mat(0xd8b860), mat(0xd8b860), mat(0xd8b860)], [0, 0, length / 2], g);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.1, 0.16, length), mat(0xb8983a), [s * 0.6, 0.12, length / 2], g); // little rails
  return finish(g, { strip });
}

/* ---------------------------------- the wind-up key ---------------------------------- */
// A brass butterfly key, standing up out of a small box on the floor (the fan's timer). parts.key turns round z while it runs.
export function buildWindKey() {
  const g = new THREE.Group(), parts = {};
  const brass = shiny(0xd8a83a, { shininess: 70, specular: 0xfff0b0 });
  mesh(new THREE.BoxGeometry(2.0, 1.2, 1.4), mat(0x3a7ad8), [0, 0.6, 0], g);           // the timer box
  mesh(new THREE.BoxGeometry(2.1, 0.15, 1.5), mat(0xffd23a), [0, 1.25, 0], g);
  const key = new THREE.Group(); key.position.set(0, 1.3, 0); g.add(key); parts.key = key;
  mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 10), brass, [0, 0.55, 0], key);   // the shaft
  for (const s of [-1, 1]) { // two wings: flat loops (a torus squashed in z)
    const wing = mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 20), brass, [s * 0.72, 1.45, 0], key);
    wing.scale.set(1.15, 0.9, 1);
  }
  mesh(ball(0.24, 12, 8), brass, [0, 1.35, 0], key);
  return finish(g, parts);
}

/* ---------------------------------- the ball of yarn ---------------------------------- */
// A ball of red yarn (radius 1.4: 8 cm) with a loose strand trailing on the floor behind it (-z).
export function buildYarn({ r = 1.4, color = '#e04a5a' } = {}) {
  const g = new THREE.Group(), parts = {};
  const wool = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = color; c.fillRect(0, 0, w, h);
    c.lineWidth = 3;
    for (let k = 0; k < 70; k++) { // wound threads: many crossing sine bands
      const a = (k * 37) % 180, y0 = (k * 53) % h, light = k % 3 === 0;
      c.strokeStyle = light ? 'rgba(255,255,255,0.28)' : 'rgba(80,0,10,0.32)';
      c.beginPath();
      for (let x = 0; x <= w; x += 6) { const y = y0 + Math.sin(x / w * Math.PI * 2 + a) * h * 0.3; if (x) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
    }
  });
  const yarn = mesh(ball(r, 28, 18), mat(0xffffff, { map: wool }), [0, r, 0], g); parts.ball = yarn;
  const strand = mesh(taperTube([[0.2, r * 0.3, -r * 0.9], [0.8, 0.12, -r - 0.6], [-0.3, 0.1, -r - 2.0], [0.6, 0.1, -r - 3.4], [0.2, 0.1, -r - 4.6]], 0.11, 0.09, 30, 6), mat(new THREE.Color(color).getHex()), [0, 0, 0], g);
  parts.strand = strand;
  return finish(g, parts);
}

/* ---------------------------------- the tea towel ---------------------------------- */
// A red and white checked tea towel thrown over the fan (owner 2026-10-26: a sock did not read): a cloth that follows the
// stepped housing (`steps` = [radius, top] pairs from the inside out) and hangs down to the floor round it. Origin = the fan's
// middle on the floor. parts.cloth slides off when you pull it.
export function buildTowel({ size = 12.5, steps = [[3.5, 3], [4.5, 2], [5.5, 1]] } = {}) {
  const g = new THREE.Group();
  const check = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    const n = 8, k = w / n;
    c.fillStyle = 'rgba(216,58,58,0.55)';
    for (let i = 0; i < n; i += 2) { c.fillRect(i * k, 0, k, h); c.fillRect(0, i * k, w, k); }
    c.fillStyle = 'rgba(216,58,58,0.6)';
    for (let i = 0; i < n; i += 2) for (let j = 0; j < n; j += 2) c.fillRect(i * k, j * k, k, k);
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; // a fringe along two edges
    for (let x = 2; x < w; x += 6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 7); c.moveTo(x, h); c.lineTo(x, h - 7); c.stroke(); }
  });
  const seg = 40, geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    let y = 0; // the top of the housing under this point, rounded so the cloth folds over the edges
    for (const [rr, top] of steps) y = Math.max(y, top * (1 - sm(rr - 0.2, rr + 0.9, r)) + (top - 1) * sm(rr - 0.2, rr + 0.9, r));
    y += 0.4 + 0.12 * Math.sin(x * 1.3 + z * 0.7) * sm(1, 6, r); // soft wrinkles away from the middle
    pos.setY(i, Math.max(0.05, y));
  }
  geo.computeVertexNormals();
  const cloth = mesh(geo, mat(0xffffff, { map: check, side: THREE.DoubleSide, emissive: 0x201010 }), [0, 0, 0], g);
  return finish(g, { cloth });
}

/* ---------------------------------- Nibbles' sticky notes ---------------------------------- */
// A yellow sticky note (2.4 square) with a child's crayon drawing: `draw(c, w, h)` paints on a 256 x 256 canvas. Stands on its
// own little lean (a note stuck to the wall uses `{ wall: true }`).
export function buildNote(draw, { wall = false } = {}) {
  const g = new THREE.Group();
  const pic = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#ffe866'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(0, 0, w, 26); // the sticky strip
    c.lineCap = 'round'; c.lineJoin = 'round';
    draw(c, w, h);
  });
  const paper = mesh(new THREE.PlaneGeometry(2.4, 2.4), mat(0xffffff, { map: pic, side: THREE.DoubleSide }), [0, 1.2, 0], g);
  if (!wall) { paper.position.set(0, 1.4, 0); paper.rotation.x = -0.2; mesh(new THREE.BoxGeometry(2.0, 0.3, 0.6), mat(0x8a5a2a), [0, 0.15, 0.05], g); } // in a little wooden stand
  return finish(g, { paper });
}
// The drawings (crayon lines on a 256 square). Each tells one puzzle without words.
const crayon = (c, color, width = 9) => { c.strokeStyle = color; c.fillStyle = color; c.lineWidth = width; };
const arrow = (c, x0, y0, x1, y1) => {
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 22 * Math.cos(a - 0.5), y1 - 22 * Math.sin(a - 0.5)); c.moveTo(x1, y1); c.lineTo(x1 - 22 * Math.cos(a + 0.5), y1 - 22 * Math.sin(a + 0.5)); c.stroke();
};
const catFace = (c, x, y, s, awake) => { // a round cat head with ears and whiskers
  c.beginPath(); c.arc(x, y, 26 * s, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(x - 22 * s, y - 12 * s); c.lineTo(x - 18 * s, y - 40 * s); c.lineTo(x - 4 * s, y - 24 * s); c.moveTo(x + 22 * s, y - 12 * s); c.lineTo(x + 18 * s, y - 40 * s); c.lineTo(x + 4 * s, y - 24 * s); c.stroke();
  for (const sx of [-1, 1]) {
    if (awake) { c.beginPath(); c.arc(x + sx * 10 * s, y - 4 * s, 4 * s, 0, Math.PI * 2); c.fill(); } else { c.beginPath(); c.arc(x + sx * 10 * s, y - 6 * s, 6 * s, 0.2, Math.PI - 0.2); c.stroke(); }
    c.beginPath(); c.moveTo(x + sx * 14 * s, y + 8 * s); c.lineTo(x + sx * 40 * s, y + 4 * s); c.moveTo(x + sx * 14 * s, y + 12 * s); c.lineTo(x + sx * 40 * s, y + 16 * s); c.stroke();
  }
};
export const NOTES = {
  // push the yarn off the bench -> the cat jumps down after it -> run up the books
  yarn(c) {
    crayon(c, '#e04a5a', 10); c.beginPath(); c.arc(64, 96, 24, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(50, 84); c.lineTo(80, 110); c.moveTo(46, 100); c.lineTo(72, 76); c.stroke();
    crayon(c, '#2a2a2a', 6); arrow(c, 96, 96, 150, 190);
    crayon(c, '#e8924a', 8); catFace(c, 192, 110, 1, true);
    crayon(c, '#2a2a2a', 6); arrow(c, 180, 150, 196, 196);
    crayon(c, '#e04a5a', 8); c.beginPath(); c.arc(170, 222, 14, 0, Math.PI * 2); c.stroke();
  },
  // a seesaw: something drops on one end, the mouse flies off the other
  spoon(c) {
    crayon(c, '#8a8a96', 10); c.beginPath(); c.moveTo(30, 190); c.lineTo(226, 150); c.stroke();
    crayon(c, '#3a7ad8', 10); c.beginPath(); c.arc(128, 186, 16, 0, Math.PI * 2); c.stroke();
    crayon(c, '#e04a5a', 9); c.beginPath(); c.arc(206, 70, 14, 0, Math.PI * 2); c.stroke();
    crayon(c, '#2a2a2a', 6); arrow(c, 206, 92, 206, 132);
    crayon(c, '#8a8a96', 7); c.beginPath(); c.arc(50, 170, 10, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(43, 160, 4, 0, Math.PI * 2); c.arc(57, 160, 4, 0, Math.PI * 2); c.stroke();
    crayon(c, '#2a2a2a', 6); c.setLineDash([10, 12]); c.beginPath(); c.moveTo(50, 150); c.quadraticCurveTo(80, 40, 140, 60); c.stroke(); c.setLineDash([]); arrow(c, 130, 56, 146, 62);
  },
  // the plug in the hole first, then the tap
  plug(c) {
    crayon(c, '#2a2a2a', 9); c.beginPath(); c.ellipse(70, 140, 34, 14, 0, 0, Math.PI * 2); c.stroke(); c.fillRect(56, 104, 28, 22);
    crayon(c, '#2a2a2a', 7); c.font = 'bold 54px sans-serif'; c.fillText('1', 50, 80); c.fillText('2', 170, 80);
    crayon(c, '#8a8a96', 10); c.beginPath(); c.moveTo(160, 200); c.lineTo(160, 110); c.lineTo(210, 110); c.lineTo(210, 130); c.stroke();
    crayon(c, '#3a9ae8', 9); for (const y of [150, 172, 194]) { c.beginPath(); c.moveTo(204, y); c.lineTo(216, y + 10); c.stroke(); }
  },
  // wind the key, then run into the wind
  fan(c) { // 1 pull the towel off, 2 wind the key, 3 ride the wind up
    crayon(c, '#2a2a2a', 6); c.font = 'bold 34px sans-serif'; c.fillText('1', 14, 66); c.fillText('2', 140, 66); c.fillText('3', 14, 176);
    crayon(c, '#d83a3a', 6); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) c.fillRect(44 + i * 18, 44 + j * 18, 18, 18);
    c.strokeRect(44, 44, 54, 54); crayon(c, '#2a2a2a', 5); arrow(c, 100, 72, 128, 50);
    crayon(c, '#3a7ad8', 6); c.fillRect(168, 92, 60, 30); // the box with the key on top
    crayon(c, '#c8901a', 6); c.beginPath(); c.moveTo(198, 92); c.lineTo(198, 70); c.stroke();
    c.beginPath(); c.ellipse(184, 60, 13, 9, 0, 0, Math.PI * 2); c.ellipse(212, 60, 13, 9, 0, 0, Math.PI * 2); c.stroke();
    crayon(c, '#2a2a2a', 5); c.beginPath(); c.arc(198, 62, 32, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); arrow(c, 222, 42, 228, 50); // round and round
    crayon(c, '#8a8a96', 7); c.beginPath(); c.ellipse(120, 226, 54, 13, 0, 0, Math.PI * 2); c.stroke();
    crayon(c, '#3a9ae8', 5); for (const x of [92, 120, 148]) { c.beginPath(); c.moveTo(x, 212); c.quadraticCurveTo(x + 8, 180, x, 140); c.stroke(); }
    crayon(c, '#8a8a96', 6); c.beginPath(); c.arc(120, 150, 11, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(112, 139, 5, 0, Math.PI * 2); c.arc(128, 139, 5, 0, Math.PI * 2); c.stroke(); // a mouse going up
    crayon(c, '#2a2a2a', 5); arrow(c, 150, 170, 150, 128);
  },
};
