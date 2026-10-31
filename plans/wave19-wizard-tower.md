# 🧙 Wave 19 · The Wizard's Tower and the Custom type (plan, not built yet)

Owner 2026-10-31: the Mirror Picture World became wave 18, so the Wizard's Tower is **wave 19** (it was wave 16 until 2026-10-28,
17 until 2026-10-29, 18 until today). The ROADMAP section "Wave 18 · The Wizard's Tower and the Custom type" is the design this plan
builds on; rename it to wave 19 when this plan lands. A Mirror planner works at the same time, so this plan is written to be
**buildable without the Mirror wave** and names every place where the two meet (section 13).

**Build this in a fresh session.** Read first: `CLAUDE.md`, `STORY.md` "The Wizard's Tower" and chapter 3, ROADMAP "Wave 18" (now
19), `plans/T40.md` (the Picture World kit: `pictureRealm`, `buildWayBack`, live parts), `plans/T28.md` (rematch counts),
`plans/T26.md` (a tiny per-creature field that travels: traits), `plans/wave17-gifts-trading.md` (what moves between saves).

## The owner's rules this plan follows

- **The Wizard is chapter 2's championship** (owner 2026-10-26): no badge, no star. Beating him and designing your creature ends
  chapter 2; you become the **Wizard's ally**.
- **The painting tower** (owner 2026-10-20): one game, floors differ only by data; tap a paint pot, tap a canvas cell; drawn with
  `setLive` (never an edit, never saved or sent); stuck a while = wrong cells blink; one checker with free cells; five floors;
  floor 5's free colours become your creature's palette. No timer, no fail, no trainers on the landings.
- **Easy to understand, hard to master** (owner 2026-10-29): one look and at most one short line per floor; the obvious shortcut
  (pillaring, jumping) never gets you up; Node bots: a naive kid must fail, a skilled one must win (section 11).
- **The way to a Picture World Boss is a skill challenge** (owner 2026-10-27). The tower is *not* a Picture World; this plan keeps
  the owner's calm painting and offers a skill version as an owner question (section 1).
- **Chapter 3: "Not wanted: more custom design features"** (owner 2026-10-24). So the design is **option 2** (ready-made designs,
  your painted palette) and nothing more: no free design screen, no part choices, no names typed in, no repainting later.
- Kid text: short, friendly, says what to do next. Works on iPad with the fixed-slot buttons (section 9).
- **Ships closed:** the tower opens only with `?preview` until the owner has played it (`'wizard'` joins `OPEN_NOW` then).
- Block ids: **only 137** (the Custom wool). 138-139 belong to the Mirror wave.

## What the child does

The last star lights the last stone of the star bridge. The sealed door of the Wizard's tower starts to swirl. The child crosses the
bridge, steps through the door and is inside the Wizard's **studio**: a round-cornered tower of five painting rooms stacked up, with
warm lamps, big windows onto the Swirl and stairs behind glass. On every floor an **easel** shows a little picture and the north wall
holds a **canvas** of blank cream wool squares, with a row of **paint pots** at its foot.

Tap a pot (the brush takes its colour), tap a square (it gets painted). When the canvas looks like the picture, a chime plays and the
glass door to the stairs slides open. Five floors: a flower (4x4), a house (6x6), half a butterfly to finish like a mirror, a hot-air
balloon whose **?** parts can be any colour you like, and at the top, in front of the Wizard himself, **half a creature**: you paint
the other half, and you choose its three colours.

The Wizard turns round: "Those are lovely colours. Now show me your team." The hardest battle in the game. Win, and he hands you his
drawing board: six creature shapes, all already in *your* colours. Tap one. It hops off the board and joins your team. It is the
Swirl's new guardian: the crack closes, the Wizard can finally come out, and the screen says **🧙 You are the Wizard's Ally!**

---

## 1. Skill or calm? (reconciling the newer owner rules)

**Recommended: keep the painting calm, as designed** (tap to paint, no timer, no fail), for four reasons:
1. It is the owner's own design for this one place, and the tower is not a Picture World (the skill rule is about the way to a
   Picture World Boss). It is the Wizard's studio: the place where the child learns how a creature is designed.
2. The challenge of the tower is the **battle**, the hardest in the game. A skill gate on top makes the finale long and fiddly for a
   young child right before the hardest fight.
3. Floor 5 is where the child picks its creature's colours. That should feel like choosing, not like aiming.
4. Every skill verb a painting could use is taken already (hold-and-let-go, lobbing with an arc like the basketball, leading a moving
   target like the rowboats, steering a line like Draw!).

It still meets "easy to understand, hard to master": a child gets it in one look (copy the picture), the pictures grow (4x4, 6x6,
mirror, free groups, a 34-cell creature) and there is no shortcut (section 11's bots: random painting never finishes, pillaring
never gets you up).

**The alternative for the owner (question 1): "Splat!", paint is thrown.** You load the brush at a pot and flick a blob at the canvas
from a painter's line (one tap, no hold). The blob flies at a fixed speed and drops a little, more the further away you stand:
floor 1 from 2 blocks (almost straight), floor 5 from 6 blocks off a little balcony (aim a cell or two high). A blob that hits the
wrong square paints it, so a miss is only more work (never a fail). Naive kid (aims straight at the cell) mostly hits the square
below from floor 2 on; skilled (aims a little high, more when further) wins. Kind help only through `kindHelp(misses)` (the drop
shrinks by `ease`). On iPad a tap on the screen flicks toward that spot (the tap's ray). Extra cost: the throw (pure, 1/120 s
sub-steps, `tests/wizardbots.mjs` at 60 / 20 fps), a blob mesh, the bots; about a third more work than the calm version. Data is
ready for it: `FLOORS[i].throwFrom` (distance) is the only new field.

(A later "hard to master" add-on, not in this wave: a **Studio Run** time trial through the five canvases with medals in the save
field `records`, like the House Run. Owner question 11.)

## 2. When the tower opens (the star count, never a hard-coded 12 or 13)

The bridge's stones are `BRIDGE_WORLDS` (every `PICTURE_WORLDS` entry with `bridge !== false`). Today that is 12; the Mirror wave
makes it 13 and may switch Mirror off again later. A world behind `?preview` (`LATER`, today Cube Planets) has a stone but nobody
outside `?preview` can win its star.

**Rule (recommended, owner question 2): the bridge needs the stars of the open worlds only.** Two lines in `pictureworlds.js`:

```js
// Wave 19: the stars the star bridge needs here and now: every bridge world that is open on this page and not switched off.
export const bridgeNeed = () => BRIDGE_WORLDS.filter(w => w.removed !== true && worldOpen(w.id));
export const bridgeDone = stars => bridgeNeed().every(w => (stars || []).includes(w.id));
```

`worldOpen` is the existing switch (comingsoon.js): in `?preview`, in tests and in Node every world is open, so there every star
counts. `w.removed` is the name this plan expects for the Mirror wave's off switch; if that wave switches Mirror off another way
(dropping it from `BRIDGE_WORLDS`, or a `bridge: false`), the helper is already right or needs that one condition changed (section 13).

`wizardtower.js` then has the one opening rule:

```js
export const towerOpen = game => worldOpen('wizard') && (game.studio?.ally || bridgeDone(game.stars));
```

- **An ally keeps the door open for good** (a world that opens later never seals the tower again for someone who already won).
- **A stone whose world is not open** (Cube Planets outside `?preview`): while the needed stars are not all won it looks as today
  (an outline, air). Once `bridgeDone`, it is drawn as a soft cloud stone (`B.CLOUD` with `setLive`, no new id) so the bridge is
  walkable; its toast: "This stone waits for a world that is still asleep." When that world opens and you win its star it becomes a
  `STAR_STONE` like the others. (If it opens before you won the Wizard, the bridge needs that star too, as the story says.)
- **Closed** (`'wizard'` not in `OPEN_NOW`, no `?preview`): nothing changes from today, even with every star: the door is sealed
  with today's words, `REALMS.wizard` is not defined, so a save made inside the tower in `?preview` loads in the main world (like any
  realm that does not exist).
- Every count in words uses `bridgeNeed().length` ("⭐ 9 / 11"), never a number in the code.

## 3. Realm or not: the tower is its own realm `wizard`

**Decided: a separate small realm `wizard` (48 x 48), entered through the sealed door, `parent: 'swirl'`.** Reasons:
- **Height.** Every world is 48 tall (`WORLD_H`). The Swirl's tower is a 9 x 9 shaft from y 21 to the crystal at y 47 and the
  island sits at y 20: five rooms of 7+ air each with a 6- to 7-high canvas do not fit, and widening it would rewrite Swirl cells
  (a `REALMS.swirl` version 6). In its own realm the floors start at y 1 and get the whole 48.
- **The Swirl stays as it is** (version 5, `sameCells: [4]` untouched): the door is drawn with `setLive`, the bridge's cloud stones
  too. No old Swirl edit or position is lost, and the Mirror wave can move the island (`wizardX(BRIDGE_WORLDS.length)`) without
  touching the tower: the realm does not care where the island is.
- **Travel rules fit as they are:** a hop down from the Swirl (`stash.up`), one level deep like every Picture World; the way back
  (`world.doors`) takes you up to the Swirl, and since `frameReturn('wizard')` finds no frame, you come out at `stash.up.ret` = in
  front of the tower door. Saves (`place: 'wizard'`, `realmPos`, `realmUp`) and the lost-battle rest (`lose: 'stay'`) work unchanged.
- **Play together** works unchanged: the realm's `entrance: 'tower'` lets a guest follow (`followableAt('tower')`), and every
  painting is per player anyway (`setLive`).
- Nothing can be built in it (one keep over the whole map), so it never has realm edits.

**One origin.** In the Swirl, everything about the door is read from `world.swirl.wizard` (`x`, `z`, `door` cells, `box`), which
`swirlland.js` already computes from `WIZARD` and `wizardX(n)`; this plan never repeats a Swirl coordinate. Inside the realm,
everything is relative to `TOWER` in `wizardland.js` (section 5).

## 4. The painting game (pure rules: `src/wizardtower.js`, no imports but `custom.js` and `comingsoon.js`/`pictureworlds.js`)

### 4.1 Paints: twelve plain wools (`src/custom.js`, pure, no imports)

`PAINTS` (index = the number saved on a creature; **append-only**, never reorder):

| i | code | name | wool (block) | hex (= `WOOL_RGB`) |
| --- | --- | --- | --- | --- |
| 0 | r | Red | `WOOL.parkour` (82) | `0xe13c3c` |
| 1 | o | Orange | `WOOL.racer` (142) | `0xff963c` |
| 2 | y | Yellow | `WOOL.electric` (24) | `0xf0c828` |
| 3 | g | Green | `WOOL.grass` (23) | `0x50aa46` |
| 4 | t | Teal | `WOOL.sound` (36) | `0x3cc8b4` |
| 5 | i | Sky Blue | `WOOL.ice` (26) | `0x96dceb` |
| 6 | b | Blue | `WOOL.water` (22) | `0x3c6edc` |
| 7 | p | Purple | `WOOL.toxic` (31) | `0x8c46b4` |
| 8 | k | Pink | `WOOL.pixie` (32) | `0xffafdc` |
| 9 | n | Brown | `WOOL.rock` (25) | `0xa08250` |
| 10 | m | Grey | `WOOL.metal` (30) | `0xaab4be` |
| 11 | x | Black | `WOOL.ninja` (113) | `0x2e2842` |

All twelve tiles are plain (no pattern in the atlas painter: the spec checks each tile is near one colour). `custom.js` stores the
wool **type name** (not the id) and the hex; the `wizard` spec checks the hex against the atlas colour, so there is one truth.
A 13th pot is the **wash jar** (`WASH = -1`, a `B.GLASS` block): it washes a square back to blank canvas.

### 4.2 Floors as data

```js
// Codes: '.' blank (leave the canvas), a-z a paint you must match (table above), A-Z the same paint already painted (given, locked),
// '1'-'3' a free group: any paint, but every square of one group the same. Row 0 is the TOP row.
export const FLOORS = [
  { n: 1, name: 'Flower', w: 4, h: 4, sign: 'Tap a paint pot, then tap the canvas. Copy the picture!',
    rows: ['.yy.', 'yrry', 'yrry', '.gg.'] },
  { n: 2, name: 'House', w: 6, h: 6, sign: 'A bigger picture!',
    rows: ['..rr..', '.rrrr.', 'rrrrrr', '.iono.', '.oono.', 'gggggg'] },
  { n: 3, name: 'Butterfly', w: 6, h: 6, mirror: true, sign: 'Paint the other half, like a mirror!',
    rows: ['.X..x.', 'PPXxpp', 'PKXxkp', '.PXxp.', 'KPXxpk', 'KK..kk'] },
  { n: 4, name: 'Balloon', w: 6, h: 6, sign: 'The ? parts can be any colour you like!',
    rows: ['.1111.', '112211', '112211', '.1111.', '..nn..', '..nn..'] },
  { n: 5, name: 'Guardian', w: 8, h: 7, mirror: true, palette: true, sign: 'Paint my guardian! Its colours will be YOUR creature\'s colours.',
    rows: ['.X....x.', 'X2X..x2x', 'X111111x', 'X1X11x1x', 'X113311x', 'X133331x', '.XX..xx.'] },
];
```

- Squares to paint: 12, 26, 14 (the right half of the butterfly), 24 (balloon) and 34 (the guardian's right outline plus every
  free square). Floor 3 and 5's given halves are their left columns, uppercase, locked (a tap says "This half is done. Paint the
  other side!").
- Floor 5's groups are the palette: **1 = body, 2 = accent (ear insides), 3 = belly**. Floor 4's groups are just for fun (nothing
  saved).
- `wizardcheck.mjs` proves: every row is `w` long, `h` rows, codes known; mirror floors are exact mirrors (lowercase on the right
  = uppercase on the left); each free group has a square; floor 5 has exactly groups 1-3.

### 4.3 The one checker

```js
// cells: one entry per square, row by row from the top: -1 blank, 0..11 a paint. Given squares are already filled in.
// -> { done, right, total, wrong: [i], groups: [paint | null per group] }
export function checkCanvas(floor, cells)
```

- A paint square is right when it holds that paint; a blank square when it is blank; a group is right when all its squares hold the
  same paint (any of the twelve; the groups may share a paint). `done` = all right.
- `wrong` (for the blink): paint squares holding another paint, blank squares that were painted, and in a group the squares that
  differ from the group's most common paint (a group still being painted is not wrong). Empty squares are never "wrong", only
  "not done", so the blink never shows a square the child simply has not reached.
- `HINT = { after: 40, again: 25, blink: 3 }`: after 40 s of play time on a floor (summed `dt` while `game.playing()`) without a new
  right square, the wrong squares blink for 3 s (between their paint and a white outline), then again every 25 s. Nothing else
  helps; nothing is ever failed.
- `palette(floor5, cells)` -> `[body, accent, belly]` paint indices once done.

## 5. The tower (terrain as data, Node-runnable: `src/wizardland.js`, `TERRAINS.wizardLand`)

Realm 48 x 48. A soft cloud floor at y 0 (`B.SWIRL_CLOUD`, scenery), everything else sky. `TOWER` is the one origin:

```js
export const TOWER = { x0: 15, z0: 15, x1: 32, z1: 32,      // outer walls (Wizard Stone); inside x/z 16..31 (16 x 16)
  floors: [1, 9, 17, 25], studio: 33, roof: 46, top: 47 };  // slab y of floors 1-4 (you stand at y + 1, air y + 1 .. y + 7), the studio slab, the roof
```

- **Walls** `B.WIZARD_STONE` y 1..45, roof y 46, a wool cone (`WOOL.mind`) + `B.CRYSTAL` at 47 like the Swirl tower's top.
  Floors are `B.PLANKS`. 2 x 2 `B.GLASS` windows in the east and west walls at y F+3..F+4, `B.LAMP` in the walls.
- **Canvas** in the north wall (z = 15), facing south: squares x `24 - w/2 .. 24 + w/2 - 1`, rows from y F+2 (bottom) up
  (4x4: x 22..25, y F+2..F+5; 6x6: x 21..26, y F+2..F+7; the studio's 8x7: x 20..27, y 35..41). Base block **`WOOL.custom` (137,
  "Canvas Wool")**, a cream linen tile with a faint weave. A `B.PICTURE_FRAME` border round it in the wall.
- **Paint pots**: y F+1, z 16 (the canvas's foot), x 18..29 the twelve paints in table order (the wool block itself, plus a dark
  rim mesh on top so it reads as a pot), x 30 the wash jar (`B.GLASS`). They are one block tall, so the line from the eyes to the
  lowest canvas row passes over them.
- **Painter's mat**: `WOOL.mind` 2 x 2 at x 23..24, z 19..20 (3.5 from the canvas). **Easel**: a model (`studioprops.js`) at
  x 20.5, z 19.5 facing the mat, its picture a canvas texture drawn from `FLOORS` (free groups as a rainbow **?**: group 1 a big ?,
  2 dots, 3 stripes, so the three groups look different).
- **Stairs behind glass**, odd floors on the east side, even floors on the west (so a flight never meets the flight above):
  - East flight: steps at x 30..31, step k (0..6) at z 29 - k with its top at y F+1+k, a last step at z 22 flush with the next slab;
    the next slab has a hole over x 30..31, z 23..29 (head room) with a 1-high glass rail round it on the floor above.
  - The flight is closed off from the room by a `B.GLASS` wall at x 29, z 21..31, y F+1..F+7, with the **stairs door** at its foot:
    x 29, z 30..31, y F+1..F+2. West flights mirror it (x 16..17, glass wall and door at x 18).
  - The door is drawn with `LiveCells` (closed = `B.WIZARD_STONE` in a gold `PICTURE_FRAME` look, open = air) from the saved key
    `wizard:floor<n>`; it never closes on a player.
- **The studio** (floor 5): slab y 33, air y 34..45, a big round window (glass) in the south wall. **The Wizard** (a `world.people`
  guest, look `wizard`) stands at x 24.5, z 26.5 facing north, watching you paint; a rest spot 3 in front of him.
- **Ways back** (`buildWayBack`): the ground floor's in the south wall (x 24, z 31, facing north: you arrive at z 28.5 looking at
  the first canvas) and the studio's in the east wall (x 31, z 26, facing west), so a finished climb never walks down. Keys
  `'wizard'` and `'wizard-top'`; both lead out at the tower door (`stash.up.ret`).
- `world.keeps`: one box over the whole map ("This is the Wizard's studio. No building here!"). `world.rests`: ground floor, studio.
- `world.parts = [{ id: 'studio', live: 'studio' }]`; `world.studio = { canvases: [{ floor, x0, y0, z, w, h }], pots: [...], doors:
  [...], mats: [...], easels: [...] }` (all derived from `TOWER` and `FLOORS`).
- `wizardAim` (`TERRAIN_AIMS.wizardLand`): this floor's mat while its canvas is not done ("🎨 Copy the picture!"), else its stairs door
  ("Up the stairs! ↑"), in the studio the Wizard ("🧙 The Wizard"), after the win the way back.

## 6. Painting in the game (`src/studiolive.js`, `StudioLive` = `LIVE.studio`)

- **State**: per floor an `Int8Array` of squares (given squares filled from `FLOORS`), the brush's paint (`-1` = none yet; kept
  across floors for the session), the hint clock. Never saved, never sent. A floor whose key `wizard:floor<n>` is held is drawn
  finished and locked ("Finished! Up the stairs!"); floor 5 after the design shows your palette.
- **Tapping, clicking, E**: one cast from the eyes (or the finger's ray) against the canvas plane and the pot row, reach 12 (more than
  `REACH` 6, so a child can paint the whole 8x7 canvas from the mat):
  - `near(p)` -> `'Paint!'` when the look ray hits a square of this floor's canvas, `'Dip!'` on a pot, `'Wash!'` on the jar, else
    null. `use(p)` does it (E, a left click, the round action button). `tap(origin, dir)` does the same for a tap anywhere on the
    iPad screen (the T44 hook; it comes before blocks in `tapAt`).
  - Dip: the brush takes the paint (`paintpick` sound, the chip shows a swatch: `🖌️ ● Blue`). Paint: the square gets it
    (`setLive(x, y, z, PAINTS[i].wool block)`, `paintdab` sound); a square already that paint stays. With no paint yet:
    "Tap a paint pot first!"
  - After each change `checkCanvas`; when done: `paintdone` chime, the key `wizard:floor<n>` into `beaten` and `save(true)`, the door
    opens, toast "Lovely! The stairs are open." Floor 5 also stores `studio.paint` (section 8).
  - Floor 5 stays paintable until you have designed your creature: repaint a group and the palette follows ("New colours! I like
    them."), so the child can change its mind before the battle.
- **Hint blink** (section 4.3) uses summed `dt`; at 60 and 20 fps the same (`manual` + `step(dt)` for tests).
- **The brush**: a small brush model held in front of the camera (like the Portal House's Wand), its tip in the brush's paint.
- **The easel card** `#easel` (HUD, top centre, about 96 px, hidden in battles and panels): the same picture as the easel, so the
  child can compare without turning round. Tap it: big for 3 s.
- **Signs**: each floor's `sign` once as a toast when you first reach that floor's mat, nothing else.
- **No shortcut**: placing is refused everywhere (the keep), the glass walls go floor to ceiling, slabs have no holes but the
  stairwells (`wizardcheck.mjs`, section 11).

## 7. The Wizard (the battle and rematches: `src/studio.js`, `createStudio(game, { startBattle, save })` -> `game.studio`)

- **A person** (new `npc.js` look `wizard`: a tall violet pointy hat of stacked boxes with a gold band and a crescent moon, a long
  white beard, a violet robe = shirt + pants colours; **no stars on him**, only the Wizard's star is a star). A `world.people`
  guest, so `gymLive.talk(npc)` / `talkPrompt(npc)` reach `StudioLive`, which calls `game.studio`.
- **Gate** (his words): without `wizard:floor5`: "Paint my guardian first! Then we battle." Without the bridge (a guest who followed
  a friend in): "Bring me every star first! (⭐ n / need)" (`bridgeDone(game.stars)`, or `ally`).
- **His team** (`WIZARD_TEAM`, data in `wizardtower.js`; one creature he made for each of his favourite worlds; moves from
  `movesWith`, the spec checks them):

  | species | type | level |
  | --- | --- | --- |
  | `visionelk` | mind | 82 |
  | `grandtome` | paper | 83 |
  | `loopwyrm` | portal | 84 (+ `portalparty`) |
  | `comethorn` | cosmic | 85 (+ `starrynight`) |
  | `stormwyvern` | drake | 86 (+ `scalestorm`) |
  | `spectrion` | rainbow (last, his own colour) | 88 (+ `colorcarnival`) |

  With 12 stars the last Picture World Bosses stand at about 85-87 (`starTeam`), so he is the hardest yet but only just (the owner
  asked once for easier gyms: question 5).
- `startBattle({ trainer: npc, team, intro, boss: true, xpBoost: 1.5, wizard: { rematch: wins | null } })`. `boss: true` gives the
  Champion's rule: his last creature hangs on once and powers up at half HP (Zenithar-like), and the boss music.
- **Rematches** (owner: "+5 levels after every win", the T28 count): `wizardTeam(wins)` (pure) = every level `+ 5 * wins`, capped
  at `MAX_LEVEL` 100; from the third rematch `rematchMoves` adds a big move like T28. Asked with `ui.ask` like a Boss ("A rematch? My
  team is up to level L now!"). Win: `rematchCubes(n)`; the count is `studio.wins`.
- **Lost**: healed at the studio's rest (`lose: 'stay'`): "A good try! Rest, train, and come back up."
- **main.js**: one guard in `onBattleEnd` so a won Wizard battle never reaches the gym branch (`npc.gym` is undefined):
  `else if (result === 'won' && opts.wizard) { /* studiolive.battleEnded */ }` and `if (opts.wizard) game.studio.lost(npc)` beside
  the Picture World line. The rest happens in `battleEnded` (called for every battle).

**Lines** (kid-sized):
- Intro: "So you are the one who brought my stars back." / "Holding the Swirl together made me so tired..." / "Show me your team.
  Then I will ask you something big."
- He loses: "What a team! You are strong enough."
- Rematch intro: "Back again, my ally? My team has been practising too!"

## 8. The guardian: the Custom type (option 2, recommended)

**Why option 2:** the painted palette is already the creative part; a free design screen (option 1) would have to send a whole
look through saves, duels, trades and play together, and the owner does not want more custom design features. With option 2 the
creature carries **one tiny field** and everything else is a normal species, recoloured.

### 8.1 The six designs (species, all `type: 'custom'`)

Single stage, one of a kind (`legendary: true` + `designed: true`), never wild. Each has its **own new body shape** in
`shapes.js` `SHAPES_CUSTOM` (owner: creatures look unique), built only from `m.body` / `m.accent` / `m.belly` / `m.dark`, plus the
type's gear `'swirlbadge'` (one merged mesh: a small gold swirl badge on the chest, no star).

| id | name | shape | second type | look | base hp/atk/def/spd (total 400) |
| --- | --- | --- | --- | --- | --- |
| `brushtail` | Brushtail | `brushfox` | pixie | a fox whose tail is a big paintbrush, tip dipped in the accent | 90 / 105 / 85 / 120 |
| `palettoad` | Palettoad | `palettefrog` | water | a round toad with a painter's palette on its back, paint-drop spots | 120 / 90 / 110 / 80 |
| `inkwing` | Inkwing | `quillbird` | sky | a bird whose feathers are quills dipped in ink (flies) | 85 / 110 / 80 / 125 |
| `crayonix` | Crayonix | `crayondrake` | drake | a little dragon, its back spikes are crayon tips | 95 / 120 / 95 / 90 |
| `framesaur` | Framesaur | `framesaur` | rock | a gentle dino with a picture frame on its back like a sail | 115 / 95 / 125 / 65 |
| `blotbun` | Blotbun | `blotbun` | slime | a bunny made of one big paint blot, drippy ears | 105 / 100 / 90 / 105 |

`baseXp 200`, `catchRate 0`, `learn: L('custom', second, [[40, 'swirlseal']])`. The `model` gives each design a default palette
(used in the Book before you own one) and the shape; your painted palette replaces the four colours.

### 8.2 The type

- `TYPE_COLORS.custom`: a cream palette with three paint dots (light enough for the dark chip text):
  `'radial-gradient(circle at 30% 35%,#e13c3c 0 10%,transparent 11%),radial-gradient(circle at 58% 30%,#f0c828 0 10%,transparent 11%),radial-gradient(circle at 72% 60%,#3c6edc 0 10%,transparent 11%),#f2ead8'`.
- **Chart** (its own row, the other cells as separate statements; nobody's old cell changes; a defender weak to at most 5):
  ```js
  // A guardian seals a swirl shut, a finished painting beats a sketch, and colour beats plain; paint slides off metal and goes
  // right through a ghost. Water washes wet paint off, toxic goo stains it and time fades it; a sketch cannot spoil a finished
  // painting and a rainbow is made of colours too.
  EFFECTIVENESS.custom = { portal: 2, doodle: 2, normal: 2, metal: 0.5, ghost: 0.5, custom: 0.5 };
  EFFECTIVENESS.water.custom = 2;
  EFFECTIVENESS.toxic.custom = 2;
  EFFECTIVENESS.time.custom = 2;
  EFFECTIVENESS.doodle.custom = 0.5;
  EFFECTIVENESS.rainbow.custom = 0.5;
  ```
  Weak counts today (checked in Node 2026-10-31): portal 3 -> 4, doodle 2 -> 3, normal 3 -> 4, custom 3. Re-check after the Mirror
  merge (section 13).
- **Moves** (ids checked free 2026-10-31; no id is a sound's name): `T1.custom = 'brushdab'` (Brush Dab, 40), `T2.custom =
  'paletteblast'` (Palette Blast, 85, 0.9), `T3.custom = 'quickstroke'` (Quick Stroke, 40, priority 1), `T4.custom = 'freshcoat'`
  (Fresh Coat, raise def); signature `swirlseal` (Swirl Seal, 90, sure, `sig`, learned by all six at 40: "Seals the crack in the
  Swirl, and hits hard"). `BIG_MOVES.custom`: `bigmural` (Big Mural, field), `paintshield` (Paint Shield, shield), `finaltouch`
  (Final Touch, lastword).
- **Effects and sound**: `FX_COLORS.custom = [0xe13c3c, 0xf0c828, 0x3c6edc]`; `TRAVEL.custom` = three paint blobs flying in an arc,
  `IMPACT.custom` = a splat of dots; `SIG.swirlseal` = a ring of paint that closes like a lens. **The attacker's own palette** may
  tint the blobs (one optional line: `fx` reads `c.paint` when the attacker has one). Sound `fx:custom`: a brush swish (noise slide)
  and a soft plop. Paint sounds `paintpick`, `paintdab`, `paintdone` (not move ids).
- **Wool**: `'custom'` appended to `WOOL_TYPES`, `WOOL_ID_OVERRIDE.custom = 137`, name "Canvas Wool" (`BLOCKS[137].name` set after
  the generic loop), a cream linen weave tile. Not placeable (question 10). The atlas tiles after the wools shift by one (computed:
  `tileX` / `tileY`, as when Cube Planets added its wool).
- **Book**: the Custom type's list says "No wild Custom creatures. Beat the Wizard and design your own!"; a design's page says
  "Designed by you" and shows **your** guardian in your colours when you own it, otherwise its default colours and "Designed in the
  Wizard's studio". `legendary` already keeps them last and out of the totals.

### 8.3 What the creature stores: `paint`

```js
c.paint = [body, accent, belly]   // three PAINTS indices (0..11), only on a `designed` species
```

- **custom.js** (pure): `cleanPaint(list, species, SPECIES)` -> the cleaned triple for a designed species (any bad entry -> that
  design's default), `undefined` for every other species. `paintModel(model, paint)` -> `{ ...model, body, accent, belly, dark }`
  (`dark` = body x 0.45). `guardianLevel(party)` = the best team level - 5, at least 50, at most `MAX_LEVEL`.
- **Models**: `buildModel(species, paint)` (second argument optional; only a designed species reads it). Callers that show a real
  creature pass `c.paint`: `battle.js` (ally, friend, foe x2), `riding.js`, `ui.js` (`portrait(species, w, h, silhouette, paint)`,
  the cache key gains the paint; team and box cards), `swapui.js` cards, `book.js` (your own), `multiplayer.js` (the lead).
- **Saves**: party and box are saved as they are, so `paint` is saved. `continueGame` cleans it (`fixPaint(game.party)`,
  `fixPaint(game.box)`, next to `fixTraits`): junk is replaced by the design's default, a `paint` on any other species is dropped.
- **Duels and co-op giants**: `duel.js` `teamOf` adds `paint`, `teamIn` cleans it; `battle.js`'s duel `copy` keeps it (today it
  rebuilds from species/level/moves only). So your friend sees your guardian in your colours. **duel `VERSION` 12 -> 13**: a team may
  now hold species and a chart row an older game does not have (an older game is told kindly, as today).
- **Trades: never.** Your guardian is one of a kind: `cleanCreature` already refuses `legendary`, and `swapui.js` shows its card's
  button dim as "Stays with you" (like your last team creature). **`SWAP.version` stays 2** (no new parcel, nothing new travels).
- **Let go: never.** The box's Let go button is dim "Stays with you" for a designed species (one line in `ui.js`). If one is ever
  missing (a bug, an old device), the Wizard draws it again from the save (`studio.design` + `studio.paint`) when you talk to him.
- **Play together**: `state` gains `leadPaint` (only when the lead has `paint`); `Avatar.setLead(species, paint)`. Old games ignore
  the field and show default colours.
- **Riding**: no (`rideable` does not list the designs; question 9).

### 8.4 The drawing board and the ending

After the first win, once the battle screen is gone (`!game.inBattle`, playing), `StudioLive` opens the **drawing board** panel
`#drawboard` (pauses pointer lock like the team screen): the Wizard's line "You design it!" and six big cards, each a `portrait`
of a design **in your painted palette**, its name, its two type chips and one line. Tap or click a card, then `ui.ask` ("Make
Brushtail your guardian?" Yes / Not now). Yes:
- `makeCreature(design, guardianLevel(party))`, `c.paint = studio.paint`, into the team (or the box when the team is full: "It is
  waiting in your box"), `book` seen + caught.
- `studio.ally = true`, `studio.design = id`; `save(true)`.
- `sound.play('champion')`; `ui.celebrate('🧙 You are the Wizard\'s Ally!', '<Name> guards the Swirl now. The crack is closed!', 10000)`.
- Toasts: "Look! The crack in the Swirl is closing!" / "I can finally come out of my tower. Thank you, my ally!" / "Something
  scribbly is still out there... I will need your help again." (chapter 3's hook) / "Rematch me any time!"
- +20 Capture Cubes once.

"Not now" closes the board; talking to the Wizard opens it again until you chose (the win is kept: `studio.won = true`).

**In the Swirl afterwards** (stage C): the Wizard stands on his island in front of his open door (a guest person: "I'm out! The air
is lovely."), and **your** guardian circles slowly round the top of his tower (one model with your paint, per viewer: a friend sees
their own, or none).

**Title**: "Wizard's Ally" (STORY.md's words; question 4). Shown in the pause screen under your name (🧙) and in the Book's trainer
line, next to Champion.

### 8.5 The save field `wizard`

```js
wizard: { won: false, ally: false, paint: null | [b, a, l], design: null | 'brushtail', wins: 0 }
```

`loadStudio(saved)` (in `studio.js`) keeps only booleans, a clean paint triple, a known designed species, a whole `wins` 0..999;
old saves have none (= all empty). Floors are `beaten` keys `wizard:floor1..5` (strings, kept as they are, like Picture World keys).
Three lines in `main.js` (`snapshot`, `startNew`, `continueGame`), like `records`.

## 9. iPad (the fixed-slot rule)

- No new button. The round action button says **Paint!** / **Dip!** / **Wash!** (from `near`); a tap anywhere on the screen paints
  or dips what is under the finger (`tap` hook, reach 12), the main way on an iPad: drag to look, tap the pot, tap the squares.
- Place stays where it is and dims with the keep's words; Ride dims with `noRide: 'No riding inside the tower!'`.
- The easel card `#easel` sits top centre, clear of the joystick (bottom left) and the buttons (bottom right).
- The drawing board's cards are at least 120 px, two rows of three in landscape, scrolls in portrait.
- Taps are movement-based (`TAP_MOVE`), so a kid who presses and holds still paints once.

## 10. Shipping closed and the realm def

```js
/* ==== Wizard ==== */
if (worldOpen('wizard')) REALMS.wizard = pictureRealm({ id: 'wizard', name: "Wizard's Tower", seedSalt: 0x3172d, size: [48, 48],
  terrain: 'wizardLand', arrive: [24, 28], arriveYaw: 0 /* yaw 0 looks toward -z: north, at the first canvas (as buildWayBack's stand) */, biome: 'wizard', entrance: 'tower',
  spawns: { wizard: [], cave: [] }, wild: { max: 0, every: 60 }, walk: [B.PLANKS], noRide: 'No riding inside the tower!',
  look: { sky: 0xd8c8ff, fog: [40, 120], time: null, weather: false, light: 1, still: true, stars: false },
  clock: "🧙 Wizard's Tower", travelText: 'Up to the studio...', travelIcon: '🧙', enterText: "Welcome to the Wizard's studio!",
  arriveHint: 'Tap a paint pot, then tap the canvas. Copy the picture!', doorName: 'Way back',
  backText: 'You stepped out of the tower, back into the Swirl.',
  noHomeText: "No homes in the Wizard's studio!", followText: 'Go up too',
  askFollow: n => `${n} went into the Wizard's tower. Go too?`, joined: n => `You followed ${n} into the Wizard's tower!`,
  guestNote: n => `Follow ${n} when they go into the tower!` });
TERRAINS.wizardLand = wizardLand; TERRAIN_AIMS.wizardLand = wizardAim;
/* ==== end of Wizard ==== */
```

Version 1; nothing can be built, so
nothing is ever converted. Opening for everyone = add `'wizard'` to `OPEN_NOW` (comingsoon.js needs no other change).

**The door in the Swirl** (`portal.js`, the existing `inWizard` / `swirlUse` / `swirlPrompt` / `swirlAction` and `swirlUpdate`):
- Sealed (not `towerOpen`): today's toast, with the count when the tower is open in this build: "The Wizard is inside, holding the
  Swirl together. Bring him stars! (⭐ n / need)".
- Open: the door cells (`world.swirl.wizard.door`) are drawn as `B.PORTAL` with `setLive` and get a `DoorGlow` (added live in
  `swirlUpdate` when `towerOpen` turns true, e.g. when the Portal House star, won inside the Swirl, was the last one). Prompt "The
  Wizard's tower · tap to go in", action "Step in!", use = `realms.enter('wizard', { back: stand })` with `stand` 2 west of the door
  facing east (derived from `world.swirl.wizard.door`). A guest uses `realms.guestEntrance('tower')`.
- The first time the bridge is whole in a session: toast "The star bridge is whole! Cross it to the Wizard's tower!" and
  `sound.play('champion')`.
- **The Swirl's guide** (`swirlland.js` `swirlAim`): after the open frames and before the door home, `towerAim(world, p, game)` (from
  `wizardtower.js`, pure): "🧙 Wizard's Tower ↑ 40m" to the door's stand, while `towerOpen` and not yet `ally`.

## 11. Proofs: bots and Node checks (`tests/wizardcheck.mjs`, Node, no browser)

- **Canvases**: the data checks of 4.2; `checkCanvas` on the target = done; on the target with one square changed = not done, that
  square in `wrong`; free groups with two paints = not done, the minority listed; with any one paint = done.
- **Naive kid fails**: a bot that taps random squares with random pots (seeded, 600 taps per floor, 200 seeds) never finishes
  floors 2-5 and finishes floor 1 in under 1 % of seeds. A "paints everything one colour" bot never finishes any floor.
- **Skilled kid wins**: reads the picture, dips each paint once and paints its squares: done in `squares + paints` taps on every
  floor; for floors 4-5 with random group paints too.
- **No shortcut** (terrain on a stand-in world, like `portalcheck`'s `reachable`): from the arrival, walking, 1-block steps and jumps
  (1.25 up, 4 across) through air cells, with every stairs door closed: no cell of floors 2-5 is reachable; with doors 1..k open,
  exactly floors 1..k+1 are. No block can be placed anywhere (`editAllowed` false on every cell). The canvas squares and pots are
  reachable by the cast (reach 12) from the mat.
- **Tap geometry**: casts from the mat at every square's centre hit that square; the hint clock at 60 and 20 fps blinks at the same
  summed time.
- **Bridge**: `bridgeNeed` with all open = every bridge world; with `gravity` closed = without it; with a stand-in `removed: true`
  world = without it; `bridgeDone` true only with every needed star; `towerOpen` true for an ally whatever the stars.
- **Wizard team**: `wizardTeam(0)` is `WIZARD_TEAM`, `wizardTeam(n)` levels +5n, never above 100; moves as `movesWith` gives.
- **Paint**: `cleanPaint` on junk, on a non-designed species, on a good triple; `paintModel` colours.

## 12. Spec `tests/specs/wizard.mjs` (`WIZARD_ONLY=data|chart|canvas|land|bridge|paint|battle|design|travel|ipad|pair|old|closed|shots`)

- `data`: the type, 6 designs (`legendary`, `designed`, own shapes not used by any other type, gear one merged mesh, models animate
  with and without paint), moves (4 + sig + 3 big, names unique), `TRAVEL` / `IMPACT` / `FX_COLORS` / `SIG.swirlseal` / `fx:custom`,
  wool 137 "Canvas Wool", `PAINTS` hex = atlas colours and plain tiles.
- `chart`: the custom row, the five separate cells, every old cell unchanged (against `tests/fixtures/chart-before-wizard.json`,
  recorded before the build), weak counts <= 5.
- `canvas`: `wizardcheck.mjs`'s canvas and bot parts run in the browser module graph too.
- `land`: `wizardLand` on a stand-in and in the game; the BFS; keeps everywhere.
- `bridge`: Swirl with a seeded save: door sealed with n-1 needed stars; with all needed stars open (glow, prompt, toast); the Portal
  House star won inside the Swirl opens it live; with `gravity` closed (`__pcWave15` off + not in `OPEN_NOW`) its stone is a cloud
  and the door opens without it; an ally's door stays open.
- `paint`: real keys and clicks through the game loop (pointer lock off where needed): floor 1 painted with E and clicks, a wrong
  square blinks after 40 s of stepped play time, the door opens, a reload keeps the floor finished and the door open; floors 2-5 by
  the live part's `manual` + `step`; floor 5's palette in the save; repainting floor 5 changes it.
- `battle`: the Wizard's gate words (no floor 5; a guest without stars), a forced win, `wizardTeam` levels in the battle, a loss
  rests you in the studio, rematch ask, `wins` counts.
- `design`: the board opens after the battle screen, six cards in your palette, a choice -> team member with `paint`, Book page,
  celebrate, `ally` true, a reload keeps it, the guardian can't be let go or offered, a missing guardian is drawn again.
- `travel`: Swirl -> tower -> way back (both doors come out at the tower door), a save inside loads inside, `realmUp`.
- `ipad`: emulated iPad: taps on pots and squares (the `tap` hook), the action button's words, Place and Ride dim with words, the
  easel card, the board's cards.
- `pair`: two browsers: the guest follows into the tower, paints its own canvas (the host's squares unchanged), a guest without stars
  gets the Wizard's star words; a duel shows the guardian in its owner's colours on both screens; the lead avatar is painted.
- `old`: a save without `wizard`; junk `paint`; `paint` on a non-designed species dropped; a duel from VERSION 12 refused kindly.
- `closed`: without `?preview` every star does nothing new: today's door words, `REALMS.wizard` undefined, the Swirl's version 5.
- `shots`: each floor, the studio, the board, the celebrate screen, the guardians in three palettes (`tests/screenshots/w19-*.png`).

Existing specs touched: `roster` (a type whose creatures are all `designed` is checked by the `wizard` spec, not by the 7-per-type
rule: one filter line), `pvp` / `traits` read `VERSION` (no change needed). `fx`, `moves`, `big-moves`, `book` pick the new type
up by themselves.

## 13. Meeting the Mirror wave (built in parallel; merge points)

This plan builds and passes **without** the Mirror wave. Where both touch the same file:
1. **`pictureworlds.js`**: Mirror appends its `PICTURE_WORLDS` entry (the 13th star) and an off switch. This plan appends
   `bridgeNeed` / `bridgeDone` after `loadStars`. If Mirror's switch is not `removed: true` (e.g. it filters `BRIDGE_WORLDS`, or sets
   `bridge: false`), change only the `w.removed !== true` condition (or drop it). Never write 12 or 13 anywhere.
2. **`swirlland.js`**: Mirror may add a frame spot and moves the island through `wizardX(BRIDGE_WORLDS.length)` (13 stones: island
   x 148, keep box up to x 158 < 160). This plan adds only two lines at the tail of `swirlAim` (the tower aim before the door home)
   and reads `world.swirl.wizard` for the door. Merge: keep both sets of lines.
3. **`portal.js` `swirlUpdate`**: this plan changes the bridge loop's `lit` rule (cloud stones for worlds not open) and adds the door
   glow. If Mirror's wave also edits that loop, keep its frame code and this rule.
4. **`realms.js`**: two separate `/* ==== Mirror ==== */` and `/* ==== Wizard ==== */` blocks; both append to `TERRAINS` /
   `TERRAIN_AIMS`.
5. **`blocks.js`**: this wave takes **137** only; Mirror 138-139. Both may append to `WOOL_TYPES`; order does not matter (tiles are
   computed), the ids must differ.
6. **`species.js` / `fxrecipes.js` / `sound.js` / `shapes.js`**: append-only sections per type. After the merge, re-run the chart
   check: the Mirror type's row could raise portal / doodle / normal's weak counts; if one passes 5, move that Custom cell to
   another defender (question-free: any type with < 5).
7. **Star counts in words** (`pictureboss.js`'s "(n/12)" toast) are the Mirror wave's; this plan uses `bridgeNeed().length` only in
   its own words.
8. If Mirror ships behind `LATER`, `bridgeNeed` leaves it out outside `?preview` by itself; in `?preview` its star is needed.

## 14. Files

New:
- `src/custom.js` (pure): `PAINTS`, `WASH`, `DESIGNS` (the six ids in board order), `cleanPaint`, `fixPaint`, `paintModel`,
  `guardianLevel`.
- `src/wizardtower.js` (pure; imports `custom.js`, `pictureworlds.js`, `comingsoon.js`): `FLOORS`, `HINT`, `checkCanvas`, `palette`,
  `WIZARD_TEAM`, `wizardTeam`, `towerOpen`, `towerAim`, `floorKey(n)` = `wizard:floor<n>`, `WORDS` (all the lines above).
- `src/wizardland.js` (Node-runnable): `TOWER`, `wizardLand`, `wizardAim`.
- `src/studiolive.js`: `StudioLive` = `LIVE.studio` (canvases, pots, brush, doors with `LiveCells`, hint, easel card, sign toasts,
  the Wizard's talk / gate / battle / rematch hooks, the board's opening, `battleEnded`, `manual` + `step`, `info()`).
- `src/studio.js`: `createStudio(game, { startBattle, save })` -> `game.studio` (state, `loadStudio`, `toSave`, `won` / `lost`,
  `design(id)`, the drawing board panel, the ending).
- `src/studioprops.js`: the easel (canvas texture from `FLOORS`), pot rims, the brush, the Wizard's island guardian circle.
- `tests/wizardcheck.mjs`, `tests/specs/wizard.mjs`, `tests/fixtures/chart-before-wizard.json`.

Changed (and why):
- `src/pictureworlds.js`: `bridgeNeed` / `bridgeDone` (2 lines).
- `src/realms.js`: `REALMS.wizard`, `TERRAINS` / `TERRAIN_AIMS`.
- `src/portal.js`: the door (prompt, action, use, glow), cloud stones, the bridge-whole toast.
- `src/swirlland.js`: `swirlAim` asks `towerAim` before the door home (2 lines).
- `src/gymlive.js`: `LIVE.studio`.
- `src/npc.js`: look `wizard`.
- `src/main.js`: `createStudio`, the save field (3 lines), `fixPaint` beside `fixTraits`, the `onBattleEnd` guard and lost line.
- `src/species.js`: the Custom section (type colour, T1-T4, moves, `BIG_MOVES.custom`, chart lines, six species),
  `buildModel(species, paint)`.
- `src/shapes.js`: `SHAPES_CUSTOM` (six builders) and the `swirlbadge` gear.
- `src/fxrecipes.js`, `src/sound.js`: custom effects, `fx:custom`, the three paint sounds.
- `src/blocks.js`: wool `custom` = 137, its tile, its name.
- `src/battle.js`: models with `paint`; the duel `copy` keeps `paint`.
- `src/duel.js`: `teamOf` / `teamIn` carry `paint`; `VERSION` 13.
- `src/multiplayer.js`: `leadPaint` in `state`, `setLead(species, paint)`.
- `src/riding.js`: `buildModel(c.species, c.paint)` (generic, harmless).
- `src/ui.js`: `portrait(..., paint)` + cache key; cards pass `c.paint`; Let go dim for a designed species; the `#easel` card element.
- `src/swapui.js`: a designed creature's card says "Stays with you".
- `src/book.js`: the Custom list line, "Designed by you", your colours.
- `index.html` / `style.css`: `#easel`, `#drawboard`.
- `tests/specs/roster.mjs`: the designed-only type filter.
- Docs: `README.md` (type chart, the Custom type, the tower), `STORY.md` (the table's wave numbers; one line: the guardian you
  designed circles the tower), `ROADMAP.md` (wave 18 -> 19, decided options, "Built"), `CLAUDE.md` (code map rows, a "Wizard's
  Tower" key-ideas paragraph, the save field `wizard`, the creature field `paint`, duel `VERSION` 13, types 46).

Versions: **`WORLD_VERSION` stays 20** (no main-world block changes). **`REALMS.swirl` stays version 5** (the door and the cloud
stones are `setLive`). **`REALMS.wizard` version 1.** **duel `VERSION` 12 -> 13.** **`SWAP.version` stays 2.** `HS.VERSION` unchanged.
No save-format version: the new field `wizard` and the creature field `paint` are optional and cleaned on load.

## 15. Build in three stages (sequential builders)

**Stage A: the Custom type and the paint field** (no tower yet; nothing a player can reach). `custom.js`; `wizardtower.js`'s pure
parts (`FLOORS`, `checkCanvas`, `palette`, `WIZARD_TEAM`, `wizardTeam`); `bridgeNeed` / `bridgeDone`; the type in `species.js`,
`shapes.js` (six shapes + gear), `fxrecipes.js`, `sound.js`, wool 137; `buildModel(species, paint)` and every caller; `paint` in saves,
duels (VERSION 13), play together, Book, team / box / trade cards; the roster filter. Proofs: `wizardcheck.mjs` canvases, bots,
paint, team; spec `data`, `chart`, `canvas`, `old`; `--fast`, `roster`, `moves`, `big-moves`, `fx`, `book`, `pvp`, `traits`, `swap`
pass. Screenshot the six designs in three palettes for the owner.

**Stage B: the tower** (behind `?preview`). `wizardland.js`, `REALMS.wizard`, `studiolive.js` without the Wizard's battle (he only
says his gate words), `studioprops.js`, look `wizard`, `portal.js` door + cloud stones + toasts, `swirlAim`'s tower aim, `LIVE.studio`,
the `#easel` card. Proofs: `wizardcheck.mjs` terrain BFS and tap geometry; spec `land`, `bridge`, `paint`, `travel`, `ipad`,
`closed`; `swirl`, `realms`, `realms-together`, `picture-worlds`, `comingsoon`, `touch` pass.

**Stage C: the Wizard and the ending.** `studio.js` (save field, battle, rematches, board, celebrate, ally, title, redraw), the
`main.js` battle-end lines, the Wizard and your guardian on the island in the Swirl, docs. Proofs: spec `battle`, `design`, `pair`,
`shots`; the whole `wizard` spec at 60 and 20 fps where it steps; then the full suite. Then the owner plays it in `?preview`.

## 16. Owner questions (each with the default the builders use, so nothing waits)

1. **Calm painting or "Splat!"?** Default: **calm tap-painting as designed** (section 1); "Splat!" (thrown paint with a drop) is
   ready to add as a fourth stage.
2. **Which stars open the bridge?** Default: **the stars of the worlds open for everyone** (Cube Planets does not count until it
   opens; in `?preview` every star counts). Alternative: wait for every world (then nobody reaches the Wizard while any world is
   behind `?preview`).
3. **Design option 2, six designs (Brushtail, Palettoad, Inkwing, Crayonix, Framesaur, Blotbun), colours from floor 5, nothing
   else to choose?** Default: yes. (A 7th design, or a part choice such as ears or a tail, is possible later, but the owner said no
   more custom design features in chapter 3.)
4. **A title?** Default: **"Wizard's Ally"** (🧙), shown like Champion.
5. **How hard is the Wizard?** Default: his last creature level 88 (team 82-88), +5 every rematch win up to 100, the Champion's
   "hangs on once" rule. Easier option: start at 80.
6. **Your guardian's level?** Default: your best creature's level - 5 (at least 50).
7. **Can it be traded or let go?** Default: **no**, it stays with you (one of a kind, like Zenithar); the Wizard redraws it if it is
   ever missing.
8. **Repaint later?** Default: **no** (floor 5 can be repainted until you choose a design; after that the colours are final).
9. **Can you ride your guardian?** Default: no (traits unchanged). Easy later: list the designs as rideable.
10. **Canvas Wool in the Blocks panel?** Default: no (like the newest wools).
11. **A Studio Run time trial** (paint all five canvases against the clock, medals in `records`)? Default: not now.
12. **Is beating the Wizard the end of chapter 2 on screen?** Default: yes, the celebrate screen says "You are the Wizard's Ally!"
    and the next toasts hint at the Scribble; missions, rematches and every world stay open.

## Orchestrator's reconciliation with wave 18 (2026-10-31)

- Wave 18 (`plans/wave18-mirror.md` §8) **pins the Wizard's island at x 142** (`WIZARD.x`; `wizardX(n)` returns it for any n) and
  spreads 12 or 13 stones over the same span (`stoneBox(i, n)`). This plan reads the island from `world.swirl.wizard`, so nothing
  changes here; ignore the "x 148" note in §13.
- Wave 18's remove switch is `REMOVED` / `worldRemoved(id)` in `comingsoon.js`, and a removed entry carries `removed: true,
  bridge: false`, so `bridgeNeed()` above works as written (the `removed` check is belt and braces).
- **Which stars open the tower: this plan's rule wins** (only worlds open for everyone, `bridgeNeed`). Wave 18's "every star of
  `BRIDGE_WORLDS`" line is superseded; the HUD may still show x / 13 for the stones.
- Both waves append to `species.js` / `shapes.js` / `fxrecipes.js` / `sound.js` / `README.md`: after both type stages are merged,
  re-run the at-most-5-weaknesses check (spec `roster` / both waves' `data` parts).
