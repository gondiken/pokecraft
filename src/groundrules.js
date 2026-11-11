// Chapter 3 (plans/chapter3-world.md section 6, "Slippy Lake"): what the ground you stand on does to moving, one object per kind of
// ground. Pure, no imports (Node-runnable). A world says which rule holds where with `world.groundAt(pos)` (like world.flowAt: undefined
// in every world but Wobbleland, so everywhere else nothing changes); the player's physics (player.js walkStep) and the scribble fight
// (scribblefight.js, through groundOf) both ask it and both move by the rule's `move`.
//   A new ground (Shadywood's dark, Bumpy Hills' high ground) = one more subclass + one line in GROUND; the rest asks the same questions.
//   grips(type):  does a creature of this type keep its grip here (no type = a person on foot)
//   move(v, tx, tz, dt, grip): the walking velocity v eases toward the wanted (tx, tz) for one step of dt
//   carry:        what is left of a rush / dodge's speed when it ends (a slider skids on)
//   overshoot:    how far a slipping monster's charge goes past its aim (its red line is drawn that much longer)
//   sight(type):  how far a creature of this type lights the dark round itself (Infinity = no dark: you see everything)
export class GroundRule {
  constructor(o = {}) { this.id = 'plain'; Object.assign(this, o); }
  grips() { return true; }
  move(v, tx, tz) { v.x = tx; v.z = tz; }
  carry() { return 0; }
  overshoot() { return 0; }
  sight() { return Infinity; }
  // how far something moving at speed `s` goes before it stops if it lets go now (the bots and the skid marks read it)
  stopDist() { return 0; }
}

// Ice (Slippy Lake): you, your creature and the monsters slide; the speed eases toward what the stick wants (1 - e^-k dt per step: the
// same at every step length). Letting go (slowing down) eases at `k`, so from a walk (4.3 a second) you glide 4.3 / k = 4 blocks;
// getting going and turning (the stick wants at least the speed you have) eases at `go`, slower: on ice it is hard to start and to turn,
// so a creature that slips gets out of a red warning late (measured: with `go` = `k` the grip made no difference to any bot). Ice
// creatures (and Ice monsters) keep their grip: they start, turn and stop at once (no skid marks).
export class Ice extends GroundRule {
  constructor(o = {}) { super({ id: 'ice', k: 1.1, go: 0.7, rush: 4, dodge: 3, past: 2, ...o }); } // (owner 2026-11-11 evening: "more slippery, more fun": was k 2.15, go 1.0)
  grips(type) { return type === 'ice'; }
  move(v, tx, tz, dt, grip = false) {
    if (grip) { v.x = tx; v.z = tz; return; }
    const a = 1 - Math.exp(-(Math.hypot(tx, tz) >= Math.hypot(v.x, v.z) - 1e-9 ? this.go : this.k) * dt);
    v.x += (tx - v.x) * a; v.z += (tz - v.z) * a;
  }
  carry(kind, type) { return this.grips(type) ? 0 : kind === 'dodge' ? this.dodge : this.rush; }
  overshoot(type) { return this.grips(type) ? 0 : this.past; }
  stopDist(s, type) { return this.grips(type) ? 0 : s / this.k; }
}


// The dark (Shadywood): under the closed canopy you see only inside your creature's light. Walking and fighting are as on plain ground
// (everyone keeps their grip); only what you SEE changes: a monster outside your light shows only its eyes, and its red warning shows
// only for its last `late` seconds (you see the attack coming, but late). Glowing types (`bright`: Fire, Light, Electric, Cosmic) light
// a circle `far` round them (twice `near`): you see the warnings in time. A glowing MONSTER is always seen (it lights itself), and so is
// one you just hit (`hitLit` s) or one in a big blast's flash (`flash` s over the blast's ring). (plans/chapter3-world.md "Shadywood")
export const BRIGHT = ['fire', 'light', 'electric', 'cosmic'];
export class Dark extends GroundRule {
  constructor(o = {}) { super({ id: 'dark', near: 5, far: 10, late: 0.6, hitLit: 0.8, flash: 1.4, ...o }); }
  glows(type) { return BRIGHT.includes(type); }
  sight(type) { return this.glows(type) ? this.far : this.near; }
}

export const GROUND = { ice: new Ice(), dark: new Dark() };
