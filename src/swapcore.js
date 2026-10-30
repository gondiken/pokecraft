// Wave 17 gifts and trading: the rules that change a save (plans/wave17-gifts-trading.md). Only three moments change a
// save: the giver's commit (items into escrow), the receiver's commit (items in, the answer remembered) and the giver's
// settle (escrow out). Each is followed by an immediate save, so a browser that closes halfway never loses or doubles.
// No messages and no DOM here: game-like objects ({ party, box, book? }) only.
import { SPECIES, MOVES, MAX_LEVEL, xpForLevel, statsFor, autoMoves } from './species.js';
import { cleanTraits } from './traits.js';

export const SWAP = {
  version: 2,      // in every `swap` message; another version gets 'no' with old: true (2: owner 2026-10-30, the trade screen both open at once)
  answer: 30,      // seconds to answer an offer
  pick: 90,        // seconds to pick a creature for a trade / to say the last yes
  retry: 3,        // seconds between re-sends of a committed `give` while the friend is there
  seenMax: 200,    // answers remembered by the receiver (newest kept)
  items: 1,        // items on each side of one swap (one creature for one creature)
  partyMax: 6,
};

export const isId = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(s);

// The kinds of things that can move between two saves. Each kind: clean(item) -> item | null (from a message or a save),
// key(item) (the same thing on both sides), find(game, item) -> spot | null, take(game, item) -> spot | null,
// put(game, item, spot?) -> spot, same(a, b), label(item), pic(item) -> species id or null.
// Later: a 'cubes' kind ({ kind: 'cubes', n }: game.cubes) or a 'block' kind ({ kind: 'block', id, n }: game.blockCounts)
// is one more addParcel; the ledger, the messages and the commit rules below never look at a kind.
export const PARCELS = {};
export const addParcel = (kind, def) => { PARCELS[kind] = { kind, ...def }; };

// A creature from a message or a save: everything kept, nothing made up (uid, traits and learned stay as they are).
export function cleanCreature(c) {
  if (!c || typeof c !== 'object') return null;
  const sp = SPECIES[c.species];
  if (!sp || sp.legendary || !isId(c.uid)) return null;
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(c.level)) || 1));
  const lo = xpForLevel(level), hi = level < MAX_LEVEL ? xpForLevel(level + 1) - 1 : Infinity;
  const xp = Math.max(lo, Math.min(hi, Math.floor(Number(c.xp)) || 0));
  const known = list => [...new Set((Array.isArray(list) ? list : []).filter(m => typeof m === 'string' && MOVES[m]))];
  let moves = known(c.moves).slice(0, 4);
  if (!moves.length) moves = autoMoves(c.species, level);
  const out = { uid: c.uid, species: c.species, level, xp, hp: 0, moves };
  if (Array.isArray(c.learned)) out.learned = c.learned.filter(m => typeof m === 'string' && MOVES[m]); // as it was (old creatures have none: kept so)
  out.traits = cleanTraits(c.traits, c.species);
  const max = statsFor(out).maxHp, hp = Math.floor(Number(c.hp));
  out.hp = Number.isFinite(hp) ? Math.max(0, Math.min(max, hp)) : max;
  return out;
}

const creatureSpot = (game, uid) => {
  for (const where of ['party', 'box']) {
    const i = (game[where] || []).findIndex(c => c?.uid === uid);
    if (i >= 0) return { where, i };
  }
  return null;
};

addParcel('creature', {
  clean(item) { const c = cleanCreature(item?.c); return c && { kind: 'creature', c }; },
  key: item => item.c.uid,
  find: (game, item) => creatureSpot(game, item.c.uid),
  take(game, item) {
    const at = creatureSpot(game, item.c.uid);
    if (at) game[at.where].splice(at.i, 1);
    return at;
  },
  // A traded creature takes the place of the one it replaced; otherwise the team, or the Box when the team is full.
  put(game, item, at) {
    const c = JSON.parse(JSON.stringify(item.c));
    let where = at?.where === 'box' ? 'box' : at?.where === 'party' || game.party.length < SWAP.partyMax ? 'party' : 'box';
    if (where === 'party' && game.party.length >= SWAP.partyMax) where = 'box';
    const list = game[where];
    const i = at?.where === where ? Math.max(0, Math.min(list.length, at.i | 0)) : list.length;
    list.splice(i, 0, c);
    game.book?.markCaught?.(c.species);
    return { where, i };
  },
  // Is the one in my save still the one I promised? (hp may differ: a heal is not a change)
  same(a, b) { const s = x => JSON.stringify({ ...cleanCreature(x.c), hp: 0 }); return s(a) === s(b); },
  label: item => `${SPECIES[item.c.species].name} (Lv ${item.c.level})`,
  name: item => SPECIES[item.c.species].name,
  pic: item => item.c.species,
});

// The item for one thing of mine (what the UI picked): a deep copy, so later changes to mine are not in it.
export const creatureItem = c => PARCELS.creature.clean({ kind: 'creature', c });

// A list of items from a message or a save: all clean, or null.
export function cleanItems(list, { min = 1 } = {}) {
  if (!Array.isArray(list) || list.length < min || list.length > SWAP.items) return null;
  const out = list.map(i => PARCELS[i?.kind]?.clean(i) || null);
  return out.every(Boolean) ? out : null;
}

const keyOf = item => `${item.kind}:${PARCELS[item.kind].key(item)}`;
export const sameKeys = (a, b) => a.length === b.length && a.every((x, i) => keyOf(x) === keyOf(b[i]));
const cleanSpot = s => (s && (s.where === 'party' || s.where === 'box') ? { where: s.where, i: Math.max(0, s.i | 0) } : null);

// A trade moves `give` (the asker's items) one way and `get` (the friend's) the other; either list may be empty, never both:
// an empty side makes it a present. The ledger (save field `swaps`): out = my committed swaps waiting for an answer, seen = answers I gave as a receiver.
export const newLedger = () => ({ out: {}, seen: [] });

export function loadSwaps(saved) {
  const led = newLedger();
  for (const [sid, e] of Object.entries(saved?.out && typeof saved.out === 'object' ? saved.out : {})) {
    if (!isId(sid) || !e || !isId(e.to)) continue;
    const give = cleanItems(e.give || [], { min: 0 }), get = cleanItems(e.get || [], { min: 0 });
    if (!give || !get || !(give.length + get.length)) continue;
    led.out[sid] = { to: e.to, name: typeof e.name === 'string' ? e.name.slice(0, 16) : '', kind: e.kind === 'trade' ? 'trade' : 'gift',
      give, get, from: (Array.isArray(e.from) ? e.from : []).map(cleanSpot), at: Number(e.at) || 0 };
  }
  for (const s of Array.isArray(saved?.seen) ? saved.seen : []) {
    if (Array.isArray(s) && isId(s[0]) && (s[1] === 'got' || s[1] === 'no')) led.seen.push([s[0], s[1], Number(s[2]) || 0]);
  }
  led.seen = led.seen.slice(-SWAP.seenMax);
  return led;
}

export const seenOf = (led, sid) => led.seen.find(s => s[0] === sid)?.[1] ?? null;
function remember(led, sid, answer, now) {
  led.seen.push([sid, answer, now]);
  if (led.seen.length > SWAP.seenMax) led.seen.splice(0, led.seen.length - SWAP.seenMax);
}

// Can these items of mine leave? (my last team creature stays: a gift or an offer never empties the team)
export function canGive(game, give) {
  for (const item of give) {
    const P = PARCELS[item.kind], at = P?.find(game, item);
    if (!at) return 'gone';
    if (item.kind === 'creature' && at.where === 'party' && game.party.length <= 1) return 'last';
  }
  return null;
}

// 1. The giver's commit: the items leave the team / Box into escrow. -> true, or false (nothing changed).
export function commitOut(game, led, { sid, to, name, kind, give, get = [] }, now = Date.now()) {
  if (led.out[sid] || !(give.length + get.length) || canGive(game, give)) return false; // a trade; one side may be empty (= a present)
  const from = give.map(item => PARCELS[item.kind].take(game, item));
  led.out[sid] = { to, name: name || '', kind: kind === 'trade' ? 'trade' : 'gift', give, get, from, at: now };
  return true;
}

// 2. The receiver's commit, for a `give` message: deal = what I said yes to in this page ({ give, get } or null).
// -> { answer: 'got' | 'no', fresh } (fresh: this call changed my save).
export function receive(game, led, { sid, give, get }, deal, now = Date.now()) {
  const old = seenOf(led, sid);
  if (old) return { answer: old, fresh: false };
  const no = () => { remember(led, sid, 'no', now); return { answer: 'no', fresh: true }; };
  if (!deal || !give || !get || !(give.length + get.length) || !sameKeys(give, deal.give) || !sameKeys(get, deal.get)) return no();
  if (!give.length && canGive(game, get) === 'last') return no(); // a present from me never empties my team
  // what I give back must still be here, unchanged
  for (const item of get) {
    const P = PARCELS[item.kind], at = P.find(game, item);
    if (!at || !P.same({ kind: item.kind, c: game[at.where]?.[at.i] }, item)) return no();
  }
  const spots = get.map(item => PARCELS[item.kind].take(game, item));
  give.forEach((item, i) => PARCELS[item.kind].put(game, item, spots[i]));
  remember(led, sid, 'got', now);
  return { answer: 'got', fresh: true };
}

// 3. The giver's settle on the receiver's answer: 'got' = what I get comes in; 'no' = what I gave comes back.
// -> 'done' | 'back' | null (no such swap: already settled).
export function settle(game, led, sid, answer) {
  const e = led.out[sid];
  if (!e || (answer !== 'got' && answer !== 'no')) return null;
  delete led.out[sid];
  const items = answer === 'got' ? e.get : e.give;
  items.forEach((item, i) => PARCELS[item.kind].put(game, item, e.from[i]));
  return answer === 'got' ? 'done' : 'back';
}
