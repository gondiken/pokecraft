// Live gym parts: things in a gym that change while you play (the Clock Tower's doors and hand, the Firewall Maze's
// lasers). One object per gym whose def has `live`, made with every new world. They change blocks only with
// world.setLive (this player only: never an edit, never saved or sent).
import { isSolid } from './blocks.js';
import { ClockLive } from './clocktower.js';
import { MazeLive } from './firewall.js';
import { HomeLive } from './homegym.js';
import { VaultLive } from './treasurevault.js';
import { RestaurantLive } from './restaurant.js'; // T33
import { CourseLive } from './obstaclecourse.js'; // T36
import { DanceLive } from './dancefloor.js'; // the Echo Gym's dance-off
import { DojoLive } from './shadowdojo.js'; // T37b
import { StadiumLive } from './stadiumlive.js'; // T40d
import { RaceLive } from './racelive.js'; // T40c
import { HouseLive } from './houselive.js'; // T40a
import { PirateLive } from './pirateparts.js'; // T40b
import { AtlantisLive } from './atlantislive.js'; // T41

// Interface of a live object: constructor(game, gym), update(dt), optional stand(x, y, z, id), hit(block),
// prompt(block, how) and dispose(). T33 adds optional talk(npc), talkPrompt(npc), broke(block), battleEnded(result, opts)
// T40 adds action(block), near(p), use(p), aim(p) and parts (see below), the owner's 2026-10-26 tweak holds(p) / release(p). (a live object must not use these names for anything else, the same rule as stand/hit/prompt).
export const LIVE = { clock: ClockLive, maze: MazeLive, home: HomeLive, vault: VaultLive };
LIVE.restaurant = RestaurantLive; // T33
LIVE.course = CourseLive; // T36
LIVE.dance = DanceLive; // the Echo Gym's dance-off (the building is unchanged)
LIVE.dojo = DojoLive; // T37b the Shadow Dojo's watchers
LIVE.stadium = StadiumLive; // T40d the Ball Stadium's balls and keepers (a live part of Playland)
LIVE.race = RaceLive; // T40c the Race Track
LIVE.house = HouseLive; // T40a the Giant House's fan, train, tap, cat and crumbs
LIVE.pirate = PirateLive; // T40b the Pirate Seas: cannons, ropes, the chest
LIVE.atlantis = AtlantisLive; // T41 the Sunken City: Glowfish Catch (a part of the Pirate Seas)

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
      // T40: live parts of a realm (a Picture World's train, race, cannon, balls...): world.parts = [{ id, live, ...data }]; the
      // object is made fresh with every world and gets the part (not a gym) as its constructor argument.
      for (const part of world.parts || []) {
        const L = LIVE[part.live];
        if (L) objects.set(`part:${part.id}`, new L(game, part));
      }
    },
    update(dt) { for (const o of objects.values()) o.update?.(dt); },
    // The block under the player's feet (called every frame while on the ground).
    stand(x, y, z, id) { for (const o of objects.values()) o.stand?.(x, y, z, id); },
    // A clicked or tapped block; true = handled (reset buttons).
    hit(block) { return !!each(o => o.hit?.(block)); },
    // Text for the crosshair prompt, or null.
    prompt(block, how) { return each(o => o.prompt?.(block, how)); },
    // T33: a person was talked to (true = handled), the words for the crosshair / touch button ({ verb, action } or null),
    // a natural block was broken (ingredients), and a battle ended.
    talk(npc) { return !!each(o => o.talk?.(npc)); },
    talkPrompt(npc) { return each(o => o.talkPrompt?.(npc)); },
    // T40: the word the big action button shows for a live block ("Ride!", "Fire!"), or null.
    action(block) { return each(o => o.action?.(block)); },
    // T40: hooks without a targeted block. near(p) -> a short action word or null (asked when the crosshair hits nothing usable:
    // "Fire!" on a cannon pad, "Kick!" beside a ball); use(p) -> true if handled (the action key / tap / E path, when near gave a word);
    // aim(p) -> a guide arrow { x, z, text(arrow, metres) } that the realm guide asks before the Picture World's default aim.
    near(p) { return each(o => (typeof o.near === 'function' ? o.near(p) : null)); }, // (DojoLive has a boolean `near` of its own: only functions count)
    use(p) { return !!each(o => o.use?.(p)); },
    // Owner 2026-10-26: a hold-and-let-go action (Kick!, Shoot!). holds(p) -> true when the big button should press on touch-down
    // (then use(p) starts the hold); release(p) lets go (E up, mouse up, the finger up). Live parts without them are never held.
    holds(p) { return !!each(o => o.holds?.(p)); },
    release(p) { return !!each(o => o.release?.(p)); },
    aim(p) { return each(o => o.aim?.(p)); },
    broke(block) { for (const o of objects.values()) o.broke?.(block); },
    battleEnded(result, opts) { for (const o of objects.values()) o.battleEnded?.(result, opts); },
    of(id) { return objects.get(id); },
  };
}

// LiveCells lives in livecells.js (no cycle with the gym files that import it); re-exported here.
export { LiveCells } from './livecells.js';
