// The Cozy Gym (T23): a gym with no building. Its people move into the world owner's cozy home (see plans/T23.md section 3).
// `homeGymState` is the pure state (used by access.js); `HomeLive` is the live part (LIVE.home).
import { HOME_TYPES } from './hometypes.js';
import { SPECIES } from './species.js';
import { isSolid } from './blocks.js';
import { sound } from './sound.js';

// The home type a gym moves into: the HomeType whose gymMovesIn names it (Cozy: 'cozy'). No gym ids in code.
export const homeTypeFor = gymId => Object.values(HOME_TYPES).find(t => t.gymMovesIn === gymId) || null;
// How many different creatures of a type are in the Creature Book (letting one go does not undo it).
export const caughtOfType = (game, type) => [...game.book.caught].filter(id => SPECIES[id]?.type === type && !SPECIES[id].legendary).length;

// Where the gym stands right now: your home, its type and whether the gym has moved in. Pure: reads the game only.
export function homeGymState(game, g) {
  const type = homeTypeFor(g.def.id), home = game.homes?.worldOwnerHome?.() || null;
  const owner = game.homes?.worldOwner == null || game.homes.worldOwner === game.playerId; // visiting a friend's world = not the owner
  const ofType = !!home && home.type === type?.id;
  return {
    type, home, owner, ofType,
    ready: ofType && home.finished,                 // cozy right now
    movedIn: !!home?.gyms?.includes(g.def.id),      // sticky on the record until the Doormat is gone
    caught: owner ? caughtOfType(game, type?.creature) : 0, need: g.def.moveIn?.caught ?? 3,
  };
}

// The live part of the Cozy Gym (LIVE.home, one per home gym). Moves the gym in when the world owner's home is cozy and
// they caught enough cozy creatures, stands the three people on free cells of the home, follows the Doormat, sends
// them away when the record is gone. Only the world owner's browser decides to move in; everybody places the people
// from the record. Tests read `phase` ('' | 'knock') and `spots` (the cells the people stand on).
const STEP = 0.25;      // seconds between updates
const KNOCK = 2.5;      // seconds the people stand at the door
const NEAR = 32;        // toasts and the knock only when the player is this close

export class HomeLive {
  constructor(game, gym) {
    this.game = game; this.gym = gym;
    this.phase = '';
    this.spots = [];        // [{ x, y, z }] one per person: leader, trainer 1, trainer 2
    this.t = 0; this.knockT = 0;
    this.key = '';          // what the placing was made for
    this.wasReady = null;
    this.chilly = false;
    this.shake = 0;
  }

  get id() { return this.gym.def.id; }
  people() {
    const list = (this.game.npcs?.list || []).filter(n => n.gym === this.gym);
    return [list.find(n => n.kind === 'leader'), ...list.filter(n => n.kind === 'trainer').sort((a, b) => a.index - b.index)].filter(Boolean);
  }
  near(home) {
    const p = this.game.player?.pos;
    return !!p && Math.hypot(p.x - home.x, p.z - home.z) <= NEAR;
  }
  say(text) { this.game.ui?.toast(text); }

  update(dt) {
    this.shake += dt;
    if (this.phase === 'knock') this.knockT += dt;
    this.t += dt;
    if (this.t < STEP) { this.shiver(); return; }
    this.t = 0;
    const game = this.game, s = homeGymState(game, this.gym), people = this.people();
    if (people.length < 3) return;
    const names = people.map(n => n.name);
    const movedInText = `${names[0]}, ${names[1]} and ${names[2]} moved into your cozy home! Talk to them to battle.`;

    // 1. Moving in: only the world owner's browser decides.
    if (s.owner && s.home && !s.movedIn && s.ready && s.caught >= s.need) {
      game.homes.setGyms(s.home, [...s.home.gyms, this.id]);
      if (this.near(s.home)) {
        this.phase = 'knock'; this.knockT = 0;
        this.knockAt(people, s.home);
        this.say(`Knock knock! ${names[0]} is at your door!`);
        sound.play('knock');
      } else this.say(movedInText);
      this.key = 'knock';
      return;
    }
    if (this.phase === 'knock') {
      if (s.movedIn && this.knockT < KNOCK) return;
      this.phase = '';
      this.key = '';
      if (s.movedIn) this.say(movedInText);
    }

    // 3. Not moved in (no home, record gone, or not yet): everybody is away.
    if (!s.movedIn) {
      for (const n of people) if (!n.away) game.npcs.sendAway(n);
      this.spots = []; this.key = ''; this.wasReady = null; this.chilly = false;
      return;
    }

    // 2. Placing the people on free inside cells of the home (again when the home moved or furniture is in the way).
    const r = s.home.report;
    const key = [s.home.x, s.home.y, s.home.z, r?.f, r?.inside?.length ?? 0].join(',');
    if (key !== this.key || people.some(n => n.away) || this.blocked(people)) {
      this.key = key;
      this.place(people, s.home);
    }

    // 5. Cozy again.
    if (this.wasReady === false && s.ready && this.near(s.home)) this.say(`${names[0]}: Ahh, cozy again. Thank you!`);
    this.wasReady = s.ready;
    this.chilly = !s.ready;
    this.shiver();
  }

  // Anybody standing in a block (furniture was put on them) or on nothing.
  blocked(people) {
    const w = this.game.world;
    return people.some(n => {
      const x = Math.floor(n.pos.x), y = Math.floor(n.pos.y), z = Math.floor(n.pos.z);
      return isSolid(w.get(x, y, z)) || isSolid(w.get(x, y + 1, z)) || !isSolid(w.get(x, y - 1, z));
    });
  }

  // The knock: all three at the door cells, facing the player.
  knockAt(people, home) {
    const r = home.report, f = r?.f ?? home.y;
    const doors = r?.door?.length ? r.door : [[home.x, home.z]];
    const p = this.game.player?.pos;
    this.spots = people.map((n, i) => ({ x: doors[i % doors.length][0], y: f + 1, z: doors[i % doors.length][1], off: Math.floor(i / doors.length) * 0.4 }));
    people.forEach((n, i) => {
      const c = this.spots[i];
      const heading = p ? Math.atan2(p.x - c.x - 0.5, p.z - c.z - 0.5) : n.homeHeading;
      this.game.npcs.placeAt(n, [c.x + 0.5 + c.off, c.y, c.z + 0.5], heading);
    });
  }

  // Leader on the spot furthest from the door, trainers next; fewer spots than people: the last one, 0.4 further on.
  place(people, home) {
    const spots = home.standSpots(people.length);
    if (!spots.length) { for (const n of people) this.game.npcs.sendAway(n); this.spots = []; return; }
    const d = home.report?.door?.[0] ?? [home.x, home.z];
    this.spots = people.map((n, i) => spots[Math.min(i, spots.length - 1)]);
    people.forEach((n, i) => {
      const c = this.spots[i], extra = i >= spots.length ? 0.4 * (i - spots.length + 1) : 0;
      this.game.npcs.placeAt(n, [c.x + 0.5 + extra, c.y, c.z + 0.5], Math.atan2(d[0] - c.x, d[1] - c.z));
    });
  }

  // 4. Chilly look: the arms shiver while the home is not cozy.
  shiver() {
    for (const n of this.people()) {
      if (n.away) continue;
      const arms = n.model.userData.parts?.arms;
      if (!arms) continue;
      const z = this.chilly ? Math.sin(this.shake * 12 * Math.PI * 2) * 0.05 : 0;
      for (const a of arms) a.g.rotation.z = a.g.position.x < 0 ? -z : z;
    }
  }

  dispose() {
    for (const n of this.people()) this.game.npcs.sendAway(n);
  }
}
