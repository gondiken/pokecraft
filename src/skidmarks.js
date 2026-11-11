// Chapter 3, Slippy Lake: skid marks on the ice (one look: "it slid here"; an Ice creature that keeps its grip leaves none). One instanced
// mesh of thin dark scratches lying on the ice, a ring of `n`; each fades (shrinks) over `life` s. Used by Wobbleland's live part (your
// feet) and the scribble fight (every fighter that slides); nothing here is saved or sent.
import * as THREE from 'three';

export const SKID = { n: 160, life: 2.4, every: 0.07, len: 0.6, wide: 0.09, colour: 0x3e5a74 };

export class SkidMarks {
  constructor(parent) {
    const geo = new THREE.PlaneGeometry(SKID.wide, SKID.len); geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: SKID.colour, transparent: true, opacity: 0.8, depthWrite: false }), SKID.n);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.userData.noCurl = true; this.mesh.renderOrder = 1;
    parent?.add(this.mesh);
    this.marks = []; this.next = 0; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  // a thing that slides (it has a `skidT` of its own): two scratches under it, along the way it moves, every SKID.every s
  track(who, x, y, z, vx, vz, dt) {
    who.skidT = (who.skidT ?? 0) - dt;
    if (who.skidT > 0 || Math.hypot(vx, vz) < 0.6) return;
    who.skidT = SKID.every;
    const a = Math.atan2(vx, vz), cx = Math.cos(a) * 0.18, cz = -Math.sin(a) * 0.18;
    for (const side of [-1, 1]) this.add(x + cx * side, y + 0.08, z + cz * side, a); // (0.08: over the wobbly corners)
  }
  add(x, y, z, a) {
    const k = this.next; this.next = (k + 1) % SKID.n;
    this.marks[k] = { x, y, z, a, t: 0 };
    this.mesh.count = Math.max(this.mesh.count, k + 1);
  }
  update(dt) {
    for (let i = 0; i < this.mesh.count; i++) {
      const mk = this.marks[i];
      if (!mk) continue;
      mk.t += dt;
      const k = Math.max(0.001, 1 - mk.t / SKID.life);
      this.q.setFromEuler(this.e.set(0, mk.a, 0));
      this.m.compose(this.v.set(mk.x, mk.y, mk.z), this.q, this.s.set(k, 1, 0.6 + 0.4 * k));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  info() { return { marks: this.marks.filter(m => m && m.t < SKID.life).length }; }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
