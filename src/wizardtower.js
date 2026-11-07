// Wave 19 (plans/wave19-wizard-tower.md sections 4, 7 and 10), stage B: the Wizard's painting tower as pure data and rules (no Three.js, no
// world; Node-runnable). Five floors of ONE game that differ only by data: copy the little picture onto the canvas with paint pots.
// `checkCanvas` is the one checker (free groups, given squares, mirrors); `towerOpen` / `towerAim` are the tower's opening rule and its
// guide arrow in the Swirl (they read the star bridge through pictureworlds.js `bridgeDone`, never a number of stars).
import { PAINTS } from './custom.js';
import { worldOpen } from './comingsoon.js';
import { bridgeNeed, bridgeDone } from './pictureworlds.js';

// Codes: '.' blank (leave the canvas), a-l a paint you must match (custom.js PAINTS `code`), A-L the same paint already painted (given,
// locked), '1'-'3' a free group: any paint, but every square of one group the same. Row 0 is the TOP row.
// Owner 2026-11-07 ("some of the floors should be more novel & interesting ... more floors, or more interesting painting ideas ... wayy too
// easy (though still fun)"): every floor is ONE idea with a few pictures (`pages`) that get harder, 12 pictures in all (was 5). The floor's
// stairs door opens when its last picture is right. Floor ideas: 1 copy, 2 mirrors (left-right, a lake = up-down, a snowflake = both),
// 3 mixing (only red, yellow and blue pots: paint over a colour to mix, like real paint), 4 the big brush (every dab paints 2 x 2 squares,
// centred where you point: the back things first), 5 your guardian. `mirror`: 'x' left-right, 'y' up-down, 'xy' both (wizardcheck proves it).
export const FLOORS = [
  { n: 1, name: 'Copy', pages: [
    { name: 'Flower', w: 4, h: 4, sign: 'Tap a paint pot, then tap the canvas. Copy the picture!',
      rows: ['.yy.', 'yrry', 'yrry', '.gg.'] },
    { name: 'House', w: 6, h: 6, sign: 'A bigger picture!',
      rows: ['..rr..', '.rrrr.', 'rrrrrr', '.iono.', '.oono.', 'gggggg'] },
  ] },
  { n: 2, name: 'Mirror', pages: [
    { name: 'Butterfly', w: 6, h: 6, mirror: 'x', sign: 'Paint the other half, like a mirror!',
      rows: ['.X..x.', 'PPXxpp', 'PKXxkp', '.PXxp.', 'KPXxpk', 'KK..kk'] },
    { name: 'Lake', w: 6, h: 6, mirror: 'y', sign: 'A lake! Paint the picture upside down in the water.',
      rows: ['IYYIGG', 'IYYIGG', 'IIIINI', 'iiiini', 'iyyigg', 'iyyigg'] },
    { name: 'Snowflake', w: 6, h: 6, mirror: 'xy', sign: 'Mirror it twice: across AND down!',
      rows: ['I.Bb.i', '.IBbi.', 'BBPpbb', 'bbppbb', '.ibbi.', 'i.bb.i'] },
  ] },
  { n: 3, name: 'Mixing', mix: true, pots: 'ryb', pages: [
    { name: 'Pumpkin', w: 6, h: 6, sign: 'Only red, yellow and blue! Paint over a colour to mix.',
      rows: ['..gg..', '.oooo.', 'oooooo', 'oyooyo', 'oooooo', '.oooo.'] },
    { name: 'Grapes', w: 6, h: 6, sign: 'Mix all three for brown!',
      rows: ['..nngg', '.ppgg.', 'pppp..', 'ppppp.', '.ppp..', '..p...'] },
    { name: 'Rainbow', w: 6, h: 6, sign: 'A rainbow! Every colour from three pots.',
      rows: ['.rrrr.', 'roooor', 'oy..yo', 'yg..gy', 'gb..bg', 'bp..pb'] },
  ] },
  { n: 4, name: 'Big Brush', brush: 2, pages: [
    { name: 'Window', w: 6, h: 6, sign: 'The BIG brush paints 4 squares at once!',
      rows: ['bbbbbb', 'bbbbbb', 'bbyybb', 'bbyybb', 'bbbbbb', 'bbbbbb'] },
    { name: 'Present', w: 6, h: 6, sign: 'A present! Which colour goes first?',
      rows: ['rryrrr', 'rryrrr', 'yyyyyy', 'rryrrr', 'rryrrr', 'rryrrr'] },
    { name: 'Robot', w: 6, h: 6, sign: 'A robot! Plan it well.',
      rows: ['..yy..', 'mmmmmm', 'mbmmbm', 'mmmmmm', 'mmrrmm', 'mmmmmm'] },
  ] },
  { n: 5, name: 'Guardian', pages: [
    { name: 'Guardian', w: 8, h: 7, mirror: 'x', palette: true, groups: [6, 8, 2], sign: "Paint my guardian! Its colours will be YOUR creature's colours.",
      rows: ['.X....x.', 'X2X..x2x', 'X111111x', 'X1X11x1x', 'X113311x', 'X133331x', '.XX..xx.'] },
  ] },
];
export const floorOf = n => FLOORS[n - 1] ?? null;
export const pageOf = (n, k) => FLOORS[n - 1]?.pages[k - 1] ?? null;              // k is 1-based
export const pageKey = (n, k) => `wizard:floor${n}:${k}`;                         // one picture done (saved in `beaten`)
export const PICTURES = FLOORS.reduce((t, f) => t + f.pages.length, 0);
// The floor's canvas holds its biggest picture; a smaller one sits in its middle (the rest of the canvas is drawn as the gold frame).
export const floorSize = f => ({ w: Math.max(...f.pages.map(p => p.w)), h: Math.max(...f.pages.map(p => p.h)) });
export const pageOffset = (f, page) => { const S = floorSize(f); return { dx: Math.floor((S.w - page.w) / 2), dy: Math.floor((S.h - page.h) / 2) }; }; // dy from the bottom
// The first picture of floor n not done yet (1-based), or the last one when all are done. `has(key)` = is this key held.
export function pageNow(n, has) { const f = FLOORS[n - 1]; for (let k = 1; k <= f.pages.length; k++) if (!has(pageKey(n, k))) return k; return f.pages.length; }

/* ---- the Mixing floor: paint over a colour and they mix, like real paint ---- */
const P = code => PAINTS.findIndex(p => p.code === code);
const PRIMARY = { r: 1, y: 2, b: 4 };                                            // bits: red, yellow, blue
const BITS = { ...PRIMARY, o: 3, g: 6, p: 5, n: 7 };                             // red+yellow orange, yellow+blue green, red+blue purple, all three brown
const MIXED = Object.fromEntries(Object.entries(BITS).map(([c, b]) => [b, c]));
const bitsOf = i => BITS[PAINTS[i]?.code] ?? 0;
// What a square becomes when `brush` (a paint, or WASH -1) goes over `old` (-1 blank): the wash clears; on blank the paint goes on as it is;
// a primary over a mixable colour adds itself (orange + blue = brown, red + red = red, orange + red = orange: it already has red in it).
export function mixPaint(old, brush) {
  if (brush < 0) return -1;
  if (old < 0) return brush;
  const a = bitsOf(old), b = bitsOf(brush);
  if (!a || !b) return brush;
  return P(MIXED[a | b]);
}
// The fewest primaries for a paint on a blank square (in a fixed order: red, yellow, blue), or null when it cannot be mixed.
export function recipeOf(i) { const bits = bitsOf(i); return bits ? ['r', 'y', 'b'].filter(c => bits & PRIMARY[c]).map(P) : null; }

/* ---- the Big Brush floor: one dab paints the 2 x 2 squares round the grid corner nearest where you point ---- */
// u, v: where the cast hit the picture, in squares from its left edge and from its BOTTOM edge. -> the four square indices (row by row from
// the top), always inside the picture.
export function stampCells(page, u, v) {
  const cx = Math.min(page.w - 1, Math.max(1, Math.round(u))), cy = Math.min(page.h - 1, Math.max(1, Math.round(v)));
  const out = [];
  for (const ry of [cy, cy - 1]) for (const qx of [cx - 1, cx]) out.push((page.h - 1 - ry) * page.w + qx);
  return out;
}

export const floorKey = n => `wizard:floor${n}`; // the whole floor done (its stairs door opens); saved in `beaten` (strings, kept as they are, like the Picture World keys)
export const HINT = { after: 40, again: 25, blink: 3 }; // seconds of play time: 40 s without a new right square, then every 25 s, the wrong squares blink for 3 s

const CODE = Object.fromEntries(PAINTS.map((p, i) => [p.code, i]));
// What every square of a floor wants: { kind: 'blank' | 'paint' | 'given' | 'group', paint?, group? }, row by row from the top.
export function targetOf(floor) {
  const out = [];
  for (const row of floor.rows) for (const ch of row) {
    if (ch === '.') out.push({ kind: 'blank' });
    else if (ch >= '1' && ch <= '9') out.push({ kind: 'group', group: Number(ch) - 1 });
    else if (ch >= 'A' && ch <= 'Z' && CODE[ch.toLowerCase()] !== undefined) out.push({ kind: 'given', paint: CODE[ch.toLowerCase()] });
    else if (CODE[ch] !== undefined) out.push({ kind: 'paint', paint: CODE[ch] });
    else out.push({ kind: 'bad', ch });
  }
  return out;
}
export const groupCount = floor => targetOf(floor).reduce((n, t) => (t.kind === 'group' ? Math.max(n, t.group + 1) : n), 0);
// A fresh canvas: given squares painted, the rest blank (-1).
export const startCells = floor => targetOf(floor).map(t => (t.kind === 'given' ? t.paint : -1));
export const isGiven = (floor, i) => targetOf(floor)[i]?.kind === 'given';
// The squares a child has to paint (paint squares and free-group squares).
export const squaresToPaint = floor => targetOf(floor).filter(t => t.kind === 'paint' || t.kind === 'group').length;

// The most common paint among a group's painted squares (a tie: the first painted square in reading order wins), or null.
function majority(list) {
  const n = new Map();
  for (const p of list) n.set(p, (n.get(p) ?? 0) + 1);
  let best = null, count = 0;
  for (const p of list) if (n.get(p) > count) { best = p; count = n.get(p); }
  return best;
}

// cells: one entry per square, row by row from the top: -1 blank, 0..11 a paint (given squares already filled in).
// -> { done, right, total, wrong: [i], groups: [paint | null per group] }
//    right / total count the squares to paint; `wrong` is for the blink: a paint square holding another paint, a blank square that was
//    painted, and in a group the squares that differ from the group's most common paint. An empty square is never "wrong".
export function checkCanvas(floor, cells) {
  const T = targetOf(floor), wrong = [];
  const members = [];
  T.forEach((t, i) => { if (t.kind === 'group') (members[t.group] ??= []).push(i); });
  const common = [];
  for (let g = 0; g < members.length; g++) common[g] = majority((members[g] || []).map(i => cells[i]).filter(p => p >= 0));
  let right = 0, total = 0, done = true;
  T.forEach((t, i) => {
    const c = cells[i] ?? -1;
    if (t.kind === 'blank') { if (c !== -1) { wrong.push(i); done = false; } return; }
    if (t.kind === 'given') { if (c !== t.paint) done = false; return; }
    total++;
    if (t.kind === 'paint') {
      if (c === t.paint) right++; else { done = false; if (c !== -1) wrong.push(i); }
      return;
    }
    if (c === -1) { done = false; return; }                       // a group square not painted yet: not done, not wrong
    if (c === common[t.group]) right++; else { done = false; wrong.push(i); }
  });
  const groups = members.map((m, g) => (m && m.every(i => cells[i] === common[g]) && common[g] !== null ? common[g] : null));
  return { done, right, total, wrong, groups };
}
// Floor 5's free groups are your creature's colours once done: [body, accent, belly] paint indices, else null.
export function palette(floor, cells) {
  const r = checkCanvas(floor, cells);
  return r.done && floor.palette && r.groups.length >= 3 && r.groups.slice(0, 3).every(p => p !== null) ? r.groups.slice(0, 3) : null;
}
// The colours a finished floor shows when nobody remembers what was painted (a reload: only the keys are saved, section 6): a pleasant
// default for each free group.
// Floor 5's pleasant default colours (studio.js: a guardian with no saved paint).
export const DEFAULT_GROUPS = { 5: FLOORS[4].pages[0].groups };
// The squares of a finished picture: the target, free groups in `groups` (else the page's own defaults, `page.groups`).
export function finishedCells(floor, groups) {
  const g = groups ?? floor.groups ?? [];
  return targetOf(floor).map(t => (t.kind === 'blank' ? -1 : t.kind === 'group' ? (g[t.group] ?? 0) : t.paint));
}

/* ---- the Wizard's team (stage C fights with it; the data and the rematch ladder are pure) ---- */
// One creature he made for each of his favourite worlds; `extra` = signature moves for movesWith.
export const WIZARD_TEAM = [
  { species: 'visionelk', level: 82, extra: [] },
  { species: 'grandtome', level: 83, extra: [] },
  { species: 'loopwyrm', level: 84, extra: ['portalparty'] },
  { species: 'comethorn', level: 85, extra: ['starrynight'] },
  { species: 'stormwyvern', level: 86, extra: ['scalestorm'] },
  { species: 'spectrion', level: 88, extra: ['colorcarnival'] },
];
export const WIZARD_LEVEL_CAP = 100;
export const WIZARD_PER_WIN = 5;
// His team after `wins` rematch wins: every level + 5 per win, never above the top level.
export const wizardTeam = (wins = 0) => WIZARD_TEAM.map(m => ({ ...m, extra: [...m.extra], level: Math.min(WIZARD_LEVEL_CAP, m.level + WIZARD_PER_WIN * Math.max(0, wins | 0)) }));

/* ---- opening the tower and the guide ---- */
// The tower's one opening rule: the build has it (`?preview` until the owner opens it) and either you are the Wizard's ally (the door stays
// open for good) or every star the bridge needs (the worlds open on this page) is won.
export const towerOpen = game => worldOpen('wizard') && !!(game?.studio?.ally || bridgeDone(game?.stars));
// "⭐ n / need": the words' count, always from the bridge (never a number in the code).
export const starCount = stars => ({ have: bridgeNeed().filter(w => (stars || []).includes(w.id)).length, need: bridgeNeed().length });

// Where you stand to go in: 1.5 west of the Swirl tower's door, facing east ([x, y, z, yaw]); read from `world.swirl.wizard.door`, never typed.
export function towerStand(world) {
  const cells = world?.swirl?.wizard?.door;
  if (!cells?.length) return null;
  const x0 = Math.min(...cells.map(c => c[0])), y0 = Math.min(...cells.map(c => c[1]));
  const z = (Math.min(...cells.map(c => c[2])) + Math.max(...cells.map(c => c[2])) + 1) / 2;
  return [x0 - 1.5, y0, z, -Math.PI / 2]; // yaw -pi/2 looks east (+x)
}
// The Swirl's guide arrow to the open tower (swirlland.js swirlAim asks it before the door home): null when it is not open or you are its ally.
export function towerAim(world, p, game) {
  const s = towerStand(world);
  if (!s || !towerOpen(game) || game?.studio?.ally) return null;
  return { x: s[0], z: s[2], text: (a, m) => `🧙 Wizard's Tower ${a} ${m}m` };
}

export const WORDS = {
  sealed: 'The Wizard is inside, holding the Swirl together. Bring him stars!',
  sealedCount: (have, need) => `The Wizard is inside, holding the Swirl together. Bring him stars! (⭐ ${have} / ${need})`,
  bridgeWhole: 'The star bridge is whole! Cross it to the Wizard\'s tower!',
  door: "The Wizard's tower · tap to go in",
  doorAction: 'Step in!',
  stone: 'This stone waits for a world that is still asleep.',
  stonePrompt: 'A cloud stone · waiting for a sleepy world',
  noBrush: 'Tap a paint pot first!',
  closer: 'Come a little closer!',
  given: 'This half is done. Paint the other side!',
  done: 'Lovely! The stairs are open.',
  next: 'Lovely! Here comes the next picture...',
  finished: 'Finished! Up the stairs!',
  repaint: 'New colours! I like them.',
  locked: 'This picture is finished!',
  stairs: 'Up the stairs! ↑',
  copy: '🎨 Copy the picture!',
  wizard: '🧙 The Wizard',
  almost: 'Almost ready for you!', // stage B's placeholder for his battle (stage C replaces it)
  wizardGate5: 'Paint my guardian first! Then we battle.',
  wizardGateStars: n => `Bring me every star first! (⭐ ${n.have} / ${n.need})`,
};
