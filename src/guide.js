// The guide arrow, the night-gym closed message and the "Welcome to the ..." toasts. Moved out of
// main.js without changes to its logic.
import { WORLD_W } from './world.js';

// deps: dayLength (seconds in a full day) and smoothstep, the same ones the sky uses.
export function createGuide(game, { dayLength, smoothstep }) {
  // Minutes of real time until it gets dark (0 if it already is).
  function minutesToNight() {
    if (game.night) return 0;
    const lightAt = t => smoothstep(-0.2, 0.25, Math.sin(t * Math.PI * 2));
    let t = game.time, steps = 0;
    while (lightAt(t) >= 0.3 && steps < 600) { t = (t + 0.002) % 1; steps++; }
    return Math.max(1, Math.ceil(steps * 0.002 * dayLength / 60));
  }

  function nightGymClosed(def) {
    const m = minutesToNight();
    return `The ${def.name} is empty... ${def.nightText || 'come back at night!'} Night comes in about ${m} minute${m === 1 ? '' : 's'}.`;
  }

  let skyToldNear = false, skyToldPad = false, skyNearest = null;
  let currentGym = null;

  // Points the player towards the next gym they haven't beaten yet.
  function updateGuide() {
    const p = game.player.pos;
    const unbeaten = game.world.gyms.filter(g => !game.badges.includes(g.def.id));
    let next = unbeaten[0];
    let nightNote = '';
    // By day the arrow skips the night gyms (Comet, Saucer) and mentions the ones it skipped.
    if (next?.def.night && !game.night) {
      const other = unbeaten.find(g => !g.def.night);
      if (other) {
        const skipped = unbeaten.slice(0, unbeaten.indexOf(other)).map(g => g.def.name);
        next = other;
        nightNote = ` · ${skipped.join(' and ')} ${skipped.length > 1 ? 'open' : 'opens'} at night ☾`;
      } else nightNote = ' (opens at night ☾)';
    }
    if (!next && !game.champion && game.world.tower) next = game.world.tower;
    if (!next) game.ui.setGuide('★ Champion! ★');
    else updateArrow(p, next, nightNote);

    // Sky gym hints (Cloud and Saucer): they float above the ground, so tell the player to build up.
    const dist = g => Math.hypot(g.x + 0.5 - p.x, g.z + 0.5 - p.z);
    const sky = game.world.gyms.filter(g => g.sky && !game.badges.includes(g.def.id)).sort((a, b) => dist(a) - dist(b))[0];
    if (sky !== skyNearest) { skyNearest = sky; skyToldNear = skyToldPad = false; }
    if (sky) {
      const h = Math.hypot(sky.x + 0.5 - p.x, sky.z + 0.5 - p.z);
      if (h > 24) skyToldNear = false;
      else if (h <= 14 && p.y < sky.y - 1 && !skyToldNear) {
        skyToldNear = true;
        game.ui.toast(`The ${sky.def.name} floats high in the sky! Build a tower of blocks on the ${sky.padColor || 'blue'} pad and jump across.`);
      }
      if (!skyToldPad && sky.pad && Math.hypot(p.x - (sky.pad[0] + 0.5), p.z - (sky.pad[2] + 0.5)) < 2 && p.y < sky.y - 1) {
        skyToldPad = true;
        game.ui.toast('Tip: look down, jump and place a block under you. Keep going up!');
      }
    }

    const inside = game.world.gymAt(p.x, p.z, p.y) || game.world.towerAt(p.x, p.z);
    if (inside !== currentGym) {
      currentGym = inside;
      if (inside?.tower) game.ui.toast("Welcome to the Champion's Tower!");
      else if (inside?.def.night && !game.night) game.ui.toast(nightGymClosed(inside.def));
      else if (inside) game.ui.toast(`Welcome to the ${inside.def.name}! (${inside.def.type} type)`);
    }
  }

  function updateArrow(p, next, note = '') {
    let tx = next.x + 0.5, tz = next.z + 0.5, where = '';
    const cave = next.cave;
    let above = false, onIsland = false;
    if (next.sky) {
      const h = Math.hypot(tx - p.x, tz - p.z);
      onIsland = p.y >= next.y - 1 && h < 12;
      above = h < 14 && p.y < next.y - 1;
      if (above && next.pad) { tx = next.pad[0] + 0.5; tz = next.pad[2] + 0.5; }
    }
    if (cave) {
      const [mx, , mz] = cave.mouth;
      const [fx, fz] = next.front;
      // On the way in: close to the line from the arch to the door and below the hill, or in the cavern.
      const along = (p.x - (mx + 0.5)) * -fx + (p.z - (mz + 0.5)) * -fz; // distance from the arch towards the gym
      const total = Math.abs(mx - next.x) + Math.abs(mz - next.z);
      const across = Math.abs((p.x - next.x - 0.5) * fz) + Math.abs((p.z - next.z - 0.5) * fx);
      const ground = game.world.ground[Math.floor(p.x) + Math.floor(p.z) * WORLD_W] ?? 99;
      const onTheWay = along >= -1 && along <= total + 1 && across <= 3 && p.y < ground + 1;
      const inCavern = Math.max(Math.abs(p.x - next.x - 0.5), Math.abs(p.z - next.z - 0.5)) <= 14 && p.y < next.y + 9;
      if (onTheWay || inCavern) where = 'in';
      else { tx = mx + 0.5; tz = mz + 0.5; where = 'out'; }
    }
    game.guideTarget = [tx, tz];
    const dx = tx - p.x, dz = tz - p.z;
    const dist = Math.round(Math.hypot(dx, dz));
    // Angle of the target relative to where the player is looking.
    let rel = Math.atan2(-dx, -dz) - game.player.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const arrows = ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'];
    const arrow = arrows[((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8];
    let text;
    if (where === 'out') text = dist < 6 ? `The ${next.def.name} is down these stairs!` : `Next: ${next.def.name} (in a cave) ${arrow} ${dist}m`;
    else if (where === 'in') text = Math.hypot(next.x + 0.5 - p.x, next.z + 0.5 - p.z) < 8 ? `${next.def.name} is here!` : `Next: ${next.def.name} ↓ ${Math.round(Math.hypot(next.x + 0.5 - p.x, next.z + 0.5 - p.z))}m`;
    else if (next.sky) {
      text = above ? `The ${next.def.name} is right above you! ⬆`
        : onIsland ? `${next.def.name} is here!` : `Next: ${next.def.name} (up in the sky!) ${arrow} ${dist}m`;
    } else text = dist < 8 ? `${next.def.name} is here!` : `Next: ${next.def.name} ${arrow} ${dist}m`;
    game.ui.setGuide(text + note);
  }

  return { updateGuide, nightGymClosed };
}
