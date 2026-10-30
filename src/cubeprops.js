// Cube Planets: the games' models (cubelive.js). Plain three.js, no game imports. Every builder returns a Group whose userData.dispose()
// frees its geometry and materials (and textures); nothing here is a block, nothing is saved. Owner 2026-10-30 (after playing the
// redesign): the things must look like what they are: spring flowers that look bouncy, a saucer ferry instead of a plain moon, telescope
// pieces that look like 🔭, a swirl door back to the Meadow Cube instead of "home flowers", the next pebble glowing, the Orbikit's "!".
import * as THREE from 'three';

const lam = (color, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });
const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
function disposer(g, ...tex) {
  g.userData.dispose = () => {
    for (const t of tex) t?.dispose();
    g.traverse(o => { if (o.isMesh || o.isSprite) { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
  };
  return g;
}
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
// A canvas texture (only in a browser: in Node the models stay plain).
function canvasTex(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const hex = n => `#${n.toString(16).padStart(6, '0')}`;

// The way back to the Meadow Cube (owner 2026-10-30: "it's not clear why flowers would teleport us back to 'home' ... Could it be a portal
// or swirl door?"): a little swirl door in the Meadow Cube's green and gold, standing on its pad. Step into it (stand in it a moment) and it
// puffs you back to the Meadow Cube. The group's origin is the face under it; it turns slowly (userData.spin) so it reads from every side,
// its swirl turns (userData.disc).
export const MEADOW = { ring: 0x46b878, gold: 0xffd84a, swirl: [0x9ff0a8, 0x3aa86a] };
export function buildBackSwirl() {
  const g = new THREE.Group(), spin = new THREE.Group(), disc = new THREE.Group();
  spin.position.y = 0.95; g.add(spin); spin.add(disc);
  add(spin, new THREE.TorusGeometry(0.62, 0.1, 8, 28), lam(MEADOW.ring, 0x0c3018));
  const fm = lam(MEADOW.gold, 0x5a4a08), fg = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; add(spin, fg, fm, Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0); } // little gold flowers round the ring
  const tex = canvasTex(128, 128, (x, w) => {
    const grd = x.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
    grd.addColorStop(0, '#fffbe0'); grd.addColorStop(0.35, hex(MEADOW.swirl[0])); grd.addColorStop(1, hex(MEADOW.swirl[1]));
    x.fillStyle = grd; x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 5;
    for (let arm = 0; arm < 3; arm++) { x.beginPath(); for (let k = 0; k <= 40; k++) { const r = k / 40 * w * 0.48, a = arm * 2.09 + k * 0.16; x[k ? 'lineTo' : 'moveTo'](w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r); } x.stroke(); }
  });
  add(disc, new THREE.CircleGeometry(0.55, 28), new THREE.MeshBasicMaterial({ color: tex ? 0xffffff : MEADOW.swirl[0], map: tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  add(g, new THREE.CylinderGeometry(0.22, 0.3, 0.12, 10), lam(MEADOW.ring, 0x0c3018), 0, 0.06, 0); // its little foot
  g.userData.spin = spin; g.userData.disc = disc;
  return disposer(g, tex);
}

// A spring flower (the Planet Hop; owner 2026-10-30: "bouncy flowers could look a little more bouncy"): a big bloom on a fat, tall coil.
// The bloom has the colour of the pebble it flings you to (cubeland.js PEBBLE_COLOURS), so "where does this one go" is answered by looking.
// The group's origin is the face under it (+y = the face's up, turned by the caller). userData.set(squash, lift, idle): squash 0..1 presses
// the coil flat (someone stands on it: the bloom spreads wide), lift > 0 stretches it (the boing after a fling: the bloom gets tall and
// thin), idle = its own little bounce while it waits.
export function buildSpring(bloom = 0xff7ac0) {
  const g = new THREE.Group(), coil = new THREE.Group(), head = new THREE.Group();
  g.add(coil); g.add(head);
  const cm = lam(0x5fd04a, 0x123a10), turns = 5, per = 12, rad = 0.44;
  const seg = new THREE.BoxGeometry(0.26, 0.12, 0.12);
  for (let i = 0; i < turns * per; i++) { const a = i / per * Math.PI * 2, m = add(coil, seg, cm, Math.cos(a) * rad, (i + 0.5) / (turns * per), Math.sin(a) * rad); m.rotation.y = -a + Math.PI / 2; }
  const pm = lam(bloom, new THREE.Color(bloom).multiplyScalar(0.25).getHex()), pg = new THREE.BoxGeometry(0.52, 0.08, 0.36);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, m = add(head, pg, pm, Math.cos(a) * 0.54, 0, Math.sin(a) * 0.54); m.rotation.y = -a; m.rotation.z = 0.14; }
  add(head, new THREE.CylinderGeometry(0.34, 0.34, 0.14, 12), lam(0xffe14a, 0x504010), 0, 0.03, 0);
  const H = 0.8; // the coil's height at rest: the bloom stands this far up; squashed flat it lies on the face (under your feet)
  g.userData.set = (squash = 0, lift = 0, idle = 0) => {
    const h = Math.max(0.04, H * (1 - squash) + lift + idle), k = Math.max(-0.4, Math.min(0.6, lift * 0.6 + idle * 1.5)) - squash * 0.4;
    const fat = 1 + Math.max(0, -k) * 0.25;
    coil.scale.set(fat, h, fat);
    head.position.y = h + 0.04; head.scale.set(1 - k * 0.35, 1 + k * 0.6, 1 - k * 0.35);
  };
  g.userData.set(0, 0, 0);
  g.userData.head = head; g.userData.H = H;
  return disposer(g);
}

// The Saucer Ferry (owner 2026-10-30: the moon that keeps travelling "couldn't it be something that looked more like a satellite or UFO?"):
// Professor Orbit's little flying saucer that goes round the little sun by itself (a real orbit, orbits.js ferryAt) and never stops. A silver
// deck you stand on, a rim of blinking lights, a glowing ring and a soft beam under it, a little antenna, a gold star on the deck. The group's
// origin is the middle of its deck (where you stand); its hull reaches `thick` below. userData.tick(t) blinks the lights.
export function buildSaucer(half = 1.25, thick = 1.2) {
  const g = new THREE.Group(), R = half * 1.2, under = -0.24 - thick * 0.55;
  add(g, new THREE.CylinderGeometry(R, R, 0.24, 28), lam(0xdfe6f2, 0x2a3040), 0, -0.12, 0); // the deck
  add(g, new THREE.CylinderGeometry(R * 1.04, R * 0.5, thick * 0.55, 28), lam(0x9aa8c0, 0x1a2030), 0, -0.24 - thick * 0.275, 0); // the hull
  add(g, new THREE.TorusGeometry(R * 0.5, 0.09, 8, 24), basic(0x7af0ff), 0, under, 0).rotation.x = Math.PI / 2; // the glowing ring under it
  add(g, new THREE.CylinderGeometry(R * 0.4, R * 0.85, 2.2, 20, 1, true), basic(0x9af4ff, 0.14), 0, under - 1.1, 0); // its soft beam
  const lights = [], lg = new THREE.SphereGeometry(0.1, 8, 6), lm = [new THREE.MeshBasicMaterial({ color: 0xffd84a }), new THREE.MeshBasicMaterial({ color: 0xff6ad0 })];
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; lights.push(add(g, lg, lm[i % 2], Math.cos(a) * R * 1.01, -0.14, Math.sin(a) * R * 1.01)); }
  add(g, new THREE.BoxGeometry(0.05, 0.8, 0.05), lam(0x8a8a96), R - 0.35, 0.4, -0.2); // the antenna
  const tip = add(g, new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a5a }), R - 0.35, 0.84, -0.2);
  add(g, new THREE.CircleGeometry(0.35, 5), basic(0xffd84a), 0, 0.006, 0).rotation.x = -Math.PI / 2; // a gold star on the deck
  g.userData.tick = t => { lights.forEach((m, i) => { m.visible = Math.floor(t * 4 + i) % 3 !== 0; }); tip.visible = Math.floor(t * 2) % 2 === 0; };
  return disposer(g);
}

// The little sun the saucer goes round: a warm glowing ball with a soft halo (never a block, nothing pulls you to it).
export function buildSun(r = 1.4) {
  const g = new THREE.Group();
  add(g, new THREE.IcosahedronGeometry(r, 1), basic(0xffd25a));
  add(g, new THREE.IcosahedronGeometry(r * 1.5, 1), basic(0xffb84a, 0.25));
  add(g, new THREE.IcosahedronGeometry(r * 2.2, 1), basic(0xff9a3a, 0.1));
  return disposer(g);
}

// A telescope piece (owner 2026-10-30: "telescopes look nothing like the telescope emoji"): the Professor's telescope came apart and each
// Lens Rock holds one piece with its glowing lens, drawn like 🔭: a blue tube with gold rings. n 0 = the big end (the wide lens), 1 = the
// middle, 2 = the eyepiece. `ghost` = faint and see-through (a piece still missing from the big telescope). Origin = the piece's middle,
// along x (+x = its wide end).
const PIECE = [{ r0: 0.36, r1: 0.3, L: 0.9 }, { r0: 0.28, r1: 0.23, L: 0.95 }, { r0: 0.2, r1: 0.13, L: 0.75 }];
export function buildTelescopePiece(n, ghost = false) {
  const g = new THREE.Group(), P = PIECE[n];
  const tube = () => (ghost ? basic(0x6a8ad8, 0.22) : lam(0x3a64c8, 0x0c1a40)), ring = () => (ghost ? basic(0xf0c050, 0.22) : lam(0xf0c050, 0x3a2a08));
  add(g, new THREE.CylinderGeometry(P.r0, P.r1, P.L, 16), tube()).rotation.z = -Math.PI / 2; // (turned: its top, the wide end, to +x)
  for (const [x, r] of [[P.L / 2 - 0.06, P.r0], [-P.L / 2 + 0.06, P.r1]]) add(g, new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.1, 16), ring(), x, 0, 0).rotation.z = Math.PI / 2;
  const glass = add(g, new THREE.CircleGeometry(P.r0 * 0.85, 20), basic(0xbff0ff, ghost ? 0.25 : 0.95), P.L / 2 + 0.012, 0, 0);
  glass.rotation.y = Math.PI / 2; glass.material.side = THREE.DoubleSide;
  if (!ghost) { const gl = add(g, new THREE.CircleGeometry(P.r0 * 1.5, 20), basic(0xe8fbff, 0.3), P.L / 2 + 0.03, 0, 0); gl.rotation.y = Math.PI / 2; gl.material.side = THREE.DoubleSide; } // its glint
  return disposer(g);
}
// The prize on a Lens Rock: telescope piece n tilted up like 🔭 on a little gold stand, under a soft beam of light (you see where it is from
// the dock); it turns slowly (userData.spin).
export function buildLensPrize(n) {
  const g = new THREE.Group(), spin = new THREE.Group();
  spin.position.y = 1.05; g.add(spin);
  const piece = buildTelescopePiece(n); piece.rotation.z = 0.5; piece.scale.setScalar(1.6); spin.add(piece);
  add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), lam(0xd8a840, 0x3a2a08), 0, 0.42, 0);
  add(g, new THREE.CylinderGeometry(0.3, 0.36, 0.1, 10), lam(0xd8a840, 0x3a2a08), 0, 0.05, 0);
  add(g, new THREE.CylinderGeometry(0.22, 0.22, 12, 10, 1, true), basic(0xffe68a, 0.22), 0, 6.5, 0); // a soft beam of light: seen from far away
  g.userData.spin = spin;
  return disposer(g);
}
// Professor Orbit's big telescope on the Great Cube: a tripod and the three pieces in a row, tilted up at the stars (the 🔭 shape). A piece
// still missing is a faint ghost; userData.show([bool x3]) = which are back.
export function buildBigTelescope() {
  const g = new THREE.Group(), tube = new THREE.Group(), legs = lam(0x6a4a2a);
  for (let i = 0; i < 3; i++) { const a = i * 2.09, m = add(g, new THREE.BoxGeometry(0.12, 2.0, 0.12), legs, Math.cos(a) * 0.45, 0.95, Math.sin(a) * 0.45); m.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28); }
  add(g, new THREE.SphereGeometry(0.16, 8, 6), lam(0xf0c050, 0x3a2a08), 0, 1.95, 0);
  tube.position.y = 2.05; tube.rotation.z = 0.55; g.add(tube);
  const S = 1.5, xs = [0.95, 0, -0.85].map(x => x * S), real = [], ghosts = [];
  for (let n = 0; n < 3; n++) {
    const r = buildTelescopePiece(n), gh = buildTelescopePiece(n, true);
    for (const o of [r, gh]) { o.scale.setScalar(S); o.position.x = xs[n]; tube.add(o); }
    real.push(r); ghosts.push(gh);
  }
  g.userData.show = found => { found.forEach((f, n) => { real[n].visible = !!f; ghosts[n].visible = !f; }); };
  g.userData.show([false, false, false]);
  return disposer(g);
}

// The next pebble of the Planet Hop glows (owner 2026-10-30: "I didn't know which flowers to jump to ... I wonder if those planets being those
// colours would've worked better"): a soft shell of its own colour round it and a beam of light up from its top, both pulsing.
// userData.place(box, colour) puts it round a planet box (null hides it); userData.tick(t) pulses it.
export function buildBeacon() {
  const g = new THREE.Group();
  const mat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const shell = add(g, new THREE.BoxGeometry(1, 1, 1), mat()), beam = add(g, new THREE.CylinderGeometry(0.5, 0.8, 10, 12, 1, true), mat());
  g.visible = false;
  g.userData.place = (box, colour) => {
    if (!box) { g.visible = false; return; }
    g.visible = true;
    const sx = box.x1 - box.x0, sy = box.y1 - box.y0, sz = box.z1 - box.z0;
    g.position.set((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2);
    shell.scale.set(sx + 0.9, sy + 0.9, sz + 0.9);
    beam.position.y = sy / 2 + 5; beam.scale.set(sx / 3, 1, sz / 3);
    shell.material.color.setHex(colour); beam.material.color.setHex(colour);
  };
  g.userData.tick = t => { const k = 0.5 + 0.5 * Math.sin(t * 4); shell.material.opacity = 0.12 + 0.16 * k; beam.material.opacity = 0.1 + 0.14 * k; };
  return disposer(g);
}

// The Orbikit's "!" (owner 2026-10-30: "it would randomly see me"; now you see the moment it sees you): a white bubble with an orange "!"
// over its head. A Sprite (it always faces you); in Node an empty group.
// Its "?" (owner 2026-10-30: it heard your running feet): the same bubble in blue, buildBang('?', '#2a7cff').
export function buildBang(mark = '!', colour = '#ff6a00', rim = '#ff8a1a') {
  const g = new THREE.Group(), tex = canvasTex(64, 64, (x, w) => {
    x.fillStyle = '#ffffff'; x.strokeStyle = rim; x.lineWidth = 6;
    x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = colour; x.font = 'bold 46px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(mark, w / 2, w / 2 + 2);
  });
  if (tex) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(1.3, 1.3, 1); s.renderOrder = 5; g.add(s); }
  g.visible = false;
  return disposer(g, tex);
}

// Dots on the surface (the Orbikit's loops, faint; its sparkly trail, bright; the sparkles of a tag): one InstancedMesh each.
export function buildDots(n, color, size = 0.1, opacity = 1) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), basic(color, opacity), n);
  m.frustumCulled = false;
  const Z = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) m.setMatrixAt(i, Z);
  const g = new THREE.Group();
  g.add(m); g.userData.mesh = m;
  return disposer(g);
}

// Owner 2026-10-30 (hearing must show itself, with no text): running feet make rings on the ground, like footsteps in a puddle. Each ring
// grows from your feet to exactly as far as the Orbikit hears (cubelive.js), and fades. One InstancedMesh of flat rings (unit radius, in
// the XZ plane: the caller turns each to the face's up); `fade` per ring through the instance colour (additive, so dark = gone).
export function buildRipples(n, colour = 0xbfe8ff) {
  const geo = new THREE.RingGeometry(0.93, 1, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.frustumCulled = false;
  const Z = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color(colour);
  for (let i = 0; i < n; i++) { m.setMatrixAt(i, Z); m.setColorAt(i, c); }
  const g = new THREE.Group();
  g.add(m); g.userData.mesh = m; g.userData.colour = c;
  return disposer(g);
}
