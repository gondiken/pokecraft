// T39a "Where to go": the places the guide arrow can follow, as small objects. The picker (navui.js) only changes WHICH place the
// guide follows; the rules of a place stay where they were. A gym's arrow IS that gym's access piece (access.js: Hidden Hill stops
// short, the Dojo leads to its gate, the Cozy Gym says what to build ...), so there is one logic, not a second one.
// Places that keep their own rules (food ingredients, vault keys, treasure spots, the hide-and-seek friend, Camo creatures, Dojo
// guards) are never destinations, so nothing here can give them away.
//
// A Destination: id, group ('gyms' | 'places' | 'now' | 'realm'), icon, label, help ('full' | 'near' | 'none' = a label only),
//   available(game)     null = usable, else the short reason (the row is dim)
//   alive(game)         false = it is gone (a friend left, the mission changed): the choice is dropped quietly
//   target(game)        { aim(p) -> { x?, z?, text(arrow, dist) }, status() } like an access object; aim without `x` = words only
//   reached(game, p)    a toast text when you are there (the choice then goes back to "next gym"), else null
// Add a place: one more source in DESTINATIONS (`addDestination`), like `addHomeType`.
import { MID_X, MID_Z } from './world.js';
import { GYMS } from './gyms.js';
import { pictureWorld, fullName } from './pictureworlds.js'; // T40

const dist2 = (p, x, z) => Math.hypot(x - p.x, z - p.z);

export class Destination {
  constructor({ id, group = 'places', icon = '📍', label, help = 'full', sub = '' }) {
    Object.assign(this, { id, group, icon, label, help, sub });
  }
  available() { return null; }
  alive() { return true; }
  target() { return null; }
  reached() { return null; }
  made() { return `You made it to ${this.label}!`; }
}

// A gym (or the tower): its access object does everything.
export class GymDestination extends Destination {
  constructor(gym, o = {}) {
    super({ id: `gym:${gym.def.id}`, group: 'gyms', icon: '🏅', label: gym.def.name, ...o });
    this.gym = gym;
    this.gate = o.gate || null; // (game) => reason | null
  }
  acc(game) { return game.access.of(this.gym); }
  available(game) { return this.gate ? this.gate(game) : null; }
  alive(game) { return game.world.gyms.includes(this.gym) || this.gym === game.world.tower; }
  target(game) { return this.acc(game); }
  reached(game, p) {
    const a = this.acc(game);
    if (a.contains(p)) return this.made();
    if (a.help === 'near' && a.aim(p).x === undefined) return "It's around here somewhere! Look around."; // Hidden Hill: its own arrow already faded out
    return null;
  }
}

// A spot: where(game) -> [x, z] | null.
export class SpotDestination extends Destination {
  constructor(o) {
    super(o);
    Object.assign(this, { where: o.where, radius: o.radius ?? 5, gate: o.gate || null, hereText: o.hereText || null, madeText: o.madeText || null });
  }
  available(game) { return this.gate ? this.gate(game) : (this.where(game) ? null : 'Not here.'); }
  alive(game) { return !!this.where(game); }
  target(game) {
    const label = this.label;
    return {
      aim: p => {
        const at = this.where(game);
        if (!at) return { text: () => label };
        return { x: at[0], z: at[1], text: (arrow, d) => (d < this.radius ? `${label} is here!` : `${label} ${arrow} ${d}m`) };
      },
      status: () => '',
    };
  }
  reached(game, p) {
    const at = this.where(game);
    return at && dist2(p, at[0], at[1]) < this.radius - 1 ? (this.madeText || this.made()) : null;
  }
}

// The realm's own way (Wake Stone, the Swirl's door home): game.realms.aim.
export class RealmWayDestination extends Destination {
  constructor(o) { super({ group: 'realm', ...o }); this.at = o.at; }
  alive(game) { return !!this.at(game); }
  target(game) {
    const label = this.label;
    return { aim: p => game.realms.aim(p) || { text: () => label }, status: () => '' };
  }
  reached(game, p) { const a = this.at(game); return a && dist2(p, a[0], a[1]) < 3.5 ? this.made() : null; }
}

// Words only (help: 'none'): the treasure map, a build or a catch mission. No arrow, so no spot can be given away.
export class WordsDestination extends Destination {
  constructor(o) { super({ help: 'none', ...o }); this.words = o.words; this.mission = o.mission; }
  alive(game) { return game.missions?.active?.id === this.mission; }
  target(game) { return { aim: () => ({ text: () => this.words(game) }), status: () => '' }; }
}

export class FriendDestination extends Destination {
  constructor(id, a) { super({ id: `friend:${id}`, group: 'now', icon: '👤', label: a.name || 'My friend' }); this.key = id; }
  avatar(game) { const a = game.mp?.others?.get(this.key); return a && a.here !== false && !game.hideSeek?.active ? a : null; }
  alive(game) { return !!this.avatar(game); }
  target(game) {
    const label = this.label;
    return {
      aim: () => {
        const a = this.avatar(game);
        return a ? { x: a.pos.x, z: a.pos.z, text: (arrow, d) => `${label} ${arrow} ${d}m` } : { text: () => label };
      },
      status: () => '',
    };
  }
  reached(game, p) { const a = this.avatar(game); return a && dist2(p, a.pos.x, a.pos.z) < 4 ? `You found ${this.label}!` : null; }
}

/* ----------------------------------- sources ----------------------------------- */

const needBadges = game => (game.champion || game.badges.length >= GYMS.length ? null : 'Win all the badges first!');

// A source makes the rows for the world you are in: { id, rows(game) -> Destination[] }.
export const DESTINATIONS = [
  { // every gym of this world (the Dream's, the main world's)
    id: 'gyms',
    rows: game => game.world.gyms.map(g => new GymDestination(g)),
  },
  {
    id: 'tower',
    rows: game => (game.world.realm || !game.world.tower ? [] : [new GymDestination(game.world.tower, { id: 'tower', group: 'places', icon: '🏰', label: "Champion's Tower", gate: needBadges })]),
  },
  {
    id: 'portal',
    rows: game => {
      const w = game.world.portal;
      if (game.world.realm || !w) return [];
      return [new SpotDestination({
        id: 'portal', icon: '🌀', label: 'Portal Door', where: () => [w.stand[0], w.stand[2]], radius: 5,
        gate: g => (g.champion ? null : 'Become the Champion first!'),
      })];
    },
  },
  {
    id: 'home',
    rows: game => {
      if (game.world.realm) return [];
      return [new SpotDestination({
        id: 'home', icon: '🏠', label: 'My home',
        where: g => { const h = g.homes?.mine(); return h ? [h.x + 0.5, h.z + 0.5] : null; },
        gate: g => (g.homeWorld ? 'Your home is in your own world.' : g.homes?.mine() ? null : 'Build a home first: put a Doormat in the floor.'),
        radius: 4,
      })];
    },
  },
  {
    id: 'healer',
    rows: game => {
      const spot = g => {
        const list = (g.npcs?.list || []).filter(n => n.kind === 'healer' && !n.away);
        const p = g.player.pos;
        list.sort((a, b) => dist2(p, a.pos.x, a.pos.z) - dist2(p, b.pos.x, b.pos.z));
        return list[0] ? [list[0].pos.x, list[0].pos.z] : null;
      };
      return spot(game) ? [new SpotDestination({ id: 'healer', icon: '💗', label: 'Healer', where: spot, radius: 5 })] : [];
    },
  },
  {
    id: 'start',
    rows: game => (game.world.realm ? [] : [new SpotDestination({ id: 'start', icon: '🚩', label: 'Where I started', where: () => [MID_X + 0.5, MID_Z + 0.5], radius: 8 })]),
  },
  { // the Dream's Wake Stone and the Swirl's door home
    id: 'way',
    rows: game => {
      const w = game.world;
      if (w.wake) return [new RealmWayDestination({ id: 'wake', icon: '🪨', label: 'Wake Stone', at: g => g.world.wake && [g.world.wake[0] + 0.5, g.world.wake[2] + 0.5] })];
      if (w.door) return [new RealmWayDestination({ id: 'door', icon: w.realm?.parent ? '🖼️' : '🚪', label: w.realm?.parent ? 'Way back to the Swirl' : 'Door home', at: g => g.world.door && [g.world.door.stand[0], g.world.door.stand[2]] })]; // T40: a Picture World's way back
      return [];
    },
  },
  { // Champion missions: only the parts that are fair to point at
    id: 'mission',
    rows: game => {
      const def = game.champion && !game.world.realm ? game.missions?.active : null;
      if (!def) return [];
      const base = { id: 'mission', group: 'now', label: def.name };
      if (def.kind === 'rematch') {
        const gym = game.world.gyms.find(g => g.def.id === def.gym);
        return gym ? [Object.assign(new GymDestination(gym, { id: 'mission', label: def.name, icon: '🏅' }), { group: 'now' })] : [];
      }
      if (def.kind === 'map') return [new WordsDestination({ ...base, icon: '🗺', mission: def.id, words: g => `Follow your treasure map! ${g.missions.hint?.word || ''}`.trim() })];
      if (def.kind === 'build') return [new WordsDestination({ ...base, icon: '🏗', mission: def.id, words: () => `${def.name}: build it anywhere you like!` })];
      if (def.kind === 'catch') return [new WordsDestination({ ...base, icon: '✨', mission: def.id, words: () => `${def.name}: look around for one!` })];
      return [new WordsDestination({ ...base, icon: '👥', mission: def.id, words: () => `${def.name}: ask a friend to help (M)` })];
    },
  },
  { // friends playing together, in the same place
    id: 'friends',
    rows: game => {
      if (!game.mp?.active || game.hideSeek?.active) return [];
      return [...game.mp.others].filter(([, a]) => a.here !== false).map(([id, a]) => new FriendDestination(id, a));
    },
  },
];

export function addDestination(source) { removeDestination(source.id); DESTINATIONS.push(source); }
export function removeDestination(id) { const i = DESTINATIONS.findIndex(s => s.id === id); if (i >= 0) DESTINATIONS.splice(i, 1); }

export const GROUPS = ['gyms', 'places', 'realm', 'now'];

// The rows for the panel, in group order, for the world you are in: [{ dest, reason }].
export function destinationsFor(game) {
  const out = [];
  for (const s of DESTINATIONS) for (const dest of s.rows(game)) out.push({ dest, reason: dest.available(game) });
  return out.sort((a, b) => GROUPS.indexOf(a.dest.group) - GROUPS.indexOf(b.dest.group));
}

// game.nav: the choice. update(p) -> null (let the arrow choose) | { dest, target }.
export function createNav(game) {
  let choice = null, inWorld = null;
  return {
    get choice() { return choice; },
    rows: () => destinationsFor(game),
    choose(dest) {
      if (dest.available(game)) return false;
      choice = dest; inWorld = game.world;
      return true;
    },
    clear() { choice = null; inWorld = null; },
    update(p) {
      if (!choice) return null;
      if (game.world !== inWorld || !choice.alive(game)) { choice = null; return null; } // another place, or it is gone
      const text = choice.reached(game, p);
      if (text) { game.ui.toast(text); choice = null; return null; }
      const target = choice.target(game);
      if (!target) { choice = null; return null; }
      return { dest: choice, target };
    },
  };
}

// T40: the Picture World places. In the Swirl: every open picture frame. In a Picture World: its Boss (or Bosses: Playland has two).
addDestination({
  id: 'frames',
  rows: game => (game.world.swirl?.frames || []).filter(f => pictureWorld(f.world)?.ready).map(f => {
    const pw = pictureWorld(f.world);
    return new SpotDestination({ id: `frame:${pw.id}`, group: 'realm', icon: pw.emoji, label: fullName(pw), where: () => [f.stand[0] + 0.5, f.stand[2] + 0.5], radius: 4,
      madeText: `The ${fullName(pw)} picture! Step in.` });
  }),
});
addDestination({
  id: 'bosses',
  rows: game => (game.world.realm?.parent ? game.world.bosses || [] : []).map(b => {
    const pw = pictureWorld(b.id), won = game.stars?.includes(b.id);
    return new SpotDestination({ id: `boss:${b.id}`, group: 'realm', icon: won ? '⭐' : '👑', label: `${pw?.name ?? 'The'} Boss`, where: () => [b.pos[0], b.pos[2]], radius: 4,
      madeText: won ? 'The Boss is here! Talk to them for a rematch.' : 'The Boss is here! Talk to them.' });
  }),
});

/* ==== T42 portal ==== */
// The Portal House, in the Swirl itself: a floor swirl on the hub (and, once inside, the Boss in the Study).
addDestination({
  id: 'portalhouse',
  rows: game => {
    const h = game.world.swirl?.house;
    if (!h || !pictureWorld('portal')?.ready) return [];
    const rows = [new SpotDestination({ id: 'portalhouse', group: 'realm', icon: '🌀', label: 'Portal House', where: () => [(h.hub.x[0] + h.hub.x[1] + 1) / 2, (h.hub.z[0] + h.hub.z[1] + 1) / 2], radius: 4,
      madeText: 'The Hub Swirl! Step on it to go to the Portal House.' })];
    if (game.player.pos.x > 90 && game.player.pos.z < 36 && game.player.pos.y > 4) {
      const b = h.boss, won = game.stars?.includes('portal');
      rows.push(new SpotDestination({ id: 'boss:portal', group: 'realm', icon: won ? '⭐' : '👑', label: 'Grandpa Arch', where: () => [b.pos[0], b.pos[2]], radius: 4, madeText: 'Grandpa Arch is here! Talk to him.' }));
    }
    return rows;
  },
});
/* ==== end of T42 portal ==== */
