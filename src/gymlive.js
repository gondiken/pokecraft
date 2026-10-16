// Live gym parts: things in a gym that change while you play (the Clock Tower's doors and hand, the Firewall Maze's
// lasers). One object per gym whose def has `live`, made with every new world. They change blocks only with
// world.setLive (this player only: never an edit, never saved or sent).
import { isSolid } from './blocks.js';
import { ClockLive } from './clocktower.js';
import { MazeLive } from './firewall.js';

// Interface of a live object: constructor(game, gym), update(dt), optional stand(x, y, z, id), hit(block),
// prompt(block, how) and dispose().
export const LIVE = { clock: ClockLive, maze: MazeLive };

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

// A cell that should change, waiting while a player stands in it: a door or laser never closes on you.
export class LiveCells {
  constructor(world, player) { // player = () => game.player (it changes per world)
    this.world = world;
    this.player = player;
    this.waiting = new Map(); // 'x,y,z' -> [x, y, z, id]
  }

  // Remember the wanted block; applied now unless it is solid and overlaps the player.
  want(x, y, z, id) {
    const key = `${x},${y},${z}`;
    if (this.world.get(x, y, z) === id) { this.waiting.delete(key); return; }
    if (isSolid(id) && this.player()?.overlapsBlock(x, y, z)) { this.waiting.set(key, [x, y, z, id]); return; }
    this.waiting.delete(key);
    this.world.setLive(x, y, z, id);
  }

  // Retry the waiting ones (call from update()).
  flush() {
    if (!this.waiting.size) return;
    for (const [x, y, z, id] of [...this.waiting.values()]) this.want(x, y, z, id);
  }
}
