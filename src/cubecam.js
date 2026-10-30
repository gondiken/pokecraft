// Cube Planets: the steady camera (owner 2026-10-29: "I want an actual steady cam from third person view, not a blink that's still first
// person"). Optional, only in a realm whose def says `camera: true` (Cube Planets); the default stays the first-person eased turn
// (player.js turnView). Switched with V, the pause screen's camera button, and on a tablet the Ride slot (the fixed-slot rule: in this
// world that slot says "Camera"). Remembered per device (localStorage, like Sound).
//
// How it stays steady: the camera floats behind and above you, on your own blocky avatar (the play-together person). Its frame is your
// face's frame turned to your yaw. When you walk over an edge your avatar turns at once (it really stands on the new face), but the camera's
// frame first holds still (`hold`) and then swings slowly round the edge (`ease`, smooth in and out, a slerp, so walking straight over an
// edge is a pure pitch: no roll): you watch yourself walk round the corner, the world never snaps under you.
// Owner 2026-10-30: "it still follows the person quite closely ... it should be a wider shot than today so the camera turn when the user
// turns is even less dizzying". So it is a wide shot now: far back and high (`dist`, `rise`: your planet and the next one in view, you
// small in the lower middle), and it follows your facing only lazily: it swings toward where you look at `yawRate` (and never faster than
// `yawMax`), so a quick look round does not move it at all and turning round brings it round behind you slowly; your pitch only tilts it a
// little (`pitchK`).
// Aiming is unchanged: what you tag / pick is still worked out from your avatar's eyes and look (player.js eyePos / forward), and a tap
// on the screen is a ray from this camera (main.js), so both work. Nothing here is saved, sent or a block.
import * as THREE from 'three';
import { buildPerson } from './npc.js';
import { disposeModel } from './species.js';
import { FRAMES, upOf, toLocal } from './gravity.js';

export const CAM = { dist: 9, rise: 0.6, hold: 0.2, ease: 1.6, yawRate: 0.8, yawMax: 1.2, pitchK: 0.25, head: 1.2, look: 1.6, turn: 0.1, key: 'pokecraft-cube-cam' };
const OUTFIT = { shirt: 0x3b6fd8, pants: 0x2a2a3a, hair: 0x3a2a1a, skin: 0xe8b98a };
const FRAME_Q = FRAMES.map(({ m }) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1)));
const Y = new THREE.Vector3(0, 1, 0);
const smooth = k => k * k * (3 - 2 * k);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const store = { get() { try { return localStorage.getItem(CAM.key); } catch { return null; } }, set(v) { try { localStorage.setItem(CAM.key, v); } catch { /* private window */ } } };

export function createCubeCam(game) {
  let on = store.get() === 'behind';
  let st = null, avatar = null, btn = null, shown = null;
  const v3 = () => new THREE.Vector3();
  const tmp = { q: new THREE.Quaternion(), yq: new THREE.Quaternion(), f: v3(), head: v3(), pos: v3(), look: v3(), a: v3() };
  const here = () => !!game.world?.realm?.camera && !!game.world?.gravityAt; // a world that offers it
  const cam = {
    get on() { return on; },
    can: here,
    active: () => on && here() && game.started && !game.inBattle && game.player?.frameNo?.() != null,
    set(v) { on = !!v; store.set(on ? 'behind' : 'eyes'); st = null; cam.refresh(); return on; },
    toggle(say = true) { cam.set(!on); if (say) game.ui?.toast(on ? '🎥 Camera behind you' : '🎥 Camera in your eyes'); return on; },
    // the pause screen's button (made once, shown only where the camera can switch)
    refresh() {
      if (typeof document === 'undefined') return;
      if (!btn) {
        const sound = document.getElementById('sound-btn');
        if (!sound) return;
        btn = document.createElement('button'); btn.id = 'cam-btn';
        btn.addEventListener('click', e => { e.stopPropagation(); cam.toggle(false); });
        sound.after(btn); sound.after(document.createTextNode(' '));
      }
      const s = here() ? (on ? '🎥 Camera: behind' : '🎥 Camera: eyes') : '';
      if (s !== shown) { shown = s; btn.textContent = s; btn.classList.toggle('hidden', !s); }
    },
    // Called each frame after main.js placed the first-person camera: in third person it moves the camera. -> true when it did.
    update(camera, dt) {
      cam.refresh();
      if (!cam.active()) { if (avatar) avatar.visible = false; st = null; return false; }
      const p = game.player, fi = p.frameNo(), u = upOf(fi), upNow = v3().set(u[0], u[1], u[2]);
      if (!st) st = { frame: fi, yaw: p.yaw, cur: new THREE.Quaternion(), from: new THREE.Quaternion(), hold: 0, t: CAM.ease, first: true };
      if (fi !== st.frame) { // over an edge: the camera keeps looking the same way (its yaw on the new face), holds, then swings round it
        const f = v3().set(0, 0, -1).applyQuaternion(st.cur), l = toLocal(fi, [f.x, f.y, f.z]);
        if (Math.hypot(l[0], l[2]) > 1e-3) st.yaw = Math.atan2(-l[0], -l[2]);
        st.from.copy(st.cur); st.hold = CAM.hold; st.t = 0; st.frame = fi;
      }
      // its yaw follows yours lazily (a quick look round hardly moves it), never faster than yawMax
      const diff = wrap(p.yaw - st.yaw), step = diff * (1 - Math.exp(-dt * CAM.yawRate)), most = CAM.yawMax * dt;
      st.yaw = wrap(st.yaw + Math.max(-most, Math.min(most, step)));
      // the camera's own frame: your face's frame turned to its yaw (local -z = the way it looks, +y = the face's up)
      const target = new THREE.Quaternion().copy(FRAME_Q[fi]).multiply(tmp.yq.setFromAxisAngle(Y, st.yaw));
      if (st.first) { st.cur.copy(target); st.from.copy(target); st.first = false; }
      if (st.hold > 0) { st.hold -= dt; st.cur.copy(st.from); }
      else if (st.t < CAM.ease) { st.t = Math.min(CAM.ease, st.t + dt); st.cur.copy(st.from).slerp(target, smooth(st.t / CAM.ease)); }
      else st.cur.copy(target);
      const camUp = v3().set(0, 1, 0).applyQuaternion(st.cur), back = v3().set(0, 0, 1).applyQuaternion(st.cur);
      const head = tmp.head.copy(p.pos).addScaledVector(upNow, CAM.head);
      const elev = Math.max(0.2, Math.min(1.2, CAM.rise - p.pitch * CAM.pitchK));
      const want = tmp.pos.copy(head).addScaledVector(camUp, Math.sin(elev) * CAM.dist).addScaledVector(back, Math.cos(elev) * CAM.dist);
      // never inside a planet: when the camera's spot (or the cell round it) is solid, pull it in toward your head until it is free (a corner
      // passing between you and the camera for a moment as it swings round an edge is fine; zooming in and out would not be)
      const w = game.world, d = v3().subVectors(want, head), L = d.length(), q = v3();
      const solidNear = s => { q.copy(head).addScaledVector(d, s / L); for (const [ox, oy, oz] of [[0, 0, 0], [0.25, 0, 0], [-0.25, 0, 0], [0, 0.25, 0], [0, -0.25, 0], [0, 0, 0.25], [0, 0, -0.25]]) if (w.isSolid(Math.floor(q.x + ox), Math.floor(q.y + oy), Math.floor(q.z + oz))) return true; return false; };
      let k = 1;
      for (let s = L; s > 0.3 && solidNear(s); s -= 0.2) k = Math.max(0.05, (s - 0.2) / L);
      camera.position.copy(head).addScaledVector(d, k);
      camera.up.copy(camUp);
      camera.lookAt(tmp.look.copy(head).addScaledVector(back, -CAM.look));
      st.up = camUp; st.dist = camera.position.distanceTo(head); st.pull = k;
      cam.drawAvatar(p, fi, dt);
      return true;
    },
    drawAvatar(p, fi, dt) {
      if (!avatar) { avatar = buildPerson(OUTFIT); avatar.userData.keepColour = true; game.scene?.add(avatar); avatar.userData.t = 0; }
      avatar.visible = true;
      avatar.position.copy(p.pos);
      const target = tmp.q.copy(FRAME_Q[fi]).multiply(tmp.yq.setFromAxisAngle(Y, p.yaw + Math.PI)); // (people models face +Z, the camera -Z)
      if (avatar.userData.fi !== fi && avatar.userData.fi != null) avatar.quaternion.slerp(target, 0.5); else avatar.quaternion.slerp(target, 1 - Math.exp(-dt / CAM.turn));
      avatar.userData.fi = fi;
      const moving = p.onGround && Math.hypot(p.vel.x, p.vel.y, p.vel.z) > 0.6, parts = avatar.userData.parts;
      avatar.userData.t += dt;
      for (const l of parts.legs) l.g.rotation.x = moving ? Math.sin(avatar.userData.t * 9 + l.phase) * 0.7 : 0;
      for (const a of parts.arms) a.g.rotation.x = moving ? Math.sin(avatar.userData.t * 9 + a.phase) * 0.6 : 0;
    },
    info() { return { on, active: cam.active(), up: st?.up ? st.up.toArray() : null, dist: st?.dist ?? 0, pull: st?.pull ?? 1, yaw: st?.yaw ?? 0, hold: st?.hold ?? 0, t: st?.t ?? 0, avatar: !!avatar?.visible }; },
    dispose() { if (avatar) { game.scene?.remove(avatar); disposeModel(avatar); avatar = null; } },
  };
  return cam;
}
