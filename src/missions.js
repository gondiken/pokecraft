// Champion missions (T29): data, save format and the controller (game.missions). Champion Solenne gives one mission at a time.
// The panel and the HUD chip are in missionui.js; the map spots and clues in treasuremap.js; build checks in buildcheck.js.
import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';
import { sound } from './sound.js';
import { spotOf, findCheck } from './treasuremap.js';
import { scanBuild, buildOf } from './buildcheck.js';
import { checkAll } from './features.js';
import { SPECIES } from './species.js'; // T38c
import { FIRST_GEN, ROUND_LEN, aType, makeMission, cleanSpec, isGenId, genNumber, spotIndex } from './missiongen.js'; // T38c

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
  catch: { cubes: 8, block: B.STAR_BLOCK, n: 2 }, // T38c
  rematch: { cubes: 5, block: B.RAINBOW_BRICK, n: 2 }, // T38c
};
// T38c: a generated giant pays more as it grows (10 cubes + 2 per round, at most 20).
export const rewardOf = def => (def.kind === 'boss' && def.grow > 0 ? { ...REWARDS.boss, cubes: Math.min(20, 10 + 2 * def.grow) } : REWARDS[def.kind]);
export const INTRO = {
  map: 'Here is a piece of an old treasure map! Find the X and dig.',
  build: 'Can you build this for me?',
  boss: 'A giant creature appeared! Beat it together with a friend.',
  catch: 'Can you catch a special creature for me?', // T38c
  rematch: 'Go and beat a gym leader again!', // T38c
};

export const missionById = id => MISSIONS.find(m => m.id === id) || null;

// Save field `missions` -> { active, done, last, next, gen, seed, spec } (T38c added the last four).
//  active: a MISSIONS id or `gen:<n>` | null    done: hand-written ids only (12 at most)    last: id of the last one given | null
//  next: the number the maker gives next (13 or more)    gen: generated missions done    seed: the maker's seed (own main-world seed)
//  spec: the active generated mission as made (kept so an update never changes a mission in the middle of it). Junk is dropped.
export function loadMissions(saved) {
  const done = [];
  if (saved && Array.isArray(saved.done)) for (const id of saved.done) if (typeof id === 'string' && missionById(id) && !done.includes(id)) done.push(id);
  const int = (v, min, dflt) => (Number.isInteger(v) && v >= min ? v : dflt);
  const next = int(saved?.next, FIRST_GEN, FIRST_GEN), gen = int(saved?.gen, 0, 0);
  const seed = Number.isInteger(saved?.seed) ? saved.seed : null;
  const known = id => (typeof id === 'string' && missionById(id) ? id : null);
  let active = known(saved?.active), spec = null;
  if (active && done.includes(active)) active = null;
  if (!active && isGenId(saved?.active) && genNumber(saved.active) === next) {
    spec = cleanSpec(saved.spec, next) || (seed != null ? makeMission(next, seed) : null);
    if (spec) active = spec.id;
  }
  const lastGen = isGenId(saved?.last) && genNumber(saved.last) <= next ? saved.last : null;
  return { active, done, last: known(saved?.last) || lastGen, next, gen, seed, spec };
}

// The def of a mission id in this state: a hand-written one, or the saved / made generated one. null when unknown.
export function missionOf(state, id) {
  if (!state || typeof id !== 'string') return null;
  if (isGenId(id)) {
    if (state.active === id && state.spec?.id === id) return state.spec;
    return state.seed != null ? makeMission(genNumber(id), state.seed) : null;
  }
  return missionById(id);
}

// Hand-written giants not done yet, in order after `last` (wrapping round), without `skip`.
export function leftoverGiants(state, skip = null) {
  const from = MISSIONS.findIndex(m => m.id === state.last);
  const out = [];
  for (let i = 1; i <= MISSIONS.length; i++) {
    const m = MISSIONS[(from + i + MISSIONS.length) % MISSIONS.length];
    if (m.kind === 'boss' && !state.done.includes(m.id) && m.id !== skip) out.push(m);
  }
  return out;
}

// The next mission to offer, never `skip`. While a hand-written mission that is not a giant is left: the first not-done one after
// `last` (wrapping round). After that: the maker's next mission, then the hand-written giants still left (so a child without a friend
// is never stuck at the giants). `seed` is only for a state that has none yet (the game passes its own).
export function nextMission(state, skip = null, seed = null) {
  const from = MISSIONS.findIndex(m => m.id === state.last);
  const nonBossLeft = MISSIONS.some(m => m.kind !== 'boss' && !state.done.includes(m.id));
  if (nonBossLeft) {
    for (let i = 1; i <= MISSIONS.length; i++) {
      const m = MISSIONS[(from + i + MISSIONS.length) % MISSIONS.length];
      if (!state.done.includes(m.id) && m.id !== skip) return m;
    }
  }
  const n = Number.isInteger(state.next) && state.next >= FIRST_GEN ? state.next : FIRST_GEN;
  const id = [`gen:${n}`, ...leftoverGiants(state, skip).map(m => m.id)].find(x => x !== skip);
  if (id !== `gen:${n}`) return missionById(id);
  return state.active === id && state.spec ? state.spec : makeMission(n, state.seed ?? seed ?? 0);
}

export function createMissions(game, { save }) {
  const toast = t => game.ui.toast(t);
  let deskBattle = null;
  let tick = 0, buildTick = 0, nearToast = null;

  const m = {
    hint: null, // map: { dist, word, period, found }
    report: null, result: null, // build
    get state() { return game.missionState; },
    get active() { return missionOf(game.missionState, game.missionState?.active); }, // T38c: also gen:<n>
    get doneCount() { return (game.missionState?.done.length || 0) + (game.missionState?.gen || 0); }, // T38c: hand-written + generated
    get number() { return m.doneCount + 1; }, // T38c: "Mission N"
    // T38c: the mission the desk offers next (never null: after the 12 the maker always has one)
    next(skip = null) { return nextMission(game.missionState, skip, m.seed()); },
    canSwap() { const s = game.missionState; return isGenId(s?.active) || !!m.next(s?.active); },
    // T38c: the maker's seed: your own main-world seed, stored in the save the first time a generated mission is made
    seed() { return game.missionState?.seed ?? game.missionSeed?.() ?? game.world.seed; },
    // T38c: put `n` (a def from nextMission) in as the active mission; a generated one is made from the stored seed.
    activate(n) {
      const s = game.missionState;
      if (isGenId(n.id)) { s.seed ??= m.seed(); n = makeMission(n.n, s.seed); s.spec = n; } else s.spec = null;
      s.active = n.id;
      nearToast = null; m.hint = m.report = m.result = null;
      return n;
    },

    // Opened by Champion Solenne: the panel, with her battle behind a button.
    desk(battle) { deskBattle = battle; game.openMissions('desk'); },
    battle() { const b = deskBattle; deskBattle = null; b?.(); },

    give() {
      const s = game.missionState, n0 = m.next();
      if (!game.champion || !n0) return;
      const n = m.activate(n0);
      s.last = n.id;
      toast(`Champion Solenne: ${INTRO[n.kind]}`);
      save(true);
      game.missionUi?.refresh();
    },

    // "Do a different one". From a generated mission its number is gone (next moves on); a hand-written giant that is left comes first.
    swap() {
      const s = game.missionState, cur = s.active;
      if (isGenId(cur)) s.next = genNumber(cur) + 1;
      const n0 = (isGenId(cur) && leftoverGiants(s, cur)[0]) || m.next(cur);
      if (!n0) { toast('This is the only mission left!'); return; }
      if (isGenId(cur)) s.spec = null;
      s.last = cur;
      m.activate(n0);
      save(true);
      game.missionUi?.refresh();
    },

    reward(r) {
      game.blockCounts[r.block] = (game.blockCounts[r.block] || 0) + r.n;
      game.cubes += r.cubes;
    },

    complete(def, reward = rewardOf(def)) {
      const s = game.missionState, gen = isGenId(def.id);
      if (gen) { s.gen++; s.next = Math.max(s.next, def.n + 1); s.spec = null; } // T38c: generated ones are a counter
      else if (!s.done.includes(def.id)) s.done.push(def.id);
      if (s.active === def.id) s.active = null;
      s.last = def.id;
      m.hint = m.report = m.result = null;
      m.reward(reward);
      sound.play('badge');
      const name = BLOCKS[reward.block].name;
      toast(`Mission done: ${def.name}! +${reward.n} ${name}${reward.n === 1 ? '' : 's'}, +${reward.cubes} Capture Cubes`);
      if (!gen && s.done.length === MISSIONS.length) { // T38c: the 12th hand-written one, once
        toast("You finished all of Champion Solenne's missions! She has more for you!");
        game.ui.celebrate();
      } else if (gen && s.gen % ROUND_LEN === 0) { // T38c: the end of a round
        toast(`Round ${s.gen / ROUND_LEN} done! The giants are getting bigger...`);
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
      if ((def?.kind === 'map' || def?.kind === 'build') && game.world.realm) m.hint = null; // T31: the treasure is in the main world; T38c: so are builds
      else if (def?.kind === 'map') {
        const spot = spotOf(game.world, spotIndex(def)); // T38c: also the spots after the old five
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
      if (game.world.realm) { toast('Build it back home in our world!'); return null; } // T38c: realm edits can be thrown away
      const b = buildOf(def);
      m.report = scanBuild(game.world, game.player.pos);
      m.result = checkAll(b.features, m.report);
      if (m.result.finished) {
        toast(`Wow, what a ${b.name}!`);
        m.complete(def);
      } else game.missionUi?.refresh();
      return m.result;
    },

    // T38c: a creature was just caught (battle.js). Only a catch made while the mission is active counts.
    caught(c) {
      const def = m.active;
      if (def?.kind === 'catch' && game.champion && SPECIES[c?.species]?.type === def.type) {
        toast(`You caught ${aType(def.type)} creature!`);
        m.complete(def);
      }
    },

    // T38c: a gym rematch was won (rematch.js).
    rematchWon(gymId) {
      const def = m.active;
      if (def?.kind === 'rematch' && game.champion && def.gym === gymId) m.complete(def);
    },

    // Called by main.js after a co-op boss battle (builder B's duel code). result: 'won' | 'lost' | 'gaveup' | 'ended'.
    coopEnded(result, duel) {
      const coop = duel?.coop;
      if (!coop) return;
      if (result === 'lost') { toast('The giant was too strong this time. Heal up and try again!'); return; }
      if (result !== 'won') return;
      const def = m.active;
      if (coop.helper) {
        // A helper with a boss mission of their own finishes it (its full reward); anyone else gets the helper reward. Never both.
        if (def?.kind === 'boss') m.complete(def);
        else {
          m.reward(REWARDS.helper);
          sound.play('badge');
          toast('You helped beat the giant! +1 Giant Trophy, +5 Capture Cubes');
          game.ui.renderHud(); save(true);
        }
      } else {
        const mine = missionOf(game.missionState, coop.mission); // T38c
        if (mine && game.missionState.active === mine.id) m.complete(mine);
        else { m.reward(REWARDS.helper); toast('You beat the giant! +1 Giant Trophy, +5 Capture Cubes'); game.ui.renderHud(); save(true); }
      }
    },
  };
  return m;
}
