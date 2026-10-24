// T38a: the Picture Worlds that hang as framed pictures in the Swirl. Data only (no imports).
// Append-only: the ids are saved in `stars` (the worlds whose Boss you beat). Waves 14-15 flip `ready` and add a `realm`.
// Until a world is ready, its frame in the Swirl is covered with a cloth. Frame colours: [border gem, trim].
export const PICTURE_WORLDS = [
  { id: 'house', name: 'Giant House', emoji: '🏠', frame: [0xc89a3a, 0x7a4a1a], ready: false },
  { id: 'pirate', name: 'Pirate Seas', emoji: '🏴‍☠️', frame: [0x3a6aa8, 0xe8d8a8], ready: false },
  { id: 'race', name: 'Race Track', emoji: '🏎️', frame: [0xd83a3a, 0xf8f8f8], ready: false },
  { id: 'stadium', name: 'Ball Stadium', emoji: '⚽', frame: [0x3aa84a, 0xf8f8f8], ready: false },
  { id: 'portal', name: 'Portal House', emoji: '🌀', frame: [0x8a3ad8, 0x3ad8d8], ready: false },
  { id: 'fair', name: 'Funfair', emoji: '🎡', frame: [0xf88ac8, 0xf8e83a], ready: false },
  { id: 'doors', name: 'Room of Doors', emoji: '🎁', frame: [0xf8a83a, 0x8a3a1a], ready: false },
];
export const pictureWorld = id => PICTURE_WORLDS.find(w => w.id === id) ?? null;

// stars from a save: only known ids, once each, in PICTURE_WORLDS order; junk -> [] (old saves have none).
export function loadStars(saved) {
  const set = new Set(Array.isArray(saved) ? saved.filter(s => typeof s === 'string') : []);
  return PICTURE_WORLDS.filter(w => set.has(w.id)).map(w => w.id);
}
