# T49 · 🏰 Knight type and the Castle (plan, not built yet)

Read `CLAUDE.md` (above all "The people and their preferences": the way to a Picture World Boss must be a fun, **unique**
skill challenge; aim, dexterity, timing and directional tactics beat puzzles; never repeat another world's kind of
challenge), `ROADMAP.md` "Types for later" (the Knight entry this plan starts from), `STORY.md` "The Picture Worlds",
`plans/T40.md` (the Picture World base: `pictureRealm`, `kit`, `buildWayBack`, `placeBoss`, `placeCrew`, `world.parts`,
the gymLive hooks `near` / `use` / `aim` / `talkPrompt` / `battleEnded`), and as house style `plans/T43.md` (three skill
games, a pure module with fixed sub-steps, keys + gate), `plans/T45.md` (a world as data, a pure rule module, model
players in the spec) and `plans/T48-surprise-party.md`.

**Build this in a fresh session.** The plan is written so a session that never saw this conversation can do it.

**What the child does:** steps out of the Swirl's peach frame (the old `secret3`, now **Castle 🏰**) onto a meadow in
front of a storybook castle: grey walls, round towers with pennants, a moat, and the **drawbridge pulled up**. A herald
by the moat says: "Show you are brave and the drawbridge comes down!" On a round **Shield Stone** the child holds up a
knight's shield while the castle's practice catapults lob squishy pumpkins and suction-cup arrows from all round:
**push the stick toward the danger** to block, **Jump to hold the shield over your head** when a shadow grows on the
stone. Block enough and, with a trumpet, the drawbridge comes down. Inside, in the **Tilt Yard**, the child climbs onto
an armoured horse and **jousts** against a wooden practice knight on a trolley: gallop down the lane and **steer your
lance tip onto the gold star** on his shield as he comes at you, the horse bobbing all the while. A bullseye knocks him
off his trolley with a clang. Between the courtyard and the Tilt Yard grows a **hedge maze** (middle difficulty: a few dead ends and loops, a couple of
minutes). Two challenges of three rounds each, the two helpers, and the keep's portcullis rises: in the
**throne room** beside the empty throne waits **Sir Clanksalot**, the Castle Champion, with the star.

**Story (one paragraph for `STORY.md`):** The Wizard built a castle for his toy knights to practise in, for a grand
tournament. When he went away the drawbridge stayed up and nobody ever came. The knights kept training every day, and
Sir Clanksalot still waits in the throne room for a challenger brave enough to block the pumpkins and win the joust. Beat him and the
castle's star goes onto the bridge.


## Owner's answers 2026-10-28 (the plan below follows them)

1. **Frame:** the Castle takes `secret3`; the Portal Lab moves to `secret4` (`plans/T47-portal-lab.md` updated).
2. **A real hedge maze, middle difficulty**, on the way: it is the only way from the courtyard into the Tilt Yard. A few dead
   ends and loops, through in a couple of minutes, no hidden switches. The terrain check proves it: solvable, the shortest path
   in a middle band, a fixed number of dead ends, at least two loops. The guide only helps gently inside it (section 2.5).
3. **The catapults throw at you:** OK.
4. **No "trials" in the game's words.** Two challenges, called by their own names: **Shield Up!** and **the Joust**.
5. **Soft pumpkins:** no damage and nothing red, no red flash, nothing that reads as blood. A hit is "Splat! Yuck, sticky!":
   orange and green goo blobs at the screen edge and a squelch.
6. **The lance:** the stick (mouse / a drag nudges it), as planned; the owner gives feedback after playing.
7. **The drawbridge and the portcullis are physical:** when ANY player in the world lowers the drawbridge (or raises the
   portcullis), it is down / up for everyone there. Multiplayer will become one shared world. Over the play-together channel:
   a small `castle` message with the castle's gate state; the host owns it (like realm edits: guests send what they opened, the
   host merges and sends the state to everyone), a guest that joins gets the current state. Your own saved keys still record
   only what YOU won (section 8).
8. **The castle's own horse:** fine.

---

## 0. The skill challenge, and why no other world has it

| World | What your body does | What you judge |
| --- | --- | --- |
| Pirate Seas | aim a cannon / swing on a rope, hold and let go | range, a swing's phase, where a boat will be |
| Ball Stadium | run, kick, jump, throw | power (the ring), the top of the jump |
| Race Track | drive a kart | the racing line |
| Funfair | bumper car, trampoline, carousel lanes | getting behind a car, bounce height, lane by reaction |
| Atlantis | swim, coil and lunge | the distance to a fleeing fish |
| Portal House | place swirls, fall and fling | where to put a swirl, the drop height |
| Sketchbook | steer the pencil with your view for 8-21 s | a smooth path |
| Surprise Party (T48) | whack, run under jacks, drop a crane, whack-a-jack | a pendulum's moment, a shadow, a drop moment, "not that one" |
| Shadow Dojo / Obstacle Course / Echo Gym | sneak / jump / step on pads | being unseen / reach / a sequence |
| **Castle: Shield Up!** | **stand your ground and turn a shield toward what is coming** (the stick points the shield; Jump = over your head) | **which side the next one comes from, and which comes first** (directional tactics under a warning clock) |
| **Castle: The Joust** | **ride a galloping horse and hold a lance tip on a moving star** (the stick moves the tip, the horse bobs it) | **steadiness against the bob, and reading where the star will be at the one moment you meet** |

- **Shield Up! is defence.** No world asks the child to *block*. Everything else is attack or movement. Here you do not
  move at all: you stand on the stone and the danger comes to you from twelve directions, behind you too. The skill is
  spatial awareness (a ring of lights and pointers round the crosshair say where), reaction (a 1.3-2.5 s warning) and
  order (two at once from different sides: block the nearer one first, then swing round). That is the owner's
  "directional tactics" in its purest form. Overhead throws add a second axis (Jump = shield up, but then your sides
  are open: never both at once, the schedule keeps them apart).
- **The Joust is precision under motion with one moment of truth.** It is not the Pirate swivel cannon (you aim where
  you look, then *hold for range* and *choose when* to fire) and not Doodle (a long continuous steer of a path with
  your view). Here you do not choose the moment: the meeting comes at a fixed time, the horse's gallop rocks your aim,
  the target moves on the shield, and you only steer a small lance tip with the stick. A clang or a bullseye at the end
  of every 3-4 s gallop; the comedy of the wooden knight tumbling off is the reward.
- **The ROADMAP's catapult is turned round.** A catapult that launches *you* over the wall is the Pirate cannons again
  (an arc launch). Here the catapults are the castle's practice machines and they throw pumpkins *at* you: the
  catapult stays (the child sees them swing and creak) but the challenge is new.
- **The ROADMAP's hedge maze is not a puzzle here.** A maze is the kind of puzzle the owner moved away from. The Castle
  has a **hedge garden** (clipped hedge rooms, topiary, flower beds) where the wild Knight creatures stand guard: a calm
  place to explore, catch, and find Squire Pip's horse. A real maze is open question 2.
- **Never a fail.** A pumpkin that gets through is a soft "Splat! Yuck, sticky!" (orange and green goo blobs on the
  screen edge for a second and a squelch; owner 2026-10-28: no damage, never anything red that could read as blood). A missed lance is a "Whoosh!". A round that ends short of its number says "So close! Again!" and
  starts again; after two short rounds the kind help comes in (section 3.4).
- **Short:** a Shield Up! round is 25-40 s, a joust round is four passes of about 5 s each. Six rounds in all, each
  saved at once, so even a short visit leaves progress.

---

## 1. Base APIs used (and the few generic lines outside the castle files)

| Base piece | How this task uses it |
| --- | --- |
| `pictureRealm` (realms.js) | `REALMS.castle` (section 2.1) |
| `kit`, `flatLand`, `buildWayBack`, `placeBoss`, `placeCrew` (picturelands.js) | the meadow, the frame home, the throne-room Boss stand, the two helpers |
| `addBoss` (pictureboss.js), `crewLeft` / `crewText` | Sir Clanksalot with `gate(game)` and two crew (section 6) |
| `world.parts` -> `LIVE.castle = CastleLive` (gymlive.js, one import + one line) | the stance, the throws, the steed, the practice knight, drawbridge, portcullis |
| gymLive `near` / `use` / `aim` / `talkPrompt` / `battleEnded` | Shield! / Stop / Mount! / Charge!; the guide; clearing the round keys after the star battle |
| `Player.carry` with `steer(wx, wz, analog, space)` (T43 line in player.js) | the stance on the Shield Stone and the steed in the Tilt Yard are duck-typed carry objects (like the Funfair's bumper car) |
| `LiveCells` / `setLive` | the drawbridge deck, the raised drawbridge and the portcullis (never world edits, never inside the player) |
| `HOUSE_PROP` (250, `hidden`, solid, never drawn) | the solid cells behind the raised-drawbridge mesh and the portcullis mesh (no new block id needed) |
| `ui.setScore`, `ui.celebrate`, `lose: 'stay'`, `world.rests` | the chip, the star, a lost Boss battle stays in the throne room |
| `fairHelp(misses)` (fairgames.js, pure, no imports) | the kind help after two short rounds (imported by `siege.js` / `joust.js`, which stay Node-runnable) |
| `wildafter.js` `AFTER_CHECKS` | `castle: g => star(g, 'castle') \|\| castleState(g).n >= 3` |
| `comingsoon.js` | the Castle ships behind `?preview` (section 9) |

**Generic lines outside the castle files** (each marked `// T49`, written so a merge keeps others' lines):
- `main.js`, mouse move with pointer lock and `touch.js` drag-to-look: `if (game.player.carry?.look?.(dx, dy)) return;`
  before the view turns. A ride may take the look input (the joust's lance tip). Rides without `look` are unchanged.
- `touch.js` `setButtons`: an optional `jump` word (`jump: 'Shield'`), shown on the Jump button the way `swim` shows
  "Swim" (T41). The button never moves or hides (T39c rule). The existing `sky` / `swim` cases stay as they are.
- `ui.js`: `ui.setPointers(list | null)`: up to 3 small arrows round the crosshair, `{ angle, colour, size }` (angle =
  where the danger is, relative to the view; 0 = straight ahead). One `#pointers` element, written only on change.
  Generic: any later part may use it.
- `creatures.js`: `GAITS.sentry` (section 7.4), next to `hopaway` / `blink` / `dash` / `gift`.
- `spawnrules.js`: condition `guardpost` = the nook spots with its own Book words (section 7.4).
- `npc.js`: `look: 'knight'` and `look: 'squire'` (section 6).

`WORLD_VERSION` unchanged (the main world does not change). Duel `VERSION` unchanged (no battle rule changes). The Swirl
keeps its version (the frame is drawn with `setLive`, section 9).

---

## 2. The Castle (realm `castle`, `src/castleland.js`, data + `castleLand(world, def)`, Node-runnable)

Like `doodleland.js` / `pirateland.js`: imports only `blocks.js`, `picturelands.js` and its own pure modules, needs only
a world with `W / D / data / ground / index / inBounds / get`, so the spec runs it on a stand-in in Node.

### 2.1 The realm

```js
REALMS.castle = pictureRealm({ id: 'castle', name: 'Castle', seedSalt: 0xca57, size: [160, 160], terrain: 'castleLand',
  arrive: [80, 153], biome: 'castle', walk: [B.GRASS, B.GRAVEL],
  spawns: { castle: CASTLE_SPAWNS, castleMeadow: MEADOW_SPAWNS, cave: [] },
  zoneNames: { castle: 'The Castle', castleMeadow: 'Castle meadow' },
  look: { sky: 0xbfe0ff, fog: [50, 150], time: null, weather: false, light: 1, still: true, stars: false },
  clock: '🏰 Castle', travelText: 'Riding in...', travelIcon: '🏰', enterText: 'Ta-ta-taa! Welcome to the Castle!',
  arriveHint: 'Stand on the Shield Stone and press Shield! Block the pumpkins to bring the drawbridge down.',
  noHomeText: 'No homes in the Castle! Build your home in your own world.', followText: 'Ride in too' });
TERRAINS.castleLand = castleLand; TERRAIN_AIMS.castleLand = castleAim;
```

`world.realmBiome(x, z)` = `'castle'` inside the castle keep box (section 2.4), else `'castleMeadow'`.

### 2.2 The layout (as built; ground top G = 10, you stand at y 11; 1 char ~ 4 blocks)

```
z 14  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ moat (x 27..133, z 15..109, round the walls) ~~~~~~~~~~~~~~~~~~~~~~~~~
z 20  T==================================================================================T  T = corner tower 9 x 9
z 22  | strip | KEEP x 44..60   | TILT YARD x 61..126, z 22..50 (sand x 62..117, z 26..46)       |
z 30  |       | Great Hall y 11 |   your lane z 30..34 (centre 32.5), pads x 63..65 / 115..117     |
z 36  |       | stair to y 18   |   tilt barrier z 36, x 66..116                                  |
z 40  |       | THRONE ROOM     |   knight's lane z 38..42 (centre 40.5); bleachers z 44..46       |
z 50  |       |==[portcullis]== |================================================================|
z 51  | GARDEN x 34..60        |  hedge row z 51..52 (x 61..101, squire gate x 63..64)  | maze exit x 111..113 (z 52)
z 53  |   flowers, 3 topiary   |  COURTYARD x 61..101, z 53..102                        | HEDGE MAZE x 102..126
z 70  |   knights, benches     |   well, three stalls                                   |   z 52..96, 6 x 11 cells
z 90  |                        |                                         maze entrance  <=| x 102, z 89..91
z 98  |                        |====[ GATEHOUSE x 72..88, z 98..104, roof y 22 ]====  stairs x 89..100, z 101..102 (to the roof)
z104  T==================================================================================T  walls y 11..25 (2 thick)
z105  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ moat ~~~[ DRAWBRIDGE x 78..82, z 105..109 ]~~~~~~~~~~~~~~~~~~~~~~~~~~~~
z110  ........................................ meadow (the practice field keep x 58..103, z 110..150) .........
z115           . tower k11      (k0 = the catapult on the wall top over the gatehouse)      . tower k1
z130   tower k9 .       ( Shield Stones (76.5, 130.5) and (84.5, 130.5) )       . tower k3     (12 spots, ring r 18)
z148           . tower k7            . tower k6            . tower k5
z156  .............................. [ way-back frame (80, 156), arrival (80.5, 153.5) ] Herald Hugo (84, 151) .....
```

| Part | Cells (world) | Blocks |
| --- | --- | --- |
| Meadow | the whole map y 10 (grass, dirt, stone); ten trees and flowers outside the keeps | old blocks |
| Moat | ring x 27..133, z 15..109 outside the walls: water y 8..9 (its top one below the grass), stone y 7 | `WATER`, `STONE` |
| Walls | x 32..128, z 20..104, 2 thick, y 11..25 (so tall that nobody walks along them: from the gatehouse roof, y 23, they are 3 too high), crenels y 26 | `STONE_BRICKS` |
| Corner towers | 9 x 9 in each corner, y 10..29, crenels y 30, a knight-wool roof y 31..34 | `STONE_BRICKS`, knight wool |
| Gatehouse | x 72..88, z 98..104, solid to y 22 (the walls run on over it at z 103..104), tunnel x 78..82, y 11..15; Archer Wren on the roof (85.5, 23, 101.5); stairs x 89..100 along the south wall (x 100: y 11 .. x 89: y 22) | `STONE_BRICKS` |
| Drawbridge | deck x 78..82, y 10, z 105..109 (`PLANKS` with `LiveCells` when down); raised: `HOUSE_PROP` cells x 78..82, y 11..15, z 104 + the mesh on its hinge | setLive only |
| Courtyard | x 61..101, z 53..102 gravel; a well, three stalls with striped wool canopies, banners on the south wall | `GRAVEL`, `COBBLE`, wool, `PLANKS` |
| Garden | x 34..60, z 51..102 (and the strip x 34..43 west of the keep): flowers, three topiary knights (`HEDGE`), two benches; the keep's door opens onto it | `HEDGE`, `FLOWER_BUSH`, `PLANKS` |
| Hedge row | z 51..52, x 61..101, 3 high: the courtyard never touches the Tilt Yard; the **squire gate** x 63..64 is hedge until it opens (setLive): from the yard's side, or for good with the Joust won | `HEDGE` |
| Hedge maze | x 102..126, z 52..96: 6 x 11 cells, 3-wide paths, hedges 3 high (`hedgemaze.js`, a fixed seed); entrance from the courtyard at x 102, z 89..91, exit into the Tilt Yard at z 52, x 111..113 | `HEDGE`, `GRASS` |
| Tilt Yard | x 61..126, z 22..50; sand x 62..117, z 26..46 (wild creatures never walk there); the tilt barrier z 36, x 66..116 (red and white wool); your lane z 30..34, the knight's z 38..42; start pads (knight wool) x 63..65 and 115..117, z 31..33; bleachers z 44..46; Squire Pip at (66.5, 11, 28.5) | `SAND`, wool, `PLANKS` |
| The Keep | x 44..60, z 22..50, walls y 11..27, roof y 28 with crenels; the Great Hall (y 11); a 3-wide stair x 45..47 from z 48 up to the throne room floor y 18; the throne x 51..53, z 23..25, a red carpet; the Boss stand (52, 18, 28) facing south | `STONE_BRICKS`, `PLANKS`, `GLASS`, wool |
| Portcullis | the keep's door x 50..54, y 11..15, z 50: `HOUSE_PROP` with `LiveCells` while shut + an iron grid mesh that slides up | setLive only |
| Shield Stones | two 5 x 5 cobble crosses at (76, 10, 130) and (84, 10, 130); the painted shield top, gold rim and the 12-segment lamp ring are meshes | `COBBLE` + meshes |
| Practice towers | spots 1..11: 3 x 3 `PLANKS` towers, 3 high; catapults and wooden archers are instanced meshes on them (spot 0 sits on the wall over the gatehouse) | `PLANKS` |
| Way back | `buildWayBack(world, 'castle', { x: 80, y: 10, z: 156, facing: [0, -1] })` | base |

### 2.3 People

- **Herald Hugo** (a `kind: 'guest'` person in `world.people`, `look: 'squire'`) by the arrival (84.5, 11, 151.5): "Block the
  pumpkins on the Shield Stone and the drawbridge comes down!"
- **Squire Pip** (crew 0) in the Tilt Yard; **Archer Wren** (crew 1) on the gatehouse roof (she loads the catapults).
- **Sir Clanksalot** (the Boss) in the throne room, facing the stair and the carpet.

### 2.4 Keeps, rests, nooks

- **Keeps:** `castle` x 26..134, z 14..109, all y (walls, moat and everything inside; **no `rideIn`**: riders are fenced out,
  `rideText: 'Hop off! Inside the castle you ride the castle horse.'`), `field` x 58..103, z 110..150 (no roof over the stones),
  each corner tower, the topiary, the throne, the Tilt Yard, the way back and the Boss stand (base).
- **Rests:** the arrival (base), the field (80.5, 11, 138.5), the courtyard (80.5, 11, 94.5), the Tilt Yard (66.5, 11, 30.5), the
  throne room (base).
- **Nooks:** 8 in the garden, 4 in the courtyard, 6 on the meadow; never on sand, in the field or in the keep (the check proves it).
- **Part:** `{ id: 'castle', live: 'castle', area }`; `world.castle` holds the tables (`maze`, `mazeData`, `towers`, `live` cells...).

### 2.5 The guide (`castleAim`, TERRAIN_AIMS; the live part's `aim` asks it)

1. Shield Up! not won and the drawbridge up -> the Shield Stone. 2. The Joust not won: outside -> the drawbridge; in the courtyard
-> the maze's entrance; in the yard -> the start pad. **Inside the maze the guide only helps gently** (owner 2026-10-28): words
only ("The hedge maze! Find the way out to the Tilt Yard."), after `MAZE.hintAfter` 45 s a tip ("keep one hand on the hedge and
follow it!"), after `MAZE.compassAfter` 90 s an arrow to the way out as the crow flies (never a path through it). 3. The helpers
(the base's `crewAim`), then Sir Clanksalot, then with the star the way back (the base).

---

## 3. Shield Up! (`src/siege.js`: pure, imports only `fairHelp`, Node-runnable)

### 3.1 The field

- `SIEGE.stones = [[76.5, 11, 130.5], [84.5, 11, 130.5]]` (stand points). Two stones so two friends can play at once,
  each with their own pumpkins (they are local, section 8).
- `SPOTS` = 12 launch points on a ring round the field centre (80.5, 130.5): angle `30° * k` from north (toward the
  castle, -z), clockwise seen from above. k 1..11 at radius 18, launch height y 14 (the tower top + 1); k 0 is the
  gatehouse roof catapult (80.5, 24, 101.5). The direction of a throw is always computed from **the stone you stand on**
  to the spot, so the two stones see slightly different angles (fine: the rule uses the real angle).
- `FRONT = [10, 11, 0, 1, 2]` (the castle side).

### 3.2 What comes at you (closed forms of the round clock `t`)

| Kind | Tell (before launch) | Flight | Path | Block rule |
| --- | --- | --- | --- | --- |
| `pumpkin` | 1.0 s: the catapult arm creaks back, the tower's ring segment glows orange, a pointer appears | R1 1.5 s, R2 1.3, R3 1.15 | an arc from the spot to your chest (y + 1.2), apex 4 above the higher end | the shield faces it: angle error <= `cover` |
| `arrow` | 1.2 s: the archer dummy draws (a creak and a twang at launch), segment glows red | 0.6 s | a straight line to your chest | as above |
| `sky` (R3) | 0.8 s: a catapult points straight up, segment glows violet | 1.6 s, falling from 12 above you | straight down onto the stone; its **shadow** on the stone grows for the whole flight | the shield is **up** (Jump held) |
| `big` (R3) | as a pumpkin, a bigger pumpkin, the segment glows gold | as a pumpkin | as a pumpkin | a **Perfect** only (error <= `perfect`), else Splat |

- **The shield (`Stance`):** `dir` = the stick's world direction (`atan2(wx, wz)` from `steer`, already view-relative
  like walking) when `analog > 0.4`, else the view's yaw (so a mouse player can simply turn to face it). No turning
  rate: the shield is where the stick points. `up` = Jump held. While `up`, nothing from the side is blocked.
- **The judge** (at the arrival moment of each throw, exact closed-form time; the stance read is the input of the frame
  that holds that moment): error = `|wrap(dir - dirToSpot)|`; `up` blocks only `sky`; a side throw is **blocked** if
  `!up && error <= cover`, **Perfect** if also `error <= perfect`.
- `SIEGE = { cover: 35°, perfect: 12°, bigPerfect: 12°, chest: 1.2, skyHigh: 12 }`.
- **Blocked:** `shieldclang`, the pumpkin bounces off and rolls away (a mesh, 1 s), +1. **Perfect:** a brighter clang
  and the pumpkin flies **back to its tower** and splats the wooden archer (comedy), +1, a sparkle. Three Perfects in a
  row: "Hero!" (words only). **Splat:** `pumpkinsplat`, orange goo at the screen edge on that side for 1 s, no push, no
  damage.

### 3.3 Rounds (`siegePlan(seed, round, attempt, { help, hard })` -> the throw list, pure; seed = a hash of the player's seed | round | attempt, like `pinataPlan`)

| Round | Throws | From | Kinds | Pairs (two from sides >= 90° apart) | Need |
| --- | --- | --- | --- | --- | --- |
| 1 | 10 | `FRONT` only | pumpkins | none; arrivals >= 1.8 s apart | 8 |
| 2 | 12 | all 12 spots, at least 4 from behind (k 4..8) | 8 pumpkins, 4 arrows | 2 pairs 0.7 s apart | 9 |
| 3 | 14 | all 12 spots | 6 pumpkins, 4 arrows, 2 sky, 2 big | 3 pairs 0.5 s apart; a `sky` is never within 0.6 s of another arrival | 11 |

- Arrivals otherwise >= 1.2 s apart (R2) / 1.0 s (R3). The same spot never throws twice in a row.
- **Hard** (you hold the `castle` star: a rematch): +2 throws, need +1, every tell x 0.85.
- A round lasts about 25-40 s; the chip shows "🛡️ 6 / 8 · Round 1" and the throws left.

### 3.4 The kind help (both challenges)

`fairHelp(misses)` (misses = short rounds of this round in a row, kept for the trip): from the third try tells and
flights x `1 / slow` (up to x 1.43), `cover` + 5° (+10° from the fourth try). A round won resets it. A missed round
never loses a saved key.

### 3.5 Where you see it (the iPad matters most)

- The stone's **ring of 12 lamp segments** (one mesh) glows the segment of every throw in its tell and flight, in the
  kind's colour; the segment nearest your shield is outlined white, so a child sees "turn my shield to the glow".
- **Pointers round the crosshair** (`ui.setPointers`): up to 3, for the next arrivals, pointing where they are relative
  to your view (a throw from behind = a pointer at the bottom), growing as they come. Throws already in the view get no
  pointer.
- The shield mesh in front of the camera (the left side, like the party stick in the Room of Doors) turns with `dir`;
  a held Jump lifts it overhead.
- Sounds: `catapultcreak` (tell), `catapultthunk` (launch), `bowtwang`, `shieldclang`, `pumpkinsplat`, `trumpet`
  (round won), `drawbridge` (chains), all quiet and short.

### 3.6 After round 3

`pw:castle:shield3` -> the trumpet, the drawbridge mesh comes down in 3 s, then the deck cells are drawn (`LiveCells`,
never inside the player) and the raised-bridge cells leave. **The drawbridge is down** whenever `shield3` is saved
**or** you hold the `castle` star (a rematch player walks straight in; the round keys are cleared after the star,
section 5). It is drawn per player from that rule every 0.25 s, like the Vault door.

---

## 4. The Joust (`src/joust.js`: pure, imports only `fairHelp`, Node-runnable)

### 4.1 Getting on

- The castle's horse (a **Gallantrot** model in a red-and-gold caparison, `castleprops.js`) waits on the start pad of
  your lane. Within 2 blocks: the big button says **Mount!** (`near` / `use`). `game.riding.stop('quiet')`, then the
  steed becomes your `carry` (`steedObj`: `where`, `wantsLeave(space)` = a fresh Jump **between passes** only,
  `leave`, `steer`, `look`, `safe` = the pad). While mounted `state.ride = 'gallantrot'` so a friend sees you on a horse
  (Gallantrot is rideable, so `rideSpecies` accepts it; no new message).
- **Charge!** (the big button, E, a click) starts a pass. Between passes **Jump** = get off (you land beside the
  horse, which stays at its end of the lane). On the iPad the Jump button says "Off" while mounted and idle
  (`setButtons({ jump: 'Off' })`).

### 4.2 A pass (closed forms of the pass clock `τ`)

- **Your horse** gallops your lane from its end to the other: speed `JOUST.gallop[round]` = 8 / 9 / 10 b/s (hard + 1),
  reached in 1 s (`s(τ)` = the exact integral), slows over the last 6 blocks and turns round at the end (1.5 s). The
  camera eases to the lane direction and a slight look down (like the kart), then is free again after the pass.
- **The practice knight** (Sir Splinter, a wooden knight on a wheeled wooden horse, a mesh) comes the other way on the
  knight's lane. Its start and speed are solved so that **you meet at `τ = T`**: `JOUST.meet` = 3.4 / 3.0 / 2.6 s
  (hard x 0.9, help + 0.3 per help step).
- **The lance tip** `(u, v)` lives in the plane of his shield (blocks; u = toward the tilt, v = up), starts at (0, 0)
  every pass, limited to |u| <= 1.0, |v| <= 0.8. The stick moves it: velocity `JOUST.tipSpeed` 1.6 b/s x the stick
  (the view is locked along the lane, so the stick's forward / sideways parts are up / sideways); mouse moves add
  0.006 b per pixel, an iPad drag 0.01 b per point (`carry.look`). Integrated in fixed 1/120 s sub-steps with the
  frame's input held.
- **The gallop bob** is added on top: `bu = A_u sin(2π 1.3 τ + φu)`, `bv = A_v (|sin(2.4 π τ)| - 0.64)`, with
  `(A_u, A_v)` = (0.05, 0.08) / (0.08, 0.13) / (0.10, 0.16) by round. φ from the seed.
- **The gold star** on his shield (shield radius 0.8):
  - R1: still, at one of four spots (±0.5, 0) / (0, ±0.45) picked by the seed per pass (never the middle, so holding
    still is never a bullseye).
  - R2: slides round an ellipse `(0.5 cos(ωτ + φ), 0.35 sin(ωτ + φ))`, ω = 2π / 2.4.
  - R3: the R2 ellipse at ω = 2π / 1.9, and **one hop** at `τ = T - 0.9` (help: `T - 1.2`): φ += π (it jumps to the
    other side). A tell: the shield wiggles and goes "boing" 0.25 s before.
  - Star radius `r` = 0.32 / 0.28 / 0.26 (help + 0.06 per help step, hard - 0.03).
- **The meeting** at `τ = T`: `d = |(tip + bob)(T) - star(T)|`. `d <= r` **Bullseye!** (2 points: `lanceclang` +
  `trumpet`, Sir Splinter spins off his trolley in a comic tumble and pops back on at the end of the lane);
  `d <= 0.8` **Clang!** (1 point, the shield rings); else **Whoosh!** (0, his lance bonks your helmet: `bonk`, the
  screen wobbles 0.2 s, nothing else).
- A gold **aim dot** is drawn where the tip meets his shield's plane (a mesh on the shield, so it is seen in 3D), and
  the lance mesh comes from the right of the camera across the tilt.

### 4.3 Rounds (`joustPlan(seed, round, attempt, { help, hard })` -> per-pass spots and phases, pure)

| Round | Passes | Star | Need (points of 8) |
| --- | --- | --- | --- |
| 1 | 4 | still, off the middle | 5 |
| 2 | 4 | sliding | 6 |
| 3 | 4 | sliding faster + one late hop | 6 |

Hard: need + 1. Missed rounds: the kind help (3.4). The chip: "🐴 Pass 2 / 4 · ⭐ 3 / 5". Each round won is saved at
once: `pw:castle:lance1..3`. With `lance3` the trumpet sounds and the keep's **portcullis rises** (drawn from the rule
"`lance3` saved or the star held", every 0.25 s, so after the first star it stays up).

---

## 5. Saved progress, the gate, rematches

- **Saved** (`beaten`, at once with `game.save()`): `pw:castle:shield1..3`, `pw:castle:lance1..3`, crew
  `pw:castle:crew1..2` (`crewKey`). Rounds are won in order (round k is offered only once k - 1 is saved); a visit
  starts at the first round not won.
- **Per trip, not saved:** misses (for the help), Perfects in a row, points of a round in play.
- `castleState(game)` (castleland.js, pure) -> `{ shield: n, lance: n, n, need: 6, done, crew, ready, bridge, gate }`
  (`bridge` = shield3 or star, `gate` = lance3 or star, `crew` = `crewLeft(game, 'castle')`, `ready` = `done &&
  !crew.length`).
- Boss `gate(game)`: null when `ready`, else "Halt! Block the pumpkins and win the joust first! (🛡️ s / 3 · 🐴 l / 3)" or the base's
  `crewText`.
- **A won Boss battle clears the six round keys** (`CastleLive.battleEnded`, like the stadium's goals and the
  rowboats), so a rematch plays both challenges again, `hard`. The crew keys stay. The drawbridge and the portcullis stay
  open for a star holder.

---

## 6. Sir Clanksalot and his helpers (`pictureboss.js`, one `addBoss` in a `/* ==== T49 castle ==== */` section)

- A person Boss, `look: 'knight'` (npc.js: a steel bucket helm over the head with a dark visor slit and a red plume on
  top, a tabard in the shirt colour with a gold star on the chest; no hair, no hat), colours steel grey, red, gold.
  Top level **64**, the easy side:
  `[['ramparsnail', 61], ['bristleguard', 62, ['quillvolley', 'shieldbash', 'holdthegate', 'quickparry']], ['turrock', 63], ['gallantrot', 64, ['grandjoust', 'lancecharge', 'roundtable', 'quickparry']]]`
  (the move lists are checked against `movesWith` by the spec, as the tiny spec does).
- Words: intro "Halt! Who goes there?" / "A challenger! At last! I have trained for this every day!"; lose "A true
  knight! The star is yours. Ta-ta-taa!"; win "Bravely done! Rest a moment and try again."; rematchIntro "Back for
  another tournament? My knights trained harder!". **Note from the Wizard:** "I built this castle for my toy knights.
  They trained every day for a tournament, and nobody ever came to watch. Thank you for being their challenger!"
- **Crew** (beaten before the Boss, the wave 15 rule; bonus cubes like the others):
  - **Squire Pip** (`look: 'squire'`: a small round steel cap with a feather; at the Tilt Yard start pad):
    `[['clipclop', 59], ['pricklet', 60]]`, intro "I look after the horses!", line "Point your lance at the gold star!"
  - **Archer Wren** (`look: 'squire'`, green and brown; on the gatehouse roof):
    `[['visnail', 60], ['bristleguard', 61]]`, intro "I load the catapults! Squishy pumpkins only.", line "Push the
    stick toward the pumpkin! Jump for the sky ones!"
- Winning: the star (`ui.celebrate`), banners unfurl on the keep for the trip (a mesh), the knights' trumpet.

---

## 7. The Knight type (7 creatures: 3 families of 2 + 1)

Armoured animals and a castle that walked off. Every model wears **a little pennant on a stick** (`gear: 'pennant'`:
a red-and-gold triangle on a thin pole, ONE merged mesh on a pivot that flaps, closed form), the way Funfair creatures
wear the bulbs.

| # | Base | Evolved | Shape (new, `/* ==== T49 knight shapes ==== */`) | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Pricklet** | **Bristleguard** (lv 24) | `shieldhog`: a round hedgehog of short cone quills, a pointy snout, tiny feet, holding a round wooden shield with a boss on its front-left arm; evolved: bigger, a tall kite shield with a red cross, a little helmet, the quills longer | sig **Quill Volley** (Bristleguard) |
| 2 | **Visnail** | **Ramparsnail** (lv 22) | `helmsnail`: a soft snail body with a knight's **bucket helm** on its head (visor slit, a plume), its shell a **round castle turret** with crenels; evolved: a taller turret shell with arrow slits and a flag | **Not Shelmet**: that one hides in a helmet-like shell. Ours wears a real helm on its head and carries a turret; no lance, no shell-as-helmet. The builder checks the look against this note |
| 3 | **Clipclop** | **Gallantrot** (lv 26) | `armourhorse`: a blocky foal in a too-big tin helmet that falls over its eyes; evolved: a tall horse in plate barding (a chamfron face plate, a red-and-gold checked caparison to the knees) | Gallantrot **rideable (land)** in `TRAITS.rideable` (the horse in armour); sig **Grand Joust**; the castle's steed is its model |
| 7 | **Turrock** | (none) | `walkturret`: a single round grey stone turret on two stubby legs, two arrow-slit eyes, a **drawbridge mouth** with tiny chains that drops open when it talks or attacks, crenels round the top, a pennant | **Not Fortsand** (Camo: square, sand, corner towers, a gate in front): grey stone, one round tower, the drawbridge is its mouth |

- **Stats** (like wave 15): Pricklet 50 / 58 / 70 / 48 (hp / atk / def / spd), Bristleguard 78 / 88 / 110 / 50;
  Visnail 58 / 45 / 80 / 25, Ramparsnail 95 / 70 / 125 / 30; Clipclop 52 / 66 / 56 / 76, Gallantrot 82 / 100 / 82 / 96;
  Turrock 70 / 75 / 100 / 35 (baseXp 110, catchRate 0.3). Base forms baseXp ~66, catchRate 0.45; evolved ~168, 0.1-0.12.
- **Learnsets** `L('knight', second)`: Pricklet `grass` (hedgerows), Visnail `rock`, Clipclop `normal`, Turrock `metal`.
- **Moves** (`/* ==== T49 knight ==== */` in `MOVES`; none is a sound name, checked): `shieldbash` Shield Bash (40, 1) =
  `T1`; `lancecharge` Lance Charge (90, 0.9, recoil 0.25) = `T2`; `quickparry` Quick Parry (40, 1, priority 1) = `T3`;
  `bannerwave` Banner Wave (0, 1, raise own atk) = `T4`; sigs **`grandjoust` Grand Joust** (Gallantrot, 100, 0.85,
  flinch 0.3, sig) and **`quillvolley` Quill Volley** (Bristleguard, 25, 1, multi 2-5, sig).
- **`BIG_MOVES.knight`** (three, like wave 14-15): `roundtable` Round Table (rally: "Everyone to the round table! Whole
  team hits harder. You get softer."), `holdthegate` Hold the Gate (shield: "Drawbridge up! The team takes less for 3
  turns. You rest next turn."), `lastcharge` Last Charge (lastword: "One last brave charge! Only when you are almost
  out.").
- **Chart** (measured on today's chart: a defender may be weak to at most 5 types):
  - Own row: `EFFECTIVENESS.knight = { pirate: 2, ninja: 2, alien: 2, metal: 0.5, rock: 0.5, knight: 0.5 };` (knights
    catch pirates, face ninjas in the open and defend the castle from invaders; armour cannot dent metal or castle
    stone). Pirate goes 4 -> 5 weaknesses, ninja 2 -> 3, alien 4 -> 5: all within the rule. (Drake would be the
    storybook choice but is already weak to 6.)
  - Others against Knight, as separate lines: `EFFECTIVENESS.water.knight = 2;` (armour rusts),
    `EFFECTIVENESS.electric.knight = 2;` (lightning finds the metal), `EFFECTIVENESS.tiny.knight = 2;` (gets inside
    the armour and tickles), `EFFECTIVENESS.bug.knight = 0.5;` (armour), `EFFECTIVENESS.drake.knight = 0.5;` (knights
    are brave). Only new cells; the spec checks every old cell is unchanged.
- **Per-type cost:** `TYPE_COLORS.knight` (`'linear-gradient(135deg,#c8d2e2 0 55%,#e8c45a 55% 100%)'`, steel and gold,
  light enough for the dark chip text), wool **254** (`WOOL_ID_OVERRIDE.knight = 254`, `WOOL_RGB.knight` [150, 165,
  190] with a gold cross pattern in its tile, like treasure's own pattern), `FX_COLORS.knight`, `TRAVEL.knight` (a
  spinning shield / a lance streak), `IMPACT.knight` (a clang star of metal sparks), `SIG.grandjoust` (a gallop dash
  with a lance flash), `SIG.quillvolley` (2-5 quills), sound `fx:knight` (a short trumpet "ta-ta-taa"). Book page,
  README tables. `WOOL_TYPES` gets `'knight'` (43 types in all; update the count in CLAUDE.md).

### 7.4 Wild Knights

- **Gait `'sentry'`** (`GAITS.sentry` in creatures.js, closed form, no `Math.random`): at spawn it picks the longest
  straight run of free walkable cells (<= 5) through its cell along x or z (uid hash breaks ties) and marches it back
  and forth at 1.2 b/s, with a smart 0.6 s turn at each end. Within 4 blocks of you it stops, turns to face you and
  raises its shield / helm (a pose: `parts.guard` if the model has it). A bump is noticed, never a battle; E / a tap
  battles, as everywhere since 2026-10-26.
- **Condition `guardpost`** (spawnrules.js): the nook spots (`ok: c => !!c.nook, place: c => c.nook(), outdoor: true,
  text: 'on guard at the castle'`), like `gift` / `housefloor`.
- `CASTLE_SPAWNS = [['pricklet', 1.3, 'guardpost'], ['visnail', 1.2, 'guardpost'], ['clipclop', 1.0, 'guardpost'],
  ['bristleguard', 0.12, 'guardpost', 'castle'], ['ramparsnail', 0.12, 'guardpost', 'castle'], ['gallantrot', 0.1,
  'guardpost', 'castle'], ['turrock', 0.15, 'guardpost', 'castle']]`; `MEADOW_SPAWNS` = the three base forms only. The
  4th element is the Picture World id (`wildafter.js`, rare until you won three of the six rounds).

---

## 8. The live part (`src/castlelive.js`, `CastleLive` = `LIVE.castle`) and the models (`src/castleprops.js`)

- **Hooks:** `near(p)`: "Shield!" (within 2 of a free stone, idle), "Stop" (in a round), "Again!" / "Next!" (after a
  round, on the stone), "Mount!" (by the steed), "Charge!" (mounted, idle); `use(p)` acts on them. `aim(p)` =
  `castleAim`. `talkPrompt` for the crew lines. `battleEnded` (section 5). No `holds`: every action is one press.
- **The stance** (`stanceObj`, a duck-typed carry): `where()` = the stone's stand; `steer(wx, wz, analog, space)` stores
  the shield's `dir` and `up`; `wantsLeave(space)` = a fresh Jump **between rounds** only (during a round Jump is the
  shield up); `leave()` puts you one step south of the stone. During a round `setButtons({ jump: 'Shield' })`.
- **Clocks:** the round clock and the pass clock are summed frame `dt` and stand still while `!game.playing()`, in a
  battle, an ask or a panel (pause, Book); the pure modules take `dt` in fixed 1/120 s sub-steps, so 60 and 20 frames
  a second give the same results. `manual = true` + `step(dt, input)` lets a spec drive it; `info()` for tests.
- **Drawn per player, nothing sent:** pumpkins and arrows (2 instanced meshes), splats / bounce-back (shared with the
  pumpkins), the two stones' ring segments (1 mesh), the 12 catapult arms and archers (2 instanced meshes, the arm
  angle from the tell), the shield in front of the camera (1), the steed (1, merged), Sir Splinter + trolley + shield +
  star + aim dot (2), the lance (1), the drawbridge (1), the portcullis (1), banners after the star (1).
- **Two browsers (owner 2026-10-28: the gates are physical):** the drawbridge, the portcullis are the same for everybody in a
  play-together world: `castlegate.js` (`game.castleGates`) over a new play-together message `castle`. When a player's own keys
  (or star) open a gate, the live part calls `castleGates.open('bridge' | 'port')`: a guest sends `{ type: 'up' }` to the host, the
  host merges (OR) and sends `{ type: 'gate', bridge, port }` to everyone; a guest that joins asks (`{ type: 'ask' }`, from the
  generic `joined` hook after `loadWorld`) and gets the current state. The live part draws a gate open when your own keys or
  the shared state say so. Your own saved keys still record only the rounds YOU won (the Boss gate reads them). Pumpkins, the
  horse, Sir Splinter and the rounds stay per player; the friend's avatar is seen on the other stone or on a horse
  (`game.rideShow` feeds the state's `ride`). Nothing is saved; a new play-together session starts closed.
- **Wild creatures** are kept off the field during a round (no nooks there) and a bump never starts a battle.
- **Score chip** (`ui.setScore`): "🛡️ 1 / 3 · 🐴 0 / 3" anywhere in the castle; the round's own count while playing;
  green "The throne room is open!" when `ready`.
- `castleprops.js` (instanced, vertex colours, each returns a Group with `userData.parts` / `dispose()`, like
  `fairprops.js`): `buildSteed`, `buildPracticeKnight`, `buildLance`, `buildShield`, `buildPumpkins`, `buildArrows`,
  `buildCatapults`, `buildDrawbridge`, `buildPortcullis`, `buildStoneRing`, `buildBanners`.
  `tests/castle-preview.mjs` photographs them for the owner.

---

## 9. `secret3` becomes `castle` (no save can break)

- `secret3` was never `ready` and never had a `realm`, so **no save can hold it** in `stars`, `place` or `realmUp`
  (and `loadStars` drops unknown ids anyway). Exactly how `doodle` took `secret1` and `atlantis` took `secret2`.
- Replace the entry **in place** (same index, so the same frame spot in `FRAME_WORLDS`, the same bridge stone in
  `BRIDGE_WORLDS`, the same frame colours):
  `{ id: 'castle', name: 'Castle', emoji: '🏰', frame: [0xf8b8a0, 0xe8f0f8], ready: true, realm: 'castle', picture: drawCastlePicture }, // T49 (was secret3: no save could hold its star)`
- `drawCastlePicture(g, n = 128)` (pictureworlds.js, like `drawFairPicture`): a blue sky, a grey castle with two round
  towers and red-and-gold pennants, the drawbridge down over a blue moat, a pumpkin on the grass and a little hedgehog
  with a shield.
- The Swirl's version does not change (frames are drawn with `setLive`; `REALMS.swirl.version` stays 5).
- **Behind `?preview`** (`comingsoon.js`): `export const LATER = ['castle'];` (not in `OPEN_NOW`). In
  `pictureworlds.js`, next to the wave 15 line: a world in `LATER` that is not `worldOpen` keeps `ready: false` **and
  looks like the old secret** (`secret: true`, `name: 'Secret World'`, `emoji: '❓'`), so the cloth never spoils it;
  keep the real name in `realName` for the Boss title (`addBoss` reads `pictureWorld(id).realName ?? name`). Node
  scripts and `?preview` see it open. Opening it later is one line: `'castle'` in `OPEN_NOW`.

---

## 10. Spec `tests/specs/castle.mjs` (`CASTLE_ONLY=data|land|siege|joust|play|ipad|pair|shots`)

- **Data:** 7 species, 4 own shapes, every model has a `gear: 'pennant'` mesh, moves, sigs, `BIG_MOVES.knight`, new
  chart cells only (every old cell unchanged, no defender weak to more than 5 except the old 6s), `TYPE_COLORS`, wool
  254, fx and sound entries (the `fx` spec's checks), no move id is a sound name, Gallantrot rideable, the Boss's and
  crew's move lists equal `movesWith`, the `castle` Picture World entry, `secret3` gone, the frame index and colours
  unchanged, `loadStars(['castle', 'secret3'])` = `['castle']`.
- **Land (Node, stand-in world, three seeds):** every block id is old or 182 / 254; the walk graph (BFS over stand
  cells with the base's player box, as `doodlecheck.mjs`): from the arrival the castle is **not** reachable with the
  drawbridge up (swimming the moat included) and is reachable with it down; the throne room is not reachable with the
  portcullis shut and is with it open; the gatehouse roof (Wren) and every nook reachable; nobody stuck (BFS from every
  floor cell back to a rest); every throw path from every spot to both stones (pumpkin arcs, arrows, sky drops) sampled
  every 0.02 s with no block in the way; the tilt lanes clear for the steed's box; keeps cover the moat, the walls, the
  field and the towers; no nook on sand, on the field or in the keep.
- **Siege (Node, the pure module, at 60 and 20 steps a second, same results):** `siegePlan` is pure (same seed = same
  list, a new attempt = a new list) and keeps its rules (round 1 front only, round 2 >= 4 from behind, pair gaps, sky
  never paired, no spot twice in a row); model players: **skilled** (reacts 0.35 s after a tell starts, points at the
  earliest arrival, Jump for the sky ones) wins rounds 1-3 and hard; **still** (no input) never wins a round;
  **spinner** (the stick turning once a second) and **jumpy** (Jump held all the time) never win; help after two short
  rounds makes a **slow** player (0.7 s reaction) win round 3.
- **Joust (Node, at 60 and 20 steps):** `joustPlan` pure; the meeting time is exact; the bob is a closed form;
  **skilled** (moves the tip toward where the star will be with a 0.25 s delay) wins rounds 1-3 and hard; **still**
  never wins (round 1's star is never in the middle); **random stick** (a hash) never wins rounds 2-3; a **late**
  player (starts 1.0 s before the meeting) wins round 1 only with help.
- **Play (browser):** the frame in the Swirl (with `?preview`) opens the Castle at the arrival; the guide leads to a
  stone; a siege round won through the live part (`manual` + `step` with the skilled inputs), the key saved and still
  there after a reload in a fresh browser; the drawbridge comes down and lets you walk in; a joust round the same way;
  the portcullis; the gate words; the crew battles; Sir Clanksalot (`playBattle`), the star, the note, the six keys
  cleared, the drawbridge still down for the star holder; a lost battle stays in the throne room; a splat and a whoosh
  never hurt or push; the score chip; the Book page with "on guard at the castle"; a wild Knight's sentry march.
- **iPad:** the joystick points the shield (8 directions and between), the Jump button says "Shield" in a round and
  lifts it, "Off" on the idle steed; Shield! / Stop / Mount! / Charge! on the big button; drag-to-look moves the lance
  tip during a pass; no button moves or disappears (T39c rule); pointers round the crosshair visible.
- **Pair:** two browsers in the Castle: both on the two stones at once, each with their own throws and keys; the
  friend's avatar on a horse during a joust (`state.ride`); a guest's drawbridge is their own.
- **Closed:** without `?preview` the frame is a covered secret ("A secret world"), the Castle cannot be entered, and
  every other spec's frame checks still pass.
- **Screenshots** `t49-*.png`: the castle from the arrival, a siege round with a glowing segment and an incoming
  pumpkin, a Perfect block, a sky pumpkin's shadow, the drawbridge coming down, a joust pass just before the meeting
  with the aim dot on the star, Sir Splinter tumbling, the hedge garden, the throne room, a row of the seven creatures,
  the iPad layout in a round.
- **Old specs:** `picture-worlds`, `swirl`, `realms-together`, `funfair` (the `fairHelp` import), `fx`, `roster`,
  `seventh` (add Turrock to the wave group) still pass.

## 11. Performance

The Castle is a 160 x 160 flat world like the Sketchbook (walls and towers add about 25 000 solid cells). Budget: **at
most +12 draw calls** for the part (section 8 lists them; most are hidden when far: only the field meshes near the
stones, only the Tilt Yard meshes inside the yard). Physics: closed forms and two 120 Hz loops of a few numbers. Measure
with `node perf.mjs 1 --realm=castle` from the arrival, on a stone, in the Tilt Yard and in the throne room; accept if
the arrival view stays under the main world's start view (374 draw calls) and fps within 10% of the Sketchbook's. Write
the numbers in a "Measured" section here.

## 12. Block ids (only 137-139, 182-183, 249 and 254 are left in the whole game)

The Castle needs only **two**:

| id | Name | Tiles | Flags | Why it cannot be an old block |
| --- | --- | --- | --- | --- |
| **254** | Knight wool | `WOOL` tile with the gold cross | like every type wool (not placeable, as wave 15's) | every type with a world gets a wool (banners, roofs, pads, the throne) |
| **182** | `HEDGE` (Hedge) | `KN_HEDGE` (clipped, dense, tiny leaf dots, no holes), `KN_HEDGE_TOP` | `fixed`, opaque, `wallText: 'A neat castle hedge. The gardener would be cross!'` | `LEAVES` are see-through and wild-looking (and give cubes when broken); a clipped hedge and topiary need a solid, tidy block |

Everything else is old blocks (`STONE_BRICKS`, `COBBLE`, `PLANKS`, `SAND`, `GRAVEL`, `WATER`, wool), `setLive` cells
(the drawbridge deck, `HOUSE_PROP` behind the raised drawbridge and the portcullis), or meshes (the stone tops and
rings, catapults, archers, the steed, Sir Splinter, pumpkins, arrows, the drawbridge, the portcullis, pennants).

**Left free on purpose:** 137-139 (the comment says "more Swirl looks": wave 16's Wizard's Tower is in the Swirl),
183 and 249, and 255 if the builder confirms it is usable. Wave 16 also needs a wool for the Custom type, and the
Portal Lab (`plans/T47-portal-lab.md`) would need a few. If the builder finds the castle stone must look warmer than
`STONE_BRICKS`, it asks the owner before taking 183 (`CASTLE_STONE`). Update the id comments in `blocks.js` (182
"T49 hedge", 254 "T49 knight wool", "next free: 137-139, 183, 249").

## 13. Words (short, for a 7-year-old)

- Stone: "Shield!", "Ready... here they come!", "Clang! Blocked!", "Perfect!", "Splat! Turn your shield to the
  glow!", "Look up! Shield up! (Jump)", "Round 2: from all sides!", "So close! Again!", "Hero!"
- Bridge: "Ta-ta-taa! The drawbridge is coming down!"
- Joust: "Mount!", "Charge!", "Bullseye! Sir Splinter fell off!", "Clang! On the shield.", "Whoosh! Point your lance
  at the gold star!", "Watch the star: it hops!", "The portcullis is up! Sir Clanksalot waits in the throne room."
- Tips once per trip (`toldOnce`): "Push the stick toward the danger. The arrows show where it is!" and "Move the
  stick to put the gold dot on the star."

## 14. Files

- New: `src/castleland.js` (layout, `castleLand`, `castleState`, `castleAim`, spawns), `src/siege.js`, `src/joust.js`
  (pure), `src/castlelive.js`, `src/castleprops.js`, `tests/specs/castle.mjs`, `tests/castlecheck.mjs` (the stand-in
  world + walk graph, Node and page, like `doodlecheck.mjs`), `tests/castlebots.mjs` (the model players, like
  `doorsbots.mjs`), `tests/castle-preview.mjs`.
- Changed (marked `T49` sections): `species.js` (type, 7 species, moves, chart lines, `BIG_MOVES`, spawns
  re-export if needed), `shapes.js` (4 shapes, the pennant gear), `traits.js` (Gallantrot land), `blocks.js` (wool 254,
  `HEDGE` 182, tiles), `fxrecipes.js`, `sound.js`, `realms.js`, `pictureworlds.js`, `comingsoon.js`, `pictureboss.js`,
  `gymlive.js`, `wildafter.js`, `spawnrules.js`, `creatures.js` (sentry), `npc.js` (two looks), `main.js` / `touch.js`
  / `ui.js` (the generic lines of section 1), `tests/run.mjs` (the spec in its group).
- Docs: `README.md` (the Knight type in the type and chart tables, the Castle in the Picture Worlds section, controls:
  Shield! and the stick, Charge!), `STORY.md` (the paragraph at the top), `CLAUDE.md` (code map rows for the five new
  files, a key-idea paragraph "Knight type and the Castle (T49)", the type list "43 types ... Knight", the spec in the
  Testing list, the id comment), `ROADMAP.md` (the Knight entry under "Types for later" points here).

## 15. Build order (one builder)

1. Data: the type (species, shapes with the pennant, moves, chart lines, fx, sounds, wool, `HEDGE`); spec `data`.
2. `siege.js` + `joust.js` + `tests/castlebots.mjs`; spec `siege` and `joust` in Node (tune the numbers until the model
   players behave as section 10 says; write the final numbers back into this plan).
3. `castleland.js` + `tests/castlecheck.mjs`; spec `land`.
4. `castleprops.js` + preview photos (show the owner the steed, Sir Splinter, the catapults and the stone).
5. `castlelive.js`, the generic lines, the Boss, the frame + `LATER`; `play`, `ipad`, `pair`, `shots`; perf; docs.


The open questions of the first draft were answered by the owner on 2026-10-28 (section "Owner's answers" at the top).

## As built (2026-10-28): the numbers and what differs from the sections above

- **Files:** as in section 14, plus `src/hedgemaze.js` (the maze, pure) and `src/castlegate.js` (the shared gates). No
  `tests/castle-preview.mjs`: the spec's screenshots `t49-*.png` show the models in place (creatures, arrival, the stone with the
  held shield and a pumpkin, the maze from the gatehouse roof, a joust pass, the throne room, the iPad).
- **Shield Up! numbers** (`SIEGE`, tuned with `tests/castlebots.mjs`): tells by round pumpkin 1.0 / 0.8 / 0.6 s, arrow 1.2 / 1.0 /
  0.8 s, sky 0.8 s, big 1.0 / 0.9 / 0.8 s; flights pumpkin 1.5 / 1.3 / 1.05 s, arrow 0.6 s, sky 1.6 s; rounds need 8 of 10, 9 of 12,
  **12 of 14** (11 let a 1.5 s child through too often). A "from behind" slot is never the second of a pair. Spot 0 is the
  catapult on the wall top over the gatehouse (27.5 high), not the gatehouse roof (the walls run on over it).
- **Joust numbers** (`JOUST`): `tipSpeed` 1.3, the star's ellipse 0.55 x 0.42 (never closer than 0.42 to the middle, so holding
  still is never a bullseye even with the help), slide periods 3.2 s / 2.6 s, star radius 0.32 / 0.28 / 0.26, `rHelp` 0.04 per
  help step, the help also slows the slide (`fairHelp().slow`); rounds need **6 / 6 / 7** points of 8.
- **Model players** (20 seeds, 60 and 20 steps a second): Shield Up!: skilled (0.35 s) wins every round and the rematch's; still,
  spinning the stick and holding Jump never win, not even with help; a slow child (1.5 s) wins rounds 1-2, round 3 5 times in 20
  and 20 in 20 with the help. Joust: skilled wins all (rematch too); still never; a random stick at most 2 in 20; a child who
  follows the star without leading it wins round 1, round 3 never alone, 14-15 in 20 with the help.
- **The maze:** seed 14, 4 loops: the shortest way 22 cells (84 blocks of walking), 8 dead ends, 4 loops, all 66 cells reachable.
- **The Boss's move lists** are what `movesWith` gives: Bristleguard `seedvolley, bodyslam, holdthegate, quillvolley`,
  Gallantrot `lancecharge, bodyslam, roundtable, grandjoust`.
- **Generic lines** (all marked `T49`): `Player.look` asks `carry.look` first; `touch.setButtons({ jump })`; `ui.setPointers`;
  `main.js` passes `p.carry?.jumpWord?.()`; the mp state's `ride` falls back to `game.rideShow`; the `castle` event, `sendCastle`
  and the `joined` hook in `multiplayer.js` / `playtogether.js`; `GAITS.sentry`; the `guardpost` condition and `AFTER_TEXT.castle`;
  `npc.js` looks `knight` and `squire`. Specs touched: `blocks` (the wool id range allows 254), `picture-worlds` (knight is a later
  type, `castle` reads as `secret3` in the old order), `seventh` (Turrock in a new group `W16`).
- **The sentry gait** ignores keeps (the whole castle is a keep, which fences riders): it only marches on the world's `walk` floor.
- **Not built:** banners unfurling on the keep after the star (the trumpet and the note only); the spec's perf numbers were not
  measured with `perf.mjs` in this session (the part adds about 12 draw calls in the field and the yard, plus the steed's model).

## Kind help (owner 2026-10-28)

"Making it easier a bit each time something goes wrong, but only ever so slightly; with the shield game, after failing 6 times it became pretty easy. We should ask a bit of grit / patience." Every skill game now takes its help from the one shared rule in `src/kindhelp.js` (`KIND_HELP = { after: 2, step: 0.02, max: 0.10 }`: nothing for 0-1 misses, then 2 / 6 / 10 % easier after 2 / 4 / 6 misses, never more); this game only maps `kindHelp(misses).slow` / `.more` onto its own levers (the table is in the module comment). The older, stronger help numbers here are replaced by it; a rematch's `hard` is unchanged. Spec `kindhelp`.
