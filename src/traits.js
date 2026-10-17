// Traits (T26): small facts about ONE creature (not its species), drawn once and saved. A trait does nothing by
// itself: the feature that uses it reads it (riding reads 'rideable'). New trait = one more entry here.
const list = (kind, ids) => Object.fromEntries(ids.split(' ').map(id => [id, kind]));

export const TRAITS = {
  rideable: {
    text: 'Can be ridden',                                  // card badge
    book: 'About 1 in 4 of them can be ridden. Look for the badge!',
    caught: name => `Lucky! This ${name} can be ridden.`,   // toast after a catch
    grown: name => `${name} is big enough to ride now!`,    // after evolving (must not contain "evolved into")
    chance: 0.25,
    // Who may have it, and how it is ridden: 'land' | 'water' | 'sky'.
    species: {
      ...list('land', 'blazehound pyrolynx grovebeast thornox thunderwolf cragtusk woolumph blizzbear hornbeetle visionelk titanox lunaroo howlbone stompasaur slimehound solvixen topiphant dozeram prismfox'),
      ...list('water', 'tidalord torrentide shellby spectrafin'),
      ...list('sky', 'scalewing stormwyvern skywyrm whaloft zeppeluff kitegale auroraptor sageowl boomwing jetfold ufomax duskmare'),
    },
  },
};

export function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

export const traitRoll = (seed, id) => hash32(`${seed}|${id}`) / 2 ** 32;

export const canHave = (id, species) => !!TRAITS[id]?.species[species];

export function drawTraits(c) {
  return Object.keys(TRAITS).filter(id => canHave(id, c.species) && traitRoll(String(c.uid), id) < TRAITS[id].chance);
}

export function cleanTraits(list, species) {
  if (!Array.isArray(list)) return [];
  return Object.keys(TRAITS).filter(id => list.includes(id) && canHave(id, species));
}

// Old creatures: a missing uid is made from the fallback key; traits are kept (cleaned) or drawn. Returns true if changed.
export function ensureTraits(c, fallbackKey) {
  let changed = false;
  if (!c.uid) { c.uid = 'o' + hash32(fallbackKey).toString(36); changed = true; }
  if (Array.isArray(c.traits)) {
    const clean = cleanTraits(c.traits, c.species);
    if (clean.length !== c.traits.length) { c.traits = clean; changed = true; }
  } else {
    c.traits = drawTraits(c);
    changed = true;
  }
  return changed;
}

export function fixTraits(list, where) {
  let n = 0;
  list.forEach((c, i) => { if (ensureTraits(c, `${where}:${i}:${c.species}:${c.level}`)) n++; });
  return n;
}

// Evolution: only ever adds.
export function gainTraits(c) {
  ensureTraits(c, c.uid);
  const added = drawTraits(c).filter(id => !c.traits.includes(id));
  c.traits.push(...added);
  return added;
}

export const hasTrait = (c, id) => !!c?.traits?.includes(id);
