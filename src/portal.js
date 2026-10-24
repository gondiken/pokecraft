// T38a: the Portal Door beside the Champion's Tower door, and the live part of the Swirl's doors.
// The door is built into the main world when the tower is (gymplace.js placeTower): a frame and a dim surface that
// only a Champion sees swirling (setLive: never an edit, never saved or sent). Using it travels to the Swirl realm
// (realms.js); the door back in the Swirl travels home. `createPortal(game)` -> `game.portal`.
// Imports only blocks.js (world.js and gymplace.js import this file, so it must not import them back).
import { B } from './blocks.js';
import { PICTURE_WORLDS } from './pictureworlds.js';

// The door stands flat against the tower's front wall, right of the rainbow pillar, in the row d = 7 (the tower's own
// protected box, +-7, already holds it: no player build can be lost). d = distance in front of the tower centre,
// s = sideways ([front[1], front[0]]). Surface s 4..6 x y fy+1..fy+5 (3 wide, 5 tall), posts at s 3 and 7, lintel fy+6, crown fy+7.
export const PORTAL_AT = { d: 7, s0: 3, s1: 7, surface: [4, 6], h: 5, stand: [8, 5] };

// Builds the Portal Door into the world next to `tower` (world.tower). Returns (and sets) world.portal:
// { x, y, z, front, side, surface: [[x, y, z] x 15], frame: [[x, y, z]...], stand: [x, y, z, yaw], box }.
export function buildPortalDoor(world, tower) {
  const fy = tower.y - 1, front = tower.front, side = [front[1], front[0]];
  const at = (d, s) => [tower.x + front[0] * d + side[0] * s, tower.z + front[1] * d + side[1] * s];
  const { d, s0, s1, surface, h } = PORTAL_AT;
  const put = (s, y, id, list) => { const [x, z] = at(d, s); world.set(x, y, z, id, false); list.push([x, y, z]); };
  const frame = [], cells = [];
  for (let y = fy + 1; y <= fy + h + 1; y++) { put(s0, y, B.PORTAL_FRAME, frame); put(s1, y, B.PORTAL_FRAME, frame); }
  for (let s = s0 + 1; s < s1; s++) put(s, fy + h + 1, B.PORTAL_FRAME, frame); // lintel
  put((s0 + s1) / 2, fy + h + 2, B.PORTAL_FRAME, frame); // crown
  for (let s = surface[0]; s <= surface[1]; s++) for (let y = fy + 1; y <= fy + h; y++) put(s, y, B.PORTAL_DIM, cells);
  const [a, b] = [at(d, s0), at(d, s1)];
  const box = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: fy, y1: fy + h + 2, z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  const [sx, sz] = at(PORTAL_AT.stand[0], PORTAL_AT.stand[1]);
  // You come back standing in front of the door (on the tower's stone ring), looking away from it.
  world.portal = { x: tower.x, y: fy + 1, z: tower.z, front, side, surface: cells, frame, stand: [sx + 0.5, fy + 1, sz + 0.5, Math.atan2(-front[0], -front[1])], box };
  return world.portal;
}

const DOOR_IDS = new Set([B.PORTAL, B.PORTAL_DIM, B.PORTAL_FRAME]);
const inBox = (b, k) => k.x >= b.x0 && k.x <= b.x1 && k.y >= b.y0 && k.y <= b.y1 && k.z >= b.z0 && k.z <= b.z1;

export function createPortal(game) {
  let acc = 0, wanted = null;

  // Which door (if any) is this block? 'main' = the Portal Door beside the tower, 'back' = the Swirl's door home.
  function kindOf(block) {
    const w = game.world;
    if (!block || !w) return null;
    if (game.place === 'main') return w.portal && DOOR_IDS.has(block.id) && inBox(w.portal.box, block) ? 'main' : null;
    if (w.door && (block.id === B.PORTAL || block.id === B.PORTAL_FRAME) && inBox(w.door.box, block)) return 'back';
    return null;
  }

  const self = {
    kindOf,

    // Every frame (the main loop): a Champion sees the door swirling; everybody else sees it dim.
    update(dt) {
      const w = game.world;
      if (!w || game.place !== 'main') { swirlUpdate(game, dt); return; }
      if (!w.portal) return;
      acc += dt;
      if (acc < 0.25) return;
      acc = 0;
      const id = game.champion ? B.PORTAL : B.PORTAL_DIM;
      if (id !== wanted || w.get(...w.portal.surface[0]) !== id) {
        for (const [x, y, z] of w.portal.surface) w.setLive(x, y, z, id);
        wanted = id;
      }
      if (game.champion && game.started && !game.inBattle && !game.toldOnce.has('portal-near')) { // once per session
        const p = game.player.pos, c = w.portal;
        if (Math.hypot(p.x - (c.stand[0]), p.z - (c.stand[2])) < 12) { game.toldOnce.add('portal-near'); game.ui.toast('The Portal Door is swirling. Step in!'); }
      }
    },

    // The player used (E / tap / click) a block: true when it was a door and something was said or done.
    use(block) {
      const k = kindOf(block);
      if (k === 'main') {
        if (!game.champion) { game.ui.toast('Only a Champion can open this door. Win in the tower first!'); return true; }
        if (game.mp?.role === 'guest') { game.ui.toast('Go through the Portal Door in your own world!'); return true; }
        game.realms.enter('swirl', { back: game.world.portal.stand });
        return true;
      }
      if (k === 'back') { game.realms.leave('door'); return true; }
      return swirlUse(game, block);
    },

    // The words under the crosshair: '' = not mine.
    prompt(block, how) {
      const k = kindOf(block);
      if (k === 'main') return game.champion ? `Portal Door · ${how} to step in` : 'Portal Door · closed';
      if (k === 'back') return `Portal Door · ${how} to go home`;
      return swirlPrompt(game, block, how);
    },
    action(block) {
      const k = kindOf(block);
      if (k === 'main') return game.champion ? 'Step in!' : '';
      if (k === 'back') return 'Go home!';
      return swirlAction(game, block);
    },

    // A new world was made (createWorld): forget what was drawn.
    reset(world) { acc = 0; wanted = null; swirlReset(game, world); },
    // The board the HUD shows: one entry per Picture World.
    stars() { return PICTURE_WORLDS.map(w => ({ id: w.id, name: w.name, won: game.stars.includes(w.id) })); },
  };
  return self;
}

/* ---- The Swirl's own parts (builder B fills these in): frames, star stones and their outlines, the Wizard's door, lifts. ---- */
function swirlUpdate(game, dt) { /* B: light the star stones from game.stars, outlines, hints */ }
function swirlUse(game, block) { return false; /* B: picture frames ("not open yet") and the Wizard's door */ }
function swirlPrompt(game, block, how) { return ''; }
function swirlAction(game, block) { return ''; }
function swirlReset(game, world) { /* B: lift meshes and outlines are rebuilt for the new world, removed when you leave */ }
