// STEP 0 STUB (T19): a plain gym with a second trainer; the real building replaces this file (plans/T19.md).
export function buildClockTower(world, def, slot) {
  return world.stubSlotGym(def, slot);
}

// Runtime part of the gym (nothing yet): see src/gymlive.js for the interface.
export class ClockLive {
  constructor(game, gym) { this.game = game; this.gym = gym; }
  update() {}
}
