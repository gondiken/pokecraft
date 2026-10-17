// Gym rematches (T28): after you have a gym's badge, its leader offers a rematch that gets harder
// with every win (per player, saved as a win count per gym id). The first badge battle is not touched.
import { GYMS, trainersOf, REMATCH_CAP } from './gyms.js';
import { SPECIES } from './species.js';
import { sound } from './sound.js';

export const REMATCH = { step: 3, cap: REMATCH_CAP, maxTeam: 6, xpBoost: 1.5, maxWins: 999, askTime: 20, askRange: 8 };
export const WIN_IDS = new Set(GYMS.map(g => g.id));

// Saved wins -> { [gym id]: whole number > 0 }; unknown ids and bad numbers are dropped (old saves have none).
export function loadWins(saved) {
  const out = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
  for (const [id, n] of Object.entries(saved)) {
    if (WIN_IDS.has(id) && Number.isInteger(n) && n > 0) out[id] = Math.min(REMATCH.maxWins, n);
  }
  return out;
}

// The form a creature has grown into by this level (follows `evolve`, at most 3 steps).
export function grownUp(species, level) {
  let s = species;
  for (let i = 0; i < 3; i++) {
    const ev = SPECIES[s]?.evolve;
    if (!ev || level < ev.level || !SPECIES[ev.into]) break;
    s = ev.into;
  }
  return s;
}

// T25 hook: later moves for a stronger rematch team. Today the creature keeps what its level gives it.
export function rematchMoves(def, tier, species, level, baseMoves) { return baseMoves; }

// The leader's team for a rematch after `wins` wins: [[species, level, moves?], ...]. Pure.
export function rematchTeam(def, wins = 0, rules = {}) {
  const R = { ...REMATCH, ...rules };
  const tier = wins + 1;
  const make = (species, level, moves) => {
    const sp = grownUp(species, level);
    const m = rematchMoves(def, tier, sp, level, moves);
    return m === undefined ? [sp, level] : [sp, level, m];
  };
  const base = def.leaderTeam.map(([s, L, moves]) => make(s, Math.min(R.cap, L + R.step * tier), moves));
  const extra = Math.min(R.maxTeam - base.length, Math.floor(tier / 2));
  if (extra <= 0) return base;
  const used = new Set(def.leaderTeam.map(([s]) => s));
  base.forEach(([s]) => used.add(s));
  const pool = [];
  for (const p of trainersOf(def)) for (const [s] of p.team) pool.push(s);
  for (const id of Object.keys(SPECIES)) if (SPECIES[id].type === def.type && !SPECIES[id].legendary) pool.push(id);
  const level = Math.min(R.cap, Math.min(...def.leaderTeam.map(([, L]) => L)) + R.step * tier - 1);
  const more = [];
  for (const s of pool) {
    if (more.length >= extra) break;
    if (!SPECIES[s] || SPECIES[s].legendary || used.has(s)) continue;
    const sp = grownUp(s, level);
    if (used.has(sp)) continue;
    used.add(s); used.add(sp);
    more.push(make(s, level));
  }
  return [...more, ...base]; // the signature creature stays last
}

export const rematchCubes = n => Math.min(8, 3 + n);

const topLevel = team => Math.max(...team.map(t => t[1]));

export function createRematch(game, { startBattle }) {
  let pending = null; // { npc, at } while the question is on screen
  const winsOf = id => game.rematchWins[id] || 0;
  const toast = m => game.ui.toast(m);
  const dist = npc => Math.hypot(npc.pos.x - game.player.pos.x, npc.pos.z - game.player.pos.z);
  const usable = npc => game.npcs.list.includes(npc) && !npc.away && !game.inBattle
    && !game.access.of(npc.gym).closedText(npc);

  const api = {
    winsOf,
    get pending() { return pending; },
    offer(npc) {
      if (pending?.npc === npc && game.ui.asking) { api.accept(); return; } // talk again = yes
      if (game.duels?.incoming) { toast('Answer the battle question first!'); return; }
      const def = npc.gym.def, wins = winsOf(def.id);
      const top = topLevel(rematchTeam(def, wins));
      const text = wins === 0
        ? `${npc.name}: Want a rematch? My team trained hard. Now they are up to level ${top}!`
        : `${npc.name}: Rematch number ${wins + 1}? You beat me ${wins} ${wins === 1 ? 'time' : 'times'}! My team is up to level ${top} now.`;
      pending = { npc, at: performance.now() };
      game.ui.ask({
        text, yes: 'Battle!', no: 'Not now',
        onYes: () => api.accept(npc),
        onNo: () => { pending = null; toast(`${npc.name}: OK! Come back any time.`); },
      });
    },
    accept(npc = pending?.npc) {
      pending = null;
      game.ui.closeAsk();
      if (!npc || !usable(npc) || dist(npc) > REMATCH.askRange) return;
      const def = npc.gym.def, wins = winsOf(def.id);
      const team = rematchTeam(def, wins);
      const intro = def.rematchIntro || (wins === 0 ? ['Back for a rematch? I have been training too!']
        : [`Rematch number ${wins + 1}! My team got even stronger.`]);
      startBattle({ trainer: npc, team, intro, xpBoost: REMATCH.xpBoost, rematch: { gym: def.id, wins } });
    },
    won(npc, opts) {
      const id = npc.gym.def.id;
      const n = Math.min(REMATCH.maxWins, winsOf(id) + 1);
      game.rematchWins[id] = n;
      const c = rematchCubes(n);
      game.cubes += c;
      sound.play('win');
      toast(`${npc.name}: Wow, you beat me again!`);
      const capped = rematchTeam(npc.gym.def, n).every(t => t[1] >= REMATCH.cap);
      toast(`Rematch win ${n}! +${c} Capture Cubes. ${capped ? "My team can't get any stronger. You are the best!" : 'Next time my team will be even stronger!'}`);
    },
    lost(npc) { toast(`${npc?.name || 'Leader'}: Good battle! Train a little and try again.`); },
    update() {
      if (!pending) return;
      const { npc, at } = pending;
      if (!game.ui.asking) { pending = null; return; }
      if (performance.now() - at > REMATCH.askTime * 1000 || dist(npc) > REMATCH.askRange || !usable(npc) || !game.started) api.close();
    },
    close() { pending = null; game.ui.closeAsk(); },
  };
  return api;
}
