// A live cell helper shared by the gym files (kept apart from gymlive.js, which imports those files).
import { isSolid } from './blocks.js';

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
