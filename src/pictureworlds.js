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
// T44: the picture in the Room of Doors' frame: a pink wall, a row of five coloured doors (the middle one gold, ajar) and a big gift with a bow on the floor (128 px canvas).
function drawDoorsPicture(g, n = 128) {
  const k = n / 128, r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * k, y * k, w * k, h * k); };
  r(0, 0, 128, 128, '#ffd8ec'); for (let x = 0; x < 128; x += 16) r(x, 0, 8, 128, '#ffcfe6'); r(0, 100, 128, 28, '#c9a6ee'); r(0, 100, 128, 4, '#b08ae0');
  const doors = ['#e8384a', '#3a8ce8', '#ffd23a', '#3ac86a', '#b05ae8'];
  doors.forEach((c, i) => {
    const x = 6 + i * 24;
    r(x, 22, 20, 60, '#8a3a1a'); r(x + 2, 24, 16, 56, c);
    if (i === 2) { g.fillStyle = '#3a2a5a'; g.beginPath(); g.moveTo((x + 2) * k, 24 * k); g.lineTo((x + 12) * k, 28 * k); g.lineTo((x + 12) * k, 78 * k); g.lineTo((x + 2) * k, 80 * k); g.fill(); r(x + 4, 50, 5, 4, '#fff'); }
    else r(x + 12, 52, 3, 3, '#fff0d0');
  });
  r(40, 70, 48, 38, '#e8384a'); r(40, 70, 48, 8, '#ff6a8a'); r(60, 70, 8, 38, '#ffd23a'); r(40, 86, 48, 6, '#ffd23a');
  g.fillStyle = '#ffd23a'; g.beginPath(); g.ellipse(52 * k, 64 * k, 12 * k, 7 * k, -0.4, 0, 7); g.ellipse(76 * k, 64 * k, 12 * k, 7 * k, 0.4, 0, 7); g.fill();
  r(60, 60, 8, 8, '#e8a81a');
}
export const PICTURE_WORLDS = [
  { id: 'house', name: 'Giant House', emoji: '🏠', frame: [0xc89a3a, 0x7a4a1a], ready: true, realm: 'house', picture: drawHousePicture }, // T40a; T40a.5 the puzzle house (owner 2026-10-26)
  { id: 'pirate', name: 'Pirate Seas', emoji: '🏴‍☠️', frame: [0x3a6aa8, 0xe8d8a8], ready: true, realm: 'pirate' },
  { id: 'race', name: 'Race Track', emoji: '🏎️', frame: [0xd83a3a, 0xf8f8f8], ready: true, realm: 'playland', place: 'Playland' }, // place: the world it shares (owner 2026-10-26: the frames say so)
  { id: 'stadium', name: 'Ball Stadium', emoji: '⚽', frame: [0x3aa84a, 0xf8f8f8], ready: true, realm: 'playland', place: 'Playland' },
  { id: 'portal', name: 'Portal House', emoji: '🌀', frame: [0x8a3ad8, 0x3ad8d8], ready: false, door: false }, // the Portal House is in the Swirl itself: no frame, but its star lights a stone
  { id: 'fair', name: 'Funfair', emoji: '🎡', frame: [0xf88ac8, 0xf8e83a], ready: false },
  { id: 'doors', name: 'Room of Doors', emoji: '🎁', frame: [0xf8a83a, 0x8a3a1a], ready: true, realm: 'doors', picture: drawDoorsPicture }, // T44
  // Five worlds still to be named (owner 2026-10-25; the fifth since 2026-10-26): framed, covered, secret.
  { id: 'secret1', name: 'Secret World', emoji: '❓', frame: [0xb8a0f0, 0xf8e8c8], ready: false, secret: true },
  { id: 'secret2', name: 'Secret World', emoji: '❓', frame: [0x8adcc8, 0xf8f0d8], ready: false, secret: true },
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
