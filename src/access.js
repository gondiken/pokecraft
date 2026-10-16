// Gym access: where a gym is (surface, cave, sky, ...) and when it is open (always, night, ...), one small
// piece each, combined per gym. The guide only talks to these objects. Add a kind by adding an entry to WHERE
// or WHEN; a gym picks one with def.access = { where, when } (else from how it was placed and def.night).
import { WORLD_W } from './world.js';
import { trainersOf, trainerKey } from './gyms.js';
import { WINDOWS, windowAt, minutesUntil } from './daytime.js';

// Is p inside the box {x0, x1, y0, y1, z0, z1} (inclusive block coordinates)?
const inBox = (b, p) => p.x >= b.x0 && p.x < b.x1 + 1 && p.z >= b.z0 && p.z < b.z1 + 1 && p.y >= b.y0 - 1 && p.y < b.y1 + 1;
// How far away the Hidden Hill's arrow stops (T19).
export const HIDE_R = 20;

// where-pieces: (g, game, deps) => { aim(p), tips?(p, told), contains?(p), welcome?() }
// aim(p) gives the arrow target and the guide text; no `x` means no arrow.
export const WHERE = {
  surface: g => ({
    aim() {
      const x = g.x + 0.5, z = g.z + 0.5;
      return { x, z, text: (arrow, dist) => (dist < 8 ? `${g.def.name} is here!` : `Next: ${g.def.name} ${arrow} ${dist}m`) };
    },
  }),

  // Floating gyms (Cloud, Saucer): the arrow points at the landing pad until you are on the island.
  sky: g => ({
    aim(p) {
      let x = g.x + 0.5, z = g.z + 0.5;
      const h = Math.hypot(x - p.x, z - p.z);
      const onIsland = p.y >= g.y - 1 && h < 12;
      const above = h < 14 && p.y < g.y - 1;
      if (above && g.pad) { x = g.pad[0] + 0.5; z = g.pad[2] + 0.5; }
      return {
        x, z,
        text: (arrow, dist) => (above ? `The ${g.def.name} is right above you! ⬆`
          : onIsland ? `${g.def.name} is here!` : `Next: ${g.def.name} (up in the sky!) ${arrow} ${dist}m`),
      };
    },
    // They float above the ground, so tell the player to build up.
    tips(p, told) {
      const msgs = [];
      const h = Math.hypot(g.x + 0.5 - p.x, g.z + 0.5 - p.z);
      if (h > 24) told.near = false;
      else if (h <= 14 && p.y < g.y - 1 && !told.near) {
        told.near = true;
        msgs.push(`The ${g.def.name} floats high in the sky! Build a tower of blocks on the ${g.padColor || 'blue'} pad and jump across.`);
      }
      if (!told.pad && g.pad && Math.hypot(p.x - (g.pad[0] + 0.5), p.z - (g.pad[2] + 0.5)) < 2 && p.y < g.y - 1) {
        told.pad = true;
        msgs.push('Tip: look down, jump and place a block under you. Keep going up!');
      }
      return msgs;
    },
  }),

  // Cave gyms: from outside the arrow points at the stairway's arch, inside at the gym.
  cave: (g, game) => ({
    aim(p) {
      let x = g.x + 0.5, z = g.z + 0.5, where;
      const [mx, , mz] = g.cave.mouth;
      const [fx, fz] = g.front;
      // On the way in: close to the line from the arch to the door and below the hill, or in the cavern.
      const along = (p.x - (mx + 0.5)) * -fx + (p.z - (mz + 0.5)) * -fz; // distance from the arch towards the gym
      const total = Math.abs(mx - g.x) + Math.abs(mz - g.z);
      const across = Math.abs((p.x - g.x - 0.5) * fz) + Math.abs((p.z - g.z - 0.5) * fx);
      const ground = game.world.ground[Math.floor(p.x) + Math.floor(p.z) * WORLD_W] ?? 99;
      const onTheWay = along >= -1 && along <= total + 1 && across <= 3 && p.y < ground + 1;
      const inCavern = Math.max(Math.abs(p.x - g.x - 0.5), Math.abs(p.z - g.z - 0.5)) <= 14 && p.y < g.y + 9;
      if (onTheWay || inCavern) where = 'in';
      else { x = mx + 0.5; z = mz + 0.5; where = 'out'; }
      return {
        x, z,
        text: (arrow, dist) => {
          if (where === 'out') return dist < 6 ? `The ${g.def.name} is down these stairs!` : `Next: ${g.def.name} (in a cave) ${arrow} ${dist}m`;
          const own = Math.hypot(g.x + 0.5 - p.x, g.z + 0.5 - p.z);
          return own < 8 ? `${g.def.name} is here!` : `Next: ${g.def.name} ↓ ${Math.round(own)}m`;
        },
      };
    },
  }),
};

// Hidden gyms (T19 Hidden Hill): far away the normal arrow; within HIDE_R blocks it fades out (no `x`) and the
// player has to look around.
WHERE.hidden = g => ({
  aim(p) {
    const x = g.x + 0.5, z = g.z + 0.5;
    if (Math.hypot(x - p.x, z - p.z) > HIDE_R) return { x, z, text: (arrow, dist) => `Next: ${g.def.name} ${arrow} ${dist}m` };
    return { text: () => (inBox(g.area, p) ? `${g.def.name} is here!` : "It's hidden somewhere around here…") };
  },
});

// Minutes of real time until it gets dark (0 if it already is).
function minutesToNight(game, { dayLength, smoothstep }) {
  if (game.night) return 0;
  const lightAt = t => smoothstep(-0.2, 0.25, Math.sin(t * Math.PI * 2));
  let t = game.time, steps = 0;
  while (lightAt(t) >= 0.3 && steps < 600) { t = (t + 0.002) % 1; steps++; }
  return Math.max(1, Math.ceil(steps * 0.002 * dayLength / 60));
}

function nightClosed(game, deps, def) {
  const m = minutesToNight(game, deps);
  return `The ${def.name} is empty... ${def.nightText || 'come back at night!'} Night comes in about ${m} minute${m === 1 ? '' : 's'}.`;
}

// when-pieces: (g, game, deps) => { wait(), closedText(npc), status?() }
// wait(): a phrase ("at night ☾") when the arrow should skip this gym for now, else null.
// status(): optional words the guide adds after its text (the Clock Tower says which door is open).
// closedText(npc): what to say when it is closed (walk-in toast without npc, talking passes the npc), else null.
export const WHEN = {
  always: () => ({ wait: () => null, closedText: () => null }),
  night: (g, game, deps) => ({
    wait: () => (game.night ? null : 'at night ☾'),
    closedText: () => (game.night ? null : nightClosed(game, deps, g.def)),
  }),
  // Clock Tower: every person has a door window (`opens` in their def). The arrow never skips this gym.
  clock: (g, game, deps) => ({
    wait: () => null,
    closedText: npc => {
      const opens = npc?.def?.opens;
      if (!opens || windowAt(game.time) === opens) return null;
      const w = WINDOWS[opens], m = minutesUntil(opens, game.time, deps.dayLength);
      return `${npc.name}: My door opens ${w.when}, when the big hand reaches ${w.color}. About ${m} minute${m === 1 ? '' : 's'}!`;
    },
    status: () => {
      const todo = trainersOf(g.def).filter((p, i) => !game.beaten.includes(trainerKey(g.def, i)));
      const who = todo[0] || (game.badges.includes(g.def.id) ? null : g.def.leader);
      if (!who?.opens) return '';
      const w = WINDOWS[who.opens];
      if (windowAt(game.time) === who.opens) return ` · the ${w.color} door is open!`;
      const m = minutesUntil(who.opens, game.time, deps.dayLength);
      return ` · the ${w.color} door opens in ${m} min`;
    },
  }),
};

// deps = { dayLength, smoothstep }, the same ones the sky uses.
export function createAccess(game, deps) {
  let cache = new WeakMap();
  function of(g) {
    let a = cache.get(g);
    if (a) return a;
    const spec = g.def.access || {};
    const where = spec.where || (g.sky ? 'sky' : g.cave ? 'cave' : 'surface');
    const when = spec.when || (g.def.night ? 'night' : 'always');
    if (!WHERE[where]) throw new Error(`Unknown gym access '${where}' for ${g.def.id}`);
    if (!WHEN[when]) throw new Error(`Unknown gym access '${when}' for ${g.def.id}`);
    const w = WHERE[where](g, game, deps), t = WHEN[when](g, game, deps);
    a = {
      gym: g, name: g.def.name, where, when,
      aim: p => w.aim(p),
      tips: w.tips ? (p, told) => w.tips(p, told) : null,
      contains: w.contains || (p => (g.area ? inBox(g.area, p) : (g.tower ? game.world.towerAt(p.x, p.z) : game.world.gymAt(p.x, p.z, p.y)) === g)),
      welcome: w.welcome || (() => (g.tower ? "Welcome to the Champion's Tower!" : g.def.welcome || `Welcome to the ${g.def.name}! (${g.def.type} type)`)),
      wait: () => t.wait(),
      closedText: npc => t.closedText(npc),
      status: () => (t.status ? t.status() : ''),
      isOpen: npc => !t.closedText(npc),
    };
    cache.set(g, a);
    return a;
  }
  // forget(): drop the cache (tests that change def.access; a new world needs nothing: new gym objects).
  return { of, forget: () => { cache = new WeakMap(); }, WHERE, WHEN };
}
