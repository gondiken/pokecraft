// Mirror Palace models preview: the hand mirror, the shine ball, the spinner, the pads, an ink puddle, a bonk ball, the mop, your silver twin, the sun mirror, the
// spot of light, the Gloomies and a funny mirror's alcove, photographed up close for the owner to judge (a child must see at a glance what each thing is).
// Not a spec: pictures. Run `node mirror-preview.mjs [outDir]`.
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, openGame } from './helpers.mjs';

const OUT = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const { server, base } = await serve();
const browser = await launch();
const page = await openGame(browser, base);
page.on('pageerror', e => console.log('page error', e.message));
const data = await page.evaluate(async () => {
  const THREE = await import('three'), P = await import('/src/mirrorprops.js'), { buildPerson } = await import('/src/npc.js');
  const W = 320, H = 300, LABEL = 26, COLS = 4;
  const items = [
    ['hand mirror (you hold it)', () => P.buildHandMirror(0.6), { yaw: 0.3 }],
    ['shine ball', () => P.buildShineBall(0.6), {}],
    ['spinner bar', () => P.buildSpinner(3), { yaw: 0.5, pitch: 0.4, dist: 1.1 }],
    ['gold pad (pair) + start pad', () => { const g = new THREE.Group(), a = P.buildPad(0.7), b = P.buildPad(0.9); b.position.x = 2; g.add(a, b); b.userData.parts.mat.color.setHex(0xfff2b0); a.userData.parts.halo.material.opacity = 0.85; a.userData.parts.mat.emissive.setHex(0x40a040); return g; }, { pitch: 0.7, dist: 1.0 }],
    ['ink puddle', () => P.buildPuddle(1.2), { pitch: 0.7, dist: 1.1 }],
    ['bonk ball', () => P.buildBonkBall(0.9), { yaw: 0.5 }],
    ['the mop', () => P.buildMop(3), { yaw: -0.5, pitch: 0.35, dist: 1.2 }],
    ['your silver twin', () => P.buildTwin(), { yaw: 0.4 }],
    ['sun mirror (on its chain)', () => { const g = P.buildSunMirror(); g.userData.parts.face.lookAt(0.3, 0.2, 1); return g; }, { dist: 0.55, centre: [0, 0, 0] }],
    ['spot of light', () => { const g = P.buildSpot(1.2); const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.MeshBasicMaterial({ color: 0xeeeeea })); wall.position.z = -0.1; g.add(wall); return g; }, { dist: 1.2 }],
    ['Gloomies (googly eyes)', () => { const g = P.buildGloomies(2, 0.6), m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1); const pt = g.userData.parts;
      [[-0.9, 0], [0.9, 0.2]].forEach(([x, y], i) => { const s = 1.5; m.compose(new THREE.Vector3(x, y, 0), q, new THREE.Vector3(s, s, s)); pt.bodies.setMatrixAt(i, m);
        for (const [k, sd] of [[0, -1], [1, 1]]) { m.compose(new THREE.Vector3(x + sd * 0.33, y + 0.18, 0.7), q, new THREE.Vector3(s, s, s)); pt.whites.setMatrixAt(i * 2 + k, m); m.compose(new THREE.Vector3(x + sd * 0.33 + 0.05, y + 0.14, 0.88), q, one); pt.pupils.setMatrixAt(i * 2 + k, m); }
        for (let k = 0; k < 3; k++) { m.compose(new THREE.Vector3(x + (k - 1) * 0.3, y + 0.93, 0.05), q, new THREE.Vector3(s, s, s)); pt.tufts.setMatrixAt(i * 3 + k, m); } });
      for (const k of ['bodies', 'whites', 'pupils', 'tufts']) pt[k].instanceMatrix.needsUpdate = true; return g; }, { dist: 1.0 }],
    ['funny mirror: tall you', () => { const g = new THREE.Group(), al = P.buildAlcove(3, 5.2, 1.0), a = buildPerson({ shirt: 0x3b6fd8, pants: 0x2a2a3a, hair: 0x3a2a1a, skin: 0xe8b98a }); a.scale.set(0.75, 1.55, 0.5); a.position.set(0, 0, 0.5); al.add(a); g.add(al); return g; }, { dist: 0.8, centre: [0, 2.4, 0] }],
    ['funny mirror: wide you', () => { const g = new THREE.Group(), al = P.buildAlcove(5, 5.2, 1.0), a = buildPerson({ shirt: 0x3b6fd8, pants: 0x2a2a3a, hair: 0x3a2a1a, skin: 0xe8b98a }); a.scale.set(1.7, 0.7, 0.5); a.position.set(0, 0, 0.5); al.add(a); g.add(al); return g; }, { dist: 0.9, centre: [0, 2.4, 0] }],
  ];
  const cv = document.createElement('canvas'), rows = Math.ceil(items.length / COLS);
  cv.width = W * COLS; cv.height = (H + LABEL) * rows;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#9ab8d8'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(W, H, false);
  items.forEach(([name, make, v], i) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ab8d8);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(2, 4, 3); scene.add(sun);
    const m = make(); m.rotation.y = v.yaw ?? 0; scene.add(m);
    const box = new THREE.Box3().setFromObject(m), c = v.centre ? new THREE.Vector3(...v.centre) : box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length() * (v.dist ?? 1);
    const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 60), pitch = v.pitch ?? 0.15;
    cam.position.set(c.x, c.y + Math.sin(pitch) * size * 1.6, c.z + Math.cos(pitch) * size * 1.6); cam.lookAt(c);
    r.render(scene, cam);
    const col = i % COLS, row = Math.floor(i / COLS);
    ctx.drawImage(r.domElement, col * W, row * (H + LABEL));
    ctx.fillStyle = '#000'; ctx.fillText(name, col * W + W / 2, row * (H + LABEL) + H + 17);
    m.userData.dispose?.();
  });
  return cv.toDataURL();
});
fs.writeFileSync(path.join(OUT, 'mirror-preview.png'), Buffer.from(data.split(',')[1], 'base64'));
console.log('wrote', path.join(OUT, 'mirror-preview.png'));
await browser.close();
server.close();
