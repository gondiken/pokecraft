// Champion missions (T29): data, save format and the controller (game.missions). Champion Solenne gives one mission at a time.
// The panel and the HUD chip are in missionui.js; the map spots and clues in treasuremap.js; build checks in buildcheck.js.
import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';
import { sound } from './sound.js';
import { treasureSpots, findCheck } from './treasuremap.js';
import { BUILDS, scanBuild } from './buildcheck.js';
import { checkAll } from './features.js';

// Appended to, never reordered: ids are saved. kind: map (n = which treasure spot), build (build = BUILDS id), boss (boss = BOSSES id).
export const MISSIONS = [
  { id: 'map1', kind: 'map', n: 0, name: 'Treasure map 1' },
  { id: 'lamptower', kind: 'build', build: 'lamptower', name: 'Lamp Tower' },
  { id: 'map2', kind: 'map', n: 1, name: 'Treasure map 2' },
  { id: 'giant1', kind: 'boss', boss: 'giant1', species: 'cragtusk', name: 'Giant Cragtusk' },
  { id: 'bridge', kind: 'build', build: 'bridge', name: 'Water Bridge' },
  { id: 'map3', kind: 'map', n: 2, name: 'Treasure map 3' },
  { id: 'rainbow', kind: 'build', build: 'rainbow', name: 'Rainbow Wall' },
  { id: 'giant2', kind: 'boss', boss: 'giant2', species: 'blizzbear', name: 'Giant Blizzbear' },
  { id: 'map4', kind: 'map', n: 3, name: 'Treasure map 4' },
  { id: 'startower', kind: 'build', build: 'startower', name: 'Star Tower' },
  { id: 'map5', kind: 'map', n: 4, name: 'Treasure map 5' },
  { id: 'giant3', kind: 'boss', boss: 'giant3', species: 'stormwyvern', name: 'Giant Stormwyvern' },
];
export const REWARDS = {
  map: { cubes: 5, block: B.STAR_BLOCK, n: 4 },
  build: { cubes: 5, block: B.RAINBOW_BRICK, n: 4 },
  boss: { cubes: 10, block: B.GIANT_TROPHY, n: 2 },
  helper: { cubes: 5, block: B.GIANT_TROPHY, n: 1 },
};
export const INTRO = {
  map: 'Here is a piece of an old treasure map! Find the X and dig.',
  build: 'Can you build this for me?',
  boss: 'A giant creature appeared! Beat it together with a friend.',
};

export const missionById = id => MISSIONS.find(m => m.id === id) || null;

// Save field `missions` -> { active: id | null, done: [ids], last: id | null }. Unknown ids dropped, done unique, active not done.
export function loadMissions(saved) {
  const done = [];
  if (saved && Array.isArray(saved.done)) for (const id of saved.done) if (typeof id === 'string' && missionById(id) && !done.includes(id)) done.push(id);
  const known = id => (typeof id === 'string' && missionById(id) ? id : null);
  const active = known(saved?.active);
  return { active: active && !done.includes(active) ? active : null, done, last: known(saved?.last) };
}

// The next mission to offer: the first not-done one after `last` (wrapping round), never `skip`. null when all are done.
export function nextMission(state, skip = null) {
  const from = MISSIONS.findIndex(m => m.id === state.last);
  for (let i = 1; i <= MISSIONS.length; i++) {
    const m = MISSIONS[(from + i + MISSIONS.length) % MISSIONS.length];
    if (!state.done.includes(m.id) && m.id !== skip) return m;
  }
  return null;
}

export function createMissions(game, { save }) {
  const toast = t => game.ui.toast(t);
  let deskBattle = null;
  let tick = 0, buildTick = 0, nearToast = null;

  const m = {
    hint: null, // map: { dist, word, period, found }
    report: null, result: null, // build
    get state() { return game.missionState; },
    get active() { return missionById(game.missionState?.active); },
    get doneCount() { return game.missionState?.done.length || 0; },
    get left() { return MISSIONS.length - m.doneCount; },

    // Opened by Champion Solenne: the panel, with her battle behind a button.
    desk(battle) { deskBattle = battle; game.openMissions('desk'); },
    battle() { const b = deskBattle; deskBattle = null; b?.(); },

    give() {
      const s = game.missionState, n = nextMission(s);
      if (!game.champion || !n) return;
      s.active = n.id; s.last = n.id;
      nearToast = null; m.hint = m.report = m.result = null;
      toast(`Champion Solenne: ${INTRO[n.kind]}`);
      save(true);
      game.missionUi?.refresh();
    },

    swap() {
      const s = game.missionState, n = nextMission(s, s.active);
      if (!n) { toast('This is the only mission left!'); return; }
      s.last = s.active; s.active = n.id;
      nearToast = null; m.hint = m.report = m.result = null;
      save(true);
      game.missionUi?.refresh();
    },

    reward(r) {
      game.blockCounts[r.block] = (game.blockCounts[r.block] || 0) + r.n;
      game.cubes += r.cubes;
    },

    complete(def, reward = REWARDS[def.kind]) {
      const s = game.missionState;
      if (!s.done.includes(def.id)) s.done.push(def.id);
      if (s.active === def.id) s.active = null;
      s.last = def.id;
      m.hint = m.report = m.result = null;
      m.reward(reward);
      sound.play('badge');
      const name = BLOCKS[reward.block].name;
      toast(`Mission done: ${def.name}! +${reward.n} ${name}${reward.n === 1 ? '' : 's'}, +${reward.cubes} Capture Cubes`);
      if (s.done.length >= MISSIONS.length) {
        toast('You finished every Champion mission! You are a true Champion!');
        game.ui.celebrate();
      } else toast('Go back to Champion Solenne for your next mission!');
      game.ui.renderHud();
      save(true);
      game.missionUi?.refresh();
    },

    // Every frame; real work every 0.25 s (builds: every 1 s).
    update(dt) {
      if (!game.started || game.inBattle || !game.champion) { game.missionUi?.setChip(); return; }
      tick += dt;
      if (tick < 0.25) return;
      tick = 0;
      const def = m.active;
      if (def?.kind === 'map') {
        const spot = treasureSpots(game.world)[def.n];
        if (spot) {
          m.hint = findCheck(game.player, spot);
          if (m.hint.dist <= 2 && nearToast !== def.id) { nearToast = def.id; toast('You are on the X! Dig 2 blocks down.'); }
          // standing in the hole: the column above the feet must be open to the sky (not a cave under the X)
          const px = Math.floor(game.player.pos.x), pz = Math.floor(game.player.pos.z);
          if (m.hint.found && !game.world.isSolid(px, spot.g, pz)) {
            try { game.fx.status('heal', { pos: new THREE.Vector3(spot.x + 0.5, spot.g, spot.z + 0.5), top: spot.g + 1.5, r: 0.6 }); } catch { /* effects are optional */ }
            sound.play('keyfound');
            toast('You found the treasure!');
            m.complete(def);
          }
        }
      } else if (def?.kind === 'build') {
        buildTick += 0.25;
        if (buildTick >= 1) { buildTick = 0; m.check(def); }
      } else m.hint = null;
      game.missionUi?.setChip();
    },

    // Scans the build next to the player now (also the "Check my build" button).
    check(def = m.active) {
      if (def?.kind !== 'build') return null;
      const b = BUILDS[def.build];
      m.report = scanBuild(game.world, game.player.pos);
      m.result = checkAll(b.features, m.report);
      if (m.result.finished) {
        toast(`Wow, what a ${b.name}!`);
        m.complete(def);
      } else game.missionUi?.refresh();
      return m.result;
    },

    // Called by main.js after a co-op boss battle (builder B's duel code). result: 'won' | 'lost' | 'gaveup' | 'ended'.
    coopEnded(result, duel) {
      const coop = duel?.coop;
      if (!coop) return;
      if (result === 'lost') { toast('The giant was too strong this time. Heal up and try again!'); return; }
      if (result !== 'won') return;
      const def = m.active;
      if (coop.helper) {
        m.reward(REWARDS.helper);
        sound.play('badge');
        toast('You helped beat the giant! +1 Giant Trophy, +5 Capture Cubes');
        if (def?.kind === 'boss') m.complete(def);
        else { game.ui.renderHud(); save(true); }
      } else {
        const mine = missionById(coop.mission);
        if (mine && game.missionState.active === mine.id) m.complete(mine);
        else { m.reward(REWARDS.helper); toast('You beat the giant! +1 Giant Trophy, +5 Capture Cubes'); game.ui.renderHud(); save(true); }
      }
    },
  };
  return m;
}
