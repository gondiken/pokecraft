// Cube Planets, step 0: the live part of the gravity sandbox (LIVE.gravity, world.parts from cubeland.js). No game yet: the starry sky
// round you (one draw call, never a block, never saved), which planets you stood on this visit (the guide's little tour, cubeland.js
// cubeAim), a few one-time words, and the catch puff's toast and sound (player.js catchPuff). The games come in step 2 (plan section 4).
import * as THREE from 'three';
import { sound } from './sound.js';
import { PLANETS } from './cubeland.js';

const STARS = 700, R = 240;

export class CubeLive {
  constructor(game, part) {
    this.game = game; this.part = part; this.world = game.world; this.scene = game.scene;
    this.visited = new Set();
    this.told = {};
    this.caught = 0;
    // the sky: soft stars on a big sphere that follows the camera (fog off, so they stay bright far away)
    const pos = new Float32Array(STARS * 3), col = new Float32Array(STARS * 3);
    let a = 0x51a75;
    const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < STARS; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * s * R, u * R, Math.sin(th) * s * R], i * 3);
      const warm = rnd(), b = 0.6 + rnd() * 0.4;
      col.set(warm < 0.2 ? [b, b * 0.9, b * 0.6] : warm < 0.35 ? [b * 0.7, b * 0.8, b] : [b, b, b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
    this.stars.renderOrder = -1;
    this.stars.frustumCulled = false;
    this.stars.userData.keepColour = true;
    this.scene?.add(this.stars);
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    this.stars.position.copy(p.pos);
    const gd = p.grav;
    if (gd && p.onGround && gd.field) {
      if (!this.visited.has(gd.planet)) {
        const first = this.visited.size > 0;
        this.visited.add(gd.planet);
        if (first) { const P = PLANETS[gd.planet]; g.ui?.toast(`${P.emoji} You hopped to the ${P.name}! Its pull caught you.`); }
      }
      if ((gd.axis !== 1 || gd.sign !== 1) && !this.told.side) { this.told.side = true; g.ui?.toast('You walked round the edge! Down is wherever your feet are.'); }
      if (gd.axis === 1 && gd.sign === -1 && !this.told.bottom) { this.told.bottom = true; g.ui?.toast('Upside down under a planet! Look: the sky is below you.'); }
    }
    if ((p.caught || 0) > this.caught) {
      this.caught = p.caught;
      try { sound.play('puff'); } catch { /* sound is optional */ }
      g.ui?.toast('Poof! Space caught you and put you back where you stood.');
    }
  }

  // The guide's words while you are in this world come from cubeland.js cubeAim (TERRAIN_AIMS); nothing to add here.
  info() { return { visited: [...this.visited], caught: this.caught, frame: this.game.player?.frameNo?.() ?? null }; }

  dispose() {
    this.scene?.remove(this.stars);
    this.stars.geometry.dispose(); this.stars.material.dispose();
  }
}
