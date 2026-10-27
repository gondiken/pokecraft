// Owner 2026-10-27: "there's not really any car mechanics here". In a race you drive your own kart: it speeds up and slows
// down (no instant top speed), a tight corner needs you to slow down first (the grip only lets it turn so fast at speed),
// red and white kerbs and the grass slow you right down, tyre walls and rails bounce you back, boost pads kick it up to
// boost speed, ramps launch it, a drop makes it faster. Pure (imports only blocks.js), so the racer spec runs it in Node.
//
// Driving: push the stick (or W A S D) where you want to go. The camera follows the kart (racelive.js), so stick forward
// = go, stick left = turn left, stick back = brake (and slowly back up when stopped). Space does nothing.
// Positions are world blocks: x, z, y = the kart's floor (the top of the block it stands on); heading h: 0 faces +z,
// PI / 2 faces +x (like npc.js). The physics run in fixed 1/120 s sub-steps, so 60 and 20 frames a second give the same drive.
import { B, isSolid } from './blocks.js';

export const KART = {
  sub: 1 / 120, maxSubs: 30,
  top: { road: 12, kerb: 4.5, grass: 4.5 },   // top speed by what is under you (a walk is 4.3; the kerb is no better than the grass)
  accel: 7, brake: 20, coast: 2.5, back: 3,    // blocks/s each second: speeding up, braking (stick back), rolling, reverse top speed
  over: { road: 4, kerb: 16, grass: 16 },      // how fast you lose speed above the top speed (a boost fades on the road; a kerb bites)
  boost: 17,                                   // a boost pad kicks you up to this
  grip: 12, turnMax: 2.4,                      // turn rate (rad/s) = min(turnMax, grip / speed): a corner of radius r is taken at up to sqrt(grip x r) (8: 9.8, 12: 12)
  steerK: 1.6,                                 // the throttle drops as you ask for a sharper turn (cos(angle) x steerK, 0..1)
  r: 0.45, g: 20, kick: 0.62, airSteer: 0.25,  // the kart's half size, gravity, a ramp's launch (vy = kick x speed), steering in the air
  climb: 0.6, dropGain: 0.8, dropCap: 15,      // speed lost per block climbed, gained per block dropped (up to dropCap)
  bounce: 0.3, bonk: 3,                        // a wall: speed back x bounce; a hit faster than bonk is a bonk
};
// The road under a kart. Everything else that is solid is a wall unless it is a step of road (you can drive up a step of road).
export const ROAD = new Set([B.ASPHALT, B.TRACK_LINE, B.CHECKER, B.BOOST_PAD, B.BOOST_PAD_LIT, B.HOT_TRACK, B.KICKER]);
export const surfaceOf = id => (ROAD.has(id) ? 'road' : id === B.KERB ? 'kerb' : 'grass');
const STEP = new Set([...ROAD, B.KERB]);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export class Kart {
  constructor(x = 0, y = 0, z = 0, h = 0) { this.reset(x, y, z, h); this.acc = 0; this.t = 0; }
  reset(x, y, z, h = this.h) {
    this.x = x; this.y = y; this.z = z; this.h = h;
    this.v = 0; this.vy = 0; this.air = false; this.under = B.ASPHALT; this.peak = y;
  }
  get speed() { return Math.abs(this.v); }
  get surface() { return this.air ? 'air' : surfaceOf(this.under); }
  // dt: frame seconds; input = { x, z, m } (the stick as a world direction and how far it is pushed, 0..1);
  // get(x, y, z): the block id. Returns the events of this frame: { type: 'boost' | 'bonk' | 'jump' | 'land' | 'splash', ... }.
  update(dt, input, get) {
    this.acc += dt;
    const ev = [], h = KART.sub;
    let n = 0;
    while (this.acc >= h && n < KART.maxSubs) { this.acc -= h; n++; this.t += h; this.step(h, input, get, ev); if (ev.some(e => e.type === 'splash')) { this.acc = 0; break; } }
    if (this.acc > h * KART.maxSubs) this.acc = 0; // a very slow frame: never catch up
    return ev;
  }
  // a block of the kart's footprint (its four corners) at layer y: the first solid id there, or 0
  hits(x, z, y, get) {
    const r = KART.r;
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      const id = get(Math.floor(x + dx), y, Math.floor(z + dz));
      if (isSolid(id)) return id;
    }
    return 0;
  }
  step(dt, input, get, ev) {
    const K = KART, m = Math.min(1, input?.m || 0), surf = this.air ? 'air' : surfaceOf(this.under);
    // steering and the pedals
    let throttle = 0, braking = false;
    if (m > 0.1) {
      const want = Math.atan2(input.x, input.z);
      let dh = wrap(want - this.h);
      if (Math.abs(dh) > 2.3 && this.v > 0.3) braking = true;                 // stick back: brake
      else if (Math.abs(dh) > 2.3) { dh = wrap(dh + Math.PI); throttle = -m; } // stopped: back up (and the nose turns the other way)
      else throttle = m * Math.max(0, Math.min(1, Math.cos(dh) * K.steerK));
      if (!braking) {
        const rate = Math.min(K.turnMax, K.grip / Math.max(1, this.speed)) * (this.air ? K.airSteer : 1);
        this.h = wrap(this.h + Math.max(-rate * dt, Math.min(rate * dt, dh)));
      }
    }
    if (!this.air) {
      const top = K.top[surf] ?? K.top.grass;
      if (braking) this.v = Math.max(0, this.v - K.brake * dt);
      else if (throttle > 0) { // half a push drives at half speed (at least a third of the top)
        const cap = top * Math.max(throttle, 0.35);
        if (this.v < cap) this.v = Math.min(cap, this.v + K.accel * throttle * dt);
        else if (this.v <= top) this.v = Math.max(cap, this.v - K.coast * dt);
      }
      else if (throttle < 0) this.v = Math.max(-K.back, this.v - K.accel * dt);
      if (throttle <= 0 && !braking) this.v = this.v > 0 ? Math.max(0, this.v - K.coast * dt) : Math.min(0, this.v + K.coast * dt);
      if (this.v > top) this.v = Math.max(top, this.v - (K.over[surf] ?? K.over.grass) * dt);
    }
    // move along the heading, x then z, against the walls (a step of road one block up is climbed)
    const dx = Math.sin(this.h) * this.v * dt, dz = Math.cos(this.h) * this.v * dt;
    for (const [ax, d] of [['x', dx], ['z', dz]]) {
      if (!d) continue;
      const nx = ax === 'x' ? this.x + d : this.x, nz = ax === 'z' ? this.z + d : this.z, layer = Math.floor(this.y + 0.05);
      const low = this.hits(nx, nz, layer, get), high = this.hits(nx, nz, layer + 1, get) || this.hits(nx, nz, layer + 2, get);
      if (!low && !high) { this.x = nx; this.z = nz; continue; }
      if (low && !high && !this.air && STEP.has(low) && this.v > 0) { // a step of road: up it goes, a bit slower
        this.x = nx; this.z = nz; this.y = layer + 1; this.v = Math.max(0, this.v - K.climb);
        continue;
      }
      const hit = Math.abs(this.v);
      this.v = -this.v * K.bounce;
      if (hit > K.bonk) ev.push({ type: 'bonk', speed: hit, id: low || high, x: this.x, z: this.z });
    }
    // up and down: stand on the block below, fall off an edge, a ramp's end launches you
    const below = Math.floor(this.y - 0.05), under = this.hits(this.x, this.z, below, get);
    if (!this.air) {
      if (under) { const mid = get(Math.floor(this.x), below, Math.floor(this.z)); this.under = isSolid(mid) ? mid : under; this.y = below + 1; } // the surface: what is under the kart's middle
      else {
        this.air = true; this.peak = this.y;
        this.vy = this.under === B.KICKER && this.v > 2 ? K.kick * this.v : 0; // off the end of a ramp: up you go
        if (this.vy > 0) ev.push({ type: 'jump', speed: this.v });
      }
    }
    if (this.air) {
      this.vy -= K.g * dt;
      const ny = this.y + this.vy * dt;
      this.peak = Math.max(this.peak, ny);
      const land = this.vy <= 0 ? this.hits(this.x, this.z, Math.floor(ny), get) : 0;
      if (this.vy > 0 && this.hits(this.x, this.z, Math.floor(ny + 1), get)) this.vy = 0; // a roof
      if (land) {
        this.y = Math.floor(ny) + 1; this.air = false; this.under = land;
        const fall = this.peak - this.y;
        if (fall > 0.6 && ROAD.has(land)) this.v = Math.min(K.dropCap, this.v + K.dropGain * fall);
        this.vy = 0;
        ev.push({ type: 'land', fall });
      } else this.y = ny;
    }
    const wet = get(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z));
    if (wet === B.WATER || this.y < -2) { ev.push({ type: 'splash' }); return; }
    // a boost pad under you
    if (!this.air && (this.under === B.BOOST_PAD || this.under === B.BOOST_PAD_LIT) && this.v < K.boost - 0.5) { this.v = K.boost; ev.push({ type: 'boost' }); }
  }
}
