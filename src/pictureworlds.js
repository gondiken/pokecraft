// T38a: the Picture Worlds that are stars (most hang as framed pictures in the Swirl). Data only (no imports).
// Append-only: the ids are saved in `stars` (the worlds whose Boss you beat). Waves 14-15 flip `ready` and add a `realm`.
// Until a world is ready, its frame in the Swirl is covered with a cloth. Frame colours: [border gem, trim].
export const PICTURE_WORLDS = [
  { id: 'house', name: 'Giant House', emoji: '🏠', frame: [0xc89a3a, 0x7a4a1a], ready: false, realm: 'house' },
  { id: 'pirate', name: 'Pirate Seas', emoji: '🏴‍☠️', frame: [0x3a6aa8, 0xe8d8a8], ready: false, realm: 'pirate' },
  { id: 'race', name: 'Race Track', emoji: '🏎️', frame: [0xd83a3a, 0xf8f8f8], ready: false, realm: 'playland' },
  { id: 'stadium', name: 'Ball Stadium', emoji: '⚽', frame: [0x3aa84a, 0xf8f8f8], ready: true, realm: 'playland' },
  { id: 'portal', name: 'Portal House', emoji: '🌀', frame: [0x8a3ad8, 0x3ad8d8], ready: false, door: false }, // the Portal House is in the Swirl itself: no frame, but its star lights a stone
  { id: 'fair', name: 'Funfair', emoji: '🎡', frame: [0xf88ac8, 0xf8e83a], ready: false },
  { id: 'doors', name: 'Room of Doors', emoji: '🎁', frame: [0xf8a83a, 0x8a3a1a], ready: false },
  // Four worlds still to be named (owner 2026-10-25): framed, covered, secret.
  { id: 'secret1', name: 'Secret World', emoji: '❓', frame: [0xb8a0f0, 0xf8e8c8], ready: false, secret: true },
  { id: 'secret2', name: 'Secret World', emoji: '❓', frame: [0x8adcc8, 0xf8f0d8], ready: false, secret: true },
  { id: 'secret3', name: 'Secret World', emoji: '❓', frame: [0xf8b8a0, 0xe8f0f8], ready: false, secret: true },
  { id: 'secret4', name: 'Secret World', emoji: '❓', frame: [0xa0c8f8, 0xf8e0f0], ready: false, secret: true },
  // The 12th star: the Wizard at the top of his tower. No frame, no bridge stone.
  { id: 'wizard', name: "The Wizard's Star", emoji: '🧙', frame: [0xe8d83a, 0x8a5ad8], ready: false, door: false, bridge: false },
];
// 12 stars in all (PICTURE_WORLDS); 10 hang as frames in the Swirl; 11 light a stone of the star bridge.
export const FRAME_WORLDS = PICTURE_WORLDS.filter(w => w.door !== false);
export const BRIDGE_WORLDS = PICTURE_WORLDS.filter(w => w.bridge !== false);
// T40: the Picture Worlds that open a realm (`realm` = a REALMS id; Race Track and Ball Stadium share Playland, each frame has its own arrival).
export const worldsOf = realm => PICTURE_WORLDS.filter(w => w.realm === realm);
export const pictureWorld = id => PICTURE_WORLDS.find(w => w.id === id) ?? null;

// stars from a save: only known ids, once each, in PICTURE_WORLDS order; junk -> [] (old saves have none).
export function loadStars(saved) {
  const set = new Set(Array.isArray(saved) ? saved.filter(s => typeof s === 'string') : []);
  return PICTURE_WORLDS.filter(w => set.has(w.id)).map(w => w.id);
}
