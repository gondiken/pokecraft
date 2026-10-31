# 🪞 Mirror type and the Mirror Palace (wave 18, plan, not built yet)

Owner, 2026-10-31: "Let's make Mirror the 13th star / 12th world (I'm counting portal as a house and not a world). Plan and build
that as wave 18 — push the other waves further back. Btw I want to have the option to close / remove this world if my son doesn't
like it." So: the Wizard's Tower and the Custom type become **wave 19** (a parallel plan; it owns block id **137** and builds on the
Wizard's island), chapter 3 after it.

**Build this in fresh sessions** (three builder stages, section 12). Read first: `CLAUDE.md` (all of it), `STORY.md` "The Picture
Worlds", `plans/bubble-well.md` and `plans/cube-planets.md` (house style: natural rules, kids bots, kind help, for fun), `src/castleland.js`
+ `src/castlelive.js` (a stance `carry`, `LiveCells`, keys, aim), `src/swirlland.js` (frames, bridge), `src/comingsoon.js`.

## 0. Why Mirror can work this time

The son did not like a Mirror **type** before (ROADMAP "Dropped types"); the idea list said "only with a lively version". So nothing
here is a quiet reflection puzzle. **Every game is a body skill:** a ball sport, steering two of you at once, keeping a beam of light
on something that runs away. And it is **funny**: funhouse mirrors at the door make you tall, wide and tiny; your looking-glass twin
waves and plops into ink puddles; Copycat Cleo copies every step you take; the Gloomies squeak and shiver when the light finds them.
If the son still does not like it, the remove switch (section 9) takes it out in one line, with nothing lost from anyone's save.

## 1. The owner's rules this plan follows

- **A fun, unique skill challenge** on the way to the Boss; never the same kind as another world. Already used (do not reuse as the
  main idea): hold-and-let-go power (Kick!, Fire!, the lunge, the cannons), a swing's phase (ropes, piñata, baskets), leading a moving
  target with a shot (rowboats, darters), driving (kart, bumper cars), steering a pencil while chased (Draw!), standing where a thing
  lands (Jack Catch), bouncing in the air (Balloon Bounce), lanes to a beat (Gold Ring Ride), release timing on a crane (Gift Stack),
  whack-a-jack reaction (Pop-Up Whack, which has a "Mirror!" twist: not reused), pointing a shield (Shield Up!), steering a lance tip
  (Joust), a maze, portal momentum (Portal House), making your own steps (bubbles), nudging (ducklings), a tap flier (Chimney Ride),
  stomps (shields), round-a-corner chase (Orbikits), spring hops, orbit jumps (ferry), net catches (Atlantis), sneaking (Dojo).
- **This world's three new skills:** (1) **angle a rebound** in a rally against a moving opponent (a mirror sport), (2) **steer two
  bodies at once** (you and your mirrored twin), (3) **keep aim on a fleeing target** (steady tracking with a beam, banked off mirrors).
- **Easy to understand, hard to master:** each game is clear in one look and one short line (section 4). The obvious shortcut never
  wins: no building anywhere (the whole map is a keep, so no pillar), the courts and the pool can't be walked into, the Gloomies are out
  of reach, a straight return goes straight back to Cleo, walking straight to your pad leaves the twin in the ink.
- **Natural rules, no explaining text** beyond the big button's word and one short line the first time: a ball bounces off a mirror the
  way it came in (angle in = angle out); your reflection does what you do, mirrored; light bounces off shiny walls and pillars cast
  shadows; Gloomies (bits of the Scribble's smudge) hate light.
- Never a fail: a miss starts the round again. **Kind help only via `kindHelp`** (`mirrorHelp` maps it onto levers, section 4.4).
  **For fun** (`ForFun`) once a game is won. **Crew before the Boss.** **A won Boss battle clears the nine round keys.** Clocks are
  summed dt with fixed **1/120 s** sub-steps (60 and 20 fps identical), standing still in a battle / ask / panel / pause.
- **iPad:** the fixed-slot buttons (touch.js `setButtons`), the big action button's word, stick + drag. Text short and kind.
- **Ships closed:** `LATER` (only `?preview` and tests) until the owner has played it (section 9).

## 2. What the child does (and the story)

The Wizard built a **palace of mirrors** so his creatures could pull funny faces at themselves. When the Swirl cracked, the Scribble's
smudges crept onto the glass as **Gloomies** (fuzzy grey scribble-balls with googly eyes), and the reflections stopped copying and
started doing things their own way: the **Mirror creatures**. **Duke Dazzle**, who loves his mirrors more than anything, has shut
himself in the Grand Mirror Hall until his palace shines again.

You step out of a gold frame into the palace garden, walk through the **Hall of Funny Mirrors** (tall you, wide you, tiny you: just
for laughs), and three wings wait, in any order:

1. **Bounce-Back** (west wing): a mirror-ball rally against **Copycat Cleo**, who copies everything you do.
2. **Looking-Glass Rooms** (east wing): you and your twin behind the glass must both stand on gold pads. **Glazier Gwen** keeps them.
3. **The Moonlit Gallery** (north): turn the big sun mirror and shine the Gloomies off the wall. **Lamplighter Lux** keeps it.

Each helper battles you once their game is won (3 rounds each). Then Duke Dazzle battles for the star.

## 3. The world (terrain as data, Node-runnable: `src/mirrorland.js`)

`MIRROR_SIZE` **160 x 160**, flat (`flatLand`, ground top `G` = 10, people stand at y 11), every coordinate below in cells. Nothing
depends on the seed except wild spawns. The **whole map is a keep** (no building); the palace keep has no `rideIn` (riders are fenced
out, like the Castle), the garden keep has `rideIn: true`.

| Part | Data | Where |
| --- | --- | --- |
| Way back + arrival | `ARRIVAL` | way-back frame at [80, 156] facing north; arrive at [80, 152]; `world.arrivals.mirror` |
| Garden | `GARDEN` | x 4..155, z 136..159: hedges, topiaries (a cat, a crown), a fountain at [80, 146]; 6 nooks |
| Palace walls | `PALACE` | x 4..155, z 12..135, y 11..22, white stone bricks with mirror-wool (138) trim and `MIRROR_PANE` (139) windows |
| Hall of Funny Mirrors | `FUNHALL` | x 60..99, z 113..134; gate x 77..82 at z 135; doors W (x 60, z 120..123), E (x 99, z 120..123), N (x 77..82, z 113) |
| Funny mirrors (6) | `FUNNY` | `{ kind, x, z, facing }`: tall [64,114], wide [70,114], tiny [89,114], wobbly [95,114] on the north wall facing south; upside [66,133], twins [93,133] on the south wall facing north |
| Bounce-Back wing | `COURT` | wing x 8..55, z 72..134; corridor z 120..123, x 37..59; the court below |
| Looking-Glass wing | `TWIN` | wing x 104..151, z 64..134; corridor z 120..123, x 100..109; three room pairs below |
| Moonlit Gallery | `GALLERY` | x 56..103, z 52..108; below |
| Grand Mirror Hall | `GRAND` | x 60..99, z 14..48; its door x 57..59 in the gallery's back wall (west corner, outside the Gloomies' wall); Duke on a stage at [80, 19] in front of a wall of `MIRROR_PANE` (z 15) |
| Rests (`world.rests`) | `RESTS` | funhall [80, 124], court [28, 124], twin [118, 126], gallery [80, 106], grand [80, 42] |
| Crew spots | `placeCrew` | Cleo [34, 85] by the goal, Gwen [118, 74] after room 3 (your side), Lux [88, 105] by the dais |

**The court** (`COURT.box` x 20..35, z 88..117: 16 wide, 30 long; court-local `u` = x − 20 (0..16), `v` = 117.5 − z (0..30)): side
walls x 19 and x 36 are `MIRROR_PANE` y 11..13; the north back wall z 87 is `MIRROR_PANE` except the **goal mouth** x 24..31 (u 4..12),
an open arch with a pink foam net behind (z 84..86); your end z 118 is a soft foam wall (your net, the whole width). A low gold rope (fixed
blocks y 11 + hidden solids to y 13, `HOUSE_PROP`) fences the court: nobody walks in. **The rail plate** (a gold mesh) at [27.5, 116.5]:
"Play!" puts you on the **rail** (u 0.8..15.2 at v 1.5), a `carry`.

**The Looking-Glass rooms** (`TWIN.glass` x 128: a `B.GLASS` wall y 11..16 in a gold frame, the full length): your side x 110..127,
the twin's side x 129..146; room-local `u` = distance from the glass (yours: 128 − x, its: x − 128), `v` = z − z0. Three rooms along z,
each 16 deep: room 1 z0 118 (z 118..133), room 2 z0 100, room 3 z0 82. Doors between rooms (yours at x 112..114, the twin's at x 142..144,
mirror images) open with `LiveCells` when a room is won. The twin's side is built of real blocks (you see it through the glass) but
nobody can get there: a flood from your side never crosses the glass (`mirrorcheck.mjs`).

**The gallery:** the **dais** at [80, 104] (one step up) with the **sun mirror** on a swivel (a mesh); "Shine!" puts you in the stance
(a `carry`, the Joust's `look` pattern). A sunbeam (a soft shaft mesh) falls from a round window high in the east wall [102, 26, 104] onto
it. Between the dais and the back wall lies a still **pool** (water y 10, a low gold rail at z 100: fixed blocks + hidden solids). The
**Gloomy wall** is the back wall's face z 53.99, x 62..97, y 13..26 (above any reach). Two **pillars** (3 x 3 stone, y 11..26) at x
68..70 and x 89..91, z 62..64 cast "beam shadows" on the back wall. `MIRROR_PANE` panels on the side walls (x 57 and x 102, z 58..80,
y 12..20) let a beam bounce round them.

`mirrorAim` (`TERRAIN_AIMS.mirrorLand`): the nearest unfinished wing (its door, then its plate / start pad / dais), then a helper who
has not battled, then Duke Dazzle, then the way back. Words only say where (`🏓 Bounce-Back`, `👯 Looking-Glass Rooms`, `🔦 Moonlit
Gallery`, `Duke Dazzle`), never how. Inside the twin rooms the arrow points at the next pad pair's door, never at a pad.

Keys and state (`mirrorland.js`): `courtKey(n)` = `pw:mirror:court<n>`, `twinKey(n)` = `pw:mirror:twin<n>`, `beamKey(n)` =
`pw:mirror:beam<n>` (n 1..3; **not** `lightKey`, Atlantis has that), crew `pw:mirror:crew1..3` (`crewKey`). `mirrorState(game)` ->
`{ court, twin, beam, n, need: 9, done }`. No world block is ever changed by play (doors are `LiveCells`).

## 4. The three games (pure rules, no imports but `kindhelp.js` / `forfun.js`, 1/120 s sub-steps, Node-runnable)

### 4.1 Bounce-Back (`src/bounceback.js`): angle the rebound

**One short line:** "Bounce it past Cleo! She copies you." The action button on the plate says **Play!**; Jump steps off the rail.

- You stand on the rail at your end, holding a big **hand mirror** (a mesh in front of the camera, like the Swirl Wand). The stick (A/D)
  slides you along the rail at 5.5 blocks/s; your **look** tilts the mirror: its face points the way you look, `tilt` clamped to ±40°
  from straight down the court. The view stays on the court (yaw clamped ±55°, pitch −35°..+10°).
- **The shine ball** (radius 0.35, a glowing pearl, flat at knee height) glides in 2D. Side walls and the back wall beside the goal are
  mirrors: perfect reflection (`v` component or `u` component flips). It touches your mirror when it crosses v 1.5 within
  `mirror.half` 0.8 + r of your u: it **reflects about your mirror's normal** (out = d − 2(d·n)n), the outgoing angle clamped to ±70° from
  straight (no endless side bounces), speed +3 % a hit (cap x1.3). Past your mirror = into your net = **Cleo's point**.
- **Copycat Cleo** stands on her line (v 28.5) in front of the goal mouth (u 4..12), holding her own mirror (half 0.9). **She copies
  you:** her u follows yours (same side of the court, a true mirror) 0.3 s late, **until the ball is within `react` seconds of her
  line**, then she slides toward where it will cross at `slide`. So a **straight return goes straight back to her** (she is standing
  exactly there): the trick is to angle the ball away from where you stand, or bank it off a side mirror. A ball past her into the goal
  mouth = **your point**; past her outside the mouth it bounces off the back mirror and comes back (play on). Her returns aim at the far
  side from you (`aimOff` 35°, from a seeded pattern, no `Math.random`). She serves after every point (toward you, ±25°, seeded).
- **A round:** first to **3** of your points; if Cleo gets **3** first the round starts again (a miss for the kind help).
  - Round 1 "Hello, Cleo!": ball 6.0 b/s, `react` 0.6 s, `slide` 2.0 b/s. Any tilt of 15°+ beats her.
  - Round 2 "Cleo is quick!": ball 7.2, `react` 1.0, `slide` 3.2: only wide angles or a bank off a side mirror score.
  - Round 3 surprise "The spinner!": a mirror bar 3 long turns slowly in mid-court (u 8, v 15, 0.5 rad/s, a mesh; balls reflect off
    it too, so a bank must miss it or use it), ball 8.2, `react` 1.2, `slide` 3.8.
- Won round n = `courtKey(n)`, saved at once. Funny bits: Cleo copies your little sidesteps and your jump when you step off, pulls a
  face at your point, does a dizzy spin when the spinner fools her. Sounds: `shineping` (any mirror bounce), `mirrorpoint` (yours),
  `cleopoint` (hers, a cheeky "Copy that!").
- **Why the naive kid fails:** standing still, looking straight ahead, sliding to every ball: every return is straight, Cleo is already
  there, and the ball speeds up until it slips past. **Skilled:** reads where Cleo is (where you are), tilts so the ball goes to the far
  post or banks it, moves early.
- **Kind help** (a miss = a round Cleo won): Cleo's `slide` and `react` x `slow`, the ball's speed x `slow`, the goal mouth x `more`.
- **HARD** (rematch, you hold the star): ball x1.1, `react` +0.2 s, `slide` x1.15.

### 4.2 Looking-Glass Rooms (`src/lookingglass.js`): steer two of you at once

**One short line:** "You and your twin: both on the gold pads!" No button: stepping onto the room's start pad starts it (a "pop!", your
twin waves at you through the glass).

- **The twin** is a silvery copy of you (`buildPerson` with your colours, a mirror sheen). It is a pure 2D body (half-width 0.3) on its
  side of the glass: **every walk sub-step of yours moves it by the mirror image** (dx -> −dx, dz -> dz; the glass is the plane x 128).
  It collides with its side's solid blocks (axis-separated slide, like the player; checked with `world.isSolid` at its feet + 1, so it is
  generic). **When it is blocked and you are not, you get out of step:** the natural consequence, and the hard-to-master trick. It hops
  when you jump (looks only).
- `Player.stepHook` (new, generic, **null everywhere else**): `Player.update` calls `this.stepHook?.(dx, dz, h)` after each walk
  sub-step, so the twin moves on exactly the same sub-steps at 60 and 20 fps (the `jump` spec stays bit for bit).
- **Pads:** gold pads (meshes, radius 0.7) in pairs, one on each side. **You on yours and the twin on its own at the same moment for
  0.5 s** = the pair glows (`padglow`) and is a checkpoint. All pairs of the room glow = the room is won: `twinKey(n)`, the doors open.
- **Things that get in the way** (meshes on closed-form paths of the room's own clock):
  - **Ink puddles** (the Scribble's ink, black with a shine, radius 1.0-1.3): the twin plops in ("Blub!", `twinplop`) and pops back up
    as your mirror image again (in step). Puddles on your side do the same to you (back to the last glowing pad pair).
  - **Bonk balls** (big soft rubber balls, radius 0.9) rolling back and forth across the room along `u` (1..17), period 4-6 s: a bonk
    (`twinbonk`) puffs **both** of you back to the last glowing pair.
  - **The mop** (room 3, the twin's side): an arm 3.5 long turning at 0.7 rad/s round (u 12, v 11); a bonk as above.
  - **Dressers and wardrobes** (blocks): walls that stop the twin but not you, or you but not the twin.
- **The rooms** (pads and things as room-local data `TWIN_ROOMS[n]`, tuned with the bots):
  - Room 1 "Hello, Twin!": 2 pairs, mirror-exact (yours at u 6 v 12 and u 3 v 4 mirror theirs). A puddle sits on the twin's straight
    line to each pad (twin side u 6 v 7, u 4 v 2): walk round where **it** would plop. Easy once you watch the glass.
  - Room 2 "Bonk Balls!": 3 pairs mirror-exact; a ball lane on your side (v 6, period 5 s) and two on the twin's (v 6 half a period
    later, v 11 period 4 s): cross the lanes when both of you are clear (windows >= 1.2 s every cycle).
  - Room 3 "Out of Step!": 2 pairs **not** mirror-exact: your pad at u 4 v 13, the twin's at u 4 v 9. A dresser on the twin's side at
    v 5 from u 1..8 lets you get 4 out of step (walk on while it is stuck), then lead it round the dresser's end (u >= 10). The mop turns
    near its pad; one bonk-ball lane on your side.
- Walking back out of a room stops it (the twin waves bye); nothing saved but the room keys.
- **Why the naive kid fails:** walks straight to its own pad: the twin plops in ink (1), gets bonked (2), or stands 4 short of its pad
  (3). **Skilled:** watches the twin, waits for gaps, uses the dresser.
- **Kind help** (a miss = a plop or a bonk in this room): balls' and the mop's speed x `slow`, pads' radius x `more`, puddles x `slow`
  (smaller).
- **HARD:** balls and mop x1.15, puddles x1.1.

### 4.3 The Moonlit Gallery (`src/spotlight.js`): keep the light on a runaway

**One short line:** "Shine on the Gloomies till they pop!" The action button at the dais says **Shine!**; Jump steps off.

- In the stance your look turns the sun mirror and the reflected **spot of light** (a soft disc mesh, radius 0.9) lands where the beam
  hits. On iPad the drag turns it and the stick too (rate `stick` 1.4 rad/s). **The beam:** a ray from the mirror along your look,
  through the world with a voxel DDA (`beamRay(origin, dir, isPane, isSolid, max = 2)`): on a `MIRROR_PANE` face it **reflects**
  (axis-aligned faces flip one component), on any other solid it stops; drawn as a faint shaft. Pure, so the bots and the browser agree.
- **Gloomies** (radius 0.6, fuzzy scribble balls with googly eyes) crawl over the Gloomy wall in 2D (x, y). A Gloomy in the spot
  **shivers and squeaks**; held in the light for `hold` seconds without a break it **poofs into sparkles** (`gloomypoof`). Out of the
  light its shiver fades at 2x the rate it filled. A round ends when all are gone, or after **45 s** (they all come back: a miss).
  - Round 1 "Gloomy!": 3 Gloomies wander slowly (0.8 b/s), do not flee; `hold` 1.0 s. Teaches holding still.
  - Round 2 "They run!": 4 Gloomies; lit ones **flee** from the spot's middle at 2.6 b/s and zigzag (turn every 0.6-1.0 s, seeded),
    stop-and-go when not lit; `hold` 1.2 s. Lead them.
  - Round 3 "Hide and seek!": 4 Gloomies, two of which keep to the **beam shadows** of the pillars (wall cells no direct ray from the
    mirror reaches, `mirrorcheck.mjs` lists them); bank the beam off a side mirror panel to reach behind; flee 2.8, `hold` 1.2.
- Won round n = `beamKey(n)`. Sounds: `gloomyshiver` (loops while lit), `gloomypoof`, `gloomygiggle` (one ducked into a shadow).
- **Why the naive kid fails:** aims where a Gloomy **is** with a kid's reaction lag: from round 2 it zigzags out of the spot before 1.2 s,
  and in round 3 two are unreachable without a bounce. **Skilled:** leads the zigzag, holds steady, banks off a panel.
- **Kind help** (a miss = a round whose 45 s ran out): Gloomies' speed x `slow`, `hold` x `slow`, the spot's radius x `more`.
- **HARD:** flee x1.12, `hold` +0.2 s.

### 4.4 Shared

- `mirrorHelp(misses)` (in `bounceback.js`, re-exported by the other two) = `kindHelp(misses)` mapped onto the levers above; misses
  counted per round, reset on a win. Rows added to `kindhelp.js`'s comment table. **No other help.**
- `ForFun` per game: once its 3 keys are held it plays its rounds again in turn, saves nothing new (`FUN.tag` in its toast).
- `battleEnded` (live): a won Duke battle clears the nine round keys (the crew keys stay), so a rematch plays the games again (`HARD`).
- `game.playing()` false (battle, ask, panel, pause) = the clocks stand still.
- Nothing is sent in play together: each player plays their own court, twin and beam (a friend sees your avatar on the rail; Cleo,
  balls and Gloomies are local), like the Ball Stadium.

## 5. Duke Dazzle (the Boss) and his helpers

`addBoss` in `pictureboss.js` (its own `/* ==== Mirror ==== */` section):

- **Duke Dazzle**, a person (`look: 'dazzle'`: a white ruff collar, a silver coat with gold buttons, tall curly hair, a curly gold hand
  mirror he keeps looking into), colours shirt 0xd8d8f0, pants 0x5a4a8a, hair 0xe8c070, skin 0xf2d0b0. Title "Duke Dazzle · Mirror Palace
  Boss" (spelled out: a closed world's frame is "Secret World").
- **Gate:** `mirrorState(game).done ? null : "Oh, my poor smudgy palace! I can't come out like THIS. (🏓 c / 3 · 👯 t / 3 · 🔦 b / 3)"`;
  then the base crew rule (Cleo, Gwen, Lux).
- **Team** (top level 63, the easy side; `starTeam` adds the per-star levels): periscoot 61, bendabout 62, lynxlook 62, grandlooker 63
  (move lists = what `movesWith` gives; the spec checks).
- intro: "Look at my palace! It SHINES again!", "Now, a dazzling battle!" · lose: "Simply dazzling! The star was in my best mirror all
  along." · win: "A lovely try! Fix your hair, rest a bit, and come back." · rematchIntro: "Back again? I polished my team!"
- **Note:** "I built this palace so my creatures could pull funny faces at themselves. Thank you for making the mirrors shine again!"
- **Crew** (`look: 'mirror'`: a silver sash and a little round hand mirror on the belt):
  - Copycat Cleo (shirt 0xff9ad8, pants 0x4a4a6a, hair 0x2a1a10, skin 0xc68a5a): copykit 59, lookit 60. intro "You beat me at
    Bounce-Back! Copy that!", "Battle!" · line "Don't hit it where you are!"
  - Glazier Gwen (shirt 0x8ad8e8, pants 0xf6efe0, hair 0xc8902a, skin 0xf2d0b0): wobblet 60, copykit 61. intro "You and your twin
    did it!", "Now a battle?" · line "Your twin gets stuck. Use that!"
  - Lamplighter Lux (shirt 0xffe08a, pants 0x3a3a6a, hair 0x1a1a1a, skin 0xe8c09a): lookit 60, periscoot 61. intro "No more
    Gloomies! Thank you!", "Battle me!" · line "Light bounces off the shiny walls!"
- Each helper battles once their own game's three keys are held (before that: their line). Won: `crewKey` (kept forever).

## 6. The Mirror type

- Type id **`mirror`** (no clash: types are the 45 in `TYPE_COLORS`; `spinner.js`'s "Mirror!" twist id is another namespace).
  `TYPE_COLORS.mirror` = `'linear-gradient(135deg,#f4f4ff,#c8c8e8 40%,#ffffff 50%,#c8c8e8 60%,#e8e0ff)'` (a silver sheen, light enough for
  the dark chip text). Wool **138** (`WOOL_ID_OVERRIDE.mirror`, lilac-silver).
- **Chart** (separate statements, no old cell edited; checked with today's numbers, 2026-10-31):
  `EFFECTIVENESS.mirror = { ninja: 2, surprise: 2, doodle: 2, ghost: 0.5, metal: 0.5, mirror: 0.5 };` (nowhere to hide from a mirror;
  you see the surprise coming; a drawing comes out backwards; a ghost has no reflection) and `EFFECTIVENESS.rock.mirror = 2;
  EFFECTIVENESS.ball.mirror = 2; EFFECTIVENESS.sound.mirror = 2; EFFECTIVENESS.light.mirror = 0.5;` (stones and balls crack glass, a high
  note too; light just bounces off). Defender counts after: mirror 3 weak, ninja 3 -> 4, surprise 3 -> 4, doodle 2 -> 3 (all <= 5).
- **Creatures** (7, four own shapes in `shapes.js` `SHAPES_MIRROR`; every model wears **`gear: 'sheen'`**: one merged mesh of two thin
  glints that slide across its shiny parts):
  - **Lookit > Grandlooker** (shape `handmirror`): a little hand mirror that hops on its handle; its glass shows a funny face that
    changes (two faces, swapped by the idle animation) > a tall dressing-table mirror on lion-claw feet with a curly gold frame.
  - **Copykit > Lynxlook** (shape `twincat`): a silver kitten with a see-through "reflection" kitten a step behind that copies it
    mirrored > a big mirror-glazed lynx with its twin floating beside it. **Lynxlook is rideable (land)** (riding was the big hit).
  - **Wobblet > Bendabout** (shape `funmirror`): a wobbly funhouse-mirror blob on stubby feet that squashes and stretches > a tall
    funhouse mirror that bends itself into an S (tall, then wide, in turns).
  - **Periscoot** (7th, single stage, shape `periscope`): a brass periscope on one wheel that peeks round corners with its mirror head.
  - Names checked against the 316 species (no clash; "Twinkit" was dropped: too close to Twinklet). Levels / evolutions like the
    Bubble set (evolve at 24-26, catch rates 0.45 / 0.12-0.1 / 0.15).
- **Wild gait `mimic`** (`creatures.js` `GAITS`, closed form, no `Math.random`): within 7 of you a wild Mirror creature **copies you
  mirrored** across the plane halfway between you (step left, it steps its right; step toward it, it steps toward you), staying within
  4 of its home cell on legal ground. Walk straight at it and you meet in the middle (a bump is only noticed; E / a tap battles, the
  owner's 2026-10-26 rule). Condition **`preening`** (`spawnrules.js`): at `world.nooks` (in front of the funny mirrors, by the garden
  hedges).
- **Spawns:** `MIRROR_SPAWNS = [['lookit', 1.3, 'preening'], ['copykit', 1.2, 'preening'], ['wobblet', 1.0, 'preening'],
  ['grandlooker', 0.12, 'preening', 'mirror'], ['lynxlook', 0.12, 'preening', 'mirror'], ['bendabout', 0.1, 'preening', 'mirror'],
  ['periscoot', 0.15, 'preening', 'mirror']]`, only in `REALMS.mirror.spawns`; `wild` = the `pictureRealm` default (5 / 2 s);
  `AFTER_CHECKS.mirror = g => star(g, 'mirror') || mirrorState(g).n >= 3`.
- **Moves** (ids are not sound names): `glintshot` Glint Shot 40; `flashback` Flash Back 85 / 0.9; `quickcopy` Quick Copy 40
  priority 1; `dazzlestare` Dazzle Stare (lower atk); sigs `mirrormirror` Mirror Mirror (Grandlooker, 90 / 0.9, flinch 0.2),
  `copycatcombo` Copycat Combo (Lynxlook, multi 2-5), `funhousesquish` Funhouse Squish (Bendabout, 95 / 0.9, flinch 0.25),
  `roundthecorner` Round the Corner (Periscoot, 80, `sure`). `T1..T4.mirror` = glintshot, flashback, quickcopy, dazzlestare.
  `BIG_MOVES.mirror`: `shinyshield` Shiny Shield (shield), `funhouse` Funhouse (field: "Everything goes wobbly! Mirror moves are
  stronger for 5 turns. Foes too!"), `lastlook` Last Look (lastword).
- **fx:** `TRAVEL.mirror` (a silver flash that zigzags once as if off an invisible pane), `IMPACT.mirror` (a spray of glints and a
  ripple), `FX_COLORS.mirror`, `SIG` for the four sigs; sound `fx:mirror` (a bright glassy "ting" up a fifth).
- Book (habitat rows come from `REALMS`, nothing to add), README type tables, the roster spec (7 creatures, 4 shapes).

## 7. Block ids: this world takes 138 and 139

Free today: **137, 138, 139** only. **137 stays reserved for wave 19's Custom wool** (the Wizard's Tower planner owns it).

| Id | Name | What |
| --- | --- | --- |
| **138** | mirror wool | the type's wool (`WOOL_ID_OVERRIDE.mirror = 138`), the palace trim |
| **139** | `MIRROR_PANE` | a silver mirror tile with a white diagonal sheen (`MORE_TILES`); solid, `fixed`; **light bounces off it** (the Gallery's beam rule is "any `MIRROR_PANE` block reflects", generic), the court's walls, the Duke's wall, palace windows |

After this **no block id is left but 137**. Everything else is existing blocks (white stone bricks, glass, gold `PICTURE_FRAME`,
coloured wool, water), `LiveCells` (the room doors), meshes (balls, pads, puddles, the mop, the twin, Gloomies, mirrors, the beam, the
funny mirrors' reflections) and `HOUSE_PROP` hidden solids (fences). If the owner wants 139 kept spare, the fallback is `B.GLASS` tinted
by a Mirror-only shader define (like `sketch`) and a `world.panes` cell set for the beam: more code, so not the default. The next world
after wave 19 needs 16-bit block ids first (a separate task, see `plans/bubble-well.md` section 7). `blocks` spec: allow 138 / 139.

## 8. The 13th star: the Swirl, the bridge and the Wizard's island

Today `PICTURE_WORLDS` has 12 entries (portal `door: false`), `FRAME_WORLDS` 11, `BRIDGE_WORLDS` 12, `FRAME_SPOTS` 11, and the island's
x = `wizardX(BRIDGE_WORLDS.length)` = 142. `wizardX(13)` would be **148** (island x 139..157, keep to 158: still inside 160) but **the
island must not move**: wave 19 builds the Wizard's Tower on it, and removing Mirror would move it back. So:

- **The island is pinned:** `WIZARD.x = 142` (a constant); `wizardX(n)` is kept for old callers and returns `WIZARD.x` for any `n`.
  The `wizard` keep box and the bridge keep (x 59..132) never change.
- **The bridge always fills the same span** x 61..132: stone i of n spans `x0 = 61 + floor(i * 72 / n)` to `61 + floor((i + 1) * 72 /
  n) − 2` (`stoneBox(i, n)`; `stoneX(i)` stays as today's n = 12 formula for old callers). For **n = 12 that is exactly today's stones**
  (61-65, 67-71, ... 127-131: checked); for **n = 13** they are 4 and 5 long in turn (61-64, 66-70, 72-75, 77-81, 83-86, 88-92, 94-97,
  99-103, 105-108, 110-114, 116-119, 121-125, 127-131), 1-cell gaps, still a walkable bridge. Stones are live cells (air in the world
  data), so this moves **no block**.
- **The 13th frame: spot `S5` at x 24 on the south gallery** (`{ id: 'S5', x: 24, z: 109, y: 16, facing: [0, -1], stand: [24, 15,
  108] }`, `FRAME_SPOTS[11]`), the same move the 11th frame made on the north side (2026-10-26: N5 at x 24, the gallery grew 8 west, the
  lift moved to x 18-19). The south deck grows from x 28 to **x 20** (`[20, 68, 103, 108]`, y 14) and lift `southW` moves from x 26-27
  to **x 18-19** (a lift is a box, no blocks). Nothing else is in x 18..27, z 103..109 (checked: sculptures, islets, lanterns, posts).
  `mirror` is appended last to `PICTURE_WORLDS`, so it is `FRAME_WORLDS[11]` -> spot 11 with no `FRAME_MOVED` entry; its gem corners are
  `GEMS[11 % 7]` = mind (pink). No existing frame moves (the spec's `hang` check stays). Frame colours [0xd8d0f8 lilac, 0xf8e8a0 gold].
- **`REALMS.swirl`: version 6, `sameCells: [4, 5]`** (every old cell is where it was; the new cells were air): old Swirl edits and
  positions are kept. An old edit inside the new frame's keep box is dropped by `editAllowed` as usual; a block someone floated at x
  20..27 simply stays. Old v5 clients see "Your friend has a newer game" (the `realm` `rv` check), as intended.
- **Frame picture** `drawMirrorPicture`: a lilac palace wall, a big gold oval mirror with a silver kitten (Copykit) and its reflection,
  a pearl ball with a dotted bounce off the frame's edge (no star shapes: only the Wizard's star is a star).
- **Words:** `STORY.md` "There are **13 stars** ... twelve hang as frames in the Swirl ... the 13 stars light the 13 stones"; the Mirror
  Palace paragraph (section 2); its row in the table. `CLAUDE.md`: Picture Worlds (13 stars, `FRAME_WORLDS` 12, `BRIDGE_WORLDS` 13,
  12 frame spots, S5, `WIZARD.x` pinned, `stoneBox`), the Swirl's version 6, ids 138 / 139 taken, 46 types (Mirror), the code map rows,
  the spec list, Open items (wave 18 Mirror, wave 19 the Wizard's Tower: "137 is the Custom wool"). `ROADMAP.md`: wave 18 = this plan,
  the Wizard's Tower renumbered to wave 19 (its heading and every "wave 18" that means it), the "last three stars" Mirror bullet points
  here, "Dropped types": "Mirror came back as a lively world (wave 18)".
- **The wave-19 rule for the bridge:** "the bridge is whole" = every star of `BRIDGE_WORLDS` held (computed, never `12` or `13`).

## 9. Closing and removing: one switch each

Two states, both one line in `src/comingsoon.js`:

**(a) Closed** (the existing `LATER`): `LATER.push('mirror')` at build. Without `?preview` the frame is covered with cloth and looks like
the old secret frames ("❓ Secret World"), the realm can't be entered, the guide never points into it. Its stone is an unlit outline and the
HUD says x / 13 (like Cube Planets today). **Opening it for everyone** = `OPEN_NOW.push('mirror')`.

**(b) Removed** (new): `export const REMOVED = []; // owner switch: ['mirror'] takes the Mirror Palace out of the game for everyone` plus
`export const worldRemoved = id => REMOVED.includes(id);` (tests may add ids through `globalThis.__pcRemoved` before the modules load,
like `__pcWave15`), and `worldOpen(id)` is false for a removed id even with `?preview`. With `REMOVED = ['mirror']`:

| Thing | Removed |
| --- | --- |
| `PICTURE_WORLDS` | the entry **stays** (ids are saved: `loadStars`, `loadKeys`, `loadBossWins` keep `mirror`), marked `removed: true, ready: false, door: false, bridge: false` |
| Frames / bridge | `FRAME_WORLDS` 11, `BRIDGE_WORLDS` 12: no S5 spot, the south deck at x 28, `southW` at x 26-27, 12 stones in today's places. **The Swirl's blocks are today's, block for block** (the spec compares a checksum recorded before the build) |
| Wizard's island | x 142 either way (pinned): removing never moves the Wizard's tower |
| Swirl version | **5** with `sameCells: [4, 6]` (a v6 save keeps its edits: the frame's cells were a keep, the deck cells only lose their stone) |
| Realm | `REALMS.mirror` is not registered: nobody can enter; a save made inside it loads in the main world (the existing unknown-place rule); its realm edits are dropped (none can exist: the whole map is a keep) |
| Stars | new `STAR_WORLDS` (= `BRIDGE_WORLDS`) and `starsWon(stars)`: the HUD's row and count (`ui.js`), the star toast (`pictureboss.js`), `portal.stars()` and `starBonus` count only those: x / 12 again. A held Mirror star stays in the save, unseen |
| Wild creatures | none: they only live in `REALMS.mirror.spawns`, so the Book shows no "where" row; the Book list skips **unseen** species of a removed world's type (`type: 'mirror'` on the entry) |
| Old saves | Mirror creatures keep species, type, moves, traits: they battle, evolve, show in the Book (seen / caught), trade and duel (the type, chart, moves, models, fx and sounds all stay in the code). Keys `pw:mirror:*`, `bossWins.mirror` and the star are never dropped, so **putting it back (`REMOVED = []`) restores everything** |
| Docs | the same commit flips the `STORY.md` / `README.md` / `CLAUDE.md` lines (13 -> 12 stars, the Mirror paragraph); optional, the game does not read them |

Nothing else checks for Mirror: the switch lives in `comingsoon.js`, `pictureworlds.js` (the entry's flags), `swirlland.js` (spot, deck,
lift: `const MIRROR_IN = !worldRemoved('mirror')`) and `realms.js` (register `REALMS.mirror`, the Swirl's version). Full deletion of the
code later is never needed: removed code is dormant.

## 10. Files

New:

| File | What |
| --- | --- |
| `src/mirrorland.js` | terrain as data (Node-runnable, `TERRAINS.mirrorLand`): `MIRROR_SIZE`, `G`, `ARRIVAL`, `GARDEN`, `PALACE`, `FUNHALL`, `FUNNY`, `COURT`, `TWIN`, `TWIN_ROOMS`, `GALLERY`, `DAIS`, `GLOOMY_WALL`, `PILLARS`, `PANES`, `GRAND`, `RESTS`, keys `courtKey` / `twinKey` / `beamKey`, `mirrorState`, `liveCells()` (room doors), `mirrorLand(world, def)` (sets keeps, rests, nooks, parts, arrivals, bosses / crew via `placeBoss` / `placeCrew`, `world.realmBiome`), `mirrorAim` |
| `src/bounceback.js` | pure: `COURT_RULES`, `BounceRound` (ball, your mirror, Cleo, spinner, points, events), `reflect(d, n)`, `mirrorHelp`, `HARD.court` |
| `src/lookingglass.js` | pure: `TWIN_RULES`, `Twin` (mirrored body, `step(dx, dz, h, isSolid)`), `TwinRoom` (pads, puddles, balls, mop, checkpoints, events), `HARD.twin` |
| `src/spotlight.js` | pure: `BEAM`, `beamRay` (voxel DDA with pane reflections), `Gloomy`, `SpotRound` (hold, flee, zigzag, shadows, 45 s), `HARD.beam` |
| `src/mirrorlive.js` | `MirrorLive` = `LIVE.mirror`: the rail and dais stances (`carry` objects with `look`, `wantsLeave` on Jump), the twin (`player.stepHook`), meshes, `near` / `use` (Play! / Shine!), chip (`🏓 c/3 · 👯 t/3 · 🔦 b/3`), the funny mirrors' reflections, `aim`, `talk` / `talkPrompt` for the helpers, `battleEnded`, `manual` + `step(dt)`, `info()` |
| `src/mirrorprops.js` | models (merged / instanced, vertex colours): hand mirror (view model), shine ball, Cleo's mirror, goal net, spinner bar, pads, puddles, bonk balls, mop, the twin (`buildPerson` + sheen), sun mirror on its swivel, sunbeam shaft, spot disc, Gloomies (fuzzy + googly eyes, instanced), poof sparkles, funny-mirror panes with reflection avatars (`buildPerson` scaled: tall 1 x 1.7, wide 1.6 x 0.7, tiny 0.6, wobbly (animated), upside down, two of you; drawn only within 6 blocks, at the mirror image of your position, in a 1.5-deep dark alcove behind a pale silver pane) |
| `tests/specs/mirror.mjs` | the spec (section 11) |
| `tests/mirrorcheck.mjs` | terrain in Node (stand-in world): reach, keeps, the sealed glass, the court fence, the pool, Gloomies out of reach, beam shadows (which wall cells need a bounce), ways back, nooks |
| `tests/mirrorbots.mjs` | the three games' pure rules played by bots at 60 / 20 steps a second |
| `tests/mirrornode.mjs` | the real `Player` + `MirrorLive` in Node (like `cubenode.mjs`), `mirrorEnv(seed)`, kids with real keys |
| `tests/mirror-preview.mjs` | photographs the models for the owner |
| `tests/fixtures/swirl-v5.json` | recorded **before** stage 1 changes anything: the Swirl's data checksum, frame spots, stone boxes, lifts (the removed state must equal it) |

Existing files touched (additions in their own `/* ==== Mirror ==== */` sections, never re-ordering old lines):

| File | Why |
| --- | --- |
| `src/comingsoon.js` | `LATER.push('mirror')`, `REMOVED`, `worldRemoved`, `worldOpen` honours removed |
| `src/pictureworlds.js` | the `mirror` entry (`type: 'mirror'`), `drawMirrorPicture`, removed flags, `STAR_WORLDS`, `starsWon` |
| `src/swirlland.js` | S5 + deck + lift behind `MIRROR_IN`, `WIZARD.x` pinned, `stoneBox(i, n)` |
| `src/realms.js` | `REALMS.mirror` (`pictureRealm({ id: 'mirror', name: 'Mirror Palace', seedSalt: 0x3177, size: [160, 160], terrain: 'mirrorLand', arrive: [80, 152], biome: 'mirror', walk: [B.STONE_BRICKS, B.GRASS], spawns: { mirror: MIRROR_SPAWNS, cave: [] }, zoneNames: { mirror: 'Mirror Palace' }, look: { sky: 0xf2e6ff, fog: [60, 160], time: null, weather: false, light: 1, still: true, stars: false }, clock: '🪞 Mirror Palace', travelText: 'Looking in...', travelIcon: '🪞', enterText: 'Hello, hello! Welcome to the Mirror Palace!', arriveHint: 'Three games, three helpers, then Duke Dazzle!', noHomeText: 'No homes in the palace! Build your home in your own world.', followText: 'Look in too' })`, unless removed), the Swirl's version / `sameCells`, `TERRAINS.mirrorLand`, `TERRAIN_AIMS.mirrorLand` |
| `src/player.js` | `stepHook` (one call after each walk sub-step; null by default) |
| `src/blocks.js` | 138 wool, 139 `MIRROR_PANE` + its tile |
| `src/species.js` | colour, chart, moves, big moves, `T1..T4`, 7 species, `MIRROR_SPAWNS` |
| `src/shapes.js` | `SHAPES_MIRROR` (4 shapes), gear `sheen` |
| `src/creatures.js`, `src/spawnrules.js` | gait `mimic`, condition `preening` |
| `src/traits.js` | `TRAITS.rideable.species`: `lynxlook` = land |
| `src/wildafter.js` | `AFTER_CHECKS.mirror` |
| `src/pictureboss.js` | Duke Dazzle + crew; star toast via `starsWon` |
| `src/npc.js` | looks `dazzle`, `mirror` |
| `src/gymlive.js` | `LIVE.mirror = MirrorLive` |
| `src/fxrecipes.js`, `src/sound.js` | fx + `fx:mirror`, `shineping`, `mirrorpoint`, `cleopoint`, `padglow`, `twinplop`, `twinbonk`, `gloomyshiver`, `gloomypoof`, `gloomygiggle` |
| `src/kindhelp.js` | comment rows only |
| `src/ui.js`, `src/portal.js` | star counts via `STAR_WORLDS` |
| `src/book.js` | skip unseen species of a removed world's type |
| `README.md`, `STORY.md`, `CLAUDE.md`, `ROADMAP.md` | section 8 |
| `tests/run.mjs` | the `mirror` spec |
| `tests/specs/swirl.mjs`, `picture-worlds.mjs`, `portal.mjs`, `comingsoon.mjs`, `roster.mjs`, `blocks.mjs` | counts from the data (12 / 13 frames and stones by the switch), the pinned island, `LATER` has mirror, roster skips removed types' "findable", ids 138 / 139 |

No `WORLD_VERSION` bump (the main world is unchanged), no duel `VERSION` bump (no battle rule changes), no world reset (a new world:
nobody has progress there).

## 11. Tests (spec `mirror`, `MIRROR_ONLY=data|swirl|removed|closed|land|rules|kids|play|real|ipad|pair|old|shots`)

- **data:** 46 types; 7 creatures, 4 own shapes with the sheen; moves, big moves, `T1..T4`; chart: no old cell changed (against a
  fixture taken before), every defender still <= 5 weaknesses where it was; fx + sound entries; wool 138, block 139; Duke's and the
  crew's teams (`movesWith`); keys / `mirrorState`; `mirrorHelp` within `KIND_HELP.max` on every lever.
- **swirl:** 12 frames (S5 at x 24, z 109), every spot used once, no old frame moved, `frameReturn('mirror')`; 13 stones exactly as in
  section 8, all air until won, the 13th lit by the star; island x 133..151; the walk flood reaches S5; version 6 `sameCells [4, 5]`: a
  v5 and a v4 save keep their Swirl edits and spot.
- **removed** (`__pcRemoved = ['mirror']`): the Swirl equals `tests/fixtures/swirl-v5.json` (checksum, spots, stones, lifts); version 5
  `sameCells [4, 6]`, a v6 save keeps its edits; no `REALMS.mirror`; HUD x / 12; the Book has no Mirror habitat row and hides unseen
  Mirror species; an old save with the Mirror star, `pw:mirror:court1`, `bossWins.mirror: 2`, a Lynxlook in the team and a Lookit in the
  box and `place: 'mirror'` loads in main, the Lynxlook battles a wild creature and wins, the save round-trips with star / keys /
  bossWins / creatures unchanged; then un-removed: HUD 1 / 13, the 13th stone lit, the frame back.
- **closed:** without `?preview`: covered secret frame, can't enter, x / 13; with it: open.
- **land:** `mirrorcheck.mjs` for three seeds (above).
- **rules:** `mirrorbots.mjs` at 60 / 20 (identical event traces). Bounce-Back: `still` (never tilts, perfect slide) never wins round 1
  in 3 minutes; `firstTime` (tilts 10-25° half the time, 0.25 s lag) wins round 1 most times; `skilled` (far-post aim, banks in 2-3)
  always wins all three. Twin: `straight` fails every room; `random` almost never wins; `watcher` wins rooms 1-2; `skilled` wins all.
  Spotlight: `lagging` (aims at where a Gloomy is, 0.35 s lag, no bounce) wins round 1, rarely round 2, never round 3; `skilled` (leads,
  banks) always. Kind help after misses; for fun; `HARD`; `battleEnded` clears the nine keys and keeps the crew's.
- **kids:** `mirrornode.mjs` with the real `Player`: the twin rooms with real keys (straight walker fails, skilled wins) and the
  pillar / jump spam does nothing; the stances with the real `carry` and look.
- **play:** the whole loop in the browser: arrival, a funny mirror shows a tall you, the three games (bots), saves at once and reloads
  mid-room, the crew, Duke's gate words, the battle, star, note, HUD 1 / 13, the 13th stone in the Swirl, a lost battle stays, a rematch
  plays again harder, for fun.
- **real:** one round of each with real keys / mouse through the game's own loop.
- **ipad:** Play! / Shine! on the action button, stick slides / turns, drag tilts, Jump steps off, fixed slots never move.
- **pair:** a friend follows in; each plays their own court, twin and Gloomies; nothing about them is sent.
- **old:** a save from before wave 18 loads (no Mirror fields), its Swirl edits kept.
- **shots:** `mirror-*.png` for the owner (the funny mirrors, Cleo mid-rally, the twin in room 3, the gallery with the beam, Duke).

## 12. Build stages

1. **Stage 1: the switch, the Swirl and the palace** (first, alone). Record `tests/fixtures/swirl-v5.json` from today's code before
   touching anything. `comingsoon.js` (`LATER`, `REMOVED`), `pictureworlds.js`, `swirlland.js`, `realms.js` (the Swirl's version,
   `REALMS.mirror` with `mirrorLand`, spawns `[]` for now), `mirrorland.js` (all terrain, keys, `mirrorState`, aim), blocks 138 / 139,
   `pictureboss.js` (Duke and crew with stand-in teams of old species, the real gate), `ui.js` / `portal.js` / `book.js` star and
   removed rules, `npc.js` looks, the other specs' counts, `mirrorcheck.mjs`, spec parts `swirl`, `removed`, `closed`, `land`, `old`.
2. **Stage 2: the Mirror type** (may run **in parallel with stage 1**: its files are `species.js`, `shapes.js`, `creatures.js`,
   `spawnrules.js`, `traits.js`, `fxrecipes.js`, `sound.js`, `README.md`; only its last step waits for stage 1: put `MIRROR_SPAWNS` into
   `REALMS.mirror`, `AFTER_CHECKS.mirror`, the real Boss / crew teams). Spec part `data`, the `roster` spec.
3. **Stage 3: the games** (after both): `bounceback.js`, `lookingglass.js`, `spotlight.js`, `player.js` `stepHook`, `mirrorlive.js`,
   `mirrorprops.js`, `gymlive.js`, `kindhelp.js` rows, sounds, `mirrorbots.mjs`, `mirrornode.mjs`, spec parts `rules`, `kids`, `play`,
   `real`, `ipad`, `pair`, `shots`, `mirror-preview.mjs`, then `STORY.md` / `CLAUDE.md` / `ROADMAP.md`. Tune `TWIN_ROOMS`, Cleo and the
   Gloomies with the bots until section 11's kid results hold at 60 and 20 fps. Then the owner plays it with `?preview`.

Each stage: merge `main` first, run its spec parts plus `swirl`, `picture-worlds`, `comingsoon`, `jump`, `old-saves`, push to `main` and
`claude/clever-ritchie-etj0nq` (fast-forward only).

## 13. Owner questions (with the defaults the builders use)

1. **Names:** "Mirror Palace", Duke Dazzle, Copycat Cleo, Glazier Gwen, Lamplighter Lux, the Gloomies; creatures Lookit > Grandlooker,
   Copykit > Lynxlook, Wobblet > Bendabout, Periscoot. *Default: these.*
2. **While it is closed,** should the covered 13th frame and an unlit 13th stone already show for everyone (HUD x / 13), like Cube
   Planets today? *Default: yes* (the Swirl must be the same for everyone, or friends could not play together there).
3. **Block 139** for `MIRROR_PANE` (after it only 137, the Custom wool, is left). *Default: take it* (section 7 has the fallback).
4. **The bridge stones** become 4 and 5 blocks long in turn so the Wizard's island never moves. *Default: yes.*
5. **Riding:** fenced out of the palace, allowed in the garden (Lynxlook is rideable). *Default: yes.*
6. **Removing it later** also edits `STORY.md` / `README.md` (12 stars again). *Default: yes, in the same commit as the switch.*
