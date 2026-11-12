// Chapter 3 (plans/chapter3-ways.md, ?preview only): BEING your creature outside a fight, only in chapter 3's lands (a realm def with
// `be: true`: Wobbleland). Everywhere else you are always yourself (it would break chapter 1 and 2's challenges), and without ?preview
// this file does nothing.
//   Your squad = your first three creatures (the scribble fight's three, scribblefight.js squadOf). The squad bar (top middle) has you and
//   them: tap one to become it, tap yourself to be you again. Keys: 1 2 3 become one, X goes back and forth, V switches the camera.
//   Switching happens only on the ground (mid-air you could chain ways and beat a place the wrong way).
//   The body is creatureways.js: wings fly where they have room (the sky riding physics), a Cling creature climbs walls (player.js).
//   The camera: behind your creature (default) or in its eyes (V, the bar's 🎥; remembered on this device); in a tight place (a shaft, a
//   doorway) it goes into its eyes by itself and comes back out after.
//   A scribble fight you walk into as your creature starts with it (no Capture Cube throw, scribble.js); you are it again afterwards.
// Nothing here is saved or sent (play together still shows your person: plans/chapter3-ways.md).
import * as THREE from 'three';
import { SPECIES, nameOf, buildModel, animateModel, disposeModel } from './species.js';
import { RIDE, fitRide } from './riding.js';
import { sketchModel } from './sketch.js';
import { sound } from './sound.js';
import { PREVIEW } from './comingsoon.js';
import { BODY, WAY, bodyOf, bodyStep, wingRoom } from './creatureways.js';
import { squadOf } from './scribblefight.js';
import { TRAITS } from './traits.js';
const bodyFor = c => bodyOf(c.species, SPECIES[c.species], TRAITS.rideable.species[c.species] === 'sky');

export const BE_CAM = { dist: 4.6, rise: 0.42, head: 1.2, pitchK: 0.45, ease: 10, near: 1.3, key: 'pokecraft-be-cam' };
const store = { get() { try { return localStorage.getItem(BE_CAM.key); } catch { return null; } }, set(v) { try { localStorage.setItem(BE_CAM.key, v); } catch { /* private window */ } } };
const CSS = `
#squad { position: fixed; top: 54px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 30; pointer-events: auto; font-family: inherit; }
#squad.hidden { display: none; }
body.touch #squad { top: 96px; } /* (under the pause and Book buttons) */
#squad button { min-width: 48px; height: 48px; padding: 0 10px; border-radius: 24px; border: 2px solid rgba(255,255,255,.55); background: rgba(20,24,40,.62); color: #fff; font: inherit; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
#squad button.on { border-color: #ffd84a; background: rgba(60,50,10,.78); box-shadow: 0 0 0 3px rgba(255,216,74,.35); }
#squad button .dot { width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(0,0,0,.4); flex: none; }
#squad button .way { font-size: 15px; }
body.scribbling #squad { display: none !important; }
#crosshair.be-behind { opacity: 0; }
`;

export function createBeing(game, { scene }) {
  let view = store.get() === 'eyes' ? 'eyes' : 'behind';
  let idx = null, body = null, model = null, fit = null, t = 0, bar = null, shown = '', last = 0, tight = false;
  const cam = { pos: new THREE.Vector3(), ok: false };
  const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };
  const squad = () => (game.party || []).filter(c => c && SPECIES[c.species]).filter(c => squadOf([c]).length).slice(0, BODY.squad); // (the fight's three)
  const here = () => PREVIEW && !!game.started && !!game.world?.realm?.be;
  const toast = s => game.ui?.toast(s);

  const being = {
    get on() { return idx != null; },
    get index() { return idx; },
    get creature() { return idx != null ? squad()[idx] ?? null : null; },
    get body() { return body; },
    get view() { return view; },
    get behind() { return idx != null && view === 'behind' && !tight; },
    can: here,
    squad,
    // become squad creature i (null = yourself). -> true when it changed
    become(i, say = true) {
      const p = game.player;
      if (i == null) return being.back(say);
      if (!here() || game.inBattle || game.scribble?.fighting) return false;
      const c = squad()[i];
      if (!c) { if (say) toast('You need a creature in that place of your team!'); return false; }
      if (idx === i) return false;
      if (!grounded(p)) { if (say) toast('Land first, then swap!'); return false; }
      if (game.riding?.on) game.riding.stop('quiet');
      drop();
      idx = i; body = bodyFor(c);
      p.be = { ...body, slip: false };
      p.ride = null;
      bodyStep(p, game.world, body, RIDE.sky);
      try { model = buildModel(c.species, c.paint); sketchModel(model); fit = fitRide(model); scene.add(model); } catch { model = null; }
      try { sound.cry(c.species, body.type); } catch { /* optional */ }
      if (say) {
        const way = WAY[body.way];
        toast(`You are ${nameOf(c)}!${body.wings ? ' Hold Jump to fly.' : ''}${way ? ` ${way.icon} ${way.name}` : ''}`);
      }
      being.render(true);
      return true;
    },
    back(say = true) {
      if (idx == null) return false;
      const p = game.player;
      if (!grounded(p) && here()) { if (say) toast('Land first!'); return false; }
      drop(); idx = null; body = null;
      if (say) toast('You are you again!');
      being.render(true);
      return true;
    },
    // X: back and forth (to the last creature you were, the first at the start)
    toggle() { return idx == null ? being.become(last ?? 0) : being.back(); },
    setView(v, say = true) { view = v === 'eyes' ? 'eyes' : 'behind'; store.set(view); if (say) toast(view === 'eyes' ? '🎥 In its eyes' : '🎥 Behind it'); being.render(true); },
    toggleView() { being.setView(view === 'eyes' ? 'behind' : 'eyes'); },
    // after Player.update and the live parts (main.js): the body's rules
    step(dt) {
      t += dt;
      if (idx != null && !here()) { drop(); idx = null; body = null; being.render(true); return; } // left chapter 3's land: yourself again
      if (idx == null) { being.render(); return; }
      const c = being.creature, p = game.player;
      if (!c || c.species !== body.species) { being.back(false); return; } // (the team changed under you)
      if (bodyStep(p, game.world, body, RIDE.sky) === 'folded' && !game.toldOnce?.has('be:fold')) { game.toldOnce?.add('be:fold'); toast('No room to spread its wings here!'); }
      if (p.ride?.be && p.ride.landing) p.ride.landing = false;
      being.render();
    },
    // after main.js placed the eye camera (and before scribble.js): the camera behind your creature, the creature itself
    camera(camera, dt) {
      const p = game.player;
      if (idx == null) { if (model) model.visible = false; cam.ok = false; crosshair(false); return false; }
      const fighting = !!game.scribble?.fighting;
      tight = !wingRoom(game.world, p.pos) || game.player.climbing && !roomBehind(p);
      const behind = view === 'behind' && !tight;
      if (model) {
        model.visible = behind && !fighting; // (in a fight scribble.js draws it)
        model.position.set(p.pos.x, p.pos.y + (fit?.lift ?? 0), p.pos.z);
        model.rotation.y = p.yaw + Math.PI;
        animateModel(model, t, Math.hypot(p.vel.x, p.vel.z) > 0.5 || !!p.ride || p.climbing);
      }
      crosshair(behind && !fighting);
      if (!behind) { cam.ok = false; camera.userData.beFrom = null; return false; }
      const head = tmp.a.set(p.pos.x, p.pos.y + BE_CAM.head, p.pos.z);
      const elev = Math.max(-0.2, Math.min(1.1, BE_CAM.rise - p.pitch * BE_CAM.pitchK));
      const back = tmp.b.set(Math.sin(p.yaw) * Math.cos(elev), Math.sin(elev), Math.cos(p.yaw) * Math.cos(elev));
      let d = BE_CAM.dist;
      for (let s = 0.4; s <= BE_CAM.dist; s += 0.2) { // never inside a block: pull in to the first solid cell behind you
        const x = head.x + back.x * s, y = head.y + back.y * s, z = head.z + back.z * s;
        if (game.world.isSolid(Math.floor(x), Math.floor(y), Math.floor(z))) { d = Math.max(BE_CAM.near, s - 0.35); break; }
      }
      const want = new THREE.Vector3().copy(head).addScaledVector(back, d);
      if (!cam.ok) cam.pos.copy(want); else cam.pos.lerp(want, 1 - Math.exp(-dt * BE_CAM.ease));
      if (cam.pos.distanceTo(head) > d + 0.01) cam.pos.copy(head).addScaledVector(tmp.b.subVectors(cam.pos, head).normalize(), d); // (no lag through a wall)
      cam.ok = true;
      const at = new THREE.Vector3(head.x - Math.sin(p.yaw) * 1.5, head.y + Math.sin(p.pitch) * 1.5, head.z - Math.cos(p.yaw) * 1.5);
      tmp.m.lookAt(cam.pos, at, THREE.Object3D.DEFAULT_UP); tmp.q.setFromRotationMatrix(tmp.m);
      camera.userData.beFrom = { pos: cam.pos.clone(), q: tmp.q.clone() }; // (scribble.js glides from here into a fight and back)
      if (fighting) return false;
      camera.position.copy(cam.pos);
      camera.quaternion.copy(tmp.q);
      return true;
    },
    // the squad bar (top middle), made once, redrawn when what it shows changes
    render(force = false) {
      if (typeof document === 'undefined') return;
      if (!bar) {
        if (!here()) return;
        const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
        bar = document.createElement('div'); bar.id = 'squad'; document.body.appendChild(bar);
        bar.addEventListener('pointerdown', e => e.stopPropagation());
        bar.addEventListener('click', e => {
          e.stopPropagation(); e.preventDefault();
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.i === 'me') being.back(); else if (b.dataset.i === 'cam') being.toggleView(); else being.become(+b.dataset.i);
        });
      }
      const list = here() ? squad() : [];
      const key = here() ? `${idx}|${view}|${list.map(c => c.uid ?? c.species).join()}` : '';
      if (!force && key === shown) return;
      shown = key;
      bar.classList.toggle('hidden', !here());
      if (!here()) return;
      const btn = (i, label, on, colour, way) => `<button data-i="${i}" class="${on ? 'on' : ''}">${colour ? `<span class="dot" style="background:${colour}"></span>` : ''}${label}${way ? ` <span class="way">${way}</span>` : ''}</button>`;
      const col = c => { const tc = SPECIES[c.species]?.type; return ({ fire: '#f2914a', water: '#7aa4f5', grass: '#8fd166', electric: '#f7d84a', ice: '#9fe0f0' })[tc] || '#c8c8d8'; };
      bar.innerHTML = btn('me', '🧍 Me', idx == null) + list.map((c, i) => btn(i, `${i + 1} ${nameOf(c)}`, idx === i, col(c), WAY[bodyFor(c).way]?.icon)).join('')
        + (idx != null ? btn('cam', view === 'eyes' ? '🎥 Eyes' : '🎥 Behind', false) : '');
    },
    // tests
    info() {
      const p = game.player;
      return { can: here(), on: idx != null, index: idx, species: body?.species ?? null, way: body?.way ?? null, wings: !!body?.wings, flying: !!p?.ride?.be, climbing: !!p?.climbing, view, tight, behind: being.behind, model: !!model?.visible, squad: here() ? squad().map(c => c.species) : [] };
    },
  };
  function drop() {
    const p = game.player;
    if (idx != null) last = idx;
    if (p) { if (p.ride?.be) { p.ride = null; } p.be = null; p.climbing = false; }
    if (model) { scene.remove(model); disposeModel(model); model = null; fit = null; }
    cam.ok = false;
  }
  // swaps only with your feet on something (or swimming): mid-air you could chain two ways
  function grounded(p) { return !!p && (p.onGround || p.inWater || (p.ride?.be && p.floorBelow().y >= p.pos.y - 0.15)); }
  function roomBehind(p) { // climbing a wall in the open: the camera can still stand behind you
    const x = p.pos.x + Math.sin(p.yaw) * 2, z = p.pos.z + Math.cos(p.yaw) * 2;
    return !game.world.isSolid(Math.floor(x), Math.floor(p.pos.y + 1.2), Math.floor(z));
  }
  function crosshair(off) { if (typeof document !== 'undefined') document.getElementById('crosshair')?.classList.toggle('be-behind', !!off); }
  return being;
}
