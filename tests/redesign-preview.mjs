// Chapter 3 redesigns (plans/chapter3-abilities-build.md section 2): every redesigned creature beside its OLD look, and the type looks
// and animations. The old models come from the commit before the redesigns (OLD_REF), unpacked from git into tests/screenshots/.
// Not a spec: pictures for the owner to judge.
//   node redesign-preview.mjs [outDir]       -> redesign-preview.png (old | new 3/4 | new walking | new side), redesign-looks.png
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launch, serve, openGame, ROOT } from './helpers.mjs';

const OLD_REF = '7adcc47';
const OUT = process.argv[2] || path.join(ROOT, 'tests/screenshots');
const OLD = path.join(ROOT, 'tests/screenshots/redesign-old');
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(OLD, { recursive: true, force: true });
fs.mkdirSync(OLD, { recursive: true });
execSync(`git archive ${OLD_REF} src | tar -x -C "${OLD}"`, { cwd: ROOT });
export const REDESIGNS = ['finnibone', 'twirlshell', 'wifly', 'wifly2', 'error404', 'voltwing', 'wattwink', 'joltail', 'flarehawk', 'rivetron', 'peekaw',
  'ravenshade', 'chirpit', 'loudbeak', 'parroteer', 'featherbeard', 'loopwyrm', 'shimmerfin', 'spectrafin', 'ringlet', 'lustrelle', 'gullop'];
const LOOKS = ['zorbit', 'blipling', 'blipstar', 'podlet', 'tallipod', 'moonhop', 'lunaroo', 'orbikit', 'orbitah', 'danglet', 'turvysloth', 'wallibex',
  'thinkit', 'visionelk', 'puzzlet', 'hopfold', 'frogami', 'pagelet', 'grandtome', 'starbelle', 'pompet', 'pomperina', 'prismkit', 'spectrion', 'chromacurl',
  'drumbo', 'bongorilla', 'gongolin', 'clawdio', 'beetlet', 'hornbeetle', 'glitterbop', 'pinwhirl', 'twilorb'];
const { server, base } = await serve();
const browser = await launch();
const page = await openGame(browser, base);
page.on('pageerror', e => console.log('page error', e.message));
const shoot = (ids, views, withOld, cols) => page.evaluate(async ({ ids, views, withOld, cols }) => {
  const THREE = await import('three'), S = await import('/src/species.js'), O = withOld ? await import('/tests/screenshots/redesign-old/src/species.js') : null;
  const W = 260, H = 240, LABEL = 22, per = views.length + (withOld ? 1 : 0), rowsOf = Math.ceil(ids.length / cols);
  const cv = document.createElement('canvas');
  cv.width = W * per * cols; cv.height = (H + LABEL) * rowsOf;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#9ab8d8'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(W, H, false);
  const draw = (Lib, id, v, x, y, label, shade) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(shade);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(2, 4, 3); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshLambertMaterial({ color: 0x7aa060 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const m = Lib.buildModel(id);
    for (let t = 0; t <= v.t; t += 1 / 30) Lib.animateModel(m, t, !!v.moving);
    m.rotation.y = v.yaw;
    scene.add(m);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), size = Math.max(1, box.getSize(new THREE.Vector3()).length());
    const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 50);
    cam.position.set(c.x + size * 0.2, c.y + size * 0.35, c.z + size * 1.7);
    cam.lookAt(c);
    r.render(scene, cam);
    ctx.drawImage(r.domElement, x, y);
    ctx.fillStyle = '#000'; ctx.fillText(label, x + W / 2, y + H + 15);
    Lib.disposeModel(m);
  };
  ids.forEach((id, i) => {
    const x0 = (i % cols) * W * per, y0 = Math.floor(i / cols) * (H + LABEL);
    let col = 0;
    if (withOld) draw(O, id, { yaw: 0.6, t: 0.4 }, x0, y0, `OLD ${O.SPECIES[id].name}`, 0xc8c0b8), col++;
    for (const v of views) draw(S, id, v, x0 + (col++) * W, y0, `${S.SPECIES[id].name} (${v.name})`, 0x9ab8d8);
  });
  return cv.toDataURL();
}, { ids, views, withOld, cols });
const save = (name, data) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(data.split(',')[1], 'base64')); console.log('wrote', path.join(OUT, name)); };
const NEW_VIEWS = [{ name: '3/4', yaw: 0.6, t: 0.4 }, { name: 'walking', yaw: 1.2, t: 1.13, moving: true }, { name: 'side', yaw: 1.57, t: 2.3 }];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const ids = only || REDESIGNS;
for (let k = 0; k < ids.length; k += 6) save(`redesign-preview-${1 + k / 6}.png`, await shoot(ids.slice(k, k + 6), NEW_VIEWS, true, 1));
if (!only) save('redesign-looks.png', await shoot(LOOKS, [{ name: 'idle', yaw: 0.6, t: 0.9 }, { name: 'later', yaw: 0.9, t: 2.6 }], false, 3));
await browser.close();
server.close();
