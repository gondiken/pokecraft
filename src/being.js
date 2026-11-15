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
import { placeAt, needOf, swapTo, NeedHints } from './abilityplaces.js'; // step C: a place that needs an ability
import { squadOf } from './scribblefight.js';
import { BLOCKS } from './blocks.js';
const bodyFor = c => bodyOf(c.species, SPECIES[c.species], c);

export const BE_CAM = { dist: 4.6, rise: 0.42, head: 1.2, pitchK: 0.45, ease: 10, near: 1.3, key: 'pokecraft-be-cam' };
export const CLIMB_POSE = { lean: 0.5, sway: 0.14, rate: 7, reach: 0.34, wide: 0.58, hand: 1.05, foot: 0.25 }; // (being.js camera: the climbing pose)
const LIMB = { a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
const store = { get() { try { return localStorage.getItem(BE_CAM.key); } catch { return null; } }, set(v) { try { localStorage.setItem(BE_CAM.key, v); } catch { /* private window */ } } };
const CSS = '#crosshair.be-behind { opacity: 0; }';

export function createBeing(game, { scene }) {
  let view = store.get() === 'eyes' ? 'eyes' : 'behind';
  let idx = null, body = null, model = null, fit = null, t = 0, last = 0, tight = false, btn = null, shownBtn = null, styled = false, meBtn = null, shownMe = null;
  let me = false; // you chose to be yourself (the pause screen's button / R); otherwise chapter 3's lands put you in creature mode by themselves
  const cam = { pos: new THREE.Vector3(), ok: false };
  const climb = { k: 0, t: 0, dir: [0, -1] }; // (the climbing pose, eased)
  const hints = new NeedHints(); // (the hint only after trying)
  let jumped = null; // (the place where Swap already jumped to a creature that can)
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
      // only once the hint shows, and only ONE jump to a creature that can; after it Swap goes round all three as always (owner 2026-11-15:
      // at the Sluice Gate it went back and forth between Bottlet and Blazehound and never reached Tightropa)
      const to = need?.shown && jumped !== need.place.id ? swapTo(need, idx, n) : null;
      if (to != null) jumped = need.place.id;
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
      const n = needOf(place, you, squad().map(c => abilitiesOf(SPECIES[c.species], c)));
      n.shown = hints.shown(place.id);
      return n;
    },
    hints,
    swapTarget() { const n = being.need(); return n?.shown && jumped !== n.place.id ? swapTo(n, idx, squad().length) : null; }, // (the card marks it)
    setView(v, say = true) { view = v === 'eyes' ? 'eyes' : 'behind'; store.set(view); if (say) toast(view === 'eyes' ? '🎥 In its eyes' : '🎥 Behind it'); being.refresh(); },
    toggleView() { being.setView(view === 'eyes' ? 'behind' : 'eyes'); },
    // after Player.update and the live parts (main.js): the body's rules
    step(dt) {
      t += dt;
      being.refresh();
      if (here() && game.player && game.playing?.() !== false) { const n = being.need(); hints.step(n?.place ?? null, !!n?.has, dt); if (!n) jumped = null; } // (tries count as yourself too; leaving a place lets Swap jump there again)
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
      // why a wall or the sky stops you, once each (owner 2026-11-14: the ice looked climbable; the cloud ceiling)
      if (p.slipWall && body.climb) { const why = BLOCKS[p.slipWall]?.noGrip; if (typeof why === 'string' && !game.toldOnce?.has('be:grip:' + p.slipWall)) { game.toldOnce?.add('be:grip:' + p.slipWall); toast(why); } }
      p.slipWall = 0;
      if (p.capped && game.world.flyCeiling != null && !game.toldOnce?.has('be:ceiling')) { game.toldOnce?.add('be:ceiling'); toast('Wings only go up to the clouds!'); }
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
        // climbing (owner 2026-11-14: "awkward to see the same character just moving vertically up near the wall"; 2026-11-15 night: from
        // behind it read as a flat slab): it turns to face the wall and leans into it, and four paws in its own colour grip the wall at
        // its sides, the two diagonal pairs reaching up in turn (left hand + right foot, then the others) in step with the climb; it sways
        const w = p.climbing ? p.wallsBeside() : null;
        const wall = w ? (w.px ? [1, 0] : w.nx ? [-1, 0] : w.pz ? [0, 1] : w.nz ? [0, -1] : null) : null;
        if (wall) climb.dir = wall;
        climb.k += ((wall ? 1 : 0) - climb.k) * Math.min(1, dt * 10);
        const k = climb.k, moving = p.climbing && Math.abs(p.vel.y) > 0.1;
        if (moving) climb.t += dt;
        const faceYaw = Math.atan2(-climb.dir[0], -climb.dir[1]) + Math.PI;
        model.rotation.order = 'YXZ';
        model.rotation.y = k > 0.5 ? faceYaw : p.yaw + Math.PI;
        model.rotation.x = -CLIMB_POSE.lean * k;                         // (leaning into the wall, head up)
        model.rotation.z = k * Math.sin(climb.t * CLIMB_POSE.rate) * CLIMB_POSE.sway;
        const up = k * (0.12 + Math.abs(Math.sin(climb.t * CLIMB_POSE.rate)) * 0.06);
        model.position.set(p.pos.x + climb.dir[0] * 0.14 * k, p.pos.y + (fit?.lift ?? 0) + up, p.pos.z + climb.dir[1] * 0.14 * k);
        grips(p, k, behind && !fighting);
        const sq = fit?.scale ?? 1; // (chapter 3: squashed flat in a crack, slipthrough.js / player.js)
        if (p.squashed) model.scale.set(sq * 1.3, sq * 0.42, sq * 1.3); else model.scale.setScalar(sq);
        animateModel(model, t + climb.t * 1.5, Math.hypot(p.vel.x, p.vel.z) > 0.5 || p.ride?.kind === 'sky' || moving);
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
      return { can: here(), on: idx != null, me, index: idx, species: body?.species ?? null, abilities: body?.abilities ?? [], fly: !!body?.fly, climb: !!body?.climb, swim: !!body?.swim, flying: p?.ride?.be && p.ride.kind === 'sky', move: p?.ride?.be ? p.ride.kind : null, speed: p?.ride?.be ? p.ride.speed : null, climbing: !!p?.climbing, pose: +climb.k.toFixed(2), tilt: model ? +model.rotation.x.toFixed(2) : 0, paws: !!paws?.visible, view, tight, behind: being.behind, model: !!model?.visible, squad: here() ? squad().map(c => c.species) : [] };
    },
  };
  function drop() {
    const p = game.player;
    if (idx != null) last = idx;
    if (p) { if (p.ride?.be) { p.ride = null; } p.be = null; p.climbing = false; }
    if (model) { scene.remove(model); disposeModel(model); model = null; fit = null; }
    if (paws) { scene.remove(paws); paws.traverse(o => o.geometry?.dispose?.()); paws = null; }
    cam.ok = false;
  }
  // the four gripping paws (made once per creature, in its own main colour)
  let paws = null;
  function grips(p, k, show) {
    if (!paws) {
      let colour = 0x8a6a4a;
      model?.traverse(o => { if (colour === 0x8a6a4a && o.isMesh && o.material?.color && !o.material.transparent) colour = o.material.color.getHex(); });
      const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(colour).multiplyScalar(0.72) }), ink = new THREE.MeshBasicMaterial({ color: 0x2a2018, side: THREE.BackSide }), geo = new THREE.SphereGeometry(0.17, 10, 8);
      paws = new THREE.Group();
      const limb = new THREE.CylinderGeometry(0.075, 0.075, 1, 8);
      for (let i = 0; i < 4; i++) { const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), o = new THREE.Mesh(geo, ink); m.scale.set(1.2, 0.8, 0.7); o.scale.set(1.32, 0.92, 0.82); g.add(m, o); paws.add(g); }
      for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(limb, mat); a.userData.limb = i; paws.add(a); } // (a limb from its body to each paw)
      scene.add(paws);
    }
    paws.visible = show && k > 0.5;
    if (!paws.visible) return;
    const [dx, dz] = climb.dir, sx = -dz, sz = dx, C = CLIMB_POSE, s = fit?.scale ?? 1, ph = climb.t * C.rate;
    for (let i = 0; i < 4; i++) {
      const g = paws.children[i], hand = i < 2, side = i % 2 ? 1 : -1, pair = hand ? side : -side; // (diagonal pairs move together)
      const reach = Math.max(0, Math.sin(ph + (pair > 0 ? 0 : Math.PI))) * C.reach;
      const h = (hand ? C.hand : C.foot) * Math.max(0.7, s) + reach;
      g.position.set(p.pos.x + dx * (p.halfW + 0.08) + sx * side * C.wide, p.pos.y + h, p.pos.z + dz * (p.halfW + 0.08) + sz * side * C.wide);
      g.rotation.y = Math.atan2(dx, dz);
      const a = paws.children[4 + i], from = LIMB.a.set(p.pos.x + dx * 0.1 + sx * side * 0.2, p.pos.y + (hand ? 0.8 : 0.35) * Math.max(0.7, s), p.pos.z + dz * 0.1 + sz * side * 0.2);
      const d = LIMB.b.subVectors(g.position, from), len = d.length();
      a.position.copy(from).addScaledVector(d, 0.5); a.scale.set(1, len, 1); a.quaternion.setFromUnitVectors(LIMB.up, d.normalize());
    }
  }
  function roomBehind(p) { // climbing a wall in the open: the camera can still stand behind you
    const x = p.pos.x + Math.sin(p.yaw) * 2, z = p.pos.z + Math.cos(p.yaw) * 2;
    return !game.world.isSolid(Math.floor(x), Math.floor(p.pos.y + 1.2), Math.floor(z));
  }
  function crosshair(off) { if (typeof document !== 'undefined') document.getElementById('crosshair')?.classList.toggle('be-behind', !!off); }
  return being;
}
