// Giant bosses for co-op missions (T29). Two players, one creature each at a time, against one giant.
// plan: what the giant does each round, in order and round again: 'a' = its strongest normal attack, 'b' = the second one,
// or a big move id (T25). A big move it can't use right now (cantUse) becomes 'a'. The giant warns one round before a big move.
// The co-op battle itself lives in battle.js (coopTurn) and rides on the duel messages (duel.js).
import * as THREE from 'three';
import { SPECIES, makeCreature, movesWith, statsFor } from './species.js';
import { REMATCH_CAP } from './gyms.js'; // T38c

export const BOSSES = {
  giant1: { species: 'cragtusk', big: ['stonefort', 'cliffcrash'], giant: 3, plan: ['a', 'b', 'a', 'stonefort', 'a', 'b', 'cliffcrash'] },
  giant2: { species: 'blizzbear', big: ['bigfreeze', 'snowday'], giant: 3, plan: ['a', 'bigfreeze', 'b', 'a', 'snowday', 'a', 'b'] },
  giant3: { species: 'stormwyvern', big: ['bravebellow', 'scalestorm'], giant: 3.5, plan: ['a', 'b', 'bravebellow', 'a', 'b', 'a', 'scalestorm'] },
};
export const BOSS_SCALE = 1.8;   // model size
export const COOP_RANGE = 16;    // blocks between the two players to ask
export const bossName = id => `Giant ${SPECIES[BOSSES[id].species].name}`;

// Both browsers build the same giant from both teams (the order of the teams does not matter).
// T38c: `grow` (0 for the hand-written giants, the round number for the mission maker's) raises the level cap by GROW.level per step
// (55 up to REMATCH_CAP) and the HP factor by GROW.hp per step (at most GROW.hpMax). grow 0 is exactly the old giant.
export const GROW = { level: 2, hp: 0.25, hpMax: 1.5 };
export function makeBoss(id, teamA, teamB, grow = 0) {
  const b = BOSSES[id];
  const top = Math.max(...[...teamA, ...teamB].map(c => c.level | 0), 1);
  const cap = Math.min(REMATCH_CAP, 55 + GROW.level * grow); // T38c
  const level = Math.max(25, Math.min(cap, top + 2 + grow));
  const c = makeCreature(b.species, level, movesWith(b.species, level, ...b.big));
  c.giant = b.giant + Math.min(GROW.hpMax, GROW.hp * grow); // never saved, never sent
  c.hp = statsFor(c).maxHp;
  return c;
}

// Which boss a mission id stands for. Builder A's mission defs carry `boss`; their ids equal the boss ids.
function bossOf(game, missionId) {
  const m = game.missions?.active;
  if (m && m.id === missionId) return m.kind === 'boss' ? m.boss : null;
  return BOSSES[missionId] ? missionId : null;
}

// Checks everything and builds the "help me" ask: { mission, boss, at } or { error } (child words).
export function coopFor(game, missionId, avatar) {
  if (!game.mp?.active) return { error: 'Play together with a friend first! (Pause -> Play together)' };
  const boss = bossOf(game, missionId);
  if (!boss || !BOSSES[boss]) return { error: 'This mission is not a boss battle.' };
  if (!avatar || !game.mp.others.has(avatar.id)) return { error: 'Your friend left the world.' };
  if (avatar.here === false) return { error: 'Your friend is in another place.' }; // T38b
  const me = game.player.pos, you = avatar.pos;
  if (Math.hypot(me.x - you.x, me.z - you.z) > COOP_RANGE) return { error: `Walk closer to ${avatar.name} first.` };
  const d = game.duels;
  if (game.inBattle || d.asking || d.incoming || d.current) return { error: 'Finish the other battle first!' };
  if (!game.party.length) return { error: 'You need a creature to battle!' };
  // The giant stands 7 blocks to the side of the line between the two players (the side I am looking at), so the
  // friend is not in front of it: asking a friend means looking at them.
  const fwd = game.player.forward;
  const lx = you.x - me.x, lz = you.z - me.z, ll = Math.hypot(lx, lz) || 1;
  let px = -lz / ll, pz = lx / ll;
  if (px * fwd.x + pz * fwd.z < 0) { px = -px; pz = -pz; }
  const x = (me.x + you.x) / 2 + px * 7, z = (me.z + you.z) / 2 + pz * 7;
  const y = game.battle.groundBelow(x, z, Math.max(me.y, you.y) + 3);
  const r = n => Math.round(n * 100) / 100;
  const grow = game.missions?.active?.id === missionId ? game.missions.active.grow | 0 : 0; // T38c
  return { mission: missionId, boss, at: [r(x), r(y), r(z)], grow };
}

// A coop field from the network: only known bosses and plain numbers get through.
export function cleanCoop(c) {
  if (!c || typeof c.mission !== 'string' || !BOSSES[c.boss]) return null;
  if (!Array.isArray(c.at) || c.at.length !== 3 || !c.at.every(Number.isFinite)) return null;
  return { mission: c.mission.slice(0, 40), boss: c.boss, at: c.at.slice(), grow: Number.isInteger(c.grow) && c.grow >= 0 && c.grow <= 99 ? c.grow : 0 }; // T38c: grow
}

export const atVector = c => new THREE.Vector3(...c.at);
