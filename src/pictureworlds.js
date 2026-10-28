// T38a: the Picture Worlds that are stars (most hang as framed pictures in the Swirl). Data only (one import: the wave 15 switch).
// Append-only: the ids are saved in `stars` (the worlds whose Boss you beat). Waves 14-15 flip `ready` and add a `realm`.
// Until a world is ready, its frame in the Swirl is covered with a cloth. Frame colours: [border gem, trim].
import { worldOpen, WAVE15, LATER } from './comingsoon.js'; // wave 15 ships closed until the owner opens it
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
// T43: the picture in the Funfair's frame: a blue sky, a pink-and-cream Ferris wheel behind, a carousel under a red-and-white striped canopy,
// string lights and a gold ticket (128 px canvas).
function drawFairPicture(g, n = 128) {
  const k = n / 128, r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * k, y * k, w * k, h * k); };
  r(0, 0, 128, 128, '#bfe6ff'); r(0, 96, 128, 32, '#ffd6ec'); for (let x = 0; x < 128; x += 16) r(x, 96, 8, 32, '#fff2d0');
  g.strokeStyle = '#ff8ac8'; g.lineWidth = 3 * k; g.beginPath(); g.arc(88 * k, 52 * k, 34 * k, 0, 7); g.stroke();
  g.lineWidth = 1.5 * k; for (let a = 0; a < 8; a++) { g.beginPath(); g.moveTo(88 * k, 52 * k); g.lineTo((88 + Math.cos(a * 0.785) * 34) * k, (52 + Math.sin(a * 0.785) * 34) * k); g.stroke(); }
  for (let a = 0; a < 8; a++) r(88 + Math.cos(a * 0.785) * 34 - 3, 52 + Math.sin(a * 0.785) * 34 - 3, 6, 6, a % 2 ? '#ffe27a' : '#8ad8ff');
  r(26, 54, 3, 44, '#ffd23a'); r(60, 54, 3, 44, '#ffd23a'); r(14, 96, 62, 6, '#e84a6a');
  for (let i = 0; i < 6; i++) { r(10 + i * 11, 44, 11, 10, i % 2 ? '#fff6e6' : '#e03a4a'); }
  r(6, 40, 70, 5, '#ffd23a');
  for (let i = 0; i < 7; i++) r(8 + i * 11, 46, 4, 4, '#ffe27a');
  g.fillStyle = '#fff2e0'; g.beginPath(); g.ellipse(44 * k, 84 * k, 9 * k, 7 * k, 0, 0, 7); g.fill(); g.fillRect(48 * k, 74 * k, 6 * k, 8 * k); r(34, 90, 3, 8, '#fff2e0'); r(50, 90, 3, 8, '#fff2e0');
  r(102, 96, 20, 12, '#fff2a0'); r(102, 96, 20, 3, '#e84a6a'); r(108, 100, 8, 5, '#ffd23a');
}
// T48: the picture in the Surprise Party's frame: a pink party wall with bunting, a three-tier birthday cake with lit candles, two
// balloons and a present with a bow (128 px canvas). (T44's Room of Doors had this frame before.)
function drawPartyPicture(g, n = 128) {
  const k = n / 128, r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * k, y * k, w * k, h * k); };
  r(0, 0, 128, 128, '#ffd8ec'); for (let x = 0; x < 128; x += 16) r(x, 0, 8, 128, '#ffcfe6'); r(0, 104, 128, 24, '#c9e6ff'); r(0, 104, 128, 4, '#a8d0f0');
  const flags = ['#e8384a', '#ffd23a', '#3a8ce8', '#3ac86a', '#b05ae8', '#ff8a1a'];
  for (let i = 0; i < 8; i++) { g.fillStyle = flags[i % flags.length]; const x = 4 + i * 16, y = 6 + Math.sin((i / 7) * Math.PI) * 8; g.beginPath(); g.moveTo(x * k, y * k); g.lineTo((x + 12) * k, y * k); g.lineTo((x + 6) * k, (y + 12) * k); g.fill(); }
  // the cake
  r(30, 84, 52, 22, '#f0c890'); r(30, 84, 52, 6, '#ff8ab0'); r(38, 66, 36, 18, '#f0c890'); r(38, 66, 36, 5, '#ff8ab0'); r(46, 52, 20, 14, '#f0c890'); r(46, 52, 20, 4, '#ff8ab0');
  r(28, 104, 56, 4, '#ffffff');
  for (const x of [40, 52, 64]) { r(x, 56 - (x === 52 ? 14 : 10), 4, x === 52 ? 10 : 10, '#3a8ce8'); g.fillStyle = '#ffd23a'; g.beginPath(); g.ellipse((x + 2) * k, (x === 52 ? 39 : 43) * k, 3 * k, 5 * k, 0, 0, 7); g.fill(); }
  // two balloons on strings
  for (const [x, y, c] of [[14, 40, '#e8384a'], [108, 34, '#3a8ce8']]) { g.strokeStyle = '#ffffff'; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(x * k, (y + 12) * k); g.lineTo((x + 2) * k, 104 * k); g.stroke(); g.fillStyle = c; g.beginPath(); g.ellipse(x * k, y * k, 10 * k, 13 * k, 0, 0, 7); g.fill(); r(x - 4, y - 7, 3, 4, 'rgba(255,255,255,0.6)'); }
  // a present with a bow
  r(92, 84, 26, 22, '#3ac86a'); r(103, 84, 5, 22, '#ffd23a'); r(92, 92, 26, 5, '#ffd23a');
  g.fillStyle = '#ffd23a'; g.beginPath(); g.ellipse(99 * k, 80 * k, 7 * k, 4 * k, -0.4, 0, 7); g.ellipse(111 * k, 80 * k, 7 * k, 4 * k, 0.4, 0, 7); g.fill();
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
// T45: the picture in the Sketchbook's frame: cream paper, a pencil-drawn floating page with a dotted line, a big pencil and one yellow star (128 px canvas).
function drawDoodlePicture(g, n = 128) {
  const k = n / 128, r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * k, y * k, w * k, h * k); };
  r(0, 0, 128, 128, '#f6f2e8'); for (let y = 16; y < 128; y += 16) r(0, y, 128, 1, '#cfd8ea');
  g.strokeStyle = '#3e3c46'; g.lineWidth = 3 * k; g.lineJoin = 'round';
  g.strokeRect(14 * k, 70 * k, 44 * k, 30 * k); g.strokeRect(74 * k, 40 * k, 40 * k, 26 * k); // two floating pages
  g.fillStyle = '#7cb85a'; g.fillRect(16 * k, 72 * k, 40 * k, 6 * k); g.fillRect(76 * k, 42 * k, 36 * k, 6 * k);
  g.fillStyle = '#3e3c46'; for (let i = 0; i < 6; i++) g.fillRect((58 + i * 3.4) * k, (84 - i * 5) * k, 2.4 * k, 2.4 * k); // the dotted line between them
  g.save(); g.translate(40 * k, 36 * k); g.rotate(-0.6); // a big yellow pencil
  g.fillStyle = '#ffd23a'; g.fillRect(-6 * k, -34 * k, 12 * k, 52 * k); g.fillStyle = '#e6c08a'; g.beginPath(); g.moveTo(-6 * k, 18 * k); g.lineTo(6 * k, 18 * k); g.lineTo(0, 32 * k); g.fill();
  g.fillStyle = '#3e3c46'; g.beginPath(); g.moveTo(-2 * k, 27 * k); g.lineTo(2 * k, 27 * k); g.lineTo(0, 32 * k); g.fill(); g.fillStyle = '#f0a8b8'; g.fillRect(-6 * k, -42 * k, 12 * k, 8 * k);
  g.restore();
  g.fillStyle = '#ffd23a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 4 : 9) * k; g.lineTo(100 * k + Math.cos(a) * rr, 20 * k + Math.sin(a) * rr); } g.fill();
}
/* ==== T49 castle ==== */
// T49: the picture in the Castle's frame: a blue sky, a grey castle with two round towers and red-and-gold pennants, the drawbridge down over
// a blue moat, a pumpkin on the grass and a little hedgehog with a shield (128 px canvas).
function drawCastlePicture(g, n = 128) {
  const k = n / 128, r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * k, y * k, w * k, h * k); };
  r(0, 0, 128, 128, '#bfe0ff'); r(0, 92, 128, 36, '#7cc85a'); r(0, 88, 128, 8, '#4a8ad8');
  r(30, 44, 68, 44, '#a8a8b4'); for (let x = 30; x < 98; x += 8) r(x, 38, 5, 6, '#a8a8b4');
  for (const x of [18, 96]) { r(x, 26, 16, 62, '#9a9aa8'); for (let i = 0; i < 4; i++) r(x + i * 4, 21, 3, 5, '#9a9aa8'); r(x + 7, 8, 2, 14, '#6a4a2a'); g.fillStyle = '#d83a4a'; g.beginPath(); g.moveTo((x + 9) * k, 8 * k); g.lineTo((x + 22) * k, 11 * k); g.lineTo((x + 9) * k, 14 * k); g.fill(); r(x + 9, 11, 8, 3, '#f0c84a'); r(x + 5, 40, 5, 9, '#2a2a34'); }
  r(54, 62, 20, 26, '#3a2a24'); r(52, 86, 24, 8, '#a8743a'); for (let x = 52; x < 76; x += 4) r(x, 86, 1, 8, '#7a5428');
  r(46, 52, 36, 8, '#4a6ad8'); r(60, 50, 8, 12, '#f0c84a');
  g.fillStyle = '#ff9a2a'; g.beginPath(); g.ellipse(22 * k, 108 * k, 9 * k, 7 * k, 0, 0, 7); g.fill(); r(21, 99, 2, 4, '#4a8a2a');
  g.fillStyle = '#8a6a4a'; g.beginPath(); g.ellipse(100 * k, 110 * k, 10 * k, 8 * k, 0, 0, 7); g.fill();
  g.fillStyle = '#c89a5a'; g.beginPath(); g.arc(91 * k, 110 * k, 6 * k, 0, 7); g.fill(); r(90, 109, 2, 2, '#f0c84a');
  r(105, 106, 2, 2, '#16121a');
}
/* ==== end of T49 castle ==== */
export const PICTURE_WORLDS = [
  { id: 'house', name: 'Giant House', emoji: '🏠', frame: [0xc89a3a, 0x7a4a1a], ready: true, realm: 'house', picture: drawHousePicture }, // T40a; T40a.5 the puzzle house (owner 2026-10-26)
  { id: 'pirate', name: 'Pirate Seas', emoji: '🏴‍☠️', frame: [0x3a6aa8, 0xe8d8a8], ready: true, realm: 'pirate' },
  { id: 'race', name: 'Race Track', emoji: '🏎️', frame: [0xd83a3a, 0xf8f8f8], ready: true, realm: 'playland', place: 'Playland' }, // place: the world it shares (owner 2026-10-26: the frames say so)
  { id: 'stadium', name: 'Ball Stadium', emoji: '⚽', frame: [0x3aa84a, 0xf8f8f8], ready: true, realm: 'playland', place: 'Playland' },
  { id: 'portal', name: 'Portal House', emoji: '🌀', frame: [0x8a3ad8, 0x3ad8d8], ready: true, door: false }, // the Portal House is in the Swirl itself: no frame, but its star lights a stone
  { id: 'fair', name: 'Funfair', emoji: '🎡', frame: [0xf88ac8, 0xf8e83a], ready: true, realm: 'playland', place: 'Playland', picture: drawFairPicture }, // T43: the third Playland world
  { id: 'doors', name: 'Surprise Party', emoji: '🎁', frame: [0xf8a83a, 0x8a3a1a], ready: true, realm: 'doors', picture: drawPartyPicture }, // T44; T48 the Surprise Party (it replaced the Room of Doors)
  // Five worlds still to be named (owner 2026-10-25; the fifth since 2026-10-26): framed, covered, secret.
  { id: 'doodle', name: 'Sketchbook', emoji: '✏️', frame: [0xb8a0f0, 0xf8e8c8], ready: true, realm: 'doodle', picture: drawDoodlePicture }, // T45 (was secret1: no save could hold its star)
  { id: 'atlantis', name: 'Atlantis', emoji: '🔱', frame: [0x8adcc8, 0xf8f0d8], ready: true, realm: 'pirate', place: 'Pirate Seas', picture: drawAtlantisPicture }, // T41: was secret2 (no save could hold its star): the Sunken City, in the Pirate Seas
  { id: 'castle', name: 'Castle', emoji: '🏰', frame: [0xf8b8a0, 0xe8f0f8], ready: true, realm: 'castle', picture: drawCastlePicture }, // T49 (was secret3: no save could hold its star)
  { id: 'secret4', name: 'Secret World', emoji: '❓', frame: [0xa0c8f8, 0xf8e0f0], ready: false, secret: true },
  // Owner 2026-10-26: the Wizard gives no star (beating him is chapter 2's championship); the 12th star is a fifth secret world
  // (it took the place of the old `wizard` entry, which no save could hold).
  { id: 'secret5', name: 'Secret World', emoji: '❓', frame: [0xf0d080, 0xd8c8f8], ready: false, secret: true },
];
for (const w of PICTURE_WORLDS) if (WAVE15.includes(w.id) && !worldOpen(w.id)) w.ready = false; // wave 15 ships closed (comingsoon.js)
// T49: the Castle ships behind ?preview, and while it is closed its frame is the old secret one (nothing spoiled on the cloth).
for (const w of PICTURE_WORLDS) if (LATER.includes(w.id) && !worldOpen(w.id)) Object.assign(w, { ready: false, secret: true, realName: w.name, name: 'Secret World', emoji: '❓' });
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
