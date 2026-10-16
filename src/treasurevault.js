// The Treasure Vault (T23, slot 4 of the new land): builder C fills this in (plans/T23.md section 4).
// Step 0: a plain gym with two trainers (stubSlotGym) and an empty live object.

// Builder: (world, def, slot) => gym object. Writes only inside slot.box.
export const buildTreasureVault = (world, def, slot) => world.stubSlotGym(def, slot);

// The live part of the vault (LIVE.vault): the key chests, key lights, door and compass. Interface: constructor(game, gym),
// update(dt), hit(block), prompt(block, how), dispose().
export class VaultLive {
  constructor(game, gym) { this.game = game; this.gym = gym; }
}
