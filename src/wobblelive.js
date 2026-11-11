// Chapter 3 (plans/chapter3-world.md, "Built from the owner's first play"): Wobbleland's live part (LIVE.wobble, world.parts from
// wobbleland.js), ?preview only like the realm. Nothing here is saved or sent; it draws from game.beaten (the patches' keys).
//   A3 paint-pot hops: every cleared patch leaves a paint pot of its own colour in its middle, the Camp has one from the start. Stand in a
//      pot and look the way you want to go: a beam of colour stands over the pot you would hop to, the big button says "Hop to blue!".
//      One look, no list: the pot nearest to where you look is the one (`POT.pick`).
import * as THREE from 'three';
import { sound } from './sound.js';
import { PATCHES, CAMP_POT, patchKey, heightAt } from './wobbleland.js';

export const POT = {
  r: 1.3,          // stand within this of a pot's middle to hop from it
  land: 1.7,       // you land this far south of the pot you hop to, facing north (so you are not standing in it)
  beam: 28,        // the beam over the pot you would hop to: its height
  puff: 0.7,       // seconds a puff of colour lasts
};
const NAMES = { 0xe8402a: 'red', 0xf2c418: 'yellow', 0x2f9be8: 'blue', 0x3fc04a: 'green', 0xf07ab8: 'pink', 0x8a4ee0: 'purple' };
// The pots there are now: the Camp's, then one per cleared patch (pure: tests read it). { id, x, z, y, colour, name }
export function potsOf(beaten) {
  const keys = new Set(beaten || []);
  const out = [{ id: 'camp', x: CAMP_POT.x + 0.5, z: CAMP_POT.z + 0.5, y: heightAt(CAMP_POT.x, CAMP_POT.z) + 1, colour: CAMP_POT.colour, name: 'Camp' }];
  for (const p of PATCHES) if (keys.has(patchKey(p.id))) out.push({ id: p.id, x: p.x + 0.5, z: p.z + 0.5, y: heightAt(p.x, p.z) + 1, colour: p.pot, name: NAMES[p.pot] ?? 'pot' });
  return out;
}
// The pot you stand in (or null) and the one you would hop to: of the others, the one closest to the way you look (yaw: forward is
// (-sin yaw, -cos yaw), the game's own rule).
export function hopOf(pots, pos, yaw) {
  const here = pots.find(q => Math.hypot(pos.x - q.x, pos.z - q.z) < POT.r && Math.abs(pos.y - q.y) < 1.6) ?? null;
  if (!here || pots.length < 2) return { here, to: null };
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let to = null, best = -Infinity;
  for (const q of pots) {
    if (q === here) continue;
    const dx = q.x - here.x, dz = q.z - here.z, d = Math.hypot(dx, dz) || 1, dot = (dx * fx + dz * fz) / d;
    if (dot > best) { best = dot; to = q; }
  }
  return { here, to };
}

function buildPot(colour) {
  const g = new THREE.Group();
  const tin = new THREE.MeshLambertMaterial({ color: 0xd8d4cc }), paint = new THREE.MeshLambertMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.25 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.47, 0.75, 14), tin); body.position.y = 0.375; g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 14), paint); top.position.y = 0.73; g.add(top);
  const drip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.06), paint); drip.position.set(0.18, 0.55, 0.53); g.add(drip);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.04, 6, 18), tin); rim.rotation.x = Math.PI / 2; rim.position.y = 0.75; g.add(rim);
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), new THREE.MeshLambertMaterial({ color: 0x9a6a3a })); stick.position.set(-0.15, 1.0, 0.05); stick.rotation.z = 0.35; g.add(stick);
  const brush = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.1), paint); brush.position.set(0.0, 0.62, 0.05); brush.rotation.z = 0.35; g.add(brush);
  return g;
}

export class WobbleLive {
  constructor(game, part) {
    this.game = game; this.part = part; this.world = game.world; this.scene = game.scene;
    this.group = new THREE.Group(); this.group.name = 'wobble-live';
    this.scene?.add(this.group);
    this.pots = []; this.potMeshes = new Map(); this.sig = null; this.t = 0;
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, POT.beam, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.visible = false; this.group.add(this.beam);
    this.puffs = [];
    this.hop = { here: null, to: null };
    this.sync();
  }
  // the pots follow the patches' keys (a win adds one, a reload draws them all)
  sync() {
    const sig = (this.game.beaten || []).filter(k => k.startsWith('pw:wobble:patch')).sort().join();
    if (sig === this.sig) return;
    const fresh = this.sig !== null;
    this.sig = sig;
    this.pots = potsOf(this.game.beaten);
    for (const q of this.pots) if (!this.potMeshes.has(q.id)) {
      const m = buildPot(q.colour); m.position.set(q.x, q.y, q.z); m.userData.born = fresh ? this.t : -9; this.group.add(m); this.potMeshes.set(q.id, m);
      if (fresh && q.id !== 'camp') this.puff(q, 1);
    }
  }
  playing() { const g = this.game; return !g.inBattle && !g.scribble?.fighting && g.world === this.world && (g.playing?.() ?? true); }
  update(dt) {
    this.t += dt;
    this.sync();
    const p = this.game.player;
    this.hop = p && this.playing() ? hopOf(this.pots, p.pos, p.yaw) : { here: null, to: null };
    const to = this.hop.to;
    this.beam.visible = !!to;
    if (to) { this.beam.position.set(to.x, to.y + POT.beam / 2 + 0.8, to.z); this.beam.material.color.setHex(to.colour); this.beam.material.opacity = 0.35 + 0.15 * Math.sin(this.t * 5); }
    for (const [, m] of this.potMeshes) { const a = this.t - m.userData.born; m.scale.setScalar(a < 0.5 ? Math.max(0.01, Math.sin(a / 0.5 * Math.PI / 2) * 1.15) : 1); m.rotation.y = Math.sin(this.t * 0.8 + m.position.x) * 0.15; }
    for (const f of this.puffs) {
      f.t += dt; const k = f.t / POT.puff;
      f.g.visible = k < 1;
      f.g.children.forEach((c, i) => { const a = i / f.g.children.length * Math.PI * 2; c.position.set(Math.cos(a) * k * 1.6, 0.4 + Math.sin(k * Math.PI) * 1.2, Math.sin(a) * k * 1.6); c.scale.setScalar(Math.max(0.01, 1 - k)); });
    }
    this.puffs = this.puffs.filter(f => { if (f.t < POT.puff) return true; this.group.remove(f.g); return false; });
  }
  puff(q, big = 0) {
    const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: q.colour }), geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    for (let i = 0; i < 10 + big * 6; i++) g.add(new THREE.Mesh(geo, mat));
    g.position.set(q.x, q.y, q.z); this.group.add(g); this.puffs.push({ g, t: 0 });
  }
  // the live-part hooks: the big button's word and what it does
  near(p) {
    if (!this.playing() || p !== this.game.player) return null;
    const h = hopOf(this.pots, p.pos, p.yaw);
    return h.to ? `Hop to ${h.to.name}!` : null;
  }
  use(p) {
    if (!this.playing()) return false;
    const { here, to } = hopOf(this.pots, p.pos, p.yaw);
    if (!to) return false;
    this.puff(here);
    p.pos.set(to.x, to.y, to.z + POT.land); p.vel?.set(0, 0, 0); p.yaw = 0;
    this.puff(to);
    try { sound.play('whoosh'); } catch { /* sound is optional */ }
    this.game.mp?.sendState?.();
    return true;
  }
  info() { return { pots: this.pots.map(q => q.id), here: this.hop.here?.id ?? null, to: this.hop.to?.id ?? null, beam: this.beam.visible }; }
  dispose() {
    this.scene?.remove(this.group);
    this.group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }
}
