// Riding (T27): get on a team creature with the Rideable trait. Physics live in Player (player.ride); this file has the rules,
// the model under the camera, the toasts and the touch button state. Never saved.
import * as THREE from 'three';
import { SPECIES, nameOf, buildModel, animateModel, disposeModel } from './species.js';
import { TRAITS, hasTrait } from './traits.js';
import { sound } from './sound.js';

export const RIDE = {
  land: { kind: 'land', speed: 7.0, sprint: 9.5, jump: 11.2 },
  water: { kind: 'water', speed: 4.3, sprint: 6.2, jump: 8.6, landSlow: 0.5 },
  sky: { kind: 'sky', speed: 7.5, climb: 5, sink: 4, cap: 6, glide: 6 },
};

export const rideKind = c => (hasTrait(c, 'rideable') && TRAITS.rideable.species[c.species]) || null;
export const rideSpecies = id => (typeof id === 'string' && TRAITS.rideable.species[id] && SPECIES[id] ? id : null);

// Scale a creature model so its back is below the eye. The model at rotation 0 faces +Z.
export function fitRide(model) {
  const bb = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.3, bb.max.y - bb.min.y);
  const scale = Math.min(1.3, Math.max(0.4, 1.25 / h));
  model.scale.setScalar(scale);
  const shift = Math.min(0.7, Math.max(-0.2, 1.0 - bb.max.z * scale));
  return { scale, shift, lift: -bb.min.y * scale, seat: Math.min(1.2, h * scale) * 0.8 };
}

// What a rider hears at a fence: the place's own words, else by kind (only gyms say "gyms"; the Swirl's keeps and the
// tower are not gyms).
// `start`: you tried to get on there (else you rode into it).
export function fenceText(owner, start = false) {
  if (owner?.rideText) return owner.rideText;
  if (owner?.tower) return start ? "No riding at the Champion's Tower. Walk outside first!" : "The Champion's Tower is for walking. Get off to go in!";
  if (owner?.def) return start ? 'No riding in or next to a gym. Walk outside first!' : 'Gyms are for walking. Get off to go in!';
  return start ? 'No riding right here. Walk a little further first!' : 'Get off your creature to walk here!';
}

export function createRiding(game, { scene, closePanel }) {
  const riding = {
    creature: null, species: null, kind: null, model: null, fit: null, t: 0,
    fenceToast: -1e9, capToast: -1e9, syncTimer: 0, lastSync: '',
    get on() { return !!this.creature; },
    get landing() { return !!game.player.ride?.landing; },

    first() { return game.party.find(c => rideKind(c) && c.hp > 0) || null; },

    start(c = this.first()) {
      const ui = game.ui, p = game.player;
      if (!game.started || game.inBattle) return false;
      if (!c) { ui.toast('None of your team can be ridden yet. Look for the "Can be ridden" badge!'); return false; }
      if (!rideKind(c)) { ui.toast('Only creatures with the "Can be ridden" badge can be ridden.'); return false; }
      const name = nameOf(c);
      if (!game.party.includes(c)) { ui.toast(`Put ${name} in your team first, then ride it.`); return false; }
      if (c.hp <= 0) { ui.toast(`${name} is too tired to ride. Let it rest, or visit Healer Hana.`); return false; }
      if (this.creature) this.stop('quiet');
      const kind = rideKind(c);
      p.ride = { ...RIDE[kind] };
      p.fenceHit = false;
      if (p.collides(p.pos)) {
        const owner = p.fenceHit || game.world.fenceAt(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)); // a block may be hit before the fence
        p.ride = null; p.fenceHit = false;
        ui.toast(fenceText(owner, true));
        return false;
      }
      this.creature = c; this.species = c.species; this.kind = kind;
      try {
        this.model = buildModel(c.species);
        this.fit = fitRide(this.model);
        scene.add(this.model);
        this.place();
      } catch { this.model = null; }
      try { sound.cry(c.species, SPECIES[c.species].type); } catch { /* sound is optional */ }
      const touch = document.body.classList.contains('touch');
      const off = touch ? 'Tap Get off to get off.' : 'Press R to get off.';
      ui.toast(kind === 'land' ? `You're riding ${name}! It runs fast and jumps high. ${off}`
        : kind === 'water' ? `You're riding ${name}! It swims fast on water, but it is slow on land. ${off}`
        : `You're riding ${name}! ${touch ? 'Up and Down fly.' : 'Space flies up, Shift flies down.'} ${off}`);
      game.mp?.sendState();
      this.sync();
      ui.renderHud();
      return true;
    },

    // reason: 'user' (button / R), 'quiet' (no toast), 'battle', 'left' (not in the team any more)
    stop(reason = 'user') {
      const p = game.player;
      if (!this.creature) return;
      if (this.kind === 'sky' && reason === 'user' && p.ride && !p.ride.landing) {
        const fl = p.floorBelow();
        if (p.pos.y > fl.y + 0.05) { p.ride.landing = true; return; } // glide down first, update() finishes it
      }
      if (this.kind === 'sky' && reason !== 'user') p.dropToFloor();
      const name = nameOf(this.creature);
      p.ride = null;
      if (this.model) { scene.remove(this.model); disposeModel(this.model); }
      this.model = null; this.creature = null; this.species = null; this.kind = null; this.fit = null;
      this.sync();
      game.mp?.sendState();
      if (reason === 'user') game.ui.toast(`You got off ${name}.`);
      else if (reason === 'left') game.ui.toast(`${name} isn't in your team any more, so you got off.`);
    },

    toggle(c) {
      if (this.creature && (!c || c === this.creature)) this.stop('user');
      else this.start(c);
      if (c) closePanel?.();
    },

    update(dt, now) {
      this.syncTimer += dt;
      if (this.syncTimer >= 0.25) { this.syncTimer = 0; this.sync(); }
      if (!this.creature) return;
      const p = game.player, c = this.creature;
      this.t += dt;
      if (!game.party.includes(c) || c.hp <= 0) { this.stop('left'); return; }
      if (p.ride?.landing && p.landed) {
        const name = nameOf(c);
        this.stop('quiet');
        game.ui.toast(`You got off ${name}.`);
        return;
      }
      this.place();
      if (this.model) animateModel(this.model, this.t, Math.hypot(p.vel.x, p.vel.z) > 0.5 || this.kind === 'sky');
      if (p.capped && now - this.capToast > 5000) { this.capToast = now; game.ui.toast(`${nameOf(c)} can't fly any higher here.`); }
      if (p.fenceHit) {
        if (now - this.fenceToast > 2000) { this.fenceToast = now; game.ui.toast(fenceText(p.fenceHit)); }
        p.fenceHit = false;
      }
    },

    place() {
      if (!this.model) return;
      const p = game.player, f = this.fit;
      this.model.position.set(p.pos.x - Math.sin(p.yaw) * f.shift, p.pos.y + f.lift + (this.kind === 'water' ? -0.35 : 0), p.pos.z - Math.cos(p.yaw) * f.shift);
      this.model.rotation.y = p.yaw + Math.PI;
    },

    sync() {
      const s = { show: this.on || !!this.first(), on: this.on, sky: this.kind === 'sky' };
      const key = `${s.show}|${s.on}|${s.sky}`;
      if (key === this.lastSync || !game.touch) return;
      this.lastSync = key;
      game.touch.setRide(s);
    },
  };
  return riding;
}
