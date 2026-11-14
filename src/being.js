// Chapter 3 (plans/chapter3-ways.md, ?preview only): CREATURE MODE, being your creature outside a fight, only in chapter 3's lands (a realm
// def with `be: true`: Wobbleland). Everywhere else you are always yourself (it would break chapter 1 and 2's challenges), and without
// ?preview this file does nothing.
//   Owner 2026-11-12 ("there should be creature mode and me mode ... not a whole yet another bar"; then "kids will never want to switch
//   to me anyway ... keep the me option in the menu, and swap can stay as a button"): in chapter 3's lands you ARE your creature by
//   itself; "🧍 Be me" / "🐾 Be my creature" is a button in the pause screen (R on a keyboard). Swap (F, or the Place button: nothing is
//   built in Wobbleland) goes round your first three creatures (the scribble fight's three); 1 2 3 pick one on a keyboard. In chapter 3's lands creature mode IS riding: it moves like riding, by its abilities (step C: Fly, Swim, Climb; creatureways.js bodyStep with
//   riding.js RIDE), so riding there turns into creature mode. Swap any time, also in the air: each place judges the body you are now.
//   The camera: behind your creature (default) or in its eyes (V, or the pause screen's camera button; remembered on this device); in a
//   tight place (a shaft, a doorway) it goes into its eyes by itself and comes back out after.
//   A scribble fight you walk into as your creature starts with it (no Capture Cube throw, scribble.js); you are it again afterwards.
// Nothing here is saved or sent (play together still shows your person: plans/chapter3-ways.md).
import * as THREE from 'three';
import { SPECIES, nameOf, buildModel, animateModel, disposeModel } from './species.js';
import { RIDE, fitRide } from './riding.js';
import { sketchModel } from './sketch.js';
import { sound } from './sound.js';
import { PREVIEW } from './comingsoon.js';
import { BODY, bodyOf, bodyStep, tightAt } from './creatureways.js';
import { abilitiesOf } from './abilities.js';
import { placeAt, needOf, swapTo } from './abilityplaces.js'; // step C: a place that needs an ability
import { squadOf } from './scribblefight.js';
const bodyFor = c => bodyOf(c.species, SPECIES[c.species], c);

export const BE_CAM = { dist: 4.6, rise: 0.42, head: 1.2, pitchK: 0.45, ease: 10, near: 1.3, key: 'pokecraft-be-cam' };
const store = { get() { try { return localStorage.getItem(BE_CAM.key); } catch { return null; } }, set(v) { try { localStorage.setItem(BE_CAM.key, v); } catch { /* private window */ } } };
const CSS = '#crosshair.be-behind { opacity: 0; }';

export function createBeing(game, { scene }) {
  let view = store.get() === 'eyes' ? 'eyes' : 'behind';
  let idx = null, body = null, model = null, fit = null, t = 0, last = 0, tight = false, btn = null, shownBtn = null, styled = false, meBtn = null, shownMe = null;
  let me = false; // you chose to be yourself (the pause screen's button / R); otherwise chapter 3's lands put you in creature mode by themselves
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
      if (game.riding?.on) game.riding.stop('quiet');
      drop();
      idx = i; body = bodyFor(c);
      p.be = { ...body, slip: false };
      p.ride = null;
      bodyStep(p, game.world, body, RIDE);
      try { model = buildModel(c.species, c.paint); sketchModel(model); fit = fitRide(model); scene.add(model); } catch { model = null; }
      try { sound.cry(c.species, body.type); } catch { /* optional */ }
      if (say) {
        toast(`You are ${nameOf(c)}!${body.fly ? ' Hold Jump to fly.' : ''}`);
      }
      game.ui?.renderHud?.();
      return true;
    },
    back(say = true) {
      if (idx == null) return false;
      if (game.inBattle || game.scribble?.fighting) return false; // (not in a fight: you are it until the fight is over)
      drop(); idx = null; body = null;
      if (say) toast('You are you again!');
      game.ui?.renderHud?.();
      return true;
    },
    // the pause screen's button / R: me mode on or off (owner 2026-11-12: kids will hardly ever want to be themselves there, so no touch button)
    toggle() {
      if (idx == null) { me = false; return being.become(Math.min(last ?? 0, Math.max(0, squad().length - 1))); }
      const ok = being.back(); if (ok) me = true; return ok;
    },
    get me() { return me; },
    setMe(v) { me = !!v; if (me) being.back(false); being.refresh(); }, // (tests: walk on foot as before)
    // Swap (F / the Place button): the next of your three. At a place that needs an ability you lack, straight to the next one that has it.
    next() {
      const n = squad().length, need = being.need();
      const to = swapTo(need, idx, n);
      if (to != null) { me = false; return being.become(to); }
      if (idx == null) return being.toggle();
      if (n < 2) { toast('Only one creature in your team!'); return false; }
      return being.become((idx + 1) % n);
    },
    // step C: the place you are in that needs an ability, and what it says to you (abilityplaces.js needOf), or null
    need() {
      const p = game.player;
      if (!here() || !p) return null;
      const place = placeAt(game.world?.needPlaces, p.pos);
      if (!place) return null;
      const you = idx != null && body ? body.abilities : [];
      return needOf(place, you, squad().map(c => abilitiesOf(SPECIES[c.species], c)));
    },
    swapTarget() { return swapTo(being.need(), idx, squad().length); }, // (the card marks it)
    setView(v, say = true) { view = v === 'eyes' ? 'eyes' : 'behind'; store.set(view); if (say) toast(view === 'eyes' ? '🎥 In its eyes' : '🎥 Behind it'); being.refresh(); },
    toggleView() { being.setView(view === 'eyes' ? 'behind' : 'eyes'); },
    // after Player.update and the live parts (main.js): the body's rules
    step(dt) {
      t += dt;
      being.refresh();
      if (!here()) { if (idx != null) { drop(); idx = null; body = null; } me = false; return; } // left chapter 3's land: yourself again
      if (idx == null) { // creature mode by itself in chapter 3's lands, unless you chose to be you
        if (!me && !game.inBattle && !game.scribble?.fighting && game.playing?.() && squad().length) being.become(Math.min(last ?? 0, squad().length - 1), !game.toldOnce?.has('be:first'));
        game.toldOnce?.add('be:first');
        if (idx == null) return;
      }
      const c = being.creature, p = game.player;
      if (!c || c.species !== body.species) { being.back(false); return; } // (the team changed under you)
      if (game.scribble?.fighting) return; // (the fight has its own bodies; you come back as it afterwards)
      bodyStep(p, game.world, body, RIDE);
      if (p.ride?.be && p.ride.landing) p.ride.landing = false;
    },
    // after main.js placed the eye camera (and before scribble.js): the camera behind your creature, the creature itself
    camera(camera, dt) {
      const p = game.player;
      if (idx == null) { if (model) model.visible = false; cam.ok = false; crosshair(false); return false; }
      const fighting = !!game.scribble?.fighting;
      tight = tightAt(game.world, p.pos) || game.player.climbing && !roomBehind(p);
      const behind = view === 'behind' && !tight;
      if (model) {
        model.visible = behind && !fighting; // (in a fight scribble.js draws it)
        model.position.set(p.pos.x, p.pos.y + (fit?.lift ?? 0), p.pos.z);
        model.rotation.y = p.yaw + Math.PI;
        animateModel(model, t, Math.hypot(p.vel.x, p.vel.z) > 0.5 || p.ride?.kind === 'sky' || p.climbing);
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
      const off = new THREE.Vector3().subVectors(cam.pos, head); // (owner 2026-11-12: walking away from the camera made it flash: this line
      if (off.length() > d + 0.01) cam.pos.copy(head).addScaledVector(off.normalize(), d); // copied the head BEFORE reading the way back, so the camera landed on your head; never lag through a wall)
      cam.ok = true;
      const at = new THREE.Vector3(head.x - Math.sin(p.yaw) * 1.5, head.y + Math.sin(p.pitch) * 1.5, head.z - Math.cos(p.yaw) * 1.5);
      tmp.m.lookAt(cam.pos, at, THREE.Object3D.DEFAULT_UP); tmp.q.setFromRotationMatrix(tmp.m);
      camera.userData.beFrom = { pos: cam.pos.clone(), q: tmp.q.clone() }; // (scribble.js glides from here into a fight and back)
      if (fighting) return false;
      camera.position.copy(cam.pos);
      camera.quaternion.copy(tmp.q);
      return true;
    },
    // the pause screen's camera button (made once; only in chapter 3's lands), the crosshair's style
    refresh() {
      if (typeof document === 'undefined') return;
      if (!styled && here()) { styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
      if (!btn) {
        const sound = document.getElementById('sound-btn');
        if (!sound) return;
        btn = document.createElement('button'); btn.id = 'becam-btn';
        btn.addEventListener('click', e => { e.stopPropagation(); being.toggleView(); });
        sound.after(btn); sound.after(document.createTextNode(' '));
      }
      const s = here() ? (view === 'eyes' ? '🎥 Creature camera: eyes' : '🎥 Creature camera: behind') : '';
      if (s !== shownBtn) { shownBtn = s; btn.textContent = s; btn.classList.toggle('hidden', !s); }
      if (!meBtn) {
        meBtn = document.createElement('button'); meBtn.id = 'beme-btn';
        meBtn.addEventListener('click', e => { e.stopPropagation(); being.toggle(); being.refresh(); });
        btn.after(meBtn); btn.after(document.createTextNode(' '));
      }
      const m = here() ? (idx == null ? '🐾 Be my creature' : '🧍 Be me') : '';
      if (m !== shownMe) { shownMe = m; meBtn.textContent = m; meBtn.classList.toggle('hidden', !m); }
    },
    // tests
    info() {
      const p = game.player;
      return { can: here(), on: idx != null, me, index: idx, species: body?.species ?? null, abilities: body?.abilities ?? [], fly: !!body?.fly, climb: !!body?.climb, swim: !!body?.swim, flying: p?.ride?.be && p.ride.kind === 'sky', move: p?.ride?.be ? p.ride.kind : null, speed: p?.ride?.be ? p.ride.speed : null, climbing: !!p?.climbing, view, tight, behind: being.behind, model: !!model?.visible, squad: here() ? squad().map(c => c.species) : [] };
    },
  };
  function drop() {
    const p = game.player;
    if (idx != null) last = idx;
    if (p) { if (p.ride?.be) { p.ride = null; } p.be = null; p.climbing = false; }
    if (model) { scene.remove(model); disposeModel(model); model = null; fit = null; }
    cam.ok = false;
  }
  function roomBehind(p) { // climbing a wall in the open: the camera can still stand behind you
    const x = p.pos.x + Math.sin(p.yaw) * 2, z = p.pos.z + Math.cos(p.yaw) * 2;
    return !game.world.isSolid(Math.floor(x), Math.floor(p.pos.y + 1.2), Math.floor(z));
  }
  function crosshair(off) { if (typeof document !== 'undefined') document.getElementById('crosshair')?.classList.toggle('be-behind', !!off); }
  return being;
}
