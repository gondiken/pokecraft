// Mirror type preview: the seven Mirror creatures photographed up close (a three-quarter view and a front view, at two moments of their
// idle animation, so the two faces in the glass and the sliding glints show). Not a spec: pictures for the owner to judge.
//   node mirror-creatures-preview.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { launch, serve, openGame } from './helpers.mjs';

const OUT = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const IDS = ['lookit', 'grandlooker', 'copykit', 'lynxlook', 'wobblet', 'bendabout', 'periscoot'];
const { server, base } = await serve();
const browser = await launch();
const page = await openGame(browser, base);
page.on('pageerror', e => console.log('page error', e.message));
const data = await page.evaluate(async ids => {
  const THREE = await import('three'), S = await import('/src/species.js');
  const W = 300, H = 280, LABEL = 24, views = [{ name: '3/4', yaw: 0.6, t: 0.4 }, { name: 'front', yaw: 0, t: 2.05 }, { name: 'side', yaw: 1.5, t: 1.0 }];
  const cv = document.createElement('canvas');
  cv.width = W * views.length; cv.height = (H + LABEL) * ids.length;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#9ab8d8'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(W, H, false);
  ids.forEach((id, row) => views.forEach((v, col) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ab8d8);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(2, 4, 3); scene.add(sun);
    const m = S.buildModel(id);
    S.animateModel(m, v.t, false);
    m.rotation.y = v.yaw;
    scene.add(m);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
    const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 50);
    cam.position.set(c.x + size * 0.15, c.y + size * 0.25, c.z + size * 1.6);
    cam.lookAt(c);
    r.render(scene, cam);
    ctx.drawImage(r.domElement, col * W, row * (H + LABEL));
    ctx.fillStyle = '#000'; ctx.fillText(`${S.SPECIES[id].name} (${v.name}, t=${v.t})`, col * W + W / 2, row * (H + LABEL) + H + 16);
    S.disposeModel(m);
  }));
  return cv.toDataURL();
}, IDS);
fs.writeFileSync(path.join(OUT, 'mirror-creatures-preview.png'), Buffer.from(data.split(',')[1], 'base64'));
console.log('wrote', path.join(OUT, 'mirror-creatures-preview.png'));
await browser.close();
server.close();
