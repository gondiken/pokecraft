// T38a: the Picture Worlds that are stars (most hang as framed pictures in the Swirl). Data only (no imports).
// Append-only: the ids are saved in `stars` (the worlds whose Boss you beat). Waves 14-15 flip `ready` and add a `realm`.
// Until a world is ready, its frame in the Swirl is covered with a cloth. Frame colours: [border gem, trim].
// T40a: the picture in the Giant House's frame: a cream wall, the edge of a brown table, a big cookie and a little grey mouse (128 px canvas).
function drawHousePicture(g, n = 128) {
  const k = n / 128, r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * k, y * k, w * k, h * k); };
  r(0, 0, 128, 128, '#f7ecd8'); r(0, 0, 128, 40, '#c4e2bc'); for (let x = 0; x < 128; x += 16) r(x, 0, 8, 40, '#d4ecc8');
  r(0, 84, 128, 44, '#a8662f'); r(0, 84, 128, 6, '#c4843f'); for (let y = 98; y < 128; y += 10) r(0, y, 128, 2, '#8c5226');
  g.fillStyle = '#d9a35a'; g.beginPath(); g.ellipse(46 * k, 78 * k, 34 * k, 13 * k, 0, 0, 7); g.fill();
  g.fillStyle = '#e8b86a'; g.beginPath(); g.ellipse(46 * k, 73 * k, 34 * k, 12 * k, 0, 0, 7); g.fill();
  for (const [x, y] of [[30, 72], [44, 66], [58, 74], [38, 80], [64, 68], [24, 78]]) r(x, y, 5, 4, '#5a3320');
  g.fillStyle = '#9a9aa8'; g.beginPath(); g.ellipse(96 * k, 72 * k, 17 * k, 14 * k, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(88 * k, 54 * k, 11 * k, 0, 7); g.arc(106 * k, 54 * k, 11 * k, 0, 7); g.fill();
  g.fillStyle = '#f2a6c0'; g.beginPath(); g.arc(88 * k, 54 * k, 6 * k, 0, 7); g.arc(106 * k, 54 * k, 6 * k, 0, 7); g.fill();
  r(80, 68, 6, 6, '#16121a'); r(92, 68, 6, 6, '#16121a'); r(82, 69, 2, 2, '#fff'); r(94, 69, 2, 2, '#fff'); r(86, 76, 6, 4, '#f08aa0');
}
// T41: the picture in the Atlantis frame: deep blue water, a sandy floor, columns, a palace dome with a golden glow and glowfish (128 px canvas).
function drawAtlantisPicture(g, n = 128) {
  const k = n / 128, r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * k, y * k, w * k, h * k); };
  const sea = g.createLinearGradient(0, 0, 0, n); sea.addColorStop(0, '#2aa0b0'); sea.addColorStop(1, '#0e3a5a');
  g.fillStyle = sea; g.fillRect(0, 0, n, n);
  r(0, 108, 128, 20, '#c8b078'); r(0, 108, 128, 3, '#e8d49a');
  for (const x of [14, 100]) { r(x, 62, 10, 46, '#e2d6b0'); r(x - 2, 58, 14, 6, '#c8bc94'); r(x - 2, 104, 14, 6, '#c8bc94'); }
  g.fillStyle = 'rgba(160,230,240,0.55)'; g.beginPath(); g.arc(64 * k, 108 * k, 36 * k, Math.PI, 0); g.fill();
  g.strokeStyle = '#d8f8ff'; g.lineWidth = 3 * k; g.beginPath(); g.arc(64 * k, 108 * k, 36 * k, Math.PI, 0); g.stroke();
  r(40, 92, 48, 16, '#e8d49a'); r(58, 70, 12, 22, '#ffe27a'); r(55, 66, 18, 6, '#ffd24a'); r(62, 74, 4, 12, '#fffbe0');
  g.fillStyle = 'rgba(255,226,122,0.35)'; g.beginPath(); g.arc(64 * k, 90 * k, 26 * k, 0, 7); g.fill();
  for (const [x, y, c] of [[24, 40, '#ffb36a'], [96, 30, '#8af4ff'], [50, 24, '#ffe27a'], [80, 52, '#ffe27a'], [106, 70, '#ffb36a'], [30, 80, '#8af4ff']]) { r(x, y, 10, 5, c); r(x + (x > 64 ? 10 : -4), y, 4, 5, c); r(x + (x > 64 ? 2 : 6), y + 1, 1.5, 1.5, '#102030'); }
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (const [x, y] of [[10, 20], [60, 12], [118, 16], [8, 70], [118, 90], [40, 50]]) { g.beginPath(); g.arc(x * k, y * k, 2.5 * k, 0, 7); g.fill(); }
}
export const PICTURE_WORLDS = [
  { id: 'house', name: 'Giant House', emoji: '🏠', frame: [0xc89a3a, 0x7a4a1a], ready: true, realm: 'house', picture: drawHousePicture }, // T40a; T40a.5 the puzzle house (owner 2026-10-26)
  { id: 'pirate', name: 'Pirate Seas', emoji: '🏴‍☠️', frame: [0x3a6aa8, 0xe8d8a8], ready: true, realm: 'pirate' },
  { id: 'race', name: 'Race Track', emoji: '🏎️', frame: [0xd83a3a, 0xf8f8f8], ready: true, realm: 'playland', place: 'Playland' }, // place: the world it shares (owner 2026-10-26: the frames say so)
  { id: 'stadium', name: 'Ball Stadium', emoji: '⚽', frame: [0x3aa84a, 0xf8f8f8], ready: true, realm: 'playland', place: 'Playland' },
  { id: 'portal', name: 'Portal House', emoji: '🌀', frame: [0x8a3ad8, 0x3ad8d8], ready: false, door: false }, // the Portal House is in the Swirl itself: no frame, but its star lights a stone
  { id: 'fair', name: 'Funfair', emoji: '🎡', frame: [0xf88ac8, 0xf8e83a], ready: false },
  { id: 'doors', name: 'Room of Doors', emoji: '🎁', frame: [0xf8a83a, 0x8a3a1a], ready: false },
  // Five worlds still to be named (owner 2026-10-25; the fifth since 2026-10-26): framed, covered, secret.
  { id: 'secret1', name: 'Secret World', emoji: '❓', frame: [0xb8a0f0, 0xf8e8c8], ready: false, secret: true },
  { id: 'atlantis', name: 'Atlantis', emoji: '🔱', frame: [0x8adcc8, 0xf8f0d8], ready: true, realm: 'pirate', place: 'Pirate Seas', picture: drawAtlantisPicture }, // T41: was secret2 (no save could hold its star): the Sunken City, in the Pirate Seas
  { id: 'secret3', name: 'Secret World', emoji: '❓', frame: [0xf8b8a0, 0xe8f0f8], ready: false, secret: true },
  { id: 'secret4', name: 'Secret World', emoji: '❓', frame: [0xa0c8f8, 0xf8e0f0], ready: false, secret: true },
  // Owner 2026-10-26: the Wizard gives no star (beating him is chapter 2's championship); the 12th star is a fifth secret world
  // (it took the place of the old `wizard` entry, which no save could hold).
  { id: 'secret5', name: 'Secret World', emoji: '❓', frame: [0xf0d080, 0xd8c8f8], ready: false, secret: true },
];
// 12 stars in all (PICTURE_WORLDS), every one from a Picture World; 11 hang as frames in the Swirl (all but the Portal House);
// all 12 light a stone of the star bridge.
export const FRAME_WORLDS = PICTURE_WORLDS.filter(w => w.door !== false);
export const BRIDGE_WORLDS = PICTURE_WORLDS.filter(w => w.bridge !== false);
// T40: the Picture Worlds that open a realm (`realm` = a REALMS id; Race Track and Ball Stadium share Playland, each frame has its own arrival).
export const worldsOf = realm => PICTURE_WORLDS.filter(w => w.realm === realm);
export const pictureWorld = id => PICTURE_WORLDS.find(w => w.id === id) ?? null;
// The name to show: 'Playland · Race Track' for a place inside a shared world, else just the name.
export const fullName = w => (w.place ? `${w.place} · ${w.name}` : w.name);

// stars from a save: only known ids, once each, in PICTURE_WORLDS order; junk -> [] (old saves have none).
export function loadStars(saved) {
  const set = new Set(Array.isArray(saved) ? saved.filter(s => typeof s === 'string') : []);
  return PICTURE_WORLDS.filter(w => set.has(w.id)).map(w => w.id);
}
