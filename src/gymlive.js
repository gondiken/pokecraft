// Live gym parts: things in a gym that change while you play (the Clock Tower's doors and hand, the Firewall Maze's
// lasers). One object per gym whose def has `live`, made with every new world. They change blocks only with
// world.setLive (this player only: never an edit, never saved or sent).
import { isSolid } from './blocks.js';
import { ClockLive } from './clocktower.js';
import { MazeLive } from './firewall.js';
import { HomeLive } from './homegym.js';
import { VaultLive } from './treasurevault.js';

// Interface of a live object: constructor(game, gym), update(dt), optional stand(x, y, z, id), hit(block),
// prompt(block, how) and dispose().
export const LIVE = { clock: ClockLive, maze: MazeLive, home: HomeLive, vault: VaultLive };

export function createGymLive(game) {
  let objects = new Map(); // gym id -> live object
  const each = fn => { for (const o of objects.values()) { const r = fn(o); if (r) return r; } return null; };
  return {
    // Dispose the old ones and make new ones for every gym of this world that has a `live` kind.
    reset(world) {
      for (const o of objects.values()) o.dispose?.();
      objects = new Map();
      for (const g of world.gyms) {
        const L = g.def.live && LIVE[g.def.live];
        if (L) objects.set(g.def.id, new L(game, g));
      }
    },
    update(dt) { for (const o of objects.values()) o.update?.(dt); },
    // The block under the player's feet (called every frame while on the ground).
    stand(x, y, z, id) { for (const o of objects.values()) o.stand?.(x, y, z, id); },
    // A clicked or tapped block; true = handled (reset buttons).
    hit(block) { return !!each(o => o.hit?.(block)); },
    // Text for the crosshair prompt, or null.
    prompt(block, how) { return each(o => o.prompt?.(block, how)); },
    of(id) { return objects.get(id); },
  };
}

// LiveCells lives in livecells.js (no cycle with the gym files that import it); re-exported here.
export { LiveCells } from './livecells.js';
